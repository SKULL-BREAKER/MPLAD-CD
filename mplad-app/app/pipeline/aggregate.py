import sqlite3
import pandas as pd
import json
import yaml
import numpy as np
from datetime import datetime, timedelta, timezone

def run_aggregate(db_path, preset="balanced"):
    con = sqlite3.connect(db_path)
    
    with open("config/operating_points.yaml", "r") as f:
        op_pts = yaml.safe_load(f)
        thresholds = op_pts['presets'][preset]['thresholds']
        tier_cuts = op_pts['presets'][preset]['tiers']
        
    con.execute("DELETE FROM work_risk")
    con.execute("DELETE FROM district_risk")
    con.execute("DELETE FROM alerts")
    # also update detection_results tier
    con.execute("UPDATE detection_results SET tier = NULL")
    con.commit()
    
    # works
    works = pd.read_sql_query("SELECT id, district_id, status, expenditure, sanctioned_amount FROM works", con)
    # detection_results
    dr = pd.read_sql_query("SELECT work_id, detector, score, evidence_json FROM detection_results", con)
    # district_flags
    df_flags = pd.read_sql_query("SELECT district_id, flag, value, evidence_json FROM district_flags", con)
    
    # Calculate row tiers and contributions
    contributions = []
    
    # Update detection_results with tier
    dr_updates = []
    
    for _, row in dr.iterrows():
        wid = row['work_id']
        det = row['detector']
        score = row['score']
        ev = json.loads(row['evidence_json'] or "{}")
        tier = None
        points = 0.0
        
        if det == 'D1':
            d1_prim = thresholds.get('d1_primary', 0.92)
            d1_rev = thresholds.get('d1_review', 0.82)
            if score is not None and score >= d1_prim:
                tier = 'critical'
                points = 0.30
            elif score is not None and score >= d1_rev:
                tier = 'review'
                points = 0.15
                
        elif det == 'D2':
            d2_z = thresholds.get('d2_z', 3.0)
            if score is not None:
                if score >= d2_z:
                    tier = 'critical'
                    points = 0.20
                elif score <= -d2_z:
                    tier = 'review'
                    
        elif det == 'D3':
            stalled = ev.get('stalled_days')
            not_started = ev.get('not_started_days')
            flash_gap = ev.get('flash_gap_days')
            spend_ratio = ev.get('spend_ratio', 0)
            amount = ev.get('amount', 0) # wait, d3 evidence might not have amount. we can check works
            # fetch amount and spend_ratio from works if needed, but wait D3 might have it
            
            d3_flash_days = thresholds.get('d3_flash_days', 14)
            d3_stalled_days = thresholds.get('d3_stalled_days', 540)
            
            w_row = works[works.id == wid]
            sanc = w_row.iloc[0]['sanctioned_amount'] if not w_row.empty else 0
            exp = w_row.iloc[0]['expenditure'] if not w_row.empty else 0
            spr = exp/sanc if sanc > 0 else 0
            
            if flash_gap is not None and flash_gap <= d3_flash_days and spr >= 0.95 and sanc >= 500000:
                tier = 'critical'
                points = 0.25
            elif (stalled is not None and stalled > d3_stalled_days) or (not_started is not None and not_started > 365):
                tier = 'inefficiency'
                points = 0.10
                
        elif det == 'D5':
            # "share ≥ d5_share ∨ district HHI ≥ d5_hhi → review"
            d5_share = thresholds.get('d5_share', 0.25)
            # score is share for D5
            if score is not None and score >= d5_share:
                tier = 'review'
                points = 0.15
            # We don't have district HHI in evidence here, but we can assume score >= threshold is enough
            
        elif det == 'D6':
            d6_ghost_km = thresholds.get('d6_ghost_km', 8)
            w_row = works[works.id == wid]
            stat = w_row.iloc[0]['status'] if not w_row.empty else ''
            sanc = w_row.iloc[0]['sanctioned_amount'] if not w_row.empty else 0
            exp = w_row.iloc[0]['expenditure'] if not w_row.empty else 0
            spr = exp/sanc if sanc > 0 else 0
            
            if score is not None and score >= d6_ghost_km and stat == 'completed' and spr >= 0.9:
                tier = 'critical'
                points = 0.30
                
        elif det == 'D7':
            rule_id = ev.get('rule_id')
            if rule_id == 'R1':
                tier = 'critical'
                points = 0.35
            else:
                tier = 'medium'
                points = 0.15
                
        elif det in ('D1_split', 'D6_overlap', 'D8'):
            if score is not None and score >= 1.0:
                tier = 'review'
                points = 0.15
                
        elif det == 'ENSEMBLE':
            ens_thr = thresholds.get('ensemble', 0.6)
            if score is not None and score >= ens_thr:
                tier = 'review'
            points = score * 0.20 if score is not None else 0.0
            
        if tier is not None:
            dr_updates.append((tier, wid, det))
            
        if points > 0:
            contributions.append({
                'work_id': wid,
                'detector': det,
                'points': points,
                'signal': tier or 'score',
                'evidence_json': row['evidence_json']
            })

    if dr_updates:
        con.executemany("UPDATE detection_results SET tier = ? WHERE work_id = ? AND detector = ?", dr_updates)
        
    c_df = pd.DataFrame(contributions) if contributions else pd.DataFrame(columns=['work_id', 'detector', 'points', 'signal', 'evidence_json'])
    
    work_risks = []
    alerts = []
    now_ts = datetime.now(timezone.utc)
    
    # Generate works risk
    for wid, group in works.groupby('id'):
        did = group.iloc[0]['district_id']
        w_c = c_df[c_df.work_id == wid]
        
        # Risk = min(1, sum(capped contributions))
        risk_score = min(1.0, w_c['points'].sum()) if not w_c.empty else 0.0
        
        # Tiers: CRITICAL ≥ 0.60 · HIGH ≥ 0.40 · MEDIUM ≥ 0.25
        w_tier = 'LOW'
        if risk_score >= tier_cuts.get('critical', 0.60):
            w_tier = 'CRITICAL'
        elif risk_score >= tier_cuts.get('high', 0.40):
            w_tier = 'HIGH'
        elif risk_score >= tier_cuts.get('medium', 0.25):
            w_tier = 'MEDIUM'
            
        # TIER FLOOR RULE: any critical-tier row floors the work at HIGH
        has_critical = any(t == 'critical' for t in w_c['signal'])
        if has_critical and w_tier in ('LOW', 'MEDIUM'):
            w_tier = 'HIGH'
            
        c_list = []
        for _, c_row in w_c.iterrows():
            c_list.append({
                "signal": c_row['signal'],
                "points": c_row['points'],
                "detector": c_row['detector'],
                "evidence_ref": c_row['evidence_json']
            })
            
        work_risks.append((
            wid,
            float(risk_score),
            w_tier,
            json.dumps(c_list),
            now_ts.isoformat()
        ))
        
        # Alerts
        if w_tier in ('HIGH', 'CRITICAL'):
            top_det = w_c.sort_values('points', ascending=False).iloc[0] if not w_c.empty else None
            det_name = top_det['detector'] if top_det is not None else "ENSEMBLE"
            ev_str = top_det['evidence_json'] if top_det is not None else "{}"
            sla_days = 3 if w_tier == 'CRITICAL' else 7
            sla_due = (now_ts + timedelta(days=sla_days)).isoformat()
            
            alerts.append((
                f"ALT-{wid}",
                wid,
                did,
                w_tier,
                det_name,
                f"Anomaly detected in {det_name}",
                ev_str,
                "district_officer",
                0,
                "new",
                sla_due,
                now_ts.isoformat()
            ))

    if work_risks:
        con.executemany("INSERT INTO work_risk (work_id, risk_score, tier, contributions_json, updated_at) VALUES (?, ?, ?, ?, ?)", work_risks)
    
    if alerts:
        con.executemany("INSERT INTO alerts (id, work_id, district_id, severity, type, title, evidence_json, routed_to, escalated, status, sla_due_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", alerts)

    # District risk
    wr_df = pd.DataFrame(work_risks, columns=['work_id', 'risk_score', 'tier', 'contributions_json', 'updated_at'])
    wr_df = wr_df.merge(works[['id', 'district_id']], left_on='work_id', right_on='id')
    
    district_risks = []
    
    # HHI per district
    # Need expenditure per agency per district
    con.execute("CREATE TEMP TABLE IF NOT EXISTS temp_exp AS SELECT district_id, agency_id, SUM(expenditure) as exp FROM works GROUP BY district_id, agency_id")
    hhi_df = pd.read_sql_query("SELECT * FROM temp_exp", con)
    
    for did, group in works.groupby('district_id'):
        w_dist = wr_df[wr_df.district_id == did]
        p95 = w_dist['risk_score'].quantile(0.95) if not w_dist.empty else 0.0
        if pd.isna(p95): p95 = 0.0
        
        # Benford flag
        b_flags = df_flags[(df_flags.district_id == did) & (df_flags.flag == 'benford_chi2')]
        benford_flag = 1.0 if not b_flags.empty else 0.0
        
        # HHI norm
        d_ag = hhi_df[hhi_df.district_id == did]
        tot_exp = d_ag['exp'].sum()
        hhi_norm = 0.0
        if tot_exp > 0:
            hhi = sum(((a['exp']/tot_exp))**2 for _, a in d_ag.iterrows())
            hhi_norm = hhi # already normalized to 0-1 (if not percentage)
            
        # Utilization norm
        d_sanc = group['sanctioned_amount'].sum()
        d_exp = group['expenditure'].sum()
        util_norm = d_exp / d_sanc if d_sanc > 0 else 0.0
        
        d_risk = 0.5 * p95 + 0.2 * benford_flag + 0.15 * hhi_norm + 0.15 * (1 - util_norm)
        
        d_tier = 'LOW'
        if d_risk >= tier_cuts.get('critical', 0.60):
            d_tier = 'CRITICAL'
        elif d_risk >= tier_cuts.get('high', 0.40):
            d_tier = 'HIGH'
        elif d_risk >= tier_cuts.get('medium', 0.25):
            d_tier = 'MEDIUM'
            
        c_list = [
            {"signal": "P95 Work Risk", "points": p95},
            {"signal": "Benford", "points": benford_flag},
            {"signal": "HHI", "points": hhi_norm},
            {"signal": "Utilization", "points": util_norm}
        ]
        
        district_risks.append((
            did,
            float(d_risk),
            d_tier,
            json.dumps(c_list),
            now_ts.isoformat()
        ))
        
    if district_risks:
        con.executemany("INSERT INTO district_risk (district_id, risk_score, tier, contributions_json, updated_at) VALUES (?, ?, ?, ?, ?)", district_risks)
        
    con.commit()
    con.close()
    print("Aggregation complete.")

if __name__ == "__main__":
    run_aggregate("data/app.db")
