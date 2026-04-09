// ─── Arena ───────────────────────────────────────────────────────────────────
export const ARENA = {
  size: 50, // square arena side length (m)
  ceil: 12, // ceiling height (m)
} as const;

// ─── Lighting & Fog ─────────────────────────────────────────────────────────
export const LIGHTING = {
  ambientIntensity: 0.01, // hemisphere light strength; raise for brighter shadows
  ambientGroundR: 0.03, // ground bounce red component
  ambientGroundG: 0.03, // ground bounce green component
  ambientGroundB: 0.05, // ground bounce blue component; slightly blue-tinted
  baseMaxSimultaneousLights: 6, // max lights per mesh before weapon-effect extras
  lampHeight: 5, // lamp height from floor (m)
  spotAngle: Math.PI * 0.9, // radians — wider cone for lower lamp
  spotExponent: 1.25, // falloff sharpness at cone edge; higher = harder edge
  spotIntensity: 2.5, // lamp brightness
  spotRange: 25, // lamp reach (m); beyond this the light contributes nothing
  fogDensity: 0.03, // exponential fog density; raise for thicker atmosphere
} as const;

// ─── Camera ─────────────────────────────────────────────────────────────────
export const CAMERA = {
  defaultFov: 1.2, // base field of view (radians, ~69°); scope divides this by zoom
} as const;

// ─── Enemy — Base Stats ─────────────────────────────────────────────────────
export const ENEMY = {
  hp: 50, // base hit points at wave 1
  mass: 120, // physics mass (kg); higher = harder to knock back
  //speed: 2, // base move speed (m/s)
  speed: 0,
  meleeRange: 1.8, // distance at which enemy can hit player (m)
  meleeFacingDot: Math.PI / 4, // melee allowed only when facing within 45 degrees of the player
  meleeDamage: 10, // base damage per melee swing
  meleeAttacksPerMin: 50, // base swings per minute
  chaseRange: 25, // detection radius (m); beyond this enemies idle
  minSpawnDist: 10, // min distance from player when spawning (m)
  // Per-wave scaling — applied additively starting at wave 2
  hpPerWave: 10, // extra HP per wave
  speedPerWave: 0.2, // extra m/s per wave
  meleeDamagePerWave: 2.4, // extra melee damage per wave
  meleeAttacksPerMinPerWave: 3, // extra swings/min per wave
  // Movement AI
  //turnSpeed: 3, // how fast enemies rotate toward the player (rad/s)
  turnSpeed: 0,
  zigzagFreq: 0.5, // full lateral zigzag cycles per second
  zigzagAmplitude: 0.8, // lateral offset strength (0–1); higher = wider strafes
} as const;

// ─── Health Bar ─────────────────────────────────────────────────────────────
export const ENEMY_HEALTH_BAR = {
  width: 0.8, // world-space plane width (m)
  height: 0.05, // world-space plane height (m)
  offsetY: 1.2, // distance above enemy center (m)
  texW: 120, // texture resolution width (px)
  texH: 12, // texture resolution height (px)
  color: "#ff4444", // fill color for remaining health
  bgColor: "rgba(128, 128, 128, 0.4)", // background color for missing health
} as const;

// ─── Player — Health & Movement ─────────────────────────────────────────────
export const PLAYER = {
  maxHealth: 100, // starting and max health
  mass: 35, // physics mass (kg)
  spawnY: 0.9, // camera height above floor (m)
  speed: 5, // base walk speed (m/s)
  sprintMultiplier: 2, // top sprint speed = walk speed × this
  sprintRampDistance: 5, // m of straight-line travel to reach full sprint
  sprintTurnSpeed: Math.PI / 2, // max turn rate while sprinting (rad/s)
  sprintRampResetTurnAngle: Math.PI / 4, // turn angle (rad) that fully clears sprint ramp; 45°
  sprintImpactMinRamp: 0.25, // ignore wall impacts below this ramp fraction; prevents false stops
  sprintImpactSpeedRatio: 0.45, // if actual/expected speed drops below this, cancel sprint (blocked)
  acceleration: 0.15, // per-frame lerp factor toward target velocity (0 = sluggish, 1 = instant)
  jumpSpeed: 13, // upward impulse (m/s); with gravity −20 reaches ~4.2 m
  STAMINA: {
    max: 100, // full stamina pool
    regenPerSec: 30, // stamina recovered per second after the regen delay
    regenDelayMs: 700, // ms after spending stamina before regen starts
    displayMs: 1200, // ms the stamina bar stays visible after stamina is spent
    sprintDrainPerSec: 18, // stamina drained each second while sprinting
    jumpCost: 18, // stamina spent on a grounded jump
    meleeCost: 14, // stamina spent on a melee swing
    scopeDrainPerSec: 6, // stamina drained each second while scoped
    lowFraction: 0.5, // stamina bar warning threshold
    criticalFraction: 0.25, // stamina bar critical threshold
    combatBootsSprintScale: 0.65, // sprint drain multiplier with Combat Boots
    combatBootsJumpScale: 0.6, // jump cost multiplier with Combat Boots
  },
  BARREL_CLIP: {
    tiltX: -0.9, // weapon pitch when barrel is blocked (radians, negative = up)
    lerpSpeed: 12, // interpolation speed toward blocked / unblocked pose (units/s)
  },
} as const;

// ─── Blaster — Weapon System ────────────────────────────────────────────────
export const BLASTER = {
  LASER: {
    damage: 25, // base damage per laser hit
    rateOfFire: 300, // rounds per minute (semi-auto until Pulse Laser)
    magSize: 32, // rounds per magazine
    reserveMags: 4, // starting reserve magazines
    maxReserveMags: 5, // cap on reserve mags from supply pickups
    reloadTime: 3000, // reload duration (ms)
  },
  PLASMA: {
    damage: 50, // base direct-hit damage
    speed: 30, // projectile velocity (m/s)
    radius: 0.1, // visual projectile radius (m)
    explosionRadius: 2, // splash damage falloff radius (m)
    ammoCost: 8, // ammo consumed per plasma shot
    heatMultiplier: 6, // heat generated = normal per-shot heat × this
    cooldownMultiplier: 2, // overheat cooldown duration × this
    splashFalloff: 0.5, // max splash damage = direct damage × this
    maxChargeHold: 1000, // ms at full charge before auto-fire
    gravity: 5, // downward acceleration on dump-fired plasmas (m/s²)
    fuse: 6000, // ms before an unfired plasma self-detonates
    bounceDamping: 0.6, // fraction of velocity retained after each bounce (gravity plasmas)
  },
  SPREAD: {
    perShot: 0.004, // bloom added per shot (radians)
    max: 0.06, // maximum bloom (radians)
    decay: 0.12, // bloom recovery while idle (radians/s)
    moveRate: 0.08, // bloom added while moving (radians/s)
  },
  HEAT: {
    perShot: 3, // heat added per laser shot
    max: 100, // overheat threshold; exceeding this locks the weapon
    critical: 0.75, // fraction of max that triggers the heat warning
    decay: 40, // heat dissipated per second while cooling
    cooldownDelay: 1000, // ms after last shot before heat begins decaying
  },
  MULTISHOT: {
    chance: 0.1, // base probability to fire 3 shots instead of 1
    angle: 0.1, // spread angle of extra shots (radians)
  },
  RICOCHET: {
    chance: 0.1, // base probability for a laser to ricochet on impact
    spread: 0.05, // random deviation added to reflected direction (radians)
    maxDepth: 10, // max number of ricochet bounces per shot
  },
  LIGHTNING: {
    chance: 0.05, // base probability per hit to trigger a lightning chain
    damage: 300, // damage dealt per lightning bolt
    chainRange: 5, // max distance to arc to the next enemy (m)
    maxChains: 3, // max number of chain jumps per trigger
  },
  IGNITE: {
    chance: 0.1, // base probability to ignite target on any damage
    damagePerSec: 8, // fire DOT damage per second
    spreadRange: 2, // max distance fire can spread to nearby enemies (m)
    spreadTickMs: 500, // ms between fire-spread checks per burning enemy
    ticksPerSec: 2, // fire damage ticks per second
  },
  MELEE: {
    damage: 20, // base pistol whip damage
    range: 2, // raycast distance (m)
    cooldownMs: 500, // minimum time between melee swings (ms)
    animDurationMs: 250, // pistol whip animation duration (ms)
  },
} as const;

// ─── Rifle ──────────────────────────────────────────────────────────────────
export const RIFLE = {
  damage: 75, // base damage per bullet
  rateOfFire: 800, // rounds per minute (unscoped full-auto)
  magSize: 500, // rounds per magazine
  reserveMags: 5, // starting reserve magazines
  maxReserveMags: 7, // cap on reserve mags from supply pickups
  reloadTime: 2200, // reload duration (ms)
  bulletSpeed: 400, // muzzle velocity (m/s)
  gravity: 0, // bullet drop acceleration (m/s²)
  tracerLifeMs: 1800, // how long tracer lines persist (ms)
  tracerLength: 0.42, // visual tracer length (m)
  tracerWidth: 0.026, // visual tracer thickness (m)
  SPREAD: {
    base: 0.024, // minimum bloom even on first shot (radians)
    perShot: 0.007, // bloom added per shot (radians)
    max: 0, // maximum bloom cap (radians)
    decay: 0.12, // bloom recovery while idle (radians/s)
    moveRate: 0.11, // bloom added while moving (radians/s)
  },
  LASER_SIGHT: {
    spreadScale: 0.35, // multiplier on unscoped spread when laser sight is active (lower = tighter)
    dotSize: 0.045, // world-space diameter of the laser dot decal (m)
    screenDiameterPx: 14, // screen-space dot diameter for projection (px)
    surfaceOffset: 0.02, // offset along surface normal to prevent z-fighting (m)
    embedOffsetUp: 0.03, // vertical offset of laser dot during bayonet embed (m)
    embedOffsetLeft: 0.03, // horizontal offset of laser dot during bayonet embed (m)
  },
  RECOIL: {
    //pitch: 0.05, // upward camera kick per shot (radians)
    pitch: 0,
    recover: 5, // camera pitch recovery speed (radians/s)
    maxPitch: 0.8, // max cumulative camera pitch from recoil (radians)
    cameraRatio: 0.53, // fraction of weapon recoil applied to camera (rest is weapon-only)
    scopedScale: 2, // multiplier on recoil while scoped (camera-only kick)
    weaponRoll: 0.06, // sideways weapon twist per shot (radians)
    decayHoldMs: 100, // ms after last shot before bloom begins decaying
    settleScale: 0.1, // damping applied when recoil exceeds maxPitch
    settleMax: 0.03, // max residual sway after settling (radians)
  },
  MUZZLE_BRAKE: {
    recoilScale: 0.25, // recoil multiplier with muzzle brake equipped (lower = less kick)
    flashScale: 0.25, // muzzle flash size multiplier with brake equipped
  },
  SCOPE: {
    rateOfFire: 400, // scoped fire rate (RPM); halved from unscoped for precision
    zoom: 4, // FOV divisor while scoped (4× magnification)
    sensitivityScale: 0.45, // mouse sensitivity multiplier while scoped
    zoomRate: 8, // FOV lerp speed when entering/exiting scope (units/s)
    weaponAimRate: 12, // weapon model lerp speed toward aim position (units/s)
    overlayFill: "rgba(8, 8, 10, 0.86)", // scope vignette overlay color
    pictureRadiusScale: 0.36, // scope clear-circle radius as fraction of screen height
    recoilExitPitch: 0.35, // cumulative recoil pitch that kicks player out of scope (radians)
    recoilReenterPitch: 0.16, // recoil must recover below this to re-enter scope (radians)
    aimRootX: 0, // weapon X offset when fully scoped
    aimRootY: -0.1375, // weapon Y offset when fully scoped (lower = more centered)
    aimRootZ: 0.5, // weapon Z offset when fully scoped (forward toward camera)
    inwardPullStart: 0.72, // aim progress (0–1) at which weapon begins pulling inward
    inwardRootZ: 0.34, // final Z position during the inward-pull phase
    zoomRootZ: -0.5, // camera Z shift during zoom (negative = pull back)
  },
  MUZZLE_FLASH: {
    baseScale: 1.5, // initial muzzle flash sprite scale
    expandScale: 2.5, // flash growth rate over its lifetime
    scopedCameraOffsetY: -0.18, // Y offset for flash position when scoped
    scopedCameraOffsetZ: 0.8, // Z offset for flash position when scoped
  },
  MELEE: {
    damage: 2, // base rifle butt strike damage
    range: 2.2, // melee raycast distance (m)
    cooldownMs: 600, // minimum time between melee attacks (ms)
    animDurationMs: 320, // butt stroke animation duration (ms)
    thrustDistance: 0.34, // forward weapon extension during thrust (m)
  },
  BAYONET: {
    damageMultiplier: 4, // bayonet melee damage = rifle melee × this
    range: 3.0, // bayonet melee raycast distance (m)
    chargeDamageMultiplier: 3, // charge attack damage = bayonet melee × this
    chargeCooldownMultiplier: 4, // charge cooldown = melee cooldown × this
    chargeAnimInMs: 140, // time to lower weapon into charge stance (ms)
    chargeAnimOutMs: 180, // time to return weapon from charge stance (ms)
    chargeCenteredY: -0.2, // weapon Y offset during charge hold
    chargeForwardZ: 0.72, // weapon Z offset during charge hold (forward)
    chargePitch: -0.3, // camera pitch tilt during charge (radians; negative = look down)
    embedGroundKnockbackDistance: 1.6, // player pushed back this far if bayonet hits ground (m)
    embedPlayerStandoff: 0.6, // player–enemy distance when embedded from the side (m)
    embedPlayerBackStandoff: 0.95, // player–enemy distance when embedded from behind (m)
    embedPlayerFrontStandoff: 0.85, // player–enemy distance when embedded from front (m)
    embedCameraMinPitch: -0.9, // lowest camera pitch allowed during embed (radians)
    embedCameraMaxPitch: 1.05, // highest camera pitch allowed during embed (radians)
    embedSideHitDotThreshold: 0.25, // dot product below this rejects side-angle hits
    embedAnimMs: 420, // embed entry/extraction animation duration (ms)
    embedMoveRate: 14, // weapon lerp speed during embed animation (units/s)
  },
  RELOAD_ANIM: {
    tilt: -0.5, // weapon tilt during reload (radians; negative = roll left)
    yaw: 0.18, // weapon yaw during reload (radians)
    magDrop: 0.2, // how far the magazine drops visually during reload (m)
    magPullBack: 0.08, // how far the magazine pulls back before dropping (m)
  },
} as const;

// ─── Scoring ────────────────────────────────────────────────────────────────
export const SCORING = {
  kill: 100, // points awarded per enemy kill
  waveComplete: 250, // bonus points when a wave is cleared
} as const;

// ─── Supplies ───────────────────────────────────────────────────────────────
export const SUPPLY = {
  scoreInterval: 500, // every N points scored, roll for a supply drop
  dropRate: 0.25, // base probability of a drop when threshold is reached
  healthAmount: 25, // health restored per supply pickup
  collectRange: 1.5, // pickup radius around the supply crate (m)
} as const;

// ─── Waves ──────────────────────────────────────────────────────────────────
export const WAVE = {
  baseEnemies: 5, // enemies in wave 1
  growth: 3, // additional enemies per wave after wave 1
  spawnIntervalMs: 1500, // ms between individual enemy spawns within a wave
  pauseMs: 5000, // downtime between waves (ms)
  maxAlive: 10, // max enemies alive at once; spawning pauses until below this
} as const;

// ─── Critical Hits ─────────────────────────────────────────────────────────
export const CRIT = {
  chance: 0.05, // base crit probability per hit
  damage: 2, // base crit damage multiplier
} as const;

// ─── Upgrades — Amount Gained Per Upgrade ───────────────────────────────────
export const UPGRADE = {
  maxHealth: 25, // + HP per upgrade
  speed: 0.5, // + m/s walk speed per upgrade
  reloadSpeed: 0.25, // fraction faster per upgrade (exponential decay: 1 / (1 + n × this))
  magSize: 16, // + rounds per magazine per upgrade
  rateOfFire: 0.25, // + fraction of base RPM per upgrade
  heatCapacity: 0.5, // + fraction of base heat cap per upgrade
  heatDecay: 0.5, // + fraction of base heat decay per upgrade
  bloomReduction: 0.25, // fraction less bloom per shot per upgrade
  moveSpreadReduction: 0.25, // fraction less movement spread per upgrade
  laserDamage: 5, // + flat laser damage per upgrade
  plasmaDamage: 10, // + flat plasma damage per upgrade
  plasmaVelocity: 0.25, // + fraction of base plasma speed per upgrade
  supplyDropRate: 0.05, // + absolute drop chance per upgrade
  critChance: 0.03, // + crit probability per upgrade
  critDamage: 0.25, // + crit multiplier per upgrade (+0.25× each)
  plasmaSelfDamageReduction: 0.5, // fraction less self-damage per upgrade (exponential decay)
  multishotChance: 0.05, // + multishot probability per upgrade
  ricochetChance: 0.04, // + ricochet probability per upgrade
  lightningChance: 0.03, // + lightning proc probability per upgrade
  igniteChance: 0.05, // + ignite proc probability per upgrade
} as const;

// ─── Audio ──────────────────────────────────────────────────────────────────
export const AUDIO = {
  masterVolumeMult: 4, // global volume scalar applied to all synthesized sounds
} as const;

// ─── Bullet Holes ───────────────────────────────────────────────────────────
export const BULLET_HOLE = {
  glowMs: 1500, // ms the impact glow persists before fading to dark
  darkR: 0.02, // faded bullet hole color — red
  darkG: 0.02, // faded bullet hole color — green
  darkB: 0.02, // faded bullet hole color — blue
} as const;
