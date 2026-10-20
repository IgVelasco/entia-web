import {$,$$,canvas,compactMode,motionOff,site} from './context.ts';
import {clearMovementInput} from './movement.ts';
import {walkToPortal} from './portal.ts';
import {go} from './routing.ts';
import {spots} from './town.ts';

export function setContent(place: string,{popup=false,animate=true}={}) {
  closeZoneInfo();
  const home=place==='home';
  $('#main-content').scrollTop=0;
  $('#intro').hidden=!home;$('#panel').hidden=home;
  $('#world').classList.toggle('panel-open',!home);
  if(!home){
    $('#panel-content').innerHTML=content(place).replace('<h2>','<h2 id="section-heading" tabindex="-1">');
    $('#panel').scrollTop=0;
    if(animate&&!motionOff())$('#panel-content').animate([{opacity:.35,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  if(popup)openZoneInfo(place);
  $('#location-name').textContent=spots[place].section;
  $('#footer-place').textContent=spots[place].section.toUpperCase();
  $('#world').dataset.place=place;
  for(const button of $$('.nav')){
    const active=button.dataset.place===place;button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
}
const names=[['Aren','Ranger','4,820'],['Sombra','Mage','4,610'],['Elara','Warrior','4,380'],['Nox','Cleric','4,170'],['Kael','Paladin','3,960'],['Lyra','Bard','3,820'],['Corvus','Assassin','3,710'],['Mara','Druid','3,590'],['Rook','Warrior','3,460'],['Ash','Mage','3,310']];
export function content(place: string){
  if(place==='arena')return `<span class="eyebrow">GAME · IN DEVELOPMENT</span><h2>PvP with something<br>at stake.</h2><p>Manual aiming. Distinct classes. Essence worth fighting for.</p><div class="steps"><div class="step"><div><h3>Find a fight.</h3><p>Meet in Nix, join the shared queue and vote for a match type.</p></div></div><div class="step"><div><h3>Carry essence.</h3><p>Earn essence from eligible kills. What you carry stays at risk.</p></div></div><div class="step"><div><h3>Bring it home.</h3><p>Deposit essence to secure it. Progress comes from active play.</p></div></div></div><div class="mode-list"><span>Free-for-all</span><span>Squads of three</span><span>Factions</span></div><p class="small-note">This is the planned game loop. Rules and availability are still in development.</p>`;
  if(place==='hall')return `<span class="eyebrow">RANKINGS</span><h2>Rankings preview</h2><p>Sample players and scores. Live rankings are not connected yet.</p><div class="tabs" role="group" aria-label="Ranking category"><button class="active" data-rank="essence" aria-pressed="true">Essence</button><button data-rank="support" aria-pressed="false">Support</button></div><div id="ranks">${rankRows('essence')}</div><p class="small-note">Categories, seasons and public profiles are still being designed.</p>`;
  if(place==='gate')return `<span class="eyebrow">DOWNLOAD</span><h2>Download Entia</h2><p>No game download is available in this preview.</p><div class="download-card"><span class="status">NOT AVAILABLE YET</span><h3>Entia for desktop</h3><p class="platform">The release build and supported platforms will be listed here.</p><button class="primary" disabled>Download unavailable</button></div><button class="quiet" data-place="arena">About the game</button>`;
  return '';
}
function rankRows(mode: string){const rows=mode==='support'?[names[3],names[5],names[7],names[1],names[8],names[4],names[0],names[2],names[9],names[6]]:names;return rows.map((n,i)=>`<div class="rank-row"><span class="rank-number">${String(i+1).padStart(2,'0')}</span><img class="rank-avatar" src="assets/portraits/${i%3}.png" alt=""><span class="rank-info"><b>${n[0]}</b><small>${n[1]}</small></span><span class="rank-score">${mode==='essence'?n[2]:Math.round(930-i*67).toLocaleString()}</span></div>`).join('');}

function focusContentIfNeeded(trigger: Element) {
  // Keep navigation focus in place. Content links that disappear hand focus to the new section.
  if(trigger && $('#main-content').contains(trigger)){
    const heading=$('#section-heading');(heading||$('#main-content')).focus({preventScroll:true});
  }
}
export function bindPageClicks(){
 document.addEventListener('click',event=>{
   if(compactMode()&&(event.target as Element).closest('.skip-link')){event.preventDefault();openZoneInfo(site.current);return;}
   if((event.target as Element).closest('#portal-journey')){walkToPortal();canvas.focus({preventScroll:true});return;}
   const destination=(event.target as Element).closest('button[data-place], a[data-place]') as HTMLElement;
   if(destination){event.preventDefault();go(destination.dataset.place!,{cast:!!destination.dataset.cast});focusContentIfNeeded(destination);return;}
   const rank=(event.target as Element).closest('[data-rank]') as HTMLElement;
   if(rank){
     $$('[data-rank]').forEach(b=>{b.classList.toggle('active',b===rank);b.setAttribute('aria-pressed',String(b===rank));});
     $('#ranks').innerHTML=rankRows(rank.dataset.rank!);return;
   }


 });
}
export function openZoneInfo(place: string,{animate=true,arrival=false}={}){if(!compactMode())return;clearMovementInput();const dialog=$('#zone-dialog');dialog.classList.toggle('pre-revealed',!animate);dialog.classList.toggle('arrival-effect',arrival);site.zoneContent=$(place==='home'?'#intro':'#panel');$('#zone-body').append(site.zoneContent);if(!dialog.open)dialog.showModal();$('#close-zone').focus({preventScroll:true});}
export function closeZoneInfo(){const dialog=$('#zone-dialog');dialog.classList.remove('pre-revealed','arrival-effect');if(dialog.open)dialog.close();if(site.zoneContent){$('#main-content').append(site.zoneContent);site.zoneContent=null;}}
export function bindZoneDialog(){
 $('#close-zone').onclick=closeZoneInfo;
 $('#zone-dialog').addEventListener('close',()=>{if(!$('#zone-dialog').open&&site.zoneContent){$('#main-content').append(site.zoneContent);site.zoneContent=null;}});
 $('#zone-dialog').addEventListener('click',event=>{if(event.target===$('#zone-dialog'))closeZoneInfo();});
}
