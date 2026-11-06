import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chainForConfig, execute } from './nft-bridge.mjs';

test('NFT bridge permits loopback Anvil and HTTPS Base Sepolia only', () => {
  assert.equal(chainForConfig({ chain_id:31337, rpc_url:'http://127.0.0.1:8545' }).id,31337);
  assert.equal(chainForConfig({ chain_id:84532, rpc_url:'https://sepolia.base.org' }).id,84532);
  for (const config of [
    { chain_id:8453,rpc_url:'https://mainnet.base.org' },
    { chain_id:31337,rpc_url:'http://public.example:8545' },
    { chain_id:84532,rpc_url:'http://public.example' },
    { chain_id:84532,rpc_url:'https://user:password@public.example' },
  ]) assert.throws(() => chainForConfig(config));
});

test('unsupported public chain is rejected before any RPC call', async () => {
  await assert.rejects(execute({action:'wallets',config:{chain_id:8453,rpc_url:'https://mainnet.base.org'}}),/Use loopback Anvil or an HTTPS Base Sepolia RPC/);
});
