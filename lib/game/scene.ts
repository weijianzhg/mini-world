import * as THREE from 'three';
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

export type GameState = {
  region: Region;
  swimming: boolean;
  stars: number;
  visited: Region[];
  moving: boolean;
  zoom: number;
  ready: boolean;
};
export type Game = {
  goTo: (region: Region) => void;
  zoomBy: (amount: number) => void;
  home: () => void;
  jump: () => void;
  setDirection: (key: string, pressed: boolean) => void;
  setPaused: (paused: boolean) => void;
  setSound: (enabled: boolean) => void;
  getState: () => GameState & {
    position: Point;
    radius: number;
    target: Point | null;
    frameCount: number;
    drawCalls: number;
    jumpHeight: number;
    cameraDistance: number;
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
  renderer.toneMappingExposure = 1.32;
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
          roughness: 0.88,
          metalness: 0,
        }),
      );
    return mats.get(color)!;
  }
  const sphereGeo = new THREE.SphereGeometry(1, 12, 9),
    coneGeo = new THREE.ConeGeometry(1, 1, 7),
    cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8),
    boxGeo = new THREE.BoxGeometry(1, 1, 1);
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
    const land = terrain(mid);
    const variation = 0.96 + rand() * 0.075;
    const color =
      land.region === 'ocean'
        ? land.edge > -0.07
          ? '#70cbd4'
          : '#3eafca'
        : land.shore
          ? '#f2d793'
          : land.region === 'forest'
            ? '#82b860'
            : land.region === 'desert'
              ? '#ebc980'
              : '#e4edef';
    col.set(color).multiplyScalar(variation);
    for (let k = 0; k < 3; k++) {
      const n = new THREE.Vector3().fromBufferAttribute(pos, i + k).normalize();
      const height = terrain(n).radius;
      pos.setXYZ(i + k, n.x * height, n.y * height, n.z * height);
      colors.set([col.r, col.g, col.b], (i + k) * 3);
    }
  }
  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const earth = new THREE.Mesh(
    ground,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      flatShading: true,
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
  const staticRoot = new THREE.Group();
  world.add(staticRoot);
  function keepStatic(g: THREE.Group) {
    world.remove(g);
    staticRoot.add(g);
  }
  function tree(n: Point, scale: number, pine: boolean, snowy = false) {
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
  const animalGroups: { group: THREE.Group; phase: number; kind: string }[] =
    [];
  function animal(n: Point, kind: string) {
    const g = at(n);
    g.rotateY(rand() * 6.28);
    const a = new THREE.Group();
    g.add(a);
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
          stick(a, '#665e50', [x, 0.06, z], [0.03, 0.16, 0.03]);
    }
    animalGroups.push({ group: a, phase: rand() * 6.28, kind });
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
  // A cabin and a quiet jetty are landmarks the child can return to.
  const cabin = at(normal(0.69, -0.75));
  cabin.rotateY(0.5);
  box(cabin, '#d0a16e', [0, 0.24, 0], [0.62, 0.5, 0.48]);
  const roof = mesh(
    cabin,
    new THREE.ConeGeometry(0.53, 0.36, 4),
    '#c97c61',
    [0, 0.65, 0],
    [1, 1, 0.85],
  );
  roof.rotation.y = Math.PI / 4;
  box(cabin, '#796448', [0, 0.16, 0.245], [0.17, 0.31, 0.02]);
  box(cabin, '#f9e8a3', [0.21, 0.33, 0.25], [0.12, 0.12, 0.02]);
  stick(cabin, '#e5c494', [0.35, 0.16, 0.05], [0.04, 0.32, 0.04]);
  keepStatic(cabin);
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
  animalGroups.forEach((a) => combineVisual(a.group));
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
  const playerNormal = new THREE.Vector3().copy(normal(0.25, -0.25));
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
  ball(person, '#f1bb51', [0, 0.38, 0], [0.21, 0.24, 0.16]);
  const armL = ball(person, '#f1bb51', [-0.23, 0.38, 0], [0.065, 0.19, 0.075]),
    armR = ball(person, '#f1bb51', [0.23, 0.38, 0], [0.065, 0.19, 0.075]);
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
  // Collectible stars provide a gentle, optional reason to wander.
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 + Math.PI / 2,
      r = i % 2 ? 0.105 : 0.235;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();
  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.02,
    bevelSegments: 1,
    steps: 1,
  });
  starGeo.translate(0, 0, -0.025);
  const collectibles: {
    root: THREE.Group;
    star: THREE.Mesh;
    normal: THREE.Vector3;
    found: boolean;
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
  for (const [lat, lon] of starLocations) {
    const n = new THREE.Vector3().copy(normal(lat, lon)),
      root = at(n),
      star = new THREE.Mesh(starGeo, material('#ffd65c'));
    star.position.y = 0.55;
    root.add(star);
    collectibles.push({ root, star, normal: n, found: false });
  }
  let zoom = 35;
  const state: GameState = {
    region: 'forest',
    swimming: false,
    stars: 0,
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
    jumpTime = -5,
    manualCamera = false,
    target: THREE.Vector3 | null = null,
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
    onState({ ...state, visited: [...state.visited] });
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
    if (paused || time - jumpTime < 0.8) return;
    jumpTime = time;
    chime([state.swimming ? 440 : 660]);
  }
  function setDirection(key: string, pressed: boolean) {
    if (pressed && !paused) {
      keys.add(key.toLowerCase());
      target = null;
      manualCamera = false;
    } else keys.delete(key.toLowerCase());
  }
  function clearInput() {
    keys.clear();
    pointers.clear();
    drag = null;
    pinchDistance = 0;
    target = null;
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
      target = null;
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
      const hit = raycaster.intersectObject(earth)[0];
      if (hit) {
        target = world.worldToLocal(hit.point.clone()).normalize();
        manualCamera = false;
      }
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
  function goTo(region: Region) {
    if (paused) return;
    clearInput();
    const r = REGIONS[region];
    playerNormal.copy(normal(r.lat, r.lon));
    manualCamera = false;
    jumpTime = -5;
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
    let moving = false;
    const t = terrain(playerNormal);
    if (!paused) {
      const dx =
          Number(keys.has('arrowright') || keys.has('d')) -
          Number(keys.has('arrowleft') || keys.has('a')),
        dy =
          Number(keys.has('arrowup') || keys.has('w')) -
          Number(keys.has('arrowdown') || keys.has('s'));
      let dir: THREE.Vector3 | null = null;
      if (dx || dy) {
        const inverse = world.quaternion.clone().invert();
        dir = new THREE.Vector3(dx, dy, 0)
          .applyQuaternion(camera.quaternion)
          .applyQuaternion(inverse);
      } else if (target) {
        const angle = angularDistance(playerNormal, target);
        if (angle < 0.013) target = null;
        else
          dir = target
            .clone()
            .addScaledVector(playerNormal, -target.dot(playerNormal));
      }
      if (dir && dir.lengthSq() > 0.00001) {
        const speed = t.region === 'ocean' ? 0.18 : 0.235;
        const next = advance(playerNormal, dir, dt * speed);
        const tangent = new THREE.Vector3()
          .copy(next)
          .sub(playerNormal)
          .normalize();
        playerNormal.copy(next);
        const orient = new THREE.Quaternion().setFromUnitVectors(
          up,
          playerNormal,
        );
        const local = tangent.applyQuaternion(orient.clone().invert());
        person.rotation.y = THREE.MathUtils.lerp(
          person.rotation.y,
          Math.atan2(local.x, local.z),
          Math.min(1, dt * 14),
        );
        moving = true;
      }
      updateRegion();
      for (const c of collectibles) {
        if (!c.found && angularDistance(playerNormal, c.normal) < 0.066) {
          c.found = true;
          c.root.visible = false;
          state.stars++;
          onMessage(
            state.stars === 12
              ? 'You found every star! What a wonderful explorer.'
              : `${state.stars === 1 ? 'Your first star!' : 'A little star for you!'} ${state.stars} of 12`,
          );
          chime();
          emit();
        }
      }
    }
    state.moving = moving;
    const currentTerrain = terrain(playerNormal);
    playerRoot.position
      .copy(playerNormal)
      .multiplyScalar(currentTerrain.radius);
    playerRoot.quaternion.setFromUnitVectors(up, playerNormal);
    const jumpAge = time - jumpTime,
      jumpHeight =
        jumpAge >= 0 && jumpAge < 0.8
          ? Math.sin((jumpAge / 0.8) * Math.PI) * 0.45
          : 0;
    person.position.y =
      jumpHeight +
      (state.swimming
        ? -0.15 + Math.sin(time * 4) * 0.035
        : moving
          ? Math.abs(Math.sin(time * 12)) * 0.035
          : 0);
    floatRing.visible = state.swimming;
    marker.visible = !state.swimming;
    const stride = moving
      ? Math.sin(time * (state.swimming ? 7 : 12)) * 0.48
      : 0;
    leftLeg.rotation.x = stride;
    rightLeg.rotation.x = -stride;
    armL.rotation.x = -stride;
    armR.rotation.x = stride;
    armL.rotation.z = state.swimming ? -0.8 : 0;
    armR.rotation.z = state.swimming ? 0.8 : 0;
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
      animalGroups.forEach((a) => {
        a.group.position.y =
          Math.max(0, Math.sin(time * 0.7 + a.phase)) * 0.035;
        a.group.rotation.z = Math.sin(time * 1.2 + a.phase) * 0.025;
      });
      collectibles.forEach((c, i) => {
        c.star.rotation.y = time * 0.8;
        c.star.position.y = 0.52 + Math.sin(time * 2 + i) * 0.065;
      });
    }
    world.updateMatrixWorld(true);
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
    label.textContent = state.swimming ? 'Little swimmer' : 'You!';
    renderer.render(scene, camera);
    if (time - lastEmit > 0.5) {
      lastEmit = time;
      emit();
    }
  }
  animate(performance.now());
  emit();
  return {
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
        target: target ? { x: target.x, y: target.y, z: target.z } : null,
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
      [sphereGeo, coneGeo, cylinderGeo, boxGeo, starGeo].forEach((g) =>
        geometries.add(g),
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
