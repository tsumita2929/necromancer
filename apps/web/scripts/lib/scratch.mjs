// A scratch directory for running the downloaded séance tests, set up by the script itself so it can run
// in CI or from a fresh clone. Nothing here refers to a path on one machine.
//
//   NECRO_SCRATCH   where to work (default: <tmp>/necromancer-web-seance). Reused between runs.
//   NECRO_PYTHON    the Python 3 to build the virtual environment with (default: python3).
//
// JavaScript: a folder with vitest, fast-check, left-pad, is-odd and mkdirp 3.0.1 (the version josdejong/mathjs uses) installed with npm.
// Python: a virtual environment with pytest, hypothesis, toml, tomli, pep8 and pycodestyle. When Python
// or the network is not available the Python séances are skipped with a clear line; the rest still run.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function scratchDir() {
  return process.env.NECRO_SCRATCH || join(tmpdir(), 'necromancer-web-seance');
}

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 900000, env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', CI: '1' } });
  return { status: r.status, text: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const JS_PACKAGES = ['vitest@^5.1.0', 'fast-check@^4.10.2', 'left-pad@^1.3.0', 'is-odd@^3.0.1', 'mkdirp@3.0.1'];
const PY_PACKAGES = ['pytest', 'hypothesis', 'toml', 'tomli', 'pep8', 'pycodestyle'];

/** The JavaScript project folder, installed once. Returns { dir } or { error }. */
export function ensureJavaScript() {
  const dir = join(scratchDir(), 'js');
  const marker = join(dir, '.necromancer-ready');
  if (existsSync(marker) && existsSync(join(dir, 'node_modules', '.bin', 'vitest')) && existsSync(join(dir, 'node_modules', 'mkdirp'))) return { dir };
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'necromancer-seance-scratch', version: '1.0.0', private: true, type: 'commonjs' }, null, 2));
  const install = sh('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...JS_PACKAGES], dir);
  if (install.status !== 0) return { error: `npm install failed: ${install.text.trim().split('\n').slice(-2).join(' ')}` };
  writeFileSync(marker, 'ok\n');
  return { dir };
}

/** The Python virtual environment, built once. Returns { python, dir } or { error }. */
export function ensurePython() {
  const root = scratchDir();
  const venv = join(root, '.venv');
  const python = join(venv, 'bin', 'python');
  const marker = join(venv, '.necromancer-ready');
  const dir = join(root, 'py');
  if (existsSync(marker) && existsSync(python)) {
    mkdirSync(dir, { recursive: true });
    return { python, dir };
  }
  mkdirSync(root, { recursive: true });
  const base = process.env.NECRO_PYTHON || 'python3';
  const made = sh(base, ['-m', 'venv', venv], root);
  if (made.status !== 0) return { error: `${base} -m venv failed: ${made.text.trim().split('\n').slice(-1)[0] ?? 'no output'}` };
  const pip = sh(python, ['-m', 'pip', 'install', '--quiet', '--disable-pip-version-check', ...PY_PACKAGES], root);
  if (pip.status !== 0) return { error: `pip install failed: ${pip.text.trim().split('\n').slice(-1)[0] ?? 'no output'}` };
  writeFileSync(marker, 'ok\n');
  mkdirSync(dir, { recursive: true });
  return { python, dir };
}
