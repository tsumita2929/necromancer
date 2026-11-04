# Requirements: engine round 5 (the last engine rules)

Source: `docs/research/census.md` section 9.12 (census worker, engine `32cc48d`) and `docs/verification/census-r4d.md`
section 5. This is the final engine change before the submission, so precision matters more than reach: a rule that
flags a living package is worse than a miss. Notation: EARS. **[PBT]** marks a requirement with a property test.

## E1. README statements about the project itself

- E1.1 WHEN the README of the repository of a package that looks unhealthy says that the project itself is deprecated,
  unmaintained or no longer maintained, THE verdict SHALL be at least `dead` with basis `hard`, the evidence SHALL be
  `readme-unmaintained` (source `readme`) quoting the sentence, and a recent commit SHALL NOT lift it.
- E1.2 A statement SHALL be one of: "this <project noun> is <dead word>"; "<Name> is <dead word>" at the start of a
  sentence, where <Name> is the package or the repository; a banner at the very top ("DEPRECATED", "No longer
  maintained", "Deprecated: use X instead"). The dead words are deprecated, unmaintained, abandoned, obsolete, end of
  life, no longer maintained / supported / developed.
- E1.3 THE following SHALL NOT be statements: a deprecated API, option, feature or version ("the `foo` option is
  deprecated", "version 1.x of this package is deprecated", "v1 is deprecated", "Support for Python 2 is deprecated");
  "not maintained by <company>"; "looking for maintainers" in the same or the next sentence; a negation, a future or a
  condition ("is not deprecated", "will be deprecated", "if this project is deprecated"); badges, images, code blocks and
  comments; a heading such as "## Deprecated" or a changelog line; another project ("the old package is deprecated");
  a README about deprecation in general ("this tool finds deprecated packages"). **[PBT]** (never throws, bounded time)
- E1.4 WHEN the sentence names a way out in the next sentence ("Use X instead."), THE successor SHALL be taken from it.
- E1.5 THE README SHALL be read only for packages that are not fresh and look unhealthy (as for the repository), from
  raw.githubusercontent.com (`README.md`, `README.rst`, `README`), never from the GitHub REST API, and not when the
  registry already ends the package's life.
- E1.6 WHEN the README of an archived repository says the project moved, THE existing rule (not an end of life) SHALL
  apply and the statement SHALL NOT be read.

## E2. The basis of a zombie

- E2.1 A zombie's `basis` SHALL follow the evidence of its death: `hard` when a hard signal (deprecated, archived,
  inactive, yanked, gone, a README statement) is present, `heuristic` when only the abandoned rule holds. The advisory
  stays in the evidence as the hard fact. **[PBT]**

## E3. A renamed repository that holds another package

- E3.1 WHEN GitHub forwards a repository to a name that differs (letters and digits only) from the old repository name
  and from the package name, AND the manifest at the head of the new repository names a different package that exists
  on the registry and is alive, THE old package SHALL read as moved: evidence `repo-moved` saying the repository now
  holds the other package, that package as successor, and nothing from that repository (commits, archive state,
  Scorecard, README) SHALL count for the old package.
- E3.2 THE manifest SHALL be `package.json` (npm; a private root is not a package) or `pyproject.toml` (PyPI; `[project]`
  or `[tool.poetry]` name). A missing or unreadable manifest SHALL change nothing.
- E3.3 A rename that only moves the owner, or renames to the package's own name, SHALL change nothing.

## E4. Built-in alternatives beside an upgrade notice

- E4.1 THE notice for a deprecated version of glob, rimraf, mkdirp, uuid or node-uuid SHALL name the built-in alternative
  and the Node version it needs, as the Node documentation gives them: fs.glob (Node 22.17, stable; added in 22.0),
  fs.rm with `recursive` (Node 14.14), fs.mkdir with `recursive` (Node 10.12), crypto.randomUUID (Node 14.17 and 15.6),
  with what to check before replacing the package. Other packages SHALL get nothing. No type changes.

## E5. A range-aware upgrade target

- E5.1 THE target SHALL be, in this order: the newest release inside the declared range that is not deprecated, yanked
  or a pre-release and is newer than the version in use; else the newest such release in the same major version; else
  the newest release of the lowest major above that has one. WHEN none is newer, the newest that qualifies, marked
  `older`. A range of `*`, `latest`, a tag or nothing is no range. **[PBT]**
- E5.2 THE sentence SHALL say which case it is, and for the next major version SHALL give its `engines.node` from the
  registry's manifest of that release (or say it declares none, or could not be read). One request per package and
  release, shared by every dependency on the package.

## E6. Evidence

- E6.1 FOR each rule the census (warm cache, fixed clock) SHALL be run before and after, every changed diagnosis listed,
  every new `dead` or `dying` flag checked against its README or registry page and judged right or wrong.
- E6.2 THE four recorded samples of the web app SHALL be replayed with the new engine and the changes listed.
