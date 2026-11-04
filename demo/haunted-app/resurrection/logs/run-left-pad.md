# Necromancer run: left-pad in haunted-app

> Paths: `<scratch>/` stands for the scratch folder of the machine where this run was made. The host path was replaced; nothing else in this log was changed.

Copy: `<scratch>/haunted-app` (base branch `main`, new branch `resurrect/left-pad`).
Tools were called through `scripts/mcp-call.mjs`; every answer carried `"engine": "engine"` (not the stub).
Nothing was pushed, no remote exists in the copy, git configuration was not changed (commits used `git -c user.name=Necromancer -c user.email=necromancer@example.invalid`, because the repository has no identity configured).

## Step 1. Check the tree

```
$ git rev-parse --is-inside-work-tree   -> true
$ git status --porcelain                -> (empty)
$ git branch --show-current             -> main      (the base)
$ npm test                              -> # tests 10  # pass 10  # fail 0
```

## Autopsy (before choosing)

```
$ mcp-call.mjs autopsy '{"path":".../haunted-app"}'
manifests: package-lock.json, package.json
summary: {"alive":7,"dying":10,"dead":31,"ghost":0,"zombie":1}
unavailable: github - "GitHub budget reached (20 calls per scan, limit is 60 per hour): 25 repositories were not checked"
direct dependencies: request ^2.88.2 = zombie, left-pad ^1.3.0 = dead, moment ^2.31.0 = alive
```

Chosen: left-pad (as the user asked). Usage in the project: `grep -rn "left-pad\|leftPad" src test README.md`

```
src/receipt.js:3:  const leftPad = require('left-pad');
src/receipt.js:34: ... leftPad(order.id, 8, '0')
src/receipt.js:44: leftPad('x' + item.qty, QTY_WIDTH)
src/receipt.js:45: leftPad(money(cents, symbol), PRICE_WIDTH, fill),
src/receipt.js:51: leftPad(money(total, symbol), PRICE_WIDTH, fill),
README.md:10: | `left-pad` | zero padded order numbers and the money column | ...
```

## Step 2. Diagnose

```
$ mcp-call.mjs diagnose '{"ecosystem":"npm","name":"left-pad"}'
MCP error -32602: Input validation error: Invalid arguments for tool diagnose: expected array, received undefined at dependencies
$ mcp-call.mjs diagnose '{"dependencies":[{"ecosystem":"npm","name":"left-pad"}]}'
verdict: dead
 npm-deprecated: Deprecated on npm: "use String.prototype.padStart()"  (2018-04-09)
 abandoned: the latest release (1.3.0) is 8.6 years old ... (low OpenSSF Maintained score)
 no-release-long: The latest release (1.3.0) is 8.6 years old.
 low-maintenance: OpenSSF Scorecard rates maintenance 0 out of 10.
advisories: []
latest: 1.3.0 (2018-04-09T01:10:45Z)
```

## Step 3. Choose the way out

```
$ mcp-call.mjs successors '{"ecosystem":"npm","name":"left-pad"}'
verdict: dead
successors: [{"name":"String.prototype.padStart","kind":"native", "reason":"padStart is built into every supported JavaScript runtime."}]
```

Chose `native` (the only one offered, and the first in the skill's order). `engines.node` is `>=18`; padStart exists since Node 8.

## Step 4. Branch

```
$ git switch -c resurrect/left-pad
Switched to a new branch 'resurrect/left-pad'
```

## Step 5. Spec

`mcp-call.mjs resurrection_spec '{"ecosystem":"npm","name":"left-pad","successor":"String.prototype.padStart"}'` returned the three files. Written to `.kiro/specs/migrate-off-left-pad/{requirements,design,tasks}.md` and made concrete: usage inventory table with the real file and line numbers (R1), call-site rewrite in design.md, usage list also saved in `docs/migration/left-pad-usage.md` (task 1.2). EARS numbering kept. The "Known behavioural differences" section was filled in after step 6 (below).

## Step 6. Séance

Dev dependency added with npm (the project had no property-based test tool):

```
$ npm install --save-dev fast-check
package.json: "devDependencies": { "fast-check": "^4.10.2" }   (package-lock.json updated)
```

Test file: `test/seance.leftpad.test.js`, `node:test` runner, `fc.assert` called (through a small `assertProperty` wrapper) inside `test(...)`. 1000 runs per property (`SEANCE_RUNS` overrides). Generators, not narrowed:

- value: integers (0..99999999, -1000..1000, safe-integer extremes), arbitrary doubles (NaN, infinities, -0, fractions), strings (empty, 300 characters, unicode/grapheme/binary); plus the real column shapes `'x' + qty` and `symbol + (cents / 100).toFixed(2)` with a free symbol.
- width: -5..20, 0, 1, 4, 8, 10, 0..200, 200..5000.
- `fill`: `''`, `' '`, single characters, multi-character strings (`'ab'`, `'..'`, `'<>'`, `'👻'`, `'👻🎃'`), arbitrary binary strings of 0..4 characters, graphemes; and a second property with non-string fills (null, false, true, 0, -0, NaN, numbers).
- Errors compared by kind (constructor name); no call threw in the domain.

### Old versus old (harness check), run twice

```
$ node --test --test-name-pattern="old versus old" test/seance.leftpad.test.js     (run 1)
ok 1 - séance harness: left-pad vs left-pad (old versus old)     # pass 1  # fail 0
$ (run 2)
ok 1 - séance harness: left-pad vs left-pad (old versus old)     # pass 1  # fail 0
```

### First old-versus-new run (new side = bare `String(value).padStart(width, fill)`): REAL DIFFERENCES

```
not ok 4 - séance: left-pad vs String.prototype.padStart (money column, free fill option, width 10)
    Counterexample: ["0.00",""]
    left-pad and padStart disagree for input {"text":"0.00","width":10,"fill":""}
      left-pad: {"value":"      0.00"}
      padStart: {"value":"0.00"}
not ok 5 - séance: left-pad vs String.prototype.padStart (any value, any width, any fill)
    Counterexample: ["",1,".."]
    left-pad and padStart disagree for input {"value":"","width":1,"fill":".."}
      left-pad: {"value":".."}
      padStart: {"value":"."}
# pass 4  # fail 2
```

Passing at that point: order number (fill `'0'`, width 8), quantity column (no fill), any value/width with no fill.

Probing the two differences by hand (old = left-pad, new = padStart):

```
["0.00","",10]   old "      0.00" (10)       new "0.00"
["$6.00","ab",10] old "ababababab$6.00" (15) new "ababa$6.00" (10)
["x","👻",4]     old "👻👻👻x" (7)           new "👻\ud83dx"   (lone surrogate)
["$6.00",null,10] old "     $6.00"           new "nulln$6.00"
["$6.00",false,10] old "     $6.00"          new "false$6.00"
["$6.00",0,10] / [..,5,10]  old = new ("00000$6.00" / "55555$6.00")
```

So: (1) an empty/null/false fill pads with spaces in left-pad and does not (or writes the word) in padStart; (2) a fill longer than one UTF-16 unit makes left-pad overshoot the width (every line of the receipt then differs in length, which breaks the existing test "every line of the table has the same width" for that option), while padStart repeats and cuts at the width, sometimes in the middle of a surrogate pair.

### Decision (recorded in `design.md` under "Known behavioural differences")

- Matched the old behaviour where it was sensible: a new project-owned module `src/pad.js` (`padLeft(value, width, fill)`, no dependencies, calls `String(value).padStart`) pads with spaces when `fill` is missing, `''`, null, false or NaN, and uses any other fill as a string (so the number 0 pads with "0", as before).
- Accepted padStart's behaviour for a fill longer than one UTF-16 unit when the value is shorter than the width (result is exactly `width` long; old result overshot). Accepted, not fixed: an astral fill such as `'👻'` can be cut in half on an odd number of missing columns.
- The generator was NOT narrowed. For these inputs the séance asserts the accepted contract (`padLeft` equals `String(v).padStart(w, fill)`) and asserts left-pad really overshoots the width, so the exception cannot go stale. A pinned test counts that such inputs are generated.

### Old versus new, final

```
$ npm test            (left-pad still installed at that point)
ok 11 - séance harness: left-pad vs left-pad (old versus old)
ok 12 - séance: left-pad vs String.prototype.padStart (order number, fill 0, width 8)
ok 13 - ... (quantity column, no fill, width 4)
ok 14 - ... (money column, free fill option, width 10)
ok 15 - ... (any value, any width, any string fill)
ok 16 - ... (any value, any width, non-string fill)
ok 17 - ... (any value, any width, no fill)
ok 18 - séance: known difference, a fill longer than one character, is pinned
ok 19 - séance: padLeft vs the recorded answers of left-pad
# tests 19  # pass 19  # fail 0  # skipped 0
```

Generated cases: 8 properties x 1000 runs = 8000 random cases (harness, order number, quantity, money column, any string fill, non-string fill, no fill, pinned difference) plus the golden replay of 2,344 recorded cases (12 values x 8 widths x 14 fills grid = 1,344, plus 1,000 seeded random cases; file `test/seance.leftpad.golden.json`, 402 KB).

## Step 7. Migrate task by task

Commits (tasks ticked in `tasks.md` in the same commits):

```
2f51b50 Add migrate-off-left-pad spec, padLeft and the left-pad séance        (tasks 1, 2, 3)
4125b5b Replace left-pad with padLeft in src/receipt.js                       (task 4)
5be3070 Record left-pad answers as a golden file for the séance
c7b2fa5 Remove left-pad from package.json and package-lock.json              (task 5, 6)
```

`src/receipt.js` diff: line 3 `const { padLeft } = require('./pad');`, and `leftPad(` becomes `padLeft(` at lines 34, 44, 45, 51. After task 4: `npm test` -> 18 pass, 0 fail.

## Step 8. Remove the dead dependency

The séance needs left-pad as its oracle, so the golden file was recorded first (commit 5be3070, `SEANCE_RECORD=1`), then:

```
$ npm uninstall left-pad --offline
found 0 vulnerabilities
$ git diff --stat -> package-lock.json | 8 ----, package.json | 1 -
$ grep -n '"left-pad"' package.json package-lock.json   -> (nothing)
$ npm test
# tests 19  # pass 11  # fail 0  # skipped 8      (8 live comparisons skip: left-pad not installed; golden replay passes)
```

With the package put back temporarily (`npm install --no-save left-pad@1.3.0`, then `npm prune --offline`): `# tests 19  # pass 19  # fail 0  # skipped 0`. Final state: left-pad not in `node_modules`, `package.json` or `package-lock.json`; working tree clean.

## Proof that the séance can fail

Break 1: `src/pad.js`, `const pad = !fill && fill !== 0 ? ' ' : String(fill);` replaced by `const pad = fill;` (not committed, reverted with `git checkout -- src/pad.js`):

```
not ok 4 - ... (money column, free fill option, width 10)
    Counterexample: ["0.00",""]   Shrunk 1 time(s)
      left-pad: {"value":"      0.00"}   padStart: {"value":"0.00"}
not ok 5 - ... (any value, any width, any string fill)
    Counterexample: [0,200,""]   Shrunk 2 time(s)
not ok 6 - ... (any value, any width, non-string fill)
    Counterexample: ["",200,null]   Shrunk 2 time(s)
      padStart: "nullnullnull..." (200 characters)
not ok 9 - séance: padLeft vs the recorded answers of left-pad
    input {"value":"","width":1,"fill":""}   left-pad: " "   padStart: ""
# pass 5  # fail 4
```

Break 2: `padStart(width, pad)` replaced by `padStart(width - 1, pad)` (reverted the same way):

```
not ok 2 - ... (order number, fill 0, width 8)
    Counterexample: [0]   input {"value":0,"width":8,"fill":"0"}
      left-pad: {"value":"00000000"}   padStart: {"value":"0000000"}
not ok 3 - ... (quantity column, no fill, width 4)
    Counterexample: ["x0"]   left-pad: "  x0"   padStart: " x0"
not ok 4 ... Counterexample: ["0.00",""]
not ok 7 - ... (any value, any width, no fill)
    Counterexample: ["",1]   left-pad: " "   padStart: ""
not ok 8, not ok 9 (golden replay)
# pass 1  # fail 8
```

## Step 9. Final state and review command

```
$ git log --oneline --stat main..resurrect/left-pad      (four commits above)
$ git diff --stat main..resurrect/left-pad
 .kiro/specs/migrate-off-left-pad/design.md       |  57 +++++
 .kiro/specs/migrate-off-left-pad/requirements.md |  61 +++++
 .kiro/specs/migrate-off-left-pad/tasks.md        |  19 ++
 docs/migration/left-pad-usage.md                 |  12 +
 package-lock.json                                |  51 +++-
 package.json                                     |   4 +-
 src/pad.js                                       |  20 ++
 src/receipt.js                                   |  10 +-
 test/seance.leftpad.golden.json                  |   1 +
 test/seance.leftpad.test.js                      | 311 +++++++++++++++++++++++
 10 files changed, 532 insertions(+), 14 deletions(-)
```

Review: `git diff main..resurrect/left-pad` in the copy. Nothing was pushed.

## Skill problems

1. **The skill's own native séance shape hides the differences.** "`leftPad(s, n, c)` vs `s.padStart(n, c)` over arbitrary `s`, `n` in `[-5, 200]` and one-character `c`" would have passed here. The two real differences are an empty fill and multi-character fills; the project's `fill` option is free. The skill should say to draw options as the project allows them, not to assume one-character `c`.
2. **`diagnose` does not take `{ecosystem, name}`.** The skill and BRIEF say "call diagnose with the dependency (ecosystem and name)"; the tool needs `{"dependencies":[{"ecosystem","name"}]}` and rejected the first call. `successors` and `resurrection_spec` do take `ecosystem`/`name`.
3. **No plan for the séance after the dead package is removed.** The séance needs the old package as the oracle; step 8 deletes it. The generated `design.md` says "record the old outputs as a golden file" but the skill has no step or format for it. I recorded a seeded golden file and made the live comparisons skip when the package is absent.
4. **The "native" successor does not allow a project-owned shim.** Step 7 says replace calls with the platform call; the séance showed a bare `padStart` changes behaviour, so a tiny owned wrapper (`src/pad.js`) was needed. The skill only offers the shim under `raise`.
5. **Generated `design.md` names Vitest** ("fast-check with Vitest"); the project uses `node:test`. The template should follow the project's runner.
6. **Failure print does not survive the runner.** fast-check puts the property's own error in `error.cause`; `node:test` prints only "Counterexample", so R2.2 (print input and both answers) fails unless the test folds `cause.message` into the error. Not mentioned in the skill.
7. **`node --test` (Node 22) runs every `.js` file under `test/`.** Helper modules next to the séance would be executed as tests; the golden data had to be `.json`.
8. **"If the séance fails: offer two choices and leave the task unticked until the user decides" conflicts with the BRIEF** ("decide how the migration handles it"). I followed the BRIEF and recorded the decision.
9. **"Run it against the old code twice (old vs old)" is ambiguous**: no command or reason for twice is given. I ran an old-versus-old property twice with a name filter.
10. **The skill says the spec is three files**, but the generated tasks.md asks for `docs/migration/left-pad-usage.md` (task 1.2). I wrote it.
11. **Autopsy output is 67,000 characters** for a three-dependency project (48 transitive packages of `request`) and exceeds a normal tool output; the skill gives no advice to filter by direct dependency. The GitHub budget notice ("25 repositories were not checked") is only in the `unavailable` field.
12. **Commit identity:** the skill says "use the repository's own commit identity settings", but this repository has none (user.name is empty), so commits needed `-c user.name/-c user.email`. The skill should say what to do then.
13. The generated design.md header reads "Current version in use: latest is 1.3.0", because `diagnose` got no spec; it does not say what version the project resolves.

## Not done / open

- Work-item tools: `work_brief` answered `not_bound` (this session has no bound item), so no `work_report` was sent.
- `README.md` line 10 still lists `left-pad` as a haunted dependency (the README says the directory is the demo narrative; not edited).
- The astral-character fill case (`'👻'`, odd number of missing columns) now yields a lone surrogate; accepted and documented, not fixed. The owner of the `fill` option may prefer to validate it as one character.
- Browser support: not applicable (Node project, `engines.node >=18`).
- The 8 live comparisons skip after removal by design; run `npm install --no-save left-pad@1.3.0 && npm test` to run them again.
