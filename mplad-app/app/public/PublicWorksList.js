'use client';
import { useState } from 'react';
import EvidenceUploadForm from '../components/EvidenceUploadForm';

export default function PublicWorksList({ works, SECTOR_COLORS, stateTag, action }) {
  const [search, setSearch] = useState('');

  const filteredWorks = works.filter(w => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (w.work_name || '').toLowerCase().includes(q) 
        || (w.location || '').toLowerCase().includes(q)
        || (w.category || '').toLowerCase().includes(q)
        || (w.id || '').toString().includes(q)
        || (w.fy || '').toLowerCase().includes(q)
        || (w.area_type || '').toLowerCase().includes(q);
  });

  const fmt = (n) => n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(1)} Cr`
    : n >= 100_000 ? `₹${(n / 100_000).toFixed(1)} L` : `₹${(n || 0).toLocaleString()}`;

  return (
    <section>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Sanctioned Works ({filteredWorks.length})</h2>
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="Search projects by ID, sector, year..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '10px 18px',
              paddingLeft: '38px',
              borderRadius: '99px',
              border: '1px solid var(--border-color)',
              background: 'var(--surface-2)',
              color: 'var(--text-main)',
              width: '320px',
              fontSize: '0.9rem',
              outline: 'none',
              boxShadow: 'inset 2px 2px 6px rgba(42, 58, 49, 0.05)'
            }}
          />
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
        </div>
      </div>

      {filteredWorks.length === 0 ? (
        <div className="alert alert-info">No works match your search criteria.</div>
      ) : (
        <div className="grid">
          {filteredWorks.map(w => {
            const sector = w.category || 'Other';
            const color = SECTOR_COLORS[sector] || '#94A3B8';
            const isSC = w.area_type?.toUpperCase().includes('SC-');
            const isST = w.area_type?.toUpperCase().includes('ST-');
            const expendPct = w.sanctioned_amount > 0 ? Math.round(((w.expenditure || 0) / w.sanctioned_amount) * 100) : 0;
            return (
              <div key={w.id} className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span className="sector-badge" style={{ color, background: `${color}15`, border: `1px solid ${color}25` }}>
                    {sector}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {isSC && <span className="sc-badge">SC</span>}
                    {isST && <span className="st-badge">ST</span>}
                    <span className={`tag ${stateTag(w.status)}`}>{w.status}</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Locality: {w.area_type}
                  &nbsp;·&nbsp;Year: {w.fy}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <div className="label">Sanctioned</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{fmt(w.sanctioned_amount || 0)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="label">Expended</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: expendPct > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {fmt(w.expenditure || 0)}
                    </div>
                  </div>
                </div>

                {w.sanctioned_amount > 0 && (
                  <>
                    <div className="util-bar-wrap">
                      <div className="util-bar" style={{ width: `${Math.min(expendPct, 100)}%`, background: color }} />
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {expendPct}% expended · {['COMPLETED', 'UTILISED'].includes((w.status || '').toUpperCase()) ? ' Completed' : 'In Progress'}
                    </div>
                  </>
                )}

                {/* E1 Pipeline: Citizen Evidence Upload */}
                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                  <div className="label" style={{ marginBottom: '8px', color: '#10B981' }}> Submit Field Evidence (E1 Trust Pipeline)</div>
                  <EvidenceUploadForm workId={w.id} authority="PUBLIC" action={action} />
                </div>

                {w.evidence && w.evidence.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <div className="label" style={{ marginBottom: '6px' }}>Geo-tagged Evidence</div>
                    {w.evidence.map(e => (
                      <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                          <span>{e.media_type_code}</span>
                          <span> {Number(e.lat || 0).toFixed(4)}, {Number(e.lon || 0).toFixed(4)}</span>
                          <span>{new Date(e.created_at || new Date()).toLocaleDateString('en-IN')}</span>
                        </div>
                        {e.image_path && (
                          <img src={e.image_path} alt="Evidence" style={{ width: '100%', maxWidth: '250px', borderRadius: '4px', border: '1px solid var(--border-color)' }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
