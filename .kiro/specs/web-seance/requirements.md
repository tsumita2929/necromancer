# Séance in the Web App: Requirements

Round 3 of the web app. The engine now writes a *séance* for a migration: a differential
property test, a replacement module and a README (`generateSeance`), and it can read how a project
uses a dependency (`scanUsage`). This feature puts both behind the Resurrect action. Terms from
`graveyard-web` and `live-autopsy` still hold. *Source files* are the project's own code files
(`.js .mjs .cjs .jsx .ts .mts .cts .tsx .py`). *Usage* is the engine's `DependencyUsage`.

## R1 The séance in the Resurrect flow

**User story:** As a developer, I want a test that proves the replacement answers like the dead
package, so that I can migrate without guessing.

1. When the visitor presses Resurrect, the page shall show, next to the three spec files, the files of the séance that `generateSeance` produces for the chosen dependency and successor: the differential test, the replacement module and the README (and any helper file).
2. The page shall show each file in full, one at a time, with the same tabs and keyboard behaviour as the spec files.
3. The page shall show above the files: whether the séance comes from a curated recipe or from the generic template; the install commands; the run command; what the séance compares; and the known differences between the old package and its successor.
4. Where the séance is the generic template and has `TODO(necromancer)` markers, the page shall say how many are left and that they must be filled before the test can run.
5. The files shown shall be exactly the files the engine returned, byte for byte.
6. The spec shown shall come from `resurrectionSpec(diagnosis, successor, { usage })` with the same usage as the séance, so that it describes this séance.
7. Where the visitor chooses another way out (another successor), the spec and the séance shall be generated again for that successor.

## R2 Download

1. The page shall offer one zip with the spec under `.kiro/specs/<slug>/` and the séance files under their own paths (for example `seance/left-pad/seance.test.mjs`), and a second zip with the séance only.
2. Every file in a zip shall be byte-identical to the file shown.
3. Every path in a zip shall be relative, free of `..` and control characters.
4. The page shall offer to copy the file on screen.

## R3 The project's own calls

1. Where the page has the project's source files, it shall pass them through `scanUsage` for the chosen dependency and give the result to the séance and to the spec.
2. Where the page has no source files, it shall say so in words next to the séance, and generate without usage.
3. Where the page has source files and none of them imports the dependency, it shall say so, and generate without usage.
4. Where the page has usage, it shall say how many source files it read, how many use the dependency, and which members.
5. The page shall have source files from these places: a project folder chosen or dropped on the start page; or, for a GitHub repository or a recorded sample, a bounded number of files read from `raw.githubusercontent.com`.
6. The page shall not call `api.github.com` to find source files.

## R4 Folder upload

1. The start page shall accept a folder, chosen or dropped, and shall find its manifests and its source files.
2. The page shall skip these folders: `node_modules`, `.git`, `dist`, `build`, `out`, `coverage`, `.next`, `.venv`, `venv`, `env`, `__pycache__`, `site-packages`, `vendor`, `bower_components`, `target`, `.tox`, `.cache`.
3. The page shall read at most 1500 source files, at most 512 KiB from one file, and at most 16 MiB in total, and shall stop reading files when a limit is reached, without reading the rest.
4. The page shall say what was skipped and why: how many files over the size limit, how many beyond the count or total limit.
5. The page shall clean every file path before use: no leading slash or drive, no `..` segment, no control or bidirectional-override character, at most 300 characters. A path that cannot be cleaned shall be skipped and counted.
6. File names shall be shown as text and never as markup.
7. The source files shall stay in the browser; they shall not be sent anywhere and shall not be put in the share link.

## R5 Reading source from GitHub

1. For a repository or a recorded sample, the page shall read source files from `raw.githubusercontent.com` after the visitor presses Resurrect, and shall say that it does.
2. It shall start from the entry files named in `package.json` (`main`, `module`, `bin`, `exports` as text) and a short list of usual entry files, and follow relative imports (JavaScript and TypeScript) and relative or root-level imports (Python), up to 60 files and 150 requests.
3. It shall request at most 6 files at a time, and shall stop at once when the visitor leaves the page.
4. Where it reaches a limit, it shall say so.
5. Where the repository has no readable entry file, it shall say so and generate without usage.

## R6 Nothing else changes

1. The engine chunk shall stay lazy; the initial JavaScript shall stay at or below 150 kB gzip.
2. The round-1 and round-2 checks (axe, keyboard path, reduced motion, sub-path, size budgets, the stubbed live checks) shall still pass.
3. No file under `packages/engine` shall change.

## R7 Verification

1. For `left-pad`, the files the page offers shall be byte-identical to `generateSeance`'s output for the same inputs.
2. The downloaded test, run in a scratch directory with `left-pad` installed, shall pass; with the replacement swapped for one of the recipe's mutants, it shall fail.
3. The verification file shall list the nearby inputs and which were tested: a dependency without a curated recipe, a raise successor, a Python dependency, a project without source files, hostile file names, and a very large source folder.
