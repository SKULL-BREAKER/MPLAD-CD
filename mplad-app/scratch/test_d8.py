import sqlite3
import pandas as pd
import json

def check():
    con = sqlite3.connect("data/app.db")
    df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D8'", con)
    innocents = set(pd.read_sql_query("SELECT work_id FROM fraud_labels WHERE label_class='innocent'", con)['work_id'])
    
    inn_cross = []
    anom_cross = []
    for _, r in df.iterrows():
        ev = json.loads(r['evidence_json'])
        cd = ev.get('cross_districts', 0)
        dm = ev.get('dup_matches', 0)
        
        if r['work_id'] in innocents:
            inn_cross.append(cd)
        else:
            anom_cross.append(cd)
            
    print("Innocent max cross:", max(inn_cross) if inn_cross else 0)
    print("Anomaly min cross (where >0):", min([x for x in anom_cross if x > 0]) if anom_cross else 0)
    print("Anomaly max cross:", max(anom_cross) if anom_cross else 0)
    con.close()

if __name__ == "__main__":
    check()
