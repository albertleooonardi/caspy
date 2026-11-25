# Render backend migration — 10 November 2026

## Hosted Bifrost dashboard

Deployment code supports a dashboard at the Render service root. Set
`CASPY_BIFROST_DASHBOARD_HOST` to the existing Render hostname, exactly as it
appears in Render's `RENDER_EXTERNAL_HOSTNAME`. The option defaults to off.
When enabled, nginx routes Caspy's API namespaces to the private game API and
requires HTTP Basic authentication before routing any other path to Bifrost.
Use the existing Bifrost administrator username and password for the browser
prompt, then sign in to Bifrost with the same account. Store credentials in
Render's environment settings. Use HTTPS.

Verify that an anonymous request to the service root and `/api/config` gets
401, an authenticated request loads the dashboard, and Caspy's public
`/health` and Vercel `/api/health` both return 200. Unset
`CASPY_BIFROST_DASHBOARD_HOST` and redeploy to disable the dashboard.
Caspy's chat and judge request explicit models from its startup routing
configuration. Adding a provider in Bifrost does not update those routes.

With the Gemini free tier enabled, Caspy chat starts with Gemini 3.5 Flash-Lite.
When `OPEN_ROUTER_API_KEY` is set, the chat route falls back to OpenRouter's
free Nemotron 3.5 Lightning. The judge keeps its separate Gemini route and
virtual key. If OpenRouter is unconfigured, chat falls back to Gemini 3.1
Flash-Lite. Check Render's `Text routes:` startup line for the selected route.

## Verified

- User selected **Free**, not paid compute. Free service sleep/usage limits still apply; this is not 24/7 hosting.
- Confirmed Render account: leogatsuma@gmail.com, Albert Leonardi (Leo)'s Workspace, `tea-csp8pb3gbbvc73a92f3g`.
- Service: `caspy-api`, `srv-dbphrkbm8hqs73dvee30`, Singapore, Docker, one instance, automatic deployments off.
- Dashboard: https://dashboard.render.com/web/srv-dbphrkbm8hqs73dvee30
- Backend: https://caspy-api.onrender.com
- User explicitly approved transferring the existing database/provider/gateway/voucher-only signer configuration to this service. Values are private Render environment variables, never source.
- Active deployment `dep-dbphuemc6qcc73ane9f0` is live on `dd6c0f3ebb90782458a3f1808c1ba76ef715bd62`.
- Container fix includes `chainEvents.ts`, which the NFT bridge imports, in both the Docker context and image. Build now imports both NFT helper modules as a packaging check.
- All four source check categories passed, including cloud container build and NFT integration.
- Direct `/health` returned 200, correct source SHA, Base Sepolia 84532, minting enabled. `/candy/config` returned the existing v3 candy and marketplace addresses, supply 1,000. Anonymous `/account/me` returned 401 as expected.
- Startup confirmed all three Supabase connections. Memory observed approximately 278 MiB of 512 MiB at idle; this is not a load-test result.

## Cutover completed

Vercel production `CASPY_BACKEND_URL` is now `https://caspy-api.onrender.com`.
The signed-in browser saved the variable; the user completed Vercel's emailed identity verification. Production redeployment `PedVGNA4kUNK9ZsodQzLhFpTMQL6` was created using the existing frontend source and latest project settings.

The old Codespace `caspy-nft-demo-wrj7666wxrvp2vw5` was explicitly stopped and GitHub confirmed `Shutdown`. No active chat or generating artwork job existed at cutover. Render was redeployed after stopping the old backend to reload the final persisted snapshots. Render deployment `dep-dbpi2b9srm7s73ar78eg` is live on `dd6c0f3ebb90782458a3f1808c1ba76ef715bd62`.

With Codespaces stopped, the public website's `/api/health` returned 200 with the Render backend SHA, chain 84532 and minting enabled. `/api/candy/config` returned 200 with the existing v3 addresses; anonymous `/api/account/me` returned 401. This verifies website-to-Render routing and the auth boundary, not a new signed-in game/image/mint transaction.

### Earlier access issue and remaining follow-up

The Vercel connector returned 403 for `team_gzCwaB4orszBfmIRlfMDtfbR` despite two user-reported authorization attempts. The signed-in Chrome session subsequently gained access to the project; the cutover was completed through the UI without changing account protections.

Remaining operations:

1. Keep Codespaces stopped; do not restart its API alongside Render. Snapshots support only one writer per deployment namespace.
2. Confirm private signed-in flows with user cooperation. Do not submit wallet transactions.
3. Configure an HTTP `/health` service check when supported by the available Render management surface. Current service uses the default TCP check; it briefly reported live during an earlier failed startup, so API health is the authority.

Existing contracts, accounts, Supabase records and artwork were not replaced. No player prompt, image generation, mint or marketplace transaction was created by these checks.
