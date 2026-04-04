// ─── Arena ───────────────────────────────────────────────────────────────────
export const ARENA = {
  size: 50, // square arena side length (m)
  ceil: 12, // ceiling height (m)
} as const;

// ─── Lighting & Fog ─────────────────────────────────────────────────────────
export const LIGHTING = {
  ambientIntensity: 0.01,
  ambientGroundR: 0.03,
  ambientGroundG: 0.03,
  ambientGroundB: 0.05,
  lampHeight: 5, // lamp height from floor (m)
  spotAngle: Math.PI * 0.9, // radians — wider cone for lower lamp
  spotExponent: 1.25, // softer falloff at edges
  spotIntensity: 2.5, // slightly dimmer up close
  spotRange: 25, // m
  fogDensity: 0.03,
} as const;

// ─── Enemy — Base Stats ─────────────────────────────────────────────────────
export const ENEMY = {
  hp: 5000,
  speed: 2, // m/s
  meleeRange: 1.8, // m
  meleeDamage: 10,
  meleeAttacksPerMin: 50,
  chaseRange: 25, // m
  minSpawnDist: 10, // min distance from player when spawning (m)
  // Per-wave scaling
  hpPerWave: 10,
  speedPerWave: 0.2, // m/s per wave after wave 1
  meleeDamagePerWave: 2.4,
  meleeAttacksPerMinPerWave: 3,
  // Movement
  turnSpeed: 3, // radians per second
  zigzagFreq: 0.5, // full zigzag cycles per second
  zigzagAmplitude: 0.8, // lateral offset strength (0-1)
} as const;

// ─── Health Bar ─────────────────────────────────────────────────────────────
export const ENEMY_HEALTH_BAR = {
  width: 0.8, // world-space plane width (m)
  height: 0.05, // world-space plane height (m)
  offsetY: 1.2, // distance above enemy center (m)
  texW: 120, // texture resolution width (px)
  texH: 12, // texture resolution height (px)
  color: "#ff4444", // fill color
  bgColor: "rgba(128, 128, 128, 0.4)", // missing health background
} as const;

// ─── Player — Health & Movement ─────────────────────────────────────────────
export const PLAYER = {
  maxHealth: 10000,
  spawnY: 0.9,
  speed: 5, // m/s
  sprintMultiplier: 2,
  acceleration: 0.15, // lerp factor per frame (0 = sluggish, 1 = instant)
  jumpSpeed: 13, // m/s upward — with gravity -20 this reaches ~4.2 m
} as const;

// ─── Player — Weapon ────────────────────────────────────────────────────────
export const BEAM = {
  damage: 25,
  rateOfFire: 600, // rounds per minute
  magSize: 32, // rounds per magazine
  reserveMags: 4, // starting reserve magazines
  maxReserveMags: 5,
  reloadTime: 3000, // ms
} as const;

// ─── Player — Spread ────────────────────────────────────────────────────────
export const SPREAD = {
  perShot: 0.004, // radians added per shot
  max: 0.06, // radians max
  decay: 0.12, // radians per second of recovery
  moveRate: 0.08, // radians per second while moving
} as const;

// ─── Player — Heat ──────────────────────────────────────────────────────────
export const HEAT = {
  perShot: 3,
  max: 100, // overheat threshold
  critical: 0.75, // fraction of max for critical threshold
  decay: 40, // heat lost per second while cooling
  cooldownDelay: 1000, // ms of not firing before heat decays
} as const;

// ─── Player — Orb (Alt-Fire) ────────────────────────────────────────────────
export const ORB = {
  damage: 50,
  speed: 30, // m/s
  radius: 0.1, // visual radius (m)
  explosionRadius: 2, // m — splash damage range
  ammoCost: 8,
  heatMultiplier: 6, // heat per shot multiplied by this
  cooldownMultiplier: 4, // cooldown multiplied by this
  splashFalloff: 0.5, // max splash damage = direct * this
  maxChargeHold: 1000, // ms to hold at max charge before auto-fire
  gravity: 5, // m/s² gravity for dump-fired orbs
  fuse: 6000, // ms — orb detonation timer (all orbs)
  bounceDamping: 0.6, // velocity retained after bounce (gravity orbs)
} as const;

// ─── Scoring ────────────────────────────────────────────────────────────────
export const SCORING = {
  kill: 100,
  waveComplete: 250,
} as const;

// ─── Supplies ───────────────────────────────────────────────────────────────
export const SUPPLY = {
  scoreInterval: 500, // score interval between supply drop chances
  dropRate: 0.25,
  healthAmount: 25,
  collectRange: 1.5, // m
} as const;

// ─── Waves ──────────────────────────────────────────────────────────────────
export const WAVE = {
  baseEnemies: 5,
  growth: 3, // extra enemies per wave
  spawnIntervalMs: 1500, // ms between enemy spawns
  pauseMs: 10000, // ms pause between waves
  maxAlive: 10,
} as const;

// ─── Critical Hits ─────────────────────────────────────────────────────────
export const CRIT = {
  chance: 0.08, // base % chance
  damage: 2, // base multiplier
} as const;

// ─── Multishot ────────────────────────────────────────────────────────────
export const MULTISHOT = {
  chance: 0.08, // base % chance to fire 3 shots
  angle: 0.12, // radians — spread angle for side shots
} as const;

// ─── Ricochet ─────────────────────────────────────────────────────────────
export const RICOCHET = {
  chance: 0.08, // base % chance to ricochet on impact
  spread: 0.05, // radians — random spread added to reflection
  maxDepth: 10, // max ricochet chain length
} as const;

// ─── Lightning ────────────────────────────────────────────────────────────
export const LIGHTNING = {
  chance: 0.08, // base % chance per hit to trigger lightning
  damage: 15, // base damage per bolt
  chainRange: 5, // m — max distance to chain to next enemy
  maxChains: 3, // max number of chain jumps
} as const;

// ─── Ignite ──────────────────────────────────────────────────────────────
export const IGNITE = {
  chance: 0.5, // base % chance to ignite on any damage
  damagePerSec: 8, // fire DOT damage per second
  spreadRange: 2, // m — max distance fire can spread to nearby enemies
  spreadTickMs: 500, // ms between spread checks per burning enemy
  ticksPerSec: 2, // fire damage ticks per second
} as const;

// ─── Upgrades — Amount Gained Per Upgrade ───────────────────────────────────
export const UPGRADE = {
  maxHealth: 25,
  speed: 0.5, // m/s
  reloadSpeed: 0.25, // % faster per upgrade (exponential decay)
  magSize: 16, // rounds
  rateOfFire: 0.25, // + % of base RPM per upgrade
  heatCapacity: 0.5, // + % of base heat cap per upgrade
  heatDecay: 0.5, // + % of base heat decay per upgrade
  bloomReduction: 0.25, // % less bloom per shot per upgrade
  moveSpreadReduction: 0.25, // % less spread from movement per upgrade
  beamDamage: 5,
  orbDamage: 10,
  supplyDropRate: 0.05, // + % absolute drop chance per upgrade
  critChance: 0.03, // + % per upgrade
  critDamage: 0.25, // +0.25x per upgrade
  orbSelfDamageReduction: 0.5, // % less self-damage per upgrade (exponential)
  multishotChance: 0.04, // + % per upgrade
  ricochetChance: 0.04, // + % per upgrade
  lightningChance: 0.03, // + % per upgrade
  igniteChance: 0.03, // + % per upgrade
} as const;

// ─── Audio ──────────────────────────────────────────────────────────────────
export const AUDIO = {
  masterVolumeMult: 4, // all sounds scaled up by this factor
} as const;

// ─── Bullet Holes ───────────────────────────────────────────────────────────
export const BULLET_HOLE = {
  glowMs: 1500, // ms before glow fades
  darkR: 0.02, // RGB components for faded bullet hole color
  darkG: 0.02,
  darkB: 0.02,
} as const;
