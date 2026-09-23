import sqlite3
import pandas as pd

def diagnose_d3():
    con = sqlite3.connect("data_tuning/app.db")
    query = """
    SELECT w.status, fl.label_class, 
           CASE 
             WHEN json_extract(dr.evidence_json, '$.not_started_days') IS NOT NULL THEN 'not_started'
             WHEN json_extract(dr.evidence_json, '$.stalled_days') IS NOT NULL THEN 'stalled'
             WHEN json_extract(dr.evidence_json, '$.flash_gap_days') IS NOT NULL THEN 'flash'
           END as condition,
           COUNT(*) as cnt
    FROM works w
    JOIN detection_results dr ON dr.work_id = w.id
    LEFT JOIN fraud_labels fl ON fl.work_id = w.id
    WHERE dr.detector = 'D3'
    GROUP BY w.status, fl.label_class, condition
    ORDER BY w.status, fl.label_class, condition;
    """
    df = pd.read_sql_query(query, con)
    print("D3 Diagnosis:")
    print(df.to_string(index=False))
    con.close()

if __name__ == "__main__":
    diagnose_d3()
