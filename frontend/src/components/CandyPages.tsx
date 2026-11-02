import { useEffect, useState } from 'react';
import { Candy, Ghost, LoaderCircle, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { formatEther, parseEther } from 'viem';
import { IS_NFT_ENABLED, LIVE_SESSION_KEY, request, type Session } from '../lib/game';
import { mintVoucher, tradeCandy, PROMPT_LICENSE, type Voucher } from '../lib/wallet';

export type Assessment = { grade: number; grade_label: string; score: number; components: Record<string, number>; comparison_count: number; closest_similarity: number; rule_version: string };
export type EarnedCandy = { session_id: string; state: string; assessment: Assessment; image_url: string | null; error: string | null; minted: boolean; token_id: string | null; attempts: number };
type Token = { token_id: string; owner: string; creator: string; grade: number; score: number; name: string; image_url: string | null; assessment: Assessment; prompt_license: string; contract: `0x${string}`; market: `0x${string}`; price_wei?: string; listing_id?: string; seller?: string; listing?: { listing_id: string; seller: string; price_wei: string } | null };
type Config = { enabled: boolean; configured: boolean; max_supply: number; remaining: number };
const message = (error: unknown) => error instanceof Error ? error.message : 'The operation could not finish. Reload to check your saved state.';
function Notice({ error }: { error: string }) { return error ? <p className="error" role="alert">{error}</p> : null; }
function Score({ assessment: a }: { assessment: Assessment }) {
  return <div className="candy-score"><div className="candy-grade"><span>GRADE</span><b>{a.grade_label}</b><span>{a.score} / 100</span></div><div><h3>Earned by your words.</h3><div className="candy-bars">{Object.entries(a.components).map(([name, value]) => <label key={name}><span>{name}<b>{value} / {name === 'novelty' ? 40 : 20}</b></span><meter min="0" max={name === 'novelty' ? 40 : 20} value={value} /></label>)}</div><small>Novelty compares {a.comparison_count} earlier winning prompts in this season. This is a model assessment and text-similarity score, not proof of worldwide originality.</small></div></div>;
}
export function CandyResult({ wallet, openWallet }: { wallet: string; openWallet: () => void }) {
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
    const timer = setInterval(() => { load().catch(e => setError(message(e))); }, 3000);
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
  if (game.status !== 'won') return <div className="empty-state shell"><Ghost size={60} /><span className="eyebrow">{game.status === 'lost' ? 'THE CANDY STAYS WITH CASPY' : 'YOUR HEIST'}</span><h1>{game.status === 'lost' ? 'A brave little boo.' : game.status === 'pending_review' ? 'Your words are under review.' : 'Your story is still unfolding.'}</h1><p>{game.status === 'lost' ? 'Caspy was not persuaded. No candy, image request, or NFT is awarded for this heist.' : 'Only an independently confirmed win can earn a candy. Your saved conversation is available in the heist.'}</p><a className="button button-primary" href="/play">Back to your conversation</a>{game.status === 'pending_review' && <button disabled={!!busy} className="button button-light" onClick={review}>Check judge again</button>}<Notice error={error} /></div>;
  const candy = game.candy;
  return <div className="candy-page shell"><span className="eyebrow">THE SPOILS OF YOUR WORDS · LOCAL CHAIN</span><h1>A candy only your<br />story could inspire<span className="orange-text">.</span></h1><p className="candy-lead">You persuaded Caspy. Your winning prompt shapes one FLUX.1-dev candy artwork. Your grade is saved before the image is generated.</p><Notice error={error || game.candy_error || ''} />{candy && <div className="candy-result-grid"><div className="candy-art">{candy.image_url ? <img src={candy.image_url} alt={`Your AI-generated grade ${candy.assessment.grade_label} candy`} /> : <><Candy size={90} strokeWidth={1} /><b>{candy.state === 'generating' ? 'Conjuring your candy…' : 'An earned candy, waiting to take shape.'}</b><span>{candy.state === 'generating' ? 'Your artwork request is running. You can return to this page later.' : 'No preview is generated until you choose to send your prompt.'}</span></>}</div><div><Score assessment={candy.assessment} /><div className="claim-box"><h3>{game.minted ? 'Your candy is on-chain.' : candy.state === 'ready' ? 'One final step. Make it yours.' : 'From your words to sugar.'}</h3>{game.minted ? <><p>Token #{game.token_id}. Artwork, prompt hash, grade and metadata are committed to your NFT.</p><a className="button button-primary" href="/collection">Open your collection <ArrowUpRight size={17} /></a></> : candy.state === 'ready' ? <><p>Mint this exact artwork on local Anvil using test ETH. One candy per wallet and heist. No rerolls.</p><button className="button button-primary" onClick={mint} disabled={!!busy}>Mint my candy</button></> : candy.state === 'needs_configuration' ? <p role="status">Your grade is saved. Image generation awaits server configuration: HF_TOKEN with Inference Providers permission and provider credits. Return here after configuration.</p> : candy.state === 'generating' ? <p role="status"><LoaderCircle className="spin" size={18} /> FLUX is creating your image. No additional click is needed.</p> : <><p>The redacted winning prompt is sent to Hugging Face’s fal-ai provider. Generation uses provider credits. The image seed never changes your grade.</p><label className="candy-consent"><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} /> I agree to send my redacted winning prompt for image generation. I have rights to use this text.</label>{['failed', 'uncertain'].includes(candy.state) && <><Notice error={candy.error || ''} /><label className="candy-consent"><input type="checkbox" checked={retry} onChange={e => setRetry(e.target.checked)} /> Retry this failed request; another provider charge may apply. Maximum three requests per candy.</label></>}<button className="button button-primary" onClick={generate} disabled={!!busy || !accept || (['failed', 'uncertain'].includes(candy.state) && !retry)}>{candy.attempts ? 'Retry image request' : 'Generate my earned candy'}</button></>}{busy && <p role="status">{busy}</p>}</div></div></div>}<p className="candy-footnote"><ShieldCheck size={17} /> Finite collection: 1,000 candies. C: 0–59 · B: 60–74 · A: 75–89 · S: 90–100. Grades are not random rarity odds. Research sharing is a separate choice.</p></div>;
}
export function CandyMarket({ collection, wallet, openWallet }: { collection: boolean; wallet: string; openWallet: () => void }) {
  const [tokens, setTokens] = useState<Token[]>([]); const [config, setConfig] = useState<Config | null>(null); const [proceeds, setProceeds] = useState('0');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(''); const [loading, setLoading] = useState(true); const [price, setPrice] = useState<Record<string,string>>({}); const [consent, setConsent] = useState<Record<string,boolean>>({}); const [prompts, setPrompts] = useState<Record<string,string>>({});
  async function load() {
    const cfg = await request<Config>('/candy/config'); setConfig(cfg);
    if (!cfg.enabled || (collection && !wallet)) { setTokens([]); return; }
    const result = await request<{ tokens?: Token[]; listings?: Token[] }>(collection ? '/candy/collection' : '/market/listings'); setTokens(result.tokens || result.listings || []);
    if (wallet) { const own = await request<{ proceeds_wei: string }>('/market/account'); setProceeds(own.proceeds_wei); }
  }
  useEffect(() => { setLoading(true); load().catch(e => setError(message(e))).finally(() => setLoading(false)); }, [wallet, collection]);
  async function reveal(token: Token) { try { const result = await request<{ prompt: string }>(`/candy/prompt/${token.token_id}`); setPrompts(prev => ({ ...prev, [token.token_id]: result.prompt })); } catch(e) { setError(message(e)); } }
  async function action(name: 'list' | 'buy' | 'cancel' | 'withdraw', token: Token) {
    if (!wallet) { openWallet(); return; }
    setError(''); setBusy(`${name}:${token.token_id}`);
    try {
      if (name === 'list' && !consent[token.token_id]) throw new Error('Confirm the prompt license and transfer before listing.');
      await tradeCandy(name, wallet, token.contract, token.market, token.token_id, token.listing?.listing_id || token.listing_id, name === 'list' ? String(parseEther(price[token.token_id] || '0')) : token.price_wei || '0', !!token.prompt_license);
      setPrompts({}); await load();
    } catch (e) { setError(message(e)); } finally { setBusy(''); }
  }
  return <div className="candy-page shell"><div className="page-topline"><span className="mini-tag">ANVIL 31337 · TEST ETH ONLY</span><a href={collection ? '/marketplace' : '/collection'} className="inline-link">{collection ? 'Visit the marketplace' : 'Your collection'} <ArrowUpRight size={16} /></a></div><span className="eyebrow">{collection ? 'YOUR WORDS. YOUR SWEET LITTLE LEGACY.' : 'MADE FROM HUMAN IMAGINATION'}</span><h1>{collection ? 'Your candy cabinet' : 'The midnight market'}<span className="orange-text">.</span></h1><p className="candy-lead">{collection ? 'The candies you earned or collected, with the prompts behind them.' : 'Collect a candy and access its redacted winning prompt after purchase. Each grade was earned through persuasion, creativity and measured novelty.'}</p>{config?.enabled && <p className="candy-footnote">{config.remaining} of {config.max_supply} candy entitlements remain. Supply is capped; grades are not random. No financial value is promised.</p>}<Notice error={error} />{!IS_NFT_ENABLED || config?.enabled === false ? <div className="platform-empty"><Ghost /><h2>The local candy chain is resting.</h2><p>Launch the full app with bash run-heist.sh for local NFT features.</p></div> : loading ? <div className="platform-empty" role="status"><LoaderCircle className="spin" />Loading the candy cabinet…</div> : collection && !wallet ? <div className="platform-empty"><h2>Connect your verified test wallet.</h2><button className="button button-primary" onClick={openWallet}>Connect wallet</button></div> : <>{proceeds !== '0' && <div className="claim-box"><p>Your sales proceeds: {formatEther(BigInt(proceeds))} test ETH.</p><button className="button button-primary" disabled={!!busy} onClick={() => { const token = tokens[0] || { contract: import.meta.env.PUBLIC_CONTRACT_ADDRESS, market: import.meta.env.PUBLIC_MARKET_ADDRESS, token_id:'0' } as Token; void action('withdraw', token); }}>Withdraw proceeds</button></div>}{!tokens.length && <div className="platform-empty"><Candy size={48} /><h2>{collection ? 'Your cabinet awaits its first candy.' : 'No candy is listed yet.'}</h2><p>Win a heist, generate its artwork, and mint before listing.</p><a className="button button-primary" href="/play">Meet Caspy</a></div>}<div className="candy-grid">{tokens.map(token => {
    const mine = token.owner.toLowerCase() === wallet.toLowerCase() || (token.listing?.seller || token.seller)?.toLowerCase() === wallet.toLowerCase();
    const listed = !!token.listing || !!token.listing_id;
    return <article className="candy-token" key={token.token_id}><div className="candy-token-art">{token.image_url ? <img loading="lazy" src={token.image_url} alt={token.name} /> : <Candy size={70} />}<span className="candy-tier">GRADE {['','C','B','A','S'][token.grade]} · {token.score}/100</span></div><div className="candy-token-copy"><span className="eyebrow">CANDY #{token.token_id}</span><h2>{token.name}</h2><small>AI-generated with FLUX.1-dev · local test NFT</small>{listed && <p className="candy-price">{formatEther(BigInt(token.price_wei || token.listing?.price_wei || '0'))} <span>test ETH</span></p>}{mine ? <><button className="button button-light" onClick={() => reveal(token)}>Reveal my source prompt</button>{prompts[token.token_id] && <blockquote className="candy-prompt">{prompts[token.token_id]}</blockquote>}{listed ? <button className="button button-primary" disabled={!!busy} onClick={() => action('cancel', token)}>Cancel listing</button> : <div className="platform-form"><label>Fixed price in test ETH<input inputMode="decimal" value={price[token.token_id] || ''} placeholder="0.01" onChange={e => setPrice(prev => ({ ...prev, [token.token_id]:e.target.value }))} /></label><label className="candy-consent"><input type="checkbox" checked={!!consent[token.token_id]} onChange={e => setConsent(prev => ({ ...prev, [token.token_id]:e.target.checked }))} /> I agree to escrow this NFT and provide its redacted source prompt under {token.prompt_license ? 'the existing immutable license' : 'the license below'}.</label><details><summary>Read prompt license</summary><p>{token.prompt_license || PROMPT_LICENSE}</p></details><button className="button button-primary" disabled={!!busy || !consent[token.token_id]} onClick={() => action('list', token)}>License, approve & list</button></div>}</> : <><p>The source prompt unlocks for the verified owner after purchase. NFT ownership does not itself transfer copyright.</p><details><summary>Prompt license</summary><p>{token.prompt_license}</p></details><button className="button button-primary" disabled={!!busy} onClick={() => action('buy', token)}>{wallet ? 'Buy with test ETH' : 'Connect to collect'}</button></>}{busy.endsWith(`:${token.token_id}`) && <p role="status">Waiting for local chain confirmation…</p>}</div></article>;
  })}</div></>}<p className="candy-footnote">Trading uses fixed prices and explicit transactions. Prompt access follows the NFT owner; previously delivered copies cannot be recalled. The creator retains their original text. Research datasets have separate consent and licensing.</p></div>;
}
