import sqlite3
con = sqlite3.connect('data/app.db')
c = con.execute('SELECT work_id FROM fraud_labels WHERE pattern="P2"')
ids = [r[0] for r in c.fetchall()]
c = con.execute(f'SELECT score FROM detection_results WHERE detector="D1" AND work_id IN ({",".join(["?"]*len(ids))})', ids)
scores = [r[0] for r in c.fetchall()]
print("Scores >= 0.92:", len([s for s in scores if s >= 0.92]))
print("Scores < 0.92:", len([s for s in scores if s < 0.92]))
print("Max score:", max(scores) if scores else None)
