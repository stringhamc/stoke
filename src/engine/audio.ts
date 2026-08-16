/** Synthesized sound effects and voice cues — no audio assets needed. */

let ctx: AudioContext | null = null

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

/** Speak a cue via the browser's built-in voice; replaces any pending cue. */
export function speak(text: string) {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.05
    window.speechSynthesis.speak(u)
  } catch {
    // voice is a nice-to-have
  }
}

export function stopSpeaking() {
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  } catch {
    // ignore
  }
}
