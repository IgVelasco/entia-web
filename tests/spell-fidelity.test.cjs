const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/demo/rules/navigation.ts').default;

test('a sent miss restores the normal cursor without spending mana', () => {
  for (const selectedSpell of ['apocalipsis', 'inmovilizar', 'remover']) {
    const s = M.create();
    s.selectedSpell = selectedSpell;
    s.armed = true;
    assert.equal(M.cast(s, { x: 400, y: 432 }), false);
    assert.equal(s.armed, false);
    assert.equal(s.player.mana, 100);
    assert.equal(s.cooldown, 1.38);
    assert.equal(s.fx.length, 0);
  }
});

test('Remover cannot release an immobilized enemy', () => {
  const s = M.create();
  s.player.x = 400;
  s.player.y = 368;
  s.selectedSpell = 'remover';
  s.armed = true;
  const enemy = s.enemies[0];
  enemy.immobilized = 3;
  assert.equal(M.cast(s, enemy), false);
  assert.equal(enemy.immobilized, 3);
  assert.equal(s.player.mana, 100);
  assert.equal(s.armed, false);
});

test('immobilization permits four headings without translation or losing a step', () => {
  const s = M.create();
  s.enemies = [];
  M.update(s, 0.02, { x: 1 });
  const x = s.player.x,
    y = s.player.y,
    step = s.player.step;
  s.player.immobilized = 3;
  for (const [input, direction] of [
    [{ y: -1 }, 0],
    [{ x: 1 }, 1],
    [{ y: 1 }, 2],
    [{ x: -1 }, 3],
  ]) {
    M.update(s, 0.02, input);
    assert.equal(s.player.dir, direction);
    assert.equal(s.player.x, x);
    assert.equal(s.player.y, y);
    assert.equal(s.player.step, step);
  }
});
