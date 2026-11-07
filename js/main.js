// Molt — main game loop, input and progression.
import {
  TAU, clamp, lerp, dist, dist2, lerpAngle, mulberry32,
  pick, between, fmtTime,
} from './util.js';
import {
  WORLD_W, WORLD_H, ZONES, STAGES, MOLT_COST, TYPES, FLOWER_RESPAWN,
  pathY, zoneIndexAt, BARRIERS,
} from './world.js';
import { PALETTES, paintZoneCanvas, drawPuddle, softBlob, brushCurve } from './painting.js';
import { drawPlayer, drawCritter, drawFlower } from './creatures.js';
import { paintTitleArt } from './title.js';
import { Soundscape } from './audio.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const ctx = canvas.getContext('2d');
const view = { w: window.innerWidth, h: window.innerHeight, dpr: 1 };

const ui = {
  stageName: $('stageName'), stageNumeral: $('stageNumeral'), stageTrait: $('stageTrait'),
  stageZone: $('stageZone'), bioNum: $('bioNum'), bioMax: $('bioMax'),
  miniJourney: $('miniJourney'),
  vitFill: $('vitFill'), vitNum: $('vitNum'), vitals: $('vitals'),
  hungFill: $('hungFill'), hungNum: $('hungNum'),
  thirstFill: $('thirstFill'), thirstNum: $('thirstNum'),
  moltWrap: $('moltWrap'), moltBtn: $('moltBtn'), moltFill: $('moltFill'), moltNote: $('moltNote'),
  hint: $('hint'), journeyFill: $('journeyFill'), journeyBug: $('journeyBug'),
  bossBar: $('bossBar'), bossFill: $('bossFill'),
  zoneToast: $('zoneToast'), ztName: $('ztName'), ztLine: $('ztLine'),
  floatMsg: $('floatMsg'),
  titleScreen: $('titleScreen'), beginBtn: $('beginBtn'), continueBtn: $('continueBtn'),
  titleControls: $('titleControls'),
  pauseScreen: $('pauseScreen'), resumeBtn: $('resumeBtn'), restartBtn: $('restartBtn'),
  evolveScreen: $('evolveScreen'), evolveName: $('evolveName'), evolveRoman: $('evolveRoman'),
  evolveTrait: $('evolveTrait'), evolveStats: $('evolveStats'), emergeBtn: $('emergeBtn'),
  deathScreen: $('deathScreen'), deathLine: $('deathLine'), deathStats: $('deathStats'), riseBtn: $('riseBtn'),
  winScreen: $('winScreen'), winStats: $('winStats'), wanderBtn: $('wanderBtn'), againBtn: $('againBtn'),
  loading: $('loading'), loadingFill: $('loadingFill'),
  muteBtn: $('muteBtn'), pauseBtn: $('pauseBtn'), dashBtn: $('dashBtn'),
  stick: $('stick'), stickKnob: $('stickKnob'),
  titleArt: $('titleArt'),
};

const SAVE_KEY = 'molt.save.v2';
const sound = new Soundscape();
const isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  || (('ontouchstart' in window) && navigator.maxTouchPoints > 0);

const zoneArt = [null, null, null, null];
const game = {
  state: 'title',
  stage: 0, biomass: 0, eaten: 0, playTime: 0, time: 0,
  zones: ZONES,
  mobs: [], flowers: [], puddles: [], particles: [], texts: [], motes: [],
  player: null,
  cam: { x: 600, y: 900, zoom: 1, sx: 0, sy: 0 },
  zoneIndex: 0, boss: null, bossEngaged: false, bossDead: false,
  shake: 0, hurtFlash: 0, slowmo: 0, winTimer: 0,
  drinking: false, blocked: false, toughCd: 0, flowerCd: 0, splashCd: 0,
  hintCd: 0, hintText: '', saveAt: 0, muted: false,
  toastTimer: 0, floatTimer: 0, introTimer: 0, bossIntro: false,
  nextMilestone: 0,
};

const keys = new Set();
const pointer = { active: false, x: 0, y: 0, id: null };
const stick = { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0 };
let dashQueued = false;
let rafLast = performance.now();
let painting = false;
let toastTimeout = null;
let floatTimeout = null;

const textCache = new WeakMap();
function setText(el, txt) {
  const old = textCache.get(el);
  if (old !== txt) { el.textContent = txt; textCache.set(el, txt); }
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// ————————————————————————————————————————————————
// view & input
// ————————————————————————————————————————————————

function resize() {
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  view.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(view.w * view.dpr);
  canvas.height = Math.round(view.h * view.dpr);
  canvas.style.width = `${view.w}px`;
  canvas.style.height = `${view.h}px`;
  if (game.state === 'title') paintTitleArt(ui.titleArt);
  if (game.player) clampCamera(true);
}

function canvasPointer(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing' || e.button > 0) return;
  pointer.active = true;
  pointer.id = e.pointerId;
  const p = canvasPointer(e);
  pointer.x = p.x; pointer.y = p.y;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointer.active || e.pointerId !== pointer.id) return;
  const p = canvasPointer(e);
  pointer.x = p.x; pointer.y = p.y;
});
function endPointer(e) {
  if (e.pointerId !== pointer.id) return;
  pointer.active = false;
  pointer.id = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
  if (e.repeat && code !== 'Space') return;
  keys.add(code);
  if (code === 'Escape') {
    if (game.state === 'playing') pauseGame();
    else if (game.state === 'paused') resumeGame();
  }
  if (code === 'KeyE') {
    if (game.state === 'playing') tryMolt();
    else if (game.state === 'evolve') emerge();
  }
  if (code === 'Space' && game.state === 'playing') dashQueued = true;
  if (code === 'KeyM') toggleMute();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); pointer.active = false; });

// virtual stick
function stickCenter() {
  const r = ui.stick.getBoundingClientRect();
  stick.cx = r.left + r.width / 2;
  stick.cy = r.top + r.height / 2;
}
function moveStick(e) {
  const dx = e.clientX - stick.cx;
  const dy = e.clientY - stick.cy;
  const max = 42;
  const len = Math.hypot(dx, dy);
  const k = len > max ? max / len : 1;
  const ox = dx * k, oy = dy * k;
  stick.x = ox / max;
  stick.y = oy / max;
  ui.stickKnob.style.transform = `translate(${ox}px, ${oy}px)`;
}
ui.stick.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  e.preventDefault();
  stick.active = true;
  stick.id = e.pointerId;
  stickCenter();
  try { ui.stick.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
  moveStick(e);
});
ui.stick.addEventListener('pointermove', (e) => {
  if (!stick.active || e.pointerId !== stick.id) return;
  moveStick(e);
});
function endStick(e) {
  if (e.pointerId !== stick.id) return;
  stick.active = false;
  stick.id = null;
  stick.x = 0; stick.y = 0;
  ui.stickKnob.style.transform = 'translate(0px, 0px)';
}
ui.stick.addEventListener('pointerup', endStick);
ui.stick.addEventListener('pointercancel', endStick);

ui.dashBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (game.state === 'playing') dashQueued = true;
});

function inputVector() {
  let ix = 0, iy = 0, mag = 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iy += 1;
  if (ix || iy) {
    const l = Math.hypot(ix, iy);
    return { x: ix / l, y: iy / l, mag: 1 };
  }
  if (stick.active && (stick.x || stick.y)) {
    const l = Math.hypot(stick.x, stick.y);
    if (l > 0.08) return { x: stick.x / Math.max(1, l), y: stick.y / Math.max(1, l), mag: Math.min(1, l) };
  }
  if (pointer.active && !isTouch) {
    const wx = game.cam.x + (pointer.x - view.w / 2) / game.cam.zoom;
    const wy = game.cam.y + (pointer.y - view.h / 2) / game.cam.zoom;
    const dx = wx - game.player.x, dy = wy - game.player.y;
    const d = Math.hypot(dx, dy);
    if (d > 14) return { x: dx / d, y: dy / d, mag: clamp(d / 150, 0.25, 1) };
  }
  return { x: 0, y: 0, mag: 0 };
}

// ————————————————————————————————————————————————
// progression & spawning
// ————————————————————————————————————————————————

function createPlayerData(stage) {
  const st = STAGES[stage];
  return {
    x: 500, y: pathY(500), vx: 0, vy: 0, angle: 0, r: st.r, stage,
    hp: st.hp, maxHp: st.hp, hunger: 70, thirst: 62, walk: 0,
    biteT: 0, hurtT: 0, dashT: 0, dashCd: 0, attackCd: 0.2,
  };
}

function setStage(stage, heal = true) {
  game.stage = stage;
  const st = STAGES[stage];
  const p = game.player;
  if (!p) return;
  p.stage = stage;
  p.r = st.r;
  p.maxHp = st.hp;
  if (heal) p.hp = st.hp;
  p.hp = Math.min(p.hp, st.hp);
}

function randomZonePoint(zone, nearPath = true) {
  const spread = nearPath ? 520 : 700;
  let x = between(Math.random, zone.x0 + 120, zone.x1 - 120);
  let y = clamp(pathY(x) + between(Math.random, -spread, spread), 80, WORLD_H - 80);
  // keep plants and bugs out of the water
  for (let tries = 0; tries < 14; tries++) {
    let wet = false;
    for (const pd of game.puddles) {
      const ex = (x - pd.x) / (pd.rx * 1.18);
      const ey = (y - pd.y) / (pd.ry * 1.35);
      if (ex * ex + ey * ey < 1) { wet = true; break; }
    }
    if (!wet) break;
    x = between(Math.random, zone.x0 + 120, zone.x1 - 120);
    y = clamp(pathY(x) + between(Math.random, -spread, spread), 80, WORLD_H - 80);
  }
  return { x, y };
}

function makePuddles(zi) {
  const zone = ZONES[zi];
  const rnd = mulberry32(4400 + zi * 733);
  const P = PALETTES[zone.palette];
  for (let i = 0; i < zone.puddles; i++) {
    const x = zone.x0 + 140 + ((i + 0.5) / zone.puddles) * (zone.x1 - zone.x0 - 280) + between(rnd, -70, 70);
    // leave the sleeping queen's clearing dry
    if (zi === 3 && Math.abs(x - 6780) < 220) continue;
    const y = pathY(x) + between(rnd, -95, 95);
    const rx = between(rnd, 46, 80);
    const ry = between(rnd, 26, 41);
    game.puddles.push({
      x, y, rx, ry, rot: between(rnd, -0.25, 0.25), seed: rnd() * 9,
      palette: P, drinking: false, ripples: rnd() * 4,
    });
  }
}

const FLOWER_COLORS = {
  garden: [
    { petal: '#f3ead1', heart: '#d9b968' },
    { petal: '#e7c3c0', heart: '#c79a56' },
    { petal: '#b9a6ce', heart: '#d9c98d' },
    { petal: '#f0d98a', heart: '#b8893f' },
  ],
  meadow: [
    { petal: '#f2ead3', heart: '#d9b968' },
    { petal: '#e0a95a', heart: '#8f6537' },
    { petal: '#cd8f7e', heart: '#b8893f' },
    { petal: '#c0aed8', heart: '#d9c98d' },
  ],
  edge: [
    { petal: '#e8dfc2', heart: '#c7b06b' },
    { petal: '#b5a3c8', heart: '#d9c98d' },
    { petal: '#d6b48a', heart: '#a37c4a' },
    { petal: '#f1e8ce', heart: '#c9ad63' },
  ],
  deep: [
    { petal: '#e6e2c4', heart: '#d9c98d' },
    { petal: '#b9cf9f', heart: '#d9c98d' },
    { petal: '#c6d6c2', heart: '#b8b06a' },
    { petal: '#e2d3a4', heart: '#c6a95d' },
  ],
};

function makeFlower(x, y, zi) {
  const zone = ZONES[zi];
  const colors = pick(Math.random, FLOWER_COLORS[zone.id]);
  return {
    x, y, r: between(Math.random, 8, 12), phase: Math.random() * TAU,
    rot: Math.random() * TAU, petals: 5 + ((Math.random() * 3) | 0),
    petal: colors.petal, heart: colors.heart, leaf: '#7f9660',
    nectar: 1, respawn: 0, zone: zi, palette: PALETTES[zone.palette],
  };
}

function makeMob(type, x, y, zi) {
  const def = TYPES[type];
  return {
    type, def, tier: def.tier, r: def.r, x, y,
    homeX: x, homeY: y, vx: 0, vy: 0, kvx: 0, kvy: 0,
    angle: Math.random() * TAU, walk: Math.random() * 8,
    hp: def.hp, maxHp: def.hp, alive: true, respawn: 0, zone: zi,
    aggro: false, fleeT: 0, restT: 0, attackCd: 0, seed: Math.random() * 10,
    state: 'idle', lungeCd: 2 + Math.random() * 2, tele: 0, lungeT: 0,
    lungeVX: 0, lungeVY: 0, recoverT: 0, sleeping: !!def.boss, waking: 0, hurtT: 0,
    boss: !!def.boss,
  };
}

function makeBoss() {
  const x = 6780;
  const b = makeMob('mantis', x, pathY(x), 3);
  b.sleeping = game.stage < 4;
  b.homeX = x; b.homeY = pathY(x);
  return b;
}

function spawnWorld() {
  game.mobs.length = 0;
  game.flowers.length = 0;
  game.puddles.length = 0;
  game.particles.length = 0;
  game.texts.length = 0;
  game.motes.length = 0;

  for (let zi = 0; zi < ZONES.length; zi++) {
    const zone = ZONES[zi];
    makePuddles(zi);
    for (const [type, count] of Object.entries(zone.spawns)) {
      for (let i = 0; i < count; i++) {
        const pt = randomZonePoint(zone, true);
        if (type === 'nectar') game.flowers.push(makeFlower(pt.x, pt.y, zi));
        else game.mobs.push(makeMob(type, pt.x, pt.y, zi));
      }
    }
  }
  game.boss = makeBoss();
  game.mobs.push(game.boss);
  seedMotes();
}

function seedMotes() {
  const zi = game.zoneIndex;
  const kinds = ['garden', 'meadow', 'edge', 'deep'];
  const kind = kinds[zi];
  game.motes.length = 0;
  for (let i = 0; i < 70; i++) {
    game.motes.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      phase: Math.random() * TAU,
      speed: between(Math.random, 0.2, 1),
      size: between(Math.random, 0.7, 2.1),
      kind: kind === 'edge' || kind === 'deep'
        ? (Math.random() > 0.45 ? 'firefly' : 'spore')
        : (Math.random() > 0.6 ? 'fluff' : 'pollen'),
      depth: between(Math.random, 0.4, 1.2),
    });
  }
}

function initWorld(save) {
  game.state = 'loading';
  game.player = createPlayerData(save ? save.stage : 0);
  game.stage = game.player.stage;
  game.biomass = save ? save.biomass : 0;
  game.eaten = save ? save.eaten : 0;
  game.playTime = save ? save.time : 0;
  game.bossDead = save ? !!save.bossDead : false;
  game.bossEngaged = false;
  game.time = 0;
  game.shake = 0; game.hurtFlash = 0; game.slowmo = 0; game.winTimer = 0;
  game.drinking = false; game.blocked = false; game.toughCd = 0; game.flowerCd = 0;
  game.saveAt = 0; game.toastTimer = 0; game.introTimer = 0; game.bossIntro = false;
  setStage(game.stage, true);

  const p = game.player;
  const wasDead = !!save && save.hp <= 0;
  if (save) {
    if (wasDead) {
      const respawnZone = ZONES[Math.min(3, game.stage)];
      p.x = respawnZone.x0 + 200;
      p.y = pathY(p.x);
    } else {
      p.x = clamp(save.x || 500, 60, WORLD_W - 60);
      p.y = clamp(save.y || pathY(p.x), 60, WORLD_H - 60);
    }
    p.hp = wasDead ? p.maxHp : clamp(save.hp ?? p.maxHp, 1, p.maxHp);
    p.hunger = clamp(save.hunger ?? 70, 0, 100);
    p.thirst = clamp(save.thirst ?? 62, 0, 100);
    if (wasDead) {
      p.hunger = Math.max(58, p.hunger);
      p.thirst = Math.max(58, p.thirst);
      p.hurtT = 1.8;
      p.attackCd = 0.4;
    }
  } else {
    p.x = 500;
    p.y = pathY(500);
  }
  // never restore beyond an unopened gate
  for (const b of BARRIERS) {
    if (game.stage < b.require && p.x > b.x - 50) p.x = b.x - 50;
  }
  p.y = clamp(p.y, 70, WORLD_H - 70);
  game.zoneIndex = zoneIndexAt(p.x);
  spawnWorld();
  if (game.bossDead && game.boss) {
    game.boss.alive = false;
    game.boss.respawn = 0;
    game.boss.sleeping = true;
  }
  game.cam.x = p.x;
  game.cam.y = p.y;
  game.cam.zoom = 1.02 - game.stage * 0.025;
  clampCamera(true);
  game.state = 'playing';
  game.hintCd = 0;
}

// ————————————————————————————————————————————————
// save / load
// ————————————————————————————————————————————————

function saveGame() {
  if (!game.player) return;
  const data = {
    v: 2, stage: game.stage, biomass: Math.floor(game.biomass),
    x: Math.round(game.player.x), y: Math.round(game.player.y),
    hp: Math.round(game.player.hp), hunger: Math.round(game.player.hunger),
    thirst: Math.round(game.player.thirst), eaten: game.eaten,
    time: Math.round(game.playTime), bossDead: game.bossDead, muted: game.muted,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) { /* noop */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 2 || typeof s.stage !== 'number') return null;
    s.stage = clamp(s.stage, 0, 4);
    return s;
  } catch (_) { return null; }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* noop */ }
}

// ————————————————————————————————————————————————
// update — playing
// ————————————————————————————————————————————————

function updatePlaying(dt) {
  const slow = game.slowmo > 0 ? 0.38 : 1;
  const sdt = dt * slow;
  game.time += sdt;
  game.playTime += dt;
  game.slowmo = Math.max(0, game.slowmo - dt);

  updatePlayer(sdt);
  updateFlowers(sdt);
  for (const c of game.mobs) updateMob(c, sdt);
  resolveHazards(sdt);
  updateCombat(sdt);
  updateParticles(sdt);
  updateTexts(sdt);
  updateMotes(sdt);
  updateCamera(dt);
  updateTimers(dt);
  sound.update(dt, ZONES[game.zoneIndex].id, game.state === 'playing');

  if (game.state !== 'playing') return;
  if (game.winTimer > 0) {
    game.winTimer -= dt;
    if (game.winTimer <= 0) showWin();
  }
}

function updatePlayer(dt) {
  const p = game.player;
  const st = STAGES[game.stage];
  p.attackCd -= dt;
  p.hurtT = Math.max(0, p.hurtT - dt);
  p.dashT = Math.max(0, p.dashT - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.biteT = Math.max(0, p.biteT - dt);
  game.toughCd = Math.max(0, game.toughCd - dt);
  game.flowerCd = Math.max(0, game.flowerCd - dt);

  const inp = inputVector();
  if (dashQueued) {
    dashQueued = false;
    if (st.dash && p.dashCd <= 0) {
      // dash toward the stick/key direction, or straight ahead when standing still
      let dx = inp.x, dy = inp.y;
      if (inp.mag <= 0.12) {
        dx = Math.cos(p.angle);
        dy = Math.sin(p.angle);
      }
      const l = Math.hypot(dx, dy) || 1;
      p.dashVX = (dx / l) * st.speed * 2.8;
      p.dashVY = (dy / l) * st.speed * 2.8;
      p.dashT = 0.17;
      p.dashCd = 0.55;
      p.angle = Math.atan2(dy, dx);
      sound.dash();
      for (let i = 0; i < 7; i++) {
        burst(p.x - dx * 10, p.y - dy * 10, '#c9c6a4', 1, {
          speed: 40, life: 0.5, size: 2.4, type: 'dust',
        });
      }
      game.shake = Math.max(game.shake, 1.5);
    }
  }

  let speed = st.speed;
  const pathDist = Math.abs(p.y - pathY(p.x));
  if (game.zoneIndex >= 2 && pathDist > 300) speed *= 0.84;
  if (game.drinking) speed *= 0.94;

  if (p.dashT > 0) {
    p.vx = p.dashVX;
    p.vy = p.dashVY;
  } else {
    const targetVX = inp.x * speed * inp.mag;
    const targetVY = inp.y * speed * inp.mag;
    const k = 1 - Math.exp(-dt * (inp.mag > 0 ? 10 : 7));
    p.vx = lerp(p.vx, targetVX, k);
    p.vy = lerp(p.vy, targetVY, k);
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, 26, WORLD_W - 26);
  p.y = clamp(p.y, 52, WORLD_H - 52);

  // zone gates
  game.blocked = false;
  for (const b of BARRIERS) {
    if (game.stage < b.require) {
      if (p.x > b.x - 30) {
        p.x = b.x - 30;
        p.vx = Math.min(0, p.vx);
      }
      // latch the hint while the player is pressed against the thicket
      if (p.x >= b.x - 36) game.blocked = true;
    }
  }

  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 20) {
    p.angle = lerpAngle(p.angle, Math.atan2(p.vy, p.vx), 1 - Math.exp(-dt * 12));
    p.walk += dt * (5 + sp * 0.07);
  } else {
    p.walk += dt * 1.1;
  }

  // water
  game.drinking = false;
  for (const pd of game.puddles) {
    pd.drinking = false;
    const ex = (p.x - pd.x) / pd.rx;
    const ey = (p.y - pd.y) / pd.ry;
    if (ex * ex + ey * ey < 1 && p.thirst < 99.99) {
      pd.drinking = true;
      game.drinking = true;
      p.thirst = Math.min(100, p.thirst + 52 * dt);
      game.splashCd -= dt;
      if (game.splashCd <= 0) {
        game.splashCd = 0.34;
        burst(p.x, p.y + 2, '#cfe3d8', 3, { speed: 22, life: 0.6, size: 1.8, type: 'drop', gravity: 20 });
        if (Math.random() > 0.5) sound.drink();
      }
    }
  }

  // tiny bites of nectar
  for (const f of game.flowers) {
    if (f.nectar <= 0) continue;
    if (dist2(p.x, p.y, f.x, f.y) < (p.r + f.r + 7) ** 2 && game.flowerCd <= 0) {
      f.nectar = 0;
      f.respawn = between(Math.random, FLOWER_RESPAWN[0], FLOWER_RESPAWN[1]);
      p.hunger = Math.min(100, p.hunger + 4);
      p.thirst = Math.min(100, p.thirst + 6);
      game.biomass += 1;
      game.flowerCd = 0.3;
      addText(f.x, f.y - 12, '+nectar', '#6d6a3f', 12);
      burst(f.x, f.y, f.heart, 8, { speed: 55, life: 0.8, size: 2.2, type: 'dot', gravity: 10 });
    }
  }

  // vitals
  p.hunger = clamp(p.hunger - st.hungerDrain * dt, 0, 100);
  p.thirst = clamp(p.thirst - st.thirstDrain * dt, 0, 100);
  if (p.hunger <= 0) p.hp -= 1.5 * dt;
  if (p.thirst <= 0) p.hp -= 2.2 * dt;
  if (p.hunger > 35 && p.thirst > 35) p.hp = Math.min(p.maxHp, p.hp + 1.0 * dt);
  p.hp = Math.min(p.hp, p.maxHp);
  if (p.hp <= 0 && game.state === 'playing') die();

  // zone change
  const zi = zoneIndexAt(p.x);
  if (zi !== game.zoneIndex) {
    game.zoneIndex = zi;
    seedMotes();
    enterZone(ZONES[zi]);
    sound.setZone(ZONES[zi].id);
    if (zi === 3 && game.stage >= 4 && !game.bossDead && !game.bossIntro) {
      game.bossIntro = true;
      flash('Something enormous is breathing in the roots.', 4200);
    }
  }
}

function updateFlowers(dt) {
  for (const f of game.flowers) {
    if (f.nectar <= 0) {
      f.respawn -= dt;
      if (f.respawn <= 0) {
        f.nectar = 1;
        burst(f.x, f.y, f.heart, 5, { speed: 22, life: 1.2, size: 1.4, type: 'dot' });
      }
    }
  }
}

function updateMob(c, dt) {
  if (!c.alive) {
    if (c.respawn > 0) {
      c.respawn -= dt;
      if (c.respawn <= 0) respawnMob(c);
    }
    return;
  }
  if (c.boss) { updateBoss(c, dt); return; }

  const p = game.player;
  const dx = p.x - c.x, dy = p.y - c.y;
  const d = Math.hypot(dx, dy) || 1;
  c.attackCd = Math.max(0, c.attackCd - dt);
  c.fleeT -= dt;
  c.restT -= dt;

  const canEat = game.stage >= c.def.tier;
  const dangerous = c.def.threat > 0 && game.stage <= c.def.tier;
  let ax = 0, ay = 0;
  let speed = c.def.speed;

  if (dangerous && d < c.def.aggro) {
    c.aggro = true;
    ax = dx / d;
    ay = dy / d;
    const weave = Math.sin(game.time * 2.6 + c.seed) * 0.32;
    ax += -dy / d * weave;
    ay += dx / d * weave;
    speed = c.def.speed * 1.1;
  } else if (canEat && d < 300) {
    c.aggro = false;
    if (c.fleeT <= 0 && c.restT <= 0) {
      c.fleeT = 0.62;
      c.restT = 1.0 + Math.random() * 0.7;
    }
    if (c.fleeT > 0) {
      ax = -dx / d;
      ay = -dy / d;
      speed = c.def.burst;
    }
  } else {
    c.aggro = false;
  }

  if (!ax && !ay) {
    const wa = c.seed * 1.7 + game.time * 0.55;
    ax = Math.cos(wa) * 0.4;
    ay = Math.sin(wa * 1.31) * 0.4;
    const hdx = c.homeX - c.x, hdy = c.homeY - c.y;
    const hd = Math.hypot(hdx, hdy) || 1;
    if (hd > 230) {
      ax += hdx / hd * 1.4;
      ay += hdy / hd * 1.4;
    }
  }

  const al = Math.hypot(ax, ay) || 1;
  const kv = 1 - Math.exp(-dt * (c.aggro ? 5 : 3.4));
  c.vx = lerp(c.vx, (ax / al) * speed, kv);
  c.vy = lerp(c.vy, (ay / al) * speed, kv);
  c.x += (c.vx + c.kvx) * dt;
  c.y += (c.vy + c.kvy) * dt;
  c.kvx *= Math.exp(-dt * 6);
  c.kvy *= Math.exp(-dt * 6);

  const zone = ZONES[c.zone];
  c.x = clamp(c.x, zone.x0 + 16, zone.x1 - 16);
  c.y = clamp(c.y, 48, WORLD_H - 48);

  const v = Math.hypot(c.vx, c.vy);
  if (v > 8) c.angle = lerpAngle(c.angle, Math.atan2(c.vy, c.vx), 1 - Math.exp(-dt * 8));
  c.walk += dt * (2 + v * 0.06);
}

function updateBoss(c, dt) {
  if (!c.alive) return;
  const p = game.player;
  const dx = p.x - c.x, dy = p.y - c.y;
  const d = Math.hypot(dx, dy) || 1;
  c.attackCd = Math.max(0, c.attackCd - dt);

  if (c.sleeping) {
    if (game.stage >= 4 && d < 620) {
      c.sleeping = false;
      c.waking = 1.3;
      c.aggro = true;
      c.state = 'idle';
      game.bossEngaged = true;
      game.shake = 9;
      sound.boss();
      flash('The Mantis Queen unfolds from the roots.', 4400);
      burst(c.x, c.y, '#d9c98d', 18, { speed: 120, life: 1.4, size: 2.5, type: 'dot' });
    } else {
      c.walk += dt * 0.4;
      return;
    }
  }

  if (c.waking > 0) {
    c.waking -= dt;
    c.vx *= Math.exp(-dt * 6);
    c.vy *= Math.exp(-dt * 6);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    return;
  }

  if (d > 1080) {
    c.aggro = false;
    game.bossEngaged = false;
    const hdx = c.homeX - c.x, hdy = c.homeY - c.y;
    const hd = Math.hypot(hdx, hdy) || 1;
    c.vx = lerp(c.vx, hdx / hd * 95, 1 - Math.exp(-dt * 3));
    c.vy = lerp(c.vy, hdy / hd * 95, 1 - Math.exp(-dt * 3));
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.angle = lerpAngle(c.angle, Math.atan2(hdy, hdx), 1 - Math.exp(-dt * 6));
    c.walk += dt * 2;
    return;
  }

  c.aggro = true;
  game.bossEngaged = true;
  c.lungeCd -= dt;

  if (c.state === 'idle') {
    const weave = Math.sin(game.time * 1.7 + c.seed) * 0.6;
    let ax = dx / d - (dy / d) * weave;
    let ay = dy / d + (dx / d) * weave;
    const al = Math.hypot(ax, ay) || 1;
    c.vx = lerp(c.vx, (ax / al) * 152, 1 - Math.exp(-dt * 3.2));
    c.vy = lerp(c.vy, (ay / al) * 152, 1 - Math.exp(-dt * 3.2));
    if (d < 370 && c.lungeCd <= 0) {
      c.state = 'telegraph';
      c.tele = 0.62;
      c.vx *= 0.15;
      c.vy *= 0.15;
    }
  } else if (c.state === 'telegraph') {
    c.tele -= dt;
    c.vx *= Math.exp(-dt * 8);
    c.vy *= Math.exp(-dt * 8);
    if (c.tele <= 0) {
      c.state = 'lunge';
      c.lungeT = 0.37;
      c.lungeVX = (dx / d) * 660;
      c.lungeVY = (dy / d) * 660;
      game.shake = 7;
      sound.boss();
    }
  } else if (c.state === 'lunge') {
    c.lungeT -= dt;
    c.vx = c.lungeVX;
    c.vy = c.lungeVY;
    if (Math.random() > 0.7) {
      burst(c.x - c.vx * 0.02, c.y - c.vy * 0.02, '#c8bd92', 1, { speed: 20, life: 0.5, size: 2.4, type: 'dust' });
    }
    if (c.lungeT <= 0) {
      c.state = 'recover';
      c.recoverT = 0.85;
      c.lungeCd = 2.5 + Math.random() * 0.9;
    }
  } else {
    c.recoverT -= dt;
    c.vx *= Math.exp(-dt * 5);
    c.vy *= Math.exp(-dt * 5);
    if (c.recoverT <= 0) c.state = 'idle';
  }

  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.x = clamp(c.x, 5480, WORLD_W - 40);
  c.y = clamp(c.y, 80, WORLD_H - 80);

  const face = c.state === 'lunge' ? Math.atan2(c.vy, c.vx) : Math.atan2(dy, dx);
  c.angle = lerpAngle(c.angle, face, 1 - Math.exp(-dt * 7));
  c.walk += dt * (1.2 + Math.hypot(c.vx, c.vy) * 0.012);
}

function respawnMob(c) {
  const zone = ZONES[c.zone];
  let pt = randomZonePoint(zone, true);
  for (let i = 0; i < 8 && dist(pt.x, pt.y, game.player.x, game.player.y) < 460; i++) {
    pt = randomZonePoint(zone, true);
  }
  c.x = pt.x; c.y = pt.y;
  c.homeX = pt.x; c.homeY = pt.y;
  c.vx = 0; c.vy = 0; c.kvx = 0; c.kvy = 0;
  c.hp = c.def.hp;
  c.alive = true;
  c.aggro = false;
  c.fleeT = 0; c.restT = 0;
  c.state = 'idle';
}

// ————————————————————————————————————————————————
// combat
// ————————————————————————————————————————————————

function updateCombat(dt) {
  const p = game.player;
  if (p.attackCd > 0) return;
  let target = null;
  let best = Infinity;
  for (const c of game.mobs) {
    if (!c.alive || c.sleeping) continue;
    const reach = p.r + c.r + (c.boss ? 16 : 7);
    const d2 = dist2(p.x, p.y, c.x, c.y);
    if (d2 < reach * reach && d2 < best) { best = d2; target = c; }
  }
  if (!target) return;

  const edible = game.stage >= target.def.tier;
  if (!edible) {
    p.attackCd = 0.55;
    if (game.toughCd <= 0) {
      game.toughCd = 2.0;
      addText(target.x, target.y - target.r - 8, 'too tough', '#796a50', 13);
    }
    return;
  }

  p.attackCd = STAGES[game.stage].cadence;
  p.biteT = 0.16;
  const dmg = STAGES[game.stage].bite;
  target.hp -= dmg;
  const nx = (target.x - p.x) / (dist(p.x, p.y, target.x, target.y) || 1);
  const ny = (target.y - p.y) / (dist(p.x, p.y, target.x, target.y) || 1);
  target.kvx += nx * (target.boss ? 60 : 170);
  target.kvy += ny * (target.boss ? 60 : 170);
  target.hurtT = 0.15;
  if (target.boss && target.sleeping) wakeBoss(target);

  sound.bite();
  game.shake = Math.max(game.shake, target.boss ? 3 : 1.2);
  burst((p.x + target.x) / 2, (p.y + target.y) / 2, target.def.color, 5, {
    speed: 90, life: 0.4, size: 2.4, type: 'spark',
  });
  if (target.boss) addText(target.x, target.y - target.r - 12, `-${dmg}`, '#8f3f3a', 15);

  if (target.hp <= 0) killMob(target);
}

function killMob(c) {
  if (c.boss) {
    c.alive = false;
    c.aggro = false;
    game.bossDead = true;
    game.bossEngaged = false;
    game.slowmo = 2.6;
    game.winTimer = 2.8;
    game.shake = 12;
    sound.win();
    burst(c.x, c.y, '#d9c98d', 45, { speed: 180, life: 2.2, size: 3, type: 'spark' });
    burst(c.x, c.y, '#7d9b62', 30, { speed: 90, life: 2.6, size: 5, type: 'dot', gravity: -6 });
    addText(c.x, c.y - 50, 'the queen folds', '#4c5d3e', 20);
    return;
  }
  c.alive = false;
  c.respawn = c.def.respawn * between(Math.random, 0.75, 1.35);
  c.vx = 0; c.vy = 0;
  const p = game.player;
  game.biomass += c.def.biomass;
  game.eaten += 1;
  p.hunger = Math.min(100, p.hunger + c.def.hunger);
  p.thirst = Math.min(100, p.thirst + c.def.thirst);
  addText(c.x, c.y - c.r - 8, `+${c.def.biomass}`, '#6e6a3a', 16);
  burst(c.x, c.y, c.def.color, 10, { speed: 80, life: 0.9, size: 2.6, type: 'dot', gravity: 25 });
  burst(c.x, c.y, '#f0e7c8', 4, { speed: 30, life: 0.7, size: 3, type: 'ring' });
  sound.eat();
  if (game.stage < 4 && game.biomass >= MOLT_COST[game.stage] && game.nextMilestone !== game.stage) {
    game.nextMilestone = game.stage;
    flash('Your old skin feels tight. You are ready to molt.', 3400);
  }
}

function hurtPlayer(dmg, c) {
  const p = game.player;
  if (p.hurtT > 0 || game.state !== 'playing') return;
  p.hp -= dmg;
  p.hurtT = 0.82;
  game.hurtFlash = 0.65;
  game.shake = Math.max(game.shake, c.boss ? 8 : 4);
  sound.hurt();
  const a = Math.atan2(p.y - c.y, p.x - c.x);
  p.vx += Math.cos(a) * (c.boss ? 220 : 150);
  p.vy += Math.sin(a) * (c.boss ? 220 : 150);
  addText(p.x, p.y - p.r - 10, `-${Math.round(dmg)}`, '#8f3f3a', 15);
  burst(p.x, p.y, '#c07a62', 7, { speed: 70, life: 0.7, size: 2.4, type: 'dot' });
  if (p.hp <= 0) die();
}

function resolveHazards(dt) {
  const p = game.player;
  for (const c of game.mobs) {
    if (!c.alive || c.sleeping || !c.aggro) continue;
    if (c.def.threat <= 0) continue;
    const reach = p.r + c.r + 3;
    if (dist2(p.x, p.y, c.x, c.y) < reach * reach && p.hurtT <= 0) {
      let dmg = c.def.threat;
      if (c.boss) dmg = c.state === 'lunge' ? 26 : 15;
      hurtPlayer(dmg, c);
      if (game.state !== 'playing') break;
    }
  }
}

function wakeBoss(c) {
  if (!c.sleeping) return;
  c.sleeping = false;
  c.waking = 1.0;
  c.aggro = true;
  game.bossEngaged = true;
  sound.boss();
  flash('The Mantis Queen unfolds from the roots.', 4000);
}

function die() {
  if (game.state !== 'playing') return;
  const p = game.player;
  game.state = 'dead';
  document.body.classList.add('dead');
  p.hp = 0;
  game.biomass = Math.floor(game.biomass * 0.78);
  game.hurtFlash = 1.1;
  game.shake = 9;
  sound.death();
  burst(p.x, p.y, '#9c6b52', 24, { speed: 100, life: 1.8, size: 3.2, type: 'dot', gravity: 30 });
  setTimeout(() => { if (game.state === 'dead') showDeath(); }, 620);
}

// ————————————————————————————————————————————————
// particles, motes, camera
// ————————————————————————————————————————————————

function burst(x, y, color, n, opts = {}) {
  const speed = opts.speed ?? 70;
  const life = opts.life ?? 0.8;
  const size = opts.size ?? 2.4;
  const type = opts.type ?? 'dot';
  const gravity = opts.gravity ?? 0;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const s = speed * (0.3 + Math.random() * 0.9);
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: life * (0.6 + Math.random() * 0.7), maxLife: life,
      size: size * (0.5 + Math.random() * 0.8), color, type,
      rot: Math.random() * TAU, vr: between(Math.random, -6, 6), gravity,
    });
  }
  if (game.particles.length > 420) game.particles.splice(0, game.particles.length - 420);
}

function addText(x, y, text, color, size = 14) {
  game.texts.push({ x, y, text, color, size, life: 1.5, maxLife: 1.5 });
  if (game.texts.length > 30) game.texts.shift();
}

function updateParticles(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const pt = game.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { game.particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += pt.gravity * dt;
    pt.vx *= Math.exp(-dt * 1.6);
    pt.vy *= Math.exp(-dt * 1.6);
    pt.rot += pt.vr * dt;
    if (pt.type === 'ring') pt.size += dt * 42;
  }
}

function updateTexts(dt) {
  for (let i = game.texts.length - 1; i >= 0; i--) {
    const t = game.texts[i];
    t.life -= dt;
    t.y -= dt * 16;
    if (t.life <= 0) game.texts.splice(i, 1);
  }
}

function updateMotes(dt) {
  const cam = game.cam;
  const halfW = view.w / (2 * cam.zoom) + 160;
  const halfH = view.h / (2 * cam.zoom) + 160;
  for (const m of game.motes) {
    m.x += Math.cos(m.phase + game.time * 0.3) * dt * 9 * m.speed;
    m.y += Math.sin(m.phase * 1.3 + game.time * 0.24) * dt * 7 * m.speed - dt * 2;
    if (m.x < cam.x - halfW) m.x += halfW * 2;
    if (m.x > cam.x + halfW) m.x -= halfW * 2;
    if (m.y < cam.y - halfH) m.y += halfH * 2;
    if (m.y > cam.y + halfH) m.y -= halfH * 2;
  }
}

function updateCamera(dt) {
  if (!game.player) return;
  const p = game.player;
  const base = (view.w < 760 ? 1.0 : 1.16) - game.stage * 0.028;
  const minZoom = Math.max(view.h / WORLD_H, view.w / WORLD_W) + 0.02;
  const targetZoom = Math.max(base, minZoom);
  game.cam.zoom = lerp(game.cam.zoom, targetZoom, 1 - Math.exp(-dt * 2.2));
  const kx = 1 - Math.exp(-dt * 4.2);
  const ky = 1 - Math.exp(-dt * 4.2);
  game.cam.x = lerp(game.cam.x, p.x + p.vx * 0.16, kx);
  game.cam.y = lerp(game.cam.y, p.y + p.vy * 0.1, ky);
  clampCamera(false);

  game.shake *= Math.exp(-dt * 6.5);
  if (game.shake < 0.08) game.shake = 0;
  game.cam.sx = (Math.random() * 2 - 1) * game.shake;
  game.cam.sy = (Math.random() * 2 - 1) * game.shake;
  game.hurtFlash = Math.max(0, game.hurtFlash - dt * 1.6);
}

function clampCamera() {
  const zoom = game.cam.zoom;
  const halfW = view.w / (2 * zoom);
  const halfH = view.h / (2 * zoom);
  if (WORLD_W > halfW * 2) game.cam.x = clamp(game.cam.x, halfW, WORLD_W - halfW);
  else game.cam.x = WORLD_W / 2;
  if (WORLD_H > halfH * 2) game.cam.y = clamp(game.cam.y, halfH, WORLD_H - halfH);
  else game.cam.y = WORLD_H / 2;
}

function updateTimers(dt) {
  game.hintCd -= dt;
  if (game.hintCd <= 0) {
    game.hintCd = 0.35;
    updateHint();
  }
  game.saveAt += dt;
  if (game.saveAt > 8) {
    game.saveAt = 0;
    saveGame();
  }
}

// ————————————————————————————————————————————————
// render
// ————————————————————————————————————————————————

function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);
  if (!game.player || game.state === 'title' || game.state === 'loading') {
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(0, 0, view.w, view.h);
    return;
  }

  const cam = game.cam;
  const w = view.w, h = view.h, zoom = cam.zoom;
  const left = cam.x - w / (2 * zoom);
  const top = cam.y - h / (2 * zoom);
  const right = cam.x + w / (2 * zoom);
  const bottom = cam.y + h / (2 * zoom);

  ctx.save();
  ctx.translate(w / 2 + cam.sx, h / 2 + cam.sy);
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x, -cam.y);

  // painted biome canvases, over a wash that blends their feathered seams
  const under = ctx.createLinearGradient(0, 0, WORLD_W, 0);
  under.addColorStop(0, PALETTES.garden.paper);
  under.addColorStop(0.125, PALETTES.garden.paper);
  under.addColorStop(0.375, PALETTES.meadow.paper);
  under.addColorStop(0.625, PALETTES.edge.paper);
  under.addColorStop(0.875, PALETTES.deep.paper);
  under.addColorStop(1, PALETTES.deep.paper);
  ctx.fillStyle = under;
  // only the feathered seams need the underlayer; the zone paintings are opaque elsewhere
  for (const seam of [0, 1800, 3600, 5400, WORLD_W]) {
    if (seam + 150 < left || seam - 150 > right) continue;
    const x0 = Math.max(0, seam - 150);
    const x1 = Math.min(WORLD_W, seam + 150);
    ctx.fillRect(x0, 0, x1 - x0, WORLD_H);
  }

  for (let i = 0; i < ZONES.length; i++) {
    const z = ZONES[i];
    if (z.x1 < left - 4 || z.x0 > right + 4) continue;
    let art = zoneArt[i];
    if (!art) art = zoneArt[i] = paintZoneCanvas(z);
    ctx.drawImage(art, z.x0, 0, z.x1 - z.x0, WORLD_H);
  }

  // still water
  for (const pd of game.puddles) {
    if (pd.x + pd.rx * 1.6 < left || pd.x - pd.rx * 1.6 > right) continue;
    if (pd.y + pd.ry * 1.6 < top || pd.y - pd.ry * 1.6 > bottom) continue;
    drawPuddle(ctx, pd, game.time, pd.drinking);
  }

  drawBarriers(ctx, left, right);

  // living things, sorted into the depth of the painting
  const drawList = [];
  for (const f of game.flowers) {
    if (f.x < left - 60 || f.x > right + 60 || f.y < top - 60 || f.y > bottom + 60) continue;
    drawList.push({ y: f.y, kind: 'flower', obj: f });
  }
  for (const c of game.mobs) {
    if (!c.alive) continue;
    if (c.x < left - 120 || c.x > right + 120 || c.y < top - 120 || c.y > bottom + 120) continue;
    drawList.push({ y: c.y + (c.sleeping ? -2 : 0), kind: 'critter', obj: c });
  }
  drawList.push({ y: game.player.y, kind: 'player', obj: game.player });
  drawList.sort((a, b) => a.y - b.y);
  for (const item of drawList) {
    if (item.kind === 'flower') drawFlower(ctx, item.obj, game.time);
    else if (item.kind === 'critter') drawCritter(ctx, item.obj, game.time);
    else drawPlayer(ctx, item.obj, game.time);
  }

  drawMotesWorld(ctx, left, top, right, bottom);
  drawParticles(ctx);
  drawFloatingText(ctx);

  ctx.restore();

  drawAtmosphere(ctx);
  drawVignette(ctx);
}

function drawBarriers(ctx, left, right) {
  for (let bi = 0; bi < BARRIERS.length; bi++) {
    const b = BARRIERS[bi];
    if (b.x < left - 110 || b.x > right + 110) continue;
    const locked = game.stage < b.require;
    const P = PALETTES[ZONES[bi + 1].palette];
    const rnd = mulberry32(910 + bi * 73);
    const gapHalf = locked ? 0 : 210;

    for (let y = 10; y < WORLD_H; y += 54) {
      if (gapHalf && Math.abs(y - pathY(b.x)) < gapHalf) continue;
      const x = b.x + (rnd() - 0.5) * 44;
      softBlob(ctx, x, y, between(rnd, 30, 62), between(rnd, 26, 48), '#43543a', locked ? 0.34 : 0.14);
      for (let k = 0; k < 3; k++) {
        const x1 = x + (rnd() - 0.5) * 42;
        const y1 = y + (rnd() - 0.5) * 34;
        const x2 = x1 + between(rnd, -26, 26);
        const y2 = y1 + between(rnd, -40, 40);
        brushCurve(ctx, x1, y1, (x1 + x2) / 2 + between(rnd, -16, 16), (y1 + y2) / 2, x2, y2, locked ? '#3f4a33' : '#5e6845', locked ? 0.42 : 0.2, between(rnd, 0.8, 1.8));
        if (rnd() > 0.6) {
          ctx.fillStyle = `rgba(120,130,86,${locked ? 0.3 : 0.14})`;
          ctx.beginPath();
          ctx.ellipse(x2, y2, between(rnd, 2, 5), between(rnd, 1, 2.6), rnd() * TAU, 0, TAU);
          ctx.fill();
        }
      }
      // thorns
      if (locked && rnd() > 0.45) {
        brushCurve(ctx, x, y, x + between(rnd, -20, 20), y + between(rnd, -18, 18), x + between(rnd, -28, 28), y + between(rnd, -24, 24), P.ink, 0.3, 1);
      }
    }

    if (locked) {
      const g = ctx.createLinearGradient(b.x - 70, 0, b.x + 70, 0);
      g.addColorStop(0, 'rgba(238,231,206,0)');
      g.addColorStop(0.5, 'rgba(238,231,206,0.2)');
      g.addColorStop(1, 'rgba(238,231,206,0)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x - 70, 0, 140, WORLD_H);
    }
  }
}

function drawMotesWorld(ctx, left, top, right, bottom) {
  for (const m of game.motes) {
    if (m.x < left - 40 || m.x > right + 40 || m.y < top - 40 || m.y > bottom + 40) continue;
    const twinkle = 0.45 + 0.55 * Math.sin(game.time * 1.6 + m.phase);
    if (m.kind === 'firefly') {
      const a = 0.18 + twinkle * 0.5;
      ctx.fillStyle = `rgba(240,226,142,${a * 0.15})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.size * 5, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(240,226,142,${a * 0.35})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.size * 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,248,198,${a})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.size * 0.9, 0, TAU); ctx.fill();
    } else if (m.kind === 'spore') {
      ctx.fillStyle = `rgba(205,220,180,${0.12 + twinkle * 0.25})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.size * 0.8, 0, TAU); ctx.fill();
    } else if (m.kind === 'fluff') {
      ctx.fillStyle = `rgba(250,246,228,${0.2 + twinkle * 0.25})`;
      ctx.beginPath(); ctx.ellipse(m.x, m.y, m.size * 1.8, m.size, 0.5, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = `rgba(250,238,186,${0.16 + twinkle * 0.28})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.size, 0, TAU); ctx.fill();
    }
  }
}

function drawParticles(ctx) {
  for (const pt of game.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    if (pt.type === 'ring') {
      ctx.strokeStyle = hexAWithAlpha(pt.color, a * 0.5);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y, pt.size, pt.size * 0.7, 0, 0, TAU);
      ctx.stroke();
      continue;
    }
    if (pt.type === 'spark') {
      ctx.strokeStyle = hexAWithAlpha(pt.color, a * 0.8);
      ctx.lineWidth = pt.size * 0.55;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.02, pt.y - pt.vy * 0.02);
      ctx.stroke();
      continue;
    }
    if (pt.type === 'leaf' || pt.type === 'dust') {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      ctx.fillStyle = hexAWithAlpha(pt.color, a * (pt.type === 'dust' ? 0.3 : 0.55));
      ctx.beginPath();
      ctx.ellipse(0, 0, pt.size * 1.5, pt.size * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.fillStyle = hexAWithAlpha(pt.color, a * 0.75);
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
    ctx.fill();
  }
}

function drawFloatingText(ctx) {
  for (const t of game.texts) {
    const a = clamp(t.life / t.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.8);
    ctx.font = `italic ${t.size}px "Palatino Linotype", "DejaVu Serif", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(248,241,224,0.75)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
}

function hexAWithAlpha(hex, a) {
  if (!hex || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawAtmosphere(c) {
  const zone = ZONES[game.zoneIndex];
  const w = view.w, h = view.h;
  if (zone.palette === 'garden') {
    const g = c.createRadialGradient(w * 0.72, h * 0.12, 0, w * 0.72, h * 0.12, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(255,238,178,0.16)');
    g.addColorStop(0.5, 'rgba(255,238,178,0.05)');
    g.addColorStop(1, 'rgba(255,238,178,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else if (zone.palette === 'meadow') {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,228,150,0.09)');
    g.addColorStop(0.6, 'rgba(255,228,150,0.02)');
    g.addColorStop(1, 'rgba(210,180,110,0.05)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else if (zone.palette === 'edge') {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(225,225,205,0.18)');
    g.addColorStop(0.45, 'rgba(225,225,205,0.03)');
    g.addColorStop(1, 'rgba(40,60,48,0.08)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else {
    c.fillStyle = 'rgba(27,48,43,0.16)';
    c.fillRect(0, 0, w, h);
    // god rays through the canopy
    c.save();
    c.translate(w * 0.62, -h * 0.2);
    c.rotate(0.34);
    for (let i = 0; i < 4; i++) {
      const x = i * Math.max(90, w * 0.09);
      const bw = Math.max(26, w * 0.035);
      const g = c.createLinearGradient(x, 0, x, h * 1.6);
      g.addColorStop(0, 'rgba(245,238,190,0.12)');
      g.addColorStop(0.45, 'rgba(245,238,190,0.05)');
      g.addColorStop(1, 'rgba(245,238,190,0)');
      c.fillStyle = g;
      c.fillRect(x, 0, bw, h * 1.6);
    }
    c.restore();
    const warm = c.createRadialGradient(w * 0.8, h * 0.45, 0, w * 0.8, h * 0.45, Math.min(w, h) * 0.6);
    warm.addColorStop(0, 'rgba(240,224,160,0.1)');
    warm.addColorStop(1, 'rgba(240,224,160,0)');
    c.fillStyle = warm;
    c.fillRect(0, 0, w, h);
  }
}

function drawVignette(c) {
  const w = view.w, h = view.h;
  const g = c.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.28, w / 2, h * 0.5, Math.max(w, h) * 0.72);
  g.addColorStop(0, 'rgba(54,56,38,0)');
  g.addColorStop(0.7, 'rgba(54,56,38,0.06)');
  g.addColorStop(1, 'rgba(50,52,35,0.26)');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  if (game.hurtFlash > 0) {
    const r = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
    r.addColorStop(0, 'rgba(150,50,40,0)');
    r.addColorStop(1, `rgba(150,50,40,${game.hurtFlash * 0.22})`);
    c.fillStyle = r;
    c.fillRect(0, 0, w, h);
  }
  const p = game.player;
  if (p && p.hp / p.maxHp < 0.28 && game.state === 'playing') {
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 5);
    const r = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
    r.addColorStop(0, 'rgba(120,40,36,0)');
    r.addColorStop(1, `rgba(120,40,36,${0.08 + pulse * 0.1})`);
    c.fillStyle = r;
    c.fillRect(0, 0, w, h);
  }
}

// ————————————————————————————————————————————————
// UI
// ————————————————————————————————————————————————

const vitalRows = Array.from(document.querySelectorAll('.vital'));
const journeyStops = Array.from(document.querySelectorAll('.journey .stop'));

function updateUI() {
  const p = game.player;
  if (!p) return;
  const st = STAGES[game.stage];
  const cost = game.stage < 4 ? MOLT_COST[game.stage] : 0;
  const zone = ZONES[game.zoneIndex];

  setText(ui.stageName, st.name);
  setText(ui.stageNumeral, `INSTAR ${st.numeral}`);
  setText(ui.stageTrait, st.trait);
  setText(ui.stageZone, zone.name.replace('The ', '').toUpperCase());
  setText(ui.bioNum, Math.floor(game.biomass));
  setText(ui.bioMax, game.stage < 4 ? `/ ${cost}` : '/ —');

  const hpPct = clamp((p.hp / p.maxHp) * 100, 0, 100);
  const huPct = clamp(p.hunger, 0, 100);
  const thPct = clamp(p.thirst, 0, 100);
  ui.vitFill.style.width = `${hpPct}%`;
  ui.hungFill.style.width = `${huPct}%`;
  ui.thirstFill.style.width = `${thPct}%`;
  setText(ui.vitNum, Math.ceil(p.hp));
  setText(ui.hungNum, Math.ceil(p.hunger));
  setText(ui.thirstNum, Math.ceil(p.thirst));
  vitalRows[0]?.classList.toggle('low', hpPct < 28);
  vitalRows[1]?.classList.toggle('low', huPct < 22);
  vitalRows[2]?.classList.toggle('low', thPct < 22);

  if (game.stage >= 4) {
    ui.moltWrap.style.display = 'none';
  } else {
    ui.moltWrap.style.display = 'flex';
    const ready = game.biomass >= cost;
    ui.moltWrap.classList.toggle('ready', ready);
    ui.moltFill.style.width = `${clamp((game.biomass / cost) * 100, 0, 100)}%`;
    let note;
    if (ready) note = p.thirst < 28 ? 'drink before molting' : 'ready — press E';
    else note = `${Math.ceil(cost - game.biomass)} biomass to shed`;
    setText(ui.moltNote, note);
  }

  // skitter is a nymph trick; hide its touch button until the first molt
  ui.dashBtn.style.display = game.stage >= 1 ? '' : 'none';
  ui.dashBtn.classList.toggle('cooling', p.dashCd > 0.04);

  const pct = clamp((p.x / WORLD_W) * 100, 2, 98);
  ui.journeyFill.style.width = `${pct}%`;
  ui.journeyBug.style.left = `${pct}%`;
  journeyStops.forEach((el, i) => {
    el.classList.toggle('current', i === game.zoneIndex);
    el.classList.toggle('done', i < game.zoneIndex);
  });
  if (ui.miniJourney) {
    Array.from(ui.miniJourney.children).forEach((el, i) => {
      el.classList.toggle('current', i === game.zoneIndex);
      el.classList.toggle('done', i < game.zoneIndex);
    });
  }

  const boss = game.boss;
  const showBoss = game.bossEngaged && boss && boss.alive && !boss.sleeping && game.state === 'playing';
  ui.bossBar.hidden = !showBoss;
  if (showBoss) ui.bossFill.style.width = `${clamp((boss.hp / boss.maxHp) * 100, 0, 100)}%`;

  updateHint();
}

function updateHint() {
  const p = game.player;
  if (!p) return;
  let hint = '';
  if (game.state === 'playing' || game.state === 'paused') {
    if (game.bossDead) hint = 'The Heartwood is quiet. The garden is yours.';
    else if (game.stage >= 4 && game.bossEngaged) hint = 'The Mantis Queen. Skitter through her lunges and bite.';
    else if (game.stage >= 4) hint = 'Find the sleeping queen at the far end of the wood.';
    else if (game.blocked) hint = 'The thicket is too dense. Molt to pass.';
    else if (game.biomass >= MOLT_COST[game.stage]) {
      hint = p.thirst < 28 ? 'Drink before you molt — the new skin needs water.' : 'You are ready. Press E to shed your skin.';
    } else if (p.thirst < 22) hint = 'Your shell is drying. Find still water on the path.';
    else if (p.hunger < 22) hint = 'Hunger. Something small is moving nearby.';
    else if (game.stage === 0) hint = 'Walk into aphids to bite. Drink from still water.';
    else if (game.stage === 1) hint = 'Run down flies. The meadow opens to the east.';
    else if (game.stage === 2) hint = 'Hunt moths and spiders. The forest edge is close.';
    else hint = 'The deep wood breathes. Keep moving east.';
  }
  setText(ui.hint, hint);
}

function flash(text, ms = 3000) {
  ui.floatMsg.textContent = text;
  ui.floatMsg.classList.add('show');
  clearTimeout(floatTimeout);
  floatTimeout = setTimeout(() => ui.floatMsg.classList.remove('show'), ms);
}

function enterZone(zone, initial = false) {
  ui.ztName.textContent = zone.name;
  ui.ztLine.textContent = zone.line;
  ui.zoneToast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => ui.zoneToast.classList.remove('show'), 3600);
  sound.setZone(zone.id);
  if (!initial && game.player) {
    burst(game.player.x, game.player.y, '#efe6c4', 8, { speed: 40, life: 1.1, size: 2.4, type: 'leaf', gravity: 6 });
  }
}

// ————————————————————————————————————————————————
// flow
// ————————————————————————————————————————————————

function hideOverlay(el) {
  if (el) el.classList.remove('show');
}

function showOverlay(el) {
  if (el) el.classList.add('show');
}

async function startGame(save) {
  if (painting) return;
  painting = true;
  document.body.classList.remove('paused', 'evolving', 'dead', 'won');
  sound.init();
  game.muted = !!game.muted;
  sound.setMuted(game.muted);
  hideOverlay(ui.titleScreen);
  document.body.classList.remove('is-title');
  ui.loading.classList.add('show');
  ui.loadingFill.style.width = '0%';
  game.state = 'loading';
  await nextFrame();

  for (let i = 0; i < ZONES.length; i++) {
    if (!zoneArt[i]) {
      ui.loadingFill.style.width = `${(i / ZONES.length) * 100}%`;
      await nextFrame();
      zoneArt[i] = paintZoneCanvas(ZONES[i]);
    }
    ui.loadingFill.style.width = `${((i + 1) / ZONES.length) * 100}%`;
    await nextFrame();
  }

  if (!save) {
    const params = new URLSearchParams(window.location.search);
    if (params.has('stage')) {
      const sx = parseFloat(params.get('x') || '500');
      const stage = clamp(parseInt(params.get('stage'), 10) || 0, 0, 4);
      save = {
        stage,
        biomass: parseInt(params.get('biomass'), 10) || 0,
        x: sx,
        y: pathY(sx),
        hp: STAGES[stage].hp,
        hunger: 80, thirst: 80, eaten: 0, time: 0,
        bossDead: params.get('bossdead') === '1',
      };
    }
  }

  initWorld(save);
  game.muted = !!(save && save.muted);
  sound.setMuted(game.muted);
  updateMuteIcon();
  document.body.classList.add('playing');
  await nextFrame();
  ui.loading.classList.remove('show');
  game.state = 'playing';
  enterZone(ZONES[game.zoneIndex], true);
  if (game.stage > 0) flash(`Instar ${STAGES[game.stage].numeral} — ${STAGES[game.stage].name}`, 3000);
  else flash('Walk into prey to bite. Drink from still water. Shed when full.', 4800);
  saveGame();
  painting = false;
  rafLast = performance.now();
}

function tryMolt() {
  if (game.state !== 'playing') return;
  if (game.stage >= 4) { flash('You are fully grown.', 2000); return; }
  const cost = MOLT_COST[game.stage];
  if (game.biomass < cost) {
    flash(`Not yet — ${Math.ceil(cost - game.biomass)} more biomass.`, 2400);
    return;
  }
  if (game.player.thirst < 28) {
    flash('Your shell is dry. Drink before you molt.', 2800);
    return;
  }
  beginEvolve();
}

const EVOLVE_KICKERS = [
  'the old skin splits',
  'a shell hardens in the sun',
  'something antlered pushes through',
  'the wood makes room',
];

function beginEvolve() {
  const next = game.stage + 1;
  const st = STAGES[next];
  game.state = 'evolve';
  document.body.classList.add('evolving');
  sound.evolve();
  const p = game.player;
  burst(p.x, p.y, '#d9c98d', 36, { speed: 160, life: 1.6, size: 3, type: 'spark' });
  burst(p.x, p.y, '#f0e7c4', 20, { speed: 60, life: 2, size: 4.5, type: 'dot', gravity: -12 });
  game.shake = 5;

  setText(ui.evolveName, st.name);
  setText(ui.evolveRoman, st.numeral);
  setText(ui.evolveTrait, st.trait);
  ui.evolveStats.innerHTML = `
    <div>size<b>${st.r * 2}</b></div>
    <div>speed<b>${st.speed}</b></div>
    <div>bite<b>${st.bite}</b></div>`;
  ui.evolveScreen.querySelector('.kicker').textContent = EVOLVE_KICKERS[game.stage] || 'the old skin splits';
  ui.evolveScreen.classList.add('show');
  updateUI();
  saveGame();
}

function emerge() {
  if (game.state !== 'evolve') return;
  const next = game.stage + 1;
  if (next > 4) return;
  game.biomass = Math.max(0, game.biomass - MOLT_COST[game.stage]);
  setStage(next, true);
  const p = game.player;
  p.hunger = Math.min(100, p.hunger + 26);
  p.thirst = Math.min(100, p.thirst + 26);
  p.hurtT = 1.4;
  p.attackCd = 0.35;
  hideOverlay(ui.evolveScreen);
  document.body.classList.remove('evolving');
  game.state = 'playing';
  game.nextMilestone = -1;
  game.shake = 6;
  burst(p.x, p.y, '#d9c98d', 44, { speed: 190, life: 1.8, size: 3, type: 'spark' });
  burst(p.x, p.y, '#8dab6a', 24, { speed: 80, life: 2.2, size: 5, type: 'leaf', gravity: 12 });
  const unlocked = next === 1 ? 'The meadow opens.' : next === 2 ? 'The forest edge opens.' : next === 3 ? 'The deep wood opens.' : 'The forest notices you.';
  flash(`Instar ${STAGES[next].numeral} — ${STAGES[next].name}. ${unlocked}`, 4400);
  saveGame();
  rafLast = performance.now();
}

function pauseGame() {
  if (game.state !== 'playing') return;
  game.state = 'paused';
  document.body.classList.add('paused');
  ui.pauseScreen.classList.add('show');
  saveGame();
}

function resumeGame() {
  if (game.state !== 'paused') return;
  hideOverlay(ui.pauseScreen);
  document.body.classList.remove('paused');
  game.state = 'playing';
  rafLast = performance.now();
}

function showDeath() {
  const p = game.player;
  const lines = [
    'You were smaller than the world. It happens.',
    'The garden closes over you, softly, without judgment.',
    'Every shell is borrowed. Even yours.',
  ];
  ui.deathLine.textContent = lines[(Math.random() * lines.length) | 0];
  ui.deathStats.innerHTML = `
    <div>instar<b>${STAGES[game.stage].numeral}</b></div>
    <div>prey eaten<b>${game.eaten}</b></div>
    <div>time lived<b>${fmtTime(game.playTime)}</b></div>`;
  hideOverlay(ui.evolveScreen);
  hideOverlay(ui.pauseScreen);
  ui.deathScreen.classList.add('show');
  saveGame();
}

function riseAgain() {
  hideOverlay(ui.deathScreen);
  document.body.classList.remove('dead');
  const zi = Math.min(3, game.stage);
  const zone = ZONES[zi];
  const p = game.player;
  p.x = zone.x0 + 200;
  p.y = pathY(p.x);
  p.vx = 0; p.vy = 0;
  p.hp = p.maxHp;
  p.hunger = Math.max(58, p.hunger);
  p.thirst = Math.max(58, p.thirst);
  p.hurtT = 1.8;
  p.attackCd = 0.4;

  const b = game.boss;
  if (b && !game.bossDead) {
    b.alive = true;
    b.hp = b.maxHp;
    b.x = b.homeX;
    b.y = b.homeY;
    b.sleeping = game.stage < 4;
    b.aggro = false;
    b.state = 'idle';
    b.waking = 0;
    b.lungeCd = 2.6;
    b.vx = 0; b.vy = 0;
  }
  game.bossEngaged = false;
  game.zoneIndex = zi;
  seedMotes();
  game.cam.x = p.x;
  game.cam.y = p.y;
  game.cam.zoom = 1.02 - game.stage * 0.025;
  game.state = 'playing';
  game.hurtFlash = 0.35;
  game.blocked = false;
  enterZone(zone, true);
  flash('You rise with the same hunger.', 3200);
  saveGame();
  rafLast = performance.now();
}

function showWin() {
  if (game.state !== 'playing') return;
  game.state = 'win';
  document.body.classList.add('won');
  game.bossEngaged = false;
  ui.winStats.innerHTML = `
    <div>time<b>${fmtTime(game.playTime)}</b></div>
    <div>prey eaten<b>${game.eaten}</b></div>
    <div>instar<b>${STAGES[4].numeral}</b></div>`;
  ui.winScreen.classList.add('show');
  saveGame();
}

function wanderOn() {
  hideOverlay(ui.winScreen);
  document.body.classList.remove('won');
  game.state = 'playing';
  flash('The garden keeps going.', 3000);
  rafLast = performance.now();
}

async function newLife() {
  hideOverlay(ui.pauseScreen);
  hideOverlay(ui.winScreen);
  hideOverlay(ui.deathScreen);
  clearSave();
  game.stage = 0;
  game.biomass = 0;
  game.eaten = 0;
  game.playTime = 0;
  game.bossDead = false;
  await startGame(null);
}

function updateMuteIcon() {
  const use = ui.muteBtn.querySelector('use');
  if (use) use.setAttribute('href', game.muted ? '#i-mute' : '#i-sound');
  ui.muteBtn.setAttribute('aria-label', game.muted ? 'Unmute sound' : 'Mute sound');
}

function toggleMute() {
  game.muted = !game.muted;
  sound.setMuted(game.muted);
  updateMuteIcon();
  flash(game.muted ? 'Sound off.' : 'Sound on.', 1200);
  saveGame();
}

// ————————————————————————————————————————————————
// bootstrap
// ————————————————————————————————————————————————

function boot() {
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const rr = Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2);
      this.moveTo(x + rr, y);
      this.arcTo(x + w, y, x + w, y + h, rr);
      this.arcTo(x + w, y + h, x, y + h, rr);
      this.arcTo(x, y + h, x, y, rr);
      this.arcTo(x, y, x + w, y, rr);
      this.closePath();
      return this;
    };
  }

  document.body.classList.toggle('touch', isTouch);
  if (isTouch) {
    ui.titleControls.innerHTML = '<span>left stick</span> crawl &nbsp;·&nbsp; <span>run into prey</span> to bite &nbsp;·&nbsp; <span>skitter</span> dash &nbsp;·&nbsp; <span>molt</span> evolve';
    const list = ui.pauseScreen.querySelector('.controls-list');
    if (list) {
      list.innerHTML = `
        <div><kbd>left stick</kbd><span>crawl</span></div>
        <div><kbd>run into prey</kbd><span>bite smaller creatures</span></div>
        <div><kbd>skitter</kbd><span>a short burst</span></div>
        <div><kbd>molt</kbd><span>shed your skin</span></div>
        <div><kbd>pause</kbd><span>the button above</span></div>`;
    }
  }

  resize();
  paintTitleArt(ui.titleArt);
  ui.titleScreen.classList.add('show');

  const save = loadSave();
  if (save) {
    ui.continueBtn.hidden = false;
    ui.continueBtn.textContent = `Continue — ${STAGES[save.stage].name}`;
  }

  ui.beginBtn.addEventListener('click', () => startGame(null));
  ui.continueBtn.addEventListener('click', () => startGame(loadSave()));
  ui.pauseBtn.addEventListener('click', pauseGame);
  ui.muteBtn.addEventListener('click', toggleMute);
  ui.resumeBtn.addEventListener('click', resumeGame);
  ui.restartBtn.addEventListener('click', newLife);
  ui.riseBtn.addEventListener('click', riseAgain);
  ui.emergeBtn.addEventListener('click', emerge);
  ui.wanderBtn.addEventListener('click', wanderOn);
  ui.againBtn.addEventListener('click', newLife);
  ui.moltBtn.addEventListener('click', tryMolt);

  window.addEventListener('resize', () => {
    resize();
    clearTimeout(boot._resize);
    boot._resize = setTimeout(() => {
      if (game.state === 'title') paintTitleArt(ui.titleArt);
    }, 180);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (game.state === 'playing') pauseGame();
      saveGame();
    }
  });
  window.addEventListener('beforeunload', saveGame);

  updateMuteIcon();
  requestAnimationFrame(loop);
}

function loop(now) {
  const dt = Math.min(0.05, Math.max(0, (now - rafLast) / 1000));
  rafLast = now;
  if (game.state === 'playing') {
    updatePlaying(dt);
  } else if (game.state === 'win' || game.state === 'evolve') {
    updateParticles(dt);
    updateTexts(dt);
    updateMotes(dt);
    updateCamera(dt);
  }
  render();
  updateUI();
  requestAnimationFrame(loop);
}

boot();

// Small inspection hook for automated play-testing (harmless in normal play).
window.__molt = {
  game,
  startGame,
  setStage,
  spawnWorld,
  saveGame,
  tryMolt,
  emerge,
  paintZoneCanvas,
};

