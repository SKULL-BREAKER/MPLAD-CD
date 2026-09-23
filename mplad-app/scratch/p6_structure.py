import sqlite3
from collections import defaultdict

conn = sqlite3.connect('data/app.db')
conn.row_factory = sqlite3.Row

p6_works = conn.execute("""
    SELECT w.id, w.agency_id, w.district_id, w.village, w.title, w.fy
    FROM works w
    JOIN fraud_labels fl ON fl.work_id = w.id
    WHERE fl.pattern = 'P6'
    ORDER BY w.title, w.id
""").fetchall()

by_title = defaultdict(list)
for r in p6_works:
    by_title[r['title']].append(dict(r))

print(f"Total P6-labeled works: {len(p6_works)}")
print(f"Total unique P6 titles: {len(by_title)}")
print()

same_agency_groups = 0
diff_agency_groups = 0
for title, works in by_title.items():
    agencies = set(w['agency_id'] for w in works)
    if len(agencies) == 1:
        same_agency_groups += 1
    else:
        diff_agency_groups += 1

print(f"Groups where ALL clones share same agency: {same_agency_groups}")
print(f"Groups where clones span DIFFERENT agencies: {diff_agency_groups}")
print()
print("Sample groups:")
for title, works in list(by_title.items())[:8]:
    agencies = set(w['agency_id'] for w in works)
    districts = set(w['district_id'] for w in works)
    print(f"  [{len(works)} works, {len(agencies)} agencies, {len(districts)} dists]: {title[:60]!r}")
    for w in works:
        print(f"    {w['id']}  ag={w['agency_id']}  dist={w['district_id']}  v={w['village']}  fy={w['fy']}")
conn.close()
