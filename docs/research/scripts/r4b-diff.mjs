// Compares two aggregate files field by field and records the result with the run's own summary line.
// Usage: node r4b-diff.mjs <mine.json> <engineWorker.json> <run.log> <out.json> <engineCommit>
// The run log is the output of tuned-run.mjs; its last line is `finished {"total":{...},"stats":{...}}`.
import { readFileSync, writeFileSync } from 'node:fs';

const [mineFile, theirsFile, logFile, outFile, commit] = process.argv.slice(2);
const mine = JSON.parse(readFileSync(mineFile, 'utf8'));
const theirs = JSON.parse(readFileSync(theirsFile, 'utf8'));
const diffs = [];
const walk = (a, b, path) => {
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], `${path}/${k}`);
  } else if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(path);
};
walk(mine, theirs, '');
const last = readFileSync(logFile, 'utf8').trim().split('\n').pop();
const run = JSON.parse(last.replace(/^finished /, ''));
const out = {
  engine: commit,
  comparedWith: 'docs/verification/engine-r4-data/census-aggregate-r4.json',
  differingFields: diffs.length,
  differingPaths: diffs.slice(0, 20),
  run: { subjects: mine.all.subjects, networkRequests: run.stats.network, cacheHits: run.stats.cacheHits, githubRestRequests: run.stats.githubCore, commitLookups: run.total.commitRequests, commitFeedsFetched: run.total.commitFeedsFetched, commitFeedsFailed: run.total.commitFeedFailed, repositoryLookupsOutsideCache: run.total.repoMiss },
};
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
