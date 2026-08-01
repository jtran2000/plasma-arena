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
  DefaultRenderingPipeline,
} from "@babylonjs/core";
import type { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas.js";
import { AdvancedDynamicTexture, Control } from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";
import { g } from "./game.js";
import { CAMERA, LIGHTING, RIFLE } from "./constants.js";
import {
  makePlayerMesh,
  getRifleScopeOpeningRadius,
  setupArenaFloor,
  setupArenaCeil,
  setupArenaWalls,
  setupArenaPillars,
  setupArenaCrates,
  setupArenaAccentStrips,
  setupWeaponRoot,
  setupWeaponParts,
  setupRifleParts,
  setupRifleRoot,
  setupShotgunRoot,
  setupShotgunParts,
  setupLamppost,
} from "./spawn.js";

function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function getScopePictureRadiusPxForFov(
  measure: {
    width: number;
    height: number;
  },
  fov: number,
): number {
  const fallback =
    Math.min(measure.width, measure.height) * RIFLE.SCOPE.pictureRadiusScale;
  if (!g.rifleScope || !g.camera) return fallback;

  const frontRim = g.rifleScope
    .getChildMeshes(false)
    .find((child) => child.name === "rScopeFrontRim");
  if (!frontRim) return fallback;

  const center = frontRim.getAbsolutePosition();
  const toCenter = center.subtract(g.camera.position);
  const depth = Vector3.Dot(toCenter, g.camera.getForwardRay().direction);
  if (depth <= Number.EPSILON) return fallback;

  const pixelsPerMeter =
    g.engine.getRenderHeight() / (2 * Math.tan(fov / 2) * depth);
  return getRifleScopeOpeningRadius() * pixelsPerMeter;
}

function getScopePictureTargetRadiusPx(measure: {
  width: number;
  height: number;
}): number {
  return getScopePictureRadiusPxForFov(measure, g.camera.fov);
}

class ScopeOverlayControl extends Control {
  public constructor() {
    super("scopeOverlay");
    this.width = "100%";
    this.height = "100%";
    this.isHitTestVisible = false;
    this.isVisible = false;
  }

  public _draw(context: ICanvasRenderingContext): void {
    const measure = this._currentMeasure;
    const cx = measure.left + measure.width / 2;
    // Scoped rifle recoil shifts the visible scope picture with the same
    // screen-space offset used by the rifle crosshair.
    const cy = measure.top + measure.height / 2 - g.crosshairRecoil;
    const overlayAlpha = smoothstep(g.rifleScopeZoomT);
    if (overlayAlpha <= Number.EPSILON) return;
    const startRadius = getScopePictureRadiusPxForFov(
      measure,
      CAMERA.defaultFov,
    );
    const targetRadius = getScopePictureTargetRadiusPx(measure);
    const radius = startRadius + (targetRadius - startRadius) * overlayAlpha;

    context.save();
    (context as unknown as CanvasRenderingContext2D).globalAlpha = overlayAlpha;
    context.fillStyle = RIFLE.SCOPE.overlayFill;
    context.fillRect(measure.left, measure.top, measure.width, measure.height);
    context.restore();

    context.save();
    (context as unknown as CanvasRenderingContext2D).globalCompositeOperation =
      "destination-out";
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    (context as unknown as CanvasRenderingContext2D).globalAlpha = overlayAlpha;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.clip();
    context.strokeStyle = "rgba(0,0,0,0.95)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(cx, cy - radius);
    context.lineTo(cx, cy + radius);
    context.moveTo(cx - radius, cy);
    context.lineTo(cx + radius, cy);
    context.stroke();
    context.restore();
  }
}

// ─── Scene builder ────────────────────────────────────────────────────────────
export async function buildScene(): Promise<void> {
  if (g.scene) g.scene.dispose();
  g.enemies = [];
  for (const bullet of g.rifleBullets) bullet.mesh.dispose();
  g.rifleBullets = [];
  g.bulletHoles = [];
  g.bulletHoleTimes = [];
  g.glowingHoles = [];
  for (const p of g.supplies) {
    p.aggregate.dispose();
    p.mesh.dispose();
  }
  g.supplies = [];
  g.playerVelocityXZ = Vector3.Zero();
  g.pressedKeys.clear();

  g.scene = new Scene(g.engine);
  g.scene.setRenderingAutoClearDepthStencil(1, true);
  g.scene.clearColor = new Color4(0.05, 0.05, 0.1, 1);
  g.scene.fogMode = Scene.FOGMODE_EXP2;
  g.scene.fogColor = new Color3(0.05, 0.05, 0.1);
  g.scene.fogDensity = LIGHTING.fogDensity;

  // Camera must exist before the first render — create before the async Havok await
  g.camera = new UniversalCamera("fps", new Vector3(0, 1.66, 0), g.scene);
  g.camera.setTarget(new Vector3(1, 1.66, 0));
  g.camera.minZ = CAMERA.nearZ;
  g.camera.fov = CAMERA.defaultFov;
  g.baseCameraAngularSensibility = 800;
  g.camera.angularSensibility = g.baseCameraAngularSensibility;
  g.camera.keysUp =
    g.camera.keysDown =
    g.camera.keysLeft =
    g.camera.keysRight =
      [];

  const havok = await HavokPhysics();
  const havokPlugin = new HavokPlugin(true, havok);
  g.scene.enablePhysics(new Vector3(0, -20, 0), havokPlugin);

  const player = makePlayerMesh();
  g.playerMesh = player.mesh;
  g.playerAggregate = player.aggregate;

  const ambient = new HemisphericLight("amb", new Vector3(0, 1, 0), g.scene);
  ambient.intensity = LIGHTING.ambientIntensity;
  ambient.groundColor = new Color3(
    LIGHTING.ambientGroundR,
    LIGHTING.ambientGroundG,
    LIGHTING.ambientGroundB,
  );

  const { lightY } = setupLamppost();

  const lamp = new SpotLight(
    "lamp",
    new Vector3(0, lightY, 0),
    new Vector3(0, -1, 0),
    LIGHTING.spotAngle,
    LIGHTING.spotExponent,
    g.scene,
  );
  lamp.intensity = LIGHTING.spotIntensity;
  lamp.diffuse = new Color3(1, 0.9, 0.7);
  lamp.range = LIGHTING.spotRange;

  g.shadowGenerator = new ShadowGenerator(1024, lamp);
  g.shadowGenerator.useBlurExponentialShadowMap = true;

  const headlamp = new SpotLight(
    "headlamp",
    Vector3.Zero(),
    Vector3.Forward(),
    LIGHTING.headlampAngle,
    LIGHTING.headlampExponent,
    g.scene,
  );
  headlamp.intensity = LIGHTING.headlampIntensity;
  headlamp.diffuse = new Color3(0.95, 0.95, 1);
  headlamp.range = LIGHTING.headlampRange;
  headlamp.parent = g.camera;

  g.particleTex = new DynamicTexture(
    "ptex",
    { width: 32, height: 32 },
    g.scene,
    false,
  );
  const ctx = g.particleTex.getContext();
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, Math.PI * 2);
  ctx.fill();
  g.particleTex.update();

  buildArena();
  buildWeapon();
  setupScopeOverlay();
  setupPostProcessing();
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
  g.blasterRoot = setupWeaponRoot();
  const blaster = setupWeaponParts(g.blasterRoot);
  g.blasterCell = blaster.cell;
  g.blasterBarrel = blaster.barrel;
  g.blasterBarrelTip = blaster.barrelTip;

  g.rifleRoot = setupRifleRoot();
  const rifle = setupRifleParts(g.rifleRoot);
  g.rifleAssembly = rifle.assembly;
  g.rifleAssemblyBasePosition = rifle.assembly.position.clone();
  g.rifleAssemblyBasePitch = rifle.assembly.rotation.x;
  g.rifleAssemblyBaseYaw = rifle.assembly.rotation.y;
  g.rifleMag = rifle.mag;
  g.rifleBarrel = rifle.barrel;
  g.rifleBarrelBasePosition = rifle.barrel.position.clone();
  g.rifleBarrelBaseScaling = rifle.barrel.scaling.clone();
  g.rifleBarrelTip = rifle.barrelTip;
  g.rifleBrake = rifle.brake;
  g.rifleBrakeBasePosition = rifle.brake.position.clone();
  g.rifleBrakeBaseScaling = rifle.brake.scaling.clone();
  g.rifleScope = rifle.scope;
  g.rifleLaserSight = rifle.laserSight;
  g.rifleLaserSightBasePosition = rifle.laserSight.position.clone();
  g.rifleLaserSightBaseScaling = rifle.laserSight.scaling.clone();
  g.rifleLaserLight = rifle.laserLight;
  g.rifleLaserGlow = rifle.laserGlow;
  g.rifleLaserDot = rifle.laserDot;
  g.rifleBayonet = rifle.bayonet;
  g.rifleBayonetBasePosition = rifle.bayonet.position.clone();
  g.rifleBayonetBaseScaling = rifle.bayonet.scaling.clone();
  g.rifleBrake.isVisible = g.upgrades.muzzleBrake;
  g.rifleScope.setEnabled(g.upgrades.rifleScope);
  g.rifleLaserSight.setEnabled(g.upgrades.rifleLaserSight);
  g.rifleLaserDot.setEnabled(false);
  g.rifleBayonet.setEnabled(g.upgrades.bayonet);

  g.shotgunRoot = setupShotgunRoot();
  const shotgun = setupShotgunParts(g.shotgunRoot);
  g.shotgunBarrel = shotgun.barrel;
  g.shotgunBarrelTip = shotgun.barrelTip;
  g.shotgunPump = shotgun.pump;
  g.shotgunPumpBasePosition = shotgun.pump.position.clone();
  g.shotgunMag = shotgun.mag;

  g.blasterRoot.setEnabled(false);
  g.rifleRoot.setEnabled(false);
  g.shotgunRoot.setEnabled(false);

  if (g.state.activeWeapon === "shotgun" && g.upgrades.shotgunUnlock) {
    g.weaponRoot = g.shotgunRoot;
    g.weaponCell = g.shotgunMag;
    g.weaponBarrel = g.shotgunBarrel;
    g.barrelTip = g.shotgunBarrelTip;
  } else if (g.state.activeWeapon === "rifle" && g.upgrades.rifleUnlock) {
    g.weaponRoot = g.rifleRoot;
    g.weaponCell = g.rifleMag;
    g.weaponBarrel = g.rifleBarrel;
    g.barrelTip = g.rifleBarrelTip;
  } else {
    g.state.activeWeapon = "blaster";
    g.weaponRoot = g.blasterRoot;
    g.weaponCell = g.blasterCell;
    g.weaponBarrel = g.blasterBarrel;
    g.barrelTip = g.blasterBarrelTip;
  }
  g.weaponRoot.setEnabled(true);
  g.weaponRestPosition = g.weaponRoot.position.clone();
}

function setupScopeOverlay(): void {
  g.scopeOverlayGui = AdvancedDynamicTexture.CreateFullscreenUI(
    "scopeOverlayGui",
    true,
    g.scene,
  );
  g.scopeOverlay = new ScopeOverlayControl();
  g.scopeOverlayGui.addControl(g.scopeOverlay);
}

function setupPostProcessing(): void {
  const pipeline = new DefaultRenderingPipeline(
    "defaultPipeline",
    true,
    g.scene,
    [g.camera],
  );
  pipeline.bloomEnabled = true;
  pipeline.bloomThreshold = 0.8;
  pipeline.bloomWeight = 0.4;
  pipeline.bloomKernel = 64;
  pipeline.bloomScale = 0.5;
}
