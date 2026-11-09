import { CANDY_NETWORK, LOCAL_TEST_WALLET } from '../lib/wallet';
import { useEffect, useState, useRef } from 'react';
import { ArrowUpRight, Candy, Ghost, LoaderCircle, RotateCw, ShieldCheck, Wallet, FlaskConical } from 'lucide-react';
import { IS_NFT_ENABLED, LIVE_SESSION_KEY, request, type Session } from '../lib/game';
import LoadingState from './LoadingState';
import UserAvatar from './UserAvatar';
import { platformRequest, type Account } from '../lib/platform';

type Contribution = { session_id: string; campaign_name: string | null; research: number; commercial: number; withdrawn: number; sample_count: number; created: number };
const resetDate = (seconds: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(seconds * 1000));

export default function UserDashboard({ account, wallet, openWallet }: { account: Account; wallet: string; openWallet: () => void }) {
  const [rows, setRows] = useState<Contribution[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [candyCount, setCandyCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loaded,setLoaded]=useState(false);
  const context=useRef('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setErrors([]);
    const key=account.id+':'+wallet;
    if(context.current!==key) { setRows([]);setSession(null);setCandyCount(null);setLoaded(false);context.current=key; }
    const id = localStorage.getItem(LIVE_SESSION_KEY);
    const tasks = [
      platformRequest<{ contributions: Contribution[] }>('/account/contributions').then(data => { if (active) setRows(data.contributions); }).catch(() => { if (active) setErrors(old => [...old, 'Your activity could not load.']); }),
      id && (!IS_NFT_ENABLED || wallet) ? request<Session>(`/game/session/${id}`).then(data => { if (active) setSession(data); }).catch(() => { if (active) setErrors(old => [...old, 'Your current heist could not load. Open the heist to reconnect.']); }) : Promise.resolve(),
      IS_NFT_ENABLED && wallet ? request<{ tokens: unknown[] }>('/candy/collection').then(data => { if (active) setCandyCount(data.tokens.length); }).catch(() => { if (active) setErrors(old => [...old, 'Your collection count could not load.']); }) : Promise.resolve(),
    ];
    void Promise.allSettled(tasks).then(() => { if (active) { setLoading(false);setLoaded(true); } });
    return () => { active = false; };
  }, [account.id, wallet, revision]);
  const retry = session && ['lost', 'void'].includes(session.status) && session.next_reset_at;
  const dailyReady = !!session?.unlimited_heists && !!session && ['lost', 'void'].includes(session.status) || !!retry && now >= retry * 1000;
  const title = !session ? 'Your next story starts here.' : session.status === 'won' ? 'You won Caspy over.' : session.status === 'pending_review' ? 'Your story is awaiting a verdict.' : session.status === 'active' ? 'Your heist is waiting for you.' : dailyReady ? 'A new day. Three fresh chances.' : 'A little patience. A fresh start.';
  const description = !session ? 'Head to the heist to start or restore your latest conversation.' : session.status === 'won' ? 'Visit your reward to check artwork, mint status and your next step.' : session.status === 'pending_review' ? 'Return to your conversation to check the independent judge. No extra prompt is needed.' : session.status === 'active' ? `${session.attempts_remaining} of 3 prompts remaining. Pick up your conversation with Caspy.` : session.unlimited_heists ? 'Contributor access gives you unlimited heists, with three prompts in each. NFT earning limits still apply.' : retry ? dailyReady ? 'Your daily retry is available. Start it from the heist screen.' : `Your next retry unlocks ${resetDate(retry)} WIB, at midnight Jakarta time.` : 'Open your completed heist to see its result and available next steps.';
  return <div className="user-dashboard shell">
    <header className="dashboard-welcome"><div><span className="eyebrow">YOUR PERSONAL HAUNT</span><h1><UserAvatar account={account} size={48}/><span>Welcome back, {account.name}<span className="orange-text">.</span></span></h1><p>Your stories, your candy, your next little adventure.</p></div><button className="button button-light" disabled={loading} onClick={() => setRevision(value => value + 1)}><RotateCw size={16} className={loading ? 'spin' : ''} />{loading ? 'Refreshing…' : 'Refresh'}</button></header>
    {loading && <LoadingState title={loaded ? 'Updating your dashboard…' : 'Loading your saved activity…'} detail="Checking your heists, candy collection and research choices. Your saved progress stays safe." compact/>}
    {!!errors.length && <div className="error" role="alert">{errors.map(error => <p key={error}>{error}</p>)} Use Refresh to try again.</div>}
    <section className="dashboard-stats" aria-label="Your account overview" aria-busy={loading}>
      <div><Ghost size={22} /><span><a href="/heists">Recorded heists <ArrowUpRight size={13} /></a><strong>{loading && !loaded ? '—' : errors.some(error => error.includes('activity')) ? 'Unavailable' : rows.length}</strong></span></div>
      <div><Candy size={22} /><span>Candies in this wallet<strong>{loading && !loaded ? '—' : !IS_NFT_ENABLED ? 'AI-only mode' : !wallet ? 'Connect wallet' : candyCount ?? 'Unavailable'}</strong></span></div>
      <div><ShieldCheck size={22} /><span>Active research contributions<strong>{loading && !loaded ? '—' : errors.some(error => error.includes('activity')) ? 'Unavailable' : rows.filter(row => row.research && !row.withdrawn).length}</strong></span></div>
    </section>
    <div className="dashboard-main-grid"><section className="dashboard-heist"><div><span className="eyebrow">{loading && !loaded ? 'CHECKING YOUR HAUNT' : session?.status === 'won' ? 'YOUR EARNED REWARD' : 'YOUR NEXT MOVE'}</span><h2>{loading && !loaded ? 'Opening your corner of Caspy…' : title}</h2><p>{loading && !loaded ? 'Checking your saved activity and connected wallet.' : description}</p><a className="button button-primary" href={session?.status === 'won' ? '/claim' : '/play'}>{session?.status === 'won' ? 'Open my reward' : session?.status === 'active' ? 'Continue my heist' : dailyReady ? session?.unlimited_heists ? 'Play another heist' : 'Open daily heist' : session ? 'View my heist' : 'Go to the heist'}<ArrowUpRight size={18} /></a></div><img src="/images/logo-transparent.png" alt="Caspy guarding his candy basket" width="2752" height="1536" /></section>
    <aside className="dashboard-wallet platform-card"><Wallet size={25} /><h2>Your wallet</h2><p>{!IS_NFT_ENABLED ? 'You’re playing without blockchain collectibles.' : wallet ? `Your connected ${CANDY_NETWORK} wallet. Test ETH has no real value.` : 'Connect your verified wallet to load your heist and candy collection.'}</p>{wallet && <code>{wallet.slice(0, 6)}…{wallet.slice(-4)}</code>}{IS_NFT_ENABLED && <button className="button button-light" onClick={openWallet}>{wallet ? 'Manage wallet' : LOCAL_TEST_WALLET ? 'Choose test wallet' : 'Connect wallet'}</button>}<a className="inline-link" href="/account">Account settings <ArrowUpRight size={15} /></a></aside></div>
    <nav className="dashboard-shortcuts" aria-label="Your dashboard shortcuts"><a href="/collection"><Candy size={24} /><div><h2>My candy deck</h2><p>View your collectibles and manage listings.</p></div><ArrowUpRight size={20} /></a><a href="/marketplace"><Ghost size={24} /><div><h2>Midnight marketplace</h2><p>Browse candies shared by other players.</p></div><ArrowUpRight size={20} /></a><a href={account.role === 'researcher' ? '/research' : '/account'}><FlaskConical size={24} /><div><h2>{account.role === 'researcher' ? 'My research workspace' : 'My research choices'}</h2><p>{account.role === 'researcher' ? 'Review your campaigns and consented examples.' : 'Review sharing permissions for your heists.'}</p></div><ArrowUpRight size={20} /></a></nav>
    <section className="platform-card dashboard-activity"><header><div><span className="eyebrow">YOUR FOOTPRINTS</span><h2>Recent heist activity</h2><a className="inline-link" href="/heists">View all heists <ArrowUpRight size={15} /></a></div><a className="inline-link" href="/account">Manage research choices <ArrowUpRight size={15} /></a></header><p>Open a saved heist to read your conversation, outcome and reward details.</p>{loading && !loaded ? <p role="status"><LoaderCircle size={16} className="spin" /> Loading your activity…</p> : errors.some(error => error.includes('activity')) ? <p>Activity is unavailable. Refresh to reconnect.</p> : !rows.length ? <div className="platform-empty compact"><Ghost size={30} /><p>No recorded heists yet. Your first adventure is waiting.</p></div> : <ol>{rows.slice(0, 5).map(row => <li key={row.session_id}><span className="dashboard-activity-icon"><Ghost size={20} /></span><div><a className="inline-link" href={`/heists?session=${encodeURIComponent(row.session_id)}`}><b>{row.campaign_name || 'Independent heist'}</b><ArrowUpRight size={15} /></a><p>{row.withdrawn ? 'Research contribution withdrawn' : row.research ? row.commercial ? 'Research and commercial sharing enabled' : 'Research sharing only' : 'Private play · no research sharing'}</p></div><time dateTime={new Date(row.created * 1000).toISOString()}>{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(row.created * 1000))}</time></li>)}</ol>}</section>
  </div>;
}
