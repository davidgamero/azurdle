import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-20T12:00:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: "Let's do it", exact: true }).click();
});

test('Safari suggestions stay below the input, scroll, and submit on tap', async ({ page }) => {
  const search = page.getByRole('combobox');
  await search.fill('container');
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  const list = page.getByRole('listbox');
  await expect.poll(async () => {
    const box = await list.boundingBox(), input = await search.boundingBox();
    return box!.y >= input!.y + input!.height;
  }).toBe(true);
  await expect(page.getByRole('button', { name: 'Guess', exact: true })).toHaveCount(0);
  const firstName = await page.getByRole('option').first().innerText();
  await page.getByRole('option').first().tap();
  await expect(page.locator('.hint-guess')).toHaveCount(1);
  await expect(page.locator('.hint-guess')).toContainText(firstName);
  await search.fill('storage');
  await search.press('ArrowDown');
  await search.press('ArrowUp');
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  for (let i = 0; i < 6; i++) await search.press('ArrowDown');
  await expect(page.getByRole('option').nth(6)).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const active = await page.getByRole('option').nth(6).boundingBox();
  const bounds = await list.boundingBox();
  expect(active!.y).toBeGreaterThanOrEqual(bounds!.y);
  expect(active!.y + active!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
  await search.press('Enter');
  await expect(page.locator('.hint-guess')).toHaveCount(2);
});

test('Safari visual viewport shrink leaves suggestions visible above a simulated keyboard', async ({ page }) => {
  await page.evaluate(() => {
    const viewport = Object.assign(new EventTarget(), { height: 280, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  });
  await page.getByRole('combobox').fill('container');
  await expect.poll(async () => {
    const list = await page.getByRole('listbox').boundingBox();
    return list!.y >= 0 && list!.y + list!.height <= 280;
  }).toBe(true);
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, { height: 240, offsetTop: 30 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await expect.poll(async () => {
    const list = await page.getByRole('listbox').boundingBox();
    return list!.y >= 30 && list!.y + list!.height <= 270;
  }).toBe(true);
  await page.getByRole('option').first().tap();
  await expect(page.locator('.hint-guess')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('short Safari layouts merge navigation into the header without losing menu access', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  const header = page.locator('.portal-header');
  await expect(header.getByRole('button', { name: 'Azurdle home' })).toBeVisible();
  await expect(header.getByText('Daily #', { exact: false })).toBeVisible();
  await header.getByRole('button', { name: 'Open navigation' }).tap();
  await page.getByRole('menuitem', { name: 'Help', exact: true }).tap();
  const menu = await page.getByRole('menu', { name: 'Help', exact: true }).boundingBox();
  expect(menu!.x).toBeGreaterThanOrEqual(0);
  expect(menu!.x + menu!.width).toBeLessThanOrEqual(320);
  await page.getByRole('menuitem', { name: 'How to play' }).tap();
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
  await page.getByRole('button', { name: 'OK', exact: true }).tap();
  await page.setViewportSize({ width: 800, height: 600 });
  await expect(header.getByRole('menuitem', { name: 'Game', exact: true })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Open navigation' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.game-panel').getByRole('navigation')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
