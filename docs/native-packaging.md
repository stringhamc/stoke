# Packaging Stoke as native iOS / Android apps

Stoke is fully client-side, so native packaging is a [Capacitor](https://capacitorjs.com)
wrap of the existing build:

```bash
npm install @capacitor/core
npm install -D @capacitor/cli
npx cap init Stoke com.stoke.app --web-dir=dist
npm run build
npx cap add ios       # requires a Mac with Xcode
npx cap add android   # requires Android Studio
npx cap sync
```

## Audio: MIX with the user's music, never pause it

**Requirement:** workout cues (ticks, tones, voice) must blend over whatever
the user is already playing — Spotify, Pandora, podcasts. Never stop or pause
their audio. At most, voice cues may briefly *duck* (slightly lower) the music.

The web app already does its part: it only ever uses Web Audio oscillators
(never `<audio>` media elements, which claim media focus), and it suspends its
AudioContext whenever no cue is sounding so the OS audio session is held only
for the ~1 second a cue lasts. The native shells must configure their audio
sessions to match:

### iOS

Set the audio session category at launch in
`ios/App/App/AppDelegate.swift`, inside
`application(_:didFinishLaunchingWithOptions:)`:

```swift
import AVFAudio

// Mix Stoke's cues over any playing audio. `.ambient` never interrupts other
// apps' playback (and respects the silent switch).
try? AVAudioSession.sharedInstance().setCategory(
  .ambient,
  options: [.mixWithOthers]
)
try? AVAudioSession.sharedInstance().setActive(true)
```

Notes:
- `.ambient` + `.mixWithOthers` = pure blending, the preferred behavior.
- If voice cues get lost under loud music, switch to
  `.playback` with options `[.mixWithOthers, .duckOthers]` — music dips
  slightly while a cue plays, then recovers. Do NOT use plain `.playback`
  (it pauses other apps' audio).
- Never enable the `interruptSpokenAudioAndMixWithOthers` option.

### Android

Android's WebView does not take audio focus for Web Audio output by default,
so cues already mix. To keep it that way:

- Do not add any plugin or native code that requests audio focus
  (`AudioManager.requestAudioFocus`) for playback.
- If a future feature plays longer audio natively and needs focus, request
  `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` only — this briefly lowers other
  audio instead of pausing it — and abandon focus immediately after.
- Native `TextToSpeech`, if ever swapped in for the WebView's speech
  synthesis, should use the `AudioManager.STREAM_MUSIC` stream with no focus
  request, or transient-may-duck at most.

### Acceptance check (both platforms)

1. Start music in Spotify/Pandora.
2. Launch Stoke and run a workout with sound + voice cues on.
3. Music must keep playing throughout — through ticks, go/rest tones, voice
   announcements, and the finish fanfare. A slight momentary volume dip
   during voice lines is acceptable; a pause or stop is a bug.
4. Background Stoke mid-workout and return — music must be unaffected.
