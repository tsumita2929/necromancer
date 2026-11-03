// Records real autopsy reports for the landing page samples.
//
//   node scripts/record-samples.mjs --preview owner/repo owner/repo ...   (prints verdict counts, writes nothing)
//   node scripts/record-samples.mjs --budget 8 owner/repo ...             (writes src/data/recorded/*.json and the index)
//
// It runs the same code as the browser (src/data/github.ts and the engine) through Vite's SSR
// loader, so there is one implementation. Manifests come from raw.githubusercontent.com. The
// GitHub REST budget is per repository (default 8; the limit is 60 calls an hour for this IP).
import { createServer } from 'vite';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const preview = args.includes('--preview');
const budgetAt = args.indexOf('--budget');
const budget = budgetAt >= 0 ? Number(args[budgetAt + 1]) : preview ? 0 : 8;
const repos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--budget');
if (repos.length === 0) {
  console.error('Give at least one owner/repo.');
  process.exit(2);
}

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = fileURLToPath(new URL('../src/data/recorded/', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const github = await vite.ssrLoadModule('/src/data/github.ts');
const engineModule = await vite.ssrLoadModule('@necromancer/engine');

const recorded = [];
for (const text of repos) {
  const repo = github.parseRepoInput(text);
  if (!repo) {
    console.error(`skip ${text}: not a repository`);
    continue;
  }
  const label = `${repo.owner}/${repo.name}`;
  try {
    const read = await github.readRepository(repo, (url) => fetch(url));
    const engine = engineModule.createEngine({ fetch: (url, init) => fetch(url, init) }, { githubBudget: budget, concurrency: 8 });
    const started = Date.now();
    const report = await engine.autopsy({ subject: `github:${label}`, files: read.files });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const counts = report.summary;
    console.log(
      `${label}: ${report.diagnoses.length} deps in ${seconds}s  zombie=${counts.zombie} ghost=${counts.ghost} dead=${counts.dead} dying=${counts.dying} alive=${counts.alive}` +
        `  files=${read.files.map((f) => f.path).join(',')}  unavailable=${report.unavailable.map((u) => u.source).join(',') || '-'}`,
    );
    recorded.push({ repo, report, files: read.files.map((f) => f.path) });
  } catch (error) {
    console.error(`${label}: ${error instanceof Error ? error.message : error}`);
  }
}

if (!preview && recorded.length > 0) {
  await mkdir(outDir, { recursive: true });
  for (const name of await readdir(outDir)) if (name.endsWith('.json')) await rm(`${outDir}${name}`);
  const index = [];
  for (const { repo, report } of recorded) {
    const id = `${repo.owner}-${repo.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await writeFile(`${outDir}${id}.json`, `${JSON.stringify(report, null, 2)}\n`);
    const ecosystems = new Set(report.diagnoses.map((d) => d.dependency.ecosystem));
    index.push({
      id,
      repository: `${repo.owner}/${repo.name}`,
      ecosystem: ecosystems.size > 1 ? 'both' : ecosystems.has('pypi') ? 'pypi' : 'npm',
      recordedAt: report.scannedAt,
      total: report.diagnoses.length,
      summary: report.summary,
    });
  }
  const source = `// Written by scripts/record-samples.mjs. Do not edit by hand.
import type { Verdict } from '@contract';

export interface RecordedSample {
  id: string;
  /** owner/name on GitHub. */
  repository: string;
  ecosystem: 'npm' | 'pypi' | 'both';
  /** ISO date of the engine run. */
  recordedAt: string;
  total: number;
  summary: Record<Verdict, number>;
}

export const RECORDED_SAMPLES: readonly RecordedSample[] = ${JSON.stringify(index, null, 2)};
`;
  await writeFile(fileURLToPath(new URL('../src/data/samples.generated.ts', import.meta.url)), source);
  console.log(`wrote ${index.length} recorded reports and the index`);
}
await vite.close();
