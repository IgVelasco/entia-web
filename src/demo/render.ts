import * as Character from '../shared/character.ts';
import * as Physics from '../shared/physics.ts';
import M from './rules/navigation.ts';
import { $, canvas, ctx, demo, floor, reduced } from './context.ts';
import { drawSpellEffect } from './spell-effects.ts';
import { schedule } from './loop.ts';
import type { Drop, Point, SceneryItem } from './rules/state.ts';

// Anything drawn from a character sheet: player, rivals and guides.
interface Actor extends Point {
  dir: number;
  gait: number;
  moving?: boolean;
}
// One painter-ordered layer; each kind carries only its own fields.
type Layer = { sortY?: number } & (
  | (SceneryItem & { type: 'scenery' })
  | (Drop & { type: 'drop' })
  | { type: 'portal'; y: number }
  | { type: 'bank'; y: number }
  | (Actor & { type?: undefined; body: string; player?: boolean })
);

export function buildFloor() {
  if (floor.width !== M.WIDTH) floor.width = M.WIDTH;
  if (floor.height !== M.HEIGHT) floor.height = M.HEIGHT;
  const c = floor.getContext('2d')!;
  if (c.isContextLost?.()) return;
  c.imageSmoothingEnabled = false;
  for (let y = 0; y < M.HEIGHT; y += M.TILE)
    for (let x = 0; x < M.WIDTH; x += M.TILE) c.drawImage(demo.images.grass, x, y, M.TILE, M.TILE);
  c.save();
  c.beginPath();
  c.rect(128, 384, 864, 96);
  c.rect(576, 320, 96, 480);
  c.rect(128, 480, 96, 224);
  c.clip();
  for (let y = 0; y < M.HEIGHT; y += M.TILE)
    for (let x = 0; x < M.WIDTH; x += M.TILE) c.drawImage(demo.images.path, x, y, M.TILE, M.TILE);
  c.restore();
  for (let y = 352; y < 512; y += M.TILE)
    for (let x = 64; x < 288; x += M.TILE) c.drawImage(demo.images.stone, x, y, M.TILE, M.TILE);
  const shade = c.createRadialGradient(580, 450, 100, 580, 450, 780);
  shade.addColorStop(0, '#203a2610');
  shade.addColorStop(1, '#03120ed9');
  c.fillStyle = shade;
  c.fillRect(0, 0, M.WIDTH, M.HEIGHT);
  demo.floorReady = true;
}
export function resize() {
  if (demo.hostSuspended) return;
  const r = canvas.getBoundingClientRect();
  demo.width = r.width;
  demo.height = r.height;
  demo.dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2000000 / Math.max(1, demo.width * demo.height)));
  if (canvas.width !== Math.round(demo.width * demo.dpr)) canvas.width = Math.round(demo.width * demo.dpr);
  if (canvas.height !== Math.round(demo.height * demo.dpr)) canvas.height = Math.round(demo.height * demo.dpr);
  updateView();
  schedule();
}
function updateView() {
  const p = demo.state.player;
  const hall = demo.state.phase === 'hallway';
  const baseScale = demo.inheritedScale || Physics.presentationScale(window.innerWidth || demo.width);
  demo.scale = hall ? Math.min(baseScale, Math.max(0.35, (demo.height - 32) / 320)) : baseScale;
  demo.camera.x = p.x;
  demo.camera.y = hall ? M.hallway.cameraY : p.y;
  demo.ox = demo.width / 2 - demo.camera.x * demo.scale;
  demo.oy = demo.height / 2 - demo.camera.y * demo.scale;
}
function ellipse(x: number, y: number, rx: number, ry: number, color: string, line = false) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (line) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = color;
    ctx.fill();
  }
}
function text(s: string, x: number, y: number, color = '#e6e4cc', size = 13) {
  ctx.font = `${size}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#07120f';
  ctx.fillText(s, x + 1, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
export function actor(a: Actor, body: string, player = false) {
  const im = demo.images[body];
  const stride = body === 'mage' ? 32 : 64;
  const f = !body.startsWith('npc-') && a.moving ? 1 + (Math.floor((a.gait / stride) * 7) % 7) : 0;
  ellipse(a.x, a.y + 1, 16, 5, '#00110cc0');
  if (player) ellipse(a.x, a.y + 2, 20, 8, '#e8d491', true);
  ctx.drawImage(im, f * 96, a.dir * 160, 96, 160, Math.round(a.x - 30), Math.round(a.y - 99.375), 60, 100);
}
export function resourceBar(a: Point, value: number, maxValue: number, yOffset = 12, mana = false) {
  const x = Math.round(a.x) - 23,
    y = Math.round(a.y) + yOffset,
    fill = Math.round(42 * Math.max(0, Math.min(1, value / maxValue)));
  ctx.fillStyle = '#070b08';
  ctx.fillRect(x, y, 46, 8);
  ctx.fillStyle = '#938053';
  ctx.fillRect(x + 1, y + 1, 44, 6);
  ctx.fillStyle = mana ? '#102535' : '#35121a';
  ctx.fillRect(x + 2, y + 2, 42, 4);
  ctx.fillStyle = mana ? '#1687ba' : '#b92b43';
  ctx.fillRect(x + 2, y + 2, fill, 4);
  ctx.fillStyle = mana ? '#72d4f1' : '#ed7883';
  ctx.fillRect(x + 2, y + 2, fill, 1);
}
function drawDrop(drop: Drop) {
  ellipse(drop.x, drop.y + 10, 10, 4, '#00190f88');
  drawEssence(ctx, drop.x - 8, drop.y - 16, 16, 32);
  text(String(drop.amount), drop.x, drop.y - 23, drop.owner === 'player' ? '#f4d595' : '#bce8b2', 12);
}
function portal() {
  const frame = reduced.matches ? 0 : Math.floor(demo.state.time * 10) % 8;
  const p = M.gateway;
  ctx.save();
  ctx.shadowColor = '#bddd66';
  ctx.shadowBlur = reduced.matches ? 0 : 22;
  ctx.drawImage(
    demo.images.portal,
    (frame % 4) * 240,
    Math.floor(frame / 4) * 320,
    240,
    320,
    p.x - 96,
    p.y - 248,
    192,
    256,
  );
  ctx.restore();
  text('RETURN TO NIX', p.x, p.y + 32, '#d8e9b1', 13);
}
export function draw() {
  if (!demo.ready) return;
  ctx.setTransform(demo.dpr, 0, 0, demo.dpr, 0, 0);
  ctx.fillStyle = '#091911';
  ctx.fillRect(0, 0, demo.width, demo.height);
  const p = demo.state.player;
  updateView();
  ctx.translate(demo.ox, demo.oy);
  ctx.scale(demo.scale, demo.scale);
  ctx.imageSmoothingEnabled = false;
  if (demo.state.phase === 'hallway') {
    drawHallway();
    drawDestination();
    actor(p, Character.get().body || 'hero', true);
    return;
  }
  if (!demo.floorReady) buildFloor();
  ctx.drawImage(floor, 0, 0);
  drawDestination();
  text('NIX REFUGE', 164, 590, '#b3bc9a', 11);
  for (const e of demo.state.enemies) {
    if (demo.state.phase !== 'arena' || e.hp <= 0) continue;
    if (e.wind > 0) {
      ellipse(e.x, e.y, 70 * (1 - e.wind / 0.85), 27 * (1 - e.wind / 0.85), '#e7966955');
      ellipse(e.x, e.y, 70, 27, '#f0a16a', true);
    } else ellipse(e.x, e.y + 2, 25, 10, '#db9b6655', true);
  }
  // Scenery, drops, props and actors drawn in painter order; each kind carries only its own fields.
  const layers = (
    [
      ...M.scenery.map((s) => ({ ...s, type: 'scenery' })),
      ...demo.state.drops.map((d) => ({
        ...d,
        type: 'drop',
        sortY: M.canPickup(demo.state, d) ? p.y + 0.1 : d.y - 0.1,
      })),
      { type: 'portal', y: M.gateway.y },
      ...(demo.state.bankUnlocked ? [{ type: 'bank', y: M.bankAt(demo.state).y }] : []),
      ...(demo.state.phase === 'arena' &&
      demo.state.tutorial?.stage !== 'complete' &&
      demo.state.tutorial?.stage !== 'setup'
        ? demo.state.enemies.filter((e) => e.hp > 0)
        : []),
      ...(demo.state.tutorial?.stage === 'complete'
        ? [{ ...M.guides[2], x: M.bankAt(demo.state).x + 64, y: M.bankAt(demo.state).y }]
        : []),
      { ...p, body: Character.get().body || 'hero', player: true },
    ] as Layer[]
  ).sort((a, b) => (a.sortY ?? a.y) - (b.sortY ?? b.y));
  for (const a of layers) {
    if (a.type === 'scenery') ctx.drawImage(demo.images[a.id], a.x - a.w / 2, a.y - a.h, a.w, a.h);
    else if (a.type === 'drop') drawDrop(a);
    else if (a.type === 'portal') portal();
    else if (a.type === 'bank') {
      renderBank();
    } else actor(a, a.body, a.player);
  }
  if (
    demo.state.phase === 'arena' &&
    demo.state.tutorial?.stage !== 'complete' &&
    demo.state.tutorial?.stage !== 'setup'
  )
    for (const e of demo.state.enemies) {
      if (e.hp <= 0) continue;
      text(e.name, e.x, e.y - 98, '#d9c79c', 12);
      resourceBar(e, e.hp, e.maxHp);
    }
  for (const f of demo.state.fx) {
    if (f.owner === 'melee') {
      if (f.age < 0.25) ellipse(f.x, f.y, 20 + f.age * 30, 8 + f.age * 15, '#e8d5a7', true);
    } else drawSpellEffect(ctx, demo.images, f, demo.state, reduced.matches);
  }
  resourceBar(p, p.hp, 100);
  resourceBar(p, p.mana, 100, 22, true);
  const playerName = Character.get().name;
  if (playerName) text(playerName, p.x, p.y - 102, '#ded2a1', 12);
  if (p.immobilized > 0) text('IMMOVILIZED', p.x, p.y - 130, '#b4c9ed', 11);
  for (const e of demo.state.enemies)
    if (e.hp > 0 && e.immobilized > 0) text('IMMOVILIZED', e.x, e.y - 115, '#b4c9ed', 10);
  if (demo.state.carried) {
    text(`✦ ${demo.state.carried}`, p.x, p.y - 112, '#f3d586', 15);
  }
  for (const particle of demo.state.streamParticles) {
    const t = particle.age / 0.55,
      ease = 1 - (1 - t) * (1 - t),
      x = particle.x + (M.bankAt(demo.state).x - particle.x) * ease,
      y =
        particle.y +
        (M.bankAt(demo.state).y - 25 - particle.y) * ease -
        Math.sin(t * Math.PI) * (12 + particle.offset * 4);
    ctx.globalAlpha = 1 - t * 0.5;
    drawEssence(ctx, x - 3, y - 6, 6, 12);
    ctx.globalAlpha = 1;
  }
  if (demo.state.meditating) {
    ellipse(p.x, p.y, 26, 11, '#82bddf', true);
    text('MEDITATING', p.x, p.y - 104, '#a2d1e4', 11);
  }
  for (const hit of demo.state.damageTexts) {
    ctx.globalAlpha = 1 - hit.age;
    text('!' + hit.amount + '!', hit.x, hit.y - 105 - hit.age * 28, '#ff5252', 18);
    ctx.globalAlpha = 1;
  }
  ctx.setTransform(demo.dpr, 0, 0, demo.dpr, 0, 0);
  if (demo.state.flash && !reduced.matches) {
    ctx.fillStyle = `rgba(200,230,158,${demo.state.flash * 0.35})`;
    ctx.fillRect(0, 0, demo.width, demo.height);
  }
}
export function drawInventoryIcon() {
  const c = $('#inventory-crystal').getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, 36, 44);
  drawEssence(c, 8, 0, 20, 42);
}
// The hallway, bank reveal and completion share this canvas and asset set.
function drawHallway() {
  const t = demo.state.tutorial!;
  // The extension is solid masonry, not extra walkable floor.
  const left = Math.floor(-demo.ox / demo.scale / 96) * 96,
    right = (demo.width - demo.ox) / demo.scale;
  const top = Math.floor(-demo.oy / demo.scale / 48) * 48,
    bottom = (demo.height - demo.oy) / demo.scale;
  hallWall(left, top, right - left, bottom - top);
  const h = M.hallway,
    f = h.floor,
    c = h.carpet;
  ctx.save();
  ctx.beginPath();
  ctx.rect(f.x, f.y, f.w, f.h);
  ctx.clip();
  for (let y = f.y; y < f.y + f.h; y += 32)
    for (let x = f.x; x < f.x + f.w; x += 32) {
      ctx.drawImage(demo.images.stone, x, y, 32, 32);
      ctx.fillStyle = '#20242a20';
      ctx.fillRect(x, y, 32, 32);
    }
  ctx.restore();
  // Wall faces are outside the floor rectangle. No cap slices through a column base.
  ctx.fillStyle = '#5d6063';
  ctx.fillRect(f.x - 12, f.y - 10, f.w + 24, 4);
  ctx.fillStyle = '#34383e';
  ctx.fillRect(f.x - 12, f.y - 6, f.w + 24, 6);
  ctx.fillStyle = '#55585b';
  ctx.fillRect(f.x - 12, f.y + f.h, f.w + 24, 4);
  ctx.fillStyle = '#2c3035';
  ctx.fillRect(f.x - 12, f.y + f.h + 4, f.w + 24, 12);
  ctx.fillStyle = '#5c5e60';
  ctx.fillRect(f.x - 12, f.y - 10, 4, f.h + 26);
  ctx.fillRect(f.x + f.w + 8, f.y - 10, 4, f.h + 26);
  ctx.fillStyle = '#34373c';
  ctx.fillRect(f.x - 8, f.y, 8, f.h);
  ctx.fillRect(f.x + f.w, f.y, 8, f.h);
  ctx.drawImage(demo.images.hallCarpet, c.x, c.y, c.w, c.h);
  for (const x of h.columns) ctx.drawImage(demo.images.hallColumn, x - 28, h.columnY, 56, 132);
  for (let i = 0; i < M.guides.length; i++) {
    const g = M.guides[i],
      seen = t.seen.includes(g.id),
      active = t.dialog?.id === g.id;
    ellipse(g.x, g.y + 2, 25, 9, active ? '#ddbd8266' : seen ? '#83b29244' : '#ba986522');
    actor(g, g.body);
    text(g.name, g.x, g.y - 108, active ? '#ffe9b0' : '#d2c8a7', 12);
    text(
      seen ? '✓  LEARNED' : ['01 · MOVE', '02 · FIGHT', '03 · SECURE'][i],
      g.x,
      g.y + 23,
      seen ? '#9bcaaa' : '#b3a27b',
      10,
    );
  }
  const unlocked = t.seen.length === 3;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(demo.images.hallPortal, h.portal.x, h.portal.y, h.portal.w, h.portal.h);
  ctx.restore();
  if (unlocked && !reduced.matches) {
    for (let i = 0; i < 6; i++) {
      const y = 392 + ((i * 23 + demo.state.time * 20) % 136);
      ctx.fillStyle = '#a2dbbd88';
      ctx.fillRect(h.exitX - 1, y, 2, 3);
    }
  }
  text(unlocked ? 'ENTER THE ARENA →' : 'THE VEIL', h.exitX, 568, unlocked ? '#c5e4b1' : '#9d916e', 11);
}
function drawEssence(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const im = demo.images.essence;
  c.drawImage(
    im,
    ...((im.width === 32 ? [0, 0, 32, 64] : [300, 230, 480, 1010]) satisfies [number, number, number, number]),
    x,
    y,
    w,
    h,
  );
}
function drawBank(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const im = demo.images.bank;
  c.drawImage(
    im,
    ...((im.width === 216 ? [0, 0, 216, 112] : [230, 255, 1075, 555]) satisfies [number, number, number, number]),
    x,
    y,
    w,
    h,
  );
}
function renderBank() {
  const b = M.bankAt(demo.state),
    age = demo.revealStart < 0 ? 2 : Math.max(0, demo.state.time - demo.revealStart),
    t = reduced.matches ? 1 : Math.min(1, age / 1.1),
    ease = 1 - Math.pow(1 - t, 3);
  ellipse(b.x, b.y + 3, 53 * ease, 16 * ease, '#a6cda345');
  ctx.save();
  ctx.globalAlpha = ease;
  ctx.translate(b.x, b.y);
  ctx.scale(0.8 + 0.2 * ease, 0.8 + 0.2 * ease);
  drawBank(ctx, -54, -46 + (1 - ease) * 20, 108, 56);
  ctx.restore();
  if (t < 1) {
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        travel = 18 + 52 * t;
      ctx.fillStyle = '#d6dfa7';
      ctx.globalAlpha = 1 - t;
      ctx.fillRect(b.x + Math.cos(a) * travel, b.y - 15 + Math.sin(a) * travel * 0.55 - t * 15, 2, 3);
    }
    ctx.globalAlpha = 1;
  }
  text('ESSENCE BANK', b.x, b.y + 28, '#cbd7b1', 11);
}
function drawDestination() {
  const q = demo.state.navigation?.points.at(-1);
  if (q) {
    ellipse(q.x, q.y, 12, 5, '#cfbd85', true);
    ctx.fillStyle = '#cfbd85';
    ctx.fillRect(q.x - 1, q.y - 1, 3, 3);
  }
}
function hallWall(x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let row = Math.floor(y / 48); row * 48 < y + h; row++)
    for (let col = Math.floor(x / 96) - 1; col * 96 < x + w; col++) {
      const bx = col * 96 + (row % 2) * 48,
        by = row * 48;
      ctx.drawImage(demo.images.stone, bx, by, 96, 48);
      ctx.fillStyle = '#11151ab5';
      ctx.fillRect(bx, by, 96, 48);
      ctx.fillStyle = '#45494d';
      ctx.fillRect(bx + 2, by + 2, 92, 2);
      ctx.fillStyle = '#30343a';
      ctx.fillRect(bx + 2, by + 4, 2, 40);
      ctx.fillStyle = '#12151a';
      ctx.fillRect(bx + 2, by + 44, 94, 4);
      ctx.fillRect(bx + 94, by + 2, 2, 44);
    }
  ctx.restore();
}
