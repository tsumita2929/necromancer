# QA round 4b: independent re-test of the round-5 fixes and engine rules at ea92621

Item `it_3a508159` (R5). The tester built none of the code. Findings only; nothing in the product was changed.
Pinned HEAD: `ea92621492560803320d98459be6aef1290d315b` ("Engine QA-4 record: the new test count is 15 ...").
Run on 2026-11-04, 16:55 to 17:15 UTC. Node 22.12.0, Python 3.9.25, Chromium 156 (Playwright 1.64.1).
Everything was built and run from a fresh clone, `scratch/qa5/clone`, checked out at ea92621. `main` had moved on by the end
(`2dea2ac`); QA-23 is fixed there (`22f8286`), as the lead said. I did not test that commit.
Evidence root: `/home/ec2-user/.kiro/crew/kiroween2026/scratch/qa5/` (written `QA5/` below).
Earlier records: `qa-round3.md` (QA-01 to QA-21), `qa-round4.md` (QA-22 to QA-31).

## 1. Result

| Severity | Count | Ids |
| --- | --- | --- |
| S1 (a wrong fact shown as true) | 1 | QA-32 (borderline: no real package is hit, see the finding) |
| S2 (a flow that stops) | 0 | |
| S3 (looks or words) | 5 | QA-33 to QA-37 |

QA-22, QA-24, QA-26, QA-27, QA-28, QA-29, QA-30 are fixed (section 3). QA-31 is partly fixed: the fresh agent finished an
`is-odd` resurrection and listed 14 guesses; 3 of them are skill or recipe mismatches (QA-36).
All four engine rules I could reach work as `engine-r5.md` says on the real pages (section 4). The one place the README
rule is wrong is on invented README text (QA-32); on 2,536 real READMEs it flagged nothing wrongly.

Known and not counted, as the lead asked: the drafts' old numbers (a drafts refresh runs in parallel); QA-23 (fixed in
the refresh); QA-25 and QA-21 (accepted). Also known: the sibling repository
`/home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app` is still the old export (`bc2189b`, from `e5967c4717`);
a fresh export from ea92621 is `9346d41` (section 3, QA-27).

## 2. Findings

### QA-32 (S1, borderline) The README rule gives a hard `Dead` to a living package when its README holds an ordinary sentence of the wrong shape

- Surface: engine rule 1 (`packages/engine/src/sources/readme.ts`), web page, Crew tools.
- Steps, part 1 (the function on invented README heads; `QA5/scripts/readme-probe.mjs`, output `QA5/ev/readme-probe.txt`). Of 21 heads, these are flagged as a project statement although the project is alive:

| README text | Flagged as |
| --- | --- |
| `DEPRECATED: the --ignorePattern flag. Use --ignore.` (first line, a banner about a flag) | banner |
| `Deprecated: use the --new flag instead of --old.` | banner |
| `This library is deprecated for use with Webpack 4. Use foo@2 with Webpack 5.` | subject |
| `This tool is no longer supported on macOS 10.12. Everything else works.` | subject |
| `foo is deprecated on Windows 7. Use Windows 10.` | name |
| `Some people say "this project is deprecated". It is not; see the roadmap.` | subject |
| `This project is deprecated, just kidding, it is not.` | subject |
| `This package is no longer maintained here. Development continues in the foo-next repository, which is the same package at v3.` | subject |
| `This project is unmaintained.` followed by 300 words and then `We are looking for maintainers.` | subject |

Not flagged, correctly: the FAQ "Is this project deprecated? No", a deprecated sub-module, "no longer maintained by Acme Inc.", "legacy project, now in maintenance mode", a condition, another project's deprecation.
- Steps, part 2 (the real page, `QA5/scripts/h5-readme-e2e.mjs`, output `QA5/ev/readme-e2e.txt`). Upload `package.json` with `live-server ^1.2.2` and `scrollama ^3.2.0` (both quiet, last release 4.5 and 4.4 years ago). With their real READMEs: both `Dying`, heuristic, "The latest release is 4.5 years old." (correct, no false flag). Then, in the browser only, the README of each is replaced by one of the texts above (`DEPRECATED: the --ignorePattern flag.` and `This library is deprecated for use with Webpack 4.`): both cards become `Dead`, hard, with the epitaph `The README of the repository says: "DEPRECATED: the --ignorePattern flag."`.
- Incidence on real READMEs (`QA5/scripts/readme-corpus.mjs`, `readme-stale.mjs`; registry search plus `raw.githubusercontent.com`, no GitHub API): 1,291 packages released in the last year: 7 flagged; 1,245 packages whose latest release is 1.5 to 6 years old: 15 flagged. I read the README of 10 of the 22 flags (css-loader, style-loader, html-webpack-plugin, css-minimizer-webpack-plugin, arbundles, i18next-express-middleware, react-date-range, react-json-view, @idealyst/cli, oxc-plugin-react-compiler): every one says the project is deprecated, unmaintained or archived. So I found **no real false flag**. The two real "deprecated API" READMEs I could find among stale packages (`live-server`, `scrollama`, plus `react-lazy-load-image-component`, `qrcode.react`) are correctly not flagged by the rule.
- Why S1 and why borderline: a hard `Dead` on a living package is a wrong fact, and the rule has no check for a flag, a platform or a bundler version after the statement. No real README hit it in 2,536. A conductor may lower it to S3 or tighten the rule for the three shapes: a banner that names a flag or option, "no longer supported on <platform>", "deprecated for <tool and version>".
- Evidence: `QA5/ev/readme-probe.txt`, `QA5/ev/readme-e2e.txt`, `QA5/ev/readme-corpus.txt`, `QA5/ev/readme-stale.txt`, `QA5/ev/readme-stale.json`.

### QA-33 (S3) The README rule misses plain project statements (reach, not precision)

Among the 88 stale packages whose README head mentions deprecation and is not flagged, these say the project itself is finished, so they read `Dying` and not `Dead`:
`eslint-plugin-svelte3` ("This ESLint plugin is deprecated." under "Please use eslint-plugin-svelte instead"; the noun "ESLint plugin" is not in the list), `@m6web/eslint-plugin-i18n` ("# [DEPRECATED] eslint-plugin-m6web-i18n"), `react-password-strength-bar` ("[DEPRECATED] This repository will no longer be updated"), `react-smooth` ("# Unmaintained All animations are now merged in recharts"), `@kaizen/component-library` ("These are no longer maintained"), `babel-plugin-named-asset-import` (Create React App: "Deprecated"). `engine-r5.md` says precision comes first and names a similar miss; this is the reach of that choice. Evidence: `QA5/ev/readme-stale.txt`.

### QA-34 (S3) When `pnpm-workspace.yaml` is fetched but cannot be used, the page says it reads the file for a repository, and tells a repository scan to "use the repository address"

- Steps: stub `raw.githubusercontent.com/acme/pnpmroot` (`QA5/scripts/h3-pnpm-live.mjs`): `package.json` with `catalog:` entries and a `pnpm-workspace.yaml` that uses YAML anchors and aliases (`&c`, `*c`), or is malformed, or is 8 MB. Scan `acme/pnpmroot` from the start page.
- Expected: a reason for the failure ("pnpm-workspace.yaml was found but could not be read: ...").
- Actual: `0 dependencies read in 1 manifest, 4 not read` and the text "Their versions are written in pnpm-workspace.yaml, not in package.json. Necromancer reads pnpm-workspace.yaml for a GitHub repository. For an uploaded package.json, put the versions into the file, or use the repository address." This is a repository scan, the file was read from the repository, and no reason is given. No all-clear is shown (QA-22 holds). A YAML alias bomb (nine nested levels) is read in 1.4 s, and markup in a catalog version is shown as text (`window.__x` stays undefined).
- Evidence: `QA5/ev/pnpm-live.txt`.

### QA-35 (S3) A `Dying` card leads with the upgrade notice, and the real reason is lower down

- Steps: sample `appsecco/dvna`, open `express-fileupload ^0.4.0`.
- Actual: the card is `Dying`, heuristic. The drawer says "No successor is known yet, so there is nothing to resurrect onto." and the first epitaph line is "The version in use (0.4.0) is deprecated ... The package itself is not; this is an upgrade notice. Upgrade to 1.5.2". The cause of `Dying` is a later line: "No push to the repository for 1.3 years (last push 2025-07-05)". The README says upgrade notices "are never shown as dying"; here the verdict is dying for another reason, but the page leads with the notice, so it reads as the notice being the cause. "Ways out" does not list the upgrade.
- Evidence: `QA5/ev/drawer-appsecco-dvna-express-fileupload.txt`.

### QA-36 (S3) The skill still names files and markers that the curated raise recipe does not produce (found by the second fresh agent)

- Steps: `seance` preview of `is-odd` on a copy of the demo app that uses `is-odd` (the demo has no such package; I added `src/parity.js` and a test to the copy, `QA5/haunted-odd`).
- Actual: the bundle holds `seance/is-odd/seance.test.mjs`, `src/vendor/is-odd.mjs`, `seance/is-odd/README.md`. There is no `replacement.mjs` and the séance has no `// Generators` comment. `SKILL.md` step 6.3 (line 138: "the generated `seance/<name>/replacement.mjs`"), step 7 (lines 163 to 171, `replacement.mjs`) and step 8 (line 189: "everything from the `// Generators` comment") name both. The agent had to guess which file to mutate and where the generators start. The generated module is an ES module (`.mjs`) in a CommonJS project; the skill covers the conversion only for `replacement.mjs`.
- The agent's full list of guesses is in section 4.10.
- Evidence: `QA5/ev/seance-isodd.json`, `/home/ec2-user/.kiro/crew/subagents/626294694d144f6a/result.txt`.

### QA-37 (S3) Small wording items

- The generic séance README prints the same paragraph twice ("Replays 1 distinct call ... Count: 1 replayed + 2 left out + 1 with an argument that is not a plain literal = 4 calls."), under "What it compares" and under "Safety". The counts are right (QA-30 fixed). `QA5/ev/seance-js4.json`.
- The Crew `graveyard` tool: a not-found tombstone has `verdict: "not-found"` but no `notFound` field (the project has a `notFound` count). `QA5/ev/crew-graveyard-unknown.json`.
- Fixed since round 4 and seen to be fixed: `SKILL.md` line 32 now says `resurrection_spec` "returns the text of the three spec files ... it writes nothing"; `mcp-call.mjs --list` prints the argument shapes. Neither was among the second agent's guesses.

## 3. Re-tested findings

| Id | Round | State | Evidence |
| --- | --- | --- | --- |
| QA-22 | 4 | **Fixed.** `facebook/docusaurus` live (8 GitHub calls): "51 dependencies read in 1 manifest, 7 not read". The 7 `workspace:` links are named with how to check them; "Catalog versions read: 49 catalog: entries took their version from pnpm-workspace.yaml" (the file has them; the root has 49 catalog, 7 workspace, 2 alias entries = 58). Result: 4 dead (3 heuristic), 2 dying, 45 alive ("1 to upgrade"). Stubbed roots, all with no all-clear: a `workspaces` root with no dependencies ("Nothing found", workspaces named); 10 workspace links plus one real dependency ("1 read, 10 not read"); `catalog:` without the yaml ("0 read, 3 not read", says to put versions in the file); 30 workspace links ("0 read, 30 not read"); link, file, git, URL, github: and local entries ("0 read, 6 not read"). A folder upload holding `package.json` and `pnpm-workspace.yaml`: "Nothing was examined. All 3 dependencies in this project were left out"; a file upload of the two shows "One file was not read ... Continue with the 1 readable manifest" | `QA5/ev/live-facebook-docusaurus.txt`, `QA5/ev/mono.txt`, `QA5/shots/live-facebook-docusaurus.png`. Residual: QA-34 |
| QA-24 | 4 | **Fixed.** In the HEAD tree no host path outside `docs/verification` (one match: a spec sentence that says scripts must contain no `/home/ec2-user` path). The hook prompt now says the script builds its own scratch | `git grep` in section 6 |
| QA-26 | 4 | **Fixed.** `git ls-files packages/engine/test/fixtures/seance-runs` lists six `.json` and six `.log` files (is-odd, left-pad, mkdirp, pep8, querystring, toml); `git check-ignore` returns no match | section 6 |
| QA-27 | 4 | **Fixed.** `npm run export -- --target <tmp>/necromancer-crew-app --repo-url ... --main-url ...` created `9346d41` (26 commits, 165 files, no remote, clean status) and its own `verify-export` said `VERIFY OK` (37 s). New checks present: "README agrees with package.json on Node, quotes no test count: engines >=22.12; README Node: 22.12"; "mcp-call --list prints the argument shape of every tool: 11 of 11"; "diagnose of an unknown package says not-found, never alive". Tests 219. README: "Node.js 22.12 or newer", no "90+". The vendored engine equals `packages/engine/src` of HEAD (`diff -rq` empty) | `QA5/ev/export.log` |
| QA-28 | 4 | **Fixed** in diagnose, successors, autopsy, graveyard: `diagnose` for an npm name, a scoped name and a PyPI name that do not exist: `"verdict": "not-found"`, `"notFound": true`, `engineVerdict: alive` kept as a separate field; `successors` likewise; `resurrection_spec` says "was not found on the npm registry ... Do not migrate it"; `autopsy` summary `{"alive":1,"dead":1,"notFound":1}`; `nightwatch_run` reports `"notFound": 1`; `graveyard` counts exclude it. Residual: QA-37 (second bullet) | `QA5/ev/crew-*-unknown.json` |
| QA-29 | 4 | **Fixed.** `acme/note/c/d`, `.../blob/main/package.json`, `.../issues/12`, `.../pull/3/files`, `.../releases` each give a note "ignored: only the root is read"; `/tree/main/packages/web` gives `folder path "packages/web" was ignored`; `/tree/feature/x/sub` is read as branch `feature` with `folder path "x/sub" was ignored`. A query string or a fragment gives no note (harmless) | `QA5/ev/address.txt` |
| QA-30 | 4 | **Fixed.** QA project (4 calls): "1 replayed + 2 left out + 1 with an argument that is not a plain literal = 4 calls", host and path counted apart. A second mix of 19 calls (`request('plain-literal')` twice, a number, a template string, a variable, a spread, two hosts, three paths, a command-like string, two objects, a callback form, `.get`, `.post`, `.defaults`): "5 replayed (4 distinct) + 6 left out (2 host, 3 path, 1 command) + 8 not plain literals = 19", which matches the file by hand | `QA5/ev/seance-js4.json`, `seance-js5.json` |
| QA-31 | 4 | **Partly fixed.** The fresh agent finished (section 4.10). The skill's step 5 and the argument shapes are no longer in its complaints. New mismatches: QA-36 | |
| QA-23 | 4 | Known: still a syntax error at ea92621; fixed in `22f8286` (not tested) | `node --check` |

## 4. What I tested and found fine

### 4.1 Build and checks in a fresh clone (ea92621)

| Step | Result |
| --- | --- |
| `npm ci` in engine, web, crew, crew/ui | exit 0 |
| Engine `typecheck`, `test`, `build` | `Tests  632 passed \| 10 skipped (642)` (the 10 need a scratch folder) |
| Web `typecheck`, `test`, `build` | `Tests  376 passed (376)` |
| Crew `typecheck`, `test`, `build`, `smoke` | `Tests  219 passed (219)`; `SMOKE tools/list: 11 tools`; `SMOKE OK` |
| `verify:browser` / `verify:live` / `verify:samples` / `verify:seance` | 129 / 80 / 29 / 63 PASS, 0 FAIL, all `ALL CHECKS PASSED` |

Logs: `QA5/ev/run-*.log`, `QA5/ev/status.log`.

### 4.2 The four samples and the new rules

Cards equal graveyards: dvna 1 / 5 / 3 (alive 10), mathjs 1 / 17 / 6 (alive 43), microblog 0 / 3 / 8 (alive 43), SickChill 0 / 13 / 14 (alive 78); the heuristic counts under each chip: dvna zombie 1, dead 2, dying 3; mathjs zombie 1, dead 12, dying 6.

| Rule shown in the samples | What the page says | Check against the real source |
| --- | --- | --- |
| README statement, mathjs `karma` (Dead, hard) | `The README of the repository says: "Karma is deprecated and is not accepting new features or general bug fixes."` | `raw.githubusercontent.com/karma-runner/karma/master/README.md` line 12: `## Karma is deprecated and is not accepting new features or general bug fixes.` Same sentence. npm does not deprecate it (6.4.4, 2024-07-29) |
| mathjs `karma-firefox-launcher` (Dead, hard) | `The README ... says: "karma-firefox-launcher is deprecated and is not accepting new features or general bug fixes."` | README line 11, same words |
| Zombie basis, mathjs `expr-eval`, dvna `node-serialize` | Zombie with the heuristic pill; chip "1 heuristic" under Zombies; text "Looks abandoned (a heuristic, not a hard signal), and a known advisory affects the version you run" | Neither is deprecated or archived on its registry or repository (`expr-eval` repository not archived, last push 2024-08-15); OSV has 3 and 1 advisories |
| Upgrade target, mathjs `glob 11.0.3` | "Upgrade to 12.0.0, another major version, so read its changelog first." | Registry: glob 7 to 11 are all deprecated; 12.0.0 is the first release that is not; its `engines.node` is `20 \|\| >=22` (as the page says) |
| Upgrade target, dvna `bcrypt ^1.0.3` | "Upgrade to 5.1.1 (another major)" | Registry: 1.x to 4.x deprecated ("versions < v5.0.0 do not handle NUL"); 5.1.1 is the highest 5.x |
| Built-in alternative, glob | "Node 22.17 or later (added in Node 22.0, experimental until 22.17; stable in Node 24.0) also has fs.glob ... its options are fewer than the package has" | Node docs (`latest-v24.x/api/fs.json`): `fs.glob` added v22.0.0, "Marking the API stable" in v24.0.0; `latest-v22.x`: stable in v22.17.0 |

Upload of old versions of other packages (`QA5/scripts/h6-native.mjs`): `rimraf ^3.0.2` upgrade to 4.4.1 and "Node 14.14 or later also has fs.rm (or fs.rmSync) with { recursive: true, force: true } ... it does not do the package's glob patterns or its retries on Windows" (docs: `fs.rm` added v14.14.0; registry: rimraf 4.x has 3 free releases, highest 4.4.1); `glob ^7.2.3` to 12.0.0 (same reasoning); `uuid ^3.4.0` to 11.1.1 ("Node 14.17 or later (and 15.6 or later) also has crypto.randomUUID(), ... version 4 ids only"; docs: `randomUUID` added v15.6.0 and v14.17.0; registry: uuid 3 to 10 deprecated, 11.x free); `bcrypt ^3.0.0`: "version in use (3.0.8)", target 5.1.1; `express-fileupload ^0.4.0` to 1.5.2 (registry: 0.x all deprecated, 1.5.2 free). All match.
Renamed repository (rule 3): Crew `diagnose` of `PyPDF2` with GitHub on (2 calls): `dying`, heuristic, "The repository was renamed to py-pdf/pypdf, which now holds a different package, pypdf. Its commits, archive state and Scorecard are pypdf's, not pypdf2's ... pypdf is its way out", successor `pypdf`; `pypdf` itself is alive. GitHub answers 301 for `repos/py-pdf/PyPDF2`.

### 4.3 Other checks that held

- Address cases, bad URLs and hostile uploads from round 4 were not repeated, except: markup in a pnpm catalog version and in a patched npm record is shown as text (no script ran).
- Crew `seance` refused paths and names as in round 4; the exported app's `verify-export` covers `seance_write` on `main` (refused) and on `resurrect/left-pad` (writes).

### 4.9 Secret and host-path scan of the 29 commits after d07c468

`git log -p d07c468..ea92621`: authors: 29 of 29 are `Kiro Crew (agent) <agent@kiro-crew.invalid>`. Added lines against patterns for AWS keys, GitHub tokens, Slack, `sk-`, Google keys, private-key blocks, JWTs, npm and GitLab tokens, and quoted `password/secret/token/api_key` values: one match, the JWT of the PyJWT README inside a recorded fixture (`packages/engine/test/fixtures/recorded/GET_raw_githubusercontent_com_jpadilla_pyjwt_HEAD_README_rst_f93d369e.json`): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb21lIjoicGF5bG9hZCJ9...`, the public example token of the PyJWT docs (`{"some":"payload"}`), not a secret. Added lines with a host path (`/home/ec2-user`, `.kiro/crew`, `kiroween2026`): only in `docs/verification/` (`qa-round4.md`, `crew-r5.md`, `census-r5.md`). No new file named `.env`, `.pem`, `.key`, `.npmrc`. No new blob over 1 MB.

### 4.10 Fresh agent: one resurrection of `is-odd`

A new subagent (`626294694d144f6a`, 4 min 18 s) saw only the final `SKILL.md` (a copy, `QA5/skill`) and a copy of the demo app with `is-odd` added by me (`QA5/haunted-odd`), and called the tools through `mcp-call.mjs` with GitHub blocked. Result, checked by me in the repository: branch `resurrect/is-odd` from `main` (`1e71cc6`), 8 commits (`8b26bfc` spec, `5cda7ae` séance, `3f8c5cd` project-owned module, `32bb5a3` spec update, `2d5992b` example tests, `1cec1a0` switch, `b531360` golden guard, `6cccc96` remove is-odd); `npm test` `# tests 15`, `# pass 15`, `# fail 0`; `vitest run seance` after removal `Tests  2 passed | 4 skipped (6)` (the live comparison is skipped by design); a naive `n % 2 === 1 || n % 2 === -1` made 3 of 4 tests fail with `[-5e-324]` (old package throws, naive returns false); `git remote -v` empty; no push; `is-odd` is gone from `package.json` and `node_modules`.

The guesses it listed (14), grouped:
1. Skill and recipe mismatch: step 6.3 says mutate `replacement.mjs`, this recipe writes `src/vendor/is-odd.mjs`; step 8 names a `// Generators` comment that the séance does not have (it copied from `const strangeNumbers` through `const value`); the module is `.mjs` in a CommonJS project, so it wrote a CommonJS `src/vendor/is-odd.js` and used the two-line import (QA-36).
2. The golden template's `codec.mjs` cannot encode the séance's inputs (bigint, `Symbol`, functions, an object with `valueOf`); it extended the codec with three tags.
3. `record.mjs`: which "known" inputs to add (it chose `"abc"`, `3.5`, `2 ** 53`, `undefined`, `{}` and the project's values); the window loops are not in the golden file.
4. Step 8 `npm install --no-save <old>@<version>`: skipped (already installed, no network).
5. "Add one argument list by hand" per call site when every argument is a variable: it used the values from the project's tests and said so in a comment.
6. "Ask the person" with nobody to ask: it assumed yes, because the skill forbids only low-confidence ways out in an unattended run.
7. Task bookkeeping: task 2.4 ("old on both sides") run separately with a throwaway module; task 3.3 attribution added as a precaution; task 5.2 (audit) left unticked; the file name of the example tests; the `test` script and `seance` script edits; the review base taken as `main`; a stale header comment in `seance.test.mjs` left because only import lines may change.
8. `work_brief` and `work_report` answered `not_bound` in the subagent's session (expected for a stand-in, not a product defect).

By hand: the usage inventory and design sections, the departure paragraph, the CommonJS module and import change, the whole golden guard, the `skipIf`, the example tests, the package scripts and the uninstall.

### 4.11 Not repeated from round 4

I did not repeat the manual keyboard and phone-width runs, the mathjs mkdirp séance download, the contest-rules table or the quote table of round 4. The `verify:browser` run above covers keyboard, reduced motion, axe and the phone width (129 checks pass). I did not recompute the census quote table at this HEAD (`census-r5.md` changed it).

## 5. What I could not test

- GitHub: `https://github.com/tsumita2929/necromancer` and `https://tsumita2929.github.io/necromancer/` answered 404 at 17:12 UTC: **not pushed**. No real CI or Pages run.
- The census at the final engine (`census-r5.md`): I did not rerun `recompute.mjs` or the 100-project run (several hours of GitHub calls).
- Rule 3 beyond one real case (PyPDF2); the other renamed-repository cases of the census.
- The installed Crew app and its Graveyard page (no dashboard).
- A README rule false flag on a real package: none found in 2,536 READMEs; the false flags in QA-32 need invented text.
- Commits after ea92621 (`22f8286`, `0dd0087`, `2dea2ac` and later).
- Firefox, WebKit, a screen reader, macOS, Windows.

## 6. Budget and method

GitHub API calls by me: 11 of 40: 8 for `facebook/docusaurus` (a route in the browser refused the rest after 8), 2 for the `PyPDF2` diagnosis, 1 for the redirect check. Ledger: `QA5/ev/gh-ledger.txt`. `rate_limit` read before each live run (53 at the start, 60 after the 17:01 reset, 57 at the end). The README corpus used only the npm registry and `raw.githubusercontent.com`.
Two shell commands were refused by the host while I worked (one because a test string in a heredoc contained a destructive shell command as text, one because a long heredoc matched an ssh-to-this-host rule); I wrote the files with the file tool and replaced the destructive example with `ls -la`. No test was skipped.
Only this report was added to the repository. Commit identity: `Kiro Crew (agent) <agent@kiro-crew.invalid>`.

Host-path check of the tree at ea92621, for reference: `git grep -I -n -E "/home/ec2-user|/Users/[a-z]|ip-172-31|ec2-user|\.kiro/crew|kiroween2026" HEAD -- . ':!docs/verification'` finds one line (`.kiro/specs/engine-r4/requirements.md:62`, a rule that forbids such paths).
