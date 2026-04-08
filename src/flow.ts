import {
  g,
  dom,
  makeState,
  makeUpgradeState,
  makeWeaponAmmoState,
  releaseBayonetEmbed,
  restoreSprintLook,
} from "./game.js";
import { stopPlasmaChargeSound } from "./audio.js";
import { buildScene } from "./build.js";
import { updateHUD } from "./progression.js";
import { update, showWaveBanner } from "./update.js";
import { bindSceneInput } from "./input.js";
import { CAMERA } from "./constants.js";

export function endGame(): void {
  g.state.running = false;
  g.mouseHeld = false;
  g.mouse2Held = false;
  g.rifleScoped = false;
  g.rifleScopeAimT = 0;
  g.meleeHeld = false;
  g.bayonetCharging = false;
  g.bayonetChargeLockedUntilSprintEnd = false;
  g.bayonetChargeCooldownPending = false;
  releaseBayonetEmbed();
  g.appliedBayonetEmbedCameraPitch = 0;
  if (g.camera) g.camera.fov = CAMERA.defaultFov;
  if (g.camera) g.camera.angularSensibility = g.baseCameraAngularSensibility;
  g.isSprinting = false;
  restoreSprintLook();
  g.sprintRamp = 0;
  g.sprintRampDirection.set(0, 0, 0);
  g.sprintBlockedUntilShiftRelease = false;
  g.pressedKeys.clear();
  g.blasterRoot?.setEnabled(false);
  g.rifleRoot?.setEnabled(false);
  dom.speedLines.classList.remove("active");
  if (g.scopeOverlay) g.scopeOverlay.isVisible = false;
  dom.hud.classList.remove("scoped");
  dom.hud.style.display = "none";
  document.exitPointerLock();
}

export async function startGame(sensitivity: number): Promise<void> {
  dom.upgradeMenu.classList.remove("visible");
  dom.speedLines.classList.remove("active");
  if (g.scopeOverlay) g.scopeOverlay.isVisible = false;
  dom.hud.classList.remove("scoped");
  dom.hud.style.display = "block";
  g.upgrades = makeUpgradeState();
  g.weaponAmmo = makeWeaponAmmoState();
  g.recoilPitch = 0;
  g.recoilRoll = 0;
  g.cameraRecoilPitch = 0;
  g.appliedCameraRecoilPitch = 0;
  g.rifleBloomRecoilHoldTimer = 0;
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
  g.rifleScoped = false;
  g.rifleScopeAimT = 0;
  g.meleeHeld = false;
  g.bayonetCharging = false;
  g.bayonetChargeLockedUntilSprintEnd = false;
  g.bayonetChargeCooldownPending = false;
  releaseBayonetEmbed();
  g.appliedBayonetEmbedCameraPitch = 0;
  if (g.camera) g.camera.fov = CAMERA.defaultFov;
  if (g.camera) g.camera.angularSensibility = g.baseCameraAngularSensibility;
  g.isSprinting = false;
  restoreSprintLook();
  g.sprintRamp = 0;
  g.sprintRampDirection.set(0, 0, 0);
  g.sprintBlockedUntilShiftRelease = false;
  g.queuedSupplyDrops = [];
  for (const p of g.plasmas) p.mesh.dispose();
  g.plasmas = [];

  g.state = makeState();
  await buildScene();
  g.baseCameraAngularSensibility = 2200 - sensitivity * 20;
  g.camera.angularSensibility = g.baseCameraAngularSensibility;
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
  g.mouse2Held = false;
  g.rifleScoped = false;
  g.rifleScopeAimT = 0;
  g.meleeHeld = false;
  g.bayonetCharging = false;
  g.bayonetChargeLockedUntilSprintEnd = false;
  g.bayonetChargeCooldownPending = false;
  releaseBayonetEmbed();
  g.appliedBayonetEmbedCameraPitch = 0;
  if (g.camera) g.camera.fov = CAMERA.defaultFov;
  if (g.camera) g.camera.angularSensibility = g.baseCameraAngularSensibility;
  g.isSprinting = false;
  restoreSprintLook();
  g.sprintRamp = 0;
  g.sprintRampDirection.set(0, 0, 0);
  g.sprintBlockedUntilShiftRelease = false;
  g.pressedKeys.clear();
  g.scene.physicsEnabled = false;
  g.camera.detachControl();
  dom.speedLines.classList.remove("active");
  if (g.scopeOverlay) g.scopeOverlay.isVisible = false;
  dom.hud.classList.remove("scoped");
  dom.hud.classList.add("paused");
  if (g.audioCtx) g.audioCtx.suspend();
}

export function resume(): void {
  g.state.paused = false;
  g.scene.physicsEnabled = true;
  g.camera.attachControl(dom.canvas, true);
  dom.hud.classList.remove("paused");
  if (g.audioCtx) g.audioCtx.resume();
  if (g.pendingUpgrades.length > 0) {
    dom.upgradeMenu.classList.add("visible");
    document.exitPointerLock();
  }
}
