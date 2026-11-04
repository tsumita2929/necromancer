#!/usr/bin/env node
// Writes the Necromancer Kiro Crew app as a standalone git repository.
//
//   node scripts/export-repo.mjs [--target DIR] [--repo-url URL] [--main-url URL]
//                                [--head-only] [--skip-verify] [--keep-temp]
//   (or: npm run export -- --repo-url https://github.com/you/necromancer-crew-app --main-url https://github.com/you/necromancer)
//
// One command, safe to run again. What it does:
//   1. Refuses when the exported paths have uncommitted changes (the export is a function of the committed
//      state of this repository: HEAD). --head-only exports the committed state anyway and says so.
//   2. Assembles the app at the root of a temporary directory: apps/crew, the engine source as vendor/engine,
//      the haunted demo as examples/haunted-app, the crew specs, the hooks (paths rewritten), steering,
//      README, LICENSE, a portable lockfile.
//   3. Builds it there from a clean `npm ci`, so the committed dist/ is exactly what the sources give,
//      and takes dist/server.mjs (engine bundled in) and ui/dist/index.mjs.
//   4. Creates the repository: the history of apps/crew replayed commit by commit (original authors, dates,
//      messages; evidence and export tooling left out), then one commit with everything else.
//   5. Replaces the target only if the result differs (same input gives the same commit ids), keeping its remotes.
//   6. Runs scripts/verify-export.mjs on the result (unless --skip-verify).
//
// Never pushes, never adds a remote, never changes git configuration of this repository.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const scriptDir = import.meta.dirname;
const appDir = path.dirname(scriptDir);

function die(message, code = 1) {
  console.error(`EXPORT FAILED: ${message}`);
  process.exit(code);
}

// ---- arguments -----------------------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = { target: '', repoUrl: '', mainUrl: '', headOnly: false, skipVerify: false, keepTemp: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--target') opt.target = args[++i] ?? '';
  else if (a === '--repo-url') opt.repoUrl = args[++i] ?? '';
  else if (a === '--main-url') opt.mainUrl = args[++i] ?? '';
  else if (a === '--head-only') opt.headOnly = true;
  else if (a === '--skip-verify') opt.skipVerify = true;
  else if (a === '--keep-temp') opt.keepTemp = true;
  else if (a === '--help' || a === '-h') {
    console.log(
      readFileSync(import.meta.filename, 'utf8')
        .split('\n')
        .slice(1, 22)
        .map((l) => l.replace(/^\/\/ ?/, ''))
        .join('\n'),
    );
    process.exit(0);
  } else die(`Unknown argument: ${a}`);
}

function git(cwd, gitArgs, { env = {}, input, trim = true } = {}) {
  const out = execFileSync('git', ['-C', cwd, ...gitArgs], {
    encoding: 'utf8',
    maxBuffer: 1 << 30,
    env: { ...process.env, ...env },
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return trim ? out.trim() : out;
}

function run(cmd, cmdArgs, cwd) {
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit' });
  if (r.status !== 0) die(`\`${cmd} ${cmdArgs.join(' ')}\` failed in ${cwd} (exit ${r.status})`);
}

const root = git(appDir, ['rev-parse', '--show-toplevel']);
const target = path.resolve(opt.target || path.join(path.dirname(root), 'necromancer-crew-app'));
if (target === root || target.startsWith(root + path.sep)) die('The target must be outside the main repository.');
const REPO_URL = opt.repoUrl || 'https://github.com/OWNER/necromancer-crew-app';
const MAIN_URL = opt.mainUrl || 'https://github.com/OWNER/necromancer';
const placeholders = !opt.repoUrl || !opt.mainUrl;

// ---- what is exported, and is it committed -----------------------------------------------------------
const hookFiles = git(root, ['ls-tree', '--name-only', 'HEAD', '.kiro/hooks/'])
  .split('\n')
  .filter((f) => /\/crew-[^/]*\.kiro\.hook$/.test(f));
const SPECS = ['crew-app', 'crew-live', 'crew-seance'].map((s) => `.kiro/specs/${s}`);
const OWN_PATHS = ['apps/crew', 'demo/haunted-app', ...SPECS, ...hookFiles, 'LICENSE'];
const ENGINE_PATHS = ['packages/engine/src', 'packages/engine/package.json'];
const dirty = git(root, ['status', '--porcelain', '--', ...OWN_PATHS]);
if (dirty && !opt.headOnly) {
  console.error('Uncommitted changes in exported paths:\n' + dirty);
  die('Commit them first (the export is built from HEAD), or pass --head-only to export the committed state anyway.', 2);
}
if (dirty) console.warn('WARNING: --head-only: these uncommitted changes are NOT in the export:\n' + dirty);
const dirtyEngine = git(root, ['status', '--porcelain', '--', ...ENGINE_PATHS]);
if (dirtyEngine) console.warn('NOTE: the engine has uncommitted changes; the export uses the committed engine:\n' + dirtyEngine);

const sourceCommit = git(root, ['log', '-1', '--format=%H', '--', ...OWN_PATHS, ...ENGINE_PATHS]);
const sourceDate = git(root, ['log', '-1', '--format=%cI', sourceCommit]);
const engineCommit = git(root, ['log', '-1', '--format=%h', '--', ...ENGINE_PATHS]);
console.log(`Export of ${root} HEAD ${git(root, ['rev-parse', '--short', 'HEAD'])}; last source commit ${sourceCommit.slice(0, 10)} (${sourceDate}); engine ${engineCommit}`);

// ---- helpers -----------------------------------------------------------------------------------------
function archiveTo(treeish, dest, paths = []) {
  mkdirSync(dest, { recursive: true });
  const tar = execFileSync('git', ['-C', root, 'archive', '--format=tar', treeish, ...paths], { maxBuffer: 1 << 30 });
  const r = spawnSync('tar', ['-x', '-C', dest], { input: tar, stdio: ['pipe', 'inherit', 'inherit'] });
  if (r.status !== 0) die(`tar failed extracting ${treeish}`);
}
const show = (p) => git(root, ['show', `HEAD:${p}`], { trim: false });
const rm = (p) => rmSync(p, { recursive: true, force: true });
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const subst = (text, map) => Object.entries(map).reduce((t, [k, v]) => t.split(`{{${k}}}`).join(v), text);
const vars = { REPO_URL, MAIN_URL, SOURCE_COMMIT: sourceCommit.slice(0, 10), SOURCE_DATE: sourceDate.slice(0, 10) };

// ---- 1. assemble ---------------------------------------------------------------------------------------
const A = mkdtempSync(path.join(os.tmpdir(), 'necro-export-a-'));
archiveTo('HEAD:apps/crew', A);
for (const p of ['evidence', 'scripts/export-repo.mjs', 'scripts/verify-export.mjs', 'scripts/export-templates', '.gitignore']) {
  rm(path.join(A, p));
}

// the engine, source only
archiveTo('HEAD:packages/engine', path.join(A, 'vendor/engine'), ['src']);
const enginePkg = JSON.parse(show('packages/engine/package.json'));
writeJson(path.join(A, 'vendor/engine/package.json'), {
  name: enginePkg.name,
  version: enginePkg.version,
  private: true,
  type: 'module',
  license: 'MIT',
  description: 'Copy of the Necromancer verdict engine source, bundled into dist/server.mjs. Origin: packages/engine of the main repository.',
  exports: { '.': { types: './src/index.ts', default: './src/index.ts' } },
});

// the demo project the tests and the examples use
archiveTo('HEAD:demo/haunted-app', path.join(A, 'examples/haunted-app'));
rm(path.join(A, 'examples/haunted-app/resurrection'));
const hauntedReadme = path.join(A, 'examples/haunted-app/README.md');
writeFileSync(hauntedReadme, readFileSync(hauntedReadme, 'utf8').split('(../../README.md)').join(`(${MAIN_URL})`));

// specs, hooks, steering
for (const spec of SPECS) archiveTo(`HEAD:${spec}`, path.join(A, spec));
mkdirSync(path.join(A, '.kiro/hooks'), { recursive: true });
const rewrite = (s) => s.split('apps/crew/').join('').split('in apps/crew').join('at the repository root').split('apps/crew').join('the repository root');
for (const file of hookFiles) {
  const hook = JSON.parse(show(file));
  if (hook.when?.patterns) hook.when.patterns = hook.when.patterns.map(rewrite);
  if (hook.then?.prompt) hook.then.prompt = rewrite(hook.then.prompt);
  writeJson(path.join(A, '.kiro/hooks', path.basename(file)), hook);
}
mkdirSync(path.join(A, '.kiro/steering'), { recursive: true });
writeFileSync(path.join(A, '.kiro/steering/crew-app.md'), readFileSync(path.join(scriptDir, 'export-templates/steering-crew-app.md'), 'utf8'));

// licence, readme, ignore file, registry index
writeFileSync(path.join(A, 'LICENSE'), show('LICENSE'));
writeFileSync(path.join(A, 'README.md'), subst(readFileSync(path.join(scriptDir, 'export-templates/README.md'), 'utf8'), vars));
writeFileSync(path.join(A, '.gitignore'), readFileSync(path.join(scriptDir, 'export-templates/gitignore'), 'utf8'));
writeJson(path.join(A, 'app-registry.json'), [{ name: 'necromancer', gitUrl: `${REPO_URL}.git`, branch: 'main' }]);

// package.json and the lockfile: the engine is a vendored copy, and there is no `build` script for a platform install to run
const pkg = readJson(path.join(A, 'package.json'));
pkg.name = 'necromancer-crew-app';
pkg.description = 'Necromancer: a Kiro Crew app (Graveyard page, Night Watch job, Necromancer agent, resurrection skill, MCP server).';
pkg.devDependencies['@necromancer/engine'] = 'file:vendor/engine';
delete pkg.scripts.build;
pkg.repository = { type: 'git', url: `${REPO_URL}.git` };
pkg.homepage = REPO_URL;
writeJson(path.join(A, 'package.json'), pkg);
const lock = readJson(path.join(A, 'package-lock.json'));
lock.name = pkg.name;
lock.packages[''].name = pkg.name;
lock.packages[''].devDependencies['@necromancer/engine'] = 'file:vendor/engine';
const engineKey = '../../packages/engine';
if (!lock.packages[engineKey]) die('The lockfile has no entry for the engine; cannot make it portable.');
lock.packages['vendor/engine'] = { name: enginePkg.name, version: enginePkg.version, dev: true, license: 'MIT' };
delete lock.packages[engineKey];
lock.packages['node_modules/@necromancer/engine'] = { resolved: 'vendor/engine', link: true };
writeJson(path.join(A, 'package-lock.json'), lock);

// ---- 2. build from a clean install ---------------------------------------------------------------------
const B = mkdtempSync(path.join(os.tmpdir(), 'necro-export-b-'));
cpSync(A, B, { recursive: true });
console.log('Building in a clean copy (npm ci, bundle) ...');
run('npm', ['ci', '--no-audit', '--no-fund'], B);
run('npm', ['--prefix', 'ui', 'ci', '--no-audit', '--no-fund'], B);
run('npm', ['run', 'bundle'], B);
for (const f of ['dist/server.mjs', 'ui/dist/index.mjs']) {
  if (!existsSync(path.join(B, f))) die(`The build did not produce ${f}`);
  mkdirSync(path.dirname(path.join(A, f)), { recursive: true });
  cpSync(path.join(B, f), path.join(A, f));
}

// ---- 3. the repository ---------------------------------------------------------------------------------
const T = `${target}.tmp-${process.pid}`;
rm(T);
mkdirSync(T, { recursive: true });
git(T, ['init', '-q', '-b', 'main']);
git(T, ['config', 'necromancer.export', 'true']);
git(T, ['config', 'commit.gpgsign', 'false']);
const commonDir = path.resolve(root, git(root, ['rev-parse', '--git-common-dir']));
writeFileSync(path.join(T, '.git/objects/info/alternates'), path.join(commonDir, 'objects') + '\n');

const EXCLUDE_IN_HISTORY = ['evidence', 'scripts/export-repo.mjs', 'scripts/verify-export.mjs', 'scripts/export-templates'];
const idx = path.join(T, '.git/replay-index');
let parent = '';
let lastTree = '';
let replayed = 0;
const commits = git(root, ['log', '--reverse', '--format=%H', '--', 'apps/crew']).split('\n').filter(Boolean);
for (const c of commits) {
  const meta = git(root, ['log', '-1', '--format=%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%B', c], { trim: false }).split('\0');
  const [an, ae, ad, cn, ce, cd] = meta;
  const message = (meta[6] ?? '').trimEnd() + '\n';
  const env = { GIT_INDEX_FILE: idx };
  rm(idx);
  git(T, ['read-tree', `${c}:apps/crew`], { env });
  git(T, ['rm', '-r', '-q', '--cached', '--ignore-unmatch', '--', ...EXCLUDE_IN_HISTORY], { env });
  const tree = git(T, ['write-tree'], { env });
  if (tree === lastTree) continue; // only excluded files changed
  const commitEnv = { GIT_AUTHOR_NAME: an, GIT_AUTHOR_EMAIL: ae, GIT_AUTHOR_DATE: ad, GIT_COMMITTER_NAME: cn, GIT_COMMITTER_EMAIL: ce, GIT_COMMITTER_DATE: cd };
  parent = git(T, ['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-F', '-'], { env: commitEnv, input: message });
  lastTree = tree;
  replayed++;
}
rm(idx);
if (!parent) die('No history to replay.');

// the last commit: everything else, on top
cpSync(A, T, { recursive: true });
git(T, ['add', '-A']);
const finalTree = git(T, ['write-tree']);
const finalMessage =
  'Standalone export of the Crew app\n\n' +
  'Adds what a standalone repository needs on top of the replayed history of apps/crew: the built output\n' +
  '(dist/server.mjs with the engine bundled, ui/dist/index.mjs), vendor/engine (engine source), examples/haunted-app,\n' +
  'README, LICENSE, .kiro (specs, hooks, steering), app-registry.json and a portable lockfile.\n\n' +
  `Source: main repository commit ${sourceCommit} (${sourceDate}); engine last changed in ${engineCommit}.\n`;
const finalEnv = {
  GIT_AUTHOR_NAME: 'Kiro Crew (agent)',
  GIT_AUTHOR_EMAIL: 'agent@kiro-crew.invalid',
  GIT_AUTHOR_DATE: sourceDate,
  GIT_COMMITTER_NAME: 'Kiro Crew (agent)',
  GIT_COMMITTER_EMAIL: 'agent@kiro-crew.invalid',
  GIT_COMMITTER_DATE: sourceDate,
};
const head = git(T, ['commit-tree', finalTree, '-p', parent, '-F', '-'], { env: finalEnv, input: finalMessage });
git(T, ['update-ref', 'refs/heads/main', head]);
git(T, ['reset', '-q', '--hard', 'main']);
// make it standalone: pack the borrowed objects, drop the alternates, check
git(T, ['repack', '-a', '-d', '-q']);
rmSync(path.join(T, '.git/objects/info/alternates'), { force: true });
git(T, ['fsck', '--strict', '--no-dangling']);
if (git(T, ['status', '--porcelain'])) die('The new repository is not clean after the export (internal error).');

// ---- 4. put it in place --------------------------------------------------------------------------------
let outcome = 'created';
if (existsSync(target)) {
  let ours = '';
  try {
    ours = git(target, ['config', '--get', 'necromancer.export']);
  } catch { /* not ours */ }
  if (ours !== 'true') {
    rm(T);
    die(`${target} exists and is not a repository made by this script; not touching it.`, 3);
  }
  if (git(target, ['status', '--porcelain'])) {
    rm(T);
    die(`${target} has local changes; not replacing it. Commit or discard them, then run again.`, 3);
  }
  const oldHead = git(target, ['rev-parse', 'HEAD']);
  if (oldHead === head) {
    rm(T);
    outcome = 'unchanged';
  } else {
    const keep = [];
    for (const re of ['^remote\\.', '^branch\\.']) {
      try {
        git(target, ['config', '--local', '--get-regexp', re]).split('\n').filter(Boolean).forEach((l) => keep.push(l));
      } catch { /* none */ }
    }
    rm(target);
    renameSync(T, target);
    for (const line of keep) {
      const i = line.indexOf(' ');
      git(target, ['config', '--local', line.slice(0, i), line.slice(i + 1)]);
    }
    outcome = `updated (was ${oldHead.slice(0, 10)})`;
    if (keep.some((l) => l.startsWith('remote.'))) {
      console.warn('NOTE: the target has a remote. The top commit was rebuilt; if the previous export was already pushed, push with `git push --force-with-lease`.');
    }
  }
} else {
  renameSync(T, target);
}
if (!opt.keepTemp) {
  rm(A);
  rm(B);
}

const count = git(target, ['rev-list', '--count', 'HEAD']);
const files = git(target, ['ls-files']).split('\n').length;
console.log(`EXPORT ${outcome.toUpperCase()}: ${target}`);
console.log(`  HEAD ${git(target, ['rev-parse', 'HEAD'])}  commits ${count} (${replayed} replayed + 1 export)  tracked files ${files}`);
if (placeholders) {
  console.warn('WARNING: --repo-url and/or --main-url not given; the README and app-registry.json carry OWNER placeholders. Run again with both URLs before pushing.');
}

// ---- 5. verify -----------------------------------------------------------------------------------------
if (!opt.skipVerify) {
  const r = spawnSync(process.execPath, [path.join(scriptDir, 'verify-export.mjs'), target], { stdio: 'inherit' });
  if (r.status !== 0) die('verify-export reported a failure.', 4);
}
