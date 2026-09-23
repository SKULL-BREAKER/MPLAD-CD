import sqlite3
import pandas as pd
import json

con = sqlite3.connect('data/app.db')
df5 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
dist_flags = pd.read_sql_query("SELECT district_id, value FROM district_flags WHERE flag='hhi'", con)
works = pd.read_sql_query("SELECT id, district_id, agency_id FROM works", con)
labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)

dist_hhi = dict(zip(dist_flags['district_id'], dist_flags['value']))
works_map = dict(zip(works['id'], zip(works['district_id'], works['agency_id'])))

p5_works = set(labels[labels.pattern == 'P5']['work_id'])

# In P5 districts (DIST-004, DIST-009), what is the FP composition?
p5_dists = ['DIST-004', 'DIST-009']
caught_in_p5_dists = [r for _, r in df5.iterrows() 
                       if works_map.get(r['work_id'], ('',))[0] in p5_dists]
print("In P5 districts: caught", len(caught_in_p5_dists), "works")

# Non-P5 works in P5 districts
non_p5_in_p5_dists = [r['work_id'] for r in caught_in_p5_dists 
                       if r['work_id'] not in p5_works]
print("  Non-P5 caught:", len(non_p5_in_p5_dists))

fps = labels[labels.work_id.isin(non_p5_in_p5_dists)]
print(fps.groupby(['pattern', 'label_class']).size())

# These are the works in P5 districts that have HIGH share but are NOT P5
# Try agency-level filtering: P5 used tgt=pool[0] = the first agency in district pool
# What agency do the FPs use?
fp_agencies = works[works.id.isin(non_p5_in_p5_dists)]['agency_id'].value_counts()
print("\nFP agencies in P5 districts:")
print(fp_agencies)

p5_agency_dist4 = list(set(works[(works.id.isin(p5_works)) & 
                                   (works.district_id == 'DIST-004')]['agency_id']))
p5_agency_dist9 = list(set(works[(works.id.isin(p5_works)) & 
                                   (works.district_id == 'DIST-009')]['agency_id']))
print("\nP5 agencies DIST-004:", p5_agency_dist4)
print("P5 agencies DIST-009:", p5_agency_dist9)
con.close()
