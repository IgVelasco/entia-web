import { $, demo } from './context.ts';
import M from './rules/navigation.ts';
import { clear } from './input.ts';
import { focusGame, setHudDrawer } from './hud.ts';
import { schedule } from './loop.ts';
import { saveBindings } from './binding-storage.ts';
import { saveClickMovement } from './control-preferences.ts';
import {
  assignMacro,
  bindingConflict,
  exampleBindings,
  keyLabel,
  macroActions,
  macroLabels,
  type BindingAction,
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
    text: 'Un macro es un acceso rápido. Elegí Asignar y presioná tu tecla. El de hechizo lo prepara para apuntar; el de poción la usa al soltar o la repite al mantenerla con Auto-pot. Abrí Teclas y macros para ver todas las acciones. Si una tecla está ocupada, podés reasignarla aquí.',
  },
  {
    focus: 'ready',
    title: '4. Tus controles están listos',
    text: 'Para jugar desde las ventanas: seleccioná un hechizo → Lanzar → clic en el casillero; para pociones: seleccioná una → Usar o doble clic. WASD o flechas mueven. Podés reabrir Teclas y macros en cualquier momento. La pelea espera hasta que aprietes Entrar en la arena.',
  },
];
let active = false;
let step = 0;
let capturing: BindingAction | null = null;
let error = '';
let conflict: { action: BindingAction; key: string; other: BindingAction } | null = null;

function persistBindings() {
  if (!saveBindings(demo.macroBindings))
    error = 'El navegador no permite guardar las teclas. Se conservarán durante esta sesión.';
}

function syncBindings() {
  for (const prefix of ['setup', 'bindings']) {
    $(`#${prefix}-click-yes`).setAttribute('aria-pressed', String(demo.clickMovement));
    $(`#${prefix}-click-no`).setAttribute('aria-pressed', String(!demo.clickMovement));
  }
  const message = error || (capturing ? `Presioná una tecla para ${macroLabels[capturing]}. Escape cancela.` : '');
  for (const id of ['#setup-error', '#bindings-error']) $(id).textContent = message;
  for (const id of ['#setup-reassign', '#bindings-reassign']) {
    $(id).hidden = !conflict;
    $(id).textContent = conflict
      ? `Usar ${keyLabel(conflict.key)} para ${macroLabels[conflict.action]} y dejar ${macroLabels[conflict.other]} sin tecla`
      : '';
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-bind]')) {
    const action = button.dataset.bind as BindingAction;
    button.textContent =
      capturing === action
        ? 'Presioná una tecla…'
        : demo.macroBindings[action]
          ? keyLabel(demo.macroBindings[action])
          : 'Asignar';
    button.setAttribute('aria-pressed', String(capturing === action));
  }
}
export function openBindings() {
  if (!demo.ready) return;
  clear();
  capturing = null;
  conflict = null;
  error = '';
  syncBindings();
  if (!$('#bindings-dialog').open) $('#bindings-dialog').showModal();
}
function closeBindings() {
  capturing = null;
  conflict = null;
  error = '';
  $('#bindings-dialog').close();
  clear();
  demo.previous = performance.now();
  focusGame();
  schedule();
}

export function syncSetup() {
  syncBindings();
  const shown = demo.state.tutorial?.stage === 'setup' && !demo.hostSuspended;
  $('#controls-lesson').hidden = !shown || demo.paused;
  if (!shown || demo.paused) {
    delete document.body.dataset.controlsLesson;
    for (const selector of ['.spells-window', '.inventory-window', '.macrobar'])
      $(selector).classList.toggle('lesson-target', false);
    if (!shown) {
      active = false;
      if (!$('#bindings-dialog').open) {
        capturing = null;
        conflict = null;
      }
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
  $('#setup-movement-choice').hidden = step !== 3;
  const assigned = macroActions.filter((action) => demo.macroBindings[action]);
  $('#setup-summary').textContent = assigned.length
    ? assigned.map((action) => `${macroLabels[action]}: ${keyLabel(demo.macroBindings[action])}`).join(' · ')
    : 'Elegiste jugar desde las ventanas. No hay teclas de macro asignadas.';
  $('#setup-movement-status').textContent = demo.clickMovement
    ? 'Activado: clic o toque en el suelo para caminar. WASD, flechas y joystick también funcionan.'
    : 'Desactivado: caminás con WASD, flechas o joystick. El clic sigue sirviendo para lanzar e interactuar.';
  $('#setup-back').disabled = step === 0;
  $('#setup-next').hidden = step === 3;
  $('#setup-start').hidden = step !== 3;
  $('#setup-start').disabled = capturing !== null;
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
  conflict = null;
  error = '';
  syncSetup();
  $('.lesson-content').scrollTop = 0;
  (step === 3 ? $('#setup-start') : $('#setup-next')).focus();
}
export function handleSetupKey(event: KeyboardEvent, editor = false) {
  if (event.key === 'Tab') {
    capturing = null;
    conflict = null;
    error = '';
    const root = editor ? '#bindings-dialog' : '#controls-lesson';
    const buttons = [...document.querySelectorAll<HTMLButtonElement>(`${root} button`)].filter(
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
    if (event.key === 'Escape' && !editor) event.preventDefault();
    return;
  }
  event.preventDefault();
  if (event.repeat) return;
  conflict = null;
  if (event.key === 'Escape') {
    capturing = null;
    conflict = null;
    error = '';
  } else if (event.ctrlKey || event.metaKey || event.altKey) error = 'Usá una tecla sin Ctrl, Alt ni Meta.';
  else {
    error = assignMacro(demo.macroBindings, capturing, event.key);
    const other = bindingConflict(demo.macroBindings, capturing, event.key);
    conflict = error && other ? { action: capturing, key: event.key.toLowerCase(), other } : null;
    if (!error) {
      capturing = null;
      persistBindings();
    }
  }
  syncSetup();
}
export function bindSetup() {
  for (const prefix of ['setup', 'bindings'])
    for (const [suffix, enabled] of [
      ['yes', true],
      ['no', false],
    ] as const)
      $(`#${prefix}-click-${suffix}`).onclick = () => {
        clear();
        demo.clickMovement = enabled;
        error = saveClickMovement(enabled)
          ? ''
          : 'El navegador no permite guardar esta opción. Se aplicará durante esta sesión.';
        syncSetup();
        schedule();
      };
  for (const selector of ['#controls-options', '#setup-all-bindings', '#help-bindings'])
    $(selector).onclick = openBindings;
  $('#bindings-close').onclick = closeBindings;
  $('#bindings-dialog').addEventListener('cancel', (event) => {
    event.preventDefault();
    closeBindings();
  });
  for (const id of ['#setup-reassign', '#bindings-reassign'])
    $(id).onclick = () => {
      if (!conflict) return;
      const next = { ...demo.macroBindings, [conflict.other]: '' };
      error = assignMacro(next, conflict.action, conflict.key);
      if (!error) {
        demo.macroBindings = next;
        persistBindings();
      }
      capturing = null;
      conflict = null;
      syncSetup();
    };
  $('#setup-next').onclick = () => changeStep(Math.min(3, step + 1));
  $('#setup-back').onclick = () => changeStep(Math.max(0, step - 1));
  $('#setup-windows').onclick = () => {
    for (const action of macroActions) demo.macroBindings[action] = '';
    changeStep(3);
    persistBindings();
    syncSetup();
  };
  $('#setup-example').onclick = () => {
    const example = exampleBindings();
    const next = { ...demo.macroBindings };
    for (const action of macroActions) next[action] = '';
    for (const action of macroActions) {
      error = assignMacro(next, action, example[action]);
      if (error) break;
    }
    if (!error) {
      demo.macroBindings = next;
      persistBindings();
    }
    capturing = null;
    syncSetup();
  };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-bind]'))
    button.onclick = () => {
      capturing = button.dataset.bind as BindingAction;
      conflict = null;
      error = '';
      syncSetup();
    };
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-clear-macro]'))
    button.onclick = () => {
      demo.macroBindings[button.dataset.clearMacro as BindingAction] = '';
      capturing = null;
      conflict = null;
      error = '';
      persistBindings();
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
