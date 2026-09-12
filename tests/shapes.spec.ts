import { test, expect } from '@playwright/test';
import { terrain } from '../lib/game/world';

test('all six shape types can be collected once, with matching collection counters', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/');
  await page.waitForFunction(() => window.__miniWorld?.getState().ready);
  const initial = await page.evaluate(() => window.__miniWorld.getState());
  expect(initial.collectibles).toHaveLength(12);
  expect(new Set(initial.collectibles.map((c) => c.kind)).size).toBe(6);
  for (const [index, token] of initial.collectibles.slice(0, 6).entries()) {
    await page.evaluate(
      (region) => window.__miniWorld.goTo(region),
      terrain(token.position).region,
    );
    await page.evaluate(
      (point) => window.__miniWorld.walkTo(point),
      token.position,
    );
    await expect
      .poll(
        async () =>
          page.evaluate(
            (i) => window.__miniWorld.getState().collectibles[i].found,
            index,
          ),
        { timeout: 12000 },
      )
      .toBe(true);
    await expect
      .poll(
        async () => page.evaluate(() => window.__miniWorld.getState().target),
        { timeout: 12000 },
      )
      .toBeNull();
    const state = await page.evaluate(() => window.__miniWorld.getState());
    const matching = state.collectibles.filter(
      (c) => c.kind === token.kind && c.found,
    ).length;
    await expect(
      page.getByLabel(`${token.kind}: ${matching} of 2`, { exact: true }),
    ).toBeVisible();
    expect(state.stars).toBe(state.collectibles.filter((c) => c.found).length);
    await page.evaluate(
      (point) => window.__miniWorld.walkTo(point),
      token.position,
    );
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__miniWorld.getState().stars)).toBe(
      state.stars,
    );
  }
});
