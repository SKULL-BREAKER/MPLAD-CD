import os
import json
import sqlite3
import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "../data/app.db")
EVAL_PATH = os.path.join(os.path.dirname(__file__), "../reports/eval_dev.json")

def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

@app.get("/api/eval/metrics")
def get_metrics():
    if not os.path.exists(EVAL_PATH):
        raise HTTPException(status_code=404, detail="metrics not found")
    return FileResponse(EVAL_PATH)

@app.get("/api/overview")
def get_overview():
    con = get_db()
    cur = con.cursor()
    
    cur.execute("SELECT COUNT(*) as works, SUM(sanctioned_amount) as sanctioned, SUM(sanctioned_amount - expenditure) as unspent, SUM(expenditure) as exp FROM works")
    row = cur.fetchone()
    
    total_works = row['works'] or 0
    sanctioned_cr = (row['sanctioned'] or 0) / 10000000.0
    unspent_cr = (row['unspent'] or 0) / 10000000.0
    spent_cr = (row['exp'] or 0) / 10000000.0
    
    cur.execute("SELECT tier, COUNT(*) as c FROM work_risk GROUP BY tier")
    tier_counts = {r['tier']: r['c'] for r in cur.fetchall()}
    
    cur.execute('''
        SELECT d.id, d.name, r.risk_score as risk, r.tier 
        FROM districts d
        JOIN district_risk r ON r.district_id = d.id
        ORDER BY risk DESC
        LIMIT 10
    ''')
    district_risk_top = [dict(r) for r in cur.fetchall()]
    
    cur.execute("SELECT district_id FROM district_flags WHERE flag='benford_chi2'")
    benford_outliers = [r['district_id'] for r in cur.fetchall()]
    
    utilization_avg = spent_cr / sanctioned_cr if sanctioned_cr > 0 else 0
    
    return {
        "total_works": total_works,
        "sanctioned_cr": sanctioned_cr,
        "unspent_cr": unspent_cr,
        "flagged": {
            "critical": tier_counts.get("CRITICAL", 0),
            "high": tier_counts.get("HIGH", 0),
            "medium": tier_counts.get("MEDIUM", 0)
        },
        "district_risk_top": district_risk_top,
        "benford_outliers": benford_outliers,
        "utilization_avg": utilization_avg,
        "sankey": {
            "release": sanctioned_cr,
            "sanction": sanctioned_cr,
            "spend": spent_cr,
            "unspent": unspent_cr
        },
        "last_run": datetime.datetime.utcnow().isoformat() + "Z"
    }

@app.get("/api/districts")
def get_districts():
    con = get_db()
    cur = con.cursor()
    cur.execute('''
        SELECT d.id, d.name, r.risk_score as risk, r.tier, r.contributions_json,
               (SELECT COUNT(*) FROM works WHERE district_id = d.id) as works_count,
               (SELECT SUM(sanctioned_amount - expenditure) FROM works WHERE district_id = d.id) as unspent,
               (SELECT COUNT(DISTINCT wr.work_id) FROM work_risk wr JOIN works w ON wr.work_id = w.id WHERE w.district_id = d.id) as flags_count
        FROM districts d
        LEFT JOIN district_risk r ON r.district_id = d.id
    ''')
    rows = cur.fetchall()
    result = []
    for r in rows:
        hhi = 0.0
        util = 0.0
        if r['contributions_json']:
            cjs = json.loads(r['contributions_json'])
            for c in cjs:
                if c['signal'] == 'HHI':
                    hhi = c['points']
                elif c['signal'] == 'Utilization':
                    util = c['points']
        result.append({
            "id": r["id"],
            "name": r["name"],
            "risk": r["risk"] or 0.0,
            "tier": r["tier"] or "LOW",
            "hhi": hhi,
            "utilization": util,
            "works_count": r["works_count"],
            "flags_count": r["flags_count"] or 0,
            "unspent_cr": (r["unspent"] or 0) / 10000000.0
        })
    return result

@app.get("/api/districts/{id}")
def get_district(id: str):
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT * FROM districts WHERE id = ?", (id,))
    dist = cur.fetchone()
    if not dist:
        raise HTTPException(status_code=404, detail="District not found")
    
    cur.execute("SELECT SUM(sanctioned_amount) as sanctioned, SUM(expenditure) as spent FROM works WHERE district_id = ?", (id,))
    row = cur.fetchone()
    sanctioned = row['sanctioned'] or 0
    spent = row['spent'] or 0
    unspent = sanctioned - spent
    
    cur.execute("SELECT COUNT(*) FROM works WHERE district_id = ?", (id,))
    works_count = cur.fetchone()[0]
    
    cur.execute("SELECT agency_id, SUM(expenditure) as exp FROM works WHERE district_id = ? GROUP BY agency_id", (id,))
    agencies = cur.fetchall()
    total_exp = sum(a['exp'] for a in agencies) if agencies else 0
    hhi = 0
    if total_exp > 0:
        hhi = sum(((a['exp']/total_exp)*100)**2 for a in agencies)
        
    cur.execute("SELECT flag FROM district_flags WHERE district_id = ?", (id,))
    flags = [r['flag'] for r in cur.fetchall()]
    
    return {
        "id": dist['id'],
        "name": dist['name'],
        "entitlement": sanctioned,
        "spent": spent,
        "unspent": unspent,
        "hhi": hhi,
        "works_count": works_count,
        "flags": flags
    }

@app.get("/api/districts/{id}/works")
def get_district_works(id: str, request: Request):
    tier = request.query_params.get('tier')
    category = request.query_params.get('category')
    fy = request.query_params.get('fy')
    q = request.query_params.get('q')
    
    con = get_db()
    cur = con.cursor()
    
    query = """
        SELECT w.id, w.title, w.mp_id, w.agency_id, w.sanctioned_amount, w.status, w.category,
               wr.tier, wr.contributions_json
        FROM works w
        LEFT JOIN work_risk wr ON wr.work_id = w.id
        WHERE w.district_id = ?
    """
    params = [id]
    
    if tier:
        if tier.upper() == 'LOW':
            query += " AND (wr.tier = 'LOW' OR wr.tier IS NULL) "
        else:
            query += " AND wr.tier = ? "
            params.append(tier.upper())
    if category:
        query += " AND w.category = ? "
        params.append(category)
    if fy:
        query += " AND w.fy = ? "
        params.append(fy)
    if q:
        query += " AND (w.title LIKE ? OR w.id LIKE ?) "
        params.append(f"%{q}%")
        params.append(f"%{q}%")
        
    cur.execute(query, params)
    rows = cur.fetchall()
    
    result = []
    for r in rows:
        d = dict(r)
        d['tier'] = d['tier'] or 'LOW'
        top_ev = None
        if d['contributions_json']:
            cjs = json.loads(d['contributions_json'])
            if cjs:
                cjs = sorted(cjs, key=lambda x: x.get('points', 0), reverse=True)
                top_ev = cjs[0].get('detector')
        d['top_evidence'] = top_ev
        del d['contributions_json']
        result.append(d)
        
    return result

@app.get("/api/works/{id}")
def get_work(id: str):
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT id, title, category, fy, sanctioned_amount, expenditure, status, sanction_date, start_date, completion_date, lat, lon, village, district_id, mp_id, agency_id FROM works WHERE id = ?", (id,))
    work = cur.fetchone()
    if not work:
        raise HTTPException(status_code=404, detail="Work not found")
        
    # risk
    cur.execute("SELECT risk_score, tier, contributions_json FROM work_risk WHERE work_id = ?", (id,))
    risk_row = cur.fetchone()
    risk = {
        "score": risk_row['risk_score'] if risk_row else 0.0,
        "tier": risk_row['tier'] if risk_row else "LOW",
        "contributions": json.loads(risk_row['contributions_json']) if risk_row and risk_row['contributions_json'] else []
    }
    
    # flags
    cur.execute("SELECT detector, tier, score, evidence_json FROM detection_results WHERE work_id = ?", (id,))
    flags = []
    for r in cur.fetchall():
        flags.append({
            "detector": r["detector"],
            "tier": r["tier"] or "REVIEW",
            "score": r["score"],
            "evidence": json.loads(r["evidence_json"]) if r["evidence_json"] else {}
        })
        
    # agency_stats
    agency_id = work['agency_id']
    dist_id = work['district_id']
    cur.execute("SELECT COUNT(*), COUNT(DISTINCT district_id) FROM works WHERE agency_id = ?", (agency_id,))
    ag_row = cur.fetchone()
    agency_works = ag_row[0]
    agency_dists = ag_row[1]
    
    cur.execute("SELECT SUM(expenditure) FROM works WHERE district_id = ? AND agency_id = ?", (dist_id, agency_id))
    ag_exp = cur.fetchone()[0] or 0
    cur.execute("SELECT SUM(expenditure) FROM works WHERE district_id = ?", (dist_id,))
    dist_exp = cur.fetchone()[0] or 1
    
    agency_stats = {
        "works_in_district": agency_works,
        "districts_active": agency_dists,
        "spend_share": ag_exp / dist_exp
    }
    
    # alert
    cur.execute("SELECT severity, status FROM alerts WHERE work_id = ?", (id,))
    alert_row = cur.fetchone()
    alert = dict(alert_row) if alert_row else None
    
    return {
        "work": dict(work),
        "risk": risk,
        "flags": flags,
        "agency_stats": agency_stats,
        "alert": alert
    }

@app.get("/api/works/{id}/matches")
def get_work_matches(id: str):
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT evidence_json FROM detection_results WHERE work_id = ? AND detector = 'D1'", (id,))
    row = cur.fetchone()
    if not row or not row['evidence_json']:
        return []
        
    ev = json.loads(row['evidence_json'])
    matches = ev.get('matches', [])
    result = []
    for m in matches:
        result.append({
            "work_id": id,
            "matched_with": m.get("pair_id"),
            "similarity": m.get("similarity"),
            "amount_delta": m.get("amount_delta"),
            "same_agency": m.get("same_agency"),
            "geo_distance_km": m.get("distance")
        })
    return result

# SPA Fallback
import logging
static_path = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_path, exist_ok=True)
if not os.path.exists(os.path.join(static_path, "index.html")):
    logging.warning(
        "No frontend build found at %s/index.html. "
        "Run 'npm run build' in mplad-app/frontend before starting the server.",
        static_path
    )

if os.path.exists(os.path.join(static_path, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_path, "assets")), name="assets")
if os.path.exists(os.path.join(static_path, "geo")):
    app.mount("/geo", StaticFiles(directory=os.path.join(static_path, "geo")), name="geo")

@app.exception_handler(404)
async def custom_404_handler(request, exc):
    if request.url.path.startswith("/api/"):
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    
    # Try serving the file directly from static_path if it exists (e.g. /favicon.svg)
    file_path = os.path.join(static_path, request.url.path.lstrip("/"))
    if os.path.isfile(file_path):
        return FileResponse(file_path)
        
    return FileResponse(os.path.join(static_path, "index.html"))
