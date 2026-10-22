/* Click orders share keyboard movement and collision rules; no second game loop. */
import * as Physics from '../../shared/physics.ts';
import M from './tutorial.ts';
import type { DemoState, Point } from './state.ts';
import { occupiedPosition, sameTile } from './occupancy.ts';
const originalUpdate = M.update;
function cancelWalk(s: DemoState) {
  s.navigation = null;
}
function walkTo(s: DemoState, target?: Point | null, guide: string | null = null) {
  cancelWalk(s);
  if (
    !target ||
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.y) ||
    s.armed ||
    s.tutorial?.stage === 'setup' ||
    !!s.tutorial?.coach?.current ||
    s.tutorial?.dialog ||
    s.tutorial?.stage === 'complete'
  )
    return false;
  const p = s.player,
    start = p.step?.end || p;
  let points: Point[] = [];
  if (s.phase === 'hallway') {
    const end = {
      x: Math.max(M.hallway.walk.minX, Math.min(s.tutorial!.seen.length === 3 ? M.hallway.walk.maxX : 432, target.x)),
      y: Math.max(M.hallway.walk.minY, Math.min(M.hallway.walk.maxY, target.y)),
    };
    points = [{ x: end.x, y: start.y }, end].filter((q) => Math.hypot(q.x - start.x, q.y - start.y) > 0.1);
  } else {
    const physics = Physics.create({
      width: M.WIDTH,
      height: M.HEIGHT,
      minY: 160,
      radius: M.RADIUS,
      obstacles: [...M.obstacles, ...(s.bankUnlocked ? [M.bankBounds(s)] : [])],
    });
    const occupied = (point: Point) => s.enemies.some((e) => e.hp > 0 && sameTile(occupiedPosition(e), point)),
      tx = Math.round((target.x - start.x) / 32),
      ty = Math.round((target.y - start.y) / 32);
    const end = { x: start.x + tx * 32, y: start.y + ty * 32 };
    if (!physics.free(end.x, end.y) || occupied(end)) {
      M.tell(s, 'That spot is blocked. Click open ground.');
      return false;
    }
    const queue = [{ x: 0, y: 0, prev: -1 }],
      seen = new Set(['0,0']);
    let found = -1;
    // At most the arena's tile count; allocations live only for this click.
    for (let i = 0; i < queue.length && i < 1400; i++) {
      const q = queue[i],
        a = { x: start.x + q.x * 32, y: start.y + q.y * 32 };
      if (q.x === tx && q.y === ty) {
        found = i;
        break;
      }
      const directions =
        Math.abs(tx - q.x) > Math.abs(ty - q.y)
          ? [
              [Math.sign(tx - q.x) || 1, 0],
              [0, Math.sign(ty - q.y) || 1],
              [-(Math.sign(tx - q.x) || 1), 0],
              [0, -(Math.sign(ty - q.y) || 1)],
            ]
          : [
              [0, Math.sign(ty - q.y) || 1],
              [Math.sign(tx - q.x) || 1, 0],
              [0, -(Math.sign(ty - q.y) || 1)],
              [-(Math.sign(tx - q.x) || 1), 0],
            ];
      for (const [dx, dy] of directions) {
        const x = q.x + dx,
          y = q.y + dy,
          key = x + ',' + y;
        if (seen.has(key)) continue;
        const b = { x: start.x + x * 32, y: start.y + y * 32 };
        if (!occupied(b) && physics.clear(a, b)) {
          seen.add(key);
          queue.push({ x, y, prev: i });
        }
      }
    }
    if (found < 0) {
      M.tell(s, 'No clear route. Try a closer spot.');
      return false;
    }
    for (let i = found; i > 0; i = queue[i].prev)
      points.push({ x: start.x + queue[i].x * 32, y: start.y + queue[i].y * 32 });
    points.reverse();
  }
  s.navigation = { points, guide, phase: s.phase, stalled: 0 };
  s.meditating = false;
  return true;
}
function finish(s: DemoState) {
  const guide = s.navigation?.guide;
  cancelWalk(s);
  if (guide && s.phase === 'hallway') {
    const g = M.guides.find((g) => g.id === guide);
    if (g && Math.hypot(g.x - s.player.x, g.y - s.player.y) < 100) M.talk(s, guide);
  }
}
M.update = function (s, dt, input = { x: 0, y: 0 }) {
  if (s.tutorial?.coach?.current) return;
  if (input.x || input.y) cancelWalk(s);
  if (s.player.hp <= 0 || s.tutorial?.dialog || s.navigation?.phase !== s.phase) cancelWalk(s);
  let nav = s.navigation;
  const p = s.player,
    x = p.x,
    y = p.y;
  if (nav && !p.step) {
    while (nav.points.length && Math.hypot(nav.points[0].x - p.x, nav.points[0].y - p.y) < 0.1) nav.points.shift();
    if (!nav.points.length) {
      finish(s);
      nav = null;
    }
  }
  const stepEnd = p.step?.end,
    noticeBefore = s.noticeId;
  originalUpdate(s, dt, input);
  if (nav && s.navigation === nav) {
    if (s.tutorial?.dialog) {
      cancelWalk(s);
      return;
    }
    while (nav.points.length && Math.hypot(nav.points[0].x - p.x, nav.points[0].y - p.y) < 0.1) nav.points.shift();
    if (!nav.points.length && !p.step) {
      finish(s);
      return;
    }
    if (s.phase !== nav.phase || Math.hypot(p.x - x, p.y - y) > 160 * Math.max(0, Math.min(dt, 0.05)) + 0.1) {
      cancelWalk(s);
      return;
    }
    if (
      s.phase === 'arena' &&
      !p.step &&
      nav.points.length &&
      Math.hypot(p.x - x, p.y - y) > 0.001 &&
      Math.hypot((stepEnd || nav.points[0]).x - p.x, (stepEnd || nav.points[0]).y - p.y) > 0.1
    ) {
      cancelWalk(s);
      if (s.noticeId === noticeBefore) M.tell(s, 'Route blocked. Click again to choose a new path.');
      return;
    }
    if (!p.immobilized) {
      nav.stalled = Math.hypot(p.x - x, p.y - y) < 0.001 ? nav.stalled + Math.max(0, Math.min(dt, 0.05)) : 0;
      if (nav.stalled > 0.5) {
        cancelWalk(s);
        if (s.noticeId === noticeBefore) M.tell(s, 'Route blocked. Click again to choose a new path.');
      }
    }
  }
};
// The demo's complete rules: the model object with the tutorial and click-navigation layers applied.
export default Object.assign(M, { walkTo, cancelWalk });
