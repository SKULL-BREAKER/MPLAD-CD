import sqlite3
import pandas as pd
import json

con = sqlite3.connect("data_tuning/app.db")
query = """
SELECT w.village, w.category, w.sanctioned_amount, w.id, dr.score, dr.evidence_json, fl.pattern
FROM works w 
JOIN detection_results dr ON dr.work_id=w.id
LEFT JOIN fraud_labels fl ON fl.work_id=w.id
WHERE dr.detector='D1' AND dr.score >= 0.92
"""
df = pd.read_sql_query(query, con)

def apply_corroboration(row):
    ev = json.loads(row['evidence_json'])
    amount_delta = ev.get('amount_delta', 1.0)
    same_agency = ev.get('same_agency', False)
    s = ev.get('similarity', 0)
    
    # original guard: if v_diff and dist > 5 and not same_agency and s < 0.99: min(s, 0.69)
    # wait, this is already applied to row['score']. 
    # The FPs have score >= 0.92.
    
    # We add corroboration:
    if s >= 0.99 and not same_agency and amount_delta > 0.30:
        return False # rejected
    return True

df['kept'] = df.apply(apply_corroboration, axis=1)

fp = df[(df.pattern.isna() | ~df.pattern.isin(['P2','P6','P7']))]
tp = df[df.pattern.isin(['P2','P6','P7'])]

print("Before Corroboration:")
print(f"TP: {len(tp)}")
print(f"FP: {len(fp)}")

fp_kept = fp[fp.kept]
tp_kept = tp[tp.kept]

print("\nAfter Corroboration:")
print(f"TP: {len(tp_kept)}")
print(f"FP: {len(fp_kept)}")

print("\nMissed TPs:")
print(tp[~tp.kept].head())
