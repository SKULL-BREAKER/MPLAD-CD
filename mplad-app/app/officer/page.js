import db from '../../lib/db';
import { updateExecutionState, appendEvidence } from '../../lib/modules/execution';
import { revalidatePath } from 'next/cache';
import Chatbot from '../components/Chatbot';
import EvidenceUploadForm from '../components/EvidenceUploadForm';

// Canonical state transition chain
const NEXT_STATE = {
  SANCTIONED:    'IN-EXECUTION',
  'IN-EXECUTION': 'COMPLETED',
  COMPLETED:     'UTILISED',
};

const STATE_META = {
  SANCTIONED:    { label: 'Sanctioned',   color: '#10B981', icon: '✓', tagClass: 'sanctioned' },
  'IN-EXECUTION': { label: 'In Execution', color: '#F59E0B', icon: '🔨', tagClass: 'executing' },
  COMPLETED:     { label: 'Completed',    color: '#818CF8', icon: '🏁', tagClass: 'completed' },
  UTILISED:      { label: 'Utilised',     color: '#6EE7B7', icon: '★', tagClass: 'utilised' },
};

const SECTOR_COLORS = {
  'Drinking Water': '#0EA5E9', 'Education': '#8B5CF6', 'Electricity': '#F59E0B',
  'Non-Conventional Energy': '#10B981', 'Healthcare & Sanitation': '#EF4444',
  'Irrigation': '#14B8A6', 'Railways/Roads/Bridges': '#6B7280', 'Sports': '#F97316',
  'Agriculture': '#84CC16', 'Self-Help Group': '#EC4899', 'Urban Development': '#38BDF8',
  'Other': '#94A3B8',
};

// ── Server Actions ─────────────────────────────────────────────────────────────
async function handleUpdateState(formData) {
  'use server';
  const work_id = formData.get('work_id')?.toString();
  const current_state = formData.get('current_state')?.toString();
  if (!work_id || !current_state) return;
  const nextState = NEXT_STATE[current_state];
  if (!nextState) return;
  try {
    await updateExecutionState(work_id, nextState);
  } catch (e) {
    console.error('[State Update Error]', e.message);
  }
  revalidatePath('/officer');
}

async function handleUploadEvidence(formData) {
  'use server';
  const work_id = formData.get('work_id')?.toString();
  const media_type = formData.get('media_type')?.toString() || 'PHOTO';
  const lat = parseFloat(formData.get('latitude') || '28.6139');
  const lng = parseFloat(formData.get('longitude') || '77.2090');
  const authority = formData.get('authority')?.toString() || 'OFFICER';
  if (!work_id) return;

  const file = formData.get('evidence_photo');
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
    await appendEvidence(work_id, media_type, lat, lng, authority, image_path);
  } catch (e) {
    console.error('[Evidence Error]', e.message);
  }
  revalidatePath('/officer');
}

export default async function OfficerView() {
  // Include COMPLETED so officer can advance to UTILISED; include full evidence
  const works = await db.work.findMany({
    where: { status: { in: ['SANCTIONED', 'IN-EXECUTION', 'COMPLETED', 'sanctioned', 'in-execution', 'completed'] } },
    orderBy: { id: 'asc' },
  });

  const detectionResults = await db.detectionResult.findMany().catch(() => []);
  const workRisks = await db.workRisk.findMany().catch(() => []);

  const detectionMap = {};
  detectionResults.forEach(d => {
    detectionMap[d.work_id] = detectionMap[d.work_id] || [];
    detectionMap[d.work_id].push(d);
  });
  
  const riskMap = {};
  workRisks.forEach(r => {
    riskMap[r.work_id] = r;
  });

  const allEvidence = await db.evidenceSubmission.findMany({
    orderBy: { created_at: 'desc' }
  });
  const evidenceMap = {};
  allEvidence.forEach(e => {
    evidenceMap[e.work_id] = evidenceMap[e.work_id] || [];
    evidenceMap[e.work_id].push(e);
  });
  
  works.forEach(w => {
    w.evidence = evidenceMap[w.id] || [];
    w.detections = detectionMap[w.id] || [];
    w.risk = riskMap[w.id] || null;
  });

  // Fetch unresolved flags for Alert Inbox
  const unresolvedFlags = await db.alert.findMany({
    where: { status: { not: 'RESOLVED' } },
    orderBy: { created_at: 'desc' }
  }).catch(() => []);

  // Calculate SLAs
  const now = new Date();
  const alertsWithSLA = unresolvedFlags.map(f => {
    const created = new Date(f.created_at);
    const slaDays = f.severity === 'CRITICAL' ? 3 : f.severity === 'HIGH' ? 7 : 14;
    const deadline = new Date(created.getTime() + slaDays * 24 * 60 * 60 * 1000);
    const msLeft = deadline - now;
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
    return { ...f, daysLeft, breached: daysLeft < 0 };
  }).sort((a, b) => a.daysLeft - b.daysLeft);

  // Summary counts
  const counts = { SANCTIONED: 0, 'IN-EXECUTION': 0, COMPLETED: 0 };
  works.forEach(w => counts[w.status] = (counts[w.status] || 0) + 1);
  const totalEvidence = works.reduce((s, w) => s + w.evidence.length, 0);

  const fmt = (n) => n >= 100_000 ? `₹${(n / 100_000).toFixed(1)} L` : `₹${(n || 0).toLocaleString()}`;

  return (
    <main className="main-content">
      {/* Header */}
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '6px' }}>👷 Officer Execution Dashboard</h1>
        <p className="text-muted" style={{ fontSize: '0.9rem' }}>
          Advance work states through the canonical pipeline and append immutable geo-tagged evidence.
          All transitions are strictly linear and immutably audited.
        </p>
      </header>

      {/* Pipeline Stats */}
      <div className="grid-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card">
          <div className="stat-label">Newly Sanctioned</div>
          <div className="stat-value">{counts['SANCTIONED'] || 0}</div>
          <div className="stat-sub">ready to start execution</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Execution</div>
          <div className="stat-value">{counts['IN-EXECUTION'] || 0}</div>
          <div className="stat-sub">works currently active</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ready to Utilise</div>
          <div className="stat-value">{counts['COMPLETED'] || 0}</div>
          <div className="stat-sub">completed, pending utilisation</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Evidence Records</div>
          <div className="stat-value">{totalEvidence}</div>
          <div className="stat-sub">immutable geo-tagged entries</div>
        </div>
      </div>

      {/* State Pipeline Visual */}
      <div className="glass-card" style={{ marginBottom: '32px', padding: '20px 28px' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '0.5px' }}>
          CANONICAL STATE PIPELINE
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto' }}>
          {['SANCTIONED', 'IN-EXECUTION', 'COMPLETED', 'UTILISED'].map((state, i, arr) => {
            const meta = STATE_META[state];
            const count = counts[state] || 0;
            return (
              <div key={state} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '14px 10px',
                  background: count > 0 ? `${meta.color}15` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${count > 0 ? meta.color + '35' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: i === 0 ? '10px 0 0 10px' : i === arr.length - 1 ? '0 10px 10px 0' : '0',
                  borderLeft: i > 0 ? 'none' : undefined,
                }}>
                  <div style={{ fontSize: '1.2rem', marginBottom: '3px' }}>{meta.icon}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: count > 0 ? meta.color : 'var(--text-muted)' }}>
                    {meta.label}
                  </div>
                  {count > 0 && (
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: meta.color, marginTop: '2px' }}>{count}</div>
                  )}
                </div>
                {i < arr.length - 1 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '1rem', padding: '0 2px', flexShrink: 0, zIndex: 1 }}>›</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Alert Inbox */}
      {alertsWithSLA.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#EF4444', marginBottom: '12px' }}>⚠️ Action Required: Alert Inbox</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {alertsWithSLA.map(alert => (
              <div key={alert.id} style={{ background: 'rgba(239,68,68,0.05)', border: `1px solid ${alert.breached ? '#EF4444' : 'rgba(239,68,68,0.2)'}`, borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 800, color: alert.severity === 'CRITICAL' ? '#EF4444' : '#F97316' }}>{alert.severity} ALERT</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: alert.breached ? '#EF4444' : '#10B981', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>
                    {alert.breached ? `BREACHED BY ${Math.abs(alert.daysLeft)}d` : `${alert.daysLeft}d left`}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Work ID: {alert.work_id}</div>
                <div style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', color: 'rgba(255,255,255,0.7)' }}>
                  {alert.title} · {(alert.evidence_json || '').substring(0, 80)}...
                </div>
                <button className="btn" style={{ width: '100%', marginTop: '12px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', fontSize: '0.75rem', padding: '6px' }}>
                  Review & Verdict
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Works */}
      {works.length === 0 ? (
        <div className="alert alert-info">No active works assigned. Works appear here once they are sanctioned by the Authority.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {works.map(w => {
            const nextState = NEXT_STATE[w.status];
            const meta = STATE_META[w.status] || {};
            const nextMeta = nextState ? STATE_META[nextState] : null;
            const sector = w.category || 'Other';
            const color = SECTOR_COLORS[sector] || '#94A3B8';
            const isSC = w.area_type?.toUpperCase().includes('SC-');
            const isST = w.area_type?.toUpperCase().includes('ST-');
            const expendPct = w.sanctioned_amount > 0 ? Math.min(Math.round(((w.expenditure || 0) / w.sanctioned_amount) * 100), 100) : 0;

            return (
              <div key={w.id} className="glass-card">
                {/* Work header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span className="sector-badge" style={{ color, background: `${color}15`, border: `1px solid ${color}25` }}>
                        {sector}
                      </span>
                      <span className={`tag ${meta.tagClass}`}>{w.status}</span>
                      {isSC && <span className="sc-badge">SC</span>}
                      {isST && <span className="st-badge">ST</span>}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                      Locality: {w.area_type}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Work #{w.id.slice(0, 10)}… · {w.fy}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(56,189,248,0.7)', marginTop: '2px' }}>
                      🏗 {w.agency_id || 'Unknown Agency'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="label">Sanctioned</div>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--success)' }}>{fmt(w.sanctioned_amount)}</div>
                  </div>
                </div>

                {/* AI Monitoring Dashboard (Injected Risk Profile) */}
                {w.risk && ['HIGH', 'CRITICAL'].includes(w.risk.tier?.toUpperCase()) && (
                  <div style={{ background: w.risk.tier?.toUpperCase() === 'CRITICAL' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${w.risk.tier?.toUpperCase() === 'CRITICAL' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>🤖</span>
                      <strong style={{ color: w.risk.tier?.toUpperCase() === 'CRITICAL' ? '#EF4444' : '#F59E0B' }}>
                        AI Risk Assessment: {w.risk.tier}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Score: {Number(w.risk.risk_score || 0).toFixed(2)})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {w.detections.map((d, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <span style={{ color: 'var(--text-muted)' }}>[{d.detector}]</span>
                          <span>{(d.evidence_json || '').substring(0, 100)}...</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expenditure bar */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                    <span>Expended: {fmt(w.expenditure || 0)}</span>
                    <span>{expendPct}%</span>
                  </div>
                  <div className="util-bar-wrap">
                    <div className="util-bar" style={{ width: `${expendPct}%`, background: color }} />
                  </div>
                </div>

                {/* Evidence already appended */}
                {w.evidence.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px' }}>
                    <div className="label" style={{ marginBottom: '8px' }}>Evidence ({w.evidence.length} record{w.evidence.length !== 1 ? 's' : ''})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {w.evidence.map(e => (
                        <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--text-muted)', alignItems: 'center' }}>
                            <span style={{ color: 'var(--accent)' }}>{e.media_type_code === 'PHOTO' ? '📷' : '🎥'} {e.media_type_code}</span>
                            <span>📍 {Number(e.lat || 0).toFixed(5)}, {Number(e.lon || 0).toFixed(5)}</span>
                            <span style={{ background: e.capture_source === 'OFFICER' ? 'rgba(79,70,229,0.15)' : 'rgba(245,158,11,0.15)', color: e.capture_source === 'OFFICER' ? '#818CF8' : '#F59E0B', padding: '1px 6px', borderRadius: '3px', fontSize: '0.7rem' }}>
                              {e.capture_source || 'PUBLIC'}
                            </span>
                            <span>{new Date(e.created_at || new Date()).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </div>
                          {e.image_path && (
                            <img src={e.image_path} alt="Evidence" style={{ width: '100%', maxWidth: '250px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                  {/* State transition */}
                  <form action={handleUpdateState} style={{ flexShrink: 0 }}>
                    <input type="hidden" name="work_id" value={w.id} />
                    <input type="hidden" name="current_state" value={w.status} />
                    <button
                      className="btn"
                      disabled={!nextState}
                      style={{ background: nextMeta ? nextMeta.color : '#374151', minWidth: '180px' }}
                    >
                      {nextState
                        ? `${nextMeta?.icon} Advance → ${nextMeta?.label}`
                        : '★ Fully Utilised'}
                    </button>
                  </form>

                  {/* Evidence upload with geo inputs */}
                  <EvidenceUploadForm workId={w.id} authority="OFFICER" action={handleUploadEvidence} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info banner */}
      <div style={{ marginTop: '40px', padding: '16px 20px', background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <strong style={{ color: '#818CF8' }}>Architecture Rules:</strong> State transitions are strictly linear (SANCTIONED → IN-EXECUTION → COMPLETED → UTILISED).
        No skipping or reversal is permitted. Every transition appends an immutable audit entry.
        Evidence may be appended from SANCTIONED onward and is immutable at creation.
        PUBLIC-captured evidence is non-authoritative and creates no state change.
      </div>
      <Chatbot role="officer" />
    </main>
  );
}
