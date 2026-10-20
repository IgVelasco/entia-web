// The Nix site controller's shared state: page handles, world constants and every value the controller modules read and change.
import type {Point} from '../shared/physics.ts';
import type {FrontierSequence, FrontierWizard} from './escort.ts';
import * as WorldFrontier from './frontier.ts';
import type {FrontierState} from './frontier.ts';

// Where a navigation walk is heading: beside a keeper (near) or to its landing tile.
export interface Destination { place: string; near: boolean }
// The hero's walk in progress along cardinal points; a blocked destination walk retries its path.
export interface Route { sx: number; sy: number; target: Point; points: Point[]; segment: number; length: number; distance: number; elapsed: number; duration: number; complete?: () => void; manual: boolean; explore: boolean; joystick: boolean; destination: Destination | null; retryIn?: number; retries?: number }
// One Apocalipsis cast; a cast at a keeper names its place and makes it react on impact.
export interface Spell extends Point { place?: string; age: number; delay: number; duration: number; hit: boolean }
// An expanding ground ring at an arrival or cast.
export interface Ring extends Point { age: number; duration: number }
// Repeating terrain drawn beyond the cached town ground.
export interface WorldPatterns { grass: CanvasPattern; path: CanvasPattern }
export interface SiteContext {
  // Canvas size in CSS pixels, backing-store pixel ratio, world-to-screen scale and offset, and the visitor's zoom.
  width: number; height: number; dpr: number; scale: number; ox: number; oy: number; zoom: number;
  // Animation time in seconds, the previous frame's timestamp and the pending animation frame.
  time: number; last: number; frameRequest: number;
  // The visitor paused world animation; the artwork has loaded.
  paused: boolean; ready: boolean;
  // Decoded artwork by asset name.
  images: Record<string, HTMLImageElement>;
  // The open section, the walk in progress, the active cast, arrival rings and whether a spell is being aimed.
  current: string; route: Route | null; spell: Spell | null; rings: Ring[]; aiming: boolean;
  // The section the hero stands at, and the keeper label under the pointer or focus.
  atPlace: string | null; hovered: string | null;
  toastTimer: number | undefined; replyTimer: number | undefined;
  // The keeper whose proximity opened its section, and the section content moved into the zone dialog.
  nearbyPlace: string | null; zoneContent: HTMLElement | null;
  // The pointer holding the mobile thumbstick and its cardinal direction; the phone camera's follow offset.
  joystickPointer: number | null; joystickDirection: number | null; mobileExploring: boolean; mobilePanX: number; mobilePanY: number;
  // The boundary encounter, its wizard and escort sequence, and the terrain patterns beyond the town.
  frontierState: FrontierState; frontierWizard: FrontierWizard | null; frontierSequence: FrontierSequence | null; worldPatterns: WorldPatterns | null;
  // The embedded demo's lifecycle: portal transition, open view and iframe loading.
  enteringPortal: boolean; demoOpen: boolean; demoFrameStarted: boolean; demoCloseEpoch: number; demoEverOpened: boolean; demoLoaded: boolean; demoFailed: boolean; portalReentryBlocked: boolean;
  demoLoadTimer: number;
  // The cached town ground canvas holds current pixels.
  groundReady: boolean;
}

// Elements read through properties beyond HTMLElement, by selector.
interface SiteElements {
  '#scene': HTMLCanvasElement; '#demo-frame': HTMLIFrameElement;
  '#notes': HTMLDialogElement; '#character-dialog': HTMLDialogElement; '#zone-dialog': HTMLDialogElement;
  '#motion': HTMLButtonElement;
  // #mobile-about reuses the About button's own click handler.
  '#about': HTMLButtonElement & { onclick: () => void };
}

export const $ = <S extends string>(selector: S) => document.querySelector(selector) as S extends keyof SiteElements ? SiteElements[S] : HTMLElement;
export const $$ = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
export const canvas = $('#scene');
export const ctx = canvas.getContext('2d')!;
export const W = 1440, H = 900, TOWN_TILE=32;
export const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
export const touchPreference = matchMedia('(pointer: coarse)');
export const compactMode=()=>site.width<=900||touchPreference.matches;
export const site: SiteContext={width:0,height:0,dpr:1,scale:1,ox:0,oy:0,zoom:1,time:0,last:0,frameRequest:0,paused:false,ready:false,images:{},current:'home',route:null,spell:null,rings:[],aiming:false,atPlace:'home',hovered:null,toastTimer:undefined,replyTimer:undefined,nearbyPlace:null,zoneContent:null,joystickPointer:null,joystickDirection:null,mobileExploring:false,mobilePanX:0,mobilePanY:0,frontierState:WorldFrontier.initialState(),frontierWizard:null,frontierSequence:null,worldPatterns:null,enteringPortal:false,demoOpen:false,demoFrameStarted:false,demoCloseEpoch:0,demoEverOpened:false,demoLoaded:false,demoFailed:false,portalReentryBlocked:false,demoLoadTimer:0,groundReady:false};
export const ground = document.createElement('canvas');
ground.width = W; ground.height = H;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const motionOff = () => site.paused || motionPreference.matches;
export const heading = (dx: number,dy: number) => Math.abs(dx)>Math.abs(dy) ? (dx>0?1:3) : (dy>0?2:0);
