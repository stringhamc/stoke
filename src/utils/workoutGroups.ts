import type { Workout } from '../types'

export interface ItemGroup {
  exerciseId: string
  firstIndex: number
  count: number
  workSeconds: number
  restSeconds: number
  targetReps?: number
  swapped: boolean
}

/** One row per distinct exercise, with its repeat count (Tabata repeats moves). */
export function groupItems(w: Workout): ItemGroup[] {
  const groups = new Map<string, ItemGroup>()
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
