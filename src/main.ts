import { PointerEventTypes, ActionManager, ExecuteCodeAction } from "@babylonjs/core";
import { PLAYER_SHOOT_COOLDOWN_MS } from "./constants.js";
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
      g.state.shootCooldown = PLAYER_SHOOT_COOLDOWN_MS;
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
  });
}

// ─── Game flow ────────────────────────────────────────────────────────────────
async function startGame(): Promise<void> {
  dom.overlay.style.display = "none";
  dom.gameOver.style.display = "none";
  dom.pauseScreen.style.display = "none";
  dom.hud.style.display = "block";

  g.state = makeState();
  await buildScene();
  setupInput();
  g.scene.registerBeforeRender(update);
  g.state.running = true;
  updateHUD();

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
    pause();
  }
});

g.engine.runRenderLoop(() => {
  if (g.scene) g.scene.render();
});
window.addEventListener("resize", () => g.engine.resize());
