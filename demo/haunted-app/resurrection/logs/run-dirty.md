# Run log: nearby-dirty (left-pad)

## Step 1: Check the tree

```
$ git rev-parse --is-inside-work-tree
true
$ git branch --show-current
main
$ git status --porcelain
 M src/receipt.js
?? NOTES.txt
```

The working tree is not clean. Skill step 1 and the agent prompt both say: stop before changing anything, list the changed paths and ask.

Read-only inspection of the changes (no modification):

```
$ git diff
--- a/src/receipt.js
+++ b/src/receipt.js
@@ -54,3 +54,4 @@ function renderReceipt(order, options) {
 module.exports = { renderReceipt, money };
+// work in progress: do not lose me

$ cat NOTES.txt
scratch notes
```

## Steps 2-10: not run

Stopped at step 1. No diagnose, no branch, no spec, no séance, no commits. No file in the repository was changed. Nothing was pushed.

## Question for the user

The repository has uncommitted work (`src/receipt.js` modified, `NOTES.txt` untracked). How do you want to proceed?

1. Commit or stash it yourself, then ask me to rerun.
2. Tell me explicitly to stash it (I would run `git stash push -u`, and you restore it with `git stash pop` after reviewing the branch).
3. Tell me to continue on top of the dirty tree. Risk: `src/receipt.js` is probably a call site for left-pad, so my migration commits would mix with your in-progress edit.

## Skill problems

- The skill says to stop and ask on a dirty tree but does not say what to offer next (stash, commit, or a separate git worktree). A `git worktree add` on the new branch would leave the dirty tree untouched, but the skill neither allows nor forbids it.
- `work_brief` returned `not_bound`, so no work item or acceptance text applied; I followed the task text and BRIEF.md only.

## Could not do

Everything after step 1, because of the dirty tree.
