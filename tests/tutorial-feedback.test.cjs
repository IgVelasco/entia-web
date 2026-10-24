const startCombat = require('./helpers/tutorial-arena.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const { loadSandboxModule } = require('./helpers/sandbox-module.cjs');
const M = require('../src/demo/rules/navigation.ts').default;

function practice() {
  const s = M.createTutorial();
  s.tutorial.seen = M.guides.map((g) => g.id);
  M.enterArena(s);
  M.skipCombatLessons(s);
  startCombat(M, s);
  s.player.x = 400;
  s.player.y = 432;
  s.enemies = [{ ...s.enemies[0], x: 464, y: 432, speed: 0, cooldown: 99 }];
  return s;
}

test('re-enabling explanations resets seen situations without restarting combat or bindings', () => {
  const s = practice();
  s.tutorial.coach.seen = ['receivedApocalipsis'];
  const before = JSON.stringify([s.player, s.enemies, s.tutorial.stage]);
  M.enableCombatLessons(s);
  assert.equal(s.tutorial.coach.enabled, true);
  assert.deepEqual(s.tutorial.coach.seen, []);
  assert.equal(JSON.stringify([s.player, s.enemies, s.tutorial.stage]), before);
  M.resolveEnemySpell(s, s.player);
  assert.equal(s.tutorial.coach.current, 'receivedApocalipsis');
  M.skipCombatLessons(s);
  M.enableCombatLessons(s);
  M.resolveEnemySpell(s, s.player);
  assert.equal(s.tutorial.coach.current, 'receivedApocalipsis');
});

test('effects play before the card while gameplay, paralysis and recovery stay frozen', () => {
  const s = practice();
  M.enableCombatLessons(s);
  s.cooldown = 1.38;
  M.resolveEnemySpell(s, s.player, 'inmovilizar');
  const before = JSON.stringify([s.player, s.enemies, s.time, s.cooldown]);
  assert(s.tutorial.coach.revealRemaining > 0);
  for (let i = 0; i < 10; i++) M.update(s, 0.02, { x: 1 });
  assert(s.fx[0].age > 0.19);
  assert(s.tutorial.coach.revealRemaining > 0);
  for (let i = 0; i < 25; i++) M.update(s, 0.02, { x: 1 });
  assert.equal(s.tutorial.coach.revealRemaining, 0);
  assert.equal(JSON.stringify([s.player, s.enemies, s.time, s.cooldown]), before);
  const frozen = JSON.stringify(s);
  for (let i = 0; i < 100; i++) M.update(s, 0.02);
  assert.equal(JSON.stringify(s), frozen);
});

test('skipping a pending visual cancels its card without leaving a delayed explanation', () => {
  const s = practice();
  M.enableCombatLessons(s);
  M.resolveEnemySpell(s, s.player);
  M.skipCombatLessons(s);
  for (let i = 0; i < 100; i++) M.update(s, 0.02);
  assert.equal(s.tutorial.coach.current, null);
  assert.equal(s.tutorial.coach.revealRemaining, 0);
  assert(s.time > 0);
});

test('spell hitboxes follow the visible feet in every walking direction, never the reserved destination', () => {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    for (const hitVisible of [true, false]) {
      const s = practice();
      const e = s.enemies[0];
      e.step = { x: dx, y: dy, end: { x: e.x + dx * 32, y: e.y + dy * 32 }, remaining: 30 };
      e.x += dx * 2;
      e.y += dy * 2;
      s.armed = true;
      assert.equal(M.cast(s, hitVisible ? { x: e.x, y: e.y } : e.step.end), hitVisible);
      assert.equal(e.hp, hitVisible ? 1 : 2);
    }
  }
});

test('self Remover and enemy spells share the visible foot tile while a step is paused', () => {
  for (const spell of ['remover', 'apocalipsis']) {
    for (const hitVisible of [true, false]) {
      const s = practice();
      s.player.x = 402;
      s.player.step = { x: 1, y: 0, end: { x: 432, y: 432 }, remaining: 30 };
      s.player.immobilized = 2.5;
      const target = hitVisible ? { x: 402, y: 432 } : s.player.step.end;
      if (spell === 'remover') {
        s.selectedSpell = spell;
        s.armed = true;
        assert.equal(M.cast(s, target), hitVisible);
        assert.equal(s.player.immobilized, hitVisible ? 0 : 2.5);
      } else {
        assert.equal(M.resolveEnemySpell(s, target), hitVisible);
        assert.equal(s.player.hp, hitVisible ? 88 : 100);
      }
    }
  }
});

test('spell words sit close to the visible head and follow the caster, not the target', () => {
  const { drawSpellEffect } = loadSandboxModule(
    vm.createContext({}),
    path.join(__dirname, '../src/demo/spell-effects.ts'),
  );
  const s = practice();
  const positions = [];
  const ctx = { save() {}, restore() {}, strokeText() {}, fillText: (...args) => positions.push(args) };
  const effect = { owner: 'words', age: 0.2, x: 0, y: 0, hit: true, spell: 'remover', targetId: 'player' };
  drawSpellEffect(ctx, {}, effect, s, false);
  assert.equal(positions[0][1], s.player.x);
  const gapAboveHead = s.player.y - 67.5 - positions[0][2];
  assert(gapAboveHead >= 6 && gapAboveHead <= 16, `Words should be near the visible head, got ${gapAboveHead}px`);
});
