import {
  PLAYER_MAX_HEALTH,
  PLAYER_SPEED,
  PLAYER_RELOAD_TIME,
  PLAYER_MAG_SIZE,
  PLAYER_RATE_OF_FIRE,
  PLAYER_HEAT_MAX,
  PLAYER_HEAT_DECAY,
  PLAYER_SPREAD_PER_SHOT,
  PLAYER_MOVE_SPREAD_RATE,
  PLAYER_BEAM_DAMAGE,
  UPGRADE_MAX_HEALTH,
  UPGRADE_SPEED,
  UPGRADE_RELOAD_SPEED,
  UPGRADE_MAG_SIZE,
  UPGRADE_RATE_OF_FIRE,
  UPGRADE_HEAT_CAPACITY,
  UPGRADE_HEAT_DECAY,
  UPGRADE_BLOOM_REDUCTION,
  UPGRADE_MOVE_SPREAD_REDUCTION,
  UPGRADE_BEAM_DAMAGE,
  UPGRADE_SUPPLY_DROP_RATE,
  SUPPLY_DROP_RATE,
} from "./constants.js";
import { g, dom } from "./game.js";

// ─── Effective stat functions ─────────────────────────────────────────────────
export function effectiveMaxHealth(): number {
  return PLAYER_MAX_HEALTH + g.upgrades.maxHealth * UPGRADE_MAX_HEALTH;
}
export function effectiveSpeed(): number {
  return PLAYER_SPEED + g.upgrades.speed * UPGRADE_SPEED;
}
export function effectiveReloadTime(): number {
  return PLAYER_RELOAD_TIME * Math.pow(1 - UPGRADE_RELOAD_SPEED, g.upgrades.reloadTime);
}
export function effectiveMagSize(): number {
  return PLAYER_MAG_SIZE + g.upgrades.magSize * UPGRADE_MAG_SIZE;
}
export function effectiveRateOfFire(): number {
  return PLAYER_RATE_OF_FIRE + g.upgrades.rateOfFire * UPGRADE_RATE_OF_FIRE;
}
export function effectiveHeatMax(): number {
  return PLAYER_HEAT_MAX * (1 + g.upgrades.heatCapacity * UPGRADE_HEAT_CAPACITY);
}
export function effectiveHeatDecay(): number {
  return PLAYER_HEAT_DECAY * (1 + g.upgrades.heatDecay * UPGRADE_HEAT_DECAY);
}
export function effectiveBloom(): number {
  return PLAYER_SPREAD_PER_SHOT * Math.pow(1 - UPGRADE_BLOOM_REDUCTION, g.upgrades.bloom);
}
export function effectiveMoveSpreadRate(): number {
  return PLAYER_MOVE_SPREAD_RATE * Math.pow(1 - UPGRADE_MOVE_SPREAD_REDUCTION, g.upgrades.moveSpread);
}
export function effectiveBeamDamage(): number {
  return PLAYER_BEAM_DAMAGE + g.upgrades.beamDamage * UPGRADE_BEAM_DAMAGE;
}
export function effectiveSupplyDropRate(): number {
  return SUPPLY_DROP_RATE + g.upgrades.supplyDropRate * UPGRADE_SUPPLY_DROP_RATE;
}

// ─── HUD callback ─────────────────────────────────────────────────────────────
let _updateHUD: (() => void) | null = null;
export function setUpdateHUD(fn: () => void): void {
  _updateHUD = fn;
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
    label: `+${UPGRADE_MAX_HEALTH} Max Health`,
    apply: () => {
      g.upgrades.maxHealth++;
      g.state.health = Math.min(
        g.state.health + UPGRADE_MAX_HEALTH,
        effectiveMaxHealth(),
      );
      _updateHUD?.();
    },
  },
  {
    key: "speed",
    label: `+${UPGRADE_SPEED} Speed`,
    apply: () => { g.upgrades.speed++; },
  },
  {
    key: "reloadTime",
    label: `+${Math.round(UPGRADE_RELOAD_SPEED * 100)}% Reload Speed`,
    apply: () => { g.upgrades.reloadTime++; },
  },
  {
    key: "magSize",
    label: `+${UPGRADE_MAG_SIZE} Mag Size`,
    apply: () => { g.upgrades.magSize++; },
  },
  {
    key: "rateOfFire",
    label: `+${UPGRADE_RATE_OF_FIRE} RPM`,
    apply: () => { g.upgrades.rateOfFire++; },
  },
  {
    key: "heatCapacity",
    label: `+${Math.round(UPGRADE_HEAT_CAPACITY * 100)}% Heat Capacity`,
    apply: () => { g.upgrades.heatCapacity++; },
  },
  {
    key: "heatDecay",
    label: `+${Math.round(UPGRADE_HEAT_DECAY * 100)}% Cooling`,
    apply: () => { g.upgrades.heatDecay++; },
  },
  {
    key: "bloom",
    label: `-${Math.round(UPGRADE_BLOOM_REDUCTION * 100)}% Bloom`,
    apply: () => { g.upgrades.bloom++; },
  },
  {
    key: "moveSpread",
    label: `+${Math.round(UPGRADE_MOVE_SPREAD_REDUCTION * 100)}% Accuracy While Moving`,
    apply: () => { g.upgrades.moveSpread++; },
  },
  {
    key: "beamDamage",
    label: `+${UPGRADE_BEAM_DAMAGE} Beam Damage`,
    apply: () => { g.upgrades.beamDamage++; },
  },
  {
    key: "supplyDropRate",
    label: `+${Math.round(UPGRADE_SUPPLY_DROP_RATE * 100)}% Supply Drop Rate`,
    apply: () => { g.upgrades.supplyDropRate++; },
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
  dom.canvas.requestPointerLock();
}

export function selectUpgrade(index: number): void {
  if (g.pendingUpgrades.length === 0) return;
  const key = g.pendingUpgrades[index];
  const def = UPGRADE_DEFS.find((d) => d.key === key);
  if (def) def.apply();
  hideUpgradeMenu();
}
