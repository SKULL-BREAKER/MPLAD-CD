import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT id, title, description, category, sanctioned_amount, fy
FROM works
WHERE id IN ('W-002372', 'W-002402', 'W-000055', 'W-002121')
"""
df = pd.read_sql_query(query, con)
print(df.to_string())
con.close()
