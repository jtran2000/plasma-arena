import { Vector3, MeshBuilder, StandardMaterial, Mesh, Color3 } from "@babylonjs/core";
import { PLAYER_SPAWN_Y, ARENA_CEIL } from "./constants.js";
import { PLAYER_MESH, ARENA, WEAPON, ENEMY_COLOR, ENEMY_MESH, LASER_BEAM, BULLET_HOLE } from "./meshDefs.js";
import { g } from "./game.js";

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
  return m;
}

export function setupArenaCeil(): Mesh {
  const m = makeCeil();
  m.position.y = ARENA.ceil + 0.1;
  m.material = makeCeilMat();
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

export function setupWeaponParts(root: Mesh): { cell: Mesh; barrelTip: Mesh } {
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
  wp(makeWeaponBarrelMesh(), makeWeaponBarrelMat(), WEAPON.barrel.pos.clone(), WEAPON.barrel.rotX);
  const cell = wp(makeWeaponCellMesh(), makeWeaponCellMat(), WEAPON.cell.pos.clone());
  wp(makeWeaponGripMesh(),   makeWeaponGripMat(),   WEAPON.grip.pos.clone());
  wp(makeWeaponAccentMesh(), makeWeaponAccentMat(), WEAPON.accent.pos.clone());
  wp(makeWeaponLensMesh(),   makeWeaponLensMat(),   WEAPON.lens.pos.clone());

  const barrelTip = new Mesh("wBarrelTip", g.scene);
  barrelTip.parent = root;
  barrelTip.position = WEAPON.barrelTipPos.clone();
  barrelTip.isVisible = false;
  barrelTip.isPickable = false;

  return { cell, barrelTip };
}

// ─── Player mesh (exported) ───────────────────────────────────────────────────
export function makePlayerMesh(): Mesh {
  const mesh = MeshBuilder.CreateCapsule("player", PLAYER_MESH.capsule, g.scene);
  mesh.position.y = PLAYER_SPAWN_Y;
  mesh.isVisible = false;
  return mesh;
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

export function makeEnemyPhysCapsule(): Mesh {
  const mesh = MeshBuilder.CreateCapsule("enemyPhys", ENEMY_MESH.capsule, g.scene);
  mesh.isVisible = false;
  return mesh;
}

export function makeEnemyBodyMesh(): Mesh {
  return MeshBuilder.CreateBox("enemyBody", ENEMY_MESH.body, g.scene);
}

export function makeEnemyHeadMesh(): Mesh {
  const mesh = MeshBuilder.CreateSphere("enemyHead", ENEMY_MESH.head, g.scene);
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
  const d = ENEMY_MESH.head.diameter;

  const top = MeshBuilder.CreateSphere("headHalf", { diameter: d, slice: 0.5 }, g.scene);
  top.rotation.x = Math.PI;
  top.position = worldPos.clone();
  top.material = mat;

  const bottom = MeshBuilder.CreateSphere("headHalf", { diameter: d, slice: 0.5 }, g.scene);
  bottom.position = worldPos.clone();
  bottom.material = mat;

  return [top, bottom];
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

// ─── Pickups (exported) ──────────────────────────────────────────────────────
export function makeHealthPickupMesh(position: Vector3): Mesh {
  const mat = new StandardMaterial("pickupMat", g.scene);
  mat.diffuseColor = new Color3(0.1, 0.9, 0.2);
  mat.emissiveColor = new Color3(0.1, 0.6, 0.1);
  const mesh = MeshBuilder.CreateSphere("pickup", { diameter: 0.4 }, g.scene);
  mesh.position = position.clone();
  mesh.position.y = Math.max(mesh.position.y, 0.3);
  mesh.material = mat;
  mesh.isPickable = false;
  return mesh;
}

export function makeAmmoPickupMesh(position: Vector3): Mesh {
  const mat = new StandardMaterial("pickupMat", g.scene);
  mat.diffuseColor = WEAPON.cell.diffuse.clone();
  mat.emissiveColor = WEAPON.cell.emissive.clone();
  const s = WEAPON.cell.size;
  const mesh = MeshBuilder.CreateBox("pickup", { width: s.width * 4, height: s.height * 4, depth: s.depth * 4 }, g.scene);
  mesh.position = position.clone();
  mesh.position.y = Math.max(mesh.position.y, 0.3);
  mesh.material = mat;
  mesh.isPickable = false;
  return mesh;
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
