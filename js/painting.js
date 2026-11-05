// Watercolor painting primitives and procedural biome artwork.
import {
  TAU, clamp, lerp, hexA, mixHex, mulberry32, pick, between,
} from './util.js';
import { pathY, ZONES } from './world.js';

export const PALETTES = {
  garden: {
    paper: '#efe6cf',
    washes: ['#93b06c', '#b8cb8b', '#7c9e5c', '#d0d49c', '#a8c07f', '#dfd3a0', '#6c9153'],
    ink: '#46502f',
    path: '#d5c194',
    accents: ['#e6bd5e', '#d98a6f', '#f3e7c0', '#b29cc9', '#ecd79a', '#f0d9c0'],
    water: '#84b6b4',
    waterDeep: '#46787d',
    light: '#fff0c0',
    mist: '#f2ead4',
  },
  meadow: {
    paper: '#f1e8d0',
    washes: ['#b3b468', '#cdc383', '#98a45f', '#ddd092', '#bfb874', '#a5ab63', '#d8c47a'],
    ink: '#494b30',
    path: '#dcc697',
    accents: ['#dfa459', '#cf7f68', '#c9b3d6', '#efe2b6', '#d98f5a', '#f0dfb2'],
    water: '#8bb9b1',
    waterDeep: '#54848a',
    light: '#ffeeb8',
    mist: '#f4ebd2',
  },
  edge: {
    paper: '#eae2cc',
    washes: ['#6f926e', '#8ba886', '#577b63', '#a6b491', '#4c705c', '#7c9b75', '#9bad83'],
    ink: '#37453a',
    path: '#cbb892',
    accents: ['#c4745d', '#e0d3a8', '#8f7ca0', '#d8c07a', '#b06a55', '#e7dcb8'],
    water: '#76a7a9',
    waterDeep: '#477a80',
    light: '#e8e0af',
    mist: '#e4dfc6',
  },
  deep: {
    paper: '#e2ddc7',
    washes: ['#456c61', '#5f8477', '#34564e', '#74907c', '#294b44', '#527468', '#80977f'],
    ink: '#263a34',
    path: '#ada88a',
    accents: ['#d9c98d', '#a9cf8d', '#c98f70', '#9fb9d1', '#e0d6a4', '#7fae92'],
    water: '#6b9da3',
    waterDeep: '#3d6f78',
    light: '#d8e2ae',
    mist: '#dcdcc2',
  },
};

// ————————————————————————————————————————————————
// primitives
// ————————————————————————————————————————————————

export function softBlob(ctx, x, y, rx, ry, color, alpha, rot = 0) {
  if (rx <= 0 || ry <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0.05, -0.05, 0.02, 0, 0, 1);
  g.addColorStop(0, hexA(color, alpha));
  g.addColorStop(0.55, hexA(color, alpha * 0.72));
  g.addColorStop(0.82, hexA(color, alpha * 0.28));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function blobPath(ctx, x, y, rx, ry, rot = 0, seed = 1, wob = 0.1) {
  const n = 24;
  const pts = [];
  const c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const r = 1
      + Math.sin(a * 3 + seed) * wob
      + Math.sin(a * 5 + seed * 1.7) * wob * 0.55
      + Math.sin(a * 7 + seed * 0.6) * wob * 0.3;
    const px = Math.cos(a) * rx * r;
    const py = Math.sin(a) * ry * r;
    pts.push([x + px * c - py * s, y + px * s + py * c]);
  }
  ctx.beginPath();
  const mx = (pts[n - 1][0] + pts[0][0]) / 2;
  const my = (pts[n - 1][1] + pts[0][1]) / 2;
  ctx.moveTo(mx, my);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

export function washEllipse(ctx, x, y, rx, ry, color, alpha, rot = 0, seed = 1, wob = 0.08) {
  ctx.save();
  blobPath(ctx, x, y, rx, ry, rot, seed, wob);
  ctx.fillStyle = hexA(color, alpha);
  ctx.fill();
  if (alpha > 0.08) {
    blobPath(ctx, x + rx * 0.06, y - ry * 0.08, rx * 0.8, ry * 0.79, rot, seed + 2, wob * 1.2);
    ctx.fillStyle = hexA(color, alpha * 0.45);
    ctx.fill();
  }
  ctx.restore();
}

export function inkContour(ctx, x, y, rx, ry, color, alpha = 0.4, lw = 1, rot = 0, seed = 1, wob = 0.1) {
  blobPath(ctx, x, y, rx, ry, rot, seed, wob);
  ctx.strokeStyle = hexA(color, alpha);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function brushCurve(ctx, x1, y1, cx, cy, x2, y2, color, alpha, lw) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.strokeStyle = hexA(color, alpha);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function splatter(ctx, x, y, r, color, alpha, rnd, count = 12) {
  for (let i = 0; i < count; i++) {
    const a = rnd() * TAU;
    const d = Math.pow(rnd(), 0.6) * r;
    const size = between(rnd, 0.4, 2.6) * (1 - d / (r * 1.4));
    ctx.fillStyle = hexA(color, alpha * between(rnd, 0.35, 1));
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(0.3, size), 0, TAU);
    ctx.fill();
  }
}

export function paperGrain(ctx, w, h, rnd, count = 6000) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w, y = rnd() * h;
    const light = rnd() > 0.55;
    ctx.fillStyle = light
      ? `rgba(255,252,240,${between(rnd, 0.02, 0.15)})`
      : `rgba(80,78,52,${between(rnd, 0.015, 0.075)})`;
    const s = between(rnd, 0.3, 1.4);
    ctx.fillRect(x, y, s, s);
  }
  // a few darker granules
  for (let i = 0; i < count * 0.08; i++) {
    ctx.fillStyle = `rgba(66,68,46,${between(rnd, 0.03, 0.1)})`;
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h, between(rnd, 0.4, 1.1), 0, TAU);
    ctx.fill();
  }
}

function grassTuft(ctx, x, y, h, color, ink, alpha, rnd) {
  const blades = 2 + ((rnd() * 4) | 0);
  for (let b = 0; b < blades; b++) {
    const lean = between(rnd, -0.75, 0.75) * h;
    const bh = h * between(rnd, 0.55, 1);
    const cx = x + lean * 0.25;
    const cy = y - bh * 0.55;
    const tx = x + lean;
    const ty = y - bh;
    ctx.beginPath();
    ctx.moveTo(x + between(rnd, -1.5, 1.5), y);
    ctx.quadraticCurveTo(cx, cy, tx, ty);
    ctx.strokeStyle = hexA(color, alpha * between(rnd, 0.45, 1));
    ctx.lineWidth = between(rnd, 0.55, 1.5);
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  if (rnd() > 0.82) {
    ctx.fillStyle = hexA(ink, alpha * 0.45);
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.35, 0.8, 2.4, 0.4, 0, TAU);
    ctx.fill();
  }
}

function foliageClump(ctx, x, y, size, color, ink, alpha, rnd) {
  // soft mossy body
  softBlob(ctx, x, y, size * 1.15, size * 0.85, color, alpha * 1.15, between(rnd, -0.5, 0.5));
  softBlob(ctx, x - size * 0.16, y - size * 0.14, size * 0.7, size * 0.5, mixHex(color, '#e8dfb8', 0.22), alpha * 0.7);
  // rounded leaf masses
  const lobes = 3 + ((rnd() * 4) | 0);
  for (let i = 0; i < lobes; i++) {
    const a = rnd() * TAU;
    const d = size * between(rnd, 0.12, 0.62);
    const lx = x + Math.cos(a) * d;
    const ly = y + Math.sin(a) * d * 0.7;
    const lr = size * between(rnd, 0.22, 0.44);
    washEllipse(ctx, lx, ly, lr, lr * 0.72, mixHex(color, pick(rnd, ['#e5dcb4', '#3f5b3c', color]), 0.2), alpha * between(rnd, 0.6, 1.1), a, rnd() * 12, 0.2);
    inkContour(ctx, lx, ly, lr * 0.92, lr * 0.64, ink, alpha * 0.5, 0.7, a, rnd() * 10, 0.18);
  }
  // a few crisp leaf blades poking out
  for (let i = 0; i < 5; i++) {
    const a = between(rnd, -Math.PI, Math.PI);
    const r0 = size * between(rnd, 0.2, 0.55);
    const r1 = size * between(rnd, 0.8, 1.15);
    brushCurve(
      ctx,
      x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.7,
      x + Math.cos(a) * (r0 + r1) * 0.5, y + Math.sin(a) * (r0 + r1) * 0.5 - size * 0.1,
      x + Math.cos(a) * r1, y + Math.sin(a) * r1 * 0.7,
      mixHex(color, ink, 0.22), alpha * 0.8, between(rnd, 0.6, 1.3),
    );
  }
}

export function daisy(ctx, x, y, r, petal, heart, ink, alpha, rnd, petals = 7) {
  softBlob(ctx, x, y, r * 2.4, r * 2.2, petal, alpha * 0.13);
  const rot = rnd() * TAU;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(r * 0.62, 0, r * 0.58, r * 0.25, 0, 0, TAU);
    ctx.fillStyle = hexA(petal, alpha * between(rnd, 0.55, 0.9));
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, TAU);
  ctx.fillStyle = hexA(heart, alpha * 1.15);
  ctx.fill();
  ctx.strokeStyle = hexA(ink, alpha * 0.4);
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
}

function poppy(ctx, x, y, r, petal, ink, alpha, rnd) {
  softBlob(ctx, x, y, r * 2.8, r * 2.6, petal, alpha * 0.18);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rnd() * TAU);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + between(rnd, -0.2, 0.2);
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(r * 0.5, 0, r * 0.55, r * 0.42, 0, 0, TAU);
    ctx.fillStyle = hexA(petal, alpha * between(rnd, 0.4, 0.75));
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.26, 0, TAU);
  ctx.fillStyle = hexA(ink, alpha * 0.65);
  ctx.fill();
  ctx.restore();
}

function seedHead(ctx, x, y, h, color, ink, alpha, rnd) {
  brushCurve(ctx, x, y, x + h * 0.06, y - h * 0.5, x + between(rnd, -6, 6), y - h, ink, alpha * 0.55, 0.8);
  const tx = x + between(rnd, -6, 6);
  const ty = y - h;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + between(rnd, -1.1, 1.1);
    const len = h * between(rnd, 0.09, 0.19);
    brushCurve(ctx, tx, ty, tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6, tx + Math.cos(a) * len, ty + Math.sin(a) * len, color, alpha * 0.5, 0.7);
  }
  ctx.fillStyle = hexA(ink, alpha * 0.35);
  ctx.beginPath();
  ctx.ellipse(tx, ty, 1.4, 3.2, 0.1, 0, TAU);
  ctx.fill();
}

function clover(ctx, x, y, r, color, alpha, rnd) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rnd() * TAU);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate((i / 3) * TAU);
    ctx.beginPath();
    ctx.ellipse(r * 0.55, 0, r * 0.5, r * 0.34, 0, 0, TAU);
    ctx.fillStyle = hexA(color, alpha * 0.65);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function fern(ctx, x, y, size, color, ink, alpha, rnd) {
  const fronds = 4 + ((rnd() * 3) | 0);
  for (let f = 0; f < fronds; f++) {
    const baseA = -Math.PI / 2 + (f / fronds - 0.5) * 2.1 + between(rnd, -0.15, 0.15);
    const len = size * between(rnd, 0.65, 1.05);
    const ex = x + Math.cos(baseA) * len;
    const ey = y + Math.sin(baseA) * len;
    const cx = x + Math.cos(baseA) * len * 0.5 + between(rnd, -8, 8);
    const cy = y + Math.sin(baseA) * len * 0.5;
    brushCurve(ctx, x, y, cx, cy, ex, ey, ink, alpha * 0.55, 0.9);
    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mx = lerp(x, ex, t) + Math.sin(t * 3) * 2;
      const my = lerp(y, ey, t);
      const ll = size * 0.15 * (1 - t * 0.6);
      for (const side of [-1, 1]) {
        const a = baseA + side * 1.05;
        brushCurve(ctx, mx, my, mx + Math.cos(a) * ll * 0.5, my + Math.sin(a) * ll * 0.5, mx + Math.cos(a) * ll, my + Math.sin(a) * ll, color, alpha * 0.5, 0.75);
      }
    }
  }
}

function mushroom(ctx, x, y, r, capColor, stemColor, ink, alpha, rnd, spots = 3) {
  const stemH = r * between(rnd, 0.9, 1.5);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.16, y);
  ctx.quadraticCurveTo(x - r * 0.12, y - stemH * 0.5, x - r * 0.18, y - stemH);
  ctx.lineTo(x + r * 0.18, y - stemH);
  ctx.quadraticCurveTo(x + r * 0.12, y - stemH * 0.5, x + r * 0.16, y);
  ctx.closePath();
  ctx.fillStyle = hexA(stemColor, alpha * 0.8);
  ctx.fill();
  ctx.strokeStyle = hexA(ink, alpha * 0.3);
  ctx.lineWidth = 0.6;
  ctx.stroke();

  ctx.save();
  ctx.translate(x, y - stemH);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.95, r * 0.5, 0, Math.PI, TAU);
  ctx.lineTo(-r * 0.95, 0);
  ctx.closePath();
  ctx.fillStyle = hexA(capColor, alpha * 0.82);
  ctx.fill();
  ctx.strokeStyle = hexA(ink, alpha * 0.35);
  ctx.lineWidth = 0.7;
  ctx.stroke();
  for (let i = 0; i < spots; i++) {
    ctx.beginPath();
    ctx.arc(between(rnd, -r * 0.55, r * 0.55), between(rnd, -r * 0.34, -r * 0.08), between(rnd, 0.6, 1.8), 0, TAU);
    ctx.fillStyle = hexA('#f8f0da', alpha * 0.75);
    ctx.fill();
  }
  ctx.restore();
}

function cabbage(ctx, x, y, r, color, ink, alpha, rnd) {
  softBlob(ctx, x, y, r * 1.6, r * 1.3, color, alpha * 0.2);
  for (let i = 0; i < 5; i++) {
    const rr = r * (1 - i * 0.14);
    washEllipse(ctx, x + between(rnd, -2, 2), y + between(rnd, -1.5, 1.5), rr, rr * 0.78, mixHex(color, '#f4eed7', i * 0.13), alpha * 0.32, between(rnd, -0.2, 0.2), i * 3 + rnd() * 2, 0.16);
  }
  inkContour(ctx, x, y, r * 0.98, r * 0.76, ink, alpha * 0.3, 0.8, 0, 4, 0.15);
}

export function giantLeaf(ctx, x, y, r, rot, color, ink, alpha, rnd) {
  softBlob(ctx, x, y, r * 1.1, r * 0.9, color, alpha * 0.16, rot);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(r * 0.55, -r * 0.62, r, 0);
  ctx.quadraticCurveTo(r * 0.55, r * 0.62, 0, 0);
  ctx.fillStyle = hexA(color, alpha * 0.55);
  ctx.fill();
  ctx.strokeStyle = hexA(ink, alpha * 0.4);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(r * 0.5, r * 0.06, r * 0.97, 0);
  ctx.strokeStyle = hexA(ink, alpha * 0.35);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * t * 0.9, 0);
      ctx.quadraticCurveTo(r * (t + 0.06) * 0.9, side * r * 0.22, r * (t + 0.1), side * r * 0.35 * (1 - t * 0.4));
      ctx.strokeStyle = hexA(ink, alpha * 0.22);
      ctx.lineWidth = 0.55;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function fallenLog(ctx, x, y, len, thickness, color, ink, alpha, rnd) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(between(rnd, -0.16, 0.16));
  softBlob(ctx, 0, 0, len * 0.55, thickness * 0.9, '#4b5a3c', alpha * 0.2);
  ctx.beginPath();
  ctx.roundRect(-len / 2, -thickness / 2, len, thickness, thickness / 2);
  ctx.fillStyle = hexA(color, alpha * 0.75);
  ctx.fill();
  ctx.strokeStyle = hexA(ink, alpha * 0.38);
  ctx.lineWidth = 1;
  ctx.stroke();
  // end rings
  for (const ex of [-len / 2, len / 2]) {
    ctx.beginPath();
    ctx.ellipse(ex, 0, thickness * 0.22, thickness * 0.42, 0, 0, TAU);
    ctx.fillStyle = hexA(mixHex(color, '#efe4c8', 0.4), alpha * 0.75);
    ctx.fill();
    ctx.strokeStyle = hexA(ink, alpha * 0.4);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    brushCurve(ctx, between(rnd, -len * 0.42, len * 0.42), -thickness * 0.3, between(rnd, -len * 0.3, len * 0.3), between(rnd, -thickness * 0.5, thickness * 0.5), between(rnd, -len * 0.4, len * 0.4), thickness * 0.25, ink, alpha * 0.2, 0.7);
  }
  // moss
  for (let i = 0; i < 8; i++) {
    softBlob(ctx, between(rnd, -len * 0.4, len * 0.4), -thickness * 0.4 + between(rnd, -thickness * 0.2, thickness * 0.4), between(rnd, 8, 26), between(rnd, 4, 12), '#7d9559', alpha * 0.35);
  }
  ctx.restore();
}

function rootLines(ctx, x, y, size, ink, alpha, rnd) {
  for (let i = 0; i < 4; i++) {
    const ex = x + between(rnd, -size, size);
    const ey = y + between(rnd, -size * 0.4, size * 0.4);
    const cx = (x + ex) / 2 + between(rnd, -size * 0.2, size * 0.2);
    const cy = (y + ey) / 2 + between(rnd, -size * 0.3, size * 0.3);
    brushCurve(ctx, x, y, cx, cy, ex, ey, ink, alpha * between(rnd, 0.25, 0.55), between(rnd, 1, 3.2));
    if (rnd() > 0.5) {
      brushCurve(ctx, cx, cy, cx + between(rnd, -40, 40), cy + between(rnd, -20, 30), cx + between(rnd, -80, 80), cy + between(rnd, -10, 50), ink, alpha * 0.25, 1.2);
    }
  }
}

// ————————————————————————————————————————————————
// biome painting
// ————————————————————————————————————————————————

export function paintZoneCanvas(zone) {
  const S = 0.8;
  const w = zone.x1 - zone.x0;
  const h = 1800;
  const cv = document.createElement('canvas');
  cv.width = Math.round(w * S);
  cv.height = Math.round(h * S);
  const ctx = cv.getContext('2d');
  ctx.scale(S, S);
  const P = PALETTES[zone.palette];
  const rnd = mulberry32(zone.x0 * 7 + zone.index * 991 + 17);
  const absX = (x) => zone.x0 + x;

  // — base paper
  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, w, h);

  // broad first wash, slightly darker at the edges of the world
  const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
  baseGrad.addColorStop(0, hexA(P.washes[0], 0.16));
  baseGrad.addColorStop(0.45, hexA(P.washes[2], 0.08));
  baseGrad.addColorStop(1, hexA(P.washes[5] || P.washes[0], 0.19));
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  // large wet washes
  for (let i = 0; i < 52; i++) {
    const x = rnd() * w, y = rnd() * h;
    const rx = between(rnd, 140, 430), ry = between(rnd, 90, 330);
    softBlob(ctx, x, y, rx, ry, pick(rnd, P.washes), between(rnd, 0.08, 0.19), between(rnd, -0.5, 0.5));
  }
  // broad undergrowth shadow
  for (let i = 0; i < 24; i++) {
    softBlob(ctx, rnd() * w, rnd() * h, between(rnd, 90, 260), between(rnd, 60, 200), mixHex(P.washes[2], P.ink, 0.3), between(rnd, 0.06, 0.13));
  }
  // sunlight / light pools
  const lights = zone.palette === 'deep' ? 12 : 18;
  for (let i = 0; i < lights; i++) {
    softBlob(ctx, rnd() * w, rnd() * h, between(rnd, 70, 240), between(rnd, 60, 200), P.light, between(rnd, 0.08, 0.18));
  }
  // damp blooms — pigment rings
  for (let i = 0; i < 22; i++) {
    const x = rnd() * w, y = rnd() * h, r = between(rnd, 24, 85);
    for (let k = 0; k < 3; k++) {
      inkContour(ctx, x, y, r * (0.7 + k * 0.18), r * (0.62 + k * 0.17), P.ink, between(rnd, 0.025, 0.07), between(rnd, 0.7, 2.4), between(rnd, -0.4, 0.4), rnd() * 10 + k, 0.2);
    }
  }
  // leafy clumps give the ground some body
  for (let i = 0; i < 46; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    if (Math.abs(y - pathY(absX(x))) < 130 && rnd() < 0.7) continue;
    foliageClump(ctx, x, y, between(rnd, 28, 80), pick(rnd, P.washes), P.ink, between(rnd, 0.13, 0.27), rnd);
  }

  // — the walk
  const steps = Math.ceil(w / 26);
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const py = pathY(absX(x));
    softBlob(ctx, x, py, 94, 180, P.path, 0.17);
  }
  for (let i = 0; i <= steps; i += 1) {
    const x = (i / steps) * w;
    const py = pathY(absX(x));
    softBlob(ctx, x + between(rnd, -6, 6), py + between(rnd, -20, 20), 42, 112, mixHex(P.path, P.paper, 0.25), 0.12);
  }
  // a soft worn edge either side of the walk
  for (let i = 0; i <= steps; i += 2) {
    const x = (i / steps) * w;
    const py = pathY(absX(x));
    for (const side of [-1, 1]) {
      brushCurve(
        ctx, x - 14, py + side * (132 + Math.sin(x * 0.01) * 16),
        x, py + side * (150 + Math.cos(x * 0.013) * 14),
        x + 14, py + side * (136 + Math.sin(x * 0.009) * 18),
        P.ink, 0.07, 2.2,
      );
    }
  }
  // scattered dry brush on the walk
  for (let i = 0; i < 320; i++) {
    const x = rnd() * w;
    const y = pathY(absX(x)) + between(rnd, -125, 125);
    ctx.fillStyle = hexA(mixHex(P.path, P.ink, 0.25), between(rnd, 0.05, 0.16));
    ctx.beginPath();
    ctx.ellipse(x, y, between(rnd, 0.6, 3.4), between(rnd, 0.4, 1.4), between(rnd, -1, 1), 0, TAU);
    ctx.fill();
  }

  // little pebbles on the walk
  const pebbles = zone.palette === 'garden' ? 34 : 20;
  for (let i = 0; i < pebbles; i++) {
    const x = rnd() * w;
    const y = pathY(absX(x)) + between(rnd, -100, 100);
    washEllipse(ctx, x, y, between(rnd, 2, 7), between(rnd, 1.4, 4), mixHex(P.path, '#8d8970', 0.35), 0.45, rnd() * TAU, rnd() * 9, 0.16);
  }

  // — grass field
  const grassCount = zone.palette === 'meadow' ? 3400 : zone.palette === 'deep' ? 2600 : 3000;
  for (let i = 0; i < grassCount; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const d = Math.abs(y - pathY(absX(x)));
    if (d < 55 && rnd() < 0.82) continue;
    if (d < 135 && rnd() < 0.38) continue;
    if (zone.palette === 'meadow') {
      grassTuft(ctx, x, y, between(rnd, 14, 52), pick(rnd, P.washes), P.ink, between(rnd, 0.26, 0.58), rnd);
    } else {
      grassTuft(ctx, x, y, between(rnd, 10, 40), pick(rnd, P.washes), P.ink, between(rnd, 0.25, 0.54), rnd);
    }
  }
  // soft grass shadow clumps
  for (let i = 0; i < 150; i++) {
    softBlob(ctx, rnd() * w, rnd() * h, between(rnd, 20, 90), between(rnd, 10, 40), P.ink, between(rnd, 0.03, 0.07));
  }

  if (zone.palette === 'garden') paintGarden(ctx, w, h, P, rnd, absX);
  if (zone.palette === 'meadow') paintMeadow(ctx, w, h, P, rnd, absX);
  if (zone.palette === 'edge') paintEdge(ctx, w, h, P, rnd, absX);
  if (zone.palette === 'deep') paintDeep(ctx, w, h, P, rnd, absX);

  // — foreground grass fringe (top and bottom of the world)
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w;
    const top = rnd() > 0.5;
    const y = top ? between(rnd, -10, 60) : between(rnd, h - 60, h + 10);
    grassTuft(ctx, x, y, between(rnd, 16, 46), pick(rnd, P.washes), P.ink, between(rnd, 0.1, 0.26), rnd);
  }

  // — pigment speckle + paper
  splatter(ctx, rnd() * w, rnd() * h, 120, P.ink, 0.05, rnd, 25);
  paperGrain(ctx, w, h, rnd, 3600);

  // vignette the zone edges so transitions feel dipped in shadow
  const edgeL = ctx.createLinearGradient(0, 0, 90, 0);
  edgeL.addColorStop(0, hexA(P.ink, 0.08));
  edgeL.addColorStop(1, hexA(P.ink, 0));
  ctx.fillStyle = edgeL;
  ctx.fillRect(0, 0, 90, h);
  const edgeR = ctx.createLinearGradient(w, 0, w - 90, 0);
  edgeR.addColorStop(0, hexA(P.ink, 0.08));
  edgeR.addColorStop(1, hexA(P.ink, 0));
  ctx.fillStyle = edgeR;
  ctx.fillRect(w - 90, 0, 90, h);

  // feather the seams so neighbouring biomes bleed into each other
  const fade = 110;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const fl = ctx.createLinearGradient(0, 0, fade, 0);
  fl.addColorStop(0, 'rgba(0,0,0,1)');
  fl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fl;
  ctx.fillRect(0, 0, fade, h);
  const fr = ctx.createLinearGradient(w, 0, w - fade, 0);
  fr.addColorStop(0, 'rgba(0,0,0,1)');
  fr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fr;
  ctx.fillRect(w - fade, 0, fade, h);
  ctx.restore();

  return cv;
}

function paintGarden(ctx, w, h, P, rnd, absX) {
  // cabbage patch
  for (let i = 0; i < 8; i++) {
    const x = rnd() * w;
    const y = pathY(absX(x)) + (rnd() > 0.5 ? 1 : -1) * between(rnd, 210, 470);
    if (y < 70 || y > h - 70) continue;
    cabbage(ctx, x, y, between(rnd, 18, 34), '#9db46f', P.ink, 0.55, rnd);
  }
  // daisy clusters
  for (let c = 0; c < 16; c++) {
    const cx = rnd() * w;
    const cy = pathY(absX(cx)) + between(rnd, -560, 560);
    if (cy < 50 || cy > h - 50) continue;
    const n = 4 + ((rnd() * 9) | 0);
    for (let i = 0; i < n; i++) {
      daisy(ctx, cx + between(rnd, -60, 60), cy + between(rnd, -40, 40), between(rnd, 3.5, 7), '#f3ead0', P.accents[0], P.ink, between(rnd, 0.35, 0.7), rnd, 6 + ((rnd() * 3) | 0));
    }
  }
  // poppies near path
  for (let c = 0; c < 6; c++) {
    const cx = rnd() * w;
    const cy = pathY(absX(cx)) + between(rnd, -220, 220);
    for (let i = 0; i < 3; i++) {
      poppy(ctx, cx + between(rnd, -34, 34), cy + between(rnd, -20, 20), between(rnd, 4, 7), '#cf7f68', P.ink, between(rnd, 0.35, 0.6), rnd);
    }
  }
  // clover
  for (let i = 0; i < 120; i++) {
    clover(ctx, rnd() * w, rnd() * h, between(rnd, 2.5, 5.5), pick(rnd, P.washes), between(rnd, 0.2, 0.5), rnd);
  }
  // soft little stones
  for (let i = 0; i < 26; i++) {
    washEllipse(ctx, rnd() * w, rnd() * h, between(rnd, 2, 8), between(rnd, 1.5, 5), '#a9a58c', between(rnd, 0.16, 0.4), rnd() * TAU, rnd() * 10, 0.18);
  }
}

function paintMeadow(ctx, w, h, P, rnd, absX) {
  // tall golden grass
  for (let i = 0; i < 900; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    if (Math.abs(y - pathY(absX(x))) < 120) continue;
    grassTuft(ctx, x, y, between(rnd, 20, 54), pick(rnd, ['#c8bd78', '#d8cb8b', '#b6b06e', '#e0d5a0']), P.ink, between(rnd, 0.12, 0.3), rnd);
  }
  // seed heads
  for (let c = 0; c < 22; c++) {
    const cx = rnd() * w;
    const cy = pathY(absX(cx)) + between(rnd, -600, 600);
    if (cy < 60 || cy > h - 60) continue;
    for (let i = 0; i < 5; i++) {
      seedHead(ctx, cx + between(rnd, -45, 45), cy + between(rnd, -20, 20), between(rnd, 34, 62), '#d6c68a', P.ink, between(rnd, 0.3, 0.6), rnd);
    }
  }
  // poppies and cornflowers
  for (let c = 0; c < 15; c++) {
    const cx = rnd() * w;
    const cy = pathY(absX(cx)) + between(rnd, -480, 480);
    if (cy < 60 || cy > h - 60) continue;
    const warm = rnd() > 0.4;
    for (let i = 0; i < 4; i++) {
      if (warm) poppy(ctx, cx + between(rnd, -40, 40), cy + between(rnd, -30, 30), between(rnd, 3.5, 6), pick(rnd, ['#cf7f68', '#dc8e5f', '#c96f5b']), P.ink, between(rnd, 0.32, 0.55), rnd);
      else daisy(ctx, cx + between(rnd, -40, 40), cy + between(rnd, -30, 30), between(rnd, 3, 5), '#b9a9d0', '#d9c98d', P.ink, between(rnd, 0.35, 0.6), rnd, 5);
    }
  }
  // a fallen branch
  for (let i = 0; i < 2; i++) {
    fallenLog(ctx, between(rnd, 150, w - 150), between(rnd, 120, h - 120), between(rnd, 120, 210), between(rnd, 9, 15), '#9b8867', P.ink, 0.45, rnd);
  }
}

function paintEdge(ctx, w, h, P, rnd, absX) {
  // ferns
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w;
    const y = pathY(absX(x)) + between(rnd, -650, 650);
    if (y < 70 || y > h - 70) continue;
    fern(ctx, x, y, between(rnd, 46, 95), '#6d8f6c', P.ink, between(rnd, 0.5, 0.8), rnd);
  }
  // mushrooms
  for (let i = 0; i < 20; i++) {
    const x = rnd() * w;
    const y = pathY(absX(x)) + between(rnd, -500, 500);
    if (y < 60 || y > h - 60) continue;
    mushroom(ctx, x, y, between(rnd, 4, 9), pick(rnd, ['#c4745d', '#d8b26f', '#b06a55']), '#e8dcc0', P.ink, between(rnd, 0.45, 0.75), rnd);
  }
  // foxgloves
  for (let c = 0; c < 6; c++) {
    const cx = rnd() * w;
    const cy = pathY(absX(cx)) + between(rnd, -380, 380);
    if (cy < 100 || cy > h - 100) continue;
    for (let i = 0; i < 3; i++) seedHead(ctx, cx + between(rnd, -26, 26), cy + between(rnd, -20, 20), between(rnd, 60, 92), '#a58fae', P.ink, between(rnd, 0.3, 0.55), rnd);
  }
  // mossy logs
  for (let i = 0; i < 3; i++) {
    fallenLog(ctx, between(rnd, 200, w - 200), between(rnd, 200, h - 200), between(rnd, 180, 320), between(rnd, 16, 26), '#8b7c5c', P.ink, 0.5, rnd);
  }
  // little white flowers in shade
  for (let c = 0; c < 10; c++) {
    const cx = rnd() * w;
    const cy = rnd() * h;
    for (let i = 0; i < 4; i++) {
      daisy(ctx, cx + between(rnd, -50, 50), cy + between(rnd, -35, 35), between(rnd, 2.4, 4.5), '#f1ead4', '#d9c98d', P.ink, between(rnd, 0.3, 0.55), rnd, 5);
    }
  }
}

function paintDeep(ctx, w, h, P, rnd, absX) {
  // giant leaves
  for (let i = 0; i < 18; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    giantLeaf(ctx, x, y, between(rnd, 55, 130), rnd() * TAU, pick(rnd, ['#4d7264', '#5d8172', '#3f6257']), P.ink, between(rnd, 0.3, 0.55), rnd);
  }
  // softly glowing mushrooms
  for (let i = 0; i < 16; i++) {
    const x = rnd() * w;
    const y = pathY(absX(x)) + between(rnd, -600, 600);
    if (y < 60 || y > h - 60) continue;
    const r = between(rnd, 4, 9);
    softBlob(ctx, x, y - r * 1.6, r * 4, r * 3.4, '#d9c98d', 0.14);
    mushroom(ctx, x, y, r, pick(rnd, ['#cfc087', '#b9c98d', '#a9cf8d']), '#e4ddc0', P.ink, between(rnd, 0.45, 0.7), rnd);
  }
  // roots and fallen leaves
  for (let i = 0; i < 9; i++) {
    rootLines(ctx, between(rnd, 100, w - 100), between(rnd, 100, h - 100), between(rnd, 70, 170), P.ink, between(rnd, 0.35, 0.6), rnd);
  }
  for (let i = 0; i < 90; i++) {
    washEllipse(ctx, rnd() * w, rnd() * h, between(rnd, 3, 9), between(rnd, 1.5, 4), pick(rnd, ['#a87455', '#c08d5e', '#8d6d4d']), between(rnd, 0.2, 0.45), rnd() * TAU, rnd() * 10, 0.2);
  }
  // small white flowers like scattered stars
  for (let c = 0; c < 8; c++) {
    const cx = rnd() * w;
    const cy = rnd() * h;
    for (let i = 0; i < 3; i++) {
      daisy(ctx, cx + between(rnd, -40, 40), cy + between(rnd, -30, 30), between(rnd, 2, 3.6), '#e9e6cc', '#d9c98d', P.ink, between(rnd, 0.3, 0.5), rnd, 5);
    }
  }

  // the Heartwood, at the far end
  if (absX(w) >= 7000) {
    drawHeartwood(ctx, w - 150, 760, P, rnd);
  }
}

function drawHeartwood(ctx, x, baseY, P, rnd) {
  // canopy glow
  softBlob(ctx, x, baseY - 240, 430, 380, '#fff3c4', 0.28);
  softBlob(ctx, x, baseY - 240, 260, 250, '#f5e6b0', 0.3);
  // trunk
  const g = ctx.createLinearGradient(x - 150, 0, x + 150, 0);
  g.addColorStop(0, hexA('#3d5145', 0.82));
  g.addColorStop(0.4, hexA('#6d7f62', 0.85));
  g.addColorStop(0.7, hexA('#4c6354', 0.85));
  g.addColorStop(1, hexA('#2f4339', 0.85));
  ctx.beginPath();
  ctx.moveTo(x - 150, baseY + 120);
  ctx.bezierCurveTo(x - 120, baseY - 150, x - 90, baseY - 520, x - 60, -120);
  ctx.lineTo(x + 70, -120);
  ctx.bezierCurveTo(x + 96, baseY - 500, x + 130, baseY - 160, x + 165, baseY + 140);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = hexA(P.ink, 0.4);
  ctx.lineWidth = 2;
  ctx.stroke();
  // bark ridges
  for (let i = 0; i < 26; i++) {
    const bx = x + between(rnd, -130, 145);
    const by = baseY + between(rnd, -260, 130);
    brushCurve(ctx, bx, by, bx + between(rnd, -14, 14), by - 60, bx + between(rnd, -25, 25), by - between(rnd, 80, 190), P.ink, between(rnd, 0.1, 0.3), between(rnd, 0.8, 2.6));
  }
  // roots
  for (let i = 0; i < 10; i++) {
    const dir = i % 2 ? 1 : -1;
    const sy = baseY + between(rnd, 20, 110);
    brushCurve(ctx, x + dir * between(rnd, 90, 150), sy, x + dir * between(rnd, 150, 260), sy + 30, x + dir * between(rnd, 230, 380), sy + between(rnd, -30, 60), P.ink, between(rnd, 0.28, 0.5), between(rnd, 2, 5));
  }
  // gold flecks in the bark
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = hexA('#e8d08a', between(rnd, 0.15, 0.45));
    ctx.beginPath();
    ctx.arc(x + between(rnd, -110, 120), baseY + between(rnd, -220, 100), between(rnd, 0.6, 2.2), 0, TAU);
    ctx.fill();
  }
  // hanging light
  softBlob(ctx, x - 70, baseY - 300, 90, 90, '#f7e5a8', 0.18);
}

// ————————————————————————————————————————————————
// live puddles
// ————————————————————————————————————————————————

export function drawPuddle(ctx, p, t, drinking = false) {
  const P = p.palette;
  // damp earth halo, darker on the shaded edge
  softBlob(ctx, p.x + 2, p.y + 7, p.rx * 1.62, p.ry * 1.95, '#5b6c43', 0.24);
  softBlob(ctx, p.x - 3, p.y + 3, p.rx * 1.25, p.ry * 1.55, mixHex(P.waterDeep, '#5f6044', 0.28), 0.2);

  // water wash, dark below and pale-sky above
  ctx.save();
  blobPath(ctx, p.x, p.y, p.rx, p.ry, p.rot, p.seed, 0.055);
  const g = ctx.createLinearGradient(p.x, p.y - p.ry * 1.05, p.x, p.y + p.ry * 1.05);
  g.addColorStop(0, hexA(mixHex(P.water, '#f2eed8', 0.6), 0.92));
  g.addColorStop(0.18, hexA(P.water, 0.8));
  g.addColorStop(0.58, hexA(P.waterDeep, 0.84));
  g.addColorStop(1, hexA(mixHex(P.waterDeep, '#223a35', 0.48), 0.92));
  ctx.fillStyle = g;
  ctx.fill();
  // keep the reflections inside the pool
  ctx.clip();
  softBlob(ctx, p.x + p.rx * 0.06, p.y + p.ry * 0.55, p.rx * 0.55, p.ry * 0.38, '#2e4942', 0.38);
  softBlob(ctx, p.x - p.rx * 0.16, p.y - p.ry * 0.42, p.rx * 0.52, p.ry * 0.28, '#f7f1d9', 0.3);
  // wavy sky reflections
  for (let i = 0; i < 2; i++) {
    const yy = p.y - p.ry * 0.16 + i * p.ry * 0.26;
    const half = p.rx * (0.55 - i * 0.12);
    brushCurve(ctx, p.x - half, yy, p.x, yy - 3.2, p.x + half, yy, '#fbf6e4', 0.26, 1.3);
    brushCurve(ctx, p.x - half * 0.7, yy + 4, p.x + half * 0.2, yy + 1.4, p.x + half * 0.85, yy + 4.5, '#fbf6e4', 0.15, 0.9);
  }
  ctx.restore();

  // wet edge: dark bank above, thin shell of light below
  blobPath(ctx, p.x, p.y, p.rx, p.ry, p.rot, p.seed, 0.06);
  ctx.strokeStyle = hexA('#3c4b3c', 0.3);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(p.x - p.rx * 0.08, p.y + p.ry * 0.42, p.rx * 0.68, p.ry * 0.4, p.rot, 0.18, Math.PI - 0.18);
  ctx.strokeStyle = hexA('#f1ead2', 0.3);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // floating leaf on the surface
  ctx.save();
  ctx.translate(p.x - p.rx * 0.34, p.y + p.ry * 0.16);
  ctx.rotate(0.7 + p.rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.2, 2.1, 0, 0, TAU);
  ctx.fillStyle = hexA('#8fa562', 0.62);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(4.4, 0);
  ctx.strokeStyle = hexA('#4d5b3e', 0.35);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();
  // fallen petal
  ctx.fillStyle = hexA('#cf9a72', 0.48);
  ctx.beginPath();
  ctx.ellipse(p.x + p.rx * 0.24, p.y - p.ry * 0.08, 3.1, 1.4, 0.25, 0, TAU);
  ctx.fill();

  // ripples
  const rings = drinking ? 3 : 2;
  for (let i = 0; i < rings; i++) {
    const phase = ((t * (drinking ? 0.6 : 0.16)) + p.seed * 0.13 + i / rings) % 1;
    const rr = 0.2 + phase * 0.72;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx * rr, p.ry * rr, p.rot, 0, TAU);
    ctx.strokeStyle = `rgba(250,247,231,${(1 - phase) * (drinking ? 0.35 : 0.16)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // reeds at the edge
  for (let i = 0; i < 4; i++) {
    const a = p.seed + i * 2.1;
    const ex = p.x + Math.cos(a) * p.rx * 0.92;
    const ey = p.y + Math.sin(a) * p.ry * 0.88;
    const h = 12 + ((p.seed * (i + 3) * 13) % 14);
    brushCurve(ctx, ex, ey, ex + 3, ey - h * 0.6, ex + 7, ey - h, '#6f8a5c', 0.32, 0.8);
    ctx.fillStyle = hexA('#7c9666', 0.4);
    ctx.beginPath();
    ctx.ellipse(ex + 7, ey - h, 1.4, 3.4, 0.3, 0, TAU);
    ctx.fill();
  }

  if (drinking) {
    for (let i = 0; i < 3; i++) {
      const a = t * 2.4 + i * 2.1;
      ctx.fillStyle = 'rgba(250,248,234,0.5)';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * p.rx * 0.4, p.y + Math.sin(a) * p.ry * 0.3, 1.3, 0, TAU);
      ctx.fill();
    }
  }
}

// ————————————————————————————————————————————————
// title backdrop
// ————————————————————————————————————————————————

export function paintTitleBackdrop(ctx, w, h) {
  const rnd = mulberry32(20260214);
  const P = PALETTES.garden;
  ctx.fillStyle = P.paper;
  ctx.fillRect(0, 0, w, h);

  // great soft washes
  for (let i = 0; i < 30; i++) {
    softBlob(ctx, rnd() * w, rnd() * h, between(rnd, 100, 360), between(rnd, 90, 320), pick(rnd, P.washes), between(rnd, 0.08, 0.18), between(rnd, -0.6, 0.6));
  }
  for (let i = 0; i < 10; i++) {
    softBlob(ctx, rnd() * w, rnd() * h, between(rnd, 60, 180), between(rnd, 50, 160), P.light, between(rnd, 0.1, 0.2));
  }
  // huge pale moon behind the insect
  const mx = w * 0.68, my = h * 0.52;
  softBlob(ctx, mx, my, Math.min(w, h) * 0.34, Math.min(w, h) * 0.34, '#f8eecb', 0.55);
  softBlob(ctx, mx, my, Math.min(w, h) * 0.22, Math.min(w, h) * 0.22, '#fff7dc', 0.55);

  // grass at the bottom
  for (let i = 0; i < 420; i++) {
    const x = rnd() * w;
    const y = h - Math.pow(rnd(), 1.8) * h * 0.4;
    grassTuft(ctx, x, y, between(rnd, 18, 60), pick(rnd, P.washes), P.ink, between(rnd, 0.1, 0.3), rnd);
  }
  // giant leaves at edges
  const leaves = 8;
  for (let i = 0; i < leaves; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side > 0 ? w + between(rnd, -80, 80) : between(rnd, -80, 80);
    const y = h * between(rnd, 0.18, 0.85);
    giantLeaf(ctx, x, y, between(rnd, 120, 240), side > 0 ? Math.PI + between(rnd, -0.5, 0.5) : between(rnd, -0.5, 0.5), pick(rnd, ['#7f9f64', '#64876c', '#9ab290']), P.ink, between(rnd, 0.25, 0.45), rnd);
  }
  // stray daisies
  for (let i = 0; i < 26; i++) {
    daisy(ctx, rnd() * w, h * 0.55 + rnd() * h * 0.45, between(rnd, 3, 8), '#f4ecd4', '#d9b968', P.ink, between(rnd, 0.25, 0.6), rnd, 6);
  }
  // splashes
  for (let i = 0; i < 14; i++) {
    splatter(ctx, rnd() * w, rnd() * h, between(rnd, 30, 120), pick(rnd, [...P.washes, P.ink]), between(rnd, 0.04, 0.12), rnd, 10);
  }
  paperGrain(ctx, w, h, rnd, 5000);
}
