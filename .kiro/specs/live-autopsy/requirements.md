# Live Autopsy: Requirements

Round 2 of the web app. The page runs the real engine in the visitor's browser. A public GitHub
repository gives a real graveyard. The samples are real reports recorded earlier. Round 1 terms
still hold (report, verdict, tombstone). *Source* means one of the public services the engine reads.
*Root* means the top folder of the repository, without sub-folders.

## R1 Real engine behind the data seam

**User story:** As a visitor, I want the verdicts to come from real data, so that I can trust them.

1. The data module `src/data/autopsy.ts` shall produce every report with `createEngine` from `@necromancer/engine`, using the browser's `fetch`.
2. The data module shall produce every Kiro spec with the engine's `resurrectionSpec`.
3. The engine shall load as a separate lazy chunk, only when a live autopsy or a spec is first needed.
4. The initial JavaScript shall stay at or below 150 kB gzip, and the CSS at or below 30 kB gzip.
5. The files under `src/ui` shall not import the engine; they shall call only the data module.
6. The page shall use one engine instance for its whole life, so repeated autopsies share answers and the GitHub budget.

## R2 GitHub repository input

**User story:** As a developer, I want to paste my repository and see its graveyard.

1. When the visitor gives `owner/repo`, `github.com/owner/repo`, `https://github.com/owner/repo` (with or without `www.`, a trailing slash, query or fragment), or a URL ending in `.git`, the app shall treat it as that repository on its default branch (`HEAD`).
2. When the URL has the form `.../tree/<branch>`, the app shall read that branch.
3. The app shall accept upper-case letters in owner and repository names and shall keep the case the visitor typed.
4. The app shall read these files from the root only: `package.json`, `package-lock.json`, `requirements.txt` and `pyproject.toml`, from `raw.githubusercontent.com`, and shall not call the GitHub REST API to read them.
5. While it reads a repository, the app shall say plainly that only the root is read and that manifests in sub-folders are not.
6. The app shall fetch the four files at the same time and shall use the ones that exist.
7. Where a file is larger than 5 MiB, the app shall skip that file, name it and the cap in a notice, and continue with the other files.
8. If no manifest exists at the root, then the app shall say which files it looked for and shall not show an empty graveyard.
9. If the repository does not exist or is private, then the app shall say "not found or private" and shall not claim to know which, because both look the same.
10. If GitHub's rate limit stops the check that tells these cases apart, then the app shall say so instead of "not found".
11. If a branch is named in the URL and does not exist, then the app shall say the repository or the branch was not found.
12. If the network is offline, then the app shall say it cannot reach GitHub, and shall offer to retry.
13. The error text shall name what the visitor can do next.

## R3 Progress, cancel and partial results

1. While an autopsy runs, the app shall show these stages with a running count of answers: manifests, package registries, advisories, repository checks.
2. The progress shall change at least once per answered request, and a screen reader shall hear the stage changes in the polite live region.
3. While an autopsy runs, the app shall offer "Cancel"; when the visitor activates it, the app shall stop all requests that have not started and return to the landing page.
4. Where the engine reports unavailable sources, the app shall show the graveyard with a partial-report notice that names each source and its reason (round 1 R10).
5. Where the GitHub budget or GitHub's limit of 60 calls an hour was reached, the app shall say that repository checks were skipped, and shall show every other result.
6. If every source fails, then the app shall show the manifests' dependencies with the notice and shall not show an error screen in place of the graveyard.
7. The app shall not show a verdict of "alive" as a statement of health for a dependency whose sources were all unavailable; the engine's own "unchecked" evidence shall be visible.

## R4 Upload and drop

1. The four manifest kinds, chosen or dropped, shall go through the real engine.
2. Uploaded files shall be read in the browser and shall not be sent anywhere except as package names and versions to the sources the engine reads.
3. A file over 5 MiB, an empty file or an unsupported name shall be refused with the file's name and the reason (round 1 R1.5, cap updated).
4. The landing page shall tell the visitor, in one line, what leaves the browser: package names and versions go to the public registries and advisory services.

## R5 Recorded samples

1. The landing page shall offer at least three samples, each a real public repository with a report recorded by the engine.
2. Each sample shall show the repository name, the ecosystem, the date it was recorded and its verdict counts.
3. A recorded report shall show "Recorded on <date>" with the repository name, and a control to run the same repository live.
4. Nothing invented shall appear in anything a visitor sees: no invented package, repository, advisory or number.
5. The recorded reports shall be stored as `AutopsyReport` JSON and shall be the engine's output without edits.
6. The 300-dependency stress sample shall exist in tests only.

## R6 Share link

1. A link to a live repository shall carry the repository, the branch and the view (filters, sort, search, open dependency).
2. When the visitor opens such a link, the app shall run the autopsy again and shall say that the result is live and may differ from when the link was made.
3. A link to a recorded sample shall reopen the recorded report and the same view.
4. A link to uploaded files shall keep working as in round 1 (limit 6000 characters).

## R7 Resurrection with the real engine

1. The Resurrect action shall show the engine's spec for the chosen dependency and successor and shall offer the same download as round 1.
2. While the engine chunk loads for the first time, the spec view shall show a loading line.
3. If the engine cannot be loaded, then the spec view shall say so and shall keep the evidence view usable.

## R8 Time

1. A repository of about 50 dependencies shall give its first tombstones in under 60 seconds on a normal connection.
2. The app shall measure and record the time in the verification file.

## R9 Privacy and limits

1. The app shall store nothing on the visitor's device and set no cookie.
2. The app shall send requests only to the public sources listed in the engine's CORS table.
3. The app shall not use a token or any secret.

## R10 Carried over

1. Round 1 requirements R3 to R17 still hold, except where this file changes them. The round-1 browser checks (axe, keyboard path, reduced motion, sub-path build) shall still pass.

## R11 Verification

1. In a real Chromium page with the network on, a live autopsy of a public repository shall complete, and each source's result shall be recorded in a CORS table.
2. Uploading the engine's acceptance project in the browser shall give the engine's own verdicts: request and node-sass zombie, tslint and left-pad dead, left-pad's first successor `String.prototype.padStart`, express alive.
3. The verification file shall list the nearby inputs and which were tested.
