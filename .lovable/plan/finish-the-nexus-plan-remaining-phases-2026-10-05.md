# Finish the Nexus plan: remaining phases

Already built: Mission Control, agent on/off with three autonomy modes, background heartbeat, activity log, health check, Docker setup with scheduler, Gmail setup helper, ATS formats (PDF/Word/text), fact-check report, portal assistant.

Still open, in build order:

## 1. Sponsor intelligence (Phase 9a)
- Refresh button on Sponsor check: fetches the latest official Home Office register, stages it, validates row counts, then switches over. The previous snapshot is kept as history.
- The agent also checks for a newer register weekly.
- Each result shows the matched legal name, why it matched (exact, alias, similar name), and how fresh the snapshot is.
- Each role is scanned for sponsorship wording ("visa sponsorship available", "must have right to work"). This is shown separately from the register result, with the warning that being on the register does not guarantee sponsorship.

## 2. Outcome insights (Phase 9b)
- New Insights section in Mission Control:
  - pipeline funnel (saved, applied, response, interview, offer)
  - response rate by source and by resume format
  - average days to first reply
- Career gaps: skills that keep appearing in your target roles but are missing or weakly evidenced in your Career Vault, with a short suggestion for each.
- All numbers are calculated from your own records, with no AI guesses.

## 3. Review queue in Mission Control (Phase 5 finish)
- One "Needs your decision" list that combines:
  - unclear recruiter emails, with a suggested match
  - follow-ups due
  - applications ready to submit
  - agent runs that need you
- Unclear emails get a "Link to this application" action, not just Dismiss.

## 4. Data ownership (Phase 2 finish)
- Settings page: download all your data as one file, and delete your account and data (with confirmation).
- Backup and restore steps added to the deployment guide.

## 5. Optional browser worker (Phase 7 finish)
- A separate, optional program that runs on your own server next to the app and is off by default.
- When you press "Prepare in portal", it opens the official form and fills only the routine fields from your Career Vault. It uploads only files you've approved, takes a screenshot, then stops and hands over to you.
- It always stops at security checks, sign-in codes, legal or visa questions and the final Submit.
- It ships as an extra service in the Docker setup with its own guide. This preview cannot run it, so it will be tested by its scripts only.

## Waiting on you (cannot be done by me)
- Add the Gmail address in Google Cloud and press Connect Gmail.
- Google notification setup for instant Gmail updates.

## Technical details
- Sponsor refresh: server function with an admin check, reusing the existing staging and activation functions. A new `refresh_sponsor_snapshot` task runs in the agent heartbeat.
- Sponsorship wording: deterministic regex rules in `src/lib/sponsorship.ts`, shared by client and server.
- Insights: derived from `applications`, `application_events` and `jobs` in a pure module with unit tests.
- Review queue: derived from existing tables; a new "link" action on unmatched mail writes an `application_events` row.
- Export: an authenticated server function that returns JSON of the user's own rows. Delete: an authenticated server function that removes user rows and then the auth user.
- Browser worker: a `worker/` folder with a Playwright Node service that polls a new `portal_tasks` table (user-scoped RLS, service-role writes). Adapters for Lever, Greenhouse and Workday-assisted fall back to the guided checklist. Screenshots go to private storage.
