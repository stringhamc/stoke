import { BENCH_TESTS, daysSinceTest, formatValue, RETEST_DAYS, testTrend } from '../engine/benchmark'
import { adherenceRatio, currentStreakDays, sessionsInLastDays } from '../engine/progression'
import { STATUS_INFO, trainingStatus } from '../engine/status'
import { FOCUS_LABELS, useStore } from '../state/store'

export function History({ onStartTest }: { onStartTest: (testId?: string) => void }) {
  const { state } = useStore()
  const { sessions, fitnessScore } = state.progression
  const streak = currentStreakDays(sessions)
  const last14 = sessionsInLastDays(sessions, 14)
  const adherence = adherenceRatio(state.profile, state.progression)
  const totalMinutes = sessions.reduce((s, r) => s + r.minutes, 0)

  const recent = [...sessions].reverse().slice(0, 30)

  const status = trainingStatus(state.profile, state.progression)

  return (
    <div className="history">
      <h1>Your progress</h1>

      <section className="card status-card">
        <h2>Training status</h2>
        {status ? (
          <>
            <p className="status-line" style={{ color: STATUS_INFO[status].color }}>
              <span className="status-dot big" style={{ background: STATUS_INFO[status].color }} />
              {STATUS_INFO[status].label}
            </p>
            <p className="muted">{STATUS_INFO[status].blurb}</p>
          </>
        ) : (
          <p className="muted">
            Building your baseline — complete a couple of workouts and your status
            (recovery, maintaining, productive, …) will appear here.
          </p>
        )}
      </section>

      <div className="stat-grid">
        <div className="stat card">
          <span className="stat-value">{fitnessScore.toFixed(1)}</span>
          <span className="muted">Fitness level (1–10)</span>
        </div>
        <div className="stat card">
          <span className="stat-value">{streak}</span>
          <span className="muted">Day streak</span>
        </div>
        <div className="stat card">
          <span className="stat-value">{sessions.length}</span>
          <span className="muted">Workouts done</span>
        </div>
        <div className="stat card">
          <span className="stat-value">{totalMinutes}</span>
          <span className="muted">Total minutes</span>
        </div>
      </div>

      <BenchmarksCard onStartTest={onStartTest} />

      <section className="card">
        <h2>Last two weeks</h2>
        <p className="muted">
          {last14.length} of {state.profile.targetDaysPerWeek * 2} target sessions
          {' · '}
          {adherence >= 1
            ? 'right on track — progression is unlocked 🚀'
            : adherence >= 0.6
              ? 'close to target — keep it up'
              : 'below target — suggestions are easing off so it’s simple to restart'}
        </p>
        <WeekDots sessions={last14.map((s) => s.date.slice(0, 10))} />
      </section>

      <section className="card">
        <h2>Recent workouts</h2>
        {recent.length === 0 && <p className="muted">Nothing yet — your first workout is waiting on the Today tab.</p>}
        <ul className="session-list">
          {recent.map((s, i) => (
            <li key={`${s.workoutId}-${i}`}>
              <div>
                <strong>{FOCUS_LABELS[s.focus]}</strong>
                <span className="muted"> · {new Date(s.date).toLocaleDateString()}</span>
              </div>
              <span className="muted">
                {s.completedItems}/{s.totalItems} · {s.minutes} min ·{' '}
                {s.feedback === 'easy' ? '😎' : s.feedback === 'right' ? '💪' : '🥵'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function BenchmarksCard({ onStartTest }: { onStartTest: (testId?: string) => void }) {
  const { state } = useStore()
  const benchmarks = state.benchmarks ?? []
  const since = daysSinceTest(benchmarks)
  const due = since !== null && since >= RETEST_DAYS

  return (
    <section className="card">
      <h2>Benchmarks</h2>
      {benchmarks.length === 0 ? (
        <p className="muted">
          Establish your baseline with a short fitness test — max push-ups, timed squats,
          plank hold and more. Retest monthly to watch the numbers move.
        </p>
      ) : (
        <>
          <p className="muted">
            Last tested {since === 0 ? 'today' : `${since} day${since === 1 ? '' : 's'} ago`}
            {due ? ' — time to retest and see what changed 📈' : ''}
          </p>
          <ul className="bench-list">
            {BENCH_TESTS.map((t) => {
              const trend = testTrend(benchmarks, t.id)
              if (!trend) return null
              const delta = trend.previous !== undefined ? trend.latest - trend.previous : null
              const improved = delta !== null && (t.lowerIsBetter ? delta < 0 : delta > 0)
              return (
                <li key={t.id}>
                  <button className="bench-row" onClick={() => onStartTest(t.id)} title={`Retest just ${t.name}, fresh`}>
                    <span>{t.icon} {t.name}</span>
                    <span>
                      <strong>{formatValue(t, trend.latest)}</strong>
                      {delta !== null && delta !== 0 && (
                        <span className={improved ? 'bench-up' : 'bench-down'}>
                          {' '}{improved ? '▲' : '▼'} {formatValue(t, Math.abs(delta))}
                        </span>
                      )}
                      <span className="bench-retest">↻</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {benchmarks.length > 0 && (
        <p className="muted bench-hint">
          Tap a metric to retest it alone and fresh, or run the full battery — it keeps a fixed
          order with built-in rests so sessions stay comparable.
        </p>
      )}
      <button className={due || benchmarks.length === 0 ? 'btn-primary' : 'btn-secondary'} onClick={() => onStartTest()}>
        {benchmarks.length === 0 ? '📋 Take the baseline test' : '📋 Full retest'}
      </button>
    </section>
  )
}

function WeekDots({ sessions }: { sessions: string[] }) {
  const done = new Set(sessions)
  const days: { iso: string; label: string }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({ iso: d.toISOString().slice(0, 10), label: 'SMTWTFS'[d.getDay()] })
  }
  return (
    <div className="week-dots">
      {days.map((d) => (
        <div key={d.iso} className="week-day">
          <span className={`day-dot ${done.has(d.iso) ? 'day-dot-on' : ''}`} />
          <span className="muted day-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}
