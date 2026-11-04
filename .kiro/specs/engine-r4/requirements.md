# Requirements: Engine fixes from the independent QA, and the researched successors

Source: `docs/verification/qa-round3.md` (QA-01, 07, 08, 16), `docs/research/successors.md`,
`docs/verification/successors.md`. Notation: EARS. **[PBT]** marks a requirement with a property test.

## Q1. Distinct vulnerabilities (QA-01)

- Q1.1 WHEN OSV returns several records for one version, THE engine SHALL merge records that name each
  other (or share a third id) in `id` or `aliases` into one vulnerability. GHSA, PYSEC, CVE and other ids
  all count. **[PBT]**
- Q1.2 THE advisory count, the evidence line and the zombie rule SHALL use distinct vulnerabilities.
- Q1.3 `Diagnosis.advisories` SHALL list one id per vulnerability (the GHSA id, else the CVE id, else the
  first of the others; the list is sorted);
  `Diagnosis.advisoryAliases` SHALL map that id to the other ids of the same vulnerability.
- Q1.4 A withdrawn record SHALL NOT count. Full records are read only for a version the batch lists two or
  more records for (one record cannot duplicate itself), so a lone withdrawn record is not detected.
- Q1.5 WHEN the alias data cannot be read, THE engine SHALL count the ids it has and say in `unavailable`
  that aliases were not merged.

## Q2. A package the registry does not know (QA-07)

- Q2.1 A package not found on its registry SHALL NOT be `dying`. THE verdict SHALL be `alive` with the
  evidence `registry-not-found` ("Not found ... removed, private or misspelled") followed by `unchecked`, so
  the web's "Not checked" mark shows, and `Diagnosis.notFound` SHALL be `true`.

## Q3. A generated séance is safe to run (QA-08)

- Q3.1 THE séance SHALL NOT replay a project call whose arguments name a network host, a URL, a
  file path outside a temporary directory, or a command to run.
- Q3.2 Calls it leaves out SHALL be counted and named in the test file, the README, `compares` and the spec.
- Q3.3 Calls it runs SHALL run with the network blocked and the working directory in a temporary directory,
  and the README and spec SHALL say which calls run and where.

## Q4. The skipped-entry message (QA-16)

- Q4.1 THE message for an invalid package name SHALL name the package and SHALL NOT quote the version as its
  source.

- Q4.2 WHEN the engine skips dependencies because of `maxDependencies`, THE message SHALL say "N more
  dependencies were not checked" and use the word "transitive" only when every skipped dependency is
  transitive (QA-14, added by the lead).

## Q5. Words for dead

- Q5.1 THE text in `types.ts` and `verdict.ts` SHALL describe `dead` as a hard signal or a heuristic by
  `basis`, not as always definitive.

## Q6. Researched successors

- Q6.1 THE engine SHALL load `docs/research/successors.json` as offline data (high and medium confidence
  first, low as suggestions) with a `SourceId` for a README or migration-guide source.
- Q6.2 On the census data THE engine SHALL name a way out for the 99 of 198 dead-or-worse dependencies of
  the research.

## Q7. Moved repositories

- Q7.1 A repository that moved SHALL be followed (HTTP 301 from the API, or a README that says it moved),
  never read as archived or gone because of the old address.

## Q8. Scripts

- Q8.1 Scripts in `packages/engine` SHALL contain no `/home/ec2-user` path; a path is relative or set by an
  environment variable with a clear error.
