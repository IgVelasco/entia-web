import M from './rules/navigation.ts';
import { $, canvas, demo, floor } from './context.ts';
import { returnToNix } from './embed.ts';
import { togglePause, ui } from './hud.ts';
import { clear, input } from './input.ts';
import { cancelMotion, syncMotion } from './motion.ts';
import { draw, resize } from './render.ts';

export function tick(now: number) {
  demo.presentationNow = now;
  demo.raf = 0;
  if (demo.hostSuspended) return;
  const dt = Math.min((now - demo.previous) / 1000 || 0, 0.04);
  demo.previous = now;
  if (
    demo.ready &&
    !demo.paused &&
    now >= demo.beatUntil &&
    !document.hidden &&
    !demo.returning &&
    !demo.hudDrawerOpen &&
    !$('#bindings-dialog').open &&
    !$('#character-dialog').open
  ) {
    M.update(demo.state, dt, input());
    if (
      demo.state.phase === 'arena' &&
      Math.abs(demo.state.player.x - M.gateway.x) < 22 &&
      Math.abs(demo.state.player.y - M.gateway.y) < 20
    )
      returnToNix();
  }
  syncMotion(now);
  draw();
  ui();
  if (
    demo.ready &&
    !demo.paused &&
    (!demo.state.tutorial?.dialog || demo.guideHoldUntil > now) &&
    (!demo.state.tutorial?.coach?.current ||
      demo.state.tutorial.coach.revealRemaining ||
      demo.motionHandles.size > 0) &&
    !(demo.state.tutorial?.stage === 'complete' && !demo.state.streamParticles.length && demo.guideHoldUntil <= now) &&
    !document.hidden &&
    !demo.hostSuspended
  )
    schedule();
}
export function schedule() {
  if (!demo.raf && !document.hidden && !demo.hostSuspended) demo.raf = requestAnimationFrame(tick);
}
export function bindLifecycle() {
  window.addEventListener('blur', () => {
    clear();
    if (demo.ready && !demo.paused && !$('#bindings-dialog').open) togglePause(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clear();
      if (demo.ready && !demo.paused) togglePause(true);
      if (demo.raf) cancelAnimationFrame(demo.raf);
      demo.raf = 0;
    } else recoverDemoScene();
  });
  window.addEventListener('resize', resize);
  window.addEventListener('pageshow', recoverDemoScene);
  for (const surface of [canvas, floor]) {
    surface.addEventListener('contextlost', (event) => {
      event.preventDefault();
      demo.floorReady = false;
      if (demo.raf) cancelAnimationFrame(demo.raf);
      demo.raf = 0;
    });
    surface.addEventListener('contextrestored', recoverDemoScene);
  }
}
export function recoverDemoScene() {
  cancelMotion();
  clear();
  if (demo.hostSuspended) {
    demo.floorReady = false;
    return;
  }
  demo.floorReady = false;
  floor.width = demo.state.phase === 'hallway' ? 1 : M.WIDTH;
  floor.height = demo.state.phase === 'hallway' ? 1 : M.HEIGHT;
  demo.previous = performance.now();
  if (demo.raf) cancelAnimationFrame(demo.raf);
  demo.raf = 0;
  resize();
  schedule();
}
