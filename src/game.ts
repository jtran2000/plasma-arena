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
  ParticleSystem,
  PointLight,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Rectangle } from "@babylonjs/gui";
import { PLAYER, BLASTER, RIFLE, SUPPLY, WAVE } from "./constants.js";
const { LASER } = BLASTER;

export type WeaponKind = "blaster" | "rifle";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GameState {
  health: number;
  ammo: number;
  reserve: number;
  activeWeapon: WeaponKind;
  score: number;
  kills: number;
  reloading: boolean;
  reloadTimeLeft: number;
  autoReloadDelay: number;
  hitFlashTime: number;
  shootCooldown: number;
  plasmaCooldown: number;
  heat: number;
  heatCooldownTimer: number;
  overheated: boolean;
  running: boolean;
  paused: boolean;
  nextSupplyThreshold: number;
  meleeCooldown: number;
  meleeAnimTime: number;
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

export interface Plasma {
  mesh: Mesh;
  velocity: Vector3;
  age: number;
  heatPenalty: number;
  chargeMultiplier: number;
  isCrit: boolean;
  hasGravity: boolean;
  ricochetDepth: number;
}

export interface RifleBullet {
  mesh: Mesh;
  velocity: Vector3;
  age: number;
  damage: number;
  isCrit: boolean;
}

export interface UpgradeState {
  maxHealth: number;
  speed: number;
  reloadTime: number;
  magSize: number;
  rateOfFire: number;
  heatCapacity: number;
  heatDecay: number;
  bloom: number;
  moveSpread: number;
  laserDamage: number;
  plasmaDamage: number;
  supplyDropRate: number;
  critChance: number;
  critDamage: number;
  plasmaSelfDamage: number;
  multishot: number;
  multishotUnlock: boolean;
  ricochet: number;
  ricochetUnlock: boolean;
  lightning: number;
  lightningUnlock: boolean;
  ignite: number;
  igniteUnlock: boolean;
  pulseLaser: boolean;
  plasmaCaster: boolean;
  plasmaCharger: boolean;
  plasmaGrenadier: boolean;
  rifleUnlock: boolean;
  muzzleBrake: boolean;
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
  onFire: boolean;
  fireParticle: ParticleSystem | null;
  fireLight: PointLight | null;
  fireAudioSource: AudioBufferSourceNode | null;
  fireAudioPanner: PannerNode | null;
  fireAudioGain: GainNode | null;
  fireSpreadTimer: number;
  fireDmgAccum: number;
  healthBarPlane: Mesh | null;
  healthBarTexture: AdvancedDynamicTexture | null;
  healthBarFill: Rectangle | null;
}

export function makeState(): GameState {
  return {
    health: PLAYER.maxHealth,
    ammo: LASER.magSize,
    reserve: LASER.magSize * LASER.reserveMags,
    activeWeapon: "blaster",
    score: 0,
    kills: 0,
    reloading: false,
    reloadTimeLeft: 0,
    autoReloadDelay: 0,
    hitFlashTime: 0,
    shootCooldown: 0,
    plasmaCooldown: 0,
    heat: 0,
    heatCooldownTimer: 0,
    overheated: false,
    running: false,
    paused: false,
    meleeCooldown: 0,
    meleeAnimTime: 0,
    nextSupplyThreshold: SUPPLY.scoreInterval,
    wave: 1,
    waveEnemiesLeft: WAVE.baseEnemies,
    waveSpawnTimer: 0,
    wavePauseTimer: 0,
    waveActive: true,
  };
}

export function makeUpgradeState(): UpgradeState {
  return {
    maxHealth: 0,
    speed: 0,
    reloadTime: 0,
    magSize: 0,
    rateOfFire: 0,
    heatCapacity: 0,
    heatDecay: 0,
    bloom: 0,
    moveSpread: 0,
    laserDamage: 0,
    plasmaDamage: 0,
    supplyDropRate: 0,
    critChance: 0,
    critDamage: 0,
    plasmaSelfDamage: 0,
    multishot: 0,
    multishotUnlock: false,
    ricochet: 0,
    ricochetUnlock: false,
    lightning: 0,
    lightningUnlock: false,
    ignite: 0,
    igniteUnlock: false,
    pulseLaser: false,
    plasmaCaster: false,
    plasmaCharger: false,
    plasmaGrenadier: false,
    rifleUnlock: true,
    muzzleBrake: false,
  };
}

export function makeWeaponAmmoState(): Record<
  WeaponKind,
  { ammo: number; reserve: number }
> {
  return {
    blaster: {
      ammo: LASER.magSize,
      reserve: LASER.magSize * LASER.reserveMags,
    },
    rifle: {
      ammo: RIFLE.magSize,
      reserve: RIFLE.magSize * RIFLE.reserveMags,
    },
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
  hud: getEl("hud"),
  healthBar: getEl("health-bar"),
  healthFill: getEl("health-fill"),
  healthText: getEl("health-text"),
  weaponEl: getEl("weapon-value"),
  ammoEl: getEl("ammo-value"),
  scoreEl: getEl("score-value-alt"),
  killsEl: getEl("kills-value"),
  hitFlash: getEl("hit-flash"),
  reloadMsg: getEl("reload-msg"),
  crosshair: getEl("crosshair"),
  chTop: document.querySelector(".ch-top") as HTMLElement,
  chBottom: document.querySelector(".ch-bottom") as HTMLElement,
  chLeft: document.querySelector(".ch-left") as HTMLElement,
  chRight: document.querySelector(".ch-right") as HTMLElement,
  waveValue: getEl("wave-value"),
  waveRemaining: getEl("wave-remaining"),
  waveBanner: getEl("wave-banner"),
  heatBar: getEl("heat-bar"),
  heatFill: getEl("heat-fill"),
  overheatMsg: getEl("overheat-msg"),
  upgradeMenu: getEl("upgrade-menu"),
  upgradeLabels: Array.from(
    document.querySelectorAll(".upgrade-label"),
  ) as HTMLElement[],
  upgradeCounts: Array.from(
    document.querySelectorAll(".upgrade-count"),
  ) as HTMLElement[],
  upgradeButtons: Array.from(
    document.querySelectorAll(".upgrade-option"),
  ) as HTMLButtonElement[],
  instructionMsg: getEl("instruction-msg"),
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
  plasmas: [] as Plasma[],
  rifleBullets: [] as RifleBullet[],
  supplies: [] as Supply[],
  queuedSupplyDrops: [] as Vector3[],
  bulletHoles: [] as Mesh[],
  bulletHoleTimes: [] as number[],
  glowingHoles: [] as { mesh: Mesh; time: number }[],
  particleTex: null as unknown as DynamicTexture,
  blasterRoot: null as unknown as Mesh,
  blasterBarrel: null as unknown as Mesh,
  blasterBarrelTip: null as unknown as Mesh,
  blasterCell: null as unknown as Mesh,
  rifleRoot: null as unknown as Mesh,
  rifleBarrel: null as unknown as Mesh,
  rifleBarrelTip: null as unknown as Mesh,
  rifleBrake: null as unknown as Mesh,
  rifleMag: null as unknown as Mesh,
  weaponRoot: null as unknown as Mesh,
  weaponBarrel: null as unknown as Mesh,
  barrelTip: null as unknown as Mesh,
  weaponCell: null as unknown as Mesh,
  weaponAmmo: makeWeaponAmmoState(),
  mouseHeld: false,
  mouse2Held: false,
  plasmaCharging: false,
  plasmaChargeTime: 0,
  plasmaChargeAmmo: 0,
  plasmaChargeMesh: null as Mesh | null,
  plasmaChargeOsc: null as OscillatorNode | null,
  plasmaChargeGain: null as GainNode | null,
  plasmaChargeCrit: false,
  plasmaMaxChargeTimer: 0,
  shootSpread: 0,
  moveSpread: 0,
  isSprinting: false,
  guiTexture: null as unknown as AdvancedDynamicTexture,
  audioCtx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  sprintBobTime: 0,
  recoilPitch: 0,
  recoilRoll: 0,
  cameraRecoilPitch: 0,
  appliedCameraRecoilPitch: 0,
  crosshairRecoil: 0,
  pressedKeys: new Set<string>(),
  upgrades: makeUpgradeState(),
  pendingUpgrades: [] as string[],
};
