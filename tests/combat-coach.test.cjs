const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/demo/rules/navigation.ts').default;
const { emptyBindings, assignMacro, macroForKey, bindingActions } = require('../src/demo/rules/macros.ts');

function practice() {
  const s = M.createTutorial();
  s.tutorial.seen = M.guides.map((g) => g.id);
  M.enterArena(s);
  M.startFight(s);
  M.dismissCombatLesson(s);
  s.player.x = 400;
  s.player.y = 368;
  s.enemies = [{ ...s.enemies[0], speed: 0, cooldown: 99 }];
  return s;
}
function advance(s, seconds) {
  for (let i = 0; i < seconds * 50; i++) M.update(s, 0.02, { x: 1 });
}

test('combat introduction freezes the real simulation until understood or skipped', () => {
  const s = practice();
  s.tutorial.coach.current = 'precision';
  const before = JSON.stringify(s);
  advance(s, 5);
  assert.equal(JSON.stringify(s), before);
  s.armed = true;
  assert(!M.cast(s, s.enemies[0]));
  assert(!M.usePotion(s, 'life'));
  assert(!M.melee(s));
  M.dismissCombatLesson(s);
  advance(s, 0.1);
  assert(s.player.x > 400);
});

test('outgoing spells explain the actual mana spent and effect once per situation', () => {
  for (const [spell, cost] of [
    ['apocalipsis', 15],
    ['inmovilizar', 20],
  ]) {
    const s = practice();
    s.selectedSpell = spell;
    s.armed = true;
    assert(M.cast(s, s.enemies[0]));
    assert.equal(s.player.mana, 100 - cost);
    assert.equal(s.tutorial.coach.current, spell);
    assert(spell === 'apocalipsis' ? s.enemies[0].hp === 1 : s.enemies[0].immobilized > 0);
    const before = JSON.stringify(s);
    advance(s, 3);
    assert.equal(JSON.stringify(s), before);
    M.dismissCombatLesson(s);
    s.cooldown = 0;
    s.enemies[0].immobilized = 0;
    s.armed = true;
    assert(M.cast(s, s.enemies[0]));
    assert.equal(s.tutorial.coach.current, null);
    assert.equal(s.player.mana, 100 - cost * 2);
  }
});

test('receiving immobilization teaches self-removal with mana and preserves facing controls', () => {
  const s = practice();
  s.player.mana = 50;
  M.resolveEnemySpell(s, s.player, 'inmovilizar');
  assert.equal(s.tutorial.coach.current, 'receivedInmovilizar');
  assert.equal(s.player.immobilized, 2.5);
  M.dismissCombatLesson(s);
  M.update(s, 0.02, { x: -1 });
  assert.equal(s.player.dir, 3);
  assert.equal(s.player.x, 400);
  s.selectedSpell = 'remover';
  s.armed = true;
  assert(M.cast(s, s.player));
  assert.equal(s.player.mana, 40);
  assert.equal(s.player.immobilized, 0);
  assert.equal(s.tutorial.coach.current, 'remover');
});

test('NPC spells hit exactly one tile at launch and animations cannot deal later area damage', () => {
  const s = practice();
  s.player.x = 351.9;
  assert(!M.resolveEnemySpell(s, { x: 352.1, y: s.player.y }, 'apocalipsis'));
  assert.equal(s.player.hp, 100);
  assert.equal(s.tutorial.coach.current, 'enemyMiss');
  M.skipCombatLessons(s);
  for (let i = 0; i < 30; i++) M.update(s, 0.02);
  assert.equal(s.player.hp, 100);
  assert(M.resolveEnemySpell(s, s.player, 'apocalipsis'));
  assert.equal(s.player.hp, 88);
});

test('damage, insufficient mana and enemy Remover rejection have distinct contextual lessons', () => {
  const damage = practice();
  M.resolveEnemySpell(damage, damage.player, 'apocalipsis');
  assert.equal(damage.player.hp, 88);
  assert.equal(damage.tutorial.coach.current, 'receivedApocalipsis');
  const mana = practice();
  mana.player.mana = 0;
  mana.armed = true;
  assert(!M.cast(mana, mana.enemies[0]));
  assert.equal(mana.tutorial.coach.current, 'mana');
  const enemy = practice();
  enemy.selectedSpell = 'remover';
  enemy.enemies[0].immobilized = 3;
  enemy.armed = true;
  assert(!M.cast(enemy, enemy.enemies[0]));
  assert.equal(enemy.tutorial.coach.current, 'enemyRemover');
});

test('experienced players can skip both the current explanation and future explanations', () => {
  const s = practice();
  M.resolveEnemySpell(s, s.player, 'inmovilizar');
  M.skipCombatLessons(s);
  assert.equal(s.tutorial.coach.current, null);
  assert.equal(s.tutorial.coach.enabled, false);
  s.selectedSpell = 'remover';
  s.armed = true;
  assert(M.cast(s, s.player));
  assert.equal(s.tutorial.coach.current, null);
  assert.equal(s.player.mana, 90);
});

test('E is an explicit interaction binding that can be released and assigned to a spell', () => {
  const bindings = emptyBindings();
  assert.match(assignMacro(bindings, 'apocalipsis', 'e'), /Hablar/);
  assert.equal(bindings.apocalipsis, '');
  bindings.interact = '';
  assert.equal(assignMacro(bindings, 'apocalipsis', 'e'), '');
  assert.equal(macroForKey(bindings, 'E'), 'apocalipsis');
  assert.equal(assignMacro(bindings, 'interact', 't'), '');
  assert.equal(macroForKey(bindings, 't'), 'interact');
  assert(bindingActions.includes('strike') && bindingActions.includes('pause'));
});
