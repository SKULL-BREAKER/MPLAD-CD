import sqlite3
import pandas as pd
import json

def tune():
    con = sqlite3.connect("data/app.db")
    df5 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
    labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)
    p5_works = set(labels[labels.pattern == 'P5']['work_id'])
    d5_data = []
    for _, r in df5.iterrows():
        ev = json.loads(r['evidence_json'])
        d5_data.append({'work_id': r['work_id'], 'share': ev.get('share', 0)})
    for t in [0.3, 0.32, 0.34, 0.35, 0.36, 0.365]:
        caught_d5 = set(d['work_id'] for d in d5_data if d['share'] >= t)
        tp = len(caught_d5 & p5_works)
        prec = tp / len(caught_d5) if caught_d5 else 0
        rec = tp / len(p5_works) if p5_works else 0
        print(f"t={t:.3f}: caught={len(caught_d5)}, TP={tp}, Prec={prec:.3f}, Rec={rec:.3f}")
    con.close()

if __name__ == "__main__":
    tune()
