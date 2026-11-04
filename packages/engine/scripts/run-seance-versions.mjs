// Runs a curated séance for real against several versions of the old package, each in its own folder,
// and records which versions the recipe fits: the real replacement passes and every mutant fails.
//
//   npm run build
//   NECROMANCER_SEANCE_SCRATCH=/path/to/scratch node scripts/run-seance-versions.mjs <recipe|all> [--only 1.0.4,3.0.1] [--successor]
//
// Results: test/fixtures/seance-versions/<recipe>.json, and src/seance/tested-versions.ts is written from
// all of those files (run Prettier after, or use `npm run format`). Needs the network for `npm install`
// and `pip install` (versions are cached after the first run). `CI=1` is set for the test runs, as in
// run-seances.mjs; the toml séance is checked for fresh runs separately (seance-repeat.mjs).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { RECIPES } from '../dist/seance/recipes/index.js';
import { engineRoot, fail, seanceScratch } from './lib/paths.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? true) : undefined;
};
const wanted = args.filter((a, i) => !a.startsWith('--') && !['--only'].includes(args[i - 1]));
const only = typeof flag('only') === 'string' ? flag('only').split(',') : undefined;
const scratch = seanceScratch(typeof flag('scratch') === 'string' ? flag('scratch') : undefined);
const base = join(scratch, 'versions');
mkdirSync(base, { recursive: true });
const outDir = join(engineRoot, 'test', 'fixtures', 'seance-versions');
mkdirSync(outDir, { recursive: true });

const pythonForVenv =
  process.env.NECROMANCER_PYTHON_BASE ?? join(scratch, '.venv', 'bin', 'python');

/** What to sweep: the old package, its versions, and (Python) the successor pinned. */
const PLANS = {
  'left-pad': {
    ecosystem: 'npm',
    pkg: 'left-pad',
    versions: ['1.0.0', '1.0.1', '1.0.2', '1.1.0', '1.1.1', '1.1.2', '1.1.3', '1.2.0', '1.3.0'],
  },
  querystring: { ecosystem: 'npm', pkg: 'querystring', versions: ['0.1.0', '0.2.0', '0.2.1'] },
  mkdirp: {
    ecosystem: 'npm',
    pkg: 'mkdirp',
    versions: [
      '0.5.0',
      '0.5.1',
      '0.5.2',
      '0.5.3',
      '0.5.4',
      '0.5.5',
      '0.5.6',
      '1.0.0',
      '1.0.1',
      '1.0.2',
      '1.0.3',
      '1.0.4',
      '2.0.0',
      '2.1.0',
      '2.1.1',
      '2.1.2',
      '2.1.3',
      '2.1.4',
      '2.1.5',
      '2.1.6',
      '3.0.0',
      '3.0.1',
    ],
  },
  'is-odd': {
    ecosystem: 'npm',
    pkg: 'is-odd',
    versions: ['0.1.2', '1.0.0', '2.0.0', '3.0.0', '3.0.1'],
  },
  toml: {
    ecosystem: 'pypi',
    pkg: 'toml',
    versions: ['0.9.4', '0.9.6', '0.10.0', '0.10.1', '0.10.2'],
    successor: { pkg: 'tomli', pinned: '2.5.0', latest: '2.5.0' },
  },
  pep8: {
    ecosystem: 'pypi',
    pkg: 'pep8',
    versions: ['1.5.7', '1.6.0', '1.6.1', '1.6.2', '1.7.0', '1.7.1'],
    successor: { pkg: 'pycodestyle', pinned: '2.14.0', latest: '2.15.0' },
  },
};

function run(cmd, cmdArgs, cwd, extraEnv = {}, limitMs = 900000) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: 'utf8',
    timeout: limitMs,
    killSignal: 'SIGKILL',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', CI: '1', ...extraEnv },
  });
  const timedOut = r.error?.code === 'ETIMEDOUT';
  // A killed runner can leave its worker running (a version that loops forever): end what still runs in that folder.
  if (timedOut) spawnSync('pkill', ['-9', '-f', cwd]);
  return {
    status: timedOut ? 124 : r.status,
    text: `${r.stdout ?? ''}${r.stderr ?? ''}${timedOut ? `\nTIMEOUT: no result after ${limitMs / 1000} seconds, killed` : ''}`,
  };
}

const registryVersions = (plan) => {
  if (plan.ecosystem === 'npm') {
    const r = run('npm', ['view', plan.pkg, 'versions', '--json'], base);
    return JSON.parse(r.text.slice(r.text.indexOf('[')));
  }
  return null;
};

async function pypiVersions(pkg) {
  const res = await fetch(`https://pypi.org/pypi/${pkg}/json`);
  const json = await res.json();
  return Object.entries(json.releases)
    .filter(([, files]) => files.length > 0 && !files.some((f) => f.yanked))
    .map(([v]) => v);
}

function prepare(recipe, plan, version, succVersion) {
  // The newest successor may need a newer Python than the one the old package runs on: NECROMANCER_PYTHON_LATEST.
  const newer =
    succVersion && succVersion !== plan.successor?.pinned
      ? process.env.NECROMANCER_PYTHON_LATEST
      : undefined;
  const venvPython = newer ?? pythonForVenv;
  const folder = join(
    base,
    `${recipe.id}-${version}${succVersion ? `-succ${succVersion}${newer ? '-newer-python' : ''}` : ''}`,
  );
  mkdirSync(folder, { recursive: true });
  if (plan.ecosystem === 'npm') {
    if (!existsSync(join(folder, 'package.json'))) {
      writeFileSync(
        join(folder, 'package.json'),
        JSON.stringify({ name: 'v', private: true, type: 'module' }),
      );
    }
    if (!existsSync(join(folder, 'node_modules', plan.pkg))) {
      const r = run(
        'npm',
        [
          'install',
          '--no-audit',
          '--no-fund',
          '--silent',
          'vitest@^5.1.0',
          'fast-check@^4.10.2',
          `${plan.pkg}@${version}`,
        ],
        folder,
      );
      if (r.status !== 0) return { folder, error: `npm install failed: ${r.text.slice(-300)}` };
    }
  } else {
    const py = join(folder, '.venv', 'bin', 'python');
    if (!existsSync(py)) {
      const v = run(venvPython, ['-m', 'venv', join(folder, '.venv')], folder);
      if (v.status !== 0) return { folder, error: `venv failed: ${v.text.slice(-300)}` };
    }
    const have = run(
      py,
      ['-c', `import importlib.metadata as m; print(m.version('${plan.pkg}'))`],
      folder,
    );
    if (have.text.trim() !== version) {
      const succ = plan.successor
        ? [`${plan.successor.pkg}==${succVersion ?? plan.successor.pinned}`]
        : [];
      const r = run(
        py,
        [
          '-m',
          'pip',
          'install',
          '-q',
          '--disable-pip-version-check',
          'pytest',
          'hypothesis',
          `${plan.pkg}==${version}`,
          ...succ,
        ],
        folder,
      );
      if (r.status !== 0) return { folder, error: `pip install failed: ${r.text.slice(-300)}` };
    }
  }
  return { folder };
}

const write = (folder, files) => {
  for (const f of files) {
    const target = join(folder, f.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, f.content);
  }
};

function tests(recipe, plan, folder) {
  if (plan.ecosystem === 'npm') {
    return run(
      join(folder, 'node_modules', '.bin', 'vitest'),
      ['run', `seance/${recipe.id}`],
      folder,
      {},
      120000,
    );
  }
  return run(
    join(folder, '.venv', 'bin', 'python'),
    ['-m', 'pytest', '-q', '-p', 'no:cacheprovider', `seance/${recipe.id}`],
    folder,
    {},
    600000,
  );
}

const lastLines = (text) =>
  text
    .split('\n')
    .filter((l) => /(Tests |passed|failed|error)/i.test(l) && !/^\s*at /.test(l))
    .slice(-2)
    .map((l) => l.trim())
    .join(' | ');

function why(text) {
  const lines = text.split('\n').map((l) => l.trim());
  if (text.includes('TIMEOUT:'))
    return 'the run did not finish and was killed (this version of the old package loops or allocates without end)';
  const pick = lines.find(
    (l) => /(TypeError|AssertionError|Error:|assert )/.test(l) && !l.startsWith('at '),
  );
  return (pick ?? lastLines(text) ?? 'the real run failed').slice(0, 200);
}

function sweepOne(recipe, plan, version, succVersion) {
  const prepared = prepare(recipe, plan, version, succVersion);
  if (prepared.error) return { version, pass: false, why: prepared.error, real: null, mutants: [] };
  const ctx = {
    diagnosis: {
      dependency: {
        ecosystem: plan.ecosystem,
        name: plan.pkg,
        spec: version,
        resolved: version,
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
      ecosystem: plan.ecosystem,
      kind: 'native',
      reason: 'recipe',
      source: 'curated',
    },
  };
  const bundle = recipe.build(ctx);
  rmSync(join(prepared.folder, 'seance'), { recursive: true, force: true });
  write(prepared.folder, bundle.files);
  const real = tests(recipe, plan, prepared.folder);
  const pyv =
    plan.ecosystem === 'pypi'
      ? run(
          join(prepared.folder, '.venv', 'bin', 'python'),
          ['--version'],
          prepared.folder,
        ).text.trim()
      : undefined;
  const out = {
    version,
    ...(pyv ? { python: pyv } : {}),
    pass: false,
    real: { exit: real.status, summary: lastLines(real.text) },
    mutants: [],
  };
  if (real.status !== 0) {
    out.why = why(real.text);
    return out;
  }
  for (const m of recipe.mutants(ctx)) {
    write(prepared.folder, m.files);
    const r = tests(recipe, plan, prepared.folder);
    out.mutants.push({ id: m.id, failed: r.status !== 0, summary: lastLines(r.text) });
    write(
      prepared.folder,
      bundle.files.filter((f) => m.files.some((x) => x.path === f.path)),
    );
  }
  out.pass = out.mutants.every((m) => m.failed);
  if (!out.pass)
    out.why = `a deliberately wrong replacement passed: ${out.mutants
      .filter((m) => !m.failed)
      .map((m) => m.id)
      .join(', ')}`;
  return out;
}

const ids = wanted.length === 0 || wanted.includes('all') ? Object.keys(PLANS) : wanted;
for (const id of ids) {
  const plan = PLANS[id];
  const recipe = RECIPES.find((r) => r.id === id);
  if (!plan || !recipe) fail(`no plan for recipe ${id}. Known: ${Object.keys(PLANS).join(', ')}`);
  const file = join(outDir, `${id}.json`);
  const previous = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { runs: [] };
  const versions = only ?? plan.versions;
  const runs = previous.runs.filter((r) => !versions.includes(r.version) || r.successorVersion);
  for (const v of versions) {
    const result = sweepOne(recipe, plan, v, undefined);
    console.log(
      `${result.pass ? 'FITS   ' : 'DIFFERS'} ${id} ${plan.pkg} ${v}: real ${result.real?.summary ?? result.why}; mutants ${result.mutants.map((m) => `${m.id} ${m.failed ? 'fail' : 'PASS'}`).join(', ')}${result.pass ? '' : ` -- ${result.why}`}`,
    );
    runs.push(result);
  }
  // The successor at its latest release, with the newest old version that fits.
  let successorRuns = previous.successorRuns ?? [];
  if (plan.successor && flag('successor') !== undefined) {
    successorRuns = [];
    const newest = [...runs]
      .filter((r) => !r.successorVersion && r.pass)
      .map((r) => r.version)
      .pop();
    const targets = [...new Set([plan.successor.pinned, plan.successor.latest])];
    for (const sv of targets) {
      const result = sweepOne(recipe, plan, newest, sv);
      console.log(
        `${result.pass ? 'FITS   ' : 'DIFFERS'} ${id} ${plan.pkg} ${newest} with ${plan.successor.pkg} ${sv}: real ${result.real?.summary ?? result.why}`,
      );
      successorRuns.push({ ...result, successorVersion: sv });
    }
  }
  const sortedRuns = runs.sort(
    (a, b) => plan.versions.indexOf(a.version) - plan.versions.indexOf(b.version),
  );
  const published =
    plan.ecosystem === 'npm' ? registryVersions(plan) : await pypiVersions(plan.pkg);
  const record = {
    recipe: id,
    package: plan.pkg,
    ecosystem: plan.ecosystem,
    checkedOn: new Date().toISOString().slice(0, 10),
    published,
    runs: sortedRuns,
    successor: plan.successor
      ? {
          package: plan.successor.pkg,
          pinned: plan.successor.pinned,
          latest: plan.successor.latest,
        }
      : undefined,
    successorRuns,
  };
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
}

// The reason a version does not fit, in plain words (the raw test output stays in the JSON records).
const PLAIN_WHY = {
  'is-odd': 'it throws a RangeError for a non-integer where the séance expects an Error.',
  querystring: 'its parse and stringify answer differently from the successor on the séance cases.',
  toml: 'it parses some documents differently from the successor on the séance cases.',
  pep8: 'its report differs from the successor on the séance cases.',
};
function plainWhy(recipe, raw) {
  if (raw && raw.startsWith('the run did not finish')) return raw;
  return PLAIN_WHY[recipe] ?? raw ?? 'the real run failed';
}

// --- src/seance/tested-versions.ts from every record ---------------------------------------------
const records = readdirSync(outDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(outDir, f), 'utf8')));
const table = {};
for (const r of records.sort((a, b) => a.recipe.localeCompare(b.recipe))) {
  const tested = r.runs.filter((x) => !x.successorVersion).map((x) => x.version);
  const pass = r.runs.filter((x) => x.pass && !x.successorVersion).map((x) => x.version);
  const fails = r.runs
    .filter((x) => !x.pass && !x.successorVersion)
    .map((x) => ({ version: x.version, why: plainWhy(r.recipe, x.why) }));
  const untested = (r.published ?? []).filter((v) => !tested.includes(v));
  const succPass = (r.successorRuns ?? []).filter((x) => x.pass).map((x) => x.successorVersion);
  table[r.recipe] = {
    package: r.package,
    ecosystem: r.ecosystem,
    checkedOn: r.checkedOn,
    pass,
    fail: fails,
    untested,
    ...(r.successor ? { successor: { package: r.successor.package, pass: succPass } } : {}),
  };
}
const header = [
  '// Written by scripts/run-seance-versions.mjs from test/fixtures/seance-versions/*.json. Do not edit.',
  '',
  'export interface TestedVersions {',
  '  /** The old package. */',
  '  package: string;',
  "  ecosystem: 'npm' | 'pypi';",
  '  /** The date of the runs. */',
  '  checkedOn: string;',
  '  /** Versions run for real where the real replacement passed and every mutant failed. */',
  '  pass: string[];',
  '  /** Versions run where it did not, with the reason. */',
  '  fail: Array<{ version: string; why: string }>;',
  '  /** Published versions that were not run. */',
  '  untested: string[];',
  '  /** The successor package and the versions run, when the successor is a package. */',
  '  successor?: { package: string; pass: string[] };',
  '}',
  '',
  `export const TESTED_VERSIONS: Record<string, TestedVersions> = ${JSON.stringify(table, null, 2)};`,
  '',
].join('\n');
writeFileSync(join(engineRoot, 'src', 'seance', 'tested-versions.ts'), header);
console.log(`wrote src/seance/tested-versions.ts (${Object.keys(table).join(', ')})`);
