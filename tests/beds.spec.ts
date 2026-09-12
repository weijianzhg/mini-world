import { test, expect, type Page } from '@playwright/test';
import { terrain } from '../lib/game/world';
const state = (page: Page) =>
  page.evaluate(() => window.__miniWorld.getState());
const ready = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__miniWorld?.getState().ready);
};
test('every regional house has a usable bed, wake-up and clear exit', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const homes = (await state(page)).houses;
  expect(homes.find((h) => h.id === 'desert-home')?.style).toBe('sphinx');
  expect(new Set(homes.map((h) => h.style)).size).toBe(4);
  for (const house of homes) {
    await page.evaluate(
      (r) => window.__miniWorld.goTo(r),
      terrain(house.position).region,
    );
    await page.evaluate((id) => window.__miniWorld.enterHouse(id), house.id);
    await expect
      .poll(async () => (await state(page)).insideHouse, { timeout: 15000 })
      .toBe(house.id);
    await page.getByRole('button', { name: 'Use bed', exact: true }).click();
    await expect
      .poll(async () => (await state(page)).people[0].phase)
      .toBe('sleeping');
    expect((await state(page)).people[0].moving).toBe(false);
    await page.getByRole('button', { name: 'Wake up', exact: true }).click();
    expect((await state(page)).people[0].phase).toBe('inside');
    await page.getByRole('button', { name: 'Use bed', exact: true }).click();
    await page
      .getByRole('button', { name: 'Come outside', exact: true })
      .click();
    await expect
      .poll(async () => (await state(page)).people[0].phase)
      .toBe('walking');
    expect((await state(page)).insideHouse).toBeNull();
  }
});
test('click a bed to rest; switching friends preserves sleep and prevents double occupancy', async ({
  page,
}) => {
  test.setTimeout(45000);
  await ready(page);
  await page.evaluate(() => window.__miniWorld.enterHouse('little-cottage'));
  await expect
    .poll(async () => (await state(page)).insideHouse, { timeout: 12000 })
    .toBe('little-cottage');
  await page.waitForTimeout(600);
  const bed = (await state(page)).houses.find(
    (h) => h.id === 'little-cottage',
  )!.bedScreen;
  await page.mouse.click(bed.x, bed.y);
  await expect
    .poll(async () => (await state(page)).people[0].phase)
    .toBe('sleeping');
  await page.getByRole('button', { name: 'Choose Rosie', exact: true }).click();
  await page.evaluate(() => window.__miniWorld.enterHouse('little-cottage'));
  await expect
    .poll(async () => (await state(page)).insideHouse, { timeout: 12000 })
    .toBe('little-cottage');
  await page.getByRole('button', { name: 'Use bed', exact: true }).click();
  expect((await state(page)).people[1].phase).toBe('inside');
  expect((await state(page)).people[0].phase).toBe('sleeping');
  await page.getByRole('button', { name: 'Choose Sunny', exact: true }).click();
  await page.getByRole('button', { name: 'Wake up', exact: true }).click();
  await page.getByRole('button', { name: 'Choose Rosie', exact: true }).click();
  await page.getByRole('button', { name: 'Use bed', exact: true }).click();
  expect((await state(page)).people[1].phase).toBe('sleeping');
  await page
    .getByRole('button', { name: 'Explore Ocean', exact: true })
    .click();
  expect((await state(page)).people[1].phase).toBe('walking');
  expect((await state(page)).insideHouse).toBeNull();
});
