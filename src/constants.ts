// ─── Enemy ────────────────────────────────────────────────────────────────────
export const ENEMY_HP = 100;
export const ENEMY_SPEED = 3; // m/s

export const ENEMY_MELEE_RANGE = 1.8;
export const ENEMY_MELEE_DAMAGE = 10;
export const ENEMY_MELEE_COOLDOWN_MS = 1200;
export const ENEMY_CHASE_RANGE = 20;


// ─── Player ───────────────────────────────────────────────────────────────────
export const PLAYER_WALK_SPEED = 5; // m/s
export const PLAYER_SPRINT_SPEED = 10; // m/s
export const PLAYER_ACCELERATION = 0.15; // lerp factor per frame (0 = sluggish, 1 = instant)
export const PLAYER_JUMP_SPEED = 13; // m/s upward — with gravity -20 this reaches ~4.2 m
export const PLAYER_MAG_SIZE = 100; // ammo per reload
export const PLAYER_RESERVE_AMMO = 400; // starting reserve
export const PLAYER_RELOAD_TIME = 1800; // ms
export const PLAYER_SHOOT_COOLDOWN_MS = 65; // ms between continuous beam pulses (~15/sec)
export const PLAYER_BEAM_DAMAGE_MIN = 25;
export const PLAYER_BEAM_DAMAGE_VARIANCE = 15;
