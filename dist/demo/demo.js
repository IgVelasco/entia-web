'use strict';
const M=window.EssenceDemo,canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),$=s=>document.querySelector(s);
let state=M.create(),images={},ready=false,paused=false,previous=0,width=0,height=0,scale=1,ox=0,oy=0,dpr=1,noticeId=0,messageUntil=0,raf=0,pointer=null;
const keys=new Set(),touches=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const camera={x:510,y:490};
const assets={hero:'hero.png',rogue:'rogue.png',mage:'mage.png',grass:'grass.png',path:'path.png',stone:'stone.png',tree:'tree.png',tree2:'tree2.png',pine:'pine.png',portal:'portal.png',bank:'essence-bank.png',spell:'apocalipsis_60.png'};
const floor=document.createElement('canvas');floor.width=M.WIDTH;floor.height=M.HEIGHT;
function loadImage(name,file){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[name]=im;resolve();};im.onerror=()=>reject(Error(file));im.src='../assets/'+file;});}
async function load(){ready=false;$('#retry').hidden=true;$('#curtain').hidden=false;$('#curtain-title').textContent='Opening the portal…';try{await Promise.all(Object.entries(assets).map(([n,f])=>loadImage(n,f)));buildFloor();ready=true;$('#curtain').hidden=true;document.body.classList.add('portal-arrival');canvas.focus({preventScroll:true});resize();schedule();}catch(e){$('#curtain-title').textContent='The portal could not open';$('#curtain-text').textContent='An artwork file did not load. Please try again.';$('#retry').hidden=false;}}
function buildFloor(){const c=floor.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle=c.createPattern(images.grass,'repeat');c.fillRect(0,0,M.WIDTH,M.HEIGHT);c.save();c.beginPath();c.rect(130,400,860,100);c.rect(570,320,90,480);c.rect(150,470,95,220);c.clip();for(let y=0;y<M.HEIGHT;y+=40)for(let x=0;x<M.WIDTH;x+=40)c.drawImage(images.path,x,y,40,40);c.restore();for(let y=330;y<520;y+=40)for(let x=50;x<270;x+=40)c.drawImage(images.stone,x,y,40,40);const shade=c.createRadialGradient(580,450,100,580,450,780);shade.addColorStop(0,'#203a2610');shade.addColorStop(1,'#03120ed9');c.fillStyle=shade;c.fillRect(0,0,M.WIDTH,M.HEIGHT);}
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;scale=width<760?Math.max(.72,Math.min(width/560,height/760)):Math.min(width/1100,height/790);schedule();}
function ellipse(x,y,rx,ry,color,line=false){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(line){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.stroke();}else{ctx.fillStyle=color;ctx.fill();}}
function text(s,x,y,color='#e6e4cc',size=13){ctx.font=`${size}px Inter, sans-serif`;ctx.textAlign='center';ctx.fillStyle='#07120f';ctx.fillText(s,x+1,y+2);ctx.fillStyle=color;ctx.fillText(s,x,y);}
function actor(a,body,player=false){const im=images[body];const f=a.moving?1+Math.floor(a.gait/64*7)%7:0;ellipse(a.x,a.y+1,16,5,'#00110cc0');if(player)ellipse(a.x,a.y+2,20,8,'#e8d491',true);ctx.drawImage(im,f*96,a.dir*160,96,160,Math.round(a.x-30),Math.round(a.y-91),60,100);}
function portal(){const frame=reduced.matches?0:Math.floor(state.time*10)%8;const p=M.gateway;ctx.save();ctx.shadowColor='#bddd66';ctx.shadowBlur=reduced.matches?0:22;ctx.drawImage(images.portal,(frame%4)*240,Math.floor(frame/4)*320,240,320,p.x-96,p.y-248,192,256);ctx.restore();text('RETURN TO NIX',p.x,p.y+32,'#d8e9b1',13);}
function draw(){if(!ready)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#091911';ctx.fillRect(0,0,width,height);const p=state.player;
 camera.x=p.x;camera.y=p.y;ox=width/2-p.x*scale;oy=height/2-p.y*scale;
 ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;ctx.drawImage(floor,0,0);
 if(state.phase==='arena'){ctx.fillStyle='#83d7b41a';ctx.fillRect(38,300,232,330);ctx.setLineDash([5,8]);ctx.strokeStyle='#b7d99588';ctx.beginPath();ctx.moveTo(270,310);ctx.lineTo(270,650);ctx.stroke();ctx.setLineDash([]);text('SANCTUARY',164,600,'#a8d8b5',12);}
 for(const e of state.enemies){if(state.phase!=='arena'||e.hp<=0)continue;if(e.wind>0){ellipse(e.x,e.y,70*(1-e.wind/.85),27*(1-e.wind/.85),'#e7966955');ellipse(e.x,e.y,70,27,'#f0a16a',true);}else ellipse(e.x,e.y+2,25,10,'#db9b6655',true);}
 const layers=[...M.scenery.map(s=>({...s,type:'scenery'})),{type:'portal',y:M.gateway.y},...(state.bankUnlocked?[{type:'bank',y:M.banker.y}]:[]),...(state.phase==='arena'?state.enemies.filter(e=>e.hp>0):[]),{...p,body:'hero',player:true}].sort((a,b)=>a.y-b.y);
 for(const a of layers){if(a.type==='scenery')ctx.drawImage(images[a.id],a.x-a.w/2,a.y-a.h,a.w,a.h);else if(a.type==='portal')portal();else if(a.type==='bank'){ctx.drawImage(images.bank,M.banker.x-70,M.banker.y-175,140,187);text('ESSENCE RELIQUARY',M.banker.x,M.banker.y+30,'#bbe6bb',12);}else actor(a,a.body,a.player);}
 if(state.phase==='arena')for(const e of state.enemies){if(e.hp<=0)continue;text(e.name,e.x,e.y-98,'#d9c79c',12);const max=e.maxHp;ctx.fillStyle='#16251b';ctx.fillRect(e.x-21,e.y-91,42,4);ctx.fillStyle=e.wind?'#f2a16c':'#cbad70';ctx.fillRect(e.x-21,e.y-91,42*e.hp/max,4);}
 for(const f of state.fx){const frame=Math.min(31,Math.floor(f.age*16));if(reduced.matches){ellipse(f.x,f.y,35,20,'#e8d5a7',true);}else ctx.drawImage(images.spell,(frame%4)*273,Math.floor(frame/4)*243,273,243,f.x-73,f.y-90,146,130);}
 for(const drop of state.drops){
    ellipse(drop.x,drop.y+3,13,5,'#00190faa');
    ctx.drawImage(images.bank,455,565,185,320,drop.x-10,drop.y-32,20,35);
    text(String(drop.amount),drop.x,drop.y-38,drop.owner==='player'?'#f4d595':'#bce8b2',12);
  }
  const aim=aimPoint();
  if(aim){const valid=Math.hypot(aim.x-p.x,aim.y-p.y)<=270&&M.lineClear(p,aim);ellipse(aim.x,aim.y,34,17,valid?'#e4d490':'#dd8068',true);ctx.strokeStyle=valid?'#e4d490':'#dd8068';ctx.beginPath();ctx.moveTo(aim.x-10,aim.y);ctx.lineTo(aim.x+10,aim.y);ctx.moveTo(aim.x,aim.y-9);ctx.lineTo(aim.x,aim.y+9);ctx.stroke();}
  for(const e of state.enemies)if(e.wind>0&&e.kind==='ranged'&&e.aim){ellipse(e.aim.x,e.aim.y,42,20,'#f1a373',true);}
 if(state.carried){text(`✦ ${state.carried}`,p.x,p.y-112,'#f3d586',15);}
 ctx.setTransform(dpr,0,0,dpr,0,0);if(state.flash&&!reduced.matches){ctx.fillStyle=`rgba(200,230,158,${state.flash*.35})`;ctx.fillRect(0,0,width,height);}
}
function ui(){
 const p=state.player;$('#health-fill').style.width=p.hp+'%';$('#health').textContent=Math.ceil(p.hp)+' / 100';$('#carried').textContent=state.carried;$('#secured').textContent=state.secured;
 $('#chapter').textContent='THE VEIL / TRAINING GROUNDS';$('#objective-label').textContent=state.won?'THE LOOP IS YOURS':'SECURE 60 ESSENCE';
 $('#objective').textContent=state.won?'Risk. Return. Grow.':state.carried?'Carry it home. Or stay.':state.drops.length?'Essence is on the ground':'Something worth fighting for';
 $('#hint').textContent=state.carried?'Deposit at the reliquary, south of the return portal. Fall and you drop what you carry.':state.drops.length?'Walk onto a crystal to pick it up. Your dropped essence can be recovered.':`Aim and click a rival to cast. ${state.secured} / 60 essence secured.`;
 const near=M.nearBank(state),gate=M.nearGate(state),item=state.drops.some(d=>Math.hypot(d.x-p.x,d.y-p.y)<=40);
 $('.interact-area').hidden=!(near&&state.carried||gate||item||state.bank);
 $('#interact').disabled=state.bank>0||paused;
 $('#interact').innerHTML=state.bank?'Depositing…':item?'Pick up essence <kbd>E</kbd>':near&&state.carried?'Deposit '+state.carried+' essence <kbd>E</kbd>':'Return to Nix <kbd>E</kbd>';
 $('#bank-progress').hidden=!state.bank;$('#bank-progress span').style.width=Math.min(100,state.bank/1.5*100)+'%';$('#cast').disabled=paused;$('#cast').style.opacity=state.cooldown>0?'.55':'1';
 if(state.noticeId!==noticeId){noticeId=state.noticeId;$('#message').textContent=state.notice;messageUntil=performance.now()+5000;}$('#message').classList.toggle('visible',performance.now()<messageUntil);
}
function input(){const last=[...keys].filter(k=>k!==' ').at(-1);return last==='d'||last==='arrowright'?{x:1,y:0}:last==='a'||last==='arrowleft'?{x:-1,y:0}:last==='w'||last==='arrowup'?{x:0,y:-1}:last==='s'||last==='arrowdown'?{x:0,y:1}:{x:0,y:0};}
function aimPoint(){if(!pointer)return null;const point={x:state.player.x+(pointer.x-width/2)/scale,y:state.player.y+(pointer.y-height/2)/scale};const hit=state.enemies.filter(e=>e.hp>0&&Math.abs(e.x-point.x)<28&&point.y>=e.y-88&&point.y<=e.y+8).sort((a,b)=>b.y-a.y)[0];return hit?{x:hit.x,y:hit.y,enemyId:hit.name}:point;}
function castAtPointer(){const point=aimPoint();if(point)M.cast(state,point);else M.tell?.(state,'Point at the world to aim.');}
function interact(){const action=M.interact(state);if(action==='exit')window.location.assign('../#home');}

function tick(now){raf=0;const dt=Math.min((now-previous)/1000||0,.04);previous=now;if(ready&&!paused&&!document.hidden){M.update(state,dt,input());}draw();ui();if(ready&&!document.hidden)schedule();}
function schedule(){if(!raf&&!document.hidden)raf=requestAnimationFrame(tick);}
function clear(){keys.clear();touches.clear();}
function togglePause(value=!paused){if(!ready)return;paused=value;clear();$('#curtain').hidden=!paused;$('#curtain-title').textContent='A moment of stillness';$('#curtain-text').textContent='Your rivals and essence will wait.';$('#resume').hidden=!paused;$('#pause').textContent=paused?'Resume':'Pause P';$('#pause').setAttribute('aria-pressed',String(paused));if(!paused)canvas.focus({preventScroll:true});schedule();}
const accepted=['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'];document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();if(key==='p'||key==='escape'){if(!e.repeat)togglePause();return;}if(e.target.closest('button,a'))return;if(accepted.includes(key)){e.preventDefault();if(ready&&!paused&&!e.repeat){keys.delete(key);keys.add(key);}}if(key===' '&&!e.repeat&&ready&&!paused){e.preventDefault();castAtPointer();}if(key==='e'&&!e.repeat&&ready&&!paused)interact();});document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
const mapping={up:'w',left:'a',down:'s',right:'d'};for(const button of document.querySelectorAll('[data-dir]')){button.addEventListener('pointerdown',e=>{e.preventDefault();if(paused||!ready)return;button.setPointerCapture(e.pointerId);touches.set(e.pointerId,mapping[button.dataset.dir]);keys.add(mapping[button.dataset.dir]);});const release=e=>{const key=touches.get(e.pointerId);touches.delete(e.pointerId);if(![...touches.values()].includes(key))keys.delete(key);};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);}
$('#cast').addEventListener('click',()=>{if(ready&&!paused)castAtPointer();});
$('#interact').onclick=()=>{if(ready&&!paused)interact();canvas.focus({preventScroll:true});};$('#pause').onclick=()=>togglePause();$('#resume').onclick=()=>togglePause(false);$('#restart').onclick=()=>{if(!ready)return;state=M.create();pointer=null;noticeId=0;messageUntil=0;togglePause(false);};$('#retry').onclick=load;
function locatePointer(e){const rect=canvas.getBoundingClientRect();pointer={x:e.clientX-rect.left,y:e.clientY-rect.top};}
canvas.addEventListener('pointermove',locatePointer);
canvas.addEventListener('click',e=>{canvas.focus({preventScroll:true});locatePointer(e);if(ready&&!paused)castAtPointer();});window.addEventListener('blur',()=>{clear();if(ready&&!paused)togglePause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();if(ready&&!paused)togglePause(true);if(raf)cancelAnimationFrame(raf);raf=0;}else{previous=performance.now();schedule();}});window.addEventListener('resize',resize);resize();load();
