import sqlite3
import pandas as pd
import json

con = sqlite3.connect('data/app.db')
df5 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)
dist_flags = pd.read_sql_query("SELECT district_id, value FROM district_flags WHERE flag='hhi'", con)
works = pd.read_sql_query("SELECT id, district_id FROM works", con)

dist_hhi = dict(zip(dist_flags['district_id'], dist_flags['value']))
works_dist = dict(zip(works['id'], works['district_id']))

p5_works = set(labels[labels.pattern == 'P5']['work_id'])
innocents = set(labels[labels.label_class == 'innocent']['work_id'])

D5_SHARE = 0.30
D5_HHI = 0.13

caught = set()
for _, r in df5.iterrows():
    ev = json.loads(r['evidence_json'])
    share = ev.get('share', 0)
    dist_id = works_dist.get(r['work_id'])
    hhi = dist_hhi.get(dist_id, 0.0)
    if share >= D5_SHARE and hhi >= D5_HHI:
        caught.add(r['work_id'])

tp = len(caught & p5_works)
fp_inn = len(caught & innocents)
prec = tp / len(caught) if caught else 0
rec = tp / len(p5_works) if p5_works else 0
print(f"D5 with HHI gate:")
print(f"  caught={len(caught)}, TP={tp}, FP(innocent)={fp_inn}")
print(f"  Precision={prec:.3f}, Recall={rec:.3f}")
print(f"  Gate: Prec>=0.80 = {prec >= 0.80}, Recall>=0.80 = {rec >= 0.80}")
con.close()
