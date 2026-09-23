import sqlite3, pandas as pd; con=sqlite3.connect('data_tuning/app.db'); works = pd.read_sql("SELECT id, title, sanctioned_amount FROM works WHERE id IN ('W-001872', 'W-002098')", con); print(works)
