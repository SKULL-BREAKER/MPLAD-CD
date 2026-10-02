import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export const dynamic = 'force-dynamic';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';

async function callOllama(systemPrompt, userMessage) {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.message?.content || 'No response from model.';
}

export async function POST(request) {
  try {
    const { message, role } = await request.json();
    const msg = message.toLowerCase();

    // Role gate: public users cannot query internal alerts
    if (
      role === 'public' &&
      (msg.includes('anomaly') || msg.includes('fraud') || msg.includes('alert'))
    ) {
      return NextResponse.json({
        reply:
          '(LUDO AI): I am sorry, but as a public user I cannot provide details on internal alerts or anomalies. For security, alerts are restricted to designated officers.',
      });
    }

    // SQL shortcuts for structured queries
    if (msg.includes('top') || msg.includes('show') || msg.includes('how many')) {
      let query = "SELECT id, title, sanctioned_amount, status FROM works LIMIT 5";
      let explanation = 'Here is a sample of works:';

      if (msg.includes('top 5') || msg.includes('highest cost')) {
        query = 'SELECT id, title, sanctioned_amount, status FROM works ORDER BY sanctioned_amount DESC LIMIT 5';
        explanation = 'Here are the top 5 highest sanctioned works:';
      } else if (msg.includes('completed')) {
        query = "SELECT id, title, sanctioned_amount, fy FROM works WHERE status = 'COMPLETED' LIMIT 10";
        explanation = 'Here are recently completed works:';
      } else if (msg.includes('sc') || msg.includes('st')) {
        query = "SELECT id, title, status FROM works WHERE area_type LIKE '%SC-%' OR area_type LIKE '%ST-%' LIMIT 10";
        explanation = 'Here are works in SC/ST localities:';
      }

      try {
        const results = await db.$queryRawUnsafe(query);
        let tableStr = `\n\n\`\`\`sql\n${query}\n\`\`\`\n\n| Work ID | Title | Amount | Status |\n|---|---|---|---|\n`;
        results.forEach((r) => {
          tableStr += `| ${r.id} | ${r.title || 'N/A'} | ₹${r.sanctioned_amount || 0} | ${r.status || 'N/A'} |\n`;
        });
        return NextResponse.json({ reply: `${explanation}${tableStr}` });
      } catch (e) {
        // fall through to Ollama if DB query fails
      }
    }

    // Build role-specific system prompt
    const systemPrompt =
      role === 'officer'
        ? `You are LUDO, the official AI Assistant for the MPLADS (Members of Parliament Local Area Development Scheme). The user is a District Officer. Help them monitor works, detect anomalies, and ensure compliance. Be concise and factual.`
        : `You are LUDO, the official AI Assistant for the MPLADS scheme. The user is from the general public. Provide accurate general information about the scheme. Do NOT share internal alerts, fraud cases, or anomaly details — those are strictly for officers.`;

    try {
      const reply = await callOllama(systemPrompt, message);
      return NextResponse.json({ reply: `(LUDO AI — Local): ${reply}` });
    } catch (ollamaError) {
      console.error('[chat/route] Ollama error:', ollamaError.message);
      return NextResponse.json({
        reply:
          '(LUDO AI): I am currently unable to reach the local AI engine. Please ensure Ollama is running (`ollama serve`) and the model `qwen2.5-coder:7b` is loaded.',
      });
    }
  } catch (error) {
    console.error('[chat/route] Error:', error);
    return NextResponse.json({ reply: 'Internal error.' }, { status: 500 });
  }
}
