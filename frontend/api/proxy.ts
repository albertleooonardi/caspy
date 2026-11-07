// Same-origin API entry point. Hosting credentials and backend URL stay server-side.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const config = { maxDuration: 300 };

export default async function proxy(request: IncomingMessage, response: ServerResponse) {
  function fail(code: number, detail: string) {
    if (response.headersSent) { response.end(); return; }
    response.writeHead(code, { 'Content-Type':'application/json', 'Cache-Control':'no-store' });
    response.end(JSON.stringify({detail}));
  }
  if (!['GET','POST'].includes(request.method || '')) { fail(405,'Method not allowed.');return; }
  const configured = process.env.CASPY_BACKEND_URL;
  if (!configured) { fail(503,'The cloud game backend is being configured.');return; }
  try {
    const backend = new URL(configured);
    if(backend.protocol!=='https:'||backend.username||backend.password||backend.pathname!=='/'||backend.search||backend.hash) throw new Error('Invalid backend origin.');
    const incoming = new URL(request.url || '/', 'https://caspy.invalid');
    if(!incoming.pathname.startsWith('/api/')) { fail(404,'Not found.');return; }
    const routedPath=incoming.searchParams.get('__caspy_path');
    incoming.searchParams.delete('__caspy_path');
    // Vercel also adds the matched wildcard as `path`. It is routing metadata,
    // not an application query parameter (exact-match API routes reject it).
    if (routedPath!==null && incoming.searchParams.get('path')===routedPath) incoming.searchParams.delete('path');
    const path=routedPath===null ? incoming.pathname.slice(4) : '/'+routedPath;
    const destination = new URL(path + incoming.search, backend);
    if(destination.origin!==backend.origin) throw new Error('Invalid API path.');
    const headers = new Headers();
    for(const name of ['cookie','origin','content-type','idempotency-key','accept']) {
      const value=request.headers[name];
      if(typeof value==='string') headers.set(name,value);
    }
    const chunks: Buffer[]=[];let size=0;
    for await(const part of request) {
      const chunk=Buffer.isBuffer(part)?part:Buffer.from(part);
      size+=chunk.length;
      if(size>65536) { fail(413,'Request is too large.');return; }
      chunks.push(chunk);
    }
    const upstream=await fetch(destination,{method:request.method,headers,
      body:request.method==='POST'?Buffer.concat(chunks):undefined,redirect:'manual',signal:AbortSignal.timeout(290_000)});
    if(upstream.status>=300&&upstream.status<400) { fail(502,'The game service returned an unexpected redirect.');return; }
    response.statusCode=upstream.status;
    response.setHeader('Content-Type',upstream.headers.get('content-type')||'application/json');
    response.setHeader('Cache-Control','no-store');
    const cookies=upstream.headers.getSetCookie();
    if(cookies.length) response.setHeader('Set-Cookie',cookies);
    response.flushHeaders();
    if(upstream.body) await pipeline(Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]),response);
    else response.end();
  } catch { fail(502,'The game service could not be reached. Your saved heist has not been reset.'); }
}
