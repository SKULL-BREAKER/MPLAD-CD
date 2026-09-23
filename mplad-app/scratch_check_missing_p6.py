import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w1.id as id1, w1.village as v1, w2.village as v2, w1.title as t1
FROM works w1
JOIN fraud_labels fl ON fl.work_id = w1.id
JOIN works w2 ON w1.title = w2.title AND w1.district_id != w2.district_id
WHERE fl.pattern = 'P6' AND w1.id NOT IN (SELECT work_id FROM detection_results WHERE detector='D1')
"""
df = pd.read_sql_query(query, con)
print(f"Missing works: {df['id1'].nunique()}")
print(df.head(20).to_string())
con.close()
