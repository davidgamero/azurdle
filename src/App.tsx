import { useEffect, useRef, useState, type ReactNode } from 'react';
import catalog from './data/catalog.json' with { type: 'json' };
import { byId, clueNames, clueText, dailyAnswer, getStats, isFinished, isWon, makeAttempt, playable, practiceAnswer, puzzleNumber, readGame, readRecords, searchServices, services, shareText, shortName, utcDate, type DailyRecord, type Game, type Mode } from './game';
import { GuessInput, MenuBar, Modal, PixelIcon, ServiceIcon, TitleBar } from './components';

const STORAGE = 'azurdle:v1:';
function load(key: string) { try { return localStorage.getItem(STORAGE + key); } catch { return null; } }
function save(key: string, value: unknown) { try { localStorage.setItem(STORAGE + key, JSON.stringify(value)); return true; } catch { return false; } }
type Dialog = 'help' | 'stats' | 'directory' | 'about' | null;

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
      <ServiceIcon service={service}/><div><strong>{service.name} ↗</strong><p>{service.description}</p>{!service.playable && <small>Generic icon · not a puzzle answer</small>}</div>
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
    <p>Six attempts. Each wrong guess or <strong>Next clue</strong> reveals more.</p>
    <ol className="help-steps">{clueNames.map((name, index) => <li key={name}><span>{index + 1}</span>{name}</li>)}</ol>
    <p>Type a service name, select a match, then press <strong>Guess</strong>.</p>
    <p>Daily puzzles reset at midnight UTC. Find unlimited practice under <strong>Game</strong>.</p>
    <p className="fine-print">Name clues omit “Azure”, “Microsoft”, and parenthesized text. Next clue uses an attempt.</p>
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
  const stage = Math.min(game.attempts.length, 5);
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
    setAnnouncement(id === answer.id ? 'Correct! Service identified.' : game.attempts.length === 5 ? `The service was ${answer.name}.` : `${id ? 'Not quite.' : 'Attempt skipped.'} ${clueNames[stage + 1]} clue unlocked.`);
  }
  async function copyResult() {
    try { await navigator.clipboard.writeText(shareValue); setShare('Copied!'); }
    catch { setManualShare(true); setShare('Select and copy below.'); }
  }
  return <>
    <header className="game-heading">
      <h1>{finished ? (won ? `Solved in ${game.attempts.length}/6` : 'Out of guesses') : 'Which service?'}</h1>
      {!finished && <span className="attempt-counter" aria-label={`${6 - game.attempts.length} ${6 - game.attempts.length === 1 ? 'attempt' : 'attempts'} remaining`}>{stage + 1} / 6</span>}
    </header>
    <section className={`mystery-card ${finished ? 'complete' : ''}`} aria-label="Mystery service clues">
      <div className="icon-stage"><ServiceIcon service={answer} mystery={!finished}/></div>
      {finished ? <div className="answer"><h2>{answer.name}</h2><p>{answer.description}</p><a href={answer.url} target="_blank" rel="noreferrer">Learn more ↗</a></div> : <ol className="attempt-track" aria-label="Clue progression">{clueNames.map((name, index) => {
        const id = game.attempts[index]?.id;
        return <li key={name} aria-label={`Attempt ${index + 1}: ${index < game.attempts.length ? id ? 'incorrect' : 'skipped' : index === stage ? 'current' : 'unused'}`} className={index < stage ? id ? 'wrong' : 'skipped' : index === stage ? 'current' : ''}><span aria-hidden="true">{index < stage ? id ? '×' : '–' : index + 1}</span></li>;
      })}</ol>}
      {!finished && stage > 0 && <section className="revealed-clues" aria-label="Revealed clues">
        <p className="category-clue"><span className="sr-only">Category: </span>{clueText(answer, 1)}</p>
        {stage >= 2 && <p className="name-clue" aria-label={`Name clue: ${stage >= 3 ? clueText(answer, 3) : shortName(answer).split(/\s+/).map((word) => word.length).join(', ') + ' letters per word'}`}><span className="sr-only">Name: </span>{stage >= 3 ? shortName(answer).split(/\s+/).map((word) => word[0] + '·'.repeat(word.length - 1)).join('  ') : clueText(answer, 2)}</p>}
        {stage >= 4 && <p className="description-clue">{clueText(answer, stage === 5 ? 5 : 4)}</p>}
      </section>}
    </section>
    <div role="status" className="sr-only">{announcement}</div>
    {!finished ? <GuessInput excluded={game.attempts.flatMap((attempt) => attempt.id ? [attempt.id] : [])} onGuess={attempt} onSkip={() => attempt(null)} lastAttempt={stage === 5}/> : <section className="result-panel" aria-label="Game result">
      <span className="sr-only">{won ? `Solved in ${game.attempts.length}/6` : 'Out of guesses'}</span>
      <div className="game-actions"><button className="xp-button primary" onClick={copyResult}>Copy result</button><button className="xp-button" onClick={onNewPractice}>{mode === 'daily' ? 'Try practice' : 'Play again'} <span aria-hidden="true">→</span></button></div>
      {mode === 'daily' && <p className="next-puzzle">Next daily at 00:00 UTC</p>}
      <div className="share-status" role="status">{share}</div>
      {manualShare && <textarea aria-label="Shareable result" readOnly value={shareValue} onFocus={(event) => event.target.select()}/>}
    </section>}
    {game.attempts.some(({ id }) => id) && <section className="guess-history" aria-label="Your attempts"><ol className="guess-list">{game.attempts.map(({ id }, index) => id && <li key={index}>
      <ServiceIcon service={byId.get(id)!}/><span className="guess-name">{byId.get(id)!.name}</span><span className={`guess-result ${id === answer.id ? 'correct' : ''}`} aria-label={id === answer.id ? 'Correct' : 'Not quite'}>{id === answer.id ? '✓' : '×'}</span>
    </li>)}</ol></section>}
    {storageFailed && <p className="storage-notice" role="status">Browser storage is unavailable. Progress lasts for this session only.</p>}
  </>;
}

export default function App() {
  const [now, setNow] = useState(new Date());
  const date = utcDate(now);
  const [mode, setMode] = useState<Mode>('daily');
  const [practiceId, setPracticeId] = useState(() => {
    try { const id = JSON.parse(load('practice') ?? 'null')?.answerId; if (byId.get(id)?.playable) return id as string; } catch { /* Start a fresh practice puzzle. */ }
    return practiceAnswer().id;
  });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [records, setRecords] = useState(() => readRecords(load('records')));
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const startRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const sync = (event: StorageEvent) => { if (event.key === STORAGE + 'records') setRecords(readRecords(event.newValue)); };
    window.addEventListener('storage', sync);
    return () => { clearInterval(timer); window.removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    if (!startOpen) return;
    const click = (event: PointerEvent) => { if (!startRef.current?.contains(event.target as Node)) setStartOpen(false); };
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setStartOpen(false); };
    document.addEventListener('pointerdown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', click); document.removeEventListener('keydown', key); };
  }, [startOpen]);
  function record(result: DailyRecord) {
    setRecords((previous) => {
      const merged = readRecords(JSON.stringify([...previous, ...readRecords(load('records')), result]));
      if (JSON.stringify(merged) === JSON.stringify(previous)) return previous;
      save('records', merged); return merged;
    });
  }
  function switchMode(next: Mode) { setMode(next); setMinimized(false); }
  function newPractice() { setPracticeId(practiceAnswer(practiceId).id); switchMode('practice'); }
  function restore() { setMinimized(false); setStartOpen(false); }
  const dialogs: Record<Exclude<Dialog, null>, { title: string; body: ReactNode }> = {
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
  return <div className="desktop">
    <div className="wallpaper" aria-hidden="true"><div className="cloud cloud-one"/><div className="cloud cloud-two"/><div className="hill hill-back"/><div className="hill hill-front"/></div>
    <main className={`xp-window main-window ${maximized ? 'maximized' : ''} ${minimized ? 'minimized' : ''}`}>
      <TitleBar title="Azurdle"><button aria-label="Minimize window" onClick={() => setMinimized(true)}>_</button><button aria-label={maximized ? 'Restore window' : 'Maximize window'} onClick={() => setMaximized(!maximized)}>□</button><button className="close-control" aria-label="Hide window" onClick={() => setMinimized(true)}>×</button></TitleBar>
      <MenuBar status={mode === 'daily' ? `Daily #${puzzleNumber(date)}` : 'Practice'} menus={[
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
      ]}/>
      <div className="game-content"><GamePanel key={mode === 'daily' ? `daily-${date}` : practiceId} mode={mode} date={date} practiceId={practiceId} onNewPractice={newPractice} onRecord={record}/></div>
    </main>
    {minimized && <button className="restore-prompt xp-button" onClick={restore}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/>Open Azurdle</button>}
    <footer className="taskbar">
      <div className="start-area" ref={startRef}>
        <button className={`start-button ${startOpen ? 'pressed' : ''}`} onClick={() => setStartOpen(!startOpen)} aria-expanded={startOpen} aria-controls="start-menu"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><span>start</span></button>
        {startOpen && <div id="start-menu" className="start-menu"><button onClick={restore}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/>Azurdle</button></div>}
      </div>
      <button className={`task-button ${minimized ? '' : 'active'}`} onClick={() => setMinimized(!minimized)}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><span>Azurdle</span></button>
      <div className="system-tray"><time dateTime={now.toISOString()}>{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time></div>
    </footer>
    {dialog && <Modal title={dialogs[dialog].title} wide={dialog === 'directory'} onClose={() => setDialog(null)}>{dialogs[dialog].body}</Modal>}
  </div>;
}
