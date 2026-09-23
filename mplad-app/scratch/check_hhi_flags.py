import sqlite3
import pandas as pd

con = sqlite3.connect('data/app.db')
df = pd.read_sql_query("SELECT * FROM district_flags WHERE flag='hhi' ORDER BY value DESC", con)
print("district_flags HHI:")
print(df.to_string())
con.close()
