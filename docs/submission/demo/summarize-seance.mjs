// Reads the JSON that `mcp-call.mjs seance` prints on stdin and shows what the tool made.
//   node scripts/mcp-call.mjs seance '{"ecosystem":"npm","name":"left-pad","path":"<abs path>"}' | node <this file>
import { readFileSync } from 'node:fs';

const s = JSON.parse(readFileSync(0, 'utf8'));
console.log(`${s.dependency} (${s.verdict}) -> ${typeof s.successor === 'string' ? s.successor : s.successor?.name}`);
console.log(`recipe: ${s.recipe}   template: ${s.template}   comparisons skipped: ${s.comparisonsSkipped}   TODOs: ${s.todos}`);
console.log(`project calls found: ${s.usage.members.map((m) => `${m.member} x${m.calls}`).join(', ')} in ${s.usage.filesUsing.join(', ')}`);
console.log(`known differences: ${s.knownDifferences.length}`);
for (const k of s.knownDifferences.slice(0, 3)) console.log(`  ${k.input}: old ${k.old}`);
console.log(`run: ${s.run}`);
