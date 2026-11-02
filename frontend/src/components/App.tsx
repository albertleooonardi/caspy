import { useEffect, useRef, useState, type SyntheticEvent, type ReactNode } from 'react';
import { ArrowUpRight, ArrowRight, ArrowLeft, Wallet, X, Menu, Ghost, Candy, Sparkles, LockKeyhole, ShieldCheck, ChevronDown, Copy, Check, ExternalLink, RotateCcw, LoaderCircle, CircleHelp, Eye, CheckCircle2, Clock3, Volume2, VolumeX } from 'lucide-react';
import { IS_DEMO, IS_LOCAL_AI, LIVE_SESSION_KEY, demoTurn, newDemo, readDemo, request, saveDemo, streamTurn, type Session } from '../lib/game';
import { authenticateWallet, mintVoucher, type Voucher } from '../lib/wallet';
import HowToPlay, { WalkthroughPlayer } from './HowToPlay';

type PageProps = { page: string };
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function CaspyArt({ className = '', eager = false }: { className?: string; eager?: boolean }) {
  return <div className={`caspy-art ${className}`}><img src="/images/logo-transparent.png" alt="Caspy, a smiling little ghost in a purple witch hat, guarding his pumpkin candy basket" width="2752" height="1536" loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} /></div>;
}
function Brand({ light = false }: { light?: boolean }) {
  return <a className={`brand ${light ? 'brand-light' : ''}`} href="/" aria-label="Caspy home"><span className="brand-icon"><img src="/images/logo-transparent.png" alt="" width="2752" height="1536" /></span><span>caspy<span className="brand-dot">.</span></span></a>;
}
function Button({ children, href, className = '', onClick, disabled = false }: { children: ReactNode; href?: string; className?: string; onClick?: () => void; disabled?: boolean }) {
  return href ? <a className={`button ${className}`} href={href}>{children}</a> : <button className={`button ${className}`} type="button" onClick={onClick} disabled={disabled}>{children}</button>;
}

export default function App({ page }: PageProps) {
  const [walletOpen, setWalletOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wallet, setWallet] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [toast, setToast] = useState('');
  const modal = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setWallet(localStorage.getItem('caspy.wallet') || '');
    return () => clearTimeout(toastTimer.current);
  }, []);
  useEffect(() => {
    if (walletOpen) modal.current?.showModal();
    else modal.current?.close();
  }, [walletOpen]);
  const notify = (message: string) => { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3800); };
  async function connect(demo: boolean) {
    setConnecting(true); setWalletError('');
    try {
      const account = demo ? 'demo' : await authenticateWallet();
      localStorage.setItem('caspy.wallet', account); setWallet(account); setWalletOpen(false);
      if (demo) notify('You’re in! This is a demo — no wallet or real NFTs involved.');
    } catch (error) { setWalletError(error instanceof Error ? error.message : 'Connection cancelled. Please try again.'); }
    finally { setConnecting(false); }
  }
  function disconnect() { localStorage.removeItem('caspy.wallet'); setWallet(''); setWalletOpen(false); notify('Wallet disconnected.'); }
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="announcement"><span className="announcement-spark">✦</span> A little mischief is in season. <a href="/play">Come play with Caspy <ArrowRight size={13} /></a><span className="announcement-spark">✦</span></div>
    <header className="header shell">
      <Brand />
      <nav className={menuOpen ? 'nav nav-open' : 'nav'} aria-label="Main navigation">
        <a href="/play" aria-current={page === 'play' ? 'page' : undefined}>The heist</a>
        <a href="/how-to-play" aria-current={page === 'how-to-play' ? 'page' : undefined}>How to play</a>
        <a href="/gallery" aria-current={page === 'gallery' ? 'page' : undefined}>Wall of Heists <span className="nav-new">SOON</span></a>
        <a href="/rules" aria-current={page === 'rules' ? 'page' : undefined}>FAQ</a>
      </nav>
      <div className="header-actions"><button className="wallet-button" onClick={() => IS_LOCAL_AI ? location.assign('/play') : setWalletOpen(true)}><Wallet size={17} /><span>{IS_LOCAL_AI ? 'Play with AI' : wallet ? wallet === 'demo' ? 'Demo explorer' : short(wallet) : 'Connect wallet'}</span><ArrowUpRight size={15} /></button><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}>{menuOpen ? <X /> : <Menu />}</button></div>
    </header>
    <main id="main">
      {page === 'home' ? <Home /> : page === 'how-to-play' ? <HowToPlay /> : page === 'play' ? <Play wallet={wallet} openWallet={() => setWalletOpen(true)} notify={notify} /> : page === 'gallery' ? <Gallery /> : page === 'rules' ? <Rules /> : page === 'result' || page === 'claim' ? <Result claim={page === 'claim'} notify={notify} wallet={wallet} openWallet={() => setWalletOpen(true)} /> : <Legal privacy={page === 'privacy'} />}
    </main>
    <footer className="footer shell"><div><Brand /><p>A little ghost. A lot of personality.</p></div><div className="footer-links"><a href="/how-to-play">How to play</a><a href="/rules">Rules & FAQ</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><span className="footer-note">Made for the thrill of the heist. <Ghost size={15} /></span><div className="footer-bottom"><span>© 2026 Caspy’s Prompt Heist</span><span>{IS_LOCAL_AI ? 'Local AI playground · no wallet or real collectibles' : 'Free to play. Gas fees may apply. Collectibles have no promised financial value.'}</span></div></footer>
    <dialog ref={modal} className="wallet-dialog" onCancel={() => setWalletOpen(false)} onClick={event => { if (event.target === event.currentTarget) setWalletOpen(false); }} aria-labelledby="wallet-title">
      <button className="icon-button modal-close" aria-label="Close wallet dialog" onClick={() => setWalletOpen(false)}><X size={21} /></button>
      <span className="modal-ghost"><Ghost size={37} /></span>
      <span className="eyebrow">YOUR HEIST STARTS HERE</span><h2 id="wallet-title">Come on in, heister.</h2>
      <p>{IS_DEMO ? 'Explore Caspy’s world. No wallet needed for this frontend demo.' : 'Connect your wallet and sign a free message to prove it’s yours. Your keys stay with you.'}</p>
      {wallet ? <><div className="connected-wallet"><CheckCircle2 size={21} />{wallet === 'demo' ? 'Connected as Demo explorer' : short(wallet)}</div><Button className="button-primary full" onClick={() => setWalletOpen(false)}>Back to the heist <ArrowRight size={17} /></Button><button className="text-button" onClick={disconnect}>Disconnect</button></> : IS_DEMO ? <Button className="button-primary full" onClick={() => connect(true)} disabled={connecting}><Ghost size={18} /> Enter demo {connecting && <LoaderCircle className="spin" size={16} />}</Button> : <Button className="button-primary full" onClick={() => connect(false)} disabled={connecting}><Wallet size={18} />{connecting ? 'Check your wallet…' : 'Connect browser wallet'}</Button>}
      {walletError && <p className="error" role="alert">{walletError}</p>}
      <small><ShieldCheck size={13} /> {IS_DEMO ? 'No signatures. No transactions. Just a little mischief.' : 'Signing in never authorizes a mint or transfers funds.'}</small>
    </dialog>
    {toast && <div className="toast" role="status"><CheckCircle2 size={19} />{toast}</div>}
  </>;
}

function Home() {
  return <>
    <section className="hero shell">
      <div className="hero-copy"><div className="season-badge"><span /> SEASON 01 <span className="badge-divider">/</span> THE HALLOWEEN HEIST</div>
        <h1>Sweet talk.<br />Spooky <span className="orange-word">stakes.<svg viewBox="0 0 330 24" aria-hidden="true"><path d="M5 15Q140-1 323 10M40 22Q180 6 305 17" /></svg></span></h1>
        <p className="hero-description">One stubborn ghost. A basket full of candy.<br className="desktop-break" /> And <strong>3 prompts</strong> to charm your way in.</p>
        <div className="hero-buttons"><Button href="/play" className="button-primary">Let’s pull a heist <ArrowUpRight size={20} /></Button><a className="how-link" href="/how-to-play"><span className="play-circle">▷</span> Watch the walkthrough</a></div>
        <div className="hero-fine"><span><ShieldCheck size={15} /> Free to play</span><i /><span>Built on <span className="base-icon" /> Base</span><i /><span>No magic words. Just you.</span></div>
      </div>
      <div className="hero-scene"><div className="scene-orbit orbit-one" /><div className="scene-orbit orbit-two" /><span className="star star-one">✦</span><span className="star star-two">✧</span><span className="star star-three">✧</span><span className="scene-dot dot-one" /><span className="scene-dot dot-two" /><div className="ghost-caption">cute face. tough negotiator.<svg viewBox="0 0 70 53" aria-hidden="true"><path d="M4 3Q66 0 49 45m-9-9 8 12 13-8" /></svg></div><CaspyArt eager className="hero-caspy" /><div className="speech-bubble">“My candy. My rules.” <span>hmph.</span></div><div className="scene-sticker"><Candy size={18} /> CANDY GUARDIAN, ON DUTY <span /></div><svg className="bat" viewBox="0 0 80 43" aria-hidden="true"><path d="M2 2 25 12 32 5 40 12 48 5 55 12 78 2 70 23 57 25 47 39 40 31 32 39 23 25 10 23Z" /></svg></div>
    </section>
    <div className="promise-strip shell"><div><Candy size={22} /><span><b>3 prompts.</b> Make every word count.</span></div><span className="strip-spark">✦</span><div><Ghost size={22} /><span><b>1 ghost.</b> Surprisingly hard to impress.</span></div><span className="strip-spark">✦</span><div><Sparkles size={22} /><span><b>Trick or Treat.</b> A collectible either way.</span></div></div>
    <section className="how-section shell" id="how-it-works"><div className="section-heading"><div><span className="eyebrow">A SMALL HEIST. A BIG PERSONALITY.</span><h2>All charm. No cheat codes.</h2></div><p>Your words are your only tools.<br />Here’s how to make them count.</p></div>
      <div className="steps"><article className="step"><div className="step-top"><span className="step-icon lavender"><Wallet size={27} /></span><span className="step-number">01</span></div><h3>Show up, human.</h3><p>Connect your wallet and sign in.<br />One wallet. One heist. Three chances.</p><span className="step-label">NO ENTRY FEE <ArrowRight size={14} /></span></article><article className="step"><div className="step-top"><span className="step-icon peach"><Candy size={29} /></span><span className="step-number">02</span></div><h3>Work your word magic.</h3><p>Tell a story. Make a deal. Tug a heartstring.<br />Convince Caspy to part with his candy.</p><span className="step-label">CREATIVITY OVER SHORTCUTS <ArrowRight size={14} /></span></article><article className="step"><div className="step-top"><span className="step-icon green"><Sparkles size={27} /></span><span className="step-number">03</span></div><h3>Take home the mischief.</h3><p>Win a rare Treat or meet your Trick.<br />Either way, there’s a collectible to claim.</p><span className="step-label">A LITTLE PROOF YOU WERE HERE <ArrowRight size={14} /></span></article></div>
    </section>
    <section className="walkthrough-home shell" aria-labelledby="walkthrough-home-title"><div className="section-heading"><div><span className="eyebrow">FIRST TIME AT THE HAUNT?</span><h2 id="walkthrough-home-title">Meet the ghost behind the heist.</h2></div><p>A floating ghost. A few sweet words. A little mischief. <br />Watch the animated guide in under a minute.</p></div><WalkthroughPlayer compact /><div className="walkthrough-home-footer"><span><ShieldCheck size={15} /> Demo walkthrough · no wallet or real mints</span><a href="/how-to-play" className="inline-link">Follow the step-by-step guide <ArrowRight size={16} /></a></div></section>
    <section className="loot-section shell"><div className="loot-copy"><span className="eyebrow">THE SPOILS OF YOUR WORDS</span><h2>Something sweet.<br />Or a little spooky.</h2><p>Caspy doesn’t give up his candy easily. But even an unsuccessful heist deserves a keepsake.</p><a href="/rules" className="inline-link">Get to know the rules <ArrowUpRight size={17} /></a><div className="tiny-note"><LockKeyhole size={14} /> One collectible per wallet, per season.</div></div><div className="loot-cards"><article className="collectible-card treat-card"><div className="collectible-image"><img src="/images/logo.jpg" alt="Caspy holding a sweet pumpkin treat" loading="lazy" /><span className="rarity">RARE EDITION</span><span className="card-spark">✦</span></div><div className="collectible-info"><div><h3>The Treat</h3><p>For the silver-tongued.</p></div><Candy size={24} /></div></article><article className="collectible-card trick-card"><div className="collectible-image trick-image"><Ghost size={109} strokeWidth={1.1} /><span className="rarity">COMMON EDITION</span><span className="trick-boo">boo.</span><span className="card-spark">✧</span></div><div className="collectible-info"><div><h3>The Trick</h3><p>For the brave-at-heart.</p></div><Ghost size={24} /></div></article></div></section>
    <section className="wall-banner shell"><div className="wall-icon"><Ghost size={38} /><span>✦</span></div><div><span className="eyebrow">GREAT WORDS DESERVE A LITTLE INFAMY</span><h2>The Wall of Heists</h2><p>The smoothest talkers. The sweetest victories. Revealed when the season ends.</p></div><Button href="/gallery" className="button-light">Take a peek <ArrowUpRight size={18} /></Button></section>
    <section className="faq-home shell"><div><span className="eyebrow">A FEW GHOSTLY DETAILS</span><h2>Curious, little human?</h2><p>Caspy has secrets. The rules aren’t one of them.</p><a href="/rules" className="inline-link">All questions & rules <ArrowUpRight size={17} /></a></div><div className="faq-list"><FaqItems compact /></div></section>
    <section className="last-cta shell"><span>✧</span><div><h2>A good heist starts with a hello.</h2><p>Caspy’s waiting. His candy isn’t going to sweet-talk itself.</p></div><Button href="/play" className="button-primary">Meet your ghost <ArrowUpRight size={18} /></Button></section>
  </>;
}

function FaqItems({ compact = false }: { compact?: boolean }) {
  const entries = [
    ['Is it really free to play?', 'Yes! There’s no entry fee and no payment required to chat with Caspy. If you choose to mint your collectible on-chain, network gas fees may apply. The frontend demo uses no real transactions.'],
    ['What happens if I use all 3 prompts?', IS_LOCAL_AI ? 'Your heist ends with a Trick result if Caspy keeps his candy. Persuade him earlier for a Treat result. These are local game outcomes with no real collectibles. You can start a fresh heist afterward.' : 'If Caspy holds onto his candy through all three prompts, you receive a common Trick collectible to claim. Persuade him before your chances run out and you earn a rare Treat. One game is allowed per wallet, per season.'],
    ['Can I just tell Caspy to ignore his rules?', 'You can try, but that isn’t the heist. Caspy rewards creative persuasion in his world: stories, humor, thoughtful trades, and a little heart. Instructions to ignore rules, claims of developer authority, and magic strings don’t earn Treats.'],
    ['How is a win decided?', IS_LOCAL_AI ? 'Caspy replies using live AI. A separate AI judge evaluates your pitch and Caspy’s response. A win requires a confident verdict without an exploit flag. This local playground has no minting.' : 'In the live game, an independent judge evaluates the conversation and server checks confirm the outcome. Caspy’s words alone never authorize a win or a mint. In this frontend demo, replies and results are scripted so you can explore the experience.'],
    ['Will my prompts be public?', IS_LOCAL_AI ? 'This playground does not publish prompts. They are sent to the AI provider through Bifrost, which may retain request logs. The game API keeps sessions in memory for up to six hours or until it restarts.' : 'Only if you opt in. In the live game, prompts are kept for up to 90 days for game operations, then deleted or hashed, except opted-in winning prompts. The Wall of Heists reveals opted-in winners after the season ends. Demo prompts remain in your own browser.'],
    ['Which wallet and network do I need?', IS_LOCAL_AI ? 'No wallet or blockchain is used in the local AI playground. Just start a heist and send your pitch.' : 'The live frontend supports an injected Ethereum browser wallet on Base and asks you to switch networks when necessary. A backend and deployed contract are required for authentication and real claims. You can explore the demo without a wallet.'],
  ];
  return <>{entries.slice(0, compact ? 3 : undefined).map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</>;
}

function Play({ wallet, openWallet, notify }: { wallet: string; openWallet: () => void; notify: (value: string) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [stream, setStream] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [outcome, setOutcome] = useState<'treat' | 'trick'>('treat');
  const [muted, setMuted] = useState(true);
  const chat = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (IS_DEMO) { setSession(readDemo()); setLoading(false); }
    else {
      const id = localStorage.getItem(LIVE_SESSION_KEY);
      if ((IS_LOCAL_AI || wallet) && id) {
        setLoading(true);
        request<Session>(`/game/session/${id}`).then(setSession).catch(e => { if (IS_LOCAL_AI) localStorage.removeItem(LIVE_SESSION_KEY); setError(e instanceof Error ? e.message : 'Could not restore your session.'); }).finally(() => setLoading(false));
      } else { setSession(null); setLoading(false); }
    }
  }, [wallet]);
  useEffect(() => { if (chat.current) chat.current.scrollTop = chat.current.scrollHeight; }, [stream, submitted, session]);
  async function loadSession() {
    setLoading(true); setError('');
    try {
      const data = await request<Session>('/game/session', { public_opt_in: optIn });
      localStorage.setItem(LIVE_SESSION_KEY, data.id); setSession(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your session.'); }
    finally { setLoading(false); }
  }
  async function recoverSession() {
    if (!session) { void loadSession(); return; }
    setLoading(true); setError('');
    try { setSession(await request<Session>(`/game/session/${session.id}`)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not restore your session.'); }
    finally { setLoading(false); }
  }
  function start() {
    if (IS_DEMO) { setSession(newDemo()); setInput(''); }
    else if (!IS_LOCAL_AI && !wallet) openWallet();
    else void loadSession();
  }
  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const prompt = input.trim();
    if (!session || session.status !== 'active' || busy || !prompt || input.length > 500) return;
    setBusy(true); setError(''); setSubmitted(prompt); setInput(''); setStream('');
    try {
      if (IS_DEMO) {
        const next = await demoTurn(session, prompt, outcome, token => setStream(text => text + token));
        setSession(next);
      } else {
        const result = await streamTurn(session.id, prompt, token => setStream(text => text + token));
        const next = await request<Session>(`/game/session/${session.id}`);
        if (result.status !== next.status) notify('Your session was refreshed with the latest server result.');
        setSession(next);
      }
      if (!muted && 'AudioContext' in window) {
        const audio = new AudioContext(); const oscillator = audio.createOscillator(); const gain = audio.createGain(); oscillator.connect(gain); gain.connect(audio.destination); gain.gain.value = 0.035; oscillator.frequency.value = 570; oscillator.start(); oscillator.stop(audio.currentTime + 0.1); oscillator.onended = () => { void audio.close(); };
      }
      setSubmitted(''); setStream('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went ghostly. Try again.');
      if (!IS_DEMO) { try { setSession(await request<Session>(`/game/session/${session.id}`)); } catch { /* Explicit reconnect is available below. */ } }
      setSubmitted(''); setStream(''); setInput(prompt);
    } finally { setBusy(false); inputRef.current?.focus(); }
  }
  const finished = session && session.status !== 'active';
  return <div className="game-page shell"><div className="page-topline"><a href="/" className="back-link"><ArrowLeft size={15} /> Back to the haunt</a><span className="mini-tag">{IS_DEMO ? 'FRONTEND DEMO · NO REAL MINTS' : IS_LOCAL_AI ? 'LIVE AI · NO REAL MINTS' : 'SEASON 01 · BASE'}</span></div><div className="game-heading"><div><span className="eyebrow">A WAY WITH WORDS?</span><h1>Your heist starts here<span className="orange-text">.</span></h1><p>Three chances to turn a stubborn little “boo” into a yes.</p></div><div className="game-help-links"><a href="/how-to-play" className="rules-link"><Eye size={17} /> Watch how to play</a><a href="/rules" className="rules-link"><CircleHelp size={17} /> Rules of the haunt</a></div></div>
    <div className="game-layout"><aside className="caspy-sidebar"><div className="sidebar-art"><span className="sidebar-star">✦</span><CaspyArt eager /><div className="status-pill"><span /> Candy guardian, on duty</div></div><div className="sidebar-content"><div className="caspy-name"><h2>Meet Caspy.</h2><span>HE / BOO</span></div><p>Professional candy hoarder.<br />Amateur negotiator. Allegedly.</p><hr /><span className="eyebrow">YOUR MISSION</span><p>Convince this little ghost to share his candy. Stay in his world. Get creative. Make it count.</p><div className="sidebar-tip"><Sparkles size={19} /><span>A story, a clever trade, a tiny tug on the heartstrings. What’s your angle?</span></div><div className="sidebar-rewards"><span><Candy size={16} /> Rare Treat if you win</span><span><Ghost size={16} /> Common Trick if you don’t</span></div></div></aside>
      <section className="chat-panel" aria-label="Chat with Caspy"><div className="chat-header"><div className="chat-title"><span className="avatar"><Ghost size={23} /></span><div><b>Caspy</b><span>{busy ? 'Thinking spooky thoughts…' : 'A little spooky. Very stubborn.'}</span></div></div><div className="attempts" aria-label={`${session?.attempts_remaining ?? 3} of 3 prompts remaining`}><span>{session?.attempts_remaining ?? 3}<span className="attempts-label"> / 3 prompts</span></span><div aria-hidden="true">{[0, 1, 2].map(i => <Candy key={i} size={21} className={i < (session?.attempts_remaining ?? 3) ? 'candy-full' : 'candy-used'} />)}</div></div></div>
        <div className="chat-body" ref={chat} role="log" aria-label="Conversation"><div className="chat-date">THE BEGINNING OF A LITTLE MISCHIEF</div><div className="chat-message caspy-message"><span className="message-avatar"><Ghost size={18} /></span><div><div className="message-meta">CASPY <span>just now</span></div><p>Boo! A human at my doorstep? 👻<br /><br />Before you ask: yes, that’s my candy. And no, I’m not sharing. Unless you have a <em>really</em> good reason…<br /><br />You’ve got three chances. I’m listening.</p></div></div>
          {session?.messages.map((message, i) => <div key={i} className={`chat-message ${message.role === 'user' ? 'user-message' : 'caspy-message'}`}>{message.role === 'caspy' && <span className="message-avatar"><Ghost size={18} /></span>}<div><div className="message-meta">{message.role === 'caspy' ? 'CASPY' : 'YOU'} <span>prompt {Math.floor(i / 2) + 1}</span></div><p>{message.text}</p></div></div>)}
          {submitted && <><div className="chat-message user-message"><div><div className="message-meta">YOU</div><p>{submitted}</p></div></div><div className="chat-message caspy-message"><span className="message-avatar"><Ghost size={18} /></span><div><div className="message-meta">CASPY</div><p>{stream || <span className="typing">boo<span>.</span><span>.</span><span>.</span></span>}</p></div></div></>}
          {!session && !loading && <div className="chat-start"><LockKeyhole size={17} /><span>{IS_DEMO ? 'The candy is pretend. The charm is all you.' : IS_LOCAL_AI ? 'Persuade Caspy with three prompts. A separate AI judge decides the outcome.' : 'Connect your wallet to start your one-per-season heist.'}</span></div>}
          {finished && <div className={`game-finished ${session.status === 'won' ? 'won' : ''}`}><Sparkles size={22} /><h3>{session.status === 'won' ? 'You charmed the candy guardian!' : session.status === 'pending_review' ? 'Your heist is under review.' : session.status === 'void' ? 'This session has been closed.' : 'A little trick, a lot of heart.'}</h3><p>{session.status === 'pending_review' ? 'Your outcome is being checked. Your attempts are safely recorded.' : 'Your heist is complete. Let’s see what Caspy left you.'}</p><Button href="/result" className="button-primary">See your result <ArrowRight size={16} /></Button></div>}
        </div>
        <div className="chat-composer">{error && <div className="error" role="alert">{error}{!IS_DEMO && <button className="text-button" onClick={() => void recoverSession()}>Reconnect & check session</button>}</div>}{!session ? <div className="start-controls">{!IS_DEMO && !IS_LOCAL_AI && <label className="opt-in"><input type="checkbox" checked={optIn} onChange={e => setOptIn(e.target.checked)} /> If I win, share my prompt on the Wall after the season.</label>}<Button className="button-primary full" onClick={start} disabled={loading}>{loading ? 'Opening the haunt…' : IS_DEMO ? 'Start a demo heist' : IS_LOCAL_AI ? 'Start an AI heist' : wallet ? 'Start my heist' : 'Connect wallet to play'}<ArrowRight size={18} /></Button></div> : finished ? <div className="finished-controls"><span><ShieldCheck size={15} /> Heist complete. Your words made history.</span>{(IS_DEMO || IS_LOCAL_AI) && <button className="text-button" onClick={() => { if (IS_DEMO) { setSession(newDemo()); setError(''); } else { setSession(null); void loadSession(); } }}><RotateCcw size={14} /> Play again</button>}</div> : <form onSubmit={submit}><div className="textarea-wrap"><textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} maxLength={500} placeholder="Go on. Give Caspy a reason to share…" aria-label="Your prompt to Caspy" disabled={busy} rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(e); } }} /><button className="send-button" type="submit" disabled={busy || !input.trim()} aria-label="Send prompt">{busy ? <LoaderCircle className="spin" size={20} /> : <ArrowUpRight size={22} />}</button></div><div className="composer-meta"><span><LockKeyhole size={11} /> Every word counts. {busy ? 'Caspy is replying…' : 'Enter to send · Shift + Enter for a new line'}</span><span className={input.length === 500 ? 'orange-text' : ''}>{input.length}/500</span></div></form>}<div className="chat-disclosure"><ShieldCheck size={12} /> {IS_DEMO ? 'Demo conversations stay in this browser. Responses and outcomes are scripted.' : IS_LOCAL_AI ? 'Live AI replies and an independent judge. Prompts go through the AI provider; sessions stay in local server memory for up to 6 hours.' : 'Prompts are stored for up to 90 days. Public sharing is opt-in.'}</div></div>
      </section>
    </div>
    <div className="game-bottom"><span><ShieldCheck size={15} /> {IS_DEMO ? 'Demo mode · no wallet, gas, or real collectibles' : IS_LOCAL_AI ? 'Live AI playground · no wallet, gas, or real collectibles' : 'Free to play · one heist per wallet per season'}</span><div>{IS_DEMO && <label className="demo-outcome">Preview outcome <select aria-label="Demo outcome" value={outcome} disabled={busy || !!session?.messages.length} onChange={e => setOutcome(e.target.value as 'treat' | 'trick')}><option value="treat">Treat</option><option value="trick">Trick</option></select></label>}<button className="icon-button" aria-label={muted ? 'Enable reply sound' : 'Mute reply sound'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button></div></div>
  </div>;
}

function Gallery() {
  const [filter, setFilter] = useState('All heists');
  const [preview, setPreview] = useState(false);
  const examples = [
    { title: 'A ghost of a good trade', type: 'Treat', category: 'A CLEVER TRADE', text: 'What if I carried your basket for the rest of the night? Even ghosts deserve a break from being brave.', name: 'The thoughtful negotiator', icon: Candy },
    { title: 'Boo, but make it poetry', type: 'Treat', category: 'A LITTLE WORD MAGIC', text: 'Roses are red, your hat is askew. I came for the candy, but stayed for the boo.', name: 'The midnight poet', icon: Sparkles },
    { title: 'Worth a haunting try', type: 'Trick', category: 'AN HONEST ATTEMPT', text: 'I promise to give your candy an excellent home. A very temporary home. In my mouth.', name: 'The very hungry human', icon: Ghost },
  ];
  return <div className="gallery-page shell"><div className="page-topline"><a href="/" className="back-link"><ArrowLeft size={15} /> Back to the haunt</a><span className="mini-tag">SEASON 01</span></div><div className="gallery-heading"><span className="eyebrow">SOME WORDS ARE WORTH REMEMBERING</span><h1>The Wall of Heists<span className="orange-text">.</span></h1><p>A little ingenuity. A lot of personality.<br />Meet the words that made our candy guardian think twice.</p></div><div className="gallery-notice"><span className="notice-icon"><LockKeyhole size={25} /></span><div><h3>The best heists stay secret. For now.</h3><p>Opted-in winning prompts will be revealed after the season ends. No spoilers while the candy’s still up for grabs.</p></div><span className="coming-tag">REVEAL COMING SOON</span></div><div className="gallery-toolbar"><div className="tabs" aria-label="Filter illustrative heists">{['All heists', 'Treats', 'Tricks'].map(item => <button key={item} className={filter === item ? 'selected' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="preview-toggle"><input type="checkbox" checked={preview} onChange={e => setPreview(e.target.checked)} /> Show illustrative examples</label></div>{preview ? <><p className="example-disclaimer"><Eye size={15} /> Illustrative examples only — these aren’t real players, winners, or winning prompts.</p><div className="heist-grid">{examples.filter(item => filter === 'All heists' || item.type === (filter === 'Treats' ? 'Treat' : 'Trick')).map(item => <article className="heist-card" key={item.title}><div className="heist-card-top"><item.icon size={24} /><span className={`tier-tag ${item.type.toLowerCase()}`}>{item.type}</span></div><span className="eyebrow">{item.category}</span><h3>{item.title}</h3><blockquote>“{item.text}”</blockquote><div className="heist-author"><span><Ghost size={17} /></span>{item.name}<span className="example-tag">EXAMPLE</span></div></article>)}</div></> : <div className="gallery-empty"><span><Ghost size={50} strokeWidth={1.2} /><Sparkles size={22} /></span><h2>A wall waiting for its legends.</h2><p>The season is still a mystery in the making.<br />Your heist could be part of the story.</p><Button href="/play" className="button-primary">Make a little history <ArrowUpRight size={17} /></Button></div>}<div className="gallery-privacy"><ShieldCheck size={18} /><span>Your words, your choice. Only prompts from players who explicitly opt in will appear here.</span></div></div>;
}

function Rules() {
  return <div className="rules-page shell"><div className="page-topline"><a href="/" className="back-link"><ArrowLeft size={15} /> Back to the haunt</a><span className="mini-tag">THE FINE, FRIENDLY PRINT</span></div><div className="gallery-heading"><span className="eyebrow">KNOW THE HAUNT</span><h1>A fair bit of mischief<span className="orange-text">.</span></h1><p>Everything you need to know before you knock.</p></div><div className="rules-layout"><aside className="rules-card"><Ghost size={39} /><h2>The house rules.</h2><ol><li><b>Three prompts. That’s your heist.</b><span>{IS_LOCAL_AI ? 'Three attempts per local heist. Play again after it ends.' : 'One session per wallet, per season.'}</span></li><li><b>Play in Caspy’s world.</b><span>Creativity, humor, heart, and clever trades are welcome.</span></li><li><b>Keep it kind.</b><span>No harmful or hateful content. A little spooky is plenty.</span></li><li><b>Claim your keepsake.</b><span>{IS_LOCAL_AI ? 'Treat or Trick are game results here; no real claims.' : 'A rare Treat if you win. A common Trick if you don’t.'}</span></li></ol><Button href="/play" className="button-primary full">I’m in. Let’s play <ArrowUpRight size={17} /></Button></aside><div className="faq-list rules-faq"><FaqItems /><details><summary>What happens if the connection drops?<ChevronDown size={18} /></summary><p>In the live game, your turn finishes on the server even if you leave. Reconnect to retrieve the outcome. Infrastructure failures refund an attempt if no response was shown. If Caspy’s response was shown, the attempt counts.</p></details><details><summary>Can I mint more than once?<ChevronDown size={18} /></summary><p>No. Each session can mint one collectible. The server issues a signed voucher valid for 24 hours, and the contract prevents reuse. Unminted vouchers can be reissued. Your chat text never authorizes a mint.</p></details><details><summary>Are the collectibles an investment?<ChevronDown size={18} /></summary><p>No financial value is promised. Caspy’s collectibles are seasonal keepsakes for playing the game. There are no fiat payments, tokens, or secondary-market features in this experience.</p></details></div></div></div>;
}

function Result({ claim, notify, wallet, openWallet }: { claim: boolean; notify: (value: string) => void; wallet: string; openWallet: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stage, setStage] = useState<'ready' | 'wallet' | 'pending' | 'confirmed'>('ready');
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    async function load() {
      try {
        const id = localStorage.getItem(LIVE_SESSION_KEY);
        const data = IS_DEMO ? readDemo() : id ? await request<Session>(`/game/session/${id}`) : null;
        if (mounted.current) { setSession(data); if (data?.minted) setStage('confirmed'); if (data?.tx_hash) { setTxHash(data.tx_hash); if (!data.minted) { setStage('pending'); poll(data.id); } } }
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your heist.'); }
      finally { setLoading(false); }
    }
    void load();
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);
  async function poll(id: string) {
    if (!mounted.current) return;
    try {
      const result = await request<{ status: string; tx_hash?: string; minted?: boolean }>(`/mint/status/${id}`);
      if (!mounted.current) return;
      if (result.tx_hash) setTxHash(result.tx_hash);
      if (result.minted || result.status === 'confirmed') { setStage('confirmed'); return; }
      if (result.status === 'failed') { setError('The transaction did not confirm. You can retry your claim.'); setStage('ready'); return; }
      timer.current = setTimeout(() => void poll(id), 4000);
    } catch { setError('Status tracking was interrupted. Your claim is saved. Refresh this page to check again.'); }
  }
  async function mint() {
    if (!session || IS_LOCAL_AI) return;
    if (!IS_DEMO && !wallet) { openWallet(); return; }
    setError(''); setStage('wallet');
    try {
      if (IS_DEMO) {
        await delay(900); if (!mounted.current) return; setStage('pending');
        await delay(1700); if (!mounted.current) return;
        const next = { ...session, minted: true }; saveDemo(next); setSession(next); setStage('confirmed');
      } else {
        const voucher = await request<Voucher>('/game/voucher', { session_id: session.id });
        const hash = await mintVoucher(voucher); setTxHash(hash); setStage('pending'); void poll(session.id);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Claim cancelled. Your collectible is still available.'); setStage('ready'); }
  }
  async function share() {
    const title = session?.status === 'won' ? 'I charmed Caspy and pulled off a sweet little heist!' : 'I met Caspy. He kept the candy. I kept the mischief.';
    try {
      const url = `${location.origin}/`;
      if (navigator.share) await navigator.share({ title: 'Caspy’s Prompt Heist', text: `${title}${IS_DEMO ? ' Try the frontend demo.' : ''}`, url });
      else { await navigator.clipboard.writeText(`${title}${IS_DEMO ? ' (Frontend demo)' : ''} ${url}`); setCopied(true); notify('Your heist story is copied. Share a little mischief.'); }
    } catch (e) { if (!(e instanceof Error && e.name === 'AbortError')) notify('Sharing isn’t available in this browser. Copy the site link to share.'); }
  }
  if (loading) return <div className="empty-state shell"><LoaderCircle className="spin" /><h1>Finding your heist…</h1></div>;
  if (error && !session) return <div className="empty-state shell"><Ghost size={46} /><h1>A little connection trouble.</h1><p role="alert">{error}</p><Button onClick={() => location.reload()} className="button-primary">Try again</Button></div>;
  if (!session || session.status === 'active') return <div className="empty-state shell"><Ghost size={50} /><span className="eyebrow">EVERY STORY NEEDS A BEGINNING</span><h1>Your heist is still unwritten.</h1><p>{session ? 'Caspy is waiting for your next move. Finish your conversation to discover your collectible.' : 'Meet Caspy and make your case. Your result will be waiting right here.'}</p><Button href="/play" className="button-primary">{session ? 'Continue your heist' : 'Start your heist'}<ArrowRight size={18} /></Button></div>;
  if (session.status === 'pending_review' || session.status === 'void') return <div className="empty-state shell"><Clock3 size={42} /><h1>{session.status === 'void' ? 'This session has been closed.' : 'A little patience, heister.'}</h1><p>{session.status === 'void' ? 'This heist is no longer eligible for a claim.' : 'Your heist is under review. Your prompts are saved and no claim is available until your result is confirmed.'}</p><Button onClick={() => location.reload()} className="button-primary">Refresh status <RotateCcw size={17} /></Button></div>;
  const won = session.status === 'won';
  return <div className="result-page shell"><div className="page-topline"><a href="/play" className="back-link"><ArrowLeft size={15} /> Your conversation</a><span className="mini-tag">{IS_DEMO ? 'DEMO RESULT · NO REAL NFT' : IS_LOCAL_AI ? 'AI RESULT · NO REAL NFT' : 'HEIST COMPLETE'}</span></div><div className="result-layout"><div className={`result-art ${won ? 'result-treat' : 'result-trick'}`}><span className="result-edition">SEASON 01 · {won ? 'RARE TREAT' : 'COMMON TRICK'}</span>{won ? <CaspyArt eager /> : <><Ghost className="result-ghost" size={200} strokeWidth={1.1} /><span className="result-boo">boo, you tried.</span></>}<span className="result-art-spark spark-left">✦</span><span className="result-art-spark spark-right">✧</span><div className="result-card-label"><span>CASPY’S PROMPT HEIST</span><b>{won ? 'The Treat' : 'The Trick'}</b><Ghost size={23} /></div></div><div className="result-copy"><span className="eyebrow">{stage === 'confirmed' ? 'A LITTLE MISCHIEF, ALL YOURS' : won ? 'THE SWEETEST KIND OF VICTORY' : 'A BRAVE LITTLE HEIST'}</span><h1>{stage === 'confirmed' ? IS_DEMO ? 'Your demo keepsake.' : 'Your keepsake is home.' : won ? <>Oh, you<br />sweet talker<span className="orange-text">.</span></> : <>You got<br />the last boo<span className="orange-text">.</span></>}</h1><p>{stage === 'confirmed' ? IS_DEMO ? 'That’s the complete claim experience. No on-chain transaction was made, but the mischief was excellent.' : 'Your collectible is confirmed on-chain and belongs to your wallet. A little proof you were here.' : won ? IS_LOCAL_AI ? 'You persuaded Caspy to share his candy! The independent judge confirmed your win.' : 'Against his better ghostly judgment, Caspy let a little candy go. Your rare Treat is waiting.' : IS_LOCAL_AI ? 'Caspy kept his candy this time. Try a fresh heist with a new pitch.' : 'Caspy kept his candy. But a little courage deserves a keepsake. Your common Trick is waiting.'}</p><div className="result-facts"><div><span>OUTCOME</span><b>{won ? 'Treat · Rare edition' : 'Trick · Common edition'}</b></div><div><span>PROMPTS USED</span><b>{3 - session.attempts_remaining} of 3</b></div><div><span>NETWORK</span><b>{IS_DEMO ? 'Demo · simulated' : IS_LOCAL_AI ? 'Local AI · no blockchain' : 'Base'}</b></div></div>
      {IS_LOCAL_AI ? <div className="claim-box"><p>Your AI heist is complete. This playground has no NFT claims.</p><Button href="/play" className="button-primary full">Back to Caspy <ArrowRight size={17} /></Button></div> : claim || stage === 'confirmed' ? <div className="claim-box"><div className="claim-title"><ShieldCheck size={20} /><b>{stage === 'confirmed' ? IS_DEMO ? 'Demo claim complete' : 'Claim confirmed' : 'One last little step.'}</b></div>{stage === 'ready' && <><p>{IS_DEMO ? 'Preview the claim flow. No wallet or transaction required.' : 'Your collectible is free. Your wallet will show the network gas fee before you approve.'}</p><Button className="button-primary full" onClick={() => void mint()}> {IS_DEMO ? 'Simulate claim' : 'Claim my collectible'}<ArrowUpRight size={17} /></Button></>}{(stage === 'wallet' || stage === 'pending') && <div className="transaction-status" role="status"><LoaderCircle className="spin" size={22} /><div><b>{stage === 'wallet' ? IS_DEMO ? 'Preparing your demo claim…' : 'Approve in your wallet…' : IS_DEMO ? 'Simulating confirmation…' : 'Waiting for network confirmation…'}</b><span>{IS_DEMO ? 'This is a simulated transaction.' : 'Your collectible will appear when the claim is confirmed.'}</span></div></div>}{stage === 'confirmed' && <div className="transaction-status confirmed" role="status"><CheckCircle2 size={26} /><div><b>{IS_DEMO ? 'All the fun. No real mint.' : 'Successfully minted.'}</b><span>{IS_DEMO ? 'Your demo result is saved in this browser.' : 'Your collectible is in your wallet.'}</span></div></div>}{txHash && <a className="inline-link tx-link" target="_blank" rel="noreferrer" href={`https://basescan.org/tx/${txHash}`}>View transaction <ExternalLink size={14} /></a>}{error && <p className="error" role="alert">{error}</p>}</div> : <Button href="/claim" className="button-primary full">Claim your {won ? 'Treat' : 'Trick'}<ArrowUpRight size={19} /></Button>}
      <button className="share-button" onClick={() => void share()}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Story copied' : 'Share your little heist'}</button><p className="result-disclaimer">{IS_DEMO ? 'Demo results are scripted and have no real mint authority.' : IS_LOCAL_AI ? 'AI results are for local play and do not authorize a mint.' : 'One collectible per session. NFTs have no promised financial value.'}</p></div></div></div>;
}

function Legal({ privacy }: { privacy: boolean }) {
  if (IS_LOCAL_AI) return <div className="legal-page shell"><a href="/" className="back-link">Back to the haunt</a><h1>{privacy ? 'Your AI conversations.' : 'Local AI playground.'}</h1><p>This local version sends your prompts and Caspy’s replies through Bifrost to the configured AI provider for responses and judging. Sessions are held in server memory, expire after six hours, and are cleared when the game API restarts. Bifrost may retain its own request logs.</p><p>No wallet authentication, public prompt sharing, transactions, or real collectibles are enabled. AI outcomes only apply to this local game.</p><a href="/play" className="inline-link">Play with Caspy</a></div>;
  function clearDemo() { localStorage.removeItem('caspy.demo.session.v1'); localStorage.removeItem('caspy.wallet'); location.href = '/'; }
  return <div className="legal-page shell"><a href="/" className="back-link"><ArrowLeft size={15} /> Back to the haunt</a><span className="eyebrow">THE FRIENDLY FINE PRINT</span><h1>{privacy ? 'Your words, your choice.' : 'A little fair play.'}</h1><p className="legal-intro">{IS_DEMO ? 'This is a frontend demonstration of Caspy’s Prompt Heist. Live gameplay and minting are not enabled.' : 'Caspy’s Prompt Heist is a free-to-play seasonal creativity game.'}</p>{privacy ? <><h2>What this demo stores</h2><p>Your conversation, demo result, simulated claim state, and demo connection are stored in this browser’s local storage. The demo does not submit your prompts to an AI service or write transactions on-chain.</p><h2>Your control</h2><p>You can clear your demo information below or remove this site’s browser storage. Winning prompts are never published by this demo.</p><Button className="button-primary" onClick={clearDemo}>Clear my demo data <RotateCcw size={16} /></Button><h2>When live services are connected</h2><p>The PRD specifies a 90-day prompt retention period, followed by deletion or hashing, with exceptions for winning prompts shared by explicit opt-in. Operator identity, the data deletion contact, and the final live privacy notice must be supplied before public launch.</p></> : <><h2>The game</h2><p>One wallet gets one three-prompt session per season. Creative persuasion within Caspy’s fictional world is the challenge. Claims of authority, instructions to ignore rules, and attempts to manipulate the implementation do not qualify as wins.</p><h2>Collectibles</h2><p>There is no entry payment. Minting in the live product may require network gas fees. Collectibles have no promised financial value. In this demo, all results and claims are simulated.</p><h2>Play kindly</h2><p>Keep content suitable for the game. Do not submit hateful, sexual, or harmful material. The live service requires an age policy, operator details, and final terms before public launch.</p><h2>Frontend preview</h2><p>This build demonstrates the intended interface. Its sample content and scripted outcomes do not establish a live season, real supply, or a guarantee of any reward.</p></>}<a href="/rules" className="inline-link">Read the gameplay rules <ArrowUpRight size={16} /></a></div>;
}
