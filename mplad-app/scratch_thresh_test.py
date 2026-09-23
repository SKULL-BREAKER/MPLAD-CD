import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w.id, dr.score, fl.pattern
FROM works w 
JOIN detection_results dr ON dr.work_id=w.id
LEFT JOIN fraud_labels fl ON fl.work_id=w.id
WHERE dr.detector='D1' AND dr.score >= 0.90
"""
df = pd.read_sql_query(query, con)
for t in [0.92, 0.93, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99]:
    caught = df[df.score >= t]
    tp = len(caught[caught.pattern.isin(['P2','P6','P7'])])
    fp = len(caught[~caught.pattern.isin(['P2','P6','P7'])])
    prec = tp/(tp+fp) if (tp+fp)>0 else 0
    print(f"Thresh {t:.2f} -> TP: {tp}, FP: {fp}, Precision: {prec:.3f}")
con.close()
