import sqlite3
import pandas as pd

conn = sqlite3.connect('data/app.db')
df = pd.read_sql_query("SELECT d.score FROM detection_results d JOIN fraud_labels f ON d.work_id=f.work_id WHERE f.pattern='P6' AND d.detector='D1'", conn)
print(df['score'].describe())
print(df[df['score'] >= 0.82])
conn.close()
