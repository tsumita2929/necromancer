# Resurrection evidence

What the Necromancer agent produced from this haunted app. The runs happened on throwaway
copies in a scratch directory outside this repository; the copies were their own git
repositories. Nothing here is a branch of the Necromancer repository.

| File | What it is |
|---|---|
| `left-pad.patch` | `git format-patch main..resurrect/left-pad`: spec, `src/pad.js`, séance, call-site change, dependency removal. Lockfile and the recorded-answers JSON are left out. |
| `request.patch` | The same for `request` to `fetch` (`resurrect/request`). |
| `logs/run-*.md` | The agent's step-by-step logs: commands, output, counterexamples, "Skill problems". |

Logs: `left-pad`, `request` (the two demo migrations); `raise` (is-odd, the raise path);
`nosucc` (array-flatten, no successor); `dirty` (uncommitted changes, agent stops);
`nogit` (not a git repository, agent stops).

Apply a patch to a clean copy of this app on a branch to see the result:

```
cp -r demo/haunted-app /tmp/haunted && cd /tmp/haunted && rm -rf node_modules
git init -b main && git add -A && git commit -m base
git switch -c resurrect/left-pad && git am /path/to/left-pad.patch
npm install && npm test
```
