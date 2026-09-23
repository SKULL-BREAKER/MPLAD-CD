"""
Full diagnosis script for Gate 03 p2_target failure.
Runs against both seed42 (app.db) and seed43 (data_tuning/app.db).
"""
import sqlite3
import json
import os
import sys

DATABASES = {
    "seed42": "app.db",
    "seed43": "data_tuning/app.db",
}

def diagnose(name, db_path):
    if not os.path.exists(db_path):
        print(f"\n[{name}] DB NOT FOUND: {db_path}")
        return
    print(f"\n{'='*80}")
    print(f"SEED: {name}  DB: {db_path}")
    print(f"{'='*80}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # ── 1. The "accused" works: D1-flagged works NOT in P2/P6/P7 labels ──────
    # These are works detected by D1 but whose ground-truth label is NOT P2/P6/P7
    print("\n── [1] D1-flagged works with NON-P2/P6/P7 labels (true FPs) ─────────────────")
    cur.execute("""
        SELECT dr.work_id,
               w.title, w.village, w.lat, w.lon, w.sanctioned_amount, w.status,
               GROUP_CONCAT(DISTINCT fl.pattern) as labels,
               dr.score,
               dr.evidence_json
        FROM detection_results dr
        JOIN works w ON w.id = dr.work_id
        LEFT JOIN fraud_labels fl ON fl.work_id = dr.work_id
        WHERE dr.detector = 'D1'
        GROUP BY dr.work_id
        HAVING (labels IS NULL
                OR (labels NOT LIKE '%P2%' AND labels NOT LIKE '%P6%' AND labels NOT LIKE '%P7%'))
        ORDER BY dr.score DESC
    """)
    rows = cur.fetchall()
    print(f"Count of D1 FPs (not P2/P6/P7): {len(rows)}")
    for r in rows:
        ev = json.loads(r['evidence_json']) if r['evidence_json'] else {}
        print(f"\n  work_id  : {r['work_id']}")
        print(f"  title    : {r['title']!r}")
        print(f"  village  : {r['village']}  lat={r['lat']}  lon={r['lon']}")
        print(f"  amount   : {r['sanctioned_amount']}")
        print(f"  status   : {r['status']}")
        print(f"  labels   : {r['labels']}")
        print(f"  D1 score : {r['score']}")
        # show evidence
        mw = ev.get('matched_with')
        print(f"  matched_with   : {mw}")
        print(f"  similarity     : {ev.get('similarity')}")
        print(f"  geo_distance_km: {ev.get('geo_distance_km')}")
        print(f"  amount_delta   : {ev.get('amount_delta')}")
        print(f"  same_agency    : {ev.get('same_agency')}")
        # look up the partner
        if mw:
            cur2 = conn.cursor()
            cur2.execute("""
                SELECT w.id, w.title, w.village, GROUP_CONCAT(fl.pattern) as labels
                FROM works w LEFT JOIN fraud_labels fl ON fl.work_id = w.id
                WHERE w.id = ?
                GROUP BY w.id
            """, (mw,))
            partner = cur2.fetchone()
            if partner:
                print(f"  partner_id     : {partner['id']}")
                print(f"  partner_title  : {partner['title']!r}")
                print(f"  partner_village: {partner['village']}")
                print(f"  partner_labels : {partner['labels']}")

    # ── 2. Phase-suffix works with all labels ─────────────────────────────────
    print("\n\n── [2] ALL works with 'Phase' in title + their labels ────────────────────────")
    cur.execute("""
        SELECT w.id, w.title, w.village,
               GROUP_CONCAT(DISTINCT fl.pattern) as labels
        FROM works w
        LEFT JOIN fraud_labels fl ON fl.work_id = w.id
        WHERE w.title LIKE '%Phase%'
        GROUP BY w.id
        ORDER BY w.id
    """)
    phase_rows = cur.fetchall()
    print(f"Total Phase-suffix works: {len(phase_rows)}")
    for r in phase_rows:
        print(f"  id={r['id']}  labels={r['labels']!r}  title={r['title']!r}")

    # ── 3. N3 label count + any N3 work that also has a Phase suffix ──────────
    print("\n\n── [3] N3-labeled works – and which have Phase suffix ────────────────────────")
    cur.execute("""
        SELECT w.id, w.title, GROUP_CONCAT(DISTINCT fl.pattern) as labels
        FROM works w
        JOIN fraud_labels fl ON fl.work_id = w.id
        WHERE fl.pattern = 'N3'
        GROUP BY w.id
        ORDER BY w.id
    """)
    n3_rows = cur.fetchall()
    print(f"Total N3-labeled works: {len(n3_rows)}")
    n3_phase = [r for r in n3_rows if 'phase' in (r['title'] or '').lower()]
    print(f"N3-labeled works with Phase in title: {len(n3_phase)}")
    for r in n3_phase:
        print(f"  id={r['id']}  labels={r['labels']!r}  title={r['title']!r}")

    # ── 4. P2 pattern: source vs clone pairing integrity ─────────────────────
    print("\n\n── [4] P2 label pairing integrity ─────────────────────────────────────────────")
    cur.execute("""
        SELECT w.id, w.title, w.village,
               GROUP_CONCAT(DISTINCT fl.pattern) as labels
        FROM works w
        JOIN fraud_labels fl ON fl.work_id = w.id
        WHERE fl.pattern = 'P2'
        GROUP BY w.id
        ORDER BY w.id
    """)
    p2_rows = cur.fetchall()
    print(f"Total P2-labeled works: {len(p2_rows)}")
    sources = [r for r in p2_rows if 'N' not in (r['labels'] or '')]
    clones  = [r for r in p2_rows if 'N' in (r['labels'] or '')]
    print(f"P2 sources (no N label): {len(sources)}")
    print(f"P2 clones (has N label?): {len(clones)}")
    # Check for Phase suffix among P2
    p2_phase = [r for r in p2_rows if 'phase' in (r['title'] or '').lower()]
    print(f"P2 works with Phase in title: {len(p2_phase)}")
    for r in p2_phase:
        print(f"  id={r['id']}  labels={r['labels']!r}  title={r['title']!r}")

    # ── 5. GROUP BY detector counts ────────────────────────────────────────────
    print("\n\n── [5] detection_results: count by detector ──────────────────────────────────")
    cur.execute("SELECT detector, COUNT(*) as cnt FROM detection_results GROUP BY detector ORDER BY detector")
    for r in cur.fetchall():
        print(f"  {r['detector']}: {r['cnt']}")

    # ── 6. Total label counts ──────────────────────────────────────────────────
    print("\n\n── [6] fraud_labels pattern counts ───────────────────────────────────────────")
    cur.execute("SELECT pattern, COUNT(*) as cnt FROM fraud_labels GROUP BY pattern ORDER BY pattern")
    for r in cur.fetchall():
        print(f"  {r['pattern']}: {r['cnt']}")

    conn.close()

for name, db_path in DATABASES.items():
    diagnose(name, db_path)
