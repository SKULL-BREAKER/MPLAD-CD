import sqlite3
import pandas as pd
import json

con = sqlite3.connect('data/app.db')
df5 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
d5_data = []
for _, r in df5.iterrows():
    ev = json.loads(r['evidence_json'])
    d5_data.append(ev.get('hhi_district', 0))

print('Max HHI:', max(d5_data), 'Min HHI:', min(d5_data))
con.close()
