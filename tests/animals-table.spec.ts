import { test, expect, type Page } from '@playwright/test';
import { angularDistance, terrain, normalize } from '../lib/game/world';
import { Navigator } from '../lib/game/navigation';
import { animalHabitat } from '../lib/game/habitat';
const state = (page: Page) =>
  page.evaluate(() => window.__miniWorld.getState());
async function ready(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__miniWorld?.getState().ready);
}
test('people and animals stay put by default; each animal type follows commanded routes', async ({
  page,
}) => {
  await ready(page);
  const initial = await state(page);
  await page.waitForTimeout(1800);
  const idle = await state(page);
  expect(idle.animals.map((a) => a.position)).toEqual(
    initial.animals.map((a) => a.position),
  );
  expect(idle.animals.every((a) => !a.moving && a.hop === 0)).toBe(true);
  expect(idle.people.map((p) => p.position)).toEqual(
    initial.people.map((p) => p.position),
  );
  expect(initial.animals.filter((a) => a.kind === 'dog')).toHaveLength(2);
  expect(initial.animals.filter((a) => a.kind === 'cat')).toHaveLength(2);
  for (const kind of ['bunny', 'sheep', 'penguin', 'snake', 'dog', 'cat']) {
    const a = initial.animals.find((a) => a.kind === kind)!;
    const nav = new Navigator(initial.obstacles, animalHabitat(a.home));
    await page.evaluate((id) => window.__miniWorld.selectAnimal(id), a.id);
    expect((await state(page)).selectedAnimal).toBe(a.id);
    const destination = nav.nearestFree(
      normalize({
        x: a.position.x + 0.09,
        y: a.position.y + 0.025,
        z: a.position.z,
      }),
    );
    await page.evaluate((p) => window.__miniWorld.walkTo(p), destination);
    await expect
      .poll(async () => (await state(page)).target, { timeout: 12000 })
      .toBeNull();
    const end = (await state(page)).animals.find((x) => x.id === a.id)!;
    expect(angularDistance(end.position, destination)).toBeLessThan(0.004);
    expect(nav.clear(end.position)).toBe(true);
    expect(end.moving).toBe(false);
  }
  await page.getByRole('button', { name: 'Choose Sunny', exact: true }).click();
  expect((await state(page)).selectedAnimal).toBeNull();
  expect((await state(page)).people.map((p) => p.position)).toEqual(
    initial.people.map((p) => p.position),
  );
});
test('mouse hover and selection let an animal walk; keyboard and pause act on the selected animal', async ({
  page,
}) => {
  await ready(page);
  const initial = await state(page);
  const animal = initial.animals.find(
    (a) =>
      a.kind === 'bunny' &&
      a.screen.visible &&
      a.screen.x > 270 &&
      a.screen.x < 1170 &&
      a.screen.y > 200 &&
      a.screen.y < 740,
  )!;
  expect(animal).toBeTruthy();
  await page.mouse.move(animal.screen.x, animal.screen.y);
  await expect(page.locator('.world-canvas')).toHaveAttribute(
    'title',
    new RegExp(animal.name),
  );
  await page.mouse.click(animal.screen.x, animal.screen.y);
  expect((await state(page)).selectedAnimal).toBe(animal.id);
  await page.evaluate(() => window.__miniWorld.goTo('ocean'));
  const start = (await state(page)).position;
  expect(start).toEqual(animal.position);
  await page.locator('.world-canvas').focus();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowRight');
  expect(angularDistance(start, (await state(page)).position)).toBeGreaterThan(
    0.025,
  );
  await page.evaluate(() => window.__miniWorld.setPaused(true));
  const paused = (await state(page)).animals.map((a) => a.position);
  await page.waitForTimeout(300);
  expect((await state(page)).animals.map((a) => a.position)).toEqual(paused);
  await page.evaluate(() => window.__miniWorld.setPaused(false));
  expect((await state(page)).people.map((p) => p.position)).toEqual(
    initial.people.map((p) => p.position),
  );
});
test('every table supports sitting, drinking, standing, and switching to the bed', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const homes = (await state(page)).houses;
  for (const h of homes) {
    await page.evaluate(
      (r) => window.__miniWorld.goTo(r),
      terrain(h.position).region,
    );
    await page.evaluate((id) => window.__miniWorld.enterHouse(id), h.id);
    await expect
      .poll(async () => (await state(page)).insideHouse, { timeout: 15000 })
      .toBe(h.id);
    await page.getByRole('button', { name: 'Use table', exact: true }).click();
    expect((await state(page)).people[0].phase).toBe('seated');
    await page
      .getByRole('button', { name: 'Drink water', exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state(page)).houses.find((x) => x.id === h.id)!.bottleLift,
      )
      .toBeGreaterThan(0.04);
    await expect
      .poll(
        async () =>
          (await state(page)).houses.find((x) => x.id === h.id)!.bottleLift,
      )
      .toBeLessThan(0.001);
    await page.getByRole('button', { name: 'Stand up', exact: true }).click();
    expect((await state(page)).people[0].phase).toBe('inside');
    await page.getByRole('button', { name: 'Use table', exact: true }).click();
    await page.getByRole('button', { name: 'Use bed', exact: true }).click();
    expect((await state(page)).people[0].phase).toBe('sleeping');
    await page.getByRole('button', { name: 'Use table', exact: true }).click();
    expect((await state(page)).people[0].phase).toBe('seated');
    await page
      .getByRole('button', { name: 'Come outside', exact: true })
      .click();
    await expect
      .poll(async () => (await state(page)).people[0].phase)
      .toBe('walking');
  }
});
test('mouse table interaction and seat occupancy work across friends', async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => window.__miniWorld.enterHouse('little-cottage'));
  await expect
    .poll(async () => (await state(page)).insideHouse, { timeout: 12000 })
    .toBe('little-cottage');
  await page.waitForTimeout(600);
  const table = (await state(page)).houses[0].tableScreen;
  await page.mouse.click(table.x, table.y);
  await expect
    .poll(async () => (await state(page)).people[0].phase)
    .toBe('seated');
  await page.getByRole('button', { name: 'Choose Rosie', exact: true }).click();
  await page.evaluate(() => window.__miniWorld.enterHouse('little-cottage'));
  await expect
    .poll(async () => (await state(page)).insideHouse, { timeout: 12000 })
    .toBe('little-cottage');
  await page.getByRole('button', { name: 'Use table', exact: true }).click();
  expect((await state(page)).people[1].phase).toBe('inside');
  expect((await state(page)).people[0].phase).toBe('seated');
  await page.getByRole('button', { name: 'Choose Sunny', exact: true }).click();
  await page
    .getByRole('button', { name: 'Explore Ocean', exact: true })
    .click();
  expect((await state(page)).people[0].phase).toBe('walking');
});
