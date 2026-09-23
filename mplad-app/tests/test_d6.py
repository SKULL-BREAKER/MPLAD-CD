import pytest
import sqlite3
import pandas as pd
from app.pipeline.detectors.d6 import run_d6
import json

@pytest.fixture
def temp_db(tmp_path):
    db_path = str(tmp_path / "test_d6.db")
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    
    # Create tables
    cursor.execute('''CREATE TABLE works (
        id TEXT, district_id TEXT, lat REAL, lon REAL, status TEXT, sanctioned_amount REAL, expenditure REAL, category TEXT, fy TEXT, village TEXT
    )''')
    cursor.execute('''CREATE TABLE villages (
        id TEXT, district_id TEXT, name TEXT, lat REAL, lon REAL
    )''')
    cursor.execute("CREATE TABLE detection_results (work_id TEXT, detector TEXT, score REAL, evidence_json TEXT)")
    
    # Insert data
    # D1, V1 at (10.0, 10.0)
    cursor.executemany("INSERT INTO villages VALUES (?,?,?,?,?)", [
        ("V1", "D1", "Village 1", 10.0, 10.0)
    ])
    
    # W1: Same spot as V1 -> dist = 0.
    # W2: P1 injection -> way off. (10.1, 10.1) is approx 15km away
    cursor.executemany("INSERT INTO works VALUES (?,?,?,?,?,?,?,?,?,?)", [
        ("W1", "D1", 10.0, 10.0, "completed", 100000, 100000, "ROAD", "2022-23", "Village 1"),
        ("W2", "D1", 10.1, 10.1, "completed", 100000, 100000, "ROAD", "2022-23", "Village 1"), # ghost
        # W3 & W4: close to each other (DBSCAN overlap)
        ("W3", "D1", 10.0, 10.0, "completed", 100000, 100000, "EDU", "2022-23", "Village 1"),
        ("W4", "D1", 10.0001, 10.0001, "completed", 100000, 100000, "EDU", "2023-24", "Village 1") # overlapping fy, same cat, within 300m
    ])
    
    con.commit()
    con.close()
    
    # Need config/detectors.yaml mock
    import os
    os.makedirs(tmp_path / "config", exist_ok=True)
    with open(tmp_path / "config" / "detectors.yaml", "w") as f:
        f.write("d6:\n  storage_floor_km: 3.0\n")
        
    old_cwd = os.getcwd()
    os.chdir(tmp_path)
    
    yield db_path
    
    os.chdir(old_cwd)

def test_d6(temp_db):
    run_d6(temp_db)
    
    con = sqlite3.connect(temp_db)
    df = pd.read_sql_query("SELECT * FROM detection_results", con)
    con.close()
    
    # Check Ghost
    w2_res = df[(df.work_id == "W2") & (df.detector == "D6")]
    assert not w2_res.empty
    assert w2_res.iloc[0]["score"] >= 8.0 # 10.1, 10.1 from 10.0, 10.0 is ~15.6km
    
    w1_res = df[(df.work_id == "W1") & (df.detector == "D6")]
    assert w1_res.empty # dist 0 < 3.0
    
    # Check overlap
    overlap = df[(df.work_id == "W3") & (df.detector == "D6_overlap")]
    assert not overlap.empty
    
    overlap_w4 = df[(df.work_id == "W4") & (df.detector == "D6_overlap")]
    assert not overlap_w4.empty
