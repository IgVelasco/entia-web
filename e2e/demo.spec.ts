import { completeMeleePractice, completeSpellPractice, castPracticeSpell } from './practice.ts';
import { test, expect, openDemo, openSite, type Page } from './fixtures.ts';

const guides = ['The Warden', 'The Arcanist', 'The Keeper'];

// Reads each line of the open guide dialog until it closes.
async function readGuide(page: Page, name: string) {
  const dialog = page.locator('#guide-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#guide-name')).toHaveText(name);
  await expect(page.locator('#guide-step')).toHaveText('1 / 2');
  await expect(page.locator('#guide-next')).toHaveText('Continue');
  await page.locator('#guide-next').click();
  await expect(page.locator('#guide-step')).toHaveText('2 / 2');
  await expect(page.locator('#guide-next')).toHaveText('Understood');
  await page.locator('#guide-next').click();
  await expect(dialog).toBeHidden();
}

// Walks right along the hallway; each unmet guide speaks as the player reaches them.
async function meetAllGuides(page: Page) {
  for (const [index, name] of guides.entries()) {
    await page.keyboard.down('d');
    await expect(page.locator('#guide-dialog')).toBeVisible();
    await page.keyboard.up('d');
    await readGuide(page, name);
    await expect(page.locator('#objective')).toHaveText(`${index + 1} / 3 guides met`);
  }
}

async function enterPreparation(page: Page) {
  await meetAllGuides(page);
  await page.keyboard.down('d');
  await expect(page.locator('#controls-lesson')).toBeVisible();
  await page.keyboard.up('d');
}
async function enterArena(page: Page) {
  await enterPreparation(page);
  await page.locator('#setup-next').click();
  await page.locator('#setup-next').click();
  await page.locator('#setup-example').click();
  await page.locator('#setup-next').click();
  await page.locator('#setup-experienced').click();
  await page.locator('#setup-start').click();
  await completeMeleePractice(page);
  await expect(page.locator('#chapter')).toHaveText('THE VEIL / ARENA');
}

test.describe('offline demo', () => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    test(`first entry asks about movement before guides and remembers the answer at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto('/demo/');
      await expect(page.locator('#curtain')).toBeHidden();
      const prompt = page.locator('#movement-choice-dialog');
      await expect(prompt).toBeVisible();
      await expect(page.locator('#guide-dialog')).toBeHidden();
      await expect(page.locator('#objective')).toHaveText('0 / 3 guides met');
      await page.keyboard.press('Escape');
      await expect(prompt).toBeVisible();
      await page.keyboard.press('d');
      await expect(page.locator('#guide-dialog')).toBeHidden();
      await page.locator('#movement-click-no').click();
      await expect(prompt).toBeHidden();
      await page.reload();
      await expect(page.locator('#curtain')).toBeHidden();
      await page.locator('#pause').click();
      await page.locator('#help-bindings').click();
      await expect(prompt).toBeHidden();
      await expect(page.locator('#bindings-click-no')).toHaveAttribute('aria-pressed', 'true');
      await page.locator('#bindings-close').click();
      await page.locator('#resume').click();
      await page.keyboard.down('d');
      await expect(page.locator('#guide-dialog')).toBeVisible();
      await page.keyboard.up('d');
      await expect(page.locator('#guide-name')).toHaveText('The Warden');
    });
  }

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    test(`movement notices never resize the map or page at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openDemo(page);
      const time = new Date('2026-10-22T12:00:00Z');
      await page.clock.install({ time });
      await page.clock.pauseAt(new Date(time.getTime() + 10000));
      const before = await page.locator('#game').boundingBox();
      const pageHeight = await page.locator('body').evaluate((el) => el.scrollHeight);
      const notice = page.locator('#movement-status');
      await notice.evaluate((el) => {
        el.removeAttribute('hidden');
        el.textContent = 'Inmovilizado · 3 s · Usá Remover parálisis o esperá.';
      });
      await expect(notice).toBeVisible();
      await expect(notice).toHaveCSS('position', 'absolute');
      await expect(notice).toHaveCSS('color', 'rgb(243, 205, 146)');
      expect(await page.locator('#game').boundingBox()).toEqual(before);
      expect(await page.locator('body').evaluate((el) => el.scrollHeight)).toEqual(pageHeight);
      await notice.evaluate((el) => {
        el.setAttribute('hidden', '');
      });
      expect(await page.locator('#game').boundingBox()).toEqual(before);
    });
  }

  test('loads the original particle and immobilization artwork', async ({ page }) => {
    const loaded: string[] = [];
    page.on('response', (response) => {
      if (response.ok()) loaded.push(new URL(response.url()).pathname);
    });
    await openDemo(page);
    expect(loaded).toContain('/assets/spells/apocalipsis-particle-127.png');
    expect(loaded).toContain('/assets/spells/inmovilizar-fx-12.png');
    expect(loaded).not.toContain('/assets/apocalipsis_60.png');
  });

  test('boots in the tutorial hallway with full resources', async ({ page }) => {
    await openDemo(page);
    await expect(page.locator('#game')).toBeVisible();
    await expect(page.locator('#chapter')).toHaveText('THE VEIL / FIRST STEPS');
    await expect(page.locator('#objective-label')).toHaveText('MEET YOUR GUIDES');
    await expect(page.locator('#objective')).toHaveText('0 / 3 guides met');
    await expect(page.locator('#health')).toHaveText('100 / 100');
    await expect(page.locator('#mana')).toHaveText('100 / 100');
    await expect(page.locator('#journey-0')).toHaveAttribute('data-state', 'current');
    await expect(page.locator('#prepare-spell')).toBeDisabled();
    await expect(page.locator('#help-dialog')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Change character: Avharot' })).toBeVisible();
  });

  test('E talks to the nearby guide, and finishing the dialog counts the guide as met', async ({ page }) => {
    await openDemo(page);
    await expect(page.locator('#interact')).toHaveText('Talk to The Warden · E');
    await expect(page.locator('#game')).toBeFocused();
    await page.keyboard.down('e');
    await expect(page.locator('#guide-dialog')).toBeHidden();
    await page.keyboard.up('e');
    await readGuide(page, 'The Warden');
    await expect(page.locator('#objective')).toHaveText('1 / 3 guides met');
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    for (const width of [1280, 390]) {
      test(`spell exercise requires Apocalipsis, Inmovilizar and self Remover at ${width}px`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
        await openDemo(page);
        await enterPreparation(page);
        await page.locator('#setup-windows').click();
        await page.locator('#setup-experienced').click();
        const time = new Date('2026-10-23T12:00:00Z');
        await page.clock.install({ time });
        await page.clock.pauseAt(new Date(time.getTime() + 10000));
        await page.locator('#setup-start').click();
        await completeMeleePractice(page, { clockPaused: true, includeSpells: false });
        await expect(page.locator('#practice-continue')).toBeDisabled();
        await expect(page.locator('.spell-list [aria-selected="true"]')).toHaveCount(1);
        await expect(page.locator('[data-spell="apocalipsis"]')).toHaveAttribute('aria-selected', 'true');
        if (width === 1280) {
          await page.locator('[data-spell="apocalipsis"]').focus();
          await page.keyboard.press('ArrowDown');
          await expect(page.locator('[data-spell="inmovilizar"]')).toHaveAttribute('aria-selected', 'true');
          await page.keyboard.press('ArrowUp');
        }
        await castPracticeSpell(page, 'empty', { clockPaused: true });
        await expect(page.locator('#objective')).toHaveText('0 / 3 hechizos practicados');
        await expect(page.locator('#mana')).toHaveText('100 / 100');
        await castPracticeSpell(page, 'trainer', { clockPaused: true });
        await expect(page.locator('#objective')).toHaveText('1 / 3 hechizos practicados');
        await expect(page.locator('#mana')).toHaveText('85 / 100');
        await expect(page.locator('[data-spell="inmovilizar"]')).toHaveAttribute('aria-selected', 'true');
        await castPracticeSpell(page, 'trainer', { clockPaused: true });
        await page.clock.runFor(1500);
        await expect(page.locator('#objective')).toHaveText('2 / 3 hechizos practicados');
        await expect(page.locator('#mana')).toHaveText('65 / 100');
        await expect(page.locator('#movement-status')).toContainText('Inmovilizado');
        await expect(page.locator('#practice-description')).toContainText('sobre tu figura o tus pies');
        await castPracticeSpell(page, 'trainer', { clockPaused: true });
        await expect(page.locator('#objective')).toHaveText('2 / 3 hechizos practicados');
        await expect(page.locator('#practice-continue')).toBeDisabled();
        await page.clock.runFor(5000);
        await expect(page.locator('#movement-status')).toContainText('Inmovilizado');
        await castPracticeSpell(page, 'self', { clockPaused: true });
        await expect(page.locator('#objective')).toHaveText('3 / 3 hechizos practicados');
        await expect(page.locator('#mana')).toHaveText('55 / 100');
        await expect(page.locator('#movement-status')).toBeHidden();
        await expect(page.locator('#practice-continue')).toBeEnabled();
        if (width === 390) await page.locator('#toggle-hud').click();
        await page.clock.runFor(100);
        const potionBounds = await page.locator('#life-potion').boundingBox();
        expect(potionBounds?.height).toBeGreaterThanOrEqual(40);
        await expect(page.locator('.spell-list [aria-selected="true"]')).toHaveCount(1);
        const spellListBounds = await page.locator('.spell-list').boundingBox();
        expect(spellListBounds).not.toBeNull();
        for (const key of ['apocalipsis', 'inmovilizar', 'remover']) {
          await expect(page.locator(`[data-spell="${key}"]`)).toBeInViewport();
          const caption = await page.locator(`[data-spell="${key}"] .spell-copy small`).boundingBox();
          expect(caption).not.toBeNull();
          expect(caption!.y + caption!.height).toBeLessThanOrEqual(spellListBounds!.y + spellListBounds!.height);
        }
        await testInfo.attach('spell-practice-and-selector', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        if (width === 390) await page.locator('#toggle-hud').click();
        await page.locator('#practice-continue').click();
        await page.clock.runFor(40);
        await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'fight');
        await expect(page.locator('#mana')).toHaveText('100 / 100');
      });
    }

    for (const width of [1280, 390]) {
      test(`melee practice explains the assigned key and requires a real hit at ${width}px`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
        await openDemo(page);
        await page.locator('#pause').click();
        await page.locator('#help-bindings').click();
        await page.locator('#bindings-dialog [data-bind="strike"]').click();
        await page.keyboard.press('j');
        await page.locator('#bindings-close').click();
        await page.locator('#resume').click();
        await enterPreparation(page);
        await page.locator('#setup-windows').click();
        await page.locator('#setup-experienced').click();
        const time = new Date('2026-10-23T12:00:00Z');
        await page.clock.install({ time });
        await page.clock.pauseAt(new Date(time.getTime() + 1000));
        await page.locator('#setup-start').click();
        await page.clock.runFor(20);
        const panel = page.locator('#melee-practice');
        await expect(panel).toBeVisible();
        await expect(panel).toContainText('hacia donde mirás, no hacia el cursor');
        await expect(page.locator('#practice-instructions')).toContainText('tu tecla J');
        await expect(page.locator('#practice-continue')).toBeDisabled();
        await expect(page.locator('#prepare-spell')).toBeDisabled();
        await expect(page.locator('#objective')).toHaveText('0 / 1 golpe acertado');
        await page.keyboard.press('j');
        await page.clock.runFor(20);
        await expect(page.locator('#objective')).toHaveText('0 / 1 golpe acertado');
        await expect(page.locator('#practice-continue')).toBeDisabled();
        await page.locator('#game').focus();
        await page.keyboard.down('d');
        await page.clock.runFor(600);
        await page.keyboard.up('d');
        await page.clock.runFor(1000);
        if (width === 390) await page.locator('#mobile-strike').click();
        else await page.keyboard.press('j');
        await page.clock.runFor(20);
        await expect(page.locator('#practice-status')).toContainText('¡Golpe acertado!');
        await expect(page.locator('#objective')).toHaveText('1 / 1 golpe acertado');
        await expect(page.locator('#practice-continue')).toBeEnabled();
        await expect(page.locator('#practice-continue')).toBeInViewport();
        const field = await page.locator('.playfield').boundingBox();
        const card = await panel.boundingBox();
        if (!field || !card) throw new Error('Missing practice layout');
        expect(field.height).toBeGreaterThan(200);
        expect(card.y).toBeGreaterThanOrEqual(field.y + field.height);
        await page.clock.runFor(100);
        await testInfo.attach('melee-practice-completed', { body: await page.screenshot(), contentType: 'image/png' });
        await page.locator('#practice-continue').click();
        await page.clock.runFor(20);
        await completeSpellPractice(page, { clockPaused: true });
        await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'fight');
        await expect(panel).toBeHidden();
        await expect(page.locator('#prepare-spell')).toBeEnabled();
      });
    }

    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      test(`combat explanations stay at the bottom, including misses at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openDemo(page);
        await enterPreparation(page);
        await page.locator('#setup-windows').click();
        await page.locator('#setup-start').click();
        await completeMeleePractice(page);
        const card = page.locator('#combat-lesson');
        const assertBottom = async () => {
          await expect(card).toBeVisible();
          const bounds = await card.boundingBox();
          if (!bounds) throw new Error('Missing combat explanation');
          expect(bounds.y).toBeGreaterThan(viewport.height * 0.35);
          expect(bounds.y + bounds.height).toBeGreaterThan(viewport.height - 24);
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
          await expect(page.locator('#combat-continue')).toBeInViewport();
          await expect(page.locator('#combat-skip')).toBeInViewport();
          const toast = await page.locator('#message').boundingBox();
          const field = await page.locator('.playfield').boundingBox();
          if (!toast || !field) throw new Error('Missing combat feedback');
          expect(field.y + field.height - toast.y - toast.height).toBeGreaterThanOrEqual(0);
          expect(field.y + field.height - toast.y - toast.height).toBeLessThanOrEqual(12);
        };
        await assertBottom();
        const time = new Date('2026-10-23T12:00:00Z');
        await page.clock.install({ time });
        await page.clock.pauseAt(new Date(time.getTime() + 1000));
        await page.locator('#combat-continue').click();
        await page.locator(viewport.width <= 760 ? '#cast' : '#prepare-spell').click();
        const canvas = page.locator('#game');
        const bounds = await canvas.boundingBox();
        if (!bounds) throw new Error('Missing game canvas');
        await canvas.click({ position: { x: bounds.width / 2 + 55, y: bounds.height / 2 } });
        await expect(page.locator('#combat-title')).toHaveText('El intento no acertó');
        await assertBottom();
      });
    }

    test('Sentinel reaches the player for melee and potion counters remain unlimited', async ({ page }) => {
      await openDemo(page);
      await enterPreparation(page);
      await page.locator('#setup-windows').click();
      await page.locator('#setup-experienced').click();
      const time = new Date('2026-10-23T12:00:00Z');
      await page.clock.install({ time });
      await page.clock.pauseAt(new Date(time.getTime() + 1000));
      await page.locator('#setup-start').click();
      await completeMeleePractice(page, { clockPaused: true });
      for (const id of ['life-stock', 'mana-stock', 'life-inventory-count', 'mana-inventory-count'])
        await expect(page.locator('#' + id)).toHaveText('∞');
      for (let i = 0; i < 40; i++) {
        await page.clock.runFor(200);
        if ((await page.locator('#message').textContent())?.includes('Sentinel te golpeó cuerpo a cuerpo')) break;
      }
      await expect(page.locator('#message')).toContainText('Sentinel te golpeó cuerpo a cuerpo');
      await expect(page.locator('#health')).not.toHaveText('100 / 100');
      await page.locator('#life-potion').dblclick();
      await page.clock.runFor(20);
      await expect(page.locator('#health')).toHaveText('100 / 100');
      await page.clock.runFor(300);
      await page.locator('#mana-potion').dblclick();
      await page.clock.runFor(20);
      await expect(page.locator('#mana')).toHaveText('100 / 100');
      await expect(page.locator('#life-stock')).toHaveText('∞');
      await expect(page.locator('#mana-stock')).toHaveText('∞');
    });

    test('Ctrl and Shift can be assigned on their own and survive reload', async ({ page }) => {
      await openDemo(page);
      await page.locator('#controls-options').click();
      const editor = page.locator('#bindings-dialog');
      await editor.locator('[data-bind="apocalipsis"]').click();
      await page.keyboard.press('Control');
      await expect(editor.locator('[data-bind="apocalipsis"]')).toHaveText('Ctrl');
      await editor.locator('[data-bind="mana"]').click();
      await page.keyboard.press('Shift');
      await expect(editor.locator('[data-bind="mana"]')).toHaveText('Shift');
      await page.reload();
      await expect(page.locator('#curtain')).toBeHidden();
      await expect(page.locator('#macro-spell')).toHaveAttribute('aria-label', 'Apocalipsis · Ctrl');
      await expect(page.locator('#macro-mana')).toHaveAttribute('aria-label', 'Poción de maná · Shift');
    });

    test('a Ctrl-prepared spell hits the visible chest above the foot tile without cursor snapping', async ({
      page,
    }) => {
      await openDemo(page);
      await enterPreparation(page);
      await page.locator('#setup-next').click();
      await page.locator('#setup-next').click();
      await page.locator('#setup-bindings [data-bind="apocalipsis"]').click();
      await page.keyboard.press('Control');
      await page.locator('#setup-next').click();
      await page.locator('#setup-experienced').click();
      const time = new Date('2026-10-23T12:00:00Z');
      await page.clock.install({ time });
      await page.clock.pauseAt(new Date(time.getTime() + 10000));
      await page.locator('#setup-start').click();
      await completeMeleePractice(page, { clockPaused: true });
      await page.clock.runFor(20);
      await page.keyboard.press('Control');
      await page.clock.runFor(20);
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'true');
      const canvas = page.locator('#game');
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error('Missing game canvas');
      const scale = 1.32;
      await canvas.click({
        position: { x: bounds.width / 2 + (496 - 304) * scale, y: bounds.height / 2 + (368 - 40 - 432) * scale },
      });
      await expect(page.locator('#mana')).toHaveText('85 / 100');
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'false');
      await expect(canvas).toHaveCSS('cursor', 'default');
      await page.clock.runFor(100);
      await expect(page.locator('#mana')).toHaveText('85 / 100');
    });

    test('click movement can be disabled, persists after reload, and can be enabled again', async ({ page }) => {
      await openDemo(page);
      await page.locator('#controls-options').click();
      await page.locator('#bindings-click-no').click();
      await expect(page.locator('#bindings-click-no')).toHaveAttribute('aria-pressed', 'true');
      await page.reload();
      await expect(page.locator('#curtain')).toBeHidden();
      const time = new Date('2026-10-22T12:00:00Z');
      await page.clock.install({ time });
      await page.clock.pauseAt(new Date(time.getTime() + 10000));
      await page.locator('#controls-options').click();
      await expect(page.locator('#bindings-click-no')).toHaveAttribute('aria-pressed', 'true');
      await page.locator('#bindings-close').click();
      const canvas = page.locator('#game');
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error('Missing game canvas');
      const position = { x: bounds.width / 2 + 180, y: bounds.height / 2 };
      await canvas.click({ position });
      await page.clock.runFor(1500);
      await expect(page.locator('#guide-dialog')).toBeHidden();
      await expect(page.locator('#objective')).toHaveText('0 / 3 guides met');
      await page.locator('#controls-options').click();
      await page.locator('#bindings-click-yes').click();
      await page.locator('#bindings-close').click();
      await canvas.click({ position });
      await page.clock.runFor(1500);
      await expect(page.locator('#guide-dialog')).toBeVisible();
      await expect(page.locator('#guide-name')).toHaveText('The Warden');
    });

    test('saved assignments survive reload and another visit, including keys left unbound', async ({ page }) => {
      await openDemo(page);
      await page.locator('#controls-options').click();
      const editor = page.locator('#bindings-dialog');
      await editor.locator('[data-bind="apocalipsis"]').click();
      await page.keyboard.press('e');
      await page.locator('#bindings-reassign').click();
      await editor.locator('[data-bind="interact"]').click();
      await page.keyboard.press('g');
      await editor.locator('[data-bind="mana"]').click();
      await page.keyboard.press('F4');
      await editor.locator('[data-clear-macro="pickup"]').click();
      await page.reload();
      await expect(page.locator('#curtain')).toBeHidden();
      await expect(page.locator('#macro-spell')).toHaveAttribute('aria-label', 'Apocalipsis · E');
      await expect(page.locator('#macro-mana')).toHaveAttribute('aria-label', 'Poción de maná · F4');
      await page.locator('#controls-options').click();
      await expect(editor.locator('[data-bind="interact"]')).toHaveText('G');
      await expect(editor.locator('[data-bind="pickup"]')).toHaveText('Asignar');
      await editor.locator('[data-clear-macro="apocalipsis"]').click();
      const later = await page.context().newPage();
      await openDemo(later);
      await expect(later.locator('#macro-spell')).toHaveAttribute('aria-label', 'Apocalipsis · sin tecla');
      await expect(later.locator('#macro-mana')).toHaveAttribute('aria-label', 'Poción de maná · F4');
      await later.close();
    });

    test('all bindings can reopen and E can move from interaction to casting without a double action', async ({
      page,
    }) => {
      await openDemo(page);
      await enterPreparation(page);
      await page.locator('#setup-next').click();
      await page.locator('#setup-next').click();
      await page.locator('#setup-bindings [data-bind="apocalipsis"]').click();
      await page.keyboard.press('e');
      await expect(page.locator('#setup-error')).toContainText('Hablar / recoger / interactuar');
      await page.locator('#setup-reassign').click();
      await expect(page.locator('#setup-bindings [data-bind="apocalipsis"]')).toHaveText('E');
      await page.locator('#setup-all-bindings').click();
      const editor = page.locator('#bindings-dialog');
      await expect(editor).toBeVisible();
      await expect(editor.locator('[data-bind]')).toHaveCount(11);
      await expect(editor.locator('[data-bind="interact"]')).toHaveText('Asignar');
      await expect(editor).toContainText('automáticamente');
      await editor.locator('[data-bind="interact"]').click();
      await page.keyboard.press('g');
      await expect(editor.locator('[data-bind="interact"]')).toHaveText('G');
      await page.locator('#bindings-close').click();
      await page.locator('#setup-next').click();
      await page.locator('#setup-experienced').click();
      const time = new Date('2026-10-23T12:00:00Z');
      await page.clock.install({ time });
      await page.clock.pauseAt(new Date(time.getTime() + 10000));
      await page.locator('#setup-start').click();
      await completeMeleePractice(page, { clockPaused: true });
      await page.keyboard.press('e');
      await page.clock.runFor(40);
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#help-dialog')).toBeHidden();
      await page.locator('#controls-options').click();
      await expect(editor.locator('[data-bind="apocalipsis"]')).toHaveText('E');
      await expect(editor.locator('[data-bind="interact"]')).toHaveText('G');
      await page.locator('#bindings-close').click();
      await page.keyboard.press('Escape');
      await page.clock.runFor(40);
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'false');
    });

    test('new players see an actual miss explanation, can read safely, then skip future coaching', async ({ page }) => {
      await openDemo(page);
      await enterPreparation(page);
      await page.locator('#setup-windows').click();
      await page.locator('#setup-start').click();
      await completeMeleePractice(page);
      await expect(page.locator('#combat-title')).toHaveText('Un clic, un casillero');
      await expect(page.locator('#combat-description')).toContainText('no se cargan ni cubren un área');
      await expect(page.locator('main')).toHaveAttribute('inert', '');
      await expect(page.locator('#combat-guidance')).toBeVisible();
      await expect(page.locator('#combat-action-label')).toHaveText('Apocalipsis');
      await expect(page.locator('#combat-actor-label')).toHaveText('Tu personaje');
      const lesson = await page.locator('#combat-lesson').boundingBox();
      if (!lesson) throw new Error('Missing combat explanation');
      expect(lesson.width).toBeLessThanOrEqual(360);
      expect(lesson.height).toBeLessThan(450);
      await page.keyboard.press('Tab');
      await expect(page.locator('#combat-skip')).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.locator('#combat-continue')).toBeFocused();
      const time = new Date('2026-10-23T12:00:00Z');
      await page.clock.install({ time });
      await page.clock.pauseAt(new Date(time.getTime() + 10000));
      await page.locator('#combat-continue').click();
      await page.locator('#prepare-spell').click();
      const canvas = page.locator('#game');
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error('Missing game canvas');
      const position = { x: bounds.width / 2 + 55, y: bounds.height / 2 };
      await canvas.click({ position });
      await expect(page.locator('#combat-title')).toHaveText('El intento no acertó');
      await expect(canvas).toHaveCSS('cursor', 'default');
      await expect(page.locator('#mana')).toHaveText('100 / 100');
      await page.keyboard.press('d');
      await expect(page.locator('#health')).toHaveText('100 / 100');
      await page.locator('#combat-skip').click();
      await expect(page.locator('#combat-lesson')).toBeHidden();
      await expect(page.locator('#combat-guidance')).toBeHidden();
      await expect(page.locator('main')).not.toHaveAttribute('inert');
      await page.clock.runFor(1400);
      await expect(page.locator('#spell-status')).toContainText('Apocalipsis');
      await page.locator('#prepare-spell').click();
      await page.clock.runFor(20);
      await expect(page.locator('#spell-status')).toHaveText('Ready: click your target');
      await canvas.click({ position });
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#combat-lesson')).toBeHidden();
      await page.clock.runFor(1400);
      await page.locator('#pause').click();
      await expect(page.locator('#help-experienced')).toHaveText('Volver a mostrar las explicaciones de combate');
      await page.locator('#help-experienced').click();
      await expect(page.locator('#help-experienced')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#help-dialog')).toBeVisible();
      await page.locator('#resume').click();
      await page.clock.runFor(20);
      await page.locator('#prepare-spell').click();
      await canvas.click({ position });
      await expect(page.locator('#combat-title')).toHaveText('El intento no acertó');
      await expect(page.locator('#combat-lesson')).toBeVisible();
    });

    test('safe workshop highlights sections, validates keys and starts combat only after review', async ({ page }) => {
      await openDemo(page);
      await enterPreparation(page);
      await expect(page.locator('#setup-title')).toHaveText('1. Elegí un hechizo');
      await expect(page.locator('.spells-window')).toHaveClass(/lesson-target/);
      await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'setup');
      await page.keyboard.press('d');
      await expect(page.locator('#health')).toHaveText('100 / 100');
      await expect(page.locator('#prepare-spell')).toBeDisabled();
      await page.locator('#setup-next').click();
      await expect(page.locator('.inventory-window')).toHaveClass(/lesson-target/);
      await page.locator('#setup-next').click();
      await expect(page.locator('.macrobar')).toHaveClass(/lesson-target/);
      await page.getByRole('button', { name: 'Asignar tecla a Apocalipsis', exact: true }).click();
      await page.keyboard.press('t');
      await expect(page.locator('#setup-bindings [data-bind="apocalipsis"]')).toHaveText('T');
      await page.getByRole('button', { name: 'Asignar tecla a poción de vida', exact: true }).click();
      await page.keyboard.press('t');
      await expect(page.locator('#setup-error')).toContainText('ya está asignada');
      await page.keyboard.press('w');
      await expect(page.locator('#setup-error')).toContainText('reservada');
      await page.keyboard.press('F3');
      await expect(page.locator('#setup-bindings [data-bind="life"]')).toHaveText('F3');
      await page.locator('#setup-next').click();
      await expect(page.locator('#setup-summary')).toContainText('Apocalipsis: T');
      await expect(page.locator('#setup-movement-status')).toContainText('Activado');
      await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'setup');
      await page.locator('#setup-experienced').click();
      await page.locator('#setup-start').click();
      await completeMeleePractice(page);
      await expect(page.locator('#controls-lesson')).toBeHidden();
      await page.keyboard.press('t');
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await page.keyboard.press('F3');
      await expect(page.locator('#life-stock')).toHaveText('∞');
    });

    test('window-only play leaves macros empty and still launches spells from their window', async ({ page }) => {
      await openDemo(page);
      await enterPreparation(page);
      await page.locator('#setup-windows').click();
      await expect(page.locator('#setup-summary')).toContainText('No hay teclas');
      await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'setup');
      await page.locator('#setup-experienced').click();
      await page.locator('#setup-start').click();
      await completeMeleePractice(page);
      await page.keyboard.press('c');
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'false');
      await page.locator('#prepare-spell').click();
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await page.getByRole('option', { name: 'Inmovilizar', exact: true }).click();
      await page.locator('#prepare-spell').click();
      await expect(page.locator('#target-help')).toContainText('Inmovilizar ready');
    });

    test('walking into each guide opens their lesson, then the arena opens', async ({ page }) => {
      await openDemo(page);
      await enterArena(page);
      await expect(page.locator('#objective-label')).toHaveText('FIGHT TWO RIVALS');
      await expect(page.locator('#objective')).toHaveText('0 / 2 rivals defeated');
      await expect(page.locator('#journey-0')).toHaveAttribute('data-state', 'done');
      await expect(page.locator('#journey-1')).toHaveAttribute('data-state', 'current');
      await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'fight');
      await expect(page.locator('#prepare-spell')).toBeEnabled();
    });

    test('the hallway exit stays closed until every guide is met', async ({ page }) => {
      await openDemo(page);
      await page.keyboard.press('e');
      await readGuide(page, 'The Warden');
      await page.keyboard.down('d');
      await expect(page.locator('#guide-dialog')).toBeVisible();
      await page.keyboard.up('d');
      await expect(page.locator('#guide-name')).toHaveText('The Arcanist');
      await expect(page.locator('#chapter')).toHaveText('THE VEIL / FIRST STEPS');
    });

    test('C prepares a spell, Escape cancels it, and Prepare toggles aiming', async ({ page }) => {
      await openDemo(page);
      await enterArena(page);
      const prepare = page.locator('#prepare-spell');
      await page.keyboard.press('c');
      await expect(prepare).toHaveAttribute('aria-pressed', 'true');
      await expect(prepare).toHaveText('Cancelar');
      await expect(page.locator('#target-help')).toHaveAttribute('data-armed', 'true');
      await expect(page.locator('#target-help')).toHaveText('Apocalipsis ready · click a rival · Esc cancels');

      await page.keyboard.press('Escape');
      await expect(prepare).toHaveAttribute('aria-pressed', 'false');
      await expect(prepare).toHaveText('Lanzar');
      await expect(page.locator('#target-help')).toHaveAttribute('data-armed', 'false');
      await expect(page.locator('#help-dialog')).toBeHidden();

      await prepare.click();
      await expect(prepare).toHaveAttribute('aria-pressed', 'true');
      await prepare.click();
      await expect(prepare).toHaveAttribute('aria-pressed', 'false');
    });

    test('a recovering attempt preserves aim, while misses restore the normal cursor', async ({ page }) => {
      await openDemo(page);
      await enterArena(page);
      // Hold simulation time still between clicks; browser/CI latency must not
      // decide whether the second attempt falls inside the 1.38s recovery.
      await page.clock.install({ time: new Date('2026-10-22T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-22T12:00:01Z'));
      const canvas = page.locator('#game');
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error('Missing game canvas');
      const position = { x: bounds.width / 2 + 60, y: bounds.height / 2 };
      await page.keyboard.press('c');
      await canvas.click({ position });
      await page.clock.runFor(20);
      await expect(page.locator('#mana')).toHaveText('100 / 100');
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('c');
      await canvas.click({ position });
      await page.clock.runFor(20);
      await expect(page.locator('#mana')).toHaveText('100 / 100');
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'true');
      await page.clock.runFor(1400);
      await expect(page.locator('#spell-status')).toHaveText('Ready: click your target');
      await canvas.click({ position });
      await page.clock.runFor(20);
      await expect(page.locator('#mana')).toHaveText('100 / 100');
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'false');
    });

    test('P pauses with the controls dialog and Resume continues', async ({ page }) => {
      await openDemo(page);
      await page.keyboard.press('p');
      await expect(page.locator('#help-dialog')).toBeVisible();
      await expect(page.locator('#help-title')).toHaveText('Paused');
      await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', { name: 'Resume' }).click();
      await expect(page.locator('#help-dialog')).toBeHidden();
      await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'false');
    });

    // The controls list promises "Esc: cancel aiming, then pause"; the Escape that opens the pause
    // dialog must not also count as a request to close it.
    test('Escape pauses when no spell is prepared, and Escape again resumes', async ({ page }) => {
      await openDemo(page);
      await page.keyboard.press('Escape');
      await expect(page.locator('#help-dialog')).toBeVisible();
      await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await expect(page.locator('#help-dialog')).toBeHidden();
      await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'false');
    });

    test('the character chosen on the site appears in the demo', async ({ page }) => {
      await openSite(page);
      await page.getByRole('button', { name: 'Change character: Avharot' }).click();
      await page.getByLabel('Character name').fill('Lyra');
      await page.getByRole('button', { name: 'Use this character' }).click();
      await openDemo(page);
      await expect(page.getByRole('button', { name: 'Change character: Lyra' })).toBeVisible();
    });

    test('Home leaves the standalone demo for Nix', async ({ page }) => {
      await openDemo(page);
      await page.getByRole('button', { name: 'Home', exact: true }).click();
      await expect(page).toHaveURL(/\/#home$/);
      await expect(page.locator('#loading')).toBeHidden();
      await expect(page.locator('#location-name')).toHaveText('Home');
    });
  });
});
