import pytest
import sqlite3
import pandas as pd
from app.pipeline.detectors.d8 import run_d8
import json

@pytest.fixture
def temp_db(tmp_path):
    db_path = str(tmp_path / "test_d8.db")
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    
    # Create tables
    cursor.execute('''CREATE TABLE works (
        id TEXT, district_id TEXT, agency_id TEXT, title TEXT
    )''')
    cursor.execute("CREATE TABLE detection_results (work_id TEXT, detector TEXT, score REAL, evidence_json TEXT)")
    
    # Insert data
    # A1 is in D1 and D2 with identical titles
    cursor.executemany("INSERT INTO works VALUES (?,?,?,?)", [
        ("W1", "D1", "A1", "Build Road"),
        ("W2", "D2", "A1", "Build Road"),
        ("W3", "D1", "A2", "Other Work")
    ])
    
    con.commit()
    con.close()
    
    yield db_path

def test_d8(temp_db):
    run_d8(temp_db)
    
    con = sqlite3.connect(temp_db)
    df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D8'", con)
    con.close()
    
    w1_res = df[df.work_id == "W1"]
    assert not w1_res.empty
    
    ev = json.loads(w1_res.iloc[0]["evidence_json"])
    assert ev["cross_districts"] == 2
    assert ev["dup_matches"] == 1
    assert "W2" in ev["matched_works"]
