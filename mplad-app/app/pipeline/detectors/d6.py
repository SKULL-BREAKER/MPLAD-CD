import sqlite3
import pandas as pd
import numpy as np
import json
import yaml
from sklearn.cluster import DBSCAN
from app.pipeline.detectors.d1 import haversine

def run_d6(db_path):
    print("Running D6 (Geo)...")
    con = sqlite3.connect(db_path)
    
    with open("config/detectors.yaml", "r") as f:
        conf = yaml.safe_load(f)
        
    storage_floor = conf.get("d6", {}).get("storage_floor_km", 3.0)
    
    works_df = pd.read_sql_query("SELECT id, district_id, lat, lon, status, sanctioned_amount, expenditure, category, fy, village FROM works", con)
    villages_df = pd.read_sql_query("SELECT id, district_id, name, lat as centroid_lat, lon as centroid_lon FROM villages", con)
    
    if works_df.empty:
        con.close()
        return
        
    detection_rows = []
    
    for dist_id, dist_works in works_df.groupby("district_id"):
        dist_villages = villages_df[villages_df.district_id == dist_id]
        
        # DBSCAN overlap logic
        # Convert lat/lon to radians for haversine
        coords = np.radians(dist_works[['lat', 'lon']].values)
        if len(coords) >= 2:
            eps_rad = 300 / (6371 * 1000) # 300 meters
            db = DBSCAN(eps=eps_rad, min_samples=2, metric='haversine').fit(coords)
            dist_works = dist_works.copy()
            dist_works['cluster'] = db.labels_
            
            # Find clusters with same category and FY overlap +/- 1
            for cluster_id, cluster_group in dist_works[dist_works['cluster'] != -1].groupby('cluster'):
                if len(cluster_group) >= 2:
                    # Check pairs within the cluster for overlap
                    # O(n^2) but n is small (points within 300m)
                    rows = cluster_group.to_dict("records")
                    caught_ids = set()
                    
                    for i in range(len(rows)):
                        for j in range(i+1, len(rows)):
                            w1 = rows[i]
                            w2 = rows[j]
                            
                            if w1['category'] == w2['category']:
                                fy1 = int(w1['fy'][:4])
                                fy2 = int(w2['fy'][:4])
                                if abs(fy1 - fy2) <= 1:
                                    caught_ids.add(w1['id'])
                                    caught_ids.add(w2['id'])
                                    
                    # Emit D6_overlap for all caught works in this cluster
                    if caught_ids:
                        member_ids = sorted(list(caught_ids))
                        cats = sorted(list(set(r['category'] for r in rows if r['id'] in caught_ids)))
                        
                        evidence = {
                            "cluster_members": member_ids,
                            "categories": cats
                        }
                        
                        for wid in caught_ids:
                            detection_rows.append((
                                wid,
                                "D6_overlap",
                                1.0,
                                json.dumps(evidence)
                            ))
                            
        # Ghost distance logic
        if not dist_villages.empty:
            v_lats = dist_villages['centroid_lat'].values
            v_lons = dist_villages['centroid_lon'].values
            v_names = dist_villages['name'].values
            
            for _, w in dist_works.iterrows():
                # vectorize haversine for this work against all villages
                # formula from d1.py haversine:
                # it's just a loop, let's just do a loop since it's simple enough
                own_village = dist_villages[dist_villages['name'] == w['village']]
                if not own_village.empty:
                    v = own_village.iloc[0]
                    nearest_village = v['name']
                    min_dist = haversine(w['lat'], w['lon'], v['centroid_lat'], v['centroid_lon'])
                else:
                    min_dist = float('inf')
                    nearest_village = None
                    for v_lat, v_lon, v_name in zip(v_lats, v_lons, v_names):
                        d = haversine(w['lat'], w['lon'], v_lat, v_lon)
                        if d < min_dist:
                            min_dist = d
                            nearest_village = v_name
                        
                if min_dist >= storage_floor:
                    # spend ratio
                    exp = w['expenditure'] if pd.notna(w['expenditure']) else 0.0
                    sanc = w['sanctioned_amount'] if pd.notna(w['sanctioned_amount']) and w['sanctioned_amount'] > 0 else 1.0
                    spend_ratio = exp / sanc
                    
                    evidence = {
                        "distance_km": float(min_dist),
                        "nearest_village": nearest_village,
                        "status": w['status'],
                        "spend_ratio": float(spend_ratio),
                        "own_village_distance": float(min_dist)
                    }
                    detection_rows.append((
                        w['id'],
                        "D6",
                        float(min_dist),
                        json.dumps(evidence)
                    ))
                    
    con.executemany("INSERT INTO detection_results (work_id, detector, score, evidence_json) VALUES (?, ?, ?, ?)", detection_rows)
    con.commit()
    con.close()
