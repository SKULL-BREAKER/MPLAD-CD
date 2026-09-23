import pytest
import sqlite3
import pandas as pd
from app.pipeline.detectors.d4 import run_d4
import json

@pytest.fixture
def temp_db(tmp_path):
    db_path = str(tmp_path / "test_d4.db")
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    
    # Create tables
    cursor.execute('''CREATE TABLE fund_flows (
        district_id TEXT, fy TEXT, mp_id TEXT, entitlement REAL, funds_released REAL, expenditure REAL, unspent REAL
    )''')
    cursor.execute('''CREATE TABLE works (
        id TEXT, district_id TEXT, fy TEXT, sanction_date TEXT, sanctioned_amount REAL, expenditure REAL
    )''')
    cursor.execute("CREATE TABLE district_flags (district_id TEXT, flag TEXT, value REAL, evidence_json TEXT)")
    cursor.execute("CREATE TABLE detection_results (work_id TEXT, detector TEXT, score REAL, evidence_json TEXT)")
    
    # Insert data
    cursor.executemany("INSERT INTO fund_flows VALUES (?,?,?,?,?,?,?)", [
        ("D1", "2022-23", "M1", 50000000.0, 50000000.0, 25000000.0, 25000000.0),
        ("D1", "2023-24", "M1", 50000000.0, 50000000.0, 75000000.0, 0.0),
        ("D2", "2022-23", "M2", 50000000.0, 50000000.0, 10000000.0, 40000000.0)
    ]) # D1 total ent=100M, exp=100M -> util=1.0. D2 util=0.2
    
    cursor.executemany("INSERT INTO works VALUES (?,?,?,?,?,?)", [
        ("W1", "D1", "2022-23", "2023-01-15", 100000.0, 100000.0), # Not march
        ("W2", "D1", "2022-23", "2023-03-25", 100000.0, 5000.0),   # March, suppressed
        ("W3", "D1", "2022-23", "2023-03-31", 100000.0, 50000.0)   # March, not suppressed
    ]) # D1 2022-23 rush fraction = 2/3
    
    con.commit()
    con.close()
    
    return db_path

def test_d4(temp_db):
    run_d4(temp_db)
    
    con = sqlite3.connect(temp_db)
    df = pd.read_sql_query("SELECT * FROM district_flags", con)
    con.close()
    
    # utilization
    d1_util = df[(df.district_id == "D1") & (df.flag == "utilization")]
    assert not d1_util.empty
    assert d1_util.iloc[0]["value"] == 1.0
    
    d2_util = df[(df.district_id == "D2") & (df.flag == "utilization")]
    assert not d2_util.empty
    assert d2_util.iloc[0]["value"] == 0.2
    
    # yearend rush
    d1_rush = df[(df.district_id == "D1") & (df.flag == "yearend_rush")]
    assert not d1_rush.empty
    assert abs(d1_rush.iloc[0]["value"] - 0.666) < 0.01
