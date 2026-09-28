'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────
const SEV_CFG = {
  CRITICAL: { label: 'CRITICAL', color: '#C55A5A', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', icon: '', pulse: true },
  HIGH:     { label: 'HIGH',     color: '#D97746', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.30)', icon: '', pulse: false },
  MEDIUM:   { label: 'MEDIUM',   color: '#C48F37', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', icon: '', pulse: false },
  LOW:      { label: 'LOW',      color: '#62A4B0', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.20)', icon: '', pulse: false },
};

const MODULE_META = {
  COST_OUTLIER:   { label: 'Cost Outlier',        icon: '', color: '#C48F37' },
  DUPLICATE:      { label: 'Duplicate Work',      icon: '', color: '#A78BFA' },
  TIMELINE:       { label: 'Timeline Violation',  icon: '⏱', color: '#C55A5A' },
  CONTRACTOR_NET: { label: 'Contractor Network',  icon: '', color: '#10B981' },
  SPLITTING:      { label: 'Tender Splitting',    icon: '', color: '#D97746' },
  GUIDELINE:      { label: 'Guideline Breach',    icon: '', color: '#62A4B0' },
  BENAMI:         { label: 'Benami Entity',       icon: '', color: '#EC4899' },
  SATELLITE:      { label: 'Ghost Work ',       icon: '', color: '#8B5CF6' },
  RISK_FUSION:    { label: 'Risk Fusion',         icon: '', color: '#06B6D4' },
  D1: { label: 'D1: Duplicate', icon: '', color: '#A78BFA' },
  D2: { label: 'D2: Cost Anomaly', icon: '', color: '#C48F37' },
  D3: { label: 'D3: Timeline Delay', icon: '⏱', color: '#C55A5A' },
  D6: { label: 'D6: Geo-Conflict', icon: '', color: '#62A4B0' },
  D6_overlap: { label: 'D6_overlap: Spatial Cluster', icon: '', color: '#D97746' },
  D8: { label: 'D8: Monopoly', icon: '', color: '#10B981' },
  ENSEMBLE: { label: 'AI Ensemble', icon: '', color: '#8B5CF6' },
};

function fmt(n) {
  if (!n) return '₹0';
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// Risk score → radial gauge color
function scoreColor(s) {
  return s >= 80 ? '#C55A5A' : s >= 60 ? '#D97746' : s >= 40 ? '#C48F37' : '#10B981';
}

// ─────────────────────────────────────────────────────────────────────────────
// Radial Risk Gauge
// ─────────────────────────────────────────────────────────────────────────────
function RiskGauge({ score, size = 80 }) {
  const C = 2 * Math.PI * (size / 2 - 8);
  const dash = (score / 100) * C;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size/2} cy={size/2} r={size/2-8} fill="none" stroke='rgba(42, 58, 49, 0.05)' strokeWidth="7" />
      <circle cx={size/2} cy={size/2} r={size/2-8} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.8s ease', filter: 'none' }} />
      <text x={size/2} y={size/2+2} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size === 80 ? '1.1rem' : '0.75rem'} fontWeight="700">{score}</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Satellite Before/After Slider
// ─────────────────────────────────────────────────────────────────────────────
function SatellitePanel({ flag }) {
  const [split, setSplit] = useState(50);
  const ev = flag?.evidence || {};
  const lat = ev.geo_latitude  || 20.59;
  const lon = ev.geo_longitude || 78.96;

  // Copernicus Browser URLs embedded as iframes are not cross-origin friendly
  // So we show a visual diff simulation with gradient panels
  const beforeStyle = {
    position: 'absolute', top: 0, left: 0,
    width: `${split}%`, height: '100%', overflow: 'hidden',
  };
  const afterStyle = {
    position: 'absolute', top: 0, left: `${split}%`,
    width: `${100 - split}%`, height: '100%',
  };

  return (
    <div className="glass-card" style={{ borderRadius: 12, overflow: 'hidden', padding: 0 }}>
      <div style={{ padding: '10px 16px', background: 'rgba(139,92,246,0.12)', borderBottom: '1px solid var(--border-color)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#A78BFA', fontWeight: 700, fontSize: '0.85rem' }}> Sentinel-2 Satellite Imagery</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
          {ev.demo_mode ? '(DEMO MODE — simulated change scores)' : 'Live Sentinel-2 NDBI Index'}
        </span>
      </div>
      <div style={{ position: 'relative', height: 200, cursor: 'col-resize', userSelect: 'none' }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          setSplit(Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100)));
        }}>
        {/* Before panel — static color to simulate "no change" */}
        <div style={{ ...beforeStyle, background: 'linear-gradient(135deg, #1a2a1a 0%, #2d4a2d 100%)' }}>
          <div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: '0.65rem', color: '#86efac',
            background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '2px 6px' }}>
            BEFORE SANCTION
          </div>
        </div>
        {/* After panel — same color (ghost work = no change) */}
        <div style={{ ...afterStyle, background: ev.sub_type === 'GHOST_WORK'
          ? 'linear-gradient(135deg, #1a2a1a 0%, #2d4a2d 100%)'  // ghost: identical
          : 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)' }}>  // real: different
          <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: '0.65rem',
            color: ev.sub_type === 'GHOST_WORK' ? '#fca5a5' : '#15803d',
            background: 'var(--text-main)', borderRadius: 4, padding: '2px 6px' }}>
            AFTER COMPLETION
          </div>
        </div>
        {/* Divider line */}
        <div style={{ position: 'absolute', top: 0, left: `${split}%`, width: 2, height: '100%',
          background: '#fff', boxShadow: '0 0 8px rgba(0,0,0,0.2)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: `${split}%`, transform: 'translate(-50%, -50%)',
          width: 28, height: 28, borderRadius: '50%', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(0,0,0,0.2)', pointerEvents: 'none', color: '#000', fontSize: '0.75rem' }}>↔</div>
        {/* Change score badge */}
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: ev.sub_type === 'GHOST_WORK' ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)',
          borderRadius: 20, padding: '3px 10px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-main)' }}>
          Change Score: {((ev.change_score || 0) * 100).toFixed(0)}% {ev.sub_type === 'GHOST_WORK' ? ' GHOST WORK' : ''}
        </div>
      </div>
      <div style={{ padding: '10px 16px', fontSize: '0.72rem', color: 'var(--text-muted)',
        display: 'flex', gap: 16 }}>
        <span> {lat.toFixed(4)}°N, {lon.toFixed(4)}°E</span>
        <a href={ev.before_imagery_url || '#'} target="_blank" rel="noreferrer"
          style={{ color: '#8B5CF6', textDecoration: 'none', fontWeight: 600 }}>View in Copernicus →</a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contractor Network Mini Graph (Canvas-based)
// ─────────────────────────────────────────────────────────────────────────────
function NetworkGraph({ districtFlags }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const concentrationFlags = districtFlags.filter(
      f => f.module_code === 'CONTRACTOR_NET' && f.evidence?.sub_type === 'CONCENTRATION'
    );
    if (concentrationFlags.length === 0) {
      ctx.fillStyle = 'rgba(42, 58, 49, 0.1)';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No contractor network data available yet.', W/2, H/2);
      return;
    }

    // Simple force-directed layout simulation (static positions for clarity)
    const nodes = concentrationFlags.slice(0, 8).map((f, i) => ({
      id:    f.evidence.top_contractor_id || `node-${i}`,
      label: (f.evidence.top_contractor || 'Unknown').slice(0, 12),
      x:     W/2 + Math.cos((i / concentrationFlags.slice(0,8).length) * 2 * Math.PI) * (W/3 - 20),
      y:     H/2 + Math.sin((i / concentrationFlags.slice(0,8).length) * 2 * Math.PI) * (H/3 - 20),
      share: f.evidence.share_pct || 50,
      severity: f.severity,
    }));

    // Draw connections to center (district hub)
    ctx.strokeStyle = 'rgba(239,68,68,0.25)';
    ctx.lineWidth = 1;
    for (const n of nodes) {
      ctx.beginPath(); ctx.moveTo(W/2, H/2); ctx.lineTo(n.x, n.y); ctx.stroke();
    }

    // Center node
    ctx.beginPath(); ctx.arc(W/2, H/2, 14, 0, 2*Math.PI);
    ctx.fillStyle = 'rgba(56,189,248,0.15)'; ctx.fill();
    ctx.strokeStyle = '#62A4B0'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#62A4B0'; ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Districts', W/2, H/2 + 3);

    // Contractor nodes
    for (const n of nodes) {
      const r = Math.max(10, (n.share / 100) * 22);
      const color = n.severity === 'CRITICAL' ? '#C55A5A' : '#D97746';
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2*Math.PI);
      ctx.fillStyle = `${color}22`; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = color; ctx.font = `bold ${r > 14 ? 9 : 7}px sans-serif`;
      ctx.fillText(n.label, n.x, n.y + 1);
      ctx.fillStyle = 'var(--text-main)'; ctx.font = '7px sans-serif';
      ctx.fillText(`${n.share}%`, n.x, n.y + 12);
    }
  }, [districtFlags]);

  return (
    <canvas ref={canvasRef} width={320} height={220}
      style={{ width: '100%', height: 220, display: 'block' }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor Bar (per-module contribution breakdown)
// ─────────────────────────────────────────────────────────────────────────────
function FactorBar({ factor }) {
  const meta = MODULE_META[factor.module] || { label: factor.module, icon: '', color: '#94A3B8' };
  const maxContrib = 35; // max possible contribution
  const w = Math.min(100, (factor.contribution / maxContrib) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.75rem', color: meta.color, fontWeight: 600 }}>
          {meta.icon} {meta.label}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          +{factor.contribution} pts ({factor.severity})
        </span>
      </div>
      <div style={{ background: 'var(--border-color)', borderRadius: 4, height: 8, boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.06)' }}>
        <div style={{ width: `${w}%`, height: '100%', borderRadius: 4,
          background: meta.color, transition: 'width 0.6s ease',
          boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.1)' }} />
      </div>
      {factor.message && factor.message !== 'No detailed message provided' && factor.message !== 'null' && (
        <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)',
          fontStyle: 'italic', lineHeight: 1.4 }}>{factor.message.slice(0, 120)}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Work Detail Panel
// ─────────────────────────────────────────────────────────────────────────────

function formatEvidenceToText(moduleCode, ev) {
  if (ev?.message) return ev.message;
  if (!ev) return 'No evidence provided';

  const fmtAmt = n => n ? '₹' + Math.round(n).toLocaleString('en-IN') : '₹0';
  const fmtPct = n => n ? Math.round(n * 100) + '%' : '0%';
  
  switch (moduleCode) {
    case 'D1':
      return 'Detected a ' + fmtPct(ev.similarity) + ' similarity match with work ' + ev.matched_with + '. They share the same agency (' + (ev.same_agency ? 'Yes' : 'No') + ') and are located ' + (ev.geo_distance_km?.toFixed(1) || '0') + ' km apart. Financial variance is only ' + fmtPct(ev.amount_delta) + '.';
    case 'D2':
      return 'Cost outlier detected. The requested amount is significantly outside the expected statistical band (Z-score: ' + ev.z_score?.toFixed(1) + '). The local peer average is ' + fmtAmt(ev.peer_mean) + ', but this work requests ' + fmtAmt(ev.amount) + '.';
    case 'D3':
      return 'Temporal anomaly. Work execution timeframes indicate irregularities. The delay between release and start is ' + ev.start_gap_days + ' days. Fund expenditure ratio is ' + fmtPct(ev.spend_ratio) + ' for a total amount of ' + fmtAmt(ev.amount) + '.';
    case 'D6':
      return 'Geospatial conflict. This work is located ' + (ev.distance_km?.toFixed(1) || '0') + ' km away from the nearest valid settlement (' + ev.nearest_village + '). Currently marked as ' + ev.status + ' with a ' + fmtPct(ev.spend_ratio) + ' spend ratio.';
    case 'D6_overlap':
      return 'Spatial cluster overlap. This work clusters tightly with other works (' + (ev.cluster_members?.join(', ') || '') + ') in the same category (' + (ev.categories?.join(', ') || '') + '). Potential duplicate or overlapping billing.';
    case 'D8':
      return 'Contractor network anomaly. Agency ' + ev.agency_id + ' is operating across ' + ev.cross_districts + ' different districts simultaneously. Found ' + ev.dup_matches + ' overlapping matches with works like ' + (ev.matched_works?.join(', ') || '') + '.';
    case 'ENSEMBLE':
      return 'The AI Ensemble model computed a high risk probability based on aggregate features: Cost log-variance (' + ev.feature_values?.log_amount?.toFixed(2) + '), Contractor monopoly share (' + fmtPct(ev.feature_values?.agency_share) + '), and Cluster density.';
    default:
      try {
        const lines = Object.entries(ev).filter(x => typeof x[1] !== 'object').map(x => x[0].replace(/_/g, ' ') + ': ' + x[1]);
        if (lines.length > 0) return lines.join(', ');
      } catch(e) {}
      return JSON.stringify(ev);
  }
}

function WorkDetailPanel({ work, districtFlags, onFeedback, feedbackMap }) {
  const sev = SEV_CFG[work.severity] || SEV_CFG.MEDIUM;
  const satFlag = work.flags?.find(f => f.module_code === 'SATELLITE');
  const verdict = feedbackMap[work.work_id];

  return (
    <div className="glass-card" style={{
      padding: '20px 24px',
      
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <RiskGauge score={work.risk_score} size={80} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
              Work #{work.work_id}
            </h2>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
              background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
              {sev.icon} {sev.label}
            </span>
            {verdict && (
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                background: verdict === 'CONFIRMED_FRAUD' ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.15)',
                color: verdict === 'CONFIRMED_FRAUD' ? '#C55A5A' : '#62A4B0',
                border: `1px solid ${verdict === 'CONFIRMED_FRAUD' ? 'rgba(239,68,68,0.3)' : 'rgba(56,189,248,0.3)'}` }}>
                {verdict === 'CONFIRMED_FRAUD' ? ' Confirmed Fraud' : ' False Positive'}
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Risk Score: <strong style={{ color: scoreColor(work.risk_score) }}>{work.risk_score}/100</strong>
            &nbsp;·&nbsp; {work.module_count} module{work.module_count !== 1 ? 's' : ''} flagged
          </p>
        </div>
      </div>

      {/* Factor breakdown */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk Factor Breakdown</h3>
        {(work.factors || []).map((f, i) => <FactorBar key={i} factor={f} />)}
      </div>

      {/* Satellite verifier */}
      {satFlag && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>Satellite Verification</h3>
          <SatellitePanel flag={satFlag} />
        </div>
      )}

      {/* Contractor network */}
      {districtFlags.filter(f => f.module_code === 'CONTRACTOR_NET').length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contractor Network Graph</h3>
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <NetworkGraph districtFlags={districtFlags} />
            </div>
        </div>
      )}

      {/* All flags */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Evidence Chain ({work.flags?.length || 0} flags)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(work.flags || []).map((f, i) => {
            const meta = MODULE_META[f.module_code] || { icon:'', color:'#94A3B8', label: f.module_code };
            const s    = SEV_CFG[f.severity] || SEV_CFG.MEDIUM;
            return (
              <div key={i} className="glass-card" style={{ padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.75rem', color: meta.color, fontWeight: 700 }}>
                    {meta.icon} {meta.label}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: s.color, fontWeight: 700 }}>{f.severity}</span>
                </div>
                <div style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                  {formatEvidenceToText(f.module_code, f.evidence)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Investigator feedback */}
      {!verdict && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            id={`btn-confirm-${work.work_id}`}
            onClick={() => onFeedback(work.work_id, 'CONFIRMED_FRAUD')}
            className="btn"
            style={{ flex: 1, padding: '10px', background: 'var(--danger)', color: '#fff', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.2s', border: 'none' }}>
             Confirm Fraud
          </button>
          <button
            id={`btn-fp-${work.work_id}`}
            onClick={() => onFeedback(work.work_id, 'FALSE_POSITIVE')}
            className="btn"
            style={{ flex: 1, padding: '10px', background: 'var(--primary)', color: '#fff', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.2s', border: 'none' }}>
             False Positive
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary KPI cards
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'var(--text-main)', icon }) {
  return (
    <div className="stat-card" style={{ minWidth: 140 }}>
      <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{icon}</div>
      <div className="stat-value" style={{ color: color !== '#62A4B0' ? color : 'var(--text-main)' }}>{value}</div>
      <div className="stat-label" style={{ marginTop: 4 }}>{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function FraudInvestigatorPage() {
  const [loading, setLoading]           = useState(true);
  const [scanning, setScanning]         = useState(false);
  const [error, setError]               = useState(null);
  const [perWork, setPerWork]           = useState([]);
  const [districtFlags, setDistrictFlags] = useState([]);
  const [summary, setSummary]           = useState(null);
  const [selectedWork, setSelectedWork] = useState(null);
  const [feedbackMap, setFeedbackMap]   = useState({});
  const [filterSev, setFilterSev]       = useState('ALL');
  const [filterMod, setFilterMod]       = useState('ALL');
  const [searchQ, setSearchQ]           = useState('');
  const [exporting, setExporting]       = useState(false);

  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const res  = await fetch('/api/fraud?top=100');
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setPerWork(data.perWork || []);
      setDistrictFlags(data.districtFlags || []);
      setSummary(data.summary);
      if (data.perWork?.length > 0 && !selectedWork) {
        setSelectedWork(data.perWork[0]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
      setLoading(false);
    }
  }, [selectedWork]);

  useEffect(() => { runScan(); }, []);

  const handleFeedback = useCallback(async (workId, verdict) => {
    try {
      const res  = await fetch('/api/fraud/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_id: workId, verdict }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedbackMap(prev => ({ ...prev, [workId]: verdict }));
        alert(data.message);
      }
    } catch (e) { alert('Error saving feedback: ' + e.message); }
  }, []);

  const exportCSV = useCallback(() => {
    setExporting(true);
    const rows = [
      'work_id,risk_score,severity,module_count,top_factor,verdict',
      ...perWork.map(w =>
        `"${w.work_id}",${w.risk_score},"${w.severity}",${w.module_count},"${w.factors?.[0]?.module || ''}","${feedbackMap[w.work_id] || ''}"`
      ),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `fraud_audit_queue_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setTimeout(() => setExporting(false), 1000);
  }, [perWork, feedbackMap]);

  // Filter works
  const filteredWorks = perWork.filter(w => {
    if (filterSev !== 'ALL' && w.severity !== filterSev) return false;
    if (filterMod !== 'ALL' && !w.factors?.some(f => f.module === filterMod)) return false;
    if (searchQ && !w.work_id.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  // Replaced with globals.css classes

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) return (
    <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ marginBottom: 16 }}></div>
        <div style={{ color: '#A78BFA', fontSize: '1.1rem', fontWeight: 600 }}>Running Fraud Detection Engines…</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 8 }}>Analysing across all AI risk dimensions</div>
      </div>
    </main>
  );

  if (error) return (
    <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="alert alert-error" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}></div>
        <div style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: 8 }}>Scan Error</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>{error}</div>
        <button className="btn btn-danger btn-sm" onClick={runScan}>Retry</button>
      </div>
    </main>
  );

  return (
    <main className="main-content">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start',
          marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {summary && (
              <div className="glass-card" style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.72rem',
                background: 'rgba(42, 58, 49, 0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-muted)' }}>
                Scanned in {summary.scan_ms}ms
              </div>
            )}
            <button id="btn-rescan" onClick={runScan} disabled={scanning}
              className="glass-card"
              style={{ padding: '8px 18px', borderRadius: 12, border: 'none',
                color: '#A78BFA', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem' }}>
              {scanning ? ' Scanning…' : '↻ Re-scan'}
            </button>
            <button id="btn-export-csv" onClick={exportCSV} disabled={exporting}
              className="glass-card"
              style={{ padding: '8px 18px', borderRadius: 12, border: 'none',
                color: '#10B981', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.85rem' }}>
              {exporting ? '' : ' Export CSV'}
            </button>
          </div>
        </div>

        {/* ── Summary KPIs ────────────────────────────────────────────────── */}
        {summary && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiCard icon="" label="Total Works" value={summary.total_works} color="#62A4B0" />
            <KpiCard icon="" label="Flagged Works" value={summary.flagged_works}
              sub={`${Math.round((summary.flagged_works/Math.max(summary.total_works,1))*100)}% of total`}
              color="#D97746" />
            <KpiCard icon="" label="Critical" value={summary.critical_works} color="#C55A5A" />
            <KpiCard icon="" label="High Risk" value={summary.high_works} color="#D97746" />
            <KpiCard icon="" label="Avg Risk Score" value={`${summary.avg_risk}/100`} color="#A78BFA" />
            <KpiCard icon="" label="Total Flags" value={summary.total_flags} color="#C48F37" />
            <KpiCard icon="" label="District Flags" value={summary.district_flags} color="#10B981" />
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input id="search-works" placeholder="Search work ID…" value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="glass-card"
            style={{ padding: '8px 14px', borderRadius: 12, border: 'none', color: 'var(--text-main)', outline: 'none', minWidth: 180,
              fontSize: '0.8rem' }} />
          {['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
            <button key={s} id={`filter-sev-${s}`} onClick={() => setFilterSev(s)}
              className="glass-card" style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                fontWeight: filterSev === s ? 700 : 400,
                background: 'var(--surface-2)',
                color: filterSev === s ? (SEV_CFG[s]?.color || 'var(--text-main)') : 'var(--text-muted)',
                border: filterSev === s
                  ? `2px solid ${SEV_CFG[s]?.color || 'var(--primary)'}`
                  : '2px solid transparent',
                borderRadius: 20 }}>
              {s}
            </button>
          ))}
          <select className="select-field" id="filter-module" value={filterMod} onChange={e => setFilterMod(e.target.value)}
            style={{ width: 'auto', display: 'inline-block' }}>
            <option value="ALL">All Modules</option>
            {Object.entries(MODULE_META).map(([k, m]) => (
              <option key={k} value={k}>{m.icon} {m.label}</option>
            ))}
          </select>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            Showing {filteredWorks.length} works
          </span>
        </div>

        {/* ── Main layout: list + detail ───────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* Work list */}
          <div style={{ width: 380, flexShrink: 0, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
            {filteredWorks.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}></div>
                No works match the current filters.
              </div>
            )}
            {filteredWorks.map(work => {
              const sev     = SEV_CFG[work.severity] || SEV_CFG.MEDIUM;
              const isActive = selectedWork?.work_id === work.work_id;
              const verdict  = feedbackMap[work.work_id];
              return (
                <div key={work.work_id} id={`work-item-${work.work_id}`}
                  onClick={() => setSelectedWork(work)}
                  className="glass-card" style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 8, cursor: 'pointer',
                    background: 'var(--surface-2)',
                    border: isActive ? `2px solid ${sev.color}` : `2px solid transparent`,
                    transition: 'all 0.2s',
                    boxShadow: isActive ? `inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light)` : undefined,
                    color: 'var(--text-main)',
                    borderRadius: 16
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isActive ? sev.color : 'var(--text-main)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sev.icon} {work.work_id}
                        </span>
                        {sev.pulse && isActive && (
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sev.color,
                            animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                        )}
                        {verdict && (
                          <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: 10,
                            background: verdict === 'CONFIRMED_FRAUD' ? 'rgba(239,68,68,0.2)' : 'rgba(56,189,248,0.2)',
                            color: verdict === 'CONFIRMED_FRAUD' ? '#C55A5A' : '#62A4B0', flexShrink: 0 }}>
                            {verdict === 'CONFIRMED_FRAUD' ? '' : ''}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {(work.factors || []).slice(0, 3).map((f, i) => {
                          const m = MODULE_META[f.module] || { icon:'', color:'#94A3B8' };
                          return (
                            <span key={i} style={{ fontSize: '0.62rem', color: m.color, padding: '1px 5px',
                              borderRadius: 6, background: `${m.color}18`, border: `1px solid ${m.color}30` }}>
                              {m.icon}
                            </span>
                          );
                        })}
                        {(work.factors?.length || 0) > 3 && (
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                            +{work.factors.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                    <RiskGauge score={work.risk_score} size={46} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {selectedWork ? (
              <WorkDetailPanel
                work={selectedWork}
                districtFlags={districtFlags}
                onFeedback={handleFeedback}
                feedbackMap={feedbackMap}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'rgba(42, 58, 49, 0.1)', padding: 60 }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}></div>
                Select a work from the list to view details
              </div>
            )}

            {/* District-level flags */}
            {districtFlags.length > 0 && (
              <div style={{ marginTop: 20, background: 'rgba(16,185,129,0.04)', borderRadius: 16,
                border: '1px solid rgba(16,185,129,0.15)', padding: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#10B981',
                  textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                   District-Level Flags ({districtFlags.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {districtFlags.slice(0, 8).map((f, i) => {
                    const meta = MODULE_META[f.module_code] || { icon:'', color:'#94A3B8', label: f.module_code };
                    const s    = SEV_CFG[f.severity] || SEV_CFG.MEDIUM;
                    return (
                      <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: s.bg, border: `1px solid ${s.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: meta.color, fontWeight: 600 }}>
                            {meta.icon} {meta.label}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: s.color, fontWeight: 700 }}>{f.severity}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                          {f.evidence?.message}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
