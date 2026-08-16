import { useEffect, useRef } from 'react'
import { ANIMS, ANIM_MS } from '../data/anims'
import type { AnimId, Pose, Pt } from '../data/anims'

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpPts(a: Pt[], b: Pt[], t: number): Pt[] {
  return a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)] as Pt)
}

function toPoints(pts: Pt[]): string {
  return pts.map((p) => `${p[0]},${p[1]}`).join(' ')
}

const LIMBS = ['torso', 'armL', 'armR', 'legL', 'legR'] as const

/**
 * Animated stick-figure form demo. Interpolates between an animation's key
 * poses with an ease-in-out ping-pong, driven by requestAnimationFrame.
 */
export function FormAnim({ animId, size = 150 }: { animId: AnimId; size?: number }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const poses = ANIMS[animId]
    const svg = svgRef.current
    if (!svg || poses.length === 0) return
    const head = svg.querySelector<SVGCircleElement>('circle')!
    const limbEls = svg.querySelectorAll<SVGPolylineElement>('polyline.anim-limb')
    const lines = LIMBS.map((_, i) => limbEls[i])

    // Ping-pong through poses: A→B→…→B→A.
    const seq = poses.length === 1 ? [poses[0], poses[0]] : [...poses, ...poses.slice(1, -1).reverse()]
    const cycleMs = ANIM_MS[animId] ?? 900
    let raf = 0
    const start = performance.now()

    const draw = (now: number) => {
      // rAF timestamps can be a hair before the performance.now() above.
      const elapsed = Math.max(0, now - start)
      const phase = (elapsed / cycleMs) % seq.length
      const idx = Math.min(seq.length - 1, Math.floor(phase))
      const rawT = phase - idx
      const t = 0.5 - 0.5 * Math.cos(Math.PI * rawT) // ease in-out
      const a = seq[idx]
      const b = seq[(idx + 1) % seq.length]
      const headPt: Pt = [lerp(a.head[0], b.head[0], t), lerp(a.head[1], b.head[1], t)]
      head.setAttribute('cx', String(headPt[0]))
      head.setAttribute('cy', String(headPt[1]))
      LIMBS.forEach((limb, i) => {
        lines[i].setAttribute('points', toPoints(lerpPts(a[limb] as Pt[], b[limb] as Pt[], t)))
      })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [animId])

  const first: Pose = ANIMS[animId][0]

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="form-anim"
      aria-hidden="true"
    >
      <line x1="4" y1="91" x2="96" y2="91" className="anim-ground" />
      {first.prop && <polyline points={toPoints(first.prop)} className="anim-prop" />}
      <circle cx={first.head[0]} cy={first.head[1]} r="6.5" className="anim-head" />
      {LIMBS.map((limb) => (
        <polyline key={limb} points={toPoints(first[limb] as Pt[])} className="anim-limb" />
      ))}
    </svg>
  )
}
