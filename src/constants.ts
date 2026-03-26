// ─── Arena ───────────────────────────────────────────────────────────────────
export const ARENA_SIZE = 30; // square arena side length (m)
export const ARENA_CEIL = 5; // ceiling height (m)

// ─── Enemy — Base Stats ─────────────────────────────────────────────────────
export const ENEMY_HP = 100;
export const ENEMY_SPEED = 3; // m/s
export const ENEMY_MELEE_RANGE = 1.8; // m
export const ENEMY_MELEE_DAMAGE = 10;
export const ENEMY_MELEE_ATTACKS_PER_MIN = 50;
export const ENEMY_CHASE_RANGE = 20; // m
export const ENEMY_MIN_SPAWN_DIST = 8; // min distance from player when spawning (m)

// ─── Enemy — Per-Wave Scaling ───────────────────────────────────────────────
export const ENEMY_HP_PER_WAVE = 15;
export const ENEMY_SPEED_PER_WAVE = 0.2; // m/s per wave after wave 1
export const ENEMY_MELEE_DAMAGE_PER_WAVE = 2;
export const ENEMY_MELEE_ATTACKS_PER_MIN_PER_WAVE = 3;

// ─── Enemy — Movement ───────────────────────────────────────────────────────
export const ENEMY_ZIGZAG_FREQ = 1.8; // full zigzag cycles per second
export const ENEMY_ZIGZAG_AMPLITUDE = 0.6; // lateral offset strength (0-1)

// ─── Player — Health & Movement ─────────────────────────────────────────────
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_SPAWN_Y = 0.9;
export const PLAYER_SPEED = 5; // m/s
export const PLAYER_SPRINT_MULTIPLIER = 2;
export const PLAYER_ACCELERATION = 0.15; // lerp factor per frame (0 = sluggish, 1 = instant)
export const PLAYER_JUMP_SPEED = 13; // m/s upward — with gravity -20 this reaches ~4.2 m

// ─── Player — Weapon ────────────────────────────────────────────────────────
export const PLAYER_BEAM_DAMAGE = 25;
export const PLAYER_RATE_OF_FIRE = 600; // rounds per minute
export const PLAYER_MAG_SIZE = 50; // rounds per magazine
export const PLAYER_RESERVE_MAGS = 4; // starting reserve magazines
export const PLAYER_MAX_RESERVE_MAGS = 5;
export const PLAYER_RELOAD_TIME = 3000; // ms

// ─── Player — Spread ────────────────────────────────────────────────────────
export const PLAYER_SPREAD_PER_SHOT = 0.004; // radians added per shot
export const PLAYER_MAX_SPREAD = 0.06; // radians max
export const PLAYER_SPREAD_DECAY = 0.12; // radians per second of recovery
export const PLAYER_MOVE_SPREAD_RATE = 0.08; // radians per second while moving

// ─── Player — Heat ──────────────────────────────────────────────────────────
export const PLAYER_HEAT_PER_SHOT = 3;
export const PLAYER_HEAT_MAX = 100; // overheat threshold
export const PLAYER_HEAT_CRITICAL = 0.75; // fraction of max for critical threshold
export const PLAYER_HEAT_DECAY = 40; // heat lost per second while cooling
export const PLAYER_HEAT_COOLDOWN_DELAY = 1000; // ms of not firing before heat decays

// ─── Scoring ────────────────────────────────────────────────────────────────
export const KILL_SCORE = 100;
export const WAVE_COMPLETE_SCORE = 250;

// ─── Pickups ────────────────────────────────────────────────────────────────
export const PICKUP_SCORE_INTERVAL = 500; // score interval between pickup drop chances
export const PICKUP_DROP_CHANCE = 0.5;
export const PICKUP_HEALTH_AMOUNT = 25;
export const PICKUP_COLLECT_RANGE = 1.5; // m

// ─── Waves ──────────────────────────────────────────────────────────────────
export const WAVE_BASE_ENEMIES = 5;
export const WAVE_GROWTH = 3; // extra enemies per wave
export const WAVE_SPAWN_INTERVAL_MS = 1500; // ms between enemy spawns
export const WAVE_PAUSE_MS = 10000; // ms pause between waves
export const MAX_ENEMIES_ALIVE = 10;

// ─── Upgrades — Amount Gained Per Upgrade ───────────────────────────────────
export const UPGRADE_MAX_HEALTH = 25;
export const UPGRADE_SPEED = 0.5; // m/s
export const UPGRADE_RELOAD_SPEED = 0.15; // 15% faster per upgrade (exponential decay)
export const UPGRADE_MAG_SIZE = 10; // rounds
export const UPGRADE_RATE_OF_FIRE = 60; // RPM
export const UPGRADE_HEAT_CAPACITY = 15;
export const UPGRADE_HEAT_DECAY = 10; // heat/s
export const UPGRADE_SPREAD_REDUCTION = 0.15; // 15% less spread per shot
export const UPGRADE_DAMAGE = 5;
