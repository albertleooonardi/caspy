# Loading clarity and candy profile pictures — 8 November 2026

The account page now leads with a personal profile header and candy picture,
then sign-in/access details, history/collection shortcuts and optional research
tools. Research workspace creation is collapsed by default. Research-choice
rows have distinct heist numbers/dates and do not report an empty history while
their initial request is still pending.

## Loading audit

| Area | Result |
| --- | --- |
| Account bootstrap | Distinguishes HTTP 401 from network/invalid-response failures; offers reconnect without falsely signing out. GET requests have a 30-second limit. |
| Sign-in / registration | Buttons name the current operation instead of showing only a spinner. |
| Wallet connection | Explicit waiting-for-signature wording; a temporary verification failure no longer clears an already known wallet. |
| Dashboard | Shows a labelled initial/update state and preserves loaded values during background refreshes. |
| Account / research choices | Separate fetching, saving, unavailable and genuinely empty states. No empty-state flash before data arrives. |
| History / workspace / catalog | Context-specific loading messages and skeleton/slow-response feedback. Research actions and exports name their operation. |
| Collection / marketplace | Loading explains ownership/listing checks; source-prompt buttons show their own pending state. A confirmed trade plus failed UI refresh becomes a status notice rather than a failed-transaction alert. |
| Reward | Keeps the automatic, serialized status recovery and immutable grade/artwork; initial load explains saved-result checks. |
| Walkthrough | Buffering/waiting/seeking feedback is distinct from video failure. No media assets/storyboard were changed. |

Shared loading feedback uses accessible status text, an eight-second slow-request
hint and reduced-motion-aware skeletons. It does not invent percentage progress,
retry mutations or keep the demo host awake. Backend unavailability and provider
quotas remain real constraints; this work improves presentation and recovery.

## NFT profile pictures

Account → Change profile picture loads current owned candies from the verified
wallet, previews choices, and saves without a transaction. A default ghost option
clears the selection. Header/dashboard/profile use the persisted choice and an
image-error fallback. The native dialog supports keyboard focus and Escape.

`POST /account/avatar` accepts only a token ID or explicit null. It requires an
account session; selecting an NFT additionally requires wallet authentication,
an account/wallet link, current on-chain ownership of the configured Caspy token,
and available committed artwork. Arbitrary URLs and other accounts'/wallets'
tokens are rejected. `profiles` stores account ID, chain, contract, token ID and
image digest in private PostgreSQL with RLS and browser-role grants revoked.
Account responses derive a same-origin content-addressed image URL. No password,
seed phrase, wallet transaction or research-consent change is involved.

Ownership is checked when choosing the picture. The saved cosmetic selection
is not an ownership credential and does not grant NFT access; it can remain as
a picture after transfer. The picker shows the currently configured collection;
existing earlier-season picture selections are retained until changed.

## Verification and limits

Passed: 32 frontend tests; type checks; production build; 16 account-store tests;
five isolated HTTP cases; four disposable-chain integration cases (one optional
live-AI case skipped); and one real Supabase profile test in a disposable schema.
Tests cover persistence/reset, cross-account and CSRF rejection, arbitrary-URL
rejection, expired-vs-offline distinction, malformed response handling, and actual
contract ownership before/after an isolated fixture transfer. No real account
avatar, player heist, artwork or public-chain transaction was changed for QA.

Browser connection discovery returned no available browser, so desktop/mobile
visual and dialog interaction verification remain manual; passing tests/builds
are not presented as a completed browser walkthrough.
