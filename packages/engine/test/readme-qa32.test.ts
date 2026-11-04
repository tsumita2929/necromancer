/**
 * QA-32: the README rule must not make a living package dead on a sentence of the wrong shape. The 21 heads below
 * are QA's probe (`scratch/qa5/scripts/readme-probe.mjs`), word for word: 9 were false flags and must not flag,
 * 9 were correct non-flags and stay, 3 are real statements and stay flagged. Then the nearby cases of each shape.
 */
import { describe, expect, it } from 'vitest';
import { findMaintainerStatement } from '../src/sources/readme.js';

const NAMES = ['foo', 'lodash.get'];
const find = (text: string, names: string[] = NAMES) => findMaintainerStatement(text, names);

type Head = [label: string, text: string, flagged: boolean];

const HEADS: Head[] = [
  // The 9 false flags of QA-32: no flag any more.
  [
    'quoted complaint',
    '# foo\n\nSome people say "this project is deprecated". It is not; see the roadmap.\n',
    false,
  ],
  [
    'platform',
    '# foo\n\nThis tool is no longer supported on macOS 10.12. Everything else works.\n',
    false,
  ],
  [
    'one mode',
    '# foo\n\nThis library is deprecated for use with Webpack 4. Use foo@2 with Webpack 5.\n',
    false,
  ],
  [
    'maintained elsewhere',
    '# foo\n\nThis package is no longer maintained here. Development continues in the foo-next repository, which is the same package at v3.\n',
    false,
  ],
  ['lowercase banner', '# foo\n\nDeprecated: use the --new flag instead of --old.\n', false],
  ['banner for a flag', 'DEPRECATED: the `--old` flag.\n\n# foo\n\nA tool.\n', false],
  [
    'name is deprecated (flag)',
    '# foo\n\nfoo is deprecated on Windows 7. Use Windows 10.\n',
    false,
  ],
  ['negation after', '# foo\n\nThis project is deprecated, just kidding, it is not.\n', false],
  [
    'maintainers wanted far away',
    '# foo\n\nThis project is unmaintained.\n\n' +
      'x '.repeat(300) +
      '\n\nWe are looking for maintainers.\n',
    false,
  ],
  // The 9 correct non-flags: they stay.
  [
    'FAQ: is it dead?',
    '# foo\n\nQ: Is this project deprecated?\nA: No. It is alive and released monthly.\n',
    false,
  ],
  [
    'one sub-module',
    '# foo\n\nThis module is deprecated since 3.0, use the new `parse` export.\n',
    false,
  ],
  [
    'community took over',
    '# foo\n\nThis project is no longer maintained by Acme Inc. It is now maintained by the community.\n',
    false,
  ],
  [
    'legacy wording',
    '# foo\n\nfoo is a legacy project, now in maintenance mode. We fix bugs and security issues.\n',
    false,
  ],
  [
    'changelog in README',
    '# foo\n\n## Changes\n\nv1.0: this library is deprecated in favour of the v2 API below; v2 is what you are reading.\n',
    false,
  ],
  ['LOUD banner not about project', 'DEPRECATED OPTIONS\n\n# foo\n\nA tool.\n', false],
  ['name is deprecated (typing)', '# foo\n\nfoo --old is deprecated.\n', false],
  [
    'conditional',
    '# foo\n\nIf you are reading this, this project is deprecated and you should upgrade the plugin host.\n',
    false,
  ],
  ['other project', '# foo\n\nThis package replaces bar. bar is deprecated.\n', false],
  // The 3 real statements: they stay flagged.
  [
    'Name with dots',
    '# lodash.get\n\nlodash.get is deprecated in favor of optional chaining in the language, but lodash itself is alive.\n',
    true,
  ],
  ['truly dead', '# foo\n\nThis package is deprecated. Use bar instead.\n', true],
  ['truly dead, caps', '# foo\n\nTHIS PROJECT IS NO LONGER MAINTAINED.\n', true],
];

describe('S1 the 21 heads of QA-32', () => {
  it('S1.0 there are 21: 3 flagged, 18 not', () => {
    expect(HEADS).toHaveLength(21);
    expect(HEADS.filter((h) => h[2])).toHaveLength(3);
  });
  for (const [label, text, flagged] of HEADS) {
    it(`S1 ${label}: ${flagged ? 'flagged' : 'not flagged'}`, () => {
      const r = find(text);
      if (flagged) expect(r, label).toBeDefined();
      else expect(r?.sentence, label).toBeUndefined();
    });
  }
});

describe('S2 a banner about a flag, an option or a function', () => {
  it('S2.1 not the project', () => {
    for (const t of [
      'DEPRECATED: the --ignorePattern flag. Use --ignore.',
      'Deprecated: use the --new flag instead of --old.',
      'DEPRECATED: the `timeout` option.',
      'Deprecated: the parse() function, use read().',
      'Deprecated: this method. Use the new API instead.',
    ])
      expect(find(`${t}\n\n# foo\n\nA tool.\n`), t).toBeUndefined();
  });
  it('S2.2 a banner about the project stays', () => {
    for (const t of [
      'DEPRECATED. Use bar instead.',
      'Deprecated: use bar instead',
      'DEPRECATED in favor of https://example.org/new',
      'Deprecated - use bar, this package was merged into it.',
      'No longer maintained',
    ])
      expect(find(`${t}\n\n# foo\n\nA tool.\n`), t)?.toBeDefined();
  });
});

describe('S3 a narrowing qualifier after the statement', () => {
  it('S3.1 a platform, a tool, a version, a place', () => {
    for (const t of [
      'This library is deprecated for use with Webpack 4.',
      'This library is deprecated for Node 12.',
      'This tool is no longer supported on macOS 10.12.',
      'This package is no longer supported on Windows.',
      'This project is no longer maintained on Python 2.',
      'This package is deprecated in v3.',
      'This package is deprecated with React 16.',
      'This plugin is deprecated when used with Vue 2.',
      'foo is deprecated on Windows 7.',
      'This package is no longer maintained here.',
      'This project is no longer maintained in this repository.',
      'This package is deprecated under this name.',
      'This package is deprecated, except for security fixes.',
      'This project is unmaintained unless you use Linux.',
    ])
      expect(find(`# foo\n\n${t}\n`), t).toBeUndefined();
  });
  it('S3.2 a reason or a way out is not a narrowing', () => {
    for (const t of [
      'This package is deprecated in favor of bar.',
      'This package is deprecated in favour of the bar package.',
      'This package is deprecated for security reasons.',
      'This project is deprecated as bar now does the same.',
      'This package is deprecated and will not be updated for Node 22.',
      'This project is no longer maintained since 2019.',
      'This package is deprecated. For Webpack 5 see bar.',
    ])
      expect(find(`# foo\n\n${t}\n`), t)?.toBeDefined();
  });
});

describe('S4 quoted, reported or retracted', () => {
  it('S4.1 quoted or said by someone else', () => {
    for (const t of [
      'Some people say "this project is deprecated". It is not.',
      'People keep saying this project is deprecated. It is not.',
      'A user wrote: "this package is no longer maintained". That is wrong.',
      'We heard that this library is abandoned. Not true.',
      'It is a myth that this project is unmaintained.',
      '\u201cThis project is deprecated\u201d, they said.',
    ])
      expect(find(`# foo\n\n${t}\n`), t).toBeUndefined();
  });
  it('S4.2 taken back in the same or the next sentence', () => {
    for (const t of [
      'This project is deprecated, just kidding, it is not.',
      'This project is deprecated. Just kidding!',
      'This package is deprecated. April Fools.',
      'This library is unmaintained. It is not, we are still maintained and releasing.',
      'This repo is no longer maintained. False alarm: it is actively maintained.',
      'This package is deprecated, but it is still maintained.',
      'This project is abandoned. That is not the case.',
    ])
      expect(find(`# foo\n\n${t}\n`), t).toBeUndefined();
  });
  it('S4.3 a sentence that only looks like a retraction keeps the flag', () => {
    for (const t of [
      'This project is deprecated. It is not maintained anymore.',
      'This package is deprecated. It is not compatible with Node 22 and will not be.',
      'This library is no longer maintained. This is not a drill.',
      'This package is deprecated. Use bar, which is still maintained.',
    ])
      expect(find(`# foo\n\n${t}\n`), t)?.toBeDefined();
  });
});

describe('S5 a move of the same package is a move, not a death', () => {
  it('S5.1 development goes on elsewhere', () => {
    for (const t of [
      'This package is no longer maintained here. Development continues in the foo-next repository, which is the same package at v3.',
      'This repo is no longer maintained. Development continues at github.com/acme/foo.',
      'This project is deprecated. Maintenance has moved to acme/foo, the same project.',
      'This library is unmaintained. The project continues under a new name.',
    ])
      expect(find(`# foo\n\n${t}\n`), t).toBeUndefined();
  });
  it('S5.2 another package, or a fork by others, keeps the flag', () => {
    for (const t of [
      'This repo is no longer maintained.\n\nSee the docs. As of this writing, coveralls-next is the recommended fork of this original integration.',
      'This package is deprecated. Use bar instead.',
      'This project is unmaintained. Several forks exist; bar is the most active.',
    ])
      expect(find(`# foo\n\n${t}\n`), t)?.toBeDefined();
  });
});

describe('S6 a request for maintainers anywhere in the head', () => {
  const far = 'x '.repeat(300);
  it('S6.1 far from the statement', () => {
    for (const ask of [
      'We are looking for maintainers.',
      'Looking for new maintainers!',
      'Maintainers wanted.',
      'This project is up for adoption.',
      'We are seeking a co-maintainer.',
      'The project needs a new maintainer.',
    ])
      expect(
        find(`# foo\n\nThis project is unmaintained.\n\n${far}\n\n${ask}\n`),
        ask,
      ).toBeUndefined();
  });
  it('S6.2 the same head without the request still flags', () => {
    expect(find(`# foo\n\nThis project is unmaintained.\n\n${far}\n`)).toBeDefined();
  });
  it('S6.3 "new maintainers" of a fork, or thanks to maintainers, is not a request', () => {
    expect(
      find('# foo\n\nThis repo is no longer maintained. The fork has its own maintainers.\n'),
    ).toBeDefined();
    expect(
      find('# foo\n\nThis package is deprecated. Our maintainers moved on to bar.\n'),
    ).toBeDefined();
  });
});

describe('S7 the corpus statements all stay flagged', () => {
  const kept: Array<[string, string, string[]]> = [
    [
      'coveralls',
      '# IMPORTANT\n\n:no_entry_sign: This repo is no longer maintained. \n\nSee [Coveralls Docs](https://docs.coveralls.io/).\n',
      ['coveralls', 'node-coveralls'],
    ],
    [
      'karma',
      '# Karma\n\n## Karma is deprecated and is not accepting new features or general bug fixes.\n',
      ['karma'],
    ],
    [
      'style-loader',
      '# style-loader\n\n> **`style-loader` is deprecated** \u2014 webpack injects CSS into the DOM itself and no longer needs it.\n',
      ['style-loader'],
    ],
    [
      'html-webpack-plugin',
      '# html-webpack-plugin\n\nhtml-webpack-plugin is deprecated \u2014 webpack scaffolds the HTML around your bundles itself and no longer needs it.\n',
      ['html-webpack-plugin'],
    ],
    [
      'mkdocs-material-extensions',
      'NOTE: This project is now deprecated as MkDocs for Material now implements this logic directly.\n',
      ['mkdocs-material-extensions'],
    ],
    [
      'dotenv',
      'THIS LIBRARY IS NO LONGER SUPPORTED, USE theskumer/python-dotenv INSTEAD.\n',
      ['dotenv'],
    ],
    [
      'pytest-dotenv',
      '# Discontinued\n\nThis project is not maintained any longer - sorry for any inconvenience this might cause.\n',
      ['pytest-dotenv'],
    ],
    [
      'eslint-plugin-node',
      'This project has been no longer maintained. Please consider to use https://github.com/eslint-community/eslint-plugin-n.\n',
      ['eslint-plugin-node'],
    ],
    [
      'wdio-geckodriver-service',
      'DEPRECATION WARNING: This service got deprecated and is no longer maintained.\n',
      ['wdio-geckodriver-service'],
    ],
    ['codecov', 'This uploader is being deprecated by the Codecov team.\n', ['codecov']],
    ['recommonmark', 'Warning: recommonmark is now deprecated.\n', ['recommonmark']],
    [
      'node-loader',
      'DEPRECATED in favor of https://github.com/webpack/webpack/tree/main/examples/nodejs-addons\n',
      ['node-loader'],
    ],
    [
      'appdirs',
      'Note: This project has been officially deprecated. You may want to check out https://pypi.org/project/platformdirs/ which is a more active fork of appdirs.\n',
      ['appdirs'],
    ],
    [
      'css-minimizer-webpack-plugin',
      'DEPRECATED.\n\n# css-minimizer-webpack-plugin\n',
      ['css-minimizer-webpack-plugin'],
    ],
    ['compression-webpack-plugin', 'This plugin is deprecated.\n', ['compression-webpack-plugin']],
    [
      'image-minimizer-webpack-plugin',
      '# image-minimizer-webpack-plugin\n\n> [!IMPORTANT]\n>\n> **This plugin is deprecated.** Its work continues in\n> [`minimizer-webpack-plugin`](https://github.com/webpack/minimizer-webpack-plugin),\n> which minimizes and generates every asset type. It is maintained by the same people.\n>\n> This plugin still works and still gets security fixes, but new features land in `minimizer-webpack-plugin` only.\n',
      ['image-minimizer-webpack-plugin'],
    ],
    ['@idealyst/cli', 'This project is no longer maintained\n', ['@idealyst/cli']],
    [
      'oxc-plugin-react-compiler',
      'This repo is no longer maintained.\n',
      ['oxc-plugin-react-compiler'],
    ],
  ];
  for (const [label, text, names] of kept)
    it(`S7 ${label}`, () => {
      expect(findMaintainerStatement(text, names), label).toBeDefined();
    });
});
