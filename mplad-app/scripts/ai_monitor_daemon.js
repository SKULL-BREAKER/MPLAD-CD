const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function run() {
  console.log('[AI Monitor Daemon] Running anomaly scan...');
  try {
    const res = await fetch('http://localhost:3000/api/monitor');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const alerts = data.alerts || [];
    
    let newAlerts = 0;
    for (const a of alerts) {
      const existing = await db.alert.findUnique({ where: { id: a.id } });
      if (!existing) {
        await db.alert.create({
          data: {
            id: a.id,
            work_id: a.affectedIds?.[0] || null,
            district_id: '324424',
            severity: a.severity,
            type: a.category,
            title: a.title,
            evidence_json: JSON.stringify(a.meta || {}),
            status: 'UNRESOLVED',
            created_at: new Date().toISOString()
          }
        });
        newAlerts++;
      }
    }
    console.log(`[AI Monitor Daemon] Scan complete. Evaluated ${alerts.length} AI flags, generated ${newAlerts} new actionable alerts for Officer 324424.`);
  } catch (e) {
    console.error('[AI Monitor Daemon] Error during scan:', e.message);
  }
}

run();
setInterval(run, 30000); // 30 seconds for demo

