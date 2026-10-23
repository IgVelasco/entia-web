const test = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm'),
  fs = require('node:fs'),
  path = require('node:path');
const { loadSandboxModule } = require('./helpers/sandbox-module.cjs');
const { containsCode } = require('./helpers/source-text.cjs');
// run() expressions reach the demo controller through these sandbox globals: its context object, the rules (M) and each module's exports.
const controllerGlobals = (load) => ({
  demo: load('demo/context.ts').demo,
  M: load('demo/rules/navigation.ts').default,
  Character: load('shared/character.ts'),
  Context: load('demo/context.ts'),
  Render: load('demo/render.ts'),
  Input: load('demo/input.ts'),
  Hud: load('demo/hud.ts'),
  Motion: load('demo/motion.ts'),
  Embed: load('demo/embed.ts'),
  Loop: load('demo/loop.ts'),
  Setup: load('demo/setup.ts'),
});
// The demo controller's modules, for source-text checks.
const controllerSource = () =>
  ['context', 'main', 'assets', 'embed', 'render', 'input', 'hud', 'motion', 'loop']
    .map((m) => fs.readFileSync(path.join(__dirname, `../src/demo/${m}.ts`), 'utf8'))
    .join('\n');
function app({
  embedded = false,
  width = 1100,
  height = 800,
  coarse = false,
  tutorial = false,
  movementChosen = true,
} = {}) {
  const posted = [],
    parentWindow = embedded
      ? { location: { origin: 'https://entia.test' }, postMessage: (message) => posted.push(message) }
      : undefined;
  const nodes = new Map(),
    listeners = {},
    windowEvents = {},
    frames = [],
    draws = [],
    geometry = [];
  const make = () => ({
    open: false,
    showModal() {
      this.open = true;
    },
    show() {
      this.open = true;
    },
    close() {
      this.open = false;
      this.closeEvent?.();
    },
    hidden: false,
    disabled: false,
    textContent: '',
    innerHTML: '',
    style: {},
    dataset: {},
    classList: { toggle() {} },
    getBoundingClientRect: () => ({ width, height, left: 0, top: 0 }),
    focus() {},
    setPointerCapture() {},
    setAttribute(name, value) {
      (this.attributes ||= {})[name] = String(value);
    },
    getAttribute(name) {
      return this.attributes?.[name] ?? null;
    },
    addEventListener(type, fn) {
      this[type === 'close' ? 'closeEvent' : type] = fn;
    },
    getContext: () =>
      new Proxy(
        {
          drawImage: (...args) => draws.push(args),
          ellipse: (...args) => geometry.push(args),
          createPattern: () => ({}),
          createRadialGradient: () => ({ addColorStop() {} }),
        },
        { get: (o, k) => o[k] || (() => {}) },
      ),
  });
  const get = (s) => {
    if (!nodes.has(s)) nodes.set(s, make());
    return nodes.get(s);
  };
  const document = {
    body: {
      dataset: {},
      classList: {
        add() {},
        remove() {},
        toggle() {
          return true;
        },
      },
    },
    hidden: false,
    querySelector: get,
    querySelectorAll: (s) =>
      s === '[data-dir]'
        ? ['up', 'left', 'down', 'right'].map((d) => {
            const b = get('[data-dir=' + d + ']');
            b.dataset.dir = d;
            return b;
          })
        : [],
    createElement: make,
    addEventListener: (k, f) => (listeners[k] = f),
  };
  const context = vm.createContext({
    URLSearchParams,
    window: {
      parent: parentWindow,
      location: { origin: 'https://entia.test', search: embedded ? '?embedded=1' : '', assign() {} },
      addEventListener: (k, f) => (windowEvents[k] = f),
    },
    document,
    Image: class {
      set src(v) {
        this.srcPath = v;
        this.onload();
      }
    },
    matchMedia: (q) => ({ matches: q.includes('pointer') ? coarse : false }),
    devicePixelRatio: 1,
    performance: { now: () => 0 },
    requestAnimationFrame: (fn) => (frames.push(fn), frames.length),
    cancelAnimationFrame() {},
    console,
  });
  const modules = new Map(),
    load = (file) => loadSandboxModule(context, path.join(__dirname, '../src', file), modules);
  load('demo/main.ts');
  Object.assign(context, controllerGlobals(load));
  context.demo.clickMovementChosen = movementChosen;
  if (!tutorial) vm.runInContext('demo.state=M.create();demo.hostSuspended=false', context);
  return { context, get, listeners, windowEvents, frames, draws, geometry, posted, parentWindow };
}
test('first movement choice blocks guides and walking until answered, then stays answered for this visit', async () => {
  const a = app({ tutorial: true, movementChosen: false });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run('Loop.tick(20)');
  assert(a.get('#movement-choice-dialog').open);
  const before = run('JSON.stringify(demo.state)');
  a.listeners.keydown({ key: 'd', target: { closest: () => false }, preventDefault() {} });
  run('Loop.tick(500)');
  assert.equal(run('JSON.stringify(demo.state)'), before);
  assert.equal(run('demo.keys.size'), 0);
  a.get('#movement-click-no').onclick();
  assert(!a.get('#movement-choice-dialog').open);
  assert.equal(run('demo.clickMovementChosen'), true);
  assert.equal(run('demo.clickMovement'), false);
  a.listeners.keydown({ key: 'd', target: { closest: () => false }, preventDefault() {} });
  run('Loop.tick(520)');
  assert.notEqual(run('JSON.stringify(demo.state)'), before);
  run('demo.state=M.createTutorial();Loop.tick(540)');
  assert(!a.get('#movement-choice-dialog').open);
});

test('an embedded unanswered prompt closes on suspension and returns on activation', async () => {
  const a = app({ tutorial: true, embedded: true, movementChosen: false });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  const host = (type) =>
    a.windowEvents.message({ source: a.parentWindow, origin: 'https://entia.test', data: { type } });
  run('Loop.tick(20)');
  assert(!a.get('#movement-choice-dialog').open);
  host('entia-demo-activate');
  run('Loop.tick(40)');
  assert(a.get('#movement-choice-dialog').open);
  host('entia-demo-pause');
  assert(!a.get('#movement-choice-dialog').open);
  host('entia-demo-activate');
  run('Loop.tick(60)');
  assert(a.get('#movement-choice-dialog').open);
  a.get('#movement-click-yes').onclick();
  assert.equal(run('demo.clickMovement'), true);
  assert.equal(run('demo.clickMovementChosen'), true);
});

test('initial instructions pause gameplay; resume, right HUD and camera work', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  assert(run('demo.ready'));
  assert(a.get('#help-dialog').open);
  assert(run('demo.paused'));
  a.get('#resume').onclick();
  run('Loop.tick(20)');
  assert.equal(a.get('#carried').textContent, '0');
  assert.equal(a.get('#curtain').hidden, true);
  assert.equal(run('demo.state.player.x*demo.scale+demo.ox'), 550);
  assert.equal(run('demo.state.player.y*demo.scale+demo.oy'), 400);
  a.get('#pause').onclick();
  const old = run('demo.state.time');
  run('Loop.tick(40)');
  assert.equal(run('demo.state.time'), old);
  a.get('#resume').onclick();
  a.get('#mana-potion').onclick();
  assert.equal(run('demo.selectedInventory'), 'mana');
  a.windowEvents.blur();
  assert(run('demo.paused'));
});
test('controller uses latest held direction and pointer-specific casts', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run("demo.keys.add('w');demo.keys.add('d')");
  assert.equal(run('Input.input().x'), 1);
  assert.equal(run('Input.input().y'), 0);
  run('Render.draw();demo.pointer={x:demo.width/2+100*demo.scale,y:demo.height/2};Input.prepareSpell()');
  assert.equal(run('Input.aimPoint().x'), 404);
  assert.equal(run('Input.aimPoint().y'), 432);
  run('Input.castAtPointer()');
  assert(!run('demo.state.armed'));
  assert.equal(run('demo.state.player.mana'), 100);
});

test('disabling click movement cancels routes but preserves keyboard walking and free spell clicks', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run('M.walkTo(demo.state,{x:432,y:432});Render.draw()');
  a.get('#bindings-click-no').onclick();
  assert.equal(run('demo.clickMovement'), false);
  assert.equal(run('demo.state.navigation'), null);
  assert.equal(a.get('#bindings-click-no').getAttribute('aria-pressed'), 'true');
  const click = { button: 0, clientX: 650, clientY: 400 };
  run('Render.draw()');
  a.get('#game').click(click);
  assert.equal(run('demo.state.navigation'), null);
  const x = run('demo.state.player.x');
  run('M.update(demo.state,.02,{x:1});Render.draw()');
  assert(run('demo.state.player.x') > x);
  run('demo.state.armed=true');
  a.get('#game').click({
    button: 0,
    clientX: run('demo.width/2+(demo.state.enemies[0].x-demo.state.player.x)*demo.scale'),
    clientY: run('demo.height/2+(demo.state.enemies[0].y-demo.state.player.y)*demo.scale'),
  });
  assert.equal(run('demo.state.enemies[0].hp'), 1);
  assert.equal(run('demo.state.player.mana'), 85);
  a.get('#bindings-click-yes').onclick();
  a.get('#game').click(click);
  assert(run('demo.state.navigation'));
});

test('click movement disabled still allows talking to a nearby guide without approaching a distant one', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#bindings-click-no').onclick();
  run('Render.draw()');
  const clickGuide = (index) =>
    a.get('#game').click({
      button: 0,
      clientX: run(`demo.width/2+(M.guides[${index}].x-demo.state.player.x)*demo.scale`),
      clientY: run(`demo.height/2+(M.guides[${index}].y-M.hallway.cameraY)*demo.scale`),
    });
  clickGuide(1);
  assert.equal(run('demo.state.navigation'), null);
  assert.equal(run('demo.state.tutorial.dialog'), null);
  clickGuide(0);
  assert.equal(run('demo.state.tutorial.dialog.id'), 'warden');
});

test('a spell rebound to E never also interacts, and interaction can move to another key', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run(
    "demo.macroBindings.interact='t';demo.macroBindings.apocalipsis='e';globalThis.interactions=0;M.interact=()=>++interactions",
  );
  const event = (key) => ({ key, target: { closest: () => false }, preventDefault() {} });
  a.listeners.keydown(event('e'));
  assert(run('demo.state.armed'));
  a.listeners.keyup(event('e'));
  assert.equal(run('interactions'), 0);
  a.listeners.keydown(event('t'));
  assert.equal(run('interactions'), 0);
  a.listeners.keyup(event('t'));
  assert.equal(run('interactions'), 1);
});

test('held macro repeats suppress browser function-key defaults without dispatching twice', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run("demo.macroBindings.life='f1'");
  let prevented = 0;
  for (const repeat of [false, true, true])
    a.listeners.keydown({
      key: 'F1',
      repeat,
      target: { closest: () => false },
      preventDefault() {
        prevented++;
      },
    });
  assert.equal(prevented, 3);
  assert.equal(run('demo.state.heldPotions.length'), 1);
  a.listeners.keyup({ key: 'F1', preventDefault() {} });
  assert.equal(run('demo.state.lifePotions'), 99);
});

test('standalone Ctrl and Shift dispatch macros, can be held while walking, and wait for both modifier sides to release', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run("demo.macroBindings.mana='control';demo.macroBindings.life='shift'");
  const event = (key, rest = {}) => ({ key, target: { closest: () => false }, preventDefault() {}, ...rest });
  a.listeners.keydown(event('Control', { ctrlKey: true }));
  assert.equal(run('demo.state.heldPotions[0].key'), 'control');
  let prevented = false;
  a.listeners.keydown(
    event('w', {
      ctrlKey: true,
      preventDefault() {
        prevented = true;
      },
    }),
  );
  assert(prevented, 'bound Ctrl + walking must not trigger a browser tab shortcut');
  assert.equal(run('Input.input().y'), -1);
  a.listeners.keydown(event('Shift', { ctrlKey: true, shiftKey: true }));
  assert.equal(run('demo.state.heldPotions.length'), 2);
  a.listeners.keyup(event('Shift', { shiftKey: true }));
  assert.equal(run('demo.state.heldPotions.length'), 2);
  a.listeners.keyup(event('Shift'));
  assert.equal(run('demo.state.heldPotions.length'), 1);
  a.listeners.keyup(event('Control', { ctrlKey: true }));
  assert.equal(run('demo.state.heldPotions.length'), 1);
  a.listeners.keyup(event('Control'));
  assert.equal(run('demo.state.heldPotions.length'), 0);
  prevented = false;
  a.listeners.keydown(
    event('c', {
      ctrlKey: true,
      preventDefault() {
        prevented = true;
      },
    }),
  );
  assert.equal(prevented, false, 'other Ctrl shortcuts keep their browser meaning');
});

test('the full bindings editor freezes the world and can reopen without changing assignments', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run("demo.macroBindings.apocalipsis='t';Setup.openBindings()");
  assert(a.get('#bindings-dialog').open);
  const time = run('demo.state.time');
  run('Loop.tick(40)');
  assert.equal(run('demo.state.time'), time);
  a.get('#bindings-close').onclick();
  assert(!a.get('#bindings-dialog').open);
  run('Loop.tick(80);Setup.openBindings()');
  assert(run('demo.state.time') > time);
  assert.equal(run('demo.macroBindings.apocalipsis'), 't');
});

test('real incoming paralysis opens its explanation, pauses time and teaches a self cast of Remover', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run(
    "demo.state.tutorial.seen=M.guides.map(g=>g.id);M.enterArena(demo.state);M.startFight(demo.state);M.dismissCombatLesson(demo.state);M.resolveEnemySpell(demo.state,demo.state.player,'inmovilizar');for(let i=0;i<31;i++)M.update(demo.state,.02);Hud.ui()",
  );
  assert(a.get('#combat-lesson').open);
  assert.equal(a.get('#combat-title').textContent, 'Te inmovilizaron');
  assert.match(a.get('#combat-response').textContent, /10 de maná/);
  const paralysis = run('demo.state.player.immobilized');
  run('Loop.tick(500)');
  assert.equal(run('demo.state.player.immobilized'), paralysis);
  a.get('#combat-continue').onclick();
  assert(!a.get('#combat-lesson').open);
  run(
    "Hud.selectSpell('remover');Input.prepareSpell();demo.pointer={x:demo.width/2,y:demo.height/2};Input.castAtPointer();for(let i=0;i<31;i++)M.update(demo.state,.02);Hud.ui()",
  );
  assert.equal(run('demo.state.player.immobilized'), 0);
  assert.equal(run('demo.state.player.mana'), 90);
  assert.equal(a.get('#combat-title').textContent, 'Te quitaste la inmovilización');
  a.get('#combat-skip').onclick();
  assert(!a.get('#combat-lesson').open);
  run("M.resolveEnemySpell(demo.state,demo.state.player,'apocalipsis');Hud.ui()");
  assert(!a.get('#combat-lesson').open);
  assert.equal(run('demo.state.player.hp'), 88);
});

test('coaching waits for the spell visual before opening its card, then remains reversible from pause', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run(
    "demo.state.tutorial.seen=M.guides.map(g=>g.id);M.enterArena(demo.state);M.startFight(demo.state);M.dismissCombatLesson(demo.state);M.resolveEnemySpell(demo.state,demo.state.player,'inmovilizar');Hud.ui()",
  );
  assert(!a.get('#combat-lesson').open);
  assert.equal(a.get('#combat-guidance').hidden, true);
  run('for(let i=0;i<10;i++)Loop.tick((i+1)*20)');
  assert(!a.get('#combat-lesson').open);
  assert(run('demo.state.fx[0].age > .19'));
  run('for(let i=10;i<32;i++)Loop.tick((i+1)*20)');
  assert(a.get('#combat-lesson').open);
  assert.equal(run('demo.state.player.immobilized'), 2.5);
  a.get('#combat-skip').onclick();
  run('Hud.showHelp();Hud.ui()');
  assert.match(a.get('#help-experienced').textContent, /Volver a mostrar/);
  a.get('#help-experienced').onclick();
  assert.equal(run('demo.state.tutorial.coach.enabled'), true);
  assert.equal(run('demo.paused'), true);
  assert(a.get('#help-dialog').open);
  assert.match(a.get('#help-experienced').textContent, /Ya he jugado/);
  run(
    "Hud.hideHelp();M.resolveEnemySpell(demo.state,demo.state.player,'inmovilizar');for(let i=0;i<31;i++)M.update(demo.state,.02);Hud.ui()",
  );
  assert(a.get('#combat-lesson').open);
});

test('compact coaching releases its highlights and focus lock on pause, then restores them on resume', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run(
    "demo.state.tutorial.seen=M.guides.map(g=>g.id);M.enterArena(demo.state);M.startFight(demo.state);M.dismissCombatLesson(demo.state);M.resolveEnemySpell(demo.state,demo.state.player,'inmovilizar');for(let i=0;i<31;i++)M.update(demo.state,.02);Hud.ui()",
  );
  assert.equal(a.get('main').inert, true);
  assert.equal(a.get('#combat-guidance').hidden, false);
  assert.match(a.get('#combat-actor-label').textContent, /inmovilizado/);
  assert.equal(a.get('#combat-action-label').textContent, 'Remover parálisis');
  run('Hud.showHelp();Hud.ui()');
  assert.equal(a.get('main').inert, false);
  assert.equal(a.get('#combat-guidance').hidden, true);
  let prevented = false;
  a.listeners.keydown({
    key: 'Escape',
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, false, 'the native help dialog must receive Escape');
  assert.equal(run('demo.state.tutorial.coach.current'), 'receivedInmovilizar');
  run('Hud.hideHelp();Hud.ui()');
  assert.equal(a.get('main').inert, true);
  assert(a.get('#combat-lesson').open);
  a.get('#combat-skip').onclick();
  assert.equal(a.get('main').inert, false);
  assert.equal(a.get('#combat-guidance').hidden, true);
});

test('phone coaching highlights visible vitals instead of the offscreen resource drawer', async () => {
  const a = app({ tutorial: true, width: 390, height: 844 });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('.mana-track').getBoundingClientRect = () => ({ left: 420, top: 100, width: 300, height: 20 });
  a.get('#mobile-vitals').getBoundingClientRect = () => ({ left: 240, top: 120, width: 120, height: 20 });
  run(
    "demo.state.tutorial.seen=M.guides.map(g=>g.id);M.enterArena(demo.state);M.startFight(demo.state);M.dismissCombatLesson(demo.state);M.resolveEnemySpell(demo.state,demo.state.player,'inmovilizar');for(let i=0;i<31;i++)M.update(demo.state,.02);Hud.ui()",
  );
  assert.equal(a.get('#combat-resource-outline').getAttribute('x'), '235');
  assert.equal(a.get('#combat-resource-outline').getAttribute('width'), '130');
  assert.equal(a.get('#combat-action-label').textContent, 'Remover parálisis');
});

test('pointer coordinates stay free over sprites and no aiming or NPC impact areas are drawn', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run(
    'Render.draw();demo.pointer={x:demo.width/2+(496-demo.state.player.x)*demo.scale,y:demo.height/2+(330-demo.state.player.y)*demo.scale};demo.state.armed=true',
  );
  assert.equal(run('Input.aimPoint().x'), 496);
  assert.equal(run('Input.aimPoint().y'), 330);
  assert.equal(run('Input.aimPoint().enemyId'), undefined);
  run('demo.state.enemies[0].wind=1;demo.state.enemies[0].aim={x:750,y:700};Render.draw()');
  assert(!a.geometry.some((args) => args[0] === 750 && args[1] === 700));
  assert(!a.geometry.some((args) => args[0] === 496 && args[1] === 330));
});

test('a configured potion macro works on its own key without a hardcoded F1 fallback', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  const event = (key) => ({ key, preventDefault() {}, target: { closest: () => false } });
  a.get('#resume').onclick();
  run('demo.macroBindings.life="f3"');
  a.listeners.keydown(event('F1'));
  assert.equal(run('demo.state.heldPotions.length'), 0);
  a.listeners.keydown(event('F3'));
  run('M.update(demo.state,.02)');
  assert.equal(run('demo.state.lifePotions'), 99);
  a.listeners.keyup(event('F3'));
  assert.equal(run('demo.state.heldPotions.length'), 0);
  assert.equal(run('demo.state.lifePotions'), 99);
});
test('holding space does not repeat casts', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run("demo.keys.add(' ');for(let i=0;i<30;i++)Loop.tick(i*20)");
  assert.equal(run('demo.state.fx.length'), 0);
});

test('Space and E act on release, and pause discards a held action', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  const event = (key) => ({ key, target: { closest: () => false }, preventDefault() {} });
  a.get('#resume').onclick();
  a.listeners.keydown(event(' '));
  assert.equal(run('demo.state.fx.length'), 0);
  a.listeners.keyup(event(' '));
  assert.equal(run('demo.state.fx.filter(f=>f.owner==="melee").length'), 1);
  run('M.drop(demo.state,demo.state.player.x,demo.state.player.y,10,"rival");demo.state.time=1');
  a.listeners.keydown(event('e'));
  assert.equal(run('demo.state.carried'), 0);
  a.listeners.keyup(event('e'));
  assert.equal(run('demo.state.carried'), 10);
  a.listeners.keydown(event('u'));
  run('Hud.showHelp();Hud.hideHelp()');
  a.listeners.keyup(event('u'));
  assert.equal(run('demo.state.lifePotions'), 100);
});

test('keyboard and touch movement keep working while a spell is prepared and cast', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run('demo.state.enemies=[{...demo.state.enemies[0],x:404,y:432,speed:0,cooldown:99}];Render.draw()');
  a.get('[data-dir=right]').pointerdown({ pointerId: 1, preventDefault() {} });
  run('Input.prepareSpell();M.update(demo.state,.04,Input.input())');
  const x = run('demo.state.player.x');
  run('Input.worldClick({clientX:demo.width/2+100*demo.scale,clientY:demo.height/2})');
  run('M.update(demo.state,.04,Input.input())');
  assert(run('demo.state.player.x') > x);
  assert.equal(run('demo.state.player.mana'), 85);
  assert(!run('demo.state.armed'));
  a.get('[data-dir=right]').pointercancel({ pointerId: 1 });
  assert.equal(run('Input.input().x'), 0);
});
test('Prepare arms without attacking and Escape cancels it', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  a.get('#prepare-spell').onclick();
  assert(run('demo.state.armed'));
  assert.equal(run('demo.state.fx.length'), 0);
  a.listeners.keydown({ key: 'Escape', target: { closest: () => false }, preventDefault() {} });
  assert(!run('demo.state.armed'));
  assert(!run('demo.paused'));
});
test('automatic banking updates HUD and renders a transfer stream', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run(
    'demo.state.carried=40;demo.state.bankUnlocked=true;demo.state.player.x=176;demo.state.player.y=752;for(let i=0;i<70;i++)M.update(demo.state,.02);Hud.ui();Render.draw()',
  );
  assert(run('demo.state.secured>0'));
  assert(run('demo.state.streamParticles.length>0'));
  assert.equal(a.get('#inventory-count').textContent, String(run('demo.state.carried')));
  assert.equal(a.get('#secured').textContent, String(run('demo.state.secured')));
  assert.match(a.get('#interact').innerHTML, /Drawing/);
  a.get('#restart').onclick();
  assert.equal(run('demo.state.secured'), 0);
});
test('drop sprite bounds are centered exactly on the logical tile', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run('M.drop(demo.state,501.1,553,5,"rival");Render.draw()');
  const drop = run('demo.state.drops[0]');
  const draw = a.draws.findLast((v) => v[0].srcPath?.endsWith('essence-pickup.png') && v[7] === 16 && v[8] === 32);
  assert(draw);
  assert.equal(draw[5] + draw[7] / 2, drop.x);
  assert.equal(draw[6] + draw[8] / 2, drop.y);
});

test('global auto-pot HUD reflects held macro use and inventory stock', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run('M.pressPotion(demo.state,"f1","life");M.update(demo.state,.02);Hud.ui()');
  assert.equal(a.get('#life-stock').textContent, '99');
  assert.equal(a.get('#mana-stock').textContent, '100');
  assert.equal(a.get('#life-inventory-count').textContent, '99');
  a.get('#autopot').change({ target: { checked: false } });
  assert.equal(run('demo.state.autopotEnabled'), false);
  a.windowEvents.blur();
  assert.equal(run('demo.state.heldPotions.length'), 0);
});

test('demo scale increases readability and feet align to actor anchor', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run('Render.draw()');
  assert(run('demo.scale>=1.25'));
  const call = a.draws.findLast(
    (v) => v[0].srcPath?.endsWith('hero.png') && v[7] === 60 && v[5] === run('demo.state.player.x-30'),
  );
  assert(call);
  const foot = call[6] + (159 / 160) * call[8];
  assert(Math.abs(foot - run('demo.state.player.y')) < 1);
});

test('embedded demo reports ready, returns via parent, and responds only to its parent', async () => {
  const a = app({ embedded: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  assert(a.posted.some((m) => m.type === 'entia-demo-ready'));
  run('Embed.returnToNix()');
  assert.equal(a.posted.at(-1).type, 'entia-demo-exit');
  a.windowEvents.message({ source: {}, origin: 'https://entia.test', data: { type: 'entia-demo-resume' } });
  assert(run('demo.paused'));
  a.windowEvents.message({ source: a.parentWindow, origin: 'https://entia.test', data: { type: 'entia-demo-resume' } });
  assert(!run('demo.paused'));
  a.windowEvents.message({ source: a.parentWindow, origin: 'https://entia.test', data: { type: 'entia-demo-pause' } });
  assert(run('demo.paused'));
  assert(run('demo.hostSuspended'));
  assert.equal(run('demo.raf'), 0);
});

test('walking into return portal requests exit once and reentry spawns clear of it', async () => {
  const a = app({ embedded: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run('demo.state.player.x=M.gateway.x;demo.state.player.y=M.gateway.y;Loop.tick(20);Loop.tick(40)');
  assert.equal(a.posted.filter((m) => m.type === 'entia-demo-exit').length, 1);
  a.windowEvents.message({ source: a.parentWindow, origin: 'https://entia.test', data: { type: 'entia-demo-resume' } });
  run('Loop.tick(60)');
  assert(!run('demo.returning'));
  assert(!run('M.nearGate(demo.state)'));
  assert.equal(a.posted.filter((m) => m.type === 'entia-demo-exit').length, 1);
});
test('mobile character drawer pauses combat and closes with its backdrop', async () => {
  const a = app({ width: 390, height: 700, coarse: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  a.get('#toggle-hud').onclick();
  assert(run('demo.hudDrawerOpen'));
  const time = run('demo.state.time');
  run('Loop.tick(100)');
  assert.equal(run('demo.state.time'), time);
  assert.equal(a.get('#hud-scrim').hidden, false);
  a.get('#hud-scrim').onclick();
  assert(!run('demo.hudDrawerOpen'));
  assert.equal(a.get('#hud-scrim').hidden, true);
  run('Loop.tick(120)');
  assert(run('demo.state.time') > time);
  assert(run('demo.scale>=.95'));
});
test('portrait and landscape phone geometry stays centered and readable', async () => {
  for (const [width, height] of [
    [390, 700],
    [844, 330],
  ]) {
    const a = app({ width, height, coarse: true });
    await new Promise((r) => setImmediate(r));
    const run = (s) => vm.runInContext(s, a.context);
    a.get('#resume').onclick();
    run('Render.draw()');
    assert.equal(run('demo.state.player.x*demo.scale+demo.ox'), width / 2);
    assert.equal(run('demo.state.player.y*demo.scale+demo.oy'), height / 2);
    assert(run('demo.scale>=.95'));
  }
});

test('saved character renders in demo and editor freezes combat', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run("Character.save({name:'Nyx',body:'mage'});Render.draw()");
  const call = a.draws.findLast((v) => v[0].srcPath?.endsWith('mage.png') && v[5] === run('demo.state.player.x-30'));
  assert(call);
  a.get('#character-button').onclick();
  const time = run('demo.state.time');
  run('Loop.tick(20)');
  assert.equal(run('demo.state.time'), time);
  a.get('#character-dialog').close();
  run('Loop.tick(40)');
  assert(run('demo.state.time') > time);
});

test('held touch movement survives preparing and casting with a second pointer', async () => {
  const a = app({ width: 390, height: 700, coarse: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  a.get('[data-dir=right]').pointerdown({ pointerId: 1, preventDefault() {} });
  assert.equal(run('Input.input().x'), 1);
  run(
    'demo.state.enemies[0].x=demo.state.player.x+(245-demo.width/2)/demo.scale;demo.state.enemies[0].y=demo.state.player.y',
  );
  a.get('#cast').click();
  assert.equal(run('Input.input().x'), 1);
  a.get('#game').pointerdown({ pointerType: 'touch', pointerId: 2, clientX: 245, clientY: 350, preventDefault() {} });
  a.get('#game').pointerup({ pointerType: 'touch', pointerId: 2, clientX: 245, clientY: 350, preventDefault() {} });
  assert.equal(run('Input.input().x'), 1);
  assert.equal(run('demo.state.player.mana'), 85);
  a.get('#game').click({ clientX: 245, clientY: 350 });
  assert.equal(run('demo.state.player.mana'), 85);
  run('Loop.tick(20)');
  assert(run('demo.state.player.x>304'));
  a.get('[data-dir=right]').pointerup({ pointerId: 1 });
  assert.equal(run('Input.input().x'), 0);
});
test('parent camera density is inherited exactly by embedded demo', async () => {
  const a = app({ embedded: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.windowEvents.message({
    source: a.parentWindow,
    origin: 'https://entia.test',
    data: { type: 'entia-demo-scale', presentationScale: 1.17 },
  });
  assert.equal(run('demo.scale'), 1.17);
  a.windowEvents.message({
    source: {},
    origin: 'https://entia.test',
    data: { type: 'entia-demo-scale', presentationScale: 2 },
  });
  assert.equal(run('demo.scale'), 1.17);
});
test('essence uses painter order instead of pickup outlines and elevated labels', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run('M.drop(demo.state,demo.state.player.x,demo.state.player.y,10,"player");demo.state.time=1;Render.draw()');
  const lastActor = a.draws.findLastIndex(
    (v) => v[0].srcPath?.endsWith('hero.png') && v[5] === run('demo.state.player.x-30'),
  );
  const drop = a.draws.findLastIndex((v) => v[0].srcPath?.endsWith('essence-pickup.png') && v[7] === 16);
  assert(drop > lastActor);
  const source = controllerSource();
  assert(!containsCode(source, 'PICK UP ${pickupAmount}'));
  assert(!containsCode(source, 'pickup-ready'));
});

test('secondary-pointer Prepare works without a synthesized click', async () => {
  const a = app({ width: 390, height: 700 });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  a.get('[data-dir=right]').pointerdown({ pointerId: 1, preventDefault() {} });
  const b = a.get('#cast');
  b.pointerdown({ pointerId: 2, button: 0, preventDefault() {} });
  b.pointerup({ pointerId: 2, preventDefault() {} });
  assert(run('demo.state.armed'));
  assert.equal(run('Input.input().x'), 1);
  a.get('[data-dir=right]').pointercancel({ pointerId: 1 });
  assert.equal(run('Input.input().x'), 0);
});
test('demo terrain restores after visibility and context recovery without progress reset', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run('demo.state.carried=27;demo.state.secured=20;Render.draw()');
  assert(run('demo.floorReady'));
  run('document.hidden=true');
  a.listeners.visibilitychange();
  run('document.hidden=false');
  a.listeners.visibilitychange();
  assert.equal(run('demo.floorReady'), false);
  run('Render.draw()');
  assert(run('demo.floorReady'));
  assert.equal(run('demo.state.carried'), 27);
  assert.equal(run('demo.state.secured'), 20);
  a.get('#game').contextrestored();
  assert.equal(run('demo.floorReady'), false);
});

test('direction dragging switches arrows and holds through thumb drift until release', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  for (const [direction, r] of Object.entries({
    up: { left: 50, top: 0, right: 100, bottom: 50 },
    right: { left: 100, top: 50, right: 150, bottom: 100 },
    down: { left: 50, top: 50, right: 100, bottom: 100 },
    left: { left: 0, top: 50, right: 50, bottom: 100 },
  }))
    a.get('[data-dir=' + direction + ']').getBoundingClientRect = () => r;
  const up = a.get('[data-dir=up]');
  up.pointerdown({ pointerId: 8, pointerType: 'touch', preventDefault() {} });
  assert.equal(run('Input.input().y'), -1);
  up.pointermove({ pointerId: 8, pointerType: 'touch', clientX: 120, clientY: 75, preventDefault() {} });
  assert.equal(run('Input.input().x'), 1);
  up.pointermove({ pointerId: 8, pointerType: 'touch', clientX: 170, clientY: 75, preventDefault() {} });
  assert.equal(run('Input.input().x'), 1);
  a.windowEvents.pointerup({ pointerId: 8 });
  assert.equal(run('demo.touches.size'), 0);
});
test('touch release cannot clear held keyboard and last finger cleanup is safe', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run("demo.keys.add('w')");
  const up = a.get('[data-dir=up]');
  for (const id of [1, 2]) up.pointerdown({ pointerId: id, pointerType: 'touch', preventDefault() {} });
  a.windowEvents.pointerup({ pointerId: 1 });
  assert.equal(run('Input.input().y'), -1);
  run('demo.keys.clear()');
  assert.equal(run('Input.input().y'), -1);
  a.windowEvents.touchend({ touches: [] });
  assert.equal(run('Input.input().y'), 0);
  run("demo.keys.add('w')");
  up.pointerdown({ pointerId: 3, pointerType: 'touch', preventDefault() {} });
  a.windowEvents.pointercancel({ pointerId: 3 });
  assert.equal(run('Input.input().y'), -1);
});
test('long stationary hold needs no timeout, lifecycle and native gestures release safely', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  const up = a.get('[data-dir=up]');
  up.pointerdown({ pointerId: 1, pointerType: 'touch', preventDefault() {} });
  run('demo.state.time+=10');
  assert.equal(run('Input.input().y'), -1);
  a.windowEvents.orientationchange();
  assert.equal(run('Input.input().y'), 0);
  up.pointerdown({ pointerId: 2, pointerType: 'touch', preventDefault() {} });
  a.windowEvents.pagehide();
  assert.equal(run('demo.touches.size'), 0);
  let prevented = false;
  a.get('.dpad').touchstart({
    cancelable: true,
    preventDefault() {
      prevented = true;
    },
  });
  assert(prevented);
  const html = fs.readFileSync(path.join(__dirname, '../demo/index.html'), 'utf8');
  assert(!containsCode(html, '>↑</button>'));
  assert(containsCode(html, 'class="direction-arrow"'));
});

test('control-panel events stop before map and outside release cannot cast', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run('Input.prepareSpell()');
  let stopped = false;
  a.get('#control-deck').pointerup({
    stopPropagation() {
      stopped = true;
    },
  });
  assert(stopped);
  run('Input.worldClick({clientX:550,clientY:900})');
  assert.equal(run('demo.state.player.mana'), 100);
  assert(run('demo.state.armed'));
  run(
    'demo.state.enemies[0].x=demo.state.player.x+(600-demo.width/2)/demo.scale;demo.state.enemies[0].y=demo.state.player.y;Input.worldClick({clientX:600,clientY:400})',
  );
  assert.equal(run('demo.state.player.mana'), 85);
});
test('deposit status explains locked, carrying and secured states on mobile', async () => {
  const a = app({ width: 390, height: 450 });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run('Hud.ui()');
  assert.match(a.get('#deposit-status').textContent, /Bank locked/);
  run('demo.state.bankUnlocked=true;demo.state.carried=10;Hud.ui()');
  assert.match(a.get('#deposit-status').textContent, /Carrying 10/);
  run('demo.state.carried=0;demo.state.secured=10;Hud.ui()');
  assert.match(a.get('#deposit-status').textContent, /10 essence secured/);
});

test('mobile Prepare and cast do not steal focus or change camera geometry', async () => {
  const a = app({ width: 390, height: 400, coarse: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  let focused = 0;
  a.get('#game').focus = () => focused++;
  run('Render.draw()');
  const before = run('[demo.width,demo.height,demo.ox,demo.oy].join()');
  run('Input.prepareSpell();Hud.ui();Render.draw()');
  assert.equal(focused, 0);
  assert.equal(run('[demo.width,demo.height,demo.ox,demo.oy].join()'), before);
  run('Input.worldClick({clientX:240,clientY:200});Hud.ui();Render.draw()');
  assert.equal(focused, 0);
  assert.equal(run('[demo.width,demo.height,demo.ox,demo.oy].join()'), before);
  const css = fs.readFileSync(path.join(__dirname, '../src/demo/demo.css'), 'utf8');
  assert(containsCode(css, "#control-deck #target-help[data-armed='false'] { visibility: hidden; }"));
  assert(containsCode(css, 'height:32px;min-height:32px;max-height:32px'));
});
test('unchanged resize notifications do not reset the canvas bitmap', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context),
    canvas = a.get('#game');
  let writes = 0,
    w = canvas.width,
    h = canvas.height;
  Object.defineProperty(canvas, 'width', {
    get: () => w,
    set: (v) => {
      w = v;
      writes++;
    },
  });
  Object.defineProperty(canvas, 'height', {
    get: () => h,
    set: (v) => {
      h = v;
      writes++;
    },
  });
  run('Render.resize();Render.resize()');
  assert.equal(writes, 0);
});

test('thumb gaps and far drift retain a hold while another finger casts, then release stops it', async () => {
  const a = app({ width: 390, height: 400, coarse: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  const up = a.get('[data-dir=up]');
  up.getBoundingClientRect = () => ({ left: 50, top: 0, right: 96, bottom: 46 });
  up.pointerdown({ pointerId: 1, pointerType: 'touch', preventDefault() {} });
  for (const [clientX, clientY] of [
    [98, 25],
    [45, 48],
    [220, 140],
  ]) {
    up.pointermove({ pointerId: 1, pointerType: 'touch', clientX, clientY, preventDefault() {} });
    assert.equal(run('Input.input().y'), -1);
  }
  const cast = a.get('#cast');
  cast.pointerdown({ pointerId: 2, button: 0, preventDefault() {} });
  cast.pointerup({ pointerId: 2, preventDefault() {} });
  a.windowEvents.pointerup({ pointerId: 2 });
  assert.equal(run('Input.input().y'), -1);
  a.windowEvents.pointerup({ pointerId: 1 });
  assert.equal(run('Input.input().y'), 0);
});
test('phone notices are pinned to the bottom edge without changing playfield height', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/demo/demo.css'), 'utf8');
  assert(containsCode(css, '.playfield #message{top:auto;bottom:8px;'));
  assert(containsCode(css, 'max-height:52px;overflow:hidden'));
});

test('joystick has a dead zone, cardinal steering and independent casting release', async () => {
  const a = app({ width: 390, height: 400, coarse: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  const j = a.get('#joystick');
  j.getBoundingClientRect = () => ({ left: 10, top: 20, width: 112, height: 112 });
  const e = (id, x, y) => ({
    pointerId: id,
    pointerType: 'touch',
    button: 0,
    clientX: x,
    clientY: y,
    preventDefault() {},
  });
  j.pointerdown(e(1, 66, 76));
  assert.equal(run('Input.input().x'), 0);
  j.pointermove(e(1, 112, 76));
  assert.equal(run('Input.input().x'), 1);
  assert.equal(run('Input.input().y'), 0);
  j.pointermove(e(1, 160, 20));
  assert.equal(run('Input.input().x'), 1);
  j.pointermove(e(1, 66, 28));
  assert.equal(run('Input.input().y'), -1);
  j.pointerdown(e(2, 18, 76));
  assert.equal(run('demo.joystickPointer'), 1);
  a.windowEvents.pointerup({ pointerId: 2 });
  assert.equal(run('Input.input().y'), -1);
  j.pointermove(e(1, 66, 76));
  assert.equal(run('Input.input().y'), 0);
  j.pointermove(e(1, 66, 28));
  j.lostpointercapture({ pointerId: 1 });
  assert.equal(run('Input.input().y'), 0);
  assert.equal(run('demo.joystickPointer'), null);
  assert.equal(a.get('#joystick-thumb').style.transform, 'translate(0px,0px)');
});
test('joystick cleanup recentres on lifecycle cancellation', async () => {
  const a = app({ coarse: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  const j = a.get('#joystick');
  j.getBoundingClientRect = () => ({ left: 0, top: 0, width: 112, height: 112 });
  j.pointerdown({ pointerId: 3, pointerType: 'touch', clientX: 100, clientY: 56, preventDefault() {} });
  assert.equal(run('Input.input().x'), 1);
  a.windowEvents.pagehide();
  assert.equal(run('demo.joystickPointer'), null);
  assert.equal(run('Input.input().x'), 0);
});
test('life bars sit below the feet with clamped red fill', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  const fills = [];
  run('Context.ctx').fillRect = (...v) => fills.push(v);
  run('Render.resourceBar({x:100,y:200},50,100)');
  assert.deepEqual(fills[0], [77, 212, 46, 8]);
  assert.deepEqual(fills[3], [79, 214, 21, 4]);
  run('Render.resourceBar({x:100,y:200},-10,100)');
  assert.equal(fills.at(-2)[2], 0);
});

test('mana bar sits below life and follows remaining mana', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context),
    fills = [];
  const ctx = run('Context.ctx');
  ctx.fillRect = (...v) => fills.push({ v, color: ctx.fillStyle });
  run('Render.resourceBar({x:100,y:200},25,100,22,true)');
  assert.deepEqual(fills[0].v, [77, 222, 46, 8]);
  assert.equal(fills[3].v[2], 11);
  assert.equal(fills[3].color, '#1687ba');
  const source = fs.readFileSync(path.join(__dirname, '../src/demo/render.ts'), 'utf8');
  assert(containsCode(source, 'resourceBar(p,p.mana,100,22,true)'));
});

test('actual tutorial starts in the hall without the old help overlay and renders guide dialogue', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  assert.equal(run('demo.state.phase'), 'hallway');
  assert(!a.get('#help-dialog').open);
  run('for(let i=0;i<40;i++)Loop.tick(i*20);Render.draw();Hud.ui()');
  assert(!a.get('#guide-dialog').open);
  run("M.talk(demo.state,'warden');Hud.syncGuide()");
  assert(a.get('#guide-dialog').open);
  assert.equal(a.get('#guide-name').textContent, 'The Warden');
  const x = run('demo.state.player.x');
  run("demo.keys.add('d');Loop.tick(40)");
  assert.equal(run('demo.state.player.x'), x);
  a.get('#guide-next').onclick();
  a.get('#guide-next').onclick();
  assert(!a.get('#guide-dialog').open);
  assert.equal(run('demo.state.tutorial.seen.length'), 1);
});
test('tutorial HUD and final NPC completion are usable on phone', async () => {
  const a = app({ tutorial: true, width: 390, height: 700, coarse: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run(
    'for(const g of M.guides){M.talk(demo.state,g.id);while(demo.state.tutorial.dialog)M.nextGuide(demo.state);}M.enterArena(demo.state);M.skipCombatLessons(demo.state);M.startFight(demo.state);demo.state.kills=2;M.update(demo.state,.02);Hud.ui()',
  );
  assert.match(a.get('#objective-label').textContent, /BANK/);
  run(
    'demo.state.enemies.forEach(e=>{e.hp=0;e.respawn=999});demo.state.player.x=M.bankAt(demo.state).x;demo.state.player.y=M.bankAt(demo.state).y+64;demo.state.carried=10;for(let i=0;i<150;i++)M.update(demo.state,.02);Hud.ui();Render.draw()',
  );
  assert.equal(run('demo.state.tutorial.stage'), 'complete');
  assert(a.get('#guide-dialog').open);
  assert.equal(a.get('#guide-title').textContent, 'Tutorial finished');
  for (let i = 0; i < 4; i++) a.get('#guide-next').onclick();
  assert(!a.get('#guide-dialog').open);
  assert(!a.get('#tutorial-end').hidden);
  a.get('#tutorial-replay').onclick();
  assert.equal(run('demo.state.phase'), 'hallway');
  assert.equal(run('demo.state.secured'), 0);
});
test('embedded tutorial is suspended before handshake and releases canvas surfaces on exit', async () => {
  const a = app({ tutorial: true, embedded: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  assert(run('demo.hostSuspended'));
  assert.equal(run('Context.floor.width'), 1);
  assert.equal(run('demo.raf'), 0);
  a.windowEvents.message({
    source: a.parentWindow,
    origin: 'https://entia.test',
    data: { type: 'entia-demo-activate' },
  });
  assert(!run('demo.hostSuspended'));
  assert(run('demo.raf') > 0);
  a.windowEvents.message({ source: a.parentWindow, origin: 'https://entia.test', data: { type: 'entia-demo-pause' } });
  assert.equal(run('Context.canvas.width'), 1);
  assert.equal(run('Context.floor.width'), 1);
  assert.equal(run('demo.raf'), 0);
  a.windowEvents.pageshow();
  assert.equal(run('Context.floor.width'), 1);
  a.windowEvents.message({ source: a.parentWindow, origin: 'https://entia.test', data: { type: 'entia-demo-resume' } });
  assert(run('Context.canvas.width') > 1);
  assert.equal(run('demo.state.phase'), 'hallway');
});
test('canvas pixel budget bounds large display allocations', async () => {
  const a = app({ width: 4000, height: 3000 });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run('Render.resize()');
  assert(run('Context.canvas.width*Context.canvas.height') <= 2003000);
});
test('activation after a loading-time pause does not freeze the tutorial invisibly', async () => {
  const a = app({ tutorial: true, embedded: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.windowEvents.message({ source: a.parentWindow, origin: 'https://entia.test', data: { type: 'entia-demo-pause' } });
  assert(run('demo.paused'));
  a.windowEvents.message({
    source: a.parentWindow,
    origin: 'https://entia.test',
    data: { type: 'entia-demo-activate' },
  });
  assert(!run('demo.paused'));
  assert(!run('demo.hostSuspended'));
  run('for(let i=0;i<40;i++)Loop.tick(i*20)');
  assert(!a.get('#guide-dialog').open);
  assert(run('demo.state.time') > 0);
});

test('arena entrance motion pauses simulation briefly and releases without a timer leak', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context),
    animations = [];
  a.get('#chapter-cue').animate = (frames, options) => {
    const x = {
      frames,
      options,
      cancel() {
        this.cancelled = true;
      },
    };
    animations.push(x);
    return x;
  };
  run(
    'Motion.syncMotion(0);for(const g of M.guides){M.talk(demo.state,g.id);while(demo.state.tutorial.dialog)M.nextGuide(demo.state);}M.enterArena(demo.state);M.skipCombatLessons(demo.state);M.startFight(demo.state);Motion.syncMotion(100)',
  );
  assert.equal(run('demo.beatUntil'), 950);
  const before = run('demo.state.time');
  run('Loop.tick(300)');
  assert.equal(run('demo.state.time'), before);
  assert.equal(a.get('#cue-title').textContent, 'Beyond the Veil');
  run('Loop.tick(1000)');
  assert(run('demo.state.time') > before);
  animations[0].onfinish();
  assert(a.get('#chapter-cue').hidden);
  assert.equal(run('demo.motionHandles.size'), 0);
});
test('motion cleanup cancels active handles and clears blocking presentation state', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  let cancelled = 0;
  a.get('#chapter-cue').animate = () => ({
    cancel() {
      cancelled++;
    },
  });
  run("Motion.chapterCue('TEST','Title','Text',100);demo.guideHoldUntil=950;Motion.cancelMotion()");
  assert.equal(cancelled, 1);
  assert.equal(run('demo.beatUntil'), 0);
  assert.equal(run('demo.guideHoldUntil'), 0);
  assert.equal(run('demo.motionHandles.size'), 0);
  assert(a.get('#chapter-cue').hidden);
});
test('NPC card animation only restarts when speaker or page changes', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  let count = 0;
  a.get('#guide-text').animate = () => {
    count++;
    return { cancel() {} };
  };
  run("M.talk(demo.state,'warden');Hud.syncGuide();Hud.syncGuide();Hud.syncGuide()");
  assert.equal(count, 1);
  a.get('#guide-next').onclick();
  assert.equal(count, 2);
});
test('reduced motion skips chapter delay and does not allocate animation handles', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#chapter-cue').animate = () => {
    throw Error('must not animate');
  };
  run("Context.reduced.matches=true;Motion.chapterCue('TEST','Title','Text',100)");
  assert.equal(run('demo.beatUntil'), 0);
  assert(a.get('#chapter-cue').hidden);
  assert.equal(run('demo.motionHandles.size'), 0);
});
test('completion animation interrupted by pause waits to show the final Keeper', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  let effect;
  a.get('#chapter-cue').animate = () => (effect = { cancel() {} });
  run(
    "demo.motionStage='deposit';demo.state.tutorial.stage='complete';M.talk(demo.state,'final');Motion.syncMotion(100);Hud.showHelp();demo.presentationNow=2000;Hud.syncGuide()",
  );
  assert(a.get('#help-dialog').open);
  assert(!a.get('#guide-dialog').open);
  effect.onfinish();
  assert(!a.get('#guide-dialog').open);
  run('Hud.hideHelp();Hud.syncGuide()');
  assert(a.get('#guide-dialog').open);
});
test('delayed native effects hold their starting state before stagger begins', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  let options;
  a.get('#guide-text').animate = (frames, o) => {
    options = o;
    return { cancel() {} };
  };
  run("M.talk(demo.state,'warden');Hud.syncGuide()");
  assert.equal(options.fill, 'backwards');
  assert(options.delay > 0);
});

test('floor click beside an NPC walks; only the NPC sprite opens a conversation', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run(
    'Render.draw();Input.worldClick({clientX:demo.width/2+90*demo.scale,clientY:demo.oy+demo.state.player.y*demo.scale});',
  );
  assert(run('!!demo.state.navigation'));
  assert.equal(run('demo.state.tutorial.dialog'), null);
  run(
    'M.cancelWalk(demo.state);Input.worldClick({clientX:demo.width/2+64*demo.scale,clientY:demo.oy+(demo.state.player.y-90)*demo.scale})',
  );
  assert.equal(run('demo.state.tutorial.dialog.id'), 'warden');
  assert(a.get('#guide-dialog').open);
});
test('spell clicks preserve a walking route and toggling Prepare cancels only aiming', async () => {
  const a = app();
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  a.get('#resume').onclick();
  run('Render.draw();Input.worldClick({clientX:demo.width/2+100*demo.scale,clientY:demo.height/2})');
  assert(run('!!demo.state.navigation'));
  run(
    'demo.state.enemies[0].x=404;demo.state.enemies[0].y=432;demo.state.enemies[0].speed=0;demo.state.enemies[0].cooldown=99;Input.prepareSpell()',
  );
  assert(run('!!demo.state.navigation'));
  run('Input.worldClick({clientX:demo.width/2+100*demo.scale,clientY:demo.height/2})');
  assert.equal(run('demo.state.player.mana'), 85);
  assert(run('!!demo.state.navigation'));
  assert(!run('demo.state.armed'));
  const x = run('demo.state.player.x');
  run('M.update(demo.state,.04)');
  assert(run('demo.state.player.x') > x);
  run('Input.prepareSpell();Input.prepareSpell()');
  assert(!run('demo.state.armed'));
});
test('hall masonry covers the entire viewport rather than a fixed black rectangle', async () => {
  const a = app({ tutorial: true, width: 2400, height: 1600 });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run('Render.draw()');
  const tiles = a.draws.filter((args) => args[0] === run('demo.images.stone'));
  assert(tiles.some((args) => args[1] < 0));
  assert(tiles.some((args) => args[2] < 0));
  assert(tiles.some((args) => args[1] > 576));
});
test('movement opens each nearby lesson automatically while floor clicks remain movement orders', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run('Render.draw();Input.worldClick({clientX:demo.width/2+180*demo.scale,clientY:demo.height/2})');
  assert(!a.get('#guide-dialog').open);
  run('for(let i=1;i<80;i++)Loop.tick(i*20)');
  assert(a.get('#guide-dialog').open);
  assert.equal(a.get('#guide-name').textContent, 'The Warden');
  assert.equal(run('demo.state.navigation'), null);
  a.get('#guide-next').onclick();
  a.get('#guide-next').onclick();
  run('for(let i=80;i<160;i++)Loop.tick(i*20)');
  assert(!a.get('#guide-dialog').open);
});
test('columns sit one tile higher and the replacement gateway spans the corridor depth', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run('Render.draw()');
  const columns = a.draws.filter((args) => args[0] === run('demo.images.hallColumn'));
  assert.equal(columns.length, 4);
  assert(columns.every((args) => args[2] === 268));
  const portal = a.draws.find((args) => args[0] === run('demo.images.hallPortal'));
  assert.equal(portal[2], 260);
  assert.equal(portal[4], 276);
});
test('hall framing keeps the complete portal and floor visible on short and tall screens', async () => {
  for (const [width, height] of [
    [1100, 400],
    [390, 320],
    [1100, 800],
  ]) {
    const a = app({ tutorial: true, width, height });
    await new Promise((r) => setImmediate(r));
    const run = (s) => vm.runInContext(s, a.context);
    run('Render.draw()');
    assert(run('demo.oy+M.hallway.portal.y*demo.scale') >= 0);
    assert(run('demo.oy+(M.hallway.floor.y+M.hallway.floor.h+16)*demo.scale') <= height);
    const before = run('demo.state.player.x');
    run('Input.worldClick({clientX:demo.ox+220*demo.scale,clientY:demo.oy+464*demo.scale})');
    assert(run('demo.state.navigation.points.some(p=>Math.abs(p.x-220)<.001)'));
    assert.equal(run('demo.state.tutorial.dialog'), null);
    assert.equal(run('demo.state.player.x'), before);
  }
});
test('desktop activation focuses the game and accepts movement without a click', async () => {
  const a = app({ tutorial: true, embedded: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  let focus = 0;
  a.get('#game').focus = () => focus++;
  a.windowEvents.message({
    source: a.parentWindow,
    origin: 'https://entia.test',
    data: { type: 'entia-demo-activate' },
  });
  assert.equal(focus, 1);
  a.listeners.keydown({ key: 'd', target: { closest: () => false }, preventDefault() {} });
  const x = run('demo.state.player.x');
  run('Loop.tick(20)');
  assert(run('demo.state.player.x') > x);
});
test('finishing a guide hands focus back to the map, not a hidden button', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  let focus = 0;
  a.get('#game').focus = () => focus++;
  run("M.talk(demo.state,'warden');Hud.syncGuide()");
  a.get('#guide-next').onclick();
  assert.equal(focus, 0);
  a.get('#guide-next').onclick();
  assert.equal(focus, 1);
  assert(!a.get('#guide-dialog').open);
});
test('focus recovery never steals input from a modal or suspended/phone view', async () => {
  for (const coarse of [false, true]) {
    const a = app({ tutorial: true, coarse });
    await new Promise((r) => setImmediate(r));
    const run = (s) => vm.runInContext(s, a.context);
    let focus = 0;
    a.get('#game').focus = () => focus++;
    run(
      "M.talk(demo.state,'warden');Hud.syncGuide();Hud.focusGame();demo.state.tutorial.dialog=null;demo.hostSuspended=true;Hud.focusGame();demo.hostSuspended=false;demo.paused=true;Hud.focusGame()",
    );
    assert.equal(focus, 0);
    if (coarse) {
      run("demo.paused=false;Context.$('#guide-dialog').close();Hud.focusGame()");
      assert.equal(focus, 0);
    }
  }
});
test('activation before artwork finishes transfers focus when loading completes', async () => {
  const a = app({ tutorial: true, embedded: true });
  let focused = 0;
  a.get('#game').focus = () => focused++;
  a.windowEvents.message({
    source: a.parentWindow,
    origin: 'https://entia.test',
    data: { type: 'entia-demo-activate' },
  });
  assert.equal(focused, 0);
  await new Promise((r) => setImmediate(r));
  assert.equal(focused, 1);
});
test('character editor close finishes with map focus rather than overriding it with its trigger', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  let focused = '';
  a.get('#game').focus = () => (focused = 'game');
  a.get('#character-button').focus = () => (focused = 'button');
  a.get('#character-button').onclick();
  a.get('#character-close').onclick();
  assert.equal(focused, 'game');
});
test('role NPC sheets stay on the idle column even if an actor carries moving state', async () => {
  const a = app({ tutorial: true });
  await new Promise((r) => setImmediate(r));
  const run = (s) => vm.runInContext(s, a.context);
  run("Render.actor({x:100,y:200,dir:3,moving:true,gait:90},'npc-game')");
  const call = a.draws.at(-1);
  assert.equal(call[1], 0);
  assert.equal(call[2], 480);
  assert.equal(call[3], 96);
  assert.equal(call[4], 160);
});
