/* Single-player teaching rules, intentionally independent from RAO's live economy. */
(function(root){
'use strict';
const Physics=typeof module!=='undefined'?require('../world-physics.js'):root.WorldPhysics;
const WIDTH=1200,HEIGHT=880,RADIUS=10;
const TILE=32;
const tileCenter=value=>Math.floor(value/TILE)*TILE+TILE/2;
const scenery=[];
const gateway={x:176,y:464},banker={x:176,y:688};
const obstacles=[{x:gateway.x-85,y:gateway.y-75,w:38,h:92},{x:gateway.x+47,y:gateway.y-75,w:38,h:92}];
const bankObstacle={x:banker.x-47,y:banker.y-10,w:94,h:24};
const physics=Physics.create({width:WIDTH,height:HEIGHT,minY:160,radius:RADIUS,obstacles});
function create(){return {phase:'arena',player:{x:304,y:432,dir:1,gait:0,hp:100,mana:100},carried:0,secured:0,autopotEnabled:true,heldPotions:[],lifePotions:100,manaPotions:100,potionCooldown:0,potionAttackLockout:0,lifePulse:0,manaPulse:0,dropped:0,kills:0,bank:0,bankAmount:0,bankFraction:0,streamParticles:[],bankUnlocked:false,armed:false,meditating:false,meleeCooldown:0,cooldown:0,time:0,fx:[],drops:[],nextDrop:1,notice:'Prepare Apocalipsis with C, then click a rival. Stand on its dropped essence and press Q.',noticeId:1,flash:1,won:false,enemies:[
 {name:'Wanderer',body:'rogue',x:496,y:368,homeX:496,homeY:368,hp:2,maxHp:2,reward:15,dir:2,gait:0,wind:0,cooldown:1,respawn:0,kind:'ranged',speed:105},
 {name:'Keeper',body:'mage',x:912,y:560,homeX:912,homeY:560,hp:2,maxHp:2,reward:25,dir:3,gait:0,wind:0,cooldown:1,respawn:0,kind:'ranged',speed:110},
 {name:'Sentinel',body:'hero',x:656,y:752,homeX:656,homeY:752,hp:3,maxHp:3,reward:30,dir:0,gait:0,wind:0,cooldown:1,respawn:0,kind:'ranged',speed:110}
]};}
function tell(s,message){s.notice=message;s.noticeId++;}
function nearGate(s){return Math.hypot(s.player.x-gateway.x,s.player.y-gateway.y)<65;}
function nearBank(s){return s.bankUnlocked&&Math.hypot(s.player.x-banker.x,s.player.y-banker.y)<87;}
function drop(s,x,y,amount,owner){if(amount<=0)return;const cx=tileCenter(x),cy=tileCenter(y),candidates=[];for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++)candidates.push({x:cx+col*TILE,y:cy+row*TILE});candidates.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));const point=candidates.find(p=>physics.free(p.x,p.y)&&!(s.bankUnlocked&&p.x+RADIUS>bankObstacle.x&&p.x-RADIUS<bankObstacle.x+bankObstacle.w&&p.y+RADIUS>bankObstacle.y&&p.y-RADIUS<bankObstacle.y+bankObstacle.h));if(!point)return;x=point.x;y=point.y;const existing=s.drops.find(d=>d.x===x&&d.y===y);if(existing){if(owner==='player')existing.owner='player';existing.amount+=amount;existing.readyAt=s.time+.5;return;}s.drops.push({id:s.nextDrop++,x,y,amount,owner,readyAt:s.time+.5});}
function canPickup(s,d,radius=22){return s.time>=d.readyAt&&Math.hypot(d.x-s.player.x,d.y-s.player.y)<=radius;}
function pickup(s,radius=20){const found=s.drops.filter(d=>canPickup(s,d,radius));if(!found.length)return 0;const amount=found.reduce((n,d)=>n+d.amount,0),ids=new Set(found.map(d=>d.id));s.drops=s.drops.filter(d=>!ids.has(d.id));s.carried+=amount;const first=!s.bankUnlocked;s.bankUnlocked=true;tell(s,first?`+${amount} essence picked up. The reliquary has appeared south of the return portal.`:`+${amount} essence picked up. Carry it to the reliquary or keep fighting.`);return amount;}
function interact(s){if(pickup(s,22))return 'pickup';if(nearBank(s))return 'bank';if(nearGate(s))return 'exit';return false;}
function cancelDeposit(s){s.bank=0;s.bankAmount=0;s.bankFraction=0;}

function cardinal(x,y){return Math.abs(x)>=Math.abs(y)?{x:Math.sign(x),y:0}:{x:0,y:Math.sign(y)};}
function heading(x,y){return Math.abs(x)>Math.abs(y)?(x>0?1:3):(y>0?2:0);}
function walkable(x,y,r=RADIUS){return physics.free(x,y);}
function lineClear(a,b){return physics.clear(a,b);}
function move(actor,dx,dy,others=[]){return physics.move(actor,dx,dy,others);}
function cast(s,target){
 if(!s.armed)return false;s.armed=false;
 if(s.cooldown>0||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return false;
 const p=s.player,d=Math.hypot(target.x-p.x,target.y-p.y);
 if(p.mana<15){tell(s,'Not enough mana. Rest in the sanctuary to recover.');return false;}
 if(d>270){tell(s,'Out of range. Move closer to your target.');return false;}
 if(!lineClear(p,target)){tell(s,'The spell is blocked. Find a clear line of sight.');return false;}
 p.dir=heading(target.x-p.x,target.y-p.y);s.cooldown=.75;s.potionAttackLockout=.31;s.meditating=false;p.mana-=15;
 // Only the actor explicitly under the pointer receives a targeted cast.
 // Damage is committed on the click, so walking does not dodge a confirmed target.
 const enemy=s.enemies.find(e=>e.name===target.enemyId&&e.hp>0&&Math.hypot(e.x-target.x,e.y-target.y)<1);
 s.fx.push({x:target.x,y:target.y,age:0,hit:true,owner:'player'});
 if(enemy){enemy.hp--;if(enemy.hp===0){s.kills++;enemy.respawn=14;enemy.wind=0;drop(s,enemy.x,enemy.y,enemy.reward,'rival');tell(s,`${enemy.name} dropped ${enemy.reward} essence. Stand over it and press Q to pick it up.`);}}
 else tell(s,'No rival under the pointer. Aim at a character and click.');
 return true;
}
function melee(s){
 if(s.meleeCooldown>0)return false;s.meleeCooldown=1;s.potionAttackLockout=.31;s.meditating=false;
 const p=s.player,v=[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}][p.dir];
 const target=s.enemies.filter(e=>e.hp>0).find(e=>{const dx=e.x-p.x,dy=e.y-p.y,forward=dx*v.x+dy*v.y,side=Math.abs(dx*v.y-dy*v.x);return forward>0&&forward<=58&&side<=20&&lineClear(p,e);});
 s.fx.push({x:p.x+v.x*32,y:p.y+v.y*32,age:0,hit:true,owner:'melee'});
 if(target){target.hp--;if(!target.hp){target.respawn=14;target.wind=0;s.kills++;drop(s,target.x,target.y,target.reward,'rival');tell(s,`${target.name} dropped ${target.reward} essence. Stand over it and press Q.`);}}
 else tell(s,'Strike the rival directly in front of you.');return true;
}
function meditate(s){s.meditating=!s.meditating;s.armed=false;s.player.step=null;tell(s,s.meditating?'Meditating. Stay still to recover mana.':'Meditation stopped.');}
function usePotion(s,kind){
 const life=kind==='life';if(!life&&kind!=='mana')return false;const stock=life?'lifePotions':'manaPotions',resource=life?'hp':'mana';
 if(s.player.hp<=0||s[stock]<=0||s.potionCooldown>1e-6||s.potionAttackLockout>1e-6)return false;
 // Normal-area RAO semantics: a valid use consumes stock even at full resources.
 s[stock]--;s.potionCooldown=.26;s.player[resource]=Math.min(100,s.player[resource]+(life?40:50));s[life?'lifePulse':'manaPulse']=.4;return true;
}
function pressPotion(s,key,kind){if(s.heldPotions.some(p=>p.key===key))return;s.heldPotions.push({key,kind,claimed:false});}
function releasePotion(s,key){const held=s.heldPotions.find(p=>p.key===key);s.heldPotions=s.heldPotions.filter(p=>p.key!==key);if(held&&!held.claimed)usePotion(s,held.kind);}
function clearPotionKeys(s){s.heldPotions=[];}

function botStep(s,e,target,dt){
 const others=[s.player,...s.enemies.filter(a=>a.hp>0)];
 if(!e.step){if(Math.hypot(target.x-e.x,target.y-e.y)<4)return;let v=cardinal(target.x-e.x,target.y-e.y),end={x:e.x+v.x*32,y:e.y+v.y*32};if(!physics.clear(e,end,others,e)){v={x:v.x?0:Math.sign(target.x-e.x),y:v.y?0:Math.sign(target.y-e.y)};end={x:e.x+v.x*32,y:e.y+v.y*32};if(!physics.clear(e,end,others,e))return;}e.step={...v,end,remaining:32};e.dir=heading(v.x,v.y);}
 const step=e.step,distance=Math.min(step.remaining,e.speed*dt),moved=move(e,step.x*distance,step.y*distance,others);e.moving=moved>.01;step.remaining-=moved;if(moved<distance-.001)e.step=null;else if(step.remaining<.001){e.x=step.end.x;e.y=step.end.y;e.step=null;}
}
function update(s,dt,input={x:0,y:0}){dt=Math.max(0,Math.min(dt,.05));s.time+=dt;s.flash=Math.max(0,s.flash-dt*1.5);s.cooldown=Math.max(0,s.cooldown-dt);s.meleeCooldown=Math.max(0,s.meleeCooldown-dt);for(const key of ['potionCooldown','potionAttackLockout','lifePulse','manaPulse'])s[key]=Math.max(0,s[key]-dt);const p=s.player;const vector=cardinal(input.x||0,input.y||0);p.moving=false;
 // Banking uses the same solid footprint as other props once it appears.
 const activeObstacles=s.bankUnlocked?[bankObstacle]:[];
 const insideBank=(x,y)=>activeObstacles.some(o=>x+RADIUS>o.x&&x-RADIUS<o.x+o.w&&y+RADIUS>o.y&&y-RADIUS<o.y+o.h);
 if(!p.step&&(vector.x||vector.y)){const end={x:p.x+vector.x*32,y:p.y+vector.y*32};p.dir=heading(vector.x,vector.y);if(!insideBank(end.x,end.y)&&physics.clear(p,end,s.enemies.filter(e=>e.hp>0),p))p.step={...vector,end,remaining:32};}
 if(p.step){const step=p.step,distance=Math.min(step.remaining,160*dt),dx=step.x*distance,dy=step.y*distance;const moved=insideBank(p.x+dx,p.y+dy)?0:move(p,dx,dy,s.enemies.filter(e=>e.hp>0));p.moving=moved>.01;step.remaining-=moved;if(moved<distance-.001)p.step=null;else if(step.remaining<.001){p.x=step.end.x;p.y=step.end.y;p.step=null;}}

 if(p.moving)s.meditating=false;
 if(s.meditating)p.mana=Math.min(100,p.mana+18*dt);
 const safe=p.x<270;
 if(safe){p.hp=Math.min(100,p.hp+12*dt);p.mana=Math.min(100,p.mana+24*dt);}
 for(const f of s.fx){f.age+=dt;if(f.owner==='enemy'&&!f.hit&&f.age>=.3){f.hit=true;if(!safe&&Math.hypot(p.x-f.x,p.y-f.y)<35){p.hp-=12;s.flash=.2;cancelDeposit(s);}}}s.fx=s.fx.filter(f=>f.age<2);
 s.streamParticles=s.streamParticles.filter(f=>(f.age+=dt)<.55);
 if(nearBank(s)&&s.carried>0){
  if(!s.bank){s.bankAmount=s.carried;s.bankFraction=0;}
  const previous=s.bank;s.bank+=dt;
  if(previous<1&&s.bank>=1)tell(s,'The bank is drawing in your essence. Stay nearby.');
  if(s.bank>=1){s.bankFraction+=dt*12;const amount=Math.min(s.carried,Math.floor(s.bankFraction));if(amount>0){s.bankFraction-=amount;s.carried-=amount;s.secured+=amount;s.won=s.secured>=60;for(let i=0;i<amount;i++)s.streamParticles.push({x:p.x,y:p.y-32,age:0,offset:(s.secured+i)%3-1});if(!s.carried){tell(s,`Essence secured. ${s.secured} stored safely.`);cancelDeposit(s);}}}
 }else{if(s.bank&&s.carried>0)tell(s,'Transfer stopped. Stored essence is safe; the rest is still carried.');cancelDeposit(s);}

 for(const e of s.enemies){e.moving=false;e.cooldown=Math.max(0,e.cooldown-dt);if(e.hp<=0){e.respawn-=dt;if(e.respawn<=0&&Math.hypot(p.x-e.homeX,p.y-e.homeY)>70&&!s.enemies.some(a=>a!==e&&a.hp>0&&Math.hypot(a.x-e.homeX,a.y-e.homeY)<25)){e.hp=e.maxHp;e.x=e.homeX;e.y=e.homeY;e.step=null;e.cooldown=1;}continue;}
 const d=Math.hypot(p.x-e.x,p.y-e.y);
 if(e.wind>0){e.wind-=dt;if(e.wind<=0){e.cooldown=2.4;if(!safe&&e.aim&&lineClear(e,e.aim)){s.fx.push({x:e.aim.x,y:e.aim.y,age:0,hit:false,owner:'enemy'});}}continue;}
 if(!safe&&d<480){if(d<170&&e.cooldown===0&&lineClear(e,p)){e.wind=.85;e.aim={x:p.x,y:p.y};e.step=null;}else if(d>115)botStep(s,e,p,dt);}
 else if(Math.hypot(e.x-e.homeX,e.y-e.homeY)>5)botStep(s,e,{x:e.homeX,y:e.homeY},dt);
 }
 if(s.autopotEnabled&&s.heldPotions.length){const primary=s.heldPotions.at(-1);if(usePotion(s,primary.kind))primary.claimed=true;}
 if(p.hp<=0){const amount=s.carried;drop(s,p.x,p.y,amount,'player');s.dropped+=amount;s.carried=0;s.bank=0;clearPotionKeys(s);p.step=null;p.hp=100;p.mana=100;s.armed=false;s.meditating=false;p.x=176;p.y=560;s.flash=1;for(const e of s.enemies){e.wind=0;e.cooldown=Math.max(e.cooldown,1);}tell(s,`You fell and dropped ${amount} essence. Recover it from the ground. ${s.secured} secured stays safe.`);}
}
const api={WIDTH,HEIGHT,RADIUS,TILE,tileCenter,scenery,obstacles,bankObstacle,gateway,banker,walkable,move,lineClear,create,nearGate,nearBank,interact,cast,update,drop,pickup,canPickup,cardinal,tell,melee,meditate,cancelDeposit,usePotion,pressPotion,releasePotion,clearPotionKeys};if(typeof module!=='undefined')module.exports=api;root.EssenceDemo=api;
})(typeof window!=='undefined'?window:globalThis);
