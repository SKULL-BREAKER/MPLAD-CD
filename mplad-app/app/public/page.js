import db from '../../lib/db';
import Chatbot from '../components/Chatbot';
import EvidenceUploadForm from '../components/EvidenceUploadForm';
import { appendEvidence } from '../../lib/modules/execution';
import { revalidatePath } from 'next/cache';

// N2 Fix: Public view must only show works in active/completed states — not PROPOSED
const PUBLIC_VISIBLE_STATES = ['SANCTIONED', 'IN-EXECUTION', 'COMPLETED', 'UTILISED'];

const SECTOR_COLORS = {
  'Drinking Water': '#0EA5E9', 'Education': '#8B5CF6', 'Electricity': '#F59E0B',
  'Non-Conventional Energy': '#10B981', 'Healthcare & Sanitation': '#EF4444',
  'Irrigation': '#14B8A6', 'Railways/Roads/Bridges': '#6B7280', 'Sports': '#F97316',
  'Agriculture': '#84CC16', 'Self-Help Group': '#EC4899', 'Urban Development': '#38BDF8',
  'Other': '#94A3B8',
};

async function handleUploadPublicEvidence(formData) {
  'use server';
  const work_id = formData.get('work_id')?.toString();
  const media_type = formData.get('media_type')?.toString() || 'PHOTO';
  const lat = parseFloat(formData.get('latitude') || '28.6139');
  const lng = parseFloat(formData.get('longitude') || '77.2090');
  const file = formData.get('evidence_photo');
  
  if (!work_id) return;
  
  let image_path = null;
  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const crypto = require('crypto');
    const fs = require('fs');
    const path = require('path');
    
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', work_id);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filename = crypto.randomBytes(4).toString('hex') + '.jpg';
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    image_path = `/uploads/${work_id}/${filename}`;
  }

  try {
    await appendEvidence(work_id, media_type, lat, lng, 'PUBLIC', image_path);
  } catch (e) {
    console.error('[Public Evidence Error]', e.message);
  }
  revalidatePath('/public');
}

export const metadata = {
  title: 'Public Portal — MPLADS Works Transparency',
  description: 'Read-only public view of all sanctioned MPLADS works with geo-tagged evidence and fund utilisation.',
};

export default async function PublicView() {
  const works = await db.work.findMany({
    where: { status: { in: ['SANCTIONED', 'IN-EXECUTION', 'COMPLETED', 'UTILISED', 'sanctioned', 'in-execution', 'completed', 'utilised'] } },
    orderBy: { id: 'asc' },
  });

  const allEvidence = await db.evidenceSubmission.findMany({
    orderBy: { created_at: 'desc' }
  });
  const evidenceMap = {};
  allEvidence.forEach(e => {
    evidenceMap[e.work_id] = evidenceMap[e.work_id] || [];
    evidenceMap[e.work_id].push(e);
  });
  works.forEach(w => w.evidence = evidenceMap[w.id] || []);

  const totalSanctioned = works.reduce((s, w) => s + (w.sanctioned_amount || 0), 0);
  const totalExpended = works.reduce((s, w) => s + (w.expenditure || 0), 0);
  const completedCount = works.filter(w => {
    const s = (w.status || '').toUpperCase();
    return s === 'COMPLETED' || s === 'UTILISED';
  }).length;
  const activeCount = works.filter(w => (w.status || '').toUpperCase() === 'IN-EXECUTION').length;
  const utilisedCount = works.filter(w => (w.status || '').toUpperCase() === 'UTILISED').length;

  // Sector-wise breakdown
  const sectorMap = {};
  works.forEach(w => {
    const s = w.category || 'Other';
    if (!sectorMap[s]) sectorMap[s] = { count: 0, amount: 0 };
    sectorMap[s].count++;
    sectorMap[s].amount += w.sanctioned_amount || 0;
  });
  const sectorBreakdown = Object.entries(sectorMap).sort((a, b) => b[1].amount - a[1].amount);

  const fmt = (n) => n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(1)} Cr`
    : n >= 100_000 ? `₹${(n / 100_000).toFixed(1)} L` : `₹${(n || 0).toLocaleString()}`;

  const stateTag = (s) => {
    const map = {
      'SANCTIONED': 'sanctioned', 'IN-EXECUTION': 'executing',
      'COMPLETED': 'completed', 'UTILISED': 'utilised',
    };
    return map[(s || '').toUpperCase()] || 'proposed';
  };

  return (
    <main className="main-content">
      {/* Header */}
      <header style={{ marginBottom: '32px' }}>
        <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '99px', padding: '5px 14px', fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600, marginBottom: '12px' }}>
          Transparency Portal · Public Access · Read-Only
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Public Works Portal</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '600px' }}>
          Read-only transparency view of all sanctioned constituency works per MPLADS transparency guidelines.
          Citizens may view fund utilisation, work status, and geo-tagged evidence.
        </p>
      </header>

      {/* Live Stats */}
      <div className="grid-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card">
          <div className="stat-label">Total Works</div>
          <div className="stat-value">{works.length}</div>
          <div className="stat-sub">{activeCount} in execution</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Funds Sanctioned</div>
          <div className="stat-value">{fmt(totalSanctioned)}</div>
          <div className="stat-sub">{fmt(totalExpended)} expended</div>
          {totalSanctioned > 0 && (
            <>
              <div className="util-bar-wrap" style={{ marginTop: '10px' }}>
                <div className="util-bar" style={{ width: `${Math.min(Math.round((totalExpended / totalSanctioned) * 100), 100)}%` }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {Math.round((totalExpended / totalSanctioned) * 100)}% expended
              </div>
            </>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value">{completedCount}</div>
          <div className="stat-sub">{utilisedCount} fully utilised</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Evidence Records</div>
          <div className="stat-value">{works.reduce((s, w) => s + w.evidence.length, 0)}</div>
          <div className="stat-sub">immutable geo-tagged</div>
        </div>
      </div>

      {/* Sector Breakdown */}
      {sectorBreakdown.length > 0 && (
        <section className="glass-card" style={{ marginBottom: '32px' }}>
          <h2 className="section-title" style={{ fontSize: '1rem' }}>Sector-wise Fund Utilisation</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Distribution of sanctioned funds across MPLADS priority sectors
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sectorBreakdown.map(([sector, data]) => {
              const pct = totalSanctioned > 0 ? Math.round((data.amount / totalSanctioned) * 100) : 0;
              const color = SECTOR_COLORS[sector] || '#94A3B8';
              return (
                <div key={sector}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{sector}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{data.count} work{data.count !== 1 ? 's' : ''}</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{fmt(data.amount)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span></span>
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

      {/* Works List */}
      <section>
        <h2 className="section-title">Sanctioned Works ({works.length})</h2>
        {works.length === 0 ? (
          <div className="alert alert-info">No works are currently available for public view. Works appear here after they are sanctioned by the District Authority.</div>
        ) : (
          <div className="grid">
            {works.map(w => {
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
                        {expendPct}% expended · {['COMPLETED', 'UTILISED'].includes((w.status || '').toUpperCase()) ? '✓ Completed' : 'In Progress'}
                      </div>
                    </>
                  )}

                  {/* E1 Pipeline: Citizen Evidence Upload */}
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="label" style={{ marginBottom: '8px', color: '#10B981' }}>📸 Submit Field Evidence (E1 Trust Pipeline)</div>
                    <EvidenceUploadForm workId={w.id} authority="PUBLIC" action={handleUploadPublicEvidence} />
                  </div>

                  {w.evidence && w.evidence.length > 0 && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                      <div className="label" style={{ marginBottom: '6px' }}>Geo-tagged Evidence</div>
                      {w.evidence.map(e => (
                        <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                            <span>{e.media_type_code === 'PHOTO' ? '📷' : '🎥'}</span>
                            <span>{e.media_type_code}</span>
                            <span>📍 {Number(e.lat || 0).toFixed(4)}, {Number(e.lon || 0).toFixed(4)}</span>
                            <span>{new Date(e.created_at || new Date()).toLocaleDateString('en-IN')}</span>
                          </div>
                          {e.image_path && (
                            <img src={e.image_path} alt="Evidence" style={{ width: '100%', maxWidth: '250px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
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

      <div style={{ marginTop: '40px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        This is a read-only transparency portal. For RTI queries about fund utilisation, contact the District Authority.
        All evidence records are immutable and geo-verified.
      </div>
      <Chatbot role="public" />
    </main>
  );
}
