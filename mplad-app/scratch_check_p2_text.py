import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w1.title as t1, w1.description as d1, w2.title as t2, w2.description as d2, dr.score, w1.id, w2.id as id2
FROM works w1 
JOIN detection_results dr ON dr.work_id=w1.id
JOIN works w2 ON w2.id=json_extract(dr.evidence_json, '$.matched_with')
JOIN fraud_labels fl ON fl.work_id=w1.id
WHERE dr.detector='D1' AND fl.pattern='P2' AND dr.score < 0.95
LIMIT 5
"""
df = pd.read_sql_query(query, con)
print(df.to_string())
con.close()
