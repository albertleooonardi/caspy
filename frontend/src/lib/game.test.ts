import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoTurn, newDemo, parseEvent, readDemo, streamTurn } from './game';

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
