import pytest
import sqlite3
import pandas as pd
from app.pipeline.ensemble import run_ensemble
import json
import os

@pytest.fixture
def temp_db(tmp_path):
    db_path = str(tmp_path / "test_ensemble.db")
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    
    # Create tables
    cursor.execute('''CREATE TABLE works (
        id TEXT, sanctioned_amount REAL, expenditure REAL, sanction_date TEXT, completion_date TEXT
    )''')
    cursor.execute("CREATE TABLE detection_results (work_id TEXT, detector TEXT, score REAL, evidence_json TEXT)")
    
    # Insert data
    cursor.executemany("INSERT INTO works VALUES (?,?,?,?,?)", [
        ("W1", 100000, 100000, "2022-01-01", "2022-02-01"),
        ("W2", 200000, 200000, "2022-01-01", "2022-03-01"),
        ("W3", 500000, 500000, "2022-01-01", "2022-04-01")
    ])
    
    # Fake detection results
    cursor.executemany("INSERT INTO detection_results VALUES (?,?,?,?)", [
        ("W1", "D2", 3.0, "{}"),
        ("W2", "D5", 0.5, "{}")
    ])
    
    con.commit()
    con.close()
    
    # Config
    os.makedirs(tmp_path / "config", exist_ok=True)
    with open(tmp_path / "config" / "detectors.yaml", "w") as f:
        f.write("ensemble:\n  contamination: 0.03\n  random_state: 42\n")
        
    old_cwd = os.getcwd()
    os.chdir(tmp_path)
    
    yield db_path
    
    os.chdir(old_cwd)

def test_ensemble(temp_db):
    run_ensemble(temp_db)
    
    con = sqlite3.connect(temp_db)
    df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='ENSEMBLE'", con)
    con.close()
    
    assert len(df) == 3
    
    w1 = df[df.work_id == "W1"].iloc[0]
    ev1 = json.loads(w1["evidence_json"])
    assert "d2_z" in ev1["feature_values"]
    assert ev1["feature_values"]["d2_z"] == 3.0
