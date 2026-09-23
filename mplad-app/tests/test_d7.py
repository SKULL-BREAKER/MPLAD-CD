import pytest
import sqlite3
import pandas as pd
from app.pipeline.detectors.d7 import run_d7
import json
import os

@pytest.fixture
def temp_db(tmp_path):
    db_path = str(tmp_path / "test_d7.db")
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    
    # Create tables
    cursor.execute('''CREATE TABLE works (
        id TEXT, district_id TEXT, title TEXT, description TEXT, agency_id TEXT, area_type TEXT, expenditure REAL, mp_id TEXT
    )''')
    cursor.execute("CREATE TABLE agencies (id TEXT, agency_type TEXT)")
    cursor.execute("CREATE TABLE districts (id TEXT, state TEXT)")
    cursor.execute("CREATE TABLE mps (id TEXT, house TEXT, state TEXT, nodal_districts TEXT)")
    cursor.execute("CREATE TABLE detection_results (work_id TEXT, detector TEXT, score REAL, evidence_json TEXT)")
    cursor.execute("CREATE TABLE district_flags (district_id TEXT, flag TEXT, value REAL, evidence_json TEXT)")
    
    # Insert data
    cursor.executemany("INSERT INTO works VALUES (?,?,?,?,?,?,?,?)", [
        ("W1", "D1", "Building a TEMPLE", "Near village", "A1", "GEN", 100, "M1"), # R1 violation
        ("W2", "D1", "Road", "repair", "A2", "GEN", 30000000, "M2") # R2 violation for A2
    ])
    cursor.executemany("INSERT INTO agencies VALUES (?,?)", [
        ("A1", "GOVT"),
        ("A2", "TRUST")
    ])
    
    con.commit()
    con.close()
    
    # Config
    os.makedirs(tmp_path / "config", exist_ok=True)
    with open(tmp_path / "config" / "rules.yaml", "w") as f:
        f.write("R1:\n  prohibited_keywords:\n    - temple\nR2:\n  trust_cap: 20000000\n")
        
    old_cwd = os.getcwd()
    os.chdir(tmp_path)
    
    yield db_path
    
    os.chdir(old_cwd)

def test_d7(temp_db):
    run_d7(temp_db)
    
    con = sqlite3.connect(temp_db)
    df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D7'", con)
    con.close()
    
    # Check R1
    w1_res = df[df.work_id == "W1"]
    assert not w1_res.empty
    ev1 = json.loads(w1_res.iloc[0]["evidence_json"])
    assert ev1["rule_id"] == "R1"
    
    # Check R2
    w2_res = df[df.work_id == "W2"]
    assert not w2_res.empty
    ev2 = json.loads(w2_res.iloc[0]["evidence_json"])
    assert ev2["rule_id"] == "R2"
