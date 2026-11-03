import type { AutopsyReport, Diagnosis, Evidence, Verdict } from '@contract';
import { diagnosis as d, ev, pkg, report, successor } from './build';

/** Small deterministic random generator, so the stress sample is the same on every load. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PREFIX = ['fast', 'tiny', 'micro', 'safe', 'neo', 'open', 'smart', 'uni', 'easy', 'hyper', 'async', 'flex', 'pure', 'zen', 'meta', 'rapid'];
const MIDDLE = ['queue', 'cache', 'parse', 'router', 'stream', 'schema', 'config', 'logger', 'token', 'form', 'table', 'chart', 'date', 'path', 'merge', 'slug', 'mime', 'cookie', 'event', 'socket'];
const SUFFIX = ['', '-js', '-kit', '-lite', '-core', '-utils', '-plus', '-next', '-compat'];

/** Weights per verdict: most of a real tree is alive. */
const PLAN: ReadonlyArray<readonly [Verdict, number]> = [
  ['zombie', 12],
  ['ghost', 9],
  ['dead', 34],
  ['dying', 40],
  ['alive', 204],
];

function evidenceFor(verdict: Verdict, rand: () => number): Evidence[] {
  const year = 2016 + Math.floor(rand() * 6);
  const date = `${year}-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`;
  const age = 2026 - year;
  switch (verdict) {
    case 'zombie':
      return [
        ev('osv-advisory', 'An advisory affects the version in use, and no fix will be published.', 'osv'),
        ev('npm-deprecated', 'Deprecated on npm by its maintainer.', 'npm', { date }),
      ];
    case 'ghost':
      return [
        ev('repo-gone', 'The source repository answers 404.', 'github'),
        ev('no-release', `No release for more than ${age} years.`, 'npm', { date }),
      ];
    case 'dead':
      return [
        ev('npm-deprecated', 'Deprecated on npm. The message points to a replacement.', 'npm', { date }),
        ev('no-release', `No release for more than ${age} years.`, 'npm', { date }),
      ];
    case 'dying':
      return [ev('no-release', `No release for more than ${Math.max(2, age - 2)} years.`, 'npm', { date })];
    default:
      return [];
  }
}

export function buildSprawl(): AutopsyReport {
  const rand = mulberry32(1031);
  const diagnoses: Diagnosis[] = [];
  const used = new Set<string>();
  let n = 0;
  for (const [verdict, count] of PLAN) {
    for (let i = 0; i < count; i += 1) {
      let name = '';
      do {
        const p = PREFIX[Math.floor(rand() * PREFIX.length)] ?? 'fast';
        const m = MIDDLE[Math.floor(rand() * MIDDLE.length)] ?? 'cache';
        const s = SUFFIX[Math.floor(rand() * SUFFIX.length)] ?? '';
        name = `${p}-${m}${s}`;
      } while (used.has(name));
      used.add(name);
      n += 1;
      const major = 1 + Math.floor(rand() * 8);
      const version = `${major}.${Math.floor(rand() * 20)}.${Math.floor(rand() * 10)}`;
      const dep = pkg(name, `^${version}`, version, {
        direct: rand() < 0.35,
        scope: rand() < 0.25 ? 'dev' : 'main',
        declaredIn: n % 4 === 0 ? 'packages/web/package.json' : n % 4 === 1 ? 'packages/api/package.json' : 'package.json',
      });
      const evidence = evidenceFor(verdict, rand);
      diagnoses.push(
        d(dep, verdict, {
          evidence,
          advisories: verdict === 'zombie' ? [`GHSA-${n.toString(16).padStart(4, '0')}-sprw-0001`] : [],
          successors:
            verdict === 'dead' || verdict === 'zombie'
              ? [successor(`${name}-ng`, 'package', 'A maintained package with the same purpose.', 'curated')]
              : [],
          ...(rand() < 0.8 ? { latest: { version: `${major + 1}.0.0`, date: '2025-09-01' } } : {}),
        }),
      );
    }
  }
  // Two names long enough to stress layout.
  const long = 'a-very-long-package-name-'.repeat(5).slice(0, 125);
  diagnoses.push(
    d(pkg(`@enterprise-platform-engineering/${long}`, '^1.0.0', '1.0.0', { direct: false }), 'dead', {
      evidence: [ev('npm-deprecated', 'Deprecated on npm.', 'npm')],
    }),
  );
  // Shuffle so the input order is not already sorted by verdict.
  for (let i = diagnoses.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const a = diagnoses[i];
    const b = diagnoses[j];
    if (a && b) {
      diagnoses[i] = b;
      diagnoses[j] = a;
    }
  }
  return report({
    subject: 'github:fixtures/sprawl',
    manifests: [
      { kind: 'package-lock.json', path: 'package-lock.json' },
      { kind: 'package.json', path: 'package.json' },
      { kind: 'package.json', path: 'packages/web/package.json' },
      { kind: 'package.json', path: 'packages/api/package.json' },
    ],
    diagnoses,
  });
}
