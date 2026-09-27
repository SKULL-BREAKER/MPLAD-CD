const fs = require('fs');
const path = require('path');

const fraudPath = path.join(__dirname, 'app/fraud/page.js');
let code = fs.readFileSync(fraudPath, 'utf8');

const helperFunc = `
function formatEvidenceToText(moduleCode, ev) {
  if (ev?.message) return ev.message;
  if (!ev) return 'No evidence provided';

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

// Insert the helper function right above function WorkDetailPanel
code = code.replace('function WorkDetailPanel({', helperFunc + '\nfunction WorkDetailPanel({');

// Replace the evidence rendering logic inside WorkDetailPanel
const targetRender = `{f.evidence?.message ? (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                    {f.evidence.message}
                  </div>
                ) : f.evidence ? (
                  <pre style={{ margin: 0, fontSize: '0.65rem', background: 'rgba(42, 58, 49, 0.05)', padding: '8px 10px', borderRadius: 6, overflowX: 'auto', color: 'var(--text-main)', border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(f.evidence, null, 2)}
                  </pre>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No evidence provided</div>
                )}`;

const newRender = `<div style={{ fontSize: '0.75rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                  {formatEvidenceToText(f.module_code, f.evidence)}
                </div>`;

code = code.replace(targetRender, newRender);

fs.writeFileSync(fraudPath, code);
console.log('Fixed JSON rendering to Human Readable text in fraud page');
