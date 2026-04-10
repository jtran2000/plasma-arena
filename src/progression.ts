import { Vector3 } from "@babylonjs/core";
import { PLAYER, BLASTER, RIFLE, SUPPLY, CRIT, UPGRADE } from "./constants.js";
const { LASER, SPREAD, HEAT, PLASMA, MULTISHOT, RICOCHET, LIGHTNING, IGNITE } =
  BLASTER;
import { g, dom, equipWeapon } from "./game.js";

// ─── Effective stat functions ─────────────────────────────────────────────────
export function effectiveMaxHealth(): number {
  return PLAYER.maxHealth + g.upgrades.maxHealth * UPGRADE.maxHealth;
}
export function effectiveSpeed(): number {
  return PLAYER.speed + g.upgrades.speed * UPGRADE.speed;
}
export function effectiveReloadTime(): number {
  if (g.state.activeWeapon === "rifle") return RIFLE.reloadTime;
  return (
    LASER.reloadTime * Math.pow(1 - UPGRADE.reloadSpeed, g.upgrades.reloadTime)
  );
}
export function effectiveMagSize(): number {
  if (g.state.activeWeapon === "rifle") return RIFLE.magSize;
  return LASER.magSize + g.upgrades.magSize * UPGRADE.magSize;
}
export function effectiveCooldown(): number {
  if (g.state.activeWeapon === "rifle") {
    const rateOfFire =
      g.rifleScoped && g.upgrades.rifleScope
        ? RIFLE.SCOPE.rateOfFire
        : RIFLE.rateOfFire;
    return 60000 / rateOfFire;
  }
  const pulseMult = g.upgrades.pulseLaser ? 2 : 1;
  return (
    60000 /
    (LASER.rateOfFire *
      pulseMult *
      (1 + g.upgrades.rateOfFire * UPGRADE.rateOfFire))
  );
}
export function effectiveHeatMax(): number {
  return HEAT.max * (1 + g.upgrades.heatCapacity * UPGRADE.heatCapacity);
}
export function effectiveHeatDecay(): number {
  return HEAT.decay * (1 + g.upgrades.heatDecay * UPGRADE.heatDecay);
}
export function effectiveBloom(): number {
  if (g.state.activeWeapon === "rifle") return RIFLE.SPREAD.perShot;
  return (
    SPREAD.perShot * Math.pow(1 - UPGRADE.bloomReduction, g.upgrades.bloom)
  );
}
export function effectiveRifleSpreadScale(): number {
  return g.upgrades.rifleLaserSight && !g.rifleScoped
    ? RIFLE.LASER_SIGHT.spreadScale
    : 1;
}
export function effectiveMoveSpreadRate(): number {
  if (g.state.activeWeapon === "rifle") return RIFLE.SPREAD.moveRate;
  return (
    SPREAD.moveRate *
    Math.pow(1 - UPGRADE.moveSpreadReduction, g.upgrades.moveSpread)
  );
}
export function effectiveLaserDamage(): number {
  return LASER.damage + g.upgrades.laserDamage * UPGRADE.laserDamage;
}
export function effectivePlasmaDamage(): number {
  return PLASMA.damage + g.upgrades.plasmaDamage * UPGRADE.plasmaDamage;
}
export function effectivePlasmaSpeed(): number {
  return (
    PLASMA.speed * (1 + g.upgrades.plasmaVelocity * UPGRADE.plasmaVelocity)
  );
}
export function effectiveSprintStaminaDrain(): number {
  return (
    PLAYER.STAMINA.sprintDrainPerSec *
    (g.upgrades.combatBoots ? PLAYER.STAMINA.combatBootsSprintScale : 1)
  );
}
export function effectiveJumpStaminaCost(): number {
  return (
    PLAYER.STAMINA.jumpCost *
    (g.upgrades.combatBoots ? PLAYER.STAMINA.combatBootsJumpScale : 1)
  );
}
export function effectiveSupplyDropRate(): number {
  return SUPPLY.dropRate + g.upgrades.supplyDropRate * UPGRADE.supplyDropRate;
}
export function effectiveCritChance(): number {
  return CRIT.chance + g.upgrades.critChance * UPGRADE.critChance;
}
export function effectiveCritDamage(): number {
  return CRIT.damage + g.upgrades.critDamage * UPGRADE.critDamage;
}
export function effectivePlasmaSelfDamage(): number {
  return Math.pow(
    1 - UPGRADE.plasmaSelfDamageReduction,
    g.upgrades.plasmaSelfDamage,
  );
}
export function effectiveMultishotChance(): number {
  if (!g.upgrades.multishotUnlock) return 0;
  return MULTISHOT.chance + g.upgrades.multishot * UPGRADE.multishotChance;
}
export function effectiveRicochetChance(): number {
  if (!g.upgrades.ricochetUnlock) return 0;
  return RICOCHET.chance + g.upgrades.ricochet * UPGRADE.ricochetChance;
}
export function effectiveLightningChance(): number {
  if (!g.upgrades.lightningUnlock) return 0;
  return LIGHTNING.chance + g.upgrades.lightning * UPGRADE.lightningChance;
}
export function effectiveIgniteChance(): number {
  if (!g.upgrades.igniteUnlock) return 0;
  return IGNITE.chance + g.upgrades.ignite * UPGRADE.igniteChance;
}

export function incrementScore(amount: number, hitPoint?: Vector3): void {
  g.state.score += amount;
  updateHUD();
  while (g.state.score >= g.state.nextSupplyThreshold) {
    g.state.nextSupplyThreshold += SUPPLY.scoreInterval;
    if (Math.random() < effectiveSupplyDropRate() && hitPoint) {
      g.queuedSupplyDrops.push(hitPoint.clone());
    }
  }
}

function syncWeaponUpgradeVisuals(): void {
  if (g.rifleBrake) g.rifleBrake.isVisible = g.upgrades.muzzleBrake;
  if (g.rifleScope) g.rifleScope.setEnabled(g.upgrades.rifleScope);
  if (g.rifleLaserSight)
    g.rifleLaserSight.setEnabled(g.upgrades.rifleLaserSight);
  if (g.rifleBayonet) g.rifleBayonet.setEnabled(g.upgrades.bayonet);
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
export function updateHUD(): void {
  const maxHp = effectiveMaxHealth();
  const hpFrac = g.state.health / maxHp;
  const baseHeight = 150;
  const barHeight = baseHeight * (maxHp / PLAYER.maxHealth);
  dom.healthBar.style.height = `${barHeight}px`;
  dom.healthFill.style.height = `${hpFrac * 100}%`;
  dom.healthFill.style.background =
    hpFrac > 0.5 ? "#4f4" : hpFrac > 0.25 ? "#fa0" : "#f44";
  dom.healthText.textContent = `${Math.ceil(g.state.health)} / ${maxHp}`;
  updateStaminaHUD();
  dom.weaponEl.textContent =
    g.state.activeWeapon === "rifle" ? "RIFLE" : "BLASTER";
  dom.ammoEl.textContent = `${g.state.ammo} / ${g.state.reserve}`;
  dom.scoreEl.textContent = String(g.state.score);
  dom.killsEl.textContent = String(g.state.kills);
  dom.waveValue.textContent = String(g.state.wave);
  dom.waveRemaining.textContent = String(
    g.state.waveEnemiesLeft + g.enemies.length,
  );
}

export function updateStaminaHUD(): void {
  const frac = g.state.stamina / PLAYER.STAMINA.max;
  dom.staminaBar.classList.toggle(
    "visible",
    g.state.stamina < PLAYER.STAMINA.max || g.state.staminaDisplayTimer > 0,
  );
  dom.staminaFill.style.width = `${frac * 100}%`;
  dom.staminaFill.classList.toggle(
    "low",
    frac <= PLAYER.STAMINA.lowFraction &&
      frac > PLAYER.STAMINA.criticalFraction,
  );
  dom.staminaFill.classList.toggle(
    "critical",
    frac <= PLAYER.STAMINA.criticalFraction,
  );
}

// ─── Upgrade definitions ────────────────────────────────────────────────────
interface UpgradeDef {
  key: keyof typeof g.upgrades;
  label: string;
  weight?: number;
  instruction?: string;
  oneTime?: boolean;
  requires?: keyof typeof g.upgrades;
  onApply?: () => void;
}

function preferredWeaponForUpgrade(
  key: keyof typeof g.upgrades,
): "blaster" | "rifle" | null {
  if (
    key === "rifleUnlock" ||
    key === "muzzleBrake" ||
    key === "rifleScope" ||
    key === "rifleLaserSight" ||
    key === "bayonet"
  ) {
    return "rifle";
  }

  if (
    key === "pulseLaser" ||
    key === "laserDamage" ||
    key === "plasmaCaster" ||
    key === "plasmaCharger" ||
    key === "plasmaGrenadier" ||
    key === "plasmaDamage" ||
    key === "plasmaVelocity" ||
    key === "plasmaSelfDamage" ||
    key === "multishotUnlock" ||
    key === "multishot" ||
    key === "ricochetUnlock" ||
    key === "ricochet" ||
    key === "lightningUnlock" ||
    key === "lightning" ||
    key === "igniteUnlock" ||
    key === "ignite"
  ) {
    return "blaster";
  }

  return null;
}

const UPGRADE_DEFS: UpgradeDef[] = [
  {
    key: "maxHealth",
    label: `+${UPGRADE.maxHealth} Max Health`,
    onApply: () => {
      g.state.health = Math.min(
        g.state.health + UPGRADE.maxHealth,
        effectiveMaxHealth(),
      );
      updateHUD();
    },
  },
  { key: "speed", label: `+${UPGRADE.speed} Speed` },
  {
    key: "combatBoots",
    label: "Combat Boots",
    weight: 5,
    instruction: `Cuts sprint stamina drain by ${Math.round(
      (1 - PLAYER.STAMINA.combatBootsSprintScale) * 100,
    )}% and jump stamina drain by ${Math.round(
      (1 - PLAYER.STAMINA.combatBootsJumpScale) * 100,
    )}%`,
    oneTime: true,
  },
  {
    key: "reloadTime",
    label: `+${Math.round(UPGRADE.reloadSpeed * 100)}% Reload Speed`,
  },
  { key: "magSize", label: `+${UPGRADE.magSize} Mag Size` },
  { key: "rateOfFire", label: `+${UPGRADE.rateOfFire * 100}% Fire Rate` },
  {
    key: "heatCapacity",
    label: `+${Math.round(UPGRADE.heatCapacity * 100)}% Heat Capacity`,
  },
  {
    key: "heatDecay",
    label: `+${Math.round(UPGRADE.heatDecay * 100)}% Cooling`,
  },
  {
    key: "bloom",
    label: `-${Math.round(UPGRADE.bloomReduction * 100)}% Bloom`,
  },
  {
    key: "moveSpread",
    label: `+${Math.round(UPGRADE.moveSpreadReduction * 100)}% Accuracy While Moving`,
  },
  { key: "laserDamage", label: `+${UPGRADE.laserDamage} Laser Damage` },
  {
    key: "plasmaDamage",
    label: `+${UPGRADE.plasmaDamage} Plasma Damage`,
    requires: "plasmaCaster",
  },
  {
    key: "plasmaVelocity",
    label: `+${Math.round(UPGRADE.plasmaVelocity * 100)}% Plasma Velocity`,
    requires: "plasmaCaster",
  },
  {
    key: "supplyDropRate",
    label: `+${Math.round(UPGRADE.supplyDropRate * 100)}% Supply Drop Rate`,
  },
  {
    key: "critChance",
    label: `+${Math.round(UPGRADE.critChance * 100)}% Crit Chance`,
  },
  { key: "critDamage", label: `+${UPGRADE.critDamage}x Crit Damage` },
  {
    key: "plasmaSelfDamage",
    label: `-${Math.round(UPGRADE.plasmaSelfDamageReduction * 100)}% Plasma Self-Damage`,
    requires: "plasmaCaster",
  },
  {
    key: "multishotUnlock",
    label: "Multishot",
    weight: 2,
    instruction: "Blaster shots have a chance to split into 3",
    oneTime: true,
  },
  {
    key: "multishot",
    label: `+${Math.round(UPGRADE.multishotChance * 100)}% Multishot Chance`,
    requires: "multishotUnlock",
  },
  {
    key: "ricochetUnlock",
    label: "Ricochet",
    weight: 5,
    instruction: "Lasers and plasma can bounce off surfaces and hit again",
    oneTime: true,
  },
  {
    key: "ricochet",
    label: `+${Math.round(UPGRADE.ricochetChance * 100)}% Ricochet Chance`,
    requires: "ricochetUnlock",
  },
  {
    key: "lightningUnlock",
    label: "Lightning",
    weight: 2,
    instruction:
      "Blaster hits can call down lightning that chains between enemies",
    oneTime: true,
  },
  {
    key: "lightning",
    label: `+${Math.round(UPGRADE.lightningChance * 100)}% Lightning Chance`,
    requires: "lightningUnlock",
  },
  {
    key: "igniteUnlock",
    label: "Ignite",
    weight: 2,
    instruction:
      "Blaster hits can set enemies on fire, spreading to nearby foes",
    oneTime: true,
  },
  {
    key: "ignite",
    label: `+${Math.round(UPGRADE.igniteChance * 100)}% Ignite Chance`,
    requires: "igniteUnlock",
  },
  {
    key: "pulseLaser",
    label: "Pulse Laser",
    weight: 10,
    instruction: "Hold LMB to fire continuously",
    oneTime: true,
  },
  {
    key: "plasmaCaster",
    label: "Plasma Caster",
    weight: 10,
    instruction: "Press RMB to fire plasma",
    oneTime: true,
  },
  {
    key: "plasmaCharger",
    label: "Plasma Charger",
    weight: 2,
    instruction: "Hold RMB to charge plasma",
    oneTime: true,
    requires: "plasmaCaster",
  },
  {
    key: "plasmaGrenadier",
    label: "Plasma Grenadier",
    weight: 2,
    instruction: "Press LMB while holding RMB to fire grenade",
    oneTime: true,
    requires: "plasmaCharger",
  },
  {
    key: "rifleUnlock",
    label: "Rifle",
    weight: 10,
    instruction: "Scroll to switch between blaster and rifle",
    oneTime: true,
  },
  {
    key: "muzzleBrake",
    label: "Muzzle Brake",
    weight: 2,
    instruction: "Rifle recoil and flash are reduced",
    oneTime: true,
    requires: "rifleUnlock",
    onApply: syncWeaponUpgradeVisuals,
  },
  {
    key: "rifleScope",
    label: "Rifle Scope",
    weight: 5,
    instruction: "Hold RMB with the rifle to zoom and fire precise shots",
    oneTime: true,
    requires: "rifleUnlock",
    onApply: syncWeaponUpgradeVisuals,
  },
  {
    key: "rifleLaserSight",
    label: "Rifle Laser Sight",
    weight: 2,
    instruction: `Projects a green aim dot and reduces unscoped rifle spread by ${Math.round(
      (1 - RIFLE.LASER_SIGHT.spreadScale) * 100,
    )}%`,
    oneTime: true,
    requires: "rifleUnlock",
    onApply: syncWeaponUpgradeVisuals,
  },
  {
    key: "bayonet",
    label: "Bayonet",
    weight: 5,
    instruction: `Rifle melee deals ${RIFLE.BAYONET.damageMultiplier}x damage and stabs enemies`,
    oneTime: true,
    requires: "muzzleBrake",
    onApply: syncWeaponUpgradeVisuals,
  },
];

// ─── Upgrade menu functions ─────────────────────────────────────────────────
function pickRandomUpgrades(): UpgradeDef[] {
  const pool = UPGRADE_DEFS.filter(
    (d) =>
      !(d.oneTime && g.upgrades[d.key]) &&
      !(d.requires && !g.upgrades[d.requires]),
  );
  const picked: UpgradeDef[] = [];
  const remaining = [...pool];
  for (let i = 0; i < 3 && remaining.length > 0; i++) {
    const totalWeight = remaining.reduce((sum, d) => sum + (d.weight ?? 1), 0);
    let roll = Math.random() * totalWeight;
    let chosen = remaining.length - 1;
    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].weight ?? 1;
      if (roll <= 0) {
        chosen = j;
        break;
      }
    }
    picked.push(remaining[chosen]);
    remaining.splice(chosen, 1);
  }
  return picked;
}

export function showUpgradeMenu(): void {
  const choices = pickRandomUpgrades();
  g.pendingUpgrades = choices.map((c) => c.key);
  for (let i = 0; i < 3; i++) {
    dom.upgradeLabels[i].textContent = choices[i].label;
    const val = g.upgrades[choices[i].key];
    dom.upgradeCounts[i].textContent =
      typeof val === "number" && val > 0 ? `(${val}x)` : "";
  }
  dom.upgradeMenu.classList.add("visible");
  g.mouseHeld = false;
  document.exitPointerLock();
}

function hideUpgradeMenu(): void {
  dom.upgradeMenu.classList.remove("visible");
  g.pendingUpgrades = [];
  dom.canvas.requestPointerLock({ unadjustedMovement: true });
}

function showInstruction(text: string): void {
  dom.instructionMsg.textContent = text;
  dom.instructionMsg.classList.add("visible");
  setTimeout(() => dom.instructionMsg.classList.remove("visible"), 3000);
}

export function selectUpgrade(index: number): void {
  if (g.pendingUpgrades.length === 0) return;
  const key = g.pendingUpgrades[index];
  const def = UPGRADE_DEFS.find((d) => d.key === key);
  if (!def) return;
  const val = g.upgrades[def.key];
  const upgrades = g.upgrades as unknown as Record<
    keyof typeof g.upgrades,
    number | boolean
  >;
  if (typeof val === "boolean") {
    upgrades[def.key] = true;
  } else {
    upgrades[def.key] = val + 1;
  }
  const preferredWeapon = preferredWeaponForUpgrade(def.key);
  if (preferredWeapon && g.state.running) {
    equipWeapon(preferredWeapon);
  }
  def.onApply?.();
  if (def.instruction) showInstruction(def.instruction);
  hideUpgradeMenu();
}
