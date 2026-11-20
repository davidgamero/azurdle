import { useEffect, useState, type ReactNode } from 'react';
import catalog from './data/catalog.json' with { type: 'json' };
import { byId, clueNames, clueText, dailyAnswer, getStats, guessFeedback, isFinished, isWon, makeAttempt, MAX_ATTEMPTS, playable, practiceAnswer, puzzleNumber, readGame, readRecords, resultTiles, searchServices, services, shareText, utcDate, type DailyRecord, type Game, type Mode } from './game';
import { GuessInput, MenuBar, Modal, ServiceIcon, useMediaQuery } from './components';

// Keep the previous six-attempt saves intact and separate from the new rules.
const STORAGE = 'azurdle:v2:';
function load(key: string) { try { return localStorage.getItem(STORAGE + key); } catch { return null; } }
function save(key: string, value: unknown) { try { localStorage.setItem(STORAGE + key, JSON.stringify(value)); return true; } catch { return false; } }
type Dialog = 'welcome' | 'help' | 'stats' | 'directory' | 'about' | null;

function Directory() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const categories = [...new Set(services.flatMap((service) => service.categories))].sort();
  const results = searchServices(query).filter((service) => category === 'All categories' || service.categories.includes(category));
  return <>
    <div className="directory-filters">
      <input aria-label="Search directory" placeholder="Find a service…" value={query} onChange={(event) => setQuery(event.target.value)}/>
      <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{categories.map((name) => <option key={name}>{name}</option>)}</select>
    </div>
    <div className="directory-count" role="status">{results.length} services</div>
    <div className="directory-list">{results.map((service) => <a key={service.id} href={service.url} target="_blank" rel="noreferrer" className="directory-service">
      <div><strong>{service.name} ↗</strong><p>{service.description}</p></div>
    </a>)}{!results.length && <p>No matching services.</p>}</div>
  </>;
}

function Statistics({ records, date }: { records: DailyRecord[]; date: string }) {
  const stats = getStats(records, date);
  return <>
    <div className="stats-grid">{[[stats.played, 'Played'], [`${stats.winRate}%`, 'Win rate'], [stats.streak, 'Streak'], [stats.best, 'Best']].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <h3 className="section-label">Guesses to win</h3>
    <div className="distribution">{stats.distribution.map((count, index) => <div key={index}><span>{index + 1}</span><div style={{ width: `${Math.max(8, count / Math.max(1, ...stats.distribution) * 100)}%` }}>{count}</div></div>)}</div>
    <p className="fine-print">Daily games only. Saved in this browser.</p>
  </>;
}

function Help() {
  return <>
    <h2>Guess the Azure service.</h2>
    <p>Five attempts. Each wrong guess or <strong>Skip</strong> reveals more.</p>
    <ol className="help-steps">{clueNames.map((name, index) => <li key={name}><span>{index + 1}</span>{name}</li>)}</ol>
    <p>Type a service name. Tap a match or press <strong>Enter</strong> to guess the highlighted result.</p>
    <p><strong className="close-text">Close</strong> means your guess shares a category with the answer, using <a href={catalog.source} target="_blank" rel="noreferrer">Microsoft’s service categories</a>. Close guesses use an attempt and appear yellow in your result grid.</p>
    <p>Daily puzzles reset at midnight UTC. Find unlimited practice under <strong>Game</strong>.</p>
    <p className="fine-print">Initials omit “Azure”, “Microsoft”, and parenthesized text. Skip uses an attempt.</p>
  </>;
}

function GamePanel({ mode, date, practiceId, onNewPractice, onRecord }: { mode: Mode; date: string; practiceId: string; onNewPractice: () => void; onRecord: (record: DailyRecord) => void }) {
  const answer = mode === 'daily' ? dailyAnswer(date) : byId.get(practiceId)!;
  const storageKey = mode === 'daily' ? `daily:${date}` : 'practice';
  const [game, setGame] = useState<Game>(() => readGame(load(storageKey), answer.id));
  const [storageFailed, setStorageFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [share, setShare] = useState('');
  const [manualShare, setManualShare] = useState(false);
  const finished = isFinished(game), won = isWon(game);
  const stage = Math.min(game.attempts.length, MAX_ATTEMPTS - 1);
  const shareValue = shareText(game, mode, date, new URL(import.meta.env.BASE_URL, window.location.href).href);
  useEffect(() => {
    setStorageFailed(!save(storageKey, game));
    if (mode === 'daily' && isFinished(game)) onRecord({ date, won: isWon(game), attempts: game.attempts.length });
    // onRecord uses a state updater; only record when this puzzle changes.
  }, [game, storageKey, date, mode]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === STORAGE + storageKey && event.newValue) setGame(readGame(event.newValue, answer.id)); };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, [storageKey, answer.id]);

  function attempt(id: string | null) {
    setGame((current) => makeAttempt(current, id));
    const feedback = guessFeedback(answer.id, id);
    const message = feedback.state === 'close' ? `Close! Shared category: ${feedback.sharedCategories.join(', ')}.` : id ? 'Not quite.' : 'Attempt skipped.';
    setAnnouncement(id === answer.id ? 'Correct! Service identified.' : game.attempts.length === MAX_ATTEMPTS - 1 ? `${message} The service was ${answer.name}.` : `${message} ${clueNames[stage + 1]} clue unlocked.`);
  }
  async function copyResult() {
    try { await navigator.clipboard.writeText(shareValue); setShare('Copied!'); }
    catch { setManualShare(true); setShare('Select and copy below.'); }
  }
  return <>
    <header className="game-heading">
      <h1>Identify this Azure service</h1>
      {!finished && <span className="attempt-counter" aria-label={`${MAX_ATTEMPTS - game.attempts.length} ${MAX_ATTEMPTS - game.attempts.length === 1 ? 'attempt' : 'attempts'} remaining`}>{stage + 1} / {MAX_ATTEMPTS}</span>}
    </header>
    <section className="hint-rows" aria-label="Mystery service clues">
      {clueNames.map((name, index) => {
        const guess = game.attempts[index];
        const unlocked = Boolean(guess) || (!finished && index <= stage);
        const feedback = guess ? guessFeedback(answer.id, guess.id) : null;
        return <section key={name} aria-label={`${name} hint`} className={`hint-row ${unlocked ? 'unlocked' : 'locked'} ${!finished && index === stage ? 'current' : ''}`}>
          <div className="hint-label"><span className="hint-number" aria-hidden="true">{index + 1}</span><h2>{name}</h2>{!unlocked && <span className="sr-only">Locked</span>}</div>
          {unlocked && <div className="hint-content">{index === 0 ? <div className="icon-stage"><ServiceIcon service={answer} mystery={!finished}/></div> : <p className={index === 2 ? 'initials-clue' : ''}>{clueText(answer, index)}</p>}</div>}
          {guess && feedback && <div className={`hint-guess ${feedback.state}`}>
            <span className="guess-label">Guess {index + 1}:</span>
            {guess.id && <ServiceIcon service={byId.get(guess.id)!}/>}
            <span className="guess-name">{guess.id ? byId.get(guess.id)!.name : 'Skipped'}</span>
            <span className={`guess-result ${feedback.state === 'close' ? 'close-badge' : ''}`} title={feedback.state === 'close' ? `Shared categories: ${feedback.sharedCategories.join(', ')}` : undefined} aria-label={feedback.state === 'correct' ? 'Correct' : feedback.state === 'close' ? `Close — shared categories: ${feedback.sharedCategories.join(', ')}` : guess.id ? 'Not quite' : 'Skipped attempt'}>{feedback.state === 'correct' ? '✓' : feedback.state === 'close' ? 'Close' : guess.id ? '×' : '–'}</span>
          </div>}
        </section>;
      })}
    </section>
    <div role="status" className="sr-only">{announcement}</div>
    {!finished ? <GuessInput excluded={game.attempts.flatMap((attempt) => attempt.id ? [attempt.id] : [])} onGuess={attempt} onSkip={() => attempt(null)} lastAttempt={stage === MAX_ATTEMPTS - 1}/> : <section className="result-panel" aria-label="Game result">
      <div className="answer"><p className="result-score">{won ? `Solved in ${game.attempts.length}/${MAX_ATTEMPTS}` : 'Out of guesses'}</p><h2>{answer.name}</h2><a href={answer.url} target="_blank" rel="noreferrer">Learn more ↗</a></div>
      <div className="result-grid" role="group" aria-label="Shareable result grid">{resultTiles(game).map((tile, index) => <span key={index} className={`result-tile ${tile.state}`} role="img" aria-label={`${clueNames[index]}: ${tile.label}`}><span aria-hidden="true">{tile.emoji}</span></span>)}</div>
      <div className="game-actions"><button className="portal-button primary" onClick={copyResult}>Copy result</button><button className="portal-button" onClick={onNewPractice}>{mode === 'daily' ? 'Try practice' : 'Play again'} <span aria-hidden="true">→</span></button></div>
      {mode === 'daily' && <p className="next-puzzle">Next daily at 00:00 UTC</p>}
      <div className="share-status" role="status">{share}</div>
      {manualShare && <textarea aria-label="Shareable result" readOnly value={shareValue} onFocus={(event) => event.target.select()}/>}
    </section>}
    {storageFailed && <p className="storage-notice" role="status">Browser storage is unavailable. Progress lasts for this session only.</p>}
  </>;
}

export default function App() {
  const compactHeader = useMediaQuery('(max-height: 700px)');
  const [now, setNow] = useState(new Date());
  const date = utcDate(now);
  const [mode, setMode] = useState<Mode>('daily');
  const [practiceId, setPracticeId] = useState(() => {
    try { const id = JSON.parse(load('practice') ?? 'null')?.answerId; if (byId.get(id)?.playable) return id as string; } catch { /* Start a fresh practice puzzle. */ }
    return practiceAnswer().id;
  });
  const [dialog, setDialog] = useState<Dialog>(() => load('welcomeSeen') === 'true' ? null : 'welcome');
  const [records, setRecords] = useState(() => readRecords(load('records')));
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const sync = (event: StorageEvent) => { if (event.key === STORAGE + 'records') setRecords(readRecords(event.newValue)); };
    window.addEventListener('storage', sync);
    return () => { clearInterval(timer); window.removeEventListener('storage', sync); };
  }, []);
  function record(result: DailyRecord) {
    setRecords((previous) => {
      const merged = readRecords(JSON.stringify([...previous, ...readRecords(load('records')), result]));
      if (JSON.stringify(merged) === JSON.stringify(previous)) return previous;
      save('records', merged); return merged;
    });
  }
  function switchMode(next: Mode) { setMode(next); }
  function newPractice() { setPracticeId(practiceAnswer(practiceId).id); switchMode('practice'); }
  function closeDialog() {
    if (dialog === 'welcome') save('welcomeSeen', true);
    setDialog(null);
  }
  const dialogs: Record<Exclude<Dialog, null>, { title: string; body: ReactNode }> = {
    welcome: { title: 'Welcome to Azurdle!', body: <div className="welcome-body"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><p>Guess the daily Azure service</p></div> },
    help: { title: 'How to play', body: <Help/> },
    stats: { title: 'Statistics', body: <Statistics records={records} date={date}/> },
    directory: { title: 'Azure services', body: <Directory/> },
    about: { title: 'About Azurdle', body: <>
      <div className="about-logo"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><h2>Azurdle</h2></div>
      <p>{services.length} services · {playable.length} official icons</p>
      <p><a href={catalog.source} target="_blank" rel="noreferrer">Azure product directory ↗</a><br/><a href={catalog.iconSource} target="_blank" rel="noreferrer">Microsoft icon sources & terms ↗</a><br/><a href="https://github.com/davidgamero/azurdle" target="_blank" rel="noreferrer">Source & credits ↗</a></p>
      <p className="fine-print">Independent educational project. Not affiliated with Microsoft. Product descriptions and icons belong to their respective owners. Catalog: {catalog.fetchedAt.slice(0, 10)}. Unmatched icons use a generic fallback and are excluded from puzzles.</p>
    </> },
  };
  const navigation = <MenuBar compact={compactHeader} status={mode === 'daily' ? `Daily #${puzzleNumber(date)}` : 'Practice'} menus={[
        { label: 'Game', items: [
          { label: 'Daily', icon: 'globe', checked: mode === 'daily', action: () => switchMode('daily') },
          { label: 'Practice', icon: 'play', checked: mode === 'practice', action: () => switchMode('practice') },
          { label: 'New practice', icon: 'play', divider: true, action: newPractice },
        ] },
        { label: 'View', items: [
          { label: 'Statistics', icon: 'stats', action: () => setDialog('stats') },
          { label: 'Service directory', icon: 'folder', action: () => setDialog('directory') },
        ] },
        { label: 'Help', items: [
          { label: 'How to play', icon: 'help', action: () => setDialog('help') },
          { label: 'About Azurdle', icon: 'computer', action: () => setDialog('about') },
        ] },
      ]}/>;
  return <div className={`portal-app ${compactHeader ? 'compact-header' : ''}`}>
    <header className="portal-header"><div className="portal-header-inner"><button className="brand" onClick={() => switchMode('daily')} aria-label="Azurdle home"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><span>Azurdle</span></button>{compactHeader ? navigation : <span className="header-caption">Azure service challenge</span>}</div></header>
    <main className="game-panel">
      {!compactHeader && navigation}
      <div className="game-content"><GamePanel key={mode === 'daily' ? `daily-${date}` : practiceId} mode={mode} date={date} practiceId={practiceId} onNewPractice={newPractice} onRecord={record}/></div>
    </main>
    {dialog && <Modal title={dialogs[dialog].title} wide={dialog === 'directory'} actionLabel={dialog === 'welcome' ? "Let's do it" : 'OK'} onClose={closeDialog}>{dialogs[dialog].body}</Modal>}
  </div>;
}
