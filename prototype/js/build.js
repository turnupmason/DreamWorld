'use strict';
// Built things: houses, barn, fences, cars, furniture, yard decorations and the town plaza.
// Everything takes world tile coordinates.

// ---------- house details ----------
function winFace(face, u, uw, h0, h1, o = {}) {
  const lit = NIGHT > 0.3, fr = o.frame || '#fffaf0', z = cam.z;
  if (o.shutters) {
    wallRect(face, 0, u - uw * 1.55, u - uw * 1.05, h0, h1, o.shutters);
    wallRect(face, 0, u + uw * 1.05, u + uw * 1.55, h0, h1, o.shutters);
  }
  wallRect(face, 0, u - uw, u + uw, h0, h1, fr);
  wallRect(face, 0, u - uw * 0.78, u + uw * 0.78, h0 + 1.6, h1 - 1.6, lit ? '#ffe39a' : '#a9dcf5');
  wallRect(face, 0, u - uw * 0.78, u, h0 + 1.6, (h0 + h1) / 2, lit ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.35)', null);
  wallLine(face, 0, u, h0 + 1.6, u, h1 - 1.6, fr, 1);
  wallLine(face, 0, u - uw * 0.78, (h0 + h1) / 2, u + uw * 0.78, (h0 + h1) / 2, fr, 1);
  if (o.box) {
    wallRect(face, 0, u - uw * 1.1, u + uw * 1.1, h0 - 3.2, h0, '#8a5a36');
    for (let k = 0; k < 5; k++) {
      const p = wallPt(face, 0, u - uw + k * uw / 2, h0);
      circle(p.x, p.y - 0.8 * z, 1.5 * z, ['#ef6f6c', '#f3d36b', '#e88bb7', '#fff', '#ef6f6c'][k]);
    }
  }
  if (lit) { const p = wallPt(face, 0, u, (h0 + h1) / 2); glow(p.x, p.y, 24 * z, 0.7); }
}
function doorFace(face, u, uw, h, col = '#7a4b2a') {
  wallRect(face, 0, u - uw * 1.18, u + uw * 1.18, 0, h + 2.2, '#fffaf0');
  wallRect(face, 0, u - uw, u + uw, 0, h, col);
  wallRect(face, 0, u - uw * 0.7, u - uw * 0.1, h * 0.55, h * 0.88, shade(col, -0.15));
  wallRect(face, 0, u + uw * 0.1, u + uw * 0.7, h * 0.55, h * 0.88, shade(col, -0.15));
  const k = wallPt(face, 0, u + uw * 0.62, h * 0.42);
  circle(k.x, k.y, 1.1 * cam.z, '#f2c230');
  if (NIGHT > 0.3) { const p = wallPt(face, 0, u, h + 6); glow(p.x, p.y, 20 * cam.z, 0.8); }
}
function chimney(x, y, base, h, col = '#b4603e') {
  const b = box(x, y, 0.42, 0.42, h, col, base);
  flatRect(x - 0.04, y - 0.04, 0.5, 0.5, shade(col, -0.25), null, base + h);
  if (cam.z > 0.28) {   // v0.21: a little smoke drifting up
    const z = cam.z, t0 = performance.now() / 1000, p = up(iso(x + 0.21, y + 0.21), (base + h + 2) * z);
    for (let k = 0; k < 4; k++) { const u = (t0 * 0.35 + k / 4 + x * 0.13) % 1; circle(p.x + Math.sin(u * 5 + k) * 3 * z + u * 8 * z, p.y - u * 34 * z, (2.5 + u * 6) * z, `rgba(240,240,236,${0.42 * (1 - u)})`); }
  }
  return b;
}

// Storeys you built on top: a thin band and a row of windows for each one, starting at height `from`.
function storyRows(b, from, n, o = {}) {
  for (let k = 0; k < n; k++) {
    const h0 = from + k * FLOOR_H;
    if (o.band) { wallRect(b.left, 0, 0, 1, h0, h0 + 2, o.band); wallRect(b.right, 0, 0, 1, h0, h0 + 2, o.band); }
    (o.left || [0.2, 0.5, 0.8]).forEach(u => winFace(b.left, u, o.uw || 0.06, h0 + 7, h0 + 21, o.win));
    (o.right || [0.3, 0.7]).forEach(u => winFace(b.right, u, o.uwR || 0.08, h0 + 7, h0 + 21, o.win));
  }
}

// Draws a home's house at lot origin (ox, oy). Returns the screen box for tapping.
// Built storeys (h.extra) make the walls taller; the roof sits on top of the last one.
function drawHouse(h, ox, oy, ts) {
  const H = HOUSES[h.house], [fx, fy, w, d] = H.fp, x = ox + fx, y = oy + fy, z = cam.z;
  const c = iso(x + w / 2, y + d / 2);
  ellipse(c.x, c.y + 6 * z, (w + d) * 17 * z, (w + d) * 8.5 * z, 'rgba(0,0,0,.08)');
  const du = (DOOR_X - fx) / w, wall = h.wall, roof = h.roof, id = H.id;
  const n = Math.max(0, floorsOf(h) - H.floors[0]), ex = n * FLOOR_H;
  let top = c.y;
  if (H.spec) top = drawSpecHouse(h, x, y, w, d, du, wall, roof, ts, n, H);
  else if (id === 'tent') {
    const g = gableY(x + 0.1, y + 0.1, w - 0.2, d - 0.2, 0, 46, roof, shade(roof, 0.22));
    const a = lerp(g.Du, g.Cu, 0.3), b = lerp(g.Du, g.Cu, 0.7), tp = lerp(mid(g.Du, g.Cu), g.R2, 0.74);
    poly([a, b, tp], shade(roof, -0.55));
    poly([a, tp, lerp(a, tp, 0.5)], shade(roof, 0.35));
    const p1 = iso(x - 0.3, y + d + 0.2), p2 = iso(x + w + 0.2, y + d + 0.2);
    line(g.R2.x, g.R2.y, p1.x, p1.y, 'rgba(90,70,50,.5)', 0.8 * z); line(g.R2.x, g.R2.y, p2.x, p2.y, 'rgba(90,70,50,.5)', 0.8 * z);
    if (NIGHT > 0.3) glow(mid(a, b).x, mid(a, b).y - 8 * z, 30 * z);
    top = g.R1.y;
  } else if (id === 'cabin') {
    const log = '#b0703f', wh = 28 + ex;
    const b = box(x, y, w, d, wh, log);
    for (let k = 1; k * 5.6 < wh - 1; k++) {
      wallLine(b.left, 0, 0, k * 5.6, 1, k * 5.6, shade(log, -0.32), 0.8);
      wallLine(b.right, 0, 0, k * 5.6, 1, k * 5.6, shade(log, -0.25), 0.8);
    }
    winFace(b.left, 0.8, 0.09, 9, 21, { frame: '#f3e3c3' });
    doorFace(b.left, du, 0.085, 19, '#6b3f22');
    winFace(b.right, 0.5, 0.12, 9, 21, { frame: '#f3e3c3' });
    storyRows(b, 28, n, { left: [0.3, 0.75], right: [0.5], uw: 0.08, uwR: 0.12, win: { frame: '#f3e3c3' } });
    const g = gableX(x - 0.15, y - 0.12, w + 0.3, d + 0.24, wh, 24, roof, log, () => chimney(x + w - 0.8, y + 0.4, wh - 4, 34, '#9a948a'));
    top = g.R1.y - 12 * z;
  } else if (id === 'cottage') {
    const wh = 32 + ex, b = box(x, y, w, d, wh, wall);
    wallRect(b.left, 0, 0, 1, 0, 3.2, shade(wall, -0.35)); wallRect(b.right, 0, 0, 1, 0, 3.2, shade(wall, -0.3));
    const sh = shade(roof, -0.1);
    winFace(b.left, 0.13, 0.065, 11, 24, { shutters: sh, box: true });
    winFace(b.left, 0.78, 0.065, 11, 24, { shutters: sh, box: true });
    doorFace(b.left, du, 0.075, 21);
    wallRect(b.left, 0, du - 0.12, du + 0.12, 24, 26.5, sh);
    winFace(b.right, 0.28, 0.08, 11, 24, { shutters: sh });
    winFace(b.right, 0.72, 0.08, 11, 24, { shutters: sh });
    storyRows(b, 31, n, { left: [0.13, 0.5, 0.78], uw: 0.065, band: shade(wall, -0.12), win: { shutters: sh, box: true } });
    const g = gableX(x - 0.15, y - 0.15, w + 0.3, d + 0.3, wh, 30, roof, wall, () => chimney(x + w - 0.9, y + 0.5, wh, 40));
    top = g.R1.y - 12 * z;
  } else if (id === 'twostory') {
    const wh = 62 + ex, b = box(x, y, w, d, wh, wall);
    wallRect(b.left, 0, 0, 1, 0, 3.2, shade(wall, -0.35)); wallRect(b.right, 0, 0, 1, 0, 3.2, shade(wall, -0.3));
    wallRect(b.left, 0, 0, 1, 30, 32, shade(wall, -0.12)); wallRect(b.right, 0, 0, 1, 30, 32, shade(wall, -0.1));
    [0.17, 0.83].forEach(u => winFace(b.left, u, 0.06, 10, 23, { box: true }));
    [0.17, 0.5, 0.83].forEach(u => winFace(b.left, u, 0.06, 38, 53));
    [0.3, 0.7].forEach(u => { winFace(b.right, u, 0.08, 10, 23); winFace(b.right, u, 0.08, 38, 53); });
    storyRows(b, 58, n, { left: [0.17, 0.5, 0.83], band: shade(wall, -0.12) });
    doorFace(b.left, du, 0.065, 21);
    // balcony over the door
    box(DOOR_X - 0.65 + ox, y + d, 1.3, 0.4, 2.5, '#fffaf0', 31);
    box(DOOR_X - 0.65 + ox, y + d + 0.36, 1.3, 0.05, 8, '#fffaf0', 33.5, { left: 'rgba(255,250,240,.8)' });
    const g = gableX(x - 0.15, y - 0.15, w + 0.3, d + 0.3, wh, 30, roof, wall, () => chimney(x + w - 1, y + 0.5, wh, 42));
    top = g.R1.y - 12 * z;
  } else if (id === 'modern') {
    top = drawModern(x, y, w, d, du, wall, roof, ts, n);
  } else if (id === 'chinese') {
    top = drawChinese(x, y, w, d, du, wall, ts, n);
  } else if (id === 'castle') {
    top = drawCastle(x, y, w, d, du, roof, ts, n);
  } else if (id === 'villa') {
    const wh = 62 + ex, mw = 4;
    const m = box(x, y, mw, d, wh, wall);
    wallRect(m.left, 0, 0, 1, 0, 3.2, shade(wall, -0.35));
    wallRect(m.left, 0, 0, 1, 30, 32, shade(wall, -0.12));
    const mdu = (DOOR_X - fx) / mw;
    [0.2].forEach(u => winFace(m.left, u, 0.09, 8, 25));
    [0.2, mdu, 0.9].forEach(u => winFace(m.left, u, 0.07, 37, 55));
    winFace(m.right, 0.86, 0.07, 37, 55);
    storyRows(m, 60, n, { left: [0.2, mdu, 0.9], right: [0.5, 0.86], uw: 0.07, uwR: 0.07, band: shade(wall, -0.12) });
    doorFace(m.left, mdu, 0.08, 23, '#5a3a22');
    hipRoof(x - 0.18, y - 0.18, mw + 0.36, d + 0.36, wh, 34, roof);
    chimney(x + 0.5, y + 0.9, wh + 6, 30);   // v0.22
    const wb = box(x + mw, y + 1, 2, 3, 34, wall);
    wallRect(wb.left, 0, 0, 1, 0, 3.2, shade(wall, -0.35));
    wallRect(wb.left, 0, 0.12, 0.88, 6, 27, '#fffaf0');
    wallRect(wb.left, 0, 0.15, 0.85, 8, 25, NIGHT > 0.3 ? '#ffe39a' : '#a9dcf5');
    [0.38, 0.62].forEach(u => wallLine(wb.left, 0, u, 8, u, 25, '#fffaf0', 1));
    if (NIGHT > 0.3) { const p = wallPt(wb.left, 0, 0.5, 16); glow(p.x, p.y, 34 * z, 0.8); }
    [0.3, 0.72].forEach(u => winFace(wb.right, u, 0.09, 9, 25));
    gableX(x + mw - 0.05, y + 0.88, 2.2, 3.24, 34, 18, roof, wall);
    // portico
    [DOOR_X - 0.5, DOOR_X + 0.38].forEach(cx => box(ox + cx, y + d + 0.1, 0.12, 0.12, 30, '#fffaf0'));
    box(ox + DOOR_X - 0.62, y + d - 0.05, 1.24, 0.42, 3, '#fffaf0', 30);
    flatRect(ox + DOOR_X - 0.6, y + d, 1.2, 0.5, '#e6dccb', null, 1);
    top = iso(x + mw / 2, y + d / 2).y - (wh + 34) * z;
  } else {
    const wh = 72 + ex, b = box(x, y, w, d, wh, wall);
    wallRect(b.left, 0, 0, 1, 0, 4, shade(wall, -0.35)); wallRect(b.right, 0, 0, 1, 0, 4, shade(wall, -0.3));
    wallRect(b.left, 0, 0, 1, 34, 36, shade(wall, -0.12)); wallRect(b.right, 0, 0, 1, 34, 36, shade(wall, -0.1));
    wallRect(b.left, 0, 0, 1, wh - 5, wh, shade(wall, 0.25)); wallRect(b.right, 0, 0, 1, wh - 5, wh, shade(wall, 0.2));
    [0.22, 0.62, 0.8].forEach(u => winFace(b.left, u, 0.045, 10, 28));
    [0.22, du, 0.62, 0.8].forEach(u => winFace(b.left, u, 0.045, 42, 60));
    [0.25, 0.5, 0.75].forEach(u => { winFace(b.right, u, 0.07, 10, 28); winFace(b.right, u, 0.07, 42, 60); });
    storyRows(b, 64, n, { left: [0.22, du, 0.62, 0.8], right: [0.25, 0.5, 0.75], uw: 0.045, uwR: 0.07, band: shade(wall, -0.12) });
    doorFace(b.left, du, 0.05, 26, '#5a3a22');
    hipRoof(x - 0.15, y - 0.15, w + 0.3, d + 0.3, wh, 32, roof);
    chimney(x + 0.6, y + 0.6, wh + 6, 34); chimney(x + w - 1, y + 0.6, wh + 6, 34);
    top = iso(x, y).y - (wh + 40) * z;
    // portico with columns and a pediment
    const py = y + d + 0.15;
    [-0.75, -0.25, 0.25, 0.75].forEach(dx => box(ox + DOOR_X + dx - 0.06, py, 0.12, 0.12, 40, '#fffaf0'));
    box(ox + DOOR_X - 0.95, y + d - 0.05, 1.9, 0.45, 4, '#fffaf0', 40);
    const pa = up(iso(ox + DOOR_X - 0.95, y + d + 0.4), 44 * z), pb = up(iso(ox + DOOR_X + 0.95, y + d + 0.4), 44 * z);
    poly([pa, pb, up(mid(pa, pb), 16 * z)], '#fffaf0', 'rgba(0,0,0,.1)');
    flatRect(ox + DOOR_X - 0.9, y + d, 1.8, 0.6, '#e6dccb', null, 1.5);
  }
  return { x0: iso(x, y + d).x, x1: iso(x + w, y).x, y0: top, y1: iso(x + w, y + d).y + 4 * z, top };
}

// ---------- farm buildings ----------
function drawBarn(x, y) {
  const red = '#c0453a', b = box(x, y, 2, 2, 30, red);
  [b.left, b.right].forEach(f => { wallLine(f, 0, 0.01, 0, 0.01, 30, '#fff', 1.4); wallLine(f, 0, 0.99, 0, 0.99, 30, '#fff', 1.4); });
  wallRect(b.left, 0, 0.25, 0.75, 0, 20, '#8f2f27', '#fff', 1.4);
  wallLine(b.left, 0, 0.25, 0, 0.75, 20, '#fff', 1); wallLine(b.left, 0, 0.75, 0, 0.25, 20, '#fff', 1);
  wallRect(b.right, 0, 0.36, 0.64, 18, 26, '#f0d27a', '#fff', 1.2);
  const g = gableX(x - 0.1, y - 0.1, 2.2, 2.2, 30, 20, '#6b3a30', red);
  return g.R1.y;
}
// Wooden water trough on little legs, with a glint on the water.
function drawTrough(x, y, ts = 0) {
  const z = cam.z;
  [[0.05, 0.05], [0.79, 0.05], [0.05, 0.27], [0.79, 0.27]].forEach(([u, v]) => box(x + u, y + v, 0.06, 0.06, 3, '#6b4423'));
  const b = box(x, y, 0.9, 0.38, 5, '#a0703f', 3);
  [b.left, b.right].forEach(f => { wallLine(f, 3, 0, 2.5, 1, 2.5, 'rgba(60,30,10,.3)', 0.6); wallLine(f, 3, 0.5, 0, 0.5, 5, 'rgba(60,30,10,.25)', 0.6); });
  flatRect(x + 0.07, y + 0.07, 0.76, 0.24, '#5fb6dc', null, 7.4);
  const p = up(iso(x + 0.32 + Math.sin(ts / 900) * 0.06, y + 0.19), 7.5 * z);
  ellipse(p.x, p.y, 3.2 * z, 1 * z, 'rgba(255,255,255,.65)');
}
function drawHay(x, y) {
  const b = box(x, y, 0.62, 0.46, 10, '#e2bd5a');
  [b.left, b.right].forEach(f => { wallLine(f, 0, 0, 3.5, 1, 3.5, '#c99a3a', 0.8); wallLine(f, 0, 0, 7, 1, 7, '#c99a3a', 0.8); });
}
// White picket fence along one straight edge.
// White picket fence. Everything goes into a few paths (it's drawn hundreds of times a frame).
function picket(ax, ay, bx, by) {
  const z = cam.z, a = iso(ax, ay), b = iso(bx, by);
  ctx.lineCap = 'round';
  ctx.beginPath(); for (const hh of [4, 9]) { ctx.moveTo(a.x, a.y - hh * z + 1); ctx.lineTo(b.x, b.y - hh * z + 1); }
  ctx.strokeStyle = 'rgba(120,90,50,.25)'; ctx.lineWidth = 3 * z; ctx.stroke();
  ctx.beginPath(); for (const hh of [4, 9]) { ctx.moveTo(a.x, a.y - hh * z); ctx.lineTo(b.x, b.y - hh * z); }
  ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2 * z; ctx.stroke();
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) * (z < 0.5 ? 2 : 4)));
  ctx.beginPath();
  for (let k = 0; k <= n; k++) { const q = lerp(a, b, k / n); ctx.roundRect(q.x - 1.5 * z, q.y - 12 * z, 3 * z, 12 * z, 1.4 * z); }
  ctx.fillStyle = '#fffaf0'; ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,50,.35)'; ctx.lineWidth = 0.8; ctx.stroke();
}
// Wooden ranch fence for the pasture.
function rail(ax, ay, bx, by) {
  const z = cam.z, a = iso(ax, ay), b = iso(bx, by);
  ctx.beginPath(); for (const hh of [5, 11]) { ctx.moveTo(a.x, a.y - hh * z); ctx.lineTo(b.x, b.y - hh * z); }
  ctx.strokeStyle = '#a0703f'; ctx.lineWidth = 2.2 * z; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); [a, b].forEach(q => ctx.roundRect(q.x - 1.8 * z, q.y - 14 * z, 3.6 * z, 14 * z, 1 * z));
  ctx.fillStyle = '#8a5a36'; ctx.fill();
}

// ---------- vehicles (front faces the road, +y) ----------
const CAR_SPEC = {
  mini:        { len: 1.6, wid: 0.84, shape: 'hatch' },
  sedan:       { len: 2.05, wid: 0.9, shape: 'sedan' },
  convertible: { len: 2.0, wid: 0.9, shape: 'convertible' },
  suv:         { len: 1.9, wid: 0.95, body: 12,  cab: [0.2, 1.38],  cabH: 10, rack: true },
  jeep:        { len: 1.8, wid: 0.95, body: 12,  cab: [0.25, 1.15], cabH: 10, lift: 3, lights: true, big: true },
  sports:      { len: 1.9, wid: 0.92, sleek: 'coupe' },
  pickup:      { len: 2.0, wid: 0.95, body: 11,  cab: [1.0, 0.66],  cabH: 9, bed: true },
  luxury:      { len: 2.35, wid: 0.94, shape: 'luxury' },
  muscle:      { len: 2.15, wid: 0.96, sleek: 'muscle' },
  supercar:    { len: 2.05, wid: 1.02, sleek: 'super' },
  champcar:    { len: 2.1, wid: 1.02, sleek: 'super' },
  minivan:     { len: 2.1, wid: 0.95, body: 10,  cab: [0.25, 1.6],  cabH: 12 },
  boxtruck:    { len: 2.4, wid: 1.0,  body: 7,   cab: [1.6, 0.72],  cabH: 12, cargo: [0.05, 1.5, 24] },
};
function carWheel(face, base, u, big) {
  const p = wallPt(face, base, u, 0), z = cam.z, k = big ? 1.35 : 1;
  tyre(p.x, p.y, AXIS_Y, 4.4 * z * k, '#c9ced4');
}
// Cars park on the driveway with the front towards the road (+y).
// Seen from behind (driving away from you): tail lights instead of headlights. Set by drawCarDir.
let CAR_REAR = false;
const HL = () => (CAR_REAR ? '#e5484d' : '#fff6c8');
// A car driving along a road in any of the 4 directions. Drawn along y (+y = towards you); along x it is the same
// picture mirrored left-right on screen (in this view that swaps x and y); going away from you shows the back.
function drawCarDir(c, px, py, dir, ts) {
  const two = CARS[c.k] && CARS[c.k].kind === 'two', s = CAR_SPEC[c.k] || CAR_SPEC.mini, len = two ? 1.6 : (s.len || 2.4);
  const p = iso(px, py);
  ctx.save();
  if (dir === '+x' || dir === '-x') { ctx.translate(p.x, 0); ctx.scale(-1, 1); ctx.translate(-p.x, 0); }
  CAR_REAR = dir === '-x' || dir === '-y';
  try { drawCar(c, px - 0.5, py - len / 2, ts); if (!two) carExtras(c, px, py, len, s, ts, dir === '+x' || dir === '-x'); } finally { CAR_REAR = false; ctx.restore(); }
}
// v0.40: a police car's paint (its county's: COUNTIES[].police) and the light bar; a number plate on every car (the
// state's colours: STATES[].plate; c.plate for your own car, which keeps your home state's plate wherever you go)
const lumOf = col => { const [r, g, b] = rgbOf(col); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
function carText(face, base, u, h, text, size, col, mirrored) {   // writing on a car's side that reads the right way round
  const p = wallPt(face, base, u, h), [a, b] = face, k = (b.y - a.y) / ((b.x - a.x) || 1);
  ctx.save(); ctx.translate(p.x, p.y); ctx.transform(1, k, 0, 1, 0, 0); if (mirrored) ctx.scale(-1, 1);
  ctx.font = `900 ${size}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(text, 0, 0);
  ctx.restore();
}
function carExtras(c, px, py, len, s, ts, mirrored) {
  const z = cam.z, w = s.wid || 0.9, x = px - 0.5 + (1 - w) / 2, y = py - len / 2, base = s.sleek ? 2.6 : 3.5 + (s.lift || 0), body = s.body || 6;
  const side = [iso(x + w, y + len), iso(x + w, y)], front = [iso(x, y + len), iso(x + w, y + len)], P = c.police;
  if (P && z > 0.2) {
    let under = P.body;
    if (P.pat === 'doors') { wallRect(side, base, 0.3, 0.72, 0.4, body - 0.3, P.a); under = P.a; }
    else if (P.pat === 'stripe') { wallRect(side, base, 0.02, 0.98, body * 0.28, body * 0.64, P.a); if (P.b && P.b !== P.a) wallRect(side, base, 0.02, 0.98, body * 0.68, body * 0.82, P.b); under = P.a; }
    else if (P.pat === 'checks') { for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) wallRect(side, base, i / 8, (i + 1) / 8, body * (0.12 + j * 0.3), body * (0.42 + j * 0.3), (i + j) % 2 ? P.a : P.b); }
    else if (P.pat === 'twotone') { wallRect(side, base, 0, 1, body * 0.5, body, P.a); wallRect(front, base, 0, 1, body * 0.5, body, P.a); under = P.a; }
    if (z > 0.7 && P.text) carText(side, base, 0.5, P.pat === 'checks' ? body * 0.88 : body * 0.46, P.text, (P.text.length > 8 ? 1.9 : 2.4) * z, lumOf(P.pat === 'checks' ? P.body : under) > 0.55 ? '#1d1d1f' : '#ffffff', mirrored);
    const L = P.lights || ['#ff4d4d', '#3b7bff'], lp = up(iso(px, py), (base + body + 6.3) * z), on = Math.floor(ts / 260) % 2;
    ctx.save(); ctx.globalAlpha *= 0.35; circle(lp.x - 4 * z, lp.y, 7 * z, on ? L[0] : 'rgba(0,0,0,0)'); circle(lp.x + 4 * z, lp.y, 7 * z, on ? 'rgba(0,0,0,0)' : L[1]); ctx.restore();
    rrect(lp.x - 7 * z, lp.y - 2 * z, 14 * z, 4 * z, 1.4 * z, '#2a2d33');
    rrect(lp.x - 6.4 * z, lp.y - 1.5 * z, 6 * z, 3 * z, 1 * z, on ? L[0] : shade(L[0], -0.45)); rrect(lp.x + 0.4 * z, lp.y - 1.5 * z, 6 * z, 3 * z, 1 * z, on ? shade(L[1], -0.45) : L[1]);
    if (NIGHT > 0.3) glow(lp.x, lp.y, 22 * z, 0.9);
  }
  const PL = c.plate || (typeof SCENE_TOWN !== 'undefined' ? stateOf(SCENE_TOWN).plate : null);
  if (PL && z > 0.5) {
    wallRect(front, base, 0.33, 0.67, 0.25, 2.55, PL.bg, 'rgba(0,0,0,.3)', 0.35);
    if (PL.band) wallRect(front, base, 0.33, 0.385, 0.25, 2.55, PL.band);
    if (PL.end) wallRect(front, base, 0.615, 0.67, 0.25, 2.55, PL.end);
    if (PL.top) wallRect(front, base, 0.39, 0.61, 2.0, 2.5, PL.top);
    wallLine(front, base, PL.band ? 0.41 : 0.38, 1.2, PL.end ? 0.59 : 0.62, 1.2, PL.fg, 0.9);
  }
}
function drawCar(c, x, y, ts) {
  const z = cam.z, col = c.color, def = CARS[c.k] || {};
  if (def.kind === 'two') return drawTwoWheeler(c, x, y, ts);
  if (c.k === 'camper') return drawCamper(c, x, y);
  if (c.k === 'tractor') return drawTractor(c, x, y, ts);
  const s = CAR_SPEC[c.k] || CAR_SPEC.mini, cx = x + (1 - s.wid) / 2, base = 3.5 + (s.lift || 0);
  if (s.sleek) return drawSleekCar(c, cx, y, s, ts);
  if (s.shape) return drawShapedCar(c, cx, y, s, ts);
  const ctr = iso(cx + s.wid / 2, y + s.len / 2);
  ellipse(ctr.x, ctr.y + 2 * z, (s.wid + s.len) * 15 * z, (s.wid + s.len) * 7 * z, 'rgba(0,0,0,.2)');
  const b = box(cx, y, s.wid, s.len, s.body, col, base);
  wallRect(b.left, base, 0, 1, 0, 2, s.big ? '#3a3a3a' : '#d5d5d0');
  wallRect(b.left, base, 0.06, 0.24, 4, 7, HL()); wallRect(b.left, base, 0.76, 0.94, 4, 7, HL());
  wallRect(b.left, base, 0.34, 0.66, 3, 6, shade(col, -0.45));
  wallRect(b.right, base, 0, 1, s.body * 0.45, s.body * 0.45 + 1, shade(col, 0.25));
  // doors: a seam, a handle, and a side mirror
  wallLine(b.right, base, 0.5, 1.2, 0.5, s.body - 0.8, shade(col, -0.3), 0.6);
  wallRect(b.right, base, 0.38, 0.45, s.body * 0.62, s.body * 0.62 + 0.9, shade(col, -0.35));
  { const m = wallPt(b.right, base, 0.78, s.body + 0.5); ellipse(m.x + 1.5 * z, m.y, 1.8 * z, 1.2 * z, shade(col, -0.2)); }
  if (s.big) wallRect(b.right, base, 0, 1, 0, 3, '#3a3a3a');
  if (s.bed) flatRect(cx + 0.08, y + 0.08, s.wid - 0.16, 0.86, shade(col, -0.4), null, base + s.body);
  if (s.stripes) { wallRect(b.right, base, 0, 1, s.body * 0.3, s.body * 0.55, '#fff'); flatRect(cx + s.wid * 0.38, y, s.wid * 0.24, s.len, '#fff', null, base + s.body); }
  if (s.chrome) wallRect(b.right, base, 0, 1, 1, 2.2, '#e8edf2');
  const top = base + s.body;
  if (s.cargo) {   // box truck: a tall cargo box behind the cab
    const cb = box(cx + 0.02, y + s.cargo[0], s.wid - 0.04, s.cargo[1], s.cargo[2], '#f4f1ea', top);
    wallRect(cb.right, top, 0.1, 0.9, 6, 16, col);
    wallRect(cb.left, top, 0.1, 0.9, 3, s.cargo[2] - 3, '#e6e1d6', '#cfc8bb', 0.8);
  }
  if (s.open) {
    // windshield, then two seats in the open cabin
    box(cx + 0.08, y + s.cab[0] + s.cab[1] - 0.06, s.wid - 0.16, 0.05, 6, '#bfe1f2', top, { left: 'rgba(150,200,230,.6)', right: 'rgba(170,215,240,.6)', top: '#ddd' });
    flatRect(cx + 0.08, y + s.cab[0], s.wid - 0.16, s.cab[1] - 0.08, shade(col, -0.35), null, top);
    [0.2, 0.55].forEach(u => box(cx + 0.12 + u * (s.wid - 0.24) - 0.02, y + s.cab[0] + 0.05, 0.22, 0.2, 6, '#3b3b3b', top));
  } else {
    const cb = box(cx + 0.07, y + s.cab[0], s.wid - 0.14, s.cab[1], s.cabH, '#bfe1f2', top, { left: '#8fc6e3', right: '#aad6ee', top: shade(col, 0.08) });
    wallLine(cb.right, top, 0.5, 0, 0.5, s.cabH, shade(col, -0.1), 1.6);
    const roofH = top + s.cabH;
    if (s.rack) [0.25, 0.75].forEach(u => { const a = up(iso(cx + 0.12, y + s.cab[0] + s.cab[1] * u), (roofH + 2) * z), q = up(iso(cx + s.wid - 0.12, y + s.cab[0] + s.cab[1] * u), (roofH + 2) * z); line(a.x, a.y, q.x, q.y, '#555', 1.2 * z); });
    if (s.lights) box(cx + 0.15, y + s.cab[0] + s.cab[1] - 0.15, s.wid - 0.3, 0.1, 2, '#333', roofH, { left: HL() });
  }
  if (s.spoiler) box(cx + 0.06, y + 0.02, s.wid - 0.12, 0.14, 1.4, shade(col, -0.25), top + 4);
  carWheel(b.right, 0, 0.2, s.big); carWheel(b.right, 0, 0.8, s.big);
  if (NIGHT > 0.3) { const p = wallPt(b.left, base, 0.5, 5); glow(p.x, p.y + 10 * z, 40 * z); }
  return { x0: iso(cx, y + s.len).x - 4, x1: iso(cx + s.wid, y).x + 4, y0: iso(cx, y).y - (top + s.cabH + 6) * z, y1: iso(cx + s.wid, y + s.len).y + 4 };
}
// A box whose top is shorter than its bottom along the car (sloped windscreen / nose / rear window).
// f0: how far the top is pulled in at the back (y side), f1 at the front (+y side). Draws front, side and top.
function slope(x, y, w, d, h, base, f0, f1, cols, side = 0.05) {
  const z = cam.z, P = (px, py, hh) => up(iso(px, py), (base + hh) * z);
  const b = [P(x, y, 0), P(x + w, y, 0), P(x + w, y + d, 0), P(x, y + d, 0)];
  const t = [P(x + side, y + f0, h), P(x + w - side, y + f0, h), P(x + w - side, y + d - f1, h), P(x + side, y + d - f1, h)];
  poly([b[3], b[2], t[2], t[3]], cols.front, 'rgba(0,0,0,.08)', 0.6);
  poly([b[2], b[1], t[1], t[2]], cols.side, 'rgba(0,0,0,.08)', 0.6);
  poly(t, cols.top, 'rgba(0,0,0,.06)', 0.6);
  return { b, t };
}
// Sports car, muscle car and supercar each get their own silhouette.
function drawSleekCar(c, x, y, s, ts) {
  const z = cam.z, col = c.color, w = s.wid, L = s.len, glass = '#273544', glassHi = '#3d5468';
  const ctr = iso(x + w / 2, y + L / 2);
  ellipse(ctr.x, ctr.y + 2 * z, (w + L) * 15 * z, (w + L) * 7 * z, 'rgba(0,0,0,.22)');
  const wheel = (u, big, wide) => {
    const p = up(lerp(iso(x + w, y + L), iso(x + w, y), u), 0), k = big ? 1.3 : 1.1;
    tyre(p.x, p.y, AXIS_Y, 4.6 * z * k * (wide ? 1.06 : 1), s.sleek === 'super' ? '#f2c230' : '#c9ced4', '#222');
  };
  if (s.sleek === 'super') {
    // low wedge: the nose dips almost to the ground, cabin far back and tiny, big rear wing
    const body = slope(x, y, w, L, 6, 2.6, 0.05, 0.75, { front: shade(col, -0.05), side: shade(col, -0.18), top: shade(col, 0.12) });
    wallRect([iso(x + w, y + L), iso(x + w, y)], 2.6, 0.55, 0.85, 1, 4.6, '#1d1d20');   // side air intake
    flatRect(x + 0.18, y + L - 0.62, w - 0.36, 0.08, HL(), null, 4.4);            // slim headlights
    slope(x + 0.12, y + 0.45, w - 0.24, 0.85, 4.6, 8.6, 0.3, 0.42, { front: glass, side: glassHi, top: shade(col, -0.05) }, 0.1);
    [0.12, 0.85].forEach(u => box(x + 0.1 + u * (w - 0.28), y + 0.12, 0.06, 0.06, 6, '#222', 8.6));
    box(x + 0.02, y + 0.04, w - 0.04, 0.24, 1.6, shade(col, -0.3), 14.6);
    wheel(0.18, true, true); wheel(0.78, true, false);
  } else if (s.sleek === 'muscle') {
    // long flat hood with a scoop, cabin set back, chrome bumper, twin racing stripes, fat rear tyres
    const b = box(x, y, w, L, 8, col, 3.5);
    wallRect(b.left, 3.5, 0, 1, 0, 2, '#e8edf2');
    wallRect(b.left, 3.5, 0.08, 0.2, 4, 6.5, HL()); wallRect(b.left, 3.5, 0.8, 0.92, 4, 6.5, HL());
    wallRect(b.left, 3.5, 0.32, 0.68, 3, 6, shade(col, -0.5));
    flatRect(x + w * 0.36, y, w * 0.1, L, '#fffaf0', null, 11.5); flatRect(x + w * 0.54, y, w * 0.1, L, '#fffaf0', null, 11.5);
    slope(x + 0.08, y + 0.32, w - 0.16, 0.78, 7, 11.5, 0.12, 0.26, { front: glass, side: glassHi, top: col });
    flatRect(x + w * 0.36, y + 0.44, w * 0.1, 0.4, '#fffaf0', null, 18.5); flatRect(x + w * 0.54, y + 0.44, w * 0.1, 0.4, '#fffaf0', null, 18.5);
    box(x + w * 0.3, y + L - 0.75, w * 0.4, 0.32, 3, '#2d2d2d', 11.5);                  // hood scoop
    wheel(0.2, true, true); wheel(0.8, false, false);
  } else {
    // rounded coupe: sloped nose and tail, glass bubble in the middle, little ducktail
    slope(x, y, w, L, 7, 3.2, 0.25, 0.4, { front: shade(col, -0.05), side: shade(col, -0.18), top: shade(col, 0.1) });
    flatRect(x + 0.15, y + L - 0.5, 0.2, 0.08, HL(), null, 8); flatRect(x + w - 0.35, y + L - 0.5, 0.2, 0.08, HL(), null, 8);
    slope(x + 0.1, y + 0.55, w - 0.2, 0.8, 5.5, 10.2, 0.25, 0.3, { front: glass, side: glassHi, top: shade(col, 0.05) }, 0.08);
    box(x + 0.08, y + 0.22, w - 0.16, 0.12, 1.4, shade(col, -0.25), 10.2);
    wheel(0.2, false, false); wheel(0.8, false, false);
  }
  if (NIGHT > 0.3) { const p = iso(x + w / 2, y + L); glow(p.x, p.y + 4 * z, 40 * z); }
  return { x0: iso(x, y + L).x - 4, x1: iso(x + w, y).x + 4, y0: iso(x, y).y - 26 * z, y1: iso(x + w, y + L).y + 4 };
}
// Everyday cars with their own silhouettes (v0.13): a round hatchback, a three-box sedan, an open convertible and a
// long luxury car. Seen from the front-right: the front (+y) and the right side (+x) show.
function drawShapedCar(c, x, y, s, ts) {
  const z = cam.z, col = c.color, w = s.wid, L = s.len, glass = '#2c3b4c', glassHi = '#44607a', chrome = '#e8edf2';
  const ctr = iso(x + w / 2, y + L / 2), at = (px, py, h) => up(iso(px, py), h * z);
  ellipse(ctr.x, ctr.y + 2 * z, (w + L) * 15 * z, (w + L) * 7 * z, 'rgba(0,0,0,.22)');
  const side = [iso(x + w, y + L), iso(x + w, y)], front = [iso(x, y + L), iso(x + w, y + L)];
  const wheel = (u, r = 4.5, rim = '#c9ced4', white) => {
    const p = lerp(side[0], side[1], u);
    tyre(p.x, p.y, AXIS_Y, r * z, rim);
    if (white) ellipse(p.x, p.y - r * 0.5 * z, r * 0.55 * z, r * 0.62 * z, null, '#f4f4f0', 1.3 * z);
  };
  const lamp = (u, h, r, round) => { const p = up(lerp(front[0], front[1], u), h * z); if (round) circle(p.x, p.y, r * z, HL(), shade(col, -0.35), 0.6 * z); else ellipse(p.x, p.y, r * z, r * 0.6 * z, HL()); };
  if (s.shape === 'hatch') {
    // a short round hatchback: rounded nose, tall bubbly cabin with a white roof, round eyes
    slope(x, y, w, L, 5.5, 3.2, 0.06, 0.16, { front: shade(col, -0.04), side: shade(col, -0.16), top: shade(col, 0.1) });
    slope(x + 0.05, y + 0.06, w - 0.1, L - 0.42, 6.5, 8.7, 0.06, 0.42, { front: glass, side: glassHi, top: '#f4f4f0' }, 0.06);
    const pl = lerp(iso(x + w - 0.05, y + 0.6), iso(x + w - 0.05, y + 0.7), 0.5); line(pl.x, pl.y - 8.8 * z, pl.x, pl.y - 15 * z, shade(col, -0.2), 1.6 * z);
    lamp(0.2, 5.6, 1.7, true); lamp(0.8, 5.6, 1.7, true);
    { const a = up(front[0], 3.4 * z), b = up(front[1], 3.4 * z); line(a.x, a.y, b.x, b.y, '#d5d5d0', 1.6 * z); }
    wheel(0.2, 4.2); wheel(0.8, 4.2);
  } else if (s.shape === 'sedan') {
    // three boxes: a long hood, the cabin in the middle with sloped windows, the boot behind
    const b = box(x, y, w, L, 6, col, 3.5);
    wallRect(b.left, 3.5, 0, 1, 0, 1.8, '#d5d5d0');
    wallRect(b.left, 3.5, 0.3, 0.7, 2.6, 4.8, shade(col, -0.45));
    wallLine(b.right, 3.5, 0.05, 5.4, 0.95, 5.4, chrome, 0.7);
    slope(x + 0.05, y + 0.48, w - 0.1, 1.02, 5.8, 9.5, 0.28, 0.34, { front: glass, side: glassHi, top: shade(col, 0.06) }, 0.07);
    const m = lerp(iso(x + w - 0.07, y + 0.62), iso(x + w - 0.07, y + 1.32), 0.5); line(m.x, m.y - 9.6 * z, m.x, m.y - 15 * z, shade(col, -0.25), 1.4 * z);
    lamp(0.14, 7.2, 1.9); lamp(0.86, 7.2, 1.9);
    wheel(0.2); wheel(0.8);
  } else if (s.shape === 'convertible') {
    // low and open: two seats, a steering wheel, the soft top folded behind, chrome trim, white-wall tyres
    slope(x, y, w, L, 5.2, 3.4, 0.18, 0.28, { front: shade(col, -0.04), side: shade(col, -0.16), top: shade(col, 0.1) });
    const top = 8.6;
    flatRect(x + 0.12, y + 0.5, w - 0.24, 0.85, '#3a2a22', null, top);   // the cabin floor
    [0.22, 0.56].forEach(u => { box(x + 0.1 + u * (w - 0.2) - 0.02, y + 0.58, 0.26, 0.24, 4, '#e8dcc8', top); box(x + 0.1 + u * (w - 0.2) - 0.02, y + 0.58, 0.26, 0.06, 7, '#d6c8b0', top); });
    { const p = at(x + w * 0.3, y + 1.12, top + 3.5); ellipse(p.x, p.y, 2.4 * z, 1.4 * z, null, '#2d2d2d', 0.9 * z); }
    box(x + 0.08, y + 1.3, w - 0.16, 0.05, 5, 'rgba(190,225,245,.75)', top, { left: 'rgba(170,215,240,.7)', right: 'rgba(190,225,245,.7)', top: chrome });
    box(x + 0.12, y + 0.16, w - 0.24, 0.3, 2.4, '#2d2d2d', top, { top: '#3d3d3d' });   // folded soft top
    { const a = at(x + w, y + L - 0.1, 7.2), b2 = at(x + w, y + 0.1, 7.2); line(a.x, a.y, b2.x, b2.y, chrome, 0.9 * z); }
    lamp(0.18, 6.4, 1.8, true); lamp(0.82, 6.4, 1.8, true);
    wheel(0.2, 4.4, '#c9ced4', true); wheel(0.8, 4.4, '#c9ced4', true);
  } else {
    // luxury: long and stately, a long hood, the cabin set back with dark glass, a chrome grille and a hood ornament
    const lo = shade(col, -0.25);
    const b = box(x, y, w, L, 7, col, 3.5);
    wallRect(b.right, 3.5, 0, 1, 0, 2.6, lo); wallRect(b.left, 3.5, 0, 1, 0, 2.6, lo);
    wallLine(b.right, 3.5, 0.02, 4.4, 0.98, 4.4, chrome, 0.9);
    for (let k = 0; k < 7; k++) { const u = 0.36 + k * 0.047; wallLine(b.left, 3.5, u, 2.6, u, 6, chrome, 0.7); }
    wallRect(b.left, 3.5, 0.34, 0.66, 2.4, 2.8, chrome);
    slope(x + 0.06, y + 0.4, w - 0.12, 1.15, 6.8, 10.5, 0.32, 0.38, { front: '#1f2a36', side: '#33475c', top: shade(col, 0.04) }, 0.08);
    const m = lerp(iso(x + w - 0.08, y + 0.6), iso(x + w - 0.08, y + 1.4), 0.5); line(m.x, m.y - 10.6 * z, m.x, m.y - 17 * z, shade(col, -0.2), 1.5 * z);
    { const p = at(x + w / 2, y + L - 0.12, 11.2); circle(p.x, p.y, 1.1 * z, chrome); line(p.x, p.y, p.x, p.y - 2 * z, chrome, 0.7 * z); }
    lamp(0.14, 8.2, 1.7); lamp(0.86, 8.2, 1.7);
    wheel(0.18, 4.6, chrome); wheel(0.82, 4.6, chrome);
  }
  if (NIGHT > 0.3) { const p = iso(x + w / 2, y + L); glow(p.x, p.y + 4 * z, 40 * z); }
  return { x0: iso(x, y + L).x - 4, x1: iso(x + w, y).x + 4, y0: iso(x, y).y - 24 * z, y1: iso(x + w, y + L).y + 4 };
}
function drawCamper(c, x, y) {
  const z = cam.z, cx = x - 0.02, wid = 1.05, len = 2.5, col = c.color;
  const ctr = iso(cx + wid / 2, y + len / 2);
  ellipse(ctr.x, ctr.y + 2 * z, 54 * z, 24 * z, 'rgba(0,0,0,.2)');
  const b = box(cx, y, wid, len, 30, '#f4f1ea', 3.5);
  wallRect(b.right, 3.5, 0, 1, 8, 12, col); wallRect(b.left, 3.5, 0, 1, 8, 12, col);
  wallRect(b.left, 3.5, 0.08, 0.92, 16, 27, '#8fc6e3', '#fff', 1);
  [0.18, 0.5].forEach(u => wallRect(b.right, 3.5, u, u + 0.18, 16, 24, NIGHT > 0.3 ? '#ffe39a' : '#aad6ee', '#fff', 1));
  wallRect(b.right, 3.5, 0.72, 0.84, 1, 24, shade('#f4f1ea', -0.12), '#ccc', 0.6);
  wallRect(b.left, 3.5, 0.06, 0.2, 3, 6, HL()); wallRect(b.left, 3.5, 0.8, 0.94, 3, 6, HL());
  box(cx + 0.3, y + 0.5, 0.45, 0.5, 4, '#dedad2', 33.5);
  carWheel(b.right, 0, 0.18); carWheel(b.right, 0, 0.82);
  return { x0: iso(cx, y + len).x - 4, x1: iso(cx + wid, y).x + 4, y0: iso(cx, y).y - 40 * z, y1: iso(cx + wid, y + len).y + 4 };
}
function drawTractor(c, x, y, ts) {
  const z = cam.z, col = c.color, cx = x + 0.1;
  const ctr = iso(cx + 0.4, y + 1);
  ellipse(ctr.x, ctr.y + 2 * z, 40 * z, 18 * z, 'rgba(0,0,0,.2)');
  const hood = box(cx + 0.15, y + 1.0, 0.5, 0.85, 12, col, 6);
  wallRect(hood.left, 6, 0.15, 0.85, 2, 9, '#444');
  [0.25, 0.5, 0.75].forEach(u => wallLine(hood.left, 6, u, 2, u, 9, '#777', 0.7));
  box(cx + 0.1, y + 0.2, 0.6, 0.85, 8, col, 6);
  // cab posts and roof
  [[cx + 0.12, y + 0.25], [cx + 0.6, y + 0.25], [cx + 0.12, y + 0.95], [cx + 0.6, y + 0.95]].forEach(([px, py]) => box(px, py, 0.06, 0.06, 26, '#333', 14));
  box(cx + 0.06, y + 0.18, 0.72, 0.9, 2, shade(col, -0.15), 40);
  box(cx + 0.25, y + 0.4, 0.3, 0.3, 4, '#333', 14);
  const pipe = up(iso(cx + 0.45, y + 1.6), 18 * z);
  line(pipe.x, pipe.y, pipe.x, pipe.y - 14 * z, '#555', 2 * z);
  const ph = (ts / 900) % 1;
  circle(pipe.x + ph * 4 * z, pipe.y - (16 + ph * 14) * z, (2 + ph * 3) * z, `rgba(200,200,200,${0.6 * (1 - ph)})`);
  // big back wheels, small front wheels
  const wb = iso(cx + 0.8, y + 0.55), wf = iso(cx + 0.72, y + 1.55);
  tyre(wb.x, wb.y - 9 * z, AXIS_Y, 10 * z, '#f2c230'); tyre(wf.x, wf.y - 5 * z, AXIS_Y, 5.4 * z, '#f2c230');
  return { x0: iso(cx, y + 1.9).x - 6, x1: iso(cx + 0.8, y).x + 10, y0: iso(cx, y).y - 46 * z, y1: iso(cx + 0.8, y + 1.9).y + 4 };
}
// Bicycles, e-bikes, scooters and motorbikes stand on the driveway along y.
function drawTwoWheeler(c, x, y, ts) {
  const z = cam.z, col = c.color, k = c.k === 'goldbike' ? 'bike' : c.k, cx = x + 0.5, motor = k !== 'bike';
  const wheelR = k === 'vespa' ? 3.6 : k === 'bike' || k === 'scooter' ? 5 : 5.6;
  const wheel = (wy) => { const p = up(iso(cx, wy), wheelR * z); wheelOn(p.x, p.y, AXIS_Y, wheelR * z, null, '#2b2b2e', (motor ? 2.6 : 1.8) * z); return p; };
  ellipse(iso(cx, y + 0.8).x, iso(cx, y + 0.8).y, 22 * z, 7 * z, 'rgba(0,0,0,.16)');
  const r = wheel(y + 0.3), f = wheel(y + 1.25);
  const P = (wy, h) => up(iso(cx, wy), h * z);
  const L = (a, b, c2, w) => line(a.x, a.y, b.x, b.y, c2, w * z);
  if (k === 'bike') {
    const seat = P(y + 0.55, 17), bar = P(y + 1.1, 19), ped = P(y + 0.72, 6);
    [[r, ped], [ped, f], [r, seat], [seat, ped], [seat, bar], [ped, bar], [bar, f]].forEach(([a, b]) => L(a, b, col, 1.6));
    ellipse(seat.x, seat.y - 1 * z, 3.4 * z, 1.4 * z, '#333');
    L(up(iso(cx - 0.22, y + 1.1), 21 * z), up(iso(cx + 0.22, y + 1.1), 21 * z), '#333', 1.5);
  } else if (k === 'scooter') {
    box(cx - 0.18, y + 0.35, 0.36, 0.8, 5, col, 4);
    box(cx - 0.14, y + 0.4, 0.28, 0.45, 3, '#3b3b3b', 9);
    box(cx - 0.12, y + 0.35, 0.24, 0.18, 6, '#2f2f2f', 4);   // battery
    L(P(y + 1.15, 9), P(y + 1.2, 26), col, 2.4);
    L(up(iso(cx - 0.25, y + 1.2), 26 * z), up(iso(cx + 0.25, y + 1.2), 26 * z), '#333', 1.6);
  } else if (k === 'vespa') {
    const b = box(cx - 0.17, y + 0.22, 0.34, 0.6, 9, col, 3);
    wallRect(b.right, 3, 0.2, 0.8, 3, 6, shade(col, 0.2));
    box(cx - 0.12, y + 0.28, 0.24, 0.45, 2.5, '#5a3a22', 12);
    box(cx - 0.1, y + 0.82, 0.2, 0.3, 1.5, '#444', 3);
    const sh = box(cx - 0.16, y + 1.1, 0.32, 0.07, 15, col, 3);
    wallRect(sh.left, 3, 0.3, 0.7, 10, 13, '#fff6c8');
    L(P(y + 1.15, 18), P(y + 1.12, 25), '#bbb', 1.8);
    L(up(iso(cx - 0.24, y + 1.12), 25 * z), up(iso(cx + 0.24, y + 1.12), 25 * z), '#333', 1.6);
    const m = up(iso(cx + 0.24, y + 1.12), 27 * z); circle(m.x, m.y, 1.4 * z, '#ddd');
  } else {
    const sport = k === 'sportbike';
    L(P(y + 0.3, wheelR), P(y + 0.75, 10), '#555', 1.6);
    box(cx - 0.11, y + 0.55, 0.22, 0.35, 6, '#666', 4);                       // engine
    L(P(y + 0.45, 6), P(y + 0.05, 7), '#ccc', 1.6);                            // exhaust
    if (sport) {
      const fr = box(cx - 0.15, y + 0.65, 0.3, 0.55, 9, col, 6);
      wallRect(fr.left, 6, 0.3, 0.7, 4, 8, '#fff6c8');
      box(cx - 0.1, y + 0.18, 0.2, 0.4, 4, col, 11);
      box(cx - 0.09, y + 0.45, 0.18, 0.25, 1.5, '#222', 12);
      box(cx - 0.12, y + 1.0, 0.24, 0.06, 6, 'rgba(160,210,235,.8)', 15);
    } else {
      box(cx - 0.12, y + 0.78, 0.24, 0.3, 5, col, 11);                         // tank
      box(cx - 0.1, y + 0.36, 0.2, 0.44, 2.5, '#222', 12);                     // seat
      L(f, P(y + 1.18, 24), '#999', 1.6);                                      // fork
      L(up(iso(cx - 0.28, y + 1.15), 25 * z), up(iso(cx + 0.28, y + 1.15), 25 * z), '#333', 1.6);
      const hl = P(y + 1.27, 20); circle(hl.x, hl.y, 2.2 * z, '#fff6c8', '#888', 0.6 * z);
    }
  }
  if (motor && NIGHT > 0.3) { const p = P(y + 1.3, 16); glow(p.x, p.y + 8 * z, 26 * z); }
  return { x0: iso(cx, y + 1.4).x - 14 * z, x1: iso(cx, y).x + 14 * z, y0: iso(cx, y).y - 30 * z, y1: iso(cx, y + 1.4).y + 6 };
}

// ---------- furniture ----------
// rot 0: long side along x, back against the y-side wall. rot 1: turned to face the other way.
function furnSize(k, rot) { const D = FURN[k]; return rot ? [D.d, D.w] : [D.w, D.d]; }
// v0.19: the arm of a sofa / armchair nearest you, drawn again over someone sitting in it (so legs don't poke through it)
function drawSeatFront(it, x, y) {
  const k = it.k;
  if (k !== 'sofa' && k !== 'armchair') return;
  const tint = it.tint || '#8d99a6', [w, d] = furnSize(k, it.rot);
  if (it.rot) soft(x + 0.28, y + d - 0.28, w - 0.32, 0.24, 9, tint, 4, { round: 0.48 });
  else soft(x + w - 0.28, y + 0.28, 0.24, d - 0.32, 9, tint, 4, { round: 0.48 });
}
function frontFace(x, y, w, d, rot) { return rot ? [iso(x + w, y + d), iso(x + w, y)] : [iso(x, y + d), iso(x + w, y + d)]; }
// A strip of depth t along the back of the footprint.
function backStrip(x, y, w, d, rot, t) { return rot ? [x, y, t, d] : [x, y, w, t]; }
function legs(x, y, w, d, h, col, inset = 0.1) {
  [[x + inset, y + inset], [x + w - inset - 0.08, y + inset], [x + inset, y + d - inset - 0.08], [x + w - inset - 0.08, y + d - inset - 0.08]]
    .forEach(([lx, ly]) => box(lx, ly, 0.08, 0.08, h, col));
}
const WOOD = '#b07a4a', DARKWOOD = '#7a4f2e';
// The quilt again, drawn over someone lying in bed so they're tucked in.
// Quilts: soft, with the top edge folded back. Drawn with the bed, and again over you when you're lying in it.
function quiltRect(it, x = it.x, y = it.y) {
  const k = it.k, rot = it.rot, [w, d] = furnSize(k, rot);
  if (k === 'bed') return rot ? [x + 0.78, y + 0.08, w - 0.86, d - 0.16] : [x + 0.08, y + 0.78, w - 0.16, d - 0.86];
  if (k === 'sleepbag') return rot ? [x + 0.6, y + 0.1, w - 0.7, d - 0.2] : [x + 0.1, y + 0.6, w - 0.2, d - 0.7];
  return rot ? [x + 0.72, y + 0.1, w - 0.82, d - 0.2] : [x + 0.1, y + 0.72, w - 0.2, d - 0.82];
}
const QUILT_BASE = { bed: 9, singlebed: 9, bunkbed: 11, sleepbag: 3.5 };
function drawQuilt(it, base = QUILT_BASE[it.k] || 9, x = it.x, y = it.y) {
  const tint = it.tint || '#8d99a6', [qx, qy, qw, qd] = quiltRect(it, x, y), h = it.k === 'sleepbag' ? 2 : it.k === 'bed' ? 5 : 4;
  soft(qx, qy, qw, qd, h, it.k === 'sleepbag' ? shade(tint, 0.15) : tint, base, { round: 0.14, puff: 0.03, shine: 0.22 });
  const f = 0.17, hem = shade(tint, it.k === 'sleepbag' ? 0.4 : 0.3);
  if (it.rot) soft(qx - 0.02, qy + 0.02, f, qd - 0.04, 1.8, hem, base + h - 0.8, { round: 0.4, puff: 0.01, shine: 0.1 });
  else soft(qx + 0.02, qy - 0.02, qw - 0.04, f, 1.8, hem, base + h - 0.8, { round: 0.4, puff: 0.01, shine: 0.1 });
}
function drawBedQuilt(it) { drawQuilt(it); }
// Little tassels along the two short ends of a rug.
function rugFringe(x, y, w, d, rot, tint) {
  const z = cam.z, col = shade(tint, 0.5), long = w >= d;
  ctx.beginPath();
  for (let k = 0; k <= 10; k++) {
    const u = 0.14 + k / 10 * 0.72;
    const ends = long ? [[x + 0.08, y + u * d, -1, 0], [x + w - 0.08, y + u * d, 1, 0]] : [[x + u * w, y + 0.08, 0, -1], [x + u * w, y + d - 0.08, 0, 1]];
    ends.forEach(([px, py, dx, dy]) => { const a = up(iso(px, py), 0.4 * z), b = up(iso(px + dx * 0.07, py + dy * 0.07), 0.2 * z); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); });
  }
  ctx.strokeStyle = col; ctx.lineWidth = 1 * z; ctx.lineCap = 'round'; ctx.stroke();
}
function drawFurn(it, x, y, ts) {
  if (it.k === 'trophycase') return drawTrophyCase(it, x, y);
  if (it.k === 'bigteddy') { ctx.save(); const c = iso(x + 1, y + 1); ctx.translate(c.x, c.y); ctx.scale(2.1, 2.1); ctx.translate(-c.x, -c.y); drawPlush('plushbear', x + 0.5, y + 0.5); ctx.restore(); return; }
  if (FURN[it.k] && FURN[it.k].plush) return drawPlush(it.k, x, y);
  if (FURN[it.k] && FURN[it.k].poster) return drawPosterStand(FURN[it.k].poster, x, y);
  const k = it.k, rot = it.rot, tint = it.tint || '#8d99a6', [w, d] = furnSize(k, rot), z = cam.z;
  const B = (bx, by, bw, bd, h, col, base, o) => box(bx, by, bw, bd, h, col, base, o);
  switch (k) {
    case 'sleepbag': {
      soft(x + 0.1, y + 0.06, w - 0.2, d - 0.12, 3.5, tint, 0, { round: 0.3, puff: 0.04 });
      if (rot) soft(x + 0.16, y + 0.18, 0.4, d - 0.36, 3, '#fbfbf7', 3.2, { round: 0.45 }); else soft(x + 0.18, y + 0.16, w - 0.36, 0.4, 3, '#fbfbf7', 3.2, { round: 0.45 });
      drawQuilt(it, QUILT_BASE.sleepbag, x, y);
      break;
    }
    case 'bed': {
      if (rot) B(x + 0.02, y + 0.05, 0.12, d - 0.1, 30, DARKWOOD); else B(x + 0.05, y + 0.02, w - 0.1, 0.12, 30, DARKWOOD);
      B(x + 0.05, y + 0.05, w - 0.1, d - 0.1, 9, WOOD);
      soft(x + 0.1, y + 0.1, w - 0.2, d - 0.2, 4, '#fbfbf7', 9, { round: 0.12, puff: 0.02, shine: 0.2 });
      if (rot) { soft(x + 0.18, y + 0.18, 0.46, 0.74, 4, '#ffffff', 12.5, { round: 0.42, seam: true }); soft(x + 0.18, y + 1.08, 0.46, 0.74, 4, '#ffffff', 12.5, { round: 0.42, seam: true }); }
      else { soft(x + 0.18, y + 0.18, 0.74, 0.46, 4, '#ffffff', 12.5, { round: 0.42, seam: true }); soft(x + 1.08, y + 0.18, 0.74, 0.46, 4, '#ffffff', 12.5, { round: 0.42, seam: true }); }
      drawQuilt(it, 9, x, y);
      break;
    }
    case 'sofa': case 'armchair': {
      // a wooden-legged base, a soft back, round arms and plump seat cushions (two on a sofa)
      const bs = backStrip(x + 0.05, y + 0.05, w - 0.1, d - 0.1, rot, 0.3);
      B(x + 0.06, y + 0.06, w - 0.12, d - 0.12, 4, shade(tint, -0.25));
      soft(bs[0], bs[1], bs[2], bs[3], 18, shade(tint, -0.06), 4, { round: 0.45, puff: 0.04 });
      const seats = k === 'sofa' ? 2 : 1;
      if (rot) {
        soft(x + 0.28, y + 0.04, w - 0.32, 0.24, 9, tint, 4, { round: 0.48 });
        for (let i = 0; i < seats; i++) { const sd = (d - 0.5) / seats; soft(x + 0.3, y + 0.25 + i * sd, w - 0.36, sd, 6, shade(tint, 0.04), 4, { round: 0.3 }); }
        soft(x + 0.28, y + d - 0.28, w - 0.32, 0.24, 9, tint, 4, { round: 0.48 });
      } else {
        soft(x + 0.04, y + 0.28, 0.24, d - 0.32, 9, tint, 4, { round: 0.48 });
        for (let i = 0; i < seats; i++) { const sw2 = (w - 0.5) / seats; soft(x + 0.25 + i * sw2, y + 0.3, sw2, d - 0.36, 6, shade(tint, 0.04), 4, { round: 0.3 }); }
        soft(x + w - 0.28, y + 0.28, 0.24, d - 0.32, 9, tint, 4, { round: 0.48 });
      }
      break;
    }
    case 'table': {
      legs(x + 0.05, y + 0.05, w - 0.1, d - 0.1, 17, DARKWOOD);
      B(x + 0.05, y + 0.05, w - 0.1, d - 0.1, 3, WOOD, 17);
      const p = up(iso(x + w / 2, y + d / 2), 20 * z);
      ellipse(p.x, p.y, 7 * z, 3.2 * z, '#fff'); circle(p.x - 2 * z, p.y - 2 * z, 2 * z, '#e5483b'); circle(p.x + 2 * z, p.y - 2 * z, 2 * z, '#f2c230'); circle(p.x, p.y - 3.5 * z, 2 * z, '#6cbf4a');
      break;
    }
    case 'chair': {
      legs(x + 0.22, y + 0.22, 0.56, 0.56, 9, DARKWOOD, 0.02);
      if (rot) B(x + 0.2, y + 0.22, 0.08, 0.56, 16, DARKWOOD, 9); else B(x + 0.22, y + 0.2, 0.56, 0.08, 16, DARKWOOD, 9);
      B(x + 0.22, y + 0.22, 0.56, 0.56, 2.5, WOOD, 9);
      soft(x + 0.27, y + 0.27, 0.46, 0.46, 2.2, it.tint || '#e8b98a', 11.2, { round: 0.4, puff: 0.03 });
      break;
    }
    case 'desk': {
      legs(x + 0.05, y + 0.05, w - 0.1, d - 0.1, 17, '#666');
      B(x + 0.05, y + 0.05, w - 0.1, d - 0.1, 2.5, '#efe6d6', 17);
      const scr = '#4aa3df';
      if (rot) { const m = B(x + 0.18, y + 0.62, 0.06, 0.76, 13, '#2d2d2d', 22); wallRect(m.right, 22, 0.08, 0.92, 1.5, 11.5, scr); flatRect(x + 0.45, y + 0.7, 0.25, 0.6, '#ddd', null, 19.6); }
      else { const m = B(x + 0.62, y + 0.18, 0.76, 0.06, 13, '#2d2d2d', 22); wallRect(m.left, 22, 0.08, 0.92, 1.5, 11.5, scr); flatRect(x + 0.7, y + 0.45, 0.6, 0.25, '#ddd', null, 19.6); }
      B(rot ? x + 0.2 : x + 0.95, rot ? y + 0.95 : y + 0.2, 0.1, 0.1, 3, '#2d2d2d', 19.5);
      break;
    }
    case 'lamp': {
      B(x + 0.38, y + 0.38, 0.24, 0.24, 2, '#555');
      B(x + 0.47, y + 0.47, 0.06, 0.06, 32, '#777', 2);
      B(x + 0.3, y + 0.3, 0.4, 0.4, 11, '#fff3d6', 33, { top: '#fff9ea' });
      const p = up(iso(x + 0.5, y + 0.5), 36 * z);
      GLOWS.push({ x: p.x, y: p.y, r: 46 * z, a: 0.35 + NIGHT * 0.5 });
      break;
    }
    case 'tv': {
      if (rot) { B(x + 0.1, y + 0.05, 0.55, d - 0.1, 12, DARKWOOD); const t = B(x + 0.28, y + 0.2, 0.07, d - 0.4, 26, '#222', 12); tvScreen(t.right, ts); }
      else { B(x + 0.05, y + 0.1, w - 0.1, 0.55, 12, DARKWOOD); const t = B(x + 0.2, y + 0.28, w - 0.4, 0.07, 26, '#222', 12); tvScreen(t.left, ts); }
      break;
    }
    case 'shelf': {
      const s = rot ? B(x + 0.05, y + 0.08, 0.38, 0.84, 46, '#9c6a3f') : B(x + 0.08, y + 0.05, 0.84, 0.38, 46, '#9c6a3f');
      const f = rot ? s.right : s.left;
      [12, 24, 36].forEach(h => wallLine(f, 0, 0.04, h, 0.96, h, DARKWOOD, 1.2));
      const cols = ['#e5675f', '#5aa2e0', '#f3d36b', '#6cbf73', '#8b7fe0', '#f2a33a'];
      [2, 14, 26, 38].forEach((h, r) => { for (let i = 0; i < 6; i++) { const u = 0.08 + i * 0.14; if (hash(i, r + x * 3 + y) > 0.25) wallRect(f, 0, u, u + 0.1, h, h + 7 + hash(i * 2, r) * 2.5, cols[(i + r) % 6]); } });
      break;
    }
    case 'plant': {
      B(x + 0.32, y + 0.32, 0.36, 0.36, 10, '#c8754a');
      flatRect(x + 0.35, y + 0.35, 0.3, 0.3, '#6b4428', null, 10);
      const p = up(iso(x + 0.5, y + 0.5), 10 * z), sw = Math.sin(ts / 1200 + x) * 0.08;
      local(p.x, p.y, z, 1, () => {
        [-2.2, -1.5, -0.9, -0.4, 0.2].forEach((a, i) => leaf(0, 0, 13 - Math.abs(i - 2) * 1.5, 3.2, a - Math.PI / 2 + 1.3 + sw, i % 2 ? '#4f9e3e' : '#64b450'));
      });
      break;
    }
    case 'rug': {
      poly(softPts(x + 0.08, y + 0.08, w - 0.16, d - 0.16, 0.16, 0.4), tint);
      rugFringe(x, y, w, d, rot, tint);
      flatRect(x + 0.22, y + 0.22, w - 0.44, d - 0.44, null, shade(tint, 0.45), 0.5, 1.5 * z);
      const c0 = iso(x + w / 2, y + d / 2);
      poly([up(iso(x + w / 2, y + 0.5), 0.5 * z), up(iso(x + w - 0.5, y + d / 2), 0.5 * z), up(iso(x + w / 2, y + d - 0.5), 0.5 * z), up(iso(x + 0.5, y + d / 2), 0.5 * z)], shade(tint, 0.25));
      circle(c0.x, c0.y - 0.5 * z, 2.5 * z, shade(tint, -0.2));
      break;
    }
    case 'fridge': {
      const f = B(x + 0.14, y + 0.14, 0.72, 0.72, 48, '#eef1f3');
      const fc = rot ? f.right : f.left;
      wallLine(fc, 0, 0, 30, 1, 30, '#c9cfd4', 1);
      wallLine(fc, 0, 0.82, 34, 0.82, 44, '#9aa3ad', 1.4); wallLine(fc, 0, 0.82, 14, 0.82, 26, '#9aa3ad', 1.4);
      break;
    }
    case 'stove': {
      const s = B(x + 0.08, y + 0.1, 0.84, 0.8, 22, '#f1f1ee');
      flatRect(x + 0.12, y + 0.14, 0.76, 0.72, '#3a3a3a', null, 22);
      [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].forEach(([u, v]) => { const p = up(iso(x + u, y + v), 22.3 * z); ellipse(p.x, p.y, 5 * z, 2.5 * z, null, '#777', 1 * z); });
      const fc = rot ? s.right : s.left;
      wallRect(fc, 0, 0.15, 0.85, 4, 15, '#2d2d2d', '#bbb', 0.8);
      [0.2, 0.4, 0.6, 0.8].forEach(u => { const p = wallPt(fc, 0, u, 18.5); circle(p.x, p.y, 1.1 * z, '#555'); });
      break;
    }
    case 'treadmill': {
      const L = rot ? [x + 0.1, y + 0.15, w - 0.2, 0.7] : [x + 0.15, y + 0.1, 0.7, d - 0.2];
      B(L[0], L[1], L[2], L[3], 5, '#3a3a3a');
      flatRect(L[0] + 0.06, L[1] + 0.06, L[2] - 0.12, L[3] - 0.12, '#202020', null, 5);
      const off = (ts / 400) % 1;
      for (let i = 0; i < 4; i++) {
        const u = ((i + off) / 4);
        if (rot) { const a = up(iso(L[0] + 0.1 + u * (L[2] - 0.2), L[1] + 0.08), 5.2 * z), b = up(iso(L[0] + 0.1 + u * (L[2] - 0.2), L[1] + L[3] - 0.08), 5.2 * z); line(a.x, a.y, b.x, b.y, '#444', 1 * z); }
        else { const a = up(iso(L[0] + 0.08, L[1] + 0.1 + u * (L[3] - 0.2)), 5.2 * z), b = up(iso(L[0] + L[2] - 0.08, L[1] + 0.1 + u * (L[3] - 0.2)), 5.2 * z); line(a.x, a.y, b.x, b.y, '#444', 1 * z); }
      }
      const posts = rot ? [[L[0] + 0.02, L[1] + 0.02], [L[0] + 0.02, L[1] + L[3] - 0.1]] : [[L[0] + 0.02, L[1] + 0.02], [L[0] + L[2] - 0.1, L[1] + 0.02]];
      posts.forEach(([px, py]) => B(px, py, 0.08, 0.08, 28, '#888'));
      const cs = rot ? B(L[0], L[1], 0.14, L[3], 6, '#555', 28) : B(L[0], L[1], L[2], 0.14, 6, '#555', 28);
      wallRect(rot ? cs.right : cs.left, 28, 0.25, 0.75, 1.5, 4.5, '#5ce1a1');
      break;
    }
    case 'yogamat': {
      flatRect(x + 0.2, y + 0.12, w - 0.4, d - 0.24, tint, shade(tint, -0.2), 0.8);
      if (rot) B(x + w - 0.35, y + 0.12, 0.18, d - 0.24, 4, shade(tint, -0.1)); else B(x + 0.2, y + d - 0.35, w - 0.4, 0.18, 4, shade(tint, -0.1));
      break;
    }
    case 'aquarium': {
      const T = rot ? [x + 0.15, y + 0.08, 0.7, d - 0.16] : [x + 0.08, y + 0.15, w - 0.16, 0.7];
      B(T[0], T[1], T[2], T[3], 14, DARKWOOD);
      // back glass, fish, then the front glass so the fish sit inside the water
      flatRect(T[0], T[1], T[2], T[3], '#2f6f9a', null, 14);
      for (let i = 0; i < 3; i++) {
        const ph = ts / 1600 + i * 2.1, u = 0.5 + 0.38 * Math.sin(ph), dir = Math.cos(ph) > 0 ? 1 : -1;
        const fx = rot ? T[0] + T[2] / 2 : T[0] + 0.1 + u * (T[2] - 0.2), fy = rot ? T[1] + 0.1 + u * (T[3] - 0.2) : T[1] + T[3] / 2;
        const p = up(iso(fx, fy), (21 + i * 4 + Math.sin(ph * 3) * 1.5) * z);
        const sd = rot ? -dir : dir;
        ellipse(p.x, p.y, 3 * z, 1.8 * z, ['#f28c28', '#f3d36b', '#e5675f'][i]);
        pg([[p.x - sd * 2.6 * z, p.y], [p.x - sd * 5 * z, p.y - 2 * z], [p.x - sd * 5 * z, p.y + 2 * z]], ['#f28c28', '#f3d36b', '#e5675f'][i]);
      }
      B(T[0], T[1], T[2], T[3], 22, '#6fc0ea', 14, { left: 'rgba(90,170,220,.45)', right: 'rgba(110,185,230,.4)', top: 'rgba(160,215,245,.5)', edge: 'rgba(255,255,255,.6)' });
      const bt = (ts / 900) % 1, bp = up(iso(T[0] + T[2] * 0.7, T[1] + T[3] * 0.5), (16 + bt * 18) * z);
      circle(bp.x, bp.y, 1.2 * z, 'rgba(255,255,255,.7)');
      break;
    }
    case 'fireplace': {
      const F = rot ? [x + 0.05, y + 0.05, 0.45, d - 0.1] : [x + 0.05, y + 0.05, w - 0.1, 0.45];
      const C = rot ? [x + 0.05, y + 0.6, 0.35, d - 1.2] : [x + 0.6, y + 0.05, w - 1.2, 0.35];
      B(C[0], C[1], C[2], C[3], 34, '#a64c35', 36);
      const f = B(F[0], F[1], F[2], F[3], 34, '#b5563c');
      const fc = rot ? f.right : f.left;
      for (let r = 1; r < 6; r++) wallLine(fc, 0, 0, r * 6, 1, r * 6, '#8f3e2a', 0.6);
      wallRect(fc, 0, 0.25, 0.75, 0, 20, '#2a1a14');
      for (let i = 0; i < 4; i++) {
        const u = 0.33 + i * 0.11, fl = 8 + Math.sin(ts / 90 + i * 2) * 3 + Math.sin(ts / 170 + i) * 2;
        const p = wallPt(fc, 0, u, 0);
        ellipse(p.x, p.y - fl * z * 0.5, 3 * z, fl * z * 0.55, i % 2 ? '#f2a33a' : '#f6d04d');
      }
      B(rot ? x : x, rot ? y : y + 0.0, rot ? 0.58 : w, rot ? d : 0.58, 3, DARKWOOD, 34);
      const p = wallPt(fc, 0, 0.5, 8);
      GLOWS.push({ x: p.x, y: p.y, r: 60 * z, a: 0.45 + NIGHT * 0.4 });
      break;
    }
    case 'piano': {
      const P = rot ? [x + 0.08, y + 0.1, 0.45, d - 0.2] : [x + 0.1, y + 0.08, w - 0.2, 0.45];
      B(P[0], P[1], P[2], P[3], 32, '#2a2a2e');
      const K = rot ? [x + 0.5, y + 0.1, 0.24, d - 0.2] : [x + 0.1, y + 0.5, w - 0.2, 0.24];
      B(K[0], K[1], K[2], K[3], 3, '#2a2a2e', 18);
      flatRect(K[0] + (rot ? 0.02 : 0.05), K[1] + (rot ? 0.05 : 0.02), K[2] - (rot ? 0.06 : 0.1), K[3] - (rot ? 0.1 : 0.06), '#fbfbf7', null, 21);
      for (let i = 1; i < 12; i++) {
        if (i % 7 === 3 || i % 7 === 0) continue;
        const u = i / 12;
        const a = rot ? up(iso(K[0] + 0.03, K[1] + 0.05 + u * (K[3] - 0.1)), 21.3 * z) : up(iso(K[0] + 0.05 + u * (K[2] - 0.1), K[1] + 0.03), 21.3 * z);
        const b = rot ? up(iso(K[0] + 0.13, K[1] + 0.05 + u * (K[3] - 0.1)), 21.3 * z) : up(iso(K[0] + 0.05 + u * (K[2] - 0.1), K[1] + 0.13), 21.3 * z);
        line(a.x, a.y, b.x, b.y, '#222', 1.4 * z);
      }
      break;
    }
    default: drawFurn2(it, x, y, w, d, rot, tint, ts);
  }
}
function tvScreen(face, ts) {
  const cols = ['#3b6fb6', '#4b9a6a', '#b0594a', '#7a5ab6'], i = Math.floor(ts / 2500) % cols.length;
  wallRect(face, 12, 0.06, 0.94, 2, 24, cols[i]);
  const u = (ts / 1400) % 1;
  wallRect(face, 12, 0.06 + u * 0.7, 0.2 + u * 0.7, 5, 18, 'rgba(255,255,255,.18)', null);
  const p = wallPt(face, 12, 0.5, 13);
  GLOWS.push({ x: p.x, y: p.y, r: 36 * cam.z, a: 0.25 + NIGHT * 0.3 });
}

// ---------- yard ----------
function drawYardItem(it, x, y, ts) {
  if (YARD[it.k] && YARD[it.k].excl) return drawExcl(it, x, y, ts);
  const k = it.k, z = cam.z, c = iso(x + 0.5, y + 0.5);
  switch (k) {
    case 'flowers': {
      box(x + 0.1, y + 0.1, 0.8, 0.8, 4, '#9a6a44');
      flatRect(x + 0.14, y + 0.14, 0.72, 0.72, '#6b4428', null, 4);
      const cols = ['#ef6f6c', '#f3d36b', '#e88bb7', '#ffffff', '#a46ef0', '#f2a33a', '#ef6f6c'];
      for (let i = 0; i < 7; i++) {
        const u = 0.22 + hash(i, x + y * 7) * 0.56, v = 0.22 + hash(i + 9, x * 3 + y) * 0.56, p = up(iso(x + u, y + v), 4 * z);
        const sw = Math.sin(ts / 900 + i + x) * 1.4 * z;
        line(p.x, p.y, p.x + sw, p.y - 8 * z, '#4f9e3e', 1 * z);
        for (let q = 0; q < 5; q++) { const a = q / 5 * Math.PI * 2; circle(p.x + sw + Math.cos(a) * 1.7 * z, p.y - 9 * z + Math.sin(a) * 1.7 * z, 1.4 * z, cols[i]); }
        circle(p.x + sw, p.y - 9 * z, 1 * z, '#f6d04d');
      }
      break;
    }
    case 'hedge': {
      box(x + 0.1, y + 0.1, 0.8, 0.8, 12, '#4f9a4b', 0, { top: '#5fae55' });
      for (let i = 0; i < 4; i++) { const p = up(iso(x + 0.25 + (i % 2) * 0.5, y + 0.25 + Math.floor(i / 2) * 0.5), 13 * z); circle(p.x, p.y, 6 * z, i % 2 ? '#5fae55' : '#69b85d'); }
      break;
    }
    case 'tree': case 'pine': {
      ellipse(c.x, c.y, 14 * z, 6 * z, 'rgba(0,0,0,.15)');
      box(x + 0.44, y + 0.44, 0.12, 0.12, 16, '#8a5a36');
      const sw = Math.sin(ts / 1300 + x * 2) * 1.2 * z;
      if (k === 'pine') {
        [[32, 15, '#2f7d4a'], [44, 12, '#38905a'], [55, 8.5, '#45a368']].forEach(([h, r, col]) => pg([[c.x - r * z, c.y - (h - 18) * z], [c.x + r * z, c.y - (h - 18) * z], [c.x + sw, c.y - (h + 4) * z]], col));
      } else {
        ellipse(c.x + sw * 0.5, c.y - 28 * z, 15 * z, 13 * z, '#4f9a4b');
        ellipse(c.x - 5 * z + sw, c.y - 33 * z, 10 * z, 9 * z, '#62b05a');
        ellipse(c.x + 5 * z + sw, c.y - 37 * z, 8 * z, 7 * z, '#74c169');
        [[-7, -26], [6, -30], [-1, -36], [8, -22], [-9, -33]].forEach(([dx, dy]) => circle(c.x + dx * z + sw, c.y + dy * z, 2 * z, '#e5483b'));
      }
      break;
    }
    case 'lamp': {
      box(x + 0.4, y + 0.4, 0.2, 0.2, 3, '#3a3f46');
      box(x + 0.47, y + 0.47, 0.06, 0.06, 40, '#3a3f46', 3);
      box(x + 0.38, y + 0.38, 0.24, 0.24, 8, NIGHT > 0.3 ? '#ffe7a6' : '#fff6dd', 42, { edge: '#3a3f46' });
      pyramid(x + 0.35, y + 0.35, 0.3, 0.3, 50, 6, '#3a3f46');
      const p = up(c, 46 * z);
      if (NIGHT > 0.05) GLOWS.push({ x: p.x, y: p.y + 20 * z, r: 80 * z, a: NIGHT });
      break;
    }
    case 'bench': {
      legs(x + 0.15, y + 0.3, 0.7, 0.4, 7, '#3a3f46', 0.02);
      for (let i = 0; i < 3; i++) box(x + 0.15, y + 0.3 + i * 0.14, 0.7, 0.1, 1.5, WOOD, 7);
      for (let i = 0; i < 2; i++) box(x + 0.15, y + 0.26, 0.7, 0.05, 3, WOOD, 11 + i * 5);
      break;
    }
    case 'gnome': {
      local(c.x, c.y, z, 1, () => {
        ellipse(0, 0, 6, 2.6, 'rgba(0,0,0,.15)');
        rrect(-4, -11, 8, 11, 3, '#3e7cc9');
        pg([[-3.6, -11], [3.6, -11], [0, -2]], '#fff');
        circle(0, -13, 3.2, '#ffd9b8');
        pg([[-4, -14], [4, -14], [1.5, -24]], '#e5483b');
        circle(1, -12.8, 1.1, '#f2a0ad');
      });
      break;
    }
    case 'bbq': {
      [[0.3, 0.3], [0.7, 0.3], [0.5, 0.7]].forEach(([u, v]) => { const a = iso(x + u, y + v), b = up(c, 12 * z); line(a.x, a.y, b.x, b.y, '#333', 1.3 * z); });
      const p = up(c, 14 * z);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 11 * z, 6 * z, 0, 0, Math.PI); ctx.fillStyle = '#2d2d2d'; ctx.fill();
      ellipse(p.x, p.y, 11 * z, 4.5 * z, '#444');
      ellipse(p.x, p.y, 9 * z, 3.4 * z, '#e8742c');
      for (let i = 0; i < 3; i++) {
        const ph = (ts / 1800 + i / 3) % 1;
        circle(p.x + Math.sin(ph * 6 + i) * 3 * z, p.y - (4 + ph * 26) * z, (2 + ph * 4) * z, `rgba(220,220,220,${0.55 * (1 - ph)})`);
      }
      break;
    }
    case 'swing': {
      const [w, d] = it.rot ? [1, 2] : [2, 1];
      const ends = it.rot ? [[x + 0.5, y + 0.05], [x + 0.5, y + d - 0.05]] : [[x + 0.05, y + 0.5], [x + w - 0.05, y + 0.5]];
      const tops = ends.map(([ex, ey]) => up(iso(ex, ey), 40 * z));
      ends.forEach(([ex, ey], i) => {
        const o = it.rot ? [0.3, 0] : [0, 0.3];
        const a = iso(ex - o[0], ey - o[1]), b = iso(ex + o[0], ey + o[1]);
        line(a.x, a.y, tops[i].x, tops[i].y, DARKWOOD, 2 * z); line(b.x, b.y, tops[i].x, tops[i].y, DARKWOOD, 2 * z);
      });
      line(tops[0].x, tops[0].y, tops[1].x, tops[1].y, DARKWOOD, 2.2 * z);
      const sw = Math.sin(ts / 650) * 0.28, mx = (ends[0][0] + ends[1][0]) / 2, my = (ends[0][1] + ends[1][1]) / 2;
      const sx = it.rot ? mx + sw : mx, sy = it.rot ? my : my + sw;
      const seatH = 10 + Math.abs(sw) * 10;
      const s1 = up(iso(it.rot ? sx : sx - 0.18, it.rot ? sy - 0.18 : sy), seatH * z), s2 = up(iso(it.rot ? sx : sx + 0.18, it.rot ? sy + 0.18 : sy), seatH * z);
      const t1 = up(iso(it.rot ? mx : mx - 0.18, it.rot ? my - 0.18 : my), 40 * z), t2 = up(iso(it.rot ? mx : mx + 0.18, it.rot ? my + 0.18 : my), 40 * z);
      line(t1.x, t1.y, s1.x, s1.y, '#777', 0.8 * z); line(t2.x, t2.y, s2.x, s2.y, '#777', 0.8 * z);
      line(s1.x, s1.y, s2.x, s2.y, '#e5675f', 3 * z);
      break;
    }
    case 'fountain': {
      const cc = iso(x + 1, y + 1);
      ellipse(cc.x, cc.y, 54 * z, 27 * z, '#c9c2b4');
      ellipse(cc.x, cc.y - 5 * z, 52 * z, 26 * z, '#e6dccb');
      ellipse(cc.x, cc.y - 5 * z, 44 * z, 21 * z, '#6cc0e4');
      const r = (ts / 1200) % 1;
      ellipse(cc.x, cc.y - 5 * z, 44 * z * r, 21 * z * r, null, `rgba(255,255,255,${0.6 * (1 - r)})`, 1.2 * z);
      box(x + 0.85, y + 0.85, 0.3, 0.3, 24, '#d9d1c2');
      ellipse(cc.x, cc.y - 27 * z, 15 * z, 7 * z, '#e6dccb');
      ellipse(cc.x, cc.y - 28 * z, 12 * z, 5.5 * z, '#6cc0e4');
      for (let i = 0; i < 10; i++) {
        const ph = (ts / 1000 + i / 10) % 1, a = i / 10 * Math.PI * 2;
        const dx = Math.cos(a) * 26 * z * ph, dy = Math.sin(a) * 13 * z * ph;
        circle(cc.x + dx, cc.y - 30 * z + dy - Math.sin(ph * Math.PI) * 14 * z + ph * 22 * z, 1.5 * z, 'rgba(210,240,255,.9)');
      }
      break;
    }
    case 'pool': {
      const [w, d] = it.rot ? [2, 3] : [3, 2];
      flatRect(x + 0.05, y + 0.05, w - 0.1, d - 0.1, '#f1ece2', 'rgba(0,0,0,.1)', 1);
      const ix = x + 0.25, iy = y + 0.25, iw = w - 0.5, id = d - 0.5;
      poly([iso(ix, iy), iso(ix + iw, iy), up(iso(ix + iw, iy), -8 * z), up(iso(ix, iy), -8 * z)], '#3d9cc7');
      poly([iso(ix, iy), iso(ix, iy + id), up(iso(ix, iy + id), -8 * z), up(iso(ix, iy), -8 * z)], '#348bb3');
      flatRect(ix, iy, iw, id, 'rgba(92,195,232,.85)', null, 0.5);
      for (let i = 0; i < 4; i++) {
        const u = (ts / 3000 + i / 4) % 1, a = iso(ix + 0.2, iy + u * id), b = iso(ix + iw - 0.2, iy + u * id);
        line(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2 - 1, 'rgba(255,255,255,.45)', 1 * z);
      }
      const rb = Math.sin(ts / 700) * 1.5 * z, rp = iso(ix + iw * 0.6, iy + id * 0.5);
      ellipse(rp.x, rp.y + rb, 9 * z, 4.5 * z, '#ef6f6c'); ellipse(rp.x, rp.y + rb, 4.5 * z, 2.2 * z, 'rgba(92,195,232,1)');
      const l1 = iso(ix + iw - 0.05, iy + 0.3), l2 = iso(ix + iw - 0.05, iy + 0.55);
      [l1, l2].forEach(p => line(p.x, p.y, p.x, p.y - 10 * z, '#d9d9d9', 1.4 * z));
      break;
    }
    default: drawYard2(it, x, y, ts);
  }
}

// ---------- town centre shops ----------
const SHOP_LOOK = {
  bakery:  { e: '🥐', wall: '#f6e2c4', awn: '#e5675f', zh: '面包店', en: 'Bakery' },
  cafe:    { e: '☕', wall: '#eadcc8', awn: '#4f8a5a', zh: '咖啡馆', en: 'Café' },
  market:  { e: '🛒', wall: '#f1f0ea', awn: '#3e7cc9', zh: '超市', en: 'Market' },
  gym:     { e: '🏋️', wall: '#e0e5eb', awn: '#ef7d3c', zh: '健身房', en: 'Gym' },
  library: { e: '📚', wall: '#efe3cf', awn: '#8a5a36', zh: '图书馆', en: 'Library' },
  post:    { e: '📮', wall: '#f3ead8', awn: '#2f6fb2', zh: '邮局', en: 'Post office' },
  clinic:  { e: '🏥', wall: '#f4f6f8', awn: '#e5484d', zh: '诊所', en: 'Clinic' },
  // v0.37
  bookstore: { e: '📖', wall: '#e9dcc4', awn: '#2f5d50', zh: '书店', en: 'Bookshop' },
  salon:     { e: '💈', wall: '#f7eef2', awn: '#2d2d2d', zh: '理发店', en: 'Hair salon', pole: true },
  florist:   { e: '💐', wall: '#f3f7ee', awn: '#ec6aa8', zh: '花店', en: 'Florist', flowers: true },
};
// A little shop facing +y: shop window, door, striped awning, a sign on the roof. Returns its tap box.
function drawShop(k, x, y, ts, w = 6, d = 5.5) {
  if (TOWER_STOREYS[k]) return drawTower(k, x, y, w, d, ts);   // v0.37
  const L = SHOP_LOOK[k], z = cam.z, wh = 34;
  const c = iso(x + w / 2, y + d / 2);
  ellipse(c.x, c.y + 6 * z, 100 * z, 50 * z, 'rgba(0,0,0,.07)');
  const b = box(x, y, w, d, wh, L.wall);
  wallRect(b.left, 0, 0, 1, 0, 3, shade(L.wall, -0.3)); wallRect(b.right, 0, 0, 1, 0, 3, shade(L.wall, -0.25));
  wallRect(b.left, 0, 0.08, 0.62, 5, 21, NIGHT > 0.3 ? '#ffe39a' : '#a9dcf5', '#fffaf0', 1.4);
  wallLine(b.left, 0, 0.35, 5, 0.35, 21, '#fffaf0', 1);
  if (NIGHT > 0.3) { const p = wallPt(b.left, 0, 0.35, 13); glow(p.x, p.y, 50 * z, 0.9); }
  doorFace(b.left, 0.8, 0.07, 19, shade(L.awn, -0.25));
  for (let i = 0; i < 10; i++) wallRect(b.left, 0, i / 10, (i + 1) / 10, 23, 28, i % 2 ? '#fffaf0' : L.awn);
  [0.3, 0.7].forEach(u => winFace(b.right, u, 0.09, 10, 24));
  box(x - 0.1, y - 0.1, w + 0.2, d + 0.2, 3, shade(L.wall, -0.12), wh);
  if (L.pole) { const q = wallPt(b.left, 0, 0.97, 8), st = (ts / 300) % 6; rrect(q.x - 2 * z, q.y - 16 * z, 4 * z, 16 * z, 2 * z, '#ffffff', '#9aa3ad', 0.6 * z); for (let k2 = 0; k2 < 4; k2++) { const yy = q.y - 16 * z + ((k2 * 4 + st) % 16) * z; line(q.x - 2 * z, yy, q.x + 2 * z, yy + 2 * z, k2 % 2 ? '#e5484d' : '#2f6fb2', 1.2 * z); } }   // v0.37: the barber's pole turns
  if (L.flowers) for (let k2 = 0; k2 < 4; k2++) { const q = iso(x + 0.6 + k2 * 0.7, y + d + 0.35); ellipse(q.x, q.y - 2 * z, 4 * z, 2 * z, '#8a5a36'); emoji(['🌷', '🌻', '🌹', '💐'][k2], q.x, q.y - 3 * z, 8 * z); }   // buckets of flowers outside
  const s = up(iso(x + w / 2, y + d / 2), (wh + 5) * z);
  if (z > 0.12) pill(`${L.e} ${nm(L)}`, s.x, s.y, '#fffdf8', '#3b3125', `800 ${Math.max(9, 12 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 22 * z));
  return { x0: iso(x, y + d).x, x1: iso(x + w, y).x, y0: s.y - 24 * z, y1: iso(x + w, y + d).y };
}
// v0.37: the towers of the town centre (TOWER_STOREYS high): a glass office tower with the bank on the ground floor
// and a restaurant at the top, a hotel with a pool on its roof, and an apartment block with balconies. Windows light
// up at night (some of them). Returns the tap box.
function drawTower(k, x, y, w, d, ts) {
  const z = cam.z, n = TOWER_STOREYS[k] || 10, fh = k === 'apartments' ? 13 : 14, gh = 20, wh = gh + n * fh, c = iso(x + w / 2, y + d / 2), night = NIGHT > 0.3;
  const lit = (i, j) => night && hash(i * 7 + j, k.length) > 0.45;
  ellipse(c.x, c.y + 8 * z, (w + d) * 11 * z, (w + d) * 5.5 * z, 'rgba(0,0,0,.09)');
  const look = k === 'tower' ? { wall: '#9fb6c9', frame: '#5b6c7d', glass: '#bfe1f2', ground: '#3b4b5c' }
    : k === 'hotel' ? { wall: '#efe2cc', frame: '#b08d57', glass: '#a9cfe6', ground: '#8a5a36' }
    : { wall: '#d98e6b', frame: '#9a5a3c', glass: '#cfe6f2', ground: '#7a4a32' };
  const b = box(x, y, w, d, wh, look.wall, 0, { top: shade(look.wall, 0.12) });
  // the ground floor: a lobby with big glass doors
  [b.left, b.right].forEach((F, fi) => {
    wallRect(F, 0, 0, 1, 0, gh, look.ground);
    wallRect(F, 0, 0.06, 0.94, 2, gh - 3, night ? '#ffe39a' : look.glass, shade(look.ground, 0.25), 1);
    if (fi === 0) { doorFace(F, 0.5, 0.12, gh - 4, '#2d2d34'); if (k === 'tower') [0.18, 0.82].forEach(u => wallRect(F, 0, u - 0.03, u + 0.03, 0, gh, '#e8ecf0')); }
  });
  // the storeys: glass curtain wall (the office tower) or rows of windows (the others), balconies on the apartments
  const cols = Math.max(3, Math.round(w * 1.1));
  for (let i = 0; i < n; i++) {
    const h0 = gh + i * fh;
    [b.left, b.right].forEach((F, fi) => {
      if (k === 'tower') {
        wallRect(F, 0, 0.02, 0.98, h0 + 1.5, h0 + fh - 1.5, lit(i, fi) ? '#ffe7a8' : shade(look.glass, (i % 3) * -0.04), null);
        wallLine(F, 0, 0, h0, 1, h0, look.frame, 1);
        if (z > 0.22) for (let j = 1; j < cols; j++) wallLine(F, 0, j / cols, h0, j / cols, h0 + fh, 'rgba(91,108,125,.55)', 0.7);
      } else {
        for (let j = 0; j < cols; j++) {
          const u0 = (j + 0.2) / cols, u1 = (j + 0.8) / cols;
          wallRect(F, 0, u0, u1, h0 + 3, h0 + fh - 2, lit(i * cols + j, fi) ? '#ffe7a8' : look.glass, '#ffffff', 0.6);
          if (k === 'apartments' && z > 0.2 && (i + j) % 2 === 0) { wallRect(F, 0, u0 - 0.02, u1 + 0.02, h0 + 1, h0 + 4, '#f4efe6'); if (hash(i, j) > 0.7) { const q = wallPt(F, 0, (u0 + u1) / 2, h0 + 6); emoji('🪴', q.x, q.y, 5 * z); } }
        }
      }
    });
  }
  // the roof: a parapet, and on top something different for each
  box(x - 0.1, y - 0.1, w + 0.2, d + 0.2, 3, shade(look.wall, -0.15), wh);
  const roof = (u, v, h = 0) => up(iso(x + u * w, y + v * d), (wh + 3 + h) * z);
  if (k === 'tower') {
    box(x + w * 0.3, y + d * 0.3, w * 0.4, d * 0.4, 12, '#8796a6', wh + 3);
    const a = roof(0.5, 0.5, 12), b2 = roof(0.5, 0.5, 42); line(a.x, a.y, b2.x, b2.y, '#9aa3ad', 1.4 * z); circle(b2.x, b2.y, 2 * z, Math.floor(ts / 700) % 2 ? '#ff4d4d' : '#8a2020');
    const s0 = wallPt(b.left, 0, 0.5, wh - fh * 0.5); if (z > 0.18) { rrect(s0.x - 16 * z, s0.y - 4 * z, 32 * z, 8 * z, 2 * z, 'rgba(255,255,255,.85)'); emoji('🍽️', s0.x, s0.y + 3 * z, 6 * z); }
  } else if (k === 'hotel') {   // a pool on the roof, with sunshades
    const p0 = roof(0.15, 0.2), p1 = roof(0.85, 0.2), p2 = roof(0.85, 0.75), p3 = roof(0.15, 0.75);
    poly([p0, p1, p2, p3], '#5cc6e8', '#ffffff', 1.2 * z);
    for (let k2 = 0; k2 < 3; k2++) { const u = ((ts / 2600 + k2 / 3) % 1); const q = roof(0.2 + u * 0.6, 0.3 + k2 * 0.15); ellipse(q.x, q.y, 4 * z, 1.2 * z, 'rgba(255,255,255,.6)'); }
    [[0.1, 0.9], [0.9, 0.9]].forEach(([u, v]) => { const q = roof(u, v), t2 = up(q, 12 * z); line(q.x, q.y, t2.x, t2.y, '#ddd', 1 * z); ellipse(t2.x, t2.y, 7 * z, 2.6 * z, '#f59e0b'); });
    const s0 = wallPt(b.left, 0, 0.5, wh - 6); if (z > 0.15) { rrect(s0.x - 15 * z, s0.y - 4.5 * z, 30 * z, 9 * z, 2 * z, '#2d2d2d'); ctx.fillStyle = '#ffd36b'; ctx.font = `800 ${6 * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('HOTEL', s0.x, s0.y + 0.3 * z); }
  } else {   // the apartments: water tank and a little garden on the roof
    box(x + w * 0.6, y + d * 0.15, w * 0.25, d * 0.25, 10, '#8a5a36', wh + 3); box(x + w * 0.58, y + d * 0.13, w * 0.29, d * 0.29, 3, '#6b4428', wh + 13);
    [[0.25, 0.6], [0.4, 0.75]].forEach(([u, v]) => { const q = roof(u, v); circle(q.x, q.y - 4 * z, 4.5 * z, '#6cbf73'); });
  }
  const s = up(c, (wh + (k === 'tower' ? 48 : 22)) * z);
  if (z > 0.1) pill(`${PLACE_INFO[k].e} ${nm(PLACE_INFO[k])}`, s.x, s.y, '#fffdf8', '#3b3125', `800 ${Math.max(9, 12 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 22 * z));
  return { x0: iso(x, y + d).x, x1: iso(x + w, y).x, y0: s.y - 24 * z, y1: iso(x + w, y + d).y };
}
// A house seen from far away: walls and a roof in its colours, as many storeys tall as it has. Returns its top.
function drawHouseFar(h, ox, oy) {
  const H = HOUSES[h.house], [fx, fy, w, d] = H.fp, x = ox + fx, y = oy + fy, z = cam.z;
  const wh = H.id === 'tent' ? 0 : 12 + floorsOf(h) * 22 + (H.id === 'castle' ? 18 : 0);
  if (wh) box(x, y, w, d, wh, H.id === 'castle' ? '#bfb8ac' : h.wall, 0, { edge: null });
  hipRoof(x - 0.15, y - 0.15, w + 0.3, d + 0.3, wh, H.id === 'tent' ? 40 : 22, H.id === 'chinese' ? '#7a8796' : h.roof);
  return iso(x + w / 2, y + d / 2).y - (wh + 28) * z;
}

// ---------- town plaza ----------
function plazaGround(ox, oy) {
  for (let j = 0; j < LOT_D; j++) for (let i = 0; i < LOT_W; i++) tile(ox + i, oy + j, (i + j) % 2 ? '#e7dfd0' : '#ded5c4', 'rgba(255,255,255,.35)');
}
function drawTownHall(x, y, lv, ts) {
  const z = cam.z, wall = '#f6efe2', roof = '#7a8aa6';
  const w = lv >= 4 ? 6 : lv >= 2 ? 5 : 4, d = lv >= 4 ? 4 : 3, h = lv >= 4 ? 56 : lv >= 2 ? 44 : 30;
  const hx = x + (7 - w / 2) - 0.5, hy = y + 1;
  const b = box(hx, hy, w, d, h, wall);
  wallRect(b.left, 0, 0, 1, 0, 4, '#c9c2b4');
  const n = w + 1;
  for (let i = 1; i < n; i++) { const u = i / n; if (Math.abs(u - 0.5) < 0.08) continue; winFace(b.left, u, 0.04, 10, 24); if (h > 40) winFace(b.left, u, 0.04, 32, h - 8); }
  doorFace(b.left, 0.5, 0.07, 22, '#5a3a22');
  [0.3, 0.7].forEach(u => winFace(b.right, u, 0.08, 10, 24));
  hipRoof(hx - 0.15, hy - 0.15, w + 0.3, d + 0.3, h, 26, roof);
  let top = iso(hx, hy).y - (h + 26) * z;
  if (lv >= 4) {
    const tx = hx + w / 2 - 0.5, ty = hy + d / 2 - 0.5;
    const t = box(tx, ty, 1, 1, 40, wall, h + 10);
    const cp = wallPt(t.left, h + 10, 0.5, 24);
    circle(cp.x, cp.y, 6 * z, '#fff', '#555', 1 * z);
    const a = (ts / 60000) * Math.PI * 2;
    line(cp.x, cp.y, cp.x + Math.sin(a) * 4 * z, cp.y - Math.cos(a) * 4 * z, '#333', 1 * z);
    line(cp.x, cp.y, cp.x + Math.sin(a / 12) * 3 * z, cp.y - Math.cos(a / 12) * 3 * z, '#333', 1.3 * z);
    const apex = pyramid(tx - 0.1, ty - 0.1, 1.2, 1.2, h + 50, 22, roof);
    top = apex.y;
  }
  // columns
  [-0.6, -0.2, 0.2, 0.6].forEach(dx => box(hx + w / 2 + dx - 0.05, hy + d + 0.1, 0.1, 0.1, Math.min(h, 34), '#fffaf0'));
  box(hx + w / 2 - 0.8, hy + d - 0.05, 1.6, 0.4, 3, '#fffaf0', Math.min(h, 34));
  // flag
  const fp = up(iso(hx + w + 0.6, hy + d + 0.6), 0);
  line(fp.x, fp.y, fp.x, fp.y - 60 * z, '#666', 1.4 * z);
  const fl = Math.sin(ts / 250) * 2 * z;
  pg([[fp.x, fp.y - 60 * z], [fp.x + 16 * z, fp.y - 56 * z + fl], [fp.x + 16 * z, fp.y - 49 * z + fl], [fp.x, fp.y - 52 * z]], '#ef7d3c');
  return { top, x0: iso(hx, hy + d).x, x1: iso(hx + w, hy).x, y1: iso(hx + w, hy + d).y };
}

// ---------- newer houses ----------
function drawModern(x, y, w, d, du, wall, roof, ts, n = 0) {
  const z = cam.z, glass = NIGHT > 0.3 ? '#ffe39a' : '#9fd3ee', dark = '#3d434c', slab = '#ecebe6';
  const b = box(x, y, w, d, 30, wall);
  wallRect(b.left, 0, 0, 1, 0, 3, dark); wallRect(b.right, 0, 0, 1, 0, 3, dark);
  wallRect(b.left, 0, 0.04, du - 0.09, 5, 26, glass, dark, 1.2);
  wallLine(b.left, 0, (0.04 + du - 0.09) / 2, 5, (0.04 + du - 0.09) / 2, 26, dark, 1);
  wallRect(b.left, 0, du + 0.09, 0.96, 5, 26, glass, dark, 1.2);
  [0.6, 0.78].forEach(u => wallLine(b.left, 0, u, 5, u, 26, dark, 1));
  doorFace(b.left, du, 0.06, 22, '#6b4a2e');
  wallRect(b.right, 0, 0.15, 0.85, 8, 24, glass, dark, 1.2);
  if (NIGHT > 0.3) { [0.2, 0.7].forEach(u => { const p = wallPt(b.left, 0, u, 16); glow(p.x, p.y, 40 * z, 0.8); }); }
  box(x - 0.15, y - 0.15, w + 0.3, d + 0.3, 3, slab, 30);
  // terrace railing in front of the upper floor
  box(x + 0.1, y + d - 0.35, 1.8, 0.05, 8, 'rgba(180,220,240,.5)', 33, { left: 'rgba(170,215,240,.45)', right: 'rgba(170,215,240,.45)', top: 'rgba(255,255,255,.5)', edge: 'rgba(255,255,255,.75)' });
  const pp = up(iso(x + 0.6, y + 1.2), 33 * z);
  rrect(pp.x - 4 * z, pp.y - 6 * z, 8 * z, 6 * z, 1.5 * z, '#c8754a'); circle(pp.x, pp.y - 10 * z, 5 * z, '#5fae55');
  // upper floors, set back, clad in wood (white render on every other storey you build)
  let lv = 33;
  for (let k = 0; k <= n; k++) {
    const clad = k % 2 ? '#ece6dc' : '#b9875a', ub = box(x + 2, y, w - 2, d - 1.2, 26, clad, lv);
    if (!(k % 2)) for (let j = 1; j < 12; j++) { wallLine(ub.left, lv, j / 12, 0, j / 12, 26, 'rgba(90,55,25,.25)', 0.7); wallLine(ub.right, lv, j / 12, 0, j / 12, 26, 'rgba(90,55,25,.25)', 0.7); }
    wallRect(ub.left, lv, k % 2 ? 0.38 : 0.08, k % 2 ? 0.92 : 0.62, 5, 22, glass, dark, 1.2);
    wallRect(ub.right, lv, 0.25, 0.75, 5, 22, glass, dark, 1.2);
    if (NIGHT > 0.3) { const p = wallPt(ub.left, lv, 0.4, 13); glow(p.x, p.y, 34 * z, 0.7); }
    box(x + 1.85, y - 0.12, w - 1.7, d - 0.9, 3, slab, lv + 26);
    lv += 29;
  }
  flatRect(x + 2.4, y + 0.3, 1.6, 1.3, '#2f4b7c', '#9fb4d6', lv + 0.5, 0.8);   // solar panels
  flatRect(x + 4.2, y + 0.3, 1.2, 1.3, '#2f4b7c', '#9fb4d6', lv + 0.5, 0.8);
  return iso(x + 2, y).y - (lv + 2) * z;
}
function latticeWin(face, base, u, uw, h0, h1, red) {
  const lit = NIGHT > 0.3;
  wallRect(face, base, u - uw, u + uw, h0, h1, red);
  wallRect(face, base, u - uw * 0.8, u + uw * 0.8, h0 + 1.5, h1 - 1.5, lit ? '#ffd98a' : '#f6ead0');
  for (let k = 1; k < 4; k++) wallLine(face, base, u - uw * 0.8 + k * uw * 0.4, h0 + 1.5, u - uw * 0.8 + k * uw * 0.4, h1 - 1.5, red, 0.6);
  for (let k = 1; k < 3; k++) wallLine(face, base, u - uw * 0.8, h0 + 1.5 + k * (h1 - h0 - 3) / 3, u + uw * 0.8, h0 + 1.5 + k * (h1 - h0 - 3) / 3, red, 0.6);
  if (lit) { const p = wallPt(face, base, u, (h0 + h1) / 2); glow(p.x, p.y, 26 * cam.z, 0.7); }
}
// Built storeys on the courtyard house become pagoda tiers, each with its own eaves.
function drawChinese(x, y, w, d, du, wall, ts, n = 0) {
  const z = cam.z, red = '#b8322a', tileCol = '#7a8796', wh = 36, base = 4;
  box(x - 0.25, y - 0.25, w + 0.5, d + 0.75, base, '#aaa49a');
  const b = box(x, y, w, d, wh, wall, base);
  wallRect(b.left, base, 0, 1, 0, 4, '#8e8a84'); wallRect(b.right, base, 0, 1, 0, 4, '#8e8a84');
  [0.15, 0.8].forEach(u => latticeWin(b.left, base, u, 0.075, 9, 24, red));
  [0.3, 0.7].forEach(u => latticeWin(b.right, base, u, 0.1, 9, 24, red));
  wallRect(b.left, base, du - 0.1, du + 0.1, 0, 22, red, '#7a1f19', 1);
  wallLine(b.left, base, du, 0, du, 22, '#7a1f19', 1);
  [du - 0.025, du + 0.025].forEach(u => { const p = wallPt(b.left, base, u, 11); circle(p.x, p.y, 1.3 * z, '#f2c230'); });
  wallRect(b.left, base, du - 0.08, du + 0.08, 24, 28.5, '#2d2d2d');
  wallRect(b.left, base, du - 0.06, du + 0.06, 25, 27.5, '#d4a82a');
  for (let i = 0; i <= 4; i++) box(x + 0.1 + i * (w - 0.34) / 4, y + d + 0.28, 0.14, 0.14, wh, red, base);
  hipRoof(x - 0.3, y - 0.3, w + 0.6, d + 0.9, wh + base, 24, tileCol);
  const eave = (px, py, dir) => {
    const p = up(iso(px, py), (wh + base) * z);
    ctx.beginPath(); ctx.moveTo(p.x - dir * 9 * z, p.y + 2 * z); ctx.quadraticCurveTo(p.x, p.y + 2 * z, p.x + dir * 3 * z, p.y - 8 * z);
    ctx.lineWidth = 3 * z; ctx.lineCap = 'round'; ctx.strokeStyle = shade(tileCol, -0.25); ctx.stroke();
  };
  eave(x - 0.3, y + d + 0.6, -1); eave(x + w + 0.3, y + d + 0.6, 1); eave(x + w + 0.3, y - 0.3, 1);
  let roofTop = wh + base + 24;
  for (let k = 1; k <= n; k++) {
    const ix = x + 0.7 * k, iy = y + 0.45 * k, iw = w - 1.4 * k, idd = d - 0.9 * k, tb = wh + base + 8 + (k - 1) * 38;
    const t = box(ix, iy, iw, idd, 26, wall, tb);
    [0.25, 0.75].forEach(u => latticeWin(t.left, tb, u, 0.1, 6, 20, red));
    latticeWin(t.right, tb, 0.5, 0.16, 6, 20, red);
    for (let i = 0; i <= 3; i++) box(ix + 0.05 + i * (iw - 0.2) / 3, iy + idd + 0.15, 0.1, 0.1, 26, red, tb);
    hipRoof(ix - 0.3, iy - 0.3, iw + 0.6, idd + 0.75, tb + 26, 18, tileCol);
    const ev = (px, py, dir) => {
      const p = up(iso(px, py), (tb + 26) * z);
      ctx.beginPath(); ctx.moveTo(p.x - dir * 7 * z, p.y + 2 * z); ctx.quadraticCurveTo(p.x, p.y + 2 * z, p.x + dir * 3 * z, p.y - 7 * z);
      ctx.lineWidth = 2.6 * z; ctx.lineCap = 'round'; ctx.strokeStyle = shade(tileCol, -0.25); ctx.stroke();
    };
    ev(ix - 0.3, iy + idd + 0.45, -1); ev(ix + iw + 0.3, iy + idd + 0.45, 1);
    roofTop = tb + 26 + 18;
  }
  [0.12, 0.88].forEach(u => {
    const p = up(iso(x + u * w, y + d + 0.45), (wh - 2) * z);
    line(p.x, p.y - 5 * z, p.x, p.y, '#555', 0.6 * z);
    ellipse(p.x, p.y + 4 * z, 3.6 * z, 4.6 * z, '#e0352b');
    rrect(p.x - 2 * z, p.y - 0.4 * z, 4 * z, 1.4 * z, 0.4 * z, '#f2c230'); rrect(p.x - 2 * z, p.y + 7.8 * z, 4 * z, 1.4 * z, 0.4 * z, '#f2c230');
    line(p.x, p.y + 9 * z, p.x, p.y + 13 * z, '#f2c230', 0.8 * z);
    glow(p.x, p.y + 4 * z, 30 * z, 1);
  });
  return iso(x + w / 2, y).y - (roofTop + 6) * z;
}
// Battlements: back edges first (before anything on the roof), front edges last.
function merlons(x, y, w, d, h, col, front) {
  const n = Math.max(2, Math.round(w * 2)), m = Math.max(2, Math.round(d * 2));
  if (!front) {
    for (let i = 0; i < n; i += 2) box(x + i * w / n, y, w / n, 0.22, 5, col, h);
    for (let j = 2; j < m; j += 2) box(x, y + j * d / m, 0.22, d / m, 5, col, h);
  } else {
    for (let j = 0; j < m; j += 2) box(x + w - 0.22, y + j * d / m, 0.22, d / m, 5, col, h);
    for (let i = 0; i < n; i += 2) box(x + i * w / n, y + d - 0.22, w / n, 0.22, 5, col, h);
  }
}
function flag(p, col, ts, len = 12) {
  const z = cam.z;
  line(p.x, p.y, p.x, p.y - 16 * z, '#555', 1.2 * z);
  const fl = Math.sin(ts / 300 + p.x) * 2 * z;
  pg([[p.x, p.y - 16 * z], [p.x + len * z, p.y - 13 * z + fl], [p.x, p.y - 9 * z]], col);
}
function drawCastle(x, y, w, d, du, bannerCol, ts, n = 0) {
  const z = cam.z, stone = '#bfb8ac', ex = n * FLOOR_H, wh = 54 + ex;
  const b = box(x, y, w, d, wh, stone);
  for (let r = 1; r * 6 < wh; r++) { wallLine(b.left, 0, 0, r * 6, 1, r * 6, 'rgba(0,0,0,.08)', 0.7); wallLine(b.right, 0, 0, r * 6, 1, r * 6, 'rgba(0,0,0,.08)', 0.7); }
  const arch = [];
  for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI; arch.push(wallPt(b.left, 0, du + Math.cos(a) * 0.1, 22 + Math.sin(a) * 8)); }
  poly([wallPt(b.left, 0, du + 0.1, 0), ...arch, wallPt(b.left, 0, du - 0.1, 0)], '#5a3a22', '#8a8478', 1.5 * z);
  for (let k = 1; k < 5; k++) wallLine(b.left, 0, du - 0.1 + k * 0.04, 0, du - 0.1 + k * 0.04, 26, 'rgba(30,20,10,.5)', 0.8);
  [0.27, 0.6].forEach(u => { wallRect(b.left, 0, u - 0.035, u + 0.035, 24, 46, bannerCol); const p1 = wallPt(b.left, 0, u - 0.035, 24), p2 = wallPt(b.left, 0, u + 0.035, 24), p3 = wallPt(b.left, 0, u, 28); poly([p1, p2, p3], stone); });
  [0.3, 0.7].forEach(u => { winFace(b.right, u, 0.035, 14, 26); winFace(b.right, u, 0.035, 34, 46); });
  storyRows(b, 50, n, { left: [0.15, 0.45, 0.75], right: [0.3, 0.7], uw: 0.03, uwR: 0.035 });
  merlons(x, y, w, d, wh, stone, false);
  const kx = x + w / 2 - 0.8, ky = y + 0.4, kt = box(kx, ky, 1.6, 1.6, 34, stone, wh);
  winFace(kt.left, 0.5, 0.08, wh + 12, wh + 26);
  merlons(kx, ky, 1.6, 1.6, wh + 34, stone, false); merlons(kx, ky, 1.6, 1.6, wh + 34, stone, true);
  let top = up(iso(kx + 0.8, ky + 0.8), (wh + 39) * z);
  flag(top, bannerCol, ts, 14);
  merlons(x, y, w, d, wh, stone, true);
  [[x - 0.55, y + d - 1], [x + w - 0.95, y + d - 1]].forEach(([tx, ty]) => {
    const t = box(tx, ty, 1.5, 1.5, wh + 20, stone);
    for (let r = 1; r * 6 < wh + 20; r++) { wallLine(t.left, 0, 0, r * 6, 1, r * 6, 'rgba(0,0,0,.08)', 0.7); wallLine(t.right, 0, 0, r * 6, 1, r * 6, 'rgba(0,0,0,.08)', 0.7); }
    winFace(t.left, 0.5, 0.12, 36, 50); winFace(t.right, 0.5, 0.12, 36, 50);
    for (let k = 0; k < n; k++) { winFace(t.left, 0.5, 0.12, 64 + k * FLOOR_H, 78 + k * FLOOR_H); winFace(t.right, 0.5, 0.12, 64 + k * FLOOR_H, 78 + k * FLOOR_H); }
    merlons(tx, ty, 1.5, 1.5, wh + 20, stone, false);
    const apex = pyramid(tx - 0.12, ty - 0.12, 1.74, 1.74, wh + 22, 30, bannerCol);
    merlons(tx, ty, 1.5, 1.5, wh + 20, stone, true);
    flag(apex, '#ffd23f', ts);
    top = apex.y - 16 * z < top.y ? { x: apex.x, y: apex.y - 16 * z } : top;
  });
  return top.y;
}

// ---------- mailbox (every home has one by the gate) ----------
function drawMailbox(x, y, flagUp, ts) {
  const z = cam.z, c = iso(x + 0.5, y + 0.5);
  ellipse(c.x, c.y, 8 * z, 3.5 * z, 'rgba(0,0,0,.15)');
  box(x + 0.46, y + 0.46, 0.08, 0.08, 16, '#8a5a36');
  const b = box(x + 0.3, y + 0.36, 0.4, 0.28, 8, '#3e7cc9', 16);
  wallRect(b.left, 16, 0.2, 0.8, 2, 6, shade('#3e7cc9', -0.25));
  const p = up(iso(x + 0.7, y + 0.5), 24 * z), wv = Math.sin(ts / 200) * (flagUp ? 1 : 0);
  if (flagUp) { line(p.x, p.y, p.x, p.y - 9 * z, '#555', 1 * z); rrect(p.x, p.y - 9 * z + wv * z, 6 * z, 3.5 * z, 0.5 * z, '#e5484d'); }
  else { line(p.x, p.y, p.x + 7 * z, p.y - 1 * z, '#555', 1 * z); rrect(p.x + 4 * z, p.y - 2 * z, 4 * z, 3 * z, 0.5 * z, '#e5484d'); }
  return { x0: c.x - 12 * z, x1: c.x + 12 * z, y0: c.y - 36 * z, y1: c.y + 4 * z };
}

// ---------- more furniture ----------
function drawFurn2(it, x, y, w, d, rot, tint, ts) {
  const z = cam.z, F = b => (rot ? b.right : b.left);
  const strip = (t, inset = 0.06) => (rot ? [x + inset, y + inset, t, d - inset * 2] : [x + inset, y + inset, w - inset * 2, t]);
  const P = (u, v, h) => up(iso(x + u, y + v), h * z);
  switch (it.k) {
    case 'nightstand': {
      const b = box(x + 0.22, y + 0.22, 0.56, 0.56, 14, WOOD);
      wallLine(F(b), 0, 0.08, 7, 0.92, 7, DARKWOOD, 0.8);
      const k = wallPt(F(b), 0, 0.5, 10.5); circle(k.x, k.y, 1 * z, '#f2c230');
      const p = P(0.5, 0.5, 14);
      line(p.x, p.y, p.x, p.y - 7 * z, '#888', 1 * z);
      pg([[p.x - 4 * z, p.y - 6 * z], [p.x + 4 * z, p.y - 6 * z], [p.x + 2.6 * z, p.y - 12 * z], [p.x - 2.6 * z, p.y - 12 * z]], '#fff3d6');
      GLOWS.push({ x: p.x, y: p.y - 9 * z, r: 30 * z, a: 0.25 + NIGHT * 0.45 });
      break;
    }
    case 'wardrobe': {
      const s = strip(0.6), b = box(s[0], s[1], s[2], s[3], 50, '#a8754a'), f = F(b);
      wallLine(f, 0, 0.5, 3, 0.5, 48, DARKWOOD, 1);
      [0.44, 0.56].forEach(u => { const p = wallPt(f, 0, u, 26); circle(p.x, p.y, 1.1 * z, '#f2c230'); });
      wallRect(f, 0, 0.02, 0.98, 0, 3, DARKWOOD);
      break;
    }
    case 'beanbag': {
      soft(x + 0.08, y + 0.08, 0.84, 0.84, 7, tint, 0, { round: 0.5, puff: 0.07 });
      soft(x + 0.1, y + 0.08, 0.55, 0.8, 7, shade(tint, 0.05), 5, { round: 0.5, puff: 0.04 });
      break;
    }
    case 'rocker': {
      const rk = Math.sin(ts / 800) * 1.5;
      [0.25, 0.75].forEach(u => { const a = rot ? P(0.15, u, 0) : P(u, 0.15, 0), b = rot ? P(0.85, u, 0) : P(u, 0.85, 0), m = rot ? P(0.5, u, -2) : P(u, 0.5, -2); ctx.beginPath(); ctx.moveTo(a.x, a.y - rk * z); ctx.quadraticCurveTo(m.x, m.y + 3 * z, b.x, b.y + rk * z); ctx.strokeStyle = DARKWOOD; ctx.lineWidth = 1.6 * z; ctx.stroke(); });
      legs(x + 0.25, y + 0.25, 0.5, 0.5, 9, DARKWOOD, 0.02);
      box(x + 0.25, y + 0.25, 0.5, 0.5, 2, WOOD, 9 + rk * 0.3);
      if (rot) box(x + 0.22, y + 0.25, 0.07, 0.5, 20, WOOD, 10); else box(x + 0.25, y + 0.22, 0.5, 0.07, 20, WOOD, 10);
      break;
    }
    case 'coffeetable': {
      legs(x + 0.2, y + 0.2, w - 0.4, d - 0.4, 7, DARKWOOD);
      box(x + 0.15, y + 0.15, w - 0.3, d - 0.3, 2.5, WOOD, 7);
      const p = P(w * 0.35, d * 0.5, 9.5), q = P(w * 0.65, d * 0.45, 9.5);
      pg([[p.x - 6 * z, p.y], [p.x, p.y - 3 * z], [p.x + 6 * z, p.y], [p.x, p.y + 3 * z]], '#5aa2e0');
      rrect(q.x - 2 * z, q.y - 5 * z, 4 * z, 5 * z, 1 * z, '#fff', '#ccc', 0.5 * z);
      break;
    }
    case 'monstera': {
      box(x + 0.3, y + 0.3, 0.4, 0.4, 11, '#e8e2d6');
      const p = P(0.5, 0.5, 11), sw = Math.sin(ts / 1400 + x) * 0.06;
      local(p.x, p.y, z, 1, () => {
        [[-2.3, 15], [-1.6, 18], [-0.9, 17], [-0.2, 15], [0.5, 13]].forEach(([a, len], i) => {
          ctx.save(); ctx.rotate(a - Math.PI / 2 + 1.3 + sw);
          ellipse(len * 0.55, 0, len * 0.5, len * 0.32, i % 2 ? '#2f7d4a' : '#3a9157');
          for (let k = 1; k < 4; k++) line(len * (0.25 + k * 0.18), -len * 0.3, len * (0.25 + k * 0.18), -len * 0.08, '#e9f2e0', 0.6);
          ctx.restore();
        });
      });
      break;
    }
    case 'kitchen': {
      const s = strip(0.75), b = box(s[0], s[1], s[2], s[3], 22, '#f1ede6'), f = F(b);
      flatRect(s[0] - 0.02, s[1] - 0.02, s[2] + 0.04, s[3] + 0.04, '#9a948a', null, 22);
      [0.25, 0.5, 0.75].forEach(u => wallLine(f, 0, u, 2, u, 20, '#d8d2c6', 0.8));
      [0.18, 0.43, 0.57, 0.82].forEach(u => { const p = wallPt(f, 0, u, 16); circle(p.x, p.y, 0.9 * z, '#888'); });
      const sk = rot ? [x + 0.15, y + 0.3, 0.45, 0.6] : [x + 0.3, y + 0.15, 0.6, 0.45];
      flatRect(sk[0], sk[1], sk[2], sk[3], '#b8c2cc', '#8a949e', 22.2, 0.8);
      const fp = P(rot ? 0.12 : 0.6, rot ? 0.6 : 0.12, 22);
      line(fp.x, fp.y, fp.x, fp.y - 8 * z, '#9aa3ad', 1.5 * z); line(fp.x, fp.y - 8 * z, fp.x + 3 * z, fp.y - 6 * z, '#9aa3ad', 1.5 * z);
      const pp = P(rot ? 0.4 : 1.5, rot ? 1.5 : 0.4, 22);
      ellipse(pp.x, pp.y - 2 * z, 4 * z, 2 * z, '#e5675f'); ellipse(pp.x, pp.y - 4 * z, 3 * z, 1.4 * z, '#6cbf4a');
      break;
    }
    case 'washer': {
      const b = box(x + 0.16, y + 0.16, 0.68, 0.68, 24, '#f4f5f7'), f = F(b);
      wallRect(f, 0, 0.1, 0.9, 19, 22.5, '#dfe3e8');
      const p = wallPt(f, 0, 0.5, 10);
      ellipse(p.x, p.y, 6 * z, 6.5 * z, '#c9d3dd'); ellipse(p.x, p.y, 4.6 * z, 5 * z, '#7fb7dd');
      const a = ts / 180;
      line(p.x + Math.cos(a) * 3 * z, p.y + Math.sin(a) * 3 * z, p.x - Math.cos(a) * 3 * z, p.y - Math.sin(a) * 3 * z, 'rgba(255,255,255,.7)', 1.4 * z);
      break;
    }
    case 'bathtub': {
      const s = strip(0.85), b = box(s[0], s[1], s[2], s[3], 13, '#fbfbfb'), f = F(b);
      flatRect(s[0] + 0.08, s[1] + 0.08, s[2] - 0.16, s[3] - 0.16, '#a9dcf2', null, 12.5);
      for (let k = 0; k < 6; k++) { const u = hash(k, 3), v = hash(k, 7), p = up(iso(s[0] + 0.15 + u * (s[2] - 0.3), s[1] + 0.15 + v * (s[3] - 0.3)), (13 + Math.sin(ts / 400 + k) * 0.6) * z); circle(p.x, p.y, (1.6 + hash(k, 9)) * z, 'rgba(255,255,255,.9)'); }
      [0.1, 0.9].forEach(u => { const p = wallPt(f, 0, u, 0); circle(p.x, p.y, 1.4 * z, '#d4a82a'); });
      const fp = P(rot ? 0.2 : 0.15, rot ? 0.15 : 0.2, 13);
      line(fp.x, fp.y, fp.x, fp.y - 8 * z, '#c0c6cc', 1.5 * z);
      break;
    }
    case 'spinbike': {
      const a = P(0.5, 0.25, 0), b = P(0.5, 0.75, 0), seat = P(0.5, 0.35, 20), bar = P(0.5, 0.72, 24), wheel = P(0.5, 0.75, 9);
      line(a.x - 5 * z, a.y, a.x + 5 * z, a.y, '#333', 2 * z); line(b.x - 5 * z, b.y, b.x + 5 * z, b.y, '#333', 2 * z);
      line(a.x, a.y, seat.x, seat.y, '#444', 2.2 * z); line(b.x, b.y, bar.x, bar.y, '#444', 2.2 * z); line(a.x, a.y - 4 * z, b.x, b.y - 6 * z, '#444', 2 * z);
      wheelOn(wheel.x, wheel.y, it.rot ? AXIS_X : AXIS_Y, 7 * z, '#bbb', '#555', 1 * z);
      ellipse(seat.x, seat.y - 1 * z, 4 * z, 1.8 * z, '#222');
      line(bar.x - 4 * z, bar.y, bar.x + 4 * z, bar.y - 1 * z, '#222', 1.6 * z);
      break;
    }
    case 'dumbbells': {
      const b = box(x + 0.15, y + 0.3, 0.7, 0.4, 12, '#555');
      [0.25, 0.5, 0.75].forEach((u, i) => { const p = P(0.15 + u * 0.7, 0.5, 12.5); rrect(p.x - 4 * z, p.y - 1 * z, 8 * z, 2 * z, 0.8 * z, '#777'); circle(p.x - 4 * z, p.y, (1.8 + i * 0.3) * z, '#2d2d2d'); circle(p.x + 4 * z, p.y, (1.8 + i * 0.3) * z, '#2d2d2d'); });
      break;
    }
    case 'boxing': {
      const base = P(0.2, 0.2, 0), topP = P(0.2, 0.2, 50), arm = P(0.55, 0.55, 50);
      line(base.x, base.y, topP.x, topP.y, '#444', 2.4 * z); line(topP.x, topP.y, arm.x, arm.y, '#444', 2 * z);
      ellipse(base.x, base.y, 7 * z, 3 * z, '#333');
      const sw = Math.sin(ts / 260) * 2 * z;
      line(arm.x, arm.y, arm.x + sw, arm.y + 8 * z, '#888', 0.8 * z);
      rrect(arm.x - 5 * z + sw, arm.y + 8 * z, 10 * z, 26 * z, 4 * z, '#d6303a');
      rrect(arm.x - 5 * z + sw, arm.y + 14 * z, 10 * z, 2 * z, 0, '#9e1f28');
      break;
    }
    case 'guitar': {
      const p = P(0.5, 0.5, 0);
      line(p.x - 5 * z, p.y, p.x, p.y - 8 * z, '#333', 1 * z); line(p.x + 5 * z, p.y, p.x, p.y - 8 * z, '#333', 1 * z);
      local(p.x, p.y - 10 * z, z, 1, () => {
        ctx.rotate(-0.2);
        circle(0, 0, 6, '#c27c3e'); circle(0, -7, 4.6, '#c27c3e'); circle(0, -2.5, 1.8, '#3a2412');
        line(0, -8, 0, -26, '#5a3a22', 2); rrect(-1.6, -30, 3.2, 5, 1, '#3a2412');
        for (let k = -1; k <= 1; k++) line(k * 0.6, 4, k * 0.6, -27, 'rgba(255,255,255,.6)', 0.25);
      });
      break;
    }
    case 'drums': {
      const c = P(0.5, 0.55, 0);
      local(c.x, c.y, z, 1, () => {
        ellipse(0, -9, 9, 9, '#e5484d'); ellipse(0, -9, 7, 7, '#fbfbf7'); ellipse(0, -9, 2, 2, '#e5484d');
        ellipse(-9, -15, 5, 2.4, '#ddd', '#888', 0.6); line(-9, -15, -9, 0, '#888', 0.8);
        ellipse(6, -20, 4, 2, '#e5484d'); ellipse(6, -21, 4, 1.6, '#eee');
        line(10, -28, 10, 0, '#888', 0.8); ellipse(10, -28, 7, 1.8, '#e2b13c');
      });
      break;
    }
    case 'record': {
      const b = box(x + 0.15, y + 0.2, 0.7, 0.6, 14, DARKWOOD);
      flatRect(x + 0.17, y + 0.22, 0.66, 0.56, '#3a3a3a', null, 14);
      const p = P(0.45, 0.5, 14.3), a = ts / 300;
      ellipse(p.x, p.y, 8 * z, 4 * z, '#111'); ellipse(p.x, p.y, 2.5 * z, 1.2 * z, '#e5484d');
      line(p.x + Math.cos(a) * 5 * z, p.y + Math.sin(a) * 2.5 * z, p.x + Math.cos(a) * 7 * z, p.y + Math.sin(a) * 3.5 * z, 'rgba(255,255,255,.4)', 0.8 * z);
      const q = P(0.75, 0.3, 14.3); line(q.x, q.y, p.x + 4 * z, p.y - 1 * z, '#ccc', 1 * z);
      const u = (ts / 1200) % 1;
      ctx.save(); ctx.globalAlpha = 1 - u; ctx.font = `${9 * z}px sans-serif`; ctx.fillStyle = '#6b5bd0'; ctx.fillText('♪', p.x + 6 * z, p.y - (10 + u * 16) * z); ctx.restore();
      break;
    }
    case 'easel': {
      const p = P(0.5, 0.55, 0);
      local(p.x, p.y, z, 1, () => {
        line(-6, 0, 0, -36, WOOD, 1.4); line(6, 0, 0, -36, WOOD, 1.4); line(0, -30, 2, 0, WOOD, 1.2);
        rrect(-9, -34, 18, 14, 1, '#fffaf0', '#8a5a36', 0.8);
        rrect(-8, -33, 16, 7, 0, '#a9dcf5'); ellipse(-2, -26, 10, 4, '#6cbf4a'); circle(5, -30, 2, '#f6d04d');
        line(-9, -20, 9, -20, WOOD, 1.2);
      });
      break;
    }
    case 'petbowl': {
      // a little mat with a food bowl (kibble) and a water bowl
      poly(softPts(x + 0.1, y + 0.24, 0.8, 0.52, 0.18, 0.3), '#efdcbc');
      [[0.32, 0.5, '#e5484d', '#a0672f'], [0.68, 0.5, '#4f8fd6', '#9fd8f2']].forEach(([u, v, bowl, fill], i) => {
        const c = iso(x + u, y + v);
        ellipse(c.x, c.y - 1.2 * z, 7 * z, 3.4 * z, shade(bowl, -0.2));
        ellipse(c.x, c.y - 3 * z, 7 * z, 3.4 * z, bowl);
        ellipse(c.x, c.y - 3.3 * z, 5.2 * z, 2.4 * z, fill);
        if (!i) for (let k = 0; k < 6; k++) circle(c.x + (hash(k, 1) - 0.5) * 7 * z, c.y - (3.6 + hash(k, 2) * 1.2) * z, 1.1 * z, k % 2 ? '#b97a3c' : '#8a5426');
        else ellipse(c.x - 1.6 * z, c.y - 3.8 * z, 1.8 * z, 0.7 * z, 'rgba(255,255,255,.7)');
      });
      break;
    }
    case 'litterbox': {
      const b = box(x + 0.14, y + 0.18, 0.72, 0.64, 6, '#8ac4e0');
      flatRect(x + 0.2, y + 0.24, 0.6, 0.52, '#eadfc6', null, 5.4);
      for (let k = 0; k < 7; k++) { const c = up(iso(x + 0.25 + hash(k, 4) * 0.5, y + 0.3 + hash(k, 5) * 0.4), 5.6 * z); circle(c.x, c.y, 0.8 * z, '#d6c8a8'); }
      wallRect(b.left, 0, 0.1, 0.9, 4.2, 5, shade('#8ac4e0', 0.2));
      const s1 = up(iso(x + 0.86, y + 0.3), 2 * z), s2 = up(iso(x + 0.95, y + 0.2), 14 * z);   // the scoop leaning on it
      line(s1.x, s1.y, s2.x, s2.y, '#f2a33a', 1.6 * z);
      break;
    }
    case 'petbed': {
      soft(x + 0.1, y + 0.1, 0.8, 0.8, 5, tint, 0, { round: 0.5, puff: 0.05 });
      soft(x + 0.24, y + 0.24, 0.52, 0.52, 2.5, shade(tint, 0.35), 3, { round: 0.5, puff: 0.03, shine: 0.3 });
      break;
    }
    case 'cattree': {
      const sisal = '#d9c39a', carpet = '#c9b8e0';
      box(x + 0.15, y + 0.15, 0.7, 0.7, 3, carpet);
      box(x + 0.45, y + 0.45, 0.12, 0.12, 42, sisal, 3);
      box(x + 0.2, y + 0.45, 0.12, 0.12, 22, sisal, 3);
      box(x + 0.12, y + 0.35, 0.45, 0.45, 3, carpet, 24);
      box(x + 0.35, y + 0.2, 0.5, 0.5, 3, carpet, 44);
      const p = P(0.6, 0.45, 47); ellipse(p.x, p.y, 5 * z, 2 * z, shade(carpet, -0.15));
      break;
    }
    case 'singlebed': case 'bunkbed': {
      const head = rot ? [x + 0.04, y + 0.06, 0.12, d - 0.12] : [x + 0.06, y + 0.04, w - 0.12, 0.12];
      const pillow = rot ? [x + 0.2, y + 0.2, 0.5, w - 0.4] : [x + 0.2, y + 0.2, w - 0.4, 0.5];
      const deck = (base) => {
        box(x + 0.08, y + 0.08, w - 0.16, d - 0.16, 7, WOOD, base);
        soft(x + 0.12, y + 0.12, w - 0.24, d - 0.24, 3, '#fbfbf7', base + 7, { round: 0.14, puff: 0.02, shine: 0.2 });
        soft(pillow[0], pillow[1], pillow[2], pillow[3], 3.6, '#ffffff', base + 9.6, { round: 0.42, seam: true });
        drawQuilt(it, base + 7, x, y);
      };
      if (it.k === 'bunkbed') {
        [[0.06, 0.06], [w - 0.16, 0.06], [0.06, d - 0.16], [w - 0.16, d - 0.16]].forEach(([u, v]) => box(x + u, y + v, 0.1, 0.1, 50, DARKWOOD));
        deck(4); deck(30);
        const s = rot ? frontFace(x, y, w, d, rot) : frontFace(x, y, w, d, rot);
        for (let k = 0; k < 4; k++) wallLine(s, 0, 0.78, 10 + k * 7, 0.96, 10 + k * 7, DARKWOOD, 1);
        wallLine(s, 0, 0.78, 4, 0.78, 38, DARKWOOD, 1.1); wallLine(s, 0, 0.96, 4, 0.96, 38, DARKWOOD, 1.1);
      } else {
        box(head[0], head[1], head[2], head[3], 24, DARKWOOD);
        deck(2);
      }
      break;
    }
    case 'tablelamp': case 'sidetable': {
      legs(x + 0.24, y + 0.24, 0.52, 0.52, 12, DARKWOOD, 0.02);
      box(x + 0.22, y + 0.22, 0.56, 0.56, 2.5, WOOD, 12);
      if (it.k === 'tablelamp') {
        const p = P(0.5, 0.5, 14.5);
        line(p.x, p.y, p.x, p.y - 8 * z, '#8a8f96', 1.1 * z);
        pg([[p.x - 5 * z, p.y - 7 * z], [p.x + 5 * z, p.y - 7 * z], [p.x + 3.2 * z, p.y - 14 * z], [p.x - 3.2 * z, p.y - 14 * z]], NIGHT > 0.3 ? '#ffe7a6' : '#fff1cf', '#e2cf9e', 0.6 * z);
        GLOWS.push({ x: p.x, y: p.y - 10 * z, r: 34 * z, a: 0.25 + NIGHT * 0.5 });
      } else {
        const p = P(0.42, 0.5, 14.5);
        rrect(p.x - 5 * z, p.y - 2.5 * z, 8 * z, 2.4 * z, 0.6 * z, '#4f8ef7'); rrect(p.x - 4.5 * z, p.y - 4.6 * z, 7 * z, 2.2 * z, 0.6 * z, '#ef6f6c');
        const q = P(0.7, 0.45, 14.5); rrect(q.x - 1.8 * z, q.y - 4 * z, 3.6 * z, 4 * z, 1 * z, '#fffaf0');
      }
      break;
    }
    case 'arclamp': {
      box(x + 0.15, y + 0.6, 0.26, 0.26, 3, '#3a3f46');
      const a = P(0.28, 0.73, 3), top = P(0.4, 0.55, 46), tip = P(0.72, 0.32, 34);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x - 2 * z, top.y - 6 * z, tip.x, tip.y - 4 * z);
      ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 1.6 * z; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(tip.x, tip.y, 5 * z, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#e8b94a'; ctx.fill();
      ellipse(tip.x, tip.y, 5 * z, 1.4 * z, NIGHT > 0.3 ? '#fff3c4' : '#fff8e0');
      GLOWS.push({ x: tip.x, y: tip.y + 12 * z, r: 50 * z, a: 0.3 + NIGHT * 0.6 });
      break;
    }
    case 'roundrug': {
      const ring = (r, col, h) => { const pts = []; for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; pts.push(up(iso(x + w / 2 + Math.cos(a) * r, y + d / 2 + Math.sin(a) * r), h * z)); } poly(pts, col); };
      ring(Math.min(w, d) / 2 - 0.06, tint, 0.4); ring(Math.min(w, d) / 2 - 0.3, shade(tint, 0.3), 0.5); ring(Math.min(w, d) / 2 - 0.55, tint, 0.6); ring(0.18, shade(tint, -0.2), 0.7);
      break;
    }
    case 'bigrug': {
      poly(softPts(x + 0.08, y + 0.08, w - 0.16, d - 0.16, 0.2, 0.4), tint);
      rugFringe(x, y, w, d, rot, tint);
      flatRect(x + 0.2, y + 0.2, w - 0.4, d - 0.4, null, shade(tint, 0.5), 0.5, 1.6 * z);
      const n = rot ? d : w;
      for (let k = 1; k < n * 2; k++) {
        const u = k / (n * 2);
        if (rot) flatRect(x + 0.3, y + 0.2 + (d - 0.4) * u - 0.04, w - 0.6, 0.08, shade(tint, k % 2 ? 0.2 : -0.12), null, 0.5);
        else flatRect(x + 0.2 + (w - 0.4) * u - 0.04, y + 0.3, 0.08, d - 0.6, shade(tint, k % 2 ? 0.2 : -0.12), null, 0.5);
      }
      break;
    }
    case 'roundtable': {
      box(x + 0.44, y + 0.44, 0.12, 0.12, 16, DARKWOOD);
      box(x + 0.32, y + 0.32, 0.36, 0.36, 1.5, DARKWOOD);
      const pts = []; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; pts.push(up(iso(x + 0.5 + Math.cos(a) * 0.42, y + 0.5 + Math.sin(a) * 0.42), 18 * z)); }
      const edge = pts.map(p => ({ x: p.x, y: p.y + 2.2 * z }));
      poly(edge, shade(WOOD, -0.2)); poly(pts, WOOD);
      const v = P(0.5, 0.5, 18); rrect(v.x - 2 * z, v.y - 7 * z, 4 * z, 7 * z, 1.5 * z, '#5aa2e0'); circle(v.x - 1.5 * z, v.y - 9 * z, 2.2 * z, '#ef6f6c'); circle(v.x + 1.8 * z, v.y - 9.5 * z, 2 * z, '#f3d36b');
      break;
    }
    case 'shoerack': {
      const s = strip(0.5), b = box(s[0], s[1], s[2], s[3], 22, WOOD), f = F(b);
      wallLine(f, 0, 0, 11, 1, 11, DARKWOOD, 0.8);
      [['#ef6f6c', 0.25, 13], ['#38a3e0', 0.7, 13], ['#f2d24b', 0.3, 2.5], ['#34b27b', 0.72, 2.5]].forEach(([col, u, h]) => {
        const p = wallPt(f, 0, u, h + 3);
        rrect(p.x - 6 * z, p.y - 2 * z, 12 * z, 5 * z, 2.5 * z, col); rrect(p.x - 6 * z, p.y + 2 * z, 12 * z, 1.6 * z, 0.8 * z, '#fff');
      });
      const tp = P(0.5, 0.35, 22); emoji('🏅', tp.x, tp.y + 2 * z, 10 * z);
      break;
    }
    case 'moonlamp': {
      box(x + 0.32, y + 0.32, 0.36, 0.36, 5, '#e8e1d4');
      const p = P(0.5, 0.5, 5);
      line(p.x, p.y, p.x, p.y - 8 * z, '#c9c1b2', 1.2 * z);
      const m = { x: p.x, y: p.y - 19 * z }, r = 10 * z;
      ctx.save();
      ctx.shadowColor = 'rgba(255,224,140,.9)'; ctx.shadowBlur = 10 + NIGHT * 14;
      ctx.beginPath(); ctx.arc(m.x, m.y, r * 0.72, Math.PI * 0.55, Math.PI * 1.95);
      ctx.lineWidth = r * 0.55; ctx.lineCap = 'round'; ctx.strokeStyle = '#ffe9a8'; ctx.stroke();
      ctx.restore();
      [[m.x + 9 * z, m.y + 4 * z], [m.x + 11 * z, m.y - 8 * z]].forEach(([sx, sy], i) => emoji('✦', sx, sy + 4 * z, (5 + i) * z));
      GLOWS.push({ x: m.x, y: m.y, r: 40 * z, a: 0.3 + NIGHT * 0.6 });
      break;
    }
    case 'medal': {
      const b = box(x + 0.25, y + 0.3, 0.5, 0.4, 16, '#f3eee4'), p = P(0.5, 0.5, 16);
      wallLine(F(b), 0, 0.1, 8, 0.9, 8, '#d9d0c0', 0.8);
      rrect(p.x - 9 * z, p.y - 26 * z, 18 * z, 22 * z, 2 * z, '#7a4f2e');
      rrect(p.x - 7 * z, p.y - 24 * z, 14 * z, 18 * z, 1.5 * z, '#fffaf0');
      pg([[p.x - 4 * z, p.y - 24 * z], [p.x, p.y - 16 * z], [p.x + 4 * z, p.y - 24 * z]], '#4f8ef7');
      circle(p.x, p.y - 13 * z, 4.5 * z, '#f2c230', '#c9971c', 0.8 * z);
      [['#fa114f', 2.6], ['#92e82a', 1.8], ['#1eeaef', 1.0]].forEach(([c, rr]) => ellipse(p.x, p.y - 13 * z, rr * z, rr * z, null, c, 0.6 * z));
      break;
    }
    case 'books': {
      const p = P(0.5, 0.55, 0);
      ellipse(p.x, p.y, 16 * z, 7 * z, '#c9765b');
      ellipse(p.x, p.y - 1 * z, 13 * z, 5.5 * z, '#e39a7e');
      ['#4f8ef7', '#ef6f6c', '#f2d24b', '#34b27b', '#a46ef0'].forEach((c, i) => {
        rrect(p.x - 9 * z + (i % 2) * 2 * z, p.y - 5 * z - i * 3.2 * z, 14 * z, 3 * z, 0.8 * z, c);
      });
      const lp = P(0.85, 0.25, 0);
      line(lp.x, lp.y, lp.x, lp.y - 30 * z, '#666', 1.2 * z);
      pg([[lp.x - 5 * z, lp.y - 30 * z], [lp.x + 5 * z, lp.y - 30 * z], [lp.x + 3 * z, lp.y - 37 * z], [lp.x - 3 * z, lp.y - 37 * z]], '#fff3d6');
      GLOWS.push({ x: lp.x, y: lp.y - 30 * z, r: 34 * z, a: 0.25 + NIGHT * 0.5 });
      emoji('☕', p.x + 12 * z, p.y + 2 * z, 8 * z);
      break;
    }
    case 'bonsai': {
      const b = box(x + 0.25, y + 0.25, 0.5, 0.5, 9, '#3d5a73'), p = P(0.5, 0.5, 9);
      wallLine(F(b), 0, 0, 7, 1, 7, '#2c4357', 0.8);
      ellipse(p.x, p.y, 10 * z, 4 * z, '#8a6a4a');
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(p.x - 6 * z, p.y - 8 * z, p.x + 2 * z, p.y - 14 * z);
      ctx.strokeStyle = '#6b4a2e'; ctx.lineWidth = 2.4 * z; ctx.lineCap = 'round'; ctx.stroke();
      [[-6, -14, 7], [4, -18, 6], [-1, -21, 5], [7, -12, 4.5]].forEach(([dx, dy, r]) => ellipse(p.x + dx * z, p.y + dy * z, r * z, r * 0.7 * z, ['#4e8f45', '#5fa652', '#6db35c', '#4e8f45'][Math.abs(dx) % 4]));
      [[-5, 1], [5, 1.5]].forEach(([dx, dy]) => ellipse(p.x + dx * z, p.y + dy * z, 1.6 * z, 1 * z, '#e8e1d4'));
      break;
    }
    case 'trophy': {
      const b = box(x + 0.28, y + 0.28, 0.44, 0.44, 14, '#5a3a22'), p = P(0.5, 0.5, 14);
      wallRect(F(b), 0, 0.2, 0.8, 5, 9, '#f2c230');
      rrect(p.x - 2 * z, p.y - 8 * z, 4 * z, 8 * z, 1 * z, '#d9a92a');
      ctx.beginPath(); ctx.moveTo(p.x - 9 * z, p.y - 24 * z); ctx.quadraticCurveTo(p.x - 8 * z, p.y - 7 * z, p.x, p.y - 7 * z); ctx.quadraticCurveTo(p.x + 8 * z, p.y - 7 * z, p.x + 9 * z, p.y - 24 * z); ctx.closePath();
      ctx.fillStyle = '#f2c230'; ctx.fill();
      ellipse(p.x, p.y - 24 * z, 9 * z, 2.6 * z, '#ffe27a');
      [-1, 1].forEach(s => { ctx.beginPath(); ctx.ellipse(p.x + s * 10 * z, p.y - 19 * z, 3.5 * z, 4.5 * z, 0, 0, Math.PI * 2); ctx.strokeStyle = '#d9a92a'; ctx.lineWidth = 1.6 * z; ctx.stroke(); });
      const sh = (Math.sin(ts / 600) + 1) / 2;
      circle(p.x - 4 * z, p.y - 18 * z, (1 + sh) * z, 'rgba(255,255,255,.85)');
      break;
    }
    case 'calendar': {
      const p = P(0.5, 0.45, 0);
      line(p.x - 6 * z, p.y, p.x - 2 * z, p.y - 26 * z, DARKWOOD, 1.4 * z); line(p.x + 6 * z, p.y, p.x + 2 * z, p.y - 26 * z, DARKWOOD, 1.4 * z);
      rrect(p.x - 10 * z, p.y - 36 * z, 20 * z, 22 * z, 2 * z, '#fffaf0', '#d9d0c0', 0.8 * z);
      rrect(p.x - 10 * z, p.y - 36 * z, 20 * z, 5 * z, 2 * z, '#ef6f6c');
      for (let i = 0; i < 7; i++) {
        const cx = p.x - 7.5 * z + (i % 4) * 5 * z, cy = p.y - 27 * z + Math.floor(i / 4) * 6 * z;
        line(cx - 1.3 * z, cy, cx - 0.2 * z, cy + 1.3 * z, '#34b27b', 1 * z); line(cx - 0.2 * z, cy + 1.3 * z, cx + 1.6 * z, cy - 1.4 * z, '#34b27b', 1 * z);
      }
      break;
    }
    case 'grandclock': {
      const b = box(x + 0.27, y + 0.27, 0.46, 0.46, 60, DARKWOOD), f = F(b);
      wallRect(f, 0, 0.15, 0.85, 12, 36, 'rgba(255,240,200,.25)', '#5a3a22', 1);
      const piv = wallPt(f, 0, 0.5, 34), sw = Math.sin(ts / 500) * 0.35;
      line(piv.x, piv.y, piv.x + Math.sin(sw) * 16 * z, piv.y + Math.cos(sw) * 16 * z, '#d4a82a', 0.8 * z);
      circle(piv.x + Math.sin(sw) * 16 * z, piv.y + Math.cos(sw) * 16 * z, 2.4 * z, '#d4a82a');
      const cp = wallPt(f, 0, 0.5, 49), [hh, mm] = localHM(SCENE_TOWN);
      circle(cp.x, cp.y, 6 * z, '#fffaf0', '#d4a82a', 1 * z);
      const ha = (hh % 12 + mm / 60) / 12 * Math.PI * 2, ma = mm / 60 * Math.PI * 2;
      line(cp.x, cp.y, cp.x + Math.sin(ha) * 3 * z, cp.y - Math.cos(ha) * 3 * z, '#333', 1.2 * z);
      line(cp.x, cp.y, cp.x + Math.sin(ma) * 4.6 * z, cp.y - Math.cos(ma) * 4.6 * z, '#333', 0.8 * z);
      pyramid(x + 0.25, y + 0.25, 0.5, 0.5, 60, 6, DARKWOOD);
      break;
    }
  }
}

// ---------- more yard things ----------
function drawYard2(it, x, y, ts) {
  const k = it.k, z = cam.z, c = iso(x + 0.5, y + 0.5), P = (u, v, h) => up(iso(x + u, y + v), h * z);
  switch (k) {
    case 'birdbath': {
      box(x + 0.42, y + 0.42, 0.16, 0.16, 12, '#d9d1c2');
      const p = P(0.5, 0.5, 12);
      ellipse(p.x, p.y, 14 * z, 6.5 * z, '#e6dccb'); ellipse(p.x, p.y - 0.5 * z, 11 * z, 4.8 * z, '#8fd0ee');
      const hop = Math.max(0, Math.sin(ts / 300)) * 3 * z, bx = p.x + 7 * z;
      local(bx, p.y - 1 * z - hop, z, -1, () => { ellipse(0, -3, 3.4, 2.4, '#7a8aa6'); circle(2.6, -5, 1.8, '#7a8aa6'); pg([[4, -5.4], [6, -5], [4, -4.4]], '#f2a23a'); });
      break;
    }
    case 'scarecrow': {
      const b0 = P(0.5, 0.5, 0), sw = Math.sin(ts / 1000) * 0.05;
      local(b0.x, b0.y, z, 1, () => {
        ctx.rotate(sw);
        line(0, 0, 0, -36, '#8a5a36', 1.8); line(-12, -26, 12, -26, '#8a5a36', 1.6);
        rrect(-7, -30, 14, 14, 3, '#5aa2e0'); pg([[-12, -27], [-7, -29], [-7, -24]], '#5aa2e0'); pg([[12, -27], [7, -29], [7, -24]], '#5aa2e0');
        [-12, 12].forEach(hx => { line(hx, -26, hx + (hx > 0 ? 2 : -2), -23, '#e2bd5a', 0.8); line(hx, -26, hx + (hx > 0 ? 3 : -3), -26, '#e2bd5a', 0.8); });
        circle(0, -35, 5, '#e8d2a6'); circle(-1.6, -35.5, 0.7, '#333'); circle(1.6, -35.5, 0.7, '#333');
        ellipse(0, -39, 9, 2.4, '#d9b545'); rrect(-4.5, -45, 9, 6, 2.5, '#d9b545'); rrect(-4.5, -41, 9, 1.4, 0, '#e5484d');
      });
      break;
    }
    case 'beehive': {
      box(x + 0.3, y + 0.3, 0.4, 0.4, 3, '#8a5a36');
      [0, 1, 2].forEach(i => box(x + 0.28, y + 0.28, 0.44, 0.44, 7, i % 2 ? '#f6e3a3' : '#f2d36b', 3 + i * 7));
      box(x + 0.24, y + 0.24, 0.52, 0.52, 2, '#c99a3a', 24);
      for (let i = 0; i < 4; i++) {
        const a = ts / (500 + i * 90) + i * 1.6, bx = c.x + Math.cos(a) * (10 + i * 2) * z, by = c.y - (16 + Math.sin(a * 1.7) * 6) * z;
        circle(bx, by, 1.4 * z, '#2d2d2d'); circle(bx + 0.6 * z, by, 1.1 * z, '#f2c230');
      }
      if (yardReady(it)) { const p = P(0.5, 0.5, 4); ellipse(p.x + 5 * z, p.y + 2 * z, 3 * z, 1.4 * z, '#e9a72a'); }
      break;
    }
    case 'doghouse': {
      const b = box(x + 0.15, y + 0.15, 0.7, 0.7, 14, '#c0453a');
      const pts = [];
      for (let k2 = 0; k2 <= 8; k2++) { const a = k2 / 8 * Math.PI; pts.push(wallPt(b.left, 0, 0.5 + Math.cos(a) * 0.2, 6 + Math.sin(a) * 4)); }
      poly([wallPt(b.left, 0, 0.7, 0), ...pts, wallPt(b.left, 0, 0.3, 0)], '#3a2618');
      gableX(x + 0.08, y + 0.08, 0.84, 0.84, 14, 10, '#6b3a30', '#c0453a');
      const p = P(0.85, 0.5, 0); ellipse(p.x + 4 * z, p.y + 2 * z, 4 * z, 2 * z, '#e5e5e5');
      break;
    }
    case 'well': {
      const p = P(0.5, 0.5, 0);
      for (let k2 = 0; k2 < 3; k2++) { ellipse(p.x, p.y - k2 * 4 * z, 15 * z, 7 * z, k2 % 2 ? '#a9a39a' : '#9a948a'); }
      ellipse(p.x, p.y - 10 * z, 15 * z, 7 * z, '#b8b2a6'); ellipse(p.x, p.y - 10 * z, 11 * z, 5 * z, '#2f4b6a');
      [[0.15, 0.5], [0.85, 0.5]].forEach(([u, v]) => { const a = P(u, v, 8), b = P(u, v, 34); line(a.x, a.y, b.x, b.y, DARKWOOD, 2 * z); });
      gableX(x + 0.05, y + 0.25, 0.9, 0.5, 32, 9, '#8a5a36', '#6b4428');
      const r = P(0.5, 0.5, 28); line(r.x, r.y, r.x, r.y + 10 * z, '#888', 0.6 * z); rrect(r.x - 2.5 * z, r.y + 10 * z, 5 * z, 4 * z, 1 * z, '#8a5a36');
      break;
    }
    case 'campfire': {
      for (let k2 = 0; k2 < 8; k2++) { const a = k2 / 8 * Math.PI * 2; circle(c.x + Math.cos(a) * 10 * z, c.y + Math.sin(a) * 5 * z, 2.6 * z, '#8f8a82'); }
      line(c.x - 7 * z, c.y + 2 * z, c.x + 7 * z, c.y - 2 * z, '#6b4428', 2.6 * z); line(c.x - 7 * z, c.y - 2 * z, c.x + 7 * z, c.y + 2 * z, '#7a4f2e', 2.6 * z);
      for (let i = 0; i < 4; i++) { const fl = 8 + Math.sin(ts / 90 + i * 2) * 3 + Math.sin(ts / 170 + i) * 2; ellipse(c.x + (i - 1.5) * 2.4 * z, c.y - fl * z * 0.55, 2.6 * z, fl * z * 0.6, i % 2 ? '#f2a33a' : '#f6d04d'); }
      for (let i = 0; i < 3; i++) { const ph = (ts / 1600 + i / 3) % 1; circle(c.x + Math.sin(ph * 5 + i) * 3 * z, c.y - (14 + ph * 24) * z, (1.5 + ph * 3.5) * z, `rgba(200,200,200,${0.45 * (1 - ph)})`); }
      GLOWS.push({ x: c.x, y: c.y - 6 * z, r: 50 * z, a: 0.25 + NIGHT * 0.7 });
      break;
    }
    case 'picnic': {
      const [w, d] = it.rot ? [1, 2] : [2, 1];
      legs(x + 0.25, y + 0.3, w - 0.5, d - 0.6, 14, DARKWOOD, 0.02);
      box(x + 0.2, y + 0.25, w - 0.4, d - 0.5, 2, WOOD, 14);
      const tc = it.rot ? [x + 0.25, y + 0.35, w - 0.5, d - 0.7] : [x + 0.35, y + 0.25, w - 0.7, d - 0.5];
      flatRect(tc[0], tc[1], tc[2], tc[3], '#fff', null, 16.2);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2 === 0) flatRect(tc[0] + i * tc[2] / 4, tc[1] + j * tc[3] / 2, tc[2] / 4, tc[3] / 2, '#e5484d', null, 16.3);
      if (it.rot) { box(x + 0.02, y + 0.3, 0.16, d - 0.6, 2, WOOD, 8); box(x + w - 0.18, y + 0.3, 0.16, d - 0.6, 2, WOOD, 8); }
      else { box(x + 0.3, y + 0.02, w - 0.6, 0.16, 2, WOOD, 8); box(x + 0.3, y + d - 0.18, w - 0.6, 0.16, 2, WOOD, 8); }
      break;
    }
    case 'hammock': {
      const [w, d] = it.rot ? [1, 2] : [2, 1];
      const e = it.rot ? [[0.5, 0.1], [0.5, d - 0.1]] : [[0.1, 0.5], [w - 0.1, 0.5]];
      const tops = e.map(([u, v]) => { const a = P(u, v, 0), b = P(u, v, 30); line(a.x, a.y, b.x, b.y, DARKWOOD, 2.6 * z); return P(u, v, 24); });
      const m = P(w / 2, d / 2, 8 + Math.sin(ts / 900) * 2);
      ctx.beginPath(); ctx.moveTo(tops[0].x, tops[0].y); ctx.quadraticCurveTo(m.x, m.y + 8 * z, tops[1].x, tops[1].y);
      ctx.quadraticCurveTo(m.x, m.y + 2 * z, tops[0].x, tops[0].y); ctx.fillStyle = '#ef7d3c'; ctx.fill();
      ctx.strokeStyle = '#fff3d6'; ctx.lineWidth = 0.8 * z; ctx.stroke();
      break;
    }
    case 'slide': {
      const [w, d] = it.rot ? [2, 1] : [1, 2];
      const back = it.rot ? [x + 0.15, y + 0.2] : [x + 0.2, y + 0.15];
      [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]].forEach(([a, b]) => box(back[0] + a * 1.2, back[1] + b * 1.2, 0.08, 0.08, 30, '#3e7cc9'));
      box(back[0], back[1], 0.66, 0.66, 2, '#f2c230', 28);
      for (let k2 = 1; k2 < 5; k2++) { const a = P(it.rot ? 0.2 : 0.25, it.rot ? 0.25 : 0.2, k2 * 6), b = P(it.rot ? 0.2 : 0.75, it.rot ? 0.75 : 0.2, k2 * 6); line(a.x, a.y, b.x, b.y, '#3e7cc9', 1 * z); }
      const s0 = it.rot ? [x + 0.85, y + 0.25] : [x + 0.25, y + 0.85], s1 = it.rot ? [x + w - 0.1, y + 0.25] : [x + 0.25, y + d - 0.1];
      const q = [up(iso(s0[0], s0[1]), 28 * z), up(iso(s0[0] + (it.rot ? 0 : 0.5), s0[1] + (it.rot ? 0.5 : 0)), 28 * z), up(iso(s1[0] + (it.rot ? 0 : 0.5), s1[1] + (it.rot ? 0.5 : 0)), 2 * z), up(iso(s1[0], s1[1]), 2 * z)];
      poly(q, '#e5484d', 'rgba(0,0,0,.15)', z);
      break;
    }
    case 'trampoline': {
      const p = iso(x + 1, y + 1), bounce = Math.max(0, Math.sin(ts / 260)) * 2 * z;
      [[0.35, 0.35], [1.65, 0.35], [0.35, 1.65], [1.65, 1.65]].forEach(([u, v]) => { const a = P(u, v, 0), b = P(u, v, 10); line(a.x, a.y, b.x, b.y, '#555', 1.6 * z); });
      ellipse(p.x, p.y - 10 * z, 40 * z, 20 * z, '#3e7cc9');
      ellipse(p.x, p.y - 10 * z + bounce, 34 * z, 17 * z, '#2b2b2e');
      ellipse(p.x, p.y - 10 * z + bounce, 20 * z * (bounce / (2 * z) || 0.2), 10 * z * (bounce / (2 * z) || 0.2), null, 'rgba(255,255,255,.2)', 1 * z);
      break;
    }
    case 'arch': {
      const pts = [], A = [x + 0.5, y + 0.1], Bp = [x + 0.5, y + 0.9];
      [A, Bp].forEach(([u, v]) => { const a = iso(u, v), b = up(a, 30 * z); line(a.x, a.y, b.x, b.y, '#fffaf0', 2.2 * z); });
      for (let k2 = 0; k2 <= 12; k2++) { const a = k2 / 12 * Math.PI; pts.push(up(iso(x + 0.5, y + 0.5 - Math.cos(a) * 0.4), (30 + Math.sin(a) * 10) * z)); }
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); pts.forEach(p => ctx.lineTo(p.x, p.y)); ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2.2 * z; ctx.stroke();
      pts.forEach((p, i) => { circle(p.x, p.y, 3 * z, i % 2 ? '#4f9a3a' : '#5fae47'); if (i % 3 === 1) circle(p.x + 1 * z, p.y - 1 * z, 2 * z, '#e5484d'); });
      [A, Bp].forEach(([u, v]) => { for (let h = 6; h < 30; h += 8) { const p = up(iso(u, v), h * z); circle(p.x + 2 * z, p.y, 2.4 * z, '#5fae47'); circle(p.x - 1 * z, p.y - 3 * z, 1.6 * z, '#e5484d'); } });
      break;
    }
    case 'windmill': {
      const b0 = P(0.5, 0.5, 0);
      local(b0.x, b0.y, z, 1, () => {
        pg([[-8, 0], [8, 0], [5, -40], [-5, -40]], '#f4ecdf', 'rgba(0,0,0,.1)', 0.6);
        pg([[0, 0], [8, 0], [5, -40], [0, -40]], 'rgba(0,0,0,.06)');
        rrect(-2.5, -12, 5, 12, 2, '#8a5a36');
        pg([[-7, -40], [7, -40], [0, -50]], '#c0453a');
        const hub = [0, -38], a = ts / 700;
        for (let i = 0; i < 4; i++) {
          const ang = a + i * Math.PI / 2, ex = Math.cos(ang) * 22, ey = Math.sin(ang) * 22;
          line(hub[0], hub[1], hub[0] + ex, hub[1] + ey, '#8a5a36', 1.4);
          const nx = -Math.sin(ang) * 4, ny = Math.cos(ang) * 4;
          pg([[hub[0] + ex * 0.3, hub[1] + ey * 0.3], [hub[0] + ex, hub[1] + ey], [hub[0] + ex + nx, hub[1] + ey + ny], [hub[0] + ex * 0.3 + nx, hub[1] + ey * 0.3 + ny]], 'rgba(255,250,240,.92)', '#c9b98f', 0.4);
        }
        circle(hub[0], hub[1], 2, '#555');
      });
      break;
    }
  }
}

// ---------- nature around town ----------
// The look of the community you're in (TOWN_THEMES): leaf colours and the kind of wild tree.
let PAL = TOWN_THEMES.maple;
function drawWildTree(x, y, v, ts) {
  const z = cam.z, c = iso(x, y), s = (0.8 + v * 0.6) * z, sw = Math.sin(ts / 1500 + x * 0.7) * 1.2 * z, L = PAL.leaf, kind = PAL.tree;
  ellipse(c.x, c.y, 16 * s, 7 * s, 'rgba(0,0,0,.14)');
  if (kind === 'palm') {
    // a palm: a leaning ringed trunk, drooping fronds and a few coconuts
    const lean = (hash(x, y) - 0.5) * 10 * s, top = { x: c.x + lean + sw, y: c.y - 46 * s };
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.quadraticCurveTo(c.x + lean * 0.2, c.y - 24 * s, top.x, top.y);
    ctx.strokeStyle = '#9a7650'; ctx.lineWidth = 4 * s; ctx.lineCap = 'round'; ctx.stroke();
    for (let k = 1; k < 6; k++) { const u = k / 6, px = c.x + lean * u * u + sw * u, py = c.y - 46 * s * u; line(px - 2 * s, py, px + 2 * s, py, '#7d5d3c', 0.8 * s); }
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.55 + sw * 0.02; vleaf(top.x, top.y, 22 * s, 4.5 * s, a + (Math.abs(k - 3) * 0.12), k % 2 ? L[1] : L[0], false); }
    [[-2, 3], [2, 3.5], [0, 5]].forEach(([dx, dy]) => circle(top.x + dx * s, top.y + dy * s, 2.2 * s, '#7a5230'));
    return;
  }
  if (kind === 'cactus') {
    if (v < 0.5) { ellipse(c.x, c.y - 6 * s, 7 * s, 7 * s, L[0]); ellipse(c.x - 1.5 * s, c.y - 8 * s, 3 * s, 4 * s, L[2]); circle(c.x, c.y - 13 * s, 2 * s, '#f07a8a'); return; }   // barrel cactus
    const arm = (dx, h0, h1) => { rrect(c.x + dx * s - 2.5 * s, c.y - h1 * s, 5 * s, (h1 - h0) * s, 2.5 * s, L[0]); rrect(c.x + (dx > 0 ? 2.5 : dx - 2.5) * s - (dx > 0 ? 0 : 0), c.y - h0 * s - 2.5 * s, Math.abs(dx) * s, 5 * s, 2.5 * s, L[0]); };
    arm(-9, 16, 30); arm(9, 22, 36);
    rrect(c.x - 4.5 * s, c.y - 46 * s, 9 * s, 46 * s, 4.5 * s, L[1]);
    for (const dx of [-2, 0.5, 3]) line(c.x + dx * s, c.y - 43 * s, c.x + dx * s, c.y - 3 * s, 'rgba(0,0,0,.12)', 0.6 * s);
    return;
  }
  if (kind === 'bamboo') {
    // a clump of bamboo: thin jointed stalks with leaf sprays
    [-5, -1.5, 2, 5.5].forEach((dx, k) => {
      const h = (40 + hash(x + k, y) * 18) * s, tx = c.x + dx * s + sw * (1 + k * 0.2);
      line(c.x + dx * s, c.y, tx, c.y - h, k % 2 ? '#7fae4a' : '#6f9f3f', 1.8 * s);
      for (let j = 1; j < 5; j++) { const py = c.y - h * j / 5; line(c.x + dx * s - 1.2 * s + (tx - c.x - dx * s) * j / 5, py, c.x + dx * s + 1.2 * s + (tx - c.x - dx * s) * j / 5, py, '#5a8a33', 0.7 * s); }
      [[-0.6, 0.75], [0.5, 0.85], [-0.3, 1]].forEach(([a, u]) => vleaf(c.x + dx * s + (tx - c.x - dx * s) * u, c.y - h * u, 9 * s, 2 * s, -Math.PI / 2 + a * 2, k % 2 ? L[1] : L[2], false));
    });
    return;
  }
  if (v < 0.45 || kind === 'pine') {
    const cols = kind === 'pine' ? [L[0], L[1], shade(L[1], 0.1)] : ['#2f7d4a', '#38905a', '#45a368'];
    line(c.x, c.y, c.x, c.y - 12 * s, '#7a4f2e', 3 * s);
    [[34, 16], [46, 13], [57, 9]].forEach(([h, r], i) => {
      pg([[c.x - r * s, c.y - (h - 20) * s], [c.x + r * s, c.y - (h - 20) * s], [c.x + sw, c.y - (h + 4) * s]], cols[i]);
      if (PAL.snow) pg([[c.x - r * 0.45 * s + sw * 0.5, c.y - (h - 6) * s], [c.x + r * 0.45 * s + sw * 0.5, c.y - (h - 6) * s], [c.x + sw, c.y - (h + 4) * s]], '#f8fbfc');
    });
    return;
  }
  line(c.x, c.y, c.x, c.y - 16 * s, '#8a5a36', 3.4 * s);
  ellipse(c.x + sw * 0.5, c.y - 28 * s, 16 * s, 13 * s, v > 0.8 ? shade(L[0], 0.1) : L[0]);
  ellipse(c.x - 5 * s + sw, c.y - 33 * s, 10 * s, 9 * s, L[1]);
  ellipse(c.x + 5 * s + sw, c.y - 37 * s, 8 * s, 7 * s, L[2]);
  if (PAL.petals) for (let k = 0; k < 3; k++) { const ph = ((ts / 2600 + hash(x, k) ) % 1); circle(c.x + (hash(k, y) - 0.5) * 30 * s + ph * 10 * s, c.y - (30 - ph * 30) * s, 1.4 * s, '#fbd0e0'); }
}
function drawRock(x, y, v) {
  const z = cam.z, c = iso(x, y), s = (0.6 + v) * z;
  ellipse(c.x, c.y, 10 * s, 4 * s, 'rgba(0,0,0,.12)');
  ellipse(c.x, c.y - 3 * s, 9 * s, 5.5 * s, '#a9a49b'); ellipse(c.x - 2 * s, c.y - 5 * s, 5 * s, 3 * s, '#c2bdb4');
}
function drawBushWild(x, y, v) {
  const z = cam.z, c = iso(x, y), s = (0.7 + v * 0.5) * z;
  [[-6, -5, 7], [5, -6, 6.5], [0, -10, 7.5]].forEach(([dx, dy, r], i) => circle(c.x + dx * s, c.y + dy * s, r * s, i === 2 ? '#6cb85a' : '#5aa64a'));
  if (v > 0.6) [[-4, -10], [4, -12], [0, -6]].forEach(([dx, dy]) => circle(c.x + dx * s, c.y + dy * s, 1.6 * s, '#f7a8c8'));
}
// A lake as an ellipse in world space.
function drawLake(cx, cy, rx, ry, ts) {
  const z = cam.z, nR = Math.max(28, Math.round((rx + ry) * 0.9)), ring = (k, ox = 0) => { const pts = []; for (let i = 0; i < nR; i++) { const a = i / nR * Math.PI * 2; pts.push(iso(cx + Math.cos(a) * (rx + k), cy + Math.sin(a) * (ry + k) + ox)); } return pts; };
  poly(ring(0.35), '#d8cba6');
  poly(ring(0), '#4aa8d6');
  poly(ring(-0.4), '#5dbbe6');
  for (let i = 0; i < 4; i++) {
    const u = (ts / 5000 + i / 4) % 1, a = iso(cx - rx * 0.5, cy - ry * 0.6 + u * ry * 1.2), b = iso(cx + rx * 0.2, cy - ry * 0.6 + u * ry * 1.2);
    line(a.x, a.y, b.x, b.y, `rgba(255,255,255,${0.4 * Math.sin(u * Math.PI)})`, 1.2 * z);
  }
  [[0.3, -0.4], [-0.5, 0.2]].forEach(([u, v]) => { const p = iso(cx + u * rx, cy + v * ry); ellipse(p.x, p.y, 7 * z, 3 * z, '#5fae47'); circle(p.x + 2 * z, p.y - 1 * z, 1.5 * z, '#f7a8c8'); });
}

// An inflatable paddling pool (swimming at home when there's no pond or pool).
function drawTub(x, y, ts) {
  const z = cam.z, c = iso(x, y), ph = ts / 700;
  ellipse(c.x, c.y + 3 * z, 32 * z, 15 * z, 'rgba(0,0,0,.14)');
  ellipse(c.x, c.y, 30 * z, 14 * z, '#3f8fd0');
  ellipse(c.x, c.y - 7 * z, 30 * z, 14 * z, '#6fb9ef');
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ellipse(c.x + Math.cos(a) * 27 * z, c.y - 7 * z + Math.sin(a) * 12.5 * z, 4 * z, 2.4 * z, k % 2 ? '#ffffff' : '#ffd84a'); }
  ellipse(c.x, c.y - 7 * z, 22 * z, 10 * z, '#5bb8e8');
  ellipse(c.x - 6 * z + Math.sin(ph) * 3 * z, c.y - 9 * z, 7 * z, 2 * z, 'rgba(255,255,255,.55)');
}

// ---------- exclusives (v0.10): things only trophy winners may own ----------
const GOLD = '#f2c230', GOLD_D = '#c9961a', GOLD_L = '#ffe58a';
// A little golden sparkle so exclusives catch the eye.
function sparkle(x, y, ts, k = 0) {
  const ph = (ts / 900 + k * 0.37) % 1, a = Math.sin(ph * Math.PI);
  if (a > 0.05) star(x, y, 2.6 * cam.z * a, `rgba(255,248,210,${a})`);
}
// A sport's golden statue (v0.12): a golden mini-person in that sport's pose on a marble plinth with the sport's badge.
const GOLD_LOOK = { shirt: '#f2c230', skin: '#e8b923', hair: 'short', hairCol: '#c9971a', mob: 'walk' };
const STATUE_POSE = { walk: 'walk', run: 'run', cycle: 'run', swim: 'swim', hike: 'walk', mind: 'stand', strength: 'lift', cardio: 'run', team: 'wave', snow: 'run', outdoor: 'wave' };
function drawSportStatue(it, x, y, ts) {
  const z = cam.z, s = SPORT_BY_ID[YARD[it.k].sport], c = iso(x + 0.5, y + 0.5), pose = STATUE_POSE[s.group] || 'stand';
  ellipse(c.x, c.y + 2 * z, 26 * z, 11 * z, 'rgba(0,0,0,.14)');
  box(x + 0.12, y + 0.12, 0.76, 0.76, 2.5, '#d9d1c2');
  const b = box(x + 0.18, y + 0.18, 0.64, 0.64, 12, '#ece6da', 2.5);
  wallRect(b.left, 2.5, 0.16, 0.84, 2.5, 9, '#fbf6ea', '#c9b98f', 0.8);
  const pl = wallPt(b.left, 2.5, 0.5, 5.8);
  emoji(s.e, pl.x, pl.y, 6.5 * z);
  const p = up(iso(x + 0.5, y + 0.5), 14.5 * z);
  drawPerson(p.x, p.y, z * (pose === 'swim' ? 0.85 : 0.95), { look: GOLD_LOOK, face: 1, moving: pose === 'walk' || pose === 'run', phase: 1.3, energy: 'great', ts: 0, seed: 1, pose, noBike: true });
  const g = (Math.sin(ts / 700 + x * 1.3) + 1) / 2;
  circle(p.x + 5 * z, p.y - 30 * z, (0.8 + g * 1.4) * z, 'rgba(255,255,235,.95)');
}
// An award's medal sculpture (v0.12): a big medal on a stand, in the award's colour, with its badge.
function drawAwardMedal(it, x, y, ts) {
  const z = cam.z, A = AWARDS[YARD[it.k].award], c = iso(x + 0.5, y + 0.5);
  ellipse(c.x, c.y + 2 * z, 24 * z, 10 * z, 'rgba(0,0,0,.14)');
  box(x + 0.14, y + 0.26, 0.72, 0.48, 5, '#8a8f98');
  const top = up(iso(x + 0.5, y + 0.5), 5 * z), m = { x: top.x, y: top.y - 30 * z };
  line(top.x - 7 * z, top.y, top.x - 3 * z, m.y + 6 * z, '#6b7079', 2.2 * z); line(top.x + 7 * z, top.y, top.x + 3 * z, m.y + 6 * z, '#6b7079', 2.2 * z);
  pg([[m.x - 8 * z, m.y - 26 * z], [m.x - 2 * z, m.y - 9 * z], [m.x + 2 * z, m.y - 9 * z], [m.x + 8 * z, m.y - 26 * z]], A.col);
  pg([[m.x - 8 * z, m.y - 26 * z], [m.x - 4 * z, m.y - 26 * z], [m.x, m.y - 13 * z], [m.x - 2 * z, m.y - 9 * z]], shade(A.col, -0.2));
  circle(m.x, m.y, 13 * z, shade('#f2c230', -0.25)); circle(m.x, m.y, 11.5 * z, '#f2c230'); circle(m.x, m.y, 9 * z, A.col);
  emoji(A.e, m.x, m.y + 0.5 * z, 10 * z);
  const g = (Math.sin(ts / 800 + x) + 1) / 2;
  circle(m.x - 4 * z, m.y - 6 * z, (1.4 + g) * z, 'rgba(255,255,255,.7)');
}
function drawExcl(it, x, y, ts) {
  if (it.k.startsWith('st_')) return drawSportStatue(it, x, y, ts);
  if (it.k.startsWith('aw_')) return drawAwardMedal(it, x, y, ts);
  const k = it.k, z = cam.z, [w, d] = itemSize('yard', it), P = (u, v, h) => up(iso(x + u, y + v), h * z), c = iso(x + w / 2, y + d / 2);
  ellipse(c.x, c.y + 2 * z, (w + d) * 14 * z, (w + d) * 6 * z, 'rgba(0,0,0,.14)');
  switch (k) {
    case 'walkerstatue': {   // a golden walker striding on a marble plinth
      box(x + 0.2, y + 0.2, 0.6, 0.6, 12, '#ece6da'); box(x + 0.16, y + 0.16, 0.68, 0.68, 2.5, '#d9d1c2', 12);
      const p = P(0.5, 0.5, 14.5);
      drawPerson(p.x, p.y, z * 0.75, { look: { shirt: GOLD, pants: GOLD_D, skin: GOLD_L, hair: 'short', hairCol: GOLD_D, mob: 'walk' }, face: 1, moving: true, phase: 1.1, energy: 'good', ts: 0, seed: 0 });
      sparkle(p.x + 8 * z, p.y - 30 * z, ts);
      break;
    }
    case 'goldginkgo': {   // a ginkgo with golden fan-shaped leaves, a few drifting down
      line(c.x, c.y, c.x, c.y - 22 * z, '#7a4f2e', 4 * z);
      [[0, -34, 17], [-9, -28, 11], [9, -29, 11], [0, -44, 11]].forEach(([dx, dy, r], i) => ellipse(c.x + dx * z, c.y + dy * z, r * z, r * 0.82 * z, i % 2 ? GOLD : '#f5cf4a'));
      for (let i = 0; i < 9; i++) { const a = hash(i, 3) * Math.PI * 2, rr = hash(i, 4) * 14; const p = { x: c.x + Math.cos(a) * rr * z, y: c.y - (34 + Math.sin(a) * rr * 0.8) * z }; pg([[p.x, p.y], [p.x - 2.4 * z, p.y - 2.6 * z], [p.x + 2.4 * z, p.y - 2.6 * z]], GOLD_L); }
      for (let i = 0; i < 3; i++) { const ph = (ts / 3000 + i / 3) % 1; ellipse(c.x + (i - 1) * 9 * z + Math.sin(ph * 6) * 3 * z, c.y - (24 - ph * 24) * z, 1.6 * z, 1 * z, GOLD); }
      sparkle(c.x + 10 * z, c.y - 46 * z, ts);
      break;
    }
    case 'triumph': {   // a stone triumphal arch with a golden top
      const along = w >= d, L = along ? [x + 0.05, y + 0.25, 0.55, 0.5] : [x + 0.25, y + 0.05, 0.5, 0.55], R = along ? [x + w - 0.6, y + 0.25, 0.55, 0.5] : [x + 0.25, y + d - 0.6, 0.5, 0.55];
      box(L[0], L[1], L[2], L[3], 38, '#e9e2d4'); box(R[0], R[1], R[2], R[3], 38, '#e9e2d4');
      box(x + 0.02, y + 0.2, w - 0.04, d - 0.4, 12, '#f1ebdf', 38);
      box(x + 0.15, y + 0.3, w - 0.3, d - 0.6, 4, GOLD, 50);
      const t = P(w / 2, d / 2, 58); pg([[t.x - 7 * z, t.y + 2 * z], [t.x, t.y - 8 * z], [t.x + 7 * z, t.y + 2 * z]], GOLD_D);
      sparkle(t.x, t.y - 10 * z, ts);
      break;
    }
    case 'ringfountain': case 'ringgarden': {
      const RC = ['#fa114f', '#92e82a', '#1eeaef'];
      if (k === 'ringfountain') {
        box(x + 0.1, y + 0.1, w - 0.2, d - 0.2, 7, '#d9d1c2'); flatRect(x + 0.22, y + 0.22, w - 0.44, d - 0.44, '#6fc3ea', null, 6.5);
        const p = P(w / 2, d / 2, 7);
        RC.forEach((col, i) => { ctx.beginPath(); ctx.ellipse(p.x + (i - 1) * 7 * z, p.y - 16 * z, 9 * z, 13 * z, 0, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.lineWidth = 3 * z; ctx.stroke(); });
        for (let i = 0; i < 8; i++) { const ph = (ts / 700 + i / 8) % 1; circle(p.x + Math.cos(i) * 18 * ph * z, p.y - (30 * Math.sin(ph * Math.PI)) * z, 1.4 * z, 'rgba(255,255,255,.8)'); }
      } else {
        flatRect(x + 0.08, y + 0.08, w - 0.16, d - 0.16, '#7ab55a');
        RC.forEach((col, i) => { const r = 0.85 - i * 0.26, q = iso(x + w / 2, y + d / 2); ctx.beginPath(); ctx.ellipse(q.x, q.y - 1 * z, r * 32 * z, r * 16 * z, 0, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.lineWidth = 6 * z; ctx.stroke();
          for (let j = 0; j < 10; j++) { const a = j / 10 * Math.PI * 2; circle(q.x + Math.cos(a) * r * 32 * z, q.y - 2 * z + Math.sin(a) * r * 16 * z, 1.8 * z, shade(col, 0.4)); } });
        const q = iso(x + w / 2, y + d / 2); line(q.x, q.y, q.x, q.y - 18 * z, '#8a5a36', 1.5 * z); circle(q.x, q.y - 20 * z, 3 * z, GOLD);
      }
      sparkle(c.x + 14 * z, c.y - 28 * z, ts);
      break;
    }
    case 'ringtower': {   // a slim white tower with the three rings round it and a gold star
      box(x + 0.32, y + 0.32, 0.36, 0.36, 70, '#f5f2ec'); box(x + 0.25, y + 0.25, 0.5, 0.5, 4, '#d9d1c2');
      const p = P(0.5, 0.5, 0);
      ['#fa114f', '#92e82a', '#1eeaef'].forEach((col, i) => { ctx.beginPath(); ctx.ellipse(p.x, p.y - (24 + i * 16) * z, 14 * z, 6 * z, 0, 0, Math.PI * 2); ctx.strokeStyle = col; ctx.lineWidth = 3 * z; ctx.stroke(); });
      star(p.x, p.y - 80 * z, 6 * z, GOLD);
      sparkle(p.x + 10 * z, p.y - 84 * z, ts);
      break;
    }
    case 'finisharch': {   // an inflatable finish arch with a FINISH banner and flags
      const along = w >= d, a = along ? P(0.15, d / 2, 0) : P(w / 2, 0.15, 0), b = along ? P(w - 0.15, d / 2, 0) : P(w / 2, d - 0.15, 0);
      ctx.lineCap = 'round';
      [[a, b]].forEach(() => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x, a.y - 30 * z); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 52 * z, b.x, b.y - 30 * z); ctx.lineTo(b.x, b.y); ctx.strokeStyle = '#ef7d3c'; ctx.lineWidth = 7 * z; ctx.stroke(); });
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 36 * z };
      rrect(m.x - 18 * z, m.y - 5 * z, 36 * z, 10 * z, 2 * z, '#fffaf0'); ctx.fillStyle = '#3b3125'; ctx.font = `800 ${7 * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FINISH', m.x, m.y + 0.5 * z);
      [a, b].forEach((q, i) => { line(q.x + 5 * z, q.y, q.x + 5 * z, q.y - 22 * z, '#888', 1 * z); pg([[q.x + 5 * z, q.y - 22 * z], [q.x + 12 * z, q.y - 19 * z], [q.x + 5 * z, q.y - 16 * z]], i ? '#3f6fb5' : '#e5484d'); });
      sparkle(m.x, m.y - 20 * z, ts);
      break;
    }
    case 'dolphinfountain': {   // a round pool with a leaping dolphin spouting water
      box(x + 0.1, y + 0.1, w - 0.2, d - 0.2, 6, '#d9d1c2'); flatRect(x + 0.2, y + 0.2, w - 0.4, d - 0.4, '#5bb8e8', null, 5.6);
      const p = P(w / 2, d / 2, 6);
      ctx.save(); ctx.translate(p.x, p.y - 14 * z); ctx.rotate(-0.5);
      ellipse(0, 0, 12 * z, 5 * z, '#7d9fb8'); ellipse(2 * z, 1.5 * z, 8 * z, 2.5 * z, '#e8f1f6');
      pg([[-11 * z, 0], [-17 * z, -5 * z], [-15 * z, 0], [-17 * z, 5 * z]], '#6b8ca3'); pg([[-1 * z, -4 * z], [3 * z, -10 * z], [5 * z, -4 * z]], '#6b8ca3');
      circle(8 * z, -1.5 * z, 0.9 * z, '#1a2a36'); ctx.restore();
      for (let i = 0; i < 9; i++) { const ph = (ts / 600 + i / 9) % 1; circle(p.x + 6 * z + (i - 4) * 2.2 * ph * z, p.y - 22 * z - Math.sin(ph * Math.PI) * 20 * z, 1.4 * z, 'rgba(255,255,255,.85)'); }
      sparkle(p.x - 16 * z, p.y - 30 * z, ts);
      break;
    }
    case 'cabin': {   // a log cabin with a steep roof, a chimney and a summit flag
      const b = box(x + 0.2, y + 0.3, w - 0.4, d - 0.6, 22, '#9a6a3e');
      [b.left, b.right].forEach(f => { for (let k2 = 1; k2 < 6; k2++) wallLine(f, 0, 0, k2 * 4, 1, k2 * 4, 'rgba(60,30,10,.35)', 0.8); });
      wallRect(b.left, 0, 0.4, 0.6, 0, 14, '#5a3a20'); wallRect(b.right, 0, 0.3, 0.55, 9, 16, '#f6e7b0');
      box(x + w - 0.75, y + 0.4, 0.25, 0.25, 40, '#8a8a88');
      gableY(x + 0.1, y + 0.2, w - 0.2, d - 0.4, 22, 26, '#5a6b4f', '#9a6a3e');
      const f = P(0.3, 0.5, 48); line(f.x, f.y, f.x, f.y - 16 * z, '#555', 1 * z); pg([[f.x, f.y - 16 * z], [f.x + 9 * z, f.y - 13 * z], [f.x, f.y - 10 * z]], '#e5484d');
      const ch = P(w - 0.62, 0.52, 40), ph = (ts / 1600) % 1; circle(ch.x + ph * 5 * z, ch.y - ph * 14 * z, (2 + ph * 3) * z, `rgba(220,220,220,${0.6 * (1 - ph)})`);
      sparkle(f.x + 10 * z, f.y - 20 * z, ts);
      break;
    }
    case 'zengarden': {   // raked sand, three rocks, a stone lantern and a little red maple
      flatRect(x + 0.08, y + 0.08, w - 0.16, d - 0.16, '#e9e0cc');
      for (let i = 1; i < 8; i++) { const a = iso(x + 0.15, y + i * d / 8), b = iso(x + w - 0.15, y + i * d / 8); line(a.x, a.y, b.x, b.y, 'rgba(160,140,100,.45)', 0.8 * z); }
      [[0.6, 0.7, 7], [1.3, 1.1, 5], [0.9, 1.5, 4]].forEach(([u, v, r]) => { const q = P(u, v, 0); ellipse(q.x, q.y - r * 0.4 * z, r * 1.4 * z, r * z, '#8f8a80'); ellipse(q.x - r * 0.3 * z, q.y - r * 0.7 * z, r * 0.6 * z, r * 0.4 * z, '#a9a49a'); });
      box(x + w - 0.5, y + 0.25, 0.22, 0.22, 14, '#b9b3a6'); box(x + w - 0.56, y + 0.19, 0.34, 0.34, 3, '#a39d90', 14);
      const l = P(w - 0.39, 0.36, 10); circle(l.x, l.y, 2 * z, NIGHT > 0.3 ? '#fff6c8' : '#e9e2d4');
      const m = P(0.4, 0.4, 0); line(m.x, m.y, m.x, m.y - 14 * z, '#6b4428', 2 * z); circle(m.x, m.y - 18 * z, 7 * z, '#d9532a'); circle(m.x - 3 * z, m.y - 21 * z, 4 * z, '#e8743a');
      sparkle(m.x + 8 * z, m.y - 26 * z, ts);
      break;
    }
    case 'podium': {   // 2 · 1 · 3 steps, gold, silver and bronze
      const along = w >= d, step = (i, hh, col) => { const u0 = i / 3 * (along ? w : d), u1 = (i + 1) / 3 * (along ? w : d); along ? box(x + u0 + 0.03, y + 0.15, u1 - u0 - 0.06, d - 0.3, hh, col) : box(x + 0.15, y + u0 + 0.03, w - 0.3, u1 - u0 - 0.06, hh, col); };
      step(0, 14, '#d5dbe1'); step(1, 22, '#f5e08a'); step(2, 9, '#e3b483');
      [[0, 14, '2'], [1, 22, '1'], [2, 9, '3']].forEach(([i, hh, n]) => { const u = (i + 0.5) / 3; const q = along ? P(u * w, d / 2, hh) : P(w / 2, u * d, hh); ctx.fillStyle = '#5d5448'; ctx.font = `800 ${8 * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.fillText(n, q.x, q.y + 6 * z); });
      const top = along ? P(w / 2, d / 2, 22) : P(w / 2, d / 2, 22);
      pg([[top.x - 4 * z, top.y - 4 * z], [top.x + 4 * z, top.y - 4 * z], [top.x + 2.5 * z, top.y - 10 * z], [top.x - 2.5 * z, top.y - 10 * z]], GOLD); ellipse(top.x, top.y - 11 * z, 5 * z, 2 * z, GOLD_L);
      sparkle(top.x + 7 * z, top.y - 16 * z, ts);
      break;
    }
    case 'stage': {   // a wooden stage, red curtains, two spotlights
      box(x + 0.05, y + 0.05, w - 0.1, d - 0.1, 8, '#a0703f');
      for (let i = 1; i < 6; i++) { const a = up(iso(x + 0.1, y + i * d / 6), 8 * z), b = up(iso(x + w - 0.1, y + i * d / 6), 8 * z); line(a.x, a.y, b.x, b.y, 'rgba(60,30,10,.25)', 0.8 * z); }
      box(x + 0.05, y + 0.05, w - 0.1, 0.12, 40, '#7a2a2a', 8);
      const L = [iso(x + 0.1, y + 0.17), iso(x + w - 0.1, y + 0.17)];
      wallRect(L, 8, 0, 0.3, 0, 40, '#c0392b'); wallRect(L, 8, 0.7, 1, 0, 40, '#c0392b'); wallRect(L, 8, 0, 1, 34, 40, '#a93226');
      [0.25, w - 0.25].forEach((u, i) => { const q = P(u, d - 0.2, 8); line(q.x, q.y, q.x, q.y - 20 * z, '#333', 1.2 * z); circle(q.x, q.y - 22 * z, 3 * z, '#444'); if (Math.sin(ts / 500 + i) > 0) circle(q.x, q.y - 22 * z, 1.6 * z, '#fff6c8'); });
      const n = P(w / 2, d / 2, 8), ph = (ts / 900) % 1; ctx.save(); ctx.globalAlpha = 1 - ph; ctx.fillStyle = '#8b5cf6'; ctx.font = `${10 * z}px sans-serif`; ctx.fillText('♪', n.x - 6 * z, n.y - (20 + ph * 14) * z); ctx.restore();
      sparkle(n.x + 12 * z, n.y - 40 * z, ts);
      break;
    }
    case 'court': {   // a little basketball court with a hoop
      flatRect(x + 0.05, y + 0.05, w - 0.1, d - 0.1, '#d8794a'); flatRect(x + 0.15, y + 0.15, w - 0.3, d - 0.3, null, '#fff', 0.2, 1.4 * z);
      const ctr = iso(x + w / 2, y + d / 2); ctx.beginPath(); ctx.ellipse(ctr.x, ctr.y, 10 * z, 5 * z, 0, 0, Math.PI * 2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4 * z; ctx.stroke();
      const pole = P(w / 2, 0.15, 0); line(pole.x, pole.y, pole.x, pole.y - 40 * z, '#666', 2 * z);
      rrect(pole.x - 9 * z, pole.y - 52 * z, 18 * z, 12 * z, 1 * z, '#fff', '#999', 1 * z);
      ctx.beginPath(); ctx.ellipse(pole.x, pole.y - 40 * z, 5 * z, 2 * z, 0, 0, Math.PI * 2); ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 1.4 * z; ctx.stroke();
      const bb = P(w * 0.65, d * 0.65, 0), bh = Math.abs(Math.sin(ts / 400)) * 10; circle(bb.x, bb.y - (3 + bh) * z, 3 * z, '#ef7d3c'); line(bb.x - 3 * z, bb.y - (3 + bh) * z, bb.x + 3 * z, bb.y - (3 + bh) * z, '#7a3a1a', 0.5 * z);
      sparkle(pole.x + 12 * z, pole.y - 52 * z, ts);
      break;
    }
    case 'igloo': {   // a snow dome made of blocks, with an entrance and a snowman
      const p = P(w / 2 + 0.1, d / 2, 0);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 26 * z, 13 * z, 0, Math.PI, 0); ctx.lineTo(p.x + 26 * z, p.y); ctx.fillStyle = '#f4f8fb'; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, 26 * z, Math.PI, 0); ctx.fillStyle = '#f4f8fb'; ctx.fill();
      ctx.strokeStyle = 'rgba(140,170,200,.45)'; ctx.lineWidth = 0.8 * z;
      for (let r = 1; r < 4; r++) { ctx.beginPath(); ctx.arc(p.x, p.y, 26 * z, Math.PI + r * 0.25, -r * 0.25); ctx.stroke(); }
      for (let r = 1; r < 4; r++) { const yy = p.y - r * 7 * z, half = Math.sqrt(Math.max(0, 26 * 26 - (r * 7) ** 2)) * z; line(p.x - half, yy, p.x + half, yy, 'rgba(140,170,200,.45)', 0.8 * z); }
      ctx.beginPath(); ctx.arc(p.x + 8 * z, p.y, 7 * z, Math.PI, 0); ctx.fillStyle = '#5b7a96'; ctx.fill();
      const s = P(w - 0.3, d - 0.3, 0); circle(s.x, s.y - 5 * z, 5 * z, '#fff'); circle(s.x, s.y - 13 * z, 3.6 * z, '#fff'); circle(s.x + 1 * z, s.y - 13.5 * z, 0.6 * z, '#333'); pg([[s.x + 2 * z, s.y - 12.5 * z], [s.x + 6 * z, s.y - 12 * z], [s.x + 2 * z, s.y - 11.5 * z]], '#ef7d3c');
      sparkle(p.x - 14 * z, p.y - 30 * z, ts);
      break;
    }
    case 'flame': {   // a golden cauldron on a column with a dancing flame
      box(x + 0.35, y + 0.35, 0.3, 0.3, 24, '#e9e2d4');
      const p = P(0.5, 0.5, 24);
      ellipse(p.x, p.y + 2 * z, 11 * z, 4 * z, GOLD_D); ctx.beginPath(); ctx.ellipse(p.x, p.y, 11 * z, 4 * z, 0, 0, Math.PI); ctx.lineTo(p.x - 11 * z, p.y); ctx.fillStyle = GOLD; ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x - 9 * z, p.y); ctx.quadraticCurveTo(p.x, p.y + 9 * z, p.x + 9 * z, p.y); ctx.fillStyle = GOLD; ctx.fill();
      const fl = Math.sin(ts / 120) * 2;
      [[12, '#f28c28'], [8, '#f2c230'], [4.5, '#fff6c8']].forEach(([r, col]) => { ctx.beginPath(); ctx.moveTo(p.x - r * z, p.y - 1 * z); ctx.quadraticCurveTo(p.x - r * 0.8 * z, p.y - r * 1.6 * z, p.x + fl * z, p.y - (r * 2.6 + fl) * z); ctx.quadraticCurveTo(p.x + r * 0.8 * z, p.y - r * 1.6 * z, p.x + r * z, p.y - 1 * z); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); });
      glow(p.x, p.y - 12 * z, 50 * z, 1);
      break;
    }
  }
}
// The trophy case: a glass cabinet with gold, silver and bronze cups (it.cups of them).
function drawTrophyCase(it, x, y) {
  const z = cam.z, n = it.cups || 1, cols = ['#f2c230', '#aab4bf', '#c98a4a'];
  const b = box(x + 0.12, y + 0.18, 0.76, 0.64, 46, '#7a4f2e');
  box(x + 0.16, y + 0.22, 0.68, 0.56, 1.5, '#8a5a36', 46);
  [b.left].forEach(f => {
    wallRect(f, 0, 0.06, 0.94, 3, 43, 'rgba(200,230,245,.35)', 'rgba(255,255,255,.6)', 0.6);
    [14, 26, 38].forEach(hh => wallRect(f, 0, 0.06, 0.94, hh - 0.8, hh, '#8a5a36'));
    for (let i = 0; i < Math.min(12, n); i++) {
      const row = Math.floor(i / 4), u = 0.18 + (i % 4) * 0.21, hh = 3 + row * 12, p = wallPt(f, 0, u, hh), col = cols[i % 3];
      pg([[p.x - 2.2 * z, p.y - 6 * z], [p.x + 2.2 * z, p.y - 6 * z], [p.x + 1.4 * z, p.y - 2.5 * z], [p.x - 1.4 * z, p.y - 2.5 * z]], col);
      line(p.x, p.y - 2.5 * z, p.x, p.y - 0.8 * z, col, 0.8 * z); rrect(p.x - 1.6 * z, p.y - 1 * z, 3.2 * z, 1 * z, 0.3 * z, shade(col, -0.2));
    }
    wallLine(f, 0, 0.2, 40, 0.35, 8, 'rgba(255,255,255,.45)', 1);
  });
}

// ---------- stores (v0.17; v0.19: facing their road, with a car park in front) ----------
// st = [k, x, y, w, d, front]: the whole plot. front S / N / E / W is the side the door and the car park face (the
// road is just past the car park). S and E doors are on the faces you can see; N and W doors are round the back.
function storeGeo(st) {
  const [k, x, y, w, d, front = 'S'] = st, F = STORE_FRONT;
  if (front === 'S') return { k, front, b: [x, y, w, d - F], c: [x, y + d - F, w, F], door: [x + w / 2, y + d - F + 0.4], bay: [x + w - 1.2, y + d - F / 2], dir: '-y', along: 'x' };
  if (front === 'N') return { k, front, b: [x, y + F, w, d - F], c: [x, y, w, F], door: [x + w / 2, y + F - 0.4], bay: [x + w - 1.2, y + F / 2], dir: '+y', along: 'x' };
  if (front === 'E') return { k, front, b: [x, y, w - F, d], c: [x + w - F, y, F, d], door: [x + w - F + 0.4, y + d / 2], bay: [x + w - F / 2, y + d - 1.2], dir: '-x', along: 'y' };
  return { k, front, b: [x + F, y, w - F, d], c: [x, y, F, d], door: [x + F - 0.4, y + d / 2], bay: [x + F / 2, y + d - 1.2], dir: '+x', along: 'y' };
}
// Points along the middle of a store's car park for things on show (not the customer bay at the end).
function storeSlots(G, n) {
  const [cx, cy, cw, cd] = G.c, out = [];
  for (let i = 0; i < n; i++) out.push(G.along === 'x' ? [cx + 1.1 + i * 1.9, cy + cd / 2] : [cx + cw / 2, cy + 1.1 + i * 1.9]);
  return out.filter(([px, py]) => (G.along === 'x' ? px < cx + cw - 2.6 : py < cy + cd - 2.6));
}
// A car park: asphalt, a kerb and white bay lines across it (flat, drawn with the ground).
function drawCarPark(rect, along, o = {}) {
  const [x, y, w, d] = rect, z = cam.z;
  flatRect(x, y, w, d, '#cfc9bd');
  flatRect(x + 0.15, y + 0.15, w - 0.3, d - 0.3, '#7d848c');
  if (z < 0.2) return;
  const n = Math.floor(((along === 'x' ? w : d) - 0.3) / 1.6);
  for (let i = 0; i <= n; i++) {
    const u = 0.15 + i * 1.6;
    if (along === 'x') { const A = iso(x + u, y + 0.35), B = iso(x + u, y + d * 0.72); line(A.x, A.y, B.x, B.y, 'rgba(255,255,255,.85)', 1.2 * z); }
    else { const A = iso(x + 0.35, y + u), B = iso(x + w * 0.72, y + u); line(A.x, A.y, B.x, B.y, 'rgba(255,255,255,.85)', 1.2 * z); }
  }
  if (o.sign && z > 0.25) {   // a blue P sign at the corner
    const p = iso(x + w - 0.3, y + d - 0.3); line(p.x, p.y, p.x, p.y - 18 * z, '#6b7280', 1.2 * z);
    rrect(p.x - 5 * z, p.y - 26 * z, 10 * z, 10 * z, 2 * z, '#2f6fe0'); ctx.fillStyle = '#fff'; ctx.font = `800 ${7 * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P', p.x, p.y - 20.6 * z);
  }
}
// The store building itself.
function drawStore(st, ts) {
  const G = storeGeo(st), k = G.k, S2 = STORES[k], z = cam.z, [x, y, w, d] = G.b, glassCol = NIGHT > 0.3 ? '#ffe39a' : '#a9dcf5';
  const c = iso(x + w / 2, y + d / 2), side = G.front === 'E' || G.front === 'W', showDoor = G.front === 'S' || G.front === 'E';
  ellipse(c.x, c.y + 6 * z, (w + d) * 9 * z, (w + d) * 4.5 * z, 'rgba(0,0,0,.07)');
  const wh = CIVIC_WH[k] || (k === 'mall' ? 52 : k === 'ranch' ? 26 : k === 'nursery' ? 24 : 30);
  const gable = (x0, y0, w0, d0, h0, rh, rc, ec) => (side ? gableY(x0, y0, w0, d0, h0, rh, rc, ec) : gableX(x0, y0, w0, d0, h0, rh, rc, ec));
  let b;
  if (k === 'nursery') {   // a greenhouse: glass walls, a glass ridge roof, plants inside
    b = box(x + 0.2, y + 0.2, w - 0.4, d - 0.4, wh, 'rgba(200,235,220,.55)', 0, { left: 'rgba(190,230,215,.65)', right: 'rgba(170,215,200,.65)', top: 'rgba(220,245,235,.7)', edge: '#8fb9a6' });
    for (let i = 1; i < 6; i++) { wallLine(b.left, 0, i / 6, 0, i / 6, wh, 'rgba(255,255,255,.7)', 0.8); wallLine(b.right, 0, i / 6, 0, i / 6, wh, 'rgba(255,255,255,.7)', 0.8); }
    gable(x + 0.1, y + 0.1, w - 0.2, d - 0.2, wh, 10, 'rgba(220,245,235,.8)', 'rgba(190,230,215,.8)');
    const F = G.front === 'E' ? b.right : b.left;
    if (showDoor) doorFace(F, 0.5, 0.08, 18, '#6aa47e');
  } else if (k === 'ranch') {   // a red barn store with a white trim
    b = box(x + 0.3, y + 0.3, w - 0.6, d - 0.6, wh, S2.wall);
    const F = G.front === 'E' || G.front === 'W' ? b.right : b.left;
    wallRect(F, 0, 0.35, 0.65, 0, 18, '#7a3a30', '#fff', 1.4);
    wallLine(F, 0, 0.35, 0, 0.65, 18, '#fff', 1); wallLine(F, 0, 0.65, 0, 0.35, 18, '#fff', 1);
    gable(x + 0.2, y + 0.2, w - 0.4, d - 0.4, wh, 14, S2.roof, shade(S2.roof, 0.15));
  } else if (k === 'amuse') b = drawAmusement(G, x, y, w, d, ts);   // v0.41: rides in the open
  else if (CIVIC_WH[k]) b = drawCivic(k, G, x, y, w, d, wh, ts);   // v0.38: the new district's buildings
  else {
    b = box(x, y, w, d, wh, S2.wall);
    wallRect(b.left, 0, 0, 1, 0, 3, shade(S2.wall, -0.3)); wallRect(b.right, 0, 0, 1, 0, 3, shade(S2.wall, -0.25));
    const F = side ? b.right : b.left, Sd = side ? b.left : b.right;
    if (k === 'dealer' || k === 'mall') {   // big shop windows across the front
      wallRect(F, 0, 0.05, 0.95, 4, wh * 0.6, glassCol, '#e8edf2', 1.6);
      for (let i = 1; i < 6; i++) wallLine(F, 0, 0.05 + i * 0.15, 4, 0.05 + i * 0.15, wh * 0.6, '#e8edf2', 1);
      if (k === 'mall') { wallRect(F, 0, 0.05, 0.95, wh * 0.66, wh * 0.92, glassCol, '#e8edf2', 1.4); wallRect(Sd, 0, 0.1, 0.9, wh * 0.66, wh * 0.92, glassCol, '#e8edf2', 1.2); }
      if (showDoor) doorFace(F, 0.5, 0.08, 18, '#5b6470');
    } else {
      wallRect(F, 0, 0.08, 0.6, 5, 21, glassCol, '#fffaf0', 1.4);
      if (showDoor) doorFace(F, 0.8, 0.07, 19, shade(S2.roof, -0.2));
      if (showDoor) for (let i = 0; i < 10; i++) wallRect(F, 0, i / 10, (i + 1) / 10, 23, 28, i % 2 ? '#fffaf0' : S2.roof);   // the awning over the door
    }
    [0.3, 0.7].forEach(u => winFace(Sd, u, 0.08, 10, Math.min(24, wh - 6)));
    box(x - 0.1, y - 0.1, w + 0.2, d + 0.2, 3, shade(S2.wall, -0.12), wh);
    if (k === 'furniture') { const p = wallPt(F, 0, 0.32, 6); rrect(p.x - 7 * z, p.y - 4 * z, 14 * z, 6 * z, 2 * z, '#e5734f'); }
    if (k === 'school') {   // v0.22: a red-brick school with a clock and a flag
      wallMaterial(b, wh, 'brick', S2.wall, 0);
      [0.15, 0.85].forEach(u => winFace(F, u, 0.06, 6, 16)); [0.15, 0.4, 0.6, 0.85].forEach(u => winFace(F, u, 0.05, wh - 12, wh - 4));
      const p = wallPt(F, 0, 0.5, wh + 6); circle(p.x, p.y, 6 * z, '#fffaf0', '#3b3125', 1 * z); const tm = new Date(); line(p.x, p.y, p.x + Math.sin(tm.getHours() / 6 * Math.PI) * 3 * z, p.y - Math.cos(tm.getHours() / 6 * Math.PI) * 3 * z, '#3b3125', 1 * z); line(p.x, p.y, p.x + Math.sin(tm.getMinutes() / 30 * Math.PI) * 4.5 * z, p.y - Math.cos(tm.getMinutes() / 30 * Math.PI) * 4.5 * z, '#3b3125', 0.7 * z);
      const fp = iso(x + w + 0.4, y + d * 0.2), wv = Math.sin(ts / 280) * 1.5 * z; line(fp.x, fp.y, fp.x, fp.y - 48 * z, '#999', 1.2 * z); pg([[fp.x, fp.y - 48 * z], [fp.x + 7 * z, fp.y - 47 * z + wv * 0.5], [fp.x + 13 * z, fp.y - 45 * z + wv], [fp.x + 13 * z, fp.y - 39 * z + wv], [fp.x + 7 * z, fp.y - 41 * z + wv * 0.5], [fp.x, fp.y - 42 * z]], '#e5484d');
    }
    if (k === 'firestation') {   // big red doors for the engines
      [0.25, 0.62].forEach(u => { wallRect(F, 0, u - 0.15, u + 0.15, 0, 22, '#f4f1ea'); for (let r = 1; r < 5; r++) wallLine(F, 0, u - 0.15, r * 4.4, u + 0.15, r * 4.4, '#d6d0c4', 0.8); });
      const p = wallPt(F, 0, 0.5, 26); rrect(p.x - 16 * z, p.y - 3.5 * z, 32 * z, 7 * z, 1.5 * z, '#fffaf0'); if (z > 0.25) { ctx.fillStyle = '#c9433b'; ctx.font = `800 ${5 * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(curLang() === 'zh' ? '消防站' : 'FIRE', p.x, p.y + 0.3 * z); }
    }
    if (k === 'gas') { const p = wallPt(F, 0, 0.5, 26); rrect(p.x - 12 * z, p.y - 3.5 * z, 24 * z, 7 * z, 1.5 * z, '#e5484d'); emoji('⛽', p.x, p.y + 3.5 * z, 7 * z); }
    if (k === 'police') {   // v0.18: a blue sign, a flag and lights on the roof
      const p = wallPt(F, 0, 0.34, 15); rrect(p.x - 13 * z, p.y - 4 * z, 26 * z, 8 * z, 2 * z, '#2f5fb3');
      if (z > 0.25) { ctx.fillStyle = '#fff'; ctx.font = `800 ${5.4 * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(curLang() === 'zh' ? '警察' : 'POLICE', p.x, p.y + 0.3 * z); }
      const on = Math.floor(ts / 500) % 2, r0 = up(iso(x + w * 0.35, y + d * 0.5), (wh + 3) * z), r1 = up(iso(x + w * 0.5, y + d * 0.5), (wh + 3) * z);
      circle(r0.x, r0.y, 2.4 * z, on ? '#ff4d4d' : '#8a2a2a'); circle(r1.x, r1.y, 2.4 * z, on ? '#3a5fa8' : '#5aa2ff');
    }
  }
  if (NIGHT > 0.3) { const p = iso(x + w / 2, y + d); glow(p.x, p.y - 10 * z, 60 * z, 0.9); }
  const s = up(iso(x + w / 2, y + d / 2), (wh + (k === 'ranch' || k === 'nursery' ? 18 : k === 'station' ? 36 : k === 'museum' ? 16 : k === 'bowling' ? 84 : 6)) * z);
  if (z > 0.1) pill(`${S2.e} ${nm(S2)}`, s.x, s.y - 6 * z, '#fffdf8', '#3b3125', `800 ${Math.max(9, 12 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 22 * z));
  return { x0: iso(x, y + d).x, x1: iso(x + w, y).x, y0: s.y - 30 * z, y1: iso(x + w, y + d).y };
}
// Things on show in the car park (cars at the dealer, a police car, plants, a little pen, the pet shop dog, a sign),
// each drawn with its own depth so people and cars pass in front of and behind them properly.
function storeShow(st, objs, ts) {
  const G = storeGeo(st), k = G.k, z = cam.z, sl = storeSlots(G, 6), dir = G.along === 'x' ? '+x' : '+y';
  const put = (px, py, f) => objs.push({ d: px + py + 0.5, f: () => f(px, py) });
  if (k === 'dealer') sl.slice(0, 3).forEach(([px, py], i) => put(px, py, () => drawCarDir({ k: ['sedan', 'suv', 'sports'][i], color: ['#2f80ed', '#f4f4f0', '#e5484d'][i] }, px, py, G.dir, ts)));
  if (k === 'police' && sl[0]) { const [px, py] = sl[0]; put(px, py, () => { const PC = countyOf(SCENE_TOWN).police; drawCarDir({ k: 'sedan', color: PC.body, police: PC }, px, py, G.dir, ts); }); }   // v0.40: the county's police car
  if (k === 'nursery') sl.forEach(([px, py], i) => put(px, py, () => { const p = iso(px, py); ellipse(p.x, p.y, 6 * z, 3 * z, '#9a6a44'); circle(p.x, p.y - 6 * z, 5 * z, PAL.leaf[i % 3]); circle(p.x - 2 * z, p.y - 9 * z, 3 * z, ['#ef6f6c', '#f3d36b', '#e88bb7'][i % 3]); }));
  if (k === 'ranch' && sl[0]) { const [px, py] = sl[0]; put(px, py, () => { const p = iso(px, py); drawAnimal('cow', 2, p.x, p.y, z * 0.85, { face: 1, ts, seed: 2 }); });
    if (sl[1]) { const [qx, qy] = sl[1]; put(qx, qy, () => { const p = iso(qx, qy); drawAnimal('sheep', 2, p.x, p.y, z * 0.85, { face: -1, ts, seed: 3 }); }); } }
  if (k === 'petshop' && sl[0]) { const [px, py] = sl[0]; put(px, py, () => { const p = iso(px, py); drawAnimal('dog', 2, p.x, p.y, z * 0.8, { face: -1, ts, seed: 4, breed: 'shiba' }); }); }
  if (k === 'mall') sl.slice(0, 3).forEach(([px, py], i) => put(px, py, () => { const p = iso(px, py), wv = Math.sin(ts / 260 + i * 1.3) * 1.6 * z; line(p.x, p.y, p.x, p.y - 40 * z, '#888', 1 * z); pg([[p.x, p.y - 40 * z], [p.x + 5 * z, p.y - 39.5 * z + wv * 0.5], [p.x + 10 * z, p.y - 37 * z + wv], [p.x + 5 * z, p.y - 34.5 * z + wv * 0.5], [p.x, p.y - 33 * z]], ['#e5484d', '#2f80ed', '#f2c230'][i]); }));   // v0.21: flags flutter
  if (k === 'school' && sl[0]) { const [px, py] = sl[0]; put(px, py, () => drawCarDir({ k: 'boxtruck', color: '#f2c230' }, px, py, G.dir, ts)); }   // the school bus
  if (k === 'firestation' && sl[0]) { const [px, py] = sl[0]; put(px, py, () => { drawCarDir({ k: 'boxtruck', color: '#d63a32' }, px, py, G.dir, ts); const lp = up(iso(px, py), 22 * z), on = Math.floor(ts / 280) % 2; circle(lp.x - 3 * z, lp.y, 1.6 * z, on ? '#ff4d4d' : '#7a2020'); circle(lp.x + 3 * z, lp.y, 1.6 * z, on ? '#7a2020' : '#ff4d4d'); }); }
  if (k === 'gas') {   // a canopy over two pumps in the forecourt, and a car filling up
    const [cx0, cy0, cw, cd] = G.c, mx = cx0 + cw / 2, my = cy0 + cd / 2;
    put(mx - 0.6, my, () => { [[-1.2, 0], [1.2, 0]].forEach(([dx, dy]) => box(mx + dx - 0.2, my + dy - 0.15, 0.4, 0.3, 12, '#f4f4f0', 0, { top: '#e5484d' })); drawCarDir({ k: 'sedan', color: CAR_COLORS[Math.floor(ts / 9000) % CAR_COLORS.length] }, mx + 0.2, my + (G.along === 'x' ? 0.9 : 0), G.dir, ts); });
    put(mx, my + 0.1, () => { [[-1.6, -1], [1.6, -1], [-1.6, 1], [1.6, 1]].forEach(([dx, dy]) => box(mx + dx * (G.along === 'x' ? 1 : 0.5) - 0.06, my + dy * (G.along === 'x' ? 0.5 : 1) - 0.06, 0.12, 0.12, 30, '#d9d9d9', 0, { shadow: false })); box(mx - 2, my - 1.3, 4, 2.6, 3, '#f4f4f0', 30, { top: '#ffffff', shadow: false }); const fr = wallPt([iso(mx - 2, my + 1.3), iso(mx + 2, my + 1.3)], 0, 0.5, 31.5); rrect(fr.x - 30 * z, fr.y - 1.5 * z, 60 * z, 3 * z, 0.5 * z, '#e5484d'); });
  }
  if (k === 'hospital' && sl[0]) { const [px, py] = sl[0]; put(px, py, () => {   // v0.38: an ambulance, lights going
    drawCarDir({ k: 'boxtruck', color: '#f8f8f4' }, px, py, G.dir, ts);
    const lp = up(iso(px, py), 22 * z), on = Math.floor(ts / 260) % 2; circle(lp.x - 3 * z, lp.y, 1.6 * z, on ? '#ff4d4d' : '#7a2020'); circle(lp.x + 3 * z, lp.y, 1.6 * z, on ? '#3a6fe0' : '#ff4d4d'); }); }
  if (k === 'station' && sl[0]) { const [px, py] = sl[0]; put(px, py, () => drawCarDir({ k: 'sedan', color: '#f2c230' }, px, py, G.dir, ts)); }   // a taxi waiting
  if (k === 'museum' && sl[1]) { const [px, py] = sl[1]; put(px, py, () => drawCarDir({ k: 'boxtruck', color: '#f2c230' }, px, py, G.dir, ts)); }   // a school trip's bus
  if (k === 'realty' && sl[0]) { const [px, py] = sl[0]; put(px, py, () => { const p = iso(px, py); line(p.x, p.y, p.x, p.y - 16 * z, '#8a5a36', 1.6 * z); rrect(p.x - 8 * z, p.y - 20 * z, 16 * z, 8 * z, 1.5 * z, '#fffaf0', '#e5484d', 1 * z); }); }
}

// ---------- v0.41: the amusement park's rides ----------
// Drawn the same in town (from outside the fence) and inside the park. World coordinates; sc scales them (smaller in
// town). rider: a look to put on the ride (you, while you ride it).
const RIDE_COLS = ['#e5484d', '#f2c230', '#38a3e0', '#34b27b', '#a46ef0', '#ec6aa8', '#f28c28', '#2f6fb2'];
function rideRider(x, y, z, look, ts) { drawPerson(x, y, z, { look, face: 1, view: 'front', energy: 'great', ts, seed: 3, pose: 'sit', seatH: 0, wave: Math.floor(ts / 600) % 2 === 0 }); }
// a Ferris wheel standing at (px, py), facing you; R: its radius (px at zoom 1)
function ferrisWheel(px, py, R, ts, rider, sc = 1) {
  const z = cam.z * sc, b = iso(px, py), r = R * z, c = { x: b.x, y: b.y - r - 16 * z }, ang = ts / 9000;
  ellipse(b.x, b.y, r * 0.75, r * 0.2, 'rgba(0,0,0,.12)');
  [-1, 1].forEach(k => { line(b.x + k * r * 0.6, b.y, c.x, c.y, '#cfc9bd', 4 * z); line(b.x + k * r * 0.6, b.y - 2 * z, c.x, c.y, '#ebe6dc', 2 * z); });
  circle(c.x, c.y, r, null, '#ebe6dc', 3 * z); circle(c.x, c.y, r * 0.9, null, '#d6d0c4', 1.4 * z);
  for (let i = 0; i < 16; i++) { const a = ang + i / 16 * Math.PI * 2; line(c.x, c.y, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, 'rgba(235,230,220,.85)', 1 * z); }
  circle(c.x, c.y, 5 * z, '#e5484d', '#ffffff', 1.2 * z);
  for (let i = 0; i < 8; i++) {
    const a = ang + i / 8 * Math.PI * 2, gx = c.x + Math.cos(a) * r, gy = c.y + Math.sin(a) * r, col = RIDE_COLS[i];
    line(gx, gy, gx, gy + 4 * z, '#8a9099', 1.2 * z);
    rrect(gx - 7 * z, gy + 3 * z, 14 * z, 12 * z, 4 * z, col, shade(col, -0.3), 0.7 * z);
    rrect(gx - 5.5 * z, gy + 5 * z, 11 * z, 4.5 * z, 1.2 * z, 'rgba(220,240,255,.9)');
    if (i === 0 && rider) { rideRider(gx, gy + 15 * z, z * 0.42, rider, ts); rrect(gx - 7 * z, gy + 10 * z, 14 * z, 5 * z, 2 * z, col); }
    if (NIGHT > 0.3) glow(gx, gy + 9 * z, 10 * z, 0.4);
  }
  if (NIGHT > 0.3) for (let i = 0; i < 24; i++) { const a = ang + i / 24 * Math.PI * 2, q = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }; circle(q.x, q.y, 1.6 * z, RIDE_COLS[i % 8]); glow(q.x, q.y, 6 * z, 0.4); }
}
// a roller coaster: a loop of track round (cx, cy) (rx, ry tiles), up on posts with a big hill and a dip; a train of
// three cars going round
function coasterH(u) { return 14 + 34 * Math.pow(Math.max(0, Math.sin(u)), 2) + 12 * Math.pow(Math.sin(2 * u + 0.8), 2); }
function coaster(cx, cy, rx, ry, ts, rider, sc = 1) {
  const z = cam.z * sc, n = 64, pt = u => { const p = iso(cx + Math.cos(u) * rx, cy + Math.sin(u) * ry); return { g: p, t: up(p, coasterH(u) * z) }; };
  const pts = Array.from({ length: n + 1 }, (_, i) => pt(i / n * Math.PI * 2));
  for (let i = 0; i < n; i += 4) { const q = pts[i]; line(q.g.x, q.g.y, q.t.x, q.t.y, '#c9c3b7', 1.6 * z); if (i % 8 === 0) line(q.g.x - 3 * z, q.g.y, q.t.x, q.t.y, '#d6d0c4', 1 * z); }
  const rail = (back) => { ctx.beginPath(); pts.forEach((q, i) => { const front = Math.sin(i / n * Math.PI * 2) > 0; if (front === back) { ctx.moveTo(q.t.x, q.t.y); return; } i ? ctx.lineTo(q.t.x, q.t.y) : ctx.moveTo(q.t.x, q.t.y); }); ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 3.4 * z; ctx.lineJoin = 'round'; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1 * z; ctx.stroke(); };
  rail(true);
  const u0 = (ts / 1000 * 0.9) % (Math.PI * 2);
  for (let k = 0; k < 3; k++) {
    const u = u0 - k * 0.16, q = pt(u), q2 = pt(u + 0.05), ang = Math.atan2(q2.t.y - q.t.y, q2.t.x - q.t.x), col = ['#f2c230', '#38a3e0', '#34b27b'][k];
    ctx.save(); ctx.translate(q.t.x, q.t.y); ctx.rotate(ang);
    rrect(-7 * z, -7 * z, 14 * z, 7 * z, 2 * z, col, shade(col, -0.35), 0.6 * z);
    if (k === 0 && rider) { ctx.rotate(-ang); rideRider(0, -3 * z, z * 0.42, rider, ts); ctx.rotate(ang); rrect(-7 * z, -4 * z, 14 * z, 4 * z, 1.5 * z, col); }
    else { circle(-2.5 * z, -9 * z, 2.3 * z, '#f3c59f'); circle(2.8 * z, -9 * z, 2.3 * z, '#d39a6c'); }
    ctx.restore();
  }
  rail(false);
}
// a carousel at (px, py), r tiles round: a turning floor of horses going up and down under a striped roof
function carousel(px, py, r, ts, rider, sc = 1) {
  const z = cam.z * sc, c = iso(px, py), rx = r * 34 * z, ry = r * 17 * z, H = 46 * z, ang = ts / 2400;
  ellipse(c.x, c.y + 3 * z, rx * 1.05, ry * 1.05, 'rgba(0,0,0,.14)');
  ellipse(c.x, c.y + 2 * z, rx, ry, '#c99a6b'); ellipse(c.x, c.y, rx, ry, '#f4ead8', '#c9893a', 1.2 * z);
  const horses = Array.from({ length: 6 }, (_, i) => { const a = ang + i / 6 * Math.PI * 2; return { i, a, x: c.x + Math.cos(a) * rx * 0.72, y: c.y + Math.sin(a) * ry * 0.72, bob: Math.sin(ts / 400 + i * 1.7) * 4 * z }; }).sort((p, q) => p.y - q.y);
  const horse = h => {
    line(h.x, h.y, h.x, h.y - H, '#e8c66a', 1.4 * z);
    const hy = h.y - 16 * z + h.bob, col = ['#ffffff', '#f2c6d8', '#c9e6f7', '#ffffff', '#f7e3a8', '#d8f0c8'][h.i], dir = Math.cos(h.a) > 0 ? -1 : 1;
    ellipse(h.x, hy, 9 * z, 4.5 * z, col, '#8a6a4a', 0.6 * z);
    ellipse(h.x + dir * 8 * z, hy - 5 * z, 3.2 * z, 4.5 * z, col, '#8a6a4a', 0.6 * z);
    line(h.x - 5 * z, hy + 3 * z, h.x - 6 * z, hy + 9 * z, '#8a6a4a', 1.2 * z); line(h.x + 5 * z, hy + 3 * z, h.x + 6 * z, hy + 9 * z, '#8a6a4a', 1.2 * z);
    if (h.i === 0 && rider) rideRider(h.x, hy + 2 * z, z * 0.45, rider, ts);
  };
  horses.filter(h => h.y < c.y).forEach(horse);
  rrect(c.x - 4 * z, c.y - H, 8 * z, H, 2 * z, '#e8c66a');
  horses.filter(h => h.y >= c.y).forEach(horse);
  const top = c.y - H, apex = { x: c.x, y: top - 22 * z };
  for (let k = 0; k < 12; k++) {   // the striped roof
    const a0 = k / 12 * Math.PI * 2 + ang * 0.3, a1 = (k + 1) / 12 * Math.PI * 2 + ang * 0.3;
    if (Math.sin((a0 + a1) / 2) < -0.2) continue;
    poly([apex, { x: c.x + Math.cos(a0) * rx * 1.08, y: top + Math.sin(a0) * ry * 1.08 }, { x: c.x + Math.cos(a1) * rx * 1.08, y: top + Math.sin(a1) * ry * 1.08 }], k % 2 ? '#ffffff' : '#e5484d');
  }
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; if (Math.sin(a) < -0.3) continue; const q = { x: c.x + Math.cos(a) * rx * 1.08, y: top + Math.sin(a) * ry * 1.08 }; circle(q.x, q.y + 2 * z, 2.2 * z, k % 2 ? '#f2c230' : '#e5484d'); if (NIGHT > 0.3) glow(q.x, q.y, 6 * z, 0.4); }
  circle(apex.x, apex.y, 3 * z, '#f2c230');
}
// bumper cars: a fenced floor (x, y, w, d tiles) with a net roof on poles; little cars bumping round
function bumperCars(x, y, w, d, ts, rider, sc = 1) {
  const z = cam.z * sc;
  flatRect(x, y, w, d, '#5b6470'); flatRect(x + 0.15, y + 0.15, w - 0.3, d - 0.3, '#6c7682');
  const cars = [0, 1, 2, 3].map(i => { const t = ts / 1000 * (0.55 + i * 0.12) + i * 1.9; return { i, x: x + 0.6 + (w - 1.2) * (0.5 + 0.5 * Math.sin(t * 1.3 + i)), y: y + 0.6 + (d - 1.2) * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 2.1)) }; }).sort((a, b) => a.x + a.y - b.x - b.y);
  cars.forEach(cr => {
    const p = iso(cr.x, cr.y), col = RIDE_COLS[cr.i * 2];
    line(p.x, p.y - 10 * z, p.x, p.y - 34 * z, '#8a9099', 1 * z);
    ellipse(p.x, p.y, 13 * z, 7 * z, '#2d2d2d'); ellipse(p.x, p.y - 4 * z, 12 * z, 6.5 * z, col, shade(col, -0.3), 0.8 * z);
    if (cr.i === 0 && rider) rideRider(p.x, p.y - 2 * z, z * 0.45, rider, ts);
    else { circle(p.x, p.y - 12 * z, 3.3 * z, ['#f3c59f', '#d39a6c', '#9a6440', '#ffe0c4'][cr.i]); }
  });
  [[x, y], [x + w, y], [x, y + d], [x + w, y + d]].forEach(([px, py]) => { const a = iso(px, py), b = up(a, 34 * z); line(a.x, a.y, b.x, b.y, '#c9cfd6', 1.6 * z); });
  const T = (px, py) => up(iso(px, py), 34 * z);
  poly([T(x, y), T(x + w, y), T(x + w, y + d), T(x, y + d)], 'rgba(60,70,90,.12)', 'rgba(200,205,215,.8)', 1 * z);
  for (let k = 1; k < 4; k++) { const a = T(x + w * k / 4, y), b = T(x + w * k / 4, y + d); line(a.x, a.y, b.x, b.y, 'rgba(200,205,215,.6)', 0.6 * z); }
  if (NIGHT > 0.3) for (let k = 0; k < 4; k++) { const q = T(x + w * (k + 0.5) / 4, y + d / 2); glow(q.x, q.y + 6 * z, 18 * z, 0.5); }
}
// the park seen from the town: a fenced lawn with paths, the wheel, the coaster, the carousel, the bumper cars and a
// gateway with the park's name. G: storeGeo; returns its box like box() does.
function drawAmusement(G, x, y, w, d, ts) {
  const z = cam.z, sc = 0.55, along = w >= d, at = (fx, fy) => (along ? [x + fx * w, y + fy * d] : [x + (1 - fy) * w, y + fx * d]);
  flatRect(x, y, w, d, '#9fd07c');
  const [p0x, p0y] = at(0.05, 0.62), [p1x, p1y] = at(0.95, 0.66); flatRect(Math.min(p0x, p1x), Math.min(p0y, p1y), Math.abs(p1x - p0x) || 0.8, Math.abs(p1y - p0y) || 0.8, '#e6dccb');
  const [q0x, q0y] = at(0.48, 0.62), [q1x, q1y] = at(0.54, 1.0); flatRect(Math.min(q0x, q1x), Math.min(q0y, q1y), Math.abs(q1x - q0x) || 0.8, Math.abs(q1y - q0y) || 0.8, '#e6dccb');
  const fence = (ax, ay, bx, by) => { const a = iso(ax, ay), b = iso(bx, by); line(a.x, a.y - 5 * z, b.x, b.y - 5 * z, '#f4ead8', 1.6 * z); for (let k = 0; k <= 10; k++) { const q = lerp(a, b, k / 10); line(q.x, q.y, q.x, q.y - 6 * z, '#e8dcc6', 1.2 * z); } };
  fence(x, y, x + w, y); fence(x, y, x, y + d);
  const [cx, cy] = at(0.66, 0.3); coaster(cx, cy, along ? w * 0.27 : w * 0.22, along ? d * 0.2 : d * 0.27, ts, null, 1.15);
  const [fx, fy] = at(0.2, 0.3); ferrisWheel(fx, fy, 60, ts, null, 1);
  const [bx, by] = at(0.64, 0.74); bumperCars(bx - 2, by - 1.4, 4, 2.8, ts, null, 1);
  const [kx, ky] = at(0.22, 0.76); carousel(kx, ky, 1.7, ts, null, 1);
  fence(x + w, y, x + w, y + d); fence(x, y + d, x + w, y + d);
  // the gateway where you go in: two posts and a striped arch with the name
  const gx = G.front === 'S' ? [x + w / 2, y + d] : G.front === 'N' ? [x + w / 2, y] : G.front === 'E' ? [x + w, y + d / 2] : [x, y + d / 2], ax = G.front === 'S' || G.front === 'N';
  const pa = iso(gx[0] - (ax ? 1.3 : 0), gx[1] - (ax ? 0 : 1.3)), pb = iso(gx[0] + (ax ? 1.3 : 0), gx[1] + (ax ? 0 : 1.3));
  [pa, pb].forEach(p => rrect(p.x - 2.5 * z, p.y - 30 * z, 5 * z, 30 * z, 1.5 * z, '#e5484d'));
  ctx.beginPath(); ctx.moveTo(pa.x, pa.y - 30 * z); ctx.quadraticCurveTo((pa.x + pb.x) / 2, (pa.y + pb.y) / 2 - 48 * z, pb.x, pb.y - 30 * z); ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 6 * z; ctx.stroke(); ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 2 * z; ctx.setLineDash([4 * z, 4 * z]); ctx.stroke(); ctx.setLineDash([]);
  if (z > 0.18) { const m = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 - 40 * z }; circle(m.x, m.y, 7 * z, '#ffffff', '#e5484d', 1.2 * z); emoji('🎡', m.x, m.y + 1 * z, 9 * z); }
  [at(0.4, 0.55), at(0.9, 0.5), at(0.08, 0.92)].forEach(([bx2, by2], i) => { const p = iso(bx2, by2), wv = Math.sin(ts / 400 + i) * 1.5 * z; line(p.x, p.y, p.x + wv, p.y - 22 * z, '#888', 0.6 * z); circle(p.x + wv, p.y - 26 * z, 4 * z, RIDE_COLS[(i * 3) % 8]); });   // balloons
  return { left: [iso(x, y + d), iso(x + w, y + d)], right: [iso(x + w, y + d), iso(x + w, y)] };
}
// v0.38: the new district's buildings: a hospital (floors of windows, a red cross, a helipad), a bowling alley (a
// giant pin on the roof), a swimming centre (a glass front and a glass roof), a museum (columns and a pediment) and a
// train station (brick, with a clock tower). G: storeGeo; returns the box like box() does.
const CIVIC_WH = { hospital: 62, bowling: 30, aquatic: 26, museum: 34, station: 30, amuse: 150 };
function drawCivic(k, G, x, y, w, d, wh, ts) {
  const S2 = STORES[k], z = cam.z, side = G.front === 'E' || G.front === 'W', showDoor = G.front === 'S' || G.front === 'E', lit = NIGHT > 0.3;
  const glass = lit ? '#ffe39a' : '#a9dcf5', zh = curLang() === 'zh';
  const b = box(x, y, w, d, wh, S2.wall), F = side ? b.right : b.left, Sd = side ? b.left : b.right;
  const sign = (face, u, h, text, size, col) => { if (z > 0.22) wallText(face, u, h, text, Math.max(6, size * z), col); };
  if (k === 'hospital') {
    for (let f = 0; f < 4; f++) [F, Sd].forEach(face => { for (let i = 0; i < 8; i++) { const u = 0.06 + i * 0.113; if (face === F && f === 0 && u > 0.3 && u < 0.66) continue; wallRect(face, 0, u, u + 0.075, 14 + f * 11, 21 + f * 11, lit && hash(i + f, k.length + (face === F ? 0 : 9)) > 0.45 ? '#ffe39a' : '#bfe0f0', '#dfe6ea', 0.8); } });
    [F, Sd].forEach((face, i) => wallRect(face, 0, 0, 1, wh - 5, wh, i ? '#c9433b' : '#e5484d'));
    wallRect(F, 0, 0.82, 0.94, wh - 20, wh - 7, '#ffffff'); wallRect(F, 0, 0.865, 0.895, wh - 18.5, wh - 8.5, '#e5484d'); wallRect(F, 0, 0.835, 0.925, wh - 15, wh - 12, '#e5484d');
    if (showDoor) {
      wallRect(F, 0, 0.36, 0.64, 0, 11, glass, '#dfe6ea', 1); wallLine(F, 0, 0.5, 0, 0.5, 11, '#dfe6ea', 1.2);
      wallRect(F, 0, 0.33, 0.67, 11, 16, '#e5484d'); sign(F, 0.5, 13.6, zh ? '急诊 · 医院' : 'EMERGENCY', 4, '#fff');
    }
    const hp = up(iso(x + w * 0.62, y + d * 0.5), wh * z); ellipse(hp.x, hp.y, 13 * z, 6.5 * z, '#5b6470', '#f2c230', 1.2 * z);
    if (z > 0.25) { ctx.font = `900 ${8 * z}px ${UI_FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', hp.x, hp.y + 0.5 * z); }
    box(x + w * 0.15, y + d * 0.3, 1.2, 1.2, 6, '#c9cfd6', wh, { shadow: false });   // machinery on the roof
  } else if (k === 'bowling') {
    [F, Sd].forEach(face => { wallRect(face, 0, 0, 1, wh - 7, wh - 5, lit ? '#ff7ac4' : '#ec6aa8'); wallRect(face, 0, 0, 1, wh - 10, wh - 9, lit ? '#5cf0b8' : '#38d39f'); });
    wallRect(F, 0, 0.06, 0.5, 4, 16, glass, '#e8edf2', 1.2); for (let u = 0.17; u < 0.5; u += 0.11) wallLine(F, 0, u, 4, u, 16, '#e8edf2', 1);
    if (showDoor) { wallRect(F, 0, 0.66, 0.84, 0, 15, '#1d2547', '#f2c230', 1.2); wallLine(F, 0, 0.75, 0, 0.75, 15, '#f2c230', 1); }
    sign(F, 0.28, 18.5, 'BOWL', 7, lit ? '#ffe066' : '#f2c230');
    [0.3, 0.7].forEach(u => winFace(Sd, u, 0.07, 8, 18, { frame: '#f2c230' }));
    // the giant pin and a ball on the roof
    const c = up(iso(x + w * 0.45, y + d * 0.45), wh * z), q = 2 * z;   // q: the giant pin's scale
    ellipse(c.x, c.y, 9 * q, 3.5 * q, 'rgba(0,0,0,.15)');
    ellipse(c.x, c.y - 12 * q, 6.5 * q, 11 * q, '#fbfbf7', 'rgba(0,0,0,.12)', 0.8 * z); ellipse(c.x, c.y - 26 * q, 3.2 * q, 5 * q, '#fbfbf7'); circle(c.x, c.y - 32 * q, 4 * q, '#fbfbf7', 'rgba(0,0,0,.12)', 0.8 * z);
    rrect(c.x - 3.3 * q, c.y - 25 * q, 6.6 * q, 1.6 * q, 0.5 * q, '#e5484d'); rrect(c.x - 3.1 * q, c.y - 22.4 * q, 6.2 * q, 1.4 * q, 0.5 * q, '#e5484d');
    circle(c.x - 3 * q, c.y - 35 * q, 1.2 * q, 'rgba(255,255,255,.9)');
    const bp = up(iso(x + w * 0.68, y + d * 0.58), wh * z); circle(bp.x, bp.y - 5.5 * q, 5.5 * q, '#3a4cc0'); [[-1.5, -7.5], [1, -8], [-0.2, -5.6]].forEach(([dx, dy]) => circle(bp.x + dx * q, bp.y + dy * q, 0.8 * q, '#141a3a')); circle(bp.x - 2 * q, bp.y - 8 * q, 1.4 * q, 'rgba(255,255,255,.35)');
  } else if (k === 'aquatic') {
    wallRect(F, 0, 0.04, 0.96, 3, wh - 4, lit ? '#ffe7a6' : '#8fd0ee', '#e8f4fa', 1.2);
    for (let u = 0.04; u < 0.96; u += 0.1) wallLine(F, 0, u, 3, u, wh - 4, '#e8f4fa', 1);
    if (!lit && z > 0.3) for (let r = 0; r < 3; r++) { const h0 = 6 + r * 4, ph = ts / 900 + r; for (let u = 0.08; u < 0.92; u += 0.08) wallLine(F, 0, u, h0 + Math.sin(u * 20 + ph) * 0.8, u + 0.04, h0 + Math.sin(u * 20 + ph + 1) * 0.8, 'rgba(255,255,255,.55)', 0.8); }   // the pool shimmering through the glass
    if (showDoor) { wallRect(F, 0, 0.44, 0.56, 0, 12, '#2f6fb2', '#e8f4fa', 1); }
    [0.25, 0.75].forEach(u => winFace(Sd, u, 0.1, 6, 18, { frame: '#38a3e0' }));
    const roof = side ? gableY : gableX; roof(x + 0.1, y + 0.1, w - 0.2, d - 0.2, wh, 9, 'rgba(160,215,240,.92)', shade(S2.wall, 0.02));
    const p = wallPt(F, 0, 0.2, wh - 2); if (z > 0.22) { rrect(p.x - 12 * z, p.y - 5 * z, 24 * z, 9 * z, 2 * z, '#38a3e0'); emoji('🏊', p.x - 6 * z, p.y - 0.5 * z, 6 * z); ctx.font = `800 ${4 * z}px ${UI_FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(zh ? '游泳' : 'POOL', p.x + 4 * z, p.y - 0.5 * z); }
  } else if (k === 'museum') {
    wallMaterial(b, wh, 'stone', S2.wall, 0);
    wallRect(F, 0, 0, 1, wh - 7, wh, shade(S2.wall, 0.06)); wallLine(F, 0, 0, wh - 7, 1, wh - 7, 'rgba(90,80,60,.35)', 0.8);
    if (showDoor) { wallRect(F, 0, 0.42, 0.58, 0, 16, '#5a4632', '#c9b88f', 1); wallRect(F, 0, 0.44, 0.56, 13, 16, '#c9a24a'); }
    for (let i = 0; i < 6; i++) { const u = 0.08 + i * 0.168; wallRect(F, 0, u - 0.025, u + 0.025, 1, wh - 8, '#fbf7ee', 'rgba(0,0,0,.1)', 0.6); wallRect(F, 0, u - 0.034, u + 0.034, wh - 9, wh - 7, '#fffaf0'); wallRect(F, 0, u - 0.034, u + 0.034, 0, 1.6, '#fffaf0'); wallLine(F, 0, u + 0.012, 1.6, u + 0.012, wh - 9, 'rgba(0,0,0,.08)', 0.8); }
    [0.25, 0.75].forEach((u, i) => { wallRect(F, 0, u - 0.035, u + 0.035, wh - 23, wh - 11, i ? '#2f6fb2' : '#c9433b'); if (z > 0.35) { const p = wallPt(F, 0, u, wh - 17); emoji(i ? '🪐' : '🦖', p.x, p.y, 5 * z); } });
    [0.3, 0.7].forEach(u => winFace(Sd, u, 0.06, 8, 22, { frame: '#efe8da' }));
    const roof = side ? gableX : gableY; roof(x, y, w, d, wh, 12, '#9a8a6a', shade(S2.wall, 0.04));   // the pediment faces the street
    sign(F, 0.5, wh - 3.5, zh ? '博 物 馆' : 'MUSEUM', 4.5, '#6b5a3a');
  } else {   // the station
    wallMaterial(b, wh, 'brick', S2.wall, 0);
    [0.12, 0.3, 0.7, 0.88].forEach(u => { winFace(F, u, 0.05, 6, 20, { frame: '#f4efe4' }); const p = wallPt(F, 0, u, 20); ellipse(p.x, p.y, 4 * z, 2 * z, '#f4efe4'); });
    if (showDoor) { wallRect(F, 0, 0.43, 0.57, 0, 17, glass, '#f4efe4', 1.2); wallLine(F, 0, 0.5, 0, 0.5, 17, '#f4efe4', 1); }
    [0.25, 0.5, 0.75].forEach(u => winFace(Sd, u, 0.06, 8, 20, { frame: '#f4efe4' }));
    box(x - 0.1, y - 0.1, w + 0.2, d + 0.2, 3, S2.roof, wh, { shadow: false });
    // the clock tower in the middle of the front
    const tx = x + w / 2 - 0.9, ty = y + d / 2 - 0.9, tb = box(tx, ty, 1.8, 1.8, 30, shade(S2.wall, 0.04), wh + 3, { shadow: false });
    const cf = side ? tb.right : tb.left, cp = wallPt(cf, wh + 3, 0.5, 20); circle(cp.x, cp.y, 5.5 * z, '#fffaf0', '#3b3125', 1 * z);
    const tm = new Date(); line(cp.x, cp.y, cp.x + Math.sin(tm.getHours() / 6 * Math.PI) * 2.8 * z, cp.y - Math.cos(tm.getHours() / 6 * Math.PI) * 2.8 * z, '#3b3125', 1 * z); line(cp.x, cp.y, cp.x + Math.sin(tm.getMinutes() / 30 * Math.PI) * 4 * z, cp.y - Math.cos(tm.getMinutes() / 30 * Math.PI) * 4 * z, '#3b3125', 0.7 * z);
    pyramid(tx - 0.15, ty - 0.15, 2.1, 2.1, wh + 33, 12, S2.roof);
    sign(F, 0.5, 24.5, zh ? '🚉 火车站' : '🚉 STATION', 4.6, '#fffaf0');
  }
  if (NIGHT > 0.3 && k !== 'aquatic') { const p = wallPt(F, 0, 0.5, 14); glow(p.x, p.y, 40 * z, 0.8); }
  return b;
}

// v0.18: a plush toy sitting on the floor (won at the mall's claw machine)
function drawPlush(k, x, y) {
  const z = cam.z, c = iso(x + 0.5, y + 0.5);
  const col = { plushbear: '#b07a4a', plushbunny: '#f4efe6', plushcat: '#f2a33a', plushdino: '#6cbf73', plushduck: '#f2d24b', plushpanda: '#fbfbf7' }[k] || '#b07a4a';
  const dk = shade(col, -0.18), cx = c.x, by = c.y - 2 * z;
  ellipse(cx, c.y, 9 * z, 4 * z, 'rgba(0,0,0,.15)');
  if (k === 'plushdino') [[-6, -14], [-3, -18], [1, -19]].forEach(([dx, dy]) => pg([[cx + dx * z, by + (dy + 4) * z], [cx + (dx + 2) * z, by + (dy - 1) * z], [cx + (dx + 4) * z, by + (dy + 4) * z]], '#3f9a52'));
  ellipse(cx, by - 6 * z, 7.5 * z, 7 * z, col);                      // body
  ellipse(cx - 6 * z, by - 1 * z, 3 * z, 2.2 * z, dk); ellipse(cx + 6 * z, by - 1 * z, 3 * z, 2.2 * z, dk);   // feet
  const hy = by - 16 * z;
  if (k === 'plushbunny') { ellipse(cx - 2.6 * z, hy - 9 * z, 1.8 * z, 6 * z, col); ellipse(cx + 2.6 * z, hy - 9 * z, 1.8 * z, 6 * z, col); ellipse(cx - 2.6 * z, hy - 9 * z, 0.8 * z, 4 * z, '#f4a6b8'); ellipse(cx + 2.6 * z, hy - 9 * z, 0.8 * z, 4 * z, '#f4a6b8'); }
  if (k === 'plushcat') { pg([[cx - 6 * z, hy - 2 * z], [cx - 5 * z, hy - 9 * z], [cx - 1.5 * z, hy - 5 * z]], col); pg([[cx + 6 * z, hy - 2 * z], [cx + 5 * z, hy - 9 * z], [cx + 1.5 * z, hy - 5 * z]], col); }
  if (k === 'plushbear' || k === 'plushpanda') { circle(cx - 5 * z, hy - 5 * z, 2.6 * z, k === 'plushpanda' ? '#2d2d2d' : dk); circle(cx + 5 * z, hy - 5 * z, 2.6 * z, k === 'plushpanda' ? '#2d2d2d' : dk); }
  circle(cx, hy, 6.4 * z, col);                                      // head
  if (k === 'plushpanda') { ellipse(cx - 2.4 * z, hy, 1.8 * z, 2.2 * z, '#2d2d2d'); ellipse(cx + 2.4 * z, hy, 1.8 * z, 2.2 * z, '#2d2d2d'); }
  circle(cx - 2.2 * z, hy - 0.4 * z, 0.9 * z, k === 'plushpanda' ? '#fff' : '#2d2d2d'); circle(cx + 2.2 * z, hy - 0.4 * z, 0.9 * z, k === 'plushpanda' ? '#fff' : '#2d2d2d');
  if (k === 'plushduck') ellipse(cx, hy + 2.2 * z, 2.6 * z, 1.3 * z, '#f59e0b'); else circle(cx, hy + 1.8 * z, 0.9 * z, '#5b3a2a');
  ellipse(cx, by - 5 * z, 4 * z, 3.6 * z, shade(col, 0.15));
}

// v0.19, v0.21: the garage, in the style of its level (n = its number of spaces): the cars inside show through
// the open doors (or through the glass, or under the carport roof).
function drawGarage(x, y, n, cars, ts) {
  const lv = Math.max(1, GARAGE.findIndex(g => g && g.cap === n)), G = GARAGE[lv], z = cam.z, w = garageSize(lv).w, d = 3, bay = (w - 0.4) / n;
  const carAt = i => { const car = cars[i]; if (!car) return; const L = (CAR_SPEC[car.k] || CAR_SPEC.mini).len || 2.4; drawCarDir(car, x + 0.2 + bay * (i + 0.5), y + d - L / 2 - 0.15, '+y', ts); };
  const A = iso(x, y), B = iso(x + w, y), C = iso(x + w, y + d), D = iso(x, y + d);
  if (G.style === 'carport') {   // a concrete pad, four posts and a metal roof
    flatRect(x - 0.1, y - 0.1, w + 0.2, d + 0.4, '#cdc7bb'); flatRect(x, y, w, d, '#d9d4c9');
    cars.forEach((c, i) => { if (i < n) carAt(i); });
    [[x + 0.05, y + 0.05], [x + w - 0.2, y + 0.05], [x + 0.05, y + d - 0.2], [x + w - 0.2, y + d - 0.2]].forEach(([px, py]) => box(px, py, 0.15, 0.15, 26, '#8a939e', 0, { shadow: false }));
    const r = box(x - 0.15, y - 0.15, w + 0.3, d + 0.3, 2.2, '#7d8794', 26, { top: '#9aa3ad' });
    for (let k = 1; k < 8; k++) wallLine(r.left, 26, k / 8, 0, k / 8, 2.2, 'rgba(255,255,255,.35)', 0.6);
    return { x0: D.x, x1: B.x, y0: up(A, 30 * z).y, y1: C.y };
  }
  const H = { wood: 30, brick: 32, modern: 32, showroom: 36 }[G.style], DH = { wood: 22, brick: 22, modern: 23, showroom: 30 }[G.style];
  const wall = { wood: '#b07a4a', brick: '#a94b37', modern: '#f1efea', showroom: '#f4f5f7' }[G.style];
  const face = [D, C], U = v => v / w;
  flatRect(x - 0.05, y + d - 0.05, w + 0.1, 0.55, G.style === 'showroom' ? '#d9dde2' : '#c9c3b6');   // the apron
  if (G.style === 'showroom') {   // dark polished floor, lit platforms, glass all round
    softShadow(x, y, w, d, H);
    flatRect(x, y, w, d, '#eef1f4'); for (let i = 1; i < w; i++) { const a = iso(x + i, y), b = iso(x + i, y + d); line(a.x, a.y, b.x, b.y, 'rgba(160,170,180,.35)', 0.6 * z); }
    for (let i = 0; i < n; i++) { const c = iso(x + 0.2 + bay * (i + 0.5), y + d / 2 + 0.2); ellipse(c.x, c.y, 26 * z, 13 * z, `rgba(255,230,160,${0.25 + 0.12 * Math.sin(ts / 700 + i)})`); }
    poly([A, B, up(B, H * z), up(A, H * z)], '#f7f8fa'); poly([A, D, up(D, H * z), up(A, H * z)], '#e6e9ee');
    cars.forEach((c, i) => { if (i < n) carAt(i); });
    poly([D, C, up(C, H * z), up(D, H * z)], 'rgba(170,215,245,.18)', '#2d3036', 1.4 * z);
    poly([C, B, up(B, H * z), up(C, H * z)], 'rgba(150,200,235,.26)', '#2d3036', 1.4 * z);
    for (let i = 1; i < n; i++) wallLine(face, 0, U(0.2 + bay * i), 0, U(0.2 + bay * i), H, '#1b1d22', 1.6);
    wallRect(face, 0, 0, 1, 0, 1.5, '#1b1d22');
    wallRect(face, 0, 0.08, 0.5, H * 0.35, H * 0.85, 'rgba(255,255,255,.12)', null);   // a reflection
    const r = box(x - 0.3, y - 0.3, w + 0.6, d + 0.6, 2.6, '#2d3036', H, { top: '#f4f5f7' });
    for (let i = 0; i < n * 2; i++) { const q = wallPt(r.left, H, (i + 0.5) / (n * 2), -0.5); circle(q.x, q.y, 1.4 * z, '#fff3c4'); }
    return { x0: D.x, x1: B.x, y0: up(A, (H + 4) * z).y, y1: C.y };
  }
  softShadow(x, y, w, d, H);
  poly([D, C, up(C, H * z), up(D, H * z)], '#3c3a37');   // inside, seen through the open doors
  wallRect(face, 0, 0, 1, DH, H, wall);   // above the doors
  for (let i = 0; i <= n; i++) { const a = i === 0 ? 0 : 0.2 + bay * i - 0.12, b = i === n ? w : 0.2 + bay * i + 0.12; wallRect(face, 0, U(a), U(b), 0, DH, wall); }
  const doorCol = { wood: '#f4efe6', brick: '#5a3a2a', modern: '#d9dde2' }[G.style];
  for (let i = 0; i < n; i++) {
    const a = U(0.2 + bay * i + 0.12), b = U(0.2 + bay * (i + 1) - 0.12);
    if (!cars[i]) {
      wallRect(face, 0, a, b, 0, DH, doorCol);
      if (G.style === 'wood') for (let k = 1; k < 5; k++) wallLine(face, 0, a, k * DH / 5, b, k * DH / 5, '#cfc6b6', 0.8);
      if (G.style === 'brick') { wallLine(face, 0, (a + b) / 2, 0, (a + b) / 2, DH, '#3a2418', 1); wallRect(face, 0, a + (b - a) * 0.1, b - (b - a) * 0.1, DH * 0.7, DH * 0.88, '#bfe6f7'); }
      if (G.style === 'modern') { for (let k = 1; k < 4; k++) wallLine(face, 0, a, k * DH / 4, b, k * DH / 4, '#b8c0c9', 1); wallRect(face, 0, a, b, DH * 0.62, DH * 0.9, 'rgba(200,225,245,.8)'); }
    } else wallRect(face, 0, a, b, DH - 3, DH, doorCol);   // rolled up
  }
  poly([C, B, up(B, H * z), up(C, H * z)], vgrad([C, B, up(B, H * z), up(C, H * z)], shade(wall, -0.06), 0.05, -0.06), 'rgba(0,0,0,.06)');
  const bx = { left: [D, C], right: [C, B] };
  if (G.style === 'wood' || G.style === 'brick') wallMaterial(bx, H, G.style, wall, 0);
  if (G.style === 'brick') winFace([C, B], 0.5, 0.12, 12, 22);
  // the cars inside show through the open doors
  ctx.save(); ctx.beginPath();
  const P = (u, h) => up(lerp(D, C, u), h * z);
  cars.forEach((car, i) => { if (!car || i >= n) return; const a = U(0.2 + bay * i + 0.12), b = U(0.2 + bay * (i + 1) - 0.12), q = [P(a, 0), P(b, 0), P(b, DH - 3), P(a, DH - 3)]; ctx.moveTo(q[0].x, q[0].y); q.slice(1).forEach(t2 => ctx.lineTo(t2.x, t2.y)); ctx.closePath(); });
  ctx.clip(); cars.forEach((c, i) => { if (i < n) carAt(i); }); ctx.restore();
  // the roof
  if (G.style === 'wood') gableX(x - 0.15, y - 0.15, w + 0.3, d + 0.3, H, 16, '#6b4428', wall);
  else if (G.style === 'brick') hipRoof(x - 0.2, y - 0.2, w + 0.4, d + 0.4, H, 14, '#5b5f66');
  else { box(x - 0.2, y - 0.2, w + 0.4, d + 0.4, 3, '#b08356', H, { top: '#e9e4da' }); wallRect(face, 0, 0, 1, H - 1.5, H - 0.5, `rgba(255,240,190,${0.6 + 0.3 * Math.sin(ts / 600)})`); }   // modern: a flat roof and a strip of light
  if (G.style !== 'modern') [0.06, 0.94].forEach(u => { const q = wallPt(face, 0, u, DH + 4); rrect(q.x - 1.6 * z, q.y - 3 * z, 3.2 * z, 4 * z, 1 * z, '#2d2d2d'); circle(q.x, q.y - 1 * z, 1.1 * z, '#ffe39a'); });
  return { x0: D.x, x1: B.x, y0: up(A, (H + 16) * z).y, y1: C.y };
}

// v0.20: a framed film poster on a little stand (from the cinema)
function drawPosterStand(film, x, y) {
  const z = cam.z, c = iso(x + 0.5, y + 0.5), bg = { dino: '#7cc56b', space: '#1d1d4a', love: '#ffb3cf', ocean: '#2a7fd4', hero: '#5a6b8a', pets: '#f2c94c' }[film] || '#888';
  ellipse(c.x, c.y, 9 * z, 4 * z, 'rgba(0,0,0,.15)');
  line(c.x - 5 * z, c.y, c.x - 3 * z, c.y - 22 * z, '#6b4428', 1.4 * z); line(c.x + 5 * z, c.y, c.x + 3 * z, c.y - 22 * z, '#6b4428', 1.4 * z);
  rrect(c.x - 9 * z, c.y - 40 * z, 18 * z, 25 * z, 1.5 * z, '#fffaf0'); rrect(c.x - 7.5 * z, c.y - 38.5 * z, 15 * z, 22 * z, 1 * z, bg);
  emoji((MALL.movies[film] || {}).e || '🎬', c.x, c.y - 29 * z, 11 * z);
  rrect(c.x - 6 * z, c.y - 21 * z, 12 * z, 2 * z, 0.6 * z, 'rgba(255,255,255,.75)');
}

// ---------- recipe houses (v0.21) ----------
// Walls of one material (siding, shingle, brick, stucco, stone, wood boards, half-timber or glass), a roof (gable,
// steep gable, gable facing the street, hip, flat or an A-frame), and trimmings: porches, chimney, dormers, shutters,
// a turret, stilts with a deck, a stoop, a glass gable. The wall and roof colours you pick are used where they fit.
function wallMaterial(b, wh, mat, col, lift) {
  const z = cam.z;
  if (z < 0.42) return;
  const L = (f, u0, h0, u1, h1, c, wd) => wallLine(f, 0, u0, h0 + lift, u1, h1 + lift, c, wd);
  if (mat === 'siding' || mat === 'shingle') for (let hh = 3.2; hh < wh - 1; hh += mat === 'shingle' ? 2.4 : 3.2) [b.left, b.right].forEach(f => L(f, 0, hh, 1, hh, shade(col, -0.13), 0.6));
  if (mat === 'brick') for (let hh = 2.6, r = 0; hh < wh - 0.5; hh += 2.6, r++) [b.left, b.right].forEach(f => {
    L(f, 0, hh, 1, hh, 'rgba(255,238,220,.4)', 0.5);
    if (z > 0.7) for (let u = (r % 2) * 0.035; u < 1; u += 0.07) L(f, u, hh - 2.6, u, hh, 'rgba(255,238,220,.3)', 0.45);
  });
  if (mat === 'wood') { for (let u = 0.04; u < 1; u += 0.045) L(b.left, u, 0, u, wh, shade(col, -0.2), 0.6); for (let u = 0.05; u < 1; u += 0.07) L(b.right, u, 0, u, wh, shade(col, -0.17), 0.6); }
  if (mat === 'stone') for (let hh = 4, r = 0; hh < wh; hh += 4, r++) [b.left, b.right].forEach((f, i) => { L(f, 0, hh, 1, hh, 'rgba(60,50,40,.25)', 0.6); for (let u = ((r * 7 + i * 3) % 5) * 0.03; u < 1; u += 0.11 + ((r + i) % 3) * 0.02) L(f, u, hh - 4, u, hh, 'rgba(60,50,40,.22)', 0.5); });
  if (mat === 'half') [b.left, b.right].forEach(f => {   // dark timber frame on pale plaster
    const dk = '#4a3324', fl = Math.max(1, Math.round(wh / 28));
    for (let k = 0; k <= fl; k++) L(f, 0, Math.min(wh - 1, k * 28 + 1), 1, Math.min(wh - 1, k * 28 + 1), dk, 1.6);
    for (let u = 0; u <= 1.001; u += 0.2) L(f, u, 0, u, wh, dk, 1.4);
    for (let k = 0; k < fl; k++) for (let u = 0; u < 0.99; u += 0.4) { L(f, u, k * 28 + 2, u + 0.2, k * 28 + 26, dk, 1.1); L(f, u + 0.4, k * 28 + 2, u + 0.2, k * 28 + 26, dk, 1.1); }
  });
}
function specWin(f, u, uw, h0, h1, o, lift) { winFace(f, u, uw, h0 + lift, h1 + lift, o); }
function specDoor(f, u, uw, h, col, lift) {
  wallRect(f, 0, u - uw * 1.2, u + uw * 1.2, lift, lift + h + 2.4, '#fffaf0');
  wallRect(f, 0, u - uw, u + uw, lift, lift + h, col);
  wallRect(f, 0, u - uw * 0.7, u + uw * 0.7, lift + h * 0.55, lift + h * 0.88, shade(col, -0.15));
  const k = wallPt(f, 0, u + uw * 0.6, lift + h * 0.45); circle(k.x, k.y, 0.9 * cam.z, '#e8c35a');
}
// a porch: a floor, posts and a roof, in front of the door (small), across the front (columns) or round the corner (wrap)
function specPorch(kind, x, y, w, d, dx, roof, trim) {
  const z = cam.z, x0 = kind === 'small' ? dx - 1 : x, x1 = kind === 'small' ? dx + 1 : x + w, py = y + d, pd = 0.9;
  box(x0 - 0.05, py, x1 - x0 + 0.1, pd, 2.5, '#d9d2c4', 0, { shadow: false });
  const posts = kind === 'small' ? [x0 + 0.1, x1 - 0.25] : Array.from({ length: Math.round((x1 - x0) / 1.4) + 1 }, (_, i) => x0 + 0.1 + i * (x1 - x0 - 0.35) / Math.round((x1 - x0) / 1.4));
  posts.forEach(px => box(px, py + pd - 0.25, 0.18, 0.18, 22, trim, 2.5, { shadow: false }));
  if (kind === 'wrap') { box(x + w, y + 0.4, 0.9, d + 0.5, 2.5, '#d9d2c4', 0, { shadow: false }); [y + 0.6, y + d * 0.55].forEach(py2 => box(x + w + 0.65, py2, 0.18, 0.18, 22, trim, 2.5, { shadow: false })); box(x + w - 0.05, y + 0.35, 1.05, d + 0.6, 2.5, shade(roof, -0.05), 24.5, { shadow: false }); }
  box(x0 - 0.15, py - 0.05, x1 - x0 + 0.3, pd + 0.15, 2.5, shade(roof, -0.05), 24.5, { shadow: false });
  if (z > 0.5) for (let u = x0 + 0.3; u < x1 - 0.1; u += 0.35) { const a = up(iso(u, py + pd), 3 * z), b = up(iso(u, py + pd), 9 * z); line(a.x, a.y, b.x, b.y, trim, 0.7 * z); }
}
function drawSpecHouse(h, x, y, w, d, du, wall, roof, ts, n, H) {
  const z = cam.z, S2 = H.spec, ex = n * FLOOR_H, f0 = H.floors[0], trim = '#fffaf0';
  const col = S2.wallCol || wall, rc = S2.roofCol || roof, lift = (S2.stilts ? 12 : 0) + (S2.stoop ? 8 : 0);
  const wh = 4 + f0 * 28 + ex, dx = x + du * w, c = iso(x + w / 2, y + d / 2);
  let top;
  if (S2.roof === 'aframe') {   // the roof comes right down to the ground; a glass front and a deck
    if (S2.deck) { box(x - 0.3, y + d - 0.1, w + 0.6, 1.1, 3, '#a8835c', 0, { shadow: false }); }
    const g = gableY(x - 0.25, y - 0.1, w + 0.5, d + 0.2, 6, 82 + ex, rc, col);
    const A0 = lerp(g.Du, g.Cu, 0.18), A1 = lerp(g.Du, g.Cu, 0.82), apex = lerp(mid(g.Du, g.Cu), g.R2, 0.82);
    poly([A0, A1, apex], NIGHT > 0.3 ? '#ffe39a' : '#bfe6f7', '#6b4428', 1.6 * z);
    for (let u = 0.25; u < 1; u += 0.25) { const p = lerp(A0, A1, u); line(p.x, p.y, lerp(p, apex, 0.9 * (1 - Math.abs(u - 0.5) * 1.6)).x, lerp(p, apex, 0.9 * (1 - Math.abs(u - 0.5) * 1.6)).y, '#6b4428', 1 * z); }
    line(lerp(A0, apex, 0.45).x, lerp(A0, apex, 0.45).y, lerp(A1, apex, 0.45).x, lerp(A1, apex, 0.45).y, '#6b4428', 1 * z);
    const dp = lerp(g.Du, g.Cu, du); rrect(dp.x - 5 * z, dp.y - 20 * z, 10 * z, 20 * z, 1 * z, '#6b3f22');
    if (NIGHT > 0.3) glow(apex.x, (apex.y + A0.y) / 2, 40 * z);
    return g.R1.y - 10 * z;
  }
  if (S2.stilts) {   // up on posts, with a deck and stairs
    [[x + 0.1, y + 0.1], [x + w - 0.3, y + 0.1], [x + 0.1, y + d - 0.3], [x + w - 0.3, y + d - 0.3], [x + w / 2, y + d - 0.3]].forEach(([px, py]) => box(px, py, 0.22, 0.22, 12, '#a8835c'));
    box(x - 0.3, y + d - 0.2, w + 0.6, 1.2, 2, '#c4a073', 12, { shadow: false });
    for (let k = 0; k < 5; k++) box(dx - 0.45, y + d + 1 + k * 0.28, 0.9, 0.28, 2, '#c4a073', 10 - k * 2.4, { shadow: false });
  }
  if (S2.stoop) for (let k = 0; k < 4; k++) box(dx - 0.6, y + d + 0.85 - k * 0.24, 1.2, 0.28, 2, '#b8aea0', k * 2, { shadow: false });
  if (S2.turret) {}   // drawn after the walls
  const b = box(x, y, w, d, wh, col, lift);
  if (S2.base) { const bc = S2.base === 'stone' ? '#9c968c' : '#a5523c', bb = box(x - 0.05, y - 0.05, w + 0.1, d + 0.1, 9, bc, lift, { noTop: true }); wallMaterial(bb, 9, 'stone', bc, lift); }
  else wallRect(b.left, 0, 0, 1, lift, lift + 3, shade(col, -0.35));
  wallMaterial(b, wh, S2.mat, col, lift);
  // windows on every floor; the door at the bottom
  const tall = S2.windows === 'tall', wide = S2.windows === 'wide', sh = S2.shutters ? shade(rc, -0.05) : null;
  for (let fl = 0; fl < f0 + n; fl++) {
    const h0 = fl * 28 + (S2.base ? 10 : 8), h1 = h0 + (tall ? 18 : wide ? 11 : 14);
    if (S2.mat === 'glass') {
      wallRect(b.left, 0, 0.03, 0.97, h0 - 3 + lift, h0 + 21 + lift, NIGHT > 0.3 ? '#ffe39a' : '#a9d8ee', '#ffffff', 1.4);
      wallRect(b.right, 0, 0.04, 0.96, h0 - 3 + lift, h0 + 21 + lift, NIGHT > 0.3 ? '#ffe39a' : '#9ccde4', '#ffffff', 1.4);
      for (let u = 0.12; u < 0.95; u += 0.12) { wallLine(b.left, 0, u, h0 - 3 + lift, u, h0 + 21 + lift, '#ffffff', 1); }
      wallRect(b.left, 0, 0.03, 0.5, h0 + 2 + lift, h0 + 12 + lift, 'rgba(255,255,255,.22)', null);
      continue;
    }
    const us = fl === 0 ? (wide ? [0.2, 0.8] : [0.17, 0.83]) : (wide ? [0.2, 0.5, 0.8] : [0.17, 0.5, 0.83]);
    us.forEach(u => specWin(b.left, u, wide ? 0.1 : 0.06, h0, h1, { shutters: sh, box: !!(S2.porch === 'small' && fl === 0) }, lift));
    [0.3, 0.7].forEach(u => specWin(b.right, u, wide ? 0.12 : 0.08, h0, h1, { shutters: sh }, lift));
    if (S2.arches && z > 0.4) us.forEach(u => { const p = wallPt(b.left, 0, u, h1 + lift + 1.5); ellipse(p.x, p.y, 5 * z, 2.4 * z, '#c8653c'); });
  }
  if (S2.mat === 'glass') { const dp = wallPt(b.left, 0, du, 0); rrect(dp.x - 5 * z, dp.y - 19 * z, 10 * z, 19 * z, 1 * z, 'rgba(255,255,255,.35)', '#ffffff', 1.2 * z); }
  else specDoor(b.left, du, 0.06, 20, S2.mat === 'brick' ? '#2f4a3a' : shade(rc, -0.25), lift);
  if (S2.porch) specPorch(S2.porch, x, y, w, d, dx, rc, trim);
  // the roof
  const RH = S2.low ? 18 : SPEC_ROOF_H[S2.roof] || 30;
  const chim = S2.chimney ? () => chimney(x + w - 0.9, y + 0.5, wh + lift, RH + 12, S2.mat === 'brick' ? shade(col, -0.1) : '#9a948a') : null;
  if (S2.roof === 'gable' || S2.roof === 'steep') {
    const g = gableX(x - 0.18, y - 0.18, w + 0.36, d + 0.36, wh + lift, RH, rc, col, chim);
    if (S2.dormers) for (let k = 0; k < S2.dormers; k++) {   // little windows standing out of the roof
      const u = (k + 1) / (S2.dormers + 1), dxk = x + u * w - 0.45, base = wh + lift + RH * 0.28;
      const bd = box(dxk, y + d - 0.85, 0.9, 0.6, 11, col, base, { shadow: false });
      specWin(bd.left, 0.5, 0.22, 2, 9, {}, base);
      gableY(dxk - 0.08, y + d - 0.9, 1.06, 0.7, base + 11, 7, rc, col);
    }
    top = g.R1.y - 10 * z;
  } else if (S2.roof === 'gableY') {
    if (chim) chim();
    const g = gableY(x - 0.2, y - 0.2, w + 0.4, d + 0.4, wh + lift, RH, rc, col);
    if (S2.glassFront) { const A0 = lerp(g.Du, g.Cu, 0.2), A1 = lerp(g.Du, g.Cu, 0.8), ap = lerp(mid(g.Du, g.Cu), g.R2, 0.75); poly([A0, A1, ap], NIGHT > 0.3 ? '#ffe39a' : '#bfe6f7', '#5b3a22', 1.6 * z); line(mid(A0, A1).x, mid(A0, A1).y, ap.x, ap.y, '#5b3a22', 1.2 * z); }
    top = g.R1.y - 10 * z;
  } else if (S2.roof === 'hip') {
    hipRoof(x - 0.25, y - 0.25, w + 0.5, d + 0.5, wh + lift, RH, rc);
    if (chim) chim();
    top = up(c, (wh + lift + RH + 6) * z).y;
  } else {   // flat: a parapet (and a cornice on a brownstone)
    box(x - 0.08, y - 0.08, w + 0.16, d + 0.16, 4, shade(col, -0.12), wh + lift, { shadow: false });
    if (S2.cornice) box(x - 0.2, y - 0.2, w + 0.4, d + 0.4, 2.4, '#e9e2d4', wh + lift - 2, { noTop: true, shadow: false });
    if (S2.mat === 'glass') box(x - 0.3, y - 0.3, w + 0.6, d + 0.6, 2.2, '#ffffff', wh + lift + 1, { shadow: false });
    top = up(c, (wh + lift + 12) * z).y;
  }
  if (S2.turret) {   // a round tower on the front corner with a pointed roof
    const tx = x + w - 0.2, ty = y + d - 0.2, tc = iso(tx, ty), rx = 0.95 * 45 * z, ry = rx / 2, th = (wh + lift + 10) * z;
    const g = ctx.createLinearGradient(tc.x - rx, 0, tc.x + rx, 0); g.addColorStop(0, shade(col, -0.18)); g.addColorStop(0.6, shade(col, 0.04)); g.addColorStop(1, shade(col, -0.1));
    ctx.beginPath(); ctx.ellipse(tc.x, tc.y, rx, ry, 0, 0, Math.PI); ctx.lineTo(tc.x - rx, tc.y - th); ctx.ellipse(tc.x, tc.y - th, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
    ellipse(tc.x, tc.y - th, rx, ry, shade(col, 0.08));
    [-0.45, 0.35].forEach(k => { const wx = tc.x + k * rx; rrect(wx - 3 * z, tc.y - th * 0.55 - 8 * z, 6 * z, 12 * z, 1.5 * z, NIGHT > 0.3 ? '#ffe39a' : '#a9dcf5', trim, 1 * z); });
    const apex = { x: tc.x, y: tc.y - th - 40 * z };
    const rg = ctx.createLinearGradient(tc.x - rx, 0, tc.x + rx, 0); rg.addColorStop(0, shade(rc, -0.2)); rg.addColorStop(0.6, shade(rc, 0.06)); rg.addColorStop(1, shade(rc, -0.12));
    ctx.beginPath(); ctx.moveTo(tc.x - rx * 1.1, tc.y - th); ctx.ellipse(tc.x, tc.y - th, rx * 1.1, ry * 1.1, 0, Math.PI, 0, true); ctx.lineTo(apex.x, apex.y); ctx.closePath(); ctx.fillStyle = rg; ctx.fill();
    line(apex.x, apex.y, apex.x, apex.y - 7 * z, '#6b5a3a', 1 * z);
    top = Math.min(top, apex.y - 10 * z);
  }
  return top;
}
