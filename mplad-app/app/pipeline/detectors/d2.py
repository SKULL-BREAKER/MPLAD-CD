import sqlite3
import pandas as pd
import numpy as np
import json
import math
from scipy.stats import chisquare

def run_d2(db_path):
    con = sqlite3.connect(db_path)
    works_df = pd.read_sql_query("SELECT * FROM works ORDER BY id", con)
    
    import yaml
    try:
        with open("config/operating_points.yaml", "r") as f:
            op_pts = yaml.safe_load(f)
            min_group = op_pts['presets'][op_pts['active']]['thresholds'].get('d2_min_group', 5)
    except Exception:
        min_group = 5

    if len(works_df) == 0:
        con.close()
        return {"z_rows": 0, "benford_districts": 0}

    cursor = con.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS detection_results (
        work_id TEXT,
        detector TEXT,
        score REAL,
        evidence_json TEXT
    )''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS district_flags (
        district_id TEXT,
        flag TEXT,
        value REAL,
        evidence_json TEXT
    )''')
    
    # Cost (per-unit outliers)
    cost_df = works_df[works_df['physical_qty'] > 0].copy()
    cost_df['per_unit'] = cost_df['sanctioned_amount'] / cost_df['physical_qty']
    
    results = []
    
    for (cat, fy), group in cost_df.groupby(['category', 'fy']):
        n_group = len(group)
        if n_group < min_group: continue
        
        median = group['per_unit'].median()
        mad = np.median(np.abs(group['per_unit'] - median))
        
        for _, w in group.iterrows():
            pu = w['per_unit']
            z = 0.0
            if mad > 0:
                z = 0.6745 * (pu - median) / mad
            
            if z >= 1.0:
                results.append({
                    "work_id": w['id'],
                    "detector": "D2",
                    "score": float(z),
                    "evidence_json": json.dumps({
                        "category": cat,
                        "fy": fy,
                        "perunit": float(pu),
                        "median": float(median),
                        "mad": float(mad),
                        "z": float(z),
                        "n_group": n_group
                    })
                })
                
    # Benford
    expected_freqs = [math.log10(1 + 1/d) for d in range(1, 10)]
    
    benford_results = []
    for d_id, group in works_df.groupby("district_id"):
        amounts = group['sanctioned_amount'].values
        first_digits = []
        for amt in amounts:
            if amt <= 0: continue
            s = str(amt).lstrip('0.')
            if not s: continue
            first_digits.append(int(s[0]))
            
        n = len(first_digits)
        if n < 10: continue
        
        digit_counts = [first_digits.count(d) for d in range(1, 10)]
        expected_counts = [n * p for p in expected_freqs]
        
        chi2, p = chisquare(digit_counts, expected_counts)
        
        benford_results.append({
            "district_id": d_id,
            "flag": "benford_chi2",
            "value": float(chi2),
            "evidence_json": json.dumps({
                "chi2": float(chi2),
                "p": float(p),
                "n": n,
                "digit_counts": digit_counts
            })
        })
        
    seen = set()
    for r in results:
        if r['work_id'] in seen:
            print(f"D2 Duplicate detected! work_id: {r['work_id']}")
        seen.add(r['work_id'])
        print(f"D2 inserting: {r['work_id']}")
        try:
            cursor.execute('''INSERT OR REPLACE INTO detection_results (work_id, detector, score, evidence_json)
                              VALUES (?, ?, ?, ?)''', (r['work_id'], r['detector'], r['score'], r['evidence_json']))
        except sqlite3.IntegrityError as e:
            import sys
            print(f"FAILED TO INSERT D2 FOR {r['work_id']}: {e}", file=sys.stderr, flush=True)
            existing = con.execute("SELECT * FROM detection_results WHERE work_id=? AND detector=?", (r['work_id'], r['detector'])).fetchall()
            print(f"EXISTING ROWS IN DB: {existing}", file=sys.stderr, flush=True)
            print(f"Current results list len: {len(results)}, seen so far: {len(seen)}", file=sys.stderr, flush=True)
            raise e
                          
    for r in benford_results:
        cursor.execute('''INSERT INTO district_flags (district_id, flag, value, evidence_json)
                          VALUES (?, ?, ?, ?)''', (r['district_id'], r['flag'], r['value'], r['evidence_json']))

    con.commit()
    con.close()
    return {"z_rows": len(results), "benford_districts": len(benford_results)}

if __name__ == "__main__":
    run_d2("data/app.db")
