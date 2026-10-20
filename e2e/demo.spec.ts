import {test, expect, openDemo, openSite, type Page} from './fixtures.ts';

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

async function enterArena(page: Page) {
  await meetAllGuides(page);
  await page.keyboard.down('d');
  await expect(page.locator('#chapter')).toHaveText('THE VEIL / ARENA');
  await page.keyboard.up('d');
}

test.describe('offline demo', () => {
  test('boots in the tutorial hallway with full resources', async ({page}) => {
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
    await expect(page.getByRole('button', {name: 'Change character: Avharot'})).toBeVisible();
  });

  test('E talks to the nearby guide, and finishing the dialog counts the guide as met', async ({page}) => {
    await openDemo(page);
    await expect(page.locator('#interact')).toHaveText('Talk to The Warden · E');
    await expect(page.locator('#game')).toBeFocused();
    await page.keyboard.press('e');
    await readGuide(page, 'The Warden');
    await expect(page.locator('#objective')).toHaveText('1 / 3 guides met');
  });

  test.describe('with reduced motion', () => {
    test.use({reducedMotion: 'reduce'});

    test('walking into each guide opens their lesson, then the arena opens', async ({page}) => {
      await openDemo(page);
      await enterArena(page);
      await expect(page.locator('#objective-label')).toHaveText('FIGHT TWO RIVALS');
      await expect(page.locator('#objective')).toHaveText('0 / 2 rivals defeated');
      await expect(page.locator('#journey-0')).toHaveAttribute('data-state', 'done');
      await expect(page.locator('#journey-1')).toHaveAttribute('data-state', 'current');
      await expect(page.locator('body')).toHaveAttribute('data-tutorial-stage', 'fight');
      await expect(page.locator('#prepare-spell')).toBeEnabled();
    });

    test('the hallway exit stays closed until every guide is met', async ({page}) => {
      await openDemo(page);
      await page.keyboard.press('e');
      await readGuide(page, 'The Warden');
      await page.keyboard.down('d');
      await expect(page.locator('#guide-dialog')).toBeVisible();
      await page.keyboard.up('d');
      await expect(page.locator('#guide-name')).toHaveText('The Arcanist');
      await expect(page.locator('#chapter')).toHaveText('THE VEIL / FIRST STEPS');
    });

    test('C prepares a spell, Escape cancels it, and Prepare toggles aiming', async ({page}) => {
      await openDemo(page);
      await enterArena(page);
      const prepare = page.locator('#prepare-spell');
      await page.keyboard.press('c');
      await expect(prepare).toHaveAttribute('aria-pressed', 'true');
      await expect(prepare).toHaveText('Cancel aim');
      await expect(page.locator('#target-help')).toHaveAttribute('data-armed', 'true');
      await expect(page.locator('#target-help')).toHaveText('Apocalipsis ready · click a rival · Esc cancels');

      await page.keyboard.press('Escape');
      await expect(prepare).toHaveAttribute('aria-pressed', 'false');
      await expect(prepare).toHaveText('Prepare');
      await expect(page.locator('#target-help')).toHaveAttribute('data-armed', 'false');
      await expect(page.locator('#help-dialog')).toBeHidden();

      await prepare.click();
      await expect(prepare).toHaveAttribute('aria-pressed', 'true');
      await prepare.click();
      await expect(prepare).toHaveAttribute('aria-pressed', 'false');
    });

    test('P pauses with the controls dialog and Resume continues', async ({page}) => {
      await openDemo(page);
      await page.keyboard.press('p');
      await expect(page.locator('#help-dialog')).toBeVisible();
      await expect(page.locator('#help-title')).toHaveText('Paused');
      await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'true');
      await page.getByRole('button', {name: 'Resume'}).click();
      await expect(page.locator('#help-dialog')).toBeHidden();
      await expect(page.locator('#pause')).toHaveAttribute('aria-pressed', 'false');
    });

    // The controls list promises "Esc: cancel aiming, then pause", but in Chrome the same Escape
    // that opens the pause dialog also closes it (its cancel handler resumes the game).
    test.fixme('Escape pauses when no spell is prepared', async ({page}) => {
      await openDemo(page);
      await page.keyboard.press('Escape');
      await expect(page.locator('#help-dialog')).toBeVisible();
    });

    test('the character chosen on the site appears in the demo', async ({page}) => {
      await openSite(page);
      await page.getByRole('button', {name: 'Change character: Avharot'}).click();
      await page.getByLabel('Character name').fill('Lyra');
      await page.getByRole('button', {name: 'Use this character'}).click();
      await openDemo(page);
      await expect(page.getByRole('button', {name: 'Change character: Lyra'})).toBeVisible();
    });

    test('Home leaves the standalone demo for Nix', async ({page}) => {
      await openDemo(page);
      await page.getByRole('button', {name: 'Home', exact: true}).click();
      await expect(page).toHaveURL(/\/#home$/);
      await expect(page.locator('#loading')).toBeHidden();
      await expect(page.locator('#location-name')).toHaveText('Home');
    });
  });
});
