import type { AutopsyReport } from '@contract';
import { diagnosis as d, ev, pkg, report, successor } from './build';

const PYPI = 'https://pypi.org/project/';
const py = (name: string, spec: string, resolved: string | undefined, scope: 'main' | 'dev' = 'main') =>
  pkg(name, spec, resolved, { ecosystem: 'pypi', scope });
const pySuccessor = (name: string, kind: 'package' | 'native' | 'raise', reason: string, url?: string) =>
  successor(name, kind, reason, kind === 'native' ? 'curated' : 'pypi', {
    ecosystem: 'pypi',
    ...(url !== undefined ? { url } : {}),
  });

/** A Python data pipeline pinned in 2017 and never revisited. Lockfile-pinned, PyPI only. */
export const pyFossil: AutopsyReport = report({
  subject: 'sample:py-fossil',
  manifests: [
    { kind: 'requirements.txt', path: 'requirements.txt' },
    { kind: 'requirements.txt', path: 'requirements-dev.txt' },
  ],
  diagnoses: [
    d(py('pycrypto', '==2.6.1', '2.6.1'), 'zombie', {
      evidence: [
        ev(
          'osv-advisory',
          'A heap buffer overflow in ALGnew affects 2.6.1. It was never fixed in this package.',
          'osv',
          { url: 'https://osv.dev/vulnerability/CVE-2013-7459' },
        ),
        ev('no-release', 'No release for more than 12 years.', 'pypi', {
          url: PYPI + 'pycrypto/',
          date: '2013-10-17',
        }),
        ev('unmaintained-notice', 'The project description says it is no longer maintained.', 'pypi'),
      ],
      advisories: ['CVE-2013-7459'],
      successors: [
        pySuccessor('pycryptodome', 'package', 'A maintained fork that keeps the Crypto namespace. Imports stay the same.', PYPI + 'pycryptodome/'),
        pySuccessor('cryptography', 'package', 'The package the Python community recommends for new code.', PYPI + 'cryptography/'),
      ],
      latest: { version: '2.6.1', date: '2013-10-17' },
    }),
    d(py('fabric3-compat', '==1.14.2', '1.14.2'), 'ghost', {
      evidence: [
        ev('repo-gone', 'The source repository answers 404.', 'github'),
        ev('no-release', 'No release for more than 5 years.', 'pypi', { date: '2020-11-03' }),
      ],
    }),
    d(py('nose', '==1.3.7', '1.3.7', 'dev'), 'dead', {
      evidence: [
        ev('unmaintained-notice', 'Nose has been in maintenance mode for years and fails on Python 3.10 and later.', 'pypi', {
          url: PYPI + 'nose/',
        }),
        ev('no-release', 'No release for more than 10 years.', 'pypi', { date: '2015-06-02' }),
      ],
      successors: [
        pySuccessor('pytest', 'package', 'Runs nose-style tests with little change and has a large plugin set.', PYPI + 'pytest/'),
      ],
      latest: { version: '1.3.7', date: '2015-06-02' },
    }),
    d(py('flask-script', '==2.0.6', '2.0.6'), 'dead', {
      evidence: [
        ev('unmaintained-notice', 'The Flask documentation says Flask-Script is no longer needed.', 'pypi', {
          url: PYPI + 'Flask-Script/',
        }),
        ev('no-release', 'No release for more than 8 years.', 'pypi', { date: '2017-03-09' }),
      ],
      successors: [
        pySuccessor('flask.cli', 'native', 'Flask ships a command line interface built on click.', 'https://flask.palletsprojects.com/en/stable/cli/'),
      ],
    }),
    d(py('boto', '==2.49.0', '2.49.0'), 'dead', {
      evidence: [
        ev('unmaintained-notice', 'Boto has been replaced by boto3, and the project says so.', 'pypi', {
          url: PYPI + 'boto/',
        }),
      ],
      successors: [pySuccessor('boto3', 'package', 'The supported AWS SDK for Python.', PYPI + 'boto3/')],
    }),
    d(py('distribute', '==0.7.3', '0.7.3'), 'dead', {
      evidence: [ev('merged-upstream', 'Distribute was merged back into setuptools in 2013.', 'pypi')],
      successors: [pySuccessor('setuptools', 'package', 'Where the code lives now.', PYPI + 'setuptools/')],
    }),
    d(py('mock', '==3.0.5', '3.0.5', 'dev'), 'dying', {
      evidence: [
        ev('superseded-by-stdlib', 'The standard library has had unittest.mock since Python 3.3.', 'curated'),
      ],
      successors: [
        pySuccessor('unittest.mock', 'native', 'Same API, no install.', 'https://docs.python.org/3/library/unittest.mock.html'),
      ],
    }),
    d(py('python-jose', '==3.3.0', '3.3.0'), 'dying', {
      evidence: [
        ev('osv-advisory-fixed', 'Two advisories were published for 3.3.0 and fixed in a later release.', 'osv', {
          url: 'https://osv.dev/vulnerability/CVE-2024-33663',
        }),
        ev('low-maintenance', 'Releases are rare and issues sit unanswered.', 'github'),
      ],
      successors: [pySuccessor('pyjwt', 'package', 'Actively maintained JWT library.', PYPI + 'pyjwt/')],
    }),
    d(py('six', '==1.16.0', '1.16.0'), 'dying', {
      evidence: [ev('no-release', 'No release for more than 3 years. The package still works.', 'pypi', { date: '2021-05-05' })],
      latest: { version: '1.17.0', date: '2024-12-04' },
    }),
    d(py('requests', '==2.32.3', '2.32.3'), 'alive', { latest: { version: '2.32.5', date: '2025-08-18' } }),
    d(py('numpy', '==2.1.3', '2.1.3'), 'alive', { latest: { version: '2.3.4', date: '2025-10-15' } }),
    d(py('pandas', '==2.2.3', '2.2.3'), 'alive', { latest: { version: '2.3.3', date: '2025-09-29' } }),
    d(py('flask', '==3.0.3', '3.0.3'), 'alive', { latest: { version: '3.1.2', date: '2025-08-19' } }),
    d(py('sqlalchemy', '==2.0.36', '2.0.36'), 'alive', { latest: { version: '2.0.44', date: '2025-10-10' } }),
    d(py('pytest-cov', '==5.0.0', '5.0.0', 'dev'), 'alive', { latest: { version: '7.0.0', date: '2025-09-09' } }),
    d(py('ruff', '==0.7.2', '0.7.2', 'dev'), 'alive', { latest: { version: '0.14.2', date: '2025-10-23' } }),
  ],
});
