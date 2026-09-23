import sqlite3
import pandas as pd
import json

def tune():
    con = sqlite3.connect("data/app.db")
    df5 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
    df8 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D8'", con)
    
    labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)
    
    p5_works = set(labels[labels.pattern == 'P5']['work_id'])
    p6_works = set(labels[labels.pattern == 'P6']['work_id'])
    innocents = set(labels[labels.label_class == 'innocent']['work_id'])
    
    d5_data = []
    for _, r in df5.iterrows():
        ev = json.loads(r['evidence_json'])
        d5_data.append({'work_id': r['work_id'], 'share': ev.get('share', 0)})
        
    print("Tuning D5 share")
    for t in [0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7]:
        caught_d5 = set(d['work_id'] for d in d5_data if d['share'] >= t)
        tp = len(caught_d5 & p5_works)
        prec = tp / len(caught_d5) if caught_d5 else 0
        rec = tp / len(p5_works) if p5_works else 0
        print(f"D5 share>={t}: caught={len(caught_d5)}, TP={tp}, Prec={prec:.3f}, Rec={rec:.3f}")

    d8_data = []
    for _, r in df8.iterrows():
        ev = json.loads(r['evidence_json'])
        d8_data.append({'work_id': r['work_id'], 'cross': ev.get('cross_districts', 0), 'dup': ev.get('dup_matches', 0)})
        
    print("\nTuning D8 cross")
    for t in [2, 3, 4, 5, 6, 7]:
        caught_d8 = set(d['work_id'] for d in d8_data if d['cross'] >= t)
        tp = len(caught_d8 & p6_works)
        prec = tp / len(caught_d8) if caught_d8 else 0
        rec = tp / len(p6_works) if p6_works else 0
        print(f"D8 cross>={t}: caught={len(caught_d8)}, TP={tp}, Prec={prec:.3f}, Rec={rec:.3f}")
        
    print("\nTuning D8 dup")
    for t in [1, 2, 3]:
        caught_d8 = set(d['work_id'] for d in d8_data if d['dup'] >= t)
        tp = len(caught_d8 & p6_works)
        prec = tp / len(caught_d8) if caught_d8 else 0
        rec = tp / len(p6_works) if p6_works else 0
        print(f"D8 dup>={t}: caught={len(caught_d8)}, TP={tp}, Prec={prec:.3f}, Rec={rec:.3f}")

if __name__ == "__main__":
    tune()
