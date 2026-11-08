type Options = {
  refresh: () => Promise<void>;
  onError: () => void;
  visible: () => boolean;
  events: EventTarget[];
  interval?: number;
  schedule?: typeof setTimeout;
  cancel?: typeof clearTimeout;
};

// Read-only recovery: one request at a time, with bounded retry delay. Never
// retries generation, submits a transaction or changes a reward's grade.
export function autoRefresh({ refresh, onError, visible, events, interval=2500, schedule=setTimeout, cancel=clearTimeout }: Options) {
  let stopped=false, running=false, failures=0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const later = (delay: number) => { if(timer!==undefined) cancel(timer); if(!stopped) timer=schedule(() => { void tick(); },delay); };
  async function tick() {
    if(stopped || running) return;
    if(!visible()) { later(interval); return; }
    running=true;
    try { await refresh(); failures=0; }
    catch { failures++; if(!stopped) onError(); }
    finally { running=false; if(!stopped) later(Math.min(15000,interval * 2**Math.min(failures,3))); }
  }
  const resume = () => { if(visible() && !running) { if(timer!==undefined) cancel(timer); void tick(); } };
  for(const target of events) for(const name of ['visibilitychange','focus','online']) target.addEventListener(name,resume);
  later(interval);
  return () => {
    stopped=true;
    if(timer!==undefined) cancel(timer);
    for(const target of events) for(const name of ['visibilitychange','focus','online']) target.removeEventListener(name,resume);
  };
}
