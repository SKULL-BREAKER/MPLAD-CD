import sqlite3
con = sqlite3.connect('data_tuning/app.db')
print("DISTINCT:", con.execute("SELECT COUNT(DISTINCT work_id) FROM detection_results WHERE detector IN ('D1', 'D1_split')").fetchone()[0])
print("ROWS:", con.execute("SELECT COUNT(*) FROM detection_results WHERE detector IN ('D1', 'D1_split')").fetchone()[0])
con.close()
