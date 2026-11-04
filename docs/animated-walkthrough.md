# Caspy interactive field guide — edition 05

The current film is **100 seconds, 1600×900, 30 fps, H.264 video + stereo AAC**.
It uses large kinetic typography, masked line reveals, spring entrances, sliding
chapter transitions, drawn underlines, animated workflow cards, a typed prompt,
candy counters, floating Caspy artwork, drifting stars and bat silhouettes.
Deep violet, cream, lilac and pumpkin orange carry the Halloween presentation.
No real account, provider response, purchase or mint is recorded; all UI scenes
are illustrations of the implemented application flow.

The soundtrack is an original D-minor composition with bells, organ, bass, wind,
transition accents and a synthesized **wordless ghost choir**. There is no
narrator, spoken voiceover, speech recording, or speech-generation input.

## Chapters

`frontend/src/lib/walkthrough.json` is the shared storyboard used by the native
renderer, audio timing, chapter UI and tests. The film covers:

| Start | Duration | Chapter |
| --- | --- | --- |
| 0:00 | 8 s | Meet Caspy |
| 0:08 | 10 s | Join the haunt: accounts and sign-in |
| 0:18 | 8 s | Choose what to share: research and commercial consent |
| 0:26 | 12 s | Write your pitch: 500 characters and keyboard controls |
| 0:38 | 10 s | Make three count: waiting, counters and adapting |
| 0:48 | 10 s | Trust the result: actor, judge and server |
| 0:58 | 14 s | Earn your candy: confirmed wins and scored C/B/A/S grades |
| 1:12 | 14 s | Your prompt becomes candy: FLUX.1-schnell, mint and collect |
| 1:26 | 8 s | Collect, trade, contribute: licenses, listings and prompt access |
| 1:34 | 6 s | Your turn |

The current media use `frontend/public/videos/caspy-showcase*` and the cache tag
`kinetic-halloween-website-v5`. Original `caspy-walkthrough*` files remain for older links;
they are not used by the current film player.

## Interaction and accessibility

The homepage includes the compact player; `/how-to-play` includes a contextual
chapter sidebar, full chapter navigation and a detailed written guide. Both
players support native play/pause, seek, fullscreen and English instruction
captions, plus previous/next chapter, replay, chapter looping, playback speed,
audio toggle and a direct film download. Arrow keys, Home and End navigate
focused chapter controls. The active chapter and progress are highlighted.

There is no autoplay or automatic audio. The film starts muted; users explicitly
enable the Halloween soundtrack. Page transitions honor reduced-motion settings.
The video plays only after a user action; viewers who prefer no moving film can
use the complete written instructions.

The written guide has **Player** and **Researcher** routes, each with chapter
replay links. An optional three-question knowledge check explains independent
judging, optional research contribution and local test-ETH claims. Answers live
only in page component state, are not submitted to any API, and are not research
contributions. They reset on reload. The guide distinguishes the scripted demo,
AI-only gameplay and local NFT mode.

## Regenerate on macOS

The source generators use native Apple graphics/media frameworks and Python's
standard library. They need no online assets, narrator, or voice files.

```bash
python3 scripts/mix_caspy_halloween.py \
  frontend/src/lib/walkthrough.json data/tutorial-v2
swiftc -suppress-warnings -module-cache-path /private/tmp/caspy-swift-module-cache \
  scripts/render_caspy_showcase.swift -o /private/tmp/caspy-render-showcase-v2
/private/tmp/caspy-render-showcase-v2 \
  frontend/src/lib/walkthrough.json \
  frontend/public/images/logo-transparent.png \
  data/tutorial-v2/soundtrack.wav \
  /private/tmp/caspy-showcase-v2 \
  --candy frontend/public/images/tutorial/candy-example.png \
  --captures frontend/src/lib/walkthrough-shots.json
```

Use `--stills` as a final argument to render only ten chapter previews, the poster,
and instruction captions. Inspect those before encoding. Native graphics and
media access must be available. The encoder converts the original WAV to AAC,
then muxes it with the H.264 film without another video encode. After validation,
copy `caspy-showcase.mp4`, `caspy-showcase-poster.jpg` and `caspy-showcase.en.vtt`
from the export directory to `frontend/public/videos/`.

## Validate

```bash
swiftc -suppress-warnings -module-cache-path /private/tmp/caspy-swift-module-cache \
  scripts/verify_caspy_showcase.swift -o /private/tmp/caspy-verify-showcase-v2
/private/tmp/caspy-verify-showcase-v2 \
  /private/tmp/caspy-showcase-v2/caspy-showcase.mp4 \
  frontend/src/lib/walkthrough.json /private/tmp/caspy-showcase-v2/qa
cd frontend
npm run check
npm test
npm run build
```

Validation for this edition:

- All ten scene previews were inspected for clipping, type hierarchy and reading
  space. The updated guide covers accounts, optional consent, prompts, judging,
  local claims and research; it does not promise a winning prompt.
- The encoded film has one video track and one audio track, lasts 100 seconds,
  and reports 1600×900 at 30 fps. Its size is approximately 34.2 MB.
- Decoded audio RMS is approximately −20.51 dBFS and peak −6.32 dBFS, with zero
  clipped samples. The generator records zero speech inputs/tracks.
- Decoded frames at two and three seconds differ in the Caspy region, confirming
  actual motion. The verifier saves both frames and a machine-readable QA report.
- Chapter boundary tests compare every caption cue to the shared storyboard;
  captions end at 1:40.00. Frontend checking and build validate the interactive UI.

Source WAV and QA reports stay in ignored `data/tutorial-v2/`; no credentials or
real player data are used by the film generator.

The v3 candy revision updates chapters 7–8 and the published film/captions for
win-only graded FLUX candies and fixed-price NFT + prompt-access trading. The
100-second timing, original Halloween score and no-narration format remain.

## Gameplay revision (v4)

The film explicitly follows three prompts → independent evaluation → confirmed
win or loss → scored candy → approved local Schnell artwork → local-chain mint
→ collection and optional marketplace listing. Losses produce no candy, reward
image or NFT. Grades use creativity, coherence, specificity and measured novelty,
not random rarity. The supply cap is 1,000, and generation may take several minutes.
The mint chapter shows a real local Schnell QA candy sample, labeled illustrative
and not a mint; it is not evidence of a successful player heist. The PNG is stored
at `frontend/public/images/tutorial/candy-example.png` for reproducible rendering.

The shared storyboard, captions, written player instructions and knowledge check
were updated together. Existing Halloween music and wordless choir are retained;
there is no voiceover. The film remains 100 seconds with more reading time for
the reward and artwork chapters. Research remains optional and separate from
NFT prompt licensing. The written Researcher guide retains the full research flow.

### v4 verification

The final encoded file passed `verify_caspy_showcase.swift`: 100 seconds,
1600 × 900 at 30 fps, one H.264 video track and one AAC audio track,
34,151,213 bytes. Decoded audio measured −20.51 dBFS RMS / −6.32 dBFS peak
with zero clipped samples; decoded frames confirmed motion. The retained
original Halloween score has no narration. Scene previews were checked for
readable typography and unclipped candy/outcome panels. Frontend checking
reported zero errors/warnings/hints, all seven tests passed, and the production
build passed. Machine-readable media results: ignored
`data/tutorial-v4/media-qa.json`.

Safari smoke check: the guide loaded the v4 media URL, playback started, chapter
08 sought to 1:12 with the new prompt-to-candy instructions, and pause stopped
playback at 1:16. The updated player and captions are served by the existing app.

## Website capture revision (v5)

Eight real website screenshots are now animated inside the film: the empty
heist, partial and completed prompt entry, confirmed grade, generation permission
and button, generation in progress, finished artwork, and mint confirmation.
The screenshot scenes include camera moves, a moving pointer and click pulses.
They supplement the existing outcome diagram, attempt counters and collection /
marketplace illustrations. The film remains 100 seconds, with the Halloween
score and wordless choir and no narration.

These are screenshots of the real compiled frontend rendered against fictional
tutorial responses, not footage of a live eligible win or blockchain transaction.
The source images live in `frontend/public/images/tutorial/website/`; crop regions,
timing and labels live in `frontend/src/lib/walkthrough-shots.json`. Every shot
is labeled as fictional tutorial data; generation time is explicitly condensed.
Collection and marketplace remain explanatory illustrations rather than captured
transactions. Safari/Chrome capture became unreliable during the resumed work;
blank frames were excluded, and the usable saved captures were visually reviewed.

To reproduce the isolated fixture, build the frontend with
`PUBLIC_NFT_ENABLED=true`, `PUBLIC_LOCAL_AI=true`,
`PUBLIC_CONTRACT_ADDRESS=0x1111111111111111111111111111111111111111` and
`PUBLIC_NFT_SEASON=tutorial-only`. For example, from `frontend/`, run
`npm run build -- --outDir ../data/tutorial-v5/site`, then from the repository
root run `python3 scripts/tutorial_capture_server.py data/tutorial-v5/site`.
Only the temporary fixture origin uses the injected tutorial script; the normal
application and its authentication/reward gates are unchanged. API writes and
external fetches are blocked. Capture pages such as `/play/?tutorial=prompt`
and `/result/?tutorial=ready` using native browser UI, then stop the server.
No account, research contribution, image request or NFT is created by the fixture.

Render with `--captures frontend/src/lib/walkthrough-shots.json` as well as
`--candy`. `--stills` exports each chapter and all eight screenshot shot previews
for visual inspection. The renderer crops out browser chrome and only uses
fictional tutorial data; do not replace these with personal account screenshots.

### v5 verification — 4 November 2026

The updated film passed media decoding checks: 100 seconds, 1600 × 900,
30 fps, one video and one audio track, 34,421,352 bytes. Audio RMS is
−20.51 dBFS, peak −6.32 dBFS, with zero clipped samples. Animated frames
were verified; all eight screenshot crops passed bounds and nonblank checks.
Screenshot previews were inspected and heading/capture labels were separated
to remove an overlap found in the first preview. Frontend checking reported
zero errors/warnings/hints, all seven tests passed, and the production build
passed. Media metrics are saved in ignored `data/tutorial-v5/media-qa.json`.
The v5 encode was validated offline; a new browser playback check was limited
by unreliable native browser capture. Earlier v4 playback had passed in Safari.
The temporary capture server was stopped after use.
