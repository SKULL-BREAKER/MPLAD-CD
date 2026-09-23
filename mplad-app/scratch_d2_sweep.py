import sqlite3
import pandas as pd
import json

con = sqlite3.connect('data_tuning/app.db')
d2_df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D2'", con)
labels_df = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)

p3_wids = set(labels_df[labels_df.pattern == 'P3']['work_id'])
p3_total = len(p3_wids)
print(f"P3 total: {p3_total}")

# Sweep threshold
for thr in [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0]:
    caught = set(d2_df[abs(d2_df['score']) >= thr]['work_id'])
    tp = len(caught & p3_wids)
    prec = tp / len(caught) if caught else 0
    rec = tp / p3_total if p3_total else 0
    print(f"thr={thr:.1f}: caught={len(caught)}, TP={tp}, precision={prec:.3f}, recall={rec:.3f}")

con.close()
