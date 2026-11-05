// Night Rally — a first-to-five paddle duel.
// Two vertical paddles, one ball, walls at the top and bottom.
import { SoundKit } from './audio.js';

const TAU = Math.PI * 2;
const STEP = 1 / 120;
const POINTS_TO_WIN = 5;
const IS_TOUCH = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  || (('ontouchstart' in window) && navigator.maxTouchPoints > 0);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);

const roundRectPath = (ctx, x, y, w, h, r) => {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

const fmtTime = (seconds) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const $ = (id) => document.getElementById(id);
const dom = {
  canvas: $('game'),
  topbar: $('topbar'),
  hud: $('hud'),
  modeLabel: $('modeLabel'),
  leftName: $('leftName'),
  rightName: $('rightName'),
  leftScore: $('leftScore'),
  rightScore: $('rightScore'),
  leftPips: $('leftPips'),
  rightPips: $('rightPips'),
  scoreMode: $('scoreMode'),
  scoreStatus: $('scoreStatus'),
  scoreCenter: document.querySelector('.score-center'),
  soundBtn: $('soundBtn'),
  pauseBtn: $('pauseBtn'),
  announce: $('announce'),
  announceKicker: $('announceKicker'),
  announceTitle: $('announceTitle'),
  announceSub: $('announceSub'),
  rallyBadge: $('rallyBadge'),
  rallyCount: $('rallyCount'),
  controlsTip: $('controlsTip'),
  menuScreen: $('menuScreen'),
  modeSelect: $('modeSelect'),
  difficultyField: $('difficultyField'),
  difficultySelect: $('difficultySelect'),
  diffDesc: $('diffDesc'),
  startBtn: $('startBtn'),
  menuHint: $('menuHint'),
  menuSoundLabel: $('menuSoundLabel'),
  menuSoundState: $('menuSoundState'),
  pauseScreen: $('pauseScreen'),
  pauseRecap: $('pauseRecap'),
  resumeBtn: $('resumeBtn'),
  restartBtn: $('restartBtn'),
  menuBtn: $('menuBtn'),
  endScreen: $('endScreen'),
  endKicker: $('endKicker'),
  endTitle: $('endTitle'),
  endSub: $('endSub'),
  endLeftName: $('endLeftName'),
  endRightName: $('endRightName'),
  endLeftScore: $('endLeftScore'),
  endRightScore: $('endRightScore'),
  endLeftSide: document.querySelector('.end-side'),
  endRightSide: document.querySelector('.end-side-right'),
  statRally: $('statRally'),
  statTime: $('statTime'),
  statWinner: $('statWinner'),
  rematchBtn: $('rematchBtn'),
  changeBtn: $('changeBtn'),
};

const canvas = dom.canvas;
const ctx = canvas.getContext('2d');
const sound = new SoundKit();

const view = { w: 0, h: 0, dpr: 1 };
const court = { x: 0, y: 0, w: 0, h: 0 };
const metrics = { paddleW: 12, paddleH: 112, ballR: 8, courtRadius: 18, inset: 42 };

const makePaddle = (side) => ({
  side,
  x: 0,
  y: 0,
  w: metrics.paddleW,
  h: metrics.paddleH,
  vy: 0,
  prevY: 0,
  pointerY: null,
  hitGlow: 0,
});
const left = makePaddle('left');
const right = makePaddle('right');

const ball = {
  x: 0, y: 0, prevX: 0, prevY: 0,
  vx: 0, vy: 0, r: 8, speed: 0,
  visible: false, trail: [], hitFlash: 0, servePulse: 0,
};

const game = {
  state: 'menu',
  mode: 'cpu',
  difficulty: 'sharp',
  leftScore: 0,
  rightScore: 0,
  rally: 0,
  bestRally: 0,
  matchTime: 0,
  leftHits: 0,
  rightHits: 0,
  serveDir: 1,
  serveTimer: 0,
  pointTimer: 0,
  announceTimer: 0,
  pendingEnd: false,
  winner: null,
  scoredBy: null,
  pausedFrom: 'playing',
  shake: 0,
  flash: 0,
  flashColor: '120,242,194',
  muted: sound.muted,
  lastWinner: null,
};

const ai = {
  target: 0,
  timer: 0,
  profile: null,
};

const CPU_PROFILES = {
  calm: {
    label: 'CALM',
    desc: 'loose returns',
    speed: 0.30,
    reaction: 0.34,
    error: 0.18,
    anticipation: 0.55,
    mistake: 0.16,
  },
  sharp: {
    label: 'SHARP',
    desc: 'steady hands',
    speed: 0.45,
    reaction: 0.22,
    error: 0.10,
    anticipation: 0.82,
    mistake: 0.08,
  },
  ruthless: {
    label: 'RUTHLESS',
    desc: 'no mercy',
    speed: 0.64,
    reaction: 0.11,
    error: 0.04,
    anticipation: 0.96,
    mistake: 0.025,
  },
};

let particles = [];
let rings = [];
let motes = [];
let keys = new Set();
let pointerMap = new Map();
let lastFrame = performance.now();
let accumulator = 0;
let uiCache = { rallyShown: false, tipMode: '' };
let demo = null;

// ————— layout —————

function computeCourt() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const mobile = w <= 720;
  const compact = h < 560;

  let side;
  let top;
  let bottom;
  if (compact) {
    side = Math.max(14, w * 0.024);
    top = 72;
    bottom = 31;
  } else if (mobile) {
    side = 12;
    top = 122;
    bottom = 48;
  } else {
    side = Math.max(38, w * 0.065);
    top = Math.max(94, h * 0.1);
    bottom = 54;
  }

  // Respect the real chrome height and any notch / home-indicator safe area.
  const chromeBottom = dom.topbar.offsetTop + dom.topbar.offsetHeight;
  const tipTop = dom.controlsTip.offsetTop;
  top = Math.max(top, chromeBottom + (compact ? 7 : mobile ? 10 : 12));
  if (tipTop > 0) bottom = Math.max(bottom, h - tipTop + 8);

  let cw = w - side * 2;
  if (cw > 1420) {
    side += (cw - 1420) / 2;
    cw = 1420;
  }
  const ch = Math.max(170, h - top - bottom);

  court.x = Math.round(side);
  court.y = Math.round(top);
  court.w = Math.round(cw);
  court.h = Math.round(ch);

  metrics.paddleW = clamp(court.w * 0.0097, 8, 13);
  metrics.paddleH = clamp(court.h * 0.17, 46, 116);
  metrics.ballR = clamp(court.h * 0.0135, 5.2, 9.5);
  metrics.courtRadius = clamp(court.h * 0.032, 10, 22);
  metrics.inset = clamp(court.w * 0.04, 21, 58);
}

function positionPaddles(center = false) {
  left.w = metrics.paddleW;
  right.w = metrics.paddleW;
  left.h = metrics.paddleH;
  right.h = metrics.paddleH;
  left.x = court.x + metrics.inset;
  right.x = court.x + court.w - metrics.inset - right.w;
  const minY = court.y;
  const maxY = court.y + court.h - left.h;
  if (center) {
    left.y = court.y + (court.h - left.h) / 2;
    right.y = court.y + (court.h - right.h) / 2;
  } else {
    left.y = clamp(left.y, minY, maxY);
    right.y = clamp(right.y, minY, maxY);
  }
  left.prevY = left.y;
  right.prevY = right.y;
}

function resize() {
  const oldCourt = { ...court };
  const hadCourt = oldCourt.w > 0 && oldCourt.h > 0;
  const oldRatios = hadCourt ? {
    left: (left.y + left.h / 2 - oldCourt.y) / oldCourt.h,
    right: (right.y + right.h / 2 - oldCourt.y) / oldCourt.h,
    bx: (ball.x - oldCourt.x) / oldCourt.w,
    by: (ball.y - oldCourt.y) / oldCourt.h,
  } : null;

  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(view.w * view.dpr));
  canvas.height = Math.max(1, Math.round(view.h * view.dpr));
  canvas.style.width = `${view.w}px`;
  canvas.style.height = `${view.h}px`;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

  computeCourt();

  if (hadCourt && oldRatios && game.state !== 'menu') {
    positionPaddles(false);
    left.y = clamp(court.y + oldRatios.left * court.h - left.h / 2, court.y, court.y + court.h - left.h);
    right.y = clamp(court.y + oldRatios.right * court.h - right.h / 2, court.y, court.y + court.h - right.h);
    ball.x = clamp(court.x + oldRatios.bx * court.w, court.x + ball.r, court.x + court.w - ball.r);
    ball.y = clamp(court.y + oldRatios.by * court.h, court.y + ball.r, court.y + court.h - ball.r);
    ball.prevX = ball.x;
    ball.prevY = ball.y;
    ball.r = metrics.ballR;
  } else {
    positionPaddles(true);
    ball.r = metrics.ballR;
    ball.x = court.x + court.w / 2;
    ball.y = court.y + court.h / 2;
    ball.prevX = ball.x;
    ball.prevY = ball.y;
  }

  initMotes();
  initDemo();
}

function initMotes() {
  motes = Array.from({ length: 28 }, () => ({
    x: rand(0.03, 0.97),
    y: rand(0.03, 0.97),
    vx: rand(-0.004, 0.004),
    vy: rand(-0.003, 0.003),
    r: rand(0.5, 1.6),
    a: rand(0.02, 0.09),
  }));
}

function baseSpeed() {
  return clamp(court.w * 0.72, 350, 900);
}

function maxSpeed() {
  return baseSpeed() * 1.55;
}

// ————— menu attract court —————

function initDemo() {
  const r = metrics.ballR;
  demo = {
    ball: {
      x: court.x + court.w * 0.5,
      y: court.y + court.h * 0.42,
      prevX: court.x + court.w * 0.5,
      prevY: court.y + court.h * 0.42,
      vx: baseSpeed() * 0.46,
      vy: baseSpeed() * 0.22,
      r,
      speed: baseSpeed() * 0.5,
      trail: [],
    },
    left: {
      side: 'left', x: court.x + metrics.inset, y: court.y + court.h * 0.5 - metrics.paddleH / 2,
      w: metrics.paddleW, h: metrics.paddleH, vy: 0, hitGlow: 0, prevY: 0,
    },
    right: {
      side: 'right', x: court.x + court.w - metrics.inset - metrics.paddleW,
      y: court.y + court.h * 0.5 - metrics.paddleH / 2,
      w: metrics.paddleW, h: metrics.paddleH, vy: 0, hitGlow: 0, prevY: 0,
    },
    resetTimer: 0,
  };
}

function resetDemoBall(dir = 1) {
  if (!demo) return;
  const b = demo.ball;
  b.x = court.x + court.w * 0.5;
  b.y = court.y + court.h * rand(0.34, 0.66);
  b.prevX = b.x;
  b.prevY = b.y;
  b.speed = clamp(court.w * 0.46, 235, 560);
  const angle = rand(0.12, 0.32) * (Math.random() < 0.5 ? -1 : 1);
  b.vx = dir * b.speed * Math.cos(angle);
  b.vy = b.speed * Math.sin(angle);
  b.trail.length = 0;
  demo.resetTimer = 0;
}

function updateDemo(dt) {
  if (!demo) return;
  const b = demo.ball;
  const dl = demo.left;
  const dr = demo.right;
  const r = b.r;
  const top = court.y + r;
  const bottom = court.y + court.h - r;

  if (demo.resetTimer > 0) {
    demo.resetTimer -= dt;
    if (demo.resetTimer <= 0) resetDemoBall(Math.random() < 0.5 ? -1 : 1);
    return;
  }

  b.prevX = b.x;
  b.prevY = b.y;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.y < top) {
    b.y = top;
    b.vy = Math.abs(b.vy);
    b.trail.length = 0;
  } else if (b.y > bottom) {
    b.y = bottom;
    b.vy = -Math.abs(b.vy);
    b.trail.length = 0;
  }

  const track = (p, speed, lag) => {
    p.prevY = p.y;
    const target = clamp(b.y - p.h / 2 + Math.sin((b.y + court.y) * 0.004) * 8, court.y, court.y + court.h - p.h);
    const maxStep = speed * dt;
    const move = clamp((target - p.y) * lag, -maxStep, maxStep);
    p.y += move;
    p.vy = move / Math.max(dt, 0.0001);
    p.hitGlow = Math.max(0, p.hitGlow - dt * 3);
  };
  track(dl, court.h * 0.72, 0.18);
  track(dr, court.h * 0.72, 0.18);

  const hit = (p, dir) => {
    const overlapY = b.y > p.y - r * 0.7 && b.y < p.y + p.h + r * 0.7;
    if (!overlapY) return false;
    const rel = clamp((b.y - (p.y + p.h / 2)) / (p.h / 2 + r), -1, 1);
    const angle = clamp(rel * 0.8, -0.8, 0.8);
    b.x += dir * 2;
    b.vx = dir * b.speed * Math.cos(angle);
    b.vy = b.speed * Math.sin(angle);
    b.trail.length = 0;
    p.hitGlow = 1;
    return true;
  };

  if (b.vx < 0 && b.prevX - r >= dl.x + dl.w && b.x - r <= dl.x + dl.w) hit(dl, 1);
  if (b.vx > 0 && b.prevX + r <= dr.x && b.x + r >= dr.x) hit(dr, -1);

  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > 16) b.trail.shift();

  if (b.x < court.x - r * 3 || b.x > court.x + court.w + r * 3) {
    b.trail.length = 0;
    demo.resetTimer = 0.7;
  }
}

// ————— effects —————

function addRing(x, y, color, radius = 8, life = 0.35, width = 1.5) {
  rings.push({ x, y, color, radius, life, maxLife: life, width });
  if (rings.length > 30) rings.shift();
}

function addParticle(x, y, color, options = {}) {
  const {
    vx = rand(-100, 100),
    vy = rand(-100, 100),
    life = rand(0.35, 0.8),
    size = rand(1, 2.6),
    gravity = 0,
    drag = 0.9,
    kind = 'dot',
    rot = rand(0, TAU),
    spin = rand(-6, 6),
  } = options;
  particles.push({ x, y, vx, vy, life, maxLife: life, size, color, gravity, drag, kind, rot, spin });
  if (particles.length > 620) particles.splice(0, particles.length - 620);
}

function spawnSpark(x, y, color, count = 10, power = 180, direction = null) {
  for (let i = 0; i < count; i++) {
    const base = direction === null ? rand(0, TAU) : direction + rand(-0.7, 0.7);
    const speed = rand(power * 0.3, power);
    addParticle(x, y, color, {
      vx: Math.cos(base) * speed,
      vy: Math.sin(base) * speed,
      life: rand(0.25, 0.6),
      size: rand(1, 2.5),
      drag: 0.93,
      kind: Math.random() < 0.3 ? 'streak' : 'dot',
    });
  }
}

function spawnScoreBurst(x, y, color, big = false) {
  addRing(x, y, color, 10, big ? 0.7 : 0.52, 2);
  addRing(x, y, color, 4, 0.45, 1);
  spawnSpark(x, y, color, big ? 42 : 28, big ? 320 : 245);
  for (let i = 0; i < (big ? 24 : 14); i++) {
    addParticle(x, y, color, {
      vx: rand(-210, 210),
      vy: rand(-210, 210),
      life: rand(0.45, 1.15),
      size: rand(1.5, 4),
      drag: 0.9,
      gravity: 90,
      kind: 'streak',
    });
  }
}

function spawnConfetti() {
  const colors = ['#78f2c2', '#adffdc', '#f4f7ef', '#ff8874', '#ffe1d9'];
  for (let i = 0; i < 90; i++) {
    addParticle(rand(court.x + 40, court.x + court.w - 40), court.y + rand(0, court.h * 0.2), colors[i % colors.length], {
      vx: rand(-130, 130),
      vy: rand(20, 190),
      life: rand(1.5, 3.2),
      size: rand(1.5, 4),
      drag: 0.985,
      gravity: 95,
      kind: 'confetti',
      spin: rand(-10, 10),
    });
  }
}

function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(p.drag, dt * 60);
    p.vy = p.vy * Math.pow(p.drag, dt * 60) + p.gravity * dt;
    p.rot += p.spin * dt;
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.life -= dt;
    if (r.life <= 0) {
      rings.splice(i, 1);
      continue;
    }
    r.radius += dt * (r.radius * 3 + 60);
  }
  game.shake = Math.max(0, game.shake - dt * 30);
  game.flash = Math.max(0, game.flash - dt * 2.6);
  left.hitGlow = Math.max(0, left.hitGlow - dt * 3.5);
  right.hitGlow = Math.max(0, right.hitGlow - dt * 3.5);
  ball.hitFlash = Math.max(0, ball.hitFlash - dt * 5);
  ball.servePulse = (ball.servePulse + dt * 2.4) % TAU;

  for (const m of motes) {
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.x < 0.02) m.x = 0.98;
    if (m.x > 0.98) m.x = 0.02;
    if (m.y < 0.02) m.y = 0.98;
    if (m.y > 0.98) m.y = 0.02;
  }
}

// ————— interface —————

function playerName(side) {
  if (game.mode === 'local') return side === 0 ? 'P1' : 'P2';
  return side === 0 ? 'YOU' : 'CPU';
}

function serverPhrase(server) {
  if (game.mode === 'local') return `P${server + 1} SERVES`;
  return server === 0 ? 'YOUR SERVE' : 'CPU SERVES';
}

function modePhrase() {
  if (game.mode === 'local') return 'LOCAL · 2P';
  return `SOLO · ${CPU_PROFILES[game.difficulty].label}`;
}

function showAnnounce(kicker, title, sub, variant = '', duration = 1.2) {
  dom.announceKicker.textContent = kicker;
  dom.announceTitle.textContent = title;
  dom.announceSub.textContent = sub;
  dom.announce.className = `announce show ${variant}`.trim();
  game.announceTimer = duration;
}

function hideAnnounce() {
  dom.announce.classList.remove('show');
  game.announceTimer = 0;
}

function setPips(container, score) {
  [...container.children].forEach((pip, i) => pip.classList.toggle('on', i < score));
}

function bumpScore(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function updateScoreHud(bumpSide = null) {
  dom.leftScore.textContent = String(game.leftScore);
  dom.rightScore.textContent = String(game.rightScore);
  setPips(dom.leftPips, game.leftScore);
  setPips(dom.rightPips, game.rightScore);
  if (bumpSide === 0) bumpScore(dom.leftScore);
  if (bumpSide === 1) bumpScore(dom.rightScore);

  const matchPoint = game.winner === null && (game.leftScore === POINTS_TO_WIN - 1 || game.rightScore === POINTS_TO_WIN - 1);
  dom.scoreCenter.classList.toggle('match-point', matchPoint);
  dom.scoreStatus.textContent = matchPoint
    ? 'MATCH POINT'
    : (game.mode === 'local' ? 'LOCAL' : 'SOLO');
}

function updateNames() {
  dom.leftName.textContent = playerName(0);
  dom.rightName.textContent = playerName(1);
  dom.endLeftName.textContent = playerName(0);
  dom.endRightName.textContent = playerName(1);
  dom.modeLabel.textContent = modePhrase();
  dom.scoreMode.textContent = 'FIRST TO 5';
}

function updateControlsTip() {
  if (IS_TOUCH) {
    dom.controlsTip.innerHTML = `<span class="tip-label">MOVE</span><span>${game.mode === 'local' ? 'DRAG YOUR HALF' : 'DRAG ANYWHERE'}</span>`;
    dom.menuHint.innerHTML = '<span>drag your side of the court to move</span><span class="hint-sep">·</span><span>first to five</span>';
    return;
  }
  if (game.mode === 'local') {
    dom.controlsTip.innerHTML = '<span class="tip-label">MOVE</span><span class="tip-player">P1</span><kbd>W</kbd><kbd>S</kbd><span class="or">·</span><span class="tip-player">P2</span><kbd>↑</kbd><kbd>↓</kbd>';
    dom.menuHint.innerHTML = '<span class="tip-player">P1</span><kbd>W</kbd><kbd>S</kbd><span>·</span><span class="tip-player">P2</span><kbd>↑</kbd><kbd>↓</kbd><span class="hint-sep">·</span><span>first to five</span>';
  } else {
    dom.controlsTip.innerHTML = '<span class="tip-label">MOVE</span><kbd>W</kbd><kbd>S</kbd><span class="or">/</span><kbd>↑</kbd><kbd>↓</kbd><span>up &amp; down</span>';
    dom.menuHint.innerHTML = '<kbd>W</kbd><kbd>S</kbd><span>or</span><kbd>↑</kbd><kbd>↓</kbd><span>to move</span><span class="hint-sep">·</span><span>first to five</span>';
  }
}

function syncMuteUi() {
  document.body.classList.toggle('muted', sound.muted);
  dom.soundBtn.setAttribute('aria-label', sound.muted ? 'Unmute sound' : 'Mute sound');
  dom.soundBtn.title = sound.muted ? 'Unmute (M)' : 'Mute (M)';
  if (dom.menuSoundLabel) {
    dom.menuSoundLabel.innerHTML = `SOUND ${sound.muted ? 'OFF' : 'ON'} <b id="menuSoundState">${sound.muted ? '○' : '●'}</b>`;
    dom.menuSoundLabel.setAttribute('aria-label', sound.muted ? 'Unmute sound' : 'Mute sound');
  }
}

function setBodyState(state) {
  document.body.dataset.state = state;
  const playing = state !== 'menu';
  dom.topbar.setAttribute('aria-hidden', playing ? 'false' : 'true');
  dom.hud.setAttribute('aria-hidden', playing ? 'false' : 'true');
}

function openMenu() {
  game.state = 'menu';
  game.pendingEnd = false;
  game.winner = null;
  game.scoredBy = null;
  setBodyState('menu');
  dom.menuScreen.classList.remove('is-hidden');
  dom.pauseScreen.classList.remove('is-open');
  dom.endScreen.classList.remove('is-open');
  dom.pauseScreen.setAttribute('aria-hidden', 'true');
  dom.endScreen.setAttribute('aria-hidden', 'true');
  dom.announce.classList.remove('show');
  particles = [];
  rings = [];
  ball.visible = false;
  ball.trail.length = 0;
  initDemo();
  resetDemoBall(Math.random() < 0.5 ? -1 : 1);
  updateNames();
  updateScoreHud();
  updateDifficultyUi();
  syncMuteUi();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function updateDifficultyUi() {
  const local = game.mode === 'local';
  dom.difficultyField.classList.toggle('is-dim', local);
  [...dom.difficultySelect.querySelectorAll('button')].forEach((btn) => {
    btn.disabled = local;
    const on = btn.dataset.diff === game.difficulty;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  const profile = CPU_PROFILES[game.difficulty];
  dom.diffDesc.textContent = local ? 'off for local' : profile.desc;
  dom.modeLabel.textContent = modePhrase();
}

function updateModeSelection() {
  [...dom.modeSelect.querySelectorAll('button')].forEach((btn) => {
    const on = btn.dataset.mode === game.mode;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  updateDifficultyUi();
  updateNames();
  updateControlsTip();
}

// ————— match flow —————

function startMatch() {
  sound.init();
  sound.resume();
  sound.ui();
  pointerMap.clear();
  keys.clear();
  left.pointerY = null;
  right.pointerY = null;
  particles = [];
  rings = [];
  game.leftScore = 0;
  game.rightScore = 0;
  game.rally = 0;
  game.bestRally = 0;
  game.matchTime = 0;
  game.leftHits = 0;
  game.rightHits = 0;
  game.pendingEnd = false;
  game.winner = null;
  game.scoredBy = null;
  game.shake = 0;
  game.flash = 0;
  game.lastWinner = null;

  dom.menuScreen.classList.add('is-hidden');
  dom.pauseScreen.classList.remove('is-open');
  dom.endScreen.classList.remove('is-open');
  dom.pauseScreen.setAttribute('aria-hidden', 'true');
  dom.endScreen.setAttribute('aria-hidden', 'true');
  setBodyState('game');
  updateNames();
  updateScoreHud();
  updateDifficultyUi();
  updateControlsTip();
  positionPaddles(true);

  ball.trail.length = 0;
  ball.r = metrics.ballR;
  ball.visible = true;

  const firstDir = Math.random() < 0.5 ? -1 : 1;
  beginServe(firstDir, true);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function beginServe(dir, initial = false) {
  game.state = 'serve';
  game.serveDir = dir;
  game.serveTimer = initial ? 1.5 : 1.08;
  game.pointTimer = 0;
  game.rally = 0;
  game.scoredBy = null;
  ball.visible = true;
  ball.inPlay = false;
  ball.x = court.x + court.w / 2;
  ball.y = court.y + court.h / 2 + rand(-court.h * 0.1, court.h * 0.1);
  ball.prevX = ball.x;
  ball.prevY = ball.y;
  ball.vx = 0;
  ball.vy = 0;
  ball.speed = baseSpeed();
  ball.trail.length = 0;
  ball.hitFlash = 0;

  ai.target = court.y + court.h / 2;
  ai.timer = 0;
  ai.profile = CPU_PROFILES[game.difficulty];

  const server = dir > 0 ? 0 : 1;
  const lead = initial ? 'FIRST TO FIVE' : `${game.leftScore} — ${game.rightScore}`;
  showAnnounce(
    initial ? modePhrase() : 'NEXT POINT',
    serverPhrase(server),
    lead,
    'is-neutral',
    game.serveTimer - 0.12,
  );
  sound.serveTick(false);
}

function launchBall() {
  if (game.state !== 'serve') return;
  const speed = baseSpeed();
  const angle = rand(0.16, 0.34) * (Math.random() < 0.5 ? -1 : 1);
  ball.speed = speed;
  ball.vx = game.serveDir * speed * Math.cos(angle);
  ball.vy = speed * Math.sin(angle);
  ball.inPlay = true;
  game.state = 'playing';
  hideAnnounce();
  sound.serveTick(true);
  addRing(ball.x, ball.y, 'rgba(173,255,220,.7)', 4, 0.4, 1.2);
}

function scorePoint(scorer) {
  if (game.state !== 'playing') return;
  const ace = game.rally === 0;
  if (scorer === 0) {
    game.leftScore += 1;
    game.leftHits += game.rally;
  } else {
    game.rightScore += 1;
    game.rightHits += game.rally;
  }
  game.bestRally = Math.max(game.bestRally, game.rally);
  game.state = 'point';
  game.pointTimer = 1.35;
  game.scoredBy = scorer;
  game.rally = 0;
  ball.visible = false;
  ball.vx = 0;
  ball.vy = 0;

  const wonMatch = (scorer === 0 ? game.leftScore : game.rightScore) >= POINTS_TO_WIN;
  const burstX = scorer === 0 ? court.x + court.w + 10 : court.x - 10;
  const burstY = clamp(ball.y, court.y + 14, court.y + court.h - 14);
  const color = scorer === 0 ? '120,242,194' : '255,136,116';
  spawnScoreBurst(burstX, burstY, `rgba(${color},.95)`, wonMatch);
  game.shake = wonMatch ? 18 : 10;
  game.flash = wonMatch ? 0.28 : 0.14;
  game.flashColor = color;
  sound.score(scorer === 0 ? 0 : 1);
  if (navigator.vibrate) navigator.vibrate(wonMatch ? [25, 40, 70] : 20);
  updateScoreHud(scorer);

  if (wonMatch) {
    game.pendingEnd = true;
    game.winner = scorer;
    game.positionHeld = true;
    game.pointTimer = 1.55;
    const title = game.mode === 'local'
      ? `P${scorer + 1} WINS`
      : (scorer === 0 ? 'MATCH WON' : 'MATCH LOST');
    showAnnounce(
      `${game.leftScore} — ${game.rightScore} · FINAL`,
      title,
      'THE NIGHT REMEMBERS',
      scorer === 0 ? 'is-you' : 'is-rival',
      1.5,
    );
    sound.matchPoint();
  } else {
    game.serveDir = scorer === 0 ? 1 : -1;
    const scorerName = playerName(scorer);
    const atMatchPoint = game.leftScore === POINTS_TO_WIN - 1 || game.rightScore === POINTS_TO_WIN - 1;
    showAnnounce(
      atMatchPoint ? `MATCH POINT · ${scorerName}` : `POINT · ${scorerName}`,
      ace ? 'ACE' : 'POINT',
      `${game.leftScore} — ${game.rightScore}`,
      scorer === 0 ? 'is-you' : 'is-rival',
      1.28,
    );
  }
}

function finishPoint() {
  if (game.pendingEnd) {
    endMatch();
    return;
  }
  beginServe(game.serveDir, false);
}

function endMatch() {
  game.state = 'over';
  game.pendingEnd = false;
  game.positionHeld = false;
  setBodyState('over');
  hideAnnounce();
  const winner = game.winner;
  const winnerName = playerName(winner);
  const wonByYou = game.mode === 'cpu' ? winner === 0 : true;

  dom.endKicker.textContent = `MATCH COMPLETE · ${modePhrase()}`;
  const takes = game.mode === 'cpu' && winner === 0 ? 'TAKE' : 'TAKES';
  dom.endTitle.innerHTML = `${winnerName} ${takes} IT<span>.</span>`;
  if (game.mode === 'local') {
    dom.endSub.textContent = winner === 0 ? 'Player one owns the night.' : 'Player two owns the night.';
  } else {
    dom.endSub.textContent = winner === 0 ? 'The night court is yours.' : 'The machine holds the court.';
  }
  dom.endLeftScore.textContent = String(game.leftScore);
  dom.endRightScore.textContent = String(game.rightScore);
  dom.endLeftSide.classList.toggle('is-winner', winner === 0);
  dom.endLeftSide.classList.toggle('is-loser', winner !== 0);
  dom.endRightSide.classList.toggle('is-winner', winner === 1);
  dom.endRightSide.classList.toggle('is-loser', winner !== 1);
  dom.statRally.textContent = String(game.bestRally);
  dom.statTime.textContent = fmtTime(game.matchTime);
  dom.statWinner.textContent = winnerName;

  dom.endScreen.classList.add('is-open');
  dom.endScreen.setAttribute('aria-hidden', 'false');
  game.lastWinner = winner;
  spawnConfetti();
  game.flash = 0.2;
  game.flashColor = winner === 0 ? '120,242,194' : '255,136,116';
  sound.win(wonByYou);
  dom.rematchBtn.focus({ preventScroll: true });
}

function pauseGame() {
  if (!['playing', 'serve', 'point'].includes(game.state)) return;
  game.pausedFrom = game.state;
  game.state = 'paused';
  setBodyState('paused');
  dom.pauseRecap.textContent = `${playerName(0)} ${game.leftScore} — ${game.rightScore} ${playerName(1)}`;
  dom.pauseScreen.classList.add('is-open');
  dom.pauseScreen.setAttribute('aria-hidden', 'false');
  pointerMap.clear();
  syncPointerTargets();
  keys.clear();
  sound.ui();
  dom.resumeBtn.focus({ preventScroll: true });
}

function resumeGame() {
  if (game.state !== 'paused') return;
  game.state = game.pausedFrom;
  setBodyState('game');
  dom.pauseScreen.classList.remove('is-open');
  dom.pauseScreen.setAttribute('aria-hidden', 'true');
  pointerMap.clear();
  keys.clear();
  sound.resume();
  sound.ui();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

function restartFromUi() {
  dom.pauseScreen.classList.remove('is-open');
  dom.endScreen.classList.remove('is-open');
  dom.pauseScreen.setAttribute('aria-hidden', 'true');
  dom.endScreen.setAttribute('aria-hidden', 'true');
  startMatch();
}

function changeOpponent() {
  dom.endScreen.classList.remove('is-open');
  dom.endScreen.setAttribute('aria-hidden', 'true');
  openMenu();
}

function toggleMute() {
  sound.init();
  sound.resume();
  const muted = sound.toggleMuted();
  game.muted = muted;
  syncMuteUi();
  if (!muted) sound.select();
}

// ————— paddles —————

function keyAxes(side) {
  const upW = keys.has('KeyW');
  const downW = keys.has('KeyS');
  const upArrow = keys.has('ArrowUp');
  const downArrow = keys.has('ArrowDown');
  if (game.mode === 'local') {
    return side === 'left'
      ? { up: upW, down: downW }
      : { up: upArrow, down: downArrow };
  }
  return { up: upW || upArrow, down: downW || downArrow };
}

function updateHumanPaddle(p, dt) {
  p.prevY = p.y;
  const minY = court.y;
  const maxY = court.y + court.h - p.h;
  const speed = court.h * (window.innerHeight < 560 ? 1.18 : 1.03);

  if (p.pointerY !== null) {
    const center = p.y + p.h / 2;
    const desired = clamp(p.pointerY, court.y, court.y + court.h) - center;
    const maxStep = speed * 1.55 * dt;
    const step = clamp(desired * 0.72, -maxStep, maxStep);
    p.y += step;
    p.vy = step / Math.max(dt, 0.0001);
  } else {
    const axes = keyAxes(p.side);
    const direction = (axes.down ? 1 : 0) - (axes.up ? 1 : 0);
    const targetV = direction * speed;
    p.vy += (targetV - p.vy) * Math.min(1, dt * 24);
    p.y += p.vy * dt;
  }

  if (p.y < minY) {
    p.y = minY;
    if (p.vy < 0) p.vy = 0;
  } else if (p.y > maxY) {
    p.y = maxY;
    if (p.vy > 0) p.vy = 0;
  }
}

function predictBallY(targetX) {
  if (Math.abs(ball.vx) < 1) return court.y + court.h / 2;
  const t = (targetX - ball.x) / ball.vx;
  if (t < 0) return clamp(ball.y, court.y, court.y + court.h);
  // Deliberately read the line, not every bank. This is what makes a human
  // return down the wall so dangerous, and keeps the machine beatable.
  return clamp(ball.y + ball.vy * t, court.y + ball.r, court.y + court.h - ball.r);
}

function updateAi(dt) {
  const p = right;
  const profile = CPU_PROFILES[game.difficulty];
  p.prevY = p.y;
  const controlsActive = game.state === 'playing';
  const incoming = controlsActive && ball.vx > 0;

  if (!controlsActive) {
    ai.target = court.y + court.h / 2;
    ai.timer = 0;
  } else {
    ai.timer -= dt;
    if (incoming) {
      if (ai.timer <= 0) {
        const predicted = predictBallY(p.x - ball.r * 0.6);
        const blend = lerp(ball.y, predicted, profile.anticipation);
        const error = rand(-1, 1) * court.h * profile.error;
        const drift = Math.sin(game.matchTime * 0.75 + 1.4) * court.h * 0.008;
        const lapse = Math.random() < profile.mistake ? rand(-0.2, 0.2) * court.h : 0;
        ai.target = blend + error + drift + lapse;
        ai.timer = profile.reaction * rand(0.78, 1.28);
      }
    } else {
      ai.target = court.y + court.h * 0.5 + Math.sin(game.matchTime * 0.7) * court.h * 0.05;
      ai.timer = Math.max(ai.timer, 0);
    }
  }

  const target = clamp(ai.target, court.y + p.h * 0.5, court.y + court.h - p.h * 0.5);
  const desired = target - (p.y + p.h / 2);
  const responsiveness = incoming ? profile.speed : profile.speed * 0.45;
  const maxStep = court.h * responsiveness * dt;
  const step = clamp(desired * 7, -maxStep, maxStep);
  p.y += step;
  p.vy = step / Math.max(dt, 0.0001);
  p.y = clamp(p.y, court.y, court.y + court.h - p.h);
}

function updatePaddles(dt) {
  const control = game.state === 'playing' || game.state === 'serve';
  if (control) {
    updateHumanPaddle(left, dt);
    if (game.mode === 'local') {
      updateHumanPaddle(right, dt);
    } else {
      updateAi(dt);
    }
  } else {
    left.prevY = left.y;
    right.prevY = right.y;
    left.vy = 0;
    right.vy = 0;
  }
}

// ————— ball —————

function bounceWall(topWall) {
  const y = topWall ? court.y + ball.r : court.y + court.h - ball.r;
  ball.y = y;
  ball.vy = topWall ? Math.abs(ball.vy) : -Math.abs(ball.vy);
  const color = topWall ? 'rgba(173,255,220,.75)' : 'rgba(255,218,208,.75)';
  addRing(ball.x, topWall ? court.y + 1 : court.y + court.h - 1, color, 4, 0.32, 1);
  spawnSpark(ball.x, topWall ? court.y + 1 : court.y + court.h - 1, color, 6, 125, topWall ? Math.PI / 2 : -Math.PI / 2);
  game.shake = Math.min(12, game.shake + 2.4);
  sound.wall();
}

function collidePaddle(p) {
  const r = ball.r;
  const isLeft = p.side === 'left';
  const plane = isLeft ? p.x + p.w : p.x;
  const prevEdge = isLeft ? ball.prevX - r : ball.prevX + r;
  const edge = isLeft ? ball.x - r : ball.x + r;

  if (isLeft) {
    if (ball.vx >= 0 || prevEdge < plane || edge > plane) return false;
  } else if (ball.vx <= 0 || prevEdge > plane || edge < plane) {
    return false;
  }

  const denom = prevEdge - edge;
  const t = denom === 0 ? 0 : clamp((prevEdge - plane) / denom, 0, 1);
  const hitY = lerp(ball.prevY, ball.y, t);
  if (hitY < p.y - r * 0.65 || hitY > p.y + p.h + r * 0.65) return false;

  const rel = clamp((hitY - (p.y + p.h / 2)) / (p.h / 2 + r * 0.5), -1, 1);
  const direction = isLeft ? 1 : -1;
  const nextSpeed = Math.min(ball.speed * 1.045 + 5, maxSpeed());
  const angle = clamp(rel * 0.84 + p.vy / (court.h * 3.3), -0.94, 0.94);

  ball.speed = nextSpeed;
  ball.x = isLeft ? plane + r + 0.7 : plane - r - 0.7;
  ball.y = hitY;
  ball.vx = direction * nextSpeed * Math.cos(angle);
  ball.vy = nextSpeed * Math.sin(angle);
  ball.hitFlash = 1;

  game.rally += 1;
  game.bestRally = Math.max(game.bestRally, game.rally);
  p.hitGlow = 1;
  const color = isLeft ? 'rgba(173,255,220,.95)' : 'rgba(255,206,195,.95)';
  addRing(plane, hitY, color, ball.r + 3, 0.3, 1.4);
  spawnSpark(plane, hitY, color, 12, 210, isLeft ? 0 : Math.PI);
  game.shake = Math.min(12, game.shake + 3.4);
  game.flash = Math.max(game.flash, 0.035);
  game.flashColor = isLeft ? '120,242,194' : '255,136,116';
  sound.ball(rel * 0.7, nextSpeed / baseSpeed());
  if (navigator.vibrate) navigator.vibrate(8);
  return true;
}

function updateBall(dt) {
  ball.prevX = ball.x;
  ball.prevY = ball.y;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.y - ball.r < court.y) bounceWall(true);
  else if (ball.y + ball.r > court.y + court.h) bounceWall(false);

  collidePaddle(left);
  collidePaddle(right);

  if (ball.x + ball.r < court.x) {
    scorePoint(1);
    return;
  }
  if (ball.x - ball.r > court.x + court.w) {
    scorePoint(0);
    return;
  }

  const last = ball.trail[ball.trail.length - 1];
  if (!last || (last.x - ball.x) ** 2 + (last.y - ball.y) ** 2 > 9) {
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 28) ball.trail.shift();
  }
}

// ————— painting —————

function drawBackdrop(t) {
  const w = view.w;
  const h = view.h;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#071417');
  g.addColorStop(0.48, '#061114');
  g.addColorStop(1, '#040b0d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const breathe = 0.75 + Math.sin(t * 0.24) * 0.08;
  const aura = ctx.createRadialGradient(w * 0.5, h * 0.44, 0, w * 0.5, h * 0.44, Math.max(w, h) * 0.65);
  aura.addColorStop(0, `rgba(24, 96, 89, ${0.17 * breathe})`);
  aura.addColorStop(0.45, `rgba(12, 55, 54, ${0.08 * breathe})`);
  aura.addColorStop(1, 'rgba(4, 11, 13, 0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, w, h);

  const sideGlow = ctx.createLinearGradient(0, 0, w, 0);
  sideGlow.addColorStop(0, 'rgba(120,242,194,.018)');
  sideGlow.addColorStop(0.24, 'rgba(120,242,194,0)');
  sideGlow.addColorStop(0.76, 'rgba(255,136,116,0)');
  sideGlow.addColorStop(1, 'rgba(255,136,116,.018)');
  ctx.fillStyle = sideGlow;
  ctx.fillRect(0, 0, w, h);

  // Thin survey lines outside the court.
  ctx.save();
  ctx.strokeStyle = 'rgba(177, 255, 231, .035)';
  ctx.lineWidth = 1;
  const margin = Math.max(16, court.x * 0.36);
  for (let i = 0; i < 4; i++) {
    const x = margin + i * Math.max(18, court.x * 0.15);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, view.h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCourt(t) {
  const r = metrics.courtRadius;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 18;
  roundRectPath(ctx, court.x, court.y, court.w, court.h, r);
  ctx.fillStyle = '#061416';
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, court.x, court.y, court.w, court.h, r);
  ctx.clip();

  const surface = ctx.createLinearGradient(0, court.y, 0, court.y + court.h);
  surface.addColorStop(0, '#0a2124');
  surface.addColorStop(0.38, '#081b1e');
  surface.addColorStop(0.72, '#071619');
  surface.addColorStop(1, '#061114');
  ctx.fillStyle = surface;
  ctx.fillRect(court.x, court.y, court.w, court.h);

  const lGlow = ctx.createRadialGradient(
    court.x + court.w * 0.13, court.y + court.h * 0.5, 0,
    court.x + court.w * 0.13, court.y + court.h * 0.5, court.h * 0.82,
  );
  lGlow.addColorStop(0, 'rgba(70, 221, 174, .085)');
  lGlow.addColorStop(0.52, 'rgba(43, 155, 128, .025)');
  lGlow.addColorStop(1, 'rgba(43, 155, 128, 0)');
  ctx.fillStyle = lGlow;
  ctx.fillRect(court.x, court.y, court.w * 0.55, court.h);

  const rGlow = ctx.createRadialGradient(
    court.x + court.w * 0.87, court.y + court.h * 0.5, 0,
    court.x + court.w * 0.87, court.y + court.h * 0.5, court.h * 0.82,
  );
  rGlow.addColorStop(0, 'rgba(255, 131, 108, .055)');
  rGlow.addColorStop(0.52, 'rgba(170, 67, 54, .018)');
  rGlow.addColorStop(1, 'rgba(170, 67, 54, 0)');
  ctx.fillStyle = rGlow;
  ctx.fillRect(court.x + court.w * 0.45, court.y, court.w * 0.55, court.h);

  // pinpoint grid
  ctx.fillStyle = 'rgba(191,255,236,.055)';
  const gap = clamp(court.w * 0.042, 30, 58);
  for (let x = court.x + gap; x < court.x + court.w; x += gap) {
    for (let y = court.y + 30; y < court.y + court.h - 20; y += gap) {
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  // service bands and mid-court
  ctx.save();
  ctx.strokeStyle = 'rgba(196,255,236,.075)';
  ctx.lineWidth = 1;
  for (const ratio of [0.25, 0.75]) {
    ctx.setLineDash([2, 10]);
    ctx.beginPath();
    ctx.moveTo(court.x + court.w * ratio, court.y + 18);
    ctx.lineTo(court.x + court.w * ratio, court.y + court.h - 18);
    ctx.stroke();
  }

  const midX = court.x + court.w / 2;
  const midY = court.y + court.h / 2;
  ctx.setLineDash([3, 9]);
  ctx.strokeStyle = 'rgba(196,255,236,.16)';
  ctx.beginPath();
  ctx.moveTo(midX, court.y + 12);
  ctx.lineTo(midX, court.y + court.h - 12);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(196,255,236,.09)';
  ctx.beginPath();
  ctx.arc(midX, midY, Math.min(court.h * 0.14, court.w * 0.08), 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(midX, midY, 2, 0, TAU);
  ctx.fillStyle = 'rgba(196,255,236,.22)';
  ctx.fill();
  ctx.restore();

  // huge court mark
  ctx.save();
  ctx.globalAlpha = 0.032;
  ctx.fillStyle = '#c9ffeb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic 900 ${Math.floor(court.h * 0.55)}px "Arial Narrow", "Arial", sans-serif`;
  ctx.fillText('05', midX, midY + court.h * 0.01);
  ctx.restore();

  // slow scanning band
  const scanY = court.y + ((t * 0.035) % 1) * court.h;
  const scan = ctx.createLinearGradient(0, scanY - court.h * 0.09, 0, scanY + court.h * 0.09);
  scan.addColorStop(0, 'rgba(180,255,231,0)');
  scan.addColorStop(0.5, 'rgba(180,255,231,.018)');
  scan.addColorStop(1, 'rgba(180,255,231,0)');
  ctx.fillStyle = scan;
  ctx.fillRect(court.x, scanY - court.h * 0.09, court.w, court.h * 0.18);

  // inner edge
  ctx.strokeStyle = 'rgba(205,255,239,.075)';
  ctx.lineWidth = 1;
  ctx.strokeRect(court.x + 1, court.y + 1, court.w - 2, court.h - 2);

  ctx.restore();

  // bounce walls
  const topGrad = ctx.createLinearGradient(court.x, 0, court.x + court.w, 0);
  topGrad.addColorStop(0, 'rgba(120,242,194,.24)');
  topGrad.addColorStop(0.18, 'rgba(213,255,241,.42)');
  topGrad.addColorStop(0.5, 'rgba(205,255,238,.18)');
  topGrad.addColorStop(0.82, 'rgba(255,207,196,.34)');
  topGrad.addColorStop(1, 'rgba(255,136,116,.22)');
  ctx.save();
  ctx.strokeStyle = topGrad;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(court.x + 18, court.y + 0.5);
  ctx.lineTo(court.x + court.w - 18, court.y + 0.5);
  ctx.moveTo(court.x + 18, court.y + court.h - 0.5);
  ctx.lineTo(court.x + court.w - 18, court.y + court.h - 0.5);
  ctx.stroke();
  ctx.restore();

  // frame + corner brackets
  const border = ctx.createLinearGradient(court.x, 0, court.x + court.w, 0);
  border.addColorStop(0, 'rgba(163,255,225,.25)');
  border.addColorStop(0.48, 'rgba(190,255,235,.09)');
  border.addColorStop(1, 'rgba(255,171,153,.22)');
  roundRectPath(ctx, court.x + 0.5, court.y + 0.5, court.w - 1, court.h - 1, r);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = 'rgba(203,255,239,.22)';
  ctx.lineWidth = 1.5;
  const b = 20;
  const pad = 9;
  const corners = [
    [court.x + pad, court.y + pad, 1, 1],
    [court.x + court.w - pad, court.y + pad, -1, 1],
    [court.x + pad, court.y + court.h - pad, 1, -1],
    [court.x + court.w - pad, court.y + court.h - pad, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + dx * b, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * b);
    ctx.stroke();
  }
  ctx.restore();

  // motes
  ctx.save();
  for (const m of motes) {
    ctx.globalAlpha = m.a;
    ctx.fillStyle = 'rgba(193,255,235,1)';
    ctx.beginPath();
    ctx.arc(court.x + m.x * court.w, court.y + m.y * court.h, m.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawPaddle(p, accent, time) {
  if (!p) return;
  const glow = 16 + p.hitGlow * 24;
  const radius = p.w / 2;
  const cx = p.x + p.w / 2;

  ctx.save();
  const aura = ctx.createRadialGradient(cx, p.y + p.h / 2, 0, cx, p.y + p.h / 2, p.h * 0.74);
  aura.addColorStop(0, `rgba(${accent},${0.09 + p.hitGlow * 0.09})`);
  aura.addColorStop(0.6, `rgba(${accent},${0.025 + p.hitGlow * 0.03})`);
  aura.addColorStop(1, `rgba(${accent},0)`);
  ctx.fillStyle = aura;
  ctx.fillRect(cx - p.h * 0.8, p.y + p.h / 2 - p.h * 0.8, p.h * 1.6, p.h * 1.6);
  ctx.restore();

  // ghost of motion
  if (Math.abs(p.vy) > court.h * 0.25) {
    const offset = clamp(-p.vy * 0.012, -8, 8);
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#f4f7ef';
    roundRectPath(ctx, p.x, p.y + offset, p.w, p.h, radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor = `rgba(${accent},${0.62 + p.hitGlow * 0.3})`;
  ctx.shadowBlur = glow;
  const body = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.5, '#f2f7ef');
  body.addColorStop(1, '#dbe8df');
  ctx.fillStyle = body;
  roundRectPath(ctx, p.x, p.y, p.w, p.h, radius);
  ctx.fill();
  ctx.restore();

  // luminous ends
  ctx.save();
  ctx.fillStyle = `rgba(${accent},.9)`;
  ctx.shadowColor = `rgba(${accent},.7)`;
  ctx.shadowBlur = 8;
  roundRectPath(ctx, p.x, p.y + 2, p.w, Math.min(10, p.h * 0.09), radius);
  ctx.fill();
  roundRectPath(ctx, p.x, p.y + p.h - Math.min(10, p.h * 0.09) - 2, p.w, Math.min(10, p.h * 0.09), radius);
  ctx.fill();
  ctx.restore();

  // grip marks
  ctx.save();
  ctx.strokeStyle = 'rgba(6,20,20,.26)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const y = p.y + p.h * (0.38 + i * 0.08);
    ctx.beginPath();
    ctx.moveTo(p.x + p.w * 0.27, y);
    ctx.lineTo(p.x + p.w * 0.73, y);
    ctx.stroke();
  }
  ctx.restore();

  if (p.hitGlow > 0.02) {
    ctx.save();
    ctx.globalAlpha = p.hitGlow * 0.65;
    ctx.strokeStyle = `rgba(${accent},1)`;
    ctx.lineWidth = 1.2;
    roundRectPath(ctx, p.x - 3, p.y - 3, p.w + 6, p.h + 6, radius + 3);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBall(b, accent = '120,242,194') {
  if (!b || !b.visible && b.visible !== undefined) return;
  const r = b.r;

  if (b.trail && b.trail.length > 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 1; i < b.trail.length; i++) {
      const p0 = b.trail[i - 1];
      const p1 = b.trail[i];
      const q = i / b.trail.length;
      ctx.strokeStyle = `rgba(${accent},${0.08 + q * q * 0.24})`;
      ctx.lineWidth = Math.max(1, r * 1.2 * q);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const aura = ctx.createRadialGradient(b.x, b.y, r * 0.2, b.x, b.y, r * (2.8 + (b.hitFlash || 0)));
  aura.addColorStop(0, 'rgba(230,255,247,.7)');
  aura.addColorStop(0.2, `rgba(${accent},.38)`);
  aura.addColorStop(0.6, `rgba(${accent},.07)`);
  aura.addColorStop(1, `rgba(${accent},0)`);
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * (2.8 + (b.hitFlash || 0)), 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(195,255,235,.86)';
  ctx.shadowBlur = 18 + (b.hitFlash || 0) * 22;
  ctx.fillStyle = '#f8fff9';
  ctx.beginPath();
  ctx.arc(b.x, b.y, r, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  const core = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.35, 0, b.x, b.y, r);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.55, '#e8fff7');
  core.addColorStop(1, '#a9f6d6');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(b.x, b.y, r * 0.72, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawServeCue(t) {
  if (game.state !== 'serve') return;
  const pulse = (Math.sin(ball.servePulse) + 1) * 0.5;
  ctx.save();
  ctx.strokeStyle = `rgba(120,242,194,${0.14 + pulse * 0.24})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 6]);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r + 7 + pulse * 8, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  const dir = game.serveDir;
  const startX = ball.x + dir * (ball.r + 18);
  const endX = ball.x + dir * (ball.r + 45 + pulse * 7);
  ctx.strokeStyle = 'rgba(173,255,220,.4)';
  ctx.beginPath();
  ctx.moveTo(startX, ball.y);
  ctx.lineTo(endX, ball.y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(173,255,220,.55)';
  ctx.beginPath();
  ctx.moveTo(endX + dir * 4, ball.y);
  ctx.lineTo(endX - dir * 3, ball.y - 3.5);
  ctx.lineTo(endX - dir * 3, ball.y + 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEffects() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const r of rings) {
    const q = r.life / r.maxLife;
    ctx.strokeStyle = r.color.replace(/[\d.]+\)$/, `${q * 0.42})`);
    ctx.lineWidth = r.width * q;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, TAU);
    ctx.stroke();
  }

  for (const p of particles) {
    const q = clamp(p.life / p.maxLife, 0, 1);
    if (p.kind === 'confetti') {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = q;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
      ctx.restore();
      continue;
    }
    ctx.globalAlpha = q * 0.8;
    if (p.kind === 'streak') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(0.6, p.size * q);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + q * 0.8), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawGame(t) {
  drawPaddle(left, '120,242,194', t);
  drawPaddle(right, '255,136,116', t);
  if (ball.visible) drawBall(ball, '120,242,194');
  drawServeCue(t);
  drawEffects();
}

function drawDemo(t) {
  if (!demo) return;
  drawPaddle(demo.left, '120,242,194', t);
  drawPaddle(demo.right, '255,136,116', t);
  drawBall(demo.ball, '120,242,194');
  drawEffects();
}

function drawVignette() {
  const g = ctx.createRadialGradient(
    view.w * 0.5, view.h * 0.46, Math.min(view.w, view.h) * 0.2,
    view.w * 0.5, view.h * 0.5, Math.max(view.w, view.h) * 0.78,
  );
  g.addColorStop(0, 'rgba(2,7,8,0)');
  g.addColorStop(0.64, 'rgba(2,7,8,.08)');
  g.addColorStop(1, 'rgba(2,7,8,.54)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
}

function render(now) {
  const t = now / 1000;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);
  drawBackdrop(t);

  let shakeX = 0;
  let shakeY = 0;
  if (game.shake > 0 && game.state !== 'menu' && game.state !== 'paused') {
    shakeX = rand(-game.shake, game.shake) * 0.45;
    shakeY = rand(-game.shake, game.shake) * 0.45;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawCourt(t);
  if (game.state === 'menu') {
    drawDemo(t);
  } else {
    drawGame(t);
  }
  ctx.restore();

  drawVignette();

  if (game.flash > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(${game.flashColor},${game.flash * 0.36})`;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();
  }
}

// ————— loop —————

function updateFixed(dt) {
  if (!['serve', 'playing', 'point'].includes(game.state)) return;
  game.matchTime += dt;
  updatePaddles(dt);

  if (game.state === 'serve') {
    game.serveTimer -= dt;
    if (game.serveTimer <= 0) launchBall();
  } else if (game.state === 'playing') {
    updateBall(dt);
  } else if (game.state === 'point') {
    game.pointTimer -= dt;
    if (game.pointTimer <= 0) finishPoint();
  }
}

function updateHudDynamic() {
  const showRally = game.state === 'playing' && game.rally >= 2;
  if (showRally !== uiCache.rallyShown) {
    dom.rallyBadge.classList.toggle('show', showRally);
    uiCache.rallyShown = showRally;
  }
  if (showRally && dom.rallyCount.textContent !== String(game.rally)) {
    dom.rallyCount.textContent = String(game.rally);
  }
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  if (game.state === 'menu') {
    updateDemo(dt);
    updateEffects(dt);
  } else if (game.state !== 'paused') {
    if (game.state !== 'over') {
      accumulator += dt;
      let steps = 0;
      while (accumulator >= STEP && steps < 8) {
        updateFixed(STEP);
        accumulator -= STEP;
        steps += 1;
      }
      if (steps >= 8) accumulator = 0;
    }
    updateEffects(dt);
    if (game.announceTimer > 0) {
      game.announceTimer -= dt;
      if (game.announceTimer <= 0) dom.announce.classList.remove('show');
    }
  }

  updateHudDynamic();
  render(now);
  requestAnimationFrame(frame);
}

// ————— pointers and keys —————

function applyPointer(side) {
  const pad = side === 'left' ? left : right;
  let total = 0;
  let count = 0;
  for (const entry of pointerMap.values()) {
    if (entry.side === side) {
      total += entry.y;
      count += 1;
    }
  }
  pad.pointerY = count ? total / count : null;
}

function syncPointerTargets() {
  applyPointer('left');
  applyPointer('right');
}

function endPointer(id) {
  const entry = pointerMap.get(id);
  if (!entry) return;
  pointerMap.delete(id);
  applyPointer(entry.side);
}

function onPointerDown(event) {
  if (!(game.state === 'playing' || game.state === 'serve')) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  sound.init();
  sound.resume();
  const side = game.mode === 'local'
    ? (event.clientX < view.w / 2 ? 'left' : 'right')
    : 'left';
  pointerMap.set(event.pointerId, { side, y: clamp(event.clientY, court.y, court.y + court.h) });
  applyPointer(side);
  event.preventDefault();
}

function onPointerMove(event) {
  const entry = pointerMap.get(event.pointerId);
  if (!entry) return;
  entry.y = clamp(event.clientY, court.y, court.y + court.h);
  applyPointer(entry.side);
  event.preventDefault();
}

function onPointerUp(event) {
  endPointer(event.pointerId);
}

function setupInput() {
  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  window.addEventListener('keydown', (event) => {
    const code = event.code;
    const targetIsButton = event.target && event.target.closest && event.target.closest('button');

    if (game.state === 'menu') {
      if (code === 'KeyM') {
        event.preventDefault();
        toggleMute();
        return;
      }
      if ((code === 'Enter' || code === 'Space') && !targetIsButton) {
        event.preventDefault();
        startMatch();
      }
      return;
    }

    if (game.state === 'over') {
      if ((code === 'Enter' || code === 'Space') && !targetIsButton) {
        event.preventDefault();
        restartFromUi();
      } else if (code === 'Escape' && !targetIsButton) {
        event.preventDefault();
        changeOpponent();
      }
      return;
    }

    if (game.state === 'paused') {
      if (code === 'Escape' || code === 'KeyP') {
        event.preventDefault();
        resumeGame();
      } else if (code === 'KeyR') {
        event.preventDefault();
        restartFromUi();
      } else if (code === 'KeyM') {
        event.preventDefault();
        toggleMute();
      }
      return;
    }

    if (code === 'Escape' || code === 'KeyP') {
      event.preventDefault();
      pauseGame();
      return;
    }
    if (code === 'KeyM') {
      event.preventDefault();
      toggleMute();
      return;
    }
    if (code === 'KeyW' || code === 'KeyS' || code === 'ArrowUp' || code === 'ArrowDown') {
      event.preventDefault();
      keys.add(code);
      sound.resume();
    } else if (code === 'Space') {
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  window.addEventListener('blur', () => {
    keys.clear();
    pointerMap.clear();
    syncPointerTargets();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ['playing', 'serve', 'point'].includes(game.state)) pauseGame();
  });
}

// ————— menu controls —————

function setupUi() {
  [...dom.modeSelect.querySelectorAll('button')].forEach((btn) => {
    btn.addEventListener('click', () => {
      sound.init();
      sound.resume();
      sound.select();
      game.mode = btn.dataset.mode === 'local' ? 'local' : 'cpu';
      updateModeSelection();
    });
  });

  [...dom.difficultySelect.querySelectorAll('button')].forEach((btn) => {
    btn.addEventListener('click', () => {
      if (game.mode === 'local') return;
      sound.init();
      sound.resume();
      sound.select();
      game.difficulty = btn.dataset.diff;
      if (!CPU_PROFILES[game.difficulty]) game.difficulty = 'sharp';
      updateDifficultyUi();
    });
  });

  dom.startBtn.addEventListener('click', () => {
    startMatch();
  });

  dom.pauseBtn.addEventListener('click', () => {
    sound.init();
    sound.resume();
    pauseGame();
  });

  dom.soundBtn.addEventListener('click', () => {
    toggleMute();
  });

  dom.menuSoundLabel.addEventListener('click', () => {
    toggleMute();
  });

  dom.resumeBtn.addEventListener('click', () => resumeGame());
  dom.restartBtn.addEventListener('click', () => {
    sound.init();
    sound.resume();
    restartFromUi();
  });
  dom.menuBtn.addEventListener('click', () => {
    sound.init();
    sound.resume();
    sound.ui();
    openMenu();
  });
  dom.rematchBtn.addEventListener('click', () => {
    sound.init();
    sound.resume();
    restartFromUi();
  });
  dom.changeBtn.addEventListener('click', () => {
    sound.ui();
    changeOpponent();
  });

  window.addEventListener('resize', () => {
    resize();
  });

  window.addEventListener('pointerdown', () => {
    sound.init();
    sound.resume();
  }, { passive: true });
}

function init() {
  document.body.classList.toggle('touch', IS_TOUCH);
  setBodyState('menu');
  resize();
  updateModeSelection();
  updateControlsTip();
  syncMuteUi();
  openMenu();
  setupInput();
  setupUi();
  lastFrame = performance.now();
  requestAnimationFrame(frame);

  // Small debug handle for browser verification and tuning.
  window.__nightRally = {
    game, ball, left, right, court, metrics, profiles: CPU_PROFILES,
    startMatch, pauseGame, resumeGame, openMenu, restartFromUi,
    launchBall, scorePoint, endMatch,
    simulate(seconds = 2) {
      const steps = Math.max(1, Math.round(seconds / STEP));
      for (let i = 0; i < steps; i++) {
        updateFixed(STEP);
        updateEffects(STEP);
      }
      updateHudDynamic();
      render(performance.now());
    },
  };
}

init();
