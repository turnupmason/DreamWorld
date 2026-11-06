'use strict';
// Living things: townies (with arms and legs), crops at every growth stage, and animals from baby to adult.
// All of them draw in a local frame: feet/base at (0, 0), facing +x, 1 unit = 1 px at zoom 1.

// ---------- townies ----------
// o: { look, face: 1|-1, moving, phase, energy, ts, seed, wave }
function drawPerson(sx, sy, s, o) {
  const L = o.look, ts = o.ts || 0, seed = o.seed || 0;
  ellipse(sx, sy, 8 * s, 3.4 * s, 'rgba(0,0,0,.18)');
  if (L.mob === 'wheel') return drawWheelPerson(sx, sy, s, o);
  const ph = o.phase || 0, sw = o.moving ? Math.sin(ph) : 0;
  const energy = o.energy || 'mid';
  let bob = o.moving ? Math.abs(Math.cos(ph)) * (energy === 'high' ? 2.4 : 1.4) : (Math.sin(ts / 700 + seed) + 1) * 0.3;
  if (!o.moving && energy === 'high') bob += Math.max(0, Math.sin(ts / 240 + seed)) * 3; // happy little hops
  const pants = L.pants || '#4a5a78', shirt = L.shirt, skin = L.skin;
  local(sx, sy - bob * s, s, o.face || 1, () => {
    const hipY = -10;
    // back arm and back leg are slightly darker
    const armA = o.moving ? sw * 0.75 : Math.sin(ts / 900 + seed) * 0.06;
    limb(-0.6, -20.5, armA, 8.5, shade(shirt, -0.2), skin, 2.9);
    leg(-1.6, hipY, -1.6 - sw * 4, sw < 0 ? -Math.min(1.5, -sw * 1.5) : 0, shade(pants, -0.18));
    leg(1.6, hipY, 1.6 + sw * 4, sw > 0 ? -Math.min(1.5, sw * 1.5) : 0, pants);
    if (L.hair === 'long') rrect(-7.4, -36.5, 12, 17, 5, L.hairCol);
    rrect(-5.2, -23.5, 10.4, 14.5, 4.2, shirt);
    rrect(-5.2, -11.5, 10.4, 2.6, 1, shade(pants, -0.05));
    line(-2.2, -23.2, 2.6, -23.2, shade(shirt, 0.35), 1.1); // collar
    head(0.4, -30, L, energy, ts, seed);
    if (o.wave) limb(0.8, -20.5, Math.PI - 0.5 + Math.sin(ts / 140) * 0.45, 8.5, shirt, skin, 2.9);
    else limb(0.8, -20.5, -armA, 8.5, shirt, skin, 2.9);
  });
  sleepyZ(sx, sy - bob * s, s, energy, ts, seed, 40);
}

function leg(hx, hy, fx, lift, col) {
  line(hx, hy, fx, lift - 1.2, col, 3.6);
  ellipse(fx + 1.1, lift - 0.9, 2.6, 1.5, '#3b3028');
}
// Arm hanging from a shoulder, `ang` swings it (0 = straight down).
function limb(x, y, ang, len, sleeve, skin, w) {
  const hx = x + Math.sin(ang) * len, hy = y + Math.cos(ang) * len;
  const ex = x + Math.sin(ang) * len * 0.55, ey = y + Math.cos(ang) * len * 0.55;
  line(x, y, ex, ey, sleeve, w + 0.4);
  line(ex, ey, hx, hy, skin, w - 0.3);
  circle(hx, hy, 1.7, skin);
}
function head(cx, cy, L, energy, ts, seed) {
  const r = 6.8, hc = L.hairCol;
  circle(cx, cy, r, L.skin);
  ellipse(cx - 5.6, cy + 0.5, 1.4, 2, shade(L.skin, -0.08)); // ear
  ctx.fillStyle = hc;
  ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
  if (L.hair === 'short') ellipse(cx + 2.6, cy - 4.6, 4.2, 2.3, hc, null, 0, -0.2);
  if (L.hair === 'long') { ellipse(cx + 2.4, cy - 4.4, 4.6, 2.6, hc, null, 0, -0.25); rrect(cx - 7.3, cy - 3, 3.4, 9, 1.6, hc); }
  if (L.hair === 'bun') { circle(cx - 1.5, cy - r - 2.6, 3.3, hc); ellipse(cx + 2.2, cy - 4.6, 4.4, 2.2, hc, null, 0, -0.2); }
  if (L.hair === 'curly') for (let k = 0; k <= 6; k++) { const a = Math.PI + k / 6 * Math.PI; circle(cx + Math.cos(a) * (r + 0.4), cy + Math.sin(a) * (r + 0.4) - 0.4, 2.5, hc); }
  // face looks the way the townie faces
  const blink = Math.sin(ts / 1700 + seed * 5) > 0.985;
  if (energy === 'low' || blink) { line(cx + 1.3, cy + 0.6, cx + 3, cy + 0.6, '#3a2a1a', 0.9); line(cx + 4.4, cy + 0.6, cx + 6.1, cy + 0.6, '#3a2a1a', 0.9); }
  else { ellipse(cx + 2.2, cy + 0.3, 0.95, 1.2, '#2a2018'); ellipse(cx + 5.2, cy + 0.3, 0.95, 1.2, '#2a2018'); }
  ellipse(cx + 5.6, cy + 3, 1.5, 0.9, 'rgba(240,120,120,.35)');
  ctx.strokeStyle = '#8a4a3a'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  ctx.beginPath();
  if (energy === 'high') ctx.arc(cx + 3.8, cy + 2.6, 1.9, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (energy === 'mid') ctx.arc(cx + 3.8, cy + 2.8, 1.3, 0.2 * Math.PI, 0.8 * Math.PI);
  else { ctx.moveTo(cx + 3, cy + 4); ctx.lineTo(cx + 4.6, cy + 4); }
  ctx.stroke();
}
function sleepyZ(sx, sy, s, energy, ts, seed, hgt) {
  if (energy === 'low') {
    const ph = (ts / 1400 + seed) % 1;
    ctx.save(); ctx.globalAlpha = 1 - ph;
    ctx.font = `bold ${(8 + ph * 5) * s}px sans-serif`; ctx.fillStyle = '#5b6b8c'; ctx.textAlign = 'center';
    ctx.fillText('z', sx + (7 + ph * 6) * s, sy - (hgt + ph * 12) * s);
    ctx.restore();
  } else if (energy === 'high' && Math.sin(ts / 300 + seed) > 0.7) emoji('✨', sx + 10 * s, sy - (hgt - 4) * s, 10 * s);
}
// Wheelchair users push their wheels instead of walking. Same energy, same moods.
function drawWheelPerson(sx, sy, s, o) {
  const L = o.look, ts = o.ts || 0, seed = o.seed || 0, energy = o.energy || 'mid';
  const roll = o.moving ? (o.phase || 0) * 0.8 : 0;
  const bob = o.moving ? 0 : (Math.sin(ts / 700 + seed) + 1) * 0.25;
  local(sx, sy, s, o.face || 1, () => {
    line(-5, -11, -6.5, -24, '#5b6470', 1.8);          // backrest
    rrect(-5, -12.5, 12, 2.6, 1, '#5b6470');            // seat
    circle(9, -1.8, 1.8, '#3b3f46');                    // caster
    line(7, -11, 9, -3, '#5b6470', 1.2);
    ctx.translate(0, -bob);
    rrect(-5, -26, 10, 15, 4.2, L.shirt);
    line(-1, -11.5, 6.5, -11.5, L.pants || '#4a5a78', 4);
    line(6.5, -11.5, 7.8, -3.5, L.pants || '#4a5a78', 3.4);
    ellipse(8.8, -2.6, 2.4, 1.4, '#3b3028');
    head(0.4, -32.5, L, energy, ts, seed);
    ctx.translate(0, bob);
    // big wheel with turning spokes
    circle(-0.5, -8, 8, null, '#3b3f46', 2);
    for (let k = 0; k < 4; k++) { const a = roll + k * Math.PI / 4; line(-0.5 - Math.cos(a) * 7, -8 - Math.sin(a) * 7, -0.5 + Math.cos(a) * 7, -8 + Math.sin(a) * 7, '#8a919c', 0.6); }
    circle(-0.5, -8, 1.4, '#8a919c');
    const ha = roll * 1.5 + 0.6; // hand pushes on the rim
    limb(0.5, -23, 0.35 + (o.moving ? Math.sin(ha) * 0.3 : 0), 9, L.shirt, L.skin, 2.9);
  });
  sleepyZ(sx, sy, s, energy, ts, seed, 42);
}

// ---------- crops ----------
// Each crop has its own look for sprouting, leafy, flowering and ripe stages, and sways in the wind.
const PLANT_SPOTS = {
  1: [[0.5, 0.52]], 2: [[0.34, 0.36], [0.66, 0.64]],
  3: [[0.3, 0.3], [0.72, 0.42], [0.42, 0.74]], 4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
};
function drawCropTile(tx, ty, f, ts, seed) {
  const c = CROPS[f.crop], st = cropStage(f), z = cam.z;
  const sc = z * (c.n === 4 ? 0.85 : c.n === 1 ? 1.3 : 1);
  if (st === 0) { // seed tag so you can tell what's planted
    const p = iso(tx + 0.14, ty + 0.14);
    line(p.x, p.y, p.x, p.y - 13 * z, '#a77b4f', 1.4 * z);
    rrect(p.x - 6 * z, p.y - 22 * z, 12 * z, 10 * z, 2 * z, '#fffaf0', 'rgba(0,0,0,.15)', z);
    emoji(c.e, p.x, p.y - 12.5 * z, 8 * z);
  }
  PLANT_SPOTS[c.n].forEach(([dx, dy], k) => {
    const p = iso(tx + dx, ty + dy);
    drawPlant(f.crop, st, p.x, p.y, sc, ts, seed + k * 1.7);
  });
  if (st === 4) { // twinkle
    const ph = (ts / 1100 + seed * 0.37) % 2.4;
    if (ph < 1) {
      const p = iso(tx + 0.3 + hash(seed, Math.floor(ts / 2640)) * 0.4, ty + 0.5);
      star(p.x, p.y - (24 + ph * 10) * z, 3.5 * z * Math.sin(ph * Math.PI), `rgba(255,255,255,${1 - ph * 0.6})`);
    }
  }
}
function star(x, y, r, col) {
  if (r <= 0) return;
  pg([[x, y - r * 1.6], [x + r * 0.35, y - r * 0.35], [x + r * 1.6, y], [x + r * 0.35, y + r * 0.35], [x, y + r * 1.6], [x - r * 0.35, y + r * 0.35], [x - r * 1.6, y], [x - r * 0.35, y - r * 0.35]], col);
}
function drawPlant(crop, st, sx, sy, s, ts, seed) {
  const sway = Math.sin(ts / 850 + seed * 2.3) * (st >= 2 ? 0.12 : 0.05);
  ctx.save(); ctx.translate(sx, sy); ctx.scale(s, s);
  if (st === 0) {
    ellipse(0, 0, 6, 2.6, '#7b5435');
    circle(-1.5, -0.7, 0.9, '#e2c48a'); circle(1.8, -0.3, 0.9, '#e2c48a');
  } else if (st === 1) {
    const tx = sway * 5;
    ellipse(0, 0.3, 3.4, 1.4, '#7b5435');
    stem(0, 0, tx, -5.5, '#69b84a', 1.2);
    leaf(tx, -5.5, 4.4, 1.8, -2.6, '#7ccf55');
    leaf(tx, -5.5, 4.4, 1.8, -0.55, '#8ad85f');
  } else PLANTS[crop](st, sway, ts, seed);
  ctx.restore();
}
const PLANTS = {
  wheat(st, sw) {
    const H = [10, 15, 17][st - 2], col = ['#7cc254', '#a8c65a', '#d9b545'][st - 2];
    for (let k = -2; k <= 2; k++) {
      const bx = k * 1.3, h = H - Math.abs(k) * 1.6, tx = bx + k * 1.1 + sw * h;
      stem(bx, 0, tx, -h, col, 1.1, k * 0.4);
      if (st >= 3) {
        ctx.save(); ctx.translate(tx, -h); ctx.rotate(k * 0.14 + sw * 0.8);
        ellipse(0, -2.8, 1.5, 3.6, st === 4 ? '#f0c552' : '#c9cf6a');
        if (st === 4) for (let j = 0; j < 3; j++) { line(-1.4, -1 - j * 1.7, 0, -1.9 - j * 1.7, '#c99a2e', 0.5); line(1.4, -1 - j * 1.7, 0, -1.9 - j * 1.7, '#c99a2e', 0.5); }
        line(0, -6, 0, -9, st === 4 ? '#e7c35a' : '#c9cf6a', 0.4);
        ctx.restore();
      }
    }
  },
  carrot(st, sw) {
    const H = [7, 10, 12][st - 2];
    if (st >= 3) {
      ellipse(0, 0.3, st === 4 ? 3.8 : 2.6, st === 4 ? 2.1 : 1.4, '#f08a24');
      ellipse(-0.9, -0.3, 1.3, 0.6, '#f7ad5c');
    }
    for (let k = -2; k <= 2; k++) {
      const tx = k * 2.1 + sw * H, h = H - Math.abs(k) * 1.2, bx = k * 0.4;
      stem(bx, 0, tx, -h, '#3f9a35', 0.9, k * 0.3);
      for (let j = 1; j <= 3; j++) {
        const u = j / 3.3;
        circle(bx + (tx - bx) * u + (j % 2 ? 1.1 : -1.1), -h * u, 1.25, j === 3 ? '#62bf4a' : '#4fae3d');
      }
    }
  },
  cabbage(st, sw) {
    const R = [4.5, 6.5, 8][st - 2], outer = '#5fae4f', inner = st === 4 ? '#d3efb6' : '#a9dc8a';
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.3;
      ellipse(Math.cos(a) * R * 0.55 + sw * 2, Math.sin(a) * R * 0.28 - R * 0.35, R * 0.58, R * 0.33, k % 2 ? outer : '#71bd5f', null, 0, a * 0.3);
    }
    if (st >= 3) {
      const r = st === 4 ? R * 0.66 : R * 0.42, cx = sw * 3, cy = -R * 0.6;
      circle(cx, cy, r, inner, '#8cc072', 0.6);
      stem(cx, cy + r * 0.7, cx - r * 0.4, cy - r * 0.6, '#b2d99a', 0.6, 1);
      stem(cx, cy + r * 0.7, cx + r * 0.5, cy - r * 0.5, '#b2d99a', 0.6, -1);
      ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.3, r * 0.2, 'rgba(255,255,255,.35)');
    }
  },
  tomato(st, sw) {
    const H = [12, 17, 20][st - 2], tip = sw * H;
    line(-3.6, 0.5, -3.6 + sw * 3, -H - 2, '#a77b4f', 1.1);
    stem(0, 0, tip, -H, '#4f9a3a', 1.4, 2);
    for (let j = 0; j < 5; j++) {
      const u = 0.22 + j * 0.17, x = tip * u, y = -H * u;
      leaf(x, y, 6 - j * 0.6, 2.3, j % 2 ? -0.45 : -2.7, j % 2 ? '#3f8f34' : '#4ea040');
    }
    const fruit = [[-2.6, 0.38], [2.8, 0.55], [-1.6, 0.75], [3.2, 0.3]];
    fruit.forEach(([fx, u], k) => {
      const x = fx + tip * u, y = -H * u;
      if (st === 3) { if (k < 2) circle(x, y, 1.9, '#9ad15e'); else circle(x, y - 1, 1.2, '#f7d84b'); }
      if (st === 4) {
        circle(x, y, 2.8, '#e5483b');
        circle(x - 0.9, y - 0.9, 0.8, 'rgba(255,255,255,.55)');
        pg([[x - 1.3, y - 2.6], [x, y - 1.9], [x + 1.3, y - 2.6], [x, y - 3.4]], '#3f8f34');
      }
    });
  },
  corn(st, sw) {
    const H = [16, 24, 28][st - 2], tip = sw * H;
    stem(0, 0, tip, -H, '#6cae3e', 2.1, 1);
    for (let j = 0; j < 5; j++) {
      const u = 0.18 + j * 0.15, x = tip * u, y = -H * u;
      leaf(x, y, 9 - j, 1.8, j % 2 ? -0.35 + sw : -2.8 + sw, j % 2 ? '#5aa53a' : '#6dbb47');
    }
    if (st >= 3) for (let k = -1; k <= 1; k++) line(tip, -H, tip + k * 2.2 + sw * 4, -H - 4.5, st === 4 ? '#e2b13c' : '#d8d07a', 0.8);
    const cobs = st === 4 ? [[1.8, 0.5], [-1.8, 0.36]] : st === 3 ? [[1.6, 0.5]] : [];
    cobs.forEach(([cx, u]) => {
      const x = cx + tip * u, y = -H * u;
      if (st === 3) ellipse(x, y, 1.6, 3.6, '#9ad16a', null, 0, cx * 0.15);
      else {
        ellipse(x, y, 2.2, 4.6, '#f4cf3f', '#d9a92a', 0.5, cx * 0.15);
        for (let j = -2; j <= 2; j++) circle(x + cx * 0.05 * j, y + j * 1.5, 0.45, '#e2a91f');
        leaf(x, y + 4, 6, 1.5, -Math.PI / 2 - cx * 0.18, '#b5d36a');
      }
    });
  },
  strawberry(st, sw) {
    const R = [4, 6, 7][st - 2];
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + 0.4, cx = Math.cos(a) * R * 0.6 + sw * 3, cy = Math.sin(a) * R * 0.3 - R * 0.55;
      for (let j = 0; j < 3; j++) { const b = j / 3 * Math.PI * 2 - Math.PI / 2; circle(cx + Math.cos(b) * 1.5, cy + Math.sin(b) * 1.2, 1.8, j ? '#4aa84a' : '#5bb954'); }
    }
    const spots = [[-R * 0.7, -0.6], [R * 0.75, -1.2], [-R * 0.2, 0.4], [R * 0.3, -R * 0.75]];
    spots.forEach(([x, y], k) => {
      x += sw * 2;
      if (st === 3) {
        if (k < 2) for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; circle(x + Math.cos(a) * 1.1, y - 2 + Math.sin(a) * 1.1, 0.9, '#fff'); }
        if (k < 2) circle(x, y - 2, 0.6, '#f3d36b'); else ellipse(x, y, 1.2, 1.5, '#a8d66e');
      }
      if (st === 4) {
        ctx.beginPath(); ctx.moveTo(x - 2.2, y - 1.6); ctx.quadraticCurveTo(x, y - 3, x + 2.2, y - 1.6);
        ctx.quadraticCurveTo(x + 1.6, y + 1.6, x, y + 2.8); ctx.quadraticCurveTo(x - 1.6, y + 1.6, x - 2.2, y - 1.6);
        ctx.fillStyle = '#e43a4a'; ctx.fill();
        circle(x - 0.8, y - 0.4, 0.3, '#f6d36b'); circle(x + 0.7, y + 0.2, 0.3, '#f6d36b'); circle(x, y + 1.3, 0.3, '#f6d36b');
        pg([[x - 1.6, y - 2], [x, y - 1.2], [x + 1.6, y - 2], [x, y - 2.8]], '#3f8f34');
      }
    });
  },
  sunflower(st, sw, ts) {
    const H = [14, 24, 30][st - 2], tip = sw * H * 0.7;
    stem(0, 0, tip, -H, '#5d9e36', 1.8, 1);
    leaf(tip * 0.3, -H * 0.3, 7, 3, -2.7, '#5aa13a');
    leaf(tip * 0.5, -H * 0.5, 7, 3, -0.45, '#4f9634');
    if (st === 2) leaf(tip, -H, 4, 2, -Math.PI / 2, '#78c04f');
    if (st === 3) {
      circle(tip, -H, 3.6, '#7dbb4a');
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; circle(tip + Math.cos(a) * 3.4, -H + Math.sin(a) * 3.4, 0.9, '#f7d14a'); }
    }
    if (st === 4) {
      ctx.save(); ctx.translate(tip, -H); ctx.rotate(sw * 0.8);
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; ctx.save(); ctx.rotate(a); ellipse(5.4, 0, 3, 1.35, k % 2 ? '#f7c531' : '#f5b81f'); ctx.restore(); }
      circle(0, 0, 4.6, '#7a4a22');
      for (let k = 0; k < 8; k++) { const a = k * 2.4; circle(Math.cos(a) * (k * 0.45), Math.sin(a) * (k * 0.45), 0.45, '#4e2d13'); }
      ctx.restore();
    }
  },
  pumpkin(st, sw) {
    stem(-9, 1, 9, -1, '#4f8f35', 1.1, -4);
    const L = [3.5, 4.5, 5][st - 2];
    [[-7, -2.5], [6.5, -3.5], [-1.5, -6.5 + (st === 4 ? -4 : 0)]].forEach(([x, y], k) => {
      x += sw * 3;
      circle(x, y, L, k % 2 ? '#4f9e3e' : '#5aac47');
      circle(x - L * 0.6, y - L * 0.2, L * 0.6, '#5aac47'); circle(x + L * 0.6, y - L * 0.2, L * 0.6, '#4f9e3e');
      line(x, y + L * 0.5, x, y - L * 0.5, '#3f8530', 0.5);
    });
    if (st === 3) {
      pg([[3, -6], [5.8, -11.5], [7.6, -10], [4.4, -5.2]], '#f7c531');
      circle(-2.5, -2.2, 3.5, '#89c25a', '#6ea544', 0.5);
    }
    if (st === 4) {
      const cx = 0, cy = -5.2;
      ellipse(cx - 5, cy, 4.6, 6, '#e27c1f'); ellipse(cx + 5, cy, 4.6, 6, '#e27c1f');
      ellipse(cx - 2.5, cy, 4, 6.4, '#f28c28'); ellipse(cx + 2.5, cy, 4, 6.4, '#f28c28');
      ellipse(cx, cy, 3.4, 6.6, '#f79a36');
      ellipse(cx - 2.6, cy - 2.6, 1.5, 2.5, 'rgba(255,255,255,.22)');
      rrect(cx - 0.9, cy - 9.2, 1.8, 3.4, 0.6, '#7a5a2a');
    }
  },
};

// ---------- animals ----------
const ANIM_SHADOW = { chicken: 7, rabbit: 7, sheep: 11, pig: 11, cow: 15, dog: 9 };
// o: { face, moving, phase, ts, seed }
function drawAnimal(k, st, sx, sy, s, o) {
  const sz = [0.62, 0.82, 1][st];
  ellipse(sx, sy, ANIM_SHADOW[k] * sz * s, ANIM_SHADOW[k] * 0.4 * sz * s, 'rgba(0,0,0,.16)');
  local(sx, sy, s * sz, o.face || 1, () => ANIMAL_DRAW[k](st, o));
}
// Four legs that swing while walking. xs = [back, front] hip x positions.
function legs4(xs, top, w, col, o) {
  const sw = o.moving ? Math.sin(o.phase || 0) * 2.4 : 0;
  xs.forEach((x, i) => {
    const s1 = i ? sw : -sw;
    line(x + 1.4, top, x + 1.4 - s1, 0, shade(col, -0.28), w);
    line(x, top, x + s1, 0, col, w);
  });
}
const ANIMAL_DRAW = {
  chicken(st, o) {
    const ts = o.ts || 0, sw = o.moving ? Math.sin(o.phase || 0) * 1.6 : 0;
    const peck = !o.moving && Math.sin(ts / 520 + (o.seed || 0) * 3) > 0.72;
    if (st === 0) {
      line(-1, -3, -1 - sw, 0, '#e8a33a', 1.1); line(1.6, -3, 1.6 + sw, 0, '#e8a33a', 1.1);
      circle(0, -6.5, 5.2, '#ffe066');
      ellipse(-1.2, -6.2, 2.8, 2, '#f5cf3e');
      const hx = peck ? 5 : 3.6, hy = peck ? -5.5 : -11;
      circle(hx, hy, 3.7, '#ffe57a');
      pg([[hx + 3, hy - 0.6], [hx + 5.2, hy + 0.3], [hx + 3, hy + 1]], '#f2a23a');
      circle(hx + 1.4, hy - 0.8, 0.75, '#2a2018');
      return;
    }
    const body = st === 2 ? '#fbfaf5' : '#f4e8cc';
    line(-2, -6, -2 - sw, 0, '#e9a03b', 1.4); line(2, -6, 2 + sw, 0, '#e9a03b', 1.4);
    pg([[-6, -11], [-12.5, -19.5], [-10.4, -13.5], [-12.8, -15], [-8, -7.5]], shade(body, -0.06));
    ellipse(0, -10, 8, 6.2, body, '#e3dfd3', 0.6);
    ellipse(-1.2, -10.2, 4.8, 3.1, shade(body, -0.07));
    const hx = peck ? 8.5 : 6, hy = peck ? -6.5 : -16.5;
    if (!peck) line(4, -12, hx - 1, hy + 2, body, 4.5);
    circle(hx, hy, 4, body);
    const cr = st === 2 ? 1.5 : 0.9;
    circle(hx - 1.2, hy - 3.8, cr, '#e5483b'); circle(hx + 0.3, hy - 4.4, cr * 1.1, '#e5483b'); circle(hx + 1.7, hy - 3.8, cr, '#e5483b');
    pg([[hx + 3.4, hy - 1], [hx + 6.2, hy + 0.2], [hx + 3.4, hy + 1.3]], '#f2a23a');
    if (st === 2) ellipse(hx + 3.1, hy + 2.6, 1, 1.6, '#e5483b');
    circle(hx + 1.6, hy - 0.9, 0.8, '#2a2018');
  },
  rabbit(st, o) {
    const hop = o.moving ? Math.abs(Math.sin(o.phase || 0)) * 4 : 0;
    const col = '#efe6da', dark = '#d8c9b6';
    ctx.translate(0, -hop);
    if (st === 0) {
      circle(0, -4.5, 4.6, col);
      circle(3.6, -7.6, 3.3, col);
      ellipse(2.6, -11.6, 0.9, 2.6, col, null, 0, -0.2); ellipse(4.4, -11.4, 0.9, 2.6, col, null, 0, 0.15);
      circle(-4.2, -5, 1.5, '#fff');
      circle(4.8, -8.2, 0.65, '#2a2018'); circle(6.7, -7.4, 0.55, '#f2a0ad');
      return;
    }
    ellipse(-3, -1.6, 4, 1.8, dark);
    ellipse(0, -7, 7.5, 5.8, col);
    circle(-7.4, -8.4, 2.4, '#fff');
    ellipse(4.6, -1.2, 2, 1.2, dark);
    circle(6.6, -11, 4.3, col);
    const earW = Math.sin((o.ts || 0) / 800 + (o.seed || 0)) * 0.12;
    [[4.4, -14.2, -0.35], [6.6, -14.6, -0.05]].forEach(([x, y, a], k) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + earW);
      ellipse(0, -4.6, 1.6, 5, k ? col : shade(col, -0.06)); ellipse(0, -4.6, 0.8, 3.7, '#f6b7c0');
      ctx.restore();
    });
    circle(8.2, -11.8, 0.85, '#2a2018'); circle(10.6, -10.2, 0.75, '#f2a0ad');
  },
  sheep(st, o) {
    const wool = '#f7f5ee', face = '#3b3434';
    if (st === 0) {
      legs4([-3, 3], -5, 1.2, face, o);
      [[-3, -8, 3.4], [0, -9.8, 3.6], [3, -8, 3.2], [0, -6.6, 3.4]].forEach(([x, y, r]) => circle(x, y, r, wool, '#e2ddd0', 0.5));
      ellipse(5.8, -10.2, 2.5, 3, face); circle(6.6, -10.8, 0.6, '#fff');
      return;
    }
    legs4([-5, 5], -6, 1.7, face, o);
    [[-7, -11, 5], [-2, -13.4, 5.6], [3, -12.8, 5.2], [6, -10, 4.4], [-4, -8, 5], [2, -8, 5]].forEach(([x, y, r]) => circle(x, y, r, wool, '#e2ddd0', 0.5));
    ellipse(10, -13, 3.4, 4.2, face);
    ellipse(8, -15.4, 2.2, 1, face, null, 0, -0.5);
    circle(9.2, -16.8, 2.2, wool);
    circle(11.2, -13.6, 0.7, '#fff');
  },
  pig(st, o) {
    const pink = '#f6b3b9', dark = '#e48b97';
    if (st === 0) {
      legs4([-3, 3], -3, 1.4, pink, o);
      ellipse(0, -5.5, 6, 4.4, pink);
      circle(5.6, -7, 3.6, pink);
      ellipse(8.6, -6.6, 1.5, 1.8, dark);
      pg([[4.6, -9.6], [5.8, -12.2], [7, -9.6]], dark);
      circle(6.4, -7.8, 0.6, '#2a2018');
      return;
    }
    legs4([-6, 6], -5, 2.6, pink, o);
    ellipse(0, -9, 11, 7.2, pink);
    ellipse(-2, -6, 7, 3, 'rgba(255,255,255,.18)');
    ctx.beginPath(); ctx.arc(-12, -11, 1.8, 0, Math.PI * 1.6); ctx.strokeStyle = dark; ctx.lineWidth = 1.1; ctx.stroke();
    circle(10, -11, 5.4, pink);
    pg([[8, -14.6], [10.6, -18.6], [12, -14]], dark);
    ellipse(14.6, -10.2, 2.2, 2.6, dark);
    circle(14.1, -10.8, 0.5, '#9a4a5a'); circle(15.1, -9.6, 0.5, '#9a4a5a');
    circle(11.4, -12.4, 0.75, '#2a2018');
  },
  cow(st, o) {
    const calf = st === 0, base = calf ? '#c98f5b' : '#fbfbf7', spot = calf ? '#fff3e2' : '#2e2a28';
    legs4([-8, 7], -9, calf ? 2.2 : 2.8, base, o);
    [-8, 7].forEach(x => { line(x - 0.6, -0.3, x + 0.8, -0.3, '#4a3a30', 2); });
    // tail
    const tw = Math.sin((o.ts || 0) / 500 + (o.seed || 0)) * 2;
    line(-12, -19, -13.5 + tw, -9, shade(base, -0.2), 1); circle(-13.5 + tw, -8.5, 1.4, spot);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(-12.5, -22, 25, 13.5, 5); ctx.fillStyle = base; ctx.fill(); ctx.clip();
    ellipse(-6, -17, 4, 3, spot); ellipse(3, -12.6, 5, 3.4, spot); ellipse(9, -19.6, 3, 2.5, spot);
    ctx.restore();
    if (st === 2) ellipse(2, -8.4, 3, 2, '#f2a7b0');
    rrect(10, -27, 8, 9.5, 3, base);
    ellipse(14, -25, 2.5, 2, spot);
    rrect(13, -21, 6.4, 4.6, 2, '#f2b8b0');
    circle(15, -19, 0.5, '#9a5a5a'); circle(17.4, -19, 0.5, '#9a5a5a');
    circle(14.6, -23.4, 0.85, '#2a2018');
    ellipse(10.2, -25, 2.6, 1.2, shade(base, -0.1), null, 0, 0.3);
    if (st === 2) {
      line(11.6, -27, 10.6, -30.4, '#f1e3c2', 1.4); line(16, -27, 17, -30.4, '#f1e3c2', 1.4);
      circle(11, -16.4, 1.8, '#f2c230', '#c99a18', 0.5);
    }
  },
  dog(st, o) {
    const fur = '#e39b4b', belly = '#fff4e2', ts = o.ts || 0;
    const wag = Math.sin(ts / (o.moving ? 140 : 90)) * 0.5;
    if (st === 0) {
      legs4([-3, 3], -3.5, 1.6, fur, o);
      ellipse(0, -5.5, 5.5, 3.8, fur);
      ctx.save(); ctx.translate(-5, -7); ctx.rotate(-0.6 + wag); ellipse(-0.5, -2, 1.3, 2.6, fur); ctx.restore();
      circle(5, -9.5, 4.2, fur); ellipse(7.6, -8.4, 2, 1.5, belly);
      pg([[2.6, -12], [3.2, -15.2], [5, -12.8]], fur); pg([[5.6, -13.2], [7.2, -15.6], [7.6, -12.4]], fur);
      circle(9.3, -8.8, 0.7, '#2a2018'); circle(6.4, -10.2, 0.7, '#2a2018');
      return;
    }
    legs4([-5, 5], -6, 2.1, fur, o);
    ellipse(0, -9, 8.5, 5, fur);
    ellipse(1, -6.6, 5, 2.4, belly);
    ctx.save(); ctx.translate(-8, -11); ctx.rotate(-0.6 + wag); ellipse(-1, -3, 2, 4, fur); ellipse(-1, -4.6, 1.2, 2, belly); ctx.restore();
    circle(8, -14.5, 4.8, fur);
    ellipse(11.4, -13, 2.6, 2, belly);
    circle(13.6, -13.6, 0.9, '#2a2018');
    pg([[5.2, -17.5], [6.2, -21.6], [8.3, -18.6]], fur); pg([[8.6, -18.8], [10.8, -21.6], [10.9, -17.4]], fur);
    circle(9.4, -15.4, 0.8, '#2a2018');
    if (!o.moving && Math.sin(ts / 700 + (o.seed || 0)) > 0.6) ellipse(12, -10.8, 1, 1.6, '#f07a8a'); // tongue out
  },
};
