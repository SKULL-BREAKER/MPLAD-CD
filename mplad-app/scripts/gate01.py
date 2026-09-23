#!/usr/bin/env python3
import json
import sqlite3
import subprocess
import sys
import hashlib
from pathlib import Path

# Load config
CONFIG_FILE = Path("config/gate.json")
if not CONFIG_FILE.exists():
    print("FAIL: config/gate.json not found")
    sys.exit(1)

with open(CONFIG_FILE) as f:
    config = json.load(f)

success = True

def check(name, condition, msg):
    global success
    if condition:
        print(f"PASS: {name} ({msg})")
    else:
        print(f"FAIL: {name} ({msg})")
        success = False

print("--- Running Gate 01 ---")

# 1. Determinism
import tempfile
import shutil

target_dir = sys.argv[1] if len(sys.argv) > 1 else "data"
db_path = Path(target_dir) / "app.db"

with tempfile.TemporaryDirectory() as td1, tempfile.TemporaryDirectory() as td2:
    subprocess.run(["python", "seed/generate_dataset.py", "--seed", "42", "--out", td1], capture_output=True)
    subprocess.run(["python", "seed/generate_dataset.py", "--seed", "42", "--out", td2], capture_output=True)
    
    hash1 = hashlib.sha256()
    for f in sorted(Path(td1).glob("*.csv")):
        hash1.update(f.read_bytes())
    
    hash2 = hashlib.sha256()
    for f in sorted(Path(td2).glob("*.csv")):
        hash2.update(f.read_bytes())
        
    check("determinism", hash1.digest() == hash2.digest(), "sha256 identically matches across runs")

con = sqlite3.connect(db_path)

# works 2000-4000
works_count = con.execute("SELECT count(*) FROM works").fetchone()[0]
check("works_count", config["works_min"] <= works_count <= config["works_max"], f"{works_count} works")

# total sanctioned
tot_amt = con.execute("SELECT sum(sanctioned_amount) FROM works").fetchone()[0]
tot_cr = tot_amt / 1e7
check("total_sanctioned", config["sanctioned_cr_min"] <= tot_cr <= config["sanctioned_cr_max"], f"Rs {tot_cr:.0f} cr")

# overshoot
import pandas as pd
df = pd.read_sql("SELECT mp_id, fy, sum(sanctioned_amount) as amt FROM works GROUP BY mp_id, fy", con)
FY_ENT = {"2019-20": 5.0e7, "2020-21": 0.0, "2021-22": 2.0e7, "2022-23": 5.0e7, "2023-24": 5.0e7}
df['ent'] = df['fy'].map(FY_ENT)
df = df[df['ent'] > 0]
df['overshoot'] = df['amt'] / df['ent']
max_over = df['overshoot'].max()
check("max_overshoot", max_over <= config["max_overshoot"], f"{max_over:.2f}x <= {config['max_overshoot']}")

# core pipeline tables (detection_results/district_flags added by detectors)
tables = [r[0] for r in con.execute('SELECT name FROM sqlite_master WHERE type="table"')]
check("N_tables", len(tables) >= 8, f"{len(tables)} tables")

# Label Integrity
counts = pd.read_sql("SELECT pattern, count(*) as c FROM fraud_labels GROUP BY pattern", con).set_index('pattern')['c'].to_dict()
exact_counts = {'P1':30, 'P2':119, 'P3':80, 'P4':100, 'P7':80, 'P8':25, 'P9':25, 'N1':150, 'N2':40, 'N3':80, 'N4':100, 'N5':40}
ranges = {'P5':(90,130), 'P6':(40,60), 'P10':(50,80)}
labels_ok = True
for p, exp in exact_counts.items():
    if counts.get(p, 0) != exp:
        print(f"LABEL FAIL: {p} expected {exp}, got {counts.get(p, 0)}")
        labels_ok = False
for p, (mn, mx) in ranges.items():
    if not (mn <= counts.get(p, 0) <= mx):
        print(f"LABEL FAIL: {p} expected {mn}-{mx}, got {counts.get(p, 0)}")
        labels_ok = False
check("label_integrity", labels_ok, "exact and range counts match")

# orphan labels 0
orphans = con.execute('SELECT COUNT(*) FROM fraud_labels fl WHERE NOT EXISTS (SELECT 1 FROM works w WHERE w.id=fl.work_id)').fetchone()[0]
check("orphan_labels", orphans == 0, f"{orphans} orphans")

# no contradictory labels
contradictory = con.execute('''
    SELECT COUNT(*) FROM (
        SELECT work_id FROM fraud_labels 
        GROUP BY work_id 
        HAVING SUM(CASE WHEN label_class='innocent' THEN 1 ELSE 0 END) > 0 
           AND SUM(CASE WHEN label_class!='innocent' THEN 1 ELSE 0 END) > 0
    )
''').fetchone()[0]
check("contradictory_labels", contradictory == 0, f"{contradictory} works have contradictory labels")


if success:
    print("GATE 01 PASSED.")
    sys.exit(0)
else:
    print("GATE 01 FAILED.")
    sys.exit(1)
