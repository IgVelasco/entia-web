// The town of Nix: section spots, keepers, roaming NPCs, scenery and houses, and the collision world they share.
import * as WorldPhysics from '../shared/physics.ts';
import type {Body, Point, Rect} from '../shared/physics.ts';
import {H,TOWN_TILE,W,motionOff} from './context.ts';

// A section's keeper position, label and greeting, and the tile a walk to it lands on.
export interface Spot extends Point { section: string; clan: string; body: string; greeting: string; land: Point }
// Anything drawn from a character sheet. The hero alone has no reaction timer.
export interface Actor extends Body { body: string; dir: number; reaction?: number; hero?: boolean; isKeeper?: boolean; type?: 'frontier' }
export interface Hero extends Actor { gait: number; hero: true }
// Keepers stand at a spot and own a label button.
export interface Keeper extends Spot, Actor { place: string; isKeeper: true; reaction: number; button: HTMLButtonElement }
// Roaming NPCs walk a waypoint loop, planning a path to waypoint idx.
export interface Npc extends Actor { reaction: number; gait: number; way: number[][]; idx: number; path?: Point[]; isKeeper?: undefined; place?: undefined }
export interface Scenery extends Point { id: string; w: number; h: number; decorative?: boolean }
export interface House extends Scenery { roofAlpha: number }
// Trees beyond the town's edges, drawn translucent.
export interface BeyondTree extends Scenery { type: 'outside' }

const townTileCenter=(value: number)=>Math.floor(value/TOWN_TILE)*TOWN_TILE+TOWN_TILE/2;
const onTownGrid=<T extends Point>(p: T)=>({...p,x:townTileCenter(p.x),y:townTileCenter(p.y)});
export const FRONTIER_INSET=30, FRONTIER_MARGIN=96;
export const spots: Record<string, Spot> = {
  home: {x: 800, y: 440, section: 'Home', clan: 'Nix', body: 'npc-home', greeting: 'Welcome to Nix.', land: {x: 870, y: 470}},
  arena: {x: 1190, y: 345, section: 'Game', clan: 'PvP', body: 'npc-game', greeting: 'Find your next rival.', land: {x: 1100, y: 410}},
  hall: {x: 1170, y: 655, section: 'Rankings', clan: 'Preview', body: 'npc-rankings', greeting: 'Live rankings are coming later.', land: {x: 1075, y: 680}},
  gate: {x: 780, y: 715, section: 'Download', clan: 'Unavailable', body: 'npc-download', greeting: 'No download is linked yet.', land: {x: 880, y: 725}}
};
for(const p of Object.values(spots)){p.x=townTileCenter(p.x);p.y=townTileCenter(p.y);p.land=onTownGrid(p.land);}
export const hero: Hero = {...spots.home.land, body:'hero',dir:2,gait:0,hero:true};
// Keepers stand at a spot and own a label button; roaming NPCs follow a waypoint loop. Both share one update loop.
// Each keeper's button is created and assigned by bindLabels before anything reads it.
export const keepers = Object.entries(spots).map(([place, p]) => ({...p, place, dir: 2, isKeeper: true, reaction: 0})) as Keeper[];
export const npcs: Npc[] = [
  {x: 975, y: 490, body: 'mohawk', dir: 1, way: [[975,490],[1070,490],[1070,530],[975,530]], idx: 1, gait: 0, reaction: 0},
  {x: 1010, y: 730, body: 'mage', dir: 2, way: [[1010,730],[1190,730],[1190,695],[1010,695]], idx: 1, gait: 0, reaction: 0},
  {x: 742, y: 565, body: 'rogue', dir: 0, way: [[742,565],[742,625],[815,625],[815,565]], idx: 1, gait: 0, reaction: 0}
];
export const scenery: Scenery[] = [
  {id:'house',x:775,y:390,w:256,h:683*32/60}, {id:'house2',x:432,y:640,w:256,h:683*32/60,decorative:true},
  {id:'tree',x:595,y:265,w:235,h:294}, {id:'pine',x:437,y:325,w:240,h:240}, {id:'tree2',x:1360,y:282,w:255,h:320},
  {id:'pine',x:1385,y:640,w:280,h:280}, {id:'tree',x:652,y:865,w:260,h:325}, {id:'tree2',x:325,y:750,w:310,h:387},
  {id:'tree',x:555,y:115,w:225,h:282}, {id:'pine',x:960,y:142,w:200,h:200}, {id:'tree2',x:1395,y:890,w:250,h:312}
];
for(const n of npcs){n.x=townTileCenter(n.x);n.y=townTileCenter(n.y);n.way=n.way.map(([x,y])=>[townTileCenter(x),townTileCenter(y)]);}
for(const p of scenery){p.x=townTileCenter(p.x);p.y=p.id.startsWith('house')?Math.floor(p.y/TOWN_TILE)*TOWN_TILE:townTileCenter(p.y);}
export const homePortal=onTownGrid({x:1010,y:420});
// Both variants use 60 source pixels per 32-unit tile. The entrance is two tiles wide.
export function houseBounds(s: Scenery){const left=s.x-s.w/2;return {left,doorX:left+144,front:s.y-64};}
const townObstacles=scenery.flatMap((s): Rect[]=>{if(!s.id.startsWith('house'))return [{x:s.x-22,y:s.y-28,w:44,h:38}];const b=houseBounds(s);if(s.decorative)return [{x:b.left,y:s.y-192,w:256,h:192}];return [{x:b.left,y:s.y-208,w:256,h:16},{x:b.left,y:s.y-192,w:16,h:128},{x:b.left+240,y:s.y-192,w:16,h:128},{x:b.left,y:b.front,w:144,h:64},{x:b.doorX+64,y:b.front,w:48,h:64}];});
townObstacles.push({x:homePortal.x-74,y:homePortal.y-35,w:30,h:45},{x:homePortal.x+44,y:homePortal.y-35,w:30,h:45});
export const townPhysics=WorldPhysics.create({width:W,height:H,minX:-FRONTIER_MARGIN,minY:-FRONTIER_MARGIN,maxX:W+FRONTIER_MARGIN,maxY:H+FRONTIER_MARGIN,radius:10,obstacles:townObstacles});
// roofAlpha is set on every house just below.
export const houses=scenery.filter(s=>s.id.startsWith('house')) as House[];
for(const house of houses)house.roofAlpha=1;
export function insideHouse(house: Scenery,actor: Point=hero){if(house.decorative)return false;const b=houseBounds(house),x=townTileCenter(actor.x),y=townTileCenter(actor.y);return x>=b.left+16&&x<b.left+240&&y>=house.y-192&&y<house.y-32;}
export function updateHouseRoofs(dt: number){for(const house of houses){const target=insideHouse(house)?0:1,change=Math.max(0,dt)/.22;house.roofAlpha=motionOff()?target:target<house.roofAlpha?Math.max(target,house.roofAlpha-change):Math.min(target,house.roofAlpha+change);}}
// RAO movement: 32 world units per tile, 0.20 s/player step, 0.40 s/NPC step.
export const WALK_TILE = 32, WALK_SPEED = WALK_TILE/.20, NPC_SPEED = WALK_TILE/.40;
export const beyondTrees: BeyondTree[]=[];
for(let gy=-3;gy<=9;gy++)for(let gx=-3;gx<=10;gx++){const seed=Math.abs((gx*73856093)^(gy*19349663)),x=gx*192+(seed%67),y=gy*160+((seed>>>8)%69);if(x>=-FRONTIER_MARGIN-60&&x<=W+FRONTIER_MARGIN+60&&y>=-FRONTIER_MARGIN-60&&y<=H+FRONTIER_MARGIN+60)continue;if((x<0||x>W)&&(Math.abs(y-768)<75||Math.abs(y-480)<75))continue;if((y<0||y>H)&&(Math.abs(x-1152)<75||Math.abs(x-768)<75))continue;if(seed%5===0)continue;beyondTrees.push({id:seed%2?'pine':'tree2',x,y,w:196+(seed%38),h:236+(seed%42),type:'outside'});}
