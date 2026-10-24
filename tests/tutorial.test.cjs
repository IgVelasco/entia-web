const startCombat = require('./helpers/tutorial-arena.cjs');
const test = require('node:test'),
  assert = require('node:assert/strict');
const M = require('../src/demo/rules/tutorial.ts').default;
const advance = (s, n, input = { x: 0, y: 0 }) => {
  for (let i = 0; i < n * 50; i++) M.update(s, 0.02, input);
};
function arena() {
  const s = M.createTutorial();
  for (const g of M.guides) {
    M.talk(s, g.id);
    while (s.tutorial.dialog) M.nextGuide(s);
  }
  assert(M.enterArena(s));
  M.skipCombatLessons(s);
  assert(startCombat(M, s));
  return s;
}
test('fresh tutorial begins in a safe bounded hall with three distinct guides', () => {
  const s = M.createTutorial();
  assert.equal(s.phase, 'hallway');
  assert.equal(M.guides.length, 3);
  assert(!M.enterArena(s));
  s.armed = true;
  assert(!M.cast(s, { x: 100, y: 100 }));
  assert(!M.melee(s));
  assert.equal(s.kills, 0);
  assert.equal(s.player.hp, 100);
});
test('hall dialogs progress once, pause movement and cannot skip into arena', () => {
  const s = M.createTutorial();
  advance(s, 0.7, { x: 1 });
  assert(s.tutorial.dialog);
  const x = s.player.x;
  advance(s, 5, { x: 1 });
  assert.equal(s.player.x, x);
  while (s.tutorial.dialog) M.nextGuide(s);
  assert.equal(s.tutorial.seen.length, 1);
  M.talk(s, 'warden');
  while (s.tutorial.dialog) M.nextGuide(s);
  assert.equal(s.tutorial.seen.length, 1);
  assert(!M.enterArena(s));
});
test('complete hallway is traversable with cardinal input and automatically enters arena', () => {
  const s = M.createTutorial();
  for (let i = 0; i < 400; i++) {
    if (s.tutorial.dialog) M.nextGuide(s);
    else {
      const g = M.nearGuide(s);
      if (g && !s.tutorial.seen.includes(g.id)) M.talk(s, g.id);
      else M.update(s, 0.02, { x: 1, y: 0 });
    }
    if (s.phase === 'arena') break;
  }
  assert.equal(s.phase, 'arena');
  assert.equal(s.tutorial.seen.length, 3);
  assert.equal(s.tutorial.stage, 'setup');
  assert.equal(s.player.x, 304);
});

test('preparation freezes movement, enemies, timers and resources until explicitly starting', () => {
  const s = M.createTutorial();
  s.tutorial.seen = M.guides.map((g) => g.id);
  assert(M.enterArena(s));
  s.player.hp = 80;
  const before = JSON.stringify(s);
  advance(s, 10, { x: 1 });
  assert.equal(JSON.stringify(s), before);
  s.armed = true;
  assert(!M.cast(s, { x: 496, y: 368 }));
  assert(!M.melee(s));
  assert(!M.usePotion(s, 'life'));
  assert.equal(s.lifePotions, 100);
  assert.equal(s.player.hp, 80);
  M.skipCombatLessons(s);
  assert(startCombat(M, s));
  assert.equal(s.tutorial.stage, 'fight');
  assert(!M.startFight(s));
  advance(s, 0.1, { x: 1 });
  assert(s.player.x > 304);
});
test('first pickup does not reveal tutorial bank through either input path', () => {
  for (const mode of ['pickup', 'interact']) {
    const s = arena();
    M.drop(s, s.player.x, s.player.y, 10, 'rival');
    s.time = 1;
    M[mode](s);
    assert.equal(s.carried, 10);
    assert(!s.bankUnlocked);
    assert(!s.tutorial.bankRevealed);
  }
});
test('two victories reveal one nearby reachable bank without overlapping player', () => {
  const s = arena();
  s.kills = 2;
  M.update(s, 0.02);
  assert(s.bankUnlocked);
  const b = M.bankAt(s);
  assert(M.walkable(b.x, b.y));
  assert(Math.hypot(b.x - s.player.x, b.y - s.player.y) > 65);
  assert(Math.hypot(b.x - s.player.x, b.y - s.player.y) < 400);
  const position = JSON.stringify(b);
  advance(s, 0.5);
  assert.equal(JSON.stringify(M.bankAt(s)), position);
});
test('time fallback reveals bank in a quiet round', () => {
  const s = arena();
  s.player.x = 176;
  s.tutorial.arenaTime = 90;
  M.update(s, 0.02);
  assert(s.bankUnlocked);
  assert.equal(s.kills, 0);
});
test('deposit completes only after positive value is fully transferred, opens final NPC and preserves value', () => {
  const s = arena();
  s.kills = 2;
  M.update(s, 0.02);
  const b = M.bankAt(s);
  s.enemies.forEach((e) => {
    e.hp = 0;
    e.respawn = 999;
  });
  s.player.x = b.x;
  s.player.y = b.y + 64;
  s.carried = 10;
  advance(s, 1.1);
  assert(s.secured > 0);
  assert(s.carried > 0);
  assert.notEqual(s.tutorial.stage, 'complete');
  advance(s, 2);
  assert.equal(s.secured, 10);
  assert.equal(s.carried, 0);
  assert.equal(s.tutorial.stage, 'complete');
  assert.equal(s.tutorial.dialog.id, 'final');
  assert(s.tutorial.dialog.lines.join(' ').includes('TBD'));
  while (s.tutorial.dialog) M.nextGuide(s);
  assert(s.tutorial.finalRead);
  const value = s.secured;
  advance(s, 5);
  assert.equal(s.secured, value);
});
test('bank without essence never completes tutorial', () => {
  const s = arena();
  s.kills = 2;
  M.update(s, 0.02);
  const b = M.bankAt(s);
  s.player.x = b.x;
  s.player.y = b.y + 64;
  advance(s, 3);
  assert.equal(s.secured, 0);
  assert.notEqual(s.tutorial.stage, 'complete');
});
test('restart discards tutorial progress and completion state', () => {
  const s = arena();
  s.kills = 3;
  s.secured = 70;
  const fresh = M.createTutorial();
  assert.equal(fresh.tutorial.stage, 'hallway');
  assert.equal(fresh.secured, 0);
  assert.equal(fresh.kills, 0);
  assert.deepEqual(fresh.tutorial.seen, []);
});
test('dying after a partial deposit does not falsely complete the tutorial', () => {
  const s = arena();
  s.kills = 2;
  M.update(s, 0.02);
  s.secured = 2;
  s.carried = 8;
  s.player.hp = 0;
  M.update(s, 0.02);
  assert.equal(s.carried, 0);
  assert.equal(s.secured, 2);
  assert.equal(s.tutorial.stage, 'deposit');
  assert(!s.tutorial.dialog);
  assert.equal(
    s.drops.reduce((n, d) => n + d.amount, 0),
    8,
  );
});
