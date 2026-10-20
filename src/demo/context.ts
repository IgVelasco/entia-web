// The offline demo controller's shared state: page handles and every value the controller modules read and change.
import M from './rules/navigation.ts';
import type { DemoState, Point, TutorialState } from './rules/state.ts';

// One pointer's held movement direction; order makes the most recent press win.
export interface HeldDirection {
  key: string | null;
  pointerType: string;
  order: number;
}
export interface DemoContext {
  // Inside Nix's same-origin iframe (?embedded=1): the parent hosts, suspends and resumes the demo.
  embedded: boolean;
  state: DemoState;
  // Decoded artwork by asset name; bank and essence may be pre-cropped bitmaps.
  images: Record<string, HTMLImageElement | ImageBitmap>;
  ready: boolean;
  paused: boolean;
  // Timestamp of the previous simulated frame.
  previous: number;
  // Canvas size in CSS pixels, world-to-screen scale and offset, and the backing-store pixel ratio.
  width: number;
  height: number;
  scale: number;
  ox: number;
  oy: number;
  dpr: number;
  // The last notice shown in #message and when it fades.
  noticeId: number;
  messageUntil: number;
  raf: number;
  // Last pointer position over the canvas, in CSS pixels relative to it.
  pointer: Point | null;
  selectedInventory: string;
  // The embedding page has suspended the demo (hidden iframe); nothing renders or simulates.
  hostSuspended: boolean;
  returning: boolean;
  hudDrawerOpen: boolean;
  // Presentation scale sent by the embedding page, so both cameras share one pixel density.
  inheritedScale: number | null;
  // When a touch last clicked the world; the click synthesized from it is ignored.
  lastTouchWorld: number;
  floorReady: boolean;
  joystickPointer: number | null;
  // The tutorial stage whose entrance motion has played.
  motionStage: TutorialState['stage'] | null;
  // The guide line ("id:page") the dialog card last animated.
  dialogKey: string;
  // Simulation waits until beatUntil; the guide dialog waits until guideHoldUntil.
  beatUntil: number;
  guideHoldUntil: number;
  presentationNow: number;
  // Tutorial time when the bank appeared and when the tutorial completed; -1 before.
  revealStart: number;
  completeStart: number;
  motionHandles: Map<Element, Animation>;
  // Movement keys and touches stamp movementOrder when pressed, so the latest held direction wins.
  // keyboardOrder is also looked up with no key held (undefined).
  movementOrder: number;
  keyboardOrder: Map<string | undefined, number>;
  keys: Set<string>;
  touches: Map<number, HeldDirection>;
  worldTouches: Set<number>;
  camera: Point;
}

// Elements read through properties beyond HTMLElement, by selector.
interface DemoElements {
  '#help-dialog': HTMLDialogElement;
  '#character-dialog': HTMLDialogElement;
  '#guide-dialog': HTMLDialogElement;
  '#autopot': HTMLInputElement;
  '#mobile-spell': HTMLSelectElement;
  '#inventory-crystal': HTMLCanvasElement;
  '#guide-portrait': HTMLCanvasElement;
  '#interact': HTMLButtonElement;
  '#cast': HTMLButtonElement;
  '#prepare-spell': HTMLButtonElement;
  '#use-selected': HTMLButtonElement;
  '#essence-slot': HTMLButtonElement;
  '#life-potion': HTMLButtonElement;
  '#mana-potion': HTMLButtonElement;
  '#macro-life': HTMLButtonElement;
  '#macro-mana': HTMLButtonElement;
  '#macro-spell': HTMLButtonElement;
  '#mobile-strike': HTMLButtonElement;
}

let embedded = false;
try {
  embedded =
    !!window.parent &&
    window.parent !== window &&
    window.parent.location.origin === window.location.origin &&
    new URLSearchParams(window.location.search).get('embedded') === '1';
} catch {}
export const canvas = document.querySelector('#game') as HTMLCanvasElement,
  ctx = canvas.getContext('2d')!,
  $ = <S extends string>(s: S) =>
    document.querySelector(s) as S extends keyof DemoElements ? DemoElements[S] : HTMLElement;
export const demo: DemoContext = {
  embedded,
  state: M.createTutorial(),
  images: {},
  ready: false,
  paused: false,
  previous: 0,
  width: 0,
  height: 0,
  scale: 1,
  ox: 0,
  oy: 0,
  dpr: 1,
  noticeId: 0,
  messageUntil: 0,
  raf: 0,
  pointer: null,
  selectedInventory: 'life',
  hostSuspended: embedded,
  returning: false,
  hudDrawerOpen: false,
  inheritedScale: null,
  lastTouchWorld: -1000,
  floorReady: false,
  joystickPointer: null,
  motionStage: null,
  dialogKey: '',
  beatUntil: 0,
  guideHoldUntil: 0,
  presentationNow: 0,
  revealStart: -1,
  completeStart: -1,
  motionHandles: new Map(),
  movementOrder: 0,
  keyboardOrder: new Map(),
  keys: new Set(),
  touches: new Map(),
  worldTouches: new Set(),
  camera: { x: 510, y: 490 },
};
export const reduced = matchMedia('(prefers-reduced-motion: reduce)');
export const floor = document.createElement('canvas');
floor.width = 1;
floor.height = 1;
