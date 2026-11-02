// JSON stdin/stdout bridge. No private keys: signing is restricted to unlocked
// test accounts on the loopback Anvil chain. Never usable on a public network.
import { createPublicClient, createWalletClient, decodeFunctionData, getAddress, http, keccak256, toBytes, recoverMessageAddress } from 'viem';
import { foundry } from 'viem/chains';
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import { caspyAbi, voucherTypes } from '../src/lib/contract.ts';

export async function execute(input) {
  const { action, config } = input;
  const url = new URL(config.rpc_url);
  if (config.chain_id !== 31337 || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol !== 'http:') throw new Error('Local NFT mode requires loopback Anvil, chain 31337.');
  const client = createPublicClient({ chain: foundry, transport: http(config.rpc_url, { timeout: 10000, retryCount: 0 }) });
  if (await client.getChainId() !== 31337) throw new Error('Wrong chain.');
  const contract = getAddress(config.contract);
  const read = (functionName, args = []) => client.readContract({ address: contract, abi: caspyAbi, functionName, args });
  const sessionId = input.session_id ? keccak256(toBytes(input.session_id)) : undefined;
  if (action === 'check') {
    const role = await read('SIGNER_ROLE');
    if (!(await read('hasRole', [role, config.signer]))) throw new Error('Signer role missing.');
    return { ready: true };
  }
  if (action === 'verify') {
    const parsed = parseSiweMessage(input.message);
    const age = Date.now() - parsed.issuedAt?.getTime();
    if (!validateSiweMessage({ message: parsed, address: input.address, domain: input.domain, nonce: input.nonce }) || parsed.chainId !== 31337 || parsed.version !== '1' || parsed.uri !== input.origin || !Number.isFinite(age) || age < -60000 || age > 300000) throw new Error('Invalid sign-in message.');
    const recovered = await recoverMessageAddress({ message: input.message, signature: input.signature });
    if (getAddress(recovered) !== getAddress(input.address)) throw new Error('Invalid signature.');
    return { address: getAddress(recovered) };
  }
  if (action === 'sign') {
    if (await read('usedSessions', [sessionId])) throw new Error('This session already minted.');
    if (await read('paused')) throw new Error('Contract is paused.');
    if (input.tier === 0 && await read('treatMinted') >= await read('treatSupply')) throw new Error('Treat supply exhausted.');
    const wallet = createWalletClient({ chain: foundry, transport: http(config.rpc_url, { retryCount: 0 }) });
    const domain = { name: await read('name'), version: '1', chainId: 31337, verifyingContract: contract };
    const message = { to: getAddress(input.to), tier: BigInt(input.tier), sessionId, nonce: BigInt(input.nonce), deadline: BigInt(input.deadline), chainId: 31337n, verifyingContract: contract };
    const signature = await wallet.signTypedData({ account: getAddress(config.signer), domain, types: voucherTypes, primaryType: 'Voucher', message });
    return { to: message.to, tier: input.tier, sessionId, nonce: String(input.nonce), deadline: String(input.deadline), chainId: 31337, contract, signature };
  }
  if (action === 'status') {
    if (input.tx_hash) {
      const tx = await client.getTransaction({ hash: input.tx_hash });
      const decoded = decodeFunctionData({ abi: caspyAbi, data: tx.input });
      if (tx.to?.toLowerCase() !== contract.toLowerCase() || tx.from.toLowerCase() !== input.to.toLowerCase() || decoded.functionName !== 'mintWithVoucher' || decoded.args[0].toLowerCase() !== input.to.toLowerCase() || decoded.args[1] !== BigInt(input.tier) || decoded.args[2] !== sessionId) throw new Error('Transaction does not belong to this heist.');
      if (tx.blockNumber === null) return { status: 'pending', tx_hash: input.tx_hash };
      const receipt = await client.getTransactionReceipt({ hash: input.tx_hash });
      if (receipt.status === 'reverted') return { status: 'failed', tx_hash: input.tx_hash };
    }
    const logs = await client.getContractEvents({ address: contract, abi: caspyAbi, eventName: 'MintWithVoucher', args: { to: getAddress(input.to) }, fromBlock: BigInt(config.deployment_block), toBlock: 'latest', strict: true });
    const event = logs.find(log => log.args.sessionId === sessionId && log.args.tier === BigInt(input.tier));
    return event ? { status: 'confirmed', minted: true, tx_hash: event.transactionHash, token_id: String(event.args.tokenId), contract, chain_id: 31337 } : { status: 'pending', minted: false, ...(input.tx_hash ? { tx_hash: input.tx_hash } : {}) };
  }
  throw new Error('Unknown NFT action.');
}

if (process.argv[1]?.endsWith('nft-bridge.mjs')) {
  try {
    let data = '';
    for await (const chunk of process.stdin) { data += chunk; if (data.length > 32768) throw new Error('Input too large.'); }
    console.log(JSON.stringify(await execute(JSON.parse(data))));
  } catch {
    console.log(JSON.stringify({ error: 'NFT operation failed. Check the local chain, wallet signature, and contract configuration.' }));
    process.exitCode = 1;
  }
}
