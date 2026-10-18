/* Click orders share keyboard movement and collision rules; no second game loop. */
(function(root){
'use strict';
const M=typeof module!=='undefined'?require('./tutorial.js'):root.EssenceDemo;
const Physics=typeof module!=='undefined'?require('../world-physics.js'):root.WorldPhysics;
const originalUpdate=M.update;
function cancelWalk(s){s.navigation=null;}
function walkTo(s,target,guide=null){
 cancelWalk(s);
 if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.y)||s.armed||s.tutorial?.dialog||s.tutorial?.stage==='complete')return false;
 const p=s.player,start=p.step?.end||p;let points=[];
 if(s.phase==='hallway'){
  const end={x:Math.max(M.hallway.walk.minX,Math.min(s.tutorial.seen.length===3?M.hallway.walk.maxX:432,target.x)),y:Math.max(M.hallway.walk.minY,Math.min(M.hallway.walk.maxY,target.y))};
  points=[{x:end.x,y:start.y},end].filter(q=>Math.hypot(q.x-start.x,q.y-start.y)>.1);
 }else{
  const physics=Physics.create({width:M.WIDTH,height:M.HEIGHT,minY:160,radius:M.RADIUS,obstacles:[...M.obstacles,...(s.bankUnlocked?[M.bankBounds(s)]:[])]});
  const others=s.enemies.filter(e=>e.hp>0),tx=Math.round((target.x-start.x)/32),ty=Math.round((target.y-start.y)/32);
  const end={x:start.x+tx*32,y:start.y+ty*32};
  if(!physics.free(end.x,end.y,others,p)){M.tell(s,'That spot is blocked. Click open ground.');return false;}
  const queue=[{x:0,y:0,prev:-1}],seen=new Set(['0,0']);let found=-1;
  // At most the arena's tile count; allocations live only for this click.
  for(let i=0;i<queue.length&&i<1400;i++){
   const q=queue[i],a={x:start.x+q.x*32,y:start.y+q.y*32};
   if(q.x===tx&&q.y===ty){found=i;break;}
   const directions=Math.abs(tx-q.x)>Math.abs(ty-q.y)?[[Math.sign(tx-q.x)||1,0],[0,Math.sign(ty-q.y)||1],[-(Math.sign(tx-q.x)||1),0],[0,-(Math.sign(ty-q.y)||1)]]:[[0,Math.sign(ty-q.y)||1],[Math.sign(tx-q.x)||1,0],[0,-(Math.sign(ty-q.y)||1)],[-(Math.sign(tx-q.x)||1),0]];
   for(const [dx,dy] of directions){const x=q.x+dx,y=q.y+dy,key=x+','+y;if(seen.has(key))continue;const b={x:start.x+x*32,y:start.y+y*32};if(physics.clear(a,b,others,p)){seen.add(key);queue.push({x,y,prev:i});}}
  }
  if(found<0){M.tell(s,'No clear route. Try a closer spot.');return false;}
  for(let i=found;i>0;i=queue[i].prev)points.push({x:start.x+queue[i].x*32,y:start.y+queue[i].y*32});points.reverse();
 }
 s.navigation={points,guide,phase:s.phase,stalled:0};s.meditating=false;return true;
}
function finish(s){const guide=s.navigation?.guide;cancelWalk(s);if(guide&&s.phase==='hallway'){const g=M.guides.find(g=>g.id===guide);if(g&&Math.hypot(g.x-s.player.x,g.y-s.player.y)<100)M.talk(s,guide);}}
M.update=function(s,dt,input={x:0,y:0}){
 if(input.x||input.y)cancelWalk(s);
 if(s.armed||s.player.hp<=0||s.tutorial?.dialog||s.navigation?.phase!==s.phase)cancelWalk(s);
 let nav=s.navigation;const p=s.player,x=p.x,y=p.y;
 if(nav&&!p.step){while(nav.points.length&&Math.hypot(nav.points[0].x-p.x,nav.points[0].y-p.y)<.1)nav.points.shift();if(!nav.points.length){finish(s);nav=null;}else{const q=nav.points[0];input=M.cardinal(q.x-p.x,q.y-p.y);if(s.phase==='hallway'){const distance=Math.abs(input.x?q.x-p.x:q.y-p.y);dt=Math.min(dt,distance/160);}}}
 const stepEnd=p.step?.end,noticeBefore=s.noticeId;
 originalUpdate(s,dt,input);
 if(nav&&s.navigation===nav){if(s.phase!==nav.phase||Math.hypot(p.x-x,p.y-y)>160*Math.max(0,Math.min(dt,.05))+.1){cancelWalk(s);return;}if(s.phase==='arena'&&!p.step&&nav.points.length&&Math.hypot(p.x-x,p.y-y)>.001&&Math.hypot((stepEnd||nav.points[0]).x-p.x,(stepEnd||nav.points[0]).y-p.y)>.1){cancelWalk(s);if(s.noticeId===noticeBefore)M.tell(s,'Route blocked. Click again to choose a new path.');return;}if(!p.immobilized){nav.stalled=Math.hypot(p.x-x,p.y-y)<.001?nav.stalled+Math.max(0,Math.min(dt,.05)):0;if(nav.stalled>.5){cancelWalk(s);if(s.noticeId===noticeBefore)M.tell(s,'Route blocked. Click again to choose a new path.');}}}
};
Object.assign(M,{walkTo,cancelWalk});
if(typeof module!=='undefined')module.exports=M;
})(typeof window!=='undefined'?window:globalThis);
