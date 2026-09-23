import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
df = pd.read_sql_query("SELECT detector, COUNT(*) FROM detection_results GROUP BY detector;", con)
print(df.to_string(index=False))
con.close()
