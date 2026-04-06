# AGENTS.md

This file provides guidance to coding agents working in this repository, including Claude Code and Codex.

## Build & Dev Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Production build to `dist/`
- `npx tsc --noEmit` — Type-check without emitting (no linter or test framework configured)
- `npm run format` — Run Prettier across the repo
- `npm run format:check` — Check whether files match Prettier formatting

## Architecture

Babylon.js FPS arena shooter with Havok physics, wave-based enemies, and an upgrade system. All source is in `src/`, bundled by Vite, with strict TypeScript (`noUnusedLocals`, `noUnusedParameters`).

### Module graph

```text
constants.ts  <- Grouped config objects (`ARENA`, `LIGHTING`, `ENEMY`, `PLAYER`,
                 `BLASTER`, `SCORING`, `SUPPLY`, `WAVE`, `CRIT`, `UPGRADE`, etc.)
game.ts       <- Central state hub: `GameState`, `Enemy`, `Supply`, `Plasma`
                 interfaces; shared mutable `g` object and cached `dom` refs
build.ts      <- Scene setup: camera, physics, lighting, arena geometry, weapon
spawn.ts      <- Mesh/material factories, physics aggregates, and all spawn /
                 visual-effect functions (`spawnEnemy`, `spawnPlasma`,
                 `killEnemy`, particles, lightning, health bars, etc.)
audio.ts      <- Synthesized spatial audio (Web Audio API, HRTF panners,
                 no audio files)
upgrades.ts   <- `effective*()` stat functions, weighted upgrade defs,
                 upgrade menu UI, HUD updates
actions.ts    <- Player actions: jumping, melee, laser shooting, plasma
                 charging/firing, reloading, damage, scoring, proc logic
update.ts     <- Game loop: player movement, enemy AI, waves, timers, HUD
ui.ts         <- Babylon GUI overlay screens (start, pause, options, game over)
main.ts       <- Entry point: input binding, game start/restart, pointer lock
```

**Data flow:** `game.ts` exports the mutable `g` object, and the rest of the code reads/writes shared state through it. `constants.ts` is the source of truth for gameplay tuning. `update.ts` contains the core loop registered with `scene.registerBeforeRender(update)`.

### Key patterns

- **Constants are grouped objects:** All game-tuning values live in `constants.ts` as exported `as const` objects. The main groups are `ARENA`, `LIGHTING`, `ENEMY`, `ENEMY_HEALTH_BAR`, `PLAYER`, `BLASTER`, `SCORING`, `SUPPLY`, `WAVE`, `CRIT`, `UPGRADE`, `AUDIO`, and `BULLET_HOLE`.
- **`BLASTER` is nested:** Laser, plasma, spread, heat, multishot, ricochet, lightning, ignite, and melee tuning all live under `BLASTER`. Do not document or reintroduce the older split `LASER` / `PLASMA` constant pattern.
- **Spawning and mesh creation belong in `spawn.ts`:** All functions that create meshes, spawn entities, create visual effects, or handle enemy death / ragdoll cleanup belong there. The game loop in `update.ts` should orchestrate, not create/dispose scene content directly.
- **Upgrades use effective functions:** `effective*()` helpers in `upgrades.ts` are the single source of truth for current stat values. If gameplay code needs the current damage, cooldown, heat, spread, or chance values, use those helpers rather than recomputing upgrade math elsewhere.
- **Weapon progression is upgrade-gated:** The run starts with the basic laser only. `Pulse Laser`, `Plasma Caster`, `Plasma Charger`, and `Plasma Grenadier` are unlocks, not baseline abilities.
- **Proc mechanics are also gated:** `multishotUnlock`, `ricochetUnlock`, `lightningUnlock`, and `igniteUnlock` must be earned before their corresponding scaling upgrades matter.
- **Laser and plasma share systems:** Both use the same ammo pool and heat system.
- **All audio is synthesized:** Web Audio oscillators and noise buffers feed through spatial panners. There are no audio files in the repo.

### Circular dependency avoidance

- `updateHUD` lives in `upgrades.ts` so both `actions.ts` and `update.ts` can import it directly.
- `spawn.ts` needs score increments defined in `actions.ts`, but does not import `actions.ts` directly. Instead, `update.ts` wires the dependency through `setIncrementScore(incrementScore)`.
- `game.ts` exposes `setGameOverCallback()` so `main.ts` can wire game-over UI without `game.ts` importing `ui.ts`.

### UI layers

- **Overlay screens (Babylon GUI):** Start, pause, options, and game-over screens are built with `AdvancedDynamicTexture.CreateFullscreenUI` in `ui.ts`. Screens are `Rectangle` containers toggled via `.isVisible`. This is important because button clicks happen on the canvas, which allows `requestPointerLock()` to be called directly from overlay button handlers.
- **HUD and upgrade menu (DOM):** Health, ammo, score, wave info, heat bar, crosshair, and the upgrade picker are plain HTML/CSS. DOM element refs are cached in `dom` from `game.ts`. The upgrade menu uses `data-index` attributes on buttons; selections work via click or keyboard (`1`, `2`, `3`).
- **Enemy health bars and damage numbers (Babylon GUI):** World-space GUI created with `AdvancedDynamicTexture.CreateForMesh`, managed in `spawn.ts`.

### Input and pointer-lock notes

- Pointer lock is part of the normal game flow. Be careful changing pause, options, or overlay button behavior because the current setup is designed to reacquire pointer lock from canvas-originated UI events.
- `Esc` pauses the run and exits pointer lock.
- Middle mouse is bound to melee.
- Options persist volume and sensitivity in `localStorage` under `fps_volume` and `fps_sensitivity`.
- Pausing suspends audio and physics; resuming restores both.

### Import convention

All local imports use `.js` extensions, for example `from "./game.js"`, even though the source files are `.ts`. Keep that convention.

### Editing guidance

- Prefer placing source-of-truth updates in the right module:
  - gameplay tuning in `constants.ts`
  - current-stat math in `upgrades.ts`
  - mesh/effect creation and disposal in `spawn.ts`
  - player actions/combat in `actions.ts`
  - frame orchestration and wave logic in `update.ts`
  - pointer-lock / bootstrap flow in `main.ts`
- If you update docs, keep `README.md` player-facing and keep `AGENTS.md` focused on contributor/agent guidance.
- Prettier is the repo formatting standard. After making changes, format touched files with Prettier. Prefer `npx prettier --write <files>` for focused edits or `npm run format` when broader formatting is appropriate.
- Do not revert unrelated user changes if the worktree is dirty.
