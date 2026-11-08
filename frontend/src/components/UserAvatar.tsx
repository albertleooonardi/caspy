import { useEffect, useState } from 'react';
import { Ghost } from 'lucide-react';
import type { Account } from '../lib/platform';
import '../styles/process-feedback.css';
export default function UserAvatar({ account, size=44 }: { account: Account; size?: number }) {
  const [failed,setFailed]=useState(false);
  useEffect(() => setFailed(false),[account.avatar_url]);
  return <span className="user-avatar" style={{width:size,height:size}}>{account.avatar_url && !failed ? <img src={account.avatar_url} alt={`${account.name}’s chosen candy profile picture`} onError={() => setFailed(true)}/> : <Ghost aria-label={`${account.name}’s profile`} size={Math.round(size*.5)}/>}</span>;
}
