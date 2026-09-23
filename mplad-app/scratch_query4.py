import sqlite3
import pandas as pd

conn = sqlite3.connect('data/app.db')
df = pd.read_sql_query("SELECT w.id, w.status, w.sanction_date, w.start_date FROM works w JOIN fraud_labels f ON w.id=f.work_id WHERE f.pattern='P4'", conn)
print("Null sanction dates:", df['sanction_date'].isnull().sum())
print("Total P4 works:", len(df))
print(df[df['sanction_date'].isnull()])
conn.close()
