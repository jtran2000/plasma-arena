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
                 `BLASTER`, `RIFLE`, `SCORING`, `SUPPLY`, `WAVE`, `CRIT`,
                 `UPGRADE`, etc.)
game.ts       <- Central state hub: `GameState`, `Enemy`, `Supply`, `Plasma`
                 interfaces; shared mutable `g` object and cached `dom` refs
build.ts      <- Scene setup: camera, physics, lighting, arena geometry, weapon
spawn.ts      <- Mesh/material factories, physics aggregates, and all spawn /
                 visual-effect functions (`spawnEnemy`, `spawnPlasma`,
                 `killEnemy`, particles, lightning, health bars, etc.)
audio.ts      <- Synthesized spatial audio (Web Audio API, HRTF panners,
                 no audio files)
progression.ts <- `effective*()` stat functions, weighted upgrade defs,
                  score progression, upgrade menu UI, HUD updates
actions.ts    <- Player actions: jumping, melee, laser shooting, plasma
                 charging/firing, reloading, damage, scoring, proc logic
update.ts     <- Game loop: player movement, enemy AI, waves, timers, HUD
ui.ts         <- Babylon GUI overlay screens (start, pause, options, game over)
flow.ts       <- Run lifecycle orchestration: start/reset, end, pause, resume
input.ts      <- Global and per-scene input binding
main.ts       <- Entry point: bootstrap, pointer-lock lifecycle, render loop
```

**Data flow:** `game.ts` exports the mutable `g` object, and the rest of the code reads/writes shared state through it. `constants.ts` is the source of truth for gameplay tuning. `update.ts` contains the core loop registered with `scene.registerBeforeRender(update)`.

### Key patterns

- **Constants are grouped objects:** All game-tuning values live in `constants.ts` as exported `as const` objects. The main groups are `ARENA`, `LIGHTING`, `ENEMY`, `ENEMY_HEALTH_BAR`, `PLAYER` (includes `STAMINA` and `BARREL_CLIP`), `BLASTER`, `RIFLE`, `SCORING`, `SUPPLY`, `WAVE`, `CRIT`, `UPGRADE`, `AUDIO`, and `BULLET_HOLE`.
- **`BLASTER` is nested:** Laser, plasma, spread, heat, multishot, ricochet, lightning, ignite, and melee tuning all live under `BLASTER`. Do not document or reintroduce the older split `LASER` / `PLASMA` constant pattern.
- **Spawning and mesh creation belong in `spawn.ts`:** All functions that create meshes, spawn entities, create visual effects, or handle enemy death / ragdoll cleanup belong there. The game loop in `update.ts` should orchestrate, not create/dispose scene content directly.
- **Progression uses effective functions:** `effective*()` helpers in `progression.ts` are the single source of truth for current stat values. If gameplay code needs the current damage, cooldown, heat, spread, or chance values, use those helpers rather than recomputing upgrade math elsewhere.
- **Weapon progression is upgrade-gated:** The run starts with the basic laser only. `Pulse Laser`, `Plasma Caster`, `Plasma Charger`, and `Plasma Grenadier` are unlocks, not baseline abilities.
- **Rifle progression is upgrade-gated:** `Rifle` unlocks the alternate weapon; `Muzzle Brake`, `Scope`, and `Laser Sight` require the rifle; and `Bayonet` requires the muzzle brake. Rifle ammo/recoil/tracer/muzzle-flash/melee/bayonet/scope/laser tuning lives under `RIFLE` in `constants.ts`; the unlock state lives in `g.upgrades`.
- **Sprint ramp is gameplay state:** Sprint acceleration is distance-based (`PLAYER.sprintRampDistance`) and turning lowers ramp based on `PLAYER.sprintRampResetTurnAngle`. Keep sprint interruption, ramp direction, and bayonet-charge eligibility in `update.ts` unless you are deliberately refactoring movement.
- **Bayonet embed is cross-system but update-owned:** Non-lethal bayonet charge impacts embed the bayonet, tether the player/enemy, preserve player yaw while the camera pitch adjusts toward the embed point, and pin the enemy through `update.ts` state processing. Release paths live in `releaseBayonetEmbed()` from `game.ts`; reload, backward movement, weapon switching, enemy death, pause, and end/start lifecycle should all clear the embed consistently.
- **Barrel-clip detection tilts the weapon and blocks shooting:** `update.ts` raycasts from the camera to the untilted rest-pose barrel tip each frame. When geometry is in the way, `g.barrelClipping` is set, the weapon tilts up (lerped via `g.barrelClipT`), the crosshair hides, and `shoot()` is gated. Melee and bayonet embed bypass the barrel-clip gate so combat still works at point blank. The laser sight follows the tilted barrel direction when clipping. Tuning lives in `PLAYER.BARREL_CLIP`.
- **Proc mechanics are also gated:** `multishotUnlock`, `ricochetUnlock`, `lightningUnlock`, and `igniteUnlock` must be earned before their corresponding scaling upgrades matter.
- **Laser and plasma share systems:** Both use the same ammo pool and heat system.
- **Score rewards are queued:** `incrementScore()` lives in `progression.ts` and queues score-threshold supply drops in `g.queuedSupplyDrops`. `update.ts` drains that queue and calls `spawnSupply()`, which keeps `progression.ts` independent from `spawn.ts`.
- **All audio is synthesized:** Web Audio oscillators and noise buffers feed through spatial panners. There are no audio files in the repo.

### Circular dependency avoidance

- Prefer module organization over escape hatches. Code should be structured to avoid circular dependencies, runtime/dynamic imports, and cross-module callback bridges wherever possible.
- Do not use runtime `import()` to paper over a cycle unless the user explicitly asks for lazy loading/code splitting or approves that tradeoff for a specific case.
- Do not add callback setters like `setFooCallback()` just to avoid an import cycle. Instead, move shared logic into a lower-level module, split orchestration from state, or queue data through `g` for the main loop to process.
- `updateHUD`, `incrementScore`, and the `effective*()` helpers live in `progression.ts` so `actions.ts`, `spawn.ts`, and `update.ts` can import them directly.
- Avoid importing `actions.ts` from `spawn.ts` or `spawn.ts` from `progression.ts`; that is what the queued supply-drop path is designed to prevent.
- `startGame()` and `endGame()` both live in `flow.ts`. `actions.ts` should not import `flow.ts`; it only mutates player health, and `main.ts` observes `g.state.health <= 0` in the render loop before calling `endGame()`.
- `main.ts` detects the `running -> false` transition in the render loop and calls the game-over UI, avoiding a game-over callback bridge.
- `flow.ts` owns run lifecycle actions, while `main.ts` owns top-level bootstrap/pointer-lock/render-loop concerns. Keep that split when changing start, restart, pause, or resume behavior.
- `ui.ts` may import `flow.ts` for start/restart button handlers, but `flow.ts` must not import `ui.ts`; UI overlay recreation and show/hide behavior belongs on the UI/main side of that boundary.

### UI layers

- **Overlay screens (Babylon GUI):** Start, pause, options, and game-over screens are built with `AdvancedDynamicTexture.CreateFullscreenUI` in `ui.ts`. Screens are `Rectangle` containers toggled via `.isVisible`. This is important because button clicks happen on the canvas, which allows `requestPointerLock()` to be called directly from overlay button handlers.
- **HUD and upgrade menu (DOM):** Health, ammo, score, wave info, heat bar, crosshair, and the upgrade picker are plain HTML/CSS. DOM element refs are cached in `dom` from `game.ts`. The upgrade menu uses `data-index` attributes on buttons; selections work via click or keyboard (`1`, `2`, `3`).
- **Enemy health bars and damage numbers (Babylon GUI):** World-space GUI created with `AdvancedDynamicTexture.CreateForMesh`, managed in `spawn.ts`.

### Input and pointer-lock notes

- Pointer lock is part of the normal game flow. Be careful changing pause, options, or overlay button behavior because the current setup is designed to reacquire pointer lock from canvas-originated UI events.
- `Esc` pauses the run and exits pointer lock.
- Middle mouse is bound to melee.
- Mouse wheel switches between blaster and rifle after the rifle is unlocked.
- Right mouse scopes only when the rifle scope is unlocked, the rifle is active, and the player is standing still; otherwise it remains part of the blaster plasma path.
- Options persist volume and sensitivity in `localStorage` under `fps_volume` and `fps_sensitivity`.
- Pausing suspends audio and physics; resuming restores both.

### Import convention

All local imports use `.js` extensions, for example `from "./game.js"`, even though the source files are `.ts`. Keep that convention.

### Editing guidance

- Prefer placing source-of-truth updates in the right module:
  - gameplay tuning in `constants.ts`
  - current-stat math, score progression, and upgrade menu logic in `progression.ts`
  - mesh/effect creation and disposal in `spawn.ts`
  - player actions/combat in `actions.ts`
  - frame orchestration and wave logic in `update.ts`
  - player movement, sprint ramp, bayonet charge, bayonet embed, and barrel-clip detection in `update.ts`
  - run lifecycle in `flow.ts`
  - input binding in `input.ts`
  - pointer-lock / bootstrap flow in `main.ts`
- If you update docs, keep `README.md` player-facing and keep `AGENTS.md` focused on contributor/agent guidance.
- Prettier is the repo formatting standard. After making changes, format touched files with Prettier. Prefer `npx prettier --write <files>` for focused edits or `npm run format` when broader formatting is appropriate.
- Do not revert unrelated user changes if the worktree is dirty.
