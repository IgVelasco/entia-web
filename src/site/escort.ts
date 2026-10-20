// The frontier wizard: a boundary encounter that escorts the hero from the world's edge to the Download keeper.
import type { Point } from '../shared/physics.ts';
import * as WorldFrontier from './frontier.ts';
import { worldToScreen } from './camera.ts';
import { content, openZoneInfo } from './content.ts';
import { $, H, W, canvas, clamp, compactMode, heading, motionOff, motionPreference, site } from './context.ts';
import { resetJoystick, setAim } from './input.ts';
import { requestDraw, setMotionState } from './loop.ts';
import { heldDirections } from './movement.ts';
import { go, toast } from './routing.ts';
import { FRONTIER_INSET, FRONTIER_MARGIN, hero, keepers, npcs, spots, townPhysics } from './town.ts';
import type { Actor } from './town.ts';

export type FrontierPhase = 'appear' | 'speak' | 'escort' | 'teleport-out' | 'teleport-in' | 'vanish';
// A collision-checked path to the Download landing, extended past it so the wizard can lead 48 units ahead.
export interface EscortPlan {
  points: Point[];
  length: number;
  distance: number;
}
// The escort in progress; the view* fields hold the camera framing captured when the wizard appeared.
export interface FrontierSequence extends EscortPlan {
  phase: FrontierPhase;
  elapsed: number;
  viewScale: number;
  viewWidth: number;
  viewHeight: number;
  viewOx: number;
  viewOy: number;
  fast?: boolean;
}
export interface FrontierWizard extends Actor {
  type: 'frontier';
  isKeeper: true;
  gait: number;
  reaction: number;
}

export function frontierBlocked() {
  return (
    document.hidden ||
    site.demoOpen ||
    site.enteringPortal ||
    $('#notes').open ||
    $('#character-dialog').open ||
    $('#zone-dialog').open
  );
}
// Freeze the three wandering NPCs while escorting: the shared, collision-checked
// path stays valid and the guide and player never chase each other into scenery.
function planFrontierEscort() {
  const others = [...keepers, ...npcs],
    start = { x: hero.x, y: hero.y },
    goal = spots.gate.land;
  const route = townPhysics.path(start, goal, others);
  if (!route.length) return null;
  const points = [start, ...route],
    length = WorldFrontier.pathLength(points);
  for (const delta of [
    { x: 48, y: 0 },
    { x: 0, y: 48 },
    { x: -48, y: 0 },
    { x: 0, y: -48 },
  ]) {
    const tail = { x: goal.x + delta.x, y: goal.y + delta.y };
    if (!townPhysics.clear(goal, tail, others)) continue;
    const extended = [...points, tail];
    let separated = true;
    for (let d = 0; d <= length; d += 2) {
      const p = WorldFrontier.samplePath(extended, d),
        q = WorldFrontier.samplePath(extended, d + 48);
      if (Math.hypot(p.x - q.x, p.y - q.y) < 24) {
        separated = false;
        break;
      }
    }
    if (separated) return { points: extended, length, distance: 0 };
  }
  return null;
}
export function tryFrontier(from: Point, to: Point, kind: 'move' | 'attempt' = 'move', explore = true) {
  const next = WorldFrontier.boundaryEvent(site.frontierState, {
    from: { x: from.x + FRONTIER_MARGIN, y: from.y + FRONTIER_MARGIN },
    to: { x: to.x + FRONTIER_MARGIN, y: to.y + FRONTIER_MARGIN },
    kind,
    explore,
    blocked: frontierBlocked(),
    width: W + FRONTIER_MARGIN * 2,
    height: H + FRONTIER_MARGIN * 2,
    inset: FRONTIER_INSET,
  });
  if (next === site.frontierState) return false;
  const plan = planFrontierEscort();
  if (!plan) {
    toast('The way is blocked. Step back into town and try again.');
    return false;
  }
  site.frontierState = next;
  resetJoystick();
  heldDirections.clear();
  site.route = null;
  site.spell = null;
  setAim(false);
  const spawn = WorldFrontier.samplePath(plan.points, 48);
  site.frontierWizard = {
    ...spawn,
    body: 'wizard-walk',
    isKeeper: true,
    gait: 0,
    reaction: 0,
    dir: heading(hero.x - spawn.x, hero.y - spawn.y),
    type: 'frontier',
  };
  site.frontierSequence = {
    ...plan,
    phase: 'appear',
    elapsed: 0,
    viewScale: site.scale,
    viewWidth: site.width,
    viewHeight: site.height,
    viewOx: site.ox,
    viewOy: site.oy,
  };
  $('#frontier-download-reveal').innerHTML =
    '<span class="frontier-close-space" aria-hidden="true"></span>' + content('gate');
  $('#frontier-download-reveal').hidden = true;
  $('#frontier-description').textContent = '';
  $('#frontier-bubble').hidden = true;
  $('#world').classList.add('frontier-active');
  updateFrontierPauseUI();
  site.last = performance.now();
  requestDraw();
  return true;
}
function frontierPhase(phase: FrontierPhase, text?: string) {
  if (!site.frontierSequence) return;
  site.frontierSequence.phase = phase;
  site.frontierSequence.elapsed = 0;
  if (text) {
    $('#frontier-description').textContent = text;
    $('#frontier-bubble').hidden = false;
  }
}
export function dismissFrontier({ focus = true } = {}) {
  site.frontierSequence = null;
  site.frontierState = WorldFrontier.initialState();
  site.frontierWizard = null;
  $('#frontier-bubble').hidden = true;
  $('#frontier-download-reveal').hidden = true;
  $('#frontier-download-reveal').style.setProperty('--reveal', '0');
  $('#world').classList.remove('frontier-active');
  resetJoystick();
  heldDirections.clear();
  if (focus && !site.demoOpen && !document.hidden) canvas.focus({ preventScroll: true });
  requestDraw();
}
export function skipFrontierWalk() {
  const s = site.frontierSequence;
  if (!s || s.fast) return;
  s.fast = true;
  frontierPhase('teleport-out', 'Hold tight, traveller. I’ll take you there!');
  if (site.paused) {
    site.paused = false;
    setMotionState();
  }
  site.last = performance.now();
  requestDraw();
}
export function viewFrontierDownloads() {
  if (!site.frontierState.open || site.frontierSequence?.phase !== 'vanish') return;
  dismissFrontier({ focus: false });
  go('gate', { instant: true, animateContent: false });
  if (compactMode()) openZoneInfo('gate', { arrival: true });
  else $('#section-heading')?.focus({ preventScroll: true });
}
export function updateFrontierPauseUI() {
  if (!site.frontierSequence) return;
  $('#frontier-resume').hidden = !site.paused;
  $('#frontier-paused').hidden = !site.paused;
  $('#frontier-bubble').hidden = !site.paused && ['appear', 'vanish'].includes(site.frontierSequence.phase);
}
export function advanceFrontier(dt: number) {
  const s = site.frontierSequence;
  if (!s) return;
  if (frontierBlocked()) {
    dismissFrontier({ focus: false });
    return;
  }
  if (site.paused) return;
  s.elapsed += dt;
  if (s.phase === 'appear' && s.elapsed >= (motionOff() ? 0.05 : 0.8))
    frontierPhase(
      'speak',
      'Wait, traveller! These lands lead beyond the preview. Come with me. I’ll show you where to download Entia.',
    );
  else if (s.phase === 'speak' && s.elapsed >= 1.5) frontierPhase('escort');
  else if (s.phase === 'teleport-out' && s.elapsed >= (motionOff() ? 0.05 : 0.28)) {
    s.distance = s.length;
    for (const [actor, distance] of [
      [hero, s.length],
      [site.frontierWizard!, s.length + 48],
    ] as const)
      Object.assign(actor, WorldFrontier.samplePath(s.points, distance));
    hero.dir = heading(site.frontierWizard!.x - hero.x, site.frontierWizard!.y - hero.y);
    site.frontierWizard!.dir = heading(hero.x - site.frontierWizard!.x, hero.y - site.frontierWizard!.y);
    frontierPhase('teleport-in');
  } else if (s.phase === 'teleport-in' && s.elapsed >= (motionOff() ? 0.05 : 0.32)) {
    $('#frontier-bubble').hidden = true;
    frontierPhase('vanish');
  } else if (s.phase === 'escort') {
    let nextDistance = Math.min(s.length, s.distance + 96 * Math.min(dt, 0.04)),
      vertex = 0;
    // Stop at the next turn of either actor; even a dropped frame stays cardinal.
    for (let i = 1; i < s.points.length; i++) {
      vertex += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y);
      for (const stop of [vertex, vertex - 48])
        if (stop > s.distance + 0.001) nextDistance = Math.min(nextDistance, stop);
    }
    s.distance = nextDistance;
    for (const [actor, distance] of [
      [hero, s.distance],
      [site.frontierWizard!, s.distance + 48],
    ] as const) {
      const p = WorldFrontier.samplePath(s.points, distance),
        dx = p.x - actor.x,
        dy = p.y - actor.y;
      if (Math.hypot(dx, dy) > 0.001) {
        actor.dir = heading(dx, dy);
        actor.gait += Math.hypot(dx, dy);
        actor.x = p.x;
        actor.y = p.y;
      }
    }
    if (s.distance >= s.length) {
      hero.dir = heading(site.frontierWizard!.x - hero.x, site.frontierWizard!.y - hero.y);
      site.frontierWizard!.dir = heading(hero.x - site.frontierWizard!.x, hero.y - site.frontierWizard!.y);
      $('#frontier-bubble').hidden = true;
      frontierPhase('vanish');
    }
  } else if (s.phase === 'vanish' && s.elapsed >= (motionOff() ? 0.05 : 0.22)) viewFrontierDownloads();
}
export function updateDownloadReveal() {
  const s = site.frontierSequence,
    node = $('#frontier-download-reveal');
  if (!s || compactMode()) {
    node.hidden = true;
    return;
  }
  const revealing =
    ['escort', 'teleport-in', 'vanish'].includes(s.phase) || (s.phase === 'teleport-out' && s.distance > 0);
  node.hidden = !revealing;
  if (!revealing) return;
  // Reveal the real destination content without navigating or activating controls.
  const travelled = s.length ? clamp(s.distance / s.length, 0, 1) : 1;
  const progress = ['teleport-in', 'vanish'].includes(s.phase) ? 1 : clamp(travelled / 0.9, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  node.style.setProperty('--reveal', String(eased));
  node.classList.toggle('reduced-reveal', motionPreference.matches);
}
export function positionFrontierBubble() {
  if (!site.frontierWizard || $('#frontier-bubble').hidden) return;
  const p = worldToScreen(site.frontierWizard),
    bubble = $('#frontier-bubble');
  bubble.style.left = clamp(p.x, Math.min(154, site.width / 2), Math.max(site.width - 154, site.width / 2)) + 'px';
  bubble.style.top = Math.max(155, p.y - 105 * site.scale - 12) + 'px';
}
