import { $, canvas, demo } from './context.ts';
import M from './rules/navigation.ts';
import { combatLessons } from './rules/combat-lessons.ts';
import { keyLabel, macroLabels } from './rules/macros.ts';
import { coachFocus } from './rules/coach-focus.ts';
import { clear } from './input.ts';
import { focusGame, ui } from './hud.ts';
import { schedule } from './loop.ts';

interface FocusRect {
  left: number;
  top: number;
  width: number;
  height: number;
}
function spotlight(name: string, rect: FocusRect) {
  const visible = rect.width > 0 && rect.height > 0;
  for (const kind of ['hole', 'outline']) {
    const node = $(`#combat-${name}-${kind}`);
    node.setAttribute('visibility', visible ? 'visible' : 'hidden');
    for (const [attribute, value] of Object.entries({
      x: rect.left - 5,
      y: rect.top - 5,
      width: rect.width + 10,
      height: rect.height + 10,
    }))
      node.setAttribute(attribute, String(value));
  }
}

export function syncCombatCoach() {
  const coach = demo.state.tutorial?.coach;
  for (const id of ['#setup-experienced', '#help-experienced']) {
    $(id).textContent =
      coach?.enabled === false ? 'Volver a mostrar las explicaciones de combate' : 'Ya he jugado Argentums previamente';
    $(id).setAttribute('aria-pressed', String(coach?.enabled === false));
  }
  const dialog = $('#combat-lesson');
  const shown =
    coach?.current &&
    !coach.revealRemaining &&
    !demo.paused &&
    !demo.hostSuspended &&
    !$('#bindings-dialog').open &&
    !$('#character-dialog').open;
  if (!shown) {
    $('#combat-guidance').hidden = true;
    delete document.body.dataset.combatLesson;
    $('header').inert = false;
    $('main').inert = false;
    if (dialog.open) dialog.close();
    return;
  }
  const lesson = combatLessons[coach.current!];
  const focus = coachFocus(demo.state, coach.current!);
  document.body.dataset.combatLesson = coach.current!;
  $('#combat-guidance').hidden = false;
  $('header').inert = true;
  $('main').inert = true;
  $('#combat-title').textContent = lesson.title;
  $('#combat-description').textContent = lesson.text;
  $('#combat-response').textContent = lesson.response;
  $('#combat-condition').textContent = focus.condition;
  $('#combat-facts').textContent =
    `Vida: ${Math.ceil(demo.state.player.hp)} / 100 · Maná: ${Math.floor(demo.state.player.mana)} / 100`;
  $('#combat-controls').textContent =
    `Resaltado: ${macroLabels[focus.action]} · ${keyLabel(demo.macroBindings[focus.action])}`;
  if (!dialog.open) {
    clear();
    dialog.show();
    $('#combat-continue').focus();
  }
  // Same camera transform and 60x100 sprite footprint as render.actor().
  const bounds = canvas.getBoundingClientRect();
  const actor = {
    left: bounds.left + demo.ox + (focus.actor.x - 35) * demo.scale,
    top: bounds.top + demo.oy + (focus.actor.y - 108) * demo.scale,
    width: 70 * demo.scale,
    height: 145 * demo.scale,
  };
  spotlight('actor', actor);
  $('#combat-actor-label').textContent = focus.label;
  $('#combat-actor-label').setAttribute('x', String(actor.left + actor.width / 2));
  $('#combat-actor-label').setAttribute('y', String(Math.max(20, actor.top - 12)));
  const id = focus.action === 'apocalipsis' ? 'spell' : focus.action;
  const action = $('#macro-' + id).getBoundingClientRect();
  spotlight('action', action);
  $('#combat-action-label').textContent = macroLabels[focus.action];
  $('#combat-action-label').setAttribute('x', String(action.left + action.width / 2));
  $('#combat-action-label').setAttribute('y', String(Math.max(20, action.top - 12)));
  const resource = $(focus.resource === 'mana' ? '.mana-track' : '.health-track').getBoundingClientRect();
  const viewportWidth = window.innerWidth || demo.width;
  const viewportHeight = window.innerHeight || demo.height;
  const resourceVisible =
    resource.width > 0 &&
    resource.left < viewportWidth &&
    resource.left + resource.width > 0 &&
    resource.top < viewportHeight &&
    resource.top + resource.height > 0;
  spotlight('resource', resourceVisible ? resource : $('#mobile-vitals').getBoundingClientRect());
  const card = dialog.getBoundingClientRect();
  const overlapsLeft =
    actor.left < 18 + card.width &&
    actor.left + actor.width > 18 &&
    actor.top < card.bottom &&
    actor.top + actor.height > card.top;
  dialog.dataset.side = (window.innerWidth || demo.width) > 760 && overlapsLeft ? 'right' : 'left';
}
export function handleCombatCoachKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    M.dismissCombatLesson(demo.state);
    resume();
  } else if (event.key === 'Tab') {
    event.preventDefault();
    const buttons = [$('#combat-continue'), $('#combat-skip')];
    const current = buttons.indexOf(document.activeElement as HTMLElement);
    buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
  }
}
function resume() {
  clear();
  ui();
  demo.previous = performance.now();
  focusGame();
  schedule();
}
export function bindCombatCoach() {
  $('#combat-continue').onclick = () => {
    M.dismissCombatLesson(demo.state);
    resume();
  };
  const skip = () => {
    M.skipCombatLessons(demo.state);
    resume();
  };
  $('#combat-skip').onclick = skip;
  for (const id of ['#setup-experienced', '#help-experienced'])
    $(id).onclick = () => {
      if (demo.state.tutorial?.coach?.enabled === false) M.enableCombatLessons(demo.state);
      else M.skipCombatLessons(demo.state);
      // Keep the workshop or pause open while changing this preference.
      ui();
      schedule();
    };
  $('#combat-lesson').addEventListener('cancel', (event) => {
    event.preventDefault();
    M.dismissCombatLesson(demo.state);
    resume();
  });
}
