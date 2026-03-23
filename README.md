# Babylon FPS

A browser-based first-person shooter built with [Babylon.js](https://www.babylonjs.com/) and [Vite](https://vitejs.dev/).

## Features

- First-person camera with pointer lock and mouse look
- WASD movement with gravity and collision detection
- Sprint (hold Shift) — disables firing and reloading while active, sways the weapon, and hides the crosshair
- Raycast laser beam weapon with electric buzzing sound, blood splatter particles, and bullet hole decals
- 8 enemy bots that patrol and chase the player, dealing melee damage on contact
- Enemy death ragdoll — head and body separate, receive physics impulses, then disappear after a few seconds
- 100-round magazine with manual (`R`) and auto reload; reload plays an eject-and-insert sound sequence
- Reload animation — gun tilts up and the energy cell slides out and back in
- Pause on pointer-lock release (click pause screen or canvas to resume)
- Shadow mapping, exponential fog, and particle effects
- HUD showing health, ammo reserve, score, and kill count
- Game over screen with final score and restart

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
| `src/constants.ts` | All numeric game-tuning values — speeds, damage, cooldowns, ammo counts, reload time, spawn position |
| `src/meshDefs.ts` | Mesh geometry, material colours, and layout data — capsule sizes, arena dimensions, weapon part positions, enemy colours |
| `src/meshBuilders.ts` | Factory and setup functions for every mesh and material in the game; the only file that imports `meshDefs`; exported helpers are called by `build.ts` and `update.ts` |
| `src/game.ts` | Shared types (`GameState`, `Enemy`), DOM element refs, and the mutable `g` context object imported by all other modules |
| `src/build.ts` | Scene initialisation — camera, lighting, Havok physics, particle texture — then orchestrates arena, weapon, and enemy creation via `meshBuilders` helpers |
| `src/update.ts` | Per-frame game loop, player movement, enemy AI, shooting, reloading, ragdoll death, particle effects, audio synthesis, HUD, pause/resume/game-over |
| `src/main.ts` | Entry point — input event listeners, `startGame()`, render loop |
