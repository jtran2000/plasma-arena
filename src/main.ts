import { PointerEventTypes, ActionManager, ExecuteCodeAction } from "@babylonjs/core";
import { g, dom, makeState } from "./game.js";
import { buildScene } from "./build.js";
import {
  update,
  tryJump,
  shoot,
  startReload,
  updateHUD,
  pause,
  resume,
  showWaveBanner,
  selectUpgrade,
  effectiveRateOfFire,
} from "./update.js";

// ─── Key tracking ─────────────────────────────────────────────────────────────
window.addEventListener("keydown", (e) => g.pressedKeys.add(e.code));
window.addEventListener("keyup", (e) => g.pressedKeys.delete(e.code));

// ─── Input setup ──────────────────────────────────────────────────────────────
function setupInput(): void {
  g.scene.onPointerObservable.add((info) => {
    if (info.event.button !== 0) return;
    if (info.type === PointerEventTypes.POINTERDOWN) {
      g.mouseHeld = true;
      shoot();
      g.state.shootCooldown = 60000 / effectiveRateOfFire();
    } else if (info.type === PointerEventTypes.POINTERUP) {
      g.mouseHeld = false;
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
  dom.upgradeMenu.classList.remove("visible");
  dom.hud.style.display = "block";
  g.upgrades = { maxHealth: 0, speed: 0, reloadTime: 0, magSize: 0, rateOfFire: 0, heatCapacity: 0, heatDecay: 0, bloom: 0, moveSpread: 0, damage: 0 };
  g.pendingUpgrades = [];

  g.state = makeState();
  await buildScene();
  setupInput();
  g.scene.registerBeforeRender(update);
  g.state.running = true;
  updateHUD();
  showWaveBanner("Wave 1");

  g.camera.attachControl(dom.canvas, true);
  dom.canvas.requestPointerLock();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
dom.startBtn.addEventListener("click", () => startGame().catch(console.error));
dom.restartBtn.addEventListener("click", () => startGame().catch(console.error));

dom.canvas.addEventListener("click", () => {
  if (g.state.running && !g.state.paused && document.pointerLockElement !== dom.canvas) {
    dom.canvas.requestPointerLock();
  }
});

dom.pauseScreen.addEventListener("click", () => {
  if (g.state.running && g.state.paused) dom.canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  if (!g.state.running) return;
  if (document.pointerLockElement === dom.canvas) {
    if (g.state.paused) resume();
  } else {
    if (g.pendingUpgrades.length === 0) pause();
  }
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && g.state.running && !g.state.paused && g.pendingUpgrades.length > 0) {
    dom.upgradeMenu.classList.remove("visible");
    pause();
  }
});

g.engine.runRenderLoop(() => {
  if (g.scene) g.scene.render();
});
window.addEventListener("resize", () => g.engine.resize());
