import {
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Mesh,
  Color3,
  Color4,
  PhysicsAggregate,
  PhysicsShapeType,
  Quaternion,
  ParticleSystem,
  PointLight,
} from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Control,
} from "@babylonjs/gui";
import {
  ARENA,
  LIGHTING,
  PLAYER,
  BLASTER,
  SCORING,
  ENEMY,
  BULLET_HOLE,
  ENEMY_HEALTH_BAR,
  RIFLE,
} from "./constants.js";
const { PLASMA, HEAT } = BLASTER;
import { g, type Enemy } from "./game.js";
import {
  playEnemySpawnSound,
  playEnemyDeathSound,
  playLaserSound,
  startFireSound,
  stopFireSound,
} from "./audio.js";
import {
  effectiveCooldown,
  effectiveHeatMax,
  incrementScore,
} from "./progression.js";

// ─── Mesh definitions ────────────────────────────────────────────────────────

// Player
const PLAYER_MESH = {
  capsule: { height: 1.8, radius: 0.4 },
};

// Arena
const ARENA_STYLE = {
  room: ARENA.size,
  ceil: ARENA.ceil,

  floor: {
    size: { height: 0.2 } as const,
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
    size: { width: 1.4, depth: 1.4 } as const,
    positions: [
      [-10, -10],
      [-10, 10],
      [10, -10],
      [10, 10],
      [-20, 0],
      [20, 0],
      [0, -20],
      [0, 20],
      [-18, -18],
      [-18, 18],
      [18, -18],
      [18, 18],
    ] as [number, number][],
  },

  crate: {
    size: 1,
    diffuse: new Color3(0.45, 0.32, 0.18),
    positions: [
      [5, 0.5, 8],
      [-7, 0.5, 5],
      [10, 0.5, -6],
      [-5, 0.5, -10],
      [5, 1.5, 8],
      [-14, 0.5, 12],
      [15, 0.5, -3],
      [-3, 0.5, -16],
      [12, 0.5, 14],
      [-16, 0.5, -8],
      [8, 0.5, -15],
      [-12, 0.5, -14],
      [18, 0.5, 10],
      [-8, 0.5, 18],
      [0, 0.5, -12],
      [14, 0.5, 5],
      [-16, 0.5, -8],
      [-16, 1.5, -8],
      [12, 0.5, 14],
      [12, 1.5, 14],
    ] as [number, number, number][],
  },

  accentStrip: {
    height: 0.15,
    depth: 0.05,
    yPos: 0.5,
    wallInset: 0.2,
    diffuse: new Color3(0.6, 0.3, 0.05),
    emissive: new Color3(0.3, 0.15, 0.02),
  },
};

// Weapon
const WEAPON = {
  rootPos: new Vector3(0.22, -0.2, 0.5),

  body: {
    size: { width: 0.07, height: 0.08, depth: 0.3 } as const,
    pos: new Vector3(0, 0, 0.02),
    diffuse: new Color3(0.07, 0.08, 0.16),
    specular: new Color3(0.3, 0.3, 0.6),
    emissive: new Color3(0.01, 0.01, 0.04),
  },

  barrel: {
    size: { diameter: 0.024, height: 0.44, tessellation: 10 } as const,
    pos: new Vector3(0, 0.016, 0.33),
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
    pos: new Vector3(0, 0.016, 0.555),
    diffuse: new Color3(0.0, 0.9, 1.0),
    emissive: new Color3(0.0, 0.8, 1.0),
  },

  barrelTipPos: new Vector3(0, 0.016, 0.58),
};

const RIFLE_WEAPON = {
  rootPos: new Vector3(0.24, -0.22, 0.58),
  body: {
    size: { width: 0.09, height: 0.09, depth: 0.58 } as const,
    pos: new Vector3(0, 0, 0.08),
    diffuse: new Color3(0.12, 0.13, 0.16),
    specular: new Color3(0.25, 0.25, 0.3),
    emissive: new Color3(0.02, 0.02, 0.03),
  },
  barrel: {
    size: { width: 0.03, height: 0.03, depth: 0.52 } as const,
    pos: new Vector3(0, 0.015, 0.48),
    diffuse: new Color3(0.18, 0.18, 0.2),
    emissive: new Color3(0.04, 0.03, 0.02),
  },
  stock: {
    size: { width: 0.07, height: 0.07, depth: 0.22 } as const,
    pos: new Vector3(0, -0.01, -0.18),
    diffuse: new Color3(0.3, 0.18, 0.08),
  },
  grip: {
    size: { width: 0.05, height: 0.16, depth: 0.05 } as const,
    pos: new Vector3(0, -0.12, 0.03),
    diffuse: new Color3(0.08, 0.08, 0.09),
  },
  mag: {
    size: { width: 0.045, height: 0.18, depth: 0.09 } as const,
    pos: new Vector3(0, -0.11, 0.13),
    diffuse: new Color3(0.72, 0.32, 0.06),
    emissive: new Color3(0.26, 0.08, 0.01),
  },
  brake: {
    size: { width: 0.05, height: 0.05, depth: 0.08 } as const,
    pos: new Vector3(0, 0.015, 0.81),
    diffuse: new Color3(0.16, 0.16, 0.18),
    emissive: new Color3(0.04, 0.04, 0.05),
  },
  barrelTipPos: new Vector3(0, 0.015, 0.77),
};

// Enemy
const ENEMY_COLOR = new Color3(0.45, 0.45, 0.45);

const ENEMY_MESH = {
  capsule: { height: 2.5, radius: 0.6 } as const,
  body: { width: 0.65, height: 1.1, depth: 0.3 } as const,
  bodyOffset: new Vector3(0, 0.15, 0),
  head: { height: 0.47, radius: 0.15 } as const,
  headOffset: new Vector3(0, 0.8, 0),
  leg: { width: 0.2, height: 0.9, depth: 0.2 } as const,
  legOffsetY: -0.4, // top of leg (pivot) relative to capsule center
  legSpacing: 0.225, // lateral offset from center (leg edges align with body edges)
  arm: { width: 0.15, height: 0.7, depth: 0.15 } as const,
  armOffsetY: 0.65, // shoulder height (body top is ~0.7)
  armSpacing: 0.4, // just touching body edge (body half-width 0.325 + arm half-width 0.075)
};

// Laser beam
const LASER_BEAM = {
  radius: 0.014,
  tessellation: 6,
  diffuse: new Color3(0, 1, 1),
  emissive: new Color3(0, 0.9, 1),
};

// Bullet hole
const BULLET_HOLE_STYLE = {
  radius: 0.08,
  tessellation: 8,
  surfaceOffset: 0.01,
  diffuse: new Color3(0.05, 0.05, 0.05),
  emissive: new Color3(0.02, 0.02, 0.02),
};

// ─── Arena materials (private) ────────────────────────────────────────────────
function makeFloorMat(): StandardMaterial {
  const mat = new StandardMaterial("floor", g.scene);
  mat.diffuseColor = ARENA_STYLE.floor.diffuse;
  mat.specularColor = ARENA_STYLE.floor.specular;
  return mat;
}

function makeWallMat(): StandardMaterial {
  const mat = new StandardMaterial("wall", g.scene);
  mat.diffuseColor = ARENA_STYLE.wall.diffuse;
  mat.specularColor = ARENA_STYLE.wall.specular;
  return mat;
}

function makeCeilMat(): StandardMaterial {
  const mat = new StandardMaterial("ceil", g.scene);
  mat.diffuseColor = ARENA_STYLE.ceiling.diffuse;
  return mat;
}

function makeAccentMat(): StandardMaterial {
  const mat = new StandardMaterial("accent", g.scene);
  mat.diffuseColor = ARENA_STYLE.accentStrip.diffuse;
  mat.emissiveColor = ARENA_STYLE.accentStrip.emissive;
  return mat;
}

function makeCrateMat(): StandardMaterial {
  const mat = new StandardMaterial("crate", g.scene);
  mat.diffuseColor = ARENA_STYLE.crate.diffuse;
  return mat;
}

// ─── Arena meshes (private) ───────────────────────────────────────────────────
function makeFloor(): Mesh {
  return MeshBuilder.CreateBox(
    "floor",
    {
      width: ARENA_STYLE.room,
      height: ARENA_STYLE.floor.size.height,
      depth: ARENA_STYLE.room,
    },
    g.scene,
  );
}

function makeCeil(): Mesh {
  return MeshBuilder.CreateBox(
    "ceil",
    {
      width: ARENA_STYLE.room,
      height: ARENA_STYLE.ceiling.size.height,
      depth: ARENA_STYLE.room,
    },
    g.scene,
  );
}

function makeWallBox(w: number, h: number): Mesh {
  return MeshBuilder.CreateBox(
    "wall",
    { width: w, height: h, depth: ARENA_STYLE.wall.thickness },
    g.scene,
  );
}

function makePillar(): Mesh {
  return MeshBuilder.CreateBox(
    "pillar",
    {
      width: ARENA_STYLE.pillar.size.width,
      height: ARENA_STYLE.ceil,
      depth: ARENA_STYLE.pillar.size.depth,
    },
    g.scene,
  );
}

function makeCrate(): Mesh {
  return MeshBuilder.CreateBox(
    "crate",
    { size: ARENA_STYLE.crate.size },
    g.scene,
  );
}

function makeAccentStrip(): Mesh {
  return MeshBuilder.CreateBox(
    "strip",
    {
      width: ARENA_STYLE.room - 1,
      height: ARENA_STYLE.accentStrip.height,
      depth: ARENA_STYLE.accentStrip.depth,
    },
    g.scene,
  );
}

// ─── Arena setup (exported) ───────────────────────────────────────────────────
export function setupArenaFloor(): Mesh {
  const m = makeFloor();
  m.position.y = -0.1;
  m.material = makeFloorMat();
  m.receiveShadows = true;
  new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  return m;
}

export function setupArenaCeil(): Mesh {
  const m = makeCeil();
  m.position.y = ARENA_STYLE.ceil + 0.1;
  m.material = makeCeilMat();
  new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  return m;
}

export function setupArenaWalls(): Mesh[] {
  const mat = makeWallMat();
  const ROOM = ARENA_STYLE.room;
  const CEIL = ARENA_STYLE.ceil;
  const half = ROOM / 2;
  return [
    [new Vector3(0, CEIL / 2, -half), 0],
    [new Vector3(0, CEIL / 2, half), 0],
    [new Vector3(-half, CEIL / 2, 0), Math.PI / 2],
    [new Vector3(half, CEIL / 2, 0), Math.PI / 2],
  ].map(([pos, rotY]) => {
    const m = makeWallBox(ROOM, CEIL);
    m.position = pos as Vector3;
    m.rotation.y = rotY as number;
    m.material = mat;
    m.receiveShadows = true;
    new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
    return m;
  });
}

export function setupArenaPillars(): Mesh[] {
  const mat = makeWallMat();
  return ARENA_STYLE.pillar.positions.map(([x, z]) => {
    const m = makePillar();
    m.position = new Vector3(x, ARENA_STYLE.ceil / 2, z);
    m.material = mat;
    m.receiveShadows = true;
    new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
    return m;
  });
}

export function setupArenaCrates(): Mesh[] {
  const mat = makeCrateMat();
  return ARENA_STYLE.crate.positions.map(([x, y, z]) => {
    const m = makeCrate();
    m.position = new Vector3(x, y, z);
    m.material = mat;
    m.receiveShadows = true;
    new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
    return m;
  });
}

export function setupArenaAccentStrips(): Mesh[] {
  const mat = makeAccentMat();
  const half = ARENA_STYLE.room / 2;
  const stripInset = half - ARENA_STYLE.accentStrip.wallInset;
  return [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot) => {
    const m = makeAccentStrip();
    m.rotation.y = rot;
    m.position = new Vector3(
      rot === 0 || rot === Math.PI ? 0 : rot > 0 ? stripInset : -stripInset,
      ARENA_STYLE.accentStrip.yPos,
      rot === 0 ? -stripInset : rot === Math.PI ? stripInset : 0,
    );
    m.material = mat;
    return m;
  });
}

// ─── Weapon materials (private) ───────────────────────────────────────────────
function makeWeaponBodyMat(): StandardMaterial {
  const mat = new StandardMaterial("wBodyMat", g.scene);
  mat.diffuseColor = WEAPON.body.diffuse;
  mat.specularColor = WEAPON.body.specular;
  mat.emissiveColor = WEAPON.body.emissive;
  return mat;
}

function makeWeaponBarrelMat(): StandardMaterial {
  const mat = new StandardMaterial("wBarrelMat", g.scene);
  mat.diffuseColor = WEAPON.barrel.diffuse;
  mat.specularColor = WEAPON.barrel.specular;
  return mat;
}

function makeWeaponCellMat(): StandardMaterial {
  const mat = new StandardMaterial("wCellMat", g.scene);
  mat.diffuseColor = WEAPON.cell.diffuse;
  mat.emissiveColor = WEAPON.cell.emissive;
  return mat;
}

function makeWeaponGripMat(): StandardMaterial {
  const mat = new StandardMaterial("wGripMat", g.scene);
  mat.diffuseColor = WEAPON.grip.diffuse;
  return mat;
}

function makeWeaponAccentMat(): StandardMaterial {
  const mat = new StandardMaterial("wAccentMat", g.scene);
  mat.diffuseColor = WEAPON.accent.diffuse;
  mat.emissiveColor = WEAPON.accent.emissive;
  return mat;
}

function makeWeaponLensMat(): StandardMaterial {
  const mat = new StandardMaterial("wLensMat", g.scene);
  mat.diffuseColor = WEAPON.lens.diffuse;
  mat.emissiveColor = WEAPON.lens.emissive;
  return mat;
}

// ─── Weapon meshes (private) ──────────────────────────────────────────────────
function makeWeaponBodyMesh(): Mesh {
  return MeshBuilder.CreateBox("wBody", WEAPON.body.size, g.scene);
}

function makeWeaponBarrelMesh(): Mesh {
  return MeshBuilder.CreateCylinder("wBarrel", WEAPON.barrel.size, g.scene);
}

function makeWeaponCellMesh(): Mesh {
  return MeshBuilder.CreateBox("wCell", WEAPON.cell.size, g.scene);
}

function makeWeaponGripMesh(): Mesh {
  return MeshBuilder.CreateBox("wGrip", WEAPON.grip.size, g.scene);
}

function makeWeaponAccentMesh(): Mesh {
  return MeshBuilder.CreateBox("wAccent", WEAPON.accent.size, g.scene);
}

function makeWeaponLensMesh(): Mesh {
  return MeshBuilder.CreateSphere("wLens", WEAPON.lens.size, g.scene);
}

function makeRifleBodyMesh(): Mesh {
  return MeshBuilder.CreateBox("rBody", RIFLE_WEAPON.body.size, g.scene);
}

function makeRifleBarrelMesh(): Mesh {
  return MeshBuilder.CreateBox("rBarrel", RIFLE_WEAPON.barrel.size, g.scene);
}

function makeRifleStockMesh(): Mesh {
  return MeshBuilder.CreateBox("rStock", RIFLE_WEAPON.stock.size, g.scene);
}

function makeRifleGripMesh(): Mesh {
  return MeshBuilder.CreateBox("rGrip", RIFLE_WEAPON.grip.size, g.scene);
}

function makeRifleMagMesh(): Mesh {
  return MeshBuilder.CreateBox("rMag", RIFLE_WEAPON.mag.size, g.scene);
}

function makeRifleBrakeMesh(): Mesh {
  return MeshBuilder.CreateBox("rBrake", RIFLE_WEAPON.brake.size, g.scene);
}

function makeRifleBodyMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleBody", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.body.diffuse;
  mat.specularColor = new Color3(0.35, 0.35, 0.38);
  mat.emissiveColor = RIFLE_WEAPON.body.emissive;
  return mat;
}

function makeRifleBarrelMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleBarrel", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.barrel.diffuse;
  mat.emissiveColor = RIFLE_WEAPON.barrel.emissive;
  return mat;
}

function makeRifleGripMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleGrip", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.grip.diffuse;
  return mat;
}

function makeRifleStockMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleStock", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.stock.diffuse;
  return mat;
}

function makeRifleMagMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleMag", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.mag.diffuse;
  mat.emissiveColor = RIFLE_WEAPON.mag.emissive;
  return mat;
}

function makeRifleBrakeMat(): StandardMaterial {
  const mat = new StandardMaterial("rifleBrake", g.scene);
  mat.diffuseColor = RIFLE_WEAPON.brake.diffuse;
  mat.emissiveColor = RIFLE_WEAPON.brake.emissive;
  return mat;
}

// ─── Weapon setup (exported) ──────────────────────────────────────────────────
export function setupWeaponRoot(): Mesh {
  const root = new Mesh("weaponRoot", g.scene);
  root.parent = g.camera;
  root.position = WEAPON.rootPos.clone();
  root.isPickable = false;
  return root;
}

export function setupRifleRoot(): Mesh {
  const root = new Mesh("rifleRoot", g.scene);
  root.parent = g.camera;
  root.position = RIFLE_WEAPON.rootPos.clone();
  root.isPickable = false;
  return root;
}

export function setupWeaponParts(root: Mesh): {
  cell: Mesh;
  barrel: Mesh;
  barrelTip: Mesh;
} {
  function wp(
    mesh: Mesh,
    mat: StandardMaterial,
    localPos: Vector3,
    localRotX = 0,
  ): Mesh {
    mesh.parent = root;
    mesh.position = localPos;
    mesh.rotation.x = localRotX;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    return mesh;
  }

  wp(makeWeaponBodyMesh(), makeWeaponBodyMat(), WEAPON.body.pos.clone());
  const barrel = wp(
    makeWeaponBarrelMesh(),
    makeWeaponBarrelMat(),
    WEAPON.barrel.pos.clone(),
    WEAPON.barrel.rotX,
  );
  const cell = wp(
    makeWeaponCellMesh(),
    makeWeaponCellMat(),
    WEAPON.cell.pos.clone(),
  );
  wp(makeWeaponGripMesh(), makeWeaponGripMat(), WEAPON.grip.pos.clone());
  wp(makeWeaponAccentMesh(), makeWeaponAccentMat(), WEAPON.accent.pos.clone());
  wp(makeWeaponLensMesh(), makeWeaponLensMat(), WEAPON.lens.pos.clone());

  const barrelTip = new Mesh("wBarrelTip", g.scene);
  barrelTip.parent = root;
  barrelTip.position = WEAPON.barrelTipPos.clone();
  barrelTip.isVisible = false;
  barrelTip.isPickable = false;

  return { cell, barrel, barrelTip };
}

export function setupRifleParts(root: Mesh): {
  mag: Mesh;
  barrel: Mesh;
  barrelTip: Mesh;
  brake: Mesh;
} {
  function wp(mesh: Mesh, mat: StandardMaterial, localPos: Vector3): Mesh {
    mesh.parent = root;
    mesh.position = localPos;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    return mesh;
  }

  wp(makeRifleBodyMesh(), makeRifleBodyMat(), RIFLE_WEAPON.body.pos.clone());
  wp(makeRifleStockMesh(), makeRifleStockMat(), RIFLE_WEAPON.stock.pos.clone());
  wp(makeRifleGripMesh(), makeRifleGripMat(), RIFLE_WEAPON.grip.pos.clone());
  const barrel = wp(
    makeRifleBarrelMesh(),
    makeRifleBarrelMat(),
    RIFLE_WEAPON.barrel.pos.clone(),
  );
  const mag = wp(
    makeRifleMagMesh(),
    makeRifleMagMat(),
    RIFLE_WEAPON.mag.pos.clone(),
  );
  const brake = wp(
    makeRifleBrakeMesh(),
    makeRifleBrakeMat(),
    RIFLE_WEAPON.brake.pos.clone(),
  );
  brake.isVisible = false;

  const barrelTip = new Mesh("rBarrelTip", g.scene);
  barrelTip.parent = root;
  barrelTip.position = RIFLE_WEAPON.barrelTipPos.clone();
  barrelTip.isVisible = false;
  barrelTip.isPickable = false;

  return { mag, barrel, barrelTip, brake };
}

// ─── Player mesh (exported) ───────────────────────────────────────────────────
export function makePlayerMesh(): { mesh: Mesh; aggregate: PhysicsAggregate } {
  const mesh = MeshBuilder.CreateCapsule(
    "player",
    PLAYER_MESH.capsule,
    g.scene,
  );
  mesh.position.y = PLAYER.spawnY;
  mesh.isVisible = false;
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.CAPSULE,
    { mass: 70, friction: 0.7, restitution: 0 },
    g.scene,
  );
  aggregate.body.setMassProperties({
    mass: 70,
    inertia: Vector3.Zero(),
    inertiaOrientation: Quaternion.Identity(),
  });
  return { mesh, aggregate };
}

// ─── Enemy material & meshes (exported) ───────────────────────────────────────
function makeEnemyMat(): StandardMaterial {
  const mat = new StandardMaterial("emat", g.scene);
  mat.diffuseColor = ENEMY_COLOR.clone();
  mat.emissiveColor = mat.diffuseColor.scale(0.2);
  return mat;
}

export function makeEnemyMats(): {
  bodyMat: StandardMaterial;
  headMat: StandardMaterial;
} {
  const bodyMat = makeEnemyMat();
  const headMat = bodyMat.clone("emat_head") as StandardMaterial;
  return { bodyMat, headMat };
}

export function makeEnemyPhysCapsule(position: Vector3): {
  mesh: Mesh;
  aggregate: PhysicsAggregate;
} {
  const mesh = MeshBuilder.CreateCapsule(
    "enemyPhys",
    ENEMY_MESH.capsule,
    g.scene,
  );
  mesh.isVisible = false;
  mesh.position = position;
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.CAPSULE,
    { mass: 10, friction: 0.7, restitution: 0 },
    g.scene,
  );
  aggregate.body.setMassProperties({
    mass: 10,
    inertia: Vector3.Zero(),
    inertiaOrientation: Quaternion.Identity(),
  });
  return { mesh, aggregate };
}

export function makeEnemyBodyMesh(): Mesh {
  const mesh = MeshBuilder.CreateBox("enemyBody", ENEMY_MESH.body, g.scene);
  mesh.position = ENEMY_MESH.bodyOffset.clone();
  return mesh;
}

export function makeEnemyLegMesh(side: "left" | "right"): Mesh {
  const { width, height, depth } = ENEMY_MESH.leg;
  // Pivot node sits at top of leg
  const pivot = new Mesh("enemyLegPivot", g.scene);
  pivot.isPickable = false;
  pivot.position = new Vector3(
    side === "left" ? -ENEMY_MESH.legSpacing : ENEMY_MESH.legSpacing,
    ENEMY_MESH.legOffsetY,
    0,
  );
  const leg = MeshBuilder.CreateBox(
    "enemyLeg",
    { width, height, depth },
    g.scene,
  );
  leg.parent = pivot;
  leg.position = new Vector3(0, -height / 2, 0); // hang down from pivot
  return pivot;
}

export function makeEnemyArmMesh(side: "left" | "right"): Mesh {
  const { width, height, depth } = ENEMY_MESH.arm;
  const pivot = new Mesh("enemyArmPivot", g.scene);
  pivot.isPickable = false;
  pivot.position = new Vector3(
    side === "left" ? -ENEMY_MESH.armSpacing : ENEMY_MESH.armSpacing,
    ENEMY_MESH.armOffsetY,
    0,
  );
  const arm = MeshBuilder.CreateBox(
    "enemyArm",
    { width, height, depth },
    g.scene,
  );
  arm.parent = pivot;
  arm.position = new Vector3(0, -height / 2, 0);
  return pivot;
}

export function makeEnemyHeadMesh(): Mesh {
  const { height, radius } = ENEMY_MESH.head;
  const mesh = MeshBuilder.CreateCapsule(
    "enemyHead",
    { height, radius, capSubdivisions: 6, subdivisions: 1, tessellation: 12 },
    g.scene,
  );
  // Truncate the bottom cap — flatten all vertices below the cutoff
  const cutY = -height / 2 + radius * 0.9;
  const positions = mesh.getVerticesData("position")!;
  for (let i = 1; i < positions.length; i += 3) {
    if (positions[i] < cutY) positions[i] = cutY;
  }
  mesh.setVerticesData("position", positions);
  mesh.position = ENEMY_MESH.headOffset.clone();
  return mesh;
}

// ─── Ragdoll split halves (exported) ─────────────────────────────────────────
export function makeBodySplitHalves(
  worldPos: Vector3,
  mat: StandardMaterial,
): [Mesh, Mesh] {
  const { width, depth } = ENEMY_MESH.body;
  const halfH = ENEMY_MESH.body.height / 2;

  const top = MeshBuilder.CreateBox(
    "bodyHalf",
    { width, height: halfH, depth },
    g.scene,
  );
  top.position = new Vector3(worldPos.x, worldPos.y + halfH / 2, worldPos.z);
  top.material = mat;

  const bottom = MeshBuilder.CreateBox(
    "bodyHalf",
    { width, height: halfH, depth },
    g.scene,
  );
  bottom.position = new Vector3(worldPos.x, worldPos.y - halfH / 2, worldPos.z);
  bottom.material = mat;

  return [top, bottom];
}

export function makeHeadSplitHalves(
  worldPos: Vector3,
  mat: StandardMaterial,
): [Mesh, Mesh] {
  const { height, radius } = ENEMY_MESH.head;
  const halfH = height / 2;

  const top = MeshBuilder.CreateCapsule(
    "headHalf",
    {
      height: halfH,
      radius,
      capSubdivisions: 6,
      subdivisions: 1,
      tessellation: 12,
    },
    g.scene,
  );
  top.position = new Vector3(worldPos.x, worldPos.y + halfH / 4, worldPos.z);
  top.material = mat;

  const bottom = MeshBuilder.CreateCapsule(
    "headHalf",
    {
      height: halfH,
      radius,
      capSubdivisions: 6,
      subdivisions: 1,
      tessellation: 12,
    },
    g.scene,
  );
  bottom.position = new Vector3(worldPos.x, worldPos.y - halfH / 4, worldPos.z);
  bottom.material = mat;

  return [top, bottom];
}

function makeLimbSplitHalves(
  name: string,
  dims: { width: number; height: number; depth: number },
  worldPos: Vector3,
  mat: StandardMaterial,
): [Mesh, Mesh] {
  const halfH = dims.height / 2;
  const top = MeshBuilder.CreateBox(
    name,
    { width: dims.width, height: halfH, depth: dims.depth },
    g.scene,
  );
  top.position = new Vector3(worldPos.x, worldPos.y + halfH / 2, worldPos.z);
  top.material = mat;
  const bottom = MeshBuilder.CreateBox(
    name,
    { width: dims.width, height: halfH, depth: dims.depth },
    g.scene,
  );
  bottom.position = new Vector3(worldPos.x, worldPos.y - halfH / 2, worldPos.z);
  bottom.material = mat;
  return [top, bottom];
}

export function makeArmSplitHalves(
  worldPos: Vector3,
  mat: StandardMaterial,
): [Mesh, Mesh] {
  return makeLimbSplitHalves("armHalf", ENEMY_MESH.arm, worldPos, mat);
}

export function makeLegSplitHalves(
  worldPos: Vector3,
  mat: StandardMaterial,
): [Mesh, Mesh] {
  return makeLimbSplitHalves("legHalf", ENEMY_MESH.leg, worldPos, mat);
}

// ─── Lamppost (exported) ─────────────────────────────────────────────────────
export function setupLamppost(): { pole: Mesh; lightY: number } {
  const lampY = LIGHTING.lampHeight;

  const poleMat = new StandardMaterial("poleMat", g.scene);
  poleMat.diffuseColor = new Color3(0.2, 0.2, 0.22);
  poleMat.specularColor = new Color3(0.4, 0.4, 0.4);

  const pole = MeshBuilder.CreateCylinder(
    "pole",
    { diameter: 0.15, height: lampY },
    g.scene,
  );
  pole.position.y = lampY / 2;
  pole.material = poleMat;
  new PhysicsAggregate(pole, PhysicsShapeType.CYLINDER, { mass: 0 }, g.scene);

  const head = MeshBuilder.CreateCylinder(
    "lampHead",
    { diameterTop: 0.1, diameterBottom: 0.8, height: 0.4, tessellation: 8 },
    g.scene,
  );
  head.position.y = lampY - 0.2;
  head.material = poleMat;

  const bulbMat = new StandardMaterial("bulbMat", g.scene);
  bulbMat.diffuseColor = new Color3(1, 0.9, 0.7);
  bulbMat.emissiveColor = new Color3(1, 0.85, 0.5);
  const bulb = MeshBuilder.CreateSphere("bulb", { diameter: 0.3 }, g.scene);
  bulb.position.y = lampY - 0.4;
  bulb.material = bulbMat;

  return { pole, lightY: lampY - 0.3 };
}

// ─── Supplies (exported) ──────────────────────────────────────────────────────
export function makeHealthSupply(position: Vector3): {
  mesh: Mesh;
  aggregate: PhysicsAggregate;
} {
  const mat = new StandardMaterial("supplyMat", g.scene);
  mat.diffuseColor = new Color3(0.1, 0.9, 0.2);
  mat.emissiveColor = new Color3(0.1, 0.6, 0.1);
  const mesh = MeshBuilder.CreateSphere("supply", { diameter: 0.4 }, g.scene);
  mesh.position = position.clone();
  mesh.position.y = Math.max(mesh.position.y, 0.3);
  mesh.material = mat;
  mesh.isPickable = false;
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 1, friction: 0.8, restitution: 0.2 },
    g.scene,
  );
  return { mesh, aggregate };
}

export function makeAmmoSupply(position: Vector3): {
  mesh: Mesh;
  aggregate: PhysicsAggregate;
} {
  const mat = new StandardMaterial("supplyMat", g.scene);
  mat.diffuseColor = WEAPON.cell.diffuse.clone();
  mat.emissiveColor = WEAPON.cell.emissive.clone();
  const s = WEAPON.cell.size;
  const mesh = MeshBuilder.CreateBox(
    "supply",
    { width: s.width * 4, height: s.height * 4, depth: s.depth * 4 },
    g.scene,
  );
  mesh.position = position.clone();
  mesh.position.y = Math.max(mesh.position.y, 0.3);
  mesh.material = mat;
  mesh.isPickable = false;
  const aggregate = new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 1, friction: 0.8, restitution: 0.2 },
    g.scene,
  );
  return { mesh, aggregate };
}

// ─── Laser beam (exported) ────────────────────────────────────────────────────
export function makeBeam(from: Vector3, to: Vector3): Mesh {
  const mat = new StandardMaterial("laserMat", g.scene);
  mat.diffuseColor = LASER_BEAM.diffuse;
  mat.emissiveColor = LASER_BEAM.emissive;
  mat.disableLighting = true;
  const beam = MeshBuilder.CreateTube(
    "laserBeam",
    {
      path: [from, to],
      radius: LASER_BEAM.radius,
      tessellation: LASER_BEAM.tessellation,
      updatable: false,
      cap: 0,
    },
    g.scene,
  );
  beam.material = mat;
  beam.isPickable = false;
  return beam;
}

// ─── Ragdoll physics helpers (exported) ──────────────────────────────────────
export function makeRagdollBodyAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 8, friction: 0.6, restitution: 0.05 },
    g.scene,
  );
}

export function makeRagdollHeadAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(
    mesh,
    PhysicsShapeType.CAPSULE,
    { mass: 2, friction: 0.5, restitution: 0.3 },
    g.scene,
  );
}

export function makeRagdollArmAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 1, friction: 0.6, restitution: 0.05 },
    g.scene,
  );
}

export function makeRagdollLegAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass: 2, friction: 0.6, restitution: 0.05 },
    g.scene,
  );
}

export function makeRagdollHalfAggregate(
  mesh: Mesh,
  mass: number,
): PhysicsAggregate {
  return new PhysicsAggregate(
    mesh,
    PhysicsShapeType.BOX,
    { mass, friction: 0.6, restitution: 0.05 },
    g.scene,
  );
}

// ─── Bullet hole (exported) ───────────────────────────────────────────────────
const BULLET_HOLE_SURFACE_OFFSET = BULLET_HOLE_STYLE.surfaceOffset;

export function makeBulletHoleDisc(): Mesh {
  const mat = new StandardMaterial("bholeMat", g.scene);
  mat.diffuseColor = BULLET_HOLE_STYLE.diffuse;
  mat.emissiveColor = BULLET_HOLE_STYLE.emissive;
  mat.backFaceCulling = false;
  const disc = MeshBuilder.CreateDisc(
    "bhole",
    {
      radius: BULLET_HOLE_STYLE.radius,
      tessellation: BULLET_HOLE_STYLE.tessellation,
    },
    g.scene,
  );
  disc.material = mat;
  disc.isPickable = false;
  return disc;
}

// ─── Plasma projectile (exported) ───────────────────────────────────────────
export function makePlasmaMesh(pos: Vector3): Mesh {
  const mat = new StandardMaterial("plasmaMat", g.scene);
  mat.diffuseColor = new Color3(0, 1, 1);
  mat.emissiveColor = new Color3(0, 0.9, 1);
  mat.disableLighting = true;
  const mesh = MeshBuilder.CreateSphere(
    "plasma",
    { diameter: PLASMA.radius * 2, segments: 8 },
    g.scene,
  );
  mesh.material = mat;
  mesh.position = pos.clone();
  mesh.isPickable = false;
  return mesh;
}

export function makePlasmaChargeMesh(): Mesh {
  const mat = new StandardMaterial("plasmaChargeMat", g.scene);
  mat.diffuseColor = new Color3(0, 1, 1);
  mat.emissiveColor = new Color3(0, 0.9, 1);
  mat.disableLighting = true;
  mat.alpha = 0.5;
  const mesh = MeshBuilder.CreateSphere(
    "plasmaCharge",
    { diameter: PLASMA.radius * 2, segments: 8 },
    g.scene,
  );
  mesh.material = mat;
  mesh.renderingGroupId = 1;
  mesh.parent = g.barrelTip;
  mesh.position.setAll(0);
  mesh.isPickable = false;
  return mesh;
}

export function makeRifleTracerMesh(
  pos: Vector3,
  dir: Vector3,
  isCrit: boolean,
): Mesh {
  const mat = new StandardMaterial("rifleTracerMat", g.scene);
  mat.diffuseColor = isCrit ? new Color3(0.6, 0, 1) : new Color3(1, 0.9, 0.2);
  mat.emissiveColor = isCrit
    ? new Color3(0.5, 0, 0.9)
    : new Color3(1, 0.85, 0.1);
  const mesh = MeshBuilder.CreateBox(
    "rifleTracer",
    {
      width: RIFLE.tracerWidth,
      height: RIFLE.tracerWidth,
      depth: RIFLE.tracerLength,
    },
    g.scene,
  );
  mesh.material = mat;
  mesh.position = pos.clone();
  mesh.isPickable = false;
  mesh.renderingGroupId = 1;
  mesh.rotationQuaternion = Quaternion.FromLookDirectionLH(
    dir.normalizeToNew(),
    Vector3.Up(),
  );
  return mesh;
}

export function spawnRifleMuzzleFlash(isCrit: boolean): void {
  const flash = MeshBuilder.CreateSphere(
    "rifleMuzzleFlash",
    { diameter: 0.3, segments: 6 },
    g.scene,
  );
  const mat = new StandardMaterial("rifleMuzzleFlashMat", g.scene);
  mat.diffuseColor = isCrit
    ? new Color3(0.7, 0.2, 1)
    : new Color3(1, 0.9, 0.25);
  mat.emissiveColor = isCrit
    ? new Color3(0.6, 0.1, 0.95)
    : new Color3(1, 0.75, 0.15);
  mat.alpha = 0.95;
  flash.material = mat;
  flash.parent = g.rifleBarrelTip;
  flash.position = Vector3.Zero();
  flash.isPickable = false;
  flash.renderingGroupId = 1;

  const flashScale = g.upgrades.muzzleBrake ? RIFLE.MUZZLE_BRAKE.flashScale : 1;

  const start = performance.now();
  const obs = g.scene.onBeforeRenderObservable.add(() => {
    const t = Math.min((performance.now() - start) / 60, 1);
    flash.scaling.setAll(
      (RIFLE.MUZZLE_FLASH.baseScale + t * RIFLE.MUZZLE_FLASH.expandScale) *
        flashScale,
    );
    mat.alpha = 0.95 * (1 - t);
    if (t >= 1) {
      g.scene.onBeforeRenderObservable.remove(obs);
      flash.dispose();
      mat.dispose();
    }
  });
}

// ─── Spawn functions (moved from update.ts) ─────────────────────────────────

export function spawnEnemy(): void {
  const playerPos = g.playerMesh.position;
  let x: number, z: number;
  do {
    x = (Math.random() * 2 - 1) * (ARENA.size / 2 - 2);
    z = (Math.random() * 2 - 1) * (ARENA.size / 2 - 2);
  } while (
    (x - playerPos.x) ** 2 + (z - playerPos.z) ** 2 <
    ENEMY.minSpawnDist ** 2
  );

  const { mesh: physMesh, aggregate } = makeEnemyPhysCapsule(
    new Vector3(x, ARENA.ceil - 0.5, z),
  );

  const { bodyMat, headMat } = makeEnemyMats();

  const visualRoot = new Mesh("enemyVisual", g.scene);
  visualRoot.parent = physMesh;
  visualRoot.isVisible = false;
  visualRoot.isPickable = false;

  const bodyMesh = makeEnemyBodyMesh();
  bodyMesh.parent = visualRoot;
  bodyMesh.material = bodyMat;

  const head = makeEnemyHeadMesh();
  head.parent = visualRoot;
  head.material = headMat;

  const leftLeg = makeEnemyLegMesh("left");
  leftLeg.parent = visualRoot;
  const leftLegBox = leftLeg.getChildMeshes()[0] as Mesh;
  leftLegBox.material = bodyMat;

  const rightLeg = makeEnemyLegMesh("right");
  rightLeg.parent = visualRoot;
  const rightLegBox = rightLeg.getChildMeshes()[0] as Mesh;
  rightLegBox.material = bodyMat;

  const leftArm = makeEnemyArmMesh("left");
  leftArm.parent = visualRoot;
  const leftArmBox = leftArm.getChildMeshes()[0] as Mesh;
  leftArmBox.material = bodyMat;

  const rightArm = makeEnemyArmMesh("right");
  rightArm.parent = visualRoot;
  const rightArmBox = rightArm.getChildMeshes()[0] as Mesh;
  rightArmBox.material = bodyMat;

  g.shadowGenerator.addShadowCaster(bodyMesh);
  g.shadowGenerator.addShadowCaster(head);
  g.shadowGenerator.addShadowCaster(leftLegBox);
  g.shadowGenerator.addShadowCaster(rightLegBox);
  g.shadowGenerator.addShadowCaster(leftArmBox);
  g.shadowGenerator.addShadowCaster(rightArmBox);

  g.enemies.push({
    physMesh,
    visualRoot,
    bodyMesh,
    headMesh: head,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    aggregate,
    hp: ENEMY.hp + ENEMY.hpPerWave * (g.state.wave - 1),
    maxHp: ENEMY.hp + ENEMY.hpPerWave * (g.state.wave - 1),
    speed: ENEMY.speed + ENEMY.speedPerWave * (g.state.wave - 1),
    state: "patrol",
    patrolTarget: physMesh.position.clone(),
    attackCooldown: 0,
    meleeDamage:
      ENEMY.meleeDamage + ENEMY.meleeDamagePerWave * (g.state.wave - 1),
    meleeIntervalMs:
      60000 /
      (ENEMY.meleeAttacksPerMin +
        ENEMY.meleeAttacksPerMinPerWave * (g.state.wave - 1)),
    zigzagTimer: Math.random() * Math.PI * 2,
    flashTime: 0,
    flashMesh: null,
    baseEmissive: bodyMat.diffuseColor.scale(0.2),
    walkPhase: Math.random() * Math.PI * 2,
    lastFootLeft: false,
    facingYaw: Math.random() * Math.PI * 2,
    attackAnimTime: 0,
    onFire: false,
    fireParticle: null,
    fireLight: null,
    fireAudioSource: null,
    fireAudioPanner: null,
    fireAudioGain: null,
    fireSpreadTimer: 0,
    fireDmgAccum: 0,
    healthBarPlane: null,
    healthBarTexture: null,
    healthBarFill: null,
  });
  const enemy = g.enemies[g.enemies.length - 1];
  createEnemyHealthBar(enemy);
  playEnemySpawnSound(new Vector3(x, ARENA.ceil - 0.5, z));
}

export function spawnSupply(
  position: Vector3,
  forceType?: "health" | "ammo",
): void {
  const type = forceType ?? (Math.random() < 0.5 ? "health" : "ammo");
  const { mesh, aggregate } =
    type === "health" ? makeHealthSupply(position) : makeAmmoSupply(position);
  g.supplies.push({ mesh, aggregate, type });
}

export function spawnPlasma(
  pos: Vector3,
  dir: Vector3,
  chargeMultiplier: number,
  heatPenalty: number,
  isCrit: boolean,
  hasGravity: boolean,
  ricochetDepth: number,
): void {
  const mesh = makePlasmaMesh(pos);
  mesh.scaling.setAll(chargeMultiplier);
  const plasmaMat = mesh.material as StandardMaterial;
  if (isCrit) {
    plasmaMat.diffuseColor = new Color3(0.6, 0, 1);
    plasmaMat.emissiveColor = new Color3(0.5, 0, 0.9);
  }
  if (heatPenalty < 1) {
    const t = 1 - heatPenalty;
    plasmaMat.alpha = 1 - t * 0.6;
    plasmaMat.emissiveColor = Color3.Lerp(
      plasmaMat.emissiveColor,
      new Color3(0.2, 0.3, 0.3),
      t,
    );
  }
  g.plasmas.push({
    mesh,
    velocity: dir.scale(PLASMA.speed / chargeMultiplier),
    age: 0,
    heatPenalty,
    chargeMultiplier,
    isCrit,
    hasGravity,
    ricochetDepth,
  });
}

// ─── Visual effects (moved from update.ts) ──────────────────────────────────

export function spawnLightningBolt(
  from: Vector3,
  to: Vector3,
  isCrit = false,
): void {
  const segments = 8;
  const path: Vector3[] = [from.clone()];
  const dir = to.subtract(from);
  const dist = dir.length();
  const step = dir.scale(1 / segments);
  const perp1 = Vector3.Cross(dir, new Vector3(1, 0, 0));
  if (perp1.lengthSquared() < 0.01)
    perp1.copyFrom(Vector3.Cross(dir, new Vector3(0, 0, 1)));
  perp1.normalize();
  const perp2 = Vector3.Cross(dir, perp1).normalize();
  for (let i = 1; i < segments; i++) {
    const jitter = dist * 0.08;
    path.push(
      from
        .add(step.scale(i))
        .add(perp1.scale((Math.random() - 0.5) * jitter))
        .add(perp2.scale((Math.random() - 0.5) * jitter)),
    );
  }
  path.push(to.clone());

  const bolt = MeshBuilder.CreateTube(
    "lightning",
    { path, radius: 0.03, tessellation: 4, updatable: false, cap: 0 },
    g.scene,
  );
  const mat = new StandardMaterial("lightningMat", g.scene);
  mat.diffuseColor = isCrit ? new Color3(0.6, 0, 1) : new Color3(0.5, 0.7, 1);
  mat.emissiveColor = isCrit
    ? new Color3(0.5, 0, 0.9)
    : new Color3(0.6, 0.8, 1);
  mat.disableLighting = true;
  bolt.material = mat;
  bolt.isPickable = false;
  setTimeout(() => bolt.dispose(), 150);
}

export function spawnExplosionParticle(
  position: Vector3,
  isCrit = false,
): void {
  const ps = new ParticleSystem("explosion", 120, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.3, -0.3, -0.3);
  ps.maxEmitBox = new Vector3(0.3, 0.3, 0.3);
  ps.color1 = isCrit ? new Color4(0.7, 0.1, 1, 1) : new Color4(0, 1, 1, 1);
  ps.color2 = isCrit
    ? new Color4(0.4, 0, 0.8, 0.8)
    : new Color4(0, 0.5, 1, 0.8);
  ps.colorDead = isCrit
    ? new Color4(0.15, 0, 0.2, 0)
    : new Color4(0.1, 0.15, 0.2, 0);
  ps.minSize = 0.15;
  ps.maxSize = 0.5;
  ps.minLifeTime = 0.3;
  ps.maxLifeTime = 0.8;
  ps.emitRate = 800;
  ps.minEmitPower = 5;
  ps.maxEmitPower = 15;
  ps.direction1 = new Vector3(-1, -1, -1);
  ps.direction2 = new Vector3(1, 1, 1);
  ps.gravity = new Vector3(0, -10, 0);
  ps.updateSpeed = 0.02;
  ps.start();
  setTimeout(() => ps.stop(), 100);
  setTimeout(() => ps.dispose(false), 1200);
}

export function spawnDeathParticle(position: Vector3): void {
  const ps = new ParticleSystem("death", 80, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.3, -0.3, -0.3);
  ps.maxEmitBox = new Vector3(0.3, 0.3, 0.3);
  ps.color1 = new Color4(1, 0.1, 0.0, 1);
  ps.color2 = new Color4(0.6, 0.0, 0.0, 0.8);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.1;
  ps.maxSize = 0.3;
  ps.minLifeTime = 0.3;
  ps.maxLifeTime = 0.9;
  ps.emitRate = 600;
  ps.minEmitPower = 4;
  ps.maxEmitPower = 10;
  ps.direction1 = new Vector3(-1, -1, -1);
  ps.direction2 = new Vector3(1, 1, 1);
  ps.gravity = new Vector3(0, -15, 0);
  ps.updateSpeed = 0.02;
  ps.start();
  setTimeout(() => ps.stop(), 100);
  setTimeout(() => ps.dispose(false), 1200);
}

export function spawnHitParticle(
  position: Vector3,
  color: Color4,
  normal: Vector3,
): void {
  const ps = new ParticleSystem("hit", 40, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.05, -0.05, -0.05);
  ps.maxEmitBox = new Vector3(0.05, 0.05, 0.05);
  ps.color1 = color;
  ps.color2 = new Color4(color.r, color.g, color.b, 0.5);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.04;
  ps.maxSize = 0.12;
  ps.minLifeTime = 0.1;
  ps.maxLifeTime = 0.4;
  ps.emitRate = 400;
  ps.minEmitPower = 3;
  ps.maxEmitPower = 7;

  const n = normal.normalize();
  const perp = (
    Math.abs(n.x) < 0.9
      ? Vector3.Cross(n, new Vector3(1, 0, 0))
      : Vector3.Cross(n, new Vector3(0, 1, 0))
  ).normalize();
  const perp2 = Vector3.Cross(n, perp);
  ps.direction1 = n.subtract(perp).subtract(perp2);
  ps.direction2 = n.add(perp).add(perp2);

  ps.gravity = new Vector3(0, -12, 0);
  ps.updateSpeed = 0.02;
  ps.start();
  setTimeout(() => ps.stop(), 80);
  setTimeout(() => ps.dispose(false), 600);
}

export function spawnSmokeParticles(): void {
  const emitPos = g.barrelTip.getAbsolutePosition().clone();
  const ps = new ParticleSystem("smoke", 50, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = emitPos;
  ps.minEmitBox = new Vector3(-0.01, -0.01, -0.01);
  ps.maxEmitBox = new Vector3(0.01, 0.01, 0.01);
  ps.minSize = 0.02;
  ps.maxSize = 0.08;
  ps.minLifeTime = 0.5;
  ps.maxLifeTime = 1.2;
  ps.emitRate = 50;
  ps.direction1 = new Vector3(-0.02, 0.3, -0.02);
  ps.direction2 = new Vector3(0.02, 0.6, 0.02);
  ps.minEmitPower = 0.2;
  ps.maxEmitPower = 0.5;
  ps.color1 = new Color4(0.6, 0.6, 0.6, 0.5);
  ps.color2 = new Color4(0.35, 0.35, 0.35, 0.3);
  ps.colorDead = new Color4(0.1, 0.1, 0.1, 0);
  ps.gravity = new Vector3(0, 0.4, 0);
  ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  ps.renderingGroupId = 1;
  ps.start();
  const obs = g.scene.onBeforeRenderObservable.add(() => {
    const p = g.barrelTip.getAbsolutePosition();
    emitPos.x = p.x;
    emitPos.y = p.y;
    emitPos.z = p.z;
  });
  setTimeout(() => {
    ps.stop();
    setTimeout(() => {
      ps.dispose(false);
      g.scene.onBeforeRenderObservable.remove(obs);
    }, 1500);
  }, 1500);
}

// ─── Enemy Health Bar (3D GUI — world space) ──────────────────────────────
function createEnemyHealthBar(enemy: import("./game.js").Enemy): void {
  const plane = MeshBuilder.CreatePlane(
    "hpBarPlane",
    {
      width: ENEMY_HEALTH_BAR.width,
      height: ENEMY_HEALTH_BAR.height,
    },
    g.scene,
  );
  plane.parent = enemy.physMesh;
  plane.position.y = ENEMY_HEALTH_BAR.offsetY;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;

  const tex = AdvancedDynamicTexture.CreateForMesh(
    plane,
    ENEMY_HEALTH_BAR.texW,
    ENEMY_HEALTH_BAR.texH,
  );

  const bg = new Rectangle("hpBg");
  bg.background = ENEMY_HEALTH_BAR.bgColor;
  bg.color = "transparent";
  bg.thickness = 0;
  bg.width = 1;
  bg.height = 1;
  tex.addControl(bg);

  const fill = new Rectangle("hpFill");
  fill.background = ENEMY_HEALTH_BAR.color;
  fill.color = "transparent";
  fill.thickness = 0;
  fill.width = 1;
  fill.height = 1;
  fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  tex.addControl(fill);

  enemy.healthBarPlane = plane;
  enemy.healthBarTexture = tex;
  enemy.healthBarFill = fill;
  // Hidden at full health
  plane.setEnabled(false);
}

export function disposeEnemyHealthBar(enemy: import("./game.js").Enemy): void {
  if (enemy.healthBarPlane) {
    if (enemy.healthBarTexture) {
      enemy.healthBarTexture.dispose();
      enemy.healthBarTexture = null;
    }
    enemy.healthBarPlane.dispose();
    enemy.healthBarPlane = null;
    enemy.healthBarFill = null;
  }
}

export function updateEnemyHealthBar(enemy: import("./game.js").Enemy): void {
  if (!enemy.healthBarFill || !enemy.healthBarPlane) return;
  const frac = Math.max(0, enemy.hp / enemy.maxHp);
  enemy.healthBarFill.width = frac;
  enemy.healthBarPlane.setEnabled(frac < 1);
}

export function spawnDamageNumber(
  position: Vector3,
  amount: number,
  isCrit: boolean,
): void {
  const plane = MeshBuilder.CreatePlane(
    "dmgPlane",
    { width: 1.2, height: 0.4 },
    g.scene,
  );
  plane.position = position.clone();
  plane.position.y += 0.5;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;

  const tex = AdvancedDynamicTexture.CreateForMesh(plane, 120, 40);

  const text = new TextBlock();
  text.text = String(Math.round(amount));
  text.color = isCrit ? "#cc44ff" : "#ff4444";
  text.fontSize = isCrit ? 36 : 28;
  text.fontWeight = "bold";
  text.outlineWidth = 3;
  text.outlineColor = "#000000";
  tex.addControl(text);

  const startY = plane.position.y;
  const duration = 800;
  const startTime = performance.now();
  const obs = g.scene.onBeforeRenderObservable.add(() => {
    const t = Math.min((performance.now() - startTime) / duration, 1);
    plane.position.y = startY + t * 1.5;
    plane.visibility = 1 - t;
    if (t >= 1) {
      g.scene.onBeforeRenderObservable.remove(obs);
      tex.dispose();
      plane.dispose();
    }
  });
}

export function spawnFireEffect(enemy: import("./game.js").Enemy): void {
  const emitPos = enemy.bodyMesh.getAbsolutePosition().clone();
  const ps = new ParticleSystem("fire", 60, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = emitPos;
  ps.minEmitBox = new Vector3(-0.25, -0.3, -0.25);
  ps.maxEmitBox = new Vector3(0.25, 0.5, 0.25);
  ps.color1 = new Color4(1, 0.6, 0.1, 1);
  ps.color2 = new Color4(1, 0.2, 0.0, 0.8);
  ps.colorDead = new Color4(0.2, 0.2, 0.2, 0);
  ps.minSize = 0.08;
  ps.maxSize = 0.25;
  ps.minLifeTime = 0.2;
  ps.maxLifeTime = 0.6;
  ps.emitRate = 80;
  ps.minEmitPower = 0.5;
  ps.maxEmitPower = 2;
  ps.direction1 = new Vector3(-0.3, 0.5, -0.3);
  ps.direction2 = new Vector3(0.3, 1.5, 0.3);
  ps.gravity = new Vector3(0, 2, 0);
  ps.updateSpeed = 0.02;
  ps.start();

  const light = new PointLight("fireLight", emitPos.clone(), g.scene);
  light.diffuse = new Color3(1, 0.5, 0.1);
  light.intensity = 1.5;
  light.range = 5;

  enemy.fireParticle = ps;
  enemy.fireLight = light;

  const audio = startFireSound(emitPos);
  enemy.fireAudioSource = audio.source;
  enemy.fireAudioPanner = audio.panner;
  enemy.fireAudioGain = audio.gain;

  // Track enemy position each frame
  const obs = g.scene.onBeforeRenderObservable.add(() => {
    if (enemy.fireParticle !== ps) {
      g.scene.onBeforeRenderObservable.remove(obs);
      return;
    }
    const p = enemy.bodyMesh.getAbsolutePosition();
    emitPos.x = p.x;
    emitPos.y = p.y;
    emitPos.z = p.z;
    light.position.copyFrom(p);
    // Flicker
    light.intensity = 1.2 + Math.random() * 0.6;
    // Update audio position
    if (enemy.fireAudioPanner) {
      enemy.fireAudioPanner.positionX.value = p.x;
      enemy.fireAudioPanner.positionY.value = p.y;
      enemy.fireAudioPanner.positionZ.value = p.z;
    }
  });
}

export function disposeFireEffect(enemy: import("./game.js").Enemy): void {
  if (enemy.fireParticle) {
    enemy.fireParticle.stop();
    enemy.fireParticle.dispose(false);
    enemy.fireParticle = null;
  }
  if (enemy.fireLight) {
    enemy.fireLight.dispose();
    enemy.fireLight = null;
  }
  if (enemy.fireAudioSource) {
    if (enemy.fireAudioGain) {
      stopFireSound(enemy.fireAudioSource, enemy.fireAudioGain);
    } else {
      try {
        enemy.fireAudioSource.stop();
      } catch (_) {
        /* already stopped */
      }
    }
    enemy.fireAudioSource = null;
    enemy.fireAudioPanner = null;
    enemy.fireAudioGain = null;
  }
  enemy.onFire = false;
}

export function spawnLaserBeam(
  from: Vector3,
  to: Vector3,
  isCrit = false,
): void {
  const dist = Vector3.Distance(from, to);
  if (dist < 0.05) return;

  playLaserSound((effectiveCooldown() * 0.6) / 1000);

  const beam = makeBeam(from, to);
  const mat = beam.material as StandardMaterial;
  if (isCrit) {
    mat.diffuseColor = new Color3(0.6, 0, 1);
    mat.emissiveColor = new Color3(0.5, 0, 0.9);
  }
  const beamHeatMax = effectiveHeatMax();
  const critHeat = beamHeatMax * HEAT.critical;
  if (g.state.heat >= critHeat) {
    const t = (g.state.heat - critHeat) / (beamHeatMax - critHeat);
    mat.alpha = 1 - t * 0.6;
    mat.emissiveColor = Color3.Lerp(
      mat.emissiveColor,
      new Color3(0.2, 0.3, 0.3),
      t,
    );
  }
  setTimeout(() => beam.dispose(), effectiveCooldown() * 0.6);
}

export function spawnBulletHole(
  position: Vector3,
  normal: Vector3 | null,
  parentMesh?: Mesh,
  opts?: {
    color?: Color3;
    glow?: boolean;
  },
): void {
  if (!parentMesh && g.bulletHoles.length >= 200) {
    g.bulletHoles.shift()!.dispose();
    g.bulletHoleTimes.shift();
  }

  const disc = makeBulletHoleDisc();
  const mat = disc.material as StandardMaterial;
  const color = opts?.color;
  if (color) {
    mat.diffuseColor = color;
    mat.emissiveColor = Color3.Black();
  } else {
    mat.emissiveColor = new Color3(1, 0.9, 0.2);
  }
  const n = normal ?? Vector3.Up();
  const worldPos = position.add(n.scale(BULLET_HOLE_SURFACE_OFFSET));

  if (parentMesh) {
    const invWorld = parentMesh.getWorldMatrix().clone().invert();
    disc.parent = parentMesh;
    disc.position = Vector3.TransformCoordinates(worldPos, invWorld);
    disc.lookAt(Vector3.TransformCoordinates(position.add(n), invWorld));
  } else {
    disc.position = worldPos;
    disc.lookAt(position.add(n));
    g.bulletHoles.push(disc);
    g.bulletHoleTimes.push(60_000);
  }
  if (opts?.glow !== false) {
    g.glowingHoles.push({ mesh: disc, time: BULLET_HOLE.glowMs });
  }
}

// ─── Kill / Ragdoll (moved from update.ts) ──────────────────────────────────

export function killEnemy(
  enemy: Enemy,
  killMesh: Mesh,
  hitPoint?: Vector3,
  orbKill = false,
): void {
  const bodyWorldPos = enemy.bodyMesh.getAbsolutePosition().clone();
  playEnemyDeathSound(bodyWorldPos);
  const headWorldPos = enemy.headMesh.getAbsolutePosition().clone();
  const isHeadshot = killMesh.name === "enemyHead";

  spawnDeathParticle(isHeadshot ? headWorldPos : bodyWorldPos);

  if (enemy.flashMesh) {
    (enemy.flashMesh.material as StandardMaterial).emissiveColor =
      enemy.baseEmissive.clone();
    enemy.flashMesh = null;
  }

  // Clean up fire effects and health bar
  const wasBurning = enemy.onFire;
  disposeFireEffect(enemy);
  disposeEnemyHealthBar(enemy);

  // Blacken body parts if enemy died while on fire
  const blacken = (mat: StandardMaterial) => {
    if (!wasBurning) return;
    mat.diffuseColor = new Color3(0.05, 0.05, 0.05);
    mat.emissiveColor = new Color3(0.08, 0.03, 0.0);
    mat.specularColor = new Color3(0.02, 0.02, 0.02);
  };

  const limbs: {
    mesh: Mesh;
    pos: Vector3;
    name: string;
    splitFn: (p: Vector3, m: StandardMaterial) => [Mesh, Mesh];
    makeAgg: (m: Mesh) => PhysicsAggregate;
    mass: number;
  }[] = [];
  for (const pivot of [enemy.leftLeg, enemy.rightLeg]) {
    const box = pivot.getChildMeshes()[0] as Mesh;
    const wPos = box.getAbsolutePosition().clone();
    box.parent = null;
    box.position = wPos;
    pivot.dispose();
    limbs.push({
      mesh: box,
      pos: wPos,
      name: "enemyLeg",
      splitFn: makeLegSplitHalves,
      makeAgg: makeRagdollLegAggregate,
      mass: 2,
    });
  }
  for (const pivot of [enemy.leftArm, enemy.rightArm]) {
    const box = pivot.getChildMeshes()[0] as Mesh;
    const wPos = box.getAbsolutePosition().clone();
    box.parent = null;
    box.position = wPos;
    pivot.dispose();
    limbs.push({
      mesh: box,
      pos: wPos,
      name: "enemyArm",
      splitFn: makeArmSplitHalves,
      makeAgg: makeRagdollArmAggregate,
      mass: 1,
    });
  }

  enemy.bodyMesh.parent = null;
  enemy.bodyMesh.position = bodyWorldPos;
  enemy.headMesh.parent = null;
  enemy.headMesh.position = headWorldPos;
  enemy.visualRoot.dispose();

  // Blacken all parts if burned to death
  if (wasBurning) {
    blacken(enemy.bodyMesh.material as StandardMaterial);
    blacken(enemy.headMesh.material as StandardMaterial);
    for (const l of limbs) blacken(l.mesh.material as StandardMaterial);
  }

  enemy.aggregate.dispose();
  enemy.physMesh.dispose();
  g.enemies.splice(g.enemies.indexOf(enemy), 1);

  const awayDir = hitPoint
    ? new Vector3(
        bodyWorldPos.x - hitPoint.x,
        0,
        bodyWorldPos.z - hitPoint.z,
      ).normalizeToNew()
    : new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalizeToNew();

  const splitPart = (
    mesh: Mesh,
    pos: Vector3,
    splitFn: (p: Vector3, m: StandardMaterial) => [Mesh, Mesh],
    mass: number,
    impulseScale: number,
  ) => {
    const mat = mesh.material as StandardMaterial;
    mesh.dispose();
    const [top, bot] = splitFn(pos, mat);
    const topAgg = makeRagdollHalfAggregate(top, mass);
    topAgg.body.applyImpulse(
      new Vector3(
        awayDir.x * impulseScale,
        impulseScale * 0.8,
        awayDir.z * impulseScale,
      ),
      pos,
    );
    const botAgg = makeRagdollHalfAggregate(bot, mass);
    botAgg.body.applyImpulse(
      new Vector3(
        awayDir.x * impulseScale * 0.6,
        -2,
        awayDir.z * impulseScale * 0.6,
      ),
      pos,
    );
    setTimeout(() => {
      topAgg.dispose();
      top.dispose();
      botAgg.dispose();
      bot.dispose();
    }, 3500);
  };

  const ragdollPiece = (
    mesh: Mesh,
    pos: Vector3,
    makeAgg: (m: Mesh) => PhysicsAggregate,
    impulse: Vector3,
  ) => {
    const agg = makeAgg(mesh);
    agg.body.applyImpulse(impulse, pos);
    setTimeout(() => {
      agg.dispose();
      mesh.dispose();
    }, 3500);
  };

  const killName = killMesh.name;

  if (orbKill) {
    splitPart(enemy.bodyMesh, bodyWorldPos, makeBodySplitHalves, 5, 22);
    splitPart(enemy.headMesh, headWorldPos, makeHeadSplitHalves, 1, 4);
    for (const l of limbs) splitPart(l.mesh, l.pos, l.splitFn, l.mass, 6);
  } else if (isHeadshot) {
    splitPart(enemy.headMesh, headWorldPos, makeHeadSplitHalves, 1, 4);
    ragdollPiece(
      enemy.bodyMesh,
      bodyWorldPos,
      makeRagdollBodyAggregate,
      awayDir.scale(40).addInPlaceFromFloats(0, 5, 0),
    );
    for (const l of limbs)
      ragdollPiece(
        l.mesh,
        l.pos,
        l.makeAgg,
        new Vector3(awayDir.x * 10, 3 + Math.random() * 3, awayDir.z * 10),
      );
  } else if (killName === "enemyArm" || killName === "enemyLeg") {
    for (const l of limbs) {
      if (l.mesh === killMesh) {
        splitPart(l.mesh, l.pos, l.splitFn, l.mass, 6);
      } else {
        ragdollPiece(
          l.mesh,
          l.pos,
          l.makeAgg,
          new Vector3(awayDir.x * 10, 3 + Math.random() * 3, awayDir.z * 10),
        );
      }
    }
    ragdollPiece(
      enemy.bodyMesh,
      bodyWorldPos,
      makeRagdollBodyAggregate,
      awayDir.scale(40).addInPlaceFromFloats(0, 5, 0),
    );
    ragdollPiece(
      enemy.headMesh,
      headWorldPos,
      makeRagdollHeadAggregate,
      new Vector3(
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 4,
        (Math.random() - 0.5) * 8,
      ),
    );
  } else {
    splitPart(enemy.bodyMesh, bodyWorldPos, makeBodySplitHalves, 5, 22);
    ragdollPiece(
      enemy.headMesh,
      headWorldPos,
      makeRagdollHeadAggregate,
      new Vector3(
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 4,
        (Math.random() - 0.5) * 8,
      ),
    );
    for (const l of limbs)
      ragdollPiece(
        l.mesh,
        l.pos,
        l.makeAgg,
        new Vector3(awayDir.x * 10, 3 + Math.random() * 3, awayDir.z * 10),
      );
  }

  g.state.kills++;
  incrementScore(
    isHeadshot ? Math.round(SCORING.kill * 1.5) : SCORING.kill,
    hitPoint,
  );
}

export function splitRagdoll(
  mesh: Mesh,
  beamDir: Vector3,
  hitPoint?: Vector3,
): void {
  const worldPos = mesh.getAbsolutePosition().clone();
  const mat = mesh.material as StandardMaterial;
  const name = mesh.name;

  if (mesh.physicsBody) mesh.physicsBody.dispose();
  mesh.dispose();

  const awayDir = hitPoint
    ? new Vector3(
        worldPos.x - hitPoint.x,
        0,
        worldPos.z - hitPoint.z,
      ).normalizeToNew()
    : beamDir.normalize();

  let topHalf: Mesh, bottomHalf: Mesh;
  if (name === "enemyHead") {
    [topHalf, bottomHalf] = makeHeadSplitHalves(worldPos, mat);
  } else if (name === "enemyArm") {
    [topHalf, bottomHalf] = makeArmSplitHalves(worldPos, mat);
  } else if (name === "enemyLeg") {
    [topHalf, bottomHalf] = makeLegSplitHalves(worldPos, mat);
  } else {
    [topHalf, bottomHalf] = makeBodySplitHalves(worldPos, mat);
  }

  const topAgg = makeRagdollHalfAggregate(topHalf, 1);
  topAgg.body.applyImpulse(
    new Vector3(awayDir.x * 4, 6 + Math.random() * 3, awayDir.z * 4),
    worldPos,
  );
  const bottomAgg = makeRagdollHalfAggregate(bottomHalf, 1);
  bottomAgg.body.applyImpulse(
    new Vector3(awayDir.x * 2, 1 + Math.random() * 2, awayDir.z * 2),
    worldPos,
  );

  setTimeout(() => {
    topAgg.dispose();
    topHalf.dispose();
    bottomAgg.dispose();
    bottomHalf.dispose();
  }, 3500);

  if (hitPoint)
    spawnHitParticle(hitPoint, new Color4(0.8, 0.0, 0.0, 1), beamDir.negate());

  incrementScore(1, hitPoint);
}

export function hitDebris(
  mesh: Mesh,
  beamDir: Vector3,
  hitPoint?: Vector3,
): void {
  const shrink = 0.75;
  mesh.scaling.scaleInPlace(shrink);

  const body = mesh.physicsBody;
  if (body && hitPoint) {
    const pushForce = beamDir.normalize().scale(12);
    body.applyImpulse(pushForce, hitPoint);
  }

  if (mesh.scaling.x < 0.15) {
    if (mesh.physicsBody) {
      mesh.physicsBody.dispose();
    }
    mesh.dispose();
  }

  incrementScore(1, hitPoint);
}
