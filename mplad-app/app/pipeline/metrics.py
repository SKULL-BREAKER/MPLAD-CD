import sqlite3
import pandas as pd

def compute_metrics(db_path, preset):
    con = sqlite3.connect(db_path)
    
    # 1. Gather Data
    # works
    works_df = pd.read_sql_query("SELECT id, district_id, fy FROM works", con)
    n_districts = con.execute("SELECT COUNT(*) FROM districts").fetchone()[0]
    active_fys = con.execute("SELECT COUNT(DISTINCT fy) FROM works").fetchone()[0]
    
    # work_risk (guard against missing table or empty)
    # work_risk (guard against missing table or empty)
    try:
        risk_df = pd.read_sql_query("SELECT work_id, tier FROM work_risk", con)
    except (sqlite3.OperationalError, pd.errors.DatabaseError):
        # table might not exist yet
        risk_df = pd.DataFrame(columns=["work_id", "tier"])
        
    # fraud_labels for pattern calculation
    labels_df = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)
    
    # work classification for confusion matrix
    work_class_query = """
    SELECT work_id,
      MAX(CASE WHEN label_class IN ('fraud', 'inefficiency', 'violation') THEN 1 ELSE 0 END) as is_anomaly,
      MAX(CASE WHEN label_class='innocent' THEN 1 ELSE 0 END) AS is_innocent
    FROM fraud_labels
    GROUP BY work_id
    """
    work_class_df = pd.read_sql_query(work_class_query, con)
    
    # 2. Process flag status & classes on distinct works
    flagged_ids = set()
    if not risk_df.empty:
        flagged_ids = set(risk_df[risk_df.tier.isin(["CRITICAL", "HIGH"])]["work_id"])
        
    works_df["flagged"] = works_df["id"].isin(flagged_ids)
    
    works_df = works_df.merge(work_class_df, left_on="id", right_on="work_id", how="left")
    
    def assign_class(row):
        if row['is_anomaly'] == 1:
            return 'anomaly'
        elif row['is_innocent'] == 1:
            return 'innocent'
        else:
            return 'unlabeled'
            
    works_df['overall_class'] = works_df.apply(assign_class, axis=1)
    
    # merge labels to works for pattern eval
    df = works_df[['id', 'flagged']].merge(labels_df, left_on="id", right_on="work_id", how="inner")
    
    # 3. Calculate per-pattern metrics (label grain)
    patterns = {}
    f1_scores = []
    total_flagged = len(flagged_ids)
    
    for i in range(1, 11):
        p = f"P{i}"
        l_p = df[df.pattern == p]
        support = len(l_p)
        
        flagged_p = len(l_p[l_p.flagged == True])
        
        if support > 0:
            recall = flagged_p / support
        else:
            recall = None
            
        if total_flagged > 0:
            precision = flagged_p / total_flagged
        else:
            precision = None
            
        f1 = None
        if precision is not None and recall is not None and (precision + recall) > 0:
            f1 = 2 * (precision * recall) / (precision + recall)
        elif support > 0:
            f1 = 0.0
            
        patterns[p] = {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "support": support
        }
        
        if f1 is not None:
            f1_scores.append(f1)
            
    # 4. Overall metrics (work grain except n4_fp)
    macro_f1 = (sum(f1_scores) / len(f1_scores)) if f1_scores else None
    
    flagged_anomalies = len(works_df[(works_df.flagged == True) & (works_df.overall_class == 'anomaly')])
    system_precision = (flagged_anomalies / total_flagged) if total_flagged > 0 else None
    
    total_innocent_works = len(works_df[works_df.overall_class == 'innocent'])
    innocent_fp_count = len(works_df[(works_df.flagged == True) & (works_df.overall_class == 'innocent')])
    innocent_fp = (innocent_fp_count / total_innocent_works) if total_innocent_works > 0 else None
    
    # n4 is a pattern, so we use the label grain merge 'df'
    n4_works = df[df.pattern == "N4"]
    total_n4 = len(n4_works)
    n4_fp_count = len(n4_works[n4_works.flagged == True])
    n4_fp = (n4_fp_count / total_n4) if total_n4 > 0 else None
    
    # alert_budget
    weeks = active_fys * 52
    alert_budget = total_flagged / (n_districts * weeks) if (n_districts * weeks) > 0 else None
    
    # confusion matrix
    confusion = {
        "flagged": {
            "anomaly": flagged_anomalies,
            "innocent": innocent_fp_count,
            "unlabeled": len(works_df[(works_df.flagged == True) & (works_df.overall_class == 'unlabeled')])
        },
        "unflagged": {
            "anomaly": len(works_df[(works_df.flagged == False) & (works_df.overall_class == 'anomaly')]),
            "innocent": len(works_df[(works_df.flagged == False) & (works_df.overall_class == 'innocent')]),
            "unlabeled": len(works_df[(works_df.flagged == False) & (works_df.overall_class == 'unlabeled')])
        }
    }
    
    total_anomaly_labels = sum(patterns[f"P{i}"]["support"] for i in range(1, 11))
    
    counts = {
        "total_works": len(works_df),
        "total_flagged": total_flagged,
        "total_anomaly_works": len(works_df[works_df.overall_class == 'anomaly']),
        "total_anomaly_labels": total_anomaly_labels,
        "total_innocent": total_innocent_works
    }
    
    import yaml
    import json
    with open("config/eval_map.yaml", "r") as f:
        eval_map = yaml.safe_load(f)
    
    with open("config/operating_points.yaml", "r") as f:
        op_pts = yaml.safe_load(f)
        
    thresholds = op_pts['presets'][preset]['thresholds']
    
    # Invert eval_map to pattern -> list of detectors
    pattern_to_detectors = {}
    for d, pats in eval_map.items():
        for pat in pats:
            pattern_to_detectors.setdefault(pat, []).append(d)
            
    # Load detection_results
    try:
        det_df = pd.read_sql_query("SELECT * FROM detection_results", con)
    except (sqlite3.OperationalError, pd.errors.DatabaseError):
        det_df = pd.DataFrame(columns=["work_id", "detector", "score", "evidence_json"])
        
    # Load district_flags for D4
    try:
        dist_flags_df = pd.read_sql_query("SELECT * FROM district_flags", con)
    except (sqlite3.OperationalError, pd.errors.DatabaseError):
        dist_flags_df = pd.DataFrame(columns=["district_id", "flag", "value", "evidence_json"])
        
    works_dist = works_df.set_index("id")["district_id"].to_dict()

    def is_caught(work_id, pattern):
        fam = next((f for f, pats in eval_map.items() if pattern in pats), None)
        if not fam:
            return False
        return work_id in family_caught_works.get(fam, set())

    # 5. Compute detector-family caught sets
    family_caught_works = {d: set() for d in eval_map.keys()}
    rule_violations = 0
    overlap_signal = 0
    
    for _, dr in det_df.iterrows():
        d_name = dr['detector']
        work_id = dr['work_id']
        score = dr['score']
        ev = json.loads(dr['evidence_json'] or '{}')
        
        caught = False
        if d_name == 'D1':
            if score is not None and score >= thresholds.get('d1_primary', 0.92): caught = True
        elif d_name == 'D1_split':
            if score is not None and score >= 1.0: caught = True
        elif d_name == 'D2':
            if score is not None and abs(score) >= thresholds.get('d2_z', 3.0): caught = True
        elif d_name == 'D3':
            stalled = ev.get('stalled_days')
            not_started = ev.get('not_started_days')
            flash_gap = ev.get('flash_gap_days')
            spend_ratio = ev.get('spend_ratio', 0)
            amount = ev.get('amount', 0)
            
            thr_ns = thresholds.get('d3_not_started_days', 365)
            if not_started is not None and not_started > thr_ns: caught = True
            
            thr_stalled = thresholds.get('d3_stalled_days', 540)
            thr_stalled_low = thresholds.get('d3_stalled_days_low_spend', 365)
            if stalled is not None:
                if stalled > thr_stalled or (spend_ratio < 0.10 and stalled > thr_stalled_low): caught = True
                
            thr_flash = thresholds.get('d3_flash_days', 14)
            thr_spend = thresholds.get('d3_flash_spend', 0.95)
            thr_amt = thresholds.get('d3_flash_amount', 500000)
            if flash_gap is not None and flash_gap <= thr_flash and spend_ratio >= thr_spend and amount >= thr_amt: caught = True
            
        elif d_name == 'D4':
            if score is not None and score > 0: caught = True
        elif d_name == 'D5':
            if score is not None and score >= thresholds.get('d5_share', 0.30): caught = True
        elif d_name == 'D6':
            if score is not None and score >= thresholds.get('d6_ghost_km', 8): caught = True
        elif d_name == 'D6_overlap':
            if score is not None and score >= thresholds.get('d6_overlap', 1.0):
                overlap_signal += 1
                caught = False
        elif d_name == 'D7':
            if score is not None and score >= thresholds.get('d7_rule_match', 1.0):
                if ev.get('rule_id') == 'R1':
                    caught = True
                elif ev.get('rule_id') in ('R2', 'R3', 'R4'):
                    rule_violations += 1
                    caught = False
        elif d_name == 'D8':
            if ev.get('dup_matches', 0) > 0 or ev.get('cross_districts', 0) >= thresholds.get('d8_cross_districts', 5): caught = True
            
        if caught:
            # Map d_name to family if needed
            fam = d_name.split('_')[0]
            if fam in family_caught_works:
                family_caught_works[fam].add(work_id)

    # Pre-calculate true positives and innocents per family
    family_stats = {}
    for fam in eval_map.keys():
        caught = family_caught_works[fam]
        fam_pats = eval_map.get(fam, [])
        tp = sum(1 for w in caught if w in labels_df[labels_df.pattern.isin(fam_pats)]['work_id'].values)
        inn = sum(1 for w in caught if w in labels_df[labels_df.label_class == 'innocent']['work_id'].values)
        
        prec = tp / len(caught) if len(caught) > 0 else None
        inn_fp = inn / len(caught) if len(caught) > 0 else None
        
        family_stats[fam] = {
            'precision': prec,
            'innocent_fp': inn_fp
        }

    # Calculate per-pattern detector-level metrics
    detector_metrics = {}
    for i in range(1, 11):
        p = f"P{i}"
        l_p = df[df.pattern == p]
        support = len(l_p)
        
        caught_count = sum(1 for wid in l_p['id'] if is_caught(wid, p))
        recall = (caught_count / support) if support > 0 else None
        
        # Get family stats
        fam = next((f for f, pats in eval_map.items() if p in pats), None)
        prec = family_stats[fam]['precision'] if fam in family_stats else None
        inn_fp = family_stats[fam]['innocent_fp'] if fam in family_stats else None
        
        detector_metrics[p] = {
            "recall": recall,
            "precision": prec,
            "innocent_fp": inn_fp,
            "support": support,
            "caught": caught_count
        }

    con.close()
    
    return {
        "patterns": patterns,
        "detector_metrics": detector_metrics,
        "system_precision": system_precision,
        "innocent_fp": innocent_fp,
        "n4_fp": n4_fp,
        "macro_f1": macro_f1,
        "alert_budget": alert_budget,
        "confusion": confusion,
        "counts": counts,
        "rule_violations": rule_violations,
        "overlap_signal": overlap_signal
    }
