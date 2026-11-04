import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectSales,saleGeometry,saleSummary,type Sale} from './priceHistory';

const sale=(price:string,timestamp=100,token='1',index=0):Sale=>({token_id:token,listing_id:String(index),price_wei:price,timestamp,block_number:String(timestamp),log_index:index,transaction_hash:`0x${index}`,seller:'seller',buyer:'buyer'});
test('sale selection respects exact token, date window, future and invalid prices',()=>{
  const rows=[sale('1',100),sale('2',200,'2'),sale('0',200),sale('-1',200),sale('3',300),sale('x',200)];
  assert.equal(selectSales(rows,'all',0,250).length,2);
  assert.deepEqual(selectSales(rows,'1',0,250).map(r=>r.price_wei),['1']);
  assert.equal(selectSales(rows,'all',7,1000000).length,0);
});
test('single/equal-price/equal-time history produces finite chart coordinates',()=>{
  assert.deepEqual(saleGeometry([]),[]);
  for(const rows of [[sale('1')],[sale('1'),sale('1',100,'1',1)]]){
    for(const point of saleGeometry(rows))assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));
  }
});
test('wei precision survives prices beyond Number safe integers and tiny price changes',()=>{
  const rows=[sale('1000000000000000001',100),sale('1000000000000000002',200)];
  const points=saleGeometry(rows);
  assert.ok(points[0].y>points[1].y);
  assert.equal(saleSummary(rows).volume,2000000000000000003n);
  assert.equal(saleSummary(rows).latest,1000000000000000002n);
});
test('same-time trades are ordered by block and event position',()=>{
  const rows=[sale('3',100,'1',3),sale('1',100,'1',1)];
  assert.deepEqual(selectSales(rows,'all',0,100).map(r=>r.log_index),[1,3]);
});
