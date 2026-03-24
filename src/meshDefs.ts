import { Color3, Vector3 } from "@babylonjs/core";
import { ARENA_SIZE, ARENA_CEIL } from "./constants.js";

// ─── Player ───────────────────────────────────────────────────────────────────
export const PLAYER_MESH = {
  capsule: { height: 1.8, radius: 0.4 },
};

// ─── Arena ────────────────────────────────────────────────────────────────────
export const ARENA = {
  room: ARENA_SIZE,
  ceil: ARENA_CEIL,

  floor: {
    size: { height: 0.2 } as const, // width/depth = room
    diffuse: new Color3(0.25, 0.22, 0.18),
    specular: new Color3(0.05, 0.05, 0.05),
  },

  ceiling: {
    size: { height: 0.2 } as const,
    diffuse: new Color3(0.12, 0.12, 0.15),
  },

  wall: {
    thickness: 0.3,
    diffuse: new Color3(0.3, 0.28, 0.24),
    specular: new Color3(0.02, 0.02, 0.02),
  },

  pillar: {
    size: { width: 1.2, depth: 1.2 } as const, // height = ceil
    positions: [[-8, -8], [-8, 8], [8, -8], [8, 8]] as [number, number][],
  },

  crate: {
    size: 1,
    diffuse: new Color3(0.45, 0.32, 0.18),
    // [x, y, z] — y is center of cube
    positions: [
      [3, 0.5, 5],
      [-5, 0.5, 3],
      [6, 0.5, -4],
      [-3, 0.5, -6],
      [3, 1.5, 5],
    ] as [number, number, number][],
  },

  accentStrip: {
    height: 0.15,
    depth: 0.05,
    yPos: 0.5,
    wallInset: 0.2, // distance from wall surface
    diffuse: new Color3(0.6, 0.3, 0.05),
    emissive: new Color3(0.3, 0.15, 0.02),
  },
};

// ─── Weapon ───────────────────────────────────────────────────────────────────
export const WEAPON = {
  rootPos: new Vector3(0.22, -0.2, 0.5),

  body: {
    size: { width: 0.07, height: 0.08, depth: 0.3 } as const,
    pos: new Vector3(0, 0, 0.02),
    diffuse: new Color3(0.07, 0.08, 0.16),
    specular: new Color3(0.3, 0.3, 0.6),
    emissive: new Color3(0.01, 0.01, 0.04),
  },

  barrel: {
    size: { diameter: 0.024, height: 0.32, tessellation: 10 } as const,
    pos: new Vector3(0, 0.016, 0.27),
    rotX: Math.PI / 2,
    diffuse: new Color3(0.18, 0.18, 0.24),
    specular: new Color3(0.9, 0.9, 1.0),
  },

  cell: {
    size: { width: 0.05, height: 0.1, depth: 0.12 } as const,
    pos: new Vector3(0, 0.09, -0.04),
    diffuse: new Color3(0.04, 0.25, 0.36),
    emissive: new Color3(0.0, 0.12, 0.2),
  },

  grip: {
    size: { width: 0.06, height: 0.12, depth: 0.07 } as const,
    pos: new Vector3(0, -0.095, -0.06),
    diffuse: new Color3(0.1, 0.09, 0.09),
  },

  accent: {
    size: { width: 0.009, height: 0.009, depth: 0.24 } as const,
    pos: new Vector3(0, 0.044, 0.04),
    diffuse: new Color3(0.0, 0.5, 0.9),
    emissive: new Color3(0.0, 0.3, 0.7),
  },

  lens: {
    size: { diameter: 0.034, segments: 6 } as const,
    pos: new Vector3(0, 0.016, 0.435),
    diffuse: new Color3(0.0, 0.9, 1.0),
    emissive: new Color3(0.0, 0.8, 1.0),
  },

  barrelTipPos: new Vector3(0, 0.016, 0.46),
};

// ─── Enemy ────────────────────────────────────────────────────────────────────
export const ENEMY_COLOR = new Color3(0.45, 0.45, 0.45);

export const ENEMY_MESH = {
  capsule: { height: 1.6, radius: 0.4 } as const,
  body: { width: 0.8, height: 1.6, depth: 0.8 } as const,
  head: { diameter: 0.55 } as const,
  headOffset: new Vector3(0, 1.05, 0),
};

// ─── Laser Beam ───────────────────────────────────────────────────────────────
export const LASER_BEAM = {
  radius: 0.014,
  tessellation: 6,
  diffuse: new Color3(0, 1, 1),
  emissive: new Color3(0, 0.9, 1),
};

// ─── Bullet Hole ──────────────────────────────────────────────────────────────
export const BULLET_HOLE = {
  radius: 0.08,
  tessellation: 8,
  surfaceOffset: 0.01,
  diffuse: new Color3(0.05, 0.05, 0.05),
  emissive: new Color3(0.02, 0.02, 0.02),
};
