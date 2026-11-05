import { useEffect, useId, useState } from 'react';
import { formatEther } from 'viem';
import { request } from '../lib/game';
import { saleGeometry, saleSummary, selectSales, type SaleHistory } from '../lib/priceHistory';

const date=(seconds:number)=>new Date(seconds*1000).toLocaleString(undefined,{timeZone:'UTC',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+' UTC';
const eth=(wei:bigint)=>formatEther(wei);

export default function PriceHistory({tokens,revision=0}:{tokens:{token_id:string;name:string}[];revision?:number}) {
  const [history,setHistory]=useState<SaleHistory|null>(null);
  const [token,setToken]=useState('all'),[days,setDays]=useState(0),[selected,setSelected]=useState<number|null>(null);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[refresh,setRefresh]=useState(0);
  const [now,setNow]=useState(()=>Math.floor(Date.now()/1000));
  const id=useId();
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    request<SaleHistory>('/market/history').then(value=>{if(active){setHistory(value);setSelected(null);setNow(Math.floor(Date.now()/1000));}})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Price history could not load.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[refresh,revision]);
  const options=new Map(tokens.map(item=>[item.token_id,item.name]));
  for(const sale of history?.sales||[])if(!options.has(sale.token_id))options.set(sale.token_id,`Candy #${sale.token_id}`);
  const sales=selectSales(history?.sales||[],token,days,now),points=saleGeometry(sales),summary=saleSummary(sales);
  const focus=selected===null?null:points[selected]?.sale;
  const prices=sales.map(s=>BigInt(s.price_wei)),low=prices.length?prices.reduce((a,b)=>a<b?a:b):null,high=prices.length?prices.reduce((a,b)=>a>b?a:b):null;
  return <section className="price-history" aria-labelledby={`${id}-title`}>
    <div className="price-history-heading"><div><span className="eyebrow">RECORDED ON THE LOCAL CHAIN</span><h2 id={`${id}-title`}>A candy’s price story.</h2><p>Confirmed sales in test ETH. Asking prices and cancelled listings are excluded.</p></div><button className="button button-light" onClick={()=>setRefresh(v=>v+1)} disabled={loading}>{loading?'Loading history…':'Refresh sales'}</button></div>
    <div className="price-history-filters"><label>Candy<select value={token} onChange={e=>{setToken(e.target.value);setSelected(null);}}><option value="all">All candies · completed trades</option>{[...options].map(([value,name])=><option key={value} value={value}>{name} · #{value}</option>)}</select></label><div role="group" aria-label="Sales date range">{[[0,'All time'],[7,'7 days'],[30,'30 days']].map(([value,label])=><button key={value} aria-pressed={days===value} onClick={()=>{setDays(Number(value));setSelected(null);}}>{label}</button>)}</div></div>
    {error?<p className="error" role="alert">{error} Refresh to retry. The marketplace can still be browsed.</p>:loading?<p role="status">Reading confirmed marketplace events…</p>:!sales.length?<div className="price-history-empty"><h3>No completed sales {token==='all'?'yet':'for this candy'}{days?' in this period':''}.</h3><p>A sale appears after a purchase confirms. Minting or listing alone does not establish a price.</p></div>:<>
      <dl className="price-history-stats"><div><dt>Completed trades</dt><dd>{summary.count}</dd></div><div><dt>Latest {token==='all'?'collection ':''}sale</dt><dd>{eth(summary.latest!)} <small>test ETH</small></dd></div><div><dt>Traded volume</dt><dd>{eth(summary.volume)} <small>test ETH</small></dd></div></dl>
      <p className="price-history-explanation">{token==='all'?'Each dot is a sale of a potentially different candy. Select one candy to see its price path.':'Each point is this candy’s actual sale price. Lines connect observed trades; they do not estimate prices between them.'} All dates use UTC.</p>
      <div className="price-history-chart" tabIndex={0} role="region" aria-label="Sale price chart. Scroll horizontally on small screens."><svg viewBox="0 0 1000 320" role="group" aria-label="Completed sale prices. Focus a point for exact details.">
        <line x1="68" y1="255" x2="932" y2="255" className="price-axis"/><line x1="68" y1="55" x2="68" y2="255" className="price-axis"/>
        <text x="68" y="35">High: {eth(high!)} test ETH</text><text x="68" y="282">Low: {eth(low!)} test ETH</text>
        {token!=='all'&&points.length>1&&<polyline points={points.map(p=>`${p.x},${p.y}`).join(' ')} className="price-line"/>}
        {points.map((point,index)=><g key={`${point.sale.transaction_hash}:${point.sale.log_index}`} className="price-point-target" tabIndex={0} role="button"
          aria-label={`Candy ${point.sale.token_id}: ${point.sale.price_wei} wei, ${date(point.sale.timestamp)}. Press Enter for details.`}
          onFocus={()=>setSelected(index)} onMouseEnter={()=>setSelected(index)} onClick={()=>setSelected(index)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(index);}}}><circle cx={point.x} cy={point.y} r={26} className="price-hit"/><circle cx={point.x} cy={point.y} r={index===selected?10:7} className="price-point"/><title>{eth(BigInt(point.sale.price_wei))} test ETH · {date(point.sale.timestamp)}</title></g>)}
        <text x="68" y="310">{new Date(sales[0].timestamp*1000).toISOString().slice(0,10)}</text><text x="932" y="310" textAnchor="end">{new Date(sales[sales.length-1].timestamp*1000).toISOString().slice(0,10)}</text>
      </svg></div>
      <p className="price-history-detail" role="status">{focus?<>Candy #{focus.token_id} · {eth(BigInt(focus.price_wei))} test ETH ({focus.price_wei} wei) · {date(focus.timestamp)} · Block {focus.block_number} · Transaction <code>{focus.transaction_hash}</code></>:'Hover, tap or focus a point to inspect its exact recorded price and transaction.'}</p>
      <details><summary>View accessible sales table ({sales.length})</summary><div className="price-history-table"><table><caption>Completed trades in the selected range, oldest first</caption><thead><tr><th>Time (UTC)</th><th>Candy</th><th>Price (test ETH)</th><th>Transaction</th></tr></thead><tbody>{sales.map(sale=><tr key={`${sale.transaction_hash}:${sale.log_index}`}><td>{date(sale.timestamp)}</td><td>#{sale.token_id}</td><td>{eth(BigInt(sale.price_wei))}</td><td><code>{sale.transaction_hash}</code></td></tr>)}</tbody></table></div></details>
    </>}
    {history?.truncated&&<p role="note">Showing only the latest 1,000 of {history.total_sales} completed trades. Older trades are excluded from these statistics.</p>}
    <p className="candy-footnote">Local Anvil chain 31337 · current deployment only. Test ETH has no real monetary value. Sale history does not predict future prices.</p>
  </section>;
}
