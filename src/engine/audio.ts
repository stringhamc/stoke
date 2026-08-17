/**
 * Synthesized sound effects and voice cues — no audio assets needed.
 *
 * Music-friendly by design: cues must MIX with whatever the user is already
 * playing (Spotify, Pandora, …), never pause it. Two rules serve that:
 * - only Web Audio oscillators, never <audio>/media elements — media elements
 *   claim media focus and pause other apps' playback
 * - the AudioContext is suspended whenever no cue is sounding, so the app
 *   holds the OS audio session only for the ~1s a cue lasts
 * The native (Capacitor) builds additionally pin the OS audio session to
 * mix-with-others — see docs/native-packaging.md.
 */

let ctx: AudioContext | null = null
let suspendTimer: ReturnType<typeof setTimeout> | null = null
let busyUntil = 0

function audioCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      ctx = new Ctx()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Suspend the context shortly after the last scheduled sound finishes. */
function scheduleRelease(endsAt: number) {
  busyUntil = Math.max(busyUntil, endsAt)
  if (suspendTimer) clearTimeout(suspendTimer)
  const waitMs = Math.max(0, (busyUntil - (ctx?.currentTime ?? 0)) * 1000) + 250
  suspendTimer = setTimeout(() => {
    try {
      if (ctx && ctx.state === 'running') void ctx.suspend()
    } catch {
      // ignore
    }
  }, waitMs)
}

function tone(freq: number, at: number, duration: number, volume = 0.09, type: OscillatorType = 'sine') {
  const c = audioCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  const t0 = c.currentTime + at
  gain.gain.setValueAtTime(volume, t0)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + duration)
  scheduleRelease(t0 + duration)
}

export const sfx = {
  /** short countdown tick (3-2-1) */
  tick: () => tone(1000, 0, 0.09, 0.07, 'square'),
  /** work interval starts — rising two-tone */
  go: () => {
    tone(660, 0, 0.12)
    tone(880, 0.12, 0.22)
  },
  /** rest starts — falling tone */
  rest: () => {
    tone(660, 0, 0.12)
    tone(440, 0.12, 0.25)
  },
  /** workout complete — little fanfare */
  done: () => {
    tone(523, 0, 0.15)
    tone(659, 0.15, 0.15)
    tone(784, 0.3, 0.35)
  },
}

/**
 * Pick the most natural-sounding English voice the device offers. Modern
 * platforms ship neural voices (Siri, Google, "Natural"/"Enhanced" variants)
 * alongside the robotic legacy ones — prefer those, in quality order.
 */
let cachedVoice: SpeechSynthesisVoice | null | undefined

function bestVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice
  try {
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'))
    if (voices.length === 0) return null // list may not be loaded yet — retry next call
    const tiers = [
      /natural|neural|premium/i,
      /enhanced|siri/i,
      /google (us|uk) english/i,
      /samantha|daniel|karen|moira/i,
    ]
    for (const tier of tiers) {
      const hit = voices.find((v) => tier.test(v.name))
      if (hit) return (cachedVoice = hit)
    }
    return (cachedVoice = voices.find((v) => v.default) ?? voices[0] ?? null)
  } catch {
    return (cachedVoice = null)
  }
}

// The voice list loads asynchronously on some platforms; refresh the pick.
try {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoice = undefined
      bestVoice()
    }
  }
} catch {
  // ignore
}

/**
 * Speak a cue; replaces any pending cue. `energy: 'pump'` pushes rate and
 * pitch up for trainer-style hype lines.
 */
export function speak(text: string, energy: 'calm' | 'pump' = 'calm') {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voice = bestVoice()
    if (voice) u.voice = voice
    u.rate = energy === 'pump' ? 1.18 : 1.05
    u.pitch = energy === 'pump' ? 1.12 : 1.0
    window.speechSynthesis.speak(u)
  } catch {
    // voice is a nice-to-have
  }
}

/** Rotating trainer hype, deterministic by index so it doesn't repeat back-to-back. */
const HYPE = ['Let’s go!', 'You’ve got this!', 'Nice pace — keep it up!', 'Strong! Stay with it!', 'Push through!']

export function hypeLine(i: number): string {
  return HYPE[i % HYPE.length]
}

export function stopSpeaking() {
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  } catch {
    // ignore
  }
}
