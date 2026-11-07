import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBlockRanges } from './chainEvents';

test('event queries cover inclusive boundaries once and preserve chain order', async () => {
  const ranges: bigint[][] = [];
  const rows = await readBlockRanges(async (from, to) => {
    ranges.push([from, to]);
    await new Promise(resolve => setTimeout(resolve, from === 10n ? 5 : 0));
    return [from, to];
  }, 10n, 410n);
  assert.deepEqual(ranges, [[10n, 209n], [210n, 409n], [410n, 410n]]);
  assert.deepEqual(rows, [10n, 209n, 210n, 409n, 410n, 410n]);
});

test('RPC failures are surfaced instead of returning an incomplete collection', async () => {
  await assert.rejects(readBlockRanges(async (from) => {
    if (from === 200n) throw new Error('RPC unavailable');
    return [from];
  }, 0n, 450n), /RPC unavailable/);
});

test('ranges before deployment make no RPC requests', async () => {
  assert.deepEqual(await readBlockRanges(async () => { assert.fail('Unexpected request'); }, 10n, 9n), []);
});
