## Active work

- **Task:** Made profile navigation consistent across mobile, desktop, attendee and presenter views.
- **Authorisation:** Caroline explicitly approved commit/push, Supabase migration and parallel agents on 24 November. No external messaging authorised.
- **Checkout:** `codex/matching-event-readiness`, base `a5439af`; remote main confirmed unchanged immediately before release preparation.
- **Changes:** Existing revision-3 matching unchanged. Added jitter, offline retry pause/resume, read/AI timeouts and background-error recovery. Restored pilled font; removed header label, sidebar slogan and requested form disclosure/checkbox/footer; opened guest Room browsing/search/profile viewing via event-scoped public API; messaging still requires joining; centred desktop content within right-hand pane.
- **Database:** Migration003 applied to `tzndmqndeskxinqnyouv`; new functions/table visibly confirmed. Existing profile/message data preserved. Anonymous sign-in limit 150/hour/IP verified, unchanged.
- **Live tests:** Separate fictional event `ai-pilled-test-codex-2026-11-24`. Messaging/access/idempotency/persistence checks pass; no attendee fixture pollution.
- **Release:** Implementation commit `df984a3` pushed to main; Vercel success. Published 390px mobile layout verified. Fresh live evaluation 24 profiles/43 checks all pass, no provider errors, 171.152s total. Read-only check validates 48 sorted lists (37 full/13 partial accepted pairs). Cached request 1.273s. Live realtime delivery also passes.
- **Presenter:** `/demo?presenter=1` starts empty on every opening/reload, hides the sample-fill button, and keeps its demo state in memory. Ordinary `/demo` still restores its saved rehearsal; real attendee data is unchanged. Four desktop/mobile tests verify blank start, manual setup, reload, saved-rehearsal preservation and existing messaging flow. Production build passes. The top rehearsal banner and sidebar “Fictional rehearsal room” label are removed. Desktop/mobile presenter checks and build pass; no migration needed. Actual venue Wi-Fi and full 80-person live-provider load remain unverified.
- **Local verification:** 80-person simulation all 6320 directed pairs, worker cap 8, all first turns by wave 9, sparse useful pairs by wave 4; provider completions simulated. Browser tests require full Chromium via `../review-playwright.config.ts` (native headless-shell failed locally).
- **Deliverables:** Revised five-minute script (296 spoken words) in parent `outputs/ai-pilled-five-minute-script.txt`; attendee and original test-room QR PNGs are copied to outputs with distinct names. Use a separate browser/private session to join the test event; browsing needs no profile.
- **Limits:** Actual venue Wi-Fi/attendee phones and full 80-person live-provider latency not tested. Review `EVENT_READINESS_REVIEW.md` for detailed evidence.

- **QR display:** `/qr` uses the existing verified attendee QR, with a scoped dark-green layout matching the brand. Decoded target is the real attendee room. Visually checked 480×900 and confirmed no overflow at 320×568; production build passed. No new service, dependency or migration.

- **Branding:** Original `pill-ink.svg` and `pill-paper.svg` from `https://ai-pilled.co/assets/logo/` are stored in `public/brand/`, shared across landing, meetup and QR pages. Wordmark uses the site’s JetBrains Mono 800 styling. Four desktop/mobile presenter/navigation checks and production build pass.

- **Demo examples:** Removed sewing, fashion-contract and prompt-injection examples from the displayed demo profiles. Alex now asks about API keys, Sam about clearer AI coding prompts, and Casey about Supabase persistence. Matching topic evidence updated alongside answers; 17 matching checks and production build pass. Real attendee profiles and private evaluation fixtures are unchanged.

- **Navigation label:** Use “My profile” everywhere, including the mobile navigation and recommendation empty-state guidance. Four desktop/mobile navigation checks and production build pass.
