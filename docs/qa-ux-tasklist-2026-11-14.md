# Caspy UI/UX QA task list — 14 November 2026

A checklist for testing what players and researchers see and do. Each section starts
with the feature's **goal**: what a user should be able to do. The checks below the
goal confirm that the screen supports it. This list covers interface and experience.
Security and backend logic are in `docs/qa-plan-2026-11-14.md`.

## How to use this list

- Tick a box only after you have done the step and seen the result yourself.
- When a check fails, write the page, the screen size, the browser and what you saw
  next to the item, and add a screenshot to `docs/qa-evidence/` if you can.
- Mark a check `N/A` when it cannot apply (for example wallet checks in AI-only mode).
- **Where to test.** Use the local app (`./run.sh`) for anything that signs in, plays,
  generates art, mints or trades. On the hosted site
  (https://caspy-prompt-heist.vercel.app) only open pages and read; do not create
  accounts, heists or transactions there.
- Local test accounts are written to the shared Supabase database (see the QA plan,
  E-3). Use clearly fictional names such as `qa-player-1@example.com`.
- Recommended screens: desktop 1440×900, laptop 1280×720, tablet 768×1024, phone 375×812.
  Browsers: Chrome, Safari, Firefox; Safari on iPhone if available.

Legend: **L** needs the local app · **H** safe on the hosted site (read-only) · **L/H** either.

---

## 0. Product goals the whole app should meet

Check these at the end of a full session, across all pages.

- [ ] **G1 Fun and clear.** A first-time visitor understands within one minute that
      they have three prompts to persuade a ghost and that only a win earns candy. (L/H)
- [ ] **G2 Honest results.** Nothing says "you won" until the server confirms it.
      Caspy's friendly reply alone never looks like a win. (L)
- [ ] **G3 No surprises with money or data.** Every screen that involves a wallet,
      a transaction, research sharing or image generation says what will happen
      before it happens and asks first. (L)
- [ ] **G4 Never lose progress.** After a reload, a closed tab, a slow server or a
      backend restart, the player gets back to the same heist, result and reward. (L)
- [ ] **G5 Private by default.** Research sharing is off unless the player turns it on,
      and can be withdrawn later. (L)
- [ ] **G6 Works for everyone.** Usable by keyboard only, with a screen reader, at
      375 px wide and with reduced motion. (L/H)
- [ ] **G7 Truthful labels.** Network names, limits and rules on screen match the
      environment you are using (Local Anvil locally, Base Sepolia when hosted). (L/H)

---

## 1. Shared layout and behaviour (every page)

**Goal:** the user always knows where they are, can get anywhere, and is never left
staring at a blank or frozen screen.

### Navigation and header
- [ ] Logo returns home; signed-in users land on their dashboard. (L/H)
- [ ] The current page is highlighted in the menu (`aria-current`). (L/H)
- [ ] Signed-out header shows **Sign in** and **Join Caspy**; signed-in header shows
      avatar and name. (L/H)
- [ ] **Social** and **Dashboard** links appear only when signed in. (L)
- [ ] Wallet button text matches the state: Connect / Choose test wallet / short address. (L)
- [ ] At 375 px the header does not overflow and every menu item is reachable. (L/H)
- [ ] Announcement bar link works and does not cover content. (L/H)

### Footer and legal
- [ ] Footer links all work. (H)
- [ ] Footer network note says "Local chain" locally and "Base Sepolia testnet" on the
      hosted site. (L/H)

### Loading, slow and offline states
- [ ] Every page that loads data shows a labelled loading state, not a blank area. (L/H)
- [ ] After about 8 seconds the loading text changes to "taking a little longer". (L)
- [ ] With the backend stopped, signed-in pages say the sign-in **could not be checked**
      and offer a retry. They must not say the user was signed out. (L)
- [ ] With the backend slow (cold start on Render, 30–90 s), the first page eventually
      loads or shows a clear retry. Note how long it takes. (H — just open the site after it has been idle)
- [ ] Error messages are in plain words, do not show stack traces, HTTP codes alone, or
      provider names, and say what to do next. (L)
- [ ] Success messages appear near the action and disappear or can be dismissed. (L)

### Accessibility basics
- [ ] **Skip to content** link appears on first Tab and jumps to the main area. (L/H)
- [ ] Each page has one `h1`, one `main`, and labelled navigation regions. (L/H)
- [ ] Every button and link can be reached with Tab in a sensible order, and the focus
      ring is visible on light and dark backgrounds. (L/H)
- [ ] Dialogs (wallet, profile picture, withdrawal) trap focus, close with Escape, and
      return focus to the button that opened them. (L)
- [ ] Text contrast meets 4.5:1 (3:1 for large text and controls). Check muted grey
      text, orange highlights, badges and error text. (L/H)
- [ ] With `prefers-reduced-motion`, animations stop (hero, chat typing, cards, video). (L/H)
- [ ] Images have useful alt text; decorative icons are hidden from screen readers. (L/H)
- [ ] Zoom to 200 %: no text is cut off and nothing needs sideways scrolling. (L/H)

### Wording
- [ ] No leftover developer text on public pages (for example "tell Codex",
      "local v2 contracts", "Check Anvil" on the hosted site). (H)
- [ ] Rules are stated the same way everywhere: three prompts, 500 characters,
      win-only candy, grades C/B/A/S, 1,000 supply, contributor replay, daily retry for
      other accounts, multiple candies per wallet on v3. (L/H)
- [ ] No "Treat/Trick" or "one per season" wording in the NFT build. (L/H)

---

## 2. Home (`/`)

**Goal:** a visitor understands the game, trusts it, and starts playing in one click.

- [ ] Hero headline, "3 prompts" message and **Let's pull a heist** button are visible
      without scrolling on desktop and phone. (H)
- [ ] "Watch the walkthrough" opens or scrolls to the film. (H)
- [ ] The three steps, loot section and FAQ match current rules. (H)
- [ ] "Wall of Heists" makes clear it is not available yet. (H)
- [ ] Signed-in users see their dashboard instead of the marketing page. (L)

## 3. Register and sign in (`/register`, `/login`)

**Goal:** a new person creates an account in under a minute; a returning person signs
in without friction and lands where they meant to go.

- [ ] Choosing "Play & contribute" vs "Evaluate AI" is clear; the workspace name field
      appears only for researchers. (L)
- [ ] Password show/hide works and is announced. (L)
- [ ] Mismatched passwords show an error next to the field and focus moves there. (L)
- [ ] Too-short password, bad email and missing terms show clear messages before or
      after submit. (L)
- [ ] Wrong password and unknown email give the same message. (L)
- [ ] The button shows "Signing you in…" and cannot be pressed twice. (L)
- [ ] After sign-in the user lands on the dashboard, or on the page in `?next=`. (L)
- [ ] Already signed in: the form is replaced by "You're signed in" with a dashboard link. (L)
- [ ] The page says email verification and password recovery are not available. (L/H)
- [ ] Desktop: the login form fits in one screen. Phone: fields stack and nothing is cut off. (L/H)

## 4. Dashboard (`/dashboard`)

**Goal:** a signed-in player sees what to do next in one glance.

- [ ] Welcome line uses the player's name and avatar. (L)
- [ ] The main card matches the current heist: start, continue (with prompts left),
      check judge, open reward, next daily heist time, or "play another" for contributors. (L)
- [ ] Counters (recorded heists, candies in this wallet, research contributions) are
      correct, and say "Connect wallet" or "Unavailable" rather than a wrong 0. (L)
- [ ] Refresh updates the data without clearing what is shown. (L)
- [ ] Recent activity links open the right heist in Heist history. (L)
- [ ] Shortcut cards go to collection, marketplace and research/account. (L)

## 5. Wallet connection

**Goal:** the player proves they own a wallet with one signature and understands it
costs nothing.

- [ ] The dialog explains that signing is free and does not authorise a transaction. (L)
- [ ] Local: the test-wallet list loads, shows which wallet is linked, and the button is
      disabled while loading. (L)
- [ ] Hosted: without a browser wallet, the message says how to get one. (H — open the dialog only, do not sign)
- [ ] Wrong network prompts a switch. (L)
- [ ] Rejecting the signature shows "cancelled" and lets the player try again. (L)
- [ ] A wallet already linked to another account shows a clear refusal. (L)
- [ ] Disconnect works and the header updates. (L)

## 6. The heist (`/play`)

**Goal:** the player has a fair, readable conversation with Caspy, always knows how
many prompts are left, and is never charged a prompt for a failure that was not theirs.

### Before starting
- [ ] Signed out: the page asks to sign in. NFT mode without wallet: asks to connect. (L)
- [ ] **Research events:** the "Private heist" card is selected by default. (L)
- [ ] Each event card shows name, organisation and purpose; long text is trimmed neatly. (L)
- [ ] **Join event** highlights the card and opens the join panel; focus moves to it. (L)
- [ ] Both permission boxes start unticked; the commercial box is disabled until the
      research box is ticked. (L)
- [ ] The status line changes from "Tick the first box…" to "You're in…". (L)
- [ ] **Leave event** returns to private and clears both boxes. (L)
- [ ] No events: the section says the heist will be private. Events fail to load: says
      you can still play privately. (L)
- [ ] At 375 px the event cards stack in one column. (L)

### During the heist
- [ ] Prompt counter shows 3, then 2, then 1, then 0, with candy icons to match. (L)
- [ ] Character counter shows x/500 and stops at 500. (L)
- [ ] Enter sends, Shift+Enter adds a line; typing in an IME does not send early. (L)
- [ ] While Caspy replies: input disabled, typing animation, then streamed text. (L)
- [ ] The chat follows new text; scrolling up shows "Back to latest". (L)
- [ ] Motion pause button works; reduced-motion users see no animation. (L)
- [ ] Sound is off by default and the toggle is labelled. (L)
- [ ] The "Joined event" banner appears for a heist that is part of an event. (L)
- [ ] Optional 1–5 rating appears only for research heists and confirms when saved. (L)

### Endings and problems
- [ ] Win: "You charmed the candy guardian!" and **See your result**. (L)
- [ ] Loss after three prompts: clear "no candy" message. (L)
- [ ] Judge unavailable: "under review" with **Check judge again**; no prompt used. (L)
- [ ] Reply cut off: heist closed, with an honest explanation. (L)
- [ ] Network drop mid-reply: error with **Reconnect & check session**; the typed
      prompt is restored if it was not sent. (L)
- [ ] Reload during and after a heist returns to the same conversation. (L)
- [ ] Contributor: **Play another heist** after any ending. Other roles: next unlock time
      shown in WIB and the button enabled only after it. (L)

## 7. Result and reward (`/result`, `/claim`)

**Goal:** a winner understands their grade, agrees to create artwork, waits calmly,
and mints the candy; a loser understands why there is nothing to claim.

- [ ] Lost / under review / interrupted heists show matching messages and next steps. (L)
- [ ] Grade card shows the letter, score and each part (creativity, coherence,
      specificity, novelty) with readable bars. (L)
- [ ] The novelty note explains the comparison count. (L)
- [ ] **Generate** stays disabled until the consent box is ticked. (L)
- [ ] "How your prompt is used" explains where the prompt goes (local vs hosted). (L)
- [ ] Generation progress shows the stage (Prepare → Create candy → Save artwork) and
      elapsed time, and says it is safe to leave. (L)
- [ ] Leaving and coming back shows the current progress; it updates on its own. (L)
- [ ] Failure, quota refusal, daily limit and retry limit each show a different,
      readable message, and the grade stays the same. (L)
- [ ] Retry needs its own tick box and says how many requests are allowed. (L)
- [ ] Finished artwork appears; if the image fails to load there is a reload button. (L)
- [ ] **Mint my candy** shows progress, then "Your candy is on-chain" with the token
      number and a collection link; no stale error stays on screen. (L)
- [ ] Network label says Local Anvil locally, Base Sepolia when hosted. (L/H)

## 8. Collection (`/collection`)

**Goal:** the player sees every candy they own and can find, read and list one.

- [ ] Without a wallet: clear "connect your wallet" message, not "0 candies". (L/H)
- [ ] Counters: in this wallet, rewards remaining, collection limit. (L/H)
- [ ] Cards show grade banner, number, name and image; S/A/B/C are easy to tell apart. (L)
- [ ] Search by name or number, grade filter and **Clear filters** work. (L)
- [ ] **Read source prompt** opens and hides the prompt, with a loading state. (L)
- [ ] Listing needs a price and the licence tick; each wallet step shows progress. (L)
- [ ] Load failure keeps the last list and says so; it does not show an empty wallet. (L)
- [ ] Refresh and returning to the tab update the list. (L)

## 9. Marketplace (`/marketplace`)

**Goal:** a player can browse listed candies, understand the price and licence, and buy
or cancel safely.

- [ ] Rows show image, name, grade and score, seller (short), price in test ETH, action. (L/H)
- [ ] Own listing shows **Cancel listing**, others show **Buy**. (L)
- [ ] Price sorting and grade filter work. (L/H)
- [ ] "View prompt access & licence" explains that copyright does not transfer. (L/H)
- [ ] Purchase shows progress and then a link to the collection. (L)
- [ ] Seller proceeds panel appears after a sale; withdrawal confirms and the balance
      returns to 0. (L — known open issue, record the result)
- [ ] Empty marketplace: friendly message with a way to start a heist. (L/H)
- [ ] At 375 px each row stays readable without sideways scrolling. (L/H)

## 10. Heist history (`/heists`)

**Goal:** the player finds any past heist quickly, sees how it ended, and reads the
conversation; missing conversations are explained honestly.

- [ ] Opens on the newest heist that has a conversation, or on `?session=`. (L)
- [ ] Each row shows number, date, outcome badge, grade letter if earned, and the start
      of the first prompt. (L — needs restarted backend)
- [ ] Filters (All, Won, No candy, Unfinished, Not on this server) show correct counts
      and hide when empty. (L)
- [ ] ↑ ↓ Home End move through the list; Newer / Older move through heists. (L)
- [ ] Conversation shows as chat bubbles labelled "You · prompt n" and "Caspy". (L)
- [ ] Reward card shows grade, score and minted state, with a collection link. (L)
- [ ] Heists saved on the hosted site show **Open on the hosted site** (locally). (L)
- [ ] Heists with no saved conversation say so calmly, without a red error. (L)
- [ ] Action button matches the state: Continue heist, Check result, Open reward. (L)
- [ ] Phone: list first; tapping a heist shows only that heist with **All heists** back. (L)
- [ ] Older backend (hosted until redeploy): the page still works, outcomes appear when
      a heist is opened. (H — sign-in needed; otherwise mark blocked)

## 11. Social (`/social`)

**Goal:** two people become friends by sharing a code, with nothing else about them
revealed.

- [ ] Own code shows as `XXXX-XXXX`; **Copy** confirms. (L)
- [ ] Code entry formats as you type and only enables **Send** when complete. (L)
- [ ] Sending, accepting, declining, cancelling and removing each show a clear message
      and update the lists. (L)
- [ ] Removing asks for confirmation first. (L)
- [ ] Regenerating the code asks for confirmation and the old code stops working. (L)
- [ ] Unknown code and too many tries show readable messages. (L)
- [ ] Friends show only name and picture (no email or wallet). (L)
- [ ] Empty states for no requests and no friends. (L)
- [ ] Hosted site: page and menu link appear only after the frontend is redeployed. (H)

## 12. Account and profile (`/account`)

**Goal:** the player manages their profile picture, sees their details, and controls
research sharing for each heist.

- [ ] Profile picture chooser lists only candies owned by the connected wallet;
      "Caspy default" is always available; saving updates the header avatar. (L)
- [ ] Without a wallet the chooser explains how to connect. (L)
- [ ] Email, role and workspace are shown correctly. (L)
- [ ] "Your research choices" lists each heist with its sharing state. (L)
- [ ] **Withdraw contribution** opens a confirmation that explains downloaded copies
      cannot be recalled; after withdrawing the row says "Withdrawn". (L)
- [ ] Contributors can create a workspace; the page then shows researcher options. (L)
- [ ] **Sign out** returns to the sign-in page and clears the wallet state. (L)

## 13. Research Lab (`/research`)

**Goal:** a researcher creates a campaign, reviews contributions carefully, reads
honest metrics and publishes a dataset.

- [ ] Signed out: invitation to sign in. Contributor: link to create a workspace. (L/H)
- [ ] Tabs (Campaigns & metrics, Review contributions, Dataset releases) work by mouse
      and keyboard. (L)
- [ ] Creating a campaign validates name and purpose length and confirms success. (L)
- [ ] The new campaign appears as an event card on `/play` for players. (L)
- [ ] Archiving a campaign asks or clearly confirms, and the badge changes. (L)
- [ ] Review: both texts are editable, labels have sensible defaults, approval needs
      the privacy tick, and the badge changes to approved/rejected. (L)
- [ ] Metrics table shows denominators and "Not enough labels" instead of 0 %. (L)
- [ ] Publishing a release explains that only approved, commercially consented examples
      are included and no payment is taken. (L)
- [ ] Access requests list shows buyer and status; grant and deny/revoke work. (L)
- [ ] The page is usable at 375 px (table scrolls inside its box). (L)

## 14. Datasets (`/datasets`)

**Goal:** a researcher understands what each dataset contains and how to get it.

- [ ] Cards show title, owner, example count, price and licence terms. (L/H)
- [ ] Signed out: **Sign in to request access**. Contributor: create a workspace. (L/H)
- [ ] Researcher: request → "Access requested" (disabled); granted → **Download**. (L)
- [ ] Download saves a JSON file and confirms. (L)
- [ ] Empty catalog explains how datasets are published. (L/H)

## 15. How to play, Rules, Gallery, Privacy, Terms

**Goal:** a player can learn the game and their rights without asking anyone.

- [ ] Walkthrough film plays, pauses, seeks by chapter and shows captions. (H)
- [ ] Written guide steps match the current game screens. (H)
- [ ] Quiz (if shown) gives feedback and works with keyboard. (H)
- [ ] Rules FAQ answers open and close; content matches current rules. (H)
- [ ] Gallery examples are clearly labelled as illustrations. (H)
- [ ] Privacy notice describes the hosted setup correctly (Supabase storage, Base Sepolia,
      Gemini and Hugging Face processing). Known issue: it still mentions the local data
      folder and local chain. (H)
- [ ] Terms describe Base Sepolia when hosted, not only Anvil. (H)

## 16. Other pages

- [ ] `/deploy-testnet` is understood as an operator page; no developer-only wording. (H — do not connect a wallet)
- [ ] An unknown address shows a friendly 404 with a way home. (H)
- [ ] Browser back and forward work between all pages without losing state. (L/H)

---

## 17. Full journeys

Run these end to end on the local app and note any confusing moment.

- [ ] **J1 New player wins:** register → connect wallet → play privately → win →
      generate art → mint → see it in collection → set it as profile picture. (L)
- [ ] **J2 New player loses:** play three prompts → loss → understand when they can
      play again. (L)
- [ ] **J3 Research contributor:** join an event → play → rate a reply → withdraw the
      contribution in Account. (L)
- [ ] **J4 Researcher:** create workspace → publish campaign → review a contribution →
      publish dataset → second researcher requests → grant → download. (L)
- [ ] **J5 Trader:** list a candy → second player buys → buyer reads prompt → seller
      withdraws proceeds. (L)
- [ ] **J6 Friends:** two players exchange codes, accept, then remove. (L)
- [ ] **J7 Interrupted session:** start a heist, close the tab mid-reply, reopen on
      another browser, find the heist from Dashboard and Heist history. (L)
- [ ] **J8 First visit on the hosted site after it has been idle:** time until the
      dashboard or home is usable. (H)

## 18. Known issues to re-check

From `docs/qa-plan-2026-11-14.md`. Confirm whether each is still visible.

- [ ] Hosted Collection says "Local test network" (fixed in code, not yet deployed). (H)
- [ ] Play page says "one-per-season heist" and "Local chain · test ETH" in the NFT build. (L/H)
- [ ] Rules say "One candy per wallet per deployment" (v3 allows several). (L/H)
- [ ] FAQ mentions "Treats". (L/H)
- [ ] Privacy and Terms describe the local build only. (H)
- [ ] `/deploy-testnet` says "tell Codex". (H)
- [ ] Hosted Social page and link missing until the frontend is redeployed. (H)
- [ ] Heist #2–#7 show "not saved here" locally (expected; conversations are on the hosted site). (L)
