# Requirements: séance recipes and the version of the old package

Found by the web worker while adding `josdejong/mathjs` as a sample: its dev dependency is mkdirp 3.0.1,
and the generated mkdirp séance (written for 1.0.4) imported a default export that 3.x does not have. Notation: EARS.
**[PBT]** marks a requirement with a property test.

## V1. The mkdirp recipe follows the version in use

- V1.1 THE mkdirp séance SHALL run, with the real replacement passing and every mutant failing, against
  mkdirp 0.5.x, 1.x, 2.x and 3.x.
- V1.2 THE test file SHALL import the module as a namespace and use the default export when there is one and
  the named exports when there is not.
- V1.3 WHEN the version in use is 0.x, THE replacement and the test SHALL use the callback API and the answer
  `null` (mkdirp 0.5); otherwise the promise API and `undefined`. WHEN the version is not known, the modern
  flavour is used.
- V1.4 THE test file SHALL warn (not fail) when the installed version is not among the versions the recipe was
  run against, and SHALL fail with a plain message when the installed major version is not of the family the
  file was written for.

## V2. Every bundle says which versions it was run against

- V2.1 EVERY `SeanceBundle` of a curated recipe SHALL carry `oldVersions`: the old package, the versions it was
  run against and fits (`testedAgainst`), those it was run against and does not fit with the reason
  (`doesNotFit`), the successor versions, the date, the version in use and where it comes from, whether it is
  covered, and one plain note.
- V2.2 THE note SHALL appear in the README ("Versions"), in `compares` (and so in the generated spec).
- V2.3 WHEN the version in use is outside the versions run, or the recipe does not fit it, THE note SHALL say so
  and that the séance may fail or pass for reasons that are not the replacement's.
- V2.4 FOR a version range without a lockfile, THE bundle SHALL be called covered only if some version in the
  range was run, none that was run in it fails, and no published version in it was left unrun. **[PBT]**
- V2.5 FOR the generic template THE note SHALL say that no version was run.
- V2.6 THE versions SHALL come from real runs recorded in `test/fixtures/seance-versions/` by
  `scripts/run-seance-versions.mjs`, and `src/seance/tested-versions.ts` SHALL be written from them.

## V3. Verification

- V3.1 THE record SHALL list, for each recipe, the versions of the old package run, which fit, which do not and why,
  and the latest release of the old package and of the successor.
