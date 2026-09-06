import { test, expect, type Page } from '@playwright/test';
import type { Game } from '../lib/game/scene';
import {
  advance,
  normal,
  terrain,
  REGIONS,
  seededRandom,
} from '../lib/game/world';
declare global {
  interface Window {
    __miniWorld: Game;
    __registered: Record<
      string,
      {
        execute: (input: unknown) => Promise<unknown>;
        inputSchema: unknown;
        annotations: unknown;
      }
    >;
  }
}
const snapshot = (page: Page) =>
  page.evaluate(() => window.__miniWorld.getState());
const dist = (
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
async function ready(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => window.__miniWorld?.getState().ready);
}
async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(80);
}

test('terrain is continuous, finite and wraps around the entire globe', () => {
  const rand = seededRandom(9);
  let p = normal(0.2, -0.5);
  const seen = new Set<string>();
  let maximumLengthError = 0;
  let minimumRadius = Infinity;
  let maximumRadius = 0;
  for (let i = 0; i < 10000; i++) {
    p = advance(
      p,
      {
        x: Math.sin(i * 0.003) + 0.2,
        y: Math.cos(i * 0.007),
        z: Math.sin(i * 0.011),
      },
      0.012,
    );
    const t = terrain(p);
    maximumLengthError = Math.max(
      maximumLengthError,
      Math.abs(Math.hypot(p.x, p.y, p.z) - 1),
    );
    minimumRadius = Math.min(minimumRadius, t.radius);
    maximumRadius = Math.max(maximumRadius, t.radius);
    seen.add(terrain(normal(Math.asin(rand() * 2 - 1), rand() * 6.28)).region);
  }
  expect(maximumLengthError).toBeLessThan(1e-10);
  expect(minimumRadius).toBeGreaterThanOrEqual(6);
  expect(maximumRadius).toBeLessThan(6.4);
  expect([...seen].sort()).toEqual(['desert', 'forest', 'ocean', 'snow']);
  for (const [name, r] of Object.entries(REGIONS))
    expect(terrain(normal(r.lat, r.lon)).region).toBe(name);
});
test('starts a real 3D game without runtime errors or failed assets', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await ready(page);
  await page.waitForTimeout(1000);
  await expect(page.locator('canvas')).toBeVisible();
  const before = await snapshot(page);
  await page.waitForTimeout(1000);
  const after = await snapshot(page);
  expect(after.frameCount - before.frameCount).toBeGreaterThan(20);
  expect(after.drawCalls).toBeLessThan(130);
  expect(errors).toEqual([]);
});
test('keyboard walking naturally enters water, swims, and returns to land', async ({
  page,
}) => {
  await ready(page);
  await page.locator('.world-canvas').focus();
  const start = await snapshot(page);
  await hold(page, 'ArrowDown', 3500);
  const water = await snapshot(page);
  expect(dist(start.position, water.position)).toBeGreaterThan(0.3);
  expect(water.swimming).toBe(true);
  expect(water.radius).toBe(6);
  await hold(page, 'ArrowUp', 4000);
  expect((await snapshot(page)).swimming).toBe(false);
  expect((await snapshot(page)).moving).toBe(false);
});
test('all regions travel correctly and optional treasures collect once', async ({
  page,
}) => {
  await ready(page);
  for (const r of ['Forest', 'Desert', 'Ocean', 'Snow']) {
    await page
      .getByRole('button', { name: `Explore ${r}`, exact: true })
      .click();
    await expect
      .poll(async () => (await snapshot(page)).region)
      .toBe(r.toLowerCase());
  }
  expect((await snapshot(page)).visited).toHaveLength(4);
  await page
    .getByRole('button', { name: 'Explore Ocean', exact: true })
    .click();
  await page.waitForTimeout(1000);
  await hold(page, 'ArrowRight', 750);
  expect((await snapshot(page)).stars).toBe(1);
  await hold(page, 'ArrowLeft', 750);
  await hold(page, 'ArrowRight', 750);
  expect((await snapshot(page)).stars).toBe(1);
});
test('zoom buttons and wheel clamp safely, and home restores the overview', async ({
  page,
}) => {
  await ready(page);
  const start = await snapshot(page);
  for (let i = 0; i < 6; i++)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Zoom in', exact: true }),
  ).toBeDisabled();
  await page.waitForTimeout(1000);
  expect((await snapshot(page)).cameraDistance).toBeLessThan(
    start.cameraDistance - 10,
  );
  await expect(page.locator('.player-label')).toBeVisible();
  const explorerLabel = await page.locator('.player-label').boundingBox();
  expect(explorerLabel!.y).toBeGreaterThan(100);
  expect(explorerLabel!.y).toBeLessThan(800);
  await page
    .getByRole('button', { name: 'Find my explorer', exact: true })
    .click();
  expect((await snapshot(page)).zoom).toBe(35);
  await page.mouse.move(700, 550);
  await page.mouse.wheel(0, 1600);
  expect((await snapshot(page)).zoom).toBe(0);
  await expect(
    page.getByRole('button', { name: 'Zoom out', exact: true }),
  ).toBeDisabled();
});
test('click to walk arrives; dragging looks around without walking', async ({
  page,
}) => {
  await ready(page);
  await page.waitForTimeout(700);
  await page.mouse.click(840, 410);
  expect((await snapshot(page)).target).not.toBeNull();
  const start = await snapshot(page);
  await expect
    .poll(async () => (await snapshot(page)).target, { timeout: 12000 })
    .toBeNull();
  expect(dist(start.position, (await snapshot(page)).position)).toBeGreaterThan(
    0.05,
  );
  const before = await snapshot(page);
  await page.mouse.move(730, 490);
  await page.mouse.down();
  await page.mouse.move(900, 550, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  expect(dist(before.position, (await snapshot(page)).position)).toBeLessThan(
    0.001,
  );
  expect((await snapshot(page)).target).toBeNull();
});
test('hopping animates, sound toggles, and help pauses and clears held movement', async ({
  page,
}) => {
  await ready(page);
  await page.getByRole('button', { name: 'Hop', exact: true }).click();
  await page.waitForTimeout(180);
  expect((await snapshot(page)).jumpHeight).toBeGreaterThan(0.15);
  await page.waitForTimeout(850);
  expect((await snapshot(page)).jumpHeight).toBe(0);
  await page
    .getByRole('button', { name: 'Turn sound on', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Turn sound off', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('button', { name: 'Turn sound off', exact: true })
    .click();
  await page.keyboard.down('w');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await page.waitForTimeout(100);
  const before = await snapshot(page);
  await page.waitForTimeout(500);
  expect(dist(before.position, (await snapshot(page)).position)).toBeLessThan(
    0.001,
  );
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.waitForTimeout(150);
  expect((await snapshot(page)).moving).toBe(false);
});
test('losing focus stops movement, and the game survives repeated region changes', async ({
  page,
}) => {
  await ready(page);
  await page.keyboard.down('d');
  await page.waitForTimeout(150);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.keyboard.up('d');
  await page.waitForTimeout(100);
  const p = (await snapshot(page)).position;
  await page.waitForTimeout(300);
  expect(dist(p, (await snapshot(page)).position)).toBeLessThan(0.001);
  for (let i = 0; i < 4; i++)
    for (const r of ['Desert', 'Snow', 'Ocean', 'Forest'])
      await page
        .getByRole('button', { name: `Explore ${r}`, exact: true })
        .click();
  expect((await snapshot(page)).ready).toBe(true);
  await expect(page.locator('canvas')).toHaveCount(1);
});
test('phone and tablet layouts fit; touch controls release without sticking', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const before = await snapshot(page);
  const b = await page
    .getByRole('button', { name: 'Move right', exact: true })
    .boundingBox();
  expect(b).not.toBeNull();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const after = await snapshot(page);
  expect(dist(before.position, after.position)).toBeGreaterThan(0.05);
  expect(after.moving).toBe(false);
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [844, 390],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Explore Ocean', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Zoom in', exact: true }),
    ).toBeVisible();
  }
});
test('WebMCP contract shares game state and rejects invalid destinations', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__registered = {};
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool(tool: { name: string }, options: { signal: AbortSignal }) {
          window.__registered[tool.name] =
            tool as unknown as (typeof window.__registered)[string];
          options.signal.addEventListener(
            'abort',
            () => delete window.__registered[tool.name],
          );
        },
      },
    });
  });
  await ready(page);
  expect(
    await page.evaluate(() => Object.keys(window.__registered).sort()),
  ).toEqual(['get_exploration_state', 'travel_to_region']);
  const result = await page.evaluate(() =>
    window.__registered.travel_to_region.execute({ region: 'ocean' }),
  );
  expect(result).toEqual({ region: 'ocean', swimming: true });
  expect((await snapshot(page)).swimming).toBe(true);
  expect(
    await page.evaluate(async () => {
      try {
        await window.__registered.travel_to_region.execute({
          region: 'volcano',
        });
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
  expect((await snapshot(page)).region).toBe('ocean');
});
test('two-finger pinch zooms without sending the explorer walking', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  const before = await snapshot(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 145, y: 420, id: 0 },
      { x: 245, y: 420, id: 1 },
    ],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 110, y: 420, id: 0 },
      { x: 280, y: 420, id: 1 },
    ],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.waitForTimeout(200);
  const after = await snapshot(page);
  expect(after.zoom).toBeGreaterThan(before.zoom);
  expect(after.target).toBeNull();
  expect(dist(before.position, after.position)).toBeLessThan(0.001);
});
