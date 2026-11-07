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
  if (id === 'tent') {
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
function drawTrough(x, y) {
  box(x, y, 0.9, 0.36, 6, '#8a5a36');
  flatRect(x + 0.07, y + 0.07, 0.76, 0.22, '#6bbfe0', null, 6);
}
function drawHay(x, y) {
  const b = box(x, y, 0.62, 0.46, 10, '#e2bd5a');
  [b.left, b.right].forEach(f => { wallLine(f, 0, 0, 3.5, 1, 3.5, '#c99a3a', 0.8); wallLine(f, 0, 0, 7, 1, 7, '#c99a3a', 0.8); });
}
// White picket fence along one straight edge.
function picket(ax, ay, bx, by) {
  const z = cam.z, a = iso(ax, ay), b = iso(bx, by);
  for (const hh of [4, 9]) {
    line(a.x, a.y - hh * z + 1, b.x, b.y - hh * z + 1, 'rgba(120,90,50,.25)', 3 * z);
    line(a.x, a.y - hh * z, b.x, b.y - hh * z, '#fffaf0', 2 * z);
  }
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) * 4));
  for (let k = 0; k <= n; k++) {
    const q = lerp(a, b, k / n);
    rrect(q.x - 1.5 * z, q.y - 12 * z, 3 * z, 12 * z, 1.4 * z, '#fffaf0', 'rgba(120,90,50,.35)', 0.8);
  }
}
// Wooden ranch fence for the pasture.
function rail(ax, ay, bx, by) {
  const z = cam.z, a = iso(ax, ay), b = iso(bx, by);
  for (const hh of [5, 11]) line(a.x, a.y - hh * z, b.x, b.y - hh * z, '#a0703f', 2.2 * z);
  [a, b].forEach(q => rrect(q.x - 1.8 * z, q.y - 14 * z, 3.6 * z, 14 * z, 1 * z, '#8a5a36'));
}

// ---------- vehicles (front faces the road, +y) ----------
const CAR_SPEC = {
  mini:        { len: 1.6, wid: 0.82, body: 9,   cab: [0.32, 0.9],  cabH: 8 },
  sedan:       { len: 2.0, wid: 0.9,  body: 8,   cab: [0.55, 0.92], cabH: 7.5 },
  convertible: { len: 2.0, wid: 0.9,  body: 7,   cab: [0.7, 0.6],   cabH: 0, open: true },
  suv:         { len: 1.9, wid: 0.95, body: 12,  cab: [0.2, 1.38],  cabH: 10, rack: true },
  jeep:        { len: 1.8, wid: 0.95, body: 12,  cab: [0.25, 1.15], cabH: 10, lift: 3, lights: true, big: true },
  sports:      { len: 1.9, wid: 0.92, body: 6.5, cab: [0.55, 0.72], cabH: 6, spoiler: true },
  pickup:      { len: 2.0, wid: 0.95, body: 11,  cab: [1.0, 0.66],  cabH: 9, bed: true },
};
function carWheel(face, base, u, big) {
  const p = wallPt(face, base, u, 0), z = cam.z, k = big ? 1.35 : 1;
  ellipse(p.x, p.y, 3.4 * z * k, 4.4 * z * k, '#2b2b2e', null, 0, -0.45);
  ellipse(p.x, p.y, 1.6 * z * k, 2 * z * k, '#bfc4c9', null, 0, -0.45);
}
// Cars park on the driveway with the front towards the road (+y).
function drawCar(c, x, y, ts) {
  const z = cam.z, col = c.color, def = CARS[c.k] || {};
  if (def.kind === 'two') return drawTwoWheeler(c, x, y, ts);
  if (c.k === 'camper') return drawCamper(c, x, y);
  if (c.k === 'tractor') return drawTractor(c, x, y, ts);
  const s = CAR_SPEC[c.k] || CAR_SPEC.mini, cx = x + (1 - s.wid) / 2, base = 3.5 + (s.lift || 0);
  const ctr = iso(cx + s.wid / 2, y + s.len / 2);
  ellipse(ctr.x, ctr.y + 2 * z, (s.wid + s.len) * 15 * z, (s.wid + s.len) * 7 * z, 'rgba(0,0,0,.2)');
  const b = box(cx, y, s.wid, s.len, s.body, col, base);
  wallRect(b.left, base, 0, 1, 0, 2, s.big ? '#3a3a3a' : '#d5d5d0');
  wallRect(b.left, base, 0.06, 0.24, 4, 7, '#fff6c8'); wallRect(b.left, base, 0.76, 0.94, 4, 7, '#fff6c8');
  wallRect(b.left, base, 0.34, 0.66, 3, 6, shade(col, -0.45));
  wallRect(b.right, base, 0, 1, s.body * 0.45, s.body * 0.45 + 1, shade(col, 0.25));
  if (s.big) wallRect(b.right, base, 0, 1, 0, 3, '#3a3a3a');
  if (s.bed) flatRect(cx + 0.08, y + 0.08, s.wid - 0.16, 0.86, shade(col, -0.4), null, base + s.body);
  const top = base + s.body;
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
    if (s.lights) box(cx + 0.15, y + s.cab[0] + s.cab[1] - 0.15, s.wid - 0.3, 0.1, 2, '#333', roofH, { left: '#fff6c8' });
  }
  if (s.spoiler) box(cx + 0.06, y + 0.02, s.wid - 0.12, 0.14, 1.4, shade(col, -0.25), top + 4);
  carWheel(b.right, 0, 0.2, s.big); carWheel(b.right, 0, 0.8, s.big);
  if (NIGHT > 0.3) { const p = wallPt(b.left, base, 0.5, 5); glow(p.x, p.y + 10 * z, 40 * z); }
  return { x0: iso(cx, y + s.len).x - 4, x1: iso(cx + s.wid, y).x + 4, y0: iso(cx, y).y - (top + s.cabH + 6) * z, y1: iso(cx + s.wid, y + s.len).y + 4 };
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
  wallRect(b.left, 3.5, 0.06, 0.2, 3, 6, '#fff6c8'); wallRect(b.left, 3.5, 0.8, 0.94, 3, 6, '#fff6c8');
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
  ellipse(wb.x, wb.y - 9 * z, 6 * z, 10 * z, '#2b2b2e', null, 0, -0.45); ellipse(wb.x, wb.y - 9 * z, 3 * z, 5 * z, '#f2c230', null, 0, -0.45);
  ellipse(wf.x, wf.y - 5 * z, 3.4 * z, 5.4 * z, '#2b2b2e', null, 0, -0.45); ellipse(wf.x, wf.y - 5 * z, 1.6 * z, 2.6 * z, '#f2c230', null, 0, -0.45);
  return { x0: iso(cx, y + 1.9).x - 6, x1: iso(cx + 0.8, y).x + 10, y0: iso(cx, y).y - 46 * z, y1: iso(cx + 0.8, y + 1.9).y + 4 };
}
// Bicycles, e-bikes, scooters and motorbikes stand on the driveway along y.
function drawTwoWheeler(c, x, y, ts) {
  const z = cam.z, col = c.color, k = c.k, cx = x + 0.5, motor = k !== 'bike';
  const wheelR = k === 'vespa' ? 3.6 : k === 'bike' || k === 'scooter' ? 5 : 5.6;
  const wheel = (wy) => { const p = up(iso(cx, wy), wheelR * z); ellipse(p.x, p.y, wheelR * 0.6 * z, wheelR * z, null, '#2b2b2e', (motor ? 2.6 : 1.8) * z, -0.46); return p; };
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
function frontFace(x, y, w, d, rot) { return rot ? [iso(x + w, y + d), iso(x + w, y)] : [iso(x, y + d), iso(x + w, y + d)]; }
// A strip of depth t along the back of the footprint.
function backStrip(x, y, w, d, rot, t) { return rot ? [x, y, t, d] : [x, y, w, t]; }
function legs(x, y, w, d, h, col, inset = 0.1) {
  [[x + inset, y + inset], [x + w - inset - 0.08, y + inset], [x + inset, y + d - inset - 0.08], [x + w - inset - 0.08, y + d - inset - 0.08]]
    .forEach(([lx, ly]) => box(lx, ly, 0.08, 0.08, h, col));
}
const WOOD = '#b07a4a', DARKWOOD = '#7a4f2e';
function drawFurn(it, x, y, ts) {
  const k = it.k, rot = it.rot, tint = it.tint || '#8d99a6', [w, d] = furnSize(k, rot), z = cam.z;
  const B = (bx, by, bw, bd, h, col, base, o) => box(bx, by, bw, bd, h, col, base, o);
  switch (k) {
    case 'sleepbag': {
      B(x + 0.1, y + 0.06, w - 0.2, d - 0.12, 5, tint);
      if (rot) B(x + 0.18, y + 0.2, 0.36, d - 0.4, 3, '#fbfbf7', 5); else B(x + 0.2, y + 0.18, w - 0.4, 0.36, 3, '#fbfbf7', 5);
      if (rot) flatRect(x + 0.6, y + 0.1, w - 0.7, d - 0.2, shade(tint, 0.15), null, 5.2); else flatRect(x + 0.1, y + 0.6, w - 0.2, d - 0.7, shade(tint, 0.15), null, 5.2);
      break;
    }
    case 'bed': {
      if (rot) B(x + 0.02, y + 0.05, 0.12, d - 0.1, 30, DARKWOOD); else B(x + 0.05, y + 0.02, w - 0.1, 0.12, 30, DARKWOOD);
      B(x + 0.05, y + 0.05, w - 0.1, d - 0.1, 9, WOOD);
      B(x + 0.1, y + 0.1, w - 0.2, d - 0.2, 4, '#fbfbf7', 9);
      if (rot) { B(x + 0.2, y + 0.2, 0.42, 0.7, 3, '#fff', 13); B(x + 0.2, y + 1.1, 0.42, 0.7, 3, '#fff', 13); B(x + 0.78, y + 0.08, w - 0.86, d - 0.16, 5, tint, 9); }
      else { B(x + 0.2, y + 0.2, 0.7, 0.42, 3, '#fff', 13); B(x + 1.1, y + 0.2, 0.7, 0.42, 3, '#fff', 13); B(x + 0.08, y + 0.78, w - 0.16, d - 0.86, 5, tint, 9); }
      break;
    }
    case 'sofa': case 'armchair': {
      const bs = backStrip(x + 0.05, y + 0.05, w - 0.1, d - 0.1, rot, 0.28);
      B(bs[0], bs[1], bs[2], bs[3], 22, shade(tint, -0.08));
      if (rot) {
        B(x + 0.3, y + 0.05, w - 0.35, 0.2, 15, tint);
        B(x + 0.3, y + 0.22, w - 0.35, d - 0.44, 10, tint);
        B(x + 0.3, y + d - 0.25, w - 0.35, 0.2, 15, tint);
      } else {
        B(x + 0.05, y + 0.3, 0.2, d - 0.35, 15, tint);
        B(x + 0.22, y + 0.3, w - 0.44, d - 0.35, 10, tint);
        B(x + w - 0.25, y + 0.3, 0.2, d - 0.35, 15, tint);
      }
      if (k === 'sofa') { const a = up(iso(rot ? x + 0.3 : x + w / 2, rot ? y + d / 2 : y + 0.3), 10 * z), b = up(iso(rot ? x + w - 0.05 : x + w / 2, rot ? y + d / 2 : y + d - 0.05), 10 * z); line(a.x, a.y, b.x, b.y, shade(tint, -0.2), 0.8 * z); }
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
      flatRect(x + 0.08, y + 0.08, w - 0.16, d - 0.16, tint, null, 0.4);
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
      const c = iso(x + 0.5, y + 0.5);
      ellipse(c.x, c.y - 4 * z, 15 * z, 9 * z, tint);
      ellipse(c.x - 3 * z, c.y - 9 * z, 9 * z, 6 * z, shade(tint, 0.12));
      ellipse(c.x + 5 * z, c.y - 2 * z, 6 * z, 3 * z, shade(tint, -0.12));
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
      ellipse(wheel.x, wheel.y, 4 * z, 7 * z, '#bbb', '#555', 1 * z, -0.45);
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
      const cp = wallPt(f, 0, 0.5, 49), dd = new Date(now());
      circle(cp.x, cp.y, 6 * z, '#fffaf0', '#d4a82a', 1 * z);
      const ha = (dd.getHours() % 12 + dd.getMinutes() / 60) / 12 * Math.PI * 2, ma = dd.getMinutes() / 60 * Math.PI * 2;
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
function drawWildTree(x, y, v, ts) {
  const z = cam.z, c = iso(x, y), s = (0.8 + v * 0.6) * z, sw = Math.sin(ts / 1500 + x * 0.7) * 1.2 * z;
  ellipse(c.x, c.y, 16 * s, 7 * s, 'rgba(0,0,0,.14)');
  if (v < 0.45) {
    line(c.x, c.y, c.x, c.y - 12 * s, '#7a4f2e', 3 * s);
    [[34, 16, '#2f7d4a'], [46, 13, '#38905a'], [57, 9, '#45a368']].forEach(([h, r, col]) => pg([[c.x - r * s, c.y - (h - 20) * s], [c.x + r * s, c.y - (h - 20) * s], [c.x + sw, c.y - (h + 4) * s]], col));
  } else {
    line(c.x, c.y, c.x, c.y - 16 * s, '#8a5a36', 3.4 * s);
    ellipse(c.x + sw * 0.5, c.y - 28 * s, 16 * s, 13 * s, v > 0.8 ? '#5a9a3e' : '#4f9a4b');
    ellipse(c.x - 5 * s + sw, c.y - 33 * s, 10 * s, 9 * s, v > 0.8 ? '#6fb04a' : '#62b05a');
    ellipse(c.x + 5 * s + sw, c.y - 37 * s, 8 * s, 7 * s, v > 0.8 ? '#86c25a' : '#74c169');
  }
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
  const z = cam.z, ring = (k, ox = 0) => { const pts = []; for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; pts.push(iso(cx + Math.cos(a) * (rx + k), cy + Math.sin(a) * (ry + k) + ox)); } return pts; };
  poly(ring(0.35), '#d8cba6');
  poly(ring(0), '#4aa8d6');
  poly(ring(-0.4), '#5dbbe6');
  for (let i = 0; i < 4; i++) {
    const u = (ts / 5000 + i / 4) % 1, a = iso(cx - rx * 0.5, cy - ry * 0.6 + u * ry * 1.2), b = iso(cx + rx * 0.2, cy - ry * 0.6 + u * ry * 1.2);
    line(a.x, a.y, b.x, b.y, `rgba(255,255,255,${0.4 * Math.sin(u * Math.PI)})`, 1.2 * z);
  }
  [[0.3, -0.4], [-0.5, 0.2]].forEach(([u, v]) => { const p = iso(cx + u * rx, cy + v * ry); ellipse(p.x, p.y, 7 * z, 3 * z, '#5fae47'); circle(p.x + 2 * z, p.y - 1 * z, 1.5 * z, '#f7a8c8'); });
}
