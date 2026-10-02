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
    const attributes=new Map(),classes=new Set(),children=new Map();
    return {hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},dataset:{},scrollTop:0,
      classList:{add:(...items)=>items.forEach(x=>classes.add(x)),remove:(...items)=>items.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},
      setAttribute:(key,value)=>attributes.set(key,value),getAttribute:key=>attributes.get(key),removeAttribute:key=>attributes.delete(key),
      addEventListener(){},append(){},focus(){},animate(){},getAnimations:()=>[],matches:()=>false,closest:()=>null,contains:()=>false,
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
  const history={pushState:(_,__,value)=>{location.hash=value;}};
  const document={hidden:false,querySelector:get,querySelectorAll:key=>key==='.nav'?nav:key==='[data-essence]'?lights:[],createElement:()=>makeNode(),addEventListener:(key,cb)=>{listeners[key]=cb;}};
  const context=vm.createContext({document,window:{history,addEventListener:(key,cb)=>{windowListeners[key]=cb;}},location,matchMedia:()=>preference,devicePixelRatio:1,
    Image:class{constructor(){this.width=768;this.height=640;}set src(value){this.path=value;this.onload();}},
    fetch:async()=>({ok:true,json:async()=>JSON.parse(readFileSync(join(__dirname,'../dist/assets/site-assets.json'),'utf8'))}),
    requestAnimationFrame:callback=>{frames.set(++nextFrame,callback);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:()=>0,clearTimeout(){},console,performance:{now:()=>0},history
  });
  vm.runInContext(readFileSync(join(__dirname,'../dist/app.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  const api=vm.runInContext(`({go,advanceRoute,advanceSpell,drawSpell,drawActor,startGame,collectLight,restoreHash,advanceMovement,isWalkable,
    pause(){paused=true;setMotionState();},
    reduced(value){motionPreference.matches=value;setMotionState();},
    finish(){if(route)advanceRoute(route.duration);},
    drawHero(){drawActor(hero);},
    drawKeeper(){drawActor(keepers[0]);},
    path:()=>route?.points,
    state:()=>({ready,current,route:!!route,spell:!!spell,spellPlace:spell?.place,spellHit:spell?.hit,manual:route?.manual,held:heldDirections.size,rings:rings.length,gait:hero.gait,dir:hero.dir,x:hero.x,y:hero.y,atPlace,game,collected,cameraX:camera.x,cameraTargetX:camera.targetX}),
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
  return {api,get,location,preference,nav,frames,draws,listeners,windowListeners,document,key};
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

test('walking advances one grounded cardinal tile in 0.20 seconds with the game stride',async()=>{
  const {api,draws}=await village();
  api.go('arena');
  const start=api.state();
  api.advanceRoute(.2);
  const step=api.state();
  assert.equal(step.x,start.x);assert.equal(step.y,start.y-32);assert.equal(step.dir,0);
  api.drawHero();
  const walking=draws.pop();
  assert.equal(walking[1],4*96); // Body 156: half of the two-tile stride.
  assert.equal(walking[6]+walking[8],step.y); // Feet never lift off the ground.
  api.finish();api.drawHero();
  const idle=draws.pop();assert.equal(idle[1],0);
  assert.equal(idle[6]+idle[8],api.state().y);
});

test('retargeting finishes the current footstep before turning and keeps routes cardinal',async()=>{
  const {api}=await village();
  api.go('arena');api.advanceRoute(.1);
  const before=api.state();
  api.go('hall');api.advanceRoute(.05);
  assert.equal(api.state().x,before.x);assert.equal(api.state().y,before.y-8);
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
  assert.ok(api.state().x<=1140);assert.equal(api.state().route,false);
  key('keydown','ArrowDown');for(let i=0;i<30;i++)api.advanceMovement(.2);
  key('keyup','ArrowDown');
  assert.ok(api.state().y<=780);assert.equal(api.state().route,false);
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
