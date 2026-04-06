import {
  PointerEventTypes,
  ActionManager,
  ExecuteCodeAction,
  Scene,
  FreeCamera,
  Vector3,
} from "@babylonjs/core";
import { g, dom, makeState, setGameOverCallback } from "./game.js";
import { stopPlasmaChargeSound } from "./audio.js";
import { buildScene } from "./build.js";
import {
  tryJump,
  shoot,
  startPlasmaCharge,
  releasePlasmaCharge,
  dumpPlasmaCharge,
  startReload,
} from "./actions.js";
import { updateHUD, selectUpgrade } from "./upgrades.js";
import { update, showWaveBanner } from "./update.js";
import {
  createUI,
  setOnPlay,
  setOnRestart,
  hideStart,
  showPause,
  hidePause,
  showGameOver,
  optionsOpen,
  hideOptions,
  getSensitivityValue,
} from "./ui.js";

// ─── Key tracking ─────────────────────────────────────────────────────────────
window.addEventListener("keydown", (e) => g.pressedKeys.add(e.code));
window.addEventListener("keyup", (e) => g.pressedKeys.delete(e.code));

// ─── Input setup ──────────────────────────────────────────────────────────────
function setupInput(): void {
  g.scene.onPointerObservable.add((info) => {
    if (g.state.paused) return;
    if (info.event.button === 0) {
      if (info.type === PointerEventTypes.POINTERDOWN) {
        g.mouseHeld = true;
        if (g.plasmaCharging) {
          dumpPlasmaCharge();
          return;
        }
        shoot();
      } else if (info.type === PointerEventTypes.POINTERUP) {
        g.mouseHeld = false;
      }
    } else if (info.event.button === 2) {
      if (info.type === PointerEventTypes.POINTERDOWN) {
        g.mouse2Held = true;
        startPlasmaCharge();
      } else if (info.type === PointerEventTypes.POINTERUP) {
        g.mouse2Held = false;
        if (g.plasmaCharging) releasePlasmaCharge();
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
    laserDamage: 0,
    plasmaDamage: 0,
    supplyDropRate: 0,
    critChance: 0,
    critDamage: 0,
    plasmaSelfDamage: 0,
    multishot: 0,
    ricochet: 0,
    lightning: 0,
    ignite: 0,
    pulseLaser: false,
    plasmaCaster: false,
    plasmaCharger: false,
    plasmaGrenadier: false,
  };
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
  for (const p of g.plasmas) p.mesh.dispose();
  g.plasmas = [];

  g.state = makeState();
  await buildScene();
  createUI();
  hideStart();
  g.camera.angularSensibility = 2200 - getSensitivityValue() * 20;
  setupInput();
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

// ─── Bootstrap ────────────────────────────────────────────────────────────────
g.scene = new Scene(g.engine);
new FreeCamera("menuCam", Vector3.Zero(), g.scene);
createUI();

setOnPlay(() => startGame().catch(console.error));
setOnRestart(() => startGame().catch(console.error));
setGameOverCallback(() => {
  showGameOver(g.state.wave, g.state.score, g.state.kills);
});

dom.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

dom.canvas.addEventListener("click", () => {
  if (optionsOpen()) return;
  if (g.pendingUpgrades.length > 0) return;
  if (
    g.state.running &&
    !g.state.paused &&
    document.pointerLockElement !== dom.canvas
  ) {
    dom.canvas.requestPointerLock({ unadjustedMovement: true });
  }
});

let escapePaused = false;

document.addEventListener("pointerlockchange", () => {
  if (!g.state.running) return;
  if (optionsOpen()) return;
  if (document.pointerLockElement === dom.canvas) {
    if (g.state.paused) resume();
  } else {
    if (escapePaused) {
      escapePaused = false;
    } else if (g.pendingUpgrades.length === 0) {
      pause();
    }
  }
});

document.addEventListener("pointerlockerror", () => {
  hidePause();
  setTimeout(() => {
    dom.canvas.requestPointerLock({ unadjustedMovement: true });
  }, 500);
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && optionsOpen()) {
    hideOptions();
    return;
  }
  if (e.code === "Escape" && g.state.running && !g.state.paused) {
    if (g.pendingUpgrades.length > 0) {
      dom.upgradeMenu.classList.remove("visible");
    }
    escapePaused = true;
    pause();
    document.exitPointerLock();
  }
});

g.engine.runRenderLoop(() => {
  if (g.scene) g.scene.render();
});
window.addEventListener("resize", () => g.engine.resize());
