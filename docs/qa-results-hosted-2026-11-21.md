# Caspy hosted-site QA results — 21 November 2026

Run against https://caspy-prompt-heist.vercel.app with `docs/qa-ux-tasklist-2026-11-14.md`.
Browser: Chromium (Claude desktop built-in browser), signed out, no wallet extension.
Screens: 1280×720 and 375×812 (phone emulation).

**Scope.** The task list allows only read-only checks on the hosted site, so I created no account, heist
or transaction and signed nothing. The wallet dialog was opened only. Every **L** item (sign-in,
play, claim, mint, trade, social, account, research actions, journeys J1–J7) is **not run**:
it needs the local app (`./run.sh`).

Legend: ✅ pass · ❌ fail · ⚠️ partial / minor · ⏸ blocked (needs sign-in or the local app)

---

## Summary of problems found

| # | Severity | Page | Problem | Source |
|---|---|---|---|---|
| 1 | High | `/marketplace` | Shows **"No candies are listed right now"** while listings are still loading, then the candy appears ~5 s later. Happens when the tab/window regains focus during the first load (listings API takes 8–12 s). | `frontend/src/components/CandyPages.tsx:148-153` — a `focus`/`visibilitychange` reload bumps `loadSequence`, the first result is discarded, but its `.finally` still sets `loading=false` with `tokens=[]`. |
| 2 | High (G7) | `/how-to-play` | Hosted banner says **"You're in local NFT mode… choose an available test wallet… Collectibles use Anvil test ETH"**. Step 03 on the same page correctly says Base Sepolia. | `HowToPlay.tsx:131` — banner only checks `IS_DEMO`, not the network. |
| 3 | High (G7) | `/play` (bundle) | Non-contributor footer is hard-coded **"Local chain · test ETH · daily retry…"**; start text still says **"one-per-season heist"**. Confirmed in deployed JS; not seen on screen (needs sign-in). Known issue — still present. | `App.tsx:318`, `App.tsx:325` |
| 4 | Medium | `/rules` | "**One candy per wallet per deployment**" (v3 allows several), "don't earn **Treats**", FAQ "Can I mint more than once? **No.**", "The **frontend demo** uses no real transactions", "The **local** fixed-price marketplace". Known issues — still present, plus three new wording problems. | `App.tsx:147-149`, rules page `App.tsx:341` |
| 5 | Medium | `/privacy`, `/terms` | Still describe the local build only: "local server", "ignored data directory", "local chain", "For this local development build…"; Terms: "Anvil test wallets… local chain 31337". Neither mentions Base Sepolia. Known issue — still present. | `PlatformPages.tsx:149` |
| 6 | Medium | `/login`, `/register`, sign-in gates | Hosted form says "**Local account service.** Email verification and password recovery are not enabled in this **development build**." | `PlatformPages.tsx` (login/register) |
| 7 | Medium | `/gallery` | Filter tabs **Treats / Tricks** and example badges "Treat"/"Trick" — the NFT build should not use this wording. | `App.tsx:333-337` |
| 8 | Medium | 404 | Unknown URLs show Vercel's black default 404 (`404: NOT_FOUND`, debug ID, "Copy debug prompt"), no Caspy branding and no link home. | Vercel config — no custom 404 / SPA fallback |
| 9 | Low | Wallet dialog | Hosted dialog title says "**Choose your test wallet.**" Message without a wallet is good. | `App.tsx:110` |
| 10 | Low | `/` desktop | Page scrolls sideways at 1280 px (scrollWidth 1302): decorative `.scene-orbit` rings stick out. Fine at 375 px. | `App.tsx:130` hero scene CSS |
| 11 | Low | `/` | Signed-out visitors first see "**Opening your Caspy dashboard…**" (≈0.5 s with warm backend; longer on cold start). Home step 01 says "choose a **test wallet**". | `App.tsx:134` |
| 12 | Low | `/research` (signed out) | No `h1` on the page (heading "A workspace for your research." is not an h1). | Research gate |
| 13 | Low | `/play`, `/login` | Two elements have `aria-current="page"` (menu item and the "Sign in" tab). | Auth panel tabs |
| 14 | Low | `/how-to-play`, `/` | 10 px text slightly below 4.5:1: "Replay chapter · 0:08" (4.40:1), hero labels "cute face. tough negotiator." (3.91:1), "hmph." (4.06:1). | CSS |
| 15 | Low | `/marketplace` (signed out) | Buy button reads "**Choose wallet**" even when signed out; buying also needs an account, so "Sign in to buy" would be clearer. At 375 px the sort box cuts off "Newest can…". | `CandyPages.tsx` |
| 16 | Info | `/deploy-testnet` | "tell Codex" is gone (known issue **fixed**). The page is open to anyone and offers **Reconnect wallet** to a first-time visitor. | — |
| 17 | Info | `/collection` | Deployed bundle now shows "Local test network" only on chain 31337, so hosted shows Base Sepolia (known issue **fixed** in deploy). Not seen on screen (sign-in gate). | — |
| 18 | Info | `/social` | Page now exists on hosted (sign-in gate shown), so the frontend has been redeployed. Header link correctly hidden while signed out. | — |

---

## Signed-in pass (Chrome, your account)

Run in Chrome 1710×930, signed in as the account owner (research workspace owner, contributor
replay) with wallet `0xC964…781c` on Base Sepolia. Nothing was sent, saved, listed, bought,
published or disconnected: I typed into inputs only to test them, then cleared them.

### New problems

| # | Severity | Page | Problem |
|---|---|---|---|
| 19 | High | `/dashboard` | Whole dashboard waits ~12 s on `/candy/collection` (10.4 s) although account, contributions and heist data arrive in <2 s. During that time the card already shows **Continue my heist** under "Opening your corner of Caspy…". |
| 20 | High | `/collection`, `/account` chooser | Chain reads are slow: `/candy/collection` 17.2 s, `/market/account` 15.8 s; profile-picture chooser ~15 s. "Taking a little longer" appears correctly after ~8 s. |
| 21 | Medium | `/collection` | **Read source prompt** took 8 s with no visible loading text (button just looks pressed); no `aria-expanded`/`aria-busy`. |
| 22 | Medium | `/heists` vs `/collection`/`/dashboard` | Counters disagree: history says **Candies 5**, dashboard and collection say **4**. Heist #3 ("Earlier season", Won) shows no grade, no reward card and no explanation. |
| 23 | Medium | `/heists` | Opens on #8 ("No prompts were sent") instead of the newest heist with a conversation (#7). |
| 24 | Medium | `/research` | **Publish reviewed dataset** is enabled with 0 approved examples (not clicked). |
| 25 | Low | `/account` chooser | **Caspy default** is hidden while candies load; no option marked as current even though the header avatar is candy #2 (currently listed, so not selectable). |
| 26 | Low | `/dashboard` | Recent activity rows all read "Independent heist · Private play" with a date only — no outcome or grade, unlike Heist history. |
| 27 | Low | Wallet dialog (connected) | Says "Connect your wallet and sign a free message…" when already connected. |
| 28 | Low | `/social` | "Copied" confirmation is not in a live region (screen readers won't hear it). |
| 29 | Info | `/heists` #7 | Judged a win, but Caspy's last reply is conditional ("If it impresses? You'll get…"). Worth a look for G2 (honest results) — a reader may not see it as a yes. |

### Checks that passed

- **Header:** Dashboard and Social links appear when signed in; avatar, name and short wallet address shown; `aria-current` on the right item.
- **Dashboard:** name, counters (8 heists, 4 candies, 0 research), "3 of 3 prompts remaining · Continue my heist", shortcut cards to Collection/Marketplace/Research, recent-activity links open `/heists?session=…`.
- **Play (open heist, nothing sent):** "Live AI · Base Sepolia NFT" label; 3 / 3 prompts; 0/500 counter stops at 500; Shift+Enter adds a line; Send disabled when empty; Pause chat animations and "Enable reply sound" (off by default) labelled; footer "Contributor · unlimited heists · three prompts per heist" correct for this role.
- **Heist history:** counts and filters (All 8, Won 6, Unfinished 1, Not on this server 1; "No candy" hidden when empty); ↓ moves between heists; chat bubbles "You · prompt n" / "Caspy"; reward card (grade A, 88/100, Minted, View in collection, Open reward); "Conversation not saved here" shown calmly for #1.
- **Collection:** "Base Sepolia testnet" label (known issue fixed); 4 cards with grade banners; S/A distinguishable; grade filter (S → #3, #1) and search ("moonspell" → #1) work; listed #2 shows price and **Cancel listing**; listing panel needs price + licence tick (button disabled until then).
- **Account:** email, role "Research workspace owner", workspace name; research choices list for all 8 heists; profile-picture chooser lists only owned, unlisted candies (#1, #3, #4) plus Caspy default; Save disabled until a choice; Escape closes and focus returns.
- **Social:** code `XXXX-XXXX`, Copy → "Copied", entry auto-formats (`ABC2-X9K7`), Send enabled only when complete, empty states for requests and friends.
- **Research Lab:** workspace name, metrics with 0 counts, three tabs switch content; empty states for campaigns, evaluations, review and access requests; dataset form says no payment is taken.
- **Datasets:** empty catalog message with link to the workspace.

### Heist #8 play-through (approved by you, 21 Nov)

Three in-world prompts (fix Caspy's lantern in exchange for one candy). Result: **No candy**.

| # | Severity | Problem |
|---|---|---|
| 30 | **High (G2)** | Caspy agreed in character twice but the judge did not count a win. Prompt 1 reply: "One candy it is — but don't expect any tricks, just a treat!" Prompt 2 reply: Caspy "pulls out a single, glitter-dusted candy corn. There. One tiny treat for one fixed lantern." The heist simply continued (3→2→1) with **no note** that the judge hasn't confirmed anything. A player reads this as a win, then loses. Either the persona must not hand over candy unless the judge agrees, or the UI must say after each turn "Caspy said yes in the story, but the judge hasn't confirmed a win". |
| 30a | **Root cause** | The judge **did** return a win on turns 1 and 2 (`YIELD`, confidence 0.97, `exploit_flag: false`, quality 17–18) but also `category: "exploit_attempt"`. `apply_verdict` (`scripts/heist_api.py:257`) vetoes any verdict whose category is `exploit_attempt`, so both wins were silently dropped. Why the category is wrong: (1) the judge prompt (`heist_api.py:37-51`) names only `exploit_attempt` and never defines the other six categories; (2) since ~10 Nov the hosted judge is free `nvidia/nemotron-3.5-super-vl` instead of `gemini-3.6-flash` (8 Nov heists #4–#6 were Gemini and consistent; #7 and #8 are Nemotron and inconsistent). `scripts/cloud_start.py:48-49` seeds `bifrost.config.example.json` (Nemotron routes) whenever `data/config.json` is missing, so a fresh Render container drops the `use-gemini` routing. (3) `validate_verdict` accepts a verdict whose `category` contradicts `exploit_flag`. |
| 31 | High | Loss ending on `/play` says "**A little trick, a lot of heart.** Your heist is complete. Let's see what Caspy left you." and "Heist complete. **Your words made history.**" It doesn't say no candy, uses "trick" wording, and sounds like a win. The checklist expects a clear "no candy" message. |
| 32 | Medium | `/result` for a loss is clear ("The independent judge did not confirm an eligible win. No candy, image request, or NFT is awarded") but gives no reason (no score or judge notes) and only offers **Back to your conversation** — no **Play another heist** for a contributor. |
| 33 | Low | Caspy's replies use "treat"/"tricks" (model output), so the Treat/Trick wording comes back even after the UI is fixed. Consider adding it to the persona prompt. |
| 34 | Low | Heist history lists #8 under **17 Nov 2026, 21:48 WIB** (when the session was created), though it was played on 21 Nov. |

Passed: Enter sends; the input is disabled and a typing animation ("A little ghostly thought…")
shows while Caspy replies; the reply streams in; the counter goes 3 → 2 → 1 → 0 with matching
candy icons and label ("2 of 3 prompts remaining"); scrolling up shows **Back to latest**, which
works; no rating prompt on a private heist (correct); the input is removed after the last prompt;
**Play another heist** shows for a contributor; reloading `/play` restores the full conversation
and ending; Heist history updates (#8 "No candy", a "No candy" filter appears, "Unfinished"
disappears).

### Re-check after deploying PR #7 (21 Nov, later)

PR albertleooonardi/caspy#7 merged as `b06d185` and deployed. New heist with the same lantern
prompt 1 as heist #8:

| | Heist #8 (before) | New heist (after) |
|---|---|---|
| rubric_version | caspy-judge-candy-v2 | **caspy-judge-candy-v3** (fix is live) |
| verdict / confidence | YIELD 0.97 | YIELD 0.90 |
| category / exploit_flag | exploit_attempt / false | **trade** / false |
| outcome | silently lost after 3 prompts | **won on prompt 1** — "You charmed the candy guardian!" |
| judge served | nemotron-3.5-super-vl:free | nemotron-3.5-super-vl:free (**still not Gemini**, #30a part 2 open) |

`/result` for the win: grade **A 88/100** (creativity 17, coherence 16, specificity 18, novelty
37/40) with bars; novelty note "comparison with 4 earlier winning prompts"; "How your prompt is
used" present; **Generate my earned candy** disabled until the consent box is ticked. Art was not
generated.

Frontend bundle is unchanged (`App.ZxEXM8y1.js`), so #2–#9, #11, #31 wording is still live.
Note: **Play another heist** starts a new heist directly, without showing the private/event
choice cards first (could not check the event cards — no campaigns exist).

### Not run — need your go-ahead (they change data on the hosted site)

Judge-unavailable, cut-off and network-drop endings (cannot be triggered safely on the hosted site), a winning
heist and its grade card, generating art, minting, listing or
cancelling a listing, buying, seller withdrawal, friend requests, code regeneration, creating a
campaign or dataset, withdrawing research, changing the profile picture, disconnecting the wallet,
sign out. Phone-width checks of signed-in pages were skipped to avoid resizing your Chrome window.

---

## Checklist results (hosted, read-only)

### 0. Product goals
- ⚠️ G1 Fun and clear — home hero states 3 prompts and "No win means no candy"; CTA visible above the fold on desktop and phone.
- ⏸ G2–G5 — need play/claim flows (local).
- ⚠️ G6 Works for everyone — keyboard, skip link and dialog focus are good; see #12–#14. Reduced motion: 8 `prefers-reduced-motion` CSS rules exist; not emulated.
- ❌ G7 Truthful labels — #2, #3, #5, #6, #9.

### 1. Shared layout
- ✅ Logo → `/`. ✅ Current page highlighted (`aria-current`), ⚠️ duplicate on sign-in panels (#13).
- ✅ Signed-out header shows **Sign in** / **Join Caspy**; Social/Dashboard hidden.
- ✅ 375 px: no page overflow; menu is a horizontal scroll strip (Collection/Research/Datasets off-screen until swiped).
- ✅ Announcement bar link works and does not cover content.
- ✅ Footer links work; footer says "Base Sepolia testnet NFTs · test ETH only · no real funds".
- ✅ Loading states are labelled ("Loading marketplace listings… Checking ownership, prices and saved artwork."). ❌ False empty state on marketplace (#1).
- ⏸ "taking a little longer" text — marketplace load reached 8 s but the empty state replaced it first (#1).
- ✅ Cold start: backend was warm (`/api/auth/me` ≈ 0.2 s); listings endpoint slow (7.7 s and 11.8 s).
- ✅ Skip to content on first Tab, jumps to `main` (tabindex −1). ✅ One `main`, labelled navs ("Main navigation", "Account access").
- ✅ Focus ring visible. ✅ Wallet dialog traps focus, Escape closes, focus returns to the opening button.
- ⚠️ Contrast — no failures on marketplace; small 10 px text slightly low (#14).
- ✅ All images have `alt`; decorative ones `alt=""`. No unnamed buttons or unlabelled inputs found.
- ❌ Wording — #2–#7, #9.

### 2. Home
- ✅ Hero, "3 prompts" and **Let's pull a heist** visible without scrolling (desktop and phone).
- ⚠️ "Watch the walkthrough" goes to `/how-to-play` instead of the film already on the home page.
- ✅ Steps, loot and FAQ match rules (FAQ answers open on `/rules`).
- ✅ Wall of Heists says "Revealed when the season ends" and the gallery says "Reveal coming soon".
- ⏸ Signed-in dashboard.

### 3. Register / sign in
- ✅ Role choice clear; **Research workspace** field appears only for "Evaluate AI".
- ✅ Password show/hide toggles label "Show/Hide password" and `aria-pressed`.
- ✅ Fields `required`, password `minlength=12`, correct `autocomplete`.
- ✅ Page says verification and recovery are not available — ❌ but calls itself a "development build" (#6).
- ✅ Desktop 1280×720: login form fits (bottom at 639 px).
- ⏸ Submit-based checks (mismatch, wrong password, double-submit, `?next=`) — would create/attempt accounts on the shared database.

### 5. Wallet connection (dialog only)
- ✅ Explains signing is free and never authorises a mint or transfer.
- ✅ No wallet: "No browser wallet found. Open this site in your wallet's browser, or install a compatible wallet."
- ⚠️ Title "Choose your test wallet." on hosted (#9).

### 9. Marketplace
- ✅ Row shows image, name, grade A 88/100, seller `0xC964…781c`, price 0.002 test ETH, action.
- ✅ Grade filter → "No candies match those filters" with **Clear filters**; sort options present.
- ✅ "View prompt access & license" says ownership does not transfer copyright.
- ✅ 375 px: row readable, no sideways scroll.
- ❌ False empty state while loading (#1). ⏸ Buy/cancel/proceeds.

### 13–14. Research Lab, Datasets
- ✅ Research signed out: invitation with Sign in / Create account. ❌ no `h1` (#12).
- ✅ Datasets empty catalog explains how datasets are published and that no payment is charged.

### 15. How to play, Rules, Gallery, Privacy, Terms
- ✅ Film plays, pauses, chapter 04 jumps to 0:26; on-screen text overlay acts as captions (native caption track off by default; no CC button — acceptable for a text-led, no-narration film).
- ✅ Written guide matches the hosted flow (Base Sepolia, 500 chars, judge separate) — ❌ except the top banner (#2).
- ✅ Quiz gives feedback in a live region and is keyboard-operable (buttons with `aria-pressed`).
- ✅ Rules FAQ opens/closes (9 `details`). ❌ wording (#4). ⚠️ Rules do not mention the 500-character limit.
- ✅ Gallery examples labelled "Example" and hidden until "Show illustrative examples" is ticked. ❌ Treat/Trick (#7).
- ❌ Privacy and Terms (#5).

### 16. Other pages
- ✅ `/deploy-testnet` reads as an operator page; no "tell Codex" (#16).
- ❌ 404 page (#8).
- ✅ Back/forward between pages worked during the run.

### 18. Known issues re-check
| Known issue | Status on hosted |
|---|---|
| Collection says "Local test network" | **Fixed** in deployed code (#17) |
| Play "one-per-season" / "Local chain · test ETH" | **Still present** in deployed code (#3) |
| Rules "One candy per wallet per deployment" | **Still present** (#4) |
| FAQ mentions "Treats" | **Still present** (#4), also Gallery (#7) |
| Privacy and Terms local-only | **Still present** (#5) |
| `/deploy-testnet` "tell Codex" | **Fixed** |
| Social page missing | **Fixed** — page deployed (#18) |
| Heist #2–#7 "not saved here" locally | ⏸ local only |
