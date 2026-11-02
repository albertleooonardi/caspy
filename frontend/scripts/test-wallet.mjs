// Test-only local wallet driver, never exposed as an API route.
import { createPublicClient, createWalletClient, http } from 'viem';
import { foundry } from 'viem/chains';
import { createSiweMessage } from 'viem/siwe';
import { caspyAbi, marketAbi } from '../src/lib/contract.ts';

let raw = '';
for await (const part of process.stdin) raw += part;
const input = JSON.parse(raw);
const url = new URL(input.rpc_url);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Test wallet requires loopback.');
const client = createPublicClient({ chain: foundry, transport: http(input.rpc_url) });
if (await client.getChainId() !== 31337) throw new Error('Test wallet requires chain 31337.');
const wallet = createWalletClient({ chain: foundry, transport: http(input.rpc_url) });
const accounts = await wallet.getAddresses();
const account = accounts[input.account_index ?? 2];
if (input.action === 'address') console.log(JSON.stringify({ address: account }));
else if (input.action === 'sign-in') {
  const message = createSiweMessage({ address: account, chainId: 31337, domain: 'localhost:4321', uri: 'http://localhost:4321', version: '1', nonce: input.nonce, issuedAt: new Date() });
  const signature = await wallet.signMessage({ account, message });
  console.log(JSON.stringify({ message, signature }));
} else if (input.action === 'mint') {
  const v = input.voucher;
  const args = [{ ...v, nonce: BigInt(v.nonce), deadline: BigInt(v.deadline) }, v.uri, v.signature];
  const { request } = await client.simulateContract({ account, address: v.contract, abi: caspyAbi, functionName: 'mintCandy', args });
  const hash = await wallet.writeContract(request);
  await client.waitForTransactionReceipt({ hash });
  console.log(JSON.stringify({ hash }));
} else if (input.action === 'write') {
  const abi = input.market ? marketAbi : caspyAbi;
  const args = (input.args || []).map(value => typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : value);
  const { request } = await client.simulateContract({ account, address: input.contract, abi, functionName: input.function_name, args, ...(input.value ? { value: BigInt(input.value) } : {}) });
  const hash = await wallet.writeContract(request); await client.waitForTransactionReceipt({ hash }); console.log(JSON.stringify({ hash }));
} else throw new Error('Unknown test action.');
