# Requirements: Séance generator

A séance is a differential property-based test. It asks a dead package and its replacement
the same generated questions and fails on any different answer. This feature finds how a
project uses a dead dependency (the usage scan), then writes a runnable séance for the
migration (the generator), and puts it into the resurrection spec.

Code: `packages/engine/src/usage` and `packages/engine/src/seance`. Contract additions are in
`packages/engine/src/types.ts` and are optional and additive. Notation: EARS. **[PBT]** marks a
requirement with a property test whose name cites its id.

## R1. Usage scan

**User story.** As a developer, I want to know which parts of a dead package my code calls, so
that the séance asks about those parts and nothing else.

- R1.1 WHEN source files and a dependency are given, THE scan SHALL return the imports of that
  dependency, the members used, and for each member the call sites with argument counts.
- R1.2 THE scan SHALL read JavaScript and TypeScript (`.js .jsx .mjs .cjs .ts .tsx .mts .cts`) and
  Python (`.py`) files, chosen by extension, and SHALL ignore other files.
- R1.3 THE scan SHALL recognise, for JavaScript and TypeScript: default, named, namespace and
  side-effect imports; `import x = require()`; `require()` bound to a name, destructured, or
  used directly; dynamic `import()` with a literal specifier; and re-exports
  (`export { a } from`, `export * from`, `export * as ns from`).
- R1.4 THE scan SHALL follow local aliases (`import { a as b }`, `const { a: b } = require()`,
  `import * as ns`), and report the member under its original name.
- R1.5 THE scan SHALL mark type-only imports (`import type`, `import { type A }`) and SHALL NOT
  count them as runtime use.
- R1.6 THE scan SHALL match a deep import (`lodash/fp/get`) to the package and keep the subpath.
- R1.7 WHEN an `import()` has a specifier that is not a string literal, THE scan SHALL count it
  as an unresolved dynamic import and SHALL NOT attribute it to any package.
- R1.8 THE scan SHALL recognise, for Python: `import x`, `import x as y`, `import x.y`, `from x import
  a, b as c`, `from x.y import z`, and imports inside `try`/`except`, functions and `if` blocks.
- R1.9 THE scan SHALL NOT treat relative imports (`from . import x`, `from .x import y`) as the
  dependency, even when the local module has the dependency's name.
- R1.10 THE scan SHALL map a PyPI distribution name to its import names (for example `pycrypto` to
  `Crypto`) from a built-in table, and SHALL accept caller-supplied import names.
- R1.11 THE scan SHALL NOT report text inside comments or string literals as an import or a use.
  **[PBT]**
- R1.12 THE scan SHALL find every import of the dependency in generated programs. **[PBT]**
- R1.13 THE scan SHALL NOT throw for any input and SHALL finish in time linear in the input size.
  **[PBT]**
- R1.14 WHEN the dependency is imported but never called, THE scan SHALL say so (`neverCalled`).
- R1.15 THE scan SHALL record, for each call, the literal arguments (string, number, boolean,
  null) so that the séance can use the project's own calls as examples.
- R1.16 THE scan SHALL record keyword argument names of Python calls.

## R2. Séance generator

**User story.** As a developer moving off a dead package, I want a test that proves the
replacement answers like the old package, and shows me where it does not.

- R2.1 WHEN a diagnosis, a successor and (optionally) a usage are given, THE generator SHALL
  return a bundle of files: the séance test, a replacement module, and a README.
- R2.2 THE generator SHALL write JavaScript séances for Vitest and fast-check, and Python séances
  for pytest and Hypothesis, matching the ecosystem of the dependency.
- R2.3 THE séance SHALL import the old package and the replacement, draw inputs from a generator per
  used member, call both with the same input, and compare the outcomes after the normalisations the
  recipe documents.
- R2.4 THE outcome of a call SHALL be either a returned value or an error kind, so a call that
  throws in one and returns in the other is a difference.
- R2.5 THE generator SHALL include curated recipes for at least four real pairs across both
  ecosystems, each with generators written for the real API, and a mutant (a deliberately wrong
  replacement) used to prove the séance can fail.
- R2.6 WHEN a recipe knows a real difference between the old package and the successor, THE
  bundle SHALL list it in `knownDifferences`, THE replacement module SHALL handle it, and THE
  séance SHALL contain a test that shows the naive replacement fails on it.
- R2.7 WHEN no recipe matches, THE generator SHALL write a generic template whose generators
  come from the observed call sites, whose gaps are marked `TODO(necromancer)`, and whose
  comparisons stay skipped until the replacement is written.
- R2.8 WHEN the successor kind is `raise`, THE bundle SHALL contain a dependency-free
  reimplementation and a séance against the original package.
- R2.9 WHEN a usage is given, THE séance SHALL cover the members the project uses and SHALL add the
  project's literal call arguments as fixed examples.
- R2.10 THE generator SHALL be deterministic: the same inputs give the same files. **[PBT]**
- R2.11 THE generated JavaScript SHALL be syntactically valid ECMAScript modules and THE generated
  Python SHALL be syntactically valid Python 3. **[PBT]**
- R2.12 Package names, member names and any text from the diagnosis or usage SHALL reach the
  generated code only as escaped string literals or as identifiers built from a safe alphabet, so
  untrusted text cannot inject code. **[PBT]**
- R2.13 THE generator SHALL NOT throw for any input and SHALL return a generic bundle for
  malformed input.

## R3. Resurrection spec

- R3.1 THE `resurrectionSpec` function SHALL accept an optional usage and SHALL describe the
  séance: the files it adds, the command that runs it, and what it compares and ignores.
- R3.2 WHEN the pair has a curated recipe, THE spec SHALL list its known differences.
- R3.3 THE spec SHALL stay deterministic, SHALL keep the sanitising of untrusted text, and every
  requirement id cited in the tasks SHALL exist in the requirements (R6.2 of the engine spec).
  **[PBT]**
- R3.4 WHEN `resurrectionSpec` is called as before (two arguments), THE existing sentences of its
  output SHALL stay.

## R4. Contract and packaging

- R4.1 THE changes to `types.ts` SHALL only add types, optional fields and optional `Engine`
  members.
- R4.2 THE new modules SHALL be isomorphic: no Node-only or browser-only API in `src/`.
- R4.3 THE engine SHALL expose `scanUsage` and `seance` as optional members, and export the
  functions and types from `src/index.ts` only when all tests and the typecheck pass.

## R5. Verification

- R5.1 EVERY curated recipe SHALL be run against the real old and new packages installed in a
  scratch directory, and its result recorded.
- R5.2 FOR every curated recipe, a mutant replacement SHALL make the séance fail with a shrunk
  counterexample, and the failure SHALL be recorded.
- R5.3 WHEN a séance finds a real difference, THE counterexample SHALL be recorded and THE
  generated replacement SHALL handle it.
