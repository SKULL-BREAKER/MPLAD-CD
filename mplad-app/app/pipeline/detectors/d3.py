import sqlite3
import pandas as pd
import json
import datetime

def run_d3(db_path, ref_today="2024-06-30"):
    con = sqlite3.connect(db_path)
    works_df = pd.read_sql_query("SELECT * FROM works ORDER BY id", con)
    
    if len(works_df) == 0:
        con.close()
        return {"rows": 0}

    cursor = con.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS detection_results (
        work_id TEXT,
        detector TEXT,
        score REAL,
        evidence_json TEXT
    )''')
    
    ref_date = pd.to_datetime(ref_today)
    
    results = []
    
    for _, w in works_df.iterrows():
        status = w['status']
        sanction = pd.to_datetime(w['sanction_date']) if pd.notnull(w['sanction_date']) else None
        start = pd.to_datetime(w['start_date']) if pd.notnull(w['start_date']) else None
        comp = pd.to_datetime(w['completion_date']) if pd.notnull(w['completion_date']) else None
        
        stalled_days = None
        not_started_days = None
        flash_gap_days = None
        start_gap_days = None
        
        if sanction:
            if status == 'in_progress':
                stalled_days = (ref_date - sanction).days
            elif status == 'sanctioned':
                not_started_days = (ref_date - sanction).days
            elif status == 'completed' and comp:
                flash_gap_days = (comp - sanction).days
                
            if start:
                start_gap_days = (start - sanction).days
                
        spend_ratio = w['expenditure'] / w['sanctioned_amount'] if w['sanctioned_amount'] > 0 else 0
        
        evidence = {
            "stalled_days": stalled_days,
            "not_started_days": not_started_days,
            "flash_gap_days": flash_gap_days,
            "start_gap_days": start_gap_days,
            "spend_ratio": float(spend_ratio),
            "amount": float(w['sanctioned_amount'])
        }
        
        results.append({
            "work_id": w['id'],
            "detector": "D3",
            "score": float(flash_gap_days) if flash_gap_days is not None else None,
            "evidence_json": json.dumps(evidence)
        })
        
    for r in results:
        cursor.execute('''INSERT INTO detection_results (work_id, detector, score, evidence_json)
                          VALUES (?, ?, ?, ?)''', (r['work_id'], r['detector'], r['score'], r['evidence_json']))

    con.commit()
    con.close()
    return {"rows": len(results)}

if __name__ == "__main__":
    run_d3("data/app.db")
