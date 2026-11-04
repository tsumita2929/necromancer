#!/usr/bin/env node
// Checks the standalone Crew app repository the way a judge would meet it: in a fresh temporary directory
// with nothing around it, from a `git clone` of the export (so only committed files exist).
//
//   node scripts/verify-export.mjs [path-to-export]      (default: ../necromancer-crew-app next to this repository)
//
// Prints one line per check (PASS / FAIL / SKIP, with the result line) and exits 1 on any FAIL.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scriptDir = import.meta.dirname;
const mainRoot = execFileSync('git', ['-C', scriptDir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const exportDir = path.resolve(process.argv[2] ?? path.join(path.dirname(mainRoot), 'necromancer-crew-app'));
if (!existsSync(path.join(exportDir, '.git'))) {
  console.error(`No repository at ${exportDir}`);
  process.exit(2);
}

let failures = 0;
const report = (status, name, detail = '') => {
  if (status === 'FAIL') failures++;
  console.log(`${status.padEnd(4)} ${name}${detail ? ': ' + detail : ''}`);
};
const sh = (cmd, args, cwd, env = {}) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 1 << 28 });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};
const last = (text, re) => (text.split('\n').filter((l) => re.test(l.replace(/\x1b\[[0-9;]*m/g, ''))).pop() ?? '').replace(/\x1b\[[0-9;]*m/g, '').trim();
const git = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

// ---- a fresh copy with nothing around it --------------------------------------------------------------
const tmp = mkdtempSync(path.join(os.tmpdir(), 'necro-verify-'));
const V = path.join(tmp, 'necromancer-crew-app');
sh('git', ['clone', '-q', exportDir, V], tmp);
console.log(`Fresh clone: ${V}  (HEAD ${git(V, ['rev-parse', '--short', 'HEAD'])}, node ${process.version}, ${process.platform})`);

// ---- the repository itself -------------------------------------------------------------------------------
{
  const tracked = git(V, ['ls-files']).split('\n');
  const nm = tracked.filter((f) => f.split('/').includes('node_modules'));
  report(nm.length === 0 ? 'PASS' : 'FAIL', 'no node_modules tracked', `${tracked.length} tracked files`);
  const rootApp = tracked.includes('app.json');
  report(rootApp ? 'PASS' : 'FAIL', 'app.json at the repository root');

  const dates = git(V, ['log', '--format=%aI %cI']).split('\n').flatMap((l) => l.split(' '));
  const min = dates.map((d) => new Date(d).getTime()).reduce((a, b) => Math.min(a, b), Infinity);
  const count = git(V, ['rev-list', '--count', 'HEAD']);
  report(min >= Date.parse('2026-10-30T00:00:00Z') ? 'PASS' : 'FAIL', 'git log has no date before 2026-10-30', `${count} commits, earliest ${new Date(min).toISOString()}`);

  const pathMatches = (treeish) => {
    const r = sh('git', ['-C', V, 'grep', '-I', '-l', '-F', '/home/ec2-user', treeish], V);
    return r.status === 0 ? r.out.trim().split('\n') : [];
  };
  const commits = git(V, ['rev-list', 'HEAD']).split('\n');
  const hostHits = commits.flatMap((c) => pathMatches(c).map((m) => m.replace(/^[0-9a-f]{40}:/, `${c.slice(0, 8)}:`)));
  report(hostHits.length === 0 ? 'PASS' : 'FAIL', 'no /home/ec2-user in any commit', hostHits.length ? hostHits.slice(0, 5).join(', ') : `${commits.length} commits searched`);

  const SECRET = 'AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{32,}|(api[_-]?key|secret|token|passwd|password)[\'"]?\\s*[:=]\\s*[\'"][A-Za-z0-9+/_-]{12,}[\'"]';
  // A made-up HMAC key in an early version of the backend test (replaced later by 'fixture-hmac-key-0001'): not a secret.
  const KNOWN_FIXTURES = ['s3cret-for-test'];
  const allHits = commits.flatMap((c) => {
    const r = sh('git', ['-C', V, 'grep', '-I', '-n', '-i', '-E', SECRET, c], V);
    return r.status === 0 ? r.out.trim().split('\n') : [];
  });
  const secretHits = allHits.filter((l) => !KNOWN_FIXTURES.some((f) => l.includes(f)));
  const allowed = allHits.length - secretHits.length;
  report(secretHits.length === 0 ? 'PASS' : 'FAIL', 'no secret patterns in any commit', secretHits.length ? secretHits[0].slice(0, 160) : `${commits.length} commits searched${allowed ? `; ${allowed} line(s) match a known made-up test key in history only` : ''}`);
  const headHits = sh('git', ['-C', V, 'grep', '-I', '-n', '-i', '-E', SECRET, 'HEAD'], V);
  report(headHits.status !== 0 ? 'PASS' : 'FAIL', 'no secret patterns in the current tree', headHits.status !== 0 ? 'none' : headHits.out.slice(0, 160));

  const envFiles = tracked.filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.example'));
  report(envFiles.length === 0 ? 'PASS' : 'FAIL', 'no .env files tracked', envFiles.join(', '));
}

// ---- the manifest and the files it names -------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(path.join(V, 'app.json'), 'utf8'));
{
  const need = [];
  for (const a of manifest.agents ?? []) need.push(a);
  for (const s of manifest.skills ?? []) need.push(path.join(s, 'SKILL.md'));
  if (manifest.iconPath) need.push(manifest.iconPath);
  if (manifest.backend?.entryPoint) need.push(manifest.backend.entryPoint);
  if (manifest.ui?.entry) need.push(path.join('ui', manifest.ui.entry));
  for (const server of Object.values(manifest.mcpServers ?? {})) {
    for (const a of server.args ?? []) if (/\.py$/.test(a)) need.push(a);
  }
  need.push('dist/server.mjs');
  const missing = need.filter((p) => !existsSync(path.join(V, p)));
  report(missing.length === 0 ? 'PASS' : 'FAIL', 'every file app.json names exists', missing.length ? `missing ${missing.join(', ')}` : `${need.length} paths`);

  const ui = path.join(V, 'ui/dist/index.mjs');
  const uiSize = existsSync(ui) ? statSync(ui).size : 0;
  const icon = path.join(V, manifest.iconPath ?? 'assets/icon.png');
  let iconInfo = 'missing';
  if (existsSync(icon)) {
    const b = readFileSync(icon);
    const png = b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    iconInfo = png ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)} PNG` : 'not a PNG';
  }
  report(uiSize > 1000 && iconInfo === '512x512 PNG' ? 'PASS' : 'FAIL', 'UI page assets present', `ui/dist/index.mjs ${uiSize} bytes, icon ${iconInfo}`);
  const bundle = path.join(V, 'dist/server.mjs');
  const text = existsSync(bundle) ? readFileSync(bundle, 'utf8') : '';
  report(text.includes('createEngine') && !/from ['"]@necromancer\/engine['"]/.test(text) ? 'PASS' : 'FAIL', 'dist/server.mjs has the engine bundled in', `${Math.round(text.length / 1024)} KiB, no import of @necromancer/engine`);
}

// ---- the platform's manifest validator ---------------------------------------------------------------------
{
  let python = process.env.KIROCREW_PYTHON ?? '';
  if (!python) {
    const which = sh('sh', ['-c', 'command -v kirocrew'], V);
    const bin = which.out.trim().split('\n')[0];
    if (bin && existsSync(bin)) {
      const first = readFileSync(bin, 'utf8').split('\n')[0];
      if (first.startsWith('#!')) python = first.slice(2).trim().split(/\s+/)[0];
    }
  }
  if (!python) {
    report('SKIP', "platform manifest validator", 'no kirocrew found (set KIROCREW_PYTHON to its Python)');
  } else {
    const code = [
      'import json,sys,pathlib',
      'from kiro_crew.apps.manifest import AppManifest, cron_permission_error',
      'root=pathlib.Path(sys.argv[1]); m=AppManifest.from_dict(json.load(open(root/"app.json")))',
      'print(json.dumps({"errors":m.validate(root),"cron":cron_permission_error(m)}))',
    ].join('\n');
    const r = sh(python, ['-c', code, V], tmp);
    let parsed;
    try {
      parsed = JSON.parse(r.out.trim().split('\n').pop());
    } catch { /* leave undefined */ }
    report(parsed && parsed.errors.length === 0 && parsed.cron === '' ? 'PASS' : 'FAIL', 'platform manifest validator on app.json', parsed ? `validate: ${JSON.stringify(parsed.errors)}, cron_permission_error: '${parsed.cron}'` : r.out.slice(-200));
  }
}

// ---- install tooling, tests, smoke, reproducible bundles ----------------------------------------------------------
{
  const ci = sh('npm', ['ci', '--no-audit', '--no-fund'], V);
  const ciUi = sh('npm', ['--prefix', 'ui', 'ci', '--no-audit', '--no-fund'], V);
  report(ci.status === 0 && ciUi.status === 0 ? 'PASS' : 'FAIL', 'npm ci (root and ui) from the committed lockfiles', last(ci.out, /added \d+ packages/) || ci.out.slice(-160));
  if (ci.status === 0) {
    const tsc = sh('npm', ['run', 'typecheck'], V);
    report(tsc.status === 0 ? 'PASS' : 'FAIL', 'tsc --noEmit', tsc.status === 0 ? 'exit 0' : tsc.out.slice(-300));
    const test = sh('npm', ['test'], V);
    report(test.status === 0 ? 'PASS' : 'FAIL', 'shipped tests (vitest)', `${last(test.out, /Test Files/)} / ${last(test.out, /^\s*Tests /)}`);
    const smoke = sh('npm', ['run', 'smoke'], V);
    report(smoke.status === 0 ? 'PASS' : 'FAIL', 'smoke test (mcp/launch.py over stdio)', `${last(smoke.out, /SMOKE tools\/list/).slice(0, 60)} ... ${last(smoke.out, /SMOKE (OK|FAILED)/)}`);
    const rebuilt = sh('npm', ['run', 'bundle'], V);
    const drift = git(V, ['status', '--porcelain']);
    report(rebuilt.status === 0 && drift === '' ? 'PASS' : 'FAIL', 'npm run bundle reproduces the committed dist/ files', drift === '' ? 'git status clean after rebuilding' : `changed: ${drift.replace(/\n/g, ', ')}`);
  }
}

// ---- the MCP server answers all 10 tools on the haunted app (scripts/mcp-call.mjs -> mcp/launch.py) ----------------
{
  const haunted = path.join(V, 'examples/haunted-app');
  const data = mkdtempSync(path.join(os.tmpdir(), 'necro-data-'));
  const env = { NECROMANCER_DATA_DIR: data, NECROMANCER_BLOCK_HOSTS: 'api.github.com' };
  const call = (tool, argsObj) => sh(process.execPath, [path.join(V, 'scripts/mcp-call.mjs'), tool, JSON.stringify(argsObj)], V, env);
  const listed = sh(process.execPath, [path.join(V, 'scripts/mcp-call.mjs'), '--list'], V, env);
  const names = listed.out.split('\n').map((l) => l.split(':')[0]).filter((n) => /^[a-z_]+$/.test(n));
  report(names.length === 10 ? 'PASS' : 'FAIL', 'MCP server lists its tools', `${names.length}: ${names.join(', ')}`);
  const dep = { ecosystem: 'npm', name: 'left-pad' };
  const steps = [
    ['autopsy', { path: haunted }],
    ['diagnose', { dependencies: [{ ...dep, spec: '1.3.0' }] }],
    ['successors', dep],
    ['resurrection_spec', { ...dep, path: haunted }],
    ['seance', { ...dep, path: haunted }],
    ['watch_add', { path: haunted }],
    ['watch_list', {}],
    ['nightwatch_run', {}],
    ['graveyard', {}],
    ['watch_remove', { id: haunted }],
  ];
  let id = '';
  for (const [tool, a] of steps) {
    const args2 = tool === 'watch_remove' ? { id } : a;
    const r = call(tool, args2);
    let body;
    try {
      body = JSON.parse(r.out);
    } catch { /* not JSON */ }
    if (tool === 'watch_add' && body?.id) id = body.id;
    const engineOk = body && (body.engine === 'engine' || body.engine === undefined);
    const detail = body
      ? [body.engine ? `engine=${body.engine}` : '', tool === 'successors' ? `first=${body.successors?.[0]?.name}` : '', tool === 'seance' ? `recipe=${body.recipe} template=${body.template} files=${body.files?.length}` : '', tool === 'nightwatch_run' ? `projects=${body.projects?.length} notifications=${body.notifications?.length}` : '', tool === 'autopsy' ? `summary=${JSON.stringify(body.report?.summary)}` : '', tool === 'graveyard' ? `projects=${body.projects?.length}` : '', tool === 'watch_remove' ? `removed=${body.removed}` : ''].filter(Boolean).join(' ')
      : r.out.slice(0, 160);
    report(r.status === 0 && engineOk ? 'PASS' : 'FAIL', `tool ${tool}`, detail);
  }
}

console.log(failures === 0 ? 'VERIFY OK' : `VERIFY FAILED: ${failures} check(s)`);
process.exit(failures === 0 ? 0 : 1);
