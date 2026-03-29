// ─── Arena ───────────────────────────────────────────────────────────────────
export const ARENA_SIZE = 50; // square arena side length (m)
export const ARENA_CEIL = 8; // ceiling height (m)

// ─── Lighting & Fog ─────────────────────────────────────────────────────────
export const AMBIENT_INTENSITY = 0.1;
export const AMBIENT_GROUND_R = 0.03;
export const AMBIENT_GROUND_G = 0.03;
export const AMBIENT_GROUND_B = 0.05;
export const SPOT_ANGLE = Math.PI * 0.8; // radians
export const SPOT_EXPONENT = 1.5;
export const SPOT_INTENSITY = 3.0;
export const SPOT_RANGE = 55; // m
export const FOG_DENSITY = 0.03;

// ─── Enemy — Base Stats ─────────────────────────────────────────────────────
export const ENEMY_HP = 50;
export const ENEMY_SPEED = 2; // m/s
export const ENEMY_MELEE_RANGE = 1.8; // m
export const ENEMY_MELEE_DAMAGE = 10;
export const ENEMY_MELEE_ATTACKS_PER_MIN = 50;
export const ENEMY_CHASE_RANGE = 25; // m
export const ENEMY_MIN_SPAWN_DIST = 10; // min distance from player when spawning (m)

// ─── Enemy — Per-Wave Scaling ───────────────────────────────────────────────
export const ENEMY_HP_PER_WAVE = 10;
export const ENEMY_SPEED_PER_WAVE = 0.2; // m/s per wave after wave 1
export const ENEMY_MELEE_DAMAGE_PER_WAVE = 2.4;
export const ENEMY_MELEE_ATTACKS_PER_MIN_PER_WAVE = 3;

// ─── Enemy — Movement ───────────────────────────────────────────────────────
export const ENEMY_TURN_SPEED = 3; // radians per second
export const ENEMY_ZIGZAG_FREQ = 0.5; // full zigzag cycles per second
export const ENEMY_ZIGZAG_AMPLITUDE = 0.8; // lateral offset strength (0-1)

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
export const PLAYER_MAG_SIZE = 48; // rounds per magazine
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

// ─── Supplies ───────────────────────────────────────────────────────────────
export const SUPPLY_SCORE_INTERVAL = 500; // score interval between supply drop chances
export const SUPPLY_DROP_RATE = 0.25;
export const SUPPLY_HEALTH_AMOUNT = 25;
export const SUPPLY_COLLECT_RANGE = 1.5; // m

// ─── Waves ──────────────────────────────────────────────────────────────────
export const WAVE_BASE_ENEMIES = 5;
export const WAVE_GROWTH = 3; // extra enemies per wave
export const WAVE_SPAWN_INTERVAL_MS = 1500; // ms between enemy spawns
export const WAVE_PAUSE_MS = 10000; // ms pause between waves
export const MAX_ENEMIES_ALIVE = 10;

// ─── Player — Orb (Alt-Fire) ────────────────────────────────────────────────
export const PLAYER_ORB_DAMAGE = 50;
export const PLAYER_ORB_SPEED = 30; // m/s
export const PLAYER_ORB_RADIUS = 0.1; // visual radius (m)
export const PLAYER_ORB_EXPLOSION_RADIUS = 2; // m — splash damage range
export const PLAYER_ORB_AMMO_COST = 8;
export const PLAYER_ORB_HEAT_MULTIPLIER = 6; // heat per shot multiplied by this
export const PLAYER_ORB_COOLDOWN_MULTIPLIER = 4; // cooldown multiplied by this
export const PLAYER_ORB_SPLASH_FALLOFF = 0.5; // max splash damage = direct * this
export const PLAYER_ORB_MAX_CHARGE_HOLD = 1000; // ms to hold at max charge before auto-fire
export const PLAYER_ORB_GRAVITY = 5; // m/s² gravity for dump-fired orbs

// ─── Upgrades — Amount Gained Per Upgrade ───────────────────────────────────
export const UPGRADE_MAX_HEALTH = 25;
export const UPGRADE_SPEED = 0.5; // m/s
export const UPGRADE_RELOAD_SPEED = 0.25; // % faster per upgrade (exponential decay)
export const UPGRADE_MAG_SIZE = 24; // rounds
export const UPGRADE_RATE_OF_FIRE = 0.25; // + % of base RPM per upgrade
export const UPGRADE_HEAT_CAPACITY = 0.5; // + % of base heat cap per upgrade
export const UPGRADE_HEAT_DECAY = 0.5; // + % of base heat decay per upgrade
export const UPGRADE_BLOOM_REDUCTION = 0.25; // % less bloom per shot per upgrade
export const UPGRADE_MOVE_SPREAD_REDUCTION = 0.25; // % less spread from movement per upgrade
export const UPGRADE_BEAM_DAMAGE = 5;
export const UPGRADE_ORB_DAMAGE = 10;
export const UPGRADE_SUPPLY_DROP_RATE = 0.05; // + % absolute drop chance per upgrade

// ─── Critical Hits ─────────────────────────────────────────────────────────
export const PLAYER_CRIT_CHANCE = 0.06; // % base crit chance
export const PLAYER_CRIT_DAMAGE = 2; // x base crit damage multiplier
export const UPGRADE_CRIT_CHANCE = 0.03; // + % per upgrade
export const UPGRADE_CRIT_DAMAGE = 0.25; // +0.25x per upgrade
export const UPGRADE_ORB_SELF_DAMAGE_REDUCTION = 0.5; // % less self-damage per upgrade (exponential)
