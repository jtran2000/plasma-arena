import {
  ActionManager,
  ExecuteCodeAction,
  PointerEventTypes,
} from "@babylonjs/core";
import { g, dom } from "./game.js";
import {
  dumpPlasmaCharge,
  meleeAttack,
  releasePlasmaCharge,
  shoot,
  startPlasmaCharge,
  startReload,
  switchWeapon,
  tryJump,
} from "./actions.js";
import { selectUpgrade } from "./progression.js";

let initialized = false;

export function initializeInput(): void {
  if (initialized) return;
  initialized = true;

  window.addEventListener("keydown", (e) => g.pressedKeys.add(e.code));
  window.addEventListener("keyup", (e) => g.pressedKeys.delete(e.code));

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

  dom.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  dom.canvas.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) < 1) return;
    e.preventDefault();
    switchWeapon();
  });
}

export function bindSceneInput(): void {
  g.scene.onPointerObservable.clear();
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
    } else if (info.event.button === 1) {
      if (info.type === PointerEventTypes.POINTERDOWN) {
        g.meleeHeld = true;
        meleeAttack();
      } else if (info.type === PointerEventTypes.POINTERUP) {
        g.meleeHeld = false;
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
}
