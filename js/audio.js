// Tiny procedural sound kit for Night Rally. No files, no network.
export class SoundKit {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem('night-rally-muted') === '1';
    } catch (err) {
      this.muted = false;
    }
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.52;
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.knee.value = 18;
      limiter.ratio.value = 5;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.18;
      this.master.connect(limiter).connect(this.ctx.destination);

      const length = Math.floor(this.ctx.sampleRate * 0.7);
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } catch (err) {
      this.ctx = null;
    }
  }

  resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem('night-rally-muted', muted ? '1' : '0');
    } catch (err) { /* private mode */ }
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.52, this.ctx.currentTime, 0.015);
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone({
    freq = 440,
    endFreq = null,
    duration = 0.12,
    type = 'sine',
    volume = 0.08,
    attack = 0.006,
    delay = 0,
    pan = 0,
  } = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
      osc.connect(gain).connect(panner).connect(this.master);
    } else {
      osc.connect(gain).connect(this.master);
    }
    osc.start(t0);
    osc.stop(t0 + duration + 0.03);
  }

  noise({ duration = 0.05, volume = 0.05, freq = 1200, q = 0.9, type = 'bandpass', delay = 0, pan = 0 } = {}) {
    if (!this.ctx || this.muted || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, volume), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
      source.connect(filter).connect(gain).connect(panner).connect(this.master);
    } else {
      source.connect(filter).connect(gain).connect(this.master);
    }
    source.start(t0, Math.random() * 0.3);
    source.stop(t0 + duration + 0.02);
  }

  ui() {
    this.tone({ freq: 620, endFreq: 840, duration: 0.055, volume: 0.025, type: 'triangle' });
  }

  select() {
    this.tone({ freq: 460, endFreq: 680, duration: 0.07, volume: 0.03, type: 'triangle' });
  }

  ball(offset = 0, speed = 1) {
    const p = Math.max(-0.75, Math.min(0.75, offset));
    this.tone({ freq: 190 + speed * 38, endFreq: 130, duration: 0.09, volume: 0.085, type: 'sine', pan: p });
    this.tone({ freq: 820 + speed * 90, endFreq: 480, duration: 0.045, volume: 0.035, type: 'triangle', pan: p });
    this.noise({ duration: 0.04, volume: 0.028, freq: 1750, q: 1.2, pan: p });
  }

  wall() {
    this.tone({ freq: 130, endFreq: 68, duration: 0.12, volume: 0.06, type: 'sine' });
    this.noise({ duration: 0.035, volume: 0.028, freq: 520, q: 0.8 });
  }

  serveTick(high = false) {
    this.tone({ freq: high ? 920 : 560, endFreq: high ? 1120 : 610, duration: 0.075, volume: 0.055, type: 'sine' });
    this.noise({ duration: 0.025, volume: 0.015, freq: 2200, q: 1.4 });
  }

  score(player = 1) {
    const base = player === 0 ? 320 : 260;
    const notes = player === 0 ? [1, 1.25, 1.5, 2] : [1, 0.84, 0.71];
    notes.forEach((r, i) => {
      this.tone({
        freq: base * r,
        endFreq: base * r * 1.01,
        duration: 0.16,
        volume: 0.07 - i * 0.006,
        type: 'triangle',
        delay: i * 0.075,
      });
      this.tone({
        freq: base * r * 2,
        duration: 0.1,
        volume: 0.022,
        type: 'sine',
        delay: i * 0.075,
      });
    });
  }

  matchPoint() {
    this.tone({ freq: 180, endFreq: 310, duration: 0.42, volume: 0.04, type: 'sine' });
    this.tone({ freq: 900, duration: 0.09, volume: 0.03, type: 'triangle', delay: 0.08 });
  }

  win(youWon) {
    const scale = youWon ? [1, 1.26, 1.5, 1.9, 2.38] : [1, 0.79, 0.63, 0.5];
    const base = youWon ? 220 : 190;
    scale.forEach((r, i) => {
      this.tone({
        freq: base * r,
        duration: youWon ? 0.32 : 0.24,
        volume: 0.055 - i * 0.004,
        type: 'triangle',
        delay: i * 0.105,
      });
    });
    this.noise({ duration: 0.5, volume: 0.025, freq: 1600, type: 'highpass', q: 0.4 });
  }
}
