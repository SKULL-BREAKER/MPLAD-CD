import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export const dynamic = 'force-dynamic';

// ── Formatters ────────────────────────────────────────────────────────────────
const cr = (n) => n >= 1e7 ? `₹${(n/1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n/1e5).toFixed(1)} L` : `₹${Number(n||0).toLocaleString('en-IN')}`;
const pct = (a,b) => b > 0 ? ((a/b)*100).toFixed(1)+'%' : '0%';

// ── DB helpers (all parallelisable) ──────────────────────────────────────────
async function liveStats() {
  const [tot, comp, inp, sanc, agg, alerts, risks] = await Promise.all([
    db.work.count(),
    db.work.count({ where: { status: 'COMPLETED' } }),
    db.work.count({ where: { status: 'IN_PROGRESS' } }),
    db.work.count({ where: { status: 'SANCTIONED' } }),
    db.work.aggregate({ _sum: { sanctioned_amount: true, expenditure: true } }),
    db.alert.count({ where: { status: { not: 'RESOLVED' } } }).catch(() => 0),
    db.workRisk.count({ where: { tier: { in: ['HIGH','CRITICAL'] } } }).catch(() => 0),
  ]);
  return {
    total: tot, completed: comp, inProgress: inp, sanctioned: sanc,
    budget: agg._sum.sanctioned_amount || 0,
    spent: agg._sum.expenditure || 0,
    openAlerts: alerts, highRisk: risks,
  };
}

async function workById(raw) {
  const id = raw.toUpperCase().replace(/\s+/g, '');
  return db.work.findUnique({
    where: { id },
    include: { workRisk: true },
  }).catch(() => null);
}

async function topWorks(col = 'sanctioned_amount', n = 5) {
  return db.work.findMany({
    take: n, orderBy: { [col]: 'desc' },
    select: { id:true, title:true, sanctioned_amount:true, expenditure:true, status:true, district_id:true },
  }).catch(() => []);
}

async function districtSummary() {
  return db.$queryRaw`
    SELECT district_id,
      COUNT(*) as total,
      SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
      ROUND(SUM(sanctioned_amount)) as budget,
      ROUND(SUM(expenditure)) as spent
    FROM works GROUP BY district_id ORDER BY total DESC LIMIT 14
  `.catch(() => []);
}

async function scStWorks() {
  return db.work.findMany({
    take: 8,
    where: { OR: [{ area_type:{contains:'SC'} }, { area_type:{contains:'ST'} }] },
    select: { id:true, title:true, sanctioned_amount:true, status:true, district_id:true, area_type:true },
  }).catch(() => []);
}

async function highRiskWorks(n = 6) {
  return db.workRisk.findMany({
    take: n, orderBy: { risk_score:'desc' },
    where: { tier: { in: ['HIGH','CRITICAL'] } },
    include: { work: { select: { title:true, district_id:true, status:true } } },
  }).catch(() => []);
}

async function openAlerts(n = 6) {
  return db.alert.findMany({
    take: n, orderBy: { created_at:'desc' },
    where: { status: { not:'RESOLVED' } },
  }).catch(() => []);
}

async function searchWorks(kw) {
  return db.work.findMany({
    take: 6,
    where: { OR: [
      { title:{contains:kw} }, { category:{contains:kw} },
      { village:{contains:kw} }, { district_id:{contains:kw} },
    ]},
    select: { id:true, title:true, sanctioned_amount:true, status:true, district_id:true, category:true },
  }).catch(() => []);
}

async function pendingWorks() {
  return db.work.findMany({
    take: 6,
    where: { status: { in: ['SANCTIONED','IN_PROGRESS'] } },
    orderBy: { sanctioned_amount:'desc' },
    select: { id:true, title:true, sanctioned_amount:true, status:true, district_id:true },
  }).catch(() => []);
}

async function recentActivity() {
  return db.workUpdate.findMany({
    take: 5, orderBy: { at:'desc' },
    select: { work_id:true, field:true, new_value:true, at:true },
  }).catch(() => []);
}

// ── Table builder ─────────────────────────────────────────────────────────────
const tbl = (rows, fn) => rows.length
  ? rows.map((r,i) => `${i+1}. ${fn(r)}`).join('\n')
  : '_None found._';

// ── Intent engine (zero tokens) ───────────────────────────────────────────────
function intent(msg) {
  const m = msg.toLowerCase();
  if (/\bw-?\d{4,}/i.test(msg)) return 'work_id';
  if (m.match(/^help|what can you|commands|options/)) return 'help';
  if (m.match(/who are you|what are you|ludo|introduce|your name/)) return 'identity';
  if (m.match(/what is mplads|about mplads|mplads scheme|explain mplads|overview of scheme/)) return 'about';
  if (m.match(/rule|guideline|15%|7\.?5%|percent|sc.*st|eligib|criteria|fund.*releas/)) return 'rules';
  if (m.match(/stat|overview|summary|total|how many|budget|fund|all works|scheme stat/)) return 'stats';
  if (m.match(/top\s*\d*\s*(work|project|cost|amount|value|highest)/)) return 'top';
  if (m.match(/complet|finish|done|finished/)) return 'completed';
  if (m.match(/pending|in.progress|ongoing|not.*complet|sanctioned/)) return 'pending';
  if (m.match(/sc\b|st\b|tribal|dalit|scheduled caste|scheduled tribe|reserv/)) return 'sc_st';
  if (m.match(/district|state|area|region|zone|constituency/)) return 'district';
  if (m.match(/risk|fraud|anomal|suspect|irregular|corrupt|misuse/)) return 'risk';
  if (m.match(/alert|notification|warning|flag/)) return 'alerts';
  if (m.match(/activ|recent|latest|update|log|change/)) return 'activity';
  if (m.match(/search|find|show.*about|works? (on|for|about|related)/)) return 'search';
  if (m.match(/monitor|scan|detect|pipeline|ai check/)) return 'monitor';
  if (m.match(/mp |member of parliament|mla|constituency|elected/)) return 'mp_info';
  if (m.match(/officer|district.*officer|do |nodal/)) return 'officer_info';
  if (m.match(/public|citizen|view|transparent|access/)) return 'public_info';
  if (m.match(/upload|evidence|photo|proof|document/)) return 'upload_info';
  if (m.match(/login|logout|password|otp|auth|access/)) return 'auth_info';
  return 'gemini';
}

// ── Website knowledge base (hardcoded, zero tokens) ──────────────────────────
const KNOWLEDGE = {
  rules: `📜 **MPLADS Key Rules & Guidelines**

• **SC Areas:** Min **15%** of annual funds must go to Scheduled Caste areas
• **ST Areas:** Min **7.5%** of annual funds must go to Scheduled Tribe areas
• **Annual MP Entitlement:** ₹5 Crore per constituency per year
• **Non-lapsable funds:** Unspent amounts carry forward to next year
• **Works must:** Create durable community assets (roads, schools, wells, drainage)
• **Works cannot:** Benefit individuals, be constructed on private land
• **Nodal Officer:** District Magistrate (DM) executes all sanctioned works
• **Recommendation:** MP must recommend in writing; DM approves and executes
• **Fund release:** Central Government → District account → Implementing agency
• **Completion certificate:** Required before utilisation certificate is submitted`,

  about: `📋 **MPLADS — Members of Parliament Local Area Development Scheme**

Launched in **1993**, MPLADS empowers every MP to create community assets in their constituency.

**How it works:**
1. MP recommends development works in writing to the District Magistrate
2. DM verifies eligibility and sanctions the work
3. Implementing agency executes the work
4. District Officer monitors progress and uploads evidence
5. AI Monitor (LUDO) continuously scans for anomalies

**Eligible sectors:** Roads, Drinking Water, Education, Healthcare, Sanitation, Drainage, Solar Energy, and more.`,

  mp_info: `👤 **MP Workspace (MPLADS)**

The MP Dashboard allows Members of Parliament to:
• **Submit project proposals** — recommend works for their constituency
• **Track progress** — view all sanctioned works by financial year
• **Monitor completion** — real-time status of each project
• **View budget utilisation** — SC/ST mandatory allocation tracking
• **Download reports** — official utilisation certificates

Login at **/mp/login** with your registered credentials.`,

  officer_info: `🏛️ **District Officer Dashboard**

District Officers (DOs) have full administrative access:
• **Approve/Reject** proposed works from MPs
• **Update work progress** — mark as In-Progress or Completed
• **View AI Monitor** — LUDO's real-time anomaly detection
• **Manage alerts** — resolve or escalate flagged works
• **Cost verification** — AI-generated cost estimates vs. sanctioned amounts
• **Evidence review** — photos and documents uploaded by field teams

Login at **/authority/login** with officer credentials.`,

  public_info: `🌐 **Public Register (Transparent Access)**

Citizens can access the public dashboard at **/public** to:
• View **all completed works** without login
• Search by **sector, district, or work ID**
• Track **₹ utilisation** of public funds
• View **progress photos** uploaded by field officers
• Leave **public comments** on individual works

No login required for the public register.`,

  upload_info: `📤 **Evidence Upload System**

Field officers can upload evidence for completed works:
• Supports **photos and documents** (PDF, JPG, PNG)
• EXIF metadata extraction for **GPS coordinates** and timestamp
• Each upload is linked to a specific **Work ID**
• Goes to **/upload** page (officer login required)
• LUDO AI cross-checks evidence against sanctioned scope`,

  auth_info: `🔐 **Login & Access Control**

| Role | Login URL | Access |
|------|-----------|--------|
| MP | /mp/login | Proposal submission, progress tracking |
| Authority | /authority/login | Full admin — approve, update, monitor |
| Public | /public | Read-only, no login required |

OTP-based authentication is used. Contact your district admin for credentials.`,

  monitor: `🤖 **AI Monitor (LUDO Detection Engine)**

LUDO runs **10 detection algorithms** continuously:
• **D1** — Duplicate/split works (same title across FYs)
• **D2** — Cost/Benford law anomalies (unusual digit distributions)
• **D3** — Timeline violations (completion before start date)
• **D4** — Year-end fund rush (suspicious spending patterns)
• **D5** — Vendor concentration (monopoly in a district)
• **D6** — Geographic anomalies (works in wrong constituency)
• **D7** — Rule violations (SC/ST %, work type eligibility)
• **D8** — Network fraud (copy-paste works across MPs)
• **Ensemble** — Combined risk scoring with tier classification
  
Results are visible at **/monitor** (Officer login required).`,

  help: `👋 **LUDO AI — What I can do:**

**Live Data Queries:**
• *"Show overview statistics"* — budget, completion rates
• *"Top 5 works by amount"* — highest value projects
• *"District summary"* — area-wise breakdown
• *"Completed works"* / *"Pending works"*
• *"SC/ST works"* — mandatory allocation tracking
• *"W-001234"* — lookup any specific work by ID
• *"Search schools"* — keyword search across all works

**Officer-Only:**
• *"High risk works"* — fraud risk scores
• *"Open alerts"* — unresolved system alerts
• *"Recent activity"* — latest data changes

**Scheme Knowledge:**
• *"What is MPLADS?"* — scheme overview
• *"MPLADS rules"* — guidelines & percentages
• *"How does the MP portal work?"*
• *"Officer dashboard features"*
• *"How to login?"*`,
};

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { message, role } = await request.json();
    if (!message?.trim()) return NextResponse.json({ reply: 'Please type a message.' });

    const it = intent(message);
    const isOfficer = role === 'officer';

    // Security gate on risk/alerts for public
    if (!isOfficer && ['risk', 'alerts', 'monitor'].includes(it)) {
      return NextResponse.json({
        reply: '🔒 **Officer Access Required**\n\nRisk reports, AI alerts, and the fraud monitor are restricted to authorised District Officers. I can help you with general scheme information, work statuses, and district summaries.',
      });
    }

    // ── Identity / Help ──────────────────────────────────────────────────────
    if (it === 'identity') return NextResponse.json({
      reply: `👋 I am **LUDO**, the official AI Monitor for the **MPLADS Scheme**.\n\nI have live access to the full database — works, budgets, districts, risk scores, and alerts. I also know every section of this website.\n\n_Mode: **${isOfficer ? '🔐 Officer — full access' : '🌐 Public — general access'}**_\n\nType *"help"* to see everything I can do.`,
    });

    if (it === 'help') return NextResponse.json({ reply: KNOWLEDGE.help });
    if (it === 'rules') return NextResponse.json({ reply: KNOWLEDGE.rules });
    if (it === 'about') {
      const s = await liveStats();
      return NextResponse.json({
        reply: KNOWLEDGE.about + `\n\n**Live Stats:** ${s.total.toLocaleString()} total works | ${cr(s.budget)} sanctioned | ${s.completed.toLocaleString()} completed`,
      });
    }
    if (it === 'monitor') return NextResponse.json({ reply: KNOWLEDGE.monitor });
    if (it === 'mp_info') return NextResponse.json({ reply: KNOWLEDGE.mp_info });
    if (it === 'officer_info') return NextResponse.json({ reply: KNOWLEDGE.officer_info });
    if (it === 'public_info') return NextResponse.json({ reply: KNOWLEDGE.public_info });
    if (it === 'upload_info') return NextResponse.json({ reply: KNOWLEDGE.upload_info });
    if (it === 'auth_info') return NextResponse.json({ reply: KNOWLEDGE.auth_info });

    // ── Live DB queries ──────────────────────────────────────────────────────
    if (it === 'stats') {
      const s = await liveStats();
      return NextResponse.json({ reply:
        `📊 **Live Scheme Dashboard**\n\n| Metric | Value |\n|--------|-------|\n| Total Works | **${s.total.toLocaleString()}** |\n| ✅ Completed | **${s.completed.toLocaleString()}** (${pct(s.completed,s.total)}) |\n| 🔄 In Progress | **${s.inProgress.toLocaleString()}** |\n| 📋 Sanctioned | **${s.sanctioned.toLocaleString()}** |\n| 💰 Total Budget | **${cr(s.budget)}** |\n| 💸 Expenditure | **${cr(s.spent)}** (${pct(s.spent,s.budget)}) |`
        + (isOfficer ? `\n| ⚠️ Open Alerts | **${s.openAlerts}** |\n| 🔴 High-Risk Works | **${s.highRisk}** |` : ''),
      });
    }

    if (it === 'top') {
      const works = await topWorks('sanctioned_amount', 5);
      return NextResponse.json({ reply:
        `🏆 **Top 5 Works by Sanctioned Amount**\n\n` +
        tbl(works, w => `**${w.title||w.id}** (${w.id})\n   ${cr(w.sanctioned_amount)} | ${w.status} | ${w.district_id||'—'}`)
      });
    }

    if (it === 'completed') {
      const works = await topWorks('sanctioned_amount', 6);
      const comp = await db.work.findMany({ take:6, where:{status:'COMPLETED'}, orderBy:{sanctioned_amount:'desc'}, select:{id:true,title:true,sanctioned_amount:true,district_id:true} }).catch(()=>[]);
      return NextResponse.json({ reply:
        `✅ **Completed Works (Top by Amount)**\n\n` +
        tbl(comp, w => `**${w.title||w.id}** — ${cr(w.sanctioned_amount)} | ${w.district_id||'—'}`)
      });
    }

    if (it === 'pending') {
      const works = await pendingWorks();
      return NextResponse.json({ reply:
        `🔄 **Pending / In-Progress Works**\n\n` +
        tbl(works, w => `**${w.title||w.id}** (${w.id})\n   ${cr(w.sanctioned_amount)} | **${w.status}** | ${w.district_id||'—'}`)
      });
    }

    if (it === 'sc_st') {
      const works = await scStWorks();
      return NextResponse.json({ reply:
        `🔵 **SC/ST Works** _(15% SC | 7.5% ST mandatory)_\n\n` +
        tbl(works, w => `**${w.title||w.id}** — ${cr(w.sanctioned_amount)} | ${w.area_type} | ${w.status}`)
      });
    }

    if (it === 'district') {
      const rows = await districtSummary();
      if (!rows.length) return NextResponse.json({ reply: 'District data unavailable.' });
      const table = rows.map(r =>
        `| ${r.district_id} | ${Number(r.total)} | ${Number(r.completed)} | ${cr(Number(r.budget))} | ${pct(Number(r.spent),Number(r.budget))} |`
      ).join('\n');
      return NextResponse.json({ reply:
        `🗺️ **District-wise Summary**\n\n| District | Works | Done | Budget | Utilised |\n|----------|-------|------|--------|----------|\n${table}`
      });
    }

    if (it === 'risk' && isOfficer) {
      const risks = await highRiskWorks();
      if (!risks.length) return NextResponse.json({ reply: '✅ No high-risk works flagged currently.' });
      return NextResponse.json({ reply:
        `🔴 **High-Risk Works (Officer View)**\n\n` +
        tbl(risks, r =>
          `**${r.work?.title||r.work_id}**\n   Risk: **${((r.risk_score||0)*100).toFixed(1)}%** | Tier: \`${r.tier}\` | ${r.work?.district_id||'—'} | ${r.work?.status||'—'}`
        ) +
        `\n\n_View full evidence chains in the_ **AI Monitor** _panel._`
      });
    }

    if (it === 'alerts' && isOfficer) {
      const als = await openAlerts();
      if (!als.length) return NextResponse.json({ reply: '✅ No open alerts at this time.' });
      return NextResponse.json({ reply:
        `⚠️ **Open Alerts (${als.length})**\n\n` +
        als.map((a,i) => `${i+1}. **${a.type||'Alert'}** — ${a.message||'No message'}\n   Status: \`${a.status}\` | ${a.created_at?.slice(0,10)||'—'}`).join('\n\n')
      });
    }

    if (it === 'activity') {
      const acts = await recentActivity();
      if (!acts.length) return NextResponse.json({ reply: 'No recent activity found.' });
      return NextResponse.json({ reply:
        `📋 **Recent Activity**\n\n` +
        acts.map((a,i) => `${i+1}. Work \`${a.work_id}\` — **${a.field}** changed to _${a.new_value}_ (${a.at?.slice(0,10)||'—'})`).join('\n')
      });
    }

    if (it === 'work_id') {
      const idMatch = message.match(/[Ww]-?\d{4,}/);
      if (idMatch) {
        const work = await workById(idMatch[0]);
        if (work) return NextResponse.json({ reply:
          `🔍 **Work \`${work.id}\`**\n\n**${work.title||'Untitled'}**\n\n| Field | Value |\n|-------|-------|\n| District | ${work.district_id||'—'} |\n| Category | ${work.category||'—'} |\n| Fin. Year | ${work.fy||'—'} |\n| Sanctioned | ${cr(work.sanctioned_amount)} |\n| Expenditure | ${cr(work.expenditure)} |\n| Status | **${work.status||'—'}** |\n| Village | ${work.village||'—'} |\n| Area Type | ${work.area_type||'—'} |`
          + (work.workRisk && isOfficer ? `\n\n⚠️ Risk Score: **${((work.workRisk.risk_score||0)*100).toFixed(1)}%** | Tier: \`${work.workRisk.tier}\`` : '')
        });
        return NextResponse.json({ reply: `❌ No work found with ID \`${idMatch[0].toUpperCase()}\`.` });
      }
    }

    if (it === 'search') {
      const kw = message.replace(/search|find|show.*about|works?\s+(on|for|about|related\s+to)/gi,'').trim();
      if (kw.length > 2) {
        const results = await searchWorks(kw);
        if (results.length) return NextResponse.json({ reply:
          `🔎 **Search: "${kw}"**\n\n` +
          tbl(results, w => `**${w.title||w.id}** (${w.id})\n   ${cr(w.sanctioned_amount)} | ${w.category||'—'} | ${w.status} | ${w.district_id||'—'}`)
        });
        return NextResponse.json({ reply: `No works found matching _"${kw}"_.` });
      }
    }

    // ── Gemini fallback (tiny prompt, cheap model) ───────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const s = await liveStats();
        const ai = new GoogleGenAI({ apiKey });
        const sys = isOfficer
          ? `You are LUDO, AI monitor for MPLADS (India). DB: ${s.total} works, ${cr(s.budget)} budget, ${s.completed} completed, ${s.openAlerts} alerts. Officer mode. Be brief, use markdown.`
          : `You are LUDO, public AI for MPLADS (India). DB: ${s.total} works, ${cr(s.budget)} budget, ${s.completed} completed. No fraud/risk details for public. Be brief, use markdown.`;
        const resp = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: `${sys}\n\nUser: ${message}`,
        });
        return NextResponse.json({ reply: resp.text });
      } catch (e) {
        console.error('[chat] Gemini:', e.message);
      }
    }

    // ── Final fallback ───────────────────────────────────────────────────────
    return NextResponse.json({
      reply: `I didn't understand that query. Type **"help"** to see all available commands, or ask me something like:\n• _"Show statistics"_\n• _"Top 5 works"_\n• _"District summary"_\n• _"W-001234"_ (look up a specific work)`,
    });

  } catch (err) {
    console.error('[chat]', err);
    return NextResponse.json({ reply: 'An internal error occurred.' }, { status: 500 });
  }
}
