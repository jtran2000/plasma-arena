import {
  Vector3,
  StandardMaterial,
  Color3,
  Color4,
  Mesh,
  AbstractMesh,
  Ray,
  PickingInfo,
} from "@babylonjs/core";
import { ARENA, PLAYER, BLASTER, RIFLE, SCORING } from "./constants.js";
const { HEAT, PLASMA, SPREAD, MULTISHOT, RICOCHET, LIGHTNING, MELEE } = BLASTER;
import {
  g,
  dom,
  cacheActiveWeaponAmmo,
  canSpendStamina,
  equipWeapon,
  releaseBayonetEmbed,
  spendStamina,
  type Enemy,
  type Plasma,
} from "./game.js";
import {
  makeRifleTracerMesh,
  makePlasmaChargeMesh,
  createPlasmaProjectileMesh,
  spawnPlasma,
  spawnPlasmaWithVelocity,
  spawnRifleMuzzleFlash,
  spawnLightningBolt,
  spawnExplosionParticle,
  spawnHitParticle,
  spawnBayonetGash,
  spawnBayonetBloodDrip,
  spawnBayonetBloodBurst,
  spawnSmokeParticles,
  spawnLaserBeam,
  spawnBulletHole,
  spawnFireEffect,
  spawnDamageNumber,
  updateEnemyHealthBar,
  killEnemy,
  splitRagdoll,
  hitDebris,
} from "./spawn.js";
import {
  playReloadSounds,
  playRifleReloadSounds,
  playOverheatSound,
  playPlasmaLaunchSound,
  playPlasmaExplosionSound,
  startPlasmaChargeSound,
  updatePlasmaChargeSound,
  stopPlasmaChargeSound,
  playLightningSound,
  playMeleeSound,
  playRifleShotSound,
} from "./audio.js";
import {
  effectiveCooldown,
  effectiveHeatMax,
  effectiveBloom,
  effectiveRifleSpreadScale,
  effectiveLaserDamage,
  effectivePlasmaDamage,
  effectivePlasmaSpeed,
  effectiveJumpStaminaCost,
  effectiveReloadTime,
  effectiveMagSize,
  effectiveCritChance,
  effectiveCritDamage,
  effectivePlasmaSelfDamage,
  effectiveMultishotChance,
  effectiveRicochetChance,
  effectiveLightningChance,
  effectiveIgniteChance,
  updateHUD,
  incrementScore,
} from "./progression.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function tryIgnite(enemy: Enemy): void {
  if (enemy.onFire) return;
  if (Math.random() < effectiveIgniteChance()) {
    enemy.onFire = true;
    spawnFireEffect(enemy);
  }
}

export function damageEnemy(
  enemy: Enemy,
  amount: number,
  killMesh: Mesh,
  hitPoint: Vector3,
  isCrit: boolean,
  opts?: {
    plasmaKill?: boolean;
    intactKill?: boolean;
    canLightning?: boolean;
    canIgnite?: boolean;
    showNumber?: boolean;
    scoreOverride?: number;
  },
): boolean {
  enemy.hp -= amount;
  if (opts?.showNumber !== false) spawnDamageNumber(hitPoint, amount, isCrit);
  updateEnemyHealthBar(enemy);
  if (enemy.hp <= 0) {
    killEnemy(
      enemy,
      killMesh,
      hitPoint,
      opts?.plasmaKill,
      opts?.intactKill,
      opts?.scoreOverride,
    );
    return true;
  }
  const critMult = isCrit ? effectiveCritDamage() : 1;
  if (opts?.canLightning && Math.random() < effectiveLightningChance()) {
    triggerLightning(enemy, critMult);
  }
  if (opts?.canIgnite) tryIgnite(enemy);
  return false;
}

export function isEnemyPart(name: string): boolean {
  return (
    name === "enemyBody" ||
    name === "enemyHead" ||
    name === "enemyLeg" ||
    name === "enemyArm"
  );
}

export function findEnemyByMesh(
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

export function isRaycastPickable(mesh: AbstractMesh): boolean {
  return mesh.isPickable && mesh.isVisible && mesh.isEnabled();
}

function cancelReloadAndCharge(): void {
  g.state.reloading = false;
  g.state.reloadTimeLeft = 0;
  g.state.autoReloadDelay = 0;
  dom.reloadMsg.classList.remove("visible");
  if (g.plasmaCharging) {
    stopPlasmaChargeSound();
    if (g.plasmaChargeMesh) {
      g.plasmaChargeMesh.dispose();
      g.plasmaChargeMesh = null;
    }
    g.plasmaCharging = false;
    g.plasmaChargeCrit = false;
  }
}

function currentMeleeStats() {
  if (g.state.activeWeapon !== "rifle") return MELEE;
  return {
    ...RIFLE.MELEE,
    damage: g.upgrades.bayonet
      ? RIFLE.MELEE.damage * RIFLE.BAYONET.damageMultiplier
      : RIFLE.MELEE.damage,
    range: g.upgrades.bayonet ? RIFLE.BAYONET.range : RIFLE.MELEE.range,
  };
}

function currentRifleRecoilStats() {
  const brakeScale = g.upgrades.muzzleBrake
    ? RIFLE.MUZZLE_BRAKE.recoilScale
    : 1;
  const scale = brakeScale * (g.rifleScoped ? RIFLE.RECOIL.scopedScale : 1);
  const cameraRatio = g.rifleScopeViewActive ? 1 : RIFLE.RECOIL.cameraRatio;
  return {
    pitch: RIFLE.RECOIL.pitch * scale,
    recover: RIFLE.RECOIL.recover,
    maxPitch: RIFLE.RECOIL.maxPitch * scale,
    cameraRatio,
    weaponRoll: g.rifleScopeViewActive
      ? 0
      : RIFLE.RECOIL.weaponRoll * brakeScale,
  };
}

export function switchWeapon(): void {
  if (
    !g.upgrades.rifleUnlock ||
    !g.state.running ||
    g.state.paused ||
    g.isSprinting ||
    g.state.meleeCooldown > 0
  )
    return;
  releaseBayonetEmbed();
  cancelReloadAndCharge();
  if (g.bayonetCharging || g.bayonetChargeCooldownPending) {
    g.state.meleeCooldown = Math.max(
      g.state.meleeCooldown,
      RIFLE.MELEE.cooldownMs * RIFLE.BAYONET.chargeCooldownMultiplier,
    );
  }
  g.mouseHeld = false;
  g.mouse2Held = false;
  g.rifleScoped = false;
  g.rifleScopeViewActive = false;
  g.rifleScopeRecoilKicked = false;
  g.rifleScopeAimT = 0;
  g.rifleScopeZoomT = 0;
  g.meleeHeld = false;
  g.bayonetCharging = false;
  g.bayonetChargeLockedUntilSprintEnd = false;
  g.bayonetChargeCooldownPending = false;
  g.shootSpread = 0;
  g.moveSpread = 0;
  g.recoilPitch = 0;
  g.rifleLaserDot?.setEnabled(false);
  g.recoilRoll = 0;
  g.cameraRecoilPitch = 0;
  g.appliedCameraRecoilPitch = 0;
  g.rifleBloomRecoilHoldTimer = 0;
  g.crosshairRecoil = 0;
  g.state.shootCooldown = 0;
  g.state.plasmaCooldown = 0;
  const next = g.state.activeWeapon === "blaster" ? "rifle" : "blaster";
  equipWeapon(next);
  updateHUD();
}

// ─── Jump ────────────────────────────────────────────────────────────────────
export function tryJump(): void {
  if (!g.state.running || g.state.paused) return;

  const vel = g.playerAggregate.body.getLinearVelocity();
  if (Math.abs(vel.y) > 2) return;

  const groundRay = new Ray(g.playerMesh.position, new Vector3(0, -1, 0), 1.05);
  const hit = g.scene.pickWithRay(groundRay);
  if (!hit?.hit) return;

  const jumpCost = effectiveJumpStaminaCost();
  if (!canSpendStamina(jumpCost)) return;
  spendStamina(jumpCost);
  g.state.staminaRegenDelay = 0;
  g.state.staminaRegenBlockedByJump = true;

  g.playerAggregate.body.setLinearVelocity(
    new Vector3(g.playerVelocityXZ.x, PLAYER.jumpSpeed, g.playerVelocityXZ.z),
  );
}

// ─── Melee attack ───────────────────────────────────────────────────────────
export function meleeAttack(): void {
  if (
    !g.state.running ||
    g.state.paused ||
    g.isSprinting ||
    g.state.meleeCooldown > 0 ||
    g.pendingUpgrades.length > 0
  )
    return;

  const melee = currentMeleeStats();
  if (!canSpendStamina(PLAYER.STAMINA.meleeCost)) return;
  spendStamina(PLAYER.STAMINA.meleeCost);
  g.state.meleeCooldown = melee.cooldownMs;
  g.state.meleeAnimTime = melee.animDurationMs;

  const pos = g.barrelTip.getAbsolutePosition();
  playMeleeSound(pos);

  const ray = g.camera.getForwardRay(melee.range);
  const hit = g.scene.pickWithRay(ray);

  if (!hit?.hit || !hit.pickedMesh) return;

  if (isEnemyPart(hit.pickedMesh.name)) {
    const result = findEnemyByMesh(hit.pickedMesh);
    if (result) {
      const headshot = result.hitMesh.name === "enemyHead";
      const dmg = Math.round(melee.damage * (headshot ? 2 : 1));
      const hitPoint =
        hit.pickedPoint ?? result.enemy.bodyMesh.getAbsolutePosition();
      (result.hitMesh.material as StandardMaterial).emissiveColor = new Color3(
        1,
        0,
        0,
      );
      result.enemy.flashMesh = result.hitMesh;
      result.enemy.flashTime = 200;

      // Knockback
      const away = result.enemy.bodyMesh
        .getAbsolutePosition()
        .subtract(g.camera.position);
      if (away.lengthSquared() > 0.01) {
        result.enemy.aggregate.body.applyImpulse(
          away.normalize().scale(30),
          result.enemy.bodyMesh.getAbsolutePosition(),
        );
      }

      if (g.state.activeWeapon === "rifle" && g.upgrades.bayonet) {
        spawnBayonetGash(hitPoint, hit.getNormal(true), result.hitMesh);
        spawnBayonetBloodDrip(hitPoint);
      }
      damageEnemy(result.enemy, dmg, result.hitMesh, hitPoint, false, {
        canIgnite: true,
        intactKill: true,
        scoreOverride: SCORING.specialKill,
      });
      spawnHitParticle(
        hitPoint,
        new Color4(0.8, 0.0, 0.0, 1),
        hit.getNormal(true) ?? ray.direction.negate(),
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
    if (
      g.state.activeWeapon === "rifle" &&
      g.upgrades.bayonet &&
      hit.pickedPoint
    ) {
      spawnBayonetBloodDrip(hit.pickedPoint);
    }
  }
}

// ─── Laser shooting ─────────────────────────────────────────────────────────
export function shoot(): void {
  if (g.barrelClipping && !g.bayonetEmbed) return;
  if (g.state.activeWeapon === "rifle") {
    shootRifle();
    return;
  }
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
    fireLaserRay(new Ray(ray.origin, dir, 100), isCrit);
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

function aimProjectileFromMuzzle(
  aimRay: Ray,
  spawnPos: Vector3,
  barrelDir: Vector3,
): Vector3 {
  const aimHit = g.scene.pickWithRay(aimRay);
  const aimPoint =
    aimHit?.hit && aimHit.pickedPoint
      ? aimHit.pickedPoint
      : aimRay.origin.add(aimRay.direction.scale(100));
  const dir = aimPoint.subtract(spawnPos);
  if (dir.lengthSquared() < 0.0001) return barrelDir.normalizeToNew();
  return dir.normalize();
}

function getBarrelTipSpawnTransform(): {
  spawnPos: Vector3;
  barrelDir: Vector3;
} {
  g.weaponRoot.computeWorldMatrix(true);
  g.barrelTip.computeWorldMatrix(true);
  return {
    spawnPos: g.barrelTip.getAbsolutePosition().clone(),
    barrelDir: g.barrelTip.getDirection(Vector3.Forward()).normalize(),
  };
}

function bayonetPinRayFilter(m: AbstractMesh): boolean {
  return isRaycastPickable(m) && !isEnemyPart(m.name) && m.name !== "plasma";
}

export function findBayonetPinPosition(
  hitPoint: Vector3,
  direction: Vector3,
): {
  position: Vector3;
  hitPoint: Vector3;
  normal: Vector3;
} {
  const groundProbe = hitPoint.add(
    direction.scale(RIFLE.BAYONET.embedGroundKnockbackDistance),
  );
  const groundHit = g.scene.pickWithRay(
    new Ray(groundProbe.add(new Vector3(0, 2, 0)), new Vector3(0, -1, 0), 6),
    bayonetPinRayFilter,
  );
  const groundHitPoint = groundProbe.clone();
  groundHitPoint.y = groundHit?.pickedPoint?.y ?? 0;
  return {
    position: groundHitPoint.clone(),
    hitPoint: groundHitPoint,
    normal: groundHit?.getNormal(true)?.normalizeToNew() ?? Vector3.Up(),
  };
}

function plasmaRayFilter(m: AbstractMesh): boolean {
  return isRaycastPickable(m) && m.name !== "plasma";
}

function shootRifle(): void {
  if (
    !g.upgrades.rifleUnlock ||
    !g.state.running ||
    g.state.reloading ||
    g.isSprinting ||
    g.pendingUpgrades.length > 0
  )
    return;
  if (g.state.shootCooldown > 0) return;
  if (g.state.ammo <= 0) {
    startReload();
    return;
  }

  g.state.ammo--;
  g.state.shootCooldown = effectiveCooldown();

  const scoped = g.rifleScoped && g.upgrades.rifleScope;
  const rifleSpreadScale = effectiveRifleSpreadScale();
  const spread = scoped
    ? 0
    : (RIFLE.SPREAD.base +
        Math.min(g.shootSpread, RIFLE.SPREAD.max) +
        g.moveSpread) *
      rifleSpreadScale;
  const aimRay = g.camera.getForwardRay(100);
  if (!scoped && g.recoilPitch > 0) {
    const cameraUp = g.camera.getDirection(Vector3.Up()).normalize();
    aimRay.direction
      .addInPlace(cameraUp.scale(Math.tan(g.recoilPitch)))
      .normalize();
  }
  if (spread > 0)
    aimRay.direction.copyFrom(addRandomSpread(aimRay.direction, spread));
  if (scoped) {
    g.shootSpread = 0;
    g.moveSpread = 0;
  } else {
    g.shootSpread = Math.min(
      g.shootSpread + effectiveBloom(),
      RIFLE.SPREAD.max,
    );
  }

  const isCrit = Math.random() < effectiveCritChance();
  const critMult = isCrit ? effectiveCritDamage() : 1;
  const damage = Math.round(
    RIFLE.damage * (0.9 + Math.random() * 0.2) * critMult,
  );
  if (g.bayonetEmbed) {
    shootPinnedEnemy(damage, isCrit, aimRay.direction);
  } else {
    const { spawnPos, barrelDir } = getBarrelTipSpawnTransform();
    const bulletDir = aimProjectileFromMuzzle(aimRay, spawnPos, barrelDir);
    const tracer = makeRifleTracerMesh(spawnPos, bulletDir, isCrit);
    g.rifleBullets.push({
      mesh: tracer,
      velocity: bulletDir.scale(RIFLE.bulletSpeed),
      age: 0,
      damage,
      isCrit,
    });
  }
  playRifleShotSound();
  spawnRifleMuzzleFlash(isCrit);
  applyRifleRecoil();

  if (g.state.ammo === 0 && g.state.reserve > 0) g.state.autoReloadDelay = 200;
  updateHUD();
}

function applyRifleRecoil(): void {
  const recoil = currentRifleRecoilStats();
  g.recoilRoll = Math.max(
    -0.2,
    Math.min(0.2, g.recoilRoll + (Math.random() - 0.5) * recoil.weaponRoll),
  );
  g.cameraRecoilPitch = Math.min(
    g.cameraRecoilPitch + recoil.pitch,
    recoil.maxPitch,
  );
  if (
    g.rifleScopeViewActive &&
    g.cameraRecoilPitch >= RIFLE.SCOPE.recoilExitPitch
  ) {
    g.rifleScopeViewActive = false;
    g.rifleScopeRecoilKicked = true;
  }
  const settleMagnitude =
    Math.random() *
    Math.min(
      RIFLE.RECOIL.settleMax,
      g.cameraRecoilPitch * RIFLE.RECOIL.settleScale,
    );
  const settleDirection = Math.random() * Math.PI * 2;
  g.camera.rotation.x -= Math.sin(settleDirection) * settleMagnitude;
  g.camera.rotation.y += Math.cos(settleDirection) * settleMagnitude;
  g.rifleBloomRecoilHoldTimer = RIFLE.RECOIL.decayHoldMs;
  const cameraRecoilPitch = g.cameraRecoilPitch * recoil.cameraRatio;
  if (g.rifleScopeViewActive) {
    const recoilDelta = cameraRecoilPitch - g.appliedCameraRecoilPitch;
    if (recoilDelta !== 0) {
      g.camera.rotation.x -= recoilDelta;
      g.appliedCameraRecoilPitch = cameraRecoilPitch;
    }
  }
  g.recoilPitch = g.cameraRecoilPitch * (1 - recoil.cameraRatio);
}

function shootPinnedEnemy(
  damage: number,
  isCrit: boolean,
  shotDirection: Vector3,
): void {
  const embed = g.bayonetEmbed;
  if (!embed || !g.enemies.includes(embed.enemy)) return;

  const enemy = embed.enemy;
  const point = embed.targetHitPoint.clone();
  const normal =
    shotDirection.lengthSquared() > 0.0001
      ? shotDirection.normalizeToNew().negate()
      : embed.direction.negate();

  (enemy.bodyMesh.material as StandardMaterial).emissiveColor = new Color3(
    1,
    0,
    0,
  );
  enemy.flashMesh = enemy.bodyMesh;
  enemy.flashTime = 120;
  spawnRifleBulletHole(point, normal, enemy.bodyMesh, true);
  spawnHitParticle(point, new Color4(0.9, 0.0, 0.0, 1), normal);
  spawnBayonetBloodBurst(point);
  spawnBayonetBloodBurst(point.add(new Vector3(0.05, 0.03, 0)));
  spawnBayonetBloodBurst(point.add(new Vector3(-0.05, -0.02, 0.02)));
  damageEnemy(
    enemy,
    Math.round(damage * RIFLE.BAYONET.damageMultiplier),
    enemy.bodyMesh,
    point,
    isCrit,
    { intactKill: true, scoreOverride: SCORING.specialKill },
  );
}

const RIFLE_GEOMETRY_BULLET_HOLE = new Color3(0.35, 0.35, 0.35);
const RIFLE_FLESH_BULLET_HOLE = new Color3(0.24, 0, 0);

function spawnRifleBulletHole(
  position: Vector3,
  normal: Vector3 | null,
  parentMesh?: Mesh,
  flesh = false,
): void {
  spawnBulletHole(position, normal, parentMesh, {
    color: flesh ? RIFLE_FLESH_BULLET_HOLE : RIFLE_GEOMETRY_BULLET_HOLE,
    glow: false,
  });
}

function spawnDeadEnemyBulletHole(
  position: Vector3,
  normal: Vector3 | null,
  parentMesh: Mesh,
): void {
  spawnBulletHole(position, normal, parentMesh);
}

function spawnRifleDeadEnemyBulletHole(
  position: Vector3,
  normal: Vector3 | null,
  parentMesh: Mesh,
): void {
  spawnBulletHole(position, normal, parentMesh, {
    color: RIFLE_FLESH_BULLET_HOLE,
    glow: false,
  });
}

function pickSplitImpactMesh(impactPoint: Vector3, meshes: [Mesh, Mesh]): Mesh {
  const [topHalf, bottomHalf] = meshes;
  return impactPoint.y >= (topHalf.position.y + bottomHalf.position.y) / 2
    ? topHalf
    : bottomHalf;
}

function markSplitDeadEnemyHit(
  hitMesh: Mesh,
  direction: Vector3,
  impactPoint?: Vector3,
  normal?: Vector3 | null,
  spawnMark: (
    position: Vector3,
    hitNormal: Vector3 | null,
    parentMesh: Mesh,
  ) => void = spawnDeadEnemyBulletHole,
): void {
  const corpseHalves = splitRagdoll(hitMesh, direction, impactPoint);
  if (!impactPoint) return;
  spawnMark(
    impactPoint,
    normal ?? null,
    pickSplitImpactMesh(impactPoint, corpseHalves),
  );
}

function handleRifleHit(
  hit: PickingInfo | null,
  dir: Vector3,
  damage: number,
  isCrit: boolean,
): boolean {
  if (!hit?.hit || !hit.pickedMesh || !hit.pickedPoint) return false;

  const point = hit.pickedPoint;
  if (isEnemyPart(hit.pickedMesh.name)) {
    const result = findEnemyByMesh(hit.pickedMesh);
    if (result) {
      const headshot = result.hitMesh.name === "enemyHead";
      const bayonetDamageScale =
        g.bayonetEmbed?.enemy === result.enemy
          ? RIFLE.BAYONET.damageMultiplier
          : 1;
      const hitDamage = Math.round(
        damage * (headshot ? 2 : 1) * bayonetDamageScale,
      );
      (result.hitMesh.material as StandardMaterial).emissiveColor = new Color3(
        1,
        0,
        0,
      );
      result.enemy.flashMesh = result.hitMesh;
      result.enemy.flashTime = 120;
      spawnRifleBulletHole(
        point,
        hit.getNormal(true),
        hit.pickedMesh as Mesh,
        true,
      );
      const killed = damageEnemy(
        result.enemy,
        hitDamage,
        result.hitMesh,
        point,
        isCrit,
        { intactKill: true },
      );
      if (killed && g.bayonetEmbed?.enemy === result.enemy) {
        releaseBayonetEmbed();
      }
      spawnHitParticle(
        point,
        new Color4(0.8, 0.0, 0.0, 1),
        hit.getNormal(true) ?? dir.negate(),
      );
    } else {
      markSplitDeadEnemyHit(
        hit.pickedMesh as Mesh,
        dir,
        point,
        hit.getNormal(true),
        spawnRifleDeadEnemyBulletHole,
      );
    }
  } else if (
    hit.pickedMesh.name === "bodyHalf" ||
    hit.pickedMesh.name === "headHalf" ||
    hit.pickedMesh.name === "armHalf" ||
    hit.pickedMesh.name === "legHalf"
  ) {
    spawnRifleBulletHole(
      point,
      hit.getNormal(true),
      hit.pickedMesh as Mesh,
      true,
    );
    hitDebris(hit.pickedMesh as Mesh, dir, point);
    spawnHitParticle(
      point,
      new Color4(0.8, 0.0, 0.0, 1),
      hit.getNormal(true) ?? dir.negate(),
    );
  } else if (hit.pickedMesh.name === "plasma") {
    const plasmaIdx = g.plasmas.findIndex((o) => o.mesh === hit.pickedMesh);
    if (plasmaIdx !== -1) {
      const plasma = g.plasmas[plasmaIdx];
      detonatePlasma(plasma, point, isCrit);
      g.plasmas.splice(plasmaIdx, 1);
    }
  } else {
    spawnRifleBulletHole(point, hit.getNormal(true), hit.pickedMesh as Mesh);
  }

  return true;
}

export function updateRifleBullets(dt: number): void {
  const dtSec = dt / 1000;
  for (let i = g.rifleBullets.length - 1; i >= 0; i--) {
    const bullet = g.rifleBullets[i];
    bullet.age += dt;
    const prevPos = bullet.mesh.position.clone();
    bullet.velocity.y -= RIFLE.gravity * dtSec;
    const step = bullet.velocity.scale(dtSec);
    const nextPos = prevPos.add(step);
    const dir =
      step.lengthSquared() > 0.0001 ? step.normalizeToNew() : Vector3.Forward();
    const hit = g.scene.pickWithRay(new Ray(prevPos, dir, step.length()));

    if (handleRifleHit(hit, dir, bullet.damage, bullet.isCrit)) {
      bullet.mesh.dispose();
      g.rifleBullets.splice(i, 1);
      continue;
    }

    bullet.mesh.position.copyFrom(nextPos);
    bullet.mesh.lookAt(nextPos.add(dir));
    if (bullet.age >= RIFLE.tracerLifeMs) {
      bullet.mesh.dispose();
      g.rifleBullets.splice(i, 1);
    }
  }
}

function reflectWithSpread(dir: Vector3, normal: Vector3): Vector3 {
  const dot = Vector3.Dot(dir, normal);
  const reflected = dir.subtract(normal.scale(2 * dot)).normalize();
  return addRandomSpread(reflected, RICOCHET.spread);
}

function fireLaserRay(ray: Ray, isCrit: boolean, depth = 0): void {
  const canRicochet = depth < RICOCHET.maxDepth;
  const laserOrigin =
    depth === 0 ? g.barrelTip.getAbsolutePosition() : ray.origin;

  if (isCrit) {
    // Crit laser: penetrate through enemies
    const hits = g.scene.multiPickWithRay(ray) ?? [];
    hits.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

    let laserEnd = ray.origin.add(ray.direction.scale(100));
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
            fireLaserRay(
              new Ray(h.pickedPoint.add(rDir.scale(0.1)), rDir, 100),
              isCrit,
              depth + 1,
            );
          }
        } else {
          markSplitDeadEnemyHit(
            h.pickedMesh as Mesh,
            ray.direction,
            h.pickedPoint,
            h.getNormal(true),
            spawnDeadEnemyBulletHole,
          );
        }
      } else if (
        name === "bodyHalf" ||
        name === "headHalf" ||
        name === "armHalf" ||
        name === "legHalf"
      ) {
        spawnDeadEnemyBulletHole(
          h.pickedPoint,
          h.getNormal(true),
          h.pickedMesh as Mesh,
        );
        hitDebris(h.pickedMesh as Mesh, ray.direction, h.pickedPoint);
        const hitNormal = h.getNormal(true) ?? ray.direction.negate();
        spawnHitParticle(
          h.pickedPoint,
          new Color4(0.8, 0.0, 0.0, 1),
          hitNormal,
        );
      } else if (name === "plasma") {
        const plasmaIdx = g.plasmas.findIndex((o) => o.mesh === h.pickedMesh);
        if (plasmaIdx !== -1) {
          detonatePlasma(g.plasmas[plasmaIdx], h.pickedPoint, isCrit);
          g.plasmas.splice(plasmaIdx, 1);
        }
      } else {
        // Wall/floor — laser stops here
        laserEnd = h.pickedPoint;
        spawnBulletHole(h.pickedPoint, h.getNormal(true), h.pickedMesh as Mesh);
        // Ricochet off geometry
        if (canRicochet && Math.random() < effectiveRicochetChance()) {
          const hitNormal = h.getNormal(true) ?? ray.direction.negate();
          const rDir = reflectWithSpread(ray.direction, hitNormal);
          fireLaserRay(
            new Ray(h.pickedPoint.add(rDir.scale(0.1)), rDir, 100),
            isCrit,
            depth + 1,
          );
        }
        break;
      }
    }
    spawnLaserBeam(laserOrigin, laserEnd, true);
  } else {
    // Normal laser: single hit
    const hit = g.scene.pickWithRay(ray);

    const laserEnd =
      hit?.hit && hit.pickedPoint
        ? hit.pickedPoint
        : ray.origin.add(ray.direction.scale(100));
    spawnLaserBeam(laserOrigin, laserEnd, false);

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
              fireLaserRay(
                new Ray(hit.pickedPoint.add(rDir.scale(0.1)), rDir, 100),
                isCrit,
                depth + 1,
              );
            }
          }
        } else {
          markSplitDeadEnemyHit(
            hit.pickedMesh as Mesh,
            ray.direction,
            hit.pickedPoint ?? undefined,
            hit.getNormal(true),
            spawnDeadEnemyBulletHole,
          );
        }
      } else if (
        hit.pickedMesh.name === "bodyHalf" ||
        hit.pickedMesh.name === "headHalf" ||
        hit.pickedMesh.name === "armHalf" ||
        hit.pickedMesh.name === "legHalf"
      ) {
        if (hit.pickedPoint) {
          spawnDeadEnemyBulletHole(
            hit.pickedPoint,
            hit.getNormal(true),
            hit.pickedMesh as Mesh,
          );
        }
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
      } else if (hit.pickedMesh.name === "plasma") {
        const plasmaIdx = g.plasmas.findIndex((o) => o.mesh === hit.pickedMesh);
        if (plasmaIdx !== -1) {
          const p = g.plasmas[plasmaIdx];
          const detonatePos = hit.pickedPoint ?? p.mesh.position.clone();
          detonatePlasma(p, detonatePos, isCrit);
          g.plasmas.splice(plasmaIdx, 1);
        }
      } else if (hit.pickedPoint) {
        spawnBulletHole(
          hit.pickedPoint,
          hit.getNormal(true),
          hit.pickedMesh as Mesh,
        );
        // Ricochet off geometry
        if (canRicochet && Math.random() < effectiveRicochetChance()) {
          const hitNormal = hit.getNormal(true) ?? ray.direction.negate();
          const rDir = reflectWithSpread(ray.direction, hitNormal);
          fireLaserRay(
            new Ray(hit.pickedPoint.add(rDir.scale(0.1)), rDir, 100),
            isCrit,
            depth + 1,
          );
        }
      }
    }
  }
}

// ─── Alt-fire: Plasma ───────────────────────────────────────────────────────
export function startPlasmaCharge(): void {
  if (
    g.state.activeWeapon !== "blaster" ||
    !g.upgrades.plasmaCaster ||
    !g.state.running ||
    g.state.reloading ||
    g.isSprinting ||
    g.state.overheated ||
    g.pendingUpgrades.length > 0 ||
    g.state.plasmaCooldown > 0
  )
    return;
  if (g.state.ammo < PLASMA.ammoCost) {
    startReload();
    return;
  }

  const isCrit = Math.random() < effectiveCritChance();

  // Consume base ammo and apply heat
  g.state.ammo -= PLASMA.ammoCost;
  g.state.heat = Math.min(
    g.state.heat + HEAT.perShot * PLASMA.heatMultiplier,
    effectiveHeatMax(),
  );
  g.state.heatCooldownTimer = HEAT.cooldownDelay;

  // Instant-fire if no charger upgrade, no spare ammo, or overheated
  if (
    !g.upgrades.plasmaCharger ||
    g.state.ammo === 0 ||
    g.state.heat >= effectiveHeatMax()
  ) {
    firePlasma(1.0, isCrit);
    return;
  }
  g.plasmaChargeCrit = isCrit;
  g.plasmaCharging = true;
  g.plasmaChargeTime = 0;
  g.plasmaChargeAmmo = PLASMA.ammoCost;
  g.plasmaMaxChargeTimer = 0;
  g.plasmaChargeMesh = makePlasmaChargeMesh();
  if (isCrit) {
    const mat = g.plasmaChargeMesh.material as StandardMaterial;
    mat.diffuseColor = new Color3(0.6, 0, 1);
    mat.emissiveColor = new Color3(0.5, 0, 0.9);
  }
  startPlasmaChargeSound();
  updateHUD();
}

export function updatePlasmaCharge(dt: number): void {
  // Interruption: fire immediately at current charge
  if (
    g.state.reloading ||
    g.isSprinting ||
    g.state.overheated ||
    !g.state.running ||
    g.state.paused
  ) {
    releasePlasmaCharge();
    return;
  }

  g.plasmaChargeTime += dt;

  // Drain extra ammo over time
  const targetExtra = Math.min(
    Math.floor(
      g.plasmaChargeTime / (effectiveCooldown() * PLASMA.cooldownMultiplier),
    ),
    PLASMA.ammoCost, // max 8 additional
  );
  const currentExtra = g.plasmaChargeAmmo - PLASMA.ammoCost;
  for (let i = currentExtra; i < targetExtra; i++) {
    if (g.state.ammo <= 0) {
      releasePlasmaCharge();
      return;
    }
    g.state.ammo--;
    g.plasmaChargeAmmo++;
    g.state.heat = Math.min(
      g.state.heat + (HEAT.perShot * PLASMA.heatMultiplier) / PLASMA.ammoCost,
      effectiveHeatMax(),
    );
    g.state.heatCooldownTimer = HEAT.cooldownDelay;
    if (g.state.heat >= effectiveHeatMax()) {
      releasePlasmaCharge();
      return;
    }
  }

  const chargeMultiplier = g.plasmaChargeAmmo / PLASMA.ammoCost;

  // Update visual: lerp scale and brightness smoothly toward target
  if (g.plasmaChargeMesh) {
    const lerpRate = 1 - Math.pow(0.001, dt / 1000); // ~smooth over ~150ms
    const curScale = g.plasmaChargeMesh.scaling.x;
    const s = curScale + (chargeMultiplier - curScale) * lerpRate;
    g.plasmaChargeMesh.scaling.setAll(s);
    g.plasmaChargeMesh.position.z = PLASMA.radius * s;
    const mat = g.plasmaChargeMesh.material as StandardMaterial;
    const t = s - 1;
    if (g.plasmaChargeCrit) {
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
  updatePlasmaChargeSound(chargeMultiplier - 1);

  // At max charge, start hold timer — auto-fire after delay
  if (g.plasmaChargeAmmo >= PLASMA.ammoCost * 2) {
    g.plasmaMaxChargeTimer += dt;
    if (g.plasmaMaxChargeTimer >= PLASMA.maxChargeHold) {
      releasePlasmaCharge();
      return;
    }
  }

  updateHUD();
}

export function releasePlasmaCharge(): void {
  if (!g.plasmaCharging) return;
  const chargeMultiplier = g.plasmaChargeAmmo / PLASMA.ammoCost;
  stopPlasmaChargeSound();
  if (g.plasmaChargeMesh) {
    g.plasmaChargeMesh.dispose();
    g.plasmaChargeMesh = null;
  }
  g.plasmaCharging = false;
  const isCrit = g.plasmaChargeCrit;
  g.plasmaChargeCrit = false;
  firePlasma(chargeMultiplier, isCrit);
}

export function dumpPlasmaCharge(): void {
  if (!g.plasmaCharging || !g.upgrades.plasmaGrenadier) return;

  const extraAmmo = Math.min(g.plasmaChargeAmmo, g.state.ammo);
  g.state.ammo -= extraAmmo;
  g.plasmaChargeAmmo += extraAmmo;

  for (let i = 0; i < extraAmmo; i++) {
    g.state.heat = Math.min(
      g.state.heat + (HEAT.perShot * PLASMA.heatMultiplier) / PLASMA.ammoCost,
      effectiveHeatMax(),
    );
  }
  g.state.heatCooldownTimer = HEAT.cooldownDelay;

  const chargeMultiplier = g.plasmaChargeAmmo / PLASMA.ammoCost;
  stopPlasmaChargeSound();
  if (g.plasmaChargeMesh) {
    g.plasmaChargeMesh.dispose();
    g.plasmaChargeMesh = null;
  }
  g.plasmaCharging = false;
  const isCrit = g.plasmaChargeCrit;
  g.plasmaChargeCrit = false;
  firePlasma(chargeMultiplier, isCrit, true);
}

function firePlasma(
  chargeMultiplier: number,
  isCrit = false,
  hasGravity = false,
): void {
  g.state.plasmaCooldown =
    effectiveCooldown() * PLASMA.cooldownMultiplier * chargeMultiplier;
  g.state.shootCooldown = Math.max(
    g.state.shootCooldown,
    g.state.plasmaCooldown,
  );
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
  const aimRays = [ray];
  if (multishot) {
    const up = g.camera.upVector;
    const right = Vector3.Cross(ray.direction, up).normalize();
    aimRays.push(
      new Ray(
        ray.origin,
        ray.direction.add(right.scale(MULTISHOT.angle)).normalize(),
        ray.length,
      ),
      new Ray(
        ray.origin,
        ray.direction.add(right.scale(-MULTISHOT.angle)).normalize(),
        ray.length,
      ),
    );
  }

  const spawnPos = g.barrelTip.getAbsolutePosition();
  playPlasmaLaunchSound(spawnPos, chargeMultiplier);

  for (const aimRay of aimRays) {
    const barrelDir = g.barrelTip.getDirection(Vector3.Forward()).normalize();
    const plasmaDir = aimProjectileFromMuzzle(aimRay, spawnPos, barrelDir);
    spawnPlasma(
      spawnPos,
      plasmaDir,
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

export function updatePlasmas(dt: number): void {
  const dtSec = dt / 1000;
  for (let i = g.plasmas.length - 1; i >= 0; i--) {
    const p = g.plasmas[i];
    p.age += dt;

    // Move plasma
    if (p.hasGravity) {
      p.velocity.y -= PLASMA.gravity * dtSec;
    }
    const step = p.velocity.scale(dtSec);
    p.mesh.position.addInPlace(step);

    // 5-ray collision: center + 4 edges of the plasma sphere
    const rayDir = p.velocity.normalizeToNew();
    const rayLen = p.velocity.length() * dtSec + 0.2;
    const up = Vector3.Cross(rayDir, new Vector3(1, 0, 0));
    if (up.lengthSquared() < 0.01)
      up.copyFrom(Vector3.Cross(rayDir, new Vector3(0, 0, 1)));
    up.normalize();
    const right = Vector3.Cross(rayDir, up).normalize();

    const plasmaR = PLASMA.radius * p.chargeMultiplier;
    const rayOrigins = [
      p.mesh.position,
      p.mesh.position.add(up.scale(plasmaR)),
      p.mesh.position.add(up.scale(-plasmaR)),
      p.mesh.position.add(right.scale(plasmaR)),
      p.mesh.position.add(right.scale(-plasmaR)),
    ];

    let explode = false;
    let explodePos = p.mesh.position.clone();
    let explodeNormal: Vector3 | null = null;
    const directHits = new Map<Enemy, Mesh>();
    let bounced = false;
    const canRicochet = p.ricochetDepth < RICOCHET.maxDepth;

    for (const origin of rayOrigins) {
      const ray = new Ray(origin, rayDir, rayLen);
      const hit = g.scene.pickWithRay(ray, plasmaRayFilter);
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
        } else if (p.hasGravity && !bounced) {
          // Gravity plasmas bounce off geometry instead of detonating
          const normal = hit.getNormal(true);
          if (normal) {
            const dot = Vector3.Dot(p.velocity, normal);
            if (dot < 0) {
              p.velocity = p.velocity.subtract(normal.scale(2 * dot));
              p.velocity.scaleInPlace(PLASMA.bounceDamping);
              p.mesh.position.addInPlace(normal.scale(plasmaR + 0.05));
              bounced = true;
              // Ricochet spawns another gravity plasma at random angle
              if (canRicochet && Math.random() < effectiveRicochetChance()) {
                const rDir = addRandomSpread(
                  p.velocity.normalizeToNew(),
                  Math.PI * 0.5,
                );
                spawnPlasma(
                  p.mesh.position.add(rDir.scale(plasmaR + 0.1)),
                  rDir,
                  p.chargeMultiplier,
                  p.heatPenalty,
                  p.isCrit,
                  p.hasGravity,
                  p.ricochetDepth + 1,
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

    if (p.age > PLASMA.fuse) explode = true;

    if (explode) {
      // Ricochet on explosion
      if (
        canRicochet &&
        explodeNormal &&
        Math.random() < effectiveRicochetChance()
      ) {
        const rDir = reflectWithSpread(rayDir, explodeNormal);
        spawnPlasma(
          explodePos.add(rDir.scale(plasmaR + 0.1)),
          rDir,
          p.chargeMultiplier,
          p.heatPenalty,
          p.isCrit,
          p.hasGravity,
          p.ricochetDepth + 1,
        );
      }
      explodePlasma(
        explodePos,
        directHits,
        p.heatPenalty,
        p.mesh,
        p.chargeMultiplier,
        false,
        p.isCrit ? 1 : 0,
      );
      g.plasmas.splice(i, 1);
    }
  }
}

function detonatePlasma(
  plasma: Plasma,
  pos: Vector3,
  laserIsCrit = false,
): void {
  const directHits = new Map<Enemy, Mesh>();
  const critLevel = (plasma.isCrit ? 1 : 0) + (laserIsCrit ? 1 : 0);
  explodePlasma(
    pos,
    directHits,
    plasma.heatPenalty,
    plasma.mesh,
    plasma.chargeMultiplier,
    true,
    critLevel,
  );
}

function explodePlasma(
  pos: Vector3,
  directHits: Map<Enemy, Mesh>,
  heatPenalty: number,
  plasmaMesh: Mesh,
  chargeMultiplier: number,
  laserDetonated = false,
  critLevel = 0,
): void {
  const isCrit = critLevel > 0;
  playPlasmaExplosionSound(pos, chargeMultiplier);
  spawnExplosionParticle(pos, isCrit);

  // Animate the plasma mesh as an expanding, fading blast sphere
  plasmaMesh.position = pos.clone();
  plasmaMesh.isPickable = false;
  const mat = plasmaMesh.material as StandardMaterial;
  if (isCrit) {
    mat.diffuseColor = new Color3(0.6, 0, 1);
    mat.emissiveColor = new Color3(0.5, 0, 0.9);
  }
  mat.alpha = 0.6;
  const expandDurationMs = 300;
  const startTime = performance.now();
  const startScale = plasmaMesh.scaling.x;
  const explosionRadius =
    PLASMA.explosionRadius * chargeMultiplier * Math.pow(2, critLevel);
  const endScale = (explosionRadius * 2) / 0.3; // diameter ratio
  const obs = g.scene.onBeforeRenderObservable.add(() => {
    const t = Math.min((performance.now() - startTime) / expandDurationMs, 1);
    const s = startScale + (endScale - startScale) * t;
    plasmaMesh.scaling.setAll(s);
    mat.alpha = 0.6 * (1 - t);
    if (t >= 1) {
      g.scene.onBeforeRenderObservable.remove(obs);
      plasmaMesh.dispose();
    }
  });

  const critMult = Math.pow(effectiveCritDamage(), critLevel);
  const damage =
    (effectivePlasmaDamage() * chargeMultiplier +
      (laserDetonated ? effectiveLaserDamage() : 0)) *
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
      dmg = damage * (laserDetonated ? 1 : PLASMA.splashFalloff) * falloff;
      flashMesh = enemy.bodyMesh;
    }

    dmg = Math.round(dmg * (0.8 + Math.random() * 0.4) * heatPenalty);

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

    damageEnemy(enemy, dmg, flashMesh, ePos, isCrit, {
      plasmaKill: true,
      canLightning: true,
      canIgnite: true,
    });
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
      PLASMA.damage *
        chargeMultiplier *
        (laserDetonated ? 1 : PLASMA.splashFalloff) *
        falloff *
        effectivePlasmaSelfDamage(),
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

// ─── Lightning ───────────────────────────────────────────────────────────────
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
  const flashColor = isCrit ? new Color3(0.5, 0, 0.9) : new Color3(0.5, 0.7, 1);
  (enemy.bodyMesh.material as StandardMaterial).emissiveColor = flashColor;
  enemy.flashMesh = enemy.bodyMesh;
  enemy.flashTime = 200;
  if (
    damageEnemy(enemy, dmg, enemy.bodyMesh, enemyPos, isCrit, {
      canIgnite: true,
    })
  )
    return;

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
    (closest.bodyMesh.material as StandardMaterial).emissiveColor = flashColor;
    closest.flashMesh = closest.bodyMesh;
    closest.flashTime = 200;
    damageEnemy(closest, chainDmg, closest.bodyMesh, targetPos, isCrit, {
      canIgnite: true,
    });
    chainSource = targetPos;
  }
}

// ─── Hit enemy ───────────────────────────────────────────────────────────────
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
  const dmg = Math.round(
    effectiveLaserDamage() *
      (0.8 + Math.random() * 0.4) *
      (headshot ? 2 : 1) *
      heatPenalty *
      critMult,
  );
  (hitMesh.material as StandardMaterial).emissiveColor = new Color3(1, 0, 0);
  enemy.flashMesh = hitMesh;
  enemy.flashTime = effectiveCooldown() * 0.6;

  const dmgPos = hitPoint ?? enemy.bodyMesh.getAbsolutePosition();
  damageEnemy(enemy, dmg, hitMesh, dmgPos, isCrit, {
    canLightning: true,
    canIgnite: true,
  });
}

// ─── Reload ──────────────────────────────────────────────────────────────────
export function startReload(): void {
  const maxMag = effectiveMagSize();
  if (
    g.state.reloading ||
    g.state.reserve <= 0 ||
    g.state.ammo >= maxMag ||
    g.isSprinting ||
    g.state.meleeCooldown > 0 ||
    (g.state.activeWeapon === "blaster" && g.state.overheated)
  )
    return;
  releaseBayonetEmbed();
  g.rifleScoped = false;
  g.rifleScopeViewActive = false;
  g.rifleScopeRecoilKicked = false;
  g.rifleLaserDot?.setEnabled(false);
  g.state.reloading = true;
  const reloadTime = effectiveReloadTime();
  g.state.reloadTimeLeft = reloadTime;
  dom.reloadMsg.classList.add("visible");
  const barrelPos = () => g.barrelTip.getAbsolutePosition();
  if (g.state.activeWeapon === "rifle") {
    playRifleReloadSounds(reloadTime, barrelPos);
  } else {
    playReloadSounds(reloadTime, barrelPos);
  }
}

export function completeReload(): void {
  const take = Math.min(effectiveMagSize() - g.state.ammo, g.state.reserve);
  g.state.ammo += take;
  g.state.reserve -= take;
  cacheActiveWeaponAmmo();
  g.state.reloading = false;
  g.state.reloadTimeLeft = 0;
  dom.reloadMsg.classList.remove("visible");
  updateHUD();
}

// ─── Player damage ───────────────────────────────────────────────────────────
export function damagePlayer(amount: number): void {
  g.state.health = Math.max(0, g.state.health - amount);
  updateHUD();
  dom.hitFlash.classList.add("active");
  g.state.hitFlashTime = 200;
}
