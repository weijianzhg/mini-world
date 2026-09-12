import { animalHabitat } from './habitat';
import { Navigator, type Obstacle } from './navigation';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  RADIUS,
  REGIONS,
  normal,
  terrain,
  advance,
  angularDistance,
  seededRandom,
  type Region,
  type Point,
} from './world';

export const FRIENDS = [
  { id: 'sunny', name: 'Sunny', color: '#edb442', lat: 0.25, lon: -0.25 },
  { id: 'rosie', name: 'Rosie', color: '#e88999', lat: 0.2, lon: -0.45 },
  { id: 'skye', name: 'Skye', color: '#629fcd', lat: 0.1, lon: -0.28 },
  { id: 'pip', name: 'Pip', color: '#85ab68', lat: 0.17, lon: -0.08 },
] as const;
export type ResidentState = {
  id: string;
  name: string;
  color: string;
  position: Point;
  moving: boolean;
  insideHouse: string | null;
  phase: string;
  floor: number;
};
export type GameState = {
  selectedPerson: string;
  selectedAnimal: string | null;
  animalRest: { name: string; homeName: string; phase: string } | null;
  floor: number;
  floorCount: number;
  changingFloor: boolean;
  people: ResidentState[];
  insideHouse: string | null;
  region: Region;
  swimming: boolean;
  stars: number;
  treasures: { kind: string; color: string; found: number; total: number }[];
  visited: Region[];
  moving: boolean;
  zoom: number;
  ready: boolean;
};
export type Game = {
  selectPerson: (id: string) => void;
  selectAnimal: (id: string) => void;
  restAnimal: () => void;
  wakeAnimal: () => void;
  walkTo: (point: Point) => void;
  enterHouse: (id: string) => void;
  leaveHouse: () => void;
  changeFloor: (floor: number) => void;
  useBed: () => void;
  wakeUp: () => void;
  useTable: () => void;
  standUp: () => void;
  drinkWater: () => void;
  goTo: (region: Region) => void;
  zoomBy: (amount: number) => void;
  home: () => void;
  jump: () => void;
  setDirection: (key: string, pressed: boolean) => void;
  setPaused: (paused: boolean) => void;
  setSound: (enabled: boolean) => void;
  getState: () => Omit<GameState, 'people'> & {
    position: Point;
    radius: number;
    target: Point | null;
    frameCount: number;
    drawCalls: number;
    jumpHeight: number;
    cameraDistance: number;
    houses: {
      id: string;
      name: string;
      size: string;
      style: string;
      floorCount: number;
      stairsScreen: { x: number; y: number; visible: boolean };
      bottleLift: number;
      tableScreen: { x: number; y: number; visible: boolean };
      bedScreen: { x: number; y: number; visible: boolean };
      position: Point;
      door: Point;
      inside: Point;
      screen: { x: number; y: number; visible: boolean };
    }[];
    collectibles: { kind: string; position: Point; found: boolean }[];
    animalHomes: {
      animalId: string;
      name: string;
      position: Point;
      screen: { x: number; y: number; visible: boolean };
      open: boolean;
    }[];
    animals: {
      id: string;
      name: string;
      screen: { x: number; y: number; visible: boolean };
      route: Point[];
      kind: string;
      restPhase: string;
      position: Point;
      home: Point;
      moving: boolean;
      hop: number;
    }[];
    obstacles: Obstacle[];
    people: (ResidentState & {
      screen: { x: number; y: number; visible: boolean };
      route: Point[];
    })[];
  };
  dispose: () => void;
};
export function createGame(
  host: HTMLElement,
  label: HTMLElement,
  onState: (state: GameState) => void,
  onMessage: (text: string) => void,
): Game {
  const rand = seededRandom(73),
    scene = new THREE.Scene(),
    world = new THREE.Group();
  scene.add(world);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute(
    'aria-label',
    '3D Mini World. Tap the planet to walk, drag to look around, or use the arrow keys.',
  );
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 150);
  scene.add(new THREE.HemisphereLight(0xf0fbff, 0x5891a0, 2.4));
  const sun = new THREE.DirectionalLight(0xfff0c9, 3.4);
  sun.position.set(-12, 18, 15);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc5e8ff, 1.2);
  fill.position.set(10, 0, -8);
  scene.add(fill);
  const mats = new Map<string, THREE.MeshStandardMaterial>();
  function material(color: string) {
    if (!mats.has(color))
      mats.set(
        color,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.72,
          metalness: 0,
        }),
      );
    return mats.get(color)!;
  }
  const sphereGeo = new THREE.SphereGeometry(1, 20, 14),
    coneGeo = new THREE.ConeGeometry(1, 1, 10),
    cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 12),
    boxGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.07);
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    color: string,
    p: number[],
    s: number[],
  ) {
    const o = new THREE.Mesh(geometry, material(color));
    o.position.set(p[0], p[1], p[2]);
    o.scale.set(s[0], s[1], s[2]);
    parent.add(o);
    return o;
  }
  function ball(
    parent: THREE.Object3D,
    color: string,
    p: number[],
    s: number[],
  ) {
    return mesh(parent, sphereGeo, color, p, s);
  }
  function stick(
    parent: THREE.Object3D,
    color: string,
    p: number[],
    s: number[],
  ) {
    return mesh(parent, cylinderGeo, color, p, s);
  }
  function box(
    parent: THREE.Object3D,
    color: string,
    p: number[],
    s: number[],
  ) {
    return mesh(parent, boxGeo, color, p, s);
  }
  const up = new THREE.Vector3(0, 1, 0);
  function at(n: Point, r = terrain(n).radius) {
    const g = new THREE.Group();
    g.position.set(n.x * r, n.y * r, n.z * r);
    g.quaternion.setFromUnitVectors(up, new THREE.Vector3(n.x, n.y, n.z));
    world.add(g);
    return g;
  }
  // One continuous, colored sphere: terrain, swimming and taps share this exact surface.
  const ground = new THREE.SphereGeometry(RADIUS, 160, 104).toNonIndexed(),
    pos = ground.attributes.position;
  const colors = new Float32Array(pos.count * 3),
    col = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const mid = new THREE.Vector3();
    for (let k = 0; k < 3; k++)
      mid.add(new THREE.Vector3().fromBufferAttribute(pos, i + k));
    mid.normalize();
    // Keep the seeded layout stable while replacing per-triangle noise with continuous color.
    rand();
    for (let k = 0; k < 3; k++) {
      const n = new THREE.Vector3().fromBufferAttribute(pos, i + k).normalize();
      const land = terrain(n);
      const height = land.radius;
      pos.setXYZ(i + k, n.x * height, n.y * height, n.z * height);
      if (land.region === 'ocean') {
        col
          .set('#269ebd')
          .lerp(
            new THREE.Color('#79d5d5'),
            THREE.MathUtils.smoothstep(land.edge, -0.23, 0),
          );
      } else {
        const inland =
          land.region === 'forest'
            ? '#7fb65e'
            : land.region === 'desert'
              ? '#e7bd72'
              : '#e5f0f4';
        col
          .set('#f3dfa6')
          .lerp(
            new THREE.Color(inland),
            THREE.MathUtils.smoothstep(land.edge, 0, 0.13),
          );
      }
      col.multiplyScalar(
        0.98 + 0.025 * Math.sin(n.x * 13 + n.y * 7) * Math.cos(n.z * 11),
      );
      colors.set([col.r, col.g, col.b], (i + k) * 3);
    }
  }
  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Shared radial normals remove visible triangle seams from the little planet.
  const normals = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const n = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    normals.set([n.x, n.y, n.z], i * 3);
  }
  ground.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  const earth = new THREE.Mesh(
    ground,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      flatShading: false,
    }),
  );
  world.add(earth);
  // Soft horizon glow, rendered behind the solid world.
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(6.13, 64, 48),
    new THREE.MeshBasicMaterial({
      color: 0xbceff6,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  world.add(glow);
  const obstacles: Obstacle[] = [];
  const homeSpecs = [
    {
      id: 'little-cottage',
      name: 'Woodland Cottage',
      style: 'woodland',
      size: 'small',
      lat: 0.65,
      lon: -0.68,
      scale: 1,
      color: '#edc783',
      roof: '#cd7968',
    },
    {
      id: 'big-house',
      name: 'Sunshine Courtyard',
      style: 'sunshine',
      size: 'big',
      lat: 0.62,
      lon: 0.2,
      scale: 1.6,
      color: '#fff1d3',
      roof: '#698ea9',
    },
    {
      id: 'tall-house',
      name: 'Forest Lookout',
      style: 'woodland',
      size: 'tall',
      lat: 0.87,
      lon: -0.35,
      scale: 1.1,
      color: '#c39a70',
      roof: '#527e62',
    },
    {
      id: 'desert-home',
      name: 'Sphinx Sanctuary',
      style: 'sphinx',
      size: 'small',
      lat: 0.45,
      lon: 1.05,
      scale: 1,
      color: '#efd09b',
      roof: '#bc865c',
    },
    {
      id: 'snow-home',
      name: 'Snowy Lodge',
      style: 'snow',
      size: 'big',
      lat: 0.9,
      lon: 2.95,
      scale: 1.4,
      color: '#977452',
      roof: '#75978e',
    },
  ];
  const staticRoot = new THREE.Group();
  world.add(staticRoot);
  function keepStatic(g: THREE.Group) {
    world.remove(g);
    staticRoot.add(g);
  }
  function tree(n: Point, scale: number, pine: boolean, snowy = false) {
    obstacles.push({
      id: `tree-${obstacles.length}`,
      center: { ...n },
      radius: (0.22 * scale + 0.22) / 6,
      kind: 'tree',
    });
    const g = at(n);
    g.scale.setScalar(scale);
    g.rotateY(rand() * 6.28);
    stick(g, '#9b7450', [0, 0.38, 0], [0.095, 0.77, 0.095]);
    if (pine) {
      for (let j = 0; j < 3; j++)
        mesh(
          g,
          coneGeo,
          ['#397c58', '#448b5c', '#599968'][j],
          [0, 0.74 + j * 0.28, 0],
          [0.46 - j * 0.08, 0.76, 0.46 - j * 0.08],
        );
      if (snowy)
        for (let j = 0; j < 3; j++)
          mesh(
            g,
            coneGeo,
            '#f3f7ed',
            [0, 0.95 + j * 0.28, 0],
            [0.27 - j * 0.055, 0.38, 0.27 - j * 0.055],
          );
    } else {
      ball(g, '#55995d', [0, 0.92, 0], [0.45, 0.51, 0.42]);
      ball(g, '#70ae65', [-0.21, 0.89, 0.06], [0.29, 0.35, 0.32]);
      ball(g, '#81b971', [0.16, 1.08, 0.03], [0.31, 0.35, 0.31]);
    }
    keepStatic(g);
  }
  function cactus(n: Point, scale: number) {
    const g = at(n);
    g.scale.setScalar(scale);
    g.rotateY(rand() * 6.28);
    stick(g, '#76a96e', [0, 0.4, 0], [0.13, 0.75, 0.13]);
    ball(g, '#76a96e', [0, 0.78, 0], [0.13, 0.14, 0.13]);
    stick(g, '#79ad70', [-0.2, 0.35, 0], [0.08, 0.39, 0.08]).rotation.z =
      Math.PI / 2;
    stick(g, '#79ad70', [-0.36, 0.5, 0], [0.08, 0.32, 0.08]);
    ball(g, '#79ad70', [-0.36, 0.67, 0], [0.08, 0.08, 0.08]);
    stick(g, '#89b67a', [0.19, 0.49, 0], [0.07, 0.29, 0.07]).rotation.z =
      Math.PI / 2;
    stick(g, '#89b67a', [0.31, 0.6, 0], [0.075, 0.22, 0.075]);
    ball(g, '#edaa93', [0, 0.95, 0], [0.07, 0.08, 0.07]);
    keepStatic(g);
  }
  function rock(n: Point, s: number, snow: boolean) {
    const g = at(n);
    ball(
      g,
      snow ? '#b1c4cc' : '#d4ad76',
      [0, s * 0.22, 0],
      [s * 0.44, s * 0.32, s * 0.37],
    );
    if (snow)
      ball(g, '#fcfcf4', [0, s * 0.38, 0], [s * 0.35, s * 0.17, s * 0.3]);
    keepStatic(g);
  }
  const animalGroups: {
    id: string;
    name: string;
    route: Point[];
    jumpTime: number;
    restPhase: 'outside' | 'going-home' | 'sleeping';
    group: THREE.Group;
    root: THREE.Group;
    phase: number;
    kind: string;
    normal: THREE.Vector3;
    home: THREE.Vector3;
    heading: number;
    moving: boolean;
    legs: THREE.Mesh[];
    tail: THREE.Group | null;
    segments: THREE.Object3D[];
  }[] = [];
  function animal(n: Point, kind: string) {
    const g = at(n);
    g.rotateY(rand() * 6.28);
    const a = new THREE.Group();
    g.add(a);
    const legs: THREE.Mesh[] = [],
      segments: THREE.Object3D[] = [];
    let tail: THREE.Group | null = null;
    if (kind === 'penguin') {
      ball(a, '#435b70', [0, 0.22, 0], [0.16, 0.24, 0.14]);
      ball(a, '#f8f4df', [0, 0.19, 0.095], [0.115, 0.17, 0.06]);
      ball(a, '#435b70', [0, 0.44, 0], [0.135, 0.13, 0.125]);
      ball(a, '#fff9e6', [-0.055, 0.46, 0.1], [0.047, 0.048, 0.029]);
      ball(a, '#fff9e6', [0.055, 0.46, 0.1], [0.047, 0.048, 0.029]);
      ball(a, '#273c4e', [-0.055, 0.465, 0.126], [0.014, 0.02, 0.014]);
      ball(a, '#273c4e', [0.055, 0.465, 0.126], [0.014, 0.02, 0.014]);
      mesh(
        a,
        coneGeo,
        '#eab65b',
        [0, 0.409, 0.16],
        [0.048, 0.12, 0.06],
      ).rotation.x = Math.PI / 2;
      ball(a, '#eab65b', [-0.1, 0.025, 0.06], [0.09, 0.03, 0.12]);
      ball(a, '#eab65b', [0.1, 0.025, 0.06], [0.09, 0.03, 0.12]);
    } else if (kind === 'snake') {
      for (let i = 0; i < 8; i++) {
        const segment = new THREE.Group();
        segment.position.set(0, 0.07, 0.28 - i * 0.075);
        a.add(segment);
        ball(
          segment,
          i % 2 ? '#85b75b' : '#659747',
          [0, 0, 0],
          [0.075 - i * 0.006, 0.065 - i * 0.005, 0.085],
        );
        if (i === 0)
          for (const x of [-0.035, 0.035])
            ball(segment, '#263b34', [x, 0.041, 0.063], [0.014, 0.017, 0.013]);
        combineVisual(segment);
        segments.push(segment);
      }
    } else if (kind === 'dog' || kind === 'cat') {
      const cat = kind === 'cat';
      const variant = animalGroups.filter((a) => a.kind === kind).length % 2;
      const fur = cat
        ? variant
          ? '#94a5ad'
          : '#dc9a55'
        : variant
          ? '#f2dfb8'
          : '#c49460';
      const dark = cat ? (variant ? '#637783' : '#a66c36') : '#88613f';
      ball(a, fur, [0, 0.22, 0], [0.16, 0.15, 0.25]);
      ball(a, fur, [0, 0.37, 0.2], [0.15, 0.15, 0.14]);
      ball(
        a,
        cat ? '#fff0d2' : '#e9c99b',
        [0, 0.32, 0.32],
        [0.105, 0.07, 0.075],
      );
      ball(
        a,
        cat ? '#cb8b8e' : '#343b3d',
        [0, 0.35, 0.383],
        [0.032, 0.026, 0.022],
      );
      for (const x of [-0.062, 0.062]) {
        ball(a, '#263b37', [x, 0.406, 0.322], [0.021, 0.027, 0.017]);
        ball(a, '#ffffff', [x - 0.005, 0.414, 0.335], [0.006, 0.007, 0.004]);
        if (cat) {
          mesh(a, coneGeo, fur, [x * 1.6, 0.535, 0.19], [0.085, 0.18, 0.065]);
          mesh(
            a,
            coneGeo,
            '#e0aa9e',
            [x * 1.6, 0.535, 0.226],
            [0.041, 0.1, 0.012],
          );
          for (const y of [0.317, 0.34])
            box(a, '#efe4cf', [x * 1.95, y, 0.37], [0.13, 0.008, 0.009]);
        } else ball(a, dark, [x * 2.45, 0.345, 0.15], [0.066, 0.17, 0.082]);
      }
      for (const x of [-0.105, 0.105])
        for (const z of [-0.15, 0.14])
          legs.push(stick(a, fur, [x, 0.09, z], [0.045, 0.18, 0.045]));
      // A bright collar and tag make the little pets easy to spot.
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.13, 0.022, 6, 20),
        material(cat ? '#d88c96' : '#519f9a'),
      );
      collar.position.set(0, 0.29, 0.17);
      collar.rotation.x = Math.PI / 2;
      a.add(collar);
      ball(a, '#ffda6e', [0, 0.266, 0.295], [0.027, 0.032, 0.012]);
      if (cat)
        for (const z of [-0.12, 0, 0.1])
          box(a, dark, [0, 0.363, z], [0.16, 0.018, 0.026]);
      else ball(a, dark, [0.135, 0.255, -0.07], [0.026, 0.085, 0.09]);
      tail = new THREE.Group();
      tail.position.set(0, 0.25, -0.22);
      a.add(tail);
      const curve = new THREE.CatmullRomCurve3(
        cat
          ? [
              new THREE.Vector3(),
              new THREE.Vector3(0.02, 0.16, -0.07),
              new THREE.Vector3(0.03, 0.34, -0.08),
              new THREE.Vector3(0.11, 0.36, -0.05),
            ]
          : [
              new THREE.Vector3(),
              new THREE.Vector3(0.03, 0.1, -0.11),
              new THREE.Vector3(0.04, 0.23, -0.15),
            ],
      );
      tail.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(curve, 12, cat ? 0.027 : 0.039, 7, false),
          material(fur),
        ),
      );
      combineVisual(tail);
    } else if (kind === 'bunny') {
      ball(a, '#fff8e6', [0, 0.16, 0], [0.16, 0.19, 0.18]);
      ball(a, '#fff8e6', [0, 0.34, 0.1], [0.13, 0.13, 0.12]);
      for (const x of [-0.065, 0.065]) {
        ball(a, '#fff8e6', [x, 0.53, 0.07], [0.048, 0.16, 0.047]);
        ball(a, '#e6b6a7', [x, 0.54, 0.109], [0.023, 0.1, 0.013]);
        ball(a, '#444d46', [x * 0.8, 0.36, 0.205], [0.017, 0.021, 0.016]);
      }
      ball(a, '#e6b6a7', [0, 0.315, 0.22], [0.026, 0.022, 0.014]);
      ball(a, '#fff8e6', [0, 0.15, -0.2], [0.075, 0.075, 0.07]);
    } else {
      ball(a, '#faf5db', [0, 0.23, 0], [0.27, 0.23, 0.22]);
      for (let j = 0; j < 7; j++) {
        const angle = (j * 6.28) / 7;
        ball(
          a,
          '#fff9e9',
          [
            Math.sin(angle) * 0.18,
            0.3 + Math.cos(angle) * 0.07,
            Math.cos(angle) * 0.14,
          ],
          [0.13, 0.13, 0.13],
        );
      }
      ball(a, '#655c4f', [0, 0.33, 0.25], [0.12, 0.14, 0.12]);
      for (const x of [-0.06, 0.06])
        ball(a, '#191e27', [x, 0.37, 0.35], [0.019, 0.022, 0.017]);
      for (const x of [-0.14, 0.14])
        for (const z of [-0.1, 0.1])
          legs.push(stick(a, '#665e50', [x, 0.06, z], [0.03, 0.16, 0.03]));
    }
    animalGroups.push({
      id: `animal-${animalGroups.length}`,
      name: `${kind === 'bunny' ? 'Bunny' : kind[0].toUpperCase() + kind.slice(1)} ${animalGroups.filter((a) => a.kind === kind).length + 1}`,
      route: [],
      jumpTime: -5,
      restPhase: 'outside',
      group: a,
      root: g,
      phase: rand() * 6.28,
      kind,
      normal: new THREE.Vector3().copy(n),
      home: new THREE.Vector3().copy(n),
      heading: Math.atan2(n.x, n.z),
      moving: false,
      legs,
      tail,
      segments,
    });
    return g;
  }
  // Evenly scatter little landmarks over all sides of the planet.
  for (let i = 0; i < 580; i++) {
    const y = 1 - (2 * (i + 0.5)) / 580,
      lon = i * 2.39996323,
      n = {
        x: Math.sqrt(1 - y * y) * Math.sin(lon),
        y,
        z: Math.sqrt(1 - y * y) * Math.cos(lon),
      };
    const t = terrain(n);
    if (t.edge < 0.11) continue;
    if (
      angularDistance(n, normal(0.45, -0.3)) < 0.53 ||
      homeSpecs.some(
        (h) => angularDistance(n, normal(h.lat, h.lon)) < h.scale * 0.14 + 0.18,
      )
    )
      continue;
    const s = 0.55 + rand() * 0.5;
    if (t.region === 'forest') {
      if (i % 6 === 0) animal(n, i % 12 === 0 ? 'bunny' : 'sheep');
      else if (i % 4 !== 0) tree(n, s, i % 3 !== 0);
      else {
        const g = at(n);
        for (let j = 0; j < 3; j++) {
          const x = (rand() - 0.5) * 0.25,
            z = (rand() - 0.5) * 0.25;
          stick(g, '#659e62', [x, 0.055, z], [0.014, 0.11, 0.014]);
          ball(
            g,
            j % 2 ? '#f6d879' : '#ffeff2',
            [x, 0.13, z],
            [0.045, 0.04, 0.045],
          );
        }
        keepStatic(g);
      }
    }
    if (t.region === 'desert') {
      if (i % 3 === 0) cactus(n, s);
      else if (i % 4 === 0) rock(n, s, false);
      else if (i % 7 === 0) {
        const g = at(n);
        ball(g, '#e5be70', [0, 0.12, 0], [0.49, 0.18, 0.34]);
        keepStatic(g);
      }
    }
    if (t.region === 'snow') {
      if (i % 7 === 0) animal(n, 'penguin');
      else if (i % 3 === 0) {
        tree(n, s, true, true);
      } else if (i % 4 === 0) {
        const g = at(n);
        mesh(g, coneGeo, '#a6bac2', [0, 0.38, 0], [0.5, 0.85, 0.44]);
        mesh(g, coneGeo, '#f9fcf4', [0, 0.66, 0], [0.21, 0.37, 0.185]);
        keepStatic(g);
      }
    }
  }
  animal(normal(0.18, 1.1), 'snake');
  animal(normal(0.37, 0.75), 'snake');
  animal(normal(0.03, -0.42), 'dog');
  animal(normal(0.29, -0.63), 'dog');
  animal(normal(0.06, -0.06), 'cat');
  animal(normal(0.51, -0.13), 'cat');
  // The child's village: a row of trees, friends, and houses of different sizes.
  for (const [lat, lon, scale] of [
    [0.4, -0.48, 0.8],
    [0.4, -0.26, 0.9],
    [0.4, -0.04, 0.8],
    [0.15, -0.69, 0.75],
    [0.74, -0.98, 0.8],
    [0.82, 0.25, 0.8],
  ])
    tree(normal(lat, lon), scale, true);
  const houses = homeSpecs.map((spec) => {
    const center = new THREE.Vector3().copy(normal(spec.lat, spec.lon));
    const root = at(center);
    root.scale.setScalar(spec.scale);
    const height = spec.size === 'tall' ? 1.8 : 1.05;
    const wallColor = spec.color;
    box(root, '#c7b88c', [0, 0.045, 0], [1.05, 0.09, 0.98]);
    const walls = new THREE.Group();
    root.add(walls);
    box(walls, wallColor, [-0.5, height / 2, 0], [0.1, height, 1]);
    box(walls, wallColor, [0.5, height / 2, 0], [0.1, height, 1]);
    box(walls, wallColor, [0, height / 2, -0.48], [1, height, 0.1]);
    box(walls, wallColor, [-0.37, height / 2, 0.48], [0.27, height, 0.1]);
    box(walls, wallColor, [0.37, height / 2, 0.48], [0.27, height, 0.1]);
    box(
      walls,
      wallColor,
      [0, 0.88 + (height - 1.05) / 2, 0.48],
      [0.5, 0.34 + (height - 1.05), 0.1],
    );
    const roof = new THREE.Group();
    root.add(roof);
    if (spec.style === 'sphinx') {
      // A welcoming toy Sphinx: lion paws and sandstone body, with a striped nemes.
      box(roof, '#d6ae68', [0, 1.04, 0], [1.13, 0.18, 1.06]);
      for (const side of [-1, 1]) {
        ball(walls, '#dfbd7b', [side * 0.46, 0.48, -0.13], [0.19, 0.49, 0.43]);
        box(walls, '#e7c787', [side * 0.39, 0.16, 0.63], [0.27, 0.27, 0.45]);
        for (let toe = 0; toe < 3; toe++)
          box(
            walls,
            '#ba9659',
            [side * 0.39 + (toe - 1) * 0.07, 0.17, 0.859],
            [0.013, 0.1, 0.013],
          );
        box(roof, '#d9b570', [side * 0.27, 1.34, 0.22], [0.19, 0.55, 0.27]);
        for (let band = 0; band < 5; band++)
          box(
            roof,
            '#527d94',
            [side * 0.27, 1.12 + band * 0.1, 0.362],
            [0.19, 0.035, 0.02],
          );
      }
      ball(roof, '#e6c17c', [0, 1.48, 0.22], [0.3, 0.35, 0.23]);
      box(roof, '#49788d', [0, 1.69, 0.27], [0.52, 0.075, 0.31]);
      ball(roof, '#eaca87', [0, 1.44, 0.41], [0.19, 0.24, 0.12]);
      for (const x of [-0.082, 0.082])
        box(roof, '#574d3e', [x, 1.51, 0.526], [0.052, 0.023, 0.014]);
      box(roof, '#c39b59', [0, 1.44, 0.546], [0.055, 0.09, 0.06]);
      box(roof, '#997646', [0, 1.36, 0.532], [0.082, 0.015, 0.013]);
      box(roof, '#54798a', [0, 1.22, 0.44], [0.073, 0.19, 0.09]);
      for (let course = 0; course < 4; course++)
        for (const side of [-1, 1])
          box(
            walls,
            '#ceb079',
            [side * 0.555, 0.24 + course * 0.2, -0.05],
            [0.013, 0.015, 0.77],
          );
    } else if (spec.style === 'sunshine') {
      // Pale plaster, a flat terracotta roof and an airy shaded veranda.
      box(roof, '#d18a60', [0, height + 0.055, 0], [1.19, 0.13, 1.12]);
      for (const x of [-0.54, 0.54])
        box(roof, '#f4dfb5', [x, height + 0.17, -0.04], [0.08, 0.22, 1.03]);
      box(roof, '#f4dfb5', [0, height + 0.17, -0.53], [1.16, 0.22, 0.08]);
      for (const x of [-0.45, 0.45])
        stick(walls, '#a87548', [x, 0.42, 0.64], [0.04, 0.82, 0.04]);
      for (let slat = 0; slat < 6; slat++)
        box(
          roof,
          '#ac7b4f',
          [-0.5 + slat * 0.2, 0.88, 0.63],
          [0.055, 0.05, 0.45],
        );
      box(roof, '#d6a974', [0, 0.89, 0.82], [1.1, 0.07, 0.06]);
      for (const x of [-0.43, 0.43]) {
        box(walls, '#549b9c', [x, 0.57, 0.56], [0.13, 0.34, 0.04]);
        ball(walls, '#b56c4f', [x, 0.15, 0.66], [0.085, 0.12, 0.085]);
        ball(walls, '#659961', [x, 0.28, 0.66], [0.12, 0.1, 0.1]);
      }
    } else {
      const roofHeight = spec.style === 'snow' ? 0.82 : 0.57;
      const roofShape = mesh(
        roof,
        new THREE.ConeGeometry(0.87, roofHeight, 4),
        spec.roof,
        [0, height + roofHeight * 0.4, 0],
        [1, 1, 1],
      );
      roofShape.rotation.y = Math.PI / 4;
      if (spec.style === 'snow') {
        const snow = mesh(
          roof,
          new THREE.ConeGeometry(0.9, roofHeight, 4),
          '#f4f9ff',
          [0, height + roofHeight * 0.4 + 0.065, 0],
          [1, 1, 1],
        );
        snow.rotation.y = Math.PI / 4;
        for (const side of [-1, 1])
          for (let course = 0; course < 6; course++)
            box(
              walls,
              course % 2 ? '#a9825c' : '#8d684b',
              [side * 0.52, 0.12 + course * 0.17, 0],
              [0.1, 0.13, 1.02],
            );
        for (const x of [-0.38, 0.38])
          box(walls, '#ffe9ac', [x, 0.55, 0.57], [0.13, 0.2, 0.025]);
      } else {
        // Exposed timber and moss-colored trim tie the forest homes to their trees.
        for (const x of [-0.5, 0.5])
          box(walls, '#73583e', [x, height / 2, 0.55], [0.08, height, 0.09]);
        for (const y of [0.12, 0.82])
          box(walls, '#846447', [0, y, 0.55], [1.05, 0.065, 0.075]);
        for (const x of [-0.38, 0.38]) {
          box(walls, '#866348', [x, 0.36, 0.6], [0.23, 0.09, 0.16]);
          ball(walls, '#7faa61', [x, 0.44, 0.6], [0.13, 0.07, 0.09]);
        }
      }
      box(
        roof,
        spec.style === 'snow' ? '#896b5a' : spec.roof,
        [0.28, height + 0.43, -0.22],
        [0.16, 0.52, 0.16],
      );
    }
    const door = new THREE.Group();
    door.position.set(-0.245, 0.08, 0.545);
    root.add(door);
    box(door, '#84614c', [0.245, 0.34, 0], [0.47, 0.68, 0.05]);
    ball(door, '#ffe6a0', [0.4, 0.34, 0.04], [0.035, 0.035, 0.025]);
    if (spec.style !== 'sphinx')
      for (const x of [-0.37, 0.37]) {
        box(walls, '#fff5d6', [x, 0.55, 0.542], [0.19, 0.28, 0.025]);
        box(walls, '#8ecad1', [x, 0.55, 0.56], [0.135, 0.2, 0.012]);
      }
    if (spec.size === 'tall')
      for (const x of [-0.25, 0.25]) {
        box(walls, '#fff5d6', [x, 1.37, 0.542], [0.27, 0.3, 0.025]);
        box(walls, '#8ecad1', [x, 1.37, 0.56], [0.2, 0.22, 0.012]);
      }
    // A furnished cutaway becomes visible when a friend goes indoors.
    const room = new THREE.Group();
    root.add(room);
    box(room, '#eed19d', [0, 0.103, 0], [0.72, 0.018, 0.7]);
    const bed = new THREE.Group();
    room.add(bed);
    const blanket =
      spec.style === 'sphinx'
        ? '#4f98ad'
        : spec.style === 'snow'
          ? '#c46d64'
          : spec.style === 'sunshine'
            ? '#e1b05f'
            : '#7aab86';
    box(bed, '#95714e', [-0.22, 0.18, -0.05], [0.45, 0.18, 0.84]);
    box(bed, blanket, [-0.22, 0.29, -0.01], [0.43, 0.09, 0.72]);
    box(bed, '#fff6dd', [-0.22, 0.35, -0.35], [0.38, 0.09, 0.17]);
    box(bed, '#886549', [-0.22, 0.33, -0.47], [0.47, 0.37, 0.055]);
    combineVisual(bed);
    const table = new THREE.Group();
    room.add(table);
    box(table, '#88a792', [0.28, 0.24, -0.32], [0.3, 0.1, 0.26]);
    box(table, '#739480', [0.28, 0.4, -0.45], [0.3, 0.37, 0.06]);
    for (const x of [0.17, 0.39])
      stick(table, '#95704e', [x, 0.14, -0.32], [0.035, 0.25, 0.035]);
    stick(table, '#ac8055', [0.28, 0.25, 0.12], [0.11, 0.39, 0.11]);
    ball(table, '#f0d084', [0.28, 0.43, 0.12], [0.22, 0.04, 0.2]);
    combineVisual(table);
    const bottle = new THREE.Group();
    room.add(bottle);
    bottle.position.set(0.32, 0.48, 0.12);
    stick(bottle, '#66bdd2', [0, 0.075, 0], [0.045, 0.15, 0.045]);
    stick(bottle, '#e4f7f3', [0, 0.076, 0], [0.046, 0.046, 0.046]);
    stick(bottle, '#398696', [0, 0.16, 0], [0.027, 0.035, 0.027]);
    combineVisual(bottle);
    const floors = [{ room, bed, table, bottle }];
    const stairs = new THREE.Group();
    root.add(stairs);
    if (spec.size === 'tall') {
      const upper = room.clone(true);
      upper.position.y = 0.92;
      const upperBed = upper.children[
        room.children.indexOf(bed)
      ] as THREE.Group;
      const upperTable = upper.children[
        room.children.indexOf(table)
      ] as THREE.Group;
      const upperBottle = upper.children[
        room.children.indexOf(bottle)
      ] as THREE.Group;
      box(upper, '#c8b38c', [0, 0.045, 0], [1.05, 0.09, 0.98]);
      root.add(upper);
      floors.push({
        room: upper,
        bed: upperBed,
        table: upperTable,
        bottle: upperBottle,
      });
      for (let step = 0; step < 9; step++)
        box(
          stairs,
          '#b99464',
          [0.63, 0.055 + step * 0.102, 0.39 - step * 0.087],
          [0.25, 0.1, 0.11],
        );
      for (const z of [0.4, -0.35])
        stick(
          stairs,
          '#7b6247',
          [0.76, z > 0.0 ? 0.28 : 1.03, z],
          [0.022, 0.46, 0.022],
        );
      const rail = box(
        stairs,
        '#80694e',
        [0.76, 0.68, 0.025],
        [0.035, 1.16, 0.035],
      );
      rail.rotation.x = 0.7;
      for (const x of [-0.5, 0.5])
        box(stairs, '#93704e', [x, 0.46, -0.48], [0.06, 0.92, 0.06]);
      combineVisual(stairs);
    }
    combineVisual(walls);
    combineVisual(roof);
    root.updateMatrixWorld(true);
    const inside = root
      .localToWorld(new THREE.Vector3(0, 0.08, 0.02))
      .normalize();
    const radius = (0.72 * spec.scale + 0.24) / 6;
    const doorPoint = root
      .localToWorld(new THREE.Vector3(0, 0, 0.84 + 0.26 / spec.scale))
      .normalize();
    obstacles.push({ id: spec.id, center, radius, kind: 'house' });
    return {
      ...spec,
      root,
      center,
      roof,
      walls,
      door,
      bed,
      table,
      bottle,
      floors,
      stairs,
      inside,
      doorPoint,
    };
  });
  const navigation = new Navigator(obstacles);
  const habitatNavigators = new Map<number, Navigator>();
  function animalNavigation(a: (typeof animalGroups)[number]) {
    const land = terrain(a.home).land;
    if (!habitatNavigators.has(land))
      habitatNavigators.set(
        land,
        new Navigator(obstacles, animalHabitat(a.home)),
      );
    return habitatNavigators.get(land)!;
  }
  const boat = at(normal(-0.28, 0.13));
  boat.rotateY(-0.5);
  ball(boat, '#d09557', [0, 0.035, 0], [0.16, 0.07, 0.35]);
  box(boat, '#f6ddb1', [0, 0.06, 0], [0.23, 0.035, 0.4]);
  stick(boat, '#8d7b57', [0, 0.31, 0], [0.025, 0.53, 0.025]);
  const sail = new THREE.Shape();
  sail.moveTo(0, 0);
  sail.lineTo(0.3, 0);
  sail.lineTo(0, 0.4);
  sail.closePath();
  const sailMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(sail),
    new THREE.MeshStandardMaterial({
      color: '#fff6da',
      side: THREE.DoubleSide,
    }),
  );
  sailMesh.position.set(0.025, 0.16, 0);
  boat.add(sailMesh);
  keepStatic(boat);
  // Water highlights are real geometry following the ocean surface.
  for (let i = 0; i < 190; i++) {
    const n = normal(Math.asin(rand() * 2 - 1), rand() * Math.PI * 2);
    if (terrain(n).region !== 'ocean') continue;
    const g = at(n, 6.012);
    const wave = mesh(
      g,
      boxGeo,
      '#a0deea',
      [0, 0, 0],
      [0.12 + rand() * 0.14, 0.008, 0.018],
    );
    wave.rotation.y = rand();
    keepStatic(g);
  }
  // Merge static props by material, keeping the draw-call count small on tablets.
  staticRoot.updateMatrixWorld(true);
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  staticRoot.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      const m = o.material as THREE.Material;
      if (!batches.has(m)) batches.set(m, []);
      batches.get(m)!.push(geo);
    }
  });
  for (const [m, geos] of batches) {
    const merged = mergeGeometries(geos, false);
    if (merged) world.add(new THREE.Mesh(merged, m));
    geos.forEach((g) => g.dispose());
  }
  world.remove(staticRoot);
  // Puffy clouds around the planet, with space left around the explorer.
  const clouds = new THREE.Group();
  scene.add(clouds);
  [
    [-8, 3, -2],
    [7.2, 4.2, -2],
    [-7, -2.8, 1],
    [8, -2, -4],
    [-3, 7, -5],
    [4, -5.2, -3],
  ].forEach((p, i) => {
    const g = new THREE.Group();
    g.position.set(p[0], p[1], p[2]);
    g.scale.setScalar(i % 2 ? 0.75 : 1);
    for (let k = 0; k < 5; k++)
      ball(
        g,
        '#ffffff',
        [(k - 2) * 0.39, Math.sin(k * 2) * 0.12, 0],
        [0.48, 0.29 + Math.sin(k + 1) * 0.09, 0.31],
      );
    clouds.add(g);
  });
  // Bake each animated animal into one colored mesh, retaining its group animation.
  function combineVisual(group: THREE.Group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const geos: THREE.BufferGeometry[] = [];
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const geo = o.geometry.index
          ? o.geometry.toNonIndexed()
          : o.geometry.clone();
        geo.applyMatrix4(
          new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld),
        );
        const color = (o.material as THREE.MeshStandardMaterial).color;
        const count = geo.attributes.position.count;
        const data = new Float32Array(count * 3);
        for (let i = 0; i < count; i++)
          data.set([color.r, color.g, color.b], i * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(data, 3));
        geos.push(geo);
      }
    });
    if (!geos.length) return;
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (merged) {
      group.clear();
      group.add(
        new THREE.Mesh(
          merged,
          new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.9,
          }),
        ),
      );
    }
  }
  animalGroups.forEach((a) => {
    a.normal.copy(animalNavigation(a).nearestFree(a.normal));
    a.home.copy(a.normal);
    a.root.position.copy(a.normal).multiplyScalar(terrain(a.normal).radius);
    if (a.kind !== 'snake') {
      a.legs.forEach((leg) => a.group.remove(leg));
      if (a.tail) a.group.remove(a.tail);
      combineVisual(a.group);
      a.legs.forEach((leg) => a.group.add(leg));
      if (a.tail) a.group.add(a.tail);
    }
  });
  // Each animal has its own bed, so resting never depends on another animal leaving.
  const animalHomes = animalGroups.map((a) => {
    const nav = animalNavigation(a);
    const point = nav.nearestFree(
      advance(a.home, { x: 0.6, y: 0.3, z: -0.5 }, 0.09),
    );
    const root = at(point);
    const entranceDirection = new THREE.Vector3()
      .copy(a.home)
      .addScaledVector(
        new THREE.Vector3().copy(point),
        -new THREE.Vector3().copy(point).dot(a.home),
      )
      .applyQuaternion(root.quaternion.clone().invert());
    root.rotateY(Math.atan2(entranceDirection.x, entranceDirection.z));
    const cover = new THREE.Group();
    root.add(cover);
    const burrow = a.kind === 'bunny' || a.kind === 'snake';
    const name = (
      {
        bunny: 'Rabbit burrow',
        snake: 'Snake hole',
        sheep: 'Sheep shelter',
        dog: 'Dog kennel',
        cat: 'Cat basket',
        penguin: 'Pebble nest',
      } as Record<string, string>
    )[a.kind];
    const sand = a.kind === 'snake';
    if (burrow) {
      ball(
        cover,
        sand ? '#d9aa65' : '#81ad55',
        [0, 0.13, 0],
        [0.43, 0.3, 0.36],
      );
      ball(cover, '#49382e', [0, 0.12, 0.31], [0.17, 0.14, 0.035]);
      ball(root, '#b99661', [0, 0.025, 0.32], [0.24, 0.03, 0.2]);
    } else if (a.kind === 'sheep' || a.kind === 'dog') {
      const width = a.kind === 'sheep' ? 0.48 : 0.35;
      for (const x of [-width, width])
        for (const z of [-0.3, 0.3])
          box(root, '#a57548', [x, 0.24, z], [0.06, 0.48, 0.06]);
      box(root, '#c99864', [0, 0.2, -0.32], [width * 2, 0.4, 0.045]);
      for (const side of [-1, 1]) {
        const roof = box(
          cover,
          a.kind === 'dog' ? '#d37450' : '#70978c',
          [(side * width) / 2, 0.57, 0],
          [width + 0.15, 0.08, 0.82],
        );
        roof.rotation.z = -side * 0.3;
      }
    } else {
      for (let i = 0; i < 9; i++) {
        const angle = (i * Math.PI * 2) / 9;
        ball(
          root,
          a.kind === 'cat' ? '#bd8c68' : '#a3b8c3',
          [Math.sin(angle) * 0.29, 0.075, Math.cos(angle) * 0.29],
          [0.1, 0.09, 0.085],
        );
      }
    }
    ball(
      root,
      a.kind === 'cat' ? '#e9b2a0' : '#e5c579',
      [0, 0.025, 0],
      [0.29, 0.045, 0.27],
    );
    combineVisual(cover);
    // Merge the fixed shell separately from its opening cover.
    root.remove(cover);
    combineVisual(root);
    root.add(cover);
    return {
      animalId: a.id,
      name,
      point,
      outside: a.home.clone(),
      root,
      cover,
    };
  });
  combineVisual(clouds);
  // Groundless drop shadow makes the sphere feel like a floating toy.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
  grad.addColorStop(0, 'rgba(58,110,132,0.22)');
  grad.addColorStop(1, 'rgba(58,110,132,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(13, 3.3),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.position.set(0, -7.5, -1);
  scene.add(shadow);
  function makeResident(spec: (typeof FRIENDS)[number]) {
    const playerNormal = new THREE.Vector3().copy(
      navigation.nearestFree(normal(spec.lat, spec.lon)),
    );
    const playerRoot = at(playerNormal),
      person = new THREE.Group();
    playerRoot.add(person);
    const leftLeg = box(
        person,
        '#3f6570',
        [-0.092, 0.135, 0],
        [0.13, 0.23, 0.14],
      ),
      rightLeg = box(person, '#3f6570', [0.092, 0.135, 0], [0.13, 0.23, 0.14]);
    ball(person, '#745f49', [-0.094, 0.038, 0.034], [0.085, 0.045, 0.12]);
    ball(person, '#745f49', [0.094, 0.038, 0.034], [0.085, 0.045, 0.12]);
    ball(person, spec.color, [0, 0.38, 0], [0.21, 0.24, 0.16]);
    const armL = ball(
        person,
        spec.color,
        [-0.23, 0.38, 0],
        [0.065, 0.19, 0.075],
      ),
      armR = ball(person, spec.color, [0.23, 0.38, 0], [0.065, 0.19, 0.075]);
    ball(person, '#efc3a0', [-0.245, 0.22, 0], [0.065, 0.07, 0.067]);
    ball(person, '#efc3a0', [0.245, 0.22, 0], [0.065, 0.07, 0.067]);
    ball(person, '#ecc5a2', [0, 0.7, 0.015], [0.18, 0.19, 0.175]);
    ball(person, '#795e46', [0, 0.8, -0.035], [0.19, 0.16, 0.16]);
    for (const x of [-0.06, 0.06])
      ball(person, '#3b493f', [x, 0.72, 0.172], [0.017, 0.024, 0.013]);
    ball(person, '#d69b7c', [0, 0.656, 0.186], [0.022, 0.015, 0.008]);
    stick(person, '#ed9b46', [0, 0.875, 0.005], [0.215, 0.085, 0.21]);
    ball(person, '#eaa04c', [0, 0.925, -0.006], [0.166, 0.12, 0.163]);
    box(person, '#d1873e', [0, 0.875, 0.17], [0.22, 0.035, 0.15]);
    box(person, '#699b88', [0, 0.4, -0.18], [0.27, 0.3, 0.14]);
    box(person, '#94b59a', [0, 0.44, -0.26], [0.18, 0.13, 0.02]);
    const floatRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.075, 8, 28),
      material('#ffdc70'),
    );
    floatRing.rotation.x = Math.PI / 2;
    floatRing.position.y = 0.32;
    person.add(floatRing);
    floatRing.visible = false;
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.29, 0.34, 40),
      new THREE.MeshBasicMaterial({
        color: '#fff9dd',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.02;
    playerRoot.add(marker);
    const body = new THREE.Group();
    person.add(body);
    for (const child of person.children.slice())
      if (
        ![body, leftLeg, rightLeg, armL, armR, floatRing].includes(
          child as THREE.Group & THREE.Mesh,
        )
      ) {
        person.remove(child);
        body.add(child);
      }
    combineVisual(body);
    return {
      id: spec.id,
      name: spec.name,
      color: spec.color,
      normal: playerNormal,
      root: playerRoot,
      person,
      leftLeg,
      rightLeg,
      armL,
      armR,
      floatRing,
      marker,
      route: [] as Point[],
      phase: 'walking' as
        | 'walking'
        | 'entering'
        | 'inside'
        | 'stairs'
        | 'sleeping'
        | 'seated'
        | 'exiting',
      houseId: null as string | null,
      intentHouse: null as string | null,
      afterExit: null as { point: Point; house: string | null } | null,
      moving: false,
      jumpTime: -5,
      drinkTime: -5,
      floor: 0,
      floorTo: 0,
      stairStart: 0,
      exitAfterStairs: false,
    };
  }
  const residents = FRIENDS.map(makeResident);
  let active = residents[0];
  let activeAnimal: (typeof animalGroups)[number] | null = null;
  const animalMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.35, 40),
    new THREE.MeshBasicMaterial({
      color: 0xffe9a1,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const animalMarkerRoot = new THREE.Group();
  world.add(animalMarkerRoot);
  animalMarkerRoot.add(animalMarker);
  animalMarker.rotation.x = -Math.PI / 2;
  animalMarker.position.y = 0.03;
  animalMarkerRoot.visible = false;
  const hoverMarkerRoot = new THREE.Group();
  world.add(hoverMarkerRoot);
  const hoverMarker = animalMarker.clone();
  hoverMarker.material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  hoverMarker.scale.setScalar(1.18);
  hoverMarkerRoot.add(hoverMarker);
  hoverMarkerRoot.visible = false;
  let hoveredRoot: THREE.Object3D | null = null;
  let { normal: playerNormal, root: playerRoot, person } = active;
  // Candy-colored, bevelled shape tokens: two of each, with readable silhouettes.
  const tokenTypes = [
    { kind: 'star', color: '#ffce47' },
    { kind: 'circle', color: '#f786a6' },
    { kind: 'rectangle', color: '#61c3e4' },
    { kind: 'diamond', color: '#ab88ea' },
    { kind: 'triangle', color: '#ff995d' },
    { kind: 'hexagon', color: '#63cfaa' },
  ];
  const tokenGeometries = tokenTypes.map(({ kind }) => {
    const shape = new THREE.Shape();
    if (kind === 'circle') shape.absarc(0, 0, 0.22, 0, Math.PI * 2, false);
    else if (kind === 'rectangle') {
      shape.moveTo(-0.25, -0.15);
      shape.lineTo(0.25, -0.15);
      shape.lineTo(0.25, 0.15);
      shape.lineTo(-0.25, 0.15);
    } else {
      const count =
        kind === 'star'
          ? 10
          : kind === 'diamond'
            ? 4
            : kind === 'triangle'
              ? 3
              : 6;
      for (let i = 0; i < count; i++) {
        const angle = (i * Math.PI * 2) / count + Math.PI / 2;
        const radius = kind === 'star' && i % 2 ? 0.115 : 0.245;
        const x = Math.cos(angle) * radius * (kind === 'diamond' ? 0.82 : 1);
        const y = Math.sin(angle) * radius;
        if (!i) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.065,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.018,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 24,
    });
    geometry.translate(0, 0, -0.0325);
    return geometry;
  });
  const collectibles: {
    root: THREE.Group;
    star: THREE.Mesh;
    halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    kind: string;
    color: string;
    normal: THREE.Vector3;
    found: boolean;
    collectedAt: number;
  }[] = [];
  const starLocations: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
    [number, number],
    [number, number],
    [number, number],
    [number, number],
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ] = [
    [0.43, -0.37],
    [0.2, -0.75],
    [0.72, -0.45],
    [0.22, 0.88],
    [0.4, 0.55],
    [-0.02, 0.8],
    [-0.35, 0.18],
    [-0.48, -0.13],
    [-0.6, 0.17],
    [0.85, 2.78],
    [1.05, 2.3],
    [0.61, 2.55],
  ];
  for (const [index, [lat, lon]] of starLocations.entries()) {
    const type = tokenTypes[index % tokenTypes.length];
    const n = new THREE.Vector3().copy(
        navigation.nearestFree(normal(lat, lon)),
      ),
      root = at(n),
      star = new THREE.Mesh(
        tokenGeometries[index % tokenTypes.length],
        new THREE.MeshStandardMaterial({
          color: type.color,
          roughness: 0.28,
          metalness: 0.16,
          emissive: type.color,
          emissiveIntensity: 0.12,
        }),
      );
    star.position.y = 0.55;
    root.add(star);
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.29, 40),
      new THREE.MeshBasicMaterial({
        color: type.color,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.025;
    root.add(halo);
    collectibles.push({
      root,
      star,
      halo,
      ...type,
      normal: n,
      found: false,
      collectedAt: 0,
    });
  }
  let zoom = 35;
  const state: GameState = {
    selectedPerson: active.id,
    selectedAnimal: null,
    animalRest: null,
    floor: 0,
    floorCount: 1,
    changingFloor: false,
    people: [],
    insideHouse: null,
    region: 'forest',
    swimming: false,
    stars: 0,
    treasures: [],
    visited: ['forest'],
    moving: false,
    zoom,
    ready: true,
  };
  let disposed = false,
    paused = false,
    sound = false,
    audio: AudioContext | null = null,
    last = performance.now(),
    time = 0,
    frame = 0,
    raf = 0,
    manualCamera = false,
    lastRegion: Region = 'forest',
    lastEmit = 0;
  const followQuat = new THREE.Quaternion().setFromUnitVectors(
    playerNormal,
    new THREE.Vector3(0, 0.43, 0.903).normalize(),
  );
  world.quaternion.copy(followQuat);
  const keys = new Set<string>(),
    raycaster = new THREE.Raycaster(),
    mouse = new THREE.Vector2(),
    pointers = new Map<number, { x: number; y: number }>();
  let drag: { x: number; y: number; distance: number; id: number } | null =
      null,
    pinchDistance = 0,
    fitDistance = 25;
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  const viewport = { width: 1, height: 1 };
  function resize() {
    viewport.width = host.clientWidth;
    viewport.height = host.clientHeight;
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height);
    fitDistance = Math.max(
      viewport.height < 500 ? 35 : 29,
      23.5 / camera.aspect,
    );
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  let currentDistance = fitDistance;
  function emit() {
    state.treasures = tokenTypes.map((type) => ({
      ...type,
      total: 2,
      found: collectibles.filter((c) => c.kind === type.kind && c.found).length,
    }));
    state.floor = activeAnimal ? 0 : active.floor;
    state.floorCount = activeAnimal
      ? 1
      : (houses.find((h) => h.id === active.houseId)?.floors.length ?? 1);
    state.changingFloor = !activeAnimal && active.phase === 'stairs';
    state.selectedPerson = activeAnimal ? '' : active.id;
    state.selectedAnimal = activeAnimal?.id ?? null;
    state.animalRest = activeAnimal
      ? {
          name: activeAnimal.name,
          homeName: animalHomes.find((h) => h.animalId === activeAnimal!.id)!
            .name,
          phase: activeAnimal.restPhase,
        }
      : null;
    state.insideHouse =
      active.phase === 'inside' ||
      active.phase === 'stairs' ||
      active.phase === 'sleeping' ||
      active.phase === 'seated'
        ? active.houseId
        : null;
    if (activeAnimal) state.insideHouse = null;
    state.people = residents.map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
      position: { x: a.normal.x, y: a.normal.y, z: a.normal.z },
      moving: a.moving,
      insideHouse:
        a.phase === 'inside' ||
        a.phase === 'stairs' ||
        a.phase === 'sleeping' ||
        a.phase === 'seated'
          ? a.houseId
          : null,
      phase: a.phase,
      floor: a.floor,
    }));
    onState({
      ...state,
      visited: [...state.visited],
      people: state.people.map((p) => ({ ...p })),
    });
  }
  function chime(notes = [523.25, 659.25, 783.99]) {
    if (!sound) return;
    try {
      audio ??= new AudioContext();
      void audio.resume();
      notes.forEach((freq, i) => {
        const oscillator = audio!.createOscillator(),
          gain = audio!.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        const t = audio!.currentTime + i * 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.06, t + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        oscillator.connect(gain);
        gain.connect(audio!.destination);
        oscillator.start(t);
        oscillator.stop(t + 0.4);
      });
    } catch {
      /* Sound is optional; exploration always stays available. */
    }
  }
  function jump() {
    if (paused) return;
    if (activeAnimal) {
      if (activeAnimal.restPhase === 'sleeping') return;
      if (time - activeAnimal.jumpTime >= 0.8) activeAnimal.jumpTime = time;
      return;
    }
    if (time - active.jumpTime < 0.8) return;
    if (active.phase === 'seated') {
      standUp();
      return;
    }
    if (active.phase === 'sleeping') {
      wakeUp();
      return;
    }
    active.jumpTime = time;
    chime([state.swimming ? 440 : 660]);
  }
  function setDirection(key: string, pressed: boolean) {
    if (pressed && !paused) {
      if (activeAnimal?.restPhase === 'sleeping') return;
      keys.add(key.toLowerCase());
      if (activeAnimal) {
        activeAnimal.restPhase = 'outside';
        activeAnimal.route = [];
      } else if (active.phase !== 'walking') leaveHouse();
      else {
        active.route = [];
        active.intentHouse = null;
      }
      manualCamera = false;
    } else keys.delete(key.toLowerCase());
  }
  function clearInput() {
    keys.clear();
    pointers.clear();
    drag = null;
    pinchDistance = 0;
  }
  const moveKeys = [
    'arrowup',
    'arrowdown',
    'arrowleft',
    'arrowright',
    'w',
    'a',
    's',
    'd',
  ];
  function keydown(e: KeyboardEvent) {
    if (paused || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement;
    if (t.closest('input,textarea,[role="dialog"]')) return;
    const key = e.key.toLowerCase();
    if (moveKeys.includes(key)) {
      e.preventDefault();
      setDirection(key, true);
    }
    if (e.code === 'Space' && t.tagName !== 'BUTTON') {
      e.preventDefault();
      if (!e.repeat) jump();
    }
    if (key === '=' || key === '+') zoomBy(8);
    if (key === '-') zoomBy(-8);
  }
  function keyup(e: KeyboardEvent) {
    setDirection(e.key, false);
  }
  function zoomBy(amount: number) {
    zoom = THREE.MathUtils.clamp(zoom + amount, 0, 100);
    state.zoom = zoom;
    emit();
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    if (!paused) zoomBy(-e.deltaY * 0.035);
  }
  function pointerdown(e: PointerEvent) {
    if (paused) return;
    host.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1)
      drag = { x: e.clientX, y: e.clientY, distance: 0, id: e.pointerId };
    if (pointers.size === 2) {
      const p = [...pointers.values()];
      pinchDistance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (drag) drag.distance = 100;
    }
  }
  function pointermove(e: PointerEvent) {
    if (!pointers.size && !paused) {
      const rect = host.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      world.updateMatrixWorld(true);
      const groundHit = raycaster.intersectObject(earth)[0];
      const hit = raycaster
        .intersectObjects(
          [...residents.map((a) => a.root), ...animalGroups.map((a) => a.root)],
          true,
        )
        .find((h) => !groundHit || h.distance < groundHit.distance + 0.02);
      let object = hit?.object as THREE.Object3D | undefined;
      while (
        object &&
        !residents.some((a) => a.root === object) &&
        !animalGroups.some((a) => a.root === object)
      )
        object = object.parent ?? undefined;
      const friend =
        residents.find((a) => a.root === object) ??
        animalGroups.find((a) => a.root === object);
      hoveredRoot = friend?.root ?? null;
      host.style.cursor = friend ? 'pointer' : 'grab';
      host.title = friend
        ? `Click to choose ${friend.name}, then click where to go`
        : '';
    }
    if (!pointers.has(e.pointerId) || paused) return;
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const p = [...pointers.values()],
        d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      zoomBy((d - pinchDistance) * 0.17);
      pinchDistance = d;
      return;
    }
    if (!drag) return;
    const dx = e.clientX - prev.x,
      dy = e.clientY - prev.y;
    drag.distance += Math.hypot(dx, dy);
    if (drag.distance > 6) {
      manualCamera = true;
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(dy * 0.004, dx * 0.004, 0, 'XYZ'),
      );
      world.quaternion.premultiply(q);
    }
  }
  function pointerup(e: PointerEvent) {
    if (drag && drag.id === e.pointerId && drag.distance < 7 && !paused) {
      const rect = host.getBoundingClientRect();
      mouse.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      world.updateMatrixWorld(true);
      const groundHit = raycaster.intersectObject(earth)[0];
      const clickable = [
        ...residents.map((a) => a.root),
        ...animalGroups.map((a) => a.root),
        ...animalHomes.map((h) => h.root),
        ...houses.map((h) => h.root),
        ...houses.flatMap((h) =>
          h.floors.flatMap((f) => [f.bed, f.table, f.bottle]),
        ),
        ...houses.map((h) => h.stairs),
      ];
      const hit = raycaster.intersectObjects(clickable, true).find((h) => {
        if (groundHit && h.distance >= groundHit.distance + 0.02) return false;
        // Raycasting also intersects hidden cutaway roofs; only visible models can be clicked.
        for (
          let object: THREE.Object3D | null = h.object;
          object;
          object = object.parent
        )
          if (!object.visible) return false;
        return true;
      });
      if (hit) {
        let object: THREE.Object3D | null = hit.object;
        while (object && !clickable.includes(object as THREE.Group))
          object = object.parent;
        const friend = residents.find((a) => a.root === object);
        const house = houses.find((h) => h.root === object);
        const animalHome = animalHomes.find((h) => h.root === object);
        if (animalHome) {
          selectAnimal(animalHome.animalId);
          restAnimal();
          pointers.delete(e.pointerId);
          drag = null;
          if (host.hasPointerCapture(e.pointerId))
            host.releasePointerCapture(e.pointerId);
          return;
        }
        const animal = animalGroups.find((a) => a.root === object);
        if (animal) {
          selectAnimal(animal.id);
        }
        const bedHouse = houses.find((h) =>
          h.floors.some((f) => f.bed === object),
        );
        const tableHouse = houses.find((h) =>
          h.floors.some((f) => f.table === object || f.bottle === object),
        );
        const stairHouse = houses.find((h) => h.stairs === object);
        if (stairHouse) {
          if (active.houseId === stairHouse.id)
            changeFloor(active.floor === 0 ? 1 : 0);
          else enterHouse(stairHouse.id);
        } else if (tableHouse && active.houseId === tableHouse.id) {
          sitAtTable();
          if (tableHouse.floors.some((f) => object === f.bottle)) drinkWater();
        } else if (bedHouse && active.houseId === bedHouse.id) lieDown();
        else if (friend) {
          // A child's click on the mattress should still work through their selected friend's arm.
          const ownHouse = houses.find((h) => h.id === active.houseId);
          if (
            !activeAnimal &&
            friend === active &&
            active.phase === 'inside' &&
            ownHouse &&
            raycaster.intersectObject(ownHouse.floors[active.floor].bed, true)
              .length
          )
            lieDown();
          else selectPerson(friend.id);
        } else if (house) enterHouse(house.id);
      } else if (groundHit)
        walkTo(world.worldToLocal(groundHit.point.clone()).normalize());
    }
    pointers.delete(e.pointerId);
    drag = null;
    if (host.hasPointerCapture(e.pointerId))
      host.releasePointerCapture(e.pointerId);
  }
  function visibility() {
    if (document.hidden) clearInput();
    last = performance.now();
  }
  host.addEventListener('pointerdown', pointerdown);
  host.addEventListener('pointermove', pointermove);
  function pointerleave() {
    hoveredRoot = null;
    host.title = '';
    host.style.cursor = 'grab';
  }
  host.addEventListener('pointerleave', pointerleave);
  host.addEventListener('pointerup', pointerup);
  host.addEventListener('pointercancel', clearInput);
  host.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', visibility);
  function contextLost(e: Event) {
    e.preventDefault();
    paused = true;
    onMessage('The world needs a little refresh. Reload to keep exploring.');
  }
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  function selectPerson(id: string) {
    if (paused) return;
    const next = residents.find((a) => a.id === id);
    if (!next) return;
    keys.clear();
    activeAnimal = null;
    active = next;
    ({ normal: playerNormal, root: playerRoot, person } = active);
    manualCamera = false;
    updateRegion();
    emit();
  }
  function selectAnimal(id: string) {
    if (paused) return;
    const next = animalGroups.find((a) => a.id === id);
    if (!next) return;
    keys.clear();
    activeAnimal = next;
    playerNormal = next.normal;
    playerRoot = next.root;
    person = next.group;
    manualCamera = false;
    updateRegion();
    emit();
  }
  function order(
    actor: typeof active,
    point: Point,
    house: string | null = null,
  ) {
    const route = navigation.route(actor.normal, point);
    if (!route) {
      onMessage('That spot is hard to reach. Try a nearby clearing.');
      return;
    }
    actor.route = route;
    actor.intentHouse = house;
    actor.phase = 'walking';
  }
  function restAnimal() {
    if (paused || !activeAnimal || activeAnimal.restPhase === 'sleeping')
      return;
    const a = activeAnimal;
    const h = animalHomes.find((h) => h.animalId === a.id)!;
    const nav = animalNavigation(a);
    const approach = nav.route(a.normal, h.outside);
    const entry = nav.route(h.outside, h.point);
    const route = approach && entry ? [...approach, ...entry] : null;
    if (!route) {
      onMessage('Try moving a little closer to home.');
      return;
    }
    clearInput();
    a.route = route;
    a.restPhase = 'going-home';
    manualCamera = false;
    onMessage(`${a.name} is going to the ${h.name.toLowerCase()}.`);
    emit();
  }
  function wakeAnimal() {
    if (paused || !activeAnimal) return;
    const a = activeAnimal;
    clearInput();
    a.restPhase = 'outside';
    const h = animalHomes.find((h) => h.animalId === a.id)!;
    h.cover.visible = true;
    a.route = animalNavigation(a).route(a.normal, h.outside) ?? [];
    emit();
  }
  function walkTo(point: Point) {
    if (
      paused ||
      ![point.x, point.y, point.z].every(Number.isFinite) ||
      Math.hypot(point.x, point.y, point.z) < 0.5
    )
      return;
    keys.clear();
    manualCamera = false;
    if (activeAnimal) {
      const navigator = animalNavigation(activeAnimal);
      if (!navigator.allowed!(point)) {
        activeAnimal.route = [];
        onMessage(
          `${activeAnimal.name} stays in ${REGIONS[terrain(activeAnimal.home).region].name}. Choose a spot on dry land here.`,
        );
        return;
      }
      if (activeAnimal.restPhase !== 'outside') {
        activeAnimal.restPhase = 'outside';
        animalHomes.find(
          (h) => h.animalId === activeAnimal!.id,
        )!.cover.visible = true;
        emit();
      }
      const route = navigator.route(activeAnimal.normal, point);
      if (route) activeAnimal.route = route;
      else onMessage('Try a nearby clearing.');
      return;
    }
    if (active.phase !== 'walking') {
      active.afterExit = { point, house: null };
      leaveHouse();
    } else order(active, point);
  }
  function enterHouse(id: string) {
    if (paused) return;
    if (activeAnimal) {
      onMessage('Choose a person to visit a house.');
      return;
    }
    const house = houses.find((h) => h.id === id);
    if (!house) return;
    keys.clear();
    manualCamera = false;
    if (
      active.houseId === id &&
      (active.phase === 'inside' ||
        active.phase === 'stairs' ||
        active.phase === 'sleeping' ||
        active.phase === 'seated')
    ) {
      onMessage(`${active.name} is already inside ${house.name}.`);
      return;
    }
    if (active.phase !== 'walking') {
      active.afterExit = { point: house.doorPoint, house: id };
      leaveHouse();
    } else order(active, house.doorPoint, id);
    onMessage(`${active.name} is visiting ${house.name}.`);
  }
  function lieDown() {
    if (activeAnimal) return;
    if (
      paused ||
      !active.houseId ||
      !['inside', 'seated'].includes(active.phase)
    )
      return;
    if (
      residents.some(
        (a) =>
          a !== active &&
          a.houseId === active.houseId &&
          a.floor === active.floor &&
          a.phase === 'sleeping',
      )
    ) {
      onMessage('A friend is using this bed. Try another house!');
      return;
    }
    keys.clear();
    active.route = [];
    active.phase = 'sleeping';
    active.jumpTime = -5;
    active.drinkTime = -5;
    onMessage(`Sweet dreams, ${active.name}!`);
    emit();
  }
  function sitAtTable() {
    if (activeAnimal) return;
    if (
      paused ||
      !active.houseId ||
      !['inside', 'sleeping', 'seated'].includes(active.phase)
    )
      return;
    if (
      residents.some(
        (a) =>
          a !== active &&
          a.houseId === active.houseId &&
          a.floor === active.floor &&
          a.phase === 'seated',
      )
    ) {
      onMessage('A friend is sitting here. Try another table!');
      return;
    }
    keys.clear();
    active.route = [];
    active.phase = 'seated';
    active.jumpTime = -5;
    emit();
  }
  function standUp() {
    if (activeAnimal) return;
    if (paused || active.phase !== 'seated') return;
    active.phase = 'inside';
    active.drinkTime = -5;
    emit();
  }
  function drinkWater() {
    if (activeAnimal) return;
    if (paused || active.phase !== 'seated' || time - active.drinkTime < 1.8)
      return;
    active.drinkTime = time;
    onMessage(`A little drink of water for ${active.name}!`);
  }
  function wakeUp() {
    if (activeAnimal) return;
    if (paused || active.phase !== 'sleeping') return;
    active.phase = 'inside';
    onMessage(`Good morning, ${active.name}!`);
    emit();
  }
  function changeFloor(floor: number) {
    if (
      paused ||
      activeAnimal ||
      active.phase === 'stairs' ||
      !['inside', 'sleeping', 'seated'].includes(active.phase)
    )
      return;
    const house = houses.find((h) => h.id === active.houseId);
    if (
      !house ||
      !Number.isInteger(floor) ||
      floor < 0 ||
      floor >= house.floors.length ||
      floor === active.floor
    )
      return;
    keys.clear();
    active.route = [];
    active.jumpTime = -5;
    active.drinkTime = -5;
    active.floorTo = floor;
    active.stairStart = time;
    active.phase = 'stairs';
    emit();
  }
  function displayedFloor(h: (typeof houses)[number]) {
    const resident =
      !activeAnimal && active.houseId === h.id
        ? active
        : residents.find((a) => a.houseId === h.id);
    return resident
      ? resident.phase === 'stairs' && time - resident.stairStart > 0.9
        ? resident.floorTo
        : resident.floor
      : 0;
  }
  function leaveHouse() {
    if (activeAnimal) return;
    if (paused || !active.houseId) return;
    const house = houses.find((h) => h.id === active.houseId)!;
    if (active.phase === 'stairs') {
      active.exitAfterStairs = true;
      return;
    }
    if (active.floor > 0) {
      active.exitAfterStairs = true;
      changeFloor(0);
      return;
    }
    active.phase = 'exiting';
    active.route = [house.doorPoint];
    active.intentHouse = null;
    emit();
  }
  function finishRoute(actor: typeof active) {
    if (actor.phase === 'entering') {
      actor.phase = 'inside';
      actor.moving = false;
      onMessage(
        `${actor.name} is inside ${houses.find((h) => h.id === actor.houseId)!.name}!`,
      );
      emit();
    } else if (actor.phase === 'exiting') {
      actor.phase = 'walking';
      actor.houseId = null;
      actor.floor = 0;
      actor.floorTo = 0;
      actor.exitAfterStairs = false;
      const next = actor.afterExit;
      actor.afterExit = null;
      if (next) order(actor, next.point, next.house);
      emit();
    } else if (actor.intentHouse) {
      const house = houses.find((h) => h.id === actor.intentHouse)!;
      actor.houseId = house.id;
      actor.intentHouse = null;
      actor.phase = 'entering';
      actor.route = [house.inside];
    }
  }
  function goTo(region: Region) {
    if (paused) return;
    clearInput();
    const r = REGIONS[region];
    if (activeAnimal) {
      activeAnimal.route = [];
      if (activeAnimal.restPhase === 'going-home')
        activeAnimal.restPhase = 'outside';
      onMessage(
        `${activeAnimal.name} stays in ${REGIONS[terrain(activeAnimal.home).region].name}. Choose a person to travel.`,
      );
      emit();
      return;
    }
    active.route = [];
    active.floor = 0;
    active.floorTo = 0;
    active.exitAfterStairs = false;
    active.intentHouse = null;
    active.houseId = null;
    active.phase = 'walking';
    active.afterExit = null;
    playerNormal.copy(navigation.nearestFree(normal(r.lat, r.lon)));
    manualCamera = false;
    active.jumpTime = -5;
    active.drinkTime = -5;
    onMessage(
      region === 'ocean' ? 'Splash! You can swim here.' : `Hello, ${r.name}!`,
    );
    chime();
    updateRegion();
  }
  function updateRegion() {
    const t = terrain(playerNormal);
    state.region = t.region;
    state.swimming = t.region === 'ocean';
    if (!state.visited.includes(t.region)) state.visited.push(t.region);
    if (lastRegion !== t.region) {
      lastRegion = t.region;
      emit();
    }
  }
  function animate(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden || paused) return;
    frame++;
    if (!paused) time += dt;
    for (const actor of residents) {
      let moving = false;
      const t = terrain(actor.normal);
      const dx =
        !activeAnimal && actor === active && actor.phase === 'walking'
          ? Number(keys.has('arrowright') || keys.has('d')) -
            Number(keys.has('arrowleft') || keys.has('a'))
          : 0;
      const dy =
        !activeAnimal && actor === active && actor.phase === 'walking'
          ? Number(keys.has('arrowup') || keys.has('w')) -
            Number(keys.has('arrowdown') || keys.has('s'))
          : 0;
      let direction: THREE.Vector3 | null = null;
      let distance = dt * (t.region === 'ocean' ? 0.18 : 0.235);
      const waypoint = actor.route[0];
      if (dx || dy)
        direction = new THREE.Vector3(dx, dy, 0)
          .applyQuaternion(camera.quaternion)
          .applyQuaternion(world.quaternion.clone().invert());
      else if (waypoint) {
        const target = new THREE.Vector3().copy(waypoint);
        const angle = angularDistance(actor.normal, target);
        if (angle < 0.002) {
          actor.route.shift();
          if (!actor.route.length) finishRoute(actor);
        } else {
          direction = target.addScaledVector(
            actor.normal,
            -target.dot(actor.normal),
          );
          distance = Math.min(distance, angle);
        }
      }
      if (direction && direction.lengthSq() > 0.00000001) {
        const next = advance(actor.normal, direction, distance);
        const ignored =
          actor.phase === 'entering' || actor.phase === 'exiting'
            ? (actor.houseId ?? undefined)
            : undefined;
        if (navigation.segmentClear(actor.normal, next, ignored)) {
          const tangent = new THREE.Vector3()
            .copy(next)
            .sub(actor.normal)
            .normalize();
          actor.normal.copy(next);
          const orient = new THREE.Quaternion().setFromUnitVectors(
            up,
            actor.normal,
          );
          const local = tangent.applyQuaternion(orient.invert());
          const wanted = Math.atan2(local.x, local.z);
          const turn =
            THREE.MathUtils.euclideanModulo(
              wanted - actor.person.rotation.y + Math.PI,
              Math.PI * 2,
            ) - Math.PI;
          actor.person.rotation.y += turn * Math.min(1, dt * 14);
          moving = true;
        }
      }
      actor.moving = moving;
      const current = terrain(actor.normal),
        swimming = current.region === 'ocean';
      actor.root.position.copy(actor.normal).multiplyScalar(current.radius);
      actor.root.quaternion.setFromUnitVectors(up, actor.normal);
      const age = time - actor.jumpTime;
      const hop =
        age >= 0 && age < 0.8 ? Math.sin((age / 0.8) * Math.PI) * 0.45 : 0;
      const indoorHouse = houses.find((h) => h.id === actor.houseId);
      actor.person.visible =
        !indoorHouse ||
        actor.phase === 'stairs' ||
        displayedFloor(indoorHouse) === actor.floor;
      actor.person.scale.setScalar(1);
      actor.person.rotation.x = 0;
      actor.person.rotation.z = 0;
      actor.person.position.set(0, 0, 0);
      actor.person.position.y =
        (actor.phase === 'inside' ? 0.1 : 0) +
        hop +
        (swimming
          ? -0.15 + Math.sin(time * 4) * 0.035
          : moving
            ? Math.abs(Math.sin(time * 12)) * 0.035
            : 0);
      actor.floatRing.visible = swimming;
      actor.marker.visible = !activeAnimal && actor === active && !swimming;
      const stride = moving ? Math.sin(time * (swimming ? 7 : 12)) * 0.48 : 0;
      actor.leftLeg.rotation.x = stride;
      actor.rightLeg.rotation.x = -stride;
      actor.armL.rotation.x = -stride;
      actor.armR.rotation.x = stride;
      actor.armL.rotation.z = swimming ? -0.8 : 0;
      actor.armR.rotation.z = swimming ? 0.8 : 0;
      if (actor.phase === 'inside' && indoorHouse && actor.floor > 0)
        actor.root.position.add(
          new THREE.Vector3(
            0,
            actor.floor * 0.92 * indoorHouse.scale,
            0,
          ).applyQuaternion(indoorHouse.root.quaternion),
        );
      if (actor.phase === 'sleeping') {
        const house = houses.find((h) => h.id === actor.houseId)!;
        const rest = new THREE.Vector3(-0.22, 0.4 + actor.floor * 0.92, 0.32)
          .multiplyScalar(house.scale)
          .applyQuaternion(house.root.quaternion);
        actor.root.position.copy(house.root.position).add(rest);
        actor.root.quaternion.copy(house.root.quaternion);
        actor.person.position.set(
          0,
          reducedMotion ? 0 : Math.sin(time * 1.8) * 0.004,
          0,
        );
        actor.person.rotation.set(-Math.PI / 2, 0, 0);
        actor.person.scale.setScalar(0.7 * house.scale);
        actor.marker.visible = false;
        actor.floatRing.visible = false;
      }
      if (actor.phase === 'seated') {
        const house = houses.find((h) => h.id === actor.houseId)!;
        actor.root.position
          .copy(house.root.position)
          .add(
            new THREE.Vector3(0.28, 0.2 + actor.floor * 0.92, -0.31)
              .multiplyScalar(house.scale)
              .applyQuaternion(house.root.quaternion),
          );
        actor.root.quaternion.copy(house.root.quaternion);
        actor.person.position.set(0, 0, 0);
        actor.person.rotation.set(0, 0, 0);
        actor.person.scale.setScalar(0.55 * house.scale);
        actor.leftLeg.rotation.x = -Math.PI / 2;
        actor.rightLeg.rotation.x = -Math.PI / 2;
        actor.marker.visible = false;
        actor.floatRing.visible = false;
        actor.armR.rotation.x = time - actor.drinkTime < 1.8 ? -1.1 : 0;
      }
      if (actor.phase === 'stairs' && indoorHouse) {
        const progress = Math.min(1, (time - actor.stairStart) / 1.8);
        const t = actor.floorTo > actor.floor ? progress : 1 - progress;
        const points = [
          new THREE.Vector3(0, 0.1, 0.02),
          new THREE.Vector3(0.63, 0.1, 0.39),
          new THREE.Vector3(0.63, 1.02, -0.35),
          new THREE.Vector3(0, 1.02, 0.02),
        ];
        const section = t < 0.2 ? 0 : t < 0.8 ? 1 : 2;
        const amount =
          section === 0
            ? t / 0.2
            : section === 1
              ? (t - 0.2) / 0.6
              : (t - 0.8) / 0.2;
        const location = points[section]
          .clone()
          .lerp(points[section + 1], amount)
          .multiplyScalar(indoorHouse.scale)
          .applyQuaternion(indoorHouse.root.quaternion);
        actor.root.position.copy(indoorHouse.root.position).add(location);
        actor.root.quaternion.copy(indoorHouse.root.quaternion);
        actor.person.position.y = 0;
        actor.marker.visible = false;
        actor.person.rotation.y = actor.floorTo > actor.floor ? Math.PI : 0;
        actor.leftLeg.rotation.x = Math.sin(time * 12) * 0.4;
        actor.rightLeg.rotation.x = -Math.sin(time * 12) * 0.4;
        actor.moving = true;
        if (progress === 1) {
          actor.floor = actor.floorTo;
          actor.phase = 'inside';
          actor.moving = false;
          if (actor.exitAfterStairs) {
            if (actor.floor > 0) {
              actor.floorTo = 0;
              actor.stairStart = time;
              actor.phase = 'stairs';
            } else {
              actor.exitAfterStairs = false;
              actor.phase = 'exiting';
              actor.route = [indoorHouse.doorPoint];
            }
          }
          emit();
        }
      }
      if (indoorHouse && (!actor.person.visible || actor.floor > 0))
        actor.marker.visible = false;
      for (const c of collectibles)
        if (!c.found && angularDistance(actor.normal, c.normal) < 0.066) {
          c.found = true;
          c.collectedAt = time;
          state.stars++;
          onMessage(
            state.stars === 12
              ? 'You found every shape! What wonderful explorers.'
              : `${actor.name} found a ${c.kind}! ${state.stars} of 12`,
          );
          chime();
          emit();
        }
    }
    for (const a of animalGroups) {
      const animalHome = animalHomes.find((h) => h.animalId === a.id)!;
      if (a.restPhase === 'going-home' && !a.route.length) {
        a.restPhase =
          angularDistance(a.normal, animalHome.point) < 0.006
            ? 'sleeping'
            : 'outside';
        animalHome.cover.visible = a.restPhase !== 'sleeping';
        emit();
      }
      const pace =
        a.kind === 'bunny' ? Math.max(0, Math.sin((time + a.phase) * 7)) : 1;
      const dx =
        a === activeAnimal && a.restPhase !== 'sleeping'
          ? Number(keys.has('arrowright') || keys.has('d')) -
            Number(keys.has('arrowleft') || keys.has('a'))
          : 0;
      const dy =
        a === activeAnimal && a.restPhase !== 'sleeping'
          ? Number(keys.has('arrowup') || keys.has('w')) -
            Number(keys.has('arrowdown') || keys.has('s'))
          : 0;
      let direction: THREE.Vector3 | null = null;
      let distance =
        dt *
        (a.kind === 'snake' ? 0.15 : 0.2) *
        (a.kind === 'bunny' ? 0.35 + pace * 0.65 : 1);
      const waypoint = a.route[0];
      if (dx || dy)
        direction = new THREE.Vector3(dx, dy, 0)
          .applyQuaternion(camera.quaternion)
          .applyQuaternion(world.quaternion.clone().invert());
      else if (waypoint) {
        const angle = angularDistance(a.normal, waypoint);
        if (angle < 0.002) a.route.shift();
        else {
          direction = new THREE.Vector3()
            .copy(waypoint)
            .addScaledVector(a.normal, -a.normal.dot(waypoint));
          distance = Math.min(distance, angle);
        }
      }
      a.moving = false;
      if (direction && direction.lengthSq() > 1e-8) {
        const next = advance(a.normal, direction, distance);
        if (animalNavigation(a).segmentClear(a.normal, next)) {
          const tangent = new THREE.Vector3()
            .copy(next)
            .sub(a.normal)
            .normalize();
          a.normal.copy(next);
          const local = tangent.applyQuaternion(
            new THREE.Quaternion().setFromUnitVectors(up, a.normal).invert(),
          );
          a.heading = Math.atan2(local.x, local.z);
          a.moving = true;
        } else if (a.route.length) a.route = [];
      }
      a.root.position.copy(a.normal).multiplyScalar(terrain(a.normal).radius);
      a.root.quaternion.setFromUnitVectors(up, a.normal);
      a.group.rotation.y = a.heading;
      a.group.position.y =
        !reducedMotion && a.moving
          ? a.kind === 'bunny'
            ? pace * 0.18
            : Math.abs(Math.sin(time * 7 + a.phase)) * 0.015
          : 0;
      const jumpAge = time - a.jumpTime;
      if (jumpAge >= 0 && jumpAge < 0.8)
        a.group.position.y += Math.sin((jumpAge / 0.8) * Math.PI) * 0.3;
      a.group.rotation.z =
        !reducedMotion && a.moving && a.kind === 'penguin'
          ? Math.sin(time * 7 + a.phase) * 0.12
          : 0;
      a.legs.forEach(
        (leg, i) =>
          (leg.rotation.x =
            !reducedMotion && a.moving
              ? Math.sin(
                  time * 9 + a.phase + (i === 0 || i === 3 ? 0 : Math.PI),
                ) * 0.45
              : 0),
      );
      if (a.tail)
        a.tail.rotation.y =
          !reducedMotion && a.moving
            ? Math.sin(time * (a.kind === 'dog' ? 12 : 5)) * 0.4
            : 0;
      a.segments.forEach(
        (segment, i) =>
          (segment.position.x =
            !reducedMotion && a.moving
              ? Math.sin(time * 5 - i * 0.7 + a.phase) * 0.055
              : 0),
      );
    }
    for (const a of animalGroups) {
      a.group.scale.y = a.restPhase === 'sleeping' ? 0.65 : 1;
      if (a.restPhase === 'sleeping') {
        a.group.position.y = 0.035;
        a.group.rotation.z = a.kind === 'snake' ? 0 : 0.18;
      }
    }
    updateRegion();
    state.moving = activeAnimal?.moving ?? active.moving;
    hoverMarkerRoot.visible = !!hoveredRoot;
    if (hoveredRoot) {
      hoverMarkerRoot.position.copy(hoveredRoot.position);
      hoverMarkerRoot.quaternion.copy(hoveredRoot.quaternion);
    }
    animalMarkerRoot.visible = !!activeAnimal;
    if (activeAnimal) {
      animalMarkerRoot.position.copy(activeAnimal.root.position);
      animalMarkerRoot.quaternion.copy(activeAnimal.root.quaternion);
    }
    for (const h of houses) {
      for (const [floor, furniture] of h.floors.entries()) {
        const sitter = residents.find(
          (a) =>
            a.houseId === h.id && a.floor === floor && a.phase === 'seated',
        );
        const sip = sitter
          ? Math.max(
              0,
              Math.sin(Math.min(1, (time - sitter.drinkTime) / 1.8) * Math.PI),
            )
          : 0;
        furniture.bottle.position.set(
          0.32 + sip * 0.08,
          0.48 + sip * 0.14,
          0.12 - sip * 0.36,
        );
        furniture.bottle.rotation.z = -sip * 0.7;
        furniture.room.visible =
          !residents.some((a) => a.houseId === h.id) ||
          floor === displayedFloor(h);
      }
      const occupied = residents.some((a) => a.houseId === h.id);
      h.roof.visible = !occupied;
      h.walls.visible = !occupied;
      h.door.rotation.y = THREE.MathUtils.lerp(
        h.door.rotation.y,
        occupied ? -Math.PI * 0.6 : 0,
        Math.min(1, dt * 8),
      );
    }
    if (!manualCamera) {
      followQuat.setFromUnitVectors(
        playerNormal,
        new THREE.Vector3(0, 0.43, 0.903).normalize(),
      );
      world.quaternion.slerp(followQuat, 1 - Math.exp(-dt * 3.2));
    }
    const desiredDistance =
      zoom <= 35
        ? THREE.MathUtils.lerp(fitDistance * 1.25, fitDistance, zoom / 35)
        : THREE.MathUtils.lerp(fitDistance, 10.4, (zoom - 35) / 65);
    currentDistance = THREE.MathUtils.lerp(
      currentDistance,
      desiredDistance,
      1 - Math.exp(-dt * 6),
    );
    camera.position.set(0, 0, currentDistance);
    const close = (zoom - 35) / 65;
    camera.lookAt(0, Math.max(0, close) * 3, Math.max(0, close) * 5.8);
    if (!reducedMotion) {
      clouds.position.y = Math.sin(time * 0.32) * 0.13;
      clouds.rotation.z = Math.sin(time * 0.08) * 0.018;
    }
    collectibles.forEach((c, i) => {
      if (c.found) {
        const progress = Math.min(1, (time - c.collectedAt) / 0.55);
        c.root.visible = progress < 1 && !reducedMotion;
        c.star.scale.setScalar(
          (1 + Math.sin(progress * Math.PI) * 0.35) * (1 - progress),
        );
        c.star.position.y = 0.55 + progress * 0.7;
        c.halo.scale.setScalar(1 + progress * 2);
        c.halo.material.opacity = 0.55 * (1 - progress);
      } else if (!reducedMotion) {
        c.star.position.y = 0.55 + Math.sin(time * 2 + i) * 0.055;
        c.halo.material.opacity = 0.25 + Math.sin(time * 2 + i) * 0.08;
      }
    });
    world.updateMatrixWorld(true);
    // Face the camera so circles and diamonds remain readable anywhere on the globe.
    collectibles.forEach((c, i) => {
      c.star.quaternion
        .copy(c.root.getWorldQuaternion(new THREE.Quaternion()).invert())
        .multiply(camera.quaternion);
      if (!reducedMotion) {
        c.star.rotateY(Math.sin(time * 0.9 + i) * 0.22);
        c.star.rotateZ(Math.sin(time * 1.1 + i) * 0.08);
      }
    });
    const playerWorld = playerRoot.localToWorld(new THREE.Vector3(0, 1.2, 0));
    const screen = playerWorld.clone().project(camera);
    const visible =
      playerWorld.z > 1 &&
      screen.x > -0.93 &&
      screen.x < 0.88 &&
      screen.y > -0.8 &&
      screen.y < 0.85;
    label.style.display = visible ? 'block' : 'none';
    label.style.left = `${(screen.x * 0.5 + 0.5) * viewport.width}px`;
    label.style.top = `${(-screen.y * 0.5 + 0.5) * viewport.height}px`;
    label.textContent = activeAnimal
      ? activeAnimal.name
      : `${active.name}${active.phase === 'seated' ? ' · at the table' : active.phase === 'sleeping' ? ' · zzz' : active.phase === 'inside' ? ' · inside' : state.swimming ? ' · swimming' : ''}`;
    renderer.render(scene, camera);
    if (time - lastEmit > 0.5) {
      lastEmit = time;
      emit();
    }
  }
  animate(performance.now());
  emit();
  function screenPoint(object: THREE.Object3D, height = 0.6) {
    world.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const p = object.localToWorld(new THREE.Vector3(0, height, 0));
    const s = p.clone().project(camera);
    return {
      x: (s.x * 0.5 + 0.5) * viewport.width,
      y: (-s.y * 0.5 + 0.5) * viewport.height,
      visible: p.z > 1 && Math.abs(s.x) < 1 && Math.abs(s.y) < 1,
    };
  }
  return {
    selectPerson,
    selectAnimal,
    restAnimal,
    wakeAnimal,
    walkTo,
    enterHouse,
    leaveHouse,
    changeFloor,
    useBed: lieDown,
    wakeUp,
    useTable: sitAtTable,
    standUp,
    drinkWater,
    goTo,
    zoomBy,
    jump,
    setDirection,
    setPaused(value) {
      paused = value;
      state.moving = false;
      clearInput();
      emit();
    },
    setSound(value) {
      sound = value;
      if (value) chime([523, 659]);
    },
    home() {
      clearInput();
      manualCamera = false;
      zoom = 35;
      state.zoom = zoom;
      emit();
    },
    getState() {
      return {
        ...state,
        visited: [...state.visited],
        position: { x: playerNormal.x, y: playerNormal.y, z: playerNormal.z },
        radius: terrain(playerNormal).radius,
        target: (activeAnimal?.route ?? active.route).at(-1) ?? null,
        obstacles: obstacles.map((o) => ({
          ...o,
          center: { x: o.center.x, y: o.center.y, z: o.center.z },
        })),
        houses: houses.map((h) => ({
          id: h.id,
          name: h.name,
          size: h.size,
          style: h.style,
          floorCount: h.floors.length,
          stairsScreen: (() => {
            const p = h.stairs
              .localToWorld(new THREE.Vector3(0.63, 0.56, -0.04))
              .project(camera);
            return {
              x: (p.x * 0.5 + 0.5) * viewport.width,
              y: (-p.y * 0.5 + 0.5) * viewport.height,
              visible: Math.abs(p.x) < 1 && Math.abs(p.y) < 1,
            };
          })(),
          bottleLift: h.floors[displayedFloor(h)].bottle.position.y - 0.48,
          tableScreen: (() => {
            const p = h.floors[displayedFloor(h)].table
              .localToWorld(new THREE.Vector3(0.28, 0.46, 0.12))
              .project(camera);
            return {
              x: (p.x * 0.5 + 0.5) * viewport.width,
              y: (-p.y * 0.5 + 0.5) * viewport.height,
              visible: Math.abs(p.x) < 1 && Math.abs(p.y) < 1,
            };
          })(),
          bedScreen: (() => {
            const p = h.floors[displayedFloor(h)].bed
              .localToWorld(new THREE.Vector3(-0.22, 0.35, -0.05))
              .project(camera);
            return {
              x: (p.x * 0.5 + 0.5) * viewport.width,
              y: (-p.y * 0.5 + 0.5) * viewport.height,
              visible: Math.abs(p.x) < 1 && Math.abs(p.y) < 1,
            };
          })(),
          position: { x: h.center.x, y: h.center.y, z: h.center.z },
          door: { x: h.doorPoint.x, y: h.doorPoint.y, z: h.doorPoint.z },
          inside: { x: h.inside.x, y: h.inside.y, z: h.inside.z },
          screen: screenPoint(h.root, 0.5),
        })),
        people: residents.map((a) => ({
          id: a.id,
          name: a.name,
          color: a.color,
          position: { x: a.normal.x, y: a.normal.y, z: a.normal.z },
          moving: a.moving,
          insideHouse:
            a.phase === 'inside' ||
            a.phase === 'stairs' ||
            a.phase === 'sleeping' ||
            a.phase === 'seated'
              ? a.houseId
              : null,
          phase: a.phase,
          floor: a.floor,
          screen: screenPoint(a.root),
          route: a.route.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        })),
        collectibles: collectibles.map((c) => ({
          kind: c.kind,
          position: { x: c.normal.x, y: c.normal.y, z: c.normal.z },
          found: c.found,
        })),
        animalHomes: animalHomes.map((h) => ({
          animalId: h.animalId,
          name: h.name,
          position: { ...h.point },
          screen: screenPoint(h.root, 0.2),
          open: !h.cover.visible,
        })),
        animals: animalGroups.map((a) => ({
          id: a.id,
          name: a.name,
          screen: screenPoint(a.root, 0.3),
          route: a.route.map((p) => ({ ...p })),
          kind: a.kind,
          restPhase: a.restPhase,
          position: { x: a.normal.x, y: a.normal.y, z: a.normal.z },
          home: { x: a.home.x, y: a.home.y, z: a.home.z },
          moving: a.moving,
          hop: a.group.position.y,
        })),
        frameCount: frame,
        drawCalls: renderer.info.render.calls,
        jumpHeight: person.position.y,
        cameraDistance: currentDistance,
      };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      clearInput();
      host.removeEventListener('pointerdown', pointerdown);
      host.removeEventListener('pointermove', pointermove);
      host.removeEventListener('pointerleave', pointerleave);
      host.removeEventListener('pointerup', pointerup);
      host.removeEventListener('pointercancel', clearInput);
      host.removeEventListener('wheel', wheel);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          if (Array.isArray(o.material))
            o.material.forEach((m) => materials.add(m));
          else materials.add(o.material);
        }
      });
      [sphereGeo, coneGeo, cylinderGeo, boxGeo, ...tokenGeometries].forEach(
        (g) => geometries.add(g),
      );
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      mats.forEach((m) => m.dispose());
      shadowTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      void audio?.close();
    },
  };
}
