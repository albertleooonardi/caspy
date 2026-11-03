// Loaded only by tutorial_capture_server.py on its isolated loopback origin.
// The real compiled React UI renders these fictional responses. No API/RPC is used.
(() => {
  const scene = new URL(location.href).searchParams.get('tutorial') || 'prompt';
  const address = '0x1111111111111111111111111111111111111111';
  const prompt = 'I’ll bake moonbeam cookies for every lonely ghost. Could one candy decorate our first batch?';
  const reply = 'A seat for every lonely ghost? Boo… that is a sweet reason. I’ll share one candy for your moonbeam-cookie party!';
  const assessment = {grade:3, grade_label:'A', score:84, components:{creativity:18,coherence:17,specificity:18,novelty:31}, comparison_count:6,closest_similarity:0.22,rule_version:'tutorial-example'};
  const ready = ['ready','minted','collection','marketplace'].includes(scene);
  const game = {id:'tutorial-fictional-heist',status:scene==='prompt'?'active':scene==='reply'?'active':scene==='loss'?'lost':'won',attempts_remaining:scene==='prompt'?3:2,messages:scene==='prompt'?[]:[{role:'user',text:prompt},{role:'caspy',text:reply}],minted:scene==='minted',token_id:scene==='minted'?'7':null,research_consent:false};
  if (scene==='loss') game.messages=[];
  game.candy={session_id:game.id,state:scene==='generating'?'generating':ready?'ready':'earned',assessment,image_url:ready?'/images/tutorial/candy-example.png':null,error:null,minted:game.minted,token_id:game.token_id,attempts:ready?1:0,generator_model:'black-forest-labs/FLUX.1-schnell',generation_local:true};
  const token={token_id:'7',owner:address,creator:address,grade:3,score:84,name:'Moonbeam Party Bonbon',image_url:'/images/tutorial/candy-example.png',assessment,prompt_license:'Tutorial example: personal use of the redacted source prompt. No research dataset license is included.',contract:address,market:address,generator:{model:'black-forest-labs/FLUX.1-schnell'}};
  localStorage.setItem(`caspy.nft.session.${address}.tutorial-only`,game.id);
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async (input,options={}) => {
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(url.origin!==location.origin) throw new Error('Tutorial capture blocks external requests.');
    if(!url.pathname.startsWith('/api/')) return nativeFetch(input,options);
    const path=url.pathname.slice(4);
    let data;
    if(path==='/account/me') data={user:{id:'tutorial-player',name:'Tutorial player',email:'player@example.invalid',role:'contributor',org_id:null,org_name:null}};
    else if(path==='/auth/me') data={address};
    else if(path==='/campaigns') data={campaigns:[],consent_version:'tutorial'};
    else if(path.startsWith('/game/session/')) data=game;
    else if(path==='/candy/config') data={enabled:true,configured:true,max_supply:1000,remaining:993};
    else if(path.startsWith('/mint/status/')) data={status:game.minted?'confirmed':'ready',minted:game.minted,token_id:game.token_id};
    else if(path==='/candy/collection') data={tokens:[token]};
    else if(path==='/market/listings') data={listings:[{...token,owner:'0x2222222222222222222222222222222222222222',seller:'0x2222222222222222222222222222222222222222',listing_id:'1',price_wei:'10000000000000000'}]};
    else if(path==='/market/account') data={proceeds_wei:'0'};
    else return new Response(JSON.stringify({detail:'This illustrated tutorial cannot send transactions or change game state.'}),{status:403,headers:{'Content-Type':'application/json'}});
    return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const banner=document.createElement('div');
    banner.textContent='ILLUSTRATED WEBSITE WALKTHROUGH · FICTIONAL DATA · NO TRANSACTIONS';
    banner.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#2c1942;color:#fff3e7;text-align:center;padding:8px;font:11px system-ui;letter-spacing:1px;pointer-events:none';
    document.body.append(banner);
  });
})();
