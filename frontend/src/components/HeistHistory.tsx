import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Candy, CheckCircle2, Clock3, FlaskConical, Ghost, Hourglass, Archive, RotateCw, Sparkles, XCircle } from 'lucide-react';
import { platformRequest } from '../lib/platform';
import { ApiError, type Message } from '../lib/game';
import '../styles/heist-history.css';
import LoadingState from './LoadingState';

type Record = { session_id: string; campaign_name: string | null; created: number; research?: number; commercial?: number; withdrawn?: number };
type Detail = { id: string; created: number; status: string; current_season: boolean; attempts_remaining: number; messages: Message[]; minted: boolean; token_id: string | null; reward: { state: string; grade: string; score: number; token_id: string | null } | null };
type Loaded = { detail: Detail } | { missing: true } | { error: string };

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

function Badge({ status }: { status: string }) {
  const item = outcomes[status];
  if (!item) return <span className="history-badge" data-tone="void">Recorded</span>;
  const Icon = item.icon;
  return <span className="history-badge" data-tone={item.tone}><Icon size={13} aria-hidden="true" />{item.label}</span>;
}

function PromptDots({ used }: { used: number }) {
  return <span className="history-dots" aria-label={`${used} of 3 prompts used`}>{[0, 1, 2].map(i => <i key={i} data-used={i < used} aria-hidden="true" />)}</span>;
}

export default function HeistHistory() {
  const [records, setRecords] = useState<Record[]>([]);
  const [selected, setSelected] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(location.search).get('session') || '');
  const [loaded, setLoaded] = useState<{ [id: string]: Loaded }>({});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [opening, setOpening] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setListError('');
    platformRequest<{ contributions: Record[] }>('/account/contributions').then(data => {
      if (!active) return;
      setRecords(data.contributions);
      setSelected(previous => previous || data.contributions[0]?.session_id || '');
    }).catch(() => { if (active) setListError('Your recorded heists could not load. Check your connection and try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => {
    // Fetch each heist once; a failed load stays shown until the player retries.
    if (!selected || loaded[selected]) return;
    let active = true; setOpening(true);
    platformRequest<Detail>(`/account/heists/${encodeURIComponent(selected)}`)
      .then(detail => { if (active) setLoaded(old => ({ ...old, [selected]: { detail } })); })
      .catch(e => {
        if (!active) return;
        // 404 means the heist is recorded but its transcript was never saved
        // (older or interrupted heists). Show that calmly rather than as an error.
        const missing = e instanceof ApiError && e.status === 404;
        setLoaded(old => ({ ...old, [selected]: missing ? { missing: true } : { error: e instanceof Error ? e.message : 'The conversation could not load.' } }));
      })
      .finally(() => { if (active) setOpening(false); });
    return () => { active = false; setOpening(false); };
  }, [selected, loaded]);

  function select(id: string) {
    setSelected(id);
    history.replaceState(null, '', `/heists?session=${encodeURIComponent(id)}`);
    if (window.matchMedia('(max-width: 800px)').matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  }
  function retryDetail() { setLoaded(old => { const next = { ...old }; delete next[selected]; return next; }); }

  const index = records.findIndex(row => row.session_id === selected);
  const record = records[index];
  const number = index >= 0 ? records.length - index : 0;
  const current = selected ? loaded[selected] : undefined;
  const detail = current && 'detail' in current ? current.detail : null;
  const shared = records.filter(row => row.research && !row.withdrawn).length;

  return <div className="shell heist-history">
    <a className="back-link" href="/dashboard"><ArrowLeft size={16} /> Back to dashboard</a>
    <header className="history-hero">
      <div><span className="eyebrow">YOUR SAVED STORIES</span><h1>Heist history<span className="orange-text">.</span></h1><p>Every conversation with Caspy, its outcome and any candy it earned. Only you can see these records.</p></div>
      {!loading && !listError && records.length > 0 && <dl className="history-summary"><div><dt>Heists recorded</dt><dd>{records.length}</dd></div><div><dt>Shared with research</dt><dd>{shared}</dd></div></dl>}
    </header>

    {loading ? <LoadingState title="Loading your recorded heists…" detail="Your saved conversations will appear here." />
      : listError ? <section className="history-empty" role="alert"><Ghost size={40} /><h2>Your history couldn’t load.</h2><p>{listError} This doesn’t mean your heists are gone.</p><button type="button" className="button button-primary" onClick={() => setAttempt(value => value + 1)}><RotateCw size={16} /> Try again</button></section>
      : !records.length ? <section className="history-empty"><Ghost size={44} /><h2>No heists yet.</h2><p>Your first conversation with Caspy will be saved here, along with its result and any candy it earns.</p><a className="button button-primary" href="/play">Start your first heist <ArrowUpRight size={16} /></a></section>
      : <div className="history-layout">
        <nav className="history-list" aria-label="Recorded heists"><ol>{records.map((row, i) => {
          const known = loaded[row.session_id];
          const status = known && 'detail' in known ? known.detail.status : known && 'missing' in known ? 'archived' : '';
          return <li key={row.session_id}><button type="button" aria-current={selected === row.session_id ? 'true' : undefined} onClick={() => select(row.session_id)}>
            <span className="history-item-number">#{records.length - i}</span>
            <span className="history-item-body"><b>{day(row.created)}</b><small>{row.campaign_name || 'Private heist'}</small></span>
            <span className="history-item-tags">{status === 'archived' ? <span className="history-badge" data-tone="void"><Archive size={12} aria-hidden="true" />No transcript</span> : status ? <Badge status={status} /> : null}{!!row.research && !row.withdrawn && <span className="history-chip" title="Shared with a research event"><FlaskConical size={12} aria-hidden="true" /><span className="sr-only">Shared with research</span></span>}</span>
          </button></li>;
        })}</ol></nav>

        <section className="history-detail" ref={detailRef} aria-label={number ? `Heist ${number} details` : 'Heist details'} aria-busy={opening} tabIndex={-1}>
          {opening && !current ? <LoadingState title="Opening your saved conversation…" detail="Fetching its messages, outcome and reward." compact />
            : current && 'missing' in current ? <div className="history-missing"><Archive size={36} /><h2>Heist #{number}</h2>{record && <p className="history-meta">{date(record.created)} WIB · {record.campaign_name || 'Private heist'}</p>}<p>This heist is on your record, but its conversation wasn’t kept in the saved archive. This can happen with heists that were interrupted or came from an earlier version of Caspy. Nothing else on your account is affected.</p><a className="button button-light" href="/play">Go to the heist <ArrowUpRight size={16} /></a></div>
            : current && 'error' in current ? <div className="history-missing" role="alert"><Ghost size={36} /><h2>This conversation couldn’t load.</h2><p>{current.error}</p><button type="button" className="button button-primary" onClick={retryDetail}><RotateCw size={16} /> Try again</button></div>
            : detail ? <>
              <header className="history-detail-head" data-tone={outcomes[detail.status]?.tone || 'void'}>
                <div><span className="eyebrow">HEIST #{number}{!detail.current_season && ' · EARLIER SEASON'}</span><h2>{outcomes[detail.status]?.note || 'Recorded heist'}</h2>
                  <p className="history-meta"><Badge status={detail.status} /><span>{date(detail.created)} WIB</span><span className="history-prompts"><PromptDots used={3 - detail.attempts_remaining} /> {3 - detail.attempts_remaining} of 3 prompts</span>{record?.campaign_name && <span><FlaskConical size={13} aria-hidden="true" /> {record.campaign_name}</span>}</p></div>
                {detail.current_season && (detail.status === 'won' || detail.status === 'active' || detail.status === 'pending_review') && <a className="button button-primary" href={`${detail.status === 'won' ? '/claim' : '/play'}?session=${encodeURIComponent(detail.id)}`}>{detail.status === 'won' ? 'Open reward' : detail.status === 'active' ? 'Continue heist' : 'Check result'} <ArrowUpRight size={16} /></a>}
              </header>

              {detail.reward && <div className="history-reward-card" data-grade={detail.reward.grade}>
                <span className="history-grade" aria-label={`Grade ${detail.reward.grade}`}>{detail.reward.grade}</span>
                <div><b>{detail.reward.token_id ? `Candy #${detail.reward.token_id}` : 'Earned candy'}</b><span>{detail.reward.score}/100 · {detail.reward.token_id ? 'Minted' : rewardState[detail.reward.state] || detail.reward.state.replaceAll('_', ' ')}</span></div>
                {detail.reward.token_id ? <a className="inline-link" href="/collection">View in collection <ArrowUpRight size={15} /></a> : <Candy size={22} aria-hidden="true" />}
              </div>}

              {detail.messages.length ? <ol className="history-messages" aria-label="Conversation">
                {detail.messages.map((item, i) => <li key={i} data-role={item.role}>
                  {item.role === 'caspy' && <span className="history-avatar" aria-hidden="true"><Ghost size={17} /></span>}
                  <div className="history-bubble"><b>{item.role === 'user' ? `You · prompt ${Math.floor(i / 2) + 1}` : 'Caspy'}</b><p>{item.text}</p></div>
                </li>)}
              </ol> : <p className="history-no-messages"><CheckCircle2 size={16} aria-hidden="true" /> No prompts were sent in this heist.</p>}
            </> : <p className="history-no-messages">Choose a heist to read its conversation.</p>}
        </section>
      </div>}
  </div>;
}
