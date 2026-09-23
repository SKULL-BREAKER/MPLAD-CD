import sqlite3
import pandas as pd
con = sqlite3.connect("data_tuning/app.db")
df = pd.read_sql_query("SELECT * FROM detection_results WHERE work_id='W-002092'", con)
print(df.to_string())
con.close()
