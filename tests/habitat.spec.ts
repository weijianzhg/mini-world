import { test, expect } from '@playwright/test';
import { normal, terrain, normalize, type Point } from '../lib/game/world';
import { Navigator } from '../lib/game/navigation';
import { animalHabitat } from '../lib/game/habitat';

test('routes detour around water even when both endpoints are dry', () => {
  const allowed = (p: Point) =>
    p.z > 0.6 && (Math.abs(p.x) > 0.07 || p.y > 0.25);
  const nav = new Navigator([], allowed);
  const start = normal(0, -0.3),
    end = normal(0, 0.3);
  expect(nav.segmentClear(start, end)).toBe(false);
  const route = nav.route(start, end);
  expect(route).not.toBeNull();
  let previous = start;
  const invalid: Point[] = [];
  for (const next of route!) {
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const p = normalize({
        x: previous.x * (1 - t) + next.x * t,
        y: previous.y * (1 - t) + next.y * t,
        z: previous.z * (1 - t) + next.z * t,
      });
      if (!allowed(p)) invalid.push(p);
    }
    previous = next;
  }
  expect(invalid).toEqual([]);
});

test('all animals reject water, other regions and travel shortcuts', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__miniWorld?.getState().ready);
  const initial = await page.evaluate(() => window.__miniWorld.getState());
  expect(initial.animals.every((a) => animalHabitat(a.home)(a.position))).toBe(
    true,
  );
  const invalid = await page.evaluate(async () => {
    const game = window.__miniWorld;
    const failures: string[] = [];
    for (const a of game.getState().animals) {
      game.selectAnimal(a.id);
      for (const p of [
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: -1 },
      ]) {
        game.walkTo(p);
        if (game.getState().target)
          failures.push(a.id + ' accepted foreign destination');
      }
      for (const r of ['ocean', 'desert', 'forest', 'snow'] as const)
        game.goTo(r);
      if (
        JSON.stringify(game.getState().position) !== JSON.stringify(a.position)
      )
        failures.push(a.id + ' travelled');
    }
    return failures;
  });
  expect(invalid).toEqual([]);
  const forest = initial.animals.find((a) => terrain(a.home).land === 0)!;
  await page.evaluate(
    ({ id, p }) => {
      window.__miniWorld.selectAnimal(id);
      window.__miniWorld.walkTo(p);
    },
    { id: forest.id, p: normal(-0.5, -2) },
  );
  expect(
    (await page.evaluate(() => window.__miniWorld.getState())).target,
  ).toBeNull();
});

test('held movement cannot take an animal into water or another habitat', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.waitForFunction(() => window.__miniWorld?.getState().ready);
  const initial = await page.evaluate(() => window.__miniWorld.getState());
  const animal = initial.animals.find((a) => a.kind === 'dog')!;
  await page.evaluate((id) => window.__miniWorld.selectAnimal(id), animal.id);
  const allowed = animalHabitat(animal.home);
  const failures: Point[] = [];
  for (const key of ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']) {
    await page.locator('.world-canvas').focus();
    await page.keyboard.down(key);
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(150);
      const s = await page.evaluate(() => window.__miniWorld.getState());
      if (!allowed(s.position)) failures.push(s.position);
    }
    await page.keyboard.up(key);
  }
  expect(failures).toEqual([]);
});
