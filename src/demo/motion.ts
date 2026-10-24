import { $, demo, reduced } from './context.ts';
import { syncGuide } from './hud.ts';
import { clear } from './input.ts';
import { schedule } from './loop.ts';

// Anime.js-inspired sequencing, stagger and easing with the browser's native animation API.
// Every effect is bounded and cancelled on suspension/replay; no new RAF or snapshot canvas.
export function motion(element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions = {}) {
  if (!element || reduced.matches || typeof element.animate !== 'function') return;
  demo.motionHandles.get(element)?.cancel();
  const a = element.animate(keyframes, {
    duration: 420,
    easing: 'cubic-bezier(.22,1,.36,1)',
    fill: 'backwards',
    ...options,
  });
  demo.motionHandles.set(element, a);
  a.onfinish = () => {
    if (demo.motionHandles.get(element) === a) demo.motionHandles.delete(element);
  };
}
export function cancelMotion() {
  for (const a of demo.motionHandles.values()) a.cancel();
  demo.motionHandles.clear();
  demo.beatUntil = 0;
  demo.guideHoldUntil = 0;
  $('#chapter-cue').hidden = true;
}
export function resetMotion() {
  cancelMotion();
  demo.motionStage = null;
  demo.dialogKey = '';
  demo.revealStart = -1;
  demo.completeStart = -1;
}
export function chapterCue(kicker: string, title: string, detail: string, now: number) {
  const panel = $('#chapter-cue');
  $('#cue-kicker').textContent = kicker;
  $('#cue-title').textContent = title;
  $('#cue-detail').textContent = detail;
  panel.hidden = false;
  if (reduced.matches) {
    panel.hidden = true;
    demo.beatUntil = 0;
    return;
  }
  demo.beatUntil = now + 850;
  if (typeof panel.animate !== 'function') {
    panel.hidden = true;
    return;
  }
  motion(panel, [{ opacity: 1 }, { opacity: 1, offset: 0.48 }, { opacity: 0 }], { duration: 1000, easing: 'ease-out' });
  for (const [i, id] of ['#cue-kicker', '#cue-title', '#cue-detail'].entries())
    motion(
      $(id),
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 500, delay: i * 90 },
    );
  const handle = demo.motionHandles.get(panel);
  if (handle)
    handle.onfinish = () => {
      demo.motionHandles.delete(panel);
      panel.hidden = true;
      if (demo.guideHoldUntil) {
        demo.guideHoldUntil = 0;
        if (
          !demo.paused &&
          !demo.hostSuspended &&
          !document.hidden &&
          !$('#help-dialog').open &&
          !$('#character-dialog').open
        ) {
          syncGuide();
          schedule();
        }
      }
    };
}
export function syncMotion(now: number) {
  const t = demo.state.tutorial;
  if (!t) return;
  const key = t.stage;
  if (key === demo.motionStage) return;
  const old = demo.motionStage;
  demo.motionStage = key;
  if (key === 'hallway' && old === null) {
    motion(
      $('.objective'),
      [
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 650 },
    );
    for (let i = 0; i < 4; i++)
      motion($('#journey-' + i), [{ opacity: 0 }, { opacity: 1 }], { duration: 450, delay: 80 * i });
  } else if (key === 'fight' && (old === 'hallway' || old === 'setup' || old === 'melee' || old === 'spells')) {
    clear();
    chapterCue('CHAPTER II', 'Beyond the Veil', 'Two rivals. One choice: risk it or secure it.', now);
  } else if (key === 'deposit') {
    demo.revealStart = demo.state.time;
    motion($('.objective'), [
      { opacity: 0.2, transform: 'translateY(-9px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ]);
    motion($('#deposit-status'), [{ color: '#eddfb0' }, { color: '#a8c6b3' }], { duration: 1400 });
  } else if (key === 'complete') {
    demo.completeStart = demo.state.time;
    if (!reduced.matches && typeof $('#chapter-cue').animate === 'function') {
      demo.guideHoldUntil = now + 1000;
      chapterCue('TRAINING COMPLETE', 'Essence secured', 'You carried the risk. Now you know the way.', now);
    }
    motion(
      $('#tutorial-end'),
      [
        { opacity: 0, transform: 'translate(-50%,12px)' },
        { opacity: 1, transform: 'translate(-50%,0)' },
      ],
      { duration: 600 },
    );
  }
}
export function animateGuide(first: boolean) {
  const items = first
    ? ['#guide-portrait-wrap', '#guide-name', '#guide-title', '#guide-text', '#guide-actions']
    : ['#guide-text', '#guide-actions'];
  for (const [i, id] of items.entries())
    motion(
      $(id),
      [
        { opacity: 0, transform: 'translateY(9px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 360, delay: i * 55 },
    );
}
