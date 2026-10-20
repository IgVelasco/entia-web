import * as WorldPhysics from '../shared/physics.ts';
import type { Point } from '../shared/physics.ts';
import { $, canvas, clamp, compactMode, site } from './context.ts';
import { resetJoystick } from './input.ts';
import { positionLabels } from './labels.ts';
import { requestDraw } from './loop.ts';
import { hero, keepers } from './town.ts';

export const camera = { x: 870, y: 470, targetX: 870, targetY: 470 };
export const worldToScreen = (p: Point) => ({ x: p.x * site.scale + site.ox, y: p.y * site.scale + site.oy });
export function viewport() {
  const compact = compactMode(),
    left = compact ? 0 : clamp(site.width * 0.33, 320, 450);
  const sceneHeight = site.height;
  if (compact && site.frontierState.open && site.frontierWizard) {
    const s = site.frontierSequence!;
    site.scale = s.viewScale * Math.min(site.width / s.viewWidth, site.height / s.viewHeight);
    const px = ((hero.x + site.frontierWizard.x) / 2) * site.scale + s.viewOx,
      py = ((hero.y + site.frontierWizard.y) / 2) * site.scale + s.viewOy;
    s.viewOx += clamp(px, Math.min(80, site.width * 0.25), site.width - Math.min(80, site.width * 0.25)) - px;
    s.viewOy += clamp(py, Math.min(180, sceneHeight * 0.4), Math.max(sceneHeight - 140, sceneHeight * 0.55)) - py;
    site.ox = s.viewOx;
    site.oy = s.viewOy;
  } else if (compact) {
    // Fit all four destination actors and their labels; walking cannot pan one out of view.
    const leftEdge = Math.min(...keepers.map((k) => k.x)) - 100,
      rightEdge = Math.max(...keepers.map((k) => k.x)) + 100;
    const topEdge = Math.min(...keepers.map((k) => k.y)) - 115,
      bottomEdge = Math.max(...keepers.map((k) => k.y)) + 95;
    site.scale =
      Math.min((site.width - 32) / (rightEdge - leftEdge), (sceneHeight - 76) / (bottomEdge - topEdge)) *
      Math.min(1, site.zoom);
    camera.x = camera.targetX = (leftEdge + rightEdge) / 2;
    camera.y = camera.targetY = (topEdge + bottomEdge) / 2;
    site.ox = site.width / 2 - camera.x * site.scale;
    site.oy = (sceneHeight - 44) / 2 - camera.y * site.scale;
    if (site.mobileExploring) {
      // Keep a stable overview until walking nears its edge, then follow gently.
      const px = hero.x * site.scale + site.ox + site.mobilePanX,
        py = hero.y * site.scale + site.oy + site.mobilePanY;
      site.mobilePanX += clamp(px, Math.min(90, site.width * 0.25), site.width - Math.min(90, site.width * 0.25)) - px;
      site.mobilePanY +=
        clamp(py, Math.min(160, sceneHeight * 0.38), Math.max(sceneHeight - 150, sceneHeight * 0.5)) - py;
      site.ox += site.mobilePanX;
      site.oy += site.mobilePanY;
    }
  } else {
    site.scale = WorldPhysics.presentationScale(site.width, site.zoom);
    camera.x = camera.targetX = hero.x;
    camera.y = camera.targetY = hero.y;
    site.ox = left + (site.width - left) / 2 - hero.x * site.scale;
    site.oy = sceneHeight / 2 - hero.y * site.scale;
  }
}
export function resize() {
  resetJoystick();
  const rect = canvas.getBoundingClientRect();
  site.width = rect.width;
  site.height = rect.height;
  site.dpr = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2000000 / Math.max(1, site.width * site.height)));
  if (!site.demoOpen) {
    if (canvas.width !== Math.round(site.width * site.dpr)) canvas.width = Math.round(site.width * site.dpr);
    if (canvas.height !== Math.round(site.height * site.dpr)) canvas.height = Math.round(site.height * site.dpr);
  }
  viewport();
  positionLabels();
  requestDraw();
  if (site.demoOpen)
    $('#demo-frame').contentWindow?.postMessage(
      { type: 'entia-demo-scale', presentationScale: site.scale },
      location.origin,
    );
}
