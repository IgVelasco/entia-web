const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/demo/rules/navigation.ts').default;

function arena() {
  const s = M.create();
  s.enemies = [];
  return s;
}
function advance(s, seconds, input = {}, fps = 60) {
  const frames = Math.round(seconds * fps);
  for (let i = 0; i < frames; i++) M.update(s, seconds / frames, input);
}
function close(actual, expected) {
  assert(Math.abs(actual - expected) < 0.00001, `${actual} should equal ${expected}`);
}

test('held walking travels five tiles per second at 30, 60 and 144 FPS', () => {
  for (const fps of [30, 60, 144]) {
    const s = arena();
    advance(s, 2, { x: 1 }, fps);
    close(s.player.x, 304 + 320);
    assert.equal(s.player.y, 432);
  }
});

test('straight click routes keep the same cadence as held keys at every frame rate', () => {
  for (const fps of [30, 60, 144]) {
    const s = arena();
    M.walkTo(s, { x: 944, y: 432 });
    advance(s, 2, {}, fps);
    close(s.player.x, 624);
    advance(s, 3, {}, fps);
    close(s.player.x, 944);
    assert.equal(s.navigation, null);
  }
});

test('hallway and arena release finish one tile with identical timing', () => {
  const hall = M.createTutorial();
  hall.tutorial.seen = M.guides.map((g) => g.id);
  for (const s of [hall, arena()]) {
    const x = s.player.x;
    M.update(s, 0.03, { x: 1 });
    advance(s, 0.3);
    close(s.player.x, x + 32);
    assert.equal(s.player.step, null);
    assert.equal(s.player.moving, false);
  }
});

test('a turn waits for the active tile and releasing it does not replay stale intent', () => {
  const s = arena();
  M.update(s, 0.05, { x: 1 });
  M.update(s, 0.05, { y: 1 });
  assert.equal(s.player.y, 432);
  advance(s, 0.2);
  close(s.player.x, 336);
  assert.equal(s.player.y, 432);
  M.update(s, 0.02, { y: 1 });
  assert(s.player.y > 432);
});

test('a recovering spell keeps its cursor and does not interrupt the current step', () => {
  const s = arena();
  s.enemies = [{ ...M.create().enemies[0], x: 400, y: 432, speed: 0, cooldown: 99, hp: 10 }];
  s.armed = true;
  assert(M.cast(s, { x: 400, y: 432 }));
  assert.equal(s.cooldown, 1.38);
  s.armed = true;
  M.update(s, 0.05, { y: 1 });
  const step = s.player.step;
  const mana = s.player.mana;
  assert(!M.cast(s, { x: 400, y: 432 }));
  assert(s.armed);
  assert.equal(s.player.step, step);
  assert.equal(s.player.mana, mana);
  advance(s, 1.4);
  assert(M.cast(s, { x: 400, y: 432 }));
  assert(!s.armed);
});

test('hit-to-magic and magic-to-hit gates prevent bypassing combat cadence', () => {
  const s = arena();
  s.enemies = [{ ...M.create().enemies[0], x: 440, y: 432, speed: 0, cooldown: 99, hp: 10 }];
  s.player.x = 400;
  assert(M.melee(s));
  s.armed = true;
  assert(!M.cast(s, { x: 440, y: 432 }));
  assert(s.armed);
  advance(s, 0.65);
  assert(M.cast(s, { x: 440, y: 432 }));
  s.meleeCooldown = 0;
  assert(!M.melee(s));
  advance(s, 0.6);
  assert(!M.melee(s));
  advance(s, 0.04);
  assert.equal(s.pendingMelee, 0);
  assert(s.meleeCooldown > 1.4);
});

test('a melee tap in the last 100ms executes once; an earlier tap is discarded', () => {
  const s = arena();
  s.meleeCooldown = 0.3;
  assert(!M.melee(s));
  advance(s, 0.4);
  assert.equal(s.fx.length, 0);
  s.meleeCooldown = 0.08;
  assert(!M.melee(s));
  assert(s.pendingMelee > 0);
  advance(s, 0.1);
  assert.equal(s.fx.filter((f) => f.owner === 'melee').length, 1);
  advance(s, 0.2);
  assert.equal(s.fx.filter((f) => f.owner === 'melee').length, 1);
});

test('continuing across a tile boundary cannot enter a newly occupied tile', () => {
  const s = arena();
  M.update(s, 0.05, { x: 1 });
  advance(s, 0.1, { x: 1 });
  s.enemies = [{ ...M.create().enemies[0], x: 368, y: 432, speed: 0, cooldown: 99 }];
  M.update(s, 0.04, { x: 1 });
  M.update(s, 0.04, { x: 1 });
  close(s.player.x, 336);
  assert.equal(s.player.step, null);
});

test('death clears a buffered strike before respawn', () => {
  const s = arena();
  s.meleeCooldown = 0.08;
  M.melee(s);
  s.player.hp = 0;
  M.update(s, 0.02);
  advance(s, 0.2);
  assert.equal(s.pendingMelee, 0);
  assert.equal(s.fx.length, 0);
});
