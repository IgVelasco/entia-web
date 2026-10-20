import { camera, resize, viewport } from './camera.ts';
import { $, H, W, canvas, ground, heading, motionOff, motionPreference, site, touchPreference } from './context.ts';
import {
  advanceFrontier,
  frontierBlocked,
  positionFrontierBubble,
  tryFrontier,
  updateDownloadReveal,
  updateFrontierPauseUI,
} from './escort.ts';
import { resetJoystick } from './input.ts';
import { positionLabels } from './labels.ts';
import { advanceMovement, checkNearbySection, clearMovementInput, heldDirections, navigationPath } from './movement.ts';
import { draw } from './render.ts';
import { advanceSpell } from './spell.ts';
import { NPC_SPEED, hero, keepers, npcs, spots, townPhysics, updateHouseRoofs } from './town.ts';

export function requestDraw() {
  if (!site.ready || document.hidden || site.demoOpen || site.frameRequest) return;
  site.frameRequest = requestAnimationFrame(tick);
}
export function tick(now: number) {
  site.frameRequest = 0;
  if (site.demoOpen || document.hidden) return;
  const visibleDt = Math.max(0, (now - site.last) / 1000 || 0),
    dt = Math.min(visibleDt, 0.04);
  site.last = now;
  advanceFrontier(visibleDt);
  if (motionOff() && !site.paused && site.joystickDirection !== null && !site.frontierState.open && !frontierBlocked())
    advanceMovement(dt);
  if (!motionOff()) {
    site.time += dt;
    if (!site.enteringPortal && !$('#character-dialog').open && !site.frontierState.open) advanceMovement(dt);
    advanceSpell(dt);
    site.rings = site.rings.filter((r) => (r.age += dt) < r.duration);
    for (const n of [...npcs, ...keepers]) {
      if (site.frontierState.open) continue;
      if (n.reaction > 0) {
        n.reaction = Math.max(0, n.reaction - dt);
        n.dir = heading(hero.x - n.x, hero.y - n.y);
        continue;
      }
      if (n.isKeeper) continue;
      const [x, y] = n.way[n.idx];
      if (!n.path?.length) n.path = townPhysics.path(n, { x, y }, [hero, ...keepers, ...npcs.filter((a) => a !== n)]);
      const next = n.path[0];
      if (!next) {
        n.idx = (n.idx + 1) % n.way.length;
        continue;
      }
      const dx = next.x - n.x,
        dy = next.y - n.y,
        d = Math.hypot(dx, dy),
        step = Math.min(NPC_SPEED * dt, d);
      n.dir = heading(dx, dy);
      const moved = townPhysics.move(n, d ? (dx / d) * step : 0, d ? (dy / d) * step : 0, [
        hero,
        ...keepers,
        ...npcs.filter((a) => a !== n),
      ]);
      if (d < 1) {
        n.path.shift();
        if (!n.path.length) n.idx = (n.idx + 1) % n.way.length;
      } else if (moved < 0.01) n.path = [];
    }
    const blend = 1 - Math.exp(-dt * 7);
    camera.x += (camera.targetX - camera.x) * blend;
    camera.y += (camera.targetY - camera.y) * blend;
  }
  updateHouseRoofs(dt);
  viewport();
  positionLabels();
  positionFrontierBubble();
  updateDownloadReveal();
  draw();
  if (!motionOff() || ((site.frontierSequence || site.joystickDirection !== null) && !site.paused)) requestDraw();
}
export function setMotionState() {
  updateFrontierPauseUI();
  const off = motionOff();
  $('#world').classList.toggle('motion-off', off);
  $('#motion').textContent = off ? '▷' : 'Ⅱ';
  $('#motion').setAttribute(
    'aria-label',
    motionPreference.matches
      ? 'Reduced motion is on'
      : site.paused
        ? 'Resume world animation'
        : 'Pause world animation',
  );
  $('#motion').setAttribute('aria-pressed', String(off));
  $('#motion').disabled = motionPreference.matches;
  $('#motion').title = motionPreference.matches
    ? 'Following your reduced-motion preference'
    : site.paused
      ? 'Resume animation'
      : 'Pause animation';
  if (off) {
    resetJoystick();
    heldDirections.clear();
    if (site.frameRequest) cancelAnimationFrame(site.frameRequest);
    site.frameRequest = 0;
    const pending = site.route;
    site.route = null;
    site.spell = null;
    site.rings = [];
    if (pending) {
      const points = pending.destination ? navigationPath(pending.destination) : [pending.target],
        target = points.at(-1);
      if (target && townPhysics.free(target.x, target.y, [...keepers, ...npcs], hero)) {
        const before = { x: hero.x, y: hero.y };
        hero.x = target.x;
        hero.y = target.y;
        const intercepted = pending.explore && tryFrontier(before, hero);
        if (!intercepted) {
          if (pending.explore) checkNearbySection();
          pending.complete?.();
        }
      } else {
        $('#location-state').textContent = 'Path blocked';
        $('#world').classList.remove('traveling');
      }
    }
    camera.x = camera.targetX;
    camera.y = camera.targetY;
    for (const a of [...npcs, ...keepers]) a.reaction = 0;
    for (const animation of $('#world').getAnimations({ subtree: true })) animation.cancel();
  }
  site.last = performance.now();
  requestDraw();
}
export function bindLifecycle() {
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resetJoystick);
  window.visualViewport?.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearMovementInput();
      if (site.frameRequest) cancelAnimationFrame(site.frameRequest);
      site.frameRequest = 0;
    } else recoverScene();
  });
  motionPreference.addEventListener('change', setMotionState);
  touchPreference.addEventListener('change', resize);
}
export function bindPageShow() {
  window.addEventListener('pageshow', () => {
    recoverScene();
    if (site.enteringPortal) {
      document.querySelector('#portal-transition')?.remove();
      $('#world').classList.remove('entering-portal');
      site.enteringPortal = false;
      hero.x = spots.home.land.x;
      hero.y = spots.home.land.y;
      site.route = null;
      resize();
      requestDraw();
    }
  });
}
// Mobile browsers can discard cached canvas pixels while the page is hidden.
export function recoverScene() {
  site.groundReady = false;
  site.worldPatterns = null;
  if (site.demoOpen) return;
  ground.width = W;
  ground.height = H;
  site.last = performance.now();
  if (site.frameRequest) cancelAnimationFrame(site.frameRequest);
  site.frameRequest = 0;
  resize();
  requestDraw();
}
export function bindSurfaceRecovery() {
  for (const surface of [canvas, ground]) {
    surface.addEventListener('contextlost', (event) => {
      event.preventDefault();
      site.groundReady = false;
      if (site.frameRequest) cancelAnimationFrame(site.frameRequest);
      site.frameRequest = 0;
    });
    surface.addEventListener('contextrestored', recoverScene);
  }
}
