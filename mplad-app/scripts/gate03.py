import os
import sys
import subprocess
import json
import sqlite3
import hashlib
from datetime import datetime

def check(name, condition, msg=""):
    if not condition:
        print(f"FAIL: {name} ({msg})")
        sys.exit(1)
    else:
        print(f"PASS: {name}")

def run_tests():
    print("--- Running Tests ---")
    res = subprocess.run(["python", "-m", "pytest", "tests/"], capture_output=True, text=True)
    check("pytest_full_suite", res.returncode == 0, f"pytest failed:\n{res.stdout}\n{res.stderr}")
    return res.stdout

def check_targets(ev):
    print("--- Checking Targets ---")
    det_met = ev.get("detector_metrics", {})
    check("has_detector_metrics", bool(det_met), "detector_metrics missing")
    
    p2 = det_met.get("P2", {})
    check("p2_target", p2.get("recall", 0) >= 0.90 and p2.get("precision", 0) >= 0.90, f"P2 recall = {p2.get('recall')}, precision = {p2.get('precision')}")
    
    p4 = det_met.get("P4", {})
    check("p4_target", p4.get("recall", 0) == 1.00 and p4.get("precision", 0) == 1.00, f"P4 recall = {p4.get('recall')}, precision = {p4.get('precision')}")
    
    p9 = det_met.get("P9", {})
    check("p9_target", p9.get("recall", 0) == 1.00 and p9.get("precision", 0) == 1.00, f"P9 recall = {p9.get('recall')}, precision = {p9.get('precision')}")
    
    p3 = det_met.get("P3", {})
    check("p3_target", p3.get("recall", 0) >= 0.80 and p3.get("precision", 0) >= 0.85, f"P3 recall = {p3.get('recall')}, precision = {p3.get('precision')}")
    
    p7 = det_met.get("P7", {})
    check("p7_target", p7.get("recall", 0) >= 0.90, f"P7 recall = {p7.get('recall')}")
    
    p6 = det_met.get("P6", {})
    check("p6_target", p6.get("recall", 0) >= 0.85, f"P6 recall = {p6.get('recall')}")

def check_sql():
    print("--- Checking SQL ---")
    con = sqlite3.connect("data/app.db")
    count = con.execute("SELECT COUNT(*) FROM detection_results WHERE evidence_json IS NULL OR evidence_json = ''").fetchone()[0]
    check("evidence_json_present", count == 0, f"{count} rows missing evidence_json")
    
    res = con.execute("SELECT * FROM detection_results ORDER BY work_id, detector, score").fetchall()
    h = hashlib.sha256(str(res).encode('utf-8')).hexdigest()
    con.close()
    return h

def check_cache():
    print("--- Checking Cache ---")
    con = sqlite3.connect("data/app.db")
    con.execute("DELETE FROM detection_results")
    con.commit()
    con.close()
    
    env = os.environ.copy()
    env["PYTHONPATH"] = "."
    # Run detect first time
    res1 = subprocess.run(["python", "-m", "app.pipeline.run", "--db", "data/app.db"], capture_output=True, text=True, env=env)
    check("first_run_success", res1.returncode == 0, f"First run failed:\n{res1.stderr}")
    hash1 = check_sql()
    
    con = sqlite3.connect("data/app.db")
    con.execute("DELETE FROM detection_results")
    con.commit()
    con.close()
    
    # Run detect second time
    res2 = subprocess.run(["python", "-m", "app.pipeline.run", "--db", "data/app.db"], capture_output=True, text=True, env=env)
    check("second_run_success", res2.returncode == 0, f"Second run failed:\n{res2.stderr}")
    check("cache_hit_logged", "cache HIT" in res2.stdout, f"cache HIT not logged. Output: {res2.stdout}")
    
    hash2 = check_sql()
    check("cache_determinism", hash1 == hash2, "detection_results differ across runs")
    
    return res1.stdout, res2.stdout

def main():
    print("--- Running Gate 03 ---")
    pytest_out = run_tests()
    
    # Check cache and get logs
    detect1_out, detect2_out = check_cache()
    
    # Eval
    subprocess.run(["python", "-m", "app.pipeline.eval", "--db", "data/app.db", "--out", "reports/eval_dev.json"])
    with open("reports/eval_dev.json", "r") as f:
        ev = json.load(f)
        
    check_targets(ev)
    
    # Git hash
    git_hash = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    
    ts = datetime.utcnow().isoformat() + "Z"
    with open("reports/gate_log.txt", "a") as f:
        f.write(f"[{ts}] GATE 03 PASSED.\n")
        
    print("GATE 03 PASSED.")
    print("\n--- RECEIPTS ---")
    print("1. Pytest Output:")
    print(pytest_out)
    print("2. Eval JSON (detector_metrics):")
    print(json.dumps(ev.get("detector_metrics", {}), indent=2))
    print("3. Detect Run 1 Output:")
    print(detect1_out.strip())
    print("4. Detect Run 2 Output (Cache Check):")
    print(detect2_out.strip())
    print("5. Git HEAD:")
    print(git_hash)
    
    sys.exit(0)

if __name__ == "__main__":
    main()
