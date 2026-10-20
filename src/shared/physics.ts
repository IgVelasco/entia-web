// Shared cardinal, foot-level collision rules for Nix and the training ground.
export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
// Anything with a position can block movement; actors with no hit points left are ignored.
export interface Body extends Point {
  hp?: number;
  gait?: number;
}
export interface WorldOptions {
  width: number;
  height: number;
  minX?: number;
  minY?: number;
  maxX?: number;
  maxY?: number;
  radius?: number;
  obstacles?: Rect[];
}
export interface World {
  free(x: number, y: number, others?: Body[], self?: Body | null): boolean;
  clear(a: Point, b: Point, others?: Body[], self?: Body | null): boolean;
  move(a: Body, dx: number, dy: number, others?: Body[]): number;
  path(start: Point, target: Point, others?: Body[]): Point[];
}

export function create({
  width,
  height,
  minX = 0,
  minY = 0,
  maxX = width,
  maxY = height,
  radius = 10,
  obstacles = [],
}: WorldOptions): World {
  const free = (x: number, y: number, others: Body[] = [], self: Body | null = null) =>
    x >= minX + radius + 20 &&
    x <= maxX - radius - 20 &&
    y >= minY + radius + 20 &&
    y <= maxY - radius - 20 &&
    !obstacles.some((o) => x + radius > o.x && x - radius < o.x + o.w && y + radius > o.y && y - radius < o.y + o.h) &&
    !others.some((a) => a !== self && (a.hp === undefined || a.hp > 0) && Math.hypot(x - a.x, y - a.y) < radius * 2);
  function clear(a: Point, b: Point, others: Body[] = [], self: Body | null = null) {
    const length = Math.hypot(b.x - a.x, b.y - a.y),
      n = Math.max(1, Math.ceil(length / 4));
    for (let i = 1; i <= n; i++)
      if (!free(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, others, self)) return false;
    return true;
  }
  function move(a: Body, dx: number, dy: number, others: Body[] = []) {
    if (dx && dy) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    const length = Math.hypot(dx, dy),
      n = Math.max(1, Math.ceil(length / 4));
    let travelled = 0;
    for (let i = 0; i < n; i++) {
      const x = a.x + dx / n,
        y = a.y + dy / n;
      if (!free(x, y, others, a)) break;
      a.x = x;
      a.y = y;
      travelled += length / n;
    }
    a.gait = (a.gait || 0) + travelled;
    return travelled;
  }
  function path(start: Point, target: Point, others: Body[] = []): Point[] {
    if (!free(target.x, target.y, others, start)) return [];
    const direct = [
      { x: start.x, y: target.y },
      { x: target.x, y: target.y },
    ];
    if (clear(start, direct[0], others, start) && clear(direct[0], target, others, start))
      return direct.filter((p, i) => i || Math.hypot(p.x - start.x, p.y - start.y) > 0.01);
    const step = 16,
      key = (x: number, y: number) => x + ',' + y,
      queue = [{ x: 0, y: 0, prev: -1 }],
      seen = new Set(['0,0']);
    let found = -1;
    for (let i = 0; i < queue.length && queue.length < 12000; i++) {
      const q = queue[i],
        p = { x: start.x + q.x * step, y: start.y + q.y * step };
      if (Math.abs(p.x - target.x) <= step && Math.abs(p.y - target.y) <= step) {
        const elbow = { x: p.x, y: target.y };
        if (clear(p, elbow, others, start) && clear(elbow, target, others, start)) {
          found = i;
          break;
        }
      }
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        const x = q.x + dx,
          y = q.y + dy,
          k = key(x, y);
        if (seen.has(k)) continue;
        seen.add(k);
        const next = { x: start.x + x * step, y: start.y + y * step };
        if (clear(p, next, others, start)) queue.push({ x, y, prev: i });
      }
    }
    if (found < 0) return [];
    const points: Point[] = [];
    for (let i = found; i > 0; i = queue[i].prev)
      points.push({ x: start.x + queue[i].x * step, y: start.y + queue[i].y * step });
    points.reverse();
    const end = points.at(-1) || start;
    points.push({ x: end.x, y: target.y }, { x: target.x, y: target.y });
    const result: Point[] = [];
    let prev = start;
    for (const p of points) {
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < 0.01) continue;
      const a = result.at(-2) || start,
        b = result.at(-1);
      if (b && ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))) result[result.length - 1] = p;
      else result.push(p);
      prev = p;
    }
    return result;
  }
  return { free, clear, move, path };
}
export function presentationScale(width: number, zoom = 1) {
  return Math.max(0.95, Math.min(width / 700, 1.32)) * zoom;
}
