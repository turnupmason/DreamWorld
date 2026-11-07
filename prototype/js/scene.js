'use strict';
// The world: every home is a lot in town, with roads, a plaza and woods around it, so there is always
// something around your home. Views: 'home' (camera on one lot: yours, or a friend's you are visiting),
// 'town' (zoomed out over the whole street) and 'interior' (inside a house).
// Your townie never wanders on its own: tap somewhere and it walks there; tap a crop, an animal, a tree or the
// mailbox and it walks over and does the job (crouch, pick, fish, read). While the real you works out
// (Apple Watch), it does the same workout.

const Scene = (() => {
  let cv, mainCtx, W = 0, H = 0;
  let mode = 'home', owner = 'me';
  const worldCam = { x: 0, y: 0, z: 1 }, roomCams = {};
  let fly = null, follow = false, visible = true, lastTs = 0, liveKey = null, worldReady = false, dragging = false, attract = false;
  let onHit = () => {};
  let hits = [];
  const floats = [];
  const ents = new Map();
  let edit = null, hover = null;
  let rankCache = { t: 0, total: 0 };
  const WOODS = 14, WX0 = WORLD.x0 - WOODS, WY0 = WORLD.y0 - WOODS, WX1 = WORLD.x1 + WOODS, WY1 = WORLD.y1 + WOODS;
  const LAKE = { x: LANDMARKS.lake.x, y: LANDMARKS.lake.y, rx: LANDMARKS.lake.rx, ry: LANDMARKS.lake.ry };
  const ZOOM = { world: [0.045, 2.4], interior: [0.5, 2.8] };
  const GH = LOT_D + 2;                      // a lot plus the road in front
  const gwOf = h => homeW(h) + 1;            // ... and the side path
  const far = () => cam.z < 0.2;             // zoomed far out: simple houses, no animals or people
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SEAT = { spinbike: 9, treadmill: 5 };                                   // standing / riding on a machine
  const SEAT_H = { sofa: 10, armchair: 10, chair: 11.5, rocker: 10, beanbag: 6 }; // seat height: hips here, feet on the floor
  const LIE_H = { bed: 13.5, singlebed: 12.5, bunkbed: 14.5, sleepbag: 6 };      // lying: on top of the mattress
  const LIE_HEAD = { bed: 0.38, singlebed: 0.36, bunkbed: 0.36, sleepbag: 0.3 };  // where the head goes (on the pillow)
  // Which way your head points when lying: towards the pillow (the back of the bed).
  const lieDir = it => (it ? (it.rot ? Math.atan2(-16, -32) : Math.atan2(-16, 32)) : 0);

  // Your townie outside (lot-local coordinates on lot `lot`) and inside (room coordinates).
  const me = { x: DOOR_X, y: 12.5, lot: 'me', path: [], face: 1, phase: 0, moving: false, jobs: [], cur: null, act: null, sneak: false };
  const meIn = { x: 1, y: 1, path: [], face: 1, phase: 0, moving: false, jobs: [], cur: null, act: null, sneak: false, room: null };

  const origin = id => lotOrigin(id);
  const cam0 = () => (mode === 'interior' ? roomCams[owner] : mode === 'home' ? homeCams[owner] || worldCam : worldCam);
  const fine = () => cam.z >= 0.34;

  // ---------- camera ----------
  function centerOn(wx, wy, yFrac = 0.5) {
    cam.x = W / 2 - (wx - wy) * TW / 2 * cam.z;
    cam.y = H * yFrac - (wx + wy) * TH / 2 * cam.z;
  }
  function homeZoom() { return clamp(W / 520, 0.6, 1.2); }
  function townZoom() { return clamp(W / 2700, 0.1, 0.22); }
  function lotCenter(id) { const [ox, oy] = origin(id); return [ox + 5.5, oy + 9]; }
  // Looking at your own community: around your home. Another community: around its town centre.
  function townCenter() { if (VIEW_TOWN !== townOf('me')) return [80, 30]; const [ox, oy] = origin('me'); return [ox + 24, oy + 22]; }
  function flyTo(wx, wy, z, instant) {
    if (instant || !worldReady) { cam.z = z; centerOn(wx, wy); fly = null; worldReady = true; return; }
    fly = { wx, wy, z };
  }
  function frameView(instant) {
    if (mode === 'interior') {
      const [rw, rd] = roomSize(homeOf(owner));
      cam.z = clamp(Math.min(W * 0.92 / ((rw + rd) * 32), H * 0.7 / ((rw + rd) * 16 + 100)), 0.5, 1.9);
      centerOn(rw / 2, rd / 2, 0.63);
    } else if (mode === 'town') { const [cx, cy] = townCenter(); flyTo(cx, cy, townZoom(), instant); }
    else if (mode === 'home') { const [ox, oy] = origin(owner), h = homeOf(owner); cam.z = clamp(W / 400, minHomeZoom(), 2.4); centerOn(ox + Math.min(homeW(h || S.me), LOT_W) / 2 - 1, oy + LOT_D / 2 - 0.5, 0.5); fly = null; return; }
    else { const [cx, cy] = lotCenter(owner); flyTo(cx, cy, homeZoom(), instant); }
  }
  // Inside, and every home (it's its own little island), keeps its own camera; the town has one.
  const homeCams = {};
  function useCam() {
    if (mode === 'interior') {
      if (!roomCams[owner]) { roomCams[owner] = { x: 0, y: 0, z: 1 }; cam = roomCams[owner]; frameView(true); }
      cam = roomCams[owner];
    } else if (mode === 'home') {
      if (!homeCams[owner]) { homeCams[owner] = { x: 0, y: 0, z: 1 }; cam = homeCams[owner]; frameView(true); }
      cam = homeCams[owner];
    } else cam = worldCam;
  }
  function stepCamera(dt) {
    if (mode === 'interior') return;
    // the first screens: drift slowly over the street
    if (attract && !dragging) {
      const t = performance.now() / 1000;
      const tx = 60 + Math.sin(t / 9) * 22, ty = 24 + Math.cos(t / 11) * 12;
      const c = unIso(W / 2, H / 2), k = 1 - Math.exp(-dt * 0.8);
      cam.z += (attract.z - cam.z) * k;
      centerOn(c.x + (tx - c.x) * k, c.y + (ty - c.y) * k);
      return;
    }
    if (follow && mode === 'home' && !fly) {
      const [ox, oy] = origin(me.lot), c = unIso(W / 2, H / 2), k = 1 - Math.exp(-dt * 3);
      const tx = ox + me.x, ty = oy + me.y;
      centerOn(c.x + (tx - c.x) * k, c.y + (ty - c.y) * k);
    }
    // keep your townie on screen while it walks somewhere
    if (!follow && !fly && !dragging && mode === 'home' && me.lot === owner && me.moving) {
      const [ox, oy] = origin(me.lot), p = iso(ox + me.x, oy + me.y);
      const tx = clamp(p.x, 90, W - 90), ty = clamp(p.y, 180, H - 100);
      if (tx !== p.x || ty !== p.y) { const k = 1 - Math.exp(-dt * 3); cam.x += (tx - p.x) * k; cam.y += (ty - p.y) * k; }
    }
    if (!fly) return;
    const c = unIso(W / 2, H / 2), k = 1 - Math.exp(-dt * 7);
    const nz = cam.z + (fly.z - cam.z) * k;
    const nx = c.x + (fly.wx - c.x) * k, ny = c.y + (fly.wy - c.y) * k;
    cam.z = nz; centerOn(nx, ny);
    if (Math.abs(fly.z - nz) < 0.003 && Math.hypot(fly.wx - nx, fly.wy - ny) < 0.05) { cam.z = fly.z; centerOn(fly.wx, fly.wy); fly = null; }
  }
  // The camera stays over the town (not out over the woods), and can't zoom out past the whole town filling the screen.
  function clampCam() {
    if (mode === 'interior') return;
    if (mode === 'home') {   // the island stays on screen
      if (cam.z < minHomeZoom()) { const c0 = unIso(W / 2, H / 2); cam.z = minHomeZoom(); centerOn(c0.x, c0.y); }
      const R = islandRect(owner), c = unIso(W / 2, H / 2), x = clamp(c.x, R.x0 + 1, R.x1 - 1), y = clamp(c.y, R.y0 + 1, R.y1 - 1);
      if (x !== c.x || y !== c.y) centerOn(x, y);
      return;
    }
    if (cam.z < minWorldZoom()) { const c0 = unIso(W / 2, H / 2); cam.z = minWorldZoom(); centerOn(c0.x, c0.y); }
    const c = unIso(W / 2, H / 2), x = clamp(c.x, WORLD.x0 + 4, WORLD.x1 - 4), y = clamp(c.y, WORLD.y0 + 4, WORLD.y1 - 4);
    if (x !== c.x || y !== c.y) centerOn(x, y);
  }
  function minWorldZoom() { return Math.max(0.06, W / ((WORLD.x1 - WORLD.x0 + WORLD.y1 - WORLD.y0) * 32) * 1.25); }
  // The whole island fits the screen at the smallest zoom.
  function minHomeZoom() { const R = islandRect(owner); return clamp(W * 1.05 / ((R.x1 - R.x0 + R.y1 - R.y0) * 32), 0.15, 1); }
  function zoomAt(px, py, z) {
    const [lo, hi] = ZOOM[mode === 'interior' ? 'interior' : 'world'];
    // pinching out past the whole town opens the world map
    if (mode === 'town' && z < cam.z && cam.z <= minWorldZoom() * 1.001 && z < minWorldZoom() * 0.96 && onWorldOut && performance.now() - worldOutAt > 1500) { worldOutAt = performance.now(); onWorldOut(); }
    z = clamp(z, mode === 'interior' ? lo : mode === 'home' ? minHomeZoom() : Math.max(lo, minWorldZoom()), hi);
    const w = unIso(px, py);
    cam.z = z;
    cam.x = px - (w.x - w.y) * TW / 2 * z;
    cam.y = py - (w.x + w.y) * TH / 2 * z;
    fly = null; clampCam();
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height || (r.width === W && r.height === H)) return;
    const dpr = window.devicePixelRatio || 1, ow = W, oh = H;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ow) [worldCam, ...Object.values(roomCams), ...Object.values(homeCams)].forEach(c => { c.x += (W - ow) / 2; c.y += (H - oh) / 2; });
  }
  // World rectangle on screen, padded so tall things just below the edge still draw.
  function viewRect() {
    const pts = [unIso(0, 0), unIso(W, 0), unIso(0, H + 180 * cam.z), unIso(W, H + 180 * cam.z)];
    return { x0: Math.min(...pts.map(p => p.x)) - 1, x1: Math.max(...pts.map(p => p.x)) + 1, y0: Math.min(...pts.map(p => p.y)) - 1, y1: Math.max(...pts.map(p => p.y)) + 1 };
  }
  function lotVisible(ox, oy, gw = LOT_W + 1) {
    const a = iso(ox, oy), b = iso(ox + gw, oy), c = iso(ox + gw, oy + GH), d = iso(ox, oy + GH);
    const x0 = Math.min(d.x, a.x), x1 = Math.max(b.x, c.x), y0 = a.y - 170 * cam.z, y1 = c.y;
    return x1 > 0 && x0 < W && y1 > 0 && y0 < H;
  }

  // ---------- walking ----------
  function lotNav(h) {
    const GW = gwOf(h), LW = homeW(h), g = new Uint8Array(GW * GH).fill(1);
    const block = (x, y, w, d) => { for (let j = Math.floor(y); j < y + d; j++) for (let i = Math.floor(x); i < x + w; i++) if (i >= 0 && j >= 0 && i < GW && j < GH) g[j * GW + i] = 0; };
    const [fx, fy, w, d] = HOUSES[h.house].fp;
    block(fx, fy, w, d);
    const pr = pastureRect(h);
    if (pr) { block(pr.x + pr.w - 2, pr.y, 2, 2); block(pr.x + 1, pr.y + pr.d - 1, 1, 1); block(pr.x, pr.y, 1, 1); }   // barn, water trough, hay
    if (h.pondLv) block(AREA.pond.x, AREA.pond.y, AREA.pond.w, AREA.pond.d);
    h.trees.forEach((t, i) => { if (t && i < orchardSlots(h)) block(ORCHARD_SLOTS[i][0], ORCHARD_SLOTS[i][1], 1, 1); });
    h.yard.forEach(it => { const [w2, d2] = itemSize('yard', it); block(it.x, it.y, w2, d2); });
    if (h.car >= 0 && h.cars[h.car]) block(0, 9, 2, 2);
    block(MAILBOX[0], MAILBOX[1], 1, 1);
    const wall = (ax, ay, bx, by) => {
      if (ax === bx && Math.min(ay, by) === LOT_D - 1 && Math.max(ay, by) === LOT_D) return !(ax <= 1 || ax === 3);   // front fence, open at drive and path
      if (ay === by && Math.min(ax, bx) === LW - 1 && Math.max(ax, bx) === LW) return ay < LOT_D;                      // side fence
      if (pr && inRect(pr, ax, ay) !== inRect(pr, bx, by)) {
        const gy = pr.y + pr.d - 1;
        return !(ay === gy && by === gy && Math.min(ax, bx) === pr.x - 1);                                              // pasture gate
      }
      return false;
    };
    return { g, gw: GW, gh: GH, wall };
  }
  function roomNav(h) {
    const [rw, rd] = roomSize(h), g = new Uint8Array(rw * rd).fill(1);
    const block = (x, y, w, d) => { for (let j = y; j < y + d; j++) for (let i = x; i < x + w; i++) if (i < rw && j < rd) g[j * rw + i] = 0; };
    viewRoom(h).items.forEach(it => {
      if (FURN[it.k].flat) return;
      const [w, d] = itemSize('room', it);
      block(it.x, it.y, w, d);
    });
    stairsRects(h, viewLv(h)).forEach(s => block(s.x, s.y, s.w, s.d));
    return { g, gw: rw, gh: rd, wall: () => false };
  }
  // The storey being shown inside (the same LEVEL for your home and a friend's).
  const viewLv = h => Math.min(LEVEL, floorsOf(h) - 1);
  const viewRoom = h => roomAt(h, viewLv(h));
  // Where you stand to take the stairs: in front of the foot of the flight up, or in front of the opening down.
  // Where you stand before taking the stairs: on the free tile next to them.
  function stairsSpot(h, kind) {
    const s = stairsRects(h, viewLv(h)).find(r => r.kind === kind) || stairsRects(h, viewLv(h))[0];
    if (!s) return [0.6, roomSize(h)[1] * 0.9, 1];
    return s.kind === 'up' ? [s.ax + 0.5, s.ay + 0.5, 1] : [s.ax + 0.5, s.ay + 0.45, -1, true];
  }
  // Turn towards where we're going. Mostly up or down the screen: a full front / back view; otherwise the 3/4 view
  // facing left or right (back of the head when going up the screen).
  function faceTo(a, dx, dy) {
    const sx = dx - dy, sy = dx + dy;
    if (Math.abs(sx) > 0.02) a.face = sx > 0 ? 1 : -1;
    if (Math.abs(sy) > 0.02) a.back = sy < 0;
    if (Math.abs(sx) + Math.abs(sy) > 0.02) a.view = Math.abs(sx) < Math.abs(sy) * 0.45 ? (sy > 0 ? 'front' : 'back') : null;
  }
  function bfsFrom(N, sx, sy) {
    const { g, gw, gh, wall } = N, prev = new Int32Array(gw * gh).fill(-1), start = sy * gw + sx;
    prev[start] = start;
    const q = [start];
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], cx = c % gw, cy = (c - cx) / gw;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const n = ny * gw + nx;
        // blocked tiles can't be entered, except while still getting out of the one you start on (bed, sofa)
        if (prev[n] !== -1 || (!g[n] && g[c]) || wall(cx, cy, nx, ny)) continue;
        prev[n] = c; q.push(n);
      }
    }
    return prev;
  }
  function open(N, x, y) { return x >= 0 && y >= 0 && x < N.gw && y < N.gh && N.g[y * N.gw + x]; }
  function clearLine(N, ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.2);
    let px = Math.floor(ax), py = Math.floor(ay);
    for (let k = 1; k <= n; k++) {
      const tx = Math.floor(ax + (bx - ax) * k / n), ty = Math.floor(ay + (by - ay) * k / n);
      if (tx === px && ty === py) continue;
      if (!open(N, tx, ty)) return false;
      if (tx !== px && ty !== py) {
        if (!open(N, tx, py) || !open(N, px, ty)) return false;
        if (N.wall(px, py, tx, py) || N.wall(tx, py, tx, ty) || N.wall(px, py, px, ty) || N.wall(px, ty, tx, ty)) return false;
      } else if (N.wall(px, py, tx, ty)) return false;
      px = tx; py = ty;
    }
    return true;
  }
  // Path to a point: exact if its tile is reachable, otherwise to the closest reachable tile (within reach).
  // grid: keep to the tile grid (no diagonal shortcuts), for animals, whose side view must match the way they walk.
  function planPath(a, N, px, py, reach = 2.2, grid = false) {
    const sx = clamp(Math.floor(a.x), 0, N.gw - 1), sy = clamp(Math.floor(a.y), 0, N.gh - 1), start = sy * N.gw + sx;
    const prev = bfsFrom(N, sx, sy);
    const tx = Math.floor(px), ty = Math.floor(py);
    let goal = tx >= 0 && ty >= 0 && tx < N.gw && ty < N.gh ? ty * N.gw + tx : -1, exact = goal >= 0 && prev[goal] !== -1;
    if (!exact) {
      let bd = 1e9; goal = -1;
      for (let i = 0; i < prev.length; i++) if (prev[i] !== -1) { const ix = i % N.gw, iy = (i - ix) / N.gw, dd = Math.hypot(ix + 0.5 - px, iy + 0.5 - py); if (dd < bd) { bd = dd; goal = i; } }
      if (goal < 0 || bd > reach) return null;
    }
    const tiles = [];
    for (let c = goal; c !== start; c = prev[c]) tiles.push(c);
    tiles.reverse();
    const pts = tiles.map(c => [c % N.gw + 0.5, Math.floor(c / N.gw) + 0.5]);
    if (exact) pts.push(grid ? [pts.length ? pts[pts.length - 1][0] : a.x, py] : [px, py]);
    if (grid) return pts.filter((p, i) => i === pts.length - 1 || !pts[i + 1] || !((i > 0 && pts[i - 1][0] === p[0] && pts[i + 1][0] === p[0]) || (i > 0 && pts[i - 1][1] === p[1] && pts[i + 1][1] === p[1])));
    const out = [];
    let cx = a.x, cy = a.y, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !clearLine(N, cx, cy, pts[j][0], pts[j][1])) j--;
      out.push(pts[j]); [cx, cy] = pts[j]; i = j + 1;
    }
    return out;
  }
  function stepAlong(a, dt, speed) {
    if (!a.path.length) { a.moving = false; return; }
    const [tx, ty] = a.path[0], dx = tx - a.x, dy = ty - a.y, dist = Math.hypot(dx, dy), st = speed * dt;
    if (dist <= st) { a.x = tx; a.y = ty; a.path.shift(); } else { a.x += dx / dist * st; a.y += dy / dist * st; }
    faceTo(a, dx, dy);
    a.phase += dt * (4 + speed * 3.5);
    a.moving = true;
  }
  // Jobs: { spot() → [x, y, face], pose, dur, sneak, valid(), start(), done(), fail() }
  function runActor(a, nav, dt, ts, speed) {
    if (a.act) {
      if (ts >= a.act.until) { const j = a.act.job; a.act = null; a.cur = null; if (j.done) j.done(); }
      return;
    }
    if (a.path.length) {
      stepAlong(a, dt, a.fast ? speed * 1.8 : a.sneak ? speed * 0.6 : speed);
      if (!a.path.length) { a.fast = false; if (a.cur) arrive(a, ts); }
      return;
    }
    a.moving = false;
    if (a.cur) { arrive(a, ts); return; }
    while (a.jobs.length) {
      const j = a.jobs.shift();
      if (j.valid && !j.valid()) continue;
      const p = j.spot(), path = planPath(a, nav(), p[0], p[1], j.reach);
      if (!path) { if (j.fail) j.fail(); continue; }
      a.cur = j; a.spot = p; a.path = path; a.sneak = !!j.sneak;
      if (!path.length) arrive(a, ts);
      break;
    }
  }
  function arrive(a, ts) {
    const j = a.cur;
    a.moving = false; a.sneak = false;
    if (!j) return;
    if (j.valid && !j.valid()) { a.cur = null; return; }
    if (a.spot && a.spot[2]) a.face = a.spot[2];
    a.back = !!(a.spot && a.spot[3]); a.view = null;
    if (j.start) j.start(a);
    if (j.dur > 0) a.act = { job: j, pose: j.pose, until: ts + j.dur };
    else { a.cur = null; if (j.done) j.done(); }
  }
  function cancel(a) { a.jobs = []; a.cur = null; a.act = null; a.path = []; a.seat = 0; a.useId = null; }
  function speedOf(h) {
    const e = h.id === 'me' ? energyLevel() : friendEnergy(h);
    return { great: 2.6, good: 2.2, tired: 1.7, exhausted: 1.3 }[e];
  }

  // Wandering for friends and animals.
  function ent(id, init) {
    let e = ents.get(id);
    if (!e) { e = Object.assign({ x: 0, y: 0, path: [], wait: Math.random() * 2, face: 1, phase: 0, moving: false }, init()); ents.set(id, e); }
    return e;
  }
  function wander(e, dt, speed, pick) {
    if (e.hold && e.hold > performance.now()) { e.moving = false; return; }
    if (e.path.length) { stepAlong(e, dt, speed); return; }
    e.moving = false;
    e.wait -= dt;
    if (e.wait <= 0) { e.path = pick(e) || []; e.wait = 1.2 + Math.random() * 3.5; }
  }
  function randomWalk(e, N, maxD = 6, maxY = LOT_D, grid = false) {
    for (let k = 0; k < 10; k++) {
      const tx = Math.floor(e.x + (Math.random() - 0.5) * maxD * 2), ty = Math.floor(e.y + (Math.random() - 0.5) * maxD * 2);
      if (ty >= maxY || !open(N, tx, ty)) continue;
      const p = planPath(e, N, tx + 0.3 + Math.random() * 0.4, ty + 0.3 + Math.random() * 0.4, 0, grid);
      if (p && p.length) return p;
    }
    return null;
  }
  const SPEED = { chicken: 0.7, duck: 0.6, rabbit: 0.9, sheep: 0.45, goat: 0.55, pig: 0.45, cow: 0.35, alpaca: 0.4, dog: 1.3, cat: 0.9 };

  // ---------- live workouts ("mini me") ----------
  const roadLoop = h => { const w = homeW(h) + 0.4; return [[0.8, 14.7], [w, 14.7], [w, 15.4], [0.8, 15.4]]; };
  function liveSpot(type, h) {
    if (type === 'swim') {
      const pool = h.yard.find(it => it.k === 'pool');
      if (h.pondLv) return { x: AREA.pond.x + AREA.pond.w / 2, y: AREA.pond.y + AREA.pond.d / 2, swim: 'pond' };
      if (pool) { const [w, d] = itemSize('yard', pool); return { x: pool.x + w / 2, y: pool.y + d / 2, swim: 'pool' }; }
      if (mode !== 'town') return { x: TUB.x, y: TUB.y, swim: 'tub' };   // at home (an island): an inflatable pool
      const [ox, oy] = origin(h.id);
      return { x: LAKE.x - ox, y: LAKE.y - oy, swim: 'lake' };
    }
    return { x: AREA.house.x + 4.5, y: PORCH.y + 0.6 };
  }
  const ROAD_TYPES = { run: 'run', walk: 'walk', cycle: 'bike', wheel: 'walk' };
  const ROAD_SPEED = { run: 3.4, walk: 1.6, cycle: 4.4, wheel: 1.8 };
  // Moves a townie for a workout. Returns the pose to draw.
  function doLive(a, type, h, dt, ts) {
    if (ROAD_TYPES[type]) {
      if (!a.path.length) {
        if (a.y < LOT_D) { const p = planPath(a, lotNav(h), 3.5, 14.7, 2); a.path = p && p.length ? p : [[3.5, 14.7]]; a.loopI = 0; }
        else { const L = roadLoop(h); a.loopI = ((a.loopI || 0) + 1) % L.length; a.path = [L[a.loopI]]; }
      }
      stepAlong(a, dt, ROAD_SPEED[type] * (h.id === 'me' ? energyMult() : 1));
      return ROAD_TYPES[type];
    }
    const s = liveSpot(type, h);
    if (s.swim) {
      const t = ts / 2200, r = s.swim === 'lake' ? 1.6 : 0.6;
      a.x = s.x + Math.cos(t) * r; a.y = s.y + Math.sin(t) * r * 0.7; a.face = -Math.sin(t) > 0 ? 1 : -1; a.path = [];
      return 'swim';
    }
    if (Math.hypot(a.x - s.x, a.y - s.y) > 0.2) {
      if (!a.path.length) { const p = planPath(a, lotNav(h), s.x, s.y, 3); a.path = p && p.length ? p : [[s.x, s.y]]; }
      stepAlong(a, dt, 2);
      return a.moving ? 'walk' : 'stand';
    }
    a.face = -1;
    return WORKOUT_POSE[type] || 'stand';
  }

  // ---------- one lot ----------
  function lotGround(h, ox, oy, opt) {
    const z = cam.z, f = fine(), LW = homeW(h);
    if (f) {
      for (let j = 0; j < LOT_D; j++) for (let i = 0; i < LW; i++) {
        const v = hash(i + ox, j + oy);
        tile(ox + i, oy + j, LAWN[((i + j) % 2) * 2 + (v > 0.5 ? 1 : 0)]);
      }
    } else flatRect(ox, oy, LW, LOT_D, PAL.lawn);
    flatRect(ox + AREA.drive.x + 0.1, oy + AREA.drive.y, AREA.drive.w - 0.2, AREA.drive.d, '#cfc8bb', 'rgba(0,0,0,.05)');
    const [, hfy, , hd] = HOUSES[h.house].fp;
    if (f) for (let j = hfy + hd; j < LOT_D; j++) for (const dv of [0.28, 0.72]) {
      const c = iso(ox + 3.5 + (hash(j, dv) - 0.5) * 0.2, oy + j + dv);
      ellipse(c.x, c.y, 8 * z, 4 * z, '#e6dccb', 'rgba(0,0,0,.08)', 1);
    } else flatRect(ox + 3.2, oy + hfy + hd, 0.6, LOT_D - hfy - hd, '#e6dccb');
    const dashed = (x, y, w, d) => { ctx.save(); ctx.setLineDash([6 * z, 5 * z]); flatRect(ox + x, oy + y, w, d, 'rgba(255,255,255,.16)', 'rgba(255,255,255,.95)', 0, 2 * z); ctx.restore(); };
    const pr = pastureRect(h);
    if (pr) {
      flatRect(ox + pr.x, oy + pr.y, pr.w, pr.d, '#b8dd8c');
      if (f) for (let k = 0; k < pr.w * pr.d / 3; k++) {
        const c = iso(ox + pr.x + 0.3 + hash(k, 3) * (pr.w - 0.6), oy + pr.y + 0.3 + hash(k, 7) * (pr.d - 0.6));
        ellipse(c.x, c.y, 9 * z, 4 * z, 'rgba(160,120,70,.18)');
      }
    } else if (opt.mine && f) { const p1 = PASTURE[1]; dashed(AREA.pasture.x, AREA.pasture.y + AREA.pasture.d - p1.d, p1.w, p1.d); }
    if (h.orchardLv) {
      flatRect(ox + AREA.orchard.x, oy + AREA.orchard.y, AREA.orchard.w, AREA.orchard.d, '#9fd07a');
      if (f) ORCHARD_SLOTS.slice(0, orchardSlots(h)).forEach(([sx, sy], i) => { if (!h.trees[i]) { const c = iso(ox + sx + 0.5, oy + sy + 0.5); ellipse(c.x, c.y, 12 * z, 6 * z, '#9a6a44'); } });
    } else if (opt.mine && f) dashed(AREA.orchard.x, AREA.orchard.y, AREA.orchard.w, AREA.orchard.d);
    if (!h.pondLv && opt.mine && f) dashed(AREA.pond.x, AREA.pond.y, AREA.pond.w, AREA.pond.d);
    for (let i = 0; i < h.fields.length; i++) {
      const [x, y] = fieldPos(i);
      if (f) {
        tile(ox + x, oy + y, '#9a6a44', 'rgba(255,255,255,.22)');
        for (const v of [0.3, 0.55, 0.8]) { const a = iso(ox + x + 0.12, oy + y + v), b = iso(ox + x + 0.88, oy + y + v); line(a.x, a.y, b.x, b.y, 'rgba(70,40,20,.3)', 1.1 * z); }
      } else tile(ox + x, oy + y, '#9a6a44');
    }
    if (opt.mine && f && h.fieldLv < FIELD_LEVELS.length - 1) dashed(AREA.fields.x, AREA.fields.y + h.fields.length / 4, 4, 1);
    if (f) for (let k = 0; k < 18 + (LW - LOT_W); k++) {
      const x = Math.floor(hash(k, 1 + ox) * LW), y = Math.floor(hash(k, 2 + oy) * LOT_D);
      if (yardReserved(x, y, LW)) continue;
      const c = iso(ox + x + 0.5, oy + y + 0.5);
      for (const dx of [-3, 0, 3]) line(c.x + dx * z, c.y, c.x + dx * 1.4 * z, c.y - 5 * z, '#86bf5f', 1 * z);
    }
    // soft contact shadows so built things sit on the grass instead of floating
    if (f) h.yard.forEach(it => {
      if (NO_SHADOW.has(it.k)) return;
      const [w, d] = itemSize('yard', it);
      flatRect(ox + it.x + 0.06, oy + it.y + 0.1, w - 0.02, d - 0.02, 'rgba(40,60,20,.16)');
    });
  }
  const NO_SHADOW = new Set(['flowers', 'hedge', 'tree', 'pine', 'arch', 'pool', 'fountain', 'campfire']);
  // Furniture shadow on the floor: a little bigger than the footprint and pushed towards the front (light from the back window).
  function furnShadow(it) {
    const [w, d] = itemSize('room', it);
    flatRect(it.x + 0.03, it.y + 0.06, w + 0.02, d + 0.04, 'rgba(70,40,15,.15)');
    flatRect(it.x + 0.08, it.y + 0.1, w - 0.1, d - 0.1, 'rgba(70,40,15,.1)');
  }
  function fenceObjs(h, ox, oy, objs) {
    const pr = pastureRect(h), f = fine(), LOT_W = homeW(h);
    if (far()) return;
    const onPasture = (ax, ay, bx, by) => pr && ((ay === by && (ay === pr.y || ay === pr.y + pr.d) && ax >= pr.x && bx <= pr.x + pr.w) ||
      (ax === bx && (ax === pr.x || ax === pr.x + pr.w) && ay >= pr.y && by <= pr.y + pr.d));
    const seg = (ax, ay, bx, by, kind) => objs.push({ d: ox + oy + (ax + bx) / 2 + (ay + by) / 2 + 0.01, f: () => (kind === 'rail' ? rail : picket)(ox + ax, oy + ay, ox + bx, oy + by) });
    if (f) {
      for (let x = 0; x < LOT_W; x++) {
        if (!onPasture(x, 0, x + 1, 0)) seg(x, 0, x + 1, 0);
        if (x !== 3 && x > 1) seg(x, LOT_D, x + 1, LOT_D);
      }
      for (let y = 0; y < LOT_D; y++) { seg(0, y, 0, y + 1); if (!onPasture(LOT_W, y, LOT_W, y + 1)) seg(LOT_W, y, LOT_W, y + 1); }
      if (pr) {
        const gy = pr.y + pr.d - 1;
        for (let x = pr.x; x < pr.x + pr.w; x++) { seg(x, pr.y, x + 1, pr.y, 'rail'); seg(x, pr.y + pr.d, x + 1, pr.y + pr.d, 'rail'); }
        for (let y = pr.y; y < pr.y + pr.d; y++) { if (y !== gy) seg(pr.x, y, pr.x, y + 1, 'rail'); seg(pr.x + pr.w, y, pr.x + pr.w, y + 1, 'rail'); }
      }
    } else { seg(0, 0, LOT_W, 0); seg(0, 0, 0, LOT_D); seg(2, LOT_D, 3, LOT_D); seg(4, LOT_D, LOT_W, LOT_D); seg(LOT_W, 0, LOT_W, LOT_D); }
  }
  const footRect = (x, y, w, d, hgt) => ({ x0: iso(x, y + d).x, x1: iso(x + w, y).x, y0: iso(x, y).y - hgt * cam.z, y1: iso(x + w, y + d).y });

  // A crop seen from further away: three neat rows, green while growing, the crop's own colour when ripe.
  function cropRows(fl, x, y) {
    const st = cropStage(fl), col = st === 4 ? CROP_COL[fl.crop] || '#f2b33d' : ['#8cc95f', '#78bf52', '#62b048', '#55a240'][st];
    for (let r = 0; r < 3; r++) flatRect(x + 0.14, y + 0.18 + r * 0.27, 0.72, 0.15, col, null, 1 + st * 1.4);
  }
  // Houses away from the camera are drawn once into a picture (per zoom step and time of day) and reused:
  // they keep every detail but cost almost nothing to draw. Night window glows are kept with the picture.
  const HOUSE_SPR = new Map();
  function drawHouseCached(h, ox, oy) {
    const H = HOUSES[h.house], [fx, fy, w, d] = H.fp, ex = floorsOf(h) - H.floors[0];
    const zb = Math.round(Math.log(cam.z) / Math.log(1.15)), zq = Math.pow(1.15, zb), nb = NIGHT > 0.65 ? 2 : NIGHT > 0.25 ? 1 : 0;
    const key = `${h.house}|${h.wall}|${h.roof}|${ex}|${zb}|${nb}`;
    let s = HOUSE_SPR.get(key);
    if (!s) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), topPx = (HOUSE_H[H.id] || 120) + ex * 40 + 50;
      const wpx = (w + d + 2) * 32 * zq, hpx = ((w + d + 2) * 16 + topPx) * zq;
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(wpx * dpr)); c.height = Math.max(1, Math.ceil(hpx * dpr));
      const saved = [ctx, cam, GLOWS, NIGHT];
      ctx = c.getContext('2d'); ctx.scale(dpr, dpr); GLOWS = []; NIGHT = nb * 0.5;
      cam = { x: 0, y: 0, z: zq };
      const L = iso(fx - 1, fy + d + 1).x, T = iso(fx, fy).y - topPx * zq;
      cam.x = -L; cam.y = -T;
      let r = null;
      try { r = drawHouse(h, 0, 0, 0); } catch (e) { console.error(e); }
      const glows = GLOWS.slice();
      [ctx, cam, GLOWS, NIGHT] = saved;
      s = { c, w: wpx, h: hpx, ax: -L, ay: -T, glows, r: r || { x0: 0, x1: wpx, y0: 0, y1: hpx, top: 0 } };
      HOUSE_SPR.set(key, s);
      if (HOUSE_SPR.size > 300) HOUSE_SPR.delete(HOUSE_SPR.keys().next().value);
    }
    const o = iso(ox, oy), k = cam.z / zq, X = o.x - s.ax * k, Y = o.y - s.ay * k;
    ctx.drawImage(s.c, X, Y, s.w * k, s.h * k);
    if (NIGHT > 0.05) s.glows.forEach(g => GLOWS.push({ x: X + g.x * k, y: Y + g.y * k, r: g.r * k, a: g.a }));
    return { x0: X + s.r.x0 * k, x1: X + s.r.x1 * k, y0: Y + s.r.y0 * k, y1: Y + s.r.y1 * k, top: Y + s.r.top * k };
  }
  function lotObjects(h, ox, oy, objs, ts, dt, opt) {
    const z = cam.z, f = fine(), focus = opt.focus;
    const [fx, fy, hw, hd] = HOUSES[h.house].fp;
    if (far()) {   // seen from far away: the real house (pre-drawn), tidy crop rows, round fruit trees; no animals or people
      objs.push({ d: ox + oy + fx + fy + (hw + hd) / 2, f: () => { const r = drawHouseCached(h, ox, oy); opt.houseTop = { x: iso(ox + fx + hw / 2, oy + fy + hd / 2).x, y: r.top }; } });
      h.fields.forEach((fl, i) => { if (!fl) return; const [x, y] = fieldPos(i); objs.push({ d: ox + oy + x + y + 1, f: () => cropRows(fl, ox + x, oy + y) }); });
      h.trees.forEach((t, i) => {
        if (!t || i >= orchardSlots(h)) return;
        const [sx, sy] = ORCHARD_SLOTS[i];
        objs.push({ d: ox + oy + sx + sy + 1, f: () => { const c = iso(ox + sx + 0.5, oy + sy + 0.5); circle(c.x, c.y - 26 * z, 15 * z, '#5aa04a'); circle(c.x - 4 * z, c.y - 30 * z, 8 * z, '#7cbf5a'); } });
      });
      if (h.pondLv) objs.push({ d: ox + oy + AREA.pond.x + AREA.pond.y + 0.5, f: () => drawPond(ox + AREA.pond.x, oy + AREA.pond.y, AREA.pond.w, AREA.pond.d, 0, ts) });
      return;
    }
    objs.push({ d: ox + oy + fx + fy + (hw + hd) / 2, f: () => {
      const r = cam.z < 0.42 ? drawHouseCached(h, ox, oy) : drawHouse(h, ox, oy, ts);
      if (focus) hits.push({ kind: 'house', owner: h.id, ...r });
      opt.houseTop = { x: iso(ox + fx + hw / 2, oy + fy + hd / 2).x, y: r.top };
    } });
    const pr = pastureRect(h);
    if (pr) {
      const bx = pr.x + pr.w - 2;
      objs.push({ d: ox + oy + bx + pr.y + 2, f: () => drawBarn(ox + bx, oy + pr.y) });
      objs.push({ d: ox + oy + pr.x + 1.6 + pr.y + pr.d - 0.3, f: () => drawTrough(ox + pr.x + 1.05, oy + pr.y + pr.d - 0.55, ts) });
      objs.push({ d: ox + oy + pr.x + 0.7 + pr.y + 0.6, f: () => drawHay(ox + pr.x + 0.4, oy + pr.y + 0.4) });
    }
    fenceObjs(h, ox, oy, objs);
    // mailbox by the gate
    objs.push({ d: ox + oy + MAILBOX[0] + MAILBOX[1] + 1, f: () => {
      const r = drawMailbox(ox + MAILBOX[0], oy + MAILBOX[1], h.id === 'me' && unreadMail() > 0, ts);
      if (focus) hits.push({ kind: 'mailbox', owner: h.id, ...r });
    } });
    // crops
    h.fields.forEach((fl, i) => {
      if (!fl) return;
      const [x, y] = fieldPos(i);
      objs.push({ d: ox + oy + x + y + 1, f: () => {
        if (f) drawCropTile(ox + x, oy + y, fl, ts, i * 1.31 + ox);
        else cropRows(fl, ox + x, oy + y);
      } });
    });
    // orchard
    h.trees.forEach((t, i) => {
      if (!t || i >= orchardSlots(h)) return;
      const [sx, sy] = ORCHARD_SLOTS[i];
      objs.push({ d: ox + oy + sx + sy + 1, f: () => {
        const p = iso(ox + sx + 0.5, oy + sy + 0.5);
        drawFruitTree(t, p.x, p.y, z, ts, i * 2.1 + ox);
        if (focus) {
          hits.push({ kind: 'tree', owner: h.id, i, x0: p.x - 18 * z, x1: p.x + 18 * z, y0: p.y - 50 * z, y1: p.y + 6 * z });
          if (treeReady(t) && (opt.mine || isFriend(h.id))) opt.bubbles.push({ kind: 'tree', i, p: { x: p.x, y: p.y - 40 * z }, ch: opt.mine ? GOODS[TREES[t.k].fruit].e : '🖐️', ok: opt.mine || ((t.stolen || 0) < Math.floor(TREES[t.k].n / 2) && !(t.thieves || []).includes('me')) });
        }
      } });
    });
    // pond
    if (h.pondLv) {
      const P = AREA.pond;
      objs.push({ d: ox + oy + P.x + P.y + 0.5, f: () => {
        drawPond(ox + P.x, oy + P.y, P.w, P.d, fishCount(h), ts);
        if (focus) {
          hits.push({ kind: 'pond', owner: h.id, ...footRect(ox + P.x, oy + P.y, P.w, P.d, 6) });
          if (opt.mine && fishCount(h) >= 3) { const c = iso(ox + P.x + P.w / 2, oy + P.y + P.d / 2); opt.bubbles.push({ kind: 'pond', p: { x: c.x, y: c.y - 6 * z }, ch: '🎣', ok: true }); }
        }
      } });
    }
    // car
    if (h.car >= 0 && h.cars[h.car]) {
      const c = h.cars[h.car];
      objs.push({ d: ox + oy + 1 + 10.2, f: () => { const r = drawCar(c, ox + 0.5, oy + 9, ts); if (focus && r) hits.push({ kind: 'car', owner: h.id, ...r }); } });
    }
    // yard
    h.yard.forEach(it => {
      if (edit && edit.hold && edit.hold.id === it.id) return;
      const [w, d] = itemSize('yard', it);
      objs.push({ d: ox + oy + it.x + it.y + (w + d) / 2, f: () => {
        drawYardItem(it, ox + it.x, oy + it.y, ts);
        if (edit && edit.scope === 'yard' && opt.mine) hits.push({ kind: 'item', id: it.id, ...footRect(ox + it.x, oy + it.y, w, d, 40) });
        else if (focus && YARD[it.k].prod) {
          hits.push({ kind: 'yard', owner: h.id, id: it.id, ...footRect(ox + it.x, oy + it.y, w, d, 30) });
          if (opt.mine && yardReady(it)) { const c = iso(ox + it.x + 0.5, oy + it.y + 0.5); opt.bubbles.push({ kind: 'yard', id: it.id, p: { x: c.x, y: c.y - 30 * z }, ch: GOODS[YARD[it.k].prod].e, ok: true }); }
        }
      } });
    });
    // animals
    h.animals.forEach((a, k) => {
      const pet = ANIMALS[a.k].pet, id = h.id + ':' + a.id;
      const e = ent(id, () => {
        if (pet) return { x: 6 + Math.random() * 2, y: 11 + Math.random() };
        const r = pr || { x: 10, y: 2, w: 4, d: 4 };
        return { x: r.x + 0.5 + Math.random() * (r.w - 2.5), y: r.y + 2.3 + Math.random() * (r.d - 2.8) };
      });
      const st = animalStage(a);
      if (e.chase) {
        const [mx, my] = me.lot === h.id ? [me.x, me.y] : [e.x, e.y];
        e.path = Math.hypot(mx - e.x, my - e.y) > 0.8 ? [[mx, my]] : [];
        stepAlong(e, dt, 3.2);
        if (performance.now() > e.chase) e.chase = 0;
      } else wander(e, dt, SPEED[a.k] * (st === 0 ? 0.8 : 1), en => {
        if (pet) return randomWalk(en, lotNav(h), 5, LOT_D, true);
        if (!pr) return null;
        // one leg along x and one along y (never straight up or down the screen), around the barn, trough and hay
        const bad = (x, y) => (x > pr.x + pr.w - 2.3 && y < pr.y + 2.3) || (x > pr.x + 0.85 && x < pr.x + 2.15 && y > pr.y + pr.d - 1.15) || (x < pr.x + 1.15 && y < pr.y + 1.15);
        const clear = (a, b) => { for (let t = 0; t <= 1; t += 0.1) if (bad(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; return true; };
        for (let n = 0; n < 10; n++) {
          const x = pr.x + 0.4 + Math.random() * (pr.w - 0.8), y = pr.y + 0.4 + Math.random() * (pr.d - 0.8);
          if (bad(x, y) || Math.hypot(x - en.x, y - en.y) > 3) continue;
          for (const c of Math.random() < 0.5 ? [[x, en.y], [en.x, y]] : [[en.x, y], [x, en.y]]) if (clear([en.x, en.y], c) && clear(c, [x, y])) return [c, [x, y]];
        }
        return null;
      });
      objs.push({ d: ox + oy + e.x + e.y, f: () => {
        const p = iso(ox + e.x, oy + e.y);
        drawAnimal(a.k, st, p.x, p.y, z, { face: e.face, moving: e.moving, phase: e.phase, ts, seed: k * 1.7, breed: a.breed, mood: pet && h.id === 'me' ? petMood(a) : 'happy' });
        if (pet && h.id === 'me' && petAsks(a).length && !e.moving) emoji(PET_NEEDS[petAsks(a)[0]].e, p.x + 8 * z, p.y - 26 * z, 12 * z);
        if (focus) {
          hits.push({ kind: 'animal', owner: h.id, id: a.id, x0: p.x - 16 * z, x1: p.x + 16 * z, y0: p.y - 30 * z, y1: p.y + 6 * z });
          if (animalReady(a)) {
            const d = ANIMALS[a.k], baby = nextIsBaby(a);
            if (opt.mine) opt.bubbles.push({ kind: 'animal', id: a.id, p: { x: p.x, y: p.y - 26 * z }, ch: baby ? '🍼' : GOODS[d.prod].e, ok: true });
            else if (isFriend(h.id) && !baby && d.prod && (a.stolen || 0) < d.n - 1 && !(a.thieves || []).includes('me')) opt.bubbles.push({ kind: 'animal', id: a.id, p: { x: p.x, y: p.y - 26 * z }, ch: '🖐️', ok: true });
          }
        }
      } });
    });
    // the owner (friends wander; you are drawn separately); not while they're out walking in town
    if (h.id !== 'me' && !(mode === 'town' && walkerOut(h.id))) {
      const e = ent('p:' + h.id, () => ({ x: DOOR_X + 0.8, y: fy + hd + 1.2 }));
      const live = seesLive(h) ? h.live.type : null;
      e.pose = live ? doLive(e, live, h, dt, ts) : null;
      if (!live) { if (e.y >= LOT_D && !e.path.length) e.path = planPath(e, lotNav(h), 3.5, 12.5, 2) || []; wander(e, dt, speedOf(h), en => randomWalk(en, lotNav(h))); }
      objs.push({ d: ox + oy + e.x + e.y, f: () => {
        const p = iso(ox + e.x, oy + e.y);
        drawPerson(p.x, p.y, z, { look: h.look, face: e.face, back: e.back && !e.wave, view: e.wave > performance.now() ? null : e.view, moving: e.moving, phase: e.phase, energy: friendEnergy(h), ts, seed: ox * 0.1, pose: e.pose || undefined, wave: e.wave > performance.now() });
        if (live && f) liveBadge(p, h.live, false);
        if (focus) hits.push({ kind: 'avatar', owner: h.id, x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 44 * z, y1: p.y + 4 * z });
      } });
    }
    if (me.lot === h.id && !meInLake()) objs.push({ d: ox + oy + me.y + me.x, f: () => drawMe(ox, oy, ts, focus) });
  }
  function liveBadge(p, live, mine) {
    const z = cam.z, w = WORKOUTS[live.type];
    if (!w) return;
    const min = Math.max(0, Math.floor((now() - live.start) / MIN));
    const text = mine ? `${w.e} ${min}′${live.hr ? ` ❤️${live.hr}` : ''}` : w.e;
    pill(text, p.x, p.y - 52 * z, 'rgba(255,255,255,.95)', '#d24b2a', `bold ${Math.max(10, 12 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(16, 20 * z));
  }
  function mePose() {
    if (me.livePose) return me.livePose;
    if (me.act) return me.act.pose;
    if (me.moving) return me.sneak ? 'sneak' : me.fast ? 'run' : 'walk';
    return 'stand';
  }
  function drawMe(ox, oy, ts, focus) {
    const z = cam.z, p = iso(ox + me.x, oy + me.y), pose = mePose();
    drawPerson(p.x, p.y, z, { look: S.me.look, face: me.face, back: me.back && (me.moving || !!me.livePose), view: me.act ? null : me.view, moving: me.moving, phase: me.phase, energy: energyLevel(), ts, seed: 3, pose, wave: me.wave > performance.now() });
    if (S.live) liveBadge(p, S.live, true);
    if (focus) hits.push({ kind: 'avatar', owner: 'me', x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 44 * z, y1: p.y + 4 * z });
    if (mode === 'home' && !S.live && (me.jobs.length || me.cur)) {   // little marker on where you're heading
      const n = me.jobs.length + (me.cur ? 1 : 0);
      if (n > 1) pill(`×${n}`, p.x + 16 * z, p.y - 40 * z, 'rgba(76,175,106,.95)', '#fff', `bold 11px ${UI_FONT}`, 18);
    }
  }

  // ---------- the world ----------
  // Roads: street (2 wide, dashed centre line), avenue (3 wide, double yellow line), dirt (country road).
  function drawRoad(r, vr) {
    const [x0, y0, x1, y1, kind] = r, z = cam.z, horiz = x1 - x0 >= y1 - y0;
    if (x1 < vr.x0 || x0 > vr.x1 || y1 < vr.y0 || y0 > vr.y1) return;
    const R = (a, b, c, d, col) => (horiz ? flatRect(a, b, c, d, col) : flatRect(b, a, d, c, col));
    const [a0, a1, b0, b1] = horiz ? [x0, x1, y0, y1] : [y0, y1, x0, x1], w = b1 - b0;
    if (kind === 'dirt') { R(a0, b0, a1 - a0, w, '#c9ad80'); R(a0, b0 + 0.35, a1 - a0, w - 0.7, '#d6bf95'); return; }
    R(a0, b0, a1 - a0, w, '#d9d2c3');                                     // sidewalk edges
    R(a0, b0 + 0.14, a1 - a0, w - 0.28, kind === 'avenue' ? '#80878f' : '#8e959c');
    if (z < 0.1) return;
    const m = (b0 + b1) / 2, lo = Math.max(a0, Math.floor(horiz ? vr.x0 : vr.y0)), hi = Math.min(a1, horiz ? vr.x1 : vr.y1);
    const seg = (p, q, off, col, lw) => { const A = horiz ? iso(p, m + off) : iso(m + off, p), B = horiz ? iso(q, m + off) : iso(m + off, q); line(A.x, A.y, B.x, B.y, col, lw * z); };
    if (kind === 'avenue') { seg(lo, hi, -0.06, '#f2c230', 1.3); seg(lo, hi, 0.06, '#f2c230', 1.3); }
    else for (let p = Math.ceil(lo) + 0.3; p < hi; p += 1) seg(p, p + 0.45, 0, 'rgba(255,255,255,.85)', 1.6);
  }
  const inRectXY = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const inLake = (x, y) => ((x - LAKE.x) / (LAKE.rx + 1)) ** 2 + ((y - LAKE.y) / (LAKE.ry + 1)) ** 2 < 1;
  // Something built is here (no wild trees): streets and their lots, roads, the town centre, the park, the lake, the fields.
  function occupied(x, y) {
    for (const st of Object.values(STREETS)) if (inRectXY(x, y, st.x - 1, st.y - 1, st.x + st.n * PARCEL + 1, st.y + LOT_D + 1)) return true;
    for (const r of ROADS) if (inRectXY(x, y, r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1)) return true;
    const P = LANDMARKS.park, F = LANDMARKS.fields;
    if (inRectXY(x, y, RIVER.x - 1, WY0, RIVER.x + RIVER.w + 1, LAKE.y)) return true;
    if (inRectXY(x, y, 66, -3, 113, 31) || inRectXY(x, y, P.x - 1, P.y - 1, P.x + P.w + 1, P.y + P.d + 1) || inRectXY(x, y, F.x - 1, F.y - 1, F.x + F.w + 1, F.y + F.d + 1)) return true;
    return ((x - LAKE.x) / (LAKE.rx + 3)) ** 2 + ((y - LAKE.y) / (LAKE.ry + 3)) ** 2 < 1;
  }
  // Wild trees, rocks and bushes: thick woods around the town, a few trees on the open grass inside it. Computed once.
  let SCENERY = null;
  function scenery() {
    if (SCENERY) return SCENERY;
    SCENERY = [];
    for (let j = WY0; j < WY1; j++) for (let i = WX0; i < WX1; i++) {
      if (occupied(i, j)) continue;
      const inside = inRectXY(i, j, WORLD.x0, WORLD.y0, WORLD.x1, WORLD.y1);
      const edge = Math.min(Math.abs(i - WORLD.x0), Math.abs(i - WORLD.x1), Math.abs(j - WORLD.y0), Math.abs(j - WORLD.y1));
      const v = hash(i * 1.37 + 0.2, j * 2.11 + 0.7), dens = inside ? 0.14 : edge < 1.5 ? 0.12 : 0.42;
      if (v > dens + 0.08) continue;
      SCENERY.push({ x: i + 0.3 + hash(i, j * 3) * 0.4, y: j + 0.3 + hash(i * 3, j) * 0.4, w: hash(i + 7, j + 3), tree: v < dens });
    }
    return SCENERY;
  }
  function woods(objs, vr, ts) {
    const z = cam.z, lod = z < 0.22, thin = z < 0.09;
    for (const s of scenery()) {
      if (s.x < vr.x0 || s.x > vr.x1 || s.y < vr.y0 || s.y > vr.y1) continue;
      if (!s.tree) { if (!lod) objs.push({ d: s.x + s.y, f: s.w < 0.5 ? () => drawRock(s.x, s.y, s.w) : () => drawBushWild(s.x, s.y, s.w) }); continue; }
      if (thin && s.w > 0.6) continue;
      // from far away: round canopies with a light top, so the woods read as a forest, not dots
      objs.push({ d: s.x + s.y, f: lod ? () => {
        const c = iso(s.x, s.y), r = (thin ? 22 : 15) * z, L = PAL.leaf, pine = s.w < 0.45 && PAL.tree === 'round';
        circle(c.x, c.y - r * 1.3, r, pine ? '#2f8050' : L[0]); circle(c.x - r * 0.3, c.y - r * 1.6, r * 0.62, pine ? '#4a9d63' : PAL.snow ? '#f4f8fa' : L[1]);
      } : () => drawWildTree(s.x, s.y, s.w, ts) });
    }
  }
  // Mountains behind the woods (north and west) so the edge of the world looks like a valley, not a blank.
  let PEAKS = null;
  function peaks() {
    if (PEAKS) return PEAKS;
    PEAKS = [];
    for (let x = WX0 - 6; x < WX1 + 10; x += 15) PEAKS.push({ x: x + hash(x, 1) * 6, y: WY0 - 6 + hash(x, 2) * 5, r: 9 + hash(x, 3) * 6, h: 150 + hash(x, 4) * 140 });
    for (let y = WY0 + 8; y < WY1 + 6; y += 15) PEAKS.push({ x: WX0 - 6 + hash(y, 5) * 5, y: y + hash(y, 6) * 6, r: 9 + hash(y, 7) * 6, h: 150 + hash(y, 8) * 140 });
    return PEAKS;
  }
  function mountains(objs, vr) {
    peaks().forEach(m => {
      if (m.x < vr.x0 - 20 || m.x > vr.x1 + 20 || m.y < vr.y0 - 20 || m.y > vr.y1 + 20) return;
      objs.push({ d: m.x + m.y - 30, f: () => {
        const z = cam.z, c = iso(m.x, m.y), hw = m.r * 34 * z, H = m.h * z, top = { x: c.x + hw * 0.08, y: c.y - H };
        poly([{ x: c.x - hw, y: c.y }, top, { x: c.x + hw * 0.08, y: c.y + hw * 0.12 }], '#8e9c86');
        poly([{ x: c.x + hw * 0.08, y: c.y + hw * 0.12 }, top, { x: c.x + hw, y: c.y }], '#6d7a67');
        const sn = 0.3, a = lerp(top, { x: c.x - hw, y: c.y }, sn), b = lerp(top, { x: c.x + hw, y: c.y }, sn);
        poly([a, top, b, { x: (top.x + b.x) / 2, y: b.y - H * 0.04 }, { x: top.x, y: a.y + H * 0.05 }, { x: (top.x + a.x) / 2, y: a.y - H * 0.05 }], '#f4f6f8');
        ellipse(c.x, c.y, hw * 1.05, hw * 0.28, 'rgba(60,110,60,.35)');
      } });
    });
  }
  // A river from the mountains down into Mirror Lake (the avenue crosses it on a bridge).
  const RIVER = { x: 176, w: 2.4 };
  function river(vr) {
    if (RIVER.x > vr.x1 + 2 || RIVER.x + RIVER.w < vr.x0 - 2) return;
    flatRect(RIVER.x - 0.4, WY0, RIVER.w + 0.8, LAKE.y - WY0, '#c9b88f');
    flatRect(RIVER.x, WY0, RIVER.w, LAKE.y - WY0, '#5aa7d6');
    if (cam.z > 0.12) for (let y = Math.max(WY0, Math.floor(vr.y0)); y < Math.min(LAKE.y, vr.y1); y += 3) { const a = iso(RIVER.x + 0.6, y + (performance.now() / 900) % 3), b = iso(RIVER.x + 0.6, y + 0.8 + (performance.now() / 900) % 3); line(a.x, a.y, b.x, b.y, 'rgba(255,255,255,.5)', 1.2 * cam.z); }
  }
  const boxVisible = (x0, y0, x1, y1, vr) => !(x1 < vr.x0 || x0 > vr.x1 || y1 < vr.y0 || y0 > vr.y1);
  // Town centre: paved square, the town hall plaza, shops along the avenue.
  function townCentre(objs, vr, ts, lv, out) {
    if (!boxVisible(66, -3, 113, 31, vr)) return;
    flatRect(66.5, -2, 46, 32, '#e8e0cf');
    if (cam.z > 0.14) for (let k = 0; k < 9; k++) flatRect(67 + k * 5, -2, 0.08, 32, 'rgba(160,140,110,.12)');
    const { x: px, y: py } = LANDMARKS.plaza;
    plazaGround(px, py);
    objs.push({ d: px + py + 10, f: () => { out.hall = drawTownHall(px, py, lv, ts); } });
    if (lv >= 2) objs.push({ d: px + py + 6 + 8 + 2, f: () => drawYardItem({ k: 'fountain' }, px + 6, py + 7, ts) });
    const deco = [['tree', 1, 8], ['tree', 12, 8], ['pine', 1, 1], ['pine', 12, 1], ['bench', 4, 11], ['bench', 10, 11], ['lamp', 2, 12], ['lamp', 13, 12]];
    if (lv >= 3) deco.push(['flowers', 3, 7], ['flowers', 10, 7], ['lamp', 5, 10], ['lamp', 9, 10]);
    if (lv >= 5) deco.push(['flowers', 2, 10], ['flowers', 11, 10], ['tree', 6, 13], ['tree', 8, 13]);
    deco.forEach(([k, x, y]) => objs.push({ d: px + py + x + y + 1, f: () => drawYardItem({ k }, px + x, py + y, ts) }));
    LANDMARKS.shops.forEach(([k, x, y]) => objs.push({ d: x + y + 5.5, f: () => { const r = drawShop(k, x, y, ts); if (!edit) hits.push({ kind: 'shop', k, pri: 1, ...r }); } }));
    [[68, 28], [74, 28], [81, 28], [97, 28], [104, 28], [110, 28], [68, 12], [110, 12]].forEach(([x, y]) => objs.push({ d: x + y + 1, f: () => drawYardItem({ k: 'tree' }, x, y, ts) }));
  }
  // The park: lawns, crossing paths, a duck pond, a sports field, a playground, trees and benches.
  function park(objs, vr, ts) {
    const P = LANDMARKS.park;
    if (!boxVisible(P.x, P.y, P.x + P.w, P.y + P.d, vr)) return;
    flatRect(P.x, P.y, P.w, P.d, '#9bd176');
    flatRect(P.x, P.y + 14, P.w, 1.4, '#e6dccb'); flatRect(P.x + 20, P.y, 1.4, P.d, '#e6dccb');
    drawPond(P.x + 4, P.y + 3, 10, 7, 6, ts);
    const f = { x: P.x + 25, y: P.y + 18, w: 16, d: 10 };
    flatRect(f.x, f.y, f.w, f.d, '#76bb54');
    for (let k = 0; k < 8; k++) if (k % 2) flatRect(f.x + k * 2, f.y, 2, f.d, 'rgba(255,255,255,.08)');
    flatRect(f.x + 0.4, f.y + 0.4, f.w - 0.8, f.d - 0.8, null, 'rgba(255,255,255,.9)', 0, 1.6 * cam.z);
    flatRect(f.x + f.w / 2 - 0.04, f.y + 0.4, 0.08, f.d - 0.8, 'rgba(255,255,255,.9)');
    const items = [['slide', P.x + 25, P.y + 4], ['swing', P.x + 29, P.y + 4], ['trampoline', P.x + 33, P.y + 4], ['bench', P.x + 16, P.y + 12], ['bench', P.x + 23, P.y + 12],
      ['bench', P.x + 8, P.y + 16], ['lamp', P.x + 19, P.y + 13], ['lamp', P.x + 22, P.y + 16], ['flowers', P.x + 15, P.y + 4], ['flowers', P.x + 16, P.y + 4], ['picnic', P.x + 6, P.y + 20], ['picnic', P.x + 11, P.y + 22]];
    for (let k = 0; k < 16; k++) items.push([k % 3 ? 'tree' : 'pine', P.x + 1 + (k * 7.3) % (P.w - 2), P.y + (k < 8 ? 0.4 : P.d - 1.4)]);
    [[P.x + 3, P.y + 24], [P.x + 9, P.y + 26], [P.x + 15, P.y + 25], [P.x + 2, P.y + 17]].forEach(([x, y]) => items.push(['tree', x, y]));
    items.forEach(([k, x, y]) => objs.push({ d: x + y + 1, f: () => drawYardItem({ k, rot: 0, placed: 0 }, x, y, ts) }));
  }
  // The big lake, with a wooden dock and a little boat.
  function lakeSide(objs, vr, ts) {
    if (!boxVisible(LAKE.x - LAKE.rx - 2, LAKE.y - LAKE.ry - 2, LAKE.x + LAKE.rx + 2, LAKE.y + LAKE.ry + 2, vr)) return;
    drawLake(LAKE.x, LAKE.y, LAKE.rx, LAKE.ry, ts);
    const dx = LAKE.x - 6, dy = LAKE.y - LAKE.ry - 0.6;
    objs.push({ d: dx + dy + 3, f: () => { box(dx, dy, 1.4, 5, 2, '#a5774c', 0); for (let k = 0; k < 5; k++) flatRect(dx, dy + k + 0.95, 1.4, 0.05, 'rgba(60,40,20,.35)', null, 2); } });
    const bob = Math.sin(ts / 900) * 1.2, bx = LAKE.x + 4, by = LAKE.y - 3;
    objs.push({ d: bx + by, f: () => { const c = iso(bx, by), z = cam.z; ellipse(c.x, c.y + 2 * z, 22 * z, 7 * z, 'rgba(0,40,80,.15)'); pg([[c.x - 20 * z, c.y - 4 * z + bob * z], [c.x + 20 * z, c.y - 4 * z + bob * z], [c.x + 13 * z, c.y + 4 * z + bob * z], [c.x - 13 * z, c.y + 4 * z + bob * z]], '#c0453a'); line(c.x, c.y - 4 * z + bob * z, c.x, c.y - 30 * z + bob * z, '#8a5a36', 1.4 * z); pg([[c.x + 1 * z, c.y - 29 * z + bob * z], [c.x + 15 * z, c.y - 8 * z + bob * z], [c.x + 1 * z, c.y - 8 * z + bob * z]], '#fffaf0'); } });
  }
  // Farmland south of town: big striped crop fields, barns and a windmill.
  const FIELD_COLS = ['#e9c46a', '#8ab85a', '#c98a4b', '#b5d36b', '#f0d48a', '#7fae4f'];
  function farmland(objs, vr, ts) {
    const F = LANDMARKS.fields;
    if (!boxVisible(F.x, F.y, F.x + F.w, F.y + F.d, vr)) return;
    flatRect(F.x, F.y, F.w, F.d, '#b9d88a');
    for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) {
      const x = F.x + 0.5 + i * 9.5, y = F.y + 0.5 + j * 9, col = FIELD_COLS[(i * 3 + j * 5) % FIELD_COLS.length];
      if (!boxVisible(x, y, x + 8.5, y + 8, vr)) continue;
      flatRect(x, y, 8.5, 8, '#9a6a44');
      if (cam.z > 0.08) for (let k = 0; k < 8; k++) flatRect(x + 0.3, y + 0.35 + k, 7.9, 0.55, col); else flatRect(x + 0.2, y + 0.2, 8.1, 7.6, col);
    }
    [[F.x + 30, F.y + 8.2], [F.x + 76, F.y + 8.2]].forEach(([x, y]) => objs.push({ d: x + y + 2, f: () => drawBarn(x, y) }));
    [[F.x + 52, F.y + 8.4], [F.x + 98, F.y + 8.4]].forEach(([x, y]) => objs.push({ d: x + y + 1, f: () => drawYardItem({ k: 'windmill', placed: 0 }, x, y, ts) }));
  }

  function renderWorld(ts, dt) {
    if (mode === 'home') return renderHome(ts, dt);
    const z = cam.z, vr = viewRect(), focusId = null, themed = PAL !== TOWN_THEMES.maple;
    // ground: the country around town, woods, the town, neighbourhood lawns, roads, landmarks
    outskirts(vr, ts);
    flatRect(WX0, WY0, WX1 - WX0, WY1 - WY0, PAL.woods);
    flatRect(WORLD.x0, WORLD.y0, WORLD.x1 - WORLD.x0, WORLD.y1 - WORLD.y0, PAL.town);
    Object.values(STREETS).forEach(st => { if (boxVisible(st.x - 1, st.y - 1, st.x + st.n * PARCEL + 1, st.y + LOT_D + 1, vr)) flatRect(st.x - 0.6, st.y - 0.6, st.n * PARCEL + 1.2, LOT_D + 0.6, themed ? shade(PAL.town, st.nb === 'lake' ? -0.04 : st.nb === 'farm' ? 0.04 : 0) : NEIGHBORHOODS[st.nb].grass); });
    const objs = [], tops = [], out = { hall: null, shops: mode === 'town' ? [] : null }, lv = townLevel(rankTotal());
    river(vr);
    mountains(objs, vr);
    lakeSide(objs, vr, ts);
    park(objs, vr, ts);
    farmland(objs, vr, ts);
    ROADS.forEach(r => drawRoad(r, vr));
    townCentre(objs, vr, ts, lv, out);
    woods(objs, vr, ts);
    // land for sale: light grass with a dashed outline and a sign
    const runs = vacantRuns();
    runs.forEach(r => {
      const st = STREETS[r.st], x = st.x + r.p * PARCEL, y = st.y, w = r.n * PARCEL;
      if (!boxVisible(x, y, x + w, y + LOT_D, vr)) return;
      flatRect(x, y, w, LOT_D, PAL.vacant);
      if (z > 0.12) { ctx.save(); ctx.setLineDash([8 * z, 6 * z]); flatRect(x + 0.3, y + 0.3, w - 0.6, LOT_D - 0.6, null, 'rgba(255,255,255,.85)', 0, 2 * z); ctx.restore(); }
      const c = iso(x + w / 2, y + LOT_D / 2);
      if (z > 0.1) objs.push({ d: x + y + w / 2 + LOT_D / 2, f: () => {
        line(c.x, c.y, c.x, c.y - 34 * z, '#8a5a36', 3 * z);
        rrect(c.x - 26 * z, c.y - 56 * z, 52 * z, 24 * z, 5 * z, '#fff6e2', '#c9893a', 1.6 * z);
        ctx.fillStyle = '#b5641e'; ctx.font = `bold ${13 * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t('for_sale'), c.x, c.y - 44 * z);
      } });
      tops.push({ land: r, x: c.x, y: c.y - 62 * z });
    });
    // homes: yours, your friends', and everybody else in town
    allLots().forEach(l => {
      const h = homeOf(l.id);
      if (!h) return;
      const [ox, oy] = origin(l.id);
      if (!lotVisible(ox, oy, l.n * PARCEL + 1)) return;
      const focus = l.id === focusId, opt = { focus, mine: l.id === 'me', bubbles: [] };
      lotGround(h, ox, oy, opt);
      lotObjects(h, ox, oy, objs, ts, dt, opt);
      tops.push({ h, opt, ox, oy, npc: !!h.npc });
    });
    // you, when swimming in the lake
    if (meInLake()) { const [ox, oy] = origin(me.lot); objs.push({ d: ox + oy + me.x + me.y, f: () => drawMe(ox, oy, ts, false) }); }
    // people who are online right now, out walking: to the square, the park, the lake, and home again
    if (z > 0.055) walkers(objs, dt, ts);
    if (edit && edit.scope === 'yard') { const [ox, oy] = origin('me'); yardSpots(homeW(S.me)).forEach(([x, y]) => tile(ox + x, oy + y, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.55)')); }
    weatherGround(ts);
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    weatherSky(ts, dt);
    nightTint();
    if (attract || S.onboarding) return;   // first screens: just the living street, no labels
    // overlays
    const bob = Math.abs(Math.sin(ts / 380)) * 4;
    if (edit && edit.scope === 'yard') { editOverlay(ts); return; }
    if (mode === 'town') {
      const rk = ranking();
      // label sizes follow the zoom, so zoomed far out the names don't cover the town
      const fs = Math.round(clamp(7 + z * 40, 9, 13)), small = Math.round(clamp(6 + z * 30, 8.5, 11));
      if (z < 0.17) AREA_LABELS.forEach(([key, x, y]) => { const c = iso(x, y); pill(key === 'area_maple' && VIEW_TOWN !== HOME_TOWN ? nm(COMMUNITIES[VIEW_TOWN]) : t(key), c.x, c.y, 'rgba(59,49,37,.78)', '#fff', `800 ${fs}px ${UI_FONT},${EMOJI_FONT}`, fs + 9); });
      // zoomed all the way out: the neighbouring villages, and a way on to the world map
      if (z < 0.1) {
        [[WX1 + 40, (WY0 + WY1) / 2 - 20, 'out_east'], [(WX0 + WX1) / 2 + 30, WY1 + 40, 'out_south'], [WX0 - 34, WY1 + 34, 'out_west']].forEach(([x, y, key]) => { const c = iso(x, y); pill(t(key), c.x, c.y, 'rgba(255,255,255,.82)', '#5d5448', `700 ${small}px ${UI_FONT},${EMOJI_FONT}`, small + 8); });
        if (z <= minWorldZoom() * 1.02) hits.push({ kind: 'worldMap', pri: 2, ...pill(t('pinch_world'), W / 2, H - 70, 'rgba(59,49,37,.86)', '#fff', `800 13px ${UI_FONT},${EMOJI_FONT}`, 30) });
      }
      tops.forEach(tp => {
        if (tp.land) { if (z > 0.11 && tp.land.n >= CORE_PARCELS) hits.push({ kind: 'land', st: tp.land.st, p: tp.land.p, n: tp.land.n, pri: 1, ...pill(`🏷️ ${t('land_lot', { n: tp.land.n * PARCEL })}`, tp.x, tp.y, 'rgba(255,246,226,.95)', '#a9773f', `700 ${small}px ${UI_FONT},${EMOJI_FONT}`, small + 8) }); return; }
        const top = tp.opt.houseTop;
        if (!top) return;
        if (tp.npc) { if (z > 0.11) hits.push({ kind: 'lot', owner: tp.h.id, pri: 1, ...pill(homeName(tp.h), top.x, top.y - 4, 'rgba(255,255,255,.78)', '#6b5f50', `600 ${small}px ${UI_FONT}`, small + 8) }); return; }
        if (z < 0.08 && tp.h.id !== 'me') return;
        const i = rk.findIndex(r => r.h.id === tp.h.id), medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`, mine = tp.h.id === 'me';
        const label = S.calm ? homeName(tp.h) : `${medal} ${homeName(tp.h)} · ${fmtCompact(rk[i].v)}`;   // calm mode: names only
        hits.push({ kind: 'lot', owner: tp.h.id, pri: 1, ...pill(label, top.x, top.y - 4, mine ? '#3b3125' : 'rgba(255,255,255,.95)', mine ? '#fff' : '#3b3125', `700 ${small}px ${UI_FONT},${EMOJI_FONT}`, small + 9) });
      });
      if (out.hall) { const { x: px, y: py } = LANDMARKS.plaza; hits.push({ kind: 'plaza', pri: 1, ...pill(VIEW_TOWN === HOME_TOWN ? `🏛️ ${t('street_name')} Lv${lv}` : `🏛️ ${nm(COMMUNITIES[VIEW_TOWN])}`, iso(px + 7, py + 3).x, out.hall.top - 6, '#ef7d3c', '#fff', `bold 12px ${UI_FONT},${EMOJI_FONT}`, 22) }); }
      return;
    }
  }
  // ---------- home: just this one home, big and close up (v0.9) ----------
  // Tapping any home (yours or someone else's) shows only that home: its lot, the road in front and (yours) the
  // parcel for sale next door. The lawn runs to the edges of the screen; nothing else is drawn, so there's room
  // for more detail than in the town (grass, flowers, stepping stones).
  function islandRect(id) {
    const h = homeOf(id), [ox, oy] = origin(id), extra = id === 'me' && h && canExpand() ? PARCEL : 0;
    return { ox, oy, x0: ox - 0.6, y0: oy - 0.6, x1: ox + (h ? homeW(h) : LOT_W) + 1 + extra + 0.3, y1: oy + GH + 0.2, extra };
  }
  function renderHome(ts, dt) {
    const h = homeOf(owner);
    if (!h) return;
    const z = cam.z, R = islandRect(owner), ox = R.ox, oy = R.oy, mine = owner === 'me', vr = viewRect();
    // lawn everywhere on screen, a little darker away from the home
    ctx.fillStyle = shade(PAL.town, -0.04); ctx.fillRect(0, 0, W, H);
    flatRect(R.x0 - 6, R.y0 - 6, R.x1 - R.x0 + 12, R.y1 - R.y0 + 12, shade(PAL.town, -0.02));
    flatRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0, PAL.town);
    if (PAL.snow) { ctx.fillStyle = 'rgba(250,252,255,.45)'; ctx.fillRect(0, 0, W, H); }
    // the road in front runs off both sides of the screen
    const ry = oy + LOT_D, rx0 = Math.min(vr.x0, R.x0) - 4, rx1 = Math.max(vr.x1, R.x1) + 4;
    flatRect(rx0, ry + 0.1, rx1 - rx0, 1.9, '#d9d2c3');
    flatRect(rx0, ry + 0.3, rx1 - rx0, 1.5, '#8e959c');
    if (z > 0.1) for (let x = Math.ceil(rx0) + 0.3; x < rx1; x += 1) { const a = iso(x, ry + 1.05), b = iso(x + 0.45, ry + 1.05); line(a.x, a.y, b.x, b.y, 'rgba(255,255,255,.85)', 1.6 * z); }
    if (R.extra) {
      const sx = ox + homeW(h) + 1;
      flatRect(sx, oy, PARCEL - 0.2, LOT_D, PAL.vacant);
      ctx.save(); ctx.setLineDash([8 * z, 6 * z]); flatRect(sx + 0.3, oy + 0.3, PARCEL - 0.8, LOT_D - 0.6, null, 'rgba(255,255,255,.85)', 0, 2 * z); ctx.restore();
    }
    const objs = [], opt = { focus: true, mine, bubbles: [] };
    lotGround(h, ox, oy, opt);
    // close-up detail: tufts of grass, little flowers and clover across the lawn (not on paths, fields or buildings)
    if (z > 0.5) {
      const LW = homeW(h), FL = ['#f6d04d', '#ffffff', '#ef8fb0', '#b39ae0'];
      for (let k = 0; k < 60 + LW * 3; k++) {
        const x = hash(k, ox + 41) * LW, y = hash(k, oy + 43) * LOT_D;
        if (yardReserved(Math.floor(x), Math.floor(y), LW)) continue;
        const c = iso(ox + x, oy + y), v = hash(k, 47);
        if (v < 0.55) { for (const dx of [-2, 0, 2]) line(c.x + dx * z, c.y, c.x + dx * 1.6 * z, c.y - (4 + v * 4) * z, shade(PAL.town, -0.18), 0.9 * z); }
        else if (v < 0.8) { circle(c.x, c.y - 1.5 * z, 1.6 * z, FL[k % FL.length]); circle(c.x, c.y - 1.5 * z, 0.6 * z, '#f2a33a'); line(c.x, c.y, c.x, c.y - 1.5 * z, '#5a9a3e', 0.6 * z); }
        else ellipse(c.x, c.y, 3 * z, 1.4 * z, shade(PAL.town, -0.1));
      }
    }
    lotObjects(h, ox, oy, objs, ts, dt, opt);
    // swimming with no pond or pool: an inflatable pool in the front yard
    if ((mine ? S.live : seesLive(h) && h.live) && (mine ? S.live.type : h.live.type) === 'swim' && liveSpot('swim', h).swim === 'tub') objs.push({ d: ox + oy + TUB.x + TUB.y - 0.6, f: () => drawTub(ox + TUB.x, oy + TUB.y, ts) });
    if (edit && edit.scope === 'yard') yardSpots(homeW(S.me)).forEach(([x, y]) => tile(ox + x, oy + y, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.55)'));
    const w = weatherNow().kind;
    if (w === 'snow') { ctx.fillStyle = 'rgba(250,252,255,.35)'; ctx.fillRect(0, 0, W, H); }
    else if (w === 'rain' || w === 'storm') { ctx.fillStyle = 'rgba(40,70,110,.08)'; ctx.fillRect(0, 0, W, H); }
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    // a soft frame so your eye goes to the home
    const g = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H * 0.48, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(30,40,20,0)'); g.addColorStop(1, 'rgba(30,40,20,.22)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    weatherSky(ts, dt);
    nightTint();
    if (viewFade) { const k = 1 - (performance.now() - viewFade) / 380; if (k > 0) { ctx.fillStyle = `rgba(255,255,255,${k * 0.9})`; ctx.fillRect(0, 0, W, H); } else viewFade = 0; }
    if (attract || S.onboarding) return;
    if (edit && edit.scope === 'yard') { editOverlay(ts); return; }
    const bob = Math.abs(Math.sin(ts / 380)) * 4;
    homeOverlays({ h, opt, ox, oy }, ts, bob);
  }
  function homeOverlays(tp, ts, bob) {
    const z = cam.z, h = tp.h, [ox, oy] = [tp.ox, tp.oy], mine = owner === 'me';
    tp.opt.bubbles.forEach(b => hits.push({ kind: 'bubble', what: b.kind, owner, id: b.id, i: b.i, pri: 2, ...bubble(b.ch, b.p.x, b.p.y, 1, bob) }));
    if (mine) {
      h.fields.forEach((fl, i) => {
        if (!isRipe(fl)) return;
        const [x, y] = fieldPos(i), c = iso(ox + x + 0.5, oy + y + 0.5);
        if (Math.sin(ts / 500 + i) > 0.2) emoji('✨', c.x + 12 * z, c.y - 22 * z, 12 * z);
      });
      const tag = (kind, text, wx, wy) => { const c = iso(ox + wx, oy + wy); hits.push({ kind, pri: 1, ...pill(text, c.x, c.y + 4, 'rgba(255,255,255,.92)', '#7a5a2a', `600 11px ${UI_FONT},${EMOJI_FONT}`, 20) }); };
      if (fine()) {
        if (h.fieldLv < FIELD_LEVELS.length - 1) tag('buyLand', `🔓 ${t('expand_field')}`, AREA.fields.x + 2, AREA.fields.y + h.fields.length / 4 + 0.5);
        if (!h.pastureLv) tag('buyLand', `🐄 ${t('build_pasture')}`, AREA.pasture.x + 2, AREA.pasture.y + 4);
        if (!h.orchardLv) tag('buyLand', `🌳 ${t('build_orchard')}`, AREA.orchard.x + 3, AREA.orchard.y + 1.5);
        if (!h.pondLv) tag('buyLand', `🐟 ${t('build_pond')}`, AREA.pond.x + 2, AREA.pond.y + 1.5);
        if (canExpand()) { const c = iso(ox + homeW(h) + PARCEL / 2, oy + LOT_D / 2); hits.push({ kind: 'buyParcel', pri: 2, ...pill(`🏷️ ${t('buy_parcel')} · 🪙${fmtNum(parcelCost().coins)}`, c.x, c.y - 40 * z, '#fff6e2', '#b5641e', `800 12px ${UI_FONT},${EMOJI_FONT}`, 24) }); }
      }
      if (S.pending.length && tp.opt.houseTop) hits.push({ kind: 'pending', pri: 3, ...pill(`📦 ${S.pending.length}`, tp.opt.houseTop.x, tp.opt.houseTop.y - 6 - bob, '#ef7d3c', '#fff', `bold 14px ${UI_FONT},${EMOJI_FONT}`) });
    } else {
      if (isFriend(h.id)) h.fields.forEach((fl, i) => {
        if (!stealable(h, i)) return;
        const [x, y] = fieldPos(i), c = iso(ox + x + 0.5, oy + y + 0.5);
        hits.push({ kind: 'bubble', what: 'field', owner, i, pri: 2, ...bubble('🖐️', c.x, c.y - 18 * z, 0.9, bob) });
      });
      if (tp.opt.houseTop) pill(t('home_of', { name: homeName(h) }), tp.opt.houseTop.x, tp.opt.houseTop.y - 6, 'rgba(255,255,255,.94)', '#3b3125', `600 12px ${UI_FONT}`);
    }
  }
  // ---------- people out walking (v0.9) ----------
  // A virtual world: residents who are online leave their gate and walk the streets to somewhere (the town square,
  // the park, the lake, a shop, a friend's gate), stay a while, and walk home. Simulated until the server exists;
  // then these are real players. Roads: horizontal streets joined by two avenues (x 65.5 and x 113.5).
  const HROADS = [{ y: 15, x0: -1, x1: 63, av: [65.5] }, { y: 15, x0: 116, x1: 171, av: [113.5] }, { y: 31.5, x0: -16, x1: 194, av: [65.5, 113.5] },
    { y: 51, x0: -1, x1: 63, av: [65.5] }, { y: 67, x0: -16, x1: 111, av: [65.5] }];
  const AV_Y = { 65.5: [-1, 69], 113.5: [-1, 35] };
  const roadOf = (x, y) => HROADS.reduce((b, r) => (x >= r.x0 - 3 && x <= r.x1 + 3 && Math.abs(r.y - y) < Math.abs(b.y - y) ? r : b), HROADS[2]);
  const gateOf = id => { const l = lotOf(id), [ox, oy] = origin(id); return [ox + 3.5, oy + LOT_D + (STREETS[l.st].y === 16 ? 1.5 : 1)]; };
  const PLACES = [[89, 16.5], [90, 31.5], [128, 31.5], [72, 27], [102, 27], [40, 31.5], [150, 31.5]];
  // A route along the roads from a to b: along a's road to an avenue (or the big avenue), across, along b's road.
  function route(a, b) {
    const ra = roadOf(a[0], a[1]), rb = roadOf(b[0], b[1]), pts = [[a[0], ra.y]];
    if (ra !== rb) {
      const av = ra.av.find(x => rb.av.includes(x));
      if (av !== undefined) pts.push([av, ra.y], [av, rb.y]);
      else { const mid = HROADS[2], a1 = ra.av[0], a2 = rb.av[0]; pts.push([a1, ra.y], [a1, mid.y], [a2, mid.y], [a2, rb.y]); }
    }
    pts.push([b[0], rb.y], b);
    return pts;
  }
  let WALK = { town: null, list: [], next: 0 };
  const walkerOut = id => WALK.town === VIEW_TOWN && WALK.list.some(w => w.id === id);
  function walkers(objs, dt, ts) {
    if (WALK.town !== VIEW_TOWN) WALK = { town: VIEW_TOWN, list: [], next: 0 };
    const now2 = performance.now(), z = cam.z;
    // someone new heads out every few seconds, up to 8 at a time
    if (now2 > WALK.next && WALK.list.length < 8) {
      WALK.next = now2 + 2500 + Math.random() * 4000;
      const ids = allLots().map(l => l.id).filter(id => id !== 'me' && !WALK.list.some(w => w.id === id) && homeOf(id));
      if (ids.length) {
        const id = ids[Math.floor(Math.random() * ids.length)], g = gateOf(id);
        const others = allLots().filter(l => l.id !== id && homeOf(l.id)), dest = Math.random() < 0.3 && others.length ? gateOf(others[Math.floor(Math.random() * others.length)].id) : PLACES[Math.floor(Math.random() * PLACES.length)];
        WALK.list.push({ id, h: homeOf(id), x: g[0], y: g[1] - 1.2, path: [[g[0], g[1]], ...route(g, dest)], home: g, phase: 0, face: 1, moving: true, stay: 0, back: false, alpha: 0 });
      }
    }
    WALK.list = WALK.list.filter(w => {
      if (w.stay > 0) { w.stay -= dt; w.moving = false; if (w.stay <= 0) { w.path = route([w.x, w.y], w.home).concat([[w.home[0], w.home[1] - 1.2]]); w.going = true; } }
      else if (w.path.length) {
        const [tx, ty] = w.path[0], dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy), st = 1.6 * dt;
        if (d <= st) { w.x = tx; w.y = ty; w.path.shift(); } else { w.x += dx / d * st; w.y += dy / d * st; }
        faceTo(w, dx, dy); w.phase += dt * 9.5; w.moving = true;
        if (!w.path.length) { if (w.going) return false; w.stay = 6 + Math.random() * 10; }
      }
      w.alpha = Math.min(1, w.alpha + dt * 2);
      objs.push({ d: w.x + w.y, f: () => {
        const p = iso(w.x, w.y);
        ctx.save(); ctx.globalAlpha = w.alpha;
        drawPerson(p.x, p.y, z, { look: w.h.look, face: w.face, back: w.back && w.moving, view: w.moving ? w.view : null, moving: w.moving, phase: w.phase, energy: 'good', ts, seed: w.x, wave: !w.moving && Math.sin(ts / 900 + w.x) > 0.7 });
        ctx.restore();
        if (z > 0.3) pill(`● ${homeName(w.h)}`, p.x, p.y - 50 * z, 'rgba(255,255,255,.9)', '#2f7d47', `700 ${Math.max(9, 10 * z)}px ${UI_FONT}`, Math.max(15, 17 * z));
        else if (z > 0.12) circle(p.x, p.y - 48 * z, Math.max(2, 3.5 * z), '#34c759', '#fff', 1);
        if (z > 0.2) hits.push({ kind: 'lot', owner: w.id, pri: 2, x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 46 * z, y1: p.y + 4 });
      } });
      return true;
    });
  }
  // ---------- the country around town (v0.9): other villages, farms, woods and lakes, out to the horizon ----------
  // Made up in 22-tile squares from a fixed seed; drawn simply (they're always far away). Mountains stay to the north and west.
  const OUT = { x0: WX0 - 110, y0: WY0 - 110, x1: WX1 + 110, y1: WY1 + 110, ch: 22 };
  let OUT_CHUNKS = null;
  function outChunks() {
    if (OUT_CHUNKS) return OUT_CHUNKS;
    OUT_CHUNKS = [];
    for (let y = OUT.y0; y < OUT.y1; y += OUT.ch) for (let x = OUT.x0; x < OUT.x1; x += OUT.ch) {
      if (x + OUT.ch > WX0 - 2 && x < WX1 + 2 && y + OUT.ch > WY0 - 2 && y < WY1 + 2) continue;   // the town and its woods
      if ((y + OUT.ch > WY0 - 24 && y < WY0 && x < WX1 + 30) || (x + OUT.ch > WX0 - 24 && x < WX0 && y < WY1 + 30)) { OUT_CHUNKS.push({ x, y, k: 'forest' }); continue; }   // under the mountains
      const v = hash(x * 0.37 + 11, y * 0.61 + 7);
      OUT_CHUNKS.push({ x, y, k: v < 0.34 ? 'village' : v < 0.68 ? 'farm' : v < 0.92 ? 'forest' : 'lake', v });
    }
    return OUT_CHUNKS;
  }
  const OUT_ROOF = ['#c0453a', '#3f6fb5', '#5a8a46', '#8a5a9a', '#d98a2e', '#6b5f50'];
  function outskirts(vr, ts) {
    const z = cam.z, S2 = OUT.ch;
    if (vr.x0 > WX0 - 1 && vr.x1 < WX1 + 1 && vr.y0 > WY0 - 1 && vr.y1 < WY1 + 1) return;   // all of it is off screen
    flatRect(OUT.x0, OUT.y0, OUT.x1 - OUT.x0, OUT.y1 - OUT.y0, shade(PAL.woods, 0.06));
    // a ring road around the woods, and highways out to the four sides
    const RR = 5, rw = 2.4, road = (x, y, w, d) => { flatRect(x, y, w, d, '#cfc8b8'); flatRect(x + (w > d ? 0 : 0.3), y + (w > d ? 0.3 : 0), w > d ? w : d - 0.6 > 0 ? w - 0.6 : w, w > d ? d - 0.6 : d, '#8e959c'); };
    road(WX0 - RR - rw, WY0 - RR - rw, WX1 - WX0 + 2 * RR + 2 * rw, rw); road(WX0 - RR - rw, WY1 + RR, WX1 - WX0 + 2 * RR + 2 * rw, rw);
    road(WX0 - RR - rw, WY0 - RR, rw, WY1 - WY0 + 2 * RR); road(WX1 + RR, WY0 - RR, rw, WY1 - WY0 + 2 * RR);
    road(WX1 + RR, (WY0 + WY1) / 2, OUT.x1 - WX1 - RR, rw); road((WX0 + WX1) / 2, WY1 + RR, rw, OUT.y1 - WY1 - RR);
    const things = [];   // houses and barns go on top of every square's ground, back to front
    for (const c of outChunks()) {
      if (c.x > vr.x1 || c.x + S2 < vr.x0 || c.y > vr.y1 || c.y + S2 < vr.y0) continue;
      const r = (k, j) => hash(c.x + k * 3.1, c.y + j * 1.7);
      if (c.k === 'farm') {
        const cols = PAL.rows || ['#d9c46a', '#8cc95f', '#c9a36a', '#b3d77f', '#e2c06a'];
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) flatRect(c.x + 1 + i * 10, c.y + 1 + j * 10, 9.2, 9.2, cols[Math.floor(r(i, j) * cols.length)]);
        if (z > 0.08) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let s = 1; s < 5; s++) { const a = iso(c.x + 1 + i * 10, c.y + 1 + j * 10 + s * 1.84), b = iso(c.x + 10.2 + i * 10, c.y + 1 + j * 10 + s * 1.84); line(a.x, a.y, b.x, b.y, 'rgba(70,50,20,.18)', 1.2 * z); }
        things.push({ d: c.x + c.y + 21, f: () => { box(c.x + 17, c.y + 2, 2.4, 1.8, 18, '#c0453a'); gableX(c.x + 16.9, c.y + 1.9, 2.6, 2, 18, 9, '#7a3a30', '#c0453a'); } });   // a barn
      } else if (c.k === 'lake') {
        const m = iso(c.x + S2 / 2, c.y + S2 / 2);
        ellipse(m.x, m.y, S2 * 18 * z, S2 * 8 * z, '#c9b88f'); ellipse(m.x, m.y, S2 * 16 * z, S2 * 7 * z, '#5aa7d6');
      } else if (c.k === 'forest') {
        flatRect(c.x, c.y, S2, S2, shade(PAL.woods, -0.06));
        const L = PAL.leaf;
        for (let k = 0; k < 9; k++) { const p = iso(c.x + 2 + r(k, 1) * (S2 - 4), c.y + 2 + r(k, 2) * (S2 - 4)), rr = (40 + r(k, 3) * 30) * z; circle(p.x, p.y - rr, rr, k % 2 ? L[0] : L[1]); }
      } else {   // a village: two crossing streets and little houses
        flatRect(c.x, c.y, S2, S2, shade(PAL.town, -0.02));
        flatRect(c.x, c.y + 10, S2, 1.6, '#8e959c'); flatRect(c.x + 10, c.y, 1.6, S2, '#8e959c');
        // real little houses (the same drawings as in town, kept as pictures so it stays fast), one per corner
        [[1, 2], [12.4, 2], [1, 12.6], [12.4, 12.6]].forEach(([qx, qy], k) => {
          if (r(k, 5) < 0.15) return;
          const v = OUT_HOMES[Math.floor(r(k, 6) * OUT_HOMES.length)], [fx, fy, fw, fd] = HOUSES[v.house].fp, hx = c.x + qx - fx + (8 - fw) * 0.3, hy = c.y + qy - fy + (7 - fd) * 0.5;
          things.push({ d: hx + hy + fx + fy + fw / 2 + fd / 2, f: () => drawHouseCached(v, hx, hy) });
          const tr = { x: c.x + qx + 7.4, y: c.y + qy + 0.6 };
          if (r(k, 7) < 0.6) things.push({ d: tr.x + tr.y, f: () => drawWildTree(tr.x, tr.y, 0.5 + r(k, 8) * 0.4, ts) });
        });
      }
    }
    things.sort((a, b) => a.d - b.d).forEach(o => o.f());
  }
  // A few house styles for the villages around town (a short list, so their pictures can be reused).
  const OUT_HOMES = [[1, '#f4e7cc', '#c0453a'], [2, '#e8d6b8', '#3f6fb5'], [3, '#fbf3e4', '#5a8a46'], [1, '#f6e0c8', '#8a5a9a'], [4, '#efe6d6', '#d98a2e'],
    [2, '#f4e7cc', '#6b5f50'], [6, '#fbf3e4', '#c0453a'], [3, '#e3d3bb', '#3f6fb5'], [5, '#f2ece2', '#4f7f9a'], [0, '#f4e7cc', '#c0453a']]
    .map(([house, wall, roof], i) => ({ id: 'out' + i, house, wall, roof, extra: {}, ups: [], room: { wall: 0, floor: 0, items: [] }, yard: [], animals: [] }));
  // Big area names shown when zoomed out over the town.
  const AREA_LABELS = [['area_maple', 30, 10], ['area_center', 89, 1], ['area_lake', 144, 9], ['area_park', 90, 44], ['area_farm', 30, 47], ['area_fields', 55, 79], ['area_water', 146, 50]];
  // ---------- weather (real local weather, or the town's own) ----------
  // On the ground: snow cover, a wet tint for rain, cloud shadows drifting over town.
  function weatherGround(ts) {
    const w = weatherNow().kind, z = cam.z;
    if (w === 'snow') flatRect(WX0, WY0, WX1 - WX0, WY1 - WY0, 'rgba(250,252,255,.6)');
    else if (w === 'rain' || w === 'storm') flatRect(WX0, WY0, WX1 - WX0, WY1 - WY0, 'rgba(40,70,110,.1)');
    if (w === 'clouds' || w === 'rain' || w === 'storm') for (let k = 0; k < 9; k++) {
      const x = ((k * 37 + ts / 1000 * 0.5) % 230) - 25, y = (k * 23) % 100 - 5, c = iso(x, y);
      ellipse(c.x, c.y, 300 * z, 150 * z, 'rgba(30,40,60,.07)');
    }
  }
  // In the air: rain streaks, snowflakes, fog, lightning. Screen-space particles.
  let drops = [], flash = 0;
  function weatherSky(ts, dt) {
    const w = weatherNow().kind;
    if (w === 'clear') { drops = []; return; }
    if (w === 'clouds') { ctx.fillStyle = 'rgba(90,100,120,.07)'; ctx.fillRect(0, 0, W, H); return; }
    if (w === 'fog') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(235,238,240,.62)'); g.addColorStop(1, 'rgba(235,238,240,.22)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
    }
    const snow = w === 'snow', n = snow ? 140 : w === 'storm' ? 240 : 150;
    if (drops.length !== n || drops.snow !== snow) { drops = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.6 + Math.random() * 0.8 })); drops.snow = snow; }
    if (!snow) { ctx.fillStyle = w === 'storm' ? 'rgba(40,50,70,.16)' : 'rgba(70,90,120,.1)'; ctx.fillRect(0, 0, W, H); }
    ctx.save();
    ctx.lineCap = 'round';
    drops.forEach((p, i) => {
      if (snow) {
        p.y += 34 * p.s * dt; p.x += Math.sin(ts / 900 + i) * 12 * dt;
        circle(p.x, p.y, 1.4 + p.s * 1.4, 'rgba(255,255,255,.92)');
      } else {
        const vx = -110 * p.s, vy = 620 * p.s;
        p.x += vx * dt; p.y += vy * dt;
        line(p.x, p.y, p.x - vx * 0.025, p.y - vy * 0.025, 'rgba(225,235,250,.75)', 1.3);
      }
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * (W + 60); }
      if (p.x < -20) p.x = W + 10;
    });
    ctx.restore();
    if (w === 'storm') {
      if (flash <= 0 && Math.random() < dt * 0.15) { flash = 1; if (typeof Sound !== 'undefined') setTimeout(() => Sound.play('thunder'), 400 + Math.random() * 900); }
      if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); flash -= dt * 3; }
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

  // ---------- inside: stairs ----------
  // The flight up: 7 steps rising towards the right wall, with a railing on the open side.
  const STAIR_H = 84, STAIR_DOWN = 62;
  function drawFlight(s, lv, ts) {
    const z = cam.z, wood = '#b07a4a', n = 7, stepH = STAIR_H / n;
    for (let k = 0; k < n; k++) box(s.x + k * s.w / n, s.y, s.w / n + 0.01, s.d, (k + 1) * stepH, k % 2 ? shade(wood, 0.06) : wood, 0, { edge: 'rgba(0,0,0,.12)' });
    const c = iso(s.x + s.w / 2, s.y + s.d / 2);
    if (!edit) hits.push({ kind: 'stairs', dir: 1, pri: 1, x0: c.x - 40 * z, x1: c.x + 40 * z, y0: c.y - 90 * z, y1: c.y + 16 * z });
  }
  function drawFlightRail(s, lv) {
    const z = cam.z, stepH = STAIR_H / 7;
    const a = up(iso(s.x + 0.05, s.y + s.d), 26 * z), b = up(iso(s.x + s.w, s.y + s.d), (STAIR_H + 22) * z);
    for (let k = 0; k <= 3; k++) { const p = lerp(up(iso(s.x + 0.05, s.y + s.d), stepH * z), up(iso(s.x + s.w, s.y + s.d), STAIR_H * z), k / 3); line(p.x, p.y, p.x, p.y - 22 * z, '#7a4f2e', 1.4 * z); }
    line(a.x, a.y, b.x, b.y, '#7a4f2e', 2.2 * z);
    const c = iso(s.x + s.w / 2, s.y + s.d / 2);
    pill(`⬆ ${lv + 2}F`, c.x, c.y - 96 * z, 'rgba(255,253,248,.95)', '#7a4f2e', `bold ${Math.max(10, 11 * z)}px ${UI_FONT}`, Math.max(16, 18 * z));
  }
  // The opening down: a hole in the floor with steps going down to the left (flat, drawn under everything).
  function drawOpening(s) {
    const z = cam.z;
    flatRect(s.x, s.y, s.w, s.d, '#3c2f25');
    for (let k = 0; k < 6; k++) flatRect(s.x + 0.12 + k * (s.w - 0.24) / 6, s.y + 0.08, (s.w - 0.24) / 6 - 0.04, s.d - 0.16, shade('#6b4f39', -(5 - k) * 0.1));
    const c = iso(s.x + s.w / 2, s.y + s.d / 2);
    if (!edit) hits.push({ kind: 'stairs', dir: -1, pri: 1, x0: c.x - 40 * z, x1: c.x + 40 * z, y0: c.y - 30 * z, y1: c.y + 16 * z });
  }
  function drawOpeningRail(s, lv) {
    const z = cam.z, rail = (ax, ay, bx, by) => { const p = up(iso(ax, ay), 18 * z), q = up(iso(bx, by), 18 * z); line(p.x, p.y, q.x, q.y, '#7a4f2e', 2 * z); };
    [[s.x, s.y + s.d], [s.x + s.w * 0.5, s.y + s.d], [s.x, s.y]].forEach(([px, py]) => { const p = iso(px, py); line(p.x, p.y, p.x, p.y - 18 * z, '#7a4f2e', 1.4 * z); });
    rail(s.x, s.y + s.d, s.x + s.w * 0.5, s.y + s.d); rail(s.x, s.y, s.x, s.y + s.d);
    const c = iso(s.x + s.w / 2, s.y + s.d / 2);
    pill(`⬇ ${lv}F`, c.x, c.y - 26 * z, 'rgba(255,253,248,.95)', '#7a4f2e', `bold ${Math.max(10, 11 * z)}px ${UI_FONT}`, Math.max(16, 18 * z));
  }
  // Taking the stairs: walk to them, climb (or go down into the opening), the floor changes, then you arrive
  // on the other storey (coming down the flight, or rising out of the opening). onSwitch changes LEVEL.
  let floorFade = 0;
  function takeStairs(dir, onSwitch, onArrive) {
    if (mode !== 'interior') return false;
    const h = homeOf(owner), r = stairsRects(h, viewLv(h)).find(s => s.kind === (dir > 0 ? 'up' : 'down'));
    if (!r) return false;
    cancel(meIn); meIn.anim = null;
    const spot = stairsSpot(h, r.kind);
    // up: from the tile left of the flight, step by step up to the top (the height follows each step);
    // down: from the tile in front of the opening, into it and down out of sight
    const climb = () => {
      meIn.anim = dir > 0
        ? { pts: [[r.x - 0.1, 0.5, 0], [r.x + 1.85, 0.5, STAIR_H]], flight: r, fade: 'out', speed: 1.3 }
        : { pts: [[r.x + 1.7, r.y + 0.5, 0], [r.x + 0.3, r.y + 0.5, -STAIR_DOWN]], clip: r, fade: 'out', speed: 1.3 };
      meIn.anim.done = () => { onSwitch(); arriveStairs(dir, onArrive); };
    };
    meIn.jobs.push({ key: 'stairs', spot: () => spot, dur: 0, reach: 1.6, done: climb, fail: climb });
    return true;
  }
  function arriveStairs(dir, onArrive) {
    const h = homeOf(owner), lv = viewLv(h), rs = stairsRects(h, lv);
    meIn.lv = lv; meIn.room = owner; meIn.seat = 0; meIn.useId = null; cancel(meIn);
    floorFade = performance.now();
    const r = rs.find(s => s.kind === (dir > 0 ? 'down' : 'up'));
    if (!r) { [meIn.x, meIn.y, meIn.face] = stairsSpot(h); if (onArrive) onArrive(); return; }
    // from below: rise out of the opening and step off in front of it; from above: walk down the flight step by step
    if (dir > 0) { meIn.x = r.x + 0.3; meIn.y = r.y + 0.5; meIn.lift = -STAIR_DOWN; meIn.anim = { pts: [[r.x + 1.7, r.y + 0.5, 0], [r.ax + 0.5, r.ay + 0.45, 0]], clip: r, fade: 'in', speed: 1.3 }; }
    else { meIn.x = r.x + 1.85; meIn.y = 0.5; meIn.lift = STAIR_H; meIn.anim = { pts: [[r.x - 0.1, 0.5, 0], [r.ax + 0.5, r.ay + 0.5, 0]], flight: r, fade: 'in', speed: 1.3 }; }
    meIn.anim.done = onArrive;
  }
  // Moves along the stairs animation; the height changes evenly with the distance walked.
  function stepAnim(a, dt) {
    const an = a.anim;
    const [tx, ty, tl] = an.pts[0], dx = tx - a.x, dy = ty - a.y, dist = Math.hypot(dx, dy), st = an.speed * dt;
    a.lift = a.lift || 0;
    if (dist <= st) { a.x = tx; a.y = ty; if (!an.flight) a.lift = tl; an.pts.shift(); }
    else { const k = st / dist; a.x += dx * k; a.y += dy * k; if (!an.flight) a.lift += (tl - a.lift) * k; }
    if (an.flight) {   // on the flight: stand on the step under your feet (7 steps of 12 px)
      const f = an.flight, n = 7, on = a.x - f.x, target = on < 0 ? 0 : Math.min(STAIR_H, (Math.floor(on / (f.w / n)) + 1) * STAIR_H / n);
      a.lift += (target - a.lift) * Math.min(1, dt * 22);
      if (target !== an.lastStep) { an.lastStep = target; if (typeof Sound !== 'undefined') Sound.play('step'); }
    }
    faceTo(a, dx, dy);
    a.phase += dt * 11; a.moving = true;
    an.t = (an.t || 0) + dt;
    if (an.fade === 'in') a.alpha = Math.min(1, an.t / 0.35);
    else a.alpha = an.pts.length === 1 ? Math.min(1, Math.hypot(an.pts[0][0] - a.x, an.pts[0][1] - a.y) / 0.6) : 1;
    if (!an.pts.length) { a.anim = null; a.moving = false; a.lift = 0; a.alpha = 1; a.view = null; if (an.done) an.done(); }
  }
  function renderInterior(ts, dt) {
    const h = homeOf(owner), [rw, rd] = roomSize(h), z = cam.z, WH = 92, lv = viewLv(h), room = roomAt(h, lv), top = floorsOf(h) - 1;
    const wallCol = ROOM_WALLS[room.wall] || ROOM_WALLS[0], fl = FLOORS[room.floor] || FLOORS[0];
    const A = iso(0, 0), B = iso(rw, 0), C = iso(rw, rd), D = iso(0, rd), dn = (p, k) => ({ x: p.x, y: p.y + k });
    poly([D, C, dn(C, 12 * z), dn(D, 12 * z)], shade(fl.c2, -0.35));
    poly([C, B, dn(B, 12 * z), dn(C, 12 * z)], shade(fl.c2, -0.45));
    poly([D, A, up(A, WH * z), up(D, WH * z)], shade(wallCol, -0.07));
    poly([A, B, up(B, WH * z), up(A, WH * z)], wallCol);
    poly([up(D, WH * z), up(A, WH * z), up(A, (WH + 6) * z), up(D, (WH + 6) * z)], shade(wallCol, -0.2));
    poly([up(A, WH * z), up(B, WH * z), up(B, (WH + 6) * z), up(A, (WH + 6) * z)], shade(wallCol, -0.12));
    const leftW = [D, A], backW = [A, B];
    wallRect(leftW, 0, 0, 1, 0, 5, shade(wallCol, -0.3)); wallRect(backW, 0, 0, 1, 0, 5, shade(wallCol, -0.25));
    const wk = weatherNow().kind;
    const sky = NIGHT > 0.5 ? '#26345f' : NIGHT > 0.1 ? '#e9a27a' : wk === 'rain' || wk === 'storm' ? '#9fb0c0' : wk === 'snow' ? '#e9eef3' : wk === 'fog' ? '#d9dee2' : wk === 'clouds' ? '#cad7e0' : '#bfe6f7';
    const nW = Math.max(1, Math.floor(rw / 3));
    for (let i = 0; i < nW; i++) {
      const u = (i + 0.5) / nW;
      wallRect(backW, 0, u - 0.1, u + 0.1, 34, 70, '#fffaf0');
      wallRect(backW, 0, u - 0.085, u + 0.085, 36.5, 67.5, sky);
      if (NIGHT > 0.5) { const p = wallPt(backW, 0, u + 0.04, 58); circle(p.x, p.y, 3 * z, '#fff6c8'); }
      else { const p = wallPt(backW, 0, u - 0.03, 46); ellipse(p.x, p.y, 7 * z, 3 * z, 'rgba(255,255,255,.8)'); }
      wallLine(backW, 0, u, 36.5, u, 67.5, '#fffaf0', 1.5); wallLine(backW, 0, u - 0.085, 52, u + 0.085, 52, '#fffaf0', 1.5);
    }
    const cp = wallPt(leftW, 0, 0.55, 64), d = new Date(now());
    circle(cp.x, cp.y, 8 * z, '#fffaf0', '#7a4f2e', 1.6 * z);
    const ha = (d.getHours() % 12 + d.getMinutes() / 60) / 12 * Math.PI * 2, ma = d.getMinutes() / 60 * Math.PI * 2;
    line(cp.x, cp.y, cp.x + Math.sin(ha) * 4 * z, cp.y - Math.cos(ha) * 4 * z, '#333', 1.4 * z);
    line(cp.x, cp.y, cp.x + Math.sin(ma) * 6 * z, cp.y - Math.cos(ma) * 6 * z, '#333', 1 * z);
    wallRect(leftW, 0, 0.22, 0.38, 40, 62, '#8a5a36'); wallRect(leftW, 0, 0.235, 0.365, 42.5, 59.5, '#9fd0e8');
    const mp = wallPt(leftW, 0, 0.3, 46); pg([[mp.x - 6 * z, mp.y], [mp.x, mp.y - 9 * z], [mp.x + 6 * z, mp.y]], '#6cae5a');
    const du = 0.1;
    if (lv === 0) {   // the front door is downstairs; upstairs gets a window there instead
      wallRect(leftW, 0, du - 0.07, du + 0.07, 0, 52, '#fffaf0');
      wallRect(leftW, 0, du - 0.06, du + 0.06, 0, 49, '#8a5a36');
      const kp = wallPt(leftW, 0, du + 0.035, 24); circle(kp.x, kp.y, 1.4 * z, '#f2c230');
      const da = wallPt(leftW, 0, du - 0.07, 0), db = wallPt(leftW, 0, du + 0.07, 54);
      hits.push({ kind: 'exit', pri: 1, x0: Math.min(da.x, db.x) - 4, x1: Math.max(da.x, db.x) + 4, y0: db.y - 4, y1: da.y + 4 });
    } else {
      wallRect(leftW, 0, du - 0.07, du + 0.07, 30, 66, '#fffaf0');
      wallRect(leftW, 0, du - 0.055, du + 0.055, 32.5, 63.5, sky);
      wallLine(leftW, 0, du, 32.5, du, 63.5, '#fffaf0', 1.5);
    }
    for (let j = 0; j < rd; j++) for (let i = 0; i < rw; i++) {
      tile(i, j, (i + j) % 2 ? fl.c1 : fl.c2);
      if (room.floor === 0 || room.floor === 3) { const a = iso(i, j + 0.5), b = iso(i + 1, j + 0.5); line(a.x, a.y, b.x, b.y, 'rgba(0,0,0,.08)', 1 * z); }
    }
    if (lv > 0 || top > 0) pill(`${lv + 1}F`, iso(0.4, 0.4).x, iso(0.4, 0.4).y - (WH - 10) * z, 'rgba(59,49,37,.78)', '#fff', `bold ${Math.max(10, 12 * z)}px ${UI_FONT}`, Math.max(16, 20 * z));
    if (edit && edit.scope === 'room') for (let j = 0; j < rd; j++) for (let i = 0; i < rw; i++) tile(i, j, null, 'rgba(255,255,255,.45)');
    const objs = [], stairs = stairsRects(h, lv), upR = stairs.find(s => s.kind === 'up');
    stairs.forEach(s => {
      if (s.kind === 'down') { drawOpening(s); objs.push({ d: s.x + s.y + 1.6, f: () => drawOpeningRail(s, lv) }); }
      else { objs.push({ d: s.x + s.y + 1.3, f: () => drawFlight(s, lv, ts) }); objs.push({ d: s.x + s.y + 1.45, f: () => drawFlightRail(s, lv) }); }
    });
    room.items.forEach(it => {
      if (edit && edit.hold && edit.hold.id === it.id) return;
      const [w, dd] = itemSize('room', it), flat = FURN[it.k].flat;
      const fn = () => {
        drawFurn(it, it.x, it.y, ts);
        if (edit && edit.scope === 'room' && owner === 'me') hits.push({ kind: 'item', id: it.id, flat, ...footRect(it.x, it.y, w, dd, flat ? 4 : 40) });
        else if (!edit) hits.push({ kind: 'furn', id: it.id, k: it.k, flat, ...footRect(it.x, it.y, w, dd, flat ? 4 : 40) });
      };
      if (flat) fn(); else objs.push({ d: it.x + it.y + (w + dd) / 2, f: fn });
    });
    // your pets come inside with you: they wander the room, and say what they need
    if (owner === 'me' && lv === 0) myPets(h).forEach((a, k) => {
      const e = ent('pin:' + a.id, () => ({ x: 1.5 + k, y: rd - 1.5 }));
      wander(e, dt, SPEED[a.k] * 0.6, en => randomWalk(en, roomNav(h), 3, 99, true));
      objs.push({ d: e.x + e.y, f: () => {
        const p = iso(e.x, e.y), st = animalStage(a);
        drawAnimal(a.k, st, p.x, p.y, z * 0.8, { face: e.face, moving: e.moving, phase: e.phase, ts, seed: k * 2.3, breed: a.breed, mood: petMood(a) });
        const ask = petAsks(a);
        if (ask.length && !e.moving) emoji(PET_NEEDS[ask[0]].e, p.x + 8 * z, p.y - 24 * z, 12 * z);
        if (!edit) hits.push({ kind: 'pet', id: a.id, pri: 2, x0: p.x - 14 * z, x1: p.x + 14 * z, y0: p.y - 24 * z, y1: p.y + 4 * z });
      } });
    });
    if (owner !== 'me') {
      const e = ent('in:' + h.id, () => ({ x: rw - 1.5, y: rd - 1.5 }));
      wander(e, dt, speedOf(h) * 0.7, en => randomWalk(en, roomNav(h), 4, 99));
      objs.push({ d: e.x + e.y, f: () => {
        const p = iso(e.x, e.y);
        drawPerson(p.x, p.y, z, { look: h.look, face: e.face, back: e.back && e.moving, view: e.moving ? e.view : null, moving: e.moving, phase: e.phase, energy: friendEnergy(h), ts, seed: 1, wave: e.wave > performance.now() });
        if (!edit) hits.push({ kind: 'avatar', owner: h.id, x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 44 * z, y1: p.y + 4 * z });
      } });
    }
    if (meIn.room !== owner) { cancel(meIn); meIn.anim = null; meIn.tr = null; meIn.using = null; meIn.room = owner; meIn.lv = lv; meIn.x = 0.6; meIn.y = rd * 0.9; meIn.face = 1; }
    if (meIn.lv !== lv) { cancel(meIn); meIn.anim = null; meIn.tr = null; meIn.using = null; meIn.lv = lv; meIn.seat = 0; meIn.useId = null; [meIn.x, meIn.y, meIn.face] = stairsSpot(h); }
    // on the stairs: after the steps but before their railing (inside the opening: before its railing)
    const an = meIn.anim, clipR = an && an.clip && meIn.y < an.clip.y + an.clip.d ? an.clip : null, onFlight = an && an.flight && meIn.y < 1 && meIn.x > an.flight.x - 0.2;
    // getting on or off a seat / bed (meIn.tr) shows that step's pose; meIn.using is the seat or bed being used
    const trS = meIn.tr && meIn.tr.cur, usingId = meIn.useId || (meIn.using && meIn.using.id);
    const useIt = usingId && room.items.find(x => x.id === usingId), useK = useIt && FURN[useIt.k].use;
    const bedD = useK === 'sleep' && !(trS && trS.pose === 'walk') ? useIt.x + useIt.y + itemSize('room', useIt).reduce((a, b) => a + b) / 2 + 0.02 : 0;   // in bed: right after the bed
    const meD = clipR ? clipR.x + clipR.y + 1.4 : onFlight && upR ? upR.x + upR.y + 1.38 : bedD || meIn.x + meIn.y + (meIn.seat || useK === 'sit' ? 0.7 : 0);
    objs.push({ d: meD, f: () => {
      const p = iso(meIn.x, meIn.y), pose = trS ? trS.pose : meIn.livePose || (meIn.act ? meIn.act.pose : meIn.moving ? 'walk' : 'stand');
      const it = meIn.useId && room.items.find(x => x.id === meIn.useId), lift = meIn.lift || 0;
      ctx.save();
      if (meIn.alpha < 1) ctx.globalAlpha = Math.max(0, meIn.alpha);
      if (meIn.anim && meIn.anim.clip && lift < 0) {   // going down into the opening: hide what's below the floor
        const r = meIn.anim.clip, a = iso(r.x - 0.2, r.y + r.d), b = iso(r.x + r.w, r.y + r.d);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x, b.y - 400); ctx.lineTo(a.x, a.y - 400); ctx.closePath(); ctx.clip();
      }
      // sitting: hips on the seat, feet on the floor; lying: on the mattress, then the quilt goes back over you
      const sitH = pose !== 'sit' ? 0 : trS ? trS.seatH : useK === 'sit' ? SEAT_H[useIt.k] || 9 : 0, lieH = pose === 'lie' && useIt ? LIE_H[useIt.k] || 10 : 0;
      const yOff = sitH ? 0 : lieH || meIn.seat || 0;
      drawPerson(p.x, p.y - (yOff + lift) * z, z, { look: S.me.look, face: meIn.face, back: meIn.back && meIn.moving, view: meIn.moving ? meIn.view : null, moving: meIn.moving, phase: meIn.phase, energy: energyLevel(), ts, seed: 3, pose, noBike: true, wave: meIn.wave > performance.now(), matCol: it && it.tint, seatH: sitH, dir: lieDir(useIt) });
      if (pose === 'lie' && useIt) drawBedQuilt(useIt);
      ctx.restore();
      if (S.live) liveBadge(p, S.live, true);
      if (!edit) hits.push({ kind: 'avatar', owner: 'me', x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 44 * z, y1: p.y + 4 * z });
    } });
    room.items.forEach(it => { if (!FURN[it.k].flat && !(edit && edit.hold && edit.hold.id === it.id)) furnShadow(it); });
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    drawGlows();
    const fa = 1 - (performance.now() - floorFade) / 450;   // a soft flash when you arrive on another storey
    if (fa > 0) { ctx.fillStyle = `rgba(255,248,235,${fa * 0.55})`; ctx.fillRect(0, 0, W, H); }
    if (edit && edit.scope === 'room') editOverlay(ts);
  }

  // ---------- design mode ----------
  function editOrigin() { return edit && edit.scope === 'yard' ? origin('me') : [0, 0]; }
  function holdOrigin(sx, sy) {
    const p = unIso(sx, sy), [ox, oy] = editOrigin(), it = edit.hold, def = itemDef(edit.scope, it.k);
    const [w, d] = it.rot ? [def.d, def.w] : [def.w, def.d];
    return { x: Math.floor(p.x - ox) - Math.floor((w - 1) / 2), y: Math.floor(p.y - oy) - Math.floor((d - 1) / 2), w, d };
  }
  function editOverlay(ts) {
    const z = cam.z, [ox, oy] = editOrigin();
    if (edit.sel) {
      const it = findItem(edit.scope, edit.sel);
      if (it) {
        const [w, d] = itemSize(edit.scope, it);
        ctx.save(); ctx.setLineDash([5 * z, 4 * z]); ctx.lineDashOffset = -ts / 60;
        flatRect(ox + it.x, oy + it.y, w, d, 'rgba(239,125,60,.18)', '#ef7d3c', 0.5, 2.5 * z);
        ctx.restore();
      }
    }
    if (edit.hold && hover) {
      const o = holdOrigin(hover.x, hover.y);
      const ok = canPlace(S.me, edit.scope, edit.hold.k, o.x, o.y, edit.hold.rot, edit.hold.id);
      flatRect(ox + o.x, oy + o.y, o.w, o.d, ok ? 'rgba(76,175,106,.35)' : 'rgba(229,72,77,.35)', ok ? '#4caf6a' : '#e5484d', 0.5, 2 * z);
      ctx.save(); ctx.globalAlpha = 0.6;
      const ghost = { ...edit.hold, x: o.x, y: o.y, placed: now() };
      if (edit.scope === 'room') drawFurn(ghost, o.x, o.y, ts); else drawYardItem(ghost, ox + o.x, oy + o.y, ts);
      ctx.restore();
    }
  }

  // ---------- floating text ----------
  function drawFloats(ts) {
    for (let k = floats.length - 1; k >= 0; k--) {
      const f = floats[k], age = (ts - f.born) / 1600;
      if (age > 1) { floats.splice(k, 1); continue; }
      if (f.inside !== (mode === 'interior')) continue;
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
  function floatLocal(lot, x, y, text) { const [ox, oy] = origin(lot); floats.push({ text, wx: ox + x, wy: oy + y, inside: false, born: performance.now() }); }

  // ---------- loop ----------
  function frame(ts) { requestAnimationFrame(frame); render(ts); }
  function updateMe(dt, ts) {
    const h = homeOf(me.lot) || S.me;
    // live workout: the townie does what you're doing
    const lk = S.live ? S.live.type + S.live.start : null;
    if (lk !== liveKey) {
      liveKey = lk; cancel(me); cancel(meIn);
      if (lk && mode === 'home' && owner === me.lot) follow = true;
      if (!lk) { follow = false; me.livePose = null; meIn.livePose = null; if (me.y >= LOT_D || inLake(...lakeWorld())) { me.x = 3.5; me.y = 14.6; me.path = planPath(me, lotNav(h), 3.5, 12.5, 2) || []; } }
    }
    if (S.live) {
      if (mode === 'interior' && owner === 'me') { meIn.livePose = indoorLive(dt, ts); }
      me.livePose = doLive(me, S.live.type, h, dt, ts);
      return;
    }
    runActor(me, () => lotNav(h), dt, ts, speedOf(S.me));
    if (mode === 'interior') {
      if (meIn.using && (!meIn.tr || meIn.tr.enter) && meIn.useId !== meIn.using.id) { const b = meIn.using; meIn.tr = { steps: exitSteps(b), done: () => { if (meIn.using === b) meIn.using = null; } }; }
      if (meIn.tr) stepTr(meIn, dt);
      else if (meIn.anim) stepAnim(meIn, dt);
      else runActor(meIn, () => roomNav(homeOf(owner)), dt, ts, speedOf(S.me) * 0.8);
    }
  }
  function meInLake() { return me.livePose === 'swim' && !!S.live && inLake(...lakeWorld()); }
  function lakeWorld() { const [ox, oy] = origin(me.lot); return [ox + me.x, oy + me.y]; }
  // Inside: use the matching machine if you have one, otherwise do it on the spot.
  function indoorLive(dt, ts) {
    const h = homeOf(owner), use = { run: 'run', cycle: 'bike', strength: 'lift', yoga: 'yoga', hiit: 'box' }[S.live.type];
    const it = use && viewRoom(h).items.find(x => FURN[x.k].use === use);
    if (it && meIn.useId !== it.id) { const sp = useSpot(it); meIn.x = sp[0]; meIn.y = sp[1]; meIn.face = sp[2]; meIn.seat = SEAT[it.k] || 0; meIn.useId = it.id; }
    if (S.live.type === 'swim') return 'stand';
    return it && FURN[it.k].use === 'box' ? 'box' : WORKOUT_POSE[S.live.type];
  }
  function useSpot(it) {
    const [w, d] = itemSize('room', it), use = FURN[it.k].use;
    if (use === 'lift' || use === 'box') return [it.x + w / 2 - 0.1, it.y + d + 0.35, 1];
    if (use === 'sleep') {   // head on the pillow (the body is drawn 0.27 tiles behind the head); a double bed: one side
      const hy = (LIE_HEAD[it.k] || 0.35) + 0.27, side = it.k === 'bed' ? 0.55 : null;
      return it.rot ? [it.x + hy, it.y + (side || d / 2), 1] : [it.x + (side || w / 2), it.y + hy, 1];
    }
    const face = use === 'sit' || use === 'bike' ? (it.rot ? 1 : -1) : use === 'run' ? (it.rot ? -1 : 1) : 1;
    return [it.x + w / 2, it.y + d / 2, face];
  }
  // Getting onto a seat or into bed, step by step: walk up to the edge, sit down (on a bed: sit on the edge first,
  // then lie back and slide under the quilt). `back` remembers the way out for getting up again.
  function seatSteps(a, it, sp, use) {
    const [w, d] = itemSize('room', it), m = 0.2;
    const ex = clamp(a.x, it.x + m, it.x + w - m), ey = clamp(a.y, it.y + m, it.y + d - m);
    let ox = a.x - ex, oy = a.y - ey; const L = Math.hypot(ox, oy) || 1; ox /= L; oy /= L;
    const F = [ex + ox * 0.42, ey + oy * 0.42], out = ox - oy >= 0 ? 1 : -1, walk = Math.hypot(F[0] - a.x, F[1] - a.y), steps = [];
    if (walk > 0.05) steps.push({ pose: 'walk', x: F[0], y: F[1], dur: walk / 1.6 });
    const seatH = use === 'sleep' ? (LIE_H[it.k] || 10) - 1 : SEAT_H[it.k] || 9;
    if (use === 'sleep') {
      steps.push({ pose: 'sit', x: ex, y: ey, dur: 0.32, seatH, face: out });
      steps.push({ pose: 'sit', dur: 0.28, seatH, face: out });
      steps.push({ pose: 'lie', x: sp[0], y: sp[1], dur: 0.55 });
    } else steps.push({ pose: 'sit', x: sp[0], y: sp[1], dur: 0.38, seatH, face: sp[2] });
    return { steps, back: { id: it.id, use, ex, ey, F, seatH, out } };
  }
  function exitSteps(b) {
    if (b.use === 'sleep') return [{ pose: 'lie', x: b.ex, y: b.ey, dur: 0.4 }, { pose: 'sit', dur: 0.3, seatH: b.seatH, face: b.out }, { pose: 'walk', x: b.F[0], y: b.F[1], dur: 0.3 }];
    return [{ pose: 'sit', dur: 0.12, seatH: b.seatH }, { pose: 'walk', x: b.F[0], y: b.F[1], dur: 0.32 }];
  }
  function stepTr(a, dt) {
    const tr = a.tr;
    if (!tr.cur) {
      tr.cur = tr.steps.shift();
      if (!tr.cur) { a.tr = null; a.moving = false; if (tr.done) tr.done(); return; }
      tr.t = 0; tr.from = [a.x, a.y];
    }
    const s = tr.cur, k = s.dur > 0 ? Math.min(1, (tr.t += dt) / s.dur) : 1, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(2 - 2 * k, 2) / 2;
    const tx = s.x ?? tr.from[0], ty = s.y ?? tr.from[1], u = s.pose === 'walk' ? k : e;
    const nx = tr.from[0] + (tx - tr.from[0]) * u, ny = tr.from[1] + (ty - tr.from[1]) * u;
    if (s.pose === 'walk') { faceTo(a, nx - a.x, ny - a.y); a.phase += dt * 11; a.moving = true; }
    else { a.moving = false; a.view = null; a.back = false; if (s.face) a.face = s.face; }
    a.x = nx; a.y = ny;
    if (k >= 1) tr.cur = null;
  }
  // The look of the community on screen: the town you're looking at, or the town this home is in.
  const LAWN_MAPLE = ['#9dcf76', '#a0d279', '#a5d67d', '#a8d981'];
  let LAWN = LAWN_MAPLE, onWorldOut = null, worldOutAt = 0, viewFade = 0;
  const TUB = { x: 11, y: 12.4 };
  function setPal() {
    const t = mode === 'town' ? VIEW_TOWN : townOf(owner), th = TOWN_THEMES[(COMMUNITIES[t] || COMMUNITIES[HOME_TOWN]).theme] || TOWN_THEMES.maple;
    if (th === PAL) return;
    PAL = th;
    LAWN = th === TOWN_THEMES.maple ? LAWN_MAPLE : [-0.03, -0.015, 0.01, 0.025].map(k => shade(th.lawn, k));
    HOUSE_SPR.clear();
  }
  function render(ts) {
    if (!visible || !S || !W) return;
    setPal();
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    ctx = mainCtx;
    useCam();
    if (!worldReady && mode === 'town') frameView(true);
    try { updateMe(dt, ts); } catch (e) { console.error(e); }
    stepCamera(dt);
    NIGHT = nightAmount(now());
    GLOWS = [];
    ctx.clearRect(0, 0, W, H);
    hits = [];
    try {
      if (mode === 'interior') renderInterior(ts, dt);
      else renderWorld(ts, dt);
    } catch (e) { console.error(e); }
    drawFloats(ts);
  }

  // ---------- input ----------
  const inside = (h, sx, sy) => sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1;
  let lastTap = { x: 0, y: 0 };
  function tap(sx, sy) {
    lastTap = { x: sx, y: sy };
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
    const w = unIso(sx, sy);
    if (mode === 'interior') {
      const h = [...hits].reverse().find(x => x.kind === 'avatar' && inside(x, sx, sy))
        || [...hits].reverse().find(x => x.kind === 'stairs' && inside(x, sx, sy))
        || [...hits].reverse().find(x => x.kind === 'furn' && !x.flat && inside(x, sx, sy))
        || [...hits].reverse().find(x => x.kind === 'furn' && inside(x, sx, sy));
      if (h) return onHit(h);
      const [rw, rd] = roomSize(homeOf(owner));
      if (w.x >= 0 && w.y >= 0 && w.x < rw && w.y < rd) onHit({ kind: 'floor', x: w.x, y: w.y });
      return;
    }
    // what's under the tap in the world: a home, empty land for sale, the plaza
    const tx = Math.floor(w.x), ty = Math.floor(w.y);
    const lotHit = allLots().find(l => { const [ox0, oy0] = origin(l.id); return tx >= ox0 && tx < ox0 + l.n * PARCEL && ty >= oy0 && ty < oy0 + LOT_D; });
    let landHit = null;
    for (const [st, s] of Object.entries(STREETS)) {
      if (ty < s.y || ty >= s.y + LOT_D || tx < s.x || tx >= s.x + s.n * PARCEL) continue;
      const p = Math.floor((tx - s.x) / PARCEL);
      if (!parcelOwner(st, p)) { const run = vacantRuns().find(r => r.st === st && p >= r.p && p < r.p + r.n); landHit = { kind: 'land', st, p, n: run ? run.n : 1, run: run && run.p }; }
    }
    const { x: px, y: py } = LANDMARKS.plaza, inPlaza = tx >= px && tx < px + LOT_W && ty >= py && ty < py + LOT_D;
    if (mode === 'town') {
      if (lotHit) return onHit({ kind: 'lot', owner: lotHit.id });
      if (landHit) return onHit(landHit);
      if (inPlaza) onHit({ kind: 'plaza' });
      return;
    }
    const [ox, oy] = origin(owner), lx = w.x - ox, ly = w.y - oy, h = homeOf(owner);
    const small = [...hits].reverse().find(x => ['animal', 'avatar', 'mailbox', 'tree', 'yard', 'shop'].includes(x.kind) && inside(x, sx, sy));
    if (small) return onHit(small);
    const fx = Math.floor(lx) - AREA.fields.x, fy = Math.floor(ly) - AREA.fields.y;
    if (fx >= 0 && fx < 4 && fy >= 0 && fy < 4) {
      const i = fy * 4 + fx;
      if (i < h.fields.length) return onHit({ kind: 'field', owner, i });
      if (owner === 'me' && fy === h.fields.length / 4) return onHit({ kind: 'buyLand' });
    }
    const big = [...hits].reverse().find(x => ['house', 'car', 'pond'].includes(x.kind) && inside(x, sx, sy));
    if (big) return onHit(big);
    if (owner === 'me') {
      if (!h.pastureLv && inRect(AREA.pasture, Math.floor(lx), Math.floor(ly))) return onHit({ kind: 'buyLand' });
      if (!h.orchardLv && inRect(AREA.orchard, Math.floor(lx), Math.floor(ly))) return onHit({ kind: 'buyLand' });
      if (!h.pondLv && inRect(AREA.pond, Math.floor(lx), Math.floor(ly))) return onHit({ kind: 'buyLand' });
    }
    if (lx >= 0 && ly >= 0 && lx < gwOf(h) && ly < GH) return onHit({ kind: 'ground', x: lx, y: ly });
    if (landHit) return onHit(landHit);
    if (lotHit) return onHit({ kind: 'lot', owner: lotHit.id });
    if (inPlaza) onHit({ kind: 'plaza' });
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
        useCam(); zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
      } else if (drag) {
        const p = pos(e), dx = p.x - drag.sx, dy = p.y - drag.sy;
        if (Math.hypot(dx, dy) > 6) drag.moved = true;
        if (drag.moved) { useCam(); cam.x = drag.cx + dx; cam.y = drag.cy + dy; fly = null; follow = false; dragging = true; clampCam(); }
      }
    });
    const end = e => {
      if (drag && !drag.moved && ptrs.size === 1) { const p = pos(e); tap(p.x, p.y); }
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      drag = null; dragging = false;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); drag = null; pinch = null; });
    cv.addEventListener('pointerleave', () => { hover = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); useCam(); const p = pos(e); zoomAt(p.x, p.y, cam.z * (e.deltaY < 0 ? 1.1 : 0.9)); follow = false; }, { passive: false });
  }

  // ---------- jobs the app asks for ----------
  // Where to stand for each kind of target (lot-local), and which way to face.
  function spotFor(tg) {
    const h = homeOf(me.lot);
    switch (tg.kind) {
      case 'ground': return () => [tg.x, tg.y, 0];
      case 'field': { const [x, y] = fieldPos(tg.i); return () => [x + 0.5, y + 1.1, 1]; }
      case 'tree': { const [x, y] = ORCHARD_SLOTS[tg.i]; return () => [x + 0.5, y + 1.15, 1]; }
      case 'pond': return () => [AREA.pond.x - 0.35, AREA.pond.y + 1.5, 1];
      case 'mailbox': return () => [MAILBOX[0] - 0.4, MAILBOX[1] + 0.5, 1];
      case 'door': { const [, fy, , fd] = HOUSES[h.house].fp; return () => [DOOR_X, fy + fd + 0.35, 1]; }
      case 'gate': return () => [3.5, LOT_D + 0.7, 0];
      case 'yard': { const it = h.yard.find(x => x.id === tg.id); if (!it) return null; const [w, d] = itemSize('yard', it); return () => [it.x + w / 2, it.y + d + 0.15, 1]; }
      case 'animal': {
        const e = ents.get(h.id + ':' + tg.id), a = h.animals.find(x => x.id === tg.id);
        if (!e || !a) return null;
        e.hold = performance.now() + 20000;
        const pr = pastureRect(h), pet = ANIMALS[a.k].pet;
        return () => {
          let x = e.x - 0.5, y = e.y + 0.4;
          if (!pet && pr) { x = clamp(x, pr.x + 0.3, pr.x + pr.w - 0.3); y = clamp(y, pr.y + 0.3, pr.y + pr.d - 0.3); }
          return [x, y, 1];
        };
      }
    }
    return null;
  }
  function go(tg, o = {}) {
    if (S.live) return false;
    if (tg.kind === 'furn' || tg.kind === 'floor' || tg.kind === 'exit') return goInside(tg, o);
    const spot = spotFor(tg);
    if (!spot) return false;
    const key = tg.kind + ':' + (tg.i ?? tg.id ?? '');
    if (!o.queue || tg.kind === 'ground') cancel(me);
    else if ((me.cur && me.cur.key === key) || me.jobs.some(j => j.key === key)) return true;
    const animalEnt = tg.kind === 'animal' && ents.get(me.lot + ':' + tg.id);
    me.jobs.push({
      key, spot, pose: o.pose, dur: o.dur || 0, sneak: o.sneak, reach: o.reach || 2.2, valid: o.valid,
      start: o.start, fail: o.fail,
      done: () => { if (animalEnt) animalEnt.hold = 0; if (o.done) o.done(); },
    });
    if (mode === 'home') follow = false;
    return true;
  }
  function goInside(tg, o) {
    const h = homeOf(owner);
    cancel(meIn);
    let spot, pose = o.pose, dur = o.dur || 0, start = null;
    if (tg.kind === 'floor') spot = () => [tg.x, tg.y, 0];
    else if (tg.kind === 'exit') spot = () => [0.5, roomSize(h)[1] * 0.9, -1];
    else {
      const it = viewRoom(h).items.find(x => x.id === tg.id);
      if (!it) return false;
      const use = FURN[it.k].use, sp = useSpot(it);
      spot = () => sp;
      pose = { sit: 'sit', sleep: 'lie', run: 'run', bike: 'bike', lift: 'lift', box: 'box', yoga: 'yoga' }[use];
      dur = Infinity;
      start = a => {
        if (use === 'sit' || use === 'sleep') { const q = seatSteps(a, it, sp, use); a.using = q.back; a.tr = { steps: q.steps, enter: true }; }
        else if (use !== 'lift' && use !== 'box') { a.x = sp[0]; a.y = sp[1]; }
        a.seat = SEAT[it.k] || 0; a.useId = it.id; if (use === 'run') a.phase = 0;
      };
    }
    meIn.jobs.push({ key: tg.kind, spot, pose, dur, reach: 2.5, start, done: o.done, fail: o.fail });
    return true;
  }
  // Order a batch of jobs by walking distance (nearest next), then queue them.
  function goMany(list) {
    if (S.live) return 0;
    cancel(me);
    let x = me.x, y = me.y, n = 0;
    const todo = list.map(j => ({ j, spot: spotFor(j.tg) })).filter(o => o.spot);
    while (todo.length) {
      let bi = 0, bd = 1e9;
      todo.forEach((o, i) => { const [sx, sy] = o.spot(); const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; bi = i; } });
      const { j, spot } = todo.splice(bi, 1)[0];
      [x, y] = spot();
      go(j.tg, { ...j.o, queue: true });
      n++;
    }
    return n;
  }
  function flee(dogId) {
    cancel(me);
    me.fast = true;
    me.path = planPath(me, lotNav(homeOf(me.lot)), 3.5, LOT_D + 0.7, 3) || [];
    const e = ents.get(me.lot + ':' + dogId);
    if (e) { e.chase = performance.now() + 2600; e.hold = 0; }
  }
  function moveToLot(id) {
    if (me.lot === id) return;
    cancel(me);
    me.lot = id;
    const h = homeOf(id);
    me.x = 3.5; me.y = LOT_D + 0.8; me.face = 1;
    me.path = planPath(me, lotNav(h), 3.5, 12.6, 2) || [];
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
  const fakeField = (crop, stage) => ({ crop, at: now() - CROPS[crop].grow * MIN * [0.04, 0.2, 0.5, 0.8, 1.2][stage], left: 1, thieves: [] });
  const HOUSE_H = { tent: 56, cabin: 66, cottage: 78, twostory: 104, modern: 92, villa: 110, chinese: 84, mansion: 124, castle: 150 };
  const THUMB = {
    crop(k, o, w, h) { frameFoot(1, 1, 34, w, h, 2.6); tile(0, 0, '#9a6a44'); drawCropTile(0, 0, fakeField(k, o.stage === undefined ? 4 : o.stage), 0, 1); },
    tree(k, o, w, h) {
      const z = frameFoot(1, 1, 52, w, h, 2), c = iso(0.5, 0.5), st = o.stage === undefined ? 2 : o.stage;
      ellipse(c.x, c.y, 26 * z, 12 * z, '#b8dd8c');
      const d = TREES[k];
      drawFruitTree({ k, planted: now() - d.grow * MIN * [0.1, 0.7, 2][st], last: now() - d.every * MIN * (o.fruit ? 1.2 : 0.2) }, c.x, c.y, z, 0, 1);
    },
    animal(k, o, w, h) {
      const z = frameFoot(1, 1, 26, w, h, 2.4), c = iso(0.5, 0.6);
      ellipse(c.x, c.y, 30 * z, 14 * z, '#b8dd8c');
      drawAnimal(k, o.stage === undefined ? 2 : o.stage, c.x, c.y, z * 1.25, { face: 1, ts: 0, seed: 1 });
    },
    // A corner of a community, in its own look: lawn, a house and its kind of trees (for the world map).
    commune(k, o, w, h) {
      const saved = PAL, th = TOWN_THEMES[COMMUNITIES[k].theme];
      PAL = th;
      const [fx, fy, fw, fd] = HOUSES[1].fp, S2 = Math.max(fw, fd) + 2.4;
      frameFoot(S2, S2, 70, w, h, 1.6);
      flatRect(-0.2, -0.2, S2 + 0.4, S2 + 0.4, th.town);
      if (th.snow) flatRect(-0.2, -0.2, S2 + 0.4, S2 + 0.4, 'rgba(250,252,255,.5)');
      drawWildTree(0.4, S2 - 0.3, 0.9, 0); drawWildTree(S2 - 0.3, 0.5, 0.3, 0);
      drawHouse({ id: 'x', house: 1, wall: '#f4e7cc', roof: { maple: '#c0453a', sakura: '#e88bb7', autumn: '#c9532a', palm: '#38a3e0', snow: '#3f6fb5', desert: '#d98a2e', lavender: '#8a6cc4', tulip: '#e5484d', bamboo: '#4f8c45', fjord: '#c0453a' }[COMMUNITIES[k].theme], extra: {}, ups: [], room: { items: [] } }, 1.2 - fx, 1 - fy, 0);
      drawWildTree(S2 - 0.4, S2 - 0.2, 0.7, 0);
      PAL = saved;
    },
    // A pet, big and alive (the pet page draws this every frame), or a breed in the shop.
    pet(k, o, w, h) {
      cam = { x: 0, y: 0, z: 1 };
      const B = PET_BREEDS[k] || PET_BREEDS.shiba, s = h / (o.big ? 34 : 30);
      if (o.bg) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, o.bg[0]); g.addColorStop(1, o.bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
      ellipse(w / 2, h * 0.86, w * 0.26, h * 0.06, 'rgba(90,70,40,.12)');
      drawAnimal(B.kind, o.stage === undefined ? 2 : o.stage, w / 2 - 1.5 * s, h * 0.86, s, { face: o.face || 1, ts: o.ts || 0, seed: 1, breed: k, mood: o.mood || 'happy', moving: !!o.moving, phase: o.phase || 0 });
    },
    good(k, o, w, h) { ctx.font = `${h * 0.6}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((GOODS[k] || CROPS[k]).e, w / 2, h / 2); },
    furn(k, o, w, h) {
      const D = FURN[k];
      frameFoot(D.w, D.d, 50, w, h, 2);
      flatRect(-0.1, -0.1, D.w + 0.2, D.d + 0.2, 'rgba(0,0,0,.05)');
      drawFurn({ k, rot: 0, tint: o.tint || (D.tint ? TINTS[4] : null) }, 0, 0, 1000);
    },
    yard(k, o, w, h) {
      const D = YARD[k], tall = ['tree', 'pine', 'lamp', 'swing', 'windmill', 'scarecrow', 'arch', 'well', 'hammock', 'slide'].includes(k);
      frameFoot(D.w, D.d, tall ? 56 : 30, w, h, 2);
      flatRect(-0.05, -0.05, D.w + 0.1, D.d + 0.1, '#b6e092');
      drawYardItem({ k, rot: 0, placed: now() }, 0, 0, 1000);
    },
    car(k, o, w, h) { if (CARS[k].kind === 'two') frameFoot(1, 1.6, 30, w, h, 2.8); else frameFoot(1.1, 2.5, 34, w, h, 2); drawCar({ k, color: o.color || CAR_COLORS[0] }, 0, 0, 0); },
    house(k, o, w, h) {
      const H = HOUSES[k], [fx, fy, fw, fd] = H.fp, ex = o.extra || 0;
      frameFoot(fw + 0.6, fd + 0.6, HOUSE_H[H.id] + ex * (H.id === 'chinese' ? 38 : FLOOR_H), w, h, 1.6);
      drawHouse({ house: k, wall: o.wall || WALL_COLORS[H.id === 'cabin' ? 6 : 1], roof: o.roof || ROOF_COLORS[0], extra: { [k]: ex } }, -fx + 0.2, -fy + 0.1, 0);
    },
    // Pictures for the first screens (onboarding): 0 sleep → energy, 1 moving → coins, 2 home and friends.
    story(k, o, w, h) {
      const ts = o.ts || 0, s = h / 75;
      cam = { x: 0, y: 0, z: 1 };
      ellipse(w / 2, h * 0.86, w * 0.42, h * 0.1, 'rgba(120,170,80,.35)');
      if (k == 0) {
        drawPerson(w * 0.27, h * 0.84, s * 1.25, { look: o.look, face: 1, energy: 'exhausted', ts, seed: 1, pose: 'sit' });
        drawPerson(w * 0.73, h * 0.84, s * 1.25, { look: o.look, face: -1, energy: 'great', ts, seed: 2, pose: 'jacks' });
        ctx.font = `bold ${22 * s}px ${UI_FONT},${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ef7d3c'; ctx.fillText('→', w / 2, h * 0.55);
        emoji('😴', w * 0.18, h * 0.3, 20 * s, 0.5 + Math.sin(ts / 500) * 0.3); emoji('✨', w * 0.85, h * 0.28, 18 * s, 0.6 + Math.sin(ts / 300) * 0.4);
      } else if (k == 1) {
        drawPerson(w * 0.36, h * 0.86, s * 1.3, { look: o.look, face: 1, energy: 'great', ts, seed: 1, moving: true, phase: ts / 90, pose: 'run' });
        ['🪙', '🪵', '🪙', '🌱'].forEach((e, i) => {
          const u = ((ts / 1600) + i / 4) % 1;
          emoji(e, w * (0.6 + i % 2 * 0.17), h * (0.8 - u * 0.55), (13 + i % 2 * 3) * s, Math.min(1, (1 - u * u * u) * 1.4));
        });
      } else {
        const z = Math.min(w * 0.95 / (13.2 * 32), h * 0.92 / (13.2 * 16 + 80));
        cam = { x: 0, y: 0, z };
        const c = iso(3.6, 2.6); cam.x = w * 0.5 - c.x; cam.y = h * 0.66 - c.y;
        flatRect(-0.3, -0.3, 7.6, 5.6, '#b8dd8c');
        drawHouse({ house: 2, wall: WALL_COLORS[1], roof: ROOF_COLORS[0] }, -1.5, -0.8, ts);
        [0, 1, 2].forEach(i => drawCropTile(4.2 + i, 3.6, fakeField(['carrot', 'wheat', 'tomato'][i], 4), ts, i));
        const a = iso(1.2, 4.4), b = iso(6.6, 2.2);
        drawPerson(a.x, a.y, z * 1.1, { look: o.look, face: 1, energy: 'good', ts, seed: 1, wave: true });
        drawPerson(b.x, b.y, z * 1.1, { look: { shirt: '#ec6aa8', skin: SKINS[0], hair: 'long', hairCol: '#2b1d14', mob: 'walk' }, face: -1, energy: 'good', ts, seed: 2, wave: true });
      }
    },
    // Round avatar: head and shoulders, big enough to stay sharp in the HUD and lists.
    face(k, o, w, h) {
      cam = { x: 0, y: 0, z: 1 };
      const s = h / 22, g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#fff6e8'); g.addColorStop(1, '#ffe2c2');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      drawPerson(w / 2 - 0.4 * s, h * 0.52 + 30 * s, s, { look: o.look, face: 1, energy: o.energy || 'good', ts: 0, seed: 0 });
    },
    person(k, o, w, h) {
      cam = { x: 0, y: 0, z: 1 };
      drawPerson(w / 2, h * 0.9, h * 0.78 / 46, { look: o.look, face: 1, energy: o.energy || 'good', ts: o.ts || 0, seed: 0, moving: !!o.moving, phase: o.phase || 0, pose: o.pose });
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
    orchard(k, o, w, h) {
      const z = frameFoot(2, 1, 50, w, h, 1.6);
      flatRect(0, 0, 2, 1, '#9fd07a');
      [['apple', 0.5], ['peach', 1.5]].forEach(([tk, x]) => { const c = iso(x, 0.5), d = TREES[tk]; drawFruitTree({ k: tk, planted: now() - d.grow * MIN * 2, last: now() - d.every * MIN * 1.5 }, c.x, c.y, z, 0, x); });
    },
    pond(k, o, w, h) { frameFoot(3, 2, 20, w, h, 1.6); flatRect(-0.2, -0.2, 3.4, 2.4, '#b8dd8c'); drawPond(0, 0, 3, 2, 4, 0); },
  };
  function thumb(kind, k, o = {}, w = 120, h = 96) {
    const id = kind + ':' + k + ':' + JSON.stringify(o) + ':' + w + 'x' + h;
    if (thumbCache.has(id) && !o.live) return thumbCache.get(id);
    const c = o.canvas || document.createElement('canvas'), dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
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
    // First screens: drift over the street at zoom z (false to stop).
    attract(z) {
      const was = attract;
      attract = z ? { z } : false;
      if (!z || was) return;
      useCam(); fly = null; follow = false; worldReady = true;
      if (W) { cam.z = z; const t = performance.now() / 1000; centerOn(60 + Math.sin(t / 9) * 22, 24 + Math.cos(t / 11) * 12); }
    },
    // Close-up on your townie (character creation): townie at yFrac of the screen height.
    focusMe(z, yFrac = 0.42) {
      attract = false; useCam(); cancel(me);
      const [, fy, , fd] = HOUSES[S.me.house].fp;
      me.lot = 'me'; me.x = DOOR_X; me.y = fy + fd + 1.3; me.face = 1;   // stand on the path in front of the door
      const [ox, oy] = origin('me');
      cam.z = z; centerOn(ox + me.x - 0.5, oy + me.y - 0.5, yFrac); fly = null; follow = false; worldReady = true;
    },
    // Screen position of things on your own lot, for the tutorial pointer (null when not visible).
    where(kind, arg) {
      if (mode !== 'home' || owner !== 'me' || !W) return null;
      useCam();
      const [ox, oy] = origin('me'), z = cam.z;
      let p, r = 24 * z;
      if (kind === 'field') { const [x, y] = fieldPos(arg); p = iso(ox + x + 0.5, oy + y + 0.5); p.y -= 8 * z; r = 30 * z; }
      else if (kind === 'ground') p = iso(ox + arg[0], oy + arg[1]);
      else if (kind === 'house') { const [fx, fy, w, d] = HOUSES[S.me.house].fp; p = iso(ox + fx + w / 2, oy + fy + d / 2); p.y -= 26 * z; r = 56 * z; }
      else if (kind === 'me') { p = iso(ox + me.x, oy + me.y); p.y -= 20 * z; }
      if (!p || p.x < 0 || p.y < 0 || p.x > W || p.y > H) return null;
      return { x: p.x, y: p.y, r: Math.max(20, r) };
    },
    levelChanged() { meIn.lv = -1; meIn.anim = null; floorFade = performance.now(); },
    // Pinching out past the whole town calls this (the app opens the world map).
    onWorldOut(fn) { onWorldOut = fn; },
    // After moving your home to another street: stand at your new gate.
    moveHome() { cancel(me); me.lot = 'me'; me.x = DOOR_X; me.y = 12.5; me.face = 1; delete homeCams.me; },
    takeStairs,
    onStairs: () => !!meIn.anim,
    setView(m, o = 'me') {
      if (m === mode && o === owner) return;
      const wasInterior = mode === 'interior';
      if ((m === 'home') !== (mode === 'home') && m !== 'interior' && !wasInterior) viewFade = performance.now();   // a soft flash between the town and a home
      mode = m; owner = o; edit = null;
      cv.style.background = m === 'interior' ? '#eadfcd' : '';
      if (m !== 'town' && m !== 'interior') moveToLot(o);
      useCam();
      if (m === 'interior') { meIn.room = null; if (!wasInterior) frameView(true); }
      else if (!wasInterior) frameView(false);
      follow = !!S.live && m === 'home' && o === me.lot;
    },
    view: () => ({ mode, owner }),
    tapAt: () => lastTap,
    recenter() { if (!W) return; useCam(); if (mode === 'interior') frameView(true); else if (mode === 'home' && S.live) follow = true; else frameView(false); },
    startEdit(scope) { edit = { scope, hold: null, sel: null }; cancel(me); },
    stopEdit() { edit = null; },
    getEdit: () => edit,
    hold(item) { if (edit) { edit.hold = item; edit.sel = null; } },
    select(id) { if (edit) edit.sel = id; },
    go, goMany, flee, cancel: () => { cancel(me); cancel(meIn); },
    busy: () => me.jobs.length + (me.cur ? 1 : 0),
    wave(who) {
      const t0 = performance.now() + 1800;
      if (who === 'me') { me.wave = t0; meIn.wave = t0; return; }
      const e = ents.get((mode === 'interior' ? 'in:' : 'p:') + who); if (e) e.wave = t0;
    },
    floatLocal(x, y, text) { floatLocal(me.lot, x, y, text); },
    floatField(i, text, lot = me.lot) { const [x, y] = fieldPos(i); floatLocal(lot, x + 0.5, y + 0.5, text); },
    floatAnimal(hid, aid, text) { const e = ents.get(hid + ':' + aid); if (e) floatLocal(hid, e.x, e.y, text); },
    floatMe(text) {
      if (mode === 'interior') floats.push({ text, wx: meIn.x, wy: meIn.y, inside: true, born: performance.now() });
      else floatLocal(me.lot, me.x, me.y, text);
    },
    floatHouse(text) { const [fx, fy, w, d] = HOUSES[S.me.house].fp; floatLocal('me', fx + w / 2, fy + d / 2, text); },
    thumb,
    debug: () => ({ cam: { ...cam }, W, H, mode, owner, edit, ents: ents.size, me: { x: me.x, y: me.y, lot: me.lot, jobs: me.jobs.length, cur: !!me.cur, act: me.act && me.act.pose, pose: mePose() }, meIn: { x: meIn.x, y: meIn.y, pose: meIn.act && meIn.act.pose } }),
    look(z, wx, wy) { useCam(); cam.z = z; centerOn(wx, wy); fly = null; follow = false; },
    bench(n = 20) { const t0 = performance.now(); for (let i = 0; i < n; i++) render(t0 + i * 16); return +((performance.now() - t0) / n).toFixed(2); },
  };
})();
