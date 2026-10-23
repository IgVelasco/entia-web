import * as Character from '../shared/character.ts';
import { demo } from './context.ts';
import { visibleActorAt } from './actor-sprites.ts';
import type { Point } from './rules/state.ts';

const masks = new WeakMap<HTMLImageElement | ImageBitmap, { width: number; alpha: Uint8Array }>();
function opaque(body: string, x: number, y: number) {
  const image = demo.images[body];
  if (!image) return false;
  let mask = masks.get(image);
  if (!mask) {
    const surface = document.createElement('canvas');
    surface.width = 'naturalWidth' in image ? image.naturalWidth : image.width;
    surface.height = 'naturalHeight' in image ? image.naturalHeight : image.height;
    if (!surface.width || !surface.height) return false;
    const context = surface.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
    const alpha = new Uint8Array(surface.width * surface.height);
    for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3];
    mask = { width: surface.width, alpha };
    masks.set(image, mask);
  }
  return mask.alpha[y * mask.width + x] >= 32;
}
export function spellTargetAt(point: Point): Point {
  const actors = [
    ...demo.state.enemies.filter((actor) => actor.hp > 0),
    { ...demo.state.player, body: Character.get().body || 'hero' },
  ];
  const target = visibleActorAt(actors, point, opaque);
  return target ? { x: target.x, y: target.y } : point;
}
