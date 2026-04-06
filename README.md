# Babylon FPS

A browser-based first-person arena shooter built with [Babylon.js](https://www.babylonjs.com/), Havok physics, and [Vite](https://vitejs.dev/).

## Overview

The game starts with a basic semi-auto laser blaster and unfolds through randomized between-wave upgrades. As runs progress, you can unlock continuous-fire pulse shots, plasma casting and charging, grenade-style dump fire, a fully automatic rifle path, proc-based damage systems, and a stack of stat upgrades that all feed back into the wave loop.

## Features

- First-person camera with pointer lock and mouse look
- WASD movement with jump, sprint, acceleration smoothing, and physics-backed collision
- Middle-click melee attack with knockback and headshot bonus damage
- Semi-auto laser by default, with `Pulse Laser` unlock enabling hold-to-fire continuous shooting
- Shared ammo magazine, reserve ammo, auto-reload on empty, and manual reload on `R`
- Heat and overheat system shared by laser and plasma; critical heat weakens shots and max heat locks the weapon until it cools
- Spread/bloom system driven by sustained fire and movement, with the crosshair widening to match current inaccuracy
- Plasma weapon path gated through upgrades:
  - `Plasma Caster` unlocks RMB plasma shots
  - `Plasma Charger` unlocks hold-to-charge plasma
  - `Plasma Grenadier` unlocks left-click dump fire while charging
- Plasma shots are physics-simulated projectiles with splash damage, crit support, ricochet support, and optional gravity on grenade-style shots
- Upgrade-gated rifle with a separate ammo pool, no overheat, gravity-affected tracer bullets, distinct reload/melee animations, and mouse-wheel weapon switching
- Rifle `Muzzle Brake` upgrade that adds a visible barrel attachment, reduces the rifle's aggressive recoil, and shrinks its muzzle flash
- Critical hit system for laser, plasma, and rifle shots, including laser-on-plasma interactions
- Unlockable proc systems for multishot, ricochet, lightning, and ignite, each with follow-up chance upgrades
- Ignite applies DOT, particle/fire audio, and fire spread to nearby enemies
- Wave system with between-wave downtime, randomized upgrade picks, supply rewards, and escalating enemy stats
- Enemy spawning from the ceiling, chase/patrol behavior, zigzag movement, melee attacks, and world-space health bars
- Ragdoll enemy death with detachable limbs, split kill meshes, shootable debris, and bonus score for cleanup shots
- Score-based health/ammo supply drops plus guaranteed wave-complete reward pickups in front of the player
- Babylon GUI overlay flow for start, pause, options, and game-over screens
- DOM HUD for health, weapon label, ammo, score, kills, wave status, heat, crosshair, and upgrade selection
- Synthesized audio only: Web Audio oscillators/noise buffers, no sound asset files
- Saved options for volume and mouse sensitivity via `localStorage`

## Getting Started

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Controls

| Input                                  | Action                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `W A S D`                              | Move                                                                     |
| Mouse                                  | Look                                                                     |
| `Space`                                | Jump                                                                     |
| Left Click                             | Fire laser                                                               |
| Left Click (hold, after `Pulse Laser`) | Continuous laser fire                                                    |
| Right Click                            | Fire plasma after `Plasma Caster`; hold to charge after `Plasma Charger` |
| Left Click while charging              | Dump-fire plasma grenade after `Plasma Grenadier`                        |
| Mouse Wheel                            | Switch between blaster and rifle after unlocking the rifle               |
| Middle Click                           | Melee attack                                                             |
| `R`                                    | Reload                                                                   |
| `Shift`                                | Sprint                                                                   |
| `1` `2` `3`                            | Pick one of the current upgrade options                                  |
| `Esc` / pointer lock loss              | Pause                                                                    |

## Scripts

| Command                | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Start the Vite dev server                           |
| `npm run build`        | Create a production build in `dist/`                |
| `npm run preview`      | Preview the production build locally                |
| `npx tsc --noEmit`     | Run the strict TypeScript check used by the project |
| `npm run format`       | Format the repo with Prettier                       |
| `npm run format:check` | Check repo formatting with Prettier                 |

## Tech Stack

- **[Babylon.js](https://www.babylonjs.com/)** for rendering, GUI, meshes, particles, picking, and physics integration
- **[@babylonjs/havok](https://www.npmjs.com/package/@babylonjs/havok)** for Havok-backed rigid-body physics
- **TypeScript** with strict compiler settings
- **Vite** for bundling and local development

## Source Files

| File                 | Responsibility                                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/constants.ts`   | Tunable gameplay constants grouped into exported `as const` objects such as `ARENA`, `LIGHTING`, `ENEMY`, `PLAYER`, `BLASTER`, `RIFLE`, `SCORING`, `SUPPLY`, `WAVE`, `CRIT`, `UPGRADE`, and `BULLET_HOLE` |
| `src/game.ts`        | Core shared types (`GameState`, `Enemy`, `Supply`, `Plasma`), cached DOM refs, state factories, and the mutable `g` game context                                                                          |
| `src/build.ts`       | Scene/bootstrap assembly: Babylon scene creation, Havok setup, camera, lights, particle texture, arena construction, and weapon construction                                                              |
| `src/spawn.ts`       | Arena mesh factories, weapon/enemy/supply creation, plasma spawning, bullet holes, particles, lightning, fire effects, damage numbers, health bars, ragdolls, and other mesh lifecycle work               |
| `src/audio.ts`       | Procedural audio generation and spatial playback helpers                                                                                                                                                  |
| `src/progression.ts` | Effective stat calculations, score progression, queued score-reward supply drops, weighted upgrade definitions/unlocks, HUD updates, and upgrade menu selection flow                                      |
| `src/actions.ts`     | Player actions and combat logic: jump, melee, laser hitscan, plasma charge/fire, reload, damage resolution, scoring, crit/proc interactions                                                               |
| `src/update.ts`      | Main per-frame update loop, timers, player movement, enemy AI, wave progression, heat/spread decay, supply pickup handling, and HUD/crosshair updates                                                     |
| `src/flow.ts`        | Run lifecycle orchestration: start/reset, end, pause, resume, scene rebuild, run-state reset, and registering the update loop                                                                             |
| `src/input.ts`       | Global keyboard/mouse bindings plus per-scene Babylon pointer/action bindings                                                                                                                             |
| `src/ui.ts`          | Babylon GUI overlay screens for start, pause, options, and game-over flow                                                                                                                                 |
| `src/main.ts`        | App bootstrap, pointer-lock lifecycle, game-over transition detection, and render loop                                                                                                                    |

## Architecture Notes

- Shared mutable state lives in `g` from `src/game.ts`; nearly every module reads or writes through it.
- `src/constants.ts` is the source of truth for gameplay tuning. The rest of the code imports grouped config objects instead of defining scattered exported constants.
- Mesh creation, spawn logic, particle work, and disposal live in `src/spawn.ts`, not in the game loop.
- The main loop is registered in `src/update.ts` through `scene.registerBeforeRender(update)`.
- Run startup/reset/end/pause/resume orchestration lives in `src/flow.ts`; global and per-scene input binding lives in `src/input.ts`.
- Death is observed in `src/main.ts` from shared state and then routed to `endGame()` in `src/flow.ts`, keeping player action code independent from lifecycle orchestration.
- Score-threshold supply rewards are queued by `incrementScore()` in `src/progression.ts` and spawned by the update loop, which avoids callback wiring between scoring and spawning.
- Overlay screens use Babylon GUI so pointer lock can be reacquired directly from canvas-driven button events.
- The HUD and upgrade picker remain DOM-based, which keeps text updates simple and independent from the Babylon GUI overlay stack.
