# Production discovery, mailbox automation, and UK sponsor register

## Goal
Replace demo data and manual-only syncing with a real, end-user workflow:

```text
User preferences
  → employer career sites / public ATS feeds / LinkedIn & Indeed alert emails
  → verified job records
  → fit + sponsor checks
  → Discovery Inbox
  → tailored application
  → recruiter email
  → application stage + next action
```

The build will support approved LinkedIn/Indeed partner APIs later, without pretending that ordinary consumer job-feed OAuth exists today.

## Confirmed current state
- Role Radar currently reads eight shared seed roles; the records are generic samples rather than verified live postings.
- The sponsor table currently contains 32 starter organisations, although fuzzy matching and the lookup page already work.
- Gmail’s per-user OAuth client is linked and permits persistent read-only access, but no end user has completed the mailbox connection yet.
- Gmail currently checks at most 15 recent messages only when the user clicks **Check inbox now**. It then classifies messages and can move a matching application card.
- No scheduled discovery or mailbox job is active.
- LinkedIn’s available connector covers profile/posting functions, not a consumer job feed. LinkedIn and Indeed job APIs require approved employer/ATS partnerships. Workday APIs are employer-tenant specific, not a universal end-user job-search OAuth service.

## 1. Real discovery sources
- Keep one clear **Sources** area inside Discover with individual states for:
  - Employer career pages and public ATS feeds
  - LinkedIn job-alert emails
  - Indeed job-alert emails
  - Workday-hosted employer career pages
  - Gmail
- Treat LinkedIn and Indeed as user-authorized alert-email/link sources now. Do not scrape their signed-in sites or imply a direct job-feed connection.
- Discover Workday roles through public employer career pages and tenant job endpoints where publicly exposed; no fake universal Workday OAuth.
- Keep **Paste job link** for LinkedIn, Indeed, Workday, and employer URLs. Show a review screen before saving extracted fields.
- Add provider adapters/interfaces for future approved LinkedIn and Indeed partner credentials, disabled until real partner access is supplied.
- Show source, original URL, discovered time, last verified time, and availability state on every role.

## 2. Replace the eight sample roles
- Remove the eight exact seeded demo rows without deleting user-added roles or user activity.
- Use the connected web-discovery service to find and extract current public vacancies matching each user’s saved titles and locations.
- Prefer employer-owned career pages and public ATS feeds; use job-board alert links only as entry points.
- Validate title, employer, location, description, requirements, canonical URL, and posting status before insertion. Never invent fields a page does not expose.
- Deduplicate by canonical URL plus normalized employer/title/location, retain source provenance, and mark expired or inaccessible jobs instead of silently keeping them active.
- Run a bounded initial discovery so Role Radar receives verified live roles; later runs refresh the catalog rather than reseeding fixtures.
- Keep deterministic scoring and sponsor matching unchanged, but calculate them only after extraction validation succeeds.

## 3. Gmail as an end-user feature
- Finish the existing popup callback flow: validate origin, popup, connector, success/error, and one-time code; exchange and encrypt the mailbox connection on the server before showing **Connected**.
- Maintain read-only Gmail scope. Nexus will not send, delete, archive, or mark messages read.
- Register Gmail `watch` after consent and persist the mailbox email, Gmail history cursor, watch expiry, sync status, and last successful sync.
- Add a verified Google notification endpoint. Notifications enqueue a bounded, idempotent mailbox sync rather than processing the mailbox directly in the callback.
- Renew Gmail watches before expiry and run a low-frequency reconciliation check for missed notifications. If a history cursor expires, perform a bounded recovery scan and establish a new cursor.
- Use Gmail history changes after the first sync instead of repeatedly searching the last 30 days.
- Improve matching using normalized company, job title/reference, sender domain, thread context, and application timing. Ambiguous messages go to an **Unmatched recruitment mail** review queue and never move a card automatically.
- For high-confidence matches, store a safe message summary, classify the event, update the Kanban stage/next action, and record the reason in the activity timeline. Preserve idempotency by Gmail message ID.
- Add visible Connected, Syncing, Reconnect needed, Last checked, Check now, and Disconnect states. Keep **Paste an email** as a fallback.

## 4. LinkedIn, Indeed, and Workday user experience
- Explain source behavior in one sentence per source:
  - LinkedIn/Indeed: users create job alerts there; Nexus reads those alerts from their connected mailbox and imports the linked roles.
  - Workday: Nexus follows public employer career pages and saved Workday links.
  - Direct link: users paste any public posting for immediate extraction and review.
- Parse LinkedIn and Indeed alert emails into candidate jobs, then validate each destination before it reaches the inbox.
- Group source settings by status and provide actionable errors for blocked, private, expired, consent-required, and reconnect cases.
- Keep the future partner-API track isolated behind adapters so approved commercial access can replace an adapter without redesigning the workflow.

## 5. Full UK Home Office sponsor register
- Import the official **Register of Worker and Temporary Worker licensed sponsors** CSV from the stable GOV.UK publication page, not from a hardcoded dated asset URL.
- Replace the 32 starter rows with the complete current snapshot while preserving multiple licence routes per organisation.
- Add snapshot metadata: official source URL, source update date, imported time, checksum, row count, and import status.
- Validate expected headers and plausible row counts before an atomic snapshot swap; retain the last successful snapshot if an upstream download or schema check fails.
- Refresh when the official attachment changes, using a bounded scheduled job and idempotent checksum detection.
- Keep indexed normalized/fuzzy matching, but remove hard-coded company aliases where full-register matching can resolve the name. Preserve explicit aliases only when independently justified.
- Upgrade the lookup page with organisation, town/city, county, worker route, rating, match confidence, and **Home Office data updated** date, plus official attribution and source link.
- Distinguish **licensed sponsor match** from **this vacancy offers sponsorship**; never claim the latter from register membership alone.

## 6. Data and safety changes
- Extend jobs with canonical URL, external reference, source provider, source record ID, verification timestamp, lifecycle status, and extraction provenance.
- Add per-user discovery subscriptions and cursors; add Gmail watch/history state and unmatched-mail review records.
- Add sponsor snapshot/import metadata and a uniqueness strategy covering organisation, location, licence type, and route.
- Keep all mailbox handles encrypted and server-only. Keep user discovery decisions, mailbox summaries, and application events owner-scoped.
- Secure notification and scheduled endpoints with server-only verification, database leases, bounded batches, deduplication, retry backoff, and persistent pause/error states.
- Cap outbound work to the platform concurrency limit and never launch unbounded per-job or per-message requests.

## 7. Delivery sequence
1. **Schema and cleanup:** add production provenance/status fields and sync state; remove only the exact eight demo jobs and 32 sponsor seed rows after replacement data is ready.
2. **Sponsor import:** ingest and verify the latest official full register, then upgrade lookup/freshness presentation.
3. **Discovery pipeline:** public employer/ATS/Workday discovery, extraction review, canonical deduplication, expiry checks, and initial real-role population.
4. **Alert ingestion:** parse LinkedIn and Indeed Gmail alerts into verified candidate jobs.
5. **Gmail push:** finish callback hardening, history-based sync, notification endpoint, watch renewal, reconciliation, matching confidence, and unmatched review.
6. **Source experience:** present clear end-user setup/status/actions and retain adapter points for later partner APIs.
7. **Verification:** test with a real connected Gmail account, real alert emails, public LinkedIn/Indeed/Workday links, duplicate and expired links, reconnect flow, ambiguous employer matches, Kanban movement, and sponsor names from the full register on desktop and mobile.

## External prerequisites
- Google Cloud must have Gmail API and Pub/Sub enabled, with a topic that permits Gmail to publish and a push subscription targeting the app’s verified notification endpoint. The endpoint will be built before the exact callback URL is requested.
- The Google OAuth app must continue allowing `https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`.
- Direct LinkedIn/Indeed partner adapters remain disabled unless those providers approve the product and issue the required commercial credentials. The compliant discovery path does not wait for that approval.

## Acceptance criteria
- A new user sees no fabricated sample roles; after setting preferences or receiving alerts, verified current roles populate the Discovery Inbox with provenance.
- LinkedIn/Indeed alerts and valid public Workday/employer postings create deduplicated role records automatically.
- A connected Gmail mailbox receives near-real-time recruitment updates; a high-confidence match moves the correct Kanban card once, while ambiguity requires review.
- Sponsor lookup searches the complete current official register and displays its snapshot date and source.
- Failure, reconnect, expired-link, upstream-change, duplicate, and partial-sync paths are visible and recoverable without exposing credentials or inventing data.
