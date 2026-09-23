import sqlite3
import pandas as pd
import json
import yaml

con = sqlite3.connect('data_tuning/app.db')

with open("config/operating_points.yaml", "r") as f:
    op_pts = yaml.safe_load(f)
thresholds = op_pts['presets']['balanced']['thresholds']

det_df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D3'", con)
labels_df = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)
works_df = pd.read_sql_query("SELECT id, status, sanctioned_amount FROM works", con)

# P9 = flash pattern. Check which P9 works are caught vs missed
p9_wids = set(labels_df[labels_df.pattern == 'P9']['work_id'])
print(f"P9 total: {len(p9_wids)}")

caught = set()
missed = []
thr_flash = thresholds.get('d3_flash_days', 14)
thr_spend = thresholds.get('d3_flash_spend', 0.95)
thr_amt = thresholds.get('d3_flash_amount', 500000)

for wid in p9_wids:
    row = det_df[det_df.work_id == wid]
    if row.empty:
        missed.append((wid, 'NO_D3_ROW', None, None, None))
        continue
    r = row.iloc[0]
    ev = json.loads(r['evidence_json'] or '{}')
    flash_gap = ev.get('flash_gap_days')
    spend_ratio = ev.get('spend_ratio', 0)
    amount = ev.get('amount', 0)
    
    if flash_gap is not None and flash_gap <= thr_flash and spend_ratio >= thr_spend and amount >= thr_amt:
        caught.add(wid)
    else:
        reason = []
        if flash_gap is None: reason.append('flash_gap=None')
        elif flash_gap > thr_flash: reason.append(f'flash_gap={flash_gap}>{thr_flash}')
        if spend_ratio < thr_spend: reason.append(f'spend_ratio={spend_ratio:.2f}<{thr_spend}')
        if amount < thr_amt: reason.append(f'amount={amount:.0f}<{thr_amt}')
        missed.append((wid, ', '.join(reason), flash_gap, spend_ratio, amount))

print(f"P9 caught: {len(caught)}, missed: {len(missed)}")
print("\nMissed P9 breakdown:")
for wid, reason, fg, sr, amt in missed[:20]:
    print(f"  {wid}: {reason}")

# P4 missed (not_started)
p4_wids = set(labels_df[labels_df.pattern == 'P4']['work_id'])
print(f"\nP4 total: {len(p4_wids)}")
p4_caught = set()
p4_missed = []
thr_ns = thresholds.get('d3_not_started_days', 365)

for wid in p4_wids:
    row = det_df[det_df.work_id == wid]
    if row.empty:
        p4_missed.append((wid, 'NO_D3_ROW'))
        continue
    r = row.iloc[0]
    ev = json.loads(r['evidence_json'] or '{}')
    not_started = ev.get('not_started_days')
    if not_started is not None and not_started > thr_ns:
        p4_caught.add(wid)
    else:
        p4_missed.append((wid, f'not_started={not_started}'))

print(f"P4 caught: {len(p4_caught)}, missed: {len(p4_missed)}")
print("Missed P4 (first 10):")
for wid, r in p4_missed[:10]:
    # check work status
    w = works_df[works_df.id == wid]
    if not w.empty:
        print(f"  {wid}: {r} | status={w.iloc[0]['status']}")
    else:
        print(f"  {wid}: {r}")

# D2/P3 precision diagnosis
print(f"\nD2 P3 precision analysis:")
d2_df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D2'", con)
d2_z = thresholds.get('d2_z', 3.0)
d2_caught_wids = set(d2_df[abs(d2_df['score']) >= d2_z]['work_id'])
p3_wids = set(labels_df[labels_df.pattern == 'P3']['work_id'])
tp = d2_caught_wids & p3_wids
fp_set = d2_caught_wids - p3_wids
inn_set = set(labels_df[labels_df.label_class == 'innocent']['work_id'])
fp_innocent = d2_caught_wids & inn_set
print(f"D2 caught (|z|>={d2_z}): {len(d2_caught_wids)}")
print(f"True positives (P3): {len(tp)}")
print(f"False positives (non-P3): {len(fp_set)}")
print(f"FP that are innocent: {len(fp_innocent)}")

# breakdown of FP by their labels
fp_labels = labels_df[labels_df.work_id.isin(fp_set)]
print("FP breakdown by label:")
print(fp_labels.groupby(['pattern','label_class']).size())

# unlabeled FP
unlabeled_fp = fp_set - set(labels_df['work_id'])
print(f"Unlabeled FP: {len(unlabeled_fp)}")

# Check n_group distribution of caught P3 vs not
print(f"\nGroup size distribution of D2 rows with |z|>={d2_z}:")
d2_caught_df = d2_df[abs(d2_df['score']) >= d2_z].copy()
d2_caught_df['n_group'] = d2_caught_df['evidence_json'].apply(lambda x: json.loads(x).get('n_group', 0))
print(d2_caught_df['n_group'].describe())

con.close()
