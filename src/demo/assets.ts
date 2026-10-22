import { $, demo } from './context.ts';
import { notifyParent } from './embed.ts';
import { focusGame, showHelp } from './hud.ts';
import { schedule } from './loop.ts';
import { buildFloor, drawInventoryIcon, resize } from './render.ts';
import spellArt from './spell-art.json';

const assets = {
  'npc-movement': 'npc/movement-idle-v4.png',
  'npc-game': 'npc/game-idle-v4.png',
  'npc-bank': 'npc/bank-idle-v4.png',
  hallCarpet: 'hall-carpet.png',
  hallColumn: 'hall-column.png',
  hallPortal: 'hall-portal-straight.png',
  hero: 'hero.png',
  rogue: 'rogue.png',
  mage: 'mage.png',
  grass: 'grass.png',
  path: 'path.png',
  stone: 'stone.png',
  portal: 'portal.png',
  bank: 'banking-coffer.png',
  essence: 'essence-pickup.png',
  spellApocalipsis: spellArt.apocalipsis.asset,
  spellBind: spellArt.inmovilizar.asset,
};
function loadImage(name: string, file: string) {
  return new Promise<void>((resolve, reject) => {
    let shared;
    try {
      shared = demo.embedded && window.parent.EntiaArtwork?.[name];
    } catch {}
    if (shared) {
      demo.images[name] = shared;
      resolve();
      return;
    }
    const im = new Image();
    im.onload = async () => {
      try {
        if (typeof createImageBitmap === 'function' && (name === 'bank' || name === 'essence')) {
          const crop: [number, number, number, number] =
            name === 'bank' ? [230, 255, 1075, 555] : [300, 230, 480, 1010];
          const size = name === 'bank' ? [216, 112] : [32, 64];
          demo.images[name] = await createImageBitmap(im, ...crop, {
            resizeWidth: size[0],
            resizeHeight: size[1],
            resizeQuality: 'pixelated',
          });
          im.onload = null;
          im.src = '';
        } else demo.images[name] = im;
        resolve();
      } catch {
        demo.images[name] = im;
        resolve();
      }
    };
    im.onerror = () => reject(Error(file));
    im.src = '../assets/' + file;
  });
}
export async function load() {
  demo.ready = false;
  $('#retry').hidden = true;
  $('#curtain').hidden = false;
  $('#curtain-title').textContent = 'Opening the portal…';
  try {
    for (const [n, f] of Object.entries(assets)) await loadImage(n, f);
    if (!demo.hostSuspended && demo.state.phase !== 'hallway') buildFloor();
    demo.ready = true;
    $('#curtain').hidden = true;
    drawInventoryIcon();
    resize();
    if (!demo.state.tutorial) showHelp(true);
    focusGame();
    notifyParent('entia-demo-ready');
    schedule();
  } catch {
    $('#curtain-title').textContent = 'The portal could not open';
    $('#curtain-text').textContent = 'An artwork file did not load. Please try again.';
    $('#retry').hidden = false;
    notifyParent('entia-demo-error');
  }
}
