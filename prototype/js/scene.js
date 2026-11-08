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
  let edit = null, hover = null, UI_EDIT_SEL = null;   // UI_EDIT_SEL (v0.24): 'house' or an area picked in design mode
  let rankCache = { t: 0, total: 0 };
  const WOODS = 14, WX0 = WORLD.x0 - WOODS, WY0 = WORLD.y0 - WOODS, WX1 = WORLD.x1 + WOODS, WY1 = WORLD.y1 + WOODS;
  // The town plan on screen (v0.12: every community has its own; see LAYOUTS in data.js). Set every frame.
  let TL = layoutOf(HOME_TOWN);
  const ZOOM = { world: [0.045, 2.4], interior: [0.5, 2.8] };
  const GH = LOT_D + 2;                      // a lot plus the road in front
  const gwOf = h => homeW(h) + 1;            // ... and the side path
  const far = () => cam.z < 0.2;             // zoomed far out: simple houses, no animals or people
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const SEAT = { spinbike: 9, treadmill: 5 };                                   // standing / riding on a machine
  const SEAT_H = { sofa: 8.5, armchair: 8.5, chair: 10.5, rocker: 9, beanbag: 4.5 }; // seat height: hips here (sinking into soft cushions), feet on the floor
  const LIE_H = { bed: 13.5, singlebed: 12.5, bunkbed: 14.5, sleepbag: 6 };      // lying: on top of the mattress
  const LIE_HEAD = { bed: 0.38, singlebed: 0.36, bunkbed: 0.36, sleepbag: 0.3 };  // where the head goes (on the pillow)
  // Which way your head points when lying: towards the pillow (the back of the bed).
  const lieDir = it => (it ? (it.rot ? Math.atan2(-16, -32) : Math.atan2(-16, 32)) : 0);

  // Your townie outside (lot-local coordinates on lot `lot`) and inside (room coordinates).
  const me = { x: DOOR_X, y: 12.5, lot: 'me', path: [], face: 1, phase: 0, moving: false, jobs: [], cur: null, act: null, sneak: false };
  const meIn = { x: 1, y: 1, path: [], face: 1, phase: 0, moving: false, jobs: [], cur: null, act: null, sneak: false, room: null };

  const origin = id => lotOrigin(id);
  const cam0 = () => (mode === 'interior' ? roomCams[owner] : mode === 'shop' ? shopCams[owner] : mode === 'home' ? homeCams[owner] || worldCam : worldCam);
  const shopCams = {};
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
  function townCenter() { if (VIEW_TOWN !== townOf('me')) { const C = layoutOf(VIEW_TOWN).centre; return [C.x + C.w / 2, C.y + C.d + 2]; } const [ox, oy] = origin('me'); return [ox + 24, oy + 22]; }
  function flyTo(wx, wy, z, instant) {
    if (instant || !worldReady) { cam.z = z; centerOn(wx, wy); fly = null; worldReady = true; return; }
    fly = { wx, wy, z };
  }
  function frameView(instant) {
    if (mode === 'shop') { const P = shopPlan(owner); if (owner === 'cinema') { cam.z = clamp(W / (13 * 32), 0.55, 1.1); centerOn(P.RW * 0.36, P.RD * 0.42, 0.62); return; } cam.z = clamp(W / (12 * 32), 0.6, 1.3); centerOn(P.RW * 0.5, P.RD - 5, 0.5); return; }   // close enough to see prices, near the door (the cinema: the screen and the seats)
    if (mode === 'interior') {
      const [rw, rd] = roomSize(homeOf(owner));
      // the room fills the screen from side to side (its far corners just off the edges), sitting a bit low
      cam.z = clamp(W * 1.12 / ((rw + rd) * 32), 0.5, 2.2);
      centerOn(rw / 2, rd / 2, 0.6);
    } else if (mode === 'town') { const [cx, cy] = townCenter(); flyTo(cx, cy, townZoom(), instant); }
    else if (mode === 'home') { const [ox, oy] = origin(owner), h = homeOf(owner); cam.z = clamp(W / 460, minHomeZoom(), 2.4); centerOn(ox + 5, oy + 6.5, 0.5); cam.x -= Math.min(40, W * 0.08); fly = null; return; }   // house, fields and gate, a little left of the buttons
    else { const [cx, cy] = lotCenter(owner); flyTo(cx, cy, homeZoom(), instant); }
  }
  // Inside, and every home (it's its own little island), keeps its own camera; the town has one.
  const homeCams = {};
  function useCam() {
    if (mode === 'shop') { if (!shopCams[owner]) { shopCams[owner] = { x: 0, y: 0, z: 1 }; cam = shopCams[owner]; frameView(true); } cam = shopCams[owner]; return; }
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
    if (mode === 'shop') {   // keep yourself on screen while you walk round the store
      if (meS.moving && !dragging) { const p = iso(meS.x, meS.y), tx = clamp(p.x, 60, W - 60), ty = clamp(p.y, 170, H - 90); if (tx !== p.x || ty !== p.y) { const k = 1 - Math.exp(-dt * 3); cam.x += (tx - p.x) * k; cam.y += (ty - p.y) * k; } }
      return;
    }
    // the first screens: drift slowly over the street
    if (trip && !trip.arrived && mode === 'town' && !dragging && !trip.camFree) {   // on the way somewhere: the view goes with you (until you drag it, v0.29)
      const c = unIso(W / 2, H / 2), k = 1 - Math.exp(-dt * 4);
      if (cam.z < 0.42) cam.z += (0.5 - cam.z) * k;
      centerOn(c.x + (trip.x - c.x) * k, c.y + (trip.y - c.y) * k);
      return;
    }
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
    if (me.arriving && !me.path.length) me.arriving = false;   // walking in from the gate: the view stays put
    if (!follow && !fly && !dragging && mode === 'home' && me.lot === owner && me.moving && !me.arriving) {
      const [ox, oy] = origin(me.lot), p = iso(ox + me.x, oy + me.y);
      const tx = clamp(p.x, 50, W - 50), ty = clamp(p.y, 150, H - 70);
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
    if (mode === 'shop') { const P = shopPlan(owner), c = unIso(W / 2, H / 2), x = clamp(c.x, 0, P.RW), y = clamp(c.y, 0, P.RD); if (x !== c.x || y !== c.y) centerOn(x, y); return; }
    if (mode === 'interior') {   // the room stays on screen
      const [rw, rd] = roomSize(homeOf(owner)), c = unIso(W / 2, H / 2), x = clamp(c.x, 0, rw), y = clamp(c.y, 0, rd);
      if (x !== c.x || y !== c.y) centerOn(x, y);
      return;
    }
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
  function minHomeZoom() { const R = islandRect(owner); return clamp(W * 1.1 / ((R.x1 - R.x0 + R.y1 - R.y0) * 32), 0.25, 1); }
  // Inside: the smallest zoom still fills the screen from side to side.
  function minRoomZoom() { const [rw, rd] = roomSize(homeOf(owner)); return clamp(W * 0.95 / ((rw + rd) * 32), ZOOM.interior[0], 1.4); }
  function zoomAt(px, py, z) {
    const [lo, hi] = ZOOM[mode === 'interior' || mode === 'shop' ? 'interior' : 'world'];
    // pinching out past the whole town opens the world map
    if (mode === 'town' && z < cam.z && cam.z <= minWorldZoom() * 1.001 && z < minWorldZoom() * 0.96 && onWorldOut && performance.now() - worldOutAt > 1500) { worldOutAt = performance.now(); onWorldOut(); }
    z = clamp(z, mode === 'interior' ? minRoomZoom() : mode === 'shop' ? (() => { const P = shopPlan(owner); return clamp(W * 1.6 / ((P.RW + P.RD) * 32), 0.45, 1); })() : mode === 'home' ? minHomeZoom() : Math.max(lo, minWorldZoom()), hi);
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
    if (h.pondLv) { const P = areaOf(h, 'pond'); block(P.x, P.y, P.w, P.d); }
    if (h.garageLv) { const G = areaOf(h, 'garage'); block(G.x, G.y, G.w, G.d); }
    h.trees.forEach((t, i) => { if (t && i < orchardSlots(h)) { const [sx, sy] = orchardSlot(h, i); block(sx, sy, 1, 1); } });
    h.fields.forEach((f, i) => { const [x, y] = fieldPos(i, h); block(x, y, 1, 1); });   // farmland is not for walking on
    h.yard.forEach(it => { const [w2, d2] = itemSize('yard', it); block(it.x, it.y, w2, d2); });
    carSlots(h).drive.forEach(([i, sp]) => { if (!(h.id === 'me' && i === h.car && S.carAt)) block(Math.floor(sp[0] - 0.5), Math.floor(sp[1] - 1), 1, 2); });
    block(MAILBOX[0], MAILBOX[1], 1, 1);
    const wall = (ax, ay, bx, by) => {
      if (ax === bx && Math.min(ay, by) === LOT_D - 1 && Math.max(ay, by) === LOT_D) { const fr = driveOf(h).front; return !((ax >= fr[0] && ax < fr[1]) || ax === 3); }   // front fence, open at the drive and the path
      if (ay === by && Math.min(ax, bx) === LW - 1 && Math.max(ax, bx) === LW) return ay < LOT_D;                      // side fence
      if (pr && inRect(pr, ax, ay) !== inRect(pr, bx, by)) {
        const gy = pr.y + pr.d - 1;
        return !(ay === gy && by === gy && Math.min(ax, bx) === pr.x - 1);                                              // pasture gate
      }
      return false;
    };
    return { g, gw: GW, gh: GH, wall };
  }
  // v0.13: from the gate, can you still reach the house door, every field, the pasture gate, the pond, every fruit
  // tree, the mailbox and every yard thing? Placing (or moving) something in the yard must keep all of them reachable.
  function yardOK(h, yard) {
    const saved = h.yard;
    h.yard = yard;
    try {
      const N = lotNav(h), seen = new Uint8Array(N.gw * N.gh), q = [];
      const push = (x, y, px, py) => {
        if (x < 0 || y < 0 || x >= N.gw || y >= LOT_D || !N.g[y * N.gw + x] || seen[y * N.gw + x]) return;
        if (px !== undefined && N.wall(px, py, x, y)) return;
        seen[y * N.gw + x] = 1; q.push([x, y]);
      };
      push(3, LOT_D - 1);
      for (let k = 0; k < q.length; k++) { const [x, y] = q[k]; push(x + 1, y, x, y); push(x - 1, y, x, y); push(x, y + 1, x, y); push(x, y - 1, x, y); }
      const r = (x, y) => x >= 0 && y >= 0 && x < N.gw && y < LOT_D && !!seen[y * N.gw + x];
      // close enough to work on it: a reachable tile within the reach jobs use (2.2 tiles from the thing)
      const near = (x, y, w = 1, d = 1) => {
        for (let j = Math.floor(y) - 3; j < y + d + 3; j++) for (let i = Math.floor(x) - 3; i < x + w + 3; i++) {
          if (!r(i, j)) continue;
          const dx = Math.max(x - (i + 0.5), 0, i + 0.5 - (x + w)), dy = Math.max(y - (j + 0.5), 0, j + 0.5 - (y + d));
          if (Math.hypot(dx, dy) <= 2.2) return true;
        }
        return false;
      };
      const [fx, fy, w, d] = HOUSES[h.house].fp;
      if (!r(Math.floor(DOOR_X), fy + d)) return false;   // the front door
      if (!h.fields.every((f, i) => { const [x, y] = fieldPos(i, h); return near(x, y); })) return false;
      const pr = pastureRect(h);
      if (pr && !r(pr.x - 1, pr.y + pr.d - 1)) return false;
      if (h.pondLv) { const P = areaOf(h, 'pond'); if (!near(P.x, P.y, P.w, P.d)) return false; }
      if (!h.trees.every((t, i) => !t || i >= orchardSlots(h) || near(...orchardSlot(h, i)))) return false;
      if (!near(MAILBOX[0], MAILBOX[1])) return false;
      return yard.every(it => { const [w2, d2] = itemSize('yard', it); return near(it.x, it.y, w2, d2); });
    } finally { h.yard = saved; }
  }
  window.yardKeepsWay = yardOK;
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
  // Walking towards the camera or away from it (that includes along the ground's diagonals, the usual way):
  // a front or back 3/4 view, turned towards where we're going (a.turn −1…1). Only walking straight across the
  // screen shows the side. (Screen pixels: x = sx · 32, y = sy · 16.)
  // Which way someone faces while walking (v0.13): towards the camera or away from it, turned along the way they go
  // (turn = the walking direction on the ground). Only when walking almost straight across the screen: side-on.
  function faceTo(a, dx, dy) {
    const sx = dx - dy, sy = dx + dy, n = Math.hypot(dx, dy);
    if (Math.abs(sx) > 0.02) a.face = sx > 0 ? 1 : -1;
    if (Math.abs(sy) > 0.02) a.back = sy < 0;
    if (n > 0.01) {
      const across = Math.abs(sy) < Math.abs(sx) * 0.12;   // e.g. a diagonal step that's straight left or right on screen
      a.view = across ? null : sy > 0 ? 'front' : 'back';
      a.turn = across ? 0 : [dx / n, dy / n];
    }
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
    return { great: 2.6, good: 2.2, tired: 1.7, exhausted: 1.3 }[e] * (h.id === 'me' && S.sick ? SICK.walk : 1);   // ill: slower (v0.14)
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
  const SPEED = { chicken: 0.7, duck: 0.6, rabbit: 0.9, sheep: 0.45, goat: 0.55, pig: 0.45, cow: 0.35, alpaca: 0.4, rainbowalpaca: 0.4, dog: 1.3, cat: 0.9 };

  // ---------- live workouts ("mini me") ----------
  const roadLoop = h => { const w = homeW(h) + 0.4; return [[0.8, 14.7], [w, 14.7], [w, 15.4], [0.8, 15.4]]; };
  function liveSpot(type, h) {
    if (type === 'swim') {
      const pool = h.yard.find(it => it.k === 'pool');
      if (h.pondLv) { const P = areaOf(h, 'pond'); return { x: P.x + P.w / 2, y: P.y + P.d / 2, swim: 'pond' }; }
      if (pool) { const [w, d] = itemSize('yard', pool); return { x: pool.x + w / 2, y: pool.y + d / 2, swim: 'pool' }; }
      if (mode !== 'town') return { x: TUB.x, y: TUB.y, swim: 'tub' };   // at home (an island): an inflatable pool
      const [ox, oy] = origin(h.id);
      const [sx, sy] = swimSpot();
      return { x: sx - ox, y: sy - oy, swim: 'lake' };
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
    { const dv = driveOf(h);   // v0.24: the drive's design
      dv.rects.forEach(r => { flatRect(ox + r.x + 0.05, oy + r.y, r.w - 0.1, r.d, '#bdb6a8'); flatRect(ox + r.x + 0.15, oy + r.y + 0.08, r.w - 0.3, r.d - 0.08, '#d3ccbe'); });
      if (dv.st === 'curve') { const c = iso(ox + dv.x + 2, oy + dv.y + 2); ellipse(c.x, c.y, 0.9 * 45 * cam.z, 0.45 * 45 * cam.z, '#d3ccbe'); }
      if (cam.z > 0.4) dv.spots.forEach(([sx, sy]) => { const a = iso(ox + sx - 0.95, oy + sy - 1.3), b = iso(ox + sx - 0.95, oy + sy + 1.3), c2 = iso(ox + sx + 0.95, oy + sy - 1.3), d2 = iso(ox + sx + 0.95, oy + sy + 1.3); line(a.x, a.y, b.x, b.y, 'rgba(255,255,255,.55)', 0.8 * cam.z); line(c2.x, c2.y, d2.x, d2.y, 'rgba(255,255,255,.55)', 0.8 * cam.z); }); }
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
    } else if (opt.mine && f) { const p1 = PASTURE[1], A = areaOf(h, 'pasture'); dashed(A.x, A.y + A.d - p1.d, p1.w, p1.d); }
    if (h.orchardLv) {
      const O = areaOf(h, 'orchard');
      flatRect(ox + O.x, oy + O.y, O.w, O.d, '#9fd07a');
      if (f) ORCHARD_SLOTS.slice(0, orchardSlots(h)).map((_, i) => orchardSlot(h, i)).forEach(([sx, sy], i) => { if (!h.trees[i]) { const c = iso(ox + sx + 0.5, oy + sy + 0.5); ellipse(c.x, c.y, 12 * z, 6 * z, '#9a6a44'); } });
    } else if (opt.mine && f) { const O = areaOf(h, 'orchard'); dashed(O.x, O.y, O.w, O.d); }
    if (!h.pondLv && opt.mine && f) { const P = areaOf(h, 'pond'); dashed(P.x, P.y, P.w, P.d); }
    for (let i = 0; i < h.fields.length; i++) {
      const [x, y] = fieldPos(i, h);
      if (f) {
        tile(ox + x, oy + y, '#9a6a44', 'rgba(255,255,255,.22)');
        for (const v of [0.3, 0.55, 0.8]) { const a = iso(ox + x + 0.12, oy + y + v), b = iso(ox + x + 0.88, oy + y + v); line(a.x, a.y, b.x, b.y, 'rgba(70,40,20,.3)', 1.1 * z); }
      } else tile(ox + x, oy + y, '#9a6a44');
      const fl = h.fields[i];
      if (isFlooded(fl)) {   // v0.14: a flooded field: muddy water with ripples
        tile(ox + x + 0.04, oy + y + 0.04, 'rgba(96,140,170,.72)');
        if (f) { const c = iso(ox + x + 0.5, oy + y + 0.5), ph = (performance.now() / 1300 + i * 0.37) % 1; ellipse(c.x, c.y, (6 + ph * 14) * z, (3 + ph * 7) * z, null, `rgba(255,255,255,${0.5 * (1 - ph)})`, 1 * z); }
      } else if (weatherNow().kind === 'snow') tile(ox + x + 0.05, oy + y + 0.05, 'rgba(248,251,253,.55)');
    }
    if (opt.mine && f && h.fieldLv < FIELD_LEVELS.length - 1) { const F = areaOf(h, 'fields'); dashed(F.x, F.y + h.fields.length / 4, 4, 1); }
    if (f) for (let k = 0; k < 18 + (LW - LOT_W); k++) {
      const x = Math.floor(hash(k, 1 + ox) * LW), y = Math.floor(hash(k, 2 + oy) * LOT_D);
      if (yardReserved(x, y, LW, h)) continue;
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
        { const fr = driveOf(h).front; if (x !== 3 && !(x >= fr[0] && x < fr[1])) seg(x, LOT_D, x + 1, LOT_D); }
      }
      for (let y = 0; y < LOT_D; y++) { seg(0, y, 0, y + 1); if (!onPasture(LOT_W, y, LOT_W, y + 1)) seg(LOT_W, y, LOT_W, y + 1); }
      if (pr) {
        const gy = pr.y + pr.d - 1;
        for (let x = pr.x; x < pr.x + pr.w; x++) { seg(x, pr.y, x + 1, pr.y, 'rail'); seg(x, pr.y + pr.d, x + 1, pr.y + pr.d, 'rail'); }
        for (let y = pr.y; y < pr.y + pr.d; y++) { if (y !== gy) seg(pr.x, y, pr.x, y + 1, 'rail'); seg(pr.x + pr.w, y, pr.x + pr.w, y + 1, 'rail'); }
      }
    } else { seg(0, 0, LOT_W, 0); seg(0, 0, 0, LOT_D); seg(LOT_W, 0, LOT_W, LOT_D); }
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
      const dpr = Math.min(2, window.devicePixelRatio || 1), topPx = (HOUSE_H[H.id] || (H.spec ? specHouseH(H) : 120)) + ex * 40 + 50;
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
      h.fields.forEach((fl, i) => { if (!fl) return; const [x, y] = fieldPos(i, h); objs.push({ d: ox + oy + x + y + 1, f: () => cropRows(fl, ox + x, oy + y) }); });
      h.trees.forEach((t, i) => {
        if (!t || i >= orchardSlots(h)) return;
        const [sx, sy] = orchardSlot(h, i);
        objs.push({ d: ox + oy + sx + sy + 1, f: () => { const c = iso(ox + sx + 0.5, oy + sy + 0.5); circle(c.x, c.y - 26 * z, 15 * z, '#5aa04a'); circle(c.x - 4 * z, c.y - 30 * z, 8 * z, '#7cbf5a'); } });
      });
      if (h.pondLv) { const PP = areaOf(h, 'pond'); objs.push({ d: ox + oy + PP.x + PP.y + 0.5, f: () => drawPond(ox + PP.x, oy + PP.y, PP.w, PP.d, 0, ts) }); }
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
      const [x, y] = fieldPos(i, h);
      objs.push({ d: ox + oy + x + y + 1, f: () => {
        if (f) drawCropTile(ox + x, oy + y, fl, ts, i * 1.31 + ox);
        else cropRows(fl, ox + x, oy + y);
      } });
    });
    // orchard
    h.trees.forEach((t, i) => {
      if (!t || i >= orchardSlots(h)) return;
      const [sx, sy] = orchardSlot(h, i);
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
      const P = areaOf(h, 'pond');
      objs.push({ d: ox + oy + P.x + P.y + 0.5, f: () => {
        drawPond(ox + P.x, oy + P.y, P.w, P.d, fishCount(h), ts);
        if (focus) {
          hits.push({ kind: 'pond', owner: h.id, ...footRect(ox + P.x, oy + P.y, P.w, P.d, 6) });
          if (opt.mine && fishCount(h) >= 3) { const c = iso(ox + P.x + P.w / 2, oy + P.y + P.d / 2); opt.bubbles.push({ kind: 'pond', p: { x: c.x, y: c.y - 6 * z }, ch: '🎣', ok: true }); }
        }
      } });
    }
    // v0.19: the garage, with the cars that aren't in the drive parked inside
    if (h.garageLv) {
      const G = areaOf(h, 'garage'), inside = carSlots(h).garage.map(i => h.cars[i]);
      objs.push({ d: ox + oy + G.x + G.y + (G.w + G.d) / 2, f: () => { const r = drawGarage(ox + G.x, oy + G.y, garageCap(h), inside, ts); if (focus && r) hits.push({ kind: 'garage', owner: h.id, ...r }); } });
    }
    // car
    carSlots(h).drive.forEach(([i, sp]) => {   // v0.24: each car on its space on the drive (not the one you're out in)
      if (h.id === 'me' && i === h.car && (S.carAt || (trip && trip.inCar && !trip.arrived))) return;
      const c = h.cars[i];
      objs.push({ d: ox + oy + sp[0] + sp[1] + 0.2, f: () => { drawCarDir(c, ox + sp[0], oy + sp[1], '+y', ts); const q = iso(ox + sp[0], oy + sp[1]); if (focus) hits.push({ kind: 'car', owner: h.id, x0: q.x - 26 * cam.z, x1: q.x + 26 * cam.z, y0: q.y - 34 * cam.z, y1: q.y + 14 * cam.z }); } });
    });
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
          if (!opt.mine && babyStealable(h, a) && st === 0) opt.bubbles.push({ kind: 'animal', id: a.id, p: { x: p.x, y: p.y - 22 * z }, ch: '🍼', ok: true });   // v0.14
          if (animalReady(a)) {
            const d = ANIMALS[a.k], baby = nextIsBaby(a);
            if (opt.mine) opt.bubbles.push({ kind: 'animal', id: a.id, p: { x: p.x, y: p.y - 26 * z }, ch: baby ? '🍼' : GOODS[d.prod].e, ok: true });
            else if (isFriend(h.id) && !baby && d.prod && (a.stolen || 0) < d.n - 1 && !(a.thieves || []).includes('me')) opt.bubbles.push({ kind: 'animal', id: a.id, p: { x: p.x, y: p.y - 26 * z }, ch: '🖐️', ok: true });
          }
        }
      } });
    });
    // the owner (friends wander; you are drawn separately); not while they're out walking in town
    if (fine()) visitorObjs(h, ox, oy, objs, ts, dt, false, { nav: lotNav(h) }, focus);
    if (h.id !== 'me' && !(mode === 'town' && walkerOut(h.id)) && !visitingNow(h.id)) {
      const e = ent('p:' + h.id, () => ({ x: DOOR_X + 0.8, y: fy + hd + 1.2 }));
      const live = seesLive(h) ? h.live.type : null;
      e.pose = live ? doLive(e, live, h, dt, ts) : null;
      if (!live) { if (e.y >= LOT_D && !e.path.length) e.path = planPath(e, lotNav(h), 3.5, 12.5, 2) || []; wander(e, dt, speedOf(h), en => randomWalk(en, lotNav(h))); }
      objs.push({ d: ox + oy + e.x + e.y, f: () => {
        const p = iso(ox + e.x, oy + e.y);
        drawPerson(p.x, p.y, z, { look: h.look, face: e.face, back: e.back && !e.wave, view: e.wave > performance.now() ? null : e.view, turn: e.turn, moving: e.moving, phase: e.phase, energy: friendEnergy(h), ts, seed: ox * 0.1, pose: e.pose || undefined, wave: e.wave > performance.now() });
        if (live && f) liveBadge(p, h.live, false);
        else if (focus && z > 0.55) nameTag(p, homeName(h), isOnline(h.id));
        if (focus) hits.push({ kind: 'avatar', owner: h.id, x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 44 * z, y1: p.y + 4 * z });
      } });
    }
    if (me.lot === h.id && !meInLake() && (mode === 'town' ? !(trip && !trip.arrived) && !S.out : h.id !== 'me' || !S.out) && !S.work && !S.live && !jailed()) objs.push({ d: ox + oy + me.y + me.x, f: () => drawMe(ox, oy, ts, focus) });
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
    drawPerson(p.x, p.y, z, { look: S.me.look, face: me.face, back: me.back && (me.moving || !!me.livePose), view: me.act ? null : me.view, turn: me.turn, moving: me.moving, phase: me.phase, energy: energyLevel(), ts, seed: 3, pose, wave: me.wave > performance.now() });
    if (S.live) liveBadge(p, S.live, true);
    if (focus) hits.push({ kind: 'avatar', owner: 'me', x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 44 * z, y1: p.y + 4 * z });
    if (mode === 'home' && !S.live && (me.jobs.length || me.cur)) {   // little marker on where you're heading
      const n = me.jobs.length + (me.cur ? 1 : 0);
      if (n > 1) pill(`×${n}`, p.x + 16 * z, p.y - 40 * z, 'rgba(76,175,106,.95)', '#fff', `bold 11px ${UI_FONT}`, 18);
    }
  }

  // ---------- the world ----------
  // Roads: street (2 wide, dashed centre line), avenue (3 wide, double yellow line), dirt (country road).
  // Roads (v0.13): a paved sidewalk along both sides (people walk there), the asphalt between, lane lines, and a
  // zebra crossing where a road meets another. Drawn in passes so crossings join up cleanly.
  const SIDEWALK = { avenue: 0.5, street: 0.42, lane: 0.36, dirt: 0 };
  function drawRoads(vr) {
    const z = cam.z, vis = r => !(r[2] < vr.x0 || r[0] > vr.x1 || r[3] < vr.y0 || r[1] > vr.y1), roads = TL.roads.filter(vis);
    // v0.27: one-way arrows (white, every few tiles, pointing the way to go)
    const arrows = () => roads.forEach(r => {
      const ow = r[5]; if (!ow || z < 0.18) return;
      const h = horiz(r), a0 = h ? r[0] : r[1], a1 = h ? r[2] : r[3], m = h ? (r[1] + r[3]) / 2 : (r[0] + r[2]) / 2, P = (u, v) => (h ? iso(u, m + v) : iso(m + v, u));
      for (let u = a0 + 2.2; u < a1 - 2; u += 4.5) {
        const b = u + 0.9 * ow, tip = u + 1.6 * ow;
        poly([P(u, -0.13), P(b, -0.13), P(b, -0.38), P(tip, 0), P(b, 0.38), P(b, 0.13), P(u, 0.13)], 'rgba(255,255,255,.9)');
      }
    });
    const horiz = r => r[2] - r[0] >= r[3] - r[1];
    roads.forEach(([x0, y0, x1, y1, kind]) => {   // pavement (or the dirt road's edges)
      flatRect(x0, y0, x1 - x0, y1 - y0, kind === 'dirt' ? '#c9ad80' : '#ddd6c8');
    });
    roads.forEach(r => {   // asphalt
      const [x0, y0, x1, y1, kind] = r, sw = SIDEWALK[kind] || 0.35, h = horiz(r);
      if (kind === 'dirt') { if (h) flatRect(x0, y0 + 0.35, x1 - x0, y1 - y0 - 0.7, '#d6bf95'); else flatRect(x0 + 0.35, y0, x1 - x0 - 0.7, y1 - y0, '#d6bf95'); return; }
      const col = kind === 'avenue' ? '#80878f' : '#8e959c';
      if (h) flatRect(x0, y0 + sw, x1 - x0, y1 - y0 - 2 * sw, col); else flatRect(x0 + sw, y0, x1 - x0 - 2 * sw, y1 - y0, col);
    });
    if (z < 0.1) return;
    roads.forEach(r => {   // paving joints and the kerb
      const [x0, y0, x1, y1, kind] = r, sw = SIDEWALK[kind];
      if (!sw || z < 0.3) return;
      const h = horiz(r), lo = Math.max(h ? x0 : y0, Math.floor(h ? vr.x0 : vr.y0)), hi = Math.min(h ? x1 : y1, h ? vr.x1 : vr.y1);
      for (const e of h ? [y0 + sw, y1 - sw] : [x0 + sw, x1 - sw]) { const A = h ? iso(lo, e) : iso(e, lo), B = h ? iso(hi, e) : iso(e, hi); line(A.x, A.y, B.x, B.y, 'rgba(120,110,95,.45)', 1.2 * z); }
      for (let u = Math.ceil(lo); u < hi; u += 1) for (const [p, q] of h ? [[y0, y0 + sw], [y1 - sw, y1]] : [[x0, x0 + sw], [x1 - sw, x1]]) {
        const A = h ? iso(u, p) : iso(p, u), B = h ? iso(u, q) : iso(q, u); line(A.x, A.y, B.x, B.y, 'rgba(150,140,120,.3)', 0.8 * z);
      }
    });
    arrows();
    roads.forEach(r => {   // lane lines
      const [x0, y0, x1, y1, kind] = r;
      if (kind === 'dirt' || r[5]) return;
      const h = horiz(r), [a0, a1, b0, b1] = h ? [x0, x1, y0, y1] : [y0, y1, x0, x1], m = (b0 + b1) / 2;
      const lo = Math.max(a0, Math.floor(h ? vr.x0 : vr.y0)), hi = Math.min(a1, h ? vr.x1 : vr.y1);
      const seg = (p, q, off, col, lw) => { const A = h ? iso(p, m + off) : iso(m + off, p), B = h ? iso(q, m + off) : iso(m + off, q); line(A.x, A.y, B.x, B.y, col, lw * z); };
      if (kind === 'avenue') { seg(lo, hi, -0.06, '#f2c230', 1.3); seg(lo, hi, 0.06, '#f2c230', 1.3); }
      else for (let p = Math.ceil(lo) + 0.3; p < hi; p += 1) seg(p, p + 0.45, 0, 'rgba(255,255,255,.85)', 1.6);
    });
    if (z < 0.25) return;
    // zebra crossings: across each road just beside every road that joins it
    // (v0.29: across a paved road beside a country road too, and at a road's dead end: people only cross on these)
    roads.forEach(a => {
      if (!horiz(a)) return;
      roads.forEach(b => {
        if (horiz(b) || b[2] < a[0] - 0.5 || b[0] > a[2] + 0.5 || b[3] < a[1] - 0.5 || b[1] > a[3] + 0.5) return;
        if (a[4] !== 'dirt') { const swA = SIDEWALK[a[4]], y0 = a[1] + swA, y1 = a[3] - swA;
          [b[0] - 0.75, b[2] + 0.15].forEach(x => { if (x < a[0] || x + 0.6 > a[2]) return; for (let k = 0; k < 5; k++) { const yy = y0 + (y1 - y0) * (k + 0.2) / 5; flatRect(x, yy, 0.6, (y1 - y0) / 5 * 0.55, 'rgba(255,255,255,.8)'); } }); }
        if (b[4] !== 'dirt') { const swB = SIDEWALK[b[4]], x0 = b[0] + swB, x1 = b[2] - swB;
          [a[1] - 0.75, a[3] + 0.15].forEach(y => { if (y < b[1] || y + 0.6 > b[3]) return; for (let k = 0; k < 5; k++) { const xx = x0 + (x1 - x0) * (k + 0.2) / 5; flatRect(xx, y, (x1 - x0) / 5 * 0.55, 0.6, 'rgba(255,255,255,.8)'); } }); }
      });
    });
    footNet().deadEnds.forEach(D => {
      if (D.h ? D.x < vr.x0 - 1 || D.x > vr.x1 + 1 : D.y < vr.y0 - 1 || D.y > vr.y1 + 1) return;
      for (let k = 0; k < 5; k++) {
        if (D.h) { const yy = D.y0 + (D.y1 - D.y0) * (k + 0.2) / 5; flatRect(D.x - 0.3, yy, 0.6, (D.y1 - D.y0) / 5 * 0.55, 'rgba(255,255,255,.8)'); }
        else { const xx = D.x0 + (D.x1 - D.x0) * (k + 0.2) / 5; flatRect(xx, D.y - 0.3, (D.x1 - D.x0) / 5 * 0.55, 0.6, 'rgba(255,255,255,.8)'); }
      }
    });
  }
  // v0.19: every store's car park and the car parks by the other places
  function carParks(vr) {
    (TL.stores || []).forEach(st => { const G = storeGeo(st), [x, y, w, d] = G.c; if (boxVisible(x, y, x + w, y + d, vr)) drawCarPark(G.c, G.along); });
    (TL.parks || []).forEach(([, x, y, w, d, f]) => { if (boxVisible(x, y, x + w, y + d, vr)) drawCarPark([x, y, w, d], f === 'E' || f === 'W' ? 'y' : 'x', { sign: true }); });
  }
  const inRectXY = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const inLake = (x, y) => ((x - TL.lake.x) / (TL.lake.rx + 1)) ** 2 + ((y - TL.lake.y) / (TL.lake.ry + 1)) ** 2 < 1;
  // Something built is here (no wild trees): streets and their lots, roads, the town centre, the park, the lake, the fields.
  function occupied(x, y) {
    for (const st of Object.values(TL.streets)) if (inRectXY(x, y, st.x - 1, st.y - 1, st.x + st.n * PARCEL + 1, st.y + LOT_D + 1)) return true;
    for (const r of TL.roads) if (inRectXY(x, y, r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1)) return true;
    for (const r of TL.water) if (inRectXY(x, y, r[0] - 1, r[1] - 1, r[2] + 1, r[3] + 1)) return true;
    const P = TL.park, C = TL.centre;
    if ([...(TL.stores || []), ...(TL.parks || [])].some(([, sx, sy, sw, sd]) => inRectXY(x, y, sx - 1, sy - 1, sx + sw + 1, sy + sd + 1))) return true;   // v0.17, v0.19 car parks
    if (inRectXY(x, y, C.x - 0.5, C.y - 1, C.x + C.w + 0.5, C.y + C.d + 1) || inRectXY(x, y, P.x - 1, P.y - 1, P.x + P.w + 1, P.y + P.d + 1)) return true;
    for (const F of TL.fields) if (inRectXY(x, y, F.x - 1, F.y - 1, F.x + F.w + 1, F.y + F.d + 1)) return true;
    const m = TL.lake.sea ? 5.5 : 3;
    if (curveSamples().list.some(c => c.s.some(p => Math.abs(p[0] - x) < 1.8 && Math.abs(p[1] - y) < 1.8))) return true;   // v0.15
    return ((x - TL.lake.x) / (TL.lake.rx + m)) ** 2 + ((y - TL.lake.y) / (TL.lake.ry + m)) ** 2 < 1;
  }
  // Wild trees, rocks and bushes: thick woods around the town, a few trees on the open grass inside it. Computed once.
  let SCENERY = null, SCENERY_ID = '';
  function scenery() {
    if (SCENERY && SCENERY_ID === TL.id) return SCENERY;
    SCENERY = []; SCENERY_ID = TL.id;
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
    for (let x = WX0 - 6; x < WX1 + 10; x += 15) PEAKS.push({ x: x + hash(x, 1) * 6, y: WY0 - 16 + hash(x, 2) * 5, r: 9 + hash(x, 3) * 6, h: 150 + hash(x, 4) * 140 });
    for (let y = WY0 + 8; y < WY1 + 6; y += 15) PEAKS.push({ x: WX0 - 16 + hash(y, 5) * 5, y: y + hash(y, 6) * 6, r: 9 + hash(y, 7) * 6, h: 150 + hash(y, 8) * 140 });
    return PEAKS;
  }
  function mountains(objs, vr) {
    const K = TL.lake;
    peaks().forEach(m => {
      if (m.x < vr.x0 - 20 || m.x > vr.x1 + 20 || m.y < vr.y0 - 20 || m.y > vr.y1 + 20) return;
      if (((m.x - K.x) / (K.rx + m.r + 4)) ** 2 + ((m.y - K.y) / (K.ry + m.r + 4)) ** 2 < 1) return;   // no mountains in the sea
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
  // Rivers and canals (water rectangles of the town plan): banks, water and a slow current along the long side.
  function river(vr) {
    const now2 = performance.now();
    TL.water.forEach(([x0, y0, x1, y1]) => {
      if (!boxVisible(x0, y0, x1, y1, vr)) return;
      const horiz = x1 - x0 > y1 - y0;
      if (horiz) flatRect(x0, y0 - 0.4, x1 - x0, y1 - y0 + 0.8, '#c9b88f'); else flatRect(x0 - 0.4, y0, x1 - x0 + 0.8, y1 - y0, '#c9b88f');
      flatRect(x0, y0, x1 - x0, y1 - y0, '#5aa7d6');
      if (horiz) flatRect(x0, y0 + (y1 - y0) * 0.3, x1 - x0, (y1 - y0) * 0.4, 'rgba(255,255,255,.07)'); else flatRect(x0 + (x1 - x0) * 0.3, y0, (x1 - x0) * 0.4, y1 - y0, 'rgba(255,255,255,.07)');
      if (cam.z <= 0.12) return;
      const lo = Math.max(horiz ? x0 : y0, Math.floor(horiz ? vr.x0 : vr.y0)), hi = Math.min(horiz ? x1 : y1, horiz ? vr.x1 : vr.y1);
      for (let u = Math.floor(lo / 3) * 3; u < hi - 1; u += 3) for (const f of [0.3, 0.7]) {
        const v = u + ((now2 / 900 + f * 1.7) % 3), w = horiz ? y0 + (y1 - y0) * f : x0 + (x1 - x0) * f;
        if (v < lo || v > hi - 0.8) continue;
        const a = horiz ? iso(v, w) : iso(w, v), b = horiz ? iso(v + 0.8, w) : iso(w, v + 0.8);
        line(a.x, a.y, b.x, b.y, 'rgba(255,255,255,.55)', 1.2 * cam.z);
      }
    });
  }
  // ---------- curved roads and the expressway (v0.15) ----------
  // A smooth line through the points (Catmull-Rom), sampled every ~0.6 tiles; each point may carry a height.
  function smoothPts(pts, step = 0.6) {
    const out = [], P = i => pts[Math.max(0, Math.min(pts.length - 1, i))];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) {
        const t2 = k / n, t3 = t2 * t2, t4 = t3 * t2, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t2 + (2 * a - 5 * b + 4 * c - d) * t3 + (-a + 3 * b - 3 * c + d) * t4);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), p1[2] === undefined ? 0 : p1[2] + (p2[2] - p1[2]) * t2]);
      }
    }
    const L = pts[pts.length - 1]; out.push([L[0], L[1], L[2] || 0]);
    return out;
  }
  // A strip of road along the points, lying flat on the ground (or raised to each point's height).
  function strip(S2, w, col, lift = 0) {
    const z = cam.z;
    for (let i = 0; i < S2.length - 1; i++) {
      const a = S2[i], b = S2[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * w / 2, ny = dx / L * w / 2, ex = dx / L * 0.06, ey = dy / L * 0.06;
      const P = (p, sx, sy, h) => up(iso(p[0] + sx, p[1] + sy), (h + lift) * z);
      poly([P(a, nx - ex, ny - ey, a[2]), P(b, nx + ex, ny + ey, b[2]), P(b, -nx + ex, -ny + ey, b[2]), P(a, -nx - ex, -ny - ey, a[2])], col);
    }
  }
  let CURVE_CACHE = { id: '', list: [] };
  function curveSamples() {
    if (CURVE_CACHE.id !== TL.id) CURVE_CACHE = { id: TL.id, list: (TL.curves || []).map(c => ({ w: c.w, s: smoothPts(c.pts) })), park: TL.parkLoop ? smoothPts(TL.parkLoop, 0.8) : [] };
    return CURVE_CACHE;
  }
  function curvyRoads(vr) {
    const z = cam.z, C = curveSamples();
    C.list.forEach(c => {
      if (!c.s.some(p => p[0] > vr.x0 - 3 && p[0] < vr.x1 + 3 && p[1] > vr.y0 - 3 && p[1] < vr.y1 + 3)) return;
      strip(c.s, c.w + 0.5, '#d9c9a8'); strip(c.s, c.w, '#8e959c');
      if (z > 0.12) for (let i = 0; i < c.s.length - 1; i += 2) { const a = iso(c.s[i][0], c.s[i][1]), b = iso(c.s[i + 1][0], c.s[i + 1][1]); line(a.x, a.y, b.x, b.y, 'rgba(255,255,255,.75)', 1.2 * z); }
    });
    if (C.park.length && z > 0.08) strip(C.park, 0.9, '#e6dccb');   // the jogging loop in the park
  }
  // The expressway on pillars, with its ramps down to town, and a few cars driving along it.
  function highwayObjs(objs, vr, ts) {
    const Hw = TL.highway;
    if (!Hw) return;
    const z = cam.z, deck = smoothPts(Hw.pts, 3), ramps = Hw.ramps.map(r => smoothPts(r, 0.8));
    const seg = (S2, i, w, pil = true) => {
      const a = S2[i], b = S2[i + 1];
      if (Math.max(a[0], b[0]) < vr.x0 - 6 || Math.min(a[0], b[0]) > vr.x1 + 6 || Math.max(a[1], b[1]) < vr.y0 - 6 || Math.min(a[1], b[1]) > vr.y1 + 6) return;
      objs.push({ d: (a[0] + b[0]) / 2 + (a[1] + b[1]) / 2 + 1.5, f: () => {
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * w / 2, ny = dx / L * w / 2;
        const P = (p, sx, sy, h) => up(iso(p[0] + sx, p[1] + sy), h * z);
        const front = (nx + ny) > 0 ? 1 : -1;   // the side that faces the camera shows its concrete edge
        poly([P(a, front * nx, front * ny, a[2]), P(b, front * nx, front * ny, b[2]), P(b, front * nx, front * ny, b[2] - 3), P(a, front * nx, front * ny, a[2] - 3)], '#b9b4aa');
        poly([P(a, nx, ny, a[2]), P(b, nx, ny, b[2]), P(b, -nx, -ny, b[2]), P(a, -nx, -ny, a[2])], '#7d848b');
        const ra = P(a, front * nx, front * ny, a[2] + 2.2), rb = P(b, front * nx, front * ny, b[2] + 2.2); line(ra.x, ra.y, rb.x, rb.y, '#e8e4dc', 1.4 * z);
        const qa = P(a, -front * nx, -front * ny, a[2] + 2.2), qb = P(b, -front * nx, -front * ny, b[2] + 2.2); line(qa.x, qa.y, qb.x, qb.y, '#cfc9be', 1.1 * z);
        if (w > 2 && z > 0.1) { const m0 = P(a, 0, 0, a[2]), m1 = P(b, 0, 0, b[2]); line(m0.x, m0.y, m1.x, m1.y, 'rgba(242,194,48,.85)', 1 * z); }
        if (pil && a[2] > 3) { const g = iso(a[0], a[1]), top = up(g, (a[2] - 3) * z); rrect(g.x - 2.4 * z, top.y, 4.8 * z, g.y - top.y, 1.2 * z, '#a8a39a'); ellipse(g.x, g.y, 5 * z, 2.2 * z, 'rgba(0,0,0,.12)'); }   // a pillar
      } });
    };
    for (let i = 0; i < deck.length - 1; i++) seg(deck, i, 3.2);
    flyoverObjs(objs, vr);   // v0.27
    ramps.forEach(R => { for (let i = 0; i < R.length - 1; i++) seg(R, i, 1.6); });
    // traffic: a few cars going each way along the deck
    if (z > 0.12) {
      const x0 = Hw.pts[0][0], x1 = Hw.pts[1][0], y = Hw.pts[0][1], len = x1 - x0;
      for (let k = 0; k < 6; k++) {
        const dir = k % 2 ? 1 : -1, u = ((ts / 1000 * 4 + k * len / 6) % len + len) % len, x = dir > 0 ? x0 + u : x1 - u, yy = y + dir * 0.7;
        if (x < vr.x0 - 4 || x > vr.x1 + 4) continue;
        const car = { k: ['sedan', 'mini', 'suv', 'boxtruck', 'luxury', 'pickup'][k], color: CAR_COLORS[(k * 3) % CAR_COLORS.length] };
        objs.push({ d: x + yy + 1.6, f: () => { ctx.save(); ctx.translate(0, -Hw.h * cam.z); drawCarDir(car, x, yy, dir > 0 ? '+x' : '-x', ts); ctx.restore(); } });
      }
    }
  }
  // v0.27: the flyover: a concrete deck on T-shaped pillars over the avenue, with parapets, lane lines and a shadow
  function flyoverObjs(objs, vr) {
    const z = cam.z;
    (TL.flyovers || []).forEach(F => {
      const S2 = smoothPts(F.pts, 1.2), w = 2.4, G = 7;   // G: how deep the concrete girder is
      for (let i = 0; i < S2.length - 1; i++) {
        const a = S2[i], b = S2[i + 1];
        if (Math.max(a[0], b[0]) < vr.x0 - 6 || Math.min(a[0], b[0]) > vr.x1 + 6 || Math.max(a[1], b[1]) < vr.y0 - 6 || Math.min(a[1], b[1]) > vr.y1 + 6) continue;
        objs.push({ d: (a[0] + b[0]) / 2 + (a[1] + b[1]) / 2 + 1.5, f: () => {
          const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * w / 2, ny = dx / L * w / 2;
          const P = (p, sx, sy, h) => up(iso(p[0] + sx, p[1] + sy), h * z), fr = (nx + ny) > 0 ? 1 : -1;
          if (a[2] > 1) poly([P(a, nx + 0.5, ny + 0.5, 0), P(b, nx + 0.5, ny + 0.5, 0), P(b, -nx + 0.5, -ny + 0.5, 0), P(a, -nx + 0.5, -ny + 0.5, 0)], `rgba(30,35,45,${Math.min(0.22, a[2] / 120)})`);   // its shadow
          if (i % 4 === 0 && a[2] > G + 2) [-0.55, 0.55].forEach(k => {   // two columns under the deck, near its edges
            const g = iso(a[0] + nx * k * 2 * fr, a[1] + ny * k * 2 * fr), top = up(g, (a[2] - G) * z);
            ellipse(g.x, g.y, 8 * z, 3.4 * z, 'rgba(0,0,0,.18)');
            rrect(g.x - 4.5 * z, top.y, 9 * z, g.y - top.y, 2 * z, k > 0 ? '#ddd7cc' : '#c9c3b7'); rrect(g.x + 1.2 * z, top.y, 3.3 * z, g.y - top.y, 1.5 * z, 'rgba(0,0,0,.13)');
          });
          const gd = Math.min(G, Math.max(1, a[2]));
          poly([P(a, fr * nx, fr * ny, a[2]), P(b, fr * nx, fr * ny, b[2]), P(b, fr * nx, fr * ny, b[2] - gd), P(a, fr * nx, fr * ny, a[2] - gd)], '#ddd7cb');   // the girder
          const e0 = P(a, fr * nx, fr * ny, a[2] - gd), e1 = P(b, fr * nx, fr * ny, b[2] - gd); line(e0.x, e0.y, e1.x, e1.y, '#8f897e', 1.4 * z);
          const e2 = P(a, fr * nx, fr * ny, a[2] - 1.2), e3 = P(b, fr * nx, fr * ny, b[2] - 1.2); line(e2.x, e2.y, e3.x, e3.y, 'rgba(0,0,0,.12)', 1 * z);
          poly([P(a, nx, ny, a[2]), P(b, nx, ny, b[2]), P(b, -nx, -ny, b[2]), P(a, -nx, -ny, a[2])], '#6c737b');   // the road on top
          if (z > 0.12) {
            const m0 = P(a, 0, 0, a[2]), m1 = P(b, 0, 0, b[2]); if (i % 2 === 0) line(m0.x, m0.y, m1.x, m1.y, 'rgba(255,255,255,.8)', 1.2 * z);
            [1, -1].forEach(sg => { const p0 = P(a, sg * nx, sg * ny, a[2]), p1 = P(b, sg * nx, sg * ny, b[2]), q0 = P(a, sg * nx, sg * ny, a[2] + 2.6), q1 = P(b, sg * nx, sg * ny, b[2] + 2.6);
              poly([p0, p1, q1, q0], sg === fr ? '#e8e3d9' : '#cfc9bd'); });   // parapets
          }
        } });
      }
    });
  }
  // A live workout in town (v0.16): mini-you laps the park, swims in the lake, trains at the gym, does yoga on the lawn.
  let liveU = 0;
  function liveSpotTown() {
    if (!S.live) return null;
    const type = S.live.type, L = curveSamples().park;
    if (['walk', 'run', 'wheel', 'cycle'].includes(type) && L.length) { const i = Math.floor(liveU) % L.length; return [L[i][0], L[i][1]]; }
    if (type === 'swim') return swimSpot();
    if (type === 'yoga') return [TL.park.x + 12, TL.park.y + 20];
    const g = placePt('gym'); return g ? [g[0] + 0.8, g[1] + 0.4] : [TL.park.x + 12, TL.park.y + 20];
  }
  function liveTownObjs(objs, dt, ts) {
    if (!S.live || VIEW_TOWN !== myTown() || S.work) return;
    const type = S.live.type, z = cam.z, L = curveSamples().park, a = { face: 1 };
    let x, y, moving = false;
    if (['walk', 'run', 'wheel', 'cycle'].includes(type) && L.length) {
      liveU = (liveU + dt * ({ run: 3.2, cycle: 5, walk: 1.8, wheel: 1.8 }[type]) / 0.8) % L.length;
      const i = Math.floor(liveU), p0 = L[i], p1 = L[(i + 1) % L.length], k = liveU - i;
      x = p0[0] + (p1[0] - p0[0]) * k; y = p0[1] + (p1[1] - p0[1]) * k; faceTo(a, p1[0] - p0[0], p1[1] - p0[1]); moving = true;
    } else [x, y] = liveSpotTown();
    objs.push({ d: x + y + 0.5, f: () => {
      const p = iso(x, y);
      drawPerson(p.x, p.y, z, { look: S.me.look, face: a.face, view: moving && type !== 'cycle' ? a.view : null, turn: a.turn, moving, phase: ts / 90, energy: energyLevel(), ts, seed: 3, pose: WORKOUT_POSE[type] });
      liveBadge(p, S.live, true);
    } });
  }
  // The stores outside the town centre (v0.17).
  function storeObjs(objs, vr, ts) {
    (TL.stores || []).forEach(st => {
      const [k, x, y, w, d] = st;
      if (!boxVisible(x - 1, y - 1, x + w + 1, y + d + 1, vr)) return;
      const [bx, by, bw, bd] = storeGeo(st).b;
      objs.push({ d: bx + by + bw / 2 + bd / 2 + 1.5, f: () => { const r = drawStore(st, ts); if (!edit) hits.push({ kind: 'shop', k, pri: 1, ...r }); } });
      storeShow(st, objs, ts);
    });
  }
  // Where each public place is (where you walk to).
  function placePt(key) {
    const shop = TL.shops.find(([k]) => k === key), P = TL.park, F = TL.fields[0], K = TL.lake, C = TL.centre, st = (TL.stores || []).find(([k]) => k === key);
    if (shop) return [shop[1] + 3, shop[2] + 6.3];
    if (st) return storeGeo(st).door;
    if (key === 'plaza') return [TL.plaza.x + LOT_W / 2, TL.plaza.y + LOT_D + 0.8];
    if (key === 'park') return [P.x + 20.7, P.y + 14.7];
    if (key === 'fields') return [F.x + Math.min(F.w / 2, 10), F.y - 0.6];
    if (key !== 'lake') return null;
    const a = Math.atan2((C.y + C.d / 2 - K.y) / K.ry, (C.x + C.w / 2 - K.x) / K.rx), m = K.sea ? 1 + 1.6 / K.ry : 1 + 1.2 / Math.min(K.rx, K.ry);
    return [K.x + Math.cos(a) * K.rx * m, K.y + Math.sin(a) * K.ry * m];
  }
  // Where a road crosses water: a bridge (stone edges and a white railing on both sides).
  function bridges(vr) {
    const z = cam.z;
    if (z < 0.08) return;
    TL.roads.forEach(r => TL.water.forEach(w => {
      const x0 = Math.max(r[0], w[0]), x1 = Math.min(r[2], w[2]), y0 = Math.max(r[1], w[1]), y1 = Math.min(r[3], w[3]);
      if (x0 >= x1 || y0 >= y1 || !boxVisible(x0, y0, x1, y1, vr)) return;
      const rail = (ax, ay, bx, by) => {
        const A = iso(ax, ay), B = iso(bx, by);
        line(A.x, A.y, B.x, B.y, '#9a8f80', 3 * z); line(A.x, A.y - 7 * z, B.x, B.y - 7 * z, '#f4efe6', 2 * z);
        for (let k = 0; k <= 4; k++) { const P = lerp(A, B, k / 4); line(P.x, P.y, P.x, P.y - 7 * z, '#f4efe6', 1.4 * z); }
      };
      if (r[2] - r[0] < r[3] - r[1]) { rail(r[0], y0 - 0.4, r[0], y1 + 0.4); rail(r[2], y0 - 0.4, r[2], y1 + 0.4); }   // the road runs along y
      else { rail(x0 - 0.4, r[1], x1 + 0.4, r[1]); rail(x0 - 0.4, r[3], x1 + 0.4, r[3]); }
    }));
  }
  // Swimming in the town's water: the middle of a lake, or the shallows of the sea closest to the town centre.
  function swimSpot() {
    const K = TL.lake;
    if (!K.sea) return [K.x, K.y];
    const C = TL.centre, a = Math.atan2((C.y + C.d / 2 - K.y) / K.ry, (C.x + C.w / 2 - K.x) / K.rx);
    return [K.x + Math.cos(a) * K.rx * 0.95, K.y + Math.sin(a) * K.ry * 0.95];
  }
  const boxVisible = (x0, y0, x1, y1, vr) => !(x1 < vr.x0 || x0 > vr.x1 || y1 < vr.y0 || y0 > vr.y1);
  // Town centre: paved square, the town hall plaza, shops along the avenue.
  function townCentre(objs, vr, ts, lv, out) {
    const C = TL.centre;
    storeObjs(objs, vr, ts);   // v0.18: the stores draw even when the town centre is off screen
    if (!boxVisible(C.x - 1, C.y - 1, C.x + C.w + 1, C.y + C.d + 1, vr)) return;
    flatRect(C.x, C.y, C.w, C.d, '#e8e0cf');
    if (cam.z > 0.14) for (let x = C.x + 0.5; x < C.x + C.w; x += 5) flatRect(x, C.y, 0.08, C.d, 'rgba(160,140,110,.12)');
    { const q = [iso(C.x, C.y), iso(C.x + C.w, C.y), iso(C.x + C.w, C.y + C.d), iso(C.x, C.y + C.d)];   // v0.27: the streets through the square
      ctx.save(); ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.clip(); drawRoads(vr); ctx.restore(); }
    const K = TL.pocket;
    if (K) {   // v0.27: a pocket park between the one-way lanes
      flatRect(K.x, K.y, K.w, K.d, PAL.lawn || '#a9d281');
      flatRect(K.x + K.w / 2 - 0.5, K.y, 1, K.d, '#e6dccb'); flatRect(K.x, K.y + K.d / 2 - 0.5, K.w, 1, '#e6dccb');
      [['tree', 0.6, 0.6], ['tree', K.w - 1.6, 0.6], ['tree', 0.6, K.d - 1.6], ['tree', K.w - 1.6, K.d - 1.6], ['bench', 2.6, K.d / 2 - 1.8], ['bench', K.w - 3.6, K.d / 2 + 0.8], ['flowers', K.w / 2 - 2.2, 1.6], ['flowers', K.w / 2 + 1.2, K.d - 2.6], ['lamp', K.w / 2 + 0.7, K.d / 2 + 0.7]]
        .forEach(([k, x, y]) => objs.push({ d: K.x + K.y + x + y + 1, f: () => drawYardItem({ k }, K.x + x, K.y + y, ts) }));
    }
    const { x: px, y: py } = TL.plaza;
    plazaGround(px, py);
    objs.push({ d: px + py + 10, f: () => { out.hall = drawTownHall(px, py, lv, ts); } });
    if (lv >= 2) objs.push({ d: px + py + 6 + 8 + 2, f: () => drawYardItem({ k: 'fountain' }, px + 6, py + 7, ts) });
    const deco = [['tree', 1, 8], ['tree', 12, 8], ['pine', 1, 1], ['pine', 12, 1], ['bench', 4, 11], ['bench', 10, 11], ['lamp', 2, 12], ['lamp', 13, 12]];
    if (lv >= 3) deco.push(['flowers', 3, 7], ['flowers', 10, 7], ['lamp', 5, 10], ['lamp', 9, 10]);
    if (lv >= 5) deco.push(['flowers', 2, 10], ['flowers', 11, 10], ['tree', 6, 13], ['tree', 8, 13]);
    deco.forEach(([k, x, y]) => objs.push({ d: px + py + x + y + 1, f: () => drawYardItem({ k }, px + x, py + y, ts) }));
    TL.shops.forEach(([k, x, y]) => objs.push({ d: x + y + 5.5, f: () => { const r = drawShop(k, x, y, ts); if (!edit) hits.push({ kind: 'shop', k, pri: 1, ...r }); } }));
    // trees along the edges of the square (not on the plaza or in front of a shop)
    const free = (x, y) => !TL.roads.some(r => x > r[0] - 1 && x < r[2] + 1 && y > r[1] - 1 && y < r[3] + 1) && !(K && x > K.x - 1 && x < K.x + K.w + 1 && y > K.y - 1 && y < K.y + K.d + 1) && !(x > px - 1.5 && x < px + LOT_W + 1.5 && y > py - 1.5 && y < py + LOT_D + 1.5) && !TL.shops.some(([, sx, sy]) => x > sx - 1.5 && x < sx + 7.5 && y > sy - 1.5 && y < sy + 7.5)
      && !(TL.parks || []).some(([, qx, qy, qw, qd]) => x > qx - 1.2 && x < qx + qw + 1.2 && y > qy - 1.2 && y < qy + qd + 1.2);
    for (let x = C.x + 1.5; x < C.x + C.w - 1; x += 6.5) [C.y + C.d - 2, C.y + 1].forEach(y => { if (free(x, y)) objs.push({ d: x + y + 1, f: () => drawYardItem({ k: 'tree' }, x, y, ts) }); });
  }
  // The park: lawns, crossing paths, a duck pond, a sports field, a playground, trees and benches.
  function park(objs, vr, ts) {
    const P = TL.park;
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
    const underFly = (x, y) => (TL.flyovers || []).some(F => x > F.x0 - 1 && x < F.x1 + 1 && Math.abs(y + 0.5 - F.y) < 2.2);   // v0.27: nothing growing under the flyover
    items.filter(([, x, y]) => !onCarPark(x + 0.5, y + 0.5) && !underFly(x, y)).forEach(([k, x, y]) => objs.push({ d: x + y + 1, f: () => drawYardItem({ k, rot: 0, placed: 0 }, x, y, ts) }));
  }
  const onCarPark = (x, y) => (TL.parks || []).some(([, qx, qy, qw, qd]) => x > qx - 0.8 && x < qx + qw + 0.8 && y > qy - 0.8 && y < qy + qd + 0.8);
  // The big lake, with a wooden dock and a little boat.
  function lakeSide(objs, vr, ts) {
    const K = TL.lake;
    if (!boxVisible(K.x - K.rx - 6, K.y - K.ry - 6, K.x + K.rx + 6, K.y + K.ry + 6, vr)) return;
    if (K.sea) {   // the sea: a wide sandy beach, then the water, with little waves rolling in along the shore
      const ring = k => { const pts = []; for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2; pts.push(iso(K.x + Math.cos(a) * (K.rx + k), K.y + Math.sin(a) * (K.ry + k))); } return pts; };
      poly(ring(4.6), '#efe0b4'); poly(ring(2.2), '#e6d3a0');
    }
    drawLake(K.x, K.y, K.rx, K.ry, ts);
    const top = K.y > 46;   // the water lies below the town (its shore is its top edge) or above it
    if (K.sea && cam.z > 0.1) for (let i = 0; i < 70; i++) {
      const a = (top ? -1 : 1) * Math.PI / 2 + (i / 70 - 0.5) * 2.6, u = 0.985 - ((ts / 4200 + i * 0.37) % 1) * 0.05;
      const p = iso(K.x + Math.cos(a) * K.rx * u, K.y + Math.sin(a) * K.ry * u);
      ellipse(p.x, p.y, 11 * cam.z, 1.6 * cam.z, 'rgba(255,255,255,.5)');
    }
    // the dock is on the side of the water that faces the town
    const dx = K.x - 6, dy = top ? K.y - K.ry - 0.6 : K.y + K.ry - 4.4;
    objs.push({ d: dx + dy + 3, f: () => { box(dx, dy, 1.4, 5, 2, '#a5774c', 0); for (let k = 0; k < 5; k++) flatRect(dx, dy + k + 0.95, 1.4, 0.05, 'rgba(60,40,20,.35)', null, 2); } });
    const bob = Math.sin(ts / 900) * 1.2, bx = TL.lake.x + 4, by = top ? TL.lake.y - TL.lake.ry + (K.sea ? 5 : TL.lake.ry - 3) : TL.lake.y + TL.lake.ry - 5;
    objs.push({ d: bx + by, f: () => { const c = iso(bx, by), z = cam.z; ellipse(c.x, c.y + 2 * z, 22 * z, 7 * z, 'rgba(0,40,80,.15)'); pg([[c.x - 20 * z, c.y - 4 * z + bob * z], [c.x + 20 * z, c.y - 4 * z + bob * z], [c.x + 13 * z, c.y + 4 * z + bob * z], [c.x - 13 * z, c.y + 4 * z + bob * z]], '#c0453a'); line(c.x, c.y - 4 * z + bob * z, c.x, c.y - 30 * z + bob * z, '#8a5a36', 1.4 * z); pg([[c.x + 1 * z, c.y - 29 * z + bob * z], [c.x + 15 * z, c.y - 8 * z + bob * z], [c.x + 1 * z, c.y - 8 * z + bob * z]], '#fffaf0'); } });
  }
  // Farmland south of town: big striped crop fields, barns and a windmill.
  const FIELD_COLS = ['#e9c46a', '#8ab85a', '#c98a4b', '#b5d36b', '#f0d48a', '#7fae4f'];
  function farmland(objs, vr, ts) {
    TL.fields.forEach((F, fi) => {
      if (!boxVisible(F.x, F.y, F.x + F.w, F.y + F.d, vr)) return;
      flatRect(F.x, F.y, F.w, F.d, '#b9d88a');
      const nx = Math.max(1, Math.floor((F.w - 0.5) / 9.5)), ny = Math.max(1, Math.floor((F.d - 0.5) / 9));
      const cw = (F.w - 0.5) / nx - 1, cd = (F.d - 0.5) / ny - 1, cols = PAL.rows || FIELD_COLS;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const x = F.x + 0.5 + i * (cw + 1), y = F.y + 0.5 + j * (cd + 1), col = cols[(i * 3 + j * 5 + fi) % cols.length];
        if (!boxVisible(x, y, x + cw, y + cd, vr)) continue;
        flatRect(x, y, cw, cd, '#9a6a44');
        if (cam.z > 0.08) for (let k = 0; k < Math.floor(cd); k++) flatRect(x + 0.3, y + 0.35 + k, cw - 0.6, 0.55, col); else flatRect(x + 0.2, y + 0.2, cw - 0.4, cd - 0.4, col);
      }
      if (ny < 2 || F.w < 30) return;   // barns and windmills stand in the lane between the first two rows
      const gy = F.y + 0.5 + cd;
      [0.26, 0.67].forEach(u => { const x = F.x + F.w * u, y = gy - 0.3; objs.push({ d: x + y + 2, f: () => drawBarn(x, y) }); });
      [0.46, 0.86].forEach(u => { const x = F.x + F.w * u, y = gy - 0.1; objs.push({ d: x + y + 1, f: () => drawYardItem({ k: 'windmill', placed: 0 }, x, y, ts) }); });
    });
  }

  function renderWorld(ts, dt) {
    if (mode === 'home') return renderHome(ts, dt);
    const z = cam.z, vr = viewRect(), focusId = null, themed = PAL !== TOWN_THEMES.maple;
    // ground: the country around town, woods, the town, neighbourhood lawns, roads, landmarks
    outskirts(vr, ts);
    flatRect(WX0, WY0, WX1 - WX0, WY1 - WY0, PAL.woods);
    flatRect(WORLD.x0, WORLD.y0, WORLD.x1 - WORLD.x0, WORLD.y1 - WORLD.y0, PAL.town);
    Object.values(TL.streets).forEach(st => { if (boxVisible(st.x - 1, st.y - 1, st.x + st.n * PARCEL + 1, st.y + LOT_D + 1, vr)) flatRect(st.x - 0.6, st.y - 0.6, st.n * PARCEL + 1.2, LOT_D + 0.6, themed ? shade(PAL.town, st.nb === 'lake' ? -0.04 : st.nb === 'farm' ? 0.04 : 0) : NEIGHBORHOODS[st.nb].grass); });
    const objs = [], tops = [], out = { hall: null, shops: mode === 'town' ? [] : null }, lv = townLevel(rankTotal());
    river(vr);
    mountains(objs, vr);
    lakeSide(objs, vr, ts);
    park(objs, vr, ts);
    farmland(objs, vr, ts);
    drawRoads(vr);
    bridges(vr);
    curvyRoads(vr);
    if (z > 0.06) highwayObjs(objs, vr, ts);
    townCentre(objs, vr, ts, lv, out);
    carParks(vr);   // v0.19: on top of the paved square and the lawns
    woods(objs, vr, ts);
    // land for sale: light grass with a dashed outline and a sign
    const runs = vacantRuns();
    runs.forEach(r => {
      const st = TL.streets[r.st], x = st.x + r.p * PARCEL, y = st.y, w = r.n * PARCEL;
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
    if (z > 0.07 && mode === 'town') traffic(objs, dt, ts);   // v0.21
    if (mode === 'town') signalObjs(objs, vr);   // v0.22
    if (mode === 'town') liveTownObjs(objs, dt, ts);
    if (mode === 'town' && cam.z > 0.2 && VIEW_TOWN === myTown()) parkPeople(objs, ts);   // v0.25
    if (trip && !trip.arrived && mode === 'town' && !S.work && !S.live && !jailed()) objs.push({ d: trip.inCar ? carDepth(trip.x, trip.y, trip.dir, trip.h || 0) : trip.x + trip.y + 0.6, f: () => drawTrip(ts) });
    else if (mode === 'town' && outHere() && !S.work && !S.live && !jailed()) { const [mx, my] = S.out.pt; objs.push({ d: mx + my + 0.6, f: () => drawMeOut(mx, my, ts) }); }
    const atPlace = S.work ? S.work.place : jailed() ? 'police' : S.study ? 'school' : null;
    if (atPlace && mode === 'town' && VIEW_TOWN === myTown() && placePt(atPlace)) {   // at work (v0.14) or held by the police (v0.18)
      const [wx, wy] = placePt(atPlace), jail = !S.work && !S.study;
      objs.push({ d: wx + wy + 0.6, f: () => { const p = iso(wx, wy); drawPerson(p.x, p.y, cam.z, { look: S.me.look, face: 1, view: 'front', turn: [0.7, 0.7], energy: jail ? 'tired' : energyLevel(), ts, seed: 3, pose: 'stand' });
        if (jail) for (let i = -2; i <= 2; i++) line(p.x + i * 3.4 * cam.z, p.y - 2 * cam.z, p.x + i * 3.4 * cam.z, p.y - 44 * cam.z, '#5b6470', 1.2 * cam.z);
        if (cam.z > 0.3) nameTag(p, `${jail ? (S.study ? '📚' : '🚔') : '💼'} ${S.me.name || ''}`, true); } });
    }
    if (mode === 'town') parkedObjs(objs, ts);
    if (edit && edit.scope === 'yard') { const [ox, oy] = origin('me'); yardSpots(homeW(S.me), S.me).forEach(([x, y]) => tile(ox + x, oy + y, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.55)')); }
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
      if (z < 0.17) TL.labels.forEach(([key, x, y]) => { const c = iso(x, y); pill(key === 'area_maple' && VIEW_TOWN !== HOME_TOWN ? nm(COMMUNITIES[VIEW_TOWN]) : t(key), c.x, c.y, 'rgba(59,49,37,.78)', '#fff', `800 ${fs}px ${UI_FONT},${EMOJI_FONT}`, fs + 9); });
      // zoomed all the way out: the neighbouring villages, and a way on to the world map
      if (z < 0.1) {
        [[WX1 + 40, (WY0 + WY1) / 2 - 20, 'out_east'], [(WX0 + WX1) / 2 + 30, WY1 + 40, 'out_south'], [WX0 - 34, WY1 + 34, 'out_west']].filter(([x, y]) => !inLake(x, y)).forEach(([x, y, key]) => { const c = iso(x, y); pill(t(key), c.x, c.y, 'rgba(255,255,255,.82)', '#5d5448', `700 ${small}px ${UI_FONT},${EMOJI_FONT}`, small + 8); });
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
      if (out.hall) { const { x: px, y: py } = TL.plaza; hits.push({ kind: 'plaza', pri: 1, ...pill(VIEW_TOWN === HOME_TOWN ? `🏛️ ${t('street_name')} Lv${lv}` : `🏛️ ${nm(COMMUNITIES[VIEW_TOWN])}`, iso(px + 7, py + 3).x, out.hall.top - 6, '#ef7d3c', '#fff', `bold 12px ${UI_FONT},${EMOJI_FONT}`, 22) }); }
      return;
    }
  }
  // ---------- home: just this one home, big and close up (v0.9) ----------
  // Tapping any home (yours or someone else's) shows only that home: its lot, the road in front and (yours) the
  // parcel for sale next door. The lawn runs to the edges of the screen; nothing else is drawn, so there's room
  // for more detail than in the town (grass, flowers, stepping stones).
  function islandRect(id) {
    const h = homeOf(id), [ox, oy] = origin(id), extra = id === 'me' && h && canExpand() ? PARCEL : 0;
    return { ox, oy, x0: ox - 0.4, y0: oy - 0.4, x1: ox + (h ? homeW(h) : LOT_W) + extra + 0.4, y1: oy + LOT_D + 1.2, extra };
  }
  // ---------- the garden around one home (v0.11) ----------
  // Looking at a home, the whole screen is that home: the yard, a garden around the fence (flower beds, low hedges,
  // stepping stones from the gate, the end of the drive) and thick woods beyond. No road, no empty land.
  const GARDEN = { back: 3.2, left: 3.2, right: 3.6, front: 7 };
  const WOODS_PAT = new Map();
  // The far woods are one repeating picture of tree tops (one fill, however many trees there are).
  function woodsPattern() {
    const key = PAL;
    if (WOODS_PAT.has(key)) return WOODS_PAT.get(key);
    const PW = 256, PH = 128, K = 2, c = document.createElement('canvas');
    c.width = PW * K; c.height = PH * K;
    const saved = ctx;
    ctx = c.getContext('2d'); ctx.scale(K, K);
    const L = PAL.leaf, kind = PAL.tree, desert = kind === 'cactus', pine = kind === 'pine';
    ctx.fillStyle = shade(PAL.woods, desert ? -0.02 : -0.16); ctx.fillRect(0, 0, PW, PH);
    const r = seeded(4242), T = [];
    const n = desert ? 7 : 22;
    for (let k = 0; k < n; k++) T.push({ x: r() * PW, y: r() * PH, s: 0.75 + r() * 0.5, v: r() });
    const all = [];
    T.forEach(t => [-1, 0, 1].forEach(i => [-1, 0, 1].forEach(j => all.push({ ...t, x: t.x + i * PW, y: t.y + j * PH }))));
    all.sort((a, b) => a.y - b.y).forEach(t => {
      const s = t.s;
      if (desert) {   // sand, rocks and a few cacti
        ellipse(t.x, t.y, 12 * s, 5 * s, 'rgba(0,0,0,.1)');
        if (t.v < 0.5) { ellipse(t.x, t.y - 3 * s, 8 * s, 5 * s, '#b9a585'); ellipse(t.x - 2 * s, t.y - 5 * s, 4 * s, 2.5 * s, '#cdbb9c'); }
        else { rrect(t.x - 3.5 * s, t.y - 30 * s, 7 * s, 30 * s, 3.5 * s, L[1]); rrect(t.x - 11 * s, t.y - 22 * s, 5 * s, 12 * s, 2.5 * s, L[0]); rrect(t.x - 11 * s, t.y - 13 * s, 9 * s, 4.5 * s, 2.2 * s, L[0]); }
        return;
      }
      ellipse(t.x + 4 * s, t.y + 2 * s, 26 * s, 11 * s, 'rgba(0,0,0,.16)');
      if (pine || PAL.snow) {
        [[0, 30, 18], [14, 24, 14], [26, 16, 9]].forEach(([dy, h, w], i) => {
          pg([[t.x - w * s, t.y - dy * s], [t.x + w * s, t.y - dy * s], [t.x, t.y - (dy + h) * s]], i === 1 ? L[1] : L[0]);
          if (PAL.snow) pg([[t.x - w * 0.45 * s, t.y - (dy + h * 0.55) * s], [t.x + w * 0.45 * s, t.y - (dy + h * 0.55) * s], [t.x, t.y - (dy + h) * s]], '#f8fbfc');
        });
        return;
      }
      const R0 = 22 * s;
      circle(t.x, t.y - R0 * 0.7, R0, t.v < 0.5 ? L[0] : shade(L[0], -0.06));
      circle(t.x - R0 * 0.3, t.y - R0 * 0.95, R0 * 0.62, L[1]);
      circle(t.x - R0 * 0.38, t.y - R0 * 1.12, R0 * 0.3, L[2]);
    });
    ctx = saved;
    const p = ctx.createPattern(c, 'repeat'), o = { p, K };
    WOODS_PAT.set(key, o);
    return o;
  }
  // Fills the whole screen with the woods, lined up with the ground (it moves with the camera).
  function woodsFill() {
    const o = woodsPattern(), k = cam.z / o.K;
    ctx.save(); ctx.translate(cam.x, cam.y); ctx.scale(k, k);
    ctx.fillStyle = o.p; ctx.fillRect(-cam.x / k, -cam.y / k, W / k, H / k);
    ctx.restore();
  }
  const onScreen = (x, y, m = 90) => { const p = iso(x, y), z = cam.z; return p.x > -m * z && p.x < W + m * z && p.y > -20 && p.y < H + m * 1.6 * z; };
  // A flower bed: dark soil with little flowers in the theme's colours.
  function flowerBed(x, y, w, d, k0) {
    const z = cam.z;
    flatRect(x, y, w, d, '#8d6b4b', 'rgba(0,0,0,.08)');
    if (z < 0.42) return;
    const FL = PAL.rows || ['#f6d04d', '#ef8fb0', '#ffffff', '#b39ae0', '#f28c28'];
    for (let i = 0; i < w * d * 5; i++) {
      const c = iso(x + 0.12 + hash(i, k0) * (w - 0.24), y + 0.12 + hash(k0, i + 0.5) * (d - 0.24));
      circle(c.x - 1.6 * z, c.y - 2.5 * z, 1.8 * z, '#5a9a3e'); circle(c.x + 1.6 * z, c.y - 2 * z, 1.6 * z, '#4f8c38');
      circle(c.x, c.y - 4.6 * z, 2.1 * z, FL[(i + k0) % FL.length]); circle(c.x, c.y - 4.6 * z, 0.8 * z, '#f2a33a');
    }
  }
  function homeGarden(h, R, objs, ts) {
    const z = cam.z, ox = R.ox, oy = R.oy, LW = homeW(h) + R.extra, f = fine(), FY = oy + LOT_D;
    const gx0 = ox - GARDEN.left, gy0 = oy - GARDEN.back, gx1 = ox + LW + GARDEN.right, gy1 = FY + GARDEN.front;
    woodsFill();
    // the garden lawn, a soft darker edge where the woods begin, and mown stripes
    flatRect(gx0 - 0.5, gy0 - 0.5, gx1 - gx0 + 1, gy1 - gy0 + 1, shade(PAL.town, -0.08));
    flatRect(gx0, gy0, gx1 - gx0, gy1 - gy0, PAL.town);
    if (f) for (let y = Math.ceil(gy0); y < gy1; y += 2) flatRect(gx0, y, gx1 - gx0, 1, 'rgba(255,255,255,.04)');
    // out of the gate: the drive ends in a round gravel spot, and stepping stones go on into the woods
    flatRect(ox + 0.1, FY, 1.8, 2.3, '#cfc8bb', 'rgba(0,0,0,.05)');
    if (f) { const c = iso(ox + 1, FY + 2.3); ellipse(c.x, c.y, 30 * z, 15 * z, '#cfc8bb'); }
    for (let y = FY + 0.28; y < gy1 + 2.5; y += 0.5) {
      const c = iso(ox + 3.5 + (hash(y * 3, 3) - 0.5) * 0.22, y);
      if (f) ellipse(c.x, c.y, 8 * z, 4 * z, '#e6dccb', 'rgba(0,0,0,.08)', 1); else ellipse(c.x, c.y, 6 * z, 3 * z, '#e6dccb');
    }
    // flower beds all around the fence
    flowerBed(ox + 4.6, FY + 0.3, LW - 5, 0.75, 11);
    flowerBed(ox + 0.4, oy - 1.05, LW - 0.8, 0.7, 12);
    flowerBed(ox - 1.05, oy + 0.4, 0.7, LOT_D - 0.8, 13);
    flowerBed(ox + LW + 0.35, oy + 0.4, 0.7, LOT_D - 0.8, 14);
    // a low clipped hedge in front of the front bed, and round bushes here and there
    if (f) for (let x = ox + 4.6; x < ox + LW - 0.5; x += 1) { const xx = x; objs.push({ d: xx + FY + 1.6, f: () => box(xx, FY + 1.3, 1.02, 0.5, 9, shade(PAL.leaf[0], 0.05), 0, { edge: 'rgba(0,0,0,.08)' }) }); }
    const bush = (x, y, v) => { if (onScreen(x, y)) objs.push({ d: x + y, f: () => drawBushWild(x, y, v) }); };
    const tree = (x, y, v) => { if (onScreen(x, y, 120)) objs.push({ d: x + y, f: () => drawWildTree(x, y, v, ts) }); };
    const jit = (a, b) => (hash(a, b) - 0.5) * 0.5;
    // trees behind and to the left (they can be tall: they stand behind the home)
    for (let x = gx0 + 0.6; x < gx1 + 1; x += 1.6) { tree(x + jit(x, 1), gy0 + 1.1 + jit(x, 2), 0.5 + hash(x, 3) * 0.5); tree(x + 0.8 + jit(x, 4), gy0 - 0.2 + jit(x, 5), 0.6 + hash(x, 6) * 0.4); }
    for (let y = gy0 + 2; y < gy1 - 1; y += 1.6) { tree(gx0 + 1.1 + jit(y, 7), y + jit(y, 8), 0.5 + hash(y, 9) * 0.5); tree(gx0 - 0.2 + jit(y, 10), y + 0.8 + jit(y, 11), 0.6 + hash(y, 12) * 0.4); }
    // right and front: bushes near the fence, trees further out (so they don't hide the yard)
    for (let y = oy + 0.5; y < gy1 - 1; y += 1.7) { bush(ox + LW + 1.6 + jit(y, 13), y + jit(y, 14), hash(y, 15)); tree(gx1 + 0.4 + jit(y, 16), y + 0.8 + jit(y, 17), 0.5 + hash(y, 18) * 0.5); }
    for (let x = gx0 + 0.4; x < gx1 + 1; x += 1.7) { if (Math.abs(x - (ox + 3.5)) > 1.2) tree(x + jit(x, 19), gy1 + 0.4 + jit(x, 20), 0.5 + hash(x, 21) * 0.5); }
    [[ox + 6, FY + 3.4], [ox + LW - 2, FY + 4.4], [ox - 1.6, FY + 2.6], [ox + 10, FY + 5.6], [ox - 1.8, oy - 1.6], [ox + LW + 1.4, oy - 1.4]].forEach(([x, y], k) => bush(x, y, hash(k, 22)));
    if (f) [[ox + 8.3, FY + 4.2], [ox + 1.6, FY + 4.6], [ox + LW + 1.8, FY + 2.6]].forEach(([x, y], k) => { if (onScreen(x, y)) objs.push({ d: x + y, f: () => drawRock(x, y, 0.2 + hash(k, 23) * 0.4) }); });
  }
  function renderHome(ts, dt) {
    const h = homeOf(owner);
    if (!h) return;
    const z = cam.z, R = islandRect(owner), ox = R.ox, oy = R.oy, mine = owner === 'me';
    const objs = [], opt = { focus: true, mine, bubbles: [] };
    homeGarden(h, R, objs, ts);
    if (R.extra) {
      const sx = ox + homeW(h) + 0.2;
      flatRect(sx, oy, PARCEL - 0.2, LOT_D, PAL.vacant);
      ctx.save(); ctx.setLineDash([8 * z, 6 * z]); flatRect(sx + 0.3, oy + 0.3, PARCEL - 0.8, LOT_D - 0.6, null, 'rgba(255,255,255,.85)', 0, 2 * z); ctx.restore();
    }
    lotGround(h, ox, oy, opt);
    if (S.carAt && S.carAt.id === owner && owner !== 'me' && S.me.cars[S.me.car]) { const px = ox + 0.5, py = oy + 11.6; objs.push({ d: px + py + 2.5, f: () => drawCar(S.me.cars[S.me.car], px, py, ts) }); }
    // close-up detail: tufts of grass, little flowers and clover across the lawn (not on paths, fields or buildings)
    if (z > 0.5) {
      const LW = homeW(h), FL = ['#f6d04d', '#ffffff', '#ef8fb0', '#b39ae0'];
      for (let k = 0; k < 60 + LW * 3; k++) {
        const x = hash(k, ox + 41) * LW, y = hash(k, oy + 43) * LOT_D;
        if (yardReserved(Math.floor(x), Math.floor(y), LW, h)) continue;
        const c = iso(ox + x, oy + y), v = hash(k, 47);
        if (v < 0.55) { for (const dx of [-2, 0, 2]) line(c.x + dx * z, c.y, c.x + dx * 1.6 * z, c.y - (4 + v * 4) * z, shade(PAL.town, -0.18), 0.9 * z); }
        else if (v < 0.8) { circle(c.x, c.y - 1.5 * z, 1.6 * z, FL[k % FL.length]); circle(c.x, c.y - 1.5 * z, 0.6 * z, '#f2a33a'); line(c.x, c.y, c.x, c.y - 1.5 * z, '#5a9a3e', 0.6 * z); }
        else ellipse(c.x, c.y, 3 * z, 1.4 * z, shade(PAL.town, -0.1));
      }
    }
    lotObjects(h, ox, oy, objs, ts, dt, opt);
    // swimming with no pond or pool: an inflatable pool in the front yard
    if (!mine && seesLive(h) && h.live && h.live.type === 'swim' && liveSpot('swim', h).swim === 'tub') objs.push({ d: ox + oy + TUB.x + TUB.y - 0.6, f: () => drawTub(ox + TUB.x, oy + TUB.y, ts) });
    if (edit && edit.scope === 'yard') yardSpots(homeW(S.me), S.me).forEach(([x, y]) => tile(ox + x, oy + y, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.55)'));
    const w = weatherNow().kind;
    if (w === 'snow') { ctx.fillStyle = 'rgba(250,252,255,.35)'; ctx.fillRect(0, 0, W, H); }
    else if (w === 'rain' || w === 'storm') { ctx.fillStyle = 'rgba(40,70,110,.08)'; ctx.fillRect(0, 0, W, H); }
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    // a soft frame so your eye goes to the home
    const g = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.45, W / 2, H * 0.48, Math.max(W, H) * 0.8);
    g.addColorStop(0, 'rgba(30,40,20,0)'); g.addColorStop(1, 'rgba(30,40,20,.16)');
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
        const [x, y] = fieldPos(i, h), c = iso(ox + x + 0.5, oy + y + 0.5);
        if (Math.sin(ts / 500 + i) > 0.2) emoji('✨', c.x + 12 * z, c.y - 22 * z, 12 * z);
      });
      const tag = (kind, text, wx, wy) => { const c = iso(ox + wx, oy + wy); hits.push({ kind, pri: 1, ...pill(text, c.x, c.y + 4, 'rgba(255,255,255,.92)', '#7a5a2a', `600 11px ${UI_FONT},${EMOJI_FONT}`, 20) }); };
      if (fine()) {
        if (h.fieldLv < FIELD_LEVELS.length - 1) tag('buyLand', `🔓 ${t('expand_field')}`, areaOf(h, 'fields').x + 2, areaOf(h, 'fields').y + h.fields.length / 4 + 0.5);
        if (!h.pastureLv) tag('buyLand', `🐄 ${t('build_pasture')}`, areaOf(h, 'pasture').x + 2, areaOf(h, 'pasture').y + 4);
        if (!h.orchardLv) tag('buyLand', `🌳 ${t('build_orchard')}`, areaOf(h, 'orchard').x + 3, areaOf(h, 'orchard').y + 1.5);
        if (!h.pondLv) tag('buyLand', `🐟 ${t('build_pond')}`, areaOf(h, 'pond').x + 2, areaOf(h, 'pond').y + 1.5);
        if (canExpand()) { const c = iso(ox + homeW(h) + PARCEL / 2, oy + LOT_D / 2); hits.push({ kind: 'buyParcel', pri: 2, ...pill(`🏷️ ${t('buy_parcel')} · 🪙${fmtNum(parcelCost().coins)}`, c.x, c.y - 40 * z, '#fff6e2', '#b5641e', `800 12px ${UI_FONT},${EMOJI_FONT}`, 24) }); }
      }
      if (S.pending.length && tp.opt.houseTop) hits.push({ kind: 'pending', pri: 3, ...pill(`📦 ${S.pending.length}`, tp.opt.houseTop.x, tp.opt.houseTop.y - 6 - bob, '#ef7d3c', '#fff', `bold 14px ${UI_FONT},${EMOJI_FONT}`) });
    } else {
      if (isFriend(h.id)) h.fields.forEach((fl, i) => {
        if (!stealable(h, i)) return;
        const [x, y] = fieldPos(i, h), c = iso(ox + x + 0.5, oy + y + 0.5);
        hits.push({ kind: 'bubble', what: 'field', owner, i, pri: 2, ...bubble('🖐️', c.x, c.y - 18 * z, 0.9, bob) });
      });
      if (tp.opt.houseTop) pill(t('home_of', { name: homeName(h) }), tp.opt.houseTop.x, tp.opt.houseTop.y - 6, 'rgba(255,255,255,.94)', '#3b3125', `600 12px ${UI_FONT}`);
    }
    // more people here than we draw: say how many (by the gate)
    const nv = visitorsAt(h.id).length, nc = crowdAt(h.id), more = nv + nc - Math.max(Math.min(nv, SHOW_LIMITS.home), Math.min(nc, SHOW_LIMITS.home));
    if (more > 0) pill(t('more_here', { n: fmtNum(more) }), W / 2, H - 30, 'rgba(255,255,255,.95)', '#3b3125', `700 12px ${UI_FONT},${EMOJI_FONT}`, 24);
  }
  // A name over someone's head, with a dot: green when they're online.
  function nameTag(p, name, on) {
    const z = cam.z, y = p.y - 52 * z, fs = 10.5;
    ctx.font = `700 ${fs}px ${UI_FONT}`;
    const w = ctx.measureText(name).width + 20;
    rrect(p.x - w / 2, y - 8.5, w, 17, 8.5, 'rgba(255,255,255,.93)');
    circle(p.x - w / 2 + 8, y, 3.2, on ? '#3dbb62' : '#b9b2a6');
    ctx.fillStyle = '#3b3125'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(name, p.x - w / 2 + 14, y + 0.5);
  }
  // People visiting a home (v0.11): they come in at the gate and look around the yard or the room.
  // Only a few are drawn (SHOW_LIMITS); the rest is a "+N here" label.
  function visitorObjs(h, ox, oy, objs, ts, dt, inside, N, focus) {
    const z = cam.z, lim = inside ? SHOW_LIMITS.room : SHOW_LIMITS.home;
    const list = visitorsAt(h.id).slice(0, lim).map(id => ({ vid: id, v: homeOf(id) })).filter(o => o.v);
    for (let k = 0, n = Math.min(lim, crowdAt(h.id)); list.length < n; k++) list.push({ vid: 'crowd' + k, v: crowdPerson(h.id, k), crowd: true });
    list.forEach(({ vid, v, crowd }, k) => {
      const e = ent((inside ? 'vin:' : 'v:') + h.id + ':' + vid, () => (inside ? { x: 0.8 + k * 0.7, y: N.rd - 1.2 } : { x: DOOR_X, y: LOT_D + 0.9, path: [[DOOR_X, 12.4 - k * 0.6]] }));
      wander(e, dt, speedOf(v) * 0.75, en => randomWalk(en, N.nav, 4, inside ? 99 : LOT_D));
      objs.push({ d: ox + oy + e.x + e.y, f: () => {
        const p = iso(ox + e.x, oy + e.y);
        drawPerson(p.x, p.y, z, { look: v.look, face: e.face, back: e.back && e.moving, view: e.view, turn: e.turn, moving: e.moving, phase: e.phase, energy: friendEnergy(v), ts, seed: 5 + k, wave: e.wave > performance.now() });
        if (focus) { if (z > 0.55) nameTag(p, nm(v.name), true); if (!crowd) hits.push({ kind: 'avatar', owner: vid, x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 44 * z, y1: p.y + 4 * z }); }
      } });
    });
  }
  // ---------- people out walking (v0.9; any town plan since v0.12) ----------
  // A virtual world: residents who are online leave their gate and walk the streets to somewhere (the town square,
  // the park, the lake, a shop, a friend's gate), stay a while, and walk home. Simulated until the server exists;
  // then these are real players. The roads of the town plan make a network: every road along x meets every road
  // along y that it touches; people walk from crossing to crossing (never across lawns, fields or water).
  let NET = null;
  function roadNet() {
    if (NET && NET.id === TL.id) return NET;
    const H = [], V = [], nodes = [], on = new Map();
    TL.roads.forEach(([x0, y0, x1, y1, kind, ow = 0]) => { const sw = SIDEWALK[kind] || 0.6; if (x1 - x0 >= y1 - y0) H.push({ y: (y0 + y1) / 2, a: x0, b: x1, y0, y1, sw, ow }); else V.push({ x: (x0 + x1) / 2, a: y0, b: y1, x0, x1, sw, ow }); });
    const at = (r, i) => { if (!on.has(r)) on.set(r, []); on.get(r).push(i); };
    H.forEach(h => V.forEach(v => {   // roads that cross or just touch (a street ending at an avenue)
      if (v.x1 < h.a - 0.6 || v.x0 > h.b + 0.6 || h.y1 < v.a - 0.6 || h.y0 > v.b + 0.6) return;
      const i = nodes.length; nodes.push({ x: v.x, y: h.y, e: [] }); at(h, i); at(v, i);
    }));
    on.forEach((ids, r) => {
      const k = r.y !== undefined ? 'x' : 'y';
      ids.sort((i, j) => nodes[i][k] - nodes[j][k]);
      for (let q = 1; q < ids.length; q++) { nodes[ids[q - 1]].e.push(ids[q]); nodes[ids[q]].e.push(ids[q - 1]); }
    });
    NET = { id: TL.id, H, V, nodes, on };
    return NET;
  }
  // For cars (v0.16): the same crossings plus every ramp and the expressway between ramps (marked fast).
  let CARNET = null;
  function carNet() {
    if (CARNET && CARNET.id === TL.id) return CARNET;
    const N0 = roadNet(), nodes = N0.nodes.map(n => ({ x: n.x, y: n.y, e: n.e.slice(), h: 0 })), on = new Map([...N0.on].map(([r, ids]) => [r, ids.slice()]));
    const Hw = TL.highway, deckIds = [];
    const add = (x, y, h, hw) => { nodes.push({ x, y, h, hw, e: [] }); return nodes.length - 1; };
    const link = (a, b) => { nodes[a].e.push(b); nodes[b].e.push(a); };
    (Hw ? Hw.ramps : []).forEach(R => {
      const S2 = smoothPts(R, 1.6), ids = S2.map((p, k) => add(p[0], p[1], p[2], k === 0));
      for (let k = 1; k < ids.length; k++) link(ids[k - 1], ids[k]);
      deckIds.push(ids[0]);
      // the foot of the ramp joins its avenue: a new crossing on that road, linked to its neighbours
      const foot = ids[ids.length - 1], fp = nodes[foot], v = N0.V.find(r => Math.abs(r.x - fp.x) < 1.6 && fp.y >= r.a - 1.5 && fp.y <= r.b + 1.5);
      if (!v) return;
      fp.x = v.x; fp.y = clamp(fp.y, v.a, v.b);
      const list = on.get(v) || [], below = list.filter(i => nodes[i].y > fp.y).sort((i, j) => nodes[i].y - nodes[j].y)[0], above = list.filter(i => nodes[i].y <= fp.y).sort((i, j) => nodes[j].y - nodes[i].y)[0];
      if (below !== undefined) link(foot, below);
      if (above !== undefined) link(foot, above);
      list.push(foot); on.set(v, list);
    });
    deckIds.sort((i, j) => nodes[i].x - nodes[j].x);
    for (let k = 1; k < deckIds.length; k++) link(deckIds[k - 1], deckIds[k]);
    // v0.27: flyovers: a chain of nodes up, along and down; both feet join the road below like a crossing
    const footOn = id => {
      const fp = nodes[id], h = N0.H.find(r => Math.abs(r.y - fp.y) < 1.6 && fp.x >= r.a - 1.5 && fp.x <= r.b + 1.5);
      if (!h) return;
      fp.y = h.y;
      const list = on.get(h) || [], right = list.filter(i => nodes[i].x > fp.x).sort((i, j) => nodes[i].x - nodes[j].x)[0], left = list.filter(i => nodes[i].x <= fp.x).sort((i, j) => nodes[j].x - nodes[i].x)[0];
      if (right !== undefined) link(id, right);
      if (left !== undefined) link(id, left);
      list.push(id); on.set(h, list);
    };
    (TL.flyovers || []).forEach(F => {
      const S2 = smoothPts(F.pts, 1.6), ids = S2.map((p, k) => add(p[0], p[1], k === 0 || k === S2.length - 1 ? 0 : Math.max(0.01, p[2]), p[2] > F.h - 0.5));
      for (let k = 1; k < ids.length; k++) link(ids[k - 1], ids[k]);
      footOn(ids[0]); footOn(ids[ids.length - 1]);
    });
    // v0.27: one-way streets: along them cars only go the way of the arrows
    N0.on.forEach((ids0, r) => {
      if (!r.ow) return;
      const k = r.y !== undefined ? 'x' : 'y', ids = (on.get(r) || ids0).slice().sort((i, j) => nodes[i][k] - nodes[j][k]);
      for (let q = 1; q < ids.length; q++) { const lo = ids[q - 1], hi = ids[q]; if (r.ow > 0) nodes[hi].e = nodes[hi].e.filter(v => v !== lo); else nodes[lo].e = nodes[lo].e.filter(v => v !== hi); }
    });
    CARNET = { id: TL.id, H: N0.H, V: N0.V, nodes, on };
    return CARNET;
  }
  // How long a leg takes compared with a local street (the expressway is faster, ramps a little).
  const legCost = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) / (a.hw && b.hw ? TRIP_SPEED.highway : a.h > 0 || b.h > 0 ? 1.5 : 1);
  // The closest point on any road.
  function nearestRoad(N, p) {
    let best = null, bd = 1e9;
    N.H.forEach(r => { const x = clamp(p[0], r.a, r.b), d = Math.hypot(x - p[0], r.y - p[1]); if (d < bd) { bd = d; best = { r, pt: [x, r.y] }; } });
    N.V.forEach(r => { const y = clamp(p[1], r.a, r.b), d = Math.hypot(r.x - p[0], y - p[1]); if (d < bd) { bd = d; best = { r, pt: [r.x, y] }; } });
    return best;
  }
  // On foot you keep to the sidewalk (the one on the top / left side of each road); cars keep to the road.
  function toSidewalk(N, pts) {
    return pts.map(([x, y]) => {
      const h = N.H.find(r => Math.abs(y - r.y) < 0.01 && x >= r.a - 2.2 && x <= r.b + 2.2), v = N.V.find(r => Math.abs(x - r.x) < 0.01 && y >= r.a - 2.2 && y <= r.b + 2.2);   // a crossing can be just past a road's end
      return [v ? v.x0 + v.sw / 2 : x, h ? h.y0 + h.sw / 2 : y];
    });
  }
  // A route along the roads from a to b (shortest way through the crossings); on the sidewalk unless foot is false.
  function route(a, b, foot = true) {
    return foot ? footRoute(a, b) : routeMid(a, b, true);   // v0.29: on foot along the sidewalks and over the zebras
  }
  function routeMid(a, b, car = false) {
    const N = car && TL.highway ? carNet() : roadNet(), A = nearestRoad(N, a), B = nearestRoad(N, b);
    if (!A || !B) return [b];
    const out = [A.pt];
    // v0.27: a long way along the avenue with the flyover: take it (up and over the crossings)
    const lo = Math.min(A.pt[0], B.pt[0]), hi = Math.max(A.pt[0], B.pt[0]);
    const viaFly = car && A.r === B.r && A.r.y !== undefined && (TL.flyovers || []).some(F => Math.abs(F.pts[0][1] - A.r.y) < 1.6 && F.pts[0][0] > lo && F.pts[F.pts.length - 1][0] < hi);
    if (A.r !== B.r || viaFly) {
      const ns = N.nodes, dist = ns.map(() => 1e9), prev = ns.map(() => -1), done = ns.map(() => false), ends = new Set(N.on.get(B.r) || []);
      const along = (r, i, p, sgn) => (r.y !== undefined ? ns[i].x - p[0] : ns[i].y - p[1]) * r.ow * sgn >= -0.01;   // v0.27: one-way streets
      let starts = (N.on.get(A.r) || []).filter(i => !car || !A.r.ow || along(A.r, i, A.pt, 1)), finish = (N.on.get(B.r) || []).filter(i => !car || !B.r.ow || along(B.r, i, B.pt, -1));
      if (!starts.length) starts = N.on.get(A.r) || [];
      if (!finish.length) finish = N.on.get(B.r) || [];
      ends.clear(); finish.forEach(i => ends.add(i));
      starts.forEach(i => { dist[i] = Math.hypot(ns[i].x - A.pt[0], ns[i].y - A.pt[1]); });
      let goal = -1, best = 1e9;
      for (;;) {
        let u = -1;
        for (let i = 0; i < ns.length; i++) if (!done[i] && dist[i] < 1e9 && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0) break;
        done[u] = true;
        if (ends.has(u)) { const tot = dist[u] + Math.hypot(ns[u].x - B.pt[0], ns[u].y - B.pt[1]); if (tot < best) { best = tot; goal = u; } }
        ns[u].e.forEach(v => { const nd = dist[u] + legCost(ns[u], ns[v]); if (nd < dist[v]) { dist[v] = nd; prev[v] = u; } });
      }
      if (goal < 0) return [b];
      const chain = [];
      for (let u = goal; u >= 0; u = prev[u]) chain.unshift(ns[u].h || ns[u].hw ? [ns[u].x, ns[u].y, ns[u].h || 0, ns[u].hw ? 1 : 0] : [ns[u].x, ns[u].y]);
      out.push(...chain);
    }
    out.push(B.pt, b);
    return out;
  }
  // ---------- on foot (v0.29): along the sidewalks on both sides, across a road only on a zebra crossing ----------
  // Each road has two sidewalk lines. Where two roads meet, the sidewalk stops at the corner if the other road carries
  // on past it (you cross on the zebra beside the junction); a road's dead end gets a crossing of its own. Nodes are
  // the corners, the ends of the zebras and the ends of the lines.
  let FOOT = null;
  function footNet() {
    if (FOOT && FOOT.id === TL.id) return FOOT;
    const H = [], V = [], lines = [], zebras = [], corners = [];
    // a country (dirt) road has no sidewalks or zebras: you walk down the middle and cross where you like
    TL.roads.forEach(r => { const dirt = r[4] === 'dirt', sw = dirt ? (r[3] - r[1] + r[2] - r[0]) : SIDEWALK[r[4]] || 0.35; (r[2] - r[0] >= r[3] - r[1] ? H : V).push({ x0: r[0], y0: r[1], x1: r[2], y1: r[3], sw, dirt, ends: [false, false] }); });
    const mk = (h, c, a, b) => { const L = { h, c, a, b, cuts: [], stops: [a, b] }; lines.push(L); return L; };
    H.forEach(R => { if (R.dirt) { const L = mk(true, (R.y0 + R.y1) / 2, R.x0, R.x1); R.s = [L, L]; } else R.s = [mk(true, R.y0 + R.sw / 2, R.x0, R.x1), mk(true, R.y1 - R.sw / 2, R.x0, R.x1)]; });
    V.forEach(R => { if (R.dirt) { const L = mk(false, (R.x0 + R.x1) / 2, R.y0, R.y1); R.s = [L, L]; } else R.s = [mk(false, R.x0 + R.sw / 2, R.y0, R.y1), mk(false, R.x1 - R.sw / 2, R.y0, R.y1)]; });
    H.forEach(A => V.forEach(B => {
      if (B.x1 < A.x0 - 0.5 || B.x0 > A.x1 + 0.5 || A.y1 < B.y0 - 0.5 || A.y0 > B.y1 + 0.5) return;   // they don't meet (same test as the zebras drawn)
      const [T, Bo] = A.s, [Lf, Rt] = B.s, xL = Lf.c, xR = Rt.c, yT = T.c, yB = Bo.c;
      T.stops.push(xL, xR); Bo.stops.push(xL, xR); Lf.stops.push(yT, yB); Rt.stops.push(yT, yB);
      // the corners join the sidewalks round them (not a corner on the far side of a road that only starts there)
      const skT = B.y0 > A.y0 + A.sw + 0.05, skB = B.y1 < A.y1 - A.sw - 0.05, skL = A.x0 > B.x0 + B.sw + 0.05, skR = A.x1 < B.x1 - B.sw - 0.05;
      if (!skT && !skL) corners.push([T, xL, Lf, yT]);
      if (!skT && !skR) corners.push([T, xR, Rt, yT]);
      if (!skB && !skL) corners.push([Bo, xL, Lf, yB]);
      if (!skB && !skR) corners.push([Bo, xR, Rt, yB]);
      // where the other road carries on past this side (far enough for a zebra), you cross on the zebra, not here
      const zA = [B.x0 - 0.45, B.x1 + 0.45].map(x => !A.dirt && x - 0.3 >= A.x0 && x + 0.3 <= A.x1), zB = [A.y0 - 0.45, A.y1 + 0.45].map(y => !B.dirt && y - 0.3 >= B.y0 && y + 0.3 <= B.y1);
      if (zB[0]) T.cuts.push([xL, xR]);
      if (zB[1]) Bo.cuts.push([xL, xR]);
      if (zA[0]) Lf.cuts.push([yT, yB]);
      if (zA[1]) Rt.cuts.push([yT, yB]);
      if (B.x0 <= A.x0 + 0.5) A.ends[0] = true;
      if (B.x1 >= A.x1 - 0.5) A.ends[1] = true;
      if (A.y0 <= B.y0 + 0.5) B.ends[0] = true;
      if (A.y1 >= B.y1 - 0.5) B.ends[1] = true;
      [B.x0 - 0.45, B.x1 + 0.45].forEach((x, k) => { if (!zA[k]) return; T.stops.push(x); Bo.stops.push(x); zebras.push([[x, yT], [x, yB]]); });
      [A.y0 - 0.45, A.y1 + 0.45].forEach((y, k) => { if (!zB[k]) return; Lf.stops.push(y); Rt.stops.push(y); zebras.push([[xL, y], [xR, y]]); });
    }));
    const deadEnds = [];   // a crossing at each free end of a road (drawn as a zebra too)
    H.forEach(R => R.ends.forEach((on, k) => { if (on || R.dirt) return; const x = k ? R.x1 - 0.75 : R.x0 + 0.75; R.s[0].stops.push(x); R.s[1].stops.push(x); zebras.push([[x, R.s[0].c], [x, R.s[1].c]]); deadEnds.push({ h: true, x, y0: R.y0 + R.sw, y1: R.y1 - R.sw }); }));
    V.forEach(R => R.ends.forEach((on, k) => { if (on || R.dirt) return; const y = k ? R.y1 - 0.75 : R.y0 + 0.75; R.s[0].stops.push(y); R.s[1].stops.push(y); zebras.push([[R.s[0].c, y], [R.s[1].c, y]]); deadEnds.push({ h: false, y, x0: R.x0 + R.sw, x1: R.x1 - R.sw }); }));
    const nodes = [], key = new Map();
    const node = (x, y) => { const k = Math.round(x * 20) + ',' + Math.round(y * 20); if (!key.has(k)) { key.set(k, nodes.length); nodes.push({ x, y, e: [] }); } return key.get(k); };
    const link = (i, j) => { if (i === j) return; const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y); nodes[i].e.push([j, d]); nodes[j].e.push([i, d]); };
    const cut = (L, lo, hi) => { const m = (lo + hi) / 2; return L.cuts.some(([p, q]) => m > Math.min(p, q) + 0.01 && m < Math.max(p, q) - 0.01); };
    lines.forEach(L => {
      L.pos = [...new Set(L.stops.map(v => Math.round(clamp(v, L.a, L.b) * 100) / 100))].sort((p, q) => p - q);
      L.ids = L.pos.map(v => (L.h ? node(v, L.c) : node(L.c, v)));
      for (let i = 1; i < L.pos.length; i++) if (!cut(L, L.pos[i - 1], L.pos[i])) link(L.ids[i - 1], L.ids[i]);
    });
    zebras.forEach(([p, q]) => link(node(p[0], p[1]), node(q[0], q[1])));
    const r2 = v => Math.round(v * 100) / 100;
    corners.forEach(([Lh, x, Lv, y]) => link(node(r2(clamp(x, Lh.a, Lh.b)), Lh.c), node(Lv.c, r2(clamp(y, Lv.a, Lv.b)))));   // (a road can end a little short of the other one's sidewalk)
    // where two roads join end to end with different widths, step from one sidewalk onto the other
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d > 0.01 && d < 0.6 && !nodes[i].e.some(([k]) => k === j)) link(i, j);
    }
    FOOT = { id: TL.id, lines, nodes, zebras, deadEnds, cut };
    return FOOT;
  }
  function footRoute(a, b) {
    const F = footNet(), ns = F.nodes, n = ns.length;
    const snap = p => {
      let best = null;
      F.lines.forEach(L => {
        let v = clamp(L.h ? p[0] : p[1], L.a, L.b);
        const c = L.cuts.find(([x, y]) => v > Math.min(x, y) && v < Math.max(x, y));
        if (c) v = Math.abs(v - c[0]) < Math.abs(v - c[1]) ? c[0] : c[1];   // not in the middle of a junction
        const q = L.h ? [v, L.c] : [L.c, v], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (!best || d < best.d - 1e-6) best = { L, v, q, d };
      });
      return best;
    };
    const A = snap(a), B = snap(b);
    if (!A || !B) return [b];
    const extra = new Map(), add = (i, j, d) => { [[i, j], [j, i]].forEach(([u, v]) => { if (!extra.has(u)) extra.set(u, []); extra.get(u).push([v, d]); }); };
    const attach = (S, t) => {
      const P = S.L.pos; let i = 0;
      while (i < P.length - 2 && P[i + 1] < S.v) i++;
      if (!F.cut(S.L, P[i], P[i + 1])) { add(t, S.L.ids[i], Math.abs(S.v - P[i])); add(t, S.L.ids[i + 1], Math.abs(P[i + 1] - S.v)); }
      else add(t, S.L.ids[Math.abs(S.v - P[i]) < Math.abs(S.v - P[i + 1]) ? i : i + 1], 0);
    };
    attach(A, n); attach(B, n + 1);
    const lo = Math.min(A.v, B.v), hi = Math.max(A.v, B.v);
    if (A.L === B.L && !A.L.cuts.some(([p, q]) => Math.max(p, q) > lo + 0.01 && Math.min(p, q) < hi - 0.01)) add(n, n + 1, hi - lo);
    // Dijkstra with a small binary heap
    const dist = new Float64Array(n + 2).fill(1e9), prev = new Int32Array(n + 2).fill(-1), heap = [[0, n]];
    dist[n] = 0;
    const push = it => { heap.push(it); let k = heap.length - 1; while (k > 0) { const pa = (k - 1) >> 1; if (heap[pa][0] <= heap[k][0]) break; [heap[pa], heap[k]] = [heap[k], heap[pa]]; k = pa; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } }
      return top;
    };
    while (heap.length) {
      const [d, u] = pop();
      if (d > dist[u]) continue;
      if (u === n + 1) break;
      const es = (u < n ? ns[u].e : []).concat(extra.get(u) || []);
      for (const [v, w] of es) if (d + w < dist[v]) { dist[v] = d + w; prev[v] = u; push([d + w, v]); }
    }
    if (dist[n + 1] >= 1e9) return [b];
    const chain = [];
    for (let u = prev[n + 1]; u >= 0 && u !== n; u = prev[u]) chain.unshift([ns[u].x, ns[u].y]);
    const out = [A.q, ...chain, B.q, b];
    return out.filter((q, i) => i === 0 || Math.hypot(q[0] - out[i - 1][0], q[1] - out[i - 1][1]) > 0.01);
  }
  // A home's gate: on the road right in front of it.
  const gateOf = id => { const [ox, oy] = origin(id), N = roadNet(), n = nearestRoad(N, [ox + 3.5, oy + LOT_D + 0.6]); return n ? toSidewalk(N, [n.pt])[0] : [ox + 3.5, oy + LOT_D + 1]; };
  let WALK = { town: null, list: [], next: 0 };
  const walkerOut = id => WALK.town === VIEW_TOWN && WALK.list.some(w => w.id === id);
  function walkers(objs, dt, ts) {
    if (WALK.town !== VIEW_TOWN) WALK = { town: VIEW_TOWN, list: [], next: 0 };
    const now2 = performance.now(), z = cam.z;
    // someone new heads out every few seconds, up to 8 at a time
    if (now2 > WALK.next && WALK.list.length < SHOW_LIMITS.town) {
      WALK.next = now2 + 2500 + Math.random() * 4000;
      const ids = allLots().map(l => l.id).filter(id => id !== 'me' && !WALK.list.some(w => w.id === id) && homeOf(id));
      if (ids.length) {
        const id = ids[Math.floor(Math.random() * ids.length)], g = gateOf(id);
        const others = allLots().filter(l => l.id !== id && homeOf(l.id)), dest = Math.random() < 0.3 && others.length ? gateOf(others[Math.floor(Math.random() * others.length)].id) : TL.places[Math.floor(Math.random() * TL.places.length)];
        const bike = Math.random() < 0.3;   // v0.25: some people ride their bikes (on the road)
        WALK.list.push({ id, h: homeOf(id), x: g[0], y: g[1] - 1.2, path: [[g[0], g[1]], ...(bike ? route(g, dest, false) : route(g, dest))], home: g, phase: 0, face: 1, moving: true, stay: 0, back: false, alpha: 0, bike, bikeCol: COLORS[Math.floor(Math.random() * COLORS.length)] });
      }
    }
    WALK.list = WALK.list.filter(w => {
      if (w.stay > 0) { w.stay -= dt; w.moving = false; if (w.stay <= 0) { w.path = route([w.x, w.y], w.home, !w.bike).concat([[w.home[0], w.home[1] - 1.2]]); w.going = true; } }
      else if (w.path.length) {
        const [tx, ty] = w.path[0], dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy), st = (w.bike ? 4.2 : 1.6) * dt;
        if (w.bike && mustStop(w.x, w.y, tx, ty)) { w.moving = false; } else if (d <= st) { w.x = tx; w.y = ty; w.path.shift(); } else { w.x += dx / d * st; w.y += dy / d * st; }
        faceTo(w, dx, dy); if (d > 0.01) w.cdir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '+x' : '-x') : (dy > 0 ? '+y' : '-y'); w.phase += dt * (w.bike ? 8 : 9.5); w.moving = true;
        if (!w.path.length) { if (w.going) return false; w.stay = 6 + Math.random() * 10; }
      }
      w.alpha = Math.min(1, w.alpha + dt * 2);
      objs.push({ d: w.x + w.y, f: () => {
        const riding = w.bike && w.path.length, o = riding ? { '+x': [0, 0.85], '-x': [0, -0.85], '+y': [-0.85, 0], '-y': [0.85, 0] }[w.cdir || '+x'] : [0, 0], p = iso(w.x + o[0], w.y + o[1]);
        ctx.save(); ctx.globalAlpha = w.alpha;
        if (riding) { drawPerson(p.x, p.y, z, { look: w.h.look, face: w.cdir === '+x' || w.cdir === '-y' ? 1 : -1, energy: 'good', ts, seed: w.x, pose: 'bike', phase: w.phase, bikeCol: w.bikeCol }); }   // v0.25: on a bike, at the right-hand edge of the road
        else drawPerson(p.x, p.y, z, { look: w.h.look, face: w.face, back: w.back && w.moving, view: w.view, turn: w.turn, moving: w.moving, phase: w.phase, energy: 'good', ts, seed: w.x, wave: !w.moving && Math.sin(ts / 900 + w.x) > 0.7 });
        ctx.restore();
        if (chatting(w.id)) emoji(Math.floor(ts / 700) % 2 ? '😄' : '💬', p.x + 10 * z, p.y - 64 * z, 15 * z);   // v0.25: talking with you
        if (z > 0.3) pill(`● ${homeName(w.h)}`, p.x, p.y - 50 * z, 'rgba(255,255,255,.9)', '#2f7d47', `700 ${Math.max(9, 10 * z)}px ${UI_FONT}`, Math.max(15, 17 * z));
        else if (z > 0.12) circle(p.x, p.y - 48 * z, Math.max(2, 3.5 * z), '#34c759', '#fff', 1);
        if (z > 0.2) hits.push({ kind: 'person', id: w.id, pri: 2, x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 46 * z, y1: p.y + 4 });   // v0.25: talk to them
      } });
      return true;
    });
  }
  // v0.25: people in the park: on the benches and on the lawn, chatting; your boss or a coworker now and then
  let PARK_PEOPLE = [], CHAT = null;   // who's in the park now; who you're talking to (and until when)
  const chatting = id => CHAT && CHAT.until > performance.now() && (id === undefined || CHAT.id === id);
  // who's in the park right now (worked out from the time, so it's the same whether you're looking or not)
  function parkList() {
    if (VIEW_TOWN !== myTown() || !TL.park) return [];
    const P = TL.park, dayN = Math.floor(now() / DAY), list = [];
    const ids = allLots().map(l => l.id).filter(id => id !== 'me' && homeOf(id));
    [[P.x + 16.4, P.y + 13.3], [P.x + 17.5, P.y + 13.2], [P.x + 7.4, P.y + 21.2], [P.x + 15.6, P.y + 7.4]].forEach(([x, y], i) => { const id = ids[(dayN * 3 + i * 7) % Math.max(1, ids.length)]; if (id) list.push({ id, look: homeOf(id).look, x, y, i }); });
    if (S.meet && S.meet.until > now()) { const who = whoIs(S.meet.id); if (who) list.push({ id: S.meet.id, look: who.look, x: P.x + 12.6, y: P.y + 13.4, i: 11, work: !!who.wp, boss: !!(who.wp && who.wp.boss) }); }   // v0.26: you asked them on the phone
    const wp = S.job ? workPeople(S.job.place) : [];
    if (wp.length && !S.work && (dayN + new Date(now()).getHours()) % 3 === 0) list.push({ id: wp[1].id, look: wp[1].look, x: P.x + 18.2, y: P.y + 17.5, i: 9, work: true });
    if (wp.length && !S.work && (dayN + new Date(now()).getHours()) % 4 === 1) list.push({ id: wp[0].id, look: wp[0].look, x: P.x + 27, y: P.y + 16.4, i: 10, work: true, boss: true });
    return list;
  }
  function parkPeople(objs, ts) {
    const list = PARK_PEOPLE = parkList();
    list.forEach(pp => objs.push({ d: pp.x + pp.y + 0.3, f: () => {
      const z = cam.z, q = iso(pp.x, pp.y);
      drawPerson(q.x, q.y, z, { look: pp.look, face: pp.i % 2 ? -1 : 1, view: 'front', turn: [pp.i % 2 ? -0.6 : 0.6, 1], energy: 'good', ts, seed: pp.i, pose: 'stand', wave: Math.sin(ts / 1100 + pp.i) > 0.85 });
      if (z > 0.35) { if (pp.work) pill(pp.boss ? `💼 ${t('boss')}` : `💼 ${t('coworker')}`, q.x, q.y - 50 * z - 12, '#fff1d6', '#9a5b12', `800 ${Math.max(9, 10 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(14, 17 * z)); else if (Math.sin(ts / 1500 + pp.i) > 0.6) emoji('💬', q.x + 9 * z, q.y - 44 * z, 10 * z); }
      if (chatting(pp.id)) emoji(Math.floor(ts / 700) % 2 ? '😄' : '💬', q.x + 10 * z, q.y - 50 * z, 15 * z);
      hits.push({ kind: 'person', id: pp.id, work: !!pp.work, pri: 2, x0: q.x - 12 * z, x1: q.x + 12 * z, y0: q.y - 46 * z, y1: q.y + 4 });
    } }));
  }
  // ---------- traffic lights (v0.22): at every crossing on an avenue; cars along x and along y take turns ----------
  let SIGNALS = null;
  function signals() {
    if (SIGNALS && SIGNALS.id === TL.id) return SIGNALS;
    const N = roadNet(), list = [];
    N.nodes.forEach((n, i) => {
      const h = N.H.find(r => Math.abs(r.y - n.y) < 0.01 && n.x >= r.a - 0.6 && n.x <= r.b + 0.6), v = N.V.find(r => Math.abs(r.x - n.x) < 0.01 && n.y >= r.a - 0.6 && n.y <= r.b + 0.6);
      if (!h || !v) return;
      const kh = TL.roads.find(r => r[2] - r[0] >= r[3] - r[1] && Math.abs((r[1] + r[3]) / 2 - n.y) < 0.01), kv = TL.roads.find(r => r[2] - r[0] < r[3] - r[1] && Math.abs((r[0] + r[2]) / 2 - n.x) < 0.01);
      if (!(kh && kh[4] === 'avenue') && !(kv && kv[4] === 'avenue')) return;
      if (n.e.length < 3) return;   // a bend, not a crossing
      list.push({ x: n.x, y: n.y, hw: (h.y1 - h.y0) / 2, vw: (v.x1 - v.x0) / 2, off: (i * 2.3) % 4 });
    });
    SIGNALS = { id: TL.id, list, at: new Map(list.map(s2 => [Math.round(s2.x * 10) + ',' + Math.round(s2.y * 10), s2])) };
    return SIGNALS;
  }
  // 'g' / 'y' / 'r' for traffic along x (axis 'x') or along y at a signal, now
  function lightAt(sg, axis) {
    const t0 = (performance.now() / 1000 + sg.off) % 12, xs = t0 < 5 ? 'g' : t0 < 6 ? 'y' : 'r', ys = t0 >= 6 && t0 < 11 ? 'g' : t0 >= 11 ? 'y' : 'r';
    return axis === 'x' ? xs : ys;
  }
  // a car about to drive into a crossing on red (or yellow, if it's not already in it) waits at the line
  function mustStop(x, y, tx, ty) {
    const sg = signals().at.get(Math.round(tx * 10) + ',' + Math.round(ty * 10));
    if (!sg) return false;
    const d = Math.hypot(tx - x, ty - y), axis = Math.abs(tx - x) > Math.abs(ty - y) ? 'x' : 'y';
    return d < 3.2 && d > 1.9 && lightAt(sg, axis) !== 'g';
  }
  function signalObjs(objs, vr) {
    if (cam.z < 0.16) return;
    signals().list.forEach(sg => {
      if (sg.x < vr.x0 - 2 || sg.x > vr.x1 + 2 || sg.y < vr.y0 - 2 || sg.y > vr.y1 + 2) return;
      [[-1, -1], [1, 1]].forEach(([sx, sy]) => {
        const px = sg.x + sx * (sg.vw + 0.25), py = sg.y + sy * (sg.hw + 0.25);
        objs.push({ d: px + py + 0.2, f: () => {
          const z = cam.z, b = iso(px, py), top = up(b, 34 * z);
          line(b.x, b.y, top.x, top.y, '#4a4f57', 1.6 * z);
          [['x', -6], ['y', 6]].forEach(([axis, dx]) => {
            const L = lightAt(sg, axis), hx = top.x + dx * z, hy = top.y + 2 * z;
            rrect(hx - 2.6 * z, hy - 2 * z, 5.2 * z, 13 * z, 1.4 * z, '#2b2e33');
            [['r', '#ff4d4d', 0], ['y', '#ffc83d', 4], ['g', '#3ddc6a', 8]].forEach(([c2, col, oy]) => circle(hx, hy + 0.6 * z + oy * z, 1.5 * z, L === c2 ? col : '#4a4f57'));
            line(top.x, top.y + 2 * z, hx, hy, '#4a4f57', 1 * z);
            if (L !== 'r' && NIGHT > 0.3) glow(hx, hy + 8 * z, 10 * z, 0.6);
          });
        } });
      });
    });
  }
  // ---------- traffic (v0.21): other people's cars driving between the places in town ----------
  let CARS_OUT = { town: null, list: [], next: 0 };
  // Cars keep right. v0.29: when two pass each other, the one in the lane nearer the camera must be drawn last, or the
  // far one shows through it. Sorting by the middle of the car isn't enough (they're side by side but one is a little
  // ahead), so the lane counts extra.
  const LANE = { '+x': [0, 0.45], '-x': [0, -0.45], '+y': [-0.45, 0], '-y': [0.45, 0] };
  const carDepth = (x, y, dir, h = 0) => { const o = LANE[dir] || [0, 0]; return x + y + 0.6 + (h > 1 ? 0 : (o[0] + o[1]) * 2.1) + (h > 4 ? 3 : 0); };
  // v0.29: a car waits behind the one in front of it in its lane (a queue at the lights doesn't pile into one car)
  const DIRV = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };
  function blocked(x, y, dir, h, others) {
    const v = DIRV[dir];
    return !!v && others.some(o => {
      if (o.dir !== dir || Math.abs((o.h || 0) - (h || 0)) > 2) return false;
      const dx = o.x - x, dy = o.y - y, ahead = dx * v[0] + dy * v[1], side = Math.abs(dx * v[1] - dy * v[0]);
      return ahead > 0.05 && ahead < 2.7 && side < 0.35;
    });
  }
  function traffic(objs, dt, ts) {
    if (CARS_OUT.town !== VIEW_TOWN) CARS_OUT = { town: VIEW_TOWN, list: [], next: 0 };
    const now2 = performance.now(), kinds = Object.keys(CARS).filter(k => !CARS[k].excl && CARS[k].kind !== 'two' && k !== 'tractor');
    if (!CARS_OUT.list.some(c => c.police)) {   // v0.25: a police car on patrol
      const ends = [...TL.places, ...(TL.stores || []).map(st => storeGeo(st).bay)], a = ends[Math.floor(Math.random() * ends.length)], b = ends[Math.floor(Math.random() * ends.length)];
      if (a && b && a !== b) { const path = route(a, b, false); if (path.length > 2) CARS_OUT.list.push({ police: true, car: { k: 'sedan', color: '#24324f' }, x: path[0][0], y: path[0][1], path: path.slice(1), dir: '+x', h: 0, alpha: 0 }); }
    }
    if (now2 > CARS_OUT.next && CARS_OUT.list.length < 7) {
      CARS_OUT.next = now2 + 1800 + Math.random() * 2600;
      const ends = [...TL.places, ...(TL.stores || []).map(st => storeGeo(st).bay), ...allLots().filter(l => homeOf(l.id)).slice(0, 20).map(l => gateOf(l.id))];
      if (ends.length > 1) {
        const a = ends[Math.floor(Math.random() * ends.length)], b = ends[Math.floor(Math.random() * ends.length)];
        if (a !== b) { const path = route(a, b, false); if (path.length > 2) CARS_OUT.list.push({ car: { k: kinds[Math.floor(Math.random() * kinds.length)], color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] }, x: path[0][0], y: path[0][1], path: path.slice(1), dir: '+x', h: 0, alpha: 0 }); }
      }
    }
    CARS_OUT.list = CARS_OUT.list.filter(c => {
      let go = 6 * dt;
      if (c.path.length && !c.h && mustStop(c.x, c.y, c.path[0][0], c.path[0][1])) go = 0;   // v0.22: red light
      if (go && c.path.length && blocked(c.x, c.y, c.dir, c.h, [...CARS_OUT.list.filter(o => o !== c && o.alpha > 0.3), ...(trip && trip.inCar && !trip.arrived && trip.town === VIEW_TOWN ? [trip] : [])])) go = 0;
      while (go > 0 && c.path.length) { const [tx, ty, th = 0] = c.path[0], dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy); if (d > 0.01) c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '+x' : '-x') : (dy > 0 ? '+y' : '-y'); if (d <= go) { c.x = tx; c.y = ty; c.h = th; c.path.shift(); go -= d; } else { c.x += dx / d * go; c.y += dy / d * go; c.h += (th - c.h) * (go / d); go = 0; } }
      if (c.police && !c.path.length) { const b = TL.places[Math.floor(Math.random() * TL.places.length)], np = b && route([c.x, c.y], b, false); if (np && np.length > 2) c.path = np.slice(1); }   // v0.25: the patrol never ends
      c.alpha = c.path.length ? Math.min(1, c.alpha + dt * 2) : c.alpha - dt * 2;
      if (c.alpha <= 0 && !c.path.length) return false;
      // keep to the right-hand side of the road
      const off = LANE[c.dir] || [0, 0.45];
      objs.push({ d: carDepth(c.x, c.y, c.dir, c.h || 0), f: () => { ctx.save(); ctx.globalAlpha = Math.max(0, c.alpha); ctx.translate(0, -(c.h || 0) * cam.z); drawCarDir(c.car, c.x + off[0], c.y + off[1], c.dir, ts);
        if (c.police) {   // a light bar on the roof, flashing red and blue
          const z2 = cam.z, lp = up(iso(c.x + off[0], c.y + off[1]), 16 * z2), on = Math.floor(ts / 260) % 2;
          ctx.save(); ctx.globalAlpha *= 0.35; circle(lp.x - 4 * z2, lp.y, 7 * z2, on ? '#ff4d4d' : 'rgba(0,0,0,0)'); circle(lp.x + 4 * z2, lp.y, 7 * z2, on ? 'rgba(0,0,0,0)' : '#3b7bff'); ctx.restore();
          rrect(lp.x - 7 * z2, lp.y - 2 * z2, 14 * z2, 4 * z2, 1.4 * z2, '#2a2d33');
          rrect(lp.x - 6.4 * z2, lp.y - 1.5 * z2, 6 * z2, 3 * z2, 1 * z2, on ? '#ff4d4d' : '#8a2020'); rrect(lp.x + 0.4 * z2, lp.y - 1.5 * z2, 6 * z2, 3 * z2, 1 * z2, on ? '#2a5fd8' : '#7ab0ff');
          if (NIGHT > 0.3) glow(lp.x, lp.y, 22 * z2, 0.9);
        }
        ctx.restore(); } });
      return true;
    });
  }
  // ---------- going somewhere in town (v0.12; v0.19: from where you are, and by car from where it's parked) ----------
  // Where you are is kept in S.out (null = at home) and where your car is in S.carAt (null = in your drive). A trip is a
  // few legs: walk to your car if it isn't with you, drive along the roads to the car park of where you're going and
  // park in a bay, then walk to the door. Nobody jumps from place to place.
  let trip = null, TRIP_CAR = null;
  const outHere = () => !!(S && S.out && S.out.town === VIEW_TOWN);
  // Where you're standing in this town right now.
  function mePos() {
    if (trip && !trip.arrived && trip.town === VIEW_TOWN) return [trip.x, trip.y];   // v0.29: on the way: right where you are
    if (S.work && VIEW_TOWN === myTown() && placePt(S.work.place)) return placePt(S.work.place);
    if (S.jail && VIEW_TOWN === myTown() && placePt('police')) return placePt('police');
    if (S.study && VIEW_TOWN === myTown() && placePt('school')) return placePt('school');
    if (outHere()) return S.out.pt;
    return gateOf('me');
  }
  const atHomeNow = () => !(trip && !trip.arrived) && !outHere() && !S.work && !S.jail;
  // Your car: in a car park somewhere (S.carAt) or in your drive.
  const homeBay = () => { const [ox, oy] = origin('me'), sp = driveOf(S.me).spots[0]; return [ox + sp[0], oy + sp[1]]; };
  // v0.22: where each car waits at home: the one you drive in the drive, the others in the garage's spaces
  function homeCarPt(i) {
    const h = S.me, [ox, oy] = origin('me'), sl = carSlots(h), dr = sl.drive.find(([j]) => j === i);
    if (dr) return [ox + dr[1][0], oy + dr[1][1]];
    const slot = sl.garage.indexOf(i);
    if (slot < 0 || !h.garageLv) return homeBay();
    const G = areaOf(h, 'garage'), bay = (G.w - 0.4) / garageCap(h);
    return [ox + G.x + 0.2 + bay * (slot + 0.5), oy + G.y + G.d - 0.4];
  }
  const doorPt = () => { const [ox, oy] = origin('me'), [fx, fy, fw, fd] = HOUSES[S.me.house].fp; return [ox + DOOR_X, oy + fy + fd + 0.7]; };
  const carPos = () => (trip && !trip.arrived && trip.inCar ? [trip.x, trip.y] : S.carAt && S.carAt.town === VIEW_TOWN ? S.carAt.pt : homeBay());
  // Where a car parks: a bay in the store's car park, the car park by a place, a friend's drive, your own drive.
  const PARK_OF = { plaza: 'centre', bakery: 'centre', cafe: 'centre', market: 'centre', gym: 'centre', library: 'centre', post: 'centre', clinic: 'centre', park: 'park', lake: 'lake', fields: 'fields' };
  function lotBay(L) { const [, x, y, w, d, f] = L; return { pt: [x + w / 2, y + d / 2], dir: f === 'N' ? '+y' : f === 'E' ? '-x' : f === 'W' ? '+x' : '-y' }; }
  function bayOf(dest, place, to) {
    if (dest === 'me') return { pt: homeBay(), dir: '-y', home: true };
    if (dest) { const [ox, oy] = origin(dest); return { pt: [ox + 1, oy + 12.8], dir: '-y' }; }
    const st = place && (TL.stores || []).find(([k]) => k === place);
    if (st) { const G = storeGeo(st); return { pt: G.bay, dir: G.dir }; }
    const L = place && (TL.parks || []).find(([k]) => k === PARK_OF[place]);
    if (L) return lotBay(L);
    // anywhere else: the closest car park or store bay
    const all = [...(TL.parks || []).map(lotBay), ...(TL.stores || []).map(st => { const G = storeGeo(st); return { pt: G.bay, dir: G.dir }; })];
    return all.sort((A, B) => Math.hypot(A.pt[0] - to[0], A.pt[1] - to[1]) - Math.hypot(B.pt[0] - to[0], B.pt[1] - to[1]))[0] || { pt: to, dir: '+y' };
  }
  // The legs of a trip to `to` (walk / car / bike).
  function planTrip(to, how, dest, place) {
    TL = layoutOf(VIEW_TOWN);
    const from = mePos(), legs = [];
    if (how === 'walk') return [{ how: 'walk', from, path: route(from, to) }];
    const home = atHomeNow() && !S.carAt, pick = home && TRIP_CAR !== null ? TRIP_CAR : S.me.car;
    const car0 = home ? homeCarPt(pick) : carPos(), bay = bayOf(dest, place, to);
    if (home) legs.push({ how: 'walk', from: doorPt(), path: [car0], toCar: true });   // v0.22: out of the house to the drive / the garage
    else if (Math.hypot(car0[0] - from[0], car0[1] - from[1]) > 0.8) legs.push({ how: 'walk', from, path: route(from, car0), toCar: true });
    const out = home && Math.hypot(car0[0] - homeBay()[0], car0[1] - homeBay()[1]) > 0.5 ? [homeBay()] : [];   // a garage car comes out by the drive
    legs.push({ how, from: car0, path: [...out, ...route(out[0] || car0, bay.pt, false)], car: true, bay });
    const far = Math.hypot(to[0] - bay.pt[0], to[1] - bay.pt[1]);
    if (!bay.home && far > 0.6) legs.push({ how: 'walk', from: bay.pt, path: far < 7 ? [to] : route(bay.pt, to) });
    return legs;
  }
  // Travel time in "local street" units: expressway legs count less (v0.16).
  const legLen = L => { let d = 0, [x, y] = L.from, hw = false; L.path.forEach(([a, b, h = 0, f = 0]) => { const q = Math.hypot(a - x, b - y); d += q / (f && hw ? TRIP_SPEED.highway : h > 0 ? 1.5 : 1); hw = !!f; x = a; y = b; }); return d; };
  const tripSecs = legs => legs.reduce((t, L) => t + legLen(L) / (TRIP_SPEED[L.how] || 3), 0);
  // v0.29: stop on the way (to go somewhere else instead, or just to stay): you stay right where you are. A car pulls
  // over to the kerb (after coming down off the flyover), and you get out beside it. Still walking out to your car at
  // home: you just go back in.
  const KERB = { '+x': [0, 1], '-x': [0, -1], '+y': [-1, 0], '-y': [1, 0] };
  function stopTripHere() {
    if (!trip || trip.arrived) return false;
    const L = trip.legs[trip.li];
    if (trip.fromHome && trip.li === 0 && L && L.toCar) { trip = null; S.trip = null; S.out = null; return true; }
    while ((trip.h || 0) > 0.01 && trip.path.length) { const q = trip.path.shift(); trip.x = q[0]; trip.y = q[1]; trip.h = q[2] || 0; }
    trip.h = 0;
    let pt = [trip.x, trip.y];
    if (trip.inCar) {
      const k = KERB[trip.dir] || [0, 1], c = [trip.x + k[0] * 0.75, trip.y + k[1] * 0.75];
      S.carAt = { town: trip.town, pt: c, dir: trip.dir, id: null, place: null };
      pt = [c[0] + k[0] * 0.6, c[1] + k[1] * 0.6];
    }
    S.out = { town: trip.town, pt, place: null, id: null };
    S.trip = null; trip = null;
    return true;
  }
  function startTrip(to, how, car, done, dest, place) {
    if (trip && !trip.arrived) stopTripHere();   // v0.29: from where you are now (not back to where you set off)
    const fromHome = atHomeNow();
    const legs = planTrip(to, how, dest, place), L0 = legs[0], [x, y] = L0.from;
    trip = { town: VIEW_TOWN, legs, li: 0, how: L0.how, inCar: !!L0.car, car, x, y, path: L0.path.slice(), done, dest, place, face: 1, phase: 0, moving: true, dir: '+y', arrived: false, t: now(), fromHome };
    if (L0.car) S.carAt = null;   // the car pulls out of where it was parked
    S.trip = { to, how, dest: dest || null, place: place || null, town: VIEW_TOWN };   // if the app closes on the way, you still get there
    if (S.out) S.out = { ...S.out, place: null };   // you've left where you were
    if (S.jail && S.jail.out) S.jail = null;
    cancel(me); fly = null;
    return trip;
  }
  // One leg is done: park the car (after a car leg), start the next leg, or you're there.
  function nextLeg(silent) {
    const L = trip.legs[trip.li];
    if (L && L.car) {
      S.carAt = L.bay.home ? null : { town: trip.town, pt: L.bay.pt, dir: L.bay.dir, id: trip.dest || null, place: trip.place || null };
      trip.inCar = false; trip.x = L.bay.pt[0]; trip.y = L.bay.pt[1];
    }
    trip.li++;
    const N = trip.legs[trip.li];
    if (N) { trip.how = N.how; trip.path = N.path.slice(); trip.inCar = !!N.car; if (N.car) S.carAt = null; return; }
    trip.arrived = true; trip.moving = false; trip.view = null; S.trip = null;
    S.out = trip.dest === 'me' ? null : { town: trip.town, pt: [trip.x, trip.y], place: trip.place || null, id: trip.dest || null };
    const f = trip.done; trip.done = null;
    if (f && !silent) setTimeout(f, 200);
  }
  // Skip the rest of the way (the ⏩ button, or when you leave the town view): everything ends up where it would.
  function finishTripNow(silent) {
    if (!trip) return;
    let guard = 20;
    while (trip && !trip.arrived && guard--) {
      const end = trip.path[trip.path.length - 1];
      if (end) { trip.x = end[0]; trip.y = end[1]; }
      trip.path = []; trip.h = 0; nextLeg(silent);
    }
  }
  function stepTrip(dt) {
    if (!trip) return;
    if (trip.town !== VIEW_TOWN || mode !== 'town') { finishTripNow(true); return; }
    if (trip.arrived) return;
    if (trip.inCar && trip.path.length && !trip.h && mustStop(trip.x, trip.y, trip.path[0][0], trip.path[0][1]) && (trip.waited = (trip.waited || 0) + dt) < 7) return;   // v0.22: red light
    if (trip.inCar && trip.path.length && !mustStop(trip.x, trip.y, trip.path[0][0], trip.path[0][1])) trip.waited = 0;
    if (trip.inCar && trip.path.length && CARS_OUT.town === trip.town && blocked(trip.x, trip.y, trip.dir, trip.h || 0, CARS_OUT.list.filter(o => o.alpha > 0.3))) { if ((trip.carWait = (trip.carWait || 0) + dt) < 6) return; }   // v0.29: behind another car
    else trip.carWait = 0;
    const base = (TRIP_SPEED[trip.how] || 3) * dt * (trip.how === 'walk' && isFed() ? 1 + MALL.fed.walk : 1);
    let left = 1;   // the share of this frame's travel still to go
    while (left > 0 && trip.path.length) {
      const [tx, ty, th = 0, fast = 0] = trip.path[0], dx = tx - trip.x, dy = ty - trip.y, d = Math.hypot(dx, dy);
      const sp = base * (fast && trip.hw ? TRIP_SPEED.highway : th > 0 || (trip.h || 0) > 0 ? 1.5 : 1), go = sp * left;
      if (d > 0.01) { trip.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '+x' : '-x') : (dy > 0 ? '+y' : '-y'); faceTo(trip, dx, dy); }
      if (d <= go) { trip.x = tx; trip.y = ty; trip.h = th; trip.hw = !!fast; trip.path.shift(); left -= d / sp; }
      else { const k = go / d; trip.x += dx * k; trip.y += dy * k; trip.h = (trip.h || 0) + (th - (trip.h || 0)) * k; left = 0; }
    }
    trip.phase += dt * (trip.inCar ? 7 : trip.how === 'bike' ? 9 : 11);
    if (!trip.path.length) nextLeg(false);
  }
  function drawTrip(ts) {
    const z = cam.z, p = iso(trip.x, trip.y);
    if (trip.inCar) { const off = (trip.h || 0) > 1 ? [0, 0] : trip.dir === '+x' ? [0, 0.45] : trip.dir === '-x' ? [0, -0.45] : trip.dir === '+y' ? [-0.45, 0] : [0.45, 0]; ctx.save(); ctx.translate(0, -(trip.h || 0) * z); drawCarDir(trip.car, trip.x + off[0], trip.y + off[1], trip.dir, ts); ctx.restore(); return; }   // v0.24: on the right
    drawPerson(p.x, p.y, z, { look: S.me.look, face: trip.face, back: trip.back && trip.moving, view: trip.view, turn: trip.turn, moving: trip.moving, phase: trip.phase, energy: energyLevel(), ts, seed: 3, pose: trip.moving ? 'walk' : 'stand' });
    carryBox(p, z);
    if (z > 0.3) nameTag(p, S.me.name || '🙂', true);
  }
  // v0.20: carrying things home in a cardboard box
  function carryBox(p, z) {
    if (!S.bag || !S.bag.hands || !S.bag.hands.length) return;
    rrect(p.x - 6 * z, p.y - 25 * z, 12 * z, 9 * z, 1.2 * z, '#c99a6b', '#a07a50', 0.8 * z); line(p.x - 6 * z, p.y - 22 * z, p.x + 6 * z, p.y - 22 * z, '#e8d3a8', 1.6 * z);
  }
  // You, standing where you are out in town.
  function drawMeOut(x, y, ts) {
    const z = cam.z, p = iso(x, y);
    drawPerson(p.x, p.y, z, { look: S.me.look, face: 1, view: 'front', turn: [0.7, 0.7], energy: energyLevel(), ts, seed: 3, pose: 'stand', wave: chatting() && Math.floor(ts / 900) % 2 === 0 });
    if (chatting()) emoji(Math.floor(ts / 700) % 2 ? '💬' : '😊', p.x - 10 * z, p.y - 50 * z, 15 * z);
    carryBox(p, z);
    if (z > 0.3) nameTag(p, S.me.name || '🙂', true);
  }
  // Your car where you parked it.
  function parkedObjs(objs, ts) {
    const c = S.carAt, car = S.me.cars[S.me.car];
    if (!c || !car || c.town !== VIEW_TOWN || (trip && trip.inCar && !trip.arrived)) return;
    const [x, y] = c.pt;
    objs.push({ d: x + y, f: () => drawCarDir(car, x, y, c.dir, ts) });
  }
  // ---------- inside a store (v0.20): walk round it, the things for sale on show, the shopkeeper at the counter ----------
  const SHOPS = {}, IMGS = {};
  const meS = { x: 0, y: 0, path: [], face: 1, phase: 0, moving: false, then: null };
  const SHOP_W = { market: 13, nursery: 17, ranch: 15, petshop: 13, furniture: 17, realty: 13, dealer: 17, mall: 17 };
  const SHOP_FLOOR = { market: ['#efe9dc', '#e6dfcf'], nursery: ['#d9cdb3', '#cfc2a6'], ranch: ['#d8c39a', '#ccb68b'], petshop: ['#eef1f6', '#e3e7ee'], furniture: ['#e6d3b8', '#dcc7a8'],
    realty: ['#efeae2', '#e5ded3'], dealer: ['#e9edf1', '#dfe4ea'], mall: ['#f2ede6', '#e8e1d8'] };
  // ---------- inside every building (v0.30) ----------
  // The bakery, café, clinic, library, gym, post office, school, town hall, police station, fire station and petrol
  // station are real rooms you walk into, built like the stores: walls with the sign, the door at the front, someone
  // behind the counter (tap them for the place's panel) and things to tap that do something (`spot`s: walk over, then
  // the sheet for it opens; some you then sit at, lie on or work out on for a while: `use`).
  const VENUE_LOOK = {
    bakery:  { wall: '#fbeedd', roof: '#c9893a', floor: ['#f3e7d3', '#eadcc4'], till: '🥐', clerk: { shirt: '#ffffff', hat: 'beanie', hatCol: '#ffffff', top: 'tshirt' } },
    cafe:    { wall: '#efe2d2', roof: '#6b4428', floor: ['#c9a27a', '#bf9670'], till: '☕', clerk: { shirt: '#3b3125', top: 'polo' } },
    clinic:  { wall: '#f2f7f8', roof: '#38a3e0', floor: ['#eef3f4', '#e4ebec'], till: '📋', clerk: { shirt: '#9fd6d2', top: 'polo' } },
    library: { wall: '#efe6d6', roof: '#7a4a2a', floor: ['#cfa97c', '#c59f72'], till: '📚', clerk: { shirt: '#6b5bd0', top: 'sweater' } },
    gym:     { wall: '#eceff3', roof: '#e5484d', floor: ['#5b6470', '#545c67'], till: '🧴', clerk: { shirt: '#e5484d', top: 'tshirt', bottom: 'shorts', pants: '#2d2d2d', shoes: 'hightops' } },
    post:    { wall: '#eef3fa', roof: '#2f6fb2', floor: ['#e9e6df', '#dfdbd2'], till: '📮', clerk: { shirt: '#2f6fb2', top: 'polo', hat: 'cap', hatCol: '#2f6fb2' } },
    school:  { floor: ['#d9c3a0', '#cfb893'], till: '🍎', clerk: { shirt: '#8a5a36', top: 'jacket', inner: '#f4f4f0', hair: 'bun' } },
    plaza:   { wall: '#f4efe4', roof: '#8a6a3a', floor: ['#ece6da', '#e2dbcd'], till: '🖋️', clerk: { shirt: '#2d2d2d', top: 'jacket', inner: '#f4f4f0' } },
    police:  { floor: ['#e6e9ee', '#dce0e6'], till: '🚓', clerk: { shirt: '#24324f', top: 'polo', hat: 'cap', hatCol: '#24324f' } },
    firestation: { floor: ['#b9bcc0', '#b1b4b8'], till: '🧯', clerk: { shirt: '#c9433b', top: 'jacket', inner: '#f2c230' } },
    gas:     { floor: ['#eef0f2', '#e4e7ea'], till: '🥤', clerk: { shirt: '#e5484d', top: 'polo', hat: 'cap', hatCol: '#e5484d' } },
  };
  const venueLook = k => VENUE_LOOK[k] && { ...(STORES[k] || {}), ...(PLACE_INFO[k] || {}), wall: VENUE_LOOK[k].wall || (STORES[k] || {}).wall || '#f1f0ea', roof: VENUE_LOOK[k].roof || (STORES[k] || {}).roof || '#c9893a' };
  const FOLK = i => (i % 2 ? AUDIENCE_LOOKS : TABLE_LOOKS)[i % 6];
  function venuePlan(k) {
    if (SHOPS[k]) return SHOPS[k];
    const wares = [], decor = [];
    let n = 0;
    const spot = (key, x, y, w, d, ex = {}) => wares.push({ id: 'spot:' + key + ':' + n++, kind: 'spot', k: key, x, y, w, d, price: 0, ...ex });
    const dec = (kind, x, y, w, d, ex = {}) => decor.push({ kind, x, y, w, d, ...ex });
    const furn = (fk, x, y, ex = {}) => dec('furn', x, y, FURN[fk].w, FURN[fk].d, { k: fk, ...ex });
    const who = (x, y, ex) => dec('person', x, y, 0.5, 0.5, ex);
    let P;
    if (k === 'bakery') {
      dec('breadshelf', 0.4, 0.2, 5.4, 0.6);
      spot('oven', 8.0, 0.3, 2.8, 1.3, { draw: 'oven', stand: [9.4, 2.4] });
      spot('case', 1.2, 3.4, 3.2, 1.0, { draw: 'case', items: ['🥐', '🥖', '🍩', '🧁', '🥨'] });
      spot('table', 1.4, 6.6, 1.3, 1.3, { draw: 'table', i: 1, stand: [2.05, 8.4], use: { at: [1.3, 7.25], pose: 'sit', face: 1, seatH: 7, prop: '🥐' } });
      dec('table', 4.4, 6.8, 1.3, 1.3, { i: 0 });
      furn('monstera', 10.8, 8.4); furn('plant', 0.4, 8.5);
      P = { RW: 12, RD: 10, door: [6.5, 9.3], counter: { x: 7.6, y: 4.8, w: 3.2, d: 0.9 } };
    } else if (k === 'cafe') {
      spot('menu', 8.6, 0.12, 3.0, 0.2, { draw: 'menuboard', stand: [10.2, 3.95] });
      dec('table', 1.4, 1.8, 1.3, 1.3, { i: 0 }); dec('table', 4.4, 1.8, 1.3, 1.3, { i: 2 }); dec('table', 1.4, 5.0, 1.3, 1.3, { i: 3 });
      spot('table', 4.4, 5.0, 1.3, 1.3, { draw: 'table', i: 1, stand: [5.05, 6.8], use: { at: [4.3, 5.65], pose: 'sit', face: 1, seatH: 7, prop: '☕', mate: true } });
      dec('rug', 7.8, 6.0, 3.6, 3.0, { col: '#b5563c', flat: true });
      spot('sofa', 8.2, 7.2, 2, 1, { furn: 'sofa', tint: '#7a4a2a', stand: [9.2, 8.8], use: { at: [9.2, 7.65], pose: 'sit', face: 1, view: 'front', seatH: 8.5, prop: '🎧' } });
      furn('coffeetable', 8.4, 6.2); furn('shelf', 0.3, 9.0); furn('monstera', 12.0, 9.6); furn('arclamp', 11.2, 6.6);
      P = { RW: 13, RD: 11, door: [3, 10.3], counter: { x: 8.6, y: 2.4, w: 3.2, d: 0.9 } };
    } else if (k === 'clinic') {
      dec('glass', 7.0, 0.1, 0.15, 5.0); dec('glass', 7.0, 5.0, 2.2, 0.15); dec('glass', 11.4, 5.0, 2.5, 0.15);
      spot('bed', 9.4, 0.9, 2.8, 1.1, { draw: 'exambed', stand: [10.8, 2.7], use: { at: [10.8, 1.45], pose: 'lie', lift: 10, dir: -2.68 } });
      who(8.4, 2.4, { look: { shirt: '#ffffff', top: 'jacket', inner: '#9fd6d2', hair: 'short', hairCol: '#5b5f66', skin: '#f3c59f' }, face: 1, view: 'front', turn: [0.6, -0.4], prop: '🩺' });
      dec('chairs', 1.0, 7.4, 3.8, 0.8, { n: 4, sat: [0, 2] });
      spot('scale', 7.4, 7.2, 1.0, 1.0, { draw: 'healthpod', stand: [7.9, 8.8] });
      spot('pharmacy', 10.4, 6.6, 3.0, 0.7, { draw: 'medshelf', stand: [11.9, 8.0] });
      furn('plant', 0.4, 9.6); furn('monstera', 5.6, 0.4); dec('watercooler', 5.8, 7.6, 0.6, 0.6);
      P = { RW: 14, RD: 11, door: [3, 10.3], counter: { x: 1.4, y: 3.2, w: 3.2, d: 0.9 } };
    } else if (k === 'library') {
      dec('bookwall', 0.4, 0.2, 13.2, 0.7);
      dec('bookwall', 8.4, 3.0, 4.8, 0.8, { low: true }); dec('bookwall', 8.4, 5.6, 4.8, 0.8, { low: true });
      spot('featured', 5.0, 2.4, 1.2, 0.9, { draw: 'bookstand', stand: [5.6, 4.0] });
      dec('longtable', 1.0, 3.4, 2.4, 1.2, { readers: [0, 1] });
      spot('table', 1.0, 6.6, 2.4, 1.2, { draw: 'longtable', readers: [], stand: [0.6, 8.4], use: { at: [0.55, 7.2], pose: 'sit', face: 1, seatH: 8, prop: '📖' } });
      furn('armchair', 5.4, 9.6); furn('arclamp', 6.6, 9.4); furn('roundrug', 4.6, 8.6, { flat: true }); furn('plant', 0.4, 10.6);
      P = { RW: 14, RD: 12, door: [3, 11.3], counter: { x: 9.6, y: 9.0, w: 3.2, d: 0.9 } };
    } else if (k === 'gym') {
      dec('mirrorwall', 0.3, 0.05, 14.4, 0.12);
      const work = (fk, x, y, at, pose, ex = {}) => spot(fk, x, y, FURN[fk].w, FURN[fk].d, { furn: fk, tint: '#38a3e0', stand: ex.stand || [x + FURN[fk].w / 2, y + FURN[fk].d + 0.6], use: { at, pose, ...ex.use } });
      work('treadmill', 1.0, 1.0, [1.5, 2.0], 'run', { use: { lift: 4, face: 1, moving: true } });
      furn('treadmill', 2.6, 1.0); who(3.1, 2.0, { pose: 'run', lift: 4, face: 1, moving: true, look: 3 });
      work('spinbike', 4.8, 1.3, [5.3, 1.8], 'bike', { use: { face: 1, moving: true } });
      furn('spinbike', 6.2, 1.3); who(6.7, 1.8, { pose: 'bike', face: 1, moving: true, look: 4 });
      work('dumbbells', 8.2, 1.0, [8.7, 2.4], 'lift', { stand: [8.7, 2.6], use: { face: 1 } });
      work('boxing', 12.4, 1.4, [12.2, 2.5], 'box', { stand: [12.0, 2.9], use: { face: 1 } });
      work('yogamat', 9.4, 5.0, [9.9, 6.0], 'yoga', { stand: [9.9, 7.4], use: { face: 1 } });
      furn('yogamat', 11.0, 5.0, { tint: '#ec6aa8' }); who(11.5, 6.0, { pose: 'yoga', face: -1, look: 5 });
      dec('lockers', 14.0, 6.0, 0.7, 3.4); dec('watercooler', 6.4, 9.6, 0.6, 0.6); furn('plant', 0.4, 6.0);
      P = { RW: 15, RD: 12, door: [3, 11.3], counter: { x: 1.0, y: 8.6, w: 3.2, d: 0.9 } };
    } else if (k === 'post') {
      spot('boxes', 0.5, 0.15, 5.0, 0.5, { draw: 'poboxes', stand: [3.0, 1.6] });
      dec('parcels', 6.4, 0.3, 5.0, 0.8);
      spot('cards', 1.0, 5.2, 1.0, 1.0, { draw: 'cardrack', stand: [1.5, 6.8] });
      dec('redbox', 10.6, 7.4, 0.8, 0.8); furn('plant', 0.4, 8.6); dec('scaletable', 4.0, 5.4, 1.4, 0.8);
      P = { RW: 12, RD: 10, door: [3, 9.3], counter: { x: 6.6, y: 3.8, w: 3.6, d: 0.9 } };
    } else if (k === 'school') {
      dec('blackboard', 3.0, 0.1, 7.0, 0.15);
      [[2.0, 4.4, 0], [5.0, 4.4, 1], [8.0, 4.4, 2], [11.0, 4.4, -1], [2.0, 6.8, 3], [5.0, 6.8, -1], [11.0, 6.8, 4]].forEach(([x, y, kid]) => dec('schooldesk', x, y, 1.2, 0.8, { kid }));
      spot('desk', 8.0, 6.8, 1.2, 0.8, { draw: 'schooldesk', kid: -1, stand: [8.6, 8.5], use: { at: [8.6, 7.75], pose: 'sit', face: 1, seatH: 7, prop: '✏️' } });
      furn('shelf', 0.3, 9.6); dec('globe', 12.6, 1.0, 0.8, 0.8); furn('plant', 12.8, 9.6);
      P = { RW: 14, RD: 11, door: [3, 10.3], counter: { x: 5.2, y: 1.8, w: 3.2, d: 0.9 } };
    } else if (k === 'plaza') {
      spot('board', 4.5, 0.12, 5.0, 0.2, { draw: 'townboard', stand: [7.0, 1.6] });
      dec('flag', 1.0, 0.6, 0.6, 0.6, { col: '#e5484d' }); dec('flag', 12.4, 0.6, 0.6, 0.6, { col: '#2f6fb2' });
      dec('model', 4.6, 4.0, 3.0, 2.0);
      dec('bench', 1.0, 6.4, 2.4, 0.6); dec('bench', 1.0, 8.4, 2.4, 0.6);
      furn('monstera', 0.4, 0.4); furn('monstera', 13.0, 9.6); furn('bigrug', 5.6, 7.4, { flat: true });
      P = { RW: 14, RD: 11, door: [7, 10.3], counter: { x: 9.6, y: 5.0, w: 3.2, d: 0.9 } };
    } else if (k === 'police') {
      dec('cell', 8.6, 0.3, 4.0, 3.4);
      spot('board', 2.6, 0.12, 3.2, 0.2, { draw: 'noticeboard', stand: [4.2, 1.6] });
      dec('officedesk', 6.0, 5.6, 2.0, 1.0); dec('officedesk', 9.6, 5.6, 2.0, 1.0);
      who(7.0, 7.0, { pose: 'sit', seatH: 8, face: 1, view: 'back', look: { shirt: '#24324f', top: 'polo', hair: 'short', hairCol: '#1d1a17', skin: '#d39a6c' } });
      furn('plant', 0.4, 8.6); dec('watercooler', 12.2, 8.6, 0.6, 0.6);
      P = { RW: 13, RD: 10, door: [3, 9.3], counter: { x: 1.4, y: 4.2, w: 3.2, d: 0.9 } };
    } else if (k === 'firestation') {
      spot('truck', 1.2, 0.9, 2.2, 5.6, { draw: 'firetruck', stand: [4.2, 4.0] });
      dec('lockers', 9.4, 0.3, 4.6, 0.7, { along: true, helmets: true }); dec('pole', 7.4, 2.4, 0.6, 0.6); dec('hosereel', 5.4, 0.4, 1.2, 0.6);
      who(12.0, 2.6, { face: -1, view: 'front', turn: [-0.4, 1], look: { shirt: '#c9433b', top: 'jacket', inner: '#f2c230', hair: 'curly', hairCol: '#1d1a17', skin: '#9a6440', hat: 'cap', hatCol: '#f2c230' } });
      dec('stripes', 0.8, 7.4, 3.0, 0.5, { flat: true });
      P = { RW: 15, RD: 11, door: [6, 10.3], counter: { x: 9.8, y: 6.2, w: 3.2, d: 0.9 } };
    } else {   // gas
      spot('fridge', 0.4, 0.2, 3.6, 0.7, { draw: 'drinkfridge', stand: [2.2, 1.6] });
      spot('shelf', 1.2, 3.2, 3.4, 0.8, { draw: 'snackshelf', stand: [2.9, 4.7] });
      dec('coffeebar', 9.6, 0.3, 1.8, 0.7); furn('plant', 11.0, 7.6);
      P = { RW: 12, RD: 9, door: [3, 8.3], counter: { x: 7.0, y: 4.4, w: 3.2, d: 0.9 } };
    }
    const solids = [...wares.map(w => [w.x, w.y, w.w, w.d]), ...decor.filter(d => !d.flat && d.kind !== 'person').map(d => [d.x, d.y, d.w, d.d])];
    solids.push([P.counter.x, P.counter.y - 1.1, P.counter.w, P.counter.d + 1.1]);
    P = { k, n: wares.length, wares, decor, venue: true, ...P };
    P.clerk = [P.counter.x + 1.6, P.counter.y - 0.6]; P.till = [P.counter.x + 1.6, P.counter.y + 1.55];
    P.nav = navFor(P.RW, P.RD, solids);
    SHOPS[k] = P;
    return P;
  }
  // A person placed in a room (not you): standing, sitting, working out.
  function roomPerson(d, ts, i) {
    const z = cam.z, p = iso(d.x, d.y), L = typeof d.look === 'object' ? { skin: '#f3c59f', hair: 'short', hairCol: '#2b1d14', mob: 'walk', body: 'regular', ...d.look } : FOLK(d.look || i);
    drawPerson(p.x, p.y - (d.lift || 0) * z, z, { look: L, face: d.face || 1, view: d.view || null, turn: d.turn, energy: 'good', ts, seed: i + 11, pose: d.pose || 'stand', moving: !!d.moving, phase: ts / (d.pose === 'bike' ? 120 : 80) + i, noBike: true, seatH: d.seatH, matCol: '#ec6aa8' });
    if (d.prop && z > 0.35) emoji(d.prop, p.x + 10 * z, p.y - 22 * z, 9 * z);
  }
  function drawVenueDecor(d, ts, i = 0) {
    const z = cam.z, { x, y } = d, c = iso(x + d.w / 2, y + d.d / 2);
    const tops = (b, items, h) => items.forEach((e, k) => { const q = up(iso(x + (k + 0.5) * d.w / items.length, y + d.d / 2), (h + 6) * z); emoji(e, q.x, q.y, 10 * z); });
    switch (d.draw || d.kind) {
      case 'furn': { drawFurn({ k: d.furn || d.k, rot: 0, tint: d.tint || (FURN[d.furn || d.k].tint ? TINTS[4] : null) }, x, y, ts); break; }
      case 'person': roomPerson(d, ts, i); break;
      case 'rug': flatRect(x, y, d.w, d.d, d.col || '#b5563c'); flatRect(x + 0.2, y + 0.2, d.w - 0.4, d.d - 0.4, null, 'rgba(255,255,255,.5)'); break;
      case 'stripes': for (let k = 0; k < 6; k++) flatRect(x + k * d.w / 6, y, d.w / 12, d.d, k % 2 ? '#2d2d2d' : '#f2c230'); break;
      case 'breadshelf': { const b = box(x, y, d.w, d.d, 46, '#b07a4a', 0, { top: '#c99a6b' }); [14, 28, 42].forEach(h => { wallRect(b.left, 0, 0.02, 0.98, h - 1, h, '#8a5a36'); ['🍞', '🥖', '🥐', '🍞', '🥯', '🥖'].forEach((e, k) => { const q = wallPt(b.left, 0, (k + 0.5) / 6, h + 1); emoji(e, q.x, q.y, 9 * z); }); }); break; }
      case 'oven': { const b = box(x, y, d.w, d.d, 40, '#b5563c', 0, { top: '#9a4a34' }); wallRect(b.left, 0, 0.25, 0.75, 6, 26, '#2a1d18'); const fl = 0.6 + 0.4 * Math.sin(ts / 180); wallRect(b.left, 0, 0.3, 0.7, 7, 16, `rgba(255,${Math.round(120 + 60 * fl)},40,.9)`); const q = wallPt(b.left, 0, 0.5, 20); emoji('🍞', q.x, q.y, 9 * z); for (let k = 0; k < 2; k++) { const u = (ts / 1600 + k / 2) % 1, s0 = up(iso(x + d.w * 0.7, y + 0.3), (40 + u * 26) * z); circle(s0.x, s0.y, (3 + u * 5) * z, `rgba(240,240,240,${0.5 * (1 - u)})`); } break; }
      case 'case': { const b = box(x, y, d.w, d.d, 18, '#e6dfd1', 0, { top: '#f6f1e8' }); tops(b, d.items || ['🥐'], 18); const g0 = up(iso(x, y + d.d), 18 * z), g1 = up(iso(x + d.w, y + d.d), 18 * z); poly([g0, g1, up(g1, 16 * z), up(g0, 16 * z)], 'rgba(200,230,250,.22)', 'rgba(255,255,255,.7)', 1); break; }
      case 'table': drawDecor({ kind: 'table', x, y, w: d.w, d: d.d, i: d.i || 0 }, ts); break;
      case 'menuboard': { const b = box(x, y, d.w, d.d, 30, '#2d2d2d', 40, { shadow: false }); wallRect(b.left, 40, 0.06, 0.94, 3, 27, '#3b3f46'); ['☕ 15', '🍵 15', '🥤 15'].forEach((s, k) => { const q = wallPt(b.left, 40, 0.5, 22 - k * 7); ctx.font = `700 ${Math.max(6, 7 * z)}px ${UI_FONT},${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f4f1ea'; ctx.fillText(s, q.x, q.y); }); break; }
      case 'glass': drawDecor(d, ts); break;
      case 'bench': drawDecor(d, ts); break;
      case 'chairs': { const n = d.n || 4, sw = d.w / n; for (let k = 0; k < n; k++) { box(x + k * sw + 0.05, y + 0.1, sw - 0.1, d.d - 0.2, 7, '#5aa2e0', 0, { top: '#7cb8ea' }); box(x + k * sw + 0.05, y, sw - 0.1, 0.15, 16, '#4a8fd0', 0, { shadow: false }); if ((d.sat || []).includes(k)) { const q = iso(x + k * sw + sw / 2, y + 0.45); drawPerson(q.x, q.y, z, { look: FOLK(k + 2), face: 1, view: 'front', turn: [0.2, 1], energy: k ? 'tired' : 'good', ts, seed: k, pose: 'stand' }); } } break; }
      case 'exambed': { box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 8, '#c9cfd6', 0); box(x, y, d.w, d.d, 3, '#e8f4f6', 8, { top: '#f6fbfc' }); box(x + d.w - 0.6, y + 0.15, 0.45, d.d - 0.3, 2, '#ffffff', 11, { shadow: false }); box(x + 0.2, y - 0.1, d.w - 0.4, 0.1, 40, 'rgba(159,214,210,.5)', 0, { shadow: false, edge: null }); break; }
      case 'healthpod': { const b = box(x + 0.15, y + 0.15, d.w - 0.3, d.d - 0.3, 4, '#d6dce2', 0, { top: '#eef2f5' }); box(x + 0.2, y + 0.1, 0.2, 0.2, 40, '#9aa3ad', 0, { shadow: false }); const q = up(iso(x + 0.3, y + 0.2), 44 * z); rrect(q.x - 9 * z, q.y - 7 * z, 18 * z, 12 * z, 2 * z, '#1b2a3a', '#9aa3ad', 0.8 * z); emoji('❤️', q.x, q.y + 3 * z, 7 * z); break; }
      case 'medshelf': { const b = box(x, y, d.w, d.d, 44, '#ffffff', 0, { top: '#f4f4f0' }); [12, 26, 40].forEach(h => ['💊', '🧴', '🩹', '💊'].forEach((e, k) => { const q = wallPt(b.left, 0, (k + 0.5) / 4, h - 8); emoji(e, q.x, q.y, 8 * z); })); wallRect(b.left, 0, 0.35, 0.65, 34, 42, '#e5484d'); const q = wallPt(b.left, 0, 0.5, 38); emoji('➕', q.x, q.y + 3 * z, 7 * z); break; }
      case 'watercooler': { box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 20, '#e6e9ee', 0); const q = up(iso(x + d.w / 2, y + d.d / 2), 20 * z); ellipse(q.x, q.y - 7 * z, 6 * z, 9 * z, 'rgba(120,190,230,.75)'); break; }
      case 'bookwall': { const H = d.low ? 30 : 56, b = box(x, y, d.w, d.d, H, '#8a5a36', 0, { top: '#a46e40' }), cols = ['#e5484d', '#38a3e0', '#f2c230', '#34b27b', '#a46ef0', '#f59e0b', '#2f6fb2'], face = d.w > d.d ? b.left : b.right, len = Math.max(d.w, d.d);
        for (let s = 0; s < (d.low ? 2 : 4); s++) { const h0 = 3 + s * 13; wallRect(face, 0, 0.01, 0.99, h0 + 11, h0 + 12.4, '#6b4428'); for (let k = 0; k < len * 6; k++) { const u0 = k / (len * 6), u1 = (k + 0.8) / (len * 6); wallRect(face, 0, u0, u1, h0, h0 + 8 + hash(k, s) * 3, cols[(k * 3 + s) % cols.length]); } } break; }
      case 'bookstand': { box(x + 0.2, y + 0.2, d.w - 0.4, d.d - 0.4, 22, '#8a5a36', 0, { top: '#a46e40' }); const q = up(c, 30 * z); rrect(q.x - 12 * z, q.y - 9 * z, 24 * z, 16 * z, 2 * z, '#fffaf0', '#c9b98f', 1); line(q.x, q.y - 9 * z, q.x, q.y + 7 * z, '#c9b98f', 0.8 * z); emoji('⭐', q.x + 10 * z, q.y - 10 * z, 9 * z); break; }
      case 'longtable': { const R = d.readers || []; R.forEach(r => { const q = iso(r ? x + d.w + 0.45 : x - 0.45, y + d.d / 2); drawPerson(q.x, q.y, z, { look: FOLK(r + 3), face: r ? -1 : 1, energy: 'good', ts, seed: r + 4, pose: 'sit', seatH: 8 }); });
        [x - 0.75, x + d.w + 0.15].forEach(cx2 => box(cx2, y + d.d / 2 - 0.3, 0.6, 0.6, 8, '#a46e40', 0, { top: '#c99a6b' }));
        box(x, y, d.w, d.d, 14, '#b07a4a', 0, { top: '#c99a6b' }); const q = up(iso(x + d.w / 2, y + d.d / 2), 14 * z); emoji('📚', q.x - 8 * z, q.y, 9 * z); const lp = up(iso(x + d.w - 0.3, y + 0.3), 14 * z); line(lp.x, lp.y, lp.x, lp.y - 12 * z, '#3b6b4a', 1.2 * z); ellipse(lp.x, lp.y - 13 * z, 5 * z, 2.5 * z, '#34b27b'); if (NIGHT > 0.2) glow(lp.x, lp.y - 12 * z, 30 * z, 0.6); break; }
      case 'mirrorwall': { const b = box(x, y, d.w, d.d, 52, '#cfe6f2', 6, { top: '#e8f4fa', shadow: false }); for (let k = 0; k < 5; k++) wallRect(b.left, 6, k / 5 + 0.02, k / 5 + 0.06, 4, 48, 'rgba(255,255,255,.55)'); break; }
      case 'lockers': { const along = d.along || d.w > d.d, b = box(x, y, d.w, d.d, 50, '#5a7a9a', 0, { top: '#6b8cab' }), face = along ? b.left : b.right, n = Math.round(Math.max(d.w, d.d) / 0.6);
        for (let k = 0; k < n; k++) { wallRect(face, 0, k / n + 0.01, (k + 1) / n - 0.01, 2, 48, null, 'rgba(0,0,0,.25)', 0.8); const q = wallPt(face, 0, (k + 0.75) / n, 26); circle(q.x, q.y, 0.9 * z, '#d9dee4'); if (d.helmets && k % 2 === 0) { const hq = up(iso(along ? x + (k + 0.5) * 0.6 : x + d.w / 2, along ? y + d.d / 2 : y + (k + 0.5) * 0.6), 56 * z); ellipse(hq.x, hq.y, 5 * z, 3.5 * z, '#f2c230', '#b88a12', 0.6 * z); } } break; }
      case 'poboxes': { const b = box(x, y, d.w, d.d, 48, '#c9a36a', 0, { top: '#d8b57e' }); for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) { wallRect(b.left, 0, (k + 0.1) / 9, (k + 0.9) / 9, 6 + r * 10.5, 14.5 + r * 10.5, '#e8d3a8', '#a07a50', 0.6); const q = wallPt(b.left, 0, (k + 0.5) / 9, 10 + r * 10.5); circle(q.x, q.y, 0.7 * z, '#8a6a4a'); } const q = wallPt(b.left, 0, 0.5, 52); emoji('📬', q.x, q.y + 6 * z, 10 * z); break; }
      case 'parcels': { const b = box(x, y, d.w, d.d, 46, '#9aa3ad', 0, { top: '#b9c1ca' }); [8, 22, 36].forEach((h, s) => { wallRect(b.left, 0, 0.01, 0.99, h - 1.5, h, '#6b737d'); for (let k = 0; k < 5; k++) if ((k + s) % 3) { wallRect(b.left, 0, k / 5 + 0.03, k / 5 + 0.17, h, h + 8 + (k % 2) * 3, '#c99a6b', '#a07a50', 0.6); } }); break; }
      case 'cardrack': { box(x + 0.35, y + 0.35, 0.3, 0.3, 30, '#6b737d', 0); for (let k = 0; k < 3; k++) { const q = up(c, (14 + k * 8) * z); ['🌅', '🏖️', '🌸'].forEach((e, j) => emoji(e, q.x + (j - 1) * 8 * z, q.y + 4 * z, 8 * z)); } break; }
      case 'redbox': { box(x + 0.15, y + 0.15, d.w - 0.3, d.d - 0.3, 26, '#e5484d', 0, { top: '#c9373c' }); const q = up(c, 30 * z); ellipse(q.x, q.y, 8 * z, 4 * z, '#c9373c'); break; }
      case 'scaletable': { box(x, y, d.w, d.d, 14, '#b9c1ca', 0, { top: '#d6dce2' }); const q = up(c, 14 * z); emoji('📦', q.x, q.y, 10 * z); break; }
      case 'blackboard': { const b = box(x, y, d.w, d.d, 34, '#8a5a36', 22, { shadow: false }); wallRect(b.left, 22, 0.02, 0.98, 2, 32, '#2f4a3a'); ['ABC', '1+1=2', '🌍'].forEach((s, k) => { const q = wallPt(b.left, 22, 0.2 + k * 0.3, 18); ctx.font = `700 ${Math.max(6, 8 * z)}px ${UI_FONT},${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f4f1ea'; ctx.fillText(s, q.x, q.y); }); break; }
      case 'schooldesk': { box(x, y, d.w, d.d, 14, '#c99a6b', 0, { top: '#e6c79a' }); box(x + d.w / 2 - 0.3, y + d.d + 0.05, 0.6, 0.5, 8, '#5aa2e0', 0, { top: '#7cb8ea' }); if (d.kid >= 0) { const q = iso(x + d.w / 2, y + d.d + 0.15); drawPerson(q.x, q.y, z, { look: FOLK(d.kid + 1), face: 1, energy: 'good', ts, seed: d.kid, pose: 'sit', seatH: 7 }); } const q = up(iso(x + 0.4, y + 0.4), 14 * z); emoji('📓', q.x, q.y, 8 * z); break; }
      case 'globe': { box(x + 0.25, y + 0.25, 0.3, 0.3, 14, '#8a5a36', 0); const q = up(c, 22 * z); circle(q.x, q.y, 8 * z, '#5aa2e0'); emoji('🌍', q.x, q.y + 6 * z, 14 * z); break; }
      case 'townboard': { const b = box(x, y, d.w, d.d, 34, '#6b4428', 26, { shadow: false }); wallRect(b.left, 26, 0.03, 0.97, 2, 32, '#fffaf0'); const q = wallPt(b.left, 26, 0.5, 24); ctx.font = `800 ${Math.max(7, 9 * z)}px ${UI_FONT},${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#6b4428'; ctx.fillText(`🏆 ${t('fab_rank')}`, q.x, q.y); [0.25, 0.5, 0.75].forEach((u, k) => { const r = wallPt(b.left, 26, u, 12); rrect(r.x - 9 * z, r.y - 4 * z, 18 * z, 7 * z, 1.5 * z, ['#f2c230', '#c9cfd6', '#d9915a'][k]); }); break; }
      case 'flag': { box(x + 0.25, y + 0.25, 0.1, 0.1, 64, '#9aa3ad', 0, { shadow: false }); const q = up(iso(x + 0.3, y + 0.3), 62 * z), wv = Math.sin(ts / 400 + x) * 2 * z; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.quadraticCurveTo(q.x + 10 * z, q.y - 3 * z + wv, q.x + 20 * z, q.y + wv); ctx.lineTo(q.x + 20 * z, q.y + 12 * z + wv); ctx.quadraticCurveTo(q.x + 10 * z, q.y + 9 * z + wv, q.x, q.y + 12 * z); ctx.closePath(); ctx.fillStyle = d.col; ctx.fill(); break; }
      case 'model': { box(x, y, d.w, d.d, 14, '#b07a4a', 0, { top: '#9fd07a' }); [[0.3, 0.3, '#e5484d'], [1.2, 0.4, '#38a3e0'], [2.1, 0.3, '#f2c230'], [0.5, 1.2, '#34b27b'], [1.8, 1.2, '#a46ef0']].forEach(([dx, dy, col]) => { box(x + dx, y + dy, 0.5, 0.45, 7, '#f4efe4', 14, { top: col, shadow: false }); }); const g0 = up(iso(x, y + d.d), 14 * z), g1 = up(iso(x + d.w, y + d.d), 14 * z); poly([g0, g1, up(g1, 14 * z), up(g0, 14 * z)], 'rgba(200,230,250,.18)', 'rgba(255,255,255,.6)', 1); break; }
      case 'cell': { flatRect(x, y, d.w, d.d, '#cfd5dc'); box(x + 0.3, y + 0.3, 1.8, 0.7, 8, '#8a919c', 0, { top: '#a8aeb6' }); for (let k = 0; k <= 16; k++) { const a = iso(x + k * d.w / 16, y + d.d), b2 = up(a, 46 * z); line(a.x, a.y, b2.x, b2.y, '#5b6470', 1.3 * z); } for (let k = 0; k <= 12; k++) { const a = iso(x, y + k * d.d / 12), b2 = up(a, 46 * z); line(a.x, a.y, b2.x, b2.y, '#5b6470', 1.3 * z); } const t0 = up(iso(x, y + d.d), 46 * z), t1 = up(iso(x + d.w, y + d.d), 46 * z), t2 = up(iso(x, y), 46 * z); line(t0.x, t0.y, t1.x, t1.y, '#5b6470', 2 * z); line(t0.x, t0.y, t2.x, t2.y, '#5b6470', 2 * z); break; }
      case 'noticeboard': { const b = box(x, y, d.w, d.d, 28, '#8a5a36', 26, { shadow: false }); wallRect(b.left, 26, 0.03, 0.97, 2, 26, '#c99a6b'); [['📄', 0.2], ['🚲', 0.45], ['🐕', 0.7], ['📄', 0.88]].forEach(([e, u], k) => { const q = wallPt(b.left, 26, u, 14 + (k % 2) * 5); emoji(e, q.x, q.y + 5 * z, 9 * z); }); break; }
      case 'officedesk': { box(x, y, d.w, d.d, 14, '#9aa3ad', 0, { top: '#d6dce2' }); const q = up(iso(x + d.w / 2, y + 0.3), 14 * z); rrect(q.x - 8 * z, q.y - 14 * z, 16 * z, 11 * z, 1.5 * z, '#2d2d2d'); rrect(q.x - 7 * z, q.y - 13 * z, 14 * z, 8 * z, 1 * z, '#5aa2e0'); break; }
      case 'firetruck': { const L = d.d, b = box(x + 0.1, y, d.w - 0.2, L, 26, '#d63a3a', 4, { top: '#e5484d' }); box(x + 0.15, y + L - 1.6, d.w - 0.3, 1.5, 14, '#c9373c', 30, { top: '#e5484d' }); wallRect(b.right, 4, 0.02, 0.98, 12, 15, '#f4f1ea'); wallRect(b.left, 4, 0.1, 0.9, 14, 24, 'rgba(190,225,245,.8)');
        [0.18, 0.78].forEach(u => { const q = wallPt(b.right, 0, u, 4); ellipse(q.x, q.y, 6 * z, 7 * z, '#2b2b2e'); ellipse(q.x, q.y, 2.5 * z, 3 * z, '#9aa3ad'); });
        for (let k = 0; k < 6; k++) { const a = up(iso(x + d.w / 2, y + 0.4 + k * 0.6), 30 * z); line(a.x - 8 * z, a.y, a.x + 8 * z, a.y, '#c9cfd6', 1.4 * z); } { const a = up(iso(x + d.w / 2, y + 0.4), 30 * z), b2 = up(iso(x + d.w / 2, y + 3.4), 30 * z); line(a.x - 8 * z, a.y, b2.x - 8 * z, b2.y, '#c9cfd6', 1.4 * z); line(a.x + 8 * z, a.y, b2.x + 8 * z, b2.y, '#c9cfd6', 1.4 * z); }
        const lb = up(iso(x + d.w / 2, y + L - 0.8), 46 * z), on = Math.floor(ts / 400) % 2; rrect(lb.x - 9 * z, lb.y - 2 * z, 18 * z, 4 * z, 1.5 * z, on ? '#ff4d4d' : '#8a2020'); break; }
      case 'pole': { flatRect(x, y, d.w, d.d, '#2d2d2d'); const a = iso(x + d.w / 2, y + d.d / 2), b2 = up(a, 80 * z); line(a.x, a.y, b2.x, b2.y, '#d9dee4', 3 * z); line(a.x + 1 * z, a.y, b2.x + 1 * z, b2.y, 'rgba(255,255,255,.7)', 0.8 * z); break; }
      case 'hosereel': { box(x, y, d.w, d.d, 22, '#8a919c', 0); const q = wallPt([iso(x, y + d.d), iso(x + d.w, y + d.d)], 0, 0.5, 12); ellipse(q.x, q.y, 9 * z, 9 * z, '#c9433b', '#8a2a24', 1.2 * z); ellipse(q.x, q.y, 3 * z, 3 * z, '#5b6470'); break; }
      case 'drinkfridge': { const b = box(x, y, d.w, d.d, 50, '#d9dee4', 0, { top: '#eef2f5' }); wallRect(b.left, 0, 0.02, 0.98, 4, 46, 'rgba(160,210,240,.45)', '#ffffff', 1); [10, 22, 34].forEach(h => ['🥤', '🧃', '🧋', '🥛', '🥤', '🧃'].forEach((e, k) => { const q = wallPt(b.left, 0, (k + 0.5) / 6, h - 6); emoji(e, q.x, q.y, 8 * z); })); if (NIGHT > 0.2) glow(c.x, c.y - 26 * z, 40 * z, 0.4); break; }
      case 'snackshelf': { const b = box(x, y, d.w, d.d, 34, '#f4f4f0', 0, { top: '#e6e9ee' }); [8, 20, 32].forEach(h => ['🍫', '🥨', '🍪', '🍬', '🥜'].forEach((e, k) => { const q = wallPt(b.left, 0, (k + 0.5) / 5, h - 6); emoji(e, q.x, q.y, 8 * z); })); break; }
      case 'coffeebar': { box(x, y, d.w, d.d, 16, '#5b6470', 0, { top: '#9aa3ad' }); const q = up(c, 16 * z); emoji('☕', q.x - 6 * z, q.y, 10 * z); emoji('🍩', q.x + 8 * z, q.y + 2 * z, 9 * z); break; }
      default: drawDecor(d, ts);
    }
  }
  // You inside: walking, or sitting / lying / working out at something (meS.use).
  function drawMeShop(z, ts) {
    const U = meS.use;
    if (U && !meS.moving) {
      const p = iso(U.at[0], U.at[1]);
      drawPerson(p.x, p.y - (U.lift || 0) * z, z, { look: S.me.look, face: U.face || 1, view: U.view || null, turn: U.turn || [0, -1], energy: energyLevel(), ts, seed: 3, pose: U.pose, moving: !!U.moving, phase: ts / (U.pose === 'bike' ? 120 : 80), noBike: true, seatH: U.seatH, dir: U.dir, matCol: '#38a3e0' });
      if (U.mate) { const q = iso(U.at[0] + 1.5, U.at[1]); drawPerson(q.x, q.y, z, { look: U.mate, face: -1, energy: 'great', ts, seed: 9, pose: 'sit', seatH: 7 }); if (Math.floor(ts / 900) % 2) emoji('💬', q.x - 8 * z, q.y - 44 * z, 12 * z); else emoji('😄', p.x + 8 * z, p.y - 44 * z, 12 * z); }
      if (U.prop) emoji(U.prop, p.x + 10 * z, p.y - (U.pose === 'lie' ? 14 : 20) * z - (U.lift || 0) * z, 10 * z);
      const left = Math.max(0, (U.until - performance.now()) / 1000), tot = U.secs || 1;
      if (U.until && z > 0.35) { const w = 34 * z, by = p.y - (54 + (U.lift || 0)) * z; rrect(p.x - w / 2, by, w, 5 * z, 2.5 * z, 'rgba(0,0,0,.25)'); rrect(p.x - w / 2, by, w * (1 - left / tot), 5 * z, 2.5 * z, '#6cbf73'); }
      return;
    }
    const p2 = iso(meS.x, meS.y);
    drawPerson(p2.x, p2.y, z, { look: S.me.look, face: meS.face, back: meS.back && meS.moving, view: meS.view, turn: meS.turn, moving: meS.moving, phase: meS.phase, energy: energyLevel(), ts, seed: 3, pose: meS.moving ? 'walk' : 'stand' });
    carryBox(p2, z);
  }
  // Sit at / work out on / lie on a thing for `secs` seconds (walking there first), then `done`.
  function venueUseNow(id, secs, done, mate) {
    const P = shopPlan(owner), w = P.wares.find(x => x.id === id || x.k === id);
    if (!w || !w.use) { if (done) done(); return; }
    shopWalk(w.stand || [w.x + w.w / 2, w.y + w.d + 0.55], () => {
      meS.use = { ...w.use, secs, until: performance.now() + secs * 1000, done, mate: w.use.mate ? mate || FOLK(3) : null };
    });
  }
  function shopPlan(k) {
    if (MALL_FLOORS.includes(k)) return mallPlan(k);
    if (VENUE_LOOK[k]) return venuePlan(k);
    const wares = storeWares(k);
    if (SHOPS[k] && SHOPS[k].n === wares.length) return SHOPS[k];
    const area = wares.reduce((t, w) => t + (w.w + 0.8) * (w.d + 1.5), 0), RW = clamp(Math.round(Math.sqrt(area) * 1.1) + 2, SHOP_W[k] || 13, 26), placed = [];   // v0.22: about square
    let x = 1, y = 1.3, rowD = 0;
    wares.forEach(w => {
      if (x + w.w > RW - 0.8) { x = 1; y += rowD + 1.5; rowD = 0; }
      placed.push({ ...w, x, y });
      x += w.w + 0.8; rowD = Math.max(rowD, w.d);
    });
    const RD = Math.ceil(y + rowD + 4.6), counter = { x: RW - 4.4, y: RD - 2.9, w: 3.2, d: 0.9 };
    const plan = { k, n: wares.length, RW, RD, wares: placed, counter, clerk: [counter.x + 1.6, counter.y - 0.6], till: [counter.x + 1.6, counter.y + 1.55], door: [3, RD - 0.7] };
    // where you can walk: half-tile cells, not on anything on show or the counter
    const GS = 0.5, gw = Math.ceil(RW / GS), gd = Math.ceil(RD / GS), g = new Uint8Array(gw * gd).fill(1);
    const block = (bx, by, bw, bd) => { for (let j = Math.floor((by - 0.2) / GS); j < (by + bd + 0.2) / GS; j++) for (let i = Math.floor((bx - 0.2) / GS); i < (bx + bw + 0.2) / GS; i++) if (i >= 0 && j >= 0 && i < gw && j < gd) g[j * gw + i] = 0; };
    placed.forEach(w => block(w.x, w.y, w.w, w.d));
    block(counter.x, counter.y - 1.1, counter.w, counter.d + 1.1);
    for (let i = 0; i < gw; i++) { g[i] = 0; g[(gd - 1) * gw + i] = 1; }
    for (let j = 0; j < gd; j++) { g[j * gw] = 0; g[j * gw + gw - 1] = 0; }
    plan.nav = { g, gw, gd, GS };
    SHOPS[k] = plan;
    return plan;
  }
  function navFor(RW, RD, solids) {
    const GS = 0.5, gw = Math.ceil(RW / GS), gd = Math.ceil(RD / GS), g = new Uint8Array(gw * gd).fill(1);
    solids.forEach(([bx, by, bw, bd]) => { for (let j = Math.floor((by - 0.2) / GS); j < (by + bd + 0.2) / GS; j++) for (let i = Math.floor((bx - 0.2) / GS); i < (bx + bw + 0.2) / GS; i++) if (i >= 0 && j >= 0 && i < gw && j < gd) g[j * gw + i] = 0; });
    for (let i = 0; i < gw; i++) { g[i] = 0; g[(gd - 1) * gw + i] = 1; }
    for (let j = 0; j < gd; j++) { g[j * gw] = 0; g[j * gw + gw - 1] = 0; }
    return { g, gw, gd, GS };
  }
  // ---------- the mall (v0.23): two floors and a cinema, each a real place ----------
  // Ground floor: an atrium with a fountain, palms and benches, the clothing store and the trophy shop behind glass,
  // the till, an escalator up. First floor: a food court (six stalls, tables, people eating), an arcade (claw
  // machines, hoops, a racing game) and the cinema's ticket booth and doors. The cinema: rows of seats rising to the
  // back, and the film on the big screen.
  const MALL_FLOORS = ['mall', 'mall2', 'cinema'];
  const STALL_COL = { burger: '#e5484d', noodles: '#f59e0b', pizza: '#34b27b', sushi: '#38a3e0', boba: '#a46ef0', icecream: '#ec6aa8' };
  let FILM = null, FILM_CV = null, SHOP_FROM = null, CLAW_T = 0;
  function mallPlan(k) {
    const sig = k + ':' + EXCLUSIVES.filter(([kind, kk]) => exclOK(exclDef(kind, kk).excl)).length;
    if (SHOPS[k] && SHOPS[k].sig === sig) return SHOPS[k];
    const wares = [], decor = [], add = (kind, kk, x, y, w, d, ex = {}) => wares.push({ id: kind + ':' + kk, kind, k: kk, x, y, w, d, price: 0, ...ex }), dec = (kind, x, y, w, d, ex = {}) => decor.push({ kind, x, y, w, d, ...ex });
    let P;
    if (k === 'mall') {
      const RW = 18, RD = 16;
      Object.entries(CLOTHES).filter(([kk, c]) => c.price && kk !== 'nohat').forEach(([kk, c], i) => add('clothes', kk, 1.1 + (i % 5) * 1.2, 1.3 + Math.floor(i / 5) * 1.9, 0.8, 0.8, { act: 'buyClothes', arg: kk, price: c.price }));
      EXCLUSIVES.filter(([kind, kk]) => exclOK(exclDef(kind, kk).excl)).slice(0, 12).forEach(([kind, kk], i) => { const d = exclDef(kind, kk); add('excl', kind + '|' + kk, 11.3 + (i % 4) * 1.5, 1.3 + Math.floor(i / 4) * 1.8, 1, 1, { act: 'buyExcl', arg: kind + '|' + kk, price: kind === 'car' ? d.cost.coins : d.price }); });
      add('act', 'trophies', 16.3, 6.0, 1, 0.8);
      dec('glass', 0.1, 7.3, 3.6, 0.15); dec('glass', 5.4, 7.3, 1.9, 0.15); dec('glass', 7.3, 0.1, 0.15, 7.35);
      dec('glass', 10.6, 0.1, 0.15, 7.35); dec('glass', 10.6, 7.3, 2.1, 0.15); dec('glass', 14.5, 7.3, 3.4, 0.15);
      dec('sign', 3.6, 7.3, 1.8, 0.15, { text: '👕 ' + t('shop_clothes'), col: '#ec6aa8' }); dec('sign', 12.7, 7.3, 1.8, 0.15, { text: '🏆 ' + t('act_trophies'), col: '#d9a520' });
      dec('fountain', 7.7, 8.6, 2.8, 2.8);
      [[6.4, 8.2], [11.0, 8.2], [6.4, 11.9], [11.0, 11.9]].forEach(([x, y]) => dec('palm', x, y, 0.8, 0.8));
      dec('bench', 7.9, 12.9, 2.4, 0.6); dec('bench', 3.2, 9.4, 0.6, 2.2); dec('bench', 0.6, 13.4, 2.2, 0.6);
      add('escalator', 'mall2', 14.6, 9.0, 1.6, 4.2);
      P = { RW, RD, door: [9, RD - 0.7], counter: { x: 1.0, y: 10.2, w: 3.2, d: 0.9 }, title: `${STORES.mall.e} ${t('mall_1f')}`, floor: 'marble', from: { mall2: [15.4, 13.8] } };
    } else if (k === 'mall2') {
      const RW = 18, RD = 15;
      Object.keys(MALL.foods).forEach((f, i) => add('stall', f, 0.6 + i * 1.75, 0.5, 1.5, 1.2, { act: 'eatFood', arg: f, price: MALL.foods[f].price }));
      [[1.6, 4.4], [4.6, 4.4], [7.6, 4.4], [3.1, 7.4], [6.1, 7.4], [9.1, 7.4]].forEach(([x, y], i) => dec('table', x, y, 1.3, 1.3, { i }));
      dec('carpet', 11.8, 0.3, 5.9, 8.4);
      ['#ec6aa8', '#38a3e0', '#f2c230', '#34b27b'].forEach((col, i) => add('claw', 'c' + i, 12.4 + (i % 2) * 2.6, 0.8 + Math.floor(i / 2) * 2.3, 1, 1, { col }));
      dec('hoops', 12.3, 5.7, 1.4, 1.8); dec('racer', 15.4, 5.7, 1.4, 1.6);
      add('ticket', 'booth', 12.2, 10.3, 1.8, 1.1);
      add('cinemaDoor', 'hall', 14.8, 9.4, 2.8, 0.7);
      ['dino', 'space', 'hero'].forEach((f, i) => dec('poster', 12.0 + i * 0.9, 12.9, 0.7, 0.5, { film: f }));
      add('escalator', 'mall', 1.0, 9.8, 1.6, 4.2);
      dec('sign', 4.4, 0.15, 3, 0.15, { text: '🍔 ' + t('act_food'), col: '#f59e0b', wall: true }); dec('sign', 13.4, 0.15, 3, 0.15, { text: '🕹️ ' + t('act_arcade'), col: '#a46ef0', wall: true });
      P = { RW, RD, door: [1.8, 13.6], noDoor: true, title: `${STORES.mall.e} ${t('mall_2f')}`, floor: 'food', from: { mall: [1.8, 13.6], cinema: [16.2, 10.8] } };
    } else {
      const RW = 14, RD = 13;
      for (let r = 0; r < 5; r++) dec('seats', 1.2, 4.2 + r * 1.6, 9.6, 0.9, { r, n: 8 });
      add('cinemaExit', 'out', 11.6, RD - 1.5, 1.8, 0.6);
      P = { RW, RD, door: [12.5, RD - 0.7], noDoor: true, title: '🎬 ' + t('act_cinema'), floor: 'cinema', dark: true, screen: { u0: 0.08, u1: 0.78, h0: 26, h1: 78 }, seat: [5.4, 7.75], aisle: [11.4, 7.85] };
    }
    const solids = [...wares.filter(w => w.kind !== 'cinemaExit').map(w => [w.x, w.y, w.w, w.d]), ...decor.filter(d => !['carpet', 'poster', 'sign'].includes(d.kind) && !(d.kind === 'glass' && false)).map(d => [d.x, d.y, d.w, d.d])];
    if (P.counter) solids.push([P.counter.x, P.counter.y - 1.1, P.counter.w, P.counter.d + 1.1]);
    P = { k, sig, n: wares.length, wares, decor, ...P };
    if (P.counter) { P.clerk = [P.counter.x + 1.6, P.counter.y - 0.6]; P.till = [P.counter.x + 1.6, P.counter.y + 1.55]; }
    P.nav = navFor(P.RW, P.RD, solids);
    SHOPS[k] = P;
    return P;
  }
  // the film on the cinema's big screen: drawn by the movie picture into a canvas, then onto the wall
  function filmOnWall(F, P, ts) {
    const sc = P.screen, p0 = wallPt(F, 0, sc.u0, sc.h1), p1 = wallPt(F, 0, sc.u1, sc.h1), z = cam.z, hgt = (sc.h1 - sc.h0) * z;
    wallRect(F, 0, sc.u0 - 0.01, sc.u1 + 0.01, sc.h0 - 2, sc.h1 + 2, '#111');
    const k2 = (p1.y - p0.y) / ((p1.x - p0.x) || 1);
    ctx.save(); ctx.translate(p0.x, p0.y); ctx.transform(1, k2, 0, 1, 0, 0);
    if (FILM && FILM.t0) {
      FILM_CV = FILM_CV || document.createElement('canvas');
      const cw = 320, ch = 190;
      thumb('movie', FILM.k, { canvas: FILM_CV, live: true, ts, t0: FILM.t0, look: S.me.look }, cw, ch);
      const sx = FILM_CV.width / cw;
      ctx.drawImage(FILM_CV, cw * 0.08 * sx, ch * 0.05 * sx, cw * 0.84 * sx, ch * 0.52 * sx, 0, 0, p1.x - p0.x, hgt);
      const g = ctx.createLinearGradient(0, hgt, 0, hgt + 80 * z); g.addColorStop(0, 'rgba(170,200,255,.25)'); g.addColorStop(1, 'rgba(170,200,255,0)');
    } else {
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, p1.x - p0.x, hgt);
      ctx.fillStyle = '#8a8478'; ctx.font = `800 ${12 * z}px ${UI_FONT},${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(FILM ? `🍿 ${t('film_soon')}` : `🎬 ${t('film_none')}`, (p1.x - p0.x) / 2, hgt / 2);
    }
    ctx.restore();
  }
  function drawDecor(d, ts) {
    const z = cam.z, { x, y } = d, c = iso(x + d.w / 2, y + d.d / 2);
    if (d.kind === 'glass') {   // a glass partition with a slim frame
      const b = { left: [iso(x, y + d.d), iso(x + d.w, y + d.d)], right: [iso(x + d.w, y + d.d), iso(x + d.w, y)] }, Hh = 34;
      [b.left, b.right].forEach((F, i) => { poly([F[0], F[1], up(F[1], Hh * z), up(F[0], Hh * z)], i ? 'rgba(190,220,240,.28)' : 'rgba(200,230,250,.22)', 'rgba(255,255,255,.7)', 1); });
      line(up(b.left[0], Hh * z).x, up(b.left[0], Hh * z).y, up(b.left[1], Hh * z).x, up(b.left[1], Hh * z).y, '#c9c3b6', 2 * z);
      box(x, y, d.w, d.d, 2, '#c9c3b6', 0, { shadow: false, shine: false });
    } else if (d.kind === 'sign') {   // a sign hanging from the ceiling over a shop
      const p = up(iso(x + d.w / 2, y + d.d / 2), 54 * z);
      line(p.x - 14 * z, p.y - 26 * z, p.x - 14 * z, p.y - 6 * z, '#9aa3ad', 0.8 * z); line(p.x + 14 * z, p.y - 26 * z, p.x + 14 * z, p.y - 6 * z, '#9aa3ad', 0.8 * z);
      pill(d.text, p.x, p.y, d.col, '#ffffff', `800 ${Math.max(9, 12 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(16, 22 * z));
    } else if (d.kind === 'fountain') {   // a round fountain: a stone rim, rippling water, a middle tier and arcs of water
      const rx = 1.35 * 45 * z, ry = rx / 2;
      ellipse(c.x, c.y + 4 * z, rx * 1.05, ry * 1.05, 'rgba(0,0,0,.12)');
      ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI); ctx.lineTo(c.x - rx, c.y - 8 * z); ctx.ellipse(c.x, c.y - 8 * z, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fillStyle = '#d8d0c2'; ctx.fill();
      ellipse(c.x, c.y - 8 * z, rx, ry, '#ece6da'); ellipse(c.x, c.y - 8 * z, rx * 0.86, ry * 0.86, '#8fd0ee');
      for (let k = 0; k < 3; k++) { const u = ((ts / 1600 + k / 3) % 1); ellipse(c.x, c.y - 8 * z, rx * 0.86 * u, ry * 0.86 * u, null, `rgba(255,255,255,${0.6 * (1 - u)})`, 1.2 * z); }
      box(x + d.w / 2 - 0.25, y + d.d / 2 - 0.25, 0.5, 0.5, 26, '#e6dfd1', 0, { shadow: false });
      ellipse(c.x, c.y - 26 * z, rx * 0.35, ry * 0.35, '#e6dfd1');
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + ts / 3000, ex = Math.cos(a) * rx * 0.55, ey = Math.sin(a) * ry * 0.55; ctx.beginPath(); ctx.moveTo(c.x, c.y - 30 * z); ctx.quadraticCurveTo(c.x + ex * 0.5, c.y - 44 * z, c.x + ex, c.y - 8 * z + ey); ctx.strokeStyle = 'rgba(190,230,250,.75)'; ctx.lineWidth = 1.4 * z; ctx.stroke(); }
      for (let k = 0; k < 10; k++) { const u = ((ts / 700 + k * 0.1) % 1); circle(c.x + Math.sin(k * 2.3) * 6 * z, c.y - 30 * z - Math.sin(u * Math.PI) * 14 * z, 1.1 * z, `rgba(255,255,255,${0.8 * (1 - u)})`); }
    } else if (d.kind === 'palm') {   // a palm in a big pot
      box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 12, '#8a7a6a', 0, { top: '#5b4632' });
      const top = up(c, 46 * z), sway = Math.sin(ts / 1400 + x) * 2 * z;
      ctx.beginPath(); ctx.moveTo(c.x, c.y - 12 * z); ctx.quadraticCurveTo(c.x + 4 * z, c.y - 30 * z, top.x + sway, top.y); ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 3 * z; ctx.stroke();
      for (let k = 0; k < 7; k++) leaf(top.x + sway, top.y, 20 * z, 5 * z, -Math.PI / 2 + (k - 3) * 0.55 + Math.sin(ts / 900 + k) * 0.05, k % 2 ? '#3f9a52' : '#57b468');
    } else if (d.kind === 'bench') {
      const along = d.w > d.d;
      [0.15, 0.85].forEach(u => box(along ? x + d.w * u - 0.06 : x + 0.2, along ? y + 0.2 : y + d.d * u - 0.06, 0.12, 0.12, 8, '#4a4f57', 0, { shadow: false }));
      box(x, y, d.w, d.d, 2.2, '#b07a4a', 8, { top: '#c99a6b' });
      if (along) box(x, y - 0.05, d.w, 0.12, 9, '#a46e40', 10); else box(x - 0.05, y, 0.12, d.d, 9, '#a46e40', 10);
    } else if (d.kind === 'carpet') {   // the arcade's dark carpet with little stars
      flatRect(x, y, d.w, d.d, '#3a2f5c');
      for (let i = 0; i < 40; i++) { const px = x + hash(i, 3) * d.w, py = y + hash(i, 9) * d.d, q = iso(px, py); circle(q.x, q.y, 1.2 * z, ['#f2c230', '#ec6aa8', '#38a3e0'][i % 3]); }
    } else if (d.kind === 'table') {   // a round table with four stools; someone eating at some of them
      const rx = 0.55 * 45 * z, ry = rx / 2, tp = up(c, 14 * z);
      [[-0.75, 0], [0.75, 0], [0, -0.75], [0, 0.75]].forEach(([dx, dy], i) => { const q = iso(x + d.w / 2 + dx, y + d.d / 2 + dy); if (dy < 0 || dx < 0) { line(q.x, q.y, q.x, q.y - 9 * z, '#4a4f57', 1.6 * z); ellipse(q.x, q.y - 9 * z, 7 * z, 3.5 * z, '#e5734f'); } });
      line(c.x, c.y, tp.x, tp.y, '#4a4f57', 2.2 * z); ellipse(c.x, c.y, 10 * z, 5 * z, 'rgba(0,0,0,.12)');
      ellipse(tp.x, tp.y, rx, ry, '#f4f1ea', '#d6d0c4', 1);
      const diner = (d.i % 3) !== 1;
      if (diner) { const q = iso(x + d.w / 2 - 0.75, y + d.d / 2); drawPerson(q.x, q.y - 4 * z, z, { look: TABLE_LOOKS[d.i % TABLE_LOOKS.length], face: 1, energy: 'good', ts, seed: d.i, pose: 'sit' }); emoji(['🍔', '🍜', '🍕', '🍣', '🧋', '🍦'][d.i % 6], tp.x + 4 * z, tp.y + 2 * z, 10 * z); }
      [[0.75, 0], [0, 0.75]].forEach(([dx, dy]) => { const q = iso(x + d.w / 2 + dx, y + d.d / 2 + dy); line(q.x, q.y, q.x, q.y - 9 * z, '#4a4f57', 1.6 * z); ellipse(q.x, q.y - 9 * z, 7 * z, 3.5 * z, '#e5734f'); });
    } else if (d.kind === 'hoops') {   // a basketball game: a lane, a hoop, a ball going up and down
      const b = box(x, y + 0.6, d.w, d.d - 0.6, 14, '#e5484d', 0, { top: '#f59e0b' });
      box(x + 0.2, y, d.w - 0.4, 0.2, 44, '#2d2d2d', 14, { shadow: false });
      const hp = up(iso(x + d.w / 2, y + 0.4), 46 * z); ellipse(hp.x, hp.y, 6 * z, 2.5 * z, null, '#ff6b2d', 1.4 * z);
      const u = (ts / 900) % 1, bh = Math.sin(u * Math.PI) * 30; const bp = up(iso(x + d.w / 2, y + 0.9), (16 + bh) * z); circle(bp.x, bp.y, 3 * z, '#ff8a3d', '#a8461d', 0.6 * z);
      for (let k = 0; k < 5; k++) { const q = wallPt(b.left, 14, (k + 0.5) / 5, -3); circle(q.x, q.y, 1.1 * z, (Math.floor(ts / 200) + k) % 2 ? '#fff6a8' : '#ff8fc4'); }
    } else if (d.kind === 'racer') {   // a racing game: a seat and a screen with the road rushing by
      box(x + 0.3, y + 0.8, 0.8, 0.7, 10, '#2d2d2d', 0, { top: '#e5484d' });
      const b = box(x + 0.1, y, d.w - 0.2, 0.5, 34, '#38a3e0', 0, { top: '#5aa2e0' });
      const sp = wallPt(b.left, 0, 0.5, 26); rrect(sp.x - 10 * z, sp.y - 6 * z, 20 * z, 12 * z, 1.5 * z, '#1b1530');
      for (let k = 0; k < 3; k++) { const u = ((ts / 300 + k / 3) % 1); line(sp.x, sp.y - 5 * z + u * 10 * z, sp.x, sp.y - 4 * z + u * 10 * z, '#ffffff', 1.4 * z); }
    } else if (d.kind === 'poster') drawPosterStand(d.film, x, y);
    else if (d.kind === 'seats') {   // a row of cinema seats, higher towards the back; people watching in some
      const base = (4 - d.r) * 3, n = d.n, sw = d.w / n;
      box(x - 0.1, y - 0.2, d.w + 0.2, d.d + 0.4, base, '#3a2f3f', 0, { shadow: false });
      for (let i = 0; i < n; i++) {
        const sx = x + i * sw, occupied = (i * 7 + d.r * 3) % 5 < 2 && !(d.r === 2 && (i === 3 || i === 4)), mine = d.r === 2 && i === 3 && FILM && meS.sit;
        if (occupied) { const q = iso(sx + sw / 2, y + 0.3); drawPerson(q.x, q.y - base * z, z * 0.95, { look: AUDIENCE_LOOKS[(i + d.r * 3) % AUDIENCE_LOOKS.length], face: 1, view: 'back', turn: [0, -1], energy: 'good', ts, seed: i + d.r, pose: 'stand' }); }
        if (mine) { const q = iso(meS.x, meS.y); drawPerson(q.x, q.y - base * z, z * 0.95, { look: S.me.look, face: 1, view: 'back', turn: [0, -1], energy: energyLevel(), ts, seed: 3, pose: 'stand' }); emoji('🍿', q.x + 9 * z, q.y - (base + 16) * z, 9 * z); }
        box(sx + 0.05, y + 0.45, sw - 0.1, 0.4, 15, '#b8262f', base, { top: '#d63a42', shadow: false });
        box(sx + 0.05, y, sw - 0.1, 0.5, 7, '#9c1f27', base, { shadow: false });
      }
    }
    return null;
  }
  // Walk to a point in the store (along the aisles), then do `then`.
  function shopWalk(to, then) {
    meS.use = null;
    const P = shopPlan(owner), { g, gw, gd, GS } = P.nav, cell = (x, y) => [clamp(Math.floor(x / GS), 0, gw - 1), clamp(Math.floor(y / GS), 0, gd - 1)];
    const free = (i, j) => i >= 0 && j >= 0 && i < gw && j < gd && g[j * gw + i];
    let [ti, tj] = cell(to[0], to[1]);
    if (!free(ti, tj)) {   // the nearest free cell to where you tapped
      let best = null, bd = 1e9;
      for (let j = 0; j < gd; j++) for (let i = 0; i < gw; i++) if (free(i, j)) { const d = Math.hypot(i - ti, j - tj); if (d < bd) { bd = d; best = [i, j]; } }
      if (!best) return; [ti, tj] = best;
    }
    const [si, sj] = cell(meS.x, meS.y), prev = new Int32Array(gw * gd).fill(-1), seen = new Uint8Array(gw * gd), q = [sj * gw + si];
    seen[sj * gw + si] = 1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], i = c % gw, j = (c - i) / gw;
      if (i === ti && j === tj) break;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj]) => { const ni = i + di, nj = j + dj, n = nj * gw + ni; if (free(ni, nj) && !seen[n]) { seen[n] = 1; prev[n] = c; q.push(n); } });
    }
    const path = [];
    for (let c = tj * gw + ti; c >= 0 && c !== sj * gw + si; c = prev[c]) path.unshift([(c % gw + 0.5) * GS, (Math.floor(c / gw) + 0.5) * GS]);
    if (!path.length && !(si === ti && sj === tj)) return;
    // straighten: drop points that lie on a straight line
    const out = [];
    path.forEach((p2, i) => { const a = out[out.length - 1], b = path[i + 1]; if (a && b && ((a[0] === p2[0] && p2[0] === b[0]) || (a[1] === p2[1] && p2[1] === b[1]))) return; out.push(p2); });
    meS.path = out; meS.then = then || null; meS.moving = true;
  }
  function stepShop(dt) {
    if (meS.use && meS.use.until && performance.now() > meS.use.until) { const f = meS.use.done; meS.use = null; if (f) setTimeout(f, 60); }   // v0.30
    if (!meS.path.length) { if (meS.moving) { meS.moving = false; const f = meS.then; meS.then = null; if (f) setTimeout(f, 120); } return; }
    let go = 3.4 * dt;
    while (go > 0 && meS.path.length) {
      const [tx, ty] = meS.path[0], dx = tx - meS.x, dy = ty - meS.y, d = Math.hypot(dx, dy);
      if (d > 0.01) faceTo(meS, dx, dy);
      if (d <= go) { meS.x = tx; meS.y = ty; meS.path.shift(); go -= d; } else { meS.x += dx / d * go; meS.y += dy / d * go; go = 0; }
    }
    meS.phase += dt * 11;
  }
  // v0.21: a path along the aisles (half-tile cells) from a to b, or null
  function shopPath(P, a, b) {
    const { g, gw, gd, GS } = P.nav, cell = (x, y) => [clamp(Math.floor(x / GS), 0, gw - 1), clamp(Math.floor(y / GS), 0, gd - 1)], free = (i, j) => i >= 0 && j >= 0 && i < gw && j < gd && g[j * gw + i];
    const [si, sj] = cell(a[0], a[1]), [ti, tj] = cell(b[0], b[1]);
    if (!free(ti, tj)) return null;
    const prev = new Int32Array(gw * gd).fill(-1), seen = new Uint8Array(gw * gd), q = [sj * gw + si]; seen[sj * gw + si] = 1;
    for (let h2 = 0; h2 < q.length; h2++) { const cc = q[h2], i = cc % gw, j = (cc - i) / gw; if (i === ti && j === tj) break; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj]) => { const ni = i + di, nj = j + dj, nn = nj * gw + ni; if (free(ni, nj) && !seen[nn]) { seen[nn] = 1; prev[nn] = cc; q.push(nn); } }); }
    if (!seen[tj * gw + ti]) return null;
    const out = []; for (let cc = tj * gw + ti; cc >= 0 && cc !== sj * gw + si; cc = prev[cc]) out.unshift([(cc % gw + 0.5) * GS, (Math.floor(cc / gw) + 0.5) * GS]);
    return out;
  }
  // other people shopping: they wander from one thing to another, stop and look, and wander on
  function shoppers(P, objs, dt, ts) {
    if (!P.npcs) {
      const ids = allLots().map(l => l.id).filter(id => id !== 'me' && homeOf(id)).slice(0, 12);
      P.npcs = [0, 1, 2].map(i => { const id = ids[(i * 5 + P.n) % Math.max(1, ids.length)], h = id && homeOf(id); return { look: h ? h.look : dressUp({ shirt: COLORS[i], skin: SKINS[i % SKINS.length], hair: HAIRS[i % HAIRS.length], hairCol: HAIR_COLORS[i], mob: 'walk' }, 'shop' + i), x: 2 + i * 3, y: P.RD - 2, path: [], wait: 1 + i * 2, face: 1, phase: 0 }; });
    }
    P.npcs.forEach((n, i) => {
      if (n.wait > 0) { n.wait -= dt; n.moving = false; if (n.wait <= 0 && P.wares.length) {
        const w = P.wares[Math.floor(Math.random() * P.wares.length)], mine = meS.use ? meS.use.at : !meS.moving ? [meS.x, meS.y] : null;
        // v0.30: in a building, stand a little to one side, and not where you are
        let to = [w.x + w.w / 2, w.y + w.d + 0.55];
        if (P.venue) to = [w.x + w.w / 2 + (Math.random() - 0.5) * 1.6, w.y + w.d + 0.8 + Math.random() * 0.8];
        if (mine && Math.hypot(to[0] - mine[0], to[1] - mine[1]) < 1.6) { n.wait = 1 + Math.random() * 2; }
        else { n.path = shopPath(P, [n.x, n.y], to) || []; n.look2 = w; } } }
      else if (n.path.length) { let go = 2.2 * dt; while (go > 0 && n.path.length) { const [tx, ty] = n.path[0], dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy); if (d > 0.01) faceTo(n, dx, dy); if (d <= go) { n.x = tx; n.y = ty; n.path.shift(); go -= d; } else { n.x += dx / d * go; n.y += dy / d * go; go = 0; } } n.phase += dt * 10; n.moving = true; if (!n.path.length) { n.wait = 3 + Math.random() * 5; n.view = 'back'; n.turn = [0, -1]; } }
      else n.wait = 1;
      objs.push({ d: n.x + n.y + 0.3, f: () => { const p2 = iso(n.x, n.y); drawPerson(p2.x, p2.y, cam.z, { look: n.look, face: n.face, back: n.back && n.moving, view: n.moving ? n.view : 'back', turn: n.moving ? n.turn : [-0.3, -1], moving: n.moving, phase: n.phase, energy: 'good', ts, seed: i + 7, pose: n.moving ? 'walk' : 'stand' }); } });
    });
  }
  // A picture (made by thumb) drawn on the canvas, once it has loaded.
  function pic(kind, k, o, w, h, sx, sy, sw, sh) {
    const url = thumb(kind, k, o, w, h), im = IMGS[url] || (IMGS[url] = Object.assign(new Image(), { src: url }));
    if (im.complete && im.naturalWidth) ctx.drawImage(im, sx, sy, sw, sh);
  }
  const MANNEQUIN = { shirt: '#5aa2e0', pants: '#4a5a78', skin: '#efe9e1', hair: 'short', hairCol: '#efe9e1', mob: 'walk', shoeCol: '#3b3028', hatCol: '#e5484d' };
  function drawWare(w, ts) {
    const z = cam.z, { x, y } = w, c = iso(x + w.w / 2, y + w.d / 2);
    const plinth = (col = '#ffffff') => box(x - 0.05, y - 0.05, w.w + 0.1, w.d + 0.1, 2, col, 0, { edge: 'rgba(0,0,0,.06)' });
    if (w.kind === 'spot') drawVenueDecor(w.furn ? { ...w, kind: 'furn' } : w, ts);   // v0.30: something to use inside a building
    else if (w.kind === 'furn') { plinth('#f7f2ea'); ctx.save(); ctx.translate(0, -2 * z); drawFurn({ k: w.k, rot: 0, tint: FURN[w.k].tint ? TINTS[4] : null }, x, y, ts); ctx.restore(); }
    else if (w.kind === 'yard') { flatRect(x - 0.05, y - 0.05, w.w + 0.1, w.d + 0.1, '#b6e092'); const D = YARD[w.k]; if (D.w > 3 || D.d > 3) { box(x + 0.2, y + 0.2, w.w - 0.4, 0.3, 30, '#c99a6b'); pic('yard', w.k, {}, 120, 96, c.x - 34 * z, c.y - 58 * z, 68 * z, 54 * z); } else drawYardItem({ k: w.k, rot: 0, placed: now() }, x, y, ts); }
    else if (w.kind === 'tree') { ellipse(c.x, c.y, 16 * z, 8 * z, '#9a6a44'); const d = TREES[w.k]; drawFruitTree({ k: w.k, planted: now() - d.grow * MIN * 0.35, last: now() }, c.x, c.y, z * 0.8, ts, 1); }
    else if (w.kind === 'animal') {
      flatRect(x, y, w.w, w.d, '#cfe3a6');
      [[x, y, x + w.w, y], [x, y, x, y + w.d], [x + w.w, y, x + w.w, y + w.d], [x, y + w.d, x + w.w, y + w.d]].forEach(([a, b, c2, d2]) => { const A = iso(a, b), B2 = iso(c2, d2); line(A.x, A.y - 7 * z, B2.x, B2.y - 7 * z, '#a8835c', 1.4 * z); [A, B2].forEach(P2 => line(P2.x, P2.y, P2.x, P2.y - 8 * z, '#8a6a4a', 1.4 * z)); });
      { const u = Math.sin(ts / 1700 + x * 3), mv = Math.abs(Math.cos(ts / 1700 + x * 3)) > 0.35, a = iso(x + w.w / 2 + u * 0.45, y + w.d / 2 + u * 0.2); drawAnimal(w.k, 0, a.x, a.y + 6 * z, z * 1.9, { face: Math.cos(ts / 1700 + x * 3) > 0 ? 1 : -1, ts, seed: x, moving: mv, phase: ts / 120 }); }
    }
    else if (w.kind === 'pet') { flatRect(x, y, w.w, w.d, '#f4e6c8'); const B = PET_BREEDS[w.k]; const u = Math.sin(ts / 1300 + x * 2), a = iso(x + w.w / 2 + u * 0.25, y + w.d / 2); drawAnimal(B.kind, 0, a.x, a.y + 5 * z, z * 1.7, { face: Math.cos(ts / 1300 + x * 2) > 0 ? 1 : -1, ts, seed: x, breed: w.k, moving: Math.abs(Math.cos(ts / 1300 + x * 2)) > 0.4, phase: ts / 110, mood: 'happy' }); }
    else if (w.kind === 'petfood' || w.kind === 'seed') {
      const b = box(x + 0.1, y + 0.2, w.w - 0.2, w.d - 0.4, 20, '#c99a6b', 0, { top: '#e6c79a' });
      const e = w.kind === 'seed' ? CROPS[w.k].e : PET_FOOD[w.k].e;
      [0.25, 0.5, 0.75].forEach((u, i) => { const p2 = wallPt(b.left, 0, u, 8 + (i % 2) * 6); emoji(e, p2.x, p2.y, 9 * z); });
      const tp = iso(x + 0.5, y + 0.5); emoji(e, tp.x, tp.y - 26 * z, 12 * z);
    }
    else if (w.kind === 'car') {   // on a display stand under a spotlight (v0.29: standing still, all facing the same way)
      ellipse(c.x, c.y + 3 * z, 44 * z, 22 * z, '#b9c1ca'); ellipse(c.x, c.y + 1 * z, 42 * z, 21 * z, '#dfe5eb'); ellipse(c.x, c.y + 1 * z, 34 * z, 17 * z, 'rgba(255,255,255,.45)');
      drawCarDir({ k: w.k, color: CARS[w.k].look || CAR_COLORS[0] }, x + w.w / 2, y + w.d / 2, '+y', 0);
    }
    else if (w.kind === 'house') {   // v0.21: a real little model of the house on a round stand, its lights coming on and off
      const i = +w.k, H = HOUSES[i], [fx, fy, fw, fd] = H.fp, sc = 0.3, cx = x + w.w / 2, cy = y + w.d / 2;
      ellipse(c.x, c.y + 3 * z, 50 * z, 25 * z, 'rgba(0,0,0,.12)'); ellipse(c.x, c.y, 48 * z, 24 * z, '#d8cfc2'); ellipse(c.x, c.y - 3 * z, 46 * z, 23 * z, '#f6f1e8');
      const glowA = 0.25 + 0.15 * Math.sin(ts / 900 + i); ellipse(c.x, c.y - 3 * z, 40 * z, 20 * z, `rgba(255,236,170,${glowA})`);
      const savedN = NIGHT, savedG = GLOWS; NIGHT = Math.sin(ts / 1400 + i * 1.7) > 0.2 ? 0.4 : 0; GLOWS = [];
      ctx.save(); ctx.translate(c.x, c.y - 4 * z); ctx.scale(sc, sc); ctx.translate(-c.x, -(c.y - 4 * z));
      try { drawHouse({ house: i, wall: WALL_COLORS[(i * 3) % WALL_COLORS.length], roof: ROOF_COLORS[(i * 2 + 1) % ROOF_COLORS.length], extra: {} }, cx - fx - fw / 2, cy - fy - fd / 2, ts); } catch (e) { /* a model that can't draw stays empty */ }
      ctx.restore(); NIGHT = savedN; GLOWS = savedG;
    }
    else if (w.kind === 'land') {   // v0.21: a big plan board on two legs, a picture and the name, centred
      [-16, 16].forEach(k => line(c.x + k * z, c.y + 2 * z, c.x + k * z, c.y - 30 * z, '#6b4428', 2.2 * z));
      rrect(c.x - 30 * z, c.y - 66 * z, 60 * z, 40 * z, 4 * z, '#fffaf0', '#b07a4a', 1.6 * z);
      rrect(c.x - 26 * z, c.y - 62 * z, 52 * z, 22 * z, 3 * z, { field: '#c99a6b', pasture: '#b8dd8c', orchard: '#9fd07a', pond: '#8fc9ea', garage: '#cfd5dc' }[w.k] || '#eee');
      emoji({ field: '🌱', pasture: '🐄', orchard: '🌳', pond: '🐟', garage: '🚗' }[w.k], c.x, c.y - 41 * z, 17 * z);
      if (z > 0.45) { ctx.font = `800 ${9 * z}px ${UI_FONT},${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#5b4632'; ctx.fillText(t('land_' + w.k), c.x, c.y - 32.5 * z); }
    }
    else if (w.kind === 'clothes') { ellipse(c.x, c.y, 12 * z, 6 * z, '#d8cfc2'); const C2 = CLOTHES[w.k]; drawPerson(c.x, c.y, z * 0.95, { look: { ...MANNEQUIN, [C2.slot]: w.k }, face: 1, view: 'front', turn: [0.4, 1], energy: 'good', ts: 0, seed: 0, pose: 'stand' }); }
    else if (w.kind === 'excl') {
      box(x + 0.1, y + 0.1, w.w - 0.2, w.d - 0.2, 12, '#e9e2d4', 0, { top: '#f6f1e8' });
      const [kind, k] = w.arg.split('|'), img = kind === 'yard' ? ['yard', k, {}] : kind === 'car' ? ['car', k, { color: exclDef(kind, k).color }] : kind === 'pet' ? ['pet', k, {}] : ['animal', k, { stage: 2 }];
      pic(img[0], img[1], img[2], 120, 96, c.x - 22 * z, c.y - 52 * z, 44 * z, 35 * z);
      const g0 = up(iso(x + 0.1, y + w.d - 0.1), 12 * z), g1 = up(iso(x + w.w - 0.1, y + w.d - 0.1), 12 * z);
      poly([g0, g1, up(g1, 30 * z), up(g0, 30 * z)], 'rgba(200,230,250,.25)', 'rgba(255,255,255,.6)', 1);
    }
    else if (w.kind === 'act') {
      if (w.k === 'claw') { const b = box(x + 0.1, y + 0.1, 0.8, 0.8, 34, '#ec6aa8', 0, { top: '#f59ac6' }); const p2 = up(iso(x + 0.5, y + 0.9), 22 * z); emoji('🧸', p2.x, p2.y, 10 * z); for (let k = 0; k < 6; k++) { const q = wallPt(b.left, 0, (k + 0.5) / 6, 32); circle(q.x, q.y, 1.3 * z, (Math.floor(ts / 250) + k) % 2 ? '#fff6a8' : '#ff8fc4'); } }
      else if (w.k === 'trophies') { line(c.x, c.y, c.x, c.y - 26 * z, '#8a6a4a', 2 * z); rrect(c.x - 18 * z, c.y - 46 * z, 36 * z, 24 * z, 3 * z, '#fff6dc', '#d9a520', 1.4 * z); emoji('🏆', c.x, c.y - 34 * z, 14 * z); }
      else if (w.k === 'food') { const b = box(x, y + 0.2, w.w, 0.7, 16, '#f59e0b', 0, { top: '#fff3e0' }); ['🍔', '🍜', '🍕', '🧋'].forEach((e, i) => { const p2 = up(iso(x + 0.3 + i * 0.45, y + 0.5), 20 * z); emoji(e, p2.x, p2.y, 9 * z); const st = ((ts / 1100 + i * 0.3) % 1); ctx.save(); ctx.globalAlpha = 0.5 * (1 - st); line(p2.x, p2.y - 12 * z - st * 10 * z, p2.x + Math.sin(st * 6) * 2 * z, p2.y - 16 * z - st * 10 * z, '#ffffff', 1.4 * z); ctx.restore(); }); }
      else { const b = box(x, y, w.w, 0.4, 42, '#2d2540', 0, { top: '#3b3152' }); wallRect(b.left, 0, 0.15, 0.85, 0, 28, '#1b1530', '#f2c230', 1.6); const p2 = wallPt(b.left, 0, 0.5, 36); emoji('🎬', p2.x, p2.y, 11 * z); }
    }
    const f0 = iso(x + w.w / 2, y + w.d);
    if (w.price && z > 0.5 && w.kind !== 'act') pill(`🪙${fmtNum(w.price)}`, f0.x, f0.y + 9 * z, 'rgba(255,253,248,.92)', '#6b4a1f', `800 ${Math.max(8, 9 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(13, 15 * z));
    return { x0: iso(x, y + w.d).x - 4 * z, x1: iso(x + w.w, y).x + 4 * z, y0: c.y - 60 * z, y1: iso(x + w.w, y + w.d).y + 8 * z };
  }
  function renderShop(ts, dt) {
    const VL = VENUE_LOOK[owner], P = shopPlan(owner), S2 = VL ? venueLook(owner) : STORES[owner] || STORES.mall, z = cam.z, WH = P.dark ? 92 : 80, { RW, RD } = P, fl = (VL && VL.floor) || SHOP_FLOOR[owner] || SHOP_FLOOR.market;
    stepShop(dt);
    if (P.floor) return renderMallFloor(P, S2, ts, dt, WH);
    // v0.22: outside the store: the pavement and car park in front, a road, grass and trees round it (no empty space)
    ctx.fillStyle = shade(PAL.town, -0.02); ctx.fillRect(0, 0, W, H);
    flatRect(-14, -14, RW + 28, RD + 30, shade(PAL.town, -0.02));
    flatRect(-2.5, -2.5, RW + 5, RD + 9, '#d9d4ca');                     // pavement all round
    flatRect(-2.5, RD + 0.6, RW + 5, 3.6, '#7d848c');                    // the car park in front
    for (let i = 0; i <= RW + 4; i += 1.7) { const a2 = iso(-2.3 + i, RD + 0.8), b2 = iso(-2.3 + i, RD + 3.1); line(a2.x, a2.y, b2.x, b2.y, 'rgba(255,255,255,.75)', 1.1 * z); }
    flatRect(-14, RD + 6.5, RW + 28, 3.4, '#8e959c');                    // the road
    for (let i = -13; i < RW + 13; i += 1.6) { const a2 = iso(i, RD + 8.2), b2 = iso(i + 0.8, RD + 8.2); line(a2.x, a2.y, b2.x, b2.y, 'rgba(255,255,255,.8)', 1.4 * z); }
    [[-4.5, -3], [-4, RD * 0.4], [-4.6, RD * 0.8], [RW * 0.3, -4.2], [RW * 0.7, -4.6], [RW + 4, -2], [RW + 4.4, RD * 0.5], [RW + 4, RD + 2]].forEach(([tx, ty], i) => drawWildTree(tx, ty, hash(i, 77), 0));
    for (let j = 0; j < RD; j++) for (let i = 0; i < RW; i++) tile(i, j, (i + j) % 2 ? fl[0] : fl[1]);
    const A = iso(0, 0), B = iso(RW, 0), D = iso(0, RD), wall = S2.wall || '#f1f0ea', acc = S2.roof || '#c9893a';
    poly([D, A, up(A, WH * z), up(D, WH * z)], shade(wall, -0.08)); poly([A, B, up(B, WH * z), up(A, WH * z)], wall);
    wallRect([D, A], 0, 0, 1, WH - 8, WH, acc); wallRect([A, B], 0, 0, 1, WH - 8, WH, shade(acc, 0.1));
    for (let k = 1; k <= 3; k++) wallRect([D, A], 0, k / 4 - 0.08, k / 4 + 0.08, 30, 62, '#bfe6f7', '#fffaf0', 1.4);   // windows
    { const F = [A, B], u0 = Math.max(0.2, 0.5 - 2.8 / RW), u1 = Math.min(0.8, 0.5 + 2.8 / RW);   // v0.21: a sign fixed to the back wall
      wallRect(F, 0, u0 - 0.006, u1 + 0.006, 39, 63, shade(acc, -0.25)); wallRect(F, 0, u0, u1, 40, 62, acc); wallRect(F, 0, u0 + 0.01, u1 - 0.01, 42, 60, shade(acc, 0.12));
      [u0 + 0.02, u1 - 0.02].forEach(u => { const q = wallPt(F, 0, u, 58); circle(q.x, q.y, 1.2 * z, '#e8e2d6'); });
      wallText(F, 0.5, 51, `${S2.e} ${nm(S2)}`, Math.max(9, 15 * z), '#ffffff'); }
    flatRect(P.door[0] - 1.2, RD - 0.9, 2.4, 0.9, shade(acc, 0.25));   // the door mat
    const objs = [];
    P.wares.forEach(w => { const q = iso(w.x + w.w / 2, w.y + w.d / 2); if (q.x < -120 || q.x > W + 120 || q.y < -60 || q.y > H + 200) return;   // v0.21: only what's on screen
      objs.push({ d: w.x + w.y + (w.w + w.d) / 2, f: () => { const r = drawWare(w, ts); if (r) hits.push({ kind: 'ware', id: w.id, wk: w.kind, k: w.k, ...r }); } }); });
    (P.decor || []).forEach((dd, i) => objs.push({ d: dd.flat ? -1e4 + i : dd.kind === 'person' ? dd.x + dd.y + 0.3 : dd.x + dd.y + (dd.w + dd.d) / 2, f: () => drawVenueDecor(dd, ts, i) }));   // v0.30
    const C = P.counter;
    objs.push({ d: C.x + C.y - 0.6 + 1.2, f: () => { const p2 = iso(P.clerk[0], P.clerk[1]); drawPerson(p2.x, p2.y, z, { look: VL ? { shirt: acc, skin: '#f3c59f', hair: 'short', hairCol: '#2b1d14', mob: 'walk', body: 'regular', top: 'polo', bottom: 'jeans', shoes: 'sneakers', hat: 'nohat', ...VL.clerk } : { shirt: acc, skin: '#f3c59f', hair: 'short', hairCol: '#2b1d14', mob: 'walk', top: 'polo' }, face: -1, view: Math.sin(ts / 2300) > 0.75 ? null : 'front', turn: [0.3, 1], energy: 'great', ts, seed: 5, pose: 'stand', wave: Math.sin(ts / 2300) > 0.75 });
      hits.push({ kind: 'clerk', x0: p2.x - 16 * z, x1: p2.x + 16 * z, y0: p2.y - 50 * z, y1: p2.y + 30 * z }); if (z > 0.45) pill(`💬 ${VL ? t('vrole_' + owner) : t('shop_clerk')}`, p2.x, p2.y - 54 * z, '#fffdf8', '#3b3125', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z)); } });
    objs.push({ d: C.x + C.y + (C.w + C.d) / 2, f: () => { box(C.x, C.y, C.w, C.d, 16, '#c99a6b', 0, { top: '#e6c79a' }); const p2 = up(iso(C.x + 0.6, C.y + 0.45), 18 * z); emoji(VL ? VL.till : '💳', p2.x, p2.y, 9 * z); } });
    shoppers(P, objs, dt, ts);
    objs.push({ d: meS.use && !meS.moving ? meS.use.at[0] + meS.use.at[1] + 0.5 : meS.x + meS.y + 0.3, f: () => drawMeShop(z, ts) });
    { const dp = iso(P.door[0], RD - 0.45); hits.push({ kind: 'shopDoor', x0: dp.x - 30 * z, x1: dp.x + 30 * z, y0: dp.y - 14 * z, y1: dp.y + 14 * z }); }
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    { const S3 = S2, acc2 = S3.roof || '#c9893a', F1 = [iso(0, RD), iso(RW, RD)], F2 = [iso(RW, RD), iso(RW, 0)];
      [F1, F2].forEach((F, k) => { wallRect(F, 0, 0, 1, 0, 5, shade(acc2, k ? -0.08 : -0.18)); wallRect(F, 0, 0, 1, 5, 6.2, '#ffffff'); });
      const du0 = (P.door[0] - 1.2) / RW, du1 = (P.door[0] + 1.2) / RW; wallRect(F1, 0, du0, du1, 0, 6.2, '#cfc9bd'); }
    const dp = iso(P.door[0], RD - 0.2); pill(`🚪 ${t(VL ? 'venue_leave' : 'store_leave')}`, dp.x, dp.y + 12 * z, 'rgba(255,253,248,.95)', '#3b3125', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z));
  }
  const TABLE_LOOKS = [0, 1, 2, 3, 4, 5].map(i => dressUp({ shirt: COLORS[(i * 3) % COLORS.length], skin: SKINS[i % SKINS.length], hair: HAIRS[i % HAIRS.length], hairCol: HAIR_COLORS[i % HAIR_COLORS.length], mob: 'walk' }, 'diner' + i));
  const AUDIENCE_LOOKS = [0, 1, 2, 3, 4, 5, 6].map(i => dressUp({ shirt: COLORS[(i * 5) % COLORS.length], skin: SKINS[(i + 1) % SKINS.length], hair: HAIRS[(i + 2) % HAIRS.length], hairCol: HAIR_COLORS[(i + 1) % HAIR_COLORS.length], mob: 'walk' }, 'film' + i));
  function renderMallFloor(P, S2, ts, dt, WH) {
    const z = cam.z, { RW, RD } = P, A = iso(0, 0), B = iso(RW, 0), D = iso(0, RD);
    // around it: the street in front of the ground floor; the town far below the upper floor; darkness round the cinema
    if (P.floor === 'marble') {
      ctx.fillStyle = shade(PAL.town, -0.02); ctx.fillRect(0, 0, W, H);
      flatRect(-2.5, -2.5, RW + 5, RD + 9, '#d9d4ca'); flatRect(-2.5, RD + 0.6, RW + 5, 3.6, '#7d848c'); flatRect(-14, RD + 6.5, RW + 28, 3.4, '#8e959c');
      [[-4.5, -3], [-4, RD * 0.5], [RW * 0.4, -4.4], [RW + 4, -2], [RW + 4.4, RD * 0.6]].forEach(([tx, ty], i) => drawWildTree(tx, ty, hash(i, 71), 0));
      for (let j = 0; j < RD; j += 2) for (let i = 0; i < RW; i += 2) flatRect(i, j, 2, 2, ((i + j) / 2) % 2 ? '#f3efe8' : '#e9e3d8', 'rgba(200,190,170,.35)');
      const fc = iso(9.1, 10); ellipse(fc.x, fc.y, 2.6 * 45 * z, 1.3 * 45 * z, null, '#d9b45a', 2 * z);
    } else if (P.floor === 'food') {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#bfe0f5'); g.addColorStop(1, '#e8f3fa'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) { const bx = (i * 97) % W, bw = 30 + (i * 37) % 40, bh = 40 + (i * 53) % 90; ctx.fillStyle = 'rgba(150,170,190,.35)'; ctx.fillRect(bx, H - bh, bw, bh); }
      for (let j = 0; j < RD; j++) for (let i = 0; i < RW; i++) tile(i, j, (i + j) % 2 ? '#ead9bf' : '#e3d0b3');
      flatRect(11.6, 9.2, RW - 11.6, RD - 9.2, '#8a2a34');   // the cinema's red carpet
    } else {
      ctx.fillStyle = '#14101c'; ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < RD; j++) for (let i = 0; i < RW; i++) tile(i, j, (i + j) % 2 ? '#2a2433' : '#262030');
      for (let j = 1; j < RD; j += 1.6) { const q = iso(11.2, j); circle(q.x, q.y, 1.2 * z, '#ffd36b'); }   // aisle lights
    }
    const wallC = P.dark ? '#241d2c' : P.floor === 'food' ? '#f6efe4' : '#f4efe6', acc = P.dark ? '#5a1e2a' : S2.roof || '#c9893a';
    poly([D, A, up(A, WH * z), up(D, WH * z)], shade(wallC, -0.08)); poly([A, B, up(B, WH * z), up(A, WH * z)], wallC);
    wallRect([D, A], 0, 0, 1, WH - 8, WH, acc); wallRect([A, B], 0, 0, 1, WH - 8, WH, shade(acc, 0.1));
    if (P.dark) { for (let k = 0; k < 6; k++) wallRect([D, A], 0, k / 6 + 0.02, (k + 1) / 6 - 0.02, 14, WH - 14, '#2f2638', '#3a3045', 1); filmOnWall([A, B], P, ts); }
    else {
      for (let k = 1; k <= 4; k++) wallRect([D, A], 0, k / 5 - 0.07, k / 5 + 0.07, 28, 66, '#bfe6f7', '#fffaf0', 1.4);
      const F = [A, B], u0 = 0.36, u1 = 0.64; wallRect(F, 0, u0, u1, 58, 74, acc); wallText(F, 0.5, 66, P.title, Math.max(9, 14 * z), '#ffffff');
    }
    if (P.floor === 'marble') for (let k = 0; k < 5; k++) { const p = iso(2 + k * 3.5, 5 + (k % 2) * 4); ctx.save(); ctx.globalAlpha = 0.08; ellipse(p.x, p.y - 30 * z, 30 * z, 60 * z, '#fff8d8'); ctx.restore(); }   // light from the skylight
    const objs = [];
    P.decor.forEach(d => objs.push({ d: d.x + d.y + (d.w + d.d) / 2, f: () => drawDecor(d, ts) }));
    P.wares.forEach(w => objs.push({ d: w.x + w.y + (w.w + w.d) / 2, f: () => { const r = drawMallWare(w, ts); if (r) hits.push({ kind: 'ware', id: w.id, wk: w.kind, k: w.k, ...r }); } }));
    if (P.counter) {
      const C = P.counter;
      objs.push({ d: C.x + C.y - 0.6 + 1.2, f: () => { const p2 = iso(P.clerk[0], P.clerk[1]); drawPerson(p2.x, p2.y, z, { look: { shirt: acc, skin: '#f3c59f', hair: 'long', hairCol: '#2b1d14', mob: 'walk', top: 'polo' }, face: -1, view: 'front', turn: [0.3, 1], energy: 'great', ts, seed: 5, pose: 'stand', wave: Math.sin(ts / 2300) > 0.75 });
        hits.push({ kind: 'clerk', x0: p2.x - 16 * z, x1: p2.x + 16 * z, y0: p2.y - 50 * z, y1: p2.y + 30 * z }); if (z > 0.45) pill(`💬 ${t('shop_clerk')}`, p2.x, p2.y - 54 * z, '#fffdf8', '#3b3125', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z)); } });
      objs.push({ d: C.x + C.y + (C.w + C.d) / 2, f: () => { box(C.x, C.y, C.w, C.d, 16, '#f4f1ea', 0, { top: '#c9a26b' }); const p2 = up(iso(C.x + 0.6, C.y + 0.45), 18 * z); emoji('💳', p2.x, p2.y, 9 * z); } });
    }
    if (!P.dark) shoppers(P, objs, dt, ts);
    if (!(P.dark && meS.sit)) objs.push({ d: meS.x + meS.y + 0.3, f: () => { const p2 = iso(meS.x, meS.y); drawPerson(p2.x, p2.y - (meS.sit ? 4 * z : 0), z, { look: S.me.look, face: meS.face, back: meS.back && meS.moving, view: meS.sit ? null : meS.view, turn: meS.turn, moving: meS.moving, phase: meS.phase, energy: energyLevel(), ts, seed: 3, pose: meS.sit ? 'sit' : meS.moving ? 'walk' : 'stand' }); carryBox(p2, z); if (meS.eat && meS.eat.until > performance.now()) emoji(meS.eat.e, p2.x + 12 * z, p2.y - 18 * z, 11 * z); } });
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    if (!P.noDoor) {
      const F1 = [iso(0, RD), iso(RW, RD)], F2 = [iso(RW, RD), iso(RW, 0)];
      [F1, F2].forEach((F, k) => { poly([F[0], F[1], up(F[1], 30 * z), up(F[0], 30 * z)], 'rgba(200,230,250,.16)', 'rgba(255,255,255,.55)', 1); wallRect(F, 0, 0, 1, 0, 3, shade(acc, k ? -0.08 : -0.18)); });
      const dp = iso(P.door[0], RD - 0.45); hits.push({ kind: 'shopDoor', x0: dp.x - 30 * z, x1: dp.x + 30 * z, y0: dp.y - 14 * z, y1: dp.y + 14 * z });
      pill(`🚪 ${t('store_leave')}`, dp.x, dp.y + 14 * z, 'rgba(255,253,248,.95)', '#3b3125', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z));
    } else if (!P.dark) { const F1 = [iso(0, RD), iso(RW, RD)]; poly([F1[0], F1[1], up(F1[1], 16 * z), up(F1[0], 16 * z)], 'rgba(200,230,250,.22)', 'rgba(255,255,255,.8)', 1.2); line(up(F1[0], 16 * z).x, up(F1[0], 16 * z).y, up(F1[1], 16 * z).x, up(F1[1], 16 * z).y, '#c9c3b6', 2.4 * z); }   // a glass railing
    if (FILM && FILM.t0 && owner === 'cinema' && performance.now() - FILM.t0 > 11500 && !FILM.ended) { FILM.ended = true; onHit({ kind: 'filmEnd', k: FILM.k }); }
  }
  function drawMallWare(w, ts) {
    const z = cam.z, { x, y } = w, c = iso(x + w.w / 2, y + w.d / 2), f0 = iso(x + w.w / 2, y + w.d);
    const tag = (txt) => { if (z > 0.5) pill(txt, f0.x, f0.y + 9 * z, 'rgba(255,253,248,.92)', '#6b4a1f', `800 ${Math.max(8, 9 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(13, 15 * z)); };
    if (w.kind === 'clothes' || w.kind === 'excl' || w.kind === 'act') return drawWare(w, ts);
    if (w.kind === 'stall') {   // a food stall: a counter, a striped awning, the menu and a cook
      const col = STALL_COL[w.k] || '#f59e0b', F = MALL.foods[w.k];
      const cp = iso(x + w.w / 2, y + 0.3); drawPerson(cp.x, cp.y, z, { look: { shirt: '#ffffff', skin: SKINS[(x | 0) % SKINS.length], hair: 'short', hairCol: '#2b1d14', mob: 'walk', hat: 'beanie', hatCol: '#ffffff' }, face: -1, view: 'front', turn: [0.2, 1], energy: 'great', ts, seed: x, pose: 'stand' });
      const b = box(x, y + 0.6, w.w, w.d - 0.6, 15, col, 0, { top: '#f4f1ea' });
      for (let k = 0; k < 6; k++) wallRect(b.left, 0, k / 6, (k + 1) / 6, 40, 46, k % 2 ? '#ffffff' : col);   // the awning
      const mp = wallPt(b.left, 0, 0.5, 30); rrect(mp.x - 14 * z, mp.y - 9 * z, 28 * z, 14 * z, 2 * z, '#2d2d2d'); emoji(F.e, mp.x - 6 * z, mp.y + 4 * z, 9 * z);
      if (z > 0.45) { ctx.fillStyle = '#ffe9a8'; ctx.font = `800 ${5.5 * z}px ${UI_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`🪙${F.price}`, mp.x + 1 * z, mp.y - 2 * z); }
      const st = (ts / 1100) % 1; ctx.save(); ctx.globalAlpha = 0.45 * (1 - st); const tp = up(iso(x + w.w * 0.3, y + 0.9), 18 * z); line(tp.x, tp.y - st * 14 * z, tp.x + Math.sin(st * 6) * 3 * z, tp.y - 6 * z - st * 14 * z, '#ffffff', 1.6 * z); ctx.restore();
      tag(`${F.e} ${nm(F)}`);
      return { x0: iso(x, y + w.d).x - 4 * z, x1: iso(x + w.w, y).x + 4 * z, y0: c.y - 60 * z, y1: f0.y + 10 * z };
    }
    if (w.kind === 'claw') {   // a claw machine, lit up, its claw swaying (and dropping when you play)
      const b = box(x + 0.05, y + 0.05, 0.9, 0.9, 40, w.col, 0, { top: shade(w.col, 0.2) });
      const gl = [wallPt(b.left, 0, 0.1, 16), wallPt(b.left, 0, 0.9, 16), wallPt(b.left, 0, 0.9, 36), wallPt(b.left, 0, 0.1, 36)]; poly(gl, 'rgba(220,240,255,.75)');
      ['🧸', '🐰', '🐱'].forEach((e, i) => { const q = wallPt(b.left, 0, 0.25 + i * 0.25, 18); emoji(e, q.x, q.y, 7 * z); });
      const sw = Math.sin(ts / 700 + x) * 0.25, drop = performance.now() - CLAW_T < 1100 && Math.hypot(meS.x - (x + 0.5), meS.y - (y + 1.6)) < 1.2 ? Math.sin((performance.now() - CLAW_T) / 1100 * Math.PI) * 12 : 0;
      const ct = wallPt(b.left, 0, 0.5 + sw, 35), cb = { x: ct.x, y: ct.y + (5 + drop) * z }; line(ct.x, ct.y, cb.x, cb.y, '#9aa3ad', 0.8 * z); line(cb.x, cb.y, cb.x - 2 * z, cb.y + 2.5 * z, '#9aa3ad', 1 * z); line(cb.x, cb.y, cb.x + 2 * z, cb.y + 2.5 * z, '#9aa3ad', 1 * z);
      for (let k = 0; k < 5; k++) { const q = wallPt(b.left, 0, (k + 0.5) / 5, 39); circle(q.x, q.y, 1 * z, (Math.floor(ts / 250) + k) % 2 ? '#fff6a8' : '#ffffff'); }
      tag(`🕹️ 🪙${MALL.claw}`);
      return { x0: iso(x, y + w.d).x - 4 * z, x1: iso(x + w.w, y).x + 4 * z, y0: c.y - 60 * z, y1: f0.y + 10 * z };
    }
    if (w.kind === 'escalator') {   // moving steps between the floors, glass sides and a black handrail
      const up2 = w.k === 'mall2', H2 = 60, n = 10;
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n, y0 = y + w.d * (1 - u0), y1 = y + w.d * (1 - u1), h0 = H2 * u0, h1 = H2 * u1, mv = ((ts / 900) % 1) / n;
        poly([up(iso(x, y0), h0 * z), up(iso(x + w.w, y0), h0 * z), up(iso(x + w.w, y1), h1 * z), up(iso(x, y1), h1 * z)], i % 2 ? '#9aa3ad' : '#b8c0c9');
        const ym = y + w.d * (1 - u0 - mv), hm = H2 * (u0 + mv); const a2 = up(iso(x, ym), hm * z), b2 = up(iso(x + w.w, ym), hm * z); line(a2.x, a2.y, b2.x, b2.y, 'rgba(255,255,255,.5)', 0.8 * z);
      }
      [x, x + w.w].forEach(sx => { const a2 = iso(sx, y + w.d), b2 = up(iso(sx, y), H2 * z); poly([a2, iso(sx, y), b2, up(a2, 10 * z)], 'rgba(200,230,250,.3)', 'rgba(255,255,255,.6)', 1); line(up(a2, 10 * z).x, up(a2, 10 * z).y, up(b2, 10 * z).x, up(b2, 10 * z).y, '#2d2d2d', 2 * z); });
      const sp = up(iso(x + w.w / 2, y + w.d + 0.2), 4 * z); pill(up2 ? `⬆️ ${t('mall_up')}` : `⬇️ ${t('mall_down')}`, sp.x, sp.y + 10 * z, '#2f80ed', '#ffffff', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z));
      return { x0: iso(x, y + w.d).x - 6 * z, x1: iso(x + w.w, y).x + 6 * z, y0: up(iso(x, y), (H2 + 12) * z).y, y1: iso(x + w.w, y + w.d).y + 20 * z };
    }
    if (w.kind === 'ticket') {   // the ticket booth: a kiosk with a window and a seller
      const b = box(x, y, w.w, w.d, 30, '#8a2a34', 0, { top: '#b8383f' });
      wallRect(b.left, 0, 0.2, 0.8, 12, 24, '#ffe9a8', '#ffffff', 1.2);
      const sp = wallPt(b.left, 0, 0.5, 18); drawPerson(sp.x, sp.y + 6 * z, z * 0.6, { look: { shirt: '#8a2a34', skin: '#f3c59f', hair: 'bun', hairCol: '#2b1d14', mob: 'walk' }, face: 1, view: 'front', turn: [0.3, 1], energy: 'great', ts, seed: 9, pose: 'stand' });
      const tp = wallPt(b.left, 0, 0.5, 36); pill(`🎟️ ${t('cinema_tickets')}`, tp.x, tp.y, '#ffd36b', '#5a1e2a', `800 ${Math.max(8, 10 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(14, 18 * z));
      return { x0: iso(x, y + w.d).x - 4 * z, x1: iso(x + w.w, y).x + 4 * z, y0: c.y - 60 * z, y1: f0.y + 8 * z };
    }
    if (w.kind === 'cinemaDoor' || w.kind === 'cinemaExit') {   // the cinema's doors with a row of blinking bulbs
      const out = w.kind === 'cinemaExit', b = box(x, y, w.w, w.d, out ? 30 : 46, out ? '#3a3045' : '#2d2540', 0, { top: '#3b3152' });
      wallRect(b.left, 0, 0.12, 0.88, 0, out ? 24 : 32, out ? '#14101c' : '#1b1530', '#f2c230', 1.4);
      if (!out) { for (let k = 0; k < 12; k++) { const q = wallPt(b.left, 0, (k + 0.5) / 12, 40); circle(q.x, q.y, 1.2 * z, (Math.floor(ts / 300) + k) % 2 ? '#ffd36b' : '#7a5a20'); } const q = wallPt(b.left, 0, 0.5, 36); emoji('🎬', q.x, q.y + 2 * z, 10 * z); }
      const sp = wallPt(b.left, 0, 0.5, 4); pill(out ? `🚪 ${t('cinema_out')}` : `🎬 ${t('act_cinema')}`, sp.x, sp.y + 14 * z, out ? '#3a3045' : '#5a1e2a', '#ffffff', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z));
      return { x0: iso(x, y + w.d).x - 4 * z, x1: iso(x + w.w, y).x + 4 * z, y0: c.y - 70 * z, y1: f0.y + 20 * z };
    }
    return drawWare(w, ts);
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
  // Big area names shown when zoomed out over the town: in the town plan (`labels`).
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
    // v0.11: the room is a doll's house standing in its garden: woods and lawn all round, a stone base under the
    // floor, flower beds in front, and the roof (seen from inside) over the walls. No empty space round it.
    // v0.13: a calm lawn all round (no busy woods behind the house): soft mowing stripes and a gentle vignette
    ctx.fillStyle = shade(PAL.town, -0.03); ctx.fillRect(0, 0, W, H);
    for (let k = -14; k < rd + 16; k += 2) flatRect(-16, k, rw + 34, 1, 'rgba(255,255,255,.045)');
    flatRect(-3, -3, rw + 6.2, rd + 6.8, 'rgba(255,255,255,.05)');
    { const g = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.3, W / 2, H * 0.55, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(30,50,20,0)'); g.addColorStop(1, 'rgba(30,50,20,.18)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    flowerBed(0.2, rd + 0.55, rw - 0.4, 0.8, 21);
    flowerBed(rw + 0.55, 0.2, 0.8, rd - 0.4, 22);
    [[-1.4, rd + 1.6], [rw + 1.8, rd + 1.4], [rw + 1.6, -1.2], [-1.6, -1.4], [rw * 0.5, rd + 2.6]].forEach(([x, y], k) => drawBushWild(x, y, hash(k, 31)));
    const RH = clamp(rd * 9 + 12, 40, 84), T = WH + 6, roofCol = h.roof || '#b5523b';
    const rA = up(A, T * z), rB = up(B, T * z), rD = up(D, T * z), m0 = up(iso(0, rd / 2), (T + RH) * z), m1 = up(iso(rw, rd / 2), (T + RH) * z);
    // the roof from inside: the back slope's boards and rafters, the gable over the left wall, the ridge beam
    poly([rA, rB, m1, m0], '#c99f72');
    for (let k = 1; k < 8; k++) { const a = lerp(rA, m0, k / 8), b = lerp(rB, m1, k / 8); line(a.x, a.y, b.x, b.y, 'rgba(90,55,25,.18)', 1 * z); }
    poly([rA, rD, m0], shade(wallCol, -0.12));
    const nR = Math.max(2, Math.round(rw / 1.6));
    for (let k = 0; k <= nR; k++) { const a = lerp(rA, rB, k / nR), b = lerp(m0, m1, k / nR); line(a.x, a.y, b.x, b.y, '#8a5a36', 3.2 * z); }
    line(lerp(rA, m0, 0.5).x, lerp(rA, m0, 0.5).y, lerp(rD, m0, 0.5).x, lerp(rD, m0, 0.5).y, '#8a5a36', 3 * z);
    line(m0.x, m0.y, m1.x, m1.y, '#6b4428', 5 * z);
    poly([m0, m1, up(m1, 7 * z), up(m0, 7 * z)], roofCol);
    poly([m0, rD, up(rD, 7 * z), up(m0, 7 * z)], shade(roofCol, -0.1));
    poly([m1, rB, up(rB, 7 * z), up(m1, 7 * z)], shade(roofCol, -0.18));
    // the stone base under the floor
    poly([D, C, dn(C, 16 * z), dn(D, 16 * z)], '#b8afa2');
    poly([C, B, dn(B, 16 * z), dn(C, 16 * z)], '#a39a8d');
    poly([D, C, dn(C, 5 * z), dn(D, 5 * z)], shade(fl.c2, -0.35));
    poly([C, B, dn(B, 5 * z), dn(C, 5 * z)], shade(fl.c2, -0.45));
    if (z > 0.6) for (let k = 1; k < rw + rd; k++) { const p = k < rd ? lerp(D, C, k / rd) : lerp(C, B, (k - rd) / rw); line(p.x, p.y + 5 * z, p.x, p.y + 16 * z, 'rgba(0,0,0,.12)', 1 * z); }
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
    const cp = wallPt(leftW, 0, 0.55, 64), [hh, mm] = localHM(SCENE_TOWN);
    circle(cp.x, cp.y, 8 * z, '#fffaf0', '#7a4f2e', 1.6 * z);
    const ha = (hh % 12 + mm / 60) / 12 * Math.PI * 2, ma = mm / 60 * Math.PI * 2;
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
    if (lv === 0) visitorObjs(h, 0, 0, objs, ts, dt, true, { nav: roomNav(h), rd }, !edit);
    if (owner !== 'me' && !visitingNow(owner)) {
      const e = ent('in:' + h.id, () => ({ x: rw - 1.5, y: rd - 1.5 }));
      wander(e, dt, speedOf(h) * 0.7, en => randomWalk(en, roomNav(h), 4, 99));
      objs.push({ d: e.x + e.y, f: () => {
        const p = iso(e.x, e.y);
        drawPerson(p.x, p.y, z, { look: h.look, face: e.face, back: e.back && e.moving, view: e.view, turn: e.turn, moving: e.moving, phase: e.phase, energy: friendEnergy(h), ts, seed: 1, wave: e.wave > performance.now() });
        if (!edit && z > 0.55) nameTag(p, homeName(h), isOnline(h.id));
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
    if (!((S.work || S.live || jailed()) && owner === 'me')) objs.push({ d: meD, f: () => {
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
      drawPerson(p.x, p.y - (yOff + lift) * z, z, { look: S.me.look, face: meIn.face, back: meIn.back && meIn.moving, view: meIn.view, turn: meIn.turn, moving: meIn.moving, phase: meIn.phase, energy: energyLevel(), ts, seed: 3, pose, noBike: true, wave: meIn.wave > performance.now(), matCol: it && it.tint, seatH: sitH, dir: lieDir(useIt) });
      if (pose === 'lie' && useIt) drawBedQuilt(useIt);
      if (pose === 'sit' && useIt && sitH) drawSeatFront(useIt, useIt.x, useIt.y);   // v0.19: the near arm stays in front of you
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
  // v0.24: what's under your finger when you press in design mode: a thing, or (in the yard) an area you can drag
  function editPress(sx, sy) {
    const items = hits.filter(h => h.kind === 'item' && inside(h, sx, sy)), solid = items.filter(h => !h.flat), pick = (solid.length ? solid : items).pop();
    if (pick) return { type: 'item', id: pick.id };
    const ar = [...hits].reverse().find(h => h.kind === 'editArea' && inside(h, sx, sy));
    if (ar) { const w = unIso(sx, sy), [ox, oy] = editOrigin(), A = ar.k === 'drive' ? driveOf(S.me) : areaOf(S.me, ar.k); return { type: 'area', k: ar.k, off: [w.x - ox - A.x, w.y - oy - A.y] }; }
    return null;
  }
  function areaDropAt(pr, sx, sy) { const w = unIso(sx, sy), [ox, oy] = editOrigin(); return { x: Math.round(w.x - ox - pr.off[0]), y: Math.round(w.y - oy - pr.off[1]) }; }
  const EDIT_AREAS = h => [...movables(h).filter(k => k !== 'pasture' || h.pastureLv).filter(k => k !== 'orchard' || h.orchardLv).filter(k => k !== 'pond' || h.pondLv), 'drive'];
  function areaFits(k, x, y) {
    const h = S.me, keep = h.areaAt ? JSON.parse(JSON.stringify(h.areaAt)) : null;
    const r = moveArea(k, x, y, h);
    if (keep) h.areaAt = keep; else delete h.areaAt;
    YARD_SPOTS = {};
    return r === 'ok';
  }
  function holdOrigin(sx, sy) {
    const p = unIso(sx, sy), [ox, oy] = editOrigin(), it = edit.hold, def = itemDef(edit.scope, it.k);
    const [w, d] = it.rot ? [def.d, def.w] : [def.w, def.d];
    return { x: Math.floor(p.x - ox) - Math.floor((w - 1) / 2), y: Math.floor(p.y - oy) - Math.floor((d - 1) / 2), w, d };
  }
  function editOverlay(ts) {
    const z = cam.z, [ox, oy] = editOrigin();
    if (edit.scope === 'yard') {   // v0.24: every area you can drag, outlined; the house you can tap to recolour
      const h = S.me;
      EDIT_AREAS(h).forEach(k => {
        const A = k === 'drive' ? driveOf(h) : areaOf(h, k), sel = UI_EDIT_SEL === k;
        ctx.save(); ctx.setLineDash([6 * z, 5 * z]); flatRect(ox + A.x, oy + A.y, A.w, A.d, sel ? 'rgba(239,125,60,.14)' : null, sel ? '#ef7d3c' : 'rgba(255,255,255,.75)', 0.3, (sel ? 2.4 : 1.4) * z); ctx.restore();
        if (!edit.hold && !edit.areaDrag) hits.push({ kind: 'editArea', k, ...footRect(ox + A.x, oy + A.y, A.w, A.d, 10) });
      });
      const [fx, fy, fw, fd] = HOUSES[h.house].fp;
      if (!edit.hold) hits.push({ kind: 'editHouse', ...footRect(ox + fx, oy + fy, fw, fd, 70) });
      if (UI_EDIT_SEL === 'house') { ctx.save(); ctx.setLineDash([6 * z, 5 * z]); ctx.lineDashOffset = -ts / 60; flatRect(ox + fx - 0.2, oy + fy - 0.2, fw + 0.4, fd + 0.4, null, '#ef7d3c', 0.3, 2.4 * z); ctx.restore(); }
      if (edit.areaDrag && hover) {
        const pr = edit.areaDrag, o = areaDropAt(pr, hover.x, hover.y), A = pr.k === 'drive' ? driveOf(h) : areaOf(h, pr.k), ny = pr.k === 'drive' ? A.y : o.y;
        const ok = pr.k === 'drive' ? driveFits(h, A.st, o.x) === 'ok' : areaFits(pr.k, o.x, o.y);
        flatRect(ox + o.x, oy + ny, A.w, A.d, ok ? 'rgba(76,175,106,.35)' : 'rgba(229,72,77,.35)', ok ? '#4caf6a' : '#e5484d', 0.5, 2 * z);
      }
    }
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
      // v0.16: the workout happens in town (liveTownObjs), not at home
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
    if (use === 'sleep') {
      // into bed: walk to the side of the bed by the pillow, sit on the edge facing out, then lie down under the quilt
      // (a quick fade, so the body never slides through the mattress). A double bed: the pillow on your side.
      const hy = (LIE_HEAD[it.k] || 0.35) + 0.27, along = it.rot ? 'x' : 'y';
      const near = along === 'y' ? (a.x < it.x + w / 2 ? -1 : 1) : (a.y < it.y + d / 2 ? -1 : 1);
      const L = along === 'y' ? [it.k === 'bed' ? (near < 0 ? it.x + 0.55 : it.x + w - 0.55) : it.x + w / 2, it.y + hy] : [it.x + hy, it.k === 'bed' ? (near < 0 ? it.y + 0.55 : it.y + d - 0.55) : it.y + d / 2];
      const E = along === 'y' ? [near < 0 ? it.x + 0.22 : it.x + w - 0.22, L[1] + 0.15] : [L[0] + 0.15, near < 0 ? it.y + 0.22 : it.y + d - 0.22];
      const F = along === 'y' ? [E[0] + near * 0.5, E[1]] : [E[0], E[1] + near * 0.5];
      const out = (F[0] - E[0]) - (F[1] - E[1]) >= 0 ? 1 : -1, seatH = (LIE_H[it.k] || 10) - 1, walk = Math.hypot(F[0] - a.x, F[1] - a.y), steps = [];
      if (walk > 0.05) steps.push({ pose: 'walk', x: F[0], y: F[1], dur: walk / 1.6 });
      steps.push({ pose: 'sit', x: E[0], y: E[1], dur: 0.3, seatH, face: out });
      steps.push({ pose: 'sit', dur: 0.3, seatH, face: out });
      steps.push({ pose: 'sit', dur: 0.18, seatH, face: out, a0: 1, a1: 0 });
      steps.push({ pose: 'lie', x: L[0], y: L[1], jump: true, dur: 0.32, a0: 0, a1: 1 });
      return { steps, back: { id: it.id, use, E, F, L, seatH, out } };
    }
    const ex = clamp(a.x, it.x + m, it.x + w - m), ey = clamp(a.y, it.y + m, it.y + d - m);
    let ox = a.x - ex, oy = a.y - ey; const len = Math.hypot(ox, oy) || 1; ox /= len; oy /= len;
    const F = [ex + ox * 0.42, ey + oy * 0.42], walk = Math.hypot(F[0] - a.x, F[1] - a.y), steps = [];
    if (walk > 0.05) steps.push({ pose: 'walk', x: F[0], y: F[1], dur: walk / 1.6 });
    const seatH = SEAT_H[it.k] || 9;
    steps.push({ pose: 'sit', x: sp[0], y: sp[1], dur: 0.38, seatH, face: sp[2] });
    return { steps, back: { id: it.id, use, F, seatH } };
  }
  function exitSteps(b) {
    if (b.use === 'sleep') return [{ pose: 'lie', dur: 0.2, a0: 1, a1: 0 }, { pose: 'sit', x: b.E[0], y: b.E[1], jump: true, dur: 0.22, seatH: b.seatH, face: b.out, a0: 0, a1: 1 },
      { pose: 'sit', dur: 0.25, seatH: b.seatH, face: b.out }, { pose: 'walk', x: b.F[0], y: b.F[1], dur: 0.3 }];
    return [{ pose: 'sit', dur: 0.12, seatH: b.seatH }, { pose: 'walk', x: b.F[0], y: b.F[1], dur: 0.32 }];
  }
  function stepTr(a, dt) {
    const tr = a.tr;
    if (!tr.cur) {
      tr.cur = tr.steps.shift();
      if (!tr.cur) { a.tr = null; a.moving = false; a.alpha = 1; if (tr.done) tr.done(); return; }
      tr.t = 0; tr.from = [a.x, a.y];
    }
    const s = tr.cur, k = s.dur > 0 ? Math.min(1, (tr.t += dt) / s.dur) : 1, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(2 - 2 * k, 2) / 2;
    const tx = s.x ?? tr.from[0], ty = s.y ?? tr.from[1], u = s.jump ? 1 : s.pose === 'walk' ? k : e;
    const nx = tr.from[0] + (tx - tr.from[0]) * u, ny = tr.from[1] + (ty - tr.from[1]) * u;
    a.alpha = s.a0 !== undefined ? s.a0 + (s.a1 - s.a0) * k : 1;
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
    try { stepTrip(dt); } catch (e) { console.error(e); trip = null; }
    stepCamera(dt);
    SCENE_TOWN = mode === 'town' ? VIEW_TOWN : townOf(owner);
    TL = layoutOf(SCENE_TOWN);
    NIGHT = nightAmount(now(), SCENE_TOWN);
    GLOWS = [];
    ctx.clearRect(0, 0, W, H);
    hits = [];
    try {
      if (mode === 'interior') renderInterior(ts, dt);
      else if (mode === 'shop') renderShop(ts, dt);
      else renderWorld(ts, dt);
    } catch (e) { console.error(e); }
    drawFloats(ts);
    drawPing(ts);
  }
  let PING = 0;
  function drawPing(ts) {
    const age = (performance.now() - PING) / 1000;
    if (!PING || age > 4) return;
    let pt = null;
    if (mode === 'shop') pt = [meS.x, meS.y];
    else if (mode === 'town' && VIEW_TOWN === myTown()) pt = trip && !trip.arrived ? [trip.x, trip.y] : (S.work || S.jail || outHere()) ? mePos() : (() => { const [ox, oy] = origin('me'); return [ox + me.x, oy + me.y]; })();
    else if (mode === 'home' && owner === me.lot) { const [ox, oy] = origin(me.lot); pt = [ox + me.x, oy + me.y]; }
    if (!pt) return;
    const p = iso(pt[0], pt[1]), z = cam.z, k = (age * 1.4) % 1, a = Math.min(1, (4 - age) * 1.5);
    ctx.save(); ctx.globalAlpha = a;
    ellipse(p.x, p.y, (14 + k * 40) * Math.max(0.5, z), (7 + k * 20) * Math.max(0.5, z), null, `rgba(239,125,60,${1 - k})`, 3);
    const bob = Math.sin(ts / 180) * 4, py = p.y - Math.max(70, 64 * z) - bob;
    pill(`📍 ${t('you_here')}`, p.x, py, '#ef7d3c', '#ffffff', `800 13px ${UI_FONT},${EMOJI_FONT}`, 26);
    ctx.restore();
  }

  // ---------- input ----------
  const inside = (h, sx, sy) => sx >= h.x0 && sx <= h.x1 && sy >= h.y0 && sy <= h.y1;
  let lastTap = { x: 0, y: 0 };
  function tap(sx, sy) {
    lastTap = { x: sx, y: sy };
    useCam();
    if (edit) {
      if (edit.hold) { hover = { x: sx, y: sy }; const o = holdOrigin(sx, sy); return onHit({ kind: 'drop', x: o.x, y: o.y }); }
      const items = hits.filter(h => h.kind === 'item' && inside(h, sx, sy));
      const solid = items.filter(h => !h.flat);
      const pick = (solid.length ? solid : items).pop();
      if (pick) return onHit({ kind: 'item', id: pick.id });
      const ar = [...hits].reverse().find(h => (h.kind === 'editArea' || h.kind === 'editHouse') && inside(h, sx, sy));
      if (ar) return onHit(ar);   // v0.24: a farm area, the drive, the garage or the house
      const w = unIso(sx, sy), [ox, oy] = edit.scope === 'yard' ? origin('me') : [0, 0];
      return onHit({ kind: 'deselect', lx: w.x - ox, ly: w.y - oy });   // where you tapped (v0.15: moving a farm area there)
    }
    if (mode === 'shop') {   // v0.20: inside a store you walk to what you tapped, then it opens
      const h = [...hits].reverse().find(x => x.kind === 'clerk' && inside(x, sx, sy)) || [...hits].reverse().find(x => x.kind === 'ware' && inside(x, sx, sy))
        || [...hits].reverse().find(x => x.kind === 'shopDoor' && inside(x, sx, sy));
      const P = shopPlan(owner);
      if (h && h.kind === 'clerk') { shopWalk(P.till); return onHit(h); }   // v0.22: it opens at once; you walk over meanwhile
      if (h && h.kind === 'shopDoor') return shopWalk(P.door, () => onHit(h));
      if (owner === 'cinema' && meS.sit && P.aisle) { const w2 = h && P.wares.find(x => x.id === h.id); meS.sit = false; meS.path = [[P.aisle[0], meS.y]]; meS.moving = true; meS.then = () => { if (w2) shopWalk([w2.x + w2.w / 2, w2.y + w2.d + 0.55], () => onHit(h)); }; return; }   // v0.24: along the row to the aisle first
      if (h) { const w2 = P.wares.find(x => x.id === h.id); meS.sit = false; if (['escalator', 'cinemaDoor', 'cinemaExit'].includes(w2.kind)) return shopWalk([w2.x + w2.w / 2, w2.y + w2.d + 0.55], () => onHit(h)); shopWalk(w2.stand || [w2.x + w2.w / 2, w2.y + w2.d + 0.55]); return onHit(h); }
      const w0 = unIso(sx, sy);
      if (w0.x > 0 && w0.y > 0 && w0.x < P.RW && w0.y < P.RD) { meS.sit = false; shopWalk([w0.x, w0.y]); }
      return;
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
    for (const [st, s] of Object.entries(TL.streets)) {
      if (ty < s.y || ty >= s.y + LOT_D || tx < s.x || tx >= s.x + s.n * PARCEL) continue;
      const p = Math.floor((tx - s.x) / PARCEL);
      if (!parcelOwner(st, p)) { const run = vacantRuns().find(r => r.st === st && p >= r.p && p < r.p + r.n); landHit = { kind: 'land', st, p, n: run ? run.n : 1, run: run && run.p }; }
    }
    const { x: px, y: py } = TL.plaza, inPlaza = tx >= px && tx < px + LOT_W && ty >= py && ty < py + LOT_D;
    if (mode === 'town') {
      if (lotHit) return onHit({ kind: 'lot', owner: lotHit.id });
      if (landHit) return onHit(landHit);
      if (inPlaza) return onHit({ kind: 'plaza' });
      // the park, the town fields and the lake / sea are places too (v0.12)
      const P = TL.park, K = TL.lake;
      if (w.x >= P.x && w.x < P.x + P.w && w.y >= P.y && w.y < P.y + P.d) return onHit({ kind: 'place', key: 'park' });
      if (TL.fields.some(F => w.x >= F.x && w.x < F.x + F.w && w.y >= F.y && w.y < F.y + F.d)) return onHit({ kind: 'place', key: 'fields' });
      if (((w.x - K.x) / (K.rx + (K.sea ? 4 : 1))) ** 2 + ((w.y - K.y) / (K.ry + (K.sea ? 4 : 1))) ** 2 < 1) return onHit({ kind: 'place', key: 'lake' });
      if (w.x > WX0 && w.x < WX1 && w.y > WY0 && w.y < WY1) return onHit({ kind: 'spot', x: w.x, y: w.y });   // v0.16: anywhere else in town: go there
      return;
    }
    const [ox, oy] = origin(owner), lx = w.x - ox, ly = w.y - oy, h = homeOf(owner);
    const small = [...hits].reverse().find(x => ['animal', 'avatar', 'mailbox', 'tree', 'yard', 'shop'].includes(x.kind) && inside(x, sx, sy));
    if (small) return onHit(small);
    const fx = Math.floor(lx) - areaOf(h, 'fields').x, fy = Math.floor(ly) - areaOf(h, 'fields').y;
    if (fx >= 0 && fx < 4 && fy >= 0 && fy < 4) {
      const i = fy * 4 + fx;
      if (i < h.fields.length) return onHit({ kind: 'field', owner, i });
      if (owner === 'me' && fy === h.fields.length / 4) return onHit({ kind: 'buyLand' });
    }
    const big = [...hits].reverse().find(x => ['house', 'car', 'pond'].includes(x.kind) && inside(x, sx, sy));
    if (big) return onHit(big);
    if (owner === 'me') {
      if (!h.pastureLv && inRect(areaOf(h, 'pasture'), Math.floor(lx), Math.floor(ly))) return onHit({ kind: 'buyLand' });
      if (!h.orchardLv && inRect(areaOf(h, 'orchard'), Math.floor(lx), Math.floor(ly))) return onHit({ kind: 'buyLand' });
      if (!h.pondLv && inRect(areaOf(h, 'pond'), Math.floor(lx), Math.floor(ly))) return onHit({ kind: 'buyLand' });
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
      if (ptrs.size === 1) { const p = pos(e); drag = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: false, press: edit && !edit.hold ? editPress(p.x, p.y) : null }; }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z }; drag = null; }
    });
    cv.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') hover = pos(e);
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, pos(e));
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        useCam(); zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
        if (trip && !trip.arrived) trip.camFree = true;
      } else if (drag) {
        const p = pos(e), dx = p.x - drag.sx, dy = p.y - drag.sy;
        if (Math.hypot(dx, dy) > 6) drag.moved = true;
        if (drag.moved && drag.press) {   // v0.24: dragging a thing (or an area) in design mode
          hover = p;
          if (drag.press.type === 'item' && !edit.hold) { const it = findItem(edit.scope, drag.press.id); if (it) { edit.hold = { k: it.k, rot: it.rot, tint: it.tint, id: it.id }; edit.sel = null; edit.dragged = true; } }
          if (drag.press.type === 'area') edit.areaDrag = drag.press;
        } else if (drag.moved) { useCam(); cam.x = drag.cx + dx; cam.y = drag.cy + dy; fly = null; follow = false; dragging = true; if (trip && !trip.arrived) trip.camFree = true; clampCam(); }
      }
    });
    const end = e => {
      if (drag && drag.moved && drag.press && ptrs.size === 1) {   // v0.24: let go of what you dragged
        const p = pos(e); hover = p;
        if (drag.press.type === 'item' && edit && edit.hold) { const o = holdOrigin(p.x, p.y); onHit({ kind: 'drop', x: o.x, y: o.y, dragged: true }); }
        if (drag.press.type === 'area' && edit) { const o = areaDropAt(drag.press, p.x, p.y); edit.areaDrag = null; onHit({ kind: 'areaDrop', k: drag.press.k, x: o.x, y: o.y }); }
      } else if (drag && !drag.moved && ptrs.size === 1) { const p = pos(e); tap(p.x, p.y); }
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
      case 'field': { const [x, y] = fieldPos(tg.i, h); return () => [x + 0.5, y + 1.1, 1]; }
      case 'tree': { const [x, y] = orchardSlot(h, tg.i); return () => [x + 0.5, y + 1.15, 1]; }
      case 'pond': { const P = areaOf(h, 'pond'); return () => [P.x - 0.35, P.y + 1.5, 1]; }
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
  // Where you get onto a seat or into bed from (v0.13): in front of a seat (or another free side), beside the pillow
  // of a bed. You walk there along the floor first, so you never cut through the sofa or the bed on the way.
  function approachPt(it, a, h) {
    const [w, d] = itemSize('room', it), use = FURN[it.k].use, N = roomNav(h), free = ([x, y]) => open(N, Math.floor(x), Math.floor(y));
    let c;
    if (use === 'sleep') {
      const hy = (LIE_HEAD[it.k] || 0.35) + 0.42, along = it.rot ? 'x' : 'y';
      const side = n => (along === 'y' ? [n < 0 ? it.x - 0.45 : it.x + w + 0.45, it.y + hy] : [it.x + hy, n < 0 ? it.y - 0.45 : it.y + d + 0.45]);
      const nearFirst = (along === 'y' ? a.x < it.x + w / 2 : a.y < it.y + d / 2) ? [-1, 1] : [1, -1];
      c = [...nearFirst.map(side), it.rot ? [it.x + w + 0.45, it.y + d / 2] : [it.x + w / 2, it.y + d + 0.45]];
    } else {
      const front = it.rot ? [it.x + w + 0.45, it.y + d / 2] : [it.x + w / 2, it.y + d + 0.45];
      c = [front, it.rot ? [it.x + w / 2, it.y + d + 0.45] : [it.x + w + 0.45, it.y + d / 2], [it.x - 0.45, it.y + d / 2], [it.x + w / 2, it.y - 0.45]];
    }
    return c.find(free) || null;
  }
  function goInside(tg, o) {
    const h = homeOf(owner);
    cancel(meIn);
    let spot, pose = o.pose, dur = o.dur || 0, start = null, reach = 2.5;
    if (tg.kind === 'floor') spot = () => [tg.x, tg.y, 0];
    else if (tg.kind === 'exit') spot = () => [0.5, roomSize(h)[1] * 0.9, -1];
    else {
      const it = viewRoom(h).items.find(x => x.id === tg.id);
      if (!it) return false;
      const use = FURN[it.k].use, sp = useSpot(it), ap = use === 'sit' || use === 'sleep' ? approachPt(it, meIn, h) : null;
      spot = () => (ap ? [ap[0], ap[1], sp[2]] : sp);
      if (ap) reach = 0.6;
      pose = { sit: 'sit', sleep: 'lie', run: 'run', bike: 'bike', lift: 'lift', box: 'box', yoga: 'yoga' }[use];
      dur = Infinity;
      start = a => {
        if (use === 'sit' || use === 'sleep') { const q = seatSteps(a, it, sp, use); a.using = q.back; a.tr = { steps: q.steps, enter: true }; }
        else if (use !== 'lift' && use !== 'box') { a.x = sp[0]; a.y = sp[1]; }
        a.seat = SEAT[it.k] || 0; a.useId = it.id; if (use === 'run') a.phase = 0;
      };
    }
    meIn.jobs.push({ key: tg.kind, spot, pose, dur, reach, start, done: o.done, fail: o.fail });
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
    me.arriving = true;
  }

  // ---------- thumbnails for the shop and sheets ----------
  // How far an animal's drawing sits right of its anchor (measured once from the pixels), so thumbnails can centre it.
  const ANIMAL_MID = {};
  function animalMid(k, stage, breed = '') {
    const key = k + '|' + stage + '|' + breed;
    if (ANIMAL_MID[key] !== undefined) return ANIMAL_MID[key];
    const c = document.createElement('canvas'); c.width = 240; c.height = 200;
    const saved = [ctx, cam]; ctx = c.getContext('2d'); cam = { x: 0, y: 0, z: 1 };
    let mid = 0;
    try {
      drawAnimal(k, stage, 120, 160, 2, { face: 1, ts: 0, seed: 1, breed: breed || undefined });
      const d = ctx.getImageData(0, 0, 240, 200).data; let x0 = 240, x1 = -1;
      for (let y = 0; y < 200; y++) for (let x = 0; x < 240; x++) if (d[(y * 240 + x) * 4 + 3] > 150) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      if (x1 >= x0) mid = ((x0 + x1) / 2 - 120) / 2;
    } catch (e) { mid = 0; }
    [ctx, cam] = saved;
    return (ANIMAL_MID[key] = mid);
  }
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
      const z = frameFoot(1, 1, 26, w, h, 2.4), c = iso(0.5, 0.6), st = o.stage === undefined ? 2 : o.stage, dx = animalMid(k, st) * z * 1.25;
      ellipse(c.x, c.y, 30 * z, 14 * z, '#b8dd8c');
      drawAnimal(k, st, c.x - dx, c.y, z * 1.25, { face: 1, ts: 0, seed: 1 });   // centred over its patch of grass
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
      drawAnimal(B.kind, o.stage === undefined ? 2 : o.stage, w / 2 - animalMid(B.kind, o.stage === undefined ? 2 : o.stage, k) * s * (o.face || 1), h * 0.86, s, { face: o.face || 1, ts: o.ts || 0, seed: 1, breed: k, mood: o.mood || 'happy', moving: !!o.moving, phase: o.phase || 0 });
    },
    good(k, o, w, h) { ctx.font = `${h * 0.6}px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((GOODS[k] || CROPS[k]).e, w / 2, h / 2); },
    furn(k, o, w, h) {
      const D = FURN[k];
      frameFoot(D.w, D.d, 50, w, h, 2);
      flatRect(-0.1, -0.1, D.w + 0.2, D.d + 0.2, 'rgba(0,0,0,.05)');
      drawFurn({ k, rot: 0, tint: o.tint || (D.tint ? TINTS[4] : null) }, 0, 0, 1000);
    },
    yard(k, o, w, h) {
      const D = YARD[k], tall = ['tree', 'pine', 'lamp', 'swing', 'windmill', 'scarecrow', 'arch', 'well', 'hammock', 'slide', 'goldginkgo', 'finisharch', 'cabin', 'stage', 'court', 'flame', 'walkerstatue'].includes(k), huge = ['triumph', 'ringtower'].includes(k);
      frameFoot(D.w, D.d, huge ? 90 : tall ? 56 : 30, w, h, 2);
      flatRect(-0.05, -0.05, D.w + 0.1, D.d + 0.1, '#b6e092');
      drawYardItem({ k, rot: 0, placed: now() }, 0, 0, 1000);
    },
    car(k, o, w, h) { if (CARS[k].kind === 'two') frameFoot(1, 1.6, 30, w, h, 2.8); else frameFoot(1.1, 2.5, 34, w, h, 2); drawCar({ k, color: o.color || CAR_COLORS[0] }, 0, 0, 0); },
    house(k, o, w, h) {
      const H = HOUSES[k], [fx, fy, fw, fd] = H.fp, ex = o.extra || 0;
      frameFoot(fw + 0.6, fd + 0.6, (HOUSE_H[H.id] || (H.spec ? specHouseH(H) : 120)) + ex * (H.id === 'chinese' ? 38 : FLOOR_H), w, h, 1.6);
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
      const s = h / 27, g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#fff6e8'); g.addColorStop(1, '#ffe2c2');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // v0.28: the bigger chibi head, looking straight at you (wheelchair users are drawn from the side)
      if (o.look.mob === 'wheel') drawPerson(w / 2 - 1.2 * s, h * 0.55 + 31.2 * s, s, { look: o.look, face: 1, energy: o.energy || 'good', ts: 0, seed: 0 });
      else drawPerson(w / 2, h * 0.55 + 27.6 * s, s, { look: o.look, face: 1, view: 'front', turn: [1, 1], energy: o.energy || 'good', ts: 0, seed: 0, pose: 'stand' });
    },
    // v0.18: a whole townie facing you, to show a body type or an outfit
    outfit(k, o, w, h) {
      cam = { x: 0, y: 0, z: 1 };
      const L = o.look || S.me.look;
      drawPerson(w / 2, h * 0.94, Math.min(h * 0.86 / 50, w * 0.86 / 26), { look: L, face: 1, view: L.mob === 'wheel' ? undefined : 'front', turn: [0.35, 1], energy: 'great', ts: 0, seed: 0, pose: 'stand' });
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
    garage(k, o, w, h) { const n = o.n || 1, sz = garageSize(GARAGE.findIndex(g => g && g.cap === n)); frameFoot(sz.w, sz.d, 30, w, h, 1.6); drawGarage(0, 0, n, [S.me.cars[0] || null], 0); },
    pond(k, o, w, h) { frameFoot(3, 2, 20, w, h, 1.6); flatRect(-0.2, -0.2, 3.4, 2.4, '#b8dd8c'); drawPond(0, 0, 3, 2, 4, 0); },
    // v0.18: the mall's cinema: a short film on the big screen, rows of seats, you in the middle with popcorn
    movie(k, o, w, h) {
      const tt = Math.max(0, ((o.ts || 0) - (o.t0 || 0)) / 1000), sx = w * 0.08, sy = h * 0.05, sw = w * 0.84, sh = h * 0.52;
      ctx.fillStyle = '#1b1530'; ctx.fillRect(0, 0, w, h);
      const bg = { dino: ['#9fd7ff', '#7cc56b'], space: ['#0b0b2a', '#1d1d4a'], love: ['#ffd6e6', '#ffb3cf'], ocean: ['#2a7fd4', '#1c5ea3'], hero: ['#87c0ff', '#5a6b8a'], pets: ['#ffe9b0', '#9fd07a'] }[k] || ['#999', '#666'];
      ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
      ctx.fillStyle = bg[0]; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = bg[1]; ctx.fillRect(sx, sy + sh * 0.72, sw, sh * 0.28);
      const u = (tt / 8) % 1, X = f => sx + sw * f, Y = f => sy + sh * f, E = sh * 0.26;
      if (k === 'dino') { emoji('🌋', X(0.78), Y(0.5), E * 1.1); emoji('🌴', X(0.15), Y(0.55), E); emoji('🦖', X(-0.1 + u * 1.2), Y(0.62) - Math.abs(Math.sin(tt * 5)) * 6, E * 1.2); }
      if (k === 'space') { for (let i = 0; i < 30; i++) circle(X((i * 37 % 100) / 100), Y((i * 61 % 100) / 100), 0.8 + (Math.sin(tt * 3 + i) + 1) * 0.5, '#fff'); emoji('🪐', X(0.78), Y(0.3), E); emoji('🚀', X(0.1 + u * 0.8), Y(0.85 - u * 0.7), E * 1.1); }
      if (k === 'love') { emoji('🧑', X(0.38), Y(0.6), E * 1.1); emoji('👩', X(0.62), Y(0.6), E * 1.1); for (let i = 0; i < 5; i++) { const v = ((tt * 0.4 + i / 5) % 1); emoji('💕', X(0.3 + i * 0.1), Y(0.6 - v * 0.55), E * 0.5 * (1 - v * 0.4), 1 - v); } }
      if (k === 'ocean') { for (let i = 0; i < 4; i++) { ctx.beginPath(); for (let q = 0; q <= 20; q++) { const xx = X(q / 20), yy = Y(0.2 + i * 0.2) + Math.sin(q + tt * 2 + i) * 3; q ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.2; ctx.stroke(); } emoji('🐳', X(1.1 - u * 1.2), Y(0.5) + Math.sin(tt * 2) * 5, E * 1.3); emoji('🐠', X(0.2 + u * 0.5), Y(0.8), E * 0.6); }
      if (k === 'hero') { for (let i = 0; i < 8; i++) { ctx.fillStyle = '#4a5a78'; ctx.fillRect(X(i / 8), Y(0.5 + (i * 7 % 4) * 0.06), sw / 8 - 3, sh); } emoji('🦸', X(-0.1 + u * 1.2), Y(0.35) + Math.sin(tt * 3) * 6, E * 1.2); emoji('💥', X(0.7), Y(0.25), E * 0.6 * (1 + Math.sin(tt * 6) * 0.2)); }
      if (k === 'pets') { const b = Math.abs(Math.sin(tt * 4)); emoji('⚽', X(0.15 + u * 0.8), Y(0.8) - b * 16, E * 0.6); emoji('🐶', X(0.05 + u * 0.8), Y(0.72) - Math.abs(Math.sin(tt * 4 + 1)) * 8, E * 1.1); emoji('🌳', X(0.85), Y(0.55), E); }
      if (tt > 8) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = '#fff'; ctx.font = `800 ${sh * 0.16}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(curLang() === 'zh' ? '— 完 —' : '— The End —', w / 2, sy + sh / 2); }
      ctx.restore();
      const g = ctx.createLinearGradient(0, sy + sh, 0, h); g.addColorStop(0, 'rgba(160,190,255,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, sy + sh, w, h - sy - sh);
      const L = o.look || S.me.look;
      [0.66, 0.79, 0.92].forEach((ry, r) => {
        for (let i = 0; i < 9; i++) {
          const cx = w * (0.08 + i * 0.105) + (r % 2) * 6, cy = h * ry, me = r === 0 && i === 4;
          if (me) { circle(cx, cy - 10, 7, L.skin); ctx.fillStyle = L.hairCol; ctx.beginPath(); ctx.arc(cx, cy - 11, 7.4, Math.PI, Math.PI * 2); ctx.fill(); ctx.fillRect(cx - 7.4, cy - 11, 14.8, 5); emoji('🍿', cx + 12, cy - 4, 12); }
          else if ((i * 7 + r * 3) % 5 !== 0) { circle(cx, cy - 9, 6, '#3a3352'); }
          rrect(cx - 9, cy - 4, 18, 12, 4, me ? '#c0392b' : '#7a2430');
        }
      });
    },
    // v0.18: the claw machine full of plush toys
    claw(k, o, w, h) {
      const mx = w / 2 - 50, my = 6, mw = 100, mh = h - 12;
      rrect(mx, my, mw, mh, 10, '#ec6aa8'); rrect(mx + 8, my + 10, mw - 16, mh * 0.62, 6, '#d9f1fb');
      line(mx + 20, my + 16, mx + mw - 20, my + 16, '#9aa3ad', 2);
      const cx = mx + mw * 0.55; line(cx, my + 16, cx, my + 34, '#9aa3ad', 1.6);
      line(cx, my + 34, cx - 7, my + 44, '#9aa3ad', 2); line(cx, my + 34, cx + 7, my + 44, '#9aa3ad', 2);
      Object.values(MALL.plush).forEach((e, i) => emoji(e, mx + 22 + (i % 3) * 26, my + mh * 0.6 - Math.floor(i / 3) * 16, 18));
      rrect(mx + 8, my + mh * 0.7, mw - 16, mh * 0.24, 6, '#c2185b');
      circle(mx + 30, my + mh * 0.82, 7, '#f2c230'); line(mx + 66, my + mh * 0.82, mx + 66, my + mh * 0.74, '#2d2d2d', 3); circle(mx + 66, my + mh * 0.73, 5, '#e5484d');
    },
    // v0.18: the holding cell at the police station: a bench, bars and you, a bit glum
    cell(k, o, w, h) {
      const z = frameFoot(4, 3, 46, w, h, 2.6), A = iso(0, 0), B = iso(4, 0), D = iso(0, 3);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) tile(i, j, (i + j) % 2 ? '#c9ccd2' : '#bfc3ca');
      poly([D, A, up(A, 46 * z), up(D, 46 * z)], '#dfe3ea'); poly([A, B, up(B, 46 * z), up(A, 46 * z)], '#eef1f6');
      wallRect([A, B], 0, 0.55, 0.8, 30, 40, '#bfe6f7', '#5b6470', 1.4);
      for (let i = 1; i < 4; i++) wallLine([A, B], 0, 0.55 + i * 0.0625, 30, 0.55 + i * 0.0625, 40, '#5b6470', 1.2);
      box(0.2, 0.3, 2.6, 0.7, 8, '#8a6a4a', 0, { top: '#a8835c' });
      const me2 = iso(1.5, 1.6); drawPerson(me2.x, me2.y, z, { look: S.me.look, face: 1, view: 'front', turn: [0.6, 1], energy: 'tired', ts: 0, seed: 3, pose: 'stand' });
      const a = iso(0, 3), b = iso(4, 3); for (let i = 0; i <= 12; i++) { const u = i / 12, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u; line(x, y, x, y - 46 * z, '#4a505a', 2 * z); }
      line(a.x, a.y - 44 * z, b.x, b.y - 44 * z, '#4a505a', 2.4 * z); line(a.x, a.y - 22 * z, b.x, b.y - 22 * z, '#4a505a', 1.6 * z);
    },
    // Inside a store (v0.17): a floor, two walls, shelves with the store's goods, a counter and the shopkeeper.
    storein(k, o, w, h) {
      const S2 = STORES[k] || STORES.market, z = frameFoot(6, 4, 40, w, h, 2.4), wall = S2.wall || '#f1f0ea';
      const A = iso(0, 0), B = iso(6, 0), D = iso(0, 4);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) tile(i, j, (i + j) % 2 ? '#e9e2d4' : '#ded5c4');
      poly([D, A, up(A, 46 * z), up(D, 46 * z)], shade(wall, -0.08)); poly([A, B, up(B, 46 * z), up(A, 46 * z)], wall);
      wallRect([A, B], 0, 0, 1, 40, 46, S2.roof || '#c9893a');
      const goods = { market: ['🥕', '🌽', '🍅', '🌾', '🥬', '🍓'], nursery: ['🌳', '🌲', '🌸', '🪴', '⛲', '🌻'], ranch: ['🐔', '🐑', '🐷', '🐮', '🦆', '🐐'], petshop: ['🐶', '🐱', '🦴', '🐟', '🧶', '🥣'],
        furniture: ['🛋️', '🛏️', '🪑', '💡', '🖼️', '🕰️'], realty: ['🏠', '🏡', '🏰', '🗺️', '🔑', '📄'], dealer: ['🚗', '🚙', '🏎️', '🛻', '🚐', '🏍️'], mall: ['👕', '👖', '👟', '🏆', '🎮', '🍿'] }[k] || ['🛍️'];
      wallRect([A, B], 0, 0.62, 0.92, 16, 36, '#bfe6f7', '#fffaf0', 1.4);   // a window
      flatRect(1.2, 1.6, 3.4, 1.6, shade(S2.roof || '#c9893a', 0.35));     // a rug
      [[0.15, 0.15], [2.0, 0.15], [3.85, 0.15]].forEach(([sx, sy], i) => {   // shelves along the back wall, full of goods
        const b = box(sx, sy, 1.75, 0.55, 32, '#b07a4a');
        [8, 18, 28].forEach((hh, j) => { wallRect(b.left, 0, 0, 1, hh - 0.6, hh, '#8a5a36'); [0.25, 0.5, 0.75].forEach((u, q) => { const p = wallPt(b.left, 0, u, hh + 4.2); emoji(goods[(i * 3 + j + q) % goods.length], p.x, p.y, 10 * z); }); });
      });
      [[0.2, 1.4], [0.2, 2.6]].forEach(([sx, sy], i) => { const b = box(sx, sy, 0.55, 1, 22, '#c99a6b'); [0.3, 0.7].forEach((u, q) => { const p = wallPt(b.right, 0, u, 26); emoji(goods[(i * 2 + q + 3) % goods.length], p.x, p.y, 10 * z); }); });
      if (k === 'dealer') { drawCar({ k: 'sports', color: '#e5484d' }, 2.1, 1.4, 0); drawCar({ k: 'sedan', color: '#2f80ed' }, 3.6, 1.6, 0); }
      box(3.9, 3.0, 1.8, 0.6, 14, '#c99a6b', 0, { top: '#e6c79a' });   // the counter
      { const c = iso(4.4, 3.3); emoji('💳', c.x, c.y - 16 * z, 9 * z); }
      const p = iso(4.9, 2.8); drawPerson(p.x, p.y, z, { look: { shirt: S2.roof || '#2f80ed', skin: '#f3c59f', hair: 'short', hairCol: '#2b1d14', mob: 'walk' }, face: -1, view: 'front', turn: [0.2, 1], energy: 'great', ts: 0, seed: 5, pose: 'stand' });
      const me2 = iso(1.4, 3.4); drawPerson(me2.x, me2.y, z, { look: S.me.look, face: 1, view: 'back', turn: [0.7, -0.7], energy: 'good', ts: 0, seed: 3, pose: 'stand' });
      { const pl = iso(5.6, 0.6); ellipse(pl.x, pl.y - 2 * z, 6 * z, 3 * z, '#9a6a44'); circle(pl.x, pl.y - 12 * z, 8 * z, '#5aa552'); circle(pl.x - 3 * z, pl.y - 16 * z, 5 * z, '#74c169'); }
    },
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
    // v0.16: centre what was drawn in the picture (cars, animals, things all sit in the middle of their circle)
    if (!['commune', 'good', 'house'].includes(kind)) try {
      const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
      let x0 = c.width, x1 = -1, y0 = c.height, y1 = -1;
      for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const dx = Math.round(c.width / 2 - (x0 + x1) / 2), dy = Math.round(c.height / 2 - (y0 + y1) / 2);
      if (x1 > x0 && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        const c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height;
        c2.getContext('2d').drawImage(c, dx, dy * 0.6);   // a little lower than the exact middle looks right in a circle
        const url2 = c2.toDataURL(); thumbCache.set(id, url2); return url2;
      }
    } catch (e) { /* keep it as drawn */ }
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
      if (kind === 'field') { const [x, y] = fieldPos(arg, S.me); p = iso(ox + x + 0.5, oy + y + 0.5); p.y -= 8 * z; r = 30 * z; }
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
    dropEnts() { ents.clear(); },
    // Going somewhere in town (v0.12). to: a world point (a gate or a place); how: walk / bike / car.
    travel(to, how, car, done, dest, place, pick) { if (mode !== 'town') return false; TRIP_CAR = pick === undefined ? null : pick; try { startTrip(to, how, car, done, dest, place); } finally { TRIP_CAR = null; } return true; },
    mePoint() { if (!S) return null; TL = layoutOf(myTown()); const keep = VIEW_TOWN; return S.work || S.jail || (S.out && S.out.town === myTown()) ? (VIEW_TOWN === myTown() ? mePos() : null) : (() => { const [ox, oy] = origin('me'); return [ox + me.x, oy + me.y]; })(); },
    pingMe() { PING = performance.now(); },
    // v0.30: inside a building: sit at / lie on / work out on something for a while, then done(); what you're doing now
    venueUse(id, secs, done, mate) { if (mode === 'shop' && VENUE_LOOK[owner]) venueUseNow(id, secs, done, mate); else if (done) done(); },
    venueBusy() { return mode === 'shop' && meS.use && meS.use.until ? Math.max(0, Math.ceil((meS.use.until - performance.now()) / 1000)) : 0; },
    // v0.29: on the way somewhere: the view goes with you again (after you dragged it away); stop where you are
    followTrip() { if (!trip || trip.arrived || mode !== 'town') return false; trip.camFree = false; return true; },
    stopTrip() { return stopTripHere(); },
    // v0.25: walk up to someone in town (a person out walking or someone in the park), then have a chat
    canWalkUp(id) { return mode === 'town' && VIEW_TOWN === myTown() && !S.work && !S.study && !jailed() && !!(parkList().find(p => p.id === id) || (WALK.town === VIEW_TOWN && WALK.list.find(w => w.id === id))); },
    walkUp(id, done) {
      const pp = parkList().find(p => p.id === id), w = !pp && WALK.town === VIEW_TOWN && WALK.list.find(x => x.id === id);
      if (mode !== 'town' || (!pp && !w)) { if (done) done(); return; }
      stopTripHere();   // v0.29: from where you are now
      if (w) { w.path = []; w.stay = Math.max(w.stay || 0, 14); w.moving = false; }   // they stop for you
      const pt = pp ? [pp.x, pp.y] : [w.x, w.y], stand = [pt[0] + 0.15, pt[1] + 1.05], from = mePos();   // just in front of them
      const inPark = q => { const P = TL.park; return q[0] > P.x && q[0] < P.x + P.w && q[1] > P.y && q[1] < P.y + P.d; };
      const near = Math.hypot(stand[0] - from[0], stand[1] - from[1]) < 4 || (inPark(from) && inPark(stand)), path = near ? [stand] : [...route(from, stand), stand];   // across the lawn when you're both in the park
      const place = pp ? 'park' : (S.out && S.out.place) || null;
      trip = { kind: 'chat', town: VIEW_TOWN, legs: [{ how: 'walk', from, path }], li: 0, how: 'walk', inCar: false, car: null, x: from[0], y: from[1], path: path.slice(), dest: null, place, face: 1, phase: 0, moving: true, dir: '+y', arrived: false, t: now(),
        done: () => { CHAT = { id, until: performance.now() + 4000 }; if (w) w.stay = Math.max(w.stay, 5); if (done) done(); } };
    },
    parkFolk() { return parkList().map(p => ({ id: p.id, work: !!p.work, boss: !!p.boss })); },
    stroll(done) {   // v0.25: a lap of the park's jogging path, then back where you started
      if (mode !== 'town' || !TL.parkLoop) { if (done) done(); return; }
      stopTripHere();
      const loop = smoothPts(TL.parkLoop, 1.2).map(p => [p[0], p[1]]), from = mePos();
      let k0 = 0, bd = 1e9; loop.forEach((p, i) => { const d = Math.hypot(p[0] - from[0], p[1] - from[1]); if (d < bd) { bd = d; k0 = i; } });
      const lap = [...loop.slice(k0), ...loop.slice(0, k0), loop[k0], from];
      trip = { kind: 'stroll', town: VIEW_TOWN, legs: [{ how: 'walk', from, path: lap }], li: 0, how: 'walk', inCar: false, car: null, x: from[0], y: from[1], path: lap.slice(), done, dest: null, place: 'park', face: 1, phase: 0, moving: true, dir: '+y', arrived: false, t: now() };
    },
    // Public places (v0.12): where each one is (where you walk to), and whether you're there now.
    placePoint(key) { TL = layoutOf(VIEW_TOWN); return placePt(key); },
    here() { return S && S.work && VIEW_TOWN === myTown() ? S.work.place : S && jailed() && VIEW_TOWN === myTown() ? 'police' : trip && !trip.arrived ? null : outHere() ? S.out.place : null; },
    resting() { return mode === 'interior' && owner === 'me' && !!meIn.useId && !!(homeOf('me').room.items.concat(...(homeOf('me').ups || []).map(u => u.items)).find(i => i.id === meIn.useId && FURN[i.k].use === 'sleep')); },
    arriveAt(pt, place) { if (!S) return; S.out = { town: VIEW_TOWN, pt, place: place || null, id: null }; trip = null; if (mode === 'town') flyTo(pt[0], pt[1], Math.max(cam.z, 0.5)); },
    tripTime(to, how, dest, place, pick) { if (!S) return 0; TRIP_CAR = pick === undefined ? null : pick; try { return Math.max(1, Math.round(tripSecs(planTrip(to, how, dest, place)))); } finally { TRIP_CAR = null; } },
    liveAt() { TL = layoutOf(VIEW_TOWN); return liveSpotTown(); },
    lookAt(x, y) { if (mode === 'town') flyTo(x, y, Math.max(cam.z, 0.45)); },
    tripPlan(to, how, dest, place) { return planTrip(to, how, dest, place); },   // for testing
    tripNow() { return trip && !trip.arrived ? { how: trip.inCar ? trip.how : 'walk', toCar: !!(trip.legs[trip.li] || {}).toCar, kind: trip.kind || null } : null; },
    endTrip() { trip = null; },
    finishTrip() { finishTripNow(false); },
    // a trip that was still on the way when the app closed: you're there now (v0.19)
    resumeTrip() {
      const T = S && S.trip;
      if (!T || trip) return;
      const keep = VIEW_TOWN; VIEW_TOWN = T.town; TL = layoutOf(T.town);
      const car = T.how === 'walk' ? null : S.me.cars[S.me.car];
      if (T.how !== 'walk' && !car) T.how = 'walk';
      try { startTrip(T.to, T.how, car, null, T.dest, T.place); finishTripNow(true); } finally { VIEW_TOWN = keep; TL = layoutOf(keep); trip = null; S.trip = null; }
    },
    homeBay: () => { TL = layoutOf(myTown()); return homeBay(); },
    gate: id => { TL = layoutOf(VIEW_TOWN); return gateOf(id); },
    onStairs: () => !!meIn.anim,
    setView(m, o = 'me') {
      if (m === mode && o === owner) return;
      const wasInterior = mode === 'interior';
      if ((m === 'home') !== (mode === 'home') && m !== 'interior' && !wasInterior) viewFade = performance.now();   // a soft flash between the town and a home
      mode = m; owner = o; edit = null;
      if (m !== 'town' && trip) finishTripNow(true);   // v0.19: leaving the town view, you still get there
      cv.style.background = '';
      if (m === 'shop') { const P = shopPlan(o), at = (P.from && P.from[SHOP_FROM]) || P.door; meS.x = at[0]; meS.y = at[1] + 0.3; meS.path = []; meS.then = null; meS.moving = false; meS.face = 1; meS.sit = false; meS.use = null; SHOP_FROM = o;
        if (o === 'cinema' && FILM) { meS.x = P.door[0]; meS.y = P.door[1]; setTimeout(() => shopWalk(P.aisle, () => { meS.path = [P.seat]; meS.moving = true; meS.then = () => { meS.sit = true; meS.face = 1; if (FILM && !FILM.t0) FILM.t0 = performance.now(); }; }), 300); } }
      else if (m !== 'town' && m !== 'interior') moveToLot(o);
      useCam();
      if (m === 'interior') { meIn.room = null; if (!wasInterior) frameView(true); }
      else if (!wasInterior) frameView(false);
      follow = false;
    },
    view: () => ({ mode, owner }),
    setFilm(k) { FILM = k ? { k, t0: null } : null; },
    film: () => FILM,
    clawGo() { CLAW_T = performance.now(); },
    shopEat(e) {   // sit down at a free table and eat
      if (mode !== 'shop') return;
      const P = shopPlan(owner), tb = P.decor.filter(d => d.kind === 'table' && d.i % 3 === 1)[0] || P.decor.find(d => d.kind === 'table');
      if (!tb) return;
      shopWalk([tb.x + tb.w / 2 + 0.75, tb.y + tb.d / 2 + 0.05], () => { meS.sit = true; meS.face = -1; meS.eat = { e, until: performance.now() + 8000 }; setTimeout(() => { meS.sit = false; }, 8000); });
    },
    shopWare: id => { const P = mode === 'shop' && shopPlan(owner); return P ? P.wares.find(w => w.id === id) : null; },
    shopGoWare(id, then) { if (mode !== 'shop') return; const P = shopPlan(owner), w = P.wares.find(x => x.id === id); if (w) shopWalk([w.x + w.w / 2, w.y + w.d + 0.55], then); },
    shopGoTill(then) { if (mode === 'shop') shopWalk(shopPlan(owner).till, then); },
    tapAt: () => lastTap,
    recenter() { if (!W) return; useCam(); if (mode === 'interior') frameView(true); else if (mode === 'home' && S.live) follow = true; else frameView(false); },
    startEdit(scope) { edit = { scope, hold: null, sel: null }; cancel(me); },
    stopEdit() { edit = null; },
    getEdit: () => edit,
    hold(item) { if (edit) { edit.hold = item; edit.sel = null; } },
    select(id) { if (edit) edit.sel = id; },
    editSel(k) { UI_EDIT_SEL = k; },
    go, goMany, flee, cancel: () => { cancel(me); cancel(meIn); },
    busy: () => me.jobs.length + (me.cur ? 1 : 0),
    wave(who) {
      const t0 = performance.now() + 1800;
      if (who === 'me') { me.wave = t0; meIn.wave = t0; return; }
      const e = ents.get((mode === 'interior' ? 'in:' : 'p:') + who); if (e) e.wave = t0;
    },
    floatLocal(x, y, text) { floatLocal(me.lot, x, y, text); },
    floatField(i, text, lot = me.lot) { const [x, y] = fieldPos(i, homeOf(lot)); floatLocal(lot, x + 0.5, y + 0.5, text); },
    floatAnimal(hid, aid, text) { const e = ents.get(hid + ':' + aid); if (e) floatLocal(hid, e.x, e.y, text); },
    floatMe(text) {
      if (mode === 'interior') floats.push({ text, wx: meIn.x, wy: meIn.y, inside: true, born: performance.now() });
      else floatLocal(me.lot, me.x, me.y, text);
    },
    floatHouse(text) { const [fx, fy, w, d] = HOUSES[S.me.house].fp; floatLocal('me', fx + w / 2, fy + d / 2, text); },
    thumb,
    debug: () => ({ traffic: CARS_OUT.list.map(c => [Math.round(c.x), Math.round(c.y), c.path.length, c.police ? 'police' : '']), walkers: WALK.list.map(w => [Math.round(w.x), Math.round(w.y), w.bike ? 'bike' : 'walk', w.path.length]), meS: { x: meS.x, y: meS.y, path: meS.path.length }, cam: { ...cam }, W, H, mode, owner, edit, ents: ents.size, me: { x: me.x, y: me.y, lot: me.lot, jobs: me.jobs.length, cur: !!me.cur, act: me.act && me.act.pose, pose: mePose() }, meIn: { x: meIn.x, y: meIn.y, pose: meIn.act && meIn.act.pose } }),
    look(z, wx, wy) { useCam(); cam.z = z; centerOn(wx, wy); fly = null; follow = false; },
    bench(n = 20) { const t0 = performance.now(); for (let i = 0; i < n; i++) render(t0 + i * 16); return +((performance.now() - t0) / n).toFixed(2); },
  };
})();
