# Mini World

A gentle, browser-based 3D exploration game for a young child. The continuous spherical planet has forests, deserts, oceans and a snowy region, with a little explorer, friendly animals and 12 optional stars. There are no enemies, lives, timers, purchases, accounts inside the game, or outgoing data requests. Progress lasts for the current play session.

## Play

- Arrow keys or W A S D: walk; swimming starts automatically in water.
- Click or tap the planet: walk to that spot.
- Drag: turn the view. Scroll, pinch or use + / −: zoom.
- Space or the sparkle button: hop or splash.
- Region buttons: travel directly to a biome. Crosshair: find the explorer and restore the overview.
- Sound starts off. Enable it for quiet, synthesized chimes.
- Opening help pauses play. Losing focus clears movement.

The game requires a modern browser with WebGL 2 and hardware acceleration. All models, geometry and sounds are generated locally; no image downloads are required. Sites manages private access to the published page.

## Develop

```sh
npm install
npm run dev
```

## Verify

```sh
npm run typecheck
npm run lint
npx playwright install chromium
npm test
npm run build
```

The browser suite covers spherical terrain invariants over 10,000 steps, startup and assets, walking across a shoreline and back, swimming, four-region travel, collection and duplicate prevention, zoom limits, click-to-walk, drag, hopping, sound controls, pause and focus loss, repeated travel, phone/tablet/landscape layouts, touch release, pinch zoom, and the WebMCP contract.

On macOS the Playwright configuration selects the Metal graphics backend; software-only Chromium renders this 3D workload too slowly for timing-based movement tests. To use an existing Chromium executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. To test a production build, serve `dist/client` locally and set `GAME_TEST_URL` to that server.

Lint targets app-owned code; the unmodified Shadcn catalog has upstream lint findings and is outside this check. WebMCP registration is feature-detected and optional. Its contract is covered by a compatible registry test double and was also verified with native WebMCP in the Codex browser, including a valid trip, state readback, and rejection of an invalid region. Native WebMCP support is not required to play.

## Structure

- `lib/game/world.ts`: deterministic terrain and spherical movement.
- `lib/game/scene.ts`: Three.js renderer, procedural models, camera, input, swimming and collection.
- `lib/game/webmcp.ts`: optional read-state and travel tools, sharing visible game actions.
- `app/page.tsx`: responsive game interface and accessible help dialog.
- `app/globals.css`: game styling and responsive layouts.

`npm run build` produces a static site in `dist/client`. Only that public output is packaged for hosting; the server build intermediates and build-tool dependencies are not deployed. The scaffold currently has npm audit advisories in build/server tooling, including unused server-function and image-parser dependencies; these are not present as running server endpoints in this static deployment.
