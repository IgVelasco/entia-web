const test = require('node:test');
const assert = require('node:assert/strict');
const {
  initialState,
  boundaryEvent,
  closeBoundary,
  rearm,
  pathLength,
  samplePath,
  visibleTiles,
} = require('../src/site/frontier.ts');
const event = (from, to, extra = {}) => boundaryEvent(initialState(), { from, to, ...extra });
test('deliberate approach opens the matching edge', () => {
  for (const [edge, from, to] of [
    ['west', { x: 110, y: 450 }, { x: 90, y: 450 }],
    ['east', { x: 1330, y: 450 }, { x: 1350, y: 450 }],
    ['north', { x: 720, y: 110 }, { x: 720, y: 90 }],
    ['south', { x: 720, y: 790 }, { x: 720, y: 810 }],
  ]) {
    const result = event(from, to);
    assert.equal(result.edge, edge);
    assert(result.open);
  }
});
test('idle, parallel, inward and non-exploration motion do not open', () => {
  for (const [from, to, extra] of [
    [{ x: 70, y: 450 }, { x: 70, y: 450 }, {}],
    [{ x: 70, y: 450 }, { x: 70, y: 460 }, {}],
    [{ x: 70, y: 450 }, { x: 90, y: 450 }, {}],
    [{ x: 110, y: 450 }, { x: 90, y: 450 }, { explore: false }],
  ])
    assert(!event(from, to, extra).open);
});
test('reduced-motion endpoint still counts as deliberate movement', () => {
  assert(event({ x: 870, y: 470 }, { x: 60, y: 470 }).open);
});
test('outward blocked keyboard step at the boundary opens once', () => {
  const state = event({ x: 48, y: 450 }, { x: 16, y: 450 }, { kind: 'attempt' });
  assert(state.open);
  assert.equal(state.edge, 'west');
  const closed = closeBoundary(state);
  assert(!closed.open);
  assert(closed.seen);
  assert.equal(boundaryEvent(closed, { from: { x: 48, y: 450 }, to: { x: 16, y: 450 }, kind: 'attempt' }), closed);
});
test('outside clicks never summon from across the world', () => {
  assert(!event({ x: 880, y: 464 }, { x: 1600, y: 464 }, { kind: 'attempt' }).open);
  assert(event({ x: 1392, y: 464 }, { x: 1600, y: 464 }, { kind: 'attempt' }).open);
});
test('a blocked tree or building does not imply a boundary', () => {
  assert(!event({ x: 80, y: 450 }, { x: 48, y: 450 }, { kind: 'attempt' }).open);
});
test('demo, modal, transition or hidden-page suppression does not consume encounter', () => {
  for (const suppression of ['demo', 'modal', 'transition', 'hidden']) {
    const state = event({ x: 110, y: 450 }, { x: 90, y: 450 }, { blocked: true });
    assert(!state.seen, suppression);
    assert(!state.open, suppression);
    assert(boundaryEvent(state, { from: { x: 90, y: 450 }, to: { x: 60, y: 450 } }).open);
  }
});
test('dismissal does not rearm until an actual safe interior position', () => {
  const shown = event({ x: 110, y: 450 }, { x: 90, y: 450 });
  const closed = closeBoundary(shown);
  assert.equal(closeBoundary(closed), closed);
  assert.equal(boundaryEvent(closed, { from: { x: 720, y: 790 }, to: { x: 720, y: 810 } }), closed);
});
test('corner ties are deterministic and only one edge appears', () => {
  const shown = event({ x: 110, y: 90 }, { x: 80, y: 90 });
  assert.equal(shown.edge, 'west');
});
test('invalid coordinates never create an encounter', () => {
  assert(!event({ x: Infinity, y: 450 }, { x: 80, y: 450 }).open);
});
test('visible tiled region covers viewport including negative map coordinates', () => {
  const view = { width: 2048, height: 1152, scale: 1.2, ox: 1000, oy: 575 };
  const tiles = visibleTiles(view);
  assert(tiles.left <= -view.ox / view.scale);
  assert(tiles.right >= (view.width - view.ox) / view.scale);
  assert(tiles.top <= -view.oy / view.scale);
  assert(tiles.bottom >= (view.height - view.oy) / view.scale);
  assert(tiles.columns <= Math.ceil(view.width / view.scale / 32) + 1);
  assert(tiles.rows <= Math.ceil(view.height / view.scale / 32) + 1);
});
test('panning changes the tile origin without growing backing surfaces', () => {
  const a = visibleTiles({ width: 1920, height: 1080, scale: 1.16, ox: 0, oy: 0 });
  const b = visibleTiles({ width: 1920, height: 1080, scale: 1.16, ox: 1000000, oy: -1000000 });
  assert(Math.abs(a.columns - b.columns) <= 1);
  assert(Math.abs(a.rows - b.rows) <= 1);
});

test('safe interior rearming uses hysteresis and never resets an active encounter', () => {
  const shown = event({ x: 110, y: 450 }, { x: 90, y: 450 }),
    closed = closeBoundary(shown);
  assert.equal(rearm(closed, { x: 128, y: 450 }), closed);
  assert.equal(rearm(shown, { x: 200, y: 450 }), shown);
  const ready = rearm(closed, { x: 129, y: 450 });
  assert(!ready.seen);
  assert(boundaryEvent(ready, { from: { x: 110, y: 450 }, to: { x: 90, y: 450 } }).open);
});
test('shared route samples stay on cardinal segments and clamp at the end', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 48, y: 0 },
    { x: 48, y: 64 },
  ];
  assert.equal(pathLength(points), 112);
  assert.deepEqual(samplePath(points, 24), { x: 24, y: 0 });
  assert.deepEqual(samplePath(points, 80), { x: 48, y: 32 });
  assert.deepEqual(samplePath(points, 999), { x: 48, y: 64 });
});
