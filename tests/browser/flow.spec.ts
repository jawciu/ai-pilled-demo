import { test, expect, type Page } from '@playwright/test';

async function join(page: Page) {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Use Maya’s fictional rehearsal profile' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Find my people' }).click();
  await expect(page.getByRole('heading', { name: 'A little help. Both ways.' })).toBeVisible();
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
  await expect(page.getByText('Hey Maya Updated.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(errors).toEqual([]);
  await page.screenshot({ path: `.tmp/${test.info().project.name}-recommendations.png`, fullPage: true });
});
test('custom rehearsal text does not silently use keyword matching', async ({ page }) => {
  await page.goto('/demo');
  await page.getByLabel('First name').fill('Taylor');
  await page.getByLabel('I’d like help with').fill('I would like debugging React help please.');
  await page.getByLabel('I can help with').fill('I can offer design feedback on an app.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Find my people' }).click();
  await expect(page.getByText('No recommendations to show yet.')).toHaveCount(2);
  await expect(page.getByText(/Rehearsal matching uses human-labelled fixtures/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
test('separate rehearsal sessions do not share identities or pretend to be live', async ({ browser }) => {
  const first = await browser.newContext(); const second = await browser.newContext();
  const a = await first.newPage(); const b = await second.newPage();
  await join(a); await b.goto('/demo');
  await expect(b.getByRole('heading', { name: 'Let’s start with you.' })).toBeVisible();
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
test('the room exposes the full count and clears a stale search on return', async ({ page }) => {
  await join(page);
  await nav(page, /^The room/);
  const search = page.getByRole('textbox', { name: 'Find a name or topic' });
  const total = await page.locator('.room-grid .person-card').count();
  expect(total).toBeGreaterThan(3);
  await search.fill(' Theo ');
  await expect(page.locator('.room-grid .person-card')).toHaveCount(1);
  await expect(page.getByRole('status')).toContainText(`Showing 1 of ${total} people`);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.room-grid .person-card')).toHaveCount(total);
  await search.fill('Theo');
  await nav(page, 'For you');
  await nav(page, /^The room/);
  await expect(search).toHaveValue('');
  await expect(page.locator('.room-grid .person-card')).toHaveCount(total);
  await expect(page.getByRole('status')).toContainText(`Showing ${total} of ${total} people`);
});
test('landing and onboarding fit a phone without horizontal scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your next breakthrough/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: `.tmp/${test.info().project.name}-landing.png`, fullPage: true });
  await page.getByRole('link', { name: 'Explore the rehearsal' }).click();
  await expect(page.getByRole('heading', { name: 'Let’s start with you.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
