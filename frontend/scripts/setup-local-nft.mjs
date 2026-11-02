import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createPublicClient, createWalletClient, http } from 'viem';
import { foundry } from 'viem/chains';
import { execute } from './nft-bridge.mjs';

const root = new URL('../../', import.meta.url);
const rpc_url = process.env.CASPY_NFT_RPC || 'http://127.0.0.1:8545';
const client = createPublicClient({ chain: foundry, transport: http(rpc_url) });
if (await client.getChainId() !== 31337) throw new Error('Expected local chain 31337.');
const wallet = createWalletClient({ chain: foundry, transport: http(rpc_url) });
const accounts = await wallet.getAddresses();
if (accounts.length < 3) throw new Error('Start Anvil with its default local test accounts.');
const target = process.env.CASPY_NFT_CONFIG || new URL('data/nft-local.json', root);
try {
  const existing = JSON.parse(await readFile(target, 'utf8'));
  await execute({ action: 'check', config: existing });
  const deploymentBlock = await client.getBlock({ blockNumber: BigInt(existing.deployment_block) });
  if (deploymentBlock.hash !== existing.deployment_block_hash) throw new Error('Local chain was reset.');
  console.log(`Local Caspy NFT contract ready: ${existing.contract}`);
  process.exit(0);
} catch { /* First deployment or a reset local chain. */ }
const artifact = JSON.parse(await readFile(new URL('blockhain/out/CaspyHeist.sol/CaspyHeist.json', root), 'utf8'));
const hash = await wallet.deployContract({ account: accounts[0], abi: artifact.abi, bytecode: artifact.bytecode.object, args: ["Caspy's Treats", 'CASPY', accounts[1], 'http://localhost:4321/api/metadata/', 1000n] });
const receipt = await client.waitForTransactionReceipt({ hash });
if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error('Deployment failed.');
const config = { chain_id: 31337, rpc_url, contract: receipt.contractAddress, signer: accounts[1], player: accounts[2], deployment_block: String(receipt.blockNumber), deployment_block_hash: receipt.blockHash };
await mkdir(new URL('data/', root), { recursive: true });
await writeFile(target, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
await execute({ action: 'check', config });
console.log(`Local Caspy NFT deployed: ${config.contract}`);
console.log(`Test wallet: ${config.player} (unlocked local Anvil account; no real funds)`);
