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

// Draws a home's house at lot origin (ox, oy). Returns the screen box for tapping.
function drawHouse(h, ox, oy, ts) {
  const H = HOUSES[h.house], [fx, fy, w, d] = H.fp, x = ox + fx, y = oy + fy, z = cam.z;
  const c = iso(x + w / 2, y + d / 2);
  ellipse(c.x, c.y + 6 * z, (w + d) * 17 * z, (w + d) * 8.5 * z, 'rgba(0,0,0,.08)');
  const du = (DOOR_X - fx) / w, wall = h.wall, roof = h.roof;
  let top = c.y;
  if (h.house === 0) {
    const g = gableY(x + 0.1, y + 0.1, w - 0.2, d - 0.2, 0, 46, roof, shade(roof, 0.22));
    const a = lerp(g.Du, g.Cu, 0.3), b = lerp(g.Du, g.Cu, 0.7), tp = lerp(mid(g.Du, g.Cu), g.R2, 0.74);
    poly([a, b, tp], shade(roof, -0.55));
    poly([a, tp, lerp(a, tp, 0.5)], shade(roof, 0.35));
    const p1 = iso(x - 0.3, y + d + 0.2), p2 = iso(x + w + 0.2, y + d + 0.2);
    line(g.R2.x, g.R2.y, p1.x, p1.y, 'rgba(90,70,50,.5)', 0.8 * z); line(g.R2.x, g.R2.y, p2.x, p2.y, 'rgba(90,70,50,.5)', 0.8 * z);
    if (NIGHT > 0.3) glow(mid(a, b).x, mid(a, b).y - 8 * z, 30 * z);
    top = g.R1.y;
  } else if (h.house === 1) {
    const log = '#b0703f', wh = 28;
    const b = box(x, y, w, d, wh, log);
    for (let k = 1; k < 5; k++) {
      wallLine(b.left, 0, 0, k * 5.6, 1, k * 5.6, shade(log, -0.32), 0.8);
      wallLine(b.right, 0, 0, k * 5.6, 1, k * 5.6, shade(log, -0.25), 0.8);
    }
    winFace(b.left, 0.8, 0.09, 9, 21, { frame: '#f3e3c3' });
    doorFace(b.left, du, 0.085, 19, '#6b3f22');
    winFace(b.right, 0.5, 0.12, 9, 21, { frame: '#f3e3c3' });
    const g = gableX(x - 0.15, y - 0.12, w + 0.3, d + 0.24, wh, 24, roof, log, () => chimney(x + w - 0.8, y + 0.4, wh - 4, 34, '#9a948a'));
    top = g.R1.y - 12 * z;
  } else if (h.house === 2) {
    const wh = 32, b = box(x, y, w, d, wh, wall);
    wallRect(b.left, 0, 0, 1, 0, 3.2, shade(wall, -0.35)); wallRect(b.right, 0, 0, 1, 0, 3.2, shade(wall, -0.3));
    const sh = shade(roof, -0.1);
    winFace(b.left, 0.13, 0.065, 11, 24, { shutters: sh, box: true });
    winFace(b.left, 0.78, 0.065, 11, 24, { shutters: sh, box: true });
    doorFace(b.left, du, 0.075, 21);
    wallRect(b.left, 0, du - 0.12, du + 0.12, 24, 26.5, sh);
    winFace(b.right, 0.28, 0.08, 11, 24, { shutters: sh });
    winFace(b.right, 0.72, 0.08, 11, 24, { shutters: sh });
    const g = gableX(x - 0.15, y - 0.15, w + 0.3, d + 0.3, wh, 30, roof, wall, () => chimney(x + w - 0.9, y + 0.5, wh, 40));
    top = g.R1.y - 12 * z;
  } else if (h.house === 3) {
    const wh = 62, b = box(x, y, w, d, wh, wall);
    wallRect(b.left, 0, 0, 1, 0, 3.2, shade(wall, -0.35)); wallRect(b.right, 0, 0, 1, 0, 3.2, shade(wall, -0.3));
    wallRect(b.left, 0, 0, 1, 30, 32, shade(wall, -0.12)); wallRect(b.right, 0, 0, 1, 30, 32, shade(wall, -0.1));
    [0.17, 0.83].forEach(u => winFace(b.left, u, 0.06, 10, 23, { box: true }));
    [0.17, 0.5, 0.83].forEach(u => winFace(b.left, u, 0.06, 38, 53));
    [0.3, 0.7].forEach(u => { winFace(b.right, u, 0.08, 10, 23); winFace(b.right, u, 0.08, 38, 53); });
    doorFace(b.left, du, 0.065, 21);
    // balcony over the door
    box(DOOR_X - 0.65 + ox, y + d, 1.3, 0.4, 2.5, '#fffaf0', 31);
    box(DOOR_X - 0.65 + ox, y + d + 0.36, 1.3, 0.05, 8, '#fffaf0', 33.5, { left: 'rgba(255,250,240,.8)' });
    const g = gableX(x - 0.15, y - 0.15, w + 0.3, d + 0.3, wh, 30, roof, wall, () => chimney(x + w - 1, y + 0.5, wh, 42));
    top = g.R1.y - 12 * z;
  } else if (h.house === 4) {
    const wh = 62, mw = 4;
    const m = box(x, y, mw, d, wh, wall);
    wallRect(m.left, 0, 0, 1, 0, 3.2, shade(wall, -0.35));
    wallRect(m.left, 0, 0, 1, 30, 32, shade(wall, -0.12));
    const mdu = (DOOR_X - fx) / mw;
    [0.2].forEach(u => winFace(m.left, u, 0.09, 8, 25));
    [0.2, mdu, 0.9].forEach(u => winFace(m.left, u, 0.07, 37, 55));
    winFace(m.right, 0.86, 0.07, 37, 55);
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
    const wh = 72, b = box(x, y, w, d, wh, wall);
    wallRect(b.left, 0, 0, 1, 0, 4, shade(wall, -0.35)); wallRect(b.right, 0, 0, 1, 0, 4, shade(wall, -0.3));
    wallRect(b.left, 0, 0, 1, 34, 36, shade(wall, -0.12)); wallRect(b.right, 0, 0, 1, 34, 36, shade(wall, -0.1));
    wallRect(b.left, 0, 0, 1, 67, 72, shade(wall, 0.25)); wallRect(b.right, 0, 0, 1, 67, 72, shade(wall, 0.2));
    [0.22, 0.62, 0.8].forEach(u => winFace(b.left, u, 0.045, 10, 28));
    [0.22, du, 0.62, 0.8].forEach(u => winFace(b.left, u, 0.045, 42, 60));
    [0.25, 0.5, 0.75].forEach(u => { winFace(b.right, u, 0.07, 10, 28); winFace(b.right, u, 0.07, 42, 60); });
    doorFace(b.left, du, 0.05, 26, '#5a3a22');
    hipRoof(x - 0.15, y - 0.15, w + 0.3, d + 0.3, wh, 32, roof);
    // corner towers
    [[x - 0.4, y + d - 1], [x + w - 0.9, y + d - 1]].forEach(([tx, ty]) => {
      const t = box(tx, ty, 1.3, 1.3, 98, wall);
      wallRect(t.left, 0, 0, 1, 67, 72, shade(wall, 0.25)); wallRect(t.right, 0, 0, 1, 67, 72, shade(wall, 0.2));
      winFace(t.left, 0.5, 0.18, 42, 60); winFace(t.right, 0.5, 0.18, 42, 60); winFace(t.left, 0.5, 0.18, 76, 90);
      const apex = pyramid(tx - 0.1, ty - 0.1, 1.5, 1.5, 98, 40, roof);
      line(apex.x, apex.y, apex.x, apex.y - 16 * z, '#555', 1.2 * z);
      const fl = Math.sin(ts / 300 + tx) * 2 * z;
      pg([[apex.x, apex.y - 16 * z], [apex.x + 11 * z, apex.y - 13 * z + fl], [apex.x, apex.y - 9 * z]], '#ffd23f');
      top = Math.min(top, apex.y - 16 * z);
    });
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
  mini:   { len: 1.6, wid: 0.82, body: 9,   cab: [0.32, 0.9],  cabH: 8 },
  suv:    { len: 1.9, wid: 0.95, body: 12,  cab: [0.2, 1.38],  cabH: 10, rack: true },
  sports: { len: 1.9, wid: 0.92, body: 6.5, cab: [0.55, 0.72], cabH: 6, spoiler: true },
  pickup: { len: 2.0, wid: 0.95, body: 11,  cab: [1.0, 0.66],  cabH: 9, bed: true },
};
function carWheel(face, base, u) {
  const p = wallPt(face, base, u, 0), z = cam.z;
  ellipse(p.x, p.y, 3.4 * z, 4.4 * z, '#2b2b2e', null, 0, -0.45);
  ellipse(p.x, p.y, 1.6 * z, 2 * z, '#bfc4c9', null, 0, -0.45);
}
function drawCar(c, x, y, ts) {
  const z = cam.z, col = c.color;
  if (c.k === 'bike' || c.k === 'scooter') return drawTwoWheeler(c, x, y);
  if (c.k === 'camper') return drawCamper(c, x, y);
  const s = CAR_SPEC[c.k], cx = x + (1 - s.wid) / 2;
  const ctr = iso(cx + s.wid / 2, y + s.len / 2);
  ellipse(ctr.x, ctr.y + 2 * z, (s.wid + s.len) * 15 * z, (s.wid + s.len) * 7 * z, 'rgba(0,0,0,.2)');
  const b = box(cx, y, s.wid, s.len, s.body, col, 3.5);
  wallRect(b.left, 3.5, 0, 1, 0, 2, '#d5d5d0');
  wallRect(b.left, 3.5, 0.06, 0.24, 4, 7, '#fff6c8'); wallRect(b.left, 3.5, 0.76, 0.94, 4, 7, '#fff6c8');
  wallRect(b.left, 3.5, 0.34, 0.66, 3, 6, shade(col, -0.45));
  wallRect(b.right, 3.5, 0, 1, s.body * 0.45, s.body * 0.45 + 1, shade(col, 0.25));
  if (s.bed) flatRect(cx + 0.08, y + 0.08, s.wid - 0.16, 0.86, shade(col, -0.4), null, 3.5 + s.body);
  const cb = box(cx + 0.07, y + s.cab[0], s.wid - 0.14, s.cab[1], s.cabH, '#bfe1f2', 3.5 + s.body,
    { left: '#8fc6e3', right: '#aad6ee', top: shade(col, 0.08) });
  wallLine(cb.right, 3.5 + s.body, 0.5, 0, 0.5, s.cabH, shade(col, -0.1), 1.6);
  if (s.rack) { const h = 3.5 + s.body + s.cabH + 2; [0.25, 0.75].forEach(u => { const a = up(iso(cx + 0.12, y + s.cab[0] + s.cab[1] * u), h * z), q = up(iso(cx + s.wid - 0.12, y + s.cab[0] + s.cab[1] * u), h * z); line(a.x, a.y, q.x, q.y, '#555', 1.2 * z); }); }
  if (s.spoiler) box(cx + 0.06, y + 0.02, s.wid - 0.12, 0.14, 1.4, shade(col, -0.25), 3.5 + s.body + 4);
  carWheel(b.right, 0, 0.2); carWheel(b.right, 0, 0.8);
  if (NIGHT > 0.3) { const p = wallPt(b.left, 3.5, 0.5, 5); glow(p.x, p.y + 10 * z, 40 * z); }
  return { x0: iso(cx, y + s.len).x - 4, x1: iso(cx + s.wid, y).x + 4, y0: iso(cx, y).y - (s.body + s.cabH + 6) * z, y1: iso(cx + s.wid, y + s.len).y + 4 };
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
function drawTwoWheeler(c, x, y) {
  const z = cam.z, col = c.color, scooter = c.k === 'scooter', cx = x + 0.5;
  const wheel = (wy) => { const p = up(iso(cx, wy), 5 * z); ellipse(p.x, p.y, 3 * z, 5.2 * z, null, '#2b2b2e', 1.8 * z, -0.46); return p; };
  ellipse(iso(cx, y + 0.8).x, iso(cx, y + 0.8).y, 22 * z, 7 * z, 'rgba(0,0,0,.16)');
  const r = wheel(y + 0.3), f = wheel(y + 1.25);
  if (scooter) {
    box(cx - 0.18, y + 0.35, 0.36, 0.8, 5, col, 4);
    box(cx - 0.14, y + 0.4, 0.28, 0.45, 3, '#3b3b3b', 9);
    const h0 = up(iso(cx, y + 1.15), 9 * z), h1 = up(iso(cx, y + 1.2), 26 * z);
    line(h0.x, h0.y, h1.x, h1.y, col, 2.4 * z);
    const a = up(iso(cx - 0.25, y + 1.2), 26 * z), b = up(iso(cx + 0.25, y + 1.2), 26 * z);
    line(a.x, a.y, b.x, b.y, '#333', 1.6 * z);
  } else {
    const seat = up(iso(cx, y + 0.55), 17 * z), bar = up(iso(cx, y + 1.1), 19 * z), ped = up(iso(cx, y + 0.72), 6 * z);
    [[r, ped], [ped, f], [r, seat], [seat, ped], [seat, bar], [ped, bar], [bar, f]].forEach(([a, b]) => line(a.x, a.y, b.x, b.y, col, 1.6 * z));
    ellipse(seat.x, seat.y - 1 * z, 3.4 * z, 1.4 * z, '#333');
    const a = up(iso(cx - 0.22, y + 1.1), 21 * z), b = up(iso(cx + 0.22, y + 1.1), 21 * z);
    line(a.x, a.y, b.x, b.y, '#333', 1.5 * z);
  }
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
    case 'mailbox': {
      box(x + 0.46, y + 0.46, 0.08, 0.08, 16, '#8a5a36');
      const b = box(x + 0.32, y + 0.38, 0.36, 0.24, 8, '#3e7cc9', 16);
      wallRect(b.left, 16, 0.2, 0.8, 2, 6, shade('#3e7cc9', -0.25));
      const p = up(iso(x + 0.68, y + 0.5), 24 * z);
      line(p.x, p.y, p.x, p.y - 7 * z, '#555', 1 * z);
      rrect(p.x, p.y - 7 * z, 5 * z, 3 * z, 0.5 * z, '#e5483b');
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
