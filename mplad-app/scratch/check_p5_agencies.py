import sqlite3
import pandas as pd

con = sqlite3.connect('data/app.db')
works = pd.read_sql_query("SELECT id, district_id, agency_id, expenditure FROM works", con)
labels = pd.read_sql_query("SELECT work_id, pattern, label_class FROM fraud_labels", con)

p5_works = set(labels[labels.pattern == 'P5']['work_id'])

for dist in ['DIST-004', 'DIST-009']:
    dw = works[works.district_id == dist].copy()
    dw['exp'] = dw['expenditure'].fillna(0)
    total_exp = dw['exp'].sum()
    
    agency_exp = dw.groupby('agency_id')['exp'].sum().reset_index()
    agency_exp['share'] = agency_exp['exp'] / total_exp
    agency_exp = agency_exp.sort_values('share', ascending=False)
    
    agency_exp['is_p5_works'] = agency_exp['agency_id'].apply(
        lambda ag: len(set(dw[dw.agency_id == ag]['id']) & p5_works)
    )
    
    print(f"\n=== {dist} (total_exp={total_exp:.0f}) ===")
    print(agency_exp.head(5).to_string())

con.close()
