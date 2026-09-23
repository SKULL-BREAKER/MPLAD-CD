import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w1.title as t1
FROM works w1 
JOIN fraud_labels fl ON fl.work_id=w1.id
WHERE fl.pattern='P2'
LIMIT 10
"""
df = pd.read_sql_query(query, con)
print(df.to_string())
con.close()
