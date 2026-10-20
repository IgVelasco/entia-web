/* Single-player teaching rules, intentionally independent from RAO's live economy. */
import * as Physics from '../../shared/physics.ts';
import type { Body } from '../../shared/physics.ts';
import type { CastTarget, DemoState, Drop, Enemy, Input, Player, Point, Rect, SceneryItem, Spell } from './state.ts';
const WIDTH = 1200,
  HEIGHT = 880,
  RADIUS = 10;
const TILE = 32;
const spells: Record<string, Spell> = {
  apocalipsis: { name: 'Apocalipsis', mana: 15 },
  inmovilizar: { name: 'Inmovilizar', mana: 20 },
  remover: { name: 'Remover parálisis', mana: 10 },
};
const tileCenter = (value: number) => Math.floor(value / TILE) * TILE + TILE / 2;
const scenery: SceneryItem[] = [];
const gateway = { x: 176, y: 464 },
  banker = { x: 176, y: 688 };
const obstacles = [
  { x: gateway.x - 85, y: gateway.y - 75, w: 38, h: 92 },
  { x: gateway.x + 47, y: gateway.y - 75, w: 38, h: 92 },
];
const bankObstacle = { x: banker.x - 47, y: banker.y - 10, w: 94, h: 24 };
const physics = Physics.create({ width: WIDTH, height: HEIGHT, minY: 160, radius: RADIUS, obstacles });
function create(): DemoState {
  return {
    phase: 'arena',
    selectedSpell: 'apocalipsis',
    damageTexts: [],
    player: { x: 304, y: 432, dir: 1, gait: 0, hp: 100, mana: 100, immobilized: 0 },
    carried: 0,
    secured: 0,
    autopotEnabled: true,
    heldPotions: [],
    lifePotions: 100,
    manaPotions: 100,
    potionCooldown: 0,
    potionAttackLockout: 0,
    lifePulse: 0,
    manaPulse: 0,
    dropped: 0,
    kills: 0,
    bank: 0,
    bankAmount: 0,
    bankFraction: 0,
    streamParticles: [],
    bankUnlocked: false,
    armed: false,
    meditating: false,
    meleeCooldown: 0,
    cooldown: 0,
    time: 0,
    fx: [],
    drops: [],
    nextDrop: 1,
    notice: 'Prepare Apocalipsis with C, then click a rival. Stand on its dropped essence and press Q.',
    noticeId: 1,
    flash: 1,
    won: false,
    enemies: [
      {
        name: 'Wanderer',
        body: 'rogue',
        x: 496,
        y: 368,
        homeX: 496,
        homeY: 368,
        hp: 2,
        maxHp: 2,
        reward: 15,
        essence: 15,
        immobilized: 0,
        cleanseCooldown: 0,
        dir: 2,
        gait: 0,
        wind: 0,
        cooldown: 1,
        respawn: 0,
        kind: 'ranged',
        speed: 105,
      },
      {
        name: 'Keeper',
        body: 'mage',
        x: 912,
        y: 560,
        homeX: 912,
        homeY: 560,
        hp: 2,
        maxHp: 2,
        reward: 25,
        essence: 25,
        immobilized: 0,
        cleanseCooldown: 0,
        dir: 3,
        gait: 0,
        wind: 0,
        cooldown: 1,
        respawn: 0,
        kind: 'ranged',
        speed: 110,
      },
      {
        name: 'Sentinel',
        body: 'hero',
        x: 656,
        y: 752,
        homeX: 656,
        homeY: 752,
        hp: 3,
        maxHp: 3,
        reward: 30,
        essence: 30,
        immobilized: 0,
        cleanseCooldown: 0,
        dir: 0,
        gait: 0,
        wind: 0,
        cooldown: 1,
        respawn: 0,
        kind: 'ranged',
        speed: 110,
      },
    ],
  };
}
function tell(s: DemoState, message: string) {
  s.notice = message;
  s.noticeId++;
}
function nearGate(s: DemoState) {
  return Math.hypot(s.player.x - gateway.x, s.player.y - gateway.y) < 65;
}
function bankAt(s: DemoState) {
  return s.bankPosition || banker;
}
function bankBounds(s: DemoState): Rect {
  const b = bankAt(s);
  return { x: b.x - 47, y: b.y - 10, w: 94, h: 24 };
}
function nearBank(s: DemoState) {
  const b = bankAt(s);
  return s.bankUnlocked && Math.hypot(s.player.x - b.x, s.player.y - b.y) < 87;
}
function drop(s: DemoState, x: number, y: number, amount: number, owner: string) {
  const bankObstacle = bankBounds(s);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  amount = Math.floor(amount);
  const candidates: Point[] = [];
  for (let cy = tileCenter(180); cy < HEIGHT - 30; cy += TILE)
    for (let cx = tileCenter(30); cx < WIDTH - 30; cx += TILE) candidates.push({ x: cx, y: cy });
  candidates.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  const occupied = new Set(s.drops.map((d) => d.x + ',' + d.y));
  let remaining = amount;
  for (const point of candidates) {
    if (!remaining) break;
    if (
      occupied.has(point.x + ',' + point.y) ||
      !physics.free(point.x, point.y) ||
      (s.bankUnlocked &&
        point.x + RADIUS > bankObstacle.x &&
        point.x - RADIUS < bankObstacle.x + bankObstacle.w &&
        point.y + RADIUS > bankObstacle.y &&
        point.y - RADIUS < bankObstacle.y + bankObstacle.h)
    )
      continue;
    const part = Math.min(10, remaining);
    s.drops.push({ id: s.nextDrop++, x: point.x, y: point.y, amount: part, owner, readyAt: s.time + 0.5 });
    remaining -= part;
    occupied.add(point.x + ',' + point.y);
  }
  return amount - remaining;
}
function damage(s: DemoState, actor: Player | Enemy, amount: number) {
  actor.hp -= amount;
  s.damageTexts.push({ x: actor.x, y: actor.y, amount, age: 0 });
}
function defeatEnemy(s: DemoState, e: Enemy) {
  s.kills++;
  e.respawn = 14;
  e.wind = 0;
  e.step = null;
  e.immobilized = 0;
  const amount = drop(s, e.x, e.y, e.essence, 'rival');
  e.essence -= amount;
  tell(s, `${e.name} dropped ${amount} essence in stacks of up to 10. Pick it up before another rival does.`);
}
function respawnPlayer(s: DemoState) {
  const p = s.player,
    amount = drop(s, p.x, p.y, s.carried, 'player');
  s.dropped += amount;
  s.carried -= amount;
  cancelDeposit(s);
  clearPotionKeys(s);
  p.step = null;
  p.hp = 100;
  p.mana = 100;
  p.immobilized = 0;
  s.armed = false;
  s.meditating = false;
  p.x = 176;
  p.y = 560;
  s.flash = 1;
  for (const e of s.enemies) {
    e.wind = 0;
    e.cooldown = Math.max(e.cooldown, 1);
  }
  tell(
    s,
    `You fell and dropped ${amount} essence. Rivals can steal it; defeat them to recover it. ${s.secured} secured stays safe.`,
  );
}
function canPickup(s: DemoState, d: Drop, radius = 22) {
  return s.time >= d.readyAt && Math.hypot(d.x - s.player.x, d.y - s.player.y) <= radius;
}
function pickup(s: DemoState, radius = 20) {
  const found = s.drops.filter((d) => canPickup(s, d, radius));
  if (!found.length) return 0;
  const amount = found.reduce((n, d) => n + d.amount, 0),
    ids = new Set(found.map((d) => d.id));
  s.drops = s.drops.filter((d) => !ids.has(d.id));
  s.carried += amount;
  const first = !s.bankUnlocked;
  s.bankUnlocked = true;
  tell(
    s,
    first
      ? `+${amount} essence picked up. The reliquary has appeared south of the return portal.`
      : `+${amount} essence picked up. Carry it to the reliquary or keep fighting.`,
  );
  return amount;
}
// The tutorial's override adds 'talk' and 'enter'.
function interact(s: DemoState): 'pickup' | 'bank' | 'exit' | 'talk' | 'enter' | false {
  if (pickup(s, 22)) return 'pickup';
  if (nearBank(s)) return 'bank';
  if (nearGate(s)) return 'exit';
  return false;
}
function cancelDeposit(s: DemoState) {
  s.bank = 0;
  s.bankAmount = 0;
  s.bankFraction = 0;
}

function cardinal(x: number, y: number): Point {
  return Math.abs(x) >= Math.abs(y) ? { x: Math.sign(x), y: 0 } : { x: 0, y: Math.sign(y) };
}
function heading(x: number, y: number) {
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 1 : 3) : y > 0 ? 2 : 0;
}
function walkable(x: number, y: number) {
  return physics.free(x, y);
}
function lineClear(a: Point, b: Point) {
  return physics.clear(a, b);
}
function move(actor: Body, dx: number, dy: number, others: Body[] = []) {
  return physics.move(actor, dx, dy, others);
}
function cast(s: DemoState, target?: CastTarget | null) {
  if (!s.armed) return false;
  s.armed = false;
  if (s.cooldown > 0 || !target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return false;
  const p = s.player,
    d = Math.hypot(target.x - p.x, target.y - p.y),
    spell = spells[s.selectedSpell] || spells.apocalipsis;
  const enemy = s.enemies.find(
      (e) => e.name === target.enemyId && e.hp > 0 && Math.hypot(e.x - target.x, e.y - target.y) < 1,
    ),
    self = target.self === true && d < 1;
  if (p.mana < spell.mana) {
    tell(s, 'Not enough mana. Rest in the sanctuary to recover.');
    return false;
  }
  if (d > 270) {
    tell(s, 'Out of range. Move closer to your target.');
    return false;
  }
  if (!lineClear(p, target)) {
    tell(s, 'The spell is blocked. Find a clear line of sight.');
    return false;
  }
  if (s.selectedSpell !== 'apocalipsis' && !enemy && !self) {
    tell(s, 'Point at a character to cast this spell.');
    return false;
  }
  if (s.selectedSpell === 'inmovilizar' && !enemy) {
    tell(s, 'Aim Inmovilizar at a rival.');
    return false;
  }
  if (s.selectedSpell === 'inmovilizar' && enemy!.immobilized > 0) {
    tell(s, 'That rival is already immobilized.');
    return false;
  }
  if (s.selectedSpell === 'remover' && !(self ? p : enemy!).immobilized) {
    tell(s, 'That character is not immobilized.');
    return false;
  }
  p.dir = heading(target.x - p.x, target.y - p.y);
  s.cooldown = 0.75;
  s.potionAttackLockout = 0.31;
  s.meditating = false;
  p.mana -= spell.mana;
  if (s.selectedSpell === 'inmovilizar') {
    enemy!.immobilized = 3;
    enemy!.cleanseReaction = 0.9;
    enemy!.step = null;
    s.fx.push({ x: enemy!.x, y: enemy!.y, age: 0, hit: true, owner: 'bind' });
    tell(s, `${enemy!.name} is immobilized. It can still cast and may remove the effect.`);
  } else if (s.selectedSpell === 'remover') {
    const who = self ? p : enemy!;
    who.immobilized = 0;
    s.fx.push({ x: who.x, y: who.y, age: 0, hit: true, owner: 'cleanse' });
    tell(s, self ? 'Movement restored.' : 'Paralysis removed.');
  } else {
    s.fx.push({ x: target.x, y: target.y, age: 0, hit: true, owner: 'player' });
    if (enemy) {
      damage(s, enemy, 1);
      if (enemy.hp === 0) defeatEnemy(s, enemy);
    } else tell(s, 'No rival under the pointer. Aim at a character and click.');
  }
  return true;
}
function melee(s: DemoState) {
  if (s.meleeCooldown > 0) return false;
  s.meleeCooldown = 1;
  s.potionAttackLockout = 0.31;
  s.meditating = false;
  const p = s.player,
    v = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ][p.dir];
  const target = s.enemies
    .filter((e) => e.hp > 0)
    .find((e) => {
      const dx = e.x - p.x,
        dy = e.y - p.y,
        forward = dx * v.x + dy * v.y,
        side = Math.abs(dx * v.y - dy * v.x);
      return forward > 0 && forward <= 58 && side <= 20 && lineClear(p, e);
    });
  s.fx.push({ x: p.x + v.x * 32, y: p.y + v.y * 32, age: 0, hit: true, owner: 'melee' });
  if (target) {
    damage(s, target, 1);
    if (!target.hp) {
      defeatEnemy(s, target);
    }
  } else tell(s, 'Strike the rival directly in front of you.');
  return true;
}
function meditate(s: DemoState) {
  s.meditating = !s.meditating;
  s.armed = false;
  s.player.step = null;
  tell(s, s.meditating ? 'Meditating. Stay still to recover mana.' : 'Meditation stopped.');
}
function usePotion(s: DemoState, kind: string) {
  const life = kind === 'life';
  if (!life && kind !== 'mana') return false;
  const stock = life ? 'lifePotions' : 'manaPotions',
    resource = life ? 'hp' : 'mana';
  if (s.player.hp <= 0 || s[stock] <= 0 || s.potionCooldown > 1e-6 || s.potionAttackLockout > 1e-6) return false;
  // Normal-area RAO semantics: a valid use consumes stock even at full resources.
  s[stock]--;
  s.potionCooldown = 0.26;
  s.player[resource] = Math.min(100, s.player[resource] + (life ? 40 : 50));
  s[life ? 'lifePulse' : 'manaPulse'] = 0.4;
  return true;
}
function pressPotion(s: DemoState, key: string, kind: string) {
  if (s.heldPotions.some((p) => p.key === key)) return;
  s.heldPotions.push({ key, kind, claimed: false });
}
function releasePotion(s: DemoState, key: string) {
  const held = s.heldPotions.find((p) => p.key === key);
  s.heldPotions = s.heldPotions.filter((p) => p.key !== key);
  if (held && !held.claimed) usePotion(s, held.kind);
}
function clearPotionKeys(s: DemoState) {
  s.heldPotions = [];
}

function botStep(s: DemoState, e: Enemy, target: Point, dt: number) {
  if (e.immobilized > 0) return;
  const b = bankBounds(s),
    bankBlocked = (x: number, y: number) =>
      s.bankUnlocked && x + RADIUS > b.x && x - RADIUS < b.x + b.w && y + RADIUS > b.y && y - RADIUS < b.y + b.h;
  const others = [s.player, ...s.enemies.filter((a) => a.hp > 0)];
  if (!e.step) {
    if (Math.hypot(target.x - e.x, target.y - e.y) < 4) return;
    let v = cardinal(target.x - e.x, target.y - e.y),
      end = { x: e.x + v.x * 32, y: e.y + v.y * 32 };
    if (bankBlocked(end.x, end.y) || !physics.clear(e, end, others, e)) {
      v = { x: v.x ? 0 : Math.sign(target.x - e.x), y: v.y ? 0 : Math.sign(target.y - e.y) };
      end = { x: e.x + v.x * 32, y: e.y + v.y * 32 };
      if (bankBlocked(end.x, end.y) || !physics.clear(e, end, others, e)) return;
    }
    e.step = { ...v, end, remaining: 32 };
    e.dir = heading(v.x, v.y);
  }
  const step = e.step,
    distance = Math.min(step.remaining, e.speed * dt),
    moved = bankBlocked(e.x + step.x * distance, e.y + step.y * distance)
      ? 0
      : move(e, step.x * distance, step.y * distance, others);
  e.moving = moved > 0.01;
  step.remaining -= moved;
  if (moved < distance - 0.001) e.step = null;
  else if (step.remaining < 0.001) {
    e.x = step.end.x;
    e.y = step.end.y;
    e.step = null;
  }
}
function update(s: DemoState, dt: number, input: Input = { x: 0, y: 0 }) {
  dt = Math.max(0, Math.min(dt, 0.05));
  s.time += dt;
  s.damageTexts = s.damageTexts.filter((d) => (d.age += dt) < 1);
  s.flash = Math.max(0, s.flash - dt * 1.5);
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.meleeCooldown = Math.max(0, s.meleeCooldown - dt);
  for (const key of ['potionCooldown', 'potionAttackLockout', 'lifePulse', 'manaPulse'] as const)
    s[key] = Math.max(0, s[key] - dt);
  const p = s.player;
  if (p.hp <= 0) {
    respawnPlayer(s);
    return;
  }
  p.immobilized = Math.max(0, p.immobilized - dt);
  const vector = cardinal(input.x || 0, input.y || 0);
  p.moving = false;
  // Banking uses the same solid footprint as other props once it appears.
  const activeObstacles = s.bankUnlocked ? [bankBounds(s)] : [];
  const insideBank = (x: number, y: number) =>
    activeObstacles.some(
      (o) => x + RADIUS > o.x && x - RADIUS < o.x + o.w && y + RADIUS > o.y && y - RADIUS < o.y + o.h,
    );
  if (!p.immobilized && !p.step && (vector.x || vector.y)) {
    const end = { x: p.x + vector.x * 32, y: p.y + vector.y * 32 };
    p.dir = heading(vector.x, vector.y);
    if (
      !insideBank(end.x, end.y) &&
      physics.clear(
        p,
        end,
        s.enemies.filter((e) => e.hp > 0),
        p,
      )
    )
      p.step = { ...vector, end, remaining: 32 };
  }
  if (p.step && !p.immobilized) {
    const step = p.step,
      distance = Math.min(step.remaining, 160 * dt),
      dx = step.x * distance,
      dy = step.y * distance;
    const moved = insideBank(p.x + dx, p.y + dy)
      ? 0
      : move(
          p,
          dx,
          dy,
          s.enemies.filter((e) => e.hp > 0),
        );
    p.moving = moved > 0.01;
    step.remaining -= moved;
    if (moved < distance - 0.001) p.step = null;
    else if (step.remaining < 0.001) {
      p.x = step.end.x;
      p.y = step.end.y;
      p.step = null;
    }
  }

  if (p.moving) s.meditating = false;
  if (s.meditating) p.mana = Math.min(100, p.mana + 18 * dt);
  const safe = p.x < 270;
  if (safe) {
    p.hp = Math.min(100, p.hp + 12 * dt);
    p.mana = Math.min(100, p.mana + 24 * dt);
  }
  for (const f of s.fx) {
    f.age += dt;
    if (f.owner === 'enemy' && !f.hit && f.age >= 0.3) {
      f.hit = true;
      if (!safe && Math.hypot(p.x - f.x, p.y - f.y) < 35) {
        if (f.spell === 'inmovilizar') {
          p.immobilized = 2.5;
          p.step = null;
          tell(s, 'Immobilized! Prepare Remover parálisis and click yourself.');
        } else damage(s, p, 12);
        s.flash = 0.2;
        cancelDeposit(s);
      }
    }
  }
  s.fx = s.fx.filter((f) => f.age < 2);
  if (p.hp <= 0) {
    respawnPlayer(s);
    return;
  }
  s.streamParticles = s.streamParticles.filter((f) => (f.age += dt) < 0.55);
  if (nearBank(s) && s.carried > 0) {
    if (!s.bank) {
      s.bankAmount = s.carried;
      s.bankFraction = 0;
    }
    const previous = s.bank;
    s.bank += dt;
    if (previous < 1 && s.bank >= 1) tell(s, 'The bank is drawing in your essence. Stay nearby.');
    if (s.bank >= 1) {
      s.bankFraction += dt * 12;
      const amount = Math.min(s.carried, Math.floor(s.bankFraction));
      if (amount > 0) {
        s.bankFraction -= amount;
        s.carried -= amount;
        s.secured += amount;
        s.won = s.secured >= 60;
        for (let i = 0; i < amount; i++)
          s.streamParticles.push({ x: p.x, y: p.y - 32, age: 0, offset: ((s.secured + i) % 3) - 1 });
        if (!s.carried) {
          tell(s, `Essence secured. ${s.secured} stored safely.`);
          cancelDeposit(s);
        }
      }
    }
  } else {
    if (s.bank && s.carried > 0) tell(s, 'Transfer stopped. Stored essence is safe; the rest is still carried.');
    cancelDeposit(s);
  }

  for (const e of s.enemies) {
    e.moving = false;
    e.cooldown = Math.max(0, e.cooldown - dt);
    if (e.hp <= 0) {
      e.respawn -= dt;
      if (
        e.respawn <= 0 &&
        Math.hypot(p.x - e.homeX, p.y - e.homeY) > 70 &&
        !s.enemies.some((a) => a !== e && a.hp > 0 && Math.hypot(a.x - e.homeX, a.y - e.homeY) < 25)
      ) {
        e.hp = e.maxHp;
        e.essence += e.reward;
        e.immobilized = 0;
        e.cleanseCooldown = 0;
        e.x = e.homeX;
        e.y = e.homeY;
        e.step = null;
        e.cooldown = 1;
      }
      continue;
    }
    e.immobilized = Math.max(0, e.immobilized - dt);
    e.cleanseCooldown = Math.max(0, e.cleanseCooldown - dt);
    if (e.immobilized) {
      e.cleanseReaction = Math.max(0, e.cleanseReaction! - dt);
      if (e.cleanseReaction === 0 && e.cleanseCooldown === 0) {
        e.immobilized = 0;
        e.cleanseCooldown = 5;
        s.fx.push({ x: e.x, y: e.y, age: 0, hit: true, owner: 'cleanse' });
        tell(s, `${e.name} used Remover parálisis.`);
      }
    }
    const loot = s.drops
      .filter((d) => s.time >= d.readyAt + 1 && d.x >= 270 && Math.hypot(d.x - e.x, d.y - e.y) < 240)
      .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))[0];
    if (loot && !e.immobilized && !e.wind) {
      if (Math.hypot(loot.x - e.x, loot.y - e.y) <= 22) {
        e.essence += loot.amount;
        s.drops = s.drops.filter((d) => d.id !== loot.id);
        tell(s, `${e.name} took ${loot.amount} essence. Defeat it to recover the loot.`);
      } else botStep(s, e, loot, dt);
      continue;
    }
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (e.wind > 0) {
      e.wind -= dt;
      if (e.wind <= 0) {
        e.cooldown = 2.4;
        if (!safe && e.aim && lineClear(e, e.aim)) {
          s.fx.push({
            x: e.aim.x,
            y: e.aim.y,
            age: 0,
            hit: false,
            owner: 'enemy',
            spell: e.attackSpell || 'apocalipsis',
          });
        }
      }
      continue;
    }
    if (!safe && d < 480) {
      if (d < 170 && e.cooldown === 0 && lineClear(e, p)) {
        e.wind = 0.85;
        e.attackCount = (e.attackCount || 0) + 1;
        e.attackSpell = e.attackCount % 4 === 0 ? 'inmovilizar' : 'apocalipsis';
        e.aim = { x: p.x, y: p.y };
        e.step = null;
      } else if (d > 115) botStep(s, e, p, dt);
    } else if (Math.hypot(e.x - e.homeX, e.y - e.homeY) > 5) botStep(s, e, { x: e.homeX, y: e.homeY }, dt);
  }
  if (s.autopotEnabled && s.heldPotions.length) {
    const primary = s.heldPotions.at(-1)!;
    if (usePotion(s, primary.kind)) primary.claimed = true;
  }
}
const api = {
  bankAt,
  bankBounds,
  spells,
  WIDTH,
  HEIGHT,
  RADIUS,
  TILE,
  tileCenter,
  scenery,
  obstacles,
  bankObstacle,
  gateway,
  banker,
  walkable,
  move,
  lineClear,
  create,
  nearGate,
  nearBank,
  interact,
  cast,
  update,
  drop,
  pickup,
  canPickup,
  cardinal,
  tell,
  melee,
  meditate,
  cancelDeposit,
  usePotion,
  pressPotion,
  releasePotion,
  clearPotionKeys,
};
// The tutorial and navigation rules override members of this same object and add their own.
export default api;
