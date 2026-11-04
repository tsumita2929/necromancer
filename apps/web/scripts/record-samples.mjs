// Records real autopsy reports for the landing page samples, with a cassette of every answer received.
//
//   node scripts/record-samples.mjs --preview owner/repo owner/repo ...   (prints verdict counts, writes nothing)
//   --resume           answer from the repository's existing cassette first and ask the network only for what it lacks;
//                      a refused or failed answer is never kept. The report and the cassette's header are written only when
//                      the report is complete; until then only the new answers are added. Use a budget above what the
//                      repository needs (the engine's own count includes answers that came from the cassette).
//   --max-api-calls N  stop this run after N real calls to api.github.com (the rest are refused locally)
//   --show name,name   also prints verdict, basis and ways out of those dependencies
//   node scripts/record-samples.mjs --budget 40 owner/repo[#package.json] ...   (writes the reports, the cassettes and the index)
//
// It runs the same code as the browser (src/data/github.ts and the engine) through Vite's SSR
// loader, so there is one implementation. Manifests come from raw.githubusercontent.com. The
// GitHub REST budget is per repository (default 40, as in the browser; the limit is 60 calls an hour for this IP).
// `owner/repo#package.json` hands the engine only the named root files (comma separated); the cassette keeps all answers.
// Only the named repositories are rewritten; other recorded reports stay. The cassettes are replayed by
// scripts/verify-samples.mjs to prove each recorded report equals the engine's output for the same inputs.
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCassette, recordingFetch, resumingFetch, saveCassette } from './lib/cassette.mjs';
import { reindex } from './lib/sample-index.mjs';

const args = process.argv.slice(2);
const preview = args.includes('--preview');
const budgetAt = args.indexOf('--budget');
const budget = budgetAt >= 0 ? Number(args[budgetAt + 1]) : preview ? 0 : 40;
const resume = args.includes('--resume');
const capAt = args.indexOf('--max-api-calls');
const maxApiCalls = capAt >= 0 ? Number(args[capAt + 1]) : Infinity;
const showAt = args.indexOf('--show');
const show = showAt >= 0 ? args[showAt + 1].split(',') : [];
const repos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--budget' && args[i - 1] !== '--show' && args[i - 1] !== '--max-api-calls');
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
for (const spec of repos) {
  const [text, only] = spec.split('#');
  const repo = github.parseRepoInput(text);
  if (!repo) {
    console.error(`skip ${text}: not a repository`);
    continue;
  }
  const label = `${repo.owner}/${repo.name}`;
  try {
    const id = `${repo.owner}-${repo.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const previous = resume ? await loadCassette(id).catch(() => null) : null;
    if (resume && !previous) throw new Error(`no cassette for ${label}: record it once without --resume`);
    const tape = resume
      ? (() => {
          const r = resumingFetch((url, init) => fetch(url, init), previous.entries, { maxApiCalls });
          return { fetch: r.fetch, resumed: r, get entries() { return [...previous.entries, ...r.added]; } };
        })()
      : recordingFetch((url, init) => fetch(url, init));
    const read = await github.readRepository(repo, (url) => tape.fetch(url));
    const names = only ? only.split(',') : null;
    const files = names ? read.files.filter((f) => names.includes(f.path)) : read.files;
    let clock = new Date();
    const engine = engineModule.createEngine({ fetch: (url, init) => tape.fetch(url, init), now: () => clock }, { githubBudget: budget, concurrency: 8 });
    const started = Date.now();
    const report = await engine.autopsy({ subject: `github:${label}`, files });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const counts = report.summary;
    const githubCalls = tape.entries.filter((e) => e.url.startsWith('https://api.github.com/')).length;
    console.log(
      `${label}: ${report.diagnoses.length} deps in ${seconds}s  zombie=${counts.zombie} ghost=${counts.ghost} dead=${counts.dead} dying=${counts.dying} alive=${counts.alive}` +
        `  files=${files.map((f) => f.path).join(',')}  api.github.com calls=${githubCalls}  unavailable=${report.unavailable.map((u) => u.source).join(',') || '-'}`,
    );
    for (const d of report.diagnoses.filter((x) => show.includes(x.dependency.name))) {
      console.log(`  ${d.dependency.name}@${d.dependency.resolved ?? d.dependency.range}: ${d.verdict} basis=${d.basis ?? '-'} evidence=${d.evidence.map((e) => e.code).join('|')} ways=${d.successors.map((w) => `${w.name}(${w.kind},${w.confidence ?? '-'},${w.source})`).join(', ') || '-'}`);
    }
    for (const u of report.unavailable) console.log(`  unavailable ${u.source}: ${u.reason}`);
    if (resume) {
      const st = tape.resumed.stats;
      console.log(`  resume: ${st.cached} answers from the cassette, ${st.network} from the network (${st.apiCalls} api.github.com), ${st.refusedLocally} refused locally, ${st.notKept} failed answers not kept, ${tape.resumed.added.length} new answers kept`);
      const missing = report.unavailable;
      if (missing.length > 0) {
        await saveCassette(id, { repository: previous.repository, budget: previous.budget, only: previous.only, files: previous.files, githubCalls: previous.githubCalls, scannedAt: previous.scannedAt }, tape.entries);
        console.log(`  INCOMPLETE, the report was not written; the cassette now holds ${tape.entries.length} answers (${tape.resumed.added.length} new)`);
        continue;
      }
    }
    const githubTotal = tape.entries.filter((e) => e.url.startsWith('https://api.github.com/')).length;
    recorded.push({ repo, report, tape, meta: { repository: label, budget, only: names, files: files.map((f) => f.path), githubCalls: resume ? githubTotal : githubCalls, scannedAt: clock.toISOString() } });
  } catch (error) {
    console.error(`${label}: ${error instanceof Error ? error.message : error}`);
  }
}

if (!preview && recorded.length > 0) {
  await mkdir(outDir, { recursive: true });
  for (const { repo, report, tape, meta } of recorded) {
    const id = `${repo.owner}-${repo.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await writeFile(`${outDir}${id}.json`, `${JSON.stringify(report, null, 2)}\n`);
    await saveCassette(id, { ...meta, scannedAt: report.scannedAt }, tape.entries);
  }
  const total = await reindex();
  console.log(`wrote ${recorded.length} recorded reports, their cassettes and the index (${total} samples)`);
}
await vite.close();
