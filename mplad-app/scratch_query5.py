import sqlite3
import pandas as pd

conn = sqlite3.connect('data/app.db')
df = pd.read_sql_query("SELECT w.id, w.status, w.sanction_date, w.start_date FROM works w JOIN fraud_labels f ON w.id=f.work_id WHERE f.pattern='P4'", conn)

ref_date = pd.Timestamp("2024-06-30")
df['sanction'] = pd.to_datetime(df['sanction_date'])
df['age'] = (ref_date - df['sanction']).dt.days

print("Min age:", df['age'].min())
print("Works with age < 365:", len(df[df['age'] < 365]))
print(df[df['age'] < 365])
conn.close()
