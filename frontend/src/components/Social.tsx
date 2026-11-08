import { useCallback, useEffect, useRef, useState, type SyntheticEvent, type ReactNode } from 'react';
import { ArrowLeft, Check, Copy, LoaderCircle, RefreshCw, UserCheck, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { ApiError } from '../lib/game';
import { platformRequest } from '../lib/platform';
import { formatFriendCode, isCompleteFriendCode, sortedByName, type Person, type SendResult, type SocialOverview } from '../lib/social';
import LoadingState from './LoadingState';
import UserAvatar from './UserAvatar';
import '../styles/social.css';

const day = (value: number) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value * 1000));
const problem = (error: unknown, fallback: string) => error instanceof ApiError && error.status && error.status < 500 ? error.message : error instanceof ApiError && error.status === 0 ? 'Connection lost. Check your network and try again.' : fallback;

export default function Social() {
  const [data, setData] = useState<SocialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState('');
  const [copied, setCopied] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async (background = false) => {
    const ticket = ++latest.current;
    background ? setRefreshing(true) : setLoading(true);
    try {
      const next = await platformRequest<SocialOverview>('/social');
      if (ticket !== latest.current) return;
      setData(next); setLoadError('');
    } catch (e) {
      if (ticket !== latest.current) return;
      // Keep the list that is already on screen when only a background refresh fails.
      if (!background) setLoadError(problem(e, 'Your friends could not load. Please try again.'));
      else setError(problem(e, 'The list could not refresh. Your last saved view is still shown.'));
    } finally {
      if (ticket === latest.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(key: string, path: string, body: unknown, success: string) {
    setBusy(key); setError(''); setNotice(''); setConfirm('');
    try {
      await platformRequest(path, body);
      setNotice(success);
      await load(true);
    } catch (e) { setError(problem(e, 'That did not go through. Please try again.')); }
    finally { setBusy(''); }
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (!isCompleteFriendCode(code) || busy) return;
    setBusy('send'); setError(''); setNotice('');
    try {
      const result = await platformRequest<SendResult>('/social/requests', { code: formatFriendCode(code) });
      setNotice(result.message); setCode('');
      await load(true);
    } catch (e) { setError(problem(e, 'The request could not be sent. Please try again.')); }
    finally { setBusy(''); }
  }

  async function copyCode() {
    if (!data) return;
    try { await navigator.clipboard.writeText(data.code); setCopied(true); setTimeout(() => setCopied(false), 2000); setError(''); }
    catch { setError('Copy is unavailable in this browser. Select the code and copy it manually.'); }
  }

  async function renew() {
    setBusy('renew'); setError(''); setNotice(''); setConfirm('');
    try {
      const result = await platformRequest<{ code: string }>('/social/code', {});
      setData(previous => previous && { ...previous, code: result.code });
      setNotice('You have a new friend code. The old one no longer works.');
    } catch (e) { setError(problem(e, 'A new code could not be created. Please try again.')); }
    finally { setBusy(''); }
  }

  const person = (item: Person, actions: ReactNode, detail: string) => <li key={item.id} className="social-person">
    <UserAvatar account={item} size={46} /><div><b>{item.name}</b><small>{detail}</small></div><div className="social-actions">{actions}</div>
  </li>;

  return <div className="shell social-page">
    <a className="back-link" href="/dashboard"><ArrowLeft size={16} /> Back to dashboard</a>
    <span className="eyebrow">YOUR HAUNT, BUT WITH COMPANY</span>
    <h1>Social<span className="orange-text">.</span></h1>
    <p className="social-lede">Add friends with a private friend code. Nobody can find you by name or email, and friends see only your name and profile picture.</p>

    {loading ? <LoadingState title="Opening your friends…" detail="Checking your friend code, requests and friends." />
      : loadError || !data ? <section className="platform-card social-card"><p className="error" role="alert">{loadError || 'Your friends could not load.'}</p><button type="button" className="button button-primary" onClick={() => void load()}><RefreshCw size={16} /> Try again</button></section>
      : <div className="social-grid" aria-busy={refreshing}>
        <section className="social-card social-code" aria-labelledby="code-title">
          <h2 id="code-title">Your friend code</h2>
          <p>Share this with someone you trust. They enter it to send you a request.</p>
          <div className="social-code-row"><output aria-label="Your friend code" className="friend-code">{data.code}</output>
            <button type="button" className="button button-light" onClick={() => void copyCode()}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}</button></div>
          {confirm === 'renew' ? <p className="social-confirm">The old code will stop working. <button type="button" className="text-button" onClick={() => void renew()} disabled={busy === 'renew'}>{busy === 'renew' ? 'Creating…' : 'Create new code'}</button><button type="button" className="text-button" onClick={() => setConfirm('')}>Keep current</button></p>
            : <button type="button" className="text-button" onClick={() => setConfirm('renew')}>Code shared by mistake? Get a new one</button>}
        </section>

        <section className="social-card" aria-labelledby="add-title">
          <h2 id="add-title">Add a friend</h2>
          <form className="social-add" onSubmit={event => void submit(event)}>
            <label htmlFor="friend-code-input">Friend’s code</label>
            <div className="social-code-row"><input id="friend-code-input" value={code} onChange={event => setCode(formatFriendCode(event.target.value))} placeholder="ABCD-2345" autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text" maxLength={9} aria-describedby="friend-code-hint" />
              <button type="submit" className="button button-primary" disabled={!isCompleteFriendCode(code) || busy === 'send'}>{busy === 'send' ? <><LoaderCircle size={16} className="spin" /> Sending…</> : <><UserPlus size={16} /> Send request</>}</button></div>
            <small id="friend-code-hint">8 letters and numbers. If they already sent you a request, this accepts it.</small>
          </form>
        </section>

        <div className="social-messages" aria-live="polite">{notice && <p className="platform-success">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}</div>

        <section className="social-card" aria-labelledby="requests-title">
          <h2 id="requests-title">Requests {data.incoming.length > 0 && <span className="social-count">{data.incoming.length}</span>}</h2>
          {!data.incoming.length && !data.outgoing.length && <p className="social-empty">No pending requests.</p>}
          {data.incoming.length > 0 && <><h3>Wants to be your friend</h3><ul className="social-list">{data.incoming.map(item => person(item,
            <><button type="button" className="button button-primary" disabled={!!busy} onClick={() => void act('a' + item.id, `/social/requests/${encodeURIComponent(item.id)}/accept`, {}, `You and ${item.name} are now friends.`)}>{busy === 'a' + item.id ? <LoaderCircle size={16} className="spin" /> : <UserCheck size={16} />} Accept</button>
              <button type="button" className="button button-light" disabled={!!busy} onClick={() => void act('d' + item.id, `/social/requests/${encodeURIComponent(item.id)}/decline`, {}, `Request from ${item.name} declined.`)}>{busy === 'd' + item.id ? <LoaderCircle size={16} className="spin" /> : <X size={16} />} Decline</button></>, `Sent ${day(item.at)}`))}</ul></>}
          {data.outgoing.length > 0 && <><h3>Waiting for a reply</h3><ul className="social-list">{data.outgoing.map(item => person(item,
            <button type="button" className="button button-light" disabled={!!busy} onClick={() => void act('c' + item.id, `/social/requests/${encodeURIComponent(item.id)}/cancel`, {}, `Request to ${item.name} cancelled.`)}>{busy === 'c' + item.id ? <LoaderCircle size={16} className="spin" /> : <X size={16} />} Cancel</button>, `Sent ${day(item.at)}`))}</ul></>}
        </section>

        <section className="social-card" aria-labelledby="friends-title">
          <h2 id="friends-title"><Users size={20} /> Friends <span className="social-count">{data.friends.length}</span></h2>
          {data.friends.length ? <ul className="social-list">{sortedByName(data.friends).map(item => person(item,
            confirm === item.id ? <><span className="social-confirm-text">Remove {item.name}?</span>
              <button type="button" className="button button-light danger" disabled={!!busy} onClick={() => void act('r' + item.id, `/social/friends/${encodeURIComponent(item.id)}/remove`, {}, `${item.name} was removed from your friends.`)}>{busy === 'r' + item.id ? <LoaderCircle size={16} className="spin" /> : <UserMinus size={16} />} Yes, remove</button>
              <button type="button" className="text-button" onClick={() => setConfirm('')}>Keep</button></>
              : <button type="button" className="text-button" disabled={!!busy} aria-label={`Remove ${item.name} from friends`} onClick={() => setConfirm(item.id)}><UserMinus size={15} /> Remove</button>, `Friends since ${day(item.at)}`))}</ul>
            : <p className="social-empty">No friends yet. Share your code or enter a friend’s code above to get started.</p>}
        </section>
      </div>}
  </div>;
}
