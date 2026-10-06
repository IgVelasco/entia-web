'use strict';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const canvas = $('#scene');
const ctx = canvas.getContext('2d');
const W = 1440, H = 900, TOWN_TILE=32;
const townTileCenter=value=>Math.floor(value/TOWN_TILE)*TOWN_TILE+TOWN_TILE/2;
const onTownGrid=p=>({...p,x:townTileCenter(p.x),y:townTileCenter(p.y)});
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const touchPreference = matchMedia('(pointer: coarse)');
const compactMode=()=>width<=900||touchPreference.matches;
let width = 0, height = 0, dpr = 1, scale = 1, ox = 0, oy = 0, zoom = 1;
let time = 0, last = 0, frameRequest = 0, paused = false, ready = false;
let images = {}, current = 'home', route = null, spell = null, rings = [], aiming = false;
let atPlace = 'home', hovered = null, toastTimer, replyTimer;
let nearbyPlace = null,zoneContent=null;
let joystickPointer=null,joystickDirection=null,mobileExploring=false,mobilePanX=0,mobilePanY=0;
let frontierState=WorldFrontier.initialState(),frontierWizard=null,frontierSequence=null,worldPatterns=null;
const FRONTIER_INSET=30, FRONTIER_MARGIN=96;
const NEAR_ENTER = 72, NEAR_EXIT = 104;
const camera = {x: 870, y: 470, targetX: 870, targetY: 470};
const spots = {
  home: {x: 800, y: 440, section: 'Home', clan: 'Nix', body: 'npc-home', greeting: 'Welcome to Nix.', land: {x: 870, y: 470}},
  arena: {x: 1190, y: 345, section: 'Game', clan: 'PvP', body: 'npc-game', greeting: 'Find your next rival.', land: {x: 1100, y: 410}},
  hall: {x: 1170, y: 655, section: 'Rankings', clan: 'Preview', body: 'npc-rankings', greeting: 'Live rankings are coming later.', land: {x: 1075, y: 680}},
  gate: {x: 780, y: 715, section: 'Download', clan: 'Unavailable', body: 'npc-download', greeting: 'No download is linked yet.', land: {x: 880, y: 725}}
};
for(const p of Object.values(spots)){p.x=townTileCenter(p.x);p.y=townTileCenter(p.y);p.land=onTownGrid(p.land);}
const hero = {...spots.home.land, body:'hero',dir:2,gait:0,hero:true};
const keepers = Object.entries(spots).map(([place, p]) => ({...p, place, dir: 2, isKeeper: true, reaction: 0}));
const npcs = [
  {x: 975, y: 490, body: 'mohawk', dir: 1, way: [[975,490],[1070,490],[1070,530],[975,530]], idx: 1, gait: 0, reaction: 0},
  {x: 1010, y: 730, body: 'mage', dir: 2, way: [[1010,730],[1190,730],[1190,695],[1010,695]], idx: 1, gait: 0, reaction: 0},
  {x: 742, y: 565, body: 'rogue', dir: 0, way: [[742,565],[742,625],[815,625],[815,565]], idx: 1, gait: 0, reaction: 0}
];
const scenery = [
  {id:'house',x:775,y:390,w:256,h:683*32/60}, {id:'house2',x:432,y:640,w:256,h:683*32/60,decorative:true},
  {id:'tree',x:595,y:265,w:235,h:294}, {id:'pine',x:437,y:325,w:240,h:240}, {id:'tree2',x:1360,y:282,w:255,h:320},
  {id:'pine',x:1385,y:640,w:280,h:280}, {id:'tree',x:652,y:865,w:260,h:325}, {id:'tree2',x:325,y:750,w:310,h:387},
  {id:'tree',x:555,y:115,w:225,h:282}, {id:'pine',x:960,y:142,w:200,h:200}, {id:'tree2',x:1395,y:890,w:250,h:312}
];
for(const n of npcs){n.x=townTileCenter(n.x);n.y=townTileCenter(n.y);n.way=n.way.map(([x,y])=>[townTileCenter(x),townTileCenter(y)]);}
for(const p of scenery){p.x=townTileCenter(p.x);p.y=p.id.startsWith('house')?Math.floor(p.y/TOWN_TILE)*TOWN_TILE:townTileCenter(p.y);}
const homePortal=onTownGrid({x:1010,y:420});
// Both variants use 60 source pixels per 32-unit tile. The entrance is two tiles wide.
function houseBounds(s){const left=s.x-s.w/2;return {left,doorX:left+144,front:s.y-64};}
const townObstacles=scenery.flatMap(s=>{if(!s.id.startsWith('house'))return [{x:s.x-22,y:s.y-28,w:44,h:38}];const b=houseBounds(s);if(s.decorative)return [{x:b.left,y:s.y-192,w:256,h:192}];return [{x:b.left,y:s.y-208,w:256,h:16},{x:b.left,y:s.y-192,w:16,h:128},{x:b.left+240,y:s.y-192,w:16,h:128},{x:b.left,y:b.front,w:144,h:64},{x:b.doorX+64,y:b.front,w:48,h:64}];});
townObstacles.push({x:homePortal.x-74,y:homePortal.y-35,w:30,h:45},{x:homePortal.x+44,y:homePortal.y-35,w:30,h:45});
const townPhysics=WorldPhysics.create({width:W,height:H,minX:-FRONTIER_MARGIN,minY:-FRONTIER_MARGIN,maxX:W+FRONTIER_MARGIN,maxY:H+FRONTIER_MARGIN,radius:10,obstacles:townObstacles});
const houses=scenery.filter(s=>s.id.startsWith('house'));
for(const house of houses)house.roofAlpha=1;
function insideHouse(house,actor=hero){if(house.decorative)return false;const b=houseBounds(house),x=townTileCenter(actor.x),y=townTileCenter(actor.y);return x>=b.left+16&&x<b.left+240&&y>=house.y-192&&y<house.y-32;}
function updateHouseRoofs(dt){for(const house of houses){const target=insideHouse(house)?0:1,change=Math.max(0,dt)/.22;house.roofAlpha=motionOff()?target:target<house.roofAlpha?Math.max(target,house.roofAlpha-change):Math.min(target,house.roofAlpha+change);}}
let enteringPortal=false,demoOpen=false,demoFrameStarted=false,demoCloseEpoch=0,demoEverOpened=false,demoLoaded=false,demoFailed=false,demoExitPending=false,demoHistoryOwned=false,portalReentryBlocked=false;
let demoReturnHash="#home",demoLoadTimer=0;
function enterPortal(){
 if(enteringPortal)return;enteringPortal=true;clearMovementInput();route=null;
 if(motionOff()){showDemo(true);return;}
 const p=screen(homePortal),veil=document.createElement('div');veil.id='portal-transition';veil.setAttribute('aria-hidden','true');
 veil.style.setProperty('--portal-x',p.x+'px');veil.style.setProperty('--portal-y',(p.y+canvas.getBoundingClientRect().top)+'px');
 document.body.append(veil);$('#world').classList.add('entering-portal');
 setTimeout(()=>{if(enteringPortal)showDemo(true);},460);
}
function walkToPortal(){portalReentryBlocked=false;resetJoystick();heldDirections.clear();beginManualMovement();moveHero(walkingPath(homePortal),{explore:true,complete:enterPortal});}
function portalCrossing(){if(portalReentryBlocked){if(Math.hypot(hero.x-homePortal.x,hero.y-homePortal.y)>48)portalReentryBlocked=false;return;}if(!enteringPortal&&Math.abs(hero.x-homePortal.x)<24&&Math.abs(hero.y-homePortal.y)<20)enterPortal();}
function ensureDemoFrame(){
 const frame=$('#demo-frame');if(demoFrameStarted&&!demoFailed)return;demoFrameStarted=true;demoFailed=false;demoLoaded=false;
 const url=location.origin+'/demo/?embedded=1';if(frame.contentWindow?.location?.replace)frame.contentWindow.location.replace(url);else frame.src=url;$('#demo-loading').hidden=false;
 demoLoadTimer=setTimeout(()=>{if(!demoLoaded)$('#demo-load-message').textContent='The demo is taking longer to load. You can return to Nix while it finishes.';},20000);
}
function activateDemoFrame(type){if(!demoOpen||!demoLoaded)return;const frame=$('#demo-frame');if(!matchMedia('(pointer: coarse)').matches)frame.focus({preventScroll:true});frame.contentWindow?.postMessage({type,presentationScale:scale},location.origin);}
function showDemo(push=true){
 if(demoOpen)return;if(frontierState.open)dismissFrontier({focus:false});const resumed=demoEverOpened;demoEverOpened=true;demoReturnHash=location.hash==='#demo'?'#home':location.hash||'#home';
 demoCloseEpoch++;$('#demo-host').classList.remove('closing');demoOpen=true;enteringPortal=false;canvas.width=1;canvas.height=1;ground.width=1;ground.height=1;groundReady=false;ensureDemoFrame();clearMovementInput();route=null;if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;
 $('#portal-transition')?.remove();$('#world').classList.remove('entering-portal');$('#app').inert=true;document.body.classList.add('demo-open');$('#demo-host').hidden=false;
 if(push&&location.hash!=='#demo'){window.history.pushState({entiaDemo:true},'','#demo');demoHistoryOwned=true;}
 if(demoLoaded)activateDemoFrame(resumed?'entia-demo-resume':'entia-demo-activate');
}
function closeDemo(changeHistory=true){
 if(!demoOpen)return;
 // Closing the view never depends on joint iframe/browser history advancing.
 const epoch=++demoCloseEpoch;$('#demo-frame').contentWindow?.postMessage({type:'entia-demo-pause'},location.origin);
 demoOpen=false;demoExitPending=false;enteringPortal=false;portalReentryBlocked=true;$('#app').inert=false;document.body.classList.remove('demo-open');
 if(changeHistory){current='home';atPlace=null;setContent('home');updateKeeperStates();$('#location-state').textContent='Back in Nix';if(location.hash==='#demo')window.history.replaceState(null,'','#home');}
 const host=$('#demo-host');host.classList.add('closing');
 if(motionOff())host.hidden=true;else setTimeout(()=>{if(epoch===demoCloseEpoch&&!demoOpen){host.hidden=true;host.classList.remove('closing');}},420);
 last=performance.now();resize();requestDraw();canvas.focus({preventScroll:true});
}

window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==$('#demo-frame').contentWindow)return;
 if(event.data?.type==='entia-demo-ready'){demoLoaded=true;clearTimeout(demoLoadTimer);$('#demo-loading').hidden=true;if(demoOpen)activateDemoFrame('entia-demo-activate');if(!demoOpen&&!enteringPortal)$('#demo-frame').contentWindow?.postMessage({type:'entia-demo-pause'},location.origin);}
 else if(event.data?.type==='entia-demo-exit')closeDemo(true);
 else if(event.data?.type==='entia-demo-error'){demoFailed=true;$('#demo-load-message').textContent='The demo artwork could not load. Return to Nix and try again.';}
});
$('#demo-loading-back').onclick=()=>closeDemo(true);
function drawHomePortal(){if(!images.portal)return;const f=motionOff()?0:Math.floor(time*10)%8;ctx.drawImage(images.portal,f%4*240,Math.floor(f/4)*320,240,320,homePortal.x-90,homePortal.y-238,180,240);ctx.font='13px Inter';ctx.textAlign='center';ctx.fillStyle='#e7d390';ctx.fillText('ENTER THE VEIL',homePortal.x,homePortal.y+24);}
function castPointer(x,y){resetJoystick();heldDirections.clear();route=null;spell={x,y,age:0,delay:0,duration:apocalipsis.duration,hit:false};hero.dir=heading(x-hero.x,y-hero.y);setAim(false);requestDraw();}
const ground = document.createElement('canvas');
ground.width = W; ground.height = H;
let groundReady = false;
// RAO movement: 32 world units per tile, 0.20 s/player step, 0.40 s/NPC step.
const WALK_TILE = 32, WALK_SPEED = WALK_TILE/.20, NPC_SPEED = WALK_TILE/.40;
const walkCycleTiles = {'wizard-walk':2,hero:2, rogue:1, mage:2, mohawk:2};
const heldDirections = new Map();
const movementKeys = {w:0,ArrowUp:0,d:1,ArrowRight:1,s:2,ArrowDown:2,a:3,ArrowLeft:3};
const directions = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const motionOff = () => paused || motionPreference.matches;
const heading = (dx,dy) => Math.abs(dx)>Math.abs(dy) ? (dx>0?1:3) : (dy>0?2:0);
const screen = p => ({x:p.x*scale+ox, y:p.y*scale+oy});

// Match the client's active NativeWorldTextGlyph renderer with real Inter text.
function setGameText(element, text) {
  if (element.dataset.gameText === text) return;
  element.dataset.gameText = text;
  element.textContent = text;
  element.classList.add('game-text');
}

// Labels are real buttons, so the same spell works with mouse, touch and keyboard.
for (const keeper of keepers) {
  const button = document.createElement('button');
  button.className = 'keeper';
  button.dataset.place = keeper.place;
  button.dataset.cast = 'true';
  button.setAttribute('aria-label', `Open ${keeper.section}`);
  button.innerHTML = `<span class="keeper-label"><strong>${keeper.section}</strong><small class="keeper-clan">&lt;${keeper.clan}&gt;</small></span><span class="keeper-hit" aria-hidden="true"><svg class="target-reticle" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="13"/><path d="M24 3v13m0 16v13M3 24h13m16 0h13"/></svg></span>`;
  setGameText(button.querySelector('strong'), keeper.section);
  button.addEventListener('pointerenter', () => { hovered=keeper.place; requestDraw(); });
  button.addEventListener('pointerleave', () => { hovered=null; requestDraw(); });
  button.addEventListener('focus', () => { hovered=keeper.place; requestDraw(); });
  button.addEventListener('blur', () => { hovered=null; requestDraw(); });
  $('#locations').append(button);
  keeper.button = button;
}
setGameText($('#player-label span'), 'YOU');

// World sprites are game controls, not selectable page content. Keep normal
// browser selection and context menus available everywhere outside this surface.
for (const surface of [canvas, $('#locations'), $('#player-label'), $('#keeper-reply')]) {
  for (const type of ['selectstart', 'dragstart', 'contextmenu']) {
    surface.addEventListener(type, event => event.preventDefault());
  }
}


function viewport() {
  const compact=compactMode(), left=compact?0:clamp(width*.33,320,450);
  const sceneHeight=height;
  if(compact&&frontierState.open&&frontierWizard){
    const s=frontierSequence;scale=s.viewScale*Math.min(width/s.viewWidth,height/s.viewHeight);
    const px=(hero.x+frontierWizard.x)/2*scale+s.viewOx,py=(hero.y+frontierWizard.y)/2*scale+s.viewOy;
    s.viewOx+=clamp(px,Math.min(80,width*.25),width-Math.min(80,width*.25))-px;
    s.viewOy+=clamp(py,Math.min(180,sceneHeight*.4),Math.max(sceneHeight-140,sceneHeight*.55))-py;
    ox=s.viewOx;oy=s.viewOy;
  }else if(compact){
    // Fit all four destination actors and their labels; walking cannot pan one out of view.
    const leftEdge=Math.min(...keepers.map(k=>k.x))-100,rightEdge=Math.max(...keepers.map(k=>k.x))+100;
    const topEdge=Math.min(...keepers.map(k=>k.y))-115,bottomEdge=Math.max(...keepers.map(k=>k.y))+95;
    scale=Math.min((width-32)/(rightEdge-leftEdge),(sceneHeight-76)/(bottomEdge-topEdge))*Math.min(1,zoom);
    camera.x=camera.targetX=(leftEdge+rightEdge)/2;camera.y=camera.targetY=(topEdge+bottomEdge)/2;
    ox=width/2-camera.x*scale;oy=(sceneHeight-44)/2-camera.y*scale;
    if(mobileExploring){
      // Keep a stable overview until walking nears its edge, then follow gently.
      const px=hero.x*scale+ox+mobilePanX,py=hero.y*scale+oy+mobilePanY;
      mobilePanX+=clamp(px,Math.min(90,width*.25),width-Math.min(90,width*.25))-px;
      mobilePanY+=clamp(py,Math.min(160,sceneHeight*.38),Math.max(sceneHeight-150,sceneHeight*.5))-py;
      ox+=mobilePanX;oy+=mobilePanY;
    }
  }else{
    scale=WorldPhysics.presentationScale(width,zoom);
    camera.x=camera.targetX=hero.x;camera.y=camera.targetY=hero.y;
    ox=left+(width-left)/2-hero.x*scale;oy=sceneHeight/2-hero.y*scale;
  }
}
function resize() {
  resetJoystick();
  const rect = canvas.getBoundingClientRect();
  width = rect.width; height = rect.height;
  dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2000000/Math.max(1,width*height)));
  if(!demoOpen){if(canvas.width!==Math.round(width*dpr))canvas.width=Math.round(width*dpr);if(canvas.height!==Math.round(height*dpr))canvas.height=Math.round(height*dpr);}
  viewport(); positionLabels(); requestDraw();if(demoOpen)$('#demo-frame').contentWindow?.postMessage({type:'entia-demo-scale',presentationScale:scale},location.origin);
}
function positionLabels() {
  for (const k of keepers) {
    const p = screen(k);
    k.button.style.transform = `translate3d(${Math.round(p.x)}px,${Math.round(p.y)}px,0) translate(-50%, -100%)`;
    // The hit target covers the sprite; CSS anchors its name below the feet.
    k.button.querySelector('.keeper-hit').style.height = `${Math.round(64*scale)}px`;
  }
  const p = screen(hero);
  const crowded=keepers.some(k=>{const q=screen(k);return Math.abs(q.x-p.x)<100&&Math.abs(q.y-p.y)<50;});
  $('#player-label').style.transform=crowded?`translate3d(${Math.round(p.x)}px,${Math.round(p.y-77*scale)}px,0) translate(-50%,-100%)`:`translate3d(${Math.round(p.x)}px,${Math.round(p.y+3)}px,0) translateX(-50%)`;
  $('#player-label').dataset.placement=crowded?'above':'below';
  const destination = screen(spots[current]);
  $('#keeper-reply').style.transform = `translate3d(${Math.round(destination.x)}px,${Math.round(destination.y-64*scale-58)}px,0) translate(-50%,-100%)`;
}
function loadImage(path) {
  return new Promise((resolve,reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`Asset unavailable: ${path}`));
    im.src = path;
  });
}
async function load() {
  $('#retry-load').hidden=true;
  $('#loading p').textContent='Opening the gates of Nix…';
  try {
    const response = await fetch('assets/site-assets.json?v=npcroles8');
    if(!response.ok) throw new Error('Asset manifest unavailable');
    const assets = await response.json();
    await Promise.all(Object.entries(assets.images).map(async ([key,file]) => images[key] = await loadImage('assets/'+file)));
    window.EntiaArtwork=images;
    ready = true;
    $('#loading').hidden = true;
    const initial = spots[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
    go(initial, {history:false, instant:true, announce:false});
    resize(); requestDraw();if(location.hash==='#demo')showDemo(false);
  } catch(error) {
    $('#loading p').textContent='Nix could not load. You can still explore using the navigation above.';
    $('#retry-load').hidden=false;
    console.error(error);
  }
}
function buildGround() {
  if(ground.width!==W)ground.width=W;if(ground.height!==H)ground.height=H;
  const c=ground.getContext('2d');if(c.isContextLost?.())return; c.imageSmoothingEnabled=false;
  for(let y=0;y<H;y+=TOWN_TILE)for(let x=0;x<W;x+=TOWN_TILE)c.drawImage(images.grass,x,y,TOWN_TILE,TOWN_TILE);
  const road=(x,y,w,h) => {
    x=Math.floor(x/TOWN_TILE)*TOWN_TILE;y=Math.floor(y/TOWN_TILE)*TOWN_TILE;w=Math.ceil(w/TOWN_TILE)*TOWN_TILE;h=Math.ceil(h/TOWN_TILE)*TOWN_TILE;
    c.save(); c.beginPath(); c.rect(x,y,w,h); c.clip();
    for(let yy=y;yy<y+h;yy+=TOWN_TILE) for(let xx=x;xx<x+w;xx+=TOWN_TILE) c.drawImage(images.path,xx,yy,TOWN_TILE,TOWN_TILE);
    c.restore();
  };
  road(735,455,88,340); road(785,447,473,76); road(853,475,86,290); road(855,665,400,82); road(1075,320,165,177); road(757,397,145,105);
  road(1216,448,W-1216,64);road(736,768,64,H-768);road(0,736,768,64);road(1120,0,64,224);
  for(let y=192;y<352;y+=TOWN_TILE) for(let x=1056;x<1344;x+=TOWN_TILE) c.drawImage(images.stone,x,y,TOWN_TILE,TOWN_TILE);
  for(const house of scenery.filter(s=>s.id.startsWith('house'))){const b=houseBounds(house);for(let y=house.y-192;y<house.y-64;y+=TOWN_TILE)for(let x=b.left+16;x<b.left+240;x+=TOWN_TILE)c.drawImage(images.houseFloor,x,y,TOWN_TILE,TOWN_TILE);for(let y=b.front;y<house.y;y+=TOWN_TILE)for(let x=b.doorX;x<b.doorX+64;x+=TOWN_TILE)c.drawImage(images.houseFloor,x,y,TOWN_TILE,TOWN_TILE);}
  for(const h of houses){c.drawImage(images.houseInterior,h.x-h.w/2,h.y-h.h,h.w,h.h);c.drawImage(images.houseSteps,h.x-h.w/2,h.y-h.h,h.w,h.h);}
  groundReady=true;
}
function worldViewBounds(){return WorldFrontier.visibleTiles({width,height,scale:Math.max(.1,scale),ox,oy,tile:TOWN_TILE});}
function ensureWorldPatterns(){if(worldPatterns)return;const make=id=>{const tile=document.createElement('canvas');tile.width=tile.height=TOWN_TILE;const c=tile.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(images[id],0,0,TOWN_TILE,TOWN_TILE);return ctx.createPattern(tile,'repeat');};worldPatterns={grass:make('grass'),path:make('path')};}
function drawWorldContinuation(){ensureWorldPatterns();const v=worldViewBounds();ctx.fillStyle=worldPatterns.grass;ctx.fillRect(v.left,v.top,v.right-v.left,v.bottom-v.top);ctx.fillStyle=worldPatterns.path;
 if(v.right>W)ctx.fillRect(W,448,v.right-W,64);if(v.left<0)ctx.fillRect(v.left,736,-v.left,64);if(v.top<0)ctx.fillRect(1120,v.top,64,-v.top);if(v.bottom>H)ctx.fillRect(736,H,64,v.bottom-H);
}
function shadeWorld(){const v=worldViewBounds(),shade=ctx.createRadialGradient(1000,500,200,980,500,780);shade.addColorStop(0,'#dbc58308');shade.addColorStop(1,'#0a190dbb');ctx.fillStyle=shade;ctx.fillRect(v.left,v.top,v.right-v.left,v.bottom-v.top);}
const beyondTrees=[];
for(let gy=-3;gy<=9;gy++)for(let gx=-3;gx<=10;gx++){const seed=Math.abs((gx*73856093)^(gy*19349663)),x=gx*192+(seed%67),y=gy*160+((seed>>>8)%69);if(x>=-FRONTIER_MARGIN-60&&x<=W+FRONTIER_MARGIN+60&&y>=-FRONTIER_MARGIN-60&&y<=H+FRONTIER_MARGIN+60)continue;if((x<0||x>W)&&(Math.abs(y-768)<75||Math.abs(y-480)<75))continue;if((y<0||y>H)&&(Math.abs(x-1152)<75||Math.abs(x-768)<75))continue;if(seed%5===0)continue;beyondTrees.push({id:seed%2?'pine':'tree2',x,y,w:196+(seed%38),h:236+(seed%42),type:'outside'});}
function visibleBeyondTrees(){const v=worldViewBounds();return beyondTrees.filter(a=>a.x+a.w/2>=v.left&&a.x-a.w/2<=v.right&&a.y>=v.top&&a.y-a.h<=v.bottom);}
function frontierBlocked(){return document.hidden||demoOpen||enteringPortal||$('#notes').open||$('#character-dialog').open||$('#zone-dialog').open;}
// Freeze the three wandering NPCs while escorting: the shared, collision-checked
// path stays valid and the guide and player never chase each other into scenery.
function planFrontierEscort(){
 const others=[...keepers,...npcs],start={x:hero.x,y:hero.y},goal=spots.gate.land;
 const route=townPhysics.path(start,goal,others);if(!route.length)return null;
 const points=[start,...route],length=WorldFrontier.pathLength(points);
 for(const delta of [{x:48,y:0},{x:0,y:48},{x:-48,y:0},{x:0,y:-48}]){
  const tail={x:goal.x+delta.x,y:goal.y+delta.y};
  if(!townPhysics.clear(goal,tail,others))continue;
  const extended=[...points,tail];let separated=true;
  for(let d=0;d<=length;d+=2){const p=WorldFrontier.samplePath(extended,d),q=WorldFrontier.samplePath(extended,d+48);if(Math.hypot(p.x-q.x,p.y-q.y)<24){separated=false;break;}}
  if(separated)return {points:extended,length,distance:0};
 }
 return null;
}
function tryFrontier(from,to,kind='move',explore=true){

 const next=WorldFrontier.boundaryEvent(frontierState,{from:{x:from.x+FRONTIER_MARGIN,y:from.y+FRONTIER_MARGIN},to:{x:to.x+FRONTIER_MARGIN,y:to.y+FRONTIER_MARGIN},kind,explore,blocked:frontierBlocked(),width:W+FRONTIER_MARGIN*2,height:H+FRONTIER_MARGIN*2,inset:FRONTIER_INSET});
 if(next===frontierState)return false;
 const plan=planFrontierEscort();if(!plan){toast('The way is blocked. Step back into town and try again.');return false;}
 frontierState=next;resetJoystick();heldDirections.clear();route=null;spell=null;setAim(false);
 const spawn=WorldFrontier.samplePath(plan.points,48);
 frontierWizard={...spawn,body:'wizard-walk',isKeeper:true,gait:0,reaction:0,dir:heading(hero.x-spawn.x,hero.y-spawn.y),type:'frontier'};
 frontierSequence={...plan,phase:'appear',elapsed:0,viewScale:scale,viewWidth:width,viewHeight:height,viewOx:ox,viewOy:oy};
 $('#frontier-download-reveal').innerHTML='<span class="frontier-close-space" aria-hidden="true"></span>'+content('gate');$('#frontier-download-reveal').hidden=true;
 $('#frontier-description').textContent='';$('#frontier-bubble').hidden=true;$('#world').classList.add('frontier-active');updateFrontierPauseUI();last=performance.now();requestDraw();return true;
}
function frontierPhase(phase,text){
 if(!frontierSequence)return;frontierSequence.phase=phase;frontierSequence.elapsed=0;
 if(text){$('#frontier-description').textContent=text;$('#frontier-bubble').hidden=false;}
}
function dismissFrontier({focus=true}={}){
 frontierSequence=null;frontierState=WorldFrontier.initialState();frontierWizard=null;
 $('#frontier-bubble').hidden=true;$('#frontier-download-reveal').hidden=true;$('#frontier-download-reveal').style.setProperty('--reveal','0');$('#world').classList.remove('frontier-active');resetJoystick();heldDirections.clear();
 if(focus&&!demoOpen&&!document.hidden)canvas.focus({preventScroll:true});requestDraw();
}
function skipFrontierWalk(){
 const s=frontierSequence;if(!s||s.fast)return;
 s.fast=true;
 frontierPhase('teleport-out','Hold tight, traveller. I’ll take you there!');
 if(paused){paused=false;setMotionState();}
 last=performance.now();requestDraw();
}
function viewFrontierDownloads(){
 if(!frontierState.open||frontierSequence?.phase!=='vanish')return;dismissFrontier({focus:false});go('gate',{instant:true,animateContent:false});
 if(compactMode())openZoneInfo('gate',{arrival:true});else $('#section-heading')?.focus({preventScroll:true});
}
function updateFrontierPauseUI(){
 if(!frontierSequence)return;
 $('#frontier-resume').hidden=!paused;$('#frontier-paused').hidden=!paused;
 $('#frontier-bubble').hidden=!paused&&['appear','vanish'].includes(frontierSequence.phase);
}
function advanceFrontier(dt){
 const s=frontierSequence;if(!s)return;
 if(frontierBlocked()){dismissFrontier({focus:false});return;}
 if(paused)return;
 s.elapsed+=dt;
 if(s.phase==='appear'&&s.elapsed>=(motionOff()?.05:.8))frontierPhase('speak','Wait, traveller! These lands lead beyond the preview. Come with me. I’ll show you where to download Entia.');
 else if(s.phase==='speak'&&s.elapsed>=1.5)frontierPhase('escort');
 else if(s.phase==='teleport-out'&&s.elapsed>=(motionOff()?.05:.28)){
  s.distance=s.length;
  for(const [actor,distance] of [[hero,s.length],[frontierWizard,s.length+48]])Object.assign(actor,WorldFrontier.samplePath(s.points,distance));
  hero.dir=heading(frontierWizard.x-hero.x,frontierWizard.y-hero.y);frontierWizard.dir=heading(hero.x-frontierWizard.x,hero.y-frontierWizard.y);
  frontierPhase('teleport-in');
 }else if(s.phase==='teleport-in'&&s.elapsed>=(motionOff()?.05:.32)){
  $('#frontier-bubble').hidden=true;frontierPhase('vanish');
 }else if(s.phase==='escort'){
  let nextDistance=Math.min(s.length,s.distance+96*Math.min(dt,.04)),vertex=0;
  // Stop at the next turn of either actor; even a dropped frame stays cardinal.
  for(let i=1;i<s.points.length;i++){vertex+=Math.hypot(s.points[i].x-s.points[i-1].x,s.points[i].y-s.points[i-1].y);for(const stop of [vertex,vertex-48])if(stop>s.distance+.001)nextDistance=Math.min(nextDistance,stop);}
  s.distance=nextDistance;
  for(const [actor,distance] of [[hero,s.distance],[frontierWizard,s.distance+48]]){
   const p=WorldFrontier.samplePath(s.points,distance),dx=p.x-actor.x,dy=p.y-actor.y;
   if(Math.hypot(dx,dy)>.001){actor.dir=heading(dx,dy);actor.gait+=Math.hypot(dx,dy);actor.x=p.x;actor.y=p.y;}
  }
  if(s.distance>=s.length){hero.dir=heading(frontierWizard.x-hero.x,frontierWizard.y-hero.y);frontierWizard.dir=heading(hero.x-frontierWizard.x,hero.y-frontierWizard.y);$('#frontier-bubble').hidden=true;frontierPhase('vanish');}
 }else if(s.phase==='vanish'&&s.elapsed>=(motionOff()?.05:.22))viewFrontierDownloads();
}
function updateDownloadReveal(){
 const s=frontierSequence,node=$('#frontier-download-reveal');
 if(!s||compactMode()){node.hidden=true;return;}
 const revealing=['escort','teleport-in','vanish'].includes(s.phase)||s.phase==='teleport-out'&&s.distance>0;
 node.hidden=!revealing;if(!revealing)return;
 // Reveal the real destination content without navigating or activating controls.
 const travelled=s.length?clamp(s.distance/s.length,0,1):1;
 const progress=['teleport-in','vanish'].includes(s.phase)?1:clamp(travelled/.9,0,1);
 const eased=progress*progress*(3-2*progress);
 node.style.setProperty('--reveal',String(eased));
 node.classList.toggle('reduced-reveal',motionPreference.matches);
}
function positionFrontierBubble(){
 if(!frontierWizard||$('#frontier-bubble').hidden)return;
 const p=screen(frontierWizard),bubble=$('#frontier-bubble');
 bubble.style.left=clamp(p.x,Math.min(154,width/2),Math.max(width-154,width/2))+'px';
 bubble.style.top=Math.max(155,p.y-105*scale-12)+'px';
}
function drawFrontierWizard(a){
 const s=frontierSequence;if(!s)return;
 const u=motionOff()?1:s.phase==='appear'?clamp(s.elapsed/.8,0,1):s.phase==='vanish'?1-clamp(s.elapsed/.22,0,1):1;
 ctx.save();ctx.globalAlpha=u;glow(a.x,a.y-34,65,.7);drawActor(a);ctx.restore();
 if(!motionOff()&&(s.phase==='appear'||s.phase==='vanish')){
  const energy=Math.sin(Math.PI*u);glow(a.x,a.y-40,80,energy);
  ellipse(a.x,a.y+2,18+28*(1-u),6+9*(1-u),'rgba(160,233,221,'+energy+')',true,2);
  for(let i=0;i<12;i++){const angle=i*Math.PI/6+u*2,x=a.x+Math.cos(angle)*(12+24*(1-u)),y=a.y-8-u*76+i%3*10;ctx.fillStyle='rgba(220,235,187,'+energy+')';ctx.fillRect(x,y,2,3);}
 }
}
function ellipse(x,y,rx,ry,color,stroke=false,line=1) {
  ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  if(stroke){ctx.strokeStyle=color;ctx.lineWidth=line;ctx.stroke();}else{ctx.fillStyle=color;ctx.fill();}
}
function glow(x,y,r,alpha=1) {
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,`rgba(241,216,147,${.46*alpha})`);g.addColorStop(.3,`rgba(223,181,94,${.16*alpha})`);g.addColorStop(1,'rgba(223,181,94,0)');
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}
function drawActor(a) {
  const im=images[a.body]; if(!im)return;
  const idle=a.body.startsWith('npc-');
  // Essential escort travel retains grounded gait under reduced motion; only
  // decorative particles/fades are suppressed. Explicit Pause freezes the walk.
  const escorted=(a.hero||a.type==='frontier')&&frontierSequence?.phase==='escort'||a.hero&&route?.joystick;
  const walking=!idle&&!paused&&(escorted||!motionOff()&&(a.hero?!!route:!frontierState.open&&!a.isKeeper&&a.reaction<=0));
  // Body 156 walks through seven drawings over two tiles; body 502 over one.
  const stride=(a.gait||0)/(WALK_TILE*walkCycleTiles[a.body]);
  const frame=walking ? 1+Math.floor((stride%1)*7) : 0;
  const fw=idle?96:im.width/8, fh=im.height/4, dw=60, dh=fh/fw*dw;
  const teleport=frontierSequence&&['teleport-out','teleport-in'].includes(frontierSequence.phase)&&(a.hero||a.type==='frontier');
  const teleportProgress=teleport?clamp(frontierSequence.elapsed/(frontierSequence.phase==='teleport-out'?.28:.32),0,1):0;
  ctx.save();if(teleport&&!motionOff())ctx.globalAlpha*=frontierSequence.phase==='teleport-out'?1-teleportProgress:teleportProgress;
  ellipse(a.x,a.y+2,18,6,'rgba(7,20,12,.62)');
  if(a.hero)ellipse(a.x,a.y+2,25,10,'#e7c885',true,1.5);
  ctx.drawImage(im,frame*fw,a.dir*fh,fw,fh,Math.round(a.x-dw/2),Math.round(a.y-dh),dw,dh);
  ctx.restore();
  if(teleport&&!motionOff()){
   const pulse=Math.sin(Math.PI*teleportProgress);glow(a.x,a.y-40,70,pulse*1.5);ellipse(a.x,a.y+2,18+22*pulse,6+7*pulse,'rgba(171,231,219,'+(1-teleportProgress)+')',true,2);
   for(let i=0;i<8;i++){const angle=i*Math.PI/4+teleportProgress*3;ctx.fillStyle='rgba(226,239,197,'+pulse+')';ctx.fillRect(a.x+Math.cos(angle)*24,a.y-teleportProgress*90+Math.sin(angle)*12,3,4);}
  }
}
function drawDestination() {
  for(const [key,p] of Object.entries(spots)) {
    const selected=key===current, target=key===hovered || aiming;
    if(!selected&&!target)continue;
    const breath=motionOff()?0:Math.sin(time*2.6)*2;
    ellipse(p.x,p.y+2,selected?37+breath:30,selected?14:11,selected?'#e4c989bb':'#d7cda17a',true,selected?2:1);
    if(selected){
      ctx.fillStyle='#edcf88';
      for(let i=0;i<4;i++){const angle=i*Math.PI/2;const x=p.x+Math.cos(angle)*44,y=p.y+2+Math.sin(angle)*18;ctx.fillRect(x-2,y-2,4,4);}
    }
  }
  if(route){
    ctx.save();ctx.setLineDash([2,10]);ctx.lineWidth=1.5;ctx.strokeStyle='#e7ce8877';
    ctx.beginPath();ctx.moveTo(hero.x,hero.y);for(const p of route.points.slice(route.segment))ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();
    ellipse(route.target.x,route.target.y,25,9,'#e7ce8877',true);
  }
  for(const ring of rings){
    const u=ring.age/ring.duration;
    ellipse(ring.x,ring.y,20+u*48,8+u*18,`rgba(235,206,135,${(1-u)*.8})`,true,2-u);
  }
}
// The actual 60-PPT Apocalipsis sheet and canonical playback from RAO d92bcdee.
// Four columns, 32 frames at 16 fps; source-over, unrotated, 32/60 world scale.
const apocalipsis = {columns:4, frames:32, frameWidth:273, frameHeight:243, duration:2, worldScale:32/60};
function drawSpell() {
  if(!spell || spell.age<spell.delay || !images.apocalipsis)return;
  const elapsed=spell.age-spell.delay;
  if(elapsed>=apocalipsis.duration)return;
  const frame=Math.min(apocalipsis.frames-1,Math.floor(elapsed/apocalipsis.duration*apocalipsis.frames));
  const {frameWidth:fw,frameHeight:fh,columns,worldScale}=apocalipsis;
  const dw=fw*worldScale,dh=fh*worldScale;
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.drawImage(images.apocalipsis,(frame%columns)*fw,Math.floor(frame/columns)*fh,fw,fh,spell.x-dw/2,spell.y-dh/2,dw,dh);
  ctx.restore();
}
function advanceSpell(dt) {
  if(!spell)return;
  spell.age+=dt;
  if(!spell.hit&&spell.age>=spell.delay){
    spell.hit=true;
    const receiver=keepers.find(k=>k.place===spell.place);
    if(receiver){receiver.reaction=1.1;receiver.dir=heading(hero.x-receiver.x,hero.y-receiver.y);}
  }
  if(spell.age>=spell.duration)spell=null;
}
function draw() {
  if(!ready)return;
  if(motionOff())updateHouseRoofs(0);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#102017';ctx.fillRect(0,0,width,height);
  ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;
  drawWorldContinuation();if(!groundReady)buildGround();ctx.drawImage(ground,0,0);shadeWorld();
  drawDestination();
  const layers=[...visibleBeyondTrees(),...scenery.map(s=>({...s,type:'scenery'})),{...homePortal,type:'portal'},...npcs,...keepers,hero,...(frontierWizard?[frontierWizard]:[])].sort((a,b)=>a.y-b.y);
  for(const a of layers){
    if(a.type==='portal'){drawHomePortal();}else if(a.type==='frontier'){drawFrontierWizard(a);}else if(a.type==='scenery'||a.type==='outside'){
      ctx.save();if(a.type==='outside')ctx.globalAlpha=.72;
      if(frontierWizard&&!a.id.startsWith('house')&&[hero,frontierWizard].some(p=>a.y>p.y&&Math.abs(a.x-p.x)<a.w/2+20&&p.y>a.y-a.h&&p.y-95<a.y))ctx.globalAlpha=.28;
      ellipse(a.x+15,a.y+7,a.w*.38,a.w*.1,'#07130c40');
      ctx.drawImage(images[a.id.startsWith('house')?a.id+'Facade':a.id],a.x-a.w/2,a.y-a.h,a.w,a.h);ctx.restore();
    }else drawActor(a);
  }
  for(const h of houses){if(h.roofAlpha<=0)continue;ctx.globalAlpha=h.roofAlpha;ctx.drawImage(images[h.id+'Roof'],h.x-h.w/2,h.y-h.h,h.w,h.h);ctx.globalAlpha=1;}
  drawSpell();
  if(!motionOff())for(let i=0;i<12;i++){
    const x=690+(i*83)%650+Math.sin(time*.2+i)*12,y=255+(i*61)%480+Math.cos(time*.3+i)*8;
    ctx.fillStyle=`rgba(225,219,154,${.1+.12*(Math.sin(time+i)+1)})`;ctx.fillRect(x,y,2,2);
  }
}
function requestDraw() {
  if(!ready||document.hidden||demoOpen||frameRequest)return;
  frameRequest=requestAnimationFrame(tick);
}
function tick(now) {
  frameRequest=0;if(demoOpen||document.hidden)return;
  const visibleDt=Math.max(0,(now-last)/1000||0),dt=Math.min(visibleDt,.04);last=now;
  advanceFrontier(visibleDt);
  if(motionOff()&&!paused&&joystickDirection!==null&&!frontierState.open&&!frontierBlocked())advanceMovement(dt);
  if(!motionOff()){
    time+=dt;
    if(!enteringPortal&&!$('#character-dialog').open&&!frontierState.open)advanceMovement(dt);
    advanceSpell(dt);
    rings=rings.filter(r=>(r.age+=dt)<r.duration);
    for(const n of [...npcs,...keepers]){
      if(frontierState.open)continue;
      if(n.reaction>0){n.reaction=Math.max(0,n.reaction-dt);n.dir=heading(hero.x-n.x,hero.y-n.y);continue;}
      if(n.isKeeper)continue;
      const [x,y]=n.way[n.idx];
      if(!n.path?.length)n.path=townPhysics.path(n,{x,y},[hero,...keepers,...npcs.filter(a=>a!==n)]);
      const next=n.path[0];
      if(!next){n.idx=(n.idx+1)%n.way.length;continue;}
      const dx=next.x-n.x,dy=next.y-n.y,d=Math.hypot(dx,dy),step=Math.min(NPC_SPEED*dt,d);
      n.dir=heading(dx,dy);
      const moved=townPhysics.move(n,d?dx/d*step:0,d?dy/d*step:0,[hero,...keepers,...npcs.filter(a=>a!==n)]);
      if(d<1){n.path.shift();if(!n.path.length)n.idx=(n.idx+1)%n.way.length;}
      else if(moved<.01)n.path=[];
    }
    const blend=1-Math.exp(-dt*7);
    camera.x+=(camera.targetX-camera.x)*blend;camera.y+=(camera.targetY-camera.y)*blend;
  }
  updateHouseRoofs(dt);viewport();positionLabels();positionFrontierBubble();updateDownloadReveal();draw();
  if(!motionOff()||(frontierSequence||joystickDirection!==null)&&!paused)requestDraw();
}
function reactToArrival(place) {
  for(const n of [...npcs,...keepers])if(n.place===place||Math.hypot(n.x-hero.x,n.y-hero.y)<200){n.reaction=1.1;n.dir=heading(hero.x-n.x,hero.y-n.y);}
}
function arrive(place,announce=true) {
  atPlace=place;hero.dir=heading(spots[place].x-hero.x,spots[place].y-hero.y);
  $('#location-state').textContent='You are here';
  $('#world').classList.remove('traveling');
  updateKeeperStates();
  if(!motionOff())rings.push({x:hero.x,y:hero.y,age:0,duration:.5});
  reactToArrival(place);
  if(announce){
    $('#keeper-reply').textContent=spots[place].greeting;$('#keeper-reply').hidden=false;
    clearTimeout(replyTimer);replyTimer=setTimeout(()=>{$('#keeper-reply').hidden=true;},2200);
  }
}
function advanceRoute(dt) {
  const r=route;if(!r)return;r.elapsed+=dt;
  if(r.retryIn!==undefined){
    r.retryIn-=dt;if(r.retryIn>0)return;
    const next=navigationPath(r.destination);
    if(!next.length){r.retries=(r.retries||0)+1;if(r.retries>40){route=null;$('#location-state').textContent='Path blocked';$('#world').classList.remove('traveling');toast('The path is blocked. Try approaching from another side.');}else r.retryIn=.2;return;}
    r.points=next;r.segment=0;r.target=next.at(-1);delete r.retryIn;
  }
  let budget=WALK_SPEED*dt;
  if(route===r&&budget>0&&r.segment<r.points.length){
    const target=r.points[r.segment],dx=target.x-hero.x,dy=target.y-hero.y,d=Math.hypot(dx,dy);
    if(d<.01){r.segment++;if(r.segment>=r.points.length){route=null;r.complete?.();}return;}
    const before={x:hero.x,y:hero.y},step=Math.min(budget,d),moved=townPhysics.move(hero,dx/d*step,dy/d*step,[...keepers,...npcs]);
    hero.dir=heading(dx,dy);r.distance+=moved;budget-=step;if(r.explore&&moved>0&&tryFrontier(before,hero))return;
    if(moved+1e-5<step){if(r.destination)r.retryIn=.2;else route=null;return;}
    if(step>=d-.001){hero.x=target.x;hero.y=target.y;r.segment++;}
    if(r.explore){portalCrossing();checkNearbySection();}
  }
  if(route===r&&r.segment>=r.points.length){route=null;r.complete?.();}
}
function moveHero(points,{complete,instant=false,manual=false,explore=manual,joystick=false,destination=null}={}) {
  if(!points.length){route=null;$('#location-state').textContent='Path blocked';$('#world').classList.remove('traveling');toast('That route is blocked. Try another spot.');return;}
  const target=points.at(-1);let from=hero,length=0;
  for(const p of points){length+=Math.hypot(p.x-from.x,p.y-from.y);from=p;}
  // Every new action replaces the previous route and its completion callback.
  route=null;
  if(motionOff()&&!joystick||instant||length<2){const before={x:hero.x,y:hero.y};hero.x=target.x;hero.y=target.y;if(explore&&tryFrontier(before,hero))return;if(explore)checkNearbySection();complete?.();requestDraw();return;}
  route={sx:hero.x,sy:hero.y,target,points,segment:0,length,distance:0,elapsed:0,duration:length/WALK_SPEED,complete,manual,explore,joystick,destination};
  requestDraw();
}
function navigationPath(destination){
 if(!destination)return [];
 const keeper=spots[destination.place],others=[...keepers,...npcs];
 if(!destination.near)return walkingPath(keeper.land);
 if(Math.hypot(hero.x-keeper.x,hero.y-keeper.y)<=48&&townPhysics.free(hero.x,hero.y,others,hero))return [{x:hero.x,y:hero.y}];
 const candidates=[];
 for(const dx of [-32,0,32])for(const dy of [-32,0,32]){
  if(!dx&&!dy)continue;const target={x:keeper.x+dx,y:keeper.y+dy};
  const points=townPhysics.path(hero,target,others);if(points.length)candidates.push({points,length:WorldFrontier.pathLength([{x:hero.x,y:hero.y},...points])});
 }
 candidates.sort((a,b)=>a.length-b.length);return candidates[0]?.points||[];
}
function walkingPath(target) {
  return townPhysics.path(hero,target,[...keepers,...npcs]);
}
function isWalkable(x,y) {
  return townPhysics.free(x,y,[...keepers,...npcs],hero);
}
function resetJoystick(){
 const pointer=joystickPointer;joystickPointer=null;joystickDirection=null;heldDirections.delete('joystick');
 if(route?.joystick)route=null;
 const pad=$('#joystick-pad');pad.style.setProperty('--stick-x','0px');pad.style.setProperty('--stick-y','0px');pad.classList.remove('active');
 if(pointer!==null&&pad.hasPointerCapture?.(pointer))pad.releasePointerCapture(pointer);
}
function joystickBlocked(){return !compactMode()||!ready||document.hidden||paused||frontierState.open||frontierBlocked();}
function updateJoystick(event){
 if(event.pointerId!==joystickPointer)return;
 if(joystickBlocked()){resetJoystick();requestDraw();return;}
 event.preventDefault();
 const pad=$('#joystick-pad'),rect=pad.getBoundingClientRect(),dx=event.clientX-rect.left-rect.width/2,dy=event.clientY-rect.top-rect.height/2,length=Math.hypot(dx,dy),radius=36;
 const ratio=length>radius?radius/length:1;
 pad.style.setProperty('--stick-x',dx*ratio+'px');pad.style.setProperty('--stick-y',dy*ratio+'px');
 const direction=length<12?null:Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0;
 joystickDirection=direction;
 if(direction===null){heldDirections.delete('joystick');if(route?.joystick)route=null;}
 else{heldDirections.set('joystick',direction);startKeyboardStep(direction);}
 requestDraw();
}
function startJoystick(event){
 if(joystickPointer!==null||joystickBlocked()||event.button>0)return;
 event.preventDefault();event.stopPropagation?.();beginManualMovement({focus:false});joystickPointer=event.pointerId;mobileExploring=true;
 const pad=$('#joystick-pad');pad.setPointerCapture?.(event.pointerId);pad.classList.add('active');updateJoystick(event);
}
function stopJoystick(event){if(event.pointerId!==joystickPointer)return;event.preventDefault?.();resetJoystick();requestDraw();}
function clearMovementInput() {
  resetJoystick();heldDirections.clear();
  if(route?.manual)route=null;
  requestDraw();
}
function beginManualMovement({focus=true}={}) {
  // Playing returns focus to the world instead of leaving a keeper label focused.
  if(focus)canvas.focus({preventScroll:true});hovered=null;
  // Keep the in-progress footstep, but discard the old destination/reward callback.
  if(route&&!route.manual){
    const next=route.points[route.segment],distance=Math.hypot(next.x-hero.x,next.y-hero.y);
    const step=Math.min(WALK_TILE-(hero.gait%WALK_TILE),distance);
    if(distance>.001)moveHero([{x:hero.x+(next.x-hero.x)/distance*step,y:hero.y+(next.y-hero.y)/distance*step}],{manual:true,complete:checkWalkingProgress});
    else route=null;
  }
  atPlace=null;setAim(false);clearTimeout(replyTimer);$('#keeper-reply').hidden=true;
  $('#world').classList.remove('traveling');
  $('#location-state').textContent='Exploring Nix';
  updateKeeperStates();
}
function startKeyboardStep(direction=[...heldDirections.values()].at(-1)) {
  if(route||direction===undefined||!ready||frontierState.open)return;
  const vector=directions[direction],target={x:hero.x+vector.x*WALK_TILE,y:hero.y+vector.y*WALK_TILE};
  hero.dir=direction;
  // Four-direction steps cannot cut through the house or leave the square.
  if(!isWalkable(target.x,target.y)){if(tryFrontier(hero,target,'attempt'))return;requestDraw();return;}
  moveHero([target],{manual:true,joystick:heldDirections.has('joystick'),complete:checkWalkingProgress});
}
function advanceMovement(dt) {
  if(!route)startKeyboardStep();
  if(route)advanceRoute(dt);
  if(!route)startKeyboardStep();
}
function checkWalkingProgress() {
  portalCrossing();

}
function checkNearbySection() {
  // Exploration opens content in place. Never redirect the walk, release held
  // keys or cast a spell to select a section.
  const distance=place=>Math.hypot(hero.x-spots[place].x,hero.y-spots[place].y);
  if(nearbyPlace&&distance(nearbyPlace)<=NEAR_EXIT){
    atPlace=nearbyPlace;$('#location-state').textContent='You are here';return;
  }
  if(nearbyPlace){
    nearbyPlace=null;atPlace=null;$('#location-state').textContent='Exploring Nix';
  }
  const nearest=keepers.reduce((best,k)=>distance(k.place)<(best?distance(best.place):NEAR_ENTER)?k:best,null);
  if(!nearest)return;
  nearbyPlace=nearest.place;atPlace=nearest.place;
  if(current!==nearest.place){
    current=nearest.place;setContent(current,{popup:true});
    window.history.replaceState(null,'','#'+current);
    clearTimeout(replyTimer);$('#keeper-reply').hidden=true;
    clearTimeout(toastTimer);$('#travel-toast').classList.remove('show');
    $('#travel-toast').textContent=`${nearest.section} opened.`;
  }
  $('#location-state').textContent='You are here';
  $('#world').classList.remove('traveling');
  updateKeeperStates();reactToArrival(nearest.place);
}
function updateKeeperStates() {
  for(const k of keepers){
    const active=k.place===current;
    k.button.classList.toggle('selected',active);
    if(active)k.button.setAttribute('aria-current','location');else k.button.removeAttribute('aria-current');
    setGameText(k.button.querySelector('.keeper-clan'), `<${active?'Now':k.clan}>`);
  }
}
function setAim(value,{focus=false}={}) {
  if(value)clearMovementInput();
  aiming=value;$('#world').classList.toggle('aiming',value);$('#spell').setAttribute('aria-pressed',String(value));
  $('#spell-hint').textContent=value?'Aim with the pointer and click':'Aim a spell';
  if(focus&&value)canvas.focus({preventScroll:true});
  requestDraw();
}
function setContent(place,{popup=false,animate=true}={}) {
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
function go(place,{history:writeHistory=true,instant=false,announce=true,cast=false,animateContent=true}={}) {
  if(!spots[place])return;mobileExploring=false;mobilePanX=mobilePanY=0;if(frontierState.open)dismissFrontier({focus:false});
  nearbyPlace=null;
  resetJoystick();heldDirections.clear();
  clearTimeout(toastTimer);$('#travel-toast').classList.remove('show');$('#travel-toast').textContent='';
  $('#world').classList.remove('walking');
  atPlace=null;current=place;setAim(false);clearTimeout(replyTimer);$('#keeper-reply').hidden=true;
  setContent(place,{popup:!instant&&ready&&!cast,animate:animateContent});
  if(writeHistory && location.hash!=='#'+place)window.history.pushState(null,'','#'+place);
  rings=[];
  camera.targetX=990+(spots[place].x-990)*.07;camera.targetY=530+(spots[place].y-530)*.05;
  if(motionOff()||instant){camera.x=camera.targetX;camera.y=camera.targetY;}
  const destination={place,near:!instant&&ready};
  const points=navigationPath(destination);
  if(cast&&!motionOff()&&!instant&&ready){
    rings.push({x:hero.x,y:hero.y,age:0,duration:.32});
    spell={place,x:spots[place].x,y:spots[place].y-32,age:0,delay:.12,duration:.12+apocalipsis.duration,hit:false};
    hero.dir=heading(spots[place].x-hero.x,spots[place].y-hero.y);
  }
  $('#location-state').textContent=`Walking to ${spots[place].section}…`;
  $('#world').classList.add('traveling');
  moveHero(points,{instant:instant||!ready,destination,complete:()=>{arrive(place,announce);if(cast&&compactMode()&&ready&&!instant)openZoneInfo(place,{arrival:true});}});
  updateKeeperStates();requestDraw();
}
function toast(message) {
  $('#travel-toast').textContent=message;$('#travel-toast').classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#travel-toast').classList.remove('show'),2600);
}
function setMotionState() {
  updateFrontierPauseUI();
  const off=motionOff();
  $('#world').classList.toggle('motion-off',off);
  $('#motion').textContent=off?'▷':'Ⅱ';
  $('#motion').setAttribute('aria-label',motionPreference.matches?'Reduced motion is on':paused?'Resume world animation':'Pause world animation');
  $('#motion').setAttribute('aria-pressed',String(off));
  $('#motion').disabled=motionPreference.matches;
  $('#motion').title=motionPreference.matches?'Following your reduced-motion preference':paused?'Resume animation':'Pause animation';
  if(off){
    resetJoystick();heldDirections.clear();
    if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;
    const pending=route;route=null;spell=null;rings=[];
    if(pending){const points=pending.destination?navigationPath(pending.destination):[pending.target],target=points.at(-1);if(target&&townPhysics.free(target.x,target.y,[...keepers,...npcs],hero)){const before={x:hero.x,y:hero.y};hero.x=target.x;hero.y=target.y;const intercepted=pending.explore&&tryFrontier(before,hero);if(!intercepted){if(pending.explore)checkNearbySection();pending.complete?.();}}else{$('#location-state').textContent='Path blocked';$('#world').classList.remove('traveling');}}
    camera.x=camera.targetX;camera.y=camera.targetY;
    for(const a of [...npcs,...keepers])a.reaction=0;
    for(const animation of $('#world').getAnimations({subtree:true}))animation.cancel();
  }
  last=performance.now();requestDraw();
}

const names=[['Aren','Ranger','4,820'],['Sombra','Mage','4,610'],['Elara','Warrior','4,380'],['Nox','Cleric','4,170'],['Kael','Paladin','3,960'],['Lyra','Bard','3,820'],['Corvus','Assassin','3,710'],['Mara','Druid','3,590'],['Rook','Warrior','3,460'],['Ash','Mage','3,310']];
function content(place){
  if(place==='arena')return `<span class="eyebrow">GAME · IN DEVELOPMENT</span><h2>PvP with something<br>at stake.</h2><p>Manual aiming. Distinct classes. Essence worth fighting for.</p><div class="steps"><div class="step"><div><h3>Find a fight.</h3><p>Meet in Nix, join the shared queue and vote for a match type.</p></div></div><div class="step"><div><h3>Carry essence.</h3><p>Earn essence from eligible kills. What you carry stays at risk.</p></div></div><div class="step"><div><h3>Bring it home.</h3><p>Deposit essence to secure it. Progress comes from active play.</p></div></div></div><div class="mode-list"><span>Free-for-all</span><span>Squads of three</span><span>Factions</span></div><p class="small-note">This is the planned game loop. Rules and availability are still in development.</p>`;
  if(place==='hall')return `<span class="eyebrow">RANKINGS</span><h2>Rankings preview</h2><p>Sample players and scores. Live rankings are not connected yet.</p><div class="tabs" role="group" aria-label="Ranking category"><button class="active" data-rank="essence" aria-pressed="true">Essence</button><button data-rank="support" aria-pressed="false">Support</button></div><div id="ranks">${rankRows('essence')}</div><p class="small-note">Categories, seasons and public profiles are still being designed.</p>`;
  if(place==='gate')return `<span class="eyebrow">DOWNLOAD</span><h2>Download Entia</h2><p>No game download is available in this preview.</p><div class="download-card"><span class="status">NOT AVAILABLE YET</span><h3>Entia for desktop</h3><p class="platform">The release build and supported platforms will be listed here.</p><button class="primary" disabled>Download unavailable</button></div><button class="quiet" data-place="arena">About the game</button>`;
  return '';
}
function rankRows(mode){const rows=mode==='support'?[names[3],names[5],names[7],names[1],names[8],names[4],names[0],names[2],names[9],names[6]]:names;return rows.map((n,i)=>`<div class="rank-row"><span class="rank-number">${String(i+1).padStart(2,'0')}</span><img class="rank-avatar" src="assets/portraits/${i%3}.png" alt=""><span class="rank-info"><b>${n[0]}</b><small>${n[1]}</small></span><span class="rank-score">${mode==='essence'?n[2]:Math.round(930-i*67).toLocaleString()}</span></div>`).join('');}

function focusContentIfNeeded(trigger) {
  // Keep navigation focus in place. Content links that disappear hand focus to the new section.
  if(trigger && $('#main-content').contains(trigger)){
    const heading=$('#section-heading');(heading||$('#main-content')).focus({preventScroll:true});
  }
}
document.addEventListener('click',event=>{
  if(compactMode()&&event.target.closest('.skip-link')){event.preventDefault();openZoneInfo(current);return;}
  if(event.target.closest('#portal-journey')){walkToPortal();canvas.focus({preventScroll:true});return;}
  const destination=event.target.closest('button[data-place], a[data-place]');
  if(destination){event.preventDefault();go(destination.dataset.place,{cast:!!destination.dataset.cast});focusContentIfNeeded(destination);return;}
  const rank=event.target.closest('[data-rank]');
  if(rank){
    $$('[data-rank]').forEach(b=>{b.classList.toggle('active',b===rank);b.setAttribute('aria-pressed',String(b===rank));});
    $('#ranks').innerHTML=rankRows(rank.dataset.rank);return;
  }


});
canvas.addEventListener('pointermove',event=>{canvas.style.cursor=aiming?'crosshair':'pointer';});
canvas.addEventListener('click',event=>{
  if(!ready||enteringPortal||frontierState.open)return;
  const bounds=canvas.getBoundingClientRect(),x=(event.clientX-bounds.left-ox)/scale,y=(event.clientY-bounds.top-oy)/scale;
  if(aiming){castPointer(x,y);return;}
  if(Math.abs(x-homePortal.x)<85&&y>homePortal.y-238&&y<homePortal.y+25){walkToPortal();return;}
  const keeper=keepers.find(k=>Math.hypot(k.x-x,(k.y-25)-y)<46);
  if(keeper){go(keeper.place,{cast:true});return;}

  if(aiming){toast('Click Home, Game, Rankings or Download.');return;}
  if(!isWalkable(x,y)&&tryFrontier(hero,{x,y},'attempt'))return;
  if(isWalkable(x,y)){
    resetJoystick();heldDirections.clear();beginManualMovement();
    moveHero(walkingPath({x,y}),{explore:true,complete:checkWalkingProgress});
  }
});


for(const type of ['touchstart','touchmove'])$('#joystick-pad').addEventListener(type,event=>{if(event.cancelable)event.preventDefault();},{passive:false});
$('#joystick-pad').addEventListener('pointerdown',startJoystick);
$('#joystick-pad').addEventListener('pointermove',updateJoystick);
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('#joystick-pad').addEventListener(type,stopJoystick);
$('#joystick-pad').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
$('#mobile-about').onclick=()=>$('#about').onclick();
$('#frontier-resume').onclick=()=>{paused=false;setMotionState();};
$('#frontier-download').onclick=skipFrontierWalk;$('#frontier-stay').onclick=()=>dismissFrontier();
$('#close-panel').onclick=()=>{if($('#zone-dialog').open){closeZoneInfo();return;}go('home');$('.nav[data-place="home"]').focus({preventScroll:true});};
$('#spell').onclick=()=>setAim(!aiming);
$('#motion').onclick=()=>{paused=!paused;setMotionState();};
$('#zoom-in').onclick=()=>{zoom=Math.min(1.18,zoom+.06);resize();};
$('#zoom-out').onclick=()=>{zoom=Math.max(.88,zoom-.06);resize();};
$('#reset-view').onclick=()=>{mobileExploring=false;mobilePanX=mobilePanY=0;zoom=1;camera.x=camera.targetX;camera.y=camera.targetY;resize();};
$('#about').onclick=()=>{if(frontierState.open)dismissFrontier({focus:false});clearMovementInput();$('#notes').showModal();};
$('#close-notes').onclick=()=>$('#notes').close();
$('#retry-load').onclick=load;
document.addEventListener('keydown',event=>{
  if(enteringPortal||demoOpen)return;
  if(frontierState.open){if(event.key==='Escape'){event.preventDefault();dismissFrontier();}else if(event.key.startsWith('Arrow')||event.key===' ')event.preventDefault();return;}
  if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||$('#notes').open||$('#character-dialog').open||$('#zone-dialog').open||frontierState.open)return;
  const movementKey=event.key.length===1?event.key.toLowerCase():event.key;
  if(Object.hasOwn(movementKeys,movementKey)){
    if(!ready)return;
    event.preventDefault();
    if(event.repeat)return;
    beginManualMovement();
    if(motionOff()){
      startKeyboardStep(movementKeys[movementKey]);
    }else{
      heldDirections.set(movementKey,movementKeys[movementKey]);startKeyboardStep();requestDraw();
    }
    return;
  }
  if(event.key==='Escape'){
    if(aiming){setAim(false);$('#spell').focus({preventScroll:true});}
    else if(current!=='home'){go('home');$('.nav[data-place="home"]').focus({preventScroll:true});}
    return;
  }
  if(event.key.toLowerCase()==='c'){event.preventDefault();setAim(!aiming,{focus:true});return;}
  const key=Number(event.key);if(key>=1&&key<=4){event.preventDefault();go(Object.keys(spots)[key-1]);}
});
document.addEventListener('keyup',event=>{
  heldDirections.delete(event.key.length===1?event.key.toLowerCase():event.key);
});
document.addEventListener('focusin',event=>{
  if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog'))clearMovementInput();
});
window.addEventListener('blur',clearMovementInput);
window.addEventListener('pointerup',stopJoystick);window.addEventListener('pointercancel',stopJoystick);
window.addEventListener('pagehide',()=>{clearMovementInput();if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;});
function restoreHash(){if(frontierState.open)dismissFrontier({focus:false});const hash=location.hash.slice(1);if(enteringPortal&&hash!=='demo'){enteringPortal=false;$('#portal-transition')?.remove();$('#world').classList.remove('entering-portal');}if(hash==='main-content')return;if(hash==='demo'){showDemo(false);return;}if(demoOpen){closeDemo(false);if(current===(spots[hash]?hash:'home'))return;}go(spots[hash]?hash:'home',{history:false,announce:false});}
window.addEventListener('popstate',restoreHash);
window.addEventListener('hashchange',()=>{const place=location.hash.slice(1);if(place!==current)restoreHash();});
window.addEventListener('resize',resize);window.addEventListener('orientationchange',resetJoystick);
window.visualViewport?.addEventListener('resize',resize);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resize).observe(canvas);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){clearMovementInput();if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;}
  else recoverScene();
});
motionPreference.addEventListener('change',setMotionState);touchPreference.addEventListener('change',resize);
setMotionState();resize();load();

window.addEventListener('pageshow',()=>{recoverScene();if(enteringPortal){document.querySelector('#portal-transition')?.remove();$('#world').classList.remove('entering-portal');enteringPortal=false;hero.x=spots.home.land.x;hero.y=spots.home.land.y;route=null;resize();requestDraw();}});

window.EntiaCharacter?.mount({assets:'assets/',onChange:value=>{hero.body=value.body;setGameText($('#player-label span'),value.name);requestDraw();},onOpen:()=>{if(frontierState.open)dismissFrontier({focus:false});clearMovementInput();route=null;setAim(false);},onClose:()=>requestDraw()});

// Mobile browsers can discard cached canvas pixels while the page is hidden.
function recoverScene(){groundReady=false;worldPatterns=null;if(demoOpen)return;ground.width=W;ground.height=H;last=performance.now();if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;resize();requestDraw();}
for(const surface of [canvas,ground]){surface.addEventListener('contextlost',event=>{event.preventDefault();groundReady=false;if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;});surface.addEventListener('contextrestored',recoverScene);}
for(const surface of document.querySelectorAll('header,.world-meta,.world-toolbar,#locations,#player-label,#keeper-reply,button'))for(const type of ['selectstart','dragstart','contextmenu'])surface.addEventListener(type,event=>event.preventDefault());

function openZoneInfo(place,{animate=true,arrival=false}={}){if(!compactMode())return;clearMovementInput();const dialog=$('#zone-dialog');dialog.classList.toggle('pre-revealed',!animate);dialog.classList.toggle('arrival-effect',arrival);zoneContent=$(place==='home'?'#intro':'#panel');$('#zone-body').append(zoneContent);if(!dialog.open)dialog.showModal();$('#close-zone').focus({preventScroll:true});}
function closeZoneInfo(){const dialog=$('#zone-dialog');dialog.classList.remove('pre-revealed','arrival-effect');if(dialog.open)dialog.close();if(zoneContent){$('#main-content').append(zoneContent);zoneContent=null;}}
$('#close-zone').onclick=closeZoneInfo;
$('#zone-dialog').addEventListener('close',()=>{if(!$('#zone-dialog').open&&zoneContent){$('#main-content').append(zoneContent);zoneContent=null;}});
$('#zone-dialog').addEventListener('click',event=>{if(event.target===$('#zone-dialog'))closeZoneInfo();});
