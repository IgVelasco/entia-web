'use strict';
let embedded=false;try{embedded=!!window.parent&&window.parent!==window&&window.parent.location.origin===window.location.origin&&new URLSearchParams(window.location.search).get('embedded')==='1';}catch{}
function notifyParent(type){if(embedded)window.parent.postMessage({type},window.location.origin);}
function returnToNix(){if(returning)return;returning=true;cancelMotion();clear();if(embedded)notifyParent('entia-demo-exit');else window.location.assign('../#home');}
const M=window.EssenceDemo,canvas=/** @type {HTMLCanvasElement} */(document.querySelector('#game')),ctx=canvas.getContext('2d'),$=s=>document.querySelector(s);
let state=M.createTutorial(),images={},ready=false,paused=false,previous=0,width=0,height=0,scale=1,ox=0,oy=0,dpr=1,noticeId=0,messageUntil=0,raf=0,pointer=null,selectedInventory='life',hostSuspended=embedded,returning=false,hudDrawerOpen=false,inheritedScale=null,lastTouchWorld=-1000,floorReady=false;
let joystickPointer=null;
let motionStage=null,dialogKey='',beatUntil=0,guideHoldUntil=0,presentationNow=0,revealStart=-1,completeStart=-1;
const motionHandles=new Map();
let movementOrder=0;const keyboardOrder=new Map();
const keys=new Set(),touches=new Map(),worldTouches=new Set(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const camera={x:510,y:490};
const assets={'npc-movement':'npc/movement-idle-v4.png','npc-game':'npc/game-idle-v4.png','npc-bank':'npc/bank-idle-v4.png',hallCarpet:'hall-carpet.png',hallColumn:'hall-column.png',hallPortal:'hall-portal-straight.png',hero:'hero.png',rogue:'rogue.png',mage:'mage.png',grass:'grass.png',path:'path.png',stone:'stone.png',portal:'portal.png',bank:'banking-coffer.png',essence:'essence-pickup.png',spell:'apocalipsis_60.png'};
const floor=document.createElement('canvas');floor.width=1;floor.height=1;
function loadImage(name,file){return /** @type {Promise<void>} */(new Promise((resolve,reject)=>{let shared;try{shared=embedded&&window.parent.EntiaArtwork?.[name==='spell'?'apocalipsis':name];}catch{}if(shared){images[name]=shared;resolve();return;}const im=new Image();im.onload=async()=>{try{if(typeof createImageBitmap==='function'&&(name==='bank'||name==='essence')){const crop=/** @type {[number,number,number,number]} */(name==='bank'?[230,255,1075,555]:[300,230,480,1010]);const size=name==='bank'?[216,112]:[32,64];images[name]=await createImageBitmap(im,...crop,{resizeWidth:size[0],resizeHeight:size[1],resizeQuality:'pixelated'});im.onload=null;im.src='';}else images[name]=im;resolve();}catch{images[name]=im;resolve();}};im.onerror=()=>reject(Error(file));im.src='../assets/'+file;}));}
async function load(){ready=false;$('#retry').hidden=true;$('#curtain').hidden=false;$('#curtain-title').textContent='Opening the portal…';try{for(const [n,f] of Object.entries(assets))await loadImage(n,f);if(!hostSuspended&&state.phase!=='hallway')buildFloor();ready=true;$('#curtain').hidden=true;drawInventoryIcon();resize();if(!state.tutorial)showHelp(true);focusGame();notifyParent('entia-demo-ready');schedule();}catch(e){$('#curtain-title').textContent='The portal could not open';$('#curtain-text').textContent='An artwork file did not load. Please try again.';$('#retry').hidden=false;notifyParent('entia-demo-error');}}
function buildFloor(){if(floor.width!==M.WIDTH)floor.width=M.WIDTH;if(floor.height!==M.HEIGHT)floor.height=M.HEIGHT;const c=floor.getContext('2d');if(c.isContextLost?.())return;c.imageSmoothingEnabled=false;for(let y=0;y<M.HEIGHT;y+=M.TILE)for(let x=0;x<M.WIDTH;x+=M.TILE)c.drawImage(images.grass,x,y,M.TILE,M.TILE);c.save();c.beginPath();c.rect(128,384,864,96);c.rect(576,320,96,480);c.rect(128,480,96,224);c.clip();for(let y=0;y<M.HEIGHT;y+=M.TILE)for(let x=0;x<M.WIDTH;x+=M.TILE)c.drawImage(images.path,x,y,M.TILE,M.TILE);c.restore();for(let y=352;y<512;y+=M.TILE)for(let x=64;x<288;x+=M.TILE)c.drawImage(images.stone,x,y,M.TILE,M.TILE);const shade=c.createRadialGradient(580,450,100,580,450,780);shade.addColorStop(0,'#203a2610');shade.addColorStop(1,'#03120ed9');c.fillStyle=shade;c.fillRect(0,0,M.WIDTH,M.HEIGHT);floorReady=true;}

function resize(){if(hostSuspended)return;const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(2000000/Math.max(1,width*height)));if(canvas.width!==Math.round(width*dpr))canvas.width=Math.round(width*dpr);if(canvas.height!==Math.round(height*dpr))canvas.height=Math.round(height*dpr);updateView();schedule();}
function updateView(){const p=state.player;const hall=state.phase==='hallway';const baseScale=inheritedScale||window.WorldPhysics.presentationScale(window.innerWidth||width);scale=hall?Math.min(baseScale,Math.max(.35,(height-32)/320)):baseScale;camera.x=p.x;camera.y=hall?M.hallway.cameraY:p.y;ox=width/2-camera.x*scale;oy=height/2-camera.y*scale;}
function ellipse(x,y,rx,ry,color,line=false){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(line){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();}else{ctx.fillStyle=color;ctx.fill();}}
function text(s,x,y,color='#e6e4cc',size=13){ctx.font=`${size}px Inter, sans-serif`;ctx.textAlign='center';ctx.fillStyle='#07120f';ctx.fillText(s,x+1,y+2);ctx.fillStyle=color;ctx.fillText(s,x,y);}
function actor(a,body,player=false){const im=images[body];const stride=body==='mage'?32:64;const f=!body.startsWith('npc-')&&a.moving?1+Math.floor(a.gait/stride*7)%7:0;ellipse(a.x,a.y+1,16,5,'#00110cc0');if(player)ellipse(a.x,a.y+2,20,8,'#e8d491',true);ctx.drawImage(im,f*96,a.dir*160,96,160,Math.round(a.x-30),Math.round(a.y-99.375),60,100);}
function resourceBar(a,value,maxValue,yOffset=12,mana=false){const x=Math.round(a.x)-23,y=Math.round(a.y)+yOffset,fill=Math.round(42*Math.max(0,Math.min(1,value/maxValue)));ctx.fillStyle='#070b08';ctx.fillRect(x,y,46,8);ctx.fillStyle='#938053';ctx.fillRect(x+1,y+1,44,6);ctx.fillStyle=mana?'#102535':'#35121a';ctx.fillRect(x+2,y+2,42,4);ctx.fillStyle=mana?'#1687ba':'#b92b43';ctx.fillRect(x+2,y+2,fill,4);ctx.fillStyle=mana?'#72d4f1':'#ed7883';ctx.fillRect(x+2,y+2,fill,1);}
function drawDrop(drop){ellipse(drop.x,drop.y+10,10,4,'#00190f88');drawEssence(ctx,drop.x-8,drop.y-16,16,32);text(String(drop.amount),drop.x,drop.y-23,drop.owner==='player'?'#f4d595':'#bce8b2',12);}
function portal(){const frame=reduced.matches?0:Math.floor(state.time*10)%8;const p=M.gateway;ctx.save();ctx.shadowColor='#bddd66';ctx.shadowBlur=reduced.matches?0:22;ctx.drawImage(images.portal,(frame%4)*240,Math.floor(frame/4)*320,240,320,p.x-96,p.y-248,192,256);ctx.restore();text('RETURN TO NIX',p.x,p.y+32,'#d8e9b1',13);}
function draw(){if(!ready)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#091911';ctx.fillRect(0,0,width,height);const p=state.player;
 updateView();
 ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;if(state.phase==='hallway'){drawHallway();drawDestination();actor(p,window.EntiaCharacter?.get().body||'hero',true);return;}if(!floorReady)buildFloor();ctx.drawImage(floor,0,0);drawDestination();
 text('NIX REFUGE',164,590,'#b3bc9a',11);
 for(const e of state.enemies){if(state.phase!=='arena'||e.hp<=0)continue;if(e.wind>0){ellipse(e.x,e.y,70*(1-e.wind/.85),27*(1-e.wind/.85),'#e7966955');ellipse(e.x,e.y,70,27,'#f0a16a',true);}else ellipse(e.x,e.y+2,25,10,'#db9b6655',true);}
 // Scenery, drops, props and actors drawn in painter order; each kind carries only its own fields.
 const layers=/** @type {{type?:string,x?:number,y:number,sortY?:number,id?:string|number,w?:number,h?:number,body?:string,player?:boolean}[]} */([...M.scenery.map(s=>({...s,type:'scenery'})),...state.drops.map(d=>({...d,type:'drop',sortY:M.canPickup(state,d)?p.y+.1:d.y-.1})),{type:'portal',y:M.gateway.y},...(state.bankUnlocked?[{type:'bank',y:M.bankAt(state).y}]:[]),...(state.phase==='arena'&&state.tutorial?.stage!=='complete'?state.enemies.filter(e=>e.hp>0):[]),...(state.tutorial?.stage==='complete'?[{...M.guides[2],x:M.bankAt(state).x+64,y:M.bankAt(state).y}]:[]),{...p,body:window.EntiaCharacter?.get().body||'hero',player:true}]).sort((a,b)=>(a.sortY??a.y)-(b.sortY??b.y));
 for(const a of layers){if(a.type==='scenery')ctx.drawImage(images[a.id],a.x-a.w/2,a.y-a.h,a.w,a.h);else if(a.type==='drop')drawDrop(a);else if(a.type==='portal')portal();else if(a.type==='bank'){renderBank();}else actor(a,a.body,a.player);}
 if(state.phase==='arena'&&state.tutorial?.stage!=='complete')for(const e of state.enemies){if(e.hp<=0)continue;text(e.name,e.x,e.y-98,'#d9c79c',12);resourceBar(e,e.hp,e.maxHp);}
 for(const f of state.fx){const frame=Math.min(31,Math.floor(f.age*16));if(f.owner==='bind'||f.owner==='cleanse'){if(f.age<1.25){ctx.strokeStyle=f.owner==='bind'?'#adbaf0':'#d7dfbd';ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y-25,22+f.age*8,0,Math.PI*2);ctx.stroke();}}else if(f.owner==='melee'){if(f.age<.25)ellipse(f.x,f.y,20+f.age*30,8+f.age*15,'#e8d5a7',true);}else if(reduced.matches){ellipse(f.x,f.y,35,20,'#e8d5a7',true);}else ctx.drawImage(images.spell,(frame%4)*273,Math.floor(frame/4)*243,273,243,f.x-73,f.y-90,146,130);}
  resourceBar(p,p.hp,100);resourceBar(p,p.mana,100,22,true);
  const playerName=window.EntiaCharacter?.get().name;if(playerName)text(playerName,p.x,p.y-102,'#ded2a1',12);
  const aim=aimPoint();
  if(aim&&state.armed){const valid=Math.hypot(aim.x-p.x,aim.y-p.y)<=270&&M.lineClear(p,aim);ellipse(aim.x,aim.y,34,17,valid?'#e4d490':'#dd8068',true);ctx.strokeStyle=valid?'#e4d490':'#dd8068';ctx.beginPath();ctx.moveTo(aim.x-10,aim.y);ctx.lineTo(aim.x+10,aim.y);ctx.moveTo(aim.x,aim.y-9);ctx.lineTo(aim.x,aim.y+9);ctx.stroke();}
  for(const e of state.enemies)if(e.wind>0&&e.kind==='ranged'&&e.aim){ellipse(e.aim.x,e.aim.y,42,20,'#f1a373',true);}
 if(p.immobilized>0)text('IMMOVILIZED',p.x,p.y-130,'#b4c9ed',11);
 for(const e of state.enemies)if(e.hp>0&&e.immobilized>0)text('IMMOVILIZED',e.x,e.y-115,'#b4c9ed',10);
 if(state.carried){text(`✦ ${state.carried}`,p.x,p.y-112,'#f3d586',15);}
 for(const particle of state.streamParticles){const t=particle.age/.55,ease=1-(1-t)*(1-t),x=particle.x+(M.bankAt(state).x-particle.x)*ease,y=particle.y+(M.bankAt(state).y-25-particle.y)*ease-Math.sin(t*Math.PI)*(12+particle.offset*4);ctx.globalAlpha=1-t*.5;drawEssence(ctx,x-3,y-6,6,12);ctx.globalAlpha=1;}
 if(state.meditating){ellipse(p.x,p.y,26,11,'#82bddf',true);text('MEDITATING',p.x,p.y-104,'#a2d1e4',11);}
 for(const hit of state.damageTexts){ctx.globalAlpha=1-hit.age; text('!'+hit.amount+'!',hit.x,hit.y-105-hit.age*28,'#ff5252',18);ctx.globalAlpha=1;}
 ctx.setTransform(dpr,0,0,dpr,0,0);if(state.flash&&!reduced.matches){ctx.fillStyle=`rgba(200,230,158,${state.flash*.35})`;ctx.fillRect(0,0,width,height);}
}
function ui(){
 syncGuide();
 const p=state.player;$('#health-fill').style.width=p.hp+'%';$('#health').textContent=Math.ceil(p.hp)+' / 100';$('#mana-fill').style.width=p.mana+'%';$('#mana').textContent=Math.floor(p.mana)+' / 100';$('#mobile-vitals').textContent='Life '+Math.ceil(p.hp)+' · Mana '+Math.floor(p.mana);$('#carried').textContent=state.carried;$('#autopot').checked=state.autopotEnabled;$('#life-stock').textContent=state.lifePotions;$('#mana-stock').textContent=state.manaPotions;$('#life-inventory-count').textContent=state.lifePotions;$('#mana-inventory-count').textContent=state.manaPotions;$('#life-potion').disabled=!state.lifePotions;$('#mana-potion').disabled=!state.manaPotions;$('#macro-life').disabled=!state.lifePotions;$('#macro-mana').disabled=!state.manaPotions;$('#health-fill').classList.toggle('potion-used',state.lifePulse>0);$('#mana-fill').classList.toggle('potion-used',state.manaPulse>0);$('#secured').textContent=state.secured;$('#secured-fill').style.width=Math.min(100,state.secured/60*100)+'%';
 $('#chapter').textContent='THE VEIL / TRAINING GROUNDS';$('#objective-label').textContent=state.won?'THE LOOP IS YOURS':'SECURE 60 ESSENCE';
 $('#objective').textContent=state.won?'Goal complete':state.carried?'Return with your essence':state.drops.length?'Pick up the crystal':'The Veil';
 $('#hint').textContent=state.carried?'Stay near the bank to secure your essence. Fall and you drop what you carry.':state.drops.length?'Stand on a crystal and press Q. Your dropped essence can be recovered.':`Prepare Apocalipsis, then point and click a rival. ${state.secured} / 60 secured.`;
 const near=M.nearBank(state),gate=M.nearGate(state),item=state.drops.some(d=>M.canPickup(state,d));
 $('.interact-area').hidden=!(near||gate||item||state.bank);
 $('#interact').disabled=paused||(near&&!item);
 $('#deposit-status').textContent=!state.bankUnlocked?'Bank locked · pick up your first crystal':near&&state.carried?(state.bank>=1?'Depositing essence…':'Stay near the bank to deposit'):state.carried?'Carrying '+state.carried+' · bank south of the portal':'Bank unlocked · '+state.secured+' essence secured';
 $('#interact').innerHTML=item?'Pick up essence <kbd>Q</kbd>':state.bank>=1?'Drawing in essence…':state.bank?'Stay nearby…':near?'Essence bank · automatic transfer':'Return to Nix <kbd>E</kbd>';
 $('#bank-progress').hidden=!state.bank;$('#bank-progress span').style.width=(state.bank<1?state.bank*100:Math.max(0,(1-state.carried/Math.max(1,state.bankAmount))*100))+'%';$('#cast').disabled=paused;$('#meditate').setAttribute('aria-pressed',String(state.meditating));$('#meditate').textContent=state.meditating?'Meditating… N to stop':'Meditate · N';$('#prepare-spell').disabled=paused;$('#prepare-spell').textContent=state.armed?'Cancel aim':'Prepare';$('#prepare-spell').setAttribute('aria-pressed',String(state.armed));$('#cast').setAttribute('aria-pressed',String(state.armed));$('#target-help').dataset.armed=String(state.armed);$('#target-help').textContent=state.armed?M.spells[state.selectedSpell].name+' ready · '+(state.selectedSpell==='remover'?'click yourself or a character':'click a rival')+' · Esc cancels':'Click to walk · C to aim · Q to pick up';$('#spell-status').textContent=state.armed?'Ready: click your target':M.spells[state.selectedSpell].name+' · '+M.spells[state.selectedSpell].mana+' mana';$('#inventory-count').textContent=state.carried;$('#essence-slot').disabled=state.carried===0;$('#item-description').textContent=selectedInventory==='essence'?state.carried+' carried essence':selectedInventory==='life'?'Life potion · restores 40':'Mana potion · restores 50';$('#use-selected').disabled=selectedInventory==='essence'||paused;canvas.style.cursor=state.armed?'crosshair':'pointer';$('#cast').style.opacity=state.cooldown>0?'.55':'1';

 tutorialUI();
 if(state.noticeId!==noticeId){noticeId=state.noticeId;$('#message').textContent=state.notice;messageUntil=performance.now()+5000;}$('#message').classList.toggle('visible',performance.now()<messageUntil);
}
function input(){if(returning||presentationNow<beatUntil||hudDrawerOpen||$('#help-dialog').open||$('#character-dialog').open||!!state.tutorial?.dialog)return {x:0,y:0};let key=[...keys].filter(k=>k!==' ').at(-1),order=keyboardOrder.get(key)||0;for(const held of touches.values())if(held.key&&held.order>=order){key=held.key;order=held.order;}return key==='d'||key==='arrowright'?{x:1,y:0}:key==='a'||key==='arrowleft'?{x:-1,y:0}:key==='w'||key==='arrowup'?{x:0,y:-1}:key==='s'||key==='arrowdown'?{x:0,y:1}:{x:0,y:0};}
function aimPoint(){if(!pointer)return null;const point={x:state.player.x+(pointer.x-width/2)/scale,y:(state.phase==='hallway'?M.hallway.cameraY:state.player.y)+(pointer.y-height/2)/scale};const hit=state.enemies.filter(e=>e.hp>0&&Math.abs(e.x-point.x)<28&&point.y>=e.y-88&&point.y<=e.y+8).sort((a,b)=>b.y-a.y)[0];if(state.selectedSpell==='remover'&&Math.abs(point.x-state.player.x)<28&&point.y>=state.player.y-88&&point.y<=state.player.y+8)return {x:state.player.x,y:state.player.y,self:true};return hit?{x:hit.x,y:hit.y,enemyId:hit.name}:point;}
function prepareSpell(){if(!ready||paused||presentationNow<beatUntil||state.phase==='hallway'||state.tutorial?.stage==='complete')return;setHudDrawer(false);M.cancelWalk(state);state.armed=!state.armed;if(!state.armed){M.tell(state,'Aiming cancelled. Click to walk.');focusGame();return;}M.tell(state,M.spells[state.selectedSpell].name+' ready. '+(state.selectedSpell==='remover'?'Click yourself or another character.':'Point at a rival and click.')+' Esc cancels.');focusGame();}
function castAtPointer(){const point=aimPoint();if(point)M.cast(state,point);else M.tell?.(state,'Point at the world to aim.');}
function interact(){const action=M.interact(state);if(action==='exit')returnToNix();else if(action==='talk'){clear();syncGuide();}else if(action==='bank')M.tell(state,'Stay near the bank. It draws in your carried essence automatically.');}

function tick(now){presentationNow=now;raf=0;if(hostSuspended)return;const dt=Math.min((now-previous)/1000||0,.04);previous=now;if(ready&&!paused&&now>=beatUntil&&!document.hidden&&!returning&&!hudDrawerOpen&&!$('#character-dialog').open){M.update(state,dt,input());if(state.phase==='arena'&&Math.abs(state.player.x-M.gateway.x)<22&&Math.abs(state.player.y-M.gateway.y)<20)returnToNix();}syncMotion(now);draw();ui();if(ready&&!paused&&(!state.tutorial?.dialog||guideHoldUntil>now)&&!(state.tutorial?.stage==='complete'&&!state.streamParticles.length&&guideHoldUntil<=now)&&!document.hidden&&!hostSuspended)schedule();}
function schedule(){if(!raf&&!document.hidden&&!hostSuspended)raf=requestAnimationFrame(tick);}
function clear(){M.cancelWalk(state);keys.clear();keyboardOrder.clear();touches.clear();syncDpad();worldTouches.clear();M.clearPotionKeys(state);}
function showHelp(first=false){if(!ready)return;if($('#guide-dialog').open){$('#guide-dialog').close();dialogKey='';}setHudDrawer(false);clear();paused=true;$('#help-title').textContent=first?'Welcome to the Veil':'Paused';$('#resume').textContent=first?'Enter the Veil':'Resume';$('#pause').setAttribute('aria-pressed','true');if(!$('#help-dialog').open)$('#help-dialog').showModal();schedule();}
function hideHelp(){if($('#help-dialog').open)$('#help-dialog').close();paused=false;$('#pause').setAttribute('aria-pressed','false');document.body.classList.add('portal-arrival');focusGame();previous=performance.now();schedule();}
function togglePause(value=!paused){if(!ready)return;if(value)showHelp();else hideHelp();}
function drawInventoryIcon(){const c=$('#inventory-crystal').getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,36,44);drawEssence(c,8,0,20,42);}
function selectInventory(kind){selectedInventory=kind;for(const [id,value] of [['essence-slot','essence'],['life-potion','life'],['mana-potion','mana']]){const selected=value===kind;$('#'+id).classList.toggle('selected',selected);$('#'+id).setAttribute('aria-pressed',String(selected));}}
function useSelected(){setHudDrawer(false);if(!paused&&selectedInventory!=='essence')M.usePotion(state,selectedInventory);focusGame();}

const accepted=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'];document.addEventListener('keydown',e=>{if(returning||presentationNow<beatUntil||$('#help-dialog').open||$('#character-dialog').open||!!state.tutorial?.dialog)return;if(e.key==='Escape'&&hudDrawerOpen){setHudDrawer(false);return;}if(e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();if(key==='escape'&&state.armed){state.armed=false;M.tell(state,'Spell cancelled.');return;}if(key==='p'||key==='escape'){e.preventDefault();if(!e.repeat)togglePause();return;}if(/** @type {Element} */(e.target).closest('input,select,textarea'))return;if((key==='f1'||key==='f2')&&!e.repeat&&ready&&!paused){e.preventDefault();M.pressPotion(state,key,key==='f1'?'life':'mana');return;}if(/** @type {Element} */(e.target).closest('button,a'))return;if(accepted.includes(key)){e.preventDefault();if(ready&&!paused&&!e.repeat){keys.delete(key);keys.add(key);keyboardOrder.set(key,++movementOrder);}}if(['1','2','3'].includes(key)&&!e.repeat&&ready&&!paused){e.preventDefault();selectSpell(['apocalipsis','inmovilizar','remover'][Number(key)-1]);prepareSpell();}if(key==='c'&&!e.repeat&&ready&&!paused){e.preventDefault();prepareSpell();}if(key===' '&&!e.repeat&&ready&&!paused){e.preventDefault();M.melee(state);}if(key==='q'&&!e.repeat&&ready&&!paused){if(!M.pickup(state,22))M.tell(state,'Stand on a dropped crystal, then press Q.');}if(key==='n'&&!e.repeat&&ready&&!paused){clear();M.meditate(state);}if(key==='u'&&!e.repeat&&ready&&!paused)useSelected();if(key==='e'&&!e.repeat&&ready&&!paused)interact();});document.addEventListener('keyup',e=>{const key=e.key.toLowerCase();keys.delete(key);keyboardOrder.delete(key);if(key==='f1'||key==='f2'){e.preventDefault();M.releasePotion(state,key);}});
const mapping={up:'w',left:'a',down:'s',right:'d'};
function syncDpad(){if(joystickPointer!==null&&!touches.has(joystickPointer)){joystickPointer=null;$('#joystick-thumb').style.transform='translate(0px,0px)';$('#joystick').dataset.active='false';}for(const button of /** @type {NodeListOf<HTMLButtonElement>} */(document.querySelectorAll('[data-dir]')))button.dataset.pressed=String([...touches.values()].some(p=>p.key===mapping[button.dataset.dir]));}
function setDirection(id,key,type){const previous=touches.get(id);if(previous?.key===key)return;touches.set(id,{key,pointerType:type||previous?.pointerType||'mouse',order:++movementOrder});syncDpad();}
function releaseDirection(event){if(touches.delete(event.pointerId))syncDpad();}
function directionAt(x,y){for(const button of /** @type {NodeListOf<HTMLButtonElement>} */(document.querySelectorAll('[data-dir]'))){const r=button.getBoundingClientRect();if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return mapping[button.dataset.dir];}return null;}
for(const button of /** @type {NodeListOf<HTMLButtonElement>} */(document.querySelectorAll('[data-dir]'))){
 button.addEventListener('pointerdown',e=>{e.preventDefault();if(e.button!==undefined&&e.button!==0)return;if(paused||!ready||hudDrawerOpen||$('#character-dialog').open)return;document.getSelection?.()?.removeAllRanges();touches.delete(e.pointerId);setDirection(e.pointerId,mapping[button.dataset.dir],e.pointerType);try{button.setPointerCapture(e.pointerId);}catch{}});
 button.addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;if(e.pointerType==='mouse'&&e.buttons===0){releaseDirection(e);return;}e.preventDefault();const direction=directionAt(e.clientX,e.clientY);
  // A captured hold survives thumb drift and the gaps between arrows until release.
  if(direction)setDirection(e.pointerId,direction,e.pointerType);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,releaseDirection);
}
const joystick=$('#joystick'),joystickThumb=$('#joystick-thumb');
function steerJoystick(e){const r=joystick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,distance=Math.hypot(dx,dy),limit=r.width*.3,ratio=distance?Math.min(1,limit/distance):0;joystickThumb.style.transform=`translate(${dx*ratio}px,${dy*ratio}px)`;let key=null;if(distance>9){const held=touches.get(e.pointerId)?.key,horizontal=held==='a'||held==='d',vertical=held==='w'||held==='s';const xAxis=Math.abs(dx)>Math.abs(dy)*1.15?true:Math.abs(dy)>Math.abs(dx)*1.15?false:horizontal||(!vertical&&Math.abs(dx)>=Math.abs(dy));key=xAxis?(dx>0?'d':'a'):(dy>0?'s':'w');}setDirection(e.pointerId,key,e.pointerType);}
joystick.addEventListener('pointerdown',e=>{e.preventDefault();if((e.button!==undefined&&e.button!==0)||joystickPointer!==null||paused||!ready||hudDrawerOpen||$('#character-dialog').open)return;joystickPointer=e.pointerId;joystick.dataset.active='true';try{joystick.setPointerCapture(e.pointerId);}catch{}steerJoystick(e);});
joystick.addEventListener('pointermove',e=>{if(e.pointerId!==joystickPointer)return;e.preventDefault();if(e.pointerType==='mouse'&&e.buttons===0){releaseDirection(e);return;}steerJoystick(e);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,releaseDirection);
for(const type of ['pointerup','pointercancel'])window.addEventListener(type,releaseDirection,true);
for(const type of ['touchend','touchcancel'])window.addEventListener(type,event=>{if(/** @type {TouchEvent} */(event).touches.length===0){for(const [id,held] of touches)if(held.pointerType==='touch')touches.delete(id);syncDpad();}},true);
for(const type of ['touchstart','touchmove'])$('.dpad').addEventListener(type,event=>{if(event.cancelable)event.preventDefault();},{passive:false});
window.addEventListener('pagehide',clear);window.addEventListener('orientationchange',clear);
bindTap($('#cast'),prepareSpell);$('#prepare-spell').onclick=prepareSpell;$('#strike').onclick=()=>{if(ready&&!paused&&presentationNow>=beatUntil)M.melee(state);focusGame();};$('#meditate').onclick=()=>{if(ready&&!paused){clear();M.meditate(state);}focusGame();};
bindTap($('#interact'),()=>{if(ready&&!paused)interact();focusGame();});$('#pause').onclick=()=>togglePause();$('#resume').onclick=hideHelp;$('#restart').onclick=()=>{if(!ready)return;state=M.createTutorial();resetMotion();returning=false;pointer=null;noticeId=0;messageUntil=0;selectSpell('apocalipsis');hideHelp();};$('#retry').onclick=load;
function locatePointer(e){const rect=canvas.getBoundingClientRect();pointer={x:e.clientX-rect.left,y:e.clientY-rect.top};}
canvas.addEventListener('pointermove',locatePointer);
function worldClick(e){const bounds=canvas.getBoundingClientRect();if(e.button!==undefined&&e.button!==0)return;if(e.clientX<bounds.left||e.clientX>bounds.left+bounds.width||e.clientY<bounds.top||e.clientY>bounds.top+bounds.height)return;if(!ready||paused||presentationNow<beatUntil||hudDrawerOpen||$('#help-dialog').open||$('#character-dialog').open||state.tutorial?.dialog)return;focusGame();locatePointer(e);const world={x:state.player.x+(pointer.x-width/2)/scale,y:(state.phase==='hallway'?M.hallway.cameraY:state.player.y)+(pointer.y-height/2)/scale};
 if(state.armed){M.cancelWalk(state);castAtPointer();ui();schedule();return;}
 if(state.phase==='hallway'){const g=M.guides.find(g=>Math.abs(world.x-g.x)<28&&world.y>=g.y-96&&world.y<=g.y+8);if(g){if(Math.hypot(g.x-state.player.x,g.y-state.player.y)<100){M.cancelWalk(state);M.talk(state,g.id);clear();syncGuide();}else M.walkTo(state,{x:g.x,y:464},g.id);schedule();return;}}
 if(state.phase==='hallway'&&world.x>=464&&state.tutorial.seen.length<3)M.tell(state,'Meet all three guides before entering the arena.');
 if(state.bankUnlocked&&Math.abs(world.x-M.bankAt(state).x)<60&&world.y>M.bankAt(state).y-55&&world.y<M.bankAt(state).y+14){const b=M.bankAt(state);M.walkTo(state,{x:b.x,y:b.y+64});}else M.walkTo(state,world);schedule();
}
canvas.addEventListener('click',e=>{if(e.pointerType==='touch'||e.sourceCapabilities?.firesTouchEvents||performance.now()-lastTouchWorld<800)return;worldClick(e);});
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){e.preventDefault();canvas.setPointerCapture(e.pointerId);worldTouches.add(e.pointerId);locatePointer(e);}});
canvas.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){e.preventDefault();if(!worldTouches.delete(e.pointerId))return;lastTouchWorld=performance.now();worldClick(e);}});
canvas.addEventListener('pointercancel',e=>worldTouches.delete(e.pointerId));canvas.addEventListener('lostpointercapture',e=>worldTouches.delete(e.pointerId));
window.addEventListener('blur',()=>{clear();if(ready&&!paused)togglePause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();if(ready&&!paused)togglePause(true);if(raf)cancelAnimationFrame(raf);raf=0;}else recoverDemoScene();});window.addEventListener('resize',resize);resize();load();

$('#hud-help').onclick=()=>showHelp();$('#close-help').onclick=hideHelp;$('#help-dialog').addEventListener('cancel',e=>{e.preventDefault();hideHelp();});
function setHudDrawer(open){if(open)clear();hudDrawerOpen=open;$('#hud-scrim').hidden=!open;document.body.classList.toggle('hud-open',open);$('#toggle-hud').setAttribute('aria-expanded',String(open));}
$('#toggle-hud').onclick=()=>setHudDrawer(!hudDrawerOpen);$('#hud-scrim').onclick=()=>setHudDrawer(false);$('#return-home').onclick=returnToNix;
$('#essence-slot').onclick=()=>selectInventory('essence');$('#life-potion').onclick=()=>selectInventory('life');$('#mana-potion').onclick=()=>selectInventory('mana');$('#life-potion').ondblclick=()=>{selectInventory('life');useSelected();};$('#mana-potion').ondblclick=()=>{selectInventory('mana');useSelected();};$('#use-selected').onclick=useSelected;
$('#autopot').addEventListener('change',e=>{state.autopotEnabled=e.target.checked;});$('#selected-spell').onclick=()=>focusGame();$('#selected-spell').ondblclick=prepareSpell;bindTap($('#macro-spell'),prepareSpell);
for(const kind of ['life','mana']){const button=$('#macro-'+kind),key='pointer-'+kind;button.addEventListener('pointerdown',e=>{e.preventDefault();if(paused||!ready)return;focusGame();button.setPointerCapture(e.pointerId);M.pressPotion(state,key,kind);});button.addEventListener('pointerup',e=>{e.preventDefault();M.releasePotion(state,key);});button.addEventListener('pointercancel',()=>M.clearPotionKeys(state));button.addEventListener('lostpointercapture',()=>{state.heldPotions=state.heldPotions.filter(p=>p.key!==key);});button.addEventListener('click',e=>{if(e.detail===0&&!paused)M.usePotion(state,kind);});}

document.addEventListener('click',e=>{const link=/** @type {Element} */(e.target).closest('a[href="../#home"]');if(link&&embedded&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();returnToNix();}});
window.addEventListener('message',e=>{if(!embedded||e.source!==window.parent||e.origin!==window.location.origin)return;if(Number.isFinite(e.data?.presentationScale)&&e.data.presentationScale>=.25&&e.data.presentationScale<=3){inheritedScale=e.data.presentationScale;resize();}if(e.data?.type==='entia-demo-activate'){hostSuspended=false;if(state.tutorial&&!$('#help-dialog').open)paused=false;recoverDemoScene();previous=performance.now();focusGame();schedule();}else if(e.data?.type==='entia-demo-pause'){hostSuspended=true;paused=true;cancelMotion();clear();if(raf)cancelAnimationFrame(raf);raf=0;floor.width=1;floor.height=1;floorReady=false;canvas.width=1;canvas.height=1;}else if(e.data?.type==='entia-demo-resume'){hostSuspended=false;if(state.phase==='arena'&&(returning||M.nearGate(state))){state.player.x=M.gateway.x+128;state.player.y=M.gateway.y;state.player.step=null;}returning=false;recoverDemoScene();hideHelp();}});

for(const surface of [canvas,$('#macro-life'),$('#macro-mana'),$('#macro-spell')])surface.addEventListener('contextmenu',event=>event.preventDefault());

window.EntiaCharacter?.mount({assets:'../assets/',onChange:()=>schedule(),onOpen:()=>{clear();state.armed=false;setHudDrawer(false);},onClose:()=>{focusGame();previous=performance.now();schedule();}});

function selectSpell(id){if(!M.spells[id])return;state.selectedSpell=id;state.armed=false;for(const button of /** @type {NodeListOf<HTMLButtonElement>} */(document.querySelectorAll('[data-spell]')))button.setAttribute('aria-selected',String(button.dataset.spell===id));$('#mobile-spell').value=id;ui();}
for(const button of /** @type {NodeListOf<HTMLButtonElement>} */(document.querySelectorAll('[data-spell]'))){button.onclick=()=>selectSpell(button.dataset.spell);button.ondblclick=()=>{selectSpell(button.dataset.spell);prepareSpell();};}
$('#mobile-spell').addEventListener('change',e=>{selectSpell(e.target.value);prepareSpell();});
bindTap($('#mobile-strike'),()=>{if(ready&&!paused&&presentationNow>=beatUntil)M.melee(state);});
for(const surface of [canvas,...document.querySelectorAll('.mobile-controls,.macrobar,.stage button')]){surface.addEventListener('contextmenu',e=>e.preventDefault());surface.addEventListener('selectstart',e=>e.preventDefault());surface.addEventListener('dragstart',e=>e.preventDefault());}

function recoverDemoScene(){cancelMotion();clear();if(hostSuspended){floorReady=false;return;}floorReady=false;floor.width=state.phase==='hallway'?1:M.WIDTH;floor.height=state.phase==='hallway'?1:M.HEIGHT;previous=performance.now();if(raf)cancelAnimationFrame(raf);raf=0;resize();schedule();}
window.addEventListener('pageshow',recoverDemoScene);
for(const surface of [canvas,floor]){surface.addEventListener('contextlost',event=>{event.preventDefault();floorReady=false;if(raf)cancelAnimationFrame(raf);raf=0;});surface.addEventListener('contextrestored',recoverDemoScene);}
for(const surface of document.querySelectorAll('header,aside,button'))for(const type of ['selectstart','dragstart','contextmenu'])surface.addEventListener(type,event=>event.preventDefault());

// Secondary touch pointers do not reliably synthesize clicks while a D-pad is held.
function bindTap(button,action){let active=null,lastPointer=-1000;button.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;e.preventDefault();active=e.pointerId;button.setPointerCapture(e.pointerId);});button.addEventListener('pointerup',e=>{e.preventDefault();if(active!==e.pointerId)return;active=null;lastPointer=performance.now();if(!button.disabled)action();});for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,()=>{active=null;});button.addEventListener('click',(e={detail:0})=>{e.preventDefault?.();if(e.detail===0||performance.now()-lastPointer>800)action();});}

for(const type of ['contextmenu','selectstart'])$('.dpad').addEventListener(type,e=>{e.preventDefault();touches.clear();syncDpad();});

// The opaque control deck is a sibling of the map, never a transparent canvas overlay.
for(const type of ['pointerdown','pointerup','click','dblclick'])$('#control-deck').addEventListener(type,event=>event.stopPropagation());
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe($('#playfield'));

function focusGame(){if(!ready||paused||hostSuspended||returning||document.hidden||hudDrawerOpen||state.tutorial?.dialog||$('#help-dialog').open||$('#character-dialog').open)return;if(!matchMedia('(pointer: coarse)').matches)canvas.focus({preventScroll:true});}

// The hallway, bank reveal and completion share this canvas and asset set.
function drawHallway(){
 const t=state.tutorial;
 // The extension is solid masonry, not extra walkable floor.
 const left=Math.floor((-ox/scale)/96)*96,right=(width-ox)/scale;
 const top=Math.floor((-oy/scale)/48)*48,bottom=(height-oy)/scale;
 hallWall(left,top,right-left,bottom-top);
 const h=M.hallway,f=h.floor,c=h.carpet;
 ctx.save();ctx.beginPath();ctx.rect(f.x,f.y,f.w,f.h);ctx.clip();
 for(let y=f.y;y<f.y+f.h;y+=32)for(let x=f.x;x<f.x+f.w;x+=32){ctx.drawImage(images.stone,x,y,32,32);ctx.fillStyle='#20242a20';ctx.fillRect(x,y,32,32);}
 ctx.restore();
 // Wall faces are outside the floor rectangle. No cap slices through a column base.
 ctx.fillStyle='#5d6063';ctx.fillRect(f.x-12,f.y-10,f.w+24,4);ctx.fillStyle='#34383e';ctx.fillRect(f.x-12,f.y-6,f.w+24,6);
 ctx.fillStyle='#55585b';ctx.fillRect(f.x-12,f.y+f.h,f.w+24,4);ctx.fillStyle='#2c3035';ctx.fillRect(f.x-12,f.y+f.h+4,f.w+24,12);
 ctx.fillStyle='#5c5e60';ctx.fillRect(f.x-12,f.y-10,4,f.h+26);ctx.fillRect(f.x+f.w+8,f.y-10,4,f.h+26);ctx.fillStyle='#34373c';ctx.fillRect(f.x-8,f.y,8,f.h);ctx.fillRect(f.x+f.w,f.y,8,f.h);
 ctx.drawImage(images.hallCarpet,c.x,c.y,c.w,c.h);
 for(const x of h.columns)ctx.drawImage(images.hallColumn,x-28,h.columnY,56,132);
 for(let i=0;i<M.guides.length;i++){const g=M.guides[i],seen=t.seen.includes(g.id),active=t.dialog?.id===g.id;ellipse(g.x,g.y+2,25,9,active?'#ddbd8266':seen?'#83b29244':'#ba986522');actor(g,g.body);text(g.name,g.x,g.y-108,active?'#ffe9b0':'#d2c8a7',12);text(seen?'✓  LEARNED':['01 · MOVE','02 · FIGHT','03 · SECURE'][i],g.x,g.y+23,seen?'#9bcaaa':'#b3a27b',10);}
 const unlocked=t.seen.length===3;
 ctx.save();ctx.globalAlpha=1;ctx.drawImage(images.hallPortal,h.portal.x,h.portal.y,h.portal.w,h.portal.h);ctx.restore();
 if(unlocked&&!reduced.matches){for(let i=0;i<6;i++){const y=392+(i*23+state.time*20)%136;ctx.fillStyle='#a2dbbd88';ctx.fillRect(h.exitX-1,y,2,3);}}
 text(unlocked?'ENTER THE ARENA →':'THE VEIL',h.exitX,568,unlocked?'#c5e4b1':'#9d916e',11);

}
function syncGuide(){const t=state.tutorial,d=$('#guide-dialog');if(!t?.dialog){dialogKey='';if(d.open)d.close();return;}if(guideHoldUntil>presentationNow||paused||hostSuspended||document.hidden||$('#help-dialog').open||$('#character-dialog').open)return;$('#guide-name').textContent=t.dialog.name;$('#guide-title').textContent=t.dialog.title;$('#guide-text').textContent=t.dialog.lines[t.page];$('#guide-step').textContent=(t.page+1)+' / '+t.dialog.lines.length;$('#guide-meter').style.width=((t.page+1)/t.dialog.lines.length*100)+'%';$('#guide-next').textContent=t.page===t.dialog.lines.length-1?(t.dialog.id==='final'?'Finish':'Understood'):'Continue';if(!d.open){clear();d.showModal();}const key=t.dialog.id+':'+t.page;if(key!==dialogKey){dialogKey=key;paintPortrait(t.dialog.id);animateGuide(t.page===0);}}
function tutorialUI(){const t=state.tutorial;if(!t)return;const hall=state.phase==='hallway',done=t.stage==='complete';
 $('#chapter').textContent=hall?'THE VEIL / FIRST STEPS':done?'THE VEIL / TUTORIAL FINISHED':'THE VEIL / ARENA';
 $('#objective-label').textContent=hall?'MEET YOUR GUIDES':done?'TUTORIAL FINISHED':t.bankRevealed?'BANK YOUR ESSENCE':'FIGHT TWO RIVALS';
 $('#objective').textContent=hall?t.seen.length+' / 3 guides met':done?'Your essence is secure':t.bankRevealed?'The bank is nearby':Math.min(2,state.kills)+' / 2 rivals defeated';
 $('#hint').textContent=hall?'Click the carpet or use movement keys. Each guide speaks as you reach them.':done?'The full-match rules are provisional. Replay, review them or return to Nix.':t.bankRevealed?'Pick up crystals with Q. Follow BANK and stay nearby until your carried essence is secured.':'Prepare, aim and cast. Pick up crystals with Q or Pick up.';
 $('#deposit-status').textContent=hall?'Safe hallway · learn at your pace':done?'Tutorial complete · '+state.secured+' essence secured':!t.bankRevealed?'Bank sealed · opens after two defeats (or a short fallback timer)':state.carried?'Carrying '+state.carried+' · follow BANK':'Bank revealed · collect a crystal to deposit';
 const endPanel=$('#tutorial-end'),endHidden=!done||!!t.dialog,wasHidden=endPanel.hidden;endPanel.hidden=endHidden;if(wasHidden&&!endHidden)motion(endPanel,[{opacity:0,transform:'translate(-50%,10px)'},{opacity:1,transform:'translate(-50%,0)'}],{duration:500});updateJourney(t);
 if(hall){const g=M.nearGuide(state);$('.interact-area').hidden=!g;$('#interact').disabled=!g;$('#interact').textContent=g?'Talk to '+g.name+' · E':'Talk';}
 $('#cast').disabled=paused||hall||done;$('#prepare-spell').disabled=paused||hall||done;
 if(t.bankRevealed&&!done){const b=M.bankAt(state),dx=b.x-state.player.x,dy=b.y-state.player.y;$('#objective').textContent='BANK '+(Math.abs(dx)>Math.abs(dy)?(dx>0?'→':'←'):(dy>0?'↓':'↑'))+' · '+Math.round(Math.hypot(dx,dy)/32)+' tiles';}
}
$('#guide-next').onclick=()=>{M.nextGuide(state);syncGuide();tutorialUI();if(!state.tutorial?.dialog)focusGame();previous=performance.now();schedule();};
$('#guide-dialog').addEventListener('cancel',event=>{event.preventDefault();});
$('#tutorial-rules').onclick=()=>{M.talk(state,'final');syncGuide();};
$('#tutorial-replay').onclick=()=>{state=M.createTutorial();resetMotion();returning=false;pointer=null;noticeId=0;clear();syncGuide();hideHelp();};
$('#tutorial-home').onclick=returnToNix;

function drawEssence(c,x,y,w,h){const im=images.essence;c.drawImage(im,...(im.width===32?[0,0,32,64]:[300,230,480,1010]),x,y,w,h);}
function drawBank(c,x,y,w,h){const im=images.bank;c.drawImage(im,...(im.width===216?[0,0,216,112]:[230,255,1075,555]),x,y,w,h);}

// Anime.js-inspired sequencing, stagger and easing with the browser's native animation API.
// Every effect is bounded and cancelled on suspension/replay; no new RAF or snapshot canvas.
function motion(element,keyframes,options={}){if(!element||reduced.matches||typeof element.animate!=='function')return;motionHandles.get(element)?.cancel();const a=element.animate(keyframes,{duration:420,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards',...options});motionHandles.set(element,a);a.onfinish=()=>{if(motionHandles.get(element)===a)motionHandles.delete(element);};}
function cancelMotion(){for(const a of motionHandles.values())a.cancel();motionHandles.clear();beatUntil=0;guideHoldUntil=0;$('#chapter-cue').hidden=true;}
function resetMotion(){cancelMotion();motionStage=null;dialogKey='';revealStart=-1;completeStart=-1;}
function chapterCue(kicker,title,detail,now){const panel=$('#chapter-cue');$('#cue-kicker').textContent=kicker;$('#cue-title').textContent=title;$('#cue-detail').textContent=detail;panel.hidden=false;if(reduced.matches){panel.hidden=true;beatUntil=0;return;}beatUntil=now+850;
 if(typeof panel.animate!=='function'){panel.hidden=true;return;}
 motion(panel,[{opacity:1},{opacity:1,offset:.48},{opacity:0}],{duration:1000,easing:'ease-out'});
 for(const [i,id] of ['#cue-kicker','#cue-title','#cue-detail'].entries())motion($(id),[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:500,delay:i*90});
 const handle=motionHandles.get(panel);if(handle)handle.onfinish=()=>{motionHandles.delete(panel);panel.hidden=true;if(guideHoldUntil){guideHoldUntil=0;if(!paused&&!hostSuspended&&!document.hidden&&!$('#help-dialog').open&&!$('#character-dialog').open){syncGuide();schedule();}}};
}
function syncMotion(now){const t=state.tutorial;if(!t)return;const key=t.stage;if(key===motionStage)return;const old=motionStage;motionStage=key;if(key==='hallway'&&old===null){motion($('.objective'),[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:650});for(let i=0;i<4;i++)motion($('#journey-'+i),[{opacity:0},{opacity:1}],{duration:450,delay:80*i});}else if(key==='fight'&&old==='hallway'){clear();chapterCue('CHAPTER II','Beyond the Veil','Two rivals. One choice: risk it or secure it.',now);}else if(key==='deposit'){revealStart=state.time;motion($('.objective'),[{opacity:.2,transform:'translateY(-9px)'},{opacity:1,transform:'translateY(0)'}]);motion($('#deposit-status'),[{color:'#eddfb0'},{color:'#a8c6b3'}],{duration:1400});}else if(key==='complete'){completeStart=state.time;if(!reduced.matches&&typeof $('#chapter-cue').animate==='function'){guideHoldUntil=now+1000;chapterCue('TRAINING COMPLETE','Essence secured','You carried the risk. Now you know the way.',now);}motion($('#tutorial-end'),[{opacity:0,transform:'translate(-50%,12px)'},{opacity:1,transform:'translate(-50%,0)'}],{duration:600});}}
function paintPortrait(id){const body=M.guides.find(g=>g.id===id)?.body||M.guides[2].body,surface=$('#guide-portrait'),c=surface.getContext('2d');c.clearRect(0,0,96,112);c.imageSmoothingEnabled=false;if(images[body])c.drawImage(images[body],0,320,96,160,0,-20,96,160);}
function animateGuide(first){const items=first?['#guide-portrait-wrap','#guide-name','#guide-title','#guide-text','#guide-actions']:['#guide-text','#guide-actions'];for(const [i,id] of items.entries())motion($(id),[{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,delay:i*55});}
function updateJourney(t){const index=t.stage==='hallway'?0:t.stage==='fight'?1:t.stage==='deposit'?2:3;for(let i=0;i<4;i++){const step=$('#journey-'+i);step.dataset.state=i<index?'done':i===index?'current':'waiting';step.setAttribute('aria-current',i===index?'step':'false');}document.body.dataset.tutorialStage=t.stage;}
function renderBank(){const b=M.bankAt(state),age=revealStart<0?2:Math.max(0,state.time-revealStart),t=reduced.matches?1:Math.min(1,age/1.1),ease=1-Math.pow(1-t,3);ellipse(b.x,b.y+3,53*ease,16*ease,'#a6cda345');ctx.save();ctx.globalAlpha=ease;ctx.translate(b.x,b.y);ctx.scale(.8+.2*ease,.8+.2*ease);drawBank(ctx,-54,-46+(1-ease)*20,108,56);ctx.restore();if(t<1){for(let i=0;i<10;i++){const a=i*Math.PI/5,travel=18+52*t;ctx.fillStyle='#d6dfa7';ctx.globalAlpha=1-t;ctx.fillRect(b.x+Math.cos(a)*travel,b.y-15+Math.sin(a)*travel*.55-t*15,2,3);}ctx.globalAlpha=1;}text('ESSENCE BANK',b.x,b.y+28,'#cbd7b1',11);}

function drawDestination(){const q=state.navigation?.points.at(-1);if(q){ellipse(q.x,q.y,12,5,'#cfbd85',true);ctx.fillStyle='#cfbd85';ctx.fillRect(q.x-1,q.y-1,3,3);}}

function hallWall(x,y,w,h){
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 for(let row=Math.floor(y/48);row*48<y+h;row++)for(let col=Math.floor(x/96)-1;col*96<x+w;col++){
  const bx=col*96+(row%2)*48,by=row*48;ctx.drawImage(images.stone,bx,by,96,48);ctx.fillStyle='#11151ab5';ctx.fillRect(bx,by,96,48);
  ctx.fillStyle='#45494d';ctx.fillRect(bx+2,by+2,92,2);ctx.fillStyle='#30343a';ctx.fillRect(bx+2,by+4,2,40);ctx.fillStyle='#12151a';ctx.fillRect(bx+2,by+44,94,4);ctx.fillRect(bx+94,by+2,2,44);
 }
 ctx.restore();
}
