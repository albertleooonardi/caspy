import { getAddress, type Address, type Chain } from 'viem';
import { switchOrAddChain, type NetworkWallet } from './switchChain';

type AccountWallet = NetworkWallet & {
  requestAddresses(): Promise<readonly Address[]>;
  getAddresses(): Promise<readonly Address[]>;
  requestPermissions(input: { eth_accounts: Record<string, never> }): Promise<unknown>;
};

export async function accountOnChain(wallet: AccountWallet, chain: Chain, reconnect = false): Promise<Address> {
  // Permissions and the active account can change when the wallet changes networks.
  await switchOrAddChain(wallet, chain);
  if (reconnect) await wallet.requestPermissions({ eth_accounts: {} });
  const [account] = await wallet.requestAddresses();
  if (!account) throw new Error('Choose an account in MetaMask and approve access for this site.');
  if (await wallet.getChainId() !== chain.id) throw new Error('The wallet network changed. Reconnect on Base Sepolia and try again.');
  const permitted = await wallet.getAddresses();
  if (!permitted.some(address => address.toLowerCase() === account.toLowerCase())) {
    throw Object.assign(new Error('The wallet account is no longer authorized.'), { code: 4100 });
  }
  return getAddress(account);
}

export function walletErrorCode(error: unknown): number | undefined {
  let current = error;
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth++) {
    const value = current as { code?: number; cause?: unknown; data?: { originalError?: unknown } };
    if ([4001, 4100, 4902, -32002].includes(value.code ?? 0)) return value.code;
    current = value.cause || value.data?.originalError;
  }
  return undefined;
}

export function walletErrorMessage(error: unknown): string {
  switch (walletErrorCode(error)) {
    case 4100: return 'MetaMask has not authorized this account for Caspy. Click Reconnect wallet, approve account access on Base Sepolia, then retry the deployment.';
    case 4001: return 'The wallet request was cancelled. You can retry when ready.';
    case -32002: return 'A MetaMask request is already pending. Open MetaMask and finish or reject that request before retrying.';
    case 4902: return 'Base Sepolia has not been added to the wallet. Reconnect and approve adding the network.';
  }
  const value = error as { shortMessage?: unknown; message?: unknown } | null;
  const text = typeof value?.shortMessage === 'string' ? value.shortMessage : typeof value?.message === 'string' ? value.message : 'The wallet operation did not complete. Check MetaMask and try again.';
  // Provider errors may contain the entire contract bytecode and RPC arguments.
  return text.split(/\n|Request Arguments:|Details:/)[0].replace(/0x[0-9a-f]{80,}/gi, '[transaction data omitted]').trim().slice(0, 280) || 'The wallet operation did not complete. Reconnect and try again.';
}
