import { useState } from 'react'
import { FOCUS_LABELS, useStore } from '../state/store'
import type { Equipment, FocusArea, UserProfile } from '../types'

const FOCUS_OPTIONS: FocusArea[] = ['full_body', 'upper_body', 'lower_body', 'core', 'cardio', 'mobility']

const EQUIPMENT_OPTIONS: { id: Equipment; label: string }[] = [
  { id: 'chair', label: 'Sturdy chair' },
  { id: 'wall', label: 'Free wall space' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'band', label: 'Resistance band' },
]

const LEVELS = [
  { score: 2, label: 'Just starting', hint: 'New to exercise or coming back from a long break' },
  { score: 4, label: 'Somewhat active', hint: 'I move regularly but don’t train consistently' },
  { score: 6, label: 'Active', hint: 'I work out most weeks' },
  { score: 8, label: 'Very fit', hint: 'Training is part of my routine' },
]

export function Onboarding() {
  const { dispatch } = useStore()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [goalBalance, setGoalBalance] = useState(50)
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>(['full_body'])
  const [days, setDays] = useState(3)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [level, setLevel] = useState(4)

  const toggleFocus = (f: FocusArea) =>
    setFocusAreas((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]))
  const toggleEquipment = (q: Equipment) =>
    setEquipment((prev) => (prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]))

  const finish = () => {
    const profile: UserProfile = {
      name: name.trim(),
      goalBalance,
      focusAreas: focusAreas.length > 0 ? focusAreas : ['full_body'],
      targetDaysPerWeek: days,
      equipment,
      excluded: [],
      flags: [],
      soundEffects: true,
      voiceCues: true,
      onboarded: true,
    }
    dispatch({ type: 'complete_onboarding', profile, initialScore: level })
  }

  const steps = [
    <section key="welcome" className="card">
      <h1>Welcome to Stoke</h1>
      <p>Short, science-style interval workouts that adapt to you — no gym required.</p>
      <label className="field">
        <span>What should we call you?</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </label>
    </section>,

    <section key="goal" className="card">
      <h2>What matters more to you?</h2>
      <p>This tunes how aggressively your workouts ramp up, how much rest you get, and whether high-impact moves appear.</p>
      <div className="goal-slider">
        <div className="goal-ends">
          <span>🛡️ Injury prevention</span>
          <span>Push progress 🚀</span>
        </div>
        <input
          type="range" min={0} max={100} value={goalBalance}
          onChange={(e) => setGoalBalance(Number(e.target.value))}
        />
        <p className="hint">
          {goalBalance < 34
            ? 'Gentle ramp, low-impact moves only, extra rest and a mobility cooldown.'
            : goalBalance < 67
              ? 'Balanced: steady progression with moderate-impact moves.'
              : 'Faster ramp with the full exercise library, including high-impact work.'}
        </p>
      </div>
    </section>,

    <section key="focus" className="card">
      <h2>Focus areas</h2>
      <p>Pick one or more. Your daily suggestions rotate through them so muscles get time to recover.</p>
      <div className="chip-grid">
        {FOCUS_OPTIONS.map((f) => (
          <button key={f} className={`chip ${focusAreas.includes(f) ? 'chip-on' : ''}`} onClick={() => toggleFocus(f)}>
            {FOCUS_LABELS[f]}
          </button>
        ))}
      </div>
    </section>,

    <section key="freq" className="card">
      <h2>How often do you want to train?</h2>
      <p>We’ll pace your progression around this — and adapt if life gets in the way.</p>
      <div className="chip-grid">
        {[2, 3, 4, 5, 6].map((d) => (
          <button key={d} className={`chip ${days === d ? 'chip-on' : ''}`} onClick={() => setDays(d)}>
            {d} days/week
          </button>
        ))}
      </div>
      <h2 style={{ marginTop: '1.5rem' }}>Current fitness</h2>
      <div className="level-list">
        {LEVELS.map((l) => (
          <button key={l.score} className={`level ${level === l.score ? 'chip-on' : ''}`} onClick={() => setLevel(l.score)}>
            <strong>{l.label}</strong>
            <span>{l.hint}</span>
          </button>
        ))}
      </div>
    </section>,

    <section key="equipment" className="card">
      <h2>What do you have handy?</h2>
      <p>Everything works with just your bodyweight — extras unlock more variety.</p>
      <div className="chip-grid">
        {EQUIPMENT_OPTIONS.map((q) => (
          <button key={q.id} className={`chip ${equipment.includes(q.id) ? 'chip-on' : ''}`} onClick={() => toggleEquipment(q.id)}>
            {q.label}
          </button>
        ))}
      </div>
    </section>,
  ]

  const last = step === steps.length - 1

  return (
    <div className="onboarding">
      {steps[step]}
      <div className="onboarding-nav">
        {step > 0 && (
          <button className="btn-ghost" onClick={() => setStep(step - 1)}>Back</button>
        )}
        <button className="btn-primary" onClick={() => (last ? finish() : setStep(step + 1))}>
          {last ? 'Build my plan' : 'Next'}
        </button>
      </div>
      <div className="dots">
        {steps.map((_, i) => (
          <span key={i} className={i === step ? 'dot on' : 'dot'} />
        ))}
      </div>
    </div>
  )
}
