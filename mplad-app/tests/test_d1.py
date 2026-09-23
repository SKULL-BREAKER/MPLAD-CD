import pytest
import sqlite3
import pandas as pd
from app.pipeline.detectors.d1 import run_d1, haversine
import json
import os
import shutil

@pytest.fixture
def temp_db(tmp_path):
    db_path = str(tmp_path / "test_app.db")
    
    # Set cache dir to temp
    old_cwd = os.getcwd()
    os.chdir(tmp_path)
    os.makedirs("data/cache", exist_ok=True)
    os.makedirs("config", exist_ok=True)
    import shutil
    shutil.copy(os.path.join(old_cwd, "config/operating_points.yaml"), "config/operating_points.yaml")
    
    con = sqlite3.connect(db_path)
    cursor = con.cursor()
    cursor.execute('''CREATE TABLE works (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        sanctioned_amount REAL,
        agency_id TEXT,
        village TEXT,
        district_id TEXT,
        category TEXT,
        fy TEXT,
        lat REAL,
        lon REAL,
        sanction_date TEXT
    )''')
    
    works = [
        # W1 and W2: same district, identical title
        ("W1", "repair road", "repair road desc", 100000, "A1", "V1", "D1", "ROAD", "2022-23", 10.0, 10.0, "2022-01-01"),
        ("W2", "repair road (phase 2)", "repair road desc", 110000, "A1", "V1", "D1", "ROAD", "2022-23", 10.0, 10.0, "2022-01-01"),
        # W3 and W4: slightly different title, different village, 10km apart (mimics N1 innocent)
        ("W3", "build school at V2", "school desc", 200000, "A2", "V2", "D1", "EDU", "2022-23", 20.0, 20.0, "2022-01-01"),
        ("W4", "build school at V3", "school desc", 200000, "A3", "V3", "D1", "EDU", "2022-23", 20.09, 20.0, "2022-01-01"), # ~10km diff in lat
        # P6 pair (identical titles, cross-district, SAME agency) -> bypasses guard
        ("W5", "copy paste fraud", "desc", 100000, "A4", "V4", "D2", "WATER", "2022-23", 30.0, 30.0, "2022-02-01"),
        ("W6", "copy paste fraud", "desc", 100000, "A4", "V5", "D3", "WATER", "2022-23", 31.0, 31.0, "2022-02-01"),
        # P7 group of 4 (all sanctioned within 30 days, < 16L each, total > 25L)
        ("W7", "p7 work 1", "desc", 1300000, "A6", "V6", "D4", "WATER", "2022-03-01", 40.0, 40.0, "2022-03-01"),
        ("W8", "p7 work 2", "desc", 1300000, "A6", "V6", "D4", "WATER", "2022-03-05", 40.0, 40.0, "2022-03-05"),
        ("W9", "p7 work 3", "desc", 1300000, "A6", "V6", "D4", "WATER", "2022-03-10", 40.0, 40.0, "2022-03-10"),
        ("W10", "p7 work 4", "desc", 1300000, "A6", "V6", "D4", "WATER", "2022-03-15", 40.0, 40.0, "2022-03-15"),
    ]
    
    cursor.executemany('''INSERT INTO works VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''', works)
    con.commit()
    con.close()
    
    yield db_path
    
    os.chdir(old_cwd)

def test_d1(temp_db):
    run_d1(temp_db)
    
    con = sqlite3.connect(temp_db)
    df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D1'", con)
    
    # W1 and W2 should match highly
    w1_match = df[(df.work_id == 'W1')]
    assert not w1_match.empty
    
    # Check if they matched each other
    matched = False
    for _, row in w1_match.iterrows():
        ev = json.loads(row['evidence_json'])
        if ev['matched_with'] == 'W2':
            assert row['score'] >= 0.80
            matched = True
            break
    assert matched
    
    # W3 and W4 guarded
    w3_match = df[(df.work_id == 'W3')]
    w3_w4_matched = False
    for _, row in w3_match.iterrows():
        ev = json.loads(row['evidence_json'])
        if ev['matched_with'] == 'W4':
            assert row['score'] <= 0.69
            w3_w4_matched = True
            break
    # Because <0.70 are not stored, W3-W4 might not exist in df!
    assert not w3_w4_matched, "Guarded matches shouldn't be >= 0.70"

    # P6 check
    w5_match = df[(df.work_id == 'W5')]
    w5_w6_matched = False
    for _, row in w5_match.iterrows():
        ev = json.loads(row['evidence_json'])
        if ev['matched_with'] == 'W6':
            assert row['score'] >= 0.92
            w5_w6_matched = True
            break
    assert w5_w6_matched, "P6 pair (identical titles, cross-district) should match >= 0.92"
    
    # P7 check
    split_df = pd.read_sql_query("SELECT * FROM detection_results WHERE detector='D1_split'", con)
    con.close()
    
    p7_works = ['W7', 'W8', 'W9', 'W10']
    flagged_p7 = split_df[split_df.work_id.isin(p7_works)]
    assert len(flagged_p7) == 4, f"Expected all 4 P7 works to be flagged, got {len(flagged_p7)}"
