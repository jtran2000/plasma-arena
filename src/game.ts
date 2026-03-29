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
import {
  PLAYER_MAX_HEALTH,
  PLAYER_MAG_SIZE,
  PLAYER_RESERVE_MAGS,
  SUPPLY_SCORE_INTERVAL,
  WAVE_BASE_ENEMIES,
} from "./constants.js";

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
  orbCooldown: number;
  heat: number;
  heatCooldownTimer: number;
  overheated: boolean;
  running: boolean;
  paused: boolean;
  nextSupplyThreshold: number;
  wave: number;
  waveEnemiesLeft: number;
  waveSpawnTimer: number;
  wavePauseTimer: number;
  waveActive: boolean;
}

export interface Supply {
  mesh: Mesh;
  aggregate: PhysicsAggregate;
  type: "health" | "ammo";
}

export interface Orb {
  mesh: Mesh;
  velocity: Vector3;
  age: number;
  heatPenalty: number;
  chargeMultiplier: number;
  isCrit: boolean;
  hasGravity: boolean;
}

export interface Enemy {
  physMesh: Mesh;
  visualRoot: Mesh;
  bodyMesh: Mesh;
  headMesh: Mesh;
  leftLeg: Mesh;
  rightLeg: Mesh;
  leftArm: Mesh;
  rightArm: Mesh;
  aggregate: PhysicsAggregate;
  hp: number;
  maxHp: number;
  speed: number;
  state: "patrol" | "chase";
  patrolTarget: Vector3;
  attackCooldown: number;
  meleeDamage: number;
  meleeIntervalMs: number;
  zigzagTimer: number;
  flashTime: number;
  flashMesh: Mesh | null;
  baseEmissive: Color3;
  walkPhase: number;
  lastFootLeft: boolean;
  facingYaw: number;
  attackAnimTime: number;
}

export function makeState(): GameState {
  return {
    health: PLAYER_MAX_HEALTH,
    ammo: PLAYER_MAG_SIZE,
    reserve: PLAYER_MAG_SIZE * PLAYER_RESERVE_MAGS,
    score: 0,
    kills: 0,
    reloading: false,
    reloadTimeLeft: 0,
    autoReloadDelay: 0,
    hitFlashTime: 0,
    shootCooldown: 0,
    orbCooldown: 0,
    heat: 0,
    heatCooldownTimer: 0,
    overheated: false,
    running: false,
    paused: false,
    nextSupplyThreshold: SUPPLY_SCORE_INTERVAL,
    wave: 1,
    waveEnemiesLeft: WAVE_BASE_ENEMIES,
    waveSpawnTimer: 0,
    wavePauseTimer: 0,
    waveActive: true,
  };
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────
function getEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

export const dom = {
  canvas: getEl("renderCanvas") as HTMLCanvasElement,
  overlay: getEl("overlay"),
  startBtn: getEl("start-btn"),
  hud: getEl("hud"),
  gameOver: getEl("game-over"),
  restartBtn: getEl("restart-btn"),
  healthBar: getEl("health-bar"),
  healthFill: getEl("health-fill"),
  healthText: getEl("health-text"),
  ammoEl: getEl("ammo-value"),
  scoreEl: getEl("score-value"),
  killsEl: getEl("kills-value"),
  finalWaveEl: getEl("final-wave"),
  finalScoreEl: getEl("final-score"),
  hitFlash: getEl("hit-flash"),
  reloadMsg: getEl("reload-msg"),
  pauseScreen: getEl("pause-screen"),
  crosshair: getEl("crosshair"),
  chTop: document.querySelector(".ch-top") as HTMLElement,
  chBottom: document.querySelector(".ch-bottom") as HTMLElement,
  chLeft: document.querySelector(".ch-left") as HTMLElement,
  chRight: document.querySelector(".ch-right") as HTMLElement,
  waveDisplay: getEl("wave-display"),
  waveValue: getEl("wave-value"),
  waveRemaining: getEl("wave-remaining"),
  waveBanner: getEl("wave-banner"),
  heatBar: getEl("heat-bar"),
  heatFill: getEl("heat-fill"),
  overheatMsg: getEl("overheat-msg"),
  upgradeMenu: getEl("upgrade-menu"),
  upgradeLabels: Array.from(document.querySelectorAll(".upgrade-label")) as HTMLElement[],
  upgradeCounts: Array.from(document.querySelectorAll(".upgrade-count")) as HTMLElement[],
  upgradeButtons: Array.from(document.querySelectorAll(".upgrade-option")) as HTMLButtonElement[],
  optionsScreen: getEl("options-screen"),
  optionsBtn: getEl("options-btn"),
  startOptionsBtn: getEl("start-options-btn"),
  optionsBackBtn: getEl("options-back-btn"),
  volumeSlider: getEl("volume-slider") as HTMLInputElement,
  volumeValue: getEl("volume-value"),
  sensitivitySlider: getEl("sensitivity-slider") as HTMLInputElement,
  sensitivityValue: getEl("sensitivity-value"),
};

// ─── Shared mutable game context ──────────────────────────────────────────────
// All modules import this object to read and write shared game state.
export const g = {
  engine: new Engine(dom.canvas, true, { preserveDrawingBuffer: true }),
  state: makeState(),
  scene: null as unknown as Scene,
  camera: null as unknown as UniversalCamera,
  shadowGenerator: null as unknown as ShadowGenerator,
  playerMesh: null as unknown as Mesh,
  playerAggregate: null as unknown as PhysicsAggregate,
  playerVelocityXZ: Vector3.Zero(),
  enemies: [] as Enemy[],
  orbs: [] as Orb[],
  supplies: [] as Supply[],
  bulletHoles: [] as Mesh[],
  bulletHoleTimes: [] as number[],
  glowingHoles: [] as { mesh: Mesh; time: number }[],
  particleTex: null as unknown as DynamicTexture,
  weaponRoot: null as unknown as Mesh,
  weaponBarrel: null as unknown as Mesh,
  barrelTip: null as unknown as Mesh,
  weaponCell: null as unknown as Mesh,
  mouseHeld: false,
  mouse2Held: false,
  orbCharging: false,
  orbChargeTime: 0,
  orbChargeAmmo: 0,
  orbChargeMesh: null as Mesh | null,
  orbChargeOsc: null as OscillatorNode | null,
  orbChargeGain: null as GainNode | null,
  orbChargeCrit: false,
  orbMaxChargeTimer: 0,
  shootSpread: 0,
  moveSpread: 0,
  isSprinting: false,
  beamAudioCtx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  sprintBobTime: 0,
  pressedKeys: new Set<string>(),
  upgrades: {
    maxHealth: 0,
    speed: 0,
    reloadTime: 0,
    magSize: 0,
    rateOfFire: 0,
    heatCapacity: 0,
    heatDecay: 0,
    bloom: 0,
    moveSpread: 0,
    beamDamage: 0,
    orbDamage: 0,
    supplyDropRate: 0,
    critChance: 0,
    critDamage: 0,
    orbSelfDamage: 0,
  },
  pendingUpgrades: [] as string[],
};
