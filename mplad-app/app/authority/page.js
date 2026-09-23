import db from '../../lib/db';
import { sanctionProposal, rejectProposal } from '../../lib/modules/scrutiny';
import { revalidatePath } from 'next/cache';

// ── Server Actions (module-level — no closures) ───────────────────────────────
async function handleSanction(formData) {
  'use server';
  const proposal_id = formData.get('proposal_id')?.toString();
  const requested_amount = Number(formData.get('requested_amount'));
  if (!proposal_id || !requested_amount) return;
  try {
    await sanctionProposal(proposal_id, 'AGENCY-001', requested_amount);
  } catch (e) {
    console.error('[Sanction Error]', e.message);
  }
  revalidatePath('/authority');
}

async function handleReject(formData) {
  'use server';
  const proposal_id = formData.get('proposal_id')?.toString();
  if (!proposal_id) return;
  try {
    await rejectProposal(proposal_id, 'REJECT-NON-COMPLIANT');
  } catch (e) {
    console.error('[Reject Error]', e.message);
  }
  revalidatePath('/authority');
}

// ── AI Support — read-only eligibility signal ─────────────────────────────────
function getEligibilitySignal(utility_term) {
  const lower = utility_term.toLowerCase();
  if (lower.includes('individual') || lower.includes('personal') || lower.includes('private')) {
    return { label: '✗ Possible individual benefit — DISQUALIFIED', color: 'var(--danger)', ok: false };
  }
  if (lower.includes('drinking water') || lower.includes('road') || lower.includes('health') ||
      lower.includes('school') || lower.includes('education') || lower.includes('sanitation')) {
    return { label: '✓ Priority sector — Eligible', color: 'var(--success)', ok: true };
  }
  return { label: '~ Community public utility — Review feasibility', color: 'var(--warning)', ok: true };
}

function getCostSignal(amount) {
  if (amount < 100_000) return { label: '✗ Below ₹1L minimum — will be rejected', color: 'var(--danger)' };
  if (amount > 10_000_000) return { label: '⚠ High value — verify cost-reasonableness', color: 'var(--warning)' };
  return { label: '✓ Amount within reasonable band', color: 'var(--success)' };
}

const SECTOR_COLORS = {
  'Drinking Water': '#0EA5E9', 'Education': '#8B5CF6', 'Electricity': '#F59E0B',
  'Non-Conventional Energy': '#10B981', 'Healthcare & Sanitation': '#EF4444',
  'Irrigation': '#14B8A6', 'Railways/Roads/Bridges': '#6B7280', 'Sports': '#F97316',
  'Agriculture': '#84CC16', 'Self-Help Group': '#EC4899', 'Urban Development': '#38BDF8',
  'Other': '#94A3B8',
};

export default async function AuthorityView() {
  const allWorks = await db.work.findMany({
    orderBy: { id: 'asc' },
  });

  const pendingProposals = allWorks.filter(w => w.status === 'PROPOSED');
  const activeWorks = allWorks.filter(w => w.status !== 'PROPOSED');

  const entitlements = await db.fundFlow.findMany();

  const totalEntitlement = entitlements.reduce((s, e) => s + (e.entitlement || 0), 0);
  const totalSanctioned = activeWorks.reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
  const totalExpended = activeWorks.reduce((s, w) => s + (w.expenditure || 0), 0);
  const utilisedWorks = activeWorks.filter(w => w.status === 'UTILISED' || w.status === 'utilised').length;
  const utilisationPct = totalEntitlement > 0 ? Math.round((totalExpended / totalEntitlement) * 100) : 0;
  const committedPct = totalEntitlement > 0 ? Math.round((totalSanctioned / totalEntitlement) * 100) : 0;

  // Sector breakdown
  const sectorMap = {};
  activeWorks.forEach(w => {
    const s = w.category || 'Other';
    if (!sectorMap[s]) sectorMap[s] = { count: 0, amount: 0 };
    sectorMap[s].count++;
    sectorMap[s].amount += (w.sanctioned_amount || 0);
  });

  // State distribution
  const stateDist = {};
  activeWorks.forEach(w => { stateDist[w.status || 'UNKNOWN'] = (stateDist[w.status || 'UNKNOWN'] || 0) + 1; });

  const fmt = (n) => n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(1)} Cr`
    : n >= 100_000 ? `₹${(n / 100_000).toFixed(1)} L` : `₹${(n || 0).toLocaleString()}`;

  const stateTagClass = (s) => {
    const upper = (s || '').toUpperCase();
    return {
      'SANCTIONED': 'sanctioned', 'IN-EXECUTION': 'executing', 'IN_PROGRESS': 'executing',
      'COMPLETED': 'completed', 'UTILISED': 'utilised',
    }[upper] || 'proposed';
  };

  return (
    <main className="main-content">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>⚖️ Authority Scrutiny Board</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Scrutinise proposals for eligibility, duplication & cost-reasonableness. Sanction or reject with canonical reason.
          All decisions are immutably audited.
        </p>
      </header>

      {/* ── Fund Utilisation Report ── */}
      <section style={{ marginBottom: '32px' }}>
        <h2 className="section-title" style={{ fontSize: '1rem' }}>Fund Utilisation Report</h2>
        <div className="grid-4" style={{ marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-label">Total Entitlement</div>
            <div className="stat-value">{fmt(totalEntitlement)}</div>
            <div className="stat-sub">across all members & years</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Sanctioned (Committed)</div>
            <div className="stat-value">{fmt(totalSanctioned)}</div>
            <div className="stat-sub">{committedPct}% of entitlement</div>
            <div className="util-bar-wrap"><div className="util-bar" style={{ width: `${committedPct}%` }} /></div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Funds Expended</div>
            <div className="stat-value">{fmt(totalExpended)}</div>
            <div className="stat-sub">{utilisationPct}% utilisation rate</div>
            <div className="util-bar-wrap">
              <div className={`util-bar ${utilisationPct < 50 ? 'warn' : ''}`} style={{ width: `${utilisationPct}%` }} />
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Works Utilised</div>
            <div className="stat-value">{utilisedWorks}</div>
            <div className="stat-sub">of {activeWorks.length} total works</div>
          </div>
        </div>

        {/* State distribution badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {Object.entries(stateDist).map(([state, count]) => (
            <div key={state} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px 14px', fontSize: '0.82rem' }}>
              <span className={`tag ${stateTagClass(state)}`} style={{ marginRight: '8px' }}>{state}</span>
              <strong>{count}</strong> work{count !== 1 ? 's' : ''}
            </div>
          ))}
        </div>

        {/* Sector breakdown */}
        {Object.keys(sectorMap).length > 0 && (
          <div className="glass-card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '14px' }}>Sector-wise Distribution</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(sectorMap).sort((a, b) => b[1].amount - a[1].amount).map(([sector, data]) => {
                const pct = totalSanctioned > 0 ? Math.round((data.amount / totalSanctioned) * 100) : 0;
                const color = SECTOR_COLORS[sector] || '#94A3B8';
                return (
                  <div key={sector} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '140px', fontSize: '0.8rem', flexShrink: 0 }}>{sector}</span>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '99px', height: '6px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px' }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', width: '80px', textAlign: 'right' }}>{fmt(data.amount)}</span>
                    <span style={{ fontSize: '0.78rem', color, width: '36px', textAlign: 'right' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="grid-2">
        {/* ── Pending Proposals ── */}
        <section>
          <h2 className="section-title" style={{ fontSize: '1rem' }}>Pending Proposals ({pendingProposals.length})</h2>
          {pendingProposals.length === 0 ? (
            <div className="alert alert-ok">No pending proposals. All proposals have been actioned.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pendingProposals.map(p => {
                const eligibility = getEligibilitySignal(p.category || '');
                const costSignal = getCostSignal(p.sanctioned_amount || 0);
                const color = SECTOR_COLORS[p.category] || '#94A3B8';
                const isSC = p.area_type?.toUpperCase().includes('SC-');
                const isST = p.area_type?.toUpperCase().includes('ST-');
                return (
                  <div key={p.id} className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <span className="sector-badge" style={{ color, background: `${color}15`, border: `1px solid ${color}25`, marginBottom: '8px', display: 'inline-flex' }}>
                          {p.category}
                        </span>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                          {isSC && <span className="sc-badge">SC</span>}
                          {isST && <span className="st-badge">ST</span>}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          Locality: {p.area_type}
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '1.05rem' }}>
                          {fmt(p.sanctioned_amount || 0)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                        <form action={handleSanction}>
                          <input type="hidden" name="proposal_id" value={p.id} />
                          <input type="hidden" name="requested_amount" value={p.sanctioned_amount || 0} />
                          <button className="btn btn-sm" style={{ background: 'var(--success)', width: '100%' }}>✓ Sanction</button>
                        </form>
                        <form action={handleReject}>
                          <input type="hidden" name="proposal_id" value={p.id} />
                          <button className="btn btn-sm" style={{ background: 'var(--danger)', width: '100%' }}>✗ Reject</button>
                        </form>
                      </div>
                    </div>

                    {/* AI Support */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.5px' }}>
                        AI SUPPORT (READ-ONLY)
                      </div>
                      <div style={{ fontSize: '0.82rem', color: eligibility.color, marginBottom: '3px' }}>{eligibility.label}</div>
                      <div style={{ fontSize: '0.82rem', color: costSignal.color }}>{costSignal.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        ℹ Duplication check runs against asset inventory at sanction time
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── All Works ── */}
        <section>
          <h2 className="section-title" style={{ fontSize: '1rem' }}>All Works ({activeWorks.length})</h2>
          {activeWorks.length === 0 ? (
            <div className="alert alert-info">No works sanctioned yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeWorks.map(w => {
                const sector = w.category || '—';
                const color = SECTOR_COLORS[sector] || '#94A3B8';
                const isSC = w.area_type?.toUpperCase().includes('SC-');
                const isST = w.area_type?.toUpperCase().includes('ST-');
                return (
                  <div key={w.id} className="glass-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="sector-badge" style={{ color, background: `${color}15`, border: `1px solid ${color}25`, fontSize: '0.7rem' }}>
                        {sector}
                      </span>
                      <span className={`tag ${stateTagClass(w.status)}`}>{w.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      {isSC && <span className="sc-badge">SC</span>}
                      {isST && <span className="st-badge">ST</span>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Work #{w.id.slice(0, 10)}… · {w.fy}</span>
                      <span style={{ fontWeight: 700 }}>{fmt(w.sanctioned_amount || 0)}</span>
                    </div>
                    {(w.sanctioned_amount || 0) > 0 && (
                      <div className="util-bar-wrap" style={{ marginTop: '8px' }}>
                        <div className="util-bar" style={{ width: `${Math.min(Math.round(((w.expenditure || 0) / w.sanctioned_amount) * 100), 100)}%`, background: color }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
