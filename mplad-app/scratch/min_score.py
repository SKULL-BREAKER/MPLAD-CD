import sqlite3
con = sqlite3.connect('data/app.db')
print('=== MIN D1 SCORE ===')
print(con.execute("SELECT MIN(score) FROM detection_results WHERE detector='D1'").fetchone()[0])
print('=== MIN D1 SCORE FOR P2 ===')
print(con.execute('''
    SELECT MIN(dr.score) FROM detection_results dr
    JOIN fraud_labels fl ON fl.work_id = dr.work_id
    WHERE dr.detector='D1' AND fl.pattern='P2'
''').fetchone()[0])
