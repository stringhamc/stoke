import { useState } from 'react'
import { GOAL_INFO, MAX_GOALS } from '../engine/goals'
import type { Goal } from '../types'

const ALL_GOALS = Object.keys(GOAL_INFO) as Goal[]

/**
 * Goal selection with a built-in focus nudge: up to three goals, and copy
 * that encourages narrowing rather than collecting.
 */
export function GoalPicker({ value, onChange }: { value: Goal[]; onChange: (goals: Goal[]) => void }) {
  const [bumped, setBumped] = useState(false)

  const toggle = (g: Goal) => {
    if (value.includes(g)) {
      setBumped(false)
      onChange(value.filter((x) => x !== g))
      return
    }
    if (value.length >= MAX_GOALS) {
      setBumped(true)
      return
    }
    setBumped(false)
    onChange([...value, g])
  }

  return (
    <div>
      <div className="level-list">
        {ALL_GOALS.map((g) => (
          <button key={g} className={`level ${value.includes(g) ? 'chip-on' : ''}`} onClick={() => toggle(g)}>
            <strong>{GOAL_INFO[g].icon} {GOAL_INFO[g].label}</strong>
            <span>{GOAL_INFO[g].blurb}</span>
          </button>
        ))}
      </div>
      <p className={`hint ${bumped ? 'hint-warn' : ''}`}>
        {bumped
          ? `Three is the limit — deselect one first. Spreading effort across too many goals slows all of them; you can rotate goals anytime.`
          : value.length >= MAX_GOALS
            ? `That's a full plate — a focused ${MAX_GOALS} is the sweet spot. Rotate goals in Settings as they're achieved.`
            : value.length === 0
              ? `Pick 1–${MAX_GOALS}. Fewer goals at a time means faster progress on each — you can always rotate later.`
              : `Good focus. Add up to ${MAX_GOALS - value.length} more, or keep it tight — fewer goals progress faster.`}
      </p>
    </div>
  )
}
