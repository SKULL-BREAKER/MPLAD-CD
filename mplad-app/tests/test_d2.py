import pytest
import sqlite3
import pandas as pd
from app.pipeline.detectors.d2 import run_d2
import json

@pytest.fixture
def temp_db(tmp_path):
    db_path = str(tmp_path / "test_app.db")
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    cursor.execute('''CREATE TABLE works (
        id TEXT PRIMARY KEY,
        sanctioned_amount REAL,
        physical_qty REAL,
        category TEXT,
        fy TEXT,
        district_id TEXT
    )''')
    
    works = []
    # Create variance so MAD > 0
    # [5, 6, 7, 8, 9, 10, 11, 12, 13] -> median 9, MAD = 2.0
    for i, v in enumerate([5, 6, 7, 8, 9, 10, 11, 12, 13]):
        works.append((f"W{i+1}", v * 10, 10, "CAT1", "2022-23", "D1"))
    # 1 work with per_unit 40
    works.append(("W10", 400, 10, "CAT1", "2022-23", "D1"))
    
    cursor.executemany('''INSERT INTO works VALUES (?,?,?,?,?,?)''', works)
    con.commit()
    con.close()
    return db_path

def test_d2(temp_db):
    run_d2(temp_db)
    con = sqlite3.connect(temp_db)
    df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D2'", con)
    con.close()
    
    # W10 should have z >= 3
    w10_match = df[df.work_id == 'W10']
    assert not w10_match.empty
    z = w10_match.iloc[0]['score']
    assert abs(z) >= 3.0
