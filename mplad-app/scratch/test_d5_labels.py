import sqlite3
import pandas as pd
import json

con = sqlite3.connect('data/app.db')
df5 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)

d5_data = []
for _, r in df5.iterrows():
    ev = json.loads(r['evidence_json'])
    d5_data.append({'work_id': r['work_id'], 'share': ev.get('share', 0)})

caught_works = set(d['work_id'] for d in d5_data if d['share'] >= 0.36)

caught_labels = labels[labels['work_id'].isin(caught_works)]
print(caught_labels.groupby('pattern').size())
print("Innocents:", len(caught_labels[caught_labels.label_class == 'innocent']))

con.close()
