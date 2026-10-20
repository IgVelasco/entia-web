// Hero movement: destination walks along collision-checked cardinal paths, keyboard and thumbstick steps, and proximity to sections.
import type { Point } from '../shared/physics.ts';
import * as WorldFrontier from './frontier.ts';
import { setContent } from './content.ts';
import { $, canvas, heading, motionOff, site } from './context.ts';
import type { Destination } from './context.ts';
import { tryFrontier } from './escort.ts';
import { resetJoystick, setAim } from './input.ts';
import { updateKeeperStates } from './labels.ts';
import { requestDraw } from './loop.ts';
import { portalCrossing } from './portal.ts';
import { reactToArrival, toast } from './routing.ts';
import { WALK_SPEED, WALK_TILE, hero, keepers, npcs, spots, townPhysics } from './town.ts';
import type { Keeper } from './town.ts';

export interface MoveOptions {
  complete?: () => void;
  instant?: boolean;
  manual?: boolean;
  explore?: boolean;
  joystick?: boolean;
  destination?: Destination | null;
}

const NEAR_ENTER = 72,
  NEAR_EXIT = 104;
export const heldDirections = new Map<string, number>();
export const movementKeys: Record<string, number> = {
  w: 0,
  ArrowUp: 0,
  d: 1,
  ArrowRight: 1,
  s: 2,
  ArrowDown: 2,
  a: 3,
  ArrowLeft: 3,
};
const directions = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];
export function advanceRoute(dt: number) {
  const r = site.route;
  if (!r) return;
  r.elapsed += dt;
  if (r.retryIn !== undefined) {
    r.retryIn -= dt;
    if (r.retryIn > 0) return;
    const next = navigationPath(r.destination);
    if (!next.length) {
      r.retries = (r.retries || 0) + 1;
      if (r.retries > 40) {
        site.route = null;
        $('#location-state').textContent = 'Path blocked';
        $('#world').classList.remove('traveling');
        toast('The path is blocked. Try approaching from another side.');
      } else r.retryIn = 0.2;
      return;
    }
    r.points = next;
    r.segment = 0;
    r.target = next.at(-1)!;
    delete r.retryIn;
  }
  let budget = WALK_SPEED * dt;
  if (site.route === r && budget > 0 && r.segment < r.points.length) {
    const target = r.points[r.segment],
      dx = target.x - hero.x,
      dy = target.y - hero.y,
      d = Math.hypot(dx, dy);
    if (d < 0.01) {
      r.segment++;
      if (r.segment >= r.points.length) {
        site.route = null;
        r.complete?.();
      }
      return;
    }
    const before = { x: hero.x, y: hero.y },
      step = Math.min(budget, d),
      moved = townPhysics.move(hero, (dx / d) * step, (dy / d) * step, [...keepers, ...npcs]);
    hero.dir = heading(dx, dy);
    r.distance += moved;
    budget -= step;
    if (r.explore && moved > 0 && tryFrontier(before, hero)) return;
    if (moved + 1e-5 < step) {
      if (r.destination) r.retryIn = 0.2;
      else site.route = null;
      return;
    }
    if (step >= d - 0.001) {
      hero.x = target.x;
      hero.y = target.y;
      r.segment++;
    }
    if (r.explore) {
      portalCrossing();
      checkNearbySection();
    }
  }
  if (site.route === r && r.segment >= r.points.length) {
    site.route = null;
    r.complete?.();
  }
}
export function moveHero(
  points: Point[],
  {
    complete,
    instant = false,
    manual = false,
    explore = manual,
    joystick = false,
    destination = null,
  }: MoveOptions = {},
) {
  if (!points.length) {
    site.route = null;
    $('#location-state').textContent = 'Path blocked';
    $('#world').classList.remove('traveling');
    toast('That route is blocked. Try another spot.');
    return;
  }
  const target = points.at(-1)!;
  let from: Point = hero,
    length = 0;
  for (const p of points) {
    length += Math.hypot(p.x - from.x, p.y - from.y);
    from = p;
  }
  // Every new action replaces the previous route and its completion callback.
  site.route = null;
  if ((motionOff() && !joystick) || instant || length < 2) {
    const before = { x: hero.x, y: hero.y };
    hero.x = target.x;
    hero.y = target.y;
    if (explore && tryFrontier(before, hero)) return;
    if (explore) checkNearbySection();
    complete?.();
    requestDraw();
    return;
  }
  site.route = {
    sx: hero.x,
    sy: hero.y,
    target,
    points,
    segment: 0,
    length,
    distance: 0,
    elapsed: 0,
    duration: length / WALK_SPEED,
    complete,
    manual,
    explore,
    joystick,
    destination,
  };
  requestDraw();
}
export function navigationPath(destination: Destination | null) {
  if (!destination) return [];
  const keeper = spots[destination.place],
    others = [...keepers, ...npcs];
  if (!destination.near) return walkingPath(keeper.land);
  if (Math.hypot(hero.x - keeper.x, hero.y - keeper.y) <= 48 && townPhysics.free(hero.x, hero.y, others, hero))
    return [{ x: hero.x, y: hero.y }];
  const candidates: { points: Point[]; length: number }[] = [];
  for (const dx of [-32, 0, 32])
    for (const dy of [-32, 0, 32]) {
      if (!dx && !dy) continue;
      const target = { x: keeper.x + dx, y: keeper.y + dy };
      const points = townPhysics.path(hero, target, others);
      if (points.length)
        candidates.push({ points, length: WorldFrontier.pathLength([{ x: hero.x, y: hero.y }, ...points]) });
    }
  candidates.sort((a, b) => a.length - b.length);
  return candidates[0]?.points || [];
}
export function walkingPath(target: Point) {
  return townPhysics.path(hero, target, [...keepers, ...npcs]);
}
export function isWalkable(x: number, y: number) {
  return townPhysics.free(x, y, [...keepers, ...npcs], hero);
}
export function clearMovementInput() {
  resetJoystick();
  heldDirections.clear();
  if (site.route?.manual) site.route = null;
  requestDraw();
}
export function beginManualMovement({ focus = true } = {}) {
  // Playing returns focus to the world instead of leaving a keeper label focused.
  if (focus) canvas.focus({ preventScroll: true });
  site.hovered = null;
  // Keep the in-progress footstep, but discard the old destination/reward callback.
  if (site.route && !site.route.manual) {
    const next = site.route.points[site.route.segment],
      distance = Math.hypot(next.x - hero.x, next.y - hero.y);
    const step = Math.min(WALK_TILE - (hero.gait % WALK_TILE), distance);
    if (distance > 0.001)
      moveHero(
        [{ x: hero.x + ((next.x - hero.x) / distance) * step, y: hero.y + ((next.y - hero.y) / distance) * step }],
        { manual: true, complete: checkWalkingProgress },
      );
    else site.route = null;
  }
  site.atPlace = null;
  setAim(false);
  clearTimeout(site.replyTimer);
  $('#keeper-reply').hidden = true;
  $('#world').classList.remove('traveling');
  $('#location-state').textContent = 'Exploring Nix';
  updateKeeperStates();
}
export function startKeyboardStep(direction = [...heldDirections.values()].at(-1)) {
  if (site.route || direction === undefined || !site.ready || site.frontierState.open) return;
  const vector = directions[direction],
    target = { x: hero.x + vector.x * WALK_TILE, y: hero.y + vector.y * WALK_TILE };
  hero.dir = direction;
  // Four-direction steps cannot cut through the house or leave the square.
  if (!isWalkable(target.x, target.y)) {
    if (tryFrontier(hero, target, 'attempt')) return;
    requestDraw();
    return;
  }
  moveHero([target], { manual: true, joystick: heldDirections.has('joystick'), complete: checkWalkingProgress });
}
export function advanceMovement(dt: number) {
  if (!site.route) startKeyboardStep();
  if (site.route) advanceRoute(dt);
  if (!site.route) startKeyboardStep();
}
export function checkWalkingProgress() {
  portalCrossing();
}
export function checkNearbySection() {
  // Exploration opens content in place. Never redirect the walk, release held
  // keys or cast a spell to select a section.
  const distance = (place: string) => Math.hypot(hero.x - spots[place].x, hero.y - spots[place].y);
  if (site.nearbyPlace && distance(site.nearbyPlace) <= NEAR_EXIT) {
    site.atPlace = site.nearbyPlace;
    $('#location-state').textContent = 'You are here';
    return;
  }
  if (site.nearbyPlace) {
    site.nearbyPlace = null;
    site.atPlace = null;
    $('#location-state').textContent = 'Exploring Nix';
  }
  const nearest = keepers.reduce<Keeper | null>(
    (best, k) => (distance(k.place) < (best ? distance(best.place) : NEAR_ENTER) ? k : best),
    null,
  );
  if (!nearest) return;
  site.nearbyPlace = nearest.place;
  site.atPlace = nearest.place;
  if (site.current !== nearest.place) {
    site.current = nearest.place;
    setContent(site.current, { popup: true });
    window.history.replaceState(null, '', '#' + site.current);
    clearTimeout(site.replyTimer);
    $('#keeper-reply').hidden = true;
    clearTimeout(site.toastTimer);
    $('#travel-toast').classList.remove('show');
    $('#travel-toast').textContent = `${nearest.section} opened.`;
  }
  $('#location-state').textContent = 'You are here';
  $('#world').classList.remove('traveling');
  updateKeeperStates();
  reactToArrival(nearest.place);
}
