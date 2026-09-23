import db from '../../lib/db';

const SECTOR_COLORS = {
  'Drinking Water': '#0EA5E9', 'Education': '#8B5CF6', 'Electricity': '#F59E0B',
  'Non-Conventional Energy': '#10B981', 'Healthcare & Sanitation': '#EF4444',
  'Irrigation': '#14B8A6', 'Railways/Roads/Bridges': '#6B7280', 'Sports': '#F97316',
  'Agriculture': '#84CC16', 'Self-Help Group': '#EC4899', 'Urban Development': '#38BDF8',
  'Other': '#94A3B8',
};

export const metadata = {
  title: 'Public Asset Register — MPLADS Portal',
  description: 'Durable community assets created under MPLADS — read-only public register of completed works.',
};

export default async function AssetRegister() {
  // Completed and Utilised works = public durable community assets
  const assets = await db.work.findMany({
    where: { status: { in: ['COMPLETED', 'UTILISED', 'completed', 'utilised'] } },
    orderBy: { id: 'desc' },
  }).catch(() => []);

  // Public Asset Inventory (formally declared durable assets)
  const inventory = [];

  // Sector summary
  const sectorMap = {};
  assets.forEach(a => {
    const s = a.category || 'Other';
    if (!sectorMap[s]) sectorMap[s] = { count: 0, amount: 0 };
    sectorMap[s].count++;
    sectorMap[s].amount += a.sanctioned_amount || 0;
  });
  const sectorSummary = Object.entries(sectorMap).sort((a, b) => b[1].count - a[1].count);

  const fmt = (n) => n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(1)} Cr`
    : n >= 100_000 ? `₹${(n / 100_000).toFixed(1)} L` : `₹${n?.toLocaleString()}`;

  return (
    <main className="main-content">
      {/* Header */}
      <header style={{ marginBottom: '32px' }}>
        <div style={{ display: 'inline-block', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '99px', padding: '5px 14px', fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600, marginBottom: '12px' }}>
          Public Register · Read-Only
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Community Asset Register</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '600px' }}>
          Durable community assets created under MPLADS — completed and utilised works visible to the general public
          per transparency guidelines. All geo-tagged evidence is immutable.
        </p>
      </header>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card">
          <div className="stat-label">Total Assets</div>
          <div className="stat-value">{assets.length + inventory.length}</div>
          <div className="stat-sub">{assets.length} completed works + {inventory.length} inventory</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Investment</div>
          <div className="stat-value">{fmt(assets.reduce((s, a) => s + (a.sanctioned_amount || 0), 0))}</div>
          <div className="stat-sub">sanctioned for completed assets</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sectors Covered</div>
          <div className="stat-value">{sectorSummary.length}</div>
          <div className="stat-sub">distinct public utility categories</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Evidence Records</div>
          <div className="stat-value">{assets.reduce((s, a) => s + (a.evidence ? a.evidence.length : 0), 0)}</div>
          <div className="stat-sub">immutable geo-tagged entries</div>
        </div>
      </div>

      {/* Sector Summary */}
      {sectorSummary.length > 0 && (
        <section className="glass-card" style={{ marginBottom: '32px' }}>
          <h2 className="section-title" style={{ fontSize: '1rem' }}>Sector Distribution</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {sectorSummary.map(([sector, data]) => {
              const color = SECTOR_COLORS[sector] || '#94A3B8';
              return (
                <div key={sector} style={{
                  background: `${color}12`, border: `1px solid ${color}25`, borderRadius: '10px',
                  padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '160px',
                }}>
                  <span className="sector-badge" style={{ color, background: 'transparent', padding: 0, fontSize: '0.78rem', marginBottom: '4px' }}>
                    {sector}
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{data.count} assets</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmt(data.amount)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Completed Works as Assets */}
      <section style={{ marginBottom: '40px' }}>
        <h2 className="section-title">Completed Works</h2>
        {assets.length === 0 ? (
          <div className="alert alert-info">No completed works yet. Works appear here once they reach COMPLETED or UTILISED state.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Work ID</th>
                  <th>Sector</th>
                  <th>Locality</th>
                  <th>Sanctioned</th>
                  <th>State</th>
                  <th>Evidence</th>
                  <th>Utilised</th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => {
                  const sector = a.category || 'Other';
                  const color = SECTOR_COLORS[sector] || '#94A3B8';
                  const isSC = a.area_type?.toUpperCase().includes('SC-');
                  const isST = a.area_type?.toUpperCase().includes('ST-');
                  return (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.id.slice(0, 14)}…</td>
                      <td>
                        <span className="sector-badge" style={{ color, background: `${color}15`, border: `1px solid ${color}25` }}>
                          {sector}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {a.area_type || '—'}
                        {isSC && <span className="sc-badge" style={{ marginLeft: '6px' }}>SC</span>}
                        {isST && <span className="st-badge" style={{ marginLeft: '6px' }}>ST</span>}
                      </td>
                      <td style={{ fontWeight: 600 }}>{fmt(a.sanctioned_amount || 0)}</td>
                      <td><span className={`tag ${(a.status || '').toUpperCase() === 'UTILISED' ? 'utilised' : 'completed'}`}>{a.status}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {a.evidence && a.evidence.length > 0
                          ? <span style={{ color: 'var(--success)' }}>📍 {a.evidence.length} records</span>
                          : <span style={{ color: 'var(--text-muted)' }}>None</span>}
                      </td>
                      <td>{(a.status || '').toUpperCase() === 'UTILISED' ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Yes</span> : <span style={{ color: 'var(--text-muted)' }}>Pending</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Public Asset Inventory */}
      <section>
        <h2 className="section-title">Public Asset Inventory (Declared)</h2>
        {inventory.length === 0 ? (
          <div className="alert alert-info">No formally declared assets in inventory yet.</div>
        ) : (
          <div className="grid"></div>
        )}
      </section>

      <div style={{ marginTop: '40px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text-main)' }}>Transparency Note:</strong> This register is a read-only public view.
        All data is derived from the immutable audit trail. Evidence records include geo-coordinates captured at time of verification.
        Works funded by SC/ST earmarked funds are tagged accordingly per MPLADS transparency guidelines.
      </div>
    </main>
  );
}
