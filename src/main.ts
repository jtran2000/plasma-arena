import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Ray,
  PointerEventTypes,
  ActionManager,
  ExecuteCodeAction,
  ParticleSystem,
  ShadowGenerator,
  Mesh,
  AbstractMesh,
} from "@babylonjs/core";

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
}

interface Enemy {
  mesh: Mesh;
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
const finalScoreEl = getEl("final-score");
const hitFlash     = getEl("hit-flash");
const reloadMsg    = getEl("reload-msg");

// ─── Game state ───────────────────────────────────────────────────────────────
let state: GameState = makeState();

function makeState(): GameState {
  return {
    health: 100,
    ammo: 30,
    reserve: 90,
    score: 0,
    kills: 0,
    reloading: false,
    reloadTimer: null,
    running: false,
  };
}

// ─── Babylon globals ──────────────────────────────────────────────────────────
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true });

let scene!: Scene;
let camera!: UniversalCamera;
let shadowGenerator!: ShadowGenerator;
let enemies: Enemy[] = [];
let bulletHoles: Mesh[] = [];

// ─── Scene builder ────────────────────────────────────────────────────────────
function buildScene(): void {
  if (scene) scene.dispose();
  enemies = [];
  bulletHoles = [];

  scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.05, 0.1, 1);
  scene.gravity = new Vector3(0, -0.5, 0);

  // Fog
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.05, 0.05, 0.1);
  scene.fogDensity = 0.035;

  // Camera (FPS)
  camera = new UniversalCamera("fps", new Vector3(0, 1.7, 0), scene);
  camera.setTarget(new Vector3(1, 1.7, 0));
  camera.minZ = 0.1;
  camera.fov = 1.2;
  camera.speed = 0.18;
  camera.angularSensibility = 800;
  camera.ellipsoid = new Vector3(0.5, 0.9, 0.5);
  camera.checkCollisions = true;
  camera.applyGravity = true;
  camera.keysUp    = [87]; // W
  camera.keysDown  = [83]; // S
  camera.keysLeft  = [65]; // A
  camera.keysRight = [68]; // D

  // Lights
  const ambient = new HemisphericLight("amb", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.4;
  ambient.groundColor = new Color3(0.05, 0.05, 0.1);

  const sun = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene);
  sun.intensity = 1.2;
  sun.position = new Vector3(10, 20, 10);

  shadowGenerator = new ShadowGenerator(1024, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;

  buildArena();
  for (let i = 0; i < 8; i++) spawnEnemy();
  setupInput();
  scene.registerBeforeRender(updateEnemies);
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

  const floor = MeshBuilder.CreateGround("floor", { width: ROOM, height: ROOM }, scene);
  floor.material = floorMat;
  floor.checkCollisions = true;
  floor.receiveShadows = true;

  const ceil = MeshBuilder.CreateGround("ceil", { width: ROOM, height: ROOM }, scene);
  ceil.position.y = CEIL;
  ceil.rotation.x = Math.PI;
  ceil.material = ceilMat;
  ceil.checkCollisions = true;

  function makeWall(pos: Vector3, rotY: number, w: number, h: number): void {
    const m = MeshBuilder.CreateBox("wall", { width: w, height: h, depth: 0.3 }, scene);
    m.position  = pos;
    m.rotation.y = rotY;
    m.material  = wallMat;
    m.checkCollisions = true;
    m.receiveShadows  = true;
  }

  makeWall(new Vector3(0,     CEIL/2, -half), 0,          ROOM, CEIL);
  makeWall(new Vector3(0,     CEIL/2,  half), 0,          ROOM, CEIL);
  makeWall(new Vector3(-half, CEIL/2,  0),    Math.PI/2,  ROOM, CEIL);
  makeWall(new Vector3( half, CEIL/2,  0),    Math.PI/2,  ROOM, CEIL);

  const pillarPositions: [number, number][] = [[-8,-8],[-8,8],[8,-8],[8,8]];
  pillarPositions.forEach(([x, z]) => {
    const p = MeshBuilder.CreateBox("pillar", { width: 1.2, height: CEIL, depth: 1.2 }, scene);
    p.position = new Vector3(x, CEIL / 2, z);
    p.material = wallMat;
    p.checkCollisions = true;
    shadowGenerator.addShadowCaster(p);
    p.receiveShadows = true;
  });

  const crateMat = new StandardMaterial("crate", scene);
  crateMat.diffuseColor = new Color3(0.45, 0.32, 0.18);
  const crateData: [number, number, number][] = [
    [3, 0.5, 5], [-5, 0.5, 3], [6, 0.5, -4], [-3, 0.5, -6],
    [3, 1.5, 5],
  ];
  crateData.forEach(([x, y, z]) => {
    const c = MeshBuilder.CreateBox("crate", { size: 1 }, scene);
    c.position = new Vector3(x, y, z);
    c.material = crateMat;
    c.checkCollisions = true;
    shadowGenerator.addShadowCaster(c);
    c.receiveShadows = true;
  });

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

  const body = MeshBuilder.CreateBox("enemy", { width: 0.8, height: 1.6, depth: 0.8 }, scene);
  body.position = new Vector3(Math.cos(angle) * dist, 0.8, Math.sin(angle) * dist);
  body.checkCollisions = false;

  const mat = new StandardMaterial("emat", scene);
  mat.diffuseColor  = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
  mat.emissiveColor = mat.diffuseColor.scale(0.2);
  body.material = mat;

  const head = MeshBuilder.CreateSphere("head", { diameter: 0.55 }, scene);
  head.position = new Vector3(0, 1.05, 0);
  head.parent   = body;
  head.material = mat;

  shadowGenerator.addShadowCaster(body);
  shadowGenerator.addShadowCaster(head);

  const hp = 50 + Math.floor(Math.random() * 30);
  enemies.push({
    mesh: body,
    hp,
    maxHp: hp,
    speed: 0.02 + Math.random() * 0.015,
    state: "patrol",
    patrolTarget: body.position.clone(),
    attackCooldown: 0,
  });
}

function updateEnemies(): void {
  if (!state.running) return;
  const camPos = camera.position;
  const dt = engine.getDeltaTime() / 16.67;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    const toPlayer = camPos.subtract(e.mesh.position);
    const dist = toPlayer.length();

    e.mesh.lookAt(new Vector3(camPos.x, e.mesh.position.y, camPos.z));

    if (dist < 20) e.state = "chase";

    if (e.state === "chase") {
      e.mesh.position.addInPlace(toPlayer.normalize().scale(e.speed * dt));
      e.mesh.position.y = 0.8;

      if (dist < 1.8) {
        e.attackCooldown -= engine.getDeltaTime();
        if (e.attackCooldown <= 0) {
          damagePlayer(10);
          e.attackCooldown = 1200;
        }
      }
    } else {
      const toTarget = e.patrolTarget.subtract(e.mesh.position);
      if (toTarget.length() < 0.5) {
        e.patrolTarget = new Vector3(
          (Math.random() - 0.5) * 24,
          0.8,
          (Math.random() - 0.5) * 24,
        );
      }
      e.mesh.position.addInPlace(toTarget.normalize().scale(e.speed * 0.5 * dt));
      e.mesh.position.y = 0.8;
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

  const ray = new Ray(camera.position, camera.getForwardRay().direction, 100);
  const hit = scene.pickWithRay(ray, (m: AbstractMesh) => m.name === "enemy");

  if (hit?.hit && hit.pickedMesh) {
    const enemy = enemies.find(e => e.mesh === hit.pickedMesh);
    if (enemy) hitEnemy(enemy, hit.pickedPoint ?? enemy.mesh.position);
  } else if (hit?.hit && hit.pickedPoint) {
    spawnBulletHole(hit.pickedPoint, hit.getNormal(true));
  }

  if (state.ammo === 0 && state.reserve > 0) setTimeout(startReload, 300);
}

function hitEnemy(enemy: Enemy, hitPoint: Vector3): void {
  enemy.hp -= 25 + Math.floor(Math.random() * 15);

  spawnHitParticle(hitPoint, new Color4(0.8, 0.0, 0.0, 1));

  const mat = enemy.mesh.material as StandardMaterial;
  const origEmissive = mat.emissiveColor.clone();
  mat.emissiveColor = new Color3(1, 0, 0);
  setTimeout(() => { mat.emissiveColor = origEmissive; }, 80);

  if (enemy.hp <= 0) killEnemy(enemy);
}

function killEnemy(enemy: Enemy): void {
  spawnDeathParticle(enemy.mesh.position.clone());
  enemy.mesh.dispose();
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

  window.addEventListener("keydown", (e) => {
    if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && state.running) camera.speed = 0.36;
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") camera.speed = 0.18;
  });
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function updateHUD(): void {
  healthEl.textContent    = String(state.health);
  healthEl.style.color    = state.health > 50 ? "#4f4" : state.health > 25 ? "#fa0" : "#f44";
  ammoEl.textContent      = `${state.ammo} / ${state.reserve}`;
  scoreEl.textContent     = String(state.score);
  killsEl.textContent     = String(state.kills);
}

// ─── Game flow ────────────────────────────────────────────────────────────────
function startGame(): void {
  overlay.style.display  = "none";
  gameOver.style.display = "none";
  hud.style.display      = "block";

  state = makeState();
  buildScene();
  state.running = true;
  updateHUD();

  camera.attachControl(canvas, true);
  canvas.requestPointerLock();
}

function endGame(): void {
  state.running = false;
  hud.style.display      = "none";
  gameOver.style.display = "flex";
  finalScoreEl.textContent = `Score: ${state.score}  |  Kills: ${state.kills}`;
  document.exitPointerLock();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
startBtn.addEventListener("click",   startGame);
restartBtn.addEventListener("click", startGame);
canvas.addEventListener("click", () => {
  if (state.running && document.pointerLockElement !== canvas) canvas.requestPointerLock();
});

engine.runRenderLoop(() => { if (scene) scene.render(); });
window.addEventListener("resize", () => engine.resize());
