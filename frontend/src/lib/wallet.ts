import { createPublicClient, createWalletClient, custom, getAddress, http, type EIP1193Provider } from 'viem';
import { base, foundry } from 'viem/chains';
import { createSiweMessage } from 'viem/siwe';
import { request } from './game';
import { caspyAbi } from './contract';

declare global { interface Window { ethereum?: EIP1193Provider } }
export const LOCAL_NFT = import.meta.env.PUBLIC_NFT_ENABLED === 'true';
export const HEIST_CHAIN = LOCAL_NFT ? foundry : base;
export const HEIST_RPC = LOCAL_NFT ? 'http://127.0.0.1:8545' : 'https://mainnet.base.org';
// The test wallet is available only on loopback and chain 31337.
function useLocalWallet() {
  return LOCAL_NFT && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}
function walletClient() {
  if (useLocalWallet()) return createWalletClient({ chain: foundry, transport: http(HEIST_RPC) });
  if (!window.ethereum) throw new Error('No browser wallet found. Open this site in your wallet’s browser, or install a compatible wallet.');
  return createWalletClient({ chain: HEIST_CHAIN, transport: custom(window.ethereum) });
}
async function accountAndNetwork() {
  const client = walletClient();
  const account = useLocalWallet() ? (await client.getAddresses())[2] : (await client.requestAddresses())[0];
  if (!account) throw new Error('Choose an account in your wallet to continue.');
  if (await client.getChainId() !== HEIST_CHAIN.id) await client.switchChain({ id: HEIST_CHAIN.id });
  return { client, account };
}
export async function authenticateWallet(): Promise<string> {
  const { client, account } = await accountAndNetwork();
  const { nonce } = await request<{ nonce: string }>('/auth/nonce', { address: account, chain_id: HEIST_CHAIN.id });
  const message = createSiweMessage({ address: getAddress(account), chainId: HEIST_CHAIN.id, domain: window.location.host, uri: window.location.origin, version: '1', nonce, statement: 'Sign in to Caspy’s Prompt Heist. This does not authorize a transaction.', issuedAt: new Date() });
  const signature = await client.signMessage({ account, message });
  await request('/auth/verify', { message, signature });
  return account;
}

export type Voucher = { to: `0x${string}`; tier: number; sessionId: `0x${string}`; nonce: string; deadline: string; chainId: number; contract: `0x${string}`; signature: `0x${string}` };
export async function mintVoucher(voucher: Voucher): Promise<`0x${string}`> {
  if (voucher.chainId !== HEIST_CHAIN.id) throw new Error('This voucher is for a different network.');
  const expected = import.meta.env.PUBLIC_CONTRACT_ADDRESS;
  if (!expected || voucher.contract.toLowerCase() !== expected.toLowerCase()) throw new Error('The claim contract has not been configured or does not match the voucher.');
  if (![0, 1].includes(voucher.tier) || BigInt(voucher.deadline) <= BigInt(Math.floor(Date.now() / 1000))) throw new Error('The voucher is invalid or expired. Refresh to request another.');
  const { client, account } = await accountAndNetwork();
  if (account.toLowerCase() !== voucher.to.toLowerCase()) throw new Error('Connect the wallet that played this heist.');
  const publicClient = createPublicClient({ chain: HEIST_CHAIN, transport: http(HEIST_RPC) });
  const { request: transaction } = await publicClient.simulateContract({
    account, address: voucher.contract, abi: caspyAbi, functionName: 'mintWithVoucher',
    args: [voucher.to, BigInt(voucher.tier), voucher.sessionId, BigInt(voucher.nonce), BigInt(voucher.deadline), voucher.signature],
  });
  return client.writeContract(transaction);
}
