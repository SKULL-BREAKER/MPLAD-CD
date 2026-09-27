import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export async function POST(request) {
  try {
    const { message, role } = await request.json();
    const msg = message.toLowerCase();
    
    // 1. Text2SQL Copilot - Deterministic Templates (No LLM Mode)
    // Matches: "top 5 works", "show all works", "cost > X"
    if (msg.includes('top') || msg.includes('show') || msg.includes('how many')) {
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
    // Improved conversational matching
    if (msg === 'hi' || msg === 'hello' || msg.includes('hello ') || msg.includes('hi ')) {
      return NextResponse.json({ reply: `Hello! I am the MPLADS AI Assistant. You are in ${role === 'officer' ? 'Full Access (Officer)' : 'Read-Only (Public)'} mode. How can I help you today?` });
    } else if (msg.includes('how are you')) {
      return NextResponse.json({ reply: `I'm functioning perfectly and ready to help you analyze MPLADS data!` });
    } else if (msg.includes('who are you')) {
      return NextResponse.json({ reply: `I am PRAHARI, your AI Assistant for monitoring and analyzing MPLADS project data.` });
    } else if (msg.includes('help')) {
      return NextResponse.json({ reply: `I can help you query the database! Try asking me to "show top 5 works", "show completed works", or "show works in sc/st areas".` });
    }

    // Dynamic Keyword Search Fallback
    const stopWords = ['list', 'out', 'the', 'projects', 'which', 'are', 'in', 'of', 'for', 'to', 'show', 'me', 'all', 'a', 'an', 'what', 'is', 'give', 'detail', 'details', 'works', 'work'];
    const words = msg.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));
    
    if (words.length > 0) {
      let conditions = [];
      words.forEach(w => {
        conditions.push(`(title LIKE '%${w}%' OR description LIKE '%${w}%' OR status LIKE '%${w}%' OR category LIKE '%${w}%' OR district_id LIKE '%${w}%')`);
      });
      const whereClause = conditions.join(' AND ');
      const query = `SELECT id, sanctioned_amount, status FROM works WHERE ${whereClause} LIMIT 5`;
      
      try {
        const results = await db.$queryRawUnsafe(query);
        if (results.length > 0) {
          let tableStr = `\n\n\`\`\`sql\n${query}\n\`\`\`\n\n| Work ID | Details |\n|---|---|\n`;
          results.forEach(r => {
            tableStr += `| ${r.id} | ₹${r.sanctioned_amount || 0} (${r.status || 'N/A'}) |\n`;
          });
          return NextResponse.json({ reply: `Here is what I found based on your request:\n${tableStr}` });
        }
      } catch (e) {
        // Fall through
      }
    }

    return NextResponse.json({ reply: "I couldn't find any specific data matching those terms in the database. Could you try rephrasing or asking for 'top 5 works'?" });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ reply: 'Sorry, I encountered an internal error.' }, { status: 500 });
  }
}

