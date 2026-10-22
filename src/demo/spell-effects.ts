import art from './spell-art.json';
import type { DemoState, Effect, Point } from './rules/state.ts';

export const spellWords: Record<string, string> = art.words;

export function effectAnchor(effect: Effect, state: DemoState): Point {
  if (effect.targetId === 'player') return state.player;
  return state.enemies.find((enemy) => enemy.name === effect.targetId && enemy.hp > 0) || effect;
}

export function effectFrame(effect: Effect, reduced = false) {
  const age = effect.age - (effect.owner === 'enemy' ? 0.3 : 0);
  if (age < 0) return null;
  if (effect.owner === 'bind' || (effect.owner === 'enemy' && effect.spell === 'inmovilizar')) {
    const spec = art.inmovilizar;
    const frame = Math.floor(age * spec.fps);
    if (frame >= spec.frames) return null;
    return { kind: 'bind' as const, frame: reduced ? 7 : frame, age };
  }
  if (effect.owner === 'player' || effect.owner === 'enemy') {
    const spec = art.apocalipsis;
    if (age >= spec.lifetimeMoves / spec.movesPerSecond) return null;
    return { kind: 'apocalipsis' as const, frame: 0, age };
  }
  return null;
}

// Textures and timings come from the Godot catalogs. Only transforms and
// compositing run here; no procedural substitute circles are spell artwork.
export function drawSpellEffect(
  ctx: CanvasRenderingContext2D,
  images: Record<string, HTMLImageElement | ImageBitmap>,
  effect: Effect,
  state: DemoState,
  reduced: boolean,
) {
  const anchor = effectAnchor(effect, state);
  if (effect.owner === 'words') {
    const words = effect.spell && spellWords[effect.spell];
    if (!words || effect.age >= 1.2) return;
    ctx.save();
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#08130f';
    ctx.fillStyle = '#f4e6c5';
    ctx.globalAlpha = reduced ? 1 : Math.min(1, (1.2 - effect.age) / 0.2);
    ctx.strokeText(words, anchor.x, anchor.y - 122);
    ctx.fillText(words, anchor.x, anchor.y - 122);
    ctx.restore();
    return;
  }
  const visual = effectFrame(effect, reduced);
  if (!visual) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (visual.kind === 'bind') {
    const spec = art.inmovilizar;
    ctx.globalAlpha = spec.intensity;
    ctx.drawImage(
      images.spellBind,
      (visual.frame % spec.columns) * spec.width,
      Math.floor(visual.frame / spec.columns) * spec.height,
      spec.width,
      spec.height,
      anchor.x - spec.width / 2,
      anchor.y + spec.offsetY + spec.nudgeY - spec.height,
      spec.width,
      spec.height,
    );
  } else {
    const spec = art.apocalipsis;
    // Godot anchors particles to the body/head center; these browser actors
    // stand 100px tall. The authored stream then adds its 20px spawn offset.
    ctx.translate(anchor.x, anchor.y - 50 + spec.spawnY);
    if (!reduced) ctx.rotate((visual.age * spec.movesPerSecond * spec.degreesPerMove * Math.PI) / 180);
    for (let i = 0; i < spec.particles; i++)
      ctx.drawImage(images.spellApocalipsis, -spec.width / 2, -spec.height / 2, spec.width, spec.height);
  }
  ctx.restore();
}
