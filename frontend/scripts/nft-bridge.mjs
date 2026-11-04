// Local Anvil-only cryptographic/chain bridge. No private keys or paid RPC calls.
import { createPublicClient, createWalletClient, decodeFunctionData, getAddress, http, keccak256, toBytes, recoverMessageAddress } from 'viem';
import { foundry } from 'viem/chains';
import { parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import { caspyAbi, voucherTypes, marketAbi } from '../src/lib/contract.ts';

export async function execute(input) {
  const { action, config } = input;
  const url = new URL(config.rpc_url);
  if (config.chain_id !== 31337 || !['127.0.0.1','localhost'].includes(url.hostname) || url.protocol !== 'http:') throw new Error('Loopback Anvil required.');
  const client = createPublicClient({ chain: foundry, transport: http(config.rpc_url,{ timeout:10000,retryCount:0 }) });
  if (await client.getChainId() !== 31337) throw new Error('Wrong chain.');
  const contract=getAddress(config.contract);
  const read=(functionName,args=[]) => client.readContract({ address:contract,abi:caspyAbi,functionName,args });
  const marketRead=(functionName,args=[]) => client.readContract({ address:getAddress(config.market),abi:marketAbi,functionName,args });
  const sessionId=input.session_id ? keccak256(toBytes(input.session_id)) : undefined;
  const wallet=createWalletClient({ chain:foundry,transport:http(config.rpc_url,{ retryCount:0 }) });
  if(action==='wallets') return { wallets:(await wallet.getAddresses()).slice(2) };
  if(action==='check') {
    if(await read('VERSION')!==2n || !(await read('hasRole',[await read('SIGNER_ROLE'),config.signer])) || getAddress(await marketRead('candy'))!==contract) throw new Error('Deploy v2 candy and marketplace contracts.');
    return { ready:true };
  }
  if(action==='info') return { contract,market:config.market,max_supply:Number(await read('maxSupply')),minted:Number(await read('totalMinted')) };
  if(action==='history') {
    const head=await client.getBlockNumber();
    const logs=(await client.getContractEvents({ address:getAddress(config.market),abi:marketAbi,eventName:'CandySold',fromBlock:BigInt(config.deployment_block),toBlock:head,strict:true }))
      .filter(log=>!log.removed && log.blockNumber!==null)
      .sort((a,b)=>a.blockNumber===b.blockNumber ? a.logIndex-b.logIndex : a.blockNumber<b.blockNumber ? -1:1);
    const selected=logs.slice(-1000), blocks=new Map();
    const numbers=[...new Set(selected.map(log=>String(log.blockNumber)))];
    for(let start=0;start<numbers.length;start+=16) {
      await Promise.all(numbers.slice(start,start+16).map(async number=>{
        blocks.set(number,await client.getBlock({blockNumber:BigInt(number)}));
      }));
    }
    return {
      chain_id:31337,contract,market:config.market,scanned_to_block:String(head),
      deployment_block:String(config.deployment_block),deployment_block_hash:config.deployment_block_hash,
      total_sales:logs.length,truncated:logs.length>selected.length,
      sales:selected.map(log=>({ token_id:String(log.args.tokenId),listing_id:String(log.args.listingId),
        price_wei:String(log.args.price),seller:log.args.seller,buyer:log.args.buyer,
        timestamp:Number(blocks.get(String(log.blockNumber)).timestamp),
        block_number:String(log.blockNumber),log_index:log.logIndex,transaction_hash:log.transactionHash })),
    };
  }
  if(action==='verify') {
    const parsed=parseSiweMessage(input.message), age=Date.now()-parsed.issuedAt?.getTime();
    if(!validateSiweMessage({ message:parsed,address:input.address,domain:input.domain,nonce:input.nonce }) || parsed.chainId!==31337 || parsed.version!=='1' || parsed.uri!==input.origin || !Number.isFinite(age) || age < -60000 || age>300000) throw new Error('Invalid sign-in.');
    const recovered=await recoverMessageAddress({ message:input.message,signature:input.signature });
    if(getAddress(recovered)!==getAddress(input.address)) throw new Error('Invalid signature.');
    return { address:getAddress(recovered) };
  }
  if(action==='sign') {
    if(await read('usedSessions',[sessionId]) || await read('mintedWallet',[input.to]) || await read('paused') || await read('totalMinted')>=await read('maxSupply')) throw new Error('Mint unavailable.');
    const v={ to:getAddress(input.to),grade:input.grade,score:input.score,sessionId,promptHash:input.prompt_hash,imageHash:input.image_hash,metadataHash:input.metadata_hash,uriHash:keccak256(toBytes(input.uri)),nonce:BigInt(input.nonce),deadline:BigInt(input.deadline) };
    const signature=await wallet.signTypedData({ account:getAddress(config.signer),domain:{ name:await read('name'),version:'2',chainId:31337,verifyingContract:contract },types:voucherTypes,primaryType:'CandyVoucher',message:v });
    return { ...v,nonce:String(v.nonce),deadline:String(v.deadline),uri:input.uri,chainId:31337,contract,signature };
  }
  const listingRows=async () => {
    const logs=await client.getContractEvents({ address:getAddress(config.market),abi:marketAbi,eventName:'CandyListed',fromBlock:BigInt(config.deployment_block),toBlock:'latest',strict:true });
    const rows=[];
    for(const log of logs) {
      const [seller,tokenId,price,active]=await marketRead('listings',[log.args.listingId]);
      if(active) rows.push({ listing_id:String(log.args.listingId),seller,token_id:String(tokenId),price_wei:String(price),active });
    }
    return rows;
  };
  const tokenInfo=async (id) => {
    const tokenId=BigInt(id);
    return { token_id:String(tokenId),owner:await read('ownerOf',[tokenId]),creator:await read('creatorOf',[tokenId]),grade:Number(await read('tokenGrade',[tokenId])),score:Number(await read('tokenScore',[tokenId])),prompt_hash:await read('tokenPromptHash',[tokenId]),image_hash:await read('tokenImageHash',[tokenId]),metadata_hash:await read('tokenMetadataHash',[tokenId]),uri:await read('tokenURI',[tokenId]),prompt_license:await read('promptLicense',[tokenId]),contract,market:config.market,chain_id:31337 };
  };
  if(action==='token') {
    const token=await tokenInfo(input.token_id);
    token.listing=(await listingRows()).find(item => item.token_id===token.token_id) || null;
    return token;
  }
  if(action==='market') {
    const rows=[];
    for(const item of await listingRows()) rows.push({ ...await tokenInfo(item.token_id),...item });
    return { listings:rows,proceeds_wei:input.to ? String(await marketRead('proceeds',[input.to])) : '0',contract,market:config.market };
  }
  if(action==='collection') {
    const logs=await client.getContractEvents({ address:contract,abi:caspyAbi,eventName:'CandyMinted',fromBlock:BigInt(config.deployment_block),toBlock:'latest',strict:true });
    const listings=await listingRows(),rows=[];
    for(const log of logs) {
      const token=await tokenInfo(log.args.tokenId);
      const listing=listings.find(item=>item.token_id===token.token_id);
      if(!input.to || token.owner.toLowerCase()===input.to.toLowerCase() || listing?.seller.toLowerCase()===input.to.toLowerCase()) rows.push({ ...token,listing:listing || null });
    }
    return { tokens:rows };
  }
  if(action==='status') {
    if(input.tx_hash) {
      const tx=await client.getTransaction({ hash:input.tx_hash });
      const decoded=decodeFunctionData({ abi:caspyAbi,data:tx.input });
      const v=decoded.args?.[0];
      if(tx.to?.toLowerCase()!==contract.toLowerCase() || tx.from.toLowerCase()!==input.to.toLowerCase() || decoded.functionName!=='mintCandy' || v.to.toLowerCase()!==input.to.toLowerCase() || v.sessionId!==sessionId || v.imageHash!==input.image_hash || v.metadataHash!==input.metadata_hash) throw new Error('Unrelated mint transaction.');
      if(tx.blockNumber===null) return { status:'pending',tx_hash:input.tx_hash };
      if((await client.getTransactionReceipt({ hash:input.tx_hash })).status==='reverted') return { status:'failed',tx_hash:input.tx_hash };
    }
    const logs=await client.getContractEvents({ address:contract,abi:caspyAbi,eventName:'CandyMinted',args:{ sessionId,to:getAddress(input.to) },fromBlock:BigInt(config.deployment_block),toBlock:'latest',strict:true });
    const event=logs.find(log=>log.args.imageHash===input.image_hash && log.args.metadataHash===input.metadata_hash && log.args.promptHash===input.prompt_hash && log.args.grade===input.grade && log.args.score===input.score);
    return event ? { status:'confirmed',minted:true,tx_hash:event.transactionHash,token_id:String(event.args.tokenId),contract,chain_id:31337 } : { status:'pending',minted:false,...(input.tx_hash ? { tx_hash:input.tx_hash } : {}) };
  }
  throw new Error('Unknown action.');
}
if(process.argv[1]?.endsWith('nft-bridge.mjs')) {
  try {
    let raw='';for await(const part of process.stdin) { raw+=part;if(raw.length>32768) throw new Error('Too much input.'); }
    console.log(JSON.stringify(await execute(JSON.parse(raw))));
  } catch {
    console.log(JSON.stringify({ error:'Candy chain operation failed. Check the local v2 contracts, wallet, supply and transaction.' }));process.exitCode=1;
  }
}
