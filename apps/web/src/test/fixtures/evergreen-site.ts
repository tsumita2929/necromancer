import type { AutopsyReport } from '@contract';
import { diagnosis as d, ev, pkg, report, successor } from './build';

/** A small, healthy static site: five dependencies, one of them fading. */
export const evergreenSite: AutopsyReport = report({
  subject: 'github:fixtures/evergreen-site',
  manifests: [{ kind: 'package.json', path: 'package.json' }],
  diagnoses: [
    d(pkg('react', '^19.0.0', '19.0.0'), 'alive', { latest: { version: '19.2.0', date: '2025-10-01' } }),
    d(pkg('react-dom', '^19.0.0', '19.0.0'), 'alive', { latest: { version: '19.2.0', date: '2025-10-01' } }),
    d(pkg('vite', '^6.0.0', '6.0.1', { scope: 'dev' }), 'alive', { latest: { version: '7.1.12', date: '2025-10-22' } }),
    d(pkg('typescript', '^5.6.3', '5.6.3', { scope: 'dev' }), 'alive', { latest: { version: '5.9.3', date: '2025-09-30' } }),
    d(pkg('moment', '^2.30.1', '2.30.1'), 'dying', {
      evidence: [
        ev('legacy-status', 'The maintainers call the project legacy and in maintenance mode.', 'github', {
          url: 'https://momentjs.com/docs/#/-project-status/',
        }),
      ],
      successors: [
        successor('Intl.DateTimeFormat', 'native', 'Formats dates for any locale with no package.', 'curated', {
          url: 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat',
        }),
      ],
      latest: { version: '2.30.1', date: '2023-12-27' },
    }),
  ],
});
