# Babylon FPS

A browser-based first-person shooter built with [Babylon.js](https://www.babylonjs.com/) and [Vite](https://vitejs.dev/).

## Features

- First-person camera with pointer lock and mouse look
- WASD movement with gravity and collision detection
- Sprint (hold Shift)
- Raycast shooting with muzzle flash, blood splatter, and bullet hole decals
- 8 enemy bots that patrol and chase the player, dealing melee damage on contact
- 30-round magazine with manual (`R`) and auto reload
- Shadow mapping, exponential fog, and particle effects
- HUD showing health, ammo, score, and kill count
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
| Left Click | Shoot |
| `R` | Reload |
| `Shift` | Sprint |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |

## Tech Stack

- **[Babylon.js](https://www.babylonjs.com/)** — 3D engine (rendering, physics, particles, shadows)
- **[Vite](https://vitejs.dev/)** — build tool and dev server
