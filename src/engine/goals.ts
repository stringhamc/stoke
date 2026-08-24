import type { Exercise, Goal } from '../types'

export const GOAL_INFO: Record<Goal, { label: string; icon: string; blurb: string }> = {
  build_muscle: {
    label: 'Build muscle',
    icon: '💪',
    blurb: 'More strength work, upper and lower body, steady overload',
  },
  pullups: {
    label: 'Master pull-ups',
    icon: '🧗',
    blurb: 'A pulling exercise in every workout, climbing the ladder from dead hangs to full pull-ups',
  },
  running: {
    label: 'Keep running strong',
    icon: '🏃',
    blurb: 'Run-pattern cardio stays in your rotation so training never costs you your legs',
  },
  leaner: {
    label: 'Get leaner',
    icon: '🔥',
    blurb: 'Leans toward high-burn formats like HIIT and Tabata',
  },
  mobility: {
    label: 'Move better',
    icon: '🧘',
    blurb: 'More mobility work and cooldowns woven into every week',
  },
}

/** Pick up to this many goals at once — focus beats scattering. */
export const MAX_GOALS = 3

/**
 * The pull-up progression family, easiest to hardest. When the pull-ups goal
 * is active, at least one of these lands in every (non-Tabata) workout the
 * equipment allows.
 */
export const PULL_FAMILY = new Set([
  'band_pull_apart', 'prone_ytw', 'band_row', 'db_row', 'trx_row', 'seated_row_machine',
  'lat_pulldown', 'dead_hang', 'scapular_pulls', 'assisted_pullups', 'negative_pullups', 'pull_ups',
])

const RUN_ANIMS = new Set(['run', 'buttkick'])
const PULL_MUSCLES = new Set(['lats', 'biceps', 'upper back', 'rear delts', 'grip'])

/**
 * Selection weight multiplier for an exercise given the user's goals.
 * 1 = neutral; higher values make the exercise proportionally likelier when
 * the generator picks candidates.
 */
export function goalWeight(e: Exercise, goals: Goal[]): number {
  let w = 1
  if (goals.includes('build_muscle') && e.kind === 'strength') w += 1.5
  if (goals.includes('pullups')) {
    if (PULL_FAMILY.has(e.id)) w += 2.5
    else if (e.muscles.some((m) => PULL_MUSCLES.has(m))) w += 1
  }
  if (goals.includes('running')) {
    if (RUN_ANIMS.has(e.anim) || e.id.startsWith('treadmill')) w += 1.5
    else if (e.kind === 'cardio') w += 0.5
  }
  if (goals.includes('leaner') && e.kind === 'cardio') w += 1
  if (goals.includes('mobility') && e.kind === 'mobility') w += 1.5
  return w
}
