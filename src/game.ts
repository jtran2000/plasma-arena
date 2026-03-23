import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  ShadowGenerator,
  Mesh,
  PhysicsAggregate,
  DynamicTexture,
  Color3,
} from "@babylonjs/core";
import { PLAYER_MAG_SIZE, PLAYER_RESERVE_AMMO, PICKUP_SCORE_INTERVAL } from "./constants.js";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GameState {
  health: number;
  ammo: number;
  reserve: number;
  score: number;
  kills: number;
  reloading: boolean;
  reloadTimeLeft: number;
  autoReloadDelay: number;
  hitFlashTime: number;
  shootCooldown: number;
  running: boolean;
  paused: boolean;
  nextPickupThreshold: number;
}

export interface Pickup {
  mesh: Mesh;
  type: "health" | "ammo";
}

export interface Enemy {
  physMesh: Mesh;
  bodyMesh: Mesh;
  headMesh: Mesh;
  aggregate: PhysicsAggregate;
  hp: number;
  maxHp: number;
  speed: number;
  state: "patrol" | "chase";
  patrolTarget: Vector3;
  attackCooldown: number;
  flashTime: number;
  flashMesh: Mesh | null;
  baseEmissive: Color3;
}

export function makeState(): GameState {
  return {
    health: 100,
    ammo: PLAYER_MAG_SIZE,
    reserve: PLAYER_RESERVE_AMMO,
    score: 0,
    kills: 0,
    reloading: false,
    reloadTimeLeft: 0,
    autoReloadDelay: 0,
    hitFlashTime: 0,
    shootCooldown: 0,
    running: false,
    paused: false,
    nextPickupThreshold: PICKUP_SCORE_INTERVAL,
  };
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
function getEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

export const dom = {
  canvas:       getEl("renderCanvas") as HTMLCanvasElement,
  overlay:      getEl("overlay"),
  startBtn:     getEl("start-btn"),
  hud:          getEl("hud"),
  gameOver:     getEl("game-over"),
  restartBtn:   getEl("restart-btn"),
  healthEl:     getEl("health-value"),
  ammoEl:       getEl("ammo-value"),
  scoreEl:      getEl("score-value"),
  killsEl:      getEl("kills-value"),
  finalScoreEl: getEl("final-score"),
  hitFlash:     getEl("hit-flash"),
  reloadMsg:    getEl("reload-msg"),
  pauseScreen:  getEl("pause-screen"),
  crosshair:    getEl("crosshair"),
};

// ─── Shared mutable game context ──────────────────────────────────────────────
// All modules import this object to read and write shared game state.
export const g = {
  engine:           new Engine(dom.canvas, true, { preserveDrawingBuffer: true }),
  state:            makeState(),
  scene:            null as unknown as Scene,
  camera:           null as unknown as UniversalCamera,
  shadowGenerator:  null as unknown as ShadowGenerator,
  playerMesh:       null as unknown as Mesh,
  playerAggregate:  null as unknown as PhysicsAggregate,
  playerVelocityXZ: Vector3.Zero(),
  enemies:          [] as Enemy[],
  pickups:          [] as Pickup[],
  bulletHoles:      [] as Mesh[],
  bulletHoleTimes:  [] as number[],
  respawnTimers:    [] as number[],
  particleTex:      null as unknown as DynamicTexture,
  weaponRoot:       null as unknown as Mesh,
  barrelTip:        null as unknown as Mesh,
  weaponCell:       null as unknown as Mesh,
  mouseHeld:        false,
  isSprinting:      false,
  beamAudioCtx:     null as AudioContext | null,
  sprintBobTime:    0,
  pressedKeys:      new Set<string>(),
};
