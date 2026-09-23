import sqlite3, json

# Inspect the P6 TP cross-agency collision mechanism
conn = sqlite3.connect('data/app.db')
conn.row_factory = sqlite3.Row

# The core question: for P6 TPs flagged via same_agency=False,
# what makes them P6 and not natural?
# P6 by definition: same title, different district, same agency (per spec)
# But d1.py's cross-agency branch catches them too?
# Check P6 TP same_agency=False cases
print("=== P6 TPs caught via same_agency=False (cross-agency P6 clone branch) ===")
rows = conn.execute("""
    SELECT dr.work_id, w.village, w.district_id, w.agency_id,
           json_extract(dr.evidence_json, '$.matched_with') as partner,
           json_extract(dr.evidence_json, '$.amount_delta') as amt_delta,
           json_extract(dr.evidence_json, '$.same_agency') as same_agency,
           json_extract(dr.evidence_json, '$.geo_distance_km') as dist
    FROM detection_results dr
    JOIN works w ON w.id = dr.work_id
    JOIN fraud_labels fl ON fl.work_id = dr.work_id
    WHERE dr.detector = 'D1'
    AND fl.pattern = 'P6'
    AND json_extract(dr.evidence_json, '$.same_agency') = 0
    ORDER BY CAST(json_extract(dr.evidence_json, '$.amount_delta') AS REAL) DESC
""").fetchall()
print(f"P6 TPs via same_agency=False: {len(rows)}")
for r in rows:
    p = conn.execute('SELECT id, village, district_id, agency_id FROM works WHERE id=?', (r['partner'],)).fetchone()
    plbl = conn.execute('SELECT GROUP_CONCAT(pattern) FROM fraud_labels WHERE work_id=?', (p['id'],)).fetchone()[0]
    print(f"  TP={r['work_id']}  village={r['village']}  dist_id={r['district_id']}  agency={r['agency_id']}")
    print(f"     partner={p['id']}  village={p['village']}  dist_id={p['district_id']}  agency={p['agency_id']}  label={plbl}")
    print(f"     amt_delta={float(r['amt_delta']):.4f}  dist={float(r['dist']):.1f}km")

print()
print("=== P6 TPs caught via same_agency=True (same-agency P6 branch) ===")
rows2 = conn.execute("""
    SELECT COUNT(*) as cnt
    FROM detection_results dr
    JOIN fraud_labels fl ON fl.work_id = dr.work_id
    WHERE dr.detector = 'D1'
    AND fl.pattern = 'P6'
    AND json_extract(dr.evidence_json, '$.same_agency') = 1
""").fetchone()
print(f"P6 TPs via same_agency=True: {rows2['cnt']}")

# Now for seed 43
conn.close()
print()
conn = sqlite3.connect('data_tuning/app.db')
conn.row_factory = sqlite3.Row
print("=== SEED 43: P6 TPs via same_agency=False ===")
rows3 = conn.execute("""
    SELECT dr.work_id, w.village, w.district_id, w.agency_id,
           json_extract(dr.evidence_json, '$.matched_with') as partner,
           json_extract(dr.evidence_json, '$.amount_delta') as amt_delta,
           json_extract(dr.evidence_json, '$.same_agency') as same_agency,
           json_extract(dr.evidence_json, '$.geo_distance_km') as dist
    FROM detection_results dr
    JOIN works w ON w.id = dr.work_id
    JOIN fraud_labels fl ON fl.work_id = dr.work_id
    WHERE dr.detector = 'D1'
    AND fl.pattern = 'P6'
    AND json_extract(dr.evidence_json, '$.same_agency') = 0
    ORDER BY CAST(json_extract(dr.evidence_json, '$.amount_delta') AS REAL) DESC
""").fetchall()
print(f"P6 TPs via same_agency=False: {len(rows3)}")
for r in rows3:
    p = conn.execute('SELECT id, village, district_id, agency_id FROM works WHERE id=?', (r['partner'],)).fetchone()
    plbl = conn.execute('SELECT GROUP_CONCAT(pattern) FROM fraud_labels WHERE work_id=?', (p['id'],)).fetchone()[0]
    print(f"  TP={r['work_id']}  v={r['village']}  d={r['district_id']}  a={r['agency_id']}")
    print(f"     partner={p['id']}  v={p['village']}  d={p['district_id']}  a={p['agency_id']}  lbl={plbl}")
    print(f"     amt_delta={float(r['amt_delta']):.4f}  dist={float(r['dist']):.1f}km")
conn.close()
