import { test, expect, type Page } from '@playwright/test';
const state = (page: Page) =>
  page.evaluate(() => window.__miniWorld.getState());
async function enter(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__miniWorld?.getState().ready);
  await page.evaluate(() => window.__miniWorld.enterHouse('tall-house'));
  await expect
    .poll(async () => (await state(page)).insideHouse, { timeout: 15000 })
    .toBe('tall-house');
}
test('stairs reach both floors, upstairs furniture works, and leaving returns through the ground floor', async ({
  page,
}) => {
  await enter(page);
  expect((await state(page)).floorCount).toBe(2);
  expect((await state(page)).floor).toBe(0);
  const stairs = (await state(page)).houses.find(
    (h) => h.id === 'tall-house',
  )!.stairsScreen;
  await page.mouse.click(stairs.x, stairs.y);
  await expect.poll(async () => (await state(page)).floor).toBe(1);
  await page.getByRole('button', { name: 'Use bed', exact: true }).click();
  expect((await state(page)).people[0].phase).toBe('sleeping');
  await page.getByRole('button', { name: 'Use table', exact: true }).click();
  expect((await state(page)).people[0].phase).toBe('seated');
  await page.getByRole('button', { name: 'Drink water', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await state(page)).houses.find((h) => h.id === 'tall-house')!
          .bottleLift,
    )
    .toBeGreaterThan(0.04);
  await page
    .getByRole('button', { name: 'Go downstairs', exact: true })
    .click();
  await expect.poll(async () => (await state(page)).floor).toBe(0);
  await page.getByRole('button', { name: 'Go upstairs', exact: true }).click();
  await expect.poll(async () => (await state(page)).floor).toBe(1);
  await page.getByRole('button', { name: 'Come outside', exact: true }).click();
  await expect
    .poll(async () => (await state(page)).people[0].phase, { timeout: 7000 })
    .toBe('walking');
  expect((await state(page)).floor).toBe(0);
  expect((await state(page)).insideHouse).toBeNull();
});
test('floors and furniture occupancy belong to each friend; travel cancels stairs safely', async ({
  page,
}) => {
  test.setTimeout(45000);
  await enter(page);
  await page.getByRole('button', { name: 'Go upstairs', exact: true }).click();
  await expect.poll(async () => (await state(page)).floor).toBe(1);
  await page.getByRole('button', { name: 'Use bed', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Rosie', exact: true }).click();
  await page.evaluate(() => window.__miniWorld.enterHouse('tall-house'));
  await expect
    .poll(async () => (await state(page)).insideHouse, { timeout: 15000 })
    .toBe('tall-house');
  expect((await state(page)).floor).toBe(0);
  await page.getByRole('button', { name: 'Use bed', exact: true }).click();
  expect((await state(page)).people[1].phase).toBe('sleeping');
  expect((await state(page)).people[0].phase).toBe('sleeping');
  await page.getByRole('button', { name: 'Choose Sunny', exact: true }).click();
  expect((await state(page)).floor).toBe(1);
  await page
    .getByRole('button', { name: 'Go downstairs', exact: true })
    .click();
  await page.evaluate(() => window.__miniWorld.goTo('ocean'));
  expect((await state(page)).floor).toBe(0);
  expect((await state(page)).people[0].phase).toBe('walking');
  await page.waitForTimeout(2000);
  expect((await state(page)).insideHouse).toBeNull();
});
test('pausing on stairs freezes progress; leaving midway comes downstairs before exiting', async ({
  page,
}) => {
  await enter(page);
  await page.getByRole('button', { name: 'Go upstairs', exact: true }).click();
  await page.evaluate(() => window.__miniWorld.setPaused(true));
  await page.waitForTimeout(2000);
  expect((await state(page)).floor).toBe(0);
  expect((await state(page)).changingFloor).toBe(true);
  await page.evaluate(() => window.__miniWorld.setPaused(false));
  await page.getByRole('button', { name: 'Come outside', exact: true }).click();
  await expect
    .poll(async () => (await state(page)).people[0].phase, { timeout: 10000 })
    .toBe('walking');
  expect((await state(page)).floor).toBe(0);
});
