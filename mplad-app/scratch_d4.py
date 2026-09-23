import sqlite3, pandas as pd
con = sqlite3.connect('data_tuning/app.db')
print(pd.read_sql("SELECT COUNT(*) FROM works WHERE district_id='DIST-009' AND agency_id='AG-008'", con))
