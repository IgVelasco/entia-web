// Nix site entry: wires the controller's listeners in page order, sizes the canvas, loads artwork and mounts the character editor.
import * as EntiaCharacter from '../shared/character.ts';
import {load} from './assets.ts';
import {resize} from './camera.ts';
import {bindPageClicks,bindZoneDialog} from './content.ts';
import {$,site} from './context.ts';
import {dismissFrontier} from './escort.ts';
import {bindControls,bindInputRelease,bindJoystick,bindKeyboard,bindPageGestureGuards,bindPointer,bindWorldGestureGuards,setAim} from './input.ts';
import {bindLabels,setGameText} from './labels.ts';
import {bindLifecycle,bindPageShow,bindSurfaceRecovery,requestDraw,setMotionState} from './loop.ts';
import {clearMovementInput} from './movement.ts';
import {bindPortal} from './portal.ts';
import {bindHistory} from './routing.ts';
import {hero} from './town.ts';

bindPortal();
bindLabels();
bindWorldGestureGuards();
bindPageClicks();
bindPointer();
bindJoystick();
bindControls();
bindKeyboard();
bindInputRelease();
bindHistory();
bindLifecycle();
// load() shows its own retry button on failure, so its promise is deliberately not awaited.
setMotionState();resize();void load();
bindPageShow();
EntiaCharacter.mount({assets:'assets/',onChange:value=>{hero.body=value.body;setGameText($('#player-label span'),value.name);requestDraw();},onOpen:()=>{if(site.frontierState.open)dismissFrontier({focus:false});clearMovementInput();site.route=null;setAim(false);},onClose:()=>requestDraw()});
bindSurfaceRecovery();
bindPageGestureGuards();
bindZoneDialog();

