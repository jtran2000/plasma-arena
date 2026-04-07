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
import { Effect } from "@babylonjs/core/Materials/effect.js";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess.js";
import type { ICanvasRenderingContext } from "@babylonjs/core/Engines/ICanvas.js";
import { AdvancedDynamicTexture, Control } from "@babylonjs/gui";
import HavokPhysics from "@babylonjs/havok";
import { g } from "./game.js";
import { CAMERA, LIGHTING, RIFLE } from "./constants.js";
import {
  makePlayerMesh,
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
  setupLamppost,
} from "./spawn.js";

Effect.ShadersStore.scopeBackgroundBlurFragmentShader = `
precision highp float;

varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 screenSize;
uniform float scopeRadiusScale;
uniform float blurKernel;

void main(void) {
  vec4 baseColor = texture2D(textureSampler, vUV);
  vec2 centeredPx = (vUV - vec2(0.5)) * screenSize;
  float scopeRadius = min(screenSize.x, screenSize.y) * scopeRadiusScale;
  float blurT = step(scopeRadius + 2.0, length(centeredPx));

  vec2 stepUv = vec2(blurKernel) / screenSize;
  vec4 sum = baseColor * 0.2;
  sum += texture2D(textureSampler, vUV + vec2(stepUv.x, 0.0)) * 0.1;
  sum += texture2D(textureSampler, vUV - vec2(stepUv.x, 0.0)) * 0.1;
  sum += texture2D(textureSampler, vUV + vec2(0.0, stepUv.y)) * 0.1;
  sum += texture2D(textureSampler, vUV - vec2(0.0, stepUv.y)) * 0.1;
  sum += texture2D(textureSampler, vUV + stepUv) * 0.1;
  sum += texture2D(textureSampler, vUV - stepUv) * 0.1;
  sum += texture2D(textureSampler, vUV + vec2(stepUv.x, -stepUv.y)) * 0.1;
  sum += texture2D(textureSampler, vUV + vec2(-stepUv.x, stepUv.y)) * 0.1;
  gl_FragColor = mix(baseColor, sum, blurT);
}
`;

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
    const cy = measure.top + measure.height / 2;
    const radius =
      Math.min(measure.width, measure.height) * RIFLE.SCOPE.pictureRadiusScale;

    context.save();
    context.fillStyle = RIFLE.SCOPE.overlayFill;
    context.fillRect(measure.left, measure.top, measure.width, measure.height);

    (context as unknown as CanvasRenderingContext2D).globalCompositeOperation =
      "destination-out";
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
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
  g.camera = new UniversalCamera("fps", new Vector3(0, 1.6, 0), g.scene);
  g.camera.setTarget(new Vector3(1, 1.6, 0));
  g.camera.minZ = 0.1;
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
  g.rifleMag = rifle.mag;
  g.rifleBarrel = rifle.barrel;
  g.rifleBarrelTip = rifle.barrelTip;
  g.rifleBrake = rifle.brake;
  g.rifleScope = rifle.scope;
  g.rifleBayonet = rifle.bayonet;
  g.rifleBrake.isVisible = g.upgrades.muzzleBrake;
  g.rifleScope.setEnabled(g.upgrades.rifleScope);
  g.rifleBayonet.setEnabled(g.upgrades.bayonet);

  if (g.state.activeWeapon === "rifle" && g.upgrades.rifleUnlock) {
    g.weaponRoot = g.rifleRoot;
    g.weaponCell = g.rifleMag;
    g.weaponBarrel = g.rifleBarrel;
    g.barrelTip = g.rifleBarrelTip;
    g.weaponRestPosition = g.weaponRoot.position.clone();
    g.blasterRoot.setEnabled(false);
    g.rifleRoot.setEnabled(true);
  } else {
    g.state.activeWeapon = "blaster";
    g.weaponRoot = g.blasterRoot;
    g.weaponCell = g.blasterCell;
    g.weaponBarrel = g.blasterBarrel;
    g.barrelTip = g.blasterBarrelTip;
    g.weaponRestPosition = g.weaponRoot.position.clone();
    g.blasterRoot.setEnabled(true);
    g.rifleRoot.setEnabled(false);
  }
}

function setupScopeOverlay(): void {
  g.scopeBackgroundBlur = new PostProcess(
    "scopeBackgroundBlur",
    "scopeBackgroundBlur",
    ["screenSize", "scopeRadiusScale", "blurKernel"],
    null,
    1,
    g.camera,
  );
  g.scopeBackgroundBlur.onApply = (effect) => {
    effect.setFloat2(
      "screenSize",
      g.engine.getRenderWidth(),
      g.engine.getRenderHeight(),
    );
    effect.setFloat("scopeRadiusScale", RIFLE.SCOPE.pictureRadiusScale + 1);
    effect.setFloat("blurKernel", RIFLE.SCOPE.overlayBlurKernel);
  };
  g.camera.detachPostProcess(g.scopeBackgroundBlur);
  g.scopeBlurActive = false;

  g.scopeOverlayGui = AdvancedDynamicTexture.CreateFullscreenUI(
    "scopeOverlayGui",
    true,
    g.scene,
  );
  g.scopeOverlay = new ScopeOverlayControl();
  g.scopeOverlayGui.addControl(g.scopeOverlay);
}
