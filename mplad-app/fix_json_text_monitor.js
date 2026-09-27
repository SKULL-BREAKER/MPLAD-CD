const fs = require('fs');
const path = require('path');

const monitorPath = path.join(__dirname, 'app/monitor/page.js');
let code = fs.readFileSync(monitorPath, 'utf8');

const helperFunc = `
function formatEvidenceToText(moduleCode, evRaw) {
  const ev = typeof evRaw === 'string' ? JSON.parse(evRaw) : evRaw;
  if (!ev) return 'No evidence provided';
  if (ev.message) return ev.message;

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
`;

code = code.replace('function AlertCard({', helperFunc + '\nfunction AlertCard({');

const targetRender = `<ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
              {Object.entries(typeof alert.evidence_json === 'string' ? JSON.parse(alert.evidence_json) : alert.evidence_json).map(([k, v]) => (
                <li key={k}><strong style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}:</strong> {typeof v === 'object' ? JSON.stringify(v) : v}</li>
              ))}
            </ul>`;

const newRender = `<div style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
              {formatEvidenceToText(alert.category, alert.evidence_json)}
            </div>`;

code = code.replace(targetRender, newRender);

fs.writeFileSync(monitorPath, code);
console.log('Fixed JSON rendering to Human Readable text in monitor page');
