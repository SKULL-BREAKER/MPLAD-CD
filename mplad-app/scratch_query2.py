import sqlite3
con = sqlite3.connect('data/app.db')
c = con.execute("SELECT detector, count(*) FROM detection_results GROUP BY detector")
print(c.fetchall())
