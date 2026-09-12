export type Region = 'forest' | 'desert' | 'ocean' | 'snow';
export type Point = { x: number; y: number; z: number };
export const RADIUS = 6;
export const REGIONS = {
  forest: {
    name: 'Whispering Woods',
    short: 'Forest',
    note: 'Tall trees & tiny friends',
    color: '#348861',
    lat: 0.43,
    lon: -0.53,
  },
  desert: {
    name: 'Sunshine Sands',
    short: 'Desert',
    note: 'Warm sand & happy cacti',
    color: '#c28b39',
    lat: 0.22,
    lon: 0.72,
  },
  ocean: {
    name: 'Blueberry Bay',
    short: 'Ocean',
    note: 'Make a little splash!',
    color: '#328bc2',
    lat: -0.35,
    lon: 0.02,
  },
  snow: {
    name: 'Snowflake Peaks',
    short: 'Snow',
    note: 'Snowy hills & penguin pals',
    color: '#758cbb',
    lat: 0.85,
    lon: 2.6,
  },
} as const;
export function normal(lat: number, lon: number): Point {
  return {
    x: Math.cos(lat) * Math.sin(lon),
    y: Math.sin(lat),
    z: Math.cos(lat) * Math.cos(lon),
  };
}
export function normalize(p: Point): Point {
  const l = Math.hypot(p.x, p.y, p.z) || 1;
  return { x: p.x / l, y: p.y / l, z: p.z / l };
}
export function angularDistance(a: Point, b: Point) {
  return Math.acos(
    Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)),
  );
}
const lands = [
  { region: 'forest' as Region, center: normal(0.43, -0.53), size: 0.86 },
  { region: 'desert' as Region, center: normal(0.22, 0.85), size: 0.71 },
  { region: 'snow' as Region, center: normal(0.85, 2.6), size: 0.72 },
  { region: 'forest' as Region, center: normal(-0.5, -2.0), size: 0.77 },
  { region: 'desert' as Region, center: normal(-0.7, 2.0), size: 0.55 },
];
export function terrain(p: Point) {
  const n = normalize(p);
  const ripple =
    0.033 * Math.sin(n.x * 19 + n.z * 11) * Math.cos(n.y * 21) +
    0.023 * Math.sin(n.z * 27 + n.y * 12);
  let edge = -10,
    region: Region = 'ocean',
    landIndex = -1;
  for (const [index, land] of lands.entries()) {
    const e = land.size - angularDistance(n, land.center) + ripple;
    if (e > edge) {
      edge = e;
      region = land.region;
      landIndex = index;
    }
  }
  if (edge < 0)
    return {
      region: 'ocean' as Region,
      land: -1,
      radius: RADIUS,
      shore: false,
      edge,
    };
  const height =
    0.075 +
    Math.min(0.19, edge * 0.9) +
    0.045 * Math.sin(n.x * 20) * Math.cos(n.y * 18) * Math.min(1, edge * 12);
  return {
    region,
    land: landIndex,
    radius: RADIUS + height,
    shore: edge < 0.08,
    edge,
  };
}
export function advance(p: Point, direction: Point, distance: number): Point {
  const dot = p.x * direction.x + p.y * direction.y + p.z * direction.z;
  const tangent = normalize({
    x: direction.x - p.x * dot,
    y: direction.y - p.y * dot,
    z: direction.z - p.z * dot,
  });
  return normalize({
    x: p.x * Math.cos(distance) + tangent.x * Math.sin(distance),
    y: p.y * Math.cos(distance) + tangent.y * Math.sin(distance),
    z: p.z * Math.cos(distance) + tangent.z * Math.sin(distance),
  });
}
export function seededRandom(seed = 42) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
