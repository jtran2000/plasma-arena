import {
  Vector3,
  StandardMaterial,
  Color3,
  Color4,
  AbstractMesh,
  Mesh,
  Matrix,
  Quaternion,
  Ray,
} from "@babylonjs/core";
import {
  ENEMY,
  ELITE,
  SUPPLY,
  PLAYER,
  BLASTER,
  RIFLE,
  SCORING,
  WAVE,
  SHOTGUN,
  BULLET_HOLE,
  CAMERA,
} from "./constants.js";
const { LASER, SPREAD, HEAT, IGNITE, MELEE } = BLASTER;
import {
  g,
  dom,
  equipWeapon,
  releaseBayonetEmbed,
  spendStamina,
  disableBayonetEmbedLook,
  disableBayonetEmbedPlayerEnemyCollision,
  disableSprintLook,
  restoreSprintLook,
  type Enemy,
} from "./game.js";
import {
  spawnEnemy,
  spawnEnemyOrb,
  spawnSupply,
  spawnFireEffect,
  spawnBayonetGash,
  spawnBayonetBloodBurst,
  spawnHitParticle,
  hitDebris,
} from "./spawn.js";
import {
  updateAudioListener,
  playEnemyFootstep,
  playEnemyAttackSound,
  playEnemyOrbFireSound,
  playEnemyOrbHitSound,
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
  effectiveBlasterMagSize,
  effectiveHeatMax,
  effectiveHeatDecay,
  effectiveHealthRegenPerTick,
  effectiveMoveSpreadRate,
  effectiveRifleSpreadScale,
  effectiveSprintStaminaDrain,
  effectiveIgniteChance,
  showUpgradeMenu,
  selectUpgrade,
  updateStaminaHUD,
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
  findBayonetPinPosition,
  isEnemyPart,
  findEnemyByMesh,
  damageEnemy,
  applyRifleCrosshairRecoil,
} from "./actions.js";
export { selectUpgrade };

type BayonetTorsoSide = "front" | "back" | "left" | "right";
type BayonetEmbedResult = "embedded" | "blockedByEnemy" | "blockedByWorld";
type Aabb = { min: Vector3; max: Vector3 };
const HIDDEN_ZOOMED_SCOPE_PARTS = new Set([
  "rScopeLens",
  "rScopeRearShroud",
  "rScopeRearRim",
  "rScopeFrontRim",
]);
const RIFLE_SCOPE_EXIT_RELEASE_T = 0.1;
const RIFLE_LASER_GREEN = {
  lensDiffuse: new Color3(0.05, 0.75, 0.15),
  lensEmissive: new Color3(0.0, 0.5, 0.08),
  dotEmissive: new Color3(0.0, 1.0, 0.12),
};
const RIFLE_LASER_PURPLE = {
  lensDiffuse: new Color3(0.68, 0.2, 1.0),
  lensEmissive: new Color3(0.45, 0.08, 0.72),
  dotEmissive: new Color3(0.82, 0.18, 1.0),
};

// ─── Game loop ────────────────────────────────────────────────────────────────
export function update(): void {
  if (g.state.paused) {
    stopBayonetChargeWindSound();
    return;
  }
  const dt = g.engine.getDeltaTime();
  updateAudioListener();
  updateTimers(dt);
  updateRifleScope(dt);
  updatePlayer(dt);
  updateEnemies();
  updateEnemyOrbs(dt);
  updateBayonetCharge(dt);
  updateEmbeddedBayonet(dt);
  updateWeapon(dt);
  updateRifleLaserSight();
}

function updateRifleScope(dt: number): void {
  const movementKeyPressed =
    g.pressedKeys.has("KeyW") ||
    g.pressedKeys.has("KeyS") ||
    g.pressedKeys.has("KeyA") ||
    g.pressedKeys.has("KeyD");
  let scoped =
    g.rifleScoped &&
    g.upgrades.rifleScope &&
    g.weaponSwitchTarget === null &&
    g.state.activeWeapon === "rifle" &&
    g.state.running &&
    !g.state.reloading &&
    !g.isSprinting &&
    g.state.stamina > 0 &&
    !movementKeyPressed &&
    !g.bayonetEmbed &&
    g.pendingUpgrades.length === 0;
  if (scoped) {
    spendStamina((PLAYER.STAMINA.scopeDrainPerSec * dt) / 1000);
    if (g.state.stamina <= 0) scoped = false;
  }
  g.rifleScoped = scoped;
  // Keep the rifle in its centered aim pose until the first scope-out phase
  // finishes, so unscoping visually reverses the two-part scope-in motion.
  const aimTarget =
    scoped || (!scoped && g.rifleScopeZoomT > RIFLE_SCOPE_EXIT_RELEASE_T)
      ? 1
      : 0;
  const aimStep = Math.min(1, (RIFLE.SCOPE.weaponAimRate * dt) / 1000);
  g.rifleScopeAimT += (aimTarget - g.rifleScopeAimT) * aimStep;
  if (!scoped) {
    g.rifleScopeRecoilKicked = false;
  } else if (g.cameraRecoilPitch >= RIFLE.SCOPE.recoilExitPitch) {
    g.rifleScopeRecoilKicked = true;
  } else if (g.cameraRecoilPitch <= RIFLE.SCOPE.recoilReenterPitch) {
    g.rifleScopeRecoilKicked = false;
  }
  const scopeViewActive =
    scoped && g.rifleScopeAimT >= 0.995 && !g.rifleScopeRecoilKicked;
  g.rifleScopeViewActive = scopeViewActive;
  if (scoped) {
    g.shootSpread = 0;
    g.moveSpread = 0;
  }
  const targetFov = scopeViewActive
    ? CAMERA.defaultFov / RIFLE.SCOPE.zoom
    : CAMERA.defaultFov;
  const lerpT = Math.min(1, (RIFLE.SCOPE.zoomRate * dt) / 1000);
  // Aim centering and optical zoom are intentionally split: the weapon reaches
  // center first, then the scope picture/FOV take over for the second half.
  const zoomTarget = scopeViewActive ? 1 : 0;
  g.rifleScopeZoomT += (zoomTarget - g.rifleScopeZoomT) * lerpT;
  g.scopeOverlay.isVisible =
    scopeViewActive || g.rifleScopeZoomT > Number.EPSILON;
  g.scopeOverlay.markAsDirty();
  dom.hud.classList.toggle("scoped", scopeViewActive);
  if (g.state.activeWeapon === "rifle") {
    updateRifleFrontScopeHandoff();
    const rifleHidden = scopeViewActive && g.rifleScopeZoomT >= 0.995;
    g.rifleRoot.setEnabled(!rifleHidden);
    setZoomedScopeBodyVisible(!scopeViewActive);
  }
  g.camera.fov += (targetFov - g.camera.fov) * lerpT;
  g.camera.angularSensibility = scopeViewActive
    ? g.baseCameraAngularSensibility / RIFLE.SCOPE.sensitivityScale
    : g.baseCameraAngularSensibility;
}

function setZoomedScopeBodyVisible(visible: boolean): void {
  for (const child of g.rifleScope.getChildMeshes(false)) {
    if (HIDDEN_ZOOMED_SCOPE_PARTS.has(child.name)) child.setEnabled(visible);
  }
}

function setMeshTreeVisibility(root: AbstractMesh, visibility: number): void {
  root.visibility = visibility;
  for (const child of root.getChildMeshes(false)) child.visibility = visibility;
}

function updateRifleFrontScopeHandoff(): void {
  const fadeStart = 0.7;
  const fadeProgress = Math.max(
    0,
    Math.min(1, (g.rifleScopeZoomT - fadeStart) / (1 - fadeStart)),
  );
  const fadeT = smoothstep(fadeProgress);
  // During the last part of scope-in, fake the front assembly receding into
  // the tube so the muzzle package stops popping when the full rifle hides.
  const scale = 1 - 0.55 * fadeT;
  const visibility = 1 - 0.9 * fadeT;
  const pullback = 0.14 * fadeT;

  g.rifleBarrel.position.copyFrom(g.rifleBarrelBasePosition);
  g.rifleBarrel.position.z -= pullback;
  g.rifleBarrel.scaling.copyFrom(g.rifleBarrelBaseScaling);
  g.rifleBarrel.scaling.scaleInPlace(scale);
  g.rifleBarrel.visibility = visibility;

  g.rifleBrake.position.copyFrom(g.rifleBrakeBasePosition);
  g.rifleBrake.position.z -= pullback;
  g.rifleBrake.scaling.copyFrom(g.rifleBrakeBaseScaling);
  g.rifleBrake.scaling.scaleInPlace(scale);
  g.rifleBrake.visibility = visibility;

  g.rifleLaserSight.position.copyFrom(g.rifleLaserSightBasePosition);
  g.rifleLaserSight.position.z -= pullback;
  g.rifleLaserSight.scaling.copyFrom(g.rifleLaserSightBaseScaling);
  g.rifleLaserSight.scaling.scaleInPlace(scale);
  setMeshTreeVisibility(g.rifleLaserSight, visibility);

  g.rifleBayonet.position.copyFrom(g.rifleBayonetBasePosition);
  g.rifleBayonet.position.z -= pullback;
  g.rifleBayonet.scaling.copyFrom(g.rifleBayonetBaseScaling);
  g.rifleBayonet.scaling.scaleInPlace(scale);
  setMeshTreeVisibility(g.rifleBayonet, visibility);
}

function updateTimers(dt: number): void {
  if (g.rifleLaserCritTimer > 0) {
    g.rifleLaserCritTimer = Math.max(0, g.rifleLaserCritTimer - dt);
  }
  if (g.upgrades.rifleLaserSight) {
    g.rifleLaserCritCheckTimer -= dt;
    while (g.rifleLaserCritCheckTimer <= 0) {
      g.rifleLaserCritCheckTimer += RIFLE.LASER_SIGHT.critCheckIntervalMs;
      if (
        g.rifleLaserCritTimer <= 0 &&
        Math.random() < RIFLE.LASER_SIGHT.critCheckChance
      ) {
        g.rifleLaserCritTimer = RIFLE.LASER_SIGHT.critDurationMs;
      }
    }
  } else {
    g.rifleLaserCritTimer = 0;
    g.rifleLaserCritCheckTimer = RIFLE.LASER_SIGHT.critCheckIntervalMs;
  }
  while (g.queuedSupplyDrops.length > 0) {
    const dropPos = g.queuedSupplyDrops.shift();
    if (dropPos) spawnSupply(dropPos.position, dropPos.type);
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
  if (g.state.stamina < PLAYER.STAMINA.max) {
    g.state.staminaDisplayTimer = 0;
    g.state.staminaWasFull = false;
    if (g.state.staminaRegenBlockedByJump) {
      if (isPlayerGroundedForStaminaRegen()) {
        g.state.staminaRegenBlockedByJump = false;
        g.state.staminaRegenDelay = PLAYER.STAMINA.regenDelayMs;
      }
    } else if (g.state.staminaRegenDelay > 0) {
      g.state.staminaRegenDelay = Math.max(0, g.state.staminaRegenDelay - dt);
    } else {
      g.state.stamina = Math.min(
        PLAYER.STAMINA.max,
        g.state.stamina + (PLAYER.STAMINA.regenPerSec * dt) / 1000,
      );
    }
  } else {
    g.state.staminaRegenDelay = 0;
    g.state.staminaRegenBlockedByJump = false;
    if (!g.state.staminaWasFull) {
      g.state.staminaDisplayTimer = PLAYER.STAMINA.displayMs;
      g.state.staminaWasFull = true;
    } else {
      g.state.staminaDisplayTimer = Math.max(
        0,
        g.state.staminaDisplayTimer - dt,
      );
    }
  }
  updateStaminaHUD();

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

  g.state.timeSinceDamageMs += dt;
  const healthRegenPerTick = effectiveHealthRegenPerTick();
  const maxHealth = effectiveMaxHealth();
  if (
    healthRegenPerTick > 0 &&
    g.state.health > 0 &&
    g.state.health < maxHealth &&
    g.state.timeSinceDamageMs >= PLAYER.HEALTH_REGEN.delayMs
  ) {
    g.state.healthRegenTickTimer += dt;
    let healed = false;
    while (
      g.state.healthRegenTickTimer >= PLAYER.HEALTH_REGEN.tickMs &&
      g.state.health < maxHealth
    ) {
      g.state.health = Math.min(maxHealth, g.state.health + healthRegenPerTick);
      g.state.healthRegenTickTimer -= PLAYER.HEALTH_REGEN.tickMs;
      healed = true;
    }
    if (healed) updateHUD();
  } else if (
    g.state.timeSinceDamageMs < PLAYER.HEALTH_REGEN.delayMs ||
    g.state.health >= maxHealth ||
    healthRegenPerTick <= 0
  ) {
    g.state.healthRegenTickTimer = 0;
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

  const rifleBloomRecoilHoldActive = g.rifleBloomRecoilHoldTimer > 0;

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
    !g.plasmaCharging &&
    !(g.state.activeWeapon === "rifle" && rifleBloomRecoilHoldActive)
  ) {
    const spreadDecay =
      g.state.activeWeapon === "shotgun"
        ? SHOTGUN.SPREAD.decay
        : g.state.activeWeapon === "rifle"
          ? RIFLE.SPREAD.decay
          : SPREAD.decay;
    g.shootSpread = Math.max(0, g.shootSpread - (spreadDecay * dt) / 1000);
  }
  if (!g.mouseHeld && g.state.shootCooldown > 0) {
    g.state.shootCooldown -= dt;
  }
  if (g.state.pumpAnimTime > 0) {
    g.state.pumpAnimTime = Math.max(0, g.state.pumpAnimTime - dt);
  }
  if (g.rifleBloomRecoilHoldTimer > 0) {
    g.rifleBloomRecoilHoldTimer = Math.max(0, g.rifleBloomRecoilHoldTimer - dt);
  }

  if (g.state.plasmaCooldown > 0) g.state.plasmaCooldown -= dt;
  if (g.plasmaCharging) updatePlasmaCharge(dt);
  updatePlasmas(dt);
  updateRifleBullets(dt);

  const recoilScale = g.upgrades.muzzleBrake
    ? RIFLE.MUZZLE_BRAKE.recoilScale
    : 1;
  const scopedRecoilScale = g.rifleScoped ? RIFLE.RECOIL.scopedScale : 1;
  const rifleRecoil = {
    recover: RIFLE.RECOIL.recover,
    cameraRatio: RIFLE.RECOIL.cameraRatio,
    maxPitch: RIFLE.RECOIL.maxPitch * recoilScale * scopedRecoilScale,
  };
  const rifleShooting = g.state.activeWeapon === "rifle" && g.mouseHeld;
  if (!rifleShooting && !rifleBloomRecoilHoldActive) {
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
  if (g.rifleScoped) {
    g.shootSpread = 0;
    g.moveSpread = 0;
  } else if (isMoving) {
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
    (Math.min(g.shootSpread, spreadMax) + Math.min(g.moveSpread, spreadMax)) *
    (g.state.activeWeapon === "rifle" ? effectiveRifleSpreadScale() : 1);
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
  const centerRay = applyRifleCrosshairRecoil(g.camera.getForwardRay(100));
  const centerHit = g.scene.pickWithRay(centerRay);
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
      const blasterMaxMag = effectiveBlasterMagSize();
      const blasterMaxReserve = LASER.maxReserveMags * blasterMaxMag;
      const activeMaxReserve =
        (g.state.activeWeapon === "shotgun"
          ? SHOTGUN.maxReserveMags
          : g.state.activeWeapon === "rifle"
            ? RIFLE.maxReserveMags
            : LASER.maxReserveMags) * effectiveMagSize();
      const rifleMaxReserve = RIFLE.maxReserveMags * RIFLE.magSize;
      const shotgunMaxReserve = SHOTGUN.maxReserveMags * SHOTGUN.magSize;
      if (
        (p.type === "health" || p.type === "surgeryKit") &&
        g.state.health >= effectiveMaxHealth()
      )
        continue;
      if (
        p.type === "ammoCrate" &&
        g.weaponAmmo.blaster.ammo >= blasterMaxMag &&
        g.weaponAmmo.blaster.reserve >= blasterMaxReserve &&
        g.weaponAmmo.rifle.ammo >= RIFLE.magSize &&
        g.weaponAmmo.rifle.reserve >= rifleMaxReserve &&
        g.weaponAmmo.shotgun.ammo >= SHOTGUN.magSize &&
        g.weaponAmmo.shotgun.reserve >= shotgunMaxReserve
      ) {
        continue;
      }
      if (
        p.type === "shotgunAmmo" &&
        g.weaponAmmo.shotgun.reserve >= shotgunMaxReserve
      )
        continue;
      if (p.type === "ammo" && g.state.reserve >= activeMaxReserve) continue;
      if (
        p.type === "rifleAmmo" &&
        g.weaponAmmo.rifle.reserve >= rifleMaxReserve
      )
        continue;
      if (p.type === "health") {
        g.state.health = Math.min(
          effectiveMaxHealth(),
          g.state.health + SUPPLY.healthAmount,
        );
      } else if (p.type === "surgeryKit") {
        g.state.health = effectiveMaxHealth();
      } else if (p.type === "ammoCrate") {
        g.weaponAmmo.blaster.ammo = blasterMaxMag;
        g.weaponAmmo.blaster.reserve = blasterMaxReserve;
        g.weaponAmmo.rifle.ammo = RIFLE.magSize;
        g.weaponAmmo.rifle.reserve = rifleMaxReserve;
        g.weaponAmmo.shotgun.ammo = SHOTGUN.magSize;
        g.weaponAmmo.shotgun.reserve = shotgunMaxReserve;
        g.state.ammo = g.weaponAmmo[g.state.activeWeapon].ammo;
        g.state.reserve = g.weaponAmmo[g.state.activeWeapon].reserve;
        g.state.reloading = false;
        g.state.reloadTimeLeft = 0;
        g.state.autoReloadDelay = 0;
        dom.reloadMsg.classList.remove("visible");
      } else if (p.type === "rifleAmmo") {
        g.weaponAmmo.rifle.reserve = Math.min(
          rifleMaxReserve,
          g.weaponAmmo.rifle.reserve + RIFLE.magSize,
        );
        if (g.state.activeWeapon === "rifle") {
          g.state.reserve = g.weaponAmmo.rifle.reserve;
        }
      } else if (p.type === "shotgunAmmo") {
        g.weaponAmmo.shotgun.reserve = Math.min(
          shotgunMaxReserve,
          g.weaponAmmo.shotgun.reserve + SHOTGUN.magSize,
        );
        if (g.state.activeWeapon === "shotgun") {
          g.state.reserve = g.weaponAmmo.shotgun.reserve;
        }
      } else {
        g.state.reserve = Math.min(
          activeMaxReserve,
          g.state.reserve + effectiveMagSize(),
        );
      }
      updateHUD();
      const supplyPos = p.mesh.position.clone();
      if (p.type === "health" || p.type === "surgeryKit") {
        playHealthSupplySound(supplyPos);
      } else playAmmoSupplySound(supplyPos);
      p.aggregate.dispose();
      p.mesh.dispose();
      g.supplies.splice(i, 1);
    }
  }
}

function isPlayerGroundedForStaminaRegen(): boolean {
  const vel = g.playerAggregate.body.getLinearVelocity();
  if (vel.y > 0.5) return false;

  const groundRay = new Ray(g.playerMesh.position, new Vector3(0, -1, 0), 1.05);
  const hit = g.scene.pickWithRay(groundRay);
  return !!hit?.hit;
}

function updateRifleLaserSight(): void {
  if (!g.rifleLaserDot) return;
  syncRifleLaserSightColors();
  const embed = g.bayonetEmbed;
  const visible =
    g.state.running &&
    !g.state.paused &&
    g.upgrades.rifleLaserSight &&
    g.state.activeWeapon === "rifle" &&
    !g.state.reloading &&
    g.pendingUpgrades.length === 0;
  g.rifleLaserDot.setEnabled(visible);
  g.rifleLaserLight?.setEnabled(visible);
  g.rifleLaserGlow?.setEnabled(visible);
  if (!visible) return;

  if (embed) {
    const toCamera = g.camera.position
      .subtract(embed.targetHitPoint)
      .normalize();
    const cameraUp = g.camera.getDirection(Vector3.Up()).normalize();
    const cameraRight = g.camera.getDirection(Vector3.Right()).normalize();
    const dotPosition = embed.targetHitPoint.add(
      embed.hitNormal
        .scale(RIFLE.LASER_SIGHT.surfaceOffset)
        .add(toCamera.scale(RIFLE.LASER_SIGHT.surfaceOffset * 3))
        .add(cameraUp.scale(RIFLE.LASER_SIGHT.embedOffsetUp))
        .add(cameraRight.scale(-RIFLE.LASER_SIGHT.embedOffsetLeft)),
    );
    g.rifleLaserDot.position.copyFrom(dotPosition);
    const embedDistance = Vector3.Distance(
      g.camera.position,
      g.rifleLaserDot.position,
    );
    const embedWorldDiameter =
      (RIFLE.LASER_SIGHT.screenDiameterPx *
        2 *
        embedDistance *
        Math.tan(g.camera.fov / 2)) /
      g.engine.getRenderHeight();
    applyRifleLaserDotIncidenceShape(
      dotPosition,
      embedWorldDiameter,
      embed.hitNormal.normalizeToNew(),
      cameraUp,
    );
    updateRifleLaserLight();
    return;
  }

  const laserOrigin = getRifleLaserOrigin();
  let laserDir: Vector3;
  if (g.barrelClipT > 0) {
    // Weapon is tilted — aim the laser along the actual barrel direction
    laserDir = g.barrelTip.getDirection(Vector3.Forward()).normalize();
  } else {
    const aimRay = applyRifleCrosshairRecoil(g.camera.getForwardRay(100));
    const aimHit = g.scene.pickWithRay(aimRay);
    const aimTarget =
      aimHit?.hit && aimHit.pickedPoint
        ? aimHit.pickedPoint
        : aimRay.origin.add(aimRay.direction.scale(100));
    const lensDir = aimTarget.subtract(laserOrigin);
    laserDir =
      lensDir.lengthSquared() > 0.0001
        ? lensDir.normalize()
        : aimRay.direction.clone();
  }
  const hit = g.scene.pickWithRay(new Ray(laserOrigin, laserDir, 100));
  if (hit?.hit && hit.pickedPoint) {
    const normal =
      hit.getNormal(true)?.normalizeToNew() ?? laserDir.scale(-1).normalize();
    const dotPosition = hit.pickedPoint.add(
      normal.scale(RIFLE.LASER_SIGHT.surfaceOffset),
    );
    g.rifleLaserDot.position.copyFrom(dotPosition);
    const distance = Vector3.Distance(g.camera.position, dotPosition);
    const worldDiameter =
      (RIFLE.LASER_SIGHT.screenDiameterPx *
        2 *
        distance *
        Math.tan(g.camera.fov / 2)) /
      g.engine.getRenderHeight();
    const cameraUp = g.camera.getDirection(Vector3.Up()).normalize();
    applyRifleLaserDotIncidenceShape(
      dotPosition,
      worldDiameter,
      normal,
      cameraUp,
    );
  } else {
    g.rifleLaserDot.position.copyFrom(laserOrigin.add(laserDir.scale(100)));
    const distance = Vector3.Distance(
      g.camera.position,
      g.rifleLaserDot.position,
    );
    const worldDiameter =
      (RIFLE.LASER_SIGHT.screenDiameterPx *
        2 *
        distance *
        Math.tan(g.camera.fov / 2)) /
      g.engine.getRenderHeight();
    const scale = worldDiameter / RIFLE.LASER_SIGHT.dotSize;
    g.rifleLaserDot.rotationQuaternion = null;
    g.rifleLaserDot.scaling.setAll(scale);
  }
  updateRifleLaserLight();
}

function syncRifleLaserSightColors(): void {
  const palette =
    g.rifleLaserCritTimer > 0 ? RIFLE_LASER_PURPLE : RIFLE_LASER_GREEN;
  const dotMat = g.rifleLaserDot?.material as StandardMaterial | null;
  if (dotMat) {
    dotMat.emissiveColor.copyFrom(palette.dotEmissive);
  }
  const lens = g.rifleLaserSight
    ?.getChildMeshes(false)
    .find((child) => child.name === "rLaserSightLens");
  const lensMat = lens?.material as StandardMaterial | undefined;
  if (lensMat) {
    lensMat.diffuseColor.copyFrom(palette.lensDiffuse);
    lensMat.emissiveColor.copyFrom(palette.lensEmissive);
  }
  if (g.rifleLaserLight) {
    g.rifleLaserLight.diffuse.copyFrom(palette.lensDiffuse);
    g.rifleLaserLight.specular.copyFrom(palette.lensDiffuse);
  }
  if (g.rifleLaserGlow) {
    g.rifleLaserGlow.diffuse.copyFrom(palette.lensDiffuse);
    g.rifleLaserGlow.specular.copyFrom(palette.lensDiffuse);
  }
}

function getRifleLaserOrigin(): Vector3 {
  const lens = g.rifleLaserSight
    ?.getChildMeshes(false)
    .find((child) => child.name === "rLaserSightLens");
  return lens?.getAbsolutePosition() ?? g.rifleBarrelTip.getAbsolutePosition();
}

function applyRifleLaserDotIncidenceShape(
  dotPosition: Vector3,
  worldDiameter: number,
  surfaceNormal: Vector3 | null,
  fallbackUp: Vector3,
): void {
  if (!surfaceNormal) {
    g.rifleLaserDot.rotationQuaternion = null;
    g.rifleLaserDot.scaling.setAll(worldDiameter / RIFLE.LASER_SIGHT.dotSize);
    return;
  }

  const laserDir = dotPosition.subtract(getRifleLaserOrigin());
  if (laserDir.lengthSquared() < 0.0001) {
    g.rifleLaserDot.rotationQuaternion = null;
    g.rifleLaserDot.scaling.setAll(worldDiameter / RIFLE.LASER_SIGHT.dotSize);
    return;
  }

  laserDir.normalize();
  const normal = surfaceNormal.normalizeToNew();
  const incidence = Math.max(0.2, Math.abs(Vector3.Dot(laserDir, normal)));
  const majorScale = worldDiameter / incidence / RIFLE.LASER_SIGHT.dotSize;
  const minorScale = worldDiameter / RIFLE.LASER_SIGHT.dotSize;
  const tangent = laserDir
    .subtract(normal.scale(Vector3.Dot(laserDir, normal)))
    .normalize();
  const bitangent =
    tangent.lengthSquared() > 0.0001
      ? Vector3.Cross(normal, tangent).normalize()
      : Vector3.Cross(normal, fallbackUp).normalize();
  const rotationMatrix = new Matrix();
  Matrix.FromXYZAxesToRef(tangent, bitangent, normal, rotationMatrix);
  g.rifleLaserDot.rotationQuaternion =
    Quaternion.FromRotationMatrix(rotationMatrix);
  g.rifleLaserDot.scaling.set(
    majorScale,
    minorScale,
    Math.max(0.12, minorScale * 0.18),
  );
}

function updateRifleLaserLight(): void {
  if (!g.rifleLaserLight || !g.rifleLaserSight || !g.rifleLaserDot) return;
  const lens = g.rifleLaserSight
    .getChildMeshes(false)
    .find((child) => child.name === "rLaserSightLens");
  if (!lens) return;
  const origin = lens.getAbsolutePosition();
  const direction = g.rifleLaserDot.position.subtract(origin);
  if (direction.lengthSquared() < 0.0001) return;
  g.rifleLaserLight.position.copyFrom(origin);
  g.rifleLaserLight.direction.copyFrom(direction.normalize());
}

// ─── Player ───────────────────────────────────────────────────────────────────
function updatePlayer(dt: number): void {
  if (!g.state.running) return;

  const p = g.playerMesh.position;
  g.camera.position.set(p.x, p.y + 0.76, p.z);
  const cameraRecoilPitch = g.cameraRecoilPitch * RIFLE.RECOIL.cameraRatio;
  const recoilDelta = cameraRecoilPitch - g.appliedCameraRecoilPitch;
  if (recoilDelta !== 0) {
    g.camera.rotation.x -= recoilDelta;
    g.appliedCameraRecoilPitch = cameraRecoilPitch;
  }
  const sprintKey =
    g.pressedKeys.has("ShiftLeft") || g.pressedKeys.has("ShiftRight");
  if (!sprintKey) g.sprintBlockedUntilShiftRelease = false;
  const canSprint =
    sprintKey &&
    !g.sprintBlockedUntilShiftRelease &&
    g.state.meleeCooldown <= 0 &&
    g.state.stamina > 0 &&
    !g.bayonetEmbed;
  const sprintControls =
    canSprint && (g.isSprinting || g.pressedKeys.has("KeyW"));
  if (sprintControls) {
    const turnInput =
      (g.pressedKeys.has("KeyD") ? 1 : 0) - (g.pressedKeys.has("KeyA") ? 1 : 0);
    if (turnInput !== 0) {
      g.camera.rotation.y += turnInput * PLAYER.sprintTurnSpeed * (dt / 1000);
    }
  }

  const fwd = g.camera.getForwardRay().direction;
  const forwardXZ = new Vector3(fwd.x, 0, fwd.z);
  if (forwardXZ.lengthSquared() > 0) forwardXZ.normalize();
  const right = Vector3.Cross(Vector3.Up(), forwardXZ);

  const wish = Vector3.Zero();
  if (g.pressedKeys.has("KeyW")) wish.addInPlace(forwardXZ);
  if (g.pressedKeys.has("KeyS") && !sprintControls) {
    releaseBayonetEmbed();
    wish.subtractInPlace(forwardXZ);
  }
  if (g.pressedKeys.has("KeyA") && !sprintControls) wish.subtractInPlace(right);
  if (g.pressedKeys.has("KeyD") && !sprintControls) wish.addInPlace(right);

  const wasSprinting = g.isSprinting;
  let nowSprinting =
    canSprint && g.pressedKeys.has("KeyW") && wish.lengthSquared() > 0;

  if (nowSprinting && !g.isSprinting && g.state.reloading) {
    g.state.reloading = false;
    g.state.reloadTimeLeft = 0;
    dom.reloadMsg.classList.remove("visible");
  }
  g.isSprinting = nowSprinting;
  if (wasSprinting && !g.isSprinting) endSprintSession();
  if (g.isSprinting) lockSprintView();

  const vel = g.playerAggregate.body.getLinearVelocity();
  const currentXZ = new Vector3(vel.x, 0, vel.z);

  if (nowSprinting) {
    const wishDir = wish.clone().normalize();
    const turnedTooHard = lowerSprintRampForTurn(wishDir);
    const forwardDistance =
      Math.max(0, Vector3.Dot(currentXZ, wishDir)) * (dt / 1000);
    if (!turnedTooHard) {
      g.sprintRamp = Math.min(
        1,
        g.sprintRamp + forwardDistance / PLAYER.sprintRampDistance,
      );
    }
    g.sprintRampDirection.copyFrom(wishDir);
    spendStamina((effectiveSprintStaminaDrain() * dt) / 1000);
    if (g.state.stamina <= 0) {
      breakSprintUntilShiftRelease();
      nowSprinting = false;
    }
  } else {
    g.sprintRamp = 0;
    g.sprintRampDirection.set(0, 0, 0);
  }

  const sprintScale = 1 + (PLAYER.sprintMultiplier - 1) * g.sprintRamp;
  const maxSpeed = effectiveSpeed() * sprintScale;
  let targetXZ =
    wish.lengthSquared() > 0
      ? wish.normalize().scale(maxSpeed)
      : Vector3.Zero();

  if (nowSprinting && sprintWasBlocked(currentXZ, targetXZ)) {
    breakSprintUntilShiftRelease();
    targetXZ =
      wish.lengthSquared() > 0
        ? wish.normalize().scale(effectiveSpeed())
        : Vector3.Zero();
  }
  dom.speedLines.classList.toggle("active", g.isSprinting && g.sprintRamp >= 1);
  g.playerVelocityXZ = Vector3.Lerp(currentXZ, targetXZ, PLAYER.acceleration);
  g.playerAggregate.body.setLinearVelocity(
    new Vector3(g.playerVelocityXZ.x, vel.y, g.playerVelocityXZ.z),
  );
}

function sprintWasBlocked(currentXZ: Vector3, targetXZ: Vector3): boolean {
  if (g.sprintRamp < PLAYER.sprintImpactMinRamp) return false;
  if (targetXZ.lengthSquared() <= 0) return false;

  const wishDir = targetXZ.clone().normalize();
  const expectedSpeed = Math.max(0, Vector3.Dot(g.playerVelocityXZ, wishDir));
  const actualSpeed = Math.max(0, Vector3.Dot(currentXZ, wishDir));

  return (
    expectedSpeed > effectiveSpeed() &&
    actualSpeed < expectedSpeed * PLAYER.sprintImpactSpeedRatio
  );
}

function breakSprintUntilShiftRelease(): void {
  g.sprintRamp = 0;
  g.sprintRampDirection.set(0, 0, 0);
  g.isSprinting = false;
  g.sprintBlockedUntilShiftRelease = true;
  endSprintSession();
}

function lowerSprintRampForTurn(wishDir: Vector3): boolean {
  if (g.sprintRampDirection.lengthSquared() <= 0 || g.sprintRamp <= 0) {
    return false;
  }

  const dot = Math.max(
    -1,
    Math.min(1, Vector3.Dot(g.sprintRampDirection, wishDir)),
  );
  const angle = Math.acos(dot);
  const turnScale = Math.max(0, 1 - angle / PLAYER.sprintRampResetTurnAngle);
  g.sprintRamp *= turnScale;
  return turnScale <= 0;
}

function endSprintSession(): void {
  restoreSprintLook();
  if (g.bayonetChargeCooldownPending) applyBayonetChargeCooldown();
  g.bayonetChargeCooldownPending = false;
  g.bayonetChargeLockedUntilSprintEnd = false;
}

function lockSprintView(): void {
  disableSprintLook();
  g.camera.rotation.x = 0;
  g.recoilPitch = 0;
  g.cameraRecoilPitch = 0;
  g.appliedCameraRecoilPitch = 0;
}

function wantsBayonetCharge(): boolean {
  return (
    g.state.running &&
    !g.state.paused &&
    g.state.activeWeapon === "rifle" &&
    g.upgrades.bayonet &&
    g.meleeHeld &&
    g.isSprinting &&
    g.sprintRamp >= 1 &&
    !g.bayonetChargeLockedUntilSprintEnd &&
    g.pendingUpgrades.length === 0
  );
}

function updateBayonetCharge(dt: number): void {
  const wantsCharge = wantsBayonetCharge();
  if (!g.bayonetCharging && wantsCharge && g.state.meleeCooldown <= 0) {
    g.bayonetCharging = true;
  }

  if (g.bayonetCharging && !wantsCharge) {
    abortBayonetCharge(!g.meleeHeld && g.isSprinting);
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
  const hit = g.scene.pickWithRay(ray);
  if (!hit?.hit || !hit.pickedMesh || !hit.pickedPoint) return;

  const hitPoint = hit.pickedPoint;
  endBayonetChargeOnImpact();

  if (isEnemyPart(hit.pickedMesh.name)) {
    const result = findEnemyByMesh(hit.pickedMesh);
    if (!result) return;
    const torsoAnchor = getBayonetTorsoAnchor(result.enemy, ray.direction);
    const dmg = Math.round(
      RIFLE.MELEE.damage *
        RIFLE.BAYONET.damageMultiplier *
        RIFLE.BAYONET.chargeDamageMultiplier,
    );
    (result.hitMesh.material as StandardMaterial).emissiveColor = new Color3(
      1,
      0,
      0,
    );
    result.enemy.flashMesh = result.hitMesh;
    result.enemy.flashTime = 200;
    spawnBayonetGash(
      torsoAnchor.position,
      torsoAnchor.normal,
      result.enemy.bodyMesh,
    );
    const killed = damageEnemy(
      result.enemy,
      dmg,
      result.enemy.bodyMesh,
      torsoAnchor.position,
      false,
      {
        canIgnite: true,
        intactKill: true,
      },
    );
    if (!killed) {
      const embedResult = embedBayonetInEnemy(
        result.enemy,
        torsoAnchor.position,
        ray.direction,
        torsoAnchor.side,
      );
      if (embedResult === "blockedByWorld") {
        damageEnemy(
          result.enemy,
          result.enemy.hp,
          result.enemy.bodyMesh,
          torsoAnchor.position,
          false,
          { canIgnite: false, intactKill: true },
        );
      }
    }
    spawnBayonetBloodBurst(torsoAnchor.position);
    spawnHitParticle(
      torsoAnchor.position,
      new Color4(0.9, 0.0, 0.0, 1),
      torsoAnchor.normal,
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
  g.bayonetChargeCooldownPending = false;
  breakSprintUntilShiftRelease();
  g.playerVelocityXZ = Vector3.Zero();
  applyBayonetChargeCooldown();
  g.playerAggregate.body.setLinearVelocity(new Vector3(0, vel.y, 0));
}

function abortBayonetCharge(deferCooldownUntilSprintEnd: boolean): void {
  g.bayonetCharging = false;
  g.bayonetChargeCooldownPending = false;
  g.bayonetChargeLockedUntilSprintEnd = g.isSprinting;
  if (deferCooldownUntilSprintEnd) {
    g.bayonetChargeLockedUntilSprintEnd = true;
    g.bayonetChargeCooldownPending = true;
    return;
  }
  applyBayonetChargeCooldown();
}

function applyBayonetChargeCooldown(): void {
  g.state.meleeCooldown = Math.max(
    g.state.meleeCooldown,
    RIFLE.MELEE.cooldownMs * RIFLE.BAYONET.chargeCooldownMultiplier,
  );
}

function getBayonetTorsoAnchor(
  enemy: Enemy,
  chargeDirection: Vector3,
): { position: Vector3; normal: Vector3; side: BayonetTorsoSide } {
  const bodyWorld = enemy.bodyMesh.computeWorldMatrix(true);
  const bodyWorldInv = bodyWorld.clone().invert();
  const bodyLocalCharge = Vector3.TransformNormal(
    chargeDirection,
    bodyWorldInv,
  );
  const { minimum, maximum } = enemy.bodyMesh.getBoundingInfo().boundingBox;
  const center = minimum.add(maximum).scale(0.5);
  const anchors = [
    {
      side: "front" as const,
      position: new Vector3(center.x, center.y, maximum.z),
      normal: new Vector3(0, 0, 1),
    },
    {
      side: "back" as const,
      position: new Vector3(center.x, center.y, minimum.z),
      normal: new Vector3(0, 0, -1),
    },
    {
      side: "left" as const,
      position: new Vector3(minimum.x, center.y, center.z),
      normal: new Vector3(-1, 0, 0),
    },
    {
      side: "right" as const,
      position: new Vector3(maximum.x, center.y, center.z),
      normal: new Vector3(1, 0, 0),
    },
  ];
  const localChargeXZ = new Vector3(bodyLocalCharge.x, 0, bodyLocalCharge.z);
  const side =
    localChargeXZ.lengthSquared() > 0 &&
    Math.abs(localChargeXZ.z) <= RIFLE.BAYONET.embedSideHitDotThreshold
      ? localChargeXZ.x < 0
        ? "right"
        : "left"
      : localChargeXZ.z < 0
        ? "front"
        : "back";
  const closest = anchors.find((anchor) => anchor.side === side) ?? anchors[0];
  return {
    position: Vector3.TransformCoordinates(closest.position, bodyWorld),
    normal: Vector3.TransformNormal(closest.normal, bodyWorld).normalize(),
    side: closest.side,
  };
}

function embedBayonetInEnemy(
  enemy: Enemy,
  hitPoint: Vector3,
  chargeDirection: Vector3,
  torsoSide: BayonetTorsoSide,
): BayonetEmbedResult {
  const direction = new Vector3(chargeDirection.x, 0, chargeDirection.z);
  if (direction.lengthSquared() < 0.0001) direction.copyFrom(Vector3.Forward());
  direction.normalize();

  const pin = findBayonetPinPosition(hitPoint, direction);
  const hitLocalPosition = Vector3.TransformCoordinates(
    hitPoint,
    enemy.visualRoot.getWorldMatrix().clone().invert(),
  );
  const targetVisualRotation = getBayonetEmbedVisualQuaternion(
    pin.normal,
    direction,
    torsoSide,
  );
  const pinPosition = pin.position.clone();
  const groundOffset = calculateBayonetGroundOffset(
    enemy,
    pinPosition,
    targetVisualRotation,
    pin.hitPoint.y,
  );
  pinPosition.y += groundOffset;
  const targetHitPoint = transformBayonetEmbedLocalPoint(
    pinPosition,
    hitLocalPosition,
    targetVisualRotation,
  );
  const hitNormal = getBayonetEmbedHitNormal(targetVisualRotation, torsoSide);
  const startCameraRotation = g.camera.rotation.clone();
  const {
    playerPosition: targetPlayerPosition,
    cameraRotation: targetCameraRotation,
  } = solveBayonetEmbedPlayerPose(
    targetHitPoint,
    startCameraRotation,
    direction,
    torsoSide,
  );
  const collision = getBayonetEmbedCollision(
    enemy,
    pinPosition,
    targetVisualRotation,
    targetPlayerPosition,
  );
  if (collision !== null) {
    return collision;
  }
  const { playerCollideMask, enemyMembershipMask } =
    disableBayonetEmbedPlayerEnemyCollision(enemy);

  g.bayonetEmbed = {
    enemy,
    direction,
    hitNormal,
    startPosition: enemy.physMesh.position.clone(),
    pinPosition,
    targetHitPoint,
    startPlayerPosition: g.playerMesh.position.clone(),
    playerPosition: targetPlayerPosition,
    startVisualRotation:
      enemy.visualRoot.rotationQuaternion?.clone() ??
      Quaternion.FromEulerAngles(
        enemy.visualRoot.rotation.x,
        enemy.visualRoot.rotation.y,
        enemy.visualRoot.rotation.z,
      ),
    targetVisualRotation,
    startCameraRotation,
    targetCameraRotation,
    playerCollideMask,
    enemyMembershipMask,
    progress: 0,
  };
  g.bayonetEmbedCameraPitch = 0;
  g.appliedBayonetEmbedCameraPitch = 0;
  g.rifleScoped = false;
  g.rifleScopeViewActive = false;
  g.rifleScopeRecoilKicked = false;
  g.rifleScopeAimT = 0;
  g.rifleScopeZoomT = 0;
  if (g.scopeOverlay) g.scopeOverlay.isVisible = false;
  dom.hud.classList.remove("scoped");
  disableBayonetEmbedLook();
  enemy.state = "patrol";
  enemy.attackCooldown = enemy.meleeIntervalMs;
  enemy.aggregate.body.setLinearVelocity(Vector3.Zero());
  return "embedded";
}

function solveBayonetEmbedPlayerPose(
  targetHitPoint: Vector3,
  startCameraRotation: Vector3,
  direction: Vector3,
  torsoSide: BayonetTorsoSide,
): { playerPosition: Vector3; cameraRotation: Vector3 } {
  const playerStandoff =
    torsoSide === "front"
      ? RIFLE.BAYONET.embedPlayerFrontStandoff
      : torsoSide === "back"
        ? RIFLE.BAYONET.embedPlayerBackStandoff
        : RIFLE.BAYONET.embedPlayerStandoff;
  const playerPosition = targetHitPoint.subtract(
    direction.scale(playerStandoff),
  );
  playerPosition.y = PLAYER.spawnY;
  const toTarget = targetHitPoint.subtract(
    playerPosition.add(new Vector3(0, 0.7, 0)),
  );
  const horizontalDistance = Math.hypot(toTarget.x, toTarget.z);
  const cameraRotation = startCameraRotation.clone();
  const targetPitch =
    Math.atan2(-toTarget.y, Math.max(0.001, horizontalDistance)) -
    getBayonetWeaponPitch(1, 1);
  cameraRotation.x = clamp(
    targetPitch,
    RIFLE.BAYONET.embedCameraMinPitch,
    RIFLE.BAYONET.embedCameraMaxPitch,
  );

  return { playerPosition, cameraRotation };
}

function getBayonetEmbedHitNormal(
  targetVisualRotation: Quaternion,
  torsoSide: BayonetTorsoSide,
): Vector3 {
  const localNormal =
    torsoSide === "front"
      ? new Vector3(0, 0, 1)
      : torsoSide === "back"
        ? new Vector3(0, 0, -1)
        : torsoSide === "left"
          ? new Vector3(-1, 0, 0)
          : new Vector3(1, 0, 0);
  const rotationMatrix = new Matrix();
  targetVisualRotation.toRotationMatrix(rotationMatrix);
  return Vector3.TransformNormal(localNormal, rotationMatrix).normalize();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function transformBayonetEmbedLocalPoint(
  rootPosition: Vector3,
  hitLocalPosition: Vector3,
  targetVisualRotation: Quaternion,
): Vector3 {
  return rootPosition.add(
    getBayonetEmbedLocalOffset(hitLocalPosition, targetVisualRotation),
  );
}

function getBayonetEmbedLocalOffset(
  hitLocalPosition: Vector3,
  targetVisualRotation: Quaternion,
): Vector3 {
  const matrix = Matrix.Compose(
    Vector3.One(),
    targetVisualRotation,
    Vector3.Zero(),
  );
  return Vector3.TransformCoordinates(hitLocalPosition, matrix);
}

function getBayonetEmbedVisualQuaternion(
  surfaceNormal: Vector3,
  direction: Vector3,
  torsoSide: BayonetTorsoSide,
): Quaternion {
  return getGroundPinnedRotation(direction, surfaceNormal, torsoSide);
}

function getGroundPinnedRotation(
  direction: Vector3,
  surfaceNormal: Vector3,
  torsoSide: BayonetTorsoSide,
): Quaternion {
  let yAxis = direction.clone();
  yAxis.y = 0;
  if (yAxis.lengthSquared() < 0.0001) yAxis = Vector3.Forward();
  yAxis.normalize();
  const up = surfaceNormal.normalizeToNew();
  const sideAxes = getGroundPinnedSideAxes(torsoSide, yAxis, up);

  const rotationMatrix = new Matrix();
  Matrix.FromXYZAxesToRef(
    sideAxes.xAxis,
    sideAxes.yAxis,
    sideAxes.zAxis,
    rotationMatrix,
  );
  return Quaternion.FromRotationMatrix(rotationMatrix);
}

function getGroundPinnedSideAxes(
  torsoSide: BayonetTorsoSide,
  headAxis: Vector3,
  upAxis: Vector3,
): { xAxis: Vector3; yAxis: Vector3; zAxis: Vector3 } {
  switch (torsoSide) {
    case "front": {
      const zAxis = upAxis;
      return {
        xAxis: Vector3.Cross(headAxis, zAxis).normalize(),
        yAxis: headAxis,
        zAxis,
      };
    }
    case "back": {
      const zAxis = upAxis.scale(-1);
      return {
        xAxis: Vector3.Cross(headAxis, zAxis).normalize(),
        yAxis: headAxis,
        zAxis,
      };
    }
    case "left": {
      const xAxis = upAxis.scale(-1);
      return {
        xAxis,
        yAxis: headAxis,
        zAxis: Vector3.Cross(xAxis, headAxis).normalize(),
      };
    }
    case "right": {
      const xAxis = upAxis;
      return {
        xAxis,
        yAxis: headAxis,
        zAxis: Vector3.Cross(xAxis, headAxis).normalize(),
      };
    }
  }
}

function calculateBayonetGroundOffset(
  enemy: Enemy,
  rootPosition: Vector3,
  targetVisualRotation: Quaternion,
  groundY: number,
): number {
  const bounds = calculateBayonetEmbedBounds(
    enemy,
    rootPosition,
    targetVisualRotation,
  );
  if (!bounds) return 0;
  return groundY - bounds.min.y;
}

function getBayonetEmbedCollision(
  enemy: Enemy,
  enemyPosition: Vector3,
  targetVisualRotation: Quaternion,
  playerPosition: Vector3,
): Exclude<BayonetEmbedResult, "embedded"> | null {
  const enemyBounds = calculateBayonetEmbedBounds(
    enemy,
    enemyPosition,
    targetVisualRotation,
  );
  if (!enemyBounds) return null;
  const playerBounds = calculatePlayerEmbedBounds(playerPosition);

  for (const other of g.enemies) {
    if (other === enemy) continue;
    if (
      aabbIntersectsMesh(enemyBounds, other.physMesh) ||
      aabbIntersectsMesh(playerBounds, other.physMesh)
    ) {
      return "blockedByEnemy";
    }
  }

  for (const mesh of g.scene.meshes) {
    if (!isBayonetEmbedBlockingWorldMesh(mesh)) continue;
    if (
      aabbIntersectsMesh(enemyBounds, mesh) ||
      aabbIntersectsMesh(playerBounds, mesh)
    ) {
      return "blockedByWorld";
    }
  }

  return null;
}

function calculatePlayerEmbedBounds(position: Vector3): Aabb {
  const matrix = Matrix.Translation(position.x, position.y, position.z);
  const box = g.playerMesh.getBoundingInfo().boundingBox;
  return calculateTransformedBounds(box.vectors, matrix);
}

function calculateBayonetEmbedBounds(
  enemy: Enemy,
  rootPosition: Vector3,
  targetVisualRotation: Quaternion,
): Aabb | null {
  const points: Vector3[] = [];
  const originalPosition = enemy.physMesh.position.clone();
  const originalVisualRotation = enemy.visualRoot.rotation.clone();
  const originalVisualRotationQuaternion =
    enemy.visualRoot.rotationQuaternion?.clone() ?? null;
  const originalLeftLegRotation = enemy.leftLeg.rotation.clone();
  const originalRightLegRotation = enemy.rightLeg.rotation.clone();
  const originalLeftArmRotation = enemy.leftArm.rotation.clone();
  const originalRightArmRotation = enemy.rightArm.rotation.clone();

  enemy.physMesh.position.copyFrom(rootPosition);
  enemy.visualRoot.rotationQuaternion = targetVisualRotation.clone();
  poseEmbeddedEnemy(enemy, 1);
  enemy.physMesh.computeWorldMatrix(true);
  enemy.visualRoot.computeWorldMatrix(true);

  for (const child of enemy.visualRoot.getChildMeshes(false)) {
    if (!(child instanceof Mesh) || child.getTotalVertices() <= 0) continue;
    child.computeWorldMatrix(true);
    const box = child.getBoundingInfo().boundingBox;
    points.push(box.minimumWorld.clone(), box.maximumWorld.clone());
  }

  enemy.physMesh.position.copyFrom(originalPosition);
  enemy.visualRoot.rotationQuaternion = originalVisualRotationQuaternion;
  enemy.visualRoot.rotation.copyFrom(originalVisualRotation);
  enemy.leftLeg.rotation.copyFrom(originalLeftLegRotation);
  enemy.rightLeg.rotation.copyFrom(originalRightLegRotation);
  enemy.leftArm.rotation.copyFrom(originalLeftArmRotation);
  enemy.rightArm.rotation.copyFrom(originalRightArmRotation);
  enemy.physMesh.computeWorldMatrix(true);
  enemy.visualRoot.computeWorldMatrix(true);

  if (points.length === 0) return null;
  return calculateBounds(points);
}

function calculateTransformedBounds(points: Vector3[], matrix: Matrix): Aabb {
  return calculateBounds(
    points.map((point) => Vector3.TransformCoordinates(point, matrix)),
  );
}

function calculateBounds(points: Vector3[]): Aabb {
  const min = points[0].clone();
  const max = points[0].clone();
  for (const point of points.slice(1)) {
    min.minimizeInPlace(point);
    max.maximizeInPlace(point);
  }
  return { min, max };
}

function aabbIntersectsMesh(bounds: Aabb, mesh: AbstractMesh): boolean {
  mesh.computeWorldMatrix(true);
  const box = mesh.getBoundingInfo().boundingBox;
  return aabbIntersects(bounds, {
    min: box.minimumWorld,
    max: box.maximumWorld,
  });
}

function aabbIntersects(a: Aabb, b: Aabb): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  );
}

function isBayonetEmbedBlockingWorldMesh(mesh: AbstractMesh): boolean {
  return (
    mesh.isEnabled() &&
    (mesh.name === "wall" ||
      mesh.name === "crate" ||
      mesh.name === "pillar" ||
      mesh.name === "ceil")
  );
}

function updateEmbeddedBayonet(dt: number): void {
  const embed = g.bayonetEmbed;
  if (embed) {
    embed.progress = Math.min(
      1,
      embed.progress + dt / RIFLE.BAYONET.embedAnimMs,
    );
  }

  if (!embed) return;
  if (!g.enemies.includes(embed.enemy)) {
    releaseBayonetEmbed();
    return;
  }
  g.bayonetChargeAnim = 1;

  const enemy = embed.enemy;
  const t = smoothstep(embed.progress);
  const enemyPos = Vector3.Lerp(embed.startPosition, embed.pinPosition, t);
  const playerPos = Vector3.Lerp(
    embed.startPlayerPosition,
    embed.playerPosition,
    t,
  );

  enemy.physMesh.position.copyFrom(enemyPos);
  enemy.aggregate.body.setTargetTransform(enemyPos, Quaternion.Identity());
  enemy.aggregate.body.setLinearVelocity(Vector3.Zero());
  enemy.aggregate.body.setAngularVelocity(Vector3.Zero());

  g.playerMesh.position.copyFrom(playerPos);
  g.playerAggregate.body.setTargetTransform(playerPos, Quaternion.Identity());
  g.playerAggregate.body.setLinearVelocity(Vector3.Zero());
  g.playerVelocityXZ = Vector3.Zero();
  g.camera.position.set(playerPos.x, playerPos.y + 0.76, playerPos.z);
  g.camera.rotation.x =
    embed.startCameraRotation.x +
    angleDelta(embed.startCameraRotation.x, embed.targetCameraRotation.x) * t;
  g.camera.rotation.y =
    embed.startCameraRotation.y +
    angleDelta(embed.startCameraRotation.y, embed.targetCameraRotation.y) * t;
  g.camera.rotation.z =
    embed.startCameraRotation.z +
    angleDelta(embed.startCameraRotation.z, embed.targetCameraRotation.z) * t;

  enemy.visualRoot.rotationQuaternion = Quaternion.Slerp(
    embed.startVisualRotation,
    embed.targetVisualRotation,
    t,
  );
  poseEmbeddedEnemy(enemy, t);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function angleDelta(from: number, to: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function getBayonetWeaponPitch(chargeT: number, embedT: number): number {
  return (
    RIFLE.BAYONET.chargePitch * chargeT - 0.03 * (1 - chargeT) - 0.28 * embedT
  );
}

function poseEmbeddedEnemy(enemy: Enemy, t: number): void {
  enemy.leftLeg.rotation.x = 0.18 * t;
  enemy.rightLeg.rotation.x = -0.14 * t;
  enemy.leftLeg.rotation.z = 0.22 * t;
  enemy.rightLeg.rotation.z = -0.22 * t;
  enemy.leftArm.rotation.x = -0.25 * t;
  enemy.rightArm.rotation.x = 0.2 * t;
  enemy.leftArm.rotation.z = 0.34 * t;
  enemy.rightArm.rotation.z = -0.34 * t;
}

// ─── Barrel-clip detection ───────────────────────────────────────────────────
function updateBarrelClip(dt: number): void {
  // Compute where the barrel tip would be in the untilted rest pose so the
  // detection result is stable regardless of the current tilt animation.
  const savedRot = g.weaponRoot.rotation.clone();
  const savedPos = g.weaponRoot.position.clone();
  g.weaponRoot.rotation.set(0, 0, 0);
  g.weaponRoot.position.copyFrom(g.weaponRestPosition);
  g.weaponRoot.computeWorldMatrix(true);
  g.barrelTip.computeWorldMatrix(true);
  const tipPos = g.barrelTip.getAbsolutePosition().clone();
  g.weaponRoot.rotation.copyFrom(savedRot);
  g.weaponRoot.position.copyFrom(savedPos);
  g.weaponRoot.computeWorldMatrix(true);
  g.barrelTip.computeWorldMatrix(true);

  const camPos = g.camera.globalPosition;
  const toTip = tipPos.subtract(camPos);
  const dist = toTip.length();
  const dir = dist > 0.0001 ? toTip.scale(1 / dist) : Vector3.Forward();
  const hit = g.scene.pickWithRay(new Ray(camPos, dir, dist));
  g.barrelClipping = !!(hit?.hit && hit.pickedPoint && hit.distance < dist);

  const dtSec = dt / 1000;
  const speed = PLAYER.BARREL_CLIP.lerpSpeed * dtSec;
  g.barrelClipT = g.barrelClipping
    ? Math.min(1, g.barrelClipT + speed)
    : Math.max(0, g.barrelClipT - speed);
}

function updateWeaponSwitchAnimation(dt: number): void {
  const target = g.weaponSwitchTarget;
  if (!target) return;

  g.weaponSwitchTime = Math.min(
    g.weaponSwitchTime + dt,
    g.weaponSwitchDuration,
  );
  const progress =
    g.weaponSwitchDuration > 0
      ? g.weaponSwitchTime / g.weaponSwitchDuration
      : 1;
  if (!g.weaponSwitchSwapped && progress >= 0.5) {
    equipWeapon(target);
    g.weaponSwitchSwapped = true;
    updateHUD();
  }

  const switchDir = target === "blaster" ? -1 : 1;
  // Lower and cant the current weapon out, swap at the hidden midpoint, then
  // reverse the same motion so switching feels like a single continuous beat.
  const phaseT =
    progress < 0.5
      ? smoothstep(progress / 0.5)
      : smoothstep((progress - 0.5) / 0.5);
  const hiddenT = progress < 0.5 ? phaseT : 1 - phaseT;

  g.weaponRoot.position.copyFrom(g.weaponRestPosition);
  g.weaponRoot.position.y += PLAYER.WEAPON_SWITCH.dropY * hiddenT;
  g.weaponRoot.position.z += PLAYER.WEAPON_SWITCH.pullBackZ * hiddenT;
  g.weaponRoot.rotation.x = PLAYER.WEAPON_SWITCH.pitch * hiddenT;
  g.weaponRoot.rotation.y = PLAYER.WEAPON_SWITCH.yaw * switchDir * hiddenT;
  g.weaponRoot.rotation.z = PLAYER.WEAPON_SWITCH.roll * switchDir * hiddenT;
  g.weaponCell.isVisible = true;
  if (g.state.activeWeapon === "rifle") {
    g.weaponCell.position.copyFrom(new Vector3(0, -0.11, 0.13));
  } else if (g.state.activeWeapon !== "shotgun") {
    g.weaponCell.position.y = 0.09;
  }

  if (progress >= 1) {
    g.weaponSwitchTarget = null;
    g.weaponSwitchTime = 0;
    g.weaponSwitchDuration = 0;
    g.weaponSwitchSwapped = false;
  }
}

// ─── Weapon animation ─────────────────────────────────────────────────────────
function updateWeapon(dt: number): void {
  if (!g.weaponRoot) return;
  g.weaponRoot.position.copyFrom(g.weaponRestPosition);
  if (g.weaponSwitchTarget !== null) {
    dom.crosshair.style.display = "none";
    updateWeaponSwitchAnimation(dt);
    return;
  }
  updateBarrelClip(dt);

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

  if (g.barrelClipT > 0 && g.state.meleeAnimTime <= 0 && !g.bayonetEmbed) {
    g.weaponRoot.rotation.x = PLAYER.BARREL_CLIP.tiltX * g.barrelClipT;
    dom.crosshair.style.display = "none";
    g.sprintBobTime = 0;
    return;
  }

  dom.crosshair.style.display = g.rifleScopeViewActive ? "none" : "";
  g.sprintBobTime = 0;

  if (g.state.activeWeapon === "rifle") {
    updateRifleWeapon();
    return;
  }

  if (g.state.activeWeapon === "shotgun") {
    updateShotgunWeapon();
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
  const embedT = g.bayonetEmbed ? smoothstep(g.bayonetEmbed.progress) : 0;
  // Bayonet charge recenters the rifle so the thrust reads straight ahead; the
  // embed blend then pushes it deeper to sell the spear-stuck follow-through.
  const chargePos = new Vector3(
    0,
    RIFLE.BAYONET.chargeCenteredY - 0.14 * embedT,
    RIFLE.BAYONET.chargeForwardZ + 0.22 * embedT,
  );
  g.weaponRoot.position.copyFrom(
    Vector3.Lerp(g.weaponRestPosition, chargePos, t),
  );
  g.weaponRoot.rotation.x = getBayonetWeaponPitch(t, embedT);
  g.weaponRoot.rotation.y = 0;
  g.weaponRoot.rotation.z = -0.04 * Math.sin(embedT * Math.PI);
  g.weaponCell.position.copyFrom(new Vector3(0, -0.11, 0.13));
}

function updateShotgunWeapon(): void {
  // Melee (butt-strike)
  if (g.state.meleeAnimTime > 0) {
    const t = 1 - g.state.meleeAnimTime / SHOTGUN.MELEE.animDurationMs;
    const swing = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
    g.weaponRoot.rotation.x = -0.7 * swing;
    g.weaponRoot.rotation.z = 0.25 * swing;
    g.weaponCell.isVisible = true;
    return;
  }

  // Pump animation
  if (g.state.pumpAnimTime > 0 && !g.state.reloading) {
    const progress = 1 - g.state.pumpAnimTime / SHOTGUN.PUMP_ANIM.durationMs;
    const pumpT =
      progress < 0.5
        ? smoothstep(progress / 0.5)
        : smoothstep(1 - (progress - 0.5) / 0.5);
    g.shotgunPump.position.z =
      g.shotgunPumpBasePosition.z + SHOTGUN.PUMP_ANIM.pullBackZ * pumpT;
    g.weaponRoot.position.z = g.weaponRestPosition.z - 0.02 * pumpT;
    g.weaponRoot.rotation.x = -g.recoilPitch - 0.03 * pumpT;
    g.weaponRoot.rotation.z = g.recoilRoll;
    return;
  }

  g.shotgunPump.position.z = g.shotgunPumpBasePosition.z;

  // Reload animation
  if (g.state.reloading) {
    const progress = 1 - g.state.reloadTimeLeft / effectiveReloadTime();
    const anim = SHOTGUN.RELOAD_ANIM;
    let tilt = 0;
    let yaw = 0;
    if (progress < 0.2) {
      tilt = anim.tilt * smoothstep(progress / 0.2);
      yaw = anim.yaw * smoothstep(progress / 0.2);
    } else if (progress < 0.8) {
      tilt = anim.tilt;
      yaw = anim.yaw;
    } else {
      const t = smoothstep(1 - (progress - 0.8) / 0.2);
      tilt = anim.tilt * t;
      yaw = anim.yaw * t;
    }
    g.weaponRoot.rotation.x = tilt - g.recoilPitch;
    g.weaponRoot.rotation.y = yaw;
    g.weaponRoot.rotation.z = g.recoilRoll;
    g.weaponCell.isVisible = progress < 0.35 || progress > 0.65;
    return;
  }

  // Idle
  g.weaponRoot.rotation.x = -g.recoilPitch;
  g.weaponRoot.rotation.y = 0;
  g.weaponRoot.rotation.z = g.recoilRoll;
  g.weaponCell.isVisible = true;
}

function updateRifleWeapon(): void {
  const mag = g.weaponCell;
  const exitZoomPhase =
    !g.rifleScoped && g.rifleScopeZoomT > RIFLE_SCOPE_EXIT_RELEASE_T;
  // First align the rifle assembly itself with the optic so the later root
  // translation can move a centered rifle instead of dragging in an angled one.
  const scopeAlignT = smoothstep(exitZoomPhase ? 1 : g.rifleScopeAimT);
  g.rifleAssembly.position.copyFrom(g.rifleAssemblyBasePosition);
  g.rifleAssembly.position.x *= 1 - scopeAlignT;
  g.rifleAssembly.rotation.x = g.rifleAssemblyBasePitch * (1 - scopeAlignT);
  g.rifleAssembly.rotation.y = g.rifleAssemblyBaseYaw * (1 - scopeAlignT);
  g.rifleAssembly.rotation.z = 0;

  if (g.state.meleeAnimTime > 0) {
    const t = 1 - g.state.meleeAnimTime / RIFLE.MELEE.animDurationMs;
    if (g.upgrades.bayonet) {
      // Bayonet melee is a forward stab, so keep the rifle mostly level and
      // emphasize reach instead of the wider buttstock swing used without it.
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
    if (g.rifleScoped) {
      // Scope-in happens in two parts: move into the centered aim pose first,
      // then translate deeper as the optical zoom and overlay ramp up.
      const centerT = smoothstep(
        Math.min(1, g.rifleScopeAimT / RIFLE.SCOPE.inwardPullStart),
      );
      const inwardT = smoothstep(
        Math.max(
          0,
          (g.rifleScopeAimT - RIFLE.SCOPE.inwardPullStart) /
            (1 - RIFLE.SCOPE.inwardPullStart),
        ),
      );
      const aimZ =
        RIFLE.SCOPE.aimRootZ +
        (RIFLE.SCOPE.inwardRootZ - RIFLE.SCOPE.aimRootZ) * inwardT;
      const zoomedAimZ =
        aimZ + (RIFLE.SCOPE.zoomRootZ - aimZ) * smoothstep(g.rifleScopeZoomT);
      const aimPos = new Vector3(
        RIFLE.SCOPE.aimRootX,
        RIFLE.SCOPE.aimRootY,
        zoomedAimZ,
      );
      g.weaponRoot.position.copyFrom(
        Vector3.Lerp(g.weaponRestPosition, aimPos, centerT),
      );
      g.weaponRoot.rotation.x = -0.08 * (1 - centerT) - g.recoilPitch;
    } else if (exitZoomPhase) {
      // Scope-out mirrors that structure: the overlay disappears while the
      // rifle stays centered, then the second phase returns to the rest pose.
      const exitT = smoothstep(g.rifleScopeZoomT);
      const exitZ =
        RIFLE.SCOPE.aimRootZ +
        (RIFLE.SCOPE.zoomRootZ - RIFLE.SCOPE.aimRootZ) * exitT;
      g.weaponRoot.position.set(
        RIFLE.SCOPE.aimRootX,
        RIFLE.SCOPE.aimRootY,
        exitZ,
      );
      g.weaponRoot.rotation.x = -g.recoilPitch;
    } else {
      const centerT = smoothstep(
        Math.min(1, g.rifleScopeAimT / RIFLE.SCOPE.inwardPullStart),
      );
      const aimPos = new Vector3(
        RIFLE.SCOPE.aimRootX,
        RIFLE.SCOPE.aimRootY,
        RIFLE.SCOPE.aimRootZ,
      );
      g.weaponRoot.position.copyFrom(
        Vector3.Lerp(g.weaponRestPosition, aimPos, centerT),
      );
      g.weaponRoot.rotation.x = -0.08 * (1 - centerT) - g.recoilPitch;
    }
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

  // Rifle reload is staged to expose the mag well clearly: cant the weapon,
  // hold that presentation during the mag swap, then ease back to firing pose.
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
    if (g.bayonetEmbed?.enemy === e) {
      e.aggregate.body.setLinearVelocity(Vector3.Zero());
      e.aggregate.body.setAngularVelocity(Vector3.Zero());
      continue;
    }
    const pos = e.physMesh.position;
    const toPlayer = camPos.subtract(pos);
    const dist = toPlayer.length();
    const toPlayerXZ = new Vector3(toPlayer.x, 0, toPlayer.z);
    const dtSec = g.engine.getDeltaTime() / 1000;
    const turnSpeed = ENEMY.turnSpeed;
    let meleeTargetDir: Vector3 | null = null;

    if (dist < ENEMY.chaseRange) e.state = "chase";

    const currentVel = e.aggregate.body.getLinearVelocity();
    let targetYaw = e.facingYaw;
    let moveSpeed = e.speed;

    if (e.state === "chase") {
      const dirXZ = toPlayerXZ.clone();
      if (dirXZ.lengthSquared() > 0) dirXZ.normalize();
      if (dirXZ.lengthSquared() > 0) meleeTargetDir = dirXZ.clone();

      // Zigzag lateral offset
      e.zigzagTimer += dtSec * ENEMY.zigzagFreq * Math.PI * 2;
      const lateral = new Vector3(-dirXZ.z, 0, dirXZ.x);
      const zigzag = Math.sin(e.zigzagTimer) * ENEMY.zigzagAmplitude;
      const moveDir = dirXZ.add(lateral.scale(zigzag)).normalize();

      targetYaw = Math.atan2(moveDir.x, moveDir.z);
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

    if (
      e.state === "chase" &&
      dist < ENEMY.meleeRange &&
      meleeTargetDir &&
      Vector3.Dot(fwd, meleeTargetDir) >= ENEMY.meleeFacingDot
    ) {
      e.attackCooldown -= g.engine.getDeltaTime();
      if (e.attackCooldown <= 0) {
        playEnemyAttackSound(pos.clone());
        damagePlayer(e.meleeDamage);
        e.attackCooldown = e.meleeIntervalMs;
        e.attackAnimTime = 300;
      }
    }

    // Elite ranged attack — fire orb when in range but outside melee
    if (e.isElite && e.state === "chase") {
      e.orbCooldown = Math.max(0, e.orbCooldown - g.engine.getDeltaTime());
      if (
        e.orbCooldown <= 0 &&
        dist >= ELITE.orbMinRange &&
        dist <= ELITE.orbMaxRange
      ) {
        const orbDir = toPlayer.normalizeToNew();
        const orbSpawnPos = pos.add(orbDir.scale(1.0));
        orbSpawnPos.y += 0.5;
        spawnEnemyOrb(orbSpawnPos, orbDir);
        playEnemyOrbFireSound(pos.clone());
        e.orbCooldown = ELITE.orbCooldownMs;
      }
    }

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

function updateEnemyOrbs(dt: number): void {
  const dtSec = dt / 1000;
  const playerPos = g.camera.position;

  for (let i = g.enemyOrbs.length - 1; i >= 0; i--) {
    const orb = g.enemyOrbs[i];
    orb.age += dt;

    const step = orb.velocity.scale(dtSec);
    orb.mesh.position.addInPlace(step);

    const dist = Vector3.Distance(orb.mesh.position, playerPos);
    if (dist < ELITE.orbRadius + 0.5) {
      damagePlayer(orb.damage);
      playEnemyOrbHitSound(orb.mesh.position.clone());
      orb.mesh.dispose();
      g.enemyOrbs.splice(i, 1);
      continue;
    }

    const dir = orb.velocity.normalizeToNew();
    const ray = new Ray(
      orb.mesh.position,
      dir,
      step.length() + ELITE.orbRadius,
    );
    const hit = g.scene.pickWithRay(
      ray,
      (m) =>
        !m.name.startsWith("enemyOrb") &&
        !m.name.startsWith("enemy") &&
        !m.name.startsWith("hpBar") &&
        m !== g.playerMesh,
    );
    if (hit?.hit && hit.distance < step.length() + ELITE.orbRadius) {
      orb.mesh.dispose();
      g.enemyOrbs.splice(i, 1);
      continue;
    }

    if (orb.age >= ELITE.orbLifetimeMs) {
      orb.mesh.dispose();
      g.enemyOrbs.splice(i, 1);
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
    for (const orb of g.enemyOrbs) orb.mesh.dispose();
    g.enemyOrbs = [];

    g.state.waveActive = false;
    g.state.wavePauseTimer = WAVE.pauseMs;
    showWaveBanner(`Wave ${g.state.wave} Complete`);

    // Reward: spawn supplies in front of player + score bonus
    const fwd = g.camera.getForwardRay(3).direction;
    const right = g.camera.getDirection(Vector3.Right()).normalize();
    const frontPos = g.camera.position.add(fwd.scale(3));
    frontPos.y = 0.5;
    spawnSupply(frontPos.clone(), "health");
    spawnSupply(frontPos.add(right.scale(0.7)), "ammo");
    if (g.upgrades.rifleUnlock) {
      spawnSupply(frontPos.add(right.scale(-0.7)), "rifleAmmo");
    }
    if (g.upgrades.shotgunUnlock) {
      spawnSupply(frontPos.add(right.scale(-1.4)), "shotgunAmmo");
    }
    incrementScore(SCORING.waveComplete, frontPos);
    showUpgradeMenu();
  }
}

export function showWaveBanner(text: string): void {
  dom.waveBanner.textContent = text;
  dom.waveBanner.classList.add("visible");
  setTimeout(() => dom.waveBanner.classList.remove("visible"), 2500);
}
