import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT village, COUNT(DISTINCT district_id) as num_dists
FROM works
GROUP BY village
HAVING num_dists > 1
"""
df = pd.read_sql_query(query, con)
print(df.to_string())
con.close()
