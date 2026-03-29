import { Vector3, MeshBuilder, StandardMaterial, Mesh, Color3, PhysicsAggregate, PhysicsShapeType, Quaternion } from "@babylonjs/core";
import { PLAYER_SPAWN_Y, ARENA_SIZE, ARENA_CEIL, PLAYER_ORB_RADIUS } from "./constants.js";
import { g } from "./game.js";

// ─── Mesh definitions ────────────────────────────────────────────────────────

// Player
const PLAYER_MESH = {
  capsule: { height: 1.8, radius: 0.4 },
};

// Arena
const ARENA = {
  room: ARENA_SIZE,
  ceil: ARENA_CEIL,

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
      [-10, -10], [-10, 10], [10, -10], [10, 10],
      [-20, 0], [20, 0], [0, -20], [0, 20],
      [-18, -18], [-18, 18], [18, -18], [18, 18],
    ] as [number, number][],
  },

  crate: {
    size: 1,
    diffuse: new Color3(0.45, 0.32, 0.18),
    positions: [
      [5, 0.5, 8],    [-7, 0.5, 5],    [10, 0.5, -6],   [-5, 0.5, -10],
      [5, 1.5, 8],    [-14, 0.5, 12],  [15, 0.5, -3],   [-3, 0.5, -16],
      [12, 0.5, 14],  [-16, 0.5, -8],  [8, 0.5, -15],   [-12, 0.5, -14],
      [18, 0.5, 10],  [-8, 0.5, 18],   [0, 0.5, -12],   [14, 0.5, 5],
      [-16, 0.5, -8], [-16, 1.5, -8],  [12, 0.5, 14],   [12, 1.5, 14],
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

// Enemy
const ENEMY_COLOR = new Color3(0.45, 0.45, 0.45);

const ENEMY_MESH = {
  capsule: { height: 2.2, radius: 0.4 } as const,
  body: { width: 0.8, height: 1.1, depth: 0.3 } as const,
  bodyOffset: new Vector3(0, 0.15, 0),
  head: { height: 0.55, radius: 0.22 } as const,
  headOffset: new Vector3(0, 0.887, 0),
  leg: { width: 0.2, height: 0.8, depth: 0.2 } as const,
  legOffsetY: -0.4,   // top of leg (pivot) relative to capsule center
  legSpacing: 0.18,   // lateral offset from center
  arm: { width: 0.15, height: 0.7, depth: 0.15 } as const,
  armOffsetY: 0.65,   // shoulder height (body top is ~0.7)
  armSpacing: 0.48,   // just touching body edge (body half-width 0.4 + arm half-width 0.075)
};

// Laser beam
const LASER_BEAM = {
  radius: 0.014,
  tessellation: 6,
  diffuse: new Color3(0, 1, 1),
  emissive: new Color3(0, 0.9, 1),
};

// Bullet hole
const BULLET_HOLE = {
  radius: 0.08,
  tessellation: 8,
  surfaceOffset: 0.01,
  diffuse: new Color3(0.05, 0.05, 0.05),
  emissive: new Color3(0.02, 0.02, 0.02),
};

// ─── Arena materials (private) ────────────────────────────────────────────────
function makeFloorMat(): StandardMaterial {
  const mat = new StandardMaterial("floor", g.scene);
  mat.diffuseColor = ARENA.floor.diffuse;
  mat.specularColor = ARENA.floor.specular;
  return mat;
}

function makeWallMat(): StandardMaterial {
  const mat = new StandardMaterial("wall", g.scene);
  mat.diffuseColor = ARENA.wall.diffuse;
  mat.specularColor = ARENA.wall.specular;
  return mat;
}

function makeCeilMat(): StandardMaterial {
  const mat = new StandardMaterial("ceil", g.scene);
  mat.diffuseColor = ARENA.ceiling.diffuse;
  return mat;
}

function makeAccentMat(): StandardMaterial {
  const mat = new StandardMaterial("accent", g.scene);
  mat.diffuseColor = ARENA.accentStrip.diffuse;
  mat.emissiveColor = ARENA.accentStrip.emissive;
  return mat;
}

function makeCrateMat(): StandardMaterial {
  const mat = new StandardMaterial("crate", g.scene);
  mat.diffuseColor = ARENA.crate.diffuse;
  return mat;
}

// ─── Arena meshes (private) ───────────────────────────────────────────────────
function makeFloor(): Mesh {
  return MeshBuilder.CreateBox("floor", { width: ARENA.room, height: ARENA.floor.size.height, depth: ARENA.room }, g.scene);
}

function makeCeil(): Mesh {
  return MeshBuilder.CreateBox("ceil", { width: ARENA.room, height: ARENA.ceiling.size.height, depth: ARENA.room }, g.scene);
}

function makeWallBox(w: number, h: number): Mesh {
  return MeshBuilder.CreateBox("wall", { width: w, height: h, depth: ARENA.wall.thickness }, g.scene);
}

function makePillar(): Mesh {
  return MeshBuilder.CreateBox("pillar", { width: ARENA.pillar.size.width, height: ARENA.ceil, depth: ARENA.pillar.size.depth }, g.scene);
}

function makeCrate(): Mesh {
  return MeshBuilder.CreateBox("crate", { size: ARENA.crate.size }, g.scene);
}

function makeAccentStrip(): Mesh {
  return MeshBuilder.CreateBox("strip", { width: ARENA.room - 1, height: ARENA.accentStrip.height, depth: ARENA.accentStrip.depth }, g.scene);
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
  m.position.y = ARENA.ceil + 0.1;
  m.material = makeCeilMat();
  new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  return m;
}

export function setupArenaWalls(): Mesh[] {
  const mat = makeWallMat();
  const ROOM = ARENA.room;
  const CEIL = ARENA.ceil;
  const half = ROOM / 2;
  return [
    [new Vector3(0, CEIL / 2, -half), 0],
    [new Vector3(0, CEIL / 2,  half), 0],
    [new Vector3(-half, CEIL / 2, 0), Math.PI / 2],
    [new Vector3( half, CEIL / 2, 0), Math.PI / 2],
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
  return ARENA.pillar.positions.map(([x, z]) => {
    const m = makePillar();
    m.position = new Vector3(x, ARENA.ceil / 2, z);
    m.material = mat;
    m.receiveShadows = true;
    new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
    return m;
  });
}

export function setupArenaCrates(): Mesh[] {
  const mat = makeCrateMat();
  return ARENA.crate.positions.map(([x, y, z]) => {
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
  const half = ARENA.room / 2;
  const stripInset = half - ARENA.accentStrip.wallInset;
  return [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((rot) => {
    const m = makeAccentStrip();
    m.rotation.y = rot;
    m.position = new Vector3(
      rot === 0 || rot === Math.PI ? 0 : rot > 0 ? stripInset : -stripInset,
      ARENA.accentStrip.yPos,
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

// ─── Weapon setup (exported) ──────────────────────────────────────────────────
export function setupWeaponRoot(): Mesh {
  const root = new Mesh("weaponRoot", g.scene);
  root.parent = g.camera;
  root.position = WEAPON.rootPos.clone();
  root.isPickable = false;
  return root;
}

export function setupWeaponParts(root: Mesh): { cell: Mesh; barrel: Mesh; barrelTip: Mesh } {
  function wp(mesh: Mesh, mat: StandardMaterial, localPos: Vector3, localRotX = 0): Mesh {
    mesh.parent = root;
    mesh.position = localPos;
    mesh.rotation.x = localRotX;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    return mesh;
  }

  wp(makeWeaponBodyMesh(),   makeWeaponBodyMat(),   WEAPON.body.pos.clone());
  const barrel = wp(makeWeaponBarrelMesh(), makeWeaponBarrelMat(), WEAPON.barrel.pos.clone(), WEAPON.barrel.rotX);
  const cell = wp(makeWeaponCellMesh(), makeWeaponCellMat(), WEAPON.cell.pos.clone());
  wp(makeWeaponGripMesh(),   makeWeaponGripMat(),   WEAPON.grip.pos.clone());
  wp(makeWeaponAccentMesh(), makeWeaponAccentMat(), WEAPON.accent.pos.clone());
  wp(makeWeaponLensMesh(),   makeWeaponLensMat(),   WEAPON.lens.pos.clone());

  const barrelTip = new Mesh("wBarrelTip", g.scene);
  barrelTip.parent = root;
  barrelTip.position = WEAPON.barrelTipPos.clone();
  barrelTip.isVisible = false;
  barrelTip.isPickable = false;

  return { cell, barrel, barrelTip };
}

// ─── Player mesh (exported) ───────────────────────────────────────────────────
export function makePlayerMesh(): { mesh: Mesh; aggregate: PhysicsAggregate } {
  const mesh = MeshBuilder.CreateCapsule("player", PLAYER_MESH.capsule, g.scene);
  mesh.position.y = PLAYER_SPAWN_Y;
  mesh.isVisible = false;
  const aggregate = new PhysicsAggregate(mesh, PhysicsShapeType.CAPSULE, { mass: 70, friction: 0.7, restitution: 0 }, g.scene);
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

export function makeEnemyMats(): { bodyMat: StandardMaterial; headMat: StandardMaterial } {
  const bodyMat = makeEnemyMat();
  const headMat = bodyMat.clone("emat_head") as StandardMaterial;
  return { bodyMat, headMat };
}

export function makeEnemyPhysCapsule(position: Vector3): { mesh: Mesh; aggregate: PhysicsAggregate } {
  const mesh = MeshBuilder.CreateCapsule("enemyPhys", ENEMY_MESH.capsule, g.scene);
  mesh.isVisible = false;
  mesh.position = position;
  const aggregate = new PhysicsAggregate(mesh, PhysicsShapeType.CAPSULE, { mass: 10, friction: 0.7, restitution: 0 }, g.scene);
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
  const leg = MeshBuilder.CreateBox("enemyLeg", { width, height, depth }, g.scene);
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
  const arm = MeshBuilder.CreateBox("enemyArm", { width, height, depth }, g.scene);
  arm.parent = pivot;
  arm.position = new Vector3(0, -height / 2, 0);
  return pivot;
}

export function makeEnemyHeadMesh(): Mesh {
  const { height, radius } = ENEMY_MESH.head;
  const mesh = MeshBuilder.CreateCapsule("enemyHead", { height, radius, capSubdivisions: 6, subdivisions: 1, tessellation: 12 }, g.scene);
  // Truncate the bottom cap — flatten all vertices below the cutoff
  const cutY = -height / 2 + radius * 0.4;
  const positions = mesh.getVerticesData("position")!;
  for (let i = 1; i < positions.length; i += 3) {
    if (positions[i] < cutY) positions[i] = cutY;
  }
  mesh.setVerticesData("position", positions);
  mesh.position = ENEMY_MESH.headOffset.clone();
  return mesh;
}

// ─── Ragdoll split halves (exported) ─────────────────────────────────────────
export function makeBodySplitHalves(worldPos: Vector3, mat: StandardMaterial): [Mesh, Mesh] {
  const { width, depth } = ENEMY_MESH.body;
  const halfH = ENEMY_MESH.body.height / 2;

  const top = MeshBuilder.CreateBox("bodyHalf", { width, height: halfH, depth }, g.scene);
  top.position = new Vector3(worldPos.x, worldPos.y + halfH / 2, worldPos.z);
  top.material = mat;

  const bottom = MeshBuilder.CreateBox("bodyHalf", { width, height: halfH, depth }, g.scene);
  bottom.position = new Vector3(worldPos.x, worldPos.y - halfH / 2, worldPos.z);
  bottom.material = mat;

  return [top, bottom];
}

export function makeHeadSplitHalves(worldPos: Vector3, mat: StandardMaterial): [Mesh, Mesh] {
  const { height, radius } = ENEMY_MESH.head;
  const halfH = height / 2;

  const top = MeshBuilder.CreateCapsule("headHalf", { height: halfH, radius, capSubdivisions: 6, subdivisions: 1, tessellation: 12 }, g.scene);
  top.position = new Vector3(worldPos.x, worldPos.y + halfH / 4, worldPos.z);
  top.material = mat;

  const bottom = MeshBuilder.CreateCapsule("headHalf", { height: halfH, radius, capSubdivisions: 6, subdivisions: 1, tessellation: 12 }, g.scene);
  bottom.position = new Vector3(worldPos.x, worldPos.y - halfH / 4, worldPos.z);
  bottom.material = mat;

  return [top, bottom];
}

function makeLimbSplitHalves(name: string, dims: { width: number; height: number; depth: number }, worldPos: Vector3, mat: StandardMaterial): [Mesh, Mesh] {
  const halfH = dims.height / 2;
  const top = MeshBuilder.CreateBox(name, { width: dims.width, height: halfH, depth: dims.depth }, g.scene);
  top.position = new Vector3(worldPos.x, worldPos.y + halfH / 2, worldPos.z);
  top.material = mat;
  const bottom = MeshBuilder.CreateBox(name, { width: dims.width, height: halfH, depth: dims.depth }, g.scene);
  bottom.position = new Vector3(worldPos.x, worldPos.y - halfH / 2, worldPos.z);
  bottom.material = mat;
  return [top, bottom];
}

export function makeArmSplitHalves(worldPos: Vector3, mat: StandardMaterial): [Mesh, Mesh] {
  return makeLimbSplitHalves("armHalf", ENEMY_MESH.arm, worldPos, mat);
}

export function makeLegSplitHalves(worldPos: Vector3, mat: StandardMaterial): [Mesh, Mesh] {
  return makeLimbSplitHalves("legHalf", ENEMY_MESH.leg, worldPos, mat);
}

// ─── Lamppost (exported) ─────────────────────────────────────────────────────
export function setupLamppost(): { pole: Mesh; lightY: number } {
  const lampY = ARENA_CEIL - 0.3;

  const poleMat = new StandardMaterial("poleMat", g.scene);
  poleMat.diffuseColor = new Color3(0.2, 0.2, 0.22);
  poleMat.specularColor = new Color3(0.4, 0.4, 0.4);

  const pole = MeshBuilder.CreateCylinder("pole", { diameter: 0.15, height: lampY }, g.scene);
  pole.position.y = lampY / 2;
  pole.material = poleMat;
  new PhysicsAggregate(pole, PhysicsShapeType.CYLINDER, { mass: 0 }, g.scene);

  const head = MeshBuilder.CreateCylinder("lampHead", { diameterTop: 0.1, diameterBottom: 0.8, height: 0.4, tessellation: 8 }, g.scene);
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
export function makeHealthSupply(position: Vector3): { mesh: Mesh; aggregate: PhysicsAggregate } {
  const mat = new StandardMaterial("supplyMat", g.scene);
  mat.diffuseColor = new Color3(0.1, 0.9, 0.2);
  mat.emissiveColor = new Color3(0.1, 0.6, 0.1);
  const mesh = MeshBuilder.CreateSphere("supply", { diameter: 0.4 }, g.scene);
  mesh.position = position.clone();
  mesh.position.y = Math.max(mesh.position.y, 0.3);
  mesh.material = mat;
  mesh.isPickable = false;
  const aggregate = new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 1, friction: 0.8, restitution: 0.2 }, g.scene);
  return { mesh, aggregate };
}

export function makeAmmoSupply(position: Vector3): { mesh: Mesh; aggregate: PhysicsAggregate } {
  const mat = new StandardMaterial("supplyMat", g.scene);
  mat.diffuseColor = WEAPON.cell.diffuse.clone();
  mat.emissiveColor = WEAPON.cell.emissive.clone();
  const s = WEAPON.cell.size;
  const mesh = MeshBuilder.CreateBox("supply", { width: s.width * 4, height: s.height * 4, depth: s.depth * 4 }, g.scene);
  mesh.position = position.clone();
  mesh.position.y = Math.max(mesh.position.y, 0.3);
  mesh.material = mat;
  mesh.isPickable = false;
  const aggregate = new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 1, friction: 0.8, restitution: 0.2 }, g.scene);
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
    { path: [from, to], radius: LASER_BEAM.radius, tessellation: LASER_BEAM.tessellation, updatable: false, cap: 0 },
    g.scene,
  );
  beam.material = mat;
  beam.isPickable = false;
  return beam;
}

// ─── Ragdoll physics helpers (exported) ──────────────────────────────────────
export function makeRagdollBodyAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 8, friction: 0.6, restitution: 0.05 }, g.scene);
}

export function makeRagdollHeadAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(mesh, PhysicsShapeType.CAPSULE, { mass: 2, friction: 0.5, restitution: 0.3 }, g.scene);
}

export function makeRagdollArmAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 1, friction: 0.6, restitution: 0.05 }, g.scene);
}

export function makeRagdollLegAggregate(mesh: Mesh): PhysicsAggregate {
  return new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 2, friction: 0.6, restitution: 0.05 }, g.scene);
}

export function makeRagdollHalfAggregate(mesh: Mesh, mass: number): PhysicsAggregate {
  return new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass, friction: 0.6, restitution: 0.05 }, g.scene);
}

// ─── Bullet hole (exported) ───────────────────────────────────────────────────
export const BULLET_HOLE_SURFACE_OFFSET = BULLET_HOLE.surfaceOffset;

export function makeBulletHoleDisc(): Mesh {
  const mat = new StandardMaterial("bholeMat", g.scene);
  mat.diffuseColor = BULLET_HOLE.diffuse;
  mat.emissiveColor = BULLET_HOLE.emissive;
  mat.backFaceCulling = false;
  const disc = MeshBuilder.CreateDisc(
    "bhole",
    { radius: BULLET_HOLE.radius, tessellation: BULLET_HOLE.tessellation },
    g.scene,
  );
  disc.material = mat;
  disc.isPickable = false;
  return disc;
}

// ─── Orb projectile (exported) ──────────────────────────────────────────────
export function makeOrbMesh(pos: Vector3): Mesh {
  const mat = new StandardMaterial("orbMat", g.scene);
  mat.diffuseColor = new Color3(0, 1, 1);
  mat.emissiveColor = new Color3(0, 0.9, 1);
  mat.disableLighting = true;
  const orb = MeshBuilder.CreateSphere(
    "orb",
    { diameter: PLAYER_ORB_RADIUS * 2, segments: 8 },
    g.scene,
  );
  orb.material = mat;
  orb.position = pos.clone();
  orb.isPickable = false;
  return orb;
}

export function makeOrbChargeMesh(): Mesh {
  const mat = new StandardMaterial("orbChargeMat", g.scene);
  mat.diffuseColor = new Color3(0, 1, 1);
  mat.emissiveColor = new Color3(0, 0.9, 1);
  mat.disableLighting = true;
  mat.alpha = 0.5;
  const orb = MeshBuilder.CreateSphere(
    "orbCharge",
    { diameter: PLAYER_ORB_RADIUS * 2, segments: 8 },
    g.scene,
  );
  orb.material = mat;
  orb.renderingGroupId = 1;
  orb.parent = g.barrelTip;
  orb.position.setAll(0);
  orb.isPickable = false;
  return orb;
}
