import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roomProfiles } from '../src/lib/room';
import { demoPeople } from '../src/lib/demo';

const base = demoPeople()[0];
const people = [
  { ...base, id: 'me', name: 'Viewer', updated_at: '2026-01-01T00:00:00Z' },
  { ...base, id: 'old', name: '[TEST] Earlier fixture', updated_at: '2026-01-01T00:00:00Z' },
  { ...base, id: 'ian', name: 'Ian', need: 'designing things that people like', offer: 'turning demos into production products', interpretation: null, updated_at: '2026-01-02T09:00:00Z' },
  { ...base, id: 'caroline', name: 'Caroline', need: "I don't know how to deploy things", offer: 'visual design and photoshop', interpretation: null, updated_at: '2026-01-02T10:00:00Z' }
];
test('recently updated participants appear before older rehearsal fixtures', () => {
  assert.deepEqual(roomProfiles(people, 'me').map(p => p.name), ['Caroline', 'Ian', '[TEST] Earlier fixture']);
});
test('room visibility does not depend on analysis or recommendations', () => {
  assert.ok(roomProfiles(people, 'ian').some(p => p.name === 'Caroline'));
  assert.ok(roomProfiles(people, 'caroline').some(p => p.name === 'Ian'));
});
test('room search trims whitespace and searches names, needs and offers', () => {
  assert.deepEqual(roomProfiles(people, 'me', ' CAROLINE ').map(p => p.name), ['Caroline']);
  assert.deepEqual(roomProfiles(people, 'me', 'photoshop').map(p => p.name), ['Caroline']);
  assert.deepEqual(roomProfiles(people, 'me', 'production products').map(p => p.name), ['Ian']);
  assert.equal(roomProfiles(people, 'me', 'missing-person').length, 0);
});
test('listing a room never mutates the underlying profile order', () => {
  const before = people.map(p => p.id);
  roomProfiles(people, 'me');
  assert.deepEqual(people.map(p => p.id), before);
});
