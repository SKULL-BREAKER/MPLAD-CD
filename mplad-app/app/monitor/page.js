'use client';
import { useEffect, useState, useCallback, useRef } from 'react';

// ── Default thresholds (mirrors server defaults) ──────────────────────────────
const THRESHOLD_DEFAULTS = {
  minSanctionAmount:      100000,
  fundBalanceWarnPct:     0.25,
  fundBalanceCriticalPct: 0.10,
  stalledExecutionDays:   30,
  unstartedSanctionDays:  60,
  lowUtilisationPct:      0.30,
  expenditureGapPct:      0.50,
  highRejectionRatePct:   0.40,
};

const REFRESH_SEC = 30;

// ── Severity / dimension config ───────────────────────────────────────────────
const SEV_CFG = {
  CRITICAL: { label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)', icon: '', glow: '0 0 20px rgba(239,68,68,0.20)' },
  HIGH:     { label: 'High',     color: '#F97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.28)', icon: '', glow: '0 0 16px rgba(249,115,22,0.18)' },
  MEDIUM:   { label: 'Medium',   color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', icon: '', glow: '' },
  LOW:      { label: 'Low',      color: '#38BDF8', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.20)', icon: '', glow: '' },
};

const DIM_CFG = {
  PAST:    { label: 'Past',    icon: '', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
  PRESENT: { label: 'Present', icon: '', color: '#38BDF8', bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.25)' },
  FUTURE:  { label: 'Future',  icon: '', color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)' },
};

const CONF_CFG = {
  HIGH:   { label: 'High confidence',   color: '#10B981' },
  MEDIUM: { label: 'Medium confidence', color: '#F59E0B' },
  LOW:    { label: 'Low confidence',    color: '#94A3B8' },
};

const STATUS_CFG = {
  CRITICAL: { label: 'CRITICAL ISSUES DETECTED',    color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.30)',  pulse: true  },
  WARNING:  { label: 'WARNING — ACTION REQUIRED',    color: '#F97316', bg: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.28)', pulse: true  },
  CAUTION:  { label: 'CAUTION — MINOR ISSUES',       color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', pulse: false },
  HEALTHY:  { label: 'ALL SYSTEMS HEALTHY',          color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.22)', pulse: false },
  LOADING:  { label: 'SCANNING ALL DIMENSIONS…',    color: '#38BDF8', bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.22)', pulse: true  },
};

const CAT_LABEL = {
  FUND_BALANCE:        ' Fund Balance',    SCST_COMPLIANCE: '️ SC/ST Compliance',
  TREND_UTILISATION:   ' Utilisation Trend', TREND_REJECTION: ' Rejection Trend',
  TREND_FUND_USAGE:    ' Fund Usage Trend', SCST_HISTORY:   ' SC/ST History',
  STALLED_WORK:        '️ Stalled Work',     UNSTARTED_WORK: ' Unstarted Work',
  DUPLICATION:         ' Duplication',       EVIDENCE:       ' Evidence',
  EXPENDITURE:         ' Expenditure',      UTILISATION:    ' Utilisation',
  LOW_VALUE_PROPOSAL:  ' Low-Value',        FUND_FORECAST:  ' Fund Forecast',
  UNDERSPEND_RISK:     '️ Underspend Risk',  SCST_FORECAST:  ' SC/ST Forecast',
  STAGNATION_RISK:     ' Stagnation Risk',  SECTOR_CONCENTRATION: ' Sector Risk',
};

// ── Mini sparkline (SVG) ──────────────────────────────────────────────────────
function Sparkline({ data, color = '#38BDF8', width = 80, height = 32 }) {
  if (!data || data.length < 2) return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>—</span>;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(' ').pop().split(',')[0]} cy={pts.split(' ').pop().split(',')[1]} r="2.5" fill={color} />
    </svg>
  );
}

// ── Health gauge ──────────────────────────────────────────────────────────────
function HealthGauge({ score }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : score >= 40 ? '#F97316' : '#EF4444';
  const C = 2 * Math.PI * 52;
  const offset = C * (1 - score / 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <svg width="130" height="130" viewBox="0 0 116 116" style={{ filter: `drop-shadow(0 0 14px ${color}55)` }}>
        <circle cx="58" cy="58" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle cx="58" cy="58" r="52" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={offset} transform="rotate(-90 58 58)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.6s ease' }} />
        <text x="58" y="54" textAnchor="middle" fill={color} fontSize="24" fontWeight="800" fontFamily="Inter,sans-serif">{score}</text>
        <text x="58" y="70" textAnchor="middle" fill="rgba(255,255,255,0.38)" fontSize="9" fontFamily="Inter,sans-serif">HEALTH SCORE</text>
      </svg>
    </div>
  );
}

// ── Alert card ────────────────────────────────────────────────────────────────
function AlertCard({ alert }) {
  const sc = SEV_CFG[alert.severity] || SEV_CFG.LOW;
  const dc = DIM_CFG[alert.dimension] || DIM_CFG.PRESENT;
  const cc = CONF_CFG[alert.confidence] || CONF_CFG.MEDIUM;
  return (
    <div style={{
      background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: '12px',
      padding: '14px 18px', boxShadow: sc.glow, position: 'relative', overflow: 'hidden',
      animation: 'fadeIn 0.3s ease forwards',
    }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: sc.color, borderRadius: '3px 0 0 3px' }} />
      <div style={{ paddingLeft: '8px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#F8FAFC' }}>{alert.title}</span>
          {/* Dimension badge */}
          <span style={{ background: dc.bg, border: `1px solid ${dc.border}`, color: dc.color, borderRadius: '4px', padding: '1px 7px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {dc.icon} {dc.label}
          </span>
          {/* Severity badge */}
          <span style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, borderRadius: '4px', padding: '1px 7px', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.5px' }}>
            {sc.icon} {sc.label}
          </span>
          {/* Category */}
          <span style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', borderRadius: '4px', padding: '1px 7px', fontSize: '0.6rem', letterSpacing: '0.4px' }}>
            {CAT_LABEL[alert.category] || alert.category}
          </span>
          {/* Confidence */}
          <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: cc.color, fontWeight: 600 }}>
            ◉ {cc.label}
          </span>
        </div>
        {/* Detail */}
        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.58)', lineHeight: 1.6, margin: 0 }}>{alert.detail}</p>
        
        {/* WHY FLAGGED Evidence Card */}
        {alert.evidence_json && (
          <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderLeft: `3px solid ${sc.color}`, borderRadius: '4px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginBottom: '6px', letterSpacing: '0.5px' }}>WHY FLAGGED (EVIDENCE)</div>
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              {Object.entries(typeof alert.evidence_json === 'string' ? JSON.parse(alert.evidence_json) : alert.evidence_json).map(([k, v]) => (
                <li key={k}><strong style={{ color: 'rgba(255,255,255,0.85)' }}>{k.replace(/_/g, ' ')}:</strong> {typeof v === 'object' ? JSON.stringify(v) : v}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Affected IDs */}
        {alert.affectedIds?.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {alert.affectedIds.slice(0, 3).map(id => (
              <code key={id} style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '4px', padding: '1px 7px', fontSize: '0.66rem', color: 'rgba(255,255,255,0.38)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{id}</code>
            ))}
            {alert.affectedIds.length > 3 && <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.28)', alignSelf: 'center' }}>+{alert.affectedIds.length - 3} more</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Dimension panel ───────────────────────────────────────────────────────────
function DimPanel({ dim, alerts }) {
  const [open, setOpen] = useState(true);
  const dc = DIM_CFG[dim];
  if (!alerts.length) return (
    <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', marginBottom: '16px' }}>
      {dc.icon} No {dc.label} alerts
    </div>
  );
  return (
    <div style={{ marginBottom: '20px' }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: open ? '12px' : 0, padding: '4px 0' }}>
        <span style={{ fontSize: '1rem' }}>{dc.icon}</span>
        <span style={{ fontWeight: 700, color: dc.color, fontSize: '0.9rem' }}>{dc.label} Alerts</span>
        <span style={{ background: dc.bg, border: `1px solid ${dc.border}`, color: dc.color, borderRadius: '99px', padding: '1px 10px', fontSize: '0.72rem', fontWeight: 800 }}>{alerts.length}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>{alerts.map(a => <AlertCard key={a.id} alert={a} />)}</div>}
    </div>
  );
}

// ── Yearly trend row ──────────────────────────────────────────────────────────
function YearlyTrendTable({ stats }) {
  if (!stats || !stats.length) return <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem' }}>No historical year data found.</p>;
  const fundData   = stats.map(s => s.fundUsagePct);
  const utilData   = stats.map(s => s.utilisationPct);
  const scData     = stats.map(s => s.scPct);
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table" style={{ minWidth: '560px' }}>
        <thead>
          <tr>
            <th>Year</th><th>Works</th><th>Proposals</th><th>Fund Used %</th><th>Utilisation %</th><th>SC %</th><th>ST %</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => {
            const scOk = s.scPct >= 15, stOk = s.stPct >= 7.5;
            return (
              <tr key={s.year}>
                <td style={{ fontWeight: 700, color: '#38BDF8' }}>{s.year}</td>
                <td>{s.works}</td>
                <td>{s.proposals}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden', minWidth: '60px' }}>
                      <div style={{ height: '100%', width: `${Math.min(s.fundUsagePct, 100)}%`, background: s.fundUsagePct >= 60 ? '#10B981' : '#F59E0B', borderRadius: '99px', transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: s.fundUsagePct < 60 ? '#F59E0B' : '#10B981', fontWeight: 700 }}>{s.fundUsagePct}%</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden', minWidth: '60px' }}>
                      <div style={{ height: '100%', width: `${Math.min(s.utilisationPct, 100)}%`, background: s.utilisationPct >= 50 ? '#10B981' : '#EF4444', borderRadius: '99px', transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: s.utilisationPct < 50 ? '#EF4444' : '#10B981', fontWeight: 700 }}>{s.utilisationPct}%</span>
                  </div>
                </td>
                <td><span style={{ color: scOk ? '#10B981' : '#EF4444', fontWeight: 700, fontSize: '0.82rem' }}>{scOk ? '' : ''} {s.scPct}%</span></td>
                <td><span style={{ color: stOk ? '#10B981' : '#EF4444', fontWeight: 700, fontSize: '0.82rem' }}>{stOk ? '' : ''} {s.stPct}%</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: '32px', marginTop: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fund Usage Trend</span>
          <Sparkline data={fundData} color="#38BDF8" width={100} height={36} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Utilisation Trend</span>
          <Sparkline data={utilData} color="#10B981" width={100} height={36} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SC Earmarking</span>
          <Sparkline data={scData} color="#A78BFA" width={100} height={36} />
        </div>
      </div>
    </div>
  );
}

// ── Threshold drawer ──────────────────────────────────────────────────────────
function ThresholdDrawer({ thresholds, onChange, onClose }) {
  const [local, setLocal] = useState({ ...thresholds });
  const field = (key, label, min, max, step, isPct) => (
    <div key={key} style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <label style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
        <span style={{ fontSize: '0.82rem', color: '#38BDF8', fontWeight: 700 }}>
          {isPct ? `${Math.round(local[key] * 100)}%` : `₹${Number(local[key]).toLocaleString('en-IN')}`}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={local[key]}
        onChange={e => setLocal(l => ({ ...l, [key]: Number(e.target.value) }))}
        style={{ width: '100%', accentColor: '#4F46E5', cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
        <span>{isPct ? `${Math.round(min * 100)}%` : `₹${Number(min).toLocaleString('en-IN')}`}</span>
        <span>{isPct ? `${Math.round(max * 100)}%` : `₹${Number(max).toLocaleString('en-IN')}`}</span>
      </div>
    </div>
  );
  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '360px', background: '#0E1628', borderLeft: '1px solid rgba(255,255,255,0.08)', zIndex: 1000, overflowY: 'auto', padding: '24px', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '4px' }}>️ Custom Thresholds</div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.38)' }}>Your rules — override the defaults</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', padding: '5px 10px', cursor: 'pointer', fontSize: '0.8rem' }}> Close</button>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.7rem', color: '#818CF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}> Fund Rules</div>
        {field('minSanctionAmount',      'Min Sanction Amount',   100000,  2000000, 50000, false)}
        {field('fundBalanceWarnPct',      'Balance Warning Level', 0.10,    0.50,    0.01,  true)}
        {field('fundBalanceCriticalPct',  'Balance Critical Level',0.02,    0.20,    0.01,  true)}
        {field('expenditureGapPct',       'Expenditure Gap Alert', 0.10,    0.90,    0.05,  true)}

        <div style={{ fontSize: '0.7rem', color: '#F97316', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px', marginTop: '20px' }}>️ Time Rules</div>
        {field('stalledExecutionDays',    'Stalled Execution (days)',  7,  90,  1,   false)}
        {field('unstartedSanctionDays',   'Unstarted Sanction (days)', 14, 180, 1,  false)}

        <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px', marginTop: '20px' }}> Quality Rules</div>
        {field('lowUtilisationPct',       'Low Utilisation Floor',    0.10, 0.70, 0.05, true)}
        {field('highRejectionRatePct',    'High Rejection Rate',      0.10, 0.80, 0.05, true)}

        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 14px', marginTop: '16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
          <strong style={{ color: '#EF4444' }}>Note:</strong> SC 15% and ST 7.5% earmarking thresholds are MPLADS statutory requirements and cannot be overridden.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => { onChange(local); onClose(); }} style={{ flex: 1, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
           Apply & Re-scan
        </button>
        <button onClick={() => setLocal({ ...THRESHOLD_DEFAULTS })} style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '11px 14px', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
          Reset
        </button>
      </div>
    </div>
  );
}

// ── Forecast cards ────────────────────────────────────────────────────────────
function ForecastCards({ alerts }) {
  const future = alerts.filter(a => a.dimension === 'FUTURE');
  if (!future.length) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.28)', fontSize: '0.85rem', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '12px' }}>
       No future risks detected at current trajectory
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
      {future.map(a => {
        const sc = SEV_CFG[a.severity] || SEV_CFG.LOW;
        const cc = CONF_CFG[a.confidence] || CONF_CFG.MEDIUM;
        return (
          <div key={a.id} style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: '12px', padding: '18px', boxShadow: sc.glow }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '1.3rem' }}>{sc.icon}</span>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: sc.color, flex: 1 }}>{a.title}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>{a.detail}</p>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.62rem', color: cc.color, fontWeight: 700 }}>◉ {cc.label}</span>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)' }}>· {CAT_LABEL[a.category] || a.category}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function MonitorPage() {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [countdown,   setCountdown]   = useState(REFRESH_SEC);
  const [scanCount,   setScanCount]   = useState(0);
  const [activeTab,   setActiveTab]   = useState('PRESENT');  // PAST | PRESENT | FUTURE | ALL
  const [showDrawer,  setShowDrawer]  = useState(false);
  const [thresholds,  setThresholds]  = useState(() => {
    try { const s = localStorage.getItem('mplad_monitor_thresholds'); return s ? { ...THRESHOLD_DEFAULTS, ...JSON.parse(s) } : { ...THRESHOLD_DEFAULTS }; }
    catch { return { ...THRESHOLD_DEFAULTS }; }
  });

  // Build API URL with current thresholds
  const buildUrl = useCallback((t) => {
    const p = new URLSearchParams();
    Object.entries(t).forEach(([k, v]) => p.set(k, String(v)));
    return `/api/monitor?${p.toString()}`;
  }, []);

  const scan = useCallback(async (t) => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(buildUrl(t || thresholds), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setScanCount(c => c + 1);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setCountdown(REFRESH_SEC); }
  }, [thresholds, buildUrl]);

  // Apply new thresholds, persist, re-scan
  const applyThresholds = useCallback((t) => {
    try { localStorage.setItem('mplad_monitor_thresholds', JSON.stringify(t)); } catch {}
    setThresholds(t);
    scan(t);
  }, [scan]);

  useEffect(() => { scan(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const iv = setInterval(() => setCountdown(c => { if (c <= 1) { scan(); return REFRESH_SEC; } return c - 1; }), 1000);
    return () => clearInterval(iv);
  }, [scan]);

  const summary  = data?.summary;
  const alerts   = data?.alerts || [];
  const insights = data?.insights;
  const statusKey = loading ? 'LOADING' : (summary?.status || 'HEALTHY');
  const stCfg     = STATUS_CFG[statusKey] || STATUS_CFG.HEALTHY;

  const pastAlerts    = alerts.filter(a => a.dimension === 'PAST');
  const presentAlerts = alerts.filter(a => a.dimension === 'PRESENT');
  const futureAlerts  = alerts.filter(a => a.dimension === 'FUTURE');
  const displayAlerts = activeTab === 'ALL' ? alerts : activeTab === 'PAST' ? pastAlerts : activeTab === 'PRESENT' ? presentAlerts : futureAlerts;

  const tabs = [
    { key: 'PRESENT', label: ' Present',  count: presentAlerts.length, color: '#38BDF8' },
    { key: 'FUTURE',  label: ' Future',   count: futureAlerts.length,  color: '#10B981' },
    { key: 'PAST',    label: ' Past',     count: pastAlerts.length,    color: '#A78BFA' },
    { key: 'ALL',     label: ' All',      count: alerts.length,        color: '#94A3B8' },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.6); } }
        @keyframes status-pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
      `}</style>

      {/* Threshold drawer */}
      {showDrawer && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} onClick={() => setShowDrawer(false)} />}
      {showDrawer && <ThresholdDrawer thresholds={thresholds} onChange={applyThresholds} onClose={() => setShowDrawer(false)} />}

      <main className="main-content" style={{ paddingBottom: '60px' }}>

        {/* ── Header ── */}
        <section style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(79,70,229,0.10)', border: '1px solid rgba(79,70,229,0.25)', borderRadius: '99px', padding: '4px 14px', fontSize: '0.72rem', color: '#818CF8', fontWeight: 600, marginBottom: '12px', letterSpacing: '0.5px' }}>
                 AI Monitor · Temporal Intelligence Engine · Read-Only
              </div>
              <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1, marginBottom: '8px' }}>
                Project Intelligence{' '}
                <span style={{ background: 'linear-gradient(to right, #818CF8, #38BDF8, #10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Monitor</span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', maxWidth: '540px', lineHeight: 1.6 }}>
                Analyses <span style={{ color: '#A78BFA' }}>historical patterns</span>, <span style={{ color: '#38BDF8' }}>current state</span>, and <span style={{ color: '#10B981' }}>future projections</span> — with your custom officer-defined thresholds.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {!loading && <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>Next scan</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '-0.5px' }}>{countdown}s</div>
              </div>}
              <button onClick={() => setShowDrawer(true)} style={{ background: 'rgba(79,70,229,0.18)', border: '1px solid rgba(79,70,229,0.35)', borderRadius: '9px', color: '#818CF8', padding: '9px 16px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
                ️ Thresholds
              </button>
              <button onClick={() => scan()} disabled={loading} style={{ background: loading ? 'rgba(79,70,229,0.3)' : 'rgba(79,70,229,0.55)', border: '1px solid rgba(79,70,229,0.4)', borderRadius: '9px', color: '#fff', padding: '9px 16px', fontSize: '0.82rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '7px' }}>
                {loading ? <span style={{ display: 'inline-block', width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> : '⟳'}
                {loading ? 'Scanning…' : 'Re-scan'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Status banner ── */}
        <section style={{ marginBottom: '24px' }}>
          <div style={{ background: stCfg.bg, border: `1px solid ${stCfg.border}`, borderRadius: '12px', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', animation: stCfg.pulse ? 'status-pulse 2s ease-in-out infinite' : 'none' }}>
            <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: stCfg.color, flexShrink: 0, boxShadow: `0 0 8px ${stCfg.color}` }} />
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: stCfg.color, letterSpacing: '0.4px' }}>{stCfg.label}</span>
            {summary && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', marginLeft: 'auto' }}>
              {new Date(summary.scannedAt).toLocaleTimeString('en-IN')} · {summary.scanDurationMs}ms · Scan #{scanCount}
              {insights?.overallTrend && <> · Trend: <span style={{ color: insights.overallTrend === 'IMPROVING' ? '#10B981' : '#F97316', fontWeight: 700 }}>{insights.overallTrend}</span></>}
            </span>}
          </div>
        </section>

        {/* ── Top metrics ── */}
        <section style={{ marginBottom: '28px' }}>
          <div className="grid-4" style={{ gap: '14px' }}>
            <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px' }}>
              <HealthGauge score={loading ? 0 : (summary?.healthScore ?? 0)} />
            </div>
            {[
              { label: ' Past Alerts',    count: pastAlerts.length,    color: '#A78BFA', sub: 'Historical patterns' },
              { label: ' Present Alerts', count: presentAlerts.length, color: '#38BDF8', sub: 'Current state' },
              { label: ' Future Risks',   count: futureAlerts.length,  color: '#10B981', sub: 'Predictive forecasts' },
            ].map(({ label, count, color, sub }) => (
              <div key={label} className="stat-card">
                <div className="stat-label" style={{ fontSize: '0.72rem' }}>{label}</div>
                <div style={{ fontSize: '2.4rem', fontWeight: 800, color: count > 0 ? color : '#10B981', letterSpacing: '-1px', margin: '6px 0 2px' }}>
                  {loading ? '…' : count}
                </div>
                <div className="stat-sub">{sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Severity summary ── */}
        {!loading && summary && (
          <section style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {Object.entries(summary.counts).map(([sev, cnt]) => {
                const sc = SEV_CFG[sev];
                return cnt > 0 ? (
                  <div key={sev} style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem' }}>{sc.icon}</span>
                    <span style={{ fontWeight: 800, color: sc.color, fontSize: '1.1rem' }}>{cnt}</span>
                    <span style={{ fontSize: '0.75rem', color: sc.color, opacity: 0.8 }}>{sc.label}</span>
                  </div>
                ) : null;
              })}
              {alerts.length === 0 && <div style={{ padding: '8px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', fontSize: '0.82rem', color: '#10B981' }}> Zero alerts across all dimensions</div>}
            </div>
          </section>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}> Scan failed: {error}</div>}

        {/* ── Tabs ── */}
        <section style={{ marginBottom: '0' }}>
          <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.07)', marginBottom: '24px', overflowX: 'auto' }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                background: activeTab === t.key ? `rgba(${t.key === 'PAST' ? '167,139,250' : t.key === 'PRESENT' ? '56,189,248' : t.key === 'FUTURE' ? '16,185,129' : '148,163,184'},0.12)` : 'none',
                border: 'none', borderBottom: activeTab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
                borderRadius: '0', color: activeTab === t.key ? t.color : 'rgba(255,255,255,0.38)',
                padding: '10px 18px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '7px', transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}>
                {t.label}
                {t.count > 0 && <span style={{ background: t.color, color: '#000', borderRadius: '99px', padding: '1px 8px', fontSize: '0.68rem', fontWeight: 800 }}>{t.count}</span>}
              </button>
            ))}
          </div>

          {/* ── Tab content ── */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize: '2.5rem', animation: 'spin 1.5s linear infinite', display: 'inline-block', marginBottom: '14px' }}>⟳</div>
              <p style={{ fontSize: '0.88rem' }}>Running temporal AI scan — past, present & future…</p>
            </div>
          ) : (
            <>
              {/* ALL or per-dimension filtered feed */}
              {activeTab !== 'FUTURE' && activeTab !== 'PAST' && (
                <div>
                  {activeTab === 'ALL' ? (
                    <>
                      <DimPanel dim="FUTURE"  alerts={futureAlerts} />
                      <DimPanel dim="PRESENT" alerts={presentAlerts} />
                      <DimPanel dim="PAST"    alerts={pastAlerts} />
                    </>
                  ) : (
                    <DimPanel dim="PRESENT" alerts={presentAlerts} />
                  )}
                </div>
              )}

              {/* FUTURE tab — forecast cards */}
              {activeTab === 'FUTURE' && (
                <div>
                  <h2 className="section-title" style={{ fontSize: '0.9rem', marginBottom: '20px' }}> Predictive Forecasts</h2>
                  <ForecastCards alerts={alerts} />
                  {futureAlerts.length > 0 && (
                    <>
                      <h2 className="section-title" style={{ fontSize: '0.9rem', marginTop: '28px', marginBottom: '16px' }}>Future Risk Details</h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                        {futureAlerts.map(a => <AlertCard key={a.id} alert={a} />)}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* PAST tab — historical table + alerts */}
              {activeTab === 'PAST' && (
                <div>
                  <h2 className="section-title" style={{ fontSize: '0.9rem', marginBottom: '20px' }}> Year-by-Year Performance</h2>
                  <div className="glass-card" style={{ marginBottom: '24px', padding: '20px' }}>
                    <YearlyTrendTable stats={insights?.yearlyStats} />
                  </div>
                  <h2 className="section-title" style={{ fontSize: '0.9rem', marginBottom: '16px' }}>Historical Alerts</h2>
                  {pastAlerts.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.82rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>No historical issues found</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                      {pastAlerts.map(a => <AlertCard key={a.id} alert={a} />)}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {displayAlerts.length === 0 && activeTab === 'PRESENT' && (
                <div style={{ textAlign: 'center', padding: '50px 0', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '14px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}></div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10B981', marginBottom: '6px' }}>Current State: All Clear</div>
                  <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)' }}>No present-state anomalies detected</p>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Scope disclosure ── */}
        <section style={{ marginTop: '48px', padding: '20px 24px', background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.10)', borderRadius: '12px' }}>
          <h3 style={{ fontSize: '0.72rem', fontWeight: 700, color: '#818CF8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.6px' }}> Temporal AI Monitor — Active Checks</h3>
          <div className="grid-2" style={{ gap: '16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.38)', lineHeight: 1.7 }}>
            <div>
              <strong style={{ color: '#A78BFA' }}> Past (Historical):</strong>
              <ul style={{ paddingLeft: '14px', marginTop: '4px' }}>
                <li>Year-over-year utilisation trend</li><li>Historical rejection rate analysis</li>
                <li>Prior-year fund under-deployment</li><li>Recurring SC/ST earmarking failures</li>
              </ul>
              <strong style={{ color: '#38BDF8', marginTop: '8px', display: 'block' }}> Present (Current):</strong>
              <ul style={{ paddingLeft: '14px', marginTop: '4px' }}>
                <li>Fund balance risk (critical/warn)</li><li>SC/ST earmarking compliance</li>
                <li>Stalled IN-EXECUTION works</li><li>Duplicate active works</li>
                <li>Zero evidence on active works</li><li>Expenditure shortfall on completed works</li>
                <li>Custom minimum sanction floor check</li>
              </ul>
            </div>
            <div>
              <strong style={{ color: '#10B981' }}> Future (Predictive):</strong>
              <ul style={{ paddingLeft: '14px', marginTop: '4px' }}>
                <li>Fund exhaustion date forecast</li><li>Under-spend risk projection</li>
                <li>SC/ST 15%/7.5% trajectory forecast</li><li>Work stagnation probability scoring</li>
                <li>Sector concentration risk</li>
              </ul>
              <strong style={{ color: '#F59E0B', marginTop: '8px', display: 'block' }}>️ Custom Thresholds:</strong>
              <ul style={{ paddingLeft: '14px', marginTop: '4px' }}>
                <li>Officer-defined minimum sanction amount</li>
                <li>Custom fund balance warning/critical %</li>
                <li>Configurable stall & unstarted days</li>
                <li>Saved per device via localStorage</li>
              </ul>
            </div>
          </div>
        </section>

      </main>
    </>
  );
}
