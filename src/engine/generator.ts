import { EXERCISES, getExercise } from '../data/exercises'
import type {
  Exercise, FocusArea, Impact, JointArea, ProgressionState, UserProfile, Workout, WorkoutFormat, WorkoutItem,
} from '../types'
import { adherenceRatio, clamp, isoDay, sessionsInLastDays } from './progression'
import { trainingStatus } from './status'

const IMPACT_RANK: Record<Impact, number> = { low: 0, moderate: 1, high: 2 }

/** Deterministic PRNG so the same day + profile produces the same suggestion. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** The highest exercise impact allowed for this user right now. */
export function maxImpact(profile: UserProfile): Impact {
  if (profile.goalBalance < 34) return 'low'
  if (profile.goalBalance < 67) return 'moderate'
  return 'high'
}

/** Difficulty window derived from the fitness score (1–10 → exercise difficulty 1–5). */
export function difficultyWindow(fitnessScore: number): { min: number; max: number } {
  const center = 1 + (fitnessScore - 1) * (4 / 9)
  return { min: Math.max(1, Math.floor(center - 1)), max: Math.min(5, Math.ceil(center + 0.5)) }
}

/** Body areas the user reported pain in — exercises loading them are avoided. */
export function protectedAreas(profile: UserProfile): Set<JointArea> {
  const areas = new Set<JointArea>()
  for (const f of profile.flags) if (f.reason === 'painful' && f.area) areas.add(f.area)
  return areas
}

/**
 * Exercise ids currently blocked by flags. Painful ones stay out until the
 * flag is cleared; too-hard ones return automatically once the fitness score
 * has grown a full level past where it was when the user flagged them.
 */
export function blockedIds(profile: UserProfile, fitnessScore: number): Set<string> {
  const blocked = new Set<string>()
  for (const f of profile.flags) {
    if (f.reason === 'painful' || fitnessScore < f.scoreAtFlag + 1) blocked.add(f.exerciseId)
  }
  return blocked
}

export function loadsProtectedArea(e: Exercise, areas: Set<JointArea>): boolean {
  return e.jointLoad.some((j) => areas.has(j))
}

export function eligibleExercises(profile: UserProfile, fitnessScore: number): Exercise[] {
  const impactCap = IMPACT_RANK[maxImpact(profile)]
  const { min, max } = difficultyWindow(fitnessScore)
  const owned = new Set([...profile.equipment, 'none'])
  const blocked = blockedIds(profile, fitnessScore)
  const base = EXERCISES.filter(
    (e) =>
      !profile.excluded.includes(e.id) &&
      !blocked.has(e.id) &&
      IMPACT_RANK[e.impact] <= impactCap &&
      e.difficulty >= min &&
      e.difficulty <= max &&
      e.equipment.every((q) => owned.has(q)),
  )
  // Keep sore areas out of rotation — unless that would leave too little to
  // build a workout from, in which case pain-flagged exercises themselves
  // still stay excluded but same-area ones return.
  const areas = protectedAreas(profile)
  if (areas.size === 0) return base
  const safe = base.filter((e) => !loadsProtectedArea(e, areas))
  return safe.length >= 12 ? safe : base
}

/**
 * Pick today's focus by rotating through the user's chosen focus areas,
 * steering away from whatever was trained most recently so muscle groups
 * get recovery time between sessions.
 */
export function pickFocus(profile: UserProfile, state: ProgressionState, date: Date): FocusArea {
  const areas = profile.focusAreas.length > 0 ? profile.focusAreas : (['full_body'] as FocusArea[])
  if (areas.length === 1) return areas[0]
  const recent = sessionsInLastDays(state.sessions, 3, date).map((s) => s.focus)
  const fresh = areas.filter((a) => !recent.includes(a))
  const pool = fresh.length > 0 ? fresh : areas
  const rng = mulberry32(hashString(isoDay(date)))
  return pool[Math.floor(rng() * pool.length)]
}

/**
 * Pick today's training format: the app rotates between classic
 * circuits, Tabata (20s/10s blocks), longer HIIT intervals, pyramids and
 * rep-based AMRAPs. Cautious users and beginners stay on the steadier
 * formats; a progress-leaning goal weights toward the intense ones.
 */
export function pickFormat(profile: UserProfile, fitnessScore: number, focus: FocusArea, date: Date): WorkoutFormat {
  if (focus === 'mobility') return 'circuit'
  const cautious = profile.goalBalance < 34
  const beginner = fitnessScore < 3

  let weighted: [WorkoutFormat, number][]
  if (cautious || beginner) {
    weighted = [['circuit', 3], ['pyramid', 2], ['amrap', 1.5]]
  } else if (profile.goalBalance >= 67) {
    weighted = [['circuit', 2], ['tabata', 3], ['hiit', 3], ['pyramid', 1.5], ['amrap', 1.5]]
  } else {
    weighted = [['circuit', 3], ['tabata', 1.5], ['hiit', 2], ['pyramid', 1.5], ['amrap', 1.5]]
  }

  const rng = mulberry32(hashString(isoDay(date) + '|fmt'))
  const total = weighted.reduce((s, [, w]) => s + w, 0)
  let roll = rng() * total
  for (const [fmt, w] of weighted) {
    roll -= w
    if (roll <= 0) return fmt
  }
  return 'circuit'
}

interface Shape {
  slots: number
  circuits: number
  workSeconds: number
  restSeconds: number
}

/**
 * Workout shape scales with fitness and adapts to recent behavior:
 * low adherence shrinks the session (an easy win beats a skipped workout),
 * and an injury-prevention lean buys longer rests.
 */
export function workoutShape(profile: UserProfile, state: ProgressionState, now = new Date()): Shape {
  const score = state.fitnessScore
  let slots = Math.round(clamp(8 + (score - 1) * 0.55, 6, 13))
  let circuits = score >= 7.5 ? 3 : score >= 4 ? 2 : 1
  const workSeconds = Math.round(clamp(25 + score * 1.5, 25, 45) / 5) * 5

  const adherence = adherenceRatio(profile, state, now)
  if (adherence < 0.5 && state.sessions.length > 0) {
    slots = Math.max(6, slots - 2)
    circuits = Math.max(1, circuits - 1)
  }

  const cautious = profile.goalBalance < 34
  let restSeconds = cautious ? 15 : score >= 6 ? 10 : 12

  // Overreaching: training well above plan — trim a circuit and add rest so
  // today reads as an easier day rather than more fuel on the fire.
  if (trainingStatus(profile, state, now) === 'overreaching') {
    circuits = Math.max(1, circuits - 1)
    restSeconds += 5
  }

  return { slots, circuits, workSeconds, restSeconds }
}

export const FORMAT_INFO: Record<WorkoutFormat, { label: string; blurb: string }> = {
  circuit: { label: 'Circuit', blurb: 'Steady rotation through every exercise, one interval each' },
  tabata: { label: 'Tabata', blurb: '4-minute blocks: 20s all-out, 10s rest, two moves alternating' },
  hiit: { label: 'HIIT', blurb: 'Long 40s pushes with 20s recoveries' },
  pyramid: { label: 'Pyramid', blurb: 'Work intervals climb up, peak mid-workout, then come back down' },
  amrap: { label: 'AMRAP', blurb: 'A rep list on the clock — as many rounds as possible, your pace' },
}

const FOCUS_TITLES: Record<FocusArea, string> = {
  full_body: 'Full-Body',
  upper_body: 'Upper-Body',
  lower_body: 'Lower-Body',
  core: 'Core',
  cardio: 'Cardio',
  mobility: 'Mobility',
}

/** Stateful picker that avoids repeats and back-to-back muscle overlap. */
function makePicker(rng: () => number) {
  const picked: Exercise[] = []
  const pickOne = (candidates: Exercise[], avoidOverlapWith?: Exercise): Exercise | null => {
    const unused = candidates.filter((e) => !picked.includes(e))
    if (unused.length === 0) return null
    const prev = avoidOverlapWith ?? picked[picked.length - 1]
    const nonAdjacent = prev ? unused.filter((e) => !e.muscles.some((m) => prev.muscles.includes(m))) : unused
    const from = nonAdjacent.length > 0 ? nonAdjacent : unused
    const choice = from[Math.floor(rng() * from.length)]
    picked.push(choice)
    return choice
  }
  return { picked, pickOne }
}

/** ~1 in 4 slots stays general on focus days so nothing atrophies. */
function focusCandidates(mains: Exercise[], focus: FocusArea, slotIndex: number): Exercise[] {
  const wantFocus = focus !== 'full_body' && slotIndex % 4 !== 3
  const inFocus = mains.filter((e) => e.focusAreas.includes(focus))
  return wantFocus && inFocus.length > 0 ? inFocus : mains
}

interface BuildContext {
  rng: () => number
  focus: FocusArea
  shape: Shape
  cautious: boolean
  score: number
  warmups: Exercise[]
  cooldowns: Exercise[]
  mains: Exercise[]
}

function buildCircuit(ctx: BuildContext): { items: WorkoutItem[]; circuits: number } {
  const { pickOne } = makePicker(ctx.rng)
  const items: WorkoutItem[] = []
  const slot = (e: Exercise | null, work: number, rest: number) => {
    if (e) items.push({ exerciseId: e.id, workSeconds: work, restSeconds: rest })
  }

  slot(pickOne(ctx.warmups), ctx.shape.workSeconds, ctx.shape.restSeconds)
  const reserveCooldown = ctx.cautious ? 1 : 0
  const mainSlots = ctx.shape.slots - items.length - reserveCooldown
  for (let i = 0; i < mainSlots; i++) {
    slot(pickOne(focusCandidates(ctx.mains, ctx.focus, i)), ctx.shape.workSeconds, ctx.shape.restSeconds)
  }
  if (reserveCooldown) slot(pickOne(ctx.cooldowns), ctx.shape.workSeconds, ctx.shape.restSeconds)

  return { items, circuits: ctx.shape.circuits }
}

function buildTabata(ctx: BuildContext): { items: WorkoutItem[]; circuits: number } {
  const { pickOne } = makePicker(ctx.rng)
  const items: WorkoutItem[] = []

  const warmup = pickOne(ctx.warmups)
  if (warmup) items.push({ exerciseId: warmup.id, workSeconds: 30, restSeconds: 10 })

  // Each 4-minute block alternates two non-overlapping moves: A B A B A B A B.
  const blocks = ctx.score >= 7 ? 3 : 2
  const pool = ctx.mains.filter((e) => e.kind === 'cardio' || e.kind === 'strength')
  for (let b = 0; b < blocks; b++) {
    const a = pickOne(focusCandidates(pool, ctx.focus, b * 2))
    const bEx = pickOne(focusCandidates(pool, ctx.focus, b * 2 + 1), a ?? undefined)
    if (!a || !bEx) break
    for (let i = 0; i < 4; i++) {
      for (const ex of [a, bEx]) {
        const lastOfBlock = i === 3 && ex === bEx
        const lastOfWorkout = lastOfBlock && b === blocks - 1
        items.push({
          exerciseId: ex.id,
          workSeconds: 20,
          restSeconds: lastOfWorkout ? 0 : lastOfBlock ? 60 : 10,
        })
      }
    }
  }
  return { items, circuits: 1 }
}

function buildHiit(ctx: BuildContext): { items: WorkoutItem[]; circuits: number } {
  const { pickOne } = makePicker(ctx.rng)
  const items: WorkoutItem[] = []
  const work = ctx.score < 4 ? 30 : 40
  const rest = ctx.cautious ? 30 : 20

  const warmup = pickOne(ctx.warmups)
  if (warmup) items.push({ exerciseId: warmup.id, workSeconds: 30, restSeconds: rest })

  const slots = Math.max(4, Math.round(ctx.shape.slots * 0.6))
  for (let i = 0; i < slots; i++) {
    const e = pickOne(focusCandidates(ctx.mains, ctx.focus, i))
    if (e) items.push({ exerciseId: e.id, workSeconds: work, restSeconds: rest })
  }
  if (ctx.cautious) {
    const cool = pickOne(ctx.cooldowns)
    if (cool) items.push({ exerciseId: cool.id, workSeconds: 30, restSeconds: 0 })
  }
  return { items, circuits: Math.min(2, ctx.shape.circuits) }
}

function buildPyramid(ctx: BuildContext): { items: WorkoutItem[]; circuits: number } {
  const { pickOne } = makePicker(ctx.rng)
  const items: WorkoutItem[] = []
  const rest = ctx.cautious ? 20 : 15
  const base = Math.max(20, ctx.shape.workSeconds - 10)
  const peak = Math.min(50, ctx.shape.workSeconds + 15)

  const warmup = pickOne(ctx.warmups)
  if (warmup) items.push({ exerciseId: warmup.id, workSeconds: base, restSeconds: rest })

  const reserveCooldown = ctx.cautious ? 1 : 0
  const n = Math.max(5, ctx.shape.slots - items.length - reserveCooldown)
  for (let i = 0; i < n; i++) {
    // Triangle ramp: 0 → 1 at the middle slot → 0 at the last.
    const t = n === 1 ? 1 : 1 - Math.abs((2 * i) / (n - 1) - 1)
    const work = Math.round((base + (peak - base) * t) / 5) * 5
    const e = pickOne(focusCandidates(ctx.mains, ctx.focus, i))
    if (e) items.push({ exerciseId: e.id, workSeconds: work, restSeconds: rest })
  }
  if (reserveCooldown) {
    const cool = pickOne(ctx.cooldowns)
    if (cool) items.push({ exerciseId: cool.id, workSeconds: base, restSeconds: 0 })
  }
  return { items, circuits: 1 }
}

/** Suggested reps for one AMRAP round: easier and cardio moves get more. */
function amrapReps(e: Exercise): number {
  const base = e.kind === 'cardio' ? 24 : e.kind === 'core' ? 16 : 14
  const reps = Math.max(5, base - e.difficulty * 2)
  // Alternating moves count each side as a rep — keep the target even so it
  // splits cleanly between sides.
  return e.repStyle === 'alternating' ? Math.max(6, Math.round(reps / 2) * 2) : reps
}

function buildAmrap(ctx: BuildContext): { items: WorkoutItem[]; circuits: number; totalSeconds: number } {
  const { pickOne } = makePicker(ctx.rng)
  const items: WorkoutItem[] = []
  const pool = ctx.mains.filter((e) => e.kind !== 'mobility')
  const count = ctx.score >= 6 ? 6 : ctx.score >= 3 ? 5 : 4
  for (let i = 0; i < count; i++) {
    const e = pickOne(focusCandidates(pool, ctx.focus, i))
    if (e) items.push({ exerciseId: e.id, workSeconds: 0, restSeconds: 0, targetReps: amrapReps(e) })
  }
  const minutes = Math.round(clamp(5 + ctx.score, 6, 15))
  return { items, circuits: 1, totalSeconds: minutes * 60 }
}

/**
 * Generate the suggested workout for a given day. All formats share the same
 * ingredients — the eligible exercise pool, focus rotation, and shape scaled
 * by fitness — but arrange them differently. Interval formats rotate muscle
 * groups between consecutive slots so each area recovers while another works;
 * injury-prevention users get a warm-up plus a mobility cooldown.
 */
export function generateWorkout(
  profile: UserProfile,
  state: ProgressionState,
  date = new Date(),
  formatOverride?: WorkoutFormat | null,
): Workout {
  const rng = mulberry32(
    hashString(isoDay(date) + '|' + profile.focusAreas.join(',')) ^ Math.round(state.fitnessScore * 100),
  )
  const focus = pickFocus(profile, state, date)
  const format = formatOverride ?? pickFormat(profile, state.fitnessScore, focus, date)
  const shape = workoutShape(profile, state, date)
  const pool = eligibleExercises(profile, state.fitnessScore)

  const ctx: BuildContext = {
    rng,
    focus,
    shape,
    cautious: profile.goalBalance < 34,
    score: state.fitnessScore,
    warmups: pool.filter((e) => e.kind === 'mobility' || (e.kind === 'cardio' && e.impact === 'low')),
    cooldowns: pool.filter((e) => e.kind === 'mobility'),
    mains: pool.filter((e) => e.kind !== 'mobility'),
  }

  const built: { items: WorkoutItem[]; circuits: number; totalSeconds?: number } =
    format === 'tabata' ? buildTabata(ctx)
    : format === 'hiit' ? buildHiit(ctx)
    : format === 'pyramid' ? buildPyramid(ctx)
    : format === 'amrap' ? buildAmrap(ctx)
    : buildCircuit(ctx)

  const totalSeconds = built.totalSeconds
  const perCircuit = built.items.reduce((s, i) => s + i.workSeconds + i.restSeconds, 0)
  const estimatedMinutes = totalSeconds
    ? Math.round(totalSeconds / 60)
    : Math.max(1, Math.round((perCircuit * built.circuits) / 60))

  return {
    id: `${isoDay(date)}-${focus}-${format}`,
    title: `${FOCUS_TITLES[focus]} ${FORMAT_INFO[format].label}`,
    date: isoDay(date),
    format,
    items: built.items,
    circuits: built.circuits,
    totalSeconds,
    focus,
    estimatedMinutes,
  }
}

/**
 * Alternatives for a slot: same territory (shared focus area or muscle),
 * similar difficulty, allowed impact and equipment. Sorted so the closest
 * matches in difficulty come first.
 */
export function swapOptions(profile: UserProfile, fitnessScore: number, workout: Workout, slotIndex: number): Exercise[] {
  const current = getExercise(workout.items[slotIndex].exerciseId)
  const inWorkout = new Set(workout.items.map((i) => i.exerciseId))
  const impactCap = IMPACT_RANK[maxImpact(profile)]
  const owned = new Set([...profile.equipment, 'none'])
  const blocked = blockedIds(profile, fitnessScore)
  const areas = protectedAreas(profile)

  return EXERCISES.filter(
    (e) =>
      e.id !== current.id &&
      !inWorkout.has(e.id) &&
      !profile.excluded.includes(e.id) &&
      !blocked.has(e.id) &&
      !loadsProtectedArea(e, areas) &&
      IMPACT_RANK[e.impact] <= impactCap &&
      Math.abs(e.difficulty - current.difficulty) <= 1 &&
      e.equipment.every((q) => owned.has(q)) &&
      (e.focusAreas.some((f) => current.focusAreas.includes(f)) || e.muscles.some((m) => current.muscles.includes(m))),
  ).sort((a, b) => {
    const byCloseness = Math.abs(a.difficulty - current.difficulty) - Math.abs(b.difficulty - current.difficulty)
    if (byCloseness !== 0) return byCloseness
    // Tiebreak toward the user's current level.
    const center = 1 + (fitnessScore - 1) * (4 / 9)
    return Math.abs(a.difficulty - center) - Math.abs(b.difficulty - center)
  })
}

/**
 * Swap every occurrence of the slot's exercise (Tabata repeats each move
 * several times; other formats have one occurrence, so this is equivalent).
 * Rep targets are recomputed for the incoming exercise.
 */
export function applySwap(workout: Workout, slotIndex: number, newExerciseId: string): Workout {
  const oldId = workout.items[slotIndex].exerciseId
  const incoming = getExercise(newExerciseId)
  const items = workout.items.map((item) =>
    item.exerciseId === oldId
      ? {
          ...item,
          exerciseId: newExerciseId,
          swappedFrom: item.swappedFrom ?? item.exerciseId,
          targetReps: item.targetReps === undefined ? undefined : amrapReps(incoming),
        }
      : item,
  )
  return { ...workout, items }
}
