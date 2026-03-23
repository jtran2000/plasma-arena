import {
  Scene,
  UniversalCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  ShadowGenerator,
  Mesh,
  DynamicTexture,
  HavokPlugin,
  PhysicsAggregate,
  PhysicsShapeType,
  Quaternion,
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { ENEMY_HP, ENEMY_SPEED } from "./constants.js";
import {
  PLAYER_MESH as PLAYER_MESH_DEF,
  ARENA,
  WEAPON,
  ENEMY_COLORS,
  ENEMY_MESH,
} from "./meshDefs.js";
import { g } from "./game.js";

// ─── Scene builder ────────────────────────────────────────────────────────────
export async function buildScene(): Promise<void> {
  if (g.scene) g.scene.dispose();
  g.enemies = [];
  g.bulletHoles = [];
  g.respawnTimers = [];
  g.bulletHoleTimes = [];
  g.playerVelocityXZ = Vector3.Zero();
  g.pressedKeys.clear();

  g.scene = new Scene(g.engine);
  g.scene.setRenderingAutoClearDepthStencil(1, true);
  g.scene.clearColor = new Color4(0.05, 0.05, 0.1, 1);
  g.scene.fogMode = Scene.FOGMODE_EXP2;
  g.scene.fogColor = new Color3(0.05, 0.05, 0.1);
  g.scene.fogDensity = 0.035;

  // Camera must exist before the first render — create before the async Havok await
  g.camera = new UniversalCamera("fps", new Vector3(0, 1.6, 0), g.scene);
  g.camera.setTarget(new Vector3(1, 1.6, 0));
  g.camera.minZ = 0.1;
  g.camera.fov = 1.2;
  g.camera.angularSensibility = 800;
  g.camera.keysUp = g.camera.keysDown = g.camera.keysLeft = g.camera.keysRight = [];

  const havok = await HavokPhysics();
  const havokPlugin = new HavokPlugin(true, havok);
  g.scene.enablePhysics(new Vector3(0, -20, 0), havokPlugin);

  g.playerMesh = MeshBuilder.CreateCapsule("player", PLAYER_MESH_DEF.capsule, g.scene);
  g.playerMesh.position = PLAYER_MESH_DEF.spawnPos.clone();
  g.playerMesh.isVisible = false;
  g.playerAggregate = new PhysicsAggregate(
    g.playerMesh,
    PhysicsShapeType.CAPSULE,
    { mass: 70, friction: 0.7, restitution: 0 },
    g.scene,
  );
  g.playerAggregate.body.setMassProperties({
    mass: 70,
    inertia: Vector3.Zero(),
    inertiaOrientation: Quaternion.Identity(),
  });

  const ambient = new HemisphericLight("amb", new Vector3(0, 1, 0), g.scene);
  ambient.intensity = 0.4;
  ambient.groundColor = new Color3(0.05, 0.05, 0.1);

  const sun = new DirectionalLight("sun", new Vector3(-1, -2, -1), g.scene);
  sun.intensity = 1.2;
  sun.position = new Vector3(10, 20, 10);

  g.shadowGenerator = new ShadowGenerator(1024, sun);
  g.shadowGenerator.useBlurExponentialShadowMap = true;

  g.particleTex = new DynamicTexture("ptex", { width: 32, height: 32 }, g.scene, false);
  const ctx = g.particleTex.getContext();
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, Math.PI * 2);
  ctx.fill();
  g.particleTex.update();

  buildArena();
  for (let i = 0; i < 8; i++) spawnEnemy();
  buildWeapon();
}

// ─── Arena ────────────────────────────────────────────────────────────────────
function buildArena(): void {
  const floorMat = new StandardMaterial("floor", g.scene);
  floorMat.diffuseColor = ARENA.floor.diffuse;
  floorMat.specularColor = ARENA.floor.specular;

  const wallMat = new StandardMaterial("wall", g.scene);
  wallMat.diffuseColor = ARENA.wall.diffuse;
  wallMat.specularColor = ARENA.wall.specular;

  const ceilMat = new StandardMaterial("ceil", g.scene);
  ceilMat.diffuseColor = ARENA.ceiling.diffuse;

  const accentMat = new StandardMaterial("accent", g.scene);
  accentMat.diffuseColor = ARENA.accentStrip.diffuse;
  accentMat.emissiveColor = ARENA.accentStrip.emissive;

  const ROOM = ARENA.room;
  const CEIL = ARENA.ceil;
  const half = ROOM / 2;

  const floor = MeshBuilder.CreateBox(
    "floor",
    { width: ROOM, height: ARENA.floor.size.height, depth: ROOM },
    g.scene,
  );
  floor.position.y = -0.1;
  floor.material = floorMat;
  floor.receiveShadows = true;
  new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, g.scene);

  const ceil = MeshBuilder.CreateBox(
    "ceil",
    { width: ROOM, height: ARENA.ceiling.size.height, depth: ROOM },
    g.scene,
  );
  ceil.position.y = CEIL + 0.1;
  ceil.material = ceilMat;
  new PhysicsAggregate(ceil, PhysicsShapeType.BOX, { mass: 0 }, g.scene);

  function makeWall(pos: Vector3, rotY: number, w: number, h: number): void {
    const m = MeshBuilder.CreateBox(
      "wall",
      { width: w, height: h, depth: ARENA.wall.thickness },
      g.scene,
    );
    m.position = pos;
    m.rotation.y = rotY;
    m.material = wallMat;
    m.receiveShadows = true;
    new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  }

  makeWall(new Vector3(0, CEIL / 2, -half), 0, ROOM, CEIL);
  makeWall(new Vector3(0, CEIL / 2, half), 0, ROOM, CEIL);
  makeWall(new Vector3(-half, CEIL / 2, 0), Math.PI / 2, ROOM, CEIL);
  makeWall(new Vector3(half, CEIL / 2, 0), Math.PI / 2, ROOM, CEIL);

  ARENA.pillar.positions.forEach(([x, z]) => {
    const p = MeshBuilder.CreateBox(
      "pillar",
      { width: ARENA.pillar.size.width, height: CEIL, depth: ARENA.pillar.size.depth },
      g.scene,
    );
    p.position = new Vector3(x, CEIL / 2, z);
    p.material = wallMat;
    p.receiveShadows = true;
    g.shadowGenerator.addShadowCaster(p);
    new PhysicsAggregate(p, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  });

  const crateMat = new StandardMaterial("crate", g.scene);
  crateMat.diffuseColor = ARENA.crate.diffuse;
  ARENA.crate.positions.forEach(([x, y, z]) => {
    const c = MeshBuilder.CreateBox("crate", { size: ARENA.crate.size }, g.scene);
    c.position = new Vector3(x, y, z);
    c.material = crateMat;
    c.receiveShadows = true;
    g.shadowGenerator.addShadowCaster(c);
    new PhysicsAggregate(c, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  });

  const stripInset = half - ARENA.accentStrip.wallInset;
  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach((rot) => {
    const strip = MeshBuilder.CreateBox(
      "strip",
      { width: ROOM - 1, height: ARENA.accentStrip.height, depth: ARENA.accentStrip.depth },
      g.scene,
    );
    strip.rotation.y = rot;
    strip.position = new Vector3(
      rot === 0 || rot === Math.PI ? 0 : rot > 0 ? stripInset : -stripInset,
      ARENA.accentStrip.yPos,
      rot === 0 ? -stripInset : rot === Math.PI ? stripInset : 0,
    );
    strip.material = accentMat;
  });
}

// ─── Weapon model ─────────────────────────────────────────────────────────────
function buildWeapon(): void {
  g.weaponRoot = new Mesh("weaponRoot", g.scene);
  g.weaponRoot.parent = g.camera;
  g.weaponRoot.position = WEAPON.rootPos.clone();
  g.weaponRoot.isPickable = false;

  function wp(mesh: Mesh, mat: StandardMaterial, localPos: Vector3, localRotX = 0): Mesh {
    mesh.parent = g.weaponRoot;
    mesh.position = localPos;
    mesh.rotation.x = localRotX;
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    return mesh;
  }

  const bodyMat = new StandardMaterial("wBodyMat", g.scene);
  bodyMat.diffuseColor = WEAPON.body.diffuse;
  bodyMat.specularColor = WEAPON.body.specular;
  bodyMat.emissiveColor = WEAPON.body.emissive;
  wp(MeshBuilder.CreateBox("wBody", WEAPON.body.size, g.scene), bodyMat, WEAPON.body.pos.clone());

  const barrelMat = new StandardMaterial("wBarrelMat", g.scene);
  barrelMat.diffuseColor = WEAPON.barrel.diffuse;
  barrelMat.specularColor = WEAPON.barrel.specular;
  wp(
    MeshBuilder.CreateCylinder("wBarrel", WEAPON.barrel.size, g.scene),
    barrelMat,
    WEAPON.barrel.pos.clone(),
    WEAPON.barrel.rotX,
  );

  const cellMat = new StandardMaterial("wCellMat", g.scene);
  cellMat.diffuseColor = WEAPON.cell.diffuse;
  cellMat.emissiveColor = WEAPON.cell.emissive;
  g.weaponCell = wp(
    MeshBuilder.CreateBox("wCell", WEAPON.cell.size, g.scene),
    cellMat,
    WEAPON.cell.pos.clone(),
  );

  const gripMat = new StandardMaterial("wGripMat", g.scene);
  gripMat.diffuseColor = WEAPON.grip.diffuse;
  wp(MeshBuilder.CreateBox("wGrip", WEAPON.grip.size, g.scene), gripMat, WEAPON.grip.pos.clone());

  const accentMat = new StandardMaterial("wAccentMat", g.scene);
  accentMat.diffuseColor = WEAPON.accent.diffuse;
  accentMat.emissiveColor = WEAPON.accent.emissive;
  wp(
    MeshBuilder.CreateBox("wAccent", WEAPON.accent.size, g.scene),
    accentMat,
    WEAPON.accent.pos.clone(),
  );

  const lensMat = new StandardMaterial("wLensMat", g.scene);
  lensMat.diffuseColor = WEAPON.lens.diffuse;
  lensMat.emissiveColor = WEAPON.lens.emissive;
  wp(
    MeshBuilder.CreateSphere("wLens", WEAPON.lens.size, g.scene),
    lensMat,
    WEAPON.lens.pos.clone(),
  );

  g.barrelTip = new Mesh("wBarrelTip", g.scene);
  g.barrelTip.parent = g.weaponRoot;
  g.barrelTip.position = WEAPON.barrelTipPos.clone();
  g.barrelTip.isVisible = false;
  g.barrelTip.isPickable = false;
}

// ─── Enemy spawning ───────────────────────────────────────────────────────────
export function spawnEnemy(): void {
  const angle = Math.random() * Math.PI * 2;
  const dist = 8 + Math.random() * 10;

  const physMesh = MeshBuilder.CreateCapsule("enemyPhys", ENEMY_MESH.capsule, g.scene);
  physMesh.position = new Vector3(Math.cos(angle) * dist, 0.8, Math.sin(angle) * dist);
  physMesh.isVisible = false;

  const aggregate = new PhysicsAggregate(
    physMesh,
    PhysicsShapeType.CAPSULE,
    { mass: 10, friction: 0.7, restitution: 0 },
    g.scene,
  );
  aggregate.body.setMassProperties({
    mass: 10,
    inertia: Vector3.Zero(),
    inertiaOrientation: Quaternion.Identity(),
  });

  const mat = new StandardMaterial("emat", g.scene);
  mat.diffuseColor = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
  mat.emissiveColor = mat.diffuseColor.scale(0.2);

  const bodyMesh = MeshBuilder.CreateBox("enemyBody", ENEMY_MESH.body, g.scene);
  bodyMesh.parent = physMesh;
  bodyMesh.position = Vector3.Zero();
  bodyMesh.material = mat;

  const head = MeshBuilder.CreateSphere("enemyHead", ENEMY_MESH.head, g.scene);
  head.parent = physMesh;
  head.position = ENEMY_MESH.headOffset.clone();
  head.material = mat;

  g.shadowGenerator.addShadowCaster(bodyMesh);
  g.shadowGenerator.addShadowCaster(head);

  const baseEmissive = mat.diffuseColor.scale(0.2);

  g.enemies.push({
    physMesh,
    bodyMesh,
    headMesh: head,
    aggregate,
    hp: ENEMY_HP,
    maxHp: ENEMY_HP,
    speed: ENEMY_SPEED,
    state: "patrol",
    patrolTarget: physMesh.position.clone(),
    attackCooldown: 0,
    flashTime: 0,
    baseEmissive,
  });
}
