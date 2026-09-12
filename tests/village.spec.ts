import { test, expect, type Page } from '@playwright/test';
import { Navigator, type Obstacle } from '../lib/game/navigation';
import { normal, angularDistance } from '../lib/game/world';
const state = (page: Page) =>
  page.evaluate(() => window.__miniWorld.getState());
const ready = async (page: Page) => {
  await page.goto('/');
  await page.waitForFunction(
    () => window.__miniWorld?.getState().people?.length === 4,
  );
};

test('spherical routes avoid whole tree footprints, including across the longitude seam', () => {
  for (const longitude of [0, Math.PI - 0.04]) {
    const tree: Obstacle = {
      id: 'tree',
      center: normal(0, longitude),
      radius: 0.08,
      kind: 'tree',
    };
    const nav = new Navigator([tree]);
    const start = normal(0, longitude - 0.2),
      end = normal(0, longitude + 0.2);
    expect(nav.segmentClear(start, end)).toBe(false);
    const route = nav.route(start, end);
    expect(route).not.toBeNull();
    expect(route!.length).toBeGreaterThan(1);
    let previous = start;
    for (const step of route!) {
      expect(nav.segmentClear(previous, step)).toBe(true);
      previous = step;
    }
    expect(angularDistance(previous, end)).toBeLessThan(0.001);
    const redirected = nav.nearestFree(tree.center);
    expect(nav.clear(redirected)).toBe(true);
  }
});
test('mouse selects each person; independent paths continue after switching', async ({
  page,
}) => {
  await ready(page);
  const rosie = (await state(page)).people.find((p) => p.id === 'rosie')!;
  await page.mouse.click(rosie.screen.x, rosie.screen.y);
  expect((await state(page)).selectedPerson).toBe('rosie');
  await page.evaluate(() =>
    window.__miniWorld.walkTo({ x: -0.25, y: -0.5, z: 0.83 }),
  );
  const initial = (await state(page)).people.find(
    (p) => p.id === 'rosie',
  )!.position;
  await page.getByRole('button', { name: 'Choose Sunny', exact: true }).click();
  await page.waitForTimeout(650);
  const next = await state(page);
  expect(next.selectedPerson).toBe('sunny');
  expect(
    angularDistance(
      initial,
      next.people.find((p) => p.id === 'rosie')!.position,
    ),
  ).toBeGreaterThan(0.04);
  expect(next.people.find((p) => p.id === 'sunny')!.moving).toBe(false);
  for (const name of ['Skye', 'Pip', 'Rosie', 'Sunny']) {
    await page
      .getByRole('button', { name: `Choose ${name}`, exact: true })
      .click();
    expect((await state(page)).selectedPerson).toBe(name.toLowerCase());
  }
});
test('all house entrances are clear and big and small houses have working interiors', async ({
  page,
}) => {
  await ready(page);
  const initial = await state(page);
  const nav = new Navigator(initial.obstacles);
  for (const h of initial.houses) {
    expect(nav.clear(h.door), h.name + ' doorstep').toBe(true);
    expect(nav.segmentClear(h.door, h.inside, h.id), h.name + ' doorway').toBe(
      true,
    );
  }
  for (const id of ['little-cottage', 'big-house', 'tall-house']) {
    await page.evaluate((id) => window.__miniWorld.enterHouse(id), id);
    await expect
      .poll(async () => (await state(page)).people[0].insideHouse, {
        timeout: 15000,
      })
      .toBe(id);
    await expect(
      page.getByRole('button', { name: 'Come outside', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Come outside', exact: true })
      .click();
    await expect
      .poll(async () => (await state(page)).people[0].phase)
      .toBe('walking');
    expect((await state(page)).people[0].insideHouse).toBeNull();
  }
});
test('clicking a house visits it; clicking outside leaves it through the door', async ({
  page,
}) => {
  await ready(page);
  const house = (await state(page)).houses.find(
    (h) => h.id === 'little-cottage',
  )!;
  await page.mouse.click(house.screen.x, house.screen.y);
  await expect
    .poll(async () => (await state(page)).insideHouse, { timeout: 10000 })
    .toBe('little-cottage');
  await page.evaluate(() =>
    window.__miniWorld.walkTo({
      x: -0.2397127693,
      y: 0.2474039593,
      z: 0.9387912809,
    }),
  );
  await expect
    .poll(async () => (await state(page)).target, { timeout: 12000 })
    .toBeNull();
  expect((await state(page)).people[0].phase).toBe('walking');
  expect((await state(page)).insideHouse).toBeNull();
});
test('actual walking takes a detour and never intersects a tree or wall', async ({
  page,
}) => {
  await ready(page);
  const s = await state(page),
    nav = new Navigator(s.obstacles);
  const tree = s.obstacles.find(
    (o) =>
      o.kind === 'tree' && angularDistance(o.center, normal(0.4, -0.26)) < 0.01,
  )!;
  const end = normal(0.57, -0.26);
  expect(nav.segmentClear(s.position, end)).toBe(false);
  await page.evaluate((p) => window.__miniWorld.walkTo(p), end);
  const result = await page.evaluate(async () => {
    const samples = [];
    for (let i = 0; i < 500; i++) {
      await new Promise(requestAnimationFrame);
      const s = window.__miniWorld.getState();
      samples.push(s.position);
      if (!s.target) break;
    }
    return { samples, done: !window.__miniWorld.getState().target };
  });
  expect(result.done).toBe(true);
  expect(
    result.samples.every(
      (p) => angularDistance(p, tree.center) >= tree.radius - 1e-6,
    ),
  ).toBe(true);
  for (let i = 1; i < result.samples.length; i++)
    expect(nav.segmentClear(result.samples[i - 1], result.samples[i])).toBe(
      true,
    );
});
test('keyboard movement stops before a tree and does not tunnel through it', async ({
  page,
}) => {
  await ready(page);
  await page.locator('.world-canvas').focus();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1600);
  await page.keyboard.up('ArrowUp');
  const s = await state(page);
  const nav = new Navigator(s.obstacles);
  expect(nav.clear(s.position)).toBe(true);
  expect(s.position.y).toBeLessThan(Math.sin(0.4));
});
