import argparse
import sqlite3
import sys
import traceback
from app.pipeline.detectors.d1 import run_d1
from app.pipeline.detectors.d2 import run_d2
from app.pipeline.detectors.d3 import run_d3
from app.pipeline.detectors.d4 import run_d4
from app.pipeline.detectors.d5 import run_d5
from app.pipeline.detectors.d6 import run_d6
from app.pipeline.detectors.d7 import run_d7
from app.pipeline.detectors.d8 import run_d8
from app.pipeline.ensemble import run_ensemble

def main():
    parser = argparse.ArgumentParser(description="Run Detectors D1-D3")
    parser.add_argument("--db", default="data/app.db", help="Path to SQLite database")
    args = parser.parse_args()
    
    try:
        con = sqlite3.connect(args.db)
        con.execute("CREATE TABLE IF NOT EXISTS detection_results (work_id TEXT, detector TEXT, score REAL, evidence_json TEXT)")
        con.execute("CREATE TABLE IF NOT EXISTS district_flags (district_id TEXT, flag TEXT, value REAL, evidence_json TEXT)")
        con.execute("DELETE FROM detection_results")
        con.execute("DELETE FROM district_flags")
        con.commit()
    except Exception as e:
        print(f"CRITICAL ERROR: Database setup failed: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)
    
    try:
        d1_stats = run_d1(args.db)
        print(f"Running D1 (Duplicates)... {d1_stats['works']} works | cache {d1_stats['cache']} | path: {d1_stats['path']} | rows: {d1_stats['rows']}")
    except Exception as e:
        print(f"CRITICAL ERROR: Detector D1 failed: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

    try:
        d2_stats = run_d2(args.db)
        print(f"Running D2 (Cost/Benford)... {d2_stats['z_rows']} z-rows, benford: {d2_stats['benford_districts']} districts evaluated (chi2 stored)")
    except Exception as e:
        print(f"CRITICAL ERROR: Detector D2 failed: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

    try:
        d3_stats = run_d3(args.db)
        print(f"Running D3 (Timeline)... {d3_stats['rows']} rows")
    except Exception as e:
        print(f"CRITICAL ERROR: Detector D3 failed: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

    try:
        run_d4(args.db)
    except Exception as e:
        print(f"CRITICAL ERROR: Detector D4 failed: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

    try:
        run_d5(args.db)
    except Exception as e:
        print(f"CRITICAL ERROR: Detector D5 failed: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

    try:
        run_d6(args.db)
    except Exception as e:
        print(f"CRITICAL ERROR: Detector D6 failed: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

    try:
        run_d7(args.db)
    except Exception as e:
        print(f"CRITICAL ERROR: Detector D7 failed: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

    try:
        run_d8(args.db)
    except Exception as e:
        print(f"CRITICAL ERROR: Detector D8 failed: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

    try:
        run_ensemble(args.db)
    except Exception as e:
        print(f"CRITICAL ERROR: Ensemble failed: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

    try:
        cursor = con.cursor()
        total_rows = cursor.execute("SELECT count(*) FROM detection_results").fetchone()[0]
        print(f"Total detection_results rows: {total_rows}")
        con.close()
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to count rows: {e}", file=sys.stderr)
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
