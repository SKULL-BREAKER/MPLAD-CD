import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w.title, w.description, w2.title as t2, w2.description as d2, dr.score, fl.pattern
FROM works w 
JOIN detection_results dr ON dr.work_id=w.id
JOIN works w2 ON w2.id=json_extract(dr.evidence_json, '$.matched_with')
LEFT JOIN fraud_labels fl ON fl.work_id=w.id
WHERE dr.detector='D1' AND dr.score >= 0.92
  AND (fl.pattern IS NULL OR fl.pattern NOT IN ('P2','P6','P7'))
LIMIT 10
"""
df = pd.read_sql_query(query, con)
print(df.to_string())
con.close()
