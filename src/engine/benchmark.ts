import type { AnimId } from '../data/anims'
import type { BenchmarkSession, UserProfile } from '../types'
import { clamp } from './progression'

/**
 * The fitness-test battery: simple field tests that need no lab and no
 * sensors, repeated on a cadence to make progress visible in numbers.
 */
export interface BenchTest {
  id: string
  name: string
  icon: string
  anim: AnimId
  /** what gets recorded */
  unit: 'reps' | 'seconds'
  /**
   * entry: do the test, type the number
   * countdown60: app times 60s, then you enter your count
   * stopwatch: app times you until you stop (value = elapsed seconds)
   * manual_time: type a time (mm:ss) from outside the app, e.g. a tracked run
   */
  mode: 'entry' | 'countdown60' | 'stopwatch' | 'manual_time'
  protocol: string
  /** value that maps to a 10/10 sub-score (linear from 0) */
  tenAt: number
  /** e.g. run times: smaller numbers are better */
  lowerIsBetter?: boolean
}

export const BENCH_TESTS: BenchTest[] = [
  {
    id: 'pushups_max', name: 'Max Push-Ups', icon: '💪', anim: 'pushup', unit: 'reps', mode: 'entry',
    protocol: 'One set to failure, strict form: chest to the floor, full lockout. Knee push-ups count at half — note it and be consistent between tests.',
    tenAt: 40,
  },
  {
    id: 'squats_60', name: 'Squats in 60s', icon: '🦵', anim: 'squat', unit: 'reps', mode: 'countdown60',
    protocol: 'As many full-depth bodyweight squats as you can in one minute. Hips below parallel, full stand between reps.',
    tenAt: 60,
  },
  {
    id: 'plank_hold', name: 'Plank Hold', icon: '🧱', anim: 'plank', unit: 'seconds', mode: 'stopwatch',
    protocol: 'Forearm plank, straight line ear-to-ankle. The clock runs until your hips sag or you rest a knee — then tap stop.',
    tenAt: 240,
  },
  {
    id: 'pullups_max', name: 'Max Pull-Ups', icon: '🧗', anim: 'pullup', unit: 'reps', mode: 'entry',
    protocol: 'Dead hang to chin over bar, no kipping. Zero is a real baseline — that is exactly what we are here to move.',
    tenAt: 15,
  },
  {
    id: 'burpees_60', name: 'Burpees in 60s', icon: '🔥', anim: 'burpee', unit: 'reps', mode: 'countdown60',
    protocol: 'As many burpees as you can in one minute (no-jump burpees count — be consistent between tests). This is the engine test.',
    tenAt: 25,
  },
  {
    id: 'mile_time', name: '1-Mile Run', icon: '🏃', anim: 'run', unit: 'seconds', mode: 'manual_time',
    protocol: 'Run one mile for time — treadmill or outdoors, timed however you like — and enter it here. Optional but the best endurance yardstick.',
    tenAt: 360, lowerIsBetter: true,
  },
]

/** Tests that make sense for this user's equipment (pull-ups need a bar or assist machine). */
export function testsFor(profile: UserProfile): BenchTest[] {
  const gear = new Set([...profile.equipment, ...profile.gymEquipment])
  return BENCH_TESTS.filter((t) => t.id !== 'pullups_max' || gear.has('pullup_bar') || gear.has('machines'))
}

/** 0–10 sub-score for one test result. */
export function subScore(test: BenchTest, value: number): number {
  if (test.lowerIsBetter) {
    // tenAt (or faster) = 10; twice tenAt = 0.
    return clamp(10 * (2 - value / test.tenAt), 0, 10)
  }
  return clamp((value / test.tenAt) * 10, 0, 10)
}

/** Estimated fitness score (1–10) from a session; null if nothing was measured. */
export function estimateScore(session: BenchmarkSession): number | null {
  const subs = BENCH_TESTS.filter((t) => session.results[t.id] !== undefined).map((t) =>
    subScore(t, session.results[t.id]),
  )
  if (subs.length === 0) return null
  const avg = subs.reduce((s, x) => s + x, 0) / subs.length
  return clamp(Math.max(1, avg), 1, 10)
}

/**
 * Blend a test estimate into the current fitness score. Half-weight keeps one
 * great (or rough) test day from whiplashing the training plan.
 */
export function blendScore(current: number, estimate: number): number {
  return clamp(current * 0.5 + estimate * 0.5, 1, 10)
}

/** Latest and previous value for a test across sessions, for trend display. */
export function testTrend(benchmarks: BenchmarkSession[], testId: string): { latest: number; previous?: number; date: string } | null {
  const hits = benchmarks.filter((b) => b.results[testId] !== undefined)
  if (hits.length === 0) return null
  const last = hits[hits.length - 1]
  const prev = hits.length > 1 ? hits[hits.length - 2].results[testId] : undefined
  return { latest: last.results[testId], previous: prev, date: last.date }
}

export const RETEST_DAYS = 28

/** Days since the last test session; null if never tested. */
export function daysSinceTest(benchmarks: BenchmarkSession[], now = new Date()): number | null {
  if (benchmarks.length === 0) return null
  const last = benchmarks[benchmarks.length - 1]
  return Math.floor((now.getTime() - new Date(last.date).getTime()) / 86_400_000)
}

export function formatValue(test: BenchTest, value: number): string {
  if (test.unit === 'reps') return `${value}`
  const m = Math.floor(value / 60)
  const s = Math.round(value % 60)
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}
