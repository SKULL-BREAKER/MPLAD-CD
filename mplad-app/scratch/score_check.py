import sqlite3
con = sqlite3.connect('data/app.db')
print('=== MAX SCORE IN D1 ===')
print(con.execute("SELECT MAX(score) FROM detection_results WHERE detector='D1'").fetchone()[0])
print('=== SCORES >= 1.0 IN D1 ===')
print(con.execute("SELECT COUNT(*) FROM detection_results WHERE detector='D1' AND score >= 1.0").fetchone()[0])
