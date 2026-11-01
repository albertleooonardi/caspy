import { useRef, useState } from 'react';
import { ArrowRight, Candy, CheckCircle2, Clock3, Ghost, Play, ShieldCheck } from 'lucide-react';
import { IS_DEMO } from '../lib/game';

const chapters = [
  { time: 0, label: 'Meet Caspy' },
  { time: 8, label: 'Start a heist' },
  { time: 16, label: 'Write your prompt' },
  { time: 24, label: 'Three chances' },
  { time: 32, label: 'Trick or Treat' },
  { time: 40, label: 'Preview a claim' },
  { time: 48, label: 'Your turn' },
];

export function WalkthroughPlayer({ compact = false }: { compact?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [failed, setFailed] = useState(false);
  const active = chapters.reduce((index, chapter, next) => currentTime >= chapter.time ? next : index, 0);

  function jump(time: number) {
    const player = video.current;
    if (!player) return;
    player.currentTime = time;
    setCurrentTime(time);
    void player.play().catch(() => { /* Native controls remain available. */ });
  }

  return <div className={`walkthrough-player ${compact ? 'walkthrough-compact' : ''}`}>
    <div className="walkthrough-video-wrap">
      <video ref={video} controls playsInline preload="none" width="1440" height="810"
        poster="/videos/caspy-showcase-poster.jpg" aria-label="How to play Caspy: an animated demo explainer"
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onError={() => setFailed(true)}>
        <source src="/videos/caspy-showcase.mp4?v=halloween-voice-1" type="video/mp4" />
        <track kind="captions" src="/videos/caspy-showcase.en.vtt" srcLang="en" label="English" />
        Your browser cannot play this video. <a href="/videos/caspy-showcase.mp4?v=halloween-voice-1">Download the walkthrough</a> or read the steps below.
      </video>
    </div>
    <div className="walkthrough-player-meta"><span><Clock3 size={14} /> Under a minute</span><span><CheckCircle2 size={14} /> Voiceover + captions</span><a href="/videos/caspy-showcase.mp4?v=halloween-voice-1" download>Download video</a></div>
    {failed && <p className="walkthrough-fallback" role="status">The video could not load. You can <a href="/videos/caspy-showcase.mp4?v=halloween-voice-1">open it directly</a> or follow the written guide below.</p>}
    {!compact && <nav className="walkthrough-chapters" aria-label="Walkthrough video chapters">{chapters.map((chapter, index) => <button type="button" key={chapter.time} onClick={() => jump(chapter.time)} aria-current={active === index ? 'step' : undefined}><span>{Math.floor(chapter.time / 60)}:{String(chapter.time % 60).padStart(2, '0')}</span>{chapter.label}</button>)}</nav>}
  </div>;
}

export default function HowToPlay() {
  return <div className="guide-page shell">
    <div className="page-topline"><a href="/" className="back-link">← Back to the haunt</a><span className="mini-tag">A LITTLE HELP BEFORE THE HEIST</span></div>
    <header className="guide-heading"><span className="eyebrow">MEET YOUR NEXT LITTLE ADVENTURE</span><h1>One ghost. Three chances.<br /><span className="orange-text">Here’s how.</span></h1><p>Meet Caspy in an animated, narrated demo. <br />Then bring your own words to Caspy’s doorstep.</p></header>
    <div className="guide-mode-note"><ShieldCheck size={21} /><p>{IS_DEMO ? <><strong>You’re exploring the demo.</strong> No wallet, payment, or real NFT is needed. Replies and outcomes are scripted; claiming is simulated.</> : <><strong>This explainer shows the demo.</strong> The live flow asks you to connect a wallet and sign in. Live results come from the server; real claims require your wallet’s approval.</>}</p></div>
    <WalkthroughPlayer />
    <section className="guide-steps" aria-labelledby="guide-steps-title"><div className="section-heading"><div><span className="eyebrow">THE WALKTHROUGH, IN WORDS</span><h2 id="guide-steps-title">Your first little heist.</h2></div><p>Pause the video whenever you like. <br />These steps are always here.</p></div>
      <ol className="guide-step-list">
        <li><span className="guide-step-number">01</span><div><h3>Step into the haunt.</h3><p>Open <a href="/play">The heist</a> and choose <strong>Start a demo heist</strong>. You can play this preview without connecting a wallet. In the live game, connect your browser wallet and sign the sign-in message first.</p></div><Ghost size={25} /></li>
        <li><span className="guide-step-number">02</span><div><h3>Give Caspy a reason to share.</h3><p>Write a short story, offer a thoughtful trade, or try a little humor. Each prompt can be up to <strong>500 characters</strong>. Press <kbd>Enter</kbd> or select the orange send arrow; <kbd>Shift</kbd> + <kbd>Enter</kbd> adds a new line.</p><blockquote>“I’ll carry your basket through the haunted woods. Even brave ghosts deserve a little help.”</blockquote><small>An example to get you started, not a guaranteed winning prompt.</small></div><Play size={25} /></li>
        <li><span className="guide-step-number">03</span><div><h3>Make your three chances count.</h3><p>Wait for Caspy’s reply before sending another prompt. The candy counter shows your remaining chances. In the demo, use <strong>Preview outcome</strong> before your first prompt to explore either the Treat or Trick ending.</p></div><Candy size={25} /></li>
        <li><span className="guide-step-number">04</span><div><h3>Discover your Trick or Treat.</h3><p>After the conversation finishes, choose <strong>See your result</strong>. A Treat is the winning keepsake; a Trick marks a brave attempt. Demo outcomes follow your preview selection. Live outcomes are confirmed by the server.</p></div><CheckCircle2 size={25} /></li>
        <li><span className="guide-step-number">05</span><div><h3>Preview the keepsake moment.</h3><p>Choose <strong>Claim your Treat</strong> or <strong>Claim your Trick</strong>, then <strong>Simulate claim</strong>. Wait for the demo confirmation. This creates no transaction or NFT. In a live claim, review the network and gas fee in your wallet before approving.</p></div><ShieldCheck size={25} /></li>
      </ol>
    </section>
    <section className="guide-help"><div><span className="eyebrow">A FEW FRIENDLY REMINDERS</span><h2>A little charm goes a long way.</h2></div><div><details><summary>Do I need a wallet to watch or try the demo?</summary><p>No. The tutorial and scripted demo work without a wallet. Real wallet sign-in and claims are separate steps in the live experience.</p></details><details><summary>Can I come back to my conversation?</summary><p>The demo saves your conversation in this browser. Return to The heist to continue. Private browsing or clearing site storage can remove it.</p></details><details><summary>Does a friendly reply mean I won?</summary><p>Check the result screen. In the live game, Caspy’s words alone never decide a win or authorize a mint. The demo uses the preview outcome you selected.</p></details></div></section>
    <div className="guide-cta"><div><Ghost size={30} /><span>Ready to meet your candy guardian?</span></div><a href="/play" className="button button-primary">{IS_DEMO ? 'Try a demo heist' : 'Start your heist'}<ArrowRight size={18} /></a><a href="/rules" className="inline-link">Read the full rules</a></div>
  </div>;
}
