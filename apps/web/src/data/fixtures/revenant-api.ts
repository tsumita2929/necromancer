import type { AutopsyReport } from '@contract';
import { diagnosis as d, ev, pkg, report, successor } from './build';

const NPM = 'https://www.npmjs.com/package/';
const OSV = 'https://osv.dev/vulnerability/';

/** An npm API service from the request-and-callbacks era. Has zombies, ghosts and a partial scan. */
export const revenantApi: AutopsyReport = report({
  subject: 'sample:revenant-api',
  manifests: [
    { kind: 'package-lock.json', path: 'package-lock.json' },
    { kind: 'package.json', path: 'package.json' },
    { kind: 'package.json', path: 'packages/worker/package.json' },
  ],
  problems: [
    {
      path: 'packages/worker/package.json',
      message: 'Line 14: the version of "queue-lite" is not a string, so the dependency was skipped.',
    },
  ],
  unavailable: [
    {
      source: 'scorecard',
      reason: 'The OpenSSF Scorecard lookup timed out after 8 seconds.',
    },
  ],
  diagnoses: [
    // Zombies
    d(pkg('request', '^2.88.0', '2.88.2'), 'zombie', {
      evidence: [
        ev(
          'osv-advisory',
          'A server-side request forgery advisory affects 2.88.2, and no patched version exists.',
          'osv',
          { url: OSV + 'GHSA-p8p7-x288-28g6' },
        ),
        ev(
          'npm-deprecated',
          'Deprecated on npm: "request has been deprecated, see request/request issue 3142".',
          'npm',
          { url: NPM + 'request', date: '2020-02-11' },
        ),
        ev('no-release', 'No release for more than 6 years.', 'npm', { date: '2020-02-11' }),
      ],
      advisories: ['GHSA-p8p7-x288-28g6'],
      successors: [
        successor('fetch', 'native', 'Node 18 and later ship a standard fetch. No package is needed.', 'curated', {
          url: 'https://nodejs.org/api/globals.html#fetch',
        }),
        successor('got', 'package', 'A maintained HTTP client with retries and streams.', 'module-replacements', {
          url: NPM + 'got',
        }),
        successor('undici', 'package', 'The HTTP client that powers Node fetch, with a request API close to request.', 'module-replacements', {
          url: NPM + 'undici',
        }),
      ],
      latest: { version: '2.88.2', date: '2020-02-11' },
    }),
    d(pkg('node-sass', '^4.14.1', '4.14.1', { scope: 'dev' }), 'zombie', {
      evidence: [
        ev(
          'osv-advisory',
          'An advisory about certificate validation affects 4.14.1.',
          'osv',
          { url: OSV + 'CVE-2020-24025' },
        ),
        ev(
          'npm-deprecated',
          'Deprecated on npm: "Node Sass is no longer supported. Please use sass or sass-embedded instead."',
          'npm',
          { url: NPM + 'node-sass' },
        ),
        ev('repo-archived', 'The source repository was archived by its owner.', 'github', {
          url: 'https://github.com/sass/node-sass',
        }),
      ],
      advisories: ['CVE-2020-24025'],
      successors: [
        successor('sass', 'package', 'The reference Sass compiler in pure JavaScript. Same language, no native build.', 'module-replacements', {
          url: NPM + 'sass',
        }),
      ],
      latest: { version: '9.0.0', date: '2023-11-08' },
    }),
    d(pkg('request-promise-native', '^1.0.9', '1.0.9'), 'zombie', {
      evidence: [
        ev(
          'osv-advisory',
          'It depends on request, which carries advisory GHSA-p8p7-x288-28g6.',
          'osv',
          { url: OSV + 'GHSA-p8p7-x288-28g6' },
        ),
        ev('npm-deprecated', 'Deprecated on npm: the request family is no longer supported.', 'npm', {
          url: NPM + 'request-promise-native',
        }),
      ],
      advisories: ['GHSA-p8p7-x288-28g6'],
      successors: [
        successor('fetch', 'native', 'fetch already returns promises. Remove the wrapper.', 'curated'),
        successor('got', 'package', 'Promise-first API with the same features.', 'module-replacements', {
          url: NPM + 'got',
        }),
      ],
    }),

    // Ghosts (names in this group are invented)
    d(pkg('kitchen-sink-logger', '~0.4.2', '0.4.2'), 'ghost', {
      evidence: [
        ev('repo-gone', 'The source repository answers 404. The code now lives only on the registry.', 'github'),
        ev('no-release', 'No release for more than 8 years.', 'npm', { date: '2018-03-14' }),
      ],
      successors: [
        successor('pino', 'package', 'A fast, structured logger with active maintenance.', 'curated', {
          url: NPM + 'pino',
        }),
        successor('kitchen-sink-logger', 'raise', 'Small enough to rebuild as a 60-line module the project owns.', 'curated'),
      ],
      latest: { version: '0.4.2', date: '2018-03-14' },
    }),
    d(pkg('mongoose-timestamps-plus', '^1.1.0', '1.1.0'), 'ghost', {
      evidence: [
        ev('repo-gone', 'The GitHub account that owned the repository no longer exists.', 'github'),
        ev('npm-yanked', 'The latest release was unpublished from the registry.', 'npm', { date: '2021-06-02' }),
      ],
    }),

    // Dead
    d(pkg('left-pad', '^1.3.0', '1.3.0'), 'dead', {
      evidence: [
        ev('npm-deprecated', 'Deprecated on npm: "use String.prototype.padStart()".', 'npm', {
          url: NPM + 'left-pad',
          date: '2024-01-11',
        }),
      ],
      successors: [
        successor('String.prototype.padStart', 'native', 'Built into every runtime since ES2017.', 'module-replacements', {
          url: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/padStart',
        }),
      ],
      latest: { version: '1.3.0', date: '2018-04-09' },
    }),
    d(pkg('node-uuid', '^1.4.8', '1.4.8'), 'dead', {
      evidence: [
        ev('npm-deprecated', 'Deprecated on npm: "Use uuid module instead".', 'npm', { url: NPM + 'node-uuid' }),
        ev('no-release', 'No release for more than 8 years.', 'npm', { date: '2016-09-28' }),
      ],
      successors: [
        successor('uuid', 'package', 'The package node-uuid was renamed to. Same API for v4.', 'module-replacements', {
          url: NPM + 'uuid',
        }),
        successor('crypto.randomUUID', 'native', 'Built into Node 14.17 and later.', 'curated', {
          url: 'https://nodejs.org/api/crypto.html#cryptorandomuuidoptions',
        }),
      ],
    }),
    d(pkg('babel-eslint', '^10.1.0', '10.1.0', { scope: 'dev' }), 'dead', {
      evidence: [
        ev('npm-deprecated', 'Deprecated on npm: "babel-eslint is now @babel/eslint-parser".', 'npm', {
          url: NPM + 'babel-eslint',
        }),
      ],
      successors: [
        successor('@babel/eslint-parser', 'package', 'The same parser under its new name.', 'module-replacements', {
          url: NPM + '@babel/eslint-parser',
        }),
      ],
    }),
    d(pkg('tslint', '^6.1.3', '6.1.3', { scope: 'dev' }), 'dead', {
      evidence: [
        ev('npm-deprecated', 'Deprecated on npm: "TSLint has been replaced by ESLint".', 'npm', {
          url: NPM + 'tslint',
        }),
        ev('repo-archived', 'The source repository is archived.', 'github', {
          url: 'https://github.com/palantir/tslint',
        }),
      ],
      successors: [
        successor('typescript-eslint', 'package', 'The supported way to lint TypeScript.', 'module-replacements', {
          url: NPM + 'typescript-eslint',
        }),
      ],
    }),
    d(pkg('querystring', '^0.2.1', '0.2.1'), 'dead', {
      evidence: [
        ev('npm-deprecated', 'Deprecated on npm: "The querystring API is considered Legacy".', 'npm', {
          url: NPM + 'querystring',
        }),
      ],
      successors: [
        successor('URLSearchParams', 'native', 'Built into browsers and Node.', 'module-replacements', {
          url: 'https://developer.mozilla.org/docs/Web/API/URLSearchParams',
        }),
      ],
    }),
    d(pkg('gulp-util', '^3.0.8', '3.0.8', { scope: 'dev' }), 'dead', {
      evidence: [
        ev('npm-deprecated', 'Deprecated on npm: "gulp-util is deprecated - replace it, following the guidelines".', 'npm', {
          url: NPM + 'gulp-util',
        }),
      ],
      successors: [
        successor('plugin-error', 'package', 'Replaces the PluginError class. Other helpers have single-purpose packages.', 'module-replacements', {
          url: NPM + 'plugin-error',
        }),
      ],
    }),
    d(pkg('istanbul', '^0.4.5', '0.4.5', { scope: 'dev' }), 'dead', {
      evidence: [
        ev('npm-deprecated', 'Deprecated on npm: "This module is no longer maintained, try this instead: nyc".', 'npm', {
          url: NPM + 'istanbul',
        }),
      ],
      successors: [
        successor('c8', 'package', 'Native V8 coverage with the Istanbul report format.', 'curated', { url: NPM + 'c8' }),
      ],
    }),
    d(pkg('coffee-script', '^1.12.7', '1.12.7', { scope: 'dev' }), 'dead', {
      evidence: [
        ev('npm-deprecated', 'Deprecated on npm: "CoffeeScript on NPM has moved to coffeescript (no hyphen)".', 'npm', {
          url: NPM + 'coffee-script',
        }),
      ],
      successors: [
        successor('coffeescript', 'package', 'The same compiler under its current name.', 'module-replacements', {
          url: NPM + 'coffeescript',
        }),
      ],
    }),
    d(pkg('core-js', '^2.6.12', '2.6.12', { direct: false }), 'dead', {
      evidence: [
        ev('npm-deprecated', 'Deprecated on npm: "core-js@<3.23.3 is no longer maintained and not recommended for usage".', 'npm', {
          url: NPM + 'core-js',
        }),
      ],
      successors: [
        successor('core-js', 'package', 'Upgrade to the 3.x line. It is the same package, and it is maintained.', 'curated', {
          url: NPM + 'core-js',
        }),
      ],
    }),
    d(pkg('bower', '^1.8.14', '1.8.14', { scope: 'dev' }), 'dead', {
      evidence: [
        ev('npm-deprecated', 'Deprecated on npm: "We don\'t recommend using Bower for new projects".', 'npm', {
          url: NPM + 'bower',
        }),
      ],
    }),

    // Dying
    d(pkg('moment', '^2.29.4', '2.29.4'), 'dying', {
      evidence: [
        ev('legacy-status', 'The maintainers call the project legacy and in maintenance mode.', 'github', {
          url: 'https://momentjs.com/docs/#/-project-status/',
        }),
        ev('no-release', 'No release for more than 1 year.', 'npm', { date: '2023-12-27' }),
      ],
      successors: [
        successor('date-fns', 'package', 'Modular, immutable date helpers that tree-shake.', 'module-replacements', {
          url: NPM + 'date-fns',
        }),
      ],
      latest: { version: '2.30.1', date: '2023-12-27' },
    }),
    d(pkg('lodash', '^4.17.21', '4.17.21'), 'dying', {
      evidence: [ev('no-release', 'No release for more than 5 years.', 'npm', { date: '2021-02-20' })],
      latest: { version: '4.17.21', date: '2021-02-20' },
    }),
    d(pkg('express-validator-extras', '^2.0.3', '2.0.3'), 'dying', {
      evidence: [
        ev('low-maintenance', 'The OpenSSF Scorecard maintained check scores 0 out of 10.', 'scorecard'),
        ev('single-maintainer', 'One maintainer holds every publish right.', 'npm'),
      ],
    }),

    // Alive
    d(pkg('express', '^4.21.2', '4.21.2'), 'alive', { latest: { version: '5.1.0', date: '2025-03-31' } }),
    d(pkg('pino', '^9.5.0', '9.5.0'), 'alive', { latest: { version: '9.14.0', date: '2025-10-01' } }),
    d(pkg('zod', '^3.23.8', '3.23.8'), 'alive', { latest: { version: '4.1.0', date: '2025-08-22' } }),
    d(pkg('dotenv', '^16.4.5', '16.4.5'), 'alive', { latest: { version: '17.2.0', date: '2025-07-09' } }),
    d(pkg('helmet', '^8.0.0', '8.0.0'), 'alive', { latest: { version: '8.1.0', date: '2025-03-20' } }),
    d(pkg('typescript', '^5.6.3', '5.6.3', { scope: 'dev' }), 'alive', { latest: { version: '5.9.3', date: '2025-09-30' } }),
    d(pkg('vitest', '^2.1.4', '2.1.4', { scope: 'dev' }), 'alive', { latest: { version: '3.2.4', date: '2025-06-17' } }),
    d(pkg('prettier', '^3.3.3', '3.3.3', { scope: 'dev' }), 'alive', { latest: { version: '3.6.2', date: '2025-06-23' } }),
    d(pkg('@types/node', '^22.9.0', '22.9.0', { scope: 'dev' }), 'alive', { latest: { version: '24.9.1', date: '2025-10-20' } }),
  ],
});
