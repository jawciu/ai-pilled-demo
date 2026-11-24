import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { guestRoomPeople, validRoomSlug } from '../src/lib/guest-room';
import { GET } from '../src/app/api/room/route';

const profile = { id: 'person-a', event_id: 'event-a', name: 'Alice', need: 'CSS help', offer: 'French', recognition: 'Green jumper', answer_version: 2, updated_at: '2026-11-24T12:00:00Z' };
function fixture(event: unknown, people: unknown, status = 200) {
 const requests: URL[] = [];
 const db = createClient('https://fixture.invalid', 'server-test-secret', {auth:{persistSession:false},global:{fetch:async input => {
  const url = new URL(String(input)); requests.push(url);
  const body = url.pathname.endsWith('/events') ? event : people;
  return new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json'}});
 }}});
 return {db,requests};
}
test('guest room uses exact event lookup and returns only whitelisted profile fields', async()=>{
 const {db,requests}=fixture([{id:'event-a'}],[{...profile,interpretation:{model:'private'},email:'private@example.com',messages:['private']},{...profile,id:'other',event_id:'event-b'}]);
 const result=await guestRoomPeople(db,'guest-alpha');
 assert.deepEqual(result,[{...profile,interpretation:null}]);
 assert.equal(requests.length,2);
 assert.equal(requests[0].searchParams.get('slug'),'eq.guest-alpha');
 assert.equal(requests[0].searchParams.get('select'),'id');
 assert.equal(requests[1].searchParams.get('event_id'),'eq.event-a');
 assert.equal(requests[1].searchParams.get('select'),'id,event_id,name,need,offer,recognition,answer_version,updated_at');
 assert.equal(requests[1].searchParams.get('limit'),'200');
 assert.ok(requests.every(url=>url.pathname.endsWith('/events')||url.pathname.endsWith('/participants')));
});
test('unknown and malformed room slugs cannot fall back to reading all participants',async()=>{
 const missing=fixture([],[]);
 await assert.rejects(guestRoomPeople(missing.db,'missing'),{status:404});assert.equal(missing.requests.length,1);
 for(const slug of ['', '*','a,b','../events','a'.repeat(161)]) {
  assert.equal(validRoomSlug(slug),false);
  const invalid=fixture([{id:'event-a'}],[profile]);
  await assert.rejects(guestRoomPeople(invalid.db,slug),{status:400});assert.equal(invalid.requests.length,0);
 }
 const response=await GET(new Request('https://app.invalid/api/room?slug=..%2Fsecret'));
 assert.equal(response.status,400);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('empty rooms return empty cards and database errors do not expose internal details',async()=>{
 const empty=fixture([{id:'event-a'}],[]);assert.deepEqual(await guestRoomPeople(empty.db,'empty'),[]);
 const failed=fixture({message:'SQL/private infrastructure'},[],400);
 await assert.rejects(guestRoomPeople(failed.db,'guest-alpha'),error=>{
  assert.equal((error as {status:number}).status,503);assert.doesNotMatch(String(error),/SQL|private infrastructure/);return true;
 });
});
