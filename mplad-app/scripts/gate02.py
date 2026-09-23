import json
import os
import subprocess
import hashlib
import sys

def run_cmd(cmd, check=True):
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and res.returncode != 0:
        print(f"Command failed: {cmd}")
        print(res.stdout)
        print(res.stderr)
        sys.exit(1)
    return res

def get_hash(filepath):
    with open(filepath, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()

def main():
    print("--- Running Gate 02 ---")
    
    # Ensure starting clean
    if os.path.exists("reports/eval_dev.json"):
        os.remove("reports/eval_dev.json")
    if os.path.exists("reports/test_lock.json"):
        os.remove("reports/test_lock.json")
        
    # 1. Determinism
    print("Running eval run 1...")
    run_cmd("python -m app.pipeline.eval --db data/app.db --out reports/eval_dev.json")
    if not os.path.exists("reports/eval_dev.json"):
        print("FAIL: reports/eval_dev.json not generated.")
        sys.exit(1)
    hash1 = get_hash("reports/eval_dev.json")
    
    # Save the output to parse
    with open("reports/eval_dev.json", "r") as f:
        eval_data = json.load(f)
        
    os.remove("reports/eval_dev.json")
    
    print("Running eval run 2...")
    run_cmd("python -m app.pipeline.eval --db data/app.db --out reports/eval_dev.json")
    hash2 = get_hash("reports/eval_dev.json")
    
    if hash1 != hash2:
        print("FAIL: Determinism failed. Runs produced different JSONs.")
        sys.exit(1)
    print("PASS: determinism (sha256 identical)")
    
    # 2. Structure and null metrics (since work_risk is empty)
    patterns = eval_data.get("patterns", {})
    if len(patterns) != 10:
        print(f"FAIL: Expected 10 patterns, got {len(patterns)}")
        sys.exit(1)
        
    for p in [f"P{i}" for i in range(1, 11)]:
        if p not in patterns:
            print(f"FAIL: Pattern {p} missing.")
            sys.exit(1)
            
        data = patterns[p]
        if data["support"] <= 0:
            print(f"FAIL: Pattern {p} support is {data['support']}, expected > 0")
            sys.exit(1)
            
        if data["precision"] is not None:
            print(f"FAIL: Pattern {p} precision not null when work_risk is empty.")
            sys.exit(1)
            
        if data["recall"] != 0.0:
            print(f"FAIL: Pattern {p} recall should be 0.0 when work_risk is empty.")
            sys.exit(1)
            
        if data["f1"] != 0.0:
            print(f"FAIL: Pattern {p} f1 should be 0.0 when work_risk is empty.")
            sys.exit(1)
            
    print("PASS: patterns present with support > 0, recall=0.0, precision=null")
    
    # 2.5 Reconciliation Check
    counts = eval_data.get("counts", {})
    confusion = eval_data.get("confusion", {})
    
    confusion_sum = (
        confusion.get("flagged", {}).get("anomaly", 0) +
        confusion.get("flagged", {}).get("innocent", 0) +
        confusion.get("flagged", {}).get("unlabeled", 0) +
        confusion.get("unflagged", {}).get("anomaly", 0) +
        confusion.get("unflagged", {}).get("innocent", 0) +
        confusion.get("unflagged", {}).get("unlabeled", 0)
    )
    
    total_works = counts.get("total_works", 0)
    total_anomaly_labels = counts.get("total_anomaly_labels", 0)
    
    import sqlite3
    con = sqlite3.connect("data/app.db")
    db_works_count = con.execute("SELECT COUNT(*) FROM works").fetchone()[0]
    con.close()
    
    pattern_support_sum = sum(eval_data.get("patterns", {}).get(f"P{i}", {}).get("support", 0) for i in range(1, 11))
    
    if confusion_sum != total_works:
        print(f"FAIL: confusion cells sum ({confusion_sum}) != counts.total_works ({total_works})")
        sys.exit(1)
        
    if total_works != db_works_count:
        print(f"FAIL: counts.total_works ({total_works}) != DB works count ({db_works_count})")
        sys.exit(1)
        
    if pattern_support_sum != total_anomaly_labels:
        print(f"FAIL: sum of pattern supports ({pattern_support_sum}) != counts.total_anomaly_labels ({total_anomaly_labels})")
        sys.exit(1)
        
    print("PASS: reconciliation check (confusion sum == total works == DB works, pattern sum == anomaly labels)")
    
    # 3. Locked behavior
    print("Testing locked eval...")
    run_cmd("python -m app.pipeline.eval --db data/app.db --out reports/test_lock.json --locked")
    if not os.path.exists("reports/test_lock.json"):
        print("FAIL: reports/test_lock.json not created on first locked run.")
        sys.exit(1)
        
    # Run again, should fail
    res = run_cmd("python -m app.pipeline.eval --db data/app.db --out reports/test_lock.json --locked", check=False)
    if res.returncode != 1:
        print(f"FAIL: Locked run should exit 1, but exited {res.returncode}")
        sys.exit(1)
        
    if "LOCKED EVAL EXISTS" not in res.stdout and "LOCKED EVAL EXISTS" not in res.stderr:
        print("FAIL: Did not output LOCKED EVAL EXISTS refusal message.")
        sys.exit(1)
        
    os.remove("reports/test_lock.json")
    print("PASS: locked behavior verified")
    
    with open("reports/gate_log.txt", "a") as f:
        f.write("GATE 02 PASSED: determinism, structure, and locked behavior verified.\n")
        
    print("GATE 02 PASSED.")

if __name__ == "__main__":
    main()
