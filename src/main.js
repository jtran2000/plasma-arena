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
  Texture,
  ShadowGenerator,
  PhysicsImpostor,
  CannonJSPlugin,
  Animation,
  Mesh,
  Tools,
} from "@babylonjs/core";

// ─── DOM refs ────────────────────────────────────────────────────────────────
const canvas   = document.getElementById("renderCanvas");
const overlay  = document.getElementById("overlay");
const startBtn = document.getElementById("start-btn");
const hud      = document.getElementById("hud");
const gameOver = document.getElementById("game-over");
const restartBtn = document.getElementById("restart-btn");

const healthEl = document.getElementById("health-value");
const ammoEl   = document.getElementById("ammo-value");
const scoreEl  = document.getElementById("score-value");
const killsEl  = document.getElementById("kills-value");
const finalScoreEl = document.getElementById("final-score");
const hitFlash = document.getElementById("hit-flash");
const reloadMsg = document.getElementById("reload-msg");

// ─── Game state ───────────────────────────────────────────────────────────────
let state = {
  health: 100,
  ammo: 30,
  reserve: 90,
  score: 0,
  kills: 0,
  reloading: false,
  reloadTimer: null,
  running: false,
};

function resetState() {
  state = {
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

// ─── Babylon setup ────────────────────────────────────────────────────────────
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
let scene, camera, enemies = [], bulletHoles = [], shadowGenerator;

function buildScene() {
  if (scene) scene.dispose();
  enemies = [];
  bulletHoles = [];

  scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.05, 0.1, 1);
  scene.gravity = new Vector3(0, -0.5, 0);

  // ── Fog
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.05, 0.05, 0.1);
  scene.fogDensity = 0.035;

  // ── Camera (FPS)
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

  // ── Lights
  const ambient = new HemisphericLight("amb", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.4;
  ambient.groundColor = new Color3(0.05, 0.05, 0.1);

  const sun = new DirectionalLight("sun", new Vector3(-1, -2, -1), scene);
  sun.intensity = 1.2;
  sun.position = new Vector3(10, 20, 10);

  shadowGenerator = new ShadowGenerator(1024, sun);
  shadowGenerator.useBlurExponentialShadowMap = true;

  // ── Arena
  buildArena();

  // ── Enemies
  for (let i = 0; i < 8; i++) spawnEnemy();

  // ── Input
  setupInput();

  // ── Enemy AI loop
  scene.registerBeforeRender(updateEnemies);

  return scene;
}

// ─── Arena ────────────────────────────────────────────────────────────────────
function buildArena() {
  const floorMat = new StandardMaterial("floor", scene);
  floorMat.diffuseColor = new Color3(0.25, 0.22, 0.18);
  floorMat.specularColor = new Color3(0.05, 0.05, 0.05);

  const wallMat = new StandardMaterial("wall", scene);
  wallMat.diffuseColor = new Color3(0.3, 0.28, 0.24);
  wallMat.specularColor = new Color3(0.02, 0.02, 0.02);

  const ceilMat = new StandardMaterial("ceil", scene);
  ceilMat.diffuseColor = new Color3(0.12, 0.12, 0.15);

  const accentMat = new StandardMaterial("accent", scene);
  accentMat.diffuseColor = new Color3(0.6, 0.3, 0.05);
  accentMat.emissiveColor = new Color3(0.3, 0.15, 0.02);

  const ROOM = 30;
  const CEIL = 5;

  // Floor
  const floor = MeshBuilder.CreateGround("floor", { width: ROOM, height: ROOM }, scene);
  floor.material = floorMat;
  floor.checkCollisions = true;
  floor.receiveShadows = true;

  // Ceiling
  const ceil = MeshBuilder.CreateGround("ceil", { width: ROOM, height: ROOM }, scene);
  ceil.position.y = CEIL;
  ceil.rotation.x = Math.PI;
  ceil.material = ceilMat;
  ceil.checkCollisions = true;

  // Walls helper
  function wall(pos, rot, w, h) {
    const m = MeshBuilder.CreateBox("wall", { width: w, height: h, depth: 0.3 }, scene);
    m.position = pos;
    m.rotation.y = rot;
    m.material = wallMat;
    m.checkCollisions = true;
    m.receiveShadows = true;
    return m;
  }

  const half = ROOM / 2;
  wall(new Vector3(0,      CEIL/2, -half), 0,           ROOM, CEIL);
  wall(new Vector3(0,      CEIL/2,  half), 0,           ROOM, CEIL);
  wall(new Vector3(-half,  CEIL/2,  0),    Math.PI/2,   ROOM, CEIL);
  wall(new Vector3( half,  CEIL/2,  0),    Math.PI/2,   ROOM, CEIL);

  // Interior pillars
  const pillarPositions = [
    [-8, -8], [-8, 8], [8, -8], [8, 8],
  ];
  pillarPositions.forEach(([x, z]) => {
    const p = MeshBuilder.CreateBox("pillar", { width: 1.2, height: CEIL, depth: 1.2 }, scene);
    p.position = new Vector3(x, CEIL / 2, z);
    p.material = wallMat;
    p.checkCollisions = true;
    shadowGenerator.addShadowCaster(p);
    p.receiveShadows = true;
  });

  // Crates
  const crateMat = new StandardMaterial("crate", scene);
  crateMat.diffuseColor = new Color3(0.45, 0.32, 0.18);
  const crateData = [
    [3, 0.5, 5], [-5, 0.5, 3], [6, 0.5, -4], [-3, 0.5, -6],
    [3, 1.5, 5], // stacked
  ];
  crateData.forEach(([x, y, z]) => {
    const c = MeshBuilder.CreateBox("crate", { size: 1 }, scene);
    c.position = new Vector3(x, y, z);
    c.material = crateMat;
    c.checkCollisions = true;
    shadowGenerator.addShadowCaster(c);
    c.receiveShadows = true;
  });

  // Glowing accent strips on walls
  [0, Math.PI/2, Math.PI, -Math.PI/2].forEach((rot, i) => {
    const strip = MeshBuilder.CreateBox("strip", { width: ROOM - 1, height: 0.15, depth: 0.05 }, scene);
    strip.rotation.y = rot;
    const offset = half - 0.2;
    strip.position = new Vector3(
      rot === 0 || rot === Math.PI ? 0 : (rot > 0 ? offset : -offset),
      0.5,
      rot === 0 ? -offset : rot === Math.PI ? offset : 0
    );
    strip.material = accentMat;
  });
}

// ─── Enemies ─────────────────────────────────────────────────────────────────
const ENEMY_COLORS = [
  new Color3(0.7, 0.1, 0.1),
  new Color3(0.1, 0.6, 0.1),
  new Color3(0.1, 0.1, 0.8),
  new Color3(0.7, 0.4, 0.0),
];

function spawnEnemy() {
  const angle = Math.random() * Math.PI * 2;
  const dist  = 8 + Math.random() * 10;
  const x = Math.cos(angle) * dist;
  const z = Math.sin(angle) * dist;

  const body = MeshBuilder.CreateBox("enemy", { width: 0.8, height: 1.6, depth: 0.8 }, scene);
  body.position = new Vector3(x, 0.8, z);
  body.checkCollisions = false;

  const mat = new StandardMaterial("emat", scene);
  mat.diffuseColor = ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
  mat.emissiveColor = mat.diffuseColor.scale(0.2);
  body.material = mat;

  const head = MeshBuilder.CreateSphere("head", { diameter: 0.55 }, scene);
  head.position = new Vector3(0, 1.05, 0);
  head.parent = body;
  head.material = mat;

  shadowGenerator.addShadowCaster(body);
  shadowGenerator.addShadowCaster(head);

  const hp = 50 + Math.floor(Math.random() * 30);
  enemies.push({ mesh: body, hp, maxHp: hp, speed: 0.02 + Math.random() * 0.015, state: "patrol",
                 patrolTarget: body.position.clone(), attackCooldown: 0 });
}

function updateEnemies() {
  if (!state.running) return;
  const camPos = camera.position;
  const dt = engine.getDeltaTime() / 16.67; // normalise to ~60fps

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.mesh) continue;

    const toPlayer = camPos.subtract(e.mesh.position);
    const dist = toPlayer.length();

    // Face player
    e.mesh.lookAt(new Vector3(camPos.x, e.mesh.position.y, camPos.z));

    if (dist < 20) {
      e.state = "chase";
    }

    if (e.state === "chase") {
      const dir = toPlayer.normalize();
      e.mesh.position.addInPlace(dir.scale(e.speed * dt));
      e.mesh.position.y = 0.8; // keep grounded

      // Attack player when close
      if (dist < 1.8) {
        e.attackCooldown -= engine.getDeltaTime();
        if (e.attackCooldown <= 0) {
          damagePlayer(10);
          e.attackCooldown = 1200;
        }
      }
    } else {
      // Patrol
      const toTarget = e.patrolTarget.subtract(e.mesh.position);
      if (toTarget.length() < 0.5) {
        e.patrolTarget = new Vector3(
          (Math.random() - 0.5) * 24,
          0.8,
          (Math.random() - 0.5) * 24
        );
      }
      const dir = toTarget.normalize();
      e.mesh.position.addInPlace(dir.scale(e.speed * 0.5 * dt));
      e.mesh.position.y = 0.8;
    }
  }
}

// ─── Shooting ────────────────────────────────────────────────────────────────
function shoot() {
  if (!state.running) return;
  if (state.reloading) return;
  if (state.ammo <= 0) {
    startReload();
    return;
  }

  state.ammo--;
  updateHUD();

  // Muzzle flash particle burst
  spawnMuzzleFlash();

  // Raycast from camera centre
  const forward = camera.getForwardRay().direction;
  const ray = new Ray(camera.position, forward, 100);

  const hit = scene.pickWithRay(ray, (mesh) => {
    return mesh.name === "enemy";
  });

  if (hit.hit && hit.pickedMesh) {
    const enemy = enemies.find(e => e.mesh === hit.pickedMesh);
    if (enemy) {
      hitEnemy(enemy, hit.pickedPoint);
    }
  } else if (hit.hit && hit.pickedPoint) {
    spawnBulletHole(hit.pickedPoint, hit.getNormal(true));
  }

  // Auto-reload when empty
  if (state.ammo === 0 && state.reserve > 0) {
    setTimeout(startReload, 300);
  }
}

function hitEnemy(enemy, hitPoint) {
  enemy.hp -= 25 + Math.floor(Math.random() * 15);

  // Blood particle
  spawnHitParticle(hitPoint, new Color4(0.8, 0.0, 0.0, 1));

  // Flash enemy red
  const origColor = enemy.mesh.material.diffuseColor.clone();
  enemy.mesh.material.emissiveColor = new Color3(1, 0, 0);
  setTimeout(() => {
    if (enemy.mesh && enemy.mesh.material) {
      enemy.mesh.material.emissiveColor = origColor.scale(0.2);
    }
  }, 80);

  if (enemy.hp <= 0) {
    killEnemy(enemy);
  }
}

function killEnemy(enemy) {
  spawnDeathParticle(enemy.mesh.position.clone());
  enemy.mesh.dispose();
  enemies.splice(enemies.indexOf(enemy), 1);

  state.kills++;
  state.score += 100;
  updateHUD();

  // Respawn after delay if game still running
  if (state.running) {
    setTimeout(() => { if (state.running) spawnEnemy(); }, 3000);
  }
}

function startReload() {
  if (state.reloading || state.reserve <= 0) return;
  state.reloading = true;
  reloadMsg.classList.add("visible");

  state.reloadTimer = setTimeout(() => {
    const needed = 30 - state.ammo;
    const take = Math.min(needed, state.reserve);
    state.ammo += take;
    state.reserve -= take;
    state.reloading = false;
    reloadMsg.classList.remove("visible");
    updateHUD();
  }, 1800);
}

// ─── Player damage ───────────────────────────────────────────────────────────
function damagePlayer(amount) {
  state.health = Math.max(0, state.health - amount);
  updateHUD();

  hitFlash.classList.add("active");
  setTimeout(() => hitFlash.classList.remove("active"), 200);

  if (state.health <= 0) endGame();
}

// ─── Particles ───────────────────────────────────────────────────────────────
function spawnMuzzleFlash() {
  const ps = new ParticleSystem("muzzle", 20, scene);
  ps.emitter = camera.position.add(camera.getForwardRay().direction.scale(0.5));
  ps.minEmitBox = new Vector3(-0.05, -0.05, -0.05);
  ps.maxEmitBox = new Vector3(0.05, 0.05, 0.05);
  ps.color1 = new Color4(1, 0.8, 0.2, 1);
  ps.color2 = new Color4(1, 0.4, 0.0, 1);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.05; ps.maxSize = 0.15;
  ps.minLifeTime = 0.03; ps.maxLifeTime = 0.08;
  ps.emitRate = 300;
  ps.minEmitPower = 2; ps.maxEmitPower = 5;
  ps.updateSpeed = 0.02;
  ps.start();
  setTimeout(() => ps.stop(), 60);
  setTimeout(() => ps.dispose(), 500);
}

function spawnHitParticle(position, color) {
  const ps = new ParticleSystem("hit", 40, scene);
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
  ps.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
  ps.color1 = color;
  ps.color2 = color.clone();
  ps.color2.a = 0.5;
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

function spawnDeathParticle(position) {
  const ps = new ParticleSystem("death", 80, scene);
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.3, -0.3, -0.3);
  ps.maxEmitBox = new Vector3(0.3, 0.3, 0.3);
  ps.color1 = new Color4(1, 0.1, 0.0, 1);
  ps.color2 = new Color4(0.6, 0.0, 0.0, 0.8);
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

function spawnBulletHole(position, normal) {
  if (bulletHoles.length > 40) {
    bulletHoles.shift().dispose();
  }
  const disc = MeshBuilder.CreateDisc("bhole", { radius: 0.08, tessellation: 8 }, scene);
  disc.position = position.add((normal || Vector3.Up()).scale(0.01));
  disc.lookAt(position.add(normal || Vector3.Up()));
  const mat = new StandardMaterial("bholeMat", scene);
  mat.diffuseColor = new Color3(0.05, 0.05, 0.05);
  mat.emissiveColor = new Color3(0.02, 0.02, 0.02);
  disc.material = mat;
  bulletHoles.push(disc);
}

// ─── Input ────────────────────────────────────────────────────────────────────
function setupInput() {
  // Shoot on left click (pointer down)
  scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERDOWN && info.event.button === 0) {
      shoot();
    }
  });

  // Keyboard extras
  scene.actionManager = new ActionManager(scene);
  scene.actionManager.registerAction(new ExecuteCodeAction(
    { trigger: ActionManager.OnKeyDownTrigger, parameter: "r" },
    () => startReload()
  ));
  scene.actionManager.registerAction(new ExecuteCodeAction(
    { trigger: ActionManager.OnKeyDownTrigger, parameter: "R" },
    () => startReload()
  ));

  // Sprint
  window.addEventListener("keydown", (e) => {
    if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && state.running) {
      camera.speed = 0.36;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
      camera.speed = 0.18;
    }
  });
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function updateHUD() {
  healthEl.textContent = state.health;
  healthEl.style.color = state.health > 50 ? "#4f4" : state.health > 25 ? "#fa0" : "#f44";
  ammoEl.textContent   = `${state.ammo} / ${state.reserve}`;
  scoreEl.textContent  = state.score;
  killsEl.textContent  = state.kills;
}

// ─── Game flow ────────────────────────────────────────────────────────────────
function startGame() {
  overlay.style.display = "none";
  gameOver.style.display = "none";
  hud.style.display = "block";

  resetState();
  buildScene();
  state.running = true;
  updateHUD();

  // Attach camera controls & pointer lock
  camera.attachControl(canvas, true);
  canvas.requestPointerLock();
}

function endGame() {
  state.running = false;
  hud.style.display = "none";
  gameOver.style.display = "flex";
  finalScoreEl.textContent = `Score: ${state.score}  |  Kills: ${state.kills}`;
  document.exitPointerLock();
}

// ─── Event listeners ──────────────────────────────────────────────────────────
startBtn.addEventListener("click",   startGame);
restartBtn.addEventListener("click", startGame);

// Re-lock pointer if user clicks canvas during play
canvas.addEventListener("click", () => {
  if (state.running && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
  }
});

// ─── Render loop ──────────────────────────────────────────────────────────────
engine.runRenderLoop(() => {
  if (scene) scene.render();
});

window.addEventListener("resize", () => engine.resize());
