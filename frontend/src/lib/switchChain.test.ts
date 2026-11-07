import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseSepolia } from 'viem/chains';
import { switchOrAddChain } from './switchChain';

test('an unknown wallet network is added, then switched with wallet approval', async () => {
  const events: string[]=[];
  await switchOrAddChain({
    async getChainId(){return 1;},
    async switchChain({id}){assert.equal(id,84532);events.push('switch');if(events.length===1) throw {cause:{code:4902}};},
    async addChain({chain}){assert.equal(chain.id,84532);assert.equal(chain.rpcUrls.default.http[0],'https://sepolia.base.org');events.push('add');},
  },baseSepolia);
  assert.deepEqual(events,['switch','add','switch']);
});

test('wallet rejection never triggers an additional network prompt', async () => {
  let added=false;
  await assert.rejects(switchOrAddChain({async getChainId(){return 1;},async switchChain(){throw new Error('User rejected',{cause:{code:4001}});},async addChain(){added=true;}},baseSepolia),/User rejected/);
  assert.equal(added,false);
});

test('already on Base Sepolia requires no switch or add request', async () => {
  await switchOrAddChain({async getChainId(){return 84532;},async switchChain(){assert.fail('Unexpected switch');},async addChain(){assert.fail('Unexpected network addition');}},baseSepolia);
});
