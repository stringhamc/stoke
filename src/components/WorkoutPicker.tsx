import { useMemo, useState } from 'react'
import { getExercise } from '../data/exercises'
import { FORMAT_INFO, generateWorkout, pickFocus, pickFormat } from '../engine/generator'
import { repNote } from '../engine/reps'
import { useStore } from '../state/store'
import type { Workout, WorkoutFormat } from '../types'
import { groupItems } from '../utils/workoutGroups'

const ALL_FORMATS: WorkoutFormat[] = ['circuit', 'tabata', 'hiit', 'pyramid', 'amrap']

/**
 * Browse today's workout options: one candidate per format, with the app's
 * planned pick badged and listed first. Generation is deterministic for the
 * day, so each preview is exactly the workout you'd get by choosing it.
 */
export function WorkoutPicker({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore()
  const [openFormat, setOpenFormat] = useState<WorkoutFormat | null>(null)

  const { candidates, planned } = useMemo(() => {
    const date = new Date()
    const focus = pickFocus(state.profile, state.progression, date)
    const plannedFormat = pickFormat(state.profile, state.progression.fitnessScore, focus, date)
    const all = ALL_FORMATS.map((f) => generateWorkout(state.profile, state.progression, date, f))
    all.sort((a, b) => Number(b.format === plannedFormat) - Number(a.format === plannedFormat))
    return { candidates: all, planned: plannedFormat }
  }, [state.profile, state.progression])

  const choose = (w: Workout) => {
    // Choosing the planned workout returns to Auto so the daily rotation
    // keeps steering; any other card pins that format for today.
    dispatch({ type: 'set_format', format: w.format === planned ? null : w.format })
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet picker-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Today’s workout options</h3>
        <p className="muted">Tap a workout to see every exercise in it.</p>
        {candidates.map((w) => {
          const groups = groupItems(w)
          const open = openFormat === w.format
          const preview = groups.slice(0, 3).map((g) => getExercise(g.exerciseId).name).join(' · ')
          return (
            <div key={w.format} className={`picker-card ${open ? 'picker-open' : ''}`}>
              <button className="picker-head" onClick={() => setOpenFormat(open ? null : w.format)}>
                <div className="picker-title">
                  <strong>
                    {w.title}
                    {w.format === planned && <span className="planned-badge">Planned for today</span>}
                  </strong>
                  <span className="muted">
                    {FORMAT_INFO[w.format].blurb} · ~{w.estimatedMinutes} min
                  </span>
                  {!open && (
                    <span className="muted picker-preview">
                      {preview}
                      {groups.length > 3 ? ` +${groups.length - 3} more` : ''}
                    </span>
                  )}
                </div>
                <span className="picker-chevron">{open ? '▾' : '▸'}</span>
              </button>
              {open && (
                <div className="picker-body">
                  <ol className="exercise-list">
                    {groups.map((g) => {
                      const ex = getExercise(g.exerciseId)
                      return (
                        <li key={g.exerciseId} className="exercise-row">
                          <div className="exercise-info">
                            <strong>
                              {ex.name}
                              {g.count > 1 ? ` ×${g.count}` : ''}
                            </strong>
                            <span className="muted">
                              {g.targetReps !== undefined
                                ? `${repNote(ex, g.targetReps)} per round`
                                : `${g.workSeconds}s work · ${g.restSeconds}s rest`}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                  <button className="btn-primary big" onClick={() => choose(w)}>
                    Do this workout
                  </button>
                </div>
              )}
            </div>
          )
        })}
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
