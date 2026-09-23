import argparse
import sqlite3
import pandas as pd
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--csv", default="data/")
ap.add_argument("--db", default="data/app.db")
args = ap.parse_args()

csv_dir = Path(args.csv)
db_path = Path(args.db)

if not csv_dir.exists():
    print(f"Error: Directory {csv_dir} does not exist.")
    exit(1)

# Ensure DB directory exists
db_path.parent.mkdir(parents=True, exist_ok=True)

print(f"Loading CSVs from {csv_dir} into {db_path}...")
con = sqlite3.connect(db_path)

tables = [
    "districts", "mps", "agencies", "villages", 
    "works", "fund_flows", "work_specs", "fraud_labels"
]

for table in tables:
    csv_file = csv_dir / f"{table}.csv"
    if csv_file.exists():
        df = pd.read_csv(csv_file)
        # We replace any existing tables to ensure a clean slate
        df.to_sql(table, con, if_exists="replace", index=False)
        print(f"Loaded {len(df)} rows into {table}")
    else:
        print(f"Warning: {csv_file} not found.")

con.close()
print("DB Load Complete!")
