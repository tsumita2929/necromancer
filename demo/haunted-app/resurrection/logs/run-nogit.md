# Run log: nearby-nogit (left-pad)

> Paths: `<scratch>/` stands for the scratch folder of the machine where this run was made. The host path was replaced; nothing else in this log was changed.

## Step 1: Check the tree

Command: `git rev-parse --is-inside-work-tree` in `<scratch>/nearby-nogit`

```
fatal: not a git repository (or any of the parent directories): .git
exit=128
```

`git rev-parse --show-toplevel` gave the same error, so no parent directory is a repository either.

Skill rule: "If it is not a git repository, stop and say so; never run `git init` yourself."

Outcome: stopped. No diagnosis, branch, spec, séance, migration or commit was made. No file in the project was changed. Nothing was pushed.

## Séance results

None. The run stopped at step 1.

## Proof that the séance can fail

Not done, because no séance was written.

## Skill problems

- The skill says to stop but gives no wording or next step for the user (for example "run `git init` and commit a baseline yourself, then ask me again"). The agent has to improvise the advice.
- Step 1 does not say whether a non-repository should be reported before or after the read-only `diagnose`/`successors` steps. Those steps need no git, so the user could still get the verdict and the planned way out. The skill reads as stop-everything.
- The brief tells the agent to show `git log --oneline --stat` and `git diff --stat main..resurrect/<dependency>`, which cannot apply to a non-repository run.

## Could not do

Everything after step 1: diagnose, successors, branch `resurrect/left-pad`, spec in `.kiro/specs/migrate-off-left-pad/`, séance, migration commits, removal of left-pad.
