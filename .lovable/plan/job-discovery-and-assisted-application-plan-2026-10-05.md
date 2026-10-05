# Job Discovery and Assisted Application Plan

## Where the product stands today

- **Job discovery:** not automated. Role Radar reads a starter catalog plus roles users enter manually.
- **LinkedIn and Indeed:** not connected. Users cannot yet paste a link and have the role extracted.
- **Application flow:** partially assisted. Nexus can tailor grounded materials, copy the cover letter, and open the employer’s application page; the user submits it.
- **Inbox automation:** the classifier works only when an email is pasted manually. Gmail and Outlook are not connected.
- **Tracking:** applications can be queued and moved across stages, but there is no automated activity history or discovery schedule.

## Target experience

```text
Search preferences
      ↓
Daily discovery from company career pages and email alerts
      ↓
LinkedIn / Indeed / employer links can also be pasted on demand
      ↓
Deduplicate → extract → score → sponsor-check
      ↓
Review inbox: Save / Dismiss / Tailor
      ↓
Grounded CV + cover letter + answers prepared
      ↓
Open original application → user reviews and submits
      ↓
Gmail / Outlook responses update the pipeline and next action
```

## What to build

### 1. Make the workflow explicit
- Turn Role Radar into a **Discovery Inbox** with clear source labels, freshness, fit, sponsor confidence, and Save/Dismiss/Tailor actions.
- Add a compact setup checklist: career evidence, search preferences, job sources, and email connection.
- Add a “Today” view showing newly found roles, applications ready to submit, and responses requiring action.
- Keep the chosen minimalist sidebar and Midnight Signal visual system.

### 2. Search preferences and discovery controls
- Add user-owned search settings: target titles, locations, remote preference, salary floor, domains, excluded employers/keywords, sponsorship requirement, and discovery frequency.
- Add source controls for company career pages and email alerts.
- Show last successful sync, next scheduled run, per-source status, and actionable errors.

### 3. Company career-page discovery
- Connect a server-side web discovery service and search supported company career pages and common employer hiring platforms.
- Run a daily, bounded discovery process, deduplicate by canonical URL and normalized company/title/location, then save only new roles.
- Extract structured role details before applying the existing deterministic score and UK sponsor check.
- Add manual refresh with progress and per-source results.

### 4. LinkedIn, Indeed, and direct-link intake
- Add one prominent “Paste job link” action accepting LinkedIn, Indeed, or an employer URL.
- Extract title, company, location, description, requirements, salary when present, and original source URL.
- Show an editable preview before saving and clearly report blocked/private/expired pages rather than inventing missing details.
- Treat LinkedIn and Indeed as **link-intake sources**, not direct job-feed integrations, unless a supported provider capability is verified later.

### 5. Gmail and Outlook connections
- Let each signed-in user connect their own Gmail or Outlook account with read-only mail access.
- Store each connection handle encrypted and server-side; never expose provider credentials to the browser.
- Import only recruitment-related messages, classify them with the existing triage logic, match them to applications, and update stage/next action.
- Add reconnect, disconnect, last-sync, and manual-sync states. Prefer provider events/subscriptions where supported; use low-frequency reconciliation only as a fallback.

### 6. Assisted application workspace
- Keep submission candidate-controlled: Nexus prepares content, opens the original portal, and the user submits.
- Add an application checklist with resume, cover letter, common answers, sponsor check, portal link, and completion status.
- Provide copy controls for each answer and a final “Open application” action.
- After returning, ask the user to confirm submission and record the timestamp and source.
- Do not build unattended auto-submit or credential sharing with job boards.

### 7. Trust, history, and automation visibility
- Record discovery, scoring, tailoring, email classification, stage changes, and submission confirmation in an application activity timeline.
- Show why every role was surfaced and why every application moved stages.
- Preserve the existing provenance gate: no unverified metric or unsupported claim can be saved in tailored output.

## Data and technical work

- Extend user profile data with search preferences and automation settings.
- Add user-scoped source configuration, discovery runs, role decisions, sync state, and application events with strict access policies.
- Keep shared discovered jobs separate from private user-added roles and deduplicate before scoring.
- Put authenticated connector and extraction calls in server functions; keep scheduled callbacks idempotent and protected by a server-only secret.
- Limit outbound work to safe batches compatible with the published runtime.
- Configure per-user Gmail and Outlook clients, then implement consent, encrypted connection storage, read-only message retrieval, and reconnection handling.
- Connect a suitable web discovery service for career-page and pasted-link extraction before implementing those server calls.

## Delivery sequence

1. **Workflow foundation:** search preferences, Today view, Discovery Inbox, source states, and activity history.
2. **Link intake:** LinkedIn, Indeed, and employer-link extraction with review-before-save.
3. **Automated discovery:** company career-page search, deduplication, daily runs, and manual refresh.
4. **Mailbox automation:** Gmail and Outlook per-user connection, recruiter-email sync, matching, and pipeline updates.
5. **Assisted apply:** application checklist, prepared answers, portal handoff, and submission confirmation.
6. **Verification:** test the full signed-in flow with real role links, connected mailboxes, mobile/desktop layouts, failures, reconnects, and duplicate results.

## Dependencies and boundaries

- The Gmail and Outlook steps require workspace OAuth clients to be connected for per-user access.
- Career-page and link extraction requires a project-level web discovery connection.
- LinkedIn’s available connector supports member profile/post access, not a verified job-search feed. Indeed has no direct connector available in this workspace. The first release therefore uses pasted links for both and company career pages for automated discovery.
- The selected automation level is **Assisted apply**: Nexus prepares and tracks; the user performs the final review and submission.