// Runs one curated Python séance several times, each in a fresh folder and without CI in the
// environment, on the interpreter you name. Hypothesis then picks new examples every run (with CI=1 it
// replays the same ones), so this is the test of "does a visitor's fresh run pass".
//
//   npm run build
//   NECROMANCER_PYTHON=/path/to/venv/bin/python node scripts/seance-repeat.mjs [toml|pep8] [--runs 10]
//
// The interpreter's environment needs pytest, hypothesis and the old and new packages of the recipe
// (toml and tomli; pep8 and pycodestyle).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { RECIPES } from '../dist/seance/recipes/index.js';
import { fail } from './lib/paths.mjs';

const args = process.argv.slice(2);
const runsAt = args.indexOf('--runs');
const runs = runsAt >= 0 ? Number(args[runsAt + 1]) : 10;
const id = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--runs') ?? 'toml';
const python = process.env.NECROMANCER_PYTHON;
if (!python)
  fail(
    'set NECROMANCER_PYTHON to the python of an environment with pytest, hypothesis and the recipe packages.',
  );
if (!existsSync(python)) fail(`NECROMANCER_PYTHON points to ${python}, which does not exist.`);
const recipe = RECIPES.find((r) => r.id === id && r.language === 'python');
if (!recipe) fail(`no Python recipe called ${id}.`);

const version = spawnSync(python, ['--version'], { encoding: 'utf8' });
const packages = spawnSync(python, ['-m', 'pip', 'list', '--format=freeze'], { encoding: 'utf8' })
  .stdout.split('\n')
  .filter((l) => /^(hypothesis|pytest|toml|tomli|pep8|pycodestyle)==/i.test(l));
console.log(`${(version.stdout || version.stderr).trim()}; ${packages.join(', ')}`);

const bundle = recipe.build({
  diagnosis: {
    dependency: {
      ecosystem: 'pypi',
      name: recipe.old,
      spec: '',
      direct: true,
      scope: 'main',
      declaredIn: 'x',
    },
    verdict: 'dead',
    evidence: [],
    advisories: [],
    successors: [],
  },
  successor: {
    name: recipe.successors[0],
    ecosystem: 'pypi',
    kind: 'package',
    reason: 'x',
    source: 'curated',
  },
});

const env = { ...process.env };
delete env.CI;
delete env.CONTINUOUS_INTEGRATION;
let passed = 0;
for (let n = 1; n <= runs; n++) {
  const dir = mkdtempSync(join(tmpdir(), `seance-${id}-`));
  try {
    for (const f of bundle.files) {
      const target = join(dir, f.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, f.content);
    }
    const r = spawnSync(
      python,
      ['-m', 'pytest', bundle.run.replace(/^pytest /, ''), '-q', '-p', 'no:cacheprovider'],
      {
        cwd: dir,
        env,
        encoding: 'utf8',
        timeout: 600_000,
      },
    );
    const last = (r.stdout || '').trim().split('\n').filter(Boolean).pop() ?? '';
    const ok = r.status === 0;
    if (ok) passed++;
    console.log(`run ${String(n).padStart(2)}: ${ok ? 'PASS' : 'FAIL'}  ${last}`);
    if (!ok)
      console.log(
        (r.stdout || '')
          .split('\n')
          .filter((l) => /^(FAILED|E )/.test(l))
          .slice(0, 6)
          .join('\n'),
      );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
console.log(
  `${passed} of ${runs} runs passed (CI ${process.env.CI === undefined ? 'unset' : 'removed from the environment'})`,
);
process.exit(passed === runs ? 0 : 1);
