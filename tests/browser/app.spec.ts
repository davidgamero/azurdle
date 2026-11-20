import { test, expect } from '@playwright/test';
import { clueText, dailyAnswer, services } from '../../src/game';

const date = '2026-11-20';
const answer = dailyAnswer(date);
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${date}T12:00:00Z`) });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Welcome to Azurdle!' })).toContainText('Guess the daily Azure service');
  await page.getByRole('button', { name: "Let's do it", exact: true }).click();
});

test('icon-only start, keyboard autocomplete, win, persistence, stats, and share', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('img', { name: 'Mystery Azure service icon' })).toBeVisible();
  await expect(page.locator('.hint-row')).toHaveCount(5);
  await expect(page.locator('.hint-row.locked')).toHaveCount(4);
  for (const name of ['Category', 'Initials', 'Preview', 'Description']) {
    const row = page.getByRole('region', { name: `${name} hint`, exact: true });
    await expect(row).toContainText('Locked');
    await expect(row.locator('.hint-content')).toHaveCount(0);
  }
  await expect(page.getByRole('heading', { name: 'Identify this Azure service' })).toBeVisible();
  const search = page.getByRole('combobox', { name: 'Which Azure service is this?' });
  await search.fill(answer.name);
  await expect(page.getByRole('option').first()).toHaveText(answer.name.replace(/^Azure\s+/i, ''));
  await expect(page.getByRole('listbox').locator('img, svg')).toHaveCount(0);
  await search.press('Enter');
  await expect(page.getByRole('region', { name: 'Game result' })).toContainText('Solved in 1/5');
  await expect(page.getByRole('region', { name: 'Icon hint' }).locator('.hint-guess')).toContainText(answer.name);
  await expect(page.getByRole('region', { name: 'Icon hint' }).getByLabel('Correct', { exact: true })).toBeVisible();
  await expect(page.locator('.hint-row.locked')).toHaveCount(4);
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
  expect(text.split('\n')[0]).toBe('Azurdle #1 (2026-11-20)  1/5');
  expect(text).toContain('1/5');
  expect(text.split('\n')[1]).toBe('🟩⬛⬛⬛⬛');
  expect(text.split('\n')[2]).toBe(new URL('./', page.url()).href);
  await expect(page.getByRole('group', { name: 'Shareable result grid' }).getByRole('img')).toHaveCount(5);
  expect(text).not.toContain(answer.name);
  expect(errors).toEqual([]);
});

test('wrong guesses and skips progressively unlock the full description and loss', async ({ page }) => {
  const wrong = services.find((s) => s.id !== answer.id)!;
  const search = page.getByRole('combobox', { name: 'Which Azure service is this?' });
  await search.fill(wrong.name);
  await page.getByRole('option').first().click();
  await expect(page.getByRole('region', { name: 'Category hint' })).toContainText(answer.categories[0]);
  await expect(page.getByRole('region', { name: 'Icon hint' }).locator('.hint-guess')).toContainText(wrong.name);
  await expect(page.getByRole('region', { name: 'Icon hint' }).getByLabel('Not quite')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('4 attempts remaining', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next clue' }).click();
  await expect(page.getByRole('region', { name: 'Category hint' }).locator('.hint-guess')).toContainText('Skipped');
  await expect(page.locator('.initials-clue')).toHaveText(clueText(answer, 2));
  await expect(page.getByRole('region', { name: 'Mystery service clues' })).not.toContainText('▰');
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next clue' }).click();
  await expect(page.getByRole('region', { name: 'Description hint' })).toContainText(answer.description);
  await expect(page.getByLabel('1 attempt remaining', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reveal answer' }).click();
  await expect(page.getByRole('region', { name: 'Game result' })).toContainText('Out of guesses');
  await expect(page.locator('.hint-guess')).toHaveCount(5);
  await expect(page.getByRole('group', { name: 'Shareable result grid' })).toHaveText('🟥⬜⬜⬜⬜');
  await expect(page.getByRole('combobox', { name: 'Which Azure service is this?' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Learn more' })).toBeVisible();
  await page.getByRole('button', { name: 'Try practice' }).click();
  await expect(page.getByText('Practice', { exact: true })).toBeVisible();
  await expect(page.getByLabel('5 attempts remaining', { exact: true })).toBeVisible();
});

test('directory, no matches, dialog keyboard dismissal, and portal navigation', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Which Azure service is this?' }).fill('zzzzzz-not-a-service');
  await expect(page.getByText('No matching services. Try a shorter name or acronym.')).toBeVisible();
  await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Service directory', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search directory' }).fill('AKS');
  await expect(page.getByRole('dialog').getByRole('link', { name: /Azure Kubernetes Service/ })).toBeVisible();
  await expect(page.locator('.directory-list img')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Identify this Azure service' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Game', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New practice', exact: true }).click();
  await expect(page.getByText('Practice', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Azurdle home' }).click();
  await expect(page.getByText('Daily #1', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('UTC midnight rolls daily puzzle over while retaining prior progress', async ({ page }) => {
  await page.getByRole('button', { name: 'Next clue' }).click();
  await page.clock.setSystemTime(new Date('2026-11-20T23:59:59Z'));
  await page.clock.runFor(2000);
  await expect(page.getByText('Daily #2', { exact: true })).toBeVisible();
  await expect(page.getByLabel('5 attempts remaining', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('azurdle:v2:daily:2026-11-20')!).attempts.length)).toBe(1);
});

test('renders with unavailable browser storage', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Storage disabled'); }; });
  await page.reload();
  await expect(page.getByText('Browser storage is unavailable.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Next clue' }).click();
  await expect(page.getByLabel('4 attempts remaining', { exact: true })).toBeVisible();
});

test('portal menus support keyboard navigation, mode switching, and dismissal', async ({ page }) => {
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
  await page.getByRole('region', { name: 'Description hint', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  for (const name of ['Guess', 'Next clue']) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

test('short screens keep primary actions and navigation accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  const guess = await page.getByRole('button', { name: 'Guess', exact: true }).boundingBox();
  expect(guess!.y + guess!.height).toBeLessThan(600);
  await page.getByRole('menuitem', { name: 'Game', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'Practice', exact: true }).click();
  await expect(page.getByText('Practice', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Identify this Azure service' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('fuzzy matches highlight, tap submits once, and close guesses share yellow tiles', async ({ page, isMobile, context }) => {
  const search = page.getByRole('combobox', { name: 'Which Azure service is this?' });
  await search.fill('funtcions');
  const option = page.getByRole('option', { name: 'Functions', exact: true });
  await expect(option).toHaveAttribute('aria-selected', 'true');
  const listBox = await page.getByRole('listbox').boundingBox();
  const inputBox = await search.boundingBox();
  if (isMobile) {
    expect(listBox!.y + listBox!.height).toBeLessThanOrEqual(inputBox!.y);
    expect(listBox!.y).toBeGreaterThanOrEqual(0);
    await option.tap();
  } else {
    expect(listBox!.y).toBeGreaterThan(inputBox!.y);
    await option.click();
  }
  await expect(page.getByLabel('4 attempts remaining', { exact: true })).toBeVisible();
  await expect(page.locator('.hint-guess')).toHaveCount(1);
  await expect(page.locator('.hint-guess')).toContainText('Azure Functions');
  await expect(page.locator('.close-badge')).toHaveText('Close');
  await search.fill(answer.name);
  await search.press('Enter');
  await expect(page.getByRole('region', { name: 'Game result' })).toContainText('Solved in 2/5');
  await expect(page.getByRole('group', { name: 'Shareable result grid' })).toHaveText('🟨🟩⬛⬛⬛');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy result' }).click();
  expect((await page.evaluate(() => navigator.clipboard.readText())).split('\n')[1]).toBe('🟨🟩⬛⬛⬛');
});

test('arrow keys change the submitted suggestion and empty searches do not guess', async ({ page }) => {
  const search = page.getByRole('combobox', { name: 'Which Azure service is this?' });
  await search.press('Enter');
  await expect(page.getByLabel('5 attempts remaining', { exact: true })).toBeVisible();
  await search.fill('container');
  const secondName = await page.getByRole('option').nth(1).innerText();
  await search.press('ArrowDown');
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await search.press('Enter');
  await expect(page.locator('.hint-guess')).toHaveCount(1);
  await expect(page.locator('.hint-guess')).toContainText(secondName);
  await search.fill('zzzz-not-a-service');
  await search.press('Escape');
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await expect(page.locator('.hint-guess')).toHaveCount(1);
});
