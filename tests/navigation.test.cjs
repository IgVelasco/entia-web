const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

// Exercise the actual navigation state machine with a deterministic clock.
// Rendering and browser layout are checked separately in the live preview.
async function village({reduced=false, hash=''}={}) {
  const nodes=new Map(), frames=new Map(), draws=[];let nextFrame=0;
  const makeNode=()=>{
    const attributes=new Map(),classes=new Set(),children=new Map(),events={};
    return {hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},dataset:{},scrollTop:0,
      classList:{add:(...items)=>items.forEach(x=>classes.add(x)),remove:(...items)=>items.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},
      setAttribute:(key,value)=>attributes.set(key,value),getAttribute:key=>attributes.get(key),removeAttribute:key=>attributes.delete(key),
      events,addEventListener:(key,callback)=>{events[key]=callback;},append(){},focus(){},animate(){},getAnimations:()=>[],matches:()=>false,closest:()=>null,contains:()=>false,
      querySelector(key){if(!children.has(key))children.set(key,makeNode());return children.get(key);},
      getBoundingClientRect:()=>({width:1440,height:820,left:0,top:80}),
      getContext:()=>new Proxy({drawImage:(...args)=>draws.push(args),createRadialGradient:()=>({addColorStop(){}}),createPattern:()=>({})},{get:(obj,key)=>obj[key]||(()=>{})})
    };
  };
  const get=key=>{if(!nodes.has(key))nodes.set(key,makeNode());return nodes.get(key);};
  const nav=['home','arena','hall','gate'].map(place=>{const node=makeNode();node.dataset.place=place;return node;});
  const lights=[0,1,2].map(i=>{const node=get(`[data-essence="${i}"]`);node.dataset.essence=String(i);return node;});
  const listeners={},windowListeners={};
  const preference={matches:reduced,addEventListener:(_,cb)=>{preference.change=cb;}};
  const location={hash};
  const historyCalls=[];
  const history={pushState:(_,__,value)=>{location.hash=value;historyCalls.push(['push',value]);},replaceState:(_,__,value)=>{location.hash=value;historyCalls.push(['replace',value]);}};
  const document={hidden:false,querySelector:get,querySelectorAll:key=>key==='.nav'?nav:key==='[data-essence]'?lights:[],createElement:()=>makeNode(),addEventListener:(key,cb)=>{listeners[key]=cb;}};
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
  const api=vm.runInContext(`({go,advanceRoute,advanceSpell,drawSpell,drawActor,startGame,collectLight,restoreHash,advanceMovement,isWalkable,
    pause(){paused=true;setMotionState();},
    reduced(value){motionPreference.matches=value;setMotionState();},
    finish(){for(let i=0;i<500&&route;i++)advanceRoute(.1);},
    tick,viewport,walkToPortal,castPointer,
    heroScreen:()=>screen(hero),viewportSize:()=>({width,height}),npcPositions:()=>npcs.map(n=>({x:n.x,y:n.y})),
    drawHero(){drawActor(hero);},
    drawKeeper(){drawActor(keepers[0]);},
    path:()=>route?.points,
    state:()=>({ready,current,route:!!route,spell:!!spell,spellPlace:spell?.place,spellHit:spell?.hit,manual:route?.manual,explore:route?.explore,held:heldDirections.size,rings:rings.length,gait:hero.gait,dir:hero.dir,x:hero.x,y:hero.y,atPlace,game,collected,cameraX:camera.x,cameraTargetX:camera.targetX}),
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
  return {api,get,location,preference,nav,frames,draws,listeners,windowListeners,document,key,clickGround,historyCalls};
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

test('leaving an essence collection cancels its pending reward',async()=>{
  const {api}=await village();
  api.startGame();api.collectLight(0);api.advanceRoute(.1);
  api.go('gate');api.finish();
  assert.equal(api.state().game,false);assert.equal(api.state().collected,0);assert.equal(api.state().atPlace,'gate');
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
  assert.deepEqual(first.slice(5),[1190-72.8,345-32-64.8,145.6,129.6]);
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
  assert.ok(api.state().x<=1410);assert.equal(api.isWalkable(1250,580),false);assert.equal(api.state().route,false);
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

test('keyboard movement collects nearby lights without leaving the minigame',async()=>{
  const {api,key,get}=await village();api.startGame();
  key('keydown','d');key('keyup','d');api.advanceMovement(.2);
  key('keydown','s');key('keyup','s');api.advanceMovement(.2);
  assert.equal(api.state().game,true);assert.equal(api.state().collected,1);
  assert.equal(get('#essence-count').textContent,'1 / 3 lights');
});

test('character clan tags use Now for the open section and concise destination context',async()=>{
  const {api}=await village();
  assert.equal(api.label('home'),'<Now>');assert.equal(api.label('hall'),'<Preview>');
  assert.equal(api.label('gate'),'<Unavailable>');
  api.go('gate');assert.equal(api.label('gate'),'<Now>');assert.equal(api.label('home'),'<Nix>');
});

test('clicks inside the world no longer fall through to the world data-place attribute',async()=>{
  const {api,get,listeners}=await village();api.startGame();
  const world=get('#world');world.dataset.place='home';
  listeners.click({target:{closest:selector=>selector==='[data-place]'?world:null},preventDefault(){}});
  assert.equal(api.state().game,true);
  assert.equal(get('#essence-game').hidden,false);
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
  assert.equal(entered.x,774);assert.equal(entered.y,662);
  assert.equal(entered.held,1);assert.equal(entered.route,true);
  assert.equal(entered.spell,false);assert.equal(v.location.hash,'#gate');
  assert.match(v.get('#panel-content').innerHTML,/Download Entia/);
  assert.equal(v.nav[3].getAttribute('aria-current'),'page');
  assert.equal(v.api.label('gate'),'<Now>');
  v.get('#main-content').scrollTop=40;
  v.api.advanceMovement(.2);
  assert.equal(v.api.state().y,694);assert.equal(v.get('#main-content').scrollTop,40);
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

test('walking near characters does not interrupt collecting lights',async()=>{
  const v=await village();v.api.startGame();westSide(v);
  for(let i=0;i<6;i++)tap(v,'s');
  assert.equal(v.api.state().game,true);assert.equal(v.api.state().current,'home');
  assert.equal(v.get('#essence-game').hidden,false);assert.equal(v.get('#panel').hidden,true);
  assert.deepEqual(v.historyCalls,[]);
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
test('home portal has a reachable collision-aware route',async()=>{const v=await village();v.api.walkToPortal();assert(v.api.state().route);v.api.finish();assert.ok(Math.abs(v.api.state().x-1010)<1e-5);assert.ok(Math.abs(v.api.state().y-420)<1e-5);});
test('town pointer spell preserves requested ground coordinates',async()=>{const v=await village();v.api.castPointer(935,550);assert(v.api.state().spell);assert.equal(v.api.state().route,false);});
