import sqlite3
con = sqlite3.connect('data/app.db')
print(con.execute("SELECT sql FROM sqlite_master WHERE name='detection_results'").fetchone()[0])
