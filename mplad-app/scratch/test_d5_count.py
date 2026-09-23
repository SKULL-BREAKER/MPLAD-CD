import sqlite3
import pandas as pd
con = sqlite3.connect('data/app.db')
df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
print(len(df[df.score >= 0.3]))
con.close()
