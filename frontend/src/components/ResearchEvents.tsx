import { useEffect, useRef } from 'react';
import { ArrowRight, Check, FlaskConical, Ghost, LockKeyhole, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { Campaign } from '../lib/platform';
import '../styles/research-events.css';

// Research campaigns shown to players as "events" they can join before a heist.
// Joining only selects the campaign. Contributing still needs the player to tick
// the research box themselves; both boxes start unchecked (PRD 20.4).
type Props = {
  campaigns: Campaign[];
  loading: boolean;
  failed: boolean;
  campaignId: string;
  researchConsent: boolean;
  commercialConsent: boolean;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onResearch: (value: boolean) => void;
  onCommercial: (value: boolean) => void;
};

export default function ResearchEvents({ campaigns, loading, failed, campaignId, researchConsent, commercialConsent, disabled = false, onSelect, onResearch, onCommercial }: Props) {
  const chosen = campaigns.find(item => item.id === campaignId);
  const panel = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (chosen) panel.current?.focus(); }, [chosen?.id]);

  return <section className="research-events" aria-labelledby="research-events-title">
    <header className="research-events-head">
      <div><span className="eyebrow"><Sparkles size={13} /> OPTIONAL · RESEARCH EVENTS</span><h2 id="research-events-title">Play for a cause, or just for candy.</h2></div>
      <p>Join an event to share this heist’s prompts with a research team. Your choice never changes your attempts, result or candy.</p>
    </header>

    {loading ? <p className="research-events-note" role="status">Loading events…</p>
      : failed ? <p className="research-events-note" role="status">Events could not load. You can still play privately.</p>
      : <ul className="research-events-list">
        <li>
          <article className={`event-card event-private ${!campaignId ? 'selected' : ''}`}>
            <span className="event-icon"><LockKeyhole size={20} /></span>
            <span className="event-tag">DEFAULT</span>
            <h3>Private heist</h3>
            <p>Just you and Caspy. Nothing is shared with researchers.</p>
            <button type="button" className={`button ${!campaignId ? 'button-primary' : 'button-light'}`} aria-pressed={!campaignId} disabled={disabled} onClick={() => onSelect('')}>{!campaignId ? <><Check size={16} /> Selected</> : 'Play privately'}</button>
          </article>
        </li>
        {campaigns.map(item => {
          const active = item.id === campaignId;
          return <li key={item.id}>
            <article className={`event-card ${active ? 'selected' : ''}`}>
              <span className="event-icon"><FlaskConical size={20} /></span>
              <span className="event-tag">EVENT{item.organization ? ` · ${item.organization}` : ''}</span>
              <h3>{item.name}</h3>
              <p className="event-description">{item.description}</p>
              <button type="button" className={`button ${active ? 'button-primary' : 'button-light'}`} aria-pressed={active} disabled={disabled} onClick={() => onSelect(active ? '' : item.id)}>{active ? <><Check size={16} /> Selected</> : <>Choose event <ArrowRight size={16} /></>}</button>
            </article>
          </li>;
        })}
      </ul>}

    {!loading && !failed && !campaigns.length && <p className="research-events-note">No research events are open right now. Your heist will be private.</p>}

    {chosen && <div className="event-join" role="region" aria-labelledby="event-join-title">
      <div className="event-join-head">
        <h3 id="event-join-title" ref={panel} tabIndex={-1}>Joining “{chosen.name}”</h3>
        <button type="button" className="text-button" disabled={disabled} onClick={() => onSelect('')}><X size={15} /> Leave event</button>
      </div>
      <p>Confirm what you want to share for this heist. Nothing is shared until you tick the first box.</p>
      <label className="platform-check"><input type="checkbox" checked={researchConsent} disabled={disabled} onChange={e => { onResearch(e.target.checked); if (!e.target.checked) onCommercial(false); }} /><span>I choose to contribute this heist’s prompts, AI replies, evaluations and optional ratings to <b>{chosen.organization || 'this research workspace'}</b>.</span></label>
      <label className="platform-check"><input type="checkbox" checked={commercialConsent} disabled={disabled || !researchConsent} onChange={e => onCommercial(e.target.checked)} /><span>Also allow human-reviewed, redacted examples to be licensed for commercial AI evaluation or training. <i>Optional.</i></span></label>
      <p className={`event-status ${researchConsent ? 'ready' : ''}`} role="status">{researchConsent ? <><ShieldCheck size={16} /> You’re in. Start your heist below to take part.</> : <><Ghost size={16} /> Tick the first box to take part. Otherwise this heist stays private.</>}</p>
      <small>Don’t include personal or confidential information. Redaction can’t guarantee anonymity. You can withdraw later in <a href="/account">Account</a>; copies already downloaded can’t be recalled. <a href="/privacy">Read the notice</a>.</small>
    </div>}
  </section>;
}

export function JoinedEvent({ name }: { name: string }) {
  return <p className="event-joined" role="status"><FlaskConical size={16} /> This heist is part of the research event <b>{name}</b>. Manage it in <a href="/account">Account</a>.</p>;
}
