import sqlite3, json

conn = sqlite3.connect("data/app.db")
conn.row_factory = sqlite3.Row

# Full decomposition including P7
print("=== D1 rows by label (seed42) ===")
rows = conn.execute("""
    SELECT COALESCE(fl.pattern, 'UNLABELED') as label, COUNT(*) as cnt
    FROM detection_results dr
    LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
    WHERE dr.detector = 'D1'
    GROUP BY label
    ORDER BY label
""").fetchall()
total = 0
for r in rows:
    print(f"  {r['label']}: {r['cnt']}")
    total += r['cnt']
print(f"  TOTAL: {total}")

print()
print("=== D1_split rows by label (seed42) ===")
rows2 = conn.execute("""
    SELECT COALESCE(fl.pattern, 'UNLABELED') as label, COUNT(*) as cnt
    FROM detection_results dr
    LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
    WHERE dr.detector = 'D1_split'
    GROUP BY label
    ORDER BY label
""").fetchall()
total2 = 0
for r in rows2:
    print(f"  {r['label']}: {r['cnt']}")
    total2 += r['cnt']
print(f"  TOTAL: {total2}")

print()
print("=== All FPs in D1 (non-P2/P6/P7): full detail ===")
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
    # Determine the guard branch that passed this FP:
    # same_agency=True -> went through is_p2/is_p6 check
    # Check is_p2: matched_with partner labeled P2 -> passed as is_p2
    # Check is_p6: matched_with partner labeled P6 -> passed as is_p6
    if r['same_agency'] == 1:
        if partner_lbl and 'P2' in partner_lbl:
            branch = "same_agency=True/is_p2"
        elif partner_lbl and 'P6' in partner_lbl:
            branch = "same_agency=True/is_p6"
        else:
            branch = "same_agency=True/UNKNOWN"
    else:
        branch = "same_agency=False/SUPPRESSED(bug?)"
    print(f"  FP={r['work_id']}  lbl={r['label']}  branch={branch}  "
          f"partner_lbl={partner_lbl}  dist={float(r['dist']):.1f}km  "
          f"amt_delta={float(r['amt_delta']):.3f}  fy_delta={r['fy_delta']}")
    print(f"     title={r['title'][:70]!r}")

# Check if any same_agency=False still passed (would be a bug in the fix)
cross_agency_passed = conn.execute("""
    SELECT COUNT(*) as cnt
    FROM detection_results dr
    WHERE dr.detector = 'D1'
    AND json_extract(dr.evidence_json, '$.same_agency') = 0
""").fetchone()
print()
print(f"=== same_agency=False rows still in D1 (should be 0): {cross_agency_passed['cnt']} ===")

conn.close()
