import { useEffect, useState } from 'react';
import { fetchApi } from '../api/client';
import { useNavigate } from 'react-router-dom';
import ValidationPanel from '../components/ValidationPanel';
import RiskMap from '../components/RiskMap';

function OverviewSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[0,1,2,3].map(i => (
          <div key={i} className="card-clay" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="skeleton" style={{ height: '12px', width: '60%' }} />
            <div className="skeleton" style={{ height: '28px', width: '80%' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div className="skeleton" style={{ height: '500px', borderRadius: 'var(--radius-card)' }} />
        <div className="skeleton" style={{ height: '500px', borderRadius: 'var(--radius-card)' }} />
      </div>
    </div>
  );
}

const TIER_BADGE_CLASS: Record<string, string> = {
  CRITICAL: 'badge badge-critical',
  HIGH:     'badge badge-high',
  MEDIUM:   'badge badge-medium',
  LOW:      'badge badge-low',
};

const TIER_LABEL: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH:     'High',
  MEDIUM:   'Review',
  LOW:      'Clear',
};

export default function Overview() {
  const [data, setData] = useState<any>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      fetchApi('/api/overview'),
      fetchApi('/api/districts')
    ])
      .then(([overviewData, districtsData]) => {
        setData(overviewData);
        setDistricts(districtsData);
      })
      .catch(() => setError("Couldn't load data. Check that the server is running and try again."));
  }, []);

  if (error) {
    return (
      <div className="panel-solid" style={{ padding: '48px', textAlign: 'center', marginTop: '24px' }}>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: '16px' }}>{error}</p>
        <button
          id="overview-retry-btn"
          onClick={() => window.location.reload()}
          className="card-clay-sm"
          style={{
            padding: '8px 20px',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return <OverviewSkeleton />;

  const totalFlagged = data.flagged.critical + data.flagged.high + data.flagged.medium;
  const sortedDistricts = [...districts].sort((a, b) => b.risk - a.risk);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>

        <div className="card-clay" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Works monitored
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {data.total_works.toLocaleString()}
          </div>
        </div>

        <div className="card-clay" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Funds tracked
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
            ₹{data.sanctioned_cr.toFixed(1)} Cr
          </div>
        </div>

        <div className="card-clay" style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Flagged for review
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {totalFlagged.toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {data.flagged.critical > 0 && <span className="badge badge-critical">Critical {data.flagged.critical}</span>}
            {data.flagged.high > 0 && <span className="badge badge-high">High {data.flagged.high}</span>}
            {data.flagged.medium > 0 && <span className="badge badge-medium">Review {data.flagged.medium}</span>}
          </div>
        </div>

        <div className="card-clay" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
            Unspent funds
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)' }}>
            ₹{data.unspent_cr.toFixed(1)} Cr
          </div>
        </div>
      </div>

      {/* Map + Top districts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>

        <div className="panel-solid" style={{ height: '500px', overflow: 'hidden' }}>
          <RiskMap districts={districts} />
        </div>

        <div className="panel-solid scrollbar-thin" style={{ height: '500px', overflowY: 'auto', padding: '20px' }}>
          <h2 style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '16px', marginTop: 0 }}>
            Top 10 risky districts
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-2)' }}>
                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 500, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>District</th>
                <th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 500, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tier</th>
                <th style={{ textAlign: 'right', padding: '6px 0', fontWeight: 500, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Works</th>
              </tr>
            </thead>
            <tbody>
              {sortedDistricts.slice(0, 10).map((d: any) => (
                <tr
                  key={d.id}
                  id={`district-row-${d.id}`}
                  className="table-row-hover"
                  style={{ borderBottom: '1px solid var(--border-1)' }}
                  onClick={() => navigate(`/district/${d.id}`)}
                >
                  <td style={{ padding: '10px 0', color: 'var(--text-secondary)' }}>{d.name}</td>
                  <td style={{ padding: '10px 0' }}>
                    <span className={TIER_BADGE_CLASS[d.tier] || 'badge badge-low'}>
                      {TIER_LABEL[d.tier] || d.tier}
                    </span>
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--text-muted)' }}>{d.works_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ValidationPanel />
    </div>
  );
}
