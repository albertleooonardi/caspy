import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Ghost, LoaderCircle, X } from 'lucide-react';
import { platformRequest, type Account } from '../lib/platform';
import LoadingState from './LoadingState';
import UserAvatar from './UserAvatar';
import '../styles/account-profile.css';

type Choice={ token_id:string; image_url:string|null; name:string; owner:string; grade:number };
export default function ProfilePanel({account,wallet,openWallet,onChange}:{account:Account;wallet:string;openWallet:()=>void;onChange:(user:Account)=>void}) {
  const [open,setOpen]=useState(false), [choices,setChoices]=useState<Choice[]>([]), [loading,setLoading]=useState(false), [saving,setSaving]=useState(false), [selected,setSelected]=useState(''), [error,setError]=useState(''), [notice,setNotice]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(() => { if(open) dialog.current?.showModal(); else dialog.current?.close(); },[open]);
  useEffect(() => {
    if(!open) return;
    let active=true;setError('');setSelected('');setChoices([]);
    if(!wallet) { setLoading(false);return; }
    setLoading(true);
    platformRequest<{tokens:Choice[]}>('/candy/collection').then(data => { if(active) setChoices(data.tokens.filter(item => item.owner.toLowerCase()===wallet.toLowerCase() && item.image_url)); })
      .catch(() => { if(active) setError('Your candy pictures could not load. Close this window and try again.'); })
      .finally(() => { if(active) setLoading(false); });
    return () => { active=false; };
  },[open,wallet]);
  async function save() {
    if(!selected || saving) return;
    setSaving(true);setError('');
    try { const data=await platformRequest<{user:Account}>('/account/avatar',{token_id:selected==='default' ? null : selected}); onChange(data.user);setOpen(false);setNotice('Your profile picture is saved.'); }
    catch(e) { setError(e instanceof Error ? e.message : 'Your picture could not be saved. Please try again.'); }
    finally { setSaving(false); }
  }
  return <><section className="profile-identity"><UserAvatar account={account} size={112}/><div><span className="eyebrow">YOUR PERSONAL HAUNT</span><h1>{account.name}<span className="orange-text">.</span></h1><span className="profile-role">{account.role==='researcher' ? 'Research workspace owner' : 'Contributor'}</span><button type="button" className="button button-light" onClick={() => setOpen(true)}><Camera size={17}/> Change profile picture</button></div><p>Your candy. Your character.<br/>Choose a collectible you own to make this space yours.</p></section>{notice && <p className="platform-success" role="status"><Check size={17}/>{notice}</p>}
    <dialog className="avatar-dialog" ref={dialog} onCancel={() => setOpen(false)} aria-labelledby="avatar-title"><button type="button" className="icon-button avatar-close" aria-label="Close profile picture chooser" onClick={() => setOpen(false)}><X size={20}/></button><span className="eyebrow">MAKE IT YOURS</span><h2 id="avatar-title">Choose your candy face.</h2><p>Select a candy owned by your verified wallet. This saves your picture without a transaction.</p>{!wallet && <p className="profile-wallet-hint">Connect your wallet to see your candies. <button type="button" className="text-button" onClick={() => {setOpen(false);openWallet();}}>Connect wallet</button></p>}
      {loading ? <LoadingState title="Finding your candy pictures…" detail="Checking the collectibles in your connected wallet." compact/> : <div className="avatar-choices"><button type="button" disabled={saving} aria-pressed={selected==='default'} onClick={() => setSelected('default')}><span className="avatar-default"><Ghost size={42}/></span><b>Caspy default</b>{selected==='default' && <Check size={16}/>}</button>{choices.map(item => <button type="button" disabled={saving} key={item.token_id} aria-pressed={selected===item.token_id} onClick={() => setSelected(item.token_id)}><img src={item.image_url!} alt={`Candy #${item.token_id}`} loading="lazy"/><b>Candy #{item.token_id}</b><small>Grade {['','C','B','A','S'][item.grade]}</small>{selected===item.token_id && <Check size={16}/>}</button>)}</div>}
      {!loading && wallet && !choices.length && !error && <p>No owned candy pictures yet. Win and mint a candy, or collect one in the marketplace.</p>}{error && <p className="error" role="alert">{error}</p>}<div className="avatar-dialog-actions"><button type="button" className="button button-light" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="button button-primary" disabled={!selected || saving || loading} onClick={() => void save()}>{saving ? <><LoaderCircle className="spin" size={17}/> Saving picture…</> : 'Save profile picture'}</button></div>
    </dialog></>;
}
