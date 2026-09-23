import sqlite3
con = sqlite3.connect('data_tuning/app.db')
print(con.execute("SELECT MAX(w.sanctioned_amount) FROM works w JOIN fraud_labels fl ON fl.work_id=w.id WHERE fl.pattern='P7'").fetchone()[0])
