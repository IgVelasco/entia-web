import {resize,worldToScreen} from './camera.ts';
import {setContent} from './content.ts';
import {$,canvas,ground,motionOff,site} from './context.ts';
import {dismissFrontier} from './escort.ts';
import {resetJoystick} from './input.ts';
import {updateKeeperStates} from './labels.ts';
import {requestDraw} from './loop.ts';
import {beginManualMovement,clearMovementInput,heldDirections,moveHero,walkingPath} from './movement.ts';
import {hero,homePortal} from './town.ts';

function enterPortal(){
 if(site.enteringPortal)return;site.enteringPortal=true;clearMovementInput();site.route=null;
 if(motionOff()){showDemo(true);return;}
 const p=worldToScreen(homePortal),veil=document.createElement('div');veil.id='portal-transition';veil.setAttribute('aria-hidden','true');
 veil.style.setProperty('--portal-x',p.x+'px');veil.style.setProperty('--portal-y',(p.y+canvas.getBoundingClientRect().top)+'px');
 document.body.append(veil);$('#world').classList.add('entering-portal');
 setTimeout(()=>{if(site.enteringPortal)showDemo(true);},460);
}
export function walkToPortal(){site.portalReentryBlocked=false;resetJoystick();heldDirections.clear();beginManualMovement();moveHero(walkingPath(homePortal),{explore:true,complete:enterPortal});}
export function portalCrossing(){if(site.portalReentryBlocked){if(Math.hypot(hero.x-homePortal.x,hero.y-homePortal.y)>48)site.portalReentryBlocked=false;return;}if(!site.enteringPortal&&Math.abs(hero.x-homePortal.x)<24&&Math.abs(hero.y-homePortal.y)<20)enterPortal();}
function ensureDemoFrame(){
 const frame=$('#demo-frame');if(site.demoFrameStarted&&!site.demoFailed)return;site.demoFrameStarted=true;site.demoFailed=false;site.demoLoaded=false;
 const url=location.origin+'/demo/?embedded=1';if(frame.contentWindow?.location?.replace)frame.contentWindow.location.replace(url);else frame.src=url;$('#demo-loading').hidden=false;
 site.demoLoadTimer=setTimeout(()=>{if(!site.demoLoaded)$('#demo-load-message').textContent='The demo is taking longer to load. You can return to Nix while it finishes.';},20000);
}
function activateDemoFrame(type: string){if(!site.demoOpen||!site.demoLoaded)return;const frame=$('#demo-frame');if(!matchMedia('(pointer: coarse)').matches)frame.focus({preventScroll:true});frame.contentWindow?.postMessage({type,presentationScale:site.scale},location.origin);}
export function showDemo(push=true){
 if(site.demoOpen)return;if(site.frontierState.open)dismissFrontier({focus:false});const resumed=site.demoEverOpened;site.demoEverOpened=true;
 site.demoCloseEpoch++;$('#demo-host').classList.remove('closing');site.demoOpen=true;site.enteringPortal=false;canvas.width=1;canvas.height=1;ground.width=1;ground.height=1;site.groundReady=false;ensureDemoFrame();clearMovementInput();site.route=null;if(site.frameRequest)cancelAnimationFrame(site.frameRequest);site.frameRequest=0;
 $('#portal-transition')?.remove();$('#world').classList.remove('entering-portal');$('#app').inert=true;document.body.classList.add('demo-open');$('#demo-host').hidden=false;
 if(push&&location.hash!=='#demo'){window.history.pushState({entiaDemo:true},'','#demo');}
 if(site.demoLoaded)activateDemoFrame(resumed?'entia-demo-resume':'entia-demo-activate');
}
export function closeDemo(changeHistory=true){
 if(!site.demoOpen)return;
 // Closing the view never depends on joint iframe/browser history advancing.
 const epoch=++site.demoCloseEpoch;$('#demo-frame').contentWindow?.postMessage({type:'entia-demo-pause'},location.origin);
 site.demoOpen=false;site.enteringPortal=false;site.portalReentryBlocked=true;$('#app').inert=false;document.body.classList.remove('demo-open');
 if(changeHistory){site.current='home';site.atPlace=null;setContent('home');updateKeeperStates();$('#location-state').textContent='Back in Nix';if(location.hash==='#demo')window.history.replaceState(null,'','#home');}
 const host=$('#demo-host');host.classList.add('closing');
 if(motionOff())host.hidden=true;else setTimeout(()=>{if(epoch===site.demoCloseEpoch&&!site.demoOpen){host.hidden=true;host.classList.remove('closing');}},420);
 site.last=performance.now();resize();requestDraw();canvas.focus({preventScroll:true});
}
export function bindPortal(){
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==$('#demo-frame').contentWindow)return;
  if(event.data?.type==='entia-demo-ready'){site.demoLoaded=true;clearTimeout(site.demoLoadTimer);$('#demo-loading').hidden=true;if(site.demoOpen)activateDemoFrame('entia-demo-activate');if(!site.demoOpen&&!site.enteringPortal)$('#demo-frame').contentWindow?.postMessage({type:'entia-demo-pause'},location.origin);}
  else if(event.data?.type==='entia-demo-exit')closeDemo(true);
  else if(event.data?.type==='entia-demo-error'){site.demoFailed=true;$('#demo-load-message').textContent='The demo artwork could not load. Return to Nix and try again.';}
 });
 $('#demo-loading-back').onclick=()=>closeDemo(true);
}
