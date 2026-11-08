# Caspy UI/UX refresh — 6 November 2026

The local frontend now has a shared visual system while retaining Caspy's
lavender, candy-orange and illustrated Halloween identity. This work changes
presentation and client interaction feedback; it does not change reward rules,
research permissions, contracts or add a MetaMask integration.

## Review and implemented changes

| Area | Issue | Result |
| --- | --- | --- |
| Shared shell | Navigation hidden at tablet widths; inconsistent small text | Persistent navigation with horizontal access on narrow screens, active route styles, larger reading text, consistent buttons/cards/focus states. |
| Typography | Remote font import adds a network dependency | DM Sans and Space Grotesk hosted locally with swap rendering and preload. Original OFL licenses included under public/fonts. |
| Mobile authentication | Intro pushed login below first screen | Form appears first on small screens; introduction follows. Password visibility, matching confirmation focus, clear sign-in/register navigation. |
| Wallet chooser | Empty state appeared during loading; local/MetaMask distinction unclear | Loading and connecting states disable controls; linked-wallet choice is explicit; copy explains the local test wallet is separate from MetaMask. |
| Gameplay | Optional research form competed with conversation | Expandable research choices, private default preserved, compact reward journey, larger chat/composer controls and concise mobile mascot panel. |
| Rewards | Long-running generation and status failures were confusing | Saved grade and background-generation guidance remain visible; polling status errors are separated from action errors. Journey shows generation/mint/collection stage. |
| Marketplace | No discovery controls; inventory mixed with analytics | Name/number search, grade filter, price sorting, result count, clear-filter action, inventory-first layout and sale history below browsing. |
| Collection | Listing forms crowded every card | Source-prompt show/hide and expandable listing form; clearer empty state and next actions. |
| Transactions | Payout progress/confirmation could be missed | Dedicated proceeds panel, persistent busy/success/error feedback outside token cards, refresh and focus/visibility syncing. Uses configured market details even with no tokens. |
| Research/account | Small tables; destructive action had no confirmation | Readable cards/tables, ordinary keyboard-operable section buttons, inline withdrawal confirmation with focus on cancellation. |
| Datasets | Export click lacked application feedback | Export-ready status tells users to check browser downloads. |
| Walkthrough/support pages | Small labels and controls | Larger playback/quiz controls, responsive single-column notes, readable legal/gallery/rules copy. |
| Chart | Small touch targets and stale selected details | Larger invisible point hit areas, keyboard focus styling, scrollable chart region and selection reset on refresh. |
| Local development | Floating toolbar could obscure controls | Astro development toolbar disabled. |

The stylesheet is organized in `frontend/src/styles/experience.css`, loaded after
the legacy styles. The new shared journey is `RewardJourney.tsx`. Existing
unrelated work and the historical QA report were preserved.

## Validation

- Source review covered the shared shell, home, authentication, gameplay,
  reward/collection/marketplace, account/research/datasets, walkthrough, gallery,
  rules and legal route components.
- Type checking: zero errors, warnings or hints.
- Frontend tests: 11 passed; production build generated 16 routes.
- Chrome responsive preview at 390×844: sign-in form and submit fit the first
  screen, introduction follows; wallet label remains visible; research choices
  expand with unchecked/disabled consent defaults intact.
- Password show/hide was checked with fictional preview text during the initial
  review; no registration, new terms acceptance or password change was performed.
- Existing-account sign-in and linked local-wallet connection succeeded in Chrome.
  Collection loaded the existing grade-S candy. An unmatched search showed the
  no-results message; Clear filters restored the candy and result count. Listing
  controls remained collapsed. Desktop layout was visually checked; evidence is
  saved locally at `data/qa/ui-refresh-2026-11-06/collection-desktop.png`.
- Local font assets and all route HTTP responses were checked during the initial
  review. HTTP success is not presented as full visual or interaction coverage.
- Representative text pairs: body secondary text / paper 5.33:1; primary-button
  text / orange 5.87:1; navigation text / paper 5.04:1. Placeholder color was also
  darkened. This is a spot check, not a WCAG audit.

## Limits

### Collectible-card follow-up

Collection and marketplace candies now use a framed card with a top grade
banner, token number, score and integrated candy-name plate. S grade uses a
gold frame; other grades use lavender. Existing prompt and listing actions stay
below the collectible. Type check and production build passed after this change.
Chrome returned a blank capture during this follow-up, so the new card's final
visual appearance has not been verified in-browser.

The subsequent deck treatment caps cards at 280 CSS pixels, uses layered edge
shadows and compact actions, and centers a single card on narrow screens. Legacy
generic names receive stable UI display aliases (token #1: Moonspell Bonbon);
custom names are preserved. Search includes the display alias. This does not
rewrite committed NFT metadata or claim that aliases were generated from prompts.
Type check and production build passed for the deck update.

### Daily retry follow-up

Persistent NFT gameplay now permits a fresh heist after a loss/void on the next
Jakarta calendar day (00:00 WIB), based on the previous heist's start. A finished
losing screen displays its unlock time and a Start daily heist button. Server
checks remain authoritative even if a browser clock is wrong. Active, in-flight,
pending-review and winning sessions are preserved. The one-mint-per-wallet
contract restriction is unchanged. Original conversations are not deleted.

Validation: 12 game API tests passed, including exact Jakarta midnight boundaries,
same-day replay prevention, next-day reset, restart persistence, old ownership
checks and protected active/pending/winning sessions. Frontend tests (11), type
check and production build passed. Live Chrome daily rollover has not been
verified; the user-managed API must restart to load this change.

### Marketplace board follow-up

At the user's request, marketplace now uses full-width achievement-style rows
instead of deck cards. Each listing shows its artwork thumbnail, candy display
name/number, grade/score, seller wallet and asking price. Buyer and seller actions
retain the existing transaction flow; source-prompt licensing remains available
in an expandable row. Search, grade filters and price sorting remain. Collection
keeps its deck cards. The marketplace graph is removed from rendering; historical
sale data/API are preserved. Layout adapts to stacked rows on narrow screens.

### Signed-in dashboard follow-up

`/dashboard` is the personal landing page after login/registration, and replaces
the public home content for authenticated accounts at `/`. Guests retain the
public home. The dashboard is gated on the existing account session; its data
uses existing authenticated endpoints and owner checks. It displays recorded
heist count, connected-wallet candy count, active research contributions, current
heist/daily-retry/reward guidance, wallet management, shortcuts and five recent
activity summaries. Account settings remain separate at `/account`. Researcher
accounts get a workspace shortcut; contributors get research-choice management.

Dashboard loading is read-only and does not create a game or change consent.
Individual failures show unavailable data and a refresh action. A device without
a stored heist ID is directed to Play for restoration. Past conversations are
not represented as browsable chat history. Type check and 11 frontend tests
passed; production build includes the dashboard as its 17th route. Chrome access
was attempted, but returned blank page captures after navigation; live dashboard
interaction and responsive visual verification remain unconfirmed.

### Account entry layout follow-up

Per the final user direction, the original Caspy PNG is retained and enlarged;
the temporary animated vector mascot was removed. Sign-in uses compact type,
form spacing and viewport-aware artwork. Auth pages omit the announcement/footer;
the header simplifies at smaller widths. Desktop sign-in is designed to fit a
single viewport without hiding overflow. Small screens prioritize the form and
retain normal scrolling when needed for zoom, errors or short viewports.
Registration can scroll to keep all required fields and terms accessible.
Registration now pairs name/email and password/confirmation at wider widths,
reducing the mismatch between form and illustration height. The original Caspy
panel stays alongside the form while scrolling on desktop. Narrow phones stack
fields and disable the sticky panel so every input remains accessible.
Type check and production build passed. Chrome's accessibility tree confirmed
the original artwork and form controls; screenshot verification was unavailable
because the native computer-use service reported no windows.

### Contributor accounts and unlimited replay

The three requested development accounts were confirmed/provisioned in Supabase:
Leonardi existed (password preserved), David and Elroy were created as contributors.
New temporary credentials are in a local ignored file under `data/credentials/`
with permissions 0600; no passwords are included in documentation or Git. These
are operator-provisioned development accounts; no account-terms acceptance or
research consent was asserted on their behalf.

Contributors can start another heist after a win/loss/void without a daily or
heist-count quota, retaining three prompts per conversation. The authenticated
server role controls replay. Unresolved/in-flight games are protected. Existing
LLM budgets, image caps and NFT entitlement/mint limits still apply. Account now
links to previous conversations and their results/claims, with backend ownership
checks intact. Non-contributors keep the daily policy. Validation: 14 game tests,
15 platform tests and 11 frontend tests passed, plus type check/build. Backend
changes require restarting the user-managed launcher.
Live local API login, session readback and logout passed for both newly created
accounts. Leonardi's existing password was neither reset nor exposed.

The earlier live payout discrepancy and bypassed MetaMask integration are not
claimed fixed by presentation changes. New transaction feedback has not been
verified by sending another purchase or payout in this redesign pass. Real
transactions remain user-executed. No new destructive research withdrawal was
performed. General accessibility, screen-reader, browser matrix and load audits
remain outside this bounded design review.
