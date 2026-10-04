/* Tutorial simulation. Counts and combat values are deliberately separate from RAO rules. */
(function(root){
'use strict';
const WIDTH=1200,HEIGHT=880,RADIUS=10;
const scenery=[
 {id:'tree',x:90,y:240,w:190,h:238},{id:'pine',x:315,y:260,w:165,h:165},
 {id:'tree2',x:980,y:235,w:210,h:262},{id:'tree',x:1100,y:480,w:200,h:250},
 {id:'pine',x:415,y:510,w:190,h:190},{id:'tree2',x:755,y:455,w:195,h:245},
 {id:'tree',x:850,y:765,w:220,h:275},{id:'pine',x:270,y:765,w:200,h:200},
 {id:'tree2',x:90,y:835,w:205,h:256},{id:'pine',x:1150,y:850,w:210,h:210}
];
// Foot-level trunks are solid; crowns can correctly overlap actors behind them.
const obstacles=scenery.map(s=>({x:s.x-22,y:s.y-27,w:44,h:37}));
const gateway={x:165,y:470};
// The arch pillars are solid; the central opening remains passable.
obstacles.push({x:80,y:395,w:38,h:92},{x:212,y:395,w:38,h:92});
function walkable(x,y,r=RADIUS){return x>=30+r&&x<=WIDTH-30-r&&y>=180+r&&y<=HEIGHT-25-r&&!obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);}
function move(actor,dx,dy,others=[]){const free=(x,y)=>walkable(x,y)&&!others.some(o=>o!==actor&&Math.hypot(x-o.x,y-o.y)<RADIUS*2);const count=Math.max(1,Math.ceil(Math.hypot(dx,dy)/5));let distance=0;for(let i=0;i<count;i++){const x=actor.x,y=actor.y;if(free(actor.x+dx/count,actor.y))actor.x+=dx/count;if(free(actor.x,actor.y+dy/count))actor.y+=dy/count;distance+=Math.hypot(actor.x-x,actor.y-y);}actor.gait=(actor.gait||0)+distance;return distance;}
function lineClear(a,b){const d=Math.hypot(a.x-b.x,a.y-b.y);for(let i=1;i<Math.ceil(d/6);i++){const t=i/Math.ceil(d/6);if(!walkable(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,2))return false;}return true;}
function create(){return {phase:'threshold',player:{x:165,y:630,dir:0,gait:0,hp:100},carried:0,secured:0,lost:0,kills:0,bank:0,cooldown:0,time:0,fx:[],notice:'',noticeId:0,flash:0,won:false,enemies:[
 {name:'Wanderer',body:'rogue',x:495,y:360,homeX:495,homeY:360,hp:2,reward:15,dir:2,gait:0,wind:0,cooldown:0,respawn:0},
 {name:'Keeper',body:'mage',x:920,y:570,homeX:920,homeY:570,hp:3,reward:25,dir:3,gait:0,wind:0,cooldown:0,respawn:0},
 {name:'Sentinel',body:'hero',x:655,y:760,homeX:655,homeY:760,hp:3,reward:25,dir:0,gait:0,wind:0,cooldown:0,respawn:0}
]};}
function tell(s,message){s.notice=message;s.noticeId++;}
function nearGate(s){return Math.hypot(s.player.x-gateway.x,s.player.y-gateway.y)<78;}
function interact(s){if(!nearGate(s))return false;if(s.phase==='threshold'){s.phase='arena';s.flash=1;s.player.x=290;s.player.y=445;tell(s,'The crossing is complete. Defeat a rival, then bring the essence back.');return true;}if(s.carried&&s.bank===0){s.bank=.001;tell(s,'Securing essence… stay still.');return true;}tell(s,s.secured?'Your secured essence is safe. Head out for another run.':'Win essence from a training rival first.');return false;}
function cast(s){if(s.phase!=='arena'||s.cooldown>0)return false;const candidates=s.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-s.player.x,e.y-s.player.y)<=190&&lineClear(s.player,e)).sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y));const e=candidates[0];if(!e){tell(s,'Move closer to a rival with a clear line of sight.');return false;}s.cooldown=.7;s.bank=0;const dx=e.x-s.player.x,dy=e.y-s.player.y;s.player.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0);s.fx.push({x:e.x,y:e.y-25,age:0});e.hp--;if(e.hp===0){s.carried+=e.reward;s.kills++;e.respawn=12;e.wind=0;tell(s,`+${e.reward} carried essence. Return to the portal or risk another fight.`);}return true;}
function update(s,dt,input={x:0,y:0}){dt=Math.max(0,Math.min(dt,.05));s.time+=dt;s.flash=Math.max(0,s.flash-dt*1.5);s.cooldown=Math.max(0,s.cooldown-dt);s.fx=s.fx.filter(f=>(f.age+=dt)<2);const p=s.player;let dx=input.x||0,dy=input.y||0;const mag=Math.hypot(dx,dy);p.moving=false;if(mag){dx/=mag;dy/=mag;p.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0);p.moving=move(p,dx*165*dt,dy*165*dt,s.phase==='arena'?s.enemies.filter(e=>e.hp>0):[])>.01;if(s.bank){s.bank=0;tell(s,'Deposit cancelled. Stay still at the portal to secure essence.');}}
 if(s.phase!=='arena')return;
 const safe=p.x<270;
 if(safe)p.hp=Math.min(100,p.hp+20*dt);
 if(s.bank){if(!nearGate(s)){s.bank=0;}else{s.bank+=dt;if(s.bank>=1.5){const deposited=s.carried;s.secured+=deposited;s.carried=0;s.bank=0;const firstWin=!s.won&&s.secured>=60;s.won=s.won||firstWin;tell(s,firstWin?'60 secured. You completed the loop. Keep exploring or start again.':`${deposited} secured. This essence survives your next defeat.`);}}}
 for(const e of s.enemies){e.moving=false;e.cooldown=Math.max(0,e.cooldown-dt);if(e.hp<=0){e.respawn-=dt;if(e.respawn<=0){e.hp=e.reward===15?2:3;e.x=e.homeX;e.y=e.homeY;e.cooldown=1;}continue;}
 const distance=Math.hypot(p.x-e.x,p.y-e.y);if(e.wind>0){e.wind-=dt;if(e.wind<=0){e.cooldown=1.7;if(!safe&&distance<70&&lineClear(e,p)){p.hp-=24;s.flash=.25;s.bank=0;}}continue;}
 if(!safe&&distance<240&&lineClear(e,p)){if(distance<58&&e.cooldown===0){e.wind=.85;continue;}if(distance>45){const x=p.x-e.x,y=p.y-e.y;e.dir=Math.abs(x)>Math.abs(y)?(x>0?1:3):(y>0?2:0);e.moving=move(e,x/distance*65*dt,y/distance*65*dt,[p,...s.enemies.filter(a=>a.hp>0)])>.01;}}
 else if(Math.hypot(e.x-e.homeX,e.y-e.homeY)>5){const x=e.homeX-e.x,y=e.homeY-e.y,d=Math.hypot(x,y);e.moving=move(e,x/d*45*dt,y/d*45*dt,[p,...s.enemies.filter(a=>a.hp>0)])>.01;}
 }
 if(p.hp<=0){const lost=s.carried;s.lost+=lost;s.carried=0;s.bank=0;p.hp=100;p.x=165;p.y=540;s.flash=1;for(const e of s.enemies){e.wind=0;e.cooldown=1;}tell(s,`Defeated. ${lost} carried essence lost; ${s.secured} secured essence kept. Try again.`);}
}
const api={WIDTH,HEIGHT,RADIUS,scenery,obstacles,gateway,walkable,move,lineClear,create,nearGate,interact,cast,update};if(typeof module!=='undefined')module.exports=api;root.EssenceDemo=api;
})(typeof window!=='undefined'?window:globalThis);
