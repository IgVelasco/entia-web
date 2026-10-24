const test = require('node:test');
const assert = require('node:assert/strict');
const { emptyBindings } = require('../src/demo/rules/macros.ts');
const { BINDINGS_STORAGE_KEY, decodeBindings, loadBindings, saveBindings } = require('../src/demo/binding-storage.ts');
const { coachFocus } = require('../src/demo/rules/coach-focus.ts');
const M = require('../src/demo/rules/navigation.ts').default;

test('saved controls restore E for casting and preserve explicitly unbound default actions', () => {
  const bindings = { ...emptyBindings(), apocalipsis: 'e', interact: '', pickup: '', mana: 'f4' };
  const disk = new Map();
  const storage = { setItem: (key, value) => disk.set(key, value), getItem: (key) => disk.get(key) || null };
  assert(saveBindings(bindings, storage));
  assert(disk.has(BINDINGS_STORAGE_KEY));
  assert.deepEqual(loadBindings(storage), bindings);
  bindings.apocalipsis = '';
  assert(saveBindings(bindings, storage));
  assert.equal(loadBindings(storage).apocalipsis, '');
});

test('invalid, incomplete, reserved or conflicting saved controls fall back to a usable default table', () => {
  for (const raw of [
    null,
    '{',
    'null',
    '[]',
    '{}',
    JSON.stringify({ version: 2, bindings: emptyBindings() }),
    JSON.stringify({ version: 1, bindings: { apocalipsis: 'e' } }),
    JSON.stringify({ version: 1, bindings: { ...emptyBindings(), apocalipsis: 'w' } }),
    JSON.stringify({ version: 1, bindings: { ...emptyBindings(), apocalipsis: 'e' } }),
  ])
    assert.deepEqual(decodeBindings(raw), emptyBindings());
});

test('unavailable storage never prevents entering or configuring the tutorial', () => {
  assert.deepEqual(
    loadBindings({
      getItem() {
        throw new Error('denied');
      },
    }),
    emptyBindings(),
  );
  assert.equal(
    saveBindings(emptyBindings(), {
      setItem() {
        throw new Error('quota');
      },
    }),
    false,
  );
});

test('incoming immobilization points at the player and Remover only when its mana condition holds', () => {
  const s = M.createTutorial();
  s.player.immobilized = 2.5;
  let focus = coachFocus(s, 'receivedInmovilizar');
  assert.equal(focus.actor, s.player);
  assert.equal(focus.action, 'remover');
  assert.match(focus.condition, /10 de maná/);
  assert.match(focus.label, /inmovilizado/);
  s.player.mana = 0;
  focus = coachFocus(s, 'receivedInmovilizar');
  assert.equal(focus.action, 'mana');
  assert.match(focus.condition, /poción, después Remover/);
});

test('outgoing effects and forbidden enemy cleansing identify the actual rival rather than the player', () => {
  const s = M.createTutorial();
  s.tutorial.coach.subject = s.enemies[1].name;
  for (const id of ['apocalipsis', 'inmovilizar', 'enemyRemover', 'enemyCleanse']) {
    const focus = coachFocus(s, id);
    assert.equal(focus.actor, s.enemies[1]);
    assert.match(focus.label, /Rival/);
  }
  assert.equal(coachFocus(s, 'enemyRemover').action, 'remover');
  s.enemies[1].hp = 0;
  assert.match(coachFocus(s, 'apocalipsis').label, /derrotado/);
});

test('damage and mana shortage point at the corresponding potion and resource', () => {
  const s = M.createTutorial();
  assert.equal(coachFocus(s, 'receivedApocalipsis').action, 'life');
  assert.equal(coachFocus(s, 'receivedApocalipsis').resource, 'health');
  assert.equal(coachFocus(s, 'mana').action, 'mana');
  s.selectedSpell = 'inmovilizar';
  assert.equal(coachFocus(s, 'miss').action, 'inmovilizar');
});
