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
  ENEMY_TURN_SPEED,
  ENEMY_ZIGZAG_FREQ,
  ENEMY_ZIGZAG_AMPLITUDE,
  KILL_SCORE,
  SUPPLY_SCORE_INTERVAL,
  SUPPLY_HEALTH_AMOUNT,
  SUPPLY_COLLECT_RANGE,
  PLAYER_SPRINT_MULTIPLIER,
  PLAYER_ACCELERATION,
  PLAYER_JUMP_SPEED,
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
  PLAYER_MAX_SPREAD,
  PLAYER_SPREAD_DECAY,
  PLAYER_MAX_HEALTH,
  PLAYER_HEAT_PER_SHOT,
  PLAYER_HEAT_MAX,
  PLAYER_HEAT_CRITICAL,
  PLAYER_HEAT_COOLDOWN_DELAY,
  PLAYER_ORB_AMMO_COST,
  PLAYER_ORB_HEAT_MULTIPLIER,
  PLAYER_ORB_COOLDOWN_MULTIPLIER,
  PLAYER_ORB_DAMAGE,
  PLAYER_ORB_RADIUS,
  PLAYER_ORB_SPEED,
  PLAYER_ORB_EXPLOSION_RADIUS,
  PLAYER_ORB_SPLASH_FALLOFF,
} from "./constants.js";
import { g, dom, type Enemy, type Orb } from "./game.js";
import {
  makeBeam,
  makeBulletHoleDisc,
  BULLET_HOLE_SURFACE_OFFSET,
  makeBodySplitHalves,
  makeHeadSplitHalves,
  makeHealthSupply,
  makeAmmoSupply,
  makeOrbMesh,
  makeOrbChargeMesh,
  makeEnemyMats,
  makeEnemyPhysCapsule,
  makeEnemyBodyMesh,
  makeEnemyHeadMesh,
  makeEnemyLegMesh,
  makeRagdollBodyAggregate,
  makeRagdollHeadAggregate,
  makeRagdollHalfAggregate,
} from "./meshBuilders.js";
import {
  updateAudioListener,
  playReloadSounds,
  playBeamSound,
  playOverheatSound,
  playEnemyDeathSound,
  playEnemySpawnSound,
  playEnemyFootstep,
  playEnemyAttackSound,
  playHealthSupplySound,
  playAmmoSupplySound,
  playOrbLaunchSound,
  playOrbExplosionSound,
  startOrbChargeSound,
  updateOrbChargeSound,
  stopOrbChargeSound,
} from "./audio.js";
import {
  effectiveMaxHealth,
  effectiveSpeed,
  effectiveReloadTime,
  effectiveMagSize,
  effectiveCooldown,
  effectiveHeatMax,
  effectiveHeatDecay,
  effectiveBloom,
  effectiveMoveSpreadRate,
  effectiveBeamDamage,
  effectiveOrbDamage,
  showUpgradeMenu,
  selectUpgrade,
  effectiveSupplyDropRate,
  effectiveCritChance,
  effectiveCritDamage,
  setUpdateHUD,
} from "./upgrades.js";
export { selectUpgrade };

// Register updateHUD callback for upgrades (defined below, but hoisted)
setUpdateHUD(() => updateHUD());

function isEnemyPart(name: string): boolean {
  return name === "enemyBody" || name === "enemyHead" || name === "enemyLeg";
}

function findEnemyByMesh(
  mesh: AbstractMesh,
): { enemy: Enemy; hitMesh: Mesh } | null {
  // body/head: parent is visualRoot
  // leg: parent is pivot, pivot.parent is visualRoot
  const parent = mesh.parent;
  if (!parent) return null;
  let enemy = g.enemies.find((e) => e.visualRoot === parent);
  if (!enemy && parent.parent) {
    enemy = g.enemies.find((e) => e.visualRoot === parent.parent);
  }
  if (!enemy) return null;
  // For leg hits, use bodyMesh as the flash target
  const hitMesh = mesh.name === "enemyLeg" ? enemy.bodyMesh : (mesh as Mesh);
  return { enemy, hitMesh };
}

// ─── Game loop ────────────────────────────────────────────────────────────────
export function update(): void {
  if (g.state.paused) return;
  const dt = g.engine.getDeltaTime();
  updateAudioListener();
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

  // Heat decay (blocked while charging orb)
  if (g.state.heat > 0 && !g.orbCharging) {
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
    }
  } else if (
    g.shootSpread > 0 &&
    g.state.shootCooldown <= 0 &&
    !g.orbCharging
  ) {
    g.shootSpread = Math.max(
      0,
      g.shootSpread - (PLAYER_SPREAD_DECAY * dt) / 1000,
    );
  }
  if (!g.mouseHeld && g.state.shootCooldown > 0) {
    g.state.shootCooldown -= dt;
  }

  if (g.state.orbCooldown > 0) g.state.orbCooldown -= dt;
  if (g.orbCharging) updateOrbCharge(dt);
  updateOrbs(dt);

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
      m.name !== "supply" &&
      m.renderingGroupId !== 1,
  );
  const overEnemy =
    centerHit?.hit &&
    centerHit.pickedMesh &&
    isEnemyPart(centerHit.pickedMesh.name) &&
    findEnemyByMesh(centerHit.pickedMesh) !== null;
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

  for (let i = g.supplies.length - 1; i >= 0; i--) {
    const p = g.supplies[i];
    const dist = Vector3.Distance(g.playerMesh.position, p.mesh.position);
    if (dist < SUPPLY_COLLECT_RANGE) {
      const maxReserve = PLAYER_MAX_RESERVE_MAGS * effectiveMagSize();
      if (p.type === "health" && g.state.health >= effectiveMaxHealth())
        continue;
      if (p.type === "ammo" && g.state.reserve >= maxReserve) continue;
      if (p.type === "health") {
        g.state.health = Math.min(
          effectiveMaxHealth(),
          g.state.health + SUPPLY_HEALTH_AMOUNT,
        );
      } else {
        g.state.reserve = Math.min(
          maxReserve,
          g.state.reserve + effectiveMagSize(),
        );
      }
      updateHUD();
      const supplyPos = p.mesh.position.clone();
      if (p.type === "health") playHealthSupplySound(supplyPos);
      else playAmmoSupplySound(supplyPos);
      p.aggregate.dispose();
      p.mesh.dispose();
      g.supplies.splice(i, 1);
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
      m.name !== "supply",
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
    const dtSec = g.engine.getDeltaTime() / 1000;
    const turnSpeed = ENEMY_TURN_SPEED;

    if (dist < ENEMY_CHASE_RANGE) e.state = "chase";

    const currentVel = e.aggregate.body.getLinearVelocity();
    let targetYaw = e.facingYaw;
    let moveSpeed = e.speed;

    if (e.state === "chase") {
      const dirXZ = new Vector3(toPlayer.x, 0, toPlayer.z);
      if (dirXZ.lengthSquared() > 0) dirXZ.normalize();

      // Zigzag lateral offset
      e.zigzagTimer += dtSec * ENEMY_ZIGZAG_FREQ * Math.PI * 2;
      const lateral = new Vector3(-dirXZ.z, 0, dirXZ.x);
      const zigzag = Math.sin(e.zigzagTimer) * ENEMY_ZIGZAG_AMPLITUDE;
      const moveDir = dirXZ.add(lateral.scale(zigzag)).normalize();

      targetYaw = Math.atan2(moveDir.x, moveDir.z);

      if (dist < ENEMY_MELEE_RANGE) {
        e.attackCooldown -= g.engine.getDeltaTime();
        if (e.attackCooldown <= 0) {
          playEnemyAttackSound(pos.clone());
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

      if (toTargetXZ.length() > 0) {
        const dirXZ = toTargetXZ.normalize();
        targetYaw = Math.atan2(dirXZ.x, dirXZ.z);
      }
      moveSpeed = e.speed * 0.5;
    }

    // Smooth turning — find shortest angular difference
    let yawDiff = targetYaw - e.facingYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    const maxTurn = turnSpeed * dtSec;
    e.facingYaw += Math.max(-maxTurn, Math.min(maxTurn, yawDiff));

    // Apply facing rotation to visual root (not physMesh — physics controls that)
    e.visualRoot.rotation.y = e.facingYaw;

    // Move in the direction the enemy is facing
    const fwd = new Vector3(Math.sin(e.facingYaw), 0, Math.cos(e.facingYaw));
    e.aggregate.body.setLinearVelocity(
      new Vector3(fwd.x * moveSpeed, currentVel.y, fwd.z * moveSpeed),
    );

    // Walk animation — phase advances proportional to actual speed
    const actualSpeed = e.state === "chase" ? e.speed : e.speed * 0.5;
    const strideRate = actualSpeed * 2.0; // radians per second
    const prevPhase = e.walkPhase;
    e.walkPhase += (strideRate * g.engine.getDeltaTime()) / 1000;
    const swing = Math.sin(e.walkPhase) * 0.45; // max ~26 degrees
    e.leftLeg.rotation.x = swing;
    e.rightLeg.rotation.x = -swing;

    // Footstep at each zero-crossing (leg hitting ground)
    const prevSin = Math.sin(prevPhase);
    const currSin = Math.sin(e.walkPhase);
    if (prevSin >= 0 && currSin < 0) {
      playEnemyFootstep(pos.clone());
      e.lastFootLeft = true;
    } else if (prevSin <= 0 && currSin > 0) {
      playEnemyFootstep(pos.clone());
      e.lastFootLeft = false;
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

  // Visual root sits between physics capsule and visual meshes so we can rotate it
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

  g.shadowGenerator.addShadowCaster(bodyMesh);
  g.shadowGenerator.addShadowCaster(head);
  g.shadowGenerator.addShadowCaster(leftLegBox);
  g.shadowGenerator.addShadowCaster(rightLegBox);

  g.enemies.push({
    physMesh,
    visualRoot,
    bodyMesh,
    headMesh: head,
    leftLeg,
    rightLeg,
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
    walkPhase: Math.random() * Math.PI * 2,
    lastFootLeft: false,
    facingYaw: Math.random() * Math.PI * 2,
  });
  playEnemySpawnSound(new Vector3(x, ARENA_CEIL - 0.5, z));
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

    // Reward: spawn supplies in front of player + score bonus
    const fwd = g.camera.getForwardRay(3).direction;
    const frontPos = g.camera.position.add(fwd.scale(3));
    frontPos.y = 0.5;
    spawnSupply(frontPos.clone(), "health");
    spawnSupply(new Vector3(frontPos.x + 0.6, frontPos.y, frontPos.z), "ammo");
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
    g.state.overheated ||
    g.pendingUpgrades.length > 0
  )
    return;
  if (g.state.ammo <= 0) {
    startReload();
    return;
  }

  g.state.ammo--;
  g.state.shootCooldown = effectiveCooldown();
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
  const isCrit = Math.random() < effectiveCritChance();

  const rayFilter = (m: AbstractMesh) =>
    m.renderingGroupId !== 1 &&
    m.name !== "player" &&
    m.name !== "enemyPhys" &&
    m.name !== "laserBeam" &&
    m.name !== "bhole" &&
    m.name !== "supply";

  if (isCrit) {
    // Crit beam: penetrate through enemies
    const hits = g.scene.multiPickWithRay(ray, rayFilter) ?? [];
    hits.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

    let beamEnd = ray.origin.add(ray.direction.scale(100));
    for (const h of hits) {
      if (!h.hit || !h.pickedMesh || !h.pickedPoint) continue;
      const name = h.pickedMesh.name;

      if (isEnemyPart(name)) {
        const result = findEnemyByMesh(h.pickedMesh);
        if (result) {
          hitEnemy(result.enemy, result.hitMesh, h.pickedPoint, true);
          const hitNormal = h.getNormal(true) ?? ray.direction.negate();
          spawnHitParticle(h.pickedPoint, new Color4(0.8, 0.0, 0.0, 1), hitNormal);
          if (g.enemies.includes(result.enemy)) {
            spawnBulletHole(h.pickedPoint, h.getNormal(true), h.pickedMesh as Mesh);
          }
        } else {
          splitRagdoll(h.pickedMesh as Mesh, ray.direction, h.pickedPoint);
        }
      } else if (name === "bodyHalf" || name === "headHalf") {
        hitDebris(h.pickedMesh as Mesh, ray.direction, h.pickedPoint);
        const hitNormal = h.getNormal(true) ?? ray.direction.negate();
        spawnHitParticle(h.pickedPoint, new Color4(0.8, 0.0, 0.0, 1), hitNormal);
      } else if (name === "orb") {
        const orbIdx = g.orbs.findIndex((o) => o.mesh === h.pickedMesh);
        if (orbIdx !== -1) {
          detonateOrb(g.orbs[orbIdx], h.pickedPoint);
          g.orbs.splice(orbIdx, 1);
        }
      } else {
        // Wall/floor — beam stops here
        beamEnd = h.pickedPoint;
        spawnBulletHole(h.pickedPoint, h.getNormal(true));
        break;
      }
    }
    spawnLaserBeam(g.barrelTip.getAbsolutePosition(), beamEnd, true);
  } else {
    // Normal beam: single hit
    const hit = g.scene.pickWithRay(ray, rayFilter);

    const beamEnd =
      hit?.hit && hit.pickedPoint
        ? hit.pickedPoint
        : ray.origin.add(ray.direction.scale(100));
    spawnLaserBeam(g.barrelTip.getAbsolutePosition(), beamEnd, false);

    if (hit?.hit && hit.pickedMesh) {
      if (isEnemyPart(hit.pickedMesh.name)) {
        const result = findEnemyByMesh(hit.pickedMesh);
        if (result) {
          hitEnemy(result.enemy, result.hitMesh, hit.pickedPoint ?? undefined);
          if (hit.pickedPoint) {
            const hitNormal = hit.getNormal(true) ?? ray.direction.negate();
            spawnHitParticle(
              hit.pickedPoint,
              new Color4(0.8, 0.0, 0.0, 1),
              hitNormal,
            );
            if (g.enemies.includes(result.enemy)) {
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
      } else if (hit.pickedMesh.name === "orb") {
        const orbIdx = g.orbs.findIndex((o) => o.mesh === hit.pickedMesh);
        if (orbIdx !== -1) {
          const orb = g.orbs[orbIdx];
          const detonatePos = hit.pickedPoint ?? orb.mesh.position.clone();
          detonateOrb(orb, detonatePos);
          g.orbs.splice(orbIdx, 1);
        }
      } else if (hit.pickedPoint) {
        spawnBulletHole(hit.pickedPoint, hit.getNormal(true));
      }
    }
  }

  if (g.state.ammo === 0 && g.state.reserve > 0) g.state.autoReloadDelay = 300;
}

// ─── Alt-fire: Orb ──────────────────────────────────────────────────────────
export function startOrbCharge(): void {
  if (
    !g.state.running ||
    g.state.reloading ||
    g.isSprinting ||
    g.state.overheated ||
    g.pendingUpgrades.length > 0 ||
    g.state.orbCooldown > 0
  )
    return;
  if (g.state.ammo < PLAYER_ORB_AMMO_COST) {
    startReload();
    return;
  }

  const isCrit = Math.random() < effectiveCritChance();

  // Instant-fire if only base ammo available
  if (g.state.ammo === PLAYER_ORB_AMMO_COST) {
    g.state.ammo -= PLAYER_ORB_AMMO_COST;
    g.state.heat = Math.min(
      g.state.heat + PLAYER_HEAT_PER_SHOT * PLAYER_ORB_HEAT_MULTIPLIER,
      effectiveHeatMax(),
    );
    g.state.heatCooldownTimer = PLAYER_HEAT_COOLDOWN_DELAY;
    fireOrb(1.0, isCrit);
    return;
  }

  // Begin charging — apply base heat immediately
  g.state.ammo -= PLAYER_ORB_AMMO_COST;
  g.state.heat = Math.min(
    g.state.heat + PLAYER_HEAT_PER_SHOT * PLAYER_ORB_HEAT_MULTIPLIER,
    effectiveHeatMax(),
  );
  g.state.heatCooldownTimer = PLAYER_HEAT_COOLDOWN_DELAY;
  if (g.state.heat >= effectiveHeatMax()) {
    fireOrb(1.0, isCrit);
    return;
  }
  g.orbChargeCrit = isCrit;
  g.orbCharging = true;
  g.orbChargeTime = 0;
  g.orbChargeAmmo = PLAYER_ORB_AMMO_COST;
  g.orbChargeMesh = makeOrbChargeMesh();
  if (isCrit) {
    const mat = g.orbChargeMesh.material as StandardMaterial;
    mat.diffuseColor = new Color3(0.6, 0, 1);
    mat.emissiveColor = new Color3(0.5, 0, 0.9);
  }
  startOrbChargeSound();
  updateHUD();
}

function updateOrbCharge(dt: number): void {
  // Interruption: fire immediately at current charge
  if (
    g.state.reloading ||
    g.isSprinting ||
    g.state.overheated ||
    !g.state.running ||
    g.state.paused
  ) {
    releaseOrbCharge();
    return;
  }

  g.orbChargeTime += dt;

  // Drain extra ammo over time
  const targetExtra = Math.min(
    Math.floor(
      g.orbChargeTime / (effectiveCooldown() * PLAYER_ORB_COOLDOWN_MULTIPLIER),
    ),
    PLAYER_ORB_AMMO_COST, // max 8 additional
  );
  const currentExtra = g.orbChargeAmmo - PLAYER_ORB_AMMO_COST;
  for (let i = currentExtra; i < targetExtra; i++) {
    if (g.state.ammo <= 0) {
      releaseOrbCharge();
      return;
    }
    g.state.ammo--;
    g.orbChargeAmmo++;
    g.state.heat = Math.min(
      g.state.heat +
        (PLAYER_HEAT_PER_SHOT * PLAYER_ORB_HEAT_MULTIPLIER) /
          PLAYER_ORB_AMMO_COST,
      effectiveHeatMax(),
    );
    g.state.heatCooldownTimer = PLAYER_HEAT_COOLDOWN_DELAY;
    if (g.state.heat >= effectiveHeatMax()) {
      releaseOrbCharge();
      return;
    }
  }

  const chargeMultiplier = g.orbChargeAmmo / PLAYER_ORB_AMMO_COST;

  // Update visual: lerp scale and brightness smoothly toward target
  if (g.orbChargeMesh) {
    const lerpRate = 1 - Math.pow(0.001, dt / 1000); // ~smooth over ~150ms
    const curScale = g.orbChargeMesh.scaling.x;
    const s = curScale + (chargeMultiplier - curScale) * lerpRate;
    g.orbChargeMesh.scaling.setAll(s);
    g.orbChargeMesh.position.z = PLAYER_ORB_RADIUS * s;
    const mat = g.orbChargeMesh.material as StandardMaterial;
    const t = s - 1;
    if (g.orbChargeCrit) {
      mat.diffuseColor = new Color3(0.6, 0, 1);
      mat.emissiveColor = Color3.Lerp(
        new Color3(0.5, 0, 0.9),
        new Color3(0.7, 0.3, 1),
        t,
      );
    } else {
      mat.emissiveColor = Color3.Lerp(
        new Color3(0, 0.9, 1),
        new Color3(0.5, 1, 1),
        t,
      );
    }
  }

  // Update sound
  updateOrbChargeSound(chargeMultiplier - 1);

  // Auto-fire at max charge
  if (g.orbChargeAmmo >= PLAYER_ORB_AMMO_COST * 2) {
    releaseOrbCharge();
    return;
  }

  updateHUD();
}

export function releaseOrbCharge(): void {
  if (!g.orbCharging) return;
  const chargeMultiplier = g.orbChargeAmmo / PLAYER_ORB_AMMO_COST;
  stopOrbChargeSound();
  if (g.orbChargeMesh) {
    g.orbChargeMesh.dispose();
    g.orbChargeMesh = null;
  }
  g.orbCharging = false;
  const isCrit = g.orbChargeCrit;
  g.orbChargeCrit = false;
  fireOrb(chargeMultiplier, isCrit);
}

function fireOrb(chargeMultiplier: number, isCrit = false): void {
  g.state.orbCooldown =
    effectiveCooldown() * PLAYER_ORB_COOLDOWN_MULTIPLIER * chargeMultiplier;
  g.state.shootCooldown = Math.max(g.state.shootCooldown, g.state.orbCooldown);
  g.state.heatCooldownTimer = PLAYER_HEAT_COOLDOWN_DELAY;
  if (g.state.heat >= effectiveHeatMax()) {
    g.state.overheated = true;
    g.state.heatCooldownTimer = PLAYER_HEAT_COOLDOWN_DELAY * 2;
    dom.overheatMsg.classList.add("visible");
    playOverheatSound();
    spawnSmokeParticles();
  }

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
  g.shootSpread = Math.min(
    g.shootSpread + effectiveBloom() * 6 * chargeMultiplier,
    PLAYER_MAX_SPREAD,
  );

  const hMax = effectiveHeatMax();
  const critHeat = hMax * PLAYER_HEAT_CRITICAL;
  const heatPenalty =
    g.state.heat >= critHeat
      ? 1 - 0.6 * ((g.state.heat - critHeat) / (hMax - critHeat))
      : 1;

  const spawnPos = g.barrelTip.getAbsolutePosition();
  playOrbLaunchSound(spawnPos, chargeMultiplier);
  const mesh = makeOrbMesh(spawnPos);
  mesh.scaling.setAll(chargeMultiplier);
  const orbMat = mesh.material as StandardMaterial;
  if (isCrit) {
    orbMat.diffuseColor = new Color3(0.6, 0, 1);
    orbMat.emissiveColor = new Color3(0.5, 0, 0.9);
  }
  if (heatPenalty < 1) {
    const t = 1 - heatPenalty;
    orbMat.alpha = 1 - t * 0.6;
    orbMat.emissiveColor = Color3.Lerp(
      orbMat.emissiveColor,
      new Color3(0.2, 0.3, 0.3),
      t,
    );
  }
  g.orbs.push({
    mesh,
    velocity: ray.direction.scale(PLAYER_ORB_SPEED / chargeMultiplier),
    age: 0,
    heatPenalty,
    chargeMultiplier,
    isCrit,
  });

  if (g.state.ammo === 0 && g.state.reserve > 0) g.state.autoReloadDelay = 300;
  updateHUD();
}

function updateOrbs(dt: number): void {
  const dtSec = dt / 1000;
  for (let i = g.orbs.length - 1; i >= 0; i--) {
    const orb = g.orbs[i];
    orb.age += dt;

    // Move orb
    const step = orb.velocity.scale(dtSec);
    orb.mesh.position.addInPlace(step);

    // 5-ray collision: center + 4 edges of the orb sphere
    const rayDir = orb.velocity.normalizeToNew();
    const rayLen = orb.velocity.length() * dtSec + 0.2;
    const up = Vector3.Cross(rayDir, new Vector3(1, 0, 0));
    if (up.lengthSquared() < 0.01)
      up.copyFrom(Vector3.Cross(rayDir, new Vector3(0, 0, 1)));
    up.normalize();
    const right = Vector3.Cross(rayDir, up).normalize();

    const orbR = PLAYER_ORB_RADIUS * orb.chargeMultiplier;
    const rayOrigins = [
      orb.mesh.position,
      orb.mesh.position.add(up.scale(orbR)),
      orb.mesh.position.add(up.scale(-orbR)),
      orb.mesh.position.add(right.scale(orbR)),
      orb.mesh.position.add(right.scale(-orbR)),
    ];

    const rayFilter = (m: AbstractMesh) =>
      m.renderingGroupId !== 1 &&
      m.name !== "player" &&
      m.name !== "enemyPhys" &&
      m.name !== "laserBeam" &&
      m.name !== "bhole" &&
      m.name !== "supply" &&
      m.name !== "orb" &&
      m.name !== "orbCharge";

    let explode = false;
    let explodePos = orb.mesh.position.clone();
    const directHits = new Map<Enemy, Mesh>();

    for (const origin of rayOrigins) {
      const ray = new Ray(origin, rayDir, rayLen);
      const hit = g.scene.pickWithRay(ray, rayFilter);
      if (hit?.hit && hit.pickedPoint && hit.distance < rayLen) {
        if (hit.pickedMesh && isEnemyPart(hit.pickedMesh.name)) {
          const result = findEnemyByMesh(hit.pickedMesh);
          if (result) {
            const prev = directHits.get(result.enemy);
            if (!prev || result.hitMesh.name === "enemyHead") {
              directHits.set(result.enemy, result.hitMesh);
            }
          }
          if (!explode) {
            explode = true;
            explodePos = hit.pickedPoint;
          }
        } else if (!explode) {
          explode = true;
          explodePos = hit.pickedPoint;
        }
      }
    }

    // Timeout at 5 seconds
    if (orb.age > 5000) explode = true;

    if (explode) {
      explodeOrb(
        explodePos,
        directHits,
        orb.heatPenalty,
        orb.mesh,
        orb.chargeMultiplier,
        false,
        orb.isCrit,
      );
      g.orbs.splice(i, 1);
    }
  }
}

function detonateOrb(orb: Orb, pos: Vector3): void {
  const directHits = new Map<Enemy, Mesh>();
  explodeOrb(pos, directHits, orb.heatPenalty, orb.mesh, orb.chargeMultiplier, true, orb.isCrit);
}

function explodeOrb(
  pos: Vector3,
  directHits: Map<Enemy, Mesh>,
  heatPenalty: number,
  orbMesh: Mesh,
  chargeMultiplier: number,
  beamDetonated = false,
  isCrit = false,
): void {
  playOrbExplosionSound(pos, chargeMultiplier);
  spawnExplosionParticle(pos, isCrit);

  // Animate the orb mesh as an expanding, fading blast sphere
  orbMesh.position = pos.clone();
  orbMesh.isPickable = false;
  const mat = orbMesh.material as StandardMaterial;
  if (isCrit) {
    mat.diffuseColor = new Color3(0.6, 0, 1);
    mat.emissiveColor = new Color3(0.5, 0, 0.9);
  }
  mat.alpha = 0.6;
  const expandDurationMs = 300;
  const startTime = performance.now();
  const startScale = orbMesh.scaling.x;
  const explosionRadius = PLAYER_ORB_EXPLOSION_RADIUS * chargeMultiplier * (isCrit ? 2 : 1);
  const endScale = (explosionRadius * 2) / 0.3; // diameter ratio
  const obs = g.scene.onBeforeRenderObservable.add(() => {
    const t = Math.min((performance.now() - startTime) / expandDurationMs, 1);
    const s = startScale + (endScale - startScale) * t;
    orbMesh.scaling.setAll(s);
    mat.alpha = 0.6 * (1 - t);
    if (t >= 1) {
      g.scene.onBeforeRenderObservable.remove(obs);
      orbMesh.dispose();
    }
  });

  const critMult = isCrit ? effectiveCritDamage() : 1;
  const damage = (effectiveOrbDamage() * chargeMultiplier
    + (beamDetonated ? effectiveBeamDamage() : 0)) * critMult;

  for (const enemy of [...g.enemies]) {
    let dmg: number;
    let flashMesh: Mesh;
    const directMesh = directHits.get(enemy);

    if (directMesh) {
      const headshot = directMesh.name === "enemyHead";
      dmg = damage * (headshot ? 2 : 1);
      flashMesh = directMesh;
    } else {
      const enemyPos = enemy.bodyMesh.getAbsolutePosition();
      const dist = Vector3.Distance(pos, enemyPos);
      if (dist > explosionRadius) continue;
      const falloff = 1 - dist / explosionRadius;
      dmg = damage * (beamDetonated ? 1 : PLAYER_ORB_SPLASH_FALLOFF) * falloff;
      flashMesh = enemy.bodyMesh;
    }

    dmg = Math.round(dmg * (0.8 + Math.random() * 0.4) * heatPenalty);
    enemy.hp -= dmg;

    (flashMesh.material as StandardMaterial).emissiveColor = new Color3(
      1,
      0,
      0,
    );
    enemy.flashMesh = flashMesh;
    enemy.flashTime = 200;

    // Knockback impulse on enemy (before kill so aggregate still exists)
    const ePos = enemy.bodyMesh.getAbsolutePosition();
    const awayE = ePos.subtract(pos);
    const distE = awayE.length();
    if (distE > 0.01) {
      const strength = 50 * chargeMultiplier * (1 - distE / explosionRadius);
      enemy.aggregate.body.applyImpulse(
        awayE.normalize().scale(strength),
        ePos,
      );
    }

    if (enemy.hp <= 0) killEnemy(enemy, flashMesh, pos, true);
  }

  // Knockback and split/shrink on ragdoll debris
  for (const mesh of g.scene.meshes.slice()) {
    if (
      mesh.name !== "bodyHalf" &&
      mesh.name !== "headHalf" &&
      mesh.name !== "enemyBody" &&
      mesh.name !== "enemyHead"
    )
      continue;
    // Skip meshes still parented to a live enemy
    if (mesh.parent && g.enemies.some((e) => e.visualRoot === mesh.parent))
      continue;
    const dPos = mesh.getAbsolutePosition();
    const dist = Vector3.Distance(pos, dPos);
    if (dist > explosionRadius) continue;
    const away = dPos.subtract(pos);
    const falloff = 1 - dist / explosionRadius;
    if (mesh.physicsBody && away.length() > 0.01) {
      mesh.physicsBody.applyImpulse(
        away.normalize().scale(40 * chargeMultiplier * falloff),
        dPos,
      );
    }
    if (mesh.name === "bodyHalf" || mesh.name === "headHalf") {
      // Shrink like hitDebris, dispose if too small
      mesh.scaling.scaleInPlace(0.75);
      if (mesh.scaling.x < 0.15) {
        if (mesh.physicsBody) mesh.physicsBody.dispose();
        mesh.dispose();
      }
      incrementScore(1, pos);
    } else {
      // Unsplit body/head — split them
      splitRagdoll(
        mesh as Mesh,
        away.length() > 0.01 ? away.normalize() : Vector3.Up(),
        pos,
      );
    }
  }

  // Knockback on supplies
  for (const s of g.supplies) {
    const sPos = s.mesh.getAbsolutePosition();
    const dist = Vector3.Distance(pos, sPos);
    if (dist > explosionRadius) continue;
    const away = sPos.subtract(pos);
    if (away.length() > 0.01) {
      const strength = 40 * chargeMultiplier * (1 - dist / explosionRadius);
      s.aggregate.body.applyImpulse(away.normalize().scale(strength), sPos);
    }
  }

  // Player self-damage and knockback (uses base damage, no upgrades)
  const playerPos = g.camera.position;
  const playerDist = Vector3.Distance(pos, playerPos);
  if (playerDist < explosionRadius) {
    const falloff = 1 - playerDist / explosionRadius;
    const selfDmg = Math.round(
      PLAYER_ORB_DAMAGE *
        chargeMultiplier *
        (beamDetonated ? 1 : PLAYER_ORB_SPLASH_FALLOFF) *
        falloff,
    );
    if (selfDmg > 0) damagePlayer(selfDmg);

    const away = playerPos.subtract(pos);
    if (away.length() > 0.01) {
      const strength = 60 * chargeMultiplier * falloff;
      g.playerAggregate.body.applyImpulse(
        away.normalize().scale(strength),
        playerPos,
      );
    }
  }
}

function spawnExplosionParticle(position: Vector3, isCrit = false): void {
  const ps = new ParticleSystem("explosion", 120, g.scene);
  ps.particleTexture = g.particleTex;
  ps.emitter = position;
  ps.minEmitBox = new Vector3(-0.3, -0.3, -0.3);
  ps.maxEmitBox = new Vector3(0.3, 0.3, 0.3);
  ps.color1 = isCrit ? new Color4(0.7, 0.1, 1, 1) : new Color4(0, 1, 1, 1);
  ps.color2 = isCrit ? new Color4(0.4, 0, 0.8, 0.8) : new Color4(0, 0.5, 1, 0.8);
  ps.colorDead = isCrit ? new Color4(0.15, 0, 0.2, 0) : new Color4(0.1, 0.15, 0.2, 0);
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

function hitEnemy(enemy: Enemy, hitMesh: Mesh, hitPoint?: Vector3, isCrit = false): void {
  const headshot = hitMesh.name === "enemyHead";
  const hMax = effectiveHeatMax();
  const critHeat = hMax * PLAYER_HEAT_CRITICAL;
  const heatPenalty =
    g.state.heat >= critHeat
      ? 1 - 0.6 * ((g.state.heat - critHeat) / (hMax - critHeat))
      : 1;
  const critMult = isCrit ? effectiveCritDamage() : 1;
  enemy.hp -= Math.round(
    effectiveBeamDamage() *
      (0.8 + Math.random() * 0.4) *
      (headshot ? 2 : 1) *
      heatPenalty *
      critMult,
  );

  (hitMesh.material as StandardMaterial).emissiveColor = new Color3(1, 0, 0);
  enemy.flashMesh = hitMesh;
  enemy.flashTime = effectiveCooldown() * 0.6;

  if (enemy.hp <= 0) killEnemy(enemy, hitMesh, hitPoint);
}

function killEnemy(
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

  // Dispose legs and visual root before the capsule
  enemy.leftLeg.getChildMeshes().forEach((m) => m.dispose());
  enemy.leftLeg.dispose();
  enemy.rightLeg.getChildMeshes().forEach((m) => m.dispose());
  enemy.rightLeg.dispose();

  // Unparent body/head from visual root, then dispose visual root and capsule
  const bodyMat = enemy.bodyMesh.material as StandardMaterial;
  const headMat = enemy.headMesh.material as StandardMaterial;
  enemy.bodyMesh.parent = null;
  enemy.bodyMesh.position = bodyWorldPos;
  enemy.headMesh.parent = null;
  enemy.headMesh.position = headWorldPos;
  enemy.visualRoot.dispose();

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

  if (orbKill) {
    // Orb kills split both body and head
    enemy.bodyMesh.dispose();
    const [bTop, bBot] = makeBodySplitHalves(bodyWorldPos, bodyMat);
    const bTopAgg = makeRagdollHalfAggregate(bTop, 5);
    bTopAgg.body.applyImpulse(
      new Vector3(awayDir.x * 22, 18, awayDir.z * 22),
      bodyWorldPos.add(new Vector3(0, 0.4, 0)),
    );
    const bBotAgg = makeRagdollHalfAggregate(bBot, 5);
    bBotAgg.body.applyImpulse(
      new Vector3(awayDir.x * 14, -5, awayDir.z * 14),
      bodyWorldPos,
    );
    setTimeout(() => {
      bTopAgg.dispose();
      bTop.dispose();
      bBotAgg.dispose();
      bBot.dispose();
    }, 3500);

    enemy.headMesh.dispose();
    const [hTop, hBot] = makeHeadSplitHalves(headWorldPos, headMat);
    const hTopAgg = makeRagdollHalfAggregate(hTop, 1);
    hTopAgg.body.applyImpulse(
      new Vector3(awayDir.x * 4, 6 + Math.random() * 3, awayDir.z * 4),
      headWorldPos,
    );
    const hBotAgg = makeRagdollHalfAggregate(hBot, 1);
    hBotAgg.body.applyImpulse(
      new Vector3(awayDir.x * 2, 1 + Math.random() * 2, awayDir.z * 2),
      headWorldPos,
    );
    setTimeout(() => {
      hTopAgg.dispose();
      hTop.dispose();
      hBotAgg.dispose();
      hBot.dispose();
    }, 3500);
  } else if (isHeadshot) {
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
  while (g.state.score >= g.state.nextSupplyThreshold) {
    g.state.nextSupplyThreshold += SUPPLY_SCORE_INTERVAL;
    if (Math.random() < effectiveSupplyDropRate() && hitPoint) {
      spawnSupply(hitPoint.clone());
    }
  }
}

function spawnSupply(position: Vector3, forceType?: "health" | "ammo"): void {
  const type = forceType ?? (Math.random() < 0.5 ? "health" : "ammo");
  const { mesh, aggregate } =
    type === "health" ? makeHealthSupply(position) : makeAmmoSupply(position);
  g.supplies.push({ mesh, aggregate, type });
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
  playReloadSounds(effectiveReloadTime(), () =>
    g.barrelTip.getAbsolutePosition(),
  );
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
  if (g.pendingUpgrades.length > 0) {
    dom.upgradeMenu.classList.add("visible");
    document.exitPointerLock();
  }
}

export function endGame(): void {
  g.state.running = false;
  g.mouseHeld = false;
  g.pressedKeys.clear();
  g.weaponRoot.setEnabled(false);
  dom.hud.style.display = "none";
  dom.gameOver.style.display = "flex";
  dom.finalWaveEl.textContent = `Wave: ${g.state.wave}`;
  dom.finalScoreEl.textContent = `Score: ${g.state.score}  |  Kills: ${g.state.kills}`;
  document.exitPointerLock();
}

// ─── Spawn effects ────────────────────────────────────────────────────────────
function spawnLaserBeam(from: Vector3, to: Vector3, isCrit = false): void {
  const dist = Vector3.Distance(from, to);
  if (dist < 0.05) return;

  playBeamSound((effectiveCooldown() * 0.6) / 1000);

  const beam = makeBeam(from, to);
  const mat = beam.material as StandardMaterial;
  if (isCrit) {
    mat.diffuseColor = new Color3(0.6, 0, 1);
    mat.emissiveColor = new Color3(0.5, 0, 0.9);
  }
  const beamHeatMax = effectiveHeatMax();
  const critHeat = beamHeatMax * PLAYER_HEAT_CRITICAL;
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
