/* Single-player teaching rules, intentionally independent from RAO's live economy. */
(function(root){
'use strict';
const Physics=typeof module!=='undefined'?require('../world-physics.js'):root.WorldPhysics;
const WIDTH=1200,HEIGHT=880,RADIUS=10;
const scenery=[{id:'tree',x:90,y:240,w:190,h:238},{id:'pine',x:315,y:260,w:165,h:165},{id:'tree2',x:980,y:235,w:210,h:262},{id:'tree',x:1100,y:480,w:200,h:250},{id:'pine',x:415,y:510,w:190,h:190},{id:'tree2',x:755,y:455,w:195,h:245},{id:'tree',x:850,y:765,w:220,h:275},{id:'pine',x:270,y:765,w:200,h:200},{id:'tree2',x:90,y:835,w:205,h:256},{id:'pine',x:1150,y:850,w:210,h:210}];
const gateway={x:165,y:470},banker={x:160,y:690};
const obstacles=scenery.map(s=>({x:s.x-22,y:s.y-27,w:44,h:37}));
obstacles.push({x:80,y:395,w:38,h:92},{x:212,y:395,w:38,h:92});
const bankObstacle={x:banker.x-47,y:banker.y-10,w:94,h:24};
const physics=Physics.create({width:WIDTH,height:HEIGHT,minY:160,radius:RADIUS,obstacles});
function create(){return {phase:'arena',player:{x:300,y:445,dir:1,gait:0,hp:100,mana:100},carried:0,secured:0,dropped:0,kills:0,bank:0,bankAmount:0,bankUnlocked:false,armed:false,meditating:false,meleeCooldown:0,cooldown:0,time:0,fx:[],drops:[],nextDrop:1,notice:'Prepare Apocalipsis with C, then click a rival. Stand on its dropped essence and press Q.',noticeId:1,flash:1,won:false,enemies:[
 {name:'Wanderer',body:'rogue',x:495,y:360,homeX:495,homeY:360,hp:2,maxHp:2,reward:15,dir:2,gait:0,wind:0,cooldown:1,respawn:0,kind:'ranged',speed:105},
 {name:'Keeper',body:'mage',x:920,y:570,homeX:920,homeY:570,hp:2,maxHp:2,reward:25,dir:3,gait:0,wind:0,cooldown:1,respawn:0,kind:'ranged',speed:110},
 {name:'Sentinel',body:'hero',x:655,y:760,homeX:655,homeY:760,hp:3,maxHp:3,reward:30,dir:0,gait:0,wind:0,cooldown:1,respawn:0,kind:'ranged',speed:110}
]};}
function tell(s,message){s.notice=message;s.noticeId++;}
function nearGate(s){return Math.hypot(s.player.x-gateway.x,s.player.y-gateway.y)<65;}
function nearBank(s){return s.bankUnlocked&&Math.hypot(s.player.x-banker.x,s.player.y-banker.y)<87;}
function drop(s,x,y,amount,owner){if(amount<=0)return;const existing=s.drops.find(d=>Math.hypot(d.x-x,d.y-y)<12&&d.owner===owner);if(existing){existing.amount+=amount;existing.readyAt=s.time+.5;return;}s.drops.push({id:s.nextDrop++,x,y,amount,owner,readyAt:s.time+.5});}
function pickup(s,radius=20){const found=s.drops.filter(d=>s.time>=d.readyAt&&Math.hypot(d.x-s.player.x,d.y-s.player.y)<=radius);if(!found.length)return 0;const amount=found.reduce((n,d)=>n+d.amount,0),ids=new Set(found.map(d=>d.id));s.drops=s.drops.filter(d=>!ids.has(d.id));s.carried+=amount;const first=!s.bankUnlocked;s.bankUnlocked=true;tell(s,first?`+${amount} essence picked up. The reliquary has appeared south of the return portal.`:`+${amount} essence picked up. Carry it to the reliquary or keep fighting.`);return amount;}
function interact(s){if(pickup(s,22))return 'pickup';if(nearBank(s))return 'bank';if(nearGate(s))return 'exit';return false;}
function beginDeposit(s,amount){if(s.bank>0||!nearBank(s)||!Number.isInteger(amount)||amount<1||amount>s.carried)return false;s.bankAmount=amount;s.bank=.001;s.player.step=null;tell(s,`Depositing ${amount} essence…`);return true;}
function cancelDeposit(s){if(s.bank){s.bank=0;s.bankAmount=0;tell(s,'Deposit cancelled. Your essence is still carried.');}}

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
 p.dir=heading(target.x-p.x,target.y-p.y);s.cooldown=.75;s.bank=0;s.meditating=false;p.mana-=15;
 // Only the actor explicitly under the pointer receives a targeted cast.
 // Damage is committed on the click, so walking does not dodge a confirmed target.
 const enemy=s.enemies.find(e=>e.name===target.enemyId&&e.hp>0&&Math.hypot(e.x-target.x,e.y-target.y)<1);
 s.fx.push({x:target.x,y:target.y,age:0,hit:true,owner:'player'});
 if(enemy){enemy.hp--;if(enemy.hp===0){s.kills++;enemy.respawn=14;enemy.wind=0;drop(s,enemy.x,enemy.y,enemy.reward,'rival');tell(s,`${enemy.name} dropped ${enemy.reward} essence. Stand over it and press Q to pick it up.`);}}
 else tell(s,'No rival under the pointer. Aim at a character and click.');
 return true;
}
function melee(s){
 if(s.meleeCooldown>0)return false;s.meleeCooldown=1;s.bank=0;s.meditating=false;
 const p=s.player,v=[{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}][p.dir];
 const target=s.enemies.filter(e=>e.hp>0).find(e=>{const dx=e.x-p.x,dy=e.y-p.y,forward=dx*v.x+dy*v.y,side=Math.abs(dx*v.y-dy*v.x);return forward>0&&forward<=58&&side<=20&&lineClear(p,e);});
 s.fx.push({x:p.x+v.x*32,y:p.y+v.y*32,age:0,hit:true,owner:'melee'});
 if(target){target.hp--;if(!target.hp){target.respawn=14;target.wind=0;s.kills++;drop(s,target.x,target.y,target.reward,'rival');tell(s,`${target.name} dropped ${target.reward} essence. Stand over it and press Q.`);}}
 else tell(s,'Strike the rival directly in front of you.');return true;
}
function meditate(s){s.meditating=!s.meditating;s.armed=false;s.player.step=null;tell(s,s.meditating?'Meditating. Stay still to recover mana.':'Meditation stopped.');}
function botStep(s,e,target,dt){
 const others=[s.player,...s.enemies.filter(a=>a.hp>0)];
 if(!e.step){if(Math.hypot(target.x-e.x,target.y-e.y)<4)return;let v=cardinal(target.x-e.x,target.y-e.y),end={x:e.x+v.x*32,y:e.y+v.y*32};if(!physics.clear(e,end,others,e)){v={x:v.x?0:Math.sign(target.x-e.x),y:v.y?0:Math.sign(target.y-e.y)};end={x:e.x+v.x*32,y:e.y+v.y*32};if(!physics.clear(e,end,others,e))return;}e.step={...v,end,remaining:32};e.dir=heading(v.x,v.y);}
 const step=e.step,distance=Math.min(step.remaining,e.speed*dt),moved=move(e,step.x*distance,step.y*distance,others);e.moving=moved>.01;step.remaining-=moved;if(moved<distance-.001)e.step=null;else if(step.remaining<.001){e.x=step.end.x;e.y=step.end.y;e.step=null;}
}
function update(s,dt,input={x:0,y:0}){dt=Math.max(0,Math.min(dt,.05));s.time+=dt;s.flash=Math.max(0,s.flash-dt*1.5);s.cooldown=Math.max(0,s.cooldown-dt);s.meleeCooldown=Math.max(0,s.meleeCooldown-dt);const p=s.player;const vector=cardinal(input.x||0,input.y||0);p.moving=false;
 // Banking uses the same solid footprint as other props once it appears.
 const activeObstacles=s.bankUnlocked?[bankObstacle]:[];
 const insideBank=(x,y)=>activeObstacles.some(o=>x+RADIUS>o.x&&x-RADIUS<o.x+o.w&&y+RADIUS>o.y&&y-RADIUS<o.y+o.h);
 if(!p.step&&(vector.x||vector.y)){const end={x:p.x+vector.x*32,y:p.y+vector.y*32};p.dir=heading(vector.x,vector.y);if(!insideBank(end.x,end.y)&&physics.clear(p,end,s.enemies.filter(e=>e.hp>0),p))p.step={...vector,end,remaining:32};}
 if(p.step){const step=p.step,distance=Math.min(step.remaining,160*dt),dx=step.x*distance,dy=step.y*distance;const moved=insideBank(p.x+dx,p.y+dy)?0:move(p,dx,dy,s.enemies.filter(e=>e.hp>0));p.moving=moved>.01;step.remaining-=moved;if(moved<distance-.001)p.step=null;else if(step.remaining<.001){p.x=step.end.x;p.y=step.end.y;p.step=null;}}
 if((p.moving||vector.x||vector.y)&&s.bank){s.bank=0;tell(s,'Deposit cancelled by movement.');}
 if(p.moving)s.meditating=false;
 if(s.meditating)p.mana=Math.min(100,p.mana+18*dt);
 const safe=p.x<270;
 if(safe){p.hp=Math.min(100,p.hp+12*dt);p.mana=Math.min(100,p.mana+24*dt);}
 for(const f of s.fx){f.age+=dt;if(f.owner==='enemy'&&!f.hit&&f.age>=.3){f.hit=true;if(!safe&&Math.hypot(p.x-f.x,p.y-f.y)<35){p.hp-=12;s.flash=.2;cancelDeposit(s);}}}s.fx=s.fx.filter(f=>f.age<2);
 if(s.bank){if(!nearBank(s))s.bank=0;else{s.bank+=dt;if(s.bank>=1.5){const amount=s.bankAmount;if(amount>s.carried){cancelDeposit(s);return;}s.secured+=amount;s.carried-=amount;s.bank=0;s.bankAmount=0;s.won=s.secured>=60;tell(s,s.won?`${amount} secured. Goal complete! Your banked essence survives defeat.`:`${amount} secured. Keep fighting or return to Nix.`);}}}
 for(const e of s.enemies){e.moving=false;e.cooldown=Math.max(0,e.cooldown-dt);if(e.hp<=0){e.respawn-=dt;if(e.respawn<=0&&Math.hypot(p.x-e.homeX,p.y-e.homeY)>70&&!s.enemies.some(a=>a!==e&&a.hp>0&&Math.hypot(a.x-e.homeX,a.y-e.homeY)<25)){e.hp=e.maxHp;e.x=e.homeX;e.y=e.homeY;e.step=null;e.cooldown=1;}continue;}
 const d=Math.hypot(p.x-e.x,p.y-e.y);
 if(e.wind>0){e.wind-=dt;if(e.wind<=0){e.cooldown=2.4;if(!safe&&e.aim&&lineClear(e,e.aim)){s.fx.push({x:e.aim.x,y:e.aim.y,age:0,hit:false,owner:'enemy'});}}continue;}
 if(!safe&&d<480){if(d<170&&e.cooldown===0&&lineClear(e,p)){e.wind=.85;e.aim={x:p.x,y:p.y};e.step=null;}else if(d>115)botStep(s,e,p,dt);}
 else if(Math.hypot(e.x-e.homeX,e.y-e.homeY)>5)botStep(s,e,{x:e.homeX,y:e.homeY},dt);
 }
 if(p.hp<=0){const amount=s.carried;drop(s,p.x,p.y,amount,'player');s.dropped+=amount;s.carried=0;s.bank=0;p.step=null;p.hp=100;p.mana=100;s.armed=false;s.meditating=false;p.x=165;p.y=550;s.flash=1;for(const e of s.enemies){e.wind=0;e.cooldown=Math.max(e.cooldown,1);}tell(s,`You fell and dropped ${amount} essence. Recover it from the ground. ${s.secured} secured stays safe.`);}
}
const api={WIDTH,HEIGHT,RADIUS,scenery,obstacles,bankObstacle,gateway,banker,walkable,move,lineClear,create,nearGate,nearBank,interact,cast,update,drop,pickup,cardinal,tell,melee,meditate,beginDeposit,cancelDeposit};if(typeof module!=='undefined')module.exports=api;root.EssenceDemo=api;
})(typeof window!=='undefined'?window:globalThis);
