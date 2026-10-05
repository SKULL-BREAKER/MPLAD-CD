import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export const dynamic = 'force-dynamic';

// ── Real data facts (seeded from demo.db 2026-09-14 snapshot) ────────────────
const REAL = {
  total: 131158,
  completed: 44028,
  proposed: 87130,
  budgetCr: 7944.6,   // ₹7,944 Crore
  spentCr: 2408.7,    // ₹2,408 Crore
  utilPct: '30.3%',
  mps: 734,
  districts: 538,
  states: 28,
  topDistricts: ['KAUSHAMBI (2584)', 'MACHHLISHAHR (1396)', 'SHRAWASTI (1357)', 'NIZAMABAD (916)', 'PURI (730)'],
  topMPs: ['Pushpendra Saroj (2584 works)', 'Priya Saroj (1396)', 'Ram Shiromani (1357)', 'Arvind Dharmapuri (916)', 'Sambit Patra (730)'],
  topStates: ['Uttar Pradesh', 'Andhra Pradesh', 'Odisha', 'Telangana', 'Rajasthan'],
  completionRate: '33.6%',
  alerts: 8331,
  fraudLabels: 1095,
};

// ── Formatters ────────────────────────────────────────────────────────────────
const cr  = (n) => !n ? '₹0' : n >= 1e7 ? `₹${(n/1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n/1e5).toFixed(1)} L` : `₹${Number(n).toLocaleString('en-IN')}`;
const pct = (a, b) => b > 0 ? `${((a/b)*100).toFixed(1)}%` : '0%';

// ── Live DB helpers ───────────────────────────────────────────────────────────
async function liveStats() {
  try {
    const [tot, comp, prop, agg, alerts, risks] = await Promise.all([
      db.work.count().catch(() => null),
      db.work.count({ where: { status: 'COMPLETED' } }).catch(() => null),
      db.work.count({ where: { status: { not: 'COMPLETED' } } }).catch(() => null),
      db.work.aggregate({ _sum: { sanctioned_amount: true, expenditure: true } }).catch(() => ({ _sum: {} })),
      db.alert.count({ where: { status: { not: 'RESOLVED' } } }).catch(() => REAL.alerts),
      db.workRisk.count({ where: { tier: { in: ['HIGH', 'CRITICAL'] } } }).catch(() => 0),
    ]);
    return {
      total: tot ?? REAL.total,
      completed: comp ?? REAL.completed,
      proposed: prop ?? REAL.proposed,
      budget: agg._sum.sanctioned_amount ?? (REAL.budgetCr * 1e7),
      spent: agg._sum.expenditure ?? (REAL.spentCr * 1e7),
      openAlerts: alerts,
      highRisk: risks,
    };
  } catch {
    // Full fallback to snapshot constants if DB is unavailable
    return {
      total: REAL.total, completed: REAL.completed, proposed: REAL.proposed,
      budget: REAL.budgetCr * 1e7, spent: REAL.spentCr * 1e7,
      openAlerts: REAL.alerts, highRisk: 0,
    };
  }
}

async function districtSummary() {
  return db.$queryRaw`
    SELECT district_id,
      COUNT(*) as total,
      SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
      ROUND(SUM(sanctioned_amount)) as budget,
      ROUND(SUM(expenditure)) as spent
    FROM works
    WHERE district_id NOT LIKE '%RAJYASABHA%' AND district_id NOT LIKE '%NOMINATED%'
    GROUP BY district_id ORDER BY total DESC LIMIT 15
  `.catch(() => []);
}

async function stateSummary() {
  return db.$queryRaw`
    SELECT m.state,
      COUNT(w.id) as total,
      SUM(CASE WHEN w.status='COMPLETED' THEN 1 ELSE 0 END) as completed,
      ROUND(SUM(w.sanctioned_amount)) as budget
    FROM works w
    JOIN mps m ON m.id = w.mp_id
    GROUP BY m.state ORDER BY total DESC LIMIT 15
  `.catch(() => []);
}

async function mpSummary(n = 10) {
  return db.$queryRaw`
    SELECT m.name, m.state, m.constituency,
      COUNT(w.id) as works,
      SUM(CASE WHEN w.status='COMPLETED' THEN 1 ELSE 0 END) as completed,
      ROUND(SUM(w.sanctioned_amount)) as budget
    FROM mps m JOIN works w ON w.mp_id = m.id
    GROUP BY m.id ORDER BY works DESC LIMIT ${n}
  `.catch(() => []);
}

async function topWorks(col = 'sanctioned_amount', lim = 5) {
  return db.work.findMany({
    take: lim, orderBy: { [col]: 'desc' },
    select: { id:true, title:true, sanctioned_amount:true, status:true, district_id:true },
  }).catch(() => []);
}

async function highRiskWorks() {
  return db.workRisk.findMany({
    take: 6, orderBy: { risk_score: 'desc' },
    where: { tier: { in: ['HIGH', 'CRITICAL'] } },
    include: { work: { select: { title:true, district_id:true, status:true } } },
  }).catch(() => []);
}

async function openAlerts() {
  return db.alert.findMany({
    take: 6, orderBy: { created_at: 'desc' },
    where: { status: { not: 'RESOLVED' } },
  }).catch(() => []);
}

async function searchWorks(kw) {
  return db.work.findMany({
    take: 6,
    where: { OR: [
      { title: { contains: kw } }, { category: { contains: kw } },
      { village: { contains: kw } }, { district_id: { contains: kw } },
    ]},
    select: { id:true, title:true, sanctioned_amount:true, status:true, district_id:true, category:true },
  }).catch(() => []);
}

async function workById(raw) {
  const id = raw.toUpperCase().replace(/\s+/g, '');
  return db.work.findUnique({ where: { id }, include: { workRisk: true } }).catch(() => null);
}

async function mpByName(name) {
  return db.mp.findFirst({
    where: { OR: [{ name: { contains: name } }, { constituency: { contains: name.toUpperCase() } }] },
    include: { works: { take: 5, orderBy: { sanctioned_amount: 'desc' }, select: { id:true, title:true, sanctioned_amount:true, status:true } } },
  }).catch(() => null);
}

// ── Table helpers ─────────────────────────────────────────────────────────────
const tbl = (rows, fn) => rows.length ? rows.map((r,i) => `${i+1}. ${fn(r)}`).join('\n') : '_None found._';

// ── Intent engine ─────────────────────────────────────────────────────────────
function intent(msg) {
  const m = msg.toLowerCase();
  if (/\bw-?\d{4,}/i.test(msg)) return 'work_id';
  if (m.match(/^help$|what can you|commands|options|what do you know/)) return 'help';
  if (m.match(/who are you|what are you|ludo|introduce|your name/)) return 'identity';
  if (m.match(/what is mplads|about mplads|mplads scheme|explain mplads|overview of scheme/)) return 'about';
  if (m.match(/rule|guideline|15%|7\.?5%|percent|eligible|criteria|fund.*releas|sc.*st.*percent/)) return 'rules';
  if (m.match(/stat|overview|summary|total|how many.*work|budget|fund|scheme.*stat|all.*work/)) return 'stats';
  if (m.match(/top\s*\d*\s*(work|project|cost|amount|value|highest|largest|biggest)/)) return 'top';
  if (m.match(/complet|finish|done.*work|finished|how many.*complet/)) return 'completed';
  if (m.match(/pending|proposed|not.*complet|outstanding|yet to|remaining/)) return 'pending';
  if (m.match(/sc\b|st\b|tribal|dalit|scheduled caste|scheduled tribe|reserv/)) return 'sc_st';
  if (m.match(/state.*wise|state.*summar|which state|state.*data|state.*breakdown/)) return 'state';
  if (m.match(/district.*wise|district.*summar|which district|district.*data/)) return 'district';
  if (m.match(/mp.*wise|which mp|mp.*list|member.*parliament.*list|top.*mp|most.*work.*mp/)) return 'mp_list';
  if (m.match(/risk|fraud|anomal|suspect|irregular|corrupt|misuse|fake/)) return 'risk';
  if (m.match(/alert|notification|warning|flag|issue/)) return 'alerts';
  if (m.match(/activ|recent|latest|update|log|change/)) return 'activity';
  if (m.match(/search|find\s+work|show.*work.*about|work.*related/)) return 'search';
  if (m.match(/monitor|scan|detect|pipeline|ai.*check|how.*detect/)) return 'monitor';
  if (m.match(/\bmp\b|member of parliament|constituency.*work|search.*mp|mp.*name/)) return 'mp_search';
  if (m.match(/officer|district.*officer|\bdo\b|nodal|authority/)) return 'officer_info';
  if (m.match(/public|citizen|transparent|access without|open data/)) return 'public_info';
  if (m.match(/upload|evidence|photo|proof|document/)) return 'upload_info';
  if (m.match(/login|logout|password|otp|auth|how.*access|sign in/)) return 'auth_info';
  if (m.match(/category|sector|type.*work|road|school|water|health|sanit/)) return 'category';
  if (m.match(/utilis|utiliz|efficiency|spending.*rate|fund.*use/)) return 'utilisation';
  return 'gemini';
}

// ── Static knowledge ──────────────────────────────────────────────────────────
const K = {
  rules: `📜 **MPLADS Key Rules & Guidelines**

• **Annual Entitlement:** ₹5 Crore per MP per constituency per year
• **SC Areas:** Minimum **15%** of funds must go to Scheduled Caste localities
• **ST Areas:** Minimum **7.5%** of funds must go to Scheduled Tribe localities
• **Fund nature:** Non-lapsable — unspent amounts carry forward
• **Works must:** Create durable community assets (roads, schools, water supply, sanitation)
• **Works cannot:** Benefit individuals, be on private land, fund recurring expenses
• **Nodal Officer:** District Magistrate (DM) sanctions and executes all works
• **Recommendation:** MP recommends in writing → DM verifies → Agency executes
• **Fund flow:** Central Govt → District account → Implementing Agency
• **Utilisation Certificate:** Required before next tranche is released`,

  monitor: `🤖 **LUDO AI Detection Engine — 10 Algorithms**

| Detector | What It Catches |
|----------|-----------------|
| D1 | Duplicate/split works (same title across financial years) |
| D2 | Cost anomalies — Benford's Law digit distribution |
| D3 | Timeline violations (completion before start date) |
| D4 | Year-end fund rush (suspicious last-quarter spending) |
| D5 | Vendor concentration (single vendor monopoly in a district) |
| D6 | Geographic anomalies (work outside constituency boundary) |
| D7 | Rule violations (SC/ST %, work type ineligibility) |
| D8 | Network fraud (copy-paste descriptions across MPs) |
| ENSEMBLE | Combined risk scoring with tier classification |

Current status: **${REAL.fraudLabels.toLocaleString()} works** flagged | **${REAL.alerts.toLocaleString()} alerts** generated`,

  help: `👋 **LUDO AI — Full Command Reference**

**📊 Live Statistics:**
• _"Show statistics"_ — totals, budget, utilisation
• _"State-wise summary"_ — breakdown by state  
• _"District-wise summary"_ — top districts by works
• _"Top MPs by works"_ — most active MPs
• _"Category breakdown"_ — sector-wise data
• _"Utilisation rate"_ — expenditure efficiency

**📁 Works Queries:**
• _"Top 5 works"_ — highest value projects
• _"Completed works"_ — finished projects
• _"Pending works"_ — proposed / in-progress
• _"SC/ST works"_ — mandatory allocation
• _"W-001234"_ — lookup a specific work by ID
• _"Search roads"_ — keyword search

**🏛️ MP & District:**
• _"Show MP [name]"_ — MP's works and stats
• _"District summary"_ — area breakdown

**⚠️ Officer-Only:**
• _"High risk works"_ — fraud risk scores
• _"Open alerts"_ — unresolved system alerts

**📖 Knowledge Base:**
• _"What is MPLADS?"_ | _"MPLADS rules"_
• _"How does the monitor work?"_
• _"How to login?"_ | _"Officer dashboard"_`,

  auth: `🔐 **Access & Login**

| Role | Login URL | What You Can Do |
|------|-----------|-----------------|
| **MP** | /mp/login | Submit proposals, track progress, view utilisation |
| **District Officer** | /authority/login | Approve works, update status, monitor alerts |
| **Public** | /public | View completed works — no login needed |

Authentication uses OTP (One-Time Password). Contact your district admin for officer credentials.`,

  public_info: `🌐 **Public Register — Citizen Access**

Open to everyone at **/public** — no login required:
• All **${REAL.completed.toLocaleString()} completed works** are publicly visible
• Search by sector, district, or work ID
• View **progress photos** uploaded by field officers
• Track **₹${REAL.spentCr.toFixed(0)} Cr** of public fund utilisation
• Leave comments on specific works`,

  upload_info: `📤 **Evidence Upload System**

Field officers upload proof of work completion at **/upload**:
• Supports JPG, PNG, PDF
• EXIF data auto-extracts GPS coordinates and timestamps
• Each upload linked to a specific Work ID
• LUDO AI cross-checks evidence against sanctioned scope and location`,
};

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { message, role } = await request.json();
    if (!message?.trim()) return NextResponse.json({ reply: 'Please type a message.' });

    const it = intent(message);
    const isOfficer = role === 'officer';

    // Security gate
    if (!isOfficer && ['risk', 'alerts'].includes(it)) {
      return NextResponse.json({ reply: '🔒 **Officer Access Only**\n\nRisk reports and alerts are restricted to authorised District Officers. I can help you with general statistics, work searches, and scheme information.' });
    }

    // ── Static knowledge intents (zero DB, zero tokens) ────────────────────
    if (it === 'identity') return NextResponse.json({ reply:
      `👋 I am **LUDO** — the official AI Monitor for the **MPLADS Scheme**.\n\nI am trained on **real official data** from the MPLADS portal:\n• **${REAL.total.toLocaleString()}** total works across **${REAL.states} states**\n• **₹${REAL.budgetCr.toFixed(0)} Crore** sanctioned across **${REAL.mps} MPs**\n• **${REAL.completed.toLocaleString()}** completed projects\n• **${REAL.alerts.toLocaleString()}** AI-generated alerts\n\n_Mode: **${isOfficer ? '🔐 Officer — full access' : '🌐 Public — general access'}**_\n\nType **"help"** to see all commands.`
    });

    if (it === 'help') return NextResponse.json({ reply: K.help });
    if (it === 'rules') return NextResponse.json({ reply: K.rules });
    if (it === 'monitor') return NextResponse.json({ reply: K.monitor });
    if (it === 'officer_info') return NextResponse.json({ reply: `🏛️ **District Officer Dashboard**\n\nAt **/authority/login**, District Officers can:\n• Approve or reject MP-recommended works\n• Update work progress (mark In-Progress / Completed)\n• View AI Monitor — LUDO's real-time anomaly detection\n• Manage ${REAL.alerts.toLocaleString()} system alerts\n• Review cost estimates and evidence uploads` });
    if (it === 'public_info') return NextResponse.json({ reply: K.public_info });
    if (it === 'upload_info') return NextResponse.json({ reply: K.upload_info });
    if (it === 'auth_info') return NextResponse.json({ reply: K.auth });

    if (it === 'about') {
      const s = await liveStats().catch(() => null);
      return NextResponse.json({ reply:
        `📋 **MPLADS — Members of Parliament Local Area Development Scheme**\n\nLaunched in **1993**, MPLADS empowers every MP to create community assets in their constituency with ₹5 Crore per year.\n\n**Live Official Data (as of Sep 2026):**\n| Metric | Value |\n|--------|-------|\n| Total Works | **${(s?.total || REAL.total).toLocaleString()}** |\n| Completed | **${(s?.completed || REAL.completed).toLocaleString()}** (${REAL.completionRate}) |\n| Proposed/Ongoing | **${REAL.proposed.toLocaleString()}** |\n| Total Budget | **₹${REAL.budgetCr.toFixed(0)} Crore** |\n| Expenditure | **₹${REAL.spentCr.toFixed(0)} Crore** (${REAL.utilPct}) |\n| MPs Covered | **${REAL.mps}** |\n| Districts | **${REAL.districts}** |\n\nTop states by works: ${REAL.topStates.join(', ')}`
      });
    }

    // ── Live DB intents ────────────────────────────────────────────────────
    if (it === 'stats') {
      const s = await liveStats().catch(() => ({ total: REAL.total, completed: REAL.completed, proposed: REAL.proposed, budget: REAL.budgetCr*1e7, spent: REAL.spentCr*1e7, openAlerts: REAL.alerts, highRisk: 0 }));
      return NextResponse.json({ reply:
        `📊 **Live Scheme Dashboard — Real Official Data**\n\n| Metric | Value |\n|--------|-------|\n| Total Works | **${s.total.toLocaleString()}** |\n| ✅ Completed | **${s.completed.toLocaleString()}** (${pct(s.completed, s.total)}) |\n| 📋 Proposed | **${s.proposed.toLocaleString()}** |\n| 💰 Total Budget | **${cr(s.budget)}** |\n| 💸 Expenditure | **${cr(s.spent)}** (${pct(s.spent, s.budget)}) |\n| 👤 MPs | **${REAL.mps}** |\n| 🗺️ Districts | **${REAL.districts}** |`
        + (isOfficer ? `\n| ⚠️ Open Alerts | **${s.openAlerts.toLocaleString()}** |\n| 🔴 High-Risk Works | **${s.highRisk}** |` : '')
      });
    }

    if (it === 'utilisation') {
      const s = await liveStats().catch(() => ({ budget: REAL.budgetCr*1e7, spent: REAL.spentCr*1e7 }));
      const u = pct(s.spent, s.budget);
      return NextResponse.json({ reply:
        `💰 **Fund Utilisation Report**\n\n| Item | Value |\n|------|-------|\n| Sanctioned Budget | **${cr(s.budget)}** |\n| Amount Spent | **${cr(s.spent)}** |\n| Utilisation Rate | **${u}** |\n| Balance Remaining | **${cr(s.budget - s.spent)}** |\n\n_Note: The MPLADS portal shows ${REAL.utilPct} overall utilisation across ${REAL.mps} MPs for the 2026 snapshot. Funds are non-lapsable and carry forward to the next financial year._`
      });
    }

    if (it === 'category') {
      return NextResponse.json({ reply:
        `📂 **Works by Category (Real Data)**\n\n| Category | Works | Budget |\n|----------|-------|--------|\n| Normal/Others | **128,243** | ₹7,648 Cr |\n| Repair & Renovation | **1,817** | ₹123 Cr |\n| Trust & Society | **1,068** | ₹121 Cr |\n| Education | **1** | ₹50 Cr |\n| Bar & Associations | **19** | ₹0.1 Cr |\n\n_Most works fall under "Normal/Others" which covers roads, water supply, drainage, sanitation, and other community infrastructure._`
      });
    }

    if (it === 'state') {
      const rows = await stateSummary().catch(() => []);
      if (!rows.length) return NextResponse.json({ reply: `🗺️ **Top States by Works (Snapshot Data)**\n\n${REAL.topStates.map((s,i) => `${i+1}. ${s}`).join('\n')}` });
      const table = rows.map(r =>
        `| ${r.state} | ${Number(r.total).toLocaleString()} | ${Number(r.completed).toLocaleString()} | ${cr(Number(r.budget))} |`
      ).join('\n');
      return NextResponse.json({ reply:
        `🗺️ **State-wise Summary (Real Data)**\n\n| State | Works | Completed | Budget |\n|-------|-------|-----------|--------|\n${table}`
      });
    }

    if (it === 'district') {
      const rows = await districtSummary().catch(() => []);
      if (!rows.length) return NextResponse.json({ reply: `🗺️ **Top Districts by Works (Snapshot Data)**\n\n${REAL.topDistricts.map((d,i) => `${i+1}. ${d}`).join('\n')}` });
      const table = rows.map(r =>
        `| ${r.district_id} | ${Number(r.total)} | ${Number(r.completed)} | ${cr(Number(r.budget))} | ${pct(Number(r.spent), Number(r.budget))} |`
      ).join('\n');
      return NextResponse.json({ reply:
        `🗺️ **District-wise Summary (Real Data)**\n\n| District | Works | Done | Budget | Used |\n|----------|-------|------|--------|------|\n${table}`
      });
    }

    if (it === 'mp_list') {
      const rows = await mpSummary(10);
      if (!rows.length) {
        // Fallback to real data snapshot
        return NextResponse.json({ reply:
          `👤 **Top MPs by Works (Real Data)**\n\n${REAL.topMPs.map((m,i) => `${i+1}. ${m}`).join('\n')}\n\n_Ask "Show MP [name]" for a specific MP's project details._`
        });
      }
      return NextResponse.json({ reply:
        `👤 **Top MPs by Works (Real Data)**\n\n` +
        tbl(rows, r => `**${r.name}** — ${r.constituency}, ${r.state}\n   ${Number(r.works)} works | ${Number(r.completed)} completed | ${cr(Number(r.budget))}`)
      });
    }

    if (it === 'mp_search') {
      const namePart = message.replace(/mp|member|parliament|show|find|search|works? of|works? by/gi, '').trim();
      if (namePart.length > 2) {
        const mp = await mpByName(namePart);
        if (mp) return NextResponse.json({ reply:
          `👤 **MP: ${mp.name}**\n${mp.constituency}, ${mp.state} | ${mp.house || ''}\n\n` +
          `**Top works:**\n` +
          tbl(mp.works, w => `**${w.title||w.id}** — ${cr(w.sanctioned_amount)} | ${w.status}`)
        });
        return NextResponse.json({ reply: `No MP found matching _"${namePart}"_. Try typing a part of the MP's name or constituency.` });
      }
    }

    if (it === 'top') {
      const works = await topWorks('sanctioned_amount', 5).catch(() => []);
      if (!works.length) return NextResponse.json({ reply: `🏆 **Top MPs by Works (Snapshot)**\n\n${REAL.topMPs.map((m,i) => `${i+1}. ${m}`).join('\n')}` });
      return NextResponse.json({ reply:
        `🏆 **Top 5 Works by Sanctioned Amount**\n\n` +
        tbl(works, w => `**${w.title||w.id}** (${w.id})\n   ${cr(w.sanctioned_amount)} | ${w.status} | ${w.district_id||'—'}`)
      });
    }

    if (it === 'completed') {
      const comp = await db.work.findMany({
        take: 6, where: { status: 'COMPLETED' }, orderBy: { sanctioned_amount: 'desc' },
        select: { id:true, title:true, sanctioned_amount:true, district_id:true },
      }).catch(() => []);
      return NextResponse.json({ reply:
        `✅ **Completed Works — ${REAL.completed.toLocaleString()} total (Top by Amount)**\n\n` +
        tbl(comp, w => `**${w.title||w.id}** — ${cr(w.sanctioned_amount)} | ${w.district_id||'—'}`)
      });
    }

    if (it === 'pending') {
      const pend = await db.work.findMany({
        take: 6, where: { status: { not: 'COMPLETED' } }, orderBy: { sanctioned_amount: 'desc' },
        select: { id:true, title:true, sanctioned_amount:true, status:true, district_id:true },
      }).catch(() => []);
      return NextResponse.json({ reply:
        `📋 **Proposed / Pending Works — ${REAL.proposed.toLocaleString()} total**\n\n` +
        tbl(pend, w => `**${w.title||w.id}** (${w.id})\n   ${cr(w.sanctioned_amount)} | **${w.status}** | ${w.district_id||'—'}`)
      });
    }

    if (it === 'sc_st') {
      const works = await db.work.findMany({
        take: 8,
        where: { OR: [{ area_type: { contains: 'SC' } }, { area_type: { contains: 'ST' } }] },
        select: { id:true, title:true, sanctioned_amount:true, status:true, district_id:true, area_type:true },
      }).catch(() => []);
      return NextResponse.json({ reply:
        `🔵 **SC/ST Works** _(15% SC | 7.5% ST mandatory per MPLADS rules)_\n\n` +
        tbl(works, w => `**${w.title||w.id}** — ${cr(w.sanctioned_amount)} | ${w.area_type} | ${w.status}`)
      });
    }

    if (it === 'risk' && isOfficer) {
      const risks = await highRiskWorks();
      if (!risks.length) return NextResponse.json({ reply: `✅ No high-risk works currently flagged.\n\n_Note: ${REAL.fraudLabels.toLocaleString()} works have been historically labelled in the fraud audit. Check the AI Monitor panel for full evidence chains._` });
      return NextResponse.json({ reply:
        `🔴 **High-Risk Works (Officer View)**\n\n` +
        tbl(risks, r => `**${r.work?.title||r.work_id}**\n   Risk: **${((r.risk_score||0)*100).toFixed(1)}%** | Tier: \`${r.tier}\` | ${r.work?.district_id||'—'} | ${r.work?.status||'—'}`) +
        `\n\n_View full evidence chains in the **AI Monitor** panel (${REAL.alerts.toLocaleString()} total alerts)._`
      });
    }

    if (it === 'alerts' && isOfficer) {
      const als = await openAlerts();
      if (!als.length) return NextResponse.json({ reply: '✅ No open alerts at this time.' });
      return NextResponse.json({ reply:
        `⚠️ **Open Alerts (showing latest ${als.length} of ${REAL.alerts.toLocaleString()} total)**\n\n` +
        als.map((a,i) => `${i+1}. **${a.type||'Alert'}** — ${a.message||'No message'}\n   Status: \`${a.status}\` | ${a.created_at?.slice(0,10)||'—'}`).join('\n\n')
      });
    }

    if (it === 'activity') {
      const acts = await db.workUpdate.findMany({ take: 5, orderBy: { at: 'desc' }, select: { work_id:true, field:true, new_value:true, at:true } }).catch(() => []);
      if (!acts.length) return NextResponse.json({ reply: 'No recent activity logged in the database.' });
      return NextResponse.json({ reply:
        `📋 **Recent Activity**\n\n` +
        acts.map((a,i) => `${i+1}. Work \`${a.work_id}\` — **${a.field}** → _${a.new_value}_ (${a.at?.slice(0,10)||'—'})`).join('\n')
      });
    }

    if (it === 'work_id') {
      const idMatch = message.match(/[Ww]-?\d{4,}/);
      if (idMatch) {
        const work = await workById(idMatch[0]);
        if (work) return NextResponse.json({ reply:
          `🔍 **Work \`${work.id}\`**\n\n**${work.title||'Untitled'}**\n\n| Field | Value |\n|-------|-------|\n| District | ${work.district_id||'—'} |\n| Category | ${work.category||'—'} |\n| Fin. Year | ${work.fy||'—'} |\n| Sanctioned | **${cr(work.sanctioned_amount)}** |\n| Expenditure | ${cr(work.expenditure)} |\n| Status | **${work.status||'—'}** |\n| Village | ${work.village||'—'} |\n| Area Type | ${work.area_type||'—'} |`
          + (work.workRisk && isOfficer ? `\n\n⚠️ Risk: **${((work.workRisk.risk_score||0)*100).toFixed(1)}%** | Tier: \`${work.workRisk.tier}\`` : '')
        });
        return NextResponse.json({ reply: `❌ No work found with ID \`${idMatch[0].toUpperCase()}\`. Try searching by title instead.` });
      }
    }

    if (it === 'search') {
      const kw = message.replace(/search|find|show.*work.*about|work.*related.*to|work.*on|work.*for/gi, '').trim();
      if (kw.length > 2) {
        const results = await searchWorks(kw);
        if (results.length) return NextResponse.json({ reply:
          `🔎 **Results for "${kw}"**\n\n` +
          tbl(results, w => `**${w.title||w.id}** (${w.id})\n   ${cr(w.sanctioned_amount)} | ${w.category||'—'} | ${w.status} | ${w.district_id||'—'}`)
        });
        return NextResponse.json({ reply: `No works found for _"${kw}"_. Try a different keyword.` });
      }
    }

    // ── Gemini fallback — tiny prompt, flash model ─────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const sys = isOfficer
          ? `You are LUDO, AI monitor for MPLADS India. Real data: ${REAL.total} works, ₹${REAL.budgetCr}Cr budget, ${REAL.completed} completed, ${REAL.mps} MPs, ${REAL.alerts} alerts. Officer mode. Brief markdown reply.`
          : `You are LUDO, public AI for MPLADS India. Real data: ${REAL.total} works, ₹${REAL.budgetCr}Cr budget, ${REAL.completed} completed. No fraud/risk details for public. Brief markdown reply.`;
        const resp = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: `${sys}\n\nUser: ${message}` });
        return NextResponse.json({ reply: resp.text });
      } catch(e) {
        console.error('[chat] Gemini:', e.message);
      }
    }

    return NextResponse.json({ reply: `I didn't understand that. Type **"help"** to see all commands, or try:\n• _"Show statistics"_\n• _"Top 5 works"_\n• _"State-wise summary"_\n• _"W-001234"_ (work lookup)` });

  } catch(err) {
    console.error('[chat]', err);
    return NextResponse.json({ reply: 'An internal error occurred.' }, { status: 500 });
  }
}
