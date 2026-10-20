import M from './rules/navigation.ts';
import {$,canvas,demo} from './context.ts';
import {returnToNix} from './embed.ts';
import {focusGame,selectSpell,setHudDrawer,syncGuide,togglePause,ui,useSelected} from './hud.ts';
import {schedule} from './loop.ts';

declare global {
  // Chromium's non-standard InputDeviceCapabilities; clicks synthesized from touches are ignored.
  interface UIEvent { readonly sourceCapabilities?: { readonly firesTouchEvents: boolean } | null }
}

export function input(){if(demo.returning||demo.presentationNow<demo.beatUntil||demo.hudDrawerOpen||$('#help-dialog').open||$('#character-dialog').open||!!demo.state.tutorial?.dialog)return {x:0,y:0};let key=[...demo.keys].filter(k=>k!==' ').at(-1),order=demo.keyboardOrder.get(key)||0;for(const held of demo.touches.values())if(held.key&&held.order>=order){key=held.key;order=held.order;}return key==='d'||key==='arrowright'?{x:1,y:0}:key==='a'||key==='arrowleft'?{x:-1,y:0}:key==='w'||key==='arrowup'?{x:0,y:-1}:key==='s'||key==='arrowdown'?{x:0,y:1}:{x:0,y:0};}
export function aimPoint(){if(!demo.pointer)return null;const point={x:demo.state.player.x+(demo.pointer.x-demo.width/2)/demo.scale,y:(demo.state.phase==='hallway'?M.hallway.cameraY:demo.state.player.y)+(demo.pointer.y-demo.height/2)/demo.scale};const hit=demo.state.enemies.filter(e=>e.hp>0&&Math.abs(e.x-point.x)<28&&point.y>=e.y-88&&point.y<=e.y+8).sort((a,b)=>b.y-a.y)[0];if(demo.state.selectedSpell==='remover'&&Math.abs(point.x-demo.state.player.x)<28&&point.y>=demo.state.player.y-88&&point.y<=demo.state.player.y+8)return {x:demo.state.player.x,y:demo.state.player.y,self:true};return hit?{x:hit.x,y:hit.y,enemyId:hit.name}:point;}
export function prepareSpell(){if(!demo.ready||demo.paused||demo.presentationNow<demo.beatUntil||demo.state.phase==='hallway'||demo.state.tutorial?.stage==='complete')return;setHudDrawer(false);M.cancelWalk(demo.state);demo.state.armed=!demo.state.armed;if(!demo.state.armed){M.tell(demo.state,'Aiming cancelled. Click to walk.');focusGame();return;}M.tell(demo.state,M.spells[demo.state.selectedSpell].name+' ready. '+(demo.state.selectedSpell==='remover'?'Click yourself or another character.':'Point at a rival and click.')+' Esc cancels.');focusGame();}
export function castAtPointer(){const point=aimPoint();if(point)M.cast(demo.state,point);else M.tell?.(demo.state,'Point at the world to aim.');}
export function interact(){const action=M.interact(demo.state);if(action==='exit')returnToNix();else if(action==='talk'){clear();syncGuide();}else if(action==='bank')M.tell(demo.state,'Stay near the bank. It draws in your carried essence automatically.');}
export function clear(){M.cancelWalk(demo.state);demo.keys.clear();demo.keyboardOrder.clear();demo.touches.clear();syncDpad();demo.worldTouches.clear();M.clearPotionKeys(demo.state);}
const accepted=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'];
export function bindKeyboard(){
 document.addEventListener('keydown',e=>{if(demo.returning||demo.presentationNow<demo.beatUntil||$('#help-dialog').open||$('#character-dialog').open||!!demo.state.tutorial?.dialog)return;if(e.key==='Escape'&&demo.hudDrawerOpen){setHudDrawer(false);return;}if(e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();if(key==='escape'&&demo.state.armed){demo.state.armed=false;M.tell(demo.state,'Spell cancelled.');return;}if(key==='p'||key==='escape'){e.preventDefault();if(!e.repeat)togglePause();return;}if((e.target as Element).closest('input,select,textarea'))return;if((key==='f1'||key==='f2')&&!e.repeat&&demo.ready&&!demo.paused){e.preventDefault();M.pressPotion(demo.state,key,key==='f1'?'life':'mana');return;}if((e.target as Element).closest('button,a'))return;if(accepted.includes(key)){e.preventDefault();if(demo.ready&&!demo.paused&&!e.repeat){demo.keys.delete(key);demo.keys.add(key);demo.keyboardOrder.set(key,++demo.movementOrder);}}if(['1','2','3'].includes(key)&&!e.repeat&&demo.ready&&!demo.paused){e.preventDefault();selectSpell(['apocalipsis','inmovilizar','remover'][Number(key)-1]);prepareSpell();}if(key==='c'&&!e.repeat&&demo.ready&&!demo.paused){e.preventDefault();prepareSpell();}if(key===' '&&!e.repeat&&demo.ready&&!demo.paused){e.preventDefault();M.melee(demo.state);}if(key==='q'&&!e.repeat&&demo.ready&&!demo.paused){if(!M.pickup(demo.state,22))M.tell(demo.state,'Stand on a dropped crystal, then press Q.');}if(key==='n'&&!e.repeat&&demo.ready&&!demo.paused){clear();M.meditate(demo.state);}if(key==='u'&&!e.repeat&&demo.ready&&!demo.paused)useSelected();if(key==='e'&&!e.repeat&&demo.ready&&!demo.paused)interact();});document.addEventListener('keyup',e=>{const key=e.key.toLowerCase();demo.keys.delete(key);demo.keyboardOrder.delete(key);if(key==='f1'||key==='f2'){e.preventDefault();M.releasePotion(demo.state,key);}});
}
const mapping: Record<string,string>={up:'w',left:'a',down:'s',right:'d'};
function syncDpad(){if(demo.joystickPointer!==null&&!demo.touches.has(demo.joystickPointer)){demo.joystickPointer=null;$('#joystick-thumb').style.transform='translate(0px,0px)';$('#joystick').dataset.active='false';}for(const button of document.querySelectorAll<HTMLButtonElement>('[data-dir]'))button.dataset.pressed=String([...demo.touches.values()].some(p=>p.key===mapping[button.dataset.dir!]));}
function setDirection(id: number,key: string|null,type?: string){const previous=demo.touches.get(id);if(previous?.key===key)return;demo.touches.set(id,{key,pointerType:type||previous?.pointerType||'mouse',order:++demo.movementOrder});syncDpad();}
function releaseDirection(event: PointerEvent){if(demo.touches.delete(event.pointerId))syncDpad();}
function directionAt(x: number,y: number){for(const button of document.querySelectorAll<HTMLButtonElement>('[data-dir]')){const r=button.getBoundingClientRect();if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return mapping[button.dataset.dir!];}return null;}
export function bindTouchControls(){
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-dir]')){
 button.addEventListener('pointerdown',e=>{e.preventDefault();if(e.button!==undefined&&e.button!==0)return;if(demo.paused||!demo.ready||demo.hudDrawerOpen||$('#character-dialog').open)return;document.getSelection?.()?.removeAllRanges();demo.touches.delete(e.pointerId);setDirection(e.pointerId,mapping[button.dataset.dir!],e.pointerType);try{button.setPointerCapture(e.pointerId);}catch{}});
 button.addEventListener('pointermove',e=>{if(!demo.touches.has(e.pointerId))return;if(e.pointerType==='mouse'&&e.buttons===0){releaseDirection(e);return;}e.preventDefault();const direction=directionAt(e.clientX,e.clientY);
  // A captured hold survives thumb drift and the gaps between arrows until release.
  if(direction)setDirection(e.pointerId,direction,e.pointerType);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'] as const)button.addEventListener(type,releaseDirection);
 }
 joystick.addEventListener('pointerdown',e=>{e.preventDefault();if((e.button!==undefined&&e.button!==0)||demo.joystickPointer!==null||demo.paused||!demo.ready||demo.hudDrawerOpen||$('#character-dialog').open)return;demo.joystickPointer=e.pointerId;joystick.dataset.active='true';try{joystick.setPointerCapture(e.pointerId);}catch{}steerJoystick(e);});
 joystick.addEventListener('pointermove',e=>{if(e.pointerId!==demo.joystickPointer)return;e.preventDefault();if(e.pointerType==='mouse'&&e.buttons===0){releaseDirection(e);return;}steerJoystick(e);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'] as const)joystick.addEventListener(type,releaseDirection);
 for(const type of ['pointerup','pointercancel'] as const)window.addEventListener(type,releaseDirection,true);
 for(const type of ['touchend','touchcancel'])window.addEventListener(type,event=>{if((event as TouchEvent).touches.length===0){for(const [id,held] of demo.touches)if(held.pointerType==='touch')demo.touches.delete(id);syncDpad();}},true);
 for(const type of ['touchstart','touchmove'])$('.dpad').addEventListener(type,event=>{if(event.cancelable)event.preventDefault();},{passive:false});
 window.addEventListener('pagehide',clear);window.addEventListener('orientationchange',clear);
}
const joystick=$('#joystick'),joystickThumb=$('#joystick-thumb');
function steerJoystick(e: PointerEvent){const r=joystick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,distance=Math.hypot(dx,dy),limit=r.width*.3,ratio=distance?Math.min(1,limit/distance):0;joystickThumb.style.transform=`translate(${dx*ratio}px,${dy*ratio}px)`;let key: string|null=null;if(distance>9){const held=demo.touches.get(e.pointerId)?.key,horizontal=held==='a'||held==='d',vertical=held==='w'||held==='s';const xAxis=Math.abs(dx)>Math.abs(dy)*1.15?true:Math.abs(dy)>Math.abs(dx)*1.15?false:horizontal||(!vertical&&Math.abs(dx)>=Math.abs(dy));key=xAxis?(dx>0?'d':'a'):(dy>0?'s':'w');}setDirection(e.pointerId,key,e.pointerType);}
function locatePointer(e: MouseEvent){const rect=canvas.getBoundingClientRect();demo.pointer={x:e.clientX-rect.left,y:e.clientY-rect.top};}
export function bindPointer(){
 canvas.addEventListener('pointermove',locatePointer);
 canvas.addEventListener('click',e=>{if(e.pointerType==='touch'||e.sourceCapabilities?.firesTouchEvents||performance.now()-demo.lastTouchWorld<800)return;worldClick(e);});
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){e.preventDefault();canvas.setPointerCapture(e.pointerId);demo.worldTouches.add(e.pointerId);locatePointer(e);}});
 canvas.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){e.preventDefault();if(!demo.worldTouches.delete(e.pointerId))return;demo.lastTouchWorld=performance.now();worldClick(e);}});
 canvas.addEventListener('pointercancel',e=>demo.worldTouches.delete(e.pointerId));canvas.addEventListener('lostpointercapture',e=>demo.worldTouches.delete(e.pointerId));
}
export function worldClick(e: MouseEvent){const bounds=canvas.getBoundingClientRect();if(e.button!==undefined&&e.button!==0)return;if(e.clientX<bounds.left||e.clientX>bounds.left+bounds.width||e.clientY<bounds.top||e.clientY>bounds.top+bounds.height)return;if(!demo.ready||demo.paused||demo.presentationNow<demo.beatUntil||demo.hudDrawerOpen||$('#help-dialog').open||$('#character-dialog').open||demo.state.tutorial?.dialog)return;focusGame();locatePointer(e);const world={x:demo.state.player.x+(demo.pointer!.x-demo.width/2)/demo.scale,y:(demo.state.phase==='hallway'?M.hallway.cameraY:demo.state.player.y)+(demo.pointer!.y-demo.height/2)/demo.scale};
 if(demo.state.armed){M.cancelWalk(demo.state);castAtPointer();ui();schedule();return;}
 if(demo.state.phase==='hallway'){const g=M.guides.find(g=>Math.abs(world.x-g.x)<28&&world.y>=g.y-96&&world.y<=g.y+8);if(g){if(Math.hypot(g.x-demo.state.player.x,g.y-demo.state.player.y)<100){M.cancelWalk(demo.state);M.talk(demo.state,g.id);clear();syncGuide();}else M.walkTo(demo.state,{x:g.x,y:464},g.id);schedule();return;}}
 if(demo.state.phase==='hallway'&&world.x>=464&&demo.state.tutorial!.seen.length<3)M.tell(demo.state,'Meet all three guides before entering the arena.');
 if(demo.state.bankUnlocked&&Math.abs(world.x-M.bankAt(demo.state).x)<60&&world.y>M.bankAt(demo.state).y-55&&world.y<M.bankAt(demo.state).y+14){const b=M.bankAt(demo.state);M.walkTo(demo.state,{x:b.x,y:b.y+64});}else M.walkTo(demo.state,world);schedule();
}
export function bindGestureGuards(){
 for(const surface of [canvas,$('#macro-life'),$('#macro-mana'),$('#macro-spell')])surface.addEventListener('contextmenu',event=>event.preventDefault());
 for(const surface of [canvas,...document.querySelectorAll('.mobile-controls,.macrobar,.stage button')]){surface.addEventListener('contextmenu',e=>e.preventDefault());surface.addEventListener('selectstart',e=>e.preventDefault());surface.addEventListener('dragstart',e=>e.preventDefault());}
 for(const surface of document.querySelectorAll('header,aside,button'))for(const type of ['selectstart','dragstart','contextmenu'])surface.addEventListener(type,event=>event.preventDefault());
 for(const type of ['contextmenu','selectstart'])$('.dpad').addEventListener(type,e=>{e.preventDefault();demo.touches.clear();syncDpad();});
 // The opaque control deck is a sibling of the map, never a transparent canvas overlay.
 for(const type of ['pointerdown','pointerup','click','dblclick'])$('#control-deck').addEventListener(type,event=>event.stopPropagation());
}
// Secondary touch pointers do not reliably synthesize clicks while a D-pad is held.
export function bindTap(button: HTMLButtonElement,action: ()=>void){let active: number|null=null,lastPointer=-1000;button.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();active=e.pointerId;button.setPointerCapture(e.pointerId);});button.addEventListener('pointerup',e=>{e.preventDefault();if(active!==e.pointerId)return;active=null;lastPointer=performance.now();if(!button.disabled)action();});for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,()=>{active=null;});button.addEventListener('click',(e: {detail: number; preventDefault?: ()=>void}={detail:0})=>{e.preventDefault?.();if(e.detail===0||performance.now()-lastPointer>800)action();});}
