import sqlite3
con = sqlite3.connect('data/app.db')
rows = con.execute("""
  SELECT mp_id, fy, ROUND(SUM(sanctioned_amount)/1e7,2) cr,
         ROUND(SUM(sanctioned_amount)/(CASE fy WHEN '2021-22' THEN 2e7
         ELSE 5e7 END),2) ratio
  FROM works GROUP BY mp_id, fy ORDER BY ratio DESC LIMIT 5""").fetchall()
print("WORST CELLS BY RATIO:")
for r in rows: print(" ", r)
mp, fy = rows[0][0], rows[0][1]
print(f"\nFULL breakdown {mp} {fy} — paste every row, no truncation:")
for r in con.execute("""
  SELECT COALESCE(fl.pattern,'honest'), ROUND(SUM(w.sanctioned_amount)/1e7,2),
         COUNT(*)
  FROM works w LEFT JOIN fraud_labels fl ON fl.work_id=w.id
  WHERE w.mp_id=? AND w.fy=? GROUP BY 1 ORDER BY 2 DESC""", (mp, fy)):
    print(" ", r)
print("\nAUTHORITATIVE total (no join):",
      con.execute("SELECT COUNT(*), ROUND(SUM(sanctioned_amount)/1e7,2) FROM works WHERE mp_id=? AND fy=?", (mp, fy)).fetchone())
print("Works carrying 2+ labels (explains overlap, not gaps):",
      con.execute("SELECT COUNT(*) FROM (SELECT work_id FROM fraud_labels GROUP BY work_id HAVING COUNT(*)>1)").fetchone()[0])
