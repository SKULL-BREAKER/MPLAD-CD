import db from '../../../lib/db';

export const dynamic = 'force-dynamic'; // Prevent caching for health check

export async function GET() {
  try {
    const start = performance.now();
    
    // Test DB connection
    await db.$queryRaw`SELECT 1`;
    const dbLatency = Math.round(performance.now() - start);

    return new Response(JSON.stringify({
      status: 'UP',
      timestamp: new Date().toISOString(),
      database: 'CONNECTED',
      latency: `${dbLatency}ms`,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('[HealthCheck] Database connection failed:', error.message);
    return new Response(JSON.stringify({
      status: 'DOWN',
      timestamp: new Date().toISOString(),
      database: 'DISCONNECTED',
      error: error.message
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
}
