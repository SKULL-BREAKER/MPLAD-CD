import sqlite3
import pandas as pd
import json

def run_d8(db_path):
    print("Running D8 (Network)...")
    con = sqlite3.connect(db_path)
    
    works = pd.read_sql_query("SELECT id, district_id, agency_id, title FROM works ORDER BY id", con)
    if works.empty:
        con.close()
        return
        
    detection_rows = []
    
    # Pre-calculate cross_districts per agency
    agency_districts = works.groupby("agency_id")["district_id"].nunique().to_dict()
    
    # Pre-calculate titles per agency per district
    # To quickly find if the same agency used the same title in a different district
    # We can group by (agency_id, title) and collect districts and work_ids
    
    # A dictionary mapping (agency_id, title) -> list of (work_id, district_id)
    ag_title_map = {}
    for _, w in works.iterrows():
        key = (w['agency_id'], w['title'])
        if key not in ag_title_map:
            ag_title_map[key] = []
        ag_title_map[key].append((w['id'], w['district_id']))
        
    for _, w in works.iterrows():
        wid = w['id']
        ag = w['agency_id']
        dist = w['district_id']
        
        cross_dist = agency_districts.get(ag, 1)
        
        # find duplicates
        key = (ag, w['title'])
        matches = ag_title_map.get(key, [])
        
        # filter for OTHER districts
        other_matches = [m_id for m_id, m_dist in matches if m_dist != dist]
        dup_matches = len(other_matches)
        
        # Storage floor: only meaningful rows
        if cross_dist == 1 and dup_matches == 0:
            continue
            
        score = min(1.0, (cross_dist / 5.0) + (dup_matches / 3.0))
        
        evidence = {
            "agency_id": ag,
            "cross_districts": int(cross_dist),
            "dup_matches": int(dup_matches),
            "matched_works": other_matches
        }
        
        detection_rows.append((
            wid,
            "D8",
            float(score),
            json.dumps(evidence)
        ))
        
    con.executemany("INSERT INTO detection_results (work_id, detector, score, evidence_json) VALUES (?, ?, ?, ?)", detection_rows)
    con.commit()
    con.close()
