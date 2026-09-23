import sqlite3
import pandas as pd
import json

con = sqlite3.connect('data/app.db')
df5 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
dist_flags = pd.read_sql_query("SELECT district_id, value FROM district_flags WHERE flag='hhi'", con)
works = pd.read_sql_query("SELECT id, district_id FROM works", con)
labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)

dist_hhi = dict(zip(dist_flags['district_id'], dist_flags['value']))
works_dist = dict(zip(works['id'], works['district_id']))

p5_works = set(labels[labels.pattern == 'P5']['work_id'])
innocents = set(labels[labels.label_class == 'innocent']['work_id'])

print("D5 score distribution:")
d5_scores = []
for _, r in df5.iterrows():
    ev = json.loads(r['evidence_json'])
    share = ev.get('share', 0)
    dist_id = works_dist.get(r['work_id'])
    hhi = dist_hhi.get(dist_id, 0.0)
    d5_scores.append({'work_id': r['work_id'], 'share': share, 'hhi': hhi})

print("Share range for P5 works in D5:")
p5_shares = [d['share'] for d in d5_scores if d['work_id'] in p5_works]
non_p5_shares = [d['share'] for d in d5_scores if d['work_id'] not in p5_works]
print(f"  P5: min={min(p5_shares):.4f}, max={max(p5_shares):.4f}, count={len(p5_shares)}")
print(f"  Non-P5: min={min(non_p5_shares):.4f}, max={max(non_p5_shares):.4f}, count={len(non_p5_shares)}")

print()
print("Threshold sweep (share + HHI>=0.13):")
for t in [0.19, 0.20, 0.21, 0.22, 0.25]:
    caught = set(d['work_id'] for d in d5_scores if d['share'] >= t and d['hhi'] >= 0.13)
    tp = len(caught & p5_works)
    fp = len(caught - p5_works)
    prec = tp / len(caught) if caught else 0
    rec = tp / len(p5_works) if p5_works else 0
    print(f"  share>={t}: caught={len(caught)}, TP={tp}, FP={fp}, Prec={prec:.3f}, Rec={rec:.3f}")

con.close()
