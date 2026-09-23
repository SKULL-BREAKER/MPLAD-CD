import sqlite3
import pandas as pd

con = sqlite3.connect('data_tuning/app.db')
labels = pd.read_sql_query("SELECT * FROM fraud_labels WHERE work_id IN ('W-002285','W-002308','W-002291')", con)
works = pd.read_sql_query("SELECT id, status, sanction_date, start_date, completion_date, sanctioned_amount, expenditure FROM works WHERE id IN ('W-002285','W-002308','W-002291')", con)
print("Labels:")
print(labels)
print("\nWorks:")
print(works.to_string())
con.close()
