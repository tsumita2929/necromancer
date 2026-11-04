<!--
DRAFT for the Bonus Blog Prize. Not published. The owner edits it, then publishes it on a
third-party blog platform (any public one) between 2026-10-30 09:00 PT and 2026-12-04 14:00 PT
(2026-10-31 01:00 JST to 2026-12-05 07:00 JST). The rules need the post to be public, about Kiro and
the project build, and to say it was written as part of the Kiroween 2026 hackathon. The second
paragraph does that; keep it. Then put the post's URL in the Devpost form.

Rewrite what you want in your own voice. Lines marked OWNER are yours to decide or remove.
Numbers carry hidden claim tags (invisible once published). The claim table is in
docs/verification/submission-drafts-r4.md. Replace the video placeholder before publishing.
-->

# We counted the dead packages in 100 real projects, then built a tool that tests the way out

*This post was written as part of the Kiroween 2026 hackathon. The project is Necromancer, an entry in the Resurrection category, built with Kiro.*

Every project stands on packages that nobody looks after. Some are deprecated, some are archived, and some carry advisories that will never be patched. A dead package fails quietly, and a package with no active maintainer is easy to take over. That happened with event-stream in 2018 and xz-utils in 2024.

So we counted. We drew 100 active open-source projects at random from npm and Python, popular and long-tail, and read their direct dependencies. **33 of the 100 depend directly on a package that is deprecated, archived, inactive or gone** (95% confidence interval 24.6% to 42.7%). <!-- claim:Q01 -->
If you also count packages the tool calls dead by its own rule (no sign of life for years), 179 of the 3,201 direct dependencies are dead or worse, about 1 in 18. 105 of those 179 rest on that rule alone, and the tool labels them "heuristic". <!-- claim:Q04 --><!-- claim:Q05 -->

We checked the tool's answers by hand. Of 40 flagged packages that our tuning had never seen, the final engine still flags 36. All 36 were right, and 35 also held up when we asked whether anyone had touched the project in the last year. <!-- claim:Q15 -->
We did not measure how many dead packages the tool misses, so these numbers are lower bounds.

## The hard part is the way out

"Just replace it" hides the work. A replacement often changes behavior. Necromancer writes a Kiro spec for each move, and a **séance**: a property-based test that asks the dead package and its replacement the same generated questions, and fails on any different answer.

Running the séances on real packages found things nobody had written down:

- `left-pad` to `padStart` is not a drop-in. `leftPad("abc", 6, "")` gives `"   abc"` and plain `padStart` gives `"abc"`. The test also found a bug in left-pad itself: a fractional length such as `5.5` gives `"undefinedabc"`. <!-- claim:S01 -->
- `querystring.parse("a=%zz")` throws `URIError`. `URLSearchParams` does not. <!-- claim:S02 -->
- The old `toml` package crashes on some documents and silently returns `{}` on others. Its successor is the stricter one. <!-- claim:S03 -->
- Our own mkdirp séance failed on mkdirp 3, which we only met because a recorded sample (mathjs) held it. mkdirp 3 has no default export. We fixed the recipe, and it now passes on mkdirp 0.5 to 3. <!-- claim:S07 -->

## Honest verdicts

A tool that says "dead" has to be right, or say how sure it is. Every verdict says whether it rests on a hard signal (deprecated, archived, yanked, gone, an advisory) or on a heuristic. A living package whose version in use is deprecated gets an upgrade notice, not a death sentence: 41 dependencies in our census carry one. <!-- claim:Q10 -->

## How we used Kiro

We built the whole product in Kiro Crew, spec first. A lead session split the work into items. A worker session took each one and reported its status as data, and each item ended with a verification record that lists the commands, the result lines and the gaps.

- **Specs.** Thirteen features, thirteen specs: requirements with numbered ids, a design, and a task list we ticked as we went. A test called `R6.5 untrusted text cannot add requirement ids` fails for a reason you can read. <!-- claim:K04 --><!-- claim:K07 -->
- **Steering and hooks.** Three always-on steering files, and eleven hooks. The hooks are written and valid, but we have not fired them: that needs the Kiro IDE, and we built in Kiro Crew. <!-- claim:K01 -->
- **MCP and a custom agent.** The Crew app is an MCP server with eleven tools, and the Necromancer agent must ask it for every verdict. The tool that writes files is apart from the read-only preview, and refuses unless the project is on a `resurrect/` branch. Fresh subagents followed the agent's prompt and skill on a demo app and raised `left-pad`, `request` and `is-odd` on local branches. They listed what the skill got wrong, and we fixed the skill from those lists. <!-- claim:K05 --><!-- claim:C01 -->
- **Property tests.** They found a Python template that was not valid Python, and a way for a package name to break out of a docstring. Example tests had missed both. <!-- claim:K02 -->
- **People who had not seen the design.** A reviewer subagent that saw only the source attacked our parsers and found 11 issues, including a 34-second hang on a long run of spaces. Later a tester who had built none of the code ran the finished product and wrote 21 findings; 20 are fixed. Properties find what their generators can reach; a fresh reader reaches other places. We needed all of it. <!-- claim:K03 --><!-- claim:A01 -->

OWNER: add one or two sentences here about what it was like to work this way, in your own words. Say what surprised you, or what you would do differently. Remove this line.

## What is not done

The Crew app is validated and its tools run, but when we wrote this it was not yet installed in a running dashboard. The generic séance template is a skeleton, and only six pairs have curated recipes. GitHub allows 60 unauthenticated calls an hour, so a big project can use up the budget. <!-- claim:C02 --><!-- claim:L03 --><!-- claim:L04 -->

## Try it

- The app (no login): https://tsumita2929.github.io/necromancer/
- The code (MIT): https://github.com/tsumita2929/necromancer
- The Kiro Crew app: https://github.com/tsumita2929/necromancer-crew-app
- The demo video: [[PLACEHOLDER: YOUTUBE_URL]]
