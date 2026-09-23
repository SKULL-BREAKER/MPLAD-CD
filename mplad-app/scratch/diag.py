import sqlite3
conn = sqlite3.connect('data/app.db')
res = conn.execute("""
SELECT work_id, GROUP_CONCAT(pattern || ':' || label_class)
FROM fraud_labels GROUP BY work_id
HAVING SUM(CASE WHEN label_class='innocent' THEN 1 ELSE 0 END) > 0
   AND SUM(CASE WHEN label_class!='innocent' THEN 1 ELSE 0 END) > 0;
""").fetchall()
for r in res:
    print(f"{r[0]} -> {r[1]}")
