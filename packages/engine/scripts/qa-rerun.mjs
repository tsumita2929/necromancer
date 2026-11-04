// Re-runs the QA's steps for the findings that are the engine's, against the live public sources
// (npm, PyPI, deps.dev, OSV). It makes no GitHub API call (budget 0).
//
//   npm run build && node scripts/qa-rerun.mjs
import { createEngine } from '../dist/index.js';

const engine = createEngine({ fetch: (url, init) => fetch(url, init) }, { githubBudget: 0 });
const files = (kind, content) => [{ kind, path: kind, content }];

console.log('QA-01  advisory counts (distinct vulnerabilities, from the live OSV records)');
const report = await engine.autopsy({
  subject: 'qa-01',
  files: files('requirements.txt', 'pyjwt==2.8.0\nflask==1.0\ndjango==1.4\n'),
});
for (const d of report.diagnoses) {
  console.log(
    `  ${d.dependency.name} ${d.dependency.spec}: ${d.advisories.length} advisories, ` +
      `${Object.keys(d.advisoryAliases ?? {}).length} with aliases; verdict ${d.verdict}`,
  );
}
console.log(`  unavailable: ${JSON.stringify(report.unavailable)}`);

console.log('QA-07  a package that does not exist');
const [missing] = await engine.diagnose([
  {
    ecosystem: 'npm',
    name: 'zzz-no-such-pkg-qa-91827',
    spec: '',
    direct: true,
    scope: 'main',
    declaredIn: 'package.json',
  },
]);
console.log(
  `  verdict ${missing.verdict}, notFound ${missing.notFound}, evidence ${missing.evidence.map((e) => e.code).join(', ')}`,
);
console.log(`  "${missing.evidence[0].message}"`);

console.log('QA-16  the skipped-entry message');
const parsed = engine.parseManifest({
  kind: 'package.json',
  path: 'package.json',
  content: '{"dependencies":{"@a/<b>":"1"}}',
});
console.log(`  ${parsed.problems.join(' | ')}`);

console.log('QA-14  the skipped-dependency message (450 direct dependencies, limit 400)');
const many = Object.fromEntries(Array.from({ length: 450 }, (_, i) => [`dep-${i}`, '1.0.0']));
const offline = async () => ({
  ok: false,
  status: 404,
  json: async () => ({}),
  text: async () => '',
});
const small = createEngine({ fetch: offline }, { githubBudget: 0, maxDependencies: 400 });
const big = await small.autopsy({
  subject: 'qa-14',
  files: files('package.json', JSON.stringify({ dependencies: many })),
});
console.log(`  ${big.problems.map((p) => p.message).join(' | ')}`);
