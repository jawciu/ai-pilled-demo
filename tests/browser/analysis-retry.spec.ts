import {test,expect} from '@playwright/test';
const url='https://tzndmqndeskxinqnyouv.supabase.co';
const id='11111111-1111-4111-8111-111111111111';
test('transient extraction retries automatically, stops at three attempts, and permits manual recovery',async({page})=>{
 await page.clock.install();
 await page.addInitScript(({id})=>localStorage.setItem('sb-tzndmqndeskxinqnyouv-auth-token',JSON.stringify({access_token:'mock-token',refresh_token:'mock-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id,aud:'authenticated',role:'authenticated',created_at:'2026-01-01',app_metadata:{},user_metadata:{},is_anonymous:true}})),{id});
 let ready=false,calls=0;
 await page.route(`${url}/**`,route=>{
   const target=route.request().url();
   const data=target.includes('/participants')?[{id,event_id:'event',name:'Retry viewer',need:'I need CSS debugging',offer:'I can translate French',recognition:'Test only',answer_version:1,updated_at:'2026-01-01',analysis_version:ready?1:null,analysis_pipeline:ready?2:null}]:target.includes('/events')?[{slug:'retry-event'}]:[];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.routeWebSocket('**/realtime/**',socket=>socket.close());
 await page.route('**/api/recommendations',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({receive:[],give:[],pending:0,failed:0})}));
 await page.route('**/api/interpret',route=>{
   calls++;if(calls>3)ready=true;
   return route.fulfill({status:ready?200:calls===1?429:503,headers:{'Retry-After':'60'},contentType:'application/json',body:JSON.stringify(ready?{cached:false}:{error:'Please wait for the AI service.'})});
 });
 await page.goto('/e/retry-event');
 await expect.poll(()=>calls).toBe(1);
 const nav=page.getByRole('navigation',{name:page.viewportSize()!.width<=760?'Mobile navigation':'Main navigation',exact:true});
 await nav.getByRole('button',{name:'For you',exact:true}).click();
 await expect(page.getByText(/We’ll retry automatically shortly/)).toBeVisible();
 await page.clock.fastForward(59000);expect(calls).toBe(1);
 await page.clock.fastForward(1000);await expect.poll(()=>calls).toBe(2);
 await expect(page.getByText(/We’ll retry automatically shortly/)).toBeVisible();
 await page.clock.fastForward(60000);await expect.poll(()=>calls).toBe(3);
 await expect(page.getByRole('status').filter({hasText:'Please wait for the AI service.'})).toBeVisible();
 await expect(page.getByText(/We’ll retry automatically shortly/)).toHaveCount(0);
 await page.clock.fastForward(180000);expect(calls).toBe(3);
 await page.getByRole('button',{name:'Try preparing recommendations',exact:true}).click();
 await expect.poll(()=>calls).toBe(4);
 await expect(page.getByRole('button',{name:'Try preparing recommendations',exact:true})).toHaveCount(0);
});
