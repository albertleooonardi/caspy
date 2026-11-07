import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseSepolia } from 'viem/chains';
import { accountOnChain, walletErrorCode, walletErrorMessage } from './walletAccess';

const account='0x1111111111111111111111111111111111111111' as const;
const other='0x2222222222222222222222222222222222222222' as const;

test('account access is requested after changing network and uses its current account',async()=>{
  let chain=1;const events:string[]=[];
  const result=await accountOnChain({
    async getChainId(){return chain;},
    async switchChain({id}){events.push('switch');chain=id;},async addChain(){assert.fail('Already installed');},
    async requestPermissions(){assert.fail('No forced reconnect');},
    async requestAddresses(){assert.equal(chain,84532);events.push('accounts');return [other];},
    async getAddresses(){events.push('authorized');return [other];},
  },baseSepolia);
  assert.equal(result,other);assert.deepEqual(events,['switch','accounts','authorized']);
});

test('explicit reconnect requests fresh permissions before selecting the account',async()=>{
  const events:string[]=[];
  await accountOnChain({async getChainId(){return 84532;},async switchChain(){assert.fail();},async addChain(){assert.fail();},
    async requestPermissions(value){assert.deepEqual(value,{eth_accounts:{}});events.push('permissions');},
    async requestAddresses(){events.push('accounts');return [account];},async getAddresses(){return [account];},
  },baseSepolia,true);
  assert.deepEqual(events,['permissions','accounts']);
});

test('a revoked account is rejected before any transaction request',async()=>{
  await assert.rejects(accountOnChain({async getChainId(){return 84532;},async switchChain(){assert.fail();},async addChain(){assert.fail();},
    async requestPermissions(){assert.fail();},async requestAddresses(){return [account];},async getAddresses(){return [other];},
  },baseSepolia),error=>walletErrorCode(error)===4100);
});

test('cancelled permission request is preserved without retrying',async()=>{
  const cancelled=Object.assign(new Error('Rejected'),{code:4001});
  await assert.rejects(accountOnChain({async getChainId(){return 84532;},async switchChain(){assert.fail();},async addChain(){assert.fail();},
    async requestPermissions(){throw cancelled;},async requestAddresses(){assert.fail('Do not retry');},async getAddresses(){return [];},
  },baseSepolia,true),error=>error===cancelled);
});

test('wallet errors show useful recovery without RPC bytecode or arguments',()=>{
  const code='0x'+'ab'.repeat(4000);
  const unauthorized={message:'Wrapper Request Arguments: '+code,cause:{code:4100,message:code}};
  assert.match(walletErrorMessage(unauthorized),/Reconnect wallet/);
  assert.doesNotMatch(walletErrorMessage(unauthorized),/abab|Request Arguments/);
  assert.equal(walletErrorMessage(new Error('Failed. Request Arguments: '+code)),'Failed.');
  assert.match(walletErrorMessage({code:-32002}),/already pending/);
  assert.match(walletErrorMessage({code:4001}),/cancelled/);
  assert.doesNotMatch(walletErrorMessage({shortMessage:'Failed '+code}),/abab/);
});
