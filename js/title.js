import { clamp, TAU } from './util.js';
import {
  paintTitleBackdrop, softBlob, daisy, giantLeaf, splatter, brushCurve, PALETTES,
} from './painting.js';
import { drawPlayer } from './creatures.js';

export function paintTitleArt(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const mobile = w < 760;
  const P = PALETTES.garden;

  paintTitleBackdrop(ctx, w, h);

  const bx = mobile ? w * 0.52 : w * 0.71;
  const by = mobile ? h * 0.27 : h * 0.52;
  const sc = mobile ? clamp(Math.min(w, h) / 170, 2.0, 3.0) : clamp(Math.min(w, h) / 230, 2.6, 4.7);

  // a pale halo behind the specimen
  softBlob(ctx, bx, by, Math.min(w, h) * (mobile ? 0.24 : 0.28), Math.min(w, h) * 0.24, '#f8efce', 0.6);
  softBlob(ctx, bx, by, Math.min(w, h) * 0.17, Math.min(w, h) * 0.17, '#fff8e0', 0.5);

  // a few giant leaves framing the insect
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7;
    giantLeaf(ctx, bx + Math.cos(a) * 120 * sc * 0.4, by + Math.sin(a) * 100 * sc * 0.4, 70 * sc * 0.8, a + 0.7, '#7f9f64', P.ink, 0.26, () => (Math.sin(a) + 1) / 2);
  }

  // stag beetle specimen
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(sc, sc);
  drawPlayer(ctx, {
    x: 0, y: 0, stage: 3, r: 19, angle: -0.24 + Math.sin(0.5) * 0.03,
    walk: 0.8, biteT: 0, hurtT: 0, vx: 0, vy: 0,
  }, 1.6);
  ctx.restore();

  // a small larva near the garden floor, on the left
  ctx.save();
  ctx.translate(mobile ? w * 0.18 : w * 0.47, mobile ? h * 0.5 : h * 0.79);
  ctx.scale(1.9, 1.9);
  drawPlayer(ctx, {
    x: 0, y: 0, stage: 0, r: 9, angle: -0.5, walk: 1.3, biteT: 0, hurtT: 0, vx: 0, vy: 0,
  }, 2.4);
  ctx.restore();

  // daisies around the composition
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 22; i++) {
    const a = rnd() * TAU;
    const rr = (mobile ? 110 : 240) + rnd() * 170;
    const x = bx + Math.cos(a) * rr;
    const y = by + Math.sin(a) * rr * 0.62;
    if (x < -30 || x > w + 30 || y < -30 || y > h + 30) continue;
    daisy(ctx, x, y, 3 + rnd() * 5, '#f4ecd4', '#d9b968', P.ink, 0.26 + rnd() * 0.35, rnd, 6);
  }

  // ink spatter and botanical scribbles
  for (let i = 0; i < 10; i++) {
    const x = bx + (rnd() - 0.5) * 520;
    const y = by + (rnd() - 0.5) * 320;
    splatter(ctx, x, y, 28 + rnd() * 54, rnd() > 0.6 ? P.ink : P.accent || '#a2bd7c', 0.035 + rnd() * 0.05, rnd, 10);
  }
  for (let i = 0; i < 6; i++) {
    const x = bx - 120 + rnd() * 240;
    const y = by + 100 + rnd() * 90;
    brushCurve(ctx, x, y, x + 12, y + 24, x + 4 + rnd() * 20, y + 60, P.ink, 0.18, 0.8);
  }
}
