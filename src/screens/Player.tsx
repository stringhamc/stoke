import { useEffect, useMemo, useRef, useState } from 'react'
import { FlagSheet } from '../components/FlagSheet'
import { FormAnim } from '../components/FormAnim'
import { getExercise } from '../data/exercises'
import { sfx, speak, stopSpeaking } from '../engine/audio'
import { repNote } from '../engine/reps'
import { useStore } from '../state/store'
import type { Feedback } from '../types'

type Phase = 'get_ready' | 'work' | 'rest' | 'done'

interface Step {
  phase: 'work' | 'rest'
  slotIndex: number
  circuit: number
  seconds: number
}

export function Player({ onExit }: { onExit: () => void }) {
  const { state } = useStore()
  const w = state.todayWorkout!
  if (w.format === 'amrap') return <AmrapPlayer onExit={onExit} />
  return <IntervalPlayer onExit={onExit} />
}

function IntervalPlayer({ onExit }: { onExit: () => void }) {
  const { state, dispatch } = useStore()
  const w = state.todayWorkout!

  const steps = useMemo<Step[]>(() => {
    const out: Step[] = []
    for (let c = 0; c < w.circuits; c++) {
      w.items.forEach((item, i) => {
        out.push({ phase: 'work', slotIndex: i, circuit: c, seconds: item.workSeconds })
        const isLast = c === w.circuits - 1 && i === w.items.length - 1
        if (!isLast && item.restSeconds > 0) out.push({ phase: 'rest', slotIndex: i, circuit: c, seconds: item.restSeconds })
      })
    }
    return out
  }, [w])

  const [phase, setPhase] = useState<Phase>('get_ready')
  const [stepIndex, setStepIndex] = useState(0)
  const [remaining, setRemaining] = useState(5)
  const [paused, setPaused] = useState(false)
  const [flagging, setFlagging] = useState(false)
  const completedWork = useRef(0)
  const startedAt = useRef(Date.now())

  // Flagging can shrink the plan mid-session; keep the cursor in bounds.
  const safeIndex = Math.min(stepIndex, steps.length - 1)
  const step = steps[safeIndex]

  useEffect(() => {
    if (paused || flagging || phase === 'done') return
    const t = setInterval(() => setRemaining((r) => r - 1), 1000)
    return () => clearInterval(t)
  }, [paused, flagging, phase])

  const sound = state.profile.soundEffects
  const voice = state.profile.voiceCues

  // 3-2-1 countdown ticks at the end of every phase.
  useEffect(() => {
    if (sound && remaining > 0 && remaining <= 3 && phase !== 'done') sfx.tick()
  }, [remaining, phase, sound])

  useEffect(() => {
    if (remaining > 0 || phase === 'done') return
    const announce = (slotIdx: number) => {
      if (!voice) return
      const nx = getExercise(w.items[slotIdx].exerciseId)
      const note = repNote(nx)
      speak(note ? `${nx.name}. ${note}` : nx.name)
    }
    if (phase === 'get_ready') {
      if (sound) sfx.go()
      announce(steps[0].slotIndex)
      setPhase(steps[0].phase)
      setRemaining(steps[0].seconds)
      return
    }
    if (phase === 'work') completedWork.current += 1
    const next = stepIndex + 1
    if (next >= steps.length) {
      if (sound) sfx.done()
      if (voice) speak('Workout complete. Great job!')
      setPhase('done')
      return
    }
    if (steps[next].phase === 'work') {
      if (sound) sfx.go()
      announce(steps[next].slotIndex)
    } else {
      if (sound) sfx.rest()
      const after = steps.slice(next + 1).find((s) => s.phase === 'work')
      if (voice && after) speak(`Rest. Next up: ${getExercise(w.items[after.slotIndex].exerciseId).name}`)
    }
    setStepIndex(next)
    setPhase(steps[next].phase)
    setRemaining(steps[next].seconds)
  }, [remaining, phase, stepIndex, steps, sound, voice, w.items])

  useEffect(() => stopSpeaking, [])

  // Opening announcement.
  useEffect(() => {
    if (voice && steps.length > 0) {
      speak(`Get ready. First up: ${getExercise(w.items[steps[0].slotIndex].exerciseId).name}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const skip = () => setRemaining(0)
  const back = () => {
    if (phase === 'get_ready') return
    const prevWork = findPrevWork(steps, safeIndex, phase === 'work')
    if (prevWork === null) return
    if (steps[safeIndex].phase === 'work' && prevWork < safeIndex) completedWork.current = Math.max(0, completedWork.current - 1)
    setStepIndex(prevWork)
    setPhase('work')
    setRemaining(steps[prevWork].seconds)
  }

  if (phase === 'done') {
    return (
      <FinishScreen
        minutes={Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))}
        completed={completedWork.current}
        onSubmit={(feedback) => {
          dispatch({
            type: 'finish_session',
            completedItems: completedWork.current,
            minutes: Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)),
            feedback,
          })
          onExit()
        }}
      />
    )
  }

  const isWork = phase === 'work'
  const slot = phase === 'get_ready' ? 0 : step.slotIndex
  const ex = getExercise(w.items[slot].exerciseId)
  const nextWorkStep = steps.slice(safeIndex + (phase === 'get_ready' ? 0 : 1)).find((s) => s.phase === 'work')
  const nextEx = nextWorkStep ? getExercise(w.items[nextWorkStep.slotIndex].exerciseId) : null
  const totalWork = steps.filter((s) => s.phase === 'work').length

  return (
    <div className={`player ${isWork ? 'player-work' : 'player-rest'}`}>
      <header className="player-header">
        <button className="btn-ghost small" onClick={onExit}>✕ End</button>
        <span>
          {phase === 'get_ready' ? 'Get ready' : `${completedWork.current + (isWork ? 1 : 0)} / ${totalWork}`}
          {w.circuits > 1 && phase !== 'get_ready' ? ` · circuit ${step.circuit + 1}/${w.circuits}` : ''}
        </span>
      </header>

      <div className="player-main">
        <p className="phase-label">{phase === 'get_ready' ? 'GET READY' : isWork ? 'WORK' : 'REST'}</p>
        <p className="timer">{remaining}</p>
        <FormAnim animId={(phase === 'rest' && nextEx ? nextEx : ex).anim} size={140} />
        <h2 className="player-exercise">{phase === 'rest' && nextEx ? `Next: ${nextEx.name}` : ex.name}</h2>
        <p className="player-desc">{phase === 'rest' && nextEx ? nextEx.description : ex.description}</p>
        {(() => {
          const note = repNote(phase === 'rest' && nextEx ? nextEx : ex)
          return note ? <p className="rep-note">⇄ {note}</p> : null
        })()}
      </div>

      <div className="player-controls">
        <button className="btn-ghost" onClick={back}>⏮ Back</button>
        <button className="btn-primary" onClick={() => setPaused(!paused)}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
        <button className="btn-ghost" onClick={skip}>Skip ⏭</button>
      </div>
      <button className="btn-ghost flag-link" onClick={() => setFlagging(true)}>
        🚩 This move hurts / is too hard
      </button>

      {flagging && (
        <FlagSheet
          exerciseId={w.items[slot].exerciseId}
          onClose={() => setFlagging(false)}
          onDone={() => {
            dispatch({ type: 'resolve_flagged_slot', slotIndex: slot })
            setFlagging(false)
            skip()
          }}
        />
      )}
    </div>
  )
}

/**
 * AMRAP: a fixed countdown, a rep list, and a "Done" button — the user moves
 * through the list at their own pace, racking up as many rounds as possible.
 */
function AmrapPlayer({ onExit }: { onExit: () => void }) {
  const { state, dispatch } = useStore()
  const w = state.todayWorkout!
  const total = w.totalSeconds ?? 600

  const [remaining, setRemaining] = useState(total)
  const [paused, setPaused] = useState(false)
  const [position, setPosition] = useState(0)
  const [finished, setFinished] = useState(false)
  const [flagging, setFlagging] = useState(false)
  const completed = useRef(0)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (paused || flagging || finished) return
    const t = setInterval(() => setRemaining((r) => r - 1), 1000)
    return () => clearInterval(t)
  }, [paused, flagging, finished])

  const sound = state.profile.soundEffects
  const voice = state.profile.voiceCues

  useEffect(() => {
    if (remaining <= 0 && !finished) {
      if (sound) sfx.done()
      if (voice) speak('Time! Workout complete.')
      setFinished(true)
    }
  }, [remaining, finished, sound, voice])

  useEffect(() => stopSpeaking, [])

  const submit = (feedback: Feedback) => {
    dispatch({
      type: 'finish_session',
      completedItems: completed.current,
      minutes: Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)),
      feedback,
    })
    onExit()
  }

  if (finished) {
    return (
      <FinishScreen
        minutes={Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))}
        completed={completed.current}
        onSubmit={submit}
      />
    )
  }

  const round = Math.floor(position / w.items.length) + 1
  const idx = position % w.items.length
  const item = w.items[idx]
  const ex = getExercise(item.exerciseId)
  const mm = Math.floor(Math.max(0, remaining) / 60)
  const ss = String(Math.max(0, remaining) % 60).padStart(2, '0')

  return (
    <div className="player player-work">
      <header className="player-header">
        <button className="btn-ghost small" onClick={() => setFinished(true)}>✕ End</button>
        <span>Round {round} · move {idx + 1}/{w.items.length}</span>
      </header>

      <div className="player-main">
        <p className="phase-label">AMRAP · AS MANY ROUNDS AS POSSIBLE</p>
        <p className="timer amrap-timer">{mm}:{ss}</p>
        <FormAnim animId={ex.anim} size={120} />
        <h2 className="player-exercise">{item.targetReps} × {ex.name}</h2>
        <p className="player-desc">{ex.description}</p>
        {repNote(ex, item.targetReps) && ex.repStyle !== 'standard' && (
          <p className="rep-note">⇄ {repNote(ex, item.targetReps)}</p>
        )}
        <ul className="amrap-list">
          {w.items.map((it, i) => {
            const itemEx = getExercise(it.exerciseId)
            return (
              <li key={i} className={i === idx ? 'amrap-current' : i < idx ? 'amrap-done' : ''}>
                {it.targetReps} × {itemEx.name}
                {itemEx.repStyle === 'per_side' ? ' (each side)' : itemEx.repStyle === 'alternating' ? ` (${Math.round((it.targetReps ?? 0) / 2)}/side)` : ''}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="player-controls">
        <button className="btn-ghost" onClick={() => setPaused(!paused)}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
        <button
          className="btn-primary"
          onClick={() => {
            if (sound) sfx.go()
            completed.current += 1
            const nextIdx = (position + 1) % w.items.length
            if (voice) speak(getExercise(w.items[nextIdx].exerciseId).name)
            setPosition((p) => p + 1)
          }}
        >
          ✓ Done — next
        </button>
      </div>
      <button className="btn-ghost flag-link" onClick={() => setFlagging(true)}>
        🚩 This move hurts / is too hard
      </button>

      {flagging && (
        <FlagSheet
          exerciseId={item.exerciseId}
          onClose={() => setFlagging(false)}
          onDone={() => {
            dispatch({ type: 'resolve_flagged_slot', slotIndex: idx })
            setFlagging(false)
          }}
        />
      )}
    </div>
  )
}

function findPrevWork(steps: Step[], stepIndex: number, restartCurrent: boolean): number | null {
  if (restartCurrent) return stepIndex
  for (let i = stepIndex - 1; i >= 0; i--) {
    if (steps[i].phase === 'work') return i
  }
  return null
}

function FinishScreen({ minutes, completed, onSubmit }: { minutes: number; completed: number; onSubmit: (f: Feedback) => void }) {
  return (
    <div className="player player-done">
      <div className="player-main">
        <p className="phase-label">WORKOUT COMPLETE 🎉</p>
        <h2>
          {completed} exercises in ~{minutes} min
        </h2>
        <p className="player-desc">How did that feel? Your answer tunes tomorrow’s workout.</p>
        <div className="feedback-buttons">
          <button className="btn-secondary" onClick={() => onSubmit('easy')}>😎 Too easy</button>
          <button className="btn-primary" onClick={() => onSubmit('right')}>💪 Just right</button>
          <button className="btn-secondary" onClick={() => onSubmit('hard')}>🥵 Too hard</button>
        </div>
      </div>
    </div>
  )
}

