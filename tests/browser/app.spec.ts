import { test, expect } from '@playwright/test';
import { dailyAnswer, services } from '../../src/game';

const date = '2026-11-20';
const answer = dailyAnswer(date);
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${date}T12:00:00Z`) });
  await page.goto('/');
});

test('icon-only start, keyboard autocomplete, win, persistence, stats, and share', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('img', { name: 'Mystery Azure service icon' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Revealed clues' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Which service?' })).toBeVisible();
  const search = page.getByRole('combobox', { name: 'Which Azure service is this?' });
  await search.fill(answer.name);
  await expect(page.getByRole('option').first().locator('img')).toBeVisible();
  await search.press('Enter');
  await search.press('Enter');
  await expect(page.getByRole('region', { name: 'Game result' })).toContainText('Solved in 1/6');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Game result' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Statistics', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('100%');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy result' }).click();
  await expect(page.getByText('Copied!')).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('1/6');
  expect(text).not.toContain(answer.name);
  expect(errors).toEqual([]);
});

test('wrong guesses and skips progressively unlock the full description and loss', async ({ page }) => {
  const wrong = services.find((s) => s.id !== answer.id)!;
  const search = page.getByRole('combobox', { name: 'Which Azure service is this?' });
  await search.fill(wrong.name);
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Guess', exact: false }).click();
  await expect(page.getByRole('region', { name: 'Revealed clues' })).toContainText(answer.categories[0]);
  await expect(page.getByRole('region', { name: 'Your attempts' }).getByLabel('Not quite')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('5 attempts remaining', { exact: true })).toBeVisible();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next clue' }).click();
  await expect(page.getByRole('region', { name: 'Revealed clues' })).toContainText(answer.description);
  await expect(page.getByLabel('1 attempt remaining', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(page.getByRole('region', { name: 'Game result' })).toContainText('Out of guesses');
  await expect(page.getByRole('combobox', { name: 'Which Azure service is this?' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Learn more' })).toBeVisible();
  await page.getByRole('button', { name: 'Try practice' }).click();
  await expect(page.getByText('Practice', { exact: true })).toBeVisible();
  await expect(page.getByLabel('6 attempts remaining', { exact: true })).toBeVisible();
});

test('directory, no matches, dialog keyboard dismissal, and desktop controls', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Which Azure service is this?' }).fill('zzzzzz-not-a-service');
  await expect(page.getByText('No matching services. Try a shorter name or acronym.')).toBeVisible();
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Service directory', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search directory' }).fill('AKS');
  await expect(page.getByRole('dialog').getByRole('link', { name: /Azure Kubernetes Service/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Minimize window', exact: true }).click();
  await page.getByRole('button', { name: 'Open Azurdle' }).click();
  await expect(page.getByRole('heading', { name: 'Which service?' })).toBeVisible();
  await page.getByRole('button', { name: 'start', exact: true }).click();
  await page.locator('#start-menu').getByRole('button', { name: 'Azurdle', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Game', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New practice', exact: true }).click();
  await expect(page.getByText('Practice', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('UTC midnight rolls daily puzzle over while retaining prior progress', async ({ page }) => {
  await page.getByRole('button', { name: 'Next clue' }).click();
  await page.clock.setSystemTime(new Date('2026-11-20T23:59:59Z'));
  await page.clock.runFor(2000);
  await expect(page.getByText('Daily #2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('6 attempts remaining', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('azurdle:v1:daily:2026-11-20')!).attempts.length)).toBe(1);
});

test('renders with unavailable browser storage', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Storage disabled'); }; });
  await page.reload();
  await expect(page.getByText('Browser storage is unavailable.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Next clue' }).click();
  await expect(page.getByLabel('5 attempts remaining', { exact: true })).toBeVisible();
});

test('XP menus support keyboard navigation, mode switching, and dismissal', async ({ page }) => {
  const gameMenu = page.getByRole('menuitem', { name: 'Game', exact: true });
  await gameMenu.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitemradio', { name: 'Daily', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Practice', { exact: true })).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await gameMenu.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitem', { name: 'Statistics', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'View', exact: true })).toBeFocused();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await gameMenu.click();
  await page.getByRole('menuitemradio', { name: 'Daily', exact: true }).click();
  await expect(page.getByText('Daily #1', { exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Help', exact: true }).click();
  await page.getByRole('img', { name: 'Mystery Azure service icon' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  for (const name of ['Guess', 'Next clue']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});
