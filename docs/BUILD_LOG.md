# Build and presentation log

## Scope agreed with the organiser

- Event: **AI pilled**.
- Next.js in Boltzbit, deployed to Vercel; Supabase storage and anonymous sessions; OpenAI interpretation.
- Needs and offers matched independently, not reciprocal or exclusive pairs.
- No blocking and no selfies in this version, per organiser feedback.
- No keyword/topic fallback if AI fails.
- Fictional rehearsal data kept separate from live participation.

## Concise examples you can show

### Initial request (excerpt from the actual request)

> “People who might help them” and “People they might be able to help.”
> “These are independent recommendations. Do not require reciprocal matching or assign exclusive pairs.”

Explain: describing the intended behaviour matters more than listing screens. It changed the data and ranking design.

### Imperfect proposal and useful correction (real exchange)

Initial proposal: structured topics without embeddings, plus a conservative keyword/topic fallback when AI failed.

Organiser correction:
> “I would prefer there not to be conservative topic fallback … when you start matching people wrongly, that will just feel broken.”

Result: no keyword fallback. AI-processing failures and genuinely empty recommendation lists have different messages. Cached embeddings were added to find paraphrases while retaining answer-based explanations.

Do not present this as an observed bad live match: it was a design correction before live matching was tested.

### Another real correction

> “For testing data you will need some more complex examples so it's not always easy.”

Result: negative and ambiguous cases include learning versus offering, React versus pandas, mobile-store versus web deployment, broad offers, prompt-injection text, different wording, and unmatched needs. Human-labelled fixtures test ranking mechanics, not live-model accuracy.

## Milestone 1 — complete local rehearsal and live-service implementation

Built: mobile onboarding, recognition descriptions, two-way introductions, profiles, room search, inbox, suggested first message, send/retry feedback, unread receipts and profile editing. Local rehearsal data/messages are visibly fictional and stay in this browser. Live code uses authenticated Supabase requests and row-level permissions.

Decision for organiser: apply database setup in the dedicated Supabase project, supply server-only credentials through environment controls, then verify live behaviour before sharing with attendees.

Checks run: final Next.js production build and strict TypeScript checks passed. All 12 matching/PostgreSQL tests and all 8 browser tests (4 mobile, 4 desktop) passed. Production dependency audit reported zero vulnerabilities. Supabase's public auth settings endpoint was checked: anonymous sign-ins are enabled. Live database/AI integration and physical-device checks are still pending organiser setup.

Real issues encountered:
- GitHub device authorisation expired before GitHub confirmed it. A later browser login succeeded as `jawciu`, and the organiser approved pushing the first milestone to the public repository while preserving its initial commit.
- A delegated task could not start due to a tool quota error; implementation continued directly. No output from that failed delegation was used.
- Browser tests initially could not launch Chromium because the workspace lacked Linux libraries. Resolved using workspace-local library downloads rather than changing system configuration. Ubuntu's package names differed and one cached package URL returned 404; selecting the available base package resolved installation.
- A temporary preview process expired midway through a browser run. The tests were rerun with Playwright owning the server lifecycle.
- A mobile test chose desktop navigation before hydration after refresh. Corrected the test to use the known viewport and wait for the relevant navigation to be visible. All eight browser checks passed after this fix.
- Visual inspection found a missing space in the mobile introduction note. Added explicit spacing and increased card/message type sizes. The final browser suite and production build passed after those changes.

## Milestone 2 — real-service verification and draft fixes

Deployment checked: https://ai-pilled-demo.vercel.app. The organiser created an isolated `ai-pilled-test-2026` event. Five profiles named `[TEST] Avery`, `[TEST] Blake`, `[TEST] Cameron`, `[TEST] Devon` and `[TEST] Ellis` are fictional test participants, not attendees. Their anonymous sessions and test artifacts stay in ignored `.tmp/live/`; they are never committed.

Actual real-service checks passed:
- Mobile onboarding and real OpenAI structured interpretation/embeddings succeeded and were cached.
- No matches before a complementary helper arrived; the new helper appeared without a manual refresh.
- Independent directions formed a three-person help cycle, without reciprocal or exclusive pairing.
- React debugging did not match pandas debugging; App Store deployment did not match Vercel deployment.
- An instruction-injection answer did not gain ranking; generic willingness and learning deployment did not become an offer.
- Real messages, replies, unread indicators and refresh persistence worked across independent browser sessions.
- A third authenticated participant could not read the other pair's conversation, messages or inbox preview, send into it, or mark it read.
- Concurrent duplicate sends returned one stored message; blank and oversized messages were rejected by the live database.
- An intercepted network failure showed retry; reconnecting delivered exactly one message.
- Recognition-only edits preserved cached analysis; cached reloads produced no browser AI requests in the integration run.
- Editing an answer incremented its version and cleared stale interpretation. A browser-simulated AI outage showed an explicit error with no fallback recommendations. Retrying against real AI recovered and cached the new version.
- The test participant could not read the real meetup's event row.

Two actual UI bugs were observed on the initial deployment:
1. The suggested opening question was sometimes cleared when opening a conversation. The active-conversation effect raced a timed draft assignment. Fixed by setting the draft explicitly when opening a profile conversation, and clearing it only on deliberate navigation.
2. A successfully retried message remained in the composer, making an accidental second send possible. Fixed by clearing the matching sent draft on successful retry while preserving any different text the user has typed.

Both fixes passed the integration run using the locally built app connected to the real Supabase test event. All 12 matching/database tests, all 10 mobile/desktop browser tests (including a new repeated-conversation regression), the production build and TypeScript checks passed. The deployed fixes still need a reviewed GitHub push and a post-deployment rerun before claiming the production bugs are resolved.

A separate test assertion initially looked for an exact error string in an element that also contained a retry button; corrected the locator to check the displayed error container. This was a test-selector correction, not a product fix.

Still required: two physical-device checks, event Wi-Fi sign-in-limit review, privacy/retention decisions and final QR verification. Automated Chromium mobile emulation is not a physical phone test.

## Suggested six-minute demonstration

- **0:00–0:40:** the room's problem; show the initial request and independent directions.
- **0:40–1:30:** scan a staging QR link; join with a real short need and offer. Explain profile visibility and the browser-session limitation.
- **1:30–2:30:** show both recommendation groups and their actual answer excerpts. No scores, no exclusive pairs.
- **2:30–3:30:** start a conversation; reply from a second device/browser. Show unread and refresh persistence.
- **3:30–4:30:** show the fallback-design correction and one hard negative test case. Do not claim fictional fixture output came from live AI.
- **4:30–5:30:** show readable source, database permissions and a reviewed GitHub milestone. Never show environment secrets.
- **5:30–6:00:** show the verified production Vercel URL/QR and invite participation.

Use this script only after the live two-device flow is checked. Keep the labelled rehearsal available as a fallback presentation, not disguised as a live working integration.
