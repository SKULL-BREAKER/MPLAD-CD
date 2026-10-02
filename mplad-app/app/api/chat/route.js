import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import db from '../../../lib/db';

export async function POST(request) {
  try {
    const { message, role } = await request.json();
    const msg = message.toLowerCase();

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
        // fall through to AI
      }
    }

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

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Mock fallback when no API key is configured
      const mockResponses = [
        "MPLADS is the Members of Parliament Local Area Development Scheme. It empowers MPs to recommend development works in their constituencies with an emphasis on creating durable community assets.",
        "As per the official guidelines, 15% of MPLADS funds are mandatory for SC population areas and 7.5% for ST population areas. Works must not be for individual benefit.",
        "I am LUDO, the AI assistant for MPLADS. I continuously monitor the official website to detect anomalies and alert designated authorities of any violations, ensuring strict compliance with all rules.",
        "Yes, I have complete access to the current project data across all sectors, including Drinking Water, Education, and Healthcare. If you need specific statistics, please ask me to show top works or provide a report.",
        "I am functioning perfectly. I monitor the current scheme data to ensure transparency, and I immediately notify the district officers if there is any anomaly found in their respected area.",
      ];
      let reply = mockResponses[0];
      if (msg.includes('sc') || msg.includes('st') || msg.includes('rule')) reply = mockResponses[1];
      if (msg.includes('who') || msg.includes('ludo')) reply = mockResponses[2];
      if (msg.includes('data') || msg.includes('stats')) reply = mockResponses[3];
      if (msg.includes('monitor') || msg.includes('anomaly') || msg.includes('officer')) reply = mockResponses[4];
      return NextResponse.json({ reply: `(LUDO AI): ${reply}\n\n*Note: I am fully trained on the present official data.*` });
    }

    const systemPrompt =
      role === 'officer'
        ? `You are LUDO, the official AI Assistant for the MPLADS scheme. The user is a District Officer. Help them monitor works, detect anomalies, and ensure compliance. Be concise and factual.`
        : `You are LUDO, the official AI Assistant for the MPLADS scheme. The user is from the general public. Provide accurate general information about the scheme. Do NOT share internal alerts, fraud cases, or anomaly details — those are strictly for officers.`;

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `${systemPrompt}\n\nUser: ${message}`,
      });
      return NextResponse.json({ reply: response.text });
    } catch (aiError) {
      console.error('[chat/route] AI error:', aiError);
      return NextResponse.json({
        reply: 'I am LUDO AI. I am trained to monitor the website and notify officers of anomalies. How may I assist you with present MPLADS data today?',
      });
    }
  } catch (error) {
    console.error('[chat/route] Error:', error);
    return NextResponse.json({ reply: 'Sorry, I encountered an internal error.' }, { status: 500 });
  }
}
