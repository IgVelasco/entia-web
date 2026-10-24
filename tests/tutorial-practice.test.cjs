const startCombat = require('./helpers/tutorial-arena.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/demo/rules/navigation.ts').default;
const { sameTile, occupiedPosition } = require('../src/demo/rules/occupancy.ts');

function practice() {
  const s = M.createTutorial();
  s.tutorial.seen = M.guides.map((guide) => guide.id);
  M.enterArena(s);
  M.skipCombatLessons(s);
  startCombat(M, s);
  return s;
}
function advance(s, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 50); i++) M.update(s, 0.02, input);
}

test('tutorial potions restore resources indefinitely without reducing either stock', () => {
  const s = practice();
  s.enemies = [];
  for (let i = 0; i < 150; i++) {
    s.player.hp = 20;
    s.player.mana = 20;
    assert(M.usePotion(s, 'life'));
    assert.equal(s.player.hp, 60);
    assert(!M.usePotion(s, 'mana'), 'the shared cooldown still applies');
    advance(s, 0.26);
    assert(M.usePotion(s, 'mana'));
    assert.equal(s.player.mana, 70);
    advance(s, 0.26);
  }
  assert.equal(s.lifePotions, 100);
  assert.equal(s.manaPotions, 100);
  s.lifePotions = 0;
  advance(s, 0.26);
  assert(M.usePotion(s, 'life'), 'a practice stock counter cannot exhaust supplies');
});

test('unlimited supplies still obey attack recovery and held macro cadence', () => {
  const s = practice();
  s.enemies = [];
  s.player.hp = 10;
  M.melee(s);
  assert(!M.usePotion(s, 'life'));
  advance(s, 0.32);
  M.pressPotion(s, 'shift', 'life');
  advance(s, 1);
  assert.equal(s.player.hp, 100);
  assert.equal(s.lifePotions, 100);
  M.releasePotion(s, 'shift');
  assert.equal(s.heldPotions.length, 0);
});

test('Sentinel pursues from its real spawn and lands melee hits without spell effects', () => {
  const s = practice();
  const sentinel = s.enemies.find((enemy) => enemy.name === 'Sentinel');
  assert.equal(sentinel.kind, 'melee');
  assert(s.enemies.some((enemy) => enemy.kind === 'ranged'));
  s.enemies = [sentinel];
  const start = Math.hypot(sentinel.x - s.player.x, sentinel.y - s.player.y);
  advance(s, 0.5);
  assert(Math.hypot(sentinel.x - s.player.x, sentinel.y - s.player.y) < start);
  for (let i = 0; i < 500 && s.player.hp === 100; i++) {
    M.update(s, 0.02);
    assert(!sameTile(occupiedPosition(sentinel), occupiedPosition(s.player)));
    if (!sentinel.step) {
      assert.equal(sentinel.x % 32, 16);
      assert.equal(sentinel.y % 32, 16);
    }
  }
  assert.equal(s.player.hp, 92);
  assert(s.fx.some((effect) => effect.owner === 'melee' && effect.targetId === 'player'));
  assert(!s.fx.some((effect) => ['enemy', 'words'].includes(effect.owner)));
  assert.equal(sentinel.wind, 0);
  advance(s, 1.4);
  assert.equal(s.player.hp, 92);
  advance(s, 0.1);
  assert.equal(s.player.hp, 84);
});

test('melee pursuit routes around an occupied tile and the bank', () => {
  const s = practice();
  const sentinel = s.enemies.find((enemy) => enemy.kind === 'melee');
  Object.assign(s.player, { x: 496, y: 432 });
  Object.assign(sentinel, { x: 304, y: 432 });
  const blocker = { ...s.enemies[0], x: 336, y: 432, speed: 0, cooldown: 99 };
  s.enemies = [blocker, sentinel];
  s.bankUnlocked = true;
  s.tutorial.bankRevealed = true;
  s.bankPosition = { x: 400, y: 432 };
  const bank = M.bankBounds(s);
  for (let i = 0; i < 500 && s.player.hp === 100; i++) {
    M.update(s, 0.02);
    assert(!sameTile(occupiedPosition(sentinel), blocker));
    assert(
      !(
        sentinel.x + 10 > bank.x &&
        sentinel.x - 10 < bank.x + bank.w &&
        sentinel.y + 10 > bank.y &&
        sentinel.y - 10 < bank.y + bank.h
      ),
    );
  }
  assert.equal(s.player.hp, 92);
});

test('melee cannot hit diagonally, across a gap or inside the refuge', () => {
  for (const [x, y] of [
    [336, 464],
    [368, 432],
    [240, 432],
  ]) {
    const s = practice();
    const sentinel = s.enemies.find((enemy) => enemy.kind === 'melee');
    Object.assign(sentinel, { x: 304, y: 432, speed: 0, cooldown: 0 });
    Object.assign(s.player, { x, y });
    s.enemies = [sentinel];
    advance(s, 1);
    assert.equal(s.player.hp, 100);
  }
});

test('immobilizing a pursuing Sentinel pauses its step until it removes paralysis', () => {
  const s = practice();
  const sentinel = s.enemies.find((enemy) => enemy.kind === 'melee');
  Object.assign(sentinel, { x: 464, y: 432 });
  s.enemies = [sentinel];
  advance(s, 0.02);
  assert(sentinel.step);
  s.selectedSpell = 'inmovilizar';
  s.armed = true;
  assert(M.cast(s, sentinel));
  const x = sentinel.x,
    y = sentinel.y;
  advance(s, 0.5);
  assert.equal(sentinel.x, x);
  assert.equal(sentinel.y, y);
  advance(s, 0.5);
  assert.equal(sentinel.immobilized, 0);
  assert(Math.hypot(sentinel.x - x, sentinel.y - y) > 0);
});

test('a melee hit teaches its own response and freezes combat safely', () => {
  const s = practice();
  M.enableCombatLessons(s);
  const sentinel = s.enemies.find((enemy) => enemy.kind === 'melee');
  Object.assign(sentinel, { x: 336, y: 432, cooldown: 0 });
  s.enemies = [sentinel];
  M.update(s, 0.02);
  assert.equal(s.player.hp, 92);
  assert.equal(s.tutorial.coach.current, 'receivedMelee');
  const time = s.time;
  advance(s, 3);
  assert.equal(s.time, time);
  assert.equal(s.player.hp, 92);
  M.dismissCombatLesson(s);
  advance(s, 1.5);
  assert.equal(s.player.hp, 84);
  assert.equal(s.tutorial.coach.current, null);
});
