'use strict';
// Drawing primitives. Everything draws through the global ctx/cam, so the same sprite code
// renders the main scene and the shop thumbnails (which just swap ctx and cam).

let ctx = null;
let cam = { x: 0, y: 0, z: 1 };
let NIGHT = 0;     // 0 = day, 1 = night: windows and lamps light up
let GLOWS = [];    // light sources collected while drawing, painted over the night tint
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const UI_FONT = '"MT Nunito","MT Round",ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei UI",sans-serif';
// v0.43.1: the cute title font (ZCOOL KuaiLe) for building names and place names drawn in the scene
const CUTE_FONT = '"MT Nunito","MT Cute","MT Round",ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei UI",sans-serif';
if (typeof document !== 'undefined' && document.fonts && document.fonts.load) document.fonts.load('800 20px "MT Cute"', '镜像小镇体育场动物园').catch(() => {});   // the canvas can only use it once it's loaded

// ---------- math ----------
const iso = (x, y) => { if (TURN && !TURN.in) { x = TURN.sx - x; y = TURN.sy - y; TURN.pt(x, y); } if (CROT) { const dx = x - CROT.cx, dy = y - CROT.cy, m = CROT.m; x = CROT.cx + m[0] * dx + m[1] * dy; y = CROT.cy + m[2] * dx + m[3] * dy; } return { x: (x - y) * TW / 2 * cam.z + cam.x, y: (x + y) * TH / 2 * cam.z + cam.y }; };
// v0.46: drawing a thing turned half way round (rot 2 / 3, its front away from you). It's drawn the way it faces at
// rot 0 / 1, but every point (iso) and every solid (box, soft, flatRect) is mirrored through the middle of its
// footprint; the faces that now look away (what box() returns as left / right, frontFace) are hidden off screen; and
// since the pieces were drawn far-to-near for the other way round, the drawing is recorded (ctx is swapped for a
// recorder) and played back sorted far-to-near again: a solid behind another, or under it, goes first.
let TURN = null;
// v0.47: a car pointing any way at all (drawCarAng): every point of it is turned round its middle by the matrix m
// (with a mirror when its other side is the one we see); its wheels' ellipses turn with it (wheelOn)
let CROT = null;
const HIDDEN_FACE = [{ x: -1e5, y: -1e5 }, { x: -1e5, y: -1e5 }];
function turnCall(fn, x, y, w, d, z0, z1, rest) {
  const T = TURN, nx = T.sx - x - w, ny = T.sy - y - d;
  T.seg({ x: nx, y: ny, w, d, z0, z1 });
  T.in++;
  try { const r = fn(nx, ny, w, d, ...rest); return r && r.left ? Object.assign({}, r, { left: HIDDEN_FACE, right: HIDDEN_FACE }) : r; }
  finally { T.in--; }
}
const TURN_NOW = new Set(['createLinearGradient', 'createRadialGradient', 'createConicGradient', 'createPattern', 'measureText', 'getTransform', 'isPointInPath', 'getLineDash', 'getImageData']);
function turnDraw(x, y, w, d, fn) {
  const real = ctx, segs = [{ r: null, ops: [], i: 0 }], state = {};
  let cur = segs[0];
  const rec = new Proxy(real, {
    get(t, p) { if (p in state) return state[p]; const v = t[p]; if (typeof v !== 'function') return v; if (TURN_NOW.has(p)) return v.bind(t); return (...a) => { cur.ops.push([p, a]); }; },
    set(t, p, v) { state[p] = v; cur.ops.push([null, p, v]); return true; },
  });
  const prev = TURN;
  // drawing done straight from points (iso), not a solid: a piece of its own, as big as its points, of unknown height
  TURN = { sx: 2 * x + w, sy: 2 * y + d, in: 0, seg: r => { cur = { r, ops: [], i: segs.length }; segs.push(cur); },
    pt: (px, py) => {
      if (!cur.p) { cur = { r: { x: px, y: py, w: 0, d: 0, z0: 0, z1: 60 }, p: true, ops: [], i: segs.length }; segs.push(cur); return; }
      const r = cur.r, x1 = Math.max(r.x + r.w, px), y1 = Math.max(r.y + r.d, py); r.x = Math.min(r.x, px); r.y = Math.min(r.y, py); r.w = x1 - r.x; r.d = y1 - r.y;
    } };
  ctx = rec;
  try { fn(); } finally { ctx = real; TURN = prev; }
  // far to near, only between pieces that cover each other on screen. Footprints that overlap: the lower one first
  // (it's under), a flat thing in the order drawn, else the taller one last (a headboard, a sofa back: now in front).
  // Footprints apart: the one behind (or below) first. Anything else by depth.
  const e = 0.02, key = s => s.r.x + s.r.w / 2 + s.r.y + s.r.d / 2;
  const byKey = (A, B) => { const k = key(A) - key(B); return Math.abs(k) > 1e-6 ? k < 0 : A.i < B.i; };
  const scr = r => [(r.x - r.y - r.d) * 32, (r.x + r.w - r.y) * 32, (r.x + r.y) * 16 - r.z1, (r.x + r.w + r.y + r.d) * 16 - r.z0];
  const cover = (a, b) => { const p = scr(a), q = scr(b); return p[0] < q[1] - 0.5 && q[0] < p[1] - 0.5 && p[2] < q[3] - 0.5 && q[2] < p[3] - 0.5; };
  const first = (A, B) => {   // true / false, or null: no need to keep an order
    const a = A.r, b = B.r;
    if (!cover(a, b)) return null;
    const ox = a.x < b.x + b.w - e && b.x < a.x + a.w - e, oy = a.y < b.y + b.d - e && b.y < a.y + a.d - e;
    if (ox && oy) {
      if (!A.p && !B.p && a.z1 <= b.z0 + 0.01) return true;
      if (!A.p && !B.p && b.z1 <= a.z0 + 0.01) return false;
      // something flat or drawn from points: mostly over the other one (water in the tub), in the order drawn; mostly
      // beside it (the piano's keys, now behind it), by depth
      const fa = A.p || a.z1 - a.z0 < 0.5, fb = B.p || b.z1 - b.z0 < 0.5;
      if (fa || fb) {
        const F = fa ? a : b, S2 = fa ? b : a, ov = Math.max(0, Math.min(F.x + F.w, S2.x + S2.w) - Math.max(F.x, S2.x)) * Math.max(0, Math.min(F.y + F.d, S2.y + S2.d) - Math.max(F.y, S2.y));
        return ov >= 0.5 * Math.max(F.w * F.d, 1e-4) ? A.i < B.i : byKey(A, B);
      }
      if (Math.abs(a.z1 - b.z1) >= 0.5) return a.z1 < b.z1;
      return byKey(A, B);
    }
    const zs = !A.p && !B.p, ab = a.x + a.w <= b.x + e || a.y + a.d <= b.y + e || (zs && a.z1 <= b.z0 + 0.01), ba = b.x + b.w <= a.x + e || b.y + b.d <= a.y + e || (zs && b.z1 <= a.z0 + 0.01);
    return ab !== ba ? ab : byKey(A, B);
  };
  const left = segs.slice(1), order = [segs[0]], n = left.length, pre = left.map(() => []);
  for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) { const f = first(left[u], left[v]); if (f === true) pre[v].push(u); else if (f === false) pre[u].push(v); }
  const done = new Uint8Array(n);
  for (let m = 0; m < n; m++) {
    let best = -1;
    for (let u = 0; u < n; u++) if (!done[u] && pre[u].every(v => done[v]) && (best < 0 || byKey(left[u], left[best]))) best = u;
    if (best < 0) for (let u = 0; u < n; u++) if (!done[u] && (best < 0 || byKey(left[u], left[best]))) best = u;   // a loop: by depth
    done[best] = 1; order.push(left[best]);
  }
  order.forEach(s => {
    real.save(); let dep = 0;
    s.ops.forEach(op => {
      if (op[0] === null) real[op[1]] = op[2];
      else if (op[0] === 'save') { dep++; real.save(); }
      else if (op[0] === 'restore') { if (dep > 0) { dep--; real.restore(); } }
      else real[op[0]](...op[1]);
    });
    while (dep-- > 0) real.restore();
    real.restore();
  });
}
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
// (remembered: the same few colours get shaded thousands of times a second)
const SHADE_MEMO = new Map();
function shade(c, amt) {
  const key = c + '|' + amt, hit = SHADE_MEMO.get(key);
  if (hit !== undefined) return hit;
  const [r, g, b] = rgbOf(c), f = amt < 0 ? 0 : 255, k = Math.abs(amt);
  const v = `rgb(${Math.round(r + (f - r) * k)},${Math.round(g + (f - g) * k)},${Math.round(b + (f - b) * k)})`;
  if (SHADE_MEMO.size > 5000) SHADE_MEMO.clear();
  SHADE_MEMO.set(key, v);
  return v;
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
  if (TURN && !TURN.in) return turnCall(flatRect, x, y, w, d, h, h, [fill, stroke, h, lw]);
  const k = h * cam.z;
  poly([up(iso(x, y), k), up(iso(x + w, y), k), up(iso(x + w, y + d), k), up(iso(x, y + d), k)], fill, stroke, lw);
}
// Box over a footprint. Returns its two visible faces as [left point, right point] on the ground,
// for putting windows and doors on with wallRect().
// v0.21: materials. Every solid gets light falling from above (a little lighter at the top of each wall, darker
// at the bottom), a soft dark band where it meets the ground, a bright edge where the light catches it, a faint
// grain so surfaces aren't flat plastic, and a soft shadow on the ground. Only close up (cheap when far away).
const isHex = c => typeof c === 'string' && c[0] === '#';
function vgrad(pts, col, kTop, kBot) {
  if (!isHex(col)) return col;
  const ys = pts.map(p => p.y), top = Math.min(...ys), bot = Math.max(...ys);
  if (bot - top < 2) return col;
  const g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, shade(col, kTop)); g.addColorStop(1, shade(col, kBot)); return g;
}
let GRAIN = null;
function grainPattern() {
  if (GRAIN !== null) return GRAIN;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'), im = g.createImageData(96, 96);
    for (let i = 0; i < im.data.length; i += 4) { const v = 110 + Math.random() * 145; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); GRAIN = g.createPattern(c, 'repeat');
  } catch (e) { GRAIN = false; }
  return GRAIN;
}
function grain(pts, a = 0.07) { const pat = grainPattern(); if (!pat) return; ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'multiply'; poly(pts, pat); ctx.restore(); }
// darker where a wall meets the ground (k px tall)
function groundAO(pts, k) {
  const bot = Math.max(pts[0].y, pts[1].y), g = ctx.createLinearGradient(0, bot - k, 0, bot);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.16)'); poly(pts, g);
}
// a soft shadow on the ground round a footprint, falling away from the light (towards -x)
function softShadow(x, y, w, d, h) {
  const z = cam.z, L = Math.min(1.4, h / 45), pts = (e, sx) => [iso(x - e - sx, y - e + sx * 0.25), iso(x + w + e - sx * 0.3, y - e + sx * 0.25), iso(x + w + e - sx * 0.3, y + d + e), iso(x - e - sx, y + d + e)].map(p => ({ x: p.x, y: p.y + 1 * z }));
  poly(pts(0.22, L), 'rgba(40,30,20,.05)'); poly(pts(0.12, L * 0.8), 'rgba(40,30,20,.06)'); poly(pts(0.04, L * 0.55), 'rgba(40,30,20,.07)');
}
function box(x, y, w, d, h, col, base = 0, o = {}) {
  if (TURN && !TURN.in) return turnCall(box, x, y, w, d, base, base + h, [h, col, base, o]);
  const z = cam.z, hb = base * z, hh = (base + h) * z;
  const A = iso(x, y), B = iso(x + w, y), C = iso(x + w, y + d), D = iso(x, y + d);
  const edge = o.edge === undefined ? 'rgba(0,0,0,.07)' : o.edge, fine = z >= 0.32 && h * z > 2.5 && !o.flat;
  if (fine && !base && o.shadow !== false && h >= 5) softShadow(x, y, w, d, h);
  const Lf = [up(D, hb), up(C, hb), up(C, hh), up(D, hh)], Rf = [up(C, hb), up(B, hb), up(B, hh), up(C, hh)];
  const lc = o.left || shade(col, -0.16), rc = o.right || shade(col, -0.04);
  poly(Lf, fine ? vgrad(Lf, lc, 0.05, -0.07) : lc, edge);
  poly(Rf, fine ? vgrad(Rf, rc, 0.06, -0.05) : rc, edge);
  if (fine) {
    if (isHex(lc)) grain(Lf); if (isHex(rc)) grain(Rf);
    if (!base && h * z > 6) { const k = Math.min(9, h * 0.25) * z; groundAO(Lf, k); groundAO(Rf, k); }
  }
  if (!o.noTop) {
    const T = [up(A, hh), up(B, hh), up(C, hh), up(D, hh)], tc = o.top || shade(col, 0.1);
    poly(T, fine && isHex(tc) ? (() => { const g = ctx.createLinearGradient(T[0].x, T[0].y, T[2].x, T[2].y); g.addColorStop(0, shade(tc, 0.05)); g.addColorStop(1, shade(tc, -0.03)); return g; })() : tc, edge);
    if (fine && isHex(tc)) grain(T, 0.05);
  }
  if (fine && o.shine !== false) {   // the light catches the near edges
    const hl = 'rgba(255,255,255,.32)';
    line(up(D, hh).x, up(D, hh).y, up(C, hh).x, up(C, hh).y, hl, 0.9 * z); line(up(C, hh).x, up(C, hh).y, up(B, hh).x, up(B, hh).y, 'rgba(255,255,255,.42)', 0.9 * z);
    line(up(C, hb).x, up(C, hb).y, up(C, hh).x, up(C, hh).y, 'rgba(255,255,255,.2)', 0.8 * z);
  }
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
// v0.21: writing on a wall, sloping with it
function wallText(face, u, h, text, size, col) {
  const p = wallPt(face, 0, u, h), [a, b] = face, k = (b.y - a.y) / ((b.x - a.x) || 1);
  ctx.save(); ctx.translate(p.x, p.y); ctx.transform(1, k, 0, 1, 0, 0);
  ctx.font = `800 ${size}px ${UI_FONT},${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(text, 0, 0);
  ctx.restore();
}

// v0.21: a roof slope that faces you: lighter near the ridge, rows of tiles, a faint grain.
// pts = [eave start, eave end, ridge end, ridge start].
function roofPlane(pts, col, z) {
  if (z < 0.32 || !isHex(col)) { poly(pts, col, 'rgba(0,0,0,.1)'); return; }
  const [E0, E1, R1, R0] = pts, g = ctx.createLinearGradient(mid(R0, R1).x, mid(R0, R1).y, mid(E0, E1).x, mid(E0, E1).y);
  g.addColorStop(0, shade(col, 0.1)); g.addColorStop(1, shade(col, -0.08));
  poly(pts, g, 'rgba(0,0,0,.1)');
  ctx.save(); ctx.beginPath(); ctx.moveTo(E0.x, E0.y); pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.clip();
  const rows = z > 0.8 ? 7 : 4;
  for (let i = 1; i < rows; i++) { const u = i / rows, a = lerp(E0, R0, u), b = lerp(E1, R1, u); line(a.x, a.y, b.x, b.y, shade(col, -0.13), 1 * z); }
  if (z > 0.8) for (let i = 0; i < rows; i++) for (let j = 1; j < 14; j++) {   // staggered tile joints
    const u0 = i / rows, u1 = (i + 1) / rows, v = (j + (i % 2) * 0.5) / 14, a = lerp(lerp(E0, E1, v), lerp(R0, R1, v), u0), b = lerp(lerp(E0, E1, v), lerp(R0, R1, v), u1);
    line(a.x, a.y, b.x, b.y, shade(col, -0.08), 0.6 * z);
  }
  ctx.restore();
  grain(pts, 0.06);
}
// The dark line under the edge of a roof, on the wall below it.
function eaveShadow(a, b, z) { if (z < 0.32) return; line(a.x, a.y + 2 * z, b.x, b.y + 2 * z, 'rgba(0,0,0,.16)', 3 * z); }
// Gable roof, ridge along x (gable end shows on the right). between() draws things like a chimney
// after the back slope but before the front slope, so the roof hides the chimney's base.
function gableX(x, y, w, d, baseH, roofH, roofCol, endCol, between) {
  if (TURN && !TURN.in) return turnCall(gableX, x, y, w, d, baseH, baseH + roofH, [baseH, roofH, roofCol, endCol, between]);   // v0.46: a roof looks the same turned round
  const z = cam.z, bh = baseH * z, rh = roofH * z;
  const Au = up(iso(x, y), bh), Bu = up(iso(x + w, y), bh), Cu = up(iso(x + w, y + d), bh), Du = up(iso(x, y + d), bh);
  const R1 = up(mid(Au, Du), rh), R2 = up(mid(Bu, Cu), rh);
  poly([Au, Bu, R2, R1], shade(roofCol, -0.3));
  if (between) between();
  roofPlane([Du, Cu, R2, R1], roofCol, z);
  poly([Cu, Bu, R2], z >= 0.32 ? vgrad([Cu, Bu, R2], endCol, 0.04, -0.06) : endCol, 'rgba(0,0,0,.08)');
  line(R1.x, R1.y, R2.x, R2.y, shade(roofCol, 0.3), 1.6 * z);
  eaveShadow(Du, Cu, z);
  return { Bu, Cu, R1, R2, Du };
}
// Gable roof, ridge along y (gable end faces the road, bottom left).
function gableY(x, y, w, d, baseH, roofH, roofCol, endCol) {
  if (TURN && !TURN.in) return turnCall(gableY, x, y, w, d, baseH, baseH + roofH, [baseH, roofH, roofCol, endCol]);
  const z = cam.z, bh = baseH * z, rh = roofH * z;
  const Au = up(iso(x, y), bh), Bu = up(iso(x + w, y), bh), Cu = up(iso(x + w, y + d), bh), Du = up(iso(x, y + d), bh);
  const R1 = up(mid(Au, Bu), rh), R2 = up(mid(Du, Cu), rh);
  poly([Au, Du, R2, R1], shade(roofCol, -0.3));
  roofPlane([Cu, Bu, R1, R2], roofCol, z);
  poly([Du, Cu, R2], z >= 0.32 ? vgrad([Du, Cu, R2], endCol, 0.04, -0.06) : endCol, 'rgba(0,0,0,.08)');
  line(R1.x, R1.y, R2.x, R2.y, shade(roofCol, 0.3), 1.6 * z);
  eaveShadow(Cu, Bu, z);
  return { Du, Cu, R1, R2 };
}
function pyramid(x, y, w, d, base, rh, col) {
  const z = cam.z;
  const Au = up(iso(x, y), base * z), Bu = up(iso(x + w, y), base * z), Cu = up(iso(x + w, y + d), base * z), Du = up(iso(x, y + d), base * z);
  const apex = up(iso(x + w / 2, y + d / 2), (base + rh) * z);
  poly([Au, Bu, apex], shade(col, -0.3)); poly([Au, Du, apex], shade(col, -0.22));   // v0.22: the back slopes too (no flat lid showing)
  if (z >= 0.32) roofPlane([Du, Cu, apex, apex], col, z); else poly([Du, Cu, apex], col, 'rgba(0,0,0,.08)');
  poly([Cu, Bu, apex], shade(col, -0.18), 'rgba(0,0,0,.08)');
  return apex;
}
// Hip roof: ridge along x, sloped on all four sides.
function hipRoof(x, y, w, d, base, rh, col) {
  if (TURN && !TURN.in) return turnCall(hipRoof, x, y, w, d, base, base + rh, [base, rh, col]);
  if (w <= d) return pyramid(x, y, w, d, base, rh, col);
  const z = cam.z, bh = base * z;
  const Au = up(iso(x, y), bh), Bu = up(iso(x + w, y), bh), Cu = up(iso(x + w, y + d), bh), Du = up(iso(x, y + d), bh);
  const R1 = up(iso(x + d / 2, y + d / 2), (base + rh) * z), R2 = up(iso(x + w - d / 2, y + d / 2), (base + rh) * z);
  poly([Au, Bu, R2, R1], shade(col, -0.3));
  roofPlane([Du, Cu, R2, R1], col, z);
  poly([Cu, Bu, R2], shade(col, -0.18), 'rgba(0,0,0,.08)');
  poly([Au, Du, R1], shade(col, -0.05));
  line(R1.x, R1.y, R2.x, R2.y, shade(col, 0.3), 1.4 * z);
  eaveShadow(Du, Cu, z); eaveShadow(Cu, Bu, z);
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
  if (TURN && !TURN.in) return turnCall(soft, x, y, w, d, base, base + h, [h, col, base, o]);
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
  if (CROT && (dir === AXIS_X || dir === AXIS_Y)) { const m = CROT.m, u = dir === AXIS_X ? m[0] : m[1], v = dir === AXIS_X ? m[2] : m[3]; dir = { x: 2 * (u - v), y: u + v }; }   // v0.47
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
// v0.43: labels (names, signs, prices) go in a queue while the scene draws and are drawn last, on top of everything,
// so nothing drawn later covers one. The most important first (pri); one that would overlap a label already placed
// moves up or down a little, or waits until you zoom in. hit: an object that gets the label's final box (for taps).
let LABEL_Q = null;
function labelsBegin() { LABEL_Q = []; }
function label(text, x, y, bg, fg, font, h = 22, pri = 1, hit = null) {
  if (!LABEL_Q) { const b = pill(text, x, y, bg, fg, font, h); if (hit) Object.assign(hit, b); return; }
  LABEL_Q.push({ text, x, y, bg, fg, font, h, pri, hit, i: LABEL_Q.length });
}
function labelsFlush() {
  const Q = LABEL_Q; LABEL_Q = null; if (!Q || !Q.length) return;
  const placed = [], over = b => placed.some(q => b.x0 < q.x1 && q.x0 < b.x1 && b.y0 < q.y1 && q.y0 < b.y1);
  Q.sort((a, b) => b.pri - a.pri || a.i - b.i).forEach(l => {
    ctx.font = l.font; const w = ctx.measureText(l.text).width + 16, st = l.h + 2;
    for (const dy of [0, -st, st, -2 * st, 2 * st]) {
      const b = { x0: l.x - w / 2 - 1, x1: l.x + w / 2 + 1, y0: l.y + dy - l.h - 1, y1: l.y + dy + 1 };
      if (over(b)) continue;
      placed.push(b); l.at = l.y + dy; break;
    }
  });
  Q.filter(l => l.at !== undefined).sort((a, b) => a.pri - b.pri || a.i - b.i).forEach(l => { const b = pill(l.text, l.x, l.at, l.bg, l.fg, l.font, l.h); if (l.hit) Object.assign(l.hit, b); });
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
// How dark it is at this (simulated) time of day: 0 day, 1 night. With a community: its own local time.
function nightAmount(ms, t) {
  const d = new Date(ms), h = t ? localHour(t, ms) : d.getHours() + d.getMinutes() / 60;
  if (h >= 7 && h < 17.5) return 0;
  if (h >= 17.5 && h < 19.5) return (h - 17.5) / 2;
  if (h >= 5.5 && h < 7) return 1 - (h - 5.5) / 1.5;
  return 1;
}
