import sqlite3

conn = sqlite3.connect('data/app.db')

print('=== detection_results schema ===')
for row in conn.execute("SELECT sql FROM sqlite_master WHERE name='detection_results'"):
    print(row[0])

print()
print('=== all indexes on detection_results ===')
for r in conn.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='detection_results'"):
    print(r)

print()
print('=== detection_results row count by detector ===')
for r in conn.execute("SELECT detector, COUNT(*) FROM detection_results GROUP BY detector ORDER BY detector"):
    print(r)

print()
print('=== duplicate (work_id, detector) pairs ===')
dupes = conn.execute("""
    SELECT work_id, detector, COUNT(*) as cnt
    FROM detection_results
    GROUP BY work_id, detector
    HAVING cnt > 1
    LIMIT 10
""").fetchall()
print(f"Duplicate pairs: {len(dupes)}")
for r in dupes:
    print(r)

conn.close()
