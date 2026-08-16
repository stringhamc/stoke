import type { Feedback, ProgressionState, SessionRecord, UserProfile } from '../types'

export const MIN_SCORE = 1
export const MAX_SCORE = 10

/** Sessions completed in the trailing `days` days. */
export function sessionsInLastDays(sessions: SessionRecord[], days: number, now = new Date()): SessionRecord[] {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - days)
  return sessions.filter((s) => new Date(s.date) >= cutoff)
}

/**
 * Adherence ratio over the last 14 days: actual workouts vs the user's target.
 * 1.0 means the user is hitting their target frequency; values are clamped to [0, 1.5].
 */
export function adherenceRatio(profile: UserProfile, state: ProgressionState, now = new Date()): number {
  const target = Math.max(1, profile.targetDaysPerWeek) * 2
  const actual = sessionsInLastDays(state.sessions, 14, now).length
  return Math.min(1.5, actual / target)
}

/**
 * Update the fitness score after a completed session.
 *
 * The score climbs when the user reports workouts as easy and is training
 * consistently; it climbs slowly (or holds) when workouts feel hard or the
 * user has been away. An injury-prevention goal damps every increase so
 * difficulty ramps more conservatively.
 */
export function applySession(
  profile: UserProfile,
  state: ProgressionState,
  record: SessionRecord,
  now = new Date(),
): ProgressionState {
  const adherence = adherenceRatio(profile, { ...state, sessions: [...state.sessions, record] }, now)

  const feedbackDelta: Record<Feedback, number> = { easy: 0.5, right: 0.25, hard: -0.3 }
  let delta = feedbackDelta[record.feedback]

  const completionRatio = record.totalItems > 0 ? record.completedItems / record.totalItems : 1
  if (completionRatio < 0.7) delta = Math.min(delta, -0.2)

  if (delta > 0) {
    // Consistency gates progression: training below ~60% of target slows the ramp.
    if (adherence < 0.6) delta *= 0.4
    // Injury-prevention lean halves the ramp at the far end of the dial.
    const caution = 1 - (100 - profile.goalBalance) / 200
    delta *= caution
  }

  const fitnessScore = clamp(state.fitnessScore + delta, MIN_SCORE, MAX_SCORE)
  // Stamp the post-session score so training status can read the trend.
  return { fitnessScore, sessions: [...state.sessions, { ...record, scoreAfter: fitnessScore }] }
}

/**
 * Detraining: if the user has been away, ease the score down so the next
 * suggested workout meets them where they are. ~0.15/week after a 10-day gap.
 */
export function decayForInactivity(state: ProgressionState, now = new Date()): ProgressionState {
  const last = state.sessions[state.sessions.length - 1]
  if (!last) return state
  const daysSince = (now.getTime() - new Date(last.date).getTime()) / 86_400_000
  if (daysSince <= 10) return state
  const decay = ((daysSince - 10) / 7) * 0.15
  return { ...state, fitnessScore: clamp(state.fitnessScore - decay, MIN_SCORE, MAX_SCORE) }
}

export function currentStreakDays(sessions: SessionRecord[], now = new Date()): number {
  const days = new Set(sessions.map((s) => s.date.slice(0, 10)))
  let streak = 0
  const cursor = new Date(now)
  // A streak counts consecutive workout days ending today or yesterday.
  if (!days.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(isoDay(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}
