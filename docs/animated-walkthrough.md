# Caspy interactive field guide — edition 02

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
| 0:18 | 12 s | Choose what to share: research and commercial consent |
| 0:30 | 12 s | Write your pitch: 500 characters and keyboard controls |
| 0:42 | 10 s | Make three count: waiting, counters and adapting |
| 0:52 | 10 s | Trust the result: actor, judge and server |
| 1:02 | 10 s | Trick or Treat: confirmed game outcomes |
| 1:12 | 10 s | Claim locally: test wallet, Anvil and token confirmation |
| 1:22 | 12 s | Beyond the heist: review, metrics, licensing and withdrawal |
| 1:34 | 6 s | Your turn |

The current media use `frontend/public/videos/caspy-showcase*` and the cache tag
`kinetic-halloween-v2`. Original `caspy-walkthrough*` files remain for older links;
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
  /private/tmp/caspy-showcase-v2
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
