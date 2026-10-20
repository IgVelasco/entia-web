import M from './rules/navigation.ts';
import {$,canvas,demo,floor} from './context.ts';
import {focusGame,hideHelp} from './hud.ts';
import {clear} from './input.ts';
import {recoverDemoScene,schedule} from './loop.ts';
import {cancelMotion} from './motion.ts';
import {resize} from './render.ts';

export function notifyParent(type: string){if(demo.embedded)window.parent.postMessage({type},window.location.origin);}
export function returnToNix(){if(demo.returning)return;demo.returning=true;cancelMotion();clear();if(demo.embedded)notifyParent('entia-demo-exit');else window.location.assign('../#home');}
export function bindEmbed(){
 document.addEventListener('click',e=>{const link=(e.target as Element).closest('a[href="../#home"]');if(link&&demo.embedded&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();returnToNix();}});
 window.addEventListener('message',e=>{if(!demo.embedded||e.source!==window.parent||e.origin!==window.location.origin)return;if(Number.isFinite(e.data?.presentationScale)&&e.data.presentationScale>=.25&&e.data.presentationScale<=3){demo.inheritedScale=e.data.presentationScale;resize();}if(e.data?.type==='entia-demo-activate'){demo.hostSuspended=false;if(demo.state.tutorial&&!$('#help-dialog').open)demo.paused=false;recoverDemoScene();demo.previous=performance.now();focusGame();schedule();}else if(e.data?.type==='entia-demo-pause'){demo.hostSuspended=true;demo.paused=true;cancelMotion();clear();if(demo.raf)cancelAnimationFrame(demo.raf);demo.raf=0;floor.width=1;floor.height=1;demo.floorReady=false;canvas.width=1;canvas.height=1;}else if(e.data?.type==='entia-demo-resume'){demo.hostSuspended=false;if(demo.state.phase==='arena'&&(demo.returning||M.nearGate(demo.state))){demo.state.player.x=M.gateway.x+128;demo.state.player.y=M.gateway.y;demo.state.player.step=null;}demo.returning=false;recoverDemoScene();hideHelp();}});
}
