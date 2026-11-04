# Requirements: a deprecated or yanked version of a living package is an upgrade notice

Found by the census (`docs/verification/census-r4.md` section 6, `docs/research/census.md` section 9.9):
the rule "only the version in use is deprecated or yanked, so the package is `dying`" (R2.11 of
`vital-signs-engine`) is the main source of overstated flags. Out of sample, 4 of the 5 units that were not
defensible were eslint, @xmldom/xmldom, @testing-library/jest-dom and codemirror. Notation: EARS.
**[PBT]** marks a requirement with a property test.

Principle. A signal about the package decides whether it is alive. A signal about the version in use
(an advisory, a deprecated version, a yanked version) is a notice on that verdict. That is how an alive
dependency with advisories is already treated.

## N1. The verdict

- N1.1 WHEN the version in use is deprecated (npm) or yanked (PyPI), THE verdict and its `basis` SHALL be the
  ones that the signals about the package alone give. Adding `version-deprecated` or `version-yanked` to any
  evidence list SHALL change neither. **[PBT]**
- N1.2 THE evidence line SHALL stay in the diagnosis with the same code (`version-deprecated`,
  `version-yanked`), so a consumer can read "alive, with a deprecated version in use".
- N1.3 WHEN the latest release is deprecated (`npm-deprecated`) or yanked (`pypi-yanked`), THE verdict SHALL be
  `dead` as before; with an advisory `zombie`; with a gone repository `ghost`. No version-in-use line SHALL be
  added then.
- N1.4 A package with a deprecated version in use SHALL still have its repository read when the latest release is
  not fresh, as before, so an archived or abandoned package is found the same way.
- N1.5 Stale signals SHALL still make a package `dying` (basis `heuristic`) when they are present; the notice is
  shown next to them.

## N2. What to upgrade to

- N2.1 `Diagnosis.upgradeTo` (additive, optional) SHALL name `{ version, sameMajor }`: the newest stable release
  that is neither deprecated nor yanked, newer than the version in use, in the same major version when there is
  one, else the newest of another major version.
- N2.2 WHEN no newer release qualifies, THE target SHALL be the newest qualifying release with `older: true`
  (the version in use was published above the real latest, as codemirror 6.65.7 was above 6.0.2); WHEN none
  qualifies, `upgradeTo` SHALL be absent and the evidence line SHALL say that no newer stable release is free of
  deprecation or yanking.
- N2.3 THE evidence line SHALL carry the target in words ("Upgrade to X (same major version)."). **[PBT]** (rule)
- N2.4 Pre-releases SHALL never be the target. PyPI versions SHALL be ordered by PEP 440, npm versions by semver.

## N3. Resolution for PyPI ranges (R2.13, amended)

- N3.1 WHEN a PyPI dependency has no lockfile version and a range, THE version in use SHALL NOT be a yanked
  release if another release satisfies the range (PEP 592). A pin with `==` and a lockfile version are taken as
  they are.

## N4. Generated text

- N4.1 THE generated Kiro spec for an `alive` diagnosis that carries the notice SHALL say that the package is
  maintained, that only the version in use is deprecated or yanked, that this is an upgrade notice and not a
  sign of death, and what to upgrade to.
- N4.2 THE spec for any other verdict SHALL read as before.

## N5. Evidence

- N5.1 ON the census (warm cache, fixed clock) the dependencies that had `version-deprecated` and were `dying`
  SHALL become `alive` with the notice, and no other verdict SHALL change except for yanked versions
  (explained in the record). Census claim C1 SHALL be unchanged.
