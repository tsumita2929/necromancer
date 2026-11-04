// Checks that every number in section 9 of docs/research/census.md also appears in the output of recompute.mjs.
// Usage: node docs/research/scripts/r4b-numcheck.mjs   (run from the repository root)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const research = join(dirname(fileURLToPath(import.meta.url)), '..');
const printed = execFileSync('node', [join(research, 'recompute.mjs')], { encoding: 'utf8' });
const md = readFileSync(join(research, 'census.md'), 'utf8');
const section = md.slice(md.indexOf("## 9. The final engine"));
// Remove what is not a quoted result: code spans with paths and ids, dates, headings numbers, commit ids, URLs.
const cleaned = section
  .replace(/`[^`]*`/g, (m) => (/^`[\d.,% ]+`$/.test(m) ? m : ' '))
  .replace(/\d{4}-\d{2}-\d{2}/g, ' ')
  .replace(/^#+ .*$/gm, ' ')
  .replace(/\bsections? \d+(\.\d+)?( to \d+(\.\d+)?)?/gi, ' ')
  .replace(/\bPEP \d+/g, ' ')
  .replace(/(\(|\bin |\bsee )9\.\d+\b/g, ' ')
  .replace(/https?:\S+/g, ' ');
const normalise = (t) => t.replace(/,/g, '');
const hay = normalise(printed);
const tokens = [...new Set([...normalise(cleaned).matchAll(/\d+(?:\.\d+)?%?/g)].map((m) => m[0]))];
const missing = tokens.filter((t) => {
  const bare = t.replace('%', '');
  if (hay.includes(t) || hay.includes(bare)) return false;
  if (t.includes('%') && hay.includes(String(Number(bare).toFixed(1)))) return false;
  return true;
});
console.log(`numbers in section 9: ${tokens.length}; not found in the recompute output: ${missing.length}`);
if (missing.length) console.log(missing.join(' '));

// Every Q id named in section 9 must be a line of the recompute output.
const ids = [...new Set([...section.matchAll(/`(Q\d\d)`/g)].map((m) => m[1]))];
const lines = printed.split('\n');
const noLine = ids.filter((id) => !lines.some((l) => l.startsWith(id + ' ')));
console.log(`Q ids named in section 9: ${ids.length}; without a recompute line: ${noLine.length}${noLine.length ? ' ' + noLine.join(' ') : ''}`);
