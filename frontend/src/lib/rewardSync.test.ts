import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncReward, type MintStatus } from './rewardSync';

const ready = { id: 'fixture', status: 'won', minted: false, candy: { state: 'ready', image_url: '/saved.png' } };
test('saved artwork becomes visible before a slow blockchain request completes', async () => {
  let finish!: (status: MintStatus) => void;
  const chain = new Promise<MintStatus>(resolve => { finish = resolve; });
  const published: unknown[] = [];
  const pending = syncReward(async () => ready, () => chain, snapshot => published.push(snapshot), () => true, () => assert.fail('Unexpected error'));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(published, [ready]);
  finish({ status: 'confirmed', minted: true, token_id: '1' });
  await pending;
  assert.equal((published[1] as { minted: boolean }).minted, true);
});
test('RPC failure preserves ready artwork and reports a recoverable sync error', async () => {
  const published: unknown[] = []; let warned = false;
  await syncReward(async () => ready, async () => { throw new Error('RPC timeout'); }, snapshot => published.push(snapshot), () => true, () => { warned = true; });
  assert.deepEqual(published, [ready]); assert.equal(warned, true);
});
test('stale wallet/page results cannot overwrite the current reward', async () => {
  await syncReward(async () => ready, async () => { assert.fail('Stale chain call'); }, () => assert.fail('Stale render'), () => false, () => assert.fail('Stale error'));
});
