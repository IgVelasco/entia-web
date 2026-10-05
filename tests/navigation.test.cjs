const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

// Exercise the actual navigation state machine with a deterministic clock.
// Rendering and browser layout are checked separately in the live preview.
async function village({reduced=false, hash='',width=1440,height=820}={}) {
  const nodes=new Map(), frames=new Map(), draws=[];let nextFrame=0;
  const makeNode=()=>{
    const attributes=new Map(),classes=new Set(),children=new Map(),events={};
    return {open:false,showModal(){this.open=true;},close(){this.open=false;events.close?.();},hidden:false,disabled:false,textContent:'',innerHTML:'',style:{setProperty(){}},dataset:{},scrollTop:0,
      classList:{add:(...items)=>items.forEach(x=>classes.add(x)),remove:(...items)=>items.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},
      setAttribute:(key,value)=>attributes.set(key,value),getAttribute:key=>attributes.get(key),removeAttribute:key=>attributes.delete(key),
      remove(){},events,addEventListener:(key,callback)=>{events[key]=callback;},append(){},focus(){},animate(){},getAnimations:()=>[],matches:()=>false,closest:()=>null,contains:()=>false,
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
  const context=vm.createContext({document,window:{location:{assign(){}},history,addEventListener:(key,cb)=>{windowListeners[key]=cb;}},location,matchMedia:()=>preference,devicePixelRatio:1,
    Image:class{constructor(){this.width=768;this.height=640;}set src(value){this.path=value;this.onload();}},
    fetch:async()=>({ok:true,json:async()=>JSON.parse(readFileSync(join(__dirname,'../dist/assets/site-assets.json'),'utf8'))}),
    requestAnimationFrame:callback=>{frames.set(++nextFrame,callback);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:()=>0,clearTimeout(){},console,performance:{now:()=>0},history
  });
  vm.runInContext(readFileSync(join(__dirname,'../dist/world-physics.js'),'utf8'),context);
  context.WorldPhysics=context.window.WorldPhysics;
  vm.runInContext(readFileSync(join(__dirname,'../dist/app.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  const api=vm.runInContext(`({go,advanceRoute,advanceSpell,drawSpell,drawActor,restoreHash,advanceMovement,isWalkable,houseBounds,townPhysics,houses,insideHouse,updateHouseRoofs,
    pause(){paused=true;setMotionState();},
    reduced(value){motionPreference.matches=value;setMotionState();},
    finish(){for(let i=0;i<500&&route;i++)advanceRoute(.1);},
    tick,viewport,walkToPortal,castPointer,showDemo,closeDemo,draw,ground,groundReady:()=>groundReady,
    demoState:()=>({open:demoOpen,loaded:demoLoaded,blocked:portalReentryBlocked}),
    townEntities:()=>[hero,...keepers,...npcs,...scenery,homePortal],
    placeHero(x,y){hero.x=x;hero.y=y;viewport();positionLabels();},
    heroScreen:()=>screen(hero),viewportSize:()=>({width,height}),npcPositions:()=>npcs.map(n=>({x:n.x,y:n.y})),
    drawHero(){drawActor(hero);},
    drawKeeper(){drawActor(keepers[0]);},
    path:()=>route?.points,
    state:()=>({ready,current,route:!!route,spell:!!spell,spellPlace:spell?.place,spellHit:spell?.hit,manual:route?.manual,explore:route?.explore,held:heldDirections.size,rings:rings.length,gait:hero.gait,dir:hero.dir,x:hero.x,y:hero.y,atPlace,cameraX:camera.x,cameraTargetX:camera.targetX}),
    groundPoint:(x,y)=>{const p=screen({x,y});return {clientX:p.x,clientY:p.y+80};},
    target:place=>spots[place].land,
    reaction:place=>keepers.find(k=>k.place===place).reaction,
    label:place=>keepers.find(k=>k.place===place).button.querySelector('.keeper-clan').textContent
  })`,context);
  assert.equal(api.state().ready,true);
  const key=(type,value,options={})=>{
    let prevented=false;
    listeners[type]({key:value,target:get('#scene'),preventDefault(){prevented=true;},...options});
    return prevented;
  };
  const clickGround=(x,y)=>get('#scene').events.click(api.groundPoint(x,y));
  return {api,get,location,preference,nav,frames,draws,listeners,windowListeners,document,key,clickGround,historyCalls,history};
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
  assert.equal(api.state().x,api.target('gate').x);
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
  assert.equal(s.x,api.target('hall').x);assert.equal(s.y,api.target('hall').y);
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
  assert.ok(api.state().x<=1410);assert.equal(api.isWalkable(432,580),false);assert.equal(api.state().route,false);
  key('keydown','ArrowDown');for(let i=0;i<30;i++)api.advanceMovement(.2);
  key('keyup','ArrowDown');
  assert.ok(api.state().y<=870);assert.equal(api.state().route,false);
  assert.equal(api.isWalkable(api.state().x,api.state().y),true);
});

test('keyboard takeover cancels an old navigation arrival callback',async()=>{
  const {api,key,get}=await village();
  api.go('hall',{cast:true});api.advanceRoute(.1);
  key('keydown','d');key('keyup','d');api.advanceMovement(2);
  assert.equal(api.state().atPlace,null);assert.equal(api.state().current,'hall');
  assert.equal(api.state().spell,false);assert.equal(get('#location-state').textContent,'Exploring Nix');
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
test('mobile zone popup opens and closes without moving the character home',async()=>{const v=await village({width:390,height:480});v.api.go('hall',{cast:true});assert(v.get('#zone-dialog').open);assert(v.api.state().spell);v.get('#close-zone').onclick();assert(!v.get('#zone-dialog').open);assert.equal(v.api.state().current,'hall');assert(v.api.state().route);});
test('tapping a world character casts and starts its zone journey',async()=>{const v=await village();const target=v.api.townEntities().find(a=>a.place==='hall');v.clickGround(target.x,target.y-25);assert.equal(v.api.state().spellPlace,'hall');assert.equal(v.api.state().current,'hall');assert(v.api.state().route);});

test('the old collect-lights minigame has no markup, entry points or runtime',()=>{const html=readFileSync(join(__dirname,'../dist/index.html'),'utf8'),js=readFileSync(join(__dirname,'../dist/app.js'),'utf8');assert(!html.includes('id="essence-game"'));assert(!html.includes('id="wander"'));assert(!js.includes('function startGame'));assert(!js.includes('Try collecting lights'));});

test('phone overview retains all four actor areas while navigating each zone',async()=>{for(const width of [320,390,430]){const v=await village({width,height:480});for(const place of ['home','arena','hall','gate']){v.api.go(place,{instant:true});v.api.viewport();for(const k of v.api.townEntities().filter(a=>a.isKeeper)){const screen=v.api.groundPoint(k.x,k.y);assert(screen.clientX>=32&&screen.clientX<=width-32);assert(screen.clientY-80>=40&&screen.clientY-80<=420);}}}});

test('home popup has a slower translucent reveal and preserves reduced motion',()=>{const css=readFileSync(join(__dirname,'../dist/style.css'),'utf8');assert(css.includes('zone-reveal 1.1s ease-out'));assert(css.includes('background:rgba(14,33,26,.84)'));assert(css.includes('#zone-dialog[open],#zone-dialog[open]::backdrop{animation:none}'));});

test('both house variants have equal native tile scale and open two-tile entrances',async()=>{const v=await village();for(const h of v.api.townEntities().filter(p=>p.id?.startsWith('house')&&!p.decorative)){assert.equal(h.w,256);assert.equal(h.h,683*32/60);const b=v.api.houseBounds(h);assert.equal(b.doorX%32,0);for(const x of [b.doorX+16,b.doorX+48]){assert(v.api.townPhysics.free(x,h.y-16));assert(v.api.townPhysics.free(x,h.y-48));}assert(!v.api.townPhysics.free(b.doorX-16,h.y-16));assert(!v.api.townPhysics.free(b.doorX+80,h.y-16));assert(v.api.townPhysics.free(b.doorX+16,h.y-80));}});

test('house interior is reachable through the doorway, walls remain solid and roof fades in 220ms',async()=>{const v=await village();const h=v.api.houses.find(h=>!h.decorative),b=v.api.houseBounds(h);const outside={x:b.doorX+16,y:h.y+16},inside={x:b.doorX+16,y:h.y-112};const path=v.api.townPhysics.path(outside,inside);assert(path.length);assert(!v.api.townPhysics.free(b.left+8,h.y-100));assert(!v.api.townPhysics.free(b.left+248,h.y-100));assert(!v.api.townPhysics.free(b.left+100,h.y-200));v.api.placeHero(inside.x,inside.y);assert(v.api.insideHouse(h));v.api.updateHouseRoofs(.11);assert(Math.abs(h.roofAlpha-.5)<1e-9);v.api.updateHouseRoofs(.11);assert.equal(h.roofAlpha,0);v.api.placeHero(outside.x,outside.y);v.api.updateHouseRoofs(.22);assert.equal(h.roofAlpha,1);});
test('decorative left house stays closed and does not cover the Game character',async()=>{const v=await village();const h=v.api.houses.find(h=>h.decorative),b=v.api.houseBounds(h),game=v.api.townEntities().find(p=>p.place==='arena');assert(h.x<600);assert(game.x>h.x+h.w/2);assert(!v.api.townPhysics.free(b.doorX+16,h.y-16));v.api.placeHero(b.doorX+16,h.y-100);v.api.updateHouseRoofs(1);assert.equal(h.roofAlpha,1);});
test('reduced-motion house roof changes immediately',async()=>{const v=await village({reduced:true});const h=v.api.houses.find(h=>!h.decorative),b=v.api.houseBounds(h);v.api.placeHero(b.doorX+16,h.y-112);v.api.updateHouseRoofs(0);assert.equal(h.roofAlpha,0);});
