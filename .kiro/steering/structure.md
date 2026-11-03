---
inclusion: always
---

# Structure and ownership

```
necromancer/
  .kiro/steering/          product.md, tech.md, structure.md     owner: lead
  .kiro/specs/<feature>/   requirements.md, design.md, tasks.md  owner: that feature
  .kiro/hooks/             <feature>-*.kiro.hook                 owner: that feature
  packages/engine/         verdict engine and shared contract     owner: engine
  apps/web/                static web app                         owner: web
  apps/crew/               Kiro Crew app                          owner: crew app
  docs/verification/       <item>.md, one per work item           owner: that item
  docs/screenshots/        product screenshots                    owner: web
  docs/                    research, submission, README assets    owner: assigned per item
```

## Rules

- One owner per path. Do not edit a path you do not own; ask the lead instead.
- The shared contract is `packages/engine/src/types.ts`. Code against it. Only the
  engine item changes it, and only after the lead agrees.
- Every feature is built spec-first: write `.kiro/specs/<feature>/requirements.md`
  (user stories with EARS acceptance criteria, numbered), then `design.md`, then
  `tasks.md`, and implement task by task, ticking `tasks.md` as you go.
- A file in `docs/verification/` is written only after that item's checks pass. It
  records the commands run and their results, what was tested, and known gaps.
