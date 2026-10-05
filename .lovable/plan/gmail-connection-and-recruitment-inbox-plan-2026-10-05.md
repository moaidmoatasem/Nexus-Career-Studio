# Gmail Connection and Recruitment Inbox Plan

## What is configured now

- The workspace Gmail OAuth client is linked to this project and supports persistent access.
- This completes the administrator setup, but it does **not** connect an app user's mailbox by itself.
- The current app can classify a recruiter email only when the user pastes it manually. It does not yet read Gmail.

## What Gmail will do in Nexus

Each signed-in user will connect their own Gmail account. Nexus will then:

1. Read a narrow set of recent job-search emails using read-only access.
2. Identify application acknowledgements, screening requests, interview invitations, offers, rejections, and action-required messages.
3. Match messages to the user's existing applications.
4. Update the application stage and next action, while recording why it changed.
5. Surface urgent responses and interview links in Today and Applications.

Nexus will not send email, delete messages, mark messages read, or expose mailbox credentials.

## Make setup easy for users

- Add a single **Connect Gmail** control in the existing Email alerts source card.
- Open Google's consent in a popup and return the user directly to Nexus.
- Replace configuration terminology with three clear states: **Connect Gmail**, **Connected · last checked…**, and **Reconnect needed**.
- After connection, show **Check inbox now** and **Disconnect** actions.
- Keep the existing paste-email tool as a fallback.
- Explain the read-only boundary beside the connect action in one short sentence.

## Implementation

1. Add the secure Gmail connection flow: OAuth callback, one-time code exchange, encrypted per-user connection storage, reconnect, and disconnect.
2. Request only Google profile and Gmail read-only permissions.
3. Add a server-side sync that searches a bounded recent window for recruitment-related messages and retrieves only needed message details.
4. Reuse the existing classifier, but prevent duplicate processing and log each matched update in application history.
5. Update the source status and timestamps after every sync; preserve actionable errors without exposing provider details.
6. Add Gmail controls and sync results to Discover, plus Gmail-derived actions to Today and Applications.
7. Verify first connection, reconnect, disconnect, no-match, duplicate-message, revoked-access, and successful application-stage updates with a signed-in account.

## One remaining Google setting

The Google OAuth application must allow this redirect URI exactly:

`https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback`

Once that is present, users should not need to see or manage any connector settings; they only click **Connect Gmail** inside Nexus.
