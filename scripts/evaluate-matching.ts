import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

type Fixture = { id:string; name:string; need:string; offer:string };
type Check = { need:string; offer:string; expected:boolean; reason:string };
async function main() {
const root = resolve(process.argv[1],'../..');
const base = process.env.EVALUATION_ORIGIN || 'https://ai-pilled-demo.vercel.app';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tzndmqndeskxinqnyouv.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_dG8mZUkm6UceuU2qa9MtoA_gEim2DDa';
const original = JSON.parse(await readFile(`${root}/tests/real-world-scenarios.json`,'utf8'));
const held = JSON.parse(await readFile(`${root}/tests/held-out-scenarios.json`,'utf8'));
const fresh = JSON.parse(await readFile(`${root}/tests/verification-scenarios.json`,'utf8'));
if (original.event !== 'ai-pilled-test-2026' || held.event !== original.event || fresh.event !== original.event) throw new Error('Refusing to seed any event except the isolated test room');
const profiles:Fixture[]=[...original.profiles,...held.profiles,...fresh.profiles];
const checks:Check[]=[...original.checks,...held.checks,
  {need:'visual',offer:'reporter',expected:false,reason:'Discovered weak connection: writing clarity does not establish feature-scoping help'},
  {need:'held-writing',offer:'french',expected:true,reason:'Discovered dropped French translation offer must be retained'},
  ...fresh.checks
];
const directory=`${root}/.tmp/scenarios`;
await mkdir(directory,{recursive:true});
const clients=new Map<string,{db:SupabaseClient;uid:string;token:string}>();
const failures:{id:string;stage:string;message:string}[]=[];
const extraction:Record<string,any>={};
let cursor=0;
async function prepare(profile:Fixture) {
  const path=`${directory}/${profile.id}-session.json`;
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const auth=existsSync(path)?await db.auth.setSession(JSON.parse(await readFile(path,'utf8'))):await db.auth.signInAnonymously();
    if (auth.error || !auth.data.session) throw auth.error || new Error('No session');
    const session=auth.data.session;
    await writeFile(path,JSON.stringify({access_token:session.access_token,refresh_token:session.refresh_token}));
    clients.set(profile.id,{db,uid:session.user.id,token:session.access_token});
    const joined=await db.rpc('join_event',{p_slug:original.event,p_name:profile.name,p_need:profile.need,p_offer:profile.offer,p_recognition:'FICTIONAL matching evaluation, not an attendee'});
    if(joined.error) throw joined.error;
    if(joined.data.need!==profile.need || joined.data.offer!==profile.offer) throw new Error('Fixture differs from stored answers; refusing silent rewrite');
    const response=await fetch(`${base}/api/interpret`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(65000)});
    const result=await response.json();
    if(!response.ok) throw new Error(`${response.status}: ${result.error}`);
    const stored=await db.from('participants').select('interpretation').eq('id',session.user.id).single();
    if(stored.error) throw stored.error;
    if(stored.data.interpretation?.pipeline!==2) throw new Error('Deployment did not produce repaired extraction');
    extraction[profile.id]={...stored.data.interpretation,
      needs:stored.data.interpretation.needs.map(({vector,...topic}:any)=>topic),
      offers:stored.data.interpretation.offers.map(({vector,...topic}:any)=>topic)};
    console.log('EXTRACTED',profile.id,result.cached?'cached':'new');
  } catch(error) { const message=error && typeof error==='object' && 'message' in error?String(error.message):String(error); failures.push({id:profile.id,stage:'extraction',message});console.log('ERROR',profile.id,message); }
}
await Promise.all([0,1].map(async()=>{while(cursor<profiles.length) await prepare(profiles[cursor++]);}));
async function apiFetch(id:string,path:string,method='GET') {
  const client=clients.get(id)!;
  const state=await client.db.auth.getSession();
  if(state.data.session && (state.data.session.expires_at||0)*1000-Date.now()<180000) {
    const refreshed=await client.db.auth.refreshSession();
    if(refreshed.error||!refreshed.data.session) throw new Error('Evaluation session refresh failed');
    client.token=refreshed.data.session.access_token;
    await writeFile(`${directory}/${id}-session.json`,JSON.stringify({access_token:client.token,refresh_token:refreshed.data.session.refresh_token}));
  }
  const send=()=>fetch(`${base}${path}`,{method,headers:{Authorization:`Bearer ${client.token}`},signal:AbortSignal.timeout(65000)});
  let response=await send();
  if(response.status===401) {
    const refreshed=await client.db.auth.refreshSession();
    if(refreshed.error||!refreshed.data.session) return response;
    client.token=refreshed.data.session.access_token;
    await writeFile(`${directory}/${id}-session.json`,JSON.stringify({access_token:client.token,refresh_token:refreshed.data.session.refresh_token}));
    response=await send();
  }
  return response;
}
let freshBatches=0;
for(let round=0;round<15;round++) {
  let pending=0;
  for(const [id,client] of clients) {
    if(!extraction[id]) continue;
    const response=await apiFetch(id,'/api/recommendations');
    const result=await response.json();
    if(!response.ok) {failures.push({id,stage:'recommendations',message:result.error});continue;}
    pending+=result.pending||0;
    if(result.pending>0) {
      const checked=await apiFetch(id,'/api/review','POST');
      const output=await checked.json();
      if(!checked.ok) failures.push({id,stage:'review',message:`${checked.status}: ${output.error}`});
      if(output.reviewed>0) freshBatches++;
      console.log('REVIEW',round,id,output.reviewed??output.error);
    }
  }
  if(pending===0) break;
  if(round===14) failures.push({id:'suite',stage:'review',message:'Pending reviews remain after bounded evaluation rounds'});
}
const recommendations:Record<string,any>={};
for(const [id,client] of clients) {
  const response=await apiFetch(id,'/api/recommendations');
  if(response.ok) recommendations[id]=await response.json();
}
const results=checks.map((check,index)=>{
  const helper=clients.get(check.offer),requester=clients.get(check.need),list=recommendations[check.need];
  const group=index<original.checks.length?'original':index<original.checks.length+held.checks.length?'held-out':index<original.checks.length+held.checks.length+2?'discovered':'fresh-verification';
  if(!helper || !requester || !list || !extraction[check.need] || !extraction[check.offer] || list.pending) return {...check,group,outcome:'UNVERIFIED'};
  const rank=list.receive.findIndex((m:any)=>m.person.id===helper.uid);
  const match=list.receive[rank];
  return {...check,group,actual:!!match,outcome:!!match===check.expected?'PASS':match?'FALSE_POSITIVE':'MISSED_MATCH',rank:rank<0?null:rank+1,
    topThree:rank>=0&&rank<3,directionalConsistency:recommendations[check.offer]?.give.some((m:any)=>m.person.id===requester.uid)===!!match,
    explanation:match?.explanation,question:match?.question};
});
const explicitFrench=extraction.french?.offers.some((t:any)=>t.evidence.includes('traduire'))&&extraction['held-language']?.offers.some((t:any)=>t.evidence.includes('traduire'));
const openers=Object.values(recommendations).flatMap((r:any)=>[...r.receive,...r.give].map((m:any)=>m.question));
const acceptedQuestionLimits=openers.every((q:string)=>q.length<=205 && /[?？]/u.test(q));
const summarize=(group:string)=>{const selected=results.filter(r=>r.group===group);return{total:selected.length,passed:selected.filter(r=>r.outcome==='PASS').length,missed:selected.filter(r=>r.outcome==='MISSED_MATCH').length,falsePositives:selected.filter(r=>r.outcome==='FALSE_POSITIVE').length,unverified:selected.filter(r=>r.outcome==='UNVERIFIED').length};};
const summary={profiles:profiles.length,extracted:Object.keys(extraction).length,original:summarize('original'),'held-out':summarize('held-out'),discovered:summarize('discovered'),freshVerification:summarize('fresh-verification'),explicitFrenchOffersRetained:!!explicitFrench,acceptedQuestionLimits,freshBatches};
await writeFile(`${directory}/repaired-results.json`,JSON.stringify({timestamp:new Date().toISOString(),base,event:original.event,summary,failures,checks:results,extraction,recommendations},null,2));
console.log('SUMMARY',JSON.stringify(summary));
for(const result of results) console.log(result.outcome,result.group,`${result.need} <- ${result.offer}`,'rank' in result?result.rank:'');
if(results.some(r=>r.outcome!=='PASS')||!explicitFrench||!acceptedQuestionLimits||failures.length) process.exitCode=1;
}
void main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode=1; });
