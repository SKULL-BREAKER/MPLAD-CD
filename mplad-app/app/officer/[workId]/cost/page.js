'use client';
/**
 * Cost Justification Tab
 * /officer/[workId]/cost
 * =======================
 * M12 star deliverable. Full V3 audit interface:
 *  1. Verdict banner (UNJUSTIFIED PREMIUM / VERIFIED CLEAN / etc.)
 *  2. Waterfall chart (ECharts): Materials → Labor → Overhead → Expected → Sanctioned → GAP
 *  3. Itemized BoQ table with SSR source_ref on every line
 *  4. Price-index sparklines (steel / cement / labor, 48 months)
 *  5. Three-estimate comparison bar (norm vs peer vs ML vs sanctioned)
 *  6. Spec card + officer Confirm/Edit form
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return '—';
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(1)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function pct(n) {
  if (n === null || n === undefined) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

const VERDICT_META = {
  UNJUSTIFIED_PREMIUM: { label: 'Unjustified Premium',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  icon: '' },
  COST_REVIEW:         { label: 'Cost Review Required',  color: '#F97316', bg: 'rgba(249,115,22,0.12)', icon: '️' },
  NOT_FLAGGED:         { label: 'Price-Justified',       color: '#10B981', bg: 'rgba(16,185,129,0.10)', icon: '' },
  INCONCLUSIVE:        { label: 'Inconclusive',          color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', icon: '' },
  VERIFIED_CLEAN:      { label: 'Verified Clean',        color: '#10B981', bg: 'rgba(16,185,129,0.10)', icon: '' },
  INSUFFICIENT_DATA:   { label: 'Insufficient Data',     color: '#64748B', bg: 'rgba(100,116,139,0.10)',icon: 'ℹ️' },
};

const CATEGORIES = ['bridge', 'road', 'classroom', 'drinking_water', 'sanitation_block', 'community_hall', 'electrification'];

// ─────────────────────────────────────────────────────────────────────────────
// ECharts loader
// ─────────────────────────────────────────────────────────────────────────────
function useECharts(containerRef, option, deps = []) {
  useEffect(() => {
    if (!containerRef.current || !window.echarts || !option) return;
    const chart = window.echarts.init(containerRef.current, 'dark');
    chart.setOption(option);
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);
    return () => { chart.dispose(); ro.disconnect(); };
  }, deps); // eslint-disable-line
}

// ─────────────────────────────────────────────────────────────────────────────
// Waterfall chart option builder
// ─────────────────────────────────────────────────────────────────────────────
function buildWaterfall(data) {
  const { materials, labor, overhead, expected, sanctioned } = data;
  const gap     = sanctioned - expected;
  const gapIsPositive = gap > 0;

  const cats = ['Materials', 'Labor', 'Overhead', 'Expected', 'Sanctioned', gapIsPositive ? 'GAP ▲' : 'GAP ▼'];
  const invisible = [0, materials, materials + labor, materials + labor + overhead, 0, Math.min(expected, sanctioned)];
  const bars      = [materials, labor, overhead, 0, sanctioned, Math.abs(gap)];
  const colors    = ['#38BDF8', '#8B5CF6', '#F59E0B', 'transparent', '#10B981', gapIsPositive ? '#EF4444' : '#10B981'];

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', formatter: (params) => {
      const p = params.find(p => p.seriesName === 'Bar');
      if (!p) return '';
      return `${p.axisValue}: ${fmt(p.value)}`;
    }},
    xAxis: { type: 'category', data: cats, axisLabel: { color: '#94A3B8', fontSize: 11 }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94A3B8', fontSize: 10, formatter: v => v >= 100_000 ? `${(v/100_000).toFixed(0)}L` : v }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      {
        name: 'Invisible',
        type: 'bar',
        stack: 'waterfall',
        itemStyle: { color: 'transparent' },
        data: invisible,
        tooltip: { show: false },
      },
      {
        name: 'Bar',
        type: 'bar',
        stack: 'waterfall',
        data: bars.map((v, i) => ({
          value: v,
          itemStyle: { color: colors[i], borderRadius: i < 3 ? [0,0,0,0] : [4,4,0,0] },
          label: {
            show: true, position: 'top', color: colors[i] === 'transparent' ? 'transparent' : '#F8FAFC',
            fontSize: 10, formatter: () => v > 0 ? fmt(v) : '',
          },
        })),
        barWidth: '50%',
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sparkline option builder (price indices)
// ─────────────────────────────────────────────────────────────────────────────
function buildSparklines(indexData, sanctionMonth) {
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', formatter: p => `${p[0].axisValue}<br/>${p.map(s => `${s.seriesName}: ${s.value?.toFixed(3)}`).join('<br/>')}` },
    legend: { top: 4, right: 8, textStyle: { color: '#94A3B8', fontSize: 10 }, data: ['Steel', 'Cement', 'Labor'] },
    xAxis: {
      type: 'category', data: indexData.months, boundaryGap: false,
      axisLabel: { color: '#64748B', fontSize: 9, interval: 5 },
      axisLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: { type: 'value', min: 0.75, max: 1.25, axisLabel: { color: '#64748B', fontSize: 9 }, splitLine: { lineStyle: { color: '#1e293b', type: 'dashed' } } },
    series: [
      { name: 'Steel',  type: 'line', data: indexData.series.steel,  smooth: true, symbol: 'none', lineStyle: { color: '#38BDF8', width: 2 }, areaStyle: { color: 'rgba(56,189,248,0.08)' } },
      { name: 'Cement', type: 'line', data: indexData.series.cement, smooth: true, symbol: 'none', lineStyle: { color: '#F59E0B', width: 2 }, areaStyle: { color: 'rgba(245,158,11,0.06)' } },
      { name: 'Labor',  type: 'line', data: indexData.series.labor,  smooth: true, symbol: 'none', lineStyle: { color: '#10B981', width: 2 }, areaStyle: { color: 'rgba(16,185,129,0.06)' } },
    ],
    ...(sanctionMonth && indexData.months.includes(sanctionMonth) ? {
      visualMap: undefined,
      markLine: undefined,
      series: [
        { name: 'Steel',  type: 'line', data: indexData.series.steel,  smooth: true, symbol: 'none', lineStyle: { color: '#38BDF8', width: 2 }, areaStyle: { color: 'rgba(56,189,248,0.08)' }, markLine: { silent: true, lineStyle: { color: '#EF4444', type: 'dashed' }, data: [{ name: 'Sanction', xAxis: sanctionMonth }], label: { color: '#EF4444', fontSize: 9 } } },
        { name: 'Cement', type: 'line', data: indexData.series.cement, smooth: true, symbol: 'none', lineStyle: { color: '#F59E0B', width: 2 }, areaStyle: { color: 'rgba(245,158,11,0.06)' } },
        { name: 'Labor',  type: 'line', data: indexData.series.labor,  smooth: true, symbol: 'none', lineStyle: { color: '#10B981', width: 2 }, areaStyle: { color: 'rgba(16,185,129,0.06)' } },
      ],
    } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Comparison bar chart (norm vs peer vs ML vs sanctioned)
// ─────────────────────────────────────────────────────────────────────────────
function buildComparisonBar(estimates, sanctioned) {
  const items = [
    { name: 'Norm\n(C3)',    value: estimates.norm?.expected_cost, color: '#38BDF8' },
    { name: 'Peer\nMedian', value: estimates.peer?.median,         color: '#8B5CF6' },
    { name: 'ML\n(C4)',     value: estimates.ml?.prediction,       color: '#F59E0B' },
    { name: 'Sanctioned',   value: sanctioned,                     color: '#EF4444' },
  ].filter(i => i.value != null);

  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: p => `${p.name}: ${fmt(p.value)}` },
    xAxis: { type: 'category', data: items.map(i => i.name), axisLabel: { color: '#94A3B8', fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { color: '#94A3B8', fontSize: 9, formatter: v => v >= 100_000 ? `${(v/100_000).toFixed(0)}L` : v }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{
      type: 'bar', barWidth: '45%',
      data: items.map(i => ({
        value: i.value,
        itemStyle: { color: i.color, borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', color: '#F8FAFC', fontSize: 10, formatter: () => fmt(i.value) },
      })),
    }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────────────────────────────────────
export default function CostJustificationPage({ params }) {
  const workId = params.workId;

  const [data, setData]         = useState(null);
  const [indexData, setIndexData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [activeTab, setActiveTab] = useState('waterfall');
  const [showSpecForm, setShowSpecForm] = useState(false);
  const [specForm, setSpecForm]         = useState({ category: '', spec: {} });
  const [specSubmitting, setSpecSubmitting] = useState(false);
  const [specMsg, setSpecMsg]           = useState(null);

  const waterfallRef  = useRef(null);
  const sparklineRef  = useRef(null);
  const compBarRef    = useRef(null);

  // Load ECharts script
  useEffect(() => {
    if (window.echarts) return;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
    s.onload = () => setData(d => d ? { ...d, _echartsReady: true } : d);
    document.head.appendChild(s);
  }, []);

  // Fetch cost estimate
  useEffect(() => {
    if (!workId) return;
    Promise.all([
      fetch(`/api/works/${workId}/cost-estimate`).then(r => r.json()),
      fetch('/api/norms/indices').then(r => r.json()),
    ])
      .then(([costData, idxData]) => {
        if (costData.success) setData(costData);
        else setError(costData.error);
        if (idxData.success) setIndexData(idxData);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [workId]);

  // Waterfall chart
  const waterfallOption = data?.estimates && data?.sanctioned_amount ? buildWaterfall({
    materials: data.estimates.norm?.materials_cost || 0,
    labor:     data.estimates.norm?.labor_cost || 0,
    overhead:  (data.estimates.norm?.contingency || 0) + (data.estimates.norm?.overhead || 0),
    expected:  data.estimates.norm?.expected_cost || 0,
    sanctioned: data.sanctioned_amount,
  }) : null;

  useECharts(waterfallRef, waterfallOption, [data]);
  useECharts(sparklineRef, indexData ? buildSparklines(indexData, null) : null, [indexData]);
  useECharts(compBarRef, data ? buildComparisonBar(data.estimates, data.sanctioned_amount) : null, [data]);

  // Spec confirm/edit handler
  const handleSpecSubmit = async (e) => {
    e.preventDefault();
    setSpecSubmitting(true);
    try {
      const res = await fetch(`/api/works/${workId}/spec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: specForm.category, spec: specForm.specVars }),
      });
      const json = await res.json();
      if (json.success) {
        setSpecMsg({ type: 'success', text: 'Spec confirmed! Reload to recompute estimate.' });
        setShowSpecForm(false);
        // Reload estimates
        const newData = await fetch(`/api/works/${workId}/cost-estimate`).then(r => r.json());
        if (newData.success) setData(newData);
      } else {
        setSpecMsg({ type: 'error', text: json.error });
      }
    } catch (e) {
      setSpecMsg({ type: 'error', text: e.message });
    }
    setSpecSubmitting(false);
  };

  if (loading) {
    return (
      <main className="main-content" style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>️</div>
          <div>Computing deterministic cost estimate (C1→C2→C3)…</div>
          <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 8 }}>Loading price indices + BoQ synthesis</div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="main-content" style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
        <div className="alert alert-danger">Error: {error}</div>
        <Link href="/investigator" style={{ color: 'var(--accent)' }}>← Back to Investigator</Link>
      </main>
    );
  }

  const verdict     = data?.verdict;
  const vm          = VERDICT_META[verdict?.verdict] || VERDICT_META.INSUFFICIENT_DATA;
  const evidenceCard = data?.evidence_card;
  const spec         = data?.spec;
  const boqItems     = data?.boq || [];

  return (
    <main className="main-content" style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/investigator" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          ← Back to Investigator Queue
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
              Cost Justification Analysis · V3
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800 }}>Work ID: {workId?.slice(0, 12)}…</h1>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <a
              href={`/api/works/${workId}/cost-estimate`}
              target="_blank"
              style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '8px 16px', color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 600 }}
            >
               Raw JSON
            </a>
          </div>
        </div>
      </div>

      {/* Verdict Banner */}
      {verdict && (
        <div style={{ background: vm.bg, border: `1px solid ${vm.color}33`, borderRadius: 12, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ fontSize: '2rem', flexShrink: 0 }}>{vm.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: vm.color }}>{vm.label}</span>
              {verdict.gap_norm !== null && (
                <span style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 99, padding: '2px 10px', fontSize: '0.78rem', color: '#CBD5E1', fontWeight: 600 }}>
                  Gap: {pct(verdict.gap_norm)}
                </span>
              )}
              {verdict.peer_n > 0 && (
                <span style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 99, padding: '2px 10px', fontSize: '0.78rem', color: '#94A3B8' }}>
                  n={verdict.peer_n} peers
                </span>
              )}
              <span style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 99, padding: '2px 10px', fontSize: '0.75rem', color: '#64748B' }}>
                V3 DETERMINISTIC
              </span>
            </div>
            <p style={{ color: '#CBD5E1', fontSize: '0.88rem', lineHeight: 1.5 }}>{verdict.explanation}</p>
          </div>
        </div>
      )}

      {/* Evidence Card */}
      {evidenceCard && (
        <div className="glass-card" style={{ marginBottom: 24, borderLeft: `4px solid ${vm.color}` }}>
          <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Evidence Card · {evidenceCard.type}
          </div>
          <p style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.95rem', marginBottom: 6 }}>{evidenceCard.headline}</p>
          <p style={{ color: '#94A3B8', fontSize: '0.87rem', lineHeight: 1.6 }}>{evidenceCard.body}</p>
          {evidenceCard.action && (
            <button className="btn" style={{ marginTop: 12, fontSize: '0.82rem', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }}>
              {evidenceCard.action}
            </button>
          )}
        </div>
      )}

      {/* Spec Card */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}> Work Specification</h3>
          <button
            className="btn"
            style={{ fontSize: '0.78rem', background: 'rgba(79,70,229,0.2)', border: '1px solid rgba(79,70,229,0.4)' }}
            onClick={() => { setShowSpecForm(!showSpecForm); setSpecForm({ category: spec?.category || '', specVars: spec?.specJson || {} }); }}
          >
            {showSpecForm ? ' Cancel' : '️ Confirm / Edit'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 8 }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>CATEGORY</div>
            <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{spec?.category || '—'}</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>SOURCE</div>
            <div style={{ fontWeight: 700, color: spec?.source === 'officer_confirmed' ? '#10B981' : spec?.source === 'provided' ? '#38BDF8' : '#F59E0B' }}>
              {spec?.source || '—'}
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>CONFIDENCE</div>
            <div style={{ fontWeight: 700 }}>{spec?.confidence != null ? `${(spec.confidence * 100).toFixed(0)}%` : '—'}</div>
          </div>
          {spec?.specJson && Object.entries(spec.specJson).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
            <div key={k} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{k.toUpperCase()}</div>
              <div style={{ fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
        {spec?.source === 'inferred' && (
          <div style={{ fontSize: '0.8rem', color: '#F59E0B', marginTop: 4 }}>
            ️ Spec was inferred from work title. Officer confirmation overrides inference and improves estimate accuracy.
          </div>
        )}

        {/* Spec edit form */}
        {showSpecForm && (
          <form onSubmit={handleSpecSubmit} style={{ marginTop: 16, background: 'rgba(79,70,229,0.08)', borderRadius: 8, padding: 16, border: '1px solid rgba(79,70,229,0.2)' }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
              <select
                value={specForm.category}
                onChange={e => setSpecForm(f => ({ ...f, category: e.target.value }))}
                style={{ background: '#111827', color: '#F8FAFC', border: '1px solid #334155', borderRadius: 6, padding: '6px 10px', width: '100%', fontSize: '0.88rem' }}
              >
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Spec Variables (JSON — e.g. <code style={{ color: '#38BDF8' }}>{'{'}span_m: 15, width_m: 4.5{'}'}</code>)
              </label>
              <textarea
                rows={3}
                defaultValue={JSON.stringify(spec?.specJson || {}, null, 2).replace(/^{/, '').replace(/}$/, '').trim()}
                onChange={e => {
                  try {
                    const parsed = JSON.parse(`{${e.target.value}}`);
                    setSpecForm(f => ({ ...f, specVars: parsed }));
                  } catch {}
                }}
                style={{ background: '#111827', color: '#38BDF8', border: '1px solid #334155', borderRadius: 6, padding: '8px 12px', width: '100%', fontSize: '0.82rem', fontFamily: 'monospace' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn" disabled={specSubmitting} style={{ background: '#10B981' }}>
                {specSubmitting ? 'Saving…' : ' Confirm Spec'}
              </button>
              <button type="button" className="btn" onClick={() => setShowSpecForm(false)} style={{ background: '#374151' }}>
                Cancel
              </button>
            </div>
            {specMsg && (
              <div style={{ marginTop: 10, color: specMsg.type === 'success' ? '#10B981' : '#EF4444', fontSize: '0.85rem' }}>
                {specMsg.text}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Summary numbers row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Sanctioned',    value: fmt(data?.sanctioned_amount), color: '#EF4444' },
          { label: 'Norm Expected', value: fmt(data?.estimates?.norm?.expected_cost), color: '#38BDF8' },
          { label: 'Peer Median',   value: fmt(data?.estimates?.peer?.median), color: '#8B5CF6' },
          { label: 'ML Prediction', value: data?.estimates?.ml?.available ? fmt(data?.estimates?.ml?.prediction) : 'Not available', color: '#F59E0B' },
          { label: 'Unexplained Gap', value: data?.verdict?.gap_norm != null ? pct(data.verdict.gap_norm) : '—', color: verdict?.verdict === 'VERIFIED_CLEAN' || verdict?.verdict === 'NOT_FLAGGED' ? '#10B981' : '#EF4444' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: '1.25rem' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #1e293b', paddingBottom: 0 }}>
        {[
          { id: 'waterfall', label: ' Cost Waterfall' },
          { id: 'boq',       label: ' Itemized BoQ' },
          { id: 'sparklines', label: ' Price Indices' },
          { id: 'comparison', label: '️ Three Estimates' },
          { id: 'memo',      label: ' Official Memo' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? 'rgba(56,189,248,0.1)' : 'transparent',
              border: 'none', borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
              padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="glass-card" style={{ minHeight: 320 }}>

        {/* 1. Waterfall */}
        {activeTab === 'waterfall' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Cost Waterfall (Deterministic Estimate vs Sanctioned)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Each bar shows a cost component. The red GAP bar = unexplained premium.
                All values from CPWD DSR 2021 rates + WPI index adjustment.
              </p>
            </div>
            {data?.estimates?.norm?.expected_cost ? (
              <div ref={waterfallRef} style={{ height: 300, width: '100%' }} />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {data?.estimates?.norm?.error
                  ? `️ ${data.estimates.norm.error}`
                  : 'Norm estimate not available — confirm spec above first.'}
              </div>
            )}
          </div>
        )}

        {/* 2. BoQ Table */}
        {activeTab === 'boq' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Itemized Bill of Quantities</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Every line cites its SSR source. Steel/cement/labor index factors are shown transparently.
                <span style={{ color: '#F59E0B', marginLeft: 8 }}>️ BoQ ratios require civil-background verification before finale.</span>
              </p>
            </div>
            {boqItems.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.3)', color: '#94A3B8', textAlign: 'left' }}>
                      {['Code', 'Description', 'Qty', 'Unit', 'Base Rate', ' Steel ×', ' Cement ×', ' Labor ×', 'Blended Idx', 'Terrain ×', 'Adj. Rate', 'Line Total', 'Source Ref'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {boqItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #0f172a', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                      >
                        <td style={{ padding: '7px 10px', color: '#38BDF8', fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{item.item_code}</td>
                        <td style={{ padding: '7px 10px', maxWidth: 180 }}>{item.description}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{item.qty?.toFixed(2)}</td>
                        <td style={{ padding: '7px 10px', color: '#64748B' }}>{item.unit}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>₹{item.base_rate?.toLocaleString('en-IN')}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#38BDF8' }}>{item.steel_factor?.toFixed(3)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#F59E0B' }}>{item.cement_factor?.toFixed(3)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#10B981' }}>{item.labor_factor?.toFixed(3)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#CBD5E1' }}>{item.blended_index?.toFixed(4)}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#94A3B8' }}>{item.terrain_mult?.toFixed(2)}×</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>₹{Math.round(item.adj_rate || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#F8FAFC' }}>{fmt(item.line_total)}</td>
                        <td style={{ padding: '7px 10px', fontSize: '0.72rem', color: '#64748B', maxWidth: 200 }}>
                          <span style={{ background: 'rgba(100,116,139,0.15)', borderRadius: 4, padding: '2px 6px' }}>{item.source_ref}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'rgba(56,189,248,0.06)', fontWeight: 700 }}>
                      <td colSpan={11} style={{ padding: '10px', textAlign: 'right', color: '#94A3B8' }}>Direct cost subtotal</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#38BDF8', fontFamily: 'monospace' }}>{fmt(data?.estimates?.norm?.direct_cost)}</td>
                      <td />
                    </tr>
                    <tr style={{ background: 'rgba(245,158,11,0.05)' }}>
                      <td colSpan={11} style={{ padding: '8px 10px', textAlign: 'right', color: '#94A3B8', fontSize: '0.82rem' }}>+ Contingency ({Math.round((data?.config?.contingency_pct || 0.03) * 100)}%)</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#F59E0B', fontFamily: 'monospace' }}>{fmt(data?.estimates?.norm?.contingency)}</td>
                      <td />
                    </tr>
                    <tr style={{ background: 'rgba(245,158,11,0.05)' }}>
                      <td colSpan={11} style={{ padding: '8px 10px', textAlign: 'right', color: '#94A3B8', fontSize: '0.82rem' }}>+ Overhead ({Math.round((data?.config?.overhead_pct || 0.05) * 100)}%)</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#F59E0B', fontFamily: 'monospace' }}>{fmt(data?.estimates?.norm?.overhead)}</td>
                      <td />
                    </tr>
                    <tr style={{ background: 'rgba(56,189,248,0.08)', fontWeight: 800 }}>
                      <td colSpan={11} style={{ padding: '12px 10px', textAlign: 'right', color: '#38BDF8', fontSize: '0.95rem' }}>NORM EXPECTED TOTAL</td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', color: '#38BDF8', fontFamily: 'monospace', fontSize: '1rem' }}>{fmt(data?.estimates?.norm?.expected_cost)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No BoQ items — confirm spec above to generate estimate.</div>
            )}
          </div>
        )}

        {/* 3. Sparklines */}
        {activeTab === 'sparklines' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Price Index Series (Jan 2020 – Dec 2023)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                WPI Steel & Cement (Min. of Commerce & Industry) + State Min. Wage notifications for Labor.
                All normalized to 1.0 at Jun 2021. Red dashed line = sanction month.
              </p>
            </div>
            {indexData ? (
              <div ref={sparklineRef} style={{ height: 280, width: '100%' }} />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading price index data…</div>
            )}
            {/* Index stats */}
            {indexData && (() => {
              const last = indexData.raw[indexData.raw.length - 1];
              const base = indexData.raw.find(r => r.month === '2021-06') || indexData.raw[0];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
                  {[
                    { name: 'Steel', val: last?.steel_idx, base: base?.steel_idx, color: '#38BDF8' },
                    { name: 'Cement', val: last?.cement_idx, base: base?.cement_idx, color: '#F59E0B' },
                    { name: 'Labor', val: last?.labor_idx, base: base?.labor_idx, color: '#10B981' },
                  ].map(s => (
                    <div key={s.name} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${s.color}` }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{s.name.toUpperCase()} INDEX</div>
                      <div style={{ fontWeight: 800, color: s.color }}>{s.val?.toFixed(3)}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {s.base ? `${(((s.val - s.base) / s.base) * 100).toFixed(1)}% vs base` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* 4. Three-estimate comparison */}
        {activeTab === 'comparison' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Three-Estimate Triangulation</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                C3 (norm), peer median, C4 (ML) vs sanctioned. All three must point to inflation for UNJUSTIFIED PREMIUM.
                ML alone NEVER triggers a flag (V3 principle).
              </p>
            </div>
            <div ref={compBarRef} style={{ height: 260, width: '100%' }} />

            {/* Estimate detail cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
              {[
                { label: 'C3 Norm (Deterministic)', value: data?.estimates?.norm?.expected_cost, color: '#38BDF8', note: 'SSR/DSR rates + WPI adjustment. PRIMARY estimator.' },
                { label: 'Peer Median (n peers)', value: data?.estimates?.peer?.median, color: '#8B5CF6',
                  note: `${data?.estimates?.peer?.n || 0} comparable works, same type ±1yr. z=${data?.estimates?.peer?.z_score ?? '—'}` },
                { label: 'C4 ML (Corroborator)', value: data?.estimates?.ml?.prediction, color: '#F59E0B',
                  note: data?.estimates?.ml?.available ? `MAPE: ${data.estimates.ml.mape ? (data.estimates.ml.mape * 100).toFixed(1) + '%' : 'N/A'} · ${data.estimates.ml.note}` : 'Model not loaded. Run mplad_ai/train2.js' },
                { label: 'Sanctioned Amount', value: data?.sanctioned_amount, color: '#EF4444', note: 'Actual amount sanctioned per record.' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontWeight: 800, color: s.color, fontSize: '1.1rem', marginBottom: 4 }}>{s.value != null ? fmt(s.value) : '—'}</div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.4 }}>{s.note}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 5. Bilingual Memo */}
        {activeTab === 'memo' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Bilingual Official Memo</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Auto-generated official memo for dossier inclusion.</p>
              </div>
              <button className="btn" onClick={() => window.print()} style={{ background: 'rgba(56,189,248,0.2)', color: '#38BDF8', border: '1px solid #38BDF8' }}>️ Print Memo</button>
            </div>
            <div className="memo-print-area" style={{ background: '#fff', color: '#000', padding: '40px', borderRadius: '4px', fontFamily: 'serif' }}>
              <style>{`
                @media print {
                  body * { visibility: hidden; }
                  .memo-print-area, .memo-print-area * { visibility: visible; }
                  .memo-print-area { position: absolute; left: 0; top: 0; width: 100%; }
                }
              `}</style>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 16, marginBottom: 24 }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 'bold' }}>GOVERNMENT OF INDIA / भारत सरकार</h2>
                <h3 style={{ margin: '0', fontSize: '1.2rem' }}>MPLADS COST JUSTIFICATION MEMO / लागत औचित्य ज्ञापन</h3>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', fontSize: '1rem' }}>
                <div>
                  <p><strong>Work ID:</strong> {workId}</p>
                  <p><strong>Category:</strong> {spec?.category || 'N/A'}</p>
                  <p><strong>Verdict:</strong> {verdict?.verdict || 'PENDING'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p><strong>Date / दिनांक:</strong> {new Date().toLocaleDateString('en-IN')}</p>
                  <p><strong>Sanctioned:</strong> {fmt(data?.sanctioned_amount)}</p>
                  <p><strong>Norm Expected:</strong> {fmt(data?.estimates?.norm?.expected_cost)}</p>
                </div>
              </div>

              <div style={{ marginBottom: '24px', lineHeight: '1.6', fontSize: '1rem' }}>
                <p><strong>Subject / विषय:</strong> Automated Cost Justification Review for {workId}</p>
                <p style={{ marginTop: '12px' }}>
                  This memo certifies that the cost estimate for the aforementioned work has been evaluated using the PRAHARI V3 Deterministic Engine. 
                  The sanctioned amount of <strong>{fmt(data?.sanctioned_amount)}</strong> was compared against the norm-based expected cost of <strong>{fmt(data?.estimates?.norm?.expected_cost)}</strong>.
                </p>
                <p style={{ marginTop: '12px', fontStyle: 'italic', color: '#333' }}>
                  यह ज्ञापन प्रमाणित करता है कि उपरोक्त कार्य के लिए लागत अनुमान का मूल्यांकन प्रहरी V3 नियतात्मक इंजन का उपयोग करके किया गया है।
                  स्वीकृत राशि <strong>{fmt(data?.sanctioned_amount)}</strong> की तुलना मानदंड-आधारित अपेक्षित लागत <strong>{fmt(data?.estimates?.norm?.expected_cost)}</strong> से की गई थी।
                </p>
              </div>

              <div style={{ border: '1px solid #000', padding: '16px', marginBottom: '32px' }}>
                <h4 style={{ margin: '0 0 12px 0' }}>EVIDENCE / साक्ष्य</h4>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>{evidenceCard?.body || 'No detailed evidence generated.'}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '200px', borderBottom: '1px solid #000', marginBottom: '8px' }}></div>
                  <div>System Generated</div>
                  <div style={{ fontSize: '0.85rem' }}>प्रणाली जनित</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '200px', borderBottom: '1px solid #000', marginBottom: '8px' }}></div>
                  <div>Authorised Officer</div>
                  <div style={{ fontSize: '0.85rem' }}>प्राधिकृत अधिकारी</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Footer note */}
      <div style={{ marginTop: 20, fontSize: '0.75rem', color: '#334155', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <span> Source: CPWD DSR 2021 + WPI series (MoCI) + State Wage Notifications</span>
        <span> V3 Deterministic — no flag raised by ML alone</span>
        <span>️ BoQ ratios require civil-background teammate verification before production</span>
      </div>
    </main>
  );
}
