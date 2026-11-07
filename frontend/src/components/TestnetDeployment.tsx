import { useState } from 'react';
import { createPublicClient, createWalletClient, custom, getAddress, http, type Abi, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { switchOrAddChain } from '../lib/switchChain';

type Artifact = { abi: Abi; bytecode: Hex; hash: Hex };
type DeploymentArtifacts = { chain_id: number; signer: Hex; candy: Artifact; market: Artifact };
type Confirmed = { contract: Hex; block: string; hash: Hex };

export default function TestnetDeployment() {
  const [busy,setBusy]=useState(false), [error,setError]=useState(''), [status,setStatus]=useState('');
  const [candy,setCandy]=useState<Confirmed|null>(null), [market,setMarket]=useState<Hex|null>(null);
  const [config,setConfig]=useState('');
  async function deploy(kind:'candy'|'market') {
    setBusy(true);setError('');
    try {
      if (!window.ethereum) throw new Error('Open this page in a browser with MetaMask or another Ethereum wallet.');
      const response=await fetch('/deployment/base-sepolia.json');
      if(!response.ok) throw new Error('Deployment artifacts are not prepared.');
      const artifacts=await response.json() as DeploymentArtifacts;
      if(artifacts.chain_id!==84532) throw new Error('Wrong deployment network.');
      const wallet=createWalletClient({ chain:baseSepolia,transport:custom(window.ethereum) });
      const [account]=await wallet.requestAddresses();
      if(!account) throw new Error('Choose your testnet deployer wallet.');
      await switchOrAddChain(wallet,baseSepolia);
      const publicClient=createPublicClient({ chain:baseSepolia,transport:http() });
      if(await publicClient.getBalance({address:account})===0n) throw new Error('This wallet needs Base Sepolia test ETH to deploy. Do not use real ETH.');
      if(kind==='market'&&!candy) throw new Error('Deploy the candy contract first.');
      setStatus(`Approve the ${kind} contract deployment in your wallet. This uses Base Sepolia test ETH.`);
      const artifact=artifacts[kind];
      const hash=await wallet.deployContract({account,abi:artifact.abi,bytecode:artifact.bytecode,
        args:kind==='candy'?['Caspy Candies','CASPY',getAddress(artifacts.signer),'',1000n]:[candy!.contract]});
      setStatus('Waiting for Base Sepolia confirmation. Keep this page open.');
      const receipt=await publicClient.waitForTransactionReceipt({hash});
      if(receipt.status!=='success'||!receipt.contractAddress) throw new Error('Deployment reverted.');
      if(kind==='candy') {
        setCandy({contract:receipt.contractAddress,block:String(receipt.blockNumber),hash:receipt.blockHash});
        setStatus('Candy contract confirmed. Next deploy its marketplace.');
      } else {
        setMarket(receipt.contractAddress);
        const value={version:2,chain_id:84532,rpc_url:'https://sepolia.base.org',contract:candy!.contract,
          market:receipt.contractAddress,signer:artifacts.signer,deployment_block:candy!.block,
          deployment_block_hash:candy!.hash,artifact_hash:artifacts.candy.hash,market_artifact_hash:artifacts.market.hash};
        setConfig(JSON.stringify(value,null,2));
        setStatus('Both contracts are confirmed. Download the public deployment configuration.');
      }
    } catch(e) { setError(e instanceof Error?e.message:'Deployment did not complete. Check your wallet.'); }
    finally {setBusy(false);}
  }
  function download() {
    const url=URL.createObjectURL(new Blob([config],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='nft-sepolia.json';link.click();URL.revokeObjectURL(url);
  }
  return <main className="shell" style={{maxWidth:780,padding:'48px 24px'}}><a href="/">← Caspy home</a><p className="eyebrow" style={{marginTop:32}}>OPERATOR SETUP · BASE SEPOLIA ONLY</p><h1>Launch the candy contracts.</h1><p>This setup deploys a new 1,000-candy season and its marketplace. Your connected wallet becomes the contract administrator. The separate server signer can authorize eligible candy vouchers; it cannot spend your wallet’s funds.</p><p>Use a wallet funded with Base Sepolia test ETH. Two separate wallet approvals are required. Keep this page open between transactions. This does not publish or activate the game backend.</p><div style={{display:'flex',gap:16,flexWrap:'wrap',margin:'24px 0'}}><button className="button button-primary" disabled={busy||!!candy} onClick={()=>void deploy('candy')}>1. Deploy candy contract</button><button className="button button-light" disabled={busy||!candy||!!market} onClick={()=>void deploy('market')}>2. Deploy marketplace</button></div>{status&&<p role="status">{status}</p>}{error&&<p className="error" role="alert">{error}</p>}{candy&&<p>Candy contract: <a href={`https://sepolia.basescan.org/address/${candy.contract}`}>{candy.contract}</a></p>}{market&&<p>Marketplace: <a href={`https://sepolia.basescan.org/address/${market}`}>{market}</a></p>}{config&&<><button className="button button-primary" onClick={download}>Download deployment configuration</button><p>The JSON contains public addresses only. Save it to <code>data/nft-sepolia.json</code> in the project, then tell Codex it is ready.</p><pre style={{overflowX:'auto',fontSize:12,padding:16}}>{config}</pre></>}</main>;
}
