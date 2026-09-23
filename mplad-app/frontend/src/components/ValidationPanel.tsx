import { useEffect, useState } from 'react';
import { fetchApi } from '../api/client';

export default function ValidationPanel() {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetchApi('/api/eval/metrics').then(setMetrics).catch(console.error);
  }, []);

  if (!metrics) return null;

  return (
    <div className="panel-solid" style={{ padding: '24px', fontFamily: 'var(--font-sans)' }}>
      <h2 style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', marginBottom: '6px', marginTop: 0 }}>
        How accurate is this?
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Precision</strong> — when a work is flagged, how often the flag is correct.{' '}
        <strong style={{ color: 'var(--text-secondary)' }}>Recall</strong> — of all problems in the test data, how many are found.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {[
          { title: 'Pattern-level metrics', source: metrics.patterns },
          { title: 'Per-family metrics', source: metrics.detector_metrics },
        ].map(({ title, source }) => (
          <div key={title}>
            <h3 style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px', marginTop: 0 }}>
              {title}
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-2)' }}>
                  {['Pattern/Family', 'Precision', 'Recall', 'Support'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 0', fontWeight: 500, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(source || {}).map(([k, v]: [string, any]) => (
                  <tr key={k} style={{ borderBottom: '1px solid var(--border-1)' }}>
                    <td style={{ padding: '8px 0', color: 'var(--text-secondary)' }}>{k}</td>
                    <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>
                      {v.precision != null ? `${(v.precision * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td style={{ padding: '8px 0', color: 'var(--text-muted)' }}>
                      {v.recall != null ? `${(v.recall * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td style={{ padding: '8px 0', color: 'var(--text-dim)' }}>
                      {v.support != null ? v.support : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>
        Accuracy measured on labeled test data.
      </p>
    </div>
  );
}
