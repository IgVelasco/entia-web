const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');
const { actorFrame, spritePixel, visibleActorAt } = require('../src/demo/actor-sprites.ts');
const images = Object.fromEntries(
  ['hero', 'mage', 'rogue'].map((body) => [
    body,
    PNG.sync.read(fs.readFileSync(path.join(__dirname, '../public/assets', body + '.png'))),
  ]),
);
const opaque = (body, x, y) => images[body].data[(y * images[body].width + x) * 4 + 3] >= 32;

test('clicks on the actual chest hit all bodies in all directions and animation poses', () => {
  for (const body of Object.keys(images))
    for (let dir = 0; dir < 4; dir++)
      for (const gait of [0, 8, 24, 40, 56, 72]) {
        const actor = { x: 500, y: 400, body, dir, gait, moving: gait > 0 };
        const point = { x: 500, y: 360 };
        assert.equal(visibleActorAt([actor], point, opaque), actor, `${body} direction ${dir} gait ${gait}`);
        assert.deepEqual(point, { x: 500, y: 360 }, 'targeting never moves the pointer');
        assert.equal(
          visibleActorAt([actor], { x: 500, y: 310 }, opaque),
          undefined,
          'transparent top padding is not a hit',
        );
        assert.equal(
          visibleActorAt([actor], { x: 531, y: 360 }, opaque),
          undefined,
          'neighbouring empty space is not a hit',
        );
      }
});

test('render and hit sampling share the rounded destination rectangle and source frame', () => {
  const actor = { x: 500.4, y: 400.2, dir: 3, gait: 0 };
  assert.deepEqual(actorFrame(actor, 'rogue'), { sx: 0, sy: 480, x: 470, y: 301, width: 60, height: 100 });
  assert.deepEqual(spritePixel(actor, 'rogue', { x: 500, y: 360 }), { x: 48, y: 574 });
});

test('overlapping sprites select the front visible pixels, with transparent padding letting the back sprite show', () => {
  const back = { x: 500, y: 400, body: 'rogue', dir: 2, gait: 0 };
  const front = { x: 500, y: 432, body: 'hero', dir: 2, gait: 0 };
  assert.equal(visibleActorAt([back, front], { x: 500, y: 392 }, opaque), front);
  assert.equal(visibleActorAt([back, front], { x: 500, y: 360 }, opaque), back);
  const tied = { ...front };
  assert.equal(visibleActorAt([front, tied], { x: 500, y: 392 }, opaque), tied);
});
