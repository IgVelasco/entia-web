import type { Point } from './rules/state.ts';

export interface SpriteActor extends Point {
  dir: number;
  gait: number;
  moving?: boolean;
}
export function actorFrame(actor: SpriteActor, body: string) {
  const stride = body === 'mage' ? 32 : 64;
  const frame = !body.startsWith('npc-') && actor.moving ? 1 + (Math.floor((actor.gait / stride) * 7) % 7) : 0;
  return {
    sx: frame * 96,
    sy: actor.dir * 160,
    x: Math.round(actor.x - 30),
    y: Math.round(actor.y - 99.375),
    width: 60,
    height: 100,
  };
}
export function spritePixel(actor: SpriteActor, body: string, point: Point) {
  const frame = actorFrame(actor, body);
  const dx = point.x - frame.x,
    dy = point.y - frame.y;
  if (dx < 0 || dy < 0 || dx >= frame.width || dy >= frame.height) return null;
  return { x: frame.sx + Math.floor((dx * 96) / frame.width), y: frame.sy + Math.floor((dy * 160) / frame.height) };
}
export function visibleActorAt(
  actors: (SpriteActor & { body: string })[],
  point: Point,
  opaque: (body: string, x: number, y: number) => boolean,
) {
  // Reverse painter order: the frontmost visible pixel wins, including the
  // player when overlapping a rival. Transparent source padding is not a hit.
  const sorted = actors
    .slice()
    .sort((a, b) => a.y - b.y)
    .reverse();
  return sorted.find((actor) => {
    const pixel = spritePixel(actor, actor.body, point);
    return pixel && opaque(actor.body, pixel.x, pixel.y);
  });
}
