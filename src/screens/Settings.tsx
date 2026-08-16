import { AREA_LABELS } from '../components/FlagSheet'
import { getExercise } from '../data/exercises'
import { FOCUS_LABELS, useStore } from '../state/store'
import type { Equipment, FocusArea } from '../types'

const FOCUS_OPTIONS: FocusArea[] = ['full_body', 'upper_body', 'lower_body', 'core', 'cardio', 'mobility']
const EQUIPMENT_OPTIONS: { id: Equipment; label: string }[] = [
  { id: 'chair', label: 'Sturdy chair' },
  { id: 'wall', label: 'Free wall space' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'band', label: 'Resistance band' },
]

export function Settings() {
  const { state, dispatch } = useStore()
  const p = state.profile

  const toggleFocus = (f: FocusArea) => {
    const focusAreas = p.focusAreas.includes(f) ? p.focusAreas.filter((x) => x !== f) : [...p.focusAreas, f]
    dispatch({ type: 'update_profile', patch: { focusAreas: focusAreas.length > 0 ? focusAreas : ['full_body'] } })
  }
  const toggleEquipment = (q: Equipment) => {
    const equipment = p.equipment.includes(q) ? p.equipment.filter((x) => x !== q) : [...p.equipment, q]
    dispatch({ type: 'update_profile', patch: { equipment } })
  }

  return (
    <div className="settings">
      <h1>Settings</h1>

      <section className="card">
        <h2>Goal</h2>
        <div className="goal-slider">
          <div className="goal-ends">
            <span>🛡️ Injury prevention</span>
            <span>Push progress 🚀</span>
          </div>
          <input
            type="range" min={0} max={100} value={p.goalBalance}
            onChange={(e) => dispatch({ type: 'update_profile', patch: { goalBalance: Number(e.target.value) } })}
          />
          <p className="hint">
            {p.goalBalance < 34
              ? 'Gentle ramp, low-impact moves only, extra rest and a mobility cooldown.'
              : p.goalBalance < 67
                ? 'Balanced: steady progression with moderate-impact moves.'
                : 'Faster ramp with the full library, including high-impact work.'}
          </p>
        </div>
      </section>

      <section className="card">
        <h2>Focus areas</h2>
        <div className="chip-grid">
          {FOCUS_OPTIONS.map((f) => (
            <button key={f} className={`chip ${p.focusAreas.includes(f) ? 'chip-on' : ''}`} onClick={() => toggleFocus(f)}>
              {FOCUS_LABELS[f]}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Training days per week</h2>
        <div className="chip-grid">
          {[2, 3, 4, 5, 6].map((d) => (
            <button
              key={d}
              className={`chip ${p.targetDaysPerWeek === d ? 'chip-on' : ''}`}
              onClick={() => dispatch({ type: 'update_profile', patch: { targetDaysPerWeek: d } })}
            >
              {d}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Equipment</h2>
        <div className="chip-grid">
          {EQUIPMENT_OPTIONS.map((q) => (
            <button key={q.id} className={`chip ${p.equipment.includes(q.id) ? 'chip-on' : ''}`} onClick={() => toggleEquipment(q.id)}>
              {q.label}
            </button>
          ))}
        </div>
      </section>

      {p.flags.length > 0 && (
        <section className="card">
          <h2>Flagged exercises</h2>
          <p className="muted">
            Painful moves stay out (and their body area is protected everywhere) until you
            clear them. Too-difficult moves come back on their own as your level grows.
          </p>
          <ul className="flag-list">
            {p.flags.map((f) => (
              <li key={f.exerciseId}>
                <div className="exercise-info">
                  <strong>{safeName(f.exerciseId)}</strong>
                  <span className="muted">
                    {f.reason === 'painful'
                      ? `🤕 hurts${f.area ? ` — protecting your ${AREA_LABELS[f.area].toLowerCase()}` : ''}`
                      : `😮‍💨 too hard — returns at level ${(f.scoreAtFlag + 1).toFixed(1)}`}
                    {f.note ? ` · “${f.note}”` : ''}
                  </span>
                </div>
                <button
                  className="btn-ghost small"
                  onClick={() => dispatch({ type: 'unflag_exercise', id: f.exerciseId })}
                >
                  Clear
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.excluded.length > 0 && (
        <section className="card">
          <h2>Hidden exercises</h2>
          <p className="muted">Tap to bring one back.</p>
          <div className="chip-grid">
            {p.excluded.map((id) => (
              <button
                key={id}
                className="chip"
                onClick={() => dispatch({ type: 'update_profile', patch: { excluded: p.excluded.filter((x) => x !== id) } })}
              >
                {safeName(id)} ✕
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card danger-zone">
        <h2>Reset</h2>
        <p className="muted">Erase your profile and history and start over.</p>
        <button
          className="btn-ghost"
          onClick={() => {
            if (confirm('Erase all Stoke data on this device?')) dispatch({ type: 'reset_all' })
          }}
        >
          Reset everything
        </button>
      </section>
    </div>
  )
}

function safeName(id: string): string {
  try {
    return getExercise(id).name
  } catch {
    return id
  }
}
