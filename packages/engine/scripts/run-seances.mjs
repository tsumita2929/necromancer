// Runs every curated séance for real, then runs each mutant (a deliberately wrong replacement)
// and records what happened.
//
//   npm run build && node scripts/run-seances.mjs [recipe-id ...] [--scratch DIR]
//
// The scratch directory (--scratch DIR or the environment variable NECROMANCER_SEANCE_SCRATCH) holds
//   js/   a Node project with vitest, fast-check and the old and new packages installed
//   .venv a Python virtual environment with pytest, hypothesis and the old and new packages
// The generated files are written there, the test runner is started, and the result is saved in
// test/fixtures/seance-runs/<recipe>.json and .log. Needs no network once the scratch directory
// is set up. Tests in the engine never run this.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES } from '../dist/seance/recipes/index.js';
import { seanceScratch } from './lib/paths.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const scratchFlag = args.indexOf('--scratch');
const scratch = seanceScratch(scratchFlag >= 0 ? args[scratchFlag + 1] : undefined);
const wanted = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--scratch');
const out = join(here, '..', 'test', 'fixtures', 'seance-runs');
mkdirSync(out, { recursive: true });

/** Packages whose installed versions go into the record. */
const PACKAGES = {
  'left-pad': { js: ['left-pad', 'vitest', 'fast-check'] },
  querystring: { js: ['querystring', 'vitest', 'fast-check'] },
  mkdirp: { js: ['mkdirp', 'vitest', 'fast-check'] },
  'is-odd': { js: ['is-odd', 'vitest', 'fast-check'] },
  toml: { py: ['toml', 'tomli', 'pytest', 'hypothesis'] },
  pep8: { py: ['pep8', 'pycodestyle', 'pytest', 'hypothesis'] },
};

function run(cmd, cmdArgs, cwd) {
  const started = Date.now();
  const r = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: 'utf8',
    timeout: 600000,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', CI: '1' },
  });
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    text: `${r.stdout ?? ''}${r.stderr ?? ''}`,
    seconds: (Date.now() - started) / 1000,
  };
}

function versions(recipe) {
  const spec = PACKAGES[recipe.id] ?? {};
  const found = {};
  for (const name of spec.js ?? []) {
    const f = join(scratch, 'js', 'node_modules', name, 'package.json');
    if (existsSync(f)) found[name] = JSON.parse(readFileSync(f, 'utf8')).version;
  }
  if (spec.py) {
    const r = run(
      join(scratch, '.venv', 'bin', 'python'),
      ['-m', 'pip', 'list', '--format=json'],
      scratch,
    );
    try {
      const list = JSON.parse(r.stdout);
      for (const name of spec.py)
        found[name] = list.find((p) => p.name.toLowerCase() === name)?.version;
    } catch {
      /* versions are optional */
    }
  }
  return found;
}

function write(recipe, files) {
  const root = join(scratch, recipe.language === 'javascript' ? 'js' : 'py');
  for (const f of files) {
    const target = join(root, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.content);
  }
  return root;
}

function runTests(recipe, root) {
  if (recipe.language === 'javascript') {
    return run(
      join(root, 'node_modules', '.bin', 'vitest'),
      ['run', `seance/${recipe.id}`, '--reporter=default'],
      root,
    );
  }
  return run(
    join(scratch, '.venv', 'bin', 'python'),
    ['-m', 'pytest', '-q', '-p', 'no:cacheprovider', `seance/${recipe.id}`],
    root,
  );
}

function summary(text) {
  const keep = text
    .split('\n')
    .filter(
      (l) =>
        /(Tests|Test Files|passed|failed|xfailed|skipped|error)/i.test(l) && !/^\s*at /.test(l),
    );
  return keep.slice(-4).map((l) => l.trim());
}

function counterexample(text) {
  const lines = text.split('\n');
  const found = [];
  for (const l of lines) {
    if (
      /Counterexample:|Shrunk \d+ time|Falsifying example|^E\s+(assert|AssertionError)|AssertionError:|Reproduce with/.test(
        l,
      )
    )
      found.push(l.trim());
    if (found.length >= 6) break;
  }
  return found;
}

const results = [];
for (const recipe of RECIPES) {
  if (wanted.length > 0 && !wanted.includes(recipe.id)) continue;
  const ctx = {
    diagnosis: {
      dependency: {
        ecosystem: recipe.ecosystem,
        name: recipe.old,
        spec: '',
        direct: true,
        scope: 'main',
        declaredIn: '',
      },
      verdict: 'dead',
      evidence: [],
      advisories: [],
      successors: [],
    },
    successor: {
      name: recipe.successors[0],
      ecosystem: recipe.ecosystem,
      kind: 'native',
      reason: 'recipe',
      source: 'curated',
    },
  };
  const bundle = recipe.build(ctx);
  const root = join(scratch, recipe.language === 'javascript' ? 'js' : 'py');
  rmSync(join(root, 'seance', recipe.id), { recursive: true, force: true });
  write(recipe, bundle.files);
  const real = runTests(recipe, root);
  const record = {
    recipe: recipe.id,
    language: recipe.language,
    command: bundle.run,
    ranAt: new Date().toISOString(),
    versions: versions(recipe),
    real: { exit: real.status, seconds: real.seconds, summary: summary(real.text) },
    mutants: [],
  };
  let log = `=== ${recipe.id}: real run (exit ${real.status}) ===\n${real.text.slice(-6000)}\n`;
  for (const m of recipe.mutants(ctx)) {
    write(recipe, m.files);
    const r = runTests(recipe, root);
    record.mutants.push({
      id: m.id,
      description: m.description,
      exit: r.status,
      failed: r.status !== 0,
      counterexample: counterexample(r.text),
      summary: summary(r.text),
    });
    log += `\n=== ${recipe.id}: mutant ${m.id} (exit ${r.status}) ===\n${r.text.slice(-6000)}\n`;
    write(
      recipe,
      bundle.files.filter((f) => m.files.some((x) => x.path === f.path)),
    );
  }
  // Leave the scratch directory with the real replacement in place and prove it still passes.
  const again = runTests(recipe, root);
  record.restoredExit = again.status;
  writeFileSync(join(out, `${recipe.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
  // The logs are committed: they name the scratch folder as <scratch>, not as a path of this machine.
  writeFileSync(join(out, `${recipe.id}.log`), log.split(scratch).join('<scratch>'));
  results.push(record);
  const bad = record.real.exit !== 0 || record.mutants.some((m) => !m.failed) || again.status !== 0;
  console.log(
    `${bad ? 'PROBLEM' : 'OK     '} ${recipe.id}: real exit ${record.real.exit}; ${record.mutants.map((m) => `${m.id} ${m.failed ? 'fails' : 'PASSES'}`).join(', ')}`,
  );
  for (const l of record.real.summary) console.log(`        ${l}`);
}
process.exit(
  results.some((r) => r.real.exit !== 0 || r.mutants.some((m) => !m.failed) || r.restoredExit !== 0)
    ? 1
    : 0,
);
