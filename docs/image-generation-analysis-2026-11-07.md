# Image generation and connection analysis — 7 November 2026

Caspy preview: https://caspy-prompt-heist.vercel.app.
Backend fixes: `7bd583c38846ce01f08910d6d57c12b56077bcb3`.
Frontend cache follow-up: `eb2ef9281ce112de621bec79ed09a25e9bbc0073`.

## Observed failure

The existing testnet reward had already generated successfully: state `ready`,
one provider attempt, no stored generation error. Its PNG and metadata were
retrievable through the live frontend and matched their immutable content hashes.
No existing reward was regenerated, regraded or replaced during this work.

The apparent failure was primarily in delivering and displaying that result.

| Boundary | Finding | Change |
| --- | --- | --- |
| Result UI → chain | The page waited for mint status before publishing the ready game snapshot. An RPC timeout hid artwork that already existed. | Publish saved artwork immediately; show chain trouble separately with bounded status timeouts. |
| Chain status | Before minting, status scanned deployment-to-head events in 200-block queries. Work grew with season age. | Check `usedSessions` storage first. Verify submitted mints in their receipt block. Recover lost submit callbacks through immutable `tokenSession`, creator and full reward commitments. |
| Polling | A five-second interval could start another request while the previous request was still waiting. | Coalesce concurrent loads, schedule the next poll after completion, ignore stale wallet/page results and skip background polling while hidden. |
| Generator response | The Space client read the complete SSE connection to EOF instead of acting on its completion event. | Parse bounded SSE events incrementally and close immediately after completion. Keep a four-minute provider response window and explicit timeout/uncertain state. No automatic duplicate request or paid fallback. |
| Saved image delivery | The proxy and deployment headers forced `no-store` even for immutable public artwork. An initial observed PNG fetch took 21.02 seconds; metadata took 0.27 seconds. These are observations, not isolated causal measurements. | Cache only successful, content-addressed PNG/JSON assets. Strip cookies in both directions for those anonymous routes. Keep account/API responses uncached and reject HTML/login pages as artwork. |
| Gateway cookies | Public Codespaces tunnels can attach infrastructure cookies, defeating the first cache policy. | Ignore those cookies only for validated public artifact routes; never forward them to the frontend or cache authenticated API responses. |
| User feedback | Indefinite spinner and generic local-Anvil errors made provider waits and RPC trouble look like lost rewards. | Show actual queue/provider/download/save phases and elapsed time; add status refresh and saved-image reload without a new generation request. Use hosted-appropriate connection errors. |
| Database reads/writes | Ready artwork metadata was fetched twice when constructing its public state; unchanged mint polls persisted full game snapshots. | Reuse the saved generator metadata once and persist mint state only when it changes. |

## Verification

- A real, fictional candy image was generated from the deployed Codespace through
  the official anonymous FLUX.1-schnell Space. No reward entitlement or public-chain
  transaction was created, and the temporary PNG was discarded.
- Timings in that single test: connection/accepted request 0.85s, provider result
  2.16s, download 3.08s, complete normalized 512×512 PNG **3.77s**, 144,231 bytes.
  This is a measured request, not a latency guarantee for the free provider.
- The unminted chain-status fast path returned `pending, minted=false` in **776ms**
  against Base Sepolia, using a fictional nonexistent session.
- Following the first deployed fixes, the existing 119,600-byte reward PNG loaded
  in **0.33s**, with its original hash and one generation attempt preserved. The
  cache policy at that point was still `no-store`, prompting the separate tunnel
  cookie correction; final cache verification is recorded below after deployment.
- 25 frontend tests passed, including immediate artwork display before delayed
  chain results, RPC failure recovery and stale-result rejection.
- Three proxy tests passed, including private session isolation, tunnel-cookie
  filtering, successful public artifact caching and refusing HTML/404 caching.
- Five Space-client tests and ten candy-store tests passed: SSE completion without
  EOF, provider timeout, URL/seed restrictions, duplicate-click idempotency,
  progress reporting, ownership, consent, saved grade and immutable assets.
- Three isolated NFT integration tests passed; one opt-in live-AI test was skipped.
  Coverage includes lost mint-submit recovery and rejecting mismatched commitments.
- Fourteen game-state tests and three isolated account/research HTTP tests passed.
- Type checking and the production build passed. All four GitHub CI jobs passed
  for `7bd583c` (run 42379950616). Cache follow-up CI is checked separately.

## Remaining limits

Codespaces can stop after its configured 30-minute idle period, and its API port
may return to private. Vercel's static frontend alone cannot keep the backend
available. Existing Supabase data and immutable images survive backend restarts;
wallet authentication may require a new signature afterward.

The anonymous free GPU provider has shared queues and quotas. These fixes remove
unnecessary waiting and duplicate work; they cannot guarantee its response time
or availability. Timeouts preserve the grade and require an explicit retry. No
credits, paid provider or new fallback was enabled.

Browser automation was unavailable earlier in this session; this report does not
claim visual or interactive browser verification. A user-signed cloud mint,
listing, purchase and withdrawal remain separate manual verification steps.

## Final deployed verification

Vercel deployment `dpl_Df7dbjwen2kXixNmbgX849kBsypj` is READY on the stable
site, frontend source `eb2ef92`. Backend health reports `7bd583c` in Base Sepolia
NFT mode. Both commits passed all CI jobs; cache follow-up run 42380198885.

- Original saved PNG: first fetch **1.706s, CDN MISS**; repeat fetch **0.187s,
  CDN HIT**. Both returned HTTP 200 with `public, max-age=31536000, immutable`.
- Original saved metadata: **0.264s**, HTTP 200 and immutable cache policy.
- All artifact bytes still match the original database hashes. The original
  reward remains ready with exactly one generation attempt. No Set-Cookie header
  is exposed on these anonymous cached artifact responses.
- Anonymous `/api/account/me` remains HTTP 401 with `Cache-Control: no-store`.
- New complete pipeline: win/grade → explicit generation consent → queued worker
  → shared provider → download/validation → immutable Supabase blobs → cached
  artwork display. Mint status runs separately and cannot hide ready artwork.

Refresh the result page to load this release. A fresh MetaMask sign-in message
may be needed after the backend restart; it is not a mint or payment approval.
The existing ready artwork does not need another generation request.
