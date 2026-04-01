# Babylon FPS

A browser-based first-person shooter built with [Babylon.js](https://www.babylonjs.com/) and [Vite](https://vitejs.dev/).

## Features

- First-person camera with pointer lock and mouse look
- WASD movement with gravity and collision detection
- Sprint (hold Shift) — disables firing and reloading while active, sways the weapon, and hides the crosshair
- Raycast laser beam weapon with electric buzzing sound, blood splatter particles, and bullet hole decals that glow yellow → orange → red before fading
- Weapon spread system — sustained fire and movement both increase inaccuracy; crosshair lines separate to indicate current spread
- Weapon overheat system — continuous fire builds heat; at critical heat (75%) damage is reduced and the beam weakens; at max heat the gun locks, the barrel glows red, smoke particles emit, and cooling must occur before firing resumes
- Orb charge system — hold right-click to charge an orb that consumes extra ammo over time for a bigger explosion; release to fire, or left-click while charging to dump-fire a heavy gravity-affected orb that bounces off geometry
- Critical hit system — beam and orb shots can critically hit for bonus damage; a critical beam detonating a critical orb stacks crit multipliers
- Multishot — chance for each shot (beam or orb) to fire 3 projectiles (one normal, two angled); upgradeable
- Ricochet — beams and orbs can bounce off surfaces or enemies on impact, spawning new projectiles at the reflection angle; recursive with depth limit; upgradeable
- Lightning — on-hit chance to call a lightning bolt from the ceiling that chains to nearby enemies; critical hits produce purple lightning with crit-multiplied damage; upgradeable
- Wave-based enemy spawning — each wave brings more enemies with increasing health, speed, damage, and attack rate; enemies drop from the ceiling and zigzag while chasing
- Enemy death ragdoll — head, body, arms, and legs separate on death, receive physics impulses; the killing-shot part splits in half; all ragdoll parts and debris can be shot for bonus score
- Upgrade system — choose from randomized upgrades between waves: max health, speed, reload speed, mag size, rate of fire, heat capacity, beam damage, orb damage, crit chance, crit damage, orb self-damage reduction, multishot chance, ricochet chance, lightning chance
- Scoring — base kill score with 1.5x headshot multiplier; shooting ragdoll parts and debris awards 1 point each
- Pickup system — health and ammo pickups with physics drop at hit locations every 500 points (50% chance); wave completion grants bonus pickups and score
- 100-round magazine with manual (`R`) and auto reload; reload plays an eject-and-insert sound sequence; ammo pickups restore a full magazine
- Reload animation — gun tilts up and the energy cell slides out and back in
- Dynamic crosshair — turns red when aimed at a living enemy
- Centre lamppost with spotlight and shadow casting; low ambient light
- Pause on pointer-lock release (click pause screen or canvas to resume)
- Shadow mapping, exponential fog, and particle effects
- HUD showing health, ammo reserve, score, kill count, wave number, enemies remaining, and heat bar
- Distinct sounds for shooting, enemy death, enemy spawn, health pickup, ammo pickup, reload, overheat, and lightning
- Game over screen with wave reached, final score, and restart

## Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Controls

| Input                       | Action                                 |
| --------------------------- | -------------------------------------- |
| `W A S D`                   | Move                                   |
| Mouse                       | Look                                   |
| `Space`                     | Jump                                   |
| Left Click                  | Shoot beam (hold to fire continuously) |
| Right Click (hold)          | Charge orb — release to fire           |
| Left Click (while charging) | Dump-fire gravity orb                  |
| `R`                         | Reload                                 |
| `Shift`                     | Sprint                                 |
| `Esc` / lose pointer lock   | Pause                                  |

## Scripts

| Command           | Description                  |
| ----------------- | ---------------------------- |
| `npm run dev`     | Start local dev server       |
| `npm run build`   | Production build to `dist/`  |
| `npm run preview` | Preview the production build |

## Tech Stack

- **[Babylon.js](https://www.babylonjs.com/)** — 3D engine (rendering, physics via Havok, particles, shadows)
- **[Vite](https://vitejs.dev/)** — build tool and dev server
- **TypeScript** — type-checked source throughout

## Source Files

| File               | Responsibility                                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/constants.ts` | All game-tuning values as grouped `as const` objects — `ARENA`, `ENEMY`, `PLAYER`, `BEAM`, `ORB`, `HEAT`, `SPREAD`, `WAVE`, `SUPPLY`, `SCORING`, `CRIT`, `MULTISHOT`, `RICOCHET`, `LIGHTNING`, `UPGRADE`, `AUDIO`, `BULLET_HOLE` |
| `src/spawn.ts`     | Mesh geometry definitions, material colours, factory functions, and all spawn/visual-effect functions (enemies, orbs, supplies, particles, laser beams, bullet holes, lightning bolts, enemy death/ragdoll)                      |
| `src/game.ts`      | Shared types (`GameState`, `Enemy`, `Orb`, `Supply`), DOM element refs, and the mutable `g` context object imported by all other modules                                                                                         |
| `src/audio.ts`     | Synthesized spatial audio (Web Audio API, HRTF panners) — all sounds are generated from oscillators and noise buffers, no audio files                                                                                            |
| `src/build.ts`     | Scene initialisation — camera, lamppost lighting, Havok physics, particle texture — then orchestrates arena, weapon, and initial setup via `spawn.ts` helpers                                                                    |
| `src/upgrades.ts`  | `effective*()` stat functions, upgrade definitions, and upgrade menu UI                                                                                                                                                          |
| `src/update.ts`    | Per-frame game loop, player movement, enemy AI, wave system, beam and orb shooting, orb charging, spread, heat, reloading, pickup collection, HUD,                                                                               |
| `src/main.ts`      | Entry point — input event listeners, `startGame()`, render loop                                                                                                                                                                  |
