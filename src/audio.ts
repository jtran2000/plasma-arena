import { Vector3 } from "@babylonjs/core";
import { g } from "./game.js";
import { AUDIO } from "./constants.js";

// ─── Core helpers ─────────────────────────────────────────────────────────────
function ensureAudioCtx(): AudioContext {
  if (!g.audioCtx) g.audioCtx = new AudioContext();
  if (g.audioCtx.state === "suspended") g.audioCtx.resume();
  return g.audioCtx;
}

function audioDest(): AudioNode {
  const ctx = g.audioCtx!;
  if (!g.masterGain) {
    g.masterCompressor = ctx.createDynamicsCompressor();
    g.masterCompressor.threshold.value = -18;
    g.masterCompressor.knee.value = 12;
    g.masterCompressor.ratio.value = 6;
    g.masterCompressor.attack.value = 0.002;
    g.masterCompressor.release.value = 0.15;
    g.masterGain = ctx.createGain();
    const saved = localStorage.getItem("fps_volume");
    g.masterGain.gain.value =
      (saved !== null ? Number(saved) / 100 : 0.5) * AUDIO.masterVolumeMult;
    g.masterCompressor.connect(g.masterGain);
    g.masterGain.connect(ctx.destination);
  }
  return g.masterCompressor!;
}

function makePanner(ctx: AudioContext, pos: Vector3): PannerNode {
  const p = ctx.createPanner();
  p.panningModel = "HRTF";
  p.distanceModel = "inverse";
  p.refDistance = 3;
  p.maxDistance = 60;
  p.rolloffFactor = 1;
  p.positionX.value = pos.x;
  p.positionY.value = pos.y;
  p.positionZ.value = pos.z;
  p.connect(audioDest());
  return p;
}

let bayonetWindSource: AudioBufferSourceNode | null = null;
let bayonetWindGain: GainNode | null = null;

// ─── Listener sync ────────────────────────────────────────────────────────────
export function updateAudioListener(): void {
  if (!g.audioCtx) return;
  const listener = g.audioCtx.listener;
  const pos = g.camera.position;
  const fwd = g.camera.getForwardRay().direction;
  if (listener.positionX !== undefined) {
    listener.positionX.value = pos.x;
    listener.positionY.value = pos.y;
    listener.positionZ.value = pos.z;
    listener.forwardX.value = fwd.x;
    listener.forwardY.value = fwd.y;
    listener.forwardZ.value = fwd.z;
    listener.upX.value = 0;
    listener.upY.value = 1;
    listener.upZ.value = 0;
  }
}

// ─── Weapon sounds ────────────────────────────────────────────────────────────
export function playReloadSounds(
  reloadTimeMs: number,
  barrelPos: () => Vector3,
): void {
  const ctx = ensureAudioCtx();

  setTimeout(() => {
    const now = ctx.currentTime;
    const panner = makePanner(ctx, barrelPos());
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(panner);
    osc.start(now);
    osc.stop(now + 0.23);
  }, reloadTimeMs * 0.25);

  setTimeout(() => {
    const now = ctx.currentTime;
    const panner = makePanner(ctx, barrelPos());

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.1);
    const pingGain = ctx.createGain();
    pingGain.gain.setValueAtTime(0.14, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(pingGain);
    pingGain.connect(panner);
    osc.start(now);
    osc.stop(now + 0.15);

    const bufSize = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.2, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    noise.connect(clickGain);
    clickGain.connect(panner);
    noise.start(now);
  }, reloadTimeMs * 0.65);
}

export function playRifleReloadSounds(
  reloadTimeMs: number,
  barrelPos: () => Vector3,
): void {
  const ctx = ensureAudioCtx();

  setTimeout(() => {
    const now = ctx.currentTime;
    const panner = makePanner(ctx, barrelPos());

    const bufSize = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    noise.start(now);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.1);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.08, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(oscGain);
    oscGain.connect(panner);
    osc.start(now);
    osc.stop(now + 0.11);
  }, reloadTimeMs * 0.18);

  setTimeout(() => {
    const now = ctx.currentTime;
    const panner = makePanner(ctx, barrelPos());

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.07);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(panner);
    osc.start(now);
    osc.stop(now + 0.09);
  }, reloadTimeMs * 0.52);

  setTimeout(() => {
    const now = ctx.currentTime;
    const panner = makePanner(ctx, barrelPos());

    const bufSize = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.16, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    noise.connect(clickGain);
    clickGain.connect(panner);
    noise.start(now);
  }, reloadTimeMs * 0.78);
}

export function playLaserSound(durationSec: number): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, g.barrelTip.getAbsolutePosition());

  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.exponentialRampToValueAtTime(160, now + durationSec * 0.8);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

  osc.connect(gain);
  gain.connect(panner);
  osc.start(now);
  osc.stop(now + durationSec + 0.01);
}

export function playRifleShotSound(): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, g.barrelTip.getAbsolutePosition());

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.07);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.09);

  const bufSize = Math.floor(ctx.sampleRate * 0.055);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1800, now);
  filter.Q.value = 0.9;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(panner);
  noise.start(now);

  const snap = ctx.createOscillator();
  snap.type = "triangle";
  snap.frequency.setValueAtTime(900, now);
  snap.frequency.exponentialRampToValueAtTime(260, now + 0.035);
  const snapGain = ctx.createGain();
  snapGain.gain.setValueAtTime(0.07, now);
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  snap.connect(snapGain);
  snapGain.connect(panner);
  snap.start(now);
  snap.stop(now + 0.05);
}

export function playShotgunShotSound(): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, g.barrelTip.getAbsolutePosition());

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(90, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(gain);
  gain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.21);

  const bufSize = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1200, now);
  filter.Q.value = 0.5;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.6, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(panner);
  noise.start(now);

  const snap = ctx.createOscillator();
  snap.type = "square";
  snap.frequency.setValueAtTime(800, now);
  snap.frequency.exponentialRampToValueAtTime(200, now + 0.04);
  const snapGain = ctx.createGain();
  snapGain.gain.setValueAtTime(0.25, now);
  snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  snap.connect(snapGain);
  snapGain.connect(panner);
  snap.start(now);
  snap.stop(now + 0.06);
}

export function playShotgunPumpSound(): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, g.barrelTip.getAbsolutePosition());

  const bufSize = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const scrape = ctx.createBufferSource();
  scrape.buffer = buf;
  const scrapeFilter = ctx.createBiquadFilter();
  scrapeFilter.type = "bandpass";
  scrapeFilter.frequency.setValueAtTime(1200, now);
  scrapeFilter.Q.value = 1.2;
  const scrapeGain = ctx.createGain();
  scrapeGain.gain.setValueAtTime(0.12, now);
  scrapeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  scrape.connect(scrapeFilter);
  scrapeFilter.connect(scrapeGain);
  scrapeGain.connect(panner);
  scrape.start(now);

  const clickBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const clickData = clickBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) clickData[i] = Math.random() * 2 - 1;
  const click = ctx.createBufferSource();
  click.buffer = clickBuf;
  const clickFilter = ctx.createBiquadFilter();
  clickFilter.type = "bandpass";
  clickFilter.frequency.setValueAtTime(2000, now);
  clickFilter.Q.value = 1.5;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.18, now + 0.06);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  click.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(panner);
  click.start(now + 0.06);
}

export function playShotgunReloadSounds(
  reloadTimeMs: number,
  barrelPos: () => Vector3,
): void {
  const ctx = ensureAudioCtx();

  setTimeout(() => {
    const now = ctx.currentTime;
    const panner = makePanner(ctx, barrelPos());
    const bufSize = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noise.connect(gain);
    gain.connect(panner);
    noise.start(now);
  }, reloadTimeMs * 0.25);

  setTimeout(() => {
    const now = ctx.currentTime;
    const panner = makePanner(ctx, barrelPos());
    const bufSize = Math.floor(ctx.sampleRate * 0.04);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noise.connect(gain);
    gain.connect(panner);
    noise.start(now);
  }, reloadTimeMs * 0.6);

  setTimeout(() => {
    const now = ctx.currentTime;
    const panner = makePanner(ctx, barrelPos());
    const bufSize = Math.floor(ctx.sampleRate * 0.035);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    noise.connect(gain);
    gain.connect(panner);
    noise.start(now);
  }, reloadTimeMs * 0.78);
}

export function startBayonetChargeWindSound(): void {
  if (bayonetWindSource) return;
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;

  const bufSize = Math.floor(ctx.sampleRate * 0.35);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(850, now);
  filter.Q.value = 0.55;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.16);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioDest());
  noise.start(now);

  bayonetWindSource = noise;
  bayonetWindGain = gain;
}

export function stopBayonetChargeWindSound(): void {
  if (!bayonetWindSource || !bayonetWindGain || !g.audioCtx) return;
  const now = g.audioCtx.currentTime;
  bayonetWindGain.gain.cancelScheduledValues(now);
  bayonetWindGain.gain.setValueAtTime(bayonetWindGain.gain.value, now);
  bayonetWindGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  const source = bayonetWindSource;
  const gain = bayonetWindGain;
  source.stop(now + 0.14);
  setTimeout(() => {
    source.disconnect();
    gain.disconnect();
  }, 180);
  bayonetWindSource = null;
  bayonetWindGain = null;
}

export function playOverheatSound(): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, g.barrelTip.getAbsolutePosition());

  const bufSize = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(3000, now);
  filter.frequency.exponentialRampToValueAtTime(1000, now + 0.5);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  noise.start(now);

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120, now);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.15, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(oscGain);
  oscGain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.31);
}

// ─── Enemy sounds ─────────────────────────────────────────────────────────────
export function playEnemyDeathSound(pos: Vector3): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime + 0.15;
  const panner = makePanner(ctx, pos);

  const bufSize = Math.floor(ctx.sampleRate * 0.15);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  noise.connect(noiseGain);
  noiseGain.connect(panner);
  noise.start(now);

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.15, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(oscGain);
  oscGain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.36);
}

export function playEnemySpawnSound(pos: Vector3): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  const bufSize = Math.floor(ctx.sampleRate * 0.3);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
  filter.Q.value = 2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.9, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  noise.start(now);
}

export function playEnemyFootstep(pos: Vector3): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  const bufSize = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.32, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  noise.start(now);
}

export function playEnemyAttackSound(pos: Vector3): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  // Sharp impact swoosh
  const bufSize = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(600, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + 0.12);
  filter.Q.value = 3;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  noise.start(now);

  // Low thump
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(1, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(oscGain);
  oscGain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.11);
}

export function playEnemyOrbFireSound(pos: Vector3): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.3, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(oscGain);
  oscGain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.26);

  const bufSize = Math.floor(ctx.sampleRate * 0.1);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(500, now);
  filter.Q.value = 4;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.2, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(panner);
  noise.start(now);
}

export function playEnemyOrbHitSound(pos: Vector3): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  const bufSize = Math.floor(ctx.sampleRate * 0.08);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 800;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.4, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(panner);
  noise.start(now);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.5, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(oscGain);
  oscGain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.13);
}

// ─── Plasma charge sounds ────────────────────────────────────────────────────
export function startPlasmaChargeSound(): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(60, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.05, now);
  osc.connect(gain);
  gain.connect(audioDest());
  osc.start(now);
  g.plasmaChargeOsc = osc;
  g.plasmaChargeGain = gain;
}

export function updatePlasmaChargeSound(t: number): void {
  if (!g.plasmaChargeOsc || !g.plasmaChargeGain) return;
  const ctx = g.audioCtx!;
  const now = ctx.currentTime;
  g.plasmaChargeOsc.frequency.setTargetAtTime(60 + 140 * t, now, 0.05);
  g.plasmaChargeGain.gain.setTargetAtTime(0.05 + 0.3 * t, now, 0.05);
}

export function stopPlasmaChargeSound(): void {
  if (g.plasmaChargeOsc) {
    g.plasmaChargeOsc.stop();
    g.plasmaChargeOsc.disconnect();
    g.plasmaChargeOsc = null;
  }
  if (g.plasmaChargeGain) {
    g.plasmaChargeGain.disconnect();
    g.plasmaChargeGain = null;
  }
}

// ─── Plasma sounds ───────────────────────────────────────────────────────────
export function playPlasmaLaunchSound(
  pos: Vector3,
  chargeMultiplier = 1,
): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  // Deep thump — deeper and louder with charge
  const dur = 0.25 * chargeMultiplier;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(80 / chargeMultiplier, now);
  osc.frequency.exponentialRampToValueAtTime(40 / chargeMultiplier, now + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35 * chargeMultiplier, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain);
  gain.connect(panner);
  osc.start(now);
  osc.stop(now + dur + 0.01);

  // Whoosh
  const whooshDur = 0.15 * chargeMultiplier;
  const bufSize = Math.floor(ctx.sampleRate * whooshDur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.exponentialRampToValueAtTime(150, now + whooshDur);
  filter.Q.value = 2;
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.25 * chargeMultiplier, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + whooshDur);
  noise.connect(filter);
  filter.connect(nGain);
  nGain.connect(panner);
  noise.start(now);
}

export function playPlasmaExplosionSound(
  pos: Vector3,
  chargeMultiplier = 1,
): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  // Low boom — deeper and louder with charge
  const boomDur = 0.5 * chargeMultiplier;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(60 / chargeMultiplier, now);
  osc.frequency.exponentialRampToValueAtTime(
    20 / chargeMultiplier,
    now + boomDur * 0.8,
  );
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5 * chargeMultiplier, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + boomDur);
  osc.connect(gain);
  gain.connect(panner);
  osc.start(now);
  osc.stop(now + boomDur + 0.01);

  // Explosion noise
  const noiseDur = 0.4 * chargeMultiplier;
  const bufSize = Math.floor(ctx.sampleRate * noiseDur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2000, now);
  filter.frequency.exponentialRampToValueAtTime(200, now + noiseDur);
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.6 * chargeMultiplier, now);
  nGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDur);
  noise.connect(filter);
  filter.connect(nGain);
  nGain.connect(panner);
  noise.start(now);
}

// ─── Supply sounds ────────────────────────────────────────────────────────────
export function playHealthSupplySound(pos: Vector3): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(520, now);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.2, now);
  g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc1.connect(g1);
  g1.connect(panner);
  osc1.start(now);
  osc1.stop(now + 0.16);

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(780, now + 0.08);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.001, now);
  g2.gain.setValueAtTime(0.2, now + 0.08);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc2.connect(g2);
  g2.connect(panner);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.26);
}

export function playAmmoSupplySound(pos: Vector3): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.06);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc.connect(gain);
  gain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.09);

  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(450, now + 0.06);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.001, now);
  g2.gain.setValueAtTime(0.12, now + 0.06);
  g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc2.connect(g2);
  g2.connect(panner);
  osc2.start(now + 0.06);
  osc2.stop(now + 0.16);
}

export function playLightningSound(pos: Vector3): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  // Sharp crack — white noise burst
  const bufLen = Math.floor(ctx.sampleRate * 0.08);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.25, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  noise.connect(noiseGain);
  noiseGain.connect(panner);
  noise.start(now);
  noise.stop(now + 0.09);

  // Electric sizzle — sawtooth sweep
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(2000, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.1, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(oscGain);
  oscGain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.13);
}

// ─── Melee ─────────────────────────────────────────────────────────────────
export function playMeleeSound(pos: Vector3): void {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;
  const panner = makePanner(ctx, pos);

  // Heavy thud — low-freq impact
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.35, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(oscGain);
  oscGain.connect(panner);
  osc.start(now);
  osc.stop(now + 0.16);

  // Metallic clang — noise burst through bandpass
  const bufLen = Math.floor(ctx.sampleRate * 0.1);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(2500, now);
  filter.Q.value = 5;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.2, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(panner);
  noise.start(now);
  noise.stop(now + 0.11);
}

// ─── Fire loop ──────────────────────────────────────────────────────────────
let fireNoiseBuffer: AudioBuffer | null = null;

function getFireNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (fireNoiseBuffer && fireNoiseBuffer.sampleRate === ctx.sampleRate)
    return fireNoiseBuffer;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  fireNoiseBuffer = buf;
  return buf;
}

export function startFireSound(pos: Vector3): {
  source: AudioBufferSourceNode;
  panner: PannerNode;
  gain: GainNode;
} {
  const ctx = ensureAudioCtx();
  const now = ctx.currentTime;

  const source = ctx.createBufferSource();
  source.buffer = getFireNoiseBuffer(ctx);
  source.loop = true;

  // Bandpass filter for crackling fire tone
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 600;
  bp.Q.value = 0.8;

  // Gentle amplitude modulation for crackle
  const lfo = ctx.createOscillator();
  lfo.type = "triangle";
  lfo.frequency.value = 8;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.3;
  lfo.connect(lfoGain);

  const gain = ctx.createGain();
  gain.gain.value = 0.12;
  lfoGain.connect(gain.gain);

  const panner = makePanner(ctx, pos);
  panner.refDistance = 2;
  panner.rolloffFactor = 1.5;

  source.connect(bp);
  bp.connect(gain);
  gain.connect(panner);

  // Fade in
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.3);

  source.start(now);
  lfo.start(now);

  return { source, panner, gain };
}

export function stopFireSound(
  source: AudioBufferSourceNode,
  gain: GainNode,
): void {
  if (!g.audioCtx) {
    try {
      source.stop();
    } catch (_) {
      /* already stopped */
    }
    source.disconnect();
    gain.disconnect();
    return;
  }
  const now = g.audioCtx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.2);
  try {
    source.stop(now + 0.25);
  } catch (_) {
    /* already stopped */
  }
  setTimeout(() => {
    source.disconnect();
    gain.disconnect();
  }, 300);
}
