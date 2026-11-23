# AI pilled — launch checklist

## Current milestone

- Production: https://ai-pilled-demo.vercel.app
- Verified deployed app commit: `8a5f3af1156ae27b92e7724221e809a16a0d34a3`.
- Before publication: 22 logic/database tests, 12 mobile/desktop browser tests, TypeScript and production build passed.
- Post-deployment: room ordering, displayed counts and Ian/Caroline visibility were checked from an independent authenticated participant on mobile emulation and desktop. Their actual cached AI outputs were evaluated by the updated matcher and connected in both directions. Neither person's private browser session or messages was accessed.
- Room visibility is independent of recommendations. Recent profiles come first; search can be cleared and resets on navigation.
- A full real-database messaging/privacy regression also passed against the updated local production build: replies, unread indicators, refresh persistence, retries, duplicate-send protection and denial of third-party conversation access.
- Physical-device and meetup-network checks remain outstanding. Do not describe emulation as a physical phone test or a permission test as a full security audit.

## Keep the two rooms separate

**Attendee event**

https://ai-pilled-demo.vercel.app/e/ai-pilled-room-84e2c9b7

Use `AI_pilled_EVENT_QR.png` for attendees, only after the checks below. Its encoded destination was independently decoded and compared with this URL. The page returns HTTP 200; that alone does not verify a new participant can join the event.

**Fictional integration-test room**

https://ai-pilled-demo.vercel.app/e/ai-pilled-test-2026

Use `AI_pilled_TEST_room_QR.png` for rehearsal. It contains clearly marked agent test profiles plus the organiser's trial profiles. The landing page's `/demo` is different again: it is a browser-local rehearsal using human-labelled fixtures and explicitly simulated replies, not live AI or cross-device messaging.

A saved participant identity currently belongs to one event. For the first real-event check, use a phone/browser that has not joined the test room. Do not clear an existing browser's storage just to switch: that loses automatic access to its profile and conversations. Incognito sessions also disappear when their private browsing session ends. Public participant IDs are not recovery credentials.

## 1. Check the shared-Wi-Fi sign-in limit

Open Supabase → **Authentication → Rate Limits**:

https://supabase.com/dashboard/project/tzndmqndeskxinqnyouv/auth/rate-limits

Review **Anonymous sign-ins**. Supabase documents a default of **30 per IP address per hour**, including burst capacity equal to the configured limit. On shared event Wi-Fi, 60–80 attendees may appear under one IP address.

If still at the default, a practical event setting is **150 anonymous sign-ins per IP per hour** to allow 80 attendees plus rehearsals and accidental new sessions. This is a recommendation, not a configuration change already made. Do not set it to unlimited. Monitor usage and reduce it again after the event if appropriate. Keep the attendee link limited to the event until ready to launch.

CAPTCHA is not wired into this version. Do not enable mandatory CAPTCHA immediately before the demo without implementing and testing its token flow. This app is not claimed to be bot-proof.

Reference checked: https://supabase.com/docs/guides/auth/rate-limits

## 2. Confirm service access lasts through the meetup

- Vercel's latest production deployment is Ready for commit `8a5f3af` or a later deliberately reviewed release.
- OpenAI API billing/credits are enabled. The real service worked during testing, but check the event date against the key's expiration. The key-creation screenshot selected seven days; do not let the key expire before or during the meetup.
- Supabase project is active, not paused. Anonymous Sign-Ins remain enabled.
- All four required environment variables are configured for the actual production deployment. Secret keys are server-only; never put them in slides, screenshots or chat.
- Configure suitable usage alerts/spend controls where available; do not assume every project budget alert is a hard spending cap.

## 3. Verify two physical devices

1. First use the test-room QR on two phones, or a phone plus a genuinely separate browser session. Use names prefixed TEST; do not import real registration data.
2. Enter complementary needs/offers naturally. Check both independent recommendation groups, the full room count, search, profiles and recognition descriptions.
3. Send a message, reply from the other device, leave the thread to see unread and reopen it. Refresh both devices and confirm persistence.
4. Check typing with the mobile keyboard open, generous tap targets, scrolling, the profile dialog and the message retry feedback. Try the actual event Wi-Fi when possible.
5. Then scan the attendee-event QR on a fresh browser and join as yourself using answers you are happy to share with attendees. Confirm it opens the real event rather than the fictional test room. A second real organiser/helper can join from another device for a genuine cross-device check.
6. Keep these two real participant sessions available for the six-minute demo; do not rely on closing and reopening incognito to recover them.

## 4. Make the privacy/retention decision

The joining screen already discloses event-wide profile visibility, server-side OpenAI processing of the two answers, private one-to-one conversations and the browser-session recovery limitation. Messages are not used for AI matching.

Before collecting attendee data, choose an organiser contact and a retention/deletion date. Automatic event-data deletion is not implemented in this version. Arrange the admin deletion procedure rather than promising a purge that has not been built or run. Database administrators can access stored data; messaging is not end-to-end encrypted.

## 5. Six-minute presentation

Use `docs/BUILD_LOG.md` for genuine prompt/correction examples. A useful new example is the original matcher missing production/deployment and visual/interface design, followed by the real two-profile regression. Explain that search confirmed the profiles existed; the room ordering made them hard to find. Do not present this as a repaired permissions bug.

Before attendees scan, project only the final attendee QR. Keep the test QR and browser-local demo labelled separately. Never show an environment-variable value or credential on screen.
