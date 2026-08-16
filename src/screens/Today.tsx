import { useState } from 'react'
import { FlagSheet } from '../components/FlagSheet'
import { getExercise } from '../data/exercises'
import { FORMAT_INFO, swapOptions } from '../engine/generator'
import { adherenceRatio, currentStreakDays } from '../engine/progression'
import { STATUS_INFO, trainingStatus } from '../engine/status'
import { FOCUS_LABELS, useStore } from '../state/store'
import type { Workout, WorkoutFormat } from '../types'

const FORMAT_CHOICES: (WorkoutFormat | null)[] = [null, 'circuit', 'tabata', 'hiit', 'pyramid', 'amrap']

/** One row per distinct exercise, with its repeat count (Tabata repeats moves). */
function groupItems(w: Workout): { exerciseId: string; firstIndex: number; count: number; workSeconds: number; restSeconds: number; targetReps?: number; swapped: boolean }[] {
  const groups = new Map<string, { exerciseId: string; firstIndex: number; count: number; workSeconds: number; restSeconds: number; targetReps?: number; swapped: boolean }>()
  w.items.forEach((item, i) => {
    const g = groups.get(item.exerciseId)
    if (g) {
      g.count++
    } else {
      groups.set(item.exerciseId, {
        exerciseId: item.exerciseId,
        firstIndex: i,
        count: 1,
        workSeconds: item.workSeconds,
        restSeconds: item.restSeconds,
        targetReps: item.targetReps,
        swapped: !!item.swappedFrom,
      })
    }
  })
  return [...groups.values()]
}

export function Today({ onStart }: { onStart: () => void }) {
  const { state, dispatch } = useStore()
  const [swapSlot, setSwapSlot] = useState<number | null>(null)
  const [flagSlot, setFlagSlot] = useState<number | null>(null)
  const w = state.todayWorkout

  if (!w) return null

  const streak = currentStreakDays(state.progression.sessions)
  const adherence = adherenceRatio(state.profile, state.progression)
  const status = trainingStatus(state.profile, state.progression)
  const doneToday = state.progression.sessions.some((s) => s.date.slice(0, 10) === w.date)
  const behind = state.progression.sessions.length > 0 && adherence < 0.5
  const groups = groupItems(w)

  return (
    <div className="today">
      <header className="today-header">
        <div>
          <p className="eyebrow">{greeting()}{state.profile.name ? `, ${state.profile.name}` : ''}</p>
          <h1>{doneToday ? 'Nice work today! 🎉' : 'Today’s workout'}</h1>
        </div>
        <div className="stat-pills">
          <span className="pill">🔥 {streak} day streak</span>
          <span className="pill">Level {state.progression.fitnessScore.toFixed(1)}</span>
          {status && (
            <span className="pill" title={STATUS_INFO[status].blurb}>
              <span className="status-dot" style={{ background: STATUS_INFO[status].color }} />
              {STATUS_INFO[status].label}
            </span>
          )}
        </div>
      </header>

      {behind && (
        <div className="notice">
          You’ve trained less than usual lately, so today’s session is a little shorter —
          an easy win to get back in rhythm.
        </div>
      )}

      <div className="format-picker">
        {FORMAT_CHOICES.map((f) => {
          const active = (state.formatOverride ?? null) === f
          return (
            <button
              key={f ?? 'auto'}
              className={`chip ${active ? 'chip-on' : ''}`}
              onClick={() => dispatch({ type: 'set_format', format: f })}
              title={f ? FORMAT_INFO[f].blurb : 'Let Stoke rotate formats for you'}
              aria-pressed={active}
            >
              {f ? FORMAT_INFO[f].label : 'Auto'}
            </button>
          )
        })}
      </div>

      <section className="card workout-card">
        <div className="workout-title">
          <div>
            <h2>{w.title}</h2>
            <p className="muted">
              {FOCUS_LABELS[w.focus]} · {formatSummary(w, groups.length)} · ~{w.estimatedMinutes} min
            </p>
            <p className="muted format-blurb">{FORMAT_INFO[w.format].blurb}</p>
          </div>
          <button className="btn-ghost small" onClick={() => dispatch({ type: 'regenerate_today' })} title="Suggest a different workout">
            ↻ Shuffle
          </button>
        </div>

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
                      ? `${g.targetReps} reps per round`
                      : `${g.workSeconds}s work · ${g.restSeconds}s rest`}
                    {g.swapped ? ' · swapped' : ''}
                  </span>
                </div>
                <button className="btn-ghost small" onClick={() => setSwapSlot(g.firstIndex)}>Swap</button>
              </li>
            )
          })}
        </ol>

        <button className="btn-primary big" onClick={onStart}>
          {doneToday ? 'Do it again' : 'Start workout'}
        </button>
      </section>

      {swapSlot !== null && (
        <SwapSheet
          slotIndex={swapSlot}
          onClose={() => setSwapSlot(null)}
          onFlag={() => {
            setFlagSlot(swapSlot)
            setSwapSlot(null)
          }}
        />
      )}
      {flagSlot !== null && (
        <FlagSheet
          exerciseId={w.items[flagSlot].exerciseId}
          onClose={() => setFlagSlot(null)}
          onDone={() => {
            dispatch({ type: 'resolve_flagged_slot', slotIndex: flagSlot })
            setFlagSlot(null)
          }}
        />
      )}
    </div>
  )
}

function formatSummary(w: Workout, distinct: number): string {
  switch (w.format) {
    case 'amrap':
      return `${distinct} moves · max rounds in ${Math.round((w.totalSeconds ?? 0) / 60)} min`
    case 'tabata':
      return `${distinct} moves in 4-min blocks`
    default:
      return `${distinct} exercises${w.circuits > 1 ? ` × ${w.circuits} circuits` : ''}`
  }
}

function SwapSheet({ slotIndex, onClose, onFlag }: { slotIndex: number; onClose: () => void; onFlag: () => void }) {
  const { state, dispatch } = useStore()
  const w = state.todayWorkout
  if (!w) return null
  const current = getExercise(w.items[slotIndex].exerciseId)
  const options = swapOptions(state.profile, state.progression.fitnessScore, w, slotIndex).slice(0, 8)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h3>Swap “{current.name}”</h3>
        <p className="muted">Alternatives that work the same area at a similar difficulty:</p>
        <div className="swap-list">
          {options.length === 0 && <p className="muted">No good alternatives available with your current setup.</p>}
          {options.map((ex) => (
            <button
              key={ex.id}
              className="swap-option"
              onClick={() => {
                dispatch({ type: 'swap', slotIndex, newExerciseId: ex.id })
                onClose()
              }}
            >
              <strong>{ex.name}</strong>
              <span className="muted">{ex.description}</span>
            </button>
          ))}
        </div>
        <button className="btn-ghost" onClick={onFlag}>
          🤕 It hurts or it’s too difficult
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            dispatch({ type: 'exclude_exercise', id: current.id })
            const remaining = options[0]
            if (remaining) dispatch({ type: 'swap', slotIndex, newExerciseId: remaining.id })
            onClose()
          }}
        >
          🚫 Never show “{current.name}” again
        </button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
