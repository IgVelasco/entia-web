import { test, expect, type Page } from './fixtures.ts';

// Every combat test goes through the real movement, hit and continue gate.
export async function completeMeleePractice(page: Page, { clockPaused = false, includeSpells = true } = {}) {
  // Combat cases now traverse both drills, including three real cast recoveries.
  test.setTimeout(Math.max(test.info().timeout, 45_000));
  if (clockPaused) await page.clock.runFor(20);
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'melee');
  await expect(page.locator('#practice-continue')).toBeDisabled();
  await page.locator('#game').focus();
  await page.keyboard.down('d');
  if (clockPaused) await page.clock.runFor(600);
  await expect(page.locator('#movement-status')).toContainText('Entrenador');
  await page.keyboard.up('d');
  await page.locator((page.viewportSize()?.width || 1280) <= 760 ? '#mobile-strike' : '#strike').click();
  if (clockPaused) await page.clock.runFor(20);
  await expect(page.locator('#practice-continue')).toBeEnabled();
  await page.locator('#practice-continue').click();
  if (clockPaused) await page.clock.runFor(20);
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'spells');
  if (includeSpells) await completeSpellPractice(page, { clockPaused });
}

export async function castPracticeSpell(
  page: Page,
  target: 'trainer' | 'self' | 'empty',
  { clockPaused = false } = {},
) {
  if (clockPaused) await page.clock.runFor(1500);
  else await expect(page.locator('#spell-status')).not.toContainText('Recovering');
  const prepare = page.locator((page.viewportSize()?.width || 1280) <= 760 ? '#cast' : '#prepare-spell');
  if ((await prepare.getAttribute('aria-pressed')) !== 'true') await prepare.click();
  if (clockPaused) await page.clock.runFor(40);
  const canvas = page.locator('#game'),
    bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('Missing practice canvas');
  const width = page.viewportSize()?.width || 1280;
  const scale = Math.max(0.95, Math.min(width / 700, 1.32));
  await canvas.click({
    position: {
      x: bounds.width / 2 + (target === 'trainer' ? 160 * scale : 0),
      y: bounds.height / 2 + (target === 'empty' ? 60 : 0),
    },
  });
  if (clockPaused) await page.clock.runFor(40);
}

export async function completeSpellPractice(page: Page, { clockPaused = false } = {}) {
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'spells');
  await castPracticeSpell(page, 'trainer', { clockPaused });
  await expect(page.locator('#objective')).toHaveText('1 / 3 hechizos practicados');
  await castPracticeSpell(page, 'trainer', { clockPaused });
  if (clockPaused) await page.clock.runFor(1500);
  await expect(page.locator('#movement-status')).toContainText('Inmovilizado');
  await castPracticeSpell(page, 'self', { clockPaused });
  await expect(page.locator('#practice-continue')).toBeEnabled();
  await page.locator('#practice-continue').click();
  if (clockPaused) await page.clock.runFor(40);
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'fight');
}
