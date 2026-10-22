const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CLICK_MOVEMENT_STORAGE_KEY,
  loadClickMovement,
  saveClickMovement,
} = require('../src/demo/control-preferences.ts');

test('click movement defaults on and ignores invalid stored values', () => {
  for (const raw of [null, 'bad', '{}', '"false"', 'null', '0', 'true'])
    assert.equal(loadClickMovement({ getItem: () => raw }), true);
  assert.equal(loadClickMovement({ getItem: () => 'false' }), false);
});

test('either click movement choice survives a later load without sharing the binding storage', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  for (const enabled of [false, true, false]) {
    assert(saveClickMovement(enabled, storage));
    assert.equal(loadClickMovement(storage), enabled);
    assert.equal(values.size, 1);
    assert.equal(values.get(CLICK_MOVEMENT_STORAGE_KEY), JSON.stringify(enabled));
  }
});

test('blocked storage keeps the click movement option usable for the visit', () => {
  const storage = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
  };
  assert.equal(loadClickMovement(storage), true);
  assert.equal(saveClickMovement(false, storage), false);
});
