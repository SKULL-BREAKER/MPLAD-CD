'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────────────────────────────────────
const SEV_CFG = {
  CRITICAL: { label: 'CRITICAL', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', icon: '', pulse: true },
  HIGH:     { label: 'HIGH',     color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.30)', icon: '', pulse: false },
  MEDIUM:   { label: 'MEDIUM',   color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', icon: '', pulse: false },
  LOW:      { label: 'LOW',      color: '#38BDF8', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.20)', icon: '', pulse: false },
};

const MODULE_META = {
  COST_OUTLIER:   { label: 'Cost Outlier',        icon: '', color: '#F59E0B' },
  DUPLICATE:      { label: 'Duplicate Work',       icon: '',  color: '#A78BFA' },
  TIMELINE:       { label: 'Timeline Violation',   icon: '', color: '#EF4444' },
  CONTRACTOR_NET: { label: 'Contractor Network',   icon: '️', color: '#10B981' },
  SPLITTING:      { label: 'Tender Splitting',     icon: '️', color: '#F97316' },
  GUIDELINE:      { label: 'Guideline Breach',     icon: '', color: '#38BDF8' },
  BENAMI:         { label: 'Benami Entity',        icon: '', color: '#EC4899' },
  SATELLITE:      { label: 'Ghost Work ️',        icon: '️', color: '#8B5CF6' },
  RISK_FUSION:    { label: 'Risk Fusion',          icon: '', color: '#06B6D4' },
};

function fmt(n) {
  if (!n) return '₹0';
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

// Risk score → radial gauge color
function scoreColor(s) {
  return s >= 80 ? '#EF4444' : s >= 60 ? '#F97316' : s >= 40 ? '#F59E0B' : '#10B981';
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
      <circle cx={size/2} cy={size/2} r={size/2-8} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
      <circle cx={size/2} cy={size/2} r={size/2-8} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${C}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 6px ${color})` }} />
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
    <div style={{ borderRadius: 12, overflow: 'hidden', background: '#0a0a0f', border: '1px solid rgba(139,92,246,0.3)' }}>
      <div style={{ padding: '10px 16px', background: 'rgba(139,92,246,0.12)', borderBottom: '1px solid rgba(139,92,246,0.2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#A78BFA', fontWeight: 700, fontSize: '0.85rem' }}>️ Sentinel-2 Satellite Imagery</span>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem' }}>
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
          : 'linear-gradient(135deg, #1a1a2e 0%, #4a3a1a 100%)' }}>  // real: different
          <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: '0.65rem',
            color: ev.sub_type === 'GHOST_WORK' ? '#fca5a5' : '#86efac',
            background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '2px 6px' }}>
            AFTER COMPLETION
          </div>
        </div>
        {/* Divider line */}
        <div style={{ position: 'absolute', top: 0, left: `${split}%`, width: 2, height: '100%',
          background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,0.8)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: `${split}%`, transform: 'translate(-50%, -50%)',
          width: 28, height: 28, borderRadius: '50%', background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px rgba(255,255,255,0.8)', pointerEvents: 'none', fontSize: '0.75rem' }}>↔</div>
        {/* Change score badge */}
        <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: ev.sub_type === 'GHOST_WORK' ? 'rgba(239,68,68,0.9)' : 'rgba(16,185,129,0.9)',
          borderRadius: 20, padding: '3px 10px', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>
          Change Score: {((ev.change_score || 0) * 100).toFixed(0)}% {ev.sub_type === 'GHOST_WORK' ? '️ GHOST WORK' : ''}
        </div>
      </div>
      <div style={{ padding: '10px 16px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)',
        display: 'flex', gap: 16 }}>
        <span> {lat.toFixed(4)}°N, {lon.toFixed(4)}°E</span>
        <a href={ev.before_imagery_url || '#'} target="_blank" rel="noreferrer"
          style={{ color: '#A78BFA', textDecoration: 'none' }}>View in Copernicus →</a>
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
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
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
    ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#38BDF8'; ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Districts', W/2, H/2 + 3);

    // Contractor nodes
    for (const n of nodes) {
      const r = Math.max(10, (n.share / 100) * 22);
      const color = n.severity === 'CRITICAL' ? '#EF4444' : '#F97316';
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2*Math.PI);
      ctx.fillStyle = `${color}22`; ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = color; ctx.font = `bold ${r > 14 ? 9 : 7}px sans-serif`;
      ctx.fillText(n.label, n.x, n.y + 1);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '7px sans-serif';
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
  const meta = MODULE_META[factor.module] || { label: factor.module, icon: '️', color: '#94A3B8' };
  const maxContrib = 35; // max possible contribution
  const w = Math.min(100, (factor.contribution / maxContrib) * 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.75rem', color: meta.color, fontWeight: 600 }}>
          {meta.icon} {meta.label}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
          +{factor.contribution} pts ({factor.severity})
        </span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 6 }}>
        <div style={{ width: `${w}%`, height: '100%', borderRadius: 4,
          background: meta.color, transition: 'width 0.6s ease',
          boxShadow: `0 0 6px ${meta.color}` }} />
      </div>
      <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)',
        fontStyle: 'italic', lineHeight: 1.4 }}>{factor.message?.slice(0, 120)}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Work Detail Panel
// ─────────────────────────────────────────────────────────────────────────────
function WorkDetailPanel({ work, districtFlags, onFeedback, feedbackMap }) {
  const sev = SEV_CFG[work.severity] || SEV_CFG.MEDIUM;
  const satFlag = work.flags?.find(f => f.module_code === 'SATELLITE');
  const verdict = feedbackMap[work.work_id];

  return (
    <div style={{
      background: 'rgba(14,14,30,0.95)', border: `1px solid ${sev.border}`,
      borderRadius: 16, padding: '20px 24px',
      boxShadow: sev.color === '#EF4444' ? `0 0 30px rgba(239,68,68,0.12)` : 'none',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <RiskGauge score={work.risk_score} size={80} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: 700 }}>
              Work #{work.work_id}
            </h2>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
              background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
              {sev.icon} {sev.label}
            </span>
            {verdict && (
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                background: verdict === 'CONFIRMED_FRAUD' ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.15)',
                color: verdict === 'CONFIRMED_FRAUD' ? '#EF4444' : '#38BDF8',
                border: `1px solid ${verdict === 'CONFIRMED_FRAUD' ? 'rgba(239,68,68,0.3)' : 'rgba(56,189,248,0.3)'}` }}>
                {verdict === 'CONFIRMED_FRAUD' ? '️ Confirmed Fraud' : ' False Positive'}
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
            Risk Score: <strong style={{ color: scoreColor(work.risk_score) }}>{work.risk_score}/100</strong>
            &nbsp;·&nbsp; {work.module_count} module{work.module_count !== 1 ? 's' : ''} flagged
          </p>
        </div>
      </div>

      {/* Factor breakdown */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk Factor Breakdown</h3>
        {(work.factors || []).map((f, i) => <FactorBar key={i} factor={f} />)}
      </div>

      {/* Satellite verifier */}
      {satFlag && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>Satellite Verification</h3>
          <SatellitePanel flag={satFlag} />
        </div>
      )}

      {/* Contractor network */}
      {districtFlags.filter(f => f.module_code === 'CONTRACTOR_NET').length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contractor Network Graph</h3>
          <div style={{ background: '#070712', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)', overflow: 'hidden' }}>
            <NetworkGraph districtFlags={districtFlags} />
          </div>
        </div>
      )}

      {/* All flags */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>Evidence Chain ({work.flags?.length || 0} flags)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(work.flags || []).map((f, i) => {
            const meta = MODULE_META[f.module_code] || { icon:'️', color:'#94A3B8', label: f.module_code };
            const s    = SEV_CFG[f.severity] || SEV_CFG.MEDIUM;
            return (
              <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: s.bg, border: `1px solid ${s.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', color: meta.color, fontWeight: 600 }}>
                    {meta.icon} {meta.label}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: s.color }}>{f.severity}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                  {f.evidence?.message || (f.evidence ? JSON.stringify(f.evidence).slice(0, 200) : 'No evidence provided')}
                </p>
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
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)',
              background: 'rgba(239,68,68,0.12)', color: '#EF4444', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.2s' }}>
            ️ Confirm Fraud
          </button>
          <button
            id={`btn-fp-${work.work_id}`}
            onClick={() => onFeedback(work.work_id, 'FALSE_POSITIVE')}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(56,189,248,0.3)',
              background: 'rgba(56,189,248,0.08)', color: '#38BDF8', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.2s' }}>
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
function KpiCard({ label, value, sub, color = '#38BDF8', icon }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.08)', padding: '18px 22px', minWidth: 140 }}>
      <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
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

  const panelStyle = {
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    background: 'linear-gradient(135deg, #060611 0%, #0d0d20 50%, #080812 100%)',
    minHeight: '100vh',
    color: '#fff',
    padding: '24px',
  };

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) return (
    <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16, animation: 'spin 2s linear infinite' }}>️</div>
        <div style={{ color: '#A78BFA', fontSize: '1.1rem', fontWeight: 600 }}>Running Fraud Detection Engines…</div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', marginTop: 8 }}>Analysing all 10 modules</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 16, padding: 32 }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}></div>
        <div style={{ color: '#EF4444', fontWeight: 600, marginBottom: 8 }}>Scan Error</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginBottom: 16 }}>{error}</div>
        <button onClick={runScan} style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(239,68,68,0.2)',
          border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444', cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  );

  return (
    <div style={panelStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        button:hover { opacity: 0.85; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10,
                background: 'linear-gradient(135deg, #7C3AED, #EC4899)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}></div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800,
                  background: 'linear-gradient(90deg, #A78BFA, #EC4899)', WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent' }}>
                  MPLADS Fraud Investigator
                </h1>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                  AI-Powered 10-Module Fraud Detection Engine · Decision Support Only
                </p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {summary && (
              <div style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.72rem',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.4)' }}>
                Scanned in {summary.scan_ms}ms
              </div>
            )}
            <button id="btn-rescan" onClick={runScan} disabled={scanning}
              style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(167,139,250,0.4)',
                background: 'rgba(167,139,250,0.12)', color: '#A78BFA', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.8rem' }}>
              {scanning ? ' Scanning…' : '↻ Re-scan'}
            </button>
            <button id="btn-export-csv" onClick={exportCSV} disabled={exporting}
              style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(16,185,129,0.4)',
                background: 'rgba(16,185,129,0.12)', color: '#10B981', cursor: 'pointer',
                fontWeight: 600, fontSize: '0.8rem' }}>
              {exporting ? '' : '⬇️ Export CSV'}
            </button>
          </div>
        </div>

        {/* ── Summary KPIs ────────────────────────────────────────────────── */}
        {summary && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiCard icon="" label="Total Works" value={summary.total_works} color="#38BDF8" />
            <KpiCard icon="" label="Flagged Works" value={summary.flagged_works}
              sub={`${Math.round((summary.flagged_works/Math.max(summary.total_works,1))*100)}% of total`}
              color="#F97316" />
            <KpiCard icon="" label="Critical" value={summary.critical_works} color="#EF4444" />
            <KpiCard icon="" label="High Risk" value={summary.high_works} color="#F97316" />
            <KpiCard icon="" label="Avg Risk Score" value={`${summary.avg_risk}/100`} color="#A78BFA" />
            <KpiCard icon="" label="Total Flags" value={summary.total_flags} color="#F59E0B" />
            <KpiCard icon="️" label="District Flags" value={summary.district_flags} color="#10B981" />
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input id="search-works" placeholder="Search work ID…" value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', minWidth: 180,
              fontSize: '0.8rem' }} />
          {['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
            <button key={s} id={`filter-sev-${s}`} onClick={() => setFilterSev(s)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: '0.75rem', cursor: 'pointer',
                fontWeight: filterSev === s ? 700 : 400,
                background: filterSev === s
                  ? (SEV_CFG[s]?.bg || 'rgba(255,255,255,0.12)')
                  : 'rgba(255,255,255,0.04)',
                color: filterSev === s ? (SEV_CFG[s]?.color || '#fff') : 'rgba(255,255,255,0.4)',
                border: filterSev === s
                  ? `1px solid ${SEV_CFG[s]?.border || 'rgba(255,255,255,0.2)'}`
                  : '1px solid rgba(255,255,255,0.08)' }}>
              {s}
            </button>
          ))}
          <select id="filter-module" value={filterMod} onChange={e => setFilterMod(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none',
              fontSize: '0.8rem', cursor: 'pointer' }}>
            <option value="ALL">All Modules</option>
            {Object.entries(MODULE_META).map(([k, m]) => (
              <option key={k} value={k}>{m.icon} {m.label}</option>
            ))}
          </select>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
            Showing {filteredWorks.length} works
          </span>
        </div>

        {/* ── Main layout: list + detail ───────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* Work list */}
          <div style={{ width: 380, flexShrink: 0, maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
            {filteredWorks.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40 }}>
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
                  style={{
                    padding: '14px 16px', borderRadius: 12, marginBottom: 8, cursor: 'pointer',
                    background: isActive ? sev.bg : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? sev.border : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.2s',
                    boxShadow: isActive && work.severity === 'CRITICAL' ? `0 0 20px rgba(239,68,68,0.15)` : 'none',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
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
                            color: verdict === 'CONFIRMED_FRAUD' ? '#EF4444' : '#38BDF8', flexShrink: 0 }}>
                            {verdict === 'CONFIRMED_FRAUD' ? '️' : ''}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {(work.factors || []).slice(0, 3).map((f, i) => {
                          const m = MODULE_META[f.module] || { icon:'️', color:'#94A3B8' };
                          return (
                            <span key={i} style={{ fontSize: '0.62rem', color: m.color, padding: '1px 5px',
                              borderRadius: 6, background: `${m.color}18`, border: `1px solid ${m.color}30` }}>
                              {m.icon}
                            </span>
                          );
                        })}
                        {(work.factors?.length || 0) > 3 && (
                          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>
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
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', padding: 60 }}>
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
                  ️ District-Level Flags ({districtFlags.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {districtFlags.slice(0, 8).map((f, i) => {
                    const meta = MODULE_META[f.module_code] || { icon:'️', color:'#94A3B8', label: f.module_code };
                    const s    = SEV_CFG[f.severity] || SEV_CFG.MEDIUM;
                    return (
                      <div key={i} style={{ padding: '10px 14px', borderRadius: 8, background: s.bg, border: `1px solid ${s.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: '0.75rem', color: meta.color, fontWeight: 600 }}>
                            {meta.icon} {meta.label}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: s.color, fontWeight: 700 }}>{f.severity}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
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
    </div>
  );
}
