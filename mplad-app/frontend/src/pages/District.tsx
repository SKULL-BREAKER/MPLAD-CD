import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../api/client';
import { ChevronRight, Search } from 'lucide-react';

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

const DETECTOR_LABEL: Record<string, string> = {
  D1: 'Duplicate',
  D2: 'Unusual cost',
  D3: 'Stalled / Flash',
  D4: 'Poor utilization',
  D5: 'Agency monopoly',
  D6: 'Location mismatch',
  D7: 'Guideline concern',
  D8: 'Cross-district match',
};

function DistrictSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div className="skeleton" style={{ height: '12px', width: '40px' }} />
        <div className="skeleton" style={{ height: '12px', width: '8px' }} />
        <div className="skeleton" style={{ height: '12px', width: '120px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[0,1,2,3].map(i => (
          <div key={i} className="card-clay" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="skeleton" style={{ height: '11px', width: '55%' }} />
            <div className="skeleton" style={{ height: '26px', width: '75%' }} />
          </div>
        ))}
      </div>
      <div className="panel-solid skeleton" style={{ height: '400px' }} />
    </div>
  );
}

export default function District() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [works, setWorks] = useState<any[]>([]);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    fetchApi(`/api/districts/${id}`)
      .then(setData)
      .catch(() => setError("Couldn't load district. Check the server connection."));
  }, [id]);

  useEffect(() => {
    let url = `/api/districts/${id}/works?`;
    if (tierFilter) url += `tier=${encodeURIComponent(tierFilter)}&`;
    if (categoryFilter) url += `category=${encodeURIComponent(categoryFilter)}&`;
    if (debouncedSearch) url += `q=${encodeURIComponent(debouncedSearch)}&`;
    fetchApi(url)
      .then(setWorks)
      .catch(console.error);
  }, [id, tierFilter, categoryFilter, debouncedSearch]);

  if (error) {
    return (
      <div className="panel-solid" style={{ padding: '48px', textAlign: 'center', marginTop: '24px' }}>
        <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)', marginBottom: '16px' }}>{error}</p>
        <button
          id="district-retry-btn"
          onClick={() => window.location.reload()}
          className="card-clay-sm"
          style={{ padding: '8px 20px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', border: 'none' }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return <DistrictSkeleton />;

  // Client-side status filter (status not in backend filter)
  const filteredWorks = statusFilter
    ? works.filter(w => w.status.toLowerCase() === statusFilter.toLowerCase())
    : works;

  const hasActiveFilter = search || tierFilter || categoryFilter || statusFilter;

  const clearFilters = () => {
    setSearch('');
    setTierFilter('');
    setCategoryFilter('');
    setStatusFilter('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-sans)' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          Map
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.name}</span>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { label: 'Entitlement', value: `₹${(data.entitlement / 10000000).toFixed(2)} Cr` },
          { label: 'Spent', value: `₹${(data.spent / 10000000).toFixed(2)} Cr` },
          { label: 'Unspent', value: `₹${(data.unspent / 10000000).toFixed(2)} Cr` },
          { label: 'Works', value: data.works_count.toLocaleString() },
        ].map((item, i) => (
          <div key={i} className="card-clay" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
              {item.label}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Warning banners — flag names as stored in district_flags table */}
      {data.flags && data.flags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(data.flags.includes('hhi') || data.flags.includes('HHI_MONOPOLY')) && (
            <div className="warning-banner warning-banner-orange">
              One agency dominates spending here
            </div>
          )}
          {(data.flags.includes('yearend_rush') || data.flags.includes('YEAREND_RUSH')) && (
            <div className="warning-banner warning-banner-amber">
              Unusually high year-end sanctioning
            </div>
          )}
          {data.flags.includes('benford_chi2') && (
            <div className="warning-banner warning-banner-amber">
              Payment amount distribution is statistically irregular
            </div>
          )}
          {data.flags.includes('utilization') && (
            <div className="warning-banner warning-banner-orange">
              Fund utilization is significantly below expected level
            </div>
          )}
        </div>
      )}

      {/* Works table panel */}
      <div className="panel-solid" style={{ padding: '24px' }}>

        {/* Filters header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', margin: 0 }}>Works</h2>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={14} />
              <input
                id="district-search-input"
                type="text"
                placeholder="Search works..."
                className="input-base"
                style={{ paddingLeft: '30px', width: '180px' }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Risk level */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Risk level</span>
              <select id="district-tier-filter" className="input-base" value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={{ cursor: 'pointer' }}>
                <option value="">All</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Review</option>
                <option value="LOW">Clear</option>
              </select>
            </div>

            {/* Work type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Work type</span>
              <select id="district-category-filter" className="input-base" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ cursor: 'pointer' }}>
                <option value="">All</option>
                <option value="ROAD">Road</option>
                <option value="WATER">Water</option>
                <option value="EDUCATION">Education</option>
                <option value="HEALTH">Health</option>
                <option value="BRIDGE">Bridge</option>
                <option value="COMMUNITY_HALL">Community Hall</option>
                <option value="SANITATION">Sanitation</option>
                <option value="ELECTRICITY">Electricity</option>
              </select>
            </div>

            {/* Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</span>
              <select id="district-status-filter" className="input-base" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ cursor: 'pointer' }}>
                <option value="">All</option>
                <option value="sanctioned">Sanctioned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {hasActiveFilter && (
              <button
                id="district-clear-filters-btn"
                onClick={clearFilters}
                style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', paddingBottom: '2px', alignSelf: 'flex-end' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Table or empty state */}
        {filteredWorks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 16px',
            border: '1px dashed var(--border-2)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
          }}>
            No works match these filters.
            {hasActiveFilter && (
              <button
                id="district-empty-clear-btn"
                onClick={clearFilters}
                className="card-clay-sm"
                style={{ display: 'block', margin: '16px auto 0', padding: '8px 20px', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', border: 'none' }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-2)' }}>
                  {['Work', 'Amount', 'Status', 'Risk', 'Why flagged'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 500, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredWorks.map((w: any) => (
                  <tr
                    key={w.id}
                    id={`work-row-${w.id}`}
                    className="table-row-hover"
                    style={{ borderBottom: '1px solid var(--border-1)' }}
                    onClick={() => navigate(`/work/${w.id}`)}
                  >
                    <td style={{ padding: '10px 6px', maxWidth: '280px' }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={w.title}>{w.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{w.id}</div>
                    </td>
                    <td style={{ padding: '10px 6px', color: 'var(--text-secondary)' }}>
                      ₹{(w.sanctioned_amount / 100000).toFixed(1)} L
                    </td>
                    <td style={{ padding: '10px 6px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {w.status.replace('_', ' ')}
                    </td>
                    <td style={{ padding: '10px 6px' }}>
                      <span className={TIER_BADGE_CLASS[w.tier] || 'badge badge-low'}>
                        {TIER_LABEL[w.tier] || w.tier}
                      </span>
                    </td>
                    <td style={{ padding: '10px 6px' }}>
                      {w.tier !== 'LOW' && w.top_evidence ? (
                        <span className="panel-solid-inner" style={{ display: 'inline-block', padding: '2px 8px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {DETECTOR_LABEL[w.top_evidence] || w.top_evidence}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
