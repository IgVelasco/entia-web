import { expect, type Page } from './fixtures.ts';

// Every combat test goes through the real movement, hit and continue gate.
export async function completeMeleePractice(page: Page, { clockPaused = false } = {}) {
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
  await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'fight');
}
