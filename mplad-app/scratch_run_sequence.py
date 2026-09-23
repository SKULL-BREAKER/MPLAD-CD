#!/usr/bin/env python3
"""Full sequence: regen both seeds, gate01, gate02, detect+eval seed43, pytest, gate03 seed42."""

import subprocess
import sys
import os
import shutil
import json

def run(cmd, check=True, capture=False):
    print(f"\n>>> {cmd}")
    r = subprocess.run(cmd, shell=True, capture_output=capture, text=True)
    if capture:
        print(r.stdout)
        if r.stderr:
            print("STDERR:", r.stderr[:2000])
    if check and r.returncode != 0:
        print(f"FAILED with exit code {r.returncode}")
        sys.exit(r.returncode)
    return r

print("=" * 70)
print("STEP 1: Regenerate BOTH seeds")
print("=" * 70)

# Regen seed 42
os.makedirs("data", exist_ok=True)
run("python seed/generate_dataset.py --seed 42 --out data/")
print("Seed 42 done.")

# Regen seed 43
os.makedirs("data_tuning", exist_ok=True)
run("python seed/generate_dataset.py --seed 43 --out data_tuning/")
print("Seed 43 done.")

print("\n" + "=" * 70)
print("STEP 2: Reload DBs — rebuild from CSVs")
print("=" * 70)

def rebuild_db(csv_dir, db_path):
    import sqlite3, pandas as pd, json
    if os.path.exists(db_path):
        os.remove(db_path)
    con = sqlite3.connect(db_path)
    c = con.cursor()

    works = pd.read_csv(f"{csv_dir}/works.csv")
    mps = pd.read_csv(f"{csv_dir}/mps.csv")
    districts = pd.read_csv(f"{csv_dir}/districts.csv")
    agencies = pd.read_csv(f"{csv_dir}/agencies.csv")
    villages = pd.read_csv(f"{csv_dir}/villages.csv")
    fund_flows = pd.read_csv(f"{csv_dir}/fund_flows.csv")
    work_specs = pd.read_csv(f"{csv_dir}/work_specs.csv")
    fraud_labels = pd.read_csv(f"{csv_dir}/fraud_labels.csv")

    works.to_sql("works", con, if_exists="replace", index=False)
    mps.to_sql("mps", con, if_exists="replace", index=False)
    districts.to_sql("districts", con, if_exists="replace", index=False)
    agencies.to_sql("agencies", con, if_exists="replace", index=False)
    villages.to_sql("villages", con, if_exists="replace", index=False)
    fund_flows.to_sql("fund_flows", con, if_exists="replace", index=False)
    work_specs.to_sql("work_specs", con, if_exists="replace", index=False)
    fraud_labels.to_sql("fraud_labels", con, if_exists="replace", index=False)
    con.commit()
    con.close()
    print(f"  Rebuilt {db_path}: {len(works)} works, {len(fraud_labels)} labels")

rebuild_db("data", "data/app.db")
rebuild_db("data_tuning", "data_tuning/app.db")

print("\n" + "=" * 70)
print("STEP 3: gate01 on BOTH seeds")
print("=" * 70)
run("python scripts/gate01.py --db data/app.db --csv-dir data/", capture=True)
run("python scripts/gate01.py --db data_tuning/app.db --csv-dir data_tuning/", capture=True)

print("\n" + "=" * 70)
print("STEP 4: gate02 on BOTH seeds")
print("=" * 70)
run("python scripts/gate02.py --db data/app.db", capture=True)
run("python scripts/gate02.py --db data_tuning/app.db", capture=True)

print("\n" + "=" * 70)
print("STEP 5: Detect on seed 43")
print("=" * 70)
run("python -m app.pipeline.run --db data_tuning/app.db", capture=True)

print("\n" + "=" * 70)
print("STEP 6: Eval on seed 43")
print("=" * 70)
os.makedirs("reports_tuning", exist_ok=True)
run("python -m app.pipeline.eval --db data_tuning/app.db --out reports_tuning/eval_tuning.json --preset balanced", capture=True)

# Print eval JSON
with open("reports_tuning/eval_tuning.json") as f:
    ev = json.load(f)
print("\n--- EVAL JSON (seed 43) ---")
print(json.dumps(ev, indent=2))

print("\n" + "=" * 70)
print("STEP 7: Detect on seed 42 (for gate03)")
print("=" * 70)
run("python -m app.pipeline.run --db data/app.db", capture=True)

print("\n" + "=" * 70)
print("STEP 8: pytest --collect-only -q")
print("=" * 70)
run("pytest --collect-only -q", capture=True)

print("\n" + "=" * 70)
print("STEP 9: pytest FULL suite")
print("=" * 70)
run("pytest -v", capture=True)
