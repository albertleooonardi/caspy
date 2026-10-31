import { createWalletClient, custom, getAddress, type EIP1193Provider } from 'viem';
import { base } from 'viem/chains';
import { createSiweMessage } from 'viem/siwe';
import { request } from './game';

declare global { interface Window { ethereum?: EIP1193Provider } }
export async function authenticateWallet(): Promise<string> {
  if (!window.ethereum) throw new Error('No browser wallet found. Open this site in your wallet’s browser, or install a compatible wallet.');
  const client = createWalletClient({ chain: base, transport: custom(window.ethereum) });
  const [account] = await client.requestAddresses();
  if (!account) throw new Error('Choose an account in your wallet to continue.');
  const chainId = await client.getChainId();
  if (chainId !== base.id) await client.switchChain({ id: base.id });
  const { nonce } = await request<{ nonce: string }>('/auth/nonce', { address: account, chain_id: base.id });
  const message = createSiweMessage({ address: getAddress(account), chainId: base.id, domain: window.location.host, uri: window.location.origin, version: '1', nonce, statement: 'Sign in to Caspy’s Prompt Heist. This does not authorize a transaction.', issuedAt: new Date() });
  const signature = await client.signMessage({ account, message });
  await request('/auth/verify', { message, signature });
  return account;
}

export type Voucher = { to: `0x${string}`; tier: number; sessionId: `0x${string}`; nonce: string; deadline: string; chainId: number; contract: `0x${string}`; signature: `0x${string}` };
export async function mintVoucher(voucher: Voucher): Promise<`0x${string}`> {
  if (!window.ethereum) throw new Error('Reconnect your wallet to claim.');
  if (voucher.chainId !== base.id) throw new Error('This voucher is for a different network.');
  const expected = import.meta.env.PUBLIC_CONTRACT_ADDRESS;
  if (!expected || voucher.contract.toLowerCase() !== expected.toLowerCase()) throw new Error('The claim contract has not been configured or does not match the voucher.');
  const client = createWalletClient({ chain: base, transport: custom(window.ethereum) });
  const [account] = await client.requestAddresses();
  if (account?.toLowerCase() !== voucher.to.toLowerCase()) throw new Error('Connect the wallet that played this heist.');
  if (await client.getChainId() !== base.id) await client.switchChain({ id: base.id });
  return client.writeContract({
    account, address: voucher.contract, functionName: 'mintWithVoucher',
    abi: [{ type: 'function', name: 'mintWithVoucher', stateMutability: 'nonpayable', inputs: [{ name: 'v', type: 'tuple', components: [{ name: 'to', type: 'address' }, { name: 'tier', type: 'uint8' }, { name: 'sessionId', type: 'bytes32' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }, { name: 'chainId', type: 'uint256' }, { name: 'contract', type: 'address' }] }, { name: 'sig', type: 'bytes' }], outputs: [] }],
    args: [{ ...voucher, nonce: BigInt(voucher.nonce), deadline: BigInt(voucher.deadline), chainId: BigInt(voucher.chainId) }, voucher.signature],
  });
}
