const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/demo/rules/navigation.ts').default;
function advance(s, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 50); i++) M.update(s, 0.02, input);
}
function lesson() {
  const s = M.createTutorial();
  s.tutorial.seen = M.guides.map((g) => g.id);
  M.enterArena(s);
  M.startMeleePractice(s);
  s.player.x = 368;
  s.player.dir = 1;
  M.melee(s);
  assert(M.startSpellPractice(s));
  return s;
}
function cast(s, target, spell = s.selectedSpell) {
  s.selectedSpell = spell;
  s.armed = true;
  return M.cast(s, target);
}
test('spell practice requires three real successes in order, including self-removal', () => {
  const s = lesson(),
    trainer = s.enemies[0],
    practice = s.tutorial.meleePractice;
  assert(!M.startFight(s));
  assert(!cast(s, { x: 400, y: 496 }));
  assert.equal(practice.spellStep, 'apocalipsis');
  assert.equal(s.player.mana, 100);
  advance(s, 1.4);
  assert(!cast(s, trainer, 'inmovilizar'));
  assert.equal(practice.spellStep, 'apocalipsis');
  assert(cast(s, trainer, 'apocalipsis'));
  assert.equal(s.player.mana, 85);
  assert.equal(trainer.hp, 2);
  assert.equal(practice.spellStep, 'inmovilizar');
  assert(!M.melee(s));
  advance(s, 1.4);
  assert(cast(s, trainer));
  assert.equal(s.player.mana, 65);
  assert(trainer.immobilized > 0);
  assert.equal(practice.spellStep, 'counter');
  advance(s, 0.6);
  assert.equal(s.player.immobilized, 0);
  advance(s, 0.9);
  assert(s.player.immobilized > 0);
  assert.equal(practice.spellStep, 'remover');
  assert(s.fx.some((f) => f.owner === 'enemy' && f.spell === 'inmovilizar' && f.targetId === 'player'));
  assert(s.fx.some((f) => f.owner === 'words' && f.targetId === trainer.name));
  assert(!cast(s, trainer));
  assert.equal(practice.spellStep, 'remover');
  assert.equal(s.player.mana, 65);
  advance(s, 1.4);
  assert(!cast(s, { x: 400, y: 496 }));
  advance(s, 12);
  assert(s.player.immobilized > 0, 'waiting cannot replace the self-removal exercise');
  assert(!M.startFight(s));
  assert(cast(s, s.player));
  assert.equal(s.player.mana, 55);
  assert.equal(s.player.immobilized, 0);
  assert(M.spellPracticeComplete(s));
  assert.equal(s.tutorial.coach.current, null, 'the live drill is not interrupted by optional combat cards');
  assert.equal(s.tutorial.arenaTime, 0);
  assert.equal(s.kills, 0);
  assert.equal(s.drops.length, 0);
  assert(M.startFight(s));
  assert.equal(s.player.mana, 100);
  assert.equal(s.enemies.length, 3);
});
test('practice paralysis prevents walking but keeps all four facing directions', () => {
  const s = lesson();
  cast(s, s.enemies[0]);
  advance(s, 1.4);
  cast(s, s.enemies[0]);
  advance(s, 1.5);
  const point = { x: s.player.x, y: s.player.y };
  for (const [x, y, dir] of [
    [0, -1, 0],
    [1, 0, 1],
    [0, 1, 2],
    [-1, 0, 3],
  ]) {
    advance(s, 0.1, { x, y });
    assert.equal(s.player.dir, dir);
    assert.equal(s.player.x, point.x);
    assert.equal(s.player.y, point.y);
  }
  M.skipCombatLessons(s);
  advance(s, 5);
  assert(!M.spellPracticeComplete(s));
  assert(!M.startFight(s));
});
test('casting never rotates the player toward the target, on hits or misses', () => {
  for (const dir of [0, 1, 2, 3])
    for (const spell of ['apocalipsis', 'inmovilizar', 'remover']) {
      const s = M.create();
      s.player.x = 400;
      s.player.y = 368;
      s.player.dir = dir;
      if (spell === 'remover') s.player.immobilized = 2;
      assert(cast(s, spell === 'remover' ? s.player : s.enemies[0], spell));
      assert.equal(s.player.dir, dir);
      advance(s, 1.4);
      s.player.dir = dir;
      assert(!cast(s, { x: 400, y: 496 }, spell));
      assert.equal(s.player.dir, dir);
    }
});
