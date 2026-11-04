export type Sale = {
  token_id: string; listing_id: string; price_wei: string; timestamp: number;
  block_number: string; log_index: number; transaction_hash: string;
  seller: string; buyer: string;
};
export type SaleHistory = {
  sales: Sale[]; total_sales: number; truncated: boolean; chain_id: number;
  contract: string; market: string; scanned_to_block: string; deployment_block_hash: string;
};
export function selectSales(sales: Sale[], token: string, days: number, now: number) {
  return sales.filter(sale => /^\d+$/.test(sale.price_wei) && BigInt(sale.price_wei)>0n
    && Number.isSafeInteger(sale.timestamp) && sale.timestamp>0 && sale.timestamp<=now
    && (token==='all' || sale.token_id===token)
    && (!days || sale.timestamp>=now-days*86400))
    .sort((a,b)=>a.timestamp-b.timestamp || (BigInt(a.block_number)<BigInt(b.block_number)?-1:BigInt(a.block_number)>BigInt(b.block_number)?1:a.log_index-b.log_index));
}
export function saleGeometry(sales: Sale[]) {
  if (!sales.length) return [];
  const prices=sales.map(sale=>BigInt(sale.price_wei));
  const min=prices.reduce((a,b)=>a<b?a:b), max=prices.reduce((a,b)=>a>b?a:b);
  const first=sales[0].timestamp,last=sales[sales.length-1].timestamp;
  return sales.map((sale,index)=>({sale,
    x:first===last ? 500 : 68+(sale.timestamp-first)/(last-first)*864,
    y:min===max ? 155 : 255-Number((prices[index]-min)*200000n/(max-min))/1000,
  }));
}
export function saleSummary(sales: Sale[]) {
  return {count:sales.length,volume:sales.reduce((total,sale)=>total+BigInt(sale.price_wei),0n),
    latest:sales.length?BigInt(sales[sales.length-1].price_wei):null};
}
