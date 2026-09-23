import sqlite3, json

# Check fy_delta for P6 TPs vs FPs - can we separate on FY?
for db_label, db_path in [("seed42", "data/app.db"), ("seed43", "data_tuning/app.db")]:
    import os
    if not os.path.exists(db_path):
        continue
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    print(f"\n=== {db_label} ===")

    # P6 TPs: fy_delta
    print("P6 TPs fy_delta:")
    rows = conn.execute("""
        SELECT json_extract(dr.evidence_json, '$.fy_delta') as fy_delta,
               json_extract(dr.evidence_json, '$.same_agency') as same_agency,
               COUNT(*) as cnt
        FROM detection_results dr
        JOIN fraud_labels fl ON fl.work_id = dr.work_id
        WHERE dr.detector = 'D1' AND fl.pattern = 'P6'
        GROUP BY fy_delta, same_agency ORDER BY fy_delta
    """).fetchall()
    for r in rows:
        print(f"  fy_delta={r['fy_delta']}  same_agency={r['same_agency']}  count={r['cnt']}")

    # P6-partner FPs: fy_delta
    print("P6-partner FPs fy_delta:")
    rows2 = conn.execute("""
        SELECT json_extract(dr.evidence_json, '$.fy_delta') as fy_delta,
               json_extract(dr.evidence_json, '$.same_agency') as same_agency,
               COUNT(DISTINCT dr.work_id) as cnt
        FROM detection_results dr
        LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
        LEFT JOIN fraud_labels pfl ON pfl.work_id = json_extract(dr.evidence_json, '$.matched_with')
        WHERE dr.detector = 'D1'
        AND (fl.pattern IS NULL OR fl.pattern NOT IN ('P2','P6','P7'))
        AND pfl.pattern = 'P6'
        GROUP BY fy_delta, same_agency ORDER BY fy_delta
    """).fetchall()
    for r in rows2:
        print(f"  fy_delta={r['fy_delta']}  same_agency={r['same_agency']}  count={r['cnt']}")

    # What about checking: for the same_agency=False cross-district path
    # are all the P6-partner FPs actually matching P6 clones that are in the SAME FY?
    print("\nP6-partner FPs via same_agency=False: fy details")
    rows3 = conn.execute("""
        SELECT dr.work_id, w.fy as w_fy,
               json_extract(dr.evidence_json, '$.matched_with') as partner,
               json_extract(dr.evidence_json, '$.fy_delta') as fy_delta,
               json_extract(dr.evidence_json, '$.amount_delta') as amt_delta
        FROM detection_results dr
        JOIN works w ON w.id = dr.work_id
        LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
        LEFT JOIN fraud_labels pfl ON pfl.work_id = json_extract(dr.evidence_json, '$.matched_with')
        WHERE dr.detector = 'D1'
        AND (fl.pattern IS NULL OR fl.pattern NOT IN ('P2','P6','P7'))
        AND pfl.pattern = 'P6'
        AND json_extract(dr.evidence_json, '$.same_agency') = 0
        ORDER BY CAST(json_extract(dr.evidence_json, '$.fy_delta') AS REAL)
    """).fetchall()
    for r in rows3:
        p = conn.execute('SELECT fy FROM works WHERE id=?', (r['partner'],)).fetchone()
        print(f"  FP={r['work_id']} fy={r['w_fy']}  partner_fy={p['fy'] if p else '?'}  fy_delta={r['fy_delta']}  amt_delta={float(r['amt_delta']):.3f}")

    conn.close()
