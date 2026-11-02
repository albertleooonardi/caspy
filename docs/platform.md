# Caspy accounts and AI evaluation workspace

Start the integrated application from the repository root:

```bash
bash run-heist.sh
```

Use `bash run-heist.sh --ai-only` to run without Anvil/NFTs. The same account
and research features work in both modes. Restart an older launcher after
updating, so the Python API loads the account endpoints. This is a local
application on <http://localhost:4321>; it does not publish a public service.

## Register and sign in

Visit `/register`. Choose **Play & contribute**, or **Evaluate AI** to create a
research workspace. Use your own email address and a password of 12–128
characters. No default users, shared admin password, or fake login is provided.
The login page is `/login`; profile and research choices are at `/account`.
Contributors can create their own workspace from Account settings later.

Account sessions last eight hours and are stored in an HttpOnly/SameSite cookie.
The server stores only a hash of the session token. Passwords use salted
PBKDF2-HMAC-SHA256 (600,000 iterations); the workstation's system Python does not
provide scrypt. Signing out revokes the session. Email verification, password
recovery, MFA and enterprise SSO are not implemented in this local version.

NFT mode also requires wallet verification. Choose **Connect local test wallet**
and select an available Anvil test account. Your own linked wallets remain
available; wallets linked to another account are excluded. Game ownership and
wallet links are checked by the server, separately from account authentication.
These are unlocked local development wallets and have no real funds.

## Run a research campaign

1. Register a research workspace or create one in Account settings.
2. Open `/research`, enter a campaign name and clear research purpose, and publish.
3. A signed-in participant opens `/play`. Private play is the default. They can
   select the named campaign and choose research contribution, then separately
   choose commercial licensing permission. Both checkboxes start unchecked.
4. Play the three-prompt heist. The existing independent judge, attempt counter,
   and server-owned NFT outcome remain unchanged by the consent choices.
5. Fully answered and judged turns enter only that campaign owner's review queue.
   Optional participant response ratings are saved only for consented examples.
6. In **Review contributions**, inspect/edit both redacted texts, assign human
   verdict, test type, behavior, strategy and quality labels, check the PII review
   attestation, and approve or reject.

Campaigns use the configured Bifrost actor and judge. They record requested and
reported served models, prompt/rubric versions and hashes, verdicts and latency.
Unknown served models are shown as unknown. Changing the recorded gateway/rubric
configuration requires a new campaign; arbitrary model onboarding and automated
cross-model replay are not part of this version.

The dashboard distinguishes persuasion yield, agreement with human verdicts,
and human-reviewed policy-boundary violations. It shows denominators and never
counts an ordinary successful creative pitch as a safety failure. Data from a
self-selected game population is exploratory evidence, not a certified general
safety benchmark. Individual ratings are not pairwise RLHF preferences; there
is no training or fine-tuning job in this implementation.

## Publish and license a dataset

1. Approve examples that have **both** research and commercial permission.
2. In **Dataset releases**, enter a title, description, license terms and listed
   USD price. Publishing includes currently eligible examples in your workspace.
3. Another research workspace can discover the release at `/datasets` and request
   access. It cannot see the example texts before access is granted.
4. The release owner grants or denies access from its workspace. This is manual
   licensing; no payment, invoice or card checkout is processed by Caspy.
5. An authorized buyer or the owner downloads JSON, with a schema/consent manifest,
   reviewed text, model provenance, judge labels and human labels.

Published samples and labels are locked. Every download checks the current access
and consent again. Exports omit account identifiers, email, wallet, raw heist IDs
and precise contribution times. IDs are pseudonymous and specific to a release.
Automatic redaction and human review do not guarantee anonymity: names, personal
stories and indirect identifiers can still identify someone. Researchers must
review carefully and must not attempt re-identification.

A contributor can withdraw in **Account → Your research choices**. The server
deletes the research samples and release memberships, excludes them from future
exports, and does not recollect them on game recovery. Downloaded copies cannot
be recalled. Operational game records and provider/Bifrost logs are separate.
Research samples have a 90-day retention limit, enforced by periodic pruning and
export-time checks. Private operational game snapshots do not expire through
research withdrawal.

## Runtime and verification

`data/platform.sqlite3` contains accounts, hashed sessions, wallet links,
workspaces, campaigns, consent records, redacted samples, labels, releases, access
grants and audit metadata. It is ignored by Git and created with mode 0600.
There are no production payment/signing keys or hardcoded user credentials.

```bash
python3 -m unittest discover -s scripts -p 'test_*.py'
CASPY_RUN_HTTP_TESTS=1 python3 -m unittest discover -s scripts -p test_platform_http.py -v
# After contract setup (the normal launcher installs it):
CASPY_RUN_CHAIN_TESTS=1 .venv/bin/python -m unittest discover -s scripts -p test_nft_integration.py -v
cd frontend
npm run check
npm test
npm run build
```

The opt-in HTTP suite uses a temporary API/database and deterministic AI fixtures;
it tests signup, login, session revocation, origin checks, protected gameplay,
consented collection, reviewer authorization, licensing, exports and withdrawal.
The chain suite also checks account/wallet isolation and both NFT tiers. Use
Python 3 directly if you have not created `.venv`; the optional Python signer
compatibility test needs `blockhain/requirements.txt`.

The product requirements and public-launch boundaries are in [PRD section 20](../PRD.md).
