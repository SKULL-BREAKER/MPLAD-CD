'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function InvestigatorDashboard() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWork, setSelectedWork] = useState(null);

  useEffect(() => {
    fetch('/api/investigator')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setQueue(data.queue);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const getRiskColor = (level) => {
    if (level === 'CRITICAL') return '#EF4444';
    if (level === 'HIGH') return '#F97316';
    if (level === 'MEDIUM') return '#F59E0B';
    return '#10B981';
  };

  return (
    <main className="main-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '8px' }}> Investigator Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
          Powered by the 10-Module Fusion Brain. Priority Audit Queue sorted by composite Risk Score.
        </p>
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Analyzing thousands of records across 10 modules...</div>
      ) : (
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* LEFT: Priority Queue */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>Priority Audit Queue</h2>
            {queue.map(work => (
              <div 
                key={work.id} 
                className="glass-card" 
                style={{ 
                  cursor: 'pointer', 
                  borderLeft: `4px solid ${getRiskColor(work.aiAnalysis.level)}`,
                  background: selectedWork?.id === work.id ? 'rgba(255,255,255,0.05)' : ''
                }}
                onClick={() => setSelectedWork(work)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{work.category} ({work.id.slice(0,8)})</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Amount: ₹{work.sanctioned_amount.toLocaleString()} | Contractor: {work.agency_id || 'N/A'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: getRiskColor(work.aiAnalysis.level) }}>
                      {work.aiAnalysis.score}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RISK SCORE</div>
                  </div>
                </div>
              </div>
            ))}
            {queue.length === 0 && <div className="alert alert-info">No works found in the database to analyze.</div>}
          </div>

          {/* RIGHT: Drill-down & Evidence */}
          <div style={{ flex: 1.5 }}>
            {selectedWork ? (
              <div className="glass-card" style={{ position: 'sticky', top: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '1.4rem' }}>Work Drill-Down: {selectedWork.id}</h2>
                  <button className="btn" style={{ background: '#374151', fontSize: '0.8rem' }} onClick={() => alert('Exporting Audit PDF...')}> Export Alert (PDF)</button>
                </div>

                <div className="grid-2" style={{ gap: '16px', marginBottom: '24px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <div className="label">Composite Risk</div>
                    <div style={{ fontSize: '1.2rem', color: getRiskColor(selectedWork.aiAnalysis.level), fontWeight: 'bold' }}>
                      {selectedWork.aiAnalysis.level} ({selectedWork.aiAnalysis.score}/100)
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                    <div className="label">Current State</div>
                    <div style={{ fontSize: '1.1rem' }}>{selectedWork.status}</div>
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Module Flags</h3>
                {selectedWork.aiAnalysis.factors.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {selectedWork.aiAnalysis.factors.map((flag, idx) => (
                      <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '3px solid #EF4444', padding: '12px', borderRadius: '4px' }}>
                        <div style={{ fontWeight: 600, color: '#FCA5A5', marginBottom: '4px', fontSize: '0.9rem' }}>{flag.module} (+{flag.severity} risk)</div>
                        <div style={{ fontSize: '0.85rem' }}>{flag.detail}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="alert alert-info">No fraud modules flagged this project. It appears completely normal.</div>
                )}

                <h3 style={{ fontSize: '1.1rem', marginTop: '24px', marginBottom: '12px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Case Management</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <Link href={`/officer/${selectedWork.id}/cost`} className="btn" style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.4)', color: '#38BDF8', flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                     View Detailed Cost Analysis (V3)
                  </Link>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn" style={{ background: '#10B981', flex: 1 }} onClick={() => alert('Marked as FALSE POSITIVE. AI weights will be retrained.')}>
                     Mark False Positive
                  </button>
                  <button className="btn" style={{ background: '#EF4444', flex: 1 }} onClick={() => alert('Marked as VERIFIED FRAUD. Sending to Audit queue.')}>
                     Verify Fraud
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}></div>
                Select a project from the Priority Audit Queue to view the Fusion Brain drill-down and evidence trails.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
