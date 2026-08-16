import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import type { AppState, ExerciseFlagReason, Feedback, FocusArea, JointArea, UserProfile, Workout, WorkoutFormat } from '../types'
import { applySwap, generateWorkout, swapOptions } from '../engine/generator'
import { applySession, decayForInactivity, isoDay } from '../engine/progression'

const STORAGE_KEY = 'stoke-state-v1'

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  goalBalance: 50,
  focusAreas: ['full_body'],
  targetDaysPerWeek: 3,
  equipment: [],
  excluded: [],
  flags: [],
  onboarded: false,
}

const INITIAL: AppState = {
  profile: DEFAULT_PROFILE,
  progression: { fitnessScore: 3, sessions: [] },
  todayWorkout: null,
  formatOverride: null,
}

type Action =
  | { type: 'complete_onboarding'; profile: UserProfile; initialScore: number }
  | { type: 'update_profile'; patch: Partial<UserProfile> }
  | { type: 'ensure_today' }
  | { type: 'regenerate_today' }
  | { type: 'set_format'; format: WorkoutFormat | null }
  | { type: 'swap'; slotIndex: number; newExerciseId: string }
  | { type: 'finish_session'; completedItems: number; minutes: number; feedback: Feedback }
  | { type: 'exclude_exercise'; id: string }
  | { type: 'flag_exercise'; id: string; reason: ExerciseFlagReason; area?: JointArea; note?: string }
  | { type: 'unflag_exercise'; id: string }
  | { type: 'resolve_flagged_slot'; slotIndex: number }
  | { type: 'reset_all' }

function withFreshWorkout(state: AppState): AppState {
  const progression = decayForInactivity(state.progression)
  const todayWorkout = generateWorkout(state.profile, progression, new Date(), state.formatOverride)
  return { ...state, progression, todayWorkout }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'complete_onboarding':
      return withFreshWorkout({
        ...state,
        profile: { ...action.profile, onboarded: true },
        progression: { ...state.progression, fitnessScore: action.initialScore },
      })
    case 'update_profile':
      return withFreshWorkout({ ...state, profile: { ...state.profile, ...action.patch } })
    case 'ensure_today': {
      if (state.todayWorkout && state.todayWorkout.date === isoDay(new Date())) return state
      // A new day clears yesterday's manual format choice.
      return withFreshWorkout({ ...state, formatOverride: null })
    }
    case 'regenerate_today':
      return withFreshWorkout(state)
    case 'set_format':
      return withFreshWorkout({ ...state, formatOverride: action.format })
    case 'swap': {
      if (!state.todayWorkout) return state
      return { ...state, todayWorkout: applySwap(state.todayWorkout, action.slotIndex, action.newExerciseId) }
    }
    case 'finish_session': {
      const w = state.todayWorkout
      if (!w) return state
      // AMRAP has no fixed rep of the list — whatever you got done on the
      // clock counts as complete, so it never triggers the bail-out penalty.
      const totalItems = w.format === 'amrap'
        ? Math.max(action.completedItems, w.items.length)
        : w.items.length * w.circuits
      const record = {
        workoutId: w.id,
        date: new Date().toISOString(),
        completedItems: action.completedItems,
        totalItems,
        feedback: action.feedback,
        minutes: action.minutes,
        focus: w.focus,
      }
      const progression = applySession(state.profile, state.progression, record)
      return { ...state, progression }
    }
    case 'exclude_exercise': {
      const excluded = [...new Set([...state.profile.excluded, action.id])]
      return { ...state, profile: { ...state.profile, excluded } }
    }
    case 'flag_exercise': {
      const flags = [
        ...state.profile.flags.filter((f) => f.exerciseId !== action.id),
        {
          exerciseId: action.id,
          reason: action.reason,
          area: action.area,
          note: action.note?.trim() || undefined,
          scoreAtFlag: state.progression.fitnessScore,
          date: new Date().toISOString(),
        },
      ]
      return { ...state, profile: { ...state.profile, flags } }
    }
    case 'unflag_exercise': {
      const flags = state.profile.flags.filter((f) => f.exerciseId !== action.id)
      return { ...state, profile: { ...state.profile, flags } }
    }
    // After flagging, replace the exercise in today's plan with the best safe
    // alternative — or drop it entirely if nothing suitable is left.
    case 'resolve_flagged_slot': {
      const w = state.todayWorkout
      if (!w || !w.items[action.slotIndex]) return state
      const opts = swapOptions(state.profile, state.progression.fitnessScore, w, action.slotIndex)
      if (opts.length > 0) return { ...state, todayWorkout: applySwap(w, action.slotIndex, opts[0].id) }
      const oldId = w.items[action.slotIndex].exerciseId
      const items = w.items.filter((i) => i.exerciseId !== oldId)
      return { ...state, todayWorkout: { ...w, items } }
    }
    case 'reset_all':
      return INITIAL
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL
    const parsed = JSON.parse(raw) as AppState
    return {
      profile: { ...DEFAULT_PROFILE, ...parsed.profile },
      progression: { ...INITIAL.progression, ...parsed.progression },
      todayWorkout: parsed.todayWorkout ?? null,
    }
  } catch {
    return INITIAL
  }
}

interface Store {
  state: AppState
  dispatch: (action: Action) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (state.profile.onboarded) dispatch({ type: 'ensure_today' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.profile.onboarded])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

export const FOCUS_LABELS: Record<FocusArea, string> = {
  full_body: 'Full body',
  upper_body: 'Upper body',
  lower_body: 'Lower body',
  core: 'Core',
  cardio: 'Cardio',
  mobility: 'Mobility',
}

export type { Workout }
