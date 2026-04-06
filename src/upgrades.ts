import { PLAYER, BLASTER, SUPPLY, CRIT, UPGRADE } from "./constants.js";
const { LASER, SPREAD, HEAT, PLASMA, MULTISHOT, RICOCHET, LIGHTNING, IGNITE } =
  BLASTER;
import { g, dom } from "./game.js";

// ─── Effective stat functions ─────────────────────────────────────────────────
export function effectiveMaxHealth(): number {
  return PLAYER.maxHealth + g.upgrades.maxHealth * UPGRADE.maxHealth;
}
export function effectiveSpeed(): number {
  return PLAYER.speed + g.upgrades.speed * UPGRADE.speed;
}
export function effectiveReloadTime(): number {
  return (
    LASER.reloadTime * Math.pow(1 - UPGRADE.reloadSpeed, g.upgrades.reloadTime)
  );
}
export function effectiveMagSize(): number {
  return LASER.magSize + g.upgrades.magSize * UPGRADE.magSize;
}
export function effectiveCooldown(): number {
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
  return (
    SPREAD.perShot * Math.pow(1 - UPGRADE.bloomReduction, g.upgrades.bloom)
  );
}
export function effectiveMoveSpreadRate(): number {
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
    weight: 5,
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
    weight: 5,
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
    weight: 5,
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
  if (typeof val === "boolean") {
    (g.upgrades as Record<string, number | boolean>)[def.key] = true;
  } else {
    (g.upgrades as Record<string, number | boolean>)[def.key] = val + 1;
  }
  def.onApply?.();
  if (def.instruction) showInstruction(def.instruction);
  hideUpgradeMenu();
}
