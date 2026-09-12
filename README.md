# Mini World

A gentle, browser-based 3D exploration game for a young child. The continuous spherical planet has forests, deserts, oceans and a snowy region, with four little friends, a village of furnished houses, friendly animals and 12 optional shape treasures. There are no enemies, lives, timers, purchases, accounts inside the game, or outgoing data requests. Progress lasts for the current play session.

## Install and play

Requires **Node.js 22.13 or newer** (Node 22 LTS recommended), npm, Git, and a modern browser with WebGL 2 / hardware acceleration.

```sh
git clone https://github.com/weijianzhg/mini-world.git
cd mini-world
npm ci
npm run dev
```

Open **http://localhost:3000**. No API keys, accounts, environment variables, or paid services are needed. Keep the terminal open; press Ctrl+C to stop.

To play a built version:

```sh
npm run build
npm start
```

Open **http://localhost:3000**. If that port is busy, use `npm start -- --port 3001`. The preview serves only the static game, bound to your own computer by default. To share on your local network, use `npm start -- --host 0.0.0.0` and open your computer's LAN address on the other device.

## Controls

- Arrow keys or W A S D: walk; swimming starts automatically in water.
- Click a person or their portrait button to choose Sunny, Rosie, Skye or Pip. Each friend keeps walking when you select someone else.
- Click or tap the planet: walk to that spot, finding a path around trees and houses.
- Click a house: walk to its door and go inside. The roof opens to reveal the room. Click outside or use Come outside to leave.
- Inside a house, click its bed or Use bed to lie down. Wake up gets the friend out of bed; Come outside also wakes them and exits. One friend can use each bed at a time, and sleeping continues when you select another friend.
- Click a table or Use table to sit down. Drink water lifts the refillable bottle for a sip, and Stand up leaves the chair. The bed and table each have room for one friend.
- Rabbits hop, sheep walk, penguins waddle, and friendly desert snakes slither. Two little dogs and two cats live near the village; their legs and tails animate when you move them. Animals stand still until directed. Hover over a person or animal, click to select them, then click the ground to move them. Arrow keys also control the selected animal. Animals stay on dry land in their home region; routes avoid rivers, shorelines, trees and houses. Choose a person to travel between regions or swim. Help pauses them too.
- Click an animal home, or select its animal and choose Go home & rest. Rabbits have burrows, snakes have holes, sheep have straw shelters, dogs have kennels, cats have baskets, and penguins have pebble nests. Covers open while animals sleep; Wake up & come outside brings them out. Each animal has its own bed and keeps resting when you switch friends.
- The Forest Lookout has two furnished floors. Click the staircase or Go upstairs / Go downstairs to change floors. Each friend keeps their own floor; Come outside automatically takes the stairs down before exiting.
- Buildings suit their surroundings: timber woodland homes, a shaded Sunshine Courtyard, a Sphinx Sanctuary in the desert, and a snow-covered lodge.
- Trees and walls are solid. Keyboard movement stops at them; mouse routes go around.
- Drag: turn the view. Scroll, pinch or use + / −: zoom.
- Space or the sparkle button: hop or splash.
- Region buttons: travel directly to a biome. Crosshair: find the explorer and restore the overview.
- Collect two each of stars, circles, rectangles, diamonds, triangles and hexagons. The collection shelf tracks each shape, and pickups have a brief pop animation.
- Sound starts off. Enable it for quiet, synthesized chimes.
- Opening help pauses play. Losing focus releases held movement keys.

The game requires a modern browser with WebGL 2 and hardware acceleration. All models, geometry and sounds are generated locally; no image downloads are required.

## Development and tests

```sh
npm run typecheck
npm run lint
npm run build
npm run test:server
npx playwright install chromium
npm test
```

`npm test` starts the development server automatically if needed. On Linux, `npx playwright install --with-deps chromium` also installs browser system dependencies. The game tests use real WebGL; hardware acceleration is recommended. GitHub Actions checks clean installation, types, lint, build and the static server on Linux, Windows and macOS. The full interactive browser suite is run locally.

The browser suite covers spherical terrain invariants over 10,000 steps, startup and assets, walking across a shoreline and back, swimming, four-region travel, all six collectible shapes, per-shape counts and duplicate prevention, zoom limits, click-to-walk, drag, hopping, sound controls, pause and focus loss, repeated travel, phone/tablet/landscape layouts, touch release, pinch zoom, the WebMCP contract, independent friends, mouse selection, house entry and exit, clear doorways, bed use and waking in all five homes, bed and table occupancy, bottle drinking, idle animals, selecting and directing every animal type, pause behavior, animal habitat boundaries and water detours, switching friends, and collision-free spherical paths around trees (including the longitude seam).

On macOS the Playwright configuration selects the Metal graphics backend; software-only Chromium renders this 3D workload too slowly for timing-based movement tests. To use an existing Chromium executable, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. To test a production build, serve `dist/client` locally and set `GAME_TEST_URL` to that server.

Lint targets app-owned code; the unmodified Shadcn catalog has upstream lint findings and is outside this check. WebMCP registration is feature-detected and optional. Its contract is covered by a compatible registry test double and was also verified with native WebMCP in the Codex browser, including a valid trip, state readback, and rejection of an invalid region. Native WebMCP support is not required to play.

## Structure

- `lib/game/world.ts`: deterministic terrain and spherical movement.
- `lib/game/navigation.ts`: spherical obstacle detection and A* routes around trees, houses and habitat boundaries.
- `lib/game/habitat.ts`: home-region and shoreline restrictions for animals.
- `lib/game/scene.ts`: Three.js renderer, procedural models, camera, input, swimming and collection.
- `lib/game/webmcp.ts`: optional read-state and travel tools, sharing visible game actions.
- `app/page.tsx`: responsive game interface and accessible help dialog.
- `app/globals.css`: game styling and responsive layouts.

`npm run build` produces a static site in `dist/client`. Only that public output is packaged for hosting; the server build intermediates and build-tool dependencies are not deployed.

## Troubleshooting

- **Blank canvas or a WebGL message:** enable browser hardware acceleration, restart the browser, and try an up-to-date Chrome, Edge, Firefox or Safari. Older GPUs may not support WebGL 2.
- **Install/build fails:** check `node --version` is at least 22.13, then run `npm ci` again. Installing requires internet access; the built game uses local assets.
- **Port already in use:** stop the other server or choose another port with `npm run dev -- --port 3001` / `npm start -- --port 3001`.
- **Progress disappeared:** this is intentional; exploration resets when the page reloads.

## Contributing

Small fixes and improvements are welcome. Open an issue describing the problem, or submit a pull request with the change and relevant checks. Keep controls simple for young children and preserve the no-accounts, no-purchases experience. Run the checks above before submitting.

## License

[MIT](LICENSE). Third-party dependencies retain their own licenses.
