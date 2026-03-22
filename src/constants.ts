// ─── Enemy ────────────────────────────────────────────────────────────────────
export const ENEMY_HP    = 50;
export const ENEMY_SPEED = 3;  // m/s

export const ENEMY_MELEE_RANGE       = 1.8;
export const ENEMY_MELEE_DAMAGE      = 10;
export const ENEMY_MELEE_COOLDOWN_MS = 1200;
export const ENEMY_CHASE_RANGE       = 20;

export const ENEMY_SHOT_DAMAGE_MIN      = 25;
export const ENEMY_SHOT_DAMAGE_VARIANCE = 15;

// ─── Player ───────────────────────────────────────────────────────────────────
export const PLAYER_WALK_SPEED   = 5;    // m/s
export const PLAYER_SPRINT_SPEED = 10;   // m/s
export const PLAYER_ACCELERATION = 0.15; // lerp factor per frame (0 = sluggish, 1 = instant)
