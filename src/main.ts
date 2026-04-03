import {
  PointerEventTypes,
  ActionManager,
  ExecuteCodeAction,
} from "@babylonjs/core";
import { g, dom, makeState } from "./game.js";
import { stopOrbChargeSound } from "./audio.js";
import { AUDIO } from "./constants.js";
import { buildScene } from "./build.js";
import {
  tryJump,
  shoot,
  startOrbCharge,
  releaseOrbCharge,
  dumpOrbCharge,
  startReload,
} from "./actions.js";
import { updateHUD, selectUpgrade } from "./upgrades.js";
import { update, showWaveBanner } from "./update.js";

// ─── Key tracking ─────────────────────────────────────────────────────────────
window.addEventListener("keydown", (e) => g.pressedKeys.add(e.code));
window.addEventListener("keyup", (e) => g.pressedKeys.delete(e.code));

// ─── Input setup ──────────────────────────────────────────────────────────────
function setupInput(): void {
  g.scene.onPointerObservable.add((info) => {
    if (info.event.button === 0) {
      if (info.type === PointerEventTypes.POINTERDOWN) {
        g.mouseHeld = true;
        if (g.orbCharging) {
          dumpOrbCharge();
          return;
        }
        shoot();
      } else if (info.type === PointerEventTypes.POINTERUP) {
        g.mouseHeld = false;
      }
    } else if (info.event.button === 2) {
      if (info.type === PointerEventTypes.POINTERDOWN) {
        g.mouse2Held = true;
        startOrbCharge();
      } else if (info.type === PointerEventTypes.POINTERUP) {
        g.mouse2Held = false;
        if (g.orbCharging) releaseOrbCharge();
      }
    }
  });

  g.scene.actionManager = new ActionManager(g.scene);
  g.scene.actionManager.registerAction(
    new ExecuteCodeAction(
      { trigger: ActionManager.OnKeyDownTrigger, parameter: "r" },
      () => startReload(),
    ),
  );
  g.scene.actionManager.registerAction(
    new ExecuteCodeAction(
      { trigger: ActionManager.OnKeyDownTrigger, parameter: "R" },
      () => startReload(),
    ),
  );

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      tryJump();
    }
    if (e.code === "Digit1") selectUpgrade(0);
    if (e.code === "Digit2") selectUpgrade(1);
    if (e.code === "Digit3") selectUpgrade(2);
  });

  for (const btn of dom.upgradeButtons) {
    btn.addEventListener("click", () => {
      selectUpgrade(Number(btn.dataset.index));
    });
  }
}

// ─── Game flow ────────────────────────────────────────────────────────────────
async function startGame(): Promise<void> {
  dom.overlay.style.display = "none";
  dom.gameOver.style.display = "none";
  dom.pauseScreen.style.display = "none";
  dom.optionsScreen.style.display = "none";
  dom.upgradeMenu.classList.remove("visible");
  dom.hud.style.display = "block";
  g.upgrades = {
    maxHealth: 0,
    speed: 0,
    reloadTime: 0,
    magSize: 0,
    rateOfFire: 0,
    heatCapacity: 0,
    heatDecay: 0,
    bloom: 0,
    moveSpread: 0,
    beamDamage: 0,
    orbDamage: 0,
    supplyDropRate: 0,
    critChance: 0,
    critDamage: 0,
    orbSelfDamage: 0,
    multishot: 0,
    ricochet: 0,
    lightning: 0,
    ignite: 0,
  };
  g.pendingUpgrades = [];
  if (g.orbCharging) {
    stopOrbChargeSound();
    if (g.orbChargeMesh) {
      g.orbChargeMesh.dispose();
      g.orbChargeMesh = null;
    }
    g.orbCharging = false;
  }
  g.orbChargeCrit = false;
  g.mouse2Held = false;
  for (const orb of g.orbs) orb.mesh.dispose();
  g.orbs = [];

  g.state = makeState();
  await buildScene();
  g.camera.angularSensibility = 2200 - Number(dom.sensitivitySlider.value) * 20;
  setupInput();
  g.scene.registerBeforeRender(update);
  g.state.running = true;
  updateHUD();
  showWaveBanner("Wave 1");

  g.camera.attachControl(dom.canvas, true);
  dom.canvas.requestPointerLock();
}

export function pause(): void {
  g.state.paused = true;
  g.mouseHeld = false;
  g.pressedKeys.clear();
  g.scene.physicsEnabled = false;
  dom.pauseScreen.style.display = "flex";
  dom.hud.classList.add("paused");
}

export function resume(): void {
  g.state.paused = false;
  g.scene.physicsEnabled = true;
  dom.pauseScreen.style.display = "none";
  dom.hud.classList.remove("paused");
  if (g.pendingUpgrades.length > 0) {
    dom.upgradeMenu.classList.add("visible");
    document.exitPointerLock();
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
dom.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
dom.startBtn.addEventListener("click", () => startGame().catch(console.error));
dom.restartBtn.addEventListener("click", () =>
  startGame().catch(console.error),
);

function optionsOpen(): boolean {
  return dom.optionsScreen.style.display === "flex";
}

dom.canvas.addEventListener("click", () => {
  if (optionsOpen()) return;
  if (
    g.state.running &&
    !g.state.paused &&
    document.pointerLockElement !== dom.canvas
  ) {
    dom.canvas.requestPointerLock();
  }
});

dom.pauseScreen.addEventListener("click", (e) => {
  if (
    e.target === dom.pauseScreen &&
    g.state.running &&
    g.state.paused &&
    !optionsOpen()
  ) {
    dom.canvas.requestPointerLock();
  }
});

document.addEventListener("pointerlockchange", () => {
  if (!g.state.running) return;
  if (optionsOpen()) return;
  if (document.pointerLockElement === dom.canvas) {
    if (g.state.paused) resume();
  } else {
    if (g.pendingUpgrades.length === 0) pause();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && optionsOpen()) {
    dom.optionsScreen.style.display = "none";
    if (optionsFrom === "start") {
      dom.overlay.style.display = "flex";
    } else {
      dom.pauseScreen.style.display = "flex";
    }
    return;
  }
  if (
    e.code === "Escape" &&
    g.state.running &&
    !g.state.paused &&
    g.pendingUpgrades.length > 0
  ) {
    dom.upgradeMenu.classList.remove("visible");
    pause();
  }
});

// ─── Options menu ────────────────────────────────────────────────────────────
const savedVolume = localStorage.getItem("fps_volume");
const savedSensitivity = localStorage.getItem("fps_sensitivity");
if (savedVolume !== null) {
  dom.volumeSlider.value = savedVolume;
  dom.volumeValue.textContent = savedVolume;
}
if (savedSensitivity !== null) {
  dom.sensitivitySlider.value = savedSensitivity;
  dom.sensitivityValue.textContent = savedSensitivity;
}

let optionsFrom: "pause" | "start" = "pause";

dom.optionsBtn.addEventListener("click", () => {
  optionsFrom = "pause";
  dom.pauseScreen.style.display = "none";
  dom.optionsScreen.style.display = "flex";
});

dom.startOptionsBtn.addEventListener("click", () => {
  optionsFrom = "start";
  dom.overlay.style.display = "none";
  dom.optionsScreen.style.display = "flex";
});

dom.optionsBackBtn.addEventListener("click", () => {
  dom.optionsScreen.style.display = "none";
  if (optionsFrom === "start") {
    dom.overlay.style.display = "flex";
  } else {
    dom.pauseScreen.style.display = "flex";
  }
});

dom.volumeSlider.addEventListener("input", () => {
  const val = Number(dom.volumeSlider.value);
  dom.volumeValue.textContent = String(val);
  if (g.masterGain)
    g.masterGain.gain.value = (val / 100) * AUDIO.masterVolumeMult;
  localStorage.setItem("fps_volume", String(val));
});

dom.sensitivitySlider.addEventListener("input", () => {
  const val = Number(dom.sensitivitySlider.value);
  dom.sensitivityValue.textContent = String(val);
  if (g.camera) g.camera.angularSensibility = 2200 - val * 20;
  localStorage.setItem("fps_sensitivity", String(val));
});

g.engine.runRenderLoop(() => {
  if (g.scene) g.scene.render();
});
window.addEventListener("resize", () => g.engine.resize());
