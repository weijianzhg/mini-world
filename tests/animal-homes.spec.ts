import { test, expect } from '@playwright/test';
import { animalHabitat } from '../lib/game/habitat';
const state = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__miniWorld.getState());
test('every animal has a reachable home and can rest, remain asleep and come outside', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/');
  await page.waitForFunction(() => window.__miniWorld?.getState().ready);
  const initial = await state(page);
  expect(initial.animalHomes).toHaveLength(initial.animals.length);
  for (const a of initial.animals) {
    const h = initial.animalHomes.find((h) => h.animalId === a.id)!;
    expect(animalHabitat(a.home)(h.position)).toBe(true);
  }
  await page.evaluate(() => {
    const g = window.__miniWorld;
    for (const a of g.getState().animals) {
      g.selectAnimal(a.id);
      g.restAnimal();
    }
    g.selectPerson('sunny');
  });
  await expect
    .poll(async () => (await state(page)).animals.map((a) => a.restPhase), {
      timeout: 20000,
    })
    .toEqual(initial.animals.map(() => 'sleeping'));
  expect((await state(page)).animalHomes.every((h) => h.open)).toBe(true);
  await page.evaluate(() => {
    const g = window.__miniWorld;
    for (const a of g.getState().animals) {
      g.selectAnimal(a.id);
      g.wakeAnimal();
    }
  });
  await expect
    .poll(
      async () => (await state(page)).animals.every((a) => !a.route.length),
      { timeout: 20000 },
    )
    .toBe(true);
  expect(
    (await state(page)).animals.every((a) => a.restPhase === 'outside'),
  ).toBe(true);
});
test('home buttons, sleeping keyboard guard and mouse entrance work', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__miniWorld?.getState().ready);
  const a = (await state(page)).animals.find((a) => a.kind === 'dog')!;
  await page.evaluate((id) => window.__miniWorld.selectAnimal(id), a.id);
  await page
    .getByRole('button', { name: 'Go home & rest', exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).animalRest?.phase)
    .toBe('sleeping');
  const before = (await state(page)).position;
  await page.locator('.world-canvas').focus();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  expect((await state(page)).position).toEqual(before);
  await page
    .getByRole('button', { name: 'Wake up & come outside', exact: true })
    .click();
  await expect.poll(async () => (await state(page)).target).toBeNull();
  await page.waitForTimeout(500);
  const h = (await state(page)).animalHomes.find((h) => h.animalId === a.id)!;
  await page.mouse.click(h.screen.x, h.screen.y);
  await expect
    .poll(async () => (await state(page)).animalRest?.phase)
    .toBe('sleeping');
});

test('clicking a sleeping shelter releases mouse drag', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__miniWorld?.getState().ready);
  const animal = (await state(page)).animals.find((a) => a.kind === 'dog')!;
  await page.evaluate((id) => {
    window.__miniWorld.selectAnimal(id);
    window.__miniWorld.restAnimal();
    window.__miniWorld.zoomBy(30);
  }, animal.id);
  await expect
    .poll(async () => (await state(page)).animalRest?.phase)
    .toBe('sleeping');
  await page.waitForTimeout(1500);
  for (const offset of [-15, 0, 15]) {
    const h = (await state(page)).animalHomes.find(
      (h) => h.animalId === animal.id,
    )!;
    await page.mouse.click(h.screen.x + offset, h.screen.y + 10);
    const before = (await state(page)).houses[0].screen;
    await page.mouse.move(h.screen.x + 80, h.screen.y - 60, { steps: 10 });
    await page.waitForTimeout(150);
    const after = (await state(page)).houses[0].screen;
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(3);
  }
});
