# Verification: séance generator

Item: Necromancer R2, `packages/engine` (`src/usage`, `src/seance`). Written after the typecheck and
the tests passed. Run on 2026-11-04 (UTC), Node 22.12.0, Python 3.9.25, Vitest 5.1.0, fast-check
4.10.2, pytest 8.4.2, Hypothesis 6.141.1.

Spec: `.kiro/specs/seance/` (requirements R1 to R5, design, tasks 1 to 14 ticked).
Commits: `a875cf8` spec, `b2c9357` types and usage scan, `3b70bf8` generator, recipes and harness,
`fb3eb87` generator tests and two fixes; the final commit adds this record and the demo script.

## 1. What was built

```
source files ──scanUsage──▶ DependencyUsage ─┐
diagnosis + successor ───────────────────────┼─▶ pickRecipe ─▶ curated recipe  ─┐
                                              │             └─▶ generic template ─┴▶ SeanceBundle
                                              └─▶ resurrectionSpec(…, { usage }) describes it
```

- **Usage scan** (`src/usage`): a lexer and a recogniser per language, no parser library, so it runs in
  the browser. JavaScript and TypeScript (all import forms, `require`, dynamic `import()`, re-exports,
  type-only imports, aliases, deep imports) and Python (`import`, `from`, aliases, try/except and function
  imports, relative imports ignored, PyPI-to-import-name table). It records members, call sites,
  argument counts, spread, Python keyword names and the literal arguments of each call.
- **Séance generator** (`src/seance`): six curated recipes and a generic template. Each bundle is a
  runnable differential property test (Vitest + fast-check, or pytest + Hypothesis), a replacement
  module and a README, plus the known differences and what is compared.
- **resurrectionSpec** now takes `{ usage }` and describes the séance (files, run command, compared and
  ignored, known differences) in requirements (R2.5, R2.6), design and tasks (2.5). Calls with two
  arguments keep every earlier sentence.

## 2. Commands and results

All run in `packages/engine` unless noted.

| Command | Result line |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json` exit 0 (now with `noUnusedLocals`) |
| `npx vitest run` | `Test Files  14 passed (14)` / `Tests  294 passed (294)` |
| `npx prettier --check src test scripts vitest.config.ts` | `All matched files use Prettier code style!` |
| `npm run build` then `node scripts/smoke-node.mjs` | `SMOKE OK: … exports … generateSeance,… pickRecipe,resurrectionSpec,scanUsage` |
| `node scripts/run-seances.mjs` | six lines, all `OK` (section 3) |
| `node scripts/demo-seance.mjs` | `projectCalls = [["7", 3, "0"], ["abc", 6, ""]]`, `Tests  6 passed (6)` |
| `npx tsc --noEmit` in `apps/web` | exit 0 |
| `npx tsc --noEmit` in `apps/crew` | exit 0 |

The web and crew typechecks were run read-only against the final tree. The first run of the web
typecheck failed on an unused import in `src/seance/generic.ts` (the web app turns on
`noUnusedLocals`). It is fixed, and the engine's own tsconfig now has `noUnusedLocals` so the same
mistake fails here first.

New tests in this round:

| File | Tests | What |
| --- | --- | --- |
| `test/usage.test.ts` | 30 | Every nearby input (section 6), robustness, timing |
| `test/properties/usage.property.test.ts` | 7 | Scan properties R1.11 to R1.13 |
| `test/seance.test.ts` | 23 | Recipe choice, bundle shape, usage reaches the file, generic template, spec text, engine members, no throw |
| `test/properties/seance.property.test.ts` | 7 | Deterministic, syntactically valid, no injection |
| `test/isomorphic.test.ts` | 52 | Now lexes the source, so strings that mention `node:fs` in generated code are not findings; the check proves it can fail |

## 3. Every curated séance, run for real

Harness: `scripts/run-seances.mjs`. For each recipe it writes the generated files into the scratch
directory (`/home/ec2-user/.kiro/crew/kiroween2026/scratch/seance`, with the old and new packages installed),
runs the real test runner, then replaces the replacement file with each mutant (a deliberately wrong
replacement), runs again, restores the real file and runs a last time. Logs and JSON:
`packages/engine/test/fixtures/seance-runs/<recipe>.{json,log}`.

| Recipe | Pair | Real versions | Real run | Mutant 1 | Mutant 2 |
| --- | --- | --- | --- | --- | --- |
| `left-pad` | left-pad 1.3.0 → `String.prototype.padStart` | vitest 5.1.0, fast-check 4.10.2 | 6 passed | `naive-padStart` fails: `["",Number.POSITIVE_INFINITY,undefined]` | `off-by-one` fails: `["",1,""]` |
| `querystring` | querystring 0.2.1 (the npm package) → `URLSearchParams` | same | 8 passed | `naive-URLSearchParams` fails: `["?"]` | `drops-repeated-keys` fails: `["%25&%25&="]` |
| `mkdirp` | mkdirp 1.0.4 → `fs.mkdir` recursive | same | 6 passed | `naive-mkdir-recursive` fails: `[[],["a"],"",{"mode":488}]` | `returns-last-directory` fails: `[[],["a","a"],"",undefined]` |
| `is-odd` | is-odd 3.0.1 → code the project owns (raise) | same | 4 passed | `no-conversion` fails: `[-5e-324]` | `missing-safe-integer-check` fails: `[9007199254740992]` |
| `toml` | toml 0.10.2 → tomli 2.5.0 | pytest 8.4.2, hypothesis 6.141.1 | 64 passed, 1 skipped | `naive-tomli` fails (`AttributeError` from `tomli.load(path)`) | `swallows-errors` fails: `']0 = ""'` |
| `pep8` | pep8 1.7.1 → pycodestyle 2.14.0 | same | 13 passed | `naive-rename` fails: `W503` appears | `ignores-too-much` fails: `E203` disappears |

All six end with `restoredExit: 0`: after the mutant runs the real replacement passes again. The skipped
`toml` test is the parametrised "project's own calls" test, which has no cases when no usage was given.
Python 3.9 has no `tomllib`, so the `toml` séance targets tomli (the same API, which became `tomllib`).

`pycrypto` to `pycryptodome` was planned and dropped: pycryptodome installs the same top-level
module name (`Crypto`), so the old and the new package cannot be loaded in one process. A séance for that
pair would need two environments and a subprocess. This is a known gap (section 8).

## 4. Real differences the séances found

This is the part for the demo and the write-up. Nobody wrote these differences down before the
property tests found them. Each is listed in the bundle's `knownDifferences` and in the generated README
and migration spec. "Reproduced" means the generated replacement keeps the old answer; "accepted" means it
does not, on purpose, and a test pins both answers.

### left-pad to `padStart` (the obvious migration is not a drop-in)

| Input | left-pad | Naive `padStart` | Generated replacement |
| --- | --- | --- | --- |
| `leftPad("abc", 6, "")` | `"   abc"` | `"abc"` | reproduced |
| `leftPad("abc", 6, "xy")` | `"xyxyxyabc"` | `"xyxabc"` | reproduced |
| `leftPad("abc", 6, null)` | `"   abc"` | `"nulabc"` | reproduced |
| `leftPad("abc", Infinity, "-")` | `"abc"` | `RangeError` | reproduced |
| `leftPad("abc", 5.5)` | `"undefinedabc"` | `"  abc"` | accepted: **a bug in left-pad** (a fractional length below 10 with a space fill reads a missing cache entry) |

The first run of the séance failed on `["","3.5",null]` and showed `"undefined"` as left-pad's answer. My own
first replacement was wrong there, and the shrunk counterexample showed that left-pad has a real bug.

### querystring (npm) to `URLSearchParams`

| Input | querystring | Naive `URLSearchParams` | Generated replacement |
| --- | --- | --- | --- |
| `parse("a=%zz")` | **throws `URIError`** | `{ a: "%zz" }` | accepted (no crash on a bad escape) |
| `parse("&&a=1&&")` | `{ "": ["","","",""], a: "1" }` | `{ a: "1" }` | accepted |
| `parse("?a=1")` | `{ "?a": "1" }` | `{ a: "1" }` | reproduced |
| `parse` of 1001 pairs | keeps the first 1000 | keeps 1001 | accepted (cap the input yourself) |
| `stringify({ a: "x y" })` | `a=x%20y` | `a=x+y` | reproduced |
| `stringify({ a: null })` | `a=` | `a=null` | reproduced |
| `stringify({ a: "!'()*~" })` | unescaped | `%21%27%28%29*%7E` | reproduced |

The security-relevant line is the first one: with the old package a single malformed percent escape in a
request throws; with `URLSearchParams` it does not. Note that `import "querystring"` gets Node's built-in
module, never the npm package; the séance loads the package with `require("querystring/")`.

### mkdirp to `fs.mkdir` recursive

Two differences, both reproduced: the empty path (`mkdirp.sync("")` is a no-op, native throws `ENOENT`) and a
mode given as a number (ignored by the native call). The séance compares the whole resulting tree and the
folder modes, not just the return value; 300 generated trees plus 100 async ones matched.

### is-odd (raise)

The owned six-line function matched is-odd on 3000 generated values and on every integer in windows around
zero and around the safe-integer limit. The obvious rewrite `n % 2 === 1` differs for `3.5`, `2 ** 53`, `"abc"`, `undefined`
and `{}` (is-odd throws, the rewrite answers `false`). This recipe found no surprise in is-odd itself; it shows
that the raise path is safe to own because the original is the oracle.

### toml to tomli: faults of toml itself

The séance was meant to find where tomli differs. It found that **toml is wrong** in several places, and
that tomli is stricter or more correct:

| Input | toml | tomli |
| --- | --- | --- |
| `"\u0041" = 1` (escape in a quoted key) | key is the text `\u0041` | key is `A` |
| `a = 07:32:00.5` | drops the fraction | keeps `500000` microseconds |
| `a=1 b=2` | accepts, key `a=1 b` | refuses |
| `a = 1 # NUL`, control characters in strings | accepts | refuses |
| `"" = ""` then `0 = ""` | **crashes with `UnboundLocalError`** | reads both keys |
| `"ª" = ""` then `0 = ""`, or a key with `:` | silently returns `{}` (all data lost) | reads both keys |
| `[""]` | refuses | accepts |
| `a = [true[` (unfinished array) | accepts | refuses |
| `a = [1, "x"]` (mixed array) | refuses | accepts (valid TOML 1.0) |
| `a = "\x41"` | refuses | accepts |

Reproduced in the replacement: the old exception name (`TomlDecodeError` is `tomli.TOMLDecodeError`), the
`_dict` argument, `load` with a path, bytes path or text file, and the `TypeError` for a binary file. The rule for damaged documents
is one-sided and counted: where both accept they must agree except for the faults above; where only one
accepts the standard decides; the replacement must answer exactly like `tomli.loads`. Not covered: `dumps`
(use tomli-w), a list of paths for `load`.

### pep8 to pycodestyle: a rename that changes the results

| Input | pep8 1.7.1 | pycodestyle 2.14.0 | Generated replacement |
| --- | --- | --- | --- |
| `l = 1` | none | E741 | hidden |
| bare `except:` | none | E722 | hidden |
| `"\d"` | none | W605 | hidden |
| code after a function without blank lines | none | E305 | hidden |
| `def m(a: int=1)` | none | E252 | hidden |
| nested `def` with no blank line | none | E306 | hidden |
| default ignore list | six codes | also W503, W504 | pep8's list restored |
| `d.has_key(1)` | W601 | none | accepted (Python 2 checks removed) |
| `async def` after an import | no blank-line checks | E302 | accepted (pep8 predates `async`) |
| `type(a) == type(b)`, a comment then `def`, an import after an `if` | no E721, E302 reported, no E402 | E721, no E302, E402 | **not hidden, not reproduced**: E301 to E304, E402 and E721 fire on different patterns; the séance leaves them out and says so |

The six "hidden" rows are examples of the twelve codes in `NEW_CODES`: a project that changes only the import would see its lint
step turn red. The shim drops them by default and lists them so each can be adopted later.

## 5. Property tests

Names cite the requirement they check.

| Requirement | Property | File |
| --- | --- | --- |
| R1.12 | The scan finds exactly the imports and calls of generated JavaScript programs (default, namespace, aliased named, `require`, destructured `require`, `require` in a function, `await import`), mixed with decoys | usage property |
| R1.11 | Decoys alone (comments, block comments, strings, template text, regex, JSDoc, trailing comment, look-alike packages, relative paths) give no imports and no members; the same program with the decoys removed gives the same usage | usage property |
| R1.11, R1.12, R1.9 | Same for Python: `import` as, `from` as, try/except, function, dotted; decoys in comments, strings, docstrings, raw triple quotes, relative imports, look-alike names | usage property |
| R1.13 | Arbitrary text, binary text, damaged real code and token soup never throw in either language; site lists stay under 50; time grows linearly | usage property |
| R2.10 | The same inputs give the same files, for curated and generic bundles with hostile input | seance property |
| R2.11 | Every curated recipe and every mutant parses (`node --check` for ES modules, `ast.parse` for Python); also hostile names, members, literals and specifiers across 120 generated scenarios | seance property |
| R2.12 | A marker placed in names, members, literals, specifiers and keywords never appears as an identifier in the generated code (checked by lexing the output); file names use a safe alphabet; the run command uses a safe alphabet; the check proves it can fail | seance property |
| R2.13 | `generateSeance` and `resurrectionSpec` never throw for `undefined`, `null`, `{}`, numbers and strings in every position | seance test |

### Bugs the property tests caught that example tests missed

| Bug | Caught by | Detail |
| --- | --- | --- |
| **Generic Python template was not valid Python.** A strategy line ended `st.one_of(...)  # TODO(necromancer): …,` so the comma was inside the comment and the next line was a syntax error. | R2.11 (hostile and generic scenarios) | The curated recipes had been run for real, the generic template never had. The syntax check found it on the first run. Fix: the comma is written before the comment. |
| **Docstring breakout.** The dependency name went into a Python docstring through a function that flattened lines but kept `"""`, so a name containing `""" ; code ; """` closed the docstring and became code. | R2.12 (the marker appeared as an identifier) | Fix: `docText` removes quotes and backslashes from text placed in a docstring. |
| Quadratic or wrong behaviour in the scan | none found | The scan passed all its properties on the first run, including the timing property; the first failures were test mistakes (a line comment decoy swallowing the next piece) and were fixed in the test. |

The third row is stated because the pattern from the engine round repeated: the parsers held up, and the
generated *output* is where the bugs were. The séances themselves, which are property tests over
third-party packages, are what found the real differences in section 4.

## 6. Nearby inputs and which are tested

All in `test/usage.test.ts` unless noted.

| Input | Tested |
| --- | --- |
| Aliased imports (`import { a as b }`, `const { a: b } = require()`, `import * as ns`, `default as x`) | yes; properties use aliases and destructuring too |
| Re-exports (`export { a as c } from`, `export * from`, `export * as ns from`, `export type { D } from`) | yes |
| `require` inside a function or conditional | yes (example and property) |
| `require('x').foo`, `require('x')(…)`, `require('x').default` | yes |
| Dynamic `import()` with a literal (bound, destructured, inline `(await import()).b`) | yes |
| Dynamic `import()` with a non-literal argument or a template | yes: counted in `unresolvedDynamicImports`, not attributed |
| TypeScript type-only imports (`import type`, `{ type B }`, `export type {}`, `import type x = require`) | yes; not counted as runtime use, a types-only file is not "using" the package |
| `import x = require('y')` | yes |
| JSX files (`.jsx`, `.tsx`), an apostrophe in JSX text | yes |
| CommonJS default interop (`.default`, a default import called as a function) | yes |
| A dependency imported but never called | yes (`neverCalled`), also a re-export-only file |
| Deep import (`lodash/fp/get`, `lodash/fp`) | yes: subpath kept as `fp/get#default` |
| Scoped packages, look-alike names (`left-pad-extra`), relative paths, `node:` specifiers | yes |
| Imports and uses in comments, strings, template text, regexes | yes (examples and properties) |
| Python: `import x`, `as`, dotted, `from … import` with alias, parenthesised and multi-line lists, `;`-joined statements | yes |
| Python: imports inside try/except, functions, `if True: import …` | yes, marked `guarded` |
| Python: relative imports (`from . import toml`, `from .toml import x`, `from ..toml import y`) | yes: never the dependency, even with its name |
| Python: star import, keyword arguments, f-string fields, docstrings | yes |
| Python: distribution-to-import-name table (`pycrypto` → `Crypto`) and caller-supplied names; `Foo-Bar` → `foo_bar` | yes |
| Hostile names, members, literals and specifiers in the generator | yes (property) |
| Shadowing (a local variable with the name of an import) | no: a documented gap |

## 7. `types.ts` changes (all additive)

New types: `SourceFile`, `ImportForm`, `UsageImport`, `LiteralArg`, `UsageSite`, `MemberUsage`,
`DependencyUsage`, `UsageTarget`, `SeanceFile`, `KnownDifference`, `SeanceBundle`.
Changed members of `Engine`: `resurrectionSpec(diagnosis, successor, options?: { usage?: DependencyUsage })`
(a new optional third parameter) and two new optional members, `scanUsage?` and `seance?`. No existing type
or member was removed or changed. The web and crew typechecks pass against the result.

New exports of `src/index.ts`: `scanUsage`, `generateSeance`, `pickRecipe`, `RECIPES`. They were added in the
commit where the typecheck and all tests were green.

## 8. Known gaps

1. **Shadowing is not modelled.** A local variable with the name of an imported binding is read as a use of
   the import. `eval`, computed member names and re-binding (`const f = ns.pad; f()` counts as an access,
   not a call) are also not followed.
2. **The scan reads one file at a time.** A project module that re-exports the dependency and is imported
   elsewhere is not followed.
3. **Only literal call arguments become examples.** A call such as `leftPad(n, 6, "0")` contributes no fixed
   example (its first argument is a variable); the generated generators still cover it.
4. **Same import name, two packages.** pycrypto and pycryptodome both install `Crypto`, so no séance can load
   both. A séance for that pair needs two virtual environments and a subprocess.
5. **Six recipes only.** Everything else gets the generic template, which is a skeleton: its generators are
   guesses from the observed literal kinds, its comparisons stay skipped until `READY` is set, and it was
   checked for syntax and for injection but not run against real packages.
6. **Recipes encode versions.** They were run against left-pad 1.3.0, querystring 0.2.1, mkdirp 1.0.4,
   is-odd 3.0.1, toml 0.10.2, tomli 2.5.0, pep8 1.7.1 and pycodestyle 2.14.0. A newer successor can change a
   known difference; the pinned tests on both sides are there to say so.
7. **Not covered by a recipe:** the callback form of mkdirp 0.5 and custom `fs` options; `toml.dumps`, a list of
   paths for `toml.load` and the `decoder` argument; the pep8 command line and configuration files; pep8's
   E301 to E304, E402 and E721, which the shim does not reproduce.
8. **Python 3.9 on the host**, so `tomllib` was not testable; the toml séance targets tomli, whose API is the
   same.
9. **The séances are run by a harness, not by `npm test`.** The unit tests check the generated text (syntax,
   injection, determinism). The real runs need the scratch directory with the packages installed; their results
   are recorded in `test/fixtures/seance-runs`. The hook `engine-seance-recipes` asks for a re-run when a recipe
   changes.
10. **Lexer limits.** The JavaScript lexer decides between a division and a regular expression from the previous
    token; after `)` it assumes division. An unclosed string ends at the end of its line, so one stray quote in
    JSX text can hide the rest of that line.

## 9. Files

- Source: `packages/engine/src/usage` (`lex-js.ts`, `scan-js.ts`, `lex-py.ts`, `scan-py.ts`, `index.ts`),
  `packages/engine/src/seance` (`index.ts`, `recipe.ts`, `generic.ts`, `emit.ts`, `examples.ts`, `readme.ts`,
  `recipes/*.ts`), `packages/engine/src/spec.ts`, `packages/engine/src/types.ts`, `packages/engine/src/index.ts`.
- Scripts: `scripts/run-seances.mjs`, `scripts/demo-seance.mjs`.
- Records: `packages/engine/test/fixtures/seance-runs/*.json` and `*.log`.
- Spec: `.kiro/specs/seance/{requirements,design,tasks}.md`.
- Hook: `.kiro/hooks/engine-seance-recipes.kiro.hook`.
