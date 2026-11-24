import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const event='ai-pilled-test-codex-2026-11-24';
const url='https://tzndmqndeskxinqnyouv.supabase.co';
const key='sb_publishable_dG8mZUkm6UceuU2qa9MtoA_gEim2DDa';
async function main(){
 const dir=`.tmp/live-messaging/${event}`;await mkdir(dir,{recursive:true});
 const clients:SupabaseClient[]=[];const ids:string[]=[];
 for(const name of ['Alice','Bob','Outsider']){
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  let stored;try{stored=JSON.parse(await readFile(`${dir}/${name}.json`,'utf8'));}catch{}
  const auth=stored?await db.auth.setSession(stored):await db.auth.signInAnonymously();
  if(auth.error||!auth.data.session)throw auth.error||Error('No session');
  const {access_token,refresh_token}=auth.data.session;
  await writeFile(`${dir}/${name}.json`,JSON.stringify({access_token,refresh_token}),{mode:0o600});
  const joined=await db.rpc('join_event',{p_slug:event,p_name:`[VERIFY] ${name}`,p_need:'Fictional messaging verification only',p_offer:'Fictional messaging verification only',p_recognition:'Test fixture, not an attendee'});
  if(joined.error)throw joined.error; clients.push(db);ids.push(auth.data.session.user.id);
 }
 const [alice,bob,outsider]=clients;
 const chat=await alice.rpc('start_conversation',{p_other:ids[1]});if(chat.error)throw chat.error;
 assert.equal((await bob.rpc('start_conversation',{p_other:ids[0]})).data,chat.data);
 const clientId=crypto.randomUUID();
 const payload={p_conversation:chat.data,p_body:'Fictional launch-check message',p_client_id:clientId};
 const first=await alice.rpc('send_message',payload);if(first.error)throw first.error;
 const retry=await alice.rpc('send_message',payload);assert.equal(retry.data.id,first.data.id);
 const inbox=await bob.rpc('get_inbox');if(inbox.error)throw inbox.error;
 assert.ok(Number(inbox.data.find((i:any)=>i.conversation_id===chat.data).unread)>0);
 const rows=await bob.from('messages').select('id,body').eq('conversation_id',chat.data);if(rows.error)throw rows.error;
 assert.ok(rows.data.some(r=>r.id===first.data.id));
 const response=await bob.rpc('send_message',{p_conversation:chat.data,p_body:'Fictional verification reply',p_client_id:crypto.randomUUID()});if(response.error)throw response.error;
 const hiddenMessages=await outsider.from('messages').select('id').eq('conversation_id',chat.data);
 const hiddenChats=await outsider.from('conversations').select('id').eq('id',chat.data);
 if(hiddenMessages.error)throw hiddenMessages.error;if(hiddenChats.error)throw hiddenChats.error;
 assert.equal(hiddenMessages.data.length,0);assert.equal(hiddenChats.data.length,0);
 assert.ok((await outsider.rpc('send_message',{...payload,p_client_id:crypto.randomUUID()})).error);
 assert.ok((await outsider.rpc('mark_read',{p_conversation:chat.data})).error);
 const outsiderInbox=await outsider.rpc('get_inbox');if(outsiderInbox.error)throw outsiderInbox.error;assert.equal(outsiderInbox.data.length,0);
 assert.ok((await alice.rpc('send_message',{...payload,p_body:' ',p_client_id:crypto.randomUUID()})).error);
 const mark=await bob.rpc('mark_read',{p_conversation:chat.data});if(mark.error)throw mark.error;
 const read=await bob.rpc('get_inbox');assert.equal(Number(read.data.find((i:any)=>i.conversation_id===chat.data).unread),0);
 const fresh=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 await fresh.auth.setSession(JSON.parse(await readFile(`${dir}/Alice.json`,'utf8')));
 const persisted=await fresh.from('messages').select('id').eq('conversation_id',chat.data);if(persisted.error)throw persisted.error;
 assert.ok(persisted.data.some(r=>r.id===response.data.id));
 const result={event,passed:true,checks:['anonymous join','one conversation per pair','send/reply','retry idempotency','unread and mark-read','persistence via new client','outsider read/send/receipt/inbox denial','empty message rejection'],time:new Date().toISOString()};
 await writeFile(`${dir}/result.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Live messaging verification failed');process.exitCode=1;});
