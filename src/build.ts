import {
  Scene,
  UniversalCamera,
  Vector3,
  HemisphericLight,
  SpotLight,
  Color3,
  Color4,
  ShadowGenerator,
  DynamicTexture,
  HavokPlugin,
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { g } from "./game.js";
import {
  makePlayerMesh,
  setupArenaFloor, setupArenaCeil, setupArenaWalls, setupArenaPillars, setupArenaCrates, setupArenaAccentStrips,
  setupWeaponRoot, setupWeaponParts, setupLamppost,
} from "./meshBuilders.js";

// ─── Scene builder ────────────────────────────────────────────────────────────
export async function buildScene(): Promise<void> {
  if (g.scene) g.scene.dispose();
  g.enemies = [];
  g.bulletHoles = [];
  g.bulletHoleTimes = [];
  g.glowingHoles = [];
  for (const p of g.pickups) { p.aggregate.dispose(); p.mesh.dispose(); }
  g.pickups = [];
  g.playerVelocityXZ = Vector3.Zero();
  g.pressedKeys.clear();

  g.scene = new Scene(g.engine);
  g.scene.setRenderingAutoClearDepthStencil(1, true);
  g.scene.clearColor = new Color4(0.05, 0.05, 0.1, 1);
  g.scene.fogMode = Scene.FOGMODE_EXP2;
  g.scene.fogColor = new Color3(0.05, 0.05, 0.1);
  g.scene.fogDensity = 0.035;

  // Camera must exist before the first render — create before the async Havok await
  g.camera = new UniversalCamera("fps", new Vector3(0, 1.6, 0), g.scene);
  g.camera.setTarget(new Vector3(1, 1.6, 0));
  g.camera.minZ = 0.1;
  g.camera.fov = 1.2;
  g.camera.angularSensibility = 800;
  g.camera.keysUp = g.camera.keysDown = g.camera.keysLeft = g.camera.keysRight = [];

  const havok = await HavokPhysics();
  const havokPlugin = new HavokPlugin(true, havok);
  g.scene.enablePhysics(new Vector3(0, -20, 0), havokPlugin);

  const player = makePlayerMesh();
  g.playerMesh = player.mesh;
  g.playerAggregate = player.aggregate;

  const ambient = new HemisphericLight("amb", new Vector3(0, 1, 0), g.scene);
  ambient.intensity = 0.15;
  ambient.groundColor = new Color3(0.03, 0.03, 0.06);

  const { lightY } = setupLamppost();

  const lamp = new SpotLight("lamp", new Vector3(0, lightY, 0), new Vector3(0, -1, 0), Math.PI * 0.8, 1.5, g.scene);
  lamp.intensity = 2.0;
  lamp.diffuse = new Color3(1, 0.9, 0.7);
  lamp.range = 35;

  g.shadowGenerator = new ShadowGenerator(1024, lamp);
  g.shadowGenerator.useBlurExponentialShadowMap = true;

  g.particleTex = new DynamicTexture("ptex", { width: 32, height: 32 }, g.scene, false);
  const ctx = g.particleTex.getContext();
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, Math.PI * 2);
  ctx.fill();
  g.particleTex.update();

  buildArena();
  buildWeapon();
}

// ─── Arena ────────────────────────────────────────────────────────────────────
function buildArena(): void {
  setupArenaFloor();
  setupArenaCeil();
  setupArenaWalls();

  for (const pillar of setupArenaPillars()) {
    g.shadowGenerator.addShadowCaster(pillar);
  }

  for (const crate of setupArenaCrates()) {
    g.shadowGenerator.addShadowCaster(crate);
  }

  setupArenaAccentStrips();
}

// ─── Weapon model ─────────────────────────────────────────────────────────────
function buildWeapon(): void {
  g.weaponRoot = setupWeaponRoot();
  const { cell, barrel, barrelTip } = setupWeaponParts(g.weaponRoot);
  g.weaponCell = cell;
  g.weaponBarrel = barrel;
  g.barrelTip = barrelTip;
}

