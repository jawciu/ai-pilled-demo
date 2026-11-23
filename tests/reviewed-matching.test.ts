import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateReviewBatch, reviewAnswers, reviewFailureCode } from '../src/lib/ai-matching';
import { reviewedRecommendations } from '../src/lib/reviewed-matching';
import { demoPeople } from '../src/lib/demo';
import type { MatchReview } from '../src/lib/types';
const [rawA,rawB,rawC] = demoPeople();
const a = { ...rawA, interpretation: { ...rawA.interpretation!, pipeline: 2 } };
const b = { ...rawB, interpretation: { ...rawB.interpretation!, pipeline: 2 } };
const c = { ...rawC, interpretation: { ...rawC.interpretation!, pipeline: 2 } };
const accepted = { level: 'direct' as const, need_evidence: 'help debugging React', offer_evidence: 'debug React apps', topic: 'React debugging', opening: 'Could you help me find why Save crashes my app?' };
function review(overrides: Partial<MatchReview> = {}): MatchReview {
  return { event_id: a.event_id,requester_id:a.id,helper_id:b.id,requester_version:1,helper_version:1,revision:2,status:'ready',lease_id:'lease',lease_until:'2026-01-01T00:00:00Z',decision:accepted,...overrides };
}
test('failure codes expose categories without participant text or keys', () => {
  assert.equal(reviewFailureCode(new Error('AI service returned 400')),'ai_service_returned_400');
  assert.equal(reviewFailureCode(new Error('Could not cache connection check')),'could_not_cache_connection_check');
  assert.equal(reviewFailureCode(new Error('Secret participant text or token')),'unknown_review_error');
  assert.equal(reviewFailureCode(new SyntaxError('Private model response')),'invalid_review_json');
});
test('live recommendations require checked evidence, not an exact topic label', () => {
  const result = reviewedRecommendations(a,[a,b],[]);
  assert.equal(result.receive.length,0); assert.ok(result.pending>0);
  const confirmed = reviewedRecommendations(a,[a,b],[review()]);
  assert.equal(confirmed.receive[0].person.id,b.id);
  assert.ok(confirmed.receive[0].question.length < 180);
  assert.ok(confirmed.receive[0].explanation.includes('help debugging React'));
});
test('cached rejection prevents a weak match even when old topics would agree', () => {
  const rejected = review({decision:{level:'none',need_evidence:'',offer_evidence:'',topic:'',opening:''}});
  assert.equal(reviewedRecommendations(a,[b],[rejected]).receive.length,0);
});
test('same checked directed pair appears in receive and the helper give list', () => {
  assert.equal(reviewedRecommendations(a,[a,b],[review()]).receive[0].person.id,b.id);
  assert.equal(reviewedRecommendations(b,[a,b],[review()]).give[0].person.id,a.id);
});
test('failed checks and old answer versions are not silently accepted', () => {
  const result = reviewedRecommendations(a,[b],[review({status:'failed'})]);
  assert.equal(result.receive.length,0); assert.ok(result.failed>0); assert.ok(result.pending>0);
  assert.equal(reviewedRecommendations(a,[b],[review({helper_version:0})]).receive.length,0);
  assert.equal(reviewedRecommendations(a,[b],[review({revision:1})]).receive.length,0);
  assert.equal(reviewedRecommendations(a,[{...b,event_id:'foreign'}],[review()]).receive.length,0);
});
test('legacy and missing extraction must be refreshed rather than fallback matched', () => {
  assert.equal(reviewedRecommendations({...a,interpretation:rawA.interpretation},[b],[review()]).receive.length,0);
  assert.equal(reviewedRecommendations(a,[{...b,interpretation:null}],[review()]).receive.length,0);
});
test('direct matches rank before related introductions in the top three', () => {
  const extra = [0,1,2,3].map(i=>({...b,id:`helper-${i}`,name:`Helper ${i}`}));
  const reviews = extra.map((p,i)=>review({helper_id:p.id,decision:{...accepted,level:i===0?'related':'direct'}}));
  const result = reviewedRecommendations(a,extra,reviews);
  assert.deepEqual(result.receive.slice(0,3).map(m=>m.person.id),['helper-1','helper-2','helper-3']);
});
test('unsupported excerpts, incomplete batches and duplicate indexes fail closed', () => {
  const input = [{need:a.need,offer:b.offer}];
  assert.throws(()=>validateReviewBatch({decisions:[]},input));
  assert.throws(()=>validateReviewBatch({decisions:[{...accepted,index:0,offer_evidence:'I am an expert'}]},input));
  assert.throws(()=>validateReviewBatch({decisions:[{...accepted,index:0,opening:'x'.repeat(151)}]},input));
  assert.throws(()=>validateReviewBatch({decisions:[{...accepted,index:0},{...accepted,index:0}]},[...input,...input]));
  assert.throws(()=>validateReviewBatch({decisions:[{...accepted,index:5}]},input));
  assert.throws(()=>validateReviewBatch({decisions:[{...accepted,index:0,level:'none'}]},input));
  assert.equal(reviewedRecommendations(a,[b],[review({decision:{...accepted,offer_evidence:'fictional invented skill'}})]).receive.length,0);
});
test('an unrelated third participant cannot affect a checked pair', () => {
  const result = reviewedRecommendations(a,[a,b,c],[review()]);
  assert.deepEqual(result.receive.map(m=>m.person.id),[b.id]);
});
test('server review uses original answers and validates structured AI output', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url,options) => {
      const body = JSON.parse(String(options?.body));
      const payload = JSON.parse(body.messages[1].content);
      assert.deepEqual(payload,[{index:0,need:a.need,offer:b.offer}]);
      assert.ok(!('messages' in payload[0]));
      return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({decisions:[{...accepted,index:0}]})}}]}),{status:200});
    };
    assert.equal((await reviewAnswers([{need:a.need,offer:b.offer}]))[0].level,'direct');
    globalThis.fetch = async () => new Response('Unavailable',{status:503});
    await assert.rejects(reviewAnswers([{need:a.need,offer:b.offer}]));
  } finally { globalThis.fetch=original; }
});
