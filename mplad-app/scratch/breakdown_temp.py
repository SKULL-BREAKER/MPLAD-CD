import sqlite3
con = sqlite3.connect('data/app.db')
top = con.execute("""
  SELECT mp_id, fy, ROUND(SUM(sanctioned_amount)/1e7,2) AS cr, COUNT(*)
  FROM works GROUP BY mp_id, fy
  ORDER BY SUM(sanctioned_amount) DESC LIMIT 5""").fetchall()
print("TOP 5 MPxFY CELLS (crore):")
for t in top: print(" ", t)
mp, fy = 'MP-019', '2019-20'
print(f"\nBREAKDOWN of worst cell {mp} {fy}")
print("(entitlement: 5cr in 2019-20/2022-23/2023-24, 2cr in 2021-22)")
for r in con.execute("""
  SELECT COALESCE(fl.pattern,'honest') AS pat,
         ROUND(SUM(w.sanctioned_amount)/1e7,2) AS cr, COUNT(*) AS n
  FROM works w LEFT JOIN fraud_labels fl ON fl.work_id=w.id
  WHERE w.mp_id=? AND w.fy=?
  GROUP BY pat ORDER BY cr DESC""", (mp, fy)):
    print(" ", r)
