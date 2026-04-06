import {
  PLAYER,
  BEAM,
  SPREAD,
  HEAT,
  ORB,
  SUPPLY,
  CRIT,
  MULTISHOT,
  RICOCHET,
  LIGHTNING,
  IGNITE,
  UPGRADE,
} from "./constants.js";
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
    BEAM.reloadTime * Math.pow(1 - UPGRADE.reloadSpeed, g.upgrades.reloadTime)
  );
}
export function effectiveMagSize(): number {
  return BEAM.magSize + g.upgrades.magSize * UPGRADE.magSize;
}
export function effectiveCooldown(): number {
  const pulseMult = g.upgrades.pulseLaser ? 2 : 1;
  return (
    60000 /
    (BEAM.rateOfFire *
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
export function effectiveBeamDamage(): number {
  return BEAM.damage + g.upgrades.beamDamage * UPGRADE.beamDamage;
}
export function effectiveOrbDamage(): number {
  return ORB.damage + g.upgrades.orbDamage * UPGRADE.orbDamage;
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
export function effectiveOrbSelfDamage(): number {
  return Math.pow(1 - UPGRADE.orbSelfDamageReduction, g.upgrades.orbSelfDamage);
}
export function effectiveMultishotChance(): number {
  return MULTISHOT.chance + g.upgrades.multishot * UPGRADE.multishotChance;
}
export function effectiveRicochetChance(): number {
  return RICOCHET.chance + g.upgrades.ricochet * UPGRADE.ricochetChance;
}
export function effectiveLightningChance(): number {
  return LIGHTNING.chance + g.upgrades.lightning * UPGRADE.lightningChance;
}
export function effectiveIgniteChance(): number {
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
  { key: "beamDamage", label: `+${UPGRADE.beamDamage} Beam Damage` },
  {
    key: "orbDamage",
    label: `+${UPGRADE.orbDamage} Orb Damage`,
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
    key: "orbSelfDamage",
    label: `-${Math.round(UPGRADE.orbSelfDamageReduction * 100)}% Orb Self-Damage`,
    requires: "plasmaCaster",
  },
  {
    key: "multishot",
    label: `+${Math.round(UPGRADE.multishotChance * 100)}% Multishot Chance`,
  },
  {
    key: "ricochet",
    label: `+${Math.round(UPGRADE.ricochetChance * 100)}% Ricochet Chance`,
  },
  {
    key: "lightning",
    label: `+${Math.round(UPGRADE.lightningChance * 100)}% Lightning Chance`,
  },
  {
    key: "ignite",
    label: `+${Math.round(UPGRADE.igniteChance * 100)}% Ignite Chance`,
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
