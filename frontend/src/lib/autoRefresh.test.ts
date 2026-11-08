import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoRefresh } from './autoRefresh';

const flush = () => new Promise(resolve => setImmediate(resolve));
test('transient read failures recover automatically and completion can stop future checks', async () => {
  const timers = new Map<number, () => void>(); const delays: number[]=[]; let serial=0, calls=0, warnings=0;
  const schedule = ((callback: () => void, delay: number) => { delays.push(delay); timers.set(++serial,callback); return serial; }) as unknown as typeof setTimeout;
  const cancel = ((id: number) => { timers.delete(id); }) as unknown as typeof clearTimeout;
  const run = async () => { const [id,fn]=[...timers][0]; timers.delete(id); fn(); await flush(); };
  const stop=autoRefresh({ refresh:async () => { if(++calls===1) throw Error('Temporary outage'); }, onError:() => { warnings++; }, visible:() => true, events:[], schedule,cancel,interval:100 });
  await run(); assert.equal(warnings,1); assert.equal(delays.at(-1),200);
  await run(); assert.equal(calls,2); assert.equal(delays.at(-1),100);
  stop(); assert.equal(timers.size,0);
});
test('returning to a visible tab updates immediately, without overlapping requests or running after cleanup', async () => {
  const events=new EventTarget(); let visible=false, calls=0, finish!: () => void;
  const stop=autoRefresh({ refresh:() => { calls++; return new Promise<void>(resolve => { finish=resolve; }); }, onError:() => assert.fail('Unexpected error'), visible:() => visible, events:[events], interval:60000 });
  events.dispatchEvent(new Event('focus')); assert.equal(calls,0);
  visible=true; events.dispatchEvent(new Event('visibilitychange')); assert.equal(calls,1);
  events.dispatchEvent(new Event('online')); events.dispatchEvent(new Event('focus')); assert.equal(calls,1);
  stop(); finish(); await flush();
  events.dispatchEvent(new Event('online')); assert.equal(calls,1);
});
