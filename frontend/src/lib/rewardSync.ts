export type MintStatus = { status: string; minted: boolean; token_id?: string; tx_hash?: string };
type Snapshot = { id: string; status: string; minted?: boolean; candy?: { state: string } };

// Artwork is usable as soon as its saved snapshot arrives. Chain availability
// must never gate displaying an already generated image or erase its state.
export async function syncReward<T extends Snapshot>(
  fetchGame: () => Promise<T>,
  fetchMint: (id: string) => Promise<MintStatus>,
  publish: (snapshot: T) => void,
  current: () => boolean,
  onChainError: () => void,
): Promise<MintStatus | undefined> {
  const game = await fetchGame();
  if (!current()) return;
  publish(game);
  if (game.status !== 'won' || game.candy?.state !== 'ready' || game.minted) return;
  try {
    const status = await fetchMint(game.id);
    if (!current()) return;
    publish({ ...game, minted: status.minted, token_id: status.token_id, tx_hash: status.tx_hash || (game as T & { tx_hash?: string }).tx_hash });
    return status;
  } catch {
    if (current()) onChainError();
  }
}
