# Animated Caspy walkthrough

The current showcase is a 56-second, 1440×810 H.264/AAC MP4 at 24 fps. It adds
floating Caspy artwork, moving sparkles and candy, crossfades, a typed chat
illustration, three-turn cards, Treat/Trick cards, and recorded UI with animated
cursor highlights. It includes energetic synthetic English narration, an original Halloween backing
score with voice-priority ducking, burned-in captions,
and a seven-cue WebVTT track. It describes the scripted demo and simulated claim.

Website assets use `frontend/public/videos/caspy-showcase*`. The original
`caspy-walkthrough*` assets remain available for older download links. The new
player uses a fresh media URL, a 16:9 layout, and chapters at 0, 8, 16, 24, 32, 40,
and 48 seconds. Video loading remains deferred until the visitor plays it.

The compositor source is `scripts/render_caspy_showcase.swift`. Local generation
inputs are retained under the ignored `data/tutorial-source/` directory. The two
UI captures are from a synthetic browser demo, with Safari chrome cropped out.

Regenerate on macOS with the native media framework:

```sh
swiftc -module-cache-path /private/tmp/caspy-swift-module-cache \
  scripts/render_caspy_showcase.swift -o /private/tmp/caspy-render-showcase
/private/tmp/caspy-render-showcase \
  data/tutorial-source/scenes.json \
  frontend/public/images/logo-transparent.png \
  data/tutorial-source \
  /private/tmp/caspy-showcase-export
```

Add `--stills` to produce just seven scene previews and a poster. The encoder
uses the companion `narration.m4a` beside the scene JSON. It exports generic
`caspy-walkthrough` filenames; copy those to the website's `caspy-showcase`
filenames after QA. Native graphics, speech, and media codecs need local runtime
access. Scene JSON carries eight-second scene lengths; update chapter timings
and captions alongside any timing changes.

Validation performed: visual inspection of all seven scene previews, final
video/audio duration and dimensions, 24 fps video track, non-empty AAC audio,
and differing decoded Caspy-region frames at one and two seconds. Frontend
TypeScript/Astro checks and the nine-route production build passed.

## Halloween audio edit

The narrator now uses the installed Eddy English voice with a brisker rate and
more expressive punctuation. The original soundtrack combines celesta/bell
arpeggios, soft organ and bass, airy wind textures, and light rhythmic accents.
Music is lowered automatically while speech is active. No external music was
used. Captions, chapter positions, and the animation still span 56 seconds.

`mix_caspy_halloween.py` composes and mixes the retained scene WAV files.
`remix_video_audio.swift` replaces only the audio, preserving the encoded video.
The encoded stereo mix was decoded and checked: duration 56 seconds, sample
peak -1.54 dBFS, no clipped samples. Before encoding, the narration averages
about 17 dB above the ducked background. Source inputs and the mix report remain
in ignored `data/tutorial-source/`. The website uses a new media cache version
so returning visitors receive the updated soundtrack.
