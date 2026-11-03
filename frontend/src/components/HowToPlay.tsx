import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock3, Ghost, Play, Pause, ShieldCheck, Volume2, VolumeX, SkipBack, SkipForward, RotateCcw, Repeat2, BookOpen, FlaskConical, Sparkles } from 'lucide-react';
import { IS_DEMO, IS_NFT_ENABLED } from '../lib/game';
import { chapters, chapterAt, timestamp, walkthroughDuration } from '../lib/walkthrough';

const mediaVersion = 'kinetic-halloween-gameplay-v4';
const videoUrl = `/videos/caspy-showcase.mp4?v=${mediaVersion}`;
type Seek = { index: number; nonce: number };

export function WalkthroughPlayer({ compact = false, seekRequest }: { compact?: boolean; seekRequest?: Seek }) {
  const video = useRef<HTMLVideoElement>(null);
  const chapterButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const pendingSeek = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [rate, setRate] = useState(1);
  const [loopIndex, setLoopIndex] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [status, setStatus] = useState('Ready when you are. The film starts muted.');
  const active = chapterAt(currentTime);
  const chapter = chapters[active];
  useEffect(() => { setInteractive(true); }, []);

  function play() {
    const player = video.current;
    if (!player) return;
    setFailed(false);
    void player.play().catch(() => {
      setStarted(false);
      setStatus('Playback did not start. Try the native play control, or open the film directly.');
    });
  }
  function jump(index: number) {
    const selected = chapters[Math.max(0, Math.min(chapters.length - 1, index))];
    const player = video.current;
    if (!player) return;
    pendingSeek.current = selected.start;
    if (player.readyState > 0) {
      player.currentTime = selected.start;
      pendingSeek.current = null;
    }
    setCurrentTime(selected.start);
    if (loopIndex !== null) setLoopIndex(chapters.indexOf(selected));
    setStatus(`Chapter ${chapters.indexOf(selected) + 1}: ${selected.label}.`);
    play();
  }
  useEffect(() => { if (seekRequest) jump(seekRequest.index); }, [seekRequest?.nonce]);

  function chapterKeys(event: KeyboardEvent<HTMLElement>) {
    let next: number | null = null;
    const focused = chapterButtons.current.indexOf(event.target as HTMLButtonElement);
    const from = focused >= 0 ? focused : active;
    if (event.key === 'ArrowRight') next = Math.min(chapters.length - 1, from + 1);
    if (event.key === 'ArrowLeft') next = Math.max(0, from - 1);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = chapters.length - 1;
    if (next !== null) { event.preventDefault(); jump(next); chapterButtons.current[next]?.focus(); }
  }
  function timeUpdate(player: HTMLVideoElement) {
    if (loopIndex !== null && player.currentTime >= chapters[loopIndex].end - .05) {
      player.currentTime = chapters[loopIndex].start;
      setCurrentTime(chapters[loopIndex].start);
    } else setCurrentTime(player.currentTime);
  }
  const chapterProgress = Math.max(0, Math.min(100, (currentTime - chapter.start) / chapter.seconds * 100));

  return <div id={compact ? undefined : 'walkthrough-film'} className={`walkthrough-player motion-player ${compact ? 'walkthrough-compact' : ''}`}>
    <div className="motion-player-stage"><div className="walkthrough-video-wrap motion-video-wrap">
      <video ref={video} controls playsInline muted={muted} preload="metadata" width="1600" height="900"
        poster={`/videos/caspy-showcase-poster.jpg?v=${mediaVersion}`} aria-label="Caspy field guide: animated typography with Halloween music and wordless ghost choir, no narration"
        onLoadedMetadata={event => { if (pendingSeek.current !== null) { event.currentTarget.currentTime = pendingSeek.current; pendingSeek.current = null; } }}
        onTimeUpdate={event => timeUpdate(event.currentTarget)} onPlay={() => { setPlaying(true); setStarted(true); }} onPause={() => setPlaying(false)}
        onVolumeChange={event => setMuted(event.currentTarget.muted || event.currentTarget.volume === 0)} onRateChange={event => setRate(event.currentTarget.playbackRate)}
        onEnded={() => { if (loopIndex !== null) jump(loopIndex); else { setPlaying(false); setStatus('Film complete. Replay a chapter or choose your next step.'); } }}
        onError={() => { setFailed(true); setStatus('The film could not load. The written guide below is always available.'); }}>
        <source src={videoUrl} type="video/mp4" />
        <track kind="captions" src={`/videos/caspy-showcase.en.vtt?v=${mediaVersion}`} srcLang="en" label="English instructions" />
        Your browser cannot play this film. <a href={videoUrl}>Download it</a> or read the written guide below.
      </video>
      {interactive && !started && !failed && <button className="motion-play-cover" onClick={play} aria-label="Play the 100-second field guide, initially muted"><span><Play size={30} fill="currentColor" /></span><b>Step into the story.</b><small>{timestamp(walkthroughDuration)} · animated field guide · no narration</small></button>}
    </div>{!compact && <aside className="motion-chapter-note" aria-label="Current chapter instructions"><span className="eyebrow">IN THIS CHAPTER</span><div className="motion-chapter-number">{String(active + 1).padStart(2, '0')}<span> / {chapters.length}</span></div><h2>{chapter.label}</h2><p>{chapter.body}</p><div className="motion-tip"><Sparkles size={16} /><span>{chapter.tip}</span></div><a className="inline-link" href={chapter.href}>{chapter.action}<ArrowUpRight size={16} /></a></aside>}</div>
    <div className="motion-controls"><div className="motion-transport"><button onClick={() => playing ? video.current?.pause() : play()} aria-label={playing ? 'Pause film' : 'Play film'}>{playing ? <Pause size={18} /> : <Play size={18} />}</button><button onClick={() => jump(active - 1)} disabled={active === 0} aria-label="Previous chapter"><SkipBack size={17} /></button><button onClick={() => jump(active)} aria-label="Replay current chapter"><RotateCcw size={17} /></button><button onClick={() => jump(active + 1)} disabled={active === chapters.length - 1} aria-label="Next chapter"><SkipForward size={17} /></button><span className="motion-time">{timestamp(currentTime)} <span>/ {timestamp(walkthroughDuration)}</span></span></div><div className="motion-options"><button className={loopIndex !== null ? 'enabled' : ''} aria-pressed={loopIndex !== null} onClick={() => { setLoopIndex(loopIndex === null ? active : null); setStatus(loopIndex === null ? 'This chapter will repeat until you turn looping off.' : 'Chapter looping off.'); }}><Repeat2 size={16} /><span>Loop chapter</span></button><label><span className="sr-only">Playback speed</span><select aria-label="Playback speed" value={rate} onChange={event => { const speed = Number(event.target.value); setRate(speed); if (video.current) video.current.playbackRate = speed; }}><option value="0.75">0.75×</option><option value="1">1× speed</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><button onClick={() => { const next = !muted; setMuted(next); if (video.current) { video.current.muted = next; if (!next && video.current.volume === 0) video.current.volume = .7; } setStatus(next ? 'Sound off.' : 'Halloween music and wordless ghost choir on. No narration.'); }} aria-pressed={!muted} aria-label={muted ? 'Enable Halloween soundtrack' : 'Mute Halloween soundtrack'}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}<span>{muted ? 'Sound off' : 'Halloween sound'}</span></button></div></div>
    <div className="motion-progress" aria-hidden="true"><span style={{ width: `${currentTime / walkthroughDuration * 100}%` }} /></div>
    <nav className="walkthrough-chapters motion-chapters" aria-label="Video chapters. Use left and right arrows to move between chapters." onKeyDown={chapterKeys}>{chapters.map((item,index) => <button ref={element => { chapterButtons.current[index] = element; }} type="button" key={item.id} onClick={() => jump(index)} aria-current={active === index ? 'step' : undefined}><span className="motion-chapter-label"><b>{String(index+1).padStart(2,'0')}</b><small>{timestamp(item.start)}</small></span><strong>{item.label}</strong><span className="motion-chapter-progress" aria-hidden="true"><i style={{ width: `${index < active ? 100 : index === active ? chapterProgress : 0}%` }} /></span></button>)}</nav>
    <div className="walkthrough-player-meta"><span><Clock3 size={14} /> {timestamp(walkthroughDuration)} · 10 chapters</span><span><CheckCircle2 size={14} /> Text-led · no voiceover</span><a href={videoUrl} download>Download the film</a></div><p className="motion-status" role="status">{status}</p>
    {failed && <p className="walkthrough-fallback">You can <a href={videoUrl}>open the film directly</a>, or follow the written steps and knowledge check below.</p>}
  </div>;
}

const playerSteps = [
  { chapter: 1, title: 'Create your account, or sign in.', text: 'Open Register. Choose Play & contribute, enter your name and email, create a password of at least 12 characters, and confirm it. Read the account terms and privacy notice before accepting. Returning players can use Sign in. Research sharing is not part of registration consent.' },
  { chapter: 2, title: 'Choose private play or a named campaign.', text: 'Open The heist. Private play is the default. To help a researcher, select a campaign and read its purpose. Research contribution and commercial licensing have separate, initially unchecked boxes. Leaving both off never changes your game or NFT eligibility.' },
  { chapter: 7, title: 'In NFT mode, choose your local test wallet.', text: 'Before starting, choose Connect local test wallet and select an available wallet. Your linked wallets remain available; another account’s linked wallet is excluded. These are unlocked Anvil development accounts on chain 31337, using test ETH. AI-only mode skips this step.' },
  { chapter: 3, title: 'Give Caspy a specific, creative reason.', text: 'Tell a small story, propose a thoughtful trade, try humor, or offer an emotional reason within his fictional world. Each prompt has a 500-character limit. Enter sends, Shift + Enter adds a line, and the orange arrow also sends. Never include personal, confidential, or sensitive information.' },
  { chapter: 4, title: 'Listen to the reply. Change your angle.', text: 'Wait until Caspy finishes before sending another prompt. The candy counter shows remaining attempts. You have up to three chances; a win can finish the heist early. Claims of developer authority or instructions to ignore rules do not qualify as creative persuasion.' },
  { chapter: 5, title: 'Let the independent judge do its job.', text: 'Caspy’s answer and the judge’s verdict are separate calls. The server confirms the outcome; a friendly response alone is not a win. If the reply is saved but judging is unavailable, use Check judge again. This reviews the same response without spending another prompt.' },
  { chapter: 6, title: 'Discover the result, then claim if enabled.', text: 'Select See your result. Only a confirmed win earns candy. Inspect grade C/B/A/S, then approve image generation. Local FLUX.1-schnell uses your redacted winning prompt to shape candy flavors, colors and wrapper motifs. Generation can take several minutes. The finite supply is capped at 1,000 candies; there are no random rarity draws. Mint the completed artwork using local test ETH. In Collection, review the prompt license and list at a fixed test-ETH price. Buyers gain prompt access after purchase. No win means no candy or NFT. AI-only and demo modes do not mint real NFTs.' },
  { chapter: 8, title: 'Your contribution stays your choice.', text: 'If you opted into research, you can optionally rate evaluated replies. Account → Your research choices lets you withdraw. This deletes research examples and removes them from future exports. Already downloaded copies cannot be recalled; operational game data and provider logs are separate.' },
];
const researcherSteps = [
  { chapter: 1, title: 'Create a research workspace.', text: 'Choose Evaluate AI when registering and name your workspace. A contributor can also create a workspace from Account settings. Your permissions cover your own workspace and explicitly licensed datasets, not other organizations’ private contributions.' },
  { chapter: 8, title: 'Publish a clear research purpose.', text: 'Open Research lab and create a campaign. Explain what you want to learn and how examples will be used. Campaigns use the configured Bifrost actor, independent judge and recorded rubric. Changing the target configuration requires a new campaign.' },
  { chapter: 2, title: 'Invite participants to choose, not assume.', text: 'Participants select your named campaign before a heist and separately permit research and commercial use. Private games do not enter your research queue. Consent choices do not influence the judge, attempts, result or collectible.' },
  { chapter: 8, title: 'Review text and add human labels.', text: 'Use Review contributions. Automatic redaction catches common identifiers, not every name or personal story. Edit both texts, add a human verdict, test type, behavior label, strategy and quality score, then attest to reviewing sensitive information before approval. Redaction does not guarantee anonymity.' },
  { chapter: 5, title: 'Read metrics with their denominators.', text: 'Persuasion yield is task behavior. Judge agreement compares model verdicts to reviewed human labels. Boundary violations count only human-reviewed policy attacks with a usable behavior label. A creative win is not automatically a safety failure. Unknown models remain unknown; small, self-selected samples are exploratory evidence.' },
  { chapter: 8, title: 'License only reviewed, permitted examples.', text: 'A release includes approved examples with active research and commercial permission. Add a title, description, license and listed USD price. Buyers request access; the owner grants or revokes it manually. Caspy does not charge a payment. Exports are checked against current consent and access, and published examples are locked.' },
];
const quiz = [
  { title: 'Caspy says “that sounds sweet.” Did you win?', options: ['Yes, a friendly reply is enough.', 'Check the server-confirmed result.'], correct: 1, explanation: 'Caspy speaks in character. A separate judge evaluates the conversation, and the server confirms the outcome.', chapter: 5 },
  { title: 'Do you have to join research to earn candy?', options: ['No. Research is optional.', 'Yes. Sharing improves your chances.'], correct: 0, explanation: 'Research and commercial permissions begin unchecked and never change attempts, the outcome or NFT eligibility.', chapter: 2 },
  { title: 'Do all three-prompt attempts earn a candy?', options: ['Yes. Everyone receives a random rarity.', 'No. Only a confirmed win earns candy.'], correct: 1, explanation: 'A loss earns no candy, reward image or NFT. Winning prompts receive a scored C/B/A/S grade; approved FLUX artwork is then minted with local test ETH in NFT mode.', chapter: 6 },
];

export default function HowToPlay() {
  const [path, setPath] = useState<'player' | 'researcher'>('player');
  const [seek, setSeek] = useState<Seek>();
  const [answers, setAnswers] = useState<(number | null)[]>([null,null,null]);
  const correct = answers.reduce<number>((total,answer,index) => total + Number(answer === quiz[index].correct), 0);
  function revisit(index: number) { setSeek({ index, nonce: Date.now() }); document.getElementById('walkthrough-film')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
  return <div className="guide-page shell motion-guide">
    <div className="page-topline"><a href="/" className="back-link">← Back to the haunt</a><span className="mini-tag">THE CASPY FIELD GUIDE / EDITION 04</span></div>
    <header className="guide-heading motion-guide-heading"><span className="eyebrow">READ THE ROOM. CHARM THE GHOST.</span><h1>A little story.<br /><span>A lot of <em>mischief.</em></span></h1><p>Learn the three-prompt challenge, what counts as a win, and how your winning words become a graded candy NFT.</p><div className="motion-guide-tags"><span><Clock3 size={14} /> 100 seconds</span><span><Volume2 size={14} /> Halloween score + wordless choir</span><span><BookOpen size={14} /> No spoken narration</span></div></header>
    <div className="guide-mode-note"><ShieldCheck size={21} /><p>{IS_DEMO ? <><strong>You’re in the scripted demo.</strong> Its replies and claim previews are simulated. This illustrated film also explains the account-based app and local NFT mode.</> : IS_NFT_ENABLED ? <><strong>You’re in local NFT mode.</strong> Register or sign in, choose an available test wallet, and play. Collectibles use Anvil test ETH, not real funds.</> : <><strong>You’re in AI-only mode.</strong> Register or sign in to play through Bifrost. Research is optional; blockchain wallets and NFT claims are disabled.</>}</p></div>
    <WalkthroughPlayer seekRequest={seek} />
    <section className="guide-steps motion-written-guide" aria-labelledby="guide-steps-title"><div className="section-heading"><div><span className="eyebrow">PAUSE. REPLAY. GO AT YOUR PACE.</span><h2 id="guide-steps-title">Choose your route.</h2></div><p>Every step is here in writing.<br />Use Replay chapter to see it in motion.</p></div><div className="guide-path-switch" role="group" aria-label="Choose your walkthrough path"><button aria-pressed={path === 'player'} onClick={() => setPath('player')}><Ghost size={18} /> Player guide</button><button aria-pressed={path === 'researcher'} onClick={() => setPath('researcher')}><FlaskConical size={18} /> Researcher guide</button></div><ol className="guide-step-list motion-step-list">{(path === 'player' ? playerSteps : researcherSteps).map((step,index) => <li key={`${path}-${index}`}><span className="guide-step-number">{String(index+1).padStart(2,'0')}</span><div><h3>{step.title}</h3><p>{step.text}</p><button className="text-button motion-revisit" onClick={() => revisit(step.chapter)}><RotateCcw size={13} /> Replay chapter · {timestamp(chapters[step.chapter].start)}</button></div></li>)}</ol></section>
    <section className="guide-knowledge" aria-labelledby="guide-quiz-title"><div className="section-heading"><div><span className="eyebrow">A QUICK CHECK BEFORE YOU KNOCK</span><h2 id="guide-quiz-title">Got the ghost rules?</h2></div><p>A tiny, optional knowledge check.<br />Answers stay in this page; they are not submitted.</p></div><div className="guide-quiz-grid">{quiz.map((question,index) => <fieldset className="guide-quiz-card" key={question.title}><legend><span>{String(index+1).padStart(2,'0')}</span>{question.title}</legend><div>{question.options.map((option,choice) => <button key={option} aria-pressed={answers[index] === choice} className={answers[index] === choice ? choice === question.correct ? 'correct' : 'try-again' : ''} onClick={() => setAnswers(current => current.map((answer,i) => i === index ? choice : answer))}>{option}{answers[index] === choice && choice === question.correct && <CheckCircle2 size={17} />}</button>)}</div>{answers[index] !== null && <p role="status">{question.explanation}<button className="text-button" onClick={() => revisit(question.chapter)}>Revisit this idea <ArrowRight size={12} /></button></p>}</fieldset>)}</div>{answers.every(answer => answer !== null) && <div className="guide-quiz-result" role="status"><span><Sparkles size={19} /> {correct === quiz.length ? 'You’ve got the ghost rules.' : `${correct} of ${quiz.length} correct. Revisit a chapter and try another answer.`}</span><button className="text-button" onClick={() => setAnswers([null,null,null])}>Reset the check</button></div>}</section>
    <div className="guide-cta"><div><Ghost size={30} /><span>Your story starts with a hello.</span></div><a href={path === 'researcher' ? '/research' : IS_DEMO ? '/play' : '/register'} className="button button-primary">{path === 'researcher' ? 'Open the research lab' : IS_DEMO ? 'Try the scripted demo' : 'Create your account'}<ArrowRight size={18} /></a><a href="/play" className="inline-link">Already registered? Play a heist.</a></div>
  </div>;
}
