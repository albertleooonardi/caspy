import type { Chain } from 'viem';

export type NetworkWallet = {
  getChainId(): Promise<number>;
  switchChain(input: { id: number }): Promise<unknown>;
  addChain(input: { chain: Chain }): Promise<unknown>;
};

function missingChain(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 8 && current && typeof current === 'object'; depth++) {
    const value = current as { code?: number; cause?: unknown; data?: { originalError?: unknown } };
    if (value.code === 4902) return true;
    current = value.cause || value.data?.originalError;
  }
  return false;
}

export async function switchOrAddChain(wallet: NetworkWallet, chain: Chain): Promise<void> {
  if (await wallet.getChainId() === chain.id) return;
  try {
    await wallet.switchChain({ id: chain.id });
  } catch (error) {
    if (!missingChain(error)) throw error;
    // addChain and switchChain both display the wallet's own approval prompts.
    await wallet.addChain({ chain });
    await wallet.switchChain({ id: chain.id });
  }
}
