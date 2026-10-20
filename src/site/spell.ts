import {ctx,heading,site} from './context.ts';
import {hero,keepers} from './town.ts';

// The actual 60-PPT Apocalipsis sheet and canonical playback from RAO d92bcdee.
// Four columns, 32 frames at 16 fps; source-over, unrotated, 32/60 world scale.
export const apocalipsis = {columns:4, frames:32, frameWidth:273, frameHeight:243, duration:2, worldScale:32/60};
export function drawSpell() {
  if(!site.spell || site.spell.age<site.spell.delay || !site.images.apocalipsis)return;
  const elapsed=site.spell.age-site.spell.delay;
  if(elapsed>=apocalipsis.duration)return;
  const frame=Math.min(apocalipsis.frames-1,Math.floor(elapsed/apocalipsis.duration*apocalipsis.frames));
  const {frameWidth:fw,frameHeight:fh,columns,worldScale}=apocalipsis;
  const dw=fw*worldScale,dh=fh*worldScale;
  ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  ctx.drawImage(site.images.apocalipsis,(frame%columns)*fw,Math.floor(frame/columns)*fh,fw,fh,site.spell.x-dw/2,site.spell.y-dh/2,dw,dh);
  ctx.restore();
}
export function advanceSpell(dt: number) {
  if(!site.spell)return;
  site.spell.age+=dt;
  if(!site.spell.hit&&site.spell.age>=site.spell.delay){
    site.spell.hit=true;
    const receiver=keepers.find(k=>k.place===site.spell!.place);
    if(receiver){receiver.reaction=1.1;receiver.dir=heading(hero.x-receiver.x,hero.y-receiver.y);}
  }
  if(site.spell.age>=site.spell.duration)site.spell=null;
}
