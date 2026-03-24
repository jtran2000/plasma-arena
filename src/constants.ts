// ─── Enemy ────────────────────────────────────────────────────────────────────
export const ENEMY_HP = 100;
export const ENEMY_SPEED = 3; // m/s

export const ENEMY_MELEE_RANGE = 1.8;
export const ENEMY_MELEE_DAMAGE = 10;
export const ENEMY_MELEE_COOLDOWN_MS = 1200;
export const ENEMY_CHASE_RANGE = 20;

// ─── Player ───────────────────────────────────────────────────────────────────
export const PLAYER_SPAWN_Y = 0.9;
export const PLAYER_WALK_SPEED = 5; // m/s
export const PLAYER_SPRINT_SPEED = 10; // m/s
export const PLAYER_ACCELERATION = 0.15; // lerp factor per frame (0 = sluggish, 1 = instant)
export const PLAYER_JUMP_SPEED = 13; // m/s upward — with gravity -20 this reaches ~4.2 m
export const PLAYER_MAG_SIZE = 100; // ammo per reload
export const PLAYER_RESERVE_MAGS = 4; // starting reserve magazines
export const PLAYER_MAX_RESERVE_MAGS = 5;
export const PLAYER_RELOAD_TIME = 1800; // ms
export const PLAYER_SHOOT_COOLDOWN_MS = 65; // ms between continuous beam pulses (~15/sec)
export const PLAYER_BEAM_DAMAGE = 25;
export const KILL_SCORE = 100;
export const PICKUP_SCORE_INTERVAL = 500;
export const PICKUP_DROP_CHANCE = 0.5;
export const PICKUP_HEALTH_AMOUNT = 25;
export const PICKUP_COLLECT_RANGE = 1.5;
export const WAVE_BASE_ENEMIES = 5;
export const WAVE_GROWTH = 3;
export const WAVE_SPAWN_INTERVAL_MS = 1500;
export const WAVE_PAUSE_MS = 4000;
export const MAX_ENEMIES_ALIVE = 10;
export const ARENA_SIZE = 30;
export const ARENA_CEIL = 5;
export const ENEMY_MIN_SPAWN_DIST = 8;
export const WAVE_COMPLETE_SCORE = 250;
