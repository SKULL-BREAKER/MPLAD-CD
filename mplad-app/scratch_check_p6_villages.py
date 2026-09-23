import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w1.village as v1, w2.village as v2, w1.title as t1, w2.title as t2
FROM works w1 
JOIN fraud_labels fl ON fl.work_id=w1.id
JOIN detection_results dr ON dr.work_id=w1.id
JOIN works w2 ON w2.id=json_extract(dr.evidence_json, '$.matched_with')
WHERE dr.detector='D1' AND fl.pattern='P6'
LIMIT 10
"""
df = pd.read_sql_query(query, con)
print(df.to_string())
con.close()
