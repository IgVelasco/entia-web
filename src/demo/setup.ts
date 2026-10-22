import { $, demo } from './context.ts';
import M from './rules/navigation.ts';
import { clear } from './input.ts';
import { focusGame, setHudDrawer } from './hud.ts';
import { schedule } from './loop.ts';
import {
  assignMacro,
  emptyBindings,
  exampleBindings,
  keyLabel,
  macroActions,
  macroLabels,
  type MacroAction,
} from './rules/macros.ts';

const lessons = [
  {
    focus: 'spells',
    title: '1. Elegí un hechizo',
    text: 'Esta es tu ventana de hechizos. Seleccioná Apocalipsis, Inmovilizar o Remover parálisis y apretá Lanzar. Después apuntá libremente y hacé clic en el casillero del objetivo. El cursor no se pega a ningún personaje.',
  },
  {
    focus: 'inventory',
    title: '2. Aprendé a usar las pociones',
    text: 'En el inventario están las pociones de vida y maná. Seleccioná una y apretá Usar, U o hacé doble clic. La vida recupera salud y el maná permite seguir lanzando. Durante esta preparación no gastás pociones.',
  },
  {
    focus: 'macros',
    title: '3. Creá tus macros (opcional)',
    text: 'Un macro es un acceso rápido a una acción. Elegí Asignar, luego presioná la tecla que quieras. Un macro de hechizo lo deja listo para apuntar; uno de poción la usa al soltar o la repite mientras lo mantenés si Auto-pot está activo. Cada tecla puede tener una sola acción.',
  },
  {
    focus: 'ready',
    title: '4. Tus controles están listos',
    text: 'Para jugar desde las ventanas: seleccioná un hechizo → Lanzar → clic en el casillero; para pociones: seleccioná una → Usar o doble clic. WASD o flechas mueven; E recoge esencia; Espacio golpea. La pelea sigue detenida hasta que aprietes Entrar en la arena.',
  },
];
let active = false;
let step = 0;
let capturing: MacroAction | null = null;
let error = '';

export function syncSetup() {
  const shown = demo.state.tutorial?.stage === 'setup' && !demo.hostSuspended;
  $('#controls-lesson').hidden = !shown || demo.paused;
  if (!shown || demo.paused) {
    delete document.body.dataset.controlsLesson;
    for (const selector of ['.spells-window', '.inventory-window', '.macrobar'])
      $(selector).classList.toggle('lesson-target', false);
    if (!shown) {
      active = false;
      capturing = null;
    }
    return;
  }
  if (!active) {
    active = true;
    step = 0;
    capturing = null;
    error = '';
    clear();
    setHudDrawer(false);
    $('#setup-next').focus();
  }
  const lesson = lessons[step];
  document.body.dataset.controlsLesson = lesson.focus;
  $('#setup-title').textContent = lesson.title;
  $('#setup-description').textContent = lesson.text;
  $('#setup-progress').textContent = `Preparación segura · ${step + 1} de ${lessons.length}`;
  $('#setup-bindings').hidden = step !== 2;
  $('#setup-summary').hidden = step !== 3;
  const assigned = macroActions.filter((action) => demo.macroBindings[action]);
  $('#setup-summary').textContent = assigned.length
    ? assigned.map((action) => `${macroLabels[action]}: ${keyLabel(demo.macroBindings[action])}`).join(' · ')
    : 'Elegiste jugar desde las ventanas. No hay teclas de macro asignadas.';
  $('#setup-error').textContent =
    error || (capturing ? `Presioná una tecla para ${macroLabels[capturing]}. Escape cancela.` : '');
  $('#setup-back').disabled = step === 0;
  $('#setup-next').hidden = step === 3;
  $('#setup-start').hidden = step !== 3;
  $('#setup-start').disabled = capturing !== null;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-bind]')) {
    const action = button.dataset.bind as MacroAction;
    button.textContent =
      capturing === action
        ? 'Presioná una tecla…'
        : demo.macroBindings[action]
          ? keyLabel(demo.macroBindings[action])
          : 'Asignar';
    button.setAttribute('aria-pressed', String(capturing === action));
  }
  for (const [selector, focus] of [
    ['.spells-window', 'spells'],
    ['.inventory-window', 'inventory'],
    ['.macrobar', 'macros'],
  ])
    $(selector).classList.toggle('lesson-target', lesson.focus === focus);
}
function changeStep(next: number) {
  step = next;
  capturing = null;
  error = '';
  syncSetup();
  $('.lesson-content').scrollTop = 0;
  (step === 3 ? $('#setup-start') : $('#setup-next')).focus();
}
export function handleSetupKey(event: KeyboardEvent) {
  if (event.key === 'Tab') {
    capturing = null;
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('#controls-lesson button')].filter(
      (button) => !button.disabled && button.getClientRects().length,
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (buttons.length) {
      event.preventDefault();
      buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
    syncSetup();
    return;
  }
  if (!capturing) {
    if (event.key === 'Escape') event.preventDefault();
    return;
  }
  event.preventDefault();
  if (event.repeat) return;
  if (event.key === 'Escape') {
    capturing = null;
    error = '';
  } else if (event.ctrlKey || event.metaKey || event.altKey) error = 'Usá una tecla sin Ctrl, Alt ni Meta.';
  else {
    error = assignMacro(demo.macroBindings, capturing, event.key);
    if (!error) capturing = null;
  }
  syncSetup();
}
export function bindSetup() {
  $('#setup-next').onclick = () => changeStep(Math.min(3, step + 1));
  $('#setup-back').onclick = () => changeStep(Math.max(0, step - 1));
  $('#setup-windows').onclick = () => {
    demo.macroBindings = emptyBindings();
    changeStep(3);
  };
  $('#setup-example').onclick = () => {
    demo.macroBindings = exampleBindings();
    capturing = null;
    error = '';
    syncSetup();
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-bind]'))
    button.onclick = () => {
      capturing = button.dataset.bind as MacroAction;
      error = '';
      syncSetup();
    };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-clear-macro]'))
    button.onclick = () => {
      demo.macroBindings[button.dataset.clearMacro as MacroAction] = '';
      capturing = null;
      error = '';
      syncSetup();
    };
  $('#setup-start').onclick = () => {
    if (step !== 3 || capturing || !M.startFight(demo.state)) return;
    clear();
    syncSetup();
    demo.previous = performance.now();
    focusGame();
    schedule();
  };
}
