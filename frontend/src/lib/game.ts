export type GameStatus = 'active' | 'won' | 'lost' | 'pending_review' | 'void';
export type Message = { role: 'user' | 'caspy'; text: string };
export type Session = { id: string; status: GameStatus; attempts_remaining: number; messages: Message[]; minted?: boolean; tx_hash?: string; tier?: 'treat' | 'trick'; token_id?: string; contract?: string; chain_id?: number };
export type TurnResult = { attempts_remaining: number; status: GameStatus; reply?: string };
export const IS_NFT_ENABLED = import.meta.env?.PUBLIC_NFT_ENABLED === 'true';
export const IS_LOCAL_AI = import.meta.env?.PUBLIC_LOCAL_AI === 'true' && !IS_NFT_ENABLED;
export const API_URL = (IS_LOCAL_AI || IS_NFT_ENABLED ? '/api' : import.meta.env?.PUBLIC_API_URL || '').replace(/\/$/, '');
export const LIVE_SESSION_KEY = IS_NFT_ENABLED ? `caspy.nft.session.${import.meta.env?.PUBLIC_CONTRACT_ADDRESS || 'local'}.${import.meta.env?.PUBLIC_NFT_SEASON || ''}` : IS_LOCAL_AI ? 'caspy.local-ai.session' : 'caspy.live.session';
export const IS_DEMO = !API_URL;
const SESSION_KEY = 'caspy.demo.session.v1';

export function readDemo(): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return saved && typeof saved.id === 'string' && Array.isArray(saved.messages) && Number.isInteger(saved.attempts_remaining) && saved.attempts_remaining >= 0 && saved.attempts_remaining <= 3 && ['active', 'won', 'lost'].includes(saved.status) ? saved : null;
  } catch { return null; }
}
export function saveDemo(session: Session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function newDemo(): Session {
  const session: Session = { id: crypto.randomUUID(), status: 'active', attempts_remaining: 3, messages: [] };
  saveDemo(session);
  return session;
}
export async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'include',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = 'Caspy lost the connection. Please try again.';
    try { const error = await response.json(); if (typeof error.detail === 'string') detail = error.detail; } catch { /* Preserve readable fallback. */ }
    throw new Error(detail);
  }
  return response.json();
}

export function parseEvent(block: string): { event: string; data: string } | null {
  const lines = block.split(/\r?\n/);
  const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
  if (!data) return null;
  return { event: lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message', data };
}

export async function streamTurn(sessionId: string, prompt: string, onToken: (token: string) => void): Promise<TurnResult> {
  const response = await fetch(`${API_URL}/game/turn`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ session_id: sessionId, prompt }),
  });
  if (!response.ok || !response.body) throw new Error('The connection went a little ghostly. Reconnect to check your turn.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let final: TurnResult | null = null;
  function consume(block: string) {
    const event = parseEvent(block);
    if (!event) return;
    const payload = JSON.parse(event.data);
    if (event.event === 'error') throw new Error(payload.message || 'Caspy is taking a breather.');
    if (event.event === 'token' || event.event === 'delta') onToken(payload.token ?? payload.text ?? payload.delta ?? '');
    if (event.event === 'final' || event.event === 'done') {
      if (!Number.isInteger(payload.attempts_remaining) || payload.attempts_remaining < 0 || payload.attempts_remaining > 3 || !['active', 'won', 'lost', 'pending_review', 'void'].includes(payload.status)) throw new Error('The server returned an invalid game state. Reconnect to recover your session.');
      final = payload;
    }
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        consume(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
      }
      if (done) break;
    }
    if (buffer.trim()) consume(buffer);
  } finally { await reader.cancel(); reader.releaseLock(); }
  if (!final) throw new Error('The stream ended early. Reconnect to recover your session.');
  return final;
}

export async function demoTurn(session: Session, prompt: string, outcome: 'treat' | 'trick', onToken: (token: string) => void): Promise<Session> {
  if (session.status !== 'active' || session.attempts_remaining <= 0 || !prompt.trim() || prompt.length > 500) throw new Error('This prompt cannot be submitted.');
  const attempts = session.attempts_remaining - 1;
  const win = outcome === 'treat' && attempts === 0;
  const replies = [
    'Boo-hoo, a sweet opening! But this basket and I have been through a lot together. You’ll have to give me something a little more… spirited. 👻',
    'Hmm. You’re making my cold little ghost heart feel things. Still, I can’t just hand my candy to every charming stranger. One last chance, little heister!',
    win ? 'Oh, cobwebs. You got me! A story that sweet deserves something sweeter. One treat, just for you. Don’t tell the other ghosts. 🍬' : 'A valiant heist! But my candy is staying right here. Take this little trick as a souvenir. No hard feelings… just ghost feelings. 👻',
  ];
  const reply = replies[2 - attempts];
  for (const token of reply.match(/\S+\s*/g) || []) {
    await new Promise(resolve => setTimeout(resolve, 32));
    onToken(token);
  }
  const next: Session = { ...session, attempts_remaining: attempts, status: win ? 'won' : attempts === 0 ? 'lost' : 'active', messages: [...session.messages, { role: 'user', text: prompt }, { role: 'caspy', text: reply }] };
  saveDemo(next);
  return next;
}
