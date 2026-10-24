// Shapes of the offline demo's game state, shared by the model, tutorial and navigation rules.
import type { Point, Rect } from '../../shared/physics.ts';
import type { CombatCoach } from './combat-lessons.ts';

export type { Point, Rect };
export type Phase = 'hallway' | 'arena';
// Movement input; a missing axis counts as 0.
export type Input = Partial<Point>;
// A decorative prop drawn from images[id], centred on x with its base at y.
export interface SceneryItem extends Rect {
  id: string;
}
export interface Spell {
  name: string;
  mana: number;
}
// Raw clicked world position. Legacy actor hints are ignored; the occupied tile resolves the target.
export interface CastTarget extends Point {
  enemyId?: string;
  self?: boolean;
}
// One 32px cardinal footstep in progress: x/y is its unit direction.
export interface Step extends Point {
  end: Point;
  remaining: number;
}
export interface Player extends Point {
  dir: number;
  gait: number;
  hp: number;
  mana: number;
  immobilized: number;
  moving?: boolean;
  step?: Step | null;
}
export interface Enemy extends Point {
  name: string;
  body: string;
  homeX: number;
  homeY: number;
  hp: number;
  maxHp: number;
  reward: number;
  essence: number;
  immobilized: number;
  cleanseCooldown: number;
  dir: number;
  gait: number;
  wind: number;
  cooldown: number;
  respawn: number;
  kind: string;
  speed: number;
  // Set by a player's Inmovilizar: the delay before the rival removes it.
  cleanseReaction?: number;
  moving?: boolean;
  step?: Step | null;
  // The point a winding-up attack will hit, and which spell it casts.
  aim?: Point;
  attackSpell?: string;
  attackCount?: number;
}
export interface Drop extends Point {
  id: number;
  amount: number;
  owner: string;
  readyAt: number;
}
export interface Effect extends Point {
  age: number;
  hit: boolean;
  owner: string;
  spell?: string;
  targetId?: string;
}
export interface DamageText extends Point {
  amount: number;
  age: number;
}
export interface StreamParticle extends Point {
  age: number;
  offset: number;
}
export interface HeldPotion {
  key: string;
  kind: string;
  claimed: boolean;
}
export interface Dialog {
  id: string;
  name: string;
  title: string;
  lines: string[];
}
export interface Guide extends Dialog, Point {
  body: string;
  dir: number;
  gait: number;
}
export interface TutorialState {
  coach?: CombatCoach;
  stage: 'hallway' | 'setup' | 'melee' | 'fight' | 'deposit' | 'complete';
  meleePractice?: { target: string; arenaEnemies: Enemy[] };
  seen: string[];
  dialog: Dialog | null;
  page: number;
  arenaTime: number;
  bankRevealed: boolean;
  finalRead: boolean;
  hallTime: number;
}
// A click-to-walk route: remaining waypoints, the guide to talk to on arrival, and the phase it was planned in.
export interface Navigation {
  points: Point[];
  guide: string | null;
  phase: Phase;
  stalled: number;
}
export interface DemoState {
  phase: Phase;
  selectedSpell: string;
  damageTexts: DamageText[];
  player: Player;
  carried: number;
  secured: number;
  autopotEnabled: boolean;
  heldPotions: HeldPotion[];
  lifePotions: number;
  manaPotions: number;
  potionCooldown: number;
  potionAttackLockout: number;
  lifePulse: number;
  manaPulse: number;
  dropped: number;
  kills: number;
  bank: number;
  bankAmount: number;
  bankFraction: number;
  streamParticles: StreamParticle[];
  bankUnlocked: boolean;
  armed: boolean;
  meditating: boolean;
  meleeCooldown: number;
  cooldown: number;
  time: number;
  hitToCast: number;
  castToHit: number;
  pendingMelee: number;
  fx: Effect[];
  drops: Drop[];
  nextDrop: number;
  notice: string;
  noticeId: number;
  flash: number;
  won: boolean;
  enemies: Enemy[];
  movementBlock: string;
  // Where the tutorial revealed the bank; the fixed banker position otherwise.
  bankPosition?: Point;
  // Present only in a tutorial run (createTutorial).
  tutorial?: TutorialState;
  // The active click-to-walk route, if any.
  navigation?: Navigation | null;
}
