import type {Point} from '../shared/physics.ts';
import type {FrontierWizard} from './escort.ts';
import * as WorldFrontier from './frontier.ts';
import {H,TOWN_TILE,W,clamp,ctx,ground,motionOff,site} from './context.ts';
import {drawSpell} from './spell.ts';
import {WALK_TILE,beyondTrees,hero,homePortal,houseBounds,houses,keepers,npcs,scenery,spots,updateHouseRoofs} from './town.ts';
import type {Actor, BeyondTree, Scenery} from './town.ts';

// One painter-ordered layer; each kind carries only its own fields.
type Layer = (Scenery & {type: 'scenery'}) | BeyondTree | (Point & {type: 'portal'}) | FrontierWizard | (Actor & {type?: undefined});

function drawHomePortal(){if(!site.images.portal)return;const f=motionOff()?0:Math.floor(site.time*10)%8;ctx.drawImage(site.images.portal,f%4*240,Math.floor(f/4)*320,240,320,homePortal.x-90,homePortal.y-238,180,240);ctx.font='13px Inter';ctx.textAlign='center';ctx.fillStyle='#e7d390';ctx.fillText('ENTER THE VEIL',homePortal.x,homePortal.y+24);}
const walkCycleTiles: Record<string, number> = {'wizard-walk':2,hero:2, rogue:1, mage:2, mohawk:2};
function buildGround() {
  if(ground.width!==W)ground.width=W;if(ground.height!==H)ground.height=H;
  const c=ground.getContext('2d')!;if(c.isContextLost?.())return; c.imageSmoothingEnabled=false;
  for(let y=0;y<H;y+=TOWN_TILE)for(let x=0;x<W;x+=TOWN_TILE)c.drawImage(site.images.grass,x,y,TOWN_TILE,TOWN_TILE);
  const road=(x: number,y: number,w: number,h: number) => {
    x=Math.floor(x/TOWN_TILE)*TOWN_TILE;y=Math.floor(y/TOWN_TILE)*TOWN_TILE;w=Math.ceil(w/TOWN_TILE)*TOWN_TILE;h=Math.ceil(h/TOWN_TILE)*TOWN_TILE;
    c.save(); c.beginPath(); c.rect(x,y,w,h); c.clip();
    for(let yy=y;yy<y+h;yy+=TOWN_TILE) for(let xx=x;xx<x+w;xx+=TOWN_TILE) c.drawImage(site.images.path,xx,yy,TOWN_TILE,TOWN_TILE);
    c.restore();
  };
  road(735,455,88,340); road(785,447,473,76); road(853,475,86,290); road(855,665,400,82); road(1075,320,165,177); road(757,397,145,105);
  road(1216,448,W-1216,64);road(736,768,64,H-768);road(0,736,768,64);road(1120,0,64,224);
  for(let y=192;y<352;y+=TOWN_TILE) for(let x=1056;x<1344;x+=TOWN_TILE) c.drawImage(site.images.stone,x,y,TOWN_TILE,TOWN_TILE);
  for(const house of scenery.filter(s=>s.id.startsWith('house'))){const b=houseBounds(house);for(let y=house.y-192;y<house.y-64;y+=TOWN_TILE)for(let x=b.left+16;x<b.left+240;x+=TOWN_TILE)c.drawImage(site.images.houseFloor,x,y,TOWN_TILE,TOWN_TILE);for(let y=b.front;y<house.y;y+=TOWN_TILE)for(let x=b.doorX;x<b.doorX+64;x+=TOWN_TILE)c.drawImage(site.images.houseFloor,x,y,TOWN_TILE,TOWN_TILE);}
  for(const h of houses){c.drawImage(site.images.houseInterior,h.x-h.w/2,h.y-h.h,h.w,h.h);c.drawImage(site.images.houseSteps,h.x-h.w/2,h.y-h.h,h.w,h.h);}
  site.groundReady=true;
}
export function worldViewBounds(){return WorldFrontier.visibleTiles({width:site.width,height:site.height,scale:Math.max(.1,site.scale),ox:site.ox,oy:site.oy,tile:TOWN_TILE});}
function ensureWorldPatterns(){if(site.worldPatterns)return;const make=(id: string)=>{const tile=document.createElement('canvas');tile.width=tile.height=TOWN_TILE;const c=tile.getContext('2d')!;c.imageSmoothingEnabled=false;c.drawImage(site.images[id],0,0,TOWN_TILE,TOWN_TILE);return ctx.createPattern(tile,'repeat')!;};site.worldPatterns={grass:make('grass'),path:make('path')};}
function drawWorldContinuation(){ensureWorldPatterns();const v=worldViewBounds();ctx.fillStyle=site.worldPatterns!.grass;ctx.fillRect(v.left,v.top,v.right-v.left,v.bottom-v.top);ctx.fillStyle=site.worldPatterns!.path;
 if(v.right>W)ctx.fillRect(W,448,v.right-W,64);if(v.left<0)ctx.fillRect(v.left,736,-v.left,64);if(v.top<0)ctx.fillRect(1120,v.top,64,-v.top);if(v.bottom>H)ctx.fillRect(736,H,64,v.bottom-H);
}
function shadeWorld(){const v=worldViewBounds(),shade=ctx.createRadialGradient(1000,500,200,980,500,780);shade.addColorStop(0,'#dbc58308');shade.addColorStop(1,'#0a190dbb');ctx.fillStyle=shade;ctx.fillRect(v.left,v.top,v.right-v.left,v.bottom-v.top);}
export function visibleBeyondTrees(){const v=worldViewBounds();return beyondTrees.filter(a=>a.x+a.w/2>=v.left&&a.x-a.w/2<=v.right&&a.y>=v.top&&a.y-a.h<=v.bottom);}
function drawFrontierWizard(a: FrontierWizard){
 const s=site.frontierSequence;if(!s)return;
 const u=motionOff()?1:s.phase==='appear'?clamp(s.elapsed/.8,0,1):s.phase==='vanish'?1-clamp(s.elapsed/.22,0,1):1;
 ctx.save();ctx.globalAlpha=u;glow(a.x,a.y-34,65,.7);drawActor(a);ctx.restore();
 if(!motionOff()&&(s.phase==='appear'||s.phase==='vanish')){
  const energy=Math.sin(Math.PI*u);glow(a.x,a.y-40,80,energy);
  ellipse(a.x,a.y+2,18+28*(1-u),6+9*(1-u),'rgba(160,233,221,'+energy+')',true,2);
  for(let i=0;i<12;i++){const angle=i*Math.PI/6+u*2,x=a.x+Math.cos(angle)*(12+24*(1-u)),y=a.y-8-u*76+i%3*10;ctx.fillStyle='rgba(220,235,187,'+energy+')';ctx.fillRect(x,y,2,3);}
 }
}
function ellipse(x: number,y: number,rx: number,ry: number,color: string,stroke=false,line=1) {
  ctx.beginPath(); ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
  if(stroke){ctx.strokeStyle=color;ctx.lineWidth=line;ctx.stroke();}else{ctx.fillStyle=color;ctx.fill();}
}
function glow(x: number,y: number,r: number,alpha=1) {
  const g=ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,`rgba(241,216,147,${.46*alpha})`);g.addColorStop(.3,`rgba(223,181,94,${.16*alpha})`);g.addColorStop(1,'rgba(223,181,94,0)');
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
}
export function drawActor(a: Actor) {
  const im=site.images[a.body]; if(!im)return;
  const idle=a.body.startsWith('npc-');
  // Essential escort travel retains grounded gait under reduced motion; only
  // decorative particles/fades are suppressed. Explicit Pause freezes the walk.
  const escorted=(a.hero||a.type==='frontier')&&site.frontierSequence?.phase==='escort'||a.hero&&site.route?.joystick;
  const walking=!idle&&!site.paused&&(escorted||!motionOff()&&(a.hero?!!site.route:!site.frontierState.open&&!a.isKeeper&&a.reaction!<=0));
  // Body 156 walks through seven drawings over two tiles; body 502 over one.
  const stride=(a.gait||0)/(WALK_TILE*walkCycleTiles[a.body]);
  const frame=walking ? 1+Math.floor((stride%1)*7) : 0;
  const fw=idle?96:im.width/8, fh=im.height/4, dw=60, dh=fh/fw*dw;
  const teleport=site.frontierSequence&&['teleport-out','teleport-in'].includes(site.frontierSequence.phase)&&(a.hero||a.type==='frontier');
  const teleportProgress=teleport?clamp(site.frontierSequence!.elapsed/(site.frontierSequence!.phase==='teleport-out'?.28:.32),0,1):0;
  ctx.save();if(teleport&&!motionOff())ctx.globalAlpha*=site.frontierSequence!.phase==='teleport-out'?1-teleportProgress:teleportProgress;
  ellipse(a.x,a.y+2,18,6,'rgba(7,20,12,.62)');
  if(a.hero)ellipse(a.x,a.y+2,25,10,'#e7c885',true,1.5);
  ctx.drawImage(im,frame*fw,a.dir*fh,fw,fh,Math.round(a.x-dw/2),Math.round(a.y-dh),dw,dh);
  ctx.restore();
  if(teleport&&!motionOff()){
   const pulse=Math.sin(Math.PI*teleportProgress);glow(a.x,a.y-40,70,pulse*1.5);ellipse(a.x,a.y+2,18+22*pulse,6+7*pulse,'rgba(171,231,219,'+(1-teleportProgress)+')',true,2);
   for(let i=0;i<8;i++){const angle=i*Math.PI/4+teleportProgress*3;ctx.fillStyle='rgba(226,239,197,'+pulse+')';ctx.fillRect(a.x+Math.cos(angle)*24,a.y-teleportProgress*90+Math.sin(angle)*12,3,4);}
  }
}
function drawDestination() {
  for(const [key,p] of Object.entries(spots)) {
    const selected=key===site.current, target=key===site.hovered || site.aiming;
    if(!selected&&!target)continue;
    const breath=motionOff()?0:Math.sin(site.time*2.6)*2;
    ellipse(p.x,p.y+2,selected?37+breath:30,selected?14:11,selected?'#e4c989bb':'#d7cda17a',true,selected?2:1);
    if(selected){
      ctx.fillStyle='#edcf88';
      for(let i=0;i<4;i++){const angle=i*Math.PI/2;const x=p.x+Math.cos(angle)*44,y=p.y+2+Math.sin(angle)*18;ctx.fillRect(x-2,y-2,4,4);}
    }
  }
  if(site.route){
    ctx.save();ctx.setLineDash([2,10]);ctx.lineWidth=1.5;ctx.strokeStyle='#e7ce8877';
    ctx.beginPath();ctx.moveTo(hero.x,hero.y);for(const p of site.route.points.slice(site.route.segment))ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();
    ellipse(site.route.target.x,site.route.target.y,25,9,'#e7ce8877',true);
  }
  for(const ring of site.rings){
    const u=ring.age/ring.duration;
    ellipse(ring.x,ring.y,20+u*48,8+u*18,`rgba(235,206,135,${(1-u)*.8})`,true,2-u);
  }
}
export function draw() {
  if(!site.ready)return;
  if(motionOff())updateHouseRoofs(0);
  ctx.setTransform(site.dpr,0,0,site.dpr,0,0);ctx.fillStyle='#102017';ctx.fillRect(0,0,site.width,site.height);
  ctx.translate(site.ox,site.oy);ctx.scale(site.scale,site.scale);ctx.imageSmoothingEnabled=false;
  drawWorldContinuation();if(!site.groundReady)buildGround();ctx.drawImage(ground,0,0);shadeWorld();
  drawDestination();
  const layers=([...visibleBeyondTrees(),...scenery.map(s=>({...s,type:'scenery'})),{...homePortal,type:'portal'},...npcs,...keepers,hero,...(site.frontierWizard?[site.frontierWizard]:[])] as Layer[]).sort((a,b)=>a.y-b.y);
  for(const a of layers){
    if(a.type==='portal'){drawHomePortal();}else if(a.type==='frontier'){drawFrontierWizard(a);}else if(a.type==='scenery'||a.type==='outside'){
      ctx.save();if(a.type==='outside')ctx.globalAlpha=.72;
      if(site.frontierWizard&&!a.id.startsWith('house')&&[hero,site.frontierWizard].some(p=>a.y>p.y&&Math.abs(a.x-p.x)<a.w/2+20&&p.y>a.y-a.h&&p.y-95<a.y))ctx.globalAlpha=.28;
      ellipse(a.x+15,a.y+7,a.w*.38,a.w*.1,'#07130c40');
      ctx.drawImage(site.images[a.id.startsWith('house')?a.id+'Facade':a.id],a.x-a.w/2,a.y-a.h,a.w,a.h);ctx.restore();
    }else drawActor(a);
  }
  for(const h of houses){if(h.roofAlpha<=0)continue;ctx.globalAlpha=h.roofAlpha;ctx.drawImage(site.images[h.id+'Roof'],h.x-h.w/2,h.y-h.h,h.w,h.h);ctx.globalAlpha=1;}
  drawSpell();
  if(!motionOff())for(let i=0;i<12;i++){
    const x=690+(i*83)%650+Math.sin(site.time*.2+i)*12,y=255+(i*61)%480+Math.cos(site.time*.3+i)*8;
    ctx.fillStyle=`rgba(225,219,154,${.1+.12*(Math.sin(site.time+i)+1)})`;ctx.fillRect(x,y,2,2);
  }
}
