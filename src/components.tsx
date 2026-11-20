import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type KeyboardEvent } from 'react';
import { searchServices, type Service } from './game';

export function PortalIcon({ kind, size = 24 }: { kind: 'computer' | 'folder' | 'help' | 'stats' | 'globe' | 'play'; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'computer' && <><rect x="3" y="4" width="18" height="13" rx="1"/><path d="M12 17v4m-4 0h8"/></>}
    {kind === 'folder' && <path d="M3 6h7l2 3h9v11H3V6z"/>}
    {kind === 'help' && <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/></>}
    {kind === 'stats' && <><path d="M4 3v18h17M8 16v-5m5 5V6m5 10V9"/></>}
    {kind === 'globe' && <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>}
    {kind === 'play' && <path d="m8 4 12 8-12 8V4z"/>}
  </svg>;
}

export function ServiceIcon({ service, mystery = false }: { service: Service; mystery?: boolean }) {
  return <img className="service-icon" src={`${import.meta.env.BASE_URL}${service.icon}`} alt={mystery ? 'Mystery Azure service icon' : ''} draggable="false" />;
}

type MenuItem = { label: string; icon: Parameters<typeof PortalIcon>[0]['kind']; action: () => void; checked?: boolean; divider?: boolean };
export function MenuBar({ menus, status }: { menus: { label: string; items: MenuItem[] }[]; status: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [focused, setFocused] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const [itemIndex, setItemIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const dismiss = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(null); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  useEffect(() => {
    if (open !== null && itemIndex !== null) ref.current?.querySelector<HTMLButtonElement>(`[data-menu="${open}"][data-item="${itemIndex}"]`)?.focus();
  }, [open, itemIndex]);

  function close(restore = false) { if (restore && open !== null) triggers.current[open]?.focus(); setOpen(null); setItemIndex(null); }
  function moveMenu(index: number) {
    const next = (index + menus.length) % menus.length;
    setFocused(next); setOpen(next); setItemIndex(0);
  }
  return <nav ref={ref} className="menu-bar" aria-label="Application menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <div role="menubar" aria-label="Azurdle menus" className="menu-bar-items">
      {menus.map((menu, index) => <div className="menu-group" key={menu.label}>
        <button ref={(element) => { triggers.current[index] = element; }} role="menuitem" aria-haspopup="menu" aria-expanded={open === index} aria-controls={`portal-menu-${index}`} tabIndex={focused === index ? 0 : -1} className={`menu-trigger ${open === index ? 'active' : ''}`} onFocus={() => setFocused(index)} onClick={() => { setOpen(open === index ? null : index); setItemIndex(null); }} onPointerEnter={() => { if (open !== null && open !== index) { setOpen(index); setItemIndex(null); } }} onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(index); setItemIndex(event.key === 'ArrowUp' ? menu.items.length - 1 : 0); }
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + menus.length) % menus.length; setFocused(next); triggers.current[next]?.focus(); if (open !== null) { setOpen(next); setItemIndex(null); } }
          if (event.key === 'Escape') close(true);
        }}>{menu.label}<span className="menu-chevron" aria-hidden="true">⌄</span></button>
        {open === index && <div role="menu" aria-label={menu.label} id={`portal-menu-${index}`} className="portal-menu" onKeyDown={(event) => {
          const current = Number((event.target as HTMLElement).dataset.item ?? 0);
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setItemIndex(event.key === 'Home' ? 0 : event.key === 'End' ? menu.items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + menu.items.length) % menu.items.length); }
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); moveMenu(index + (event.key === 'ArrowRight' ? 1 : -1)); }
          if (event.key === 'Escape') { event.preventDefault(); close(true); }
        }}>
          {menu.items.map((item, itemNumber) => <button key={item.label} role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} tabIndex={-1} data-menu={index} data-item={itemNumber} className={item.divider ? 'menu-divider' : ''} onClick={() => { close(true); item.action(); }}><PortalIcon kind={item.icon} size={21}/><span>{item.label}</span>{item.checked && <span className="menu-check" aria-hidden="true">✓</span>}</button>)}
        </div>}
      </div>)}
    </div>
    <span className="menu-status">{status}</span>
  </nav>;
}

export function Modal({ title, children, onClose, wide = false, actionLabel = 'OK' }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; actionLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-header"><h2 id={titleId}>{title}</h2><button className="close-control" onClick={onClose} aria-label="Close dialog">×</button></div>
    <div className="modal-body">{children}</div>
    <div className="modal-footer"><button className="portal-button primary" onClick={onClose}>{actionLabel}</button></div>
  </dialog>;
}

export function GuessInput({ excluded, onGuess, onSkip, lastAttempt }: { excluded: string[]; onGuess: (id: string) => void; onSkip: () => void; lastAttempt: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const [suggestionSpace, setSuggestionSpace] = useState(280);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const results = searchServices(query, excluded).slice(0, 50);
  const expanded = open;
  useEffect(() => {
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [active, query, expanded]);
  useEffect(() => {
    if (!expanded) return;
    const updateSpace = () => {
      const top = inputRef.current?.getBoundingClientRect().top ?? 0;
      setSuggestionSpace(Math.max(0, Math.min(280, top - (window.visualViewport?.offsetTop ?? 0) - 8)));
    };
    updateSpace();
    window.addEventListener('resize', updateSpace);
    window.addEventListener('scroll', updateSpace, true);
    window.visualViewport?.addEventListener('resize', updateSpace);
    window.visualViewport?.addEventListener('scroll', updateSpace);
    return () => {
      window.removeEventListener('resize', updateSpace);
      window.removeEventListener('scroll', updateSpace, true);
      window.visualViewport?.removeEventListener('resize', updateSpace);
      window.visualViewport?.removeEventListener('scroll', updateSpace);
    };
  }, [expanded]);

  function submit(service?: Service) {
    const candidate = service ?? (query.trim() ? results[active] : undefined);
    if (!candidate) { setOpen(true); setError(query.trim() ? 'No matching service. Try another name.' : 'Type a service name first.'); inputRef.current?.focus(); return; }
    onGuess(candidate.id);
    inputRef.current?.focus({ preventScroll: true });
    setQuery(''); setOpen(false); setActive(0); setError('');
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setOpen(true);
      setActive((index) => Math.max(0, Math.min(results.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
    else if (event.key === 'Enter') { event.preventDefault(); submit(); }
  }
  return <form className="guess-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <label htmlFor="service-search" className="sr-only">Which Azure service is this?</label>
    <div className="guess-input-row">
      <div className="autocomplete" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
        <div className="input-shell"><span className="search-symbol" aria-hidden="true">⌕</span><input id="service-search" ref={inputRef} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls="service-options" aria-activedescendant={expanded && results[active] ? `option-${results[active].id}` : undefined} aria-describedby="search-hint" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="go" placeholder="Search Azure services…" value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); setError(''); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown}/></div>
        {expanded && <ul id="service-options" role="listbox" aria-label="Azure services" ref={listRef} className="suggestions" style={{ '--suggestion-space': `${suggestionSpace}px` } as CSSProperties}>
          {results.map((service, index) => <li id={`option-${service.id}`} key={service.id} role="option" aria-selected={index === active} data-index={index} className={index === active ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => submit(service)} onMouseMove={() => setActive(index)}><span>{service.name.replace(/^Azure\s+/i, '')}</span></li>)}
          {!results.length && <li className="no-results" role="presentation">No matching services. Try a shorter name or acronym.</li>}
        </ul>}
      </div>
    </div>
    <div className="game-actions"><button type="submit" className="portal-button primary">Guess <span aria-hidden="true">↵</span></button><button type="button" className="portal-button" onClick={onSkip} title={lastAttempt ? 'Use the final attempt and reveal the answer' : 'Skip this attempt to unlock a clue'}>{lastAttempt ? 'Reveal answer' : 'Next clue'} <span aria-hidden="true">→</span></button></div>
    <div id="search-hint" className={error ? 'input-hint error' : 'sr-only'} aria-live="polite">{error || 'Search by name or acronym. The closest match is highlighted. Tap a suggestion or press Enter to guess. Arrow keys change the highlighted match. Next clue uses an attempt.'}</div>
  </form>;
}
