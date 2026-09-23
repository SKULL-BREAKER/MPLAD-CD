import sqlite3
import pandas as pd

con = sqlite3.connect('data/app.db')

# Check district_flags HHI for the two P5 districts
print("=== district_flags HHI for P5 districts ===")
df = pd.read_sql_query(
    "SELECT * FROM district_flags WHERE flag='hhi' ORDER BY value DESC",
    con
)
print(df.to_string())

# Check what district P5 works are in
labels = pd.read_sql_query("SELECT work_id, pattern FROM fraud_labels WHERE pattern='P5'", con)
works = pd.read_sql_query("SELECT id, district_id, agency_id FROM works", con)
p5_works = labels.merge(works, left_on='work_id', right_on='id')
print("\n=== P5 districts and agencies ===")
print(p5_works.groupby(['district_id', 'agency_id']).size())

con.close()
