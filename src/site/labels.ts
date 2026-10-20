import { worldToScreen } from './camera.ts';
import { $, site } from './context.ts';
import { requestDraw } from './loop.ts';
import { hero, keepers, spots } from './town.ts';

// Match the client's active NativeWorldTextGlyph renderer with real Inter text.
export function setGameText(element: HTMLElement, text: string) {
  if (element.dataset.gameText === text) return;
  element.dataset.gameText = text;
  element.textContent = text;
  element.classList.add('game-text');
}
export function bindLabels() {
  // Labels are real buttons, so the same spell works with mouse, touch and keyboard.
  for (const keeper of keepers) {
    const button = document.createElement('button');
    button.className = 'keeper';
    button.dataset.place = keeper.place;
    button.dataset.cast = 'true';
    button.setAttribute('aria-label', `Open ${keeper.section}`);
    button.innerHTML = `<span class="keeper-label"><strong>${keeper.section}</strong><small class="keeper-clan">&lt;${keeper.clan}&gt;</small></span><span class="keeper-hit" aria-hidden="true"><svg class="target-reticle" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="13"/><path d="M24 3v13m0 16v13M3 24h13m16 0h13"/></svg></span>`;
    setGameText(button.querySelector('strong')!, keeper.section);
    button.addEventListener('pointerenter', () => {
      site.hovered = keeper.place;
      requestDraw();
    });
    button.addEventListener('pointerleave', () => {
      site.hovered = null;
      requestDraw();
    });
    button.addEventListener('focus', () => {
      site.hovered = keeper.place;
      requestDraw();
    });
    button.addEventListener('blur', () => {
      site.hovered = null;
      requestDraw();
    });
    $('#locations').append(button);
    keeper.button = button;
  }
  setGameText($('#player-label span'), 'YOU');
}
export function positionLabels() {
  for (const k of keepers) {
    const p = worldToScreen(k);
    k.button.style.transform = `translate3d(${Math.round(p.x)}px,${Math.round(p.y)}px,0) translate(-50%, -100%)`;
    // The hit target covers the sprite; CSS anchors its name below the feet.
    (k.button.querySelector('.keeper-hit') as HTMLElement).style.height = `${Math.round(64 * site.scale)}px`;
  }
  const p = worldToScreen(hero);
  const crowded = keepers.some((k) => {
    const q = worldToScreen(k);
    return Math.abs(q.x - p.x) < 100 && Math.abs(q.y - p.y) < 50;
  });
  $('#player-label').style.transform = crowded
    ? `translate3d(${Math.round(p.x)}px,${Math.round(p.y - 77 * site.scale)}px,0) translate(-50%,-100%)`
    : `translate3d(${Math.round(p.x)}px,${Math.round(p.y + 3)}px,0) translateX(-50%)`;
  $('#player-label').dataset.placement = crowded ? 'above' : 'below';
  const destination = worldToScreen(spots[site.current]);
  $('#keeper-reply').style.transform =
    `translate3d(${Math.round(destination.x)}px,${Math.round(destination.y - 64 * site.scale - 58)}px,0) translate(-50%,-100%)`;
}
export function updateKeeperStates() {
  for (const k of keepers) {
    const active = k.place === site.current;
    k.button.classList.toggle('selected', active);
    if (active) k.button.setAttribute('aria-current', 'location');
    else k.button.removeAttribute('aria-current');
    setGameText(k.button.querySelector('.keeper-clan') as HTMLElement, `<${active ? 'Now' : k.clan}>`);
  }
}
