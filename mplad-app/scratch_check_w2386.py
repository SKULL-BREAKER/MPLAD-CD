import sqlite3, pandas as pd; con=sqlite3.connect('data_tuning/app.db'); works = pd.read_sql("SELECT * FROM works WHERE id='W-002386'", con); print(works.T)
