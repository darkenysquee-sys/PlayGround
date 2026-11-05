// Tiny procedural soundscape — wind, water, chitin and birdsong.
export class Soundscape {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.ready = false;
    this.muted = false;
    this.zone = 'garden';
    this.nextChirp = 4;
    this.nextCricket = 2;
    this.windGain = null;
    this.droneGain = null;
    this.filter = null;
  }

  init() {
    if (this.ready) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);

    // noise source (wind / rustle / bite texture)
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 3.2;
    }
    this.noise = buf;

    const wind = this.ctx.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 700;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.045;
    wind.connect(this.filter).connect(this.windGain).connect(this.master);
    wind.start();

    // low forest drone
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.018;
    this.droneGain.connect(this.master);
    for (const [f, g] of [[55, 0.55], [82.5, 0.32], [110.2, 0.14]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = this.ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.droneGain);
      o.start();
    }

    this.ready = true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.15);
    }
  }

  setZone(zoneId) {
    this.zone = zoneId;
    if (!this.ready) return;
    const freqs = { garden: 780, meadow: 640, edge: 420, deep: 260 };
    const drone = { garden: 0.014, meadow: 0.018, edge: 0.024, deep: 0.03 };
    const now = this.ctx.currentTime;
    this.filter.frequency.setTargetAtTime(freqs[zoneId] || 600, now, 2);
    this.droneGain.gain.setTargetAtTime(drone[zoneId] || 0.02, now, 2);
  }

  update(dt, zoneId, playing) {
    if (!this.ready || !playing) return;
    this.nextChirp -= dt;
    this.nextCricket -= dt;
    if (this.nextChirp <= 0) {
      this.nextChirp = 5 + Math.random() * 9;
      if (zoneId === 'garden' || zoneId === 'meadow') this.chirp();
    }
    if (this.nextCricket <= 0) {
      this.nextCricket = 2.4 + Math.random() * 4;
      if (zoneId === 'edge' || zoneId === 'deep') this.cricket();
    }
  }

  tone(freq, dur, type = 'sine', vol = 0.08, glide = null, delay = 0) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, glide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  burst(dur = 0.08, vol = 0.14, freq = 1200, type = 'bandpass') {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random() * 1.2);
    src.stop(t0 + dur + 0.02);
  }

  chirp() {
    if (!this.ready) return;
    const base = 1400 + Math.random() * 900;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      this.tone(base * (0.9 + Math.random() * 0.25), 0.055, 'sine', 0.018, base * 1.35, i * 0.09);
    }
  }

  cricket() {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this.tone(3200 + Math.random() * 400, 0.035, 'triangle', 0.012, null, i * 0.06);
    }
  }

  bite() {
    this.burst(0.07, 0.18, 1600, 'bandpass');
    this.tone(120, 0.1, 'sine', 0.05, 70);
  }

  eat() {
    this.tone(320, 0.12, 'sine', 0.05, 520);
    this.tone(640, 0.08, 'triangle', 0.025, 820, 0.05);
  }

  drink() {
    this.tone(520, 0.12, 'sine', 0.035, 760);
    this.tone(780, 0.14, 'sine', 0.02, 980, 0.08);
  }

  hurt() {
    this.burst(0.12, 0.2, 700, 'lowpass');
    this.tone(220, 0.24, 'sawtooth', 0.055, 90);
  }

  dash() {
    this.burst(0.16, 0.12, 2400, 'highpass');
    this.tone(180, 0.12, 'triangle', 0.03, 320);
  }

  evolve() {
    const notes = [392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone(f, 0.55, 'sine', 0.045, f * 1.01, i * 0.13);
      this.tone(f / 2, 0.7, 'triangle', 0.02, f / 2, i * 0.13);
    });
    this.burst(0.7, 0.05, 900, 'lowpass');
  }

  death() {
    [220, 174, 138, 110].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.05, f * 0.7, i * 0.16));
    this.burst(0.5, 0.06, 350, 'lowpass');
  }

  boss() {
    this.tone(65, 1.4, 'sawtooth', 0.045, 48);
    this.tone(97, 1.2, 'triangle', 0.03, 72);
    this.burst(1.2, 0.06, 240, 'lowpass');
  }

  win() {
    [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) => {
      this.tone(f, 1.6, 'sine', 0.04, f, i * 0.12);
    });
  }

  splash() {
    this.burst(0.15, 0.08, 900, 'bandpass');
    this.tone(400, 0.1, 'sine', 0.02, 600);
  }
}
