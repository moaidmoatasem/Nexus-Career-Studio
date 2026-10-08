# N.1 Complete data export and account deletion

**State:** ready · **Needs:** nothing
**File area:** `src/lib/account.functions.ts`, `src/test/account.test.ts` (new)
**Branch:** `agent/N.1-export-deletion` · **PLAN.md:** Track N (found while writing the 12.3 and 13.1 briefs)

## Goal
AGENTS.md promises that every user can export and delete everything. Today two things fall short:
- **Deletion:** `deleteMyAccount` leaves behind the user's `usage_counters` rows, the `automation_jobs` row with
  `job_key = 'agent:<uid>'`, and any `app_user_connections` row when Gmail isn't connected.
- **Export:** `exportMyData` leaves out `gmail_sync_state` (which holds the mailbox address), `usage_counters`, and the
  shared catalog jobs that the user's applications and role decisions point to.

No table references `auth.users` with `on delete cascade`, so deleting the sign-in removes none of this. Fix both
functions, and add a test that fails whenever a new user-scoped table is missed.

## Prior art to check first
None found. This is Nexus's own personal-data guarantee.

## What to build
1. **One list of tables.** In `src/lib/account.functions.ts`, keep the user-scoped tables in one exported list that
   both functions use. Add `gmail_sync_state`, `usage_counters` and `app_user_connections`; the export skips `app_user_connections`,
   because that table holds the encrypted tokens. Delete in an order that
   respects foreign keys; the current delete loop already shows one.
2. **Deletion:**
   - Also delete `automation_jobs` where `job_key = 'agent:' || uid`.
   - Delete any `app_user_connections` rows that are still left, after the Gmail disconnect step. Never export their
     encrypted tokens.
3. **Export:**
   - Add `gmail_sync_state` and `usage_counters`.
   - Add the shared catalog `jobs` rows referenced by the user's `applications.job_id` and `role_decisions.job_id`,
     under a key such as `catalog_jobs_you_used`. Keep `jobs_added_by_you` as it is.
4. **Guard against missed tables:** the new test reads every `supabase/migrations/*.sql` file, collects each
   `create table public.<name>` that has a `user_id` column, and checks each one is either in the shared list or in a
   short allowlist of tables that hold no personal data, with a reason next to each entry.

## Database
No migration. Don't add foreign keys to `auth.users`; that is 12.3's decision.

## Tests
`src/test/account.test.ts`:
- **Table coverage:** the migration scan described above.
- **Deletion:** unit-test the delete path with a fake admin client (follow the `vi.hoisted` fake in
  `src/test/gmailSync.test.ts`). Every table gets a delete call filtered to the user, and the automation job is
  removed. If any delete fails, the sign-in is kept.

## Acceptance checks
- [ ] `bun run check` passes.
- [ ] Deleting an account removes the rows in `usage_counters`, `gmail_sync_state`, `app_user_connections` and the
  `agent:<uid>` automation job.
- [ ] The export includes `gmail_sync_state`, `usage_counters` and the catalog jobs the user referenced, and never
  includes tokens.
- [ ] The coverage test fails if a new user-scoped table is added without being listed.
- [ ] The row in `docs/agents/STATUS.md` links the PR.

## Out of scope
Backups, admin logs and per-user limits (12.3). Importing an export (13.1).

## Owner questions
None.
