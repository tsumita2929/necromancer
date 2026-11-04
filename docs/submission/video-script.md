# Demo video script: Necromancer

Length: **2 minutes 45 seconds** (165 s). The rules say the video must be **less than three
minutes** and that judges need not watch past three. The seven shots add up to 165 s, which leaves
15 s of margin. Upload it to YouTube as **Public**.

Language: English. Voice-over is written below; add English captions (the owner may prefer them).
No music: the rules forbid copyrighted music, and silence under the voice is fine. Do not show
third-party logos in the frame (browser bookmarks, a GitHub or npm logo page).

What the video shows, with what exists today:

- the web app on **recorded** real repositories: a heuristic label, an upgrade notice, a dead
  package with no successor raised, and the **mkdirp séance** of the mathjs sample;
- a **séance downloaded** from the web app and **run** for real against mkdirp 3.0.1, then made to fail;
- the Crew app's **tools** through `apps/crew/scripts/mcp-call.mjs`: the read-only `seance` preview,
  and `seance_write` refused off a `resurrect/` branch. The app is not installed in a dashboard yet.

Shot 6 uses `demo/haunted-app`, an invented app made for this purpose. Say so on screen.

## Shot list

| # | Time | Length | On screen | Voice-over |
|---|---|---|---|---|
| 1 | 0:00 to 0:13 | 13 s | Black card, title **Necromancer**, line "Find the dead in your dependency tree." Then the number as large text: **33 of 100** and under it "active open-source projects depend directly on a package that is deprecated, archived, inactive or gone". Small source line: "Necromancer census, 100 projects, 95% CI 24.6% to 42.7%". | "Every project stands on packages nobody looks after. So we counted. Of one hundred active open-source projects, thirty-three depend directly on a package that is deprecated, archived, inactive or gone." |
| 2 | 0:13 to 0:31 | 18 s | The live app, start page: the four recorded samples. Click **josdejong/mathjs**. The graveyard opens. Pause on a **dashed "heuristic" pill** on a Dying tombstone. Scroll to the Alive group: **eslint** (or glob) with the badge "Upgrade to ... (another major)". | "This is Necromancer. No login, no server. Here is a real repository, recorded. Every verdict says what it rests on. This dashed mark means a guess from staleness, not a hard fact. And a living package with a deprecated version is not dead. It gets an upgrade notice." |
| 3 | 0:31 to 0:54 | 23 s | Click the **mkdirp** tombstone. In the drawer, press **Resurrect**. The panel "Resurrection spec and séance" shows the way out `fs.mkdir`, "Curated recipe: mkdirp to fs.mkdir recursive", the versions note, Install and Run. Click **Download séance only (.zip)**. | "A dead package needs a way out. mkdirp has one: fs.mkdir. But is it a drop-in? Necromancer writes a Kiro spec, and a séance: a test that asks the old package and the new one the same generated questions. It says which versions of the old package it was run against." |
| 4 | 0:54 to 1:24 | 30 s | Terminal, large font. Commands below (script 4). The test shows `Tests  7 passed (7)`. Then the naive replacement: red output with a counterexample. Restore: green again. | "I download the séance and run it against mkdirp three. Seven properties pass. Now the obvious swap, plain mkdir with no path resolution. It fails, and the counterexample is an empty path. Nobody wrote that difference down. The test found it." |
| 5 | 1:24 to 1:44 | 20 s | Back to the start page, open **appsecco/dvna**. Open **csurf** (Dead, a hard signal, no successor listed). Press **Resurrect**: the page says no successor is listed and offers **Raise csurf**; the engine's raise spec appears ("# Requirements: Move off csurf"). | "Some dead packages have no successor at all. Then Necromancer offers to raise it: rebuild the small piece as code your project owns, with the same spec and the same kind of test." |
| 6 | 1:44 to 2:25 | 41 s | Terminal in `apps/crew`. Commands below (script 6): the tool list (eleven tools); the `seance` preview on the demo app (read-only, nothing written); `seance_write` on `main`, refused. Then briefly the files `apps/crew/agents/necromancer.json`, `apps/crew/skills/resurrection/SKILL.md` and `apps/crew/app.json` (the cron line `0 3 * * *`). *Optional, in place of the last 10 s: the Graveyard page in the Kiro Crew dashboard, if the owner has installed the app and seen it work.* | "The same engine is a Kiro Crew app, with eleven MCP tools. The agent asks them for every verdict. The séance preview changes nothing. The tool that writes is a separate one, it asks first, and it refuses on the main branch. The Necromancer agent follows the resurrection skill: it branches, runs the séance, swaps the package, and never pushes. Night Watch checks every night, and speaks only when something gets worse." |
| 7 | 2:25 to 2:45 | 20 s | The repository tree in an editor: `.kiro/specs` (thirteen folders), `.kiro/hooks`, `.kiro/steering`. Then the test output of CI (or the README test section). End card: **Necromancer**, "Raise your code on living ones.", the Pages address and the repository address (type them in). | "Built in Kiro Crew, spec first: thirteen specs, eleven hooks, three steering files, property tests throughout. Of the forty flagged packages we checked by hand, thirty-six are still flagged, and all thirty-six are right. Necromancer. Raise your code on living ones." |

Total: 13 + 18 + 23 + 30 + 20 + 41 + 20 = 165 s.

Voice-over pace: every shot is under 2.4 words per second (checked by `check-drafts.mjs`), so the voice has
room for pauses while the screen loads.

## Terminal scripts

Use a clean terminal, font 18 or larger, a dark theme. Replace `/path/to/necromancer` with the
clone. Build the Crew app once beforehand (`npm ci`, `npm ci --prefix ui`, `npm run build` in
`apps/crew`).

### Script 4: run the mkdirp séance (shot 4)

Prepare once, off camera: `mkdir /tmp/my-app && cd /tmp/my-app && npm init -y`. Then on camera:

```sh
cd /tmp/my-app
unzip ~/Downloads/*-seance.zip
npm install --save-dev vitest fast-check mkdirp@3.0.1
npx vitest run seance/mkdirp
```

Result seen when these steps were rehearsed: `Tests  7 passed (7)`. Now the plain swap:

```sh
cat > seance/mkdirp/replacement.mjs <<'EOF'
import fs from 'node:fs';
export const mkdirpSync = (dir) => fs.mkdirSync(dir, { recursive: true });
export const mkdirp = async (dir) => fs.promises.mkdir(dir, { recursive: true });
EOF
npx vitest run seance/mkdirp
```

Rehearsed result: 4 tests failed, `Property failed after 1 tests`, `Counterexample: [[],["a"],"",493]`
(the numbers vary by run; the empty path `""` is the difference: mkdirp treats it as the current
directory and `fs.mkdir` throws). Put the careful file back (`unzip -o ~/Downloads/*-seance.zip`) and run
once more: `Tests  7 passed (7)`. The run takes about one second on a laptop.

The zip comes from the page. When rehearsing without the page, `docs/submission/demo/gen-recorded-seance.mjs`
writes the same files from the recorded sample with the engine (the page's download is byte-identical to
the engine output; `npm run verify:seance` in `apps/web` shows it).

### Script 6: the Crew app's tools (shot 6)

The tools run over stdio; `mcp-call.mjs` starts the server the way the platform does. Add
`NECROMANCER_BLOCK_HOSTS=api.github.com` if the GitHub hourly limit is already used up or to keep the
take quick; the report then says GitHub was unavailable. The demo app must be a git repository on
`main` with a manifest, for example a copy:

```sh
cp -r /path/to/necromancer/demo/haunted-app /tmp/haunted && cd /tmp/haunted && rm -rf node_modules
git init -q -b main && git add -A && git commit -qm base
```

On camera:

```sh
cd /path/to/necromancer/apps/crew
node scripts/mcp-call.mjs --list
node scripts/mcp-call.mjs seance '{"ecosystem":"npm","name":"left-pad","path":"/tmp/haunted"}' | node ../../docs/submission/demo/summarize-seance.mjs
node scripts/mcp-call.mjs seance_write '{"ecosystem":"npm","name":"left-pad","path":"/tmp/haunted"}'
git -C /tmp/haunted status --short
```

Rehearsed output of the second command:

```
left-pad (dead) -> String.prototype.padStart
recipe: left-pad   template: curated   comparisons skipped: false   TODOs: 0
project calls found: default x4 in src/receipt.js
known differences: 5
versions: ... (the old versions it was run against)
run: npx vitest run seance/left-pad
```

The third command exits 1 and prints: `The project is on branch "main". The séance is written only on a
branch named resurrect/<dependency>. ... Nothing was changed.` The last command prints nothing.

If time allows, show that on a branch it writes: `git -C /tmp/haunted switch -c resurrect/left-pad`, then
the same `seance_write` call returns the three files. (Not needed for the 165 s; cut first.)

**If the owner has installed the app** in the dashboard before recording, replace the last 10 s of
shot 6 with the dashboard: the sidebar entry **Graveyard**, the page, and the Schedule page with
`night-watch` at 03:00. Keep the voice-over; only the picture changes. Do this only if the page was
seen working; `docs/verification/crew-app.md` lists what to check first, and the drafts claim nothing
beyond what the `crew-*.md` records show.

## Before recording

1. **The samples come from the page itself,** so shots 2, 3 and 5 need no GitHub call. Do not run
   "Run it live now" on camera: it spends the GitHub budget (60 calls an hour per IP) and the numbers
   differ from the card.
2. Run shots 2 to 5 once without recording, to warm the browser cache of the fonts.
3. Open the live app (the Pages address), not `npm run dev`, so the video shows the shipped site.
4. The sample cards show the day they were recorded. Leave that visible. The facts this script
   relies on (mkdirp is Dying on a heuristic with `fs.mkdir`; eslint or glob carries an upgrade
   notice in mathjs; csurf is Dead on a hard signal with no successor in dvna) are checked by
   `node docs/submission/demo/check-drafts.mjs`; run it after the samples are re-recorded and adjust the
   shots if it says a fact changed.
5. Check the final cut: length under 3:00, the sound is only the voice, no private data in the
   terminal (home folder names, tokens), no third-party logos.
6. Upload to YouTube, **Public**, English title "Necromancer: find the dead in your dependency tree
   (Kiroween 2026)". Paste the address into the Devpost field `[[PLACEHOLDER: YOUTUBE_URL]]`.

## A judge who only watches the video

The video has to carry the story alone (the rules say judges may judge "based solely on the text
description, images, and video"). Shot 1 states the problem and the number, shots 2 to 5 show the
product on real repositories with no explanation needed beyond the voice, shot 6 shows the Crew app,
and shot 7 names how Kiro was used and the one trust number.

## Where the video meets the rules

See the rules table in `docs/verification/submission-drafts-r4.md`.
