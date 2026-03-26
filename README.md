# Babylon FPS

A browser-based first-person shooter built with [Babylon.js](https://www.babylonjs.com/) and [Vite](https://vitejs.dev/).

## Features

- First-person camera with pointer lock and mouse look
- WASD movement with gravity and collision detection
- Sprint (hold Shift) — disables firing and reloading while active, sways the weapon, and hides the crosshair
- Raycast laser beam weapon with electric buzzing sound, blood splatter particles, and bullet hole decals that glow yellow → orange → red before fading
- Weapon spread system — sustained fire and movement both increase inaccuracy; crosshair lines separate to indicate current spread
- Weapon overheat system — continuous fire builds heat; at critical heat (75%) damage is reduced and the beam weakens; at max heat the gun locks, the barrel glows red, smoke particles emit, and cooling must occur before firing resumes
- Wave-based enemy spawning — each wave brings more enemies with increasing health, speed, damage, and attack rate; enemies drop from the ceiling and zigzag while chasing
- Enemy death ragdoll — head and body separate, receive physics impulses; ragdoll parts and debris can be shot for bonus score
- Scoring — base kill score with 1.5x headshot multiplier; shooting ragdoll parts and debris awards 1 point each
- Pickup system — health and ammo pickups with physics drop at hit locations every 500 points (50% chance); wave completion grants bonus pickups and score
- 100-round magazine with manual (`R`) and auto reload; reload plays an eject-and-insert sound sequence; ammo pickups restore a full magazine
- Reload animation — gun tilts up and the energy cell slides out and back in
- Dynamic crosshair — turns red when aimed at a living enemy
- Centre lamppost with spotlight and shadow casting; low ambient light
- Pause on pointer-lock release (click pause screen or canvas to resume)
- Shadow mapping, exponential fog, and particle effects
- HUD showing health, ammo reserve, score, kill count, wave number, enemies remaining, and heat bar
- Distinct sounds for shooting, enemy death, enemy spawn, health pickup, ammo pickup, reload, and overheat
- Game over screen with wave reached, final score, and restart

## Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Controls

| Input | Action |
|---|---|
| `W A S D` | Move |
| Mouse | Look |
| `Space` | Jump |
| Left Click | Shoot (hold to fire continuously) |
| `R` | Reload |
| `Shift` | Sprint |
| `Esc` / lose pointer lock | Pause |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |

## Tech Stack

- **[Babylon.js](https://www.babylonjs.com/)** — 3D engine (rendering, physics via Havok, particles, shadows)
- **[Vite](https://vitejs.dev/)** — build tool and dev server
- **TypeScript** — type-checked source throughout

## Source Files

| File | Responsibility |
|---|---|
| `src/constants.ts` | All numeric game-tuning values — speeds, damage, cooldowns, ammo, reload time, spawn position, wave scaling, heat, spread, scoring, pickups |
| `src/meshDefs.ts` | Mesh geometry, material colours, and layout data — capsule sizes, arena dimensions, weapon part positions, enemy colour |
| `src/meshBuilders.ts` | Factory and setup functions for every mesh, material, and physics aggregate in the game; the only file that imports `meshDefs`; exported helpers are called by `build.ts` and `update.ts` |
| `src/game.ts` | Shared types (`GameState`, `Enemy`, `Pickup`), DOM element refs, and the mutable `g` context object imported by all other modules |
| `src/build.ts` | Scene initialisation — camera, lamppost lighting, Havok physics, particle texture — then orchestrates arena, weapon, and initial setup via `meshBuilders` helpers |
| `src/update.ts` | Per-frame game loop, player movement, enemy AI, wave system, shooting, spread, heat, reloading, ragdoll death, pickup spawning/collection, particle effects, audio synthesis, HUD, pause/resume/game-over |
| `src/main.ts` | Entry point — input event listeners, `startGame()`, render loop |
