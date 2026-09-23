import sqlite3
import pandas as pd
import json

def check():
    con = sqlite3.connect("data/app.db")
    df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
    labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)
    
    p5_works = set(labels[labels.pattern == 'P5']['work_id'])
    
    shares = []
    for _, r in df.iterrows():
        if r['work_id'] in p5_works:
            ev = json.loads(r['evidence_json'])
            shares.append(ev.get('share', 0))
            
    print("P5 max share:", max(shares) if shares else 0)
    print("P5 min share:", min(shares) if shares else 0)
    con.close()

if __name__ == "__main__":
    check()
