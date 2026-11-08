# Recorded heists and automatic artwork updates — 8 November 2026

`/heists` is an account-protected history page. Dashboard's Recorded heists,
View all heists and recent activity link to it; Account's View heist links open
the same private detail view. It shows the full saved transcript, outcome,
prompts used, date in WIB, and saved grade/token information when available.
Current-season records can open their existing game/reward; older seasons are
read-only and never create a new heist. Missing archived transcripts are reported
explicitly rather than manufactured from research samples.

`GET /account/heists/<id>` checks contribution ownership before reading current
game state or archived PostgreSQL snapshots. Email/password login suffices for
reading the account's own history; wallet proof is still required for playing,
claiming and trading. The endpoint returns an allowlisted view and omits model
configuration, provider records, auth tokens and other accounts' histories.
Research withdrawal and data-sharing controls are unchanged.

The reward page checks ongoing artwork/mint status automatically every 2.5
seconds after each request settles. Errors retry with bounded backoff up to 15
seconds. Returning to a visible tab, focusing it or coming online checks progress
immediately. Hidden tabs pause reads; cleanup removes timers/listeners. Requests
never overlap. Polling stops when the relevant job finishes; it never repeats
image creation, consumes an attempt, rerolls a grade or submits a transaction.
Refresh status remains a recovery option, not a required completion step.

Gateway product names were removed from player instructions, footer, campaign
description and user-facing chat failures. Operational code and provider/privacy
records remain accurate. No infrastructure sleep/quota bypass is introduced.

Validation: 31 frontend tests including automatic recovery/foreground/no-overlap
cases; four isolated HTTP tests, including owner/other-account/anonymous/archived
history access; one real Supabase HTTP case in a disposable schema; 15 game
tests; frontend type checks and production build (19 pages) passed. Browser
visual verification and new player generation/mint are not claimed by these
checks.
