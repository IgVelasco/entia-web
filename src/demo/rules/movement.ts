import type { Input, Player, Point } from './state.ts';

// Godot's on-foot cadence: one cardinal 32px tile every 200ms.
export const TILE = 32;
export const WALK_SPEED = TILE / 0.2;
const EPSILON = 0.000001;

export function cardinal(x: number, y: number): Point {
  return Math.abs(x) >= Math.abs(y) ? { x: Math.sign(x), y: 0 } : { x: 0, y: Math.sign(y) };
}

interface WalkWorld {
  clear(start: Point, end: Point): boolean;
  move(dx: number, dy: number): number;
  constrain?(end: Point): Point;
}

// A release finishes its tile; turns wait for that tile. Carry unused frame time
// into a continuing straight step, so walking has no frame-rate-dependent pause.
export function walk(player: Player, dt: number, input: Input, world: WalkWorld, route?: Point[]) {
  player.moving = false;
  const vector = cardinal(input.x || 0, input.y || 0);
  let budget = Math.max(0, Math.min(dt, 0.05)) * WALK_SPEED;
  while (budget > EPSILON) {
    while (route?.length && Math.hypot(route[0].x - player.x, route[0].y - player.y) < EPSILON) route.shift();
    const goal = route?.[0];
    const direction = route ? (goal ? cardinal(goal.x - player.x, goal.y - player.y) : { x: 0, y: 0 }) : vector;
    if (!player.step) {
      if (!direction.x && !direction.y) break;
      const length = goal ? Math.min(TILE, Math.abs(direction.x ? goal.x - player.x : goal.y - player.y)) : TILE;
      const candidate = { x: player.x + direction.x * length, y: player.y + direction.y * length };
      const end = world.constrain?.(candidate) || candidate;
      player.dir = direction.x ? (direction.x > 0 ? 1 : 3) : direction.y > 0 ? 2 : 0;
      const remaining = Math.hypot(end.x - player.x, end.y - player.y);
      if (remaining < EPSILON || !world.clear(player, end)) break;
      player.step = { ...direction, end, remaining };
    }
    const step = player.step;
    const distance = Math.min(step.remaining, budget);
    const moved = world.move(step.x * distance, step.y * distance);
    player.moving ||= moved > EPSILON;
    step.remaining -= moved;
    budget -= moved;
    if (moved < distance - EPSILON) {
      player.step = null;
      break;
    }
    if (step.remaining > EPSILON) break;
    player.x = step.end.x;
    player.y = step.end.y;
    player.step = null;
    // Preserve cardinal movement even when the frame straddles a queued turn.
    const next = route?.find((point) => Math.hypot(point.x - player.x, point.y - player.y) >= EPSILON);
    const intent = route ? (next ? cardinal(next.x - player.x, next.y - player.y) : { x: 0, y: 0 }) : vector;
    if (intent.x !== step.x || intent.y !== step.y) break;
  }
}
