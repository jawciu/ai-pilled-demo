import { test, expect } from '@playwright/test';
const url = 'https://tzndmqndeskxinqnyouv.supabase.co';
const meId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const profiles = [
  { id: meId,event_id:'event',name:'Test viewer',need:'My CSS breaks on phones',offer:'I can translate French and English',recognition:'Test only',answer_version:1,updated_at:'2026-01-01',analysis_version:1,analysis_pipeline:2 },
  { id: otherId,event_id:'event',name:'Test helper',need:'I need French translation',offer:'I can fix responsive CSS',recognition:'Test only',answer_version:1,updated_at:'2026-01-01',analysis_version:1,analysis_pipeline:2 }
];
test('pending and failed connection checks never look like no useful people exist', async ({ page }) => {
  await page.addInitScript(({meId}) => {
    localStorage.setItem('sb-tzndmqndeskxinqnyouv-auth-token',JSON.stringify({
      access_token:'mock-test-token',refresh_token:'mock-test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',
      user:{id:meId,aud:'authenticated',role:'authenticated',created_at:'2026-01-01',app_metadata:{},user_metadata:{},is_anonymous:true}
    }));
  },{meId});
  await page.route(`${url}/**`,async route => {
    const target=route.request().url();
    const data=target.includes('/participants')?profiles:target.includes('/events')?[{slug:'mock-event'}]:[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.routeWebSocket('**/realtime/**', socket=>socket.close());
  let ready=false;
  let reviewCalls=0;
  await page.route('**/api/recommendations',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    pending:ready?0:2,failed:ready?0:1,give:[],receive:ready?[{
      person:{...profiles[1],interpretation:null},topic:'CSS debugging',explanation:'You asked for CSS help. Test helper offered responsive CSS help.',question:'Hi Test helper! Could you help fix my phone layout?'
    }]:[]
  })}));
  await page.route('**/api/review',route=>{
    reviewCalls++;
    return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'We couldn’t check some connections. We’ll retry shortly; no guessed introductions have been added.'})});
  });
  await page.goto('/e/mock-event');
  await expect(page.getByRole('heading',{name:'A little help. Both ways.'})).toBeVisible();
  await expect(page.getByText('Checking your introductions…',{exact:true})).toHaveCount(2);
  await expect(page.getByText('No relevant recommendations yet.',{exact:true})).toHaveCount(0);
  await expect(page.locator('.analysis-note').filter({hasText:'no guessed introductions'})).toBeVisible();
  await page.waitForTimeout(5500);
  expect(reviewCalls).toBe(1);
  ready=true;
  await expect(page.getByRole('button',{name:'Meet Test helper',exact:true})).toBeVisible({timeout:12000});
  await expect(page.getByRole('heading',{name:'Checking your introductions…'})).toHaveCount(0);
  await page.getByRole('button',{name:'Meet Test helper',exact:true}).click();
  await expect(page.getByRole('dialog').getByText('Hi Test helper! Could you help fix my phone layout?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close profile'}).click();
  const navigation=page.getByRole('navigation',{name:page.viewportSize()!.width<=760?'Mobile navigation':'Main navigation',exact:true});
  await navigation.getByRole('button',{name:/^Inbox/}).click();
  await expect(page.getByText('Your next hello starts here.')).toBeVisible();
});
