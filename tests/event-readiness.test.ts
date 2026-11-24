import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoPeople } from '../src/lib/demo';
import { compatibleTaskScope } from '../src/lib/task-scope';
import { reviewedRecommendations } from '../src/lib/reviewed-matching';
import { REVIEW_REVISION } from '../src/lib/ai-matching';
import type { MatchReview, Person } from '../src/lib/types';
const [rawA,rawB] = demoPeople();
const a = {...rawA,interpretation:{...rawA.interpretation!,pipeline:2}};
const b = {...rawB,interpretation:{...rawB.interpretation!,pipeline:2}};
test('compound automation topics do not exclude a supported CSV introduction',()=>{
 const requester={...a,need:'I need to automate cleaning CSV reports.',interpretation:{...a.interpretation,needs:[{...a.interpretation.needs[0],topic:'spreadsheet-automation'}]}};
 const helper={...b,offer:'I automate CSV cleaning with Python pandas.',interpretation:{...b.interpretation,offers:[{...b.interpretation.offers[0],topic:'pandas-automation'}]}};
 assert.equal(compatibleTaskScope(requester,helper),true);
 assert.equal(reviewedRecommendations(requester,[helper],[]).receive.length,0,'eligibility alone never creates a match');
});
test('fixing readability does not imply coding but explicit CSS debugging does',()=>{
 const requester={...a,need:'Help me fix the hard to read pale grey text.',interpretation:{...a.interpretation,needs:[{...a.interpretation.needs[0],topic:'css-debugging'}]}};
 const helper={...b,interpretation:{...b.interpretation,offers:[{...b.interpretation.offers[0],topic:'visual-design'}]}};
 assert.equal(compatibleTaskScope(requester,helper),true);
 assert.equal(compatibleTaskScope({...requester,need:'Help me debug CSS code for hard to read text.'},helper),false);
});
test('full task coverage ranks before partial help regardless of name',()=>{
 const partial={...b,id:'partial',name:'Aaron'};
 const full={...b,id:'full',name:'Zoe'};
 const review=(helper:Person,coverage:'full'|'partial'):MatchReview=>({event_id:a.event_id,requester_id:a.id,helper_id:helper.id,requester_version:1,helper_version:1,revision:REVIEW_REVISION,status:'ready',lease_id:'lease',lease_until:'2026-01-01',decision:{level:'direct',coverage,need_evidence:'help debugging React',offer_evidence:'debug React apps',topic:'React',opening:'Could you help debug my app?'}} as MatchReview);
 assert.deepEqual(reviewedRecommendations(a,[partial,full],[review(partial,'partial'),review(full,'full')]).receive.map(m=>m.person.name),['Zoe','Aaron']);
});

test('jobs sharing a worker lease keep their own answer-to-answer decisions',async()=>{
 const {prepareReviewBatch}=await import('../src/lib/review-batch');
 const helper1={...b,id:'one'},helper2={...b,id:'two'};
 const jobs=[helper1,helper2].map(helper=>({event_id:a.event_id,requester_id:a.id,helper_id:helper.id,requester_version:1,helper_version:1,revision:REVIEW_REVISION,status:'processing',lease_id:'shared-batch',lease_until:'2026-01-01',decision:null} as MatchReview));
 const accepted={index:0,level:'direct' as const,coverage:'full' as const,need_evidence:'help debugging React',offer_evidence:'debug React apps',topic:'React',opening:'Could you help debug my app?'};
 const rejected={index:1,level:'none' as const,coverage:'none' as const,need_evidence:'',offer_evidence:'',topic:'',opening:''};
 const results=await prepareReviewBatch(jobs,new Map([a,helper1,helper2].map(p=>[p.id,p])),async()=>[accepted,rejected]);
 assert.equal(results[0].decision.level,'direct');assert.equal(results[1].decision.level,'none');
 const stale=await prepareReviewBatch(jobs,new Map([a,{...helper1,answer_version:2},helper2].map(p=>[p.id,p])),async()=>[{...rejected,index:0}]);
 assert.deepEqual(stale.map(r=>r.job.helper_id),['two']);
});


test('profile edits partition obsolete leases without releasing current jobs in the same batch',async()=>{
 const {partitionReviewJobs,prepareReviewBatch}=await import('../src/lib/review-batch');
 const helpers=[{...b,id:'edited'},{...b,id:'current'},{...b,id:'missing'}];
 const jobs=helpers.map(helper=>({event_id:a.event_id,requester_id:a.id,helper_id:helper.id,requester_version:1,helper_version:1,revision:REVIEW_REVISION,status:'processing',lease_id:'shared-batch',lease_until:'2099-01-01',decision:null} as MatchReview));
 const people=new Map([a,{...helpers[0],answer_version:2},helpers[1]].map(p=>[p.id,p]));
 const {valid,obsolete}=partitionReviewJobs(jobs,people);
 assert.deepEqual(valid.map(job=>job.helper_id),['current']);
 assert.deepEqual(obsolete.map(job=>job.helper_id),['edited','missing']);
 assert.ok(obsolete.every(job=>job.helper_version===1 && job.lease_id==='shared-batch'),'release retains the claimed version and lease for compare-and-set');
 let called=false;
 const results=await prepareReviewBatch(obsolete,people,async()=>{called=true;return [];});
 assert.equal(called,false);assert.deepEqual(results,[]);
});
