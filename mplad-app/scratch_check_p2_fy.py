import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT json_extract(dr.evidence_json, '$.fy_delta') as fy_delta
FROM works w1 
JOIN detection_results dr ON dr.work_id=w1.id
JOIN fraud_labels fl ON fl.work_id=w1.id
WHERE dr.detector='D1' AND fl.pattern='P2'
"""
df = pd.read_sql_query(query, con)
print(df['fy_delta'].value_counts())
con.close()
