import sqlite3
import pandas as pd
import json
import yaml
import re

def run_d7(db_path):
    print("Running D7 (Rules)...")
    con = sqlite3.connect(db_path)
    
    with open("config/rules.yaml", "r") as f:
        rules = yaml.safe_load(f)
        
    works = pd.read_sql_query("SELECT * FROM works ORDER BY id", con)
    if works.empty:
        con.close()
        return
        
    detection_rows = []
    district_flags = []
    
    # Instead of a flat list, we'll collect violations per work
    work_violations = {}
    
    def add_violation(work_id, evidence):
        if work_id not in work_violations:
            work_violations[work_id] = []
        work_violations[work_id].append(evidence)

    # R1: Keywords
    r1_kw = rules.get("R1", {}).get("prohibited_keywords", [])
    if r1_kw:
        pattern = re.compile(r'\b(' + '|'.join(re.escape(k) for k in r1_kw) + r')\b', re.IGNORECASE)
        for _, w in works.iterrows():
            text = f"{w['title']} | {w['description']}"
            match = pattern.search(text)
            if match:
                evidence = {
                    "rule_id": "R1",
                    "keyword": match.group(1),
                    "snippet": text
                }
                add_violation(w['id'], evidence)
                
    # R2: Agency type cap
    trust_cap = rules.get("R2", {}).get("trust_cap", 20000000)
    agencies = pd.read_sql_query("SELECT id as agency_id, agency_type FROM agencies", con)
    w_ag = pd.merge(works, agencies, on="agency_id", how="left")
    
    w_ag['expenditure'] = w_ag['expenditure'].fillna(0.0)
    trust_soc = w_ag[w_ag['agency_type'].isin(['TRUST', 'SOCIETY'])]
    if not trust_soc.empty:
        agency_spend = trust_soc.groupby("agency_id")["expenditure"].sum().reset_index()
        violating_agencies = agency_spend[agency_spend["expenditure"] > trust_cap]
        for _, va in violating_agencies.iterrows():
            ag_id = va['agency_id']
            tot = va['expenditure']
            # Flag all works for this agency
            ag_works = trust_soc[trust_soc['agency_id'] == ag_id]
            for _, aw in ag_works.iterrows():
                evidence = {
                    "rule_id": "R2",
                    "agency_id": ag_id,
                    "total_spend": float(tot),
                    "cap": float(trust_cap)
                }
                add_violation(aw['id'], evidence)
                
    # R3: SC/ST spend share
    sc_min = rules.get("R3", {}).get("sc_min", 15) / 100.0
    st_min = rules.get("R3", {}).get("st_min", 7) / 100.0
    
    dist_spend = works.groupby("district_id")["expenditure"].sum().reset_index()
    sc_spend = works[works['area_type'] == 'SC'].groupby("district_id")["expenditure"].sum().reset_index()
    st_spend = works[works['area_type'] == 'ST'].groupby("district_id")["expenditure"].sum().reset_index()
    
    sc_spend = sc_spend.rename(columns={"expenditure": "sc_spend"})
    st_spend = st_spend.rename(columns={"expenditure": "st_spend"})
    
    r3_df = pd.merge(dist_spend, sc_spend, on="district_id", how="left")
    r3_df = pd.merge(r3_df, st_spend, on="district_id", how="left")
    r3_df = r3_df.fillna(0.0)
    
    for _, row in r3_df.iterrows():
        tot = row['expenditure']
        dist = row['district_id']
        if tot > 0:
            sc_share = row['sc_spend'] / tot
            st_share = row['st_spend'] / tot
            
            if sc_share < sc_min or st_share < st_min:
                evidence = {
                    "rule_id": "R3",
                    "sc_share": float(sc_share),
                    "st_share": float(st_share),
                    "sc_min": float(sc_min),
                    "st_min": float(st_min)
                }
                district_flags.append((dist, "rule_r3", 1.0, json.dumps(evidence)))
                
    # R4: MP jurisdiction
    mps = pd.read_sql_query("SELECT id as mp_id, house, state as mp_state, nodal_districts FROM mps", con)
    districts = pd.read_sql_query("SELECT id as district_id, state as dist_state FROM districts", con)
    
    w_mp = pd.merge(works, mps, on="mp_id", how="left")
    w_mp = pd.merge(w_mp, districts, on="district_id", how="left")
    
    for _, w in w_mp.iterrows():
        house = w['house']
        w_dist = w['district_id']
        if pd.isna(house): continue
        
        flag_r4 = False
        evidence = {}
        if house == 'LS':
            nodal = w.get('nodal_districts', '')
            nodal_list = []
            if pd.notna(nodal):
                try:
                    nodal_list = json.loads(nodal)
                except:
                    nodal_list = [n.strip() for n in str(nodal).split(',')]
            if w_dist not in nodal_list:
                flag_r4 = True
                evidence = {
                    "rule_id": "R4",
                    "mp_house": "LS",
                    "constituency_districts": nodal_list,
                    "work_district": w_dist
                }
        elif house == 'RS':
            w_state = w.get('dist_state', '')
            m_state = w.get('mp_state', '')
            if pd.notna(w_state) and pd.notna(m_state) and w_state != m_state:
                flag_r4 = True
                evidence = {
                    "rule_id": "R4",
                    "mp_house": "RS",
                    "constituency_districts": m_state,
                    "work_district": w_state
                }
                
        if flag_r4:
            add_violation(w['id'], evidence)

    # Convert work_violations into detection_rows
    for wid, ev_list in work_violations.items():
        # Just use the first violation as the main evidence dict, but wrap it or something?
        # Actually, let's just make the evidence a dict containing all rules violated
        # Wait, test_d7.py expects ev["rule_id"] to exist! Let's check test_d7.py.
        # ev1 = json.loads(w1_res.iloc[0]["evidence_json"])
        # assert ev1["rule_id"] == "R1"
        # If I emit multiple violations, how should I format it to pass test_d7.py?
        # Maybe I just pick the first violation as the main evidence, and append the rest?
        # For simplicity, if there's only one, use it. If multiple, use the first one.
        ev_to_save = ev_list[0]
        if len(ev_list) > 1:
            ev_to_save["other_rules"] = [e["rule_id"] for e in ev_list[1:]]
            
        detection_rows.append((wid, "D7", 1.0, json.dumps(ev_to_save)))

    if district_flags:
        con.executemany("INSERT INTO district_flags (district_id, flag, value, evidence_json) VALUES (?, ?, ?, ?)", district_flags)
    if detection_rows:
        con.executemany("INSERT INTO detection_results (work_id, detector, score, evidence_json) VALUES (?, ?, ?, ?)", detection_rows)
        
    con.commit()
    con.close()
