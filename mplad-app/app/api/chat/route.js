import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export async function POST(request) {
  try {
    const { message, role } = await request.json();
    const msg = message.toLowerCase();
    
    // 1. Text2SQL Copilot - Deterministic Templates (No LLM Mode)
    // Matches: "top 5 works", "show all works", "cost > X"
    if (role === 'officer' && (msg.includes('top') || msg.includes('show') || msg.includes('how many'))) {
      let query = '';
      let explanation = '';
      
      if (msg.includes('top 5 works') || msg.includes('highest cost')) {
        query = 'SELECT id, sanctioned_amount, status FROM works ORDER BY sanctioned_amount DESC LIMIT 5';
        explanation = 'Here are the top 5 highest sanctioned works:';
      } else if (msg.includes('completed works')) {
        query = "SELECT id, sanctioned_amount, fy FROM works WHERE status = 'COMPLETED' LIMIT 10";
        explanation = 'Here are some recently completed works:';
      } else if (msg.includes('sc') || msg.includes('st')) {
        query = "SELECT id, status FROM works WHERE area_type LIKE '%SC-%' OR area_type LIKE '%ST-%' LIMIT 10";
        explanation = 'Here are works in SC/ST localities:';
      } else {
        query = "SELECT id, sanctioned_amount, status FROM works LIMIT 5";
        explanation = 'Here is a sample of works:';
      }
      
      try {
        // Enforce SELECT-only guardrail
        if (!query.trim().toUpperCase().startsWith('SELECT')) {
           throw new Error('Only SELECT queries are allowed.');
        }
        
        const results = await db.$queryRawUnsafe(query);
        let tableStr = `\n\n\`\`\`sql\n${query}\n\`\`\`\n\n| Work ID | Details |\n|---|---|\n`;
        results.forEach(r => {
          tableStr += `| ${r.id} | ₹${r.sanctioned_amount || 0} (${r.status || 'N/A'}) |\n`;
        });
        
        return NextResponse.json({ reply: `${explanation}${tableStr}` });
      } catch (e) {
        return NextResponse.json({ reply: `Copilot Error: ${e.message}` });
      }
    }
    
    let reply = "I'm sorry, I didn't understand that. You can ask me to 'show top 5 works' or 'show completed works'.";

    if (msg.includes('hello') || msg.includes('hi ')) {
      reply = `Hello! I am the MPLADS Text2SQL Copilot. You are in ${role === 'officer' ? 'Full Access (Officer)' : 'Read-Only (Public)'} mode. How can I help you?`;
    } 

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ reply: 'Sorry, I encountered an internal error.' }, { status: 500 });
  }
}

