/* Guided offline onboarding. Numerical match limits remain design proposals. */
import M from './model.ts';
import { walk } from './movement.ts';
import { createCoach, teach, dismissCombatLesson, skipCombatLessons, enableCombatLessons } from './combat-lessons.ts';
import type { DemoState, Guide } from './state.ts';
const hallway = {
  floor: { x: 48, y: 384, w: 512, h: 160 },
  carpet: { x: 80, y: 432, w: 448, h: 64 },
  columns: [80, 208, 336, 464],
  columnY: 268,
  portal: { x: 510, y: 260, w: 36, h: 276 },
  exitX: 528,
  cameraY: 400,
  walk: { minX: 64, maxX: 544, minY: 448, maxY: 496 },
};
const guides: Guide[] = [
  {
    id: 'warden',
    name: 'The Warden',
    body: 'npc-movement',
    x: 144,
    y: 400,
    dir: 2,
    gait: 0,
    title: 'Find your footing',
    lines: [
      'Welcome to the Veil. Walk along this hall and meet our three guides before you enter the arena.',
      'Click or tap the floor to walk there. WASD, arrows or the thumbstick also move you. Each guide introduces their lesson as you reach them. Click a guide or use your assigned interaction key nearby to talk again. Teclas y macros shows every assignment.',
    ],
  },
  {
    id: 'arcanist',
    name: 'The Arcanist',
    body: 'npc-game',
    x: 272,
    y: 400,
    dir: 2,
    gait: 0,
    title: 'Aim. Cast. Keep moving.',
    lines: [
      'Select a spell and press Lanzar, then click the ground tile you want to target. The cursor stays free. Before combat, a safe workshop will show spells, potions and optional keyboard macros.',
      'Keep moving during combat. Immobilization stops translation but still allows turning and casting. Remover parálisis on your own tile restores movement and costs mana; it cannot release an enemy. Meditate recovers mana while standing still.',
    ],
  },
  {
    id: 'keeper',
    name: 'The Keeper',
    body: 'npc-bank',
    x: 400,
    y: 400,
    dir: 2,
    gait: 0,
    title: 'Carry risk. Bank safety.',
    lines: [
      'Defeated rivals drop essence. Stand on a crystal and use Pick up or your assigned interaction key. Carried essence drops when you fall; rivals can take it. All keys, including the alternative pickup key, can be changed in Teclas y macros.',
      'Fight a few rivals in the arena. A bank will appear nearby. Stay beside it until your carried essence has transferred. Secured essence stays safe.',
    ],
  },
];
function createTutorial() {
  const s = M.create();
  s.phase = 'hallway';
  s.player.x = 80;
  s.player.y = 464;
  s.tutorial = {
    stage: 'hallway',
    coach: createCoach(),
    seen: [],
    dialog: null,
    page: 0,
    arenaTime: 0,
    bankRevealed: false,
    finalRead: false,
    hallTime: 0,
  };
  M.tell(s, 'Walk right and meet the Warden. Talk or your interaction key opens a conversation.');
  return s;
}
function nearGuide(s: DemoState) {
  if (s.phase !== 'hallway') return null;
  return (
    guides
      .filter((g) => Math.hypot(g.x - s.player.x, g.y - s.player.y) < 100)
      .sort(
        (a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y),
      )[0] || null
  );
}
function talk(s: DemoState, id: string) {
  if (!s.tutorial) return false;
  const g =
    id === 'final'
      ? {
          id: 'final',
          name: 'The Keeper',
          title: 'Tutorial finished',
          lines: [
            'You fought, collected essence and secured it. That is the core loop: keep fighting for more, or risk the journey to a bank.',
            'Proposed full-match rules: eligible kills create new essence up to a round generation budget. Picking up or stealing existing essence never creates more.',
            'A deposited-essence target would end the match, with a time limit as a fallback. The generation cap, deposit target, scoring and exact values are still TBD.',
            'This is an offline tutorial. Your practice deposits do not affect a live account. Replay the hall or return to Nix when you are ready.',
          ],
        }
      : guides.find((g) => g.id === id);
  if (!g) return false;
  s.tutorial.dialog = g;
  s.tutorial.page = 0;
  s.armed = false;
  s.player.step = null;
  M.clearPotionKeys(s);
  s.pendingMelee = 0;
  s.player.moving = false;
  return true;
}
function next(s: DemoState) {
  const t = s.tutorial;
  if (!t?.dialog) return false;
  if (++t.page < t.dialog.lines.length) return true;
  const id = t.dialog.id;
  if (id === 'final') t.finalRead = true;
  else if (!t.seen.includes(id)) t.seen.push(id);
  t.dialog = null;
  t.page = 0;
  return false;
}
// The portal is a vertical line, so every hall row exits at the same x.
function hallExitX(_y: number) {
  return hallway.exitX;
}
function enterArena(s: DemoState) {
  if (s.tutorial!.seen.length !== guides.length) return false;
  s.phase = 'arena';
  s.tutorial!.stage = 'setup';
  s.player.x = 304;
  s.player.y = 432;
  s.player.step = null;
  s.flash = 0.7;
  M.tell(s, 'Prepará tus controles. La pelea comienza únicamente cuando elijas entrar.');
  return true;
}
function startFight(s: DemoState) {
  if (s.phase !== 'arena' || s.tutorial?.stage !== 'setup') return false;
  s.tutorial.stage = 'fight';
  teach(s, 'precision');
  s.armed = false;
  s.player.step = null;
  s.meditating = false;
  s.fx = [];
  M.clearPotionKeys(s);
  M.tell(s, 'Defeat two rivals and collect their essence. A nearby bank will reveal itself.');
  return true;
}
const originalUpdate = M.update,
  originalPickup = M.pickup,
  originalCast = M.cast,
  originalMelee = M.melee;
M.pickup = function (s, radius) {
  const n = originalPickup(s, radius);
  if (s.tutorial && !s.tutorial.bankRevealed) {
    s.bankUnlocked = false;
    if (n) M.tell(s, 'Essence collected. Defeat two rivals to reveal the bank nearby.');
  }
  return n;
};
M.cast = (s, target) =>
  s.phase === 'hallway' ||
  s.tutorial?.stage === 'setup' ||
  s.tutorial?.stage === 'complete' ||
  !!s.tutorial?.coach?.current
    ? ((s.armed = false), false)
    : originalCast(s, target);
M.melee = (s) =>
  s.phase === 'hallway' ||
  s.tutorial?.stage === 'setup' ||
  s.tutorial?.stage === 'complete' ||
  !!s.tutorial?.coach?.current
    ? false
    : originalMelee(s);
M.interact = function (s) {
  if (s.phase === 'hallway') {
    const g = nearGuide(s);
    if (g) {
      talk(s, g.id);
      return 'talk';
    }
    if (s.player.x >= hallExitX(s.player.y) - 24 && enterArena(s)) return 'enter';
    return false;
  }
  if (M.pickup(s, 22)) return 'pickup';
  if (M.nearBank(s)) return 'bank';
  if (M.nearGate(s)) return 'exit';
  return false;
};
function revealBank(s: DemoState) {
  const t = s.tutorial!;
  const candidates = [
    { x: 432, y: 624 },
    { x: 784, y: 464 },
    { x: 944, y: 720 },
    { x: 368, y: 304 },
  ];
  const valid = candidates.filter(
    (b) =>
      Math.hypot(b.x - s.player.x, b.y - s.player.y) > 65 &&
      !s.enemies.some((e) => e.hp > 0 && Math.abs(e.x - b.x) < 70 && Math.abs(e.y - b.y) < 65) &&
      !s.drops.some((d) => Math.abs(d.x - b.x) < 60 && Math.abs(d.y - b.y) < 40),
  );
  valid.sort((a, b) => Math.hypot(a.x - s.player.x, a.y - s.player.y) - Math.hypot(b.x - s.player.x, b.y - s.player.y));
  if (!valid.length) return;
  s.bankPosition = { ...valid[0] };
  s.bankUnlocked = true;
  t.bankRevealed = true;
  t.stage = 'deposit';
  s.flash = 0.5;
  M.tell(s, 'The bank has appeared nearby. Follow BANK, collect your crystals, then stay close to deposit.');
}
M.update = function (s, dt, input = { x: 0, y: 0 }) {
  if (!s.tutorial) return originalUpdate(s, dt, input);
  const t = s.tutorial;
  dt = Math.max(0, Math.min(dt, 0.05));
  if (t.dialog || t.stage === 'setup' || t.coach?.current) return;
  if (s.phase === 'hallway') {
    s.time += dt;
    t.hallTime += dt;
    s.flash = Math.max(0, s.flash - dt);
    const p = s.player;
    walk(
      p,
      dt,
      input,
      {
        clear: () => true,
        constrain: (end) => ({
          x: Math.max(hallway.walk.minX, Math.min(t.seen.length === 3 ? hallway.walk.maxX : 432, end.x)),
          y: Math.max(hallway.walk.minY, Math.min(hallway.walk.maxY, end.y)),
        }),
        move: (dx, dy) => {
          p.x += dx;
          p.y += dy;
          const distance = Math.hypot(dx, dy);
          p.gait += distance;
          return distance;
        },
      },
      s.navigation?.points,
    );
    const g = guides.find((g) => !t.seen.includes(g.id) && Math.abs(g.x - p.x) <= 28 && Math.abs(g.y - p.y) <= 100);
    if (p.moving && g) {
      talk(s, g.id);
      return;
    }
    if (p.x >= hallExitX(p.y)) {
      if (!enterArena(s)) M.tell(s, 'Meet all three guides before entering the arena.');
    }
    return;
  }
  if (t.stage === 'complete') {
    s.time += dt;
    s.streamParticles = s.streamParticles.filter((p) => (p.age += dt) < 0.55);
    return;
  }
  t.arenaTime += dt;
  const previousSecured = s.secured;
  originalUpdate(s, dt, input);
  if (!t.bankRevealed && (s.kills >= 2 || t.arenaTime >= 90)) revealBank(s);
  if (t.bankRevealed && s.secured > previousSecured && s.carried === 0) {
    t.stage = 'complete';
    s.won = true;
    s.armed = false;
    s.fx = [];
    for (const e of s.enemies) e.wind = 0;
    talk(s, 'final');
    M.tell(s, 'Tutorial finished. Your essence is secure.');
  }
};
// The same object as the model, with the tutorial's overrides above and these additions.
export default Object.assign(M, {
  hallway,
  hallExitX,
  guides,
  createTutorial,
  nearGuide,
  talk,
  nextGuide: next,
  enterArena,
  startFight,
  dismissCombatLesson,
  skipCombatLessons,
  enableCombatLessons,
  revealBank,
});
