// Offline demo entry: wires the controller's listeners, sizes the canvas, loads artwork and mounts the character editor.
import * as Character from '../shared/character.ts';
import { load } from './assets.ts';
import { $, demo } from './context.ts';
import { bindEmbed } from './embed.ts';
import { bindActionButtons, bindGuide, bindHud, bindSpells, focusGame, setHudDrawer } from './hud.ts';
import { bindGestureGuards, bindKeyboard, bindPointer, bindTouchControls, clear } from './input.ts';
import { bindLifecycle, schedule } from './loop.ts';
import { resize } from './render.ts';
import { bindSetup } from './setup.ts';
import { bindCombatCoach } from './combat-coach.ts';

bindKeyboard();
bindTouchControls();
bindActionButtons();
bindPointer();
bindLifecycle();
// load() shows its own retry screen on failure, so its promise is deliberately not awaited.
resize();
void load();
bindHud();
bindEmbed();
bindGestureGuards();
Character.mount({
  assets: '../assets/',
  onChange: () => schedule(),
  onOpen: () => {
    clear();
    demo.state.armed = false;
    setHudDrawer(false);
  },
  onClose: () => {
    focusGame();
    demo.previous = performance.now();
    schedule();
  },
});
bindSpells();
bindGuide();
bindSetup();
bindCombatCoach();
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe($('#playfield'));
