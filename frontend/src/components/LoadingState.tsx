import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import '../styles/process-feedback.css';

export default function LoadingState({ title='Loading your saved details…', detail='Your saved progress stays safe while we connect.', compact=false }: { title?: string; detail?: string; compact?: boolean }) {
  const [slow,setSlow]=useState(false);
  useEffect(() => { setSlow(false); const timer=setTimeout(() => setSlow(true),8000); return () => clearTimeout(timer); },[title]);
  return <div className={`loading-state ${compact ? 'compact' : ''}`} role="status" aria-live="polite"><LoaderCircle className="spin" size={compact ? 20 : 28} aria-hidden="true"/><div><b>{title}</b><p>{slow ? 'This is taking a little longer than usual. We’re still waiting for a response; please keep this page open.' : detail}</p></div>{!compact && <div className="loading-skeleton" aria-hidden="true"><i/><i/><i/></div>}</div>;
}
