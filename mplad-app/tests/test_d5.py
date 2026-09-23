import pytest
import sqlite3
import pandas as pd
from app.pipeline.detectors.d5 import run_d5
import json

@pytest.fixture
def temp_db(tmp_path):
    db_path = str(tmp_path / "test_d5.db")
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    
    # Create tables
    cursor.execute('''CREATE TABLE works (
        id TEXT, district_id TEXT, agency_id TEXT, expenditure REAL
    )''')
    cursor.execute("CREATE TABLE district_flags (district_id TEXT, flag TEXT, value REAL, evidence_json TEXT)")
    cursor.execute("CREATE TABLE detection_results (work_id TEXT, detector TEXT, score REAL, evidence_json TEXT)")
    
    # Insert data
    # District D1: Total exp = 100. A1 exp = 30 (share=0.30), A2 exp = 70 (share=0.70)
    cursor.executemany("INSERT INTO works VALUES (?,?,?,?)", [
        ("W1", "D1", "A1", 30.0), # P5 injection simulates large share
        ("W2", "D1", "A2", 40.0),
        ("W3", "D1", "A2", 30.0),
        # District D2: Total exp = 0
        ("W4", "D2", "A3", 0.0)
    ])
    
    con.commit()
    con.close()
    
    # Need config/detectors.yaml mock
    import os
    os.makedirs(tmp_path / "config", exist_ok=True)
    with open(tmp_path / "config" / "detectors.yaml", "w") as f:
        f.write("d5:\n  storage_floor: 0.10\n")
        
    old_cwd = os.getcwd()
    os.chdir(tmp_path)
    
    yield db_path
    
    os.chdir(old_cwd)

def test_d5(temp_db):
    run_d5(temp_db)
    
    con = sqlite3.connect(temp_db)
    df_flags = pd.read_sql_query("SELECT * FROM district_flags WHERE flag='hhi'", con)
    df_det = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D5'", con)
    con.close()
    
    # HHI for D1 = 0.3^2 + 0.7^2 = 0.09 + 0.49 = 0.58
    hhi_d1 = df_flags[df_flags.district_id == "D1"]
    assert not hhi_d1.empty
    assert abs(hhi_d1.iloc[0]["value"] - 0.58) < 0.001
    
    # Check works
    w1_res = df_det[df_det.work_id == "W1"]
    assert not w1_res.empty
    assert w1_res.iloc[0]["score"] == 0.30
    
    w4_res = df_det[df_det.work_id == "W4"]
    assert w4_res.empty # score is 0, below storage floor
