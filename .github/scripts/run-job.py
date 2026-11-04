#!/usr/bin/env python3
"""Run the `run:` steps of one workflow job, verbatim, inside a clone.

usage: python3 .github/scripts/run-job.py <clone> <workflow.yml> <job> [--node-bin DIR] [--env K=V ...] [--matrix K=V ...]
--matrix sets one value of the job's strategy.matrix, e.g. --matrix python=3.12 (`${{ matrix.python }}` is replaced).
Set CI_LOG_DIR to keep one log file per step.
Step env is applied (${{ runner.temp }} becomes a new temporary folder; RUNNER_TEMP is set). Deviation: `--with-deps` is dropped from `playwright install` (no sudo here).
Stops at the first failing step, like Actions. Prints one result line per step.
"""
import os, subprocess, sys, tempfile, time, yaml

args = sys.argv[1:]
clone, wf, job = args[:3]
rest = args[3:]
node_bin = None
extra = {}
matrix = {}
i = 0
while i < len(rest):
    if rest[i] == '--node-bin':
        node_bin = rest[i + 1]; i += 2
    elif rest[i] == '--matrix':
        k, v = rest[i + 1].split('=', 1); matrix[k] = v; i += 2
    elif rest[i] == '--env':
        k, v = rest[i + 1].split('=', 1); extra[k] = v; i += 2
    else:
        raise SystemExit('bad arg ' + rest[i])

doc = yaml.safe_load(open(os.path.join(clone, '.github/workflows', wf)))
j = doc['jobs'][job]
env = dict(os.environ)
env['CI'] = 'true'
env.update({k: str(v) for k, v in (doc.get('env') or {}).items() if '${{' not in str(v)})
env.update({k: str(v) for k, v in (j.get('env') or {}).items() if '${{' not in str(v)})
# The runner's temporary folder: a new one for every run unless RUNNER_TEMP is already set.
env.setdefault('RUNNER_TEMP', tempfile.mkdtemp(prefix='runner-temp.'))
env['GITHUB_WORKSPACE'] = os.path.abspath(clone)


def expand(text):
    for k, v in matrix.items():
        text = text.replace('${{ matrix.%s }}' % k, v)
    return text.replace('${{ runner.temp }}', env['RUNNER_TEMP'])

if node_bin:
    env['PATH'] = node_bin + os.pathsep + env['PATH']
wd = ((j.get('defaults') or {}).get('run') or {}).get('working-directory', '.')
status = 0
for n, step in enumerate(j['steps'], 1):
    if 'run' not in step:
        print(f"[{n}] SKIP  uses: {step['uses'].split('@')[0]}")
        continue
    cmd = expand(step['run']).strip()
    if 'playwright install' in cmd:
        cmd = cmd.replace(' --with-deps', '')
    cwd = os.path.join(clone, step.get('working-directory', wd))
    # Step-level env: ${{ runner.temp }} is the only expression handled; other expressions are skipped.
    step_env = dict(env)
    for k, v in (step.get('env') or {}).items():
        v = expand(str(v))
        if '${{' not in v:
            step_env[k] = v
    step_env.update(extra)  # --env wins over the workflow, as a deliberate break for a test
    t = time.time()
    p = subprocess.run(['bash', '-eo', 'pipefail', '-c', cmd], cwd=cwd, env=step_env,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    out = p.stdout.strip().splitlines()
    open(os.path.join(os.environ.get('CI_LOG_DIR', '/tmp'), f'{job}-{n}.log'), 'w').write(p.stdout)
    tail = ' | '.join(l.strip() for l in out[-3:])[:260]
    shown = cmd.splitlines()[0] + (' ...' if len(cmd.splitlines()) > 1 else '')
    print(f"[{n}] exit={p.returncode} {time.time()-t:5.1f}s  $ {shown}  ::  {tail}")
    if p.returncode:
        status = p.returncode
        break
print(f"JOB {job}: {'PASS' if status == 0 else 'FAIL (exit %d)' % status}")
sys.exit(status)
