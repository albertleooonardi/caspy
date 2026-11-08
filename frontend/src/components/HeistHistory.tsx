import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Ghost, LoaderCircle } from 'lucide-react';
import { platformRequest } from '../lib/platform';
import type { Message } from '../lib/game';
import '../styles/heist-history.css';

type Record = { session_id: string; campaign_name: string | null; created: number };
type Detail = { id: string; created: number; status: string; current_season: boolean; attempts_remaining: number; messages: Message[]; minted: boolean; token_id: string | null; reward: { state: string; grade: string; score: number; token_id: string | null } | null };
const date = (value: number) => new Intl.DateTimeFormat('en-GB', { timeZone:'Asia/Jakarta', dateStyle:'medium', timeStyle:'short' }).format(new Date(value * 1000));
const outcomes: { [key: string]: string } = { active:'In progress', won:'Won', lost:'Completed without candy', pending_review:'Under review', void:'Interrupted' };

export default function HeistHistory() {
  const [records,setRecords]=useState<Record[]>([]), [selected,setSelected]=useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(location.search).get('session') || '');
  const [detail,setDetail]=useState<Detail|null>(null), [loading,setLoading]=useState(true), [opening,setOpening]=useState(false), [error,setError]=useState('');
  useEffect(() => {
    let active=true;
    platformRequest<{ contributions: Record[] }>('/account/contributions').then(data => {
      if (!active) return;
      setRecords(data.contributions);
      setSelected(previous => previous || data.contributions[0]?.session_id || '');
    }).catch(() => { if(active) setError('Your recorded heists could not load. Please try again later.'); }).finally(() => { if(active) setLoading(false); });
    return () => { active=false; };
  }, []);
  useEffect(() => {
    if(!selected) return;
    let active=true; setOpening(true);setDetail(null);setError('');
    platformRequest<Detail>(`/account/heists/${encodeURIComponent(selected)}`).then(data => { if(active) setDetail(data); })
      .catch(e => { if(active) setError(e instanceof Error ? e.message : 'The conversation could not load.'); })
      .finally(() => { if(active) setOpening(false); });
    return () => { active=false; };
  }, [selected]);
  function select(id: string) { setSelected(id); history.replaceState(null,'',`/heists?session=${encodeURIComponent(id)}`); }
  return <div className="shell heist-history"><a className="back-link" href="/dashboard"><ArrowLeft size={16}/> Back to dashboard</a><span className="eyebrow">YOUR SAVED STORIES</span><h1>Heist history<span className="orange-text">.</span></h1><p>Your conversations, outcomes and earned rewards. Only you can view these records.</p>
    {loading ? <p role="status"><LoaderCircle className="spin" size={18}/> Loading your history…</p> : <div className="history-layout"><nav className="history-list" aria-label="Recorded heists">{records.map((row,index) => <button type="button" key={row.session_id} aria-current={selected===row.session_id ? 'true' : undefined} onClick={() => select(row.session_id)}><Ghost size={20}/><span><b>Heist {records.length-index}</b><small>{date(row.created)} WIB</small><small>{row.campaign_name || 'Independent heist'}</small></span></button>)}{!records.length && <p>No recorded heists yet. <a href="/play">Start your first heist.</a></p>}</nav><section className="history-detail" aria-label="Heist details" aria-busy={opening}>
      {opening && <p role="status"><LoaderCircle className="spin" size={18}/> Opening your conversation…</p>}{error && <p className="error" role="alert">{error}</p>}
      {detail && <><header><h2>{outcomes[detail.status] || 'Recorded heist'}</h2><p>{date(detail.created)} WIB · {3-detail.attempts_remaining} of 3 prompts used{!detail.current_season && ' · Earlier season'}</p>{detail.reward && <p className="history-reward">Grade {detail.reward.grade} · {detail.reward.score}/100{detail.reward.token_id ? ` · Candy #${detail.reward.token_id}` : ` · ${detail.reward.state.replaceAll('_',' ')}`}</p>}{detail.current_season && <a className="button button-light" href={`${detail.status==='won' ? '/claim' : '/play'}?session=${encodeURIComponent(detail.id)}`}>{detail.status==='won' ? 'Open reward' : 'Open heist'} <ArrowUpRight size={16}/></a>}</header><ol className="history-messages">{detail.messages.map((item,index) => <li key={index} data-role={item.role}><b>{item.role==='user' ? 'You' : 'Caspy'}</b><p>{item.text}</p></li>)}</ol>{!detail.messages.length && <p>No prompts were sent in this heist.</p>}</>}
    </section></div>}
  </div>;
}
