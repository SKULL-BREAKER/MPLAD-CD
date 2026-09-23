import os, sqlite3, pandas as pd

def rebuild_db(csv_dir, db_path):
    if os.path.exists(db_path):
        os.remove(db_path)
    con = sqlite3.connect(db_path)
    for tbl, fname in [
        ("works", "works.csv"), ("mps", "mps.csv"), ("districts", "districts.csv"),
        ("agencies", "agencies.csv"), ("villages", "villages.csv"),
        ("fund_flows", "fund_flows.csv"), ("work_specs", "work_specs.csv"),
        ("fraud_labels", "fraud_labels.csv")
    ]:
        df = pd.read_csv(f"{csv_dir}/{fname}")
        df.to_sql(tbl, con, if_exists="replace", index=False)
    con.commit(); con.close()
    print(f"Rebuilt {db_path}")

rebuild_db("data", "data/app.db")
rebuild_db("data_tuning", "data_tuning/app.db")
