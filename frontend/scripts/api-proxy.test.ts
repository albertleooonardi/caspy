import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import proxy from '../api/proxy';

test('hosted proxy forwards cookies/origin, streams SSE and refuses redirects', async () => {
  const originalFetch=globalThis.fetch, originalBackend=process.env.CASPY_BACKEND_URL;
  process.env.CASPY_BACKEND_URL='https://backend.example';
  const server=createServer((request,response)=>{void proxy(request,response);});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  if(!address||typeof address==='string') throw new Error('Fixture did not bind.');
  const base=`http://127.0.0.1:${address.port}`;
  let call=0;
  globalThis.fetch=(async (input,options)=>{
    call++;
    assert.equal(String(input),'https://backend.example/game/turn');
    assert.equal(options?.redirect,'manual');
    const headers=new Headers(options?.headers);
    assert.equal(headers.get('origin'),'https://caspy.example');
    assert.equal(headers.get('cookie'),'caspy_account=fictional');
    assert.equal(headers.get('idempotency-key'),'fixture-key');
    if(call===2) return new Response(null,{status:302,headers:{location:'https://untrusted.example'}});
    return new Response('event: final\ndata: {"status":"won"}\n\n',{headers:{'Content-Type':'text/event-stream','Set-Cookie':'caspy_account=rotated; Secure; HttpOnly; Path=/api'}});
  }) as typeof fetch;
  try {
    const options={method:'POST',headers:{Origin:'https://caspy.example',Cookie:'caspy_account=fictional','Idempotency-Key':'fixture-key','Content-Type':'application/json'},body:'{}'};
    const response=await originalFetch(base+'/api/game/turn',options);
    assert.equal(response.status,200);
    assert.match(response.headers.get('set-cookie')||'',/Secure; HttpOnly/);
    assert.equal(response.headers.get('content-type'),'text/event-stream');
    assert.match(await response.text(),/event: final/);
    const redirect=await originalFetch(base+'/api/game/turn',options);
    assert.equal(redirect.status,502);
    assert.match(await redirect.text(),/unexpected redirect/);
    process.env.CASPY_BACKEND_URL='https://user:password@backend.example';
    const invalid=await originalFetch(base+'/api/game/turn',options);
    assert.equal(invalid.status,502);assert.equal(call,2);
    delete process.env.CASPY_BACKEND_URL;
    const missing=await originalFetch(base+'/api/health');
    assert.equal(missing.status,503);
    const body=await missing.text();assert.doesNotMatch(body,/password|fictional|rotated/);
  } finally {
    globalThis.fetch=originalFetch;
    if(originalBackend===undefined) delete process.env.CASPY_BACKEND_URL;else process.env.CASPY_BACKEND_URL=originalBackend;
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

test('Vercel wildcard rewrite preserves nested API paths and query parameters', async () => {
  const originalFetch=globalThis.fetch, originalBackend=process.env.CASPY_BACKEND_URL;
  process.env.CASPY_BACKEND_URL='https://backend.example';
  const server=createServer((request,response)=>{void proxy(request,response);});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  if(!address||typeof address==='string') throw new Error('Fixture did not bind.');
  globalThis.fetch=(async (input)=>{
    assert.equal(String(input),'https://backend.example/candy/metadata/hash.json?session=abc');
    return new Response('{"ok":true}',{headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  try {
    const result=await originalFetch(`http://127.0.0.1:${address.port}/api/proxy?__caspy_path=candy%2Fmetadata%2Fhash.json&path=candy%2Fmetadata%2Fhash.json&session=abc`);
    assert.equal(result.status,200);
    assert.deepEqual(await result.json(),{ok:true});
  } finally {
    globalThis.fetch=originalFetch;
    if(originalBackend===undefined) delete process.env.CASPY_BACKEND_URL;else process.env.CASPY_BACKEND_URL=originalBackend;
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

test('only successful content-addressed public artwork is cached without account cookies', async () => {
  const originalFetch=globalThis.fetch, originalBackend=process.env.CASPY_BACKEND_URL;
  process.env.CASPY_BACKEND_URL='https://backend.example';
  const server=createServer((request,response)=>{void proxy(request,response);});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  if(!address||typeof address==='string') throw new Error('Fixture did not bind.');
  const base=`http://127.0.0.1:${address.port}`;
  const asset='/api/candy/images/'+'a'.repeat(64)+'.png';
  let assetStatus=200;
  let assetType='image/png';
  globalThis.fetch=(async (input, options)=>{
    const isAsset=String(input).includes('/candy/images/');
    const headers=new Headers(options?.headers);
    assert.equal(headers.get('cookie'),isAsset ? null : 'caspy_account=fictional');
    return new Response(isAsset ? 'png-fixture' : '{}',{
      status:isAsset ? assetStatus : 200,
      headers:isAsset ? {'Content-Type':assetType} : {'Content-Type':'application/json','Set-Cookie':'caspy_account=rotated; Secure; HttpOnly'},
    });
  }) as typeof fetch;
  try {
    const options={headers:{Cookie:'caspy_account=fictional'}};
    const image=await originalFetch(base+asset,options);
    assert.match(image.headers.get('cache-control')||'',/public.*immutable/);
    assert.equal(image.headers.get('set-cookie'),null);
    const account=await originalFetch(base+'/api/account/me',options);
    assert.equal(account.headers.get('cache-control'),'no-store');
    assert.match(account.headers.get('set-cookie')||'',/HttpOnly/);
    assetStatus=404;
    const missing=await originalFetch(base+asset,options);
    assert.equal(missing.status,404);
    assert.equal(missing.headers.get('cache-control'),'no-store');
    assetStatus=200; assetType='text/html';
    const loginPage=await originalFetch(base+asset,options);
    assert.equal(loginPage.status,502);
    assert.equal(loginPage.headers.get('cache-control'),'no-store');
  } finally {
    globalThis.fetch=originalFetch;
    if(originalBackend===undefined) delete process.env.CASPY_BACKEND_URL;else process.env.CASPY_BACKEND_URL=originalBackend;
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
