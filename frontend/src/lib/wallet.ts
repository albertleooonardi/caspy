import { createPublicClient, createWalletClient, custom, getAddress, http, type EIP1193Provider } from 'viem';
import { base, baseSepolia, foundry } from 'viem/chains';
import { createSiweMessage } from 'viem/siwe';
import { request } from './game';
import { caspyAbi, marketAbi } from './contract';

declare global { interface Window { ethereum?: EIP1193Provider } }
export const LOCAL_NFT = import.meta.env.PUBLIC_NFT_ENABLED === 'true';
const chainId = Number(import.meta.env.PUBLIC_NFT_CHAIN_ID || '31337');
if (LOCAL_NFT && ![31337, 84532].includes(chainId)) throw new Error('Only local Anvil and Base Sepolia are supported for candy NFTs.');
export const LOCAL_TEST_WALLET = LOCAL_NFT && chainId === 31337;
export const HEIST_CHAIN = LOCAL_NFT ? (LOCAL_TEST_WALLET ? foundry : baseSepolia) : base;
export const HEIST_RPC = import.meta.env.PUBLIC_NFT_RPC_URL || (LOCAL_NFT ? (LOCAL_TEST_WALLET ? 'http://127.0.0.1:8545' : 'https://sepolia.base.org') : 'https://mainnet.base.org');
export const CANDY_NETWORK = LOCAL_TEST_WALLET ? 'Local Anvil' : 'Base Sepolia';
// The test wallet is available only on loopback and chain 31337.
function useLocalWallet() {
  return LOCAL_TEST_WALLET && ['localhost', '127.0.0.1'].includes(window.location.hostname);
}
function walletClient() {
  if (useLocalWallet()) return createWalletClient({ chain: HEIST_CHAIN, transport: http(HEIST_RPC) });
  if (LOCAL_TEST_WALLET) throw new Error('Local test wallets are available only on localhost.');
  if (!window.ethereum) throw new Error('No browser wallet found. Open this site in your wallet’s browser, or install a compatible wallet.');
  return createWalletClient({ chain: HEIST_CHAIN, transport: custom(window.ethereum) });
}
async function accountAndNetwork(selectedAddress?: string) {
  const client = walletClient();
  const addresses = useLocalWallet() ? (await client.getAddresses()).slice(2) : await client.requestAddresses();
  const account = useLocalWallet() && selectedAddress ? addresses.find(address => address.toLowerCase() === selectedAddress.toLowerCase()) : addresses[0];
  if (!account) throw new Error('Choose an account in your wallet to continue.');
  if (await client.getChainId() !== HEIST_CHAIN.id) await client.switchChain({ id: HEIST_CHAIN.id });
  return { client, account };
}
export async function authenticateWallet(selectedAddress?: string): Promise<string> {
  const { client, account } = await accountAndNetwork(selectedAddress);
  const { nonce } = await request<{ nonce: string }>('/auth/nonce', { address: account, chain_id: HEIST_CHAIN.id });
  const message = createSiweMessage({ address: getAddress(account), chainId: HEIST_CHAIN.id, domain: window.location.host, uri: window.location.origin, version: '1', nonce, statement: 'Sign in to Caspy’s Prompt Heist. This does not authorize a transaction.', issuedAt: new Date() });
  const signature = await client.signMessage({ account, message });
  await request('/auth/verify', { message, signature });
  return account;
}

export type Voucher = { to: `0x${string}`; grade: number; score: number; sessionId: `0x${string}`; promptHash: `0x${string}`; imageHash: `0x${string}`; metadataHash: `0x${string}`; uriHash: `0x${string}`; uri: string; nonce: string; deadline: string; chainId: number; contract: `0x${string}`; signature: `0x${string}` };
export async function mintVoucher(voucher: Voucher): Promise<`0x${string}`> {
  if (voucher.chainId !== HEIST_CHAIN.id || !LOCAL_NFT) throw new Error('Use the configured candy test network.');
  const expected = import.meta.env.PUBLIC_CONTRACT_ADDRESS;
  if (!expected || voucher.contract.toLowerCase() !== expected.toLowerCase()) throw new Error('The candy contract does not match the voucher.');
  const { client, account } = await accountAndNetwork(voucher.to);
  if (account.toLowerCase() !== voucher.to.toLowerCase()) throw new Error('Connect the wallet that earned this candy.');
  const publicClient = createPublicClient({ chain: HEIST_CHAIN, transport: http(HEIST_RPC) });
  const { request: transaction } = await publicClient.simulateContract({
    account, address: voucher.contract, abi: caspyAbi, functionName: 'mintCandy',
    args: [{ ...voucher, nonce: BigInt(voucher.nonce), deadline: BigInt(voucher.deadline) }, voucher.uri, voucher.signature],
  });
  return client.writeContract(transaction);
}
export const PROMPT_LICENSE = 'Non-exclusive access to the redacted source prompt for personal use and evaluation by the NFT owner, with onward access on NFT resale. No copyright transfer or exclusivity. Previously delivered copies cannot be recalled.';
export type CandyTrade = 'list' | 'buy' | 'cancel' | 'withdraw';
export async function tradeCandy(action: CandyTrade, address: string, contract: `0x${string}`, market: `0x${string}`, tokenId = '0', listingId = '0', priceWei = '0', licensed = false) {
  if (!LOCAL_NFT || contract.toLowerCase() !== String(import.meta.env.PUBLIC_CONTRACT_ADDRESS).toLowerCase() || market.toLowerCase() !== String(import.meta.env.PUBLIC_MARKET_ADDRESS).toLowerCase()) throw new Error('Use the configured candy marketplace.');
  const { client, account } = await accountAndNetwork(address);
  if (account.toLowerCase() !== address.toLowerCase()) throw new Error('Reconnect your verified wallet.');
  const pub = createPublicClient({ chain: HEIST_CHAIN, transport: http(HEIST_RPC) });
  async function confirmed(hash: `0x${string}`) {
    const receipt = await pub.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Transaction reverted. Reload to check your asset.');
  }
  if (action === 'list') {
    if (BigInt(priceWei) <= 0n) throw new Error('Enter a positive price.');
    if (!licensed) await confirmed(await client.writeContract({ account, address: contract, abi: caspyAbi, functionName: 'licensePrompt', args: [BigInt(tokenId), PROMPT_LICENSE] }));
    await confirmed(await client.writeContract({ account, address: contract, abi: caspyAbi, functionName: 'approve', args: [market, BigInt(tokenId)] }));
    await confirmed(await client.writeContract({ account, address: market, abi: marketAbi, functionName: 'list', args: [BigInt(tokenId), BigInt(priceWei)] }));
  } else if (action === 'buy') {
    await confirmed(await client.writeContract({ account, address: market, abi: marketAbi, functionName: 'buy', args: [BigInt(listingId)], value: BigInt(priceWei) }));
  } else if (action === 'cancel') {
    await confirmed(await client.writeContract({ account, address: market, abi: marketAbi, functionName: 'cancel', args: [BigInt(listingId)] }));
  } else await confirmed(await client.writeContract({ account, address: market, abi: marketAbi, functionName: 'withdraw' }));
}
