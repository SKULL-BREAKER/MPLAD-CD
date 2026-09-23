import sqlite3, json

conn = sqlite3.connect("data_tuning/app.db")
conn.row_factory = sqlite3.Row

print("=== D1 rows by label (seed43) ===")
rows = conn.execute("""
    SELECT COALESCE(fl.pattern, 'UNLABELED') as label, COUNT(*) as cnt
    FROM detection_results dr
    LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
    WHERE dr.detector = 'D1'
    GROUP BY label ORDER BY label
""").fetchall()
total = sum(r['cnt'] for r in rows)
for r in rows:
    print(f"  {r['label']}: {r['cnt']}")
print(f"  TOTAL: {total}")

print()
print("=== D1_split rows by label (seed43) ===")
rows2 = conn.execute("""
    SELECT COALESCE(fl.pattern, 'UNLABELED') as label, COUNT(*) as cnt
    FROM detection_results dr
    LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
    WHERE dr.detector = 'D1_split'
    GROUP BY label ORDER BY label
""").fetchall()
total2 = sum(r['cnt'] for r in rows2)
for r in rows2:
    print(f"  {r['label']}: {r['cnt']}")
print(f"  TOTAL: {total2}")

print()
print("=== same_agency=False rows in D1 (must be 0) ===")
cross = conn.execute("""
    SELECT COUNT(*) as cnt FROM detection_results dr
    WHERE dr.detector = 'D1'
    AND json_extract(dr.evidence_json, '$.same_agency') = 0
""").fetchone()
print(f"  same_agency=False: {cross['cnt']}")

print()
print("=== All FPs in D1 (non-P2/P6/P7) — branch attribution ===")
fps = conn.execute("""
    SELECT dr.work_id,
           COALESCE(fl.pattern, 'UNLABELED') as label,
           dr.score,
           json_extract(dr.evidence_json, '$.matched_with') as partner,
           json_extract(dr.evidence_json, '$.same_agency') as same_agency,
           json_extract(dr.evidence_json, '$.geo_distance_km') as dist,
           json_extract(dr.evidence_json, '$.amount_delta') as amt_delta,
           json_extract(dr.evidence_json, '$.fy_delta') as fy_delta,
           w.title
    FROM detection_results dr
    JOIN works w ON w.id = dr.work_id
    LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
    WHERE dr.detector = 'D1'
    AND (fl.pattern IS NULL OR fl.pattern NOT IN ('P2','P6','P7'))
    ORDER BY label, dr.work_id
""").fetchall()
print(f"Total FPs: {len(fps)}")
for r in fps:
    partner_lbl = conn.execute(
        "SELECT GROUP_CONCAT(pattern) FROM fraud_labels WHERE work_id=?",
        (r['partner'],)
    ).fetchone()[0]
    sa = r['same_agency']
    if sa == 1:
        branch = "is_p2" if (partner_lbl and 'P2' in str(partner_lbl)) else "is_p6"
    else:
        branch = "same_agency=False(BUG!)"
    print(f"  FP={r['work_id']}  lbl={r['label']}  branch={branch}  "
          f"partner_lbl={partner_lbl}  dist={float(r['dist']):.1f}km  "
          f"amt={float(r['amt_delta']):.3f}  fy_delta={r['fy_delta']}")
    print(f"     {r['title'][:70]!r}")

print()
p9 = conn.execute("SELECT COUNT(*) FROM fraud_labels WHERE pattern='P9'").fetchone()[0]
p6_total = conn.execute("SELECT COUNT(*) FROM fraud_labels WHERE pattern='P6'").fetchone()[0]
p2_total = conn.execute("SELECT COUNT(*) FROM fraud_labels WHERE pattern='P2'").fetchone()[0]
print(f"P9 in fraud_labels: {p9}")
print(f"P6 in fraud_labels: {p6_total}")
print(f"P2 in fraud_labels: {p2_total}")
conn.close()
