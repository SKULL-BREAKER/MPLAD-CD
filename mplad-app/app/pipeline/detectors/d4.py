import sqlite3
import pandas as pd
import json
import yaml

def run_d4(db_path):
    print("Running D4 (Utilization)...")
    con = sqlite3.connect(db_path)
    
    with open("config/operating_points.yaml", "r") as f:
        op_pts = yaml.safe_load(f)
    rush_month = op_pts['presets'][op_pts['active']]['thresholds'].get('d4_rush_month', 3)
    rush_spend_max = op_pts['presets'][op_pts['active']]['thresholds'].get('d4_rush_spend_max', 0.10)
    
    # Calculate district utilization from fund_flows
    ff_df = pd.read_sql_query("SELECT district_id, fy, entitlement, expenditure FROM fund_flows", con)
    if not ff_df.empty:
        # Aggregate by district
        dist_agg = ff_df.groupby("district_id").agg(
            total_entitlement=("entitlement", "sum"),
            total_expenditure=("expenditure", "sum")
        ).reset_index()
        
        utilization_flags = []
        for _, row in dist_agg.iterrows():
            entitlement = row["total_entitlement"]
            expenditure = row["total_expenditure"]
            
            # calculate utilization ratio
            if entitlement > 0:
                utilization = expenditure / entitlement
            else:
                utilization = 0.0
                
            # fetch fy breakdown for evidence
            breakdown = ff_df[ff_df.district_id == row["district_id"]][["fy", "entitlement", "expenditure"]].to_dict(orient="records")
            
            evidence = {
                "spent": float(expenditure),
                "entitlement": float(entitlement),
                "fy_breakdown": breakdown
            }
            
            utilization_flags.append((
                row["district_id"],
                "utilization",
                float(utilization),
                json.dumps(evidence)
            ))
            
        con.executemany(
            "INSERT INTO district_flags (district_id, flag, value, evidence_json) VALUES (?, ?, ?, ?)",
            utilization_flags
        )
        
    # Calculate yearend_rush per (district, fy)
    works_df = pd.read_sql_query("SELECT id as work_id, district_id, fy, sanction_date, sanctioned_amount, expenditure FROM works ORDER BY id", con)
    if not works_df.empty:
        # Convert sanction_date to datetime
        works_df["sanction_date"] = pd.to_datetime(works_df["sanction_date"], errors='coerce')
        
        # A sanction is in the last 30 days of the FY if its month is 3 (March).
        works_df["is_march"] = works_df["sanction_date"].dt.month == 3
        
        rush_flags = []
        d4_inserts = []
        
        for (dist, fy), group in works_df.groupby(["district_id", "fy"]):
            if len(group) == 0: continue
            
            march_works = group[group["is_march"] == True]
            fraction = len(march_works) / len(group)
            
            # The rule states: "More than 50% of works sanctioned in the last 30 days of FY" -> D4 flag
            if fraction >= 0.50:
                evidence = {
                    "total_works": len(group),
                    "march_works": len(march_works),
                    "fraction": float(fraction)
                }
                
                rush_flags.append((
                    dist,
                    "yearend_rush",
                    float(fraction),
                    json.dumps(evidence)
                ))
                
            if fraction >= 0.50:
                for _, w in group.iterrows():
                    if pd.isna(w["sanction_date"]): continue
                    is_late = w["sanction_date"].month == rush_month
                    s_amt = w["sanctioned_amount"] or 0
                    exp = w["expenditure"] or 0
                    is_suppressed = (s_amt > 0) and (exp / s_amt <= rush_spend_max)
                    
                    if is_late and is_suppressed:
                        # Add to d4_inserts
                        d4_inserts.append((
                            w["work_id"], "D4", float(fraction),
                            json.dumps({
                                "district_rush_fraction": float(fraction),
                                "sanction_date": w["sanction_date"].isoformat(),
                                "sanctioned_amount": float(s_amt),
                                "expenditure": float(exp)
                            })
                        ))
        
        con.executemany(
            "INSERT INTO district_flags (district_id, flag, value, evidence_json) VALUES (?, ?, ?, ?)",
            rush_flags
        )
        con.executemany(
            "INSERT INTO detection_results (work_id, detector, score, evidence_json) VALUES (?, ?, ?, ?)",
            d4_inserts
        )
        
    con.commit()
    con.close()
