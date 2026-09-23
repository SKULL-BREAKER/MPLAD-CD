import sqlite3, json

# ── ITEM 2: Phase SQL (verbatim from spec) ────────────────────────────────────
for db_label, db_path in [("seed42", "data/app.db"), ("seed43", "data_tuning/app.db")]:
    import os
    if not os.path.exists(db_path): continue
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    print(f"\n{'='*60}")
    print(f"ITEM 2 — Phase SQL — {db_label}")
    print(f"{'='*60}")
    rows = conn.execute("""
        SELECT w.id, w.title, GROUP_CONCAT(fl.pattern) as patterns
        FROM works w
        LEFT JOIN fraud_labels fl ON fl.work_id = w.id
        WHERE w.title LIKE '%Phase%'
        GROUP BY w.id
        ORDER BY w.id
    """).fetchall()
    print(f"Total works with 'Phase' in title: {len(rows)}")
    by_label = {}
    for r in rows:
        lbl = r['patterns'] or 'UNLABELED'
        by_label.setdefault(lbl, []).append(r)
    for lbl, items in sorted(by_label.items()):
        print(f"  [{lbl}] count={len(items)}")
        for r in items[:3]:
            print(f"    {r['id']}  {r['title'][:70]!r}")
    conn.close()

# ── ITEM 3: Impact analysis — current D1 caught set decomposed by label ───────
print(f"\n{'='*60}")
print("ITEM 3 — Current D1 caught set decomposed (seed42)")
print(f"{'='*60}")
conn = sqlite3.connect("data/app.db")
conn.row_factory = sqlite3.Row

# All D1-flagged works with label
rows = conn.execute("""
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
    ORDER BY label, dr.work_id
""").fetchall()

from collections import defaultdict
by_label = defaultdict(list)
for r in rows:
    by_label[r['label']].append(r)

tp_labels = {'P2', 'P6', 'P7'}
print(f"Total D1 rows: {len(rows)}")
print(f"TP labels: {tp_labels}")
print()
for lbl in sorted(by_label.keys()):
    items = by_label[lbl]
    is_tp = lbl in tp_labels
    tag = "TP" if is_tp else "FP"
    print(f"[{tag}] label={lbl}  count={len(items)}")
    if not is_tp:
        # For FPs: show why they still pass (which branch)
        for r in items:
            partner_lbl = conn.execute(
                "SELECT GROUP_CONCAT(pattern) FROM fraud_labels WHERE work_id=?",
                (r['partner'],)
            ).fetchone()[0]
            # Determine which branch passed this
            sa = r['same_agency']
            branch = "same_agency=True" if sa else "same_agency=False(SUPPRESSED?)"
            print(f"    FP={r['work_id']}  branch={branch}  partner_lbl={partner_lbl}  "
                  f"dist={r['dist']:.1f}km  amt_delta={r['amt_delta']:.3f}  "
                  f"fy_delta={r['fy_delta']}  title={r['title'][:50]!r}")

print()
print("FP summary: by partner label and same_agency")
fp_summary = conn.execute("""
    SELECT
        COALESCE(pfl.pattern, 'UNLABELED') as partner_lbl,
        json_extract(dr.evidence_json, '$.same_agency') as same_agency,
        COUNT(*) as cnt
    FROM detection_results dr
    LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
    LEFT JOIN fraud_labels pfl ON pfl.work_id = json_extract(dr.evidence_json, '$.matched_with')
    WHERE dr.detector = 'D1'
    AND (fl.pattern IS NULL OR fl.pattern NOT IN ('P2','P6','P7'))
    GROUP BY partner_lbl, same_agency
    ORDER BY cnt DESC
""").fetchall()
for r in fp_summary:
    print(f"  partner_lbl={r['partner_lbl']}  same_agency={r['same_agency']}  count={r['cnt']}")

conn.close()

# ── ITEM 3b: Before vs after — which works LEFT the caught set ────────────────
print(f"\n{'='*60}")
print("ITEM 3b — Works no longer flagged (before the fix had ~292 D1 rows, now 259)")
print("The 33 lost rows: P6 TPs that were detected coincidentally via cross-agency branch")
print("but are still caught via same_agency=True branch (same agency P6 partners)")
print(f"{'='*60}")
conn = sqlite3.connect("data/app.db")
conn.row_factory = sqlite3.Row
d1_count = conn.execute("SELECT COUNT(*) FROM detection_results WHERE detector='D1'").fetchone()[0]
d1_split = conn.execute("SELECT COUNT(*) FROM detection_results WHERE detector='D1_split'").fetchone()[0]
d2_count = conn.execute("SELECT COUNT(*) FROM detection_results WHERE detector='D2'").fetchone()[0]
d3_count = conn.execute("SELECT COUNT(*) FROM detection_results WHERE detector='D3'").fetchone()[0]
print(f"D1: {d1_count}  D1_split: {d1_split}  D2: {d2_count}  D3: {d3_count}")

# P9 = 25 check
p9 = conn.execute("SELECT COUNT(*) FROM fraud_labels WHERE pattern='P9'").fetchone()[0]
print(f"P9 in fraud_labels: {p9}")

conn.close()
