import {
  Vector3,
  StandardMaterial,
  Color3,
  Color4,
  ParticleSystem,
  Mesh,
  AbstractMesh,
  Ray,
} from "@babylonjs/core";
import {
  PLAYER_MAX_HEALTH,
  ENEMY_HP,
  ENEMY_HP_PER_WAVE,
  ENEMY_SPEED,
  ENEMY_MELEE_RANGE,
  ENEMY_MELEE_DAMAGE,
  ENEMY_MELEE_DAMAGE_PER_WAVE,
  ENEMY_MELEE_ATTACKS_PER_MIN,
  ENEMY_MELEE_ATTACKS_PER_MIN_PER_WAVE,
  ENEMY_SPEED_PER_WAVE,
  ENEMY_CHASE_RANGE,
  ENEMY_ZIGZAG_FREQ,
  ENEMY_ZIGZAG_AMPLITUDE,
  PLAYER_BEAM_DAMAGE,
  KILL_SCORE,
  PICKUP_SCORE_INTERVAL,
  PICKUP_DROP_CHANCE,
  PICKUP_HEALTH_AMOUNT,
  PICKUP_COLLECT_RANGE,
  PLAYER_RATE_OF_FIRE,
  PLAYER_SPEED,
  PLAYER_SPRINT_MULTIPLIER,
  PLAYER_ACCELERATION,
  PLAYER_JUMP_SPEED,
  PLAYER_MAG_SIZE,
  PLAYER_RELOAD_TIME,
  WAVE_BASE_ENEMIES,
  WAVE_GROWTH,
  WAVE_SPAWN_INTERVAL_MS,
  WAVE_PAUSE_MS,
  MAX_ENEMIES_ALIVE,
  ARENA_CEIL,
  ARENA_SIZE,
  ENEMY_MIN_SPAWN_DIST,
  WAVE_COMPLETE_SCORE,
  PLAYER_MAX_RESERVE_MAGS,
  PLAYER_SPREAD_PER_SHOT,
  PLAYER_MAX_SPREAD,
  PLAYER_SPREAD_DECAY,
  PLAYER_MOVE_SPREAD_RATE,
  PLAYER_HEAT_PER_SHOT,
  PLAYER_HEAT_MAX,
  PLAYER_HEAT_CRITICAL,
  PLAYER_HEAT_DECAY,
  PLAYER_HEAT_COOLDOWN_DELAY,
  UPGRADE_MAX_HEALTH,
  UPGRADE_SPEED,
  UPGRADE_RELOAD_SPEED,
  UPGRADE_MAG_SIZE,
  UPGRADE_RATE_OF_FIRE,
  UPGRADE_HEAT_CAPACITY,
  UPGRADE_HEAT_DECAY,
  UPGRADE_BLOOM_REDUCTION,
  UPGRADE_MOVE_SPREAD_REDUCTION,
  UPGRADE_DAMAGE,
} from "./constants.js";
import { g, dom, type Enemy } from "./game.js";
import {
  makeBeam,
  makeBulletHoleDisc,
  BULLET_HOLE_SURFACE_OFFSET,
  makeBodySplitHalves,
  makeHeadSplitHalves,
  makeHealthPickup,
  makeAmmoPickup,
  makeEnemyMats,
  makeEnemyPhysCapsule,
  makeEnemyBodyMesh,
  makeEnemyHeadMesh,
  makeRagdollBodyAggregate,
  makeRagdollHeadAggregate,
  makeRagdollHalfAggregate,
} from "./meshBuilders.js";

// ─── Upgrades ────────────────────────────────────────────────────────────────
interface UpgradeDef {
  key: keyof typeof g.upgrades;
  label: string;
  apply: () => void;
}

const UPGRADE_DEFS: UpgradeDef[] = [
  {
    key: "maxHealth",
    label: `+${UPGRADE_MAX_HEALTH} Max Health`,
    apply: () => {
      g.upgrades.maxHealth++;
      g.state.health = Math.min(
        g.state.health + UPGRADE_MAX_HEALTH,
        effectiveMaxHealth(),
      );
      updateHUD();
    },
  },
  {
    key: "speed",
    label: `+${UPGRADE_SPEED} Speed`,
    apply: () => {
      g.upgrades.speed++;
    },
  },
  {
    key: "reloadTime",
    label: `+${Math.round(UPGRADE_RELOAD_SPEED * 100)}% Reload Speed`,
    apply: () => {
      g.upgrades.reloadTime++;
    },
  },
  {
    key: "magSize",
    label: `+${UPGRADE_MAG_SIZE} Mag Size`,
    apply: () => {
      g.upgrades.magSize++;
    },
  },
  {
    key: "rateOfFire",
    label: `+${UPGRADE_RATE_OF_FIRE} RPM`,
    apply: () => {
      g.upgrades.rateOfFire++;
    },
  },
  {
    key: "heatCapacity",
    label: `+${Math.round(UPGRADE_HEAT_CAPACITY * 100)}% Heat Capacity`,
    apply: () => {
      g.upgrades.heatCapacity++;
    },
  },
  {
    key: "heatDecay",
    label: `+${Math.round(UPGRADE_HEAT_DECAY * 100)}% Cooling`,
    apply: () => {
      g.upgrades.heatDecay++;
    },
  },
  {
    key: "bloom",
    label: `-${Math.round(UPGRADE_BLOOM_REDUCTION * 100)}% Bloom`,
    apply: () => {
      g.upgrades.bloom++;
    },
  },
  {
    key: "moveSpread",
    label: `+${Math.round(UPGRADE_MOVE_SPREAD_REDUCTION * 100)}% Accuracy While Moving`,
    apply: () => {
      g.upgrades.moveSpread++;
    },
  },
  {
    key: "damage",
    label: `+${UPGRADE_DAMAGE} Damage`,
    apply: () => {
      g.upgrades.damage++;
    },
  },
];

function effectiveMaxHealth(): number {
  return PLAYER_MAX_HEALTH + g.upgrades.maxHealth * UPGRADE_MAX_HEALTH;
}
function effectiveSpeed(): number {
  return PLAYER_SPEED + g.upgrades.speed * UPGRADE_SPEED;
}
function effectiveReloadTime(): number {
  return (
    PLAYER_RELOAD_TIME *
    Math.pow(1 - UPGRADE_RELOAD_SPEED, g.upgrades.reloadTime)
  );
}
function effectiveMagSize(): number {
  return PLAYER_MAG_SIZE + g.upgrades.magSize * UPGRADE_MAG_SIZE;
}
export function effectiveRateOfFire(): number {
  return PLAYER_RATE_OF_FIRE + g.upgrades.rateOfFire * UPGRADE_RATE_OF_FIRE;
}
function effectiveHeatMax(): number {
  return (
    PLAYER_HEAT_MAX * (1 + g.upgrades.heatCapacity * UPGRADE_HEAT_CAPACITY)
  );
}
function effectiveHeatDecay(): number {
  return PLAYER_HEAT_DECAY * (1 + g.upgrades.heatDecay * UPGRADE_HEAT_DECAY);
}
function effectiveBloom(): number {
  return (
    PLAYER_SPREAD_PER_SHOT *
    Math.max(0.1, 1 - g.upgrades.bloom * UPGRADE_BLOOM_REDUCTION)
  );
}
function effectiveMoveSpreadRate(): number {
  return (
    PLAYER_MOVE_SPREAD_RATE *
    Math.max(0.1, 1 - g.upgrades.moveSpread * UPGRADE_MOVE_SPREAD_REDUCTION)
  );
}
function effectiveDamage(): number {
  return PLAYER_BEAM_DAMAGE + g.upgrades.damage * UPGRADE_DAMAGE;
}

function pickRandomUpgrades(): UpgradeDef[] {
  const shuffled = [...UPGRADE_DEFS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

function showUpgradeMenu(): void {
  const choices = pickRandomUpgrades();
  g.pendingUpgrades = choices.map((c) => c.key);
  for (let i = 0; i < 3; i++) {
    dom.upgradeLabels[i].textContent = choices[i].label;
    const n = g.upgrades[choices[i].key];
    dom.upgradeCounts[i].textContent = n > 0 ? `(${n}x)` : "";
  }
  dom.upgradeMenu.classList.add("visible");
  document.exitPointerLock();
}

function hideUpgradeMenu(): void {
  dom.upgradeMenu.classList.remove("visible");
  g.pendingUpgrades = [];
  dom.canvas.requestPointerLock();
}

export function selectUpgrade(index: number): void {
  if (g.pendingUpgrades.length === 0) return;
  const key = g.pendingUpgrades[index];
  const def = UPGRADE_DEFS.find((d) => d.key === key);
  if (def) def.apply();
  hideUpgradeMenu();
}

// ─── Game loop ────────────────────────────────────────────────────────────────
export function update(): void {
  if (g.state.paused) return;
  const dt = g.engine.getDeltaTime();
  updateTimers(dt);
  updatePlayer();
  updateEnemies();
  updateWeapon(dt);
}

function updateTimers(dt: number): void {
  if (g.state.autoReloadDelay > 0) {
    g.state.autoReloadDelay -= dt;
    if (g.state.autoReloadDelay <= 0) {
      g.state.autoReloadDelay = 0;
      startReload();
    }
  }

  if (g.state.reloading) {
    g.state.reloadTimeLeft -= dt;
    if (g.state.reloadTimeLeft <= 0) completeReload();
  }

  if (g.state.hitFlashTime > 0) {
    g.state.hitFlashTime -= dt;
    if (g.state.hitFlashTime <= 0) {
      g.state.hitFlashTime = 0;
      dom.hitFlash.classList.remove("active");
    }
  }

  // Heat decay
  if (g.state.heat > 0) {
    if (g.state.heatCooldownTimer > 0) {
      g.state.heatCooldownTimer -= dt;
    } else {
      g.state.heat = Math.max(
        0,
        g.state.heat - (effectiveHeatDecay() * dt) / 1000,
      );
      if (g.state.overheated && g.state.heat <= effectiveHeatMax() / 2) {
        g.state.overheated = false;
        dom.overheatMsg.classList.remove("visible");
      }
    }
  }
  // Heat bar display + barrel glow
  const heatMax = effectiveHeatMax();
  const criticalHeat = heatMax * PLAYER_HEAT_CRITICAL;
  const barrelMat = g.weaponBarrel.material as StandardMaterial;
  if (g.state.heat > 0) {
    dom.heatBar.classList.add("visible");
    dom.heatBar.style.width = `${120 * (heatMax / PLAYER_HEAT_MAX)}px`;
    dom.heatFill.style.width = `${(g.state.heat / heatMax) * 100}%`;
    dom.heatFill.classList.toggle("critical", g.state.heat >= criticalHeat);
    if (g.state.heat >= criticalHeat) {
      const t = (g.state.heat - criticalHeat) / (heatMax - criticalHeat);
      barrelMat.emissiveColor = new Color3(t * 0.9, t * 0.15, 0);
    } else {
      barrelMat.emissiveColor = Color3.Black();
    }
  } else {
    dom.heatBar.classList.remove("visible");
    barrelMat.emissiveColor = Color3.Black();
  }

  for (const e of g.enemies) {
    if (e.flashTime > 0) {
      e.flashTime -= dt;
      if (e.flashTime <= 0) {
        e.flashTime = 0;
        if (e.flashMesh) {
          (e.flashMesh.material as StandardMaterial).emissiveColor =
            e.baseEmissive.clone();
          e.flashMesh = null;
        }
      }
    }
  }

  if (g.mouseHeld) {
    g.state.shootCooldown -= dt;
    if (g.state.shootCooldown <= 0) {
      shoot();
      g.state.shootCooldown = 60000 / effectiveRateOfFire();
    }
  } else if (g.shootSpread > 0) {
    g.shootSpread = Math.max(
      0,
      g.shootSpread - (PLAYER_SPREAD_DECAY * dt) / 1000,
    );
  }

  // Movement spread: increase while moving, decay when stopped
  const isMoving =
    g.pressedKeys.has("KeyW") ||
    g.pressedKeys.has("KeyS") ||
    g.pressedKeys.has("KeyA") ||
    g.pressedKeys.has("KeyD");
  if (isMoving) {
    g.moveSpread = Math.min(
      PLAYER_MAX_SPREAD,
      g.moveSpread + (effectiveMoveSpreadRate() * dt) / 1000,
    );
  } else if (g.moveSpread > 0) {
    g.moveSpread = Math.max(
      0,
      g.moveSpread - (PLAYER_SPREAD_DECAY * dt) / 1000,
    );
  }

  // Update crosshair spread offset (map radians to screen pixels)
  const totalSpread =
    Math.min(g.shootSpread, PLAYER_MAX_SPREAD) +
    Math.min(g.moveSpread, PLAYER_MAX_SPREAD);
  const halfFov = g.camera.fov / 2;
  const screenDist = g.engine.getRenderHeight() / (2 * Math.tan(halfFov));
  const chOffset = Math.round(Math.tan(totalSpread) * screenDist);
  dom.chTop.style.bottom = `${3 + chOffset}px`;
  dom.chBottom.style.top = `${3 + chOffset}px`;
  dom.chLeft.style.right = `${3 + chOffset}px`;
  dom.chRight.style.left = `${3 + chOffset}px`;

  // Crosshair color: red when over a living enemy
  const centerRay = g.camera.getForwardRay(100);
  const centerHit = g.scene.pickWithRay(
    centerRay,
    (m: AbstractMesh) =>
      m.name !== "player" &&
      m.name !== "enemyPhys" &&
      m.name !== "laserBeam" &&
      m.name !== "bhole" &&
      m.name !== "pickup" &&
      m.renderingGroupId !== 1,
  );
  const overEnemy =
    centerHit?.hit &&
    centerHit.pickedMesh &&
    (centerHit.pickedMesh.name === "enemyBody" ||
      centerHit.pickedMesh.name === "enemyHead") &&
    g.enemies.some((e) => e.physMesh === centerHit.pickedMesh!.parent);
  const chColor = overEnemy ? "rgba(255,60,60,0.9)" : "rgba(255,255,255,0.85)";
  dom.chTop.style.background = chColor;
  dom.chBottom.style.background = chColor;
  dom.chLeft.style.background = chColor;
  dom.chRight.style.background = chColor;

  for (let i = g.bulletHoles.length - 1; i >= 0; i--) {
    g.bulletHoleTimes[i] -= dt;
    if (g.bulletHoleTimes[i] <= 0) {
      g.bulletHoles[i].dispose();
      g.bulletHoles.splice(i, 1);
      g.bulletHoleTimes.splice(i, 1);
    }
  }

  for (let i = g.glowingHoles.length - 1; i >= 0; i--) {
    const gh = g.glowingHoles[i];
    gh.time -= dt;
    if (gh.mesh.isDisposed()) {
      g.glowingHoles.splice(i, 1);
      continue;
    }
    const mat = gh.mesh.material as StandardMaterial;
    if (gh.time <= 0) {
      mat.emissiveColor = BULLET_HOLE_DARK;
      g.glowingHoles.splice(i, 1);
    } else {
      const t = 1 - gh.time / BULLET_HOLE_GLOW_MS;
      if (t < 0.5) {
        const s = t / 0.5;
        mat.emissiveColor = new Color3(1, 0.9 - 0.5 * s, 0.2 - 0.15 * s);
      } else {
        const s = (t - 0.5) / 0.5;
        mat.emissiveColor = new Color3(
          1 - 0.4 * s,
          0.4 - 0.35 * s,
          0.05 - 0.03 * s,
        );
      }
    }
  }

  if (g.state.running) updateWaves(dt);

  for (let i = g.pickups.length - 1; i >= 0; i--) {
    const p = g.pickups[i];
    const dist = Vector3.Distance(g.playerMesh.position, p.mesh.position);
    if (dist < PICKUP_COLLECT_RANGE) {
      const maxReserve = PLAYER_MAX_RESERVE_MAGS * effectiveMagSize();
      if (p.type === "health" && g.state.health >= effectiveMaxHealth())
        continue;
      if (p.type === "ammo" && g.state.reserve >= maxReserve) continue;
      if (p.type === "health") {
        g.state.health = Math.min(
          effectiveMaxHealth(),
          g.state.health + PICKUP_HEALTH_AMOUNT,
        );
      } else {
        g.state.reserve = Math.min(
          maxReserve,
          g.state.reserve + effectiveMagSize(),
        );
      }
      updateHUD();
      if (p.type === "health") playHealthPickupSound();
      else playAmmoPickupSound();
      p.aggregate.dispose();
      p.mesh.dispose();
      g.pickups.splice(i, 1);
    }
  }
}

// ─── Player ───────────────────────────────────────────────────────────────────
function updatePlayer(): void {
  if (!g.state.running) return;

  const p = g.playerMesh.position;
  g.camera.position.set(p.x, p.y + 0.7, p.z);

  const fwd = g.camera.getForwardRay().direction;
  const forwardXZ = new Vector3(fwd.x, 0, fwd.z);
  if (forwardXZ.lengthSquared() > 0) forwardXZ.normalize();
  const right = Vector3.Cross(Vector3.Up(), forwardXZ);

  const wish = Vector3.Zero();
  if (g.pressedKeys.has("KeyW")) wish.addInPlace(forwardXZ);
  if (g.pressedKeys.has("KeyS")) wish.subtractInPlace(forwardXZ);
  if (g.pressedKeys.has("KeyA")) wish.subtractInPlace(right);
  if (g.pressedKeys.has("KeyD")) wish.addInPlace(right);

  const sprintKey =
    g.pressedKeys.has("ShiftLeft") || g.pressedKeys.has("ShiftRight");
  const nowSprinting = sprintKey && wish.lengthSquared() > 0;

  if (nowSprinting && !g.isSprinting && g.state.reloading) {
    g.state.reloading = false;
    g.state.reloadTimeLeft = 0;
    dom.reloadMsg.classList.remove("visible");
  }
  g.isSprinting = nowSprinting;

  const maxSpeed = nowSprinting
    ? effectiveSpeed() * PLAYER_SPRINT_MULTIPLIER
    : effectiveSpeed();
  const targetXZ =
    wish.lengthSquared() > 0
      ? wish.normalize().scale(maxSpeed)
      : Vector3.Zero();

  g.playerVelocityXZ = Vector3.Lerp(
    g.playerVelocityXZ,
    targetXZ,
    PLAYER_ACCELERATION,
  );

  const vel = g.playerAggregate.body.getLinearVelocity();
  g.playerAggregate.body.setLinearVelocity(
    new Vector3(g.playerVelocityXZ.x, vel.y, g.playerVelocityXZ.z),
  );
}

export function tryJump(): void {
  if (!g.state.running || g.state.paused) return;

  const vel = g.playerAggregate.body.getLinearVelocity();
  if (Math.abs(vel.y) > 2) return;

  const groundRay = new Ray(g.playerMesh.position, new Vector3(0, -1, 0), 1.05);
  const hit = g.scene.pickWithRay(
    groundRay,
    (m: AbstractMesh) =>
      m.renderingGroupId !== 1 &&
      m.name !== "player" &&
      m.name !== "enemyPhys" &&
      m.name !== "laserBeam" &&
      m.name !== "bhole" &&
      m.name !== "pickup",
  );
  if (!hit?.hit) return;

  g.playerAggregate.body.setLinearVelocity(
    new Vector3(g.playerVelocityXZ.x, PLAYER_JUMP_SPEED, g.playerVelocityXZ.z),
  );
}

// ─── Weapon animation ─────────────────────────────────────────────────────────
function updateWeapon(dt: number): void {
  if (!g.weaponRoot) return;

  if (g.isSprinting) {
    g.sprintBobTime += dt;
    g.weaponRoot.rotation.x = 0.14 * Math.sin(g.sprintBobTime / 150);
    g.weaponRoot.rotation.z = 0.07 * Math.sin(g.sprintBobTime / 300);
    dom.crosshair.style.display = "none";
    return;
  }

  dom.crosshair.style.display = "";
  g.sprintBobTime = 0;

  if (!g.state.reloading) {
    g.weaponRoot.rotation.x = 0;
    g.weaponRoot.rotation.z = 0;
    g.weaponCell.isVisible = true;
    g.weaponCell.position.y = 0.09;
    return;
  }

  const progress = 1 - g.state.reloadTimeLeft / effectiveReloadTime();

  const TILT = -0.7;
  let tilt: number;
  if (progress < 0.2) {
    tilt = TILT * (progress / 0.2);
  } else if (progress < 0.8) {
    tilt = TILT;
  } else {
    tilt = TILT * (1 - (progress - 0.8) / 0.2);
  }
  g.weaponRoot.rotation.x = tilt;

  if (progress < 0.25) {
    g.weaponCell.isVisible = true;
    g.weaponCell.position.y = 0.09;
  } else if (progress < 0.35) {
    const t = (progress - 0.25) / 0.1;
    g.weaponCell.isVisible = true;
    g.weaponCell.position.y = 0.09 + t * 0.15;
  } else if (progress < 0.65) {
    g.weaponCell.isVisible = false;
    g.weaponCell.position.y = 0.09;
  } else if (progress < 0.75) {
    const t = (progress - 0.65) / 0.1;
    g.weaponCell.isVisible = true;
    g.weaponCell.position.y = 0.09 + (1 - t) * 0.15;
  } else {
    g.weaponCell.isVisible = true;
    g.weaponCell.position.y = 0.09;
  }
}

// ─── Enemies ──────────────────────────────────────────────────────────────────
function updateEnemies(): void {
  if (!g.state.running) return;
  const camPos = g.camera.position;

  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    const pos = e.physMesh.position;
    const toPlayer = camPos.subtract(pos);
    const dist = toPlayer.length();

    e.bodyMesh.lookAt(new Vector3(camPos.x, pos.y, camPos.z));

    if (dist < ENEMY_CHASE_RANGE) e.state = "chase";

    const currentVel = e.aggregate.body.getLinearVelocity();

    if (e.state === "chase") {
      const dirXZ = new Vector3(toPlayer.x, 0, toPlayer.z);
      if (dirXZ.lengthSquared() > 0) dirXZ.normalize();

      // Zigzag lateral offset
      e.zigzagTimer +=
        (g.engine.getDeltaTime() / 1000) * ENEMY_ZIGZAG_FREQ * Math.PI * 2;
      const lateral = new Vector3(-dirXZ.z, 0, dirXZ.x);
      const zigzag = Math.sin(e.zigzagTimer) * ENEMY_ZIGZAG_AMPLITUDE;
      const moveDir = dirXZ.add(lateral.scale(zigzag)).normalize();

      e.aggregate.body.setLinearVelocity(
        new Vector3(moveDir.x * e.speed, currentVel.y, moveDir.z * e.speed),
      );

      if (dist < ENEMY_MELEE_RANGE) {
        e.attackCooldown -= g.engine.getDeltaTime();
        if (e.attackCooldown <= 0) {
          damagePlayer(e.meleeDamage);
          e.attackCooldown = e.meleeIntervalMs;
        }
      }
    } else {
      const toTarget = e.patrolTarget.subtract(pos);
      const toTargetXZ = new Vector3(toTarget.x, 0, toTarget.z);

      if (toTargetXZ.length() < 0.5) {
        e.patrolTarget = new Vector3(
          (Math.random() - 0.5) * 24,
          pos.y,
          (Math.random() - 0.5) * 24,
        );
      }

      const dirXZ =
        toTargetXZ.length() > 0 ? toTargetXZ.normalize() : Vector3.Zero();
      e.aggregate.body.setLinearVelocity(
        new Vector3(
          dirXZ.x * e.speed * 0.5,
          currentVel.y,
          dirXZ.z * e.speed * 0.5,
        ),
      );
    }
  }
}

// ─── Enemy spawning ─────────────────────────────────────────────────────────
function spawnEnemy(): void {
  const playerPos = g.playerMesh.position;
  let x: number, z: number;
  do {
    x = (Math.random() * 2 - 1) * (ARENA_SIZE / 2 - 2);
    z = (Math.random() * 2 - 1) * (ARENA_SIZE / 2 - 2);
  } while (
    (x - playerPos.x) ** 2 + (z - playerPos.z) ** 2 <
    ENEMY_MIN_SPAWN_DIST ** 2
  );

  const { mesh: physMesh, aggregate } = makeEnemyPhysCapsule(
    new Vector3(x, ARENA_CEIL - 0.5, z),
  );

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
    hp: ENEMY_HP + ENEMY_HP_PER_WAVE * (g.state.wave - 1),
    maxHp: ENEMY_HP + ENEMY_HP_PER_WAVE * (g.state.wave - 1),
    speed: ENEMY_SPEED + ENEMY_SPEED_PER_WAVE * (g.state.wave - 1),
    state: "patrol",
    patrolTarget: physMesh.position.clone(),
    attackCooldown: 0,
    meleeDamage:
      ENEMY_MELEE_DAMAGE + ENEMY_MELEE_DAMAGE_PER_WAVE * (g.state.wave - 1),
    meleeIntervalMs:
      60000 /
      (ENEMY_MELEE_ATTACKS_PER_MIN +
        ENEMY_MELEE_ATTACKS_PER_MIN_PER_WAVE * (g.state.wave - 1)),
    zigzagTimer: Math.random() * Math.PI * 2,
    flashTime: 0,
    flashMesh: null,
    baseEmissive: bodyMat.diffuseColor.scale(0.2),
  });
  playEnemySpawnSound();
}

// ─── Waves ───────────────────────────────────────────────────────────────────
function waveEnemyCount(wave: number): number {
  return WAVE_BASE_ENEMIES + WAVE_GROWTH * (wave - 1);
}

function startNextWave(): void {
  // Auto-select first upgrade if player hasn't chosen
  if (g.pendingUpgrades.length > 0) selectUpgrade(0);
  g.state.wave++;
  g.state.waveEnemiesLeft = waveEnemyCount(g.state.wave);
  g.state.waveSpawnTimer = 0;
  g.state.waveActive = true;
  showWaveBanner(`Wave ${g.state.wave}`);
  updateHUD();
}

function updateWaves(dt: number): void {
  // Between waves — count down the pause timer
  if (!g.state.waveActive) {
    g.state.wavePauseTimer -= dt;
    if (g.state.wavePauseTimer <= 0) startNextWave();
    return;
  }

  // Wave active — spawn enemies one at a time on an interval
  if (g.state.waveEnemiesLeft > 0 && g.enemies.length < MAX_ENEMIES_ALIVE) {
    g.state.waveSpawnTimer -= dt;
    if (g.state.waveSpawnTimer <= 0) {
      spawnEnemy();
      g.state.waveEnemiesLeft--;
      g.state.waveSpawnTimer = WAVE_SPAWN_INTERVAL_MS;
    }
  }

  // All enemies spawned and killed — wave complete
  if (g.state.waveEnemiesLeft <= 0 && g.enemies.length === 0) {
    g.state.waveActive = false;
    g.state.wavePauseTimer = WAVE_PAUSE_MS;
    showWaveBanner(`Wave ${g.state.wave} Complete`);

    // Reward: spawn pickups in front of player + score bonus
    const fwd = g.camera.getForwardRay(3).direction;
    const frontPos = g.camera.position.add(fwd.scale(3));
    frontPos.y = 0.5;
    spawnPickup(frontPos.clone(), "health");
    spawnPickup(new Vector3(frontPos.x + 0.6, frontPos.y, frontPos.z), "ammo");
    incrementScore(WAVE_COMPLETE_SCORE, frontPos);
    showUpgradeMenu();
  }
}

export function showWaveBanner(text: string): void {
  dom.waveBanner.textContent = text;
  dom.waveBanner.classList.add("visible");
  setTimeout(() => dom.waveBanner.classList.remove("visible"), 2500);
}

// ─── Shooting ─────────────────────────────────────────────────────────────────
export function shoot(): void {
  if (
    !g.state.running ||
    g.state.reloading ||
    g.isSprinting ||
    g.state.overheated
  )
    return;
  if (g.state.ammo <= 0) {
    startReload();
    return;
  }

  g.state.ammo--;
  g.state.heat = Math.min(
    g.state.heat + PLAYER_HEAT_PER_SHOT,
    effectiveHeatMax(),
  );
  g.state.heatCooldownTimer = PLAYER_HEAT_COOLDOWN_DELAY;
  if (g.state.heat >= effectiveHeatMax()) {
    g.state.overheated = true;
    g.state.heatCooldownTimer = PLAYER_HEAT_COOLDOWN_DELAY * 2;
    dom.overheatMsg.classList.add("visible");
    playOverheatSound();
    spawnSmokeParticles();
  }
  updateHUD();

  const ray = g.camera.getForwardRay(100);
  const shotSpread = g.shootSpread + g.moveSpread;
  if (shotSpread > 0) {
    const angle = Math.random() * Math.PI * 2;
    const magnitude = Math.random() * shotSpread;
    const up = g.camera.upVector;
    const right = Vector3.Cross(ray.direction, up).normalize();
    const trueUp = Vector3.Cross(right, ray.direction).normalize();
    ray.direction.addInPlace(right.scale(Math.cos(angle) * magnitude));
    ray.direction.addInPlace(trueUp.scale(Math.sin(angle) * magnitude));
    ray.direction.normalize();
  }
  g.shootSpread = Math.min(g.shootSpread + effectiveBloom(), PLAYER_MAX_SPREAD);
  const hit = g.scene.pickWithRay(
    ray,
    (m: AbstractMesh) =>
      m.renderingGroupId !== 1 &&
      m.name !== "player" &&
      m.name !== "enemyPhys" &&
      m.name !== "laserBeam" &&
      m.name !== "bhole" &&
      m.name !== "pickup",
  );

  const beamEnd =
    hit?.hit && hit.pickedPoint
      ? hit.pickedPoint
      : ray.origin.add(ray.direction.scale(100));
  spawnLaserBeam(g.barrelTip.getAbsolutePosition(), beamEnd);

  if (hit?.hit && hit.pickedMesh) {
    if (
      hit.pickedMesh.name === "enemyBody" ||
      hit.pickedMesh.name === "enemyHead"
    ) {
      const enemy = g.enemies.find(
        (e) => e.physMesh === hit.pickedMesh!.parent,
      );
      if (enemy) {
        hitEnemy(enemy, hit.pickedMesh as Mesh, hit.pickedPoint ?? undefined);
        if (hit.pickedPoint) {
          const hitNormal = hit.getNormal(true) ?? ray.direction.negate();
          spawnHitParticle(
            hit.pickedPoint,
            new Color4(0.8, 0.0, 0.0, 1),
            hitNormal,
          );
          if (g.enemies.includes(enemy)) {
            spawnBulletHole(
              hit.pickedPoint,
              hit.getNormal(true),
              hit.pickedMesh as Mesh,
            );
          }
        }
      } else {
        splitRagdoll(
          hit.pickedMesh as Mesh,
          ray.direction,
          hit.pickedPoint ?? undefined,
        );
      }
    } else if (
      hit.pickedMesh.name === "bodyHalf" ||
      hit.pickedMesh.name === "headHalf"
    ) {
      hitDebris(
        hit.pickedMesh as Mesh,
        ray.direction,
        hit.pickedPoint ?? undefined,
      );
      if (hit.pickedPoint) {
        const hitNormal = hit.getNormal(true) ?? ray.direction.negate();
        spawnHitParticle(
          hit.pickedPoint,
          new Color4(0.8, 0.0, 0.0, 1),
          hitNormal,
        );
      }
    } else if (hit.pickedPoint) {
      spawnBulletHole(hit.pickedPoint, hit.getNormal(true));
    }
  }

  if (g.state.ammo === 0 && g.state.reserve > 0) g.state.autoReloadDelay = 300;
}

function hitEnemy(enemy: Enemy, hitMesh: Mesh, hitPoint?: Vector3): void {
  const headshot = hitMesh.name === "enemyHead";
  const hMax = effectiveHeatMax();
  const critHeat = hMax * PLAYER_HEAT_CRITICAL;
  const heatPenalty =
    g.state.heat >= critHeat
      ? 1 - 0.6 * ((g.state.heat - critHeat) / (hMax - critHeat))
      : 1;
  enemy.hp -= Math.round(
    effectiveDamage() *
      (0.8 + Math.random() * 0.4) *
      (headshot ? 2 : 1) *
      heatPenalty,
  );

  (hitMesh.material as StandardMaterial).emissiveColor = new Color3(1, 0, 0);
  enemy.flashMesh = hitMesh;
  enemy.flashTime = (60000 / effectiveRateOfFire()) * 0.6;

  if (enemy.hp <= 0) killEnemy(enemy, hitMesh, hitPoint);
}

function killEnemy(enemy: Enemy, killMesh: Mesh, hitPoint?: Vector3): void {
  playEnemyDeathSound();

  const bodyWorldPos = enemy.bodyMesh.getAbsolutePosition().clone();
  const headWorldPos = enemy.headMesh.getAbsolutePosition().clone();
  const isHeadshot = killMesh.name === "enemyHead";

  spawnDeathParticle(isHeadshot ? headWorldPos : bodyWorldPos);

  if (enemy.flashMesh) {
    (enemy.flashMesh.material as StandardMaterial).emissiveColor =
      enemy.baseEmissive.clone();
    enemy.flashMesh = null;
  }

  // Unparent both meshes before disposing the capsule so they aren't recursively destroyed
  const bodyMat = enemy.bodyMesh.material as StandardMaterial;
  const headMat = enemy.headMesh.material as StandardMaterial;
  enemy.bodyMesh.parent = null;
  enemy.bodyMesh.position = bodyWorldPos;
  enemy.headMesh.parent = null;
  enemy.headMesh.position = headWorldPos;

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

  if (isHeadshot) {
    enemy.headMesh.dispose();
    const [topHalf, bottomHalf] = makeHeadSplitHalves(headWorldPos, headMat);
    const topAgg = makeRagdollHalfAggregate(topHalf, 1);
    topAgg.body.applyImpulse(
      new Vector3(awayDir.x * 4, 6 + Math.random() * 3, awayDir.z * 4),
      headWorldPos,
    );
    const bottomAgg = makeRagdollHalfAggregate(bottomHalf, 1);
    bottomAgg.body.applyImpulse(
      new Vector3(awayDir.x * 2, 1 + Math.random() * 2, awayDir.z * 2),
      headWorldPos,
    );
    setTimeout(() => {
      topAgg.dispose();
      topHalf.dispose();
      bottomAgg.dispose();
      bottomHalf.dispose();
    }, 3500);

    const bodyAgg = makeRagdollBodyAggregate(enemy.bodyMesh);
    bodyAgg.body.applyImpulse(
      awayDir.scale(40),
      bodyWorldPos.add(new Vector3(0, 0.7, 0)),
    );
    setTimeout(() => {
      bodyAgg.dispose();
      enemy.bodyMesh.dispose();
    }, 3500);
  } else {
    enemy.bodyMesh.dispose();
    const [topHalf, bottomHalf] = makeBodySplitHalves(bodyWorldPos, bodyMat);
    const topAgg = makeRagdollHalfAggregate(topHalf, 5);
    topAgg.body.applyImpulse(
      new Vector3(awayDir.x * 22, 18, awayDir.z * 22),
      bodyWorldPos.add(new Vector3(0, 0.4, 0)),
    );
    const bottomAgg = makeRagdollHalfAggregate(bottomHalf, 5);
    bottomAgg.body.applyImpulse(
      new Vector3(awayDir.x * 14, -5, awayDir.z * 14),
      bodyWorldPos,
    );
    setTimeout(() => {
      topAgg.dispose();
      topHalf.dispose();
      bottomAgg.dispose();
      bottomHalf.dispose();
    }, 3500);

    const headAgg = makeRagdollHeadAggregate(enemy.headMesh);
    headAgg.body.applyImpulse(
      new Vector3(
        (Math.random() - 0.5) * 8,
        3 + Math.random() * 4,
        (Math.random() - 0.5) * 8,
      ),
      headWorldPos,
    );
    setTimeout(() => {
      headAgg.dispose();
      enemy.headMesh.dispose();
    }, 3500);
  }

  g.state.kills++;
  incrementScore(
    isHeadshot ? Math.round(KILL_SCORE * 1.5) : KILL_SCORE,
    hitPoint,
  );
}

function splitRagdoll(mesh: Mesh, beamDir: Vector3, hitPoint?: Vector3): void {
  const worldPos = mesh.getAbsolutePosition().clone();
  const mat = mesh.material as StandardMaterial;
  const isHead = mesh.name === "enemyHead";

  if (mesh.physicsBody) mesh.physicsBody.dispose();
  mesh.dispose();

  const awayDir = hitPoint
    ? new Vector3(
        worldPos.x - hitPoint.x,
        0,
        worldPos.z - hitPoint.z,
      ).normalizeToNew()
    : beamDir.normalize();

  const [topHalf, bottomHalf] = isHead
    ? makeHeadSplitHalves(worldPos, mat)
    : makeBodySplitHalves(worldPos, mat);

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

function hitDebris(mesh: Mesh, beamDir: Vector3, hitPoint?: Vector3): void {
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

function incrementScore(amount: number, hitPoint?: Vector3): void {
  g.state.score += amount;
  updateHUD();
  while (g.state.score >= g.state.nextPickupThreshold) {
    g.state.nextPickupThreshold += PICKUP_SCORE_INTERVAL;
    if (Math.random() < PICKUP_DROP_CHANCE && hitPoint) {
      spawnPickup(hitPoint.clone());
    }
  }
}

function spawnPickup(position: Vector3, forceType?: "health" | "ammo"): void {
  const type = forceType ?? (Math.random() < 0.5 ? "health" : "ammo");
  const { mesh, aggregate } =
    type === "health" ? makeHealthPickup(position) : makeAmmoPickup(position);
  g.pickups.push({ mesh, aggregate, type });
}

export function startReload(): void {
  if (
    g.state.reloading ||
    g.state.reserve <= 0 ||
    g.state.ammo >= effectiveMagSize() ||
    g.isSprinting ||
    g.state.overheated
  )
    return;
  g.state.reloading = true;
  g.state.reloadTimeLeft = effectiveReloadTime();
  dom.reloadMsg.classList.add("visible");
  playReloadSounds();
}

function completeReload(): void {
  const take = Math.min(effectiveMagSize() - g.state.ammo, g.state.reserve);
  g.state.ammo += take;
  g.state.reserve -= take;
  g.state.reloading = false;
  g.state.reloadTimeLeft = 0;
  dom.reloadMsg.classList.remove("visible");
  updateHUD();
}

// ─── Player damage ────────────────────────────────────────────────────────────
export function damagePlayer(amount: number): void {
  g.state.health = Math.max(0, g.state.health - amount);
  updateHUD();
  dom.hitFlash.classList.add("active");
  g.state.hitFlashTime = 200;
  if (g.state.health <= 0) endGame();
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
export function updateHUD(): void {
  const maxHp = effectiveMaxHealth();
  const hpFrac = g.state.health / maxHp;
  const baseWidth = 120;
  const barWidth = baseWidth * (maxHp / PLAYER_MAX_HEALTH);
  dom.healthBar.style.width = `${barWidth}px`;
  dom.healthFill.style.width = `${hpFrac * 100}%`;
  dom.healthFill.style.background =
    hpFrac > 0.5 ? "#4f4" : hpFrac > 0.25 ? "#fa0" : "#f44";
  dom.healthText.textContent = `${Math.ceil(g.state.health)} / ${maxHp}`;
  dom.ammoEl.textContent = `${g.state.ammo} / ${g.state.reserve}`;
  dom.scoreEl.textContent = String(g.state.score);
  dom.killsEl.textContent = String(g.state.kills);
  dom.waveValue.textContent = String(g.state.wave);
  dom.waveRemaining.textContent = String(
    g.state.waveEnemiesLeft + g.enemies.length,
  );
}

// ─── Game flow ────────────────────────────────────────────────────────────────
export function pause(): void {
  g.state.paused = true;
  g.mouseHeld = false;
  g.pressedKeys.clear();
  g.scene.physicsEnabled = false;
  dom.pauseScreen.style.display = "flex";
  dom.hud.classList.add("paused");
}

export function resume(): void {
  g.state.paused = false;
  g.scene.physicsEnabled = true;
  dom.pauseScreen.style.display = "none";
  dom.hud.classList.remove("paused");
}

export function endGame(): void {
  g.state.running = false;
  g.mouseHeld = false;
  g.pressedKeys.clear();
  dom.hud.style.display = "none";
  dom.gameOver.style.display = "flex";
  dom.finalWaveEl.textContent = `Wave: ${g.state.wave}`;
  dom.finalScoreEl.textContent = `Score: ${g.state.score}  |  Kills: ${g.state.kills}`;
  document.exitPointerLock();
}

// ─── Spawn effects ────────────────────────────────────────────────────────────
function spawnLaserBeam(from: Vector3, to: Vector3): void {
  const dist = Vector3.Distance(from, to);
  if (dist < 0.05) return;

  playBeamSound();

  const beam = makeBeam(from, to);
  const beamHeatMax = effectiveHeatMax();
  const critHeat = beamHeatMax * PLAYER_HEAT_CRITICAL;
  if (g.state.heat >= critHeat) {
    const t = (g.state.heat - critHeat) / (beamHeatMax - critHeat);
    const mat = beam.material as StandardMaterial;
    mat.alpha = 1 - t * 0.6;
    mat.emissiveColor = Color3.Lerp(
      mat.emissiveColor,
      new Color3(0.2, 0.3, 0.3),
      t,
    );
  }
  setTimeout(() => beam.dispose(), (60000 / effectiveRateOfFire()) * 0.6);
}

function spawnHitParticle(
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

function spawnDeathParticle(position: Vector3): void {
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

const BULLET_HOLE_GLOW_MS = 1500;
const BULLET_HOLE_DARK = new Color3(0.02, 0.02, 0.02);

function spawnBulletHole(
  position: Vector3,
  normal: Vector3 | null,
  parentMesh?: Mesh,
): void {
  if (!parentMesh && g.bulletHoles.length >= 200) {
    g.bulletHoles.shift()!.dispose();
    g.bulletHoleTimes.shift();
  }

  const disc = makeBulletHoleDisc();
  (disc.material as StandardMaterial).emissiveColor = new Color3(1, 0.9, 0.2);
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
  g.glowingHoles.push({ mesh: disc, time: BULLET_HOLE_GLOW_MS });
}

// ─── Audio ────────────────────────────────────────────────────────────────────
function playReloadSounds(): void {
  if (!g.beamAudioCtx) g.beamAudioCtx = new AudioContext();
  if (g.beamAudioCtx.state === "suspended") g.beamAudioCtx.resume();
  const ctx = g.beamAudioCtx;

  setTimeout(() => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }, effectiveReloadTime() * 0.25);

  setTimeout(() => {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.1);
    const pingGain = ctx.createGain();
    pingGain.gain.setValueAtTime(0.14, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(pingGain);
    pingGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    const bufSize = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.2, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    noise.connect(clickGain);
    clickGain.connect(ctx.destination);
    noise.start(now);
  }, effectiveReloadTime() * 0.65);
}

function playEnemyDeathSound(): void {
  if (!g.beamAudioCtx) g.beamAudioCtx = new AudioContext();
  if (g.beamAudioCtx.state === "suspended") g.beamAudioCtx.resume();
  const ctx = g.beamAudioCtx;
  const now = ctx.currentTime;

  // Impact thud — filtered noise burst
  const bufSize = Math.floor(ctx.sampleRate * 0.15);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);

  // Low descending tone
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.25, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.36);
}

function playBeamSound(): void {
  if (!g.beamAudioCtx) g.beamAudioCtx = new AudioContext();
  if (g.beamAudioCtx.state === "suspended") g.beamAudioCtx.resume();

  const ctx = g.beamAudioCtx;
  const duration = ((60000 / effectiveRateOfFire()) * 0.6) / 1000;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.exponentialRampToValueAtTime(160, now + duration * 0.8);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

function playEnemySpawnSound(): void {
  if (!g.beamAudioCtx) g.beamAudioCtx = new AudioContext();
  if (g.beamAudioCtx.state === "suspended") g.beamAudioCtx.resume();
  const ctx = g.beamAudioCtx;
  const now = ctx.currentTime;

  // Whoosh — filtered noise sweep
  const bufSize = Math.floor(ctx.sampleRate * 0.3);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
  filter.Q.value = 2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
}

function playHealthPickupSound(): void {
  if (!g.beamAudioCtx) g.beamAudioCtx = new AudioContext();
  if (g.beamAudioCtx.state === "suspended") g.beamAudioCtx.resume();
  const ctx = g.beamAudioCtx;
  const now = ctx.currentTime;

  // Bright ascending two-tone chime
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(520, now);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.2, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc1.connect(g1);
  g1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.16);

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(780, now + 0.08);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.001, now);
  g2.gain.setValueAtTime(0.2, now + 0.08);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc2.connect(g2);
  g2.connect(ctx.destination);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.26);
}

function playAmmoPickupSound(): void {
  if (!g.beamAudioCtx) g.beamAudioCtx = new AudioContext();
  if (g.beamAudioCtx.state === "suspended") g.beamAudioCtx.resume();
  const ctx = g.beamAudioCtx;
  const now = ctx.currentTime;

  // Metallic click-clack
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.06);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.09);

  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(450, now + 0.06);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.001, now);
  g2.gain.setValueAtTime(0.12, now + 0.06);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc2.connect(g2);
  g2.connect(ctx.destination);
  osc2.start(now + 0.06);
  osc2.stop(now + 0.16);
}

function playOverheatSound(): void {
  if (!g.beamAudioCtx) g.beamAudioCtx = new AudioContext();
  if (g.beamAudioCtx.state === "suspended") g.beamAudioCtx.resume();
  const ctx = g.beamAudioCtx;
  const now = ctx.currentTime;

  // Hissing steam burst
  const bufSize = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(3000, now);
  filter.frequency.exponentialRampToValueAtTime(1000, now + 0.5);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);

  // Low warning tone
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120, now);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.15, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.31);
}

function spawnSmokeParticles(): void {
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
  // Track barrel tip position while emitting
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
