import {
  ENEMY_HP, ENEMY_SPEED,
  ENEMY_MELEE_RANGE, ENEMY_MELEE_DAMAGE, ENEMY_MELEE_COOLDOWN_MS, ENEMY_CHASE_RANGE,
  ENEMY_SHOT_DAMAGE_MIN, ENEMY_SHOT_DAMAGE_VARIANCE,
  PLAYER_WALK_SPEED, PLAYER_SPRINT_SPEED, PLAYER_ACCELERATION,
} from "./constants.js";
import {
  Engine, Scene, UniversalCamera, Vector3, HemisphericLight, DirectionalLight,
  MeshBuilder, StandardMaterial, Color3, Color4, PointerEventTypes,
  ActionManager, ExecuteCodeAction, ParticleSystem, ShadowGenerator,
  Mesh, AbstractMesh, HavokPlugin, PhysicsAggregate, PhysicsShapeType, Quaternion,
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GameState {
  health: number;
  ammo: number;
  reserve: number;
  score: number;
  kills: number;
  reloading: boolean;
  reloadTimer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  paused: boolean;
}

interface Enemy {
  physMesh: Mesh;           // invisible capsule — physics body
  bodyMesh: Mesh;           // visible box — raycasting + lookAt
  aggregate: PhysicsAggregate;
  hp: number;
  maxHp: number;
  speed: number;
  state: "patrol" | "chase";
  patrolTarget: Vector3;
  attackCooldown: number;
}

// ─── DOM refs ────────────────────────────────────────────────────────────────
function getEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el;
}

const canvas     = getEl("renderCanvas") as HTMLCanvasElement;
const overlay    = getEl("overlay");
const startBtn   = getEl("start-btn");
const hud        = getEl("hud");
const gameOver   = getEl("game-over");
const restartBtn = getEl("restart-btn");

const healthEl     = getEl("health-value");
const ammoEl       = getEl("ammo-value");
const scoreEl      = getEl("score-value");
const killsEl      = getEl("kills-value");
const finalScoreEl  = getEl("final-score");
const hitFlash      = getEl("hit-flash");
const reloadMsg     = getEl("reload-msg");
const pauseScreen   = getEl("pause-screen");

// ─── Game state ───────────────────────────────────────────────────────────────
let state: GameState = makeState();

function makeState(): GameState {
  return {
    health: 100, ammo: 30, reserve: 90,
    score: 0, kills: 0,
    reloading: false, reloadTimer: null, running: false, paused: false,
  };
}

// ─── Babylon globals ──────────────────────────────────────────────────────────
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true });

let scene!: Scene;
let camera!: UniversalCamera;
let shadowGenerator!: ShadowGenerator;
let playerMesh!: Mesh;
let playerAggregate!: PhysicsAggregate;
let playerVelocityXZ = Vector3.Zero();
let enemies: Enemy[]    = [];
let bulletHoles: Mesh[] = [];

// Track which keys are held — read in the render loop
const pressedKeys = new Set<string>();
window.addEventListener("keydown", (e) => pressedKeys.add(e.code));
window.addEventListener("keyup",   (e) => pressedKeys.delete(e.code));

// ─── Scene builder ────────────────────────────────────────────────────────────
async function buildScene(): Promise<void> {
  if (scene) scene.dispose();
  enemies = [];
  bulletHoles = [];
  playerVelocityXZ = Vector3.Zero();
  pressedKeys.clear();

  scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.05, 0.1, 1);
  scene.fogMode    = Scene.FOGMODE_EXP2;
  scene.fogColor   = new Color3(0.05, 0.05, 0.1);
  scene.fogDensity = 0.035;

  // Camera must exist before the first render — create it before the async Havok await
  camera = new UniversalCamera("fps", new Vector3(0, 1.6, 0), scene);
  camera.setTarget(new Vector3(1, 1.6, 0));
  camera.minZ = 0.1;
  camera.fov  = 1.2;
  camera.angularSensibility = 800;
  camera.keysUp = camera.keysDown = camera.keysLeft = camera.keysRight = [];

  // Havok physics (async WASM load)
  const havok = await HavokPhysics();
  const havokPlugin = new HavokPlugin(true, havok);
  scene.enablePhysics(new Vector3(0, -20, 0), havokPlugin);

  // Player physics body (invisible capsule)
  playerMesh = MeshBuilder.CreateCapsule("player", { height: 1.8, radius: 0.4 }, scene);
  playerMesh.position  = new Vector3(0, 0.9, 0);
  playerMesh.isVisible = false;
  playerAggregate = new PhysicsAggregate(
    playerMesh, PhysicsShapeType.CAPSULE,
    { mass: 70, friction: 0.7, restitution: 0 },
    scene,
  );
  // Zero inertia keeps the capsule upright — physics won't tip it over
  playerAggregate.body.setMassProperties({
    mass: 70,
    inertia: Vector3.Zero(),
    inertiaOrientation: Quaternion.Identity(),
  });

  // Lights
  const ambient = new HemisphericLight("amb", new Vector3(0, 1, 0), scene);
  ambient.intensity  = 0.4;
  ambient.groundColor = new Color3(0.05, 0.05, 0.1);

  const sun = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene);
  sun.intensity = 1.2;
  sun.position  = new Vector3(10, 20, 10);

  shadowGenerator = new ShadowGenerator(1024, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;

  buildArena();
  for (let i = 0; i < 8; i++) spawnEnemy();
  setupInput();

  scene.registerBeforeRender(updatePlayer);
  scene.registerBeforeRender(updateEnemies);
}

// ─── Player movement ──────────────────────────────────────────────────────────
function pause(): void {
  state.paused = true;
  pressedKeys.clear();
  pauseScreen.style.display = "flex";
}

function resume(): void {
  state.paused = false;
  pauseScreen.style.display = "none";
}

function updatePlayer(): void {
  if (!state.running || state.paused) return;

  // Snap camera to physics body (one frame behind physics, imperceptible at 60fps)
  const p = playerMesh.position;
  camera.position.set(p.x, p.y + 0.7, p.z);

  // Build wish direction from held keys + camera facing
  const fwd = camera.getForwardRay().direction;
  const forwardXZ = new Vector3(fwd.x, 0, fwd.z);
  if (forwardXZ.lengthSquared() > 0) forwardXZ.normalize();
  const right = Vector3.Cross(Vector3.Up(), forwardXZ);

  const wish = Vector3.Zero();
  if (pressedKeys.has("KeyW")) wish.addInPlace(forwardXZ);
  if (pressedKeys.has("KeyS")) wish.subtractInPlace(forwardXZ);
  if (pressedKeys.has("KeyA")) wish.subtractInPlace(right);
  if (pressedKeys.has("KeyD")) wish.addInPlace(right);

  const sprinting = pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight");
  const maxSpeed  = sprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;

  const targetXZ = wish.lengthSquared() > 0
    ? wish.normalize().scale(maxSpeed)
    : Vector3.Zero();

  // Accelerate smoothly toward target speed
  playerVelocityXZ = Vector3.Lerp(playerVelocityXZ, targetXZ, PLAYER_ACCELERATION);

  const vel = playerAggregate.body.getLinearVelocity();
  playerAggregate.body.setLinearVelocity(
    new Vector3(playerVelocityXZ.x, vel.y, playerVelocityXZ.z),
  );
}

// ─── Arena ────────────────────────────────────────────────────────────────────
function buildArena(): void {
  const floorMat = new StandardMaterial("floor", scene);
  floorMat.diffuseColor  = new Color3(0.25, 0.22, 0.18);
  floorMat.specularColor = new Color3(0.05, 0.05, 0.05);

  const wallMat = new StandardMaterial("wall", scene);
  wallMat.diffuseColor  = new Color3(0.3, 0.28, 0.24);
  wallMat.specularColor = new Color3(0.02, 0.02, 0.02);

  const ceilMat = new StandardMaterial("ceil", scene);
  ceilMat.diffuseColor = new Color3(0.12, 0.12, 0.15);

  const accentMat = new StandardMaterial("accent", scene);
  accentMat.diffuseColor  = new Color3(0.6, 0.3, 0.05);
  accentMat.emissiveColor = new Color3(0.3, 0.15, 0.02);

  const ROOM = 30;
  const CEIL = 5;
  const half = ROOM / 2;

  // Use boxes so the physics BOX shape has real extent
  const floor = MeshBuilder.CreateBox("floor", { width: ROOM, height: 0.2, depth: ROOM }, scene);
  floor.position.y  = -0.1; // top surface at y = 0
  floor.material    = floorMat;
  floor.receiveShadows = true;
  new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);

  const ceil = MeshBuilder.CreateBox("ceil", { width: ROOM, height: 0.2, depth: ROOM }, scene);
  ceil.position.y = CEIL + 0.1;
  ceil.material   = ceilMat;
  new PhysicsAggregate(ceil, PhysicsShapeType.BOX, { mass: 0 }, scene);

  function makeWall(pos: Vector3, rotY: number, w: number, h: number): void {
    const m = MeshBuilder.CreateBox("wall", { width: w, height: h, depth: 0.3 }, scene);
    m.position   = pos;
    m.rotation.y = rotY;
    m.material   = wallMat;
    m.receiveShadows = true;
    new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0 }, scene);
  }

  makeWall(new Vector3(0,     CEIL/2, -half), 0,         ROOM, CEIL);
  makeWall(new Vector3(0,     CEIL/2,  half), 0,         ROOM, CEIL);
  makeWall(new Vector3(-half, CEIL/2,  0),    Math.PI/2, ROOM, CEIL);
  makeWall(new Vector3( half, CEIL/2,  0),    Math.PI/2, ROOM, CEIL);

  const pillarPositions: [number, number][] = [[-8,-8],[-8,8],[8,-8],[8,8]];
  pillarPositions.forEach(([x, z]) => {
    const p = MeshBuilder.CreateBox("pillar", { width: 1.2, height: CEIL, depth: 1.2 }, scene);
    p.position = new Vector3(x, CEIL / 2, z);
    p.material = wallMat;
    p.receiveShadows = true;
    shadowGenerator.addShadowCaster(p);
    new PhysicsAggregate(p, PhysicsShapeType.BOX, { mass: 0 }, scene);
  });

  const crateMat = new StandardMaterial("crate", scene);
  crateMat.diffuseColor = new Color3(0.45, 0.32, 0.18);
  const crateData: [number, number, number][] = [
    [3, 0.5, 5], [-5, 0.5, 3], [6, 0.5, -4], [-3, 0.5, -6], [3, 1.5, 5],
  ];
  crateData.forEach(([x, y, z]) => {
    const c = MeshBuilder.CreateBox("crate", { size: 1 }, scene);
    c.position = new Vector3(x, y, z);
    c.material = crateMat;
    c.receiveShadows = true;
    shadowGenerator.addShadowCaster(c);
    new PhysicsAggregate(c, PhysicsShapeType.BOX, { mass: 0 }, scene);
  });

  // Glowing accent strips (visual only — no physics needed)
  [0, Math.PI/2, Math.PI, -Math.PI/2].forEach((rot) => {
    const strip = MeshBuilder.CreateBox("strip", { width: ROOM - 1, height: 0.15, depth: 0.05 }, scene);
    strip.rotation.y = rot;
    const offset = half - 0.2;
    strip.position = new Vector3(
      rot === 0 || rot === Math.PI ? 0 : (rot > 0 ? offset : -offset),
      0.5,
      rot === 0 ? -offset : rot === Math.PI ? offset : 0,
    );
    strip.material = accentMat;
  });
}

// ─── Enemies ──────────────────────────────────────────────────────────────────
const ENEMY_COLORS: Color3[] = [
  new Color3(0.7, 0.1, 0.1),
  new Color3(0.1, 0.6, 0.1),
  new Color3(0.1, 0.1, 0.8),
  new Color3(0.7, 0.4, 0.0),
];

function spawnEnemy(): void {
  const angle = Math.random() * Math.PI * 2;
  const dist  = 8 + Math.random() * 10;

  // Invisible capsule — owns the physics body
  const physMesh = MeshBuilder.CreateCapsule(
    "enemyPhys", { height: 1.6, radius: 0.4 }, scene,
  );
  physMesh.position  = new Vector3(Math.cos(angle) * dist, 0.8, Math.sin(angle) * dist);
  physMesh.isVisible = false;

  const aggregate = new PhysicsAggregate(
    physMesh, PhysicsShapeType.CAPSULE,
    { mass: 10, friction: 0.7, restitution: 0 },
    scene,
  );
  aggregate.body.setMassProperties({
    mass: 10,
    inertia: Vector3.Zero(),
    inertiaOrientation: Quaternion.Identity(),
  });

  // Visible meshes parented to the physics capsule
  const mat = new StandardMaterial("emat", scene);
  mat.diffuseColor  = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
  mat.emissiveColor = mat.diffuseColor.scale(0.2);

  const bodyMesh = MeshBuilder.CreateBox("enemyBody", { width: 0.8, height: 1.6, depth: 0.8 }, scene);
  bodyMesh.parent   = physMesh;
  bodyMesh.position = Vector3.Zero();
  bodyMesh.material = mat;

  const head = MeshBuilder.CreateSphere("enemyHead", { diameter: 0.55 }, scene);
  head.parent   = physMesh;         // parent to physMesh so hit detection parent lookup is flat
  head.position = new Vector3(0, 1.05, 0);
  head.material = mat;

  shadowGenerator.addShadowCaster(bodyMesh);
  shadowGenerator.addShadowCaster(head);

  enemies.push({
    physMesh, bodyMesh, aggregate,
    hp: ENEMY_HP, maxHp: ENEMY_HP, speed: ENEMY_SPEED,
    state: "patrol",
    patrolTarget: physMesh.position.clone(),
    attackCooldown: 0,
  });
}

function updateEnemies(): void {
  if (!state.running || state.paused) return;
  const camPos = camera.position;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const pos  = e.physMesh.position;
    const toPlayer = camPos.subtract(pos);
    const dist = toPlayer.length();

    // Rotate the visual body toward the player (physics capsule never rotates)
    e.bodyMesh.lookAt(new Vector3(camPos.x, pos.y, camPos.z));

    if (dist < ENEMY_CHASE_RANGE) e.state = "chase";

    const currentVel = e.aggregate.body.getLinearVelocity();

    if (e.state === "chase") {
      const dirXZ = new Vector3(toPlayer.x, 0, toPlayer.z);
      if (dirXZ.lengthSquared() > 0) dirXZ.normalize();

      e.aggregate.body.setLinearVelocity(
        new Vector3(dirXZ.x * e.speed, currentVel.y, dirXZ.z * e.speed),
      );

      if (dist < ENEMY_MELEE_RANGE) {
        e.attackCooldown -= engine.getDeltaTime();
        if (e.attackCooldown <= 0) {
          damagePlayer(ENEMY_MELEE_DAMAGE);
          e.attackCooldown = ENEMY_MELEE_COOLDOWN_MS;
        }
      }
    } else {
      const toTarget = e.patrolTarget.subtract(pos);
      const toTargetXZ = new Vector3(toTarget.x, 0, toTarget.z);

      if (toTargetXZ.length() < 0.5) {
        e.patrolTarget = new Vector3(
          (Math.random() - 0.5) * 24, pos.y, (Math.random() - 0.5) * 24,
        );
      }

      const dirXZ = toTargetXZ.length() > 0 ? toTargetXZ.normalize() : Vector3.Zero();
      e.aggregate.body.setLinearVelocity(
        new Vector3(dirXZ.x * e.speed * 0.5, currentVel.y, dirXZ.z * e.speed * 0.5),
      );
    }
  }
}

// ─── Shooting ─────────────────────────────────────────────────────────────────
function shoot(): void {
  if (!state.running || state.reloading) return;
  if (state.ammo <= 0) { startReload(); return; }

  state.ammo--;
  updateHUD();
  spawnMuzzleFlash();

  // Exclude invisible physics meshes so the ray hits only rendered geometry
  const ray = camera.getForwardRay(100);
  const hit  = scene.pickWithRay(
    ray,
    (m: AbstractMesh) => m.name !== "player" && m.name !== "enemyPhys",
  );

  if (hit?.hit && hit.pickedMesh) {
    if (hit.pickedMesh.name === "enemyBody" || hit.pickedMesh.name === "enemyHead") {
      // Both body and head are direct children of physMesh
      const enemy = enemies.find(e => e.physMesh === hit.pickedMesh!.parent);
      if (enemy) hitEnemy(enemy, hit.pickedPoint ?? enemy.physMesh.position);
    } else if (hit.pickedPoint) {
      spawnBulletHole(hit.pickedPoint, hit.getNormal(true));
    }
  }

  if (state.ammo === 0 && state.reserve > 0) setTimeout(startReload, 300);
}

function hitEnemy(enemy: Enemy, hitPoint: Vector3): void {
  enemy.hp -= ENEMY_SHOT_DAMAGE_MIN + Math.floor(Math.random() * ENEMY_SHOT_DAMAGE_VARIANCE);

  spawnHitParticle(hitPoint, new Color4(0.8, 0.0, 0.0, 1));

  const mat = enemy.bodyMesh.material as StandardMaterial;
  const origEmissive = mat.emissiveColor.clone();
  mat.emissiveColor = new Color3(1, 0, 0);
  setTimeout(() => { mat.emissiveColor = origEmissive; }, 80);

  if (enemy.hp <= 0) killEnemy(enemy);
}

function killEnemy(enemy: Enemy): void {
  spawnDeathParticle(enemy.physMesh.position.clone());
  enemy.aggregate.dispose();
  enemy.physMesh.dispose(); // disposes parented bodyMesh + head too
  enemies.splice(enemies.indexOf(enemy), 1);
  state.kills++;
  state.score += 100;
  updateHUD();
  if (state.running) setTimeout(() => { if (state.running) spawnEnemy(); }, 3000);
}

function startReload(): void {
  if (state.reloading || state.reserve <= 0) return;
  state.reloading = true;
  reloadMsg.classList.add("visible");

  state.reloadTimer = setTimeout(() => {
    const take = Math.min(30 - state.ammo, state.reserve);
    state.ammo    += take;
    state.reserve -= take;
    state.reloading = false;
    reloadMsg.classList.remove("visible");
    updateHUD();
  }, 1800);
}

// ─── Player damage ────────────────────────────────────────────────────────────
function damagePlayer(amount: number): void {
  state.health = Math.max(0, state.health - amount);
  updateHUD();
  hitFlash.classList.add("active");
  setTimeout(() => hitFlash.classList.remove("active"), 200);
  if (state.health <= 0) endGame();
}

// ─── Particles ────────────────────────────────────────────────────────────────
function spawnMuzzleFlash(): void {
  const ps = new ParticleSystem("muzzle", 20, scene);
  ps.emitter = camera.position.add(camera.getForwardRay().direction.scale(0.5));
  ps.minEmitBox = new Vector3(-0.05, -0.05, -0.05);
  ps.maxEmitBox = new Vector3(0.05, 0.05, 0.05);
  ps.color1      = new Color4(1, 0.8, 0.2, 1);
  ps.color2      = new Color4(1, 0.4, 0.0, 1);
  ps.colorDead   = new Color4(0, 0, 0, 0);
  ps.minSize = 0.05; ps.maxSize = 0.15;
  ps.minLifeTime = 0.03; ps.maxLifeTime = 0.08;
  ps.emitRate = 300;
  ps.minEmitPower = 2; ps.maxEmitPower = 5;
  ps.updateSpeed = 0.02;
  ps.start();
  setTimeout(() => ps.stop(), 60);
  setTimeout(() => ps.dispose(), 500);
}

function spawnHitParticle(position: Vector3, color: Color4): void {
  const ps = new ParticleSystem("hit", 40, scene);
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
  ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
  ps.color1    = color;
  ps.color2    = new Color4(color.r, color.g, color.b, 0.5);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.04; ps.maxSize = 0.12;
  ps.minLifeTime = 0.1; ps.maxLifeTime = 0.4;
  ps.emitRate = 400;
  ps.minEmitPower = 3; ps.maxEmitPower = 7;
  ps.gravity = new Vector3(0, -12, 0);
  ps.updateSpeed = 0.02;
  ps.start();
  setTimeout(() => ps.stop(), 80);
  setTimeout(() => ps.dispose(), 600);
}

function spawnDeathParticle(position: Vector3): void {
  const ps = new ParticleSystem("death", 80, scene);
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.3, -0.3, -0.3);
  ps.maxEmitBox = new Vector3(0.3, 0.3, 0.3);
  ps.color1    = new Color4(1, 0.1, 0.0, 1);
  ps.color2    = new Color4(0.6, 0.0, 0.0, 0.8);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.1; ps.maxSize = 0.3;
  ps.minLifeTime = 0.3; ps.maxLifeTime = 0.9;
  ps.emitRate = 600;
  ps.minEmitPower = 4; ps.maxEmitPower = 10;
  ps.gravity = new Vector3(0, -15, 0);
  ps.updateSpeed = 0.02;
  ps.start();
  setTimeout(() => ps.stop(), 100);
  setTimeout(() => ps.dispose(), 1200);
}

function spawnBulletHole(position: Vector3, normal: Vector3 | null): void {
  if (bulletHoles.length > 40) bulletHoles.shift()!.dispose();
  const disc = MeshBuilder.CreateDisc("bhole", { radius: 0.08, tessellation: 8 }, scene);
  const n = normal ?? Vector3.Up();
  disc.position = position.add(n.scale(0.01));
  disc.lookAt(position.add(n));
  const mat = new StandardMaterial("bholeMat", scene);
  mat.diffuseColor  = new Color3(0.05, 0.05, 0.05);
  mat.emissiveColor = new Color3(0.02, 0.02, 0.02);
  disc.material = mat;
  bulletHoles.push(disc);
}

// ─── Input ────────────────────────────────────────────────────────────────────
function setupInput(): void {
  scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERDOWN && info.event.button === 0) shoot();
  });

  scene.actionManager = new ActionManager(scene);
  scene.actionManager.registerAction(new ExecuteCodeAction(
    { trigger: ActionManager.OnKeyDownTrigger, parameter: "r" }, () => startReload(),
  ));
  scene.actionManager.registerAction(new ExecuteCodeAction(
    { trigger: ActionManager.OnKeyDownTrigger, parameter: "R" }, () => startReload(),
  ));
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function updateHUD(): void {
  healthEl.textContent = String(state.health);
  healthEl.style.color = state.health > 50 ? "#4f4" : state.health > 25 ? "#fa0" : "#f44";
  ammoEl.textContent   = `${state.ammo} / ${state.reserve}`;
  scoreEl.textContent  = String(state.score);
  killsEl.textContent  = String(state.kills);
}

// ─── Game flow ────────────────────────────────────────────────────────────────
async function startGame(): Promise<void> {
  overlay.style.display      = "none";
  gameOver.style.display     = "none";
  pauseScreen.style.display  = "none";
  hud.style.display          = "block";

  state = makeState();
  await buildScene();
  state.running = true;
  updateHUD();

  camera.attachControl(canvas, true);
  canvas.requestPointerLock();
}

function endGame(): void {
  state.running = false;
  pressedKeys.clear();
  hud.style.display      = "none";
  gameOver.style.display = "flex";
  finalScoreEl.textContent = `Score: ${state.score}  |  Kills: ${state.kills}`;
  document.exitPointerLock();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
startBtn.addEventListener("click",   () => startGame().catch(console.error));
restartBtn.addEventListener("click", () => startGame().catch(console.error));
canvas.addEventListener("click", () => {
  if (state.running && !state.paused && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

// Clicking the pause screen requests pointer lock — resume() is called once
// pointerlockchange confirms the lock was actually granted.
pauseScreen.addEventListener("click", () => {
  if (state.running && state.paused) canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  if (!state.running) return;
  if (document.pointerLockElement === canvas) {
    if (state.paused) resume();
  } else {
    pause();
  }
});

engine.runRenderLoop(() => { if (scene) scene.render(); });
window.addEventListener("resize", () => engine.resize());
