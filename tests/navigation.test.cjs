const test = require('node:test');
const {loadSandboxModule}=require('./helpers/sandbox-module.cjs');
const {containsCode}=require('./helpers/source-text.cjs');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
// vm expressions reach the site controller through these sandbox globals: its context object and each module's exports.
const siteGlobals=load=>({site:load('site/context.ts').site,Context:load('site/context.ts'),Town:load('site/town.ts'),Camera:load('site/camera.ts'),Labels:load('site/labels.ts'),Render:load('site/render.ts'),Spell:load('site/spell.ts'),Escort:load('site/escort.ts'),Movement:load('site/movement.ts'),Input:load('site/input.ts'),Routing:load('site/routing.ts'),Portal:load('site/portal.ts'),Loop:load('site/loop.ts')});
// The site controller's modules, for source-text checks.
const siteSource=()=>['context','main','town','camera','labels','render','spell','frontier','escort','movement','input','routing','content','portal','assets','loop'].map(m=>readFileSync(join(__dirname,`../src/site/${m}.ts`),'utf8')).join('\n');

// Exercise the actual navigation state machine with a deterministic clock.
// Rendering and browser layout are checked separately in the live preview.
async function village({reduced=false, hash='',width=1440,height=820,coarse=false}={}) {
  const nodes=new Map(), frames=new Map(), draws=[];let nextFrame=0,clock=0;
  const makeNode=()=>{
    const attributes=new Map(),classes=new Set(),children=new Map(),events={},captured=new Set(),eventOptions={};
    return {open:false,showModal(){this.open=true;},close(){this.open=false;events.close?.();},hidden:false,disabled:false,textContent:'',innerHTML:'',style:{values:{},setProperty(k,v){this.values[k]=v;},getPropertyValue(k){return this.values[k];}},dataset:{},scrollTop:0,
      classList:{add:(...items)=>items.forEach(x=>classes.add(x)),remove:(...items)=>items.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},
      setAttribute:(key,value)=>attributes.set(key,value),getAttribute:key=>attributes.get(key),removeAttribute:key=>attributes.delete(key),
      setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id),remove(){},events,eventOptions,addEventListener:(key,callback,options)=>{events[key]=callback;eventOptions[key]=options;},append(){},focus(){},animate(){},getAnimations:()=>[],matches:()=>false,closest:()=>null,contains:()=>false,
      querySelector(key){if(!children.has(key))children.set(key,makeNode());return children.get(key);},
      getBoundingClientRect:()=>({width,height,left:0,top:80}),
      getContext:()=>new Proxy({drawImage:(...args)=>draws.push(args),createRadialGradient:()=>({addColorStop(){}}),createPattern:()=>({})},{get:(obj,key)=>obj[key]||(()=>{})})
    };
  };
  const get=key=>{if(!nodes.has(key))nodes.set(key,makeNode());return nodes.get(key);};
  const nav=['home','arena','hall','gate'].map(place=>{const node=makeNode();node.dataset.place=place;return node;});
  const lights=[0,1,2].map(i=>{const node=get(`[data-essence="${i}"]`);node.dataset.essence=String(i);return node;});
  const listeners={},windowListeners={};
  const preference={matches:reduced,addEventListener:(_,cb)=>{preference.change=cb;}};
  const location={hash,origin:"https://entia.test"};
  const historyCalls=[],historyStack=[];
  const history={back:()=>{location.hash=historyStack.pop()||'#home';windowListeners.popstate?.();},pushState:(_,__,value)=>{historyStack.push(location.hash||'#home');location.hash=value;historyCalls.push(['push',value]);},replaceState:(_,__,value)=>{location.hash=value;historyCalls.push(['replace',value]);}};
  const document={body:makeNode(),hidden:false,querySelector:get,querySelectorAll:key=>key==='.nav'?nav:key==='[data-essence]'?lights:[],createElement:()=>makeNode(),addEventListener:(key,cb)=>{listeners[key]=cb;}};
  const context=vm.createContext({document,window:{location:{assign(){}},history,addEventListener:(key,cb)=>{windowListeners[key]=cb;}},location,matchMedia:query=>query.includes('pointer: coarse')?{matches:coarse,addEventListener(){}}:preference,devicePixelRatio:1,
    Image:class{constructor(){this.width=768;this.height=640;}set src(value){this.path=value;this.onload();}},
    requestAnimationFrame:callback=>{frames.set(++nextFrame,callback);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:()=>0,clearTimeout(){},console,performance:{now:()=>clock},history
  });
  const modules=new Map(),load=file=>loadSandboxModule(context,join(__dirname,'../src',file),modules);load('site/main.ts');Object.assign(context,siteGlobals(load));
  await new Promise(resolve=>setImmediate(resolve));
  const api=vm.runInContext(`({go:Routing.go,advanceRoute:Movement.advanceRoute,advanceSpell:Spell.advanceSpell,drawSpell:Spell.drawSpell,drawActor:Render.drawActor,restoreHash:Routing.restoreHash,advanceMovement:Movement.advanceMovement,isWalkable:Movement.isWalkable,houseBounds:Town.houseBounds,townPhysics:Town.townPhysics,houses:Town.houses,insideHouse:Town.insideHouse,updateHouseRoofs:Town.updateHouseRoofs,
    pause(){site.paused=true;Loop.setMotionState();},
    reduced(value){Context.motionPreference.matches=value;Loop.setMotionState();},
    finish(){for(let i=0;i<500&&site.route;i++)Movement.advanceRoute(.1);},
    tick:Loop.tick,viewport:Camera.viewport,walkToPortal:Portal.walkToPortal,castPointer:Input.castPointer,showDemo:Portal.showDemo,closeDemo:Portal.closeDemo,draw:Render.draw,ground:Context.ground,groundReady:()=>site.groundReady,
    demoState:()=>({open:site.demoOpen,loaded:site.demoLoaded,blocked:site.portalReentryBlocked}),
    townEntities:()=>[Town.hero,...Town.keepers,...Town.npcs,...Town.scenery,Town.homePortal],
    frontier:()=>({...site.frontierState,wizard:site.frontierWizard,sequence:site.frontierSequence}),advanceFrontier:Escort.advanceFrontier,positionFrontierBubble:Escort.positionFrontierBubble,frontierScreen:()=>site.frontierWizard?Camera.worldToScreen(site.frontierWizard):null,tryFrontier:Escort.tryFrontier,dismissFrontier:Escort.dismissFrontier,viewFrontierDownloads:Escort.viewFrontierDownloads,worldViewBounds:Render.worldViewBounds,visibleBeyondTrees:Render.visibleBeyondTrees,
    moveHero:Movement.moveHero,resize:Camera.resize,clearMovementInput:Movement.clearMovementInput,joystick:()=>({pointer:site.joystickPointer,direction:site.joystickDirection,panX:site.mobilePanX,panY:site.mobilePanY}),
    setHero:(x,y)=>{Town.hero.x=x;Town.hero.y=y;site.route=null;},
    placeHero(x,y){Town.hero.x=x;Town.hero.y=y;Camera.viewport();Labels.positionLabels();},
    heroScreen:()=>Camera.worldToScreen(Town.hero),viewportSize:()=>({width:site.width,height:site.height}),npcPositions:()=>Town.npcs.map(n=>({x:n.x,y:n.y})),
    drawHero(){Render.drawActor(Town.hero);},
    drawKeeper(){Render.drawActor(Town.keepers[0]);},
    path:()=>site.route?.points,
    state:()=>({ready:site.ready,current:site.current,route:!!site.route,spell:!!site.spell,spellPlace:site.spell?.place,spellHit:site.spell?.hit,manual:site.route?.manual,explore:site.route?.explore,held:Movement.heldDirections.size,rings:site.rings.length,gait:Town.hero.gait,dir:Town.hero.dir,x:Town.hero.x,y:Town.hero.y,atPlace:site.atPlace,cameraX:Camera.camera.x,cameraTargetX:Camera.camera.targetX}),
    groundPoint:(x,y)=>{const p=Camera.worldToScreen({x,y});return {clientX:p.x,clientY:p.y+80};},
    target:place=>Town.spots[place].land,keeper:place=>Town.spots[place],scale:()=>site.scale,spellDetails:()=>site.spell?{...site.spell}:null,setNpc:(i,x,y)=>{Town.npcs[i].x=x;Town.npcs[i].y=y;Town.npcs[i].path=[];},
    reaction:place=>Town.keepers.find(k=>k.place===place).reaction,
    label:place=>Town.keepers.find(k=>k.place===place).button.querySelector('.keeper-clan').textContent
  })`,context);
  assert.equal(api.state().ready,true);
  const key=(type,value,options={})=>{
    let prevented=false;
    listeners[type]({key:value,target:get('#scene'),preventDefault(){prevented=true;},...options});
    return prevented;
  };
  const clickGround=(x,y)=>get('#scene').events.click(api.groundPoint(x,y));
  return {context,api,get,location,preference,nav,frames,draws,listeners,windowListeners,document,key,clickGround,historyCalls,history,step(ms=16){clock+=ms;const jobs=[...frames.values()];frames.clear();for(const job of jobs)job(clock);}};
}

test('a spell opens content and marks the section before its journey completes',async()=>{
  const {api,get,nav}=await village();
  api.go('arena',{cast:true});
  assert.equal(api.state().current,'arena');
  assert.equal(api.state().route,true);
  assert.equal(api.state().spell,true);
  assert.match(get('#panel-content').innerHTML,/GAME · IN DEVELOPMENT/);
  assert.equal(get('#location-state').textContent,'Walking to Game…');
  assert.equal(nav[1].getAttribute('aria-current'),'page');
  api.finish();
  assert.equal(get('#location-state').textContent,'You are here');
  assert.equal(api.state().atPlace,'arena');
});

test('interrupting travel cannot complete an obsolete destination',async()=>{
  const {api,get}=await village();
  api.go('arena',{cast:true});api.advanceRoute(.15);
  api.go('hall',{cast:true});api.advanceRoute(.1);
  api.go('gate',{cast:true});api.finish();
  assert.equal(api.state().current,'gate');
  assert.equal(api.state().atPlace,'gate');
  assert(Math.hypot(api.state().x-api.keeper('gate').x,api.state().y-api.keeper('gate').y)<=48);
  assert.match(get('#panel-content').innerHTML,/Download Entia/);
  assert.equal(get('#location-name').textContent,'Download');
});

test('manual walking advances one grounded cardinal tile in 0.20 seconds',async()=>{
  const {api,key,draws}=await village();const start=api.state();key('keydown','s');key('keyup','s');api.advanceMovement(.2);const step=api.state();assert.equal(step.x,start.x);assert.equal(step.y,start.y+32);assert.equal(step.dir,2);api.drawHero();const idle=draws.pop();assert.equal(idle[6]+idle[8],step.y);
});

test('retargeting preserves cardinal collision-aware routes',async()=>{
  const {api}=await village();
  api.go('arena');api.advanceRoute(.1);
  const before=api.state();
  api.go('hall');api.advanceRoute(.05);
  assert.ok(api.state().x===before.x||api.state().y===before.y);
  for(const place of ['hall','gate','home','arena']){
    api.go(place);let from=api.state();
    for(const point of api.path()){
      assert.ok(point.x===from.x || point.y===from.y,'no diagonal movement');
      from=point;
    }
    api.finish();assert.equal(api.state().atPlace,place);
  }
});

test('pause during walking arrives at the latest destination and clears motion',async()=>{
  const {api,get}=await village();
  api.go('hall',{cast:true});api.advanceRoute(.2);api.pause();
  const s=api.state();
  assert.equal(s.route,false);assert.equal(s.spell,false);assert.equal(s.rings,0);
  assert(Math.hypot(s.x-api.keeper('hall').x,s.y-api.keeper('hall').y)<=48);
  assert.equal(s.cameraX,s.cameraTargetX);
  assert.equal(get('#location-state').textContent,'You are here');
  api.go('gate',{cast:true});
  assert.equal(api.state().route,false);assert.equal(api.state().atPlace,'gate');
});

test('reduced motion from first load still supports every spell destination',async()=>{
  const {api,get}=await village({reduced:true,hash:'#hall'});
  assert.equal(api.state().atPlace,'hall');
  for(const destination of ['arena','gate','home']){
    api.go(destination,{cast:true});
    assert.equal(api.state().route,false);assert.equal(api.state().spell,false);
    assert.equal(api.state().atPlace,destination);
  }
  assert.equal(get('#motion').disabled,true);
});

test('a live reduced-motion change resolves a pending walk immediately',async()=>{
  const {api}=await village();
  api.go('arena',{cast:true});api.advanceRoute(.1);api.reduced(true);
  assert.equal(api.state().atPlace,'arena');assert.equal(api.state().route,false);assert.equal(api.state().spell,false);
});

test('history restores section state and content skip links do not navigate',async()=>{
  const {api,location,get}=await village();
  api.go('hall');api.finish();
  location.hash='#main-content';api.restoreHash();
  assert.equal(api.state().current,'hall');
  location.hash='#home';api.restoreHash();api.finish();
  assert.equal(api.state().current,'home');assert.equal(get('#panel').hidden,true);assert.equal(get('#intro').hidden,false);
});



test('Apocalipsis strikes the chosen keeper once and its burst expires',async()=>{
  const {api}=await village();
  api.go('arena',{cast:true});
  api.advanceSpell(.1);assert.equal(api.state().spellHit,false);
  api.advanceSpell(.03);assert.equal(api.state().spellHit,true);assert.equal(api.reaction('arena'),1.1);
  api.advanceSpell(1.98);assert.equal(api.state().spell,true);
  api.advanceSpell(.02);assert.equal(api.state().spell,false);
});

test('Apocalipsis plays the original 60-PPT sheet in order at canonical scale without looping',async()=>{
  const {api,draws}=await village();
  api.go('arena',{cast:true});
  api.drawSpell();assert.equal(draws.length,0);
  api.advanceSpell(.12);api.drawSpell();
  const first=draws.pop();
  assert.equal(first[0].path,'assets/apocalipsis_60.png');
  assert.deepEqual(first.slice(1,5),[0,0,273,243]);
  assert.deepEqual(first.slice(5),[1200-72.8,336-32-64.8,145.6,129.6]);
  api.advanceSpell(.4);api.drawSpell();
  assert.deepEqual(draws.pop().slice(1,5),[546,243,273,243]);
  api.advanceSpell(1.59);api.drawSpell();
  assert.deepEqual(draws.pop().slice(1,5),[819,1701,273,243]);
  api.advanceSpell(.02);api.drawSpell();assert.equal(draws.length,0);
});

test('a new cast replaces the old Apocalipsis target before impact',async()=>{
  const {api}=await village();
  api.go('hall',{cast:true});api.advanceSpell(.08);
  api.go('gate',{cast:true});api.advanceSpell(.13);
  assert.equal(api.state().spellPlace,'gate');assert.equal(api.state().spellHit,true);
  assert.equal(api.reaction('hall'),0);assert.equal(api.reaction('gate'),1.1);
});

test('WASD and arrow taps move one tile without changing the open section',async()=>{
  const {api,key,location}=await village();
  const start=api.state();
  assert.equal(key('keydown','d'),true);key('keyup','d');api.advanceMovement(.2);
  assert.equal(api.state().x,start.x+32);assert.equal(api.state().y,start.y);
  key('keydown','ArrowDown');key('keyup','ArrowDown');api.advanceMovement(.2);
  assert.equal(api.state().y,start.y+32);assert.equal(api.state().route,false);
  assert.equal(api.state().current,'home');assert.equal(api.state().atPlace,null);assert.equal(location.hash,'');
});

test('held keys repeat cardinal steps and the newest direction takes over at a footstep boundary',async()=>{
  const {api,key}=await village();const start=api.state();
  key('keydown','d');api.advanceMovement(.1);
  key('keydown','w');api.advanceMovement(.1);
  assert.equal(api.state().x,start.x+32);assert.equal(api.state().y,start.y);
  key('keyup','d');key('keyup','w');api.advanceMovement(.2);
  assert.equal(api.state().x,start.x+32);assert.equal(api.state().y,start.y-32);
  assert.equal(api.state().route,false);assert.equal(api.state().held,0);
});

test('keyboard walking stops at buildings and map boundaries',async()=>{
  const {api,key}=await village();
  key('keydown','ArrowRight');for(let i=0;i<30;i++)api.advanceMovement(.2);
  key('keyup','ArrowRight');
  assert.ok(api.state().x<=1506);assert.equal(api.isWalkable(432,580),false);assert.equal(api.state().route,false);
  key('keydown','ArrowDown');for(let i=0;i<30;i++)api.advanceMovement(.2);
  key('keyup','ArrowDown');
  assert.ok(api.state().y<=966);assert.equal(api.state().route,false);
  assert.equal(api.isWalkable(api.state().x,api.state().y),true);
});

test('keyboard takeover cancels an old navigation arrival callback',async()=>{
  const {api,key,get}=await village();
  api.go('hall',{cast:true});api.advanceRoute(.1);
  key('keydown','d');key('keyup','d');api.advanceMovement(2);
  assert.equal(api.state().atPlace,null);assert.equal(api.state().current,'hall');
  assert.equal(api.state().spell,true);assert.equal(get('#location-state').textContent,'Exploring Nix');
  assert.equal(get('#keeper-reply').hidden,true);
});

test('losing focus or hiding the page releases held movement immediately',async()=>{
  const {api,key,windowListeners,listeners,document}=await village();
  key('keydown','d');api.advanceMovement(.1);windowListeners.blur();
  const stopped=api.state().x;api.advanceMovement(1);
  assert.equal(api.state().x,stopped);assert.equal(api.state().route,false);assert.equal(api.state().held,0);
  key('keydown','s');document.hidden=true;listeners.visibilitychange();
  assert.equal(api.state().route,false);assert.equal(api.state().held,0);
});

test('typing, shortcuts and dialogs do not trigger world movement',async()=>{
  const {api,key,get}=await village();const start=api.state();
  assert.equal(key('keydown','w',{target:{closest:()=>({})}}),false);
  assert.equal(key('keydown','s',{ctrlKey:true}),false);
  get('#notes').open=true;assert.equal(key('keydown','ArrowRight'),false);
  assert.equal(api.state().x,start.x);assert.equal(api.state().y,start.y);assert.equal(api.state().route,false);
});

test('reduced motion supports deliberate single keyboard steps without starting animation',async()=>{
  const {api,key}=await village({reduced:true});const start=api.state();
  key('keydown','d');key('keyup','d');
  assert.equal(api.state().x,start.x+32);assert.equal(api.state().route,false);assert.equal(api.state().held,0);
  key('keydown','d',{repeat:true});assert.equal(api.state().x,start.x+32);
});


test('character clan tags use Now for the open section and concise destination context',async()=>{
  const {api}=await village();
  assert.equal(api.label('home'),'<Now>');assert.equal(api.label('hall'),'<Preview>');
  assert.equal(api.label('gate'),'<Unavailable>');
  api.go('gate');assert.equal(api.label('gate'),'<Now>');assert.equal(api.label('home'),'<Nix>');
});

test('clicks inside the world no longer fall through to the world data-place attribute',async()=>{
  const {api,get,listeners}=await village();api.go('arena');
  const world=get('#world');world.dataset.place='home';
  listeners.click({target:{closest:selector=>selector==='[data-place]'?world:null},preventDefault(){}});
  assert.equal(api.state().current,'arena');
});

test('ranking category clicks reach their own handler without restarting navigation',async()=>{
  const {api,get,listeners}=await village();api.go('hall');api.finish();
  const rank={dataset:{rank:'support'}},world=get('#world');world.dataset.place='hall';
  listeners.click({target:{closest:selector=>selector==='[data-rank]'?rank:selector==='[data-place]'?world:null},preventDefault(){}});
  assert.match(get('#ranks').innerHTML,/Nox/);assert.match(get('#ranks').innerHTML,/930/);
  assert.equal(api.state().route,false);assert.equal(api.state().atPlace,'hall');
});

function tap(v,key){v.key('keydown',key);v.key('keyup',key);v.api.finish();}
function westSide(v){for(let i=0;i<3;i++)tap(v,'ArrowLeft');}

test('walking near Download opens it once while a held arrow keeps moving',async()=>{
  const v=await village();westSide(v);
  v.key('keydown','ArrowDown');
  for(let i=0;i<6;i++)v.api.advanceMovement(.2);
  const entered=v.api.state();
  assert.equal(entered.current,'gate');assert.equal(entered.atPlace,'gate');
  assert.equal(entered.x,784);assert.equal(entered.y,656);
  assert.equal(entered.held,1);assert.equal(entered.route,true);
  assert.equal(entered.spell,false);assert.equal(v.location.hash,'#gate');
  assert.match(v.get('#panel-content').innerHTML,/Download Entia/);
  assert.equal(v.nav[3].getAttribute('aria-current'),'page');
  assert.equal(v.api.label('gate'),'<Now>');
  v.get('#main-content').scrollTop=40;
  v.api.advanceMovement(.2);
  assert.equal(v.api.state().y,688);assert.equal(v.get('#main-content').scrollTop,40);
  assert.deepEqual(v.historyCalls,[['replace','#gate']]);
});

test('ground-click routes stay cardinal and collision safe around keepers',async()=>{
 const v=await village();westSide(v);v.clickGround(1050,780);assert.equal(v.api.state().explore,true);let prev=v.api.state();for(let i=0;i<400&&v.api.state().route;i++){v.api.advanceRoute(.04);const p=v.api.state();assert.ok(p.x===prev.x||p.y===prev.y);assert(v.api.isWalkable(p.x,p.y));prev=p;}assert.ok(Math.abs(v.api.state().x-1050)<1e-6);assert.ok(Math.abs(v.api.state().y-780)<1e-6);
});

test('explicit navigation passing a different character keeps its chosen section',async()=>{
  const v=await village();westSide(v);v.api.go('hall',{cast:true});
  v.api.advanceRoute(1.2);
  assert.equal(v.api.state().current,'hall');assert.equal(v.api.state().spellPlace,'hall');
  assert.deepEqual(v.historyCalls,[['push','#hall']]);
  v.api.finish();assert.equal(v.api.state().atPlace,'hall');
});

test('leaving and reentering a proximity boundary preserves the open panel',async()=>{
  const v=await village({reduced:true});westSide(v);
  for(let i=0;i<6;i++)tap(v,'s');
  assert.equal(v.api.state().current,'gate');
  v.get('#main-content').scrollTop=75;
  // At 85 units we retain the nearby state; beyond 104 we release it.
  tap(v,'w');assert.equal(v.api.state().atPlace,'gate');
  tap(v,'w');assert.equal(v.api.state().atPlace,null);
  tap(v,'s');tap(v,'s');
  assert.equal(v.api.state().atPlace,'gate');assert.equal(v.api.state().current,'gate');
  assert.equal(v.get('#main-content').scrollTop,75);
  assert.deepEqual(v.historyCalls,[['replace','#gate']]);
});

test('reduced motion and pausing a ground walk both resolve proximity at the endpoint',async()=>{
  for(const reduced of [true,false]){
    const v=await village({reduced});v.clickGround(780,765);
    if(!reduced)v.api.pause();
    assert.equal(v.api.state().current,'gate');assert.equal(v.api.state().route,false);
    assert.ok(Math.abs(v.api.state().x-780)<1e-6);assert.ok(Math.abs(v.api.state().y-765)<1e-6);
    assert.equal(v.api.state().atPlace,'gate');
  }
});



test('world controls suppress native text gestures without suppressing navigation',async()=>{
  const {api,get}=await village();
  for(const selector of ['#scene','#locations','#player-label','#keeper-reply']){
    for(const type of ['selectstart','dragstart','contextmenu']){
      let prevented=false;
      get(selector).events[type]({preventDefault(){prevented=true;}});
      assert.equal(prevented,true,`${selector} cancels ${type}`);
    }
  }
  assert.equal(get('#main-content').events.contextmenu,undefined,'normal page content keeps its browser menu');
  api.go('arena',{cast:true});
  assert.equal(api.state().current,'arena');
  assert.equal(api.state().spell,true);
});

test('town camera centers hero in the available play area',async()=>{const v=await village();v.api.viewport();const p=v.api.heroScreen();assert.ok(Math.abs(p.x-945)<1e-6);assert.ok(Math.abs(p.y-410)<1e-6);});
test('town NPC frames never translate on two axes',async()=>{const v=await village();let prev=v.api.npcPositions();for(let i=1;i<100;i++){v.api.tick(i*16);const now=v.api.npcPositions();now.forEach((p,j)=>assert.ok(p.x===prev[j].x||p.y===prev[j].y));prev=now;}});
test('home portal has a reachable collision-aware route',async()=>{const v=await village();v.api.walkToPortal();assert(v.api.state().route);v.api.finish();assert.ok(Math.abs(v.api.state().x-1010)<24);assert.ok(Math.abs(v.api.state().y-432)<20);});
test('town pointer spell preserves requested ground coordinates',async()=>{const v=await village();v.api.castPointer(935,550);assert(v.api.state().spell);assert.equal(v.api.state().route,false);});

test('returning with browser Back clears the portal transition lock',async()=>{const v=await village();v.api.walkToPortal();v.api.finish();v.windowListeners.pageshow();assert.equal(v.api.state().x,880);assert.equal(v.api.state().y,464);assert.equal(v.api.state().route,false);});

test('Home actors center on tiles and house bases align to floor tile edges',async()=>{const v=await village();for(const p of v.api.townEntities()){assert.equal(p.x%32,16);assert.equal(p.y%32,p.id?.startsWith('house')?0:16);}});
test('Home name labels keep their horizontal anchor and separate when near',async()=>{const v=await village();v.api.placeHero(784,432);assert.equal(v.get('#player-label').dataset.placement,'above');const p=v.api.heroScreen();assert.match(v.get('#player-label').style.transform,new RegExp('translate3d\\('+Math.round(p.x)+'px,'));v.api.placeHero(900,600);assert.equal(v.get('#player-label').dataset.placement,'below');});

test('inline demo opens in Home and exit preserves character position',async()=>{const v=await village();v.api.placeHero(912,496);const before=v.api.state();v.api.showDemo(true);assert(v.api.demoState().open);assert.equal(v.location.hash,'#demo');assert.equal(v.get('#app').inert,true);assert.match(v.get('#demo-frame').src,/demo/);v.api.closeDemo(true);assert.equal(v.api.demoState().open,false);assert.equal(v.location.hash,'#home');assert.equal(v.api.state().x,before.x);assert.equal(v.api.state().y,before.y);assert.equal(v.get('#app').inert,false);assert(v.api.demoState().blocked);});
test('Back and Forward restore the embedded view without reinitializing Home',async()=>{const v=await village();v.api.placeHero(912,496);v.api.showDemo(true);v.location.hash='#home';v.windowListeners.popstate();assert(!v.api.demoState().open);assert.equal(v.api.state().x,912);v.location.hash='#demo';v.windowListeners.popstate();assert(v.api.demoState().open);assert.equal(v.api.state().x,912);});
test('demo messages require both the expected origin and iframe source',async()=>{const v=await village();const frame=v.get('#demo-frame');frame.contentWindow={postMessage(){}};v.api.showDemo(true);v.windowListeners.message({origin:'https://wrong.test',source:frame.contentWindow,data:{type:'entia-demo-ready'}});assert(!v.api.demoState().loaded);v.windowListeners.message({origin:v.location.origin,source:{},data:{type:'entia-demo-ready'}});assert(!v.api.demoState().loaded);v.windowListeners.message({origin:v.location.origin,source:frame.contentWindow,data:{type:'entia-demo-ready'}});assert(v.api.demoState().loaded);assert.equal(v.get('#demo-loading').hidden,true);});

test('a fast initial iframe load keeps the first how-to-play popup',async()=>{const v=await village(),messages=[];const frame=v.get('#demo-frame');frame.contentWindow={postMessage:m=>messages.push(m)};v.windowListeners.message({origin:v.location.origin,source:frame.contentWindow,data:{type:'entia-demo-ready'}});messages.length=0;v.api.showDemo(true);assert(!messages.some(m=>m.type==='entia-demo-resume'));});

test('return closes immediately without depending on joint iframe history.back',async()=>{const v=await village();v.api.showDemo(true);v.history.back=()=>{throw Error('Must not call history.back to close');};v.api.closeDemo(true);assert(!v.api.demoState().open);assert.equal(v.location.hash,'#home');assert.equal(v.get('#app').inert,false);});
test('iframe uses replacement navigation and remains mounted on re-entry',async()=>{const v=await village();let loads=0;const frame=v.get('#demo-frame');frame.contentWindow={location:{replace:url=>{assert.match(url,/demo/);loads++;}},postMessage(){}};v.api.showDemo(true);v.api.closeDemo(true);v.api.showDemo(true);assert.equal(loads,1);});

test('explicit return opens Home even if the portal was entered from another section',async()=>{const v=await village();v.api.go('arena',{instant:true});const before=v.api.state();v.api.showDemo(true);v.api.closeDemo(true);assert.equal(v.api.state().current,'home');assert.equal(v.location.hash,'#home');assert.equal(v.api.state().x,before.x);assert.equal(v.api.state().y,before.y);});

test('app resume rebuilds lost terrain cache without resetting section or character',async()=>{for(const reduced of [false,true]){const v=await village({reduced});v.api.go('hall',{instant:true});v.api.draw();const before=v.draws.filter(a=>a[0]?.path==='assets/grass.png').length,position=v.api.state();v.document.hidden=true;v.listeners.visibilitychange();v.document.hidden=false;v.listeners.visibilitychange();assert.equal(v.api.groundReady(),false);v.api.draw();assert(v.draws.filter(a=>a[0]?.path==='assets/grass.png').length>before);assert.equal(v.api.state().current,'hall');assert.equal(v.api.state().x,position.x);assert.equal(v.api.state().y,position.y);}});
test('cached and visible canvas restore trigger rebuilding even with paused animation',async()=>{const v=await village();v.api.pause();v.api.draw();v.api.ground.events.contextlost({preventDefault(){}});assert.equal(v.api.groundReady(),false);v.api.ground.events.contextrestored();v.api.draw();assert(v.api.groundReady());v.get('#scene').events.contextlost({preventDefault(){}});v.get('#scene').events.contextrestored();assert.equal(v.api.groundReady(),false);v.api.draw();v.windowListeners.pageshow();assert.equal(v.api.groundReady(),false);});
test('mobile cast popup appears at arrival and closes without moving home',async()=>{const v=await village({width:390,height:480});v.api.go('hall',{cast:true});assert(!v.get('#zone-dialog').open);assert(v.api.state().spell);v.api.finish();assert(v.get('#zone-dialog').open);assert(v.get('#zone-dialog').classList.contains('arrival-effect'));const p=v.api.state();v.get('#close-zone').onclick();assert(!v.get('#zone-dialog').open);assert.equal(v.api.state().current,'hall');assert.equal(v.api.state().x,p.x);assert.equal(v.api.state().y,p.y);});
test('tapping a world character casts and starts its zone journey',async()=>{const v=await village();const target=v.api.townEntities().find(a=>a.place==='hall');v.clickGround(target.x,target.y-25);assert.equal(v.api.state().spellPlace,'hall');assert.equal(v.api.state().current,'hall');assert(v.api.state().route);});

test('the old collect-lights minigame has no markup, entry points or runtime',()=>{const html=readFileSync(join(__dirname,'../index.html'),'utf8'),js=siteSource();assert(!containsCode(html,'id="essence-game"'));assert(!containsCode(html,'id="wander"'));assert(!containsCode(js,'function startGame'));assert(!containsCode(js,'Try collecting lights'));});

test('phone overview retains all four actor areas while navigating each zone',async()=>{for(const width of [320,390,430]){const v=await village({width,height:480});for(const place of ['home','arena','hall','gate']){v.api.go(place,{instant:true});v.api.viewport();for(const k of v.api.townEntities().filter(a=>a.isKeeper)){const screen=v.api.groundPoint(k.x,k.y);assert(screen.clientX>=32&&screen.clientX<=width-32);assert(screen.clientY-80>=40&&screen.clientY-80<=420);}}}});

test('home popup has a slower translucent reveal and preserves reduced motion',()=>{const css=readFileSync(join(__dirname,'../src/site/style.css'),'utf8');assert(containsCode(css,'zone-reveal 1.1s ease-out'));assert(containsCode(css,'background:rgba(14,33,26,.84)'));assert(containsCode(css,'#zone-dialog[open],#zone-dialog[open]::backdrop{animation:none}'));});

test('both house variants have equal native tile scale and open two-tile entrances',async()=>{const v=await village();for(const h of v.api.townEntities().filter(p=>p.id?.startsWith('house')&&!p.decorative)){assert.equal(h.w,256);assert.equal(h.h,683*32/60);const b=v.api.houseBounds(h);assert.equal(b.doorX%32,0);for(const x of [b.doorX+16,b.doorX+48]){assert(v.api.townPhysics.free(x,h.y-16));assert(v.api.townPhysics.free(x,h.y-48));}assert(!v.api.townPhysics.free(b.doorX-16,h.y-16));assert(!v.api.townPhysics.free(b.doorX+80,h.y-16));assert(v.api.townPhysics.free(b.doorX+16,h.y-80));}});

test('house interior is reachable through the doorway, walls remain solid and roof fades in 220ms',async()=>{const v=await village();const h=v.api.houses.find(h=>!h.decorative),b=v.api.houseBounds(h);const outside={x:b.doorX+16,y:h.y+16},inside={x:b.doorX+16,y:h.y-112};const path=v.api.townPhysics.path(outside,inside);assert(path.length);assert(!v.api.townPhysics.free(b.left+8,h.y-100));assert(!v.api.townPhysics.free(b.left+248,h.y-100));assert(!v.api.townPhysics.free(b.left+100,h.y-200));v.api.placeHero(inside.x,inside.y);assert(v.api.insideHouse(h));v.api.updateHouseRoofs(.11);assert(Math.abs(h.roofAlpha-.5)<1e-9);v.api.updateHouseRoofs(.11);assert.equal(h.roofAlpha,0);v.api.placeHero(outside.x,outside.y);v.api.updateHouseRoofs(.22);assert.equal(h.roofAlpha,1);});
test('decorative left house stays closed and does not cover the Game character',async()=>{const v=await village();const h=v.api.houses.find(h=>h.decorative),b=v.api.houseBounds(h),game=v.api.townEntities().find(p=>p.place==='arena');assert(h.x<600);assert(game.x>h.x+h.w/2);assert(!v.api.townPhysics.free(b.doorX+16,h.y-16));v.api.placeHero(b.doorX+16,h.y-100);v.api.updateHouseRoofs(1);assert.equal(h.roofAlpha,1);});
test('reduced-motion house roof changes immediately',async()=>{const v=await village({reduced:true});const h=v.api.houses.find(h=>!h.decorative),b=v.api.houseBounds(h);v.api.placeHero(b.doorX+16,h.y-112);v.api.updateHouseRoofs(0);assert.equal(h.roofAlpha,0);});

test('inactive Home releases scene surfaces and repeated transitions reuse one frame',async()=>{const a=await village();const run=s=>vm.runInContext(s,a.context);run('Portal.showDemo(true)');assert.equal(run('Context.canvas.width'),1);assert.equal(run('Context.ground.width'),1);run('Loop.recoverScene()');assert.equal(run('Context.ground.width'),1);run('Portal.closeDemo(true);Render.draw()');assert(run('Context.canvas.width')>1);assert.equal(run('Context.ground.width'),1440);for(let i=0;i<20;i++)run('Portal.showDemo(true);Portal.closeDemo(true)');assert(run('site.demoFrameStarted'));assert(!run('site.demoOpen'));});
test('parent hands keyboard focus to the visible iframe on cold and warm entry only',async()=>{const v=await village(),frame=v.get('#demo-frame');let focused=0;frame.focus=()=>focused++;frame.contentWindow={postMessage(){}};v.api.showDemo(true);assert.equal(focused,0);v.windowListeners.message({origin:v.location.origin,source:frame.contentWindow,data:{type:'entia-demo-ready'}});assert.equal(focused,1);v.api.closeDemo(true);v.windowListeners.message({origin:v.location.origin,source:frame.contentWindow,data:{type:'entia-demo-ready'}});assert.equal(focused,1);v.api.showDemo(true);assert.equal(focused,2);});
test('home role keepers render a complete idle cell rather than one eighth of it',async()=>{const v=await village();v.api.drawActor({x:100,y:200,body:'npc-home',dir:2,gait:100,reaction:0});const call=v.draws.at(-1);assert.equal(call[1],0);assert.equal(call[2],320);assert.equal(call[3],96);assert.equal(call[4],160);});
test('mohawk walker uses its real gait frames and reduced motion selects idle',async()=>{const v=await village(),actor={x:100,y:200,body:'mohawk',dir:1,gait:32,reaction:0};v.api.drawActor(actor);let call=v.draws.at(-1);assert(call[0].path.endsWith('npc/mohawk-walk-v3.png'));assert.equal(call[1],4*96);assert.equal(call[2],160);assert.equal(call[3],96);assert.equal(call[4],160);v.api.reduced(true);v.api.drawActor(actor);call=v.draws.at(-1);assert.equal(call[1],0);});
test('each physical edge summons the wizard once on blocked outward keyboard intent',async()=>{for(const[x,y,key,edge]of [[-48,450,'ArrowLeft','west'],[1488,450,'ArrowRight','east'],[720,-48,'ArrowUp','north'],[720,944,'ArrowDown','south']]){const v=await village();v.api.setHero(x,y);v.key('keydown',key);assert.equal(v.api.frontier().edge,edge);assert(v.api.frontier().open);assert.equal(v.api.frontier().sequence.phase,'appear');assert.equal(v.api.state().route,false);const before=v.historyCalls.length;v.get('#frontier-stay').onclick();assert(!v.api.frontier().open);assert.equal(v.historyCalls.length,before);v.key('keydown',key,{repeat:true});assert.equal(v.api.frontier().open,false);v.key('keyup',key);v.key('keydown',key);assert.equal(v.api.frontier().open,true);assert.equal(v.api.state().held,0);}});
test('exploration approach interrupts old completion; reduced motion and pause endpoints work',async()=>{for(const mode of ['normal','reduced','paused']){const v=await village({reduced:mode==='reduced'});v.api.setHero(16,450);let finished=false;v.api.moveHero([{x:-16,y:450}],{explore:true,complete:()=>{finished=true}});if(mode==='paused')v.api.pause();else if(mode==='normal')v.api.advanceRoute(.2);assert(v.api.frontier().open,mode);assert.equal(finished,false);assert.equal(v.api.state().route,false);}});
test('outside click only summons when already near its boundary, and modal/idle states do not summon',async()=>{const v=await village();v.clickGround(-100,450);assert.equal(v.api.frontier().seen,false);v.api.setHero(-48,450);v.api.draw();v.api.tick(100);assert.equal(v.api.frontier().seen,false);v.get('#notes').showModal();v.clickGround(-100,450);assert.equal(v.api.frontier().seen,false);v.get('#notes').close();v.clickGround(-100,450);assert(v.api.frontier().open);});
test('Skip uses out/in teleport phases then opens Downloads once',async()=>{
 for(const reduced of [false,true]){
 const v=await village({reduced});v.api.setHero(-48,450);v.clickGround(-100,450);v.step(800);const before=v.historyCalls.length,start=v.api.state();v.get('#frontier-download').onclick();assert.equal(v.api.state().x,start.x);assert.equal(v.api.frontier().sequence.phase,'teleport-out');v.step(16);assert.equal(v.api.state().x,start.x);assert.equal(v.historyCalls.length,before);
 v.step(reduced?50:280);assert.equal(v.api.frontier().sequence.phase,'teleport-in');assert.equal(v.api.state().x,v.api.target('gate').x);assert.equal(v.api.state().y,v.api.target('gate').y);assert.equal(v.historyCalls.length,before);v.get('#frontier-download').onclick();v.step(reduced?50:320);assert.equal(v.api.frontier().sequence.phase,'vanish');assert.equal(v.historyCalls.length,before);v.step(reduced?50:450);assert.equal(v.api.state().current,'gate');assert.equal(v.historyCalls.length,before+1);v.history.back();assert(!v.api.frontier().open);
 }
});
test('wizard encounter prevents world hotkeys, Escape dismisses without navigating',async()=>{const v=await village();v.api.setHero(-48,450);v.clickGround(-100,450);const before=v.api.state().current;v.key('keydown','4');assert.equal(v.api.state().current,before);v.key('keydown','Escape');assert.equal(v.api.frontier().open,false);assert.equal(v.api.state().current,before);});
test('mobile and tablet frame the wizard encounter instead of leaving it outside the keeper overview',async()=>{for(const width of [375,768])for(const[x,y,to]of [[-48,450,{x:-100,y:450}],[720,-48,{x:720,y:-100}]]){const v=await village({width,height:820});v.api.setHero(x,y);v.api.tryFrontier({x,y},to,'attempt');v.api.viewport();const hero=v.api.heroScreen(),wizard=v.api.frontierScreen();assert(hero.x>0&&hero.x<width);assert(wizard.x>0&&wizard.x<width);assert(hero.y>100&&hero.y<820);assert(wizard.y>100&&wizard.y<820);}});
test('continued terrain keeps the original collision and cached-canvas bounds',async()=>{const v=await village();v.api.draw();assert.equal(v.api.ground.width,1440);assert.equal(v.api.ground.height,900);assert.equal(v.api.isWalkable(-30,450),true);assert.equal(v.api.isWalkable(1470,450),true);assert.equal(v.api.isWalkable(-67,450),false);assert.equal(v.api.isWalkable(1507,450),false);assert(v.api.visibleBeyondTrees().length<200);const bounds=v.api.worldViewBounds();assert(bounds.right>bounds.left);assert(bounds.bottom>bounds.top);});
test('manual movement returns focus to the game without leaving a boxed keeper label',async()=>{const v=await village();let focus=0;v.get('#scene').focus=()=>focus++;v.key('keydown','w');assert(focus>0);const css=readFileSync(join(__dirname,'../src/site/style.css'),'utf8');assert(containsCode(css,'.keeper:focus-visible .keeper-label{outline:none}'));assert(containsCode(css,'.keeper:focus-visible .keeper-label strong{text-decoration:underline'));});
test('the boundary apparition uses the approved bearded wizard rather than a roaming look',async()=>{const v=await village();v.api.setHero(-48,450);v.clickGround(-100,450);assert.equal(v.api.frontier().wizard.body,'wizard-walk');v.api.drawActor(v.api.frontier().wizard);const draw=v.draws.at(-1);assert(draw[0].path.endsWith('npc/frontier-wizard-walk-v2.png'));assert.equal(draw[1],0);assert.equal(draw[3],96);});


test('wizard escorts every edge to Downloads with collision-safe feet and a following gap',async()=>{
 for(const [x,y,to] of [[-48,450,{x:-96,y:450}],[1488,450,{x:1536,y:450}],[720,-48,{x:720,y:-96}],[720,944,{x:720,y:996}],[-48,-48,{x:-96,y:-48}],[1488,790,{x:1536,y:790}]]){
  const v=await village();v.api.setHero(x,y);assert(v.api.tryFrontier({x,y},to,'attempt'),x+','+y);
  const before=v.historyCalls.length,others=v.api.townEntities().slice(1,8),npcStart=JSON.stringify(v.api.npcPositions());
  v.step(800);assert.equal(v.api.frontier().sequence.phase,'speak');assert(!v.get('#frontier-bubble').hidden);v.step(1500);assert.equal(v.api.frontier().sequence.phase,'escort');
  let steps=0;while(v.api.frontier().sequence?.phase==='escort'&&steps++<1000){const old=v.api.state(),oldW={...v.api.frontier().wizard};v.step(40);const p=v.api.state(),w=v.api.frontier().wizard;assert(Math.abs(p.x-old.x)<.001||Math.abs(p.y-old.y)<.001);assert(Math.abs(w.x-oldW.x)<.001||Math.abs(w.y-oldW.y)<.001);assert(v.api.townPhysics.free(p.x,p.y,others));assert(v.api.townPhysics.free(w.x,w.y,others));assert(Math.hypot(p.x-w.x,p.y-w.y)>=20);assert.equal(v.api.state().current,'home');}
  assert(steps<1000);assert.equal(JSON.stringify(v.api.npcPositions()),npcStart);assert.equal(v.api.frontier().sequence.phase,'vanish');assert.equal(v.api.state().x,v.api.target('gate').x);assert.equal(v.api.state().y,v.api.target('gate').y);
  assert(v.get('#frontier-bubble').hidden);v.step(219);assert(v.api.frontier().wizard);v.step(1);assert(!v.api.frontier().open);assert.equal(v.api.state().current,'gate');assert.equal(v.api.state().route,false);assert.equal(v.historyCalls.length,before+1);v.api.viewFrontierDownloads();assert.equal(v.historyCalls.length,before+1);
 }
});
test('Stay here rearms the next fresh attempt without inward travel or automatic repeat',async()=>{
 const v=await village();v.api.setHero(-48,450);v.clickGround(-100,450);v.get('#frontier-stay').onclick();assert(!v.api.frontier().open);
 for(let i=0;i<50;i++)v.step(40);assert(!v.api.frontier().open);
 v.key('keydown','ArrowLeft',{repeat:true});assert(!v.api.frontier().open);
 v.clickGround(-100,450);assert(v.api.frontier().open);v.key('keydown','Escape');assert(!v.api.frontier().open);v.key('keydown','ArrowLeft');assert(v.api.frontier().open);
});
test('reduced-motion escort visibly walks every intermediate frame at a calm speed',async()=>{
 const v=await village({reduced:true,width:390,height:480});v.api.setHero(-48,450);v.clickGround(-100,450);v.step(50);assert.equal(v.api.frontier().sequence.phase,'speak');v.step(1400);assert.equal(v.api.frontier().sequence.phase,'speak');v.step(100);assert.equal(v.api.frontier().sequence.phase,'escort');
 const start=v.api.state();v.step();assert.equal(v.api.frontier().sequence.phase,'escort');assert(Math.hypot(v.api.state().x-start.x,v.api.state().y-start.y)<2);v.api.drawActor(v.api.frontier().wizard);assert(v.draws.at(-1)[1]>0);
 let frames=0;while(v.api.frontier().sequence?.phase==='escort'&&frames++<1500){const prev=v.api.state();v.step(40);const next=v.api.state();assert(Math.hypot(next.x-prev.x,next.y-prev.y)<=3.841);}
 assert(frames>100&&frames<1500);assert.equal(v.api.frontier().sequence.phase,'vanish');assert.equal(v.api.state().x,v.api.target('gate').x);v.step(50);assert.equal(v.api.state().current,'gate');assert(v.get('#zone-dialog').open);assert(v.get('#zone-dialog').classList.contains('arrival-effect'));v.get('#close-zone').onclick();assert(!v.get('#zone-dialog').classList.contains('arrival-effect'));v.step();assert.equal(v.frames.size,0);
});
test('Pause freezes the escort in place and Resume continues without jumping',async()=>{
 const v=await village();v.api.setHero(-48,450);v.clickGround(-100,450);v.step(800);v.step(1500);v.step(40);const before=v.api.state();v.api.pause();v.step(60000);assert.equal(v.api.state().x,before.x);assert.equal(v.api.state().y,before.y);assert.equal(v.api.frontier().sequence.phase,'escort');assert(!v.get('#frontier-resume').hidden);assert.equal(v.frames.size,0);v.get('#frontier-resume').onclick();v.step(40);const after=v.api.state();assert(Math.hypot(after.x-before.x,after.y-before.y)>0);assert(Math.hypot(after.x-before.x,after.y-before.y)<=3.841);
});
test('hidden time freezes the wizard and a long resumed frame cannot skip new speech',async()=>{
 const v=await village();v.api.setHero(-48,450);v.clickGround(-100,450);v.step(300);v.document.hidden=true;v.listeners.visibilitychange();assert.equal(v.frames.size,0);v.step(60000);assert.equal(v.api.frontier().sequence.phase,'appear');v.document.hidden=false;v.listeners.visibilitychange();v.step(500);assert.equal(v.api.frontier().sequence.phase,'speak');assert.equal(v.api.frontier().sequence.elapsed,0);v.step(100);assert.equal(v.api.frontier().sequence.phase,'speak');
});
test('escape, newer navigation, history and demo entry cancel every wizard phase',async()=>{
 for(const phase of ['appear','speak','escort','vanish'])for(const action of ['escape','navigate','history','demo']){
  const v=await village({reduced:true});v.api.setHero(-48,450);v.clickGround(-100,450);
  if(phase!=='appear')v.step(50);if(['escort','vanish'].includes(phase))v.step(1500);if(['vanish'].includes(phase))for(let i=0;i<1500&&v.api.frontier().sequence.phase==='escort';i++)v.step(40);
  assert.equal(v.api.frontier().sequence.phase,phase);
  if(action==='escape')v.key('keydown','Escape');if(action==='navigate')v.api.go('hall');if(action==='history'){v.location.hash='#arena';v.api.restoreHash();}if(action==='demo')v.api.showDemo();
  const writes=v.historyCalls.length;v.api.advanceFrontier(100);assert(!v.api.frontier().open);assert.equal(v.api.frontier().wizard,null);assert(v.get('#frontier-bubble').hidden);assert.equal(v.historyCalls.length,writes);assert.notEqual(v.api.state().current,'gate');
 }
});

test('Skip mid-escort waits for its teleport effect and remains cancellable',async()=>{const v=await village();v.api.setHero(-48,450);v.clickGround(-100,450);v.step(800);v.step(1500);for(let i=0;i<40;i++)v.step(16);const p=v.api.state();v.get('#frontier-download').onclick();v.step(16);assert.equal(v.api.state().x,p.x);assert.equal(v.api.state().y,p.y);assert.equal(v.api.frontier().sequence.phase,'teleport-out');v.key('keydown','Escape');for(let i=0;i<300;i++)v.step(16);assert(!v.api.frontier().open);assert.notEqual(v.api.state().current,'gate');});

test('old boundary is now traversable, new limits remain solid, and no ward line is drawn',async()=>{const v=await village();v.api.setHero(48,450);v.clickGround(16,450);v.api.finish();assert(!v.api.frontier().open);assert(Math.abs(v.api.state().x-16)<.001);assert(v.api.townPhysics.free(-66,450));assert(!v.api.townPhysics.free(-67,450));assert(v.api.townPhysics.free(1506,450));assert(!v.api.townPhysics.free(1507,450));assert(v.api.townPhysics.free(720,-66));assert(!v.api.townPhysics.free(720,-67));assert(v.api.townPhysics.free(720,966));assert(!v.api.townPhysics.free(720,967));assert(!siteSource().includes('drawFrontierWard'));});

test('Downloads reveals progressively during walking and hands off without a second animation',async()=>{
 for(const reduced of [false,true]){
 const v=await village({reduced});v.api.setHero(-48,450);v.clickGround(-100,450);const preview=v.get('#frontier-download-reveal'),writes=v.historyCalls.length;assert(preview.hidden);v.step(reduced?50:800);v.step(1500);assert(!preview.hidden);assert.match(preview.innerHTML,/No game download is available/);assert.equal(Number(preview.style.getPropertyValue('--reveal')),0);let last=0,intermediate=false;
 while(v.api.frontier().sequence.phase==='escort'){v.step(40);const progress=Number(preview.style.getPropertyValue('--reveal'));assert(progress>=last&&progress<=1);if(progress>0&&progress<1)intermediate=true;last=progress;assert.equal(v.api.state().current,'home');assert.equal(v.historyCalls.length,writes);}
 assert(intermediate);assert.equal(last,1);assert.equal(v.api.frontier().sequence.phase,'vanish');let animations=0;v.get('#panel-content').animate=()=>animations++;v.step(reduced?50:220);assert.equal(v.api.frontier().wizard,null);assert(preview.hidden);assert.equal(animations,0);assert.equal(v.api.state().current,'gate');assert.equal(v.historyCalls.length,writes+1);
 }
});
test('download reveal freezes with Pause and disappears on cancellation',async()=>{const v=await village();v.api.setHero(-48,450);v.clickGround(-100,450);v.step(800);v.step(1500);for(let i=0;i<50;i++)v.step(40);const preview=v.get('#frontier-download-reveal'),p=preview.style.getPropertyValue('--reveal');v.api.pause();v.step(20000);assert.equal(preview.style.getPropertyValue('--reveal'),p);v.key('keydown','Escape');assert(preview.hidden);assert.equal(v.api.state().current,'home');});

function mobileStick(v){const pad=v.get('#joystick-pad');pad.getBoundingClientRect=()=>({left:18,top:400,width:112,height:112});return(type,x=74,y=456,id=1)=>{let prevented=false;pad.events[type]({pointerId:id,button:0,clientX:x,clientY:y,preventDefault(){prevented=true;},stopPropagation(){}});return prevented;};}
test('mobile thumbstick has deadzone, capture, cardinal walking and release without sliding',async()=>{
 for(const reduced of [false,true]){
 const v=await village({width:390,height:620,reduced});v.api.setHero(600,450);const stick=mobileStick(v),pad=v.get('#joystick-pad');let focus=0;v.get('#scene').focus=()=>focus++;
 assert(stick('pointerdown'));assert(pad.hasPointerCapture(1));assert.equal(v.api.joystick().direction,null);const start=v.api.state();v.step(40);assert.equal(v.api.state().x,start.x);stick('pointermove',120,465);assert.equal(v.api.joystick().direction,1);v.step(40);assert(v.api.state().x>start.x);assert.equal(v.api.state().y,start.y);assert.equal(focus,0);
 stick('pointermove',74,510,2);assert.equal(v.api.joystick().direction,1);stick('pointerup',120,465,2);assert.equal(v.api.joystick().pointer,1);stick('pointerup',120,465);assert.equal(v.api.joystick().pointer,null);assert(!pad.hasPointerCapture(1));const stopped=v.api.state();for(let i=0;i<10;i++)v.step(40);assert.equal(v.api.state().x,stopped.x);assert.equal(v.api.state().y,stopped.y);assert.equal(pad.style.getPropertyValue('--stick-x'),'0px');if(reduced)assert.equal(v.frames.size,0);
 }
});
test('mobile thumbstick stops at deadzone and supports all cardinal directions',async()=>{for(const[x,y,dir]of [[74,400,0],[130,456,1],[74,512,2],[18,456,3]]){const v=await village({width:390,height:620});v.api.setHero(600,450);const stick=mobileStick(v);stick('pointerdown',x,y);assert.equal(v.api.joystick().direction,dir);v.step(40);assert.equal(v.api.state().dir,dir);stick('pointermove',74,456);const p=v.api.state();v.step(40);assert.equal(v.api.state().x,p.x);assert.equal(v.api.state().y,p.y);}});
test('mobile thumbstick cleans capture/input on lifecycle changes and cannot revive stale gestures',async()=>{
 for(const action of ['cancel','lost','globalup','pagehide','orientation','hide','blur','resize','navigate','notes','demo','pause']){
 const v=await village({width:390,height:620});v.api.setHero(600,450);const stick=mobileStick(v);stick('pointerdown',120,456);v.step(16);
 if(action==='globalup')v.windowListeners.pointerup({pointerId:1,preventDefault(){}});if(action==='pagehide')v.windowListeners.pagehide();if(action==='orientation')v.windowListeners.orientationchange();if(action==='cancel')stick('pointercancel');if(action==='lost')stick('lostpointercapture');if(action==='hide'){v.document.hidden=true;v.listeners.visibilitychange();}if(action==='blur')v.windowListeners.blur();if(action==='resize')v.api.resize();if(action==='navigate')v.api.go('hall');if(action==='notes')v.get('#mobile-about').onclick();if(action==='demo')v.api.showDemo();if(action==='pause')v.api.pause();
 assert.equal(v.api.joystick().pointer,null,action);assert.equal(v.api.joystick().direction,null,action);stick('pointermove',120,456);assert.equal(v.api.joystick().pointer,null,action);
 }
});
test('mobile layout retains Home/About as popups without a below-map content area',async()=>{const v=await village({width:390,height:620});v.api.go('home');assert(v.get('#zone-dialog').open);v.get('#close-zone').onclick();v.get('#mobile-about').onclick();assert(v.get('#notes').open);const css=readFileSync(join(__dirname,'../src/site/style.css'),'utf8');assert(containsCode(css,'#main-content,footer{display:none!important}'));assert(containsCode(css,'height:100dvh;display:flex'));assert(containsCode(css,'#world,#world.frontier-active'));});
test('long thumbstick exploration keeps the player in the mobile viewport',async()=>{const v=await village({width:390,height:620});v.api.setHero(600,450);const stick=mobileStick(v);stick('pointerdown',18,456);for(let i=0;i<200&&!v.api.frontier().open;i++){v.step(40);const p=v.api.heroScreen();assert(p.x>=70&&p.x<=320);assert(p.y>=90&&p.y<=500);}assert(Number.isFinite(v.api.joystick().panX));});

test('wide touch devices retain joystick and popup-only mode',async()=>{const v=await village({width:1024,height:520,coarse:true});v.api.setHero(600,450);const stick=mobileStick(v);assert(stick('pointerdown',120,456));v.step(40);assert(v.api.state().x>600);stick('pointerup');v.api.go('home');assert(v.get('#zone-dialog').open);});

test('Apocalipsis finishes after keyboard, ground and joystick movement takeover',async()=>{for(const method of ['keyboard','ground','joystick']){const v=await village({width:method==='joystick'?390:1440});v.api.castPointer(935,550);v.api.advanceSpell(.1);const before=v.api.spellDetails();if(method==='keyboard'){v.key('keydown','s');v.key('keyup','s');}if(method==='ground')v.clickGround(900,580);if(method==='joystick'){const stick=mobileStick(v);stick('pointerdown',120,456);}assert(v.api.spellDetails());assert.equal(v.api.spellDetails().age,before.age);assert.equal(v.api.spellDetails().x,before.x);v.api.advanceSpell(1.8);assert(v.api.state().spell);v.api.advanceSpell(.11);assert(!v.api.state().spell);}});
test('casts already near each keeper preserve position instead of walking away',async()=>{for(const place of ['home','arena','hall','gate']){const v=await village();const k=v.api.keeper(place);v.api.setHero(k.x+32,k.y);v.api.go(place,{cast:true});v.api.finish();assert.equal(v.api.state().x,k.x+32);assert.equal(v.api.state().y,k.y);assert.equal(v.api.state().atPlace,place);}});
test('real-tick casting routes reach adjacent keeper tiles despite roaming NPCs',async()=>{for(const idle of [0,.8,1.6,2.4,3.2,4,4.8,6.4])for(const place of ['home','arena','hall','gate']){const v=await village();for(let i=0;i<idle/.04;i++)v.step(40);v.api.go(place,{cast:true});let frames=0;while(v.api.state().route&&frames++<1000)v.step(40);const p=v.api.state(),k=v.api.keeper(place);assert.equal(p.atPlace,place,place+' '+idle);assert(Math.hypot(p.x-k.x,p.y-k.y)<=48);assert(Math.hypot(p.x-k.x,p.y-k.y)>=20);}});
test('occupied old landing does not leave cast navigation stranded',async()=>{const v=await village(),land=v.api.target('hall');v.api.setNpc(0,land.x,land.y);v.api.go('hall',{cast:true});for(let i=0;i<800&&v.api.state().route;i++)v.step(40);const p=v.api.state(),k=v.api.keeper('hall');assert.equal(p.atPlace,'hall');assert(Math.hypot(p.x-k.x,p.y-k.y)<=48);});
test('wizard appearance preserves the mobile zoom and waits until arrival to show Downloads popup',async()=>{for(const width of [390,768]){const v=await village({width,height:620});const before=v.api.scale();v.api.setHero(-48,450);v.clickGround(-100,450);v.api.viewport();assert.equal(v.api.scale(),before);v.step(800);v.step(1500);for(let i=0;i<20;i++)v.step(40);assert.equal(v.api.scale(),before);assert(v.get('#frontier-download-reveal').hidden);assert(!v.get('#zone-dialog').open);v.get('#frontier-download').onclick();v.step(280);v.step(320);v.step(220);assert(v.get('#zone-dialog').open);assert(v.get('#zone-dialog').classList.contains('arrival-effect'));}});
test('joystick touch guards are non-passive and scoped to cancelable pad gestures',async()=>{const v=await village({width:390});const pad=v.get('#joystick-pad');for(const type of ['touchstart','touchmove']){assert.equal(pad.eventOptions[type].passive,false);let count=0;pad.events[type]({cancelable:true,preventDefault(){count++;}});assert.equal(count,1);pad.events[type]({cancelable:false,preventDefault(){throw Error('Cannot cancel');}});}assert.equal(v.listeners.touchmove,undefined);});
test('pause and reduced-motion arrival avoid a newly occupied endpoint',async()=>{for(const mode of ['pause','reduce']){const v=await village();v.api.go('hall',{cast:true});v.api.advanceRoute(.1);const target=v.api.path().at(-1);v.api.setNpc(0,target.x,target.y);if(mode==='pause')v.api.pause();else v.api.reduced(true);const p=v.api.state();assert.equal(p.atPlace,'hall');assert(Math.hypot(p.x-target.x,p.y-target.y)>=20);assert(Math.hypot(p.x-v.api.keeper('hall').x,p.y-v.api.keeper('hall').y)<=48);}});
