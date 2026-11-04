// Reads the JSON that `mcp-call.mjs autopsy` prints on stdin and shows the part worth filming:
// the summary of the whole tree and the verdict of every direct dependency.
//   node scripts/mcp-call.mjs autopsy '{"path":"<abs path>"}' | node <this file>
import { readFileSync } from 'node:fs';

const { engine, report } = JSON.parse(readFileSync(0, 'utf8'));
console.log(`engine: ${engine}   whole tree: ${JSON.stringify(report.summary)}`);
for (const d of report.diagnoses) {
  if (!d.dependency.direct) continue;
  const version = String(d.dependency.resolved ?? d.dependency.spec);
  console.log(`${d.dependency.name.padEnd(10)} ${version.padEnd(8)} ${d.verdict}`);
}
const missing = report.unavailable.map((u) => u.source).join(', ');
console.log(`sources unavailable: ${missing || 'none'}`);
