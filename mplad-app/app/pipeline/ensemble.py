import sqlite3
import pandas as pd
import numpy as np
import json
import yaml
from sklearn.ensemble import IsolationForest

def run_ensemble(db_path):
    print("Running Ensemble...")
    con = sqlite3.connect(db_path)
    
    with open("config/detectors.yaml", "r") as f:
        conf = yaml.safe_load(f)
        
    ens_conf = conf.get("ensemble", {})
    contamination = ens_conf.get("contamination", 0.03)
    random_state = ens_conf.get("random_state", 42)
    
    works = pd.read_sql_query("SELECT id, sanctioned_amount, expenditure, sanction_date, completion_date FROM works", con)
    if works.empty:
        con.close()
        return
        
    # detection results
    dr = pd.read_sql_query("SELECT work_id, detector, score, evidence_json FROM detection_results ORDER BY work_id, detector", con)
    
    features = []
    
    for _, w in works.iterrows():
        wid = w['id']
        sanc = w['sanctioned_amount'] if pd.notna(w['sanctioned_amount']) else 0.0
        exp = w['expenditure'] if pd.notna(w['expenditure']) else 0.0
        
        # log_amount
        log_amount = np.log1p(sanc)
        
        # duration_norm
        try:
            s_date = pd.to_datetime(w['sanction_date'])
            c_date = pd.to_datetime(w['completion_date'])
            if pd.notna(s_date) and pd.notna(c_date):
                duration_norm = (c_date - s_date).days
            else:
                duration_norm = np.nan
        except:
            duration_norm = np.nan
            
        # spend_ratio
        spend_ratio = exp / sanc if sanc > 0 else 1.0
        
        # get from detection_results
        w_dr = dr[dr.work_id == wid]
        
        # d2_z
        d2_row = w_dr[w_dr.detector == 'D2']
        d2_z = d2_row.iloc[0]['score'] if not d2_row.empty else 0.0
        
        # agency_district_share (D5)
        d5_row = w_dr[w_dr.detector == 'D5']
        agency_share = d5_row.iloc[0]['score'] if not d5_row.empty else 0.0
        
        # max d1 score
        d1_rows = w_dr[w_dr.detector == 'D1']
        max_d1 = d1_rows['score'].max() if not d1_rows.empty else np.nan
        
        # geo_cluster_size
        d6_ov = w_dr[w_dr.detector == 'D6_overlap']
        if not d6_ov.empty:
            ev = json.loads(d6_ov.iloc[0]['evidence_json'])
            geo_size = len(ev.get('cluster_members', []))
        else:
            geo_size = 1.0
            
        # ghost_distance_km
        d6_row = w_dr[w_dr.detector == 'D6']
        if not d6_row.empty:
            ghost = min(d6_row.iloc[0]['score'], 20.0)
        else:
            ghost = np.nan
            
        features.append({
            "work_id": wid,
            "log_amount": log_amount,
            "d2_z": d2_z,
            "duration_norm": duration_norm,
            "agency_share": agency_share,
            "max_d1": max_d1,
            "geo_cluster": float(geo_size),
            "spend_ratio": spend_ratio,
            "ghost": ghost
        })
        
    f_df = pd.DataFrame(features)
    f_cols = ["log_amount", "d2_z", "duration_norm", "agency_share", "max_d1", "geo_cluster", "spend_ratio", "ghost"]
    
    # Impute missing values with column medians
    f_df[f_cols] = f_df[f_cols].fillna(f_df[f_cols].median())
    
    # If still NaN (e.g. whole column was NaN), fill with 0
    f_df[f_cols] = f_df[f_cols].fillna(0.0)
    
    X = f_df[f_cols].values
    
    # IsolationForest
    iso = IsolationForest(n_estimators=200, contamination=contamination, random_state=random_state)
    iso.fit(X)
    
    # decision_function normalized to [0,1]
    # decision_function returns anomaly score (smaller = more anomalous)
    # We want 1.0 = most anomalous, 0.0 = least anomalous
    # actually decision_function usually returns positive for normal, negative for anomaly.
    dec = iso.decision_function(X)
    
    # Normalize decision_function
    # Let's invert it: lower dec -> higher score
    dec_inv = -dec
    min_d = dec_inv.min()
    max_d = dec_inv.max()
    
    if max_d > min_d:
        scores = (dec_inv - min_d) / (max_d - min_d)
    else:
        scores = np.zeros_like(dec_inv)
        
    detection_rows = []
    for i, row in f_df.iterrows():
        ev = {
            "feature_values": {c: float(row[c]) for c in f_cols}
        }
        detection_rows.append((
            row["work_id"],
            "ENSEMBLE",
            float(scores[i]),
            json.dumps(ev)
        ))
        
    con.executemany("INSERT INTO detection_results (work_id, detector, score, evidence_json) VALUES (?, ?, ?, ?)", detection_rows)
    con.commit()
    con.close()
