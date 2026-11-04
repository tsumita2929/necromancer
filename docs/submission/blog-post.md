<!--
DRAFT for the Bonus Blog Prize. Not published. The owner edits it, then publishes it on a
third-party blog platform (any public one) between 2026-10-30 09:00 PT and 2026-12-04 14:00 PT
(2026-10-31 01:00 JST to 2026-12-05 07:00 JST). The rules need the post to be public, about Kiro and
the project build, and to say it was written as part of the Kiroween 2026 hackathon. The second
paragraph does that; keep it. Then put the post's URL in the Devpost form.

Rewrite what you want in your own voice. Lines marked OWNER are yours to decide or remove.
Numbers carry <!-- claim:ID --> tags (invisible once published). The claim table is in
docs/verification/submission-drafts.md. Replace the placeholders before publishing.
-->

# We counted the dead packages in 100 real projects, then built a tool that tests the way out

*This post was written as part of the Kiroween 2026 hackathon. The project is Necromancer, an entry in the Resurrection category, built with Kiro.*

Every project stands on packages that nobody looks after. Some are deprecated, some are archived, and some carry advisories that will never be patched. A dead package fails quietly, and a package with no active maintainer is easy to take over. That happened with event-stream in 2018 and xz-utils in 2024.

So we counted. We drew 100 active open-source projects at random from npm and Python, popular and long-tail, and read their direct dependencies. **34 of the 100 depend directly on a package that is deprecated, archived, inactive or gone** (95% confidence interval 26 to 44). <!-- claim:N01 -->
We then checked 56 of the packages our tool flagged against the registry, the repository and the advisory records. 55 were right. 46 also held up when we asked whether anyone had touched the project in the last year. <!-- claim:N03 -->
That second number is the one to be careful with: the "dying" class is the weak one, and the census says so. We did not measure how many dead packages the tool misses, so these are lower bounds.

## The hard part is the way out

"Just replace it" hides the work. A replacement often changes behavior. Necromancer writes a Kiro spec for each move, and a **séance**: a property-based test that asks the dead package and its replacement the same generated questions, and fails on any different answer.

Running the séances on real packages found things nobody had written down:

- `left-pad` to `padStart` is not a drop-in. `leftPad("abc", 6, "")` gives `"   abc"` and plain `padStart` gives `"abc"`. The test also found a bug in left-pad itself: a fractional length such as `5.5` gives `"undefinedabc"`. <!-- claim:S01 -->
- `querystring.parse("a=%zz")` throws `URIError`. `URLSearchParams` does not. <!-- claim:S02 -->
- The old `toml` package crashes on some documents and silently returns `{}` on others. Its successor is the stricter one. <!-- claim:S03 -->

## How we used Kiro

We built the whole product in Kiro Crew, spec first. A lead session split the work into items. A worker session took each one and reported its status as data, and each item ended with a verification record that lists the commands, the result lines and the gaps.

- **Specs.** Nine features, nine specs: requirements with numbered ids, a design, and a task list we ticked as we went. A test called `R6.5 untrusted text cannot add requirement ids` fails for a reason you can read. <!-- claim:K04 --><!-- claim:K07 -->
- **Steering and hooks.** Three always-on steering files, and eleven hooks. The hooks are written and valid, but we have not fired them: that needs the Kiro IDE, and we built in Kiro Crew. <!-- claim:K01 -->
- **MCP and a custom agent.** The Crew app is an MCP server with ten tools, and the Necromancer agent must ask it for every verdict. Fresh subagents followed the agent's prompt and skill on a demo app and raised `left-pad`, `request` and `is-odd` on local branches. They listed what the skill got wrong, and we fixed the skill from those lists. <!-- claim:K05 -->
- **Property tests.** They found a Python template that was not valid Python, and a way for a package name to break out of a docstring. Example tests had missed both. <!-- claim:K02 -->
- **A reviewer who has not seen the design.** A subagent that saw only the source attacked our parsers. It found 11 issues, including a 34-second hang on a long run of spaces. Properties find what their generators can reach; a fresh reader reaches other places. We needed both. <!-- claim:K03 -->

OWNER: add one or two sentences here about what it was like to work this way, in your own words. Say what surprised you, or what you would do differently. Remove this line.

## What is not done

The Crew app is validated and its tools run, but when we wrote this it was not yet installed in a running dashboard. The generic séance template is a skeleton, and only six pairs have curated recipes. GitHub allows 60 unauthenticated calls an hour, so a big project can use up the budget. <!-- claim:C02 --><!-- claim:L03 --><!-- claim:L04 -->

## Try it

- The app (no login): [[PLACEHOLDER: PAGES_URL]]
- The code (MIT): [[PLACEHOLDER: REPO_URL]]
- The Kiro Crew app: [[PLACEHOLDER: CREW_REPO_URL]]
- The demo video: [[PLACEHOLDER: YOUTUBE_URL]]
