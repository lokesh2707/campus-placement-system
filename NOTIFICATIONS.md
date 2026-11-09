# In-app notifications

## Recipient matrix

| Event | Recipient | Action |
|---|---|---|
| Application submitted or withdrawn | Active recruiters currently assigned to the application's company | Recruiter dashboard |
| Application status changed | Active student who owns the application; assigned placement officers for `Selected` only | Student applications / officer dashboard |
| Interview scheduled, rescheduled, or cancelled | Active student who owns the application | Student applications |
| Offer issued, revoked, or expired | Active student named by an Offer whose application references match | Student offers |
| Offer accepted, declined | Active recruiters currently assigned to the Offer's company | Recruiter offers |
| Joining outcome updated | Active recruiters currently assigned to the Offer's company | Recruiter offers |

The SUPER_ADMIN role has no business notification type in this phase because no platform-wide event has a clear action for that role. Feedback content is never included in an event or notification. The event actor is excluded. All student/company/application/interview/Offer references are re-read and cross-checked before fanout; recipients are resolved from current active role and tenant assignments.

## Storage and API

`Notification` stores a recipient, source outbox event, fixed event type/title/message, entity reference, server-generated relative path, read timestamp, and timestamps. Indexes support recipient chronological pagination, unread counts, and unique `(recipientUser, sourceEventId)` idempotency.

- `GET /api/notifications?page=1&limit=20&unreadOnly=true`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

All routes require authentication and scope queries to `req.user._id`. Responses use a DTO allowlist. Page size is capped at 50; notifications are sorted newest first. A foreign notification ID returns 404.

## Outbox and worker

Controllers publish minimal events only after successful business writes or compare-and-set transitions. The bounded worker starts after database connection and existing offer recovery during backend startup, processes at most 10 events per poll with a 1.5 second interval, uses the existing atomic claim token and lease, and waits for in-flight work during SIGINT/SIGTERM shutdown. Importing the worker does not start it. `bulkWrite` upserts plus the unique recipient/event index make retried or partially completed fanout idempotent.

The local standalone MongoDB does not provide multi-document transactions. A process can stop after a business write but before publishing its outbox event, so delivery is not transactionally guaranteed. Notifications may be permanently lost if the process exits between the business write and outbox write, if `publishBusinessEvent` returns while Mongoose is disconnected, or if outbox persistence fails. Publisher failures are caught and logged generically; without a persisted outbox row, the processor has nothing to retry. Existing Offer recovery/reconciliation does not generally reconstruct missing notification events. Event handling is at-least-once with idempotent notification creation; it is not exactly-once and notification delivery is not guaranteed.

## Setup and verification

No additional package is required. Start the backend normally; it starts the worker after database startup. Run backend unit/contract tests with `npm --prefix backend test`, Python tests with `ml-service/.venv`'s pytest, frontend tests with `npm --prefix frontend test`, and the production build with `npm --prefix frontend run build`.

The opt-in real MongoDB checks are in `backend/tests/security.mongodb.integration.test.js`. They create a unique `campus_placement_security_test_*` database only after verifying its absence, assert loopback host and exact database identity, and drop only that generated database. They are not enabled by default. Do not set the test base URI to the development database.
