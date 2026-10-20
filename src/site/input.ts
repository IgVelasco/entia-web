import { load } from './assets.ts';
import { camera, resize } from './camera.ts';
import { closeZoneInfo } from './content.ts';
import { $, canvas, compactMode, heading, motionOff, site } from './context.ts';
import { dismissFrontier, frontierBlocked, skipFrontierWalk, tryFrontier } from './escort.ts';
import { requestDraw, setMotionState } from './loop.ts';
import {
  beginManualMovement,
  checkWalkingProgress,
  clearMovementInput,
  heldDirections,
  isWalkable,
  moveHero,
  movementKeys,
  startKeyboardStep,
  walkingPath,
} from './movement.ts';
import { walkToPortal } from './portal.ts';
import { go } from './routing.ts';
import { apocalipsis } from './spell.ts';
import { hero, homePortal, keepers, spots } from './town.ts';

export function castPointer(x: number, y: number) {
  resetJoystick();
  heldDirections.clear();
  site.route = null;
  site.spell = { x, y, age: 0, delay: 0, duration: apocalipsis.duration, hit: false };
  hero.dir = heading(x - hero.x, y - hero.y);
  setAim(false);
  requestDraw();
}
export function bindWorldGestureGuards() {
  // World sprites are game controls, not selectable page content. Keep normal
  // browser selection and context menus available everywhere outside this surface.
  for (const surface of [canvas, $('#locations'), $('#player-label'), $('#keeper-reply')]) {
    for (const type of ['selectstart', 'dragstart', 'contextmenu']) {
      surface.addEventListener(type, (event) => event.preventDefault());
    }
  }
}
export function resetJoystick() {
  const pointer = site.joystickPointer;
  site.joystickPointer = null;
  site.joystickDirection = null;
  heldDirections.delete('joystick');
  if (site.route?.joystick) site.route = null;
  const pad = $('#joystick-pad');
  pad.style.setProperty('--stick-x', '0px');
  pad.style.setProperty('--stick-y', '0px');
  pad.classList.remove('active');
  if (pointer !== null && pad.hasPointerCapture?.(pointer)) pad.releasePointerCapture(pointer);
}
function joystickBlocked() {
  return (
    !compactMode() || !site.ready || document.hidden || site.paused || site.frontierState.open || frontierBlocked()
  );
}
function updateJoystick(event: PointerEvent) {
  if (event.pointerId !== site.joystickPointer) return;
  if (joystickBlocked()) {
    resetJoystick();
    requestDraw();
    return;
  }
  event.preventDefault();
  const pad = $('#joystick-pad'),
    rect = pad.getBoundingClientRect(),
    dx = event.clientX - rect.left - rect.width / 2,
    dy = event.clientY - rect.top - rect.height / 2,
    length = Math.hypot(dx, dy),
    radius = 36;
  const ratio = length > radius ? radius / length : 1;
  pad.style.setProperty('--stick-x', dx * ratio + 'px');
  pad.style.setProperty('--stick-y', dy * ratio + 'px');
  const direction = length < 12 ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
  site.joystickDirection = direction;
  if (direction === null) {
    heldDirections.delete('joystick');
    if (site.route?.joystick) site.route = null;
  } else {
    heldDirections.set('joystick', direction);
    startKeyboardStep(direction);
  }
  requestDraw();
}
function startJoystick(event: PointerEvent) {
  if (site.joystickPointer !== null || joystickBlocked() || event.button > 0) return;
  event.preventDefault();
  event.stopPropagation?.();
  beginManualMovement({ focus: false });
  site.joystickPointer = event.pointerId;
  site.mobileExploring = true;
  const pad = $('#joystick-pad');
  pad.setPointerCapture?.(event.pointerId);
  pad.classList.add('active');
  updateJoystick(event);
}
function stopJoystick(event: PointerEvent) {
  if (event.pointerId !== site.joystickPointer) return;
  event.preventDefault?.();
  resetJoystick();
  requestDraw();
}
export function setAim(value: boolean, { focus = false } = {}) {
  if (value) clearMovementInput();
  site.aiming = value;
  $('#world').classList.toggle('aiming', value);
  $('#spell').setAttribute('aria-pressed', String(value));
  $('#spell-hint').textContent = value ? 'Aim with the pointer and click' : 'Aim a spell';
  if (focus && value) canvas.focus({ preventScroll: true });
  requestDraw();
}
export function bindPointer() {
  canvas.addEventListener('pointermove', () => {
    canvas.style.cursor = site.aiming ? 'crosshair' : 'pointer';
  });
  canvas.addEventListener('click', (event) => {
    if (!site.ready || site.enteringPortal || site.frontierState.open) return;
    const bounds = canvas.getBoundingClientRect(),
      x = (event.clientX - bounds.left - site.ox) / site.scale,
      y = (event.clientY - bounds.top - site.oy) / site.scale;
    if (site.aiming) {
      castPointer(x, y);
      return;
    }
    if (Math.abs(x - homePortal.x) < 85 && y > homePortal.y - 238 && y < homePortal.y + 25) {
      walkToPortal();
      return;
    }
    const keeper = keepers.find((k) => Math.hypot(k.x - x, k.y - 25 - y) < 46);
    if (keeper) {
      go(keeper.place, { cast: true });
      return;
    }

    if (!isWalkable(x, y) && tryFrontier(hero, { x, y }, 'attempt')) return;
    if (isWalkable(x, y)) {
      resetJoystick();
      heldDirections.clear();
      beginManualMovement();
      moveHero(walkingPath({ x, y }), { explore: true, complete: checkWalkingProgress });
    }
  });
}
export function bindJoystick() {
  for (const type of ['touchstart', 'touchmove'])
    $('#joystick-pad').addEventListener(
      type,
      (event) => {
        if (event.cancelable) event.preventDefault();
      },
      { passive: false },
    );
  $('#joystick-pad').addEventListener('pointerdown', startJoystick);
  $('#joystick-pad').addEventListener('pointermove', updateJoystick);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
    $('#joystick-pad').addEventListener(type, stopJoystick);
  $('#joystick-pad').addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
}
export function bindControls() {
  $('#mobile-about').onclick = () => $('#about').onclick();
  $('#frontier-resume').onclick = () => {
    site.paused = false;
    setMotionState();
  };
  $('#frontier-download').onclick = skipFrontierWalk;
  $('#frontier-stay').onclick = () => dismissFrontier();
  $('#close-panel').onclick = () => {
    if ($('#zone-dialog').open) {
      closeZoneInfo();
      return;
    }
    go('home');
    $('.nav[data-place="home"]').focus({ preventScroll: true });
  };
  $('#spell').onclick = () => setAim(!site.aiming);
  $('#motion').onclick = () => {
    site.paused = !site.paused;
    setMotionState();
  };
  $('#zoom-in').onclick = () => {
    site.zoom = Math.min(1.18, site.zoom + 0.06);
    resize();
  };
  $('#zoom-out').onclick = () => {
    site.zoom = Math.max(0.88, site.zoom - 0.06);
    resize();
  };
  $('#reset-view').onclick = () => {
    site.mobileExploring = false;
    site.mobilePanX = site.mobilePanY = 0;
    site.zoom = 1;
    camera.x = camera.targetX;
    camera.y = camera.targetY;
    resize();
  };
  $('#about').onclick = () => {
    if (site.frontierState.open) dismissFrontier({ focus: false });
    clearMovementInput();
    $('#notes').showModal();
  };
  $('#close-notes').onclick = () => $('#notes').close();
  $('#retry-load').onclick = load;
}
export function bindKeyboard() {
  document.addEventListener('keydown', (event) => {
    if (site.enteringPortal || site.demoOpen) return;
    if (site.frontierState.open) {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissFrontier();
      } else if (event.key.startsWith('Arrow') || event.key === ' ') event.preventDefault();
      return;
    }
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      (event.target as Element).closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])') ||
      $('#notes').open ||
      $('#character-dialog').open ||
      $('#zone-dialog').open ||
      site.frontierState.open
    )
      return;
    const movementKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (Object.hasOwn(movementKeys, movementKey)) {
      if (!site.ready) return;
      event.preventDefault();
      if (event.repeat) return;
      beginManualMovement();
      if (motionOff()) {
        startKeyboardStep(movementKeys[movementKey]);
      } else {
        heldDirections.set(movementKey, movementKeys[movementKey]);
        startKeyboardStep();
        requestDraw();
      }
      return;
    }
    if (event.key === 'Escape') {
      if (site.aiming) {
        setAim(false);
        $('#spell').focus({ preventScroll: true });
      } else if (site.current !== 'home') {
        go('home');
        $('.nav[data-place="home"]').focus({ preventScroll: true });
      }
      return;
    }
    if (event.key.toLowerCase() === 'c') {
      event.preventDefault();
      setAim(!site.aiming, { focus: true });
      return;
    }
    const key = Number(event.key);
    if (key >= 1 && key <= 4) {
      event.preventDefault();
      go(Object.keys(spots)[key - 1]);
    }
  });
  document.addEventListener('keyup', (event) => {
    heldDirections.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
}
export function bindInputRelease() {
  document.addEventListener('focusin', (event) => {
    if (
      (event.target as Element).closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog')
    )
      clearMovementInput();
  });
  window.addEventListener('blur', clearMovementInput);
  window.addEventListener('pointerup', stopJoystick);
  window.addEventListener('pointercancel', stopJoystick);
  window.addEventListener('pagehide', () => {
    clearMovementInput();
    if (site.frameRequest) cancelAnimationFrame(site.frameRequest);
    site.frameRequest = 0;
  });
}
export function bindPageGestureGuards() {
  for (const surface of document.querySelectorAll(
    'header,.world-meta,.world-toolbar,#locations,#player-label,#keeper-reply,button',
  ))
    for (const type of ['selectstart', 'dragstart', 'contextmenu'])
      surface.addEventListener(type, (event) => event.preventDefault());
}
