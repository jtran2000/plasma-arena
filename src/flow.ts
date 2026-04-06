import {
  g,
  dom,
  makeState,
  makeUpgradeState,
  makeWeaponAmmoState,
} from "./game.js";
import { stopPlasmaChargeSound } from "./audio.js";
import { buildScene } from "./build.js";
import { updateHUD } from "./progression.js";
import { update, showWaveBanner } from "./update.js";
import { bindSceneInput } from "./input.js";
import {
  createUI,
  hideGameOver,
  hidePause,
  hideStart,
  showPause,
  getSensitivityValue,
} from "./ui.js";

export async function startGame(): Promise<void> {
  dom.upgradeMenu.classList.remove("visible");
  dom.hud.style.display = "block";
  g.upgrades = makeUpgradeState();
  g.weaponAmmo = makeWeaponAmmoState();
  g.recoilPitch = 0;
  g.recoilRoll = 0;
  g.cameraRecoilPitch = 0;
  g.appliedCameraRecoilPitch = 0;
  g.crosshairRecoil = 0;
  g.pendingUpgrades = [];
  if (g.plasmaCharging) {
    stopPlasmaChargeSound();
    if (g.plasmaChargeMesh) {
      g.plasmaChargeMesh.dispose();
      g.plasmaChargeMesh = null;
    }
    g.plasmaCharging = false;
  }
  g.plasmaChargeCrit = false;
  g.mouse2Held = false;
  g.queuedSupplyDrops = [];
  for (const p of g.plasmas) p.mesh.dispose();
  g.plasmas = [];

  g.state = makeState();
  await buildScene();
  createUI();
  hideStart();
  hideGameOver();
  g.camera.angularSensibility = 2200 - getSensitivityValue() * 20;
  bindSceneInput();
  g.scene.registerBeforeRender(update);
  g.state.running = true;
  updateHUD();
  showWaveBanner("Wave 1");

  g.camera.attachControl(dom.canvas, true);
  dom.canvas.requestPointerLock({ unadjustedMovement: true });
}

export function pause(): void {
  g.state.paused = true;
  g.mouseHeld = false;
  g.pressedKeys.clear();
  g.scene.physicsEnabled = false;
  g.camera.detachControl();
  showPause();
  dom.hud.classList.add("paused");
  if (g.audioCtx) g.audioCtx.suspend();
}

export function resume(): void {
  g.state.paused = false;
  g.scene.physicsEnabled = true;
  g.camera.attachControl(dom.canvas, true);
  hidePause();
  dom.hud.classList.remove("paused");
  if (g.audioCtx) g.audioCtx.resume();
  if (g.pendingUpgrades.length > 0) {
    dom.upgradeMenu.classList.add("visible");
    document.exitPointerLock();
  }
}
