// Prepare public deployment artifacts and a NEW, unfunded voucher-only signer.
// This script never broadcasts a transaction or prints private key material.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256 } from 'viem';

const root = new URL('../../', import.meta.url);
const folder = new URL('data/credentials/', root);
const keyFile = new URL('base-sepolia-signer.env', folder);
await mkdir(folder, { recursive:true, mode:0o700 });
let key;
try {
  key = (await readFile(keyFile,'utf8')).trim().split('=')[1];
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  key = '0x' + randomBytes(32).toString('hex');
  await writeFile(keyFile, `CASPY_NFT_SIGNER_PRIVATE_KEY=${key}\n`, { mode:0o600, flag:'wx' });
}
const signer = privateKeyToAccount(key).address;
const candy = JSON.parse(await readFile(new URL('blockhain/out/CaspyHeist.sol/CaspyHeist.json', root),'utf8'));
const market = JSON.parse(await readFile(new URL('blockhain/out/CaspyCandyMarket.sol/CaspyCandyMarket.json', root),'utf8'));
const artifacts = { chain_id:84532, signer,
  candy:{ abi:candy.abi, bytecode:candy.bytecode.object, hash:keccak256(candy.bytecode.object) },
  market:{ abi:market.abi, bytecode:market.bytecode.object, hash:keccak256(market.bytecode.object) } };
await mkdir(new URL('frontend/public/deployment/',root),{recursive:true});
await writeFile(new URL('frontend/public/deployment/base-sepolia.json',root),JSON.stringify(artifacts));
console.log(`Base Sepolia artifacts ready. Voucher signer: ${signer}`);
console.log('Private signer is in ignored data/credentials/base-sepolia-signer.env (0600). Never upload it to the frontend or paste it into chat.');
