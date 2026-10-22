import { test, expect, openDemo, openSite, transformOf } from './fixtures.ts';

test.describe('Nix site on a phone', () => {
  test('shows the touch controls instead of the section column', async ({ page }) => {
    await openSite(page);
    await expect(page.locator('#mobile-joystick')).toBeVisible();
    await expect(page.getByRole('button', { name: 'About Nix and this preview' })).toBeVisible();
    await expect(page.locator('#main-content')).toBeHidden();
    await expect(page.locator('#movement-help')).toBeHidden();
  });

  test('a section opens as zone information that can be closed', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSite(page);
    await page.locator('.nav', { hasText: 'Game' }).tap();
    await expect(page).toHaveURL(/#arena$/);
    const zone = page.getByRole('dialog', { name: 'Zone information' });
    await expect(zone).toBeVisible();
    await expect(zone.locator('#section-heading')).toHaveText(/^PvP with something\s*at stake\.$/);
    await expect(page.getByRole('button', { name: 'Close zone information' })).toBeFocused();
    await page.getByRole('button', { name: 'Close zone information' }).tap();
    await expect(zone).toBeHidden();
    await expect(page.locator('#location-name')).toHaveText('Game');
  });

  test('the about button opens the preview notes', async ({ page }) => {
    await openSite(page);
    await page.getByRole('button', { name: 'About Nix and this preview' }).tap();
    await expect(page.getByRole('dialog', { name: 'About this preview' })).toBeVisible();
    await page.getByRole('button', { name: 'Close notes' }).tap();
    await expect(page.getByRole('dialog', { name: 'About this preview' })).toBeHidden();
  });

  test('dragging the joystick walks the player', async ({ page }) => {
    await openSite(page);
    const before = await transformOf(page, '#player-label');
    const pad = await page.locator('#joystick-pad').boundingBox();
    if (!pad) throw new Error('joystick has no box');
    const x = pad.x + pad.width / 2,
      y = pad.y + pad.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y, { steps: 4 });
    await expect(page.locator('#location-state')).toHaveText('Exploring Nix');
    await expect.poll(() => transformOf(page, '#player-label')).not.toBe(before);
    await page.mouse.up();
  });
});

test.describe('offline demo on a phone', () => {
  test('the pause menu opens all key bindings on a phone and safely transfers E to a spell', async ({ page }) => {
    await openDemo(page);
    await page.locator('#pause').tap();
    await page.locator('#help-bindings').tap();
    const editor = page.locator('#bindings-dialog');
    await expect(editor).toBeVisible();
    await expect(editor.locator('[data-bind]')).toHaveCount(11);
    await editor.locator('[data-bind="apocalipsis"]').tap();
    await page.keyboard.press('e');
    await expect(page.locator('#bindings-error')).toContainText('Hablar');
    await page.locator('#bindings-reassign').tap();
    await expect(editor.locator('[data-bind="apocalipsis"]')).toHaveText('E');
    await page.locator('#bindings-close').tap();
    await expect(page.locator('#help-dialog')).toBeVisible();
    await page.locator('#resume').tap();
    await expect(page.locator('#help-dialog')).toBeHidden();
    await expect(page.locator('#macro-spell')).toHaveAttribute('aria-label', 'Apocalipsis · E');
  });

  test('safe preparation keeps each highlighted section above the lesson and offers window-only play', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openDemo(page);
    for (let i = 0; i < 4; i++) {
      const stick = await page.locator('#joystick').boundingBox();
      if (!stick) throw new Error('thumbstick has no box');
      const x = stick.x + stick.width / 2,
        y = stick.y + stick.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 30, y);
      if (i < 3) {
        await expect(page.locator('#guide-dialog')).toBeVisible();
        await page.mouse.up();
        await page.locator('#guide-next').tap();
        await page.locator('#guide-next').tap();
      } else {
        await expect(page.locator('#controls-lesson')).toBeVisible();
        await page.mouse.up();
      }
    }
    for (const section of ['.spells-window', '.inventory-window', '.macrobar']) {
      const target = page.locator(`${section}.lesson-target`);
      await expect(target).toBeVisible();
      const box = await target.boundingBox(),
        lesson = await page.locator('.lesson-card').boundingBox();
      if (!box || !lesson) throw new Error('preparation panel has no box');
      expect(box.y).toBeGreaterThanOrEqual(60);
      expect(box.y + box.height).toBeLessThanOrEqual(lesson.y);
      await page.locator('#setup-next').tap();
    }
    await page.locator('#setup-windows').tap();
    await expect(page.locator('#setup-summary')).toContainText('No hay teclas');
    await page.locator('#setup-experienced').tap();
    await page.locator('#setup-start').tap();
    await expect(page.locator('#controls-lesson')).toBeHidden();
    await expect(page.locator('#cast')).toBeEnabled();
  });

  test('holding the thumbstick right walks to the first guide', async ({ page }) => {
    await openDemo(page);
    await expect(page.locator('.mobile-controls')).toBeVisible();
    await expect(page.locator('#objective')).toHaveText('0 / 3 guides met');
    const stick = await page.getByRole('button', { name: /^Movement joystick/ }).boundingBox();
    if (!stick) throw new Error('thumbstick has no box');
    const x = stick.x + stick.width / 2,
      y = stick.y + stick.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(page.locator('#joystick')).toHaveAttribute('data-active', 'true');
    await page.mouse.move(x + 30, y, { steps: 3 });
    await expect(page.locator('#guide-dialog')).toBeVisible();
    await expect(page.locator('#joystick')).toHaveAttribute('data-active', 'false');
    await page.mouse.up();
    await expect(page.locator('#guide-name')).toHaveText('The Warden');
  });
});
