import sqlite3
import pandas as pd
con = sqlite3.connect('data/app.db')
c = con.execute('SELECT COUNT(*) FROM fraud_labels WHERE pattern="P2"')
print('Total P2:', c.fetchone()[0])
c = con.execute('SELECT work_id FROM fraud_labels WHERE pattern="P2"')
ids = [r[0] for r in c.fetchall()]
print('P2 works:', ids)
c = con.execute(f'SELECT * FROM detection_results WHERE detector="D1" AND work_id IN ({",".join(["?"]*len(ids))})', ids)
print('D1 results for P2:', c.fetchall())
