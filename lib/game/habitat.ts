import { terrain, type Point } from './world';
// Keep the full animal body comfortably back from the shoreline.
export const ANIMAL_SHORE_MARGIN = 0.05;
export function animalHabitat(home: Point) {
  const land = terrain(home).land;
  return (point: Point) => {
    const t = terrain(point);
    return (
      land >= 0 &&
      t.land === land &&
      t.region !== 'ocean' &&
      t.edge >= ANIMAL_SHORE_MARGIN
    );
  };
}
