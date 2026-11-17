import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Archive, ArrowLeft, ArrowUpRight, Candy, ChevronLeft, ChevronRight, Clock3, CloudOff, FlaskConical, Ghost, Hourglass, RotateCw, Sparkles, XCircle } from 'lucide-react';
import { platformRequest } from '../lib/platform';
import { ApiError, type Message } from '../lib/game';
import '../styles/heist-history.css';
import LoadingState from './LoadingState';

type Reward = { state: string; grade: string; score: number; token_id: string | null };
// 'unknown' is used only when an older backend has no summary endpoint.
type Item = { session_id: string; created: number; campaign_name: string | null; research?: number; withdrawn?: number; status: string | null; prompts_used: number | null; preview: string | null; transcript: 'available' | 'hosted' | 'unavailable' | 'unknown'; current_season: boolean; reward: Reward | null };
type Detail = { id: string; created: number; status: string; current_season: boolean; attempts_remaining: number; messages: Message[]; minted: boolean; token_id: string | null; reward: Reward | null };
type Loaded = { detail: Detail } | { missing: true } | { error: string };
type Filter = 'all' | 'won' | 'lost' | 'open' | 'unavailable';

const HOSTED_SITE = (import.meta.env.PUBLIC_HOSTED_SITE || 'https://caspy-prompt-heist.vercel.app').replace(/\/$/, '');
const date = (value: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value * 1000));
const day = (value: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' }).format(new Date(value * 1000));
const outcomes: { [key: string]: { label: string; tone: string; icon: typeof Ghost; note: string } } = {
  won: { label: 'Won', tone: 'won', icon: Sparkles, note: 'You charmed Caspy into sharing.' },
  lost: { label: 'No candy', tone: 'lost', icon: XCircle, note: 'Caspy kept his candy this time.' },
  active: { label: 'In progress', tone: 'active', icon: Clock3, note: 'This heist still has prompts left.' },
  pending_review: { label: 'Under review', tone: 'pending', icon: Hourglass, note: 'The judge has not confirmed a result yet.' },
  void: { label: 'Interrupted', tone: 'void', icon: XCircle, note: 'The reply was cut off, so this heist was closed.' },
};
const rewardState: { [key: string]: string } = { earned: 'Artwork not created yet', needs_configuration: 'Artwork temporarily unavailable', generating: 'Artwork being created', ready: 'Ready to mint', failed: 'Artwork request failed', uncertain: 'Artwork request interrupted' };
const unavailable = (item: Item) => item.transcript === 'hosted' || item.transcript === 'unavailable';
const matches = (item: Item, filter: Filter) => filter === 'all' ? true : filter === 'unavailable' ? unavailable(item)
  : filter === 'won' ? item.status === 'won' : filter === 'lost' ? item.status === 'lost' : ['active', 'pending_review', 'void'].includes(item.status || '');

function Badge({ status }: { status: string }) {
  const item = outcomes[status];
  if (!item) return <span className="history-badge" data-tone="void">Recorded</span>;
  const Icon = item.icon;
  return <span className="history-badge" data-tone={item.tone}><Icon size={13} aria-hidden="true" />{item.label}</span>;
}
function PromptDots({ used }: { used: number }) {
  return <span className="history-dots" aria-hidden="true">{[0, 1, 2].map(i => <i key={i} data-used={i < used} />)}</span>;
}
function RewardCard({ reward }: { reward: Reward }) {
  return <div className="history-reward-card" data-grade={reward.grade}>
    <span className="history-grade" aria-label={`Grade ${reward.grade}`}>{reward.grade}</span>
    <div><b>{reward.token_id ? `Candy #${reward.token_id}` : 'Earned candy'}</b><span>{reward.score}/100 · {reward.token_id ? 'Minted' : rewardState[reward.state] || reward.state.replaceAll('_', ' ')}</span></div>
    {reward.token_id ? <a className="inline-link" href="/collection">View in collection <ArrowUpRight size={15} /></a> : <Candy size={22} aria-hidden="true" />}
  </div>;
}

export default function HeistHistory() {
  const [items, setItems] = useState<Item[]>([]);
  const [requested] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(location.search).get('session') || '');
  const [selected, setSelected] = useState('');
  const [view, setView] = useState<'list' | 'detail'>(() => requested ? 'detail' : 'list');
  const [filter, setFilter] = useState<Filter>('all');
  const [loaded, setLoaded] = useState<{ [id: string]: Loaded }>({});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [opening, setOpening] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setListError('');
    (async () => {
      try {
        return (await platformRequest<{ heists: Item[] }>('/account/heists')).heists;
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
        // An older backend has no summary endpoint; outcomes then load on open.
        const old = await platformRequest<{ contributions: Item[] }>('/account/contributions');
        return old.contributions.map(row => ({ ...row, status: null, prompts_used: null, preview: null, transcript: 'unknown' as const, current_season: false, reward: null }));
      }
    })().then(list => {
      if (!active) return;
      setItems(list);
      // Open the requested heist, otherwise the newest one that can be read.
      setSelected(previous => previous || (list.some(item => item.session_id === requested) ? requested : (list.find(item => !unavailable(item)) || list[0])?.session_id || ''));
    }).catch(() => { if (active) setListError('Your recorded heists could not load. Check your connection and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  const item = items.find(row => row.session_id === selected);
  useEffect(() => {
    // Fetch each readable transcript once; a failed load stays until retried.
    if (!item || unavailable(item) || loaded[item.session_id]) return;
    const ident = item.session_id;
    let active = true; setOpening(true);
    platformRequest<Detail>(`/account/heists/${encodeURIComponent(ident)}`)
      .then(detail => { if (active) setLoaded(old => ({ ...old, [ident]: { detail } })); })
      .catch(e => { if (active) setLoaded(old => ({ ...old, [ident]: e instanceof ApiError && e.status === 404 ? { missing: true } : { error: e instanceof Error ? e.message : 'The conversation could not load.' } })); })
      .finally(() => { if (active) setOpening(false); });
    return () => { active = false; setOpening(false); };
  }, [item, loaded]);

  const counts = useMemo(() => ({ all: items.length, won: items.filter(i => matches(i, 'won')).length, lost: items.filter(i => matches(i, 'lost')).length, open: items.filter(i => matches(i, 'open')).length, unavailable: items.filter(i => matches(i, 'unavailable')).length }), [items]);
  const visible = items.filter(row => matches(row, filter));
  const position = visible.findIndex(row => row.session_id === selected);
  const number = (ident: string) => items.length - items.findIndex(row => row.session_id === ident);

  function select(ident: string, focusDetail = true) {
    setSelected(ident); setView('detail');
    history.replaceState(null, '', `/heists?session=${encodeURIComponent(ident)}`);
    if (focusDetail) requestAnimationFrame(() => { if (window.matchMedia('(max-width: 800px)').matches) { window.scrollTo({ top: 0 }); detailRef.current?.focus(); } });
  }
  function listKeys(event: KeyboardEvent<HTMLOListElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...(listRef.current?.querySelectorAll('button') || [])];
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
    buttons[next]?.focus();
    const ident = visible[next]?.session_id;
    if (ident) { setSelected(ident); history.replaceState(null, '', `/heists?session=${encodeURIComponent(ident)}`); }
  }
  function retryDetail() { setLoaded(old => { const next = { ...old }; delete next[selected]; return next; }); }

  const current = selected ? loaded[selected] : undefined;
  const detail = current && 'detail' in current ? current.detail : null;
  const status = detail?.status || item?.status || '';
  const reward = detail?.reward || item?.reward || null;
  const used = detail ? 3 - detail.attempts_remaining : item?.prompts_used ?? null;
  const onHostedSite = typeof window !== 'undefined' && window.location.origin === HOSTED_SITE;
  const filters: [Filter, string][] = [['all', 'All'], ['won', 'Won'], ['lost', 'No candy'], ['open', 'Unfinished'], ['unavailable', 'Not on this server']];

  return <div className="shell heist-history">
    <a className="back-link" href="/dashboard"><ArrowLeft size={16} /> Back to dashboard</a>
    <header className="history-hero">
      <div><span className="eyebrow">YOUR SAVED STORIES</span><h1>Heist history<span className="orange-text">.</span></h1><p>Every conversation with Caspy, its outcome and any candy it earned. Only you can see these records.</p></div>
      {!loading && !listError && items.length > 0 && <dl className="history-summary"><div><dt>Heists</dt><dd>{items.length}</dd></div><div><dt>Won</dt><dd>{counts.won}</dd></div><div><dt>Candies</dt><dd>{items.filter(i => i.reward).length}</dd></div></dl>}
    </header>

    {loading ? <LoadingState title="Loading your recorded heists…" detail="Your saved conversations will appear here." />
      : listError ? <section className="history-empty" role="alert"><Ghost size={40} /><h2>Your history couldn’t load.</h2><p>{listError} This doesn’t mean your heists are gone.</p><button type="button" className="button button-primary" onClick={() => setAttempt(value => value + 1)}><RotateCw size={16} /> Try again</button></section>
      : !items.length ? <section className="history-empty"><Ghost size={44} /><h2>No heists yet.</h2><p>Your first conversation with Caspy will be saved here, along with its result and any candy it earns.</p><a className="button button-primary" href="/play">Start your first heist <ArrowUpRight size={16} /></a></section>
      : <div className="history-layout" data-view={view}>
        <div className="history-sidebar">
          <div className="history-filters" role="group" aria-label="Filter heists">{filters.filter(([key]) => key === 'all' || counts[key]).map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} <span>{counts[key]}</span></button>)}</div>
          <nav className="history-list" aria-label="Recorded heists">
            {!visible.length ? <p className="history-no-messages">No heists match this filter.</p>
              : <ol ref={listRef} onKeyDown={listKeys}>{visible.map(row => <li key={row.session_id}><button type="button" aria-current={selected === row.session_id ? 'true' : undefined} onClick={() => select(row.session_id)}>
                <span className="history-item-number">#{number(row.session_id)}</span>
                <span className="history-item-body">
                  <span className="history-item-top"><b>{day(row.created)}</b>{row.status ? <Badge status={row.status} /> : unavailable(row) ? <span className="history-badge" data-tone="void"><CloudOff size={12} aria-hidden="true" />Not here</span> : null}</span>
                  <small>{row.preview ? `“${row.preview}”` : row.campaign_name || (unavailable(row) ? (row.transcript === 'hosted' ? 'Saved on the hosted site' : 'Conversation not saved here') : 'Private heist')}</small>
                </span>
                {row.reward && <span className="history-item-grade" data-grade={row.reward.grade} aria-label={`Grade ${row.reward.grade}`}>{row.reward.grade}</span>}
              </button></li>)}</ol>}
          </nav>
          <p className="history-hint">Tip: use the ↑ ↓ keys to move between heists.</p>
        </div>

        <section className="history-detail" ref={detailRef} aria-label={item ? `Heist ${number(item.session_id)} details` : 'Heist details'} aria-busy={opening} tabIndex={-1}>
          <button type="button" className="history-back text-button" onClick={() => setView('list')}><ChevronLeft size={16} /> All heists</button>
          {!item ? <p className="history-no-messages">Choose a heist to read its conversation.</p> : <>
            <header className="history-detail-head" data-tone={outcomes[status]?.tone || 'void'}>
              <div><span className="eyebrow">HEIST #{number(item.session_id)}{(detail ? !detail.current_season : item.transcript === 'available' && !item.current_season) && ' · EARLIER SEASON'}</span>
                <h2>{outcomes[status]?.note || (unavailable(item) ? 'Recorded heist' : 'Opening your heist…')}</h2>
                <p className="history-meta">{status && <Badge status={status} />}<span>{date(item.created)} WIB</span>{used !== null && <span className="history-prompts"><PromptDots used={used} /> {used} of 3 prompts</span>}{item.campaign_name && <span><FlaskConical size={13} aria-hidden="true" /> {item.campaign_name}</span>}</p></div>
              {item.current_season && ['won', 'active', 'pending_review'].includes(status) && <a className="button button-primary" href={`${status === 'won' ? '/claim' : '/play'}?session=${encodeURIComponent(item.session_id)}`}>{status === 'won' ? 'Open reward' : status === 'active' ? 'Continue heist' : 'Check result'} <ArrowUpRight size={16} /></a>}
            </header>
            {reward && <RewardCard reward={reward} />}

            {item.transcript === 'hosted' ? <div className="history-missing"><CloudOff size={34} /><h3>Saved on the hosted Caspy site</h3><p>This heist was played on the hosted site, so its conversation is stored there. This local copy of Caspy shares your account but not your conversations.</p>{!onHostedSite && <a className="button button-light" href={`${HOSTED_SITE}/heists?session=${encodeURIComponent(item.session_id)}`} target="_blank" rel="noreferrer">Open on the hosted site <ArrowUpRight size={16} /></a>}</div>
              : item.transcript === 'unavailable' || (current && 'missing' in current) ? <div className="history-missing"><Archive size={34} /><h3>Conversation not saved here</h3><p>This heist is on your record, but this server has no saved conversation for it. It may have been played on a local test copy of Caspy, or its save was interrupted. Your account, candies and other heists are not affected.</p></div>
              : current && 'error' in current ? <div className="history-missing" role="alert"><Ghost size={34} /><h3>This conversation couldn’t load.</h3><p>{current.error}</p><button type="button" className="button button-primary" onClick={retryDetail}><RotateCw size={16} /> Try again</button></div>
              : !detail ? <LoadingState title="Opening your saved conversation…" detail="Fetching its messages." compact />
              : detail.messages.length ? <ol className="history-messages" aria-label="Conversation">
                {detail.messages.map((message, i) => <li key={i} data-role={message.role}>
                  {message.role === 'caspy' && <span className="history-avatar" aria-hidden="true"><Ghost size={17} /></span>}
                  <div className="history-bubble"><b>{message.role === 'user' ? `You · prompt ${Math.floor(i / 2) + 1}` : 'Caspy'}</b><p>{message.text}</p></div>
                </li>)}
              </ol> : <p className="history-no-messages">No prompts were sent in this heist.</p>}

            {visible.length > 1 && position >= 0 && <nav className="history-pager" aria-label="Move between heists">
              <button type="button" className="button button-light" disabled={position <= 0} onClick={() => select(visible[position - 1].session_id)}><ChevronLeft size={16} /> Newer</button>
              <span>{position + 1} of {visible.length}</span>
              <button type="button" className="button button-light" disabled={position >= visible.length - 1} onClick={() => select(visible[position + 1].session_id)}>Older <ChevronRight size={16} /></button>
            </nav>}
          </>}
        </section>
      </div>}
  </div>;
}
