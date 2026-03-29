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
constants.ts  ←  Pure config values (no imports)
game.ts       ←  Central state hub: GameState, Enemy, Supply, Orb interfaces;
                  shared mutable `g` object and `dom` refs (imported by every module)
build.ts      ←  Scene setup: camera, physics, lighting, arena geometry, weapon
meshBuilders.ts ← Mesh/material factory functions + physics aggregate helpers
audio.ts      ←  Synthesized spatial audio (Web Audio API, HRTF panners, no audio files)
upgrades.ts   ←  effective*() stat functions, UPGRADE_DEFS, upgrade menu UI
update.ts     ←  Game loop: player movement, enemy AI, shooting (beam + orb),
                  waves, particles, HUD, game flow (pause/resume/endGame)
main.ts       ←  Entry point: input binding, game start/restart, pointer lock, options UI
```

**Data flow:** `game.ts` exports the mutable `g` object — all modules read/write shared state through it. `constants.ts` holds all tuning numbers. `update.ts` is the largest file (~1950 lines) containing the core game loop registered via `scene.registerBeforeRender`.

### Key patterns

- **Circular dependency avoidance:** `upgrades.ts` needs to call `updateHUD()` (defined in `update.ts`) but can't import it. Solved via callback: `setUpdateHUD(fn)` is called by `update.ts` at module load.
- **Re-exports for stable imports:** `selectUpgrade` is defined in `upgrades.ts` but re-exported from `update.ts` so `main.ts` only imports from `update.ts`.
- **All audio is synthesized:** oscillators + noise buffers via Web Audio API. No audio files. Each sound function creates short-lived nodes connected through a `PannerNode` (HRTF) → `masterGain` → `destination`.
- **Weapon fires three modes:** Left-click = hitscan beam (raycast); right-click hold = charged orb projectile (physics-simulated sphere with explosion splash damage); left-click while charging = dump-fire (instantly fires a heavy gravity-affected orb consuming extra ammo). Beam and orb share the ammo pool and heat system.
- **Upgrades use effective functions:** Base stat + upgrade count × per-upgrade amount. Functions like `effectiveBeamDamage()`, `effectiveOrbDamage()`, etc. are the single source of truth for current stat values.

### HUD elements

All HUD is plain HTML/CSS (no Babylon GUI). DOM element refs are cached in `dom` (from `game.ts`). The upgrade menu uses `data-index` attributes on buttons; selections work via click or keyboard (1/2/3).

### Import convention

All local imports use `.js` extension (e.g., `from "./game.js"`) — required by the ESM + bundler setup even though source files are `.ts`.
