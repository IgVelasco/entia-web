const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const vm = require('node:vm');
const { loadSandboxModule } = require('./helpers/sandbox-module.cjs');
const { effectFrame, effectAnchor, drawSpellEffect } = loadSandboxModule(
  vm.createContext({}),
  path.join(__dirname, '../src/demo/spell-effects.ts'),
);
const M = require('../src/demo/rules/model.ts').default;

const fx = (owner, age = 0) => ({ owner, age, x: 400, y: 400, hit: true });
function canvas() {
  const calls = [];
  const stack = [];
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save() {
      stack.push([this.globalAlpha, this.globalCompositeOperation]);
    },
    restore() {
      [this.globalAlpha, this.globalCompositeOperation] = stack.pop();
    },
    drawImage(...args) {
      calls.push(['image', ...args]);
    },
    translate(...args) {
      calls.push(['translate', ...args]);
    },
    rotate(...args) {
      calls.push(['rotate', ...args]);
    },
    strokeText() {},
    fillText(...args) {
      calls.push(['words', ...args]);
    },
  };
  return { ctx, calls };
}

test('Inmovilizar plays all 15 original frames at 12 FPS and never reads the empty atlas cell', () => {
  for (let i = 0; i < 15; i++) assert.equal(effectFrame(fx('bind', (i + 0.1) / 12)).frame, i);
  assert.equal(effectFrame(fx('bind', 1.25)), null);
  assert.equal(effectFrame(fx('bind', 2)), null);
});

test('Apocalipsis is a single 50-move burst at 60 moves per second', () => {
  assert.equal(effectFrame(fx('player', 0.82)).kind, 'apocalipsis');
  assert.equal(effectFrame(fx('player', 50 / 60)), null);
});

test('an enemy miss never renders an impact at a distant empty tile', () => {
  const s = M.create();
  s.player.x = 400;
  s.player.y = 432;
  assert.equal(M.resolveEnemySpell(s, { x: 800, y: 700 }), false);
  const miss = s.fx.find((effect) => effect.owner === 'enemy');
  assert.equal(miss.hit, false);
  for (const age of [0, 0.3, 0.6, 1]) {
    const effect = { ...miss, age };
    assert.equal(effectFrame(effect), null);
    const { ctx, calls } = canvas();
    drawSpellEffect(ctx, { spellApocalipsis: 'apocalipsis' }, effect, s, false);
    assert.equal(calls.filter((call) => call[0] === 'image').length, 0);
  }
});

test('one outgoing hit creates one impact anchored to its victim, plus only text on the caster', () => {
  const s = M.create();
  s.player.x = 400;
  s.player.y = 368;
  s.armed = true;
  assert(M.cast(s, { x: s.enemies[0].x + 10, y: s.enemies[0].y }));
  const impacts = s.fx.filter((effect) => effectFrame(effect));
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].targetId, s.enemies[0].name);
  const words = s.fx.find((effect) => effect.owner === 'words');
  assert(words);
  assert.equal(effectFrame(words), null);
  assert.equal(effectAnchor(impacts[0], s), s.enemies[0]);
});

test('enemy immobilization starts its own artwork at launch after windup, without another hidden delay', () => {
  const effect = { ...fx('enemy', 0), spell: 'inmovilizar' };
  assert.equal(effectFrame(effect).frame, 0);
  effect.age = 0.5;
  assert.equal(effectFrame(effect).kind, 'bind');
  assert.equal(effectFrame(effect).frame, 6);
});

test('attached artwork follows a moving living actor and retains the impact point after its death', () => {
  const s = M.create();
  const effect = { ...fx('player'), targetId: s.enemies[0].name };
  s.enemies[0].x = 700;
  assert.equal(effectAnchor(effect, s).x, 700);
  s.enemies[0].hp = 0;
  assert.equal(effectAnchor(effect, s).x, 400);
});

test('reduced motion keeps the original artwork visible without particle rotation', () => {
  const { ctx, calls } = canvas();
  const images = { spellApocalipsis: 'apocalipsis', spellBind: 'bind' };
  drawSpellEffect(ctx, images, fx('player', 0.3), M.create(), true);
  assert.equal(calls.filter((c) => c[0] === 'image').length, 5);
  assert(!calls.some((c) => c[0] === 'rotate'));
  drawSpellEffect(ctx, images, fx('bind', 0.3), M.create(), true);
  assert(calls.some((c) => c[0] === 'image' && c[1] === 'bind'));
  assert.equal(effectFrame(fx('bind', 0.1), true).frame, effectFrame(fx('bind', 1), true).frame);
  assert.equal(ctx.globalCompositeOperation, 'source-over');
  assert.equal(ctx.globalAlpha, 1);
});

test('Remover uses its original magic words and has no invented impact sprite', () => {
  const { ctx, calls } = canvas();
  assert.equal(effectFrame(fx('cleanse')), null);
  drawSpellEffect(ctx, {}, { ...fx('words'), spell: 'remover', targetId: 'player' }, M.create(), false);
  assert(calls.some((c) => c[0] === 'words' && c[1] === 'AN HOAX VORP'));
  assert(!calls.some((c) => c[0] === 'image'));
});

test('exported spell sheets have transparency, bounded size and distinct animation frames', () => {
  for (const [file, size] of [
    ['apocalipsis-particle-127.png', 128],
    ['inmovilizar-fx-12.png', 512],
  ]) {
    const buffer = fs.readFileSync(path.join(__dirname, '../public/assets/spells', file));
    assert(buffer.length < 50000);
    const image = PNG.sync.read(buffer);
    assert.equal(image.width, size);
    assert.equal(image.height, size);
    assert(image.data.some((value, index) => index % 4 === 3 && value === 0));
    assert(image.data.some((value, index) => index % 4 === 3 && value > 0));
    if (size === 512) {
      const cell = (column) =>
        Buffer.concat(
          Array.from({ length: 128 }, (_, y) =>
            image.data.subarray((y * 512 + column * 128) * 4, (y * 512 + (column + 1) * 128) * 4),
          ),
        );
      assert(!cell(0).equals(cell(1)));
      // The unused sixteenth cell must remain transparent.
      for (let y = 384; y < 512; y++)
        for (let x = 384; x < 512; x++) assert.equal(image.data[(y * 512 + x) * 4 + 3], 0);
    }
  }
});

test('respawn clears particles attached to the player rather than moving an old hit to the refuge', () => {
  const s = M.create();
  s.fx = [{ ...fx('enemy', 0.5), targetId: 'player' }];
  s.player.hp = 0;
  M.update(s, 0.02);
  assert(!s.fx.some((effect) => effect.targetId === 'player'));
});
