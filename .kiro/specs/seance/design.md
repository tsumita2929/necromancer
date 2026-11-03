# Design: Séance generator

Implements `requirements.md` in this folder.

## Flow

```
SourceFile[] ──scanUsage──▶ DependencyUsage ─┐
Diagnosis + Successor ───────────────────────┼─▶ pickRecipe ─▶ recipe.build(ctx) ─▶ SeanceBundle
                                              │        └─ none ─▶ generic template
                                              └─▶ resurrectionSpec(…, { usage }) adds the séance section
```

## Usage scan (`src/usage`)

No parser library: the engine must run in a browser and stay small. Each language has a
**lexer** that turns text into tokens, and a **recogniser** that reads patterns over tokens.
Because comments and strings become single tokens, text inside them is never read as code
(R1.11).

JavaScript lexer: line and block comments; `'` `"` strings; template literals with nested `${}`;
regular expression literals (decided from the previous token); numbers; identifiers; punctuation.
A string that is not closed ends at the end of the line, so an apostrophe in JSX text damages one
line, not the file. Python lexer: `#` comments; strings with prefixes (`r b f u rb br`), single and
triple quotes; brackets tracked so a logical line may span physical lines; backslash continuation.

Recogniser, JavaScript: finds import forms by token patterns and records **bindings**
(`local name → {specifier, member | default | namespace | whole}`). Then it walks the tokens once
more for each binding name and records a **site**: a call (`x(…)`, `x.m(…)`, `x.m.n(…)`), an
access (`x.m`), or a reference (`f(x)`). It skips `.x` property names and `x:` object keys. Calls
are parsed to count top-level arguments, spread, and literal arguments. Shadowing is not modelled
(documented gap).

Recogniser, Python: finds statements that start with `import` or `from` (after a newline, `;`, or a
`:` such as `except ImportError: import tomli`), skips relative imports, maps import names, and
records bindings. Uses are attribute chains `x.a.b(…)` and `from`-bound names, with positional
argument counts and keyword names.

Output is the `DependencyUsage` type in `types.ts`. Site lists are capped (50 per member) and the
scan stops reading a file after 2 MB, with a problem.

## Séance generator (`src/seance`)

A **recipe** is a record: `{ id, ecosystem, language, old, matches(successor), build(ctx), mutants }`.
`build` returns a `SeanceBundle` (files as strings). Recipes are TypeScript template functions that
call the emit helpers; no recipe interpolates text directly.

Emit helpers: `js.str(text)` returns a JSON string literal with the extra escapes for U+2028/9;
`js.ident(text)` returns an identifier made of `[A-Za-z0-9_]` or a fallback; `py.str(text)` returns
a Python string literal built from `\xNN`/`\uNNNN` escapes for anything outside printable ASCII;
`py.ident` likewise; `comment(text)` strips control characters and line breaks. Generated files
carry a header with the recipe id and a statement that they were generated.

### Outcome model

Both sides are called as `outcome(fn, args)`, which returns `{ ok: true, value }` or
`{ ok: false, error: <kind> }`. The error kind is the constructor name (JavaScript) or the exception
class name (Python); the message text is never compared. Each recipe documents its **normalisation**
(for example: query objects are compared as sorted entry lists, so key order does not matter).

### Replacement and known differences

Each recipe ships a `replacement` module, the code the project would adopt. A recipe is written in
two steps: first the **naive** replacement (`String.prototype.padStart`), run against the old
package to find real differences; then the **compat** replacement that handles them. The séance
tests the compat replacement with a property, and tests the naive one inside `it.fails` /
`pytest.mark.xfail(strict=True)` with the known counterexamples passed as forced examples, so the
difference is documented and deterministic.

### Generic template

For an unknown pair the generator writes the same structure with: one generator per used member,
derived from observed literal arguments (string → `fc.string()`, number → `fc.integer()`, others →
`fc.anything()` marked `TODO(necromancer)`), the project's literal calls as examples, and a
replacement stub that throws. The comparisons are skipped until `READY` is set to true in the
replacement module.

### Raise path

For `kind: 'raise'` the recipe writes `replacement` as a dependency-free module in the project's
`src/vendor/`, plus the séance against the original.

### Files in the project

```
seance/<slug>/seance.test.mjs     (JavaScript)  or  seance/<slug>/test_seance.py  (Python)
seance/<slug>/replacement.mjs     or replacement.py
seance/<slug>/README.md
```

## Resurrection spec

`resurrectionSpec(diagnosis, successor, { usage })` calls the same recipe selection to learn the
file names, the run command, the comparison and the known differences, and adds them to
requirements, design and tasks of the migration spec. With no usage it behaves as before and
adds the generic paths.

## Testing strategy

| Requirement | Test |
| --- | --- |
| R1.11, R1.12 | Property: generated programs with imports in code and decoys in comments and strings; the scan finds exactly the code imports. |
| R1.13 | Property: arbitrary text and mutated real files never throw; time stays linear. |
| R1.3 to R1.10, R1.14 to R1.16 | Examples for every nearby input (see seance.md). |
| R2.10 | Property: same input twice gives equal bundles. |
| R2.11 | Property: generated files parse (`node --check` for ESM, `ast.parse` for Python), for every recipe and the generic template, with hostile names. |
| R2.12 | Property: hostile names never appear outside string literals or comments (checked by parsing and by a decoy marker). |
| R2.3 to R2.9, R5 | The harness `scripts/run-seances.mjs` writes each bundle into the scratch directory, runs it for real, then runs each mutant, and logs the result lines. |
