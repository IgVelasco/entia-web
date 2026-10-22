import type { Point, DemoState, Player, Enemy } from './state.ts';

export const tileAt = (point: Point) => ({ x: Math.floor(point.x / 32), y: Math.floor(point.y / 32) });
export function sameTile(a: Point, b: Point) {
  const first = tileAt(a),
    second = tileAt(b);
  return first.x === second.x && first.y === second.y;
}
// Movement claims its destination tile. Sprite dimensions and interpolation
// never enlarge an actor's footprint into neighbouring tiles.
export function occupiedPosition(actor: Player | Enemy): Point {
  return actor.step?.end || actor;
}
export function blockingActor(state: DemoState, self: Player | Enemy, destination: Point) {
  return [state.player, ...state.enemies].find(
    (actor) => actor !== self && actor.hp > 0 && sameTile(occupiedPosition(actor), destination),
  );
}
