/* Single-player teaching rules, intentionally independent from RAO's live economy. */
(function(root){
'use strict';
const Physics=typeof module!=='undefined'?require('../world-physics.js'):root.WorldPhysics;
const WIDTH=1200,HEIGHT=880,RADIUS=10;
const scenery=[{id:'tree',x:90,y:240,w:190,h:238},{id:'pine',x:315,y:260,w:165,h:165},{id:'tree2',x:980,y:235,w:210,h:262},{id:'tree',x:1100,y:480,w:200,h:250},{id:'pine',x:415,y:510,w:190,h:190},{id:'tree2',x:755,y:455,w:195,h:245},{id:'tree',x:850,y:765,w:220,h:275},{id:'pine',x:270,y:765,w:200,h:200},{id:'tree2',x:90,y:835,w:205,h:256},{id:'pine',x:1150,y:850,w:210,h:210}];
const gateway={x:165,y:470},banker={x:160,y:690};
const obstacles=scenery.map(s=>({x:s.x-22,y:s.y-27,w:44,h:37}));
obstacles.push({x:80,y:395,w:38,h:92},{x:212,y:395,w:38,h:92});
const bankObstacle={x:banker.x-37,y:banker.y-27,w:74,h:35};
const physics=Physics.create({width:WIDTH,height:HEIGHT,minY:160,radius:RADIUS,obstacles});
function create(){return {phase:'arena',player:{x:300,y:445,dir:1,gait:0,hp:100},carried:0,secured:0,dropped:0,kills:0,bank:0,bankUnlocked:false,cooldown:0,time:0,fx:[],drops:[],nextDrop:1,notice:'Aim with the pointer. Defeat a rival, then walk over the essence it drops.',noticeId:1,flash:1,won:false,enemies:[
 {name:'Wanderer',body:'rogue',x:495,y:360,homeX:495,homeY:360,hp:2,maxHp:2,reward:15,dir:2,gait:0,wind:0,cooldown:1,respawn:0,kind:'melee',speed:105},
 {name:'Keeper',body:'mage',x:920,y:570,homeX:920,homeY:570,hp:2,maxHp:2,reward:25,dir:3,gait:0,wind:0,cooldown:1,respawn:0,kind:'melee',speed:110},
 {name:'Sentinel',body:'hero',x:655,y:760,homeX:655,homeY:760,hp:3,maxHp:3,reward:30,dir:0,gait:0,wind:0,cooldown:1,respawn:0,kind:'melee',speed:115}
]};}
function tell(s,message){s.notice=message;s.noticeId++;}
function nearGate(s){return Math.hypot(s.player.x-gateway.x,s.player.y-gateway.y)<65;}
function nearBank(s){return s.bankUnlocked&&Math.hypot(s.player.x-banker.x,s.player.y-banker.y)<87;}
function drop(s,x,y,amount,owner){if(amount<=0)return;const existing=s.drops.find(d=>Math.hypot(d.x-x,d.y-y)<12&&d.owner===owner);if(existing){existing.amount+=amount;existing.readyAt=s.time+.5;return;}s.drops.push({id:s.nextDrop++,x,y,amount,owner,readyAt:s.time+.5});}
function pickup(s,radius=20){const found=s.drops.filter(d=>s.time>=d.readyAt&&Math.hypot(d.x-s.player.x,d.y-s.player.y)<=radius);if(!found.length)return 0;const amount=found.reduce((n,d)=>n+d.amount,0),ids=new Set(found.map(d=>d.id));s.drops=s.drops.filter(d=>!ids.has(d.id));s.carried+=amount;const first=!s.bankUnlocked;s.bankUnlocked=true;tell(s,first?`+${amount} essence picked up. The reliquary has appeared south of the return portal.`:`+${amount} essence picked up. Carry it to the reliquary or keep fighting.`);return amount;}
function interact(s){if(pickup(s,40))return 'pickup';if(nearBank(s)&&s.carried&&s.bank===0){s.bank=.001;tell(s,'Depositing… hold your ground.');return 'bank';}if(nearGate(s))return 'exit';return false;}
function cardinal(x,y){return Math.abs(x)>=Math.abs(y)?{x:Math.sign(x),y:0}:{x:0,y:Math.sign(y)};}
function heading(x,y){return Math.abs(x)>Math.abs(y)?(x>0?1:3):(y>0?2:0);}
function walkable(x,y,r=RADIUS){return physics.free(x,y);}
function lineClear(a,b){return physics.clear(a,b);}
function move(actor,dx,dy,others=[]){return physics.move(actor,dx,dy,others);}
function cast(s,target){
 if(s.cooldown>0||!target||!Number.isFinite(target.x)||!Number.isFinite(target.y))return false;
 const p=s.player,d=Math.hypot(target.x-p.x,target.y-p.y);
 if(d>270){tell(s,'Out of range. Move closer to your target.');return false;}
 if(!lineClear(p,target)){tell(s,'The spell is blocked. Find a clear line of sight.');return false;}
 p.dir=heading(target.x-p.x,target.y-p.y);s.cooldown=.65;s.bank=0;
 // Only the actor explicitly under the pointer receives a targeted cast.
 // Damage is committed on the click, so walking does not dodge a confirmed target.
 const enemy=s.enemies.find(e=>e.name===target.enemyId&&e.hp>0&&Math.hypot(e.x-target.x,e.y-target.y)<1);
 s.fx.push({x:target.x,y:target.y,age:0,hit:true,owner:'player'});
 if(enemy){enemy.hp--;if(enemy.hp===0){s.kills++;enemy.respawn=14;enemy.wind=0;drop(s,enemy.x,enemy.y,enemy.reward,'rival');tell(s,`${enemy.name} dropped ${enemy.reward} essence. Walk over it to pick it up.`);}}
 else tell(s,'No rival under the pointer. Aim at a character and click.');
 return true;
}
function botStep(s,e,target,dt){const d=Math.hypot(target.x-e.x,target.y-e.y);if(d<4)return;const vector=cardinal(target.x-e.x,target.y-e.y),others=[s.player,...s.enemies.filter(a=>a.hp>0)];e.dir=heading(vector.x,vector.y);let moved=move(e,vector.x*e.speed*dt,vector.y*e.speed*dt,others);if(moved<.01){const alt={x:vector.x?0:Math.sign(target.x-e.x),y:vector.y?0:Math.sign(target.y-e.y)};moved=move(e,alt.x*e.speed*dt,alt.y*e.speed*dt,others);if(moved)e.dir=heading(alt.x,alt.y);}e.moving=moved>.01;}
function update(s,dt,input={x:0,y:0}){dt=Math.max(0,Math.min(dt,.05));s.time+=dt;s.flash=Math.max(0,s.flash-dt*1.5);s.cooldown=Math.max(0,s.cooldown-dt);const p=s.player;const vector=cardinal(input.x||0,input.y||0);p.moving=false;
 // Banking uses the same solid footprint as other props once it appears.
 const activeObstacles=s.bankUnlocked?[bankObstacle]:[];
 const insideBank=(x,y)=>activeObstacles.some(o=>x+RADIUS>o.x&&x-RADIUS<o.x+o.w&&y+RADIUS>o.y&&y-RADIUS<o.y+o.h);
 if(vector.x||vector.y){p.dir=heading(vector.x,vector.y);const dx=vector.x*165*dt,dy=vector.y*165*dt;if(!insideBank(p.x+dx,p.y+dy))p.moving=move(p,dx,dy,s.enemies.filter(e=>e.hp>0))>.01;if(s.bank){s.bank=0;tell(s,'Deposit cancelled by movement.');}}
 pickup(s);
 const safe=p.x<270;
 if(safe)p.hp=Math.min(100,p.hp+12*dt);
 for(const f of s.fx){f.age+=dt;}s.fx=s.fx.filter(f=>f.age<2);
 if(s.bank){if(!nearBank(s))s.bank=0;else{s.bank+=dt;if(s.bank>=1.5){const amount=s.carried;s.secured+=amount;s.carried=0;s.bank=0;s.won=s.secured>=60;tell(s,s.won?`${amount} secured. Goal complete! Your banked essence survives defeat.`:`${amount} secured. Keep fighting or return to Nix.`);}}}
 for(const e of s.enemies){e.moving=false;e.cooldown=Math.max(0,e.cooldown-dt);if(e.hp<=0){e.respawn-=dt;if(e.respawn<=0&&Math.hypot(p.x-e.homeX,p.y-e.homeY)>70&&!s.enemies.some(a=>a!==e&&a.hp>0&&Math.hypot(a.x-e.homeX,a.y-e.homeY)<25)){e.hp=e.maxHp;e.x=e.homeX;e.y=e.homeY;e.cooldown=1;}continue;}
 const d=Math.hypot(p.x-e.x,p.y-e.y);
 if(e.wind>0){e.wind-=dt;if(e.wind<=0){e.cooldown=1.5;if(!safe&&d<62&&lineClear(e,p)){p.hp-=12;s.flash=.2;s.bank=0;}}continue;}
 if(!safe&&d<480){if(d<52&&e.cooldown===0){e.wind=.65;e.aim={x:p.x,y:p.y};}else if(d>36)botStep(s,e,p,dt);}
 else if(Math.hypot(e.x-e.homeX,e.y-e.homeY)>5)botStep(s,e,{x:e.homeX,y:e.homeY},dt);
 }
 if(p.hp<=0){const amount=s.carried;drop(s,p.x,p.y,amount,'player');s.dropped+=amount;s.carried=0;s.bank=0;p.hp=100;p.x=165;p.y=550;s.flash=1;for(const e of s.enemies){e.wind=0;e.cooldown=Math.max(e.cooldown,1);}tell(s,`You fell and dropped ${amount} essence. Recover it from the ground. ${s.secured} secured stays safe.`);}
}
const api={WIDTH,HEIGHT,RADIUS,scenery,obstacles,bankObstacle,gateway,banker,walkable,move,lineClear,create,nearGate,nearBank,interact,cast,update,drop,pickup,cardinal,tell};if(typeof module!=='undefined')module.exports=api;root.EssenceDemo=api;
})(typeof window!=='undefined'?window:globalThis);
