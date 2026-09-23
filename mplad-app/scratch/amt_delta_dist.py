import sqlite3, json

# Check both seeds - P6 TP amt_delta distribution
dbs = {
    "seed42": "data/app.db",
    "seed43": "data_tuning/app.db",
}

for name, db_path in dbs.items():
    import os
    if not os.path.exists(db_path):
        print(f"[{name}] NOT FOUND")
        continue
    print(f"\n{'='*60}")
    print(f"SEED: {name}  DB: {db_path}")
    print(f"{'='*60}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # P6 TPs: D1-flagged works labeled P6, get their evidence amt_delta
    print("\n-- P6 TPs: amt_delta distribution --")
    cur.execute("""
        SELECT dr.work_id,
               json_extract(dr.evidence_json, '$.amount_delta') as amt_delta,
               json_extract(dr.evidence_json, '$.geo_distance_km') as dist_km,
               json_extract(dr.evidence_json, '$.same_agency') as same_agency,
               w.title
        FROM detection_results dr
        JOIN works w ON w.id = dr.work_id
        JOIN fraud_labels fl ON fl.work_id = dr.work_id
        WHERE dr.detector = 'D1'
        AND fl.pattern = 'P6'
        ORDER BY CAST(json_extract(dr.evidence_json, '$.amount_delta') AS REAL) DESC
    """)
    p6_tps = cur.fetchall()
    print(f"P6 TPs: {len(p6_tps)}")
    amt_deltas = [r['amt_delta'] for r in p6_tps if r['amt_delta'] is not None]
    if amt_deltas:
        print(f"amt_delta  min={min(amt_deltas):.4f}  max={max(amt_deltas):.4f}  mean={sum(amt_deltas)/len(amt_deltas):.4f}")
    for r in p6_tps[:10]:
        print(f"  work={r['work_id']}  amt_delta={r['amt_delta']:.4f}  dist={r['dist_km']:.1f}km  agency={r['same_agency']}  title={r['title'][:60]!r}")

    # FP works matched to P6: amt_delta distribution
    print("\n-- P6-partner FPs: amt_delta distribution --")
    cur.execute("""
        SELECT dr.work_id,
               COALESCE(fl.pattern, 'UNLABELED') as label,
               json_extract(dr.evidence_json, '$.amount_delta') as amt_delta,
               json_extract(dr.evidence_json, '$.geo_distance_km') as dist_km,
               json_extract(dr.evidence_json, '$.same_agency') as same_agency,
               w.title
        FROM detection_results dr
        JOIN works w ON w.id = dr.work_id
        LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
        LEFT JOIN fraud_labels pfl ON pfl.work_id = json_extract(dr.evidence_json, '$.matched_with')
        WHERE dr.detector = 'D1'
        AND (fl.pattern IS NULL OR fl.pattern NOT IN ('P2','P6','P7'))
        AND pfl.pattern = 'P6'
        ORDER BY CAST(json_extract(dr.evidence_json, '$.amount_delta') AS REAL)
    """)
    fp_rows = cur.fetchall()
    fp_amts = [r['amt_delta'] for r in fp_rows if r['amt_delta'] is not None]
    print(f"P6-partner FPs: {len(fp_rows)}")
    if fp_amts:
        print(f"amt_delta  min={min(fp_amts):.4f}  max={max(fp_amts):.4f}  mean={sum(fp_amts)/len(fp_amts):.4f}")
    for r in fp_rows:
        print(f"  FP={r['work_id']}  lbl={r['label']}  amt_delta={r['amt_delta']:.4f}  dist={r['dist_km']:.1f}km  title={r['title'][:55]!r}")

    # P2 TPs: amt_delta distribution (for comparison - same agency path)
    print("\n-- P2 TPs: amt_delta distribution (same-agency path) --")
    cur.execute("""
        SELECT json_extract(dr.evidence_json, '$.amount_delta') as amt_delta
        FROM detection_results dr
        JOIN fraud_labels fl ON fl.work_id = dr.work_id
        WHERE dr.detector = 'D1'
        AND fl.pattern = 'P2'
        ORDER BY CAST(json_extract(dr.evidence_json, '$.amount_delta') AS REAL) DESC
        LIMIT 10
    """)
    p2_tps = [r['amt_delta'] for r in cur.fetchall() if r['amt_delta'] is not None]
    if p2_tps:
        print(f"P2 TP amt_delta max={max(p2_tps):.4f}  min={min(p2_tps):.4f}")

    conn.close()
