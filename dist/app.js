'use strict';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const canvas = $('#scene');
const ctx = canvas.getContext('2d');
const W = 1440, H = 900;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let width = 0, height = 0, dpr = 1, scale = 1, ox = 0, oy = 0, zoom = 1;
let time = 0, last = 0, frameRequest = 0, paused = false, ready = false;
let images = {}, current = 'home', route = null, spell = null, rings = [], aiming = false;
let atPlace = 'home', hovered = null, game = false, collected = 0, toastTimer, replyTimer;
let nearbyPlace = null;
const NEAR_ENTER = 72, NEAR_EXIT = 104;
const camera = {x: 990, y: 520, targetX: 990, targetY: 520};
const spots = {
  home: {x: 800, y: 440, section: 'Home', clan: 'Nix', body: 'rogue', greeting: 'Welcome to Nix.', land: {x: 870, y: 470}},
  arena: {x: 1190, y: 345, section: 'Game', clan: 'PvP', body: 'hero', greeting: 'Find your next rival.', land: {x: 1100, y: 410}},
  hall: {x: 1170, y: 655, section: 'Rankings', clan: 'Preview', body: 'mage', greeting: 'Live rankings are coming later.', land: {x: 1075, y: 680}},
  gate: {x: 780, y: 715, section: 'Download', clan: 'Unavailable', body: 'hero', greeting: 'No download is linked yet.', land: {x: 880, y: 725}}
};
const hero = {x: 870, y: 470, body: 'hero', dir: 2, gait: 0, hero: true};
const keepers = Object.entries(spots).map(([place, p]) => ({...p, place, dir: 2, isKeeper: true, reaction: 0}));
const npcs = [
  {x: 975, y: 490, body: 'rogue', dir: 1, way: [[975,490],[1070,490],[1070,530],[975,530]], idx: 1, gait: 0, reaction: 0},
  {x: 1010, y: 730, body: 'mage', dir: 2, way: [[1010,730],[1190,730],[1190,695],[1010,695]], idx: 1, gait: 0, reaction: 0},
  {x: 742, y: 565, body: 'rogue', dir: 0, way: [[742,565],[742,625],[815,625],[815,565]], idx: 1, gait: 0, reaction: 0}
];
const scenery = [
  {id:'house',x:775,y:390,w:240,h:320}, {id:'house2',x:1250,y:630,w:180,h:240},
  {id:'tree',x:595,y:265,w:235,h:294}, {id:'pine',x:437,y:325,w:240,h:240}, {id:'tree2',x:1360,y:282,w:255,h:320},
  {id:'pine',x:1385,y:640,w:280,h:280}, {id:'tree',x:652,y:865,w:260,h:325}, {id:'tree2',x:325,y:750,w:310,h:387},
  {id:'tree',x:555,y:115,w:225,h:282}, {id:'pine',x:960,y:142,w:200,h:200}, {id:'tree2',x:1395,y:890,w:250,h:312}
];
const treasures = [{x:914,y:505},{x:1255,y:745},{x:990,y:755}].map(p => ({...p,collected:false}));
const ground = document.createElement('canvas');
ground.width = W; ground.height = H;
let groundReady = false;
// RAO movement: 32 world units per tile, 0.20 s/player step, 0.40 s/NPC step.
const WALK_TILE = 32, WALK_SPEED = WALK_TILE/.20, NPC_SPEED = WALK_TILE/.40;
const walkCycleTiles = {hero:2, rogue:1, mage:2};
const heldDirections = new Map();
const movementKeys = {w:0,ArrowUp:0,d:1,ArrowRight:1,s:2,ArrowDown:2,a:3,ArrowLeft:3};
const directions = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const motionOff = () => paused || motionPreference.matches;
const heading = (dx,dy) => Math.abs(dx)>Math.abs(dy) ? (dx>0?1:3) : (dy>0?2:0);
const screen = p => ({x:p.x*scale+ox, y:p.y*scale+oy});

// Original FONT_DIALOG glyphs from the client, displayed at their native pixel size.
const nameGlyphs = {"<":[21485,8,14],">":[21486,8,14],"D":[21429,8,14],"G":[21432,8,14],"H":[21433,8,14],"N":[21439,8,14],"O":[21440,9,14],"P":[21441,7,14],"R":[21443,8,14],"U":[21446,8,14],"Y":[21450,7,14],"a":[21400,7,14],"b":[21401,7,14],"d":[21403,7,14],"e":[21404,7,14],"g":[21406,7,14],"i":[21408,3,14],"k":[21410,8,14],"l":[21411,3,14],"m":[21412,11,14],"n":[21413,7,14],"o":[21414,7,14],"r":[21417,5,14],"s":[21418,6,14],"v":[21421,7,14],"w":[21422,9,14],"x":[21423,8,14]};

function setGameText(element, text) {
  if (element.dataset.gameText === text) return;
  element.dataset.gameText = text;
  // Keep real accessible text alongside the exact game glyphs.
  element.textContent = text;
  element.classList.add('game-text');
  const art = document.createElement('span');
  art.className = 'game-glyphs';
  art.setAttribute('aria-hidden', 'true');
  for (const character of text) {
    const [id,w,h] = nameGlyphs[character];
    const glyph = document.createElement('img');
    glyph.src = `assets/font-dialog/${id}.png`;
    glyph.alt = ''; glyph.width = w; glyph.height = h;
    art.append(glyph);
  }
  element.append(art);
}

// Labels are real buttons, so the same spell works with mouse, touch and keyboard.
for (const keeper of keepers) {
  const button = document.createElement('button');
  button.className = 'keeper';
  button.dataset.place = keeper.place;
  button.dataset.cast = 'true';
  button.setAttribute('aria-label', `Open ${keeper.section} with Apocalipsis`);
  button.innerHTML = `<span class="keeper-label"><strong>${keeper.section}</strong><small class="keeper-clan">&lt;${keeper.clan}&gt;</small></span><span class="keeper-hit" aria-hidden="true"><span class="target-reticle">⌖</span></span>`;
  setGameText(button.querySelector('strong'), keeper.section);
  button.addEventListener('pointerenter', () => { hovered=keeper.place; requestDraw(); });
  button.addEventListener('pointerleave', () => { hovered=null; requestDraw(); });
  button.addEventListener('focus', () => { hovered=keeper.place; requestDraw(); });
  button.addEventListener('blur', () => { hovered=null; requestDraw(); });
  $('#locations').append(button);
  keeper.button = button;
}
setGameText($('#player-label span'), 'YOU');

function viewport() {
  const compact = width <= 900;
  const left = compact ? 0 : clamp(width*.33, 320, 450);
  const bottom = compact ? (width <= 600 ? 110 : 96) : 100;
  // On small screens content follows the square, instead of covering its keepers.
  const sceneHeight = compact ? Math.min(height, width <= 600 ? 480 : 570) : height;
  const availableWidth = width-left;
  scale = Math.min(availableWidth/770, (sceneHeight-120)/680, 1.32)*zoom;
  scale = Math.max(scale, .38);
  ox = left + availableWidth*.50 - camera.x*scale;
  oy = 94 + (sceneHeight-94-bottom)*.50 - camera.y*scale;
}
function resize() {
  const rect = canvas.getBoundingClientRect();
  width = rect.width; height = rect.height;
  dpr = Math.max(1, Math.min(devicePixelRatio || 1, 2));
  canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
  viewport(); positionLabels(); requestDraw();
}
function positionLabels() {
  for (const k of keepers) {
    const p = screen(k);
    k.button.style.transform = `translate3d(${Math.round(p.x)}px,${Math.round(p.y)}px,0) translate(-50%, -100%)`;
    // The hit target covers the sprite; CSS anchors its name below the feet.
    k.button.querySelector('.keeper-hit').style.height = `${Math.round(64*scale)}px`;
  }
  const p = screen(hero);
  $('#player-label').style.transform = `translate3d(${Math.round(p.x)}px,${Math.round(p.y+3)}px,0) translateX(-50%)`;
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
    const response = await fetch('assets/site-assets.json');
    if(!response.ok) throw new Error('Asset manifest unavailable');
    const assets = await response.json();
    await Promise.all(Object.entries(assets.images).map(async ([key,file]) => images[key] = await loadImage('assets/'+file)));
    ready = true;
    $('#loading').hidden = true;
    const initial = spots[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
    go(initial, {history:false, instant:true, announce:false});
    resize(); requestDraw();
  } catch(error) {
    $('#loading p').textContent='Nix could not load. You can still explore using the navigation above.';
    $('#retry-load').hidden=false;
    console.error(error);
  }
}
function buildGround() {
  const c=ground.getContext('2d'); c.imageSmoothingEnabled=false;
  c.fillStyle=images.grass?c.createPattern(images.grass,'repeat'):'#33472a';
  c.fillRect(0,0,W,H);
  const road=(x,y,w,h) => {
    c.save(); c.beginPath(); c.rect(x,y,w,h); c.clip();
    for(let yy=Math.floor(y/40)*40;yy<y+h;yy+=40) for(let xx=Math.floor(x/40)*40;xx<x+w;xx+=40) c.drawImage(images.path,xx,yy,40,40);
    c.restore();
  };
  road(735,455,88,340); road(785,447,473,76); road(853,475,86,290); road(855,665,400,82); road(1075,320,165,177); road(757,397,145,105);
  for(let y=195;y<350;y+=40) for(let x=1055;x<1335;x+=40) c.drawImage(images.stone,x,y,40,40);
  const shade=c.createRadialGradient(1000,500,200,980,500,780);
  shade.addColorStop(0,'#dbc58308'); shade.addColorStop(1,'#0a190dbb');
  c.fillStyle=shade; c.fillRect(0,0,W,H); groundReady=true;
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
  const walking=!motionOff() && (a.hero ? !!route : !a.isKeeper && a.reaction<=0);
  // Body 156 walks through seven drawings over two tiles; body 502 over one.
  const stride=(a.gait||0)/(WALK_TILE*walkCycleTiles[a.body]);
  const frame=walking ? 1+Math.floor((stride%1)*7) : 0;
  const fw=im.width/8, fh=im.height/4, dw=60, dh=fh/fw*dw;
  ellipse(a.x,a.y+2,18,6,'rgba(7,20,12,.62)');
  if(a.hero)ellipse(a.x,a.y+2,25,10,'#e7c885',true,1.5);
  ctx.drawImage(im,frame*fw,a.dir*fh,fw,fh,Math.round(a.x-dw/2),Math.round(a.y-dh),dw,dh);
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
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#102017';ctx.fillRect(0,0,width,height);
  ctx.translate(ox,oy);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=false;
  if(!groundReady)buildGround();ctx.drawImage(ground,0,0);
  drawDestination();
  const layers=[...scenery.map(s=>({...s,type:'scenery'})),...npcs,...keepers,hero].sort((a,b)=>a.y-b.y);
  for(const a of layers){
    if(a.type==='scenery'){
      ellipse(a.x+15,a.y+7,a.w*.38,a.w*.1,'#07130c40');
      ctx.drawImage(images[a.id],a.x-a.w/2,a.y-a.h,a.w,a.h);
    }else drawActor(a);
  }
  if(game)for(let i=0;i<treasures.length;i++){
    const p=treasures[i];if(p.collected)continue;
    const bob=motionOff()?0:Math.sin(time*2.5+i)*4;
    glow(p.x,p.y-12+bob,32,.9);
    ctx.fillStyle='#d4edc7';ctx.beginPath();ctx.moveTo(p.x,p.y-22+bob);ctx.lineTo(p.x+5,p.y-12+bob);ctx.lineTo(p.x,p.y-2+bob);ctx.lineTo(p.x-5,p.y-12+bob);ctx.closePath();ctx.fill();
  }
  drawSpell();
  if(!motionOff())for(let i=0;i<12;i++){
    const x=690+(i*83)%650+Math.sin(time*.2+i)*12,y=255+(i*61)%480+Math.cos(time*.3+i)*8;
    ctx.fillStyle=`rgba(225,219,154,${.1+.12*(Math.sin(time+i)+1)})`;ctx.fillRect(x,y,2,2);
  }
}
function requestDraw() {
  if(!ready||document.hidden||frameRequest)return;
  frameRequest=requestAnimationFrame(tick);
}
function tick(now) {
  frameRequest=0;
  const dt=Math.min((now-last)/1000||0,.04);last=now;
  if(!motionOff()){
    time+=dt;
    advanceMovement(dt);
    advanceSpell(dt);
    rings=rings.filter(r=>(r.age+=dt)<r.duration);
    for(const n of [...npcs,...keepers]){
      if(n.reaction>0){n.reaction=Math.max(0,n.reaction-dt);n.dir=heading(hero.x-n.x,hero.y-n.y);continue;}
      if(n.isKeeper)continue;
      const [x,y]=n.way[n.idx],dx=x-n.x,dy=y-n.y,d=Math.hypot(dx,dy),step=Math.min(NPC_SPEED*dt,d);
      n.dir=heading(dx,dy);
      if(d<1)n.idx=(n.idx+1)%n.way.length;else{n.x+=dx/d*step;n.y+=dy/d*step;n.gait+=step;}
    }
    const blend=1-Math.exp(-dt*7);
    camera.x+=(camera.targetX-camera.x)*blend;camera.y+=(camera.targetY-camera.y)*blend;
  }
  viewport();positionLabels();draw();
  if(!motionOff())requestDraw();
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
  const r=route;r.elapsed+=dt;
  const u=clamp(r.elapsed/r.duration,0,1);
  const distance=r.length*u;
  let remaining=distance,from={x:r.sx,y:r.sy},p=r.target;
  for(let i=0;i<r.points.length;i++){
    const to=r.points[i],length=Math.hypot(to.x-from.x,to.y-from.y);
    if(remaining<=length||i===r.points.length-1){
      const t=length?clamp(remaining/length,0,1):1;
      p={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
      hero.dir=heading(to.x-from.x,to.y-from.y);r.segment=i;break;
    }
    remaining-=length;from=to;
  }
  hero.gait+=distance-r.distance;r.distance=distance;hero.x=p.x;hero.y=p.y;
  if(r.explore)checkNearbySection();
  if(u===1){route=null;r.complete?.();}
}
function moveHero(points,{complete,instant=false,manual=false,explore=manual}={}) {
  const target=points.at(-1);let from=hero,length=0;
  for(const p of points){length+=Math.hypot(p.x-from.x,p.y-from.y);from=p;}
  // Every new action replaces the previous route and its completion callback.
  route=null;
  if(motionOff()||instant||length<2){hero.x=target.x;hero.y=target.y;if(explore)checkNearbySection();complete?.();requestDraw();return;}
  route={sx:hero.x,sy:hero.y,target,points,segment:0,length,distance:0,elapsed:0,duration:length/WALK_SPEED,complete,manual,explore};
  requestDraw();
}
function walkingPath(target) {
  const points=[];let from={x:hero.x,y:hero.y};
  const add=(x,y)=>{if(Math.hypot(x-from.x,y-from.y)>.001){from={x,y};points.push(from);}};
  // Finish the current cardinal footstep before a newly requested turn.
  if(route){
    const next=route.points[route.segment],remaining=Math.hypot(next.x-hero.x,next.y-hero.y);
    const step=Math.min(WALK_TILE-(hero.gait%WALK_TILE),remaining);
    if(remaining>.001)add(hero.x+(next.x-hero.x)/remaining*step,hero.y+(next.y-hero.y)/remaining*step);
  }
  // Walk around the eastern house when returning from the lower square.
  if(from.x>1140&&target.y<650)add(1100,from.y);
  if(target.y<400&&from.x<1075)add(1100,from.y);
  add(from.x,target.y);add(target.x,target.y);
  return points.length?points:[{x:target.x,y:target.y}];
}
function isWalkable(x,y) {
  const square=x>=720&&x<=1300&&y>=400&&y<=780 && !(x>1140&&y<650);
  const arena=x>=1075&&x<=1320&&y>=310&&y<=390;
  const passage=x>=1075&&x<=1140&&y>=390&&y<=400;
  return square||arena||passage;
}
function clearMovementInput() {
  heldDirections.clear();
  if(route?.manual)route=null;
  requestDraw();
}
function beginManualMovement() {
  // Keep the in-progress footstep, but discard the old destination/reward callback.
  if(route&&!route.manual){
    const next=route.points[route.segment],distance=Math.hypot(next.x-hero.x,next.y-hero.y);
    const step=Math.min(WALK_TILE-(hero.gait%WALK_TILE),distance);
    if(distance>.001)moveHero([{x:hero.x+(next.x-hero.x)/distance*step,y:hero.y+(next.y-hero.y)/distance*step}],{manual:true,complete:checkWalkingProgress});
    else route=null;
  }
  atPlace=null;spell=null;setAim(false);clearTimeout(replyTimer);$('#keeper-reply').hidden=true;
  $('#world').classList.remove('traveling');
  $('#location-state').textContent=game?'Collect the three lights':'Exploring Nix';
  updateKeeperStates();
}
function startKeyboardStep(direction=[...heldDirections.values()].at(-1)) {
  if(route||direction===undefined||!ready)return;
  const vector=directions[direction],target={x:hero.x+vector.x*WALK_TILE,y:hero.y+vector.y*WALK_TILE};
  hero.dir=direction;
  // Four-direction steps cannot cut through the house or leave the square.
  if(!isWalkable(target.x,target.y)){requestDraw();return;}
  moveHero([target],{manual:true,complete:checkWalkingProgress});
}
function advanceMovement(dt) {
  if(!route)startKeyboardStep();
  if(route)advanceRoute(dt);
  if(!route)startKeyboardStep();
}
function checkWalkingProgress() {
  if(!game)return;
  treasures.forEach((light,index)=>{if(Math.hypot(light.x-hero.x,light.y-hero.y)<27)takeLight(index);});
  if(collected===3&&Math.hypot(hero.x-spots.home.land.x,hero.y-spots.home.land.y)<27)go('home');
}
function checkNearbySection() {
  // Exploration opens content in place. Never redirect the walk, release held
  // keys, cast a spell, or interrupt collecting lights to select a section.
  if(game)return;
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
    current=nearest.place;setContent(current);
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
  $('#spell-hint').textContent=value?'Click a character':'Choose a character';
  if(focus&&value)keepers.find(k=>k.place!==current).button.focus({preventScroll:true});
  requestDraw();
}
function setContent(place) {
  const home=place==='home';
  $('#main-content').scrollTop=0;
  $('#intro').hidden=!home;$('#panel').hidden=home;$('#essence-game').hidden=true;
  $('#world').classList.toggle('panel-open',!home);
  if(!home){
    $('#panel-content').innerHTML=content(place).replace('<h2>','<h2 id="section-heading" tabindex="-1">');
    $('#panel').scrollTop=0;
    if(!motionOff())$('#panel-content').animate([{opacity:.35,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});
  }
  $('#location-name').textContent=spots[place].section;
  $('#footer-place').textContent=spots[place].section.toUpperCase();
  $('#world').dataset.place=place;
  for(const button of $$('.nav')){
    const active=button.dataset.place===place;button.classList.toggle('active',active);
    if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
}
function go(place,{history:writeHistory=true,instant=false,announce=true,cast=false}={}) {
  if(!spots[place])return;
  nearbyPlace=null;
  heldDirections.clear();
  clearTimeout(toastTimer);$('#travel-toast').classList.remove('show');$('#travel-toast').textContent='';
  const secured=game&&place==='home'&&collected===3;
  game=false;$('#world').classList.remove('walking');
  atPlace=null;current=place;setAim(false);clearTimeout(replyTimer);$('#keeper-reply').hidden=true;
  setContent(place);
  if(writeHistory && location.hash!=='#'+place)window.history.pushState(null,'','#'+place);
  spell=null;rings=[];
  camera.targetX=990+(spots[place].x-990)*.07;camera.targetY=530+(spots[place].y-530)*.05;
  if(motionOff()||instant){camera.x=camera.targetX;camera.y=camera.targetY;}
  const points=walkingPath(spots[place].land);
  if(cast&&!motionOff()&&!instant&&ready){
    rings.push({x:hero.x,y:hero.y,age:0,duration:.32});
    spell={place,x:spots[place].x,y:spots[place].y-32,age:0,delay:.12,duration:.12+apocalipsis.duration,hit:false};
    hero.dir=heading(spots[place].x-hero.x,spots[place].y-hero.y);
  }
  $('#location-state').textContent=`Walking to ${spots[place].section}…`;
  $('#world').classList.add('traveling');
  moveHero(points,{instant:instant||!ready,complete:()=>{arrive(place,announce);if(secured)toast('All three lights carried home. Journey complete.');}});
  updateKeeperStates();requestDraw();
}
function toast(message) {
  $('#travel-toast').textContent=message;$('#travel-toast').classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#travel-toast').classList.remove('show'),2600);
}
function setMotionState() {
  const off=motionOff();
  $('#world').classList.toggle('motion-off',off);
  $('#motion').textContent=off?'▷':'Ⅱ';
  $('#motion').setAttribute('aria-label',motionPreference.matches?'Reduced motion is on':paused?'Resume world animation':'Pause world animation');
  $('#motion').setAttribute('aria-pressed',String(off));
  $('#motion').disabled=motionPreference.matches;
  $('#motion').title=motionPreference.matches?'Following your reduced-motion preference':paused?'Resume animation':'Pause animation';
  if(off){
    heldDirections.clear();
    if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;
    const pending=route;route=null;spell=null;rings=[];
    if(pending){hero.x=pending.target.x;hero.y=pending.target.y;if(pending.explore)checkNearbySection();pending.complete?.();}
    camera.x=camera.targetX;camera.y=camera.targetY;
    for(const a of [...npcs,...keepers])a.reaction=0;
    for(const animation of $('#world').getAnimations({subtree:true}))animation.cancel();
  }
  last=performance.now();requestDraw();
}

const names=[['Aren','Ranger','4,820'],['Sombra','Mage','4,610'],['Elara','Warrior','4,380'],['Nox','Cleric','4,170'],['Kael','Paladin','3,960'],['Lyra','Bard','3,820'],['Corvus','Assassin','3,710'],['Mara','Druid','3,590'],['Rook','Warrior','3,460'],['Ash','Mage','3,310']];
function content(place){
  if(place==='arena')return `<span class="eyebrow">GAME · IN DEVELOPMENT</span><h2>PvP with something<br>at stake.</h2><p>Manual aiming. Distinct classes. Essence worth fighting for.</p><div class="steps"><div class="step"><div><h3>Find a fight.</h3><p>Meet in Nix, join the shared queue and vote for a match type.</p></div></div><div class="step"><div><h3>Carry essence.</h3><p>Earn essence from eligible kills. What you carry stays at risk.</p></div></div><div class="step"><div><h3>Bring it home.</h3><p>Deposit essence to secure it. Progress comes from active play.</p></div></div></div><div class="mode-list"><span>Free-for-all</span><span>Squads of three</span><span>Factions</span></div><p class="small-note">This is the planned game loop. Rules and availability are still in development.</p><button class="quiet" id="try-journey">Try collecting lights in Nix</button>`;
  if(place==='hall')return `<span class="eyebrow">RANKINGS</span><h2>Rankings preview</h2><p>Sample players and scores. Live rankings are not connected yet.</p><div class="tabs" role="group" aria-label="Ranking category"><button class="active" data-rank="essence" aria-pressed="true">Essence</button><button data-rank="support" aria-pressed="false">Support</button></div><div id="ranks">${rankRows('essence')}</div><p class="small-note">Categories, seasons and public profiles are still being designed.</p>`;
  if(place==='gate')return `<span class="eyebrow">DOWNLOAD</span><h2>Download Entia</h2><p>No game download is available in this preview.</p><div class="download-card"><span class="status">NOT AVAILABLE YET</span><h3>Entia for desktop</h3><p class="platform">The release build and supported platforms will be listed here.</p><button class="primary" disabled>Download unavailable</button></div><button class="quiet" data-place="arena">About the game</button>`;
  return '';
}
function rankRows(mode){const rows=mode==='support'?[names[3],names[5],names[7],names[1],names[8],names[4],names[0],names[2],names[9],names[6]]:names;return rows.map((n,i)=>`<div class="rank-row"><span class="rank-number">${String(i+1).padStart(2,'0')}</span><img class="rank-avatar" src="assets/portraits/${i%3}.png" alt=""><span class="rank-info"><b>${n[0]}</b><small>${n[1]}</small></span><span class="rank-score">${mode==='essence'?n[2]:Math.round(930-i*67).toLocaleString()}</span></div>`).join('');}

function startGame() {
  heldDirections.clear();
  nearbyPlace=null;
  route=null;spell=null;rings=[];atPlace=null;game=true;collected=0;
  treasures.forEach(p=>p.collected=false);
  setAim(false);$('#world').classList.remove('traveling','panel-open');$('#world').classList.add('walking');
  $('#intro').hidden=true;$('#panel').hidden=true;$('#essence-game').hidden=false;
  $('#location-state').textContent='Collect the three lights';updateKeeperStates();
  $('#essence-count').textContent='0 / 3 lights';
  for(const button of $$('[data-essence]')){button.disabled=false;button.textContent=`Light ${Number(button.dataset.essence)+1}`;}
  toast('Walk to a light, click it, or use a Light button.');requestDraw();
}
function takeLight(index) {
  const p=treasures[index];if(!game||!p||p.collected)return;
  p.collected=true;collected++;
  $('#essence-count').textContent=`${collected} / 3 lights`;
  const button=$(`[data-essence="${index}"]`);button.textContent=`Light ${index+1} collected`;button.disabled=true;
  if(collected===3)toast('All three collected. Return to Home.');requestDraw();
}
function collectLight(index) {
  const p=treasures[index];if(!game||!p||p.collected)return;
  heldDirections.clear();
  moveHero(walkingPath(p),{complete:()=>takeLight(index)});
}
function focusContentIfNeeded(trigger) {
  // Keep navigation focus in place. Content links that disappear hand focus to the new section.
  if(trigger && $('#main-content').contains(trigger)){
    const heading=$('#section-heading');(heading||$('#main-content')).focus({preventScroll:true});
  }
}
document.addEventListener('click',event=>{
  const destination=event.target.closest('button[data-place], a[data-place]');
  if(destination){event.preventDefault();go(destination.dataset.place,{cast:true});focusContentIfNeeded(destination);return;}
  const rank=event.target.closest('[data-rank]');
  if(rank){
    $$('[data-rank]').forEach(b=>{b.classList.toggle('active',b===rank);b.setAttribute('aria-pressed',String(b===rank));});
    $('#ranks').innerHTML=rankRows(rank.dataset.rank);return;
  }
  const light=event.target.closest('[data-essence]');if(light){collectLight(Number(light.dataset.essence));return;}
  if(event.target.closest('#try-journey')){startGame();$('#main-content').focus({preventScroll:true});}
});
canvas.addEventListener('click',event=>{
  if(!ready)return;
  const bounds=canvas.getBoundingClientRect(),x=(event.clientX-bounds.left-ox)/scale,y=(event.clientY-bounds.top-oy)/scale;
  const keeper=keepers.find(k=>Math.hypot(k.x-x,(k.y-25)-y)<46);
  if(keeper){go(keeper.place,{cast:true});return;}
  if(game){const index=treasures.findIndex(p=>!p.collected&&Math.hypot(p.x-x,p.y-y)<55);if(index>=0){collectLight(index);return;}}
  if(aiming){toast('Click Home, Game, Rankings or Download.');return;}
  if(isWalkable(x,y)){
    heldDirections.clear();beginManualMovement();
    moveHero(walkingPath({x,y}),{explore:true,complete:checkWalkingProgress});
  }
});
$('#wander').onclick=()=>{startGame();$('#main-content').focus({preventScroll:true});};
$('#leave-game').onclick=()=>{go('home');$('#wander').focus({preventScroll:true});};
$('#close-panel').onclick=()=>{go('home');$('.nav[data-place="home"]').focus({preventScroll:true});};
$('#spell').onclick=()=>setAim(!aiming);
$('#motion').onclick=()=>{paused=!paused;setMotionState();};
$('#zoom-in').onclick=()=>{zoom=Math.min(1.18,zoom+.06);resize();};
$('#zoom-out').onclick=()=>{zoom=Math.max(.88,zoom-.06);resize();};
$('#reset-view').onclick=()=>{zoom=1;camera.x=camera.targetX;camera.y=camera.targetY;resize();};
$('#about').onclick=()=>{clearMovementInput();$('#notes').showModal();};
$('#close-notes').onclick=()=>$('#notes').close();
$('#retry-load').onclick=load;
document.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||$('#notes').open)return;
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
    else if(current!=='home'||game){go('home');$('.nav[data-place="home"]').focus({preventScroll:true});}
    return;
  }
  if(event.key.toLowerCase()==='c'){event.preventDefault();setAim(!aiming,{focus:true});return;}
  const key=Number(event.key);if(key>=1&&key<=4){event.preventDefault();go(Object.keys(spots)[key-1],{cast:true});}
});
document.addEventListener('keyup',event=>{
  heldDirections.delete(event.key.length===1?event.key.toLowerCase():event.key);
});
document.addEventListener('focusin',event=>{
  if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog'))clearMovementInput();
});
window.addEventListener('blur',clearMovementInput);
function restoreHash(){const hash=location.hash.slice(1);if(hash==='main-content')return;go(spots[hash]?hash:'home',{history:false,announce:false});}
window.addEventListener('popstate',restoreHash);
window.addEventListener('hashchange',()=>{const place=location.hash.slice(1);if(place!==current)restoreHash();});
window.addEventListener('resize',resize);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){clearMovementInput();if(frameRequest)cancelAnimationFrame(frameRequest);frameRequest=0;}
  else{last=performance.now();requestDraw();}
});
motionPreference.addEventListener('change',setMotionState);
setMotionState();resize();load();
