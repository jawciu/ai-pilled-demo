import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { PGlite } from '@electric-sql/pglite';

test('80-person scheduler bounds workers, shares leases, balances directions and eventually caches every pair',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
 grant usage on schema auth to authenticated,anon,service_role;
 grant execute on function auth.uid(),auth.role() to authenticated,anon,service_role;`);
 for(const file of ['setup.sql','migrations/002_cached_match_reviews.sql','migrations/003_event_review_workers.sql'])
   await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 const ids=Array.from({length:80},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
 await db.query('insert into auth.users select unnest($1::uuid[])',[ids]);
 await db.query(`insert into public.participants(id,event_id,name,need,offer,interpretation)
 select id,(select id from public.events limit 1),'Fixture '||right(id::text,4),'I need React debugging','I can debug React',
 '{"version":1,"pipeline":2,"needs":[{"topic":"react-debugging","specific":true}],"offers":[{"topic":"react-debugging","specific":true}]}'::jsonb from auth.users`);
 async function asUser(id:string) { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id]);await db.exec('set role authenticated'); }
 type Job={requester_id:string;helper_id:string;lease_id:string};
 async function claim(id:string){await asUser(id);return (await db.query<Job>('select * from public.claim_match_reviews_v3(8)')).rows;}
 await db.exec(`create table public.profile_update_probe(id uuid);
 create function public.probe_profile_update() returns trigger language plpgsql as $$ begin insert into public.profile_update_probe values(new.id); return new; end $$;
 create trigger probe_profile_update after update on public.participants for each row execute function public.probe_profile_update();`);
 const first=await claim(ids[0]); assert.equal(first.length,8);
 assert.equal(first.filter(r=>r.requester_id===ids[0]).length,4,'both directions get first-batch progress');
 assert.equal(new Set(first.map(r=>r.lease_id)).size,1);
 assert.equal((await claim(ids[0])).length,0,'a second tab cannot start a second worker');
 for(const id of ids.slice(1,8)) assert.equal((await claim(id)).length,8);
 assert.equal((await claim(ids[8])).length,0,'ninth simultaneous worker waits');
 await db.exec('reset role');
 assert.equal((await db.query<{n:number}>("select count(distinct lease_id)::int n from public.match_reviews where revision=3 and status='processing'")).rows[0].n,8);
 // Abandoned workers recover after their lease. No production clocks or data touched.
 await db.exec("update public.match_reviews set lease_until=now()-interval '1 second' where revision=3");
 assert.equal((await claim(ids[0])).length,8);
 await db.exec('reset role');
 await db.exec("update public.match_reviews set status='ready' where revision=3");
 const begin=performance.now();let batches=9,waves=0;
 const firstServed=new Map<string,number>();
 for(;waves<110;waves++) {
   let claimed=0;
   for(let i=0;i<80;i++) {
     const jobs=await claim(ids[i]);
     assert.ok(jobs.length<=8);
     if(jobs.length){ batches++; claimed+=jobs.length; if(!firstServed.has(ids[i])) firstServed.set(ids[i],waves); }
   }
   if(!claimed) break;
   await db.exec("reset role; update public.match_reviews set status='ready' where revision=3 and status='processing'");
 }
 await db.exec('reset role');
 const ready=(await db.query<{n:number}>("select count(*)::int n from public.match_reviews where revision=3 and status='ready'")).rows[0].n;
 assert.equal(ready,80*79,'every directed pair eventually reaches the cache');
 assert.ok(waves<110);
 assert.equal(firstServed.size,80);
 assert.ok(Math.max(...firstServed.values())<=10,'fixed caller order cannot starve a first worker turn');
 assert.equal((await claim(ids[0])).length,0,'warm cache performs no new work');
 await db.exec('reset role');
 assert.equal((await db.query('select * from public.profile_update_probe')).rows.length,0,'scheduler never updates realtime participant rows');
 await asUser(ids[0]);
 assert.equal((await db.query('select * from public.current_match_reviews_v3()')).rows.length,158,'viewer only reads own directed pairs');
 // A second cold fixture has just one useful helper per person, deliberately
 // far away in ID order. Exact-topic priority should surface those first.
 await db.exec(`reset role; delete from public.match_reviews; delete from public.match_review_worker_state;
 update public.participants set interpretation=jsonb_build_object('version',1,'pipeline',2,
 'needs',jsonb_build_array(jsonb_build_object('topic','task-'||((right(id::text,12)::bigint-1)%40),'specific',true)),
 'offers',jsonb_build_array(jsonb_build_object('topic','task-'||((right(id::text,12)::bigint-1)%40),'specific',true)));`);
 const usefulBy=new Map<string,number>();
 for(let wave=0;wave<12 && usefulBy.size<80;wave++) {
   for(const id of ids) {
     for(const job of await claim(id)) {
       const a=ids.indexOf(job.requester_id),b=ids.indexOf(job.helper_id);
       if(a%40===b%40) {
         if(!usefulBy.has(job.requester_id)) usefulBy.set(job.requester_id,wave);
         if(!usefulBy.has(job.helper_id)) usefulBy.set(job.helper_id,wave);
       }
     }
   }
   await db.exec("reset role; update public.match_reviews set status='ready' where revision=3 and status='processing'");
 }
 assert.equal(usefulBy.size,80,'every sparse useful pair reaches review without waiting for full all-pairs completion');
 const lastUsefulWave=Math.max(...usefulBy.values());
 assert.ok(lastUsefulWave<=10);
 await asUser(ids[0]);
 await assert.rejects(db.query('select * from public.match_review_worker_state'),/permission denied/);
 await assert.rejects(db.query('update public.match_review_worker_state set review_claimed_at=null'),/permission denied/);
 await db.exec('reset role; set role anon');
 await assert.rejects(db.query('select * from public.claim_match_reviews_v3(8)'),/permission denied/);
 console.log(JSON.stringify({participants:80,directedPairs:ready,batches,waves,localSchedulerMs:Math.round(performance.now()-begin),lastFirstWorkerWave:Math.max(...firstServed.values()),sparseLastUsefulWave:lastUsefulWave,providerCalls:0}));
 } finally {await db.close();}
});
