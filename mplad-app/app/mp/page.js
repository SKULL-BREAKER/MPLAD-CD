import db from '../../lib/db';
import { getEntitlementBalance, getSCSTUtilisation } from '../../lib/modules/entitlement';
import { structureProposal } from '../../lib/modules/proposal';
import { revalidatePath } from 'next/cache';

// ── 12 Canonical MPLADS Priority Sectors ─────────────────────────────────────
const PRIORITY_SECTORS = [
  'Drinking Water',
  'Education',
  'Electricity',
  'Non-Conventional Energy',
  'Healthcare & Sanitation',
  'Irrigation',
  'Railways/Roads/Bridges',
  'Sports',
  'Agriculture',
  'Self-Help Group',
  'Urban Development',
  'Other',
];

// Canonical locality options — SC/ST-prefixed localities trigger earmarking tracking
const LOCALITY_OPTIONS = [
  { value: 'GENERAL-001', label: 'General Area' },
  { value: 'SC-WARD-001', label: 'SC Community Area (SC earmarking)' },
  { value: 'SC-WARD-002', label: 'SC Colony' },
  { value: 'ST-TRIBAL-001', label: 'ST Tribal Area (ST earmarking)' },
  { value: 'ST-TRIBAL-002', label: 'ST Habitation' },
  { value: 'RURAL-001', label: 'Rural Habitation' },
  { value: 'URBAN-001', label: 'Urban Ward' },
];

// ── Seed mock data for development ───────────────────────────────────────────
// Removed as DB is already populated

// ── Server Action: submit proposal ───────────────────────────────────────────
async function submitProposal(formData) {
  'use server';
  const utility  = formData.get('utility')?.toString().trim();
  const locality = formData.get('locality')?.toString().trim();
  const amount   = Number(formData.get('amount'));
  if (!utility || !locality || !amount) return;
  await structureProposal({
    constituency_id: 'DIST-001',
    member_id: 'MP-001',
    year_val: '2024',
    public_utility_term_id: utility,
    public_locality_term_id: locality,
    requested_amount: amount,
  });
  revalidatePath('/mp');
}

// ── Sector colour map ─────────────────────────────────────────────────────────
const SECTOR_COLORS = {
  'Drinking Water': '#0EA5E9', 'Education': '#8B5CF6', 'Electricity': '#F59E0B',
  'Non-Conventional Energy': '#10B981', 'Healthcare & Sanitation': '#EF4444',
  'Irrigation': '#14B8A6', 'Railways/Roads/Bridges': '#6B7280', 'Sports': '#F97316',
  'Agriculture': '#84CC16', 'Self-Help Group': '#EC4899', 'Urban Development': '#38BDF8',
  'Other': '#94A3B8',
};

export default async function MPView() {
  const member_id      = 'MP-001';
  const year_val       = '2019-20';
  const constituency_id = 'DIST-001';

  const [balanceData, scst, proposals] = await Promise.all([
    getEntitlementBalance(member_id, year_val),
    getSCSTUtilisation(member_id, year_val),
    db.work.findMany({
      where: { mp_id: member_id, fy: year_val, status: 'PROPOSED' },
      orderBy: { id: 'asc' },
    }),
  ]);

  const fmt = (n) => `₹${n.toLocaleString()}`;
  const balPct = balanceData.annual > 0 ? Math.round((balanceData.committed / balanceData.annual) * 100) : 0;

  return (
    <main className="main-content">
      {/* ── Header & Entitlement ── */}
      <header style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800 }}>🏛️ MP Workspace</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
              Member: {member_id} · Constituency: {constituency_id} · Year: {year_val}
            </div>
          </div>
        </div>

        {/* Fund stats */}
        <div className="grid-4" style={{ marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-label">Annual Entitlement</div>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>{fmt(balanceData.annual)}</div>
            <div className="stat-sub">₹5 Cr per MPLADS</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Committed</div>
            <div className="stat-value" style={{ fontSize: '1.4rem', background: 'linear-gradient(to right,var(--accent),var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {fmt(balanceData.committed)}
            </div>
            <div className="stat-sub">{balPct}% of entitlement</div>
            <div className="util-bar-wrap"><div className="util-bar" style={{ width: `${balPct}%` }} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Available Balance</div>
            <div className="stat-value" style={{ fontSize: '1.4rem', background: `linear-gradient(to right, var(--success), #6EE7B7)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {fmt(balanceData.balance)}
            </div>
            <div className="stat-sub">uncommitted funds</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Proposals</div>
            <div className="stat-value" style={{ fontSize: '1.4rem' }}>{proposals.length}</div>
            <div className="stat-sub">submitted this year</div>
          </div>
        </div>

        {/* SC/ST Earmarking Compliance */}
        <div className="glass-card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>
            SC/ST Earmarking Compliance
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>
              Mandatory: ≥15% SC · ≥7.5% ST per MPLADS Guidelines
            </span>
          </h3>
          <div className="grid-2">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.875rem' }}><span className="sc-badge">SC</span> Scheduled Caste Areas</span>
                <span style={{ fontSize: '0.85rem', color: scst.scMet ? 'var(--success)' : 'var(--warning)' }}>
                  {fmt(scst.scAmount)} / {fmt(scst.scTarget)} ({scst.scPct}%)
                  {scst.scMet ? ' ✓' : ' ⚠'}
                </span>
              </div>
              <div className="util-bar-wrap">
                <div className={`util-bar ${!scst.scMet ? 'warn' : ''}`} style={{ width: `${Math.min(scst.scPct, 100)}%` }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Target: 15% = {fmt(scst.scTarget)}
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.875rem' }}><span className="st-badge">ST</span> Scheduled Tribe Areas</span>
                <span style={{ fontSize: '0.85rem', color: scst.stMet ? 'var(--success)' : 'var(--warning)' }}>
                  {fmt(scst.stAmount)} / {fmt(scst.stTarget)} ({scst.stPct}%)
                  {scst.stMet ? ' ✓' : ' ⚠'}
                </span>
              </div>
              <div className="util-bar-wrap">
                <div className={`util-bar ${!scst.stMet ? 'warn' : ''}`} style={{ width: `${Math.min(scst.stPct, 100)}%` }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Target: 7.5% = {fmt(scst.stTarget)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Existing Proposals ── */}
      <section style={{ marginBottom: '40px' }}>
        <h3 className="section-title">Your Proposals ({year_val})</h3>
        {proposals.length === 0 ? (
          <div className="alert alert-info">No proposals submitted yet. Use the form below to structure your first work proposal.</div>
        ) : (
          <div className="grid">
            {proposals.map(p => {
              const color = SECTOR_COLORS[p.category] || '#94A3B8';
              const isSC = p.area_type?.toUpperCase().includes('SC-');
              const isST = p.area_type?.toUpperCase().includes('ST-');
              return (
                <div key={p.id} className="glass-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span className="sector-badge" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                      {p.category}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {isSC && <span className="sc-badge">SC</span>}
                      {isST && <span className="st-badge">ST</span>}
                    </div>
                  </div>
                  <div className="label">Locality</div>
                  <div style={{ marginBottom: '10px', fontSize: '0.9rem' }}>{p.area_type}</div>
                  <div className="label">Requested Amount</div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>₹{p.sanctioned_amount?.toLocaleString() || 0}</div>
                  <div style={{ marginTop: '10px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.id.slice(0, 12)}…</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── New Proposal Form ── */}
      <section className="glass-card" style={{ maxWidth: '620px' }}>
        <h3 style={{ marginBottom: '4px', fontWeight: 700 }}>Structure New Work Proposal</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          All proposals must serve a greater public purpose. Individual benefit works are disqualified.
          Minimum sanction: ₹1,00,000.
        </p>
        <form action={submitProposal} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="label">Priority Sector (Public Utility) *</label>
            <select name="utility" className="select-field" required>
              <option value="">Select canonical sector…</option>
              {PRIORITY_SECTORS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Community Area (Locality) *</label>
            <select name="locality" className="select-field" required>
              <option value="">Select locality type…</option>
              {LOCALITY_OPTIONS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              SC and ST tagged areas count toward mandatory earmarking targets.
            </div>
          </div>
          <div>
            <label className="label">Requested Amount (₹) * — Minimum ₹1,00,000</label>
            <input
              name="amount"
              type="number"
              min="100000"
              step="10000"
              className="input-field"
              placeholder="e.g. 2500000"
              required
            />
          </div>
          <div className="alert alert-info" style={{ fontSize: '0.8rem' }}>
            💡 AI eligibility and duplication checks will run at the Authority scrutiny stage.
          </div>
          <button type="submit" className="btn">Submit Proposal →</button>
        </form>
      </section>
    </main>
  );
}
