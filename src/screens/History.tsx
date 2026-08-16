import { adherenceRatio, currentStreakDays, sessionsInLastDays } from '../engine/progression'
import { STATUS_INFO, trainingStatus } from '../engine/status'
import { FOCUS_LABELS, useStore } from '../state/store'

export function History() {
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
