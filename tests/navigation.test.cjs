const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');

// Exercise the actual navigation state machine with a deterministic clock.
// Rendering and browser layout are checked separately in the live preview.
async function village({reduced=false, hash=''}={}) {
  const nodes=new Map(), frames=new Map();let nextFrame=0;
  const makeNode=()=>{
    const attributes=new Map(),classes=new Set(),children=new Map();
    return {hidden:false,disabled:false,textContent:'',innerHTML:'',style:{},dataset:{},scrollTop:0,
      classList:{add:(...items)=>items.forEach(x=>classes.add(x)),remove:(...items)=>items.forEach(x=>classes.delete(x)),toggle:(x,on)=>on?classes.add(x):classes.delete(x),contains:x=>classes.has(x)},
      setAttribute:(key,value)=>attributes.set(key,value),getAttribute:key=>attributes.get(key),removeAttribute:key=>attributes.delete(key),
      addEventListener(){},append(){},focus(){},animate(){},getAnimations:()=>[],matches:()=>false,contains:()=>false,
      querySelector(key){if(!children.has(key))children.set(key,makeNode());return children.get(key);},
      getBoundingClientRect:()=>({width:1440,height:820,left:0,top:80}),
      getContext:()=>new Proxy({createRadialGradient:()=>({addColorStop(){}}),createPattern:()=>({})},{get:(obj,key)=>obj[key]||(()=>{})})
    };
  };
  const get=key=>{if(!nodes.has(key))nodes.set(key,makeNode());return nodes.get(key);};
  const nav=['home','arena','hall','gate'].map(place=>{const node=makeNode();node.dataset.place=place;return node;});
  const lights=[0,1,2].map(i=>{const node=get(`[data-essence="${i}"]`);node.dataset.essence=String(i);return node;});
  const listeners={};
  const preference={matches:reduced,addEventListener:(_,cb)=>{preference.change=cb;}};
  const location={hash};
  const history={pushState:(_,__,value)=>{location.hash=value;}};
  const document={hidden:false,querySelector:get,querySelectorAll:key=>key==='.nav'?nav:key==='[data-essence]'?lights:[],createElement:()=>makeNode(),addEventListener:(key,cb)=>{listeners[key]=cb;}};
  const context=vm.createContext({document,window:{history,addEventListener(){}},location,matchMedia:()=>preference,devicePixelRatio:1,
    Image:class{constructor(){this.width=768;this.height=640;}set src(_){this.onload();}},
    fetch:async()=>({ok:true,json:async()=>({images:{hero:'hero.png',rogue:'rogue.png',mage:'mage.png',grass:'grass.png',path:'path.png',stone:'stone.png',house:'house.png',house2:'house2.png',tree:'tree.png',tree2:'tree2.png',pine:'pine.png'}})}),
    requestAnimationFrame:callback=>{frames.set(++nextFrame,callback);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:()=>0,clearTimeout(){},console,performance:{now:()=>0},history
  });
  vm.runInContext(readFileSync(join(__dirname,'../dist/app.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  const api=vm.runInContext(`({go,advanceRoute,startGame,collectLight,restoreHash,
    pause(){paused=true;setMotionState();},
    reduced(value){motionPreference.matches=value;setMotionState();},
    finish(){if(route)advanceRoute(2);},
    state:()=>({ready,current,route:!!route,spell:!!spell,rings:rings.length,trail:flightTrail.length,lift:hero.lift,x:hero.x,y:hero.y,atPlace,game,collected,cameraX:camera.x,cameraTargetX:camera.targetX}),
    target:place=>spots[place].land,
    reaction:place=>keepers.find(k=>k.place===place).reaction
  })`,context);
  assert.equal(api.state().ready,true);
  return {api,get,location,preference,nav,frames};
}

test('a spell opens content and marks the section before its journey completes',async()=>{
  const {api,get,nav}=await village();
  api.go('arena',{cast:true});
  assert.equal(api.state().current,'arena');
  assert.equal(api.state().route,true);
  assert.equal(api.state().spell,true);
  assert.match(get('#panel-content').innerHTML,/PVP VISION/);
  assert.equal(get('#location-state').textContent,'Traveling to the arena…');
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
  assert.match(get('#panel-content').innerHTML,/CLIENT DOWNLOAD/);
  assert.equal(get('#location-name').textContent,'The crossing');
});

test('pause during flight lands at the latest destination and clears motion',async()=>{
  const {api,get}=await village();
  api.go('hall',{cast:true});api.advanceRoute(.2);api.pause();
  const s=api.state();
  assert.equal(s.route,false);assert.equal(s.spell,false);assert.equal(s.rings,0);assert.equal(s.trail,0);assert.equal(s.lift,0);
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
    assert.equal(api.state().route,false);assert.equal(api.state().spell,false);assert.equal(api.state().lift,0);
    assert.equal(api.state().atPlace,destination);
  }
  assert.equal(get('#motion').disabled,true);
});

test('a live reduced-motion change resolves a pending flight immediately',async()=>{
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
