import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendations, cosine } from '../src/lib/matching';
import { demoPeople, demoProfile } from '../src/lib/demo';
import { profileSchema, messageSchema } from '../src/lib/validation';

const people = demoPeople();
const maya = people[0];
test('independent directions allow different helpers and recipients', () => {
  const receive = recommendations(maya, people, 'receive').map(m => m.person.name);
  const give = recommendations(maya, people, 'give').map(m => m.person.name);
  assert.deepEqual(receive, ['Theo']);
  assert.ok(give.includes('Theo'));
  const amara = people.find(p => p.name === 'Amara')!;
  assert.deepEqual(recommendations(amara, people, 'receive').map(m => m.person.name), ['Jules']);
  assert.deepEqual(recommendations(amara, people, 'give').map(m => m.person.name), ['Priya']);
});
test('a helper is not excluded because they appear in the other direction', () => {
  assert.ok(recommendations(maya, people, 'receive').some(m => m.person.name === 'Theo'));
  assert.ok(recommendations(maya, people, 'give').some(m => m.person.name === 'Theo'));
});
test('learning deployment and knowing another tool do not imply expertise', () => {
  const jules = people.find(p => p.name === 'Jules')!;
  assert.deepEqual(recommendations(jules, people, 'receive').map(m => m.person.name), ['Theo']);
  assert.ok(!recommendations(maya, people, 'receive').some(m => m.person.name === 'Sam'));
});
test('deployment of a mobile app is not website deployment', () => {
  const robin = people.find(p => p.name === 'Robin')!;
  assert.equal(recommendations(robin, people, 'receive').length, 0);
});
test('no matches becomes a match when a relevant participant arrives', () => {
  assert.equal(recommendations(maya, [maya], 'receive').length, 0);
  assert.equal(recommendations(maya, [maya, people[1]], 'receive').length, 1);
});
test('outdated analysis and other events are excluded', () => {
  const old = { ...people[1], answer_version: 2 };
  const foreign = { ...people[1], event_id: 'other' };
  assert.equal(recommendations(maya, [old, foreign], 'receive').length, 0);
  assert.equal(recommendations({ ...maya, answer_version: 2 }, people, 'receive').length, 0);
});
test('explanations quote actual answers and never contain percentages', () => {
  for (const m of recommendations(maya, people, 'receive')) {
    assert.ok(m.explanation.includes('help debugging React'));
    assert.ok(m.explanation.includes('debug React apps'));
    assert.ok(!m.explanation.includes('%'));
    assert.ok(m.question.includes(m.person.name));
  }
});
test('a failed interpretation produces no keyword fallback', () => {
  assert.deepEqual(recommendations({ ...maya, interpretation: null }, people, 'receive'), []);
  assert.equal(demoProfile({ name: 'New', need: 'Please help debugging React', offer: 'I can offer interface design', recognition: '' }).interpretation, null);
});
test('broad topics cannot match even with identical embeddings', () => {
  const generic = { topic: 'anything', summary: 'Anything', evidence: 'happy to help', specific: false, vector: [1, 0] };
  const a = { ...maya, interpretation: { ...maya.interpretation!, needs: [generic] } };
  const b = { ...people[1], interpretation: { ...people[1].interpretation!, offers: [generic] } };
  assert.equal(recommendations(a, [b], 'receive').length, 0);
});
test('semantic paraphrases can surface without exact topic labels', () => {
  const need = { topic: 'weekly-spreadsheets', summary: 'Weekly reports', evidence: 'moving spreadsheet rows into weekly reports', specific: true, vector: [1, 0] };
  const offer = { ...need, topic: 'office-reporting-automation', evidence: 'automate repetitive spreadsheet reporting', vector: [.99, .01] };
  const a = { ...maya, interpretation: { ...maya.interpretation!, needs: [need] } };
  const b = { ...people[1], interpretation: { ...people[1].interpretation!, offers: [offer] } };
  assert.equal(recommendations(a, [b], 'receive').length, 1);
  assert.equal(cosine([1,0], [0,1]), 0);
});
const ian = {
  ...maya, id: 'ian-regression', name: 'Ian',
  need: 'designing things that people like', offer: 'turning demos into production products',
  interpretation: { version: 1, model: 'cached-live-regression',
    needs: [{ topic: 'interface-design', summary: 'Designing things people like', evidence: 'designing things that people like', specific: true, vector: [1, 0] }],
    offers: [{ topic: 'productization', summary: 'Taking demos into production', evidence: 'turning demos into production products', specific: true, vector: [0.41, Math.sqrt(1 - 0.41 ** 2)] }]
  }
};
const caroline = {
  ...people[1], id: 'caroline-regression', name: 'Caroline',
  need: "I don't know how to deploy things", offer: 'visual design and photoshop',
  interpretation: { version: 1, model: 'cached-live-regression',
    needs: [{ topic: 'deployment', summary: 'Getting help deploying', evidence: "I don't know how to deploy things", specific: true, vector: [1, 0] }],
    offers: [{ topic: 'visual-design', summary: 'Visual design and Photoshop', evidence: 'visual design and photoshop', specific: true, vector: [0.548, Math.sqrt(1 - 0.548 ** 2)] }]
  }
};
test('Ian and Caroline connect in both directions despite different labels and low embedding similarity', () => {
  assert.deepEqual(recommendations(ian, [caroline], 'receive').map(m => m.person.name), ['Caroline']);
  assert.deepEqual(recommendations(caroline, [ian], 'receive').map(m => m.person.name), ['Ian']);
  assert.deepEqual(recommendations(ian, [caroline], 'give').map(m => m.person.name), ['Caroline']);
  assert.deepEqual(recommendations(caroline, [ian], 'give').map(m => m.person.name), ['Ian']);
});
test('related-topic explanations keep the original offers without inventing tool expertise', () => {
  const match = recommendations(caroline, [ian], 'receive')[0];
  assert.ok(match.explanation.includes('turning demos into production products'));
  assert.ok(match.explanation.includes("I don't know how to deploy things"));
  assert.ok(!match.explanation.includes('Vercel'));
  assert.ok(!match.explanation.includes('expert'));
});
test('an exact specific topic ranks above a related design offer', () => {
  const direct = { ...caroline, id: 'direct-design', name: 'Direct design helper', interpretation: {
    ...caroline.interpretation, offers: [{ ...caroline.interpretation.offers[0], topic: 'interface-design', vector: [0, 1] }]
  } };
  assert.deepEqual(recommendations(ian, [caroline, direct], 'receive').map(m => m.person.id), ['direct-design', 'caroline-regression']);
});
test('production-readiness aliases cover a general deployment need', () => {
  const helper = { ...ian, interpretation: { ...ian.interpretation,
    offers: [{ ...ian.interpretation.offers[0], topic: 'prototype-to-production' }]
  } };
  assert.equal(recommendations(caroline, [helper], 'receive').length, 1);
});
test('topic coverage does not bypass missing or non-specific AI analysis', () => {
  assert.equal(recommendations(caroline, [{ ...ian, interpretation: null }], 'receive').length, 0);
  const vague = { ...ian, interpretation: { ...ian.interpretation,
    offers: [{ ...ian.interpretation.offers[0], specific: false }]
  } };
  assert.equal(recommendations(caroline, [vague], 'receive').length, 0);
});
test('explicit platform and tool conflicts remain excluded even with identical embeddings', () => {
  const robin = people.find(p => p.name === 'Robin')!;
  const sam = people.find(p => p.name === 'Sam')!;
  const mobileNeed = { ...robin, interpretation: { ...robin.interpretation!, needs: robin.interpretation!.needs.map(t => ({ ...t, vector: [1, 0] })) } };
  const webOffer = { ...people[1], interpretation: { ...people[1].interpretation!, offers: people[1].interpretation!.offers.filter(t => t.topic === 'vercel-deployment').map(t => ({ ...t, vector: [1, 0] })) } };
  assert.equal(recommendations(mobileNeed, [webOffer], 'receive').length, 0);
  const reactNeed = { ...maya, interpretation: { ...maya.interpretation!, needs: maya.interpretation!.needs.map(t => ({ ...t, vector: [1, 0] })) } };
  const pandasOffer = { ...sam, interpretation: { ...sam.interpretation!, offers: sam.interpretation!.offers.map(t => ({ ...t, vector: [1, 0] })) } };
  assert.equal(recommendations(reactNeed, [pandasOffer], 'receive').length, 0);
});
test('input validation rejects whitespace and oversized messages', () => {
  assert.equal(messageSchema.safeParse('  ').success, false);
  assert.equal(messageSchema.safeParse('x'.repeat(2001)).success, false);
  assert.equal(profileSchema.safeParse({ name: ' ', need: 'something', offer: 'something', recognition: '' }).success, false);
});
