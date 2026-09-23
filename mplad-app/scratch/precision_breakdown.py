import sqlite3, json, os

dbs = {
    "seed42": "data/app.db",
    "seed43": "data_tuning/app.db",
}

for name, db_path in dbs.items():
    if not os.path.exists(db_path):
        print(f"[{name}] NOT FOUND at {db_path}")
        continue
    print(f"\n{'='*60}")
    print(f"SEED: {name}  DB: {db_path}")
    print(f"{'='*60}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # D1 detections by label group
    cur.execute("""
        SELECT COALESCE(fl.pattern, 'UNLABELED') as label, COUNT(DISTINCT dr.work_id) as cnt
        FROM detection_results dr
        LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
        WHERE dr.detector = 'D1'
        GROUP BY fl.pattern
        ORDER BY fl.pattern
    """)
    print("D1 detections grouped by label:")
    for r in cur.fetchall():
        print(f"  {r['label']}: {r['cnt']}")

    cur.execute("SELECT COUNT(DISTINCT work_id) as total FROM detection_results WHERE detector='D1'")
    total = cur.fetchone()['total']

    cur.execute("""
        SELECT COUNT(DISTINCT dr.work_id) as cnt
        FROM detection_results dr
        JOIN fraud_labels fl ON fl.work_id = dr.work_id
        WHERE dr.detector = 'D1'
        AND fl.pattern IN ('P2','P6','P7')
    """)
    tp = cur.fetchone()['cnt']
    print(f"\nTotal unique D1-flagged works: {total}")
    print(f"D1 TPs (labeled P2/P6/P7):    {tp}")
    print(f"D1 FPs (not labeled P2/P6/P7):{total - tp}")
    print(f"D1 raw precision:              {tp}/{total} = {tp/total:.6f}")

    # P6 breakdown
    cur.execute("SELECT COUNT(*) FROM fraud_labels WHERE pattern='P6'")
    p6_total = cur.fetchone()[0]
    cur.execute("""
        SELECT COUNT(DISTINCT dr.work_id) as cnt
        FROM detection_results dr
        JOIN fraud_labels fl ON fl.work_id = dr.work_id
        WHERE dr.detector = 'D1' AND fl.pattern = 'P6'
    """)
    p6_caught = cur.fetchone()['cnt']
    print(f"\nP6 total labels:  {p6_total}")
    print(f"P6 caught by D1:  {p6_caught}")
    print(f"P6 recall:        {p6_caught}/{p6_total} = {p6_caught/p6_total:.4f}")

    # Who are the partners of FP works?
    print("\nFP partner label breakdown:")
    cur.execute("""
        SELECT COALESCE(pfl.pattern, 'UNLABELED') as partner_label,
               COUNT(DISTINCT dr.work_id) as fp_count
        FROM detection_results dr
        LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
        LEFT JOIN fraud_labels pfl ON pfl.work_id = json_extract(dr.evidence_json, '$.matched_with')
        WHERE dr.detector = 'D1'
        AND (fl.pattern IS NULL OR fl.pattern NOT IN ('P2','P6','P7'))
        GROUP BY pfl.pattern
        ORDER BY pfl.pattern
    """)
    for r in cur.fetchall():
        print(f"  partner_label={r['partner_label']}: {r['fp_count']} FPs")

    # The P6 FPs: are they matching against P6 SOURCES or P6 CLONES?
    # P6 works: injected clones with same title as existing work but different district
    # "Innocent" works that share a village-name with P6 clones
    print("\nP6-partner FP works in detail (first 10):")
    cur.execute("""
        SELECT dr.work_id, w.title, w.village,
               COALESCE(fl.pattern, 'UNLABELED') as label,
               json_extract(dr.evidence_json, '$.matched_with') as partner,
               json_extract(dr.evidence_json, '$.geo_distance_km') as dist,
               json_extract(dr.evidence_json, '$.amount_delta') as amt_delta,
               json_extract(dr.evidence_json, '$.same_agency') as same_agency
        FROM detection_results dr
        JOIN works w ON w.id = dr.work_id
        LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
        LEFT JOIN fraud_labels pfl ON pfl.work_id = json_extract(dr.evidence_json, '$.matched_with')
        WHERE dr.detector = 'D1'
        AND (fl.pattern IS NULL OR fl.pattern NOT IN ('P2','P6','P7'))
        AND pfl.pattern = 'P6'
        ORDER BY dr.score DESC
        LIMIT 10
    """)
    for r in cur.fetchall():
        print(f"  FP={r['work_id']} lbl={r['label']}  title={r['title']!r}")
        print(f"       village={r['village']}  partner={r['partner']}  dist={r['dist']:.1f}km  amt_delta={r['amt_delta']:.2f}  same_agency={r['same_agency']}")

    conn.close()
