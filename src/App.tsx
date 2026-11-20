import { useEffect, useRef, useState, type ReactNode } from 'react';
import catalog from './data/catalog.json' with { type: 'json' };
import { byId, clueNames, clueText, dailyAnswer, getStats, isFinished, isWon, makeAttempt, playable, practiceAnswer, puzzleNumber, readGame, readRecords, searchServices, services, shareText, shortName, utcDate, type DailyRecord, type Game, type Mode } from './game';
import { GuessInput, Modal, PixelIcon, ServiceIcon, TitleBar } from './components';

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
    <p className="dialog-intro">Your field guide to the cloud. {services.length} products from Microsoft’s Azure directory.</p>
    <div className="directory-filters"><input aria-label="Search directory" placeholder="Find a service…" value={query} onChange={(event) => setQuery(event.target.value)}/><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{categories.map((name) => <option key={name}>{name}</option>)}</select></div>
    <div className="directory-count" role="status">{results.length} services found</div>
    <div className="directory-list">{results.map((service) => <a key={service.id} href={service.url} target="_blank" rel="noreferrer" className="directory-service"><ServiceIcon service={service}/><div><strong>{service.name} <span aria-hidden="true">↗</span></strong><p>{service.description}</p><small>{service.categories.join(' · ')}{!service.playable && ' · Generic icon; not in the puzzle pool'}</small></div></a>)}{!results.length && <p>No services match those filters.</p>}</div>
  </>;
}

function Statistics({ records, date }: { records: DailyRecord[]; date: string }) {
  const stats = getStats(records, date);
  return <><p className="dialog-intro">Your daily cloud report. Looking good, administrator.</p>
    <div className="stats-grid">{[[stats.played, 'Played'], [`${stats.winRate}%`, 'Win rate'], [stats.streak, 'Streak'], [stats.best, 'Best streak']].map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <h3 className="section-label">GUESS DISTRIBUTION</h3>
    <div className="distribution">{stats.distribution.map((count, index) => <div key={index}><span>{index + 1}</span><div style={{ width: `${Math.max(8, count / Math.max(1, ...stats.distribution) * 100)}%` }}>{count}</div></div>)}</div>
    <p className="fine-print">Daily puzzles count toward your stats. Skips count as attempts. Progress is saved in this browser.</p>
  </>;
}

function Help() {
  return <><div className="dialog-heading"><PixelIcon kind="help" size={44}/><div><h2>Welcome to Azurdle.</h2><p>Big cloud knowledge. Small desktop energy.</p></div></div>
    <p>Identify the mystery Azure service in <strong>six attempts</strong>. Everyone gets the same daily service, with a new puzzle at midnight UTC.</p>
    <ol className="help-steps">{clueNames.map((name, index) => <li key={name}><span>{index + 1}</span><div><strong>{name}</strong><p>{['Start with only the official service icon.', 'See the categories in Microsoft’s product directory.', 'See the length of each word in the service name.', 'Reveal the first letter of each word.', 'Read the first half of the product description.', 'Read the complete description from the Azure directory.'][index]}</p></div></li>)}</ol>
    <p>A wrong guess or a skip uses an attempt and unlocks the next clue. Search for a service, select it, then press <strong>Guess</strong>. Previously guessed services are excluded.</p>
    <p className="info-note">Name clues omit a leading “Azure” or “Microsoft” and text in parentheses. Need more cloud time? Practice mode has unlimited puzzles.</p>
  </>;
}

function GamePanel({ mode, date, practiceId, onNewPractice, onRecord, onDialog }: { mode: Mode; date: string; practiceId: string; onNewPractice: () => void; onRecord: (record: DailyRecord) => void; onDialog: (dialog: Dialog) => void }) {
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
    try { await navigator.clipboard.writeText(shareValue); setShare('Copied to clipboard!'); }
    catch { setManualShare(true); setShare('Select and copy your result below.'); }
  }
  return <>
    <header className="game-header"><div><div className="wordmark">azurdle<span className="wordmark-spark">✦</span></div><p>A little cloud. A little nostalgia.</p></div><div className="puzzle-label"><span>{mode === 'daily' ? 'DAILY CHALLENGE' : 'FREE PLAY'}</span><strong>{mode === 'daily' ? `No. ${String(puzzleNumber(date)).padStart(3, '0')}` : 'Practice'}</strong><small>{mode === 'daily' ? new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'No limits. No pressure.'}</small></div></header>
    <div className="game-intro"><span className="online-dot"/><h1>{finished ? (won ? 'Connection established!' : 'Service discovered.') : 'One service. Six chances. How cloud are you?'}</h1></div>
    <section className={`mystery-card ${finished ? 'complete' : ''}`} aria-label="Mystery service clues">
      <div className="card-kicker"><span>{finished ? 'SERVICE IDENTIFIED' : 'MYSTERY SERVICE'}</span><span>{finished ? (won ? '✓ SUCCESS' : 'SESSION COMPLETE') : `CLUE ${String(stage + 1).padStart(2, '0')} / 06`}</span></div>
      <div className="icon-stage"><div className="icon-halo"><ServiceIcon service={answer} mystery={!finished}/></div><div className="icon-caption">{finished ? answer.name : 'Look familiar?'}</div><p>{finished ? answer.description : 'Somewhere in Azure, this icon has a job.'}</p></div>
      {finished && <a className="learn-link" href={answer.url} target="_blank" rel="noreferrer">Meet {answer.name} <span aria-hidden="true">↗</span></a>}
      <ol className="clue-track" aria-label="Clue progression">{clueNames.map((name, index) => <li key={name} className={`${index <= stage || finished ? 'unlocked' : ''} ${index === stage && !finished ? 'current' : ''}`}><span>{index < stage || finished ? '✓' : index + 1}</span><small>{name}</small></li>)}</ol>
    </section>
    {!finished && stage > 0 && <section className="revealed-clues" aria-label="Revealed clues">{Array.from({ length: stage }, (_, i) => i + 1).map((index) => <div key={index} className={index === stage ? 'latest' : ''}><span className="clue-label">{clueNames[index]}</span><div className={index === 2 ? 'name-shape' : ''}>{clueText(answer, index)}{index === 2 && <small>{shortName(answer).split(/\s+/).length} words · excludes Azure / Microsoft prefix</small>}</div></div>)}</section>}
    <div role="status" className="sr-only">{announcement}</div>
    {!finished ? <><GuessInput excluded={game.attempts.flatMap((attempt) => attempt.id ? [attempt.id] : [])} onGuess={attempt}/><div className="skip-row"><span>{6 - game.attempts.length} {6 - game.attempts.length === 1 ? 'attempt' : 'attempts'} remaining</span><button className="text-button" onClick={() => attempt(null)}>{stage === 5 ? 'Give up & reveal service' : 'Skip & reveal next clue'} <span aria-hidden="true">→</span></button></div></> : <section className={`result-panel ${won ? 'win' : 'loss'}`} aria-label="Game result"><div className="result-symbol" aria-hidden="true">{won ? '✓' : 'i'}</div><div><h2>{won ? `Nicely done. ${game.attempts.length}/6!` : 'Another service for your cloud toolkit.'}</h2><p>{mode === 'daily' ? 'Your daily result is saved. Next puzzle at 00:00 UTC.' : 'That’s one more Azure service under your belt.'}</p></div><div className="result-actions"><button className="xp-button primary" onClick={copyResult}>Copy result</button><button className="xp-button" onClick={onNewPractice}>{mode === 'daily' ? 'Try practice' : 'Play again'} <span aria-hidden="true">→</span></button></div><div className="share-status" role="status">{share}</div>{manualShare && <textarea aria-label="Shareable result" readOnly value={shareValue} onFocus={(event) => event.target.select()}/>}</section>}
    <section className="guess-history" aria-label="Your attempts"><div className="history-heading"><h2>YOUR GUESSES</h2><div className="attempt-dots" aria-label={`${game.attempts.length} of 6 attempts used`}>{Array.from({ length: 6 }, (_, index) => <span key={index} className={game.attempts[index] ? game.attempts[index].id === answer.id ? 'correct' : game.attempts[index].id ? 'wrong' : 'skipped' : ''}/>)}</div></div>{!game.attempts.length ? <div className="empty-history"><span aria-hidden="true">⌁</span><p>A fresh start. Trust your cloud instincts.</p></div> : <ol className="guess-list">{game.attempts.map(({ id }, index) => <li key={index} className={id === answer.id ? 'correct' : ''}><span className="guess-number">{String(index + 1).padStart(2, '0')}</span>{id ? <ServiceIcon service={byId.get(id)!}/> : <span className="skip-icon">→</span>}<span className="guess-name">{id ? byId.get(id)!.name : 'Skipped for a clue'}</span><span className={`guess-result ${id === answer.id ? 'correct' : ''}`}>{id === answer.id ? '✓ Correct' : id ? '× Not quite' : '— Skipped'}</span></li>)}</ol>}</section>
    {storageFailed && <p className="storage-notice" role="status">Browser storage is unavailable. Progress will last for this session only.</p>}
    <div className="game-bottom"><span><span className="tiny-cloud" aria-hidden="true">☁</span> Powered by curiosity, not a cloud bill.</span><button className="text-button" onClick={() => onDialog('help')}>How to play</button></div>
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
  const stats = getStats(records, date);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const sync = (event: StorageEvent) => { if (event.key === STORAGE + 'records') setRecords(readRecords(event.newValue)); };
    window.addEventListener('storage', sync);
    return () => { clearInterval(timer); window.removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    if (!startOpen) return;
    const click = (event: MouseEvent) => { if (!startRef.current?.contains(event.target as Node)) setStartOpen(false); };
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setStartOpen(false); };
    document.addEventListener('mousedown', click); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, [startOpen]);
  function record(result: DailyRecord) {
    setRecords((previous) => {
      const merged = readRecords(JSON.stringify([...previous, ...readRecords(load('records')), result]));
      if (JSON.stringify(merged) === JSON.stringify(previous)) return previous;
      save('records', merged); return merged;
    });
  }
  function switchMode(next: Mode) { setMode(next); setMinimized(false); setStartOpen(false); }
  function newPractice() { setPracticeId(practiceAnswer(practiceId).id); switchMode('practice'); }
  function openDialog(next: Dialog) { setDialog(next); setStartOpen(false); }
  const dialogs: Record<Exclude<Dialog, null>, { title: string; body: ReactNode }> = {
    help: { title: 'Azurdle Help and Support', body: <Help/> },
    stats: { title: 'My Statistics — Cloud Performance', body: <Statistics records={records} date={date}/> },
    directory: { title: 'Azure Service Directory', body: <Directory/> },
    about: { title: 'About Azurdle', body: <><div className="about-logo"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><h2>azurdle <small>Cloud Professional Edition</small></h2></div><p>A daily Azure-service guessing game, with a desktop straight out of your fondest computing memories.</p><p>Learn a service, recognize its icon, and build your cloud vocabulary. No account needed.</p><dl className="about-details"><dt>Catalog</dt><dd>{services.length} distinct products · {playable.length} icon-based puzzles</dd><dt>Source date</dt><dd>{catalog.fetchedAt.slice(0, 10)}</dd><dt>Descriptions</dt><dd><a href={catalog.source} target="_blank" rel="noreferrer">Microsoft Azure product directory ↗</a></dd><dt>Service icons</dt><dd><a href={catalog.iconSource} target="_blank" rel="noreferrer">Official Azure architecture icons ↗</a></dd></dl><p className="fine-print">The complete published product directory is searchable. Products without a matched official icon use a generic cloud icon in search and are excluded from puzzles. Descriptions are the complete summaries published in that directory.</p><p className="fine-print">An independent educational fan project. Not affiliated with Microsoft. Azure service icons and product descriptions belong to Microsoft and their respective owners; icons are used as learning materials under Microsoft’s icon terms. The desktop artwork and Azurdle identity are original.</p><a href="https://github.com/davidgamero/azurdle" target="_blank" rel="noreferrer">View source on GitHub ↗</a></> },
  };
  return <div className="desktop">
    <div className="wallpaper" aria-hidden="true"><div className="cloud cloud-one"/><div className="cloud cloud-two"/><div className="hill hill-back"/><div className="hill hill-front"/></div>
    <nav className="desktop-shortcuts" aria-label="Desktop shortcuts"><button onClick={() => switchMode('daily')}><PixelIcon kind="computer" size={42}/><span>My Azurdle</span></button><button onClick={() => openDialog('directory')}><PixelIcon kind="folder" size={42}/><span>Azure Services</span></button><button onClick={() => openDialog('stats')}><PixelIcon kind="stats" size={42}/><span>My Statistics</span></button><button onClick={() => openDialog('help')}><PixelIcon kind="help" size={42}/><span>How to Play</span></button></nav>
    <main className={`xp-window main-window ${maximized ? 'maximized' : ''} ${minimized ? 'minimized' : ''}`}>
      <TitleBar title="Azurdle — Cloud Professional Edition"><button aria-label="Minimize window" onClick={() => setMinimized(true)}>_</button><button aria-label={maximized ? 'Restore window' : 'Maximize window'} onClick={() => setMaximized(!maximized)}>□</button><button className="close-control" aria-label="Hide window" onClick={() => setMinimized(true)}>×</button></TitleBar>
      <nav className="menu-bar" aria-label="Application menu"><button onClick={() => switchMode('daily')}><u>G</u>ame</button><button onClick={() => openDialog('stats')}><u>S</u>tatistics</button><button onClick={() => openDialog('directory')}><u>D</u>irectory</button><button onClick={() => openDialog('help')}><u>H</u>elp</button><button onClick={() => openDialog('about')}><u>A</u>bout</button><span className="menu-brand">☁</span></nav>
      <div className="address-bar"><span>Address</span><div><PixelIcon kind="folder" size={19}/><span>C:\Cloud\Azurdle\{mode === 'daily' ? 'daily' : 'practice'}.exe</span><span className="address-arrow">▾</span></div><span className="go-indicator">➜</span><span>Go</span></div>
      <div className="window-content"><aside className="sidebar"><div className="sidebar-box"><h2>Cloud Tasks <span>⌃</span></h2><div className="sidebar-links"><button className={mode === 'daily' ? 'selected' : ''} onClick={() => switchMode('daily')}><PixelIcon kind="globe" size={21}/><span>Daily challenge</span>{mode === 'daily' && <b>›</b>}</button><button className={mode === 'practice' ? 'selected' : ''} onClick={() => switchMode('practice')}><PixelIcon kind="play" size={21}/><span>Practice mode</span>{mode === 'practice' && <b>›</b>}</button><button onClick={() => openDialog('stats')}><PixelIcon kind="stats" size={21}/><span>My statistics</span></button></div></div><div className="sidebar-box"><h2>Other Places <span>⌃</span></h2><div className="sidebar-links"><button onClick={() => openDialog('directory')}><PixelIcon kind="folder" size={21}/><span>Service directory</span></button><button onClick={() => openDialog('help')}><PixelIcon kind="help" size={21}/><span>How to play</span></button></div></div><div className="sidebar-box details-box"><h2>Details <span>⌃</span></h2><div className="sidebar-details"><strong>{mode === 'daily' ? 'Daily challenge' : 'Practice mode'}</strong><p>{mode === 'daily' ? 'A new connection, every day.' : 'A little more cloud time.'}</p><dl><dt>Services</dt><dd>{services.length}</dd><dt>Attempts</dt><dd>6</dd><dt>Resets</dt><dd>{mode === 'daily' ? '00:00 UTC' : 'Anytime'}</dd></dl><div className="streak-badge"><span aria-hidden="true">✦</span><strong>{stats.streak}</strong> day streak</div></div></div><div className="sidebar-note"><span>☁</span><p>Your cloud knowledge<br/>looks good from here.</p></div></aside>
      <div className="game-content"><GamePanel key={mode === 'daily' ? `daily-${date}` : practiceId} mode={mode} date={date} practiceId={practiceId} onNewPractice={newPractice} onRecord={record} onDialog={openDialog}/></div></div>
      <footer className="window-status"><span><span className="online-dot"/> {mode === 'daily' ? 'Connected to today’s challenge' : 'Practice session ready'}</span><span>{services.length} services</span><span><PixelIcon kind="globe" size={15}/> Internet</span><i aria-hidden="true">▥</i></footer>
    </main>
    {minimized && <button className="restore-prompt" onClick={() => setMinimized(false)}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><span>Your cloud is still here.<small>Click to reopen Azurdle</small></span></button>}
    <div className="desktop-watermark" aria-hidden="true">azurdle<span>Cloud Professional Edition</span></div>
    <footer className="taskbar"><div className="start-area" ref={startRef}><button className={`start-button ${startOpen ? 'pressed' : ''}`} onClick={() => setStartOpen(!startOpen)} aria-expanded={startOpen} aria-controls="start-menu"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><span>start</span></button>{startOpen && <div id="start-menu" className="start-menu"><div className="start-user"><PixelIcon kind="computer" size={34}/><strong>Cloud Explorer</strong></div><button onClick={() => switchMode('daily')}><PixelIcon kind="globe"/>Daily challenge</button><button onClick={newPractice}><PixelIcon kind="play"/>New practice puzzle</button><button onClick={() => openDialog('directory')}><PixelIcon kind="folder"/>Azure service directory</button><button onClick={() => openDialog('stats')}><PixelIcon kind="stats"/>My statistics</button><button onClick={() => openDialog('help')}><PixelIcon kind="help"/>Help and Support</button><div className="start-footer">Welcome to your little corner of the cloud.</div></div>}</div><button className={`task-button ${minimized ? '' : 'active'}`} onClick={() => setMinimized(!minimized)}><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><span>Azurdle</span></button><div className="system-tray"><span className="tray-connected" title="Local game ready">▣</span><span className="tray-mode">{mode === 'daily' ? 'Daily' : 'Practice'}</span><time dateTime={now.toISOString()}>{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time></div></footer>
    {dialog && <Modal title={dialogs[dialog].title} wide={dialog === 'directory'} onClose={() => setDialog(null)}>{dialogs[dialog].body}</Modal>}
  </div>;
}
