import { test as base, expect, type Page } from '@playwright/test';

// Every test fails if any frame of the page logs a console error or throws.
export const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()} (${message.location().url})`);
      });
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
      await use(errors);
      expect(errors, 'browser errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect, type Page };

export const CHARACTER_KEY = 'entia-character-v1';

// The site is ready once its artwork has loaded and the loading curtain is gone.
export async function openSite(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.locator('#loading')).toBeHidden();
}

// The standalone demo is ready once its artwork has loaded and the curtain is gone.
export async function openDemo(page: Page) {
  await page.goto('/demo/');
  await expect(page.locator('#curtain')).toBeHidden();
  const savedChoice = await page.evaluate(() => localStorage.getItem('entia-demo-click-movement-v1'));
  if (savedChoice !== 'true' && savedChoice !== 'false') await page.locator('#movement-click-yes').click();
}

// The inline style transform is how the page places a label over the canvas.
export function transformOf(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => (element as HTMLElement).style.transform);
}
