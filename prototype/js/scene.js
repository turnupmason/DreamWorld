'use strict';
// Scenes: a home (outside), inside the house, and the whole town.
// Owns the camera, the wandering people and animals, tapping, and design mode.

const Scene = (() => {
  let cv, mainCtx, W = 0, H = 0;
  let mode = 'home', owner = 'me';
  const cams = {};                 // one camera per view, so going back keeps your spot
  const ZOOM = { home: [0.35, 2.2], interior: [0.5, 2.8], town: [0.07, 1.6] };
  let target = null, onHit = () => {}, visible = true, lastTs = 0;
  let hits = [];
  const floats = [];
  const ents = new Map();
  let edit = null;                 // { scope: 'yard' | 'room', hold: null | { k, rot, tint, id }, sel: id }
  let hover = null;                // mouse position, for the placement preview
  let rankCache = { t: 0, list: [] };

  const key = () => (mode === 'town' ? 'town' : mode + ':' + owner);
  const fine = () => cam.z >= 0.34; // enough zoom for tile-level detail

  // ---------- camera ----------
  function centerOn(wx, wy, animate = true, yFrac = 0.5) {
    const tgt = { x: W / 2 - (wx - wy) * TW / 2 * cam.z, y: H * yFrac - (wx + wy) * TH / 2 * cam.z };
    if (animate) target = tgt; else { cam.x = tgt.x; cam.y = tgt.y; target = null; }
  }
  function fit() {
    if (mode === 'home') {
      cam.z = clamp(W / 520, 0.6, 1.2);
      centerOn(7, 5, false, 0.5);
    } else if (mode === 'interior') {
      const [rw, rd] = roomSize(homeOf(owner));
      cam.z = clamp(Math.min(W * 0.92 / ((rw + rd) * 32), H * 0.7 / ((rw + rd) * 16 + 100)), 0.5, 1.9);
      centerOn(rw / 2, rd / 2, false, 0.63);
    } else {
      cam.z = clamp(W * 1.02 / ((TOWN_W + TOWN_D) * 32), 0.07, 0.6);
      centerOn(TOWN_W / 2, TOWN_D / 2 - 1, false, 0.5);
    }
  }
  function useCam() {
    const k = key();
    if (!cams[k]) { cams[k] = { x: 0, y: 0, z: 1 }; cam = cams[k]; fit(); }
    cam = cams[k];
  }
  function zoomAt(px, py, z) {
    const [lo, hi] = ZOOM[mode];
    z = clamp(z, lo, hi);
    const w = unIso(px, py);
    cam.z = z;
    cam.x = px - (w.x - w.y) * TW / 2 * z;
    cam.y = py - (w.x + w.y) * TH / 2 * z;
    target = null;
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height || (r.width === W && r.height === H)) return;
    const dpr = window.devicePixelRatio || 1, ow = W, oh = H;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ow) Object.values(cams).forEach(c => { c.x += (W - ow) / 2; c.y += (H - oh) / 2; });
  }

  // ---------- wandering ----------
  function ent(id, init) {
    let e = ents.get(id);
    if (!e) { e = Object.assign({ x: 0, y: 0, path: [], wait: Math.random() * 2, face: 1, phase: 0, moving: false }, init()); ents.set(id, e); }
    return e;
  }
  function stepEnt(e, dt, speed, pick) {
    if (e.path.length) {
      const [tx, ty] = e.path[0], dx = tx - e.x, dy = ty - e.y, dist = Math.hypot(dx, dy), step = speed * dt;
      if (dist <= step) { e.x = tx; e.y = ty; e.path.shift(); } else { e.x += dx / dist * step; e.y += dy / dist * step; }
      if (Math.abs(dx - dy) > 0.02) e.face = dx - dy > 0 ? 1 : -1;
      e.phase += dt * 10;
      e.moving = true;
    } else {
      e.moving = false;
      e.wait -= dt;
      if (e.wait <= 0) { e.path = pick(e) || []; e.wait = 1.2 + Math.random() * 3.5; }
    }
  }
  function bfs(g, gw, gh, sx, sy, tx, ty) {
    const prev = new Int32Array(gw * gh).fill(-1), start = sy * gw + sx, goal = ty * gw + tx;
    const q = [start]; prev[start] = start;
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi];
      if (c === goal) break;
      const cx = c % gw, cy = (c - cx) / gw;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const n = ny * gw + nx;
        if (prev[n] !== -1 || !g[n]) continue;
        prev[n] = c; q.push(n);
      }
    }
    if (prev[goal] === -1) return null;
    const path = [];
    for (let c = goal; c !== start; c = prev[c]) path.push([c % gw, Math.floor(c / gw)]);
    return path.reverse();
  }
  function walkTo(e, g, gw, gh, maxLen = 14) {
    const sx = clamp(Math.floor(e.x), 0, gw - 1), sy = clamp(Math.floor(e.y), 0, gh - 1);
    for (let k = 0; k < 14; k++) {
      const tx = Math.floor(Math.random() * gw), ty = Math.floor(Math.random() * gh);
      if (!g[ty * gw + tx] || (tx === sx && ty === sy)) continue;
      const p = bfs(g, gw, gh, sx, sy, tx, ty);
      if (p && p.length <= maxLen) return p.map(([x, y]) => [x + 0.3 + Math.random() * 0.4, y + 0.3 + Math.random() * 0.4]);
    }
    return null;
  }
  function lotGrid(h) {
    const g = new Uint8Array(LOT_W * LOT_D).fill(1);
    const block = (x, y, w, d) => { for (let j = y; j < y + d; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < LOT_W && j < LOT_D) g[j * LOT_W + i] = 0; };
    const [fx, fy, w, d] = HOUSES[h.house].fp;
    block(fx, fy, w, d);
    if (h.house >= 3) block(fx, fy + d, w, 1);   // porches and steps
    const pr = pastureRect(h); if (pr) block(pr.x, pr.y, pr.w, pr.d);
    block(AREA.fields.x, AREA.fields.y, 4, h.fields.length / 4);
    h.yard.forEach(it => { const [w2, d2] = itemSize('yard', it); block(it.x, it.y, w2, d2); });
    if (h.car >= 0) block(0, 8, 2, 3);
    g[(fy + d) * LOT_W + 3] = 1; // the door step stays open
    return g;
  }
  function roomGrid(h) {
    const [rw, rd] = roomSize(h), g = new Uint8Array(rw * rd).fill(1);
    h.room.items.forEach(it => {
      if (FURN[it.k].flat) return;
      const [w, d] = itemSize('room', it);
      for (let j = it.y; j < it.y + d; j++) for (let i = it.x; i < it.x + w; i++) g[j * rw + i] = 0;
    });
    return g;
  }
  const SPEED = { chicken: 0.7, rabbit: 0.9, sheep: 0.45, pig: 0.45, cow: 0.35, dog: 1.3 };
  function personSpeed(h) { const e = h.id === 'me' ? energyLevel() : friendEnergy(h); return e === 'high' ? 1.5 : e === 'mid' ? 1.1 : 0.7; }

  // ---------- one home lot ----------
  function lotGround(h, ox, oy, opt) {
    const z = cam.z, f = fine();
    if (f) {
      for (let j = 0; j < LOT_D; j++) for (let i = 0; i < LOT_W; i++) {
        const v = hash(i + ox, j + oy);
        tile(ox + i, oy + j, (i + j) % 2 ? (v > 0.5 ? '#a8d981' : '#a5d67d') : (v > 0.5 ? '#a0d279' : '#9dcf76'));
      }
    } else flatRect(ox, oy, LOT_W, LOT_D, '#a2d47b');
    // driveway
    flatRect(ox + AREA.drive.x + 0.1, oy + AREA.drive.y, AREA.drive.w - 0.2, AREA.drive.d, '#cfc8bb', 'rgba(0,0,0,.05)');
    // stone path from the door to the gate
    const [, hfy, , hd] = HOUSES[h.house].fp;
    if (f) for (let j = hfy + hd; j < LOT_D; j++) for (const dv of [0.28, 0.72]) {
      const c = iso(ox + 3.5 + (hash(j, dv) - 0.5) * 0.2, oy + j + dv);
      ellipse(c.x, c.y, 8 * z, 4 * z, '#e6dccb', 'rgba(0,0,0,.08)', 1);
    } else flatRect(ox + 3.2, oy + hfy + hd, 0.6, LOT_D - hfy - hd, '#e6dccb');
    // pasture
    const pr = pastureRect(h);
    if (pr) {
      flatRect(ox + pr.x, oy + pr.y, pr.w, pr.d, '#b8dd8c');
      if (f) for (let k = 0; k < pr.w * pr.d / 3; k++) {
        const c = iso(ox + pr.x + 0.3 + hash(k, 3) * (pr.w - 0.6), oy + pr.y + 0.3 + hash(k, 7) * (pr.d - 0.6));
        ellipse(c.x, c.y, 9 * z, 4 * z, 'rgba(160,120,70,.18)');
      }
    } else if (opt.mine) {
      const p1 = PASTURE[1], y = AREA.pasture.y + AREA.pasture.d - p1.d;
      ctx.save(); ctx.setLineDash([6 * z, 5 * z]);
      flatRect(ox + AREA.pasture.x, oy + y, p1.w, p1.d, 'rgba(255,255,255,.18)', 'rgba(255,255,255,.95)', 0, 2 * z);
      ctx.restore();
    }
    // fields
    for (let i = 0; i < h.fields.length; i++) {
      const [x, y] = fieldPos(i);
      if (f) {
        tile(ox + x, oy + y, '#9a6a44', 'rgba(255,255,255,.22)');
        for (const v of [0.3, 0.55, 0.8]) { const a = iso(ox + x + 0.12, oy + y + v), b = iso(ox + x + 0.88, oy + y + v); line(a.x, a.y, b.x, b.y, 'rgba(70,40,20,.3)', 1.1 * z); }
      } else tile(ox + x, oy + y, '#9a6a44');
    }
    if (opt.mine && h.fieldLv < FIELD_LEVELS.length - 1) {
      ctx.save(); ctx.setLineDash([5 * z, 4 * z]);
      flatRect(ox + AREA.fields.x, oy + AREA.fields.y + h.fields.length / 4, 4, 1, 'rgba(255,255,255,.2)', 'rgba(255,255,255,.95)', 0, 2 * z);
      ctx.restore();
    }
    if (f) for (let k = 0; k < 18; k++) { // grass tufts
      const x = Math.floor(hash(k, 1 + ox) * LOT_W), y = Math.floor(hash(k, 2 + oy) * LOT_D);
      if (yardReserved(x, y) && !(x === 0 || y === 0)) continue;
      const c = iso(ox + x + 0.5, oy + y + 0.5);
      for (const dx of [-3, 0, 3]) line(c.x + dx * z, c.y, c.x + dx * 1.4 * z, c.y - 5 * z, '#86bf5f', 1 * z);
    }
  }
  // Fence pieces around the lot (gaps for the path and the driveway) and around the pasture.
  function fenceObjs(h, ox, oy, objs) {
    const pr = pastureRect(h), f = fine();
    const onPasture = (ax, ay, bx, by) => pr && ((ay === by && (ay === pr.y || ay === pr.y + pr.d) && ax >= pr.x && bx <= pr.x + pr.w) ||
      (ax === bx && (ax === pr.x || ax === pr.x + pr.w) && ay >= pr.y && by <= pr.y + pr.d));
    const seg = (ax, ay, bx, by, kind) => objs.push({ d: ox + oy + (ax + bx) / 2 + (ay + by) / 2 + 0.01, f: () => (kind === 'rail' ? rail : picket)(ox + ax, oy + ay, ox + bx, oy + by) });
    if (f) {
      for (let x = 0; x < LOT_W; x++) {
        if (!onPasture(x, 0, x + 1, 0)) seg(x, 0, x + 1, 0);
        if (x !== 3 && x > 1) seg(x, LOT_D, x + 1, LOT_D);
      }
      for (let y = 0; y < LOT_D; y++) {
        seg(0, y, 0, y + 1);
        if (!onPasture(LOT_W, y, LOT_W, y + 1)) seg(LOT_W, y, LOT_W, y + 1);
      }
      if (pr) {
        for (let x = pr.x; x < pr.x + pr.w; x++) { seg(x, pr.y, x + 1, pr.y, 'rail'); seg(x, pr.y + pr.d, x + 1, pr.y + pr.d, 'rail'); }
        for (let y = pr.y; y < pr.y + pr.d; y++) { seg(pr.x, y, pr.x, y + 1, 'rail'); seg(pr.x + pr.w, y, pr.x + pr.w, y + 1, 'rail'); }
      }
    } else { // zoomed out: whole edges at once
      seg(0, 0, LOT_W, 0); seg(0, 0, 0, LOT_D); seg(2, LOT_D, 3, LOT_D); seg(4, LOT_D, LOT_W, LOT_D); seg(LOT_W, 0, LOT_W, LOT_D);
    }
  }

  function lotObjects(h, ox, oy, objs, ts, dt, opt) {
    const z = cam.z, f = fine();
    // house
    const [fx, fy, hw, hd] = HOUSES[h.house].fp;
    objs.push({ d: ox + oy + fx + fy + (hw + hd) / 2, f: () => {
      const r = drawHouse(h, ox, oy, ts);
      if (opt.hits) hits.push({ kind: 'house', owner: h.id, ...r });
      opt.houseTop = { x: iso(ox + fx + hw / 2, oy + fy + hd / 2).x, y: r.top };
    } });
    // pasture: barn, trough, hay
    const pr = pastureRect(h);
    if (pr) {
      const bx = pr.x + pr.w - 2;
      objs.push({ d: ox + oy + bx + pr.y + 2, f: () => drawBarn(ox + bx, oy + pr.y) });
      objs.push({ d: ox + oy + pr.x + 0.75 + pr.y + pr.d - 0.6, f: () => drawTrough(ox + pr.x + 0.3, oy + pr.y + pr.d - 0.8) });
      objs.push({ d: ox + oy + pr.x + 0.7 + pr.y + 0.6, f: () => drawHay(ox + pr.x + 0.4, oy + pr.y + 0.4) });
    }
    fenceObjs(h, ox, oy, objs);
    // crops
    h.fields.forEach((fl, i) => {
      if (!fl) return;
      const [x, y] = fieldPos(i);
      objs.push({ d: ox + oy + x + y + 1, f: () => {
        if (f) drawCropTile(ox + x, oy + y, fl, ts, i * 1.31 + ox);
        else { const c = iso(ox + x + 0.5, oy + y + 0.5), st = cropStage(fl); ellipse(c.x, c.y - 2 * z * st, (3 + st * 2) * z * 4, (2 + st) * z * 3, st === 4 ? '#f2b33d' : '#6cbf4a'); }
      } });
    });
    // car
    if (h.car >= 0 && h.cars[h.car]) {
      const c = h.cars[h.car];
      objs.push({ d: ox + oy + 1 + 9.2, f: () => { const r = drawCar(c, ox + 0.5, oy + 8, ts); if (opt.hits && r) hits.push({ kind: 'car', owner: h.id, ...r }); } });
    }
    // yard items
    h.yard.forEach(it => {
      if (edit && edit.hold && edit.hold.id === it.id) return;
      const [w, d] = itemSize('yard', it);
      objs.push({ d: ox + oy + it.x + it.y + (w + d) / 2, f: () => {
        drawYardItem(it, ox + it.x, oy + it.y, ts);
        if (edit && edit.scope === 'yard' && opt.mine) hits.push({ kind: 'item', id: it.id, ...footRect(ox + it.x, oy + it.y, w, d, 40) });
      } });
    });
    // animals
    h.animals.forEach((a, k) => {
      const pet = ANIMALS[a.k].pet, id = h.id + ':' + a.id;
      const e = ent(id, () => {
        if (pet) return { x: 9 + Math.random(), y: 9 + Math.random() * 2 };
        const r = pr || { x: 10, y: 0, w: 4, d: 4 };
        return { x: r.x + 0.5 + Math.random() * (r.w - 2.5), y: r.y + 2.3 + Math.random() * (r.d - 2.8) };
      });
      const st = animalStage(a);
      stepEnt(e, dt, SPEED[a.k] * (st === 0 ? 0.8 : 1), en => {
        if (pet) return walkTo(en, lotGrid(h), LOT_W, LOT_D, 8);
        if (!pr) return null;
        for (let n = 0; n < 6; n++) {
          const x = pr.x + 0.4 + Math.random() * (pr.w - 0.8), y = pr.y + 0.4 + Math.random() * (pr.d - 0.8);
          if (x > pr.x + pr.w - 2.4 && y < pr.y + 2.4) continue; // barn corner
          if (Math.hypot(x - en.x, y - en.y) < 3) return [[x, y]];
        }
        return null;
      });
      objs.push({ d: ox + oy + e.x + e.y, f: () => {
        const p = iso(ox + e.x, oy + e.y);
        drawAnimal(a.k, st, p.x, p.y, z, { face: e.face, moving: e.moving, phase: e.phase, ts, seed: k * 1.7 });
        if (opt.hits) {
          const r = { x0: p.x - 16 * z, x1: p.x + 16 * z, y0: p.y - 30 * z, y1: p.y + 6 * z };
          hits.push({ kind: 'animal', owner: h.id, id: a.id, ...r });
          if (opt.mine && animalReady(a)) opt.bubbles.push({ a, p });
        }
      } });
    });
    // the owner, and you when visiting
    const people = [[h.id + '@' + h.id, h]];
    if (opt.visitor) people.push(['me@' + h.id, S.me]);
    people.forEach(([id, who], k) => {
      const e = ent(id, () => ({ x: DOOR_X + k * 0.8, y: fy + hd + 0.6 + k * 0.5 }));
      stepEnt(e, dt, personSpeed(who), en => walkTo(en, lotGrid(h), LOT_W, LOT_D));
      objs.push({ d: ox + oy + e.x + e.y, f: () => {
        const p = iso(ox + e.x, oy + e.y);
        const energy = who.id === 'me' ? energyLevel() : friendEnergy(who);
        drawPerson(p.x, p.y, z, { look: who.look, face: e.face, moving: e.moving, phase: e.phase, energy, ts, seed: k + ox, wave: e.wave > ts });
        if (opt.hits) hits.push({ kind: 'avatar', owner: who.id, x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 44 * z, y1: p.y + 4 * z });
      } });
    });
  }
  function footRect(x, y, w, d, hgt) {
    return { x0: iso(x, y + d).x, x1: iso(x + w, y).x, y0: iso(x, y).y - hgt * cam.z, y1: iso(x + w, y + d).y };
  }

  // ---------- views ----------
  function island(x0, y0, x1, y1) {
    const z = cam.z, th = 24 * z, dn = (p, h) => ({ x: p.x, y: p.y + h });
    const B = iso(x1, y0), C = iso(x1, y1), D = iso(x0, y1);
    poly([D, C, dn(C, th), dn(D, th)], '#b0805a');
    poly([C, B, dn(B, th), dn(C, th)], '#94683f');
    poly([D, C, dn(C, 5 * z), dn(D, 5 * z)], '#7fbd5e');
    poly([C, B, dn(B, 5 * z), dn(C, 5 * z)], '#6ca94f');
    flatRect(x0, y0, x1 - x0, y1 - y0, '#9fd178');
  }
  function road(x0, y, x1) {
    const z = cam.z;
    flatRect(x0, y + 0.15, x1 - x0, 1.7, '#8e959c');
    flatRect(x0, y + 0.05, x1 - x0, 0.12, '#d9d2c3'); flatRect(x0, y + 1.83, x1 - x0, 0.12, '#d9d2c3');
    for (let x = x0 + 0.3; x < x1; x += 1) { const a = iso(x, y + 1), b = iso(x + 0.45, y + 1); line(a.x, a.y, b.x, b.y, 'rgba(255,255,255,.85)', 1.6 * z); }
  }

  function renderHome(ts, dt) {
    const h = homeOf(owner), mine = owner === 'me';
    island(-1, -1, LOT_W + 1, LOT_D + 3);
    road(-1, LOT_D + 0.4, LOT_W + 1);
    const opt = { hits: true, mine, visitor: !mine, bubbles: [] };
    lotGround(h, 0, 0, opt);
    if (edit && edit.scope === 'yard') editGrid();
    const objs = [];
    lotObjects(h, 0, 0, objs, ts, dt, opt);
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    nightTint();
    // overlays
    const z = cam.z, b = Math.abs(Math.sin(ts / 380)) * 4;
    if (edit && edit.scope === 'yard') editOverlay(ts);
    else {
      opt.bubbles.forEach(({ a, p }) => {
        const d = ANIMALS[a.k], ch = nextIsBaby(a) ? '🍼' : GOODS[d.prod].e;
        hits.push({ kind: 'collect', id: a.id, pri: 2, ...bubble(ch, p.x, p.y - 26 * z, 1, b) });
      });
      if (mine) {
        h.fields.forEach((fl, i) => {
          if (!isRipe(fl)) return;
          const [x, y] = fieldPos(i), c = iso(x + 0.5, y + 0.5);
          if (Math.sin(ts / 500 + i) > 0.2) emoji('✨', c.x + 12 * z, c.y - 22 * z, 12 * z);
        });
        if (h.fieldLv < FIELD_LEVELS.length - 1) {
          const c = iso(AREA.fields.x + 2, AREA.fields.y + h.fields.length / 4 + 0.5);
          hits.push({ kind: 'buyField', pri: 1, ...pill(`🔓 ${t('expand_field')}`, c.x, c.y + 4, 'rgba(255,255,255,.92)', '#7a5a2a', `600 11px ${UI_FONT}`, 20) });
        }
        if (!h.pastureLv) {
          const p1 = PASTURE[1], c = iso(AREA.pasture.x + p1.w / 2, AREA.pasture.y + AREA.pasture.d - p1.d / 2);
          hits.push({ kind: 'buyPasture', pri: 1, ...pill(`🐄 ${t('build_pasture')}`, c.x, c.y, 'rgba(255,255,255,.92)', '#7a5a2a', `600 11px ${UI_FONT}`, 20) });
        }
        if (S.pending.length && opt.houseTop) {
          hits.push({ kind: 'pending', pri: 3, ...pill(`📦 ${S.pending.length}`, opt.houseTop.x, opt.houseTop.y - 6 - b, '#ef7d3c', '#fff', `bold 14px ${UI_FONT},${EMOJI_FONT}`) });
        }
      } else {
        h.fields.forEach((fl, i) => {
          if (!stealable(h, i)) return;
          const [x, y] = fieldPos(i), c = iso(x + 0.5, y + 0.5);
          hits.push({ kind: 'steal', owner: h.id, i, pri: 2, ...bubble('🖐️', c.x, c.y - 18 * z, 0.9, b) });
        });
        if (opt.houseTop) pill(t('home_of', { name: homeName(h) }), opt.houseTop.x, opt.houseTop.y - 6, 'rgba(255,255,255,.94)', '#3b3125', `600 12px ${UI_FONT}`);
      }
    }
  }

  function renderInterior(ts, dt) {
    const h = homeOf(owner), [rw, rd] = roomSize(h), z = cam.z, WH = 92;
    const wallCol = ROOM_WALLS[h.room.wall], fl = FLOORS[h.room.floor];
    const A = iso(0, 0), B = iso(rw, 0), C = iso(rw, rd), D = iso(0, rd), dn = (p, k) => ({ x: p.x, y: p.y + k });
    // floor slab
    poly([D, C, dn(C, 12 * z), dn(D, 12 * z)], shade(fl.c2, -0.35));
    poly([C, B, dn(B, 12 * z), dn(C, 12 * z)], shade(fl.c2, -0.45));
    // walls
    poly([D, A, up(A, WH * z), up(D, WH * z)], shade(wallCol, -0.07));
    poly([A, B, up(B, WH * z), up(A, WH * z)], wallCol);
    poly([up(D, WH * z), up(A, WH * z), up(A, (WH + 6) * z), up(D, (WH + 6) * z)], shade(wallCol, -0.2));
    poly([up(A, WH * z), up(B, WH * z), up(B, (WH + 6) * z), up(A, (WH + 6) * z)], shade(wallCol, -0.12));
    const leftW = [D, A], backW = [A, B];
    wallRect(leftW, 0, 0, 1, 0, 5, shade(wallCol, -0.3)); wallRect(backW, 0, 0, 1, 0, 5, shade(wallCol, -0.25));
    // windows show the sky at the current (simulated) time
    const sky = NIGHT > 0.5 ? '#26345f' : NIGHT > 0.1 ? '#e9a27a' : '#bfe6f7';
    const nW = Math.max(1, Math.floor(rw / 3));
    for (let i = 0; i < nW; i++) {
      const u = (i + 0.5) / nW;
      wallRect(backW, 0, u - 0.1, u + 0.1, 34, 70, '#fffaf0');
      wallRect(backW, 0, u - 0.085, u + 0.085, 36.5, 67.5, sky);
      if (NIGHT > 0.5) { const p = wallPt(backW, 0, u + 0.04, 58); circle(p.x, p.y, 3 * z, '#fff6c8'); }
      else { const p = wallPt(backW, 0, u - 0.03, 46); ellipse(p.x, p.y, 7 * z, 3 * z, 'rgba(255,255,255,.8)'); }
      wallLine(backW, 0, u, 36.5, u, 67.5, '#fffaf0', 1.5); wallLine(backW, 0, u - 0.085, 52, u + 0.085, 52, '#fffaf0', 1.5);
    }
    // clock on the wall shows the game time
    const cp = wallPt(leftW, 0, 0.55, 64), d = new Date(now());
    circle(cp.x, cp.y, 8 * z, '#fffaf0', '#7a4f2e', 1.6 * z);
    const ha = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * Math.PI * 2, ma = d.getMinutes() / 60 * Math.PI * 2;
    line(cp.x, cp.y, cp.x + Math.sin(ha) * 4 * z, cp.y - Math.cos(ha) * 4 * z, '#333', 1.4 * z);
    line(cp.x, cp.y, cp.x + Math.sin(ma) * 6 * z, cp.y - Math.cos(ma) * 6 * z, '#333', 1 * z);
    // picture frame
    wallRect(leftW, 0, 0.22, 0.38, 40, 62, '#8a5a36'); wallRect(leftW, 0, 0.235, 0.365, 42.5, 59.5, '#9fd0e8');
    const mp = wallPt(leftW, 0, 0.3, 46); pg([[mp.x - 6 * z, mp.y], [mp.x, mp.y - 9 * z], [mp.x + 6 * z, mp.y]], '#6cae5a');
    // door out (front of the left wall)
    const du = 0.1;
    wallRect(leftW, 0, du - 0.07, du + 0.07, 0, 52, '#fffaf0');
    wallRect(leftW, 0, du - 0.06, du + 0.06, 0, 49, '#8a5a36');
    const kp = wallPt(leftW, 0, du + 0.035, 24); circle(kp.x, kp.y, 1.4 * z, '#f2c230');
    const da = wallPt(leftW, 0, du - 0.07, 0), db = wallPt(leftW, 0, du + 0.07, 54);
    hits.push({ kind: 'exit', pri: 1, x0: Math.min(da.x, db.x) - 4, x1: Math.max(da.x, db.x) + 4, y0: db.y - 4, y1: da.y + 4 });
    // floor planks
    for (let j = 0; j < rd; j++) for (let i = 0; i < rw; i++) {
      tile(i, j, (i + j) % 2 ? fl.c1 : fl.c2);
      if (h.room.floor === 0 || h.room.floor === 3) { const a = iso(i, j + 0.5), b = iso(i + 1, j + 0.5); line(a.x, a.y, b.x, b.y, 'rgba(0,0,0,.08)', 1 * z); }
    }
    if (edit && edit.scope === 'room') editGrid();
    // rugs and mats first, then everything that stands
    const objs = [];
    h.room.items.forEach(it => {
      if (edit && edit.hold && edit.hold.id === it.id) return;
      const [w, dd] = itemSize('room', it), flat = FURN[it.k].flat;
      const fn = () => {
        drawFurn(it, it.x, it.y, ts);
        if (edit && edit.scope === 'room' && owner === 'me') hits.push({ kind: 'item', id: it.id, flat, ...footRect(it.x, it.y, w, dd, flat ? 4 : 40) });
        else if (!edit) hits.push({ kind: 'furn', k: it.k, ...footRect(it.x, it.y, w, dd, flat ? 4 : 40) });
      };
      if (flat) fn(); else objs.push({ d: it.x + it.y + (w + dd) / 2, f: fn });
    });
    const people = [['in:' + h.id, h]];
    if (owner !== 'me') people.push(['in:me@' + h.id, S.me]);
    people.forEach(([id, who], k) => {
      const e = ent(id, () => ({ x: 0.6 + k * 0.6, y: rd - 0.5 }));
      stepEnt(e, dt, personSpeed(who) * 0.8, en => walkTo(en, roomGrid(h), rw, rd, 10));
      objs.push({ d: e.x + e.y, f: () => {
        const p = iso(e.x, e.y), energy = who.id === 'me' ? energyLevel() : friendEnergy(who);
        drawPerson(p.x, p.y, z, { look: who.look, face: e.face, moving: e.moving, phase: e.phase, energy, ts, seed: k, wave: e.wave > ts });
        if (!edit) hits.push({ kind: 'avatar', owner: who.id, x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 44 * z, y1: p.y + 4 * z });
      } });
    });
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    drawGlows();
    if (edit && edit.scope === 'room') editOverlay(ts);
  }

  function renderTown(ts, dt) {
    const z = cam.z;
    island(-1, -1, TOWN_W, TOWN_D + 0.5);
    for (let r = 0; r < 3; r++) road(-1, r * SLOT_D + LOT_D, TOWN_W);
    for (let c = 0; c < 3; c++) flatRect(c * SLOT_W + LOT_W + 0.1, -1, 0.8, TOWN_D + 1.5, '#d9d2c3');
    const objs = [], tops = [];
    S.slots.forEach(s => {
      const ox = s.c * SLOT_W, oy = s.r * SLOT_D;
      if (!s.owner) {
        flatRect(ox, oy, LOT_W, LOT_D, '#c9dfa6');
        ctx.save(); ctx.setLineDash([8 * z, 6 * z]);
        flatRect(ox + 0.3, oy + 0.3, LOT_W - 0.6, LOT_D - 0.6, null, 'rgba(255,255,255,.9)', 0, 2 * z);
        ctx.restore();
        const c = iso(ox + LOT_W / 2, oy + LOT_D / 2);
        objs.push({ d: ox + oy + 13, f: () => {
          line(c.x, c.y, c.x, c.y - 40 * z, '#8a5a36', 4 * z);
          rrect(c.x - 34 * z, c.y - 66 * z, 68 * z, 30 * z, 5 * z, '#f3e3c3', '#a9773f', 2 * z);
          ctx.fillStyle = '#a9773f'; ctx.font = `bold ${22 * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('+', c.x, c.y - 51 * z);
        } });
        tops.push({ slot: s, x: c.x, y: c.y - 70 * z, empty: true });
        return;
      }
      const h = homeOf(s.owner), opt = { hits: false, mine: false, visitor: false, bubbles: [] };
      lotGround(h, ox, oy, opt);
      lotObjects(h, ox, oy, objs, ts, dt, opt);
      tops.push({ slot: s, h, opt, ox, oy });
    });
    // plaza
    const [pc, prr] = PLAZA, px = pc * SLOT_W, py = prr * SLOT_D, lv = townLevel(rankTotal());
    plazaGround(px, py);
    let hallTop = null;
    objs.push({ d: px + py + 10, f: () => { hallTop = drawTownHall(px, py, lv, ts); } });
    if (lv >= 2) objs.push({ d: px + py + 6 + 8 + 2, f: () => drawYardItem({ k: 'fountain' }, px + 6, py + 7, ts) });
    const deco = [['tree', 1, 8], ['tree', 12, 8], ['pine', 1, 1], ['pine', 12, 1]];
    if (lv >= 3) deco.push(['bench', 4, 9], ['bench', 10, 9], ['flowers', 3, 7], ['flowers', 10, 7], ['lamp', 5, 10], ['lamp', 9, 10]);
    if (lv >= 5) deco.push(['flowers', 2, 10], ['flowers', 11, 10], ['tree', 6, 11], ['tree', 8, 11]);
    deco.forEach(([k, x, y]) => objs.push({ d: px + py + x + y + 1, f: () => drawYardItem({ k }, px + x, py + y, ts) }));
    // street trees along the sidewalks
    for (let c = 0; c < 3; c++) for (let y = 1; y < TOWN_D; y += 4) {
      const x = c * SLOT_W + LOT_W;
      if (y % SLOT_D >= LOT_D) continue;
      objs.push({ d: x + y + 1, f: () => drawYardItem({ k: 'tree' }, x, y, ts) });
    }
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    nightTint();
    // labels: name, rank and total assets
    const rk = ranking();
    tops.forEach(tp => {
      if (tp.empty) {
        const r = pill(t('empty_lot'), tp.x, tp.y, 'rgba(255,248,232,.95)', '#a9773f', `600 11px ${UI_FONT}`, 20);
        hits.push({ kind: 'emptyLot', pri: 1, ...r });
        return;
      }
      const top = tp.opt.houseTop;
      if (!top) return;
      const i = rk.findIndex(r => r.h.id === tp.h.id), medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
      const me = tp.h.id === 'me';
      const r = pill(`${medal} ${homeName(tp.h)} · ${fmtCompact(rk[i].v)}`, top.x, top.y - 4, me ? '#3b3125' : 'rgba(255,255,255,.94)', me ? '#fff' : '#3b3125', `600 11px ${UI_FONT},${EMOJI_FONT}`, 21);
      hits.push({ kind: 'lot', owner: tp.h.id, pri: 1, ...r });
    });
    if (hallTop) {
      const r = pill(`🏛️ ${t('street_name')} Lv${lv}`, iso(px + 7, py + 3).x, hallTop.top - 6, '#ef7d3c', '#fff', `bold 12px ${UI_FONT},${EMOJI_FONT}`, 22);
      hits.push({ kind: 'plaza', pri: 1, ...r });
    }
  }
  function rankTotal() {
    const t0 = performance.now();
    if (t0 - rankCache.t > 1000) rankCache = { t: t0, total: townTotal() };
    return rankCache.total;
  }

  function nightTint() {
    if (NIGHT > 0.01) { ctx.fillStyle = `rgba(22,32,72,${0.38 * NIGHT})`; ctx.fillRect(0, 0, W, H); }
    drawGlows();
  }

  // ---------- design mode ----------
  function editGrid() {
    const z = cam.z;
    if (edit.scope === 'room') {
      const [rw, rd] = roomSize(S.me);
      for (let j = 0; j < rd; j++) for (let i = 0; i < rw; i++) tile(i, j, null, 'rgba(255,255,255,.45)');
    } else yardSpots().forEach(([x, y]) => tile(x, y, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.55)'));
  }
  function holdOrigin(sx, sy) {
    const p = unIso(sx, sy), it = edit.hold, def = itemDef(edit.scope, it.k);
    const [w, d] = it.rot ? [def.d, def.w] : [def.w, def.d];
    return { x: Math.floor(p.x) - Math.floor((w - 1) / 2), y: Math.floor(p.y) - Math.floor((d - 1) / 2), w, d };
  }
  function editOverlay(ts) {
    const z = cam.z;
    if (edit.sel) {
      const it = findItem(edit.scope, edit.sel);
      if (it) {
        const [w, d] = itemSize(edit.scope, it);
        ctx.save(); ctx.setLineDash([5 * z, 4 * z]); ctx.lineDashOffset = -ts / 60;
        flatRect(it.x, it.y, w, d, 'rgba(239,125,60,.18)', '#ef7d3c', 0.5, 2.5 * z);
        ctx.restore();
      }
    }
    if (edit.hold && hover) {
      const o = holdOrigin(hover.x, hover.y);
      const ok = canPlace(S.me, edit.scope, edit.hold.k, o.x, o.y, edit.hold.rot, edit.hold.id);
      flatRect(o.x, o.y, o.w, o.d, ok ? 'rgba(76,175,106,.35)' : 'rgba(229,72,77,.35)', ok ? '#4caf6a' : '#e5484d', 0.5, 2 * z);
      ctx.save(); ctx.globalAlpha = 0.6;
      const ghost = { ...edit.hold, x: o.x, y: o.y };
      if (edit.scope === 'room') drawFurn(ghost, o.x, o.y, ts); else drawYardItem(ghost, o.x, o.y, ts);
      ctx.restore();
    }
  }

  // ---------- floating text ----------
  function drawFloats(ts) {
    for (let k = floats.length - 1; k >= 0; k--) {
      const f = floats[k], age = (ts - f.born) / 1600;
      if (age > 1 || f.mode !== mode) { if (age > 1) floats.splice(k, 1); continue; }
      const p = iso(f.wx, f.wy), y = p.y - 46 * cam.z - age * 44;
      ctx.save();
      ctx.globalAlpha = 1 - age * age;
      ctx.font = `bold 16px ${UI_FONT},${EMOJI_FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText(f.text, p.x, y);
      ctx.fillStyle = '#3b3125'; ctx.fillText(f.text, p.x, y);
      ctx.restore();
    }
  }

  // ---------- loop ----------
  function frame(ts) {
    requestAnimationFrame(frame);
    render(ts);
  }
  function render(ts) {
    if (!visible || !S || !W) return;
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    ctx = mainCtx;
    useCam();
    if (target) {
      cam.x += (target.x - cam.x) * 0.16; cam.y += (target.y - cam.y) * 0.16;
      if (Math.abs(target.x - cam.x) < 0.5 && Math.abs(target.y - cam.y) < 0.5) target = null;
    }
    NIGHT = nightAmount(now());
    GLOWS = [];
    ctx.clearRect(0, 0, W, H);
    hits = [];
    try {
      if (mode === 'town') renderTown(ts, dt);
      else if (mode === 'interior') renderInterior(ts, dt);
      else renderHome(ts, dt);
    } catch (e) { console.error(e); }
    drawFloats(ts);
  }

  // ---------- input ----------
  const inside = (h, sx, sy) => sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1;
  function tap(sx, sy) {
    useCam();
    if (edit) {
      if (edit.hold) { hover = { x: sx, y: sy }; const o = holdOrigin(sx, sy); return onHit({ kind: 'place', x: o.x, y: o.y }); }
      const items = hits.filter(h => h.kind === 'item' && inside(h, sx, sy));
      const solid = items.filter(h => !h.flat);
      const pick = (solid.length ? solid : items).pop();
      return onHit(pick ? { kind: 'item', id: pick.id } : { kind: 'deselect' });
    }
    for (const pri of [3, 2, 1]) {
      const h = [...hits].reverse().find(x => x.pri === pri && inside(x, sx, sy));
      if (h) return onHit(h);
    }
    const w = unIso(sx, sy), tx = Math.floor(w.x), ty = Math.floor(w.y);
    if (mode === 'home') {
      const h = homeOf(owner);
      const small = [...hits].reverse().find(x => (x.kind === 'animal' || x.kind === 'avatar') && inside(x, sx, sy));
      if (small) return onHit(small);
      const fx = tx - AREA.fields.x, fy = ty - AREA.fields.y;
      if (fx >= 0 && fx < 4 && fy >= 0 && fy < 4) {
        const i = fy * 4 + fx;
        if (i < h.fields.length) return onHit({ kind: 'field', owner, i });
        if (owner === 'me' && fy === h.fields.length / 4) return onHit({ kind: 'buyField' });
      }
      const big = [...hits].reverse().find(x => (x.kind === 'house' || x.kind === 'car') && inside(x, sx, sy));
      if (big) return onHit(big);
      if (owner === 'me' && inRect(AREA.pasture, tx, ty)) return onHit({ kind: h.pastureLv ? 'pasture' : 'buyPasture' });
      return;
    }
    if (mode === 'interior') {
      const h = [...hits].reverse().find(x => (x.kind === 'avatar' || x.kind === 'furn') && inside(x, sx, sy));
      if (h) onHit(h);
      return;
    }
    // town: tap anywhere on a lot to go there
    const s = S.slots.find(sl => tx >= sl.c * SLOT_W && tx < sl.c * SLOT_W + LOT_W && ty >= sl.r * SLOT_D && ty < sl.r * SLOT_D + LOT_D);
    if (s) return onHit(s.owner ? { kind: 'lot', owner: s.owner } : { kind: 'emptyLot' });
    if (tx >= PLAZA[0] * SLOT_W && tx < PLAZA[0] * SLOT_W + LOT_W && ty >= PLAZA[1] * SLOT_D && ty < PLAZA[1] * SLOT_D + LOT_D) onHit({ kind: 'plaza' });
  }
  function bindInput() {
    const ptrs = new Map();
    let drag = null, pinch = null;
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, pos(e));
      if (ptrs.size === 1) { const p = pos(e); drag = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: false }; }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z }; drag = null; }
    });
    cv.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') hover = pos(e);
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
    cv.addEventListener('pointerleave', () => { hover = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); zoomAt(p.x, p.y, cam.z * (e.deltaY < 0 ? 1.1 : 0.9)); }, { passive: false });
  }

  // ---------- thumbnails for the shop and sheets ----------
  const thumbCache = new Map();
  function frameFoot(fw, fd, hgt, w, h, zmax = 2.2) {
    const z = Math.min(zmax, w * 0.84 / ((fw + fd) * 32), h * 0.86 / ((fw + fd) * 16 + hgt));
    cam = { x: 0, y: 0, z };
    const c = iso(fw / 2, fd / 2);
    cam.x = w / 2 - c.x; cam.y = h / 2 + hgt * z / 2 - c.y;
    return z;
  }
  const fakeField = (crop, stage) => ({ crop, at: now() - CROPS[crop].grow * [0.04, 0.2, 0.5, 0.8, 1.2][stage], left: 1, thieves: [] });
  const THUMB = {
    crop(k, o, w, h) {
      frameFoot(1, 1, 34, w, h, 2.6);
      tile(0, 0, '#9a6a44');
      drawCropTile(0, 0, fakeField(k, o.stage === undefined ? 4 : o.stage), 0, 1);
    },
    animal(k, o, w, h) {
      const z = frameFoot(1, 1, 26, w, h, 2.4), c = iso(0.5, 0.6);
      ellipse(c.x, c.y, 30 * z, 14 * z, '#b8dd8c');
      drawAnimal(k, o.stage === undefined ? 2 : o.stage, c.x, c.y, z * 1.25, { face: 1, ts: 0, seed: 1 });
    },
    good(k, o, w, h) { ctx.font = `${h * 0.6}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(GOODS[k].e, w / 2, h / 2); },
    furn(k, o, w, h) {
      const D = FURN[k];
      frameFoot(D.w, D.d, 46, w, h, 2);
      flatRect(-0.1, -0.1, D.w + 0.2, D.d + 0.2, 'rgba(0,0,0,.05)');
      drawFurn({ k, rot: 0, tint: o.tint || (D.tint ? TINTS[4] : null) }, 0, 0, 1000);
    },
    yard(k, o, w, h) {
      const D = YARD[k], tall = ['tree', 'pine', 'lamp', 'swing'].includes(k);
      frameFoot(D.w, D.d, tall ? 56 : 28, w, h, 2);
      flatRect(-0.05, -0.05, D.w + 0.1, D.d + 0.1, '#b6e092');
      drawYardItem({ k, rot: 0 }, 0, 0, 1000);
    },
    car(k, o, w, h) {
      frameFoot(1.1, 2.5, 30, w, h, 2);
      drawCar({ k, color: o.color || CAR_COLORS[0] }, 0, 0, 0);
    },
    house(k, o, w, h) {
      const H = HOUSES[k], [fx, fy, fw, fd] = H.fp;
      frameFoot(fw + (k >= 4 ? 0.6 : 0), fd + 0.5, [56, 64, 76, 104, 110, 150][k], w, h, 1.6);
      drawHouse({ house: k, wall: o.wall || WALL_COLORS[k === 1 ? 6 : 1], roof: o.roof || ROOF_COLORS[0] }, -fx, -fy, 0);
    },
    person(k, o, w, h) {
      cam = { x: 0, y: 0, z: 1 };
      drawPerson(w / 2, h * 0.92, h * 0.8 / 46, { look: o.look, face: 1, energy: o.energy || 'mid', ts: o.ts || 0, seed: 0, moving: !!o.moving, phase: o.phase || 0 });
    },
    field(k, o, w, h) {
      frameFoot(2, 2, 30, w, h, 1.8);
      for (let i = 0; i < 4; i++) tile(i % 2, Math.floor(i / 2), '#9a6a44', 'rgba(255,255,255,.25)');
      ['carrot', 'wheat', 'tomato', 'cabbage'].forEach((c, i) => drawCropTile(i % 2, Math.floor(i / 2), fakeField(c, 3 + (i % 2)), 0, i));
    },
    pasture(k, o, w, h) {
      frameFoot(2, 2, 30, w, h, 1.8);
      flatRect(0, 0, 2, 2, '#b8dd8c');
      rail(0, 0, 2, 0); rail(0, 0, 0, 2);
      const c = iso(1, 1.1);
      drawAnimal('cow', 2, c.x, c.y, cam.z * 0.9, { face: 1, ts: 0 });
      rail(0, 2, 2, 2); rail(2, 0, 2, 2);
    },
  };
  function thumb(kind, k, o = {}, w = 120, h = 96) {
    const id = kind + ':' + k + ':' + JSON.stringify(o) + ':' + w + 'x' + h;
    if (thumbCache.has(id) && !o.live) return thumbCache.get(id);
    const c = o.canvas || document.createElement('canvas'), dpr = 2;
    c.width = w * dpr; c.height = h * dpr;
    const saved = [ctx, cam, GLOWS, NIGHT];
    ctx = c.getContext('2d'); ctx.scale(dpr, dpr); GLOWS = []; NIGHT = 0;
    try { THUMB[kind](k, o, w, h); } catch (e) { console.error(e); }
    [ctx, cam, GLOWS, NIGHT] = saved;
    if (o.canvas) return null;
    const url = c.toDataURL();
    thumbCache.set(id, url);
    return url;
  }

  return {
    init(canvas, hitHandler) {
      cv = canvas; mainCtx = cv.getContext('2d'); onHit = hitHandler;
      bindInput();
      new ResizeObserver(resize).observe(cv);
      resize();
      requestAnimationFrame(frame);
    },
    setVisible(v) { visible = v; if (v) resize(); },
    setView(m, o = 'me') {
      if (m === mode && o === owner) return;
      mode = m; owner = o; edit = null; target = null;
    },
    view: () => ({ mode, owner }),
    recenter() { if (!W) return; useCam(); fit(); },
    startEdit(scope) { edit = { scope, hold: null, sel: null }; },
    stopEdit() { edit = null; },
    getEdit: () => edit,
    hold(item) { if (edit) { edit.hold = item; edit.sel = null; } },
    select(id) { if (edit) edit.sel = id; },
    wave(who) { const e = ents.get(mode === 'interior' ? 'in:' + (who === 'me' && owner !== 'me' ? 'me@' + owner : who) : who + '@' + (who === 'me' ? owner : who)); if (e) e.wave = performance.now() + 1800; },
    floatAt(wx, wy, text) { floats.push({ text, wx, wy, mode, born: performance.now() }); },
    floatField(i, text) { const [x, y] = fieldPos(i); floats.push({ text, wx: x + 0.5, wy: y + 0.5, mode: 'home', born: performance.now() }); },
    floatAnimal(hid, aid, text) { const e = ents.get(hid + ':' + aid); if (e) floats.push({ text, wx: e.x, wy: e.y, mode: 'home', born: performance.now() }); },
    floatHouse(text) { const [fx, fy, w, d] = HOUSES[S.me.house].fp; floats.push({ text, wx: fx + w / 2, wy: fy + d / 2, mode: 'home', born: performance.now() }); },
    thumb,
    debug: () => ({ cam: { ...cam }, W, H, mode, owner, edit, ents: ents.size }),
    look(z, wx, wy) { useCam(); cam.z = z; centerOn(wx, wy, false, 0.5); }, // for testing: zoom onto a world point
    bench(n = 20) { const t0 = performance.now(); for (let i = 0; i < n; i++) render(t0 + i * 16); return +((performance.now() - t0) / n).toFixed(2); },
  };
})();
