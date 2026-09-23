import sqlite3
import pandas as pd
import yaml
import json

con = sqlite3.connect('data_tuning/app.db')
with open("config/eval_map.yaml", "r") as f:
    eval_map = yaml.safe_load(f)

with open("config/operating_points.yaml", "r") as f:
    op_pts = yaml.safe_load(f)
    
thresholds = op_pts['presets']['balanced']['thresholds']

pattern_to_detectors = {}
for d, pats in eval_map.items():
    for pat in pats:
        pattern_to_detectors.setdefault(pat, []).append(d)
        
det_df = pd.read_sql_query("SELECT * FROM detection_results", con)

def is_caught(work_id, pattern):
    detectors = pattern_to_detectors.get(pattern, [])
    if not detectors:
        return False
        
    rows = det_df[det_df.work_id == work_id]
    for _, dr in rows.iterrows():
        d_name = dr['detector']
        if d_name not in detectors and not (d_name == 'D1_split' and 'D1' in detectors):
            continue
            
        score = dr['score']
        ev = json.loads(dr['evidence_json'] or '{}')
        
        if d_name == 'D1':
            if score is not None and score >= thresholds.get('d1_primary', 0.92): return True
        elif d_name == 'D1_split':
            if score is not None and score >= 1.0: return True
            
    return False

family_caught_works = {'D1': set()}
for _, dr in det_df.iterrows():
    d_name = dr['detector']
    work_id = dr['work_id']
    score = dr['score']
    
    if d_name == 'D1':
        if score is not None and score >= thresholds.get('d1_primary', 0.92):
            family_caught_works['D1'].add(work_id)
    elif d_name == 'D1_split':
        if score is not None and score >= 1.0:
            family_caught_works['D1'].add(work_id)

works_caught_by_is_caught = set()
for p in eval_map['D1']:
    l_p = pd.read_sql_query(f"SELECT work_id FROM fraud_labels WHERE pattern = '{p}'", con)
    for wid in l_p['work_id']:
        if is_caught(wid, p):
            works_caught_by_is_caught.add(wid)

print("family_caught_works['D1']:", len(family_caught_works['D1']))
print("works_caught_by_is_caught (True Positives):", len(works_caught_by_is_caught))

# Check unlabeled works caught by D1
all_works = pd.read_sql_query("SELECT id FROM works", con)
all_caught = set()
for wid in all_works['id']:
    if is_caught(wid, 'P2') or is_caught(wid, 'P6') or is_caught(wid, 'P7'):
        all_caught.add(wid)

print("all works caught by is_caught for D1 patterns:", len(all_caught))
con.close()
