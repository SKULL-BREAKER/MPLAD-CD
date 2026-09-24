import Link from 'next/link';
import db from '../lib/db';

// ── Sector colour map ──────────────────────────────────────────────────────────
const SECTOR_COLORS = {
  'Drinking Water': '#0EA5E9', 'Education': '#8B5CF6', 'Electricity': '#F59E0B',
  'Non-Conventional Energy': '#10B981', 'Healthcare & Sanitation': '#EF4444',
  'Irrigation': '#14B8A6', 'Railways/Roads/Bridges': '#6B7280', 'Sports': '#F97316',
  'Agriculture': '#84CC16', 'Self-Help Group': '#EC4899', 'Urban Development': '#38BDF8',
  'Other': '#94A3B8',
};

// ── Permissible / Non-permissible classification ───────────────────────────────
const PERMISSIBLE = [
  { sector: 'Drinking Water',         examples: 'Bore wells, overhead tanks, pipelines, hand pumps',        icon: '' },
  { sector: 'Education',              examples: 'School buildings, libraries, labs, sports grounds',         icon: '' },
  { sector: 'Healthcare & Sanitation',examples: 'PHC buildings, toilets, sanitation units, nallahs',         icon: '' },
  { sector: 'Electricity',            examples: 'Street lights, electrification, transformers',              icon: '' },
  { sector: 'Non-Conventional Energy',examples: 'Solar panels, biogas plants, wind energy units',            icon: '️' },
  { sector: 'Irrigation',             examples: 'Field channels, minor irrigation, check dams',              icon: '' },
  { sector: 'Railways/Roads/Bridges', examples: 'Rural roads, culverts, bridges, footpaths',                icon: '️' },
  { sector: 'Sports',                 examples: 'Playgrounds, sports equipment, gymnasiums',                 icon: '' },
  { sector: 'Agriculture',            examples: 'Seed banks, godowns, soil testing labs',                   icon: '' },
  { sector: 'Self-Help Group',        examples: 'SHG training centres, common facility centres',             icon: '' },
  { sector: 'Urban Development',      examples: 'Community centres, parks, solid waste units',               icon: '️' },
];
const NON_PERMISSIBLE = [
  'Works of individual benefit (houses, individual toilets)',
  'Office buildings or staff quarters for government use',
  'Works in religious institutions or religious premises',
  'Statues, memorials, or monuments',
  'Works costing less than ₹1,00,000',
  'Works outside the MP\'s constituency',
  'Commercial enterprises or profit-making activities',
  'Works already covered under another Central/State scheme',
];

export default async function Home() {
  // ── Fetch all data for scheme-level dashboard ──────────────────────────────
  const [works, fundFlows, mps, agencies] = await Promise.all([
    db.work.findMany(),
    db.fundFlow.findMany(),
    db.mp.findMany(),
    db.agency.findMany(),
  ]).catch((e) => {
    console.error("DB Error:", e);
    return [[], [], [], []];
  });

  const totalProposals = works.length;

  // ── Derived scheme-level statistics ───────────────────────────────────────
  const totalWorks       = works.length;
  const sanctionedAmount = works.reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
  const expendedAmount   = works.reduce((s, w) => s + (w.expenditure || 0), 0);
  const completedWorks   = works.filter(w => (w.status || '').toUpperCase() === 'COMPLETED' || (w.status || '').toUpperCase() === 'UTILISED').length;
  const utilisedWorks    = works.filter(w => (w.status || '').toUpperCase() === 'UTILISED').length;
  const activeWorks      = works.filter(w => (w.status || '').toUpperCase().includes('ONGOING') || (w.status || '').toUpperCase().includes('EXECUTION')).length;
  const sanctionedWorks  = works.filter(w => (w.status || '').toUpperCase() === 'SANCTIONED').length;
  const totalEntitlement = fundFlows.reduce((s, e) => s + (e.entitlement || 0), 0);
  const uncommitted      = totalEntitlement - sanctionedAmount;
  const commitPct        = totalEntitlement > 0 ? Math.round((sanctionedAmount / totalEntitlement) * 100) : 0;
  const expendPct        = sanctionedAmount > 0 ? Math.round((expendedAmount / sanctionedAmount) * 100) : 0;
  const utilPct          = totalWorks > 0 ? Math.round((utilisedWorks / totalWorks) * 100) : 0;

  // ── State distribution ────────────────────────────────────────────────────
  const stateDist = {};
  works.forEach(w => {
    const s = w.status || 'UNKNOWN';
    stateDist[s] = (stateDist[s] || 0) + 1;
  });

  // ── SC/ST scheme-level ────────────────────────────────────────────────────
  const scWorks  = works.filter(w => w.title?.toUpperCase().includes(' SC ') || w.description?.toUpperCase().includes(' SC '));
  const stWorks  = works.filter(w => w.title?.toUpperCase().includes(' ST ') || w.description?.toUpperCase().includes(' ST '));
  const scAmount = scWorks.reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
  const stAmount = stWorks.reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
  const scPct    = sanctionedAmount > 0 ? Math.round((scAmount / sanctionedAmount) * 100) : 0;
  const stPct    = sanctionedAmount > 0 ? Math.round((stAmount / sanctionedAmount) * 100) : 0;

  // ── Per-constituency breakdown ────────────────────────────────────────────
  const constMap = {};
  works.forEach(w => {
    const mp = mps.find(m => m.id === w.mp_id);
    const cid = mp?.constituency || w.district_id || 'Unknown';
    if (!constMap[cid]) constMap[cid] = { works: 0, sanctioned: 0, expended: 0, utilised: 0 };
    constMap[cid].works++;
    constMap[cid].sanctioned += w.sanctioned_amount || 0;
    constMap[cid].expended   += w.expenditure || 0;
    if ((w.status || '').toUpperCase() === 'UTILISED' || (w.status || '').toUpperCase() === 'COMPLETED') constMap[cid].utilised++;
  });
  const constRows = Object.entries(constMap).sort((a, b) => b[1].sanctioned - a[1].sanctioned);

  // ── Sector breakdown ──────────────────────────────────────────────────────
  const sectorMap = {};
  works.forEach(w => {
    const s = w.category || 'Other';
    sectorMap[s] = (sectorMap[s] || 0) + (w.sanctioned_amount || 0);
  });
  const topSectors = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]);

  // ── Agency-wise breakdown ─────────────────────────────────────────────────
  const agencyMap = {};
  works.forEach(w => {
    const agency = agencies.find(a => a.id === w.agency_id);
    const name = agency?.name || w.agency_id || 'Unknown';
    if (!agencyMap[name]) agencyMap[name] = { count: 0, amount: 0 };
    agencyMap[name].count++;
    agencyMap[name].amount += w.sanctioned_amount || 0;
  });

  // ── Year-wise breakdown ───────────────────────────────────────────────────
  const yearMap = {};
  works.forEach(w => {
    const yr = w.fy || 'Unknown';
    if (!yearMap[yr]) yearMap[yr] = { works: 0, sanctioned: 0 };
    yearMap[yr].works++;
    yearMap[yr].sanctioned += w.sanctioned_amount || 0;
  });
  const yearRows = Object.entries(yearMap).sort((a, b) => b[0] - a[0]);

  const fmt = (n) => n >= 10_000_000
    ? `₹${(n / 10_000_000).toFixed(2)} Cr`
    : n >= 100_000
    ? `₹${(n / 100_000).toFixed(1)} L`
    : `₹${(n || 0).toLocaleString('en-IN')}`;

  const stateTagClass = (s) => {
    const upper = (s || '').toUpperCase();
    if (upper.includes('SANCTION')) return 'sanctioned';
    if (upper.includes('ONGOING') || upper.includes('EXECUTION')) return 'executing';
    if (upper.includes('COMPLET')) return 'completed';
    if (upper.includes('UTIL')) return 'utilised';
    return 'proposed';
  };

  return (
    <main className="main-content">

      {/* ── Hero ── */}
      <section style={{ textAlign: 'center', padding: '48px 0 40px' }}>
        <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '99px', padding: '6px 18px', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '20px', letterSpacing: '0.5px' }}>
          Ministry of Statistics &amp; Programme Implementation · Since 1993
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '16px' }}>
          Members of Parliament<br />
          <span style={{ background: 'linear-gradient(to right, var(--accent), #818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Local Area Development Scheme
          </span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '560px', margin: '0 auto 40px', lineHeight: 1.6 }}>
          Canonical, transparent, and authority-separated management of constituency development works — ₹5 Crore per MP per year for durable community assets.
        </p>
      </section>

      {/* ── Scheme-level Statistics Dashboard ── */}
      <section style={{ marginBottom: '48px' }}>
        <h2 className="section-title">Scheme-Level Statistics</h2>

        {/* Row 1 — core financials */}
        <div className="grid-4" style={{ marginBottom: '16px' }}>
          <div className="stat-card">
            <div className="stat-label">Total Entitlement Released</div>
            <div className="stat-value">{fmt(totalEntitlement)}</div>
            <div className="stat-sub">across all MPs &amp; years</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sanctioned (Committed)</div>
            <div className="stat-value">{fmt(sanctionedAmount)}</div>
            <div className="stat-sub">{commitPct}% of released funds</div>
            <div className="util-bar-wrap" style={{ marginTop: '10px' }}>
              <div className="util-bar" style={{ width: `${commitPct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Funds Expended</div>
            <div className="stat-value">{fmt(expendedAmount)}</div>
            <div className="stat-sub">{expendPct}% of sanctioned amount</div>
            <div className="util-bar-wrap" style={{ marginTop: '10px' }}>
              <div className={`util-bar ${expendPct < 50 ? 'warn' : ''}`} style={{ width: `${expendPct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Uncommitted Balance</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{fmt(uncommitted)}</div>
            <div className="stat-sub">{100 - commitPct}% available</div>
          </div>
        </div>

        {/* Row 2 — work counts */}
        <div className="grid-4" style={{ marginBottom: '16px' }}>
          {[
            { label: 'Total Works', value: totalWorks,      sub: `${totalProposals} proposals submitted`, color: 'var(--accent)' },
            { label: 'Active (In Execution)', value: activeWorks,   sub: `${sanctionedWorks} newly sanctioned`, color: 'var(--warning)' },
            { label: 'Completed', value: completedWorks,   sub: `${utilisedWorks} fully utilised`, color: '#818CF8' },
            { label: 'Utilisation Rate', value: `${utilPct}%`,    sub: 'works fully utilised', color: utilPct < 30 ? 'var(--danger)' : 'var(--success)' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ fontSize: '2rem', color }}>{value}</div>
              <div className="stat-sub">{sub}</div>
            </div>
          ))}
        </div>

        {/* Row 3 — SC/ST earmarking at scheme level */}
        <div className="glass-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            SC/ST Mandatory Earmarking — Scheme Level
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>≥15% SC · ≥7.5% ST (mandatory per MPLADS guidelines)</span>
          </h3>
          <div className="grid-2">
            {[
              { badge: 'SC', label: 'Scheduled Caste Areas', amount: scAmount, pct: scPct, target: 15, met: scPct >= 15, cls: 'sc-badge' },
              { badge: 'ST', label: 'Scheduled Tribe Areas', amount: stAmount, pct: stPct, target: 7.5, met: stPct >= 7.5, cls: 'st-badge' },
            ].map(({ badge, label, amount, pct, target, met, cls }) => (
              <div key={badge}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.875rem' }}><span className={cls}>{badge}</span> {label}</span>
                  <span style={{ fontSize: '0.85rem', color: met ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                    {fmt(amount)} ({pct}%) {met ? ' Met' : ` Need ${target}%`}
                  </span>
                </div>
                <div className="util-bar-wrap">
                  <div className={`util-bar ${!met ? 'danger' : ''}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>Current: {pct}%</span><span>Mandatory minimum: {target}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Row 4 — State distribution */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {Object.entries(stateDist).map(([state, count]) => (
            <div key={state} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`tag ${stateTagClass(state)}`}>{state}</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{count}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>work{count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sector-wise Fund Allocation ── */}
      {topSectors.length > 0 && (
        <section style={{ marginBottom: '48px' }} className="glass-card">
          <h2 className="section-title" style={{ fontSize: '1rem' }}>Sector-wise Fund Allocation</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topSectors.map(([sector, amount]) => {
              const pct = sanctionedAmount > 0 ? Math.round((amount / sanctionedAmount) * 100) : 0;
              const color = SECTOR_COLORS[sector] || '#94A3B8';
              return (
                <div key={sector}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{sector}</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{fmt(amount)} · {pct}%</span>
                  </div>
                  <div className="util-bar-wrap">
                    <div style={{ height: '100%', borderRadius: '99px', width: `${pct}%`, background: color, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Per-Constituency Fund Utilisation Report ── */}
      {constRows.length > 0 && (
        <section style={{ marginBottom: '48px' }}>
          <h2 className="section-title">Fund Utilisation by Constituency</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Constituency</th>
                  <th>Works</th>
                  <th>Sanctioned</th>
                  <th>Expended</th>
                  <th>Utilised</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {constRows.map(([cid, data]) => {
                  const expPct = data.sanctioned > 0 ? Math.round((data.expended / data.sanctioned) * 100) : 0;
                  const utilRate = data.works > 0 ? Math.round((data.utilised / data.works) * 100) : 0;
                  return (
                    <tr key={cid}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--accent)' }}>{cid}</td>
                      <td style={{ fontWeight: 600 }}>{data.works}</td>
                      <td style={{ fontWeight: 600 }}>{fmt(data.sanctioned)}</td>
                      <td style={{ color: expPct > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{fmt(data.expended)}</td>
                      <td><span style={{ color: utilRate >= 50 ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>{data.utilised}/{data.works}</span></td>
                      <td style={{ minWidth: '120px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="util-bar-wrap" style={{ flex: 1 }}>
                            <div className={`util-bar ${expPct < 50 ? 'warn' : ''}`} style={{ width: `${Math.min(expPct, 100)}%` }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{expPct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Year-wise breakdown ── */}
      {yearRows.length > 0 && (
        <section style={{ marginBottom: '48px' }} className="glass-card">
          <h2 className="section-title" style={{ fontSize: '1rem' }}>Year-wise Works &amp; Fund Summary</h2>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {yearRows.map(([yr, data]) => (
              <div key={yr} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px 20px', minWidth: '180px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)', marginBottom: '4px' }}>{yr}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{data.works} works</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '6px' }}>{fmt(data.sanctioned)}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>sanctioned</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Agency-wise distribution ── */}
      {Object.keys(agencyMap).length > 0 && (
        <section style={{ marginBottom: '48px' }} className="glass-card">
          <h2 className="section-title" style={{ fontSize: '1rem' }}>Implementing Agency Distribution</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(agencyMap).sort((a, b) => b[1].amount - a[1].amount).map(([name, data]) => {
              const pct = sanctionedAmount > 0 ? Math.round((data.amount / sanctionedAmount) * 100) : 0;
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ minWidth: '220px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--accent)' }}>{name}</span>
                  <div className="util-bar-wrap" style={{ flex: 1 }}>
                    <div className="util-bar" style={{ width: `${pct}%` }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{data.count} works · {fmt(data.amount)} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Role Cards ── */}
      <section style={{ marginBottom: '48px' }}>
        <h2 className="section-title">Access by Role</h2>
        <div className="grid">
          <Link href="/mp" className="glass-card" style={{ display: 'block' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>️</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--accent)' }}>Member of Parliament</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px', lineHeight: 1.5 }}>Structure work proposals from 12 canonical priority sectors. View entitlement balance and SC/ST earmarking targets.</p>
            <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem' }}>Enter MP Workspace →</div>
          </Link>
          <Link href="/authority" className="glass-card" style={{ display: 'block' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>️</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--danger)' }}>Designated Authority</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px', lineHeight: 1.5 }}>Scrutinise proposals for eligibility, duplication &amp; cost-reasonableness. Sanction or reject with one canonical reason.</p>
            <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem' }}>Enter Authority Board →</div>
          </Link>
          <Link href="/officer" className="glass-card" style={{ display: 'block' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}></div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--success)' }}>Implementing Officer</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px', lineHeight: 1.5 }}>Track execution state (SANCTIONED → IN-EXECUTION → COMPLETED → UTILISED) and append immutable geo-tagged evidence.</p>
            <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem' }}>Enter Officer Dashboard →</div>
          </Link>
          <Link href="/public" className="glass-card" style={{ display: 'block' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}></div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: '#EAB308' }}>General Public</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px', lineHeight: 1.5 }}>Read-only transparency view of all sanctioned works with sector breakdown, fund utilisation, and geo-tagged evidence.</p>
            <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem' }}>View Public Portal →</div>
          </Link>

          <Link href="/monitor" className="glass-card" style={{ display: 'block', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}></div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: '#10B981' }}>AI Monitor</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px', lineHeight: 1.5 }}>Real-time ML corroboration of asset progression, geospatial variance tracking, and timeline estimation for ongoing projects.</p>
            <div style={{ color: '#10B981', fontWeight: 600, fontSize: '0.875rem' }}>View AI Monitor →</div>
          </Link>

          <Link href="/fraud" className="glass-card" style={{ display: 'block', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}></div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: '#EF4444' }}>Fraud Investigator</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '16px', lineHeight: 1.5 }}>Advanced irregularity detection engine identifying shell agencies, ghost assets, duplicate sanctions, and fund anomalies.</p>
            <div style={{ color: '#EF4444', fontWeight: 600, fontSize: '0.875rem' }}>View Fraud Investigator →</div>
          </Link>
        </div>
      </section>

      {/* ── Permissible vs Non-permissible Classification ── */}
      <section style={{ marginBottom: '48px' }}>
        <h2 className="section-title">Permissible Works Classification</h2>
        <div className="grid-2" style={{ gap: '24px', alignItems: 'start' }}>

          {/* Permissible */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981', borderRadius: '8px', padding: '4px 14px', fontSize: '0.78rem', fontWeight: 700 }}> Permissible Works (12 Priority Sectors)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PERMISSIBLE.map(({ sector, examples, icon }) => {
                const color = SECTOR_COLORS[sector] || '#94A3B8';
                return (
                  <div key={sector} style={{ background: `${color}08`, border: `1px solid ${color}20`, borderRadius: '10px', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span>{icon}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color }}>{sector}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{examples}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Non-permissible */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', borderRadius: '8px', padding: '4px 14px', fontSize: '0.78rem', fontWeight: 700 }}> Non-Permissible Works (Absolute Disqualifiers)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {NON_PERMISSIBLE.map((item, i) => (
                <div key={i} style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ color: '#EF4444', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}></span>
                  <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.5 }}>{item}</p>
                </div>
              ))}
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px 14px', marginTop: '4px' }}>
                <p style={{ fontSize: '0.78rem', color: '#EF4444', fontWeight: 600, margin: 0, lineHeight: 1.6 }}>
                   Individual benefit is an ABSOLUTE DISQUALIFIER. AI eligibility support flags these at proposal stage. Authority must reject such proposals with a canonical reason.
                </p>
              </div>
            </div>

            {/* Min sanction amount guard */}
            <div style={{ marginTop: '16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '16px 18px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#F59E0B', marginBottom: '8px' }}> Minimum Sanction Amount Guard</div>
              <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
                As per real MPLADS guidelines (MoSPI), <strong style={{ color: '#F59E0B' }}>no project costing less than ₹1,00,000 (₹1 lakh) shall be sanctioned.</strong> Exception: essential items like hand pumps, computers, and solar lamps may have lower individual costs but are part of larger schemes. This guard is enforced at the Authority scrutiny stage and cannot be bypassed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── About MPLADS ── */}
      <section style={{ marginTop: '48px', padding: '32px', background: 'rgba(56,189,248,0.04)', borderRadius: '16px', border: '1px solid rgba(56,189,248,0.1)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--accent)' }}>About MPLADS</h2>
        <div className="grid-2" style={{ gap: '24px' }}>
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              The <strong style={{ color: 'var(--text-main)' }}>Members of Parliament Local Area Development Scheme</strong> was launched on 23 December 1993. Each MP receives <strong style={{ color: 'var(--accent)' }}>₹5 Crore annually</strong> to recommend durable community assets. Funds are administered by MoSPI and sanctioned by District Authorities, not MPs directly.
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Mandatory earmarking: <span className="sc-badge">SC 15%</span> and <span className="st-badge">ST 7.5%</span> of annual funds must benefit SC and ST community areas. Works must be durable community assets — no individual benefits, no office buildings, no religious institutions.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
