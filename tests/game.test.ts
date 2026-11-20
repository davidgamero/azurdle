import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { byId, clueNames, clueText, dailyAnswer, EPOCH, DAY, getStats, isFinished, isWon, makeAttempt, readGame, readRecords, searchServices, services, shareText, utcDate } from '../src/game';
import pool from '../src/data/daily-pool.json' with { type: 'json' };

test('daily schedule is UTC-based, deterministic, and does not repeat within a cycle', () => {
  const ids = Array.from({ length: pool.length }, (_, i) => dailyAnswer(utcDate(new Date(EPOCH + i * DAY))).id);
  assert.equal(new Set(ids).size, pool.length);
  assert.equal(dailyAnswer('2026-11-20').id, dailyAnswer(utcDate(new Date('2026-11-19T20:00:00-04:00'))).id);
  assert.notEqual(dailyAnswer('2026-11-20').id, dailyAnswer('2026-11-21').id);
  assert.ok(dailyAnswer('2026-11-01'));
});

test('catalog is complete, unique, and all referenced icons and daily services exist', () => {
  assert.ok(services.length >= 200);
  assert.equal(new Set(services.map((service) => service.id)).size, services.length);
  for (const service of services) {
    assert.ok(service.description.length > 10);
    assert.ok(service.categories.length);
    assert.ok(existsSync(`public/${service.icon}`), service.icon);
    assert.ok(service.url.startsWith('https://'));
    if (service.playable) assert.ok(service.iconSource);
  }
  for (const id of pool) assert.ok(byId.get(id)?.playable, id);
});

test('wrong guesses and skips consume attempts; duplicates and postgame attempts do not', () => {
  const answer = dailyAnswer('2026-11-20');
  const wrong = services.find((s) => s.id !== answer.id)!;
  let game = { answerId: answer.id, attempts: [] as { id: string | null }[] };
  game = makeAttempt(game, wrong.id);
  assert.equal(makeAttempt(game, wrong.id), game);
  assert.equal(makeAttempt(game, 'nonexistent-service'), game);
  for (let i = 0; i < 4; i++) game = makeAttempt(game, null);
  assert.equal(game.attempts.length, 5);
  assert.equal(isFinished(game), true);
  assert.equal(isWon(game), false);
  assert.equal(makeAttempt(game, answer.id), game);
});

test('correct guesses end the game immediately and saves are validated', () => {
  const answer = dailyAnswer('2026-11-20');
  const fresh = { answerId: answer.id, attempts: [] };
  const won = makeAttempt(fresh, answer.id);
  assert.equal(isWon(won), true);
  assert.equal(makeAttempt(won, null), won);
  assert.deepEqual(readGame(JSON.stringify(won), answer.id), won);
  assert.deepEqual(readGame('{bad json', answer.id), fresh);
  assert.deepEqual(readGame(JSON.stringify({ ...won, answerId: 'stale' }), answer.id), fresh);
  assert.deepEqual(readGame(JSON.stringify({ ...fresh, attempts: [{ id: 'invalid' }] }), answer.id), fresh);
  assert.deepEqual(readGame(JSON.stringify({ ...won, attempts: [...won.attempts, { id: null }] }), answer.id), fresh);
});

test('autocomplete supports abbreviations, aliases, flexible word order, and exclusions', () => {
  assert.equal(searchServices('AKS')[0].name, 'Azure Kubernetes Service (AKS)');
  assert.equal(searchServices('APIM')[0].name, 'API Management');
  assert.ok(searchServices('Form Recognizer').some((s) => s.name === 'Azure Document Intelligence in Foundry Tools'));
  assert.equal(searchServices('vault azure key')[0].name, 'Azure Key Vault');
  assert.equal(searchServices('Azure Batch')[0].name, 'Batch');
  const id = searchServices('AKS')[0].id;
  assert.ok(searchServices('AKS', [id]).every((s) => s.id !== id));
  assert.equal(searchServices('zzzz-unreal-service').length, 0);
});

test('clues progress to the complete published description and share text is spoiler-free', () => {
  const answer = byId.get('azure-key-vault')!;
  assert.deepEqual(clueNames, ['Icon', 'Category', 'Initials', 'Preview', 'Description']);
  assert.equal(clueText(answer, 2), 'KV');
  assert.equal(clueText(answer, 4), answer.description);
  assert.ok(clueText(answer, 3).length < answer.description.length + 2);
  const text = shareText({ answerId: answer.id, attempts: [{ id: null }, { id: answer.id }] }, 'daily', '2026-11-20', 'https://example.com/azurdle/');
  assert.ok(text.includes('⬜🟩'));
  assert.ok(text.includes('2/5'));
  assert.ok(!text.includes(answer.name));
});

test('streaks respect missed days, losses, and unfinished today; duplicate records are idempotent', () => {
  const records = readRecords(JSON.stringify([
    { date: '2026-11-20', won: true, attempts: 2 },
    { date: '2026-11-21', won: true, attempts: 3 },
    { date: '2026-11-21', won: true, attempts: 3 },
  ]));
  assert.equal(getStats(records, '2026-11-22').streak, 2);
  assert.equal(getStats(records, '2026-11-23').streak, 0);
  assert.equal(getStats(records, '2026-11-22').played, 2);
  const lost = [...records, { date: '2026-11-22', won: false, attempts: 5 }];
  assert.equal(getStats(lost, '2026-11-22').streak, 0);
  assert.equal(getStats(lost, '2026-11-22').best, 2);
  assert.deepEqual(readRecords('{'), []);
  assert.equal(getStats(records, '2026-11-22').distribution.length, 5);
});
