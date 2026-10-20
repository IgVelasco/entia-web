import {camera} from './camera.ts';
import {openZoneInfo,setContent} from './content.ts';
import {$,compactMode,heading,motionOff,site} from './context.ts';
import {dismissFrontier} from './escort.ts';
import {resetJoystick,setAim} from './input.ts';
import {updateKeeperStates} from './labels.ts';
import {requestDraw} from './loop.ts';
import {heldDirections,moveHero,navigationPath} from './movement.ts';
import {closeDemo,showDemo} from './portal.ts';
import {apocalipsis} from './spell.ts';
import {hero,keepers,npcs,spots} from './town.ts';

export function reactToArrival(place: string) {
  for(const n of [...npcs,...keepers])if(n.place===place||Math.hypot(n.x-hero.x,n.y-hero.y)<200){n.reaction=1.1;n.dir=heading(hero.x-n.x,hero.y-n.y);}
}
function arrive(place: string,announce=true) {
  site.atPlace=place;hero.dir=heading(spots[place].x-hero.x,spots[place].y-hero.y);
  $('#location-state').textContent='You are here';
  $('#world').classList.remove('traveling');
  updateKeeperStates();
  if(!motionOff())site.rings.push({x:hero.x,y:hero.y,age:0,duration:.5});
  reactToArrival(place);
  if(announce){
    $('#keeper-reply').textContent=spots[place].greeting;$('#keeper-reply').hidden=false;
    clearTimeout(site.replyTimer);site.replyTimer=setTimeout(()=>{$('#keeper-reply').hidden=true;},2200);
  }
}
export function go(place: string,{history:writeHistory=true,instant=false,announce=true,cast=false,animateContent=true}={}) {
  if(!spots[place])return;site.mobileExploring=false;site.mobilePanX=site.mobilePanY=0;if(site.frontierState.open)dismissFrontier({focus:false});
  site.nearbyPlace=null;
  resetJoystick();heldDirections.clear();
  clearTimeout(site.toastTimer);$('#travel-toast').classList.remove('show');$('#travel-toast').textContent='';
  $('#world').classList.remove('walking');
  site.atPlace=null;site.current=place;setAim(false);clearTimeout(site.replyTimer);$('#keeper-reply').hidden=true;
  setContent(place,{popup:!instant&&site.ready&&!cast,animate:animateContent});
  if(writeHistory && location.hash!=='#'+place)window.history.pushState(null,'','#'+place);
  site.rings=[];
  camera.targetX=990+(spots[place].x-990)*.07;camera.targetY=530+(spots[place].y-530)*.05;
  if(motionOff()||instant){camera.x=camera.targetX;camera.y=camera.targetY;}
  const destination={place,near:!instant&&site.ready};
  const points=navigationPath(destination);
  if(cast&&!motionOff()&&!instant&&site.ready){
    site.rings.push({x:hero.x,y:hero.y,age:0,duration:.32});
    site.spell={place,x:spots[place].x,y:spots[place].y-32,age:0,delay:.12,duration:.12+apocalipsis.duration,hit:false};
    hero.dir=heading(spots[place].x-hero.x,spots[place].y-hero.y);
  }
  $('#location-state').textContent=`Walking to ${spots[place].section}…`;
  $('#world').classList.add('traveling');
  moveHero(points,{instant:instant||!site.ready,destination,complete:()=>{arrive(place,announce);if(cast&&compactMode()&&site.ready&&!instant)openZoneInfo(place,{arrival:true});}});
  updateKeeperStates();requestDraw();
}
export function toast(message: string) {
  $('#travel-toast').textContent=message;$('#travel-toast').classList.add('show');
  clearTimeout(site.toastTimer);site.toastTimer=setTimeout(()=>$('#travel-toast').classList.remove('show'),2600);
}
export function restoreHash(){if(site.frontierState.open)dismissFrontier({focus:false});const hash=location.hash.slice(1);if(site.enteringPortal&&hash!=='demo'){site.enteringPortal=false;$('#portal-transition')?.remove();$('#world').classList.remove('entering-portal');}if(hash==='main-content')return;if(hash==='demo'){showDemo(false);return;}if(site.demoOpen){closeDemo(false);if(site.current===(spots[hash]?hash:'home'))return;}go(spots[hash]?hash:'home',{history:false,announce:false});}
export function bindHistory(){
 window.addEventListener('popstate',restoreHash);
 window.addEventListener('hashchange',()=>{const place=location.hash.slice(1);if(place!==site.current)restoreHash();});
}
