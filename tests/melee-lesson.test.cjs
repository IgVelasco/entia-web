const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/demo/rules/navigation.ts').default;

function lesson() {
  const s = M.createTutorial();
  s.tutorial.seen = M.guides.map((guide) => guide.id);
  M.enterArena(s);
  assert(!M.startFight(s), 'the workshop cannot bypass the practice gate');
  assert(M.startMeleePractice(s));
  return s;
}
function advance(s, seconds, input = {}) {
  for (let i = 0; i < seconds * 50; i++) M.update(s, 0.02, input);
}

test('a safe trainer must actually lose health to melee before combat can start', () => {
  const s = lesson();
  assert.equal(s.tutorial.stage, 'melee');
  assert.equal(s.enemies.length, 1);
  assert.equal(s.enemies[0].name, 'Entrenador');
  assert(!M.startFight(s));
  assert(M.melee(s), 'an out-of-range attempt is allowed');
  assert(!M.meleePracticeHit(s));
  assert(!M.startFight(s));
  advance(s, 2, { x: 1 });
  assert.equal(s.player.x, 368);
  s.player.dir = 3;
  assert(M.melee(s), 'facing away swings into empty space');
  assert(!M.startFight(s));
  advance(s, 1.5);
  s.player.dir = 1;
  assert(M.melee(s));
  assert(M.meleePracticeHit(s));
  assert.equal(s.enemies[0].hp, 1);
  assert(s.fx.some((effect) => effect.owner === 'melee'));
  assert(!M.melee(s), 'a completed trainer cannot be killed for rewards');
  assert.equal(s.kills, 0);
  assert.equal(s.drops.length, 0);
  assert(M.startFight(s));
  assert.equal(s.tutorial.stage, 'fight');
  assert.equal(s.enemies.length, 3);
  assert(s.enemies.some((enemy) => enemy.name === 'Sentinel' && enemy.kind === 'melee'));
  assert.equal(s.tutorial.coach.current, 'precision');
  assert(!M.startFight(s));
});

test('spells, elapsed time and skipping explanations cannot satisfy the melee exercise', () => {
  const s = lesson();
  M.skipCombatLessons(s);
  s.armed = true;
  assert(!M.cast(s, s.enemies[0]));
  assert.equal(s.player.mana, 100);
  advance(s, 95);
  assert.equal(s.player.hp, 100);
  assert.equal(s.enemies[0].x, 400);
  assert.equal(s.tutorial.arenaTime, 0);
  assert(!s.tutorial.bankRevealed);
  assert(!M.startFight(s));
  assert(!s.fx.some((effect) => effect.owner === 'enemy'));
  s.player.x = 368;
  s.player.dir = 1;
  assert(M.melee(s));
  assert(M.startFight(s));
  assert.equal(s.tutorial.coach.current, null);
  assert.equal(s.tutorial.coach.enabled, false);
});

test('the successful hit stays visible until continuing and practice resets on replay', () => {
  const s = lesson();
  s.player.x = 368;
  s.player.dir = 1;
  M.melee(s);
  advance(s, 0.1, { x: -1 });
  assert.equal(s.player.x, 368);
  assert.equal(s.tutorial.stage, 'melee');
  assert(s.fx.some((effect) => effect.owner === 'melee' && effect.age > 0));
  M.startFight(s);
  assert.equal(s.player.x, 304);
  assert.equal(s.player.hp, 100);
  assert.equal(s.player.mana, 100);
  assert.equal(s.meleeCooldown, 0);
  assert.equal(s.heldPotions.length, 0);
  const replay = lesson();
  assert(!M.meleePracticeHit(replay));
  assert(!M.startFight(replay));
});
