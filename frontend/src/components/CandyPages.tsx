import { useEffect, useMemo, useRef, useState } from 'react';
import { Candy, Ghost, LoaderCircle, ArrowUpRight, ArrowRight, ShieldCheck, Search, RotateCw, CheckCircle2 } from 'lucide-react';
import { formatEther, parseEther } from 'viem';
import { IS_NFT_ENABLED, LIVE_SESSION_KEY, request, type Session } from '../lib/game';
import { mintVoucher, tradeCandy, PROMPT_LICENSE, type Voucher } from '../lib/wallet';
import PriceHistory from './PriceHistory';
import { RewardJourney } from './RewardJourney';

export type Assessment = { grade: number; grade_label: string; score: number; components: Record<string, number>; comparison_count: number; closest_similarity: number; rule_version: string };
export type EarnedCandy = { session_id: string; state: string; assessment: Assessment; image_url: string | null; error: string | null; minted: boolean; token_id: string | null; attempts: number; generator_model: string; generation_local: boolean };
type Token = { generator?: { model: string; provider?: string }; token_id: string; owner: string; creator: string; grade: number; score: number; name: string; image_url: string | null; assessment: Assessment; prompt_license: string; contract: `0x${string}`; market: `0x${string}`; price_wei?: string; listing_id?: string; seller?: string; listing?: { listing_id: string; seller: string; price_wei: string } | null };
type Config = { enabled: boolean; configured: boolean; max_supply: number; remaining: number; contract?: `0x${string}`; market?: `0x${string}` };
const message = (error: unknown) => error instanceof Error ? error.message : 'The operation could not finish. Reload to check your saved state.';
function Notice({ error }: { error: string }) { return error ? <p className="error" role="alert">{error}</p> : null; }
function Score({ assessment: a }: { assessment: Assessment }) {
  return <div className="candy-score"><div className="candy-grade"><span>GRADE</span><b>{a.grade_label}</b><span>{a.score} / 100</span></div><div><h3>Earned by your words.</h3><div className="candy-bars">{Object.entries(a.components).map(([name, value]) => <label key={name}><span>{name}<b>{value} / {name === 'novelty' ? 40 : 20}</b></span><meter min="0" max={name === 'novelty' ? 40 : 20} value={value} /></label>)}</div><small>Novelty compares {a.comparison_count} earlier winning prompts in this season. This is a model assessment and text-similarity score, not proof of worldwide originality.</small></div></div>;
}
export function CandyResult({ wallet, openWallet }: { wallet: string; openWallet: () => void }) {
  const [syncError, setSyncError] = useState('');
  const [game, setGame] = useState<(Session & { candy?: EarnedCandy; candy_error?: string }) | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [accept, setAccept] = useState(false); const [retry, setRetry] = useState(false);
  async function load() {
    const id = localStorage.getItem(LIVE_SESSION_KEY);
    if (!id) { setGame(null); return; }
    const next = await request<Session & { candy?: EarnedCandy; candy_error?: string }>(`/game/session/${id}`);
    if (next.status === 'won' && next.candy?.state === 'ready') {
      const status = await request<{ status: string; minted: boolean; token_id?: string; tx_hash?: string }>(`/mint/status/${id}`);
      next.minted = status.minted; next.token_id = status.token_id;
      if (status.status === 'failed') { setBusy(''); setError('The mint reverted. Your saved image is unchanged; you can retry minting.'); }
      if (status.status === 'pending' && status.tx_hash) setBusy('Waiting for mint confirmation…');
    }
    setGame(next);
  }
  useEffect(() => { let active = true; load().catch(e => active && setError(message(e))).finally(() => active && setLoading(false)); return () => { active = false; }; }, [wallet]);
  useEffect(() => {
    if (game?.candy?.state !== 'generating' && busy !== 'Waiting for mint confirmation…') return;
    const timer = setInterval(() => { load().then(() => setSyncError('')).catch(() => setSyncError('Status updates are paused. Your artwork may still be running; refresh to check before retrying.')); }, 5000);
    return () => clearInterval(timer);
  }, [game?.candy?.state, busy, wallet]);
  useEffect(() => { if (game?.minted) setBusy(''); }, [game?.minted]);
  async function generate() {
    if (!game) return; setBusy('Requesting your artwork…'); setError('');
    try { await request('/candy/generate', { session_id: game.id, accept_provider: accept, retry }); await load(); }
    catch (e) { setError(message(e)); } finally { setBusy(''); }
  }
  async function mint() {
    if (!wallet) { openWallet(); return; } if (!game) return;
    setBusy('Submitting your mint…'); setError('');
    try {
      const voucher = await request<Voucher>('/game/voucher', { session_id: game.id });
      const hash = await mintVoucher(voucher);
      setBusy('Waiting for mint confirmation…');
      try { await request('/mint/submit', { session_id: game.id, tx_hash: hash }); }
      catch { setError('The transaction was sent. Checking the chain for confirmation; refresh this page if tracking is interrupted.'); }
      await load();
    } catch (e) { setError(message(e)); setBusy(''); }
  }
  async function review() { if (!game) return; setBusy('Reviewing…'); try { await request('/game/review', { session_id: game.id }); await load(); } catch (e) { setError(message(e)); } finally { setBusy(''); } }
  if (loading) return <div className="empty-state shell"><LoaderCircle className="spin" /><h1>Finding your heist…</h1></div>;
  if (!game) return <div className="empty-state shell"><Ghost size={48} /><h1>Your story starts with Caspy.</h1><Notice error={error} /><a className="button button-primary" href="/play">Open the heist</a>{!wallet && <button className="button button-light" onClick={openWallet}>Connect your wallet</button>}</div>;
  if (game.status !== 'won') return <div className="empty-state shell"><Ghost size={60} /><span className="eyebrow">{game.status === 'lost' ? 'THE CANDY STAYS WITH CASPY' : 'YOUR HEIST'}</span><h1>{game.status === 'lost' ? 'A brave little boo.' : game.status === 'pending_review' ? 'Your words are under review.' : 'Your story is still unfolding.'}</h1><p>{game.status === 'lost' ? 'The independent judge did not confirm an eligible win. No candy, image request, or NFT is awarded for this heist.' : 'Only an independently confirmed win can earn a candy. Your saved conversation is available in the heist.'}</p><a className="button button-primary" href="/play">Back to your conversation</a>{game.status === 'pending_review' && <button disabled={!!busy} className="button button-light" onClick={review}>Check judge again</button>}<Notice error={error} /></div>;
  const candy = game.candy;
  const local = candy?.generation_local === true;
  return <div className="candy-page shell"><span className="eyebrow">THE SPOILS OF YOUR WORDS · LOCAL CHAIN</span><h1>A candy only your<br />story could inspire<span className="orange-text">.</span></h1><RewardJourney stage={game.minted ? 3 : game.candy?.state === 'ready' ? 2 : 1} /><p className="candy-lead">You persuaded Caspy. Your winning prompt shapes one candy character in Caspy’s illustrated Halloween style. Your grade is saved before the image is generated.</p><Notice error={error || game.candy_error || syncError} />{candy && <div className="candy-result-grid"><div className="candy-art">{candy.image_url ? <img src={candy.image_url} alt={`Your AI-generated grade ${candy.assessment.grade_label} candy`} /> : <><Candy size={90} strokeWidth={1} /><b>{candy.state === 'generating' ? 'Conjuring your candy…' : 'An earned candy, waiting to take shape.'}</b><span>{candy.state === 'generating' ? 'Your artwork request is running. You can return to this page later.' : 'No preview is generated until you choose to send your prompt.'}</span></>}</div><div><Score assessment={candy.assessment} /><div className="claim-box"><h3>{game.minted ? 'Your candy is on-chain.' : candy.state === 'ready' ? 'One final step. Make it yours.' : 'From your words to sugar.'}</h3>{game.minted ? <><p>Token #{game.token_id}. Artwork, prompt hash, grade and metadata are committed to your NFT.</p><a className="button button-primary" href="/collection">Open your collection <ArrowUpRight size={17} /></a></> : candy.state === 'ready' ? <><p>Mint this exact artwork on local Anvil using test ETH. One candy per wallet and heist. No rerolls.</p><button className="button button-primary" onClick={mint} disabled={!!busy}>Mint my candy</button></> : candy.state === 'needs_configuration' ? <p role="status">{local ? 'Your grade is saved. Prepare local FLUX.1-schnell with bash scripts/shell/setup-flux.sh and restart Caspy. No inference credits are needed.' : 'Your grade is saved. Hosted generation needs HF_TOKEN with Inference Providers permission and provider credits.'}</p> : candy.state === 'generating' ? <p role="status"><LoaderCircle className="spin" size={18} /> FLUX is creating your image. Your grade is saved. You can leave this page and return when it is ready.</p> : <><p>{local ? 'FLUX.1-schnell creates this artwork offline on the Mac running Caspy. No paid image API is called. Generation may take several minutes on an 8 GB Mac.' : 'The redacted winning prompt is sent to Hugging Face’s fal-ai provider. Hosted generation uses provider credits.'} The image seed never changes your grade.</p><label className="candy-consent"><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} /> {local ? 'I agree to generate candy from my redacted winning prompt locally. I have rights to use this text.' : 'I agree to send my redacted winning prompt for hosted image generation. I have rights to use this text.'}</label>{['failed', 'uncertain'].includes(candy.state) && <><Notice error={candy.error || ''} /><label className="candy-consent"><input type="checkbox" checked={retry} onChange={e => setRetry(e.target.checked)} /> {local ? 'Retry this failed local request using the same prompt, seed and saved grade. No provider credits are used.' : 'Retry this failed request; another provider charge may apply.'} Maximum three requests per candy.</label></>}<button className="button button-primary" onClick={generate} disabled={!!busy || !accept || (['failed', 'uncertain'].includes(candy.state) && !retry)}>{candy.attempts ? 'Retry image request' : 'Generate my earned candy'}</button></>}{busy && <p role="status">{busy}</p>}</div></div></div>}<p className="candy-footnote"><ShieldCheck size={17} /> Finite collection: 1,000 candies. C: 0–59 · B: 60–74 · A: 75–89 · S: 90–100. Grades are not random rarity odds. Research sharing is a separate choice.</p></div>;
}
const tokenPrice = (token: Token) => BigInt(token.price_wei || token.listing?.price_wei || '0');

export function CandyMarket({ collection, wallet, openWallet }: { collection: boolean; wallet: string; openWallet: () => void }) {
  const loadSequence = useRef(0);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [proceeds, setProceeds] = useState('0');
  const [historyRevision, setHistoryRevision] = useState(0);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false);
  const [price, setPrice] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState(''), [grade, setGrade] = useState('all'), [sort, setSort] = useState('newest');
  async function load() {
    const sequence = ++loadSequence.current;
    const cfg = await request<Config>('/candy/config');
    if (!cfg.enabled || (collection && !wallet)) {
      if (sequence === loadSequence.current) { setConfig(cfg); setTokens([]); setProceeds('0'); }
      return;
    }
    const [result, balance] = await Promise.all([
      request<{ tokens?: Token[]; listings?: Token[] }>(collection ? '/candy/collection' : '/market/listings'),
      wallet ? request<{ proceeds_wei: string }>('/market/account') : Promise.resolve({ proceeds_wei: '0' }),
    ]);
    if (sequence !== loadSequence.current) return;
    setConfig(cfg); setTokens(result.tokens || result.listings || []); setProceeds(balance.proceeds_wei);
  }
  useEffect(() => {
    let active = true; setLoading(true); setTokens([]); setPrompts({}); setProceeds('0');
    load().catch(e => active && setError(message(e))).finally(() => active && setLoading(false));
    const sync = () => { if (document.visibilityState === 'visible') void load().catch(e => active && setError(message(e))); };
    window.addEventListener('focus', sync); document.addEventListener('visibilitychange', sync);
    return () => { active = false; loadSequence.current += 1; window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync); };
  }, [wallet, collection]);
  async function refresh() {
    setRefreshing(true); setError('');
    try { await load(); setHistoryRevision(value => value + 1); }
    catch (e) { setError(message(e)); } finally { setRefreshing(false); }
  }
  async function reveal(token: Token) {
    if (prompts[token.token_id]) { setPrompts(previous => { const next = { ...previous }; delete next[token.token_id]; return next; }); return; }
    try { const result = await request<{ prompt: string }>(`/candy/prompt/${token.token_id}`); setPrompts(previous => ({ ...previous, [token.token_id]: result.prompt })); }
    catch (e) { setError(message(e)); }
  }
  async function action(name: 'list' | 'buy' | 'cancel' | 'withdraw', token?: Token) {
    if (!wallet) { openWallet(); return; }
    setError(''); setNotice(''); setBusy(`${name}:${token?.token_id || 'proceeds'}`);
    let confirmed = false;
    try {
      const contract = token?.contract || config?.contract, market = token?.market || config?.market;
      if (!contract || !market) throw new Error('Marketplace details are unavailable. Refresh before continuing.');
      if (name === 'list' && token && !consent[token.token_id]) throw new Error('Review and accept the source-prompt license before listing.');
      await tradeCandy(name, wallet, contract, market, token?.token_id || '0', token?.listing?.listing_id || token?.listing_id || '0', name === 'list' && token ? String(parseEther(price[token.token_id] || '0')) : token ? String(tokenPrice(token)) : '0', !!token?.prompt_license);
      confirmed = true; setPrompts({});
      setNotice({ list: 'Listing confirmed. Your candy is now available in the marketplace.', buy: 'Purchase confirmed. Your candy and source prompt are in your collection.', cancel: 'Listing cancelled. Your candy has returned to your collection.', withdraw: 'Withdrawal confirmed. Your proceeds have been sent to your connected test wallet.' }[name]);
      await load(); setHistoryRevision(value => value + 1);
    } catch (e) { setError(confirmed ? 'Your transaction confirmed, but the page could not refresh. Use Refresh to check the latest balance and ownership.' : message(e)); }
    finally { setBusy(''); }
  }
  const visible = useMemo(() => tokens.filter(token => (grade === 'all' || String(token.grade) === grade) && `${token.name} ${token.token_id}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => {
    if (sort === 'newest') return Number(b.token_id) - Number(a.token_id);
    const first = tokenPrice(a), second = tokenPrice(b);
    return (first < second ? -1 : first > second ? 1 : 0) * (sort === 'low' ? 1 : -1);
  }), [tokens, query, grade, sort]);
  const filtered = !!query || grade !== 'all';
  return <div className="candy-page shell">
    <div className="page-topline"><span className="mini-tag"><span className="network-dot" /> Local test network · Test ETH only</span><a href={collection ? '/marketplace' : '/collection'} className="inline-link">{collection ? 'Browse marketplace' : 'Your collection'} <ArrowUpRight size={16} /></a></div>
    <div className="market-heading"><div><span className="eyebrow">{collection ? 'EARNED THROUGH IMAGINATION' : 'THE MIDNIGHT MARKET'}</span><h1>{collection ? 'Your candy cabinet' : 'A little candy. A lot of character'}<span className="orange-text">.</span></h1><p className="candy-lead">{collection ? 'Your earned and collected candies, with the stories that made them.' : 'Discover prompt-inspired candy. Each one carries an earned grade and a story that unlocks for its owner.'}</p></div><button className="button button-light refresh-control" onClick={() => void refresh()} disabled={refreshing || loading || !!busy}><RotateCw size={16} className={refreshing ? 'spin' : ''} />{refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
    {config?.enabled && <div className="market-overview"><span><b>{loading ? '—' : tokens.length}</b>{collection ? 'In this wallet' : 'Listed candies'}</span><span><b>{config.remaining.toLocaleString()}</b>Rewards remaining</span><span><b>{config.max_supply.toLocaleString()}</b>Collection limit</span><p><ShieldCheck size={17} /> Grades are earned. Rarity is never randomly drawn.</p></div>}
    <Notice error={error} />
    {notice && <div className="platform-success transaction-notice" role="status"><CheckCircle2 size={20} /><span>{notice}{notice.startsWith('Purchase') && <a href="/collection">Open collection <ArrowRight size={15} /></a>}</span></div>}
    {busy && <div className="transaction-progress" role="status" aria-live="polite"><LoaderCircle className="spin" size={20} /><div><b>{busy.startsWith('withdraw') ? 'Confirming your withdrawal' : busy.startsWith('list:') ? 'Preparing your listing' : busy.startsWith('buy:') ? 'Confirming your purchase' : 'Cancelling your listing'}</b><p>Wait for local chain confirmation. Your balance and ownership will refresh when it finishes.</p></div></div>}
    {proceeds !== '0' && <section className="proceeds-panel" aria-label="Seller proceeds"><div><span className="eyebrow">READY TO WITHDRAW</span><h2>{formatEther(BigInt(proceeds))} <small>test ETH</small></h2><p>Completed sales credit your wallet here. Withdraw to receive the funds.</p></div><button className="button button-primary" disabled={!!busy} onClick={() => void action('withdraw')}>{busy.startsWith('withdraw') ? <><LoaderCircle className="spin" size={17} />Confirming withdrawal…</> : 'Withdraw proceeds'}</button></section>}
    {!IS_NFT_ENABLED || config?.enabled === false ? <div className="platform-empty"><Ghost /><h2>The candy chain is resting.</h2><p>Start the full app with ./run.sh to use local collectibles.</p></div> : loading ? <div className="platform-empty" role="status"><LoaderCircle className="spin" /><h2>Opening the candy cabinet…</h2><p>Checking current ownership and listings.</p></div> : collection && !wallet ? <div className="platform-empty"><Ghost size={40} /><h2>Choose your test wallet.</h2><p>Your collection follows the wallet that earned or bought each candy.</p><button className="button button-primary" onClick={openWallet}>Choose test wallet</button></div> : <>
      {!!tokens.length && <div className="market-toolbar"><label className="market-search"><span>Find a candy</span><span><Search size={17} /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or candy number" /></span></label><label>Grade<select value={grade} onChange={event => setGrade(event.target.value)}><option value="all">All grades</option>{['C', 'B', 'A', 'S'].map((label, index) => <option key={label} value={index + 1}>Grade {label}</option>)}</select></label><label>Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest candy</option>{!collection && <><option value="low">Price: low to high</option><option value="high">Price: high to low</option></>}</select></label><span className="market-count" role="status">{visible.length} {visible.length === 1 ? 'candy' : 'candies'}</span></div>}
      {!visible.length && <div className="platform-empty"><Candy size={46} /><h2>{filtered ? 'No candies match those filters.' : collection ? 'No candies in this wallet yet.' : 'The next sweet story could be yours.'}</h2><p>{filtered ? 'Try another name, candy number or grade.' : collection ? 'Win a heist to create your own, or collect one from the marketplace.' : 'No candies are listed right now. Win a heist, create its artwork and mint before listing.'}</p>{filtered ? <button className="button button-light" onClick={() => { setQuery(''); setGrade('all'); }}>Clear filters</button> : <div className="platform-actions"><a className="button button-primary" href="/play">Start a heist <ArrowRight size={16} /></a>{collection && <a className="button button-light" href="/marketplace">Explore marketplace</a>}</div>}</div>}
      <div className="candy-grid">{visible.map(token => {
        const mine = token.owner.toLowerCase() === wallet.toLowerCase() || (token.listing?.seller || token.seller)?.toLowerCase() === wallet.toLowerCase();
        const listed = !!token.listing || !!token.listing_id;
        return <article className="candy-token" key={token.token_id}><div className="candy-token-art">{token.image_url ? <img loading="lazy" src={token.image_url} alt={token.name} /> : <Candy size={70} />}<span className="candy-tier">GRADE {['', 'C', 'B', 'A', 'S'][token.grade]} · {token.score}/100</span></div><div className="candy-token-copy"><span className="eyebrow">CANDY #{token.token_id}{mine ? ' · YOUR COLLECTION' : ''}</span><h2>{token.name.replace(/ · [a-f0-9]{8}$/i, '')}</h2><small>AI artwork · {token.generator?.model?.split('/').pop() || 'FLUX'} · local collectible</small>{listed && <p className="candy-price">{formatEther(tokenPrice(token))} <span>test ETH</span></p>}{mine ? <><button className="button button-light" onClick={() => void reveal(token)}>{prompts[token.token_id] ? 'Hide source prompt' : 'Read source prompt'}</button>{prompts[token.token_id] && <blockquote className="candy-prompt">{prompts[token.token_id]}</blockquote>}{listed ? <button className="button button-light" disabled={!!busy} onClick={() => void action('cancel', token)}>Cancel listing</button> : <details className="listing-details"><summary>List this candy <ArrowUpRight size={16} /></summary><div className="platform-form"><label>Fixed price in test ETH<input inputMode="decimal" value={price[token.token_id] || ''} placeholder="0.01" onChange={event => setPrice(previous => ({ ...previous, [token.token_id]: event.target.value }))} /></label><label className="candy-consent"><input type="checkbox" checked={!!consent[token.token_id]} onChange={event => setConsent(previous => ({ ...previous, [token.token_id]: event.target.checked }))} /> I agree to escrow this NFT and provide its redacted source prompt under {token.prompt_license ? 'the existing immutable license' : 'the license below'}.</label><details><summary>Read source-prompt license</summary><p>{token.prompt_license || PROMPT_LICENSE}</p></details><button className="button button-primary" disabled={!!busy || !consent[token.token_id] || !price[token.token_id]} onClick={() => void action('list', token)}>License, approve & list</button></div></details>}</> : <><p>The redacted source prompt unlocks after purchase. NFT ownership does not transfer copyright.</p><details><summary>Read source-prompt license</summary><p>{token.prompt_license}</p></details><button className="button button-primary" disabled={!!busy} onClick={() => void action('buy', token)}>{wallet ? 'Buy with test ETH' : 'Choose a wallet to collect'}</button></>}</div></article>;
      })}</div>
    </>}
    {!collection && IS_NFT_ENABLED && config?.enabled && <PriceHistory tokens={tokens} revision={historyRevision} />}
    <p className="candy-footnote">Local test collectibles have no promised monetary value. Prompt access follows the current NFT owner; previously delivered copies cannot be recalled. Research licensing is a separate choice.</p>
  </div>;
}
