# Social post draft (Social Blitz Prize)

**Draft for the owner to rewrite in their own voice.** Not posted.

What the rules ask (Official Rules, section 4 and the Resources page):

- Post on any social platform (X, LinkedIn, Instagram, TikTok and others).
- The post **must start with** `#KiroweenHackathon26`, before any other text.
- Share your **favorite thing about Kiro** and **how it changed the way you approached development**.
- Post **during the Submission Period**: from 2026-10-30 09:00 PT to 2026-12-04 14:00 PT
  (2026-10-31 01:00 JST to 2026-12-05 07:00 JST).
- Put the post's link in the Devpost form. Keep the post public.
- The Kiro team picks 5 posts. The rules say they judge the post content ("original thoughts vs AI writing,
  interesting insights or learnings about Kiro") and the quality of any image or video. A post that reads as
  written by a tool is less likely to win. So the favorite thing and the change must be yours.

The two sentences in brackets are the ones only you can write. The facts around them come from the build;
each number has a tag, and the claim table in `docs/verification/submission-drafts.md` says where it is from.

## Short version (for X; 280 characters or fewer once you fill in the brackets)

```
#KiroweenHackathon26 My favorite thing about Kiro: [OWNER: one sentence]. It changed how I build: [OWNER: one sentence]. Necromancer finds dead dependencies and tests the way out. [[PLACEHOLDER: PAGES_URL]]
```

(223 characters with the brackets as written. X counts a link as 23 characters.)

## Longer version (LinkedIn, Mastodon, a blog-style thread)

```
#KiroweenHackathon26

My favorite thing about Kiro: [OWNER: your own words].

How it changed the way I build: [OWNER: your own words].

I built Necromancer for the Resurrection category. It reads a project's dependencies, marks the dead ones, and writes a Kiro spec and a property-based test for the way out. We counted 34 of 100 real projects that depend directly on a deprecated, archived, inactive or gone package. The test found a bug in left-pad itself.

Try it, no login: [[PLACEHOLDER: PAGES_URL]]
Code: [[PLACEHOLDER: REPO_URL]]
```

<!-- claim:N01 --><!-- claim:S01 -->

## Candidate ideas for the two sentences (from what the build showed)

Use one only if it is true for you. Change it freely or drop it.

| Idea | What in the build shows it |
| --- | --- |
| Numbered requirement ids let a failing test say which promise broke. | Tests are named after their requirement ids (for example `R6.5 untrusted text cannot add requirement ids`); see `.kiro/specs/seance/requirements.md`. |
| A property test finds the case you did not think to write. | The séance found left-pad's `5.5` bug and the empty-fill difference (`docs/verification/seance.md` section 4). |
| A reviewer that has not seen your design finds what your own tests cannot. | A subagent that saw only the source found 11 issues, among them a 34-second hang (`docs/verification/engine.md` section 2.4). |
| Splitting work into items that each end with a record of commands and gaps. | `docs/verification/` has one record per item. |

## Images

A post with a picture does better with the judges. Files you can use, from this repository:

- `docs/screenshots/graveyard-full-desktop.png`
- `docs/screenshots/seance-top-desktop.png`

Check them before use; they were made by a script.
