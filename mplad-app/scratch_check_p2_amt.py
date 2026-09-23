import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT min(dr.score), max(dr.score)
FROM works w1 
JOIN detection_results dr ON dr.work_id=w1.id
JOIN fraud_labels fl ON fl.work_id=w1.id
WHERE dr.detector='D1' AND fl.pattern='P2'
"""
df = pd.read_sql_query(query, con)
print("P2 Scores:", df.to_string())

query = """
SELECT json_extract(dr.evidence_json, '$.amount_delta') as amt_delta
FROM works w1 
JOIN detection_results dr ON dr.work_id=w1.id
JOIN fraud_labels fl ON fl.work_id=w1.id
WHERE dr.detector='D1' AND fl.pattern='P2'
"""
df = pd.read_sql_query(query, con)
print("P2 amt_delta min:", df['amt_delta'].min())
print("P2 amt_delta max:", df['amt_delta'].max())
print("P2 amt_delta == 0.0:", (df['amt_delta'] == 0.0).sum())
con.close()
