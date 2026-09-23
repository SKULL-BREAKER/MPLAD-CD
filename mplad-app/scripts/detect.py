import argparse
import sqlite3
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
    
    con = sqlite3.connect(args.db)
    con.execute("CREATE TABLE IF NOT EXISTS detection_results (work_id TEXT, detector TEXT, score REAL, evidence_json TEXT)")
    con.execute("CREATE TABLE IF NOT EXISTS district_flags (district_id TEXT, flag TEXT, value REAL, evidence_json TEXT)")
    con.execute("DELETE FROM detection_results")
    con.execute("DELETE FROM district_flags")
    con.commit()
    con.close()
    
    run_d1(args.db)
    run_d2(args.db)
    run_d3(args.db)
    
if __name__ == "__main__":
    main()
