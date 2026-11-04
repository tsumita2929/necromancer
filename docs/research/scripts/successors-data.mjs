// Researched ways out for the dead-or-worse packages of the graveyard census (part 1: npm, multi-project and zombies,
// stubs and moves; part 2: the rest). Read by successors-build.mjs.
// Shape of a successor = packages/engine/src/types.ts `Successor`: { name, ecosystem, kind, reason, source, url? }.
//   source 'npm' | 'pypi'            : the registry's own deprecation message or record
//   source 'module-replacements'    : the e18e module-replacements dataset
//   source 'curated'                : an official migration guide, README notice or the successor's own docs (url says which)
// Each entry: [ecosystem, name, { how, note, conf, ways, none, notDead, finished }]
//   how  : deprecation-message | readme-notice | migration-guide | e18e | successor-docs | registry-record | none-found
//   conf : high | medium | low
//   ways : successors, best first
//   none : why no way out is known (when ways is empty)
//   notDead  : primary evidence that the package may not be dead after all (for the tuning item)
//   finished : true when it is a small stable package where "dead" may be unfair (known gap 1)

const N = 'npm';
const P = 'pypi';
const pkg = (eco, name, reason, url, source = 'curated') => ({ name, ecosystem: eco, kind: 'package', reason, source, ...(url ? { url } : {}) });
const nat = (eco, name, reason, url, source = 'curated') => ({ name, ecosystem: eco, kind: 'native', reason, source, ...(url ? { url } : {}) });
const raise = (eco, name, reason, url, source = 'curated') => ({ name, ecosystem: eco, kind: 'raise', reason, source, ...(url ? { url } : {}) });
const npmPage = (n) => `https://www.npmjs.com/package/${n}`;
const pypiPage = (n) => `https://pypi.org/project/${n}/`;

const stub = (lib) => ({
  how: 'deprecation-message',
  conf: 'high',
  note: `The @types stub is deprecated on npm because ${lib} ships its own types.`,
  ways: [
    pkg(N, lib, `${lib} ships its own type definitions. Delete the @types stub from devDependencies; imports stay the same and the types now come from ${lib} itself.`, npmPage(`@types/${lib}`), 'npm'),
  ],
});

export const ENTRIES = [
  // ---------------------------------------------------------------- multi-project (2+ subjects)
  [P, 'pydub', { how: 'none-found', conf: 'medium', none: 'No deprecation notice, no successor named by the project and no API-compatible maintained fork found on PyPI. Last release 2021-03; it still wraps ffmpeg.' }],
  [P, 'defusedxml', { how: 'none-found', conf: 'medium', finished: true, none: 'No replacement exists: it is the standard hardening layer for the stdlib XML parsers, and its own docs say the stdlib is not safe for untrusted XML. Last release 0.7.1 (2021), last commit 2023-10. Likely finished, not dead.' }],
  [P, 'ldap3', { how: 'none-found', conf: 'medium', none: 'No successor named. Release 2.9.1 is from 2021-07.', notDead: 'The repository had a commit on 2026-04-18, within 12 months of the check (commit feed).' }],
  [P, 'mkdocs-material', {
    how: 'readme-notice', conf: 'high',
    note: 'The README announces end of life on 2027-05-05 and names Zensical as the maintained successor.',
    ways: [pkg(P, 'zensical', 'Built by the team behind Material for MkDocs. It can read your existing mkdocs.yml; the `classic` theme variant keeps the Material look. Plugins need a compatibility check, so the move is a configuration change plus a plugin review, not a code change.', 'https://zensical.org/docs/compatibility/mkdocs/migration/')],
    notDead: 'Still shipping: release 9.8.0 on 2026-10-24 and a commit 4 days before the check. The PyPI "Inactive" classifier is true in the sense that end of life is announced (2027-05-05), not that it is abandoned today.',
  }],
  [P, 'pysocks', { how: 'successor-docs', conf: 'medium', finished: true,
    ways: [pkg(P, 'python-socks', 'Maintained SOCKS4/SOCKS5 and HTTP proxy client with sync, asyncio, trio and anyio APIs. The API differs: you build a Proxy from a URL and call connect() instead of using socks.socksocket.', 'https://pypi.org/project/python-socks/')],
    none: undefined }],
  [N, 'cross-env', { how: 'none-found', conf: 'high', finished: true, none: 'No successor is needed yet: the README says cross-env is "done" (feature complete). The repository was archived on 2025-11-19 after release 10.1.0 (2025-09-29).', notDead: 'README notice: "cross-env is done as in it does what it does and there is no need for new features" (links issue 257).' }],
  [N, '@babel/plugin-proposal-class-properties', {
    how: 'deprecation-message', conf: 'high',
    ways: [
      pkg(N, '@babel/plugin-transform-class-properties', 'The proposal reached the ECMAScript standard, so Babel renamed the plugin. Replace the plugin name in the Babel config; options (`loose`) are unchanged.', npmPage('@babel/plugin-proposal-class-properties'), 'npm'),
      nat(N, 'class fields', 'Class fields are part of ES2022, so when every target environment supports them the plugin can be removed and the syntax left as it is.', 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Classes/Public_class_fields'),
    ],
  }],
  [N, '@codemirror/lang-python', { how: 'readme-notice', conf: 'high', none: 'The GitHub repository was archived because the project moved to another Git host; the package continues.', notDead: 'README: "This repository has moved to code.haverbeke.berlin/codemirror/lang-python". The new host shows commits on 2026-04-15 (page checked).' }],
  [N, '@types/bcryptjs', stub('bcryptjs')],
  [N, 'codemirror', { how: 'readme-notice', conf: 'high', none: 'The GitHub repository was archived because the project moved to another Git host; the package continues.', notDead: 'README: "This repository has moved to code.haverbeke.berlin/codemirror/basic-setup".' }],
  [N, 'istanbul', {
    how: 'deprecation-message', conf: 'high',
    ways: [
      pkg(N, 'c8', 'Uses V8 native coverage instead of source instrumentation, so no instrument step. CLI wraps your command: `c8 node test.js` instead of `istanbul cover`. Reports are the same Istanbul formats.', 'https://github.com/bcoe/c8', 'curated'),
      pkg(N, 'nyc', 'The deprecation message names nyc. It is the command-line client of the maintained Istanbul libraries, with instrumentation like the old tool; `nyc <cmd>` replaces `istanbul cover <cmd>`.', npmPage('istanbul'), 'npm'),
    ],
  }],
  [N, 'karma-mocha', {
    how: 'readme-notice', conf: 'medium',
    ways: [pkg(N, '@web/test-runner', 'Karma is deprecated; its README lists Web Test Runner as a direct alternative for browser tests. Mocha tests run unchanged through the `@web/test-runner-mocha` framework; the config moves from karma.conf.js to web-test-runner.config.mjs.', 'https://github.com/karma-runner/karma#karma-is-deprecated-and-is-no-longer-maintained-or-accepting-new-features')],
  }],
  [N, 'karma-mocha-reporter', { how: 'readme-notice', conf: 'medium', none: 'Only meaningful with Karma, which is deprecated. The way out is leaving Karma (see karma-mocha); the new runner brings its own reporters.' }],
  [N, 'process', { how: 'none-found', conf: 'high', finished: true, none: 'A tiny browser shim of `process.nextTick` that bundlers pull in; no replacement and no deprecation. Last release 2017. Bundlers that target modern browsers can drop the shim, otherwise keep it.' }],
  [N, 'seedrandom', { how: 'successor-docs', conf: 'medium', finished: true,
    ways: [pkg(N, 'pure-rand', 'Maintained seedable PRNG library (the generator behind fast-check). The API differs: you create a generator from a seed (`prand.xoroshiro128plus(seed)`) and draw numbers through distribution functions, instead of calling a seeded `Math.random`.', npmPage('pure-rand'))] }],
  [N, 'ecstatic', { how: 'deprecation-message', conf: 'high', note: 'sirv, a second candidate, was not offered: no commit for 426 days.',
    ways: [
      pkg(N, 'serve-static', 'Express/Connect static file middleware maintained by the Express team. Same shape: `serve-static(root, options)` returns a (req, res, next) middleware; options are renamed (`index` instead of `defaultExt`, no built-in directory listing).', 'https://expressjs.com/en/resources/middleware/serve-static.html'),
    ] }],
  [N, 'expr-eval', { how: 'successor-docs', conf: 'medium',
    ways: [pkg(N, 'expr-eval-fork', 'Community fork of expr-eval that keeps the API (`Parser.parse(expr).evaluate(scope)`) and fixes the advisories on the original. Update the import and the version pin.', npmPage('expr-eval-fork'))] }],
  [N, 'extract-zip', { how: 'successor-docs', conf: 'low',
    ways: [pkg(N, 'unzipper', 'Maintained unzip library with a streaming `Extract({ path })` API. The call style changes from `await extract(file, { dir })` to piping `fs.createReadStream(file).pipe(unzipper.Extract({ path }))`. Check that it rejects entries that leave the target directory, which is the fault of the open advisories on extract-zip.', npmPage('unzipper'))] }],
  [N, 'request', { how: 'e18e', conf: 'high',
    ways: [
      nat(N, 'fetch', 'Built in to Node 18+ and every browser. Callbacks and streams become promises: `const res = await fetch(url); const data = await res.json()`. Options are renamed (`headers`, `body`, `method`).', 'https://developer.mozilla.org/docs/Web/API/Fetch_API'),
      pkg(N, 'undici', 'The HTTP client behind Node fetch, from the Node.js project. Use `undici.request` for a lower-level, faster call with a promise API.', 'https://github.com/nodejs/undici'),
      pkg(N, 'ofetch', 'Fetch wrapper with automatic JSON parsing, retries and base URLs; closest to the convenience of request.', 'https://github.com/unjs/ofetch'),
      pkg(N, 'ky', 'Small fetch wrapper with retries, hooks and JSON helpers.', 'https://github.com/sindresorhus/ky'),
    ] }],

  // ---------------------------------------------------------------- Python
  [P, 'asynctest', { how: 'successor-docs', conf: 'high',
    ways: [nat(P, 'unittest.IsolatedAsyncioTestCase', 'The standard library has async test cases since Python 3.8: subclass IsolatedAsyncioTestCase and write `async def test_...`. No extra package; asynctest\'s coroutine mocks become `unittest.mock.AsyncMock`.', 'https://docs.python.org/3/library/unittest.html#unittest.IsolatedAsyncioTestCase')] }],
  [P, 'attrdict', { how: 'registry-record', conf: 'medium',
    note: 'PyPI marks it Development Status 7 Inactive. attrdict3, the usual fork, is itself archived (2026-01-14) and munch has had no commit for 1221 days, so neither is offered.',
    ways: [
      pkg(P, 'python-box', 'Dictionary with attribute access that is maintained; `Box(d)` replaces `AttrDict(d)`. Methods differ in names (`to_dict()`), and nested lists are converted too.', pypiPage('python-box')),
      nat(P, 'types.SimpleNamespace', 'For flat data the standard library has attribute access: `SimpleNamespace(**d)`. It is not a dict and does not nest.', 'https://docs.python.org/3/library/types.html#types.SimpleNamespace'),
    ] }],
  [P, 'attrdict3', { how: 'registry-record', conf: 'medium', note: 'Fork of attrdict; archived on GitHub 2026-01-14, last release 2022-04.',
    ways: [
      pkg(P, 'python-box', 'Dictionary with attribute access that is maintained; `Box(d)` replaces `AttrDict(d)`.', pypiPage('python-box')),
    ] }],
  [P, 'codecov', { how: 'readme-notice', conf: 'high',
    note: 'The README deprecates this uploader and links a migration guide to the new Codecov CLI.',
    ways: [pkg(P, 'codecov-cli', 'The new Codecov uploader, from the Codecov team. The command changes from `codecov` to `codecovcli upload-process` (token via CODECOV_TOKEN).', 'https://docs.codecov.com/docs/deprecated-uploader-migration-guide#python-uploader')] }],
  [P, 'darglint', { how: 'successor-docs', conf: 'medium',
    ways: [pkg(P, 'pydoclint', 'Python docstring linter that checks the arguments, returns, yields and raises sections against the signature, which is the job darglint did. It runs standalone or as a flake8 plugin; rule codes change from DAR to DOC.', pypiPage('pydoclint'))] }],
  [P, 'g2p-en', { how: 'none-found', conf: 'low', none: 'No successor named; a drop-in is not known. Phoneme libraries exist but have different outputs and dictionaries.' }],
  [P, 'gntp', { how: 'none-found', conf: 'low', none: 'Growl notification client; no maintained drop-in found. The Apprise library can send Growl notifications but is a different API.' }],
  [P, 'jieba', { how: 'none-found', conf: 'low', none: 'No successor named by the project; maintained Chinese segmenters exist but have different APIs and outputs.' }],
  [P, 'lxml-stubs', { how: 'readme-notice', conf: 'high',
    ways: [pkg(P, 'types-lxml', 'The README says lxml-stubs is not maintained and was superseded by types-lxml, a more complete, externally maintained stub package. Install types-lxml and remove lxml-stubs; type checkers pick it up with no code change.', 'https://github.com/abelcheung/types-lxml')] }],
  [P, 'mutatormath', { how: 'none-found', conf: 'low', none: 'Font-design library; no successor named and no replacement found.' }],
  [P, 'nest-asyncio', { how: 'successor-docs', conf: 'medium',
    note: 'The GitHub repository was archived on 2024-03-06; the original author is no longer working on it.',
    ways: [pkg(P, 'nest-asyncio2', 'Maintained fork with the same `nest_asyncio.apply()` call; change the import to `nest_asyncio2`.', pypiPage('nest-asyncio2'))] }],
  [P, 'ntplib', { how: 'none-found', conf: 'low', none: 'No successor named. The repository had a commit in 2024-04.' }],
  [P, 'pydotplus', { how: 'successor-docs', conf: 'medium',
    ways: [pkg(P, 'pydot', 'pydotplus began as a fork of pydot; pydot is maintained again and offers the same `graph_from_dot_data` and `write_png` style calls. Change the import from pydotplus to pydot.', pypiPage('pydot'))] }],
  [P, 'pyserial', { how: 'none-found', conf: 'medium', none: 'No successor named. The 3.5 release is from 2020-11.', notDead: 'The repository had a commit on 2026-02-27, within 12 months of the check (commit feed).' }],
  [P, 'pytest-dotenv', { how: 'readme-notice', conf: 'medium',
    ways: [pkg(P, 'pytest-env', 'Maintained pytest plugin that sets environment variables from pytest configuration and can load them from `.env` files. The `env_files` setting keeps its name but moves into the `[tool.pytest_env]` table (see its README); `--envfile` selects a file on the command line.', pypiPage('pytest-env'))] }],
  [P, 'pytest-subtests', { how: 'migration-guide', conf: 'high',
    note: 'Archived on 2025-11-11, the week pytest 9.0.0 (2025-11-05) added subtests to pytest itself.',
    ways: [
      pkg(P, 'pytest', 'pytest 9.0 and later has built-in support for subtests ("Support for subtests has been added" in the 9.0.0 changelog), so the plugin is not needed. Raise the pytest pin to 9 or newer and use the `subtests` fixture.', 'https://docs.pytest.org/en/stable/changelog.html'),
      nat(P, 'unittest.TestCase.subTest', 'The standard library `subTest` context manager covers the same need for unittest-style classes.', 'https://docs.python.org/3/library/unittest.html#unittest.TestCase.subTest'),
    ] }],
  [P, 'python-terraform', { how: 'none-found', conf: 'low', none: 'Thin wrapper over the terraform command; no maintained fork found. Calling `subprocess.run(["terraform", ...])` is the plain alternative.' }],
  [P, 'recommonmark', { how: 'readme-notice', conf: 'high',
    ways: [pkg(P, 'myst-parser', 'The README says recommonmark is deprecated and recommends MyST. MyST-Parser reads CommonMark plus extensions for Sphinx; set `extensions = ["myst_parser"]` instead of the recommonmark parser and rename the config keys.', 'https://github.com/executablebooks/MyST-Parser')] }],
  [P, 'reverse-geocoder', { how: 'none-found', conf: 'low', none: 'Offline reverse geocoder, last release 2016; no successor named and no drop-in found.' }],
  [P, 'seqeval', { how: 'none-found', conf: 'low', none: 'No successor named. The repository had a commit in 2024-08, the last release is from 2020-10.' }],
  [P, 'soynlp', { how: 'none-found', conf: 'low', none: 'Korean NLP toolkit, last release 2019; no successor named.' }],
  [P, 'sphinx-multiversion', { how: 'successor-docs', conf: 'low',
    ways: [pkg(P, 'sphinx-polyversion', 'Builds several versions of a Sphinx site and merges them into one website (its PyPI summary), the job sphinx-multiversion did. It is driven by a build script instead of a Sphinx extension, so the setup is rewritten.', pypiPage('sphinx-polyversion'))] }],
  [P, 'tangled-up-in-unicode', { how: 'successor-docs', conf: 'medium',
    ways: [nat(P, 'unicodedata', 'The package describes itself as an alternative to the standard library `unicodedata`. The stdlib covers category and name lookups for the Unicode version bundled with your Python; the package existed to offer newer Unicode data and extra fields (block, script).', 'https://docs.python.org/3/library/unicodedata.html')] }],
  [P, 'testing-postgresql', { how: 'successor-docs', conf: 'medium',
    ways: [pkg(P, 'pytest-postgresql', 'Maintained pytest plugin that starts a throwaway PostgreSQL server for tests. It exposes fixtures instead of a context manager, so tests change to take a `postgresql` fixture.', pypiPage('pytest-postgresql'))] }],
  [P, 'user-agents', { how: 'successor-docs', conf: 'medium',
    ways: [pkg(P, 'ua-parser', 'user-agents is a convenience layer over the ua-parser data. ua-parser is maintained and returns browser, OS and device; helpers such as `is_mobile` are not included and become a check on the device family.', pypiPage('ua-parser'))] }],

  // ---------------------------------------------------------------- npm, deprecated on the registry
  [N, '@babel/plugin-proposal-object-rest-spread', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, '@babel/plugin-transform-object-rest-spread', 'The proposal is part of ES2018, so Babel renamed the plugin; change the name in the Babel config.', npmPage('@babel/plugin-proposal-object-rest-spread'), 'npm'),
    nat(N, 'spread syntax', 'Object rest/spread is standard JavaScript; when all targets support it the plugin can go.', 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Operators/Spread_syntax'),
  ] }],
  [N, '@babel/plugin-proposal-optional-chaining', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, '@babel/plugin-transform-optional-chaining', 'The proposal is part of ES2020, so Babel renamed the plugin; change the name in the Babel config.', npmPage('@babel/plugin-proposal-optional-chaining'), 'npm'),
    nat(N, 'optional chaining', 'Optional chaining (`a?.b`) is standard JavaScript; when all targets support it the plugin can go.', 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Operators/Optional_chaining'),
  ] }],
  [N, '@codemirror/lang-json', { how: 'readme-notice', conf: 'high', none: 'The GitHub repository was archived because the project moved to another Git host; the package continues.', notDead: 'README: "This repository has moved to code.haverbeke.berlin/codemirror/lang-json"; release 6.0.2 on 2025-06-19.' }],
  [N, '@codemirror/rangeset', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, '@codemirror/state', 'The registry message says the package was merged into @codemirror/state as of 0.20.0. `RangeSet`, `RangeSetBuilder` and `Range` are exported from there; change the import path.', npmPage('@codemirror/rangeset'), 'npm'),
  ] }],
  [N, '@codemirror/theme-one-dark', { how: 'readme-notice', conf: 'high', none: 'The GitHub repository was archived because the project moved to another Git host; the package continues.', notDead: 'README: "This repository has moved to code.haverbeke.berlin/codemirror/theme-one-dark".' }],
  [N, '@louislam/sqlite3', { how: 'successor-docs', conf: 'medium',
    note: 'A fork of node-sqlite3 made for CentOS 7; the repository was archived on 2026-09-21. The upstream sqlite3 package was not offered: its repository is archived too.',
    ways: [
      pkg(N, 'better-sqlite3', 'Maintained SQLite binding with a synchronous API (`db.prepare(sql).all()`), so callback code becomes plain calls. The upstream node-sqlite3 was not offered because its repository is archived.', npmPage('better-sqlite3')),
      nat(N, 'node:sqlite', 'Node ships a SQLite module. It is synchronous (`new DatabaseSync(path)`), so callback code becomes plain calls.', 'https://nodejs.org/api/sqlite.html'),
    ] }],
  [N, '@mdi/light-js', { how: 'none-found', conf: 'low', finished: true, none: 'Icon-path data package, last release 2018; no successor named.' }],
  [N, '@opentelemetry/sdk-trace-base', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, '@opentelemetry/sdk-trace', 'The registry message says to use @opentelemetry/sdk-trace; the base SDK moved into it. Change the import and package name.', npmPage('@opentelemetry/sdk-trace-base'), 'npm'),
  ] }],
  [N, '@opentelemetry/sdk-trace-node', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, '@opentelemetry/sdk-trace', 'The registry message says to use @opentelemetry/sdk-trace; the Node provider moved into it. Change the import and package name.', npmPage('@opentelemetry/sdk-trace-node'), 'npm'),
  ] }],
  [N, '@swan-io/boxed', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, '@bloodyowl/boxed', 'The registry message says the package was transferred to @bloodyowl/boxed. Same API: change the package name.', npmPage('@swan-io/boxed'), 'npm'),
  ] }],
  [N, '@types/adm-zip', stub('adm-zip')],
  [N, '@types/commander', stub('commander')],
  [N, '@types/earcut', stub('earcut')],
  [N, '@types/glob', stub('glob')],
  [N, '@types/inquirer', stub('inquirer')],
  [N, '@types/pixelmatch', stub('pixelmatch')],
  [N, '@types/rimraf', stub('rimraf')],
];

export const ENTRIES2 = [
  // ---------------------------------------------------------------- npm: moved, merged or superseded (named by the project)
  [N, 'eslint-plugin-babel', { how: 'readme-notice', conf: 'high', ways: [
    pkg(N, '@babel/eslint-plugin', 'The README says eslint-plugin-babel is now @babel/eslint-plugin and lives in the Babel monorepo. Rename the plugin in the ESLint config (`babel/` rules become `@babel/` rules).', 'https://github.com/babel/babel/tree/main/eslint/babel-eslint-plugin'),
  ] }],
  [N, 'eslint-plugin-markdown', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, '@eslint/markdown', 'The registry message says to use @eslint/markdown, the official ESLint plugin; it targets flat config and also lints the Markdown itself.', npmPage('eslint-plugin-markdown'), 'npm'),
  ] }],
  [N, 'eslint-plugin-node', { how: 'readme-notice', conf: 'high', ways: [
    pkg(N, 'eslint-plugin-n', 'The README says the project is no longer maintained and points to eslint-community/eslint-plugin-n, a fork that keeps the rules. Rename `node/` rules to `n/` in the ESLint config.', 'https://github.com/eslint-community/eslint-plugin-n'),
  ] }],
  [N, 'eslint-config-airbnb-typescript', { how: 'readme-notice', conf: 'medium', ways: [
    pkg(N, 'eslint-config-airbnb-extended', 'The README of the archived project lists it as the alternative (shared for discoverability, not a personal recommendation). It is a flat-config rewrite, so the ESLint config file changes shape.', 'https://github.com/iamturns/eslint-config-airbnb-typescript#-alternatives'),
  ] }],
  [N, 'jscs', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, 'eslint', 'The registry message says JSCS merged with ESLint. Style rules become ESLint rules (and formatting rules move to a formatter such as Prettier); .jscsrc is rewritten as an ESLint config.', npmPage('jscs'), 'npm'),
  ] }],
  [N, 'level-codec', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, 'level-transcoder', 'The registry message and README say level-codec was superseded by level-transcoder. It is the encoding layer of abstract-level; encodings are named strings (`utf8`, `json`) instead of codec objects.', 'https://github.com/Level/community#faq', 'npm'),
  ] }],
  [N, 'leveldown', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, 'classic-level', 'The registry message says leveldown was superseded by classic-level: the same LevelDB binding as an abstract-level database. `level(location)` or `new ClassicLevel(location)` replaces `levelup(leveldown(location))`.', 'https://github.com/Level/community#faq', 'npm'),
  ] }],
  [N, 'levelup', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, 'abstract-level', 'The registry message says levelup was superseded by abstract-level. Databases are classes with promise APIs (`await db.put(k, v)`) and their own iterators, instead of a levelup wrapper over a down-store.', 'https://github.com/Level/community#faq', 'npm'),
  ] }],
  [N, 'memdown', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, 'memory-level', 'The registry message says memdown was superseded by memory-level, an in-memory abstract-level database. `new MemoryLevel()` replaces `memdown()`.', 'https://github.com/Level/community#faq', 'npm'),
  ] }],
  [N, 'localstorage-down', { how: 'successor-docs', conf: 'low', ways: [
    pkg(N, 'browser-level', 'The abstract-level family has a browser database (IndexedDB) in place of localStorage-backed leveldown. The store changes from localStorage to IndexedDB and the API becomes the abstract-level API.', npmPage('browser-level')),
  ] }],
  [N, 'qunitjs', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, 'qunit', 'The registry message says qunitjs stopped at 2.4.1 and later versions are published as `qunit`. Change the dependency name; test code is unchanged.', npmPage('qunitjs'), 'npm'),
  ] }],
  [N, 'rollup-plugin-node-resolve', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, '@rollup/plugin-node-resolve', 'The registry message and README say the plugin moved to the @rollup/plugins repository. Change the import and package name; options are mostly the same (`mainFields`, not the old `jsnext`).', npmPage('rollup-plugin-node-resolve'), 'npm'),
  ] }],
  [N, 'rollup-plugin-replace', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, '@rollup/plugin-replace', 'The registry message says the plugin moved to @rollup/plugin-replace. Change the import; `preventAssignment: true` is advised in the new plugin.', npmPage('rollup-plugin-replace'), 'npm'),
  ] }],
  [N, 'rollup-plugin-sourcemaps', { how: 'successor-docs', conf: 'medium', ways: [
    pkg(N, 'rollup-plugin-sourcemaps2', 'Maintained package published with the same description (grabs source maps from sourceMappingURLs). Change the package name in the imports and check the options.', npmPage('rollup-plugin-sourcemaps2')),
  ] }],
  [N, 'stream-to-promise', { how: 'deprecation-message', conf: 'high', ways: [
    nat(N, 'node:stream/promises', 'The registry message and README point to node:stream/promises and node:stream/consumers (Node 16+). `await buffer(stream)` or `await text(stream)` replaces `streamToPromise(stream)`, and `await finished(stream)` replaces it for writables.', 'https://nodejs.org/api/stream.html#streams-promises-api', 'npm'),
  ] }],
  [N, 'xterm-addon-web-links', { how: 'deprecation-message', conf: 'high', ways: [
    pkg(N, '@xterm/addon-web-links', 'The registry message says to move to @xterm/addon-web-links (xterm.js moved to the @xterm scope together with @xterm/xterm). Change the import; the `WebLinksAddon` API is unchanged.', npmPage('xterm-addon-web-links'), 'npm'),
  ] }],
  [N, 'wdio-geckodriver-service', { how: 'readme-notice', conf: 'high', ways: [
    pkg(N, 'webdriverio', 'The README says to remove the service and its entry in the WebdriverIO config when using WebdriverIO 8.14 or newer: the runner now manages geckodriver itself. Nothing replaces it in code.', 'https://webdriver.io/blog/2023/07/31/driver-management'),
  ] }],
  [N, 'node-loader', { how: 'readme-notice', conf: 'medium', ways: [
    pkg(N, 'webpack', 'The README says node-loader is deprecated in favour of the nodejs-addons example in webpack itself, which loads .node addons with a built-in asset rule. The loader entry in the webpack config is replaced by that rule.', 'https://github.com/webpack/webpack/tree/main/examples/nodejs-addons'),
  ] }],
  [N, 'raw-loader', { how: 'readme-notice', conf: 'high', ways: [
    pkg(N, 'webpack', 'The README says to migrate to webpack 5 asset modules: a rule with `type: "asset/source"` returns the file content as a string, and the loader is removed.', 'https://webpack.js.org/guides/asset-modules/'),
  ] }],
  [N, 'style-loader', { how: 'readme-notice', conf: 'medium', ways: [
    pkg(N, 'webpack', 'The README says style-loader is deprecated because webpack now injects CSS itself; it links a native CSS guide and a migration guide. The loader chain changes to webpack\'s built-in CSS handling.', 'https://webpack.js.org/guides/native-css/'),
  ] }],
  [N, 'karma-cli', { how: 'readme-notice', conf: 'medium', ways: [
    pkg(N, '@web/test-runner', 'Karma is deprecated and its README names Web Test Runner and jasmine-browser-runner as direct alternatives, Jest and Vitest as Node-based ones. The karma command is replaced by `wtr`.', 'https://github.com/karma-runner/karma#karma-is-deprecated-and-is-no-longer-maintained-or-accepting-new-features'),
    pkg(N, 'vitest', 'Named in the Karma README as a Node-based alternative; with its browser mode it can run tests in a real browser.', 'https://vitest.dev/'),
  ] }],
  [N, 'karma-webdriver-launcher', { how: 'readme-notice', conf: 'low', none: 'A Karma launcher for remote WebDriver browsers (archived 2026-04-19). Karma is deprecated; the way out is a runner with its own browser launcher (see karma-cli).' }],
  [N, 'vitest-github-actions-reporter', { how: 'readme-notice', conf: 'medium', ways: [
    pkg(N, 'vitest', 'Vitest has a built-in `github-actions` reporter (listed in its reporters guide), so the extra reporter can be removed: `reporters: ["default", "github-actions"]`.', 'https://vitest.dev/guide/reporters.html'),
  ] }],
  [N, 'esm', { how: 'successor-docs', conf: 'high', ways: [
    nat(N, 'ECMAScript modules in Node', 'Node runs ES modules natively (`"type": "module"` or `.mjs`), and newer releases can `require()` them. Remove the `-r esm` flag and convert import specifiers to include file extensions.', 'https://nodejs.org/api/esm.html'),
  ] }],
  [N, 'prop-types', { how: 'migration-guide', conf: 'medium', none: 'No package replaces it. React 19 removed propTypes checks for function components (React 19 upgrade guide); the way out is static types (TypeScript) or deleting the checks. See https://react.dev/blog/2024/04/25/react-19-upgrade-guide ("Removed: propTypes and defaultProps for functions").' }],

  // ---------------------------------------------------------------- npm: native platform features
  [N, 'denodeify', { how: 'successor-docs', conf: 'high', ways: [
    nat(N, 'util.promisify', 'Node turns a callback-style function into a promise function with `util.promisify(fn)`. Same idea, built in.', 'https://nodejs.org/api/util.html#utilpromisifyoriginal'),
  ] }],
  [N, 'ncp', { how: 'successor-docs', conf: 'high', ways: [
    nat(N, 'fs.cp', 'Node 16.7+ copies directories recursively with `fs.cp(src, dest, { recursive: true })` and a promise form `fs.promises.cp`. The callback becomes a promise; `filter` replaces ncp\'s filter option.', 'https://nodejs.org/api/fs.html#fspromisescpsrc-dest-options'),
  ] }],
  [N, 'yoctodelay', { how: 'successor-docs', conf: 'high', ways: [
    nat(N, 'timers/promises.setTimeout', 'Node 15+ has a promise `setTimeout` in node:timers/promises: `await setTimeout(ms)`. In a browser, `new Promise((r) => setTimeout(r, ms))` is the same in one line.', 'https://nodejs.org/api/timers.html#timerspromisessettimeoutdelay-value-options'),
  ] }],
  [N, 'javascript-natural-sort', { how: 'successor-docs', conf: 'high', ways: [
    nat(N, 'Intl.Collator', 'Natural ordering is built in: `array.sort(new Intl.Collator(undefined, { numeric: true }).compare)` or `a.localeCompare(b, undefined, { numeric: true })`. Case and accent handling follow the locale.', 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator/Collator'),
  ] }],
  [N, 'gzip-js', { how: 'successor-docs', conf: 'high', ways: [
    nat(N, 'CompressionStream', 'Browsers and Node 18+ compress with the Compression Streams API: `new CompressionStream("gzip")`. It is stream based and asynchronous, where gzip-js returned arrays synchronously.', 'https://developer.mozilla.org/docs/Web/API/CompressionStream'),
    nat(N, 'zlib.gzipSync', 'In Node only, `zlib.gzipSync(buffer)` keeps the synchronous call style.', 'https://nodejs.org/api/zlib.html#zlibgzipsyncbuffer-options'),
  ] }],
  [N, 'fast-deep-equal', { how: 'successor-docs', conf: 'medium', finished: true, ways: [
    nat(N, 'util.isDeepStrictEqual', 'In Node, `util.isDeepStrictEqual(a, b)` does a strict deep comparison. It is not available in browsers, and it compares `NaN` and prototypes strictly, which differs from fast-deep-equal in edge cases.', 'https://nodejs.org/api/util.html#utilisdeepstrictequalval1-val2'),
  ] }],
  [N, 'uuidv4', { how: 'e18e', conf: 'high', ways: [
    nat(N, 'crypto.randomUUID', 'A v4 UUID is built in to Node 14.17+ and every browser: `crypto.randomUUID()` replaces `uuid()`.', 'https://developer.mozilla.org/docs/Web/API/Crypto/randomUUID'),
    pkg(N, 'uuid', 'The `uuid` package covers every UUID version if more than v4 is needed; `v4()` replaces `uuid()`.', npmPage('uuid')),
  ] }],
  [N, 'isomorphic-fetch', { how: 'e18e', conf: 'high', ways: [
    nat(N, 'fetch', 'Node 18+ and all browsers have a global fetch, which is all this package polyfilled. Remove the import.', 'https://developer.mozilla.org/docs/Web/API/Fetch_API'),
    pkg(N, 'ofetch', 'If a convenience layer is wanted: a fetch wrapper with JSON handling and retries.', 'https://github.com/unjs/ofetch'),
  ] }],
  [N, 'mockdate', { how: 'e18e', conf: 'medium', ways: [
    nat(N, 'node:test mock timers', 'The Node test runner can set a fake clock: `mock.timers.enable({ apis: ["Date"] })` and `mock.timers.setTime(ms)` replace `MockDate.set(ms)`.', 'https://nodejs.org/api/test.html#class-mocktimers'),
    pkg(N, 'vitest', 'With Vitest, `vi.useFakeTimers()` and `vi.setSystemTime(date)` replace `MockDate.set(date)`.', 'https://vitest.dev/api/vi.html#vi-setsystemtime'),
  ] }],
  [N, 'load-json-file', { how: 'e18e', conf: 'medium', ways: [
    nat(N, 'fs.readFile + JSON.parse', 'Reading JSON takes one line with Node built-ins: `JSON.parse(await fs.readFile(path, "utf8"))`. Error messages with the file name are lost.', 'https://nodejs.org/api/fs.html#fspromisesreadfilepath-options'),
  ], notDead: 'The repository had a commit 46 days before the check (commit feed); the 7.0.1 release is from 2021-09.' }],
  [N, 'npm-run-all', { how: 'e18e', conf: 'high', ways: [
    pkg(N, 'npm-run-all2', 'A maintained fork with the same commands (`run-s`, `run-p`, `npm-run-all`); change the package name only.', npmPage('npm-run-all2')),
    pkg(N, 'concurrently', 'Runs commands in parallel with prefixed output; `concurrently "a" "b"` replaces `run-p a b`.', npmPage('concurrently')),
    pkg(N, 'wireit', 'Adds dependency graphs and caching to npm scripts; a bigger change, defined in package.json.', 'https://github.com/google/wireit'),
  ] }],
  [N, 'eslint-plugin-no-mixed-operators', { how: 'successor-docs', conf: 'medium', ways: [
    pkg(N, '@stylistic/eslint-plugin', 'Provides `@stylistic/no-mixed-operators`, the maintained home of the stylistic rule (the core rule has no autofix). Rename the rule in the ESLint config.', 'https://eslint.style/rules/no-mixed-operators'),
  ] }],
  [N, 'tiny-emitter', { how: 'successor-docs', conf: 'medium', finished: true, ways: [
    nat(N, 'EventTarget', 'Node 15+ and browsers have `EventTarget` and `CustomEvent`: `target.addEventListener(name, fn)` and `target.dispatchEvent(new CustomEvent(name, { detail }))` replace `on` and `emit` (data moves to `event.detail`).', 'https://developer.mozilla.org/docs/Web/API/EventTarget'),
  ] }],

  // ---------------------------------------------------------------- npm: package successors from the package's own docs
  [N, 'coveralls', { how: 'readme-notice', conf: 'high', ways: [
    pkg(N, 'coveralls-next', 'The README says the project is no longer maintained and names coveralls-next as the recommended fork. Same command: `coveralls-next` reads LCOV from stdin like `coveralls`.', 'https://github.com/jtwebman/coveralls-next'),
  ] }],
  [N, 'codecov', { how: 'deprecation-message', conf: 'low', none: 'The registry message points to Codecov\'s uploader deprecation plan. The way out is the new Codecov uploader, a standalone CLI or the codecov GitHub Action, not an npm package. Move upload to the Action or CLI in CI.' }],
  [N, 'codecov.io', { how: 'none-found', conf: 'low', none: 'Old LCOV poster for Codecov (2015). The way out is the current Codecov uploader (CLI or GitHub Action), not an npm package.' }],
  [N, 'enzyme', { how: 'successor-docs', conf: 'medium', ways: [
    pkg(N, '@testing-library/react', 'Tests query the rendered DOM by role and text instead of component internals (`render`, `screen.getByRole`), so enzyme\'s `shallow` and `mount` tests are rewritten, not renamed. It supports current React versions.', 'https://testing-library.com/docs/react-testing-library/intro/'),
  ] }],
  [N, '@wojtekmaj/enzyme-adapter-react-17', { how: 'successor-docs', conf: 'medium', ways: [
    pkg(N, '@testing-library/react', 'Enzyme adapters tie tests to a React version; React Testing Library works with the current ones and drops the adapter. Tests are rewritten around `render` and `screen` queries.', 'https://testing-library.com/docs/react-testing-library/intro/'),
  ] }],
  [N, 'chai-enzyme', { how: 'successor-docs', conf: 'low', none: 'Assertions for enzyme wrappers; it goes away with enzyme. With React Testing Library the DOM assertions come from @testing-library/jest-dom or chai-dom, a different style.' }],
  [N, 'benchmark', { how: 'successor-docs', conf: 'medium', note: 'mitata, a second candidate, was not offered: no commit for 625 days.', ways: [
    pkg(N, 'tinybench', 'Small maintained benchmark runner with statistics. A suite is `new Bench()` plus `bench.add(name, fn)` and `await bench.run()` instead of `new Benchmark.Suite()` and events.', npmPage('tinybench')),
  ] }],
  [N, 'command-exists', { how: 'successor-docs', conf: 'medium', finished: true, ways: [
    pkg(N, 'which', 'Maintained by the npm team: `which.sync(cmd, { nothrow: true })` returns the path or null, where command-exists returned a boolean.', npmPage('which')),
  ] }],
  [N, 'copyfiles', { how: 'successor-docs', conf: 'medium', ways: [
    pkg(N, 'cpy-cli', 'Command line copy with glob patterns and a maintained codebase: `cpy "src/**/*.html" dist` replaces `copyfiles -u 1 "src/**/*.html" dist` (folder flattening uses `--cwd`).', npmPage('cpy-cli')),
    nat(N, 'fs.cp', 'For copying one folder tree without globs, Node 16.7+ has `fs.cp(src, dest, { recursive: true })`.', 'https://nodejs.org/api/fs.html#fspromisescpsrc-dest-options'),
  ] }],
  [N, 'd3-queue', { how: 'successor-docs', conf: 'medium', ways: [
    nat(N, 'Promise.all', 'Run tasks together with `await Promise.all(tasks.map((t) => t()))`; callbacks become promises. For a concurrency limit use `p-limit`.', 'https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise/all'),
    pkg(N, 'p-limit', 'Adds a concurrency limit to promise-returning tasks: `const limit = pLimit(n)` replaces `d3.queue(n)`.', npmPage('p-limit')),
  ] }],
  [N, 'detect-port-alt', { how: 'successor-docs', conf: 'medium', ways: [
    pkg(N, 'detect-port', 'detect-port-alt is a fork of detect-port made for Create React App; the original is maintained. Same call `detectPort(port)` returning a promise; change the package name.', npmPage('detect-port')),
  ] }],
  [N, 'diff-match-patch', { how: 'migration-guide', conf: 'high', ways: [
    pkg(N, 'diff-match-patch-es', 'ESM and TypeScript rewrite of diff-match-patch whose README has a migration section from this exact npm package: the class and default export are gone, functions are camelCase (`diff(a, b)` instead of `dmp.diff_main(a, b)`) and options such as `Diff_Timeout` become an options object.', 'https://github.com/antfu/diff-match-patch-es#migration'),
  ] }],
  [N, 'docdown', { how: 'none-found', conf: 'low', none: 'jsdoc-to-markdown, the usual replacement, failed the aliveness check (no commit for 396 days), so it is not offered. No other drop-in found.' }],
  [N, 'double-ended-queue', { how: 'none-found', conf: 'medium', none: 'denque, the usual replacement, failed the aliveness check (repository archived, no commit for 1569 days), so it is not offered. No other drop-in found; a plain Array with push/shift is the fallback for small queues.' }],
  [N, 'identity-obj-proxy', { how: 'successor-docs', conf: 'high', finished: true, ways: [
    raise(N, 'identity-obj-proxy', 'The package is one Proxy that returns each key as its own name, so the project can own it as a stub file mapped with Jest `moduleNameMapper` (about 10 lines): `new Proxy({}, { get: (_, key) => (key === "__esModule" ? false : key) })`.', 'https://github.com/keyz/identity-obj-proxy/blob/master/src/index.js'),
  ] }],
  [N, 'median', { how: 'successor-docs', conf: 'high', ways: [
    raise(N, 'median', 'Computing a median is a few lines the project can own: sort a copy of the array and take the middle value (the mean of the two middle values for an even count).'),
  ] }],
  [N, 'mocha-lcov-reporter', { how: 'successor-docs', conf: 'medium', ways: [
    pkg(N, 'c8', 'Produces LCOV from V8 coverage for any test command: `c8 --reporter=lcov mocha`. Coverage is collected by c8, not by a Mocha reporter, so the reporter option is removed.', 'https://github.com/bcoe/c8'),
  ] }],
  [N, 'platform', { how: 'successor-docs', conf: 'low', ways: [
    pkg(N, 'bowser', 'Maintained user agent parser: `Bowser.parse(navigator.userAgent)` returns browser, OS and platform objects with other field names than platform.js\'s `platform.name`, `platform.os`.', npmPage('bowser')),
  ] }],
  [N, 'react-color', { how: 'successor-docs', conf: 'low', ways: [
    pkg(N, 'react-colorful', 'Small, maintained React color picker. Components are `HexColorPicker` and friends with `color` and `onChange`; the Sketch/Chrome/Photoshop styles of react-color are not included.', npmPage('react-colorful')),
  ] }],
  [N, 'should', { how: 'successor-docs', conf: 'medium', ways: [
    pkg(N, 'chai', 'Chai has a `should` interface (`chai.should()`) with a very similar chained syntax, and a maintained codebase; matchers are renamed in places.', 'https://www.chaijs.com/guide/styles/#should'),
  ] }],
  [N, 'spark-md5', { how: 'none-found', conf: 'low', none: 'Browser MD5 has no built-in (Web Crypto has no MD5). hash-wasm, the usual replacement, failed the aliveness check (no commit for 714 days), so it is not offered. If the hash is not required to be MD5, crypto.subtle.digest("SHA-256") is built in.' }],
];

// Packages with no known way out. The reason says what was looked for.
const NONE = (how, conf, none, extra = {}) => ({ how, conf, none, ...extra });
export const ENTRIES3 = [
  [N, 'add-cors-to-couchdb', NONE('none-found', 'low', 'A helper script of the PouchDB project for CouchDB CORS setup; no successor named and none found.')],
  [N, 'browserify-incremental', NONE('none-found', 'low', 'Plugin for Browserify, which is legacy; no successor named. Moving to a bundler that is incremental by default (esbuild, Vite) is a build change, not a swap.')],
  [N, 'circular-dependency-plugin', NONE('none-found', 'low', 'Webpack plugin; no successor named. Standalone checkers such as madge exist but work outside the webpack build.')],
  [N, 'cz-conventional-changelog', NONE('none-found', 'medium', 'Commitizen adapter; no successor named. The repository had a commit in 2024-09.', { finished: true })],
  [N, 'curl-amd', NONE('none-found', 'low', 'AMD module loader (2014). The way out is native ES modules and a bundler, a rewrite, not a swap.')],
  [N, 'dekko', NONE('none-found', 'low', 'File layout assertion helper, last release 2016; no successor found.')],
  [N, 'express-pouchdb', NONE('none-found', 'low', 'Part of pouchdb-server; no successor named. The repository had a commit in 2025-08, the release is from 2019.')],
  [N, 'find-requires', NONE('none-found', 'low', 'No successor named; scanning `require()` calls is also done by bundler plugins.')],
  [N, 'foreach-cli', NONE('none-found', 'low', 'No successor named and no drop-in found.')],
  [N, 'grunt-compare-size', NONE('none-found', 'low', 'Grunt plugin; no successor named.')],
  [N, 'grunt-contrib-watch', NONE('none-found', 'low', 'Grunt plugin (last release 2018). The way out is leaving Grunt for npm scripts and a file watcher; no drop-in plugin named.')],
  [N, 'grunt-exec', NONE('none-found', 'low', 'Grunt plugin; no successor named.')],
  [N, 'gulp-less', NONE('none-found', 'low', 'Gulp plugin (last release 2021); no successor named.')],
  [N, 'headr', NONE('none-found', 'low', 'No successor named.')],
  [N, 'is-git-clean', NONE('none-found', 'low', 'Last release 2016; no successor named. It runs `git status --porcelain`, which a project can call directly.')],
  [N, 'ismobilejs', NONE('none-found', 'medium', 'No successor named.', { notDead: 'The repository had a commit 38 days before the check (commit feed) and the README documents a recent migration note; the last npm release is from 2020-04.' })],
  [N, 'js-reporters', NONE('none-found', 'low', 'QUnit includes this reporter interface natively since 2.2 (README); no separate successor is needed for QUnit users.')],
  [N, 'json-source-map', NONE('none-found', 'low', 'No successor named.', { finished: true })],
  [N, 'jsonml-to-react-element', NONE('none-found', 'low', 'No successor named.')],
  [N, 'jsonml.js', NONE('none-found', 'low', 'No successor named.')],
  [N, 'level-write-stream', NONE('none-found', 'low', 'Last release 2014; no successor named.')],
  [N, 'lodash-doc-globals', NONE('none-found', 'low', 'Documentation helper for Lodash, no successor needed outside Lodash docs.')],
  [N, 'ltgt', NONE('none-found', 'low', 'Small range helper for the Level family; no successor named.', { finished: true })],
  [N, 'markdown-doctest', NONE('none-found', 'low', 'No successor named.')],
  [N, 'material-colors', NONE('none-found', 'low', 'Colour constants; no successor named.', { finished: true })],
  [N, 'mustache', NONE('none-found', 'medium', 'No deprecation or successor; release 4.2.0 (2021-03) is the latest and the repository had its last commit in 2023-01. Likely finished.', { finished: true })],
  [N, 'ndarray-determinant', NONE('none-found', 'low', 'scijs package, last release 2014; no successor named.')],
  [N, 'ndarray-gemm', NONE('none-found', 'low', 'scijs package, last release 2016; no successor named.')],
  [N, 'ndarray-ops', NONE('none-found', 'low', 'scijs package; no successor named.', { finished: true })],
  [N, 'ndarray-pack', NONE('none-found', 'low', 'scijs package; no successor named.')],
  [N, 'numericjs', NONE('none-found', 'low', 'Numerical library, last release 2016; no successor named.')],
  [N, 'optional-dev-dependency', NONE('none-found', 'low', 'The registry says "Package no longer supported" (Contact Support), which usually means a security hold. No replacement named.')],
  [N, 'orderedmap', NONE('readme-notice', 'high', 'The GitHub repository was archived because the project moved to another Git host; the package continues.', { notDead: 'README: "This repository has moved to code.haverbeke.berlin/marijn/orderedmap".' })],
  [N, 'pluralize', NONE('none-found', 'medium', 'No deprecation or successor. The repository moved to the `plurals` organisation and the last commit was in 2023-12.', { finished: true })],
  [N, 'postcss-flexbugs-fixes', NONE('none-found', 'low', 'Archived 2026-01-06. It patches flexbox bugs of old browsers (mainly IE 10/11); if you no longer support them, remove the plugin.')],
  [N, 'pouchdb-express-router', NONE('none-found', 'low', 'PouchDB project package; no successor named.')],
  [N, 'prettier-standard', NONE('none-found', 'low', 'No successor named.')],
  [N, 'progress', NONE('none-found', 'medium', 'The usual replacement, cli-progress, failed the aliveness check (no commit since 2023-03), so it is not offered. No other drop-in found.', { finished: true })],
  [N, 'prosemirror-example-setup', NONE('readme-notice', 'high', 'The GitHub repository was archived because the project moved to another Git host; the package continues.', { notDead: 'README: "This repository has moved to code.haverbeke.berlin/prosemirror/prosemirror-example-setup".' })],
  [N, 'prosemirror-inputrules', NONE('readme-notice', 'high', 'The GitHub repository was archived because the project moved to another Git host; the package continues.', { notDead: 'README: "This repository has moved to code.haverbeke.berlin/prosemirror/prosemirror-inputrules"; release 1.5.1 on 2025-10-15.' })],
  [N, 'prosemirror-state', NONE('readme-notice', 'high', 'The GitHub repository was archived because the project moved to another Git host; the package continues.', { notDead: 'README: "This repository has moved to code.haverbeke.berlin/prosemirror/prosemirror-state"; release 1.4.4 on 2025-10-23.' })],
  [N, 'qunit-extras', NONE('none-found', 'low', 'No successor named.')],
  [N, 'rollup-plugin-html', NONE('none-found', 'low', 'Last release 2016; no successor named.')],
  [N, 'rollup-plugin-jscc', NONE('none-found', 'low', 'No successor named.')],
  [N, 'rollup-plugin-string', NONE('none-found', 'low', 'No successor named.')],
  [N, 'run-script-os', NONE('none-found', 'low', 'No successor named.')],
  [N, 'sauce-tunnel', NONE('none-found', 'low', 'Wrapper of an old Sauce Labs tunnel; no successor named.')],
  [N, 'spinnies', NONE('none-found', 'low', 'Multi-spinner CLI helper; no successor named.')],
  [N, 'sylvester', NONE('none-found', 'low', 'Matrix library, last release 2012; no successor named.')],
  [N, 'throw-max-listeners-error', NONE('none-found', 'low', 'Last release 2015; no successor named.')],
  [N, 'tree-kill', NONE('none-found', 'medium', 'No successor named and no deprecation; the package is small and its job (kill a process tree) has no built-in. Likely finished.', { finished: true })],
  [N, 'vue-toastification', NONE('none-found', 'medium', 'No successor named. Vue 3 users are told to take the 2.x line, which exists only as release candidates (2.0.0-rc.5, 2021-10) and a dev build (2022-01); the repository has had no commit since 2022-02.')],
  [N, 'vuvuzela', NONE('none-found', 'low', 'No successor named; native JSON works except for very deep nesting.')],
  [N, 'yalc', NONE('none-found', 'low', 'No successor named. `npm link` and workspaces cover similar needs differently.')],
  [N, 'zeros', NONE('none-found', 'low', 'scijs package, last release 2015; no successor named.', { finished: true })],
];
