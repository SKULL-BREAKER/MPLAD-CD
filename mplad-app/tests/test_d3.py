import pytest
import sqlite3
import pandas as pd
from app.pipeline.detectors.d3 import run_d3
import json
import datetime

@pytest.fixture
def temp_db(tmp_path):
    db_path = str(tmp_path / "test_app.db")
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    cursor.execute('''CREATE TABLE works (
        id TEXT PRIMARY KEY,
        status TEXT,
        sanction_date TEXT,
        start_date TEXT,
        completion_date TEXT,
        sanctioned_amount REAL,
        expenditure REAL
    )''')
    
    # 2024-06-30 is ref_today
    # W1: completed in 8 days
    # W2: sanctioned 500 days ago (2024-06-30 - 500 days = 2023-02-16)
    works = [
        ("W1", "completed", "2023-01-01", "2023-01-02", "2023-01-09", 100000, 100000),
        ("W2", "sanctioned", "2023-02-16", None, None, 100000, 0)
    ]
    
    cursor.executemany('''INSERT INTO works VALUES (?,?,?,?,?,?,?)''', works)
    con.commit()
    con.close()
    return db_path

def test_d3(temp_db):
    run_d3(temp_db, ref_today="2024-06-30")
    con = sqlite3.connect(temp_db)
    df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D3'", con)
    con.close()
    
    w1_match = df[df.work_id == 'W1'].iloc[0]
    assert w1_match['score'] == 8.0
    ev1 = json.loads(w1_match['evidence_json'])
    assert ev1['flash_gap_days'] == 8
    
    w2_match = df[df.work_id == 'W2'].iloc[0]
    assert pd.isnull(w2_match['score']) or w2_match['score'] is None or pd.isna(w2_match['score'])
    ev2 = json.loads(w2_match['evidence_json'])
    assert ev2['not_started_days'] == 500
