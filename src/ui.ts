import {
  AdvancedDynamicTexture,
  Rectangle,
  TextBlock,
  Button,
  Slider,
  StackPanel,
  Control,
} from "@babylonjs/gui";
import { g, dom } from "./game.js";
import { AUDIO } from "./constants.js";
import { startGame } from "./flow.js";

// ─── Style constants ─────────────────────────────────────────────────────────
const FONT = "Courier New";
const ORANGE = "#FFAA00";
const DARK_ORANGE = "#FF8800";
const HOVER_ORANGE = "#FFBB22";
const RED = "#FF4444";
const HOVER_RED = "#FF6666";
const TEXT_COLOR = "#FFFFFF";
const MUTED_TEXT = "#CCCCCC";

// ─── State ───────────────────────────────────────────────────────────────────
let guiTexture: AdvancedDynamicTexture;
let startScreen: Rectangle;
let pauseScreen: Rectangle;
let optionsScreen: Rectangle;
let gameOverScreen: Rectangle;
let optionsFrom: "start" | "pause" = "pause";
let waveText: TextBlock;
let scoreText: TextBlock;
let volumeValueText: TextBlock;
let sensitivityValueText: TextBlock;
let volumeSlider: Slider;
let sensitivitySlider: Slider;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeScreen(bg: string): Rectangle {
  const rect = new Rectangle("screen");
  rect.width = 1;
  rect.height = 1;
  rect.thickness = 0;
  rect.background = bg;
  rect.isVisible = false;
  guiTexture.addControl(rect);
  return rect;
}

function makeTitle(text: string, fontSize: number, color: string): TextBlock {
  const tb = new TextBlock();
  tb.text = text;
  tb.color = color;
  tb.fontSize = fontSize;
  tb.fontFamily = FONT;
  tb.fontWeight = "bold";
  tb.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  tb.resizeToFit = true;
  tb.height = `${fontSize + 20}px`;
  return tb;
}

function makeLabel(text: string, fontSize: number, color: string): TextBlock {
  const tb = new TextBlock();
  tb.text = text;
  tb.color = color;
  tb.fontSize = fontSize;
  tb.fontFamily = FONT;
  tb.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  tb.resizeToFit = true;
  tb.height = `${fontSize + 16}px`;
  tb.textWrapping = true;
  return tb;
}

function makeButton(
  text: string,
  bgColor: string,
  textColor: string,
  hoverColor: string,
): Button {
  const btn = Button.CreateSimpleButton("btn", text);
  btn.width = "260px";
  btn.height = "52px";
  btn.color = textColor;
  btn.background = bgColor;
  btn.fontSize = 22;
  btn.fontFamily = FONT;
  btn.fontWeight = "bold";
  btn.thickness = 0;
  btn.cornerRadius = 0;
  btn.onPointerEnterObservable.add(() => {
    btn.background = hoverColor;
  });
  btn.onPointerOutObservable.add(() => {
    btn.background = bgColor;
  });
  return btn;
}

async function startGameFromUi(): Promise<void> {
  const sensitivity = getSensitivityValue();
  await startGame(sensitivity);
  createUI();
  hideStart();
  hidePause();
  hideGameOver();
}

// ─── Screen builders ─────────────────────────────────────────────────────────
function buildStartScreen(): void {
  startScreen = makeScreen("rgba(0,0,0,0.75)");

  const panel = new StackPanel();
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.spacing = 16;
  startScreen.addControl(panel);

  panel.addControl(makeTitle("FPS", 48, DARK_ORANGE));

  const instructions = makeLabel(
    "WASD to move \u2022 Mouse to look\nLeft click to shoot \u2022 R to reload\nShift to sprint",
    16,
    MUTED_TEXT,
  );
  instructions.height = "80px";
  panel.addControl(instructions);

  const playBtn = makeButton("\u25B6  PLAY", ORANGE, "#000000", HOVER_ORANGE);
  playBtn.onPointerUpObservable.add(() => {
    startGameFromUi().catch(console.error);
  });
  panel.addControl(playBtn);

  const optBtn = makeButton("\u2699  OPTIONS", ORANGE, "#000000", HOVER_ORANGE);
  optBtn.onPointerUpObservable.add(() => {
    showOptions("start");
  });
  panel.addControl(optBtn);

  startScreen.isVisible = true;
}

function buildPauseScreen(): void {
  pauseScreen = makeScreen("rgba(0,0,0,0.6)");

  const panel = new StackPanel();
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.spacing = 12;
  pauseScreen.addControl(panel);

  panel.addControl(makeTitle("PAUSED", 40, ORANGE));

  const resumeBtn = makeButton(
    "\u25B6  RESUME",
    ORANGE,
    "#000000",
    HOVER_ORANGE,
  );
  resumeBtn.onPointerUpObservable.add(() => {
    dom.canvas.requestPointerLock({ unadjustedMovement: true });
  });
  panel.addControl(resumeBtn);

  const optBtn = makeButton("\u2699  OPTIONS", ORANGE, "#000000", HOVER_ORANGE);
  optBtn.onPointerUpObservable.add(() => {
    showOptions("pause");
  });
  panel.addControl(optBtn);

  const restartBtn = makeButton("RESTART", RED, TEXT_COLOR, HOVER_RED);
  restartBtn.onPointerUpObservable.add(() => {
    startGameFromUi().catch(console.error);
  });
  panel.addControl(restartBtn);
}

function buildOptionsScreen(): void {
  optionsScreen = makeScreen("rgba(0,0,0,0.7)");

  const panel = new StackPanel();
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.spacing = 20;
  optionsScreen.addControl(panel);

  panel.addControl(makeTitle("OPTIONS", 40, ORANGE));

  // Volume row
  const volRow = new StackPanel();
  volRow.isVertical = false;
  volRow.height = "40px";
  volRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  volRow.width = "420px";
  panel.addControl(volRow);

  const volLabel = new TextBlock();
  volLabel.text = "VOLUME";
  volLabel.color = MUTED_TEXT;
  volLabel.fontSize = 14;
  volLabel.fontFamily = FONT;
  volLabel.width = "140px";
  volLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  volLabel.paddingRight = "12px";
  volRow.addControl(volLabel);

  volumeSlider = new Slider();
  volumeSlider.minimum = 0;
  volumeSlider.maximum = 100;
  volumeSlider.step = 1;
  volumeSlider.value = 50;
  volumeSlider.width = "200px";
  volumeSlider.height = "20px";
  volumeSlider.color = ORANGE;
  volumeSlider.background = "rgba(255,255,255,0.2)";
  volumeSlider.thumbColor = ORANGE;
  volumeSlider.borderColor = "transparent";
  volumeSlider.isThumbCircle = true;
  volumeSlider.thumbWidth = "16px";
  volRow.addControl(volumeSlider);

  volumeValueText = new TextBlock();
  volumeValueText.text = "50";
  volumeValueText.color = ORANGE;
  volumeValueText.fontSize = 16;
  volumeValueText.fontFamily = FONT;
  volumeValueText.fontWeight = "bold";
  volumeValueText.width = "50px";
  volumeValueText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  volumeValueText.paddingLeft = "12px";
  volRow.addControl(volumeValueText);

  volumeSlider.onValueChangedObservable.add((val) => {
    const v = Math.round(val);
    volumeValueText.text = String(v);
    if (g.masterGain)
      g.masterGain.gain.value = (v / 100) * AUDIO.masterVolumeMult;
    localStorage.setItem("fps_volume", String(v));
  });

  // Sensitivity row
  const sensRow = new StackPanel();
  sensRow.isVertical = false;
  sensRow.height = "40px";
  sensRow.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
  sensRow.width = "420px";
  panel.addControl(sensRow);

  const sensLabel = new TextBlock();
  sensLabel.text = "SENSITIVITY";
  sensLabel.color = MUTED_TEXT;
  sensLabel.fontSize = 14;
  sensLabel.fontFamily = FONT;
  sensLabel.width = "140px";
  sensLabel.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
  sensLabel.paddingRight = "12px";
  sensRow.addControl(sensLabel);

  sensitivitySlider = new Slider();
  sensitivitySlider.minimum = 1;
  sensitivitySlider.maximum = 100;
  sensitivitySlider.step = 1;
  sensitivitySlider.value = 50;
  sensitivitySlider.width = "200px";
  sensitivitySlider.height = "20px";
  sensitivitySlider.color = ORANGE;
  sensitivitySlider.background = "rgba(255,255,255,0.2)";
  sensitivitySlider.thumbColor = ORANGE;
  sensitivitySlider.borderColor = "transparent";
  sensitivitySlider.isThumbCircle = true;
  sensitivitySlider.thumbWidth = "16px";
  sensRow.addControl(sensitivitySlider);

  sensitivityValueText = new TextBlock();
  sensitivityValueText.text = "50";
  sensitivityValueText.color = ORANGE;
  sensitivityValueText.fontSize = 16;
  sensitivityValueText.fontFamily = FONT;
  sensitivityValueText.fontWeight = "bold";
  sensitivityValueText.width = "50px";
  sensitivityValueText.textHorizontalAlignment =
    Control.HORIZONTAL_ALIGNMENT_LEFT;
  sensitivityValueText.paddingLeft = "12px";
  sensRow.addControl(sensitivityValueText);

  sensitivitySlider.onValueChangedObservable.add((val) => {
    const v = Math.round(val);
    sensitivityValueText.text = String(v);
    g.baseCameraAngularSensibility = 2200 - v * 20;
    if (g.camera && !g.rifleScoped) {
      g.camera.angularSensibility = g.baseCameraAngularSensibility;
    }
    localStorage.setItem("fps_sensitivity", String(v));
  });

  // Back button
  const backBtn = makeButton("\u25C0  BACK", ORANGE, "#000000", HOVER_ORANGE);
  backBtn.onPointerUpObservable.add(() => {
    hideOptions();
  });
  panel.addControl(backBtn);
}

function buildGameOverScreen(): void {
  gameOverScreen = makeScreen("rgba(0,0,0,0.8)");

  const panel = new StackPanel();
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
  panel.spacing = 16;
  gameOverScreen.addControl(panel);

  panel.addControl(makeTitle("GAME OVER", 56, RED));

  waveText = makeLabel("", 20, MUTED_TEXT);
  panel.addControl(waveText);

  scoreText = makeLabel("", 20, MUTED_TEXT);
  panel.addControl(scoreText);

  const restartBtn = makeButton("RESTART", RED, TEXT_COLOR, HOVER_RED);
  restartBtn.onPointerUpObservable.add(() => {
    startGameFromUi().catch(console.error);
  });
  panel.addControl(restartBtn);
}

// ─── Public API ──────────────────────────────────────────────────────────────
export function createUI(): void {
  guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("ui");
  g.guiTexture = guiTexture;

  buildStartScreen();
  buildPauseScreen();
  buildOptionsScreen();
  buildGameOverScreen();

  // Restore saved settings
  const savedVolume = localStorage.getItem("fps_volume");
  const savedSensitivity = localStorage.getItem("fps_sensitivity");
  if (savedVolume !== null) {
    volumeSlider.value = Number(savedVolume);
  }
  if (savedSensitivity !== null) {
    sensitivitySlider.value = Number(savedSensitivity);
  }
}

export function getSensitivityValue(): number {
  return sensitivitySlider.value;
}

export function showStart(): void {
  startScreen.isVisible = true;
}
export function hideStart(): void {
  startScreen.isVisible = false;
}

export function showPause(): void {
  pauseScreen.isVisible = true;
}
export function hidePause(): void {
  pauseScreen.isVisible = false;
}

export function showOptions(from: "start" | "pause"): void {
  optionsFrom = from;
  if (from === "start") startScreen.isVisible = false;
  else pauseScreen.isVisible = false;
  optionsScreen.isVisible = true;
}

export function hideOptions(): void {
  optionsScreen.isVisible = false;
  if (optionsFrom === "start") startScreen.isVisible = true;
  else pauseScreen.isVisible = true;
}

export function optionsOpen(): boolean {
  return optionsScreen.isVisible;
}

export function showGameOver(wave: number, score: number, kills: number): void {
  waveText.text = `Wave: ${wave}`;
  scoreText.text = `Score: ${score}  |  Kills: ${kills}`;
  gameOverScreen.isVisible = true;
}

export function hideGameOver(): void {
  gameOverScreen.isVisible = false;
}
