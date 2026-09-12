import type { Game } from './scene';
import { REGIONS, type Region } from './world';
export function registerGameTools(game: Game) {
  const context = (
    document as unknown as {
      modelContext?: {
        registerTool: (
          tool: unknown,
          options: { signal: AbortSignal },
        ) => unknown;
      };
    }
  ).modelContext;
  const lifecycle = new AbortController();
  if (context?.registerTool) {
    const tools = [
      {
        name: 'get_exploration_state',
        title: 'Read Mini World',
        description:
          'Read the current place, swimming state, and collected shapes.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute() {
          const s = game.getState();
          return {
            region: s.region,
            swimming: s.swimming,
            stars: s.stars,
            visited: s.visited,
          };
        },
      },
      {
        name: 'travel_to_region',
        title: 'Explore a place',
        description:
          'Move the explorer to a forest, desert, ocean, or snowy region, using the same action as the region buttons.',
        inputSchema: {
          type: 'object',
          properties: {
            region: { type: 'string', enum: Object.keys(REGIONS) },
          },
          required: ['region'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input: unknown) {
          if (
            !input ||
            typeof input !== 'object' ||
            !('region' in input) ||
            typeof input.region !== 'string' ||
            !Object.hasOwn(REGIONS, input.region)
          )
            throw new Error('Choose forest, desert, ocean, or snow.');
          game.goTo(input.region as Region);
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          const s = game.getState();
          return { region: s.region, swimming: s.swimming };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* The game also works without WebMCP. */
      }
    }
  }
  return () => lifecycle.abort();
}
