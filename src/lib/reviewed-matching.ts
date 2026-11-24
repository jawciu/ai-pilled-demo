import type { Match, MatchReview, Person } from './types';
import { PIPELINE_REVISION, REVIEW_REVISION, validateReviewBatch } from './ai-matching';
import { compatibleTaskScope, staleReadabilityRejection } from './task-scope';

export function hasCurrentAnalysis(person: Person) {
  return person.interpretation?.version === person.answer_version && person.interpretation.pipeline === PIPELINE_REVISION;
}
export function reviewKey(requester: Person, helper: Person) {
  return `${requester.id}:${helper.id}:${requester.answer_version}:${helper.answer_version}:${REVIEW_REVISION}`;
}
export function reviewIsCurrent(review: MatchReview, requester: Person, helper: Person) {
  return review.event_id === requester.event_id && helper.event_id === requester.event_id
    && review.requester_id === requester.id && review.helper_id === helper.id
    && review.requester_version === requester.answer_version && review.helper_version === helper.answer_version
    && review.revision === REVIEW_REVISION && hasCurrentAnalysis(requester) && hasCurrentAnalysis(helper);
}
export function reviewedRecommendations(me: Person, people: Person[], reviews: MatchReview[]) {
  const receive: Match[] = [], give: Match[] = [];
  let pending = 0, failed = 0;
  if (!hasCurrentAnalysis(me)) return { receive, give, pending, failed };
  const byKey = new Map(reviews.map(r => [`${r.requester_id}:${r.helper_id}:${r.requester_version}:${r.helper_version}:${r.revision}`, r]));
  for (const person of people) {
    if (person.id === me.id || person.event_id !== me.event_id || !hasCurrentAnalysis(person)) continue;
    for (const direction of ['receive','give'] as const) {
      const requester = direction === 'receive' ? me : person;
      const helper = direction === 'receive' ? person : me;
      if (!requester.interpretation!.needs.length || !helper.interpretation!.offers.length) continue;
      if (!compatibleTaskScope(requester,helper)) continue;
      const review = byKey.get(reviewKey(requester,helper));
      if (!review || !reviewIsCurrent(review,requester,helper) || review.status !== 'ready' || staleReadabilityRejection(review,requester,helper)) {
        pending++; if (review?.status === 'failed') failed++; continue;
      }
      let decision;
      try { decision = validateReviewBatch({ decisions: [{ ...review.decision, index: 0 }] }, [{ need: requester.need, offer: helper.offer }])[0]; }
      catch { pending++; failed++; continue; }
      if (decision.level !== 'direct') continue;
      const match = {
        person: { ...person, interpretation: null }, topic: decision.topic, score: 3,
        explanation: direction === 'receive'
          ? `You asked for “${decision.need_evidence}”. ${person.name} offered “${decision.offer_evidence}”.`
          : `${person.name} asked for “${decision.need_evidence}”. You offered “${decision.offer_evidence}”.`,
        question: `Hi ${person.name}! ${decision.opening}`
      };
      (direction === 'receive' ? receive : give).push(match);
    }
  }
  const rank = (a: Match,b: Match) => b.score-a.score || a.person.name.localeCompare(b.person.name);
  return { receive: receive.sort(rank), give: give.sort(rank), pending, failed };
}
