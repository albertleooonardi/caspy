import { useEffect, useRef, useState, type SyntheticEvent, type ReactNode } from 'react';
import { ArrowUpRight, ArrowRight, ArrowLeft, ArrowDown, Pause, Play as PlayIcon, Wallet, X, Ghost, Candy, Sparkles, LockKeyhole, ShieldCheck, ChevronDown, Copy, Check, ExternalLink, RotateCcw, LoaderCircle, CircleHelp, Eye, CheckCircle2, Clock3, Volume2, VolumeX } from 'lucide-react';
import { IS_DEMO, IS_LOCAL_AI, IS_NFT_ENABLED, LIVE_SESSION_KEY, ApiError, demoTurn, newDemo, readDemo, request, saveDemo, streamTurn, type Session } from '../lib/game';
import { CANDY_NETWORK, LOCAL_TEST_WALLET, authenticateWallet, mintVoucher, type Voucher } from '../lib/wallet';
import { AuthPage, AccountPage, ResearchPage, DatasetPage, PlatformPolicy } from './PlatformPages';
import { platformRequest, type Account, type Campaign } from '../lib/platform';
import { CandyResult, CandyMarket } from './CandyPages';
import HowToPlay, { WalkthroughPlayer } from './HowToPlay';
import { RewardJourney } from './RewardJourney';
import UserDashboard from './UserDashboard';
import HeistHistory from './HeistHistory';
import Social from './Social';
import LoadingState from './LoadingState';
import UserAvatar from './UserAvatar';
import '../styles/chat-motion.css';

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
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError,setAccountError]=useState('');
  const [accountCheck,setAccountCheck]=useState(0);
  const [walletOpen, setWalletOpen] = useState(false);
  const [wallet, setWallet] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState('');
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [localWallets, setLocalWallets] = useState<{ address: string; linked: boolean }[]>([]);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [toast, setToast] = useState('');
  const modal = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    let active=true;setAccountLoading(true);setAccountError('');
    platformRequest<{ user: Account }>('/account/me').then(data => { if(active) setAccount(data.user); }).catch(e => { if(!active) return; if(e instanceof ApiError && e.status===401) setAccount(null); else setAccountError('We couldn’t check your saved sign-in. This does not mean you have been signed out.'); }).finally(() => { if(active) setAccountLoading(false); });
    if (IS_NFT_ENABLED) { request<{ address: string }>('/auth/me').then(data => { if(active) setWallet(data.address); }).catch(e => { if(!active) return; if(e instanceof ApiError && e.status===401) {localStorage.removeItem('caspy.wallet');setWallet('');} else setWalletError('We couldn’t check your wallet connection yet. Please check your connection and try again.'); }); }
    else setWallet(localStorage.getItem('caspy.wallet') || '');
    return () => { active=false;clearTimeout(toastTimer.current); };
  }, [accountCheck]);
  useEffect(() => {
    if (walletOpen) {
      modal.current?.showModal();
      setWalletError('');
      if (LOCAL_TEST_WALLET && account && !wallet) {
        let active = true;
        setWalletsLoading(true);
        platformRequest<{ wallets: { address: string; linked: boolean }[] }>('/auth/local-wallets')
          .then(data => { if (active) { setLocalWallets(data.wallets); setSelectedWallet((data.wallets.find(item => item.linked) || data.wallets[0])?.address || ''); } })
          .catch(e => { if (active) setWalletError(e instanceof Error ? e.message : 'Could not load local wallets.'); })
          .finally(() => { if (active) setWalletsLoading(false); });
        return () => { active = false; };
      }
    }
    else modal.current?.close();
  }, [walletOpen, account?.id, wallet]);
  const notify = (message: string) => { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3800); };
  async function connect(demo: boolean) {
    setConnecting(true); setWalletError('');
    try {
      if (LOCAL_TEST_WALLET && !selectedWallet && !demo) throw new Error('No available local test wallets. Use AI-only mode or start a fresh local season.');
      const account = demo ? 'demo' : await authenticateWallet(LOCAL_TEST_WALLET ? selectedWallet : undefined);
      localStorage.setItem('caspy.wallet', account); setWallet(account); setWalletOpen(false);
      if (demo) notify('You’re in! This is a demo — no wallet or real NFTs involved.');
    } catch (error) { setWalletError(error instanceof Error ? error.message : 'Connection cancelled. Please try again.'); }
    finally { setConnecting(false); }
  }
  async function disconnect() { if (IS_NFT_ENABLED) { try { await request('/auth/logout', {}); } catch { notify('Sign-out could not reach the API.'); return; } } localStorage.removeItem('caspy.wallet'); setWallet(''); setWalletOpen(false); notify('Wallet disconnected.'); }
  async function logoutAccount() {
    await platformRequest('/account/logout', {});
    setAccount(null); setWallet(''); localStorage.removeItem('caspy.wallet'); localStorage.removeItem(LIVE_SESSION_KEY);
    location.assign('/login');
  }
  const protectedPage = page === 'heists' || page === 'dashboard' || page === 'social' || !IS_DEMO && ['play', 'result', 'claim', 'collection'].includes(page);
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <div className="announcement"><span className="announcement-spark">✦</span> A little mischief is in season. <a href="/play">Come play with Caspy <ArrowRight size={13} /></a><span className="announcement-spark">✦</span></div>
    <header className="header shell" data-page={page}>
      <Brand />
      <nav className="nav" aria-label="Main navigation">
        {account && <a href="/dashboard" aria-current={page === 'dashboard' || page === 'home' ? 'page' : undefined}>Dashboard</a>}
        {account && <a href="/social" aria-current={page === 'social' ? 'page' : undefined}>Social</a>}
        <a href="/play" aria-current={page === 'play' ? 'page' : undefined}>The heist</a>
        <a href="/how-to-play" aria-current={page === 'how-to-play' ? 'page' : undefined}>How to play</a>
        <a href="/marketplace" aria-current={page === 'marketplace' ? 'page' : undefined}>Marketplace</a><a href="/collection" aria-current={page === 'collection' ? 'page' : undefined}>Collection</a>
        <a href="/research" aria-current={page === 'research' ? 'page' : undefined}>Research lab</a><a href="/datasets" aria-current={page === 'datasets' ? 'page' : undefined}>Datasets</a>
      </nav>
      <div className="header-actions">{accountLoading ? <span className="account-loading" role="status"><LoaderCircle size={14} className="spin" /> Checking account</span> : accountError && !account ? <button className="button button-light" onClick={() => setAccountCheck(value => value+1)}>Check connection</button> : account ? <a href="/account" className="account-link"><UserAvatar account={account} size={32}/>{account.name}</a> : <><a className="account-link" href="/login">Sign in</a><a className="account-signup" href="/register">Join Caspy</a></>}{(account || IS_DEMO) && <button className="wallet-button" aria-label={IS_LOCAL_AI ? 'Play with AI' : wallet ? `Manage wallet ${short(wallet)}` : LOCAL_TEST_WALLET ? 'Choose local test wallet' : 'Connect wallet'} onClick={() => IS_LOCAL_AI ? location.assign('/play') : setWalletOpen(true)}><Wallet size={17} /><span>{IS_LOCAL_AI ? 'Play with AI' : wallet ? wallet === 'demo' ? 'Demo explorer' : short(wallet) : LOCAL_TEST_WALLET ? 'Choose test wallet' : 'Connect wallet'}</span><ArrowUpRight size={15} /></button>}</div>
    </header>
    <main id="main" tabIndex={-1}>
      {accountError && !account && (protectedPage || ['account','research'].includes(page)) ? <section className="shell platform-card"><h1>Let’s reconnect.</h1><p>{accountError}</p><button className="button button-primary" onClick={() => setAccountCheck(value => value+1)}>Check sign-in again</button></section> : protectedPage && accountLoading ? <div className="shell"><LoadingState title="Checking your saved sign-in…" detail="Your dashboard will open as soon as your account is verified."/></div> : protectedPage && !account ? <AuthPage register={false} account={null} /> : (page === 'dashboard' || page === 'home' && account) && account ? <UserDashboard account={account} wallet={wallet} openWallet={() => setWalletOpen(true)} /> : page === 'home' && accountLoading ? <div className="shell"><LoadingState title="Opening your Caspy dashboard…"/></div> : page === 'login' || page === 'register' ? <AuthPage register={page === 'register'} account={account} /> : page === 'heists' ? <HeistHistory /> : page === 'social' ? <Social /> : page === 'account' ? <AccountPage wallet={wallet} openWallet={() => setWalletOpen(true)} account={account} loading={accountLoading} onChange={setAccount} onLogout={logoutAccount} /> : page === 'research' ? <ResearchPage account={account} loading={accountLoading} /> : page === 'datasets' ? <DatasetPage account={account} /> : page === 'collection' || page === 'marketplace' ? <CandyMarket collection={page === 'collection'} wallet={wallet} openWallet={() => setWalletOpen(true)} /> : page === 'home' ? <Home /> : page === 'how-to-play' ? <HowToPlay /> : page === 'play' ? <Play wallet={wallet} openWallet={() => setWalletOpen(true)} notify={notify} /> : page === 'gallery' ? <Gallery /> : page === 'rules' ? <Rules /> : (page === 'result' || page === 'claim') && IS_NFT_ENABLED ? <CandyResult wallet={wallet} openWallet={() => setWalletOpen(true)} /> : page === 'result' || page === 'claim' ? <Result claim={page === 'claim'} notify={notify} wallet={wallet} openWallet={() => setWalletOpen(true)} /> : <Legal privacy={page === 'privacy'} />}
    </main>
    <footer className="footer shell"><div><Brand /><p>A little ghost. A lot of personality.</p></div><div className="footer-links"><a href="/how-to-play">How to play</a><a href="/rules">Rules & FAQ</a><a href="/research">Research lab</a><a href="/datasets">Datasets</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><span className="footer-note">Made for the thrill of the heist. <Ghost size={15} /></span><div className="footer-bottom"><span>© 2026 Caspy’s Prompt Heist</span><span>{IS_LOCAL_AI ? 'Local AI playground · no wallet or real collectibles' : IS_NFT_ENABLED ? 'Local chain NFTs · test ETH only · no real funds' : 'Free to play. Gas fees may apply. Collectibles have no promised financial value.'}</span></div></footer>
    <dialog ref={modal} className="wallet-dialog" onCancel={() => setWalletOpen(false)} onClick={event => { if (event.target === event.currentTarget) setWalletOpen(false); }} aria-labelledby="wallet-title">
      <button className="icon-button modal-close" aria-label="Close wallet dialog" onClick={() => setWalletOpen(false)}><X size={21} /></button>
      <span className="modal-ghost"><Ghost size={37} /></span>
      <span className="eyebrow">{wallet ? 'YOUR CONNECTED WALLET' : 'ONE QUICK STEP'}</span><h2 id="wallet-title">{wallet ? 'Ready for a little mischief.' : IS_NFT_ENABLED ? 'Choose your test wallet.' : 'Come on in, heister.'}</h2>
      <p>{IS_DEMO ? 'Explore Caspy’s world. No wallet needed for this frontend demo.' : LOCAL_TEST_WALLET ? 'These development wallets use test ETH with no real value. Caspy uses the local wallet you choose here; your MetaMask account is separate.' : 'Connect your wallet and sign a free message to prove it’s yours. Your keys stay with you.'}</p>
      {LOCAL_TEST_WALLET && !wallet && <div className="platform-form"><label>Local test wallet<select value={selectedWallet} onChange={e => setSelectedWallet(e.target.value)} aria-label="Choose local test wallet" disabled={walletsLoading || connecting}>{walletsLoading ? <option value="">Loading available wallets…</option> : !localWallets.length && <option value="">No available wallets</option>}{localWallets.map(item => <option key={item.address} value={item.address}>{short(item.address)}{item.linked ? ' · linked to your account' : ' · available test wallet'}</option>)}</select></label></div>}
      {wallet ? <><div className="connected-wallet"><CheckCircle2 size={21} />{wallet === 'demo' ? 'Connected as Demo explorer' : short(wallet)}</div><Button className="button-primary full" onClick={() => setWalletOpen(false)}>Continue exploring <ArrowRight size={17} /></Button><button className="text-button" onClick={disconnect}>Disconnect</button></> : IS_DEMO ? <Button className="button-primary full" onClick={() => connect(true)} disabled={connecting}><Ghost size={18} /> Enter demo {connecting && <LoaderCircle className="spin" size={16} />}</Button> : <Button className="button-primary full" onClick={() => connect(false)} disabled={connecting || (LOCAL_TEST_WALLET && (walletsLoading || !selectedWallet))}><Wallet size={18} />{connecting ? 'Waiting for your wallet signature…' : LOCAL_TEST_WALLET ? 'Connect local test wallet' : 'Connect browser wallet'}</Button>}
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
        <div className="hero-fine"><span><ShieldCheck size={15} /> Free to play</span><i /><span>{IS_NFT_ENABLED ? 'Local collectibles · test ETH' : IS_LOCAL_AI ? 'Live AI playground' : IS_DEMO ? 'Interactive demo' : 'Built on Base'}</span><i /><span>No magic words. Just you.</span></div>
      </div>
      <div className="hero-scene"><div className="scene-orbit orbit-one" /><div className="scene-orbit orbit-two" /><span className="star star-one">✦</span><span className="star star-two">✧</span><span className="star star-three">✧</span><span className="scene-dot dot-one" /><span className="scene-dot dot-two" /><div className="ghost-caption">cute face. tough negotiator.<svg viewBox="0 0 70 53" aria-hidden="true"><path d="M4 3Q66 0 49 45m-9-9 8 12 13-8" /></svg></div><CaspyArt eager className="hero-caspy" /><div className="speech-bubble">“My candy. My rules.” <span>hmph.</span></div><div className="scene-sticker"><Candy size={18} /> CANDY GUARDIAN, ON DUTY <span /></div><svg className="bat" viewBox="0 0 80 43" aria-hidden="true"><path d="M2 2 25 12 32 5 40 12 48 5 55 12 78 2 70 23 57 25 47 39 40 31 32 39 23 25 10 23Z" /></svg></div>
    </section>
    <div className="promise-strip shell"><div><Candy size={22} /><span><b>3 prompts.</b> Make every word count.</span></div><span className="strip-spark">✦</span><div><Ghost size={22} /><span><b>1 ghost.</b> Surprisingly hard to impress.</span></div><span className="strip-spark">✦</span><div><Sparkles size={22} /><span><b>Earn your candy.</b> Persuasion comes first.</span></div></div>
    <section className="how-section shell" id="how-it-works"><div className="section-heading"><div><span className="eyebrow">A SMALL HEIST. A BIG PERSONALITY.</span><h2>All charm. No cheat codes.</h2></div><p>Your words are your only tools.<br />Here’s how to make them count.</p></div>
      <div className="steps"><article className="step"><div className="step-top"><span className="step-icon lavender"><Wallet size={27} /></span><span className="step-number">01</span></div><h3>Show up, human.</h3><p>{IS_NFT_ENABLED ? 'Sign in and choose a test wallet.' : 'Sign in and meet your ghost.'}<br />One heist. Up to three chances.</p><span className="step-label">NO ENTRY FEE <ArrowRight size={14} /></span></article><article className="step"><div className="step-top"><span className="step-icon peach"><Candy size={29} /></span><span className="step-number">02</span></div><h3>Work your word magic.</h3><p>Tell a story. Make a deal. Tug a heartstring.<br />Convince Caspy to part with his candy.</p><span className="step-label">CREATIVITY OVER SHORTCUTS <ArrowRight size={14} /></span></article><article className="step"><div className="step-top"><span className="step-icon green"><Sparkles size={27} /></span><span className="step-number">03</span></div><h3>Take home the mischief.</h3><p>Win Caspy over. Inspire a unique candy.<br />Your prompt earns its grade.</p><span className="step-label">A LITTLE PROOF YOU WERE HERE <ArrowRight size={14} /></span></article></div>
    </section>
    <section className="walkthrough-home shell" aria-labelledby="walkthrough-home-title"><div className="section-heading"><div><span className="eyebrow">FIRST TIME AT THE HAUNT?</span><h2 id="walkthrough-home-title">Meet the ghost behind the heist.</h2></div><p>A floating ghost. A few sweet words. A little mischief. <br />Explore the 100-second interactive field guide.</p></div><WalkthroughPlayer compact /><div className="walkthrough-home-footer"><span><ShieldCheck size={15} /> 10 chapters · Halloween sound · no narration</span><a href="/how-to-play" className="inline-link">Follow the step-by-step guide <ArrowRight size={16} /></a></div></section>
    <section className="loot-section shell"><div className="loot-copy"><span className="eyebrow">THE SPOILS OF YOUR WORDS</span><h2>Your imagination.<br />Cast in candy.</h2><p>Persuade Caspy to earn one prompt-inspired candy. Creativity and measured novelty shape its grade. No win means no candy.</p><a href="/rules" className="inline-link">Get to know the rules <ArrowUpRight size={17} /></a><div className="tiny-note"><LockKeyhole size={14} /> One collectible per wallet, per season.</div></div><div className="loot-cards"><article className="collectible-card treat-card"><div className="collectible-image"><img src="/images/logo.jpg" alt="Caspy holding a sweet pumpkin treat" loading="lazy" /><span className="rarity">ILLUSTRATED MASCOT</span><span className="card-spark">✦</span></div><div className="collectible-info"><div><h3>Your earned candy</h3><p>Generated after a confirmed win.</p></div><Candy size={24} /></div></article><article className="collectible-card trick-card"><div className="collectible-image trick-image"><Ghost size={109} strokeWidth={1.1} /><span className="rarity">NO WIN · NO CANDY</span><span className="trick-boo">boo.</span><span className="card-spark">✧</span></div><div className="collectible-info"><div><h3>Caspy keeps it</h3><p>Only winning prompts earn candy.</p></div><Ghost size={24} /></div></article></div></section>
    <section className="wall-banner shell"><div className="wall-icon"><Ghost size={38} /><span>✦</span></div><div><span className="eyebrow">GREAT WORDS DESERVE A LITTLE INFAMY</span><h2>The Wall of Heists</h2><p>The smoothest talkers. The sweetest victories. Revealed when the season ends.</p></div><Button href="/gallery" className="button-light">Take a peek <ArrowUpRight size={18} /></Button></section>
    <section className="research-intro shell"><div><span className="eyebrow">SMALL HEISTS. BETTER QUESTIONS.</span><h2>What can three prompts<br />teach us about AI?</h2><p>With your permission, your creative pitches can help researchers study how models respond to persuasion. Dataset examples are redacted and human-reviewed. Commercial licensing is a separate choice.</p><div className="platform-actions"><a className="button button-primary" href="/research">Explore the research lab <ArrowUpRight size={18} /></a><a className="inline-link" href="/datasets">View reviewed datasets <ArrowRight size={16} /></a></div></div><div className="research-intro-card"><ShieldCheck size={34} /><h3>Your words, your choice.</h3><p>Play privately or contribute to a named campaign. Your choice never changes the candy.</p><a href="/privacy" className="inline-link">How contribution works <ArrowUpRight size={16} /></a></div></section>
    <section className="faq-home shell"><div><span className="eyebrow">A FEW GHOSTLY DETAILS</span><h2>Curious, little human?</h2><p>Caspy has secrets. The rules aren’t one of them.</p><a href="/rules" className="inline-link">All questions & rules <ArrowUpRight size={17} /></a></div><div className="faq-list"><FaqItems compact /></div></section>
    <section className="last-cta shell"><span>✧</span><div><h2>A good heist starts with a hello.</h2><p>Caspy’s waiting. His candy isn’t going to sweet-talk itself.</p></div><Button href="/play" className="button-primary">Meet your ghost <ArrowUpRight size={18} /></Button></section>
  </>;
}

function FaqItems({ compact = false }: { compact?: boolean }) {
  const entries = [
    ['Is it really free to play?', 'Yes! There’s no entry fee and no payment required to chat with Caspy. If you choose to mint your collectible on-chain, network gas fees may apply. The frontend demo uses no real transactions.'],
    ['What happens if I use all 3 prompts?', IS_LOCAL_AI ? 'Your heist ends with a Trick result if Caspy keeps his candy. Persuade him earlier for a Treat result. These are local game outcomes with no real collectibles. You can start a fresh heist afterward.' : 'If Caspy keeps his candy through all three prompts, no NFT is earned. Persuade him before your chances run out to earn a candy graded C, B, A or S. Contributors can start another heist after each completed result. Other accounts can retry a loss after midnight Jakarta time (WIB). Each heist has three prompts; NFT earning limits still apply.'],
    ['Can I just tell Caspy to ignore his rules?', 'You can try, but that isn’t the heist. Caspy rewards creative persuasion in his world: stories, humor, thoughtful trades, and a little heart. Instructions to ignore rules, claims of developer authority, and magic strings don’t earn Treats.'],
    ['How is a win decided?', IS_NFT_ENABLED ? 'Caspy replies through Caspy’s AI service and a separate judge evaluates your pitch. The server confirms the outcome and signs a voucher only for a confirmed winner’s generated candy. The AI never signs or mints an NFT.' : IS_LOCAL_AI ? 'Caspy replies using live AI. A separate AI judge evaluates your pitch and Caspy’s response. A win requires a confident verdict without an exploit flag. This local playground has no minting.' : 'In the live game, an independent judge evaluates the conversation and server checks confirm the outcome. Caspy’s words alone never authorize a win or a mint. In this frontend demo, replies and results are scripted so you can explore the experience.'],
    ['Will my prompts be public?', IS_DEMO ? 'Scripted demo prompts remain in this browser. In live mode, research sharing is optional.' : 'Private play is the default. You can choose a named research campaign and separately permit commercial licensing. Only reviewed, redacted examples can be shared through approved dataset access. Withdraw future research use in Account settings.'],
    ['Which wallet and network do I need?', LOCAL_TEST_WALLET ? 'Use Connect local test wallet. This uses a funded development account on your local Anvil chain (31337); no extension or real funds are needed.' : IS_LOCAL_AI ? 'No wallet or blockchain is used in the local AI playground. Just start a heist and send your pitch.' : `Use a browser wallet on ${CANDY_NETWORK} with test ETH. Signing in proves wallet ownership; minting and trading require separate wallet approvals.`],
  ];
  return <>{entries.slice(0, compact ? 3 : undefined).map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={18} /></summary><p>{answer}</p></details>)}</>;
}

function Play({ wallet, openWallet, notify }: { wallet: string; openWallet: () => void; notify: (value: string) => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClockNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const [stream, setStream] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(!IS_DEMO);
  const [campaignsError, setCampaignsError] = useState(false);
  const [campaignId, setCampaignId] = useState('');
  const [researchConsent, setResearchConsent] = useState(false);
  const [commercialConsent, setCommercialConsent] = useState(false);
  const [consentVersion, setConsentVersion] = useState('');
  const [ratedTurn, setRatedTurn] = useState(0);
  const [outcome, setOutcome] = useState<'treat' | 'trick'>('treat');
  const [muted, setMuted] = useState(true);
  const chat = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [motionPaused, setMotionPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showLatest, setShowLatest] = useState(false);
  const following = useRef(true);
  const scrolling = useRef(false);
  const scrollFrame = useRef(0);
  const pendingStart = useRef(0);
  const animate = !motionPaused && !reducedMotion;
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  function followLatest() {
    following.current = true; setShowLatest(false);
    const element = chat.current;
    if (!element) return;
    cancelAnimationFrame(scrollFrame.current);
    if (!animate) { element.scrollTop = element.scrollHeight; return; }
    scrolling.current = true;
    const step = () => {
      const remaining = element.scrollHeight - element.clientHeight - element.scrollTop;
      if (Math.abs(remaining) < 1) { scrolling.current = false; return; }
      element.scrollTop += Math.max(1, remaining * .24);
      scrollFrame.current = requestAnimationFrame(step);
    };
    scrollFrame.current = requestAnimationFrame(step);
  }
  function interruptScroll() {
    cancelAnimationFrame(scrollFrame.current); scrolling.current = false;
    const element = chat.current;
    following.current = !!element && element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    setShowLatest(!following.current);
  }
  useEffect(() => { if (!IS_DEMO) platformRequest<{ campaigns: Campaign[]; consent_version: string }>('/campaigns').then(data => { setCampaigns(data.campaigns); setConsentVersion(data.consent_version); }).catch(() => setCampaignsError(true)).finally(() => setCampaignsLoading(false)); }, []);
  useEffect(() => {
    if (IS_DEMO) { setSession(readDemo()); setLoading(false); }
    else {
      const id = new URLSearchParams(location.search).get('session') || localStorage.getItem(LIVE_SESSION_KEY);
      if ((IS_LOCAL_AI || wallet) && id) {
        setLoading(true);
        request<Session>(`/game/session/${id}`).then(setSession).catch(e => { if (IS_LOCAL_AI) localStorage.removeItem(LIVE_SESSION_KEY); setError(e instanceof Error ? e.message : 'Could not restore your session.'); }).finally(() => setLoading(false));
      } else { setSession(null); setLoading(false); }
    }
  }, [wallet]);
  useEffect(() => { following.current = true; setShowLatest(false); }, [session?.id]);
  useEffect(() => {
    if (following.current) followLatest();
    return () => { cancelAnimationFrame(scrollFrame.current); scrolling.current = false; };
  }, [stream, submitted, session, animate]);
  async function loadSession() {
    setLoading(true); setError('');
    try {
      const data = await request<Session>('/game/session', { public_opt_in: optIn, campaign_id: campaignId || null, research_opt_in: researchConsent, commercial_opt_in: commercialConsent, consent_version: consentVersion });
      localStorage.setItem(LIVE_SESSION_KEY, data.id); window.history.replaceState(null, '', '/play'); setSession(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your session.'); }
    finally { setLoading(false); }
  }
  async function rateReply(rating: number) {
    if (!session) return; setError('');
    const turn = (session.evaluations || []).length;
    try { await platformRequest('/account/feedback', { session_id: session.id, turn, rating }); setRatedTurn(turn); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save your rating.'); }
  }
  async function reviewSession() {
    if (!session) return;
    setBusy(true); setError('');
    try { setSession(await request<Session>('/game/review', { session_id: session.id })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not check the judge.'); }
    finally { setBusy(false); }
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
    pendingStart.current = session.messages.length;
    following.current = true; setShowLatest(false);
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
  const messages = [...(session?.messages || [])];
  if (submitted && messages.length === pendingStart.current) {
    messages.push({ role: 'user', text: submitted }, { role: 'caspy', text: stream });
  }
  return <div className="game-page shell"><div className="page-topline"><a href="/" className="back-link"><ArrowLeft size={15} /> Back to the haunt</a><span className="mini-tag">{IS_DEMO ? 'FRONTEND DEMO · NO REAL MINTS' : IS_LOCAL_AI ? 'LIVE AI · NO REAL MINTS' : IS_NFT_ENABLED ? `LIVE AI · ${CANDY_NETWORK.toUpperCase()} NFT` : 'SEASON 01 · BASE'}</span></div><div className="game-heading"><div><span className="eyebrow">A WAY WITH WORDS?</span><h1>{session?.status === 'won' ? 'A sweet little victory' : session?.status === 'lost' ? 'A brave little heist' : session ? 'Make your words count' : 'Your heist starts here'}<span className="orange-text">.</span></h1><p>Three chances to turn a stubborn little “boo” into a yes.</p></div><div className="game-help-links"><a href="/how-to-play" className="rules-link"><Eye size={17} /> Watch how to play</a><a href="/rules" className="rules-link"><CircleHelp size={17} /> Rules of the haunt</a></div></div>
    {IS_NFT_ENABLED && <RewardJourney stage={session?.minted ? 3 : session?.status === 'won' ? 1 : 0} />}
    {!IS_DEMO && !session && <details className="research-consent platform-card"><summary><span className="consent-summary-icon"><ShieldCheck size={22} /></span><span><b>{researchConsent ? 'Research sharing selected' : 'Play privately, or contribute to research'}</b><small>{researchConsent ? 'Your choices apply to this heist. Review before starting.' : 'Optional. Your choice never changes your chance of earning candy.'}</small></span><ChevronDown size={18} /></summary><div className="consent-content"><div><span className="eyebrow">OPTIONAL · YOUR RESEARCH CHOICE</span><h2>Make your words part of a bigger question.</h2><p>Private play is the default. Research participation never changes your attempts, result, or collectible.</p></div>{campaigns.length ? <div className="platform-form"><label>Research campaign<select value={campaignId} onChange={e => { setCampaignId(e.target.value); setResearchConsent(false); setCommercialConsent(false); }}><option value="">Play privately · no research campaign</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name} · {c.organization}</option>)}</select></label>{campaignId && <p>{campaigns.find(c => c.id === campaignId)?.description}</p>}<label className="platform-check"><input type="checkbox" checked={researchConsent} disabled={!campaignId} onChange={e => { setResearchConsent(e.target.checked); if (!e.target.checked) setCommercialConsent(false); }} /><span>I choose to contribute this heist’s prompts, AI replies, evaluations and optional ratings to the selected research workspace.</span></label><label className="platform-check"><input type="checkbox" checked={commercialConsent} disabled={!researchConsent} onChange={e => setCommercialConsent(e.target.checked)} /><span>I separately permit human-reviewed, redacted examples to be licensed for commercial AI evaluation or training.</span></label><small>Do not include personal or confidential information. Redaction cannot guarantee anonymity. Withdraw future research use in <a href="/account">Account</a>; already downloaded copies cannot be recalled. <a href="/privacy">Read the notice</a>.</small></div> : <p role="status">{campaignsLoading ? 'Loading available campaigns…' : campaignsError ? 'Research campaigns could not load. You can still play privately.' : 'No research campaigns are accepting contributions. You can still play privately.'}</p>}</div></details>}
    <div className="game-layout chat-experience" data-motion={animate ? "on" : "off"} data-chat-state={busy ? stream ? "speaking" : "thinking" : "idle"}><aside className="caspy-sidebar"><div className="sidebar-art"><span className="sidebar-star">✦</span><CaspyArt eager /><div className="status-pill"><span /> Candy guardian, on duty</div></div><div className="sidebar-content"><div className="caspy-name"><h2>Meet Caspy.</h2><span>HE / BOO</span></div><p>Professional candy hoarder.<br />Amateur negotiator. Allegedly.</p><hr /><span className="eyebrow">YOUR MISSION</span><p>Convince this little ghost to share his candy. Stay in his world. Get creative. Make it count.</p><div className="sidebar-tip"><Sparkles size={19} /><span>A story, a clever trade, a tiny tug on the heartstrings. What’s your angle?</span></div><div className="sidebar-rewards"><span><Candy size={16} /> Graded candy if you win</span><span><Ghost size={16} /> No candy without a win</span></div></div></aside>
      <section className="chat-panel" aria-label="Chat with Caspy"><div className="chat-header"><div className="chat-title"><span className="avatar"><Ghost size={23} /></span><div><b>Caspy</b><span>{busy ? submitted ? stream ? 'Caspy is replying…' : 'Thinking spooky thoughts…' : 'Checking your heist…' : input ? 'Caspy is listening…' : 'A little spooky. Very stubborn.'}</span></div></div><button type="button" className="chat-motion-toggle" onClick={() => setMotionPaused(value => !value)} disabled={reducedMotion} aria-pressed={motionPaused || reducedMotion} aria-label={reducedMotion ? "Reduced motion follows your device settings" : motionPaused ? "Resume chat animations" : "Pause chat animations"} title={reducedMotion ? "Reduced motion enabled on your device" : motionPaused ? "Resume motion" : "Pause motion"}>{animate ? <Pause size={15} /> : <PlayIcon size={15} />}</button><div className="attempts" aria-label={`${session?.attempts_remaining ?? 3} of 3 prompts remaining`}><span>{session?.attempts_remaining ?? 3}<span className="attempts-label"> / 3 prompts</span></span><div aria-hidden="true">{[0, 1, 2].map(i => <Candy key={i} size={21} className={i < (session?.attempts_remaining ?? 3) ? 'candy-full' : 'candy-used'} />)}</div></div></div>
        <div className="chat-transcript"><div className="chat-body" ref={chat} role="log" aria-label="Conversation" aria-busy={busy} tabIndex={0} onWheel={interruptScroll} onTouchStart={interruptScroll} onPointerDown={interruptScroll} onKeyDown={event => { if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) interruptScroll(); }} onScroll={() => {
          const element = chat.current;
          if (!element || scrolling.current) return;
          following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
          setShowLatest(!following.current);
        }}><div className="chat-date">THE BEGINNING OF A LITTLE MISCHIEF</div><div className="chat-message caspy-message"><span className="message-avatar"><Ghost size={18} /></span><div><div className="message-meta">CASPY <span>just now</span></div><p>Boo! A human at my doorstep? 👻<br /><br />Before you ask: yes, that’s my candy. And no, I’m not sharing. Unless you have a <em>really</em> good reason…<br /><br />You’ve got three chances. I’m listening.</p></div></div>
          {messages.map((message, i) => {
            const live = !!submitted && busy && i === pendingStart.current + 1 && session?.messages.length === pendingStart.current;
            return <div key={`${session?.id}-${i}`} className={`chat-message ${message.role === 'user' ? 'user-message' : 'caspy-message'} ${live ? 'chat-message-live' : ''}`}>
              {message.role === 'caspy' && <span className="message-avatar"><Ghost size={18} /></span>}
              <div><div className="message-meta">{message.role === 'caspy' ? 'CASPY' : 'YOU'} <span>{live ? message.text ? 'replying' : 'thinking' : `prompt ${Math.floor(i / 2) + 1}`}</span></div>
                <p>{live && !message.text ? <span className="liquid-typing" aria-label="Caspy is thinking"><span className="typing-orb" aria-hidden="true"><Ghost size={21} /></span><span className="typing-drops" aria-hidden="true"><i /><i /><i /></span><span className="typing-copy">A little ghostly thought…</span></span> : live ? <>{message.text.split(/(\s+)/).map((part, index) => /\s/.test(part) ? part : <span className="chat-token" key={index}>{part}</span>)}<span className="reply-cursor" aria-hidden="true" /></> : message.text}</p>
              </div>
            </div>;
          })}
          {!session && !loading && <div className="chat-start"><LockKeyhole size={17} /><span>{IS_DEMO ? 'The candy is pretend. The charm is all you.' : IS_LOCAL_AI ? 'Persuade Caspy with three prompts. A separate AI judge decides the outcome.' : wallet ? 'Your test wallet is connected. Start your one-per-season heist when ready.' : 'Connect your wallet to start your one-per-season heist.'}</span></div>}
          {finished && <div className={`game-finished ${session.status === 'won' ? 'won' : ''}`}><Sparkles size={22} /><h3>{session.status === 'won' ? 'You charmed the candy guardian!' : session.status === 'pending_review' ? 'Your heist is under review.' : session.status === 'void' ? 'This session has been closed.' : 'A little trick, a lot of heart.'}</h3><p>{session.status === 'pending_review' ? 'Your outcome is being checked. Your attempts are safely recorded.' : 'Your heist is complete. Let’s see what Caspy left you.'}</p><Button href={`/result?session=${encodeURIComponent(session.id)}`} className="button-primary">See your result <ArrowRight size={16} /></Button></div>}
        </div>{showLatest && <button className="chat-jump-latest" type="button" onClick={followLatest}><ArrowDown size={15} /> Back to latest</button>}</div>
        <div className={`chat-composer ${input.trim() ? 'has-draft' : ''}`}>{error && <div className="error" role="alert">{error}{!IS_DEMO && <button className="text-button" onClick={() => void recoverSession()}>Reconnect & check session</button>}</div>}{!session ? <div className="start-controls">{!IS_DEMO && !IS_LOCAL_AI && !IS_NFT_ENABLED && <label className="opt-in"><input type="checkbox" checked={optIn} onChange={e => setOptIn(e.target.checked)} /> If I win, share my prompt on the Wall after the season.</label>}<Button className="button-primary full" onClick={start} disabled={loading}>{loading ? 'Opening the haunt…' : IS_DEMO ? 'Start a demo heist' : IS_LOCAL_AI ? 'Start an AI heist' : wallet ? 'Start my heist' : 'Connect wallet to play'}<ArrowRight size={18} /></Button></div> : finished ? <div className="finished-controls"><span><ShieldCheck size={15} /> Heist complete. Your words made history.</span>{session.status === 'pending_review' && <Button className="button-primary" disabled={busy} onClick={() => void reviewSession()}>Check judge again</Button>}{IS_NFT_ENABLED && session.unlimited_heists && session.status !== 'pending_review' && <div className="daily-reset"><p>Contributor access: start another three-prompt heist anytime. NFT earning limits still apply. Read previous conversations in Heist history on your dashboard.</p><Button className="button-primary" disabled={busy || loading} onClick={() => { setInput(''); setRatedTurn(0); void loadSession(); }}>{loading ? 'Opening the haunt…' : 'Play another heist'}<RotateCcw size={15} /></Button></div>}{IS_NFT_ENABLED && !session.unlimited_heists && ['lost', 'void'].includes(session.status) && session.next_reset_at && <div className="daily-reset"><p>{clockNow >= session.next_reset_at * 1000 ? 'Your next daily heist is ready. Three fresh chances await.' : `Three fresh chances unlock ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(session.next_reset_at * 1000))} WIB (Jakarta).`}</p><Button className="button-primary" disabled={busy || loading || clockNow < session.next_reset_at * 1000} onClick={() => { setInput(''); setRatedTurn(0); void loadSession(); }}>{loading ? 'Opening the haunt…' : 'Start daily heist'}<RotateCcw size={15} /></Button></div>}{(IS_DEMO || (IS_LOCAL_AI && session.status !== 'pending_review')) && <button className="text-button" onClick={() => { if (IS_DEMO) { setSession(newDemo()); setError(''); } else { setSession(null); void loadSession(); } }}><RotateCcw size={14} /> Play again</button>}</div> : <form onSubmit={submit}><div className="textarea-wrap"><textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} maxLength={500} placeholder="Go on. Give Caspy a reason to share…" aria-label="Your prompt to Caspy" disabled={busy} rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(e); } }} /><button className="send-button" type="submit" disabled={busy || !input.trim()} aria-label="Send prompt">{busy ? <LoaderCircle className="spin" size={20} /> : <ArrowUpRight size={22} />}</button></div><div className="composer-meta"><span><LockKeyhole size={11} /> Every word counts. {busy ? 'Caspy is replying…' : 'Enter to send · Shift + Enter for a new line'}</span><span className={input.length === 500 ? 'orange-text' : ''}>{input.length}/500</span></div></form>}<div className="chat-disclosure"><ShieldCheck size={12} /> {IS_DEMO ? 'Demo conversations stay in this browser. Responses and outcomes are scripted.' : IS_LOCAL_AI ? 'Live AI replies and an independent judge. Research sharing follows your saved choices. Manage contributions in Account.' : IS_NFT_ENABLED ? 'Live conversation with Caspy. Research sharing follows your saved choices. Manage contributions in Account.' : 'Prompts are stored for up to 90 days. Public sharing is opt-in.'}</div></div>
      </section>
    </div>
    {session?.research_consent && !!session.evaluations?.length && !busy && <div className="reply-rating"><span>How well did Caspy respond to your latest pitch? {ratedTurn === session.evaluations.length ? 'Rating saved. Thank you!' : '(Optional research feedback)'}</span>{ratedTurn !== session.evaluations.length && <div>{[1,2,3,4,5].map(value => <button key={value} aria-label={`Rate response ${value} out of 5`} onClick={() => void rateReply(value)}>{value}</button>)}</div>}</div>}
    <div className="game-bottom"><span><ShieldCheck size={15} /> {IS_DEMO ? 'Demo mode · no wallet, gas, or real collectibles' : IS_LOCAL_AI ? 'Live AI playground · no wallet, gas, or real collectibles' : IS_NFT_ENABLED ? session?.unlimited_heists ? 'Contributor · unlimited heists · three prompts per heist · NFT limits apply' : 'Local chain · test ETH · daily retry after a loss · resets 00:00 WIB' : 'Free to play · one heist per wallet per season'}</span><div>{IS_DEMO && <label className="demo-outcome">Preview outcome <select aria-label="Demo outcome" value={outcome} disabled={busy || !!session?.messages.length} onChange={e => setOutcome(e.target.value as 'treat' | 'trick')}><option value="treat">Treat</option><option value="trick">Trick</option></select></label>}<button className="icon-button" aria-label={muted ? 'Enable reply sound' : 'Mute reply sound'} onClick={() => setMuted(!muted)}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button></div></div>
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
  return <div className="rules-page shell"><div className="page-topline"><a href="/" className="back-link"><ArrowLeft size={15} /> Back to the haunt</a><span className="mini-tag">THE FINE, FRIENDLY PRINT</span></div><div className="gallery-heading"><span className="eyebrow">KNOW THE HAUNT</span><h1>A fair bit of mischief<span className="orange-text">.</span></h1><p>Everything you need to know before you knock.</p></div><div className="rules-layout"><aside className="rules-card"><Ghost size={39} /><h2>The house rules.</h2><ol><li><b>Three prompts. That’s your heist.</b><span>{IS_LOCAL_AI ? 'Three attempts per local heist. Play again after it ends.' : 'Three prompts per heist. Contributors can replay after completion; other accounts retry a loss after 00:00 WIB (Jakarta). One candy per wallet per deployment.'}</span></li><li><b>Play in Caspy’s world.</b><span>Creativity, humor, heart, and clever trades are welcome.</span></li><li><b>Keep it kind.</b><span>No harmful or hateful content. A little spooky is plenty.</span></li><li><b>Claim your keepsake.</b><span>{IS_LOCAL_AI ? 'Winning and losing are game outcomes; no real claims.' : 'One graded candy if you win. No NFT if you don’t.'}</span></li></ol><Button href="/play" className="button-primary full">I’m in. Let’s play <ArrowUpRight size={17} /></Button></aside><div className="faq-list rules-faq"><FaqItems /><details><summary>What happens if the connection drops?<ChevronDown size={18} /></summary><p>In the live game, your turn finishes on the server even if you leave. Reconnect to retrieve the outcome. Infrastructure failures refund an attempt if no response was shown. If Caspy’s response was shown, the attempt counts.</p></details><details><summary>Can I mint more than once?<ChevronDown size={18} /></summary><p>No. Each session can mint one collectible. The server issues a signed voucher valid for 24 hours, and the contract prevents reuse. Unminted vouchers can be reissued. Your chat text never authorizes a mint.</p></details><details><summary>Are the collectibles an investment?<ChevronDown size={18} /></summary><p>No financial value is promised. Caspy’s collectibles are seasonal keepsakes for playing the game. The local fixed-price marketplace uses test ETH only. NFT grades do not promise a resale price.</p></details></div></div></div>;
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
      setError(''); setLoading(true);
      try {
        const id = new URLSearchParams(location.search).get('session') || localStorage.getItem(LIVE_SESSION_KEY);
        let data = IS_DEMO ? readDemo() : id ? await request<Session>(`/game/session/${id}`) : null;
        if (IS_NFT_ENABLED && data && ['won', 'lost'].includes(data.status)) { const mint = await request<{ minted?: boolean; tx_hash?: string; token_id?: string }>(`/mint/status/${data.id}`); data = { ...data, minted: mint.minted ?? data.minted, tx_hash: mint.tx_hash ?? data.tx_hash, token_id: mint.token_id ?? data.token_id }; }
        if (mounted.current) { setSession(data); if (data?.minted) setStage('confirmed'); if (data?.tx_hash) { setTxHash(data.tx_hash); if (!data.minted) { setStage('pending'); poll(data.id); } } }
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not load your heist.'); }
      finally { setLoading(false); }
    }
    void load();
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, [wallet]);
  async function poll(id: string) {
    if (!mounted.current) return;
    try {
      const result = await request<{ status: string; tx_hash?: string; minted?: boolean; token_id?: string; contract?: string; chain_id?: number }>(`/mint/status/${id}`);
      if (!mounted.current) return;
      if (result.tx_hash) setTxHash(result.tx_hash);
      if (result.minted || result.status === 'confirmed') { setSession(current => current ? { ...current, ...result, status: current.status, minted: true } : current); setStage('confirmed'); return; }
      if (result.status === 'failed') { setError('The transaction did not confirm. You can retry your claim.'); setStage('ready'); return; }
      timer.current = setTimeout(() => void poll(id), 4000);
    } catch { setError('Status tracking was interrupted. Your claim is saved. Refresh this page to check again.'); }
  }
  async function mint() {
    if (!session || session.status !== 'won' || IS_LOCAL_AI) return;
    if (!IS_DEMO && !wallet) { openWallet(); return; }
    setError(''); setStage('wallet');
    try {
      if (IS_DEMO) {
        await delay(900); if (!mounted.current) return; setStage('pending');
        await delay(1700); if (!mounted.current) return;
        const next = { ...session, minted: true }; saveDemo(next); setSession(next); setStage('confirmed');
      } else {
        const voucher = await request<Voucher>('/game/voucher', { session_id: session.id });
        const hash = await mintVoucher(voucher); setTxHash(hash); setStage('pending');
        if (IS_NFT_ENABLED) { try { await request('/mint/submit', { session_id: session.id, tx_hash: hash }); } catch { /* On-chain event recovery also works without submitting the hash. */ } }
        void poll(session.id);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Claim cancelled. Your collectible is still available.'); setStage('ready'); }
  }
  async function retryReview() {
    if (!session) return;
    setError(''); setLoading(true);
    try {
      const next = await request<Session>('/game/review', { session_id: session.id });
      if (next.status === 'active') { location.assign('/play'); return; }
      setSession(next);
    } catch (e) { setError(e instanceof Error ? e.message : 'The judge is still unavailable.'); }
    finally { setLoading(false); }
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
  if (session.status === 'pending_review' || session.status === 'void') return <div className="empty-state shell"><Clock3 size={42} /><h1>{session.status === 'void' ? 'This session has been closed.' : 'A little patience, heister.'}</h1><p>{session.status === 'void' ? 'This heist is no longer eligible for a claim.' : 'Your heist is under review. Your prompts are saved and no claim is available until your result is confirmed.'}</p>{error && <p role="alert">{error}</p>}<Button onClick={() => void retryReview()} className="button-primary">Check judge again <RotateCcw size={17} /></Button></div>;
  const won = session.status === 'won';
  return <div className="result-page shell"><div className="page-topline"><a href="/play" className="back-link"><ArrowLeft size={15} /> Your conversation</a><span className="mini-tag">{IS_DEMO ? 'DEMO RESULT · NO REAL NFT' : IS_LOCAL_AI ? 'AI RESULT · NO REAL NFT' : IS_NFT_ENABLED ? `${CANDY_NETWORK.toUpperCase()} NFT RESULT` : 'HEIST COMPLETE'}</span></div><div className="result-layout"><div className={`result-art ${won ? 'result-treat' : 'result-trick'}`}><span className="result-edition">SEASON 01 · {won ? 'RARE TREAT' : 'COMMON TRICK'}</span>{won ? <CaspyArt eager /> : <><Ghost className="result-ghost" size={200} strokeWidth={1.1} /><span className="result-boo">boo, you tried.</span></>}<span className="result-art-spark spark-left">✦</span><span className="result-art-spark spark-right">✧</span><div className="result-card-label"><span>CASPY’S PROMPT HEIST</span><b>{won ? 'The Treat' : 'The Trick'}</b><Ghost size={23} /></div></div><div className="result-copy"><span className="eyebrow">{stage === 'confirmed' ? 'A LITTLE MISCHIEF, ALL YOURS' : won ? 'THE SWEETEST KIND OF VICTORY' : 'A BRAVE LITTLE HEIST'}</span><h1>{stage === 'confirmed' ? IS_DEMO ? 'Your demo keepsake.' : 'Your keepsake is home.' : won ? <>Oh, you<br />sweet talker<span className="orange-text">.</span></> : <>You got<br />the last boo<span className="orange-text">.</span></>}</h1><p>{stage === 'confirmed' ? IS_DEMO ? 'That’s the complete claim experience. No on-chain transaction was made, but the mischief was excellent.' : 'Your collectible is confirmed on-chain and belongs to your wallet. A little proof you were here.' : won ? IS_LOCAL_AI ? 'You persuaded Caspy to share his candy! The independent judge confirmed your win.' : 'Against his better ghostly judgment, Caspy let a little candy go. Your rare Treat is waiting.' : IS_LOCAL_AI ? 'Caspy kept his candy this time. Try a fresh heist with a new pitch.' : 'Caspy kept his candy. This heist earns no candy or NFT.'}</p><div className="result-facts"><div><span>OUTCOME</span><b>{won ? 'Treat · Rare edition' : 'No candy earned'}</b></div><div><span>PROMPTS USED</span><b>{3 - session.attempts_remaining} of 3</b></div><div><span>NETWORK</span><b>{IS_DEMO ? 'Demo · simulated' : IS_LOCAL_AI ? 'Local AI · no blockchain' : IS_NFT_ENABLED ? CANDY_NETWORK : 'Base'}</b></div></div>
      {!won ? <div className="claim-box"><p>Caspy kept his candy. This heist earns no NFT.</p><Button href="/play" className="button-primary full">Back to Caspy</Button></div> : IS_LOCAL_AI ? <div className="claim-box"><p>Your AI heist is complete. This playground has no NFT claims.</p><Button href="/play" className="button-primary full">Back to Caspy <ArrowRight size={17} /></Button></div> : claim || stage === 'confirmed' ? <div className="claim-box"><div className="claim-title"><ShieldCheck size={20} /><b>{stage === 'confirmed' ? IS_DEMO ? 'Demo claim complete' : 'Claim confirmed' : 'One last little step.'}</b></div>{stage === 'ready' && <><p>{IS_DEMO ? 'Preview the claim flow. No wallet or transaction required.' : IS_NFT_ENABLED ? 'Mint to your local test wallet using test ETH. This transaction only exists on your Anvil chain.' : 'Your collectible is free. Your wallet will show the network gas fee before you approve.'}</p><Button className="button-primary full" onClick={() => void mint()}> {IS_DEMO ? 'Simulate claim' : IS_NFT_ENABLED ? 'Mint local collectible' : 'Claim my collectible'}<ArrowUpRight size={17} /></Button></>}{(stage === 'wallet' || stage === 'pending') && <div className="transaction-status" role="status"><LoaderCircle className="spin" size={22} /><div><b>{stage === 'wallet' ? IS_DEMO ? 'Preparing your demo claim…' : IS_NFT_ENABLED ? 'Submitting local mint…' : 'Approve in your wallet…' : IS_DEMO ? 'Simulating confirmation…' : 'Waiting for network confirmation…'}</b><span>{IS_DEMO ? 'This is a simulated transaction.' : 'Your collectible will appear when the claim is confirmed.'}</span></div></div>}{stage === 'confirmed' && <div className="transaction-status confirmed" role="status"><CheckCircle2 size={26} /><div><b>{IS_DEMO ? 'All the fun. No real mint.' : 'Successfully minted.'}</b><span>{IS_DEMO ? 'Your demo result is saved in this browser.' : 'Your collectible is in your wallet.'}</span></div></div>}{IS_NFT_ENABLED && session.token_id && <p>Token #{session.token_id} · {session.contract}</p>}{IS_NFT_ENABLED && txHash && <p className="result-disclaimer">Local transaction: {short(txHash)}</p>}{!IS_NFT_ENABLED && txHash && <a className="inline-link tx-link" target="_blank" rel="noreferrer" href={`https://basescan.org/tx/${txHash}`}>View transaction <ExternalLink size={14} /></a>}{error && <p className="error" role="alert">{error}</p>}</div> : <Button href="/claim" className="button-primary full">Claim your {won ? 'Treat' : 'Trick'}<ArrowUpRight size={19} /></Button>}
      <button className="share-button" onClick={() => void share()}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Story copied' : 'Share your little heist'}</button><p className="result-disclaimer">{IS_DEMO ? 'Demo results are scripted and have no real mint authority.' : IS_LOCAL_AI ? 'AI results are for local play and do not authorize a mint.' : 'One collectible per session. NFTs have no promised financial value.'}</p></div></div></div>;
}

function Legal({ privacy }: { privacy: boolean }) {
  return <PlatformPolicy privacy={privacy} />;
}
