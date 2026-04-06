import { Scene, FreeCamera, Vector3 } from "@babylonjs/core";
import { g, dom } from "./game.js";
import {
  createUI,
  showGameOver,
  optionsOpen,
  hideOptions,
  hidePause,
} from "./ui.js";
import { pause, resume } from "./flow.js";
import { initializeInput } from "./input.js";

// ─── Bootstrap ────────────────────────────────────────────────────────────────
g.scene = new Scene(g.engine);
new FreeCamera("menuCam", Vector3.Zero(), g.scene);
createUI();
initializeInput();

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
let previousRunning = g.state.running;

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
  if (previousRunning && !g.state.running) {
    showGameOver(g.state.wave, g.state.score, g.state.kills);
  }
  previousRunning = g.state.running;
  if (g.scene) g.scene.render();
});
window.addEventListener("resize", () => g.engine.resize());
