import sqlite3
import pandas as pd
import json

def tune():
    con = sqlite3.connect('data/app.db')
    df5 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
    d5_data = []
    for _, r in df5.iterrows():
        ev = json.loads(r['evidence_json'])
        d5_data.append(ev.get('share', 0))
    print('Max:', max(d5_data), 'Min:', min(d5_data))
    con.close()
tune()
