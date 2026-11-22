# AI pilled — realistic matching evaluation

## Scope and method

- Tested the deployed app at https://ai-pilled-demo.vercel.app against commit `8a5f3af` on 2026-11-22.
- Used the isolated `ai-pilled-test-2026` event, not the attendee event.
- Created 14 fictional profiles named `[SCENARIO] …`, each explicitly described as a fictional test profile. They remain in the test room for reproduction; no participant profiles or messages were deleted or modified.
- Wrote the inputs and 24 expected directional outcomes in `tests/real-world-scenarios.json` BEFORE asking the deployed AI to process them.
- Called the real server-side interpretation endpoint for each profile, then fetched deployed recommendations. These were new model outputs, not human-labelled matching fixtures. Returned model metadata: `gpt-4.1-mini`.
- Checked both directions: A receiving help from B must also appear as B being able to help A. This is consistency of the same directed connection, not a requirement for reciprocal matching.
- Reviewed every additional recommendation among these scenario profiles, rather than reviewing only the predefined checks.
- Did not change app code, matching thresholds, AI prompts, database rules or the production deployment during this evaluation.

Raw results and anonymous session credentials remain in ignored `.tmp/scenarios/`; credentials must never be published. The scenario definition and this report contain fictional data only. The scratch runner and review script are `.tmp/run-real-world-scenarios.mts` and `.tmp/review-real-world-results.mts`.

## Summary

| Measure | Observed result |
|---|---|
| Profiles joined and processed successfully | 14 of 14 |
| Predefined directional checks matching expectations | 21 of 24 |
| Useful expected connections found | 9 of 12 |
| Useful expected connections missed | 3 of 12 |
| Predefined unsuitable connections correctly excluded | 12 of 12 |
| Directional inconsistencies in predefined checks | 0 |
| Extracted evidence not present verbatim in its source field | 0 |
| Additional weak recommendation found during manual review | 1 |
| Additional dropped explicit offer found during extraction review | 1 |

This is a small, deliberately constructed evaluation, not a statistical estimate of event-wide accuracy. In particular, “no false positives in the 12 predefined negative checks” does NOT mean no bad recommendations overall. Manual review found a weak extra recommendation outside those checks. A complete production load test and independent human adjudication were not performed.

## All predefined scenarios

Arrows below mean **person needing help ← person offering help**. See the JSON for complete unedited input answers.

| # | Scenario | Expected | Actual |
|---|---|---|---|
| 1 | Noor's repetitive CSV/report copying ← Fin's Apps Script reporting automation | Connect | Connected |
| 2 | Ash's manual weekly spreadsheet report ← Fin's automation offer | Connect | Connected |
| 3 | Fin's “runs on my laptop, put it on the internet” ← Ren's Next.js/Vercel deployment | Connect | Connected |
| 4 | Kit learning Vercel ← Ren's explicit deployment help | Connect | Connected |
| 5 | Ren's homemade-looking app ← Ada's visual/Photoshop/spacing feedback | Connect | Connected |
| 6 | Ellis P's colour and typography polish ← Ada's visual-design offer | Connect | Connected |
| 7 | Ada's feature creep and choosing a small first project ← Leo's scoping offer | Connect | Connected |
| 8 | Leo's React white screen on Save ← Ash's React console/button-crash debugging | Connect | Connected |
| 9 | Morgan's broken mobile CSS ← Ash's explicit phone CSS debugging | Connect | MISSED |
| 10 | Dr Rowan's confidential AI-note privacy question ← Ellis P's safe-AI/redaction guidance | Connect | MISSED |
| 11 | Val's idea-validation interviews ← Jo's customer-interview planning offer | Connect | MISSED |
| 12 | Camille's French-language description of repeated CSV reporting ← Fin's automation offer | Connect | Connected |
| 13 | Fin's deployment need ← Kit learning deployment, explicitly not ready to teach | Exclude | Excluded |
| 14 | Leo's React problem ← Morgan's Python/pandas offer explicitly excluding React | Exclude | Excluded |
| 15 | Jo's Flutter/App Store publishing ← Ren's website/Vercel deployment | Exclude | Excluded |
| 16 | Val's user-discovery need, explicitly not screen appearance ← Ada's visual-design offer | Exclude | Excluded |
| 17 | Dr Rowan's confidential clinical AI privacy need ← Fin's spreadsheet automation | Exclude | Excluded |
| 18 | Fin's deployment need ← Pat's vague friendliness and no technical offer | Exclude | Excluded |
| 19 | Leo's debugging need ← Pat's generic friendliness | Exclude | Excluded |
| 20 | Pat's prompt-injection text plus actual sewing question ← Ren's app-production offer | Exclude | Excluded |
| 21 | Dr Rowan's privacy need ← Ada's visual-design offer | Exclude | Excluded |
| 22 | Ren's visual-polish need ← Morgan's pandas debugging | Exclude | Excluded |
| 23 | Morgan's CSS implementation debugging ← Ada's visual-only feedback, explicitly not programming | Exclude | Excluded |
| 24 | Kit's Vercel need ← Ash's React/CSS debugging without a deployment offer | Exclude | Excluded |

## What failed and why

### 1. Mobile CSS debugging: obvious paraphrase missed

Need: “My CSS layout breaks on small phone screens. I need someone to help me debug the responsive layout.”

Offer: “I can also debug CSS layouts on phones.”

AI labelled the need `css-responsive-layout-debugging` and the offer `css-debugging`. Their cosine similarity was approximately 0.800, below the current 0.84 internal gate. There is no explicit topic-coverage rule between them. This is a clear missed useful introduction.

### 2. Privacy-aware AI use: useful practical advice missed

Need: a fictional clinician asks what confidential notes must not be uploaded to a chatbot.

Offer: “I help teams use AI with confidential documents safely: deciding what not to upload, redaction and basic privacy risks.” The offer explicitly excludes legal advice; the expected connection is practical privacy guidance, not invented legal/clinical qualifications.

AI used `data-privacy` versus `ai-document-privacy`, with cosine approximately 0.600. Different labels and the similarity gate excluded it.

### 3. Customer interviews: inconsistent topic extraction caused a miss

Need: “Before I build anything, how do I interview potential users to check whether my idea solves a real problem? This is not about how the screens look.”

Offer: “I can help plan customer interviews and ask non-leading questions to find out whether people actually need a product.”

AI used `user-interviewing` for the need but `project-scoping` for the interview offer, with cosine approximately 0.768. The offer's evidence is correct, but its topic is overly broad. A growing list of aliases alone would not reliably solve this.

### 4. Weak extra recommendation: shared broad topic accepted too readily

Outside the predefined checks, Ada's “big vague app idea … choosing one small useful thing to build first” was matched with Noor's offer to “rewrite a confusing project description in plain English so non-technical colleagues understand it.”

Both were labelled `project-scoping`. That exact topic bypassed the semantic cutoff, even though the offered help concerns writing and communication, not selecting scope or priorities. Their cosine was approximately 0.575. This is a weak/unsupported introduction relative to the stated need, even though the explanation faithfully quoted both answers.

Another extra match suggested Jo's customer-interview offer for Ada's broad idea/scoping need. That is a plausible adjacent conversation—interviews can help decide what is worth building—but it should rank below Leo's direct scoping offer. This judgement is qualitative, not a predefined pass.

### 5. French offer lost during extraction

Camille's French NEED for reporting automation was interpreted and matched correctly. However, the explicit French OFFER “Je peux traduire des textes courts entre le français et l’anglais.” was extracted as an empty offer list. This was not one of the original 24 directional checks because no profile in the set explicitly needs translation, but it is a real completeness defect. Do not claim complete multilingual support based on the successfully translated need.

## Other observations

- The prompt-injection attempt did not become ranking evidence; only the actual sewing question survived in that profile's needs. It did not expose any messages. This was one adversarial input, not proof of complete prompt-injection resistance.
- An offer saying “I watched a deployment tutorial … not comfortable helping others yet” yielded no offers, as intended.
- Every extracted evidence string was present in the corresponding original answer. Nevertheless, correct excerpts do not guarantee correct topic labels or a useful connection.
- The system labelled a generic Next.js “put it on the internet” need as `vercel-deployment`, even though the participant did not name a hosting provider. It found the desired helper here, but platform requirements should not be invented during interpretation.
- Suggested openers are grounded but often too long: they quote most of both answers and can contain awkward repeated punctuation. They work as evidence, but are not yet natural short first messages.
- This evaluation checked full recommendation lists, not whether every expected match lands within the first three displayed cards. Ranking quality needs its own check in a crowded room.

## Recommended next change

Do not fix this merely by lowering the cosine threshold globally or adding an alias for each new failure. We observed both missed paraphrases AND overly broad exact-topic matches.

1. Make extraction more consistent and complete: distinguish project communication, project scoping and user research; preserve explicit multilingual offers; retain tool constraints without inventing them.
2. Use topics/embeddings to retrieve plausible candidates, then check the actual need and offer together before accepting a connection. The check should return structured, evidence-grounded output with explicit exclusions and be cached by answer versions. It must not include messages or run afresh on every page load.
3. Apply the relevance check to exact-topic candidates too; a shared broad label should not by itself be sufficient evidence.
4. Preserve all 24 original checks and report them unchanged. Add the discovered weak recommendation, omitted French offer, concise opener quality and top-three ranking as additional checks, explicitly labelled as discovered after the first run.
5. Evaluate improvements on a held-out set of new paraphrases, not only these examples. Keep the current deployment unchanged until that design and its cost/latency tradeoff are approved and verified.

No fixes or new deployment were performed as part of this test-only request.
