import sqlite3
import pandas as pd
import json

con = sqlite3.connect('data/app.db')
df5 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)
p5_works = set(labels[labels.pattern == 'P5']['work_id'])
d5_data = []
for _, r in df5.iterrows():
    ev = json.loads(r['evidence_json'])
    d5_data.append({'work_id': r['work_id'], 'share': ev.get('share', 0), 'hhi': ev.get('hhi_district', 0)})

caught = set(d['work_id'] for d in d5_data if d['share'] >= 0.3 and d['hhi'] >= 0.25)
tp = len(caught & p5_works)
prec = tp / len(caught) if caught else 0
print(f'caught={len(caught)}, TP={tp}, Prec={prec:.3f}')
con.close()
