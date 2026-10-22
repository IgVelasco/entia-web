const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/demo/rules/navigation.ts').default;
const { emptyBindings, exampleBindings, assignMacro, macroForKey } = require('../src/demo/rules/macros.ts');
function arena() {
  const s = M.create();
  s.enemies = [];
  return s;
}
function advance(s, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 50); i++) M.update(s, 0.02, input);
}

test('a moving NPC claims one destination tile and leaves its old tile walkable', () => {
  const s = arena();
  s.enemies = [
    {
      ...M.create().enemies[0],
      x: 346,
      y: 432,
      speed: 0,
      cooldown: 99,
      step: { x: 1, y: 0, end: { x: 368, y: 432 }, remaining: 22 },
    },
  ];
  advance(s, 0.2, { x: 1 });
  assert.equal(s.player.x, 336);
  advance(s, 0.4, { x: 1 });
  assert.equal(s.player.x, 336);
  assert.match(s.movementBlock, /ocupado/);
});
test('a sprite in a neighbouring row never blocks a separate tile', () => {
  const s = arena();
  s.enemies = [{ ...M.create().enemies[0], x: 320, y: 448, speed: 0, cooldown: 99 }];
  advance(s, 0.2, { x: 1 });
  assert.equal(s.player.x, 336);
  assert.equal(s.player.y, 432);
});
test('NPCs finish their step before winding up a cast and never stop between tiles', () => {
  const s = M.create();
  s.enemies = s.enemies.slice(0, 1);
  s.player.hp = 10000;
  for (let i = 0; i < 500; i++) {
    M.update(s, 0.02);
    const e = s.enemies[0];
    if (!e.step) {
      assert.equal(e.x % 32, 16);
      assert.equal(e.y % 32, 16);
    }
  }
});

test('a blocked NPC cannot create a zero-direction step that never finishes', () => {
  const s = M.create();
  const template = s.enemies[0];
  s.enemies = [
    { ...template, name: 'Walker', x: 560, y: 432, cooldown: 99 },
    { ...template, name: 'Blocker', x: 528, y: 432, cooldown: 99, speed: 0 },
  ];
  M.update(s, 0.02);
  assert.equal(s.enemies[0].step, undefined);
});
test('immobilization pauses a step, then release or expiry resumes its original endpoint', () => {
  for (const cleanse of [true, false]) {
    const s = arena();
    M.update(s, 0.05, { x: 1 });
    const end = { ...s.player.step.end };
    s.player.immobilized = 0.2;
    const x = s.player.x;
    M.update(s, 0.02, { x: 1 });
    assert.equal(s.player.x, x);
    assert.deepEqual(s.player.step.end, end);
    if (cleanse) {
      s.selectedSpell = 'remover';
      s.armed = true;
      assert(M.cast(s, { x: s.player.x, y: s.player.y }));
    }
    advance(s, 0.5);
    assert.equal(s.player.x, end.x);
    assert.equal(s.player.step, null);
  }
});
test('free tile targeting hits only the clicked occupied tile, with no sprite magnet or neighbour fallback', () => {
  const s = M.create();
  const e = s.enemies[0];
  s.player.x = 400;
  s.player.y = 368;
  s.armed = true;
  assert(!M.cast(s, { x: e.x, y: e.y - 40 }));
  assert.equal(s.player.mana, 100);
  assert.equal(s.armed, false);
  assert.equal(e.hp, 2);
  s.cooldown = 0;
  s.armed = true;
  assert(M.cast(s, { x: e.x + 10, y: e.y + 8 }));
  assert.equal(e.hp, 1);
  assert.equal(s.fx.findLast((f) => f.owner === 'player').x, e.x + 10);
});
test('macros start empty and keyboard shortcuts exist only after explicit assignment', () => {
  const bindings = emptyBindings();
  assert.equal(macroForKey(bindings, 'f1'), undefined);
  assert.equal(macroForKey(bindings, 'c'), undefined);
  assert.equal(assignMacro(bindings, 'apocalipsis', 'T'), '');
  assert.equal(macroForKey(bindings, 't'), 'apocalipsis');
  assert.equal(assignMacro(bindings, 'apocalipsis', 'Y'), '');
  assert.equal(macroForKey(bindings, 't'), undefined);
});
test('duplicate and reserved macro keys are rejected without changing an existing assignment', () => {
  const bindings = exampleBindings();
  assert.match(assignMacro(bindings, 'mana', 'f1'), /asignada/);
  assert.equal(bindings.mana, 'f2');
  for (const key of ['w', 'e', 'p', ' ', 'Escape', 'F5', 'F11', 'Control']) assert(assignMacro(bindings, 'mana', key));
  assert.equal(bindings.mana, 'f2');
});
