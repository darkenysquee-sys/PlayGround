// Hand-painted insects. Everything is drawn with translucent washes and ink.
import { TAU, clamp, hexA, mixHex } from './util.js';
import {
  softBlob, blobPath, washEllipse, inkContour, brushCurve,
} from './painting.js';

function shadow(ctx, x, y, rx, ry, alpha = 0.2) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, `rgba(52,58,38,${alpha})`);
  g.addColorStop(0.6, `rgba(52,58,38,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(52,58,38,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function leg(ctx, hx, hy, side, phase, scale, color, ink, width = 1) {
  const swing = Math.sin(phase) * 2.2 * scale;
  const hipY = hy + side * 3.0 * scale;
  const kx = hx - 1.4 * scale + swing * 0.3;
  const ky = hy + side * 6.4 * scale;
  const fx = hx - 6.0 * scale + swing;
  const fy = hy + side * 10.0 * scale;
  ctx.beginPath();
  ctx.moveTo(hx, hipY);
  ctx.quadraticCurveTo(kx, ky, fx, fy);
  ctx.strokeStyle = hexA(ink, 0.55);
  ctx.lineWidth = 1.8 * scale * width;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = hexA(color, 0.65);
  ctx.lineWidth = 0.8 * scale * width;
  ctx.stroke();
  ctx.fillStyle = hexA(ink, 0.45);
  ctx.beginPath();
  ctx.arc(fx, fy, 0.8 * scale, 0, TAU);
  ctx.fill();
}

function legs(ctx, hips, phase, scale, color, ink, width = 1) {
  for (const side of [-1, 1]) {
    hips.forEach((hx, i) => {
      leg(ctx, hx, 0, side, phase + i * 1.9 + (side > 0 ? Math.PI : 0), scale, color, ink, width);
    });
  }
}

function antennae(ctx, x, y, len, spread, phase, ink, width = 1) {
  for (const side of [-1, 1]) {
    const sway = Math.sin(phase + (side > 0 ? 0.8 : 0)) * 0.7;
    brushCurve(ctx, x, y + side * 1.6, x + len * 0.55, y + side * (spread * 0.45 + sway), x + len, y + side * (spread + sway), ink, 0.55, width);
    ctx.fillStyle = hexA(ink, 0.5);
    ctx.beginPath();
    ctx.arc(x + len, y + side * spread, 0.9, 0, TAU);
    ctx.fill();
  }
}

function eyes(ctx, x, y, gap, r, color, highlight = '#f4edd6') {
  for (const side of [-1, 1]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y + side * gap, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = hexA(highlight, 0.8);
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y + side * gap - r * 0.25, r * 0.34, 0, TAU);
    ctx.fill();
  }
}

function bodyJitter(walk, i, amount = 1) {
  return Math.sin(walk * 1.4 + i * 0.9) * amount;
}

// ————————————————————————————————————————————————
// player
// ————————————————————————————————————————————————

export function drawPlayer(ctx, p, t) {
  const stage = p.stage || 0;
  const r = p.r || 14;
  const walk = p.walk || 0;
  ctx.save();
  ctx.translate(p.x, p.y);

  // a pale watercolor halo keeps the player legible against the painted ground
  softBlob(ctx, 0, 0, r * 2.9, r * 2.4, '#fff7d6', stage === 4 ? 0.34 : 0.26);
  softBlob(ctx, 0, 0, r * 1.5, r * 1.3, '#fffbe8', 0.18);
  shadow(ctx, 2.5, r * 0.62, r * 1.25, r * 0.55, 0.24);

  if (stage === 4) {
    // radiant aura
    softBlob(ctx, 0, 0, r * 3.1, r * 2.8, '#d9d38a', 0.16);
    for (let i = 0; i < 3; i++) {
      const a = t * 0.7 + i * 2.1;
      ctx.fillStyle = 'rgba(240,236,182,0.45)';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.5, 1.4, 0, TAU);
      ctx.fill();
    }
  }

  ctx.rotate(p.angle || 0);
  const bite = p.biteT > 0;
  const biteK = bite ? p.biteT / 0.16 : 0;

  if (stage === 0) drawLarva(ctx, walk, t, biteK);
  else if (stage === 1) drawNymph(ctx, walk, t, biteK);
  else if (stage === 2) drawBeetle(ctx, walk, t, biteK);
  else if (stage === 3) drawStag(ctx, walk, t, biteK);
  else drawSovereign(ctx, walk, t, biteK);

  if (p.hurtT > 0) {
    ctx.fillStyle = `rgba(220,120,100,${clamp(p.hurtT * 0.7, 0, 0.4)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.2, r * 0.9, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawLarva(ctx, walk, t, bite) {
  const body = '#cbd49c', shade = '#a9b67c', ink = '#596044', light = '#e9e9c3';
  // tiny prolegs
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = -6 + i * 5.5;
      const wig = Math.sin(walk * 2 + i) * 0.8;
      brushCurve(ctx, x, side * 4.4, x + 1, side * 6.2, x - 0.5 + wig, side * 7.4, ink, 0.45, 0.8);
    }
  }
  // segments
  for (let i = 0; i < 5; i++) {
    const x = -11 + i * 5.3;
    const y = bodyJitter(walk, i, 1.2);
    washEllipse(ctx, x, y, 4.9, 5.6 - Math.abs(i - 2) * 0.32, i % 2 ? shade : body, 0.6, 0, i * 2.3 + 1, 0.09);
    inkContour(ctx, x, y, 4.9, 5.6 - Math.abs(i - 2) * 0.32, ink, 0.32, 0.7, 0, i * 2.3 + 1, 0.1);
    if (i < 4) {
      ctx.strokeStyle = hexA(ink, 0.16);
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(x + 2.4, y - 4.4);
      ctx.quadraticCurveTo(x + 3.2, y, x + 2.4, y + 4.4);
      ctx.stroke();
    }
  }
  // head
  const hx = 15.5, hy = bodyJitter(walk, 5, 1.2);
  washEllipse(ctx, hx, hy, 5.4, 5.0, body, 0.85, 0, 11, 0.08);
  inkContour(ctx, hx, hy, 5.4, 5.0, ink, 0.45, 0.8, 0, 11, 0.08);
  // brow
  brushCurve(ctx, hx - 2, hy - 2.6, hx + 2, hy - 3.2, hx + 4.5, hy - 1.6, ink, 0.25, 0.7);
  eyes(ctx, hx + 1.5, hy, 2.5, 1.15, '#3d4634');
  // antennae
  antennae(ctx, hx + 3.5, hy, 7, 3.2, walk, ink, 0.8);
  // mouth
  ctx.strokeStyle = hexA(ink, 0.32);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(hx + 4, hy, 1.7, -0.5, 0.5);
  ctx.stroke();
  // tail tuft
  ctx.fillStyle = hexA(light, 0.5);
  ctx.beginPath();
  ctx.ellipse(-15, 0, 2.4, 1.3, 0.3, 0, TAU);
  ctx.fill();
  // highlight
  softBlob(ctx, -3, -3.5, 7, 3.2, light, 0.28);
}

function drawNymph(ctx, walk, t, bite) {
  const body = '#bccd8d', shade = '#94a970', ink = '#4f5b3e', accent = '#d8c583';
  legs(ctx, [6, 1.5, -4], walk, 0.98, '#8d9b68', ink);
  // abdomen
  washEllipse(ctx, -8, 0, 9.2, 6.6, body, 0.58, 0, 3, 0.1);
  inkContour(ctx, -8, 0, 9.2, 6.6, ink, 0.4, 0.8, 0, 3, 0.1);
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = hexA(ink, 0.18);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-12 + i * 3.4, -5.2);
    ctx.quadraticCurveTo(-11.5 + i * 3.4, 0, -12 + i * 3.4, 5.2);
    ctx.stroke();
  }
  // wing buds
  for (const side of [-1, 1]) {
    washEllipse(ctx, -4, side * 3.6, 6.2, 2.1, '#dfe3ba', 0.5, side * 0.06, 12 + side, 0.12);
    inkContour(ctx, -4, side * 3.6, 6.2, 2.1, ink, 0.2, 0.55, side * 0.06, 12 + side, 0.12);
  }
  // thorax
  washEllipse(ctx, 2.5, 0, 6.4, 5.6, shade, 0.62, 0, 8, 0.1);
  inkContour(ctx, 2.5, 0, 6.4, 5.6, ink, 0.38, 0.75, 0, 8, 0.1);
  // head
  const hx = 11.5;
  washEllipse(ctx, hx, 0, 4.6, 4.8, body, 0.9, 0, 5, 0.08);
  inkContour(ctx, hx, 0, 4.6, 4.8, ink, 0.45, 0.8, 0, 5, 0.08);
  eyes(ctx, hx + 1.4, 0, 2.7, 1.55, '#39412e');
  antennae(ctx, hx + 3.6, 0, 10, 4.2, walk, ink, 0.75);
  // mandibles
  const open = 1.4 + bite * 3;
  for (const side of [-1, 1]) {
    brushCurve(ctx, hx + 3.5, side * 1.2, hx + 5.2, side * open, hx + 7.2, side * (open * 1.15), ink, 0.5, 1);
  }
  // pale markings
  ctx.fillStyle = hexA(accent, 0.35);
  ctx.beginPath();
  ctx.ellipse(2.5, -2.7, 2.6, 0.9, 0.2, 0, TAU);
  ctx.fill();
  softBlob(ctx, -7, -3.2, 5, 2.2, '#eef0ca', 0.28);
}

function drawBeetle(ctx, walk, t, bite) {
  const shell = '#537c6f', deep = '#345a51', ink = '#2b423a', hi = '#93b5a2', accent = '#c9b878';
  legs(ctx, [6.5, 1.5, -4.5], walk, 1.18, '#82977b', ink, 1.05);
  // abdomen / elytra
  washEllipse(ctx, -4.5, 0, 12.2, 9.4, shell, 0.72, 0, 2, 0.07);
  inkContour(ctx, -4.5, 0, 12.2, 9.4, ink, 0.55, 1, 0, 2, 0.08);
  // shell seam
  brushCurve(ctx, -15.5, 0, -6, 0.5, 5.5, 0, ink, 0.3, 0.75);
  // shell shading
  softBlob(ctx, -4, 4.5, 9, 4.5, deep, 0.35);
  softBlob(ctx, -5, -4.6, 8, 3.2, hi, 0.3);
  // iridescent dab
  softBlob(ctx, -8, -4.2, 4.2, 2.0, '#bcd6bd', 0.35);
  // pronotum
  washEllipse(ctx, 5.5, 0, 6.6, 7.0, deep, 0.7, 0, 7, 0.08);
  inkContour(ctx, 5.5, 0, 6.6, 7.0, ink, 0.5, 0.85, 0, 7, 0.08);
  softBlob(ctx, 4.5, -3, 4.2, 2.2, hi, 0.35);
  // head
  const hx = 13;
  washEllipse(ctx, hx, 0, 4.3, 4.6, '#3f5b4e', 0.9, 0, 9, 0.07);
  inkContour(ctx, hx, 0, 4.3, 4.6, ink, 0.5, 0.8, 0, 9, 0.07);
  eyes(ctx, hx + 0.8, 0, 2.8, 1.25, '#252f28');
  antennae(ctx, hx + 3.1, 0, 7, 3.4, walk, ink, 0.75);
  // mandibles
  const open = 0.8 + bite * 2;
  for (const side of [-1, 1]) {
    brushCurve(ctx, hx + 2.8, side * 1.1, hx + 4.3, side * open, hx + 5.6, side * (open + 1.2), ink, 0.55, 1.1);
  }
  // gold flecks
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = hexA(accent, 0.35);
    ctx.beginPath();
    ctx.arc(-10 + i * 4.4, 4 - i * 0.8, 0.8, 0, TAU);
    ctx.fill();
  }
}

function mandible(ctx, side, baseX, baseY, len, ink, fill) {
  ctx.save();
  ctx.scale(1, side);
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.bezierCurveTo(baseX + len * 0.45, baseY + len * 0.26, baseX + len * 0.86, baseY + len * 0.18, baseX + len, baseY - len * 0.06);
  ctx.bezierCurveTo(baseX + len * 0.72, baseY + len * 0.06, baseX + len * 0.4, baseY + len * 0.04, baseX + len * 0.2, baseY - len * 0.05);
  ctx.bezierCurveTo(baseX + len * 0.12, baseY + len * 0.02, baseX + len * 0.06, baseY + len * 0.02, baseX, baseY);
  ctx.closePath();
  ctx.fillStyle = hexA(fill, 0.85);
  ctx.fill();
  ctx.strokeStyle = hexA(ink, 0.65);
  ctx.lineWidth = 1;
  ctx.stroke();
  // inner tooth
  ctx.beginPath();
  ctx.moveTo(baseX + len * 0.52, baseY + len * 0.1);
  ctx.lineTo(baseX + len * 0.46, baseY - len * 0.02);
  ctx.lineTo(baseX + len * 0.62, baseY + len * 0.04);
  ctx.closePath();
  ctx.fillStyle = hexA(ink, 0.55);
  ctx.fill();
  ctx.restore();
}

function drawStag(ctx, walk, t, bite) {
  const shell = '#6d4b3f', deep = '#4a312a', ink = '#362621', hi = '#aa7d64', bone = '#e4d5b2';
  legs(ctx, [7.5, 2, -6], walk, 1.5, '#8c7760', ink, 1.05);
  // abdomen
  washEllipse(ctx, -7, 0, 15.2, 11.5, shell, 0.72, 0, 4, 0.07);
  inkContour(ctx, -7, 0, 15.2, 11.5, ink, 0.55, 1.05, 0, 4, 0.08);
  brushCurve(ctx, -20, 0, -8, 0.5, 5, 0, ink, 0.3, 0.8);
  softBlob(ctx, -7, 6, 11, 4.5, deep, 0.4);
  softBlob(ctx, -9, -6, 9, 3.5, hi, 0.3);
  softBlob(ctx, -12, -5, 4, 1.8, '#d0a284', 0.28);
  // pronotum
  washEllipse(ctx, 6.5, 0, 8.2, 8.6, deep, 0.72, 0, 8, 0.07);
  inkContour(ctx, 6.5, 0, 8.2, 8.6, ink, 0.5, 0.9, 0, 8, 0.08);
  softBlob(ctx, 5, -4, 5, 2.5, hi, 0.32);
  // head
  const hx = 15.5;
  washEllipse(ctx, hx, 0, 5.2, 5.5, '#4a342c', 0.92, 0, 12, 0.07);
  inkContour(ctx, hx, 0, 5.2, 5.5, ink, 0.5, 0.85, 0, 12, 0.07);
  // eyes
  eyes(ctx, hx + 1.2, 0, 3.3, 1.5, '#2a211d', '#e8d8b6');
  // antennae with clubs
  for (const side of [-1, 1]) {
    const sway = Math.sin(walk + side) * 0.6;
    brushCurve(ctx, hx + 3.5, side * 2.2, hx + 8, side * (5 + sway), hx + 12, side * (6 + sway), ink, 0.4, 0.7);
    ctx.fillStyle = hexA(ink, 0.45);
    ctx.beginPath();
    ctx.ellipse(hx + 12.4, side * (6 + sway), 1.4, 1, 0, 0, TAU);
    ctx.fill();
  }
  // great mandibles
  const spread = bite * 0.12;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * spread);
    mandible(ctx, side, hx + 4.5, side * 3.2, 20, ink, bone);
    ctx.restore();
  }
  // gold flecks
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = hexA('#d6bc82', 0.4);
    ctx.beginPath();
    ctx.arc(-14 + i * 4.6, 6 - i, 0.9, 0, TAU);
    ctx.fill();
  }
}

function drawSovereign(ctx, walk, t, bite) {
  const shell = '#315a51', deep = '#1f3d38', ink = '#1e332e', hi = '#82ab99', gold = '#d8bb6d';
  legs(ctx, [10, 3, -7], walk, 1.85, '#526b58', ink, 1.05);
  // wings, translucent, folded back
  for (const side of [-1, 1]) {
    washEllipse(ctx, -12, side * 7, 18, 5.4, '#a8c0a8', 0.28, side * 0.04, 20 + side, 0.08);
    inkContour(ctx, -12, side * 7, 18, 5.4, '#3e5b4d', 0.2, 0.7, side * 0.04, 20 + side, 0.08);
    for (let i = 0; i < 3; i++) {
      brushCurve(ctx, -4 - i * 5, side * 7, -12 - i * 5, side * 8.5, -26, side * 9.5, '#c9d3a0', 0.16, 0.5);
    }
  }
  // abdomen
  washEllipse(ctx, -8, 0, 18.5, 13.8, shell, 0.75, 0, 6, 0.06);
  inkContour(ctx, -8, 0, 18.5, 13.8, ink, 0.65, 1.2, 0, 6, 0.07);
  brushCurve(ctx, -26, 0, -10, 0.5, 7, 0, ink, 0.32, 0.9);
  softBlob(ctx, -8, 7, 13, 5, deep, 0.45);
  softBlob(ctx, -10, -7, 11, 4, hi, 0.32);
  // gold filigree
  for (const side of [-1, 1]) {
    brushCurve(ctx, -22, side * 4, -13, side * 10, -3, side * 6, gold, 0.38, 0.8);
    ctx.fillStyle = hexA(gold, 0.5);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-20 + i * 6.4, side * (5.4 - i * 0.5), 0.95, 0, TAU);
      ctx.fill();
    }
  }
  // pronotum
  washEllipse(ctx, 8, 0, 9.8, 10.2, deep, 0.76, 0, 9, 0.06);
  inkContour(ctx, 8, 0, 9.8, 10.2, ink, 0.55, 1, 0, 9, 0.07);
  softBlob(ctx, 6.5, -5, 5.6, 2.8, hi, 0.32);
  // head
  const hx = 19;
  washEllipse(ctx, hx, 0, 6.0, 6.4, '#27443c', 0.94, 0, 14, 0.06);
  inkContour(ctx, hx, 0, 6.0, 6.4, ink, 0.55, 0.9, 0, 14, 0.07);
  // glowing eyes
  for (const side of [-1, 1]) {
    softBlob(ctx, hx + 1.8, side * 3.7, 2.4, 2.1, '#f2dda0', 0.55);
    ctx.fillStyle = '#2a3b2c';
    ctx.beginPath();
    ctx.arc(hx + 1.8, side * 3.7, 1.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(247,225,160,0.9)';
    ctx.beginPath();
    ctx.arc(hx + 1.4, side * 3.5, 0.55, 0, TAU);
    ctx.fill();
  }
  // crown horn
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(hx + 3.6, -2.4);
  ctx.quadraticCurveTo(hx + 12, -5, hx + 16.5, 0);
  ctx.quadraticCurveTo(hx + 12, 5, hx + 3.6, 2.4);
  ctx.closePath();
  ctx.fillStyle = hexA(gold, 0.72);
  ctx.fill();
  ctx.strokeStyle = hexA(ink, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  // side crown spikes
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + 1, side * 5.6);
    ctx.quadraticCurveTo(hx + 7, side * 8, hx + 11, side * 7);
    ctx.quadraticCurveTo(hx + 6, side * 4.4, hx + 2.4, side * 3.6);
    ctx.closePath();
    ctx.fillStyle = hexA(gold, 0.55);
    ctx.fill();
  }
  ctx.restore();
  // mandibles, broad and gold-tipped
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.03 + bite * 0.1));
    mandible(ctx, side, hx + 5.4, side * 4.4, 23, ink, '#c4ae74');
    ctx.restore();
  }
  // antennae
  for (const side of [-1, 1]) {
    brushCurve(ctx, hx + 4.5, side * 5, hx + 11, side * 8, hx + 15, side * 9, ink, 0.45, 0.8);
  }
  // floating spores
  for (let i = 0; i < 3; i++) {
    const a = t * 0.9 + i * 2.3;
    ctx.fillStyle = hexA(gold, 0.45);
    ctx.beginPath();
    ctx.arc(-4 + Math.cos(a) * 24, Math.sin(a * 1.3) * 17, 0.9, 0, TAU);
    ctx.fill();
  }
}

// ————————————————————————————————————————————————
// prey & rivals
// ————————————————————————————————————————————————

export function drawCritter(ctx, c, t) {
  const type = c.type;
  const r = c.r || 8;
  ctx.save();
  ctx.translate(c.x, c.y);
  shadow(ctx, 2, r * 0.6, r * 1.1, r * 0.5, c.boss ? 0.28 : 0.18);
  const aggro = c.aggro || c.waking;
  if (aggro && c.def.threat > 0) {
    softBlob(ctx, 0, 0, r * 2.6, r * 2.2, '#b45c4c', c.boss ? 0.17 : 0.11);
  }
  ctx.rotate(c.angle || 0);
  const phase = c.walk || 0;

  switch (type) {
    case 'aphid': drawAphid(ctx, phase, t); break;
    case 'mite': drawMite(ctx, phase); break;
    case 'fly': drawFly(ctx, phase, t, aggro); break;
    case 'caterpillar': drawCaterpillar(ctx, phase); break;
    case 'moth': drawMoth(ctx, phase, t); break;
    case 'spider': drawSpider(ctx, phase, aggro); break;
    case 'wasp': drawWasp(ctx, phase, t, aggro); break;
    case 'centipede': drawCentipede(ctx, phase); break;
    case 'mantis': drawMantis(ctx, phase, t, c); break;
    default: break;
  }
  ctx.restore();
}

function drawAphid(ctx, phase, t) {
  const body = '#b7ca83', ink = '#4d5838', shade = '#97ad68';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      leg(ctx, 3 - i * 3, 0, side, phase + i * 2, 0.55, shade, ink);
    }
  }
  // cornicles
  brushCurve(ctx, -4, -2, -8, -5, -9, -6, ink, 0.35, 0.9);
  brushCurve(ctx, -4, 2, -8, 5, -9, 6, ink, 0.35, 0.9);
  // pear body
  washEllipse(ctx, -1, 0, 6.2, 7.2, body, 0.72, 0, 2, 0.08);
  inkContour(ctx, -1, 0, 6.2, 7.2, ink, 0.4, 0.8, 0, 2, 0.08);
  softBlob(ctx, -2, -3, 4, 2.4, '#dbe5ac', 0.4);
  // head
  washEllipse(ctx, 6, 0, 3.2, 3.4, shade, 0.85, 0, 6, 0.07);
  eyes(ctx, 7, 0, 1.7, 0.9, '#303a28');
  antennae(ctx, 8.5, 0, 5, 2, phase, ink, 0.55);
}

function drawMite(ctx, phase) {
  const body = '#b07a5f', ink = '#5b3a2d';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      leg(ctx, 2 - i * 2, 0, side, phase + i * 1.6, 0.42, body, ink, 0.8);
    }
  }
  washEllipse(ctx, 0, 0, 5, 5.6, body, 0.75, 0, 4, 0.08);
  inkContour(ctx, 0, 0, 5, 5.6, ink, 0.45, 0.75, 0, 4, 0.08);
  softBlob(ctx, -1, -2, 2.8, 2, '#d3a891', 0.35);
  eyes(ctx, 3, 0, 1.5, 0.7, '#38241d');
}

function drawFly(ctx, phase, t, aggro) {
  const ink = '#2f3733', body = '#5d6660';
  const flap = 0.25 + Math.abs(Math.sin(t * 26 + phase)) * 0.75;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-1, side * 2.6);
    ctx.rotate(side * (0.25 + flap * 0.5));
    ctx.beginPath();
    ctx.ellipse(-2.5, side * (2 + 3 * flap), 7.4, 2.8, side * 0.15, 0, TAU);
    ctx.fillStyle = `rgba(244,246,236,${0.32 + flap * 0.22})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,100,92,0.25)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) leg(ctx, 3 - i * 3, 0, side, phase + i * 2, 0.5, '#4b524c', ink);
  }
  washEllipse(ctx, -2, 0, 6.6, 4.6, body, 0.8, 0, 5, 0.08);
  inkContour(ctx, -2, 0, 6.6, 4.6, ink, 0.5, 0.8, 0, 5, 0.08);
  washEllipse(ctx, 4.5, 0, 3.6, 3.4, '#454e48', 0.9, 0, 7, 0.07);
  // red compound eyes
  for (const side of [-1, 1]) {
    softBlob(ctx, 6, side * 1.7, 2.4, 2.2, '#b4594b', 0.5);
    ctx.fillStyle = '#8e4138';
    ctx.beginPath();
    ctx.arc(6.2, side * 1.8, 1.4, 0, TAU);
    ctx.fill();
  }
  if (aggro) softBlob(ctx, 5, 0, 4, 3, '#d08a70', 0.2);
  // abdomen glint
  softBlob(ctx, -4, -1.6, 3.2, 1.4, '#aab8ad', 0.35);
}

function drawCaterpillar(ctx, phase) {
  const ink = '#56603c', body = '#aebd6d', shade = '#8c9d53';
  for (let i = 0; i < 6; i++) {
    const x = -12 + i * 4.6;
    const y = Math.sin(phase * 1.3 + i * 0.7) * 1.1;
    washEllipse(ctx, x, y, 4.4, 4.6 - Math.abs(i - 2.5) * 0.2, i % 2 ? shade : body, 0.7, 0, i + 3, 0.09);
    inkContour(ctx, x, y, 4.4, 4.6, ink, 0.35, 0.65, 0, i + 3, 0.1);
    // tiny legs
    for (const side of [-1, 1]) {
      brushCurve(ctx, x, side * 3.8, x + 0.5, side * 5.1, x - 0.4, side * 6.0, ink, 0.35, 0.6);
    }
  }
  // face
  const hx = 15, hy = Math.sin(phase * 1.3 + 4) * 1.1;
  washEllipse(ctx, hx, hy, 4.6, 4.4, body, 0.9, 0, 9, 0.08);
  eyes(ctx, hx + 1.2, hy, 2, 0.95, '#39412c');
  antennae(ctx, hx + 2.5, hy, 5, 2.4, phase, ink, 0.55);
  // stripe highlight
  softBlob(ctx, -4, -2.4, 7, 1.8, '#dbe3a4', 0.3);
}

function drawMoth(ctx, phase, t) {
  const ink = '#5e5744', wing = '#e2d8b7', wingShade = '#b9a77a';
  const flap = 0.15 + Math.abs(Math.sin(t * 15 + phase)) * 0.85;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(0, side * 2.2);
    ctx.scale(1, side);
    // forewing
    ctx.beginPath();
    ctx.ellipse(-1, 7 * flap + 1.5, 9.5, 9 * flap + 1.2, -0.25, 0, TAU);
    ctx.fillStyle = `rgba(233,224,197,${0.55 + flap * 0.25})`;
    ctx.fill();
    ctx.strokeStyle = hexA(ink, 0.3);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // hindwing
    ctx.beginPath();
    ctx.ellipse(-7, 5 * flap + 1.2, 6.5, 6.4 * flap + 1, 0.2, 0, TAU);
    ctx.fillStyle = `rgba(213,201,170,${0.4 + flap * 0.2})`;
    ctx.fill();
    ctx.strokeStyle = hexA(ink, 0.22);
    ctx.stroke();
    // eyespot
    if (flap > 0.45) {
      ctx.fillStyle = hexA(wingShade, 0.6 * flap);
      ctx.beginPath();
      ctx.arc(-1.5, 6 * flap + 1.5, 2.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = hexA('#6e6047', 0.5 * flap);
      ctx.beginPath();
      ctx.arc(-1.5, 6 * flap + 1.5, 1.1, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // body
  washEllipse(ctx, -2, 0, 6.5, 3.4, '#c9bfa0', 0.85, 0, 3, 0.08);
  inkContour(ctx, -2, 0, 6.5, 3.4, ink, 0.4, 0.7, 0, 3, 0.08);
  washEllipse(ctx, 4, 0, 3.4, 3.2, '#b9ad8d', 0.9, 0, 6, 0.07);
  eyes(ctx, 5.2, 0, 1.6, 0.9, '#3d3a2e');
  antennae(ctx, 6.2, 0, 5.5, 3, phase, ink, 0.5);
  // fuzzy thorax
  softBlob(ctx, 1, 0, 3.5, 3, '#efe6ca', 0.35);
}

function drawSpider(ctx, phase, aggro) {
  const ink = '#3c2f27', body = '#6d5847', shade = '#4f3f33';
  for (let side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const hipX = 4 - i * 2.8;
      const swing = Math.sin(phase + i * 1.7 + (side > 0 ? Math.PI : 0)) * 2.5;
      const kx = hipX + side * 0 + 5 + swing * 0.4;
      const ky = side * 7;
      const fx = hipX + 10 + swing;
      const fy = side * 12;
      ctx.beginPath();
      ctx.moveTo(hipX, side * 2);
      ctx.quadraticCurveTo(kx, ky, fx, fy);
      ctx.strokeStyle = hexA(ink, 0.7);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.strokeStyle = hexA('#8c7460', 0.5);
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }
  // abdomen
  washEllipse(ctx, -5, 0, 8.6, 7.4, body, 0.8, 0, 4, 0.08);
  inkContour(ctx, -5, 0, 8.6, 7.4, ink, 0.55, 0.9, 0, 4, 0.08);
  softBlob(ctx, -6, -3, 5, 2.6, '#a08668', 0.3);
  // hourglass
  ctx.fillStyle = hexA('#b45c4c', 0.72);
  ctx.beginPath();
  ctx.moveTo(-8, -2.2); ctx.lineTo(-3.5, 0); ctx.lineTo(-8, 2.2); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4.2, -1.2); ctx.lineTo(-1.4, 0); ctx.lineTo(-4.2, 1.2); ctx.closePath();
  ctx.fill();
  // cephalothorax
  washEllipse(ctx, 3.5, 0, 5.2, 4.8, shade, 0.85, 0, 6, 0.07);
  inkContour(ctx, 3.5, 0, 5.2, 4.8, ink, 0.5, 0.8, 0, 6, 0.07);
  // eyes
  ctx.fillStyle = '#241d19';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(6.6, -1.8 + i * 1.7, 0.75, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(4.8, -2.3 + i * 1.9, 0.6, 0, TAU); ctx.fill();
  }
  if (aggro) {
    softBlob(ctx, 7, 0, 3, 2.4, '#d47a60', 0.4);
  }
  // fangs
  brushCurve(ctx, 8, -1.2, 9.5, -1.6, 10.2, -0.6, ink, 0.6, 0.9);
  brushCurve(ctx, 8, 1.2, 9.5, 1.6, 10.2, 0.6, ink, 0.6, 0.9);
}

function drawWasp(ctx, phase, t, aggro) {
  const ink = '#322f25', yellow = '#d9b452', dark = '#3d3b2f';
  const flap = 0.25 + Math.abs(Math.sin(t * 30 + phase)) * 0.75;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-1, side * 2.4);
    ctx.rotate(side * (0.2 + flap * 0.45));
    ctx.beginPath();
    ctx.ellipse(-3, side * (2 + 2.6 * flap), 8, 2.4, 0, 0, TAU);
    ctx.fillStyle = `rgba(243,244,233,${0.3 + flap * 0.22})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,95,78,0.2)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) leg(ctx, 4 - i * 3.5, 0, side, phase + i * 2, 0.55, '#b99a54', ink);
  }
  // abdomen with bands
  washEllipse(ctx, -8, 0, 8.4, 5.2, yellow, 0.85, 0, 4, 0.07);
  inkContour(ctx, -8, 0, 8.4, 5.2, ink, 0.5, 0.85, 0, 4, 0.07);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-11 + i * 4.1, 0, 1.7, 4.8 - i * 0.5, 0, 0, TAU);
    ctx.fillStyle = hexA(dark, 0.7);
    ctx.fill();
    ctx.restore();
  }
  // stinger
  ctx.beginPath();
  ctx.moveTo(-16, -1.2); ctx.lineTo(-20, 0); ctx.lineTo(-16, 1.2);
  ctx.closePath();
  ctx.fillStyle = hexA(ink, 0.7);
  ctx.fill();
  // thorax
  washEllipse(ctx, 2, 0, 4.8, 4.4, dark, 0.9, 0, 7, 0.07);
  softBlob(ctx, 1, -1.6, 2.6, 1.4, '#8d8767', 0.3);
  // head
  washEllipse(ctx, 8, 0, 3.6, 3.7, '#3b3a2c', 0.92, 0, 9, 0.06);
  eyes(ctx, 9, 0, 1.9, 1.05, '#1f211b');
  antennae(ctx, 10.5, 0, 5, 2.2, phase, ink, 0.5);
  if (aggro) {
    softBlob(ctx, 8, 0, 4.4, 3.4, '#e0a05a', 0.25);
    brushCurve(ctx, 6, -2, 10, -3.4, 12, -2.6, '#e8c274', 0.4, 0.6);
    brushCurve(ctx, 6, 2, 10, 3.4, 12, 2.6, '#e8c274', 0.4, 0.6);
  }
}

function drawCentipede(ctx, phase) {
  const ink = '#593528', body = '#b06c4e', shade = '#8f543b';
  const n = 9;
  // legs first
  for (let i = 0; i < n; i++) {
    const x = -16 + i * 4.0;
    const y = Math.sin(phase * 1.6 + i * 0.85) * 2.1;
    for (const side of [-1, 1]) {
      const swing = Math.sin(phase * 1.6 + i * 1.1 + (side > 0 ? 1.4 : 0)) * 1.4;
      brushCurve(ctx, x, y + side * 2.4, x + 2 + swing, y + side * 6.4, x + 3.4 + swing, y + side * 7.8, ink, 0.4, 0.7);
    }
  }
  for (let i = 0; i < n; i++) {
    const x = -16 + i * 4.0;
    const y = Math.sin(phase * 1.6 + i * 0.85) * 2.1;
    const rr = 3.2 + (i / n) * 1.2;
    washEllipse(ctx, x, y, rr, rr * 1.05, i % 2 ? shade : body, 0.7, 0, i * 1.7, 0.09);
    inkContour(ctx, x, y, rr, rr * 1.05, ink, 0.4, 0.7, 0, i * 1.7, 0.1);
  }
  // head
  const hx = 22, hy = Math.sin(phase * 1.6 + n * 0.85) * 2.1;
  washEllipse(ctx, hx, hy, 4.4, 4.2, shade, 0.9, 0, 8, 0.07);
  inkContour(ctx, hx, hy, 4.4, 4.2, ink, 0.5, 0.8, 0, 8, 0.07);
  eyes(ctx, hx + 1, hy, 1.9, 1, '#2e1e18');
  for (const side of [-1, 1]) {
    const sway = Math.sin(phase * 2 + side) * 1.2;
    brushCurve(ctx, hx + 3.5, hy + side * 1.6, hx + 8, hy + side * (4 + sway), hx + 11, hy + side * (5 + sway), ink, 0.5, 0.7);
  }
  // reddish legs tips
  ctx.fillStyle = hexA('#d9a06e', 0.35);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.arc(-12 + i * 7, -4, 1, 0, TAU); ctx.fill();
  }
}

function drawMantis(ctx, phase, t, c) {
  const ink = '#2f4433', body = '#7d9b62', shade = '#5b7649', gold = '#d1b56c', eye = '#d8c571';
  const awake = c.aggro || c.waking;
  const armLift = awake ? 0.4 + (c.state === 'lunge' ? 0.7 : 0) : 0;
  const breathe = Math.sin(t * 2) * 0.02;

  // six legs: four walking + two raptorial
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const hipX = 10 - i * 7;
      const swing = Math.sin(phase * 0.9 + i * 1.3 + (side > 0 ? Math.PI : 0)) * 3;
      const fx = hipX - 12 - i * 3 + swing;
      const fy = side * (26 + i * 2);
      ctx.beginPath();
      ctx.moveTo(hipX, side * 6);
      ctx.quadraticCurveTo(hipX - 4, side * 18, fx, fy);
      ctx.strokeStyle = hexA(ink, 0.6);
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.strokeStyle = hexA(body, 0.65);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  }
  // abdomen
  washEllipse(ctx, -26, 0, 25, 10, body, 0.7, 0, 3, 0.06);
  inkContour(ctx, -26, 0, 25, 10, ink, 0.6, 1.4, 0, 3, 0.07);
  // abdomen segments
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = hexA(ink, 0.2);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-46 + i * 7, -8);
    ctx.quadraticCurveTo(-43 + i * 7, 0, -46 + i * 7, 8);
    ctx.stroke();
  }
  // folded wings
  for (const side of [-1, 1]) {
    washEllipse(ctx, -24, side * 5.2, 21, 4.2, '#a9be8b', 0.3, side * 0.03, 20 + side, 0.07);
    inkContour(ctx, -24, side * 5.2, 21, 4.2, ink, 0.22, 0.7, side * 0.03, 20 + side, 0.07);
  }
  softBlob(ctx, -26, -4, 16, 3.5, '#c5d4a0', 0.28);
  // thorax
  washEllipse(ctx, 2, 0, 12, 6.2, shade, 0.82, 0, 5, 0.06);
  inkContour(ctx, 2, 0, 12, 6.2, ink, 0.55, 1, 0, 5, 0.07);
  // head, triangular
  const hx = 20;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(hx + 9, 0);
  ctx.quadraticCurveTo(hx + 1, -8, hx - 7, -6.5);
  ctx.lineTo(hx - 4, 0);
  ctx.lineTo(hx - 7, 6.5);
  ctx.quadraticCurveTo(hx + 1, 8, hx + 9, 0);
  ctx.closePath();
  ctx.fillStyle = hexA(body, 0.9);
  ctx.fill();
  ctx.strokeStyle = hexA(ink, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // big eyes
  for (const side of [-1, 1]) {
    if (awake) softBlob(ctx, hx + 1, side * 4.2, 3.4, 3, eye, 0.4);
    ctx.fillStyle = awake ? eye : '#7d8a5d';
    ctx.beginPath();
    ctx.ellipse(hx + 1, side * 4.2, 2.9, 2.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,50,30,0.8)';
    ctx.beginPath();
    ctx.arc(hx + 2, side * 4.2, 1.1, 0, TAU);
    ctx.fill();
  }
  // antennae
  for (const side of [-1, 1]) {
    brushCurve(ctx, hx + 7, side * 2.4, hx + 17, side * 6, hx + 25, side * 9, ink, 0.45, 0.9);
  }
  // crown
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(hx + 3, i * 2.6);
    ctx.lineTo(hx + 8 + Math.abs(i) * 1.5, i * 4.6);
    ctx.lineTo(hx + 5, i * 1.4);
    ctx.closePath();
    ctx.fillStyle = hexA(gold, 0.5);
    ctx.fill();
  }
  // raptorial arms
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(hx - 1, side * 4.5);
    ctx.rotate(side * (0.5 - armLift * 0.8));
    const sx = 0, sy = 0;
    const ex = 13, ey = side * 2.5;
    brushCurve(ctx, sx, sy, sx + 7, sy + side * 3, ex, ey, ink, 0.65, 2.4);
    // forearm folds back
    const fx = ex + 6 - (awake ? 4 : 0);
    const fy = ey + side * (awake ? 4 : 9);
    brushCurve(ctx, ex, ey, ex + 5, ey + side * 1, fx, fy, ink, 0.65, 2.1);
    // serrated teeth
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = hexA(ink, 0.6);
      ctx.beginPath();
      ctx.arc(ex + 2 + i * 1.8, ey + side * (1 + i * 1.6), 0.7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // gold markings on thorax
  ctx.fillStyle = hexA(gold, 0.4);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-2 + i * 5, 0, 1.1, 0, TAU);
    ctx.fill();
  }
  if (awake) softBlob(ctx, 0, 0, 44, 30, '#d9d38a', 0.07 + Math.sin(t * 4) * 0.015);
}

// ————————————————————————————————————————————————
// nectar flowers
// ————————————————————————————————————————————————

export function drawFlower(ctx, f, t) {
  const r = f.r;
  const sway = Math.sin(t * 1.3 + f.phase) * 0.035;
  ctx.save();
  ctx.translate(f.x, f.y);
  shadow(ctx, 1, 2, r * 0.95, r * 0.4, 0.12);
  ctx.rotate(sway + f.rot);

  // leaves
  for (let i = 0; i < 3; i++) {
    const a = f.phase + i * 2.1;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(r * 0.95, 0, r * 0.7, r * 0.34, 0, 0, TAU);
    ctx.fillStyle = hexA(f.leaf, 0.38);
    ctx.fill();
    ctx.strokeStyle = hexA('#4d5b3e', 0.18);
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  const alive = f.nectar > 0;
  const alpha = alive ? 0.88 : 0.28;
  const petals = f.petals || 7;
  if (alive) softBlob(ctx, 0, 0, r * 2.5, r * 2.2, f.petal, 0.22);
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(r * 0.62, 0, r * 0.52, r * 0.24, 0, 0, TAU);
    ctx.fillStyle = hexA(f.petal, alpha * 0.72);
    ctx.fill();
    ctx.strokeStyle = hexA('#544f39', 0.16);
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.restore();
  }
  // heart
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, TAU);
  ctx.fillStyle = hexA(f.heart, alive ? 0.85 : 0.35);
  ctx.fill();
  if (alive) {
    softBlob(ctx, 0, 0, r * 0.7, r * 0.6, f.heart, 0.35);
    ctx.fillStyle = 'rgba(252,246,220,0.85)';
    ctx.beginPath();
    ctx.arc(-r * 0.11, -r * 0.12, r * 0.13, 0, TAU);
    ctx.fill();
    // nectar glint
    ctx.fillStyle = 'rgba(255,250,225,0.72)';
    ctx.beginPath();
    ctx.arc(r * 0.12, r * 0.1, r * 0.08, 0, TAU);
    ctx.fill();
  } else {
    // dry seed head
    ctx.fillStyle = hexA('#8b8465', 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.24, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
