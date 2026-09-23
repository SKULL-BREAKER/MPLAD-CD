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

# All works - not just those caught by D5
# Check which work_ids fall in P5 districts (DIST-004, DIST-009)
p5_districts = set(['DIST-004', 'DIST-009'])
works_in_p5_dist = set(w for w, d in works_dist.items() if d in p5_districts)
d5_caught_works = set(df5['work_id'])

print("Works in P5 districts:", len(works_in_p5_dist))
print("D5 detected in P5 districts:", len(d5_caught_works & works_in_p5_dist))
print("P5 label count:", len(p5_works))
print("P5 labels in P5 districts:", len(p5_works & works_in_p5_dist))
print("Non-P5 in P5 districts (D5 caught):", len((d5_caught_works & works_in_p5_dist) - p5_works))

# The works caught by D5 that are NOT in P5 districts - these are the problem
non_p5_dist = d5_caught_works - works_in_p5_dist
print("\nD5 catches outside P5 districts:", len(non_p5_dist))
ext_labels = labels[labels.work_id.isin(non_p5_dist)]
print(ext_labels.groupby(['pattern', 'label_class']).size())

con.close()
