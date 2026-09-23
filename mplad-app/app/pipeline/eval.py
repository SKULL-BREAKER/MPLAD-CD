import argparse
import json
import os
import sqlite3
import subprocess
from datetime import datetime

from app.pipeline.metrics import compute_metrics

def get_git_sha():
    try:
        sha = subprocess.check_output(["git", "rev-parse", "HEAD"], stderr=subprocess.STDOUT)
        return sha.decode("utf-8").strip()
    except Exception:
        return "unknown"

def main():
    parser = argparse.ArgumentParser(description="Evaluate fraud detection metrics.")
    parser.add_argument("--db", required=True, help="Path to SQLite database")
    parser.add_argument("--out", required=True, help="Path to output JSON file")
    parser.add_argument("--preset", default="balanced", help="Active operating point preset")
    parser.add_argument("--locked", action="store_true", help="Lock evaluation results")
    args = parser.parse_args()
    
    # Ensure reports directory exists
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    
    # Locked constraints
    if args.locked and os.path.exists(args.out):
        force = os.environ.get("FORCE")
        if force != "1":
            print("LOCKED EVAL EXISTS \u2014 results frozen. FORCE=1 to discard (logs to reports/eval_log.txt).")
            exit(1)
        else:
            log_path = os.path.join(os.path.dirname(args.out), "eval_log.txt")
            with open(log_path, "a") as f:
                ts = datetime.utcnow().isoformat() + "Z"
                f.write(f"[{ts}] FORCE=1 discarded locked eval: {args.out}\n")
                
    metrics = compute_metrics(args.db, args.preset)
    
    ts = datetime.utcnow().isoformat() + "Z"
    
    output = {
        "preset": args.preset,
        "git_sha": get_git_sha(),
        "db": args.db,
        "seed": 43 if "tuning" in args.db else 42,
        **metrics
    }
    
    with open(args.out, "w") as f:
        json.dump(output, f, indent=2, sort_keys=True)
        f.write("\n")
        
    print(f"[{ts}] Metrics written to {args.out}")
    
    log_path = os.path.join(os.path.dirname(args.out) or ".", "gate_log.txt")
    with open(log_path, "a") as f:
        f.write(f"[{ts}] make eval ran (preset={args.preset}, sha={output['git_sha']})\n")

if __name__ == "__main__":
    main()
