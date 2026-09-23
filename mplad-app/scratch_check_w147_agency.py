import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w1.id as id1, w1.agency_id as a1, w2.agency_id as a2, w1.district_id as d1, w2.district_id as d2, w1.village as v1, w2.village as v2
FROM works w1
JOIN works w2 ON w1.title = w2.title AND w1.district_id != w2.district_id
WHERE w1.id = 'W-000147'
"""
df = pd.read_sql_query(query, con)
print(df.to_string())
con.close()
