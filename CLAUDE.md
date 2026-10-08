@AGENTS.md

## Claude Code
- The remaining work, in order, is in [PLAN.md](PLAN.md). "Continue", "next" or "do the plan" means: take the first unchecked task whose prerequisites are done and follow the rules at the top of PLAN.md.
- Several agents can work at once ([docs/agents/README.md](docs/agents/README.md)). A session started with a brief ("Follow docs/agents/briefs/<id>.md") is a **worker**: it does that task only, on its own branch, and stops at its acceptance checks. The owner's main session is the **orchestrator**: it assigns `ready` tasks from [docs/agents/STATUS.md](docs/agents/STATUS.md), starts worker sessions, reviews their PRs against the brief, and keeps STATUS.md and the briefs current.
- Steps marked **[owner]** need the repository owner. Prepare everything around them, ask one precise question, and wait.
- Gates in PLAN.md are binding: never start work behind a gate the owner hasn't ticked, and never tick one yourself.
- Track A work happens in the owner's fork of career-ops once it is attached to the session; follow that project's own contribution rules there.
- The product direction and its automation policy are in [STRATEGY.md](STRATEGY.md); follow them in any task that touches automation, job sources or personal data.
