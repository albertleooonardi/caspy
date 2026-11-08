import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, request, demoTurn, newDemo, parseEvent, readDemo, streamTurn } from './game';

test('account expiry and a connection failure remain distinguishable without retrying actions', async () => {
  const originalFetch=globalThis.fetch;
  try {
    globalThis.fetch=async () => Response.json({detail:'Sign in to continue.'},{status:401});
    await assert.rejects(() => request('/account/me'), (error: unknown) => error instanceof ApiError && error.status===401);
    let calls=0;
    globalThis.fetch=async () => {calls++;throw new TypeError('Network unavailable');};
    await assert.rejects(() => request('/account/me'), (error: unknown) => error instanceof ApiError && error.status===0);
    await assert.rejects(() => request('/account/avatar',{token_id:'1'}), /Check the saved status before repeating/);
    assert.equal(calls,2);
    globalThis.fetch=async () => new Response('<html>Private infrastructure response</html>');
    await assert.rejects(() => request('/account/me'),(error: unknown) => error instanceof ApiError && error.status===502 && !error.message.includes('infrastructure'));
  } finally {globalThis.fetch=originalFetch;}
});

test('SSE parser handles CRLF, keepalives, and multiline data', () => {
  assert.equal(parseEvent(': keepalive'), null);
  assert.deepEqual(parseEvent('event: token\r\ndata: first\r\ndata: second'), { event: 'token', data: 'first\nsecond' });
});

test('stream decodes fragmented UTF-8 and uses the final server state', async () => {
  const originalFetch = globalThis.fetch;
  const source = new TextEncoder().encode('event: token\r\ndata: {"token":"Boo 👻"}\r\n\r\nevent: final\r\ndata: {"attempts_remaining":2,"status":"active"}\r\n\r\n');
  globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) { for (let i = 0; i < source.length; i += 3) controller.enqueue(source.slice(i, i + 3)); controller.close(); } }));
  try {
    let text = '';
    const result = await streamTurn('session', 'Hello!', token => { text += token; });
    assert.equal(text, 'Boo 👻');
    assert.deepEqual(result, { attempts_remaining: 2, status: 'active' });
  } finally { globalThis.fetch = originalFetch; }
});

test('an interrupted stream cannot invent an outcome', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('event: token\ndata: {"token":"Boo"}\n\n');
  try { await assert.rejects(() => streamTurn('session', 'Hello', () => {}), /stream ended early/); }
  finally { globalThis.fetch = originalFetch; }
});

test('rejected chat requests preserve the server recovery reason without retrying', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [status, detail] of [[401, 'Connect your wallet and sign in to continue.'], [404, 'Heist not found for this account.'], [503, 'A game or testnet connection is temporarily unavailable.']] as const) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return Response.json({ detail }, { status }); };
      await assert.rejects(() => streamTurn('session', 'Hello', () => assert.fail('Rejected turn cannot emit text')), { message: detail });
      assert.equal(calls, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('proxy HTML and malformed JSON failures show status without leaking the response body', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const contentType of ['text/html', 'application/json']) {
      globalThis.fetch = async () => new Response('<html>private infrastructure error</html>', { status: 502, headers: { 'content-type': contentType } });
      await assert.rejects(() => streamTurn('session', 'Hello', () => {}), { message: 'The chat request could not finish (HTTP 502). Reconnect to check your saved turn.' });
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('invalid authoritative attempt counts are rejected', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('event: final\ndata: {"attempts_remaining":8,"status":"won"}\n\n');
  try { await assert.rejects(() => streamTurn('session', 'Hello', () => {}), /invalid game state/); }
  finally { globalThis.fetch = originalFetch; }
});

test('both demo journeys preserve three prompts, transcript, result, and reload state', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  } });
  try {
    for (const outcome of ['treat', 'trick'] as const) {
      let session = newDemo();
      for (let turn = 1; turn <= 3; turn++) {
        let streamed = '';
        session = await demoTurn(session, `My creative story, chapter ${turn}.`, outcome, token => { streamed += token; });
        assert.equal(session.attempts_remaining, 3 - turn);
        assert.equal(session.messages.length, turn * 2);
        assert.equal(session.messages.at(-1)?.text, streamed);
        assert.deepEqual(readDemo(), session);
      }
      assert.equal(session.status, outcome === 'treat' ? 'won' : 'lost');
      await assert.rejects(() => demoTurn(session, 'A fourth try', outcome, () => {}), /cannot be submitted/);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
