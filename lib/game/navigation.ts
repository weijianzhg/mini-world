import { angularDistance, normal, normalize, type Point } from './world';
export type Obstacle = {
  id: string;
  center: Point;
  radius: number;
  kind: 'tree' | 'house';
};
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z;
export class Navigator {
  private nodes: Point[] = [];
  private free: boolean[] = [];
  private readonly rows = 80;
  private readonly cols = 160;
  constructor(
    readonly obstacles: Obstacle[],
    readonly allowed?: (point: Point) => boolean,
  ) {}
  clear(p: Point, ignore?: string) {
    return (
      (!this.allowed || this.allowed(p)) &&
      this.obstacles.every(
        (o) => o.id === ignore || dot(p, o.center) < Math.cos(o.radius),
      )
    );
  }
  segmentClear(a: Point, b: Point, ignore?: string) {
    const angle = angularDistance(a, b);
    if (angle < 1e-7) return this.clear(a, ignore);
    if (angle > Math.PI - 0.001) return false;
    const cosine = dot(a, b),
      sine = Math.sin(angle);
    const tangent = {
      x: (b.x - a.x * cosine) / sine,
      y: (b.y - a.y * cosine) / sine,
      z: (b.z - a.z * cosine) / sine,
    };
    // Check the whole arc, not just its destination, so routes cannot cut across water.
    if (this.allowed) {
      const steps = Math.max(1, Math.ceil(angle / 0.004));
      for (let i = 0; i <= steps; i++) {
        const t = (angle * i) / steps;
        if (
          !this.allowed({
            x: a.x * Math.cos(t) + tangent.x * Math.sin(t),
            y: a.y * Math.cos(t) + tangent.y * Math.sin(t),
            z: a.z * Math.cos(t) + tangent.z * Math.sin(t),
          })
        )
          return false;
      }
    }
    for (const o of this.obstacles) {
      if (o.id === ignore) continue;
      const A = dot(a, o.center),
        B = dot(tangent, o.center),
        closest = Math.atan2(B, A);
      let maximum = Math.max(A, dot(b, o.center));
      if (closest >= 0 && closest <= angle)
        maximum = Math.max(maximum, Math.hypot(A, B));
      if (maximum >= Math.cos(o.radius)) return false;
    }
    return true;
  }
  nearestFree(point: Point) {
    let p = normalize(point);
    for (let i = 0; i < 30; i++) {
      const obstacle = this.obstacles.find(
        (o) => dot(p, o.center) >= Math.cos(o.radius + 0.004),
      );
      if (!obstacle) {
        if (!this.allowed || this.allowed(p)) return p;
        break;
      }
      let t = normalize({
        x: p.x - obstacle.center.x * dot(p, obstacle.center),
        y: p.y - obstacle.center.y * dot(p, obstacle.center),
        z: p.z - obstacle.center.z * dot(p, obstacle.center),
      });
      if (Math.hypot(t.x, t.y, t.z) < 0.5) {
        const axis =
          Math.abs(obstacle.center.y) < 0.9
            ? { x: 0, y: 1, z: 0 }
            : { x: 1, y: 0, z: 0 };
        const d = dot(axis, obstacle.center);
        t = normalize({
          x: axis.x - d * obstacle.center.x,
          y: axis.y - d * obstacle.center.y,
          z: axis.z - d * obstacle.center.z,
        });
      }
      const r = obstacle.radius + 0.012;
      p = normalize({
        x: obstacle.center.x * Math.cos(r) + t.x * Math.sin(r),
        y: obstacle.center.y * Math.cos(r) + t.y * Math.sin(r),
        z: obstacle.center.z * Math.cos(r) + t.z * Math.sin(r),
      });
    }
    this.build();
    return this.nodes
      .filter((_, i) => this.free[i])
      .reduce(
        (best, n) => (dot(n, point) > dot(best, point) ? n : best),
        this.nodes[this.free.indexOf(true)],
      );
  }
  private build() {
    if (this.nodes.length) return;
    for (let y = 0; y < this.rows; y++)
      for (let x = 0; x < this.cols; x++) {
        const p = normal(
          -Math.PI / 2 + ((y + 0.5) * Math.PI) / this.rows,
          -Math.PI + (x * 2 * Math.PI) / this.cols,
        );
        this.nodes.push(p);
        this.free.push(this.clear(p));
      }
  }
  route(start: Point, destination: Point): Point[] | null {
    const goal = this.nearestFree(destination);
    if (this.segmentClear(start, goal)) return [goal];
    this.build();
    // A* on a wrapped spherical grid. Every edge is checked, including diagonals.
    const count = this.nodes.length,
      g = new Float64Array(count).fill(Infinity),
      parent = new Int32Array(count).fill(-1),
      closed = new Uint8Array(count);
    const heap: { id: number; f: number }[] = [];
    const push = (value: { id: number; f: number }) => {
      heap.push(value);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p].f <= value.f) break;
        heap[i] = heap[p];
        i = p;
      }
      heap[i] = value;
    };
    const pop = () => {
      const first = heap[0],
        last = heap.pop()!;
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let c = i * 2 + 1;
          if (c + 1 < heap.length && heap[c + 1].f < heap[c].f) c++;
          if (heap[c].f >= last.f) break;
          heap[i] = heap[c];
          i = c;
        }
        heap[i] = last;
      }
      return first;
    };
    const candidates = this.nodes
      .map((p, id) => ({ id, d: dot(p, start) }))
      .filter((n) => this.free[n.id])
      .sort((a, b) => b.d - a.d);
    let attached = 0;
    for (const c of candidates) {
      if (attached >= 8) break;
      if (!this.segmentClear(start, this.nodes[c.id])) continue;
      g[c.id] = angularDistance(start, this.nodes[c.id]);
      push({ id: c.id, f: g[c.id] + angularDistance(this.nodes[c.id], goal) });
      attached++;
    }
    while (heap.length) {
      const { id } = pop();
      if (closed[id]) continue;
      closed[id] = 1;
      const p = this.nodes[id];
      if (angularDistance(p, goal) < 0.1 && this.segmentClear(p, goal)) {
        const raw: Point[] = [goal];
        let k = id;
        while (k !== -1) {
          raw.unshift(this.nodes[k]);
          k = parent[k];
        }
        const result: Point[] = [];
        let anchor = start;
        for (let i = 0; i < raw.length;) {
          let next = raw.length - 1;
          while (next > i && !this.segmentClear(anchor, raw[next])) next--;
          result.push(raw[next]);
          anchor = raw[next];
          i = next + 1;
        }
        return result;
      }
      const y = Math.floor(id / this.cols),
        x = id % this.cols;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const yy = y + dy;
          if (yy < 0 || yy >= this.rows) continue;
          const n = yy * this.cols + ((x + dx + this.cols) % this.cols);
          if (closed[n] || !this.free[n]) continue;
          const distance = g[id] + angularDistance(p, this.nodes[n]);
          if (distance >= g[n] || !this.segmentClear(p, this.nodes[n]))
            continue;
          g[n] = distance;
          parent[n] = id;
          push({ id: n, f: distance + angularDistance(this.nodes[n], goal) });
        }
    }
    return null;
  }
}
