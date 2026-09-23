import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../api/client';
import { ChevronRight, X } from 'lucide-react';

const GUIDANCE: Record<string, string> = {
  D1: 'Verify both records on site — the same location should not have two identical sanctions.',
  D2: 'Compare the sanctioned rate against the state PWD schedule of rates.',
  D3: 'Inspect completion certificates and site photographs.',
  D4: 'Ask the executing agency why the work never started.',
  D5: "Review this agency's other works and its selection process.",
  D6: 'Visit the named village — confirm whether the asset exists.',
  D7: 'Re-read the sanction order against MPLADS norms.',
  D8: 'Verify if these clustered works are circumventing financial limits.',
};

const TITLES: Record<string, string> = {
  D1: 'Possible duplicate',
  D2: 'Unusual cost',
  D3: 'Completed unusually fast',
  D4: 'Stalled work',
  D5: 'Agency concentration',
  D6: 'Location mismatch',
  D7: 'Guideline concern',
  D8: 'Repeated across districts',
  YEAREND_RUSH: 'Year-end rush',
};

function formatBody(d: string, ev: any): string {
  if (d === 'D1') return `Looks nearly identical to another sanctioned work — ${(ev.similarity * 100).toFixed(0)}% title match, amounts within ${(ev.amount_delta_pct * 100).toFixed(0)}%.`;
  if (d === 'D2') return `Cost per unit is ${ev.z_score?.toFixed(1)}x higher than similar works of this type.`;
  if (d === 'D3') return `Marked complete just ${ev.days_to_completion} days after sanction, with ${(ev.expenditure_ratio * 100).toFixed(0)}% of funds spent.`;
  if (d === 'D4') return `Sanctioned ${ev.months_since_sanction || 0} months ago — no funds spent, never started.`;
  if (d === 'D5') return `One agency handles ${(ev.agency_share * 100).toFixed(0)}% of this district's MPLADS spending.`;
  if (d === 'D6') return `Record says complete — but the site is ${ev.distance_km?.toFixed(1)} km from the village named in the sanction.`;
  if (d === 'D7') return 'Title matches work types not permitted under MPLADS norms.';
  if (d === 'D8') return `The exact same work title appears in ${ev.districts_active} different districts.`;
  if (d === 'YEAREND_RUSH') return 'Sanctioned in the final days of the financial year.';
  return JSON.stringify(ev);
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '—';
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-1)', paddingBottom: '8px', marginBottom: '8px', fontSize: '13px' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-secondary)', textAlign: 'right', maxWidth: '55%', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function DuplicateModal({ workId, matchedWith, onClose }: { workId: string; matchedWith: string; onClose: () => void }) {
  const [w1, setW1] = useState<any>(null);
  const [w2, setW2] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi(`/api/works/${workId}`),
      fetchApi(`/api/works/${matchedWith}`),
    ]).then(([d1, d2]) => {
      setW1(d1.work);
      setW2(d2.work);
      setLoading(false);
    }).catch(console.error);
  }, [workId, matchedWith]);

  return (
    <div id="duplicate-modal-backdrop" style={{
      position: 'fixed', inset: 0,
      background: 'rgba(8, 12, 22, 0.80)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '16px',
      backdropFilter: 'blur(6px)',
    }}>
      <div className="panel-solid" style={{
        width: '100%', maxWidth: '860px', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', borderBottom: '1px solid var(--border-2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Compare Works</h2>
            <span className="badge badge-critical">Possible duplicate</span>
          </div>
          <button
            id="duplicate-modal-close"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal body */}
        <div className="scrollbar-thin" style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {[0, 1].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="skeleton" style={{ height: '18px', width: '85%' }} />
                  <div className="skeleton" style={{ height: '12px', width: '45%' }} />
                  <div className="skeleton" style={{ height: '12px', width: '70%' }} />
                  <div className="skeleton" style={{ height: '12px', width: '60%' }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {[w1, w2].map((w, i) => (
                <div key={i} className="card-clay-sm" style={{ padding: '16px' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', margin: '0 0 4px' }}>{w?.title}</h3>
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '14px' }}>Work #{w?.id}</p>
                  <DetailRow label="Category" value={w?.category || '—'} />
                  <DetailRow label="Sanctioned" value={`₹${((w?.sanctioned_amount || 0) / 100000).toFixed(1)} L`} />
                  <DetailRow label="Date" value={formatDate(w?.sanction_date)} />
                  <DetailRow label="Village" value={w?.village || '—'} />
                  <DetailRow label="Agency" value={w?.agency_id || '—'} />
                  <DetailRow label="Status" value={(w?.status || '').replace('_', ' ')} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-sans)' }}>
      <div className="skeleton" style={{ height: '12px', width: '220px', marginBottom: '4px' }} />
      <div className="skeleton" style={{ height: '28px', width: '70%' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[180, 120, 100].map((h, i) => (
            <div key={i} className="skeleton" style={{ height: `${h}px`, borderRadius: 'var(--radius-card)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-card)' }} />
          <div className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-card)' }} />
        </div>
      </div>
    </div>
  );
}

export default function Work() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState<string | null>(null);

  useEffect(() => {
    fetchApi(`/api/works/${id}`)
      .then(setData)
      .catch((err) => {
        if (err.message.includes('404')) {
          setError("This work doesn't exist.");
        } else {
          setError("Couldn't load this work. Check the server connection.");
        }
      });
  }, [id]);

  if (error) {
    return (
      <div className="panel-solid" style={{ padding: '48px', textAlign: 'center', marginTop: '24px', fontFamily: 'var(--font-sans)' }}>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{error}</p>
        {error.includes("exist") ? (
          <button id="work-go-home-btn" onClick={() => navigate('/')} className="card-clay-sm" style={{ padding: '8px 20px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', border: 'none' }}>
            Go to the map
          </button>
        ) : (
          <button id="work-retry-btn" onClick={() => window.location.reload()} className="card-clay-sm" style={{ padding: '8px 20px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', border: 'none' }}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!data) return <WorkSkeleton />;

  const { work, risk, flags, agency_stats } = data;

  // Timeline computation
  const d1 = work.sanction_date ? new Date(work.sanction_date).getTime() : null;
  const d2 = work.start_date ? new Date(work.start_date).getTime() : null;
  const d3 = work.completion_date ? new Date(work.completion_date).getTime() : null;

  let pStart = 0;
  let pBuild = 0;
  if (d1 && d3 && d3 > d1) {
    const totalDays = (d3 - d1) / (1000 * 3600 * 24);
    if (d2 && d2 > d1 && d2 < d3) {
      pStart = ((d2 - d1) / (1000 * 3600 * 24)) / totalDays * 100;
      pBuild = ((d3 - d2) / (1000 * 3600 * 24)) / totalDays * 100;
    } else {
      pBuild = 100;
    }
  }
  const hasTimeline = d1 && d3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'var(--font-sans)' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >Map</Link>
        <ChevronRight size={14} />
        <Link to={`/district/${work.district_id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >{work.district_id}</Link>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '11px' }}>{id}</span>
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{work.title}</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-dim)', margin: 0 }}>Work #{id}</p>
        </div>
        <button
          id="work-back-to-district"
          onClick={() => navigate(`/district/${work.district_id}`)}
          className="card-clay-sm"
          style={{ padding: '8px 16px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          Back to district
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>

        {/* LEFT — claymorphic cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Work details */}
          <div className="card-clay" style={{ padding: '20px' }}>
            <h2 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px', marginTop: 0 }}>Work Details</h2>
            <DetailRow label="Status" value={(work.status || '').replace('_', ' ')} />
            <DetailRow label="Category" value={work.category || '—'} />
            <DetailRow label="FY" value={work.fy || '—'} />
            <DetailRow label="Sanctioned" value={`₹${(work.sanctioned_amount / 100000).toFixed(1)} L`} />
            <DetailRow label="Expenditure" value={`₹${(work.expenditure / 100000).toFixed(1)} L`} />
            <DetailRow label="MP" value={work.mp_id || '—'} />
            <DetailRow label="Village" value={work.village || '—'} />
          </div>

          {/* Timeline */}
          <div className="card-clay" style={{ padding: '20px' }}>
            <h2 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px', marginTop: 0 }}>Timeline</h2>
            {hasTimeline && (
              <div style={{ marginBottom: '16px' }}>
                {/* Track */}
                <div style={{ position: 'relative', height: '8px', background: 'var(--surface-3)', borderRadius: '99px', overflow: 'hidden', border: '1px solid var(--border-1)' }}>
                  {pStart > 0 && (
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pStart}%`, background: 'var(--surface-4)' }} />
                  )}
                  <div style={{ position: 'absolute', left: `${pStart}%`, top: 0, height: '100%', width: `${pBuild}%`, background: 'var(--accent-blue)', borderRadius: '0 99px 99px 0' }} />
                </div>
                {/* Labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span>Sanction</span>
                  {d2 && <span>Start</span>}
                  <span>Completion</span>
                </div>
              </div>
            )}
            <DetailRow label="Sanctioned" value={formatDate(work.sanction_date)} />
            <DetailRow label="Started" value={formatDate(work.start_date)} />
            <DetailRow label="Completed" value={formatDate(work.completion_date)} />
          </div>

          {/* Agency */}
          <div className="card-clay" style={{ padding: '20px' }}>
            <h2 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px', marginTop: 0 }}>Executing Agency</h2>
            <DetailRow label="Agency" value={work.agency_id || '—'} />
            <DetailRow label="Works in district" value={agency_stats?.works_in_district ?? '—'} />
            <DetailRow label="Districts active" value={agency_stats?.districts_active ?? '—'} />
            <DetailRow label="District spend share" value={`${((agency_stats?.spend_share || 0) * 100).toFixed(1)}%`} />
          </div>
        </div>

        {/* RIGHT — premium solid evidence cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Why was this flagged?</h2>

          {flags && flags.length > 0 ? (
            <>
              {flags.map((f: any, i: number) => (
                <div key={i} className="panel-solid" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#fdba74', margin: 0 }}>
                      {TITLES[f.detector] || f.detector}
                    </h3>
                    {f.detector === 'D1' && f.evidence.matched_with && (
                      <button
                        id={`view-duplicate-${f.evidence.matched_with}`}
                        onClick={() => setShowDuplicateModal(f.evidence.matched_with)}
                        className="card-clay-sm"
                        style={{ padding: '5px 12px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' }}
                      >
                        View the other work
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
                    {formatBody(f.detector, f.evidence)}
                  </p>

                  <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: '12px', marginTop: '4px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      What to check next
                    </h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                      {GUIDANCE[f.detector] || 'Review all details and seek written clarification.'}
                    </p>
                  </div>
                </div>
              ))}

              {/* Risk contributions */}
              <div className="panel-solid" style={{ padding: '20px' }}>
                <h3 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '14px', marginTop: 0 }}>What adds to the risk score</h3>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {risk.contributions && risk.contributions.map((c: any, i: number) => (
                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-1)', paddingBottom: '8px', marginBottom: '8px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{TITLES[c.detector] || c.signal || c.detector}</span>
                      <span style={{ color: 'var(--text-muted)' }}>+{c.points.toFixed(1)}</span>
                    </li>
                  ))}
                  {(!risk.contributions || risk.contributions.length === 0) && (
                    <li style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '13px' }}>No score contributions listed.</li>
                  )}
                </ul>
              </div>
            </>
          ) : (
            <div style={{
              padding: '24px 20px',
              borderRadius: 'var(--radius-card)',
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.20)',
              boxShadow: 'var(--shadow-solid)',
            }}>
              <h3 style={{ fontWeight: 700, fontSize: '15px', color: '#6ee7b7', marginBottom: '8px', marginTop: 0 }}>Clear</h3>
              <p style={{ fontSize: '14px', color: 'rgba(110,231,183,0.70)', margin: 0 }}>
                No flags on this work — record, cost and timeline look normal.
              </p>
            </div>
          )}
        </div>
      </div>

      {showDuplicateModal && (
        <DuplicateModal workId={id!} matchedWith={showDuplicateModal} onClose={() => setShowDuplicateModal(null)} />
      )}
    </div>
  );
}
