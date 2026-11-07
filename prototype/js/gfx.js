'use strict';
// Drawing primitives. Everything draws through the global ctx/cam, so the same sprite code
// renders the main scene and the shop thumbnails (which just swap ctx and cam).

let ctx = null;
let cam = { x: 0, y: 0, z: 1 };
let NIGHT = 0;     // 0 = day, 1 = night: windows and lamps light up
let GLOWS = [];    // light sources collected while drawing, painted over the night tint
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const UI_FONT = '"MT Nunito","MT Round",ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei UI",sans-serif';

// ---------- math ----------
const iso = (x, y) => ({ x: (x - y) * TW / 2 * cam.z + cam.x, y: (x + y) * TH / 2 * cam.z + cam.y });
const unIso = (sx, sy) => {
  const a = (sx - cam.x) / (TW / 2 * cam.z), b = (sy - cam.y) / (TH / 2 * cam.z);
  return { x: (a + b) / 2, y: (b - a) / 2 };
};
const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const lerp = (p, q, u) => ({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u });
const up = (p, h) => ({ x: p.x, y: p.y - h });
// Cheap deterministic noise for scenery that must not flicker.
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- colour ----------
function rgbOf(c) {
  if (c[0] === '#') {
    const n = parseInt(c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1, 7), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/\d+(\.\d+)?/g);
  return m ? m.slice(0, 3).map(Number) : [128, 128, 128];
}
// amt > 0 lightens towards white, < 0 darkens towards black.
function shade(c, amt) {
  const [r, g, b] = rgbOf(c), f = amt < 0 ? 0 : 255, k = Math.abs(amt);
  return `rgb(${Math.round(r + (f - r) * k)},${Math.round(g + (f - g) * k)},${Math.round(b + (f - b) * k)})`;
}
function rgba(c, a) { const [r, g, b] = rgbOf(c); return `rgba(${r},${g},${b},${a})`; }

// ---------- shapes (screen space, or local space inside a transform) ----------
function poly(pts, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
// Same as poly but takes [[x, y], ...] (handy for local sprite coordinates).
function pg(arr, fill, stroke, lw) { poly(arr.map(([x, y]) => ({ x, y })), fill, stroke, lw); }
function ellipse(x, y, rx, ry, fill, stroke, lw, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function circle(x, y, r, fill, stroke, lw) { ellipse(x, y, r, r, fill, stroke, lw); }
function line(x1, y1, x2, y2, col, w, cap = 'round') {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = cap; ctx.stroke();
}
function rrect(x, y, w, h, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function emoji(ch, x, y, size, alpha) {
  ctx.save();
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(ch, x, y);
  ctx.restore();
}
// Leaf pointing along `ang` (radians, -PI/2 = straight up).
function leaf(x, y, len, wid, ang, col) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
  ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
  ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}
function stem(x0, y0, x1, y1, col, w, bend = 0) {
  ctx.beginPath(); ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1);
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
}
// Draw fn() in a local frame: origin at (sx, sy), 1 unit = s px, flip = -1 mirrors horizontally.
function local(sx, sy, s, flip, fn) {
  ctx.save(); ctx.translate(sx, sy); ctx.scale(s * (flip || 1), s); fn(); ctx.restore();
}

// ---------- isometric solids (world tiles; heights in unscaled px) ----------
const tile = (i, j, fill, stroke) => poly([iso(i, j), iso(i + 1, j), iso(i + 1, j + 1), iso(i, j + 1)], fill, stroke);
function flatRect(x, y, w, d, fill, stroke, h = 0, lw) {
  const k = h * cam.z;
  poly([up(iso(x, y), k), up(iso(x + w, y), k), up(iso(x + w, y + d), k), up(iso(x, y + d), k)], fill, stroke, lw);
}
// Box over a footprint. Returns its two visible faces as [left point, right point] on the ground,
// for putting windows and doors on with wallRect().
function box(x, y, w, d, h, col, base = 0, o = {}) {
  const z = cam.z, hb = base * z, hh = (base + h) * z;
  const A = iso(x, y), B = iso(x + w, y), C = iso(x + w, y + d), D = iso(x, y + d);
  const edge = o.edge === undefined ? 'rgba(0,0,0,.07)' : o.edge;
  poly([up(D, hb), up(C, hb), up(C, hh), up(D, hh)], o.left || shade(col, -0.16), edge);
  poly([up(C, hb), up(B, hb), up(B, hh), up(C, hh)], o.right || shade(col, -0.04), edge);
  if (!o.noTop) poly([up(A, hh), up(B, hh), up(C, hh), up(D, hh)], o.top || shade(col, 0.1), edge);
  return { left: [D, C], right: [C, B], A, B, C, D, base, h };
}
// Rectangle on a wall face. u runs 0..1 along the face, h0/h1 are heights in unscaled px.
function wallRect(face, base, u0, u1, h0, h1, fill, stroke, lw) {
  const z = cam.z, p = (u, h) => up(lerp(face[0], face[1], u), (base + h) * z);
  poly([p(u0, h0), p(u1, h0), p(u1, h1), p(u0, h1)], fill, stroke, lw ? lw * z : z);
}
function wallLine(face, base, u0, h0, u1, h1, col, w) {
  const z = cam.z, a = up(lerp(face[0], face[1], u0), (base + h0) * z), b = up(lerp(face[0], face[1], u1), (base + h1) * z);
  line(a.x, a.y, b.x, b.y, col, w * z);
}
function wallPt(face, base, u, h) { return up(lerp(face[0], face[1], u), (base + h) * cam.z); }

// Gable roof, ridge along x (gable end shows on the right). between() draws things like a chimney
// after the back slope but before the front slope, so the roof hides the chimney's base.
function gableX(x, y, w, d, baseH, roofH, roofCol, endCol, between) {
  const z = cam.z, bh = baseH * z, rh = roofH * z;
  const Au = up(iso(x, y), bh), Bu = up(iso(x + w, y), bh), Cu = up(iso(x + w, y + d), bh), Du = up(iso(x, y + d), bh);
  const R1 = up(mid(Au, Du), rh), R2 = up(mid(Bu, Cu), rh);
  poly([Au, Bu, R2, R1], shade(roofCol, -0.3));
  if (between) between();
  poly([Du, Cu, R2, R1], roofCol, 'rgba(0,0,0,.1)');
  ctx.save();
  ctx.beginPath(); ctx.moveTo(Du.x, Du.y); ctx.lineTo(Cu.x, Cu.y); ctx.lineTo(R2.x, R2.y); ctx.lineTo(R1.x, R1.y); ctx.closePath(); ctx.clip();
  for (const u of [0.25, 0.5, 0.75]) { const a = lerp(Du, R1, u), b = lerp(Cu, R2, u); line(a.x, a.y, b.x, b.y, shade(roofCol, -0.12), 1.2 * z); }
  ctx.restore();
  poly([Cu, Bu, R2], endCol, 'rgba(0,0,0,.08)');
  line(R1.x, R1.y, R2.x, R2.y, shade(roofCol, 0.3), 1.6 * z);
  return { Bu, Cu, R1, R2, Du };
}
// Gable roof, ridge along y (gable end faces the road, bottom left).
function gableY(x, y, w, d, baseH, roofH, roofCol, endCol) {
  const z = cam.z, bh = baseH * z, rh = roofH * z;
  const Au = up(iso(x, y), bh), Bu = up(iso(x + w, y), bh), Cu = up(iso(x + w, y + d), bh), Du = up(iso(x, y + d), bh);
  const R1 = up(mid(Au, Bu), rh), R2 = up(mid(Du, Cu), rh);
  poly([Au, Du, R2, R1], shade(roofCol, -0.3));
  poly([Bu, Cu, R2, R1], roofCol, 'rgba(0,0,0,.1)');
  poly([Du, Cu, R2], endCol, 'rgba(0,0,0,.08)');
  line(R1.x, R1.y, R2.x, R2.y, shade(roofCol, 0.3), 1.6 * z);
  return { Du, Cu, R1, R2 };
}
function pyramid(x, y, w, d, base, rh, col) {
  const z = cam.z;
  const Bu = up(iso(x + w, y), base * z), Cu = up(iso(x + w, y + d), base * z), Du = up(iso(x, y + d), base * z);
  const apex = up(iso(x + w / 2, y + d / 2), (base + rh) * z);
  poly([Du, Cu, apex], col, 'rgba(0,0,0,.08)');
  poly([Cu, Bu, apex], shade(col, -0.18), 'rgba(0,0,0,.08)');
  return apex;
}
// Hip roof: ridge along x, sloped on all four sides.
function hipRoof(x, y, w, d, base, rh, col) {
  if (w <= d) return pyramid(x, y, w, d, base, rh, col);
  const z = cam.z, bh = base * z;
  const Au = up(iso(x, y), bh), Bu = up(iso(x + w, y), bh), Cu = up(iso(x + w, y + d), bh), Du = up(iso(x, y + d), bh);
  const R1 = up(iso(x + d / 2, y + d / 2), (base + rh) * z), R2 = up(iso(x + w - d / 2, y + d / 2), (base + rh) * z);
  poly([Au, Bu, R2, R1], shade(col, -0.3));
  poly([Du, Cu, R2, R1], col, 'rgba(0,0,0,.08)');
  poly([Cu, Bu, R2], shade(col, -0.18), 'rgba(0,0,0,.08)');
  poly([Au, Du, R1], shade(col, -0.05));
  line(R1.x, R1.y, R2.x, R2.y, shade(col, 0.3), 1.4 * z);
}

// ---------- soft things and round things ----------
// Outline of a rectangle with rounded corners (r in tiles), lifted to height hh (unscaled px).
function softPts(x, y, w, d, r, hh) {
  const z = cam.z, pts = [], n = 4;
  r = Math.max(0.001, Math.min(r, w / 2, d / 2));
  [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + d - r, 0], [x + r, y + d - r, Math.PI / 2], [x + r, y + r, Math.PI]].forEach(([cx, cy, a0]) => {
    for (let k = 0; k <= n; k++) { const a = a0 + k / n * Math.PI / 2; pts.push(up(iso(cx + Math.cos(a) * r, cy + Math.sin(a) * r), hh * z)); }
  });
  return pts;
}
// Something soft (pillow, cushion, quilt, mattress): rounded corners, sides that bulge out in the middle and
// tuck in at the bottom, a top that puffs up with a soft highlight. Same footprint as box().
function soft(x, y, w, d, h, col, base = 0, o = {}) {
  const r = Math.min(w, d) * (o.round ?? 0.32), puff = o.puff ?? 0.05, n = 5;
  for (let i = 0; i <= n; i++) {
    const t = i / n, bulge = Math.sin(t * Math.PI) * puff - (1 - t) * puff * 0.6;
    poly(softPts(x - bulge, y - bulge, w + bulge * 2, d + bulge * 2, r, base + h * t * 0.94), shade(col, -0.24 + t * 0.16));
  }
  const top = softPts(x + puff * 0.3, y + puff * 0.3, w - puff * 0.6, d - puff * 0.6, r, base + h);
  poly(top, o.top || shade(col, 0.06));
  const z = cam.z, c = up(iso(x + w * 0.45, y + d * 0.45), (base + h + 0.6) * z), rx = (w + d) * 9 * z, ry = (w + d) * 4.2 * z;
  ctx.save(); ctx.scale(1, ry / rx);
  const cy = c.y * rx / ry, g = ctx.createRadialGradient(c.x, cy, 0, c.x, cy, rx);
  g.addColorStop(0, `rgba(255,255,255,${o.shine ?? 0.38})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ellipse(c.x, cy, rx, rx, g); ctx.restore();
  if (o.seam) { const a = up(iso(x + w * 0.12, y + d / 2), (base + h) * z), b = up(iso(x + w * 0.88, y + d / 2), (base + h) * z); line(a.x, a.y, b.x, b.y, shade(col, -0.12), 0.7 * z); }
  return top;
}
// A wheel standing on a side that runs along `dir` (a screen direction, e.g. AXIS_Y): drawn the way a circle
// on that side really looks in this view, so it leans with the car body instead of a tilted oval.
const AXIS_X = { x: 2, y: 1 }, AXIS_Y = { x: -2, y: 1 };
function wheelOn(cx, cy, dir, r, fill, stroke, lw) {
  const L = Math.hypot(dir.x, dir.y), k = r * 0.9;
  ctx.save(); ctx.transform(dir.x / L * k, dir.y / L * k, 0, -r, cx, cy);
  ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.restore();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
// A tyre with a rim and a hub, on a side running along dir.
function tyre(cx, cy, dir, r, rim = '#c9ced4', tyreCol = '#26262a') {
  wheelOn(cx, cy, dir, r, tyreCol);
  wheelOn(cx, cy, dir, r * 0.58, rim);
  wheelOn(cx, cy, dir, r * 0.22, shade(rim, -0.35));
}
// A leaf with a soft rounded outline and a light midrib (local space).
function vleaf(x, y, len, wid, ang, col, rib = true) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.22, -wid * 1.15, len * 0.72, -wid * 0.95, len, 0);
  ctx.bezierCurveTo(len * 0.72, wid * 0.95, len * 0.22, wid * 1.15, 0, 0);
  ctx.fillStyle = col; ctx.fill();
  if (rib && len > 2.5) { ctx.beginPath(); ctx.moveTo(len * 0.08, 0); ctx.quadraticCurveTo(len * 0.5, -wid * 0.12, len * 0.86, 0); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = Math.max(0.25, wid * 0.16); ctx.stroke(); }
  ctx.restore();
}
// A big round leaf lying on the ground (pumpkin, melon): heart-shaped, squashed by the view, with veins.
function heartLeaf(x, y, r, col, ang = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.62); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(0, r * 0.95);
  ctx.bezierCurveTo(-r * 1.35, r * 0.25, -r * 0.95, -r * 1.05, 0, -r * 0.45);
  ctx.bezierCurveTo(r * 0.95, -r * 1.05, r * 1.35, r * 0.25, 0, r * 0.95);
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = Math.max(0.3, r * 0.08); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, r * 0.8); ctx.lineTo(0, -r * 0.35);
  [-1, 1].forEach(s => { ctx.moveTo(0, r * 0.3); ctx.lineTo(s * r * 0.6, -r * 0.2); ctx.moveTo(0, r * 0.6); ctx.lineTo(s * r * 0.7, r * 0.3); });
  ctx.stroke();
  ctx.restore();
}

// ---------- labels ----------
function pill(text, x, y, bg, fg, font, h = 22) {
  ctx.font = font;
  const w = ctx.measureText(text).width + 16;
  rrect(x - w / 2, y - h, w, h, h / 2, bg);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y - h / 2 + 1);
  return { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y };
}
// Round speech bubble with an emoji, used for "ready" products above animals and crops.
function bubble(ch, x, y, s, bob) {
  const r = 12 * s, cy = y - r - 6 * s - bob;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
  circle(x, cy, r, '#fffdf8');
  ctx.restore();
  pg([[x - 4 * s, cy + r - 2 * s], [x + 4 * s, cy + r - 2 * s], [x, cy + r + 5 * s]], '#fffdf8');
  emoji(ch, x, cy + 8 * s, 15 * s);
  return { x0: x - r - 4, x1: x + r + 4, y0: cy - r - 4, y1: cy + r + 8 };
}

// ---------- light ----------
function glow(x, y, r, a = 1) { if (NIGHT > 0.05) GLOWS.push({ x, y, r, a: a * NIGHT }); }
function drawGlows() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  GLOWS.forEach(g => {
    const gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
    gr.addColorStop(0, `rgba(255,214,140,${0.55 * g.a})`);
    gr.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
  });
  ctx.restore();
  GLOWS = [];
}
// How dark it is at this (simulated) time of day: 0 day, 1 night.
function nightAmount(ms) {
  const d = new Date(ms), h = d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 17.5) return 0;
  if (h >= 17.5 && h < 19.5) return (h - 17.5) / 2;
  if (h >= 5.5 && h < 7) return 1 - (h - 5.5) / 1.5;
  return 1;
}
