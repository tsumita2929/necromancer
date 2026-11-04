# Demo video script: Necromancer

Length: **2 minutes 45 seconds** (165 s). The rules say the video must be **less than three
minutes** and that judges need not watch past three. The seven shots add up to 165 s, which leaves
15 s of margin. Upload it to YouTube as **Public**.

Language: English. Voice-over is written below; add English captions (the owner may prefer them).
No music: the rules forbid copyrighted music, and silence under the voice is fine. Do not show
third-party logos in the frame (browser bookmarks, a GitHub or npm logo page).

What the video shows, with what exists today:

- the web app on a **recorded** real repository, and **live** on another;
- a **séance downloaded** from the web app and **run** for real, then made to fail;
- the Crew app's **tools** through `apps/crew/scripts/mcp-call.mjs` (the app is not installed in a
  dashboard yet; see the note under shot 6).

The hero migration is `left-pad`. It is not in the three recorded samples, so the shot uses the
engine's own test project, which holds it. Say on screen when a project is a demo: shot 6 uses
`demo/haunted-app`, an invented app made for this purpose.

## Shot list

| # | Time | Length | On screen | Voice-over |
|---|---|---|---|---|
| 1 | 0:00 to 0:14 | 14 s | Black card, title **Necromancer**, line "Find the dead in your dependency tree." Then the number as large text: **34 of 100** and under it "active open-source projects depend directly on a package that is deprecated, archived, inactive or gone". Small source line: "Necromancer census, 100 projects, 95% CI 26 to 44". | "Every project stands on packages nobody looks after. So we counted. Of one hundred active open-source projects, thirty-four depend directly on a package that is deprecated, archived, inactive or gone." |
| 2 | 0:14 to 0:32 | 18 s | The live app, start page. Click the sample **appsecco/dvna**. The graveyard opens. Slow scroll over the zombie and dead tombstones. Click one tombstone: the evidence lines and the advisory id appear. | "This is Necromancer. No login, no server. Here is a real repository, recorded: dvna. Every dependency gets a verdict, with its evidence. This one is a zombie: dead, with a known advisory against the version in use." |
| 3 | 0:32 to 0:55 | 23 s | Click "Examine another project". Type `github.com/miguelgrinberg/microblog` into the box and press **Begin the autopsy**. The progress panel counts up, then the graveyard appears. Pan over it. | "Now live. I paste a public repository. The engine runs in my browser and asks the public registries. About fifty dependencies, a few seconds." |
| 4 | 0:55 to 1:20 | 25 s | Back to the start page. Choose the two files `package.json` and `package-lock.json` from `packages/engine/test/fixtures/projects/acceptance/` ("Choose files"). The graveyard shows request and node-sass as zombies, left-pad dead. Open **left-pad**, press **Resurrect**. The panel "Resurrection spec and séance" shows "Curated recipe: left-pad to String.prototype.padStart", Install, Run, and the known differences. Click **Download séance only (.zip)**. | "A dead package needs a way out. left-pad has one: padStart. But is it a drop-in? Necromancer writes a Kiro spec, and a séance: a test that asks the old package and the new one the same generated questions." |
| 5 | 1:20 to 1:52 | 32 s | Terminal, large font. Commands below (script 5). The test shows `Tests  6 passed (6)`. Then the plain `padStart` swap: red output with `Counterexample: [0,"7",""]`. Restore: green again. | "I download the séance and run it. Six properties pass with the careful replacement. Now the obvious swap, plain padStart. It fails, and the counterexample is an empty fill. Nobody wrote that difference down. The test found it. It even found a bug in left-pad itself." |
| 6 | 1:52 to 2:27 | 35 s | Terminal in `apps/crew`. Commands below (script 6): the tool list (ten tools), the autopsy summary of the demo app, the séance summary. Then briefly the files `apps/crew/agents/necromancer.json`, `apps/crew/skills/resurrection/SKILL.md` and `apps/crew/app.json` (the cron line `0 3 * * *`). | "The same engine is a Kiro Crew app, with ten MCP tools. This demo app is haunted on purpose: request is a zombie, left-pad is dead, moment is alive. The Necromancer agent follows the resurrection skill: it branches, runs the séance, swaps the package, and never pushes. Night Watch checks every night, and speaks only when something gets worse." |
| 7 | 2:27 to 2:45 | 18 s | The repository tree in an editor: `.kiro/specs` (nine folders), `.kiro/hooks`, `.kiro/steering`. Then the test output of CI (or the README test section). End card: **Necromancer**, "Raise your code on living ones.", the Pages address and the repository address (type them in; see the placeholders). | "Built in Kiro Crew, spec first: nine specs, eleven hooks, three steering files, property tests throughout. Of fifty-six flagged packages we checked by hand, fifty-five were right. Necromancer. Raise your code on living ones." |

Total: 14 + 18 + 23 + 25 + 32 + 35 + 18 = 165 s.

Voice-over pace: every shot is under 2.2 words per second (the fastest, shot 1, is 30 words in 14 s),
so the voice has room for pauses while the screen loads.

## Terminal scripts

Use a clean terminal, font 18 or larger, a dark theme. Replace `/path/to/necromancer` with the
clone. Build the Crew app once beforehand (`npm ci`, `npm ci --prefix ui`, `npm run build` in
`apps/crew`).

### Script 5: run the séance (shot 5)

Prepare once, off camera: `mkdir /tmp/my-app && cd /tmp/my-app && npm init -y`. Then on camera:

```sh
cd /tmp/my-app
unzip ~/Downloads/*-seance.zip
npm install --save-dev vitest fast-check left-pad
npx vitest run seance/left-pad
```

Result seen when these steps were rehearsed: `Tests  6 passed (6)`. Now the plain swap:

```sh
cat > seance/left-pad/replacement.mjs <<'EOF'
export function leftPad(str, len, ch) { return String(str).padStart(len, ch); }
EOF
npx vitest run seance/left-pad
```

Rehearsed result: 3 tests failed, `Property failed after 8 tests`, `Counterexample: [0,"7",""]`
(the numbers vary by run; the first counterexample is the empty fill). Put the careful file back
(unzip again with `unzip -o ~/Downloads/*-seance.zip`) and run once more: `Tests  6 passed (6)`.
The run takes about one second on a laptop.

### Script 6: the Crew app's tools (shot 6)

The tools run over stdio; `mcp-call.mjs` starts the server the way the platform does. Add
`NECROMANCER_BLOCK_HOSTS=api.github.com` only if the GitHub hourly limit is already used up; the
report then says GitHub was unavailable.

```sh
cd /path/to/necromancer/apps/crew
node scripts/mcp-call.mjs --list
node scripts/mcp-call.mjs autopsy '{"path":"/path/to/necromancer/demo/haunted-app"}' | node ../../docs/submission/demo/summarize-autopsy.mjs
node scripts/mcp-call.mjs seance '{"ecosystem":"npm","name":"left-pad","path":"/path/to/necromancer/demo/haunted-app"}' | node ../../docs/submission/demo/summarize-seance.mjs
```

Rehearsed output of the second command (the counts of the whole tree change with the day and with
GitHub's limit; do not read them out):

```
engine: engine   whole tree: {"alive":7,"dying":9,"dead":32,"ghost":0,"zombie":1}
request    2.88.2   zombie
left-pad   1.3.0    dead
moment     2.31.0   alive
sources unavailable: github
```

The third prints the recipe `left-pad`, `template: curated`, the project's four calls found in
`src/receipt.js`, and the first known differences. The commands take 1 to 5 seconds each.

**If the owner has installed the app** in the dashboard before recording, replace the second half of
shot 6 with the dashboard: the sidebar entry **Graveyard**, the page, and the Schedule page with
`night-watch` at 03:00. Keep the voice-over; only the picture changes. Do this only if the page was
seen working; `docs/verification/crew-app.md` lists what to check first.

## Before recording

1. **GitHub's limit.** Unauthenticated GitHub allows 60 calls an hour per IP. Shot 3 and shot 4 each
   spend some. Record them in a fresh hour, one take after the other. If the limit runs out, the app
   says which repositories were not checked; that is honest but not pretty, so wait and retry.
2. Run shots 3 and 4 once without recording, to warm the browser cache of the fonts.
3. Open the live app (the Pages address), not `npm run dev`, so the video shows the shipped site.
4. The three recorded samples show the day they were recorded on their card. Leave that visible.
5. Check the final cut: length under 3:00, the sound is only the voice, no private data in the
   terminal (home folder names, tokens), no third-party logos.
6. Upload to YouTube, **Public**, English title "Necromancer: find the dead in your dependency tree
   (Kiroween 2026)". Paste the address into the Devpost field `[[PLACEHOLDER: YOUTUBE_URL]]`.

## Where the video meets the rules

See the rules table in `docs/verification/submission-drafts.md`.
