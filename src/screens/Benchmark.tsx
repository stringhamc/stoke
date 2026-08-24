import { useEffect, useRef, useState } from 'react'
import { FormAnim } from '../components/FormAnim'
import { sfx, speak, stopSpeaking } from '../engine/audio'
import { BENCH_TESTS, estimateScore, formatValue, REST_BEFORE, sessionBlendWeight, testsFor } from '../engine/benchmark'
import type { BenchTest } from '../engine/benchmark'
import { useStore } from '../state/store'

type Phase = 'ready' | 'timing' | 'entry' | 'rest'

/**
 * Guided fitness tests. As a full battery: fixed order with enforced rests,
 * so session-to-session numbers stay comparable. With `only` set: one test,
 * done fresh. Every test is skippable; results save as one benchmark session
 * and recalibrate the fitness score (battery = half weight, singles = quarter).
 */
export function Benchmark({ onExit, only }: { onExit: () => void; only?: string }) {
  const { state, dispatch } = useStore()
  const tests = only ? BENCH_TESTS.filter((t) => t.id === only) : testsFor(state.profile)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [elapsed, setElapsed] = useState(0)
  const [restSecs, setRestSecs] = useState(0)
  const [entry, setEntry] = useState('')
  const [entryMin, setEntryMin] = useState('')
  const [entrySec, setEntrySec] = useState('')
  const results = useRef<Record<string, number>>({})
  const sound = state.profile.soundEffects
  const voice = state.profile.voiceCues

  const test: BenchTest | undefined = tests[index]
  const done = index >= tests.length

  // One ticking clock for countdowns, stopwatches, and rest periods.
  useEffect(() => {
    if (phase !== 'timing' && phase !== 'rest') return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  // Rest countdown between battery tests.
  useEffect(() => {
    if (phase !== 'rest') return
    const left = restSecs - elapsed
    if (left <= 3 && left > 0 && sound) sfx.tick()
    if (left <= 0) {
      if (sound) sfx.go()
      setElapsed(0)
      setPhase('ready')
    }
  }, [elapsed, phase, restSecs, sound])

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
              Estimated fitness level from this test: <strong>{estimate.toFixed(1)}</strong>. Saving
              {sessionBlendWeight(session) < 0.5
                ? ' gently nudges your current level (small sessions get quarter weight)'
                : ` blends it into your current level (${state.progression.fitnessScore.toFixed(1)})`}
              {' '}and retunes your workouts. Retest in about 4 weeks to see the numbers move.
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
    const performed = value !== undefined && Number.isFinite(value) && value >= 0
    if (performed) results.current[test.id] = value
    setElapsed(0)
    setEntry('')
    setEntryMin('')
    setEntrySec('')
    const next = tests[index + 1]
    // Enforced rest before the next battery test — only when this one was
    // actually performed (a skip costs no fatigue) and the next is physical.
    if (performed && test.mode !== 'manual_time' && next && next.mode !== 'manual_time' && REST_BEFORE[next.id]) {
      setRestSecs(REST_BEFORE[next.id])
      setPhase('rest')
    } else {
      setPhase('ready')
    }
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

  if (phase === 'rest') {
    return (
      <div className="player player-rest benchmark">
        <header className="player-header">
          <button className="btn-ghost small" onClick={onExit}>✕ Exit</button>
          <span>Fitness test · {index + 1} / {tests.length}</span>
        </header>
        <div className="player-main">
          <p className="phase-label">REST — SHAKE IT OUT</p>
          <p className="timer">{Math.max(0, restSecs - elapsed)}</p>
          <h2 className="player-exercise">Next: {test.icon} {test.name}</h2>
          <p className="player-desc">
            Full rest keeps the next number honest — and resting the same way every
            session keeps your tests comparable over time.
          </p>
          <button className="btn-ghost" onClick={() => { setElapsed(0); setPhase('ready') }}>
            I’m ready — skip the rest
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="player benchmark">
      <header className="player-header">
        <button className="btn-ghost small" onClick={onExit}>✕ Exit</button>
        <span>{only ? 'Single test' : `Fitness test · ${index + 1} / ${tests.length}`}</span>
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
