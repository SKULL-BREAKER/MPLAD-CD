import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w1.id, dr.score
FROM works w1
JOIN fraud_labels fl ON fl.work_id = w1.id
JOIN detection_results dr ON dr.work_id = w1.id
WHERE fl.pattern = 'P6' AND dr.detector = 'D1' AND dr.score < 0.92
"""
df = pd.read_sql_query(query, con)
print(df.to_string())
con.close()
