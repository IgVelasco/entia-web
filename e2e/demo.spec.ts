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
  await page.locator('#setup-start').click();
  await expect(page.locator('#chapter')).toHaveText('THE VEIL / ARENA');
}

test.describe('offline demo', () => {
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
      await expect(page.locator('[data-bind="apocalipsis"]')).toHaveText('T');
      await page.getByRole('button', { name: 'Asignar tecla a poción de vida', exact: true }).click();
      await page.keyboard.press('t');
      await expect(page.locator('#setup-error')).toContainText('ya está asignada');
      await page.keyboard.press('w');
      await expect(page.locator('#setup-error')).toContainText('reservada');
      await page.keyboard.press('F3');
      await expect(page.locator('[data-bind="life"]')).toHaveText('F3');
      await page.locator('#setup-next').click();
      await expect(page.locator('#setup-summary')).toContainText('Apocalipsis: T');
      await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'setup');
      await page.locator('#setup-start').click();
      await expect(page.locator('#controls-lesson')).toBeHidden();
      await page.keyboard.press('t');
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Escape');
      await page.keyboard.press('F3');
      await expect(page.locator('#life-stock')).toHaveText('99');
    });

    test('window-only play leaves macros empty and still launches spells from their window', async ({ page }) => {
      await openDemo(page);
      await enterPreparation(page);
      await page.locator('#setup-windows').click();
      await expect(page.locator('#setup-summary')).toContainText('No hay teclas');
      await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'setup');
      await page.locator('#setup-start').click();
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

    test('a recovering cast preserves the prepared cursor until a successful retry', async ({ page }) => {
      await openDemo(page);
      await enterArena(page);
      const canvas = page.locator('#game');
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error('Missing game canvas');
      const position = { x: bounds.width / 2 + 60, y: bounds.height / 2 };
      await page.keyboard.press('c');
      await canvas.click({ position });
      await expect(page.locator('#mana')).toHaveText('85 / 100');
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('c');
      await canvas.click({ position });
      await expect(page.locator('#mana')).toHaveText('85 / 100');
      await expect(page.locator('#prepare-spell')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#spell-status')).toHaveText('Ready: click your target');
      await canvas.click({ position });
      await expect(page.locator('#mana')).toHaveText('70 / 100');
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
