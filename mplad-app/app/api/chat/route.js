import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import db from '../../../lib/db';

export const dynamic = 'force-dynamic';

// ── DB helpers ────────────────────────────────────────────────────────────────
async function getStats() {
  try {
    const [total, completed, inProgress, sanctioned] = await Promise.all([
      db.work.count(),
      db.work.count({ where: { status: 'COMPLETED' } }),
      db.work.count({ where: { status: 'IN_PROGRESS' } }),
      db.work.count({ where: { status: 'SANCTIONED' } }),
    ]);
    const agg = await db.work.aggregate({ _sum: { sanctioned_amount: true, expenditure: true } });
    return {
      total, completed, inProgress, sanctioned,
      totalSanctioned: agg._sum.sanctioned_amount || 0,
      totalExpenditure: agg._sum.expenditure || 0,
    };
  } catch { return null; }
}

async function getTopWorks(orderBy = 'sanctioned_amount', limit = 5) {
  try {
    return await db.work.findMany({
      take: limit,
      orderBy: { [orderBy]: 'desc' },
      select: { id: true, title: true, sanctioned_amount: true, status: true, district_id: true, fy: true },
    });
  } catch { return []; }
}

async function searchWorks(keyword, limit = 8) {
  try {
    return await db.work.findMany({
      take: limit,
      where: {
        OR: [
          { title: { contains: keyword } },
          { category: { contains: keyword } },
          { village: { contains: keyword } },
          { district_id: { contains: keyword } },
        ],
      },
      select: { id: true, title: true, sanctioned_amount: true, status: true, district_id: true, category: true },
    });
  } catch { return []; }
}

async function getWorkById(id) {
  try {
    return await db.work.findUnique({ where: { id: id.toUpperCase() } });
  } catch { return null; }
}

async function getRiskyWorks(limit = 5) {
  try {
    return await db.workRisk.findMany({
      take: limit,
      orderBy: { risk_score: 'desc' },
      include: { work: { select: { title: true, district_id: true, status: true } } },
    });
  } catch { return []; }
}

async function getDistrictSummary() {
  try {
    return await db.$queryRaw`
      SELECT district_id, COUNT(*) as total,
        SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(sanctioned_amount) as total_amount
      FROM works
      GROUP BY district_id
      ORDER BY total DESC
      LIMIT 12
    `;
  } catch { return []; }
}

function fmt(n) {
  if (!n) return '₹0';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

// ── Intent detection ──────────────────────────────────────────────────────────
function detectIntent(msg) {
  const m = msg.toLowerCase();
  if (/^w-?\d{5,}$/i.test(msg.trim())) return 'work_lookup';
  if (m.match(/work\s+(id\s+)?[a-z]?[-\s]?\d{3,}/)) return 'work_lookup';
  if (m.includes('risk') || m.includes('fraud') || m.includes('anomal') || m.includes('alert')) return 'risk';
  if (m.match(/top\s*\d*\s*(work|project|highest|cost|amount)/)) return 'top_works';
  if (m.match(/district|state|area|region/)) return 'district';
  if (m.match(/stat|summar|overview|total|count|how many|budget|fund/)) return 'stats';
  if (m.match(/complet|finish|done/)) return 'completed';
  if (m.match(/sc|st|tribal|dalit|reserv/)) return 'sc_st';
  if (m.match(/search|find|show.*about|works? (on|about|related|for)/)) return 'search';
  if (m.match(/what is mplads|about mplads|mplads scheme|explain mplads/)) return 'about';
  if (m.match(/who are you|what are you|ludo|your name|introduce/)) return 'identity';
  if (m.match(/rule|guideline|percent|15%|7\.?5%|eligib|fund releas|criteria/)) return 'rules';
  return 'general';
}

// ── Reply builders ────────────────────────────────────────────────────────────
function worksTable(works) {
  if (!works.length) return '_No works found._';
  return works.map((w, i) =>
    `**${i + 1}. ${w.title || w.id}**\n` +
    `   • ID: \`${w.id}\` | District: ${w.district_id || '—'}\n` +
    `   • Amount: ${fmt(w.sanctioned_amount)} | Status: ${w.status || '—'}`
  ).join('\n\n');
}

// ── Main route ────────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { message, role } = await request.json();
    if (!message?.trim()) return NextResponse.json({ reply: 'Please type a message.' });

    const intent = detectIntent(message);

    // Security gate
    if (role === 'public' && ['risk'].includes(intent)) {
      return NextResponse.json({
        reply: '🔒 **Restricted:** Internal risk alerts and fraud information are only available to authorised District Officers. I can help you with general scheme information, project statuses, and district-level summaries.',
      });
    }

    // ── Structured intents (fast, DB-backed) ──────────────────────────────────
    if (intent === 'identity') {
      return NextResponse.json({
        reply: `👋 I am **LUDO** — the official AI Monitor for the **MPLADS Scheme**.\n\nI have real-time access to all project data — works, budgets, district summaries, risk scores, and compliance alerts. Ask me anything about the scheme or any specific project.\n\n_Mode: **${role === 'officer' ? '🔐 Officer (Full Access)' : '🌐 Public (General Access)'}**_`,
      });
    }

    if (intent === 'about') {
      const stats = await getStats();
      return NextResponse.json({
        reply: `📋 **MPLADS — Members of Parliament Local Area Development Scheme**\n\nMPLADS empowers MPs to recommend development works in their constituencies, with annual entitlement of **₹5 Crore** per constituency. Works must create durable community assets.\n\n**Live Data:**\n• Total Works: **${stats?.total?.toLocaleString() || '—'}**\n• Total Budget: **${fmt(stats?.totalSanctioned)}**\n• Completed: **${stats?.completed?.toLocaleString() || '—'}** works\n\n_Ask me to show district summaries, top works, or risk reports._`,
      });
    }

    if (intent === 'rules') {
      return NextResponse.json({
        reply: `📜 **Key MPLADS Guidelines:**\n\n• **SC Areas:** Minimum **15%** of annual funds must be used for works in Scheduled Caste-populated areas\n• **ST Areas:** Minimum **7.5%** for Scheduled Tribe-populated areas\n• Works must benefit the **community, not individuals**\n• Only **durable assets** are eligible (roads, schools, wells, etc.)\n• Funds are **non-lapsable** — unspent amounts carry forward\n• DM (District Magistrate) is the **nodal officer** for work execution\n• Works must be recommended by the **MP in writing**`,
      });
    }

    if (intent === 'stats') {
      const stats = await getStats();
      if (!stats) return NextResponse.json({ reply: 'Unable to fetch statistics right now.' });
      const util = stats.totalSanctioned > 0
        ? ((stats.totalExpenditure / stats.totalSanctioned) * 100).toFixed(1)
        : '0';
      return NextResponse.json({
        reply: `📊 **Scheme Overview (Live Data)**\n\n| Metric | Value |\n|--------|-------|\n| Total Works | **${stats.total.toLocaleString()}** |\n| Completed | **${stats.completed.toLocaleString()}** |\n| In Progress | **${stats.inProgress.toLocaleString()}** |\n| Sanctioned | **${stats.sanctioned.toLocaleString()}** |\n| Total Budget | **${fmt(stats.totalSanctioned)}** |\n| Expenditure | **${fmt(stats.totalExpenditure)}** |\n| Utilisation | **${util}%** |`,
      });
    }

    if (intent === 'top_works') {
      const works = await getTopWorks('sanctioned_amount', 5);
      return NextResponse.json({
        reply: `🏆 **Top 5 Works by Sanctioned Amount**\n\n${worksTable(works)}`,
      });
    }

    if (intent === 'completed') {
      const works = await db.work.findMany({
        take: 8,
        where: { status: 'COMPLETED' },
        orderBy: { sanctioned_amount: 'desc' },
        select: { id: true, title: true, sanctioned_amount: true, status: true, district_id: true },
      }).catch(() => []);
      return NextResponse.json({
        reply: `✅ **Recently Completed Works (Top by Amount)**\n\n${worksTable(works)}`,
      });
    }

    if (intent === 'sc_st') {
      const works = await db.work.findMany({
        take: 8,
        where: { OR: [{ area_type: { contains: 'SC' } }, { area_type: { contains: 'ST' } }] },
        select: { id: true, title: true, sanctioned_amount: true, status: true, district_id: true, area_type: true },
      }).catch(() => []);
      return NextResponse.json({
        reply: `🔵 **SC/ST Works (Mandatory Allocation: 15% SC | 7.5% ST)**\n\n${worksTable(works)}\n\n_As per guidelines, funds for SC/ST areas are tracked separately for compliance._`,
      });
    }

    if (intent === 'district') {
      const rows = await getDistrictSummary();
      if (!rows.length) return NextResponse.json({ reply: 'District data unavailable.' });
      const table = rows.map(r =>
        `| ${r.district_id} | ${Number(r.total)} | ${Number(r.completed)} | ${fmt(r.total_amount)} |`
      ).join('\n');
      return NextResponse.json({
        reply: `🗺️ **District-wise Summary**\n\n| District | Works | Done | Budget |\n|----------|-------|------|--------|\n${table}`,
      });
    }

    if (intent === 'risk' && role === 'officer') {
      const risks = await getRiskyWorks(5);
      if (!risks.length) return NextResponse.json({ reply: 'No risk data available currently.' });
      const list = risks.map((r, i) =>
        `**${i + 1}. ${r.work?.title || r.work_id}**\n` +
        `   • Risk Score: **${(r.risk_score * 100).toFixed(1)}%** | Tier: \`${r.tier || '—'}\`\n` +
        `   • District: ${r.work?.district_id || '—'} | Status: ${r.work?.status || '—'}`
      ).join('\n\n');
      return NextResponse.json({
        reply: `⚠️ **Top 5 High-Risk Works (Officer View)**\n\n${list}\n\n_Run a full fraud scan from the AI Monitor panel for detailed evidence chains._`,
      });
    }

    if (intent === 'work_lookup') {
      const idMatch = message.match(/[Ww]-?\d{4,}/);
      if (idMatch) {
        const id = idMatch[0].toUpperCase().replace('-', '-');
        const work = await getWorkById(id);
        if (work) {
          return NextResponse.json({
            reply: `🔍 **Work Details: \`${work.id}\`**\n\n` +
              `**${work.title || 'Untitled'}**\n\n` +
              `| Field | Value |\n|-------|-------|\n` +
              `| District | ${work.district_id || '—'} |\n` +
              `| Category | ${work.category || '—'} |\n` +
              `| Financial Year | ${work.fy || '—'} |\n` +
              `| Sanctioned | ${fmt(work.sanctioned_amount)} |\n` +
              `| Expenditure | ${fmt(work.expenditure)} |\n` +
              `| Status | **${work.status || '—'}** |\n` +
              `| Village | ${work.village || '—'} |\n` +
              `| Area Type | ${work.area_type || '—'} |`,
          });
        } else {
          return NextResponse.json({ reply: `❌ No work found with ID \`${id}\`. Please check the ID and try again.` });
        }
      }
    }

    if (intent === 'search') {
      const keywords = message.replace(/search|find|show|works? (on|about|related|for)/gi, '').trim();
      if (keywords.length > 2) {
        const works = await searchWorks(keywords);
        if (works.length) {
          return NextResponse.json({
            reply: `🔎 **Search Results for "${keywords}"**\n\n${worksTable(works)}`,
          });
        }
      }
    }

    // ── Gemini fallback ────────────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const stats = await getStats();
        const context = stats
          ? `Live DB context: ${stats.total} total works, ${stats.completed} completed, budget ${fmt(stats.totalSanctioned)}, utilisation ${stats.totalSanctioned > 0 ? ((stats.totalExpenditure / stats.totalSanctioned) * 100).toFixed(1) : 0}%.`
          : '';

        const systemPrompt = role === 'officer'
          ? `You are LUDO, the official AI Monitor for the MPLADS (Members of Parliament Local Area Development Scheme). The user is a District Officer with full access. ${context} Answer concisely, use markdown formatting. For anomalies or risks, be direct and factual.`
          : `You are LUDO, the official AI Assistant for the MPLADS scheme. The user is from the general public. ${context} Provide accurate, helpful general information. Do NOT share fraud alerts, risk scores, or anomaly details — those are officer-only. Use markdown formatting.`;

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `${systemPrompt}\n\nUser: ${message}`,
        });
        return NextResponse.json({ reply: response.text });
      } catch (aiError) {
        console.error('[chat] Gemini error:', aiError.message);
      }
    }

    // ── Final fallback ─────────────────────────────────────────────────────────
    const fallbacks = {
      general: `I am LUDO, the MPLADS AI Monitor. I can help you with:\n\n• **Statistics** — total works, budgets, utilisation\n• **District summaries** — area-wise breakdown\n• **Work lookup** — search by ID or keyword\n• **SC/ST compliance** — mandatory allocation tracking\n${role === 'officer' ? '• **Risk & Anomaly reports** — officer-only\n' : ''}• **Scheme rules** — guidelines and eligibility\n\nWhat would you like to know?`,
    };
    return NextResponse.json({ reply: fallbacks.general });

  } catch (error) {
    console.error('[chat/route] Error:', error);
    return NextResponse.json({ reply: 'An internal error occurred. Please try again.' }, { status: 500 });
  }
}
