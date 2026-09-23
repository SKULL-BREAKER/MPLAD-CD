import sqlite3
import pandas as pd
import json
import yaml

def run_d5(db_path):
    print("Running D5 (Vendor Concentration)...")
    con = sqlite3.connect(db_path)
    
    with open("config/detectors.yaml", "r") as f:
        conf = yaml.safe_load(f)
        
    storage_floor = conf.get("d5", {}).get("storage_floor", 0.10)
    
    # Query works to calculate agency expenditure
    # If expenditure is null, we can treat it as 0. 
    # To be safe, we also filter out records where total district expenditure is 0.
    df = pd.read_sql_query("SELECT id, district_id, agency_id, expenditure FROM works ORDER BY id", con)
    if df.empty:
        con.close()
        return
        
    df['expenditure'] = df['expenditure'].fillna(0.0)
    
    # Total expenditure per district
    dist_exp = df.groupby("district_id")["expenditure"].sum().reset_index()
    dist_exp = dist_exp.rename(columns={"expenditure": "total_dist_exp"})
    
    # Expenditure per (district, agency)
    agency_exp = df.groupby(["district_id", "agency_id"])["expenditure"].sum().reset_index()
    
    # Merge and calculate share
    merged = pd.merge(agency_exp, dist_exp, on="district_id")
    merged["share"] = 0.0
    mask = merged["total_dist_exp"] > 0
    merged.loc[mask, "share"] = merged.loc[mask, "expenditure"] / merged.loc[mask, "total_dist_exp"]
    
    # Calculate HHI per district
    merged["share_sq"] = merged["share"] ** 2
    hhi_df = merged.groupby("district_id")["share_sq"].sum().reset_index()
    
    # Prepare district_flags rows
    district_flags = []
    for _, row in hhi_df.iterrows():
        district_flags.append((
            row["district_id"],
            "hhi",
            float(row["share_sq"]),
            json.dumps({})
        ))
        
    # Store district flags
    con.executemany("INSERT INTO district_flags (district_id, flag, value, evidence_json) VALUES (?, ?, ?, ?)", district_flags)
    
    # Now, calculate per-work detection results
    # We need HHI per district for evidence
    hhi_map = hhi_df.set_index("district_id")["share_sq"].to_dict()
    
    work_merged = pd.merge(df, merged[["district_id", "agency_id", "share"]], on=["district_id", "agency_id"], how="left")
    
    detection_rows = []
    for _, row in work_merged.iterrows():
        share = row["share"]
        if pd.notna(share) and share >= storage_floor:
            hhi = hhi_map.get(row["district_id"], 0.0)
            evidence = {
                "share": float(share),
                "agency_id": row["agency_id"],
                "hhi_district": float(hhi)
            }
            detection_rows.append((
                row["id"],
                "D5",
                float(share),
                json.dumps(evidence)
            ))
            
    con.executemany("INSERT INTO detection_results (work_id, detector, score, evidence_json) VALUES (?, ?, ?, ?)", detection_rows)
    con.commit()
    con.close()
