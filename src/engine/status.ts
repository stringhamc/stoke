import type { ProgressionState, TrainingStatus, UserProfile } from '../types'
import { adherenceRatio } from './progression'

/**
 * Classify the user's current training status from recent load, feedback and
 * the fitness-score trend — in the spirit of watch-style training status:
 *
 * - detraining:   away long enough that fitness is slipping
 * - recovery:     training light after previous work; body is absorbing it
 * - maintaining:  steady load, fitness holding level
 * - productive:   load and recovery balanced, fitness climbing
 * - overreaching: load well above plan and it's starting to bite
 *
 * Returns null until there's enough history to say anything (2 sessions).
 */
export function trainingStatus(profile: UserProfile, state: ProgressionState, now = new Date()): TrainingStatus | null {
  const sessions = state.sessions
  if (sessions.length < 2) return null

  const last = sessions[sessions.length - 1]
  const daysSince = (now.getTime() - new Date(last.date).getTime()) / 86_400_000
  if (daysSince > 10) return 'detraining'

  const adherence = adherenceRatio(profile, state, now)
  const recent = sessions.slice(-5)
  const hardRatio = recent.filter((s) => s.feedback === 'hard').length / recent.length
  const scored = recent.filter((s) => s.scoreAfter !== undefined)
  const trend = scored.length >= 2 ? scored[scored.length - 1].scoreAfter! - scored[0].scoreAfter! : 0

  if (adherence >= 1.25 && (hardRatio >= 0.4 || trend < 0)) return 'overreaching'
  if (adherence >= 0.75 && trend > 0.15) return 'productive'
  if (adherence < 0.6) return 'recovery'
  return 'maintaining'
}

export const STATUS_INFO: Record<TrainingStatus, { label: string; blurb: string; color: string }> = {
  detraining: {
    label: 'Detraining',
    blurb: 'You’ve been away for a while, so fitness is slipping. Workouts are eased down for a smooth restart.',
    color: '#8b94ab',
  },
  recovery: {
    label: 'Recovery',
    blurb: 'Training load is light right now — your body is absorbing earlier work. Ease back in when ready.',
    color: '#67e8f9',
  },
  maintaining: {
    label: 'Maintaining',
    blurb: 'Steady load — you’re holding your fitness level. Rate a few workouts “too easy” to start climbing.',
    color: '#60a5fa',
  },
  productive: {
    label: 'Productive',
    blurb: 'Load and recovery are in balance and your fitness is climbing. Keep doing what you’re doing.',
    color: '#4ade80',
  },
  overreaching: {
    label: 'Overreaching',
    blurb: 'You’re training well above plan and it’s starting to bite. Suggestions are dialed back a touch — an easy day now protects the streak.',
    color: '#fbbf24',
  },
}
