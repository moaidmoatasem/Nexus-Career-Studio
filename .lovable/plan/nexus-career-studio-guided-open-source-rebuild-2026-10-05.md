# Nexus Career Studio — Guided Open-Source Rebuild

## Product decision

Nexus will be an **open-source, self-hosted career workspace** first. Each community user runs or deploys their own instance, owns their data, and supplies any optional provider accounts or paid services they choose to enable.

A hosted service is not part of this scope. The architecture will keep that option possible later without making the community edition dependent on a central paid service.

## Core business rules

- The candidate always controls final submission. Nexus prepares, validates, and tracks an application, then opens the employer’s official portal for completion.
- No fabricated experience, metrics, requirements, salaries, locations, sponsorship claims, or application outcomes.
- Resume and application claims must trace back to verified Career Vault evidence.
- A sponsor-register match means the organisation holds a relevant licence; it does not guarantee sponsorship for that vacancy.
- Gmail access is per signed-in user, read-only, encrypted at rest, and limited to job alerts and recruitment messages.
- Automatic email stage changes require a high-confidence company-and-role match. Ambiguous messages remain in Review and never move a Kanban card automatically.
- LinkedIn and Indeed intake uses user-owned alert emails and pasted public links. LinkedIn’s jobs APIs require approved Talent Solutions access, so the ordinary LinkedIn profile/posting connector will not be presented as a job-feed API.
- Workday, Lever, Greenhouse, and Ashby support means parsing public job pages and preparing portal-specific application packs—not bypassing employer authentication, anti-bot controls, or candidate consent.
- Public job data keeps source URL, provider, extraction time, and verification status. Expired or inaccessible roles are marked clearly rather than silently retained as current.

## One guided user journey

```text
Welcome
  → Create account
  → Setup checklist
      1. Career basics
      2. Career Vault evidence
      3. Job preferences
      4. Gmail (optional)
  → Discover roles
  → Review fit and sponsor evidence
  → Save role
  → Prepare application pack
  → Review ATS resume and answers
  → Open official employer portal
  → Confirm submitted
  → Track recruiter email and next action
```

The sidebar will reflect this order and show progress:

1. **Today** — one prioritized next-action list
2. **Discover** — role inbox, public-link import, and source status
3. **Saved roles** — shortlisted opportunities awaiting preparation
4. **Applications** — preparation and outcome pipeline
5. **Career profile** — vault, preferences, and reusable answers
6. **Resume** — ATS document builder and downloads
7. **Connections** — Gmail and discovery-source health
8. **Sponsor check** — official register lookup

“Role Radar,” “Synthesizer,” “Oracle,” and other internal terminology will become plain task-based labels. Advanced provenance and scoring details remain available progressively rather than dominating the main flow.

## Experience and visual redesign

Use the selected **Guided workspace** direction: Midnight Signal palette, Space Grotesk headings, DM Sans body, restrained sidebar, and one primary action per screen.

- Replace dense dashboards and repeated status cards with a persistent setup/progress strip and contextual next step.
- Make empty states actionable: add evidence, set preferences, connect Gmail, or paste a job link.
- Turn role rows into scannable summaries with expandable evidence, source, sponsor result, and fit explanation.
- Use a focused application detail workspace instead of forcing all actions into narrow Kanban cards.
- Keep Kanban as a pipeline overview; opening a card shows timeline, checklist, materials, email evidence, and official portal action.
- Create a dedicated Connections screen with Connected, Needs attention, Manual-only, and Not connected states plus clear privacy explanations.
- Ensure mobile navigation, loading, empty, error, reconnect, expired-role, and reduced-motion states are designed explicitly.

## Functional work

### 1. Onboarding and navigation
- Add first-run onboarding tied to real profile completeness.
- Guide users through Career Vault, target roles/locations, visa needs, and optional Gmail.
- Make Today the signed-in starting point and derive its tasks from actual records.
- Add breadcrumbs and consistent Back/Continue actions through preparation and submission.

### 2. Real discovery inbox
- Keep the full verified shared role catalog and user-added roles separate.
- Import a pasted public job URL into one canonical Role Radar entry with duplicate detection.
- Discover roles from public employer and ATS pages according to user preferences.
- Parse supported LinkedIn/Indeed alert links received through Gmail; label them by source without implying direct feed access.
- Add lifecycle checks for stale, closed, inaccessible, and non-UK roles.
- Show exactly where and when each role was verified.

### 3. Gmail end-user journey
- Keep the existing linked Gmail client and encrypted per-user connection storage.
- Consolidate Connect, Reconnect, Check now, Disconnect, sync status, privacy, and troubleshooting on Connections.
- Complete automatic Gmail delivery with Google Pub/Sub configuration, authenticated callback validation, watch registration, renewal before expiry, and reconciliation after missed notifications.
- Process messages idempotently and record an auditable email timeline without displaying full mailbox contents unnecessarily.
- Test with the user’s real Gmail only after they approve Google consent; identify one real recruiter message, show its classification, match evidence, Kanban change, and rollback/review behavior.

### 4. Assisted application workspace
- Add a guided application detail page for every saved role.
- Support manual job details when no public URL is available.
- Generate and review role-specific resume, cover letter, and common ATS answers from verified vault facts.
- Provide adapter-specific checklists for Workday and Lever, with clear fields the user must complete on the official site.
- Open the official posting in a new tab, then require the user to confirm submission before moving to Applied.
- Record submission time, source URL, notes, and all later stage changes in the timeline.

### 5. ATS resume and PDF
- Replace the preview-only experience with a structured resume editor populated from Career Vault evidence.
- Normalize all user-entered text to Unicode NFC before validation and export.
- Enforce single-column ATS-safe ordering, standard headings, selectable sections, and deterministic page layout.
- Generate a real downloadable text-based PDF; verify copy/paste extraction, Unicode, links, pagination, and filename.
- Keep a plain-text ATS inspection view beside the rendered document.

### 6. Sponsor register
- Keep the imported full Home Office snapshot and provenance display.
- Add exact legal-name matches, known-brand aliases such as DeepMind → Google (UK) Limited, location/licence-route detail, and conservative fuzzy suggestions.
- Add freshness and archived snapshot handling without overwriting historical provenance.
- Test real organisations across exact, alias, ambiguous, and no-match cases.

### 7. Open-source operations
- Add a concise setup path covering database/auth, AI, Firecrawl or equivalent extraction, Gmail OAuth, and optional Pub/Sub.
- Make optional integrations degrade cleanly: manual URLs and manual inbox checks continue to work without paid automation.
- Document expected cost drivers and offer low-cost defaults: user-triggered discovery, bounded extraction, manual Gmail sync, and no always-on polling.
- Add privacy, data export, account deletion, connector revocation, and retention controls suitable for community deployments.
- Keep provider-specific credentials outside source control and include environment-variable templates containing names only.

## Verification and acceptance

- Create a fresh real account and complete onboarding.
- Add real Career Vault evidence and preferences.
- Import a live public job link, confirm one Role Radar entry, score explanation, and sponsor result.
- Save it, create its application, generate grounded materials, download the ATS PDF, open the official portal, and confirm submission into Applied.
- Connect the user’s real Gmail through consent and test both manual sync and an automatic Pub/Sub notification using a real recruitment message.
- Confirm confident email matching changes the intended application and ambiguous matching requires review.
- Walk Today, Discover, Saved roles, Applications, Career profile, Resume, Connections, and Sponsor check on desktop and mobile.
- Verify no cross-user data exposure, no browser-visible connector keys, no invented claims, no duplicate jobs/messages, and no unresolved build/runtime/security warnings.

## Delivery sequence

1. Navigation, onboarding, plain-language IA, and empty states.
2. Discovery lifecycle, source provenance, and job-link flow.
3. Application detail workspace and assisted submission journey.
4. Career Profile and real ATS PDF pipeline.
5. Connections center and Gmail manual flow.
6. Pub/Sub automation and watch renewal.
7. Sponsor search refinements and full end-to-end validation.
8. Open-source installation, privacy, and cost documentation.

## External prerequisites and limits

- The real Gmail walkthrough requires the user to complete Google consent for their own mailbox.
- Automatic Gmail delivery requires a Google Cloud Pub/Sub topic and authenticated push subscription configured by the deployment owner.
- LinkedIn live job-search access will not be implemented without LinkedIn Talent Solutions approval; alert emails and public links are the supported community path.
- Workday does not provide one universal candidate OAuth connection across employers; automation is limited to public employer endpoints and assisted portal completion unless an employer grants tenant-specific access.
