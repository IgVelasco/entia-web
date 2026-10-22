import { $, demo } from './context.ts';
import M from './rules/navigation.ts';
import { combatLessons } from './rules/combat-lessons.ts';
import { keyLabel } from './rules/macros.ts';
import { clear } from './input.ts';
import { focusGame, ui } from './hud.ts';
import { schedule } from './loop.ts';

export function syncCombatCoach() {
  const coach = demo.state.tutorial?.coach;
  for (const id of ['#setup-experienced', '#help-experienced']) {
    $(id).textContent =
      coach?.enabled === false ? 'Explicaciones de combate desactivadas' : 'Ya he jugado Argentums previamente';
    $(id).setAttribute('aria-disabled', String(coach?.enabled === false));
  }
  const dialog = $('#combat-lesson');
  const shown =
    coach?.current &&
    !demo.paused &&
    !demo.hostSuspended &&
    !$('#bindings-dialog').open &&
    !$('#character-dialog').open;
  if (!shown) {
    if (dialog.open) dialog.close();
    return;
  }
  const lesson = combatLessons[coach.current!];
  $('#combat-title').textContent = lesson.title;
  $('#combat-description').textContent = lesson.text;
  $('#combat-response').textContent = lesson.response;
  $('#combat-facts').textContent =
    `Vida: ${Math.ceil(demo.state.player.hp)} / 100 · Maná: ${Math.floor(demo.state.player.mana)} / 100`;
  $('#combat-controls').textContent =
    `Remover: ${keyLabel(demo.macroBindings.remover)} · Poción de maná: ${keyLabel(demo.macroBindings.mana)}. También podés usar las ventanas.`;
  if (!dialog.open) {
    clear();
    dialog.showModal();
    $('#combat-continue').focus();
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
  for (const id of ['#combat-skip', '#setup-experienced', '#help-experienced']) $(id).onclick = skip;
  $('#combat-lesson').addEventListener('cancel', (event) => {
    event.preventDefault();
    M.dismissCombatLesson(demo.state);
    resume();
  });
}
