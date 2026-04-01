# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Production build to `dist/`
- `npx tsc --noEmit` — Type-check without emitting (no linter or test framework configured)

## Architecture

Babylon.js FPS arena shooter with Havok physics, wave-based enemies, and an upgrade system. All source is in `src/`, bundled by Vite, with strict TypeScript (`noUnusedLocals`, `noUnusedParameters`).

### Module graph

```
constants.ts  ←  Grouped config objects (ARENA, ENEMY, PLAYER, BEAM, ORB, etc.)
game.ts       ←  Central state hub: GameState, Enemy, Supply, Orb interfaces;
                  shared mutable `g` object and `dom` refs (imported by every module)
build.ts      ←  Scene setup: camera, physics, lighting, arena geometry, weapon
spawn.ts      ←  Mesh/material factories, physics aggregates, and all spawn/visual-
                  effect functions (spawnEnemy, spawnOrb, killEnemy, particles, etc.)
audio.ts      ←  Synthesized spatial audio (Web Audio API, HRTF panners, no audio files)
upgrades.ts   ←  effective*() stat functions, UPGRADE_DEFS, upgrade menu UI
update.ts     ←  Game loop: player movement, enemy AI, shooting (beam + orb),
                  waves, HUD
main.ts       ←  Entry point: input binding, game start/restart, pointer lock, options UI
```

**Data flow:** `game.ts` exports the mutable `g` object — all modules read/write shared state through it. `constants.ts` holds all tuning numbers as grouped `as const` objects. `update.ts` contains the core game loop registered via `scene.registerBeforeRender`.

### Key patterns

- **Constants are grouped objects:** All game-tuning values live in `constants.ts` as exported `as const` objects (`ARENA`, `ENEMY`, `PLAYER`, `BEAM`, `ORB`, `HEAT`, `SPREAD`, `WAVE`, `SUPPLY`, `SCORING`, `CRIT`, `MULTISHOT`, `RICOCHET`, `LIGHTNING`, `UPGRADE`, `AUDIO`, `BULLET_HOLE`). Mesh/material/style config (colors, dimensions, positions) stays in `spawn.ts` as private objects. New constants should be added to the appropriate group in `constants.ts`; do not export bare `const` values from other modules.
- **Spawning and mesh creation in spawn.ts:** All functions that create meshes, spawn entities (enemies, orbs, supplies), create visual effects (particles, laser beams, bullet holes, lightning bolts), or handle enemy death (killEnemy, splitRagdoll, hitDebris) belong in `spawn.ts`. The game loop in `update.ts` calls these functions but should not contain mesh creation or disposal logic itself.
- **Circular dependency avoidance:** `upgrades.ts` and `spawn.ts` need to call functions defined in `update.ts` but can't import them. Solved via callbacks: `setUpdateHUD(fn)` and `setIncrementScore(fn)` are called by `update.ts` at module load.
- **Re-exports for stable imports:** `selectUpgrade` is defined in `upgrades.ts` but re-exported from `update.ts` so `main.ts` only imports from `update.ts`.
- **All audio is synthesized:** oscillators + noise buffers via Web Audio API. No audio files. Each sound function creates short-lived nodes connected through a `PannerNode` (HRTF) → `masterGain` → `destination`.
- **Weapon fires three modes:** Left-click = hitscan beam (raycast); right-click hold = charged orb projectile (physics-simulated sphere with explosion splash damage); left-click while charging = dump-fire (instantly fires a heavy gravity-affected orb consuming extra ammo). Beam and orb share the ammo pool and heat system.
- **Upgrades use effective functions:** Base stat + upgrade count × per-upgrade amount. Functions like `effectiveBeamDamage()`, `effectiveOrbDamage()`, etc. are the single source of truth for current stat values.
- **Proc mechanics:** Multishot (chance to fire 3 shots), ricochet (recursive reflection on impact), and lightning (chain from ceiling on hit) each have base chance constants and upgrade scaling.

### HUD elements

All HUD is plain HTML/CSS (no Babylon GUI). DOM element refs are cached in `dom` (from `game.ts`). The upgrade menu uses `data-index` attributes on buttons; selections work via click or keyboard (1/2/3).

### Import convention

All local imports use `.js` extension (e.g., `from "./game.js"`) — required by the ESM + bundler setup even though source files are `.ts`.
