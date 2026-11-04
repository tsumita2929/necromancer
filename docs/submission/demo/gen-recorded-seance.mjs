// Writes the séance files the page would offer for one package of a recorded sample, with the engine (no page needed).
//   node gen-recorded-seance.mjs <clone of the repository> <sample json file> <package> <output folder>
// The engine must be built first (npm ci and npm run build in packages/engine).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [clone, sample, name, out] = process.argv.slice(2);
const { generateSeance } = await import(pathToFileURL(join(clone, 'packages/engine/dist/index.js')));
const report = JSON.parse(readFileSync(join(clone, 'apps/web/src/data/recorded', sample), 'utf8'));
const d = report.diagnoses.find((x) => x.dependency.name === name);
const s = d.successors[0];
const bundle = generateSeance(d, s);
console.log('recipe', bundle.recipe, '| run:', bundle.run, '| versions:', JSON.stringify(bundle.oldVersions)?.slice(0, 160));
for (const f of bundle.files) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.content); }
console.log(bundle.files.map((f) => f.path).join(', '));
