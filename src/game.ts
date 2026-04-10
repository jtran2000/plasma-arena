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
  SpotLight,
  Quaternion,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle } from "@babylonjs/gui";
import { PLAYER, BLASTER, RIFLE, SUPPLY, WAVE } from "./constants.js";
const { LASER } = BLASTER;

export type WeaponKind = "blaster" | "rifle";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GameState {
  health: number;
  stamina: number;
  staminaRegenDelay: number;
  staminaDisplayTimer: number;
  staminaRegenBlockedByJump: boolean;
  staminaWasFull: boolean;
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
  type: "health" | "ammo" | "rifleAmmo";
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

export interface BayonetEmbed {
  enemy: Enemy;
  direction: Vector3;
  hitNormal: Vector3;
  startPosition: Vector3;
  pinPosition: Vector3;
  targetHitPoint: Vector3;
  startPlayerPosition: Vector3;
  playerPosition: Vector3;
  startVisualRotation: Quaternion;
  targetVisualRotation: Quaternion;
  startCameraRotation: Vector3;
  targetCameraRotation: Vector3;
  playerCollideMask: number;
  enemyMembershipMask: number;
  progress: number;
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
  plasmaVelocity: number;
  combatBoots: boolean;
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
  rifleScope: boolean;
  rifleLaserSight: boolean;
  bayonet: boolean;
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
    stamina: PLAYER.STAMINA.max,
    staminaRegenDelay: 0,
    staminaDisplayTimer: 0,
    staminaRegenBlockedByJump: false,
    staminaWasFull: true,
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
    plasmaVelocity: 0,
    combatBoots: false,
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
    rifleUnlock: false,
    muzzleBrake: false,
    rifleScope: false,
    rifleLaserSight: false,
    bayonet: false,
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
  staminaBar: getEl("stamina-bar"),
  staminaFill: getEl("stamina-fill"),
  weaponEl: getEl("weapon-value"),
  ammoEl: getEl("ammo-value"),
  scoreEl: getEl("score-value-alt"),
  killsEl: getEl("kills-value"),
  hitFlash: getEl("hit-flash"),
  speedLines: getEl("speed-lines"),
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
  baseCameraAngularSensibility: 800,
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
  rifleAssembly: null as unknown as Mesh,
  rifleBarrel: null as unknown as Mesh,
  rifleBarrelTip: null as unknown as Mesh,
  rifleBrake: null as unknown as Mesh,
  rifleScope: null as unknown as Mesh,
  rifleLaserSight: null as unknown as Mesh,
  rifleLaserLight: null as SpotLight | null,
  rifleLaserGlow: null as PointLight | null,
  rifleLaserDot: null as unknown as Mesh,
  rifleBayonet: null as unknown as Mesh,
  scopeOverlayGui: null as unknown as AdvancedDynamicTexture,
  scopeOverlay: null as unknown as Control,
  rifleMag: null as unknown as Mesh,
  weaponRoot: null as unknown as Mesh,
  weaponBarrel: null as unknown as Mesh,
  barrelTip: null as unknown as Mesh,
  weaponCell: null as unknown as Mesh,
  weaponRestPosition: Vector3.Zero(),
  weaponSwitchTarget: null as WeaponKind | null,
  weaponSwitchTime: 0,
  weaponSwitchDuration: 0,
  weaponSwitchSwapped: false,
  rifleAssemblyBasePosition: Vector3.Zero(),
  rifleAssemblyBasePitch: 0,
  rifleAssemblyBaseYaw: 0,
  weaponAmmo: makeWeaponAmmoState(),
  mouseHeld: false,
  mouse2Held: false,
  rifleScoped: false,
  rifleScopeViewActive: false,
  rifleScopeRecoilKicked: false,
  rifleScopeAimT: 0,
  rifleScopeZoomT: 0,
  meleeHeld: false,
  bayonetCharging: false,
  bayonetChargeLockedUntilSprintEnd: false,
  bayonetChargeCooldownPending: false,
  bayonetEmbed: null as BayonetEmbed | null,
  bayonetEmbedLookDisabled: false,
  bayonetEmbedCameraPitch: 0,
  appliedBayonetEmbedCameraPitch: 0,
  bayonetChargeAnim: 0,
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
  sprintLookDisabled: false,
  sprintRamp: 0,
  sprintRampDirection: Vector3.Zero(),
  sprintBlockedUntilShiftRelease: false,
  guiTexture: null as unknown as AdvancedDynamicTexture,
  audioCtx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  sprintBobTime: 0,
  recoilPitch: 0,
  recoilRoll: 0,
  cameraRecoilPitch: 0,
  appliedCameraRecoilPitch: 0,
  rifleBloomRecoilHoldTimer: 0,
  crosshairRecoil: 0,
  barrelClipping: false,
  barrelClipT: 0,
  returnToStartScreen: false,
  pressedKeys: new Set<string>(),
  upgrades: makeUpgradeState(),
  pendingUpgrades: [] as string[],
};

const BAYONET_PINNED_ENEMY_MASK = 1 << 30;

export function cacheActiveWeaponAmmo(): void {
  g.weaponAmmo[g.state.activeWeapon].ammo = g.state.ammo;
  g.weaponAmmo[g.state.activeWeapon].reserve = g.state.reserve;
}

export function equipWeapon(kind: WeaponKind): void {
  cacheActiveWeaponAmmo();
  g.state.activeWeapon = kind;
  g.state.ammo = g.weaponAmmo[kind].ammo;
  g.state.reserve = g.weaponAmmo[kind].reserve;

  if (kind === "rifle") {
    g.weaponRoot = g.rifleRoot;
    g.weaponBarrel = g.rifleBarrel;
    g.barrelTip = g.rifleBarrelTip;
    g.weaponCell = g.rifleMag;
    g.rifleAssembly.position.copyFrom(g.rifleAssemblyBasePosition);
    g.rifleAssembly.rotation.x = g.rifleAssemblyBasePitch;
    g.rifleAssembly.rotation.y = g.rifleAssemblyBaseYaw;
    g.rifleAssembly.rotation.z = 0;
    g.weaponRestPosition = g.weaponRoot.position.clone();
    g.blasterRoot.setEnabled(false);
    g.rifleRoot.setEnabled(true);
  } else {
    g.weaponRoot = g.blasterRoot;
    g.weaponBarrel = g.blasterBarrel;
    g.barrelTip = g.blasterBarrelTip;
    g.weaponCell = g.blasterCell;
    g.weaponRestPosition = g.weaponRoot.position.clone();
    g.blasterRoot.setEnabled(true);
    g.rifleRoot.setEnabled(false);
  }
}

export function canSpendStamina(cost: number): boolean {
  return g.state.stamina >= cost;
}

export function spendStamina(cost: number): void {
  if (cost <= 0) return;
  g.state.stamina = Math.max(0, g.state.stamina - cost);
  g.state.staminaRegenDelay = PLAYER.STAMINA.regenDelayMs;
  g.state.staminaDisplayTimer = 0;
}

export function disableBayonetEmbedPlayerEnemyCollision(enemy: Enemy): {
  playerCollideMask: number;
  enemyMembershipMask: number;
} {
  const playerCollideMask = g.playerAggregate.shape.filterCollideMask;
  const enemyMembershipMask = enemy.aggregate.shape.filterMembershipMask;
  enemy.aggregate.shape.filterMembershipMask = BAYONET_PINNED_ENEMY_MASK;
  g.playerAggregate.shape.filterCollideMask =
    playerCollideMask & ~BAYONET_PINNED_ENEMY_MASK;
  return { playerCollideMask, enemyMembershipMask };
}

export function releaseBayonetEmbed(opts?: {
  preserveEnemyPose?: boolean;
}): void {
  const embed = g.bayonetEmbed;
  if (embed) {
    g.playerAggregate.shape.filterCollideMask = embed.playerCollideMask;
    if (g.enemies.includes(embed.enemy)) {
      embed.enemy.aggregate.shape.filterMembershipMask =
        embed.enemyMembershipMask;
    }
  }
  if (embed && g.enemies.includes(embed.enemy) && !opts?.preserveEnemyPose) {
    embed.enemy.visualRoot.rotationQuaternion = null;
    embed.enemy.visualRoot.rotation.x = 0;
    embed.enemy.visualRoot.rotation.y = embed.enemy.facingYaw;
    embed.enemy.leftLeg.rotation.x = 0;
    embed.enemy.leftLeg.rotation.z = 0;
    embed.enemy.rightLeg.rotation.x = 0;
    embed.enemy.rightLeg.rotation.z = 0;
    embed.enemy.leftArm.rotation.x = 0;
    embed.enemy.leftArm.rotation.z = 0;
    embed.enemy.rightArm.rotation.x = 0;
    embed.enemy.rightArm.rotation.z = 0;
    embed.enemy.aggregate.body.setLinearVelocity(Vector3.Zero());
  }
  g.bayonetEmbed = null;
  g.bayonetEmbedCameraPitch = 0;
  g.appliedBayonetEmbedCameraPitch = 0;
  restoreBayonetEmbedLook();
}

export function disableBayonetEmbedLook(): void {
  if (g.bayonetEmbedLookDisabled) return;
  g.camera.detachControl();
  g.bayonetEmbedLookDisabled = true;
}

export function disableSprintLook(): void {
  if (g.sprintLookDisabled) return;
  g.camera.detachControl();
  g.sprintLookDisabled = true;
}

export function restoreSprintLook(): void {
  if (!g.sprintLookDisabled) return;
  g.sprintLookDisabled = false;
  if (g.state.running && !g.state.paused && !g.bayonetEmbedLookDisabled) {
    g.camera.attachControl(dom.canvas, true);
  }
}

function restoreBayonetEmbedLook(): void {
  if (!g.bayonetEmbedLookDisabled) return;
  g.bayonetEmbedLookDisabled = false;
  if (g.state.running && !g.state.paused && !g.sprintLookDisabled) {
    g.camera.attachControl(dom.canvas, true);
  }
}
