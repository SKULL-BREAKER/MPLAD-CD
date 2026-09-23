import sqlite3, pandas as pd; con = sqlite3.connect('data/app.db'); df = pd.read_sql("SELECT * FROM fraud_labels WHERE work_id IN ('W-000075', 'W-002033')", con); print(df)
