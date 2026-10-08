# Working on Nexus as an agent

This page is for any coding agent (Claude Code, Codex, Cursor, Jules or similar) picking up a task from
[PLAN.md](../../PLAN.md). It is short on purpose: read it, then your brief, and nothing else unless the brief names it.

## Read in this order
1. [AGENTS.md](../../AGENTS.md): the project and architecture rules. They are binding.
2. PLAN.md, section "How to work through this plan": gates, owner steps, secrets, and what goes into every PR.
3. Your brief in [briefs/](briefs/), named after the task id (for example `briefs/4.1-gmail-push-docs.md`).
   It lists the files you own, what to reuse, the tests to write and the acceptance checks.

[STATUS.md](STATUS.md) shows every open task, its state and who has it.

## Before you start
- Only take a task whose state in STATUS.md is `ready`, or one the orchestrator assigned to you.
  - `gate-1` and `gate-2` tasks wait until the owner ticks that gate in PLAN.md.
  - `owner` tasks need the repository owner.
  - `waiting-on-owner-ask` tasks start only when the owner asks for them.
- Stay inside your task's **file area**; other agents may be working next to you. If you must change a file outside
  it, say why in the PR.

## Setup and checks
```sh
bun install --frozen-lockfile
# typecheck, lint, unit tests and build (placeholder Supabase values are enough):
VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=x bun run check
bunx vitest run src/test/<file>.test.ts   # one test file while iterating
bun run e2e                               # when a user flow changes; needs Docker and local Supabase (DEPLOY.md section 0)
```
CI runs the same checks on every pull request. The end-to-end test runs nightly, and on pull requests that change
`e2e/`.
- **Lint:** 7 `react-refresh` warnings are expected.
- **New SQL:** a migration also extends `src/test/migrations.test.ts` and regenerates the database types (AGENTS.md).

## Branch, commits and pull request
- One task, one branch: `agent/<task-id>-<slug>`, from the latest `main`.
- One **draft** pull request against `main`. In the PR:
  - Use the brief's acceptance checks as its checklist.
  - Tick the task's box in PLAN.md.
  - Add the PR link to the task's row in `docs/agents/STATUS.md`.
  - Update `roadmap.md` if a roadmap line is finished.
- Never merge, never push to `main`, never rewrite published history, never tick a gate. The owner merges.
- Secrets live only in `.env` or the host's secret store: never in commits, PR text, logs or chat.
- Fix your own CI failures. A failing test is never "flaky" until you have proved it.

## When you are stuck
If the work needs an owner decision, an account, or a closed gate, stop. Write one precise question in the PR
description, and leave the PR as a draft. If the brief is wrong or out of date, fix the brief in the same PR and say
why.

## For the orchestrator
The orchestrator is the Claude Code session that owns PLAN.md (see [CLAUDE.md](../../CLAUDE.md)).
- **Assigning work:** it assigns tasks, keeps STATUS.md current, and starts worker sessions with the prompt
  "Follow docs/agents/briefs/<id>.md".
- **Reviewing PRs:** it checks each PR against its brief's acceptance checks before the owner merges.
- **Briefs for the next phase:** when a gate opens, it checks the briefs for that phase against the current code
  before assigning them.
