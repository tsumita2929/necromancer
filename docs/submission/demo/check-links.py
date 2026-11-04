#!/usr/bin/env python3
"""Check every relative markdown link and every backticked repository path in the given files.

usage: python3 docs/submission/demo/check-links.py <clone> <markdown file>...   (file paths relative to the clone)

A backticked name counts as a repository path when it starts with a top-level folder of the repository
(apps/, packages/, docs/, .kiro/, .github/, demo/) or is a top-level file (README.md, LICENSE). Other
backticked names (package.json inside a user's project, a command, a package name) are not paths.
"""
import os
import re
import sys

clone = sys.argv[1]
ROOTS = ('apps/', 'packages/', 'docs/', '.kiro/', '.github/', 'demo/')
TOP = {'README.md', 'LICENSE'}
bad = 0
total = 0
for md in sys.argv[2:]:
    full = os.path.join(clone, md)
    text = open(full, encoding='utf8').read()
    base = os.path.dirname(full)
    for target in re.findall(r'\[[^\]]*\]\(([^)\s]+)\)', text):
        if re.match(r'(https?:|mailto:|#)', target):
            continue
        total += 1
        path = os.path.normpath(os.path.join(base, target.split('#')[0]))
        if not os.path.exists(path):
            bad += 1
            print('BROKEN LINK', md, target)
    for name in re.findall(r'`([^`\n]+)`', text):
        if ' ' in name or not re.match(r'^[./\w@-][\w./@-]*$', name):
            continue
        rel = name.lstrip('/')
        if not (rel.startswith(ROOTS) or rel in TOP):
            continue
        if '*' in rel or '<' in rel:
            continue
        total += 1
        if not os.path.exists(os.path.join(clone, rel)):
            bad += 1
            print('MISSING PATH', md, name)
print(f'checked {total} references, {bad} not found')
sys.exit(1 if bad else 0)
