# Release verification

## Automated evidence at this milestone

Use actual command output, not this checklist, as the source of test pass/fail counts.

- Matching unit fixtures: independent directions; multiple helpers; no exclusive pairing; learning is not expertise; React is not pandas; mobile-store deployment is not Vercel; no match/new arrival; stale versions; other events; verbatim explanations; no fallback; generic offers; semantic paraphrases; validation.
- Embedded PostgreSQL: actual setup SQL is executed with mocked Supabase auth functions and independent UUID identities. Checks event isolation, owner-only editing, no participant cache tampering, unique pair, duplicate-send idempotency, empty-message rejection, message/inbox privacy, read receipts, replies, analysis throttling and edit invalidation.
- Browser tests: rehearsal onboarding, two recommendation groups, profile modal, suggested message, send, explicitly simulated reply, refresh persistence, name edit, mobile width and isolated browser storage.

These do NOT prove real OpenAI extraction quality, Supabase Realtime delivery or a production Vercel deployment. Embedded PostgreSQL mocks token identity, not Supabase's token-validation service. Browser tests use Chromium mobile emulation, not a physical iPhone.

## Required live-service check (after organiser setup)

Use a separate staging Supabase project, or create a separate rehearsal event row via SQL Editor before running these tests. Do not seed fictional attendees into the production event.

1. Open the staging event URL in three independent browser contexts: Alice, Bob and Charlie. Do not use three ordinary tabs sharing the same session.
2. Alice: needs React debugging; offers interface design. Bob: offers React debugging; needs spreadsheet automation. Charlie: offers spreadsheet automation; needs interface design. Check Alice→Bob, Charlie→Alice, Bob→Charlie independent directions. Reciprocal matching must not be required.
3. Inspect explanations: each excerpt must appear in the relevant need/offer field. Inspect difficult cases from `src/lib/demo.ts` with real AI output. Confirm learning deployment does not become an offer, React and pandas remain distinct, finance is not expertise, broad happy-to-help remains unsupported and embedded prompt instructions are ignored.
4. Join with an unsupported need. Confirm no matches rather than approximate inventions. Add a relevant helper in a separate session and confirm recommendations update without reload after analysis completes.
5. Edit an answer; ensure stale recommendations disappear, cached analysis is regenerated once and the new version appears. Name-only edits should not call OpenAI.
6. Alice starts a conversation with Bob from a recommendation. Bob replies. Confirm each side updates within a few seconds, inbox previews change and unread appears when the recipient is outside that thread. Opening the thread clears unread.
7. Refresh both sessions and close/reopen the same browser. Confirm profiles, conversation and messages persist. Confirm duplicate starts create the same conversation. A double click or retry must not insert duplicate messages.
8. Use browser network controls to fail a send. Confirm Failed and Retry appear, then reconnect and retry. Validate a server-accepted/client-timeout retry using the same client_id. Empty and >2,000-character messages must fail server-side even if bypassing the UI.
9. Charlie attempts to read Alice/Bob's conversation and messages by known conversation ID using Charlie's authenticated Supabase client. Both selects must return no rows; send_message and mark_read must fail. get_inbox must not leak previews. A publishable key without a session must not read any private rows.
10. Check a second event: no cross-event profiles or conversations. An invalid event link must not join an event.
11. Disable/omit the AI key in staging. Confirm an explicit processing/configuration error, no keyword fallback, profile/messaging still usable, and no stale matches after an answer change. Restore the key and retry after the one-minute throttle.
12. Inspect browser JavaScript/network data: no OpenAI or service-role key. Participant IDs are visible but never used as authentication credentials.
13. On two physical devices over event Wi-Fi, repeat join/send/reply/refresh. Check keyboard behaviour, text wrapping, button sizes, recognition description, form labels, dialog focus/escape and narrow 320px screens. Check a screen reader if available.
14. Vercel production: repeat the two-device flow on the production hostname. Scan the FINAL event QR link, not the local preview, rehearsal path or a deployment-protected preview URL.
15. Review shared-Wi-Fi anonymous sign-in limits, cost/usage caps, attendee privacy notice, organiser contact and data retention/deletion date. Blocking was explicitly removed from scope by the organiser; it is not an untested feature.

Do not announce launch readiness until the live checks above have been completed and outcomes recorded.
