export type FocusArea = 'full_body' | 'upper_body' | 'lower_body' | 'core' | 'cardio' | 'mobility'

export type Equipment = 'none' | 'chair' | 'wall' | 'dumbbells' | 'band'

export type Impact = 'low' | 'moderate' | 'high'

export type ExerciseKind = 'strength' | 'cardio' | 'core' | 'mobility'

export type JointArea = 'knees' | 'shoulders' | 'wrists' | 'lower_back' | 'ankles' | 'tailbone' | 'neck'

export interface Exercise {
  id: string
  name: string
  description: string
  kind: ExerciseKind
  focusAreas: FocusArea[]
  muscles: string[]
  /** 1 (easiest) – 5 (hardest) */
  difficulty: number
  impact: Impact
  /** joints under notable load, used for injury-prevention filtering */
  jointLoad: JointArea[]
  equipment: Equipment[]
}

export type ExerciseFlagReason = 'painful' | 'too_hard'

export interface ExerciseFlag {
  exerciseId: string
  reason: ExerciseFlagReason
  /** body area that hurt — protects other exercises loading the same area */
  area?: JointArea
  note?: string
  /** fitness score when flagged; too_hard exercises return one level later */
  scoreAtFlag: number
  date: string
}

export interface UserProfile {
  name: string
  /** 0 = prioritize injury prevention, 100 = push progress */
  goalBalance: number
  focusAreas: FocusArea[]
  /** target workout days per week */
  targetDaysPerWeek: number
  equipment: Equipment[]
  /** exercise ids the user never wants to see (dislike) */
  excluded: string[]
  /** exercises the user marked as painful or too difficult */
  flags: ExerciseFlag[]
  onboarded: boolean
}

export type WorkoutFormat = 'circuit' | 'tabata' | 'hiit' | 'pyramid' | 'amrap'

export interface WorkoutItem {
  exerciseId: string
  workSeconds: number
  restSeconds: number
  /** rep target instead of a timed interval (AMRAP) */
  targetReps?: number
  /** ids offered when the user asks to swap this slot */
  swappedFrom?: string
}

export interface Workout {
  id: string
  title: string
  /** ISO date the workout was generated for */
  date: string
  format: WorkoutFormat
  items: WorkoutItem[]
  circuits: number
  /** total time cap for self-paced formats (AMRAP) */
  totalSeconds?: number
  focus: FocusArea
  estimatedMinutes: number
}

export type Feedback = 'easy' | 'right' | 'hard'

export interface SessionRecord {
  workoutId: string
  date: string
  completedItems: number
  totalItems: number
  feedback: Feedback
  minutes: number
  focus: FocusArea
  /** fitness score right after this session, for trend analysis */
  scoreAfter?: number
}

export type TrainingStatus = 'detraining' | 'recovery' | 'maintaining' | 'productive' | 'overreaching'

export interface ProgressionState {
  /** continuous fitness score; drives difficulty, duration and circuit count */
  fitnessScore: number
  sessions: SessionRecord[]
}

export interface AppState {
  profile: UserProfile
  progression: ProgressionState
  /** workout currently suggested for today (regenerated daily) */
  todayWorkout: Workout | null
  /** user-picked format for today; null/undefined = let the app choose */
  formatOverride?: WorkoutFormat | null
}
