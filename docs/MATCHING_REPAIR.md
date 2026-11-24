# Matching repair — implementation and verification

## What changed

The live matcher no longer accepts a connection merely because two broad topic labels agree, or silently rejects it because two paraphrases have a low embedding cosine score.

1. Extract needs and explicit offers into structured, evidence-backed output. Distinguish writing, scoping, user research and implementation. Preserve multilingual offers and tool exclusions. Do not invent a deployment platform.
2. Check the actual need and actual offer together, one directed connection at a time, in batches of at most eight. Names, recognition descriptions and messages are not sent to the model.
3. Accept only direct support for the actual requested task, including concrete parts of that task. Exclude speculative adjacent connections and known disjoint task families even if AI labels them relevant; unknown topic families still receive AI review. Accepted connections require verbatim evidence from both answers and a short opening question. A rejected pair stays rejected even if the provider includes unused explanatory fields.
4. Save decisions, including rejections, in Supabase keyed by both answer versions and review revision. Leases prevent duplicate concurrent work; failed work backs off. Old answers/revisions cannot be presented as current recommendations.
5. Show checking/error feedback while pending, without keyword fallback or a false “no relevant people” conclusion. Profiles and inbox remain usable.

For 60–80 people, the bounded worker considers non-empty needs/offers involving the visiting participant rather than imposing another arbitrary similarity threshold. This increases one-time model usage for changed/new answers but prevents a retrieval threshold from reproducing the observed misses. Decisions are reused on page loads. Processing is browser-driven and progressive, not a guaranteed background job when everyone closes the app. The new live pipeline no longer generates unused embeddings; the historical topic/embedding matcher remains only in the labelled local demo and historical fixture tests.

## Database and deployment

The organiser installed `supabase/migrations/002_cached_match_reviews.sql`. An authenticated test participant then successfully called the new read function and selected the cache. The migration does not delete or rewrite participant answers or messages, and does not relax conversation permissions.

Repair was initially deployed in `984acda`. Follow-ups were needed:
- `d5a933f`: fix the evaluation runner's CommonJS/top-level-await mismatch and add categorical error diagnostics without returning model content, participant text or keys.
- `240a739`: normalize unused fields on rejected AI decisions. A real single-batch check identified `unsupported_rejected_review`: the model correctly rejected unrelated pairs but included explanatory text where the validator expected empty fields. The original code rejected the whole batch. The fix discards unused metadata on none decisions; it does not promote rejected pairs or weaken evidence validation for accepted connections. A live batch subsequently returned HTTP 200 with eight cached ready decisions.

- `e7a750a`: the first full repaired evaluation found all three original misses, but also five speculative false positives (four labelled related and one translation/research mismatch labelled direct). Remove related recommendations, guard known disjoint task families, and refresh test-runner sessions during long evaluations. The first repaired run scored 21/24 original checks with one unverified session, 7/10 initial held-out checks and 2/2 discovered regressions; these intermediate results are not concealed. The held-out examples used to diagnose those failures are now regression examples, so a further seven fresh verification checks were specified before the next run.

All new commits are authored and committed as jawciu. Earlier attribution was corrected with explicit approval; old commit identifiers in historical reports may refer to the pre-rewrite history.

## Automated and live regressions completed

- 36 logic/database tests passed, including real PostgreSQL execution of the migration, scoped review access, version invalidation, lease/retry behaviour, shared rejections, accepted-evidence checks and rejected-metadata normalization.
- 14 Chromium browser checks passed across mobile emulation and desktop, including pending/failure/completion states, retry backoff, profile navigation, the room and messaging UI.
- Production build and strict TypeScript checks passed after the follow-ups.
- Independent real-service messaging checks passed: one conversation per pair, send/reply, idempotent retry, unread/mark-read, persistence through a fresh client and denial of outsider conversation reads/previews/sends/receipts.
- The new review endpoint rejects unauthenticated requests with HTTP 401.

## Real-AI scenario evaluation

The original 24 checks are preserved unchanged in `tests/real-world-scenarios.json`. Ten fresh held-out cases were specified before running the repaired pipeline in `tests/held-out-scenarios.json`. Two additional discovered regressions test the writing-versus-scoping weak match and the omitted French translation offer. Expected matches are checked for their positions in the returned ranking as well as inclusion. The runner also checks explicit French offers and opening-question bounds.

Final deployed verification completed on `4d2246d`:

| Group | Passed | Missed | False positives | Unverified |
|---|---:|---:|---:|---:|
| Original scenarios | 24/24 | 0 | 0 | 0 |
| Initial held-out scenarios (now regressions) | 10/10 | 0 | 0 | 0 |
| Discovered regressions | 2/2 | 0 | 0 | 0 |
| Additional verification scenarios | 7/7 | 0 | 0 | 0 |
| **Total** | **43/43** | **0** | **0** | **0** |

All 24 fictional scenario profiles had current extraction. Both French-language offers were retained and accepted opening questions met the runner's length/question checks. All expected positive examples appeared in the first three recommendations except the final readability example, which appeared fifth and is available through Explore more. The bounded sample does not establish universal accuracy or guarantee optimal ranking among equally direct helpers.

The additional verification set originally exposed one further miss: an appearance-only question about small pale-grey text had been labelled css-debugging, and the scope guard treated it as code implementation. `87a8cbd` lets a clearly appearance-only readability question reach review while retaining exclusions for explicit coding/debugging requests. A subsequent run showed the old scope-generated rejection was still cached; `4d2246d` targeted those legacy rejections for one fresh AI review, with a scope-policy stamp preventing repeated invalidation. Rechecked AI rejections remain rejected. No whole-event cache wipe or participant-answer rewrite was used.

The final full run reused extraction and most cached decisions, completing three new review batches and returning exit code 0. This verifies current deployed behaviour and cache reuse; it is not an independent fresh draw for every cached decision. Earlier failed/intermediate results above are retained. Physical-device, shared-Wi-Fi and full-event load checks remain outside this automated result.

Reproduce with `npx tsx scripts/evaluate-matching.ts`. This makes paid AI calls and creates only clearly fictional profiles in `ai-pilled-test-2026`. Anonymous session credentials and raw results stay in ignored `.tmp/scenarios/`; never publish those credentials.

## Limitations

This is a small event-specific evaluation, not a proof of universal matching quality, a load test or a security audit. Open-ended relevance remains a judgement call. A returned introduction is grounded in the answers, not a guarantee of expertise. Real physical-device and shared-Wi-Fi checks remain separate launch gates. Monitor AI usage and sign-in rate limits during the event.
