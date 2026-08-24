import { useEffect, useRef, useState } from 'react'
import { FormAnim } from '../components/FormAnim'
import { sfx, speak, stopSpeaking } from '../engine/audio'
import { estimateScore, formatValue, testsFor } from '../engine/benchmark'
import type { BenchTest } from '../engine/benchmark'
import { useStore } from '../state/store'

type Phase = 'ready' | 'timing' | 'entry'

/**
 * Guided fitness-test battery. Every test is skippable; results save as one
 * benchmark session and recalibrate the fitness score.
 */
export function Benchmark({ onExit }: { onExit: () => void }) {
  const { state, dispatch } = useStore()
  const tests = testsFor(state.profile)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [elapsed, setElapsed] = useState(0)
  const [entry, setEntry] = useState('')
  const [entryMin, setEntryMin] = useState('')
  const [entrySec, setEntrySec] = useState('')
  const results = useRef<Record<string, number>>({})
  const sound = state.profile.soundEffects
  const voice = state.profile.voiceCues

  const test: BenchTest | undefined = tests[index]
  const done = index >= tests.length

  // One ticking clock for both countdown and stopwatch modes.
  useEffect(() => {
    if (phase !== 'timing') return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'timing' || !test || test.mode !== 'countdown60') return
    const remaining = 60 - elapsed
    if (remaining <= 3 && remaining > 0 && sound) sfx.tick()
    if (remaining <= 0) {
      if (sound) sfx.done()
      setPhase('entry')
    }
  }, [elapsed, phase, test, sound])

  useEffect(() => stopSpeaking, [])

  useEffect(() => {
    if (test && voice) speak(`${test.name}. ${test.protocol}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  if (done || !test) {
    const session = { date: new Date().toISOString(), results: results.current }
    const estimate = estimateScore(session)
    const measured = Object.keys(results.current).length
    return (
      <div className="player player-done">
        <div className="player-main">
          <p className="phase-label">TEST COMPLETE 📋</p>
          <h2>{measured} of {tests.length} tests recorded</h2>
          {estimate !== null ? (
            <p className="player-desc">
              Estimated fitness level from this test: <strong>{estimate.toFixed(1)}</strong>. Saving will
              blend it into your current level ({state.progression.fitnessScore.toFixed(1)}) and retune
              your workouts. Retest in about 4 weeks to see the numbers move.
            </p>
          ) : (
            <p className="player-desc">Nothing recorded this time — no changes will be made.</p>
          )}
          <div className="feedback-buttons">
            {measured > 0 && (
              <button
                className="btn-primary"
                onClick={() => {
                  dispatch({ type: 'save_benchmark', session })
                  onExit()
                }}
              >
                Save results
              </button>
            )}
            <button className="btn-secondary" onClick={onExit}>Discard</button>
          </div>
        </div>
      </div>
    )
  }

  const advance = (value?: number) => {
    if (value !== undefined && Number.isFinite(value) && value >= 0) results.current[test.id] = value
    setPhase('ready')
    setElapsed(0)
    setEntry('')
    setEntryMin('')
    setEntrySec('')
    setIndex(index + 1)
  }

  const startTimer = () => {
    if (sound) sfx.go()
    setElapsed(0)
    setPhase('timing')
  }

  const stopStopwatch = () => {
    if (sound) sfx.done()
    advance(elapsed)
  }

  const remaining = test.mode === 'countdown60' ? Math.max(0, 60 - elapsed) : elapsed

  return (
    <div className="player benchmark">
      <header className="player-header">
        <button className="btn-ghost small" onClick={onExit}>✕ Exit</button>
        <span>Fitness test · {index + 1} / {tests.length}</span>
      </header>

      <div className="player-main">
        <p className="phase-label">{test.icon} {test.name.toUpperCase()}</p>

        {phase === 'timing' ? (
          <p className="timer">{remaining}</p>
        ) : (
          <FormAnim animId={test.anim} size={130} />
        )}

        <p className="player-desc">{test.protocol}</p>

        {phase === 'ready' && test.mode === 'entry' && (
          <EntryRow value={entry} onChange={setEntry} unit="reps" onSubmit={() => advance(parseInt(entry, 10))} />
        )}

        {phase === 'ready' && test.mode === 'manual_time' && (
          <div className="bench-entry">
            <input inputMode="numeric" placeholder="min" value={entryMin} onChange={(e) => setEntryMin(e.target.value)} />
            <span>:</span>
            <input inputMode="numeric" placeholder="sec" value={entrySec} onChange={(e) => setEntrySec(e.target.value)} />
            <button
              className="btn-primary"
              disabled={entryMin === '' && entrySec === ''}
              onClick={() => advance(parseInt(entryMin || '0', 10) * 60 + parseInt(entrySec || '0', 10))}
            >
              Record
            </button>
          </div>
        )}

        {phase === 'ready' && (test.mode === 'countdown60' || test.mode === 'stopwatch') && (
          <button className="btn-primary big" onClick={startTimer}>
            {test.mode === 'countdown60' ? '▶ Start 60 seconds' : '▶ Start the clock'}
          </button>
        )}

        {phase === 'timing' && test.mode === 'stopwatch' && (
          <button className="btn-primary big" onClick={stopStopwatch}>⏹ I stopped — record {formatValue(test, elapsed)}</button>
        )}

        {phase === 'entry' && (
          <EntryRow value={entry} onChange={setEntry} unit="reps" onSubmit={() => advance(parseInt(entry, 10))} />
        )}

        {phase !== 'timing' && (
          <button className="btn-ghost" onClick={() => advance()}>Skip this test</button>
        )}
      </div>
    </div>
  )
}

function EntryRow({ value, onChange, unit, onSubmit }: {
  value: string
  onChange: (v: string) => void
  unit: string
  onSubmit: () => void
}) {
  return (
    <div className="bench-entry">
      <input inputMode="numeric" placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} />
      <span>{unit}</span>
      <button className="btn-primary" disabled={value === ''} onClick={onSubmit}>Record</button>
    </div>
  )
}
