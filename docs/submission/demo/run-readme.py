#!/usr/bin/env python3
"""Run every ```sh block of README.md (and docs/submission/*.md where marked) in a clone.

usage: python3 docs/submission/demo/run-readme.py <clone> <markdown file relative to clone>   (for example README.md)
Each block runs with bash -e from the clone root. A block preceded by an HTML comment
`<!-- no-run: reason -->` is listed but not run. Prints one result line per block.
"""
import os, re, subprocess, sys, time

clone, md = sys.argv[1:3]
text = open(os.path.join(clone, md), encoding='utf8').read()
pat = re.compile(r'(<!-- no-run: ([^>]*)-->\s*\n)?```(sh|bash)\n(.*?)```', re.S)
env = dict(os.environ)
fails = 0
for n, m in enumerate(pat.finditer(text), 1):
    body = m.group(4)
    first = body.strip().splitlines()[0]
    if m.group(1):
        print(f'[{n}] SKIP ({m.group(2).strip()})  {first}')
        continue
    t = time.time()
    p = subprocess.run(['bash', '-e', '-c', body], cwd=clone, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    out = p.stdout.strip().splitlines()
    tail = ' | '.join(l.strip() for l in out[-2:])[:200]
    plain = re.sub(r'\x1b\[[0-9;]*m', '', p.stdout)
    counts = ''
    npass = len(re.findall(r'^PASS', plain, re.M))
    if npass:
        counts += f' PASS lines={npass} FAIL lines={len(re.findall(r"^FAIL", plain, re.M))}'
    for found in re.finditer(r'Tests\s+(?:\d+ failed \| )?(\d+) passed', plain):
        counts += f' vitest tests={found.group(1)}'
    print(f'[{n}] exit={p.returncode} {time.time()-t:5.1f}s{counts}  {first}  ::  {tail}')
    if p.returncode:
        fails += 1
print('FAILED BLOCKS:', fails)
sys.exit(1 if fails else 0)
