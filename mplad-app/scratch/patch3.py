import re

with open('scratch/generate_dataset.py', 'r') as f:
    code = f.read()

# 1. Add cell_sums and fits
code = code.replace('FY_ENT = {"2019-20": 5.0e7, "2020-21": 0.0, "2021-22": 2.0e7,\n          "2022-23": 5.0e7, "2023-24": 5.0e7}', 
'''FY_ENT = {"2019-20": 5.0e7, "2020-21": 0.0, "2021-22": 2.0e7,
          "2022-23": 5.0e7, "2023-24": 5.0e7}
cell_sums = {}
# Will be initialized after mps is created''')

code = code.replace('''mps = pd.DataFrame(mps)

# ---------------- work factory ----------------''',
'''mps = pd.DataFrame(mps)
for _, m in mps.iterrows():
    for fy in FY_ENT:
        cell_sums[(m["id"], fy)] = 0.0

def fits(mp_id, fy, amount):
    return cell_sums[(mp_id, fy)] + amount <= 1.15 * FY_ENT[fy]

# ---------------- work factory ----------------''')

# 2. Update cell_sums inside add_work
code = code.replace('''    works.append(dict(
        id=wid, mp_id=mp["id"], district_id=d.id, agency_id=agency,''',
'''    fy_str = fy or fy_of(sanction)
    if fy_str in FY_ENT: cell_sums[(mp["id"], fy_str)] += amount
    works.append(dict(
        id=wid, mp_id=mp["id"], district_id=d.id, agency_id=agency,''')

# P2
p2_old = '''for w in rng.choice(done, size=60, replace=False):                      # P2 duplicate
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
    label(w["id"], "P2", "fraud")'''

p2_new = '''# P2 duplicate
for _ in range(60):
    for attempt in range(3):
        w = done[int(rng.integers(len(done)))]
        fy_str = NXT[w["fy"]]
        est_amt = w["sanctioned_amount"] * 1.05
        if fits(w["mp_id"], fy_str, est_amt): break
        
    fy_str = NXT[w["fy"]]
    avail = max(0, 1.15 * FY_ENT[fy_str] - cell_sums[(w["mp_id"], fy_str)])
    desired_amt = round(w["sanctioned_amount"]*rng.uniform(.90,1.10), 0)
    if desired_amt > avail: desired_amt = avail
    
    s = fy_start(fy_str) + pd.Timedelta(days=int(rng.integers(0,180)))
    
    wid = add_work(mps[mps.id==w["mp_id"]].iloc[0], D(w["district_id"]),
        w["category"], w["physical_qty"], 0.0, s, w["agency_id"],
        status="completed", exp_ratio=rng.uniform(.85,1.0),
        lat=w["lat"], lon=w["lon"],
        village_row={"name":w["village"],"lat":w["lat"],"lon":w["lon"]},
        title=w["title"] + " (Phase 2)")
        
    cw = works[-1]
    cw["sanctioned_amount"] = desired_amt
    cw["expenditure"] = round(cw["sanctioned_amount"]*rng.uniform(.85,1.0), 0)
    cell_sums[(cw["mp_id"], cw["fy"])] += desired_amt
    
    label(wid, "P2", "fraud")
    label(w["id"], "P2", "fraud")'''
code = code.replace(p2_old, p2_new)

# P6
p6_old = '''for _ in range(20):                                                     # P6 copy-paste
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
    label(w["id"], "P6", "fraud")'''

p6_new = '''for _ in range(20):                                                     # P6 copy-paste
    w = works[int(rng.integers(len(works)))]
    if w["status"] != "completed": continue
    st = D(w["district_id"])["state"]
    others = [d for d in districts[districts.state==st].id if d != w["district_id"]]
    if len(others) < 2: continue
    rs_list = mps[(mps.house=="RS") & (mps.state==st)]
    
    # Try repicking RS MP up to 3 times
    for _ in range(3):
        rs = rs_list.iloc[int(rng.integers(len(rs_list)))]
        if fits(rs["id"], w["fy"], w["sanctioned_amount"] * 2): break
        
    for dcode in rng.choice(others, size=2, replace=False):
        avail = max(0, 1.15 * FY_ENT[w["fy"]] - cell_sums[(rs["id"], w["fy"])])
        desired_amt = round(w["sanctioned_amount"]*rng.uniform(.95,1.05), 0)
        if desired_amt > avail: desired_amt = avail
        
        wid = add_work(rs, D(dcode), w["category"], w["physical_qty"],
            0.0, pd.Timestamp(w["sanction_date"]), w["agency_id"],
            status="completed", exp_ratio=rng.uniform(.85,1.0), title=w["title"])
            
        cw = works[-1]
        cw["sanctioned_amount"] = desired_amt
        cw["expenditure"] = round(cw["sanctioned_amount"]*rng.uniform(.85,1.0), 0)
        cell_sums[(rs["id"], w["fy"])] += desired_amt
        label(wid, "P6", "fraud")
    label(w["id"], "P6", "fraud")'''
code = code.replace(p6_old, p6_new)

# P7
p7_old = '''for _ in range(20):                                                     # P7 split
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
        label(wid, "P7", "violation")'''

p7_new = '''for _ in range(20):                                                     # P7 split
    dcode = districts.id.iloc[int(rng.integers(12))]
    vv = VBYD[dcode]
    v = vv.iloc[int(rng.integers(len(vv)))]
    base = fy_start("2022-23") + pd.Timedelta(days=int(rng.integers(0,330)))
    for k in range(4):
        perunit = float(rng.uniform(800000,1200000))
        for _ in range(3):
            mp = mps.iloc[int(rng.integers(12))]
            est_amt = 1 * perunit * cat_ratio("REPAIR_WORKS", base + pd.Timedelta(days=15)) * float(D(dcode).terrain)
            if fits(mp["id"], "2022-23", est_amt): break
        if not fits(mp["id"], "2022-23", est_amt):
            avail = max(0, 1.15 * FY_ENT["2022-23"] - cell_sums[(mp["id"], "2022-23")])
            if est_amt > 0: perunit *= avail / est_amt
            
        wid = add_work(mp, D(dcode), "REPAIR_WORKS", 1,
            perunit,
            base + pd.Timedelta(days=int(rng.integers(0,15))), AGBYD[dcode][0],
            status="completed", exp_ratio=rng.uniform(.90,1.0),
            lat=float(v["lat"]), lon=float(v["lon"]), village_row=v,
            title=f"Improvement of approach road at {v['name']} - part {k+1}")
        label(wid, "P7", "violation")'''
code = code.replace(p7_old, p7_new)

# P3
p3_old = '''for _ in range(80):                                                     # P3 inflation
    cat = CAT_NAMES[int(rng.choice(len(CAT_NAMES), p=CAT_W))]
    unit, qlo, qhi, plo, phi = CATS[cat][:5]
    dcode = districts.id.iloc[int(rng.integers(12))]
    fy = str(rng.choice(["2019-20", "2022-23", "2023-24"]))
    s = fy_start(fy) + pd.Timedelta(days=int(rng.integers(0,300)))
    wid = add_work(mps.iloc[int(rng.integers(20))], D(dcode), cat,
        max(1, int(rng.uniform(qlo,qhi))), float(rng.uniform(plo,phi))*rng.uniform(2.5,4.0),
        s, AGBYD[dcode][0], status="completed", exp_ratio=rng.uniform(.85,1.0))
    label(wid, "P3", "fraud")'''

p3_new = '''for _ in range(80):                                                     # P3 inflation
    cat = CAT_NAMES[int(rng.choice(len(CAT_NAMES), p=CAT_W))]
    unit, qlo, qhi, plo, phi = CATS[cat][:5]
    dcode = districts.id.iloc[int(rng.integers(12))]
    fy = str(rng.choice(["2019-20", "2022-23", "2023-24"]))
    s = fy_start(fy) + pd.Timedelta(days=int(rng.integers(0,300)))
    
    qty = max(1, int(rng.uniform(qlo,qhi)))
    perunit = float(rng.uniform(plo,phi))*rng.uniform(2.5,4.0)
    
    # P3 ABSOLUTE CAP
    ratio = cat_ratio(cat, s)
    d = D(dcode)
    est_amt = qty * perunit * ratio * float(d.terrain)
    if est_amt > 1.2e7:
        perunit *= 1.2e7 / est_amt
        est_amt = 1.2e7
        
    for _ in range(3):
        mp = mps.iloc[int(rng.integers(20))]
        if fits(mp["id"], fy, est_amt): break
        
    if not fits(mp["id"], fy, est_amt):
        avail = max(0, 1.15 * FY_ENT[fy] - cell_sums[(mp["id"], fy)])
        if est_amt > 0: perunit *= avail / est_amt
        
    wid = add_work(mp, d, cat, qty, perunit,
        s, AGBYD[dcode][0], status="completed", exp_ratio=rng.uniform(.85,1.0))
    label(wid, "P3", "fraud")'''
code = code.replace(p3_old, p3_new)

# P4
p4_old = '''for _ in range(100):                                                    # P4 stalled
    cat = CAT_NAMES[int(rng.choice(len(CAT_NAMES), p=CAT_W))]
    unit, qlo, qhi, plo, phi = CATS[cat][:5]
    dcode = districts.id.iloc[int(rng.integers(12))]
    s = REF - pd.Timedelta(days=int(rng.uniform(400, 700)))
    wid = add_work(mps.iloc[int(rng.integers(20))], D(dcode), cat,
        max(1, int(rng.uniform(qlo,qhi))), float(rng.uniform(plo,phi)), s,
        AGBYD[dcode][0], status="sanctioned", exp_ratio=0.0)
    label(wid, "P4", "inefficiency")'''

p4_new = '''for _ in range(100):                                                    # P4 stalled
    cat = CAT_NAMES[int(rng.choice(len(CAT_NAMES), p=CAT_W))]
    unit, qlo, qhi, plo, phi = CATS[cat][:5]
    dcode = districts.id.iloc[int(rng.integers(12))]
    s = REF - pd.Timedelta(days=int(rng.uniform(400, 700)))
    fy_str = fy_of(s)
    
    qty = max(1, int(rng.uniform(qlo,qhi)))
    perunit = float(rng.uniform(plo,phi))
    est_amt = qty * perunit * cat_ratio(cat, s) * float(D(dcode).terrain)
    
    for _ in range(3):
        mp = mps.iloc[int(rng.integers(20))]
        if fits(mp["id"], fy_str, est_amt): break
        
    if not fits(mp["id"], fy_str, est_amt):
        avail = max(0, 1.15 * FY_ENT.get(fy_str, 5.0e7) - cell_sums.get((mp["id"], fy_str), 0.0))
        if est_amt > 0: perunit *= avail / est_amt
        
    wid = add_work(mp, D(dcode), cat,
        qty, perunit, s,
        AGBYD[dcode][0], status="sanctioned", exp_ratio=0.0)
    label(wid, "P4", "inefficiency")'''
code = code.replace(p4_old, p4_new)

# P9
p9_old = '''for _ in range(25):                                                     # P9 flash
    dcode = districts.id.iloc[int(rng.integers(12))]
    fy = str(rng.choice(["2019-20", "2022-23", "2023-24"]))
    s = fy_start(fy) + pd.Timedelta(days=int(rng.integers(0,300)))
    wid = add_work(mps.iloc[int(rng.integers(20))], D(dcode), "EDUCATION", 2,
        1050000.0, s, AGBYD[dcode][0], status="completed",
        exp_ratio=rng.uniform(.95,1.0))
    w = works[-1]
    w["start_date"] = w["sanction_date"]
    w["completion_date"] = (s + pd.Timedelta(days=int(rng.uniform(6,10)))).date().isoformat()
    label(wid, "P9", "fraud")'''

p9_new = '''for _ in range(25):                                                     # P9 flash
    dcode = districts.id.iloc[int(rng.integers(12))]
    fy = str(rng.choice(["2019-20", "2022-23", "2023-24"]))
    s = fy_start(fy) + pd.Timedelta(days=int(rng.integers(0,300)))
    
    qty = 2
    perunit = 1050000.0
    est_amt = qty * perunit * cat_ratio("EDUCATION", s) * float(D(dcode).terrain)
    
    for _ in range(3):
        mp = mps.iloc[int(rng.integers(20))]
        if fits(mp["id"], fy, est_amt): break
        
    if not fits(mp["id"], fy, est_amt):
        avail = max(0, 1.15 * FY_ENT[fy] - cell_sums[(mp["id"], fy)])
        if est_amt > 0: perunit *= avail / est_amt
        
    wid = add_work(mp, D(dcode), "EDUCATION", qty,
        perunit, s, AGBYD[dcode][0], status="completed",
        exp_ratio=rng.uniform(.95,1.0))
    w = works[-1]
    w["start_date"] = w["sanction_date"]
    w["completion_date"] = (s + pd.Timedelta(days=int(rng.uniform(6,10)))).date().isoformat()
    label(wid, "P9", "fraud")'''
code = code.replace(p9_old, p9_new)

# N5
n5_old = '''for _ in range(40):                                        # N5 underpriced (fresh)
    dcode = districts.id.iloc[int(rng.integers(12))]
    s = fy_start("2023-24") + pd.Timedelta(days=int(rng.integers(0,300)))
    wid = add_work(mps.iloc[int(rng.integers(20))], D(dcode), "SANITATION", 1,
        800000.0, s, AGBYD[dcode][0], status="sanctioned", exp_ratio=0.0)
    label(wid, "N5", "innocent")'''

n5_new = '''for _ in range(40):                                        # N5 underpriced (fresh)
    dcode = districts.id.iloc[int(rng.integers(12))]
    fy = str(rng.choice(["2019-20", "2022-23", "2023-24"]))
    s = fy_start(fy) + pd.Timedelta(days=int(rng.integers(0,300)))
    
    qty = 1
    perunit = 800000.0
    est_amt = qty * perunit * cat_ratio("SANITATION", s) * float(D(dcode).terrain)
    
    for _ in range(3):
        mp = mps.iloc[int(rng.integers(20))]
        if fits(mp["id"], fy, est_amt): break
        
    if not fits(mp["id"], fy, est_amt):
        avail = max(0, 1.15 * FY_ENT[fy] - cell_sums[(mp["id"], fy)])
        if est_amt > 0: perunit *= avail / est_amt
        
    wid = add_work(mp, D(dcode), "SANITATION", qty,
        perunit, s, AGBYD[dcode][0], status="sanctioned", exp_ratio=0.0)
    label(wid, "N5", "innocent")'''
code = code.replace(n5_old, n5_new)

with open('seed/generate_dataset.py', 'w') as f:
    f.write(code)
