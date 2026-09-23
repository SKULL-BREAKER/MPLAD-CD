import sqlite3
con = sqlite3.connect('data/app.db')
tables = [r[0] for r in con.execute('SELECT name FROM sqlite_master WHERE type="table"')]
print("TABLES:", len(tables), tables)
con.close()
