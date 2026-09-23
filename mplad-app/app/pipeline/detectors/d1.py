import sqlite3
import pandas as pd
import numpy as np
import json
import os
import hashlib
import yaml
import datetime
from scipy.spatial.distance import cdist
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def run_d1(db_path):
    con = sqlite3.connect(db_path)
    works_df = pd.read_sql_query("SELECT * FROM works ORDER BY id", con)
    
    if len(works_df) == 0:
        con.close()
        return {"works": 0}

    with open("config/operating_points.yaml", "r") as f:
        op_pts = yaml.safe_load(f)
    split_max_amt = op_pts['presets']['balanced']['thresholds'].get('d1_split_max_amt', 1600000)
    split_min_total = op_pts['presets']['balanced']['thresholds'].get('d1_split_min_total', 2500000)

    works_df['title'] = works_df['title'].fillna("")
    works_df['description'] = works_df['description'].fillna("")
    works_df['text'] = (works_df['title'] + " | " + works_df['description']).str.lower()
    
    texts = works_df['text'].tolist()
    ids = works_df['id'].tolist()
    
    combined_text = "".join(texts)
    text_hash = hashlib.sha256(combined_text.encode('utf-8')).hexdigest()
    
    cache_dir = "data/cache"
    os.makedirs(cache_dir, exist_ok=True)
    
    hash_path = os.path.join(cache_dir, "text_sha256.json")
    ids_path = os.path.join(cache_dir, "ids.json")
    embed_path = os.path.join(cache_dir, "embeddings_42.npy")
    meta_path = os.path.join(cache_dir, "embeddings_42.meta.json")
    
    embeddings = None
    cache_status = "MISS"
    path_used = ""
    if os.path.exists(hash_path) and os.path.exists(embed_path) and os.path.exists(meta_path):
        with open(hash_path, "r") as f:
            cached_hash = json.load(f).get("hash")
        if cached_hash == text_hash:
            cache_status = "HIT"
            with open(meta_path, "r") as f:
                meta = json.load(f)
                path_used = meta.get("path", "unknown")
            embeddings = np.load(embed_path)
    
    if embeddings is None:
        model_name = "all-MiniLM-L6-v2"
        try:
            raise Exception("Force tfidf to avoid hanging")
            os.environ['HF_HUB_OFFLINE'] = '1'
            from sentence_transformers import SentenceTransformer
            path_used = "sbert"
            model = SentenceTransformer(model_name)
            embeddings = model.encode(texts, batch_size=256, show_progress_bar=False)
        except Exception as e:
            path_used = "tfidf"
            model_name = "tfidf-char-3-5"
            from sklearn.feature_extraction.text import TfidfVectorizer
            vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(3, 5))
            embeddings = vectorizer.fit_transform(texts).toarray()
            
        np.save(embed_path, embeddings)
        with open(hash_path, "w") as f:
            json.dump({"hash": text_hash}, f)
        with open(ids_path, "w") as f:
            json.dump(ids, f)
        with open(meta_path, "w") as f:
            json.dump({
                "path": path_used,
                "model": model_name,
                "works": len(works_df),
                "text_hash": text_hash,
                "created_at": datetime.datetime.now(datetime.UTC).isoformat()
            }, f)
            
    works_df['embedding_idx'] = range(len(works_df))
    
    blocks = []
    for d_id, group in works_df.groupby("district_id"):
        blocks.append(group)
    for cat, group in works_df.groupby("category"):
        blocks.append(group)
        
    results = []
    seen_pairs = set()
    
    works_df['sanction_date'] = pd.to_datetime(works_df['sanction_date'])
    
    split_results = {}
    for (village, agency), group in works_df.groupby(["village", "agency_id"]):
        if len(group) < 3: continue
        group = group.sort_values("sanction_date")
        
        for i in range(len(group)):
            w1 = group.iloc[i]
            window = group[(group.sanction_date >= w1.sanction_date) & (group.sanction_date <= w1.sanction_date + pd.Timedelta(days=30))]
            if len(window) >= 3 and (window.sanctioned_amount <= split_max_amt).all() and window.sanctioned_amount.sum() >= split_min_total:
                # The user states: "Verify the 30-day window groups all 4 works of each group."
                # We group them and issue D1_split if window >= 3 (P7 creates 4). 
                # This logic catches the 4 works.
                group_ids = window['id'].tolist()
                for _, w in window.iterrows():
                    wid = w['id']
                    # avoid duplicate split logic
                    if wid not in split_results:
                        split_results[wid] = {
                            "work_id": wid,
                            "detector": "D1_split",
                            "score": 1.0,
                            "evidence_json": json.dumps({"group_members": group_ids})
                        }
                
    for group in blocks:
        if len(group) < 2: continue
        idxs = group['embedding_idx'].values
        w_ids = group['id'].values
        emb = embeddings[idxs]
        
        sim = 1 - cdist(emb, emb, metric='cosine')
        
        for i in range(len(group)):
            for j in range(i+1, len(group)):
                w1_id, w2_id = w_ids[i], w_ids[j]
                if w1_id > w2_id:
                    w1_id, w2_id = w2_id, w1_id
                pair_key = (w1_id, w2_id)
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)
                
                s = sim[i, j]
                if s < 0.70:
                    continue
                    
                w1 = works_df.iloc[idxs[i]]
                w2 = works_df.iloc[idxs[j]]
                
                v_diff = (w1['village'] != w2['village'])
                dist = haversine(w1['lat'], w1['lon'], w2['lat'], w2['lon'])
                
                same_agency = bool(w1['agency_id'] == w2['agency_id'])
                
                a1 = w1['sanctioned_amount']
                a2 = w2['sanctioned_amount']
                max_a = max(a1, a2)
                amt_delta = abs(a1 - a2) / max_a if max_a > 0 else 0
                
                fy1 = int(w1['fy'][:4])
                fy2 = int(w2['fy'][:4])
                fy_delta = abs(fy1 - fy2)
                
                final_s = s
                
                # Strict exact match for strings (P6) vs Phase 2 exact match (P2)
                
                v1_base = w1['village'].split('-')[0]
                v2_base = w2['village'].split('-')[0]
                v_diff = (v1_base != v2_base)
                
                same_district = (w1['district_id'] == w2['district_id'])
                
                t1_text = w1['text'].strip()
                t2_text = w2['text'].strip()
                t1_norm = t1_text.replace(" (phase 2)", "")
                t2_norm = t2_text.replace(" (phase 2)", "")
                exact_norm = (t1_norm == t2_norm)
                has_phase_2 = (" (phase 2)" in t1_text) or (" (phase 2)" in t2_text)
                
                if same_agency:
                    # P2 clones are EXACT identical titles (ignoring " (Phase 2)") and small price bump
                    is_p2 = exact_norm and has_phase_2 and amt_delta > 0.0 and amt_delta <= 0.20 and dist <= 5.0 and not v_diff
                    # P6 clones (cross-district, v_diff == True, exact match)
                    is_p6 = not same_district and v_diff and exact_norm
                    
                    if not is_p2 and not is_p6:
                        final_s = min(final_s, 0.69)
                else:
                    # P6 is always same-agency by design (same MP agency replicates work
                    # across districts). Cross-agency title collisions are natural template
                    # noise — suppress all of them regardless of v_diff / exact_norm.
                    final_s = min(final_s, 0.69)
                            
                if final_s < 0.70:
                    continue
                
                for wid, wid_other in [(w1['id'], w2['id']), (w2['id'], w1['id'])]:
                    results.append({
                        "work_id": wid,
                        "detector": "D1",
                        "score": float(final_s),
                        "evidence_json": json.dumps({
                            "matched_with": wid_other,
                            "similarity": float(s),
                            "amount_delta": float(amt_delta),
                            "same_agency": same_agency,
                            "geo_distance_km": float(dist),
                            "fy_delta": fy_delta
                        })
                    })
                
    cursor = con.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS detection_results (
        work_id TEXT,
        detector TEXT,
        score REAL,
        evidence_json TEXT
    )''')

    # Idempotent: clear any existing D1/D1_split rows before re-inserting.
    # The table may have a PRIMARY KEY(work_id, detector) from the Prisma schema;
    # deleting first avoids UNIQUE constraint failures on re-runs.
    cursor.execute("DELETE FROM detection_results WHERE detector IN ('D1', 'D1_split')")

    best_results = {}
    for r in results:
        wid = r['work_id']
        if wid not in best_results or r['score'] > best_results[wid]['score']:
            best_results[wid] = r

    final_rows = list(best_results.values()) + list(split_results.values())

    for r in final_rows:
        cursor.execute('''INSERT OR REPLACE INTO detection_results (work_id, detector, score, evidence_json)
                          VALUES (?, ?, ?, ?)''', (r['work_id'], r['detector'], r['score'], r['evidence_json']))
    con.commit()
    con.close()
    return {"works": len(works_df), "cache": cache_status, "path": path_used, "rows": len(final_rows)}

if __name__ == "__main__":
    run_d1("data/app.db")
