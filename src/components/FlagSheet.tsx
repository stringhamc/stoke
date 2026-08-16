import { useState } from 'react'
import { getExercise } from '../data/exercises'
import { useStore } from '../state/store'
import type { ExerciseFlagReason, JointArea } from '../types'

export const AREA_LABELS: Record<JointArea, string> = {
  knees: 'Knees',
  shoulders: 'Shoulders',
  wrists: 'Wrists',
  lower_back: 'Lower back',
  ankles: 'Ankles',
  tailbone: 'Tailbone',
  neck: 'Neck',
}

const ALL_AREAS = Object.keys(AREA_LABELS) as JointArea[]

/**
 * Two-step flow to report a problem with an exercise: pick "hurts" vs
 * "too difficult"; pain asks where so the app can protect that area
 * everywhere, not just for this one exercise.
 */
export function FlagSheet({ exerciseId, onDone, onClose }: {
  exerciseId: string
  onDone: (reason: ExerciseFlagReason) => void
  onClose: () => void
}) {
  const { dispatch } = useStore()
  const ex = getExercise(exerciseId)
  const [step, setStep] = useState<'reason' | 'pain'>('reason')
  const [area, setArea] = useState<JointArea | null>(ex.jointLoad[0] ?? null)
  const [note, setNote] = useState('')

  const submitPain = () => {
    dispatch({ type: 'flag_exercise', id: exerciseId, reason: 'painful', area: area ?? undefined, note })
    onDone('painful')
  }
  const submitTooHard = () => {
    dispatch({ type: 'flag_exercise', id: exerciseId, reason: 'too_hard' })
    onDone('too_hard')
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {step === 'reason' ? (
          <>
            <h3>Trouble with “{ex.name}”?</h3>
            <button className="swap-option" onClick={() => setStep('pain')}>
              <strong>🤕 It hurts</strong>
              <span className="muted">
                Tell us where — we’ll drop this move and steer future workouts away from
                everything that stresses that area.
              </span>
            </button>
            <button className="swap-option" onClick={submitTooHard}>
              <strong>😮‍💨 Too difficult right now</strong>
              <span className="muted">
                We’ll bench it and bring it back automatically once your fitness level
                has grown a full level.
              </span>
            </button>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
          </>
        ) : (
          <>
            <h3>Where does it hurt?</h3>
            <p className="muted">
              Areas this move is known to stress are listed first.
            </p>
            <div className="chip-grid">
              {[...ex.jointLoad, ...ALL_AREAS.filter((a) => !ex.jointLoad.includes(a))].map((a) => (
                <button key={a} className={`chip ${area === a ? 'chip-on' : ''}`} onClick={() => setArea(a)}>
                  {AREA_LABELS[a]}
                </button>
              ))}
              <button className={`chip ${area === null ? 'chip-on' : ''}`} onClick={() => setArea(null)}>
                Just this exercise
              </button>
            </div>
            <label className="field">
              <span>Anything else? (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. old injury flares up" />
            </label>
            <button className="btn-primary" onClick={submitPain}>Save</button>
            <button className="btn-ghost" onClick={() => setStep('reason')}>Back</button>
          </>
        )}
      </div>
    </div>
  )
}
