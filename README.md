# Stoke

Short, adaptive interval workouts — no gym, no account, everything runs and
persists in your browser.

**Live app:** https://stringhamc.github.io/stoke/ — open on your phone and
"Add to Home Screen" to install.

## Features

- **Daily workout suggestions** — every day the app generates a workout tuned
  to your current fitness level. Consecutive slots rotate muscle groups so each
  area recovers while the next one works.
- **Five training formats** — the app rotates between them day to
  day, or pick one yourself on the Today screen:
  - *Circuit* — one timed interval of each exercise, 1–3 rounds
  - *Tabata* — 4-minute blocks of 20s all-out / 10s rest, two moves alternating
  - *HIIT* — long 40s pushes with 20s recoveries
  - *Pyramid* — work intervals climb to a mid-workout peak, then come back down
  - *AMRAP* — a rep list on a countdown: as many rounds as possible, your pace
  Cautious/beginner users are steered to the gentler formats automatically.
- **Progression** — a continuous 1–10 fitness score drives exercise difficulty,
  workout length, work-interval duration, and circuit count. Finishing workouts
  and rating them ("too easy" / "just right" / "too hard") moves the score.
- **Adapts to your real frequency** — progression is gated on adherence: if you
  train below ~60% of your weekly target, the ramp slows and the next workout
  shrinks to an easy restart win. Long breaks gently decay the score so the app
  meets you where you are, not where you were.
- **Progress vs. injury prevention** — a goal slider tunes the whole engine:
  the cautious end restricts to low-impact exercises, adds rest, ramps difficulty
  at half speed, and appends a mobility cooldown; the aggressive end unlocks
  high-impact moves and faster progression.
- **Focus areas** — pick any mix of full body, upper body, lower body, core,
  cardio and mobility; daily suggestions rotate through them, steering away from
  what you trained in the last few days.
- **Exercise swap** — any slot can be swapped for an alternative that works the
  same area at a similar difficulty with your equipment, or hidden forever.
- **"This hurts" / "too hard" flags** — from the swap sheet or mid-workout in
  the player, mark a move as painful (pick the body area — knees, tailbone,
  lower back, …) or too difficult. Painful moves are removed and the whole
  body area becomes protected: every exercise that loads it disappears from
  suggestions and swap lists (with a fallback so the library never collapses).
  Too-difficult moves are benched and return automatically once your fitness
  level has grown a full level. Flags are managed in Settings.
- **Equipment-aware** — bodyweight-only by default; a chair, wall, dumbbells or
  a band unlock more variety.
- **Guided player** — full-screen interval timer with work/rest phases,
  animated stick-figure form demos for every exercise, 3-2-1 countdown ticks,
  distinct go/rest tones, a finish fanfare, and spoken cues announcing each
  exercise (toggle effects and voice separately in Settings).
- **Explicit rep counting** — every exercise declares how reps count.
  Alternating moves (lunges, mountain climbers…): each side counts as one rep,
  shown as e.g. "12 reps — alternating, 6 per side". Per-side moves (split
  squats, side plank…): timed intervals say "switch sides halfway" and rep
  targets mean that many on each side.
- **Training status** — a watch-style readout of where your training is:
  *detraining*, *recovery*, *maintaining*, *productive*, or *overreaching*,
  classified from your recent load vs. plan, workout feedback, and the fitness
  score trend. Overreaching also feeds back into the engine: the next
  suggestions trim a circuit and add rest.
- **History** — training status, streak, fitness level, two-week adherence
  view, and a session log.

## Install as an app

Stoke is a PWA: host the `dist/` build anywhere (any static host works), open it
on your phone, and use **Add to Home Screen** (iOS Safari share menu, or
Android Chrome's install prompt). You get a home-screen icon, full-screen
launch, and offline support via a service worker.

A GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) builds and
deploys to GitHub Pages on every push to `main`. One-time setup: in the repo's
**Settings → Pages**, set **Source** to **GitHub Actions**. The app then lives
at `https://<user>.github.io/<repo>/`. Note that GitHub Pages sites are
publicly reachable (workout data still never leaves the device — the app has
no backend).

For zero-setup desktop testing there's also `stoke-standalone.html` — the whole
app in one file; download and double-click it (regenerate with
`npm run build:standalone`).

Native store apps are a straightforward later step: the codebase is fully
client-side, so it can be wrapped with Capacitor for App Store / Play Store
distribution without code changes.

## Tech

React 18 + TypeScript + Vite. No backend — state lives in `localStorage`.

```
src/
  data/exercises.ts     60+ exercise library with difficulty, impact, joint load,
                        muscles, focus areas and equipment metadata
  engine/generator.ts   daily workout generation, formats, focus rotation, swaps
  engine/progression.ts fitness score, adherence, feedback and detraining model
  state/store.tsx       reducer + localStorage persistence
  screens/              Onboarding, Today, Player, History, Settings
```

## Run it

```bash
npm install
npm run dev               # local dev server
npm run build             # type-check + production build to dist/
npm run build:standalone  # single-file stoke-standalone.html
```
