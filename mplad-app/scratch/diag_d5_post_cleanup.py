import sqlite3
import pandas as pd
import json

con = sqlite3.connect('data/app.db')

# Check D5 detection results
df5 = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
print("D5 total rows:", len(df5))

labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels WHERE pattern='P5'", con)
p5_works = set(labels['work_id'])
print("P5 labeled works:", len(p5_works))

if len(df5) > 0:
    print("D5 caught P5:", len(set(df5['work_id']) & p5_works))
    print("D5 scores:", df5['score'].describe())

# Check agency distribution in P5 districts post-cleanup
works = pd.read_sql_query("SELECT id, district_id, agency_id, expenditure FROM works", con)
for dist in ['DIST-004', 'DIST-009']:
    dw = works[works.district_id == dist].copy()
    dw['exp'] = dw['expenditure'].fillna(0)
    total_exp = dw['exp'].sum()
    ag = dw.groupby('agency_id')['exp'].sum().reset_index()
    ag['share'] = ag['exp'] / total_exp
    ag['is_p5'] = ag['agency_id'].apply(lambda x: len(set(dw[dw.agency_id==x]['id']) & p5_works))
    print(f"\n{dist} top agencies:")
    print(ag.sort_values('share', ascending=False).head(5).to_string())

con.close()
