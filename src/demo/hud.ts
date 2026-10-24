import M from './rules/navigation.ts';
import { load } from './assets.ts';
import { $, canvas, demo, needsMovementChoice } from './context.ts';
import { returnToNix } from './embed.ts';
import { bindTap, clear, interact, prepareSpell } from './input.ts';
import { schedule } from './loop.ts';
import { animateGuide, motion, resetMotion } from './motion.ts';
import type { TutorialState } from './rules/state.ts';
import { syncSetup } from './setup.ts';
import { syncCombatCoach } from './combat-coach.ts';
import { macroActions, macroLabels, keyLabel } from './rules/macros.ts';

export function ui() {
  syncGuide();
  syncSetup();
  syncCombatCoach();
  // Counts are written as numbers; the DOM stringifies them.
  const p = demo.state.player;
  $('#health-fill').style.width = p.hp + '%';
  $('#health').textContent = Math.ceil(p.hp) + ' / 100';
  $('#mana-fill').style.width = p.mana + '%';
  $('#mana').textContent = Math.floor(p.mana) + ' / 100';
  $('#mobile-vitals').textContent = 'Life ' + Math.ceil(p.hp) + ' · Mana ' + Math.floor(p.mana);
  $('#movement-status').textContent =
    p.immobilized > 0
      ? `Inmovilizado · ${Math.ceil(p.immobilized)} s · Usá Remover parálisis o esperá.`
      : demo.state.movementBlock;
  $('#movement-status').hidden = !p.immobilized && !demo.state.movementBlock;
  $('#carried').textContent = String(demo.state.carried);
  $('#autopot').checked = demo.state.autopotEnabled;
  const unlimited = !!demo.state.tutorial;
  $('#life-stock').textContent = unlimited ? '∞' : String(demo.state.lifePotions);
  $('#mana-stock').textContent = unlimited ? '∞' : String(demo.state.manaPotions);
  $('#life-inventory-count').textContent = unlimited ? '∞' : String(demo.state.lifePotions);
  $('#mana-inventory-count').textContent = unlimited ? '∞' : String(demo.state.manaPotions);
  $('#life-potion').disabled = !unlimited && !demo.state.lifePotions;
  $('#mana-potion').disabled = !unlimited && !demo.state.manaPotions;
  $('#macro-life').disabled = !unlimited && !demo.state.lifePotions;
  $('#macro-mana').disabled = !unlimited && !demo.state.manaPotions;
  $('#health-fill').classList.toggle('potion-used', demo.state.lifePulse > 0);
  $('#mana-fill').classList.toggle('potion-used', demo.state.manaPulse > 0);
  $('#secured').textContent = String(demo.state.secured);
  $('#secured-fill').style.width = Math.min(100, (demo.state.secured / 60) * 100) + '%';
  $('#chapter').textContent = 'THE VEIL / TRAINING GROUNDS';
  $('#objective-label').textContent = demo.state.won ? 'THE LOOP IS YOURS' : 'SECURE 60 ESSENCE';
  $('#objective').textContent = demo.state.won
    ? 'Goal complete'
    : demo.state.carried
      ? 'Return with your essence'
      : demo.state.drops.length
        ? 'Pick up the crystal'
        : 'The Veil';
  $('#hint').textContent = demo.state.carried
    ? 'Stay near the bank to secure your essence. Fall and you drop what you carry.'
    : demo.state.drops.length
      ? 'Stand on a crystal and use Pick up or your interaction key. Your dropped essence can be recovered.'
      : `Prepare Apocalipsis, then point and click a rival. ${demo.state.secured} / 60 secured.`;
  const near = M.nearBank(demo.state),
    gate = M.nearGate(demo.state),
    item = demo.state.drops.some((d) => M.canPickup(demo.state, d));
  $('.interact-area').hidden = !(near || gate || item || demo.state.bank);
  $('#interact').disabled = demo.paused || (near && !item);
  $('#deposit-status').textContent = !demo.state.bankUnlocked
    ? 'Bank locked · pick up your first crystal'
    : near && demo.state.carried
      ? demo.state.bank >= 1
        ? 'Depositing essence…'
        : 'Stay near the bank to deposit'
      : demo.state.carried
        ? 'Carrying ' + demo.state.carried + ' · bank south of the portal'
        : 'Bank unlocked · ' + demo.state.secured + ' essence secured';
  $('#interact').innerHTML = item
    ? `Pick up essence <kbd>${keyLabel(demo.macroBindings.interact)}</kbd>`
    : demo.state.bank >= 1
      ? 'Drawing in essence…'
      : demo.state.bank
        ? 'Stay nearby…'
        : near
          ? 'Essence bank · automatic transfer'
          : `Return to Nix <kbd>${keyLabel(demo.macroBindings.interact)}</kbd>`;
  $('#bank-progress').hidden = !demo.state.bank;
  $('#bank-progress span').style.width =
    (demo.state.bank < 1
      ? demo.state.bank * 100
      : Math.max(0, (1 - demo.state.carried / Math.max(1, demo.state.bankAmount)) * 100)) + '%';
  $('#cast').disabled = demo.paused;
  $('#meditate').setAttribute('aria-pressed', String(demo.state.meditating));
  $('#meditate').textContent =
    (demo.state.meditating ? 'Meditar: activo' : 'Meditar') + ' · ' + keyLabel(demo.macroBindings.meditate);
  $('#use-selected').textContent = 'Usar · ' + keyLabel(demo.macroBindings.use);
  $('#pause kbd').textContent = keyLabel(demo.macroBindings.pause);
  $('#prepare-spell').disabled = demo.paused;
  $('#prepare-spell').textContent = demo.state.armed ? 'Cancelar' : 'Lanzar';
  $('#cast').textContent = demo.state.armed ? 'Cancelar' : 'Lanzar';
  $('#prepare-spell').setAttribute('aria-pressed', String(demo.state.armed));
  $('#cast').setAttribute('aria-pressed', String(demo.state.armed));
  $('#target-help').dataset.armed = String(demo.state.armed);
  $('#target-help').textContent = demo.state.armed
    ? M.spells[demo.state.selectedSpell].name +
      ' ready · ' +
      (demo.state.selectedSpell === 'remover' ? 'click your own tile' : 'click a rival') +
      ' · Esc cancels'
    : (demo.clickMovement ? 'Clic, teclas o joystick para caminar' : 'Solo teclas o joystick para caminar') +
      ' · seleccioná un hechizo y apretá Lanzar';
  for (const action of macroActions) {
    const id = action === 'apocalipsis' ? 'spell' : action;
    $('#macro-' + id + ' kbd').textContent = demo.macroBindings[action] ? keyLabel(demo.macroBindings[action]) : '—';
    $('#macro-' + id).setAttribute(
      'aria-label',
      macroLabels[action] +
        (demo.macroBindings[action] ? ' · ' + keyLabel(demo.macroBindings[action]) : ' · sin tecla'),
    );
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-spell]'))
    button.textContent =
      M.spells[button.dataset.spell!].name +
      (demo.macroBindings[button.dataset.spell! as keyof typeof demo.macroBindings]
        ? ' · ' + keyLabel(demo.macroBindings[button.dataset.spell! as keyof typeof demo.macroBindings])
        : '');
  const recovery = Math.max(demo.state.cooldown, demo.state.hitToCast);
  $('#spell-status').textContent =
    recovery > 0
      ? 'Recovering · ' + recovery.toFixed(1) + 's' + (demo.state.armed ? ' · aim stays ready' : '')
      : demo.state.armed
        ? 'Ready: click your target'
        : M.spells[demo.state.selectedSpell].name + ' · ' + M.spells[demo.state.selectedSpell].mana + ' mana';
  $('#inventory-count').textContent = String(demo.state.carried);
  $('#essence-slot').disabled = demo.state.carried === 0;
  $('#item-description').textContent =
    demo.selectedInventory === 'essence'
      ? demo.state.carried + ' carried essence'
      : demo.selectedInventory === 'life'
        ? 'Life potion · restores 40'
        : 'Mana potion · restores 50';
  $('#use-selected').disabled = demo.selectedInventory === 'essence' || demo.paused;
  canvas.style.cursor = demo.state.armed ? 'crosshair' : 'default';
  $('#cast').style.opacity = recovery > 0 ? '.55' : '1';
  for (const id of ['#strike', '#mobile-strike']) {
    $(id).textContent = 'Golpear · ' + keyLabel(demo.macroBindings.strike);
    $(id).style.opacity = Math.max(demo.state.meleeCooldown, demo.state.castToHit) > 0 ? '.55' : '1';
  }

  tutorialUI();
  if (demo.state.noticeId !== demo.noticeId) {
    demo.noticeId = demo.state.noticeId;
    $('#message').textContent = demo.state.notice;
    demo.messageUntil = performance.now() + 5000;
  }
  $('#message').classList.toggle(
    'visible',
    demo.state.tutorial?.stage !== 'melee' && performance.now() < demo.messageUntil,
  );
}
export function showHelp(first = false) {
  if (!demo.ready) return;
  if ($('#guide-dialog').open) {
    $('#guide-dialog').close();
    demo.dialogKey = '';
  }
  setHudDrawer(false);
  clear();
  demo.paused = true;
  $('#help-title').textContent = first ? 'Welcome to the Veil' : 'Paused';
  $('#resume').textContent = first ? 'Enter the Veil' : 'Resume';
  $('#pause').setAttribute('aria-pressed', 'true');
  if (!$('#help-dialog').open) $('#help-dialog').showModal();
  schedule();
}
export function hideHelp() {
  if ($('#help-dialog').open) $('#help-dialog').close();
  demo.paused = false;
  $('#pause').setAttribute('aria-pressed', 'false');
  document.body.classList.add('portal-arrival');
  focusGame();
  demo.previous = performance.now();
  schedule();
}
export function togglePause(value = !demo.paused) {
  if (!demo.ready) return;
  if (value) showHelp();
  else hideHelp();
}
function selectInventory(kind: string) {
  demo.selectedInventory = kind;
  for (const [id, value] of [
    ['essence-slot', 'essence'],
    ['life-potion', 'life'],
    ['mana-potion', 'mana'],
  ]) {
    const selected = value === kind;
    $('#' + id).classList.toggle('selected', selected);
    $('#' + id).setAttribute('aria-pressed', String(selected));
  }
}
export function useSelected() {
  setHudDrawer(false);
  if (!demo.paused && demo.selectedInventory !== 'essence') M.usePotion(demo.state, demo.selectedInventory);
  focusGame();
}
export function bindActionButtons() {
  bindTap($('#cast'), prepareSpell);
  $('#prepare-spell').onclick = prepareSpell;
  $('#strike').onclick = () => {
    if (demo.ready && !demo.paused && demo.presentationNow >= demo.beatUntil) M.melee(demo.state);
    focusGame();
  };
  $('#meditate').onclick = () => {
    if (demo.ready && !demo.paused) {
      clear();
      M.meditate(demo.state);
    }
    focusGame();
  };
  bindTap($('#interact'), () => {
    if (demo.ready && !demo.paused) interact();
    focusGame();
  });
  $('#pause').onclick = () => togglePause();
  $('#resume').onclick = hideHelp;
  $('#restart').onclick = () => {
    if (!demo.ready) return;
    demo.state = M.createTutorial();
    resetMotion();
    demo.returning = false;
    demo.pointer = null;
    demo.noticeId = 0;
    demo.messageUntil = 0;
    selectSpell('apocalipsis');
    hideHelp();
  };
  $('#retry').onclick = load;
}
export function bindHud() {
  $('#practice-continue').onclick = () => {
    if (demo.paused || !M.startFight(demo.state)) return;
    clear();
    ui();
    demo.previous = performance.now();
    focusGame();
    schedule();
  };
  $('#hud-help').onclick = () => showHelp();
  $('#close-help').onclick = hideHelp;
  $('#help-dialog').addEventListener('cancel', (e) => {
    e.preventDefault();
    hideHelp();
  });
  $('#toggle-hud').onclick = () => setHudDrawer(!demo.hudDrawerOpen);
  $('#hud-scrim').onclick = () => setHudDrawer(false);
  $('#return-home').onclick = returnToNix;
  $('#essence-slot').onclick = () => selectInventory('essence');
  $('#life-potion').onclick = () => selectInventory('life');
  $('#mana-potion').onclick = () => selectInventory('mana');
  $('#life-potion').ondblclick = () => {
    selectInventory('life');
    useSelected();
  };
  $('#mana-potion').ondblclick = () => {
    selectInventory('mana');
    useSelected();
  };
  $('#use-selected').onclick = useSelected;
  $('#autopot').addEventListener('change', (e) => {
    demo.state.autopotEnabled = (e.target as HTMLInputElement).checked;
  });
  $('#selected-spell').onclick = () => focusGame();
  $('#selected-spell').ondblclick = prepareSpell;
  for (const action of ['apocalipsis', 'inmovilizar', 'remover']) {
    const id = action === 'apocalipsis' ? 'spell' : action;
    bindTap($('#macro-' + id) as HTMLButtonElement, () => {
      selectSpell(action);
      prepareSpell();
    });
  }
  for (const kind of ['life', 'mana']) {
    const button = $('#macro-' + kind),
      key = 'pointer-' + kind;
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (demo.paused || !demo.ready) return;
      focusGame();
      button.setPointerCapture(e.pointerId);
      M.pressPotion(demo.state, key, kind);
    });
    button.addEventListener('pointerup', (e) => {
      e.preventDefault();
      M.releasePotion(demo.state, key);
    });
    button.addEventListener('pointercancel', () => M.clearPotionKeys(demo.state));
    button.addEventListener('lostpointercapture', () => {
      demo.state.heldPotions = demo.state.heldPotions.filter((p) => p.key !== key);
    });
    button.addEventListener('click', (e) => {
      if (e.detail === 0 && !demo.paused) M.usePotion(demo.state, kind);
    });
  }
}
export function setHudDrawer(open: boolean) {
  if (open) clear();
  demo.hudDrawerOpen = open;
  $('#hud-scrim').hidden = !open;
  document.body.classList.toggle('hud-open', open);
  $('#toggle-hud').setAttribute('aria-expanded', String(open));
}
export function selectSpell(id: string) {
  if (!M.spells[id]) return;
  demo.state.selectedSpell = id;
  demo.state.armed = false;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-spell]'))
    button.setAttribute('aria-selected', String(button.dataset.spell === id));
  $('#mobile-spell').value = id;
  ui();
}
export function bindSpells() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-spell]')) {
    button.onclick = () => selectSpell(button.dataset.spell!);
    button.ondblclick = () => {
      selectSpell(button.dataset.spell!);
      prepareSpell();
    };
  }
  $('#mobile-spell').addEventListener('change', (e) => {
    selectSpell((e.target as HTMLSelectElement).value);
    prepareSpell();
  });
  bindTap($('#mobile-strike'), () => {
    if (demo.ready && !demo.paused && demo.presentationNow >= demo.beatUntil) M.melee(demo.state);
  });
}
export function focusGame() {
  if (
    needsMovementChoice() ||
    !demo.ready ||
    demo.paused ||
    demo.hostSuspended ||
    demo.returning ||
    document.hidden ||
    demo.hudDrawerOpen ||
    demo.state.tutorial?.dialog ||
    demo.state.tutorial?.stage === 'setup' ||
    !!demo.state.tutorial?.coach?.current ||
    $('#bindings-dialog').open ||
    $('#help-dialog').open ||
    $('#character-dialog').open
  )
    return;
  if (!matchMedia('(pointer: coarse)').matches) canvas.focus({ preventScroll: true });
}
export function syncGuide() {
  const t = demo.state.tutorial,
    d = $('#guide-dialog');
  if (!t?.dialog) {
    demo.dialogKey = '';
    if (d.open) d.close();
    return;
  }
  if (
    demo.guideHoldUntil > demo.presentationNow ||
    demo.paused ||
    demo.hostSuspended ||
    document.hidden ||
    $('#help-dialog').open ||
    $('#character-dialog').open
  )
    return;
  $('#guide-name').textContent = t.dialog.name;
  $('#guide-title').textContent = t.dialog.title;
  $('#guide-text').textContent = t.dialog.lines[t.page];
  $('#guide-step').textContent = t.page + 1 + ' / ' + t.dialog.lines.length;
  $('#guide-meter').style.width = ((t.page + 1) / t.dialog.lines.length) * 100 + '%';
  $('#guide-next').textContent =
    t.page === t.dialog.lines.length - 1 ? (t.dialog.id === 'final' ? 'Finish' : 'Understood') : 'Continue';
  if (!d.open) {
    clear();
    d.showModal();
  }
  const key = t.dialog.id + ':' + t.page;
  if (key !== demo.dialogKey) {
    demo.dialogKey = key;
    paintPortrait(t.dialog.id);
    animateGuide(t.page === 0);
  }
}
function tutorialUI() {
  const t = demo.state.tutorial;
  if (!t) return;
  const hall = demo.state.phase === 'hallway',
    setup = t.stage === 'setup',
    practice = t.stage === 'melee',
    done = t.stage === 'complete';
  $('#melee-practice').hidden = !practice;
  const hit = M.meleePracticeHit(demo.state);
  $('#practice-continue').disabled = !hit || demo.paused;
  $('#practice-status').textContent = hit
    ? '¡Golpe acertado! Ya podés seguir a la pelea.'
    : 'Pendiente: acertá un golpe al Entrenador. Un golpe al aire no cuenta.';
  $('#practice-instructions').textContent = demo.macroBindings.strike
    ? `Usá Golpear o tu tecla ${keyLabel(demo.macroBindings.strike)}. Esperá la recuperación entre intentos. El entrenador no ataca.`
    : 'Usá el botón Golpear, o asigná una tecla en Teclas y macros. El entrenador no ataca.';
  $('#strike').hidden = hall || setup || done;
  $('#chapter').textContent = hall
    ? 'THE VEIL / FIRST STEPS'
    : done
      ? 'THE VEIL / TUTORIAL FINISHED'
      : 'THE VEIL / ARENA';
  if (setup) $('#chapter').textContent = 'THE VEIL / PREPARACIÓN';
  $('#objective-label').textContent = hall
    ? 'MEET YOUR GUIDES'
    : done
      ? 'TUTORIAL FINISHED'
      : t.bankRevealed
        ? 'BANK YOUR ESSENCE'
        : 'FIGHT TWO RIVALS';
  $('#objective').textContent = hall
    ? t.seen.length + ' / 3 guides met'
    : done
      ? 'Your essence is secure'
      : t.bankRevealed
        ? 'The bank is nearby'
        : Math.min(2, demo.state.kills) + ' / 2 rivals defeated';
  $('#hint').textContent = hall
    ? (demo.clickMovement
        ? 'Clic en la alfombra, WASD, flechas o joystick para caminar.'
        : 'Usá WASD, flechas o joystick para caminar. El clic no te mueve.') + ' Cada guía habla cuando te acercás.'
    : done
      ? 'The full-match rules are provisional. Replay, review them or return to Nix.'
      : t.bankRevealed
        ? 'Recogé cristales con el botón o tu tecla de interacción. Seguí BANK y permanecé cerca para guardar la esencia.'
        : 'Elegí un hechizo y apretá Lanzar, o usá tu macro. Apuntá al casillero. Usá tu tecla de interacción para recoger.';
  $('#deposit-status').textContent = hall
    ? 'Safe hallway · learn at your pace'
    : done
      ? 'Tutorial complete · ' + demo.state.secured + ' essence secured'
      : !t.bankRevealed
        ? 'Bank sealed · opens after two defeats (or a short fallback timer)'
        : demo.state.carried
          ? 'Carrying ' + demo.state.carried + ' · follow BANK'
          : 'Bank revealed · collect a crystal to deposit';
  const endPanel = $('#tutorial-end'),
    endHidden = !done || !!t.dialog,
    wasHidden = endPanel.hidden;
  endPanel.hidden = endHidden;
  if (wasHidden && !endHidden)
    motion(
      endPanel,
      [
        { opacity: 0, transform: 'translate(-50%,10px)' },
        { opacity: 1, transform: 'translate(-50%,0)' },
      ],
      { duration: 500 },
    );
  updateJourney(t);
  if (hall) {
    const g = M.nearGuide(demo.state);
    $('.interact-area').hidden = !g;
    $('#interact').disabled = !g;
    $('#interact').textContent = g ? 'Talk to ' + g.name + ' · ' + keyLabel(demo.macroBindings.interact) : 'Talk';
  }
  $('#cast').disabled = demo.paused || hall || done;
  $('#prepare-spell').disabled = demo.paused || hall || done;
  if (setup) {
    $('#cast').disabled = true;
    $('#prepare-spell').disabled = true;
    $('#objective-label').textContent = 'PREPARÁ TUS CONTROLES';
    $('#objective').textContent = 'Sala segura';
    $('#hint').textContent = 'Conocé las ventanas y elegí si querés usar macros antes de combatir.';
    $('#deposit-status').textContent = 'Combate detenido · no se gasta vida, maná ni pociones';
  }
  if (practice) {
    $('#chapter').textContent = 'THE VEIL / PRÁCTICA CUERPO A CUERPO';
    $('#objective-label').textContent = 'APRENDÉ A GOLPEAR';
    $('#objective').textContent = hit ? '1 / 1 golpe acertado' : '0 / 1 golpe acertado';
    $('#hint').textContent = 'Acercate al Entrenador y miralo de frente. Golpear no sigue al cursor.';
    $('#deposit-status').textContent = 'Práctica segura · acertá un golpe antes de seguir';
    $('#cast').disabled = true;
    $('#prepare-spell').disabled = true;
  }
  if (t.bankRevealed && !done) {
    const b = M.bankAt(demo.state),
      dx = b.x - demo.state.player.x,
      dy = b.y - demo.state.player.y;
    $('#objective').textContent =
      'BANK ' +
      (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '→' : '←') : dy > 0 ? '↓' : '↑') +
      ' · ' +
      Math.round(Math.hypot(dx, dy) / 32) +
      ' tiles';
  }
}
export function bindGuide() {
  $('#guide-next').onclick = () => {
    M.nextGuide(demo.state);
    syncGuide();
    tutorialUI();
    if (!demo.state.tutorial?.dialog) focusGame();
    demo.previous = performance.now();
    schedule();
  };
  $('#guide-dialog').addEventListener('cancel', (event) => {
    event.preventDefault();
  });
  $('#tutorial-rules').onclick = () => {
    M.talk(demo.state, 'final');
    syncGuide();
  };
  $('#tutorial-replay').onclick = () => {
    demo.state = M.createTutorial();
    resetMotion();
    demo.returning = false;
    demo.pointer = null;
    demo.noticeId = 0;
    clear();
    syncGuide();
    hideHelp();
  };
  $('#tutorial-home').onclick = returnToNix;
}
function paintPortrait(id: string) {
  const body = M.guides.find((g) => g.id === id)?.body || M.guides[2].body,
    surface = $('#guide-portrait'),
    c = surface.getContext('2d')!;
  c.clearRect(0, 0, 96, 112);
  c.imageSmoothingEnabled = false;
  if (demo.images[body]) c.drawImage(demo.images[body], 0, 320, 96, 160, 0, -20, 96, 160);
}
function updateJourney(t: TutorialState) {
  const index =
    t.stage === 'hallway' || t.stage === 'setup'
      ? 0
      : t.stage === 'fight' || t.stage === 'melee'
        ? 1
        : t.stage === 'deposit'
          ? 2
          : 3;
  for (let i = 0; i < 4; i++) {
    const step = $('#journey-' + i);
    step.dataset.state = i < index ? 'done' : i === index ? 'current' : 'waiting';
    step.setAttribute('aria-current', i === index ? 'step' : 'false');
  }
  document.body.dataset.tutorialStage = t.stage;
}
