import { test, expect, openSite, transformOf, CHARACTER_KEY } from './fixtures.ts';

const sections = [
  { place: 'arena', nav: 'Game', heading: /^PvP with something\s*at stake\.$/ },
  { place: 'hall', nav: 'Rankings', heading: 'Rankings preview' },
  { place: 'gate', nav: 'Download', heading: 'Download Entia' },
];

test.describe('Nix site', () => {
  test('boots into Home with the default character', async ({ page }) => {
    await openSite(page);
    await expect(page.locator('#scene')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change character: Avharot' })).toBeVisible();
    await expect(page.locator('#location-name')).toHaveText('Home');
    await expect(page.locator('#intro')).toBeVisible();
    await expect(page.locator('#panel')).toBeHidden();
    await expect(page.locator('.keeper')).toHaveCount(4);
    await expect(page.locator('.nav[data-place="home"]')).toHaveAttribute('aria-current', 'page');
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('navigation buttons open each section, update the hash, and back restores the previous one', async ({
      page,
    }) => {
      await openSite(page);
      for (const section of sections) {
        await page.locator('.nav', { hasText: section.nav }).click();
        await expect(page).toHaveURL(new RegExp(`#${section.place}$`));
        await expect(page.locator('#section-heading')).toHaveText(section.heading);
        await expect(page.locator('#location-name')).toHaveText(section.nav);
        await expect(page.locator(`.nav[data-place="${section.place}"]`)).toHaveAttribute('aria-current', 'page');
        await expect(page.locator(`.keeper[data-place="${section.place}"]`)).toHaveAttribute(
          'aria-current',
          'location',
        );
      }
      await page.locator('.nav', { hasText: 'Home' }).click();
      await expect(page).toHaveURL(/#home$/);
      await expect(page.locator('#intro')).toBeVisible();
      await expect(page.locator('#panel')).toBeHidden();

      await page.goBack();
      await expect(page).toHaveURL(/#gate$/);
      await expect(page.locator('#section-heading')).toHaveText('Download Entia');
      await page.goBack();
      await expect(page).toHaveURL(/#hall$/);
      await expect(page.locator('#section-heading')).toHaveText('Rankings preview');
    });

    test('a deep link opens its section, and number keys and Escape navigate', async ({ page }) => {
      await openSite(page, '/#hall');
      await expect(page.locator('#section-heading')).toHaveText('Rankings preview');
      await page.getByRole('button', { name: 'Support', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Support', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: 'Essence', exact: true })).toHaveAttribute('aria-pressed', 'false');

      await page.locator('#scene').focus();
      await page.keyboard.press('2');
      await expect(page).toHaveURL(/#arena$/);
      await expect(page.locator('#section-heading')).toHaveText(sections[0].heading);
      await page.keyboard.press('Escape');
      await expect(page).toHaveURL(/#home$/);
      await expect(page.locator('#intro')).toBeVisible();
    });

    test('C toggles spell aiming and Escape cancels it', async ({ page }) => {
      await openSite(page);
      await page.locator('#scene').focus();
      await page.keyboard.press('c');
      await expect(page.locator('#spell')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#spell-hint')).toHaveText('Aim with the pointer and click');
      await page.keyboard.press('Escape');
      await expect(page.locator('#spell')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#spell-hint')).toHaveText('Aim a spell');
    });

    test('the portal opens the embedded demo, and Home inside it returns to Nix', async ({ page }) => {
      await openSite(page);
      await page.getByRole('button', { name: 'Walk into the portal' }).click();
      await expect(page).toHaveURL(/#demo$/);
      await expect(page.locator('#demo-host')).toBeVisible();
      await expect
        .poll(() => page.frames().map((frame) => new URL(frame.url()).pathname + new URL(frame.url()).search))
        .toContain('/demo/?embedded=1');
      await expect(page.locator('#demo-loading')).toBeHidden();
      const demo = page.frameLocator('#demo-frame');
      await demo.locator('#movement-click-yes').click();
      await expect(demo.locator('#chapter')).toHaveText('THE VEIL / FIRST STEPS');
      await expect(demo.locator('#objective')).toHaveText('0 / 3 guides met');

      await demo.getByRole('button', { name: 'Home', exact: true }).click();
      await expect(page).toHaveURL(/#home$/);
      await expect(page.locator('#demo-host')).toBeHidden();
      await expect(page.locator('#location-state')).toHaveText('Back in Nix');
      await expect(page.locator('#intro')).toBeVisible();
    });

    test('browser back closes the embedded demo', async ({ page }) => {
      await openSite(page);
      await page.getByRole('button', { name: 'Walk into the portal' }).click();
      await expect(page.locator('#demo-loading')).toBeHidden();
      await page.goBack();
      await expect(page).not.toHaveURL(/#demo$/);
      await expect(page.locator('#demo-host')).toBeHidden();
      await expect(page.locator('#location-name')).toHaveText('Home');
    });
  });

  test('holding a movement key walks the player through the world', async ({ page }) => {
    await openSite(page);
    // On desktop the camera follows the player, so the world labels shift as the player walks.
    const keeperLabel = '.keeper[data-place="home"]';
    const before = await transformOf(page, keeperLabel);
    await page.locator('#scene').focus();
    await page.keyboard.down('d');
    await expect(page.locator('#location-state')).toHaveText('Exploring Nix');
    await expect.poll(() => transformOf(page, keeperLabel)).not.toBe(before);
    await page.keyboard.up('d');
  });

  test.describe('character editor', () => {
    test.use({ reducedMotion: 'reduce' });

    test('saving a name and look updates the page and persists across reloads', async ({ page }) => {
      await openSite(page);
      await page.getByRole('button', { name: 'Change character: Avharot' }).click();
      const dialog = page.getByRole('dialog', { name: 'Make Nix your own' });
      await expect(dialog).toBeVisible();
      await page.getByLabel('Character name').fill('Lyra');
      await expect(page.locator('#character-preview-name')).toHaveText('Lyra');
      await page.getByRole('button', { name: 'Crimson sentinel' }).click();
      await expect(page.getByRole('button', { name: 'Crimson sentinel' })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: 'Moonwarden' })).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#character-look-name')).toHaveText('Crimson sentinel');
      await page.getByRole('button', { name: 'Use this character' }).click();

      await expect(dialog).toBeHidden();
      await expect(page.getByRole('button', { name: 'Change character: Lyra' })).toBeFocused();
      await expect(page.locator('#player-label')).toHaveText('Lyra');
      await expect(page.locator('#character-save-status')).toHaveText('Character saved on this device');
      expect(JSON.parse((await page.evaluate((key) => localStorage.getItem(key), CHARACTER_KEY)) ?? 'null')).toEqual({
        name: 'Lyra',
        body: 'mage',
      });

      await page.reload();
      await expect(page.locator('#loading')).toBeHidden();
      await page.getByRole('button', { name: 'Change character: Lyra' }).click();
      await expect(page.getByLabel('Character name')).toHaveValue('Lyra');
      await expect(page.getByRole('button', { name: 'Crimson sentinel' })).toHaveAttribute('aria-pressed', 'true');
    });

    test('cancel discards the draft', async ({ page }) => {
      await openSite(page);
      await page.getByRole('button', { name: 'Change character: Avharot' }).click();
      await page.getByLabel('Character name').fill('Nobody');
      await page.getByRole('button', { name: 'Crimson sentinel' }).click();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();

      await expect(page.getByRole('dialog', { name: 'Make Nix your own' })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Change character: Avharot' })).toBeVisible();
      expect(await page.evaluate((key) => localStorage.getItem(key), CHARACTER_KEY)).toBeNull();
      await page.getByRole('button', { name: 'Change character: Avharot' }).click();
      await expect(page.getByLabel('Character name')).toHaveValue('Avharot');
      await expect(page.getByRole('button', { name: 'Moonwarden' })).toHaveAttribute('aria-pressed', 'true');
    });

    test('the chosen name follows the player into the embedded demo', async ({ page }) => {
      await openSite(page);
      await page.getByRole('button', { name: 'Change character: Avharot' }).click();
      await page.getByLabel('Character name').fill('Lyra');
      await page.getByRole('button', { name: 'Use this character' }).click();
      await page.getByRole('button', { name: 'Walk into the portal' }).click();
      await expect(page.locator('#demo-loading')).toBeHidden();
      await page.frameLocator('#demo-frame').locator('#movement-click-yes').click();
      await expect(
        page.frameLocator('#demo-frame').getByRole('button', { name: 'Change character: Lyra' }),
      ).toBeVisible();
    });
  });
});
