# AI pilled

A mobile-first meetup companion: share what you need, share what you can offer, find useful introductions and send private one-to-one messages.

## Current milestone

- Next.js app with mobile and desktop layouts.
- `/demo`: fictional rehearsal profiles and browser-local messages. Fixtures are explicitly human-labelled, NOT live AI output. A simulated reply button is explicitly labelled. Custom rehearsal answers produce no matches unless they are an exact fixture; there is no keyword fallback.
- `/qr`: responsive attendee QR display for the left pane of a presentation split screen. Links to the real attendee event.
- `/demo?presenter=1`: blank presenter setup on every opening/reload, with no sample-fill button. Presenter state stays in memory; existing rehearsal storage is preserved.
- `/e/<event-slug>`: Supabase-backed live flow, requiring the database setup below. Anyone with the event link can browse public profile cards before joining. Personal recommendations and messages require a joined participant session.
- Cached server-side OpenAI structured extraction and answer-to-answer relevance checks; independent directional matching. No percentages, assigned pairs, selfies or blocking.
- Database-owned conversation uniqueness, retry-safe messages, unread receipts and rate limits.
- Realtime message/profile updates with staggered 5–7-second polling recovery. Only visible, online tabs poll; reconnecting or returning to the app refreshes immediately.

## Local development

Node 22+ and npm. `npm install`, then `npm run dev`. Open http://localhost:3000.

The public Supabase URL and publishable key supplied by the organiser are configured in the ignored `.env.local`. `.env.example` documents all variables. Public keys are not authentication secrets; database permissions are essential.

Server-only variables: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`. Set these through a trusted environment-file editor or Vercel's environment-variable UI, not chat. Never prefix them with `NEXT_PUBLIC_`, commit them, or include them in a project export. The service role is used ONLY to write verified AI interpretations and leased relevance-check results; message reads and writes always use the participant's authenticated access and database permissions.

## Supabase setup (organiser action)

1. Use a dedicated Supabase project; enable Anonymous Sign-Ins under Authentication.
2. Open SQL Editor → New query. Paste `supabase/setup.sql`, inspect it, then Run. Next run `supabase/migrations/002_cached_match_reviews.sql`, then `supabase/migrations/003_event_review_workers.sql`. For an existing project that already ran setup, run the migrations not yet applied, in order. It adds a cache and bounded worker-claim functions; it does not delete profiles or messages or weaken conversation permissions.
3. The seed event URL is `/e/ai-pilled-room-84e2c9b7`. Before real use, choose a new hard-to-guess slug by editing the seed SQL before first execution, or updating the row in Table Editor → events. Do not change it after printing the QR code. A shared event URL is an entry link, NOT authentication to anyone's private conversations.
4. Project Settings → API Keys: add the server-only legacy `service_role` key to Vercel as `SUPABASE_SERVICE_ROLE_KEY`. This project also supports Supabase's server secret key in that variable; never use the publishable key in its place. Do not paste either secret into chat.
5. Verify messages and participants appear under Database → Publications → supabase_realtime. SQL enables them when that publication exists.
6. Review Authentication rate limits with the event in mind: 60–80 guests may use one Wi-Fi IP. Default anonymous sign-in IP limits can reject a busy room. Raise the appropriate limit for rehearsal/event demand without removing protections entirely. Review Supabase's current anonymous-auth anti-abuse guidance. CAPTCHA is not wired in this milestone; enabling mandatory CAPTCHA without implementing its token flow will prevent joining. Keep the live link limited to attendees and monitor usage. This is a launch-readiness item, not a claim of bot-proof protection.

Never grant all authenticated users unrestricted messages access. Anonymous participants have the `authenticated` role but different `auth.uid()` values. RLS checks membership. A publicly visible participant ID alone grants nothing.

## AI behaviour

Only the two profile answers are sent to OpenAI, as JSON data separated from fixed system instructions. Names, recognition descriptions and messages are not sent. Structured output is validated; evidence must be a verbatim substring of the corresponding answer. AI failures do not trigger keyword matching.

Structured interpretations are cached in Postgres per answer version and extraction-pipeline revision. Changing either answer atomically clears the interpretation and increments its version. Old pipeline output is refreshed on the participant's next visit. A compare-and-set write rejects stale AI results. One extraction attempt per participant per minute is enforced by a database claim; API timeouts are bounded. Transient extraction failures retry automatically up to three total attempts per answer version, respecting Retry-After or waiting 60 seconds, with up to ten extra seconds of jitter to spread retries. Offline attempts pause until reconnection. A manual retry remains available after that. Name/recognition edits preserve analysis.

Live introductions require an AI check of the actual directed need and offer, including exact-topic candidates. Only offers supporting the actual requested task are accepted; speculative adjacent help is excluded. Compound topics may belong to several families. Known disjoint task families (for example translation versus user research, or visual feedback versus CSS implementation) cannot be promoted by a model verdict; unknown topics still get an AI check rather than a keyword fallback. The check must return exact supporting excerpts and a short opening question. Topics identify non-empty supported needs/offers but no similarity cutoff silently discards their paraphrases. The previous topic/embedding matcher is retained ONLY for the explicitly labelled local demo and historical regression tests. No internal ranking value is displayed as a compatibility percentage. It needs evaluation on real model outputs; passing human-labelled fixture tests does not validate model quality. Different tools, negations, broad offers, prompt injection and learning-versus-offering cases are in the rehearsal set. A false positive can still occur, so explanations quote both answers for human judgement.

For a 60–80-person event, all non-empty need/offer pairs involving a visiting participant are eligible, checked in batches of at most eight. Decisions—including rejections—are shared in Supabase and keyed by BOTH answer versions plus the review revision. Revision 3 ranks full task coverage before partial coverage, using validated AI output, with names only breaking ties. An event-wide limit of eight active batches and one per claiming participant bounds concurrency. Private worker demand gives waiting browsers a fair turn without updating realtime profiles. A 90-second database lease prevents duplicate work across tabs or the two participants; failed batches back off for a minute. Cached decisions are read on page refresh, not regenerated. The browser drives subsequent batches while open, so introductions appear progressively and no closed-browser background processing is promised. New extraction no longer generates unused embeddings. Existing vectors may remain in old cache records but do not decide live matches. Messages never affect matching.

## Deploy to Vercel (after local verification)

1. Connect authorised GitHub access in the workspace and push a reviewed milestone to `https://github.com/jawciu/ai-pilled-demo`.
2. Vercel → Add New → Project → import that repository. Framework: Next.js. Standard install/build settings; no custom filesystem persistence.
3. Settings → Environment Variables: add all variables in `.env.example`. The two `NEXT_PUBLIC_` values are browser-safe. `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` are server-only secrets. `OPENAI_EMBEDDING_MODEL` is a legacy variable and is no longer used by the repaired live pipeline.
4. Deploy/redeploy after variables are set. Anonymous auth does not need an OAuth callback; set Supabase's Site URL to the production app URL for consistency.
5. Verify the live event URL using the checklist in `docs/VERIFICATION.md` before sharing it. Generate a QR code for the exact production `/e/<slug>` link, not `/demo` or the landing page.

No application backend is deployed to BoltzHub; Vercel hosts the Next.js server routes. Supabase stores profiles/messages persistently. No Vercel local files are used for attendee data.

## Checks

- `npm test`: deterministic matching fixtures and SQL executed against embedded PostgreSQL (PGlite), with independent participant identities and RLS.
- `npm run test:e2e`: Chromium mobile emulation and desktop rehearsal UI. This is NOT proof of a successful real-device or deployed Supabase session.
- `npm run typecheck` and `npm run build`.
- `npx tsx scripts/evaluate-matching.ts`: paid real-service evaluation in the isolated test event only; reuses ignored `.tmp/scenarios/` anonymous sessions and writes `.tmp/scenarios/repaired-results.json`. Keeps the original 24 checks separate from held-out cases and discovered regressions. Requires the new migration and deployed pipeline; don't run against the old deployment and call it a repair result.
- Live integration checks remain required after Supabase and OpenAI are configured.

See `docs/EVENT_READINESS_REVIEW.md` for the revision-3 migration/deployment sequence and the limits of the 80-person local scheduler test.

See `docs/BUILD_LOG.md` for real presentation notes and `docs/VERIFICATION.md` for remaining release gates.

## Privacy and operations

No photos, attachments, location, group chat, push notifications, imported registrations or private social profiles. No email/password recovery. A browser's Supabase refresh token maintains access; clearing it loses automatic access. Use a fresh private window for a separate participant during tests.

Before launch, decide and disclose an event-data retention period, organiser contact and deletion process. Do not retain meetup messages indefinitely by accident. Session tokens are accessible to the browser SDK, so avoid third-party scripts; user text is rendered as escaped text, never HTML. Events are access-scoped, not an organiser dashboard. A participant identity joins one event; use separate browser contexts for separate live events.

Messages display the latest 100 entries in an open thread; older entries remain in the database. Inbox previews and unread counts are calculated across persisted messages server-side. Failed sends keep their idempotency key for retry while the page remains open; confirmed sends persist across refresh. Unsent drafts/failed payloads are not persisted across closing the page in this version.
