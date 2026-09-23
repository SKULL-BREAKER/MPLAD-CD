#!/usr/bin/env python3
"""PRAHARI — deterministic MPLADS dataset generator.
Usage: python seed/generate_dataset.py --seed 42 --out data/ \
          [--ref-today 2024-06-30]
GATE CONTRACT (Step 01):
  1. Same --seed → byte-identical CSVs (sha256).
  2. BUDGET-DRIVEN: honest works consume ≤ 0.85 × entitlement per MP×FY.
  3. Total sanctioned ₹300–450 cr against ₹340 cr lifetime entitlement
     (excess = injected fraud — concentrated, labeled, detectable).
  4. Every fraud_labels.work_id resolves.
The script PRINTS its own gate numbers at the end.
"""
import argparse, json
from pathlib import Path
import numpy as np
import pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument("--seed", type=int, default=42)
ap.add_argument("--out", default="data/")
ap.add_argument("--ref-today", dest="ref_today", default="2024-06-30")
A = ap.parse_args()

rng = np.random.default_rng(A.seed)
REF = pd.Timestamp(A.ref_today)
OUT = Path(A.out)
OUT.mkdir(parents=True, exist_ok=True)

# ---------------- world constants ----------------
STATES = {"ST-A": (23.4, 78.6), "ST-B": (26.2, 81.1)}
HILLY = {2, 7, 10}                                  # terrain ×1.15
FY_ENT = {"2019-20": 5.0e7, "2020-21": 0.0, "2021-22": 2.0e7,
          "2022-23": 5.0e7, "2023-24": 5.0e7}
FYS = [fy for fy, e in FY_ENT.items() if e > 0]
HONEST_SPEND_FRAC = 0.85                            # per MP×FY

VN = (["Chandanpur","Belgaon","Kishanganj","Haripur","Ramgarh","Sundarpur",
       "Ammapet","Bhatoli","Devgarh","Gangapur","Indranagar","Jalkhera",
       "Keshavpur","Lakhanpur","Mohangarh","Nimbahera","Ormanjhi","Pipariya",
       "Ratanpur","Sitapur","Taranagar","Wazirganj"]
      + [f"{a}{k}" for a in ("Bela","Chand","Hari","Sundar") for k in range(1, 9)])

# unit, qlo, qhi, perunit_lo, perunit_hi, dur_lo, dur_hi,
# (mix_steel, mix_cement, mix_labor, mix_other), weight, title template
CATS = {
 "DRINKING_WATER":  ("nos",1,3,220000,320000,30,60,(.05,.05,.35,.55),.15,
   "Installation of borewell with handpump at {v}"),
 "SOLAR_LIGHTS":    ("poles",10,30,28000,38000,30,90,(.20,.05,.15,.60),.12,
   "Solar street lights ({q} poles) in {v}"),
 "REPAIR_WORKS":    ("nos",1,1,150000,800000,30,120,(.10,.15,.40,.35),.16,
   "Repair and renovation of community asset at {v}"),
 "SANITATION":      ("nos",1,2,900000,1400000,90,180,(.10,.25,.35,.30),.08,
   "Construction of sanitation block at {v}"),
 "EDUCATION":       ("rooms",1,4,900000,1200000,120,300,(.15,.35,.25,.25),.10,
   "Construction of {q} additional classroom(s) at school in {v}"),
 "ELECTRIFICATION": ("km",0.5,2.0,500000,700000,60,150,(.45,.05,.20,.30),.07,
   "LT electricity line extension {q} km at {v}"),
 "HEALTH":          ("nos",1,1,800000,2000000,90,240,(.20,.10,.35,.35),.07,
   "Upgradation of health sub-centre at {v}"),
 "ROADS":           ("km",0.5,2.0,2400000,3400000,150,300,(.10,.40,.25,.25),.04,
   "Construction of village road {q} km at {v}"),
 "BRIDGE":          ("m",8,20,240000,340000,180,360,(.45,.25,.20,.10),.02,
   "Construction of RCC bridge {q} m span near {v}"),
 "COMMUNITY":       ("nos",1,1,5500000,8500000,240,420,(.15,.35,.25,.25),.04,
   "Construction of community hall at {v}"),
 "OHT":             ("nos",1,1,1800000,2800000,150,300,(.30,.30,.20,.20),.04,
   "Construction of overhead water tank at {v}"),
}
CAT_NAMES = list(CATS)
CAT_W = np.array([CATS[c][8] for c in CAT_NAMES], float)
CAT_W /= CAT_W.sum()

# ---------------- price indices (DEMO-CALIBRATED → replace with WPI) -------
MONTHS = pd.period_range("2019-04", "2024-03", freq="M")
_MX = np.arange(len(MONTHS))
def _interp(anchors):
    ax, ay = zip(*anchors)
    return np.interp(_MX, ax, ay)

STEEL  = _interp([(0,1.00),(8,0.96),(14,1.06),(26,1.55),(38,1.42),(48,1.33),(59,1.28)])
CEMENT = _interp([(0,1.00),(8,0.98),(20,1.06),(32,1.13),(48,1.11),(59,1.12)])
LABOR  = _interp([(0,1.00),(12,1.05),(24,1.10),(36,1.16),(48,1.22),(59,1.26)])

def cat_ratio(cat, ts):
    mi = MONTHS.get_indexer([pd.Timestamp(ts).to_period("M")], method="nearest")[0]
    ms, mc, ml, mo = CATS[cat][7]
    return ms*STEEL[mi] + mc*CEMENT[mi] + ml*LABOR[mi] + mo

def fy_of(ts):
    y = ts.year if ts.month >= 4 else ts.year - 1
    return f"{y}-{str(y+1)[-2:]}"

def fy_start(fy): return pd.Timestamp(int(fy[:4]), 4, 1)

# ---------------- geography & actors ----------------
districts = []
for i in range(1, 13):
    st = "ST-A" if i <= 6 else "ST-B"
    lat, lon = np.array(STATES[st]) + rng.uniform(-0.6, 0.6, 2)
    districts.append(dict(id=f"DIST-{i:03d}", name=f"Demo-District-{i:03d}",
        state=st, centroid_lat=round(float(lat),4), centroid_lon=round(float(lon),4),
        terrain=1.15 if i in HILLY else 1.00))
districts = pd.DataFrame(districts)

villages = []
vid = 1
NV = len(VN)
for _, d in districts.iterrows():
    for j in rng.permutation(2*NV)[:60]:
        name = VN[int(j) % NV] + ("" if int(j) < NV else f"-{int(j)//NV+1}")
        villages.append(dict(id=f"V-{vid:04d}", district_id=d.id, name=name,
            lat=round(d.centroid_lat + rng.uniform(-0.09,0.09), 5),
            lon=round(d.centroid_lon + rng.uniform(-0.09,0.09), 5)))
        vid += 1
villages = pd.DataFrame(villages)
VBYD = {d: villages[villages.district_id == d] for d in districts.id}

ag_types = rng.choice(["PWD","ULB","ZP","TRUST","SOCIETY"], 400, p=[.40,.20,.25,.08,.07])
agencies = pd.DataFrame(dict(
    id=[f"AG-{i:03d}" for i in range(1,401)],
    name=[f"{t} Division {i:03d}" for i, t in enumerate(ag_types, 1)],
    agency_type=ag_types,
    home_district=[f"DIST-{int(rng.integers(1,13)):03d}" for _ in range(400)]
))
AGBYD = {d: list(agencies.loc[agencies.home_district==d, "id"]) for d in districts.id}

mps = []
for i, d in districts.iterrows():
    mps.append(dict(id=f"MP-{i+1:03d}", name=f"Demo LS MP {i+1}", house="LS",
        party=f"Party-{1+(i%4)}", state=d.state, constituency=d.name,
        nodal_districts=d.id))
for j in range(1, 9):
    st = "ST-A" if j <= 4 else "ST-B"
    mps.append(dict(id=f"MP-{12+j:03d}", name=f"Demo RS MP {j}", house="RS",
        party=f"Party-{1+(j%4)}", state=st, constituency="",
        nodal_districts=",".join(districts.loc[districts.state==st, "id"])))
mps = pd.DataFrame(mps)

# ---------------- work factory ----------------
works, specs, labels = [], [], []
WID = [0]

def label(wid, pat, cls): labels.append(dict(work_id=wid, pattern=pat, label_class=cls))

def add_work(mp, d, cat, qty, perunit, sanction, agency, status=None,
             exp_ratio=None, lat=None, lon=None, village_row=None,
             title=None, fy=None):
    WID[0] += 1
    wid = f"W-{WID[0]:06d}"
    if village_row is None:
        vv = VBYD[d.id]
        village_row = vv.iloc[int(rng.integers(len(vv)))]
    ratio = cat_ratio(cat, sanction)
    amount = round(qty * perunit * ratio * float(d.terrain)
                   * float(np.exp(rng.normal(0, 0.05))), 0)
    dur = int(rng.uniform(CATS[cat][5], CATS[cat][6]) * d.terrain)
    start = sanction + pd.Timedelta(days=int(rng.uniform(15, 60)))
    comp = start + pd.Timedelta(days=dur)
    
    if status is None:
        if comp <= REF - pd.Timedelta(days=30):
            status = "completed" if rng.random() < 0.96 else "dropped"
        elif start <= REF: status = "in_progress"
        else: status = "sanctioned"
    if status == "completed" and comp > REF:
        comp = REF - pd.Timedelta(days=7)          # clamp forced completions
        
    if exp_ratio is None:
        exp_ratio = {"completed": rng.uniform(.85,1.0),
                     "in_progress": rng.uniform(.10,.60),
                     "sanctioned": 0.0,
                     "dropped": rng.uniform(0,.20)}[status]
                     
    works.append(dict(
        id=wid, mp_id=mp["id"], district_id=d.id, agency_id=agency,
        title=(title or CATS[cat][9].format(q=qty, v=village_row["name"])),
        description="", category=cat, fy=(fy or fy_of(sanction)),
        sanctioned_amount=amount, expenditure=round(amount*exp_ratio, 0),
        physical_qty=qty, unit=CATS[cat][0],
        area_type=str(rng.choice(["general","sc","st"], p=[.70,.18,.12])),
        status=status, sanction_date=sanction.date().isoformat(),
        start_date=start.date().isoformat() if status != "sanctioned" else "",
        completion_date=comp.date().isoformat() if status == "completed" else "",
        lat=round(float(lat if lat is not None else village_row["lat"])
                  + rng.uniform(-.002,.002), 5),
        lon=round(float(lon if lon is not None else village_row["lon"])
                  + rng.uniform(-.002,.002), 5),
        village=village_row["name"], block=f"BLOCK-{d.id[-3:]}",
        created_at=REF.date().isoformat()))
        
    if cat in ("BRIDGE","ROADS","EDUCATION","SANITATION"):
        sp = {"BRIDGE":{"span_m":qty,"width_m":4.5},
              "ROADS":{"length_km":qty,"width_m":3.75},
              "EDUCATION":{"rooms":qty},
              "SANITATION":{"blocks":qty}}[cat]
        specs.append(dict(work_id=wid, spec_json=json.dumps(sp),
                          source="provided", confidence=1.0))
    return wid

# ---------------- HONEST BASE (budget-driven — the loop that matters) ------
for _, mp in mps.iterrows():
    nods = mp["nodal_districts"].split(",")
    for fy in FYS:
        share = 1.0 if mp["house"] == "LS" else 1.0/len(nods)
        for dcode in nods:
            d = districts[districts.id == dcode].iloc[0]
            budget = FY_ENT[fy] * share * HONEST_SPEND_FRAC
            spent, guard = 0.0, 0
            while spent < budget and guard < 500:
                guard += 1
                cat = CAT_NAMES[int(rng.choice(len(CAT_NAMES), p=CAT_W))]
                unit, qlo, qhi, plo, phi = CATS[cat][:5]
                qty = (round(float(rng.uniform(qlo,qhi)),1) if unit=="km"
                       else max(1, int(rng.uniform(qlo,qhi))))
                sanction = fy_start(fy) + pd.Timedelta(days=int(rng.integers(0,330)))
                pool = AGBYD[dcode]
                agency = (pool[int(rng.integers(len(pool)))] if rng.random()<.80
                          else f"AG-{int(rng.integers(1,401)):03d}")
                add_work(mp, d, cat, qty, float(rng.uniform(plo,phi)), sanction, agency)
                spent += works[-1]["sanctioned_amount"]
                if spent > budget * 1.05: break

def D(dcode): return districts[districts.id == dcode].iloc[0]

# ---------------- FRAUD INJECTION (P5 first — P1 reuses its agencies) ------
CAPTURED = []
for dcode in ("DIST-004","DIST-009"):
    pool = AGBYD[dcode]
    tgt = pool[0]
    dw = [w for w in works if w["district_id"] == dcode]
    for w in rng.choice(dw, size=int(len(dw)*0.30), replace=False):
        w["agency_id"] = tgt; label(w["id"], "P5", "fraud")
    CAPTURED.append(tgt)

done = [w for w in works if w["status"] == "completed"]
for w in rng.choice(done, size=30, replace=False):                      # P1 ghost
    w["expenditure"] = round(w["sanctioned_amount"]*rng.uniform(.90,1.0), 0)
    w["lat"] = round(w["lat"]+0.09, 5)
    w["lon"] = round(w["lon"]+0.09, 5)
    w["agency_id"] = CAPTURED[int(rng.integers(len(CAPTURED)))]
    label(w["id"], "P1", "fraud")

NXT = {"2019-20": "2022-23", "2021-22": "2023-24",
       "2022-23": "2023-24", "2023-24": "2023-24"}
for w in rng.choice(done, size=60, replace=False):                      # P2 duplicate
    s = fy_start(NXT[w["fy"]]) + pd.Timedelta(days=int(rng.integers(0,180)))
    wid = add_work(mps[mps.id==w["mp_id"]].iloc[0], D(w["district_id"]),
        w["category"], w["physical_qty"], 1000000.0, s, w["agency_id"],
        status="completed", exp_ratio=rng.uniform(.85,1.0),
        lat=w["lat"], lon=w["lon"],
        village_row={"name":w["village"],"lat":w["lat"],"lon":w["lon"]},
        title=w["title"] + " (Phase 2)")
    cw = works[-1]
    cw["sanctioned_amount"] = round(w["sanctioned_amount"]*rng.uniform(.90,1.10), 0)
    cw["expenditure"] = round(cw["sanctioned_amount"]*rng.uniform(.85,1.0), 0)
    label(wid, "P2", "fraud")
    label(w["id"], "P2", "fraud")

for _ in range(20):                                                     # P6 copy-paste
    w = works[int(rng.integers(len(works)))]
    if w["status"] != "completed": continue
    st = D(w["district_id"])["state"]
    others = [d for d in districts[districts.state==st].id if d != w["district_id"]]
    if len(others) < 2: continue
    rs_list = mps[(mps.house=="RS") & (mps.state==st)]
    rs = rs_list.iloc[int(rng.integers(len(rs_list)))]
    for dcode in rng.choice(others, size=2, replace=False):
        wid = add_work(rs, D(dcode), w["category"], w["physical_qty"],
            1000000.0, pd.Timestamp(w["sanction_date"]), w["agency_id"],
            status="completed", exp_ratio=rng.uniform(.85,1.0), title=w["title"])
        cw = works[-1]
        cw["sanctioned_amount"] = round(w["sanctioned_amount"]*rng.uniform(.95,1.05), 0)
        cw["expenditure"] = round(cw["sanctioned_amount"]*rng.uniform(.85,1.0), 0)
        label(wid, "P6", "fraud")
    label(w["id"], "P6", "fraud")

for _ in range(20):                                                     # P7 split
    dcode = districts.id.iloc[int(rng.integers(12))]
    vv = VBYD[dcode]
    v = vv.iloc[int(rng.integers(len(vv)))]
    base = fy_start("2022-23") + pd.Timedelta(days=int(rng.integers(0,330)))
    for k in range(4):
        wid = add_work(mps.iloc[int(rng.integers(12))], D(dcode), "REPAIR_WORKS", 1,
            float(rng.uniform(800000,1200000)),
            base + pd.Timedelta(days=int(rng.integers(0,15))), AGBYD[dcode][0],
            status="completed", exp_ratio=rng.uniform(.90,1.0),
            lat=float(v["lat"]), lon=float(v["lon"]), village_row=v,
            title=f"Improvement of approach road at {v['name']} - part {k+1}")
        label(wid, "P7", "violation")

for _ in range(80):                                                     # P3 inflation
    cat = CAT_NAMES[int(rng.choice(len(CAT_NAMES), p=CAT_W))]
    unit, qlo, qhi, plo, phi = CATS[cat][:5]
    dcode = districts.id.iloc[int(rng.integers(12))]
    fy = str(rng.choice(["2019-20", "2022-23", "2023-24"]))
    s = fy_start(fy) + pd.Timedelta(days=int(rng.integers(0,300)))
    wid = add_work(mps.iloc[int(rng.integers(20))], D(dcode), cat,
        max(1, int(rng.uniform(qlo,qhi))), float(rng.uniform(plo,phi))*rng.uniform(2.5,4.0),
        s, AGBYD[dcode][0], status="completed", exp_ratio=rng.uniform(.85,1.0))
    label(wid, "P3", "fraud")

for _ in range(100):                                                    # P4 stalled
    cat = CAT_NAMES[int(rng.choice(len(CAT_NAMES), p=CAT_W))]
    unit, qlo, qhi, plo, phi = CATS[cat][:5]
    dcode = districts.id.iloc[int(rng.integers(12))]
    s = REF - pd.Timedelta(days=int(rng.uniform(400, 700)))
    wid = add_work(mps.iloc[int(rng.integers(20))], D(dcode), cat,
        max(1, int(rng.uniform(qlo,qhi))), float(rng.uniform(plo,phi)), s,
        AGBYD[dcode][0], status="sanctioned", exp_ratio=0.0)
    label(wid, "P4", "inefficiency")

for _ in range(25):                                                     # P9 flash
    dcode = districts.id.iloc[int(rng.integers(12))]
    fy = str(rng.choice(["2019-20", "2022-23", "2023-24"]))
    s = fy_start(fy) + pd.Timedelta(days=int(rng.integers(0,300)))
    wid = add_work(mps.iloc[int(rng.integers(20))], D(dcode), "EDUCATION", 2,
        1050000.0, s, AGBYD[dcode][0], status="completed",
        exp_ratio=rng.uniform(.95,1.0))
    w = works[-1]
    w["start_date"] = w["sanction_date"]
    w["completion_date"] = (s + pd.Timedelta(days=int(rng.uniform(6,10)))).date().isoformat()
    label(wid, "P9", "fraud")

BAD = ["Renovation of community hall at temple premises in {v}",
       "Construction of statue of freedom fighter at {v}"]
for k in range(25):                                                     # P8 prohibited
    dcode = districts.id.iloc[int(rng.integers(12))]
    v = VBYD[dcode].iloc[int(rng.integers(60))]
    fy = str(rng.choice(["2019-20", "2022-23", "2023-24"]))
    s = fy_start(fy) + pd.Timedelta(days=(30*k) % 330)
    wid = add_work(mps.iloc[int(rng.integers(20))], D(dcode), "REPAIR_WORKS", 1,
        float(rng.uniform(400000,900000)), s, AGBYD[dcode][0],
        status="completed", exp_ratio=rng.uniform(.85,1.0),
        village_row=v, title=BAD[k%2].format(v=v["name"]))
    label(wid, "P8", "violation")

for dcode in ("DIST-005","DIST-011"):                                  # P10 year-end
    dw = [w for w in works if w["district_id"]==dcode and w["fy"]=="2023-24"]
    if not dw: continue
    for w in rng.choice(dw, size=int(len(dw)*0.60), replace=False):
        s = pd.Timestamp(2024,3,int(rng.uniform(1,29)))
        w["sanction_date"] = s.date().isoformat()
        w["expenditure"] = round(w["sanctioned_amount"]*rng.uniform(0,.10), 0)
        w["status"] = "sanctioned"
        w["start_date"] = ""
        w["completion_date"] = ""
        label(w["id"], "P10", "inefficiency")

# ---------------- INNOCENTS (labeled FROM the honest pool — no extra money)
labeled = {r["work_id"] for r in labels}
pool = [w for w in works if w["id"] not in labeled]
def tag(match, n, pat):
    hits = [w for w in pool if match(w)]
    if not hits: return
    for w in rng.choice(hits, size=min(n, len(hits)), replace=False):
        label(w["id"], pat, "innocent")

tag(lambda w: w["category"]=="EDUCATION", 150, "N1")       # template near-dupes
tag(lambda w: w["category"]=="COMMUNITY", 40, "N2")        # legit high-cost
tag(lambda w: w["category"]=="DRINKING_WATER", 80, "N3")   # small fast works

def _n4(w):                                                # price-explained
    c = CATS[w["category"]]
    top = w["physical_qty"] * c[4] * cat_ratio(w["category"],
                                               pd.Timestamp(w["sanction_date"]))
    return w["sanctioned_amount"] >= 0.92 * top
tag(_n4, 100, "N4")

for _ in range(40):                                        # N5 underpriced (fresh)
    dcode = districts.id.iloc[int(rng.integers(12))]
    s = fy_start("2023-24") + pd.Timedelta(days=int(rng.integers(0,300)))
    wid = add_work(mps.iloc[int(rng.integers(20))], D(dcode), "SANITATION", 1,
        800000.0, s, AGBYD[dcode][0], status="sanctioned", exp_ratio=0.0)
    label(wid, "N5", "innocent")

# ---------------- FUND FLOWS (entitlement-first, never backward) ----------
ff = {}
for w in works:
    k = (w["district_id"], w["fy"], w["mp_id"])
    ff[k] = ff.get(k, 0.0) + w["expenditure"]
rows = []
for _, mp in mps.iterrows():
    nods = mp["nodal_districts"].split(",")
    for fy in FYS:
        share = 1.0 if mp["house"]=="LS" else 1.0/len(nods)
        for dcode in nods:
            ent = FY_ENT[fy]*share
            exp = ff.get((dcode, fy, mp["id"]), 0.0)
            rows.append(dict(district_id=dcode, fy=fy, mp_id=mp["id"],
                entitlement=ent, funds_released=ent,
                expenditure=round(exp,0), unspent=round(ent-exp,0)))

# ---------------- WRITE + SELF-REPORTING GATE NUMBERS --------------------
pd.DataFrame(works).to_csv(OUT/"works.csv", index=False)
mps.to_csv(OUT/"mps.csv", index=False)
districts.to_csv(OUT/"districts.csv", index=False)
agencies.to_csv(OUT/"agencies.csv", index=False)
villages.to_csv(OUT/"villages.csv", index=False)
pd.DataFrame(rows).to_csv(OUT/"fund_flows.csv", index=False)
pd.DataFrame(specs).to_csv(OUT/"work_specs.csv", index=False)
lab = pd.DataFrame(labels).drop_duplicates(subset=["work_id","pattern"])
lab.to_csv(OUT/"fraud_labels.csv", index=False)

tot = sum(w["sanctioned_amount"] for w in works)
over = {}
for w in works:
    k = (w["mp_id"], w["fy"])
    over[k] = over.get(k, 0.0) + w["sanctioned_amount"]
worst = max((v/FY_ENT[k[1]], k) for k, v in over.items() if FY_ENT.get(k[1],0) > 0)

print(f"works={len(works)}  total_sanctioned_cr={tot/1e7:.0f}")
print(f"labels={len(lab)} {lab.label_class.value_counts().to_dict()}")
print(f"max_mp_fy_overshoot={worst[0]:.2f}x {worst[1]}")
print(f"[seed={A.seed} ref={A.ref_today}]  GATE: works 2000-4000, "
      f"total 300-450cr, overshoot <= 1.6x, determinism via sha256")
