import {
  Vector3,
  StandardMaterial,
  Color3,
  Color4,
  AbstractMesh,
  Mesh,
} from "@babylonjs/core";
import {
  ENEMY,
  SUPPLY,
  PLAYER,
  BLASTER,
  RIFLE,
  SCORING,
  WAVE,
  BULLET_HOLE,
} from "./constants.js";
const { LASER, SPREAD, HEAT, IGNITE, MELEE } = BLASTER;
import { g, dom } from "./game.js";
import {
  spawnEnemy,
  spawnSupply,
  spawnFireEffect,
  spawnBayonetBloodBurst,
  spawnHitParticle,
  hitDebris,
} from "./spawn.js";
import {
  updateAudioListener,
  playEnemyFootstep,
  playEnemyAttackSound,
  playHealthSupplySound,
  playAmmoSupplySound,
  startBayonetChargeWindSound,
  stopBayonetChargeWindSound,
} from "./audio.js";
import {
  effectiveMaxHealth,
  effectiveSpeed,
  effectiveReloadTime,
  effectiveMagSize,
  effectiveHeatMax,
  effectiveHeatDecay,
  effectiveMoveSpreadRate,
  effectiveIgniteChance,
  showUpgradeMenu,
  selectUpgrade,
  updateHUD,
  incrementScore,
} from "./progression.js";
import {
  shoot,
  startReload,
  completeReload,
  updatePlasmaCharge,
  updatePlasmas,
  updateRifleBullets,
  damagePlayer,
  isEnemyPart,
  findEnemyByMesh,
  damageEnemy,
} from "./actions.js";
export { selectUpgrade };

// ─── Game loop ────────────────────────────────────────────────────────────────
export function update(): void {
  if (g.state.paused) {
    stopBayonetChargeWindSound();
    return;
  }
  const dt = g.engine.getDeltaTime();
  updateAudioListener();
  updateTimers(dt);
  updatePlayer();
  updateEnemies();
  updateBayonetCharge(dt);
  updateWeapon(dt);
}

function updateTimers(dt: number): void {
  while (g.queuedSupplyDrops.length > 0) {
    const dropPos = g.queuedSupplyDrops.shift();
    if (dropPos) spawnSupply(dropPos);
  }

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

  if (g.state.meleeCooldown > 0) g.state.meleeCooldown -= dt;
  if (g.state.meleeAnimTime > 0) g.state.meleeAnimTime -= dt;

  // Heat decay (blocked while charging plasma)
  if (g.state.heat > 0 && !g.plasmaCharging) {
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
  const barrelMat = g.weaponBarrel.material as StandardMaterial;
  if (g.state.activeWeapon === "blaster") {
    const heatMax = effectiveHeatMax();
    const criticalHeat = heatMax * HEAT.critical;
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

  // Fire DOT + spread
  const tickThreshold = IGNITE.damagePerSec / IGNITE.ticksPerSec;
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    if (!e.onFire) continue;
    e.fireDmgAccum += (IGNITE.damagePerSec * dt) / 1000;
    if (e.fireDmgAccum >= tickThreshold) {
      const tickDmg = Math.round(e.fireDmgAccum);
      e.fireDmgAccum = 0;
      const pos = e.bodyMesh.getAbsolutePosition();
      if (damageEnemy(e, tickDmg, e.bodyMesh, pos, false)) continue;
    }
    // Spread fire to nearby non-burning enemies
    e.fireSpreadTimer -= dt;
    if (e.fireSpreadTimer <= 0) {
      e.fireSpreadTimer = IGNITE.spreadTickMs;
      const pos = e.bodyMesh.getAbsolutePosition();
      for (const other of g.enemies) {
        if (other === e || other.onFire) continue;
        const dist = Vector3.Distance(
          pos,
          other.bodyMesh.getAbsolutePosition(),
        );
        if (
          dist < IGNITE.spreadRange &&
          Math.random() < effectiveIgniteChance()
        ) {
          other.onFire = true;
          other.fireSpreadTimer = IGNITE.spreadTickMs;
          spawnFireEffect(other);
        }
      }
    }
  }

  if (
    g.mouseHeld &&
    g.state.activeWeapon === "blaster" &&
    g.upgrades.pulseLaser
  ) {
    g.state.shootCooldown -= dt;
    if (g.state.shootCooldown <= 0) shoot();
  } else if (g.mouseHeld && g.state.activeWeapon === "rifle") {
    g.state.shootCooldown -= dt;
    if (g.state.shootCooldown <= 0) shoot();
  } else if (
    g.shootSpread > 0 &&
    g.state.shootCooldown <= 0 &&
    !g.plasmaCharging
  ) {
    const spreadDecay =
      g.state.activeWeapon === "rifle" ? RIFLE.SPREAD.decay : SPREAD.decay;
    g.shootSpread = Math.max(0, g.shootSpread - (spreadDecay * dt) / 1000);
  }
  if (!g.mouseHeld && g.state.shootCooldown > 0) {
    g.state.shootCooldown -= dt;
  }

  if (g.state.plasmaCooldown > 0) g.state.plasmaCooldown -= dt;
  if (g.plasmaCharging) updatePlasmaCharge(dt);
  updatePlasmas(dt);
  updateRifleBullets(dt);

  const recoilScale = g.upgrades.muzzleBrake
    ? RIFLE.MUZZLE_BRAKE.recoilScale
    : 1;
  const rifleRecoil = {
    recover: RIFLE.RECOIL.recover,
    cameraRatio: RIFLE.RECOIL.cameraRatio,
    maxPitch: RIFLE.RECOIL.maxPitch * recoilScale,
  };
  const rifleShooting = g.state.activeWeapon === "rifle" && g.mouseHeld;
  if (!rifleShooting) {
    if (g.recoilRoll > 0) {
      g.recoilRoll = Math.max(
        0,
        g.recoilRoll - rifleRecoil.recover * (dt / 1000),
      );
    } else if (g.recoilRoll < 0) {
      g.recoilRoll = Math.min(
        0,
        g.recoilRoll + rifleRecoil.recover * (dt / 1000),
      );
    }
    g.cameraRecoilPitch = Math.max(
      0,
      g.cameraRecoilPitch - rifleRecoil.recover * (dt / 1000),
    );
  }
  g.cameraRecoilPitch = Math.min(g.cameraRecoilPitch, rifleRecoil.maxPitch);
  g.recoilPitch = g.cameraRecoilPitch * (1 - rifleRecoil.cameraRatio);
  // Movement spread: increase while moving, decay when stopped
  const isMoving =
    g.pressedKeys.has("KeyW") ||
    g.pressedKeys.has("KeyS") ||
    g.pressedKeys.has("KeyA") ||
    g.pressedKeys.has("KeyD");
  if (isMoving) {
    const moveSpreadRate = effectiveMoveSpreadRate();
    const spreadMax =
      g.state.activeWeapon === "rifle" ? RIFLE.SPREAD.max : SPREAD.max;
    g.moveSpread = Math.min(
      spreadMax,
      g.moveSpread + (moveSpreadRate * dt) / 1000,
    );
  } else if (g.moveSpread > 0) {
    const spreadDecay =
      g.state.activeWeapon === "rifle" ? RIFLE.SPREAD.decay : SPREAD.decay;
    g.moveSpread = Math.max(0, g.moveSpread - (spreadDecay * dt) / 1000);
  }

  // Update crosshair spread offset (map radians to screen pixels)
  const spreadMax =
    g.state.activeWeapon === "rifle" ? RIFLE.SPREAD.max : SPREAD.max;
  const totalSpread =
    Math.min(g.shootSpread, spreadMax) + Math.min(g.moveSpread, spreadMax);
  const halfFov = g.camera.fov / 2;
  const screenDist = g.engine.getRenderHeight() / (2 * Math.tan(halfFov));
  const chOffset = Math.round(Math.tan(totalSpread) * screenDist);
  g.crosshairRecoil = Math.tan(g.recoilPitch) * screenDist;
  dom.chTop.style.bottom = `${3 + chOffset}px`;
  dom.chBottom.style.top = `${3 + chOffset}px`;
  dom.chLeft.style.right = `${3 + chOffset}px`;
  dom.chRight.style.left = `${3 + chOffset}px`;
  dom.crosshair.style.transform = `translate(-50%, calc(-50% - ${g.crosshairRecoil}px))`;

  // Crosshair color: red when over a living enemy
  const centerRay = g.camera.getForwardRay(100);
  if (g.state.activeWeapon === "rifle" && g.recoilPitch > 0) {
    const cameraUp = g.camera.getDirection(Vector3.Up()).normalize();
    centerRay.direction = centerRay.direction
      .add(cameraUp.scale(Math.tan(g.recoilPitch)))
      .normalize();
  }
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
      const maxReserve =
        (g.state.activeWeapon === "rifle"
          ? RIFLE.maxReserveMags
          : LASER.maxReserveMags) * effectiveMagSize();
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
  const cameraRecoilPitch = g.cameraRecoilPitch * RIFLE.RECOIL.cameraRatio;
  const recoilDelta = cameraRecoilPitch - g.appliedCameraRecoilPitch;
  if (recoilDelta !== 0) {
    g.camera.rotation.x -= recoilDelta;
    g.appliedCameraRecoilPitch = cameraRecoilPitch;
  }

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

  const vel = g.playerAggregate.body.getLinearVelocity();
  const currentXZ = new Vector3(vel.x, 0, vel.z);
  g.playerVelocityXZ = Vector3.Lerp(currentXZ, targetXZ, PLAYER.acceleration);
  g.playerAggregate.body.setLinearVelocity(
    new Vector3(g.playerVelocityXZ.x, vel.y, g.playerVelocityXZ.z),
  );
}

function wantsBayonetCharge(): boolean {
  return (
    g.state.running &&
    !g.state.paused &&
    g.state.activeWeapon === "rifle" &&
    g.upgrades.bayonet &&
    g.meleeHeld &&
    g.isSprinting &&
    g.pendingUpgrades.length === 0
  );
}

function updateBayonetCharge(dt: number): void {
  const wantsCharge = wantsBayonetCharge();
  if (!g.bayonetCharging && wantsCharge && g.state.meleeCooldown <= 0) {
    g.bayonetCharging = true;
  }

  if (g.bayonetCharging && !wantsCharge) {
    g.bayonetCharging = false;
  }

  if (!g.bayonetCharging) {
    g.bayonetChargeAnim = Math.max(
      0,
      g.bayonetChargeAnim - dt / RIFLE.BAYONET.chargeAnimOutMs,
    );
    stopBayonetChargeWindSound();
    return;
  }

  g.bayonetChargeAnim = Math.min(
    1,
    g.bayonetChargeAnim + dt / RIFLE.BAYONET.chargeAnimInMs,
  );
  startBayonetChargeWindSound();
  g.state.meleeAnimTime = RIFLE.MELEE.animDurationMs;

  const ray = g.camera.getForwardRay(RIFLE.BAYONET.range);
  const hit = g.scene.pickWithRay(
    ray,
    (m: AbstractMesh) =>
      m.renderingGroupId !== 1 &&
      m.name !== "player" &&
      m.name !== "enemyPhys" &&
      m.name !== "laserBeam" &&
      m.name !== "bhole" &&
      m.name !== "supply",
  );
  if (!hit?.hit || !hit.pickedMesh || !hit.pickedPoint) return;

  const hitPoint = hit.pickedPoint;
  endBayonetChargeOnImpact();

  if (isEnemyPart(hit.pickedMesh.name)) {
    const result = findEnemyByMesh(hit.pickedMesh);
    if (!result) return;
    const headshot = result.hitMesh.name === "enemyHead";
    const dmg = Math.round(
      RIFLE.MELEE.damage *
        RIFLE.BAYONET.damageMultiplier *
        RIFLE.BAYONET.chargeDamageMultiplier *
        (headshot ? 2 : 1),
    );
    (result.hitMesh.material as StandardMaterial).emissiveColor = new Color3(
      1,
      0,
      0,
    );
    result.enemy.flashMesh = result.hitMesh;
    result.enemy.flashTime = 200;
    damageEnemy(result.enemy, dmg, result.hitMesh, hitPoint, false, {
      canIgnite: true,
    });
    spawnBayonetBloodBurst(hitPoint);
    spawnHitParticle(
      hitPoint,
      new Color4(0.9, 0.0, 0.0, 1),
      hit.getNormal(true) ?? ray.direction.negate(),
    );
  } else if (
    hit.pickedMesh.name === "bodyHalf" ||
    hit.pickedMesh.name === "headHalf" ||
    hit.pickedMesh.name === "armHalf" ||
    hit.pickedMesh.name === "legHalf"
  ) {
    hitDebris(hit.pickedMesh as Mesh, ray.direction, hitPoint);
    spawnBayonetBloodBurst(hitPoint);
  }
}

function endBayonetChargeOnImpact(): void {
  const vel = g.playerAggregate.body.getLinearVelocity();
  g.bayonetCharging = false;
  g.meleeHeld = false;
  g.playerVelocityXZ = Vector3.Zero();
  g.state.meleeCooldown =
    RIFLE.MELEE.cooldownMs * RIFLE.BAYONET.chargeCooldownMultiplier;
  g.playerAggregate.body.setLinearVelocity(new Vector3(0, vel.y, 0));
}

// ─── Weapon animation ─────────────────────────────────────────────────────────
function updateWeapon(dt: number): void {
  if (!g.weaponRoot) return;
  g.weaponRoot.position.copyFrom(g.weaponRestPosition);

  if (g.state.activeWeapon === "rifle" && g.bayonetChargeAnim > 0) {
    updateRifleBayonetChargeWeapon();
    dom.crosshair.style.display = "none";
    return;
  }

  if (g.isSprinting) {
    g.sprintBobTime += dt;
    g.weaponRoot.rotation.x = 0.14 * Math.sin(g.sprintBobTime / 150);
    g.weaponRoot.rotation.z = 0.07 * Math.sin(g.sprintBobTime / 300);
    dom.crosshair.style.display = "none";
    return;
  }

  dom.crosshair.style.display = "";
  g.sprintBobTime = 0;

  if (g.state.activeWeapon === "rifle") {
    updateRifleWeapon();
    return;
  }

  // Pistol whip animation — overrides idle/reload while active
  if (g.state.meleeAnimTime > 0) {
    const t = 1 - g.state.meleeAnimTime / MELEE.animDurationMs;
    // Swing arc: fast forward thrust then return
    const swing = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
    g.weaponRoot.rotation.x = -0.8 * swing;
    g.weaponRoot.rotation.z = 0.3 * swing;
    g.weaponCell.isVisible = true;
    g.weaponCell.position.y = 0.09;
    return;
  }

  if (!g.state.reloading) {
    g.weaponRoot.rotation.x = -g.recoilPitch;
    g.weaponRoot.rotation.z = g.recoilRoll;
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
  g.weaponRoot.rotation.x = tilt - g.recoilPitch;
  g.weaponRoot.rotation.z = g.recoilRoll;

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

function updateRifleBayonetChargeWeapon(): void {
  const t =
    g.bayonetChargeAnim * g.bayonetChargeAnim * (3 - 2 * g.bayonetChargeAnim);
  const chargePos = new Vector3(
    0,
    RIFLE.BAYONET.chargeCenteredY,
    RIFLE.BAYONET.chargeForwardZ,
  );
  g.weaponRoot.position.copyFrom(
    Vector3.Lerp(g.weaponRestPosition, chargePos, t),
  );
  g.weaponRoot.rotation.x = RIFLE.BAYONET.chargePitch * t - 0.03 * (1 - t);
  g.weaponRoot.rotation.y = 0;
  g.weaponRoot.rotation.z = 0;
  g.weaponCell.position.copyFrom(new Vector3(0, -0.11, 0.13));
}

function updateRifleWeapon(): void {
  const mag = g.weaponCell;

  if (g.state.meleeAnimTime > 0) {
    const t = 1 - g.state.meleeAnimTime / RIFLE.MELEE.animDurationMs;
    if (g.upgrades.bayonet) {
      const thrust = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
      g.weaponRoot.position.z =
        g.weaponRestPosition.z + RIFLE.MELEE.thrustDistance * thrust;
      g.weaponRoot.rotation.x = -0.12 - g.recoilPitch;
      g.weaponRoot.rotation.y = 0.04 * Math.sin(t * Math.PI);
      g.weaponRoot.rotation.z = 0.03 * Math.sin(t * Math.PI * 2);
      mag.position.copyFrom(new Vector3(0, -0.11, 0.13));
      return;
    }
    const swing = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55;
    g.weaponRoot.rotation.x = -0.28 - swing * 0.7 - g.recoilPitch;
    g.weaponRoot.rotation.y = swing * 0.45;
    g.weaponRoot.rotation.z = 0.18 * swing + g.recoilRoll;
    mag.position.copyFrom(new Vector3(0, -0.11, 0.13));
    return;
  }

  if (!g.state.reloading) {
    g.weaponRoot.rotation.x = -0.08 - g.recoilPitch;
    g.weaponRoot.rotation.y = 0;
    g.weaponRoot.rotation.z = g.recoilRoll;
    mag.position.copyFrom(new Vector3(0, -0.11, 0.13));
    return;
  }

  const progress = 1 - g.state.reloadTimeLeft / effectiveReloadTime();
  const anim = RIFLE.RELOAD_ANIM;
  const magBase = new Vector3(0, -0.11, 0.13);
  let tilt = 0;
  let yaw = 0;

  if (progress < 0.2) {
    const t = progress / 0.2;
    tilt = anim.tilt * t;
    yaw = anim.yaw * t;
  } else if (progress < 0.8) {
    tilt = anim.tilt;
    yaw = anim.yaw;
  } else {
    const t = 1 - (progress - 0.8) / 0.2;
    tilt = anim.tilt * t;
    yaw = anim.yaw * t;
  }

  g.weaponRoot.rotation.x = -0.08 + tilt - g.recoilPitch;
  g.weaponRoot.rotation.y = yaw;
  g.weaponRoot.rotation.z = g.recoilRoll;

  if (progress < 0.3) {
    mag.position.copyFrom(magBase);
  } else if (progress < 0.45) {
    const t = (progress - 0.3) / 0.15;
    mag.position.copyFrom(
      new Vector3(
        magBase.x,
        magBase.y - anim.magDrop * t,
        magBase.z - anim.magPullBack * t,
      ),
    );
  } else if (progress < 0.7) {
    mag.position.copyFrom(
      new Vector3(
        magBase.x,
        magBase.y - anim.magDrop,
        magBase.z - anim.magPullBack,
      ),
    );
  } else if (progress < 0.85) {
    const t = (progress - 0.7) / 0.15;
    mag.position.copyFrom(
      new Vector3(
        magBase.x,
        magBase.y - anim.magDrop * (1 - t),
        magBase.z - anim.magPullBack * (1 - t),
      ),
    );
  } else {
    mag.position.copyFrom(magBase);
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
    if (g.state.wavePauseTimer <= 0) {
      startNextWave();
      return;
    }
    const secs = Math.ceil(g.state.wavePauseTimer / 1000);
    dom.waveBanner.textContent = `Next wave in ${secs}`;
    dom.waveBanner.classList.add("visible");
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
