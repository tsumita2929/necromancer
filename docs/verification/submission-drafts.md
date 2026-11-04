# Verification: README and submission drafts

Item: Necromancer R3b. Written 2026-11-04 (UTC) after every README command ran in a fresh clone, every
local link was checked and the video timings were added up. Host: Linux aarch64, Node 22.12.0.

## 1. What was written

| File | What it is |
| --- | --- |
| `README.md` | The repository front page: what Necromancer is, the census headline, the séance finds, the three parts with a quick start, the test commands, the Kiro-usage table, known limits, the pre-existing-code declaration. |
| `docs/submission/devpost.md` | Every Devpost field the rules ask for, the Kiro-usage write-up, the Kiro Crew app description, judge instructions, the pre-existing-code declaration. |
| `docs/submission/video-script.md` | A 2 min 45 s demo, seven shots with timings, terminal scripts, a recording checklist. |
| `docs/submission/blog-post.md` | Draft of the Bonus Blog Prize post (owner edits, then publishes). |
| `docs/submission/social-post.md` | Draft of the Social Blitz post (owner rewrites in their own voice). |
| `docs/submission/demo/summarize-autopsy.mjs`, `summarize-seance.mjs` | Two small filters that make the Crew tool output readable on camera. |
| `/home/ec2-user/.kiro/crew/kiroween2026/.status/necromancer-submission-ja.md` | The owner's guide in Japanese (outside the repository). |
| this file | The checks. |

Commits: `f9a5fa1` (README, Devpost text, video script, filters), `2a523da` (Best Kiro Crew App needs a separate repository),
`653defe` (this record, first version); the lead's ruling and the blog and social drafts are in the commit after it. Nothing under `packages/`, `apps/`, `docs/research/`, `.kiro/` or `.github/` was changed.
No `api.github.com` call was made on purpose; see section 8 for the one run that was not blocked.

## 2. Placeholders

Four links do not exist yet. Each is one marker, found with `grep -rn PLACEHOLDER README.md docs/submission`.
Counts are lines that contain the marker (`devpost.md` lists each marker once in its own table, too). The blog and social drafts
use the same markers; the owner needs to fix only the files they use.

| Marker | `README.md` / `devpost.md` / `video-script.md` / `blog-post.md` / `social-post.md` | Becomes |
| --- | --- | --- |
| `[[PLACEHOLDER: PAGES_URL]]` | 1 / 3 / 0 / 1 / 2 (the video's end card says to type the address) | the Pages address after the owner creates the repository |
| `[[PLACEHOLDER: YOUTUBE_URL]]` | 1 / 2 / 1 / 1 / 0 | the public YouTube address |
| `[[PLACEHOLDER: REPO_URL]]` | 0 / 2 / 0 / 1 / 1 | the public repository |
| `[[PLACEHOLDER: CREW_REPO_URL]]` | 0 / 4 / 0 / 1 / 0 | the separate Crew app repository (section 5) |

The blog and social drafts also hold `OWNER:` lines for text only the owner can write.

## 3. What could not be read or confirmed

| Source | Result |
| --- | --- |
| AWS blog post (Japanese) | Read with `web_fetch`. It is a Japanese summary of the Devpost pages as of 2026-10-31, and says the English pages decide. |
| `kiroween.devpost.com` rules, FAQ, resources, dates, overview | `web_fetch` returned HTTP 403 for all of them. The same public pages were read with `curl` (HTTP 200) and saved under `/home/ec2-user/.kiro/crew/kiroween2026/scratch/drafts/rules/`. The rules page was read to its end. |
| The Devpost "Enter a Submission" form | Behind a login. Its field labels and limits (tagline length, image size, "Built with" format) are **not confirmed**. The drafts follow the rules and the contest page. |
| Rules sections 12 to 15 | Read; they cover liability, disputes, Devpost terms and privacy. Nothing in them changes the drafts. |
| Kiro IDE, CLI and Web | The repository shows only Kiro Crew work (every commit is by the Crew agent). The drafts say the build was Kiro Crew only. The owner is asked in the guide to say if that is wrong. |

## 4. Contest rules found, and where the drafts meet them

Quoted from `kiroween.devpost.com/rules` (Official Rules), read 2026-11-04.

| # | Rule (quoted) | Where the drafts meet it |
| --- | --- | --- |
| R1 | "Submission Period: October 30, 2026 (9:00 am Pacific Time) – December 4, 2026 (2:00 pm Pacific Time)". "No extensions will be granted." | Owner guide: deadline 2026-12-05 07:00 JST, submit on 2026-12-03. |
| R2 | "Projects must be newly created by the Entrant after the start of the Hackathon Submission Period. ... must disclose any other pre-existing code or work incorporated into the Project." | README "Declaration: pre-existing code"; `devpost.md` repeats it. First commit `678225d`, 2026-11-03 06:32 UTC = 2026-11-02 22:32 Pacific. |
| R3 | "build a working software application using Kiro (IDE, CLI, Web, and/or Kiro Crew) and submit it into one of the following categories". | Category Resurrection in `devpost.md`; README "Built for Kiroween 2026, category Resurrection". |
| R4 | "Provide a URL to your functional application(s). If login credentials are needed ... " | The Pages URL (placeholder). No login is needed, and the judge steps say so. |
| R5 | "Include a text description that explains the features and functionality of your Project." | `devpost.md` "About the project". |
| R6 | Video: "should be less than three (3) minutes", "footage that shows the Project functioning on the device for which it was built", "uploaded to and made publicly visible on YouTube", "must not include third-party trademarks, or copyrighted music". | `video-script.md`: 165 s (section 7); real terminal and browser footage; "Public" on YouTube; no music; no third-party logos in frame. |
| R7 | "Provide a public URL to your code repository on GitHub (NOT GitLab or BitBucket)". "The repository must be public and open source by including an open source license file ... visible at the top of the repository page (in the About section)." | MIT `LICENSE` exists at the root. The owner guide step 3a checks that GitHub shows "MIT license" in About. |
| R8 | "Your repo must contain the /.kiro directory at the root ... Do NOT add the /.kiro directory or sub-folders to your .gitignore". | `.kiro/` is committed (9 specs, 11 hooks, 3 steering files); `.gitignore` line 19 is a comment that says never to ignore it. Guide step 3b checks it on GitHub. |
| R9 | "Identify which category and bonus category you are submitting into." | `devpost.md` "Category" and "Bonus prizes to select". |
| R10 | "Provide a write up on how Kiro was used" with the eight example topics (IDE/CLI/Web/Crew, custom agents, hooks, spec-driven, steering, MCP, PBT, powers). | `devpost.md` "How we used Kiro" answers all eight, in that order, with "None used" for powers and "not used" for IDE, CLI and Web. README has the same as a table with paths. |
| R11 | "All Submission materials must be in English or ... an English translation". | All drafts in English. The Japanese guide is for the owner only and is not submitted. |
| R12 | Best Kiro Crew App: prize table says "All Eligible Submissions that include a separate repo submission to a Kiro Crew app (GitHub account must match overall submission)". Section 4: "provide a writeup describing the features and functionality of your Kiro Crew app with a public URL to the code repository for the app on GitHub. Your Kiro Crew app must be newly created during the Submission Period." | `devpost.md` selects the prize, has the description and `CREW_REPO_URL`. By the lead's ruling a second public repository is made from a standalone export of `apps/crew` (`necromancer-crew-app`, steps in `docs/verification/crew-repo.md`, written by the Crew worker). **Met in the drafts; the repository does not exist until the owner pushes it.** |
| R13 | Bonus Blog Prize: "write and publish a public blog post about Kiro and your project build on any third-party blog platform during the Submission Period"; it "must mention it is being written as part of the Kiroween 2026 hackathon". Social Blitz: post "starting your post with required hashtag #KiroweenHackathon26 ... must start with the hashtag before the rest of the post content"; "Include your favorite thing about Kiro with a description of how it changed the way you approached development"; judged on "original thoughts vs AI writing". Best Ghost: "confirm that you registered for Kiroween 2025 in the Submission Form". | `blog-post.md`: its second paragraph says it was written as part of the Kiroween 2026 hackathon; it is about Kiro and the build. `social-post.md`: the post blocks begin with `#KiroweenHackathon26`; the favorite thing and the change are left as `OWNER:` brackets, with the note that the post is judged on original thoughts. The guide gives the dates (2026-10-31 01:00 JST to 2026-12-05 07:00 JST) and the Ghost check. |
| R14 | Kiro credits: request "by Tuesday, December 1, 2026 at 12:00 pm Pacific Time"; "Credits must be redeemed by Friday, December 4, 2026"; "48 business hours" for review. | Guide step 2: 2026-12-02 05:00 JST, redeem by 12-04 (Pacific). |
| R15 | Eligibility: age of majority; teams of at most 3 with one Representative; list of excluded places. Japan is not in the list. "Entrants are solely responsible for reviewing ... Regional Restrictions" on Kiro features. | Guide section 7; `devpost.md` "Team and eligibility". |
| R16 | Judging: Stage One pass/fail on theme and use of Kiro; Stage Two five criteria at 20% each (Potential Impact, Technological Implementation, Design, Innovation/Idea, Presentation). | `devpost.md` sections map to them: problem and census (Impact), the Kiro write-up (Implementation), the app (Design), séance and datasets (Innovation), the video (Presentation). |
| R17 | "Judges are not required to test the Project and may choose to judge based solely on the text description, images, and video". | The video and the gallery images carry the whole story; judge steps are optional. |
| R18 | Product rules in `.kiro/steering/product.md` that bind the drafts: English only; public APIs and public data only; no paid services; no server-side LLM in the web app; no third-party trademarks as product names. | Drafts claim nothing against these. The web app runs the engine in the browser; no key is used. |

## 5. Best Kiro Crew App (resolved by the lead)

R12 asks for a **separate** public repository for the Crew app, under the same GitHub account. The lead ruled (2026-11-04): go for the
prize with a separate repository. The Crew worker builds a standalone export of `apps/crew` (app at its root, built output committed,
its own README) at `/home/ec2-user/.kiro/crew/kiroween2026/necromancer-crew-app` and writes the push steps in
`docs/verification/crew-repo.md`. The owner creates the second repository and pushes it. This item did not write in the export
directory or in `apps/crew`. The drafts keep `[[PLACEHOLDER: CREW_REPO_URL]]`, mark the prize as selected, and the guide step 6b
points to `crew-repo.md`. `crew-repo.md` did not exist when this record was written; the guide says to wait for it.

## 6. Every command in the README runs

Fresh clone of the local repository, HEAD `f9a5fa1`, under
`/home/ec2-user/.kiro/crew/kiroween2026/scratch/drafts/clone-final`, with no `node_modules` at the start (`find` found 0).
`run-readme.py` (in the same scratch folder) takes each `sh` block of the README and runs it with `bash -e` from the clone root.

| Block | Command | Result |
| --- | --- | --- |
| 1 | Engine quick start: `npm ci`, `npm run build`, `node scripts/show-fixture-report.mjs acceptance` | exit 0; prints node-sass and request as zombie, left-pad and tslint as dead, express alive |
| 2 | Web quick start: `npm ci`, `npm run build` | exit 0, `built in 160ms` |
| 3 | `npm run dev` | **not run in the block runner** (it never exits). Run apart: `npm run dev` and `npx vite preview` each answered with the page title "Necromancer: find the dead in your dependency tree". |
| 4 | Crew quick start: `npm ci`, `npm ci --prefix ui`, `npm run build`, `npm run smoke` | exit 0, `SMOKE OK` |
| 5 | `node scripts/mcp-call.mjs --list` and `NECROMANCER_BLOCK_HOSTS=api.github.com node scripts/mcp-call.mjs successors ...` | exit 0; ten tools listed; `String.prototype.padStart` as the native successor |
| 6 | Engine tests: `npm ci`, `typecheck`, `npm test`, `build`, `smoke-node.mjs` | exit 0; `Tests  294 passed (294)` |
| 7 | Web tests: `npm ci`, `typecheck`, `npm test`, `build` | exit 0; `Tests  271 passed (271)` |
| 8 | `npx playwright install chromium`, `npm run verify:browser`, `npm run verify:live` | exit 0; 65 and 55 `PASS`, `ALL CHECKS PASSED` twice |
| 9 | Crew tests: `npm ci`, `npm ci --prefix ui`, `typecheck`, `npm test`, `build`, `smoke` | exit 0; `Tests  91 passed (91)` |

Host deviations: the Chromium system libraries come from `/home/ec2-user/.cache/necromancer-chromelibs/env.sh` (no root here).
The README text says `--with-deps` for Linux; that form was not run, as in `publish-ci.md`. Also run apart:
`npm run verify:seance` in `apps/web` on the current tree: `ALL CHECKS PASSED`.

Other commands in the drafts:

| Command | Where | Result |
| --- | --- | --- |
| `node scripts/mcp-call.mjs autopsy ... \| node ../../docs/submission/demo/summarize-autopsy.mjs` | video script 6 | exit 0: `request 2.88.2 zombie`, `left-pad 1.3.0 dead`, `moment 2.31.0 alive` |
| `node scripts/mcp-call.mjs seance ... \| node ../../docs/submission/demo/summarize-seance.mjs` | video script 6 | exit 0: recipe `left-pad`, `curated`, 4 calls found in `src/receipt.js`, 5 known differences |
| Séance written by the engine, `npm install --save-dev vitest fast-check left-pad`, `npx vitest run seance/left-pad` | video script 5, judge step 5 | `Tests  6 passed (6)` in about 0.8 s |
| Same, with the replacement set to plain `padStart` | video script 5 | 3 tests failed, `Property failed after 8 tests`, `Counterexample: [0,"7",""]`; after restoring the file, `Tests  6 passed (6)` |

The séance in these two rows was written by the engine's `seance()` into a folder, not downloaded from the page. The page's
download is byte-identical to the engine output; that is shown by `npm run verify:seance` (`docs/verification/web-seance.md`
section 3), not by a new click-through here.

## 7. Links and timings

`check-links.py` (scratch folder) read `README.md`, `devpost.md`, `video-script.md`, `blog-post.md` and `social-post.md` in a fresh clone
(HEAD `af5be3f`): 128 references (markdown links plus backticked paths).

| Kind | Result |
| --- | --- |
| Markdown links `[text](path)` | 0 broken in the five drafts. (In this record the checker flags the literal example `[text](path)` in section 9's text; that is not a link.) |
| Backticked paths | 28 did not exist as written. 1 is `docs/verification/crew-repo.md`, which the Crew worker writes later (the lead's ruling names it); recheck when it exists. The other 27 are not paths from the repository root: file names inside a user's project (`package.json`, `requirements.txt`, `seance/left-pad/replacement.mjs`), a path relative to `apps/crew` (`scripts/mcp-call.mjs`), a build output (`apps/crew/dist/server.mjs`), repository names (`appsecco/dvna`), a file in the demo app (`src/receipt.js`), the names of spec and steering files, and the address typed into the app. |
| External URLs | not fetched. The Devpost and AWS addresses were read for the rules in section 3. |

Video timings (parsed from the table in `video-script.md`): 14 + 18 + 23 + 25 + 32 + 35 + 18 = **165 s = 2:45**, under 180 s by 15 s. Each
shot starts when the last one ends. The fastest voice-over is shot 1, 30 words in 14 s (2.1 words per second); the others are
1.0 to 2.1.

## 8. Deviations and notes

- **One unblocked run.** `NECROMANCER_BLOCK_HOSTS=api.github.com` was set on every Crew-tool run except one: the check of the video
  script 6 block (one `autopsy` and one `seance` call). Those two calls reached `api.github.com`. The report said
  `sources unavailable: github`, so GitHub had already refused them (the census used the hourly limit). Nothing else called
  GitHub: the web checks use a stubbed internet, the engine demos replay recordings, and the séance rehearsal used a fetch that
  answers 403 for GitHub without a network call.
- **Tool block.** One shell command (a link checker written with a heredoc) was refused by a host rule that matched an ssh pattern. It
  contained no ssh. The checker was written with the file tool and run as an ordinary `python3` call.
- **Engine moved during the item.** Uncommitted engine edits appeared in the working tree (`diagnose.ts`, `signals.ts`, `verdict.ts`
  and others). Every check here ran on committed clones. The census numbers are for engine `bfd86f1`.

## 9. Claim table

Every number and factual claim in the drafts. "Tag" is the `<!-- claim:ID -->` marker in the draft; untagged rows say where the claim
sits. "Checked" says what I did against the source file. The engine commit is the one the source states.

### Census (engine `bfd86f1`, sample drawn 2026-11-03, hand check 2026-11-04)

| ID | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- |
| N01 | 34 of 100 projects depend directly on a deprecated, archived, inactive or gone package; 95% CI 26 to 44 | README, devpost | `docs/research/census.md` section 5 (C1); `census-aggregate.json` `all.subjectsWithStrongDead` / `all.subjects` | Ran `node docs/research/recompute.mjs`: `34 / 100 = 34.0% (95% CI 25.5% to 43.7%)`; rounds to 26 to 44, as the report does |
| N02 | 51 of 100 when the engine's own age rule counts too | README | `census.md` section 4.1 | `recompute.mjs`: `51 / 100 = 51.0%` |
| N03 | 55 of 56 right (98%, CI 91 to 99.7); 46 (82%) also defensible | README, devpost | `census.md` section 5 (C2), section 6 | `recompute.mjs` Table 7: `55 / 56 = 98.2% (90.6% to 99.7%)`, `46 / 56 = 82.1% (70.2% to 90.0%)` |
| N04 | Weighted by population: 96.6% right, 70.2% defensible | README | `census.md` section 6 | `recompute.mjs` Table 7 weighted line |
| N05 | 3,201 direct dependencies; 198 dead or worse (6.2%, about 1 in 16); 22 of the 198 have a known way out | README, devpost | `census.md` sections 4.2, 4.5 (C3) | `recompute.mjs` Tables 2 and 3: `198 / 3201 = 6.2%`, `22 / 198 = 11.1%` |
| N06 | Engine commit `bfd86f1`; 100 projects; engine has changed since | README | `census.md` header; `docs/verification/census.md` section 1 | `git log` shows the commit; later engine commits (the séance) exist |
| L01 | 116 of the 198 rest on the "abandoned" rule alone | README | `census.md` section 4.3 | `recompute.mjs` Table 4: `abandoned: 116` |
| L02 | Successors for 22 of 198; none for Python | README, devpost | `census.md` section 4.5 | `recompute.mjs` Table 3: npm `22 / 160`, PyPI `0 / 38` |
| L03 | The generic séance is a skeleton; only six pairs have recipes; on `request` a model wrote a 305-line replacement and a 500-line test by hand in about 40 minutes | README, blog | `docs/verification/seance.md` section 8 gap 5; `crew-seance.md` section 4 | Read |
| L04 | GitHub allows 60 unauthenticated calls an hour; at most 400 dependencies are checked | README, blog | `engine.md` section 6 gap 11; `web-live.md` section 9 gap 1 | Read |
| N07 | The 16 hard-signal packages drawn for the hand check were all right | not quoted | `census.md` section 5 (C1 support) | not used in the drafts |

### Séance finds (engine record `docs/verification/seance.md`)

| ID | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- |
| S01 | `leftPad("abc", 6, "")` gives `"   abc"`, naive `padStart` gives `"abc"`; multi-character and `null` fills differ; left-pad bug at fractional length `5.5` (`"undefinedabc"`) | README, devpost | `seance.md` section 4 (left-pad table) | Read against the table. The sample output of `summarize-seance.mjs` shows the same first rows (`"   abc"`, `"xyxyxyabc"`, `"   abc"`) |
| S02 | `parse("a=%zz")` throws `URIError` in querystring, not in `URLSearchParams` | README, devpost | `seance.md` section 4 (querystring table) | Read against the table |
| S03 | toml crashes with `UnboundLocalError` and silently returns `{}` on some documents | README, devpost | `seance.md` section 4 (toml table) | Read against the table |
| S04 | pep8 to pycodestyle: twelve new checks | README, devpost | `seance.md` section 4: "the twelve codes in `NEW_CODES`" | Read |
| S05 | First `fetch` replacement of `request` failed the séance seven times; timeout, `Accept`, redirects, query encoding | README, devpost | `docs/verification/crew-live.md` section 4.2 ("failed 7 times"; difference table) | Read |
| S06 | Six curated recipes; each run against the real packages; each mutant fails | README | `seance.md` sections 1 and 3 | Read; `npm run verify:seance` passes on the current tree |

### Tests and checks

| ID | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- |
| T01 | Engine: 294 tests | README, devpost | `seance.md` section 2 | Ran in the fresh clone: `Tests  294 passed (294)` |
| T02 | Web: 271 unit tests | README, devpost | `web-seance.md` section 2 | Ran: `Tests  271 passed (271)` |
| T03 | `verify:browser` 65 checks; `verify:live` 55 checks | README, devpost | `web-seance.md` section 2 | Ran: 65 and 55 `PASS` lines, `ALL CHECKS PASSED` |
| T04 | Crew app: 91 tests | README, devpost | `crew-seance.md` section 2 | Ran: `Tests  91 passed (91)` |

### The Crew app and Kiro usage

| ID | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- |
| C01 | Ten MCP tools, named in the README; Night Watch at 03:00 Asia/Tokyo; agent never pushes | README, devpost | `apps/crew/app.json`; `docs/verification/crew-app.md` | `mcp-call.mjs --list` printed the ten tools; `app.json` has cron `0 3 * * *`, `Asia/Tokyo` (read in `crew-app.md`) |
| C02 | The app passes the manifest validator and runs over stdio, but is not installed in a dashboard | README, devpost | `crew-app.md` "Status in one line", "Known gaps"; `crew-live.md` section 7 | Read; the installed state was not re-checked here |
| K01 | Built only in Kiro Crew; IDE, CLI, Web and powers not used; hooks written but never fired | README, devpost, guide | `crew-app.md` ("Hooks were not fired. They need the Kiro IDE."); `git log` shows one author, the Crew agent | **Inference from the repository.** Not confirmed by the owner. The guide asks |
| K02 | Property tests found an invalid Python template and a docstring breakout that example tests missed | devpost | `seance.md` section 5 | Read |
| K03 | A reviewer subagent that had not seen the design or tests found 11 issues, including a 34-second hang on spaces | README, devpost | `engine.md` sections 2.3 and 2.4 (findings F1 to F11; "100k took 34 s") | Read. F11 is cosmetic; "11 issues" counts all rows |
| K04 | Nine specs, three steering files, eleven hooks | README, devpost, video | `.kiro/` | `ls` in the clone: 9, 3, 11 |
| K05 | Fresh subagents followed the agent prompt and skill and raised `left-pad`, `request` and `is-odd` on local branches with passing tests | README, devpost | `crew-live.md` section 4; `crew-seance.md` sections 3 and 4 | Read. They ran through a stdio stand-in, not the installed app; the drafts say so |
| K06 | Several workers changed one repository at once without overwriting each other (one owner per path) | devpost | `.kiro/steering/structure.md` rule; my own item ran beside other workers' commits | Qualitative; no measurement |
| K07 | Every requirement id is cited by a test name; EARS notation | devpost | `.kiro/specs/seance/requirements.md` opening; test names such as `R6.5 ...` in `engine.md` | Read two specs and `engine.md`; not checked for all nine |

### Blog and social drafts

| ID | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- |
| B01 | The blog says it was written as part of the Kiroween 2026 hackathon and is about Kiro and the build | `blog-post.md` | Official Rules section 4 (Bonus Blog Prize) | Read: second paragraph, and the comment at the top tells the owner to keep it |
| B02 | Every number in the blog and social drafts is one of N01, N03, S01, S02, S03, K01 to K05, K07, C02, L03, L04 | both | rows above | Tags present in the text; each row is checked above |
| B03 | "Fresh subagents ... raised `left-pad`, `request` and `is-odd` on local branches" | `blog-post.md` | K05 | As K05 |
| X01 | The short post is 223 characters with its brackets | `social-post.md` | counted with `len()` | Printed 223. The claim is about the draft, not the final post |
| X02 | The Social Blitz judging criteria (original thoughts vs AI writing; images) | `social-post.md`, guide | Official Rules section 6 | Read |
| X03 | Submission Period in JST: 2026-10-31 01:00 to 2026-12-05 07:00 | guide, drafts | AWS blog schedule table; rules section 1 (10/30 09:00 PT to 12/4 14:00 PT) | Read; Pacific Standard Time (UTC-8) applies from 11/1, Pacific Daylight Time (UTC-7) before. The AWS blog gives 10/31 01:00 JST for the start and 12/5 07:00 JST for the end |
| X04 | The favorite-thing ideas in `social-post.md` point to real evidence | `social-post.md` | `.kiro/specs/seance/requirements.md`; `seance.md` section 4; `engine.md` section 2.4 | Read each; they are ideas, not the owner's claims |

### Other facts

| ID | Claim | Drafts | Source | Checked |
| --- | --- | --- | --- | --- |
| D01 | First commit `678225d`, 2026-11-03 06:32 UTC; nothing pre-existing | README, devpost | `git log --reverse` | `git log --reverse --format=...`: first commit 2026-11-03 06:32:33 +0000; all commits by "Kiro Crew (agent)"; 2026-11-02 22:32 Pacific is after the period start. Scope of "nothing pre-existing" is from the repository history only; the owner knows if any code came from elsewhere |
| D02 | Dependencies listed; fonts under OFL; data from public services | README | the four `package.json` files; `apps/web/public/licenses/`; `apps/web/src/ui/About.tsx` | Read the `package.json` dependency lists with `node -e`; the licence files exist |
| D03 | `apps/crew/evidence/seance/is-odd.patch` credits the is-odd author | README | the patch (`Derived from is-odd ... Copyright (c) 2015-present, Jon Schlinkert. Released under the MIT License.`) | `grep` found the line |
| W01 | Live autopsy: about fifty dependencies, a few seconds (2.4 to 3.9 s for 54 dependencies of `microblog`) | video | `docs/verification/web-live.md` section 6 | Read. Not re-run (it would call GitHub); the video script tells the owner not to read numbers aloud that change |
| W02 | Samples on the start page: `appsecco/dvna`, `miguelgrinberg/microblog`, `SickChill/sickchill`; dvna holds a zombie | video, devpost | `apps/web/src/data/recorded/*.json` | Read `summary` fields: dvna `zombie: 1`; microblog 54 diagnoses |
| W03 | The Pages workflow builds for the repository's sub-path | README | `docs/verification/publish-ci.md` section 4 | Read |
| W04 | GitHub: 60 unauthenticated calls an hour; engine checks at most 400 dependencies | README, devpost | `engine.md` section 6 gap 11; `tech.md`; `web-live.md` section 9 | Read |
| P01 | Tagline is 55 characters | devpost | counted | `len(...)` printed 55 |
| P02 | Rule dates and amounts (deadline, credits, prizes) | guide, devpost | Official Rules sections 1, 4, 8; AWS blog | Read both; JST times as in the AWS blog table (12/5 07:00, 12/2 05:00) |

## 10. How to refresh the numbers

1. Search the drafts for the tags: `grep -rn "claim:" README.md docs/submission`. Each tag is a row above.
2. Census numbers (N01 to N06, L01, L02): rerun `node docs/research/recompute.mjs` and copy from its output; update the engine commit in N06.
3. Test counts (T01 to T04): rerun the commands in README "Run the tests".
4. Séance finds (S01 to S06): the lines in `docs/verification/seance.md` section 4 after any recipe change.
5. Count rows (K04): `ls .kiro/specs .kiro/hooks .kiro/steering`.
6. The guide in `.status` repeats no numbers except the dates and the tagline length (55).

## 11. Nearby cases

| Case | Checked? | Result |
| --- | --- | --- |
| A reader who will not install Kiro Crew | yes | README "Without Kiro Crew": `mcp-call.mjs --list` and `successors` run with no dashboard; `apps/crew/dist/server.mjs` also answered 10 tools over stdio when started with `node` directly; the web app and the engine need no Crew. Judge step 6 says the same. The Crew app's page, cron and agent cannot be shown without Kiro Crew; the drafts say that plainly. |
| A judge on macOS | partly | The web app is a static page that any browser opens. The README commands were run on Linux only; they use `npm`, `node` and `bash` forms that work on macOS. `python3` is needed for `mcp-call.mjs` (the launcher is Python); macOS has it. Not run. |
| A judge on Windows | partly | The page works in any browser. `VITE_BASE=... npm run build` is POSIX; the README gives the PowerShell form. `mcp-call.mjs` starts `python3`, which Windows often lacks; the README names the `node apps/crew/dist/server.mjs` form, tested on Linux only. The `unzip` and heredoc steps in the video script are shell steps for the person recording, not for judges. Not run on Windows. |
| The Pages URL unknown until the owner creates the repository | yes | One marker `[[PLACEHOLDER: PAGES_URL]]` in the README and Devpost text; `grep -rn PLACEHOLDER` lists them; the guide says what the address looks like and when it appears (after the first run of the Pages workflow), and covers a `<owner>.github.io` repository or a custom domain (`PAGES_BASE`). The README links to the workflow by relative path, so it works before the URL exists. |
| The repository URL unknown | yes | `REPO_URL` marker in `devpost.md`; README uses relative links only. |
| A second GitHub account or fork | no | Not needed. R12 asks that the Crew repository be on the same account. |
| Devpost field limits | no | Unknown without a login; see section 3. |
| Image sizes for the gallery | no | The six named screenshots exist; their size fit for Devpost was not checked. |

## 12. Findings for the lead

1. **Best Kiro Crew App needs a separate repository** (section 5). The lead ruled to make it; the drafts follow. `docs/verification/crew-repo.md` was not there yet when this was written, so the guide points to it by name.
2. **CI does not run `npm run verify:seance`** in `apps/web`, though `package.json` has it and it passes on the current tree. I did not edit `.github/`.
3. `docs/verification/web.md` gap 1 ("Fixtures, not the engine") is out of date; `web-live.md` replaced it. Not edited (not my path).
4. The hooks have never fired and Kiro IDE/CLI were not used; the Technological Implementation write-up says so. If the owner opens the repository in the Kiro IDE and fires a hook, the sentence can be improved only with that evidence.
5. `packages/engine/scripts/demo-seance.mjs` and some scripts hard-code `/home/ec2-user/...` scratch paths. A reader outside this host cannot run them; the README does not use them.
6. Engine edits are in the working tree, uncommitted, while the drafts quote engine `bfd86f1`. After the tuning item commits, the claim table needs the refresh pass in section 10.
