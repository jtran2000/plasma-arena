import {
  Scene,
  UniversalCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Color3,
  Color4,
  ShadowGenerator,
  DynamicTexture,
  HavokPlugin,
  PhysicsAggregate,
  PhysicsShapeType,
  Quaternion,
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { ENEMY_HP, ENEMY_SPEED } from "./constants.js";
import { g } from "./game.js";
import {
  makePlayerMesh,
  setupArenaFloor, setupArenaCeil, setupArenaWalls, setupArenaPillars, setupArenaCrates, setupArenaAccentStrips,
  setupWeaponRoot, setupWeaponParts,
  makeEnemyMats, makeEnemyPhysCapsule, makeEnemyBodyMesh, makeEnemyHeadMesh,
} from "./meshBuilders.js";

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

  g.playerMesh = makePlayerMesh();
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
  new PhysicsAggregate(setupArenaFloor(), PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  new PhysicsAggregate(setupArenaCeil(), PhysicsShapeType.BOX, { mass: 0 }, g.scene);

  for (const wall of setupArenaWalls()) {
    new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  }

  for (const pillar of setupArenaPillars()) {
    g.shadowGenerator.addShadowCaster(pillar);
    new PhysicsAggregate(pillar, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  }

  for (const crate of setupArenaCrates()) {
    g.shadowGenerator.addShadowCaster(crate);
    new PhysicsAggregate(crate, PhysicsShapeType.BOX, { mass: 0 }, g.scene);
  }

  setupArenaAccentStrips();
}

// ─── Weapon model ─────────────────────────────────────────────────────────────
function buildWeapon(): void {
  g.weaponRoot = setupWeaponRoot();
  const { cell, barrelTip } = setupWeaponParts(g.weaponRoot);
  g.weaponCell = cell;
  g.barrelTip = barrelTip;
}

// ─── Enemy spawning ───────────────────────────────────────────────────────────
export function spawnEnemy(): void {
  const angle = Math.random() * Math.PI * 2;
  const dist = 8 + Math.random() * 10;

  const physMesh = makeEnemyPhysCapsule();
  physMesh.position = new Vector3(Math.cos(angle) * dist, 0.8, Math.sin(angle) * dist);

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

  const { bodyMat, headMat } = makeEnemyMats();

  const bodyMesh = makeEnemyBodyMesh();
  bodyMesh.parent = physMesh;
  bodyMesh.position = Vector3.Zero();
  bodyMesh.material = bodyMat;

  const head = makeEnemyHeadMesh();
  head.parent = physMesh;
  head.material = headMat;

  g.shadowGenerator.addShadowCaster(bodyMesh);
  g.shadowGenerator.addShadowCaster(head);

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
    flashMesh: null,
    baseEmissive: bodyMat.diffuseColor.scale(0.2),
  });
}
