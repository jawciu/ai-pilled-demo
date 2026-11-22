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
- GitHub device authorisation expired before GitHub confirmed it. Restarted browser login; connection must be verified before claiming it succeeded. No pushes have occurred.
- A delegated task could not start due to a tool quota error; implementation continued directly. No output from that failed delegation was used.
- Browser tests initially could not launch Chromium because the workspace lacked Linux libraries. Resolved using workspace-local library downloads rather than changing system configuration. Ubuntu's package names differed and one cached package URL returned 404; selecting the available base package resolved installation.
- A temporary preview process expired midway through a browser run. The tests were rerun with Playwright owning the server lifecycle.
- A mobile test chose desktop navigation before hydration after refresh. Corrected the test to use the known viewport and wait for the relevant navigation to be visible. All eight browser checks passed after this fix.
- Visual inspection found a missing space in the mobile introduction note. Added explicit spacing and increased card/message type sizes. The final browser suite and production build passed after those changes.

## Suggested six-minute demonstration

- **0:00–0:40:** the room's problem; show the initial request and independent directions.
- **0:40–1:30:** scan a staging QR link; join with a real short need and offer. Explain profile visibility and the browser-session limitation.
- **1:30–2:30:** show both recommendation groups and their actual answer excerpts. No scores, no exclusive pairs.
- **2:30–3:30:** start a conversation; reply from a second device/browser. Show unread and refresh persistence.
- **3:30–4:30:** show the fallback-design correction and one hard negative test case. Do not claim fictional fixture output came from live AI.
- **4:30–5:30:** show readable source, database permissions and a reviewed GitHub milestone. Never show environment secrets.
- **5:30–6:00:** show the verified production Vercel URL/QR and invite participation.

Use this script only after the live two-device flow is checked. Keep the labelled rehearsal available as a fallback presentation, not disguised as a live working integration.
