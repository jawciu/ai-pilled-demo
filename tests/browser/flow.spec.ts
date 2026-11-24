import { test, expect, type Page } from '@playwright/test';

async function join(page: Page) {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Use Maya’s fictional rehearsal profile' }).click();
  await page.getByRole('button', { name: 'Find my people' }).click();
  await expect(page.getByRole('heading', { name: 'Hey Maya, here are a few people worth saying hello to.' })).toBeVisible();
}
async function nav(page: Page, name: string | RegExp) {
  const mobile = page.viewportSize()!.width <= 760;
  const navigation = page.getByRole('navigation', { name: mobile ? 'Mobile navigation' : 'Main navigation', exact: true });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', { name, exact: true }).click();
}
test('join, independent directions, message, simulated reply, refresh, profile edit', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await join(page);
  await expect(page.getByRole('heading', { name: 'People who could help you' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'People you could help' })).toBeVisible();
  await page.getByRole('button', { name: 'Meet Theo' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Message Theo' }).click();
  await expect(page.getByRole('textbox', { name: 'Message to Theo' })).not.toBeEmpty();
  await page.getByRole('textbox', { name: 'Message to Theo' }).fill('Hi Theo, can you help me with the save button?');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log').getByText('Hi Theo, can you help me with the save button?')).toBeVisible();
  await page.getByRole('button', { name: 'Rehearsal: simulate a reply from Theo' }).click();
  await expect(page.getByRole('log').getByText(/This is a simulated rehearsal reply/)).toBeVisible();
  await page.reload();
  await nav(page, 'Inbox');
  await page.getByRole('button', { name: /Theo.*simulated rehearsal reply/ }).click();
  await expect(page.getByRole('log').getByText('Hi Theo, can you help me with the save button?')).toBeVisible();
  await nav(page, page.viewportSize()!.width < 760 ? 'You' : 'My profile');
  await page.getByRole('button', { name: 'Edit my profile' }).click();
  await page.getByLabel('First name').fill('Maya Updated');
  await page.getByRole('button', { name: 'Save my changes' }).click();
  await expect(page.getByText('Hey Maya Updated,', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
  await page.screenshot({ path: `.tmp/${test.info().project.name}-recommendations.png`, fullPage: true });
});
test('custom rehearsal text does not silently use keyword matching', async ({ page }) => {
  await page.goto('/demo');
  await page.getByLabel('First name').fill('Taylor');
  await page.getByLabel('I’d like help with').fill('I would like debugging React help please.');
  await page.getByLabel('I can help with').fill('I can offer design feedback on an app.');
  await page.getByRole('button', { name: 'Find my people' }).click();
  await expect(page.getByText('No recommendations to show yet.')).toHaveCount(2);
  await expect(page.getByText(/Rehearsal matching uses human-labelled fixtures/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
test('separate rehearsal sessions do not share identities or pretend to be live', async ({ browser }) => {
  const first = await browser.newContext(); const second = await browser.newContext();
  const a = await first.newPage(); const b = await second.newPage();
  await join(a); await b.goto('/demo');
  await expect(b.getByRole('heading', { name: 'A little bit about you.' })).toBeVisible();
  await expect(a.getByText('Fictional people. Messages stay in this browser.', { exact: false })).toBeVisible();
  await first.close(); await second.close();
});
test('suggested opening question survives repeated conversation navigation', async ({ page }) => {
  await join(page);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Meet Theo', exact: true }).first().click();
    await page.getByRole('button', { name: 'Message Theo', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Message to Theo' })).toHaveValue(/Hi Theo!.*help debugging React/);
    await nav(page, 'For you');
  }
  await nav(page, 'Inbox');
  await expect(page.locator('.conversation-row')).toHaveCount(1);
});
test('the simplified room retains all profiles and clears a stale search on return', async ({ page }) => {
  await join(page);
  await nav(page, /^The room/);
  const search = page.getByRole('textbox', { name: 'Find a name or topic' });
  const total = await page.locator('.room-grid .person-card').count();
  expect(total).toBeGreaterThan(3);
  await search.fill(' Theo ');
  await expect(page.locator('.room-grid .person-card')).toHaveCount(1);
  await expect(page.getByText(/Recently updated first/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.room-grid .person-card')).toHaveCount(total);
  await search.fill('Theo');
  await nav(page, 'For you');
  await nav(page, /^The room/);
  await expect(search).toHaveValue('');
  await expect(page.locator('.room-grid .person-card')).toHaveCount(total);

});
test('landing and onboarding fit a phone without horizontal scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your next breakthrough/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `.tmp/${test.info().project.name}-landing.png`, fullPage: true });
  await page.getByRole('link', { name: 'Explore the rehearsal' }).click();
  await expect(page.getByRole('heading', { name: 'A little bit about you.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('navigation is available before joining and You preserves the onboarding draft', async ({page})=>{
  await page.goto('/demo');
  const you=page.viewportSize()!.width<=760?'You':'My profile';
  const navigation=page.getByRole('navigation',{name:page.viewportSize()!.width<=760?'Mobile navigation':'Main navigation',exact:true});
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('button',{name:you,exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('heading',{name:'A little bit about you.',exact:true})).toBeVisible();
  await page.getByLabel('First name').fill('Draft name');
  await page.screenshot({path:`.tmp/${test.info().project.name}-onboarding.png`,fullPage:true});
  for(const name of ['For you',/^The room/,'Inbox']) {
    await nav(page,name);
    if (name === 'Inbox') await expect(page.getByRole('button',{name:'Add your details'})).toBeVisible();
    else if (name === 'For you') {
      await expect(page.getByRole('button',{name:'Add your details'})).toHaveCount(0);
      await expect(page.getByText('Add your answers in You. Your recommendations will appear here once we’ve checked the connections.')).toBeVisible();
      await expect(page.locator('.person-card')).toHaveCount(0);
    } else {
      await expect(page.getByRole('textbox',{name:'Find a name or topic'})).toBeVisible();
      expect(await page.locator('.person-card').count()).toBeGreaterThan(0);
    }
  }
  await nav(page,you);
  await expect(page.getByLabel('First name')).toHaveValue('Draft name');
  await expect(page.locator('.brand')).toHaveText('aipilled');
  await expect(page.locator('.event-badge')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.locator('.privacy-note')).toHaveCount(0);
  await expect(page.getByText(/No account to create/)).toHaveCount(0);
  await expect(page.locator('.brand-name')).toHaveCSS('font-family', /DM Sans/);
  await expect(page.locator('.brand-name')).toHaveCSS('font-weight', '650');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});


test('section containers are centred beside desktop navigation and retain mobile width', async ({page})=>{
  await page.goto('/demo');
  const mobile=page.viewportSize()!.width<=760;
  const you=mobile?'You':'My profile';
  async function checkLayout(name:string) {
    const pane=await page.locator('.workspace-main').boundingBox();
    const content=await page.locator('.workspace-content').boundingBox();
    expect(pane).not.toBeNull();expect(content).not.toBeNull();
    expect(Math.abs(content!.x+content!.width/2-pane!.x-pane!.width/2)).toBeLessThan(1);
    if(mobile) expect(content!.width).toBe(pane!.width);
    await expect(page.getByText('You don’t need to know everything to help someone.',{exact:true})).toHaveCount(0);
    if(!mobile) await page.screenshot({path:`.tmp/desktop-centred-${name}.png`,fullPage:true});
  }
  await expect(page.getByLabel('First name')).toBeVisible();
  await checkLayout('onboarding');
  for(const [label,name] of [['For you','prejoin-for-you'],[/^The room/,'prejoin-room'],['Inbox','prejoin-inbox']] as const) {
    await nav(page,label);await checkLayout(name);
  }
  await nav(page,you);
  await page.getByRole('button',{name:'Use Maya’s fictional rehearsal profile'}).click();
  await page.getByRole('button',{name:'Find my people'}).click();
  await expect(page.getByRole('heading',{name:'Hey Maya, here are a few people worth saying hello to.'})).toBeVisible();
  await checkLayout('for-you');
  for(const [label,name] of [[/^The room/,'room'],['Inbox','inbox'],[you,'profile']] as const) {
    await nav(page,label);await checkLayout(name);
  }
});


test('guests browse and search the room but add details before messaging', async ({page})=>{
  await page.goto('/demo');
  await page.getByLabel('First name').fill('My draft');
  await nav(page,/^The room/);
  await page.getByRole('textbox',{name:'Find a name or topic'}).fill('Theo');
  await expect(page.locator('.person-card')).toHaveCount(1);
  await page.getByRole('button',{name:'View profile',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Meet Theo.'})).toBeVisible();
  await expect(page.getByRole('dialog').getByText('I can debug React apps and help deploy a Next.js project to Vercel.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Message Theo',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Add your details to say hello'}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByLabel('First name')).toHaveValue('My draft');
  await expect(page.getByRole('log')).toHaveCount(0);
});


test('guest event rooms show their public profiles without reading private conversations', async ({page})=>{
  const privateCalls:string[]=[];
  page.on('request',request=>{if(/conversations|messages|inbox_summary/.test(request.url())) privateCalls.push(request.url());});
  await page.route('**/api/room?*',route=>{
    const slug=new URL(route.request().url()).searchParams.get('slug');
    const people=slug==='guest-empty'?[]:[{id:slug,event_id:slug,name:slug==='guest-alpha'?'Alpha attendee':'Beta attendee',need:'I need help putting my project online.',offer:'I can offer feedback on your writing.',recognition:'Blue scarf',answer_version:1,updated_at:'2026-01-01',interpretation:null}];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({people})});
  });
  await page.goto('/e/guest-alpha');
  await page.getByLabel('First name').fill('Guest draft');
  await nav(page,/^The room/);
  await expect(page.locator('.person-card').getByRole('heading',{name:'Alpha attendee'})).toBeVisible();
  await page.getByRole('button',{name:'View profile'}).click();
  await expect(page.getByRole('dialog').getByText('I can offer feedback on your writing.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add your details to say hello'}).click();
  await expect(page.getByLabel('First name')).toHaveValue('Guest draft');
  await page.goto('/e/guest-beta');
  await nav(page,/^The room/);
  await expect(page.locator('.person-card').getByRole('heading',{name:'Beta attendee'})).toBeVisible();
  await expect(page.getByText('Alpha attendee',{exact:true})).toHaveCount(0);
  await page.goto('/e/guest-empty');
  await nav(page,/^The room/);
  await expect(page.getByText('People’s profiles will appear here as they join.',{exact:true})).toBeVisible();
  expect(privateCalls).toEqual([]);
});


test('guest room loading leaves You and navigation usable', async ({page})=>{
  let release!:()=>void;
  const responseReady=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/room?*',async route=>{
    await responseReady;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({people:[]})});
  });
  await page.goto('/e/guest-loading');
  await page.getByLabel('First name').fill('Still typing');
  await nav(page,/^The room/);
  await expect(page.getByRole('status').getByText('Loading the room…')).toBeVisible();
  await expect(page.getByText('People’s profiles will appear here as they join.')).toHaveCount(0);
  release();
  await expect(page.getByText('People’s profiles will appear here as they join.')).toBeVisible();
  await nav(page,page.viewportSize()!.width<=760?'You':'My profile');
  await expect(page.getByLabel('First name')).toHaveValue('Still typing');
});


test('guest background refresh keeps existing room cards in place', async ({page})=>{
  let calls=0,release!:()=>void;
  const refreshReady=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/room?*',async route=>{
    if(++calls>1) await refreshReady;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({people:[{id:'stable',event_id:'guest-stable',name:'Stable attendee',need:'Help with my project',offer:'Feedback on writing',recognition:'Blue scarf',answer_version:1,updated_at:'2026-01-01',interpretation:null}]})});
  });
  await page.goto('/e/guest-stable');
  await nav(page,/^The room/);
  const card=page.locator('.person-card');
  await expect(card).toBeVisible();
  const before=await card.boundingBox();
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect.poll(()=>calls).toBeGreaterThan(1);
  await expect(page.getByText('Loading the room…',{exact:true})).toHaveCount(0);
  expect(await card.boundingBox()).toEqual(before);
  release();
});
