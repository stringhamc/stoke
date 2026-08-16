import type { Exercise } from '../types'

/**
 * Human-readable rep-counting note. The rule set, stated once:
 * - alternating moves (lunges, climbers, twists…): each side counts as one
 *   rep, so 12 reps = 6 per side
 * - per-side moves (split squat, side plank…): timed intervals switch sides
 *   halfway; rep targets mean that many on each side
 */
export function repNote(e: Exercise, targetReps?: number): string | null {
  if (targetReps !== undefined) {
    if (e.repStyle === 'alternating') return `${targetReps} reps — alternating, ${Math.round(targetReps / 2)} per side`
    if (e.repStyle === 'per_side') return `${targetReps} reps on each side`
    return `${targetReps} reps`
  }
  if (e.repStyle === 'alternating') return 'Alternate sides — each side counts as one rep'
  if (e.repStyle === 'per_side') return 'Switch sides halfway through'
  return null
}
