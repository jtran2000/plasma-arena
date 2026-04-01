import {
  Vector3,
  StandardMaterial,
  Color3,
  Color4,
  Mesh,
  AbstractMesh,
  Ray,
} from "@babylonjs/core";
import {
  ARENA,
  ENEMY,
  SUPPLY,
  PLAYER,
  BEAM,
  SPREAD,
  HEAT,
  ORB,
  SCORING,
  WAVE,
  MULTISHOT,
  RICOCHET,
  LIGHTNING,
  BULLET_HOLE,
} from "./constants.js";
import { g, dom, type Enemy, type Orb, endGame } from "./game.js";
import {
  makeOrbChargeMesh,
  spawnEnemy,
  spawnSupply,
  spawnOrb,
  spawnLightningBolt,
  spawnExplosionParticle,
  spawnHitParticle,
  spawnSmokeParticles,
  spawnLaserBeam,
  spawnBulletHole,
  killEnemy,
  splitRagdoll,
  hitDebris,
  setIncrementScore,
} from "./spawn.js";
import {
  updateAudioListener,
  playReloadSounds,
  playOverheatSound,
  playEnemyFootstep,
  playEnemyAttackSound,
  playHealthSupplySound,
  playAmmoSupplySound,
  playOrbLaunchSound,
  playOrbExplosionSound,
  startOrbChargeSound,
  updateOrbChargeSound,
  stopOrbChargeSound,
  playLightningSound,
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
  effectiveOrbSelfDamage,
  effectiveMultishotChance,
  effectiveRicochetChance,
  effectiveLightningChance,
  setUpdateHUD,
} from "./upgrades.js";
export { selectUpgrade };

// Register callbacks for cross-module dependencies (defined below, but hoisted)
setUpdateHUD(() => updateHUD());
setIncrementScore(incrementScore);

function isEnemyPart(name: string): boolean {
  return (
    name === "enemyBody" ||
    name === "enemyHead" ||
    name === "enemyLeg" ||
    name === "enemyArm"
  );
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
  const criticalHeat = heatMax * HEAT.critical;
  const barrelMat = g.weaponBarrel.material as StandardMaterial;
  if (g.state.heat > 0) {
    dom.heatBar.classList.add("visible");
    dom.heatBar.style.width = `${120 * (heatMax / HEAT.max)}px`;
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
    g.shootSpread = Math.max(0, g.shootSpread - (SPREAD.decay * dt) / 1000);
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
      SPREAD.max,
      g.moveSpread + (effectiveMoveSpreadRate() * dt) / 1000,
    );
  } else if (g.moveSpread > 0) {
    g.moveSpread = Math.max(0, g.moveSpread - (SPREAD.decay * dt) / 1000);
  }

  // Update crosshair spread offset (map radians to screen pixels)
  const totalSpread =
    Math.min(g.shootSpread, SPREAD.max) + Math.min(g.moveSpread, SPREAD.max);
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
      mat.emissiveColor = new Color3(
        BULLET_HOLE.darkR,
        BULLET_HOLE.darkG,
        BULLET_HOLE.darkB,
      );
      g.glowingHoles.splice(i, 1);
    } else {
      const t = 1 - gh.time / BULLET_HOLE.glowMs;
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
    if (dist < SUPPLY.collectRange) {
      const maxReserve = BEAM.maxReserveMags * effectiveMagSize();
      if (p.type === "health" && g.state.health >= effectiveMaxHealth())
        continue;
      if (p.type === "ammo" && g.state.reserve >= maxReserve) continue;
      if (p.type === "health") {
        g.state.health = Math.min(
          effectiveMaxHealth(),
          g.state.health + SUPPLY.healthAmount,
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
    ? effectiveSpeed() * PLAYER.sprintMultiplier
    : effectiveSpeed();
  const targetXZ =
    wish.lengthSquared() > 0
      ? wish.normalize().scale(maxSpeed)
      : Vector3.Zero();

  g.playerVelocityXZ = Vector3.Lerp(
    g.playerVelocityXZ,
    targetXZ,
    PLAYER.acceleration,
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
    new Vector3(g.playerVelocityXZ.x, PLAYER.jumpSpeed, g.playerVelocityXZ.z),
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
    const turnSpeed = ENEMY.turnSpeed;

    if (dist < ENEMY.chaseRange) e.state = "chase";

    const currentVel = e.aggregate.body.getLinearVelocity();
    let targetYaw = e.facingYaw;
    let moveSpeed = e.speed;

    if (e.state === "chase") {
      const dirXZ = new Vector3(toPlayer.x, 0, toPlayer.z);
      if (dirXZ.lengthSquared() > 0) dirXZ.normalize();

      // Zigzag lateral offset
      e.zigzagTimer += dtSec * ENEMY.zigzagFreq * Math.PI * 2;
      const lateral = new Vector3(-dirXZ.z, 0, dirXZ.x);
      const zigzag = Math.sin(e.zigzagTimer) * ENEMY.zigzagAmplitude;
      const moveDir = dirXZ.add(lateral.scale(zigzag)).normalize();

      targetYaw = Math.atan2(moveDir.x, moveDir.z);

      if (dist < ENEMY.meleeRange) {
        e.attackCooldown -= g.engine.getDeltaTime();
        if (e.attackCooldown <= 0) {
          playEnemyAttackSound(pos.clone());
          damagePlayer(e.meleeDamage);
          e.attackCooldown = e.meleeIntervalMs;
          e.attackAnimTime = 300;
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
    const strideRate = actualSpeed * 1.8; // radians per second (scaled for leg length)
    const prevPhase = e.walkPhase;
    e.walkPhase += (strideRate * g.engine.getDeltaTime()) / 1000;
    const swing = Math.sin(e.walkPhase) * 0.45; // max ~26 degrees
    e.leftLeg.rotation.x = swing;
    e.rightLeg.rotation.x = -swing;

    // Arm animation
    const armSwing = Math.sin(e.walkPhase) * 0.35;
    const armBase = e.state === "chase" ? -Math.PI / 3 : 0;
    if (e.attackAnimTime > 0) {
      e.attackAnimTime -= g.engine.getDeltaTime();
      if (e.attackAnimTime < 0) e.attackAnimTime = 0;
      const strikeCurve = Math.sin((e.attackAnimTime / 300) * Math.PI);
      const strikeAngle = armBase + (-Math.PI / 2 - armBase) * strikeCurve;
      e.leftArm.rotation.x = strikeAngle;
      e.rightArm.rotation.x = strikeAngle;
    } else {
      e.leftArm.rotation.x = armBase - armSwing;
      e.rightArm.rotation.x = armBase + armSwing;
    }

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

// ─── Waves ───────────────────────────────────────────────────────────────────
function waveEnemyCount(wave: number): number {
  return WAVE.baseEnemies + WAVE.growth * (wave - 1);
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
  if (g.state.waveEnemiesLeft > 0 && g.enemies.length < WAVE.maxAlive) {
    g.state.waveSpawnTimer -= dt;
    if (g.state.waveSpawnTimer <= 0) {
      spawnEnemy();
      g.state.waveEnemiesLeft--;
      g.state.waveSpawnTimer = WAVE.spawnIntervalMs;
    }
  }

  // All enemies spawned and killed — wave complete
  if (g.state.waveEnemiesLeft <= 0 && g.enemies.length === 0) {
    g.state.waveActive = false;
    g.state.wavePauseTimer = WAVE.pauseMs;
    showWaveBanner(`Wave ${g.state.wave} Complete`);

    // Reward: spawn supplies in front of player + score bonus
    const fwd = g.camera.getForwardRay(3).direction;
    const frontPos = g.camera.position.add(fwd.scale(3));
    frontPos.y = 0.5;
    spawnSupply(frontPos.clone(), "health");
    spawnSupply(new Vector3(frontPos.x + 0.6, frontPos.y, frontPos.z), "ammo");
    incrementScore(SCORING.waveComplete, frontPos);
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
  g.state.heat = Math.min(g.state.heat + HEAT.perShot, effectiveHeatMax());
  g.state.heatCooldownTimer = HEAT.cooldownDelay;
  if (g.state.heat >= effectiveHeatMax()) {
    g.state.overheated = true;
    g.state.heatCooldownTimer = HEAT.cooldownDelay * 2;
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
  g.shootSpread = Math.min(g.shootSpread + effectiveBloom(), SPREAD.max);
  const isCrit = Math.random() < effectiveCritChance();
  const multishot = Math.random() < effectiveMultishotChance();

  const directions = [ray.direction.clone()];
  if (multishot) {
    const up = g.camera.upVector;
    const right = Vector3.Cross(ray.direction, up).normalize();
    directions.push(
      ray.direction.add(right.scale(MULTISHOT.angle)).normalize(),
      ray.direction.add(right.scale(-MULTISHOT.angle)).normalize(),
    );
  }

  for (const dir of directions) {
    fireBeamRay(new Ray(ray.origin, dir, 100), isCrit);
  }

  if (g.state.ammo === 0 && g.state.reserve > 0) g.state.autoReloadDelay = 300;
}

function addRandomSpread(dir: Vector3, spread: number): Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const magnitude = Math.random() * spread;
  const up = Vector3.Cross(dir, new Vector3(1, 0, 0));
  if (up.lengthSquared() < 0.01)
    up.copyFrom(Vector3.Cross(dir, new Vector3(0, 0, 1)));
  up.normalize();
  const right = Vector3.Cross(dir, up).normalize();
  return dir
    .add(right.scale(Math.cos(angle) * magnitude))
    .add(up.scale(Math.sin(angle) * magnitude))
    .normalize();
}

function reflectWithSpread(dir: Vector3, normal: Vector3): Vector3 {
  const dot = Vector3.Dot(dir, normal);
  const reflected = dir.subtract(normal.scale(2 * dot)).normalize();
  return addRandomSpread(reflected, RICOCHET.spread);
}

function fireBeamRay(ray: Ray, isCrit: boolean, depth = 0): void {
  const rayFilter = (m: AbstractMesh) =>
    m.renderingGroupId !== 1 &&
    m.name !== "player" &&
    m.name !== "enemyPhys" &&
    m.name !== "laserBeam" &&
    m.name !== "bhole" &&
    m.name !== "supply";

  const canRicochet = depth < RICOCHET.maxDepth;
  const beamOrigin =
    depth === 0 ? g.barrelTip.getAbsolutePosition() : ray.origin;

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
          spawnHitParticle(
            h.pickedPoint,
            new Color4(0.8, 0.0, 0.0, 1),
            hitNormal,
          );
          if (g.enemies.includes(result.enemy)) {
            spawnBulletHole(
              h.pickedPoint,
              h.getNormal(true),
              h.pickedMesh as Mesh,
            );
          }
          // Ricochet off each penetrated enemy
          if (canRicochet && Math.random() < effectiveRicochetChance()) {
            const rDir = reflectWithSpread(ray.direction, hitNormal);
            fireBeamRay(
              new Ray(h.pickedPoint.add(rDir.scale(0.1)), rDir, 100),
              isCrit,
              depth + 1,
            );
          }
        } else {
          splitRagdoll(h.pickedMesh as Mesh, ray.direction, h.pickedPoint);
        }
      } else if (
        name === "bodyHalf" ||
        name === "headHalf" ||
        name === "armHalf" ||
        name === "legHalf"
      ) {
        hitDebris(h.pickedMesh as Mesh, ray.direction, h.pickedPoint);
        const hitNormal = h.getNormal(true) ?? ray.direction.negate();
        spawnHitParticle(
          h.pickedPoint,
          new Color4(0.8, 0.0, 0.0, 1),
          hitNormal,
        );
      } else if (name === "orb") {
        const orbIdx = g.orbs.findIndex((o) => o.mesh === h.pickedMesh);
        if (orbIdx !== -1) {
          detonateOrb(g.orbs[orbIdx], h.pickedPoint, isCrit);
          g.orbs.splice(orbIdx, 1);
        }
      } else {
        // Wall/floor — beam stops here
        beamEnd = h.pickedPoint;
        spawnBulletHole(h.pickedPoint, h.getNormal(true));
        // Ricochet off geometry
        if (canRicochet && Math.random() < effectiveRicochetChance()) {
          const hitNormal = h.getNormal(true) ?? ray.direction.negate();
          const rDir = reflectWithSpread(ray.direction, hitNormal);
          fireBeamRay(
            new Ray(h.pickedPoint.add(rDir.scale(0.1)), rDir, 100),
            isCrit,
            depth + 1,
          );
        }
        break;
      }
    }
    spawnLaserBeam(beamOrigin, beamEnd, true);
  } else {
    // Normal beam: single hit
    const hit = g.scene.pickWithRay(ray, rayFilter);

    const beamEnd =
      hit?.hit && hit.pickedPoint
        ? hit.pickedPoint
        : ray.origin.add(ray.direction.scale(100));
    spawnLaserBeam(beamOrigin, beamEnd, false);

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
            // Ricochet off enemy
            if (canRicochet && Math.random() < effectiveRicochetChance()) {
              const rDir = reflectWithSpread(ray.direction, hitNormal);
              fireBeamRay(
                new Ray(hit.pickedPoint.add(rDir.scale(0.1)), rDir, 100),
                isCrit,
                depth + 1,
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
        hit.pickedMesh.name === "headHalf" ||
        hit.pickedMesh.name === "armHalf" ||
        hit.pickedMesh.name === "legHalf"
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
          detonateOrb(orb, detonatePos, isCrit);
          g.orbs.splice(orbIdx, 1);
        }
      } else if (hit.pickedPoint) {
        spawnBulletHole(hit.pickedPoint, hit.getNormal(true));
        // Ricochet off geometry
        if (canRicochet && Math.random() < effectiveRicochetChance()) {
          const hitNormal = hit.getNormal(true) ?? ray.direction.negate();
          const rDir = reflectWithSpread(ray.direction, hitNormal);
          fireBeamRay(
            new Ray(hit.pickedPoint.add(rDir.scale(0.1)), rDir, 100),
            isCrit,
            depth + 1,
          );
        }
      }
    }
  }
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
  if (g.state.ammo < ORB.ammoCost) {
    startReload();
    return;
  }

  const isCrit = Math.random() < effectiveCritChance();

  // Consume base ammo and apply heat
  g.state.ammo -= ORB.ammoCost;
  g.state.heat = Math.min(
    g.state.heat + HEAT.perShot * ORB.heatMultiplier,
    effectiveHeatMax(),
  );
  g.state.heatCooldownTimer = HEAT.cooldownDelay;

  // Instant-fire if no spare ammo or overheated
  if (g.state.ammo === 0 || g.state.heat >= effectiveHeatMax()) {
    fireOrb(1.0, isCrit);
    return;
  }
  g.orbChargeCrit = isCrit;
  g.orbCharging = true;
  g.orbChargeTime = 0;
  g.orbChargeAmmo = ORB.ammoCost;
  g.orbMaxChargeTimer = 0;
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
      g.orbChargeTime / (effectiveCooldown() * ORB.cooldownMultiplier),
    ),
    ORB.ammoCost, // max 8 additional
  );
  const currentExtra = g.orbChargeAmmo - ORB.ammoCost;
  for (let i = currentExtra; i < targetExtra; i++) {
    if (g.state.ammo <= 0) {
      releaseOrbCharge();
      return;
    }
    g.state.ammo--;
    g.orbChargeAmmo++;
    g.state.heat = Math.min(
      g.state.heat + (HEAT.perShot * ORB.heatMultiplier) / ORB.ammoCost,
      effectiveHeatMax(),
    );
    g.state.heatCooldownTimer = HEAT.cooldownDelay;
    if (g.state.heat >= effectiveHeatMax()) {
      releaseOrbCharge();
      return;
    }
  }

  const chargeMultiplier = g.orbChargeAmmo / ORB.ammoCost;

  // Update visual: lerp scale and brightness smoothly toward target
  if (g.orbChargeMesh) {
    const lerpRate = 1 - Math.pow(0.001, dt / 1000); // ~smooth over ~150ms
    const curScale = g.orbChargeMesh.scaling.x;
    const s = curScale + (chargeMultiplier - curScale) * lerpRate;
    g.orbChargeMesh.scaling.setAll(s);
    g.orbChargeMesh.position.z = ORB.radius * s;
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

  // At max charge, start hold timer — auto-fire after delay
  if (g.orbChargeAmmo >= ORB.ammoCost * 2) {
    g.orbMaxChargeTimer += dt;
    if (g.orbMaxChargeTimer >= ORB.maxChargeHold) {
      releaseOrbCharge();
      return;
    }
  }

  updateHUD();
}

export function releaseOrbCharge(): void {
  if (!g.orbCharging) return;
  const chargeMultiplier = g.orbChargeAmmo / ORB.ammoCost;
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

export function dumpOrbCharge(): void {
  if (!g.orbCharging) return;

  const extraAmmo = Math.min(g.orbChargeAmmo, g.state.ammo);
  g.state.ammo -= extraAmmo;
  g.orbChargeAmmo += extraAmmo;

  for (let i = 0; i < extraAmmo; i++) {
    g.state.heat = Math.min(
      g.state.heat + (HEAT.perShot * ORB.heatMultiplier) / ORB.ammoCost,
      effectiveHeatMax(),
    );
  }
  g.state.heatCooldownTimer = HEAT.cooldownDelay;

  const chargeMultiplier = g.orbChargeAmmo / ORB.ammoCost;
  stopOrbChargeSound();
  if (g.orbChargeMesh) {
    g.orbChargeMesh.dispose();
    g.orbChargeMesh = null;
  }
  g.orbCharging = false;
  const isCrit = g.orbChargeCrit;
  g.orbChargeCrit = false;
  fireOrb(chargeMultiplier, isCrit, true);
}

function fireOrb(
  chargeMultiplier: number,
  isCrit = false,
  hasGravity = false,
): void {
  g.state.orbCooldown =
    effectiveCooldown() * ORB.cooldownMultiplier * chargeMultiplier;
  g.state.shootCooldown = Math.max(g.state.shootCooldown, g.state.orbCooldown);
  g.state.heatCooldownTimer = HEAT.cooldownDelay;
  if (g.state.heat >= effectiveHeatMax()) {
    g.state.overheated = true;
    g.state.heatCooldownTimer = HEAT.cooldownDelay * 2;
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
    SPREAD.max,
  );

  const hMax = effectiveHeatMax();
  const critHeat = hMax * HEAT.critical;
  const heatPenalty =
    g.state.heat >= critHeat
      ? 1 - 0.6 * ((g.state.heat - critHeat) / (hMax - critHeat))
      : 1;

  const multishot = Math.random() < effectiveMultishotChance();
  const directions = [ray.direction.clone()];
  if (multishot) {
    const up = g.camera.upVector;
    const right = Vector3.Cross(ray.direction, up).normalize();
    directions.push(
      ray.direction.add(right.scale(MULTISHOT.angle)).normalize(),
      ray.direction.add(right.scale(-MULTISHOT.angle)).normalize(),
    );
  }

  const spawnPos = g.barrelTip.getAbsolutePosition();
  playOrbLaunchSound(spawnPos, chargeMultiplier);

  for (const dir of directions) {
    spawnOrb(
      spawnPos,
      dir,
      chargeMultiplier,
      heatPenalty,
      isCrit,
      hasGravity,
      0,
    );
  }

  if (g.state.ammo === 0 && g.state.reserve > 0) g.state.autoReloadDelay = 300;
  updateHUD();
}

function updateOrbs(dt: number): void {
  const dtSec = dt / 1000;
  for (let i = g.orbs.length - 1; i >= 0; i--) {
    const orb = g.orbs[i];
    orb.age += dt;

    // Move orb
    if (orb.hasGravity) {
      orb.velocity.y -= ORB.gravity * dtSec;
    }
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

    const orbR = ORB.radius * orb.chargeMultiplier;
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
    let explodeNormal: Vector3 | null = null;
    const directHits = new Map<Enemy, Mesh>();
    let bounced = false;
    const canRicochet = orb.ricochetDepth < RICOCHET.maxDepth;

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
            explodeNormal = hit.getNormal(true) ?? rayDir.negate();
          }
        } else if (orb.hasGravity && !bounced) {
          // Gravity orbs bounce off geometry instead of detonating
          const normal = hit.getNormal(true);
          if (normal) {
            const dot = Vector3.Dot(orb.velocity, normal);
            if (dot < 0) {
              orb.velocity = orb.velocity.subtract(normal.scale(2 * dot));
              orb.velocity.scaleInPlace(ORB.bounceDamping);
              orb.mesh.position.addInPlace(normal.scale(orbR + 0.05));
              bounced = true;
              // Ricochet spawns another gravity orb at random angle
              if (canRicochet && Math.random() < effectiveRicochetChance()) {
                const rDir = addRandomSpread(
                  orb.velocity.normalizeToNew(),
                  Math.PI * 0.5,
                );
                spawnOrb(
                  orb.mesh.position.add(rDir.scale(orbR + 0.1)),
                  rDir,
                  orb.chargeMultiplier,
                  orb.heatPenalty,
                  orb.isCrit,
                  orb.hasGravity,
                  orb.ricochetDepth + 1,
                );
              }
            }
          }
        } else if (!explode) {
          explode = true;
          explodePos = hit.pickedPoint;
          explodeNormal = hit.getNormal(true) ?? rayDir.negate();
        }
      }
    }

    if (orb.age > ORB.fuse) explode = true;

    if (explode) {
      // Ricochet on explosion (non-gravity orbs, or gravity orbs hitting enemies)
      if (
        canRicochet &&
        explodeNormal &&
        Math.random() < effectiveRicochetChance()
      ) {
        const rDir = reflectWithSpread(rayDir, explodeNormal);
        spawnOrb(
          explodePos.add(rDir.scale(orbR + 0.1)),
          rDir,
          orb.chargeMultiplier,
          orb.heatPenalty,
          orb.isCrit,
          orb.hasGravity,
          orb.ricochetDepth + 1,
        );
      }
      explodeOrb(
        explodePos,
        directHits,
        orb.heatPenalty,
        orb.mesh,
        orb.chargeMultiplier,
        false,
        orb.isCrit ? 1 : 0,
      );
      g.orbs.splice(i, 1);
    }
  }
}

function detonateOrb(orb: Orb, pos: Vector3, beamIsCrit = false): void {
  const directHits = new Map<Enemy, Mesh>();
  const critLevel = (orb.isCrit ? 1 : 0) + (beamIsCrit ? 1 : 0);
  explodeOrb(
    pos,
    directHits,
    orb.heatPenalty,
    orb.mesh,
    orb.chargeMultiplier,
    true,
    critLevel,
  );
}

function explodeOrb(
  pos: Vector3,
  directHits: Map<Enemy, Mesh>,
  heatPenalty: number,
  orbMesh: Mesh,
  chargeMultiplier: number,
  beamDetonated = false,
  critLevel = 0,
): void {
  const isCrit = critLevel > 0;
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
  const explosionRadius =
    ORB.explosionRadius * chargeMultiplier * Math.pow(2, critLevel);
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

  const critMult = Math.pow(effectiveCritDamage(), critLevel);
  const damage =
    (effectiveOrbDamage() * chargeMultiplier +
      (beamDetonated ? effectiveBeamDamage() : 0)) *
    critMult;

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
      dmg = damage * (beamDetonated ? 1 : ORB.splashFalloff) * falloff;
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

    if (enemy.hp <= 0) {
      killEnemy(enemy, flashMesh, pos, true);
    } else if (Math.random() < effectiveLightningChance()) {
      triggerLightning(enemy, critMult);
    }
  }

  // Knockback and split/shrink on ragdoll debris
  for (const mesh of g.scene.meshes.slice()) {
    if (
      mesh.name !== "bodyHalf" &&
      mesh.name !== "headHalf" &&
      mesh.name !== "armHalf" &&
      mesh.name !== "legHalf" &&
      mesh.name !== "enemyBody" &&
      mesh.name !== "enemyHead" &&
      mesh.name !== "enemyArm" &&
      mesh.name !== "enemyLeg"
    )
      continue;
    // Skip meshes still parented to a live enemy
    const p = mesh.parent;
    if (
      p &&
      g.enemies.some((e) => e.visualRoot === p || e.visualRoot === p.parent)
    )
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
    if (
      mesh.name === "bodyHalf" ||
      mesh.name === "headHalf" ||
      mesh.name === "armHalf" ||
      mesh.name === "legHalf"
    ) {
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
      ORB.damage *
        chargeMultiplier *
        (beamDetonated ? 1 : ORB.splashFalloff) *
        falloff *
        effectiveOrbSelfDamage(),
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

function triggerLightning(enemy: Enemy, critMult: number): void {
  const isCrit = critMult > 1;
  const ceilY = ARENA.ceil - 0.3;
  const enemyPos = enemy.bodyMesh.getAbsolutePosition();
  const strikeFrom = new Vector3(enemyPos.x, ceilY, enemyPos.z);

  spawnLightningBolt(strikeFrom, enemyPos, isCrit);
  playLightningSound(enemyPos);

  const dmg = Math.round(
    LIGHTNING.damage * critMult * (0.8 + Math.random() * 0.4),
  );
  enemy.hp -= dmg;
  const flashColor = isCrit ? new Color3(0.5, 0, 0.9) : new Color3(0.5, 0.7, 1);
  (enemy.bodyMesh.material as StandardMaterial).emissiveColor = flashColor;
  enemy.flashMesh = enemy.bodyMesh;
  enemy.flashTime = 200;
  if (enemy.hp <= 0) {
    killEnemy(enemy, enemy.bodyMesh, enemyPos);
    return;
  }

  // Chain to nearby enemies
  const struck = new Set<Enemy>([enemy]);
  let chainSource = enemyPos;
  for (let c = 0; c < LIGHTNING.maxChains; c++) {
    let closest: Enemy | null = null;
    let closestDist: number = LIGHTNING.chainRange;
    for (const e of g.enemies) {
      if (struck.has(e)) continue;
      const d = Vector3.Distance(chainSource, e.bodyMesh.getAbsolutePosition());
      if (d < closestDist) {
        closestDist = d;
        closest = e;
      }
    }
    if (!closest) break;
    struck.add(closest);

    const targetPos = closest.bodyMesh.getAbsolutePosition();
    spawnLightningBolt(chainSource, targetPos, isCrit);
    playLightningSound(targetPos);

    const chainDmg = Math.round(
      LIGHTNING.damage * critMult * (0.8 + Math.random() * 0.4),
    );
    closest.hp -= chainDmg;
    (closest.bodyMesh.material as StandardMaterial).emissiveColor = flashColor;
    closest.flashMesh = closest.bodyMesh;
    closest.flashTime = 200;
    if (closest.hp <= 0) {
      killEnemy(closest, closest.bodyMesh, targetPos);
    }
    chainSource = targetPos;
  }
}

function hitEnemy(
  enemy: Enemy,
  hitMesh: Mesh,
  hitPoint?: Vector3,
  isCrit = false,
): void {
  const headshot = hitMesh.name === "enemyHead";
  const hMax = effectiveHeatMax();
  const critHeat = hMax * HEAT.critical;
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

  if (enemy.hp <= 0) {
    killEnemy(enemy, hitMesh, hitPoint);
    return;
  }

  // Lightning proc
  if (Math.random() < effectiveLightningChance()) {
    triggerLightning(enemy, critMult);
  }
}

function incrementScore(amount: number, hitPoint?: Vector3): void {
  g.state.score += amount;
  updateHUD();
  while (g.state.score >= g.state.nextSupplyThreshold) {
    g.state.nextSupplyThreshold += SUPPLY.scoreInterval;
    if (Math.random() < effectiveSupplyDropRate() && hitPoint) {
      spawnSupply(hitPoint.clone());
    }
  }
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
  const barWidth = baseWidth * (maxHp / PLAYER.maxHealth);
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
