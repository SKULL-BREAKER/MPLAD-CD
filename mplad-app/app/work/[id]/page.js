import db from '../../../lib/db';
import Link from 'next/link';

function fmt(n) {
  if (!n) return '₹0';
  return `₹${n.toLocaleString('en-IN')}`;
}

export default async function WorkDetailsPage({ params }) {
  const { id } = await params; // Next.js dynamic routing parameter

  const work = await db.work.findUnique({
    where: { id },
  });

  if (!work) {
    return (
      <main className="main-content">
        <div className="empty-state">
          <h2>Work Not Found</h2>
          <p>The work with ID {id} does not exist.</p>
          <Link href="/" className="btn btn-ghost mt-4">Go Back</Link>
        </div>
      </main>
    );
  }

  const mp = work.mp_id ? await db.mp.findUnique({ where: { id: work.mp_id } }) : null;
  const district = work.district_id ? await db.district.findUnique({ where: { id: work.district_id } }) : null;
  const agency = work.agency_id ? await db.agency.findUnique({ where: { id: work.agency_id } }) : null;
  const risk = await db.workRisk.findUnique({ where: { work_id: work.id } });
  const evidence = await db.evidenceSubmission.findMany({ where: { work_id: work.id } });
  const updates = await db.workUpdate.findMany({ where: { work_id: work.id }, orderBy: { at: 'desc' } });

  const financialProgress = work.sanctioned_amount > 0 ? Math.round(((work.expenditure || 0) / work.sanctioned_amount) * 100) : 0;
  const physicalProgress = work.physical_qty || financialProgress; // Mock physical progress if not fully accurate
  
  const statusUpper = (work.status || '').toUpperCase();
  const statusClass = statusUpper.includes('SANCTION') ? 'sanctioned' 
                    : statusUpper.includes('ONGOING') || statusUpper.includes('EXECUTION') ? 'executing'
                    : statusUpper.includes('COMPLET') ? 'completed'
                    : statusUpper.includes('UTIL') ? 'utilised'
                    : 'proposed';

  const isHighRisk = risk && risk.risk_score && risk.risk_score > 70;

  return (
    <main className="main-content" style={{ padding: '24px 40px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* ── Top Header Bar ── */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '24px' }}>
        
        {/* Basic Info */}
        <div className="glass-card" style={{ flex: '1 1 500px', padding: '24px', display: 'flex', gap: '20px' }}>
          <div style={{ width: '120px', height: '120px', borderRadius: '12px', background: '#e2e8f0', flexShrink: 0, overflow: 'hidden' }}>
            {evidence.length > 0 && evidence[0].image_path ? (
               <img src={evidence[0].image_path} alt="Project" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
               <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No Photo</div>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px', color: 'var(--accent)' }}>{work.title}</h1>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Work ID: #{work.id}</span>
              <span className={`tag ${statusClass}`}>{work.status || 'PROPOSED'}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '16px', display: 'flex', gap: '16px' }}>
              <span>📍 {district?.name || work.district_id || 'Unknown Location'}, {district?.state}</span>
              <span>🏗️ {work.category || 'Sector'}</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', fontSize: '0.75rem' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Constituency</div>
                <div style={{ fontWeight: 600 }}>{mp?.constituency || 'N/A'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Implementing Agency</div>
                <div style={{ fontWeight: 600 }}>{agency?.name || work.agency_id || 'N/A'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Sanctioned Date</div>
                <div style={{ fontWeight: 600 }}>{work.sanction_date || 'Pending'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Expected Completion</div>
                <div style={{ fontWeight: 600 }}>{work.completion_date || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Level */}
        {isHighRisk && (
          <div className="glass-card" style={{ flex: '0 1 250px', padding: '24px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
               <span style={{ fontSize: '2rem' }}>⚠️</span>
               <div>
                 <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger)' }}>Risk Level</div>
                 <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--danger)' }}>High</div>
               </div>
             </div>
             <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '6px' }}>Risk Indicators</div>
             <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
               <li style={{ marginBottom: '4px' }}>Progress lag detected</li>
               <li style={{ marginBottom: '4px' }}>Fund utilisation below average</li>
             </ul>
          </div>
        )}

        {/* Financials */}
        <div className="glass-card" style={{ flex: '1 1 300px', padding: '24px' }}>
           <div style={{ marginBottom: '16px' }}>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sanctioned Amount</div>
             <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)' }}>{fmt(work.sanctioned_amount)}</div>
           </div>
           <div>
             <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expended Amount</div>
             <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>{fmt(work.expenditure)} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400 }}>({financialProgress}%)</span></div>
           </div>
           
           <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
             <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                 <span>Physical Progress</span>
                 <span style={{ fontWeight: 600 }}>{physicalProgress}%</span>
               </div>
               <div className="util-bar-wrap" style={{ height: '6px', margin: 0 }}>
                 <div className="util-bar" style={{ width: `${physicalProgress}%`, background: 'var(--accent)' }} />
               </div>
             </div>
             <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                 <span>Financial Progress</span>
                 <span style={{ fontWeight: 600 }}>{financialProgress}%</span>
               </div>
               <div className="util-bar-wrap" style={{ height: '6px', margin: 0 }}>
                 <div className="util-bar" style={{ width: `${financialProgress}%`, background: 'var(--success)' }} />
               </div>
             </div>
           </div>
        </div>
      </div>

      {/* ── Tabs (Static for now) ── */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
        <div style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)', borderBottom: '3px solid var(--primary)' }}>Overview</div>
        <div style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>Evidence & Verification</div>
        <div style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>Documents</div>
        <div style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}>Audit Trail</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
        
        {/* ── Left Column: Details ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '24px' }}>
            <h2 className="section-title" style={{ fontSize: '1rem', marginTop: 0 }}>Project Information</h2>
            <table className="data-table">
              <tbody>
                <tr>
                  <td style={{ width: '40%', color: 'var(--text-muted)', fontWeight: 600 }}>Work Name</td>
                  <td style={{ fontWeight: 500 }}>{work.title}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Constituency</td>
                  <td>{mp?.constituency || 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>District</td>
                  <td>{district?.name || 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Implementing Agency</td>
                  <td>{agency?.name || work.agency_id || 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sector</td>
                  <td>{work.category || 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Sanctioned Amount</td>
                  <td>{fmt(work.sanctioned_amount)}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Expended Amount</td>
                  <td>{fmt(work.expenditure)}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Expected Completion</td>
                  <td>{work.completion_date || 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>GPS Location</td>
                  <td>
                    {work.lat && work.lon ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📍 {work.lat.toFixed(4)}° N, {work.lon.toFixed(4)}° E</span>
                        <a href={`https://maps.google.com/?q=${work.lat},${work.lon}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>View on Map</a>
                      </div>
                    ) : 'Not Available'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="glass-card" style={{ padding: '24px' }}>
               <h2 className="section-title" style={{ fontSize: '1rem', marginTop: 0 }}>Verification History</h2>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 {updates.slice(0, 4).map((up, i) => (
                   <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                     <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✓</div>
                     <div>
                       <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{up.field} updated</div>
                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{up.at}</div>
                     </div>
                   </div>
                 ))}
                 {updates.length === 0 && (
                   <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No verification history found.</div>
                 )}
               </div>
            </div>

            <div className="glass-card" style={{ padding: '24px' }}>
               <h2 className="section-title" style={{ fontSize: '1rem', marginTop: 0 }}>Actions</h2>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <button className="btn btn-success" style={{ width: '100%', justifyContent: 'center' }}>✓ Verify Evidence</button>
                 <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>ℹ️ Request More Info</button>
                 <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', color: 'var(--warning)', borderColor: 'var(--warning)' }}>⚠️ Mark for Investigation</button>
                 <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }}>✕ Reject Work</button>
               </div>
            </div>
          </div>

        </div>

        {/* ── Right Column: Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="section-title" style={{ fontSize: '1rem', margin: 0, border: 'none' }}>Location</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>View Larger Map</span>
            </div>
            <div style={{ width: '100%', height: '200px', background: '#e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              {work.lat && work.lon ? (
                 <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                   <div style={{ fontSize: '2rem' }}>📍</div>
                   <div style={{ fontSize: '0.75rem', fontWeight: 600, background: 'var(--text-main)', padding: '2px 6px', borderRadius: '4px', marginTop: '-8px' }}>
                     {work.lat.toFixed(4)}, {work.lon.toFixed(4)}
                   </div>
                 </div>
              ) : (
                 <span style={{ color: '#94a3b8' }}>Map Not Available</span>
              )}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="section-title" style={{ fontSize: '1rem', margin: 0, border: 'none' }}>Recent Photos</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>View All</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {evidence.slice(0, 4).map((e, i) => (
                <div key={i} style={{ width: '100%', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', background: '#e2e8f0' }}>
                  <img src={e.image_path} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
              {evidence.length === 0 && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', gridColumn: 'span 2' }}>No photos available.</div>
              )}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="section-title" style={{ fontSize: '1rem', margin: 0, border: 'none' }}>Key Documents</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>View All</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Sanction Order (PDF)', 'Work Agreement (PDF)', 'Utilisation Certificate (PDF)'].map((doc, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ color: 'var(--danger)' }}>📄</span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{doc}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>1.2 MB</div>
                    </div>
                  </div>
                  <span style={{ color: 'var(--primary)', cursor: 'pointer' }}>⬇️</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
