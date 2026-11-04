#!/usr/bin/env python3
"""Static policy check for .github/workflows/*.yml. Exit 0 when every rule holds.

Rules: top-level permissions are exactly contents: read; pages: write and id-token:
write appear only on the deploy job of pages.yml; every `uses:` is pinned to a 40-hex
commit SHA with a version comment; no `secrets.` anywhere; no pull_request_target; CI
runs on push and pull_request; Pages runs only on push to main.
"""
import glob, re, sys, yaml

bad = []
def fail(msg): bad.append(msg); print('FAIL', msg)
def ok(msg): print('ok  ', msg)

for path in sorted(glob.glob('.github/workflows/*.yml')):
    text = open(path).read()
    doc = yaml.safe_load(text)
    on = doc.get('on', doc.get(True))
    name = path.split('/')[-1]
    if doc.get('permissions') != {'contents': 'read'}: fail(f'{name}: top-level permissions is {doc.get("permissions")}')
    else: ok(f'{name}: top-level permissions = contents: read')
    for jid, job in doc['jobs'].items():
        perms = job.get('permissions') or {}
        elevated = {k for k, v in perms.items() if v == 'write'}
        if elevated and not (name == 'pages.yml' and jid == 'deploy'): fail(f'{name}:{jid} has write permission {elevated}')
        if name == 'pages.yml' and jid == 'deploy':
            if perms != {'pages': 'write', 'id-token': 'write'}: fail(f'{name}:deploy permissions {perms}')
            else: ok(f'{name}:deploy permissions = pages: write, id-token: write (only job with write)')
    for m in re.finditer(r'^\s*-?\s*uses:\s*(\S+)(.*)$', text, re.M):
        ref, tail = m.group(1), m.group(2)
        if not re.fullmatch(r'[\w.-]+/[\w./-]+@[0-9a-f]{40}', ref) or not re.search(r'#\s*v\d', tail): fail(f'{name}: unpinned or uncommented action {ref}')
        else: ok(f'{name}: {ref.split("@")[0]} pinned {ref.split("@")[1][:10]}{tail.strip()}')
    if 'secrets.' in text: fail(f'{name}: uses secrets')
    if 'pull_request_target' in str(on): fail(f'{name}: pull_request_target')
    if name == 'ci.yml':
        (ok if set(on) == {'push', 'pull_request'} else fail)(f'ci.yml triggers {sorted(on)}')
    if name == 'pages.yml':
        (ok if on == {'push': {'branches': ['main']}} else fail)(f'pages.yml triggers {on}')
sys.exit(1 if bad else 0)
