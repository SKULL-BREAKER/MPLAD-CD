import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w.village, w.category, w.sanctioned_amount, w.id, dr.score, dr.evidence_json, fl.pattern
FROM works w 
JOIN detection_results dr ON dr.work_id=w.id
JOIN fraud_labels fl ON fl.work_id=w.id
WHERE dr.detector='D1' AND dr.score >= 0.92
  AND fl.pattern IN ('P2','P6','P7')
"""
df = pd.read_sql_query(query, con)
print(df.head(10).to_string())
con.close()
