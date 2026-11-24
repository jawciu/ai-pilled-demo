# Matching and event readiness follow-up

Reviewed BoltzAgent commit `a5439af5b5ff6864289481aa6b54367a1adc41a6` on 24 November 2026. Its report records 43/43 real-service scenario checks, most using cached decisions. Those are BoltzAgent's results, not a fresh independent model run. The report correctly leaves physical-device, shared-Wi-Fi and 80-person load validation open.

## Implementation

- Compound topic labels can belong to several task families. `pandas-automation` can now be considered for `spreadsheet-automation`. Eligibility does not create a match: actual-answer review and verbatim evidence are still required.
- The ordinary verb “fix” no longer turns a readability question into a programming request. Explicit CSS/code/debugging constraints still prevent the visual-only shortcut.
- Review revision 3 asks for categorical task coverage: full or partial. Whole-task support ranks ahead of partial support; names only break ties within that group. This is a limited relevance ordering, not a universal best-person score. No percentage is displayed.
- Database-backed scheduling allows at most eight active revision-3 batches per event and one per claiming participant, across tabs/server instances. A batch contains at most eight directed pairs. Shared 90-second leases recover abandoned work; failed requests retain their one-minute backoff.
- A private RLS-protected table records worker demand and fair admission without updating realtime participant rows. Both introduction directions get initial work. Exact-topic candidates are prioritised but all eligible paraphrases remain reachable. Existing checked pairs are reused.
- Batch lease IDs are not decision IDs: server results are mapped by directed participant pair so a shared worker lease cannot mix people's results.
- Revision 2 decisions are preserved for rollback. Revision 3 uses a separate cache revision and additive RPC functions. New decisions require the coverage field; old unranked decisions are not silently relabelled.

## Verification and release, 24 November 2026

Migration 003 was applied to Supabase project `tzndmqndeskxinqnyouv` through its signed-in SQL editor. The transaction adds a nullable worker column, private scheduling table, index and two revision-3 RPC functions. The editor confirmed both functions and the table exist. Revision-2 functions remain available; no profiles/messages were changed by the migration.

The local 80-person embedded-Postgres simulation completed all 6,320 directed pairs in 99 batch-completion waves. Every participant received a first worker turn by wave 9. In a sparse fixture with one useful helper per person, all useful pairs reached review by wave 4. The test verifies eight-worker capacity, duplicate tabs, lease recovery, fair admission, cache reuse, scoped access and zero participant updates from scheduling. Provider completions are simulated: these figures are not live AI latency or a production load benchmark.

Live messaging checks passed in a separate fictional event, `ai-pilled-test-codex-2026-11-24`: anonymous join, conversation uniqueness, send/reply, live realtime delivery, retry idempotency, unread/read receipts, persistence through a new client, outsider read/send/receipt/inbox denial and empty-message rejection. No fixture was added to the attendee event.

The Supabase dashboard showed anonymous sign-in capacity of 150 per hour per IP. This setting was inspected, not changed. Physical venue Wi-Fi and actual attendee phones remain untested.

All 45 logic/database tests (42 existing/current plus 3 focused retry tests), 18 desktop/mobile browser checks, TypeScript and production build passed. Fresh real-model results are recorded below.

## Presentation and mobile

Navigation is visible before joining; new and returning visitors land on You. Unsaved answers survive tab changes. Other tabs explain how to add details first. Saving opens For you. Requested headings and brand clutter were removed, with the established desktop layout retained. The five-minute script has approximately 262 spoken words and about two minutes for audience participation.

## Practical limits

At full occupancy, 6,320 pairs require at least 790 eight-pair batches if every pair needs AI. Eight workers imply roughly 99 waves before polling/failures/provider limits. At an illustrative five seconds per batch, checking the entire cold room could exceed eight minutes. Useful introductions can appear much sooner; completing every check during a five-minute presentation is not guaranteed. The room and private messaging remain available while AI checks run.

Task-family guards remain conservative heuristics and the AI reviewer can still make mistakes. Browser-driven processing requires open clients. Initial interpretation has bounded retry for transient provider errors; it is not governed by the pair-review concurrency cap. Keep the genuine organiser profile ready, show the attendee QR, and let people browse The room while introductions are checked.

## Release outcome

Implementation commit `df984a3` was pushed to main and Vercel reported a successful production deployment. The published mobile layout was visually checked at 390×844: You is selected and navigation is present before profile entry.

Fresh live evaluation processed 24 fictional profiles and passed all 43 checks: 24 original, 10 held-out, 2 discovered regressions and 7 fresh-verification cases. No missed expected match, false positive, unverified case, directional inconsistency or provider error occurred in this set. French offers and opening-question limits passed. The suite completed in 171,152ms with 64 newly processed review batches at concurrency 4. This is an independent fresh run, not reused BoltzAgent results.

The harness prepares all profiles before reviewing, unlike normal browsers. It first observed useful introductions 52–162 seconds after suite start (38–161 seconds after the corresponding fixture joined). Those are harness observations, not an attendee latency promise. A later cached recommendation request completed in 1,273ms, with no pending checks.

An additional read-only check compared all 48 directional recommendation lists to their stored coverage decisions: all were ordered correctly, with 37 full and 13 partial accepted directed pairs across the room. The 43 labelled scenarios cover selected acceptance/rejection cases; this does not manually validate every unlabelled pair.

Live messaging/realtime checks and full/partial ordering checks passed against this production Supabase project using only the isolated test event. No live 80-person provider load or venue/device test was claimed.

Attendee link: https://ai-pilled-demo.vercel.app/e/ai-pilled-room-84e2c9b7 . The existing attendee PNG QR was decoded and confirmed to contain this exact URL. The final script deliberately leaves time for joining and browsing; The room is available while introductions are processed.


## Follow-up: connection recovery and presentation cleanup

Additional client safeguards stagger polling (5–7 seconds) and retries (server/default delay plus 0–10 seconds), pause offline extraction without consuming retry attempts, and refresh when the phone reconnects or the page becomes visible. Read requests have 15-second deadlines and AI requests 75-second deadlines so dropped connections release the browser’s in-flight guards. Successful background recovery clears its own error without hiding a failed profile edit. Recommendation fetch failures continue to clear results, avoiding stale introductions after edited answers.

These changes do not add an initial-extraction concurrency cap or guarantee provider/venue availability. The existing eight-worker pair-review cap and database leases remain. The matching algorithm and prompts are unchanged from the 43/43 fresh live evaluation.

The original pilled font is restored. The header room label, sidebar slogan and requested form notice/checkbox/browser note are removed. No database consent record existed or was changed; that checkbox was a local form gate. Anyone with an event link can now browse/search that room and open profiles before joining. For you explains where personal recommendations will appear; Inbox keeps its join button. A guest choosing to message is directed to You, preserving their draft profile. Desktop sections now share a centred container inside the right-hand pane, with left-aligned text/fields; mobile width remains unchanged. The original test QR still targets `/e/ai-pilled-test-2026`.


Guest reads use `/api/room?slug=...` with an exact event lookup and explicit profile-field allowlist. There are no new database permissions or migrations. The response excludes conversations, receipts, authentication data and AI analysis; messages still require a joined session. Unknown events return 404, invalid links 400, and error responses do not expose database details. The script now has 296 spoken words, including planning, database/AI/deployment configuration, design iteration and evaluation with fictional profiles; the real event uses attendees’ answers.

Follow-up validation: all 52 logic/database tests, 30 desktop/mobile browser tests, TypeScript and production build passed. This includes guest browsing before signup, room scope, preserved drafts, stable cards during background refresh, desktop centring, timeouts and reconnection. Implementation commit `a3c6302` was pushed to main and Vercel confirmed deployment. Live unauthenticated guest reads passed for two separate test events (27 and 32 profiles): exact field allowlist, no AI analysis, no cross-event IDs. Missing slug returned 400, unknown event 404 and unauthenticated private recommendation/review routes 401. Browser inspection confirmed guest cards, profile viewing, messaging redirect to You and the centred desktop form.
