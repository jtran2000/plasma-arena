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
  return BEAM.reloadTime * Math.pow(1 - UPGRADE.reloadSpeed, g.upgrades.reloadTime);
}
export function effectiveMagSize(): number {
  return BEAM.magSize + g.upgrades.magSize * UPGRADE.magSize;
}
export function effectiveCooldown(): number {
  return 60000 / (BEAM.rateOfFire * (1 + g.upgrades.rateOfFire * UPGRADE.rateOfFire));
}
export function effectiveHeatMax(): number {
  return HEAT.max * (1 + g.upgrades.heatCapacity * UPGRADE.heatCapacity);
}
export function effectiveHeatDecay(): number {
  return HEAT.decay * (1 + g.upgrades.heatDecay * UPGRADE.heatDecay);
}
export function effectiveBloom(): number {
  return SPREAD.perShot * Math.pow(1 - UPGRADE.bloomReduction, g.upgrades.bloom);
}
export function effectiveMoveSpreadRate(): number {
  return SPREAD.moveRate * Math.pow(1 - UPGRADE.moveSpreadReduction, g.upgrades.moveSpread);
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
  apply: () => void;
}

const UPGRADE_DEFS: UpgradeDef[] = [
  {
    key: "maxHealth",
    label: `+${UPGRADE.maxHealth} Max Health`,
    apply: () => {
      g.upgrades.maxHealth++;
      g.state.health = Math.min(
        g.state.health + UPGRADE.maxHealth,
        effectiveMaxHealth(),
      );
      updateHUD();
    },
  },
  {
    key: "speed",
    label: `+${UPGRADE.speed} Speed`,
    apply: () => { g.upgrades.speed++; },
  },
  {
    key: "reloadTime",
    label: `+${Math.round(UPGRADE.reloadSpeed * 100)}% Reload Speed`,
    apply: () => { g.upgrades.reloadTime++; },
  },
  {
    key: "magSize",
    label: `+${UPGRADE.magSize} Mag Size`,
    apply: () => { g.upgrades.magSize++; },
  },
  {
    key: "rateOfFire",
    label: `+${UPGRADE.rateOfFire * 100}% Fire Rate`,
    apply: () => { g.upgrades.rateOfFire++; },
  },
  {
    key: "heatCapacity",
    label: `+${Math.round(UPGRADE.heatCapacity * 100)}% Heat Capacity`,
    apply: () => { g.upgrades.heatCapacity++; },
  },
  {
    key: "heatDecay",
    label: `+${Math.round(UPGRADE.heatDecay * 100)}% Cooling`,
    apply: () => { g.upgrades.heatDecay++; },
  },
  {
    key: "bloom",
    label: `-${Math.round(UPGRADE.bloomReduction * 100)}% Bloom`,
    apply: () => { g.upgrades.bloom++; },
  },
  {
    key: "moveSpread",
    label: `+${Math.round(UPGRADE.moveSpreadReduction * 100)}% Accuracy While Moving`,
    apply: () => { g.upgrades.moveSpread++; },
  },
  {
    key: "beamDamage",
    label: `+${UPGRADE.beamDamage} Beam Damage`,
    apply: () => { g.upgrades.beamDamage++; },
  },
  {
    key: "orbDamage",
    label: `+${UPGRADE.orbDamage} Orb Damage`,
    apply: () => { g.upgrades.orbDamage++; },
  },
  {
    key: "supplyDropRate",
    label: `+${Math.round(UPGRADE.supplyDropRate * 100)}% Supply Drop Rate`,
    apply: () => { g.upgrades.supplyDropRate++; },
  },
  {
    key: "critChance",
    label: `+${Math.round(UPGRADE.critChance * 100)}% Crit Chance`,
    apply: () => { g.upgrades.critChance++; },
  },
  {
    key: "critDamage",
    label: `+${UPGRADE.critDamage}x Crit Damage`,
    apply: () => { g.upgrades.critDamage++; },
  },
  {
    key: "orbSelfDamage",
    label: `-${Math.round(UPGRADE.orbSelfDamageReduction * 100)}% Orb Self-Damage`,
    apply: () => { g.upgrades.orbSelfDamage++; },
  },
  {
    key: "multishot",
    label: `+${Math.round(UPGRADE.multishotChance * 100)}% Multishot Chance`,
    apply: () => { g.upgrades.multishot++; },
  },
  {
    key: "ricochet",
    label: `+${Math.round(UPGRADE.ricochetChance * 100)}% Ricochet Chance`,
    apply: () => { g.upgrades.ricochet++; },
  },
  {
    key: "lightning",
    label: `+${Math.round(UPGRADE.lightningChance * 100)}% Lightning Chance`,
    apply: () => { g.upgrades.lightning++; },
  },
  {
    key: "ignite",
    label: `+${Math.round(UPGRADE.igniteChance * 100)}% Ignite Chance`,
    apply: () => { g.upgrades.ignite++; },
  },
];

// ─── Upgrade menu functions ─────────────────────────────────────────────────
function pickRandomUpgrades(): UpgradeDef[] {
  const shuffled = [...UPGRADE_DEFS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export function showUpgradeMenu(): void {
  const choices = pickRandomUpgrades();
  g.pendingUpgrades = choices.map((c) => c.key);
  for (let i = 0; i < 3; i++) {
    dom.upgradeLabels[i].textContent = choices[i].label;
    const n = g.upgrades[choices[i].key];
    dom.upgradeCounts[i].textContent = n > 0 ? `(${n}x)` : "";
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

export function selectUpgrade(index: number): void {
  if (g.pendingUpgrades.length === 0) return;
  const key = g.pendingUpgrades[index];
  const def = UPGRADE_DEFS.find((d) => d.key === key);
  if (def) def.apply();
  hideUpgradeMenu();
}
