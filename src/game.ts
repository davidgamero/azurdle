import catalog from './data/catalog.json' with { type: 'json' };
import dailyPool from './data/daily-pool.json' with { type: 'json' };

export type Service = (typeof catalog.services)[number];
export type Mode = 'daily' | 'practice';
export type Attempt = { id: string | null };
export type Game = { answerId: string; attempts: Attempt[] };
export type DailyRecord = { date: string; won: boolean; attempts: number };
export const services: Service[] = catalog.services;
export const byId = new Map(services.map((service) => [service.id, service]));
export const playable = services.filter((service) => service.playable);
export const MAX_ATTEMPTS = 5;
export const EPOCH = Date.UTC(2026, 10, 20);
export const DAY = 86_400_000;
export const clueNames = ['Icon', 'Category', 'Initials', 'Preview', 'Description'];
export const utcDate = (date = new Date()) => date.toISOString().slice(0, 10);
export const puzzleNumber = (date: string) => Math.floor((Date.parse(date) - EPOCH) / DAY) + 1;

function randomSeed(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function dailyAnswer(date: string): Service {
  const day = puzzleNumber(date) - 1;
  const cycle = Math.floor(day / dailyPool.length);
  const random = randomSeed(cycle + 0xA2D1E);
  const pool = [...dailyPool];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return byId.get(pool[((day % pool.length) + pool.length) % pool.length])!;
}

export function practiceAnswer(previous?: string): Service {
  const pool = playable.filter((service) => service.id !== previous);
  return pool[Math.floor(Math.random() * pool.length)];
}

export const isWon = (game: Game) => game.attempts.some((attempt) => attempt.id === game.answerId);
export const isFinished = (game: Game) => isWon(game) || game.attempts.length >= MAX_ATTEMPTS;
export function makeAttempt(game: Game, id: string | null): Game {
  if (isFinished(game) || (id !== null && (!byId.has(id) || game.attempts.some((attempt) => attempt.id === id)))) return game;
  return { ...game, attempts: [...game.attempts, { id }] };
}

export function guessFeedback(answerId: string, guessId: string | null) {
  if (guessId === null) return { state: 'skipped' as const, sharedCategories: [] as string[] };
  const answer = byId.get(answerId), guess = byId.get(guessId);
  const sharedCategories = answer && guess ? answer.categories.filter((category) => guess.categories.includes(category)) : [];
  if (answerId === guessId) return { state: 'correct' as const, sharedCategories };
  return { state: sharedCategories.length ? 'close' as const : 'wrong' as const, sharedCategories };
}

export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Small typo tolerance, including adjacent transpositions ("funtcions").
function editDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, i) => Array.from({ length: right.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(left[i - 1] !== right[j - 1]));
      if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[left.length][right.length];
}

const searchIndex = services.map((service) => {
  const names = [service.name, ...service.aliases].map(normalize);
  return { service, names, text: names.join(' '), tokens: [...new Set(names.flatMap((name) => name.split(' ')))] };
});

export function searchServices(query: string, excluded: string[] = []): Service[] {
  const tokens = normalize(query).split(' ').filter(Boolean);
  const words = tokens.length > 1 ? tokens.filter((word) => word !== 'azure' && word !== 'microsoft') : tokens;
  const phrase = words.join(' ');
  return searchIndex.filter(({ service }) => !excluded.includes(service.id)).map(({ service, names, text, tokens: candidateTokens }) => {
    const plainNames = names.map((name) => name.replace(/^(azure|microsoft) /, ''));
    if (names.includes(normalize(query)) || plainNames.includes(phrase)) return { service, score: 0 };
    if (words.every((word) => text.includes(word))) {
      const prefix = plainNames.find((name) => name.startsWith(phrase));
      return { service, score: prefix ? 1 + (prefix.length - phrase.length) / 1000 : 2 };
    }
    let distance = 0;
    for (const word of words) {
      if (text.includes(word)) continue;
      if (word.length < 4) return { service, score: Infinity };
      const limit = word.length < 6 ? 1 : 2;
      let best = Infinity;
      for (const token of candidateTokens) {
        // Compare both full words and prefixes so incomplete queries still work.
        for (const length of new Set([token.length, word.length - 1, word.length, word.length + 1])) {
          if (length > token.length || Math.abs(length - word.length) > limit) continue;
          best = Math.min(best, editDistance(word, token.slice(0, length)));
        }
      }
      if (best > limit) return { service, score: Infinity };
      distance += best / word.length;
    }
    return { service, score: 3 + distance + plainNames[0].length / 10000 };
  }).filter((result) => Number.isFinite(result.score)).sort((a, b) => a.score - b.score || a.service.name.localeCompare(b.service.name)).map((result) => result.service);
}

export const shortName = (service: Service) => service.name.replace(/^(Microsoft|Azure) /, '').replace(/\s*\([^)]*\)/g, '');
export function clueText(service: Service, stage: number): string {
  const words = shortName(service).split(/\s+/);
  switch (stage) {
    case 1: return service.categories.join(' · ');
    case 2: return words.map((word) => word[0]).join('');
    case 3: {
      const description = service.description.split(' ');
      return description.slice(0, Math.max(2, Math.ceil(description.length / 2))).join(' ') + ' …';
    }
    case 4: return service.description;
    default: return 'Identify the service from its official Azure icon.';
  }
}

export function readGame(raw: string | null, answerId: string): Game {
  const fresh = { answerId, attempts: [] };
  try {
    const data = JSON.parse(raw ?? 'null');
    if (data?.answerId !== answerId || !Array.isArray(data.attempts) || data.attempts.length > MAX_ATTEMPTS) return fresh;
    let game: Game = fresh;
    for (const attempt of data.attempts) {
      if (!attempt || !(attempt.id === null || typeof attempt.id === 'string')) return fresh;
      const next = makeAttempt(game, attempt.id);
      if (next === game) return fresh;
      game = next;
    }
    return game;
  } catch { return fresh; }
}

export function readRecords(raw: string | null): DailyRecord[] {
  try {
    const records: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(records)) return [];
    const unique = new Map<string, DailyRecord>();
    for (const record of records) {
      if (record && /^\d{4}-\d{2}-\d{2}$/.test(record.date) && Number.isFinite(Date.parse(record.date)) && typeof record.won === 'boolean' && Number.isInteger(record.attempts) && record.attempts >= 1 && record.attempts <= MAX_ATTEMPTS) unique.set(record.date, record);
    }
    return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
  } catch { return []; }
}

export function getStats(records: DailyRecord[], today: string) {
  const wins = records.filter((record) => record.won);
  let best = 0, streak = 0, previous = '';
  for (const record of records) {
    streak = record.won ? (Date.parse(record.date) - Date.parse(previous) === DAY ? streak + 1 : 1) : 0;
    best = Math.max(best, streak);
    previous = record.date;
  }
  const latest = records.at(-1);
  const age = latest ? Date.parse(today) - Date.parse(latest.date) : Infinity;
  return { played: records.length, winRate: records.length ? Math.round(wins.length / records.length * 100) : 0,
    streak: age >= 0 && age <= DAY ? streak : 0, best,
    distribution: Array.from({ length: MAX_ATTEMPTS }, (_, index) => wins.filter((record) => record.attempts === index + 1).length) };
}

export function resultTiles(game: Game) {
  return Array.from({ length: MAX_ATTEMPTS }, (_, index) => {
    const attempt = game.attempts[index];
    if (!attempt) return { state: 'unused', emoji: '⬛', label: 'Unused' };
    const { state } = guessFeedback(game.answerId, attempt.id);
    const tile = {
      correct: { emoji: '🟩', label: 'Correct' },
      close: { emoji: '🟨', label: 'Right category' },
      skipped: { emoji: '⬜', label: 'Skipped' },
      wrong: { emoji: '🟥', label: 'Incorrect' },
    }[state];
    return { state, ...tile };
  });
}

export function shareText(game: Game, mode: Mode, date: string, url: string): string {
  const label = mode === 'daily' ? `#${puzzleNumber(date)} (${date})` : 'Practice';
  const tiles = resultTiles(game).map((tile) => tile.emoji).join('');
  return `Azurdle ${label}  ${isWon(game) ? game.attempts.length : 'X'}/${MAX_ATTEMPTS}\n${tiles}\n${url}`;
}
