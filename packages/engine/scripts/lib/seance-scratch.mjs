// The scratch folder of the séance runs, set up by the script itself, so run-seances.mjs works from a fresh
// clone and in CI. No path of one machine is held here.
//
//   <scratch>/js    a Node project with vitest, fast-check and the old and new packages (npm install)
//   <scratch>/.venv a Python virtual environment with pytest, hypothesis and the old and new packages (pip)
//
// The folder is, in this order: --scratch DIR, the environment variable NECROMANCER_SEANCE_SCRATCH, or a new
// temporary folder (removed at the end unless --keep). A folder that already has what is needed is reused and
// nothing is installed. The versions are the ones in the committed records (test/fixtures/seance-runs/*.json),
// so a fresh scratch runs the séances against the packages the records were made with.
//   NECROMANCER_PYTHON   the Python 3 that builds the virtual environment (default: python3)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const JS_PINS = {
  vitest: '5.1.0',
  'fast-check': '4.10.2',
  'left-pad': '1.3.0',
  querystring: '0.2.1',
  mkdirp: '1.0.4',
  'is-odd': '3.0.1',
};
export const PY_PINS = {
  pytest: '8.4.2',
  hypothesis: '6.141.1',
  toml: '0.10.2',
  tomli: '2.5.0',
  pep8: '1.7.1',
  pycodestyle: '2.14.0',
};

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    timeout: 900000,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  return { status: r.status, text: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim() };
}

const lastLines = (text, n = 3) => text.split('\n').slice(-n).join(' | ');

/** Which packages the Node project already has installed, with their versions. */
function installedJs(dir) {
  const found = {};
  for (const name of Object.keys(JS_PINS)) {
    const f = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(f)) found[name] = JSON.parse(readFileSync(f, 'utf8')).version;
  }
  return found;
}

/** Makes sure the Node project has every package. Returns { dir } or { error }. */
export function ensureJs(scratch) {
  const dir = join(scratch, 'js');
  mkdirSync(dir, { recursive: true });
  const have = installedJs(dir);
  const missing = Object.entries(JS_PINS).filter(
    ([name]) => !have[name] || !existsSync(join(dir, 'node_modules', '.bin', 'vitest')),
  );
  if (missing.length === 0) return { dir };
  if (!existsSync(join(dir, 'package.json'))) {
    writeFileSync(
      join(dir, 'package.json'),
      `${JSON.stringify({ name: 'necromancer-seance-scratch', version: '1.0.0', private: true, type: 'commonjs' }, null, 2)}\n`,
    );
  }
  const r = sh(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      '--loglevel=error',
      ...missing.map(([name, version]) => `${name}@${version}`),
    ],
    dir,
  );
  if (r.status !== 0) return { error: `npm install failed: ${lastLines(r.text)}` };
  return { dir };
}

/** Makes sure the virtual environment has every package. Returns { python } or { error }. */
export function ensurePython(scratch) {
  const venv = join(scratch, '.venv');
  const python = join(venv, 'bin', 'python');
  if (!existsSync(python)) {
    const base = process.env.NECROMANCER_PYTHON || 'python3';
    const made = sh(base, ['-m', 'venv', venv], scratch);
    if (made.status !== 0)
      return { error: `${base} -m venv failed: ${lastLines(made.text, 1) || 'no output'}` };
  }
  const listed = sh(
    python,
    ['-m', 'pip', 'list', '--format=json', '--disable-pip-version-check'],
    scratch,
  );
  let have = [];
  try {
    have = JSON.parse(listed.text);
  } catch {
    /* an empty list installs everything */
  }
  const missing = Object.entries(PY_PINS).filter(
    ([name]) => !have.some((p) => p.name.toLowerCase() === name),
  );
  if (missing.length === 0) return { python };
  const pip = sh(
    python,
    [
      '-m',
      'pip',
      'install',
      '--quiet',
      '--disable-pip-version-check',
      ...missing.map(([name, version]) => `${name}==${version}`),
    ],
    scratch,
  );
  if (pip.status !== 0) return { error: `pip install failed: ${lastLines(pip.text, 2)}` };
  return { python };
}

/**
 * The scratch folder for a run. `flagValue` is --scratch. Returns { dir, temporary, cleanup() }.
 * An existing folder given by the caller is never removed.
 */
export function openScratch(flagValue, { keep = false } = {}) {
  const given = flagValue ?? process.env.NECROMANCER_SEANCE_SCRATCH;
  if (given) {
    const dir = resolve(given);
    mkdirSync(dir, { recursive: true });
    return { dir, temporary: false, cleanup() {} };
  }
  const dir = mkdtempSync(join(tmpdir(), 'necromancer-seance-'));
  return {
    dir,
    temporary: true,
    cleanup() {
      if (!keep) rmSync(dir, { recursive: true, force: true });
    },
  };
}
