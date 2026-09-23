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

# Try different HHI thresholds to find the one that cleanly separates P5 districts
print("HHI values per district:")
for _, r in dist_flags.sort_values('value', ascending=False).iterrows():
    print(f"  {r['district_id']}: HHI={r['value']:.4f}")

print()
for hhi_t in [0.12, 0.13, 0.14, 0.145, 0.15]:
    for share_t in [0.30, 0.35]:
        caught = set()
        for _, r in df5.iterrows():
            ev = json.loads(r['evidence_json'])
            share = ev.get('share', 0)
            dist_id = works_dist.get(r['work_id'])
            hhi = dist_hhi.get(dist_id, 0.0)
            if share >= share_t and hhi >= hhi_t:
                caught.add(r['work_id'])
        
        tp = len(caught & p5_works)
        prec = tp / len(caught) if caught else 0
        rec = tp / len(p5_works) if p5_works else 0
        print(f"share>={share_t}, HHI>={hhi_t}: caught={len(caught)}, TP={tp}, Prec={prec:.3f}, Rec={rec:.3f}")

con.close()
