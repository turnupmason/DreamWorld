'use strict';
// Isometric town renderer + touch/mouse input on a <canvas>.

const Town = (() => {
  let cv, ctx, W = 0, H = 0;
  const cam = { x: 0, y: 0, z: 0.9 };
  let target = null, onHit = () => {}, visible = false, centered = false;
  let hits = [], labels = [];
  const floats = [];
  const GW = 12, GH = 18;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const HOUSE_STYLE = {
    2: { wall: '#c08552', h: 24, rh: 22, rows: 1, cols: 1 },
    3: { wall: '#f4e7cc', h: 30, rh: 24, rows: 1, cols: 2, chimney: true },
    4: { wall: '#fbe3c8', h: 54, rh: 26, rows: 2, cols: 2, chimney: true },
    5: { wall: '#fff8ec', h: 56, rh: 28, rows: 2, cols: 3, chimney: true, tower: true },
  };
  // Decorative trees and flowers in the gaps between plots (fixed layout).
  const SCENERY = [];
  for (const y of [5, 11, 17]) for (let x = 0; x < GW; x++) {
    if (x === 5 || x === 6) continue;
    const h = (x * 7 + y * 3) % 5;
    if (h === 0 || h === 3) SCENERY.push({ x, y, kind: 'tree', s: 0.8 + ((x + y) % 3) * 0.15 });
    else if (h === 1) SCENERY.push({ x, y, kind: 'flower' });
  }

  // ---------- math ----------
  const iso = (x, y) => ({ x: (x - y) * TW / 2 * cam.z + cam.x, y: (x + y) * TH / 2 * cam.z + cam.y });
  const unIso = (sx, sy) => {
    const a = (sx - cam.x) / (TW / 2 * cam.z), b = (sy - cam.y) / (TH / 2 * cam.z);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  };
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const lerp = (p, q, u) => ({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u });
  const up = (p, h) => ({ x: p.x, y: p.y - h });

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = amt < 0 ? 0 : 255, k = Math.abs(amt);
    r = Math.round(r + (f - r) * k); g = Math.round(g + (f - g) * k); b = Math.round(b + (f - b) * k);
    return `rgb(${r},${g},${b})`;
  }

  // ---------- drawing primitives ----------
  function poly(pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  const tile = (i, j, fill, stroke) => poly([iso(i, j), iso(i + 1, j), iso(i + 1, j + 1), iso(i, j + 1)], fill, stroke);

  function emoji(ch, x, y, size, alpha) {
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(ch, x, y);
    ctx.restore();
  }

  // Box over a footprint; h and base are in unscaled px.
  function box(x, y, w, d, h, col, base = 0) {
    const z = cam.z, hb = base * z, hh = (base + h) * z;
    const A = iso(x, y), B = iso(x + w, y), C = iso(x + w, y + d), D = iso(x, y + d);
    poly([up(D, hb), up(C, hb), up(C, hh), up(D, hh)], shade(col, -0.16), 'rgba(0,0,0,.06)');
    poly([up(C, hb), up(B, hb), up(B, hh), up(C, hh)], shade(col, -0.04), 'rgba(0,0,0,.06)');
    poly([up(A, hh), up(B, hh), up(C, hh), up(D, hh)], shade(col, 0.12));
    return { A, B, C, D, hh };
  }
  // Gable roof with the ridge running along x.
  function gable(x, y, w, d, baseH, roofH, roofCol, endCol) {
    const z = cam.z, bh = baseH * z, rh = roofH * z;
    const Au = up(iso(x, y), bh), Bu = up(iso(x + w, y), bh), Cu = up(iso(x + w, y + d), bh), Du = up(iso(x, y + d), bh);
    const R1 = up(mid(Au, Du), rh), R2 = up(mid(Bu, Cu), rh);
    poly([Au, Bu, R2, R1], shade(roofCol, -0.3));
    poly([Du, Cu, R2, R1], roofCol, 'rgba(0,0,0,.08)');
    poly([Cu, Bu, R2], endCol, 'rgba(0,0,0,.06)');
    // ridge highlight
    ctx.strokeStyle = shade(roofCol, 0.3); ctx.lineWidth = 1.5 * z;
    ctx.beginPath(); ctx.moveTo(R1.x, R1.y); ctx.lineTo(R2.x, R2.y); ctx.stroke();
    return { Bu, Cu, R2 };
  }
  function pyramid(x, y, w, d, base, rh, col) {
    const z = cam.z;
    const Bu = up(iso(x + w, y), base * z), Cu = up(iso(x + w, y + d), base * z), Du = up(iso(x, y + d), base * z);
    const apex = up(iso(x + w / 2, y + d / 2), (base + rh) * z);
    poly([Du, Cu, apex], col);
    poly([Cu, Bu, apex], shade(col, -0.18));
    return apex;
  }
  // Quad on a wall face. face = [start, end] base points, h = wall height in screen px.
  function faceQuad(face, h, u0, u1, v0, v1, fill, stroke) {
    const p = (u, v) => up(lerp(face[0], face[1], u), v * h);
    poly([p(u0, v0), p(u1, v0), p(u1, v1), p(u0, v1)], fill, stroke, 1.2 * cam.z);
  }

  // ---------- scene pieces ----------
  function drawGround() {
    const z = cam.z, th = 22 * z;
    const B = iso(GW, 0), C = iso(GW, GH), D = iso(0, GH);
    const dn = (p, h) => ({ x: p.x, y: p.y + h });
    poly([D, C, dn(C, th), dn(D, th)], '#b0805a');
    poly([C, B, dn(B, th), dn(C, th)], '#94683f');
    poly([D, C, dn(C, 5 * z), dn(D, 5 * z)], '#7fbd5e');
    poly([C, B, dn(B, 5 * z), dn(C, 5 * z)], '#6ca94f');

    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      let c = (i + j) % 2 ? '#a6d77f' : '#9fd178';
      if (i === 5 || i === 6) c = j % 2 ? '#dcd4c3' : '#d6cdbb';
      tile(i, j, c);
    }
    // road centre line
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2 * z; ctx.lineCap = 'round';
    for (let j = 0; j < GH; j++) {
      const p = iso(6, j + 0.3), q = iso(6, j + 0.7);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }

    S.plots.forEach(p => {
      const owned = !!p.owner;
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
        tile(p.ox + i, p.oy + j, owned ? ((i + j) % 2 ? '#bde59a' : '#b6e092') : ((i + j) % 2 ? '#d3e5b4' : '#cde0ad'));
      }
      if (owned) {
        // garden soil
        for (let gi = 0; gi < 6; gi++) {
          const gx = p.ox + gi % 3, gy = p.oy + 3 + Math.floor(gi / 3);
          tile(gx, gy, '#9a6a44', 'rgba(255,255,255,.25)');
          ctx.strokeStyle = 'rgba(70,40,20,.35)'; ctx.lineWidth = 1 * z;
          for (const v of [0.33, 0.66]) {
            const a = iso(gx + 0.15, gy + v), b = iso(gx + 0.85, gy + v);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        // stepping stones from house to road
        const roadSide = p.ox < 5 ? [2, 3, 4] : [];
        roadSide.forEach(i => { const c = iso(p.ox + i + 0.5, p.oy + 1.5); ellipse(c.x, c.y, 7 * z, 3.5 * z, '#e6dccb'); });
      }
      if (owned) { drawFence(p); return; }
      const corners = [iso(p.ox, p.oy), iso(p.ox + 5, p.oy), iso(p.ox + 5, p.oy + 5), iso(p.ox, p.oy + 5)];
      ctx.save();
      ctx.setLineDash([6 * z, 5 * z]);
      poly(corners, null, 'rgba(255,255,255,.9)', 2 * z);
      ctx.restore();
    });
  }

  // Low picket fence around a lot, open on the side facing the road.
  function drawFence(p) {
    const { ox, oy } = p, z = cam.z;
    const roadOnRight = ox < 5;
    const edges = [
      [[ox, oy], [ox + 5, oy]],             // back-right
      [[ox, oy], [ox, oy + 5]],             // back-left
      [[ox + 5, oy], [ox + 5, oy + 5]],     // front-right
      [[ox, oy + 5], [ox + 5, oy + 5]],     // front-left
    ];
    edges.forEach(([a, b], k) => {
      const facesRoad = roadOnRight ? k === 2 : k === 1;
      const segs = facesRoad ? [[0, 0.1], [0.5, 1]] : [[0, 1]]; // gate lines up with the stepping stones
      segs.forEach(([s0, s1]) => {
        const P = u => iso(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u);
        const p0 = P(s0), p1 = P(s1);
        ctx.lineCap = 'round';
        for (const [h, w] of [[4, 2], [8, 2]]) {
          ctx.strokeStyle = 'rgba(120,90,50,.25)'; ctx.lineWidth = (w + 1) * z;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y - h * z + 1); ctx.lineTo(p1.x, p1.y - h * z + 1); ctx.stroke();
          ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = w * z;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y - h * z); ctx.lineTo(p1.x, p1.y - h * z); ctx.stroke();
        }
        const n = Math.round((s1 - s0) * 10);
        for (let k2 = 0; k2 <= n; k2++) {
          const q = P(s0 + (s1 - s0) * k2 / n);
          ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = 'rgba(120,90,50,.35)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.roundRect(q.x - 1.6 * z, q.y - 11 * z, 3.2 * z, 11 * z, 1.5 * z); ctx.fill(); ctx.stroke();
        }
      });
    });
  }

  function ellipse(x, y, rx, ry, fill) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  }

  function drawHouse(ox, oy, lv, color, idx) {
    const x = ox + 0.15, y = oy + 0.15, w = 1.7, d = 1.7, z = cam.z;
    const C = iso(x + w, y + d), D = iso(x, y + d), B = iso(x + w, y);
    let totalH;
    ellipse(iso(x + w / 2, y + d / 2).x, iso(x + w / 2, y + d / 2).y + 4 * z, 62 * z, 30 * z, 'rgba(0,0,0,.08)');
    if (lv <= 1) {
      const g = gable(x + 0.1, y + 0.1, w - 0.2, d - 0.2, 0, 36, color, shade(color, 0.35));
      // tent opening
      poly([lerp(g.Cu, g.Bu, 0.28), lerp(g.Cu, g.Bu, 0.72), lerp(lerp(g.Cu, g.Bu, 0.5), g.R2, 0.75)], shade(color, -0.45));
      totalH = 36;
    } else {
      const st = HOUSE_STYLE[lv];
      const b = box(x, y, w, d, st.h, st.wall);
      const hh = st.h * z;
      // windows on the left face, door + windows on the right face
      const left = [D, C], right = [C, B];
      for (let r = 0; r < st.rows; r++) for (let c = 0; c < st.cols; c++) {
        const cu = (c + 0.5) / st.cols, ww = 0.25 / Math.sqrt(st.cols);
        faceQuad(left, hh, cu - ww / 2, cu + ww / 2, (r + 0.3) / st.rows, (r + 0.72) / st.rows, '#a9dcf5', '#ffffff');
      }
      faceQuad(right, hh, 0.32, 0.58, 0, 0.66 / st.rows, '#7a4b2a', shade('#7a4b2a', 0.25));
      if (st.rows > 1) faceQuad(right, hh, 0.32, 0.6, 0.58, 0.85, '#a9dcf5', '#ffffff');
      if (st.chimney) box(x + 0.3, y + 0.2, 0.28, 0.28, st.rh + 6, '#b4603e', st.h);
      gable(x - 0.04, y - 0.12, w + 0.08, d + 0.24, st.h, st.rh, color, st.wall);
      totalH = st.h + st.rh;
      if (st.tower) {
        box(x + 1.05, y + 1.05, 0.6, 0.6, 84, st.wall);
        faceQuad([iso(x + 1.05, y + 1.65), iso(x + 1.65, y + 1.65)], 84 * z, 0.3, 0.7, 0.72, 0.88, '#a9dcf5', '#fff');
        const apex = pyramid(x + 1.0, y + 1.0, 0.7, 0.7, 84, 30, color);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2 * z;
        ctx.beginPath(); ctx.moveTo(apex.x, apex.y); ctx.lineTo(apex.x, apex.y - 14 * z); ctx.stroke();
        poly([up(apex, 14 * z), { x: apex.x + 10 * z, y: apex.y - 11 * z }, up(apex, 8 * z)], '#ffd23f');
        totalH = 128;
      }
    }
    const top = iso(x, y).y - totalH * z;
    hits.push({ kind: 'house', plot: idx, x0: D.x, x1: B.x, y0: top, y1: C.y });
    labels.push({ plot: idx, x: iso(x + w / 2, y + d / 2).x, y: top - 6 * z });
  }

  function drawAvatar(i, j, color, energy, t, seed) {
    const c = iso(i + 0.5, j + 0.5), z = cam.z;
    const amp = energy === 'high' ? 5 : energy === 'mid' ? 2 : 0.6;
    const speed = energy === 'high' ? 7 : 3;
    const bob = Math.abs(Math.sin(t / 1000 * speed + seed)) * amp * z;
    ellipse(c.x, c.y, 9 * z, 4.5 * z, 'rgba(0,0,0,.18)');
    const by = c.y - bob;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(c.x - 7 * z, by - 19 * z, 14 * z, 16 * z, 6 * z); ctx.fill();
    ellipse(c.x, by - 26 * z, 7.5 * z, 7.5 * z, '#ffdcb8');
    ctx.fillStyle = shade(color, -0.35);
    ctx.beginPath(); ctx.arc(c.x, by - 27 * z, 7.8 * z, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#3a2a1a'; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.2 * z;
    if (energy === 'low') {
      for (const dx of [-2.8, 2.8]) { ctx.beginPath(); ctx.moveTo(c.x + (dx - 1.6) * z, by - 24.5 * z); ctx.lineTo(c.x + (dx + 1.6) * z, by - 24.5 * z); ctx.stroke(); }
      const ph = (t / 1400 + seed) % 1;
      ctx.save(); ctx.globalAlpha = 1 - ph; ctx.font = `bold ${(9 + ph * 5) * z}px sans-serif`; ctx.fillStyle = '#5b6b8c';
      ctx.fillText('z', c.x + (8 + ph * 6) * z, by - (34 + ph * 12) * z); ctx.restore();
    } else {
      for (const dx of [-2.8, 2.8]) ellipse(c.x + dx * z, by - 25 * z, 1.3 * z, 1.6 * z, '#3a2a1a');
      if (energy === 'high' && Math.sin(t / 300 + seed) > 0.6) emoji('✨', c.x + 11 * z, by - 30 * z, 11 * z);
    }
  }

  function drawCrop(i, j, g, mine, t) {
    const c = iso(i + 0.5, j + 0.5), z = cam.z;
    let crop, prog;
    if (typeof g === 'string') { crop = g; prog = 1; } else { crop = g.crop; prog = cropProgress(g); }
    if (prog >= 1) {
      const b = mine ? Math.abs(Math.sin(t / 320 + i * 1.7 + j)) * 3 * z : 0;
      emoji(CROPS[crop].emoji, c.x, c.y + 5 * z - b, 21 * z);
    } else {
      emoji('🌱', c.x, c.y + 4 * z, (9 + 9 * prog) * z);
    }
  }

  function drawTree(i, j, s) {
    const c = iso(i + 0.5, j + 0.5), z = cam.z * s;
    ellipse(c.x, c.y, 11 * z, 5 * z, 'rgba(0,0,0,.15)');
    ctx.fillStyle = '#8a5a36'; ctx.fillRect(c.x - 2.5 * z, c.y - 16 * z, 5 * z, 16 * z);
    ellipse(c.x, c.y - 24 * z, 13 * z, 12 * z, '#4f9a4b');
    ellipse(c.x - 4 * z, c.y - 29 * z, 9 * z, 8 * z, '#62b05a');
    ellipse(c.x + 4 * z, c.y - 33 * z, 7 * z, 6.5 * z, '#74c169');
  }

  function drawSign(ox, oy, idx) {
    const c = iso(ox + 2.5, oy + 2.5), z = cam.z;
    ctx.fillStyle = '#8a5a36'; ctx.fillRect(c.x - 2 * z, c.y - 26 * z, 4 * z, 26 * z);
    ctx.fillStyle = '#f3e3c3'; ctx.strokeStyle = '#a9773f'; ctx.lineWidth = 2 * z;
    ctx.beginPath(); ctx.roundRect(c.x - 16 * z, c.y - 42 * z, 32 * z, 20 * z, 4 * z); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a9773f'; ctx.font = `bold ${16 * z}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('+', c.x, c.y - 32 * z);
    hits.push({ kind: 'house', plot: idx, x0: c.x - 40 * z, x1: c.x + 40 * z, y0: c.y - 70 * z, y1: c.y + 10 * z });
    labels.push({ plot: idx, x: c.x, y: c.y - 48 * z, empty: true });
  }

  function pill(text, x, y, bg, fg, font) {
    ctx.font = font;
    const w = ctx.measureText(text).width + 16, h = 22;
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, 11); ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - h / 2 + 1);
    return { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y };
  }

  function drawLabels() {
    labels.forEach(l => {
      const p = S.plots[l.plot];
      let text, bg = 'rgba(255,255,255,.92)', fg = '#3b3125';
      if (l.empty) { text = t('empty_plot'); bg = 'rgba(255,248,232,.95)'; fg = '#a9773f'; }
      else if (p.owner === 'me') { text = S.name; bg = '#3b3125'; fg = '#fff'; }
      else {
        const f = friendById(p.owner);
        text = fname(f) + (f.shareGoal && f.goalToday ? ' ✅' : '');
      }
      const r = pill(text, l.x, l.y, bg, fg, '600 12px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif');
      hits.push({ kind: 'house', plot: l.plot, ...r });
    });
  }

  function drawBubble(t) {
    if (!S.pending.length) return;
    const l = labels.find(x => S.plots[x.plot].owner === 'me');
    if (!l) return;
    const b = Math.abs(Math.sin(t / 380)) * 5;
    const r = pill(`📦 ${S.pending.length}`, l.x, l.y - 28 - b, '#ef7d3c', '#fff', `bold 14px ${EMOJI_FONT},sans-serif`);
    hits.push({ kind: 'bubble', ...r });
  }

  function drawFloats(ts) {
    for (let k = floats.length - 1; k >= 0; k--) {
      const f = floats[k], age = (ts - f.born) / 1500;
      if (age > 1) { floats.splice(k, 1); continue; }
      const p = iso(f.wx, f.wy);
      const y = p.y - 50 * cam.z - age * 46;
      ctx.save();
      ctx.globalAlpha = 1 - age * age;
      ctx.font = `bold 16px -apple-system,"PingFang SC","Microsoft YaHei",${EMOJI_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(f.text, p.x, y);
      ctx.fillStyle = '#3b3125'; ctx.fillText(f.text, p.x, y);
      ctx.restore();
    }
  }

  function collectObjects(t) {
    const objs = [];
    S.plots.forEach((p, idx) => {
      const { ox, oy } = p;
      if (!p.owner) { objs.push({ d: ox + oy + 6.5, f: () => drawSign(ox, oy, idx) }); return; }
      const me = p.owner === 'me';
      const f = me ? null : friendById(p.owner);
      const color = me ? S.color : f.color;
      objs.push({ d: ox + oy + 3.9, f: () => drawHouse(ox, oy, me ? S.house : f.house, color, idx) });
      const energy = me ? energyLevel() : (f.goalToday ? 'high' : 'mid');
      objs.push({ d: ox + oy + 7, f: () => drawAvatar(ox + 3, oy + 2, color, energy, t, idx * 1.3) });
      (me ? S.garden : f.garden).forEach((g, gi) => {
        const gx = ox + gi % 3, gy = oy + 3 + Math.floor(gi / 3);
        if (g) objs.push({ d: gx + gy + 2, f: () => drawCrop(gx, gy, g, me, t) });
      });
      (me ? S.decos : f.decos).forEach(id => {
        const d = DECOS.find(x => x.id === id);
        const dx = ox + d.at[0], dy = oy + d.at[1];
        objs.push({ d: dx + dy + 2, f: () => { const c = iso(dx + 0.5, dy + 0.5); emoji(d.emoji, c.x, c.y + 4 * cam.z, 24 * cam.z); } });
      });
    });
    SCENERY.forEach(s => objs.push({
      d: s.x + s.y + 2,
      f: s.kind === 'tree' ? () => drawTree(s.x, s.y, s.s) : () => { const c = iso(s.x + 0.5, s.y + 0.5); emoji('🌼', c.x, c.y + 3 * cam.z, 12 * cam.z); },
    }));
    return objs.sort((a, b) => a.d - b.d);
  }

  // ---------- loop ----------
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!visible || !S || !W) return;
    if (target) {
      cam.x += (target.x - cam.x) * 0.16; cam.y += (target.y - cam.y) * 0.16;
      if (Math.abs(target.x - cam.x) < 0.5 && Math.abs(target.y - cam.y) < 0.5) target = null;
    }
    ctx.clearRect(0, 0, W, H);
    hits = []; labels = [];
    drawGround();
    collectObjects(ts).forEach(o => o.f());
    drawLabels();
    drawBubble(ts);
    drawFloats(ts);
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    if (!S || !r.width || (r.width === W && r.height === H)) return; // no town yet during onboarding
    const dpr = window.devicePixelRatio || 1;
    const cx = W ? unIso(W / 2, H / 2) : null;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!centered) { centerOnPlot(plotIndexOf('me'), false); centered = true; }
    else if (cx && !target) centerOn(cx.x, cx.y, false);
  }

  // yFrac: where the lot lands vertically (lower value = higher on screen, e.g. above an open sheet).
  function centerOn(wx, wy, animate = true, yFrac = 0.56) {
    const tgt = { x: W / 2 - (wx - wy) * TW / 2 * cam.z, y: H * yFrac - (wx + wy) * TH / 2 * cam.z };
    if (animate) target = tgt; else { cam.x = tgt.x; cam.y = tgt.y; target = null; }
  }
  function centerOnPlot(idx, animate = true, yFrac) {
    const p = S.plots[idx];
    if (p) centerOn(p.ox + 2.5, p.oy + 2.5, animate, yFrac);
  }
  function zoomAt(px, py, z) {
    z = Math.max(0.5, Math.min(2, z));
    const w = unIso(px, py);
    cam.z = z;
    cam.x = px - (w.x - w.y) * TW / 2 * z;
    cam.y = py - (w.x + w.y) * TH / 2 * z;
    target = null;
  }

  function tap(sx, sy) {
    const bubble = hits.find(h => h.kind === 'bubble' && sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1);
    if (bubble) return onHit(bubble);
    const w = unIso(sx, sy), tx = Math.floor(w.x), ty = Math.floor(w.y);
    const me = S.plots[plotIndexOf('me')];
    const lx = tx - me.ox, ly = ty - me.oy;
    // Garden sits in front of the house, so it wins over the house's hit box.
    if (lx >= 0 && lx < 3 && ly >= 3 && ly < 5) return onHit({ kind: 'garden', i: (ly - 3) * 3 + lx });
    for (let k = hits.length - 1; k >= 0; k--) {
      const h = hits[k];
      if (sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1) return onHit(h);
    }
    const idx = S.plots.findIndex(p => tx >= p.ox && tx < p.ox + 5 && ty >= p.oy && ty < p.oy + 5);
    if (idx >= 0 && S.plots[idx].owner !== 'me') onHit({ kind: 'plot', plot: idx });
  }

  function bindInput() {
    const ptrs = new Map();
    let drag = null, pinch = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, pos(e));
      if (ptrs.size === 1) { const p = pos(e); drag = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: false }; }
      else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z }; drag = null;
      }
    });
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, pos(e));
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
      } else if (drag) {
        const p = pos(e), dx = p.x - drag.sx, dy = p.y - drag.sy;
        if (Math.hypot(dx, dy) > 6) drag.moved = true;
        if (drag.moved) { cam.x = drag.cx + dx; cam.y = drag.cy + dy; target = null; }
      }
    });
    const end = e => {
      if (drag && !drag.moved && ptrs.size === 1) { const p = pos(e); tap(p.x, p.y); }
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      drag = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); drag = null; pinch = null; });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const p = pos(e);
      zoomAt(p.x, p.y, cam.z * (e.deltaY < 0 ? 1.1 : 0.9));
    }, { passive: false });
  }

  return {
    init(canvas, hitHandler) {
      cv = canvas; ctx = cv.getContext('2d'); onHit = hitHandler;
      bindInput();
      new ResizeObserver(resize).observe(cv);
      requestAnimationFrame(frame);
    },
    setVisible(v) { visible = v; if (v) resize(); },
    centerOnPlot,
    debug: () => ({ cam: { ...cam }, target, W, H, visible }),
    floatAtPlot(idx, text) { const p = S.plots[idx]; floats.push({ text, wx: p.ox + 1, wy: p.oy + 1, born: performance.now() }); },
    floatAtGarden(i, text) {
      const p = S.plots[plotIndexOf('me')];
      floats.push({ text, wx: p.ox + i % 3 + 0.5, wy: p.oy + 3 + Math.floor(i / 3) + 0.5, born: performance.now() });
    },
  };
})();
