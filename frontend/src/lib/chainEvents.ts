// Public Base Sepolia RPC limits each event query to 200 blocks.
// Keep a fixed head and non-overlapping inclusive ranges; never hide RPC errors.
export async function readBlockRanges<T>(
  fetchRange: (fromBlock: bigint, toBlock: bigint) => Promise<T[]>,
  fromBlock: bigint,
  toBlock: bigint,
  rangeSize = 200n,
): Promise<T[]> {
  if (rangeSize < 1n) throw new Error('Block range size must be positive.');
  const result: T[] = [];
  let next = fromBlock;
  while (next <= toBlock) {
    const batch: Promise<T[]>[] = [];
    for (let i = 0; i < 4 && next <= toBlock; i++) {
      const end = next + rangeSize - 1n < toBlock ? next + rangeSize - 1n : toBlock;
      batch.push(fetchRange(next, end));
      next = end + 1n;
    }
    for (const rows of await Promise.all(batch)) result.push(...rows);
  }
  return result;
}
