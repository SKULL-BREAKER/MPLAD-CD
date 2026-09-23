import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w.village, w.category, w.sanctioned_amount, w.id, dr.score, dr.evidence_json
FROM works w JOIN detection_results dr ON dr.work_id=w.id
WHERE dr.detector='D1' AND dr.score >= 0.92
  AND w.id NOT IN (SELECT work_id FROM fraud_labels
                   WHERE pattern IN ('P2','P6','P7'))
"""
df = pd.read_sql_query(query, con)
print(f"False Positives: {len(df)}")
if len(df) > 0:
    print(df.head(10).to_string())
con.close()
