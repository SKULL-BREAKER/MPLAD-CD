import sqlite3
import pandas as pd
import json

def tune():
    con = sqlite3.connect("data/app.db")
    df8 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D8'", con)
    labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)
    
    p6_works = set(labels[labels.pattern == 'P6']['work_id'])
    p5_works = set(labels[labels.pattern == 'P5']['work_id'])
    innocents = set(labels[labels.label_class == 'innocent']['work_id'])
    
    d8_data = []
    for _, r in df8.iterrows():
        ev = json.loads(r['evidence_json'])
        d8_data.append({'work_id': r['work_id'], 'cross': ev.get('cross_districts', 0), 'dup': ev.get('dup_matches', 0)})
        
    print("Tuning D8 cross")
    for t in [2, 3, 4, 5, 6, 7]:
        caught_d8 = set(d['work_id'] for d in d8_data if d['cross'] >= t)
        tp6 = len(caught_d8 & p6_works)
        tp5 = len(caught_d8 & p5_works)
        fp = len(caught_d8 & innocents)
        print(f"D8 cross>={t}: TP6={tp6}, TP5={tp5}, FP={fp}")
        
    print("\nTuning D8 dup")
    for t in [1, 2, 3, 4, 5]:
        caught_d8 = set(d['work_id'] for d in d8_data if d['dup'] >= t)
        tp6 = len(caught_d8 & p6_works)
        tp5 = len(caught_d8 & p5_works)
        fp = len(caught_d8 & innocents)
        print(f"D8 dup>={t}: TP6={tp6}, TP5={tp5}, FP={fp}")
        
    con.close()

if __name__ == "__main__":
    tune()
