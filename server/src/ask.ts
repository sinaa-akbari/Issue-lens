import { runAgent } from './agent.js';
import { pool } from './db.js';

const question = process.argv.slice(2).join(' ');
if (!question) {
  console.error('usage: npm run ask -- "your question"');
  process.exit(1);
}

console.log(`Q: ${question}`);
try {
  const answer = await runAgent(question);
  console.log(`\n${'─'.repeat(60)}\nA: ${answer}`);
} finally {
  await pool.end();
}
