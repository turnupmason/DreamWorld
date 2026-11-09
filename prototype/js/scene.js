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
  const WOODS = 14, OUT = { ch: 22 };
  let WX0, WY0, WX1, WY1, WB = '';
  // The town plan on screen (v0.12: every community has its own; see LAYOUTS in data.js). Set every frame.
  let TL = layoutOf(HOME_TOWN);
  // v0.38: every town has its own bounds now (its new district makes it bigger): the woods round it, the mountains
  // and the country beyond follow them
  const worldOf = () => TL.world || WORLD;
  function syncWorld() {
    if (WB === TL.id) return;
    const B = worldOf(); WB = TL.id;
    WX0 = B.x0 - WOODS; WY0 = B.y0 - WOODS; WX1 = B.x1 + WOODS; WY1 = B.y1 + WOODS;
    Object.assign(OUT, { x0: WX0 - 110, y0: WY0 - 110, x1: WX1 + 110, y1: WY1 + 110 });
  }
  syncWorld();
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
  const lieDir = it => (it ? [Math.atan2(-16, 32), Math.atan2(-16, -32), Math.atan2(16, -32), Math.atan2(16, 32)][(it.rot || 0) & 3] : 0);   // v0.46: four ways

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
    const Wb = worldOf(), c = unIso(W / 2, H / 2), x = clamp(c.x, Wb.x0 + 4, Wb.x1 - 4), y = clamp(c.y, Wb.y0 + 4, Wb.y1 - 4);
    if (x !== c.x || y !== c.y) centerOn(x, y);
  }
  function minWorldZoom() { const Wb = worldOf(); return Math.max(0.06, W / ((Wb.x1 - Wb.x0 + Wb.y1 - Wb.y0) * 32) * 1.25); }
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
      if (h.garageLv && !garageDoorTiles(h).some(([gx, gy]) => r(gx, gy))) return false;   // v0.46: you can walk up to the garage doors
      if (!near(MAILBOX[0], MAILBOX[1])) return false;
      return yard.every(it => { const [w2, d2] = itemSize('yard', it); return near(it.x, it.y, w2, d2) && (!needsFront('yard', it.k) || frontTiles('yard', it).some(([tx, ty]) => r(tx, ty))); });   // v0.46
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
  // v0.50: the bar over you while a job takes time (not sitting / lying down, which goes on until you get up)
  function actBar(a, p, z, ts) {
    const A = a.act;
    if (!A || !A.job || !(A.job.dur > 300) || !isFinite(A.job.dur)) return;
    doBar(p.x, p.y - 60 * z, 1 - (A.until - ts) / A.job.dur, A.job.e || { crouch: '🌱', pick: '🍎', fish: '🎣', mail: '📬' }[A.pose] || '⏳', z);
  }
  // v0.44: a little thought bubble over your head when you're hungry, lonely or bored (D244)
  function needBubble(p, z, ts) {
    if (z < 0.3 || !S) return;
    const n = needs(), low = ['hunger', 'social', 'fun'].filter(k => n[k] < NEED_LOW.low);
    if (!low.length) return;
    bubble(NEEDS[low[Math.floor(ts / 2200) % low.length]].e, p.x + 14 * z, p.y - 46 * z, z * 0.75, Math.abs(Math.sin(ts / 420)) * 2 * z);
  }
  function speedOf(h) {
    const e = h.id === 'me' ? energyLevel() : friendEnergy(h);
    return { great: 2.6, good: 2.2, tired: 1.7, exhausted: 1.3 }[e] * (h.id === 'me' && S.sick ? SICK.walk : 1) * (h.id === 'me' ? walkMult() : 1);   // ill: slower (v0.14); hungry: slower, happy: faster (v0.44)
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
    if (opt.mine && f && h.plots) { const nx = nextPlotSpot(h); if (nx) dashed(nx[0], nx[1], 1, 1); }   // v0.46: one plot at a time
    else if (opt.mine && f && h.fieldLv < FIELD_LEVELS.length - 1) { const F = areaOf(h, 'fields'); dashed(F.x, F.y + h.fields.length / 4, 4, 1); }
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
    const pc = cam.z > 0.45 ? 4 : 1;   // v0.49: close up, each tile of fence in four pieces (each put in front or behind on its own)
    const seg = (ax, ay, bx, by, kind) => { for (let k = 0; k < pc; k++) { const a0 = k / pc, a1 = (k + 1) / pc, px0 = ax + (bx - ax) * a0, py0 = ay + (by - ay) * a0, px1 = ax + (bx - ax) * a1, py1 = ay + (by - ay) * a1; objs.push({ d: ox + oy + (px0 + px1) / 2 + (py0 + py1) / 2 + 0.01, f: () => (kind === 'rail' ? rail : picket)(ox + px0, oy + py0, ox + px1, oy + py1) }); } };
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
    const H = houseToDraw(h), [fx, fy, w, d] = H.fp, ex = floorsOf(h) - H.floors[0], LH = H.spec && H.spec.walls ? H.spec : null;   // v0.48: a local style
    const zb = Math.round(Math.log(cam.z) / Math.log(1.15)), zq = Math.pow(1.15, zb), nb = NIGHT > 0.65 ? 2 : NIGHT > 0.25 ? 1 : 0;
    const key = `${h.house}|${h.wall}|${h.roof}|${ex}|${zb}|${nb}${LH ? `|${LH.id}|${LH.wallCol}|${LH.roofCol}|${LH.shutCol}` : ''}`;
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
      objs.push({ d: ox + oy + pr.x + 1.6 + pr.y + pr.d - 0.3, f: () => {   // v0.44: the feed trough (yours shows how full it is; tap it to fill it)
        const tx = ox + pr.x + 1.05, ty = oy + pr.y + pr.d - 0.55, mineT = h.id === 'me', fill = mineT ? (h.trough || 0) / FEED.trough : null;
        drawTrough(tx, ty, ts, fill);
        if (focus && mineT) { const c = iso(tx + 0.45, ty + 0.2); hits.push({ kind: 'trough', owner: h.id, x0: c.x - 18 * z, x1: c.x + 18 * z, y0: c.y - 16 * z, y1: c.y + 8 * z });
          if (!(h.trough > 0) && h.animals.some(a => !ANIMALS[a.k].pet && ANIMALS[a.k].every)) opt.bubbles.push({ kind: 'trough', p: { x: c.x, y: c.y - 14 * z }, ch: FEED.e, ok: true }); }
      } });
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
        if (f && focus && h.id === 'me' && (isRotten(fl) || cropWarn(fl))) { const c = iso(ox + x + 0.5, oy + y + 0.5); opt.bubbles.push({ kind: 'field', i, p: { x: c.x, y: c.y - 22 * z }, ch: isRotten(fl) ? '🍂' : '⏰', ok: true }); }   // v0.44
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
      objs.push({ d: ox + oy + G.x + G.y + (G.w + G.d) / 2, f: () => { const r = drawGarageAt(ox + G.x, oy + G.y, garageCap(h), inside, ts, h.garageRot || 0); if (focus && r) hits.push({ kind: 'garage', owner: h.id, ...r }); } });
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
          if (opt.mine && animalHungry(a)) opt.bubbles.push({ kind: 'trough', p: { x: p.x, y: p.y - 26 * z }, ch: FEED.e, ok: true });   // v0.44: hungry: fill the trough
          if (animalReady(a)) {
            const d = ANIMALS[a.k], baby = nextIsBaby(a), warn = prodWarn(a) && Math.floor(ts / 700) % 2;
            if (opt.mine) opt.bubbles.push({ kind: 'animal', id: a.id, p: { x: p.x, y: p.y - 26 * z }, ch: baby ? '🍼' : warn ? '⏰' : GOODS[d.prod].e, ok: true });
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
        drawPerson(p.x, p.y, z, { look: h.look, face: e.face, back: e.back && !e.wave, view: e.wave > performance.now() ? null : e.view, turn: e.turn, moving: e.moving, phase: e.phase, energy: friendEnergy(h), ts, seed: ox * 0.1, pose: e.pose || undefined, wave: e.wave > performance.now() || chatWave(h.id) });
        if (chatting(h.id)) chatBubble(p.x + 12 * z, p.y - 56 * z, z, false, ts);   // v0.31
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
    drawPerson(p.x, p.y, z, { look: S.me.look, face: me.face, back: me.back && (me.moving || !!me.livePose), view: me.act ? null : me.view, turn: me.turn, moving: me.moving, phase: me.phase, energy: energyLevel(), ts, seed: 3, pose, wave: me.wave > performance.now() || (chatting() && !!CHAT.e && !!CHAT.wave) }); needBubble(p, z, ts);
    if (chatting() && CHAT.e) chatBubble(p.x - 12 * z, p.y - 56 * z, z, true, ts);   // v0.31
    actBar(me, p, z, ts);   // v0.50
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
  const SIDEWALK = { avenue: 0.5, street: 0.42, lane: 0.36, dirt: 0, boulevard: 0.4, frontage: 0.45 };   // v0.38: + the new district's four-lane boulevard; v0.39: + the frontage roads
  // v0.47: the middle of a turning circle: just past the road's end, so the circle closes it off
  const culCentre = C => (C.h ? [C.x + C.sg * (C.r - 0.9), C.y] : [C.x, C.y + C.sg * (C.r - 0.9)]);
  function drawRoads(vr) {
    const z = cam.z, vis = r => !(r[2] < vr.x0 || r[0] > vr.x1 || r[3] < vr.y0 || r[1] > vr.y1), roads = TL.roads.filter(vis);
    // v0.27: one-way arrows (white, every few tiles, pointing the way to go)
    const arrows = () => roads.forEach(r => {
      const ow = r[5]; if (!ow || z < 0.18) return;
      const h = horiz(r), a0 = h ? r[0] : r[1], a1 = h ? r[2] : r[3], m = h ? (r[1] + r[3]) / 2 : (r[0] + r[2]) / 2, P = (u, v) => (h ? iso(u, m + v) : iso(m + v, u));
      for (let u = a0 + 2.2; u < a1 - 2; u += 4.5) (r[4] === 'frontage' ? [-0.52, 0.52] : [0]).forEach(o => {   // v0.39: one in each lane of a two-lane one
        const b = u + 0.9 * ow, tip = u + 1.6 * ow;
        poly([P(u, o - 0.13), P(b, o - 0.13), P(b, o - 0.38), P(tip, o), P(b, o + 0.38), P(b, o + 0.13), P(u, o + 0.13)], 'rgba(255,255,255,.9)');
      });
    });
    const horiz = r => r[2] - r[0] >= r[3] - r[1];
    roads.forEach(([x0, y0, x1, y1, kind]) => {   // pavement (or the dirt road's edges)
      flatRect(x0, y0, x1 - x0, y1 - y0, kind === 'dirt' ? '#c9ad80' : '#ddd6c8');
    });
    // v0.47: a turning circle where a road can't go on (a cul-de-sac): a round end with a kerb and a little planted island
    (TL.culs || []).forEach(C => {
      if (C.x < vr.x0 - 4 || C.x > vr.x1 + 4 || C.y < vr.y0 - 4 || C.y > vr.y1 + 4) return;
      const [cx, cy] = culCentre(C), dirt = C.kind === 'dirt', ring = R => { const pts = []; for (let k = 0; k < 28; k++) { const a2 = k / 28 * Math.PI * 2; pts.push(iso(cx + Math.cos(a2) * R, cy + Math.sin(a2) * R)); } return pts; };
      poly(ring(C.r + 0.45), dirt ? '#c9ad80' : '#ddd6c8');
      poly(ring(C.r), dirt ? '#d6bf95' : '#8e959c');
      if (!dirt && z > 0.2) { poly(ring(C.r * 0.36 + 0.12), '#d9d2c4'); poly(ring(C.r * 0.36), '#7cbf5e'); if (z > 0.35) { const q = iso(cx, cy); circle(q.x, q.y - 4 * z, 4 * z, '#4f9a4a'); circle(q.x - 1.4 * z, q.y - 5.4 * z, 2 * z, '#7cc06a'); } }
    });
    roads.forEach(r => {   // asphalt
      const [x0, y0, x1, y1, kind] = r, sw = SIDEWALK[kind] || 0.35, h = horiz(r);
      if (kind === 'dirt') { if (h) flatRect(x0, y0 + 0.35, x1 - x0, y1 - y0 - 0.7, '#d6bf95'); else flatRect(x0 + 0.35, y0, x1 - x0 - 0.7, y1 - y0, '#d6bf95'); return; }
      const col = kind === 'avenue' || kind === 'boulevard' || kind === 'frontage' ? '#80878f' : '#8e959c';
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
      if (kind === 'dirt' || (r[5] && kind !== 'frontage')) return;
      const h = horiz(r), [a0, a1, b0, b1] = h ? [x0, x1, y0, y1] : [y0, y1, x0, x1], m = (b0 + b1) / 2;
      const lo = Math.max(a0, Math.floor(h ? vr.x0 : vr.y0)), hi = Math.min(a1, h ? vr.x1 : vr.y1);
      const seg = (p, q, off, col, lw) => { const A = h ? iso(p, m + off) : iso(m + off, p), B = h ? iso(q, m + off) : iso(m + off, q); line(A.x, A.y, B.x, B.y, col, lw * z); };
      if (kind === 'avenue' || (kind === 'frontage' && !r[5])) { seg(lo, hi, -0.06, '#f2c230', 1.3); seg(lo, hi, 0.06, '#f2c230', 1.3); }
      else if (kind === 'boulevard') {   // v0.38: four lanes: a planted median down the middle (open where roads cross), dashed lines between the lanes
        const cuts = roads.filter(q => q !== r && horiz(q) !== h && (h ? q[1] <= y1 + 0.6 && q[3] >= y0 - 0.6 : q[0] <= x1 + 0.6 && q[2] >= x0 - 0.6)).map(q => (h ? [q[0] - 0.9, q[2] + 0.9] : [q[1] - 0.9, q[3] + 0.9])).sort((a, b) => a[0] - b[0]);
        const runs = []; let p0 = lo; cuts.forEach(([c0, c1]) => { if (c0 > p0) runs.push([p0, Math.min(c0, hi)]); p0 = Math.max(p0, c1); }); if (p0 < hi) runs.push([p0, hi]);
        const Q = (p, off) => (h ? iso(p, m + off) : iso(m + off, p));
        runs.forEach(([p, q]) => { if (q - p < 0.2) return;
          poly([Q(p, -0.24), Q(q, -0.24), Q(q, 0.24), Q(p, 0.24)], '#6fa85a', 'rgba(235,230,218,.95)', 1.4 * z);
          if (z > 0.3) for (let u = Math.ceil(p) + 0.5; u < q - 0.3; u += 1.5) { const c = Q(u, 0); circle(c.x, c.y - 3 * z, 3.4 * z, '#4f9a4a'); circle(c.x - 1 * z, c.y - 4 * z, 1.6 * z, '#7cc06a'); }   // little shrubs
          for (let u = Math.ceil(p) + 0.3; u < q - 0.4; u += 1) { seg(u, u + 0.45, -1.17, 'rgba(255,255,255,.85)', 1.4); seg(u, u + 0.45, 1.17, 'rgba(255,255,255,.85)', 1.4); } });
      }
      else for (let p = Math.ceil(lo) + 0.3; p < hi; p += 1) seg(p, p + 0.45, 0, kind === 'street' ? 'rgba(242,194,48,.95)' : 'rgba(255,255,255,.85)', 1.6);   // v0.39: a street's middle line is yellow (traffic both ways)
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
    if (onFreeway(x, y)) return true;   // v0.39
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
      const Wb = worldOf(), inside = inRectXY(i, j, Wb.x0, Wb.y0, Wb.x1, Wb.y1);
      const edge = Math.min(Math.abs(i - Wb.x0), Math.abs(i - Wb.x1), Math.abs(j - Wb.y0), Math.abs(j - Wb.y1));
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
  // v0.48: hills and mountains in 3D (Mason #28: "the golden hills should be solid; now it's all flat, rings on rings"):
  // a mesh of little quads over the footprint, each one lit by how its slope faces the light (from above and a little
  // from +x, like the houses), coloured by its height, and drawn far to near. at(u, v) → world [x, y] for u, v in -1..1;
  // hgt(u, v) → height in px (≤ 0: flat ground); colAt(f, u, v) → its colour at height f (0..1 of H).
  const TLIGHT = (() => { const L = [0.38, 0.12, 0.92], n = Math.hypot(...L); return L.map(v => v / n); })();
  // (polar: rings ρ 0..1 from the top out to the foot, sectors θ round it, so the foot is a smooth curve, no steps)
  function terrainMesh(at, hgt, H, colAt, NR, NS) {
    const z = cam.z, M = NS, P = [];
    for (let k = 0; k <= NR; k++) for (let q = 0; q < NS; q++) { const r = k / NR, th = q / NS * Math.PI * 2, [x, y] = at(r, th); P.push({ x, y, h: k === NR ? 0 : Math.max(0, hgt(r, th)), r, th }); }
    const V = (k, q) => P[clamp(k, 0, NR) * M + ((q % NS) + NS) % NS];
    // smooth light: each corner lit by the slope round it (so the hill reads as one soft surface, not facets)
    const lamAt = (k, q) => {
      const a = V(k + 1, q), b = V(k - 1, q), d = V(k, q + 1), e = V(k, q - 1);
      const eu = [a.x - b.x, a.y - b.y], ev = [d.x - e.x, d.y - e.y], hu = (a.h - b.h) / 32, hv = (d.h - e.h) / 32;
      const det = eu[0] * ev[1] - eu[1] * ev[0];
      if (Math.abs(det) < 1e-6) return TLIGHT[2];
      const gx = (hu * ev[1] - hv * eu[1]) / det, gy = (eu[0] * hv - ev[0] * hu) / det;
      return (-gx * TLIGHT[0] - gy * TLIGHT[1] + TLIGHT[2]) / Math.hypot(gx, gy, 1);
    };
    const lam = new Float32Array((NR + 1) * M); for (let k = 0; k <= NR; k++) for (let q = 0; q < NS; q++) lam[k * M + q] = lamAt(k, q);
    const quads = [];
    for (let k = 0; k < NR; k++) for (let q = 0; q < NS; q++) {
      const A = V(k, q), B = V(k, q + 1), C = V(k + 1, q + 1), D = V(k + 1, q);
      const L = (lam[k * M + q] + lam[k * M + (q + 1) % NS] + lam[(k + 1) * M + (q + 1) % NS] + lam[(k + 1) * M + q]) / 4;
      quads.push({ A, B, C, D, L, k: (A.x + B.x + C.x + D.x + A.y + B.y + C.y + D.y) / 4 });
    }
    quads.sort((p, q) => p.k - q.k);
    quads.forEach(({ A, B, C, D, L }) => {
      const f = (A.h + B.h + C.h + D.h) / 4 / H, base = colAt(Math.min(1, f), (A.r + C.r) / 2, (A.th + C.th) / 2), col = shade(base, clamp((L - 0.9) * 1.5, -0.32, 0.16) * clamp(f / 0.25, 0, 1));
      poly([A, B, C, D].map(p => up(iso(p.x, p.y), p.h * z)), col, col, 0.8 * z);
    });
  }
  // the shapes (ρ 0..1 from the top out, θ round it): a rounded hill, a pointed peak with ridges, a tall granite dome,
  // a flat-topped mesa or table mountain
  function terrainHgt(kind, H, seed) {
    return (r, th) => {
      if (kind === 'peak') return H * Math.pow(1 - r, 1.15) * (1 + 0.09 * Math.sin(5 * th + seed) * Math.min(1, r * 3));
      if (kind === 'sugar') return H * Math.pow(1 - r * r, 0.62);
      if (kind === 'mesa') return H * 0.78 * clamp((1 - r) / 0.34, 0, 1);
      if (kind === 'table') return H * 0.62 * clamp((1 - r) / 0.26, 0, 1);
      return H * Math.pow(1 - r * r, 1.4) * (1 + 0.05 * Math.sin(r * 7 + seed) * Math.sin(th * 3 - seed));   // dome
    };
  }
  // a footprint a little uneven all round (by seed)
  const wobble = (th, seed) => 1 + 0.1 * Math.sin(3 * th + seed) + 0.05 * Math.sin(7 * th + seed * 2.3);
  // v0.48: a still thing (a mountain, a hill) drawn once per zoom step into a picture and reused, like the houses far
  // away. (wx, wy): its anchor in the world; ext: how far it reaches round the anchor, in screen px at zoom 1
  // ([left, top, right, bottom]); draw(): draws it at the real camera (cam is swapped for one at the anchor).
  const STILL = new Map();
  function drawStill(key, wx, wy, ext, draw) {
    const zb = Math.round(Math.log(cam.z) / Math.log(1.12)), zq = Math.pow(1.12, zb), k2 = key + '|' + zb + '|' + PAL.woods;
    let s2 = STILL.get(k2);
    if (!s2) {
      const dpr = Math.min(2, window.devicePixelRatio || 1), W2 = (ext[0] + ext[2]) * zq, H2 = (ext[1] + ext[3]) * zq;
      if (W2 * H2 * dpr * dpr > 9e6) { draw(); return; }   // too big a picture: just draw it
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(W2 * dpr)); c.height = Math.max(1, Math.ceil(H2 * dpr));
      const saved = [ctx, cam, GLOWS];
      ctx = c.getContext('2d'); ctx.scale(dpr, dpr); GLOWS = [];
      const a0 = { x: (wx - wy) * TW / 2 * zq, y: (wx + wy) * TH / 2 * zq };
      cam = { x: ext[0] * zq - a0.x, y: ext[1] * zq - a0.y, z: zq };
      try { draw(); } catch (e) { console.error(e); }
      [ctx, cam, GLOWS] = saved;
      s2 = { c, W2, H2, ex: ext[0] * zq, ey: ext[1] * zq };
      STILL.set(k2, s2);
      if (STILL.size > 80) STILL.delete(STILL.keys().next().value);
    }
    const o = iso(wx, wy), k = cam.z / zq;
    ctx.drawImage(s2.c, o.x - s2.ex * k, o.y - s2.ey * k, s2.W2 * k, s2.H2 * k);
  }
  // Mountains behind the woods (north and west) so the edge of the world looks like a valley, not a blank.
  let PEAKS = null;
  function peaks() {
    if (PEAKS && PEAKS.id === TL.id) return PEAKS;
    PEAKS = []; PEAKS.id = TL.id;
    for (let x = WX0 - 6; x < WX1 + 10; x += 15) PEAKS.push({ x: x + hash(x, 1) * 6, y: WY0 - 16 + hash(x, 2) * 5, r: 9 + hash(x, 3) * 6, h: 150 + hash(x, 4) * 140 });
    for (let y = WY0 + 8; y < WY1 + 6; y += 15) PEAKS.push({ x: WX0 - 16 + hash(y, 5) * 5, y: y + hash(y, 6) * 6, r: 9 + hash(y, 7) * 6, h: 150 + hash(y, 8) * 140 });
    return PEAKS;
  }
  // v0.40: in the county's own shape (TERRAINS): pointed peaks (snow on top where it's cold), rounded hills, red mesas,
  // flat-topped mountains, granite domes; none at all where the land is flat
  const terrainNow = () => TERRAINS[countyOf(SCENE_TOWN).terrain] || TERRAINS.alpine;
  function mountains(objs, vr) {
    const K = TL.lake, T = terrainNow();
    if (T.peak === 'none') return;
    peaks().forEach(m => {
      if (m.x < vr.x0 - 20 || m.x > vr.x1 + 20 || m.y < vr.y0 - 20 || m.y > vr.y1 + 20) return;
      if (((m.x - K.x) / (K.rx + m.r + 4)) ** 2 + ((m.y - K.y) / (K.ry + m.r + 4)) ** 2 < 1) return;   // no mountains in the sea
      const R = m.r * 1.35 * 1.12, Hp = m.h * (T.tall || 1);
      objs.push({ d: m.x + m.y - 30, f: () => drawStill('peak|' + TL.id + '|' + m.x.toFixed(1) + ',' + m.y.toFixed(1) + '|' + countyOf(SCENE_TOWN).terrain, m.x, m.y, [R * 64, Hp + R * 32 + 20, R * 64, R * 32 + 10], () => drawPeak(T, m)) });   // v0.48: drawn once per zoom step
    });
  }
  function drawPeak(T, m) {   // v0.48: solid, in the county's own shape and colours
    const z = cam.z, c = iso(m.x, m.y), H = m.h * (T.tall || 1), rx = m.r * 1.05, ry = m.r * 0.95, kind = T.peak === 'dome' ? 'dome' : T.peak;
    ellipse(c.x, c.y + 4 * z, rx * 36 * z, rx * 16 * z, 'rgba(50,70,40,.18)');
    const [lit, dark] = T.cols, snow = T.snow ? 1 - T.snow * 1.05 : 2, seed = m.x * 0.37 + m.y * 0.11;
    const NR = clamp(Math.round(rx * 32 * z / 10), 9, 18), NS = clamp(Math.round(rx * 32 * z / 5), 32, 56), sz = kind === 'sugar' ? 0.8 : 1;
    terrainMesh((r, th) => { const k = r * wobble(th, seed) * sz; return [m.x + Math.cos(th) * k * rx, m.y + Math.sin(th) * k * ry]; }, terrainHgt(kind, H, seed), H, (f, r, th) => {
      if (f > snow + 0.04 * Math.sin(th * 9 + seed)) return T.snowCol || '#f4f6f8';
      let col = mixCol(dark, lit, 0.45 + 0.55 * f);
      if (f < 0.22) { const q = f / 0.22; col = mixCol(PAL.woods, col, q * q * (3 - 2 * q)); }   // the foot fades into the woods
      if (kind === 'mesa') col = Math.floor(f * 7) % 2 ? shade(col, 0.1) : shade(col, -0.05);
      if (T.terraces && f > 0.08) col = Math.floor(f * 11) % 2 ? shade(col, 0.12) : col;
      return col;
    }, NR, NS);
    if (kind === 'table' && Math.floor(m.x + m.y) % 3 === 0) { const tp = up(c, H * 0.62 * z); ellipse(tp.x - rx * 6 * z, tp.y - 4 * z, rx * 14 * z, 8 * z, 'rgba(255,255,255,.85)'); ellipse(tp.x + rx * 8 * z, tp.y - 6 * z, rx * 11 * z, 7 * z, 'rgba(255,255,255,.8)'); }   // the "tablecloth" cloud
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
        if (pil && a[2] > 3 && !fwBlocks(a[0], a[1])) { const g = iso(a[0], a[1]), top = up(g, (a[2] - 3) * z); rrect(g.x - 2.4 * z, top.y, 4.8 * z, g.y - top.y, 1.2 * z, '#a8a39a'); ellipse(g.x, g.y, 5 * z, 2.2 * z, 'rgba(0,0,0,.12)'); }   // a pillar
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
  // ---------- the interstate (v0.39) ----------
  // TL.fwy (built in buildLayout): s along it, t across it (t > 0 on the right of traffic going +s). Three lanes each
  // way and a concrete barrier between, a bridge over the cross road, slip ramps to the frontage roads, a tunnel into
  // a hill at each end (by the sea: a cable-stayed bridge out over the water at the south end). Its own traffic: cars
  // and lorries in lanes, overtaking on the left and keeping right; some leave by the ramps and drive into town, and
  // some of the town's cars drive up the ramps and away.
  const FW_LANE = k => 0.5 + FREEWAY.lane * (k + 0.5);   // the middle of lane k (0 = beside the barrier), right of traffic
  const fwAt = (F, s, t) => (F.axis === 'x' ? [s, F.c + t] : [F.c - t, s]);
  const fwST = (F, x, y) => (F.axis === 'x' ? [x, y - F.c] : [y, F.c - x]);
  const fwIso = (F, s, t, h = 0) => { const [x, y] = fwAt(F, s, t); return up(iso(x, y), h * cam.z); };
  const fwFront = F => (F.axis === 'x' ? 1 : -1);   // the side of it that faces you (t sign)
  const fwBridge = F => F.ends.find(e => e.k === 'bridge');
  const smooth01 = k => k * k * (3 - 2 * k);
  // how high the road is at s: up over the cross road, and out over the sea
  function fwH(F, s) {
    const o = F.over, d = Math.abs(s - o.s) - o.half, B = fwBridge(F);
    let h = d <= 0 ? o.h : d >= o.rise ? 0 : o.h * smooth01(1 - d / o.rise);
    if (B && s > B.s) h = Math.max(h, FREEWAY.bridge * smooth01(Math.min(1, (s - B.s) / 10)));
    return h;
  }
  // stretches drawn as things (slice by slice): the bridge over the cross road, the sea bridge
  const fwRaised = F => { const o = F.over, B = fwBridge(F), r = [[o.s - o.half - o.rise, o.s + o.half + o.rise]]; if (B) r.push([B.s, B.far]); return r; };
  // depth of anything on it: by 1-tile slices, then across (the side nearer you last)
  const fwSliceD = (F, a) => a + 0.5 + F.c + F.half + 0.2;
  const fwD = (F, s, t) => fwSliceD(F, Math.floor(s + 0.65)) + 0.01 + (t * fwFront(F) + F.half + 1) * 0.008;
  let FW_GEO = { id: '' };
  function fwGeo() {
    const F = TL.fwy;
    if (FW_GEO.id === TL.id) return FW_GEO;
    FW_GEO = { id: TL.id, ramps: [], hills: [] };
    if (!F) return FW_GEO;
    F.ramps.forEach((R, i) => {
      const S2 = smoothPts(R.pts.map(([s, t]) => [...fwAt(F, s, t), 0]), 0.5), cum = [0];
      for (let k = 1; k < S2.length; k++) cum.push(cum[k - 1] + Math.hypot(S2[k][0] - S2[k - 1][0], S2[k][1] - S2[k - 1][1]));
      FW_GEO.ramps.push({ i, d: R.d, off: R.off, S2, cum, len: cum[cum.length - 1], start: S2[0], end: S2[S2.length - 1] });
    });
    F.ends.forEach(e => { if (e.k === 'tunnel') FW_GEO.hills.push({ e, sc: e.s + e.side * 8.5, rs: 9, rt: 14, H: 150 }); });
    return FW_GEO;
  }
  // a point along a ramp, u tiles from its start
  function rampAt(R, u) {
    u = clamp(u, 0, R.len);
    let k = 1; while (k < R.cum.length - 1 && R.cum[k] < u) k++;
    const a = R.S2[k - 1], b = R.S2[k], f = (u - R.cum[k - 1]) / ((R.cum[k] - R.cum[k - 1]) || 1);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, b[0] - a[0], b[1] - a[1]];
  }
  const inHill = (Hl, s, t, m = 0) => Math.abs((s - Hl.sc) / (Hl.rs + m)) ** 2.6 + Math.abs(t / (Hl.rt + m)) ** 2.6 < 1;
  // the freeway, its ramps, the grass beside it, its hills: no wild trees
  function onFreeway(x, y) {
    const F = TL.fwy;
    if (!F) return false;
    const [s, t] = fwST(F, x, y), o = F.over, at = Math.abs(t), B = fwBridge(F);
    if (s < F.ends[0].s - 18 || s > (B ? B.far : F.ends[1].s + 18)) return false;
    if (at <= F.half + 1.8 || (at <= F.tn + 2.2 && Math.abs(s - o.s) <= FREEWAY.ramp[0] + 3)) return true;
    return fwGeo().hills.some(Hl => inHill(Hl, s, t, 1.2));
  }
  // under the bridge over the cross road (the expressway's pillars don't stand on the freeway either)
  function fwBlocks(x, y) { const F = TL.fwy; if (!F) return false; const [s, t] = fwST(F, x, y); return Math.abs(t) <= F.half + 1 && s > F.ends[0].s - 2 && s < F.ends[1].s + 2; }
  // a car on the cross road under the bridge is drawn before it; just in front of it, after it
  function fwDepthFix(x, y, d) {
    const F = TL.fwy;
    if (!F) return d;
    const [s, t] = fwST(F, x, y), o = F.over;
    if (Math.abs(s - o.s) > o.half + 1.2) return d;
    const ft = t * fwFront(F);
    if (Math.abs(t) <= F.half + 0.4) return fwSliceD(F, Math.floor(o.s - o.half) - 1) + 0.9;
    if (ft > F.half && ft < F.half + 3.5) return Math.max(d, fwSliceD(F, Math.ceil(o.s + o.half) + 1) + 0.2);
    return d;
  }
  const FW_ASPH = '#6b7279', FW_SHOULDER = '#a3a8ad';
  // the road surface between s0 and s1 (on the ground, or raised: h0 / h1 at each end)
  function fwSurface(F, s0, s1, h0 = 0, h1 = 0, lines = true) {
    const z = cam.z, P = (s, t, hh) => fwIso(F, s, t, hh), q = (t0, t1, col) => poly([P(s0, t0, h0), P(s1, t0, h1), P(s1, t1, h1), P(s0, t1, h0)], col);
    q(-F.half, F.half, FW_SHOULDER);
    q(0.42, 3.92, FW_ASPH); q(-3.92, -0.42, FW_ASPH);
    if (!lines || z < 0.08) return;
    const L = (t, col, w) => { const a = P(s0, t, h0), b = P(s1, t, h1); line(a.x, a.y, b.x, b.y, col, w * z, 'butt'); };
    [1, -1].forEach(sg => { L(sg * 3.85, 'rgba(255,255,255,.9)', 1.3); L(sg * 0.5, '#f2c230', 1.3); });
    if (z > 0.14) [1, -1].forEach(sg => [1, 2].forEach(k => {
      const tt = sg * (0.5 + FREEWAY.lane * k);
      for (let u = Math.ceil(s0 / 2) * 2; u < s1; u += 2) { const u1 = Math.min(s1, u + 0.75), f0 = (u - s0) / ((s1 - s0) || 1), f1 = (u1 - s0) / ((s1 - s0) || 1), a = P(u, tt, h0 + (h1 - h0) * f0), b = P(u1, tt, h0 + (h1 - h0) * f1); line(a.x, a.y, b.x, b.y, 'rgba(255,255,255,.85)', 1.2 * z, 'butt'); }
    }));
    // the concrete barrier down the middle
    const ft = fwFront(F), bh = 5;
    poly([P(s0, ft * 0.2, h0), P(s1, ft * 0.2, h1), P(s1, ft * 0.2, h1 + bh), P(s0, ft * 0.2, h0 + bh)], '#bdb6a9');
    poly([P(s0, -0.2, h0 + bh), P(s1, -0.2, h1 + bh), P(s1, 0.2, h1 + bh), P(s0, 0.2, h0 + bh)], '#e2ddd3');
  }
  // the freeway and its ramps on the ground (drawn with the roads)
  function freewayGround(vr) {
    const F = TL.fwy;
    if (!F || cam.z < 0.04) return;
    const z = cam.z, R = fwRaised(F)[0], B = fwBridge(F), vs0 = F.axis === 'x' ? vr.x0 - 2 : vr.y0 - 2, vs1 = F.axis === 'x' ? vr.x1 + 2 : vr.y1 + 2;
    const across = F.axis === 'x' ? [vr.y0 - 12, vr.y1 + 12] : [vr.x0 - 12, vr.x1 + 12];
    if (F.c < across[0] || F.c > across[1]) return;
    [[F.ends[0].s, R[0]], [R[1], B ? B.s : F.ends[1].s]].forEach(([s0, s1]) => {
      const a = Math.max(s0, vs0), b = Math.min(s1, vs1);
      if (b - a > 0.05) fwSurface(F, a, b);
    });
    // the slip ramps: a lane with a shoulder, white edge lines, chevrons where they split off
    fwGeo().ramps.forEach(Rp => {
      const S2 = Rp.S2;
      if (!S2.some(p => p[0] > vr.x0 - 3 && p[0] < vr.x1 + 3 && p[1] > vr.y0 - 3 && p[1] < vr.y1 + 3)) return;
      // v0.49: where it reaches the road (its last points) it turns into that road: no shoulder, no edge lines, the road's colour
      const end = S2[S2.length - 1], far2 = p2 => Math.hypot(p2[0] - end[0], p2[1] - end[1]) > 1.9, body = S2.filter(far2), foot = S2.filter(p2 => !far2(p2));
      strip(body, 2.0, FW_SHOULDER); strip(body, 1.3, FW_ASPH);
      if (foot.length) { const fs = [body[body.length - 1] || foot[0], ...foot]; strip(fs, 1.5, '#80878f'); }
      if (z > 0.12) [0.68, -0.68].forEach(o => {
        for (let k = 0; k < body.length - 1; k++) { const p = S2[k], q2 = S2[k + 1], dx = q2[0] - p[0], dy = q2[1] - p[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * o, ny = dx / L * o, A = iso(p[0] + nx, p[1] + ny), Bq = iso(q2[0] + nx, q2[1] + ny); line(A.x, A.y, Bq.x, Bq.y, 'rgba(255,255,255,.85)', 1.1 * z, 'butt'); }
      });
    });
  }
  // a hill with a tunnel through it (the portal shows on the end that faces you)
  function drawHill(F, Hl) {
    const z = cam.z, K = 9, n = 28, desert = PAL.tree === 'cactus', snow = !!PAL.snow, TH = terrainNow().hill;
    const cols = TH ? Array.from({ length: 9 }, (_, i) => mixCol(TH[0], TH[1], i / 8)) : desert ? ['#a8582f', '#b8663a', '#c47546', '#cf8553', '#d99462', '#e2a472', '#e8b283', '#eec094', '#f2cca4']
      : snow ? ['#5f7d6a', '#6f8e78', '#86a28c', '#a9bfae', '#cddbd2', '#e4ece8', '#f1f6f4', '#f7fafa', '#ffffff']
      : ['#3f7a42', '#4a8a4a', '#559852', '#62a65b', '#6fb263', '#7cbd6c', '#89c675', '#95cd7e', '#a1d387'];
    // v0.48: one solid hill (it was K flat rings stacked up): a mesh over its footprint, a rounded squarish dome
    const sup = (c2, e = 2.6) => Math.sign(c2) * Math.pow(Math.abs(c2), 2 / e);   // a rounded square, like the old one
    const hHgt = (r, th) => Hl.H * Math.pow(1 - r * r, 1.5) * (1 + 0.05 * Math.sin(r * 6 + Hl.sc) * Math.sin(th * 4));   // a gentle foot, a round top
    const [hx, hy] = fwAt(F, Hl.sc, 0), HR = (Hl.rs + Hl.rt) * 1.1;
    drawStill('hill|' + TL.id + '|' + Hl.sc + '|' + countyOf(SCENE_TOWN).terrain, hx, hy, [HR * 32 + 10, Hl.H + HR * 16 + 20, HR * 32 + 10, HR * 16 + 10], () => terrainMesh((r, th) => fwAt(F, Hl.sc + r * sup(Math.cos(th)) * Hl.rs, r * sup(Math.sin(th)) * Hl.rt), hHgt, Hl.H, f => { const g = 0.45 + 0.55 * f, k0 = Math.min(K - 1, Math.floor(g * (K - 1))), c0 = mixCol(cols[k0], cols[Math.min(K - 1, k0 + 1)], g * (K - 1) % 1), q = clamp(f / 0.3, 0, 1); return q < 1 ? mixCol(PAL.woods, c0, q * q * (3 - 2 * q)) : c0; }, clamp(Math.round(Math.max(Hl.rs, Hl.rt) * 32 * cam.z / 14), 8, 22), clamp(Math.round(Math.max(Hl.rs, Hl.rt) * 32 * cam.z / 6), 20, 64)));
    if (z > 0.12) for (let i = 0; i < 14; i++) {   // trees (or rocks in the desert) on its slopes
      const a = hash(i, Hl.sc) * Math.PI * 2, r = 0.2 + hash(i + 3, Hl.sc) * 0.62, ds = Math.cos(a) * Hl.rs * r, dt = Math.sin(a) * Hl.rt * r;
      if (Hl.e.side < 0 && ds > Hl.rs * 0.35 && Math.abs(dt) < F.half + 3) continue;   // not in front of the portal
      const hu = ds / Hl.rs, hv = dt / Hl.rt, hr = Math.pow(Math.pow(Math.abs(hu), 2.6) + Math.pow(Math.abs(hv), 2.6), 1 / 2.6), p = fwIso(F, Hl.sc + ds, dt, hr >= 1 ? 0 : Hl.H * Math.pow(1 - hr * hr, 1.5)), sz = 0.8 + hash(i + 7, Hl.sc) * 0.5;
      if (desert) { ellipse(p.x, p.y - 4 * z, 12 * z * sz, 6 * z * sz, '#9a4f2a'); ellipse(p.x - 2 * z, p.y - 6 * z, 7 * z * sz, 3 * z * sz, '#c4744a'); }
      else if (snow || PAL.tree === 'pine') { poly([{ x: p.x - 8 * z * sz, y: p.y }, { x: p.x, y: p.y - 28 * z * sz }, { x: p.x + 8 * z * sz, y: p.y }], '#2f6b4f'); if (snow) poly([{ x: p.x - 4 * z * sz, y: p.y - 14 * z * sz }, { x: p.x, y: p.y - 28 * z * sz }, { x: p.x + 4 * z * sz, y: p.y - 14 * z * sz }], '#f8fbfc'); }
      else { const L = PAL.leaf; circle(p.x, p.y - 12 * z * sz, 12 * z * sz, L[0]); circle(p.x + 5 * z * sz, p.y - 9 * z * sz, 8 * z * sz, L[1]); circle(p.x - 3 * z * sz, p.y - 17 * z * sz, 6 * z * sz, L[2]); }
    }
    const e = Hl.e;
    if (e.side > 0) return;
    // the portal: cut into rock, a concrete face with an arched hole for each way, lamps inside, the tunnel's name above
    const s = e.s, hw = F.half + 1.2, P = (t, h) => fwIso(F, s, t, h), Pr = (t, h) => fwIso(F, s - 0.6, t, h);
    poly([Pr(-hw - 3, 0), Pr(-hw - 2.6, 34), Pr(-hw - 0.8, 60), Pr(-hw * 0.4, 70), Pr(0.6, 64), Pr(hw * 0.5, 72), Pr(hw + 1, 58), Pr(hw + 2.8, 30), Pr(hw + 3.2, 0)], desert ? '#b5653a' : snow ? '#8f979c' : '#9d968a', 'rgba(0,0,0,.15)', 1 * z);
    poly([P(-hw, 0), P(hw, 0), P(hw, 46), P(-hw, 46)], '#d4cdc0', 'rgba(0,0,0,.18)', 1 * z);
    poly([P(-hw, 42), P(hw, 42), P(hw, 48), P(-hw, 48)], '#b5ad9f');
    [1, -1].forEach(sg => {
      const t0 = sg * 0.45, t1 = sg * (F.half - 0.1), arch = (grow, col) => {
        const pts = [P(t0 - sg * grow, 0)];
        for (let i = 0; i <= 14; i++) { const u = i / 14, tt = t0 - sg * grow + (t1 - t0 + 2 * sg * grow) * u, hh = 14 + grow * 4 + Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)) * 20; pts.push(P(tt, hh)); }
        pts.push(P(t1 + sg * grow, 0)); poly(pts, col);
      };
      arch(0.35, '#a39b8d'); arch(0, '#14171c');
      if (z > 0.2) for (let i = 1; i < 8; i++) { const u = i / 8, q = P(t0 + (t1 - t0) * u, 12 + Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)) * 16); circle(q.x, q.y, 1.4 * z, '#ffc861'); if (NIGHT > 0.2) glow(q.x, q.y, 8 * z, 0.5); }
    });
    if (z > 0.35) {
      const face = [P(hw, 0), P(-hw, 0)];
      wallRect(face, 0, 0.24, 0.76, 36, 45, '#1f6b45', '#ffffff', 0.7);
      wallText(face, 0.5, 40.5, t('fwy_tunnel', { name: townShort() }), 7.5 * z, '#ffffff');
    }
  }
  const mixCol = (a, b, f) => { const A = rgbOf(a), B = rgbOf(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * f)).join(',')})`; };
  const townShort = () => { const c = COMMUNITIES[VIEW_TOWN] || COMMUNITIES[HOME_TOWN]; return nm(c); };
  // one slice of the raised road (the bridge over the cross road, or the sea bridge)
  function fwSlice(F, s0, s1, sea) {
    const z = cam.z, h0 = fwH(F, s0), h1 = fwH(F, s1), o = F.over, ft = fwFront(F), hw = F.half, P = (s, t, h) => fwIso(F, s, t, h);
    const open = sea || (Math.abs((s0 + s1) / 2 - o.s) <= o.half);
    if (open) poly([P(s0, -hw + 0.6, 0), P(s1, -hw + 0.6, 0), P(s1, hw + 0.6, 0), P(s0, hw + 0.6, 0)], 'rgba(25,35,50,.16)');   // its shadow
    const G = 8;
    if (open) {
      if (sea && Math.floor(s0) % 6 === 0 && h0 > G + 1) [-1, 1].forEach(k => {   // a pier: two columns standing in the water
        const g = fwIso(F, s0, k * (hw - 1.4)), top = up(g, (h0 - G) * z);
        ellipse(g.x, g.y, 9 * z, 3.6 * z, 'rgba(255,255,255,.35)');
        rrect(g.x - 4 * z, top.y, 8 * z, g.y - top.y, 1.5 * z, k * ft > 0 ? '#ddd7cc' : '#c9c3b7');
      });
      poly([P(s0, ft * hw, h0 - G), P(s1, ft * hw, h1 - G), P(s1, ft * hw, h1), P(s0, ft * hw, h0)], '#ddd7cb');   // the girder
      const e0 = P(s0, ft * hw, h0 - G), e1 = P(s1, ft * hw, h1 - G); line(e0.x, e0.y, e1.x, e1.y, '#8f897e', 1.2 * z);
    } else poly([P(s0, ft * hw, 0), P(s1, ft * hw, 0), P(s1, ft * hw, h1), P(s0, ft * hw, h0)], '#cbc4b6');   // the retaining wall
    fwSurface(F, s0, s1, h0, h1, z > 0.1);
    // parapets
    [1, -1].forEach(sg => { const a = P(s0, sg * hw, h0), b = P(s1, sg * hw, h1), c2 = P(s1, sg * hw, h1 + 4), d2 = P(s0, sg * hw, h0 + 4); poly([a, b, c2, d2], sg === ft ? '#e8e3d9' : '#cfc9bd'); });
    // the abutment facing you, where the bridge over the cross road starts
    if (!sea && Math.abs(s1 - (o.s - o.half)) < 0.01) poly([P(s1, -hw, 0), P(s1, hw, 0), P(s1, hw, h1), P(s1, -hw, h1)], '#d8d2c6', 'rgba(0,0,0,.15)', 1 * z);
  }
  // the cable-stayed bridge's towers: one tall column on each side of the road (an H with beams across), the cables
  // fanning down from the top of each to its edge of the road. The far one is drawn first (behind the road), the
  // near one and the beams after it.
  const PYLON = 230;
  function drawPylon(F, sp, back) {
    const z = cam.z, hd = fwH(F, sp), hw = F.half + 0.45, ft = fwFront(F), k = back ? -ft : ft;
    const g = fwIso(F, sp, k * hw), q = up(g, PYLON * z);
    poly([{ x: g.x - 11 * z, y: g.y }, { x: g.x + 11 * z, y: g.y }, { x: q.x + 7 * z, y: q.y }, { x: q.x - 7 * z, y: q.y }], back ? '#cfc9bd' : '#ebe6dc', 'rgba(0,0,0,.14)', 0.8 * z);
    rrect(q.x - 8 * z, q.y - 9 * z, 16 * z, 10 * z, 2 * z, back ? '#bdb6a9' : '#d8d2c6');   // its cap
    ellipse(g.x, g.y, 13 * z, 5 * z, 'rgba(255,255,255,.4)');   // the water round its foot
    if (z > 0.06) { const a = up(fwIso(F, sp, k * hw), (PYLON - 14) * z); for (let i = 1; i <= 7; i++) [-1, 1].forEach(dir => { const ss = sp + dir * i * 3.6, b = fwIso(F, ss, k * (F.half - 0.05), fwH(F, ss) + 4); line(a.x, a.y, b.x, b.y, 'rgba(244,240,232,.9)', 0.9 * z); }); }
    if (back) return;
    const beam = h => { const a = fwIso(F, sp, -hw, h), b = fwIso(F, sp, hw, h); line(a.x, a.y, b.x, b.y, '#d6d0c4', 8 * z); };
    beam(PYLON - 40); beam(PYLON - 110);
    const lp = up(g, (PYLON + 2) * z); circle(lp.x, lp.y - 8 * z, 2.2 * z, '#ff4d4d'); if (NIGHT > 0.3) glow(lp.x, lp.y - 8 * z, 14 * z, 1);
  }
  // v0.47: an overhead sign bridge over one side of the freeway (Mason #28: "the freeway signs are ugly"): two sturdy
  // galvanised posts (in the median and past the shoulder) and a truss across, two panels with some thickness. Their
  // face (seen from one side): green with a white border, the interstate shield and the way it goes over arrows for
  // the lanes, and the exit panel with its tab on top; their back (from the other side): silver with stiffeners.
  function drawGantry(F, sg, d) {
    const z = cam.z, h0 = fwH(F, sg), P = (t, h, ds = 0) => fwIso(F, sg + ds, t, h0 + h), ta = d * 0.25, tb = d * (F.half + 0.35), TOP = 74, PB = 40, PT = 70;
    const post = tt => { const a0 = P(tt - 0.09, 0), a1 = P(tt + 0.09, 0), b0 = P(tt - 0.09, TOP + 2), b1 = P(tt + 0.09, TOP + 2); poly([a0, a1, b1, b0], '#a7adb4', 'rgba(0,0,0,.18)', 0.6 * z); const f0 = P(tt, 0, 0.09), f1 = P(tt, TOP + 2, 0.09); line(f0.x, f0.y, f1.x, f1.y, '#c9ced4', 1.1 * z); const bs = P(tt, 0); ellipse(bs.x, bs.y, 3.4 * z, 1.5 * z, '#8a9099'); };
    post(ta); post(tb);
    // the truss: a top and a bottom chord with a zigzag between them
    const lo = Math.min(ta, tb), hi = Math.max(ta, tb), chord = h => { const a = P(lo, h), b = P(hi, h); line(a.x, a.y, b.x, b.y, '#9aa1a8', 2 * z); };
    chord(TOP); chord(TOP - 5);
    for (let k = 0; k < 8; k++) { const u0 = lo + (hi - lo) * k / 8, u1 = lo + (hi - lo) * (k + 1) / 8, a = P(u0, k % 2 ? TOP : TOP - 5), b = P(u1, k % 2 ? TOP - 5 : TOP); line(a.x, a.y, b.x, b.y, '#9aa1a8', 1 * z); }
    const face = [P(hi, 0), P(lo, 0)].map(p2 => up(p2, -h0 * z)), front = d < 0;
    // the panels, with a dark edge behind for their thickness
    const uL = [0.04, 0.47], uR = [0.53, 0.96];
    const edgeFace = [P(hi, 0, -0.07), P(lo, 0, -0.07)].map(p2 => up(p2, -h0 * z));
    [uL, uR].forEach(([u0, u1]) => wallRect(edgeFace, h0, u0, u1, PB - 0.6, PT + 0.6, '#3b4046'));
    if (!front) {   // the back: silver, with the stiffeners across it
      [uL, uR].forEach(([u0, u1]) => { wallRect(face, h0, u0, u1, PB, PT, '#b9bfc5', '#8d949b', 0.8); [PB + 7, PB + 15, PB + 23].forEach(hh => wallRect(face, h0, u0 + 0.01, u1 - 0.01, hh, hh + 1.6, '#9aa1a8')); });
      return;
    }
    const green = '#1f6b45';
    [uL, uR].forEach(([u0, u1]) => { wallRect(face, h0, u0, u1, PB, PT, green, '#0f3f27', 0.8); wallRect(face, h0, u0 + 0.012, u1 - 0.012, PB + 1.2, PT - 1.2, null, '#ffffff', 0.9); });
    // the exit's tab on top of the right-hand panel
    wallRect(face, h0, uR[1] - 0.2, uR[1] - 0.012, PT, PT + 7, green, '#0f3f27', 0.8); wallRect(face, h0, uR[1] - 0.192, uR[1] - 0.02, PT + 0.8, PT + 6.2, null, '#ffffff', 0.7);
    if (z < 0.35) return;
    const mL = (uL[0] + uL[1]) / 2, mR = (uR[0] + uR[1]) / 2, fs = 6.4 * z, dirKey = F.axis === 'x' ? (d > 0 ? 'fwy_east' : 'fwy_west') : (d > 0 ? 'fwy_south' : 'fwy_north');
    // left: the interstate shield, the way it goes, an arrow down to each lane that carries on
    const sh = wallPt(face, h0, mL - 0.11, PT - 12);
    shieldGlyph(sh.x, sh.y, F.no, 1.05 * z);
    wallText(face, mL + 0.08, h0 + PT - 12, t(dirKey), fs * 1.05, '#ffffff');
    [-0.13, 0, 0.13].forEach(du => wallText(face, mL + du, h0 + PB + 6, '↓', fs * 1.1, '#ffffff'));
    // right: the exit
    wallText(face, uR[1] - 0.106, h0 + PT + 3.5, `${t('fwy_exit')} ${F.exit}`, fs * 0.62, '#ffffff');
    wallText(face, mR, h0 + PT - 11, t('fwy_downtown'), fs * 1.05, '#ffffff');
    wallText(face, mR + 0.12, h0 + PB + 6, '↘', fs * 1.2, '#ffffff');
  }
  // v0.47: the interstate shield itself (a real one: the red crown with "INTERSTATE", the blue shield, the white number)
  function shieldGlyph(cx, cy, no, k) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
    const outline = () => { ctx.beginPath(); ctx.moveTo(-6, -5.5); ctx.quadraticCurveTo(-3, -7.2, 0, -5.6); ctx.quadraticCurveTo(3, -7.2, 6, -5.5); ctx.lineTo(6.2, 0.5); ctx.quadraticCurveTo(6, 5.6, 0, 8); ctx.quadraticCurveTo(-6, 5.6, -6.2, 0.5); ctx.closePath(); };
    outline(); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.save(); ctx.scale(0.86, 0.86); outline(); ctx.clip(); ctx.fillStyle = '#1f4fa8'; ctx.fillRect(-8, -8, 16, 17); ctx.fillStyle = '#d6383e'; ctx.fillRect(-8, -8, 16, 5.2); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 1.5px ${UI_FONT}`; ctx.fillText('INTERSTATE', 0, -3.6);
    ctx.font = `900 ${String(no).length > 2 ? 4.4 : 5.4}px ${UI_FONT}`; ctx.fillText(String(no), 0, 2.2);
    ctx.restore();
  }
  // lamp posts down the middle
  function drawFwLamp(F, s) {
    const z = cam.z, h0 = fwH(F, s), a = fwIso(F, s, 0, h0 + 5), b = fwIso(F, s, 0, h0 + 52);
    line(a.x, a.y, b.x, b.y, '#7d848c', 1.8 * z);
    [-1, 1].forEach(k => { const c2 = fwIso(F, s, k * 1.6, h0 + 54); line(b.x, b.y, c2.x, c2.y, '#7d848c', 1.4 * z); ellipse(c2.x, c2.y + 1 * z, 3 * z, 1.4 * z, '#f4efe0'); if (NIGHT > 0.3) glow(c2.x, c2.y + 6 * z, 26 * z, 0.7); });
  }
  // the speed limit, the interstate shield (screen-facing little signs)
  function signPost(x, y, z, hgt = 26) { const b = iso(x, y), tp = up(b, hgt * z); line(b.x, b.y, tp.x, tp.y, '#8a9099', 1.6 * z); return tp; }
  function limitSign(x, y, k) {
    const z = cam.z, tp = signPost(x, y, z, 32), R = ROAD_KINDS[k], zh = curLang() === 'zh';
    if (zh) { circle(tp.x, tp.y - 7 * z, 8.5 * z, '#ffffff', '#d6383e', 2.2 * z); if (z > 0.35) { ctx.fillStyle = '#1d1d1f'; ctx.font = `800 ${(R.kmh >= 100 ? 6 : 7) * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(R.kmh), tp.x, tp.y - 6.6 * z); } }
    else { rrect(tp.x - 7 * z, tp.y - 18 * z, 14 * z, 18 * z, 1.4 * z, '#ffffff', '#1d1d1f', 1 * z); if (z > 0.35) { ctx.fillStyle = '#1d1d1f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${2.8 * z}px ${UI_FONT}`; ctx.fillText('SPEED', tp.x, tp.y - 15.2 * z); ctx.fillText('LIMIT', tp.x, tp.y - 12.2 * z); ctx.font = `800 ${7 * z}px ${UI_FONT}`; ctx.fillText(String(R.mph), tp.x, tp.y - 5.6 * z); } }
  }
  function shieldSign(x, y, no) {   // v0.47: the real shield, with an "ON-RAMP" plate under it
    const z = cam.z, tp = signPost(x, y, z, 34);
    shieldGlyph(tp.x, tp.y - 10 * z, no, 1.55 * z);
    if (z > 0.35) { rrect(tp.x - 7.5 * z, tp.y - 1.5 * z, 15 * z, 5 * z, 0.8 * z, '#ffffff', '#1d1d1f', 0.6 * z); ctx.fillStyle = '#1d1d1f'; ctx.font = `800 ${(curLang() === 'zh' ? 3.6 : 2.8) * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t('fwy_onramp'), tp.x, tp.y + 1 * z); }
  }
  // everything of the freeway that stands up: the raised road, the hills and tunnels, the sea bridge, lamps, signs
  function freewayObjs(objs, vr, ts) {
    const F = TL.fwy;
    if (!F || cam.z < 0.04) return;
    const z = cam.z, o = F.over, B = fwBridge(F), G = fwGeo();
    const sVis = s => { const a = fwAt(F, s, -F.half - 4), b = fwAt(F, s, F.half + 4); return boxVisible(Math.min(a[0], b[0]) - 3, Math.min(a[1], b[1]) - 3, Math.max(a[0], b[0]) + 3, Math.max(a[1], b[1]) + 3, vr); };
    fwRaised(F).forEach(([s0, s1], ri) => {
      for (let a = Math.floor(s0); a < s1; a += 1) {
        const lo = Math.max(s0, a), hi = Math.min(s1, a + 1);
        if (hi - lo < 0.01 || !sVis(lo)) continue;
        objs.push({ d: fwSliceD(F, a), f: () => fwSlice(F, lo, hi, ri === 1) });
      }
    });
    if (B) [B.s + 30, B.s + 72].forEach(sp => { if (sVis(sp) || sVis(sp - 20) || sVis(sp + 20)) { objs.push({ d: fwSliceD(F, Math.floor(sp)) - 0.5, f: () => drawPylon(F, sp, true) }); objs.push({ d: fwSliceD(F, Math.floor(sp)) + 0.11, f: () => drawPylon(F, sp, false) }); } });
    G.hills.forEach(Hl => {
      const a = fwAt(F, Hl.sc - Hl.rs, -Hl.rt), b = fwAt(F, Hl.sc + Hl.rs, Hl.rt);
      if (!boxVisible(Math.min(a[0], b[0]) - 4, Math.min(a[1], b[1]) - 8, Math.max(a[0], b[0]) + 4, Math.max(a[1], b[1]) + 4, vr)) return;
      objs.push({ d: Hl.e.side < 0 ? Hl.e.s + F.c - F.half - 2 : Hl.e.s + F.c + F.half + 1.5, f: () => drawHill(F, Hl) });
    });
    if (z < 0.1) return;
    const sEnd = B ? B.far - 4 : F.ends[1].s - 1;
    for (let s = Math.ceil((F.ends[0].s + 3) / 14) * 14; s < sEnd; s += 14) if (sVis(s)) objs.push({ d: fwD(F, s, 0), f: () => drawFwLamp(F, s) });
    [1, -1].forEach(d => { const sg = o.s - d * (FREEWAY.ramp[0] + 12); if (sVis(sg)) objs.push({ d: fwD(F, sg, d * 2) + 0.02, f: () => drawGantry(F, sg, d) }); });
    // speed limits after each tunnel and each on-ramp, the interstate shield where you go up the ramp
    if (z > 0.2) {
      const lim = [];
      [1, -1].forEach(d => { const e = d > 0 ? F.ends[0] : F.ends[1]; if (e.k === 'tunnel') lim.push([e.s + d * 6, d]); lim.push([o.s + d * (FREEWAY.ramp[0] + 4), d]); if (B && d < 0) lim.push([B.s - 4, d]); });
      lim.forEach(([s, d]) => { const [x, y] = fwAt(F, s, d * (F.half - 0.15)); if (boxVisible(x - 1, y - 1, x + 1, y + 1, vr)) objs.push({ d: fwD(F, s, d * F.half), f: () => limitSign(x, y, 'freeway') }); });
      G.ramps.filter(Rp => !Rp.off).forEach(Rp => { const p = Rp.S2[2], q = Rp.S2[3], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, x = p[0] - dy / L * 1.4, y = p[1] + dx / L * 1.4; if (boxVisible(x - 1, y - 1, x + 1, y + 1, vr)) objs.push({ d: x + y + 0.4, f: () => shieldSign(x, y, F.no) }); });
    }
  }
  // ---------- traffic on the freeway ----------
  let FW = { town: null, cars: [], next: [0, 0] };
  const FW_KINDS = ['sedan', 'suv', 'mini', 'pickup', 'luxury', 'minivan', 'sedan', 'suv', 'boxtruck', 'boxtruck', 'jeep', 'sports'];
  function fwNewCar(d, s, ln, v) {
    const k = FW_KINDS[Math.floor(Math.random() * FW_KINDS.length)], truck = k === 'boxtruck';
    const vmax = 13.5 * carPace(k) * (0.92 + Math.random() * 0.16) * (ROAD_KINDS.freeway.spd / 2.2);   // v0.47: each kind its own speed
    return { d, s, ln: truck ? 2 : ln, off: FW_LANE(truck ? 2 : ln), v: v === undefined ? vmax : v, vmax, car: { k, color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] }, mode: 'main', a: 0, cool: 1 + Math.random() * 2, exit: Math.random() < FREEWAY.exit, wait: 0, lazy: Math.random() < 0.45 };
  }
  // a town car drives up an on-ramp: it joins the freeway's traffic
  function fwJoin(c, ri) {
    const R = fwGeo().ramps[ri];
    if (!R) return;
    FW.cars.push({ d: R.d, s: 0, ln: 2, off: FW_LANE(2), v: 6, vmax: 13.5 * carPace(c.car.k) * (0.92 + Math.random() * 0.16), car: c.car, mode: 'on', ramp: ri, u: 0, a: 1, cool: 3, exit: false, wait: 0, police: c.police });
  }
  function fwFree(d, ln, pLo, pHi, me) { return !FW.cars.some(o => o !== me && o.mode === 'main' && o.d === d && (o.ln === ln || Math.abs(o.off - FW_LANE(ln)) < 0.7) && o.s * d > pLo && o.s * d < pHi); }
  function fwTraffic(objs, dt, ts) {
    const F = TL.fwy;
    if (!F || mode !== 'town') return;
    const G = fwGeo(), B = fwBridge(F), o = F.over, vr = viewRect();
    const sIn = d => (d > 0 ? F.ends[0].s - 1.5 : B ? B.far - 3 : F.ends[1].s + 1.5), sOut = d => (d > 0 ? (B ? B.far - 2 : F.ends[1].s + 1.5) : F.ends[0].s - 1.5);
    if (FW.town !== VIEW_TOWN || FW.id !== TL.id) {   // a fresh town: cars already on their way
      FW = { town: VIEW_TOWN, id: TL.id, cars: [], next: [0, 0] };
      [1, -1].forEach(d => { const a = sIn(d), b = sOut(d); for (let k = 0; k < 9; k++) { const c = fwNewCar(d, a + (b - a) * (k + Math.random() * 0.6) / 9, Math.floor(Math.random() * 3)); c.a = 1; c.exit = false; FW.cars.push(c); } });
    }
    const now2 = performance.now();
    [1, -1].forEach((d, i) => {   // new cars out of the tunnel (or off the far end of the bridge)
      if (now2 < FW.next[i] || FW.cars.filter(c => c.d === d).length > 14) return;
      FW.next[i] = now2 + 700 + Math.random() * 1300;
      const ln = Math.floor(Math.random() * 3), s = sIn(d);
      if (fwFree(d, ln, s * d - 3.5, s * d + 4)) FW.cars.push(fwNewCar(d, s, ln));
    });
    const main = FW.cars.filter(c => c.mode === 'main');
    FW.cars = FW.cars.filter(c => {
      c.cool -= dt;
      if (c.mode === 'main') {
        const d = c.d, p = c.s * d, safe = 2.8 + c.v * 0.17;
        let lead = null, gap = 1e9;
        main.forEach(q => { if (q === c || q.d !== d) return; const g = q.s * d - p; if (g > 0 && g < gap && Math.abs(q.off - c.off) < 0.8) { gap = g; lead = q; } });
        const div = o.s - d * FREEWAY.ramp[0], toExit = (div - c.s) * d;
        let target = c.vmax;
        if (lead && gap < safe) target = Math.max(0, Math.min(c.vmax, lead.v - (safe - gap) * 2.2));
        // overtake on the left; otherwise keep right; going to leave: over to the right-hand lane in good time
        if (c.exit && toExit > 0 && toExit < 60) { if (c.ln < 2 && c.cool <= 0 && fwFree(d, c.ln + 1, p - 3, p + 5, c)) { c.ln++; c.cool = 0.8; } }
        else if (lead && gap < safe + 3 && lead.v < c.vmax - 0.5 && c.ln > 0 && c.cool <= 0 && fwFree(d, c.ln - 1, p - 3, p + safe + 2, c)) { c.ln--; c.cool = 2.2; }
        else if (c.ln < 2 && c.cool <= 0 && !c.lazy && fwFree(d, c.ln + 1, p - 4, p + 12, c)) { c.ln++; c.cool = 3; }   // (some just stay in their lane)
        c.v += clamp(target - c.v, -26 * dt, 6 * dt);
        c.s += d * c.v * dt;
        c.off += (FW_LANE(c.ln) - c.off) * Math.min(1, dt * 2.6);
        if (c.exit && c.ln === 2 && (c.s - div) * d >= 0 && (c.s - div) * d < 3) { const ri = G.ramps.findIndex(R => R.off && R.d === d); if (ri >= 0) { c.mode = 'off'; c.ramp = ri; c.u = 0; } }
        // fade in out of the tunnel, out at the far end
        const inT = F.ends.some(e => e.k === 'tunnel' && (e.side < 0 ? c.s < e.s - 0.3 : c.s > e.s + 0.3));
        c.a = inT ? Math.max(0, c.a - dt * 6) : Math.min(1, c.a + dt * 3);
        if ((c.s - sOut(d)) * d > 0) return false;
        if (B && d > 0) c.a = Math.min(c.a, Math.max(0, (B.far - 2 - c.s) / 6));
      } else {
        const R = G.ramps[c.ramp];
        if (!R) return false;
        if (c.mode === 'off') { c.v += clamp(6.5 - c.v, -14 * dt, 4 * dt); c.u += c.v * dt; }
        else {   // up the on-ramp, then in to the right-hand lane when there's room
          c.v += clamp(c.vmax * 0.85 - c.v, -14 * dt, 7 * dt);
          if (c.u + c.v * dt >= R.len) {
            const sEnd = fwST(F, R.end[0], R.end[1])[0];
            if (!fwFree(c.d, 2, sEnd * c.d - 3, sEnd * c.d + 3) && (c.wait += dt) < 3) { c.v = 0; }
            else { c.mode = 'main'; c.s = sEnd; c.ln = 2; c.off = FW_LANE(2); c.cool = 2; return true; }
          } else c.u += c.v * dt;
        }
        if (c.mode === 'off' && c.u >= R.len) {   // down the ramp and into town
          const end = R.end, ends = [...TL.places, ...(TL.stores || []).map(st => storeGeo(st).bay)], b = ends[Math.floor(Math.random() * ends.length)];
          const path = b && route([end[0], end[1]], b, false);
          if (path && path.length > 1 && CARS_OUT.town === VIEW_TOWN) { const dx = R.S2[R.S2.length - 1][0] - R.S2[R.S2.length - 2][0], dy = R.S2[R.S2.length - 1][1] - R.S2[R.S2.length - 2][1]; CARS_OUT.list.push({ car: c.car, x: end[0], y: end[1], path: path.slice(1), dir: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '+x' : '-x') : (dy > 0 ? '+y' : '-y'), h: 0, alpha: 1, spd: 0.95 + Math.random() * 0.15 }); }
          return false;
        }
      }
      // draw it
      let x, y, h = 0, dir, s, tt;
      if (c.mode === 'main') { [x, y] = fwAt(F, c.s, c.d * c.off); h = fwH(F, c.s); s = c.s; tt = c.d * c.off; dir = F.axis === 'x' ? (c.d > 0 ? '+x' : '-x') : (c.d > 0 ? '+y' : '-y'); }
      else { const q = rampAt(R0(c), c.u); x = q[0]; y = q[1]; dir = Math.abs(q[2]) > Math.abs(q[3]) ? (q[2] > 0 ? '+x' : '-x') : (q[3] > 0 ? '+y' : '-y'); [s, tt] = fwST(F, x, y); }
      const ang = steer(c, x, y, dt);   // v0.47: round the ramps it really turns
      if (c.a <= 0.02 || x < vr.x0 - 4 || x > vr.x1 + 4 || y < vr.y0 - 4 || y > vr.y1 + 4) return true;
      objs.push({ d: Math.abs(tt) < F.half + 0.5 ? fwD(F, s, tt) : x + y + 0.6, f: () => { ctx.save(); ctx.globalAlpha = c.a; ctx.translate(0, -h * cam.z); drawCarAng(c.car, x, y, ang, ts); ctx.restore(); } });
      return true;
    });
    function R0(c) { return G.ramps[c.ramp]; }
  }
  // A live workout in town (v0.16): mini-you laps the park, swims in the lake, trains at the gym, does yoga on the lawn.
  let liveU = 0;
  function liveSpotTown() {
    if (!S.live) return null;
    const type = S.live.type, L = curveSamples().park;
    if (['walk', 'run', 'wheel', 'cycle'].includes(type) && L.length) { const i = Math.floor(liveU) % L.length; return [L[i][0], L[i][1]]; }
    if (type === 'swim') return swimSpot();
    if (type === 'yoga') { const PP = parkPlan(); return [PP.cx - 4.5, PP.cy + 3.6]; }   // v0.32: on the lawn by the fountain
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
    if (VENUE_HOME[key]) key = VENUE_HOME[key];   // v0.37: a floor of a tower
    const shop = TL.shops.find(([k]) => k === key), P = TL.park, F = TL.fields[0], K = TL.lake, C = TL.centre, st = (TL.stores || []).find(([k]) => k === key);
    if (shop) return [shop[1] + (shop[3] || 6) / 2, shop[2] + (shop[4] || 5.5) + 0.8];
    if (st) return storeGeo(st).door;
    if (key === 'plaza') return [TL.plaza.x + LOT_W / 2, TL.plaza.y + LOT_D + 0.8];
    if (key === 'park') { const PP = parkPlan(); return [PP.cx + 0.2, PP.cy + 3.2]; }   // v0.32: by the fountain
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
    TL.shops.forEach(([k, x, y, w = 6, d = 5.5]) => objs.push({ d: x + y + (w + d) / 2, f: () => { const r = drawShop(k, x, y, ts, w, d); if (!edit) hits.push({ kind: 'shop', k, pri: 1, ...r }); } }));
    // trees along the edges of the square (not on the plaza or in front of a shop)
    const free = (x, y) => !TL.roads.some(r => x > r[0] - 1 && x < r[2] + 1 && y > r[1] - 1 && y < r[3] + 1) && !(K && x > K.x - 1 && x < K.x + K.w + 1 && y > K.y - 1 && y < K.y + K.d + 1) && !(x > px - 1.5 && x < px + LOT_W + 1.5 && y > py - 1.5 && y < py + LOT_D + 1.5) && !TL.shops.some(([, sx, sy, sw = 6, sd = 5.5]) => x > sx - 1.5 && x < sx + sw + 1.5 && y > sy - 1.5 && y < sy + sd + 2)
      && !(TL.parks || []).some(([, qx, qy, qw, qd]) => x > qx - 1.2 && x < qx + qw + 1.2 && y > qy - 1.2 && y < qy + qd + 1.2);
    for (let x = C.x + 1.5; x < C.x + C.w - 1; x += 6.5) [C.y + C.d - 2, C.y + 1].forEach(y => { if (free(x, y)) objs.push({ d: x + y + 1, f: () => drawYardItem({ k: 'tree' }, x, y, ts) }); });
  }
  // ---------- the park (v0.32) ----------
  // A jogging loop round the edge; inside it two paths cross at a fountain, and the four lawns between them hold a duck
  // pond (top left), tennis and basketball courts (top right), a football pitch (bottom right) and a playground with
  // picnic tables (bottom left). People play on the courts and the pitch, kids bounce and slide, ducks paddle about,
  // and an ice-cream cart stands by the fountain. Tap a court, the pond, the bench or the cart to do something there.
  let PARK_PLAN = { id: '' };
  function parkPlan() {
    if (PARK_PLAN.id === TL.id) return PARK_PLAN;
    const P = TL.park, L = TL.parkLoop || [], lx = L.map(p => p[0]), ly = L.map(p => p[1]);
    const I = L.length ? { x0: Math.min(...lx) + 1.3, y0: Math.min(...ly) + 1.3, x1: Math.max(...lx) - 1.3, y1: Math.max(...ly) - 1.3 } : { x0: P.x + 3, y0: P.y + 3, x1: P.x + P.w - 3, y1: P.y + P.d - 3 };
    const cx = (I.x0 + I.x1) / 2, cy = I.y0 + (I.y1 - I.y0) * 0.45, g = 1.7;
    const q = { tl: [I.x0, I.y0, cx - g, cy - g], tr: [cx + g, I.y0, I.x1, cy - g], bl: [I.x0, cy + g, cx - g, I.y1], br: [cx + g, cy + g, I.x1, I.y1] };
    const qw = k => q[k][2] - q[k][0], qh = k => q[k][3] - q[k][1], R = (x, y, w, d) => ({ x, y, w, d });
    const pond = R(q.tl[0] + 0.4, q.tl[1] + 0.3, Math.min(9, qw('tl') - 3), Math.min(6, qh('tl') - 2.4));
    let ten = R(0, 0, 10, 5), bb = R(0, 0, 7.5, 5);
    const fitH = (a, b) => a.w + b.w + 1.2 <= qw('tr') - 0.4 && Math.max(a.d, b.d) <= qh('tr') - 0.5, fitV = (a, b) => Math.max(a.w, b.w) <= qw('tr') - 0.4 && a.d + b.d + 1.2 <= qh('tr') - 0.5;
    if (!fitH(ten, bb) && !fitV(ten, bb)) { ten = R(0, 0, 9, 4.4); bb = R(0, 0, 6.4, 4.2); }
    if (fitH(ten, bb)) { ten.x = q.tr[0] + 0.2; ten.y = q.tr[1] + 0.3; bb.x = ten.x + ten.w + 1.2; bb.y = ten.y; }
    else if (fitV(ten, bb)) { ten.x = q.tr[0] + 0.2; ten.y = q.tr[1] + 0.2; bb.x = ten.x; bb.y = ten.y + ten.d + 1.2; }
    else { ten.x = q.tr[0] + 0.2; ten.y = q.tr[1] + 0.2; bb = null; }
    const fw = clamp(qw('br') - 1.2, 10, 15), fd = clamp(qh('br') - 1.2, 6.5, 9.5), pitch = R(q.br[0] + (qw('br') - fw) / 2, q.br[1] + (qh('br') - fd) / 2, fw, fd);
    const play = R(q.bl[0] + 0.4, q.bl[1] + 0.3, Math.min(8.6, qw('bl') - 1), 4.6);
    // no room for the basketball court by the tennis court: it goes under the playground instead of the picnic tables
    if (!bb && play.y + play.d + 1.2 + 4.2 <= q.bl[3] - 0.3) bb = R(play.x, play.y + play.d + 1.2, 6.4, 4.2);
    const picnic = (bb && bb.x === play.x ? [[bb.x + bb.w + 1.0, bb.y + 0.6], [bb.x + bb.w + 1.0, bb.y + 2.6]].filter(([x]) => x + 2 < q.bl[2]) : [[play.x + 0.8, play.y + play.d + 1.6], [play.x + 4.4, play.y + play.d + 2.4]]).filter(([, y]) => y + 1 < q.bl[3]);
    const cart = R(cx + 2.9, cy + 0.85, 1.4, 0.9);
    const bench = R(cx - 3.6, cy - 2.9, 1, 1), benches = [[pond.x + 1.2, pond.y + pond.d + 0.6], [pond.x + 5.2, pond.y + pond.d + 0.6]];
    const flowers = [[cx - 3.1, cy + 1.8], [cx + 2.1, cy - 2.8], [cx - 2.2, cy + 2.4]];
    const lamps = [[cx - 1.0, cy - 5.2], [cx + 0.95, cy + 5.2], [cx - 6.4, cy + 0.95], [cx + 6.4, cy - 1.0]];
    const tramp = R(play.x + play.w - 2.4, play.y + 1.8, 2, 2);
    // where you stand to do each thing, and what you do there
    const spots = {
      tennis: { r: ten, kind: 'watch', stand: [ten.x + ten.w / 2, ten.y + ten.d + 0.7], use: { pose: 'stand', view: 'back', turn: [-0.2, -1], cheer: true } },
      basketball: bb && { r: bb, kind: 'watch', stand: [bb.x + bb.w / 2, bb.y + bb.d + 0.7], use: { pose: 'stand', view: 'back', turn: [-0.2, -1], cheer: true } },
      soccer: { r: pitch, kind: 'watch', stand: [pitch.x + pitch.w / 2, pitch.y - 0.75], use: { pose: 'stand', view: 'front', turn: [0.3, 1], cheer: true } },
      pond: { r: pond, kind: 'ducks', stand: [pond.x + pond.w / 2, pond.y + pond.d + 0.6], use: { pose: 'crouch', face: 1, prop: '🍞' } },
      bench: { r: bench, kind: 'bench', stand: [bench.x + 0.5, bench.y + 1.3], use: { pose: 'sit', face: 1, seatH: 6, at: [bench.x + 0.35, bench.y + 0.6] } },
      cart: { r: cart, kind: 'icecream', stand: [cart.x + 0.7, cart.y + cart.d + 0.6], use: { pose: 'stand', view: 'front', turn: [0.4, 1], prop: '🍦' } },
      play: { r: play, kind: 'play', stand: [tramp.x + 1, tramp.y + tramp.d + 0.5], use: { pose: 'jacks', face: 1, lift: 6, at: [tramp.x + 1, tramp.y + 1.1] } },
    };
    PARK_PLAN = { id: TL.id, I, cx, cy, q, pond, ten, bb, pitch, play, tramp, picnic, cart, bench, benches, flowers, lamps, spots };
    return PARK_PLAN;
  }
  // v0.34: walking about inside the park: along the paths and round things (the fountain, the courts, the pond, the
  // ice-cream cart, benches, trees), never through them. A grid over the park, cheap on the paths and the jogging loop,
  // dearer on the grass; the cheapest way, then straightened where a straight line costs no more.
  let PARK_GRID = { id: null };
  function parkGrid() {
    if (PARK_GRID.id === TL.id) return PARK_GRID;
    const P = TL.park, PP = parkPlan(), { cx, cy, I } = PP, GS = 0.5, gw = Math.ceil(P.w / GS), gd = Math.ceil(P.d / GS), cost = new Float32Array(gw * gd);
    const loop = TL.parkLoop || [], segD = (x, y) => { let b = 1e9; for (let i = 0; i < loop.length - 1; i++) { const [ax, ay] = loop[i], [bx, by] = loop[i + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, u = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1); b = Math.min(b, Math.hypot(ax + u * dx - x, ay + u * dy - y)); } return b; };
    const blocks = [PP.pond, PP.ten, PP.bb, PP.pitch, PP.cart, PP.tramp, PP.bench, ...PP.benches.map(([bx, by]) => ({ x: bx, y: by, w: 1, d: 1 })), ...PP.picnic.map(([bx, by]) => ({ x: bx - 0.2, y: by - 0.2, w: 2.2, d: 1.6 })), ...PP.flowers.map(([bx, by]) => ({ x: bx, y: by, w: 1, d: 1 }))].filter(Boolean);
    const trees = []; for (let k = 0; k < 16; k++) trees.push([P.x + 1 + (k * 7.3) % (P.w - 2) + 0.5, P.y + (k < 8 ? 0.2 : P.d - 1.2) + 0.5]); for (let k = 0; k < 6; k++) trees.push([P.x + (k % 2 ? P.w - 1.1 : 0.1) + 0.5, P.y + 4 + Math.floor(k / 2) * 9 + 0.5]);
    for (let j = 0; j < gd; j++) for (let i = 0; i < gw; i++) {
      const x = P.x + (i + 0.5) * GS, y = P.y + (j + 0.5) * GS, r = Math.hypot(x - cx, y - cy);
      let c = 2.6;
      if ((Math.abs(y - cy) <= 0.75 && x >= I.x0 - 1.6 && x <= I.x1 + 1.6) || (Math.abs(x - cx) <= 0.75 && y >= I.y0 - 1.6 && y <= I.y1 + 1.6) || r <= 2.75 || segD(x, y) <= 0.8) c = 1;
      if (r < 1.85) c = Infinity;   // the fountain
      if (blocks.some(B => x > B.x - 0.3 && x < B.x + B.w + 0.3 && y > B.y - 0.3 && y < B.y + B.d + 0.3)) c = Infinity;
      if (trees.some(([tx, ty]) => Math.hypot(x - tx, y - ty) < 0.6)) c = Infinity;
      cost[j * gw + i] = c;
    }
    PARK_GRID = { id: TL.id, P, GS, gw, gd, cost };
    return PARK_GRID;
  }
  const inParkPt = q => { const P = TL.park; return !!P && q[0] > P.x && q[0] < P.x + P.w && q[1] > P.y && q[1] < P.y + P.d; };
  function parkRoute(a, b) {
    const G = parkGrid(), { P, GS, gw, gd, cost } = G, n = gw * gd;
    const cellOf = q => [clamp(Math.floor((q[0] - P.x) / GS), 0, gw - 1), clamp(Math.floor((q[1] - P.y) / GS), 0, gd - 1)];
    const free = (i, j) => i >= 0 && j >= 0 && i < gw && j < gd && cost[j * gw + i] < Infinity;
    const snap = ([i, j]) => { if (free(i, j)) return [i, j]; let best = null, bd = 1e9; for (let jj = Math.max(0, j - 8); jj < Math.min(gd, j + 9); jj++) for (let ii = Math.max(0, i - 8); ii < Math.min(gw, i + 9); ii++) if (free(ii, jj)) { const d = Math.hypot(ii - i, jj - j); if (d < bd) { bd = d; best = [ii, jj]; } } return best; };
    const s = snap(cellOf(a)), e = snap(cellOf(b));
    if (!s || !e) return [b];
    const dist = new Float32Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n), heap = [];
    const push = (k, d) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const k0 = s[1] * gw + s[0], k1 = e[1] * gw + e[0];
    dist[k0] = 0; push(k0, 0);
    while (heap.length) {
      const [d, k] = pop(); if (done[k]) continue; done[k] = 1; if (k === k1) break;
      const i = k % gw, j = (k - i) / gw;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ii = i + di, jj = j + dj;
        if (!free(ii, jj) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;   // no cutting corners
        const kk = jj * gw + ii, nd = d + (cost[k] + cost[kk]) / 2 * (di && dj ? Math.SQRT2 : 1);
        if (nd < dist[kk]) { dist[kk] = nd; prev[kk] = k; push(kk, nd); }
      }
    }
    if (dist[k1] === Infinity) return [b];
    const cells = []; for (let k = k1; k !== -1; k = prev[k]) cells.unshift(k);
    const pt = k => { const i = k % gw; return [P.x + (i + 0.5) * GS, P.y + ((k - i) / gw + 0.5) * GS]; };
    // straighten: from each corner, go as far as a straight line that's no dearer than the steps it replaces
    const lineCost = (p, q) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), m = Math.max(1, Math.ceil(L / (GS * 0.4))); let c = 0; for (let t = 0; t < m; t++) { const u = (t + 0.5) / m, [ci, cj] = cellOf([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]), v = cost[cj * gw + ci]; if (v === Infinity) return Infinity; c += v * L / m; } return c; };
    const out = []; let i0 = 0;
    while (i0 < cells.length - 1) {
      let best = i0 + 1;
      for (let j = cells.length - 1; j > i0 + 1; j--) if (lineCost(pt(cells[i0]), pt(cells[j])) <= dist[cells[j]] - dist[cells[i0]] + 0.05) { best = j; break; }
      out.push(pt(cells[best])); i0 = best;
    }
    out.pop(); out.push(b);
    return out;
  }
  const PLAYER = (shirt, i, ex = {}) => ({ shirt, skin: SKINS[i % SKINS.length], hair: HAIRS[(i + 1) % HAIRS.length], hairCol: HAIR_COLORS[i % HAIR_COLORS.length], mob: 'walk', body: 'regular', top: 'tshirt', bottom: 'shorts', pants: '#2d2d2d', shoes: 'sneakers', hat: 'nohat', ...ex });
  const TEAMS = [0, 1, 2].map(i => PLAYER('#e5484d', i)).concat([3, 4, 5].map(i => PLAYER('#38a3e0', i)));
  const TENNIS_P = [PLAYER('#f4f4f0', 2, { bottom: 'skirt', pants: '#f4f4f0', hair: 'bun' }), PLAYER('#f2c230', 5, { hat: 'cap', hatCol: '#f4f4f0' })];
  const BALLERS = [PLAYER('#a46ef0', 1, { pants: '#a46ef0' }), PLAYER('#f59e0b', 4, { pants: '#2d2d2d', hat: 'beanie', hatCol: '#2d2d2d' })];
  const KIDS = [0, 1].map(i => dressUp({ shirt: ['#ec6aa8', '#34b27b'][i], skin: SKINS[(i + 2) % SKINS.length], hair: ['bun', 'short'][i], hairCol: HAIR_COLORS[i + 2], mob: 'walk' }, 'kid' + i));
  let TOWN_USE = null;   // what you're doing in the park right now (watching, feeding the ducks, on a bench…)
  function park(objs, vr, ts) {
    const P = TL.park;
    if (!boxVisible(P.x, P.y, P.x + P.w, P.y + P.d, vr)) return;
    const z = cam.z, t = ts / 1000, PP = parkPlan(), { cx, cy, I } = PP;
    const ball = (x, y, h, col = '#ffffff', r = 2.2) => { const p = iso(x, y); ellipse(p.x, p.y, r * 1.2 * z, r * 0.5 * z, 'rgba(0,0,0,.18)'); circle(p.x, p.y - h * z, r * z, col, 'rgba(0,0,0,.35)', 0.6 * z); };
    const who = (x, y, look, o, s = 1) => objs.push({ d: x + y + 0.3, f: () => { const p = iso(x, y); drawPerson(p.x, p.y - (o.lift || 0) * z, z * s, { look, energy: 'good', ts, seed: x, ...o }); } });
    const hitR = (k, r, h) => { const a = iso(r.x, r.y + r.d), b = iso(r.x + r.w, r.y), c0 = iso(r.x, r.y), c1 = iso(r.x + r.w, r.y + r.d); if (!edit) hits.push({ kind: 'parkSpot', k, pri: 2, x0: a.x, x1: b.x, y0: c0.y - h * z, y1: c1.y }); };
    // the lawn, the paths across it, and the paved circle where they meet
    flatRect(P.x, P.y, P.w, P.d, '#9bd176');
    flatRect(I.x0 - 1.4, cy - 0.7, I.x1 - I.x0 + 2.8, 1.4, '#e6dccb'); flatRect(cx - 0.7, I.y0 - 1.4, 1.4, I.y1 - I.y0 + 2.8, '#e6dccb');
    { const pts = []; for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2; pts.push(iso(cx + Math.cos(a) * 2.7, cy + Math.sin(a) * 2.7)); } poly(pts, '#ece2cf', 'rgba(150,130,100,.35)', 1); }
    // the pond, with ducks (they swim over when you feed them)
    const pd = PP.pond, feeding = TOWN_USE && TOWN_USE.k === 'pond';
    drawPond(pd.x, pd.y, pd.w, pd.d, 6, ts);
    for (let k = 0; k < 4; k++) {
      let x = pd.x + pd.w / 2 + Math.cos(t * 0.25 + k * 1.6) * pd.w * 0.3, y = pd.y + pd.d / 2 + Math.sin(t * 0.25 + k * 1.6) * pd.d * 0.26, face = -Math.sin(t * 0.25 + k * 1.6) > 0 ? 1 : -1;
      if (feeding) { x = pd.x + pd.w / 2 - 1.2 + k * 0.8 + Math.sin(t * 2 + k) * 0.15; y = pd.y + pd.d - 0.9 - (k % 2) * 0.5; face = k < 2 ? 1 : -1; }
      objs.push({ d: x + y, f: () => { const p = iso(x, y); drawAnimal('duck', k === 3 ? 0 : 2, p.x, p.y + 3 * z, z * (k === 3 ? 0.55 : 0.8), { face, ts, seed: k, moving: true, phase: ts / 160 + k }); } });
    }
    hitR('pond', pd, 6);
    // tennis: a blue court with white lines, a net, a fence behind; two players and the ball going back and forth
    { const T = PP.ten, mx = T.x + T.w / 2;
      flatRect(T.x - 0.5, T.y - 0.5, T.w + 1, T.d + 1, '#4f8f5a'); flatRect(T.x, T.y, T.w, T.d, '#3e7cc7');
      flatRect(T.x, T.y, T.w, T.d, null, 'rgba(255,255,255,.9)', 0, 1.4 * z); flatRect(T.x, T.y + T.d * 0.15, T.w, T.d * 0.7, null, 'rgba(255,255,255,.75)', 0, 1 * z);
      flatRect(T.x + T.w * 0.25, T.y + T.d * 0.15, T.w * 0.5, T.d * 0.7, null, 'rgba(255,255,255,.75)', 0, 1 * z); flatRect(T.x + T.w * 0.25, T.y + T.d / 2 - 0.03, T.w * 0.5, 0.06, 'rgba(255,255,255,.75)');
      objs.push({ d: T.x + T.y - 1, f: () => { [[T.x - 0.5, T.y - 0.5, T.x + T.w + 0.5, T.y - 0.5], [T.x - 0.5, T.y - 0.5, T.x - 0.5, T.y + T.d + 0.5]].forEach(([a0, b0, a1, b1]) => { const A = iso(a0, b0), B = iso(a1, b1); poly([A, B, up(B, 22 * z), up(A, 22 * z)], 'rgba(70,90,80,.16)', null); line(up(A, 22 * z).x, up(A, 22 * z).y, up(B, 22 * z).x, up(B, 22 * z).y, '#5b6470', 1.2 * z); const n = Math.round(Math.hypot(a1 - a0, b1 - b0) / 1.6); for (let k = 0; k <= n; k++) { const q2 = iso(a0 + (a1 - a0) * k / n, b0 + (b1 - b0) * k / n); line(q2.x, q2.y, q2.x, q2.y - 22 * z, '#5b6470', 1 * z); } }); } });
      objs.push({ d: mx + T.y + T.d / 2, f: () => { const A = iso(mx, T.y - 0.2), B = iso(mx, T.y + T.d + 0.2); [A, B].forEach(p => line(p.x, p.y, p.x, p.y - 9 * z, '#d9dee4', 1.4 * z)); poly([up(A, 3 * z), up(B, 3 * z), up(B, 8 * z), up(A, 8 * z)], 'rgba(255,255,255,.35)', null); line(up(A, 8 * z).x, up(A, 8 * z).y, up(B, 8 * z).x, up(B, 8 * z).y, '#ffffff', 1.2 * z); for (let k = 1; k < 8; k++) { const q2 = iso(mx, T.y - 0.2 + (T.d + 0.4) * k / 8); line(q2.x, q2.y - 3 * z, q2.x, q2.y - 8 * z, 'rgba(255,255,255,.5)', 0.6 * z); } } });
      const per = 1.5, u = (t % (per * 2)) / per, ay = T.y + T.d / 2 + Math.sin(t * 1.3) * T.d * 0.28, by = T.y + T.d / 2 + Math.sin(t * 1.1 + 2) * T.d * 0.28;
      who(T.x + 0.8, ay, TENNIS_P[0], { face: 1, pose: 'stand', moving: Math.abs(Math.cos(t * 1.3)) > 0.3, phase: t * 9, wave: u > 1.85 || u < 0.15 });
      who(T.x + T.w - 0.8, by, TENNIS_P[1], { face: -1, pose: 'stand', moving: Math.abs(Math.cos(t * 1.1 + 2)) > 0.3, phase: t * 9 + 1, wave: u > 0.85 && u < 1.15 });
      const k2 = u < 1 ? u : u - 1, fx = u < 1 ? T.x + 1.3 : T.x + T.w - 1.3, tx = u < 1 ? T.x + T.w - 1.3 : T.x + 1.3, fy = u < 1 ? ay : by, ty = u < 1 ? by : ay;
      objs.push({ d: fx + (tx - fx) * k2 + fy + (ty - fy) * k2 + 0.4, f: () => ball(fx + (tx - fx) * k2, fy + (ty - fy) * k2, 16 + Math.sin(k2 * Math.PI) * 18, '#d8f25a', 1.6) });
      hitR('tennis', T, 20); }
    // basketball: an orange court, two hoops; one shoots, one guards
    if (PP.bb) { const K = PP.bb, my = K.y + K.d / 2;
      flatRect(K.x - 0.4, K.y - 0.4, K.w + 0.8, K.d + 0.8, '#7d848c'); flatRect(K.x, K.y, K.w, K.d, '#d8823f');
      flatRect(K.x, K.y, K.w, K.d, null, 'rgba(255,255,255,.9)', 0, 1.3 * z); flatRect(K.x + K.w / 2 - 0.03, K.y, 0.06, K.d, 'rgba(255,255,255,.8)');
      [K.x, K.x + K.w - 1.6].forEach(x => flatRect(x, my - 0.9, 1.6, 1.8, 'rgba(180,70,40,.35)', 'rgba(255,255,255,.8)', 0, 1 * z));
      { const pts = []; for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; pts.push(iso(K.x + K.w / 2 + Math.cos(a) * 0.9, my + Math.sin(a) * 0.9)); } poly(pts, null, 'rgba(255,255,255,.8)', 1 * z); }
      const hoop = (x, dir) => objs.push({ d: x + my - 0.5, f: () => { const b = iso(x, my), top = up(b, 34 * z); line(b.x, b.y, top.x, top.y, '#5b6470', 2 * z); const bd = up(iso(x + dir * 0.15, my), 34 * z); rrect(bd.x - 9 * z, bd.y - 7 * z, 18 * z, 12 * z, 1.5 * z, '#ffffff', '#5b6470', 0.8 * z); const rim = up(iso(x + dir * 0.6, my), 30 * z); ellipse(rim.x, rim.y, 6 * z, 2.4 * z, null, '#ff6b2d', 1.4 * z); for (let k = -2; k <= 2; k++) line(rim.x + k * 2.4 * z, rim.y + 1 * z, rim.x + k * 1.6 * z, rim.y + 7 * z, 'rgba(255,255,255,.75)', 0.6 * z); } });
      hoop(K.x + 0.1, 1); hoop(K.x + K.w - 0.1, -1);
      const per = 2.6, u = (t % per) / per, sx = K.x + 2.6 + Math.sin(t * 0.5) * 0.7, sy = my + Math.cos(t * 0.4) * K.d * 0.25;
      who(sx, sy, BALLERS[0], { face: -1, pose: 'stand', moving: u < 0.55, phase: t * 8, wave: u > 0.5 && u < 0.62 });
      who(sx - 1.0, sy + 0.4, BALLERS[1], { face: 1, pose: 'stand', moving: true, phase: t * 7, wave: u > 0.5 && u < 0.62 });
      objs.push({ d: sx + sy + 0.5, f: () => { if (u < 0.55) ball(sx - 0.25, sy + 0.1, 4 + Math.abs(Math.sin(t * 9)) * 9, '#ff8a3d', 1.9); else { const k2 = (u - 0.55) / 0.45, hx = K.x + 0.7; ball(sx + (hx - sx) * k2, sy + (my - sy) * k2, 20 + (30 - 20) * k2 + Math.sin(k2 * Math.PI) * 26, '#ff8a3d', 1.9); } } });
      hitR('basketball', K, 34); }
    // the football pitch: striped grass, white lines, two goals; three a side chasing the ball
    { const F = PP.pitch, mx = F.x + F.w / 2, my = F.y + F.d / 2;
      flatRect(F.x - 0.5, F.y - 0.5, F.w + 1, F.d + 1, '#6fb44e');
      for (let k = 0; k < 8; k++) if (k % 2) flatRect(F.x + k * F.w / 8, F.y, F.w / 8, F.d, 'rgba(255,255,255,.09)');
      flatRect(F.x, F.y, F.w, F.d, null, 'rgba(255,255,255,.9)', 0, 1.4 * z); flatRect(mx - 0.03, F.y, 0.06, F.d, 'rgba(255,255,255,.9)');
      { const pts = []; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; pts.push(iso(mx + Math.cos(a) * 1.4, my + Math.sin(a) * 1.4)); } poly(pts, null, 'rgba(255,255,255,.9)', 1.2 * z); }
      [F.x, F.x + F.w - 2].forEach(x => flatRect(x, my - 1.8, 2, 3.6, null, 'rgba(255,255,255,.9)', 0, 1.1 * z));
      const goal = (x, dir) => objs.push({ d: x + my, f: () => { const a = iso(x, my - 1.1), b = iso(x, my + 1.1), a2 = iso(x - dir * 0.6, my - 1.1), b2 = iso(x - dir * 0.6, my + 1.1); poly([a2, b2, up(b2, 8 * z), up(a2, 8 * z)], 'rgba(255,255,255,.3)', null); poly([up(a, 14 * z), up(b, 14 * z), up(b2, 8 * z), up(a2, 8 * z)], 'rgba(255,255,255,.25)', null); [a, b].forEach(p => line(p.x, p.y, p.x, p.y - 14 * z, '#ffffff', 1.8 * z)); line(up(a, 14 * z).x, up(a, 14 * z).y, up(b, 14 * z).x, up(b, 14 * z).y, '#ffffff', 1.8 * z); } });
      goal(F.x, 1); goal(F.x + F.w, -1);
      const bp = s => [clamp(mx + Math.sin(s * 0.45) * F.w * 0.36 + Math.sin(s * 1.7) * 0.9, F.x + 0.8, F.x + F.w - 0.8), clamp(my + Math.sin(s * 0.7 + 1) * F.d * 0.3 + Math.cos(s * 1.3) * 0.5, F.y + 0.6, F.y + F.d - 0.6)];
      const [bx, by] = bp(t);
      [[0, 0.5, -0.6, 0.6], [1, 1.1, 0.7, -0.8], [3, 0.8, 0.5, 0.9], [4, 1.4, -0.8, -0.5]].forEach(([i, lag, ox, oy]) => { const [px, py] = bp(t - lag), x = clamp(px + ox, F.x + 0.5, F.x + F.w - 0.5), y = clamp(py + oy, F.y + 0.4, F.y + F.d - 0.4); who(x, y, TEAMS[i], { face: bx > x ? 1 : -1, pose: 'run', moving: true, phase: t * 11 + i }, 0.9); });
      who(F.x + 0.6, clamp(by, my - 1, my + 1), TEAMS[2], { face: 1, pose: 'stand', wave: Math.abs(bx - F.x) < 2.5 }, 0.9);
      who(F.x + F.w - 0.6, clamp(by, my - 1, my + 1), TEAMS[5], { face: -1, pose: 'stand', wave: Math.abs(bx - F.x - F.w) < 2.5 }, 0.9);
      objs.push({ d: bx + by + 0.4, f: () => ball(bx, by, 2 + Math.abs(Math.sin(t * 4)) * 3, '#ffffff', 1.8) });
      hitR('soccer', F, 14); }
    // the playground: a soft orange mat, a slide, swings, a trampoline; two kids playing
    { const Y = PP.play, tr = PP.tramp;
      flatRect(Y.x, Y.y, Y.w, Y.d, '#e9875f'); flatRect(Y.x + 0.15, Y.y + 0.15, Y.w - 0.3, Y.d - 0.3, null, 'rgba(255,255,255,.45)', 0, 1 * z);
      [['slide', Y.x + 0.5, Y.y + 0.4], ['swing', Y.x + 2.4, Y.y + 0.5], ['trampoline', tr.x, tr.y]].forEach(([k, x, y]) => objs.push({ d: x + y + 1, f: () => drawYardItem({ k, rot: 0, placed: 0 }, x, y, ts) }));
      const jump = !(TOWN_USE && TOWN_USE.k === 'play');
      if (jump) who(tr.x + 1, tr.y + 1.1, KIDS[0], { pose: 'jacks', face: 1, lift: 6 }, 0.72);
      const a = t * 0.6; who(Y.x + 2.2 + Math.cos(a) * 1.4, Y.y + 2.9 + Math.sin(a) * 0.9, KIDS[1], { face: -Math.sin(a) > 0 ? 1 : -1, pose: 'run', moving: true, phase: t * 12 }, 0.72);
      hitR('play', Y, 20); }
    // the fountain, the ice-cream cart, a bench by the fountain, benches by the pond, picnic tables, flowers and lamps
    objs.push({ d: cx + cy + 1.4, f: () => drawDecor({ kind: 'fountain', x: cx - 1.4, y: cy - 1.4, w: 2.8, d: 2.8 }, ts) });
    { const C = PP.cart; objs.push({ d: C.x + C.y + 1, f: () => {
        const b = box(C.x, C.y, C.w, C.d, 12, '#f7c6d9', 4, { top: '#fbe3ec' }); [0.2, 0.8].forEach(u => { const q2 = wallPt(b.left, 0, u, 3); circle(q2.x, q2.y, 3 * z, '#5b6470'); });
        const tp = up(iso(C.x + C.w / 2, C.y + C.d / 2), 16 * z); line(tp.x, tp.y, tp.x, tp.y - 22 * z, '#9aa3ad', 1.2 * z); const um = up(tp, 22 * z);
        for (let k = 0; k < 6; k++) pg([[um.x, um.y - 4 * z], [um.x + Math.cos(k / 6 * Math.PI * 2) * 16 * z, um.y + Math.sin(k / 6 * Math.PI * 2) * 6 * z + 3 * z], [um.x + Math.cos((k + 1) / 6 * Math.PI * 2) * 16 * z, um.y + Math.sin((k + 1) / 6 * Math.PI * 2) * 6 * z + 3 * z]], k % 2 ? '#ffffff' : '#ec6aa8');
        emoji('🍦', tp.x + 6 * z, tp.y + 2 * z, 11 * z); } });
      who(C.x + 0.7, C.y - 0.35, PLAYER('#ffffff', 3, { bottom: 'jeans', pants: '#4a5a78', hat: 'cap', hatCol: '#ec6aa8' }), { face: 1, view: 'front', turn: [0.4, 1], pose: 'stand', wave: Math.sin(t * 0.8) > 0.9 });
      hitR('cart', C, 30); }
    const items = [['bench', PP.bench.x, PP.bench.y], ...PP.benches.map(([x, y]) => ['bench', x, y]), ...PP.picnic.map(([x, y]) => ['picnic', x, y]), ...PP.flowers.map(([x, y]) => ['flowers', x, y]), ...PP.lamps.map(([x, y]) => ['lamp', x - 0.5, y - 0.5])];
    hitR('bench', PP.bench, 16);
    // trees round the edge, outside the jogging loop
    for (let k = 0; k < 16; k++) items.push([k % 3 ? 'tree' : 'pine', P.x + 1 + (k * 7.3) % (P.w - 2), P.y + (k < 8 ? 0.2 : P.d - 1.2)]);
    for (let k = 0; k < 6; k++) items.push(['tree', P.x + (k % 2 ? P.w - 1.1 : 0.1), P.y + 4 + Math.floor(k / 2) * 9]);
    const underFly = (x, y) => (TL.flyovers || []).some(F => x > F.x0 - 1 && x < F.x1 + 1 && Math.abs(y + 0.5 - F.y) < 2.2);   // v0.27: nothing growing under the flyover
    items.filter(([, x, y]) => !onCarPark(x + 0.5, y + 0.5) && !underFly(x, y)).forEach(([k, x, y]) => objs.push({ d: x + y + 1, f: () => drawYardItem({ k, rot: 0, placed: 0 }, x, y, ts) }));
  }
  // v0.52: at the near end of every street, a sign with its name and zone: a brick gate pillar on the estates, a
  // green street sign elsewhere (the apartments and townhouses get a little board too)
  function streetSigns(objs, vr) {
    const z = cam.z;
    if (z < 0.22) return;
    Object.values(TL.streets).forEach(st => {
      const x = st.x - 0.75, y = st.y + LOT_D - 0.75;
      if (!boxVisible(x - 2, y - 2, x + 2, y + 2, vr)) return;
      const Z = ZONES[st.zone] || ZONES.suburb;
      objs.push({ d: x + y + 0.4, f: () => {
        const p = iso(x, y);
        if (st.zone === 'estate') {
          box(x - 0.35, y - 0.35, 0.7, 0.7, 26, '#a5523c', 0); box(x - 0.45, y - 0.45, 0.9, 0.9, 4, '#d9d0c0', 26);
          const pl = up(iso(x + 0.36, y), 14 * z); rrect(pl.x - 9 * z, pl.y - 5 * z, 18 * z, 10 * z, 2 * z, '#2f5d50', '#e9c46a', 1);
          if (z > 0.4) emoji('🏰', pl.x, pl.y + 4 * z, 7 * z);
        } else {
          line(p.x, p.y, p.x, p.y - 30 * z, '#5b6470', 1.6 * z);
          rrect(p.x - 14 * z, p.y - 36 * z, 28 * z, 8 * z, 1.5 * z, '#2e7d4f', '#ffffff', 0.8 * z);
          if (z > 0.4) emoji(Z.e, p.x, p.y - 26 * z, 8 * z);
        }
        if (z > 0.38) label(`${Z.e} ${nm(st)} · ${nm(Z)}`, p.x, p.y - 46 * z, 'rgba(255,253,248,.92)', '#3b3125', `800 ${Math.max(9, 10.5 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 18 * z), 0);
      } });
    });
  }
  // v0.32: do something in the park: walk there along the paths, then watch / feed / sit / bounce for `secs`, then done()
  function parkUseNow(k, secs, done) {
    const PP = parkPlan(), S0 = PP.spots[k];
    if (!S0 || mode !== 'town') { if (done) done(); return false; }
    stopTripHere(); TOWN_USE = null;
    const from = mePos(), to = S0.stand, path = inParkPt(from) ? parkRoute(from, to) : [...footRoute(from, to), to];   // v0.34: round the fountain and the courts
    trip = { kind: 'park', town: VIEW_TOWN, legs: [{ how: 'walk', from, path }], li: 0, how: 'walk', inCar: false, car: null, x: from[0], y: from[1], path: path.slice(), dest: null, place: 'park', face: 1, phase: 0, moving: true, dir: '+y', arrived: false, t: now(),
      done: () => { TOWN_USE = { k, ...S0.use, at: S0.use.at || to, secs, until: performance.now() + secs * 1000, done }; } };
    return true;
  }
  // v0.50: do something right where you are in town (fish off the jetty, help with the wheat, bake, read): a pose, the bar
  function townDoNow(secs, e, done, pose, prop) {
    if (mode !== 'town' || !outHere()) { if (done) done(); return false; }
    stopTripHere(); TOWN_USE = null;
    const at = mePos();
    TOWN_USE = { k: 'do', pose: pose || 'stand', view: pose === 'fish' ? 'back' : null, turn: [0.3, 1], at, secs, until: performance.now() + secs * 1000, done, e, prop: prop || null };
    return true;
  }
  // you, doing it: the pose, what you're holding, a bar for how long is left
  function drawTownUse(ts) {
    const U = TOWN_USE, z = cam.z, p = iso(U.at[0], U.at[1]), cheer = U.cheer && Math.sin(ts / 260) > 0.3;
    drawPerson(p.x, p.y - (U.lift || 0) * z, z, { look: S.me.look, face: U.face || 1, view: U.view || null, turn: U.turn, energy: energyLevel(), ts, seed: 3, pose: U.pose, seatH: U.seatH, wave: cheer });
    if (U.prop) emoji(U.prop, p.x + 11 * z, p.y - (U.pose === 'crouch' ? 10 : 20) * z - (U.lift || 0) * z, 10 * z);
    if (U.cheer && cheer) emoji('📣', p.x - 12 * z, p.y - 46 * z, 11 * z);
    if (U.k === 'pond') for (let k = 0; k < 4; k++) { const u = ((ts / 700 + k / 4) % 1), q2 = iso(U.at[0] + 0.3 + u * 0.4 - k * 0.2, U.at[1] - 0.4 - u * 0.9); circle(q2.x, q2.y - (1 - u) * 10 * z, 1.1 * z, '#e9c46a'); }
    doBar(p.x, p.y - (52 + (U.lift || 0)) * z - 12 - 7.5 * clamp(z, 0.7, 1.25), 1 - Math.max(0, U.until - performance.now()) / 1000 / U.secs, U.e || U.prop || '⏳', z);   // v0.50: just over your name
    nameTag(p, S.me.name || '🙂', true);
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
    { const Wb = worldOf(); flatRect(Wb.x0, Wb.y0, Wb.x1 - Wb.x0, Wb.y1 - Wb.y0, PAL.town); }
    Object.values(TL.streets).forEach(st => { if (boxVisible(st.x - 1, st.y - 1, st.x + st.n * PARCEL + 1, st.y + LOT_D + 1, vr)) flatRect(st.x - 0.6, st.y - 0.6, st.n * PARCEL + 1.2, LOT_D + 0.6, themed ? shade(PAL.town, st.nb === 'lake' ? -0.04 : st.nb === 'farm' ? 0.04 : 0) : NEIGHBORHOODS[st.nb].grass); });
    const objs = [], tops = [], out = { hall: null, shops: mode === 'town' ? [] : null }, lv = townLevel(rankTotal());
    streetSigns(objs, vr);   // v0.52
    river(vr);
    mountains(objs, vr);
    lakeSide(objs, vr, ts);
    park(objs, vr, ts);
    farmland(objs, vr, ts);
    drawRoads(vr);
    bridges(vr);
    curvyRoads(vr);
    freewayGround(vr);   // v0.39
    if (z > 0.06) highwayObjs(objs, vr, ts);
    freewayObjs(objs, vr, ts);   // v0.39
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
    if (z > 0.045 && mode === 'town') fwTraffic(objs, dt, ts);   // v0.39
    if (mode === 'town') signalObjs(objs, vr);   // v0.22
    if (mode === 'town') roadSignObjs(objs, vr);   // v0.39
    if (mode === 'town') liveTownObjs(objs, dt, ts);
    if (mode === 'town' && cam.z > 0.2 && VIEW_TOWN === myTown()) parkPeople(objs, ts);   // v0.25
    if (trip && !trip.arrived && mode === 'town' && !S.work && !S.live && !jailed()) objs.push({ d: trip.inCar ? carDepth(trip) : trip.x + trip.y + 0.6, f: () => drawTrip(ts) });
    else if (mode === 'town' && outHere() && !S.work && !S.live && !jailed()) { const [mx, my] = TOWN_USE ? TOWN_USE.at : S.out.pt; objs.push({ d: mx + my + 0.6, f: () => (TOWN_USE ? drawTownUse(ts) : drawMeOut(mx, my, ts)) }); }
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
      if (z < 0.17) TL.labels.forEach(([key, x, y]) => { const c = iso(x, y); label(key === 'area_maple' && VIEW_TOWN !== HOME_TOWN ? nm(COMMUNITIES[VIEW_TOWN]) : t(key), c.x, c.y, 'rgba(59,49,37,.78)', '#fff', `800 ${fs + 1}px ${CUTE_FONT},${EMOJI_FONT}`, fs + 10, 0.5); });
      // zoomed all the way out: the neighbouring villages, and a way on to the world map
      if (z < 0.1) {
        [[WX1 + 40, (WY0 + WY1) / 2 - 20, 'out_east'], [(WX0 + WX1) / 2 + 30, WY1 + 40, 'out_south'], [WX0 - 34, WY1 + 34, 'out_west']].filter(([x, y]) => !inLake(x, y)).forEach(([x, y, key]) => { const c = iso(x, y); label(t(key), c.x, c.y, 'rgba(255,255,255,.82)', '#5d5448', `700 ${small}px ${UI_FONT},${EMOJI_FONT}`, small + 8, 0.4); });
        if (z <= minWorldZoom() * 1.02) hits.push({ kind: 'worldMap', pri: 2, ...pill(t('pinch_world'), W / 2, H - 70, 'rgba(59,49,37,.86)', '#fff', `800 13px ${UI_FONT},${EMOJI_FONT}`, 30) });
      }
      tops.forEach(tp => {
        if (tp.land) { if (z > 0.11 && tp.land.n >= CORE_PARCELS) hitLabel({ kind: 'land', st: tp.land.st, p: tp.land.p, n: tp.land.n, pri: 1 }, 1, `🏷️ ${t('land_lot', { n: tp.land.n * PARCEL })}`, tp.x, tp.y, 'rgba(255,246,226,.95)', '#a9773f', `700 ${small}px ${UI_FONT},${EMOJI_FONT}`, small + 8); return; }
        const top = tp.opt.houseTop;
        if (!top) return;
        if (tp.npc) { if (z > 0.11) hitLabel({ kind: 'lot', owner: tp.h.id, pri: 1 }, 1.5, homeName(tp.h), top.x, top.y - 4, 'rgba(255,255,255,.78)', '#6b5f50', `600 ${small}px ${UI_FONT}`, small + 8); return; }
        if (z < 0.08 && tp.h.id !== 'me') return;
        const i = rk.findIndex(r => r.h.id === tp.h.id), medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`, mine = tp.h.id === 'me';
        const label = S.calm ? homeName(tp.h) : `${medal} ${homeName(tp.h)} · ${fmtCompact(rk[i].v)}`;   // calm mode: names only
        hitLabel({ kind: 'lot', owner: tp.h.id, pri: 1 }, mine ? 5 : 3, label, top.x, top.y - 4, mine ? '#3b3125' : 'rgba(255,255,255,.95)', mine ? '#fff' : '#3b3125', `700 ${small}px ${UI_FONT},${EMOJI_FONT}`, small + 9);
      });
      if (out.hall) { const { x: px, y: py } = TL.plaza; hitLabel({ kind: 'plaza', pri: 1 }, 4, VIEW_TOWN === HOME_TOWN ? `🏛️ ${t('street_name')} Lv${lv}` : `🏛️ ${nm(COMMUNITIES[VIEW_TOWN])}`, iso(px + 7, py + 3).x, out.hall.top - 6, '#ef7d3c', '#fff', `800 13px ${CUTE_FONT},${EMOJI_FONT}`, 23); }
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
      const tag = (kind, text, wx, wy) => { const c = iso(ox + wx, oy + wy); hitLabel({ kind, pri: 1 }, 2, text, c.x, c.y + 4, 'rgba(255,255,255,.92)', '#7a5a2a', `600 11px ${UI_FONT},${EMOJI_FONT}`, 20); };
      if (fine()) {
        if (h.plots) { const nx = nextPlotSpot(h); if (nx) tag('buyLand', `🔓 ${t('expand_plot', { n: fmtNum(plotCost(h.fields.length)) })}`, nx[0] + 0.5, nx[1] + 0.5); }   // v0.46
        else if (h.fieldLv < FIELD_LEVELS.length - 1) tag('buyLand', `🔓 ${t('expand_field')}`, areaOf(h, 'fields').x + 2, areaOf(h, 'fields').y + h.fields.length / 4 + 0.5);
        if (!h.pastureLv) tag('buyLand', `🐄 ${t('build_pasture')}`, areaOf(h, 'pasture').x + 2, areaOf(h, 'pasture').y + 4);
        if (!h.orchardLv) tag('buyLand', `🌳 ${t('build_orchard')}`, areaOf(h, 'orchard').x + 3, areaOf(h, 'orchard').y + 1.5);
        if (!h.pondLv) tag('buyLand', `🐟 ${t('build_pond')}`, areaOf(h, 'pond').x + 2, areaOf(h, 'pond').y + 1.5);
        if (canExpand()) { const c = iso(ox + homeW(h) + PARCEL / 2, oy + LOT_D / 2); hitLabel({ kind: 'buyParcel', pri: 2 }, 2.5, `🏷️ ${t('buy_parcel')} · 🪙${fmtNum(parcelCost().coins)}`, c.x, c.y - 40 * z, '#fff6e2', '#b5641e', `800 12px ${UI_FONT},${EMOJI_FONT}`, 24); }
      }
      if (S.pending.length && tp.opt.houseTop) hitLabel({ kind: 'pending', pri: 3 }, 4, `📦 ${S.pending.length}`, tp.opt.houseTop.x, tp.opt.houseTop.y - 6 - bob, '#ef7d3c', '#fff', `bold 14px ${UI_FONT},${EMOJI_FONT}`, 22);
    } else {
      if (isFriend(h.id)) h.fields.forEach((fl, i) => {
        if (!stealable(h, i)) return;
        const [x, y] = fieldPos(i, h), c = iso(ox + x + 0.5, oy + y + 0.5);
        hits.push({ kind: 'bubble', what: 'field', owner, i, pri: 2, ...bubble('🖐️', c.x, c.y - 18 * z, 0.9, bob) });
      });
      if (tp.opt.houseTop) label(t('home_of', { name: homeName(h) }), tp.opt.houseTop.x, tp.opt.houseTop.y - 6, 'rgba(255,255,255,.94)', '#3b3125', `600 12px ${UI_FONT}`, 22, 4);
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
    TL.roads.forEach(([x0, y0, x1, y1, kind, ow = 0]) => { const sw = SIDEWALK[kind] || 0.6; if (x1 - x0 >= y1 - y0) H.push({ y: (y0 + y1) / 2, a: x0, b: x1, y0, y1, sw, ow, kind }); else V.push({ x: (x0 + x1) / 2, a: y0, b: y1, x0, x1, sw, ow, kind }); });
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
  // v0.32: into or out of the park by the entrance on a road (where its paths meet the edge), then along the paths
  function parkVia(p) {
    const P = TL.park;
    if (typeof parkPlan !== 'function' || !P || p[0] < P.x + 0.5 || p[0] > P.x + P.w - 0.5 || p[1] < P.y + 0.5 || p[1] > P.y + P.d - 0.5) return null;
    const PP = parkPlan(), F = footNet(), gaps = [[PP.cx, P.y - 0.2, 'v'], [PP.cx, P.y + P.d + 0.2, 'v'], [P.x - 0.2, PP.cy, 'h'], [P.x + P.w + 0.2, PP.cy, 'h']];
    const near = q => Math.min(...F.lines.map(L => { const v = clamp(L.h ? q[0] : q[1], L.a, L.b); return L.h ? Math.hypot(v - q[0], L.c - q[1]) : Math.hypot(L.c - q[0], v - q[1]); }));
    const E = gaps.sort((g1, g2) => near(g1) - near(g2))[0];
    const inside = E[2] === 'v' ? [E[0], E[1] < PP.cy ? P.y + 0.6 : P.y + P.d - 0.6] : [E[0] < PP.cx ? P.x + 0.6 : P.x + P.w - 0.6, E[1]];
    return [[E[0], E[1]], ...parkRoute(inside, p)];   // v0.34: in by the path, then round things to where you're going
  }
  function footRoute(a, b) {
    const ia = parkVia(a), ib = parkVia(b);
    if (ia && ib) return parkRoute(a, b);   // v0.34: across the park, round the fountain and the courts
    if (ib) { const r = footRouteRaw(a, ib[0]); return [...r, ...ib.slice(1)]; }
    if (ia) { const r = footRouteRaw(ia[0], b); return [...ia.slice(0, -1).reverse(), ...r]; }
    return footRouteRaw(a, b);
  }
  // v0.47: the buildings in town, so a walk never cuts through one (Mason #28: "walking behind a building, then
  // straight through it to the door")
  let BLDS = null;
  function bldRects() {
    if (BLDS && BLDS.id === TL.id) return BLDS.list;
    const list = [...TL.shops.map(([, x, y, w = 6, d = 5.5]) => [x, y, x + w, y + d]), ...(TL.stores || []).map(st => { const [x, y, w, d] = storeGeo(st).b; return [x, y, x + w, y + d]; })];
    if (TL.plaza) list.push([TL.plaza.x + 0.5, TL.plaza.y + 0.5, TL.plaza.x + LOT_W - 0.5, TL.plaza.y + LOT_D - 2]);
    BLDS = { id: TL.id, list: list.map(([x0, y0, x1, y1]) => [x0 + 0.12, y0 + 0.12, x1 - 0.12, y1 - 0.12]) };
    return BLDS.list;
  }
  // does the straight way from p to q go through a building?
  function throughBld(p, q) {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(L / 0.25)), B = bldRects();
    for (let k = 1; k < n; k++) { const x = p[0] + (q[0] - p[0]) * k / n, y = p[1] + (q[1] - p[1]) * k / n; if (B.some(r => x > r[0] && x < r[2] && y > r[1] && y < r[3])) return true; }
    return false;
  }
  // v0.47: a short way round the buildings from p to q (half-tile cells, eight ways, pulled straight); [] if it's clear
  function aroundBld(p, q) {
    if (!throughBld(p, q)) return [];
    const GS = 0.5, x0 = Math.min(p[0], q[0]) - 8, y0 = Math.min(p[1], q[1]) - 8, gw = Math.ceil((Math.max(p[0], q[0]) + 8 - x0) / GS), gd = Math.ceil((Math.max(p[1], q[1]) + 8 - y0) / GS), B = bldRects();
    const free = (i, j) => { if (i < 0 || j < 0 || i >= gw || j >= gd) return false; const x = x0 + (i + 0.5) * GS, y = y0 + (j + 0.5) * GS; return !B.some(r => x > r[0] - 0.25 && x < r[2] + 0.25 && y > r[1] - 0.25 && y < r[3] + 0.25); };
    const cell = pt => [clamp(Math.floor((pt[0] - x0) / GS), 0, gw - 1), clamp(Math.floor((pt[1] - y0) / GS), 0, gd - 1)], [si, sj] = cell(p), [ti, tj] = cell(q);
    const cost = new Float32Array(gw * gd).fill(1e9), prev = new Int32Array(gw * gd).fill(-1), open = [[0, sj * gw + si]];
    cost[sj * gw + si] = 0;
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, c] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      const i = c % gw, j = (c - i) / gw;
      if (i === ti && j === tj) break;
      for (const [di, dj, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
        const ni = i + di, nj = j + dj; if (!free(ni, nj) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;
        const nc = nj * gw + ni, nv = cost[c] + w; if (nv < cost[nc]) { cost[nc] = nv; prev[nc] = c; open.push([nv + Math.hypot(ni - ti, nj - tj), nc]); }
      }
    }
    if (prev[tj * gw + ti] < 0) return [];
    const pts = []; for (let c = prev[tj * gw + ti]; c >= 0 && c !== sj * gw + si; c = prev[c]) pts.unshift([x0 + (c % gw + 0.5) * GS, y0 + (Math.floor(c / gw) + 0.5) * GS]);
    const out = []; let cur = p, k = 0; const all = [...pts, q];
    while (k < all.length - 1) { let far = k; for (let m = all.length - 1; m > k; m--) if (!throughBld(cur, all[m])) { far = m; break; } if (far === all.length - 1) break; cur = all[far]; out.push(cur); k = far + 1; }
    return out;
  }
  function footRouteRaw(a, b) {
    const F = footNet(), ns = F.nodes, n = ns.length;
    const snap = p => {
      let best = null;
      F.lines.forEach(L => {
        let v = clamp(L.h ? p[0] : p[1], L.a, L.b);
        const c = L.cuts.find(([x, y]) => v > Math.min(x, y) && v < Math.max(x, y));
        if (c) v = Math.abs(v - c[0]) < Math.abs(v - c[1]) ? c[0] : c[1];   // not in the middle of a junction
        const q = L.h ? [v, L.c] : [L.c, v], d = Math.hypot(q[0] - p[0], q[1] - p[1]) + (throughBld(p, q) ? 100 : 0);   // v0.47: not through a building
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
    const out = [...aroundBld(a, A.q), A.q, ...chain, B.q, ...aroundBld(B.q, b), b];   // v0.47: round a building at either end
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
      const folk = townsfolk(VIEW_TOWN).filter(p => !WALK.list.some(w => w.id === p.id));
      if (folk.length && (Math.random() < 0.55 || !ids.length)) {   // v0.40: one of the townsfolk
        const p = folk[Math.floor(Math.random() * folk.length)], ends = [...TL.places, ...(TL.stores || []).map(st => storeGeo(st).door)].filter(Boolean);
        const a = ends[Math.floor(Math.random() * ends.length)], b = ends[Math.floor(Math.random() * ends.length)];
        if (a && b && a !== b) { const bike = p.look.mob !== 'wheel' && Math.random() < 0.2, path = bike ? route(a, b, false) : route(a, b); WALK.list.push({ id: p.id, who: p, x: a[0], y: a[1], path, home: null, phase: 0, face: 1, moving: true, stay: 0, back: false, alpha: 0, bike, bikeCol: COLORS[Math.floor(Math.random() * COLORS.length)], ends }); }
      } else if (ids.length) {
        const id = ids[Math.floor(Math.random() * ids.length)], g = gateOf(id);
        const others = allLots().filter(l => l.id !== id && homeOf(l.id)), dest = Math.random() < 0.3 && others.length ? gateOf(others[Math.floor(Math.random() * others.length)].id) : TL.places[Math.floor(Math.random() * TL.places.length)];
        const hm = homeOf(id), bike = !(hm && hm.look && hm.look.mob === 'wheel') && Math.random() < 0.3;   // v0.25: some people ride their bikes (on the road) (v0.49: not in a wheelchair)
        WALK.list.push({ id, h: homeOf(id), x: g[0], y: g[1] - 1.2, path: [[g[0], g[1]], ...(bike ? route(g, dest, false) : route(g, dest))], home: g, phase: 0, face: 1, moving: true, stay: 0, back: false, alpha: 0, bike, bikeCol: COLORS[Math.floor(Math.random() * COLORS.length)] });
      }
    }
    WALK.list = WALK.list.filter(w => {
      if (w.fade) { w.alpha -= dt * 1.5; if (w.alpha <= 0) return false; }
      else if (w.stay > 0) { w.stay -= dt; w.moving = false; if (w.stay <= 0) { if (w.who) { const b = w.ends[Math.floor(Math.random() * w.ends.length)]; w.path = route([w.x, w.y], b, !w.bike); } else w.path = route([w.x, w.y], w.home, !w.bike).concat([[w.home[0], w.home[1] - 1.2]]); w.going = true; } }
      else if (w.path.length) {
        const [tx, ty] = w.path[0], dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy), wh = !w.bike && ((w.h || w.who || {}).look || {}).mob === 'wheel', st = (w.bike ? 4.2 : wh ? 1.35 : 1.6) * dt;
        // v0.49: on foot (or wheels) you keep a little to your right, so people coming the other way pass by, not through you
        if (!w.bike && d > 0.01) { const sd = (w.sideK || (w.sideK = 0.16 + (hash(w.x * 3.1, w.y) * 0.08))), tx2 = -dy / d * sd, ty2 = dx / d * sd, k2 = Math.min(1, dt * 4); w.kx = (w.kx || 0) + (tx2 - (w.kx || 0)) * k2; w.ky = (w.ky || 0) + (ty2 - (w.ky || 0)) * k2; }
        if (w.bike && mustStop(w)) { w.moving = false; } else if (d <= st) { w.x = tx; w.y = ty; w.path.shift(); } else { w.x += dx / d * st; w.y += dy / d * st; }
        faceTo(w, dx, dy); if (d > 0.01) w.cdir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '+x' : '-x') : (dy > 0 ? '+y' : '-y'); w.phase += dt * (w.bike ? 8 : 9.5); w.moving = true;
        if (!w.path.length) { if (w.going) { if (!w.who) return false; w.fade = true; } else w.stay = 6 + Math.random() * 10; }
      }
      if (!w.fade) w.alpha = Math.min(1, w.alpha + dt * 2);
      objs.push({ d: w.x + w.y, f: () => {
        // v0.49: a bike rides at the right-hand edge of the road, easing over at corners (it used to jump sideways)
        const riding = w.bike && w.path.length, ot = riding ? { '+x': [0, 0.85], '-x': [0, -0.85], '+y': [-0.85, 0], '-y': [0.85, 0] }[w.cdir || '+x'] : [w.kx || 0, w.ky || 0];
        if (riding) { const k3 = w.box === undefined ? 1 : Math.min(1, dt * 5); w.box = (w.box || 0) + (ot[0] - (w.box || 0)) * k3; w.boy = (w.boy || 0) + (ot[1] - (w.boy || 0)) * k3; }
        const o = riding ? [w.box, w.boy] : ot, p = iso(w.x + o[0], w.y + o[1]);
        ctx.save(); ctx.globalAlpha = w.alpha;
        const look = (w.h || w.who).look;
        if (riding) { const v = DIRV[w.cdir || '+x'], F2 = faceAlong(v[0], v[1]); drawPerson(p.x, p.y, z, { look, face: F2.face, back: F2.back, tilt: F2.back ? -0.5 : 0.5, energy: 'good', ts, seed: w.x, pose: 'bike', phase: w.phase, bikeCol: w.bikeCol }); }   // v0.25: on a bike (v0.49: facing the way it goes, from behind going away)
        else drawPerson(p.x, p.y, z, { look, face: w.face, back: w.back && w.moving, view: w.view, turn: w.turn, moving: w.moving, phase: w.phase, energy: 'good', ts, seed: w.x, wave: chatWave(w.id) || (!w.moving && !chatting(w.id) && Math.sin(ts / 900 + w.x) > 0.7) });
        ctx.restore();
        if (chatting(w.id)) chatBubble(p.x + 12 * z, p.y - 58 * z, z, false, ts);   // v0.25: talking with you
        if (w.who) { if (z > 0.3) label(nm(w.who.name), p.x, p.y - 50 * z, 'rgba(255,255,255,.85)', '#5a4a3a', `700 ${Math.max(9, 10 * z)}px ${UI_FONT}`, Math.max(15, 17 * z), 2); }   // v0.40: a townsperson
        else if (z > 0.3) label(`● ${homeName(w.h)}`, p.x, p.y - 50 * z, 'rgba(255,255,255,.9)', '#2f7d47', `700 ${Math.max(9, 10 * z)}px ${UI_FONT}`, Math.max(15, 17 * z), 2);
        else if (z > 0.12) circle(p.x, p.y - 48 * z, Math.max(2, 3.5 * z), '#34c759', '#fff', 1);
        if (z > 0.2) hits.push({ kind: 'person', id: w.id, pri: 2, x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 46 * z, y1: p.y + 4 });   // v0.25: talk to them
      } });
      return true;
    });
  }
  // v0.25: people in the park: on the benches and on the lawn, chatting; your boss or a coworker now and then
  let PARK_PEOPLE = [], CHAT = null;   // who's in the park now; who you're talking to (and until when)
  const chatting = id => CHAT && CHAT.until > performance.now() && (id === undefined || CHAT.id === id);
  // v0.31: a speech bubble over someone you're talking with: you say your bit (the thing you're doing), then they react
  // (😄 when it went well, 😒 when it didn't). Before v0.31 (and after walking up to someone) it just alternates.
  function chatBubble(x, y, z, mine, ts) {
    if (!CHAT) return;
    if (CHAT.lines) return talkBubble(x, y, z, mine);   // v0.51: what you're saying to each other
    const el = performance.now() - (CHAT.t0 || 0);
    let e;
    if (!CHAT.e) e = mine ? (Math.floor(ts / 700) % 2 ? '💬' : '😊') : (Math.floor(ts / 700) % 2 ? '😄' : '💬');
    else if (mine) e = el < 1700 ? CHAT.e : null;
    else e = el > 1300 ? CHAT.react : el > 500 ? '…' : null;
    if (!e) return;
    const s = Math.max(0.6, z), w = 30 * s, h = 24 * s, bx = x, by = y - h / 2, pop = Math.min(1, (CHAT.e ? (mine ? el : el - (e === '…' ? 500 : 1300)) : 300) / 180);
    ctx.save(); ctx.translate(bx, by); ctx.scale(pop, pop);
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 9 * s); ctx.moveTo(-5 * s, h / 2 - 1); ctx.lineTo(mine ? -8 * s : 8 * s, h / 2 + 7 * s); ctx.lineTo(4 * s, h / 2 - 1); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 4 * s; ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(60,45,35,.25)'; ctx.lineWidth = 1; ctx.stroke();
    if (e === '…') { ctx.fillStyle = '#8a8478'; ctx.font = `800 ${14 * s}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('…', 0, -2 * s); }
    else emoji(e, 0, 8 * s, 15 * s);
    ctx.restore();
  }
  const chatWave = id => chatting(id) && !!CHAT.e && !!CHAT.wave;
  // v0.51 (Mason #29: "see the two of them talking, not a list"): a conversation, line by line, each in a speech bubble
  // over whoever's saying it; the other one shows "…" just before their turn. Returns how long it takes (seconds).
  function makeTalk(id, lines, wave) {
    const L = curLang() === 'en' ? 'en' : 'zh';
    let t0 = 0;
    const ls = lines.map(l => { const d = clamp(TALK.base + [...l.text].length * TALK.perChar[L], TALK.min, TALK.max), o = { ...l, a: t0, b: t0 + d }; t0 += d + TALK.gap; return o; });
    CHAT = { id, t0: performance.now(), until: performance.now() + t0 * 1000 + 300, lines: ls, e: '💬', react: null, wave };
    return t0;
  }
  function talkBubble(x, y, z, mine) {
    y -= 12 * Math.max(0.6, z);   // over the name tag
    const el = (performance.now() - CHAT.t0) / 1000, cur = CHAT.lines.find(l => el >= l.a && el < l.b), nowT = performance.now();
    if (mine) CHAT.meAt = nowT;
    else if (cur && cur.me && !(nowT - (CHAT.meAt || 0) < 250)) return speech(x - 46 * z, y + 4 * z, cur.text, true, Math.min(1, (el - cur.a) / 0.18));   // you're not on screen (visiting them): your words beside them
    if (cur && cur.me === mine) {
      if (!cur.said) { cur.said = true; if (!mine) Sound.play('pop'); }
      return speech(x, y, cur.text, mine, Math.min(1, (el - cur.a) / 0.18));
    }
    const next = CHAT.lines.find(l => l.a > el);
    if (next && next.me === mine && next.a - el < 0.6 && (!cur || cur.me !== mine)) speech(x, y, '…', mine, 1);   // about to say something
  }
  // a speech bubble with a tail down to (x, y); wraps to a few lines; drawn last, over everything
  function speech(x, y, text, mine, pop) {
    BARS.push(() => {
      const s = clamp(cam.z, 0.8, 1.15), fs = 12.5 * s, maxW = Math.min(168 * s, W * 0.62);
      ctx.save(); ctx.font = `700 ${fs}px ${UI_FONT},${EMOJI_FONT}`;
      const rows = wrapLine(text, maxW), lh = fs * 1.32, w = Math.max(...rows.map(r => ctx.measureText(r).width)) + 18 * s, h = rows.length * lh + 11 * s;
      const bx = clamp(x - w / 2 + (mine ? -w * 0.22 : w * 0.22), 6, W - 6 - w), by = Math.max(6, y - h - 9 * s), tx = clamp(x, bx + 12 * s, bx + w - 12 * s);
      ctx.translate(x, y); ctx.scale(pop, pop); ctx.translate(-x, -y);
      ctx.beginPath(); ctx.roundRect(bx, by, w, h, 11 * s); ctx.moveTo(tx - 6 * s, by + h - 1); ctx.lineTo(x, Math.max(by + h + 4, y)); ctx.lineTo(tx + 6 * s, by + h - 1); ctx.closePath();
      ctx.fillStyle = mine ? '#e4f1ff' : '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,.2)'; ctx.shadowBlur = 5 * s; ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = mine ? 'rgba(10,132,255,.45)' : 'rgba(60,45,35,.25)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#2b2620'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      rows.forEach((r, i) => ctx.fillText(r, bx + 9 * s, by + 6 * s + i * lh));
      ctx.restore();
    });
  }
  // split a line to fit maxW (by character for Chinese, by word otherwise); at most 4 rows
  function wrapLine(text, maxW) {
    const toks = /[\u3000-\u9fff\uff00-\uffef]/.test(text) ? [...text] : String(text).split(/(\s+)/), out = [];
    let cur = '';
    toks.forEach(tk => { const nx = cur + tk; if (ctx.measureText(nx).width > maxW && cur.trim()) { out.push(cur.trim()); cur = tk.trimStart(); } else cur = nx; });
    if (cur.trim()) out.push(cur.trim());
    return out.slice(0, 4);
  }
  // who's in the park right now (worked out from the time, so it's the same whether you're looking or not)
  function parkList() {
    if (VIEW_TOWN !== myTown() || !TL.park) return [];
    const P = TL.park, dayN = Math.floor(now() / DAY), list = [];
    const ids = [...allLots().map(l => l.id).filter(id => id !== 'me' && homeOf(id)), ...townsfolk(VIEW_TOWN).map(p => p.id)];   // v0.40: + townsfolk
    const PP = parkPlan(), b0 = PP.benches[0], pc = PP.picnic[0] || [PP.play.x + 1, PP.play.y + 6], T = PP.ten;   // v0.32
    [[b0[0] + 0.4, b0[1] + 1.4], [b0[0] + 1.3, b0[1] + 1.3], [pc[0] - 0.5, pc[1] + 0.6], [T.x + 2.2, T.y + T.d + 0.9]].forEach(([x, y], i) => { const id = ids[(dayN * 3 + i * 7) % Math.max(1, ids.length)]; if (id) list.push({ id, look: whoIs(id).look, x, y, i }); });
    if (S.meet && S.meet.until > now()) { const who = whoIs(S.meet.id); if (who) list.push({ id: S.meet.id, look: who.look, x: PP.cx - 1.6, y: PP.cy + 2.7, i: 11, work: !!who.wp, boss: !!(who.wp && who.wp.boss) }); }   // v0.26: you asked them on the phone
    const wp = S.job ? workPeople(S.job.place) : [];
    if (wp.length && !S.work && (dayN + new Date(now()).getHours()) % 3 === 0) list.push({ id: wp[1].id, look: wp[1].look, x: PP.cx + 3.6, y: PP.cy - 2.4, i: 9, work: true });
    if (wp.length && !S.work && (dayN + new Date(now()).getHours()) % 4 === 1) list.push({ id: wp[0].id, look: wp[0].look, x: PP.cx - 4.6, y: PP.cy + 2.3, i: 10, work: true, boss: true });
    return list;
  }
  function parkPeople(objs, ts) {
    const list = PARK_PEOPLE = parkList();
    list.forEach(pp => objs.push({ d: pp.x + pp.y + 0.3, f: () => {
      const z = cam.z, q = iso(pp.x, pp.y);
      drawPerson(q.x, q.y, z, { look: pp.look, face: pp.i % 2 ? -1 : 1, view: 'front', turn: [pp.i % 2 ? -0.6 : 0.6, 1], energy: 'good', ts, seed: pp.i, pose: 'stand', wave: chatWave(pp.id) || (!chatting(pp.id) && Math.sin(ts / 1100 + pp.i) > 0.85) });
      if (z > 0.35) { if (pp.work) label(pp.boss ? `💼 ${t('boss')}` : `💼 ${t('coworker')}`, q.x, q.y - 50 * z - 12, '#fff1d6', '#9a5b12', `800 ${Math.max(9, 10 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(14, 17 * z), 2); else if (Math.sin(ts / 1500 + pp.i) > 0.6) emoji('💬', q.x + 9 * z, q.y - 44 * z, 10 * z); }
      if (chatting(pp.id)) chatBubble(q.x + 12 * z, q.y - 56 * z, z, false, ts);
      hits.push({ kind: 'person', id: pp.id, work: !!pp.work, pri: 2, x0: q.x - 12 * z, x1: q.x + 12 * z, y0: q.y - 46 * z, y1: q.y + 4 });
    } }));
  }
  // ---------- traffic lights (v0.22): at every crossing on an avenue; cars along x and along y take turns ----------
  // v0.39: what meets at each crossing: the road along x and the road along y there (the bigger one where two meet
  // end to end), and which ways lead out of it (W / E / N / S). A bend (two ways) isn't a crossing.
  const MAJOR = k => k === 'avenue' || k === 'boulevard';
  let JUNCS = null;
  function junctions() {
    if (JUNCS && JUNCS.id === TL.id) return JUNCS;
    const N = roadNet(), list = [], pick = rs => rs.find(r => MAJOR(r.kind)) || rs.find(r => r.kind !== 'dirt') || rs[0];
    N.nodes.forEach((n, i) => {
      const hs = N.H.filter(r => Math.abs(r.y - n.y) < 0.01 && n.x >= r.a - 2.6 && n.x <= r.b + 2.6), vs = N.V.filter(r => Math.abs(r.x - n.x) < 0.01 && n.y >= r.a - 2.6 && n.y <= r.b + 2.6);
      if (!hs.length || !vs.length) return;
      const h = pick(hs), v = pick(vs), hw = Math.max(...hs.map(r => (r.y1 - r.y0) / 2)), vw = Math.max(...vs.map(r => (r.x1 - r.x0) / 2));
      const legs = { W: hs.some(r => r.a < n.x - vw - 0.5), E: hs.some(r => r.b > n.x + vw + 0.5), N: vs.some(r => r.a < n.y - hw - 0.5), S: vs.some(r => r.b > n.y + hw + 0.5) };
      const k = Object.values(legs).filter(Boolean).length, key = Math.round(n.x * 10) + ',' + Math.round(n.y * 10);
      if (k >= 3 && !list.some(J => J.key === key)) list.push({ x: n.x, y: n.y, h, v, hw, vw, legs, k, i, key });
    });
    JUNCS = { id: TL.id, list };
    return JUNCS;
  }
  let SIGNALS = null;
  function signals() {
    if (SIGNALS && SIGNALS.id === TL.id) return SIGNALS;
    const list = [];
    // lights where two big roads meet, and where a street crosses right over one (v0.39: the boulevard too)
    const street = k => k === 'street' || k === 'frontage';
    junctions().list.forEach(J => { const mh = MAJOR(J.h.kind), mv = MAJOR(J.v.kind); if ((mh && mv) || (mh && street(J.v.kind) && J.k === 4) || (mv && street(J.h.kind) && J.k === 4)) list.push({ x: J.x, y: J.y, hw: J.hw, vw: J.vw, off: (J.i * 2.3) % 4 }); });
    SIGNALS = { id: TL.id, list, at: new Map(list.map(s2 => [Math.round(s2.x * 10) + ',' + Math.round(s2.y * 10), s2])) };
    return SIGNALS;
  }
  // v0.47: what a light shows ('g' / 'y' / 'r') for traffic along x or y turning `turn` ('s' straight on, 'r' right,
  // 'l' left, 'u' a U-turn), now. Half the cycle each road: straight + right, amber, the left arrow, amber (SIG).
  const sigHalf = () => SIG.go + SIG.amber + SIG.arrow + SIG.arrowAmber;
  function lightFor(sg, axis, turn = 's') {
    const H = sigHalf(), t0 = (performance.now() / 1000 + sg.off * 1.5) % (2 * H);
    if ((t0 < H ? 'x' : 'y') !== axis) return 'r';
    const t = t0 % H, a0 = SIG.go + SIG.amber;
    if (turn === 'l' || turn === 'u') return t < a0 + (turn === 'u' ? SIG.uWait : 0) ? 'r' : t < a0 + SIG.arrow ? 'g' : 'y';
    if (t < (turn === 'r' ? SIG.rightWait : 0)) return 'r';
    return t < SIG.go ? 'g' : t < a0 ? 'y' : 'r';
  }
  const lightAt = (sg, axis) => lightFor(sg, axis, 's');
  // which way a car turns at the crossing it's coming to (path[0]), going on to path[1]
  function turnAt(c) {
    const p0 = c.path && c.path[0], p1 = c.path && c.path[1];
    if (!p0 || !p1) return 's';
    const ix = p0[0] - c.x, iy = p0[1] - c.y, ox = p1[0] - p0[0], oy = p1[1] - p0[1];
    if (Math.hypot(ox, oy) < 0.05) return 's';
    const a = Math.abs(ix) > Math.abs(iy) ? [Math.sign(ix), 0] : [0, Math.sign(iy)], b = Math.abs(ox) > Math.abs(oy) ? [Math.sign(ox), 0] : [0, Math.sign(oy)];
    if (a[0] === b[0] && a[1] === b[1]) return 's';
    if (a[0] === -b[0] && a[1] === -b[1]) return 'u';
    return a[0] * b[1] - a[1] * b[0] > 0 ? 'r' : 'l';   // (+x turning to +y is a right turn here)
  }
  // a car about to drive into a crossing when its light (for the way it's turning) isn't green waits at the line;
  // a car coming out of a car park waits for its light too
  function mustStop(c) {
    if (!c.path || !c.path.length || (c.h || 0) > 0.5) return false;
    const [tx, ty] = c.path[0], key = Math.round(tx * 10) + ',' + Math.round(ty * 10), sg = signals().at.get(key);
    const d = Math.hypot(tx - c.x, ty - c.y), axis = Math.abs(tx - c.x) > Math.abs(ty - c.y) ? 'x' : 'y';
    if (sg) return d < 3.2 && d > 1.9 && lightFor(sg, axis, turnAt(c)) !== 'g';
    const L = lotSignals().at.get(key);
    if (L && !onRoad(c.x, c.y)) return d < 2.4 && d > 0.7 && lotLight(L, 'out') !== 'g';
    return lotStop(c);
  }
  // v0.47: car parks' ways out. The light stands where the way out meets the road (the point on the road nearest the
  // car park's bay); the road's traffic stops just before it while the cars come out.
  let LOTSIG = null;
  const onRoad = (x, y) => TL.roads.some(r => x >= r[0] - 0.05 && x <= r[2] + 0.05 && y >= r[1] - 0.05 && y <= r[3] + 0.05);
  function lotSignals() {
    if (LOTSIG && LOTSIG.id === TL.id) return LOTSIG;
    const N = roadNet(), list = [], bays = [...(TL.stores || []).map(st => storeGeo(st).bay), ...(TL.parks || []).map(L2 => lotBay(L2).pt)];
    bays.forEach((b, i) => {
      const n = nearestRoad(N, b);
      if (!n || n.r.kind === 'dirt' || Math.hypot(n.pt[0] - b[0], n.pt[1] - b[1]) > 6) return;
      const key = Math.round(n.pt[0] * 10) + ',' + Math.round(n.pt[1] * 10);
      if (list.some(q => q.key === key)) return;
      list.push({ x: n.pt[0], y: n.pt[1], bx: b[0], by: b[1], axis: n.r.y !== undefined ? 'x' : 'y', r: n.r, key, off: (i * 3.7) % 12 });
    });
    LOTSIG = { id: TL.id, list, at: new Map(list.map(q => [q.key, q])) };
    return LOTSIG;
  }
  // 'g' / 'y' / 'r' for the road ('road') or the way out ('out')
  function lotLight(L, who) {
    const T = SIG.lotRoad + SIG.lotAmber + SIG.lotOut + SIG.lotAmber, t = (performance.now() / 1000 + L.off) % T;
    if (who === 'road') return t < SIG.lotRoad ? 'g' : t < SIG.lotRoad + SIG.lotAmber ? 'y' : 'r';
    const t2 = t - SIG.lotRoad - SIG.lotAmber; return t2 < 0 ? 'r' : t2 < SIG.lotOut ? 'g' : t2 < SIG.lotOut + SIG.lotAmber ? 'y' : 'r';
  }
  // a car on the road coming up to a car park's light that isn't green for the road stops just before it
  function lotStop(c) {
    if (!c.dir || (c.h || 0) > 0.5) return false;
    const v = DIRV[c.dir];
    return lotSignals().list.some(L => {
      if ((L.axis === 'x') !== (c.dir === '+x' || c.dir === '-x')) return false;
      const ahead = (L.x - c.x) * v[0] + (L.y - c.y) * v[1], side = Math.abs((L.x - c.x) * v[1] - (L.y - c.y) * v[0]);
      return side < 0.4 && ahead > 0.9 && ahead < 2.2 && lotLight(L, 'road') !== 'g';
    });
  }
  // v0.39: stop signs. Where a smaller road meets an avenue or the boulevard without lights, traffic on the smaller road
  // stops; where two small roads meet, everyone stops (an all-way stop, as in an American suburb). Country roads have none.
  let STOPS = null;
  function stops() {
    if (STOPS && STOPS.id === TL.id) return STOPS;
    const sig = signals().at, list = [];
    junctions().list.forEach(J => {
      if (sig.has(J.key)) return;
      const { h, v } = J, axes = new Set();
      if (h.kind !== 'dirt' && !MAJOR(h.kind) && (J.legs.W || J.legs.E)) axes.add('x');
      if (v.kind !== 'dirt' && !MAJOR(v.kind) && (J.legs.N || J.legs.S)) axes.add('y');
      if (axes.size) list.push({ x: J.x, y: J.y, key: J.key, axes, h, v, hw: J.hw, vw: J.vw, legs: J.legs });
    });
    STOPS = { id: TL.id, list, at: new Map(list.map(s2 => [s2.key, s2])) };
    return STOPS;
  }
  // a car coming up to a stop sign stops at the line for a moment, then goes on
  function stopSign(c, dt) {
    if (!c.path.length || (c.h || 0) > 0.5) return false;
    const [tx, ty] = c.path[0], key = Math.round(tx * 10) + ',' + Math.round(ty * 10), st = stops().at.get(key);
    if (!st || c.stopKey === key) return false;
    const d = Math.hypot(tx - c.x, ty - c.y), axis = Math.abs(tx - c.x) > Math.abs(ty - c.y) ? 'x' : 'y';
    if (!st.axes.has(axis) || d > 3.2 || d < 1.6) return false;
    if ((c.stopT = (c.stopT || 0) + dt) < 0.8) return true;
    c.stopKey = key; c.stopT = 0;
    return false;
  }
  // where the signs stand: a stop sign before each crossing it's for, on the right; a speed limit a little way into
  // each road, for the traffic coming in
  let RSIGNS = null;
  function roadSigns() {
    if (RSIGNS && RSIGNS.id === TL.id) return RSIGNS;
    const list = [];
    stops().list.forEach(S2 => {   // (one-way roads: only for the traffic coming the way it goes)
      const { h, v, hw, vw, legs } = S2;
      if (S2.axes.has('x')) { if (legs.W && !(h.ow < 0)) list.push(['stop', S2.x - vw - 1.05, S2.y + hw - h.sw / 2]); if (legs.E && !(h.ow > 0)) list.push(['stop', S2.x + vw + 1.05, S2.y - hw + h.sw / 2]); }
      if (S2.axes.has('y')) { if (legs.N && !(v.ow < 0)) list.push(['stop', S2.x - vw + v.sw / 2, S2.y - hw - 1.05]); if (legs.S && !(v.ow > 0)) list.push(['stop', S2.x + vw - v.sw / 2, S2.y + hw + 1.05]); }
    });
    TL.roads.forEach(([x0, y0, x1, y1, kind, ow]) => {
      if (!ROAD_KINDS[kind] || kind === 'dirt' || kind === 'lane') return;
      const hz = x1 - x0 >= y1 - y0, len = hz ? x1 - x0 : y1 - y0, sw = SIDEWALK[kind] || 0.4;
      if (len < 16) return;
      if (!ow || ow > 0) list.push(['limit', ...(hz ? [x0 + 3.4, y1 - sw / 2] : [x0 + sw / 2, y0 + 3.4]), kind]);
      if (!ow || ow < 0) list.push(['limit', ...(hz ? [x1 - 3.4, y0 + sw / 2] : [x1 - sw / 2, y1 - 3.4]), kind]);
    });
    RSIGNS = { id: TL.id, list };
    return RSIGNS;
  }
  function stopSignAt(x, y) {
    const z = cam.z, tp = signPost(x, y, z, 30), r = 8.5 * z, pts = [];
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; pts.push({ x: tp.x + Math.cos(a) * r, y: tp.y - 6 * z + Math.sin(a) * r }); }
    poly(pts, '#d6383e', '#ffffff', 1.3 * z);
    if (z > 0.35) { ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${(curLang() === 'zh' ? 8 : 4.8) * z}px ${UI_FONT}`; ctx.fillText(t('sign_stop'), tp.x, tp.y - 6 * z); }
  }
  function roadSignObjs(objs, vr) {
    if (cam.z < 0.22) return;
    roadSigns().list.forEach(([k, x, y, kind]) => {
      if (x < vr.x0 - 1 || x > vr.x1 + 1 || y < vr.y0 - 1 || y > vr.y1 + 1) return;
      objs.push({ d: x + y + 0.3, f: () => (k === 'stop' ? stopSignAt(x, y) : limitSign(x, y, kind)) });
    });
  }
  function signalObjs(objs, vr) {
    if (cam.z < 0.16) return;
    // v0.47: a small light at each car park's way out: one head for the road, one for the cars coming out
    lotSignals().list.forEach(L => {
      const px = L.axis === 'x' ? L.x + 1.1 : L.x + (L.bx > L.x ? 1 : -1) * ((L.r.x1 - L.r.x0) / 2 + 0.2), py = L.axis === 'x' ? L.y + (L.by > L.y ? 1 : -1) * ((L.r.y1 - L.r.y0) / 2 + 0.2) : L.y + 1.1;
      if (px < vr.x0 - 2 || px > vr.x1 + 2 || py < vr.y0 - 2 || py > vr.y1 + 2) return;
      objs.push({ d: px + py + 0.2, f: () => {
        const z = cam.z, b = iso(px, py), top = up(b, 24 * z);
        line(b.x, b.y, top.x, top.y, '#4a4f57', 1.4 * z);
        [['road', -4.5], ['out', 4.5]].forEach(([who, dx]) => {
          const S2 = lotLight(L, who), hx = top.x + dx * z, hy = top.y;
          rrect(hx - 2.2 * z, hy - 1.6 * z, 4.4 * z, 10.6 * z, 1.2 * z, '#2b2e33');
          [['r', '#ff4d4d', 0], ['y', '#ffc83d', 3.4], ['g', '#3ddc6a', 6.8]].forEach(([c2, col, oy]) => circle(hx, hy + 0.5 * z + oy * z, 1.25 * z, S2 === c2 ? col : '#4a4f57'));
          if (NIGHT > 0.3) glow(hx, hy + 4 * z, 8 * z, 0.5);
        });
      } });
    });
    signals().list.forEach(sg => {
      if (sg.x < vr.x0 - 2 || sg.x > vr.x1 + 2 || sg.y < vr.y0 - 2 || sg.y > vr.y1 + 2) return;
      [[-1, -1], [1, 1]].forEach(([sx, sy]) => {
        const px = sg.x + sx * (sg.vw + 0.25), py = sg.y + sy * (sg.hw + 0.25);
        objs.push({ d: px + py + 0.2, f: () => {
          const z = cam.z, b = iso(px, py), top = up(b, 34 * z);
          line(b.x, b.y, top.x, top.y, '#4a4f57', 1.6 * z);
          [['x', -6], ['y', 6]].forEach(([axis, dx]) => {
            const L = lightAt(sg, axis), A = lightFor(sg, axis, 'l'), hx = top.x + dx * z, hy = top.y + 2 * z;
            rrect(hx - 2.6 * z, hy - 2 * z, 5.2 * z, 17.5 * z, 1.4 * z, '#2b2e33');
            [['r', '#ff4d4d', 0], ['y', '#ffc83d', 4], ['g', '#3ddc6a', 8]].forEach(([c2, col, oy]) => circle(hx, hy + 0.6 * z + oy * z, 1.5 * z, L === c2 ? col : '#4a4f57'));
            // v0.47: the left-turn arrow (green while lefts go, amber as it ends)
            const ay = hy + 12.8 * z, acol = A === 'g' ? '#3ddc6a' : A === 'y' ? '#ffc83d' : '#4a4f57';
            poly([{ x: hx - 1.7 * z, y: ay }, { x: hx - 0.2 * z, y: ay - 1.4 * z }, { x: hx - 0.2 * z, y: ay - 0.5 * z }, { x: hx + 1.6 * z, y: ay - 0.5 * z }, { x: hx + 1.6 * z, y: ay + 0.5 * z }, { x: hx - 0.2 * z, y: ay + 0.5 * z }, { x: hx - 0.2 * z, y: ay + 1.4 * z }], acol);
            line(top.x, top.y + 2 * z, hx, hy, '#4a4f57', 1 * z);
            if ((L !== 'r' || A !== 'r') && NIGHT > 0.3) glow(hx, hy + 8 * z, 10 * z, 0.6);
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
  // v0.39: in lanes. Each road has its lanes for each way (lanesOf: how far right of its middle, the right-hand lane
  // last). A car keeps to the right-hand lane, pulls out to pass a slower one where there are two, and moves back in
  // after. Where it is across the road (ox, oy) eases over, so it changes lanes and turns corners smoothly.
  const RIGHT = { '+x': [0, 1], '-x': [0, -1], '+y': [-1, 0], '-y': [1, 0] };
  // v0.47: which way a car points: the way it's really moving (its lane changes and corners are smooth curves, so it
  // turns through them), eased so it swings round instead of snapping. (x, y): where it's drawn now.
  function steer(c, x, y, dt) {
    if (c.hx !== undefined) {
      const mx = x - c.hx, my = y - c.hy;
      if (mx * mx + my * my > 4e-6) { const tg = Math.atan2(my, mx); if (c.ang === undefined) c.ang = tg; else { const df = Math.atan2(Math.sin(tg - c.ang), Math.cos(tg - c.ang)); c.ang += df * Math.min(1, dt * 10); } }
    }
    c.hx = x; c.hy = y;
    if (c.ang === undefined) { const v = DIRV[c.dir] || [0, 1]; c.ang = Math.atan2(v[1], v[0]); }
    return c.ang;
  }
  const DIRV = { '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] };
  const carDepth = c => { const ox = c.ox || 0, oy = c.oy || 0, h = c.h || 0; return fwDepthFix(c.x + ox, c.y + oy, c.x + ox + c.y + oy + 0.6 + (h > 1 ? 0 : clamp((ox + oy) * 1.1, -0.6, 0.6)) + (h > 4 ? 3 : 0)); };
  function roadUnder(x, y, dir) {
    const N = roadNet();
    return dir === '+x' || dir === '-x' ? N.H.find(r => Math.abs(r.y - y) < 0.05 && x >= r.a - 0.7 && x <= r.b + 0.7) : N.V.find(r => Math.abs(r.x - x) < 0.05 && y >= r.a - 0.7 && y <= r.b + 0.7);
  }
  const lanesOf = r => (!r ? [0.45] : r.kind === 'boulevard' ? [0.705, 1.635] : r.kind === 'frontage' ? (r.ow ? [-0.52, 0.52] : [0.52]) : [0.45]);
  // v0.29: a car waits behind the one in front of it in its lane (a queue at the lights doesn't pile into one car)
  function blocked(c, others, reach = 2.7) {
    const v = DIRV[c.dir];
    if (!v) return null;
    const mx = c.x + (c.ox || 0), my = c.y + (c.oy || 0);
    return others.find(o => {
      if (o === c || o.dir !== c.dir || Math.abs((o.h || 0) - (c.h || 0)) > 2) return false;
      const dx = o.x + (o.ox || 0) - mx, dy = o.y + (o.oy || 0) - my, ahead = dx * v[0] + dy * v[1], side = Math.abs(dx * v[1] - dy * v[0]);
      return ahead > 0.05 && ahead < reach && side < 0.45;
    }) || null;
  }
  // v0.49: the nearest car ahead in the same lane, and how far (its back to our front)
  function leadOf(c, others, reach = 6) {
    const v = DIRV[c.dir];
    if (!v) return null;
    const mx = c.x + (c.ox || 0), my = c.y + (c.oy || 0);
    let best = null;
    others.forEach(o => {
      if (o === c || o.dir !== c.dir || Math.abs((o.h || 0) - (c.h || 0)) > 2) return;
      const dx = o.x + (o.ox || 0) - mx, dy = o.y + (o.oy || 0) - my, ahead = dx * v[0] + dy * v[1], side = Math.abs(dx * v[1] - dy * v[0]);
      if (ahead > 0.05 && ahead < reach && side < 0.45 && (!best || ahead < best.gap)) best = { o, gap: ahead };
    });
    return best;
  }
  // how fast to go behind it: stop at a car's length, ease up to its speed as the gap opens to a safe distance
  const followSpeed = (vmax, L, v) => { if (!L) return vmax; const s0 = 1.05, safe = 1.9 + v * 0.12; return L.gap <= s0 ? 0 : Math.min(vmax, (L.o.v === undefined ? vmax : L.o.v) + (L.gap - safe) * 1.6, vmax * (L.gap - s0) / (safe - s0)); };
  // nobody in that lane just ahead or just behind
  function laneClear(c, others, off, fwd, back = 2) {
    const v = DIRV[c.dir], Rv = RIGHT[c.dir];
    return !others.some(o => {
      if (o === c || o.dir !== c.dir || Math.abs((o.h || 0) - (c.h || 0)) > 2) return false;
      const a = (o.x - c.x) * v[0] + (o.y - c.y) * v[1], side = (o.x + (o.ox || 0) - c.x) * Rv[0] + (o.y + (o.oy || 0) - c.y) * Rv[1];
      return a > -back && a < fwd && Math.abs(side - off) < 0.55;
    });
  }
  function laneStep(c, dt, others) {
    const hi = (c.h || 0) > 1, r = hi ? null : roadUnder(c.x, c.y, c.dir), L = lanesOf(r), key = (r ? (r.y !== undefined ? 'h' + r.y + ',' + r.a : 'v' + r.x + ',' + r.a) : '') + c.dir;
    if (key !== c.rk) { c.rk = key; c.ln = L.length - 1; }
    c.ln = Math.min(c.ln === undefined ? L.length - 1 : c.ln, L.length - 1);
    if (others && L.length > 1 && !hi) {
      c.cool = (c.cool || 0) - dt;
      const ahead = blocked(c, others, 3.4);
      if (ahead && c.ln > 0 && c.cool <= 0 && laneClear(c, others, L[c.ln - 1], 4)) { c.ln--; c.cool = 2.5; }
      else if (!ahead && c.ln < L.length - 1 && c.cool <= 0 && laneClear(c, others, L[c.ln + 1], 4.5, 2.5)) { c.ln++; c.cool = 3; }
    }
    // v0.47: coming up to a crossing where it turns: left (or round) from the left-hand lane, right from the right-hand one
    if (L.length > 1 && !hi && c.path && c.path.length > 1 && Math.hypot(c.path[0][0] - c.x, c.path[0][1] - c.y) < 9) { const tn = turnAt(c); if (tn === 'l' || tn === 'u') c.ln = 0; else if (tn === 'r') c.ln = L.length - 1; }
    // v0.47: off the road (a car park, a drive): no lane, it drives straight in or out and swings into its lane
    const Rv = RIGHT[c.dir] || [0, 1], off = hi || !r ? 0 : L[c.ln], k = c.ox === undefined ? 1 : 1 - Math.exp(-dt * (r ? 5 : 4));
    c.ox = (c.ox || 0) + (Rv[0] * off - (c.ox || 0)) * k; c.oy = (c.oy || 0) + (Rv[1] * off - (c.oy || 0)) * k;
    return r;
  }
  function traffic(objs, dt, ts) {
    if (CARS_OUT.town !== VIEW_TOWN) CARS_OUT = { town: VIEW_TOWN, list: [], next: 0 };
    const now2 = performance.now(), kinds = Object.keys(CARS).filter(k => !CARS[k].excl && CARS[k].kind !== 'two' && k !== 'tractor');
    if (!CARS_OUT.list.some(c => c.police)) {   // v0.25: a police car on patrol
      const ends = [...TL.places, ...(TL.stores || []).map(st => storeGeo(st).bay)], a = ends[Math.floor(Math.random() * ends.length)], b = ends[Math.floor(Math.random() * ends.length)];
      if (a && b && a !== b) { const path = route(a, b, false); if (path.length > 2) CARS_OUT.list.push({ police: true, car: (PC => ({ k: 'sedan', color: PC.body, police: PC }))(countyOf(VIEW_TOWN).police), x: path[0][0], y: path[0][1], path: path.slice(1), dir: '+x', h: 0, alpha: 0 }); }
    }
    const [hh, mm] = localHM(VIEW_TOWN), hr = hh + mm / 60, rush = RUSH.hours.some(([a2, b2]) => hr >= a2 && hr < b2), ev = rush ? RUSH.every : RUSH.everyCalm;   // v0.47: the rush hours
    if (now2 > CARS_OUT.next && CARS_OUT.list.length < (rush ? RUSH.cars : RUSH.calm)) {
      CARS_OUT.next = now2 + ev[0] + Math.random() * ev[1];
      const ends = [...TL.places, ...(TL.stores || []).map(st => storeGeo(st).bay), ...allLots().filter(l => homeOf(l.id)).slice(0, 20).map(l => gateOf(l.id))];
      if (ends.length > 1) {
        const a = ends[Math.floor(Math.random() * ends.length)];
        let b = ends[Math.floor(Math.random() * ends.length)], fwy;
        if (TL.fwy && Math.random() < FREEWAY.leave) { const on = fwGeo().ramps.filter(Rp => !Rp.off), Rp = on[Math.floor(Math.random() * on.length)]; if (Rp) { b = [Rp.start[0], Rp.start[1]]; fwy = Rp.i; } }   // v0.39: out of town, up the ramp
        const k = kinds[Math.floor(Math.random() * kinds.length)];
        if (a !== b) { const path = route(a, b, false); if (path.length > 2) CARS_OUT.list.push({ car: { k, color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] }, x: path[0][0], y: path[0][1], path: path.slice(1), dir: '+x', h: 0, alpha: 0, fwy, spd: carPace(k) * (0.94 + Math.random() * 0.12) }); }   // v0.47: each kind its own speed
      }
    }
    CARS_OUT.list = CARS_OUT.list.filter(c => {
      const others = [...CARS_OUT.list.filter(o => o !== c && o.alpha > 0.3), ...(trip && trip.inCar && !trip.arrived && trip.town === VIEW_TOWN ? [trip] : [])];
      const rd = laneStep(c, dt, others);   // v0.39: its lane, and how fast traffic goes on this road
      const vmax = 6 * (rd ? (ROAD_KINDS[rd.kind] || ROAD_KINDS.avenue).spd : 0.8) * (c.spd || 1);
      let vt = vmax;
      if (c.path.length && !c.h && mustStop(c)) { vt = 0; c.v = 0; }   // v0.22: red light (v0.47: for the way it's turning; car parks' lights)
      if (vt && stopSign(c, dt)) { vt = 0; c.v = 0; }   // v0.39: a stop sign
      if (vt && c.path.length) vt = Math.max(0, followSpeed(vmax, leadOf(c, others), c.v || 0));   // v0.49: keep a distance from the car in front (no stop-go bouncing)
      c.v = c.v === undefined ? vt : c.v + clamp(vt - c.v, -18 * dt, 4 * dt);   // brake firmly, pull away gently
      let go = Math.max(0, c.v) * dt;
      while (go > 0 && c.path.length) { const [tx, ty, th = 0] = c.path[0], dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy); if (d > 0.01) c.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '+x' : '-x') : (dy > 0 ? '+y' : '-y'); if (d <= go) { c.x = tx; c.y = ty; c.h = th; c.path.shift(); go -= d; } else { c.x += dx / d * go; c.y += dy / d * go; c.h += (th - c.h) * (go / d); go = 0; } }
      if (c.police && !c.path.length) { const b = TL.places[Math.floor(Math.random() * TL.places.length)], np = b && route([c.x, c.y], b, false); if (np && np.length > 2) c.path = np.slice(1); }   // v0.25: the patrol never ends
      if (!c.path.length && c.fwy !== undefined && TL.fwy) { fwJoin(c, c.fwy); return false; }   // v0.39: up the ramp and away
      c.alpha = c.path.length ? Math.min(1, c.alpha + dt * 2) : c.alpha - dt * 2;
      if (c.alpha <= 0 && !c.path.length) return false;
      // keep to the right-hand side of the road (v0.39: in its lane)
      const off = [c.ox || 0, c.oy || 0], ang = steer(c, c.x + off[0], c.y + off[1], dt);
      objs.push({ d: carDepth(c), f: () => { ctx.save(); ctx.globalAlpha = Math.max(0, c.alpha); ctx.translate(0, -(c.h || 0) * cam.z); drawCarAng(c.car, c.x + off[0], c.y + off[1], ang, ts);
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
    if (!bay.home && far > 0.6) legs.push({ how: 'walk', from: bay.pt, path: far < 7 && !throughBld(bay.pt, to) ? [to] : route(bay.pt, to) });   // v0.47: round a building, not through it
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
      const k = KERB[trip.dir] || [0, 1], kb = Math.max(0.75, Math.hypot(trip.ox || 0, trip.oy || 0) + 0.15), c = [trip.x + k[0] * kb, trip.y + k[1] * kb];
      S.carAt = { town: trip.town, pt: c, dir: trip.dir, id: null, place: null };
      pt = [c[0] + k[0] * 0.6, c[1] + k[1] * 0.6];
    }
    S.out = { town: trip.town, pt, place: !trip.inCar && trip.town === myTown() && inParkPt(pt) ? 'park' : null, id: null };   // v0.34: stopped inside the park: you're in the park
    S.trip = null; trip = null;
    return true;
  }
  function startTrip(to, how, car, done, dest, place) {
    if (trip && !trip.arrived) stopTripHere();   // v0.29: from where you are now (not back to where you set off)
    TOWN_USE = null;
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
    if (TOWN_USE && (performance.now() > TOWN_USE.until || mode !== 'town')) { const f = mode === 'town' ? TOWN_USE.done : null; TOWN_USE = null; if (f) setTimeout(f, 60); }   // v0.32
    if (!trip) return;
    if (trip.town !== VIEW_TOWN || mode !== 'town') { finishTripNow(true); return; }
    if (trip.arrived) return;
    if (trip.inCar && trip.path.length && !trip.h && mustStop(trip) && (trip.waited = (trip.waited || 0) + dt) < 12) return;   // v0.22: red light (v0.47: for the way you turn)
    if (trip.inCar && trip.path.length && !mustStop(trip)) trip.waited = 0;
    if (trip.inCar) laneStep(trip, dt, CARS_OUT.town === trip.town ? CARS_OUT.list.filter(o => o.alpha > 0.3) : null);   // v0.39: in your lane (you pass slow cars too)
    if (trip.inCar && trip.path.length && stopSign(trip, dt)) return;   // v0.39: a stop sign
    // v0.49: behind another car: slow to its speed and keep a distance (stop only right behind it; after 6 s, go round)
    let follow = 1;
    if (trip.inCar && trip.path.length && CARS_OUT.town === trip.town) {
      const L = leadOf(trip, CARS_OUT.list.filter(o => o.alpha > 0.3)), vm = (TRIP_SPEED.car || 10) * 0.6, fv = followSpeed(vm, L, (trip.fv === undefined ? 1 : trip.fv) * vm) / vm;
      trip.fv = trip.fv === undefined ? fv : trip.fv + clamp(fv - trip.fv, -3 * dt, 0.7 * dt);
      if (trip.fv <= 0.02 && L && L.gap < 1.1) { if ((trip.carWait = (trip.carWait || 0) + dt) < 6) return; } else trip.carWait = 0;
      follow = clamp(trip.fv, 0.15, 1);
    } else trip.carWait = 0;
    const base = (TRIP_SPEED[trip.how] || 3) * dt * (trip.how === 'walk' && isFed() ? 1 + MALL.fed.walk : 1) * (trip.how === 'walk' ? walkMult() : 1) * (trip.inCar && trip.car ? carPace(trip.car.k) * follow : 1);   // v0.44 (v0.47: your car's own pace; v0.49: behind a slower car)
    let left = 1;   // the share of this frame's travel still to go
    while (left > 0 && trip.path.length) {
      const [tx, ty, th = 0, fast = 0] = trip.path[0], dx = tx - trip.x, dy = ty - trip.y, d = Math.hypot(dx, dy);
      const sp = base * (fast && trip.hw ? TRIP_SPEED.highway : th > 0 || (trip.h || 0) > 0 ? 1.5 : 1), go = sp * left;
      if (d > 0.01) { trip.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '+x' : '-x') : (dy > 0 ? '+y' : '-y'); faceTo(trip, dx, dy); }
      if (d <= go) { trip.x = tx; trip.y = ty; trip.h = th; trip.hw = !!fast; trip.path.shift(); left -= d / sp; }
      else { const k = go / d; trip.x += dx * k; trip.y += dy * k; trip.h = (trip.h || 0) + (th - (trip.h || 0)) * k; left = 0; }
    }
    trip.phase += dt * (trip.inCar ? 7 : trip.how === 'bike' ? 9 : 11);
    if (trip.inCar) steer(trip, trip.x + ((trip.h || 0) > 1 ? 0 : trip.ox || 0), trip.y + ((trip.h || 0) > 1 ? 0 : trip.oy || 0), dt);   // v0.47
    if (!trip.path.length) nextLeg(false);
  }
  function drawTrip(ts) {
    const z = cam.z, p = iso(trip.x, trip.y);
    if (trip.inCar) { const off = (trip.h || 0) > 1 ? [0, 0] : [trip.ox || 0, trip.oy || 0]; ctx.save(); ctx.translate(0, -(trip.h || 0) * z); drawCarAng({ ...trip.car, plate: stateOf(myTown()).plate }, trip.x + off[0], trip.y + off[1], trip.ang === undefined ? Math.atan2(...(DIRV[trip.dir] || [0, 1]).slice().reverse()) : trip.ang, ts); ctx.restore(); return; }   // v0.24: on the right (v0.39: in its lane)
    drawPerson(p.x, p.y, z, { look: S.me.look, face: trip.face, back: trip.back && trip.moving, view: trip.view, turn: trip.turn, moving: trip.moving, phase: trip.phase, energy: energyLevel(), ts, seed: 3, pose: trip.moving ? 'walk' : 'stand' }); needBubble(p, z, ts);
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
    drawPerson(p.x, p.y, z, { look: S.me.look, face: 1, view: 'front', turn: [0.7, 0.7], energy: energyLevel(), ts, seed: 3, pose: 'stand', wave: chatting() && (CHAT.e ? !!CHAT.wave : Math.floor(ts / 900) % 2 === 0) });
    if (chatting()) chatBubble(p.x - 12 * z, p.y - 56 * z, z, true, ts);
    carryBox(p, z);
    if (z > 0.3) nameTag(p, S.me.name || '🙂', true);
  }
  // Your car where you parked it.
  function parkedObjs(objs, ts) {
    const c = S.carAt, car = S.me.cars[S.me.car];
    if (!c || !car || c.town !== VIEW_TOWN || (trip && trip.inCar && !trip.arrived)) return;
    const [x, y] = c.pt;
    objs.push({ d: x + y, f: () => drawCarDir({ ...car, plate: stateOf(myTown()).plate }, x, y, c.dir, ts) });
  }
  // ---------- inside a store (v0.20): walk round it, the things for sale on show, the shopkeeper at the counter ----------
  const SHOPS = {}, IMGS = {};
  const meS = { x: 0, y: 0, path: [], face: 1, phase: 0, moving: false, then: null };
  const SHOP_W = { market: 18, nursery: 17, ranch: 15, petshop: 13, furniture: 17, realty: 13, dealer: 17, mall: 17 };
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
    // v0.37
    bank:       { wall: '#f1ece2', roof: '#2f5d50', floor: ['#ece8df', '#e1dccf'], till: '🏦', clerk: { shirt: '#2f5d50', top: 'jacket', inner: '#f4f4f0', hair: 'bun' } },
    office:     { wall: '#eef1f4', roof: '#5b6c7d', floor: ['#c9ced6', '#bfc5ce'], till: '📇', clerk: { shirt: '#4a5a78', top: 'jacket', inner: '#f4f4f0', hair: 'long' } },
    restaurant: { wall: '#2f2a33', roof: '#c9a24a', floor: ['#6b4428', '#5f3c23'], till: '🍷', clerk: { shirt: '#2d2d2d', top: 'jacket', inner: '#f4f4f0', hair: 'short' } },
    hotel:      { wall: '#f4ead8', roof: '#b08d57', floor: ['#efe6d4', '#e4d8c2'], till: '🛎️', clerk: { shirt: '#8a2a34', top: 'jacket', inner: '#f4f4f0', hair: 'bun' } },
    rooftop:    { wall: '#dfeef6', roof: '#38a3e0', floor: ['#e8dcc4', '#ded0b4'], till: '🍹', clerk: { shirt: '#38a3e0', top: 'polo', hair: 'short' } },
    apartments: { wall: '#f2e6dc', roof: '#9a5a3c', floor: ['#d9cfc2', '#cfc4b6'], till: '🔑', clerk: { shirt: '#4a5a78', top: 'polo', hair: 'short' } },
    bookstore:  { wall: '#efe6d4', roof: '#2f5d50', floor: ['#b88552', '#ad7c4a'], till: '📖', clerk: { shirt: '#c9893a', top: 'sweater', hair: 'curly' } },
    salon:      { wall: '#f9f1f4', roof: '#2d2d2d', floor: ['#f4f4f0', '#2d2d2d'], till: '💈', clerk: { shirt: '#2d2d2d', top: 'tshirt', hair: 'long', hairCol: '#a46ef0' } },
    florist:    { wall: '#f3f7ee', roof: '#ec6aa8', floor: ['#d9cdb4', '#cfc2a8'], till: '💐', clerk: { shirt: '#6cbf73', top: 'polo', hair: 'long' } },
    // v0.38
    hospital:   { wall: '#f4f7f9', roof: '#e5484d', floor: ['#eef3f4', '#e4ebec'], till: '📋', clerk: { shirt: '#9fd6d2', top: 'polo', hair: 'long' } },
    bowling:    { wall: '#2f3a6b', roof: '#ec6aa8', floor: ['#3a3f5c', '#343954'], till: '👟', clerk: { shirt: '#ec6aa8', top: 'polo', hair: 'curly' } },
    aquatic:    { wall: '#e6f3fa', roof: '#38a3e0', floor: ['#e8f1f5', '#dfe9ee'], till: '🎟️', clerk: { shirt: '#e5484d', top: 'polo', hair: 'short' } },
    museum:     { wall: '#efe8da', roof: '#8a7a5a', floor: ['#d9cfc2', '#cfc4b6'], till: '🎟️', clerk: { shirt: '#3b3125', top: 'jacket', inner: '#f4f4f0', hair: 'bun' } },
    museum2:    { wall: '#2b3358', roof: '#8a7a5a', floor: ['#3a4270', '#343c66'], till: '🎟️', clerk: { shirt: '#3b3125', top: 'jacket' } },   // v0.45
    museum3:    { wall: '#f1e6d6', roof: '#8a7a5a', floor: ['#c9b08a', '#bfa57e'], till: '🎟️', clerk: { shirt: '#3b3125', top: 'jacket' } },
    station:    { wall: '#efe2d2', roof: '#3d4a66', floor: ['#d9d4ca', '#cfc9bd'], till: '🎫', clerk: { shirt: '#3d4a66', top: 'jacket', inner: '#f4f4f0', hat: 'cap', hatCol: '#3d4a66' } },
    amuse:      { wall: '#f4ead8', roof: '#e5484d', floor: ['#a6d67f', '#9ccf76'], till: '🎟️', clerk: { shirt: '#e5484d', top: 'polo', hat: 'cap', hatCol: '#f2c230' } },   // v0.41
    zoo:        { wall: '#efe3c4', roof: '#3f8a4a', floor: ['#b9d98a', '#b2d483'], till: '🎟️', clerk: { shirt: '#4f7a3a', top: 'polo', hat: 'cap', hatCol: '#c9b08a' } },   // v0.42
    stadium:    { wall: '#d8dde3', roof: '#2f5fa8', floor: ['#cfd3d8', '#c8ccd1'], till: '🎟️', clerk: { shirt: '#2f5fa8', top: 'polo', hat: 'cap', hatCol: '#2f5fa8' } },   // v0.42
    suite:      { wall: '#f4ead8', roof: '#b08d57', floor: ['#c9a27a', '#bf9670'], till: '🛎️', clerk: { shirt: '#8a2a34', top: 'jacket' } },
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
    // v0.36: every building is fuller: more to look at, and people (townsfolk, tap them) doing their own thing.
    // who(…, { cast: true }) is one of the townsfolk (walk: true when it has to be someone on foot, e.g. on a treadmill);
    // { staff: true } works here. Things with { air: true } hang from the ceiling (you walk under them).
    const guest = (x, y, ex) => who(x, y, { cast: true, ...ex });
    const back = { view: 'back', turn: [0.15, -1] };   // standing, looking at something on the back wall / the counter
    if (k === 'bakery') {
      dec('breadshelf', 0.4, 0.2, 5.4, 0.6);
      spot('oven', 8.0, 0.3, 2.8, 1.3, { draw: 'oven', stand: [9.4, 2.4] });
      dec('flour', 11.0, 0.3, 0.8, 0.9);
      dec('kneadtable', 5.9, 1.9, 1.8, 0.9); who(6.8, 1.45, { staff: true, pose: 'work', face: -1, look: { shirt: '#ffffff', top: 'tshirt', hat: 'beanie', hatCol: '#ffffff', hair: 'curly', hairCol: '#2b1d14', skin: '#d39a6c' } });
      spot('case', 1.2, 3.4, 3.2, 1.0, { draw: 'case', items: ['🥐', '🥖', '🍩', '🧁', '🥨'] });
      guest(2.2, 5.0, back); guest(3.5, 5.4, back);
      dec('cakestand', 10.9, 3.0, 0.8, 0.8);
      spot('table', 1.4, 6.6, 1.3, 1.3, { draw: 'table', i: 1, menu: BAKERY_MENU, stand: [2.05, 8.4], use: { at: [1.3, 7.25], pose: 'sit', face: 1, seatH: 9, sit: 'eat', food: '🥐' } });
      dec('table', 4.4, 6.8, 1.3, 1.3, { i: 0, menu: BAKERY_MENU }); dec('table', 9.0, 6.6, 1.3, 1.3, { i: 5, menu: BAKERY_MENU });
      dec('pendant', 2.05, 7.25, 0.1, 0.1, { air: true, col: '#c9893a' }); dec('pendant', 5.05, 7.45, 0.1, 0.1, { air: true, col: '#c9893a' }); dec('pendant', 9.65, 7.25, 0.1, 0.1, { air: true, col: '#c9893a' });
      dec('breadbaskets', 0.4, 5.6, 0.7, 1.4);
      furn('monstera', 10.8, 8.4); furn('plant', 0.4, 8.5);
      P = { RW: 12, RD: 10, door: [6.5, 9.3], counter: { x: 7.6, y: 4.8, w: 3.2, d: 0.9 } };
    } else if (k === 'cafe') {
      spot('menu', 8.6, 0.12, 3.0, 0.2, { draw: 'menuboard', stand: [10.2, 3.95] });
      dec('espresso', 10.5, 2.45, 1.0, 0.6, { base: 16, busy: true }); dec('minicase', 8.7, 2.5, 1.2, 0.7, { base: 16 });
      who(11.5, 1.85, { staff: true, pose: 'work', face: -1, dz: -2, look: { shirt: '#3b3125', top: 'polo', hair: 'long', hairCol: '#6b4226', skin: '#f3c59f' } });
      guest(9.6, 3.95, back); guest(10.0, 4.95, back);
      dec('table', 1.4, 1.8, 1.3, 1.3, { i: 0, menu: CAFE_MENU }); dec('table', 4.4, 1.8, 1.3, 1.3, { i: 2, menu: CAFE_MENU }); dec('table', 1.4, 5.0, 1.3, 1.3, { i: 3, menu: CAFE_MENU });
      spot('table', 4.4, 5.0, 1.3, 1.3, { draw: 'table', i: 1, menu: CAFE_MENU, stand: [5.05, 6.8], use: { at: [4.3, 5.65], pose: 'sit', face: 1, seatH: 9, sit: 'drink', mate: true } });
      [[2.05, 2.45], [5.05, 2.45], [2.05, 5.65], [5.05, 5.65]].forEach(([px, py]) => dec('pendant', px, py, 0.1, 0.1, { air: true, col: '#2d2d2d' }));
      dec('rug', 7.8, 6.0, 3.6, 3.0, { col: '#b5563c', flat: true });
      spot('sofa', 8.2, 7.2, 2, 1, { furn: 'sofa', tint: '#7a4a2a', stand: [9.2, 8.8], use: { at: [9.2, 7.65], pose: 'sit', face: -1, seatH: 8.5, prop: '🎧' } });
      furn('coffeetable', 8.4, 6.2); furn('armchair', 11.4, 6.4, { tint: '#6b8e5a' }); guest(11.9, 6.9, { pose: 'sit', seatH: 8.5, sit: 'read', face: -1 });
      furn('shelf', 0.3, 9.0); furn('shelf', 1.3, 9.0); furn('monstera', 12.0, 9.6); furn('arclamp', 11.2, 8.6); furn('plant', 6.6, 0.3);
      P = { RW: 13, RD: 11, door: [3, 10.3], counter: { x: 8.6, y: 2.4, w: 3.2, d: 0.9 } };
    } else if (k === 'clinic') {
      dec('glass', 7.0, 0.1, 0.15, 5.0); dec('glass', 7.0, 5.0, 2.2, 0.15); dec('glass', 11.4, 5.0, 2.5, 0.15);
      spot('bed', 9.4, 0.9, 2.8, 1.1, { draw: 'exambed', stand: [10.8, 2.7], use: { at: [10.8, 1.45], pose: 'lie', lift: 10, dir: -2.68 } });
      who(8.4, 2.4, { staff: true, look: { shirt: '#ffffff', top: 'jacket', inner: '#9fd6d2', hair: 'short', hairCol: '#5b5f66', skin: '#f3c59f' }, face: 1, view: 'front', turn: [0.6, -0.4], prop: '🩺' });
      dec('eyechart', 12.4, 0.05, 1.0, 0.1); dec('xray', 7.6, 0.05, 1.2, 0.1); dec('ivstand', 12.9, 2.6, 0.5, 0.5); dec('medcart', 7.6, 3.4, 0.8, 0.6);
      dec('chairs', 1.0, 5.6, 3.8, 0.8, { n: 4, sat: [1, 3] }); dec('chairs', 1.0, 7.4, 3.8, 0.8, { n: 4, sat: [0, 2] });
      dec('magazines', 5.2, 5.6, 0.6, 0.6); dec('tvwall', 0.05, 5.4, 0.1, 2.6);
      dec('kidsplay', 4.6, 8.4, 1.6, 1.6); who(5.4, 9.2, { pose: 'crouch', face: 1, scale: 0.72, look: 4 });
      spot('scale', 7.4, 7.2, 1.0, 1.0, { draw: 'healthpod', stand: [7.9, 8.8] });
      spot('pharmacy', 10.4, 6.6, 3.0, 0.7, { draw: 'medshelf', stand: [11.9, 8.0] });
      who(12.6, 6.1, { staff: true, face: -1, view: 'front', turn: [-0.4, 1], look: { shirt: '#9fd6d2', top: 'polo', hair: 'bun', hairCol: '#2b1d14', skin: '#ffe0c4' } });
      dec('wheelchair', 6.2, 9.5, 0.8, 0.8);
      furn('plant', 0.4, 9.6); furn('monstera', 5.6, 0.4); dec('watercooler', 5.8, 7.0, 0.6, 0.6);
      P = { RW: 14, RD: 11, door: [3, 10.3], counter: { x: 1.4, y: 3.2, w: 3.2, d: 0.9 } };
    } else if (k === 'library') {
      dec('bookwall', 0.4, 0.2, 13.2, 0.7); dec('ladder', 10.9, 0.9, 0.6, 0.2);
      dec('bookwall', 9.2, 3.0, 4.0, 0.8, { low: true }); dec('bookwall', 9.2, 5.6, 4.0, 0.8, { low: true });   // v0.50: a way past the desks
      guest(10.0, 4.45, back); guest(11.8, 7.05, back);
      spot('featured', 5.0, 2.4, 1.2, 0.9, { draw: 'bookstand', stand: [5.6, 4.0] });
      dec('longtable', 1.0, 3.4, 2.4, 1.2, { readers: [0, 1] });
      spot('table', 1.0, 6.6, 2.4, 1.2, { draw: 'longtable', readers: [], stand: [0.6, 8.4], use: { at: [0.55, 7.2], pose: 'sit', face: 1, seatH: 8, sit: 'read' } });
      furn('desk', 4.2, 5.4); furn('desk', 6.2, 5.4); guest(5.2, 6.75, { pose: 'sit', seatH: 9, sit: 'type', face: 1, back: true }); guest(7.2, 6.75, { pose: 'sit', seatH: 9, sit: 'type', face: 1, back: true });
      furn('roundrug', 4.6, 8.6, { flat: true }); furn('beanbag', 4.7, 8.8, { tint: '#f2a33a' }); furn('beanbag', 5.9, 9.3, { tint: '#6cbf73' });
      who(5.2, 9.3, { pose: 'sit', seatH: 4.5, sit: 'read', face: 1, scale: 0.72, look: 2 }); who(6.4, 9.8, { pose: 'sit', seatH: 4.5, sit: 'read', face: -1, scale: 0.72, look: 5 });
      furn('armchair', 2.8, 9.4); guest(3.3, 9.9, { pose: 'sit', seatH: 8.5, sit: 'read', face: -1 }); furn('arclamp', 3.9, 9.6);
      dec('bookcart', 12.6, 3.9, 1.0, 0.6); dec('newsrack', 13.2, 7.4, 0.6, 0.8);
      furn('plant', 0.4, 10.6); furn('plant', 13.2, 10.6);
      P = { RW: 14, RD: 12, door: [3, 11.3], counter: { x: 9.6, y: 9.0, w: 3.2, d: 0.9 } };
    } else if (k === 'gym') {
      // the back wall is a mirror; cardio along it, a rubber-floored corner for boxing, ropes and boxes, free weights
      // on the right, mats on the left, the coach's desk, lockers and towels at the front
      dec('mirrorwall', 0.3, 0.05, 15.4, 0.12);
      dec('rubber', 3.3, 4.3, 6.9, 4.4, { flat: true }); dec('rubber', 10.6, 4.3, 5.1, 4.4, { flat: true, col: '#3d434c' });
      const work = (key, fk, x, y, at, pose, ex = {}) => spot(key, x, y, ex.w || FURN[fk].w, ex.d || FURN[fk].d, { ...(ex.draw ? { draw: ex.draw } : { furn: fk, tint: '#38a3e0' }), stand: ex.stand || [x + (ex.w || FURN[fk].w) / 2, y + (ex.d || FURN[fk].d) + 0.6], use: { at, pose, face: 1, ...ex.use } });
      // cardio
      const toWall = { view: 'back', turn: [0.1, -1] };   // v0.43: facing the console at the mirror wall, backs to us
      work('treadmill', 'treadmill', 0.8, 1.0, [1.3, 2.0], 'run', { use: { lift: 4, moving: true, ...toWall } });
      furn('treadmill', 2.2, 1.0); guest(2.7, 2.0, { walk: true, pose: 'run', lift: 4, moving: true, ...toWall });
      furn('treadmill', 3.6, 1.0); guest(4.1, 2.0, { walk: true, pose: 'walk', lift: 4, moving: true, ...toWall });
      work('elliptical', 'treadmill', 5.2, 1.0, [5.7, 1.9], 'walk', { draw: 'elliptical', w: 1.0, d: 1.6, use: { lift: 7, moving: true, ...toWall } });
      dec('elliptical', 6.5, 1.0, 1.0, 1.6, { busy: true }); guest(7.0, 1.9, { walk: true, pose: 'walk', lift: 7, moving: true, ...toWall });
      work('spinbike', 'spinbike', 8.0, 1.3, [8.5, 1.8], 'bike', { use: { moving: true } });
      furn('spinbike', 9.2, 1.3); guest(9.7, 1.8, { walk: true, pose: 'bike', face: 1, moving: true });
      work('rower', 'treadmill', 10.8, 1.0, [11.25, 1.3], 'row', { draw: 'rower', w: 1.8, d: 0.6, stand: [11.2, 2.1], use: { seatH: 5 } });
      dec('rower', 10.8, 2.5, 1.8, 0.6, { busy: true }); guest(11.25, 2.8, { walk: true, pose: 'row', seatH: 5, face: 1, dz: 0.5 });
      dec('cable', 13.3, 0.5, 2.0, 0.7); guest(14.3, 1.75, { pose: 'lift', face: -1 });
      // boxing, ropes, boxes
      work('boxing', 'boxing', 3.8, 4.8, [3.6, 5.9], 'box', { stand: [3.6, 6.4] });
      furn('boxing', 5.3, 4.8); guest(5.1, 5.9, { pose: 'box', face: 1 });
      work('ropes', 'boxing', 6.6, 4.7, [6.95, 5.05], 'ropes', { draw: 'ropes', w: 3.2, d: 0.7, stand: [7.0, 6.0] });
      dec('plyo', 4.0, 7.2, 1.0, 1.0); guest(5.4, 7.8, { walk: true, pose: 'jacks', face: 1 });
      dec('medballs', 8.6, 7.6, 1.2, 0.6); guest(7.3, 7.9, { walk: true, pose: 'squat', face: 1 });
      // free weights
      work('squat', 'boxing', 13.4, 4.7, [14.1, 5.7], 'squat', { draw: 'squatrack', w: 1.4, d: 2.0, stand: [14.1, 7.3] });
      dec('gymbench', 11.0, 4.9, 0.5, 1.5); guest(11.25, 5.7, { pose: 'sit', seatH: 6, sit: 'drink', face: 1 });
      work('dumbbells', 'dumbbells', 11.2, 7.6, [11.7, 8.9], 'lift', { stand: [11.7, 9.2] });
      dec('kbrack', 12.6, 7.6, 1.6, 0.6); guest(13.4, 8.8, { pose: 'lift', face: -1 });
      dec('platetree', 15.1, 4.7, 0.6, 0.6);
      // mats on the left
      work('yogamat', 'yogamat', 0.6, 4.4, [1.1, 5.4], 'yoga', { stand: [1.1, 6.9] });
      furn('yogamat', 0.6, 7.2, { tint: '#ec6aa8' }); guest(1.1, 8.2, { walk: true, pose: 'yoga', face: -1 });
      dec('foam', 2.0, 8.2, 1.0, 0.6);
      // the front: the coach's desk, lockers with a bench, towels, water
      dec('lockers', 10.8, 10.6, 4.2, 0.6, { along: true }); dec('bench', 11.2, 11.7, 2.4, 0.6); guest(12.0, 12.15, { pose: 'sit', seatH: 7, sit: 'phone', face: -1, dz: 0.4 });
      dec('towels', 7.6, 11.6, 1.2, 0.5); dec('watercooler', 9.2, 11.7, 0.6, 0.6);
      furn('plant', 0.4, 11.8); furn('plant', 15.2, 11.9); furn('monstera', 15.1, 7.8);
      P = { RW: 16, RD: 13, door: [3, 12.3], counter: { x: 1.0, y: 9.8, w: 3.2, d: 0.9 } };
    } else if (k === 'post') {
      spot('boxes', 0.5, 0.15, 5.0, 0.5, { draw: 'poboxes', stand: [3.0, 1.6] });
      dec('parcels', 6.4, 0.3, 5.0, 0.8);
      who(8.8, 2.5, { staff: true, pose: 'work', face: 1, look: { shirt: '#2f6fb2', top: 'polo', hair: 'short', hairCol: '#6b4226', skin: '#ffe0c4' } });
      dec('mailcart', 10.9, 1.6, 0.8, 1.2);
      dec('stanchions', 6.4, 5.2, 3.6, 1.4); guest(7.4, 5.6, back); guest(8.6, 5.65, back);
      spot('cards', 1.0, 5.2, 1.0, 1.0, { draw: 'cardrack', stand: [1.5, 6.8] });
      dec('scaletable', 4.0, 5.4, 1.4, 0.8);
      dec('packtable', 3.4, 7.6, 1.8, 0.8); guest(4.3, 8.85, { pose: 'work', face: 1, back: true });
      dec('stampposter', 0.05, 2.4, 0.1, 1.6, { base: 30 });   // on the left wall
      dec('redbox', 10.6, 7.4, 0.8, 0.8); furn('plant', 0.4, 8.6);
      P = { RW: 12, RD: 10, door: [3, 9.3], counter: { x: 6.6, y: 3.8, w: 3.6, d: 0.9 } };
    } else if (k === 'school') {
      dec('blackboard', 3.0, 0.1, 7.0, 0.15); dec('abc', 1.0, 0.05, 12.0, 0.1); dec('worldmap', 10.6, 0.05, 1.8, 0.1); dec('clock', 2.0, 0.05, 0.6, 0.1);
      [[2.0, 4.4, 0], [5.0, 4.4, 1], [8.0, 4.4, 2], [11.0, 4.4, -1], [2.0, 6.8, 3], [5.0, 6.8, -1], [11.0, 6.8, 4]].forEach(([x, y, kid]) => dec('schooldesk', x, y, 1.2, 0.8, { kid }));
      spot('desk', 8.0, 6.8, 1.2, 0.8, { draw: 'schooldesk', kid: -1, stand: [8.6, 8.5], use: { at: [8.6, 7.95], pose: 'sit', face: 1, back: true, seatH: 7, prop: '✏️' } });
      dec('cubbies', 0.05, 3.2, 0.7, 4.4);
      furn('shelf', 0.3, 9.6); furn('shelf', 1.3, 9.6); dec('globe', 12.6, 1.0, 0.8, 0.8); furn('plant', 12.8, 9.6);
      furn('aquarium', 10.2, 9.6); furn('easel', 12.8, 6.2); who(12.6, 7.6, { pose: 'work', face: 1, back: true, scale: 0.78, look: 3 });
      dec('rug', 4.6, 9.0, 3.0, 1.6, { col: '#5aa2e0', flat: true });
      P = { RW: 14, RD: 11, door: [3, 10.3], counter: { x: 5.2, y: 1.8, w: 3.2, d: 0.9 } };
    } else if (k === 'plaza') {
      spot('board', 4.5, 0.12, 5.0, 0.2, { draw: 'townboard', stand: [7.0, 1.6] });
      dec('frames', 0.8, 0.05, 3.0, 0.1);
      dec('flag', 1.0, 0.6, 0.6, 0.6, { col: '#e5484d' }); dec('flag', 12.4, 0.6, 0.6, 0.6, { col: '#2f6fb2' });
      dec('numscreen', 10.9, 0.05, 2.0, 0.1); dec('counter2', 10.7, 1.6, 2.4, 0.9); who(11.9, 1.05, { staff: true, face: -1, view: 'front', turn: [-0.2, 1], look: { shirt: '#4a5a78', top: 'jacket', inner: '#f4f4f0', hair: 'long', hairCol: '#2b1d14', skin: '#f3c59f' } });
      guest(11.6, 3.15, back); dec('ticketmachine', 9.6, 1.2, 0.5, 0.5);
      dec('model', 4.6, 4.0, 3.0, 2.0);
      dec('bench', 1.0, 6.4, 2.4, 0.6); dec('bench', 1.0, 8.4, 2.4, 0.6);
      guest(1.6, 6.85, { pose: 'sit', seatH: 7, sit: 'phone', face: -1, dz: 0.5 }); guest(2.8, 6.85, { pose: 'sit', seatH: 7, sit: 'lean', face: -1, dz: 0.5 }); guest(2.2, 8.85, { pose: 'sit', seatH: 7, sit: 'read', face: -1, dz: 0.5 });
      furn('monstera', 0.4, 0.4); furn('monstera', 13.0, 9.6); furn('bigrug', 5.6, 7.4, { flat: true }); dec('watercooler', 13.1, 4.4, 0.6, 0.6);
      P = { RW: 14, RD: 11, door: [7, 10.3], counter: { x: 9.6, y: 5.0, w: 3.2, d: 0.9 } };
    } else if (k === 'police') {
      dec('cell', 8.6, 0.3, 4.0, 3.4);
      spot('board', 2.6, 0.12, 3.2, 0.2, { draw: 'noticeboard', stand: [4.2, 1.6] });
      dec('coffeemaker', 5.9, 0.3, 1.2, 0.6);
      dec('officedesk', 6.0, 5.6, 2.0, 1.0); dec('officedesk', 9.6, 5.6, 2.0, 1.0);
      who(7.0, 7.0, { staff: true, pose: 'sit', seatH: 8, sit: 'type', face: 1, back: true, look: { shirt: '#24324f', top: 'polo', hair: 'short', hairCol: '#1d1a17', skin: '#d39a6c' } });
      who(10.6, 7.0, { staff: true, pose: 'sit', seatH: 8, sit: 'type', face: 1, back: true, look: { shirt: '#24324f', top: 'polo', hair: 'bun', hairCol: '#6b4226', skin: '#f3c59f' } });
      dec('filecab', 0.05, 5.6, 0.7, 2.2); dec('k9', 11.4, 3.9, 1.1, 1.0);
      furn('plant', 0.4, 8.6); dec('watercooler', 12.2, 8.6, 0.6, 0.6);
      P = { RW: 13, RD: 10, door: [3, 9.3], counter: { x: 1.4, y: 4.2, w: 3.2, d: 0.9 } };
    } else if (k === 'firestation') {
      spot('truck', 1.2, 0.9, 2.2, 5.6, { draw: 'firetruck', stand: [4.2, 4.0] });
      dec('ambulance', 4.6, 3.6, 2.0, 4.2);
      dec('lockers', 9.4, 0.3, 4.6, 0.7, { along: true, helmets: true }); dec('pole', 7.4, 2.4, 0.6, 0.6); dec('hosereel', 5.4, 0.4, 1.2, 0.6);
      dec('gearrack', 14.2, 1.6, 0.6, 3.4); dec('extinguishers', 14.3, 5.6, 0.4, 1.0);
      who(12.0, 2.6, { staff: true, face: -1, view: 'front', turn: [-0.4, 1], look: { shirt: '#c9433b', top: 'jacket', inner: '#f2c230', hair: 'curly', hairCol: '#1d1a17', skin: '#9a6440', hat: 'cap', hatCol: '#f2c230' } });
      dec('table', 11.4, 8.2, 1.3, 1.3, { i: 0, crew: [{ shirt: '#c9433b', top: 'tshirt', hair: 'short', hairCol: '#6b4226', skin: '#f3c59f' }, { shirt: '#24324f', top: 'tshirt', hair: 'long', hairCol: '#2b1d14', skin: '#d39a6c' }], seats: [0, 2], menu: ['☕', '🍕', '🥪'] });
      dec('stripes', 0.8, 7.4, 3.0, 0.5, { flat: true });
      P = { RW: 15, RD: 11, door: [6, 10.3], counter: { x: 9.8, y: 6.2, w: 3.2, d: 0.9 } };
    } else if (k === 'bank') {   // v0.37: the City Tower's ground floor
      dec('banksign', 3.8, 0.05, 5.6, 0.1); dec('vault', 10.8, 0.05, 1.8, 0.1); dec('clock', 9.6, 0.05, 0.6, 0.1);
      spot('lift', 0.8, 0.1, 1.8, 0.3, { draw: 'lift', stand: [1.7, 1.4] });
      spot('teller', 4.0, 1.6, 6.4, 0.9, { draw: 'tellers', stand: [7.2, 3.4] });
      [5.1, 7.2, 9.3].forEach((tx, j) => who(tx, 1.15, { staff: true, face: -1, view: 'front', turn: [-0.2, 1], look: { shirt: ['#2f5d50', '#4a5a78', '#2d2d2d'][j], top: 'jacket', inner: '#f4f4f0', hair: ['short', 'long', 'bun'][j], hairCol: HAIR_COLORS[j], skin: SKINS[(j + 1) % 4] } }));
      dec('stanchions', 5.2, 4.0, 4.2, 1.2); guest(6.2, 4.45, back); guest(7.6, 4.5, back); guest(9.0, 4.45, back);
      spot('atm', 0.25, 3.0, 0.7, 0.7, { draw: 'atm', stand: [1.4, 3.4] });
      dec('column', 3.0, 5.4, 0.6, 0.6); dec('column', 10.4, 5.4, 0.6, 0.6);
      spot('loans', 10.2, 6.8, 2.0, 1.0, { draw: 'officedesk', stand: [11.2, 8.5] }); who(11.2, 6.35, { staff: true, pose: 'sit', seatH: 8, sit: 'type', face: -1, look: { shirt: '#2d2d2d', top: 'jacket', inner: '#f4f4f0', hair: 'short', hairCol: '#5b5f66', skin: '#f3c59f' } });
      furn('sofa', 0.8, 7.6, { tint: '#2f5d50' }); guest(1.4, 8.05, { pose: 'sit', seatH: 8.5, sit: 'phone', face: -1, dz: 0.5 }); guest(2.3, 8.05, { pose: 'sit', seatH: 8.5, sit: 'read', face: -1, dz: 0.5 });
      who(12.4, 3.4, { staff: true, face: -1, view: 'front', turn: [-0.3, 1], look: { shirt: '#24324f', top: 'polo', hair: 'short', hairCol: '#1d1a17', skin: '#9a6440', hat: 'cap', hatCol: '#24324f' } });
      furn('monstera', 12.2, 8.6); furn('plant', 0.4, 5.0);
      P = { RW: 13, RD: 10, door: [6.5, 9.3], counter: { x: 2.0, y: 5.6, w: 3.0, d: 0.9 } };
    } else if (k === 'office') {   // up in the tower: desks, a meeting room, a view
      spot('lift', 0.8, 0.1, 1.8, 0.3, { draw: 'lift', stand: [1.7, 1.4] });
      dec('whiteboard', 4.0, 0.05, 3.2, 0.1);
      [[4.0, 2.6], [6.4, 2.6], [4.0, 5.2], [6.4, 5.2]].forEach(([dx, dy]) => { furn('desk', dx, dy); guest(dx + 1.0, dy + 1.35, { pose: 'sit', seatH: 9, sit: 'type', face: 1, back: true }); });
      dec('glass', 9.2, 0.1, 0.15, 4.6); dec('glass', 9.2, 4.6, 4.6, 0.15);
      dec('table', 10.8, 1.6, 1.3, 1.3, { i: 0, crew: [{ shirt: '#4a5a78', top: 'polo' }, { shirt: '#ec6aa8', top: 'sweater', hair: 'long' }, { shirt: '#f4f4f0', top: 'jacket', inner: '#2f6fb2', hair: 'bun' }], seats: [0, 1, 2], menu: ['📊', '☕', '💻'] });
      dec('printer', 0.3, 5.0, 0.8, 0.7); dec('watercooler', 0.4, 6.4, 0.6, 0.6);
      spot('coffee', 9.6, 6.4, 1.6, 0.7, { draw: 'coffeemaker', stand: [10.4, 7.8] });
      spot('view', 12.6, 6.0, 0.5, 2.6, { draw: 'telescope', stand: [12.2, 7.3], use: { at: [12.3, 7.3], pose: 'stand', view: 'back', turn: [1, -0.3] } });
      furn('plant', 0.4, 9.8); furn('monstera', 12.8, 9.6); furn('sofa', 4.4, 8.6, { tint: '#5b6470' }); guest(5.0, 9.05, { pose: 'sit', seatH: 8.5, sit: 'chat', face: -1, dz: 0.5 });
      P = { RW: 14, RD: 11, door: [3, 10.3], counter: { x: 1.2, y: 8.0, w: 3.0, d: 0.9 }, sky: true };
    } else if (k === 'restaurant') {   // the top of the tower: tables by the windows, a bar, a piano
      spot('lift', 0.8, 0.1, 1.8, 0.3, { draw: 'lift', stand: [1.7, 1.4] });
      const RM = ['🍝', '🍷', '🥩', '🍣', '🥗', '🍰'];
      spot('table', 4.0, 1.4, 1.3, 1.3, { draw: 'table', i: 1, menu: RM, stand: [4.65, 3.2], use: { at: [3.9, 2.05], pose: 'sit', face: 1, seatH: 9, sit: 'eat', food: '🍝' } });
      spot('date', 7.0, 1.4, 1.3, 1.3, { draw: 'table', i: 1, menu: RM, stand: [7.65, 3.2], use: { at: [6.9, 2.05], pose: 'sit', face: 1, seatH: 9, sit: 'eat', food: '🥩', mate: true } });
      dec('table', 10.0, 1.4, 1.3, 1.3, { i: 0, menu: RM }); dec('table', 4.0, 4.6, 1.3, 1.3, { i: 3, menu: RM }); dec('table', 7.0, 4.6, 1.3, 1.3, { i: 5, menu: RM }); dec('table', 10.0, 4.6, 1.3, 1.3, { i: 2, menu: RM });
      [[4.65, 2.05], [7.65, 2.05], [10.65, 2.05], [4.65, 5.25], [7.65, 5.25], [10.65, 5.25]].forEach(([px, py]) => dec('pendant', px, py, 0.1, 0.1, { air: true, col: '#c9a24a' }));
      spot('bar', 0.3, 3.6, 0.9, 3.6, { draw: 'barcounter', stand: [2.2, 5.4], use: { at: [1.75, 5.4], pose: 'sit', face: -1, back: true, seatH: 10, sit: 'drink' } });
      guest(1.75, 4.2, { pose: 'sit', seatH: 10, sit: 'drink', face: -1 });
      furn('piano', 11.4, 8.0); who(12.4, 9.35, { staff: true, pose: 'sit', seatH: 8, sit: 'type', face: 1, back: true, look: { shirt: '#2d2d2d', top: 'jacket', inner: '#f4f4f0', hair: 'long', hairCol: '#2b1d14', skin: '#d39a6c' } });
      dec('kitchenpass', 4.0, 8.4, 3.6, 0.8); who(5.8, 7.95, { staff: true, pose: 'work', face: -1, dz: -1, look: { shirt: '#ffffff', top: 'jacket', inner: '#ffffff', hat: 'beanie', hatCol: '#ffffff', hair: 'short', hairCol: '#2b1d14', skin: '#f3c59f' } });
      who(8.6, 7.0, { staff: true, face: 1, view: 'front', turn: [0.3, 1], prop: '🍷', look: { shirt: '#ffffff', top: 'polo', bottom: 'jeans', pants: '#2d2d2d', hair: 'bun', hairCol: '#6b4226', skin: '#ffe0c4' } });
      furn('monstera', 0.4, 9.8); furn('plant', 9.6, 9.8);
      P = { RW: 14, RD: 11, door: [3, 10.3], counter: { x: 0.9, y: 7.6, w: 2.4, d: 0.9 }, sky: true, night: true };
    } else if (k === 'hotel') {   // the lobby: the front desk, a chandelier, the lobby bar, a lounge for afternoon tea
      dec('chandelier', 7.0, 5.0, 0.1, 0.1, { air: true });
      spot('lift', 0.8, 0.1, 1.8, 0.3, { draw: 'lift', stand: [1.7, 1.4] });
      dec('banksign', 4.2, 0.05, 5.0, 0.1, { label: 'HOTEL', col: '#b08d57' });
      spot('bar', 10.4, 0.4, 3.2, 0.9, { draw: 'barcounter', along: true, stand: [11.4, 2.6], use: { at: [11.4, 1.95], pose: 'sit', face: 1, back: true, seatH: 10, sit: 'drink' } });
      guest(12.6, 1.95, { pose: 'sit', seatH: 10, sit: 'chat', face: 1, back: true, dz: 0.3 });
      dec('rug', 4.8, 4.0, 4.4, 3.0, { col: '#8a2a34', flat: true });
      spot('tea', 5.4, 4.6, 2.0, 1.0, { furn: 'coffeetable', stand: [6.4, 6.6], use: { at: [4.9, 5.2], pose: 'sit', face: -1, seatH: 8.5, sit: 'drink' } });
      furn('armchair', 4.4, 4.7, { tint: '#b08d57' }); furn('armchair', 7.6, 4.7, { tint: '#b08d57' }); guest(8.1, 5.2, { pose: 'sit', seatH: 8.5, sit: 'drink', face: -1, dz: 0.4 });
      furn('sofa', 5.4, 6.4, { tint: '#8a2a34' }); guest(6.0, 6.85, { pose: 'sit', seatH: 8.5, sit: 'chat', face: -1, dz: 0.5 });
      dec('luggage', 11.4, 6.6, 1.0, 0.6); who(12.3, 7.6, { staff: true, face: -1, view: 'front', turn: [-0.4, 1], look: { shirt: '#c0453a', top: 'jacket', inner: '#f2c230', hat: 'cap', hatCol: '#c0453a', hair: 'short', hairCol: '#2b1d14', skin: '#9a6440' } });
      guest(10.8, 8.4, { face: 1, view: 'front', turn: [0.2, 1] });
      furn('monstera', 0.4, 9.6); furn('monstera', 12.8, 9.6); furn('plant', 3.4, 0.4);
      P = { RW: 14, RD: 11, door: [7, 10.3], counter: { x: 1.2, y: 4.2, w: 3.0, d: 0.9 } };
    } else if (k === 'rooftop') {   // the hotel's roof: a pool, loungers, sunshades, the sky all round
      spot('lift', 0.8, 0.1, 1.8, 0.3, { draw: 'lift', stand: [1.7, 1.4] });
      spot('pool', 3.4, 1.4, 8.0, 4.2, { draw: 'pool', stand: [7.4, 6.2], use: { at: [6.4, 3.4], pose: 'swim', face: 1 } });
      guest(5.0, 2.4, { walk: true, pose: 'swim', face: 1 }); guest(9.0, 4.5, { walk: true, pose: 'swim', face: -1 });
      [[3.6, 7.0], [5.6, 7.0], [7.6, 7.0], [9.6, 7.0]].forEach(([lx, ly], j) => { if (j === 0) spot('lounger', lx, ly, 1.0, 2.0, { draw: 'lounger', stand: [lx + 1.4, ly + 1.0], use: { at: [lx + 0.5, ly + 1.0], pose: 'lie', lift: 6, dir: -2.68 } }); else { dec('lounger', lx, ly, 1.0, 2.0); if (j !== 2) guest(lx + 0.5, ly + 1.0, { pose: 'lie', lift: 6, dir: -2.68 }); } });
      [[4.8, 9.4], [8.8, 9.4]].forEach(([ux, uy]) => dec('umbrella', ux, uy, 0.6, 0.6));
      dec('barcart', 12.2, 2.4, 1.0, 0.7); who(12.4, 3.6, { staff: true, face: -1, view: 'front', turn: [-0.3, 1], prop: '🍹', look: { shirt: '#f2c230', top: 'tshirt', bottom: 'shorts', pants: '#2d2d2d', hair: 'curly', hairCol: '#2b1d14', skin: '#d39a6c' } });
      furn('monstera', 0.4, 9.6); furn('monstera', 12.8, 9.6); furn('plant', 12.8, 0.4);
      P = { RW: 14, RD: 11, door: [3, 10.3], counter: { x: 12.0, y: 5.6, w: 1.8, d: 0.9 }, sky: true, open: true };
    } else if (k === 'apartments') {   // the lobby: the concierge, mailboxes, a lounge, parcel lockers, the lifts
      dec('lift', 4.2, 0.1, 1.8, 0.3); dec('lift', 6.6, 0.1, 1.8, 0.3);
      spot('mail', 0.3, 2.0, 0.6, 3.0, { draw: 'aptmail', stand: [1.5, 3.5] });
      dec('parcels', 9.4, 0.3, 2.4, 0.8);
      dec('rug', 4.6, 4.6, 3.6, 2.6, { col: '#5b6470', flat: true });
      spot('lounge', 5.0, 5.0, 2, 1, { furn: 'sofa', tint: '#d98e6b', stand: [6.0, 6.8], use: { at: [5.5, 5.45], pose: 'sit', face: -1, seatH: 8.5, sit: 'chat', mate: true } });
      furn('armchair', 7.4, 5.0, { tint: '#d98e6b' }); guest(7.9, 5.5, { pose: 'sit', seatH: 8.5, sit: 'read', face: -1, dz: 0.4 });
      dec('bikerack', 10.4, 7.4, 1.8, 0.6); guest(9.6, 3.6, { face: 1, view: 'front', turn: [0.3, 1] }); guest(3.0, 7.8, { face: -1, view: 'front', turn: [-0.3, 1] });
      furn('monstera', 0.4, 8.6); furn('plant', 11.4, 4.2);
      P = { RW: 12, RD: 10, door: [6, 9.3], counter: { x: 1.4, y: 6.0, w: 3.0, d: 0.9 } };
    } else if (k === 'bookstore') {   // shelves, tables of new books, armchairs to read in, and the shop cat
      dec('bookwall', 0.4, 0.2, 10.2, 0.7); dec('bookwall', 0.25, 1.4, 0.7, 4.6, { low: true });
      spot('table', 3.4, 2.4, 2.2, 1.2, { draw: 'booktable', stand: [4.5, 4.2], use: { at: [8.7, 6.65], pose: 'sit', face: -1, seatH: 8.5, sit: 'read' } });
      dec('booktable', 6.6, 2.4, 2.2, 1.2); guest(7.6, 4.0, back); guest(2.0, 3.0, { face: -1, view: 'back', turn: [-1, -0.2] });
      furn('armchair', 8.2, 6.2, { tint: '#2f5d50' }); furn('armchair', 5.6, 6.6, { tint: '#2f5d50' }); guest(6.1, 7.1, { pose: 'sit', seatH: 8.5, sit: 'read', face: -1, dz: 0.4 }); furn('arclamp', 9.4, 6.0);
      dec('bookcat', 3.2, 6.4, 1.0, 0.8); furn('roundrug', 6.2, 6.0, { flat: true });
      furn('plant', 10.2, 1.4); furn('plant', 0.4, 7.6);
      P = { RW: 11, RD: 9, door: [3, 8.3], counter: { x: 7.4, y: 4.6, w: 2.8, d: 0.9 } };
    } else if (k === 'salon') {   // three chairs at the mirrors, sinks to wash your hair, products, somewhere to wait
      [[1.2, 0], [3.8, 1], [6.4, 2]].forEach(([cx3, j]) => {
        dec('mirror', cx3, 0.05, 1.6, 0.1);
        if (j === 0) spot('chair', cx3 + 0.3, 1.0, 1.0, 1.0, { draw: 'salonchair', stand: [cx3 + 0.8, 2.6], use: { at: [cx3 + 0.8, 1.55], pose: 'sit', face: 1, back: true, seatH: 10, sit: 'lean' } });
        else { dec('salonchair', cx3 + 0.3, 1.0, 1.0, 1.0); guest(cx3 + 0.8, 1.55, { pose: 'sit', seatH: 10, sit: j === 1 ? 'phone' : 'lean', face: 1, back: true, dz: 0.4 });
          who(cx3 + 1.45, 2.05, { staff: true, pose: 'work', face: -1, dz: 0.6, look: { shirt: ['#2d2d2d', '#ec6aa8'][j - 1], top: 'tshirt', hair: ['curly', 'long'][j - 1], hairCol: ['#b5462e', '#e9cf7a'][j - 1], skin: SKINS[j] } }); }
      });
      dec('sinks', 0.25, 3.4, 0.8, 2.4); dec('products', 8.6, 0.3, 1.0, 0.6);
      dec('bench', 5.6, 5.8, 2.4, 0.6); guest(6.4, 6.25, { pose: 'sit', seatH: 7, sit: 'read', face: -1, dz: 0.4 });
      furn('plant', 9.2, 6.6); furn('monstera', 0.4, 6.4);
      P = { RW: 10, RD: 8, door: [3, 7.3], counter: { x: 6.8, y: 3.8, w: 2.4, d: 0.9 } };
    } else if (k === 'florist') {   // buckets of flowers, pots on shelves, a cool cabinet, the florist making a bouquet
      spot('buckets', 0.6, 3.4, 3.0, 1.0, { draw: 'buckets', stand: [2.1, 5.0] });
      dec('potshelf', 0.4, 0.3, 4.0, 0.7); dec('flowerfridge', 5.0, 0.3, 2.4, 0.8);
      dec('floraltable', 4.8, 3.0, 1.8, 0.9); who(5.7, 2.55, { staff: true, pose: 'work', face: -1, dz: -0.6, look: { shirt: '#6cbf73', top: 'tshirt', hair: 'bun', hairCol: '#c98a3c', skin: '#ffe0c4' } });
      furn('plant', 7.8, 2.4); furn('bonsai', 3.8, 5.6);
      guest(2.6, 2.8, { face: -1, view: 'back', turn: [-0.3, -1] });
      furn('monstera', 8.0, 5.4); furn('plant', 0.4, 5.6);
      P = { RW: 9, RD: 7, door: [3, 6.3], counter: { x: 5.8, y: 4.6, w: 2.4, d: 0.9 } };
    } else if (k === 'hospital') {   // v0.38: beds behind curtains, the nursery window, giving blood, a check-up, the pharmacy, a waiting area
      [[0.6, 0], [3.5, 1], [6.4, 2]].forEach(([bx, j]) => {
        if (j === 1) spot('visit', bx, 0.6, 2.4, 1.1, { draw: 'hospbed', stand: [bx + 1.2, 2.6], use: { at: [bx + 1.7, 2.05], pose: 'stand', view: 'back', turn: [0.2, -1] } });
        else dec('hospbed', bx, 0.6, 2.4, 1.1, { empty: j === 2 });
        if (j < 2) guest(bx + 1.2, 1.15, { pose: 'lie', lift: 10, dir: -2.68 });
      });
      dec('ivstand', 3.05, 0.4, 0.3, 0.3); dec('ivstand', 5.95, 0.4, 0.3, 0.3);
      spot('babies', 10.0, 0.12, 4.6, 0.2, { draw: 'nursery', stand: [12.3, 1.7] });
      guest(11.2, 1.45, back); guest(13.4, 1.5, back);
      spot('donate', 0.6, 3.6, 1.2, 1.4, { draw: 'donorchair', stand: [2.4, 5.6], use: { at: [1.2, 4.4], pose: 'sit', face: 1, seatH: 8, sit: 'lean' } });
      who(2.4, 3.9, { staff: true, face: -1, view: 'front', turn: [-0.4, 1], look: { shirt: '#9fd6d2', top: 'polo', hair: 'bun', hairCol: '#2b1d14', skin: '#d39a6c' } });
      dec('counter2', 5.4, 4.2, 3.0, 0.9); who(6.9, 3.65, { staff: true, face: -1, view: 'front', turn: [-0.2, 1], look: { shirt: '#5aa2e0', top: 'polo', hair: 'short', hairCol: '#1d1a17', skin: '#9a6440' } });
      dec('glass', 10.0, 3.0, 0.15, 3.0);
      spot('checkup', 10.9, 3.4, 1.0, 1.0, { draw: 'healthpod', stand: [11.4, 5.2] });
      dec('exambed', 12.4, 3.2, 2.2, 1.0); who(13.2, 4.8, { staff: true, face: -1, view: 'front', turn: [-0.3, 1], prop: '🩺', look: { shirt: '#ffffff', top: 'jacket', inner: '#5aa2e0', hair: 'short', hairCol: '#5b5f66', skin: '#f3c59f' } });
      dec('chairs', 5.0, 7.4, 3.8, 0.8, { n: 4, sat: [0, 2] }); dec('chairs', 5.0, 9.0, 3.8, 0.8, { n: 4, sat: [1, 3] });
      spot('pharmacy', 11.4, 7.8, 3.0, 0.7, { draw: 'medshelf', stand: [12.9, 9.3] });
      who(10.8, 8.6, { staff: true, face: -1, view: 'front', turn: [-0.4, 1], look: { shirt: '#ffffff', top: 'jacket', inner: '#6cbf73', hair: 'long', hairCol: '#6b4226', skin: '#ffe0c4' } });
      dec('vending', 0.2, 6.0, 0.7, 0.9); dec('wheelchair', 9.2, 10.4, 0.8, 0.8);
      furn('plant', 0.4, 10.6); furn('monstera', 14.2, 10.6); furn('plant', 9.4, 0.4);
      P = { RW: 15, RD: 12, door: [10.0, 11.3], counter: { x: 1.2, y: 8.2, w: 3.2, d: 0.9 } };
    } else if (k === 'bowling') {   // four lanes (yours is the first), scores overhead, sofas behind, arcade games, the shoe counter, a snack bar
      [0, 1, 2, 3].forEach(i => { const lx = 0.5 + i * 2.5;
        if (i === 0) spot('lane', lx, 0.3, 2.1, 6.6, { draw: 'bowlane', stand: [lx + 1.05, 7.7] });
        else dec('bowlane', lx, 0.3, 2.1, 6.6, { busy: i !== 1, i });
        dec('scorescreen', lx + 0.3, 8.0, 1.5, 0.1, { air: true, i });
        if (i < 3) dec('ballreturn', lx + 2.12, 6.0, 0.3, 1.2);
      });
      guest(4.05, 7.5, back); guest(6.6, 7.6, back); guest(9.05, 7.5, back);
      dec('lanesofa', 2.8, 9.0, 2, 1, { tint: '#ec6aa8', sat: [0.25] }); dec('lanesofa', 7.8, 9.0, 2, 1, { tint: '#38d39f', sat: [0.25, 0.75] });   // v0.43: sofas facing the lanes, people watching
      spot('arcade', 10.9, 0.3, 1.0, 0.8, { draw: 'arcade', stand: [11.4, 1.8], use: { at: [11.4, 1.35], pose: 'stand', view: 'back', turn: [0.1, -1] } });
      dec('arcade', 12.1, 0.3, 1.0, 0.8, { i: 1 }); spot('claw', 13.3, 0.3, 1.1, 1.0, { draw: 'clawbox', stand: [13.85, 1.9] }); dec('arcade', 14.6, 0.3, 1.0, 0.8, { i: 2 });   // v0.41: a claw machine you really play
      who(12.6, 1.4, { ...back, scale: 0.75, look: 3 }); guest(15.1, 1.45, back);
      dec('shoecubby', 12.4, 3.9, 3.2, 0.5);
      spot('snack', 12.6, 8.8, 2.8, 0.8, { draw: 'snackbar', stand: [14.0, 10.3] });
      furn('plant', 0.4, 10.6); furn('monstera', 15.2, 6.8);
      P = { RW: 16, RD: 12, door: [6.0, 11.3], counter: { x: 12.4, y: 5.6, w: 3.2, d: 0.9 } };
    } else if (k === 'aquatic') {   // a 25 m pool with four lanes, starting blocks, a diving board, stands, the lifeguard, a sauna
      dec('bleachers', 1.0, 0.1, 9.6, 1.35, { crowd: [[0.12, 2, 'chat'], [0.2, 2, 'phone'], [0.45, 1, 'phone'], [0.7, 2, 'lean'], [0.78, 0, 'chin'], [0.9, 1, 'drink']] });   // v0.43: they sit on the steps, facing the pool
      spot('pool', 1.0, 2.0, 12.0, 6.2, { draw: 'bigpool', stand: [7.4, 9.3], use: { at: [7.4, 9.3], pose: 'swim', face: 1, ride: 'pool' } });   // v0.43: the pool draws you swimming in it
      [0, 1, 2, 3].forEach(i => { const bx = 1.0 + (i + 0.5) * 3 - 0.3; if (i === 0) spot('race', bx, 8.25, 0.6, 0.5, { draw: 'block', n: 1, stand: [bx + 0.3, 9.4] }); else dec('block', bx, 8.25, 0.6, 0.5, { n: i + 1 }); });
      spot('dive', 12.4, 4.6, 2.6, 0.6, { draw: 'divingboard', stand: [15.6, 5.9], use: { at: [13.0, 4.9], pose: 'stand', lift: 9, face: -1, view: 'front' } });
      dec('lifeguard', 13.6, 2.0, 0.9, 0.9, { guard: { shirt: '#e5484d', top: 'tshirt', bottom: 'shorts', pants: '#2d2d2d', hair: 'short', hairCol: '#e9cf7a', skin: '#d39a6c', mob: 'walk', body: 'regular' } });   // v0.43: up on the chair, facing the pool
      spot('sauna', 14.0, 8.4, 2.6, 2.6, { draw: 'sauna', stand: [13.4, 11.0], use: { at: [15.2, 9.9], pose: 'sit', face: -1, seatH: 8, sit: 'lean' } });
      dec('lockers', 0.3, 11.7, 4.0, 0.6, { along: true }); dec('bench', 1.0, 10.0, 2.4, 0.6); guest(1.8, 10.45, { pose: 'sit', seatH: 7, sit: 'phone', face: -1, dz: 0.4 });
      furn('plant', 16.4, 12.0); dec('towels', 9.4, 11.8, 1.2, 0.5);
      P = { RW: 17, RD: 13, door: [11.0, 12.3], counter: { x: 5.4, y: 10.8, w: 3.0, d: 0.9 } };
    } else if (k === 'museum') {   // v0.45: 1F the dinosaur hall: the T. rex, a triceratops, fossils, the donation box, the donors' wall, your statue, the gift shop
      spot('lift', 0.8, 0.1, 1.8, 0.3, { draw: 'lift', stand: [1.7, 1.4] });
      spot('dino', 3.8, 1.3, 5.0, 2.2, { draw: 'trex', stand: [6.3, 4.8] }); dec('stanchions', 3.6, 3.7, 5.4, 0.4);
      dec('trike', 10.2, 1.2, 3.0, 1.8); dec('stanchions', 10.0, 3.2, 3.4, 0.4);
      dec('vitrine', 0.3, 4.4, 1.0, 2.6, { items: ['🦴', '🐚', '🦷'] }); dec('vitrine', 14.6, 4.0, 1.0, 2.6, { items: ['🥚', '🦴', '🐚'] });
      guest(5.2, 4.7, back); who(7.0, 4.8, { ...back, scale: 0.72, look: 2 }); who(7.6, 5.1, { ...back, scale: 0.72, look: 4 });
      who(9.2, 4.4, { staff: true, face: -1, view: 'front', turn: [-0.5, 1], prop: '📢', look: { shirt: '#3b3125', top: 'jacket', inner: '#f4f4f0', hair: 'bun', hairCol: '#6b4226', skin: '#d39a6c' } });
      guest(11.8, 4.1, { face: -1, view: 'back', turn: [0.1, -1] });
      dec('donorwall', 12.4, 0.05, 3.2, 0.15);
      spot('mystatue', 6.9, 6.2, 1.4, 1.4, { draw: 'mystatue', stand: [7.6, 8.3] });
      spot('donate', 3.6, 7.0, 0.8, 0.7, { draw: 'donatebox', stand: [4.0, 8.4] });
      dec('bench', 9.6, 8.6, 2.4, 0.6); guest(10.4, 9.05, { pose: 'sit', seatH: 7, sit: 'phone', face: -1, dz: 0.4 });
      spot('shop', 12.6, 8.4, 2.8, 0.8, { draw: 'giftshop', stand: [14.0, 9.9] });
      furn('plant', 15.2, 0.4); furn('monstera', 15.2, 10.6);
      P = { RW: 16, RD: 12, door: [9.0, 11.3], counter: { x: 1.2, y: 10.0, w: 3.0, d: 0.9 } };
    } else if (k === 'museum2') {   // v0.45: 2F the space hall: a big rocket, the planets overhead, a moon rock, a spacesuit, a telescope, a star floor
      spot('lift', 0.8, 0.1, 1.8, 0.3, { draw: 'lift', stand: [1.7, 1.4] });
      dec('starfloor', 4.2, 4.0, 6.0, 4.4, { flat: true });
      spot('space', 6.4, 0.8, 1.8, 1.8, { draw: 'rocket', stand: [7.3, 3.4] });
      dec('planets', 7.0, 5.6, 0.1, 0.1, { air: true }); dec('planets', 12.4, 2.6, 0.1, 0.1, { air: true });
      dec('vitrine', 1.0, 4.4, 1.6, 1.2, { items: ['🌑'] }); guest(2.4, 6.2, { view: 'back', turn: [-0.3, -1] });
      dec('astronaut', 11.4, 1.0, 1.0, 1.0); guest(12.2, 2.8, { view: 'back', turn: [-0.2, -1] });
      dec('telescope', 13.2, 6.4, 1.0, 1.0); who(13.9, 7.8, { view: 'back', turn: [-0.4, -1], scale: 0.72, look: 3 });
      dec('vitrine', 9.4, 9.0, 2.0, 1.0, { items: ['🛰️', '☄️'] }); guest(6.6, 7.2, { view: 'back', turn: [0.2, -1] });
      dec('bench', 3.0, 9.4, 2.4, 0.6); guest(3.8, 9.85, { pose: 'sit', seatH: 7, sit: 'chin', face: -1, dz: 0.4 });
      who(5.2, 3.4, { staff: true, face: 1, view: 'front', turn: [0.4, 1], prop: '🔭', look: { shirt: '#2f3a6b', top: 'jacket', inner: '#f4f4f0', hair: 'short', hairCol: '#2b1d14', skin: '#f3c59f' } });
      furn('plant', 15.2, 10.6);
      P = { RW: 16, RD: 12, door: [9.0, 11.3], counter: { x: 0.4, y: 11.2, w: 0.1, d: 0.1 }, noClerk: true };
    } else if (k === 'museum3') {   // v0.45: 3F art and history: paintings all round, a marble statue, old pots, a mummy's case
      spot('lift', 0.8, 0.1, 1.8, 0.3, { draw: 'lift', stand: [1.7, 1.4] });
      spot('art', 0.05, 3.0, 0.15, 5.0, { draw: 'paintings', stand: [1.5, 5.6] }); dec('paintings', 3.4, 0.05, 4.0, 0.15); dec('paintings', 9.0, 0.05, 4.4, 0.15);
      guest(1.6, 4.4, { face: -1, view: 'back', turn: [-1, -0.2] }); guest(5.0, 1.6, { view: 'back', turn: [0.1, -1] }); who(10.8, 1.6, { view: 'back', turn: [0, -1], scale: 0.72, look: 5 });
      dec('sculpture', 5.4, 4.6, 1.0, 1.0);
      spot('history', 8.4, 5.0, 2.4, 1.0, { draw: 'vitrine', stand: [9.6, 6.6] }); dec('vitrine', 11.6, 5.0, 1.2, 1.0, { i: 1 });
      dec('sarcophagus', 12.6, 7.8, 2.2, 1.1); guest(13.4, 9.6, { view: 'back', turn: [0.1, -1] });
      dec('bench', 4.6, 8.6, 2.4, 0.6); guest(5.4, 9.05, { pose: 'sit', seatH: 7, sit: 'read', face: -1, dz: 0.4 });
      who(8.0, 8.4, { staff: true, face: -1, view: 'front', turn: [-0.3, 1], look: { shirt: '#6b2a2a', top: 'jacket', inner: '#f4f4f0', hair: 'long', hairCol: '#c98a3c', skin: '#ffe0c4' } });
      furn('monstera', 15.2, 10.6); furn('plant', 15.2, 0.4);
      P = { RW: 16, RD: 12, door: [9.0, 11.3], counter: { x: 0.4, y: 11.2, w: 0.1, d: 0.1 }, noClerk: true };
    } else if (k === 'amuse') {   // v0.41: out in the open: the wheel and the coaster at the back, the carousel and the bumper cars, mini golf, a stage
      const ride = (key, x, y, w, d, draw, stand) => spot(key, x, y, w, d, { draw, stand, use: { at: stand, pose: 'stand', ride: key } });
      ride('wheel', 1.4, 1.2, 4.2, 1.6, 'ferris', [3.5, 3.6]);
      ride('coaster', 8.0, 0.4, 13.0, 5.4, 'coasterride', [12.6, 6.6]);
      ride('carousel', 1.4, 7.0, 4.4, 4.4, 'carouselride', [3.6, 12.2]);
      ride('bumper', 13.6, 7.8, 7.0, 4.4, 'bumpers', [17.1, 12.9]);
      spot('golf', 1.0, 13.6, 5.6, 3.2, { draw: 'minigolf', stand: [3.8, 17.3] });
      spot('stage', 15.6, 13.6, 5.2, 2.8, { draw: 'stage', stand: [18.2, 17.2] });
      spot('candy', 8.2, 13.8, 1.6, 1.0, { draw: 'candycart', stand: [9.0, 15.4] });
      dec('balloons', 11.8, 13.8, 0.6, 0.6); dec('parktree', 7.0, 7.4, 0.8, 0.8); dec('parktree', 20.6, 6.4, 0.8, 0.8); dec('parktree', 0.6, 12.4, 0.8, 0.8);
      guest(4.6, 3.9, { view: 'front', turn: [0.4, 1] }); guest(11.2, 7.0, { view: 'back', turn: [0.2, -1] }); guest(6.4, 11.8, { face: -1 }); guest(14.6, 13.0, { view: 'back', turn: [0.1, -1] });
      guest(9.6, 15.6, { face: 1 }); guest(19.2, 6.9, { view: 'front', turn: [-0.4, 1] });
      who(10.4, 8.6, { pose: 'stand', face: 1, scale: 0.72, look: 2 }); who(4.6, 15.8, { pose: 'stand', face: -1, scale: 0.72, look: 5 });
      P = { RW: 22, RD: 18, door: [11, 17.4], counter: { x: 9.4, y: 10.2, w: 3.2, d: 0.9 }, open: true };
    } else if (k === 'zoo') {   // v0.42: out in the open: six enclosures along the paths, the giraffes' feeding platform, a petting farm, the shop
      dec('path', 0.3, 5.8, 21.4, 1.2, { flat: true }); dec('path', 10.4, 5.8, 1.2, 11.8, { flat: true }); dec('path', 0.3, 12.2, 21.4, 1.2, { flat: true });
      const pen = (key, x, y, w, d, stand, ex = {}) => spot(key, x, y, w, d, { draw: 'zoopen', pen: key, stand, ...ex });
      pen('lion', 0.6, 0.4, 4.8, 5.0, [3.0, 6.4]);
      pen('elephant', 5.8, 0.4, 6.4, 5.0, [9.0, 6.4]);
      spot('giraffefeed', 12.7, 2.2, 1.9, 1.8, { draw: 'feedplatform', stand: [13.6, 6.4], use: { at: [13.8, 3.2], pose: 'stand', face: 1, prop: '🥬' } });
      pen('giraffe', 15.0, 0.4, 6.6, 5.0, [18.3, 6.4], { feedAt: [16.0, 3.4] });
      pen('penguin', 0.6, 7.4, 4.8, 4.4, [3.0, 12.8]);
      pen('monkey', 5.8, 7.4, 4.2, 4.4, [7.9, 12.8]);
      pen('petting', 12.2, 7.4, 4.6, 4.4, [14.5, 12.8], { use: { at: [14.5, 12.8], pose: 'stand', ride: 'petting' } });
      pen('panda', 17.2, 7.4, 4.4, 4.4, [19.4, 12.8]);
      spot('shop', 1.0, 14.3, 3.2, 1.4, { draw: 'zooshop', stand: [2.6, 16.6] });
      spot('kiosk', 6.2, 14.5, 1.6, 1.0, { draw: 'popcorn', stand: [7.0, 16.3] });
      dec('zoomap', 8.8, 14.6, 1.2, 0.3); dec('bench', 17.0, 15.0, 2.4, 0.6); guest(17.7, 15.4, { pose: 'sit', seatH: 7, sit: 'phone', face: -1, dz: 0.4 });
      dec('parktree', 20.6, 14.0, 0.8, 0.8); dec('parktree', 0.2, 16.6, 0.8, 0.8); dec('parktree', 12.2, 0.2, 0.8, 0.8);
      guest(3.6, 6.5, { view: 'back', turn: [0.1, -1] }); who(4.4, 6.7, { view: 'back', turn: [0.2, -1], scale: 0.72, look: 2 });
      guest(8.2, 6.6, { view: 'back', turn: [-0.1, -1] }); guest(19.0, 6.5, { view: 'back', turn: [0.1, -1] });
      guest(2.2, 12.9, { view: 'back', turn: [-0.2, -1] }); who(8.8, 12.9, { view: 'back', turn: [0.1, -1], scale: 0.72, look: 5 }); guest(20.2, 12.8, { view: 'back', turn: [0.2, -1] });
      who(5.5, 12.6, { staff: true, face: -1, prop: '🪣', look: { shirt: '#4f7a3a', top: 'polo', hat: 'cap', hatCol: '#c9b08a', hair: 'short', hairCol: '#2b1d14', skin: '#d39a6c' } });
      P = { RW: 22, RD: 18, door: [11, 17.4], counter: { x: 13.0, y: 15.0, w: 2.8, d: 0.9 }, open: true };
    } else if (k === 'stadium') {   // v0.42: tiers of seats on two sides of the field, the scoreboard in the corner; along the front the hot dog stand and the batting cage
      dec('standsback', 3.2, 0.1, 20.7, 2.9, { flat: true });
      dec('pitch', 3.7, 3.5, 19.9, 10.2, { flat: true });
      spot('board', 0.1, 0.1, 2.9, 2.9, { draw: 'scoreboard', stand: [4.4, 15.2] });
      spot('seats', 0.1, 3.1, 2.9, 11.4, { draw: 'stands', stand: [3.3, 15.0], use: { at: [3.3, 15.0], pose: 'sit', ride: 'seats' } });
      spot('hotdog', 9.4, 15.0, 1.8, 1.0, { draw: 'hotdogstand', stand: [10.3, 16.6] });
      spot('cage', 17.8, 14.7, 5.4, 2.4, { draw: 'battingcage', stand: [20.5, 17.4] });
      guest(8.2, 16.0, { face: 1 }); guest(12.6, 15.4, { view: 'back', turn: [0.3, -1] }); who(13.2, 15.7, { view: 'back', turn: [0.2, -1], scale: 0.72, look: 4 });
      guest(16.4, 16.6, { view: 'front', turn: [-0.3, 1] }); guest(23.2, 15.6, { face: -1 });
      who(11.4, 14.8, { staff: true, face: 1, prop: '🌭', look: { shirt: '#ffffff', top: 'tshirt', hat: 'cap', hatCol: '#e5484d', hair: 'curly', hairCol: '#2b1d14', skin: '#9a6440' } });
      P = { RW: 24, RD: 18, door: [13, 17.4], counter: { x: 5.0, y: 15.6, w: 2.8, d: 0.9 }, open: true };
    } else if (k === 'station') {   // the platform at the back (trains come and go), the departures board, ticket machines, a coffee kiosk, benches
      dec('rails', 0, 0.15, 16, 1.5, { flat: true }); dec('platformedge', 0, 1.65, 16, 0.35, { flat: true });
      dec('train', 0, 0.2, 16, 1.4);
      spot('watch', 5.4, 2.6, 2.4, 0.6, { draw: 'bench', stand: [6.6, 3.9], use: { at: [6.6, 2.95], pose: 'sit', face: 1, back: true, seatH: 7 } });
      dec('bench', 9.6, 2.6, 2.4, 0.6); guest(10.3, 2.95, { pose: 'sit', seatH: 7, sit: 'phone', face: 1, back: true, dz: 0.3 }); dec('luggage', 12.4, 2.7, 0.8, 0.5);
      guest(2.4, 2.4, { face: 1, view: 'back', turn: [0.2, -1] }); guest(14.2, 2.5, { face: -1, view: 'back', turn: [-0.2, -1] });
      dec('bigclock', 8.0, 2.2, 0.1, 0.1, { air: true });
      spot('board', 8.6, 4.8, 3.2, 0.3, { draw: 'departures', stand: [10.2, 5.9] });
      spot('ticket', 0.6, 4.6, 1.8, 0.6, { draw: 'ticketmachines', stand: [1.5, 5.9] }); guest(3.0, 5.6, { face: -1, view: 'back', turn: [-0.6, -1] });
      spot('kiosk', 13.0, 6.2, 2.4, 1.2, { draw: 'kiosk', stand: [14.2, 8.2] });
      who(14.2, 5.8, { staff: true, pose: 'work', face: -1, dz: -1, look: { shirt: '#2f5d50', top: 'polo', hair: 'curly', hairCol: '#2b1d14', skin: '#d39a6c' } });
      dec('bench', 5.6, 7.4, 2.4, 0.6); guest(6.2, 7.85, { pose: 'sit', seatH: 7, sit: 'read', face: -1, dz: 0.4 }); dec('luggage', 8.3, 7.5, 0.8, 0.5);
      furn('plant', 15.2, 9.8); furn('plant', 0.4, 9.8);
      P = { RW: 16, RD: 11, door: [9.0, 10.3], counter: { x: 1.0, y: 8.0, w: 3.0, d: 0.9 } };
    } else if (k === 'suite') {   // a hotel room high up: a big bed, a bath behind glass, a minibar, an armchair by the window
      spot('lift', 0.8, 0.1, 1.8, 0.3, { draw: 'lift', stand: [1.7, 1.4] });
      spot('bed', 4.0, 0.6, 2.8, 2.2, { draw: 'kingbed', stand: [5.4, 3.6], use: { at: [5.5, 1.7], pose: 'lie', lift: 10, dir: -2.68 } });
      furn('nightstand', 3.0, 0.6); furn('nightstand', 6.9, 0.6);
      dec('glass', 8.8, 0.1, 0.15, 2.8);
      spot('bath', 9.4, 0.5, 2.0, 1.0, { furn: 'bathtub', stand: [10.4, 2.3], use: { at: [10.4, 1.0], pose: 'lie', lift: 5, dir: -2.68, prop: '🫧' } });
      spot('minibar', 0.4, 3.4, 0.8, 0.8, { draw: 'minibar', stand: [1.7, 3.8] });
      furn('tv', 4.4, 5.0); furn('desk', 0.4, 6.0); dec('rug', 3.6, 3.0, 4.2, 1.8, { col: '#8a2a34', flat: true });
      spot('view', 10.2, 5.2, 1, 1, { furn: 'armchair', tint: '#b08d57', stand: [10.7, 6.8], use: { at: [10.7, 5.7], pose: 'sit', face: -1, seatH: 8.5, sit: 'chin' } });
      furn('sofa', 7.4, 7.4, { tint: '#b08d57' }); dec('luggage', 1.8, 7.6, 1.0, 0.6); furn('monstera', 11.2, 8.0);
      P = { RW: 12, RD: 9, door: [4.5, 8.3], counter: { x: 0.4, y: 8.2, w: 0.1, d: 0.1 }, sky: true, noClerk: true };
    } else {   // gas
      spot('fridge', 0.4, 0.2, 3.6, 0.7, { draw: 'drinkfridge', stand: [2.2, 1.6] });
      dec('icefreezer', 4.6, 0.3, 1.6, 0.8); dec('slushie', 6.8, 0.3, 1.1, 0.7);
      spot('shelf', 1.2, 3.2, 3.4, 0.8, { draw: 'snackshelf', stand: [2.9, 4.7] });
      dec('snackshelf', 1.2, 5.6, 3.4, 0.8); guest(2.4, 7.0, back);
      dec('hotdog', 7.2, 4.5, 0.9, 0.5, { base: 16 });
      dec('coffeebar', 9.6, 0.3, 1.8, 0.7); guest(10.4, 1.6, back); dec('atm', 11.2, 3.2, 0.6, 0.6); dec('magrack', 5.6, 3.4, 0.5, 1.2);
      furn('plant', 11.0, 7.6);
      P = { RW: 12, RD: 9, door: [3, 8.3], counter: { x: 7.0, y: 4.4, w: 3.2, d: 0.9 } };
    }
    const solids = [...wares.map(w => [w.x, w.y, w.w, w.d]), ...decor.filter(d => !d.flat && !d.air && !d.base && d.kind !== 'person').map(d => [d.x, d.y, d.w, d.d])];
    if (!P.noClerk) solids.push([P.counter.x, P.counter.y - 1.1, P.counter.w, P.counter.d + 1.1]);   // (v0.38: a hotel room has no counter)
    P = { k, n: wares.length, wares, decor, venue: true, ...P };
    { const home = VENUE_HOME[k] || (BUILDING_FLOORS[k] ? k : null), fl = home && BUILDING_FLOORS[home];   // v0.37: coming up (or down) in the lift, you step out by the lift
      if (fl) P.from = Object.fromEntries(fl.filter(f => f !== k).map(f => [f, [1.7, 1.5]])); }
    P.clerk = [P.counter.x + 1.6, P.counter.y - 0.6]; P.till = [P.counter.x + 1.6, P.counter.y + 1.55];
    P.nav = navFor(P.RW, P.RD, solids);
    SHOPS[k] = P;
    return P;
  }
  // ---------- v0.34: everyone you see indoors is somebody you can talk to ----------
  // The customers in a building or store are real people: the families and friends in your town, your coworkers,
  // and people from the next two towns over. Who sits where is picked per place and per hour, so it stays put.
  // FOLK_AT: where each of them is this frame (to walk over to them); FOLK_HOLD: shoppers who stop for you.
  let CAST = { key: '' }, FOLK_AT = {}, FOLK_HOLD = {};
  function castPool() {
    const ids = allLots(myTown()).map(l => l.id).filter(id => id !== 'me' && homeOf(id));
    if (S.job) workPeople(S.job.place).forEach(p => ids.push(p.id));
    visitorTowns().forEach(t2 => npcLots(t2).forEach(l => { if (homeOf(l.id)) ids.push(l.id); }));
    townsfolk(VIEW_TOWN).forEach(p => ids.push(p.id));   // v0.40: the people who live here
    return ids;
  }
  const onWheels = id => { const w = id && whoIs(id); return !!(w && w.look && w.look.mob === 'wheel'); };
  function castId(slot, walk) {
    const key = owner + '|' + Math.floor(now() / HOUR);
    if (CAST.key !== key) {
      const ids = castPool(), r = seeded([...key].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 2147483647, 7));
      for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      CAST = { key, ids, map: {}, n: 0 };
    }
    if (!(slot in CAST.map)) {   // the next one in the line-up (v0.36: someone on foot if walk)
      let id = null;
      for (let s2 = 0; s2 < CAST.ids.length; s2++) { const cand = CAST.ids[(CAST.n + s2) % CAST.ids.length]; if (!walk || !onWheels(cand)) { id = cand; CAST.n += s2 + 1; break; } }
      CAST.map[slot] = id;
    }
    return CAST.map[slot];
  }
  const castLook = (id, dflt) => { const w = id && whoIs(id); return w ? w.look : dflt; };
  // someone drawn indoors at room point (x, y), screen point p: remember where, make them tappable, their speech bubble
  function folkSeen(id, x, y, p, z, ts) {
    if (!id) return;
    FOLK_AT[id] = [x, y];
    hits.push({ kind: 'person', id, pri: 2, x0: p.x - 12 * z, x1: p.x + 12 * z, y0: p.y - 46 * z, y1: p.y + 4 });
    if (chatting(id)) chatBubble(p.x + 12 * z, p.y - 56 * z, z, false, ts);
  }
  // A person placed in a room (not you): standing, sitting, working out. d.cast: one of the townsfolk (tap to
  // talk); d.staff: works here (tap opens what the place offers, like the person at the counter).
  function roomPerson(d, ts, i) {
    const z = cam.z * (d.scale || 1), p = iso(d.x, d.y), id = d.cast ? castId('dec' + i + ':' + d.x, d.walk || (d.pose && d.pose !== 'stand') || !!d.lift) : null;   // v0.43: sitting, on a machine, up on something: on foot
    const L = id ? castLook(id, FOLK(i)) : typeof d.look === 'object' ? { skin: '#f3c59f', hair: 'short', hairCol: '#2b1d14', mob: 'walk', body: 'regular', ...d.look } : FOLK(d.look || i);
    drawPerson(p.x, p.y - (d.lift || 0) * z, z, { look: L, face: d.face || 1, back: !!d.back, view: d.view || null, turn: d.turn, energy: 'good', ts, seed: i + 11, pose: d.pose || 'stand', moving: !!d.moving, phase: ts / (d.pose === 'bike' ? 120 : d.pose === 'walk' ? 110 : 80) + i, noBike: true, seatH: d.seatH, sit: d.sit, dir: d.dir, matCol: '#ec6aa8' });
    if (d.prop && z > 0.35) emoji(d.prop, p.x + 10 * z, p.y - 22 * z, 9 * z);
    if (id) folkSeen(id, d.x, d.y, p, z, ts);
    else if (d.staff) hits.push({ kind: 'clerk', x0: p.x - 14 * z, x1: p.x + 14 * z, y0: p.y - 48 * z, y1: p.y + 4 });
  }
  // v0.34: the café's menu board: a dark green chalkboard in a wooden frame, hanging on the back wall, with the
  // drinks chalked on in rows (a little cup, the name, dots, the price), a heading and a doodle of a steaming cup.
  const CAFE_MENU = ['☕', '🧋', '🍰', '🥐', '🍵'], BAKERY_MENU = ['🥐', '☕', '🍩', '🧁'];
  function drawMenuBoard(d, ts) {
    const z = cam.z, { x, y } = d, base = 34, H = 40, F = [iso(x, y + d.d), iso(x + d.w, y + d.d)], k = (F[1].y - F[0].y) / ((F[1].x - F[0].x) || 1);
    [[0.12, 0.13], [0.88, 0.89]].forEach(([u]) => { const a = wallPt(F, base, u, H), b2 = wallPt(F, base, u, H + 12); line(a.x, a.y, b2.x, b2.y, '#8a8478', 0.8 * z); });   // the two wires it hangs on
    wallRect(F, base - 1, -0.02, 1.02, 0, H + 2, '#7a4f2c', 'rgba(0,0,0,.25)', 0.8);   // the frame
    wallRect(F, base - 1, 0.0, 1.0, 1.6, H + 0.4, '#5d3b20');
    wallRect(F, base, 0.03, 0.97, 1.5, H - 1.5, '#2e3d35');                            // the slate
    wallRect(F, base, 0.03, 0.97, H - 9, H - 1.5, 'rgba(255,255,255,.04)');
    if (z < 0.3) return;
    const chalk = (u, h, s, size, col = '#f4f1e6', w = 700, al = 'center') => { const p = wallPt(F, base, u, h); ctx.save(); ctx.translate(p.x, p.y); ctx.transform(1, k, 0, 1, 0, 0); ctx.font = `${w} ${Math.max(5, size * z)}px ${UI_FONT},${EMOJI_FONT}`; ctx.textAlign = al; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, 0, 0); ctx.restore(); };
    chalk(0.5, H - 5.5, 'MENU', 7.5, '#f7e9b8', 800);
    wallLine(F, base, 0.3, H - 9.2, 0.7, H - 9.2, 'rgba(247,233,184,.7)', 0.6);
    const rows = [['☕', t('menu_latte')], ['🍵', t('menu_matcha')], ['🧋', t('menu_boba')], ['🍋', t('menu_lemon')]];
    rows.forEach(([e, name], i) => {
      const h = H - 13.5 - i * 6.3;
      chalk(0.1, h, e, 4.6, '#fff', 400);
      chalk(0.17, h, name, 4.4, '#f4f1e6', 700, 'left');
      chalk(0.92, h, String(SNACK.price), 4.4, '#ffd36b', 800, 'right');
      for (let u = 0.52; u < 0.8; u += 0.05) { const p = wallPt(F, base, u, h - 0.6); circle(p.x, p.y, 0.35 * z, 'rgba(244,241,230,.45)'); }
    });
    // a little chalk cup with steam in the corner
    const c0 = wallPt(F, base, 0.8, H - 9.5);
    ctx.save(); ctx.strokeStyle = 'rgba(244,241,230,.75)'; ctx.lineWidth = 0.7 * z; ctx.beginPath(); ctx.moveTo(c0.x - 3 * z, c0.y - 1.5 * z); ctx.lineTo(c0.x - 2.2 * z, c0.y + 2.5 * z); ctx.lineTo(c0.x + 2.2 * z, c0.y + 3.3 * z); ctx.lineTo(c0.x + 3 * z, c0.y); ctx.stroke();
    const st = (ts / 600) % 1; ctx.globalAlpha = 0.6 * (1 - st); ctx.beginPath(); ctx.moveTo(c0.x, c0.y - 2.5 * z); ctx.quadraticCurveTo(c0.x + 1.4 * z, c0.y - 3.6 * z - st * 1 * z, c0.x, c0.y - 4.6 * z - st * 1.4 * z); ctx.stroke(); ctx.restore();
  }
  // v0.36: the things that make each building feel full. d: { x, y, w, d } on the floor (or on a wall: y ≈ 0 is the
  // back wall, x ≈ 0 the left one; d.base lifts it, e.g. onto a counter). d.busy: someone's using it (it moves).
  // Returns false for kinds it doesn't know.
  // v0.38: the station's departures board: the next three trains to the towns nearby
  function trainBoard() {
    const nb = visitorTowns().map(id => nm(COMMUNITIES[id])), d0 = new Date(), m0 = d0.getHours() * 60 + d0.getMinutes(), slot = Math.ceil((m0 + 1) / 20) * 20;
    return [curLang() === 'zh' ? '出发 DEPARTURES' : 'DEPARTURES', ...[0, 1, 2].map(k2 => { const m = slot + k2 * 20; return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}  ${nb[k2 % Math.max(1, nb.length)] || ''}`; })];
  }
  function drawRoomThing(d, ts, i) {
    const z = cam.z, { x, y } = d, c = iso(x + d.w / 2, y + d.d / 2), t = ts / 1000, base = d.base || 0;
    const busy = d.busy || (d.kind === 'spot' && meS.use && !meS.moving && meS.use.k === d.k);
    const F = d.w >= d.d ? [iso(x, y + d.d), iso(x + d.w, y + d.d)] : [iso(x + d.w, y + d.d), iso(x + d.w, y)];   // the face you see
    const slope = (F[1].y - F[0].y) / ((F[1].x - F[0].x) || 1);
    const txt = (u, h, s, size, col, w = 800) => { const p = wallPt(F, base, u, h); ctx.save(); ctx.translate(p.x, p.y); ctx.transform(1, slope, 0, 1, 0, 0); ctx.font = `${w} ${Math.max(5, size * z)}px ${UI_FONT},${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, 0, 0); ctx.restore(); };
    const P = (px, py, h) => up(iso(px, py), (base + h) * z);
    switch (d.draw || d.kind) {
      // ----- the gym -----
      case 'elliptical': {
        box(x + 0.2, y + 0.15, d.w - 0.4, d.d - 0.3, 5, '#2d2d34', 0, { top: '#3a3a44' });
        box(x + 0.38, y + 0.12, 0.24, 0.22, 40, '#454a55', 5, { shadow: false });
        const sc = P(x + d.w / 2, y + 0.23, 50); rrect(sc.x - 7 * z, sc.y - 5 * z, 14 * z, 9 * z, 2 * z, '#1b2a3a', '#9aa3ad', 0.6 * z); rrect(sc.x - 5.5 * z, sc.y - 3.5 * z, 11 * z, 6 * z, 1 * z, busy ? '#38d39f' : '#2f4a5a');
        const sw = busy ? Math.sin(ts / 300 + x * 3) : 0;
        [-0.26, 0.26].forEach((s2, k) => { const a = P(x + d.w / 2 + s2, y + 0.95 + (k ? sw : -sw) * 0.18, 8), b = P(x + d.w / 2 + s2, y + 0.45 + (k ? -sw : sw) * 0.12, 42); line(a.x, a.y, b.x, b.y, '#9aa3ad', 1.8 * z); ellipse(a.x, a.y, 3.4 * z, 1.5 * z, '#2d2d34'); });
        return true;
      }
      case 'rower': {   // along x: the seat at the near end, foot plates, the flywheel at the far end
        box(x + 0.1, y + 0.24, d.w - 0.2, 0.12, 3, '#b9c1ca', 0, { top: '#d6dce2' });
        box(x + 0.25, y + 0.17, 0.36, 0.26, 5, '#e5484d', 0, { shadow: false, top: '#f06a6e' });
        [0.13, 0.4].forEach(v => box(x + 0.82, y + v, 0.18, 0.12, 4, '#454a55', 0, { shadow: false }));
        box(x + 1.15, y + 0.08, 0.55, 0.44, 13, '#2d2d34', 0, { top: '#3a3a44' });
        const fw = P(x + 1.42, y + 0.52, 7), sp = busy ? ts / 120 : 0; ellipse(fw.x, fw.y, 5.4 * z, 5.4 * z, '#454a55', '#9aa3ad', 0.7 * z);
        for (let k = 0; k < 3; k++) { const a = sp + k * 2.09; line(fw.x, fw.y, fw.x + Math.cos(a) * 4.5 * z, fw.y + Math.sin(a) * 4.5 * z, '#9aa3ad', 0.8 * z); }
        return true;
      }
      case 'squatrack': {   // a power rack on a wooden platform; the bar rests on the hooks unless you're squatting with it
        flatRect(x - 0.1, y - 0.1, d.w + 0.2, d.d + 0.2, '#9a7048', 'rgba(0,0,0,.15)');
        const U = [[0.05, 0.15], [d.w - 0.17, 0.15], [0.05, d.d - 0.27], [d.w - 0.17, d.d - 0.27]];
        U.forEach(([dx, dy], k) => { if (k < 2) box(x + dx, y + dy, 0.12, 0.12, 64, '#2d2d34', 0, { shadow: false }); });
        const top = (dx, dy) => up(iso(x + dx, y + dy), 64 * z);
        [[U[0], U[1]], [U[0], U[2]], [U[1], U[3]]].forEach(([a, b]) => { const A = top(a[0] + 0.06, a[1] + 0.06), B2 = top(b[0] + 0.06, b[1] + 0.06); line(A.x, A.y, B2.x, B2.y, '#2d2d34', 2.2 * z); });
        if (!busy) { const a = up(iso(x + 0.35, y + 0.15), 38 * z), b = up(iso(x + 0.35, y + d.d - 0.15), 38 * z); line(a.x, a.y, b.x, b.y, '#c9cfd6', 1.6 * z); [a, b].forEach(q => { ellipse(q.x, q.y, 3 * z, 7 * z, '#2d2d34', '#5b6470', 0.6 * z, -0.5); }); }
        U.forEach(([dx, dy], k) => { if (k >= 2) box(x + dx, y + dy, 0.12, 0.12, 64, '#2d2d34', 0, { shadow: false }); });
        return true;
      }
      case 'ropes': {   // two heavy ropes from your hands to a post; they wave when someone's at it
        const ax = x + d.w - 0.25, ay = y + d.d / 2;
        [-0.13, 0.13].forEach((o, k) => {
          let prev = null;
          for (let s2 = 0; s2 <= 18; s2++) {
            const u = s2 / 18, px = x + 0.5 + (ax - x - 0.5) * u, h = busy ? (12 - 8 * u) + Math.sin(u * Math.PI * 3.2 - ts / 85 + k * Math.PI) * 6 * (1 - u * 0.7) : 1.2 + (u > 0.95 ? 3 : 0);
            const q = up(iso(px, ay + o * (1 - u * 0.6)), h * z);
            if (prev) line(prev.x, prev.y, q.x, q.y, '#3b3125', 2.4 * z); prev = q;
          }
        });
        box(ax - 0.15, ay - 0.18, 0.3, 0.36, 9, '#5b6470', 0, { top: '#9aa3ad' });
        return true;
      }
      case 'cable': {   // a cable crossover: two weight towers, a bar across the top, handles on cables
        [0, d.w - 0.4].forEach(dx => { const b = box(x + dx, y, 0.4, d.d, 66, '#454a55', 0, { top: '#5b6470' }); for (let k = 0; k < 8; k++) wallRect(b.left, 0, 0.2, 0.8, 6 + k * 3.2, 8.2 + k * 3.2, '#2d2d34'); });
        const a = up(iso(x + 0.2, y + d.d / 2), 66 * z), b = up(iso(x + d.w - 0.2, y + d.d / 2), 66 * z); line(a.x, a.y, b.x, b.y, '#454a55', 2.6 * z);
        [[x + 0.45, 0.4], [x + d.w - 0.45, -0.4]].forEach(([hx]) => { const t0 = up(iso(hx, y + d.d / 2), 60 * z), h0 = up(iso(hx, y + d.d + 0.4), 30 * z); line(t0.x, t0.y, h0.x, h0.y, 'rgba(40,40,46,.7)', 0.7 * z); rrect(h0.x - 2.5 * z, h0.y - 1 * z, 5 * z, 2 * z, 1 * z, '#e5484d'); });
        return true;
      }
      case 'kbrack': {
        const b = box(x, y, d.w, d.d, 16, '#454a55', 0, { top: '#5b6470' });
        ['#e5484d', '#f2c230', '#34b27b', '#38a3e0', '#a46ef0'].forEach((col, k) => { const q = up(iso(x + (k + 0.5) * d.w / 5, y + d.d / 2), 16 * z), r = (2.6 + k * 0.5) * z; circle(q.x, q.y - r, r, col, 'rgba(0,0,0,.35)', 0.6 * z); ellipse(q.x, q.y - r * 2 - 0.6 * z, r * 0.6, r * 0.45, null, col, 1.2 * z); });
        wallRect(b.left, 0, 0.04, 0.96, 6, 7.5, '#2d2d34');
        return true;
      }
      case 'platetree': {
        box(x + 0.22, y + 0.22, 0.16, 0.16, 34, '#2d2d34', 0, { shadow: false }); ellipse(c.x, c.y, 9 * z, 4 * z, 'rgba(0,0,0,.18)');
        [[8, 1, 7], [8, -1, 7], [18, 1, 6], [18, -1, 6], [28, 1, 4.6]].forEach(([h, s2, r]) => { const q = up(iso(x + 0.3 + s2 * 0.18, y + 0.3 - s2 * 0.18), h * z); ellipse(q.x, q.y, r * 0.45 * z, r * z, '#2d2d34', '#5b6470', 0.7 * z, 0.4); });
        return true;
      }
      case 'plyo': {
        box(x, y, d.w, d.d, 12, '#c99a6b', 0, { top: '#d8b07e' }); box(x + 0.1, y + 0.1, d.w * 0.7, d.d * 0.7, 10, '#b88552', 12, { top: '#d8b07e', shadow: false }); box(x + 0.15, y + 0.15, d.w * 0.45, d.d * 0.45, 8, '#a6743f', 22, { top: '#d8b07e', shadow: false });
        return true;
      }
      case 'medballs': { box(x, y, d.w, d.d, 5, '#454a55', 0); ['#e5484d', '#2d2d34', '#38a3e0'].forEach((col, k) => { const q = up(iso(x + (k + 0.5) * d.w / 3, y + d.d / 2), 5 * z); circle(q.x, q.y - 4.5 * z, 4.5 * z, col, 'rgba(0,0,0,.35)', 0.6 * z); line(q.x - 4 * z, q.y - 4.5 * z, q.x + 4 * z, q.y - 4.5 * z, 'rgba(255,255,255,.4)', 0.6 * z); }); return true; }
      case 'rubber': flatRect(x, y, d.w, d.d, d.col || '#2f343b'); flatRect(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, null, 'rgba(242,194,48,.5)'); return true;
      case 'towels': { const b = box(x, y, d.w, d.d, 30, '#e8e2d6', 0, { top: '#f4efe6' }); [6, 15, 24].forEach(h => [0, 1, 2, 3].forEach(k => { const q = wallPt(b.left, 0, (k + 0.5) / 4, h); ellipse(q.x, q.y, 3.4 * z, 2.6 * z, k % 2 ? '#ffffff' : '#9fd6d2', 'rgba(0,0,0,.15)', 0.5 * z); })); return true; }
      case 'foam': { ['#38a3e0', '#ec6aa8'].forEach((col, k) => { const a = iso(x + 0.15, y + 0.15 + k * 0.3), b = iso(x + 0.75, y + 0.15 + k * 0.3); line(a.x, a.y - 3 * z, b.x, b.y - 3 * z, col, 5.5 * z); }); const q = iso(x + d.w - 0.1, y + d.d / 2); circle(q.x, q.y - 8 * z, 8 * z, '#a46ef0', 'rgba(0,0,0,.25)', 0.6 * z); ellipse(q.x - 3 * z, q.y - 11 * z, 2.5 * z, 1.5 * z, 'rgba(255,255,255,.45)'); return true; }
      case 'gymbench': { [0.15, d.d - 0.3].forEach(v => box(x + 0.15, y + v, d.w - 0.3, 0.15, 5, '#2d2d34', 0, { shadow: false })); box(x, y, d.w, d.d, 2.4, '#2d2d34', 5, { top: '#e5484d' }); return true; }
      case 'pendant': {   // a lamp hanging over a table
        const top = up(c, 86 * z), sh = up(c, 60 * z); line(top.x, top.y, sh.x, sh.y, 'rgba(60,50,40,.55)', 0.7 * z);
        pg([[sh.x - 3 * z, sh.y], [sh.x + 3 * z, sh.y], [sh.x + 8 * z, sh.y + 7 * z], [sh.x - 8 * z, sh.y + 7 * z]], d.col || '#2d2d2d');
        ellipse(sh.x, sh.y + 7 * z, 8 * z, 2.2 * z, '#fff2c4'); if (NIGHT > 0.2) glow(sh.x, sh.y + 9 * z, 40 * z, 0.5);
        return true;
      }
      // ----- the bakery and the café -----
      case 'kneadtable': {
        box(x, y, d.w, d.d, 15, '#c99a6b', 0, { top: '#e6c79a' });
        const tp = (u, v) => up(iso(x + u * d.w, y + v * d.d), 15 * z);
        [[0.25, 0.5], [0.5, 0.35], [0.72, 0.6]].forEach(([u, v], k) => { const q = tp(u, v); ellipse(q.x, q.y - 1.5 * z, (4.5 - k * 0.6) * z, 2.6 * z, '#f6ead4', 'rgba(150,120,80,.4)', 0.6 * z); });
        const r0 = tp(0.62, 0.15), r1 = tp(0.95, 0.4); line(r0.x, r0.y - 1.5 * z, r1.x, r1.y - 1.5 * z, '#a46e40', 2.4 * z);
        for (let k = 0; k < 7; k++) { const q = tp(hash(k, 3), hash(k, 7)); circle(q.x, q.y, 0.7 * z, 'rgba(255,255,255,.75)'); }
        return true;
      }
      case 'cakestand': { box(x + 0.2, y + 0.2, d.w - 0.4, d.d - 0.4, 22, '#f4efe6', 0, { top: '#ffffff' }); const q = up(c, 22 * z); ellipse(q.x, q.y - 3 * z, 9 * z, 4 * z, '#f7c6d9', '#e89bb8', 0.6 * z); ellipse(q.x, q.y - 8 * z, 6.5 * z, 3 * z, '#fff6e2', '#e8d3a8', 0.6 * z); emoji('🍓', q.x, q.y - 9 * z, 6 * z); ellipse(q.x, q.y - 6 * z, 11 * z, 11 * z, 'rgba(200,230,250,.18)', 'rgba(255,255,255,.75)', 0.8 * z); return true; }
      case 'flour': { [[0, 0], [0.4, 0.05], [0.2, 0.4]].forEach(([u, v], k) => { const b = box(x + u * d.w, y + v * d.d, d.w * 0.55, d.d * 0.5, 13 - k, '#efe6d2', k === 2 ? 11 : 0, { top: '#f7f0e0', shadow: k !== 2 }); const q = wallPt(b.left, k === 2 ? 11 : 0, 0.5, 6); emoji('🌾', q.x, q.y + 2 * z, 6 * z); }); return true; }
      case 'breadbaskets': { [0.25, 0.75].forEach(v => { const q = iso(x + d.w / 2, y + v * d.d); ellipse(q.x, q.y - 3 * z, 10 * z, 5 * z, '#c8954f', '#9a6a34', 0.8 * z); emoji('🥖', q.x - 2 * z, q.y - 2 * z, 10 * z); emoji('🍞', q.x + 4 * z, q.y - 1 * z, 8 * z); }); return true; }
      case 'espresso': {   // on the counter: a shiny machine with cups on top, steam now and then
        const b = box(x, y, d.w * 0.75, d.d, 15, '#c9cfd6', base, { top: '#e8ecf0' }); wallRect(b.left, base, 0.15, 0.85, 3, 6, '#5b6470');
        [0.3, 0.6].forEach(u => { const q = wallPt(b.left, base, u, 2); rrect(q.x - 2 * z, q.y - 3 * z, 4 * z, 3 * z, 1 * z, '#fffaf0'); });
        [0.2, 0.45, 0.7].forEach(u => { const q = up(iso(x + u * d.w * 0.75, y + d.d / 2), (base + 15) * z); rrect(q.x - 1.8 * z, q.y - 3 * z, 3.6 * z, 3 * z, 0.8 * z, '#fffaf0', 'rgba(0,0,0,.2)', 0.4 * z); });
        box(x + d.w * 0.8, y + 0.1, d.w * 0.2, d.d * 0.6, 12, '#2d2d34', base, { shadow: false });
        if (busy) for (let k = 0; k < 2; k++) { const u = (ts / 1400 + k / 2) % 1, q = up(iso(x + 0.3, y + d.d / 2), (base + 16 + u * 18) * z); circle(q.x + Math.sin(u * 6) * 2 * z, q.y, (2 + u * 4) * z, `rgba(245,245,245,${0.55 * (1 - u)})`); }
        return true;
      }
      case 'minicase': { const b = box(x, y, d.w, d.d, 9, '#e6dfd1', base, { top: '#f6f1e8' }); ['🍰', '🧁', '🍪'].forEach((e, k) => { const q = up(iso(x + (k + 0.5) * d.w / 3, y + d.d / 2), (base + 10) * z); emoji(e, q.x, q.y, 7 * z); }); const g0 = up(iso(x, y + d.d), (base + 9) * z), g1 = up(iso(x + d.w, y + d.d), (base + 9) * z); poly([g0, g1, up(g1, 8 * z), up(g0, 8 * z)], 'rgba(200,230,250,.22)', 'rgba(255,255,255,.7)', 1); return true; }
      // ----- the clinic -----
      case 'eyechart': { wallRect(F, 26, 0.05, 0.95, 0, 30, '#ffffff', 'rgba(0,0,0,.2)', 0.6); ['E', 'F P', 'T O Z', 'L P E D'].forEach((s2, k) => txt(0.5, 50 - k * 6.5, s2, 6.5 - k * 1.2, '#2d2d2d')); return true; }
      case 'xray': { wallRect(F, 30, 0.05, 0.95, 0, 20, '#dfe9f3', '#9aa3ad', 0.8); wallRect(F, 30, 0.12, 0.48, 3, 17, '#1b2a3a'); wallRect(F, 30, 0.52, 0.88, 3, 17, '#1b2a3a'); txt(0.3, 40, '🦴', 7, '#fff', 400); txt(0.7, 40, '🫁', 7, '#fff', 400); return true; }
      case 'ivstand': { const a = iso(x + 0.25, y + 0.25), b = up(a, 52 * z); ellipse(a.x, a.y, 6 * z, 2.5 * z, '#9aa3ad'); line(a.x, a.y, b.x, b.y, '#c9cfd6', 1.4 * z); line(b.x - 5 * z, b.y, b.x + 5 * z, b.y, '#c9cfd6', 1.2 * z); rrect(b.x + 1 * z, b.y + 1 * z, 5 * z, 8 * z, 1.5 * z, 'rgba(200,230,250,.85)', '#9aa3ad', 0.5 * z); return true; }
      case 'medcart': { const b = box(x, y, d.w, d.d, 22, '#ffffff', 0, { top: '#eef2f5' }); [5, 12].forEach(h => wallRect(b.left, 0, 0.08, 0.92, h, h + 5, '#dfe9f3', '#9aa3ad', 0.5)); const q = up(c, 22 * z); emoji('🩹', q.x - 3 * z, q.y, 6 * z); emoji('💊', q.x + 4 * z, q.y, 6 * z); return true; }
      case 'magazines': { box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 20, '#a46e40', 0, { top: '#c99a6b' }); [6, 13].forEach((h, k) => ['#e5484d', '#38a3e0', '#f2c230'].forEach((col, j) => { const q = up(iso(x + 0.2 + j * 0.13, y + d.d - 0.1), h * z); rrect(q.x - 2 * z, q.y - 5 * z, 4 * z, 5 * z, 0.5 * z, col); })); return true; }
      case 'tvwall': { wallRect(F, 32, 0.05, 0.95, 0, 22, '#1d1d22', '#454a55', 1); wallRect(F, 32, 0.1, 0.9, 2, 20, `hsl(${(ts / 80) % 360},55%,62%)`); txt(0.5, 43, '❤️ 💪 🥦', 6, '#fff', 400); return true; }
      case 'kidsplay': { flatRect(x, y, d.w, d.d, '#f2d24b'); flatRect(x + 0.15, y + 0.15, d.w - 0.3, d.d - 0.3, null, 'rgba(255,255,255,.6)'); [['#e5484d', 0.2, 0.2], ['#38a3e0', 0.55, 0.3], ['#34b27b', 0.3, 0.8], ['#a46ef0', 1.1, 1.0]].forEach(([col, u, v], k) => box(x + u, y + v, 0.3, 0.3, 6, col, k === 3 ? 0 : 0, { shadow: false })); const q = iso(x + 1.2, y + 0.4); emoji('🧸', q.x, q.y - 4 * z, 10 * z); return true; }
      case 'wheelchair': { const a = iso(x + 0.25, y + 0.4), b = iso(x + 0.6, y + 0.4); [a, b].forEach(q => ellipse(q.x, q.y - 7 * z, 3 * z, 7 * z, null, '#5b6470', 1.6 * z)); box(x + 0.2, y + 0.15, 0.45, 0.5, 2, '#38a3e0', 9, { shadow: false }); box(x + 0.2, y + 0.15, 0.08, 0.5, 12, '#38a3e0', 11, { shadow: false }); return true; }
      // ----- the library -----
      case 'ladder': { const a = iso(x + 0.1, y + d.d), b = iso(x + d.w - 0.1, y + d.d), top = h => up(iso(x + 0.1 + (d.w - 0.2) * h, y), 56 * z); const a2 = up(iso(x + 0.1, y), 56 * z), b2 = up(iso(x + d.w - 0.1, y), 56 * z); line(a.x, a.y, a2.x, a2.y, '#8a5a36', 1.6 * z); line(b.x, b.y, b2.x, b2.y, '#8a5a36', 1.6 * z); for (let k = 1; k < 7; k++) { const u = k / 7, p0 = { x: a.x + (a2.x - a.x) * u, y: a.y + (a2.y - a.y) * u }, p1 = { x: b.x + (b2.x - b.x) * u, y: b.y + (b2.y - b.y) * u }; line(p0.x, p0.y, p1.x, p1.y, '#a46e40', 1.2 * z); } return true; }
      case 'bookcart': { box(x, y, d.w, d.d, 18, '#38a3e0', 4, { top: '#5aa2e0' }); [0.15, 0.85].forEach(u => { const q = iso(x + u * d.w, y + d.d); circle(q.x, q.y - 2 * z, 2 * z, '#2d2d34'); }); for (let k = 0; k < 6; k++) { const q = up(iso(x + 0.1 + k * 0.14, y + d.d / 2), 22 * z); rrect(q.x - 1.4 * z, q.y - 8 * z, 2.8 * z, 8 * z, 0.4 * z, ['#e5484d', '#f2c230', '#34b27b', '#a46ef0', '#f59e0b', '#2f6fb2'][k]); } return true; }
      case 'newsrack': { box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 24, '#8a5a36', 0, { top: '#a46e40' }); [8, 16].forEach(h => { const q = up(iso(x + d.w / 2, y + d.d - 0.1), h * z); rrect(q.x - 5 * z, q.y - 6 * z, 10 * z, 6 * z, 0.6 * z, '#f4f1ea', '#9aa3ad', 0.4 * z); line(q.x - 3.5 * z, q.y - 4 * z, q.x + 3.5 * z, q.y - 4 * z, '#5b6470', 0.6 * z); }); return true; }
      // ----- the post office -----
      case 'stanchions': { const pts = [[x, y], [x + d.w, y], [x + d.w, y + d.d], [x, y + d.d]], tops = pts.map(([px, py]) => up(iso(px, py), 18 * z)); [[0, 1], [3, 2]].forEach(([a, b]) => { const A = tops[a], B2 = tops[b], M = { x: (A.x + B2.x) / 2, y: (A.y + B2.y) / 2 + 4 * z }; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.quadraticCurveTo(M.x, M.y + 2 * z, B2.x, B2.y); ctx.strokeStyle = '#c0453a'; ctx.lineWidth = 1.6 * z; ctx.stroke(); }); pts.forEach(([px, py]) => { const g = iso(px, py); ellipse(g.x, g.y, 4 * z, 1.8 * z, '#9a8a5a'); line(g.x, g.y, g.x, g.y - 18 * z, '#d9b45a', 1.6 * z); circle(g.x, g.y - 18 * z, 1.6 * z, '#d9b45a'); }); return true; }
      case 'packtable': { box(x, y, d.w, d.d, 14, '#b9c1ca', 0, { top: '#d6dce2' }); [[0.2, 0.3, 8], [0.5, 0.5, 6], [0.78, 0.35, 10]].forEach(([u, v, h]) => box(x + u * d.w - 0.2, y + v * d.d - 0.15, 0.4, 0.3, h, '#c99a6b', 14, { top: '#d8b07e', shadow: false })); const q = up(iso(x + 0.9 * d.w, y + 0.8 * d.d), 14 * z); circle(q.x, q.y - 2 * z, 2.5 * z, null, '#8a6a4a', 1.4 * z); return true; }
      case 'mailcart': { box(x, y, d.w, d.d, 18, '#5aa2e0', 4, { top: '#8ec5f0' }); [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]].forEach(([u, v]) => { const q = iso(x + u * d.w, y + v * d.d); circle(q.x, q.y - 1.5 * z, 1.6 * z, '#2d2d34'); }); for (let k = 0; k < 5; k++) { const q = up(iso(x + d.w / 2, y + 0.15 + k * 0.2), 22 * z); rrect(q.x - 5 * z, q.y - 4 * z, 10 * z, 4 * z, 0.5 * z, k % 2 ? '#fffaf0' : '#f2e3c4', '#c9b98f', 0.4 * z); } return true; }
      case 'stampposter': { wallRect(F, base, 0.0, 1.0, 0, 22, '#fffaf0', '#c9b98f', 0.8); ['🌸', '🦅', '🗽', '🌻'].forEach((e, k) => txt(0.15 + k * 0.23, 11, e, 7, '#000', 400)); return true; }
      // ----- the school and the town hall -----
      case 'abc': { 'ABCDEFGHIJKL'.split('').forEach((ch, k) => { const u0 = k / 12 + 0.008, u1 = (k + 1) / 12 - 0.008; wallRect(F, 62, u0, u1, 0, 9, ['#e5484d', '#f59e0b', '#f2c230', '#34b27b', '#38a3e0', '#a46ef0'][k % 6]); txt((u0 + u1) / 2, 66.5, ch, 6, '#ffffff'); }); return true; }
      case 'worldmap': { wallRect(F, 24, 0, 1, 0, 24, '#8ec5f0', '#8a5a36', 1.2); [[0.25, 14, '🌎'], [0.6, 12, '🌍'], [0.85, 15, '🌏']].forEach(([u, h, e]) => txt(u, 24 + h, e, 8, '#000', 400)); return true; }
      case 'clock': { const q = wallPt(F, 54, 0.5, 0); ellipse(q.x, q.y, 6 * z, 6.6 * z, '#ffffff', '#2d2d2d', 1.2 * z); const hh = new Date(now()).getHours() % 12, mm = new Date(now()).getMinutes(); const ha = (hh + mm / 60) / 12 * Math.PI * 2 - Math.PI / 2, ma = mm / 60 * Math.PI * 2 - Math.PI / 2; line(q.x, q.y, q.x + Math.cos(ha) * 3 * z, q.y + Math.sin(ha) * 3 * z, '#2d2d2d', 1.2 * z); line(q.x, q.y, q.x + Math.cos(ma) * 4.6 * z, q.y + Math.sin(ma) * 4.6 * z, '#2d2d2d', 0.8 * z); return true; }
      case 'cubbies': { const b = box(x, y, d.w, d.d, 34, '#c99a6b', 0, { top: '#d8b07e' }); for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) { wallRect(b.right, 0, k / 5 + 0.02, (k + 1) / 5 - 0.02, 4 + r * 15, 16 + r * 15, '#a46e40'); if ((k + r) % 3 !== 2) { const q = wallPt(b.right, 0, (k + 0.5) / 5, 8 + r * 15); emoji('🎒', q.x, q.y + 2 * z, 8 * z); } } return true; }
      case 'frames': { [0.15, 0.5, 0.85].forEach((u, k) => { wallRect(F, 30, u - 0.12, u + 0.12, 0, 20, '#c9a36a', '#8a6a3a', 0.8); wallRect(F, 30, u - 0.09, u + 0.09, 2.5, 17.5, ['#dfe9f3', '#f3e6d3', '#e3eed8'][k]); txt(u, 40, ['👨‍💼', '🏛️', '👩‍💼'][k], 8, '#000', 400); }); return true; }
      case 'numscreen': { wallRect(F, 42, 0.05, 0.95, 0, 14, '#1d1d22', '#454a55', 1); txt(0.5, 49, `A${String(20 + Math.floor(ts / 9000) % 60).padStart(3, '0')}`, 8, '#ff5a4f'); return true; }
      case 'counter2': { const b = box(x, y, d.w, d.d, 16, '#c9a36a', 0, { top: '#e6c79a' }); const g0 = up(iso(x, y + d.d * 0.3), 16 * z), g1 = up(iso(x + d.w, y + d.d * 0.3), 16 * z); poly([g0, g1, up(g1, 20 * z), up(g0, 20 * z)], 'rgba(200,230,250,.22)', 'rgba(255,255,255,.7)', 1); const q = up(iso(x + 0.4, y + d.d * 0.7), 16 * z); emoji('🖋️', q.x, q.y, 7 * z); wallRect(b.left, 0, 0.35, 0.65, 8, 13, '#2f6fb2'); return true; }
      case 'ticketmachine': { box(x + 0.05, y + 0.05, d.w - 0.1, d.d - 0.1, 34, '#e8ecf0', 0, { top: '#ffffff' }); const q = up(c, 30 * z); rrect(q.x - 4 * z, q.y - 4 * z, 8 * z, 6 * z, 1 * z, '#38a3e0'); rrect(q.x - 2 * z, q.y + 6 * z, 4 * z, 2 * z, 0.5 * z, '#fffaf0'); return true; }
      // ----- the police and the fire station -----
      case 'coffeemaker': { box(x, y, d.w, d.d, 16, '#8a5a36', 0, { top: '#a46e40' }); const q = up(iso(x + 0.35, y + d.d / 2), 16 * z); rrect(q.x - 3 * z, q.y - 9 * z, 6 * z, 9 * z, 1 * z, '#2d2d34'); ellipse(q.x, q.y - 2 * z, 2.6 * z, 1.2 * z, '#6b4428'); const q2 = up(iso(x + 0.8, y + d.d / 2), 16 * z); emoji('🍩', q2.x, q2.y, 7 * z); return true; }
      case 'filecab': { const b = box(x, y, d.w, d.d, 34, '#9aa3ad', 0, { top: '#b9c1ca' }); for (let k = 0; k < 3; k++) for (let r = 0; r < 3; r++) { wallRect(b.right, 0, k / 3 + 0.03, (k + 1) / 3 - 0.03, 3 + r * 10, 11 + r * 10, '#b9c1ca', 'rgba(0,0,0,.25)', 0.6); const q = wallPt(b.right, 0, (k + 0.5) / 3, 9 + r * 10); line(q.x - 2 * z, q.y, q.x + 2 * z, q.y, '#5b6470', 1 * z); } return true; }
      case 'k9': { const q = iso(x + d.w / 2, y + d.d / 2); ellipse(q.x, q.y, 18 * z, 8 * z, '#24324f', '#1b2538', 1 * z); ellipse(q.x, q.y - 1 * z, 13 * z, 5.5 * z, '#3b4b6b'); const lie = Math.sin(t * 0.4) > -0.3; drawAnimal('dog', 2, q.x, q.y + 2 * z, z * 1.5, { face: -1, ts, seed: 3, breed: 'husky', moving: false, mood: lie ? 'happy' : 'happy' }); return true; }
      case 'ambulance': {   // a rescue truck: white, a red stripe, lights on top
        const L = d.d, b = box(x + 0.1, y, d.w - 0.2, L, 30, '#f4f4f0', 4, { top: '#ffffff' }); box(x + 0.15, y + L - 1.3, d.w - 0.3, 1.2, 12, '#e8e8e2', 34, { top: '#ffffff' });
        wallRect(b.right, 4, 0.02, 0.98, 12, 16, '#e5484d'); wallRect(b.left, 4, 0.1, 0.9, 16, 26, 'rgba(190,225,245,.8)');
        [0.18, 0.78].forEach(u => { const q = wallPt(b.right, 0, u, 4); ellipse(q.x, q.y, 6 * z, 7 * z, '#2b2b2e'); ellipse(q.x, q.y, 2.5 * z, 3 * z, '#9aa3ad'); });
        const q = wallPt(b.right, 4, 0.45, 22); emoji('➕', q.x, q.y + 3 * z, 9 * z);
        const lb = up(iso(x + d.w / 2, y + L - 0.6), 48 * z), on = Math.floor(ts / 350) % 2; rrect(lb.x - 9 * z, lb.y - 2 * z, 8 * z, 4 * z, 1.5 * z, on ? '#ff4d4d' : '#8a2020'); rrect(lb.x + 1 * z, lb.y - 2 * z, 8 * z, 4 * z, 1.5 * z, on ? '#3d6fd8' : '#4d8cff');
        return true;
      }
      case 'gearrack': { const b = box(x, y, d.w, d.d, 4, '#5b6470', 0); for (let k = 0; k < 4; k++) { const u = (k + 0.5) / 4, top = wallPt(b.right, 0, u, 52); line(top.x - 4 * z, top.y, top.x + 4 * z, top.y, '#9aa3ad', 1.2 * z); rrect(top.x - 6 * z, top.y + 1 * z, 12 * z, 20 * z, 3 * z, '#c9a24a', '#8a6a2a', 0.8 * z); wallRect(b.right, 0, u - 0.08, u + 0.08, 38, 40, '#e8e2d6'); ellipse(top.x, top.y - 3 * z, 5 * z, 3 * z, k % 2 ? '#f2c230' : '#c9433b'); const bt = wallPt(b.right, 0, u, 6); rrect(bt.x - 4 * z, bt.y - 6 * z, 8 * z, 7 * z, 1.5 * z, '#2d2d2d'); } return true; }
      case 'extinguishers': { [0.25, 0.75].forEach(v => { const q = iso(x + d.w / 2, y + v * d.d); rrect(q.x - 3 * z, q.y - 16 * z, 6 * z, 16 * z, 3 * z, '#e5484d', '#8a2020', 0.6 * z); rrect(q.x - 1.5 * z, q.y - 19 * z, 3 * z, 3 * z, 0.8 * z, '#2d2d2d'); }); return true; }
      // ----- the petrol station -----
      case 'slushie': { box(x, y, d.w, d.d, 20, '#c9cfd6', 0, { top: '#e8ecf0' }); [['#e5484d', 0.28], ['#38a3e0', 0.72]].forEach(([col, u]) => { const q = up(iso(x + u * d.w, y + d.d / 2), 20 * z); rrect(q.x - 5 * z, q.y - 16 * z, 10 * z, 16 * z, 3 * z, col, 'rgba(255,255,255,.7)', 0.8 * z); const sw = (ts / 300) % 6; ellipse(q.x, q.y - 8 * z, 3 * z, 1.4 * z, 'rgba(255,255,255,.5)', null, 0, sw); }); return true; }
      case 'hotdog': { box(x, y, d.w, d.d, 6, '#c9cfd6', base, { top: '#9aa3ad' }); for (let k = 0; k < 4; k++) { const a = up(iso(x + 0.1, y + 0.1 + k * 0.1), (base + 7) * z), b = up(iso(x + d.w - 0.1, y + 0.1 + k * 0.1), (base + 7) * z); line(a.x, a.y, b.x, b.y, k % 2 ? '#c0453a' : '#d0603c', 2.2 * z); } return true; }
      case 'icefreezer': { const b = box(x, y, d.w, d.d, 16, '#ffffff', 0, { top: '#e8f4fa' }); const q0 = up(iso(x + 0.1, y + 0.1), 16 * z), q1 = up(iso(x + d.w - 0.1, y + 0.1), 16 * z), q2 = up(iso(x + d.w - 0.1, y + d.d - 0.1), 16 * z), q3 = up(iso(x + 0.1, y + d.d - 0.1), 16 * z); poly([q0, q1, q2, q3], 'rgba(160,210,240,.55)', 'rgba(255,255,255,.8)', 1); ['🍦', '🍨', '🍧', '🍦'].forEach((e, k) => { const q = up(iso(x + (k + 0.5) * d.w / 4, y + d.d / 2), 16 * z); emoji(e, q.x, q.y + 1 * z, 7 * z); }); wallRect(b.left, 0, 0.3, 0.7, 6, 10, '#38a3e0'); return true; }
      case 'atm': { box(x + 0.05, y + 0.05, d.w - 0.1, d.d - 0.1, 36, '#2f6fb2', 0, { top: '#3d82c9' }); const q = up(c, 30 * z); rrect(q.x - 5 * z, q.y - 4 * z, 10 * z, 7 * z, 1 * z, '#bfe6f7'); emoji('🏧', q.x, q.y + 10 * z, 7 * z); return true; }
      case 'magrack': { const b = box(x, y, d.w, d.d, 30, '#8a5a36', 0, { top: '#a46e40' }); for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) wallRect(b.right, 0, k / 2 + 0.06, (k + 1) / 2 - 0.06, 4 + r * 9, 11 + r * 9, ['#e5484d', '#f2c230', '#38a3e0', '#34b27b', '#a46ef0', '#f59e0b'][r * 2 + k]); return true; }
      // ----- v0.37: the new places -----
      case 'banksign': { wallRect(F, 46, 0.02, 0.98, 0, 16, d.col || '#2f5d50'); txt(0.5, 54, d.label || (curLang() === 'zh' ? '镜像银行' : 'MIRROR BANK'), 8, '#f7e9b8'); return true; }
      case 'vault': { const q = wallPt(F, 8, 0.5, 18); ellipse(q.x, q.y, 18 * z, 20 * z, '#9aa3ad', '#5b6470', 2 * z); ellipse(q.x, q.y, 13 * z, 14.5 * z, '#c9cfd6', '#7d848c', 1 * z); for (let k2 = 0; k2 < 6; k2++) { const a = k2 / 6 * Math.PI * 2 + t * 0.2; line(q.x, q.y, q.x + Math.cos(a) * 9 * z, q.y + Math.sin(a) * 10 * z, '#5b6470', 1.4 * z); } circle(q.x, q.y, 3 * z, '#5b6470'); return true; }
      case 'lift': {   // lift doors in the back wall, with the floor numbers lit above
        wallRect(F, 0, 0, 1, 0, 32, '#c9cfd6', '#9aa3ad', 1); wallRect(F, 0, 0.08, 0.49, 1, 29, '#dfe4e9'); wallRect(F, 0, 0.51, 0.92, 1, 29, '#dfe4e9');
        wallRect(F, 0, 0.3, 0.7, 32, 37, '#1d1d22'); txt(0.5, 34.5, d.kind === 'spot' ? '▲ ▼' : String(1 + Math.floor(t / 3) % 9), 4.4, '#ff8a3d'); return true;
      }
      case 'tellers': {   // the bank's counter: wood below, glass above, a little window and a lamp at each place
        const b = box(x, y, d.w, d.d, 16, '#6b4428', 0, { top: '#e8e2d6' });
        const g0 = up(iso(x, y + d.d * 0.35), 16 * z), g1 = up(iso(x + d.w, y + d.d * 0.35), 16 * z); poly([g0, g1, up(g1, 22 * z), up(g0, 22 * z)], 'rgba(200,230,250,.25)', 'rgba(255,255,255,.75)', 1);
        [0.17, 0.5, 0.83].forEach(u => { wallRect(b.left, 0, u - 0.06, u + 0.06, 6, 12, '#c9a24a'); const q = up(iso(x + u * d.w, y + d.d * 0.7), 16 * z); rrect(q.x - 2.5 * z, q.y - 2 * z, 5 * z, 2 * z, 0.5 * z, '#fffaf0'); });
        return true;
      }
      case 'column': { box(x + 0.05, y + 0.05, d.w - 0.1, d.d - 0.1, 70, '#f4efe6', 0, { top: '#ffffff' }); box(x - 0.05, y - 0.05, d.w + 0.1, d.d + 0.1, 4, '#e2dbcd', 0); box(x - 0.05, y - 0.05, d.w + 0.1, d.d + 0.1, 4, '#e2dbcd', 66, { shadow: false }); return true; }
      case 'whiteboard': { wallRect(F, 24, 0, 1, 0, 26, '#ffffff', '#9aa3ad', 1); [[0.15, 44, '📈'], [0.5, 42, 'Q4 ✓'], [0.8, 38, '💡']].forEach(([u, h, s2]) => txt(u, h, s2, 6, '#2f6fb2', 700)); wallLine(F, 24, 0.1, 6, 0.6, 14, '#e5484d', 0.8); return true; }
      case 'printer': { box(x, y, d.w, d.d, 16, '#e8ecf0', 0, { top: '#c9cfd6' }); box(x + 0.15, y + 0.15, d.w - 0.3, d.d - 0.3, 3, '#ffffff', 16, { shadow: false }); return true; }
      case 'telescope': { const a = iso(x + 0.25, y + 1.3), b2 = up(a, 26 * z); line(a.x - 5 * z, a.y, b2.x, b2.y, '#5b6470', 1.2 * z); line(a.x + 5 * z, a.y, b2.x, b2.y, '#5b6470', 1.2 * z); line(b2.x - 6 * z, b2.y + 2 * z, b2.x + 8 * z, b2.y - 4 * z, '#2d2d34', 3.4 * z); return true; }
      case 'barcounter': {   // a bar with stools in front of it and bottles behind
        const along = d.along || d.w > d.d, b = box(x, y, d.w, d.d, 20, '#3b3125', 0, { top: '#8a5a36' }), Fc = along ? b.left : b.right;
        wallRect(Fc, 0, 0.02, 0.98, 14, 17, '#c9a24a');
        for (let k2 = 0; k2 < 5; k2++) { const u = (k2 + 0.5) / 5, q = up(along ? iso(x + u * d.w, y + 0.2) : iso(x + 0.2, y + u * d.d), 20 * z); rrect(q.x - 1.2 * z, q.y - 7 * z, 2.4 * z, 7 * z, 1 * z, ['#34b27b', '#c9433b', '#f2c230', '#5b3a8a', '#2f6fb2'][k2]); }
        const n = Math.round(Math.max(d.w, d.d) / 1.2); for (let k2 = 0; k2 < n; k2++) { const u = (k2 + 0.5) / n, s = along ? iso(x + u * d.w, y + d.d + 0.45) : iso(x + d.w + 0.45, y + u * d.d); line(s.x, s.y, s.x, s.y - 10 * z, '#2d2d2d', 1.4 * z); ellipse(s.x, s.y - 10 * z, 5.5 * z, 2.6 * z, '#c0453a'); }
        return true;
      }
      case 'kitchenpass': { const b = box(x, y, d.w, d.d, 18, '#c9cfd6', 0, { top: '#e8ecf0' }); [0.2, 0.5, 0.8].forEach((u, k2) => { const q = up(iso(x + u * d.w, y + d.d / 2), 18 * z); ellipse(q.x, q.y, 6 * z, 2.5 * z, '#ffffff', '#c9cfd6', 0.6 * z); emoji(['🍝', '🥩', '🥗'][k2], q.x, q.y + 1 * z, 7 * z); }); const l = up(iso(x + d.w / 2, y + d.d / 2), 40 * z); line(l.x - 20 * z, l.y, l.x + 20 * z, l.y, '#5b6470', 1.2 * z); if (NIGHT > 0.2 || true) glow(l.x, l.y + 6 * z, 30 * z, 0.35); return true; }
      case 'chandelier': { const top = up(c, 92 * z), m = up(c, 70 * z); line(top.x, top.y, m.x, m.y, '#c9a24a', 1 * z); for (let k2 = 0; k2 < 8; k2++) { const a = k2 / 8 * Math.PI * 2, q = { x: m.x + Math.cos(a) * 14 * z, y: m.y + Math.sin(a) * 5 * z }; line(m.x, m.y, q.x, q.y, '#c9a24a', 0.8 * z); circle(q.x, q.y - 2 * z, 2 * z, '#fff2c4'); } ellipse(m.x, m.y, 5 * z, 2.5 * z, '#c9a24a'); glow(m.x, m.y, 40 * z, NIGHT > 0.2 ? 0.7 : 0.3); return true; }
      case 'luggage': { box(x, y, d.w, d.d, 3, '#c9a24a', 4, { top: '#8a2a34' }); [0.15, 0.85].forEach(u => { const a = up(iso(x + u * d.w, y + d.d / 2), 4 * z); line(a.x, a.y, a.x, a.y - 30 * z, '#c9a24a', 1.4 * z); }); const a = up(iso(x + 0.15 * d.w, y + d.d / 2), 34 * z), b2 = up(iso(x + 0.85 * d.w, y + d.d / 2), 34 * z); line(a.x, a.y, b2.x, b2.y, '#c9a24a', 1.6 * z); box(x + 0.15, y + 0.1, 0.4, 0.4, 10, '#2f6fb2', 7, { shadow: false }); box(x + 0.5, y + 0.15, 0.35, 0.3, 8, '#e5484d', 7, { shadow: false }); return true; }
      // ----- v0.38: the hospital -----
      case 'hospbed': {   // a hospital bed (the head to the left), a blanket, rails, a heart monitor, a curtain beside it
        box(x + 0.15, y + 0.15, d.w - 0.3, d.d - 0.3, 7, '#9aa3ad', 0);
        box(x, y, d.w, d.d, 3, '#eef3f6', 7, { top: '#fbfdfe' });
        box(x + 0.1, y + 0.15, 0.5, d.d - 0.3, 3, '#ffffff', 10, { shadow: false, top: '#ffffff' });
        if (!d.empty) box(x + 0.75, y + 0.05, d.w - 0.9, d.d - 0.1, 1.2, '#a8d4e6', 10, { shadow: false, top: '#b9dfee' });
        box(x - 0.05, y, 0.1, d.d, 18, '#c9cfd6', 0, { shadow: false });
        { const a = up(iso(x + 0.8, y + d.d), 13 * z), b2 = up(iso(x + d.w - 0.3, y + d.d), 13 * z); line(a.x, a.y, b2.x, b2.y, '#9aa3ad', 1 * z); }
        const m = up(iso(x + 0.15, y + 0.1), 36 * z); rrect(m.x - 6 * z, m.y - 5 * z, 12 * z, 9 * z, 1.5 * z, '#1d2a35', '#9aa3ad', 0.6 * z);
        if (!d.empty && z > 0.3) { ctx.save(); ctx.strokeStyle = '#38d39f'; ctx.lineWidth = 0.8 * z; ctx.beginPath(); for (let k2 = 0; k2 <= 10; k2++) { const ph = (k2 + t * 6) % 10; ctx.lineTo(m.x - 5 * z + k2 * z, m.y + (ph > 4 && ph < 5 ? -3 : ph > 5 && ph < 6 ? 2 : 0) * z); } ctx.stroke(); ctx.restore(); }
        const c0 = iso(x + d.w + 0.2, y - 0.1), c1 = iso(x + d.w + 0.2, y + d.d * 0.75);
        poly([up(c0, 2 * z), up(c1, 2 * z), up(c1, 50 * z), up(c0, 50 * z)], 'rgba(150,200,210,.7)', 'rgba(255,255,255,.5)', 1);
        for (let k2 = 1; k2 < 6; k2++) { const a = lerp(c0, c1, k2 / 6); line(a.x, a.y - 2 * z, a.x, a.y - 50 * z, 'rgba(255,255,255,.35)', 1 * z); }
        return true;
      }
      case 'nursery': {   // the window onto the newborns: cribs with babies in pink and blue blankets
        wallRect(F, 0, 0, 1, 8, 52, '#f4f7f9', '#d6dce2', 1); wallRect(F, 0, 0.04, 0.96, 12, 44, 'rgba(190,225,240,.65)', '#ffffff', 1.4);
        for (let k2 = 0; k2 < 4; k2++) { const q = wallPt(F, 0, 0.16 + k2 * 0.225, 20); rrect(q.x - 8 * z, q.y - 3 * z, 16 * z, 6 * z, 2 * z, k2 % 2 ? '#f9c6d6' : '#bcd9f5', '#ffffff', 0.6 * z); circle(q.x - 4 * z, q.y - 3.5 * z, 2.6 * z, ['#f3c59f', '#d39a6c', '#ffe0c4', '#9a6440'][k2]); circle(q.x - 4.6 * z, q.y - 3.8 * z, 0.4 * z, '#3b3125'); }
        txt(0.5, 48, curLang() === 'zh' ? '新生儿 · NURSERY' : 'NURSERY', 4.6, '#e5484d');
        return true;
      }
      case 'donorchair': {   // a blue recliner, a stand with a bag of blood
        box(x + 0.1, y + 0.3, d.w - 0.2, d.d - 0.4, 8, '#2f6fb2', 0, { top: '#3e7cc9' }); box(x + 0.1, y + 0.15, d.w - 0.2, 0.3, 18, '#2f6fb2', 0, { top: '#3e7cc9', shadow: false });
        [0, 1].forEach(s2 => box(x + (s2 ? d.w - 0.2 : 0.02), y + 0.4, 0.18, d.d - 0.6, 12, '#24589a', 0, { shadow: false }));
        const pa = iso(x + d.w + 0.15, y + 0.3), pb = up(pa, 44 * z); line(pa.x, pa.y, pb.x, pb.y, '#9aa3ad', 1.2 * z); rrect(pb.x - 3 * z, pb.y + 2 * z, 6 * z, 9 * z, 2 * z, busy ? '#b8262a' : '#e5484d');
        if (busy) { const hand = up(iso(x + d.w * 0.75, y + d.d * 0.6), 13 * z); ctx.save(); ctx.strokeStyle = '#b8262a'; ctx.lineWidth = 0.8 * z; ctx.beginPath(); ctx.moveTo(pb.x, pb.y + 11 * z); ctx.quadraticCurveTo(pb.x + 4 * z, hand.y, hand.x, hand.y); ctx.stroke(); ctx.restore(); }
        return true;
      }
      case 'vending': { const b = box(x, y, d.w, d.d, 46, '#e5484d', 0, { top: '#c9373c' }), Fd = b.right; wallRect(Fd, 0, 0.12, 0.7, 14, 42, 'rgba(200,230,250,.85)', '#ffffff', 0.8); [22, 30, 38].forEach(h => ['🥤', '🧃', '🍫'].forEach((e, k2) => { const q = wallPt(Fd, 0, 0.22 + k2 * 0.18, h - 4); if (z > 0.35) emoji(e, q.x, q.y, 5 * z); })); return true; }
      // ----- the bowling alley -----
      case 'bowlane': {   // a lane running back to the pins: maple boards, gutters, arrows, the pins, the machine over them
        flatRect(x, y, 0.3, d.d, '#5b6470'); flatRect(x + d.w - 0.3, y, 0.3, d.d, '#5b6470');
        flatRect(x + 0.3, y, d.w - 0.6, d.d, '#e3b77c');
        for (let k2 = 1; k2 < 6; k2++) { const a = iso(x + 0.3 + k2 * (d.w - 0.6) / 6, y), b2 = iso(x + 0.3 + k2 * (d.w - 0.6) / 6, y + d.d); line(a.x, a.y, b2.x, b2.y, 'rgba(160,110,60,.3)', 0.6 * z); }
        flatRect(x + 0.3, y + d.d - 0.1, d.w - 0.6, 0.1, '#c9433b');
        [0.2, 0.35, 0.5, 0.65, 0.8].forEach((u, k2) => { const q = iso(x + 0.3 + u * (d.w - 0.6), y + d.d - 2.0 - (2 - Math.abs(k2 - 2)) * 0.25); pg([[q.x, q.y - 2 * z], [q.x - 1.5 * z, q.y + 1.2 * z], [q.x + 1.5 * z, q.y + 1.2 * z]], '#6b4428'); });
        const r = d.i || 0, cyc = (t / 6 + r * 0.37) % 1, rolling = d.busy && cyc < 0.45, knocked = d.busy && cyc >= 0.45 && cyc < 0.85, PX = x + d.w / 2;
        const pins = [[0, 0.75], [-0.13, 0.62], [0.13, 0.62], [-0.26, 0.49], [0, 0.49], [0.26, 0.49], [-0.39, 0.36], [-0.13, 0.36], [0.13, 0.36], [0.39, 0.36]];
        pins.map((p, k2) => [...p, k2]).sort((a, b) => a[1] - b[1]).forEach(([dx, dy, k2]) => { const q = iso(PX + dx * 1.4, y + 0.2 + dy * 1.3);
          if (knocked && hash(k2, Math.floor(t / 6 + r * 0.37) + r) > 0.15) { ellipse(q.x + (dx > 0 ? 2 : -2) * z, q.y, 3.2 * z, 1.3 * z, '#fbfbf7', '#c9433b', 0.5 * z); return; }
          ellipse(q.x, q.y - 4 * z, 1.7 * z, 3.3 * z, '#fbfbf7', 'rgba(0,0,0,.12)', 0.4 * z); circle(q.x, q.y - 8.6 * z, 1.2 * z, '#fbfbf7'); line(q.x - 1.1 * z, q.y - 6.8 * z, q.x + 1.1 * z, q.y - 6.8 * z, '#c9433b', 0.7 * z); });
        if (rolling) { const u = cyc / 0.45, q = iso(PX + Math.sin(u * 3 + r) * 0.2, y + d.d - 0.4 - u * (d.d - 1.4)); circle(q.x, q.y - 2.4 * z, 2.6 * z, ['#3a4cc0', '#c9433b', '#34b27b', '#6b5bd0'][r % 4]); }
        box(x - 0.05, y, d.w + 0.1, 0.25, 14, '#1d2547', 24, { shadow: false, top: '#2a3366' });
        return true;
      }
      case 'ballreturn': { box(x, y, d.w, d.d, 8, '#2d2d34', 0, { top: '#3a3a44' }); [0.25, 0.5, 0.75].forEach((v, k2) => { const q = up(iso(x + d.w / 2, y + v * d.d), 10 * z); circle(q.x, q.y, 2.4 * z, ['#3a4cc0', '#ec6aa8', '#34b27b'][k2]); }); return true; }
      case 'scorescreen': { const top = up(c, 88 * z), m = up(c, 62 * z); line(top.x, top.y, m.x, m.y - 7 * z, '#5b6470', 0.8 * z); rrect(m.x - 14 * z, m.y - 7 * z, 28 * z, 13 * z, 2 * z, '#141a3a', '#5b6470', 0.8 * z);
        if (z > 0.35) { ctx.font = `800 ${4.4 * z}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd36b'; ctx.fillText(['X 9/ 8- 72', '8- X 7/ 54', '7/ 9- X 61', 'X X 9/ 88'][d.i || 0], m.x, m.y - 0.5 * z); } return true; }
      case 'arcade': { const b = box(x + 0.05, y, d.w - 0.1, d.d, 40, ['#6b5bd0', '#e5484d', '#2f6fb2'][d.i || 0], 0, { top: '#1d1d22' }); const sc = wallPt(b.left, 0, 0.5, 30), on = 0.6 + 0.4 * Math.sin(t * 5 + x);
        rrect(sc.x - 7 * z, sc.y - 5 * z, 14 * z, 10 * z, 1.5 * z, `rgba(56,211,159,${on})`, '#1d1d22', 0.8 * z); wallRect(b.left, 0, 0.1, 0.9, 16, 20, '#1d1d22');
        [0.3, 0.6].forEach(u => { const q = wallPt(b.left, 0, u, 20); circle(q.x, q.y - 1 * z, 1.2 * z, u < 0.5 ? '#f2c230' : '#e5484d'); }); if (z > 0.35) emoji(['👾', '🏎️', '🕹️'][d.i || 0], sc.x, sc.y + 2 * z, 6 * z); return true; }
      case 'clawbox': { box(x, y, d.w, d.d, 14, '#ec6aa8', 0, { top: '#f48cc0' }); const q = up(c, 16 * z); ['🧸', '🐰', '🦆'].forEach((e, k2) => emoji(e, q.x + (k2 - 1) * 6 * z, q.y + 3 * z, 6 * z));
        box(x + 0.05, y + 0.05, d.w - 0.1, d.d - 0.1, 26, 'rgba(200,230,250,.3)', 14, { top: '#ec6aa8', shadow: false, left: 'rgba(200,230,250,.3)', right: 'rgba(200,230,250,.25)' }); const cl = up(c, 36 * z); line(cl.x, cl.y - 4 * z, cl.x, cl.y, '#9aa3ad', 0.8 * z); return true; }
      case 'shoecubby': { const b = box(x, y, d.w, d.d, 40, '#8a5a36', 0, { top: '#a46e40' }); for (let r = 0; r < 4; r++) for (let k2 = 0; k2 < 6; k2++) { wallRect(b.left, 0, k2 / 6 + 0.01, (k2 + 1) / 6 - 0.01, 4 + r * 9, 11 + r * 9, '#6b4428'); const q = wallPt(b.left, 0, (k2 + 0.5) / 6, 6 + r * 9); rrect(q.x - 2.5 * z, q.y - 2 * z, 5 * z, 2.4 * z, 1 * z, ['#e5484d', '#2f6fb2', '#f2c230'][(r + k2) % 3]); } return true; }
      case 'snackbar': { const b = box(x, y, d.w, d.d, 16, '#c9433b', 0, { top: '#f4f4f0' }); wallRect(b.left, 0, 0, 1, 12, 16, '#f2c230'); const q = up(c, 16 * z); emoji('🌭', q.x - 9 * z, q.y, 9 * z); emoji('🥤', q.x + 1 * z, q.y - 2 * z, 9 * z); emoji('🍿', q.x + 10 * z, q.y, 9 * z);
        const s0 = up(iso(x + d.w / 2, y + 0.1), 46 * z); rrect(s0.x - 18 * z, s0.y - 6 * z, 36 * z, 11 * z, 2 * z, '#1d2547', '#f2c230', 0.8 * z); if (z > 0.35) { ctx.font = `800 ${5.5 * z}px ${UI_FONT}`; ctx.fillStyle = '#ffd36b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SNACKS', s0.x, s0.y - 0.5 * z); } return true; }
      // ----- the swimming centre -----
      case 'bigpool': {   // lanes running back from the starting blocks, rope floats between them, tiles round the edge
        flatRect(x - 0.4, y - 0.4, d.w + 0.8, d.d + 0.8, '#f4f7f9'); flatRect(x, y, d.w, d.d, '#2fa6d6');
        for (let k2 = 0; k2 < 4; k2++) { const cx2 = x + (k2 + 0.5) * d.w / 4; flatRect(cx2 - 0.07, y + 0.6, 0.14, d.d - 1.2, 'rgba(20,60,110,.35)'); flatRect(cx2 - 0.4, y + 0.6, 0.8, 0.14, 'rgba(20,60,110,.35)'); }
        for (let k2 = 0; k2 < 20; k2++) { const u = (k2 * 0.37 + t * 0.05) % 1, v = (k2 * 0.61) % 1, q = iso(x + u * d.w, y + v * d.d); ellipse(q.x, q.y, 7 * z, 1.6 * z, 'rgba(255,255,255,.3)'); }
        // v0.43: the swimmers (and you, while you swim) go up and down the lanes, drawn in the water
        const swim = (lane, ph, L, id, cap) => { const v = 0.5 + 0.5 * Math.sin(t * 0.22 + ph), dv = Math.cos(t * 0.22 + ph), sy = y + 0.6 + (d.d - 1.2) * v, sx = x + (lane + 0.5) * d.w / 4, q = iso(sx, sy);
          drawPerson(q.x, q.y, z, { look: L, face: dv > 0 ? -1 : 1, energy: 'good', ts, seed: lane + 40, pose: 'swim', moving: true, phase: ts / 90, cap }); if (id) folkSeen(id, sx, sy, q, z, ts); return q; };
        [[1, 0.6, '#f2c230'], [2, 2.9, '#2f6fb2'], [3, 4.4, '#e5484d']].forEach(([lane, ph, cap], i) => { const id = castId('sw' + i, true); swim(lane, ph, castLook(id, FOLK(i + 1)), id, cap); });
        if (meS.use && !meS.moving && meS.use.ride === 'pool') {   // you, in the first lane, in a cap of your favourite colour, with a tag so you can find yourself
          const q = swim(0, 1.2, S.me.look, null, S.me.look.shirt || '#34b27b'), U = meS.use, left = Math.max(0, (U.until - performance.now()) / 1000);
          pill(curLang() === 'zh' ? '你' : 'You', q.x, q.y - 26 * z, '#34b27b', '#ffffff', `800 ${Math.max(8, 9 * z)}px ${UI_FONT}`, Math.max(13, 15 * z));
          if (U.until && z > 0.35) { const w = 34 * z, by = q.y - 40 * z; rrect(q.x - w / 2, by, w, 5 * z, 2.5 * z, 'rgba(0,0,0,.25)'); rrect(q.x - w / 2, by, w * (1 - left / (U.secs || 1)), 5 * z, 2.5 * z, '#6cbf73'); }
        }
        for (let k2 = 1; k2 < 4; k2++) { const xx = x + k2 * d.w / 4; for (let s = 0; s < 24; s++) { const q = iso(xx, y + (s + 0.5) * d.d / 24); circle(q.x, q.y - 0.5 * z, 1.3 * z, s < 3 || s > 20 ? '#e5484d' : s % 2 ? '#ffffff' : '#2f6fb2'); } }
        const ld = iso(x + d.w - 0.3, y + d.d + 0.1); line(ld.x, ld.y, ld.x, ld.y - 10 * z, '#c9cfd6', 1.2 * z); line(ld.x + 4 * z, ld.y + 2 * z, ld.x + 4 * z, ld.y - 8 * z, '#c9cfd6', 1.2 * z);
        return true;
      }
      case 'block': { box(x + 0.1, y + 0.05, d.w - 0.2, d.d - 0.1, 8, '#f4f4f0', 0, { top: '#38a3e0' }); const q = wallPt([iso(x + 0.1, y + d.d - 0.05), iso(x + d.w - 0.1, y + d.d - 0.05)], 0, 0.5, 4); if (z > 0.35) { ctx.font = `800 ${4.4 * z}px ${UI_FONT}`; ctx.fillStyle = '#2d2d2d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(d.n || 1), q.x, q.y); } return true; }
      case 'bleachers': {   // v0.43: three steps; the people on them sit on the edge of a step, feet on the one below, facing the pool
        const n = 3, sd = d.d / n, H = 7;
        for (let r = n - 1; r >= 0; r--) box(x, y + (n - 1 - r) * sd, d.w, sd, (r + 1) * H, r % 2 ? '#4a8fd0' : '#5aa2e0', 0, { top: '#7cb8ea', shadow: r === n - 1 });
        (d.crowd || []).map((c2, i) => ({ c2, i })).sort((a, b) => b.c2[1] - a.c2[1] || a.c2[0] - b.c2[0]).forEach(({ c2: [u, r, act], i }) => {
          const px = x + u * d.w, py = y + (n - r) * sd - 0.12, q = up(iso(px, py), r * H * z), id = castId('bl' + i + ':' + x, true);
          drawPerson(q.x, q.y, z, { look: castLook(id, AUDIENCE_LOOKS[i % AUDIENCE_LOOKS.length]), face: -1, energy: 'good', ts, seed: i + 30, pose: 'sit', seatH: H, sit: act });
          folkSeen(id, px, py, q, z, ts);
        });
        return true;
      }
      case 'lanesofa': {   // v0.43: a sofa facing the lanes (its back to us), with people on it watching the game
        const tint = d.tint || '#38d39f';
        box(x + 0.06, y + 0.06, d.w - 0.12, d.d - 0.12, 4, shade(tint, -0.25), 0, { top: shade(tint, -0.1) });
        box(x + 0.3, y + 0.08, d.w - 0.6, d.d - 0.4, 3, tint, 4, { top: shade(tint, 0.08), shadow: false });
        box(x + 0.04, y + 0.08, 0.26, d.d - 0.12, 9, tint, 0, { shadow: false, top: shade(tint, 0.1) });
        (d.sat || []).forEach((u, i) => { const id = castId('ls' + i + ':' + x, true), sx = x + 0.3 + u * (d.w - 0.6), sy = y + d.d * 0.42, q = iso(sx, sy);
          drawPerson(q.x, q.y, z, { look: castLook(id, FOLK(i + 2)), face: 1, back: true, energy: 'good', ts, seed: i + 5, pose: 'sit', seatH: 7, sit: ['chat', 'drink', 'phone'][i % 3] }); folkSeen(id, sx, sy, q, z, ts); });
        box(x + d.w - 0.3, y + 0.08, 0.26, d.d - 0.12, 9, tint, 0, { shadow: false, top: shade(tint, 0.1) });
        box(x + 0.04, y + d.d - 0.3, d.w - 0.08, 0.26, 17, shade(tint, -0.05), 0, { shadow: false, top: shade(tint, 0.1) });
        return true;
      }
      case 'divingboard': { box(x + d.w - 0.7, y + 0.1, 0.6, d.d - 0.2, 8, '#c9cfd6', 0); box(x, y + 0.15, d.w, d.d - 0.3, 1.2, '#f4f4f0', 8, { top: busy ? '#ffffff' : '#38a3e0', shadow: false }); return true; }
      case 'lifeguard': {   // v0.43: a tall white chair with a ladder at the back; the lifeguard sits up on it, looking over the pool
        [[0.15, 0.15], [0.65, 0.15], [0.15, 0.65], [0.65, 0.65]].forEach(([dx, dy]) => box(x + dx, y + dy, 0.08, 0.08, 30, '#f4f4f0', 0, { shadow: false }));
        for (let k2 = 1; k2 < 5; k2++) box(x + 0.66, y + 0.2, 0.06, 0.5, 1.2, '#dfe6ea', k2 * 6, { shadow: false });
        box(x + 0.05, y + 0.12, 0.2, 0.66, 1.4, '#f4f4f0', 18, { shadow: false });   // the footrest
        box(x + 0.15, y + 0.12, 0.62, 0.66, 2.5, '#e5484d', 30, { shadow: false, top: '#f05a5f' });
        if (d.guard) { const q = up(iso(x + 0.42, y + 0.45), 21 * z); drawPerson(q.x, q.y, z, { look: d.guard, face: -1, back: true, energy: 'good', ts, seed: 12, pose: 'sit', seatH: 9, sit: 'lean' }); }
        box(x + 0.66, y + 0.12, 0.1, 0.66, 9, '#e5484d', 32, { shadow: false });   // the low back
        return true;
      }
      case 'sauna': { const b = box(x, y, d.w, d.d, 50, '#b07a4a', 0, { top: '#8a5a36' }); for (let k2 = 1; k2 < 10; k2++) { wallLine(b.left, 0, 0, k2 * 5, 1, k2 * 5, 'rgba(90,60,30,.35)', 0.6); wallLine(b.right, 0, 0, k2 * 5, 1, k2 * 5, 'rgba(90,60,30,.35)', 0.6); }
        wallRect(b.left, 0, 0.3, 0.7, 2, 40, busy ? 'rgba(255,200,140,.8)' : 'rgba(255,220,180,.55)', '#8a5a36', 1); const q = wallPt(b.left, 0, 0.5, 45); if (z > 0.35) { ctx.font = `800 ${5 * z}px ${UI_FONT}`; ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SAUNA', q.x, q.y); }
        for (let k2 = 0; k2 < 3; k2++) { const u = (t * 0.4 + k2 / 3) % 1, p = up(iso(x + d.w * 0.5, y + d.d * 0.5), (52 + u * 20) * z); circle(p.x + Math.sin(u * 6 + k2) * 4 * z, p.y, (2 + u * 4) * z, `rgba(255,255,255,${0.5 * (1 - u)})`); } return true; }
      // ----- the museum -----
      case 'trex': {   // a T. rex skeleton on a low platform, facing left
        box(x, y, d.w, d.d, 5, '#8a7a5a', 0, { top: '#a8977a' });
        const P3 = (u, v, h) => up(iso(x + u * d.w, y + v * d.d), (5 + h) * z), bone = '#efe6d0', bw = 1.6 * z;
        [[0.5, 0.35], [0.5, 0.65]].forEach(([u, v]) => { const hip = P3(u, v, 58), knee = P3(u + 0.07, v, 30), ft = P3(u - 0.02, v, 0); line(hip.x, hip.y, knee.x, knee.y, bone, bw * 1.8); line(knee.x, knee.y, ft.x, ft.y, bone, bw * 1.3); line(ft.x, ft.y, ft.x - 6 * z, ft.y + 1 * z, bone, bw); });
        const sp = []; for (let k2 = 0; k2 <= 14; k2++) { const u = 0.97 - k2 * 0.06, h = 22 + Math.sin(k2 / 14 * Math.PI) * 42 + (k2 > 10 ? (k2 - 10) * 5 : 0); sp.push(P3(u, 0.5, h)); }
        ctx.save(); ctx.strokeStyle = bone; ctx.lineWidth = bw * 1.2; ctx.lineCap = 'round'; ctx.beginPath(); sp.forEach((p, k2) => (k2 ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
        for (let k2 = 5; k2 < 11; k2++) { const p = sp[k2]; ctx.save(); ctx.strokeStyle = bone; ctx.lineWidth = 1.1 * z; ctx.beginPath(); ctx.ellipse(p.x - 1 * z, p.y + 8 * z, 3 * z, (9 - Math.abs(k2 - 8)) * z, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }   // ribs
        const ar = sp[11]; line(ar.x, ar.y + 5 * z, ar.x - 5 * z, ar.y + 11 * z, bone, bw * 0.8); line(ar.x - 5 * z, ar.y + 11 * z, ar.x - 8 * z, ar.y + 10 * z, bone, bw * 0.6);
        const hd = sp[14]; ellipse(hd.x - 9 * z, hd.y - 1 * z, 12 * z, 6.5 * z, bone, 'rgba(120,100,70,.5)', 0.7 * z); circle(hd.x - 6 * z, hd.y - 3 * z, 2 * z, '#5a4a32');
        line(hd.x - 20 * z, hd.y + 4 * z, hd.x - 3 * z, hd.y + 6 * z, bone, 2 * z); for (let k2 = 0; k2 < 6; k2++) line(hd.x - 19 * z + k2 * 2.6 * z, hd.y + 4 * z, hd.x - 19 * z + k2 * 2.6 * z, hd.y + 2 * z, '#fffaf0', 0.8 * z);
        const sg = P3(0.12, 1.0, 0); rrect(sg.x - 9 * z, sg.y - 6 * z, 18 * z, 6 * z, 1 * z, '#3b3125'); if (z > 0.35) { ctx.font = `800 ${3.6 * z}px ${UI_FONT}`; ctx.fillStyle = '#f7e9b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('T. REX', sg.x, sg.y - 3 * z); }
        return true;
      }
      case 'rocket': { box(x + 0.2, y + 0.2, d.w - 0.4, d.d - 0.4, 4, '#5b6470', 0, { top: '#9aa3ad' }); const b0 = up(c, 4 * z), tp = up(c, 74 * z);
        pg([[b0.x - 7 * z, b0.y - 2 * z], [b0.x - 4 * z, b0.y - 14 * z], [b0.x - 4 * z, b0.y - 4 * z]], '#e5484d'); pg([[b0.x + 7 * z, b0.y - 2 * z], [b0.x + 4 * z, b0.y - 14 * z], [b0.x + 4 * z, b0.y - 4 * z]], '#c9433b');
        pg([[b0.x - 4.5 * z, b0.y - 4 * z], [b0.x + 4.5 * z, b0.y - 4 * z], [b0.x + 4.5 * z, tp.y + 16 * z], [b0.x, tp.y], [b0.x - 4.5 * z, tp.y + 16 * z]], '#f4f4f0', 'rgba(0,0,0,.15)', 0.6 * z);
        line(b0.x + 2 * z, b0.y - 5 * z, b0.x + 2 * z, tp.y + 16 * z, 'rgba(0,0,0,.06)', 3 * z); circle(b0.x, tp.y + 26 * z, 2.4 * z, '#38a3e0', '#9aa3ad', 0.8 * z);
        rrect(b0.x - 4.5 * z, b0.y - 30 * z, 9 * z, 3 * z, 0.5 * z, '#2f6fb2'); return true; }
      case 'planets': { [[0, 0, 9, '#f2c230'], [1.4, 0.4, 3, '#c9a36a'], [2.6, 0.2, 4, '#38a3e0'], [3.8, 0.6, 3.4, '#e5734f'], [5.4, 0.3, 7, '#e3b77c', true]].forEach(([dx, dy, r, col, ring]) => {
          const tp = up(iso(x + dx, y + dy), 94 * z), q = up(iso(x + dx, y + dy), (68 + Math.sin(t + dx) * 2) * z); line(tp.x, tp.y, q.x, q.y - r * z, 'rgba(90,90,90,.5)', 0.6 * z);
          if (dx === 0) glow(q.x, q.y, 26 * z, 0.5); circle(q.x, q.y, r * z, col); if (ring) ellipse(q.x, q.y, r * 1.8 * z, r * 0.5 * z, null, '#b08d57', 1.3 * z); }); return true; }
      case 'paintings': {   // framed pictures on a wall (the back one or the left one)
        const n = Math.max(1, Math.round(Math.max(d.w, d.d) / 1.3));
        for (let k2 = 0; k2 < n; k2++) { const u0 = (k2 + 0.15) / n, u1 = (k2 + 0.85) / n, h0 = 24 + (k2 % 2) * 4, h1 = h0 + 18, j = (k2 + (d.d > d.w ? 1 : 0)) % 4;
          wallRect(F, 0, u0 - 0.02, u1 + 0.02, h0 - 2, h1 + 2, '#c9a24a');
          wallRect(F, 0, u0, u1, h0 + 7, h1, ['#9fd3f2', '#f6c59f', '#2a3360', '#bfe6c4'][j]); wallRect(F, 0, u0, u1, h0, h0 + 7, ['#6fb44e', '#e5734f', '#3d4a66', '#4f9a4a'][j]);
          const sun = wallPt(F, 0, u0 + (u1 - u0) * 0.7, h1 - 5); circle(sun.x, sun.y, 2 * z, j === 2 ? '#fffaf0' : '#f2c230');
          if (j === 2) for (let s = 0; s < 6; s++) { const q = wallPt(F, 0, u0 + (u1 - u0) * hash(s, k2), h0 + 9 + hash(k2, s) * 8); circle(q.x, q.y, 0.7 * z, '#f2c230'); } }
        return true; }
      case 'vitrine': { box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 14, '#3b3125', 0, { top: '#5a4a32' }); const items = d.items || (d.i ? ['🗿'] : ['🏺', '🏺', '🪙']);
        items.forEach((e, k2) => { const q = up(iso(x + (k2 + 0.5) * d.w / items.length, y + d.d / 2), 22 * z); emoji(e, q.x, q.y, 10 * z); });
        box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 20, 'rgba(210,235,245,.3)', 14, { left: 'rgba(210,235,245,.3)', right: 'rgba(210,235,245,.24)', top: 'rgba(230,245,250,.35)', shadow: false }); return true; }
      // ----- v0.45: the museum's new things -----
      case 'trike': {   // a triceratops skeleton on a low platform: ribs, three horns, the frill
        box(x, y, d.w, d.d, 4, '#8a7a5a', 0, { top: '#a8977a' });
        const P3 = (u, v, h) => up(iso(x + u * d.w, y + v * d.d), (4 + h) * z), bone = '#efe6d0', bw = 1.5 * z;
        [[0.3, 0.3], [0.3, 0.7], [0.65, 0.3], [0.65, 0.7]].forEach(([u, v]) => { const a = P3(u, v, 22), b2 = P3(u + 0.02, v, 0); line(a.x, a.y, b2.x, b2.y, bone, bw * 1.4); });
        const sp0 = P3(0.12, 0.5, 26), sp1 = P3(0.78, 0.5, 26); line(sp0.x, sp0.y, sp1.x, sp1.y, bone, bw * 1.6);
        for (let k2 = 0; k2 < 6; k2++) { const q = lerp(sp0, sp1, 0.2 + k2 * 0.11); ctx.beginPath(); ctx.ellipse(q.x, q.y + 6 * z, 4 * z, 7 * z, 0, Math.PI * 1.05, Math.PI * 1.95, true); ctx.strokeStyle = bone; ctx.lineWidth = 1.1 * z; ctx.stroke(); }
        const hd = P3(0.86, 0.5, 26); ellipse(hd.x + 4 * z, hd.y - 2 * z, 9 * z, 7 * z, null, bone, 1.6 * z);
        [[0, -10], [6, -8], [11, 0]].forEach(([dx, dy]) => line(hd.x + 4 * z + dx * 0.4 * z, hd.y + dy * 0.4 * z, hd.x + 8 * z + dx * z, hd.y + dy * z - 6 * z, bone, 1.4 * z));
        line(sp0.x, sp0.y, sp0.x - 12 * z, sp0.y + 8 * z, bone, 1.2 * z);
        if (z > 0.35) { const sg = P3(0.15, 1.0, 0); rrect(sg.x - 10 * z, sg.y - 6 * z, 20 * z, 6 * z, 1 * z, '#3b3125'); ctx.font = `800 ${3.4 * z}px ${UI_FONT}`; ctx.fillStyle = '#f7e9b8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('TRICERATOPS', sg.x, sg.y - 3 * z); }
        return true;
      }
      case 'donatebox': {   // a clear box on a stand with coins and notes inside, and a sign
        box(x + 0.15, y + 0.15, d.w - 0.3, d.d - 0.3, 14, '#8a7a5a', 0, { top: '#a8977a' });
        const q = up(c, 14 * z); for (let k2 = 0; k2 < 6; k2++) circle(q.x - 6 * z + (k2 % 3) * 6 * z, q.y - 2 * z - Math.floor(k2 / 3) * 3 * z, 2 * z, k2 % 2 ? '#f2c230' : '#7cc47a');
        box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 14, 'rgba(210,235,245,.35)', 14, { left: 'rgba(210,235,245,.35)', right: 'rgba(210,235,245,.28)', top: 'rgba(230,245,250,.4)', shadow: false });
        if (z > 0.4) { const r = up(c, 40 * z); pill(`💝 ${curLang() === 'zh' ? '捐款' : 'Donate'}`, r.x, r.y, '#e5484d', '#ffffff', `800 ${Math.max(8, 8 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(12, 14 * z)); }
        return true;
      }
      case 'donorwall': {   // a wooden board on the back wall with the donors' names (yours too, once you've given)
        const F2 = [iso(x, y + d.d), iso(x + d.w, y + d.d)], T = museumTier();
        poly([up(F2[0], 16 * z), up(F2[1], 16 * z), up(F2[1], 70 * z), up(F2[0], 70 * z)], '#7a5a3a', '#5a3f26', 1 * z);
        if (z > 0.35) { const names = [T ? `${T.e} ${S.me.name || ''}` : null, '🥇 ' + tfName(VIEW_TOWN, 3), '🥈 ' + tfName(VIEW_TOWN, 11), '🥈 ' + tfName(VIEW_TOWN, 19), '🥉 ' + tfName(VIEW_TOWN, 27), '🥉 ' + tfName(VIEW_TOWN, 35)].filter(Boolean).slice(0, 6);
          txt(0.5, 63, curLang() === 'zh' ? '感谢捐赠者' : 'Thank you, donors', 6, '#f7e9b8', 900);
          names.slice(0, 5).forEach((n2, k2) => txt(0.5, 54 - k2 * 8, nm(n2), 5.2, k2 === 0 && T ? '#ffe17a' : '#fffaf0', k2 === 0 && T ? 900 : 700)); }
        return true;
      }
      case 'mystatue': {   // a marble plinth: your statue on it once you're a gold donor; until then a little sign
        const T = museumTier(), gold = T && T.statue;
        ellipse(c.x, c.y + 2 * z, 30 * z, 13 * z, 'rgba(0,0,0,.14)');
        box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 3, '#d9d1c2');
        const b = box(x + 0.25, y + 0.25, d.w - 0.5, d.d - 0.5, 16, '#ece6da', 3);
        if (gold) {
          const q = up(c, 19 * z); drawPerson(q.x, q.y, z * 1.25, { look: statueLook(S.me.look), face: 1, view: 'front', turn: [0.5, 1], energy: 'great', ts: 0, seed: 1, pose: 'stand', wave: true });
          const g = (Math.sin(t * 1.4) + 1) / 2; circle(q.x + 7 * z, q.y - 40 * z, (1 + g * 1.6) * z, 'rgba(255,255,235,.95)');
          if (z > 0.35) { const pl = wallPt(b.left, 3, 0.5, 8); rrect(pl.x - 12 * z, pl.y - 3 * z, 24 * z, 6 * z, 1 * z, '#c9971a'); ctx.font = `800 ${Math.max(4, 3.8 * z)}px ${UI_FONT}`; ctx.fillStyle = '#3b2a10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(S.me.name || '', pl.x, pl.y); }
        } else if (z > 0.4) { const q = up(c, 30 * z); pill(`🗿 ${curLang() === 'zh' ? '金牌捐赠者的雕像' : 'A gold donor’s statue'}`, q.x, q.y, 'rgba(255,253,248,.92)', '#6b4a1f', `800 ${Math.max(8, 8 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(12, 14 * z)); }
        return true;
      }
      case 'starfloor': { flatRect(x, y, d.w, d.d, '#1d2547'); for (let k2 = 0; k2 < 40; k2++) { const q = iso(x + hash(k2, 4) * d.w, y + hash(k2, 9) * d.d); circle(q.x, q.y, (0.6 + hash(k2, 2) * 1.2) * z, `rgba(255,255,230,${0.5 + 0.5 * Math.sin(t * 2 + k2)})`); } return true; }
      case 'astronaut': {   // a spacesuit on a stand, gold visor
        box(x + 0.2, y + 0.2, d.w - 0.4, d.d - 0.4, 5, '#5b6470', 0, { top: '#6b7480' });
        const q = up(c, 5 * z); rrect(q.x - 7 * z, q.y - 30 * z, 14 * z, 20 * z, 5 * z, '#f4f4f0', '#c9cfd6', 1 * z); line(q.x - 4 * z, q.y - 10 * z, q.x - 4 * z, q.y, '#e8e8e2', 4 * z); line(q.x + 4 * z, q.y - 10 * z, q.x + 4 * z, q.y, '#e8e8e2', 4 * z);
        line(q.x - 7 * z, q.y - 27 * z, q.x - 11 * z, q.y - 15 * z, '#f4f4f0', 4 * z); line(q.x + 7 * z, q.y - 27 * z, q.x + 11 * z, q.y - 15 * z, '#f4f4f0', 4 * z);
        circle(q.x, q.y - 36 * z, 8 * z, '#f4f4f0', '#c9cfd6', 1 * z); ellipse(q.x + 1 * z, q.y - 36 * z, 5.5 * z, 4.5 * z, '#e0a800'); ellipse(q.x - 1 * z, q.y - 37.5 * z, 2 * z, 1.2 * z, 'rgba(255,255,255,.6)');
        rrect(q.x - 3 * z, q.y - 24 * z, 6 * z, 4 * z, 1 * z, '#2f6fb2'); return true;
      }
      case 'telescope': { const a = iso(x + 0.5, y + 0.5); [[-6, 0], [6, 0], [0, 4]].forEach(([dx, dy]) => line(a.x, a.y - 14 * z, a.x + dx * z, a.y + dy * z, '#3b3125', 1.4 * z)); line(a.x - 9 * z, a.y - 8 * z, a.x + 10 * z, a.y - 24 * z, '#f4f4f0', 5 * z); line(a.x + 8 * z, a.y - 22.5 * z, a.x + 11 * z, a.y - 25 * z, '#2d2d34', 6 * z); return true; }
      case 'sculpture': {   // a marble statue (a Greek-looking figure) on a plinth
        box(x + 0.2, y + 0.2, d.w - 0.4, d.d - 0.4, 14, '#d9d1c2', 0, { top: '#ece6da' });
        const q = up(c, 14 * z); drawPerson(q.x, q.y, z * 1.1, { look: { shirt: '#f4f1ea', top: 'tshirt', pants: '#f4f1ea', skin: '#f4f1ea', hair: 'curly', hairCol: '#e8e3d8', shoeCol: '#f4f1ea', mob: 'walk' }, face: -1, energy: 'good', ts: 0, seed: 2, pose: 'stand', hands: [[-4, -24], [6, -30]] }); return true;
      }
      case 'sarcophagus': {   // a mummy's painted case, gold and blue, in a glass case
        box(x + 0.05, y + 0.05, d.w - 0.1, d.d - 0.1, 8, '#3b3125', 0, { top: '#5a4a32' });
        const a = up(iso(x + 0.25, y + d.d / 2), 8 * z), b2 = up(iso(x + d.w - 0.25, y + d.d / 2), 8 * z), mid = lerp(a, b2, 0.5);
        ctx.save(); ctx.translate(mid.x, mid.y - 4 * z); ctx.rotate(Math.atan2(b2.y - a.y, b2.x - a.x)); const L = Math.hypot(b2.x - a.x, b2.y - a.y) / 2;
        rrect(-L, -6 * z, L * 2, 12 * z, 6 * z, '#e0a800', '#8a6a10', 1 * z); for (let k2 = 1; k2 < 6; k2++) line(-L + k2 * L / 3, -6 * z, -L + k2 * L / 3, 6 * z, '#2f6fb2', 1.4 * z); circle(L - 6 * z, 0, 5 * z, '#e9c46a', '#8a6a10', 0.8 * z); ctx.restore();
        box(x + 0.05, y + 0.05, d.w - 0.1, d.d - 0.1, 16, 'rgba(210,235,245,.28)', 8, { left: 'rgba(210,235,245,.3)', right: 'rgba(210,235,245,.24)', top: 'rgba(230,245,250,.3)', shadow: false }); return true;
      }
      case 'giftshop': { const b = box(x, y, d.w, d.d, 30, '#f4efe6', 0, { top: '#e6dfd1' }); [[8, ['🦖', '🪐', '🖼️', '🦕']], [20, ['🦕', '🚀', '🦖', '🏺']]].forEach(([h, es]) => es.forEach((e, k2) => { const q = wallPt(b.left, 0, (k2 + 0.5) / 4, h - 4); emoji(e, q.x, q.y, 8 * z); }));
        const s0 = up(iso(x + d.w / 2, y + 0.1), 42 * z); rrect(s0.x - 16 * z, s0.y - 5 * z, 32 * z, 9 * z, 2 * z, '#c9433b'); if (z > 0.35) { ctx.font = `800 ${4.6 * z}px ${UI_FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(curLang() === 'zh' ? '纪念品' : 'GIFTS', s0.x, s0.y - 0.5 * z); } return true; }
      // ----- the station -----
      case 'rails': { flatRect(x, y, d.w, d.d, '#8a8478'); for (let u = x + 0.2; u < x + d.w; u += 0.6) flatRect(u, y + 0.15, 0.25, d.d - 0.3, '#6b4428'); [0.35, 1.1].forEach(v => flatRect(x, y + v, d.w, 0.08, '#c9cfd6')); return true; }
      case 'platformedge': { flatRect(x, y, d.w, d.d, '#d9d4ca'); flatRect(x, y + 0.08, d.w, 0.12, '#f2c230'); return true; }
      case 'train': {   // a train pulls in from the left, waits with its doors open, and goes on to the right (every 40 s)
        const cyc = (t % 40) / 40, L = 14.4;
        let off;
        if (cyc < 0.25) off = -L - 1 + (1 - Math.pow(1 - cyc / 0.25, 2)) * (L + 1 + d.w / 2 - L / 2);
        else if (cyc < 0.55) off = d.w / 2 - L / 2;
        else if (cyc < 0.8) off = d.w / 2 - L / 2 + Math.pow((cyc - 0.55) / 0.25, 2) * (d.w / 2 + L / 2 + 1);
        else return true;
        ctx.save(); ctx.beginPath(); [up(iso(x, y), 120 * z), up(iso(x + d.w, y), 120 * z), iso(x + d.w, y + d.d + 0.4), iso(x, y + d.d + 0.4)].forEach((p, k2) => (k2 ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.clip();
        // v0.45: a real-looking passenger train: three cars, a streamlined nose at each end with a windscreen and lights,
        // a blue and red stripe, windows, doors (open while it waits), gangways, bogies and wheels, a pantograph
        const lit = NIGHT > 0.3, open2 = cyc >= 0.27 && cyc < 0.53, y0 = y + 0.12, D = d.d - 0.24, H = 27, B = 4, P3 = (wx, wy, h) => up(iso(wx, wy), h * z);
        const car = (cx0, L, kind) => {   // kind: 0 the front (nose at +x), 1 a middle car, 2 the back (nose at -x)
          const nl = kind === 2 ? 1.1 : 0, nr = kind === 0 ? 1.1 : 0;
          [0.8, L - 0.8].forEach(u => { box(cx0 + u - 0.5, y0 + 0.2, 1.0, D - 0.4, B, '#3a3f47', 0, { shadow: false, top: '#4a5059' }); [-0.28, 0.28].forEach(v => { const q = iso(cx0 + u + v, y0 + D - 0.18); circle(q.x, q.y - 2.2 * z, 2.6 * z, '#2d2d34', '#7a828c', 0.8 * z); }); });
          if (nl) {   // the back: a sloped nose going away from you (only its side shows)
            poly([P3(cx0, y0 + D, B + 1), P3(cx0 + nl, y0 + D, B), P3(cx0 + nl, y0 + D, H + B), P3(cx0 + 0.15, y0 + D, B + 9)], '#eef1f4', '#c9cfd6', 0.6 * z);
            poly([P3(cx0 + 0.15, y0, B + 9), P3(cx0 + 0.15, y0 + D, B + 9), P3(cx0 + nl, y0 + D, H + B), P3(cx0 + nl, y0, H + B)], '#dfe4ea');
            poly([P3(cx0 + 0.25, y0 + D, B + 3), P3(cx0 + nl, y0 + D, B + 3), P3(cx0 + nl, y0 + D, B + 7), P3(cx0 + 0.18, y0 + D, B + 7)], '#2f6fb2');
            // v0.49: its cab: a windscreen down the slope, a dark bumper, tail lights (it looked sliced off)
            poly([P3(cx0 + nl - 0.12, y0 + 0.1, H + B - 1.5), P3(cx0 + nl - 0.12, y0 + D - 0.1, H + B - 1.5), P3(cx0 + 0.5, y0 + D - 0.1, B + 15), P3(cx0 + 0.5, y0 + 0.1, B + 15)], lit ? '#ffe9a8' : '#24384a');
            line(P3(cx0 + 0.5, y0 + D / 2, B + 15).x, P3(cx0 + 0.5, y0 + D / 2, B + 15).y, P3(cx0 + nl - 0.12, y0 + D / 2, H + B - 1.5).x, P3(cx0 + nl - 0.12, y0 + D / 2, H + B - 1.5).y, '#dfe4ea', 1.2 * z);
            poly([P3(cx0 + 0.15, y0, B + 9), P3(cx0 + 0.15, y0 + D, B + 9), P3(cx0 + 0.32, y0 + D, B + 11.5), P3(cx0 + 0.32, y0, B + 11.5)], '#3a3f47');
            [0.22, 0.78].forEach(v => { const q = P3(cx0 + 0.36, y0 + v * D, B + 13); circle(q.x, q.y, 1.5 * z, '#e5484d', '#9aa3ad', 0.5 * z); if (lit) glow(q.x, q.y, 10 * z, 0.6); });
          }
          const bx = cx0 + nl, bw = L - nl - nr, b = box(bx, y0, bw, D, H, '#f4f6f8', B, { top: '#dfe4ea', shadow: false });
          wallRect(b.left, B, 0, 1, 3, 7, '#2f6fb2'); wallRect(b.left, B, 0, 1, 7, 8.6, '#e5484d');
          const nWin = Math.max(2, Math.round(bw / 0.95)); for (let w2 = 0; w2 < nWin; w2++) { const u0 = 0.14 + w2 * (0.72 / nWin), u1 = u0 + 0.72 / nWin - 0.04; wallRect(b.left, B, u0, u1, 12, 21, lit ? '#ffe39a' : '#2f4a5a', '#c9cfd6', 0.6); }
          [0.02, 0.89].forEach(u => { wallRect(b.left, B, u, u + 0.09, 2.5, 23, open2 ? '#4a525c' : '#e3e8ed', '#9aa3ad', 0.6); if (!open2) wallRect(b.left, B, u + 0.02, u + 0.07, 13, 20, lit ? '#ffe39a' : '#2f4a5a'); });
          wallRect(b.left, B, 0.42, 0.58, H - 4, H - 1.5, '#2f6fb2');
          if (kind === 1) { const r0 = P3(bx + bw / 2 - 0.4, y0 + D / 2, H + B), r1 = up(r0, 7 * z), r2 = P3(bx + bw / 2 + 0.4, y0 + D / 2, H + B + 7); line(r0.x, r0.y, r1.x + 6 * z, r1.y, '#5b6470', 1 * z); line(r1.x + 6 * z, r1.y, r2.x, r2.y, '#5b6470', 1 * z); line(r2.x - 8 * z, r2.y, r2.x + 6 * z, r2.y, '#5b6470', 1.4 * z); }
          if (nr) {   // the front: a sloped nose with the windscreen and the lights, coming towards you
            const x1 = bx + bw, x2 = x1 + nr;
            poly([P3(x1, y0, H + B), P3(x1, y0 + D, H + B), P3(x2 - 0.15, y0 + D, B + 9), P3(x2 - 0.15, y0, B + 9)], '#dfe4ea');
            poly([P3(x1 + 0.12, y0 + 0.1, H + B - 1.5), P3(x1 + 0.12, y0 + D - 0.1, H + B - 1.5), P3(x2 - 0.45, y0 + D - 0.1, B + 15), P3(x2 - 0.45, y0 + 0.1, B + 15)], lit ? '#ffe9a8' : '#24384a');
            poly([P3(x1, y0 + D, B), P3(x2, y0 + D, B + 1), P3(x2 - 0.15, y0 + D, B + 9), P3(x1, y0 + D, H + B)], '#f4f6f8', '#c9cfd6', 0.6 * z);
            poly([P3(x1, y0 + D, B + 3), P3(x2 - 0.05, y0 + D, B + 3), P3(x2 - 0.08, y0 + D, B + 7), P3(x1, y0 + D, B + 7)], '#2f6fb2');
            poly([P3(x2, y0, B + 1), P3(x2, y0 + D, B + 1), P3(x2 - 0.15, y0 + D, B + 9), P3(x2 - 0.15, y0, B + 9)], '#eef1f4', '#c9cfd6', 0.6 * z);
            [0.25, 0.75].forEach(v => { const q = P3(x2 - 0.05, y0 + v * D, B + 4.5); circle(q.x, q.y, 1.7 * z, lit ? '#fffbe0' : '#f8f2c8', '#9aa3ad', 0.5 * z); if (lit) glow(q.x, q.y, 14 * z, 0.8); });
          }
        };
        const LEN = [4.7, 4.5, 4.7];
        let cxs = x + off; LEN.forEach((L, i) => { if (i) { const g0 = cxs - 0.25; box(g0, y0 + 0.3, 0.25, D - 0.6, H - 6, '#3a3f47', B + 2, { shadow: false }); } car(cxs, L, i === 0 ? 2 : i === LEN.length - 1 ? 0 : 1); cxs += L + 0.25; });
        ctx.restore(); return true; }
      case 'departures': { [0.1, 0.9].forEach(u => { const a = iso(x + u * d.w, y + d.d / 2), b2 = up(a, 34 * z); line(a.x, a.y, b2.x, b2.y, '#5b6470', 1.4 * z); });
        box(x, y, d.w, d.d, 24, '#1d1d22', 34, { shadow: false, top: '#2d2d34' });
        if (z > 0.3) trainBoard().forEach((r, k2) => txt(0.5, 53 - k2 * 6, r, 4, k2 ? '#ffd36b' : '#ffffff', 700)); return true; }
      case 'ticketmachines': { [0, 1].forEach(k2 => { const b = box(x + k2 * d.w / 2 + 0.1, y, d.w / 2 - 0.2, d.d, 40, '#2f6fb2', 0, { top: '#24589a' }); const q = wallPt(b.left, 0, 0.5, 30); rrect(q.x - 5 * z, q.y - 4 * z, 10 * z, 8 * z, 1 * z, '#9fd3f2'); const s2 = wallPt(b.left, 0, 0.5, 16); rrect(s2.x - 3 * z, s2.y - 1 * z, 6 * z, 2 * z, 0.5 * z, '#1d1d22'); if (z > 0.35) emoji('🎫', q.x, q.y + 1 * z, 5 * z); }); return true; }
      case 'kiosk': { const b = box(x, y, d.w, d.d, 16, '#2f5d50', 0, { top: '#c99a6b' }); [0.05, 0.95].forEach(u => wallLine(b.left, 0, u, 16, u, 40, '#2f5d50', 1.2)); for (let k2 = 0; k2 < 8; k2++) wallRect(b.left, 0, k2 / 8, (k2 + 1) / 8, 40, 46, k2 % 2 ? '#fffaf0' : '#2f5d50');
        const q = up(c, 16 * z); emoji('☕', q.x - 6 * z, q.y, 9 * z); emoji('🥯', q.x + 6 * z, q.y + 1 * z, 9 * z); return true; }
      case 'bigclock': { const tp = up(c, 94 * z), m = up(c, 70 * z); line(tp.x, tp.y, m.x, m.y - 8 * z, '#5b6470', 1 * z); circle(m.x, m.y, 8 * z, '#fffaf0', '#2d2d34', 1.4 * z); const tm = new Date();
        line(m.x, m.y, m.x + Math.sin(tm.getHours() / 6 * Math.PI) * 4 * z, m.y - Math.cos(tm.getHours() / 6 * Math.PI) * 4 * z, '#2d2d34', 1.2 * z); line(m.x, m.y, m.x + Math.sin(tm.getMinutes() / 30 * Math.PI) * 6 * z, m.y - Math.cos(tm.getMinutes() / 30 * Math.PI) * 6 * z, '#2d2d34', 0.8 * z); return true; }
      // ----- the hotel room -----
      // ----- v0.41: the amusement park -----
      case 'ferris': { const rd = meS.use && !meS.moving && meS.use.ride === 'wheel' ? S.me.look : null; flatRect(x - 0.2, y, d.w + 0.4, d.d, '#d9d4ca'); ferrisWheel(x + d.w / 2, y + d.d / 2, 92, ts, rd); return true; }
      case 'coasterride': { const rd = meS.use && !meS.moving && meS.use.ride === 'coaster' ? S.me.look : null; coaster(x + d.w / 2, y + d.d / 2, d.w * 0.42, d.d * 0.42, ts, rd); return true; }
      case 'carouselride': { const rd = meS.use && !meS.moving && meS.use.ride === 'carousel' ? S.me.look : null; carousel(x + d.w / 2, y + d.d / 2, d.w * 0.42, ts, rd); return true; }
      case 'bumpers': { const rd = meS.use && !meS.moving && meS.use.ride === 'bumper' ? S.me.look : null; bumperCars(x, y, d.w, d.d, ts, rd); return true; }
      case 'minigolf': {   // a little course: green carpet, a wooden edge, a windmill, the flag
        flatRect(x, y, d.w, d.d, '#8a6a4a'); flatRect(x + 0.12, y + 0.12, d.w - 0.24, d.d - 0.24, '#3fa55a');
        flatRect(x + 0.12, y + d.d * 0.45, d.w - 0.24, 0.4, '#4cb868');
        const hole = iso(x + d.w * 0.82, y + d.d * 0.3); ellipse(hole.x, hole.y, 4 * z, 2 * z, '#1d2a1d'); line(hole.x, hole.y, hole.x, hole.y - 22 * z, '#f4f4f0', 1.2 * z); pg([[hole.x, hole.y - 22 * z], [hole.x + 9 * z, hole.y - 19 * z], [hole.x, hole.y - 16 * z]], '#e5484d');
        const m = { x: x + d.w * 0.4, y: y + d.d * 0.35 }; box(m.x - 0.4, m.y - 0.3, 0.8, 0.6, 18, '#f4ead8', 0, { top: '#e5484d' }); const hub = up(iso(m.x, m.y + 0.3), 16 * z);
        for (let k2 = 0; k2 < 4; k2++) { const a = t * 1.6 + k2 * Math.PI / 2; poly([hub, { x: hub.x + Math.cos(a - 0.18) * 16 * z, y: hub.y + Math.sin(a - 0.18) * 16 * z }, { x: hub.x + Math.cos(a + 0.18) * 16 * z, y: hub.y + Math.sin(a + 0.18) * 16 * z }], '#ffffff', '#8a6a4a', 0.6 * z); }
        const bl = iso(x + d.w * 0.15, y + d.d * 0.8); circle(bl.x, bl.y - 1.5 * z, 2 * z, '#ffffff', '#c9cfd6', 0.5 * z);
        if (z > 0.4) { const q = up(c, 30 * z); pill(`⛳ ${curLang() === 'zh' ? '迷你高尔夫' : 'Mini golf'}`, q.x, q.y, '#3fa55a', '#ffffff', `800 ${Math.max(8, 8 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(12, 14 * z)); }
        return true;
      }
      case 'stage': {   // a little stage with lights, speakers and a microphone: karaoke
        box(x, y, d.w, d.d, 8, '#3a2f4a', 0, { top: '#5a4a72' });
        [[0.08, '#e5484d'], [0.92, '#e5484d']].forEach(([u]) => { const a = iso(x + u * d.w, y + 0.2); box(x + u * d.w - 0.25, y + 0.1, 0.5, 0.5, 26, '#2d2d34', 8); });
        const back = [iso(x, y), iso(x + d.w, y)]; poly([up(back[0], 8 * z), up(back[1], 8 * z), up(back[1], 52 * z), up(back[0], 52 * z)], '#6b2a6b'); for (let k2 = 0; k2 < 8; k2++) { const q = lerp(up(back[0], 52 * z), up(back[1], 52 * z), (k2 + 0.5) / 8); circle(q.x, q.y + 3 * z, 2 * z, Math.floor(t * 3 + k2) % 2 ? '#ffd36b' : '#ec6aa8'); if (NIGHT > 0.3) glow(q.x, q.y, 8 * z, 0.4); }
        const mic = up(iso(x + d.w / 2, y + d.d * 0.6), 8 * z); line(mic.x, mic.y, mic.x, mic.y - 20 * z, '#2d2d2d', 1.4 * z); circle(mic.x, mic.y - 21 * z, 2.2 * z, '#8a9099');
        if (z > 0.4) { const q = up(c, 62 * z); pill(`🎤 ${curLang() === 'zh' ? '卡拉OK' : 'Karaoke'}`, q.x, q.y, '#6b2a6b', '#ffe17a', `800 ${Math.max(8, 8 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(12, 14 * z)); }
        return true;
      }
      case 'candycart': { box(x, y, d.w, d.d, 14, '#f2a6c8', 0, { top: '#ffffff' }); const q = up(c, 14 * z); ellipse(q.x, q.y - 8 * z, 8 * z, 7 * z, '#f7c6dc'); line(q.x, q.y, q.x, q.y - 4 * z, '#ffffff', 1 * z); const r2 = up(c, 34 * z); for (let k2 = 0; k2 < 5; k2++) poly([r2, { x: r2.x - 16 * z + k2 * 8 * z, y: r2.y + 8 * z }, { x: r2.x - 8 * z + k2 * 8 * z, y: r2.y + 8 * z }], k2 % 2 ? '#ffffff' : '#ec6aa8'); return true; }
      case 'balloons': { for (let k2 = 0; k2 < 5; k2++) { const wv = Math.sin(t * 2 + k2) * 1.6 * z, q = { x: c.x + (k2 - 2) * 4 * z + wv, y: c.y - 34 * z - (k2 % 2) * 6 * z }; line(c.x, c.y - 8 * z, q.x, q.y + 5 * z, '#888', 0.5 * z); ellipse(q.x, q.y, 4 * z, 5 * z, RIDE_COLS[k2]); } return true; }
      case 'parktree': drawWildTree(x + 0.4, y + 0.4, 0.5, ts); return true;
      // ----- v0.42: the zoo -----
      case 'path': flatRect(x, y, d.w, d.d, '#e9dcb8'); return true;
      case 'zoopen': {   // an enclosure (you can be in the petting farm), with a little sign at the front
        const me = meS.use && !meS.moving && meS.use.ride === d.k ? { at: [x + d.w * 0.5, y + d.d * 0.62], look: S.me.look } : null;
        const feed = d.k === 'giraffe' && meS.use && !meS.moving && meS.use.k === 'giraffefeed' ? d.feedAt : null;
        zooPen(d.pen, x, y, d.w, d.d, ts, 1.5, { feed, me });
        const sp = iso(x + 0.5, y + d.d + 0.25); line(sp.x, sp.y, sp.x, sp.y - 14 * z, '#7a5a3a', 1.4 * z); rrect(sp.x - 9 * z, sp.y - 24 * z, 18 * z, 11 * z, 2 * z, '#c9a36a', '#7a5a3a', 0.8 * z);
        emoji((ZOO_ANIMALS[d.k] || { e: '🐐' }).e, sp.x, sp.y - 18.5 * z, 8 * z);
        return true;
      }
      case 'feedplatform': {   // a wooden deck with a railing, up to giraffe height
        box(x, y, d.w, d.d, 12, '#8a6a4a', 0, { top: '#c9a36a' });
        [[x, y, x + d.w, y], [x + d.w, y, x + d.w, y + d.d]].forEach(([ax, ay, bx, by]) => { const a = up(iso(ax, ay), 12 * z), b2 = up(iso(bx, by), 12 * z); line(a.x, a.y - 10 * z, b2.x, b2.y - 10 * z, '#7a5a3a', 1.4 * z); [0, 0.5, 1].forEach(u => { const q = lerp(a, b2, u); line(q.x, q.y, q.x, q.y - 10 * z, '#7a5a3a', 1.2 * z); }); });
        for (let k2 = 0; k2 < 3; k2++) box(x + 0.15 + k2 * 0.35, y + d.d, 0.35, 0.5, 9 - k2 * 3, '#a0805a', 0, { top: '#c9a36a', shadow: false });
        const q = up(iso(x + 0.4, y + 0.4), 12 * z); emoji('🥬', q.x, q.y - 4 * z, 9 * z);
        return true;
      }
      case 'zooshop': {   // a little shop hut with a green and white awning and plush animals in the window
        const b = box(x, y, d.w, d.d, 30, '#efe3c4', 0, { top: '#3f8a4a' });
        for (let k2 = 0; k2 < 8; k2++) wallRect(b.left, 0, k2 / 8, (k2 + 1) / 8, 24, 30, k2 % 2 ? '#ffffff' : '#3f8a4a');
        wallRect(b.left, 0, 0.1, 0.9, 6, 20, NIGHT > 0.3 ? '#ffe39a' : '#bfe6f7', '#fffaf0', 1.2);
        ['🦁', '🐘', '🦒', '🐧'].forEach((e, k2) => { const q = wallPt(b.left, 0, 0.18 + k2 * 0.21, 10); emoji(e, q.x, q.y, 8 * z); });
        if (z > 0.4) { const q = up(c, 44 * z); pill(`🧸 ${curLang() === 'zh' ? '纪念品' : 'Gifts'}`, q.x, q.y, '#3f8a4a', '#ffffff', `800 ${Math.max(8, 8 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(12, 14 * z)); }
        return true;
      }
      case 'popcorn': { box(x, y, d.w, d.d, 16, '#e5484d', 0, { top: '#ffffff' }); const q = up(c, 16 * z); rrect(q.x - 7 * z, q.y - 16 * z, 14 * z, 14 * z, 2 * z, 'rgba(255,250,230,.85)', '#e5484d', 0.8 * z); for (let k2 = 0; k2 < 7; k2++) circle(q.x - 4 * z + (k2 % 4) * 2.6 * z, q.y - 6 * z - Math.floor(k2 / 4) * 3 * z, 1.6 * z, '#fff3c4'); emoji('🍿', q.x, q.y - 22 * z, 9 * z); return true; }
      case 'zoomap': { const a = iso(x + 0.2, y + 0.15), b2 = iso(x + d.w - 0.2, y + 0.15); [a, b2].forEach(q => line(q.x, q.y, q.x, q.y - 20 * z, '#7a5a3a', 1.4 * z)); poly([up(a, 18 * z), up(b2, 18 * z), up(b2, 34 * z), up(a, 34 * z)], '#fffaf0', '#7a5a3a', 1 * z);
        ['🦁', '🐘', '🐧', '🐼'].forEach((e, k2) => { const q = up(lerp(a, b2, 0.2 + k2 * 0.2), 26 * z); emoji(e, q.x, q.y, 5 * z); }); return true; }
      // ----- v0.42: the stadium -----
      case 'stands': case 'standsback': {   // v0.55: tiers of seats full of both teams' fans in their colours (arena.js)
        const back = (d.draw || d.kind) === 'standsback', meRow = !back && meS.use && !meS.moving && meS.use.ride === 'seats' ? 1 : -1;
        drawArenaStand(x, y, d.w, d.d, back, ts, arenaNow(VIEW_TOWN), meRow, S.me.look);
        return true;
      }
      case 'pitch': {   // the field with today's league game on it (arena.js), and a low padded wall round it in the home team's colour
        const A = arenaNow(VIEW_TOWN), col = !A.off ? lgTeam(A.sp, A.h).c[0] : townTeam(VIEW_TOWN).T.c[0], lit = NIGHT > 0.3 && !A.off && A.state === 'live';
        flatRect(x - 0.3, y - 0.3, d.w + 0.6, d.d + 0.6, '#b88a5a');
        flatRect(x, y, d.w, d.d, !A.off && (A.sp === 'hockey' || A.sp === 'basketball') ? '#8e99a6' : lit ? '#6cc25a' : '#5aa84f');   // indoor sports: the arena floor
        drawPitch(x, y, d.w, d.d, ts, A, true);
        box(x - 0.5, y + d.d + 0.3, d.w + 0.8, 0.16, 9, col, 0, { shadow: false, top: shade(col, 0.2) });
        if (lit) [[x, y], [x + d.w, y], [x, y + d.d]].forEach(([lx, ly]) => { const q = iso(lx, ly); glow(q.x, q.y - 60 * z, 120 * z, 0.5); });
        return true;
      }
      case 'scoreboard': {   // a big screen in the corner: the sport, the clock, both teams and the score (or when the next game is)
        box(x + 0.9, y + 0.9, d.w - 1.8, d.d - 1.8, 70, '#5b6470', 0, { top: '#6b7480' });
        drawArenaBoard(up(iso(x + d.w / 2, y + d.d / 2), 70 * z), 80 * z, 50 * z, arenaNow(VIEW_TOWN));
        return true;
      }
      case 'hotdogstand': { const b = box(x, y, d.w, d.d, 16, '#e5484d', 0, { top: '#f2c230' }); [0.08, 0.92].forEach(u => wallLine(b.left, 0, u, 16, u, 38, '#c9cfd6', 1.2)); for (let k2 = 0; k2 < 6; k2++) wallRect(b.left, 0, k2 / 6, (k2 + 1) / 6, 36, 42, k2 % 2 ? '#ffffff' : '#e5484d');
        const q = up(c, 16 * z); emoji('🌭', q.x - 5 * z, q.y, 9 * z); emoji('🥤', q.x + 6 * z, q.y + 1 * z, 8 * z); return true; }
      case 'battingcage': {   // a long net tunnel: home plate at this end, a pitching machine at the far end
        flatRect(x, y, d.w, d.d, '#3fa55a'); flatRect(x + 0.2, y + d.d * 0.3, d.w - 0.4, d.d * 0.4, '#c9925a');
        const hp = iso(x + d.w - 0.7, y + d.d / 2); poly([{ x: hp.x - 3 * z, y: hp.y }, { x: hp.x, y: hp.y - 2 * z }, { x: hp.x + 3 * z, y: hp.y }, { x: hp.x, y: hp.y + 2 * z }], '#ffffff');
        box(x + 0.3, y + d.d / 2 - 0.35, 0.7, 0.7, 14, '#5b6470', 0, { top: '#6b7480' }); const m = up(iso(x + 0.65, y + d.d / 2), 14 * z); circle(m.x, m.y - 4 * z, 4 * z, '#9aa3ad', '#2d2d34', 1 * z);
        const T2 = (px, py) => up(iso(px, py), 34 * z), cs = [[x, y], [x + d.w, y], [x + d.w, y + d.d], [x, y + d.d]];
        cs.forEach(([px, py]) => { const a = iso(px, py), b2 = T2(px, py); line(a.x, a.y, b2.x, b2.y, '#5b6470', 1.4 * z); });
        poly(cs.map(([px, py]) => T2(px, py)), 'rgba(40,50,60,.10)', 'rgba(60,70,80,.7)', 1 * z);
        poly([iso(x, y + d.d), iso(x + d.w, y + d.d), T2(x + d.w, y + d.d), T2(x, y + d.d)], 'rgba(40,50,60,.12)', 'rgba(60,70,80,.5)', 0.8 * z);
        if (z > 0.4) { const q = T2(x + d.w / 2, y + d.d / 2); pill(`⚾ ${curLang() === 'zh' ? '本垒打大赛' : 'Home Run Derby'}`, q.x, q.y - 10 * z, '#2f5fa8', '#ffffff', `800 ${Math.max(8, 8 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(12, 14 * z)); }
        return true;
      }
      case 'kingbed': { box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 6, '#6b4428', 0); box(x, y, d.w, d.d, 4, '#ffffff', 6, { top: '#fbfbf7' }); box(x + 0.1, y + 0.15, 0.6, d.d - 0.3, 3, '#ffffff', 10, { shadow: false, top: '#ffffff' });
        box(x + 1.0, y + 0.05, d.w - 1.1, d.d - 0.1, 1.4, '#8a2a34', 10, { shadow: false, top: '#a23a44' }); box(x - 0.1, y - 0.05, 0.15, d.d + 0.1, 30, '#6b4428', 0, { shadow: false }); return true; }
      case 'minibar': { box(x, y, d.w, d.d, 18, '#3b3125', 0, { top: '#5a4632' }); const q = up(c, 18 * z); emoji('🍾', q.x - 4 * z, q.y, 8 * z); emoji('🥂', q.x + 5 * z, q.y + 1 * z, 8 * z); return true; }
      case 'pool': {   // a pool with a tiled edge, lanes and moving light on the water
        flatRect(x - 0.3, y - 0.3, d.w + 0.6, d.d + 0.6, '#f4efe6'); flatRect(x, y, d.w, d.d, '#3fb2d9');
        for (let k2 = 0; k2 < 14; k2++) { const u = (k2 * 0.37 + t * 0.06) % 1, v = (k2 * 0.61) % 1, q = iso(x + u * d.w, y + v * d.d); ellipse(q.x, q.y, 7 * z, 1.6 * z, 'rgba(255,255,255,.35)'); }
        [1, 2, 3].forEach(k2 => { const a = iso(x, y + k2 * d.d / 4), b2 = iso(x + d.w, y + k2 * d.d / 4); for (let s = 0; s < 16; s++) { const p0 = { x: a.x + (b2.x - a.x) * s / 16, y: a.y + (b2.y - a.y) * s / 16 }; circle(p0.x, p0.y, 1.2 * z, s % 2 ? '#ffffff' : '#e5484d'); } });
        const ld = iso(x + d.w - 0.2, y + d.d * 0.5); line(ld.x, ld.y, ld.x, ld.y - 10 * z, '#c9cfd6', 1.2 * z); line(ld.x + 4 * z, ld.y + 2 * z, ld.x + 4 * z, ld.y - 8 * z, '#c9cfd6', 1.2 * z);
        return true;
      }
      case 'lounger': { box(x + 0.15, y + 0.1, d.w - 0.3, d.d - 0.2, 4, '#e8e2d6', 0, { top: '#ffffff' }); box(x + 0.15, y + 0.1, d.w - 0.3, 0.5, 4, '#e8e2d6', 4, { top: '#ffffff', shadow: false }); const q = up(iso(x + d.w / 2, y + d.d * 0.7), 6 * z); rrect(q.x - 5 * z, q.y - 2 * z, 10 * z, 4 * z, 1.5 * z, '#38a3e0'); return true; }
      case 'umbrella': { const a = iso(x + 0.3, y + 0.3), tp = up(a, 30 * z); ellipse(a.x, a.y, 4 * z, 1.8 * z, '#5b6470'); line(a.x, a.y, tp.x, tp.y, '#e8e2d6', 1.2 * z); for (let k2 = 0; k2 < 8; k2++) { const a0 = k2 / 8 * Math.PI * 2, a1 = (k2 + 1) / 8 * Math.PI * 2; pg([[tp.x, tp.y - 4 * z], [tp.x + Math.cos(a0) * 20 * z, tp.y + Math.sin(a0) * 7 * z + 3 * z], [tp.x + Math.cos(a1) * 20 * z, tp.y + Math.sin(a1) * 7 * z + 3 * z]], k2 % 2 ? '#ffffff' : '#f59e0b'); } return true; }
      case 'barcart': { box(x, y, d.w, d.d, 14, '#c9a24a', 4, { top: '#fffaf0' }); [0.15, 0.85].forEach(u => { const q = iso(x + u * d.w, y + d.d); circle(q.x, q.y - 2 * z, 2 * z, '#2d2d2d'); }); const q = up(c, 18 * z); emoji('🍹', q.x - 4 * z, q.y, 7 * z); emoji('🥤', q.x + 5 * z, q.y + 1 * z, 7 * z); return true; }
      case 'aptmail': { const b = box(x, y, d.w, d.d, 40, '#c9a36a', 0, { top: '#d8b57e' }); for (let r = 0; r < 4; r++) for (let k2 = 0; k2 < 5; k2++) wallRect(b.right, 0, (k2 + 0.1) / 5, (k2 + 0.9) / 5, 5 + r * 8.5, 12 + r * 8.5, '#e8d3a8', '#a07a50', 0.6); return true; }
      case 'bikerack': { box(x, y + d.d / 2 - 0.05, d.w, 0.1, 6, '#9aa3ad', 0, { shadow: false }); [0.2, 0.55].forEach((u, k2) => { const q = iso(x + u * d.w + 0.3, y + d.d / 2 + 0.2); [-6, 6].forEach(o => ellipse(q.x + o * z, q.y - 6 * z, 5.5 * z, 5.5 * z, null, '#2d2d2d', 1.3 * z)); line(q.x - 6 * z, q.y - 6 * z, q.x + 6 * z, q.y - 8 * z, k2 ? '#38a3e0' : '#e5484d', 1.6 * z); }); return true; }
      case 'booktable': { box(x, y, d.w, d.d, 14, '#8a5a36', 0, { top: '#a46e40' }); for (let k2 = 0; k2 < 6; k2++) { const q = up(iso(x + 0.25 + (k2 % 3) * d.w / 3, y + 0.3 + Math.floor(k2 / 3) * 0.55), 14 * z); rrect(q.x - 4 * z, q.y - 4 * z - (k2 % 2) * 1.5 * z, 8 * z, 4 * z, 0.6 * z, ['#e5484d', '#2f6fb2', '#f2c230', '#34b27b', '#a46ef0', '#f59e0b'][k2], 'rgba(0,0,0,.25)', 0.4 * z); } const q = up(iso(x + d.w / 2, y + d.d / 2), 16 * z); if (z > 0.4) pill(curLang() === 'zh' ? '新书' : 'NEW', q.x, q.y - 12 * z, '#e5484d', '#ffffff', `800 ${Math.max(7, 7 * z)}px ${UI_FONT}`, Math.max(11, 12 * z)); return true; }
      case 'bookcat': { const q = iso(x + d.w / 2, y + d.d / 2); box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 8, '#2f6fb2', 0, { top: '#e5484d' }); drawAnimal('cat', 2, q.x, q.y - 6 * z, z * 1.3, { face: 1, ts, seed: 7, breed: 'tabby', moving: false, mood: 'happy' }); if (Math.sin(t * 0.7) > 0.3) emoji('💤', q.x + 10 * z, q.y - 22 * z, 7 * z); return true; }
      case 'mirror': { wallRect(F, 12, 0.05, 0.95, 0, 25, 'rgba(210,235,250,.9)', '#2d2d2d', 1.4); wallLine(F, 12, 0.3, 4, 0.55, 22, 'rgba(255,255,255,.7)', 1); [0.15, 0.85].forEach(u => { const q = wallPt(F, 12, u, 27); circle(q.x, q.y, 2 * z, '#fff2c4'); }); return true; }
      case 'salonchair': { const q = iso(x + d.w / 2, y + d.d / 2); ellipse(q.x, q.y, 9 * z, 4 * z, '#2d2d2d'); line(q.x, q.y, q.x, q.y - 6 * z, '#c9cfd6', 2 * z); box(x + 0.2, y + 0.2, d.w - 0.4, d.d - 0.4, 3, '#2d2d2d', 7, { top: '#3b3b44', shadow: false }); box(x + 0.2, y + 0.15, d.w - 0.4, 0.15, 14, '#2d2d2d', 10, { shadow: false }); return true; }
      case 'sinks': { const b = box(x, y, d.w, d.d, 16, '#2d2d2d', 0, { top: '#3b3b44' }); [0.25, 0.75].forEach(v => { const q = up(iso(x + d.w / 2, y + v * d.d), 16 * z); ellipse(q.x, q.y, 6 * z, 3 * z, '#ffffff', '#c9cfd6', 0.6 * z); line(q.x - 3 * z, q.y - 3 * z, q.x - 3 * z, q.y - 9 * z, '#c9cfd6', 1 * z); }); return true; }
      case 'products': { const b = box(x, y, d.w, d.d, 40, '#ffffff', 0, { top: '#f4f4f0' }); [8, 20, 32].forEach(h => [0, 1, 2].forEach(k2 => { const q = wallPt(b.left, 0, (k2 + 0.5) / 3, h - 6); rrect(q.x - 1.8 * z, q.y - 6 * z, 3.6 * z, 6 * z, 1 * z, ['#ec6aa8', '#a46ef0', '#38a3e0'][(k2 + h) % 3]); })); return true; }
      case 'buckets': { for (let k2 = 0; k2 < 6; k2++) { const u = (k2 % 3 + 0.5) / 3, v = Math.floor(k2 / 3) ? 0.7 : 0.3, q = iso(x + u * d.w, y + v * d.d); ellipse(q.x, q.y - 2 * z, 7 * z, 3 * z, '#9aa3ad', '#5b6470', 0.6 * z); rrect(q.x - 6 * z, q.y - 10 * z, 12 * z, 9 * z, 2 * z, '#c9cfd6'); ['🌷', '🌹', '🌻', '🌼', '💐', '🌸'].slice(k2 % 3, k2 % 3 + 2).forEach((e, j) => emoji(e, q.x + (j ? 3 : -3) * z, q.y - 14 * z, 8 * z)); } return true; }
      case 'potshelf': { const b = box(x, y, d.w, d.d, 36, '#a46e40', 0, { top: '#c99a6b' }); [8, 20, 32].forEach((h, r) => [0, 1, 2, 3, 4].forEach(k2 => { const q = wallPt(b.left, 0, (k2 + 0.5) / 5, h - 7); rrect(q.x - 2.5 * z, q.y - 4 * z, 5 * z, 4 * z, 1 * z, '#c0603c'); emoji(['🌱', '🌵', '🌿', '🪴', '🌺'][(k2 + r) % 5], q.x, q.y - 5 * z, 6 * z); })); return true; }
      case 'flowerfridge': { const b = box(x, y, d.w, d.d, 46, '#e8ecf0', 0, { top: '#ffffff' }); wallRect(b.left, 0, 0.03, 0.97, 4, 42, 'rgba(160,210,240,.45)', '#ffffff', 1); [10, 24, 36].forEach((h, r) => [0, 1, 2, 3].forEach(k2 => { const q = wallPt(b.left, 0, (k2 + 0.5) / 4, h - 4); emoji(['🌹', '🌷', '💐', '🌸'][(k2 + r) % 4], q.x, q.y, 8 * z); })); return true; }
      case 'floraltable': { box(x, y, d.w, d.d, 15, '#c99a6b', 0, { top: '#e6c79a' }); const q = up(iso(x + d.w * 0.4, y + d.d / 2), 15 * z); emoji('💐', q.x, q.y - 4 * z, 12 * z); const r0 = up(iso(x + d.w * 0.8, y + d.d * 0.3), 15 * z); line(r0.x - 4 * z, r0.y, r0.x + 6 * z, r0.y - 2 * z, '#ec6aa8', 1.4 * z); return true; }
      case 'hangplant': { const top = up(c, 80 * z), pot = up(c, 58 * z); line(top.x, top.y, pot.x, pot.y, 'rgba(90,70,50,.6)', 0.7 * z); ellipse(pot.x, pot.y, 5 * z, 3 * z, '#c0603c'); for (let k2 = 0; k2 < 5; k2++) { const a = -0.8 + k2 * 0.4; line(pot.x, pot.y, pot.x + Math.sin(a) * 7 * z, pot.y + 8 * z + Math.abs(a) * 2 * z, '#4f9a4b', 1.4 * z); } circle(pot.x, pot.y - 2 * z, 4.5 * z, '#6cbf73'); return true; }
      // ----- the supermarket -----
      case 'produce': {   // a market stand with crates of fruit and veg, tilted towards you
        box(x, y, d.w, d.d, 12, '#8a5a36', 0, { top: '#a46e40' });
        const items = ['🍎', '🍌', '🥕', '🥦', '🍅', '🍇', '🍋', '🥬'];
        for (let k2 = 0; k2 < 8; k2++) { const u = (k2 % 4 + 0.5) / 4, v = Math.floor(k2 / 4) ? 0.72 : 0.28, q = up(iso(x + u * d.w, y + v * d.d), 12 * z); rrect(q.x - 6 * z, q.y - 3 * z, 12 * z, 5 * z, 1 * z, '#c99a6b'); emoji(items[k2], q.x - 2 * z, q.y - 1 * z, 7 * z); emoji(items[k2], q.x + 3 * z, q.y, 7 * z); }
        if (z > 0.4) { const q = up(c, 30 * z); pill(curLang() === 'zh' ? '🥬 生鲜' : '🥬 Fresh', q.x, q.y, '#34b27b', '#ffffff', `800 ${Math.max(8, 8 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(12, 14 * z)); }
        return true;
      }
      case 'localstand': {   // v0.40: a stall of the county's specialties under a striped awning, a little board with the county's name
        const C = countyOf(VIEW_TOWN), sp = C.specials, PL = stateOf(VIEW_TOWN).plate, col = [PL.top, PL.band, PL.fg, PL.bg].find(k4 => k4 && lumOf(k4) < 0.75) || '#e5484d';
        box(x, y, d.w, d.d, 13, '#a46e40', 0, { top: '#c99a6b' });
        [0.12, 0.88].forEach(u => { const a = iso(x + u * d.w, y + 0.12), b = up(a, 40 * z); line(a.x, a.y, b.x, b.y, '#8a5a36', 2 * z); });
        for (let k2 = 0; k2 < 6; k2++) { const a = up(iso(x + k2 / 6 * d.w, y), 40 * z), b = up(iso(x + (k2 + 1) / 6 * d.w, y), 40 * z), a2 = up(iso(x + k2 / 6 * d.w, y + 0.7), 34 * z), b2 = up(iso(x + (k2 + 1) / 6 * d.w, y + 0.7), 34 * z); poly([a, b, b2, a2], k2 % 2 ? '#ffffff' : col); }
        sp.forEach((k3, i) => { const q = up(iso(x + (i + 0.5) / sp.length * d.w, y + d.d * 0.5), 13 * z); rrect(q.x - 9 * z, q.y - 4 * z, 18 * z, 6 * z, 1.2 * z, '#f4ead8', '#c99a6b', 0.6 * z); emoji(SPECIALTIES[k3].e, q.x, q.y - 6 * z, 13 * z); });
        if (z > 0.4) { const q = up(c, 48 * z); pill(`🧺 ${nm(C)}`, q.x, q.y, '#3b3125', '#ffe17a', `800 ${Math.max(8, 8 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(12, 14 * z)); }
        return true;
      }
      case 'grocery': {   // a supermarket aisle shelf, stocked both sides
        const b = box(x, y, d.w, d.d, 34, '#f4f4f0', 0, { top: '#e8ecf0' }), cols = ['#e5484d', '#f2c230', '#38a3e0', '#34b27b', '#f59e0b', '#a46ef0', '#ec6aa8'];
        [4, 13, 22, 31].forEach((h, r) => { wallRect(b.left, 0, 0.01, 0.99, h - 1, h, '#c9cfd6'); for (let k2 = 0; k2 < 10; k2++) wallRect(b.left, 0, k2 / 10 + 0.01, (k2 + 1) / 10 - 0.01, h - 7, h - 1, cols[(k2 * 3 + r + Math.round(x)) % cols.length]); });
        return true;
      }
      case 'dairy': { const b = box(x, y, d.w, d.d, 46, '#e8ecf0', 0, { top: '#ffffff' }), along = d.w > d.d, Fd = along ? b.left : b.right; wallRect(Fd, 0, 0.02, 0.98, 4, 42, 'rgba(160,210,240,.5)', '#ffffff', 1); [10, 22, 34].forEach((h, r) => [0, 1, 2, 3, 4].forEach(k2 => { const q = wallPt(Fd, 0, (k2 + 0.5) / 5, h - 4); emoji(['🥛', '🧀', '🥚', '🧈', '🍦'][(k2 + r) % 5], q.x, q.y, 7 * z); })); if (NIGHT > 0.2) glow(c.x, c.y - 26 * z, 40 * z, 0.35); return true; }
      case 'checkout': { const b = box(x, y, d.w, d.d, 15, '#5b6470', 0, { top: '#2d2d34' }); const q = up(iso(x + d.w * 0.75, y + d.d / 2), 15 * z); rrect(q.x - 4 * z, q.y - 8 * z, 8 * z, 6 * z, 1 * z, '#1b2a3a'); rrect(q.x - 3 * z, q.y - 7 * z, 6 * z, 4 * z, 0.5 * z, '#38d39f'); const p = up(iso(x + d.w * 0.3, y + d.d / 2), 15 * z); emoji('🛍️', p.x, p.y - 1 * z, 7 * z); const lt = up(iso(x + d.w - 0.1, y + 0.1), 40 * z), lb = iso(x + d.w - 0.1, y + 0.1); line(lb.x, lb.y, lt.x, lt.y, '#9aa3ad', 1 * z); rrect(lt.x - 4 * z, lt.y - 4 * z, 8 * z, 6 * z, 1.5 * z, '#e5484d'); return true; }
      case 'cart': { const a = iso(x + 0.1, y + 0.1); [[0, 0], [14, 7], [0, 7], [14, 0]].forEach(([dx, dy]) => circle(a.x + (dx - 4) * z, a.y + dy * 0.4 * z, 1.4 * z, '#2d2d2d')); pg([[a.x - 6 * z, a.y - 14 * z], [a.x + 12 * z, a.y - 14 * z], [a.x + 10 * z, a.y - 3 * z], [a.x - 4 * z, a.y - 3 * z]], 'rgba(200,205,212,.7)', '#7d848c', 0.8 * z); emoji(['🥖', '🍎', '🥛'][Math.round(x) % 3], a.x + 3 * z, a.y - 13 * z, 7 * z); return true; }
    }
    return false;
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
      case 'table': drawDecor({ kind: 'table', x, y, w: d.w, d: d.d, i: d.i || 0, menu: d.menu, mine: d.kind === 'spot', crew: d.crew, seats: d.seats }, ts); break;
      case 'menuboard': drawMenuBoard(d, ts); break;
      case 'glass': drawDecor(d, ts); break;
      case 'bench': drawDecor(d, ts); break;
      case 'chairs': { const n = d.n || 4, sw = d.w / n; for (let k = 0; k < n; k++) { box(x + k * sw + 0.05, y + 0.1, sw - 0.1, d.d - 0.2, 7, '#5aa2e0', 0, { top: '#7cb8ea' }); box(x + k * sw + 0.05, y, sw - 0.1, 0.15, 16, '#4a8fd0', 0, { shadow: false }); if ((d.sat || []).includes(k)) { const id = castId('wait' + k + ':' + y, true), q = iso(x + k * sw + sw / 2, y + 0.45); drawPerson(q.x, q.y, z, { look: castLook(id, FOLK(k + 2)), face: -1, energy: k ? 'tired' : 'good', ts, seed: k + y, pose: 'sit', seatH: 7, sit: ['phone', 'lean', 'read', 'chin'][(k + Math.round(y)) % 4] }); folkSeen(id, x + k * sw + sw / 2, y + 0.45, q, z, ts); } } break; }
      case 'exambed': { box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 8, '#c9cfd6', 0); box(x, y, d.w, d.d, 3, '#e8f4f6', 8, { top: '#f6fbfc' }); box(x + d.w - 0.6, y + 0.15, 0.45, d.d - 0.3, 2, '#ffffff', 11, { shadow: false }); box(x + 0.2, y - 0.1, d.w - 0.4, 0.1, 40, 'rgba(159,214,210,.5)', 0, { shadow: false, edge: null }); break; }
      case 'healthpod': { const b = box(x + 0.15, y + 0.15, d.w - 0.3, d.d - 0.3, 4, '#d6dce2', 0, { top: '#eef2f5' }); box(x + 0.2, y + 0.1, 0.2, 0.2, 40, '#9aa3ad', 0, { shadow: false }); const q = up(iso(x + 0.3, y + 0.2), 44 * z); rrect(q.x - 9 * z, q.y - 7 * z, 18 * z, 12 * z, 2 * z, '#1b2a3a', '#9aa3ad', 0.8 * z); emoji('❤️', q.x, q.y + 3 * z, 7 * z); break; }
      case 'medshelf': { const b = box(x, y, d.w, d.d, 44, '#ffffff', 0, { top: '#f4f4f0' }); [12, 26, 40].forEach(h => ['💊', '🧴', '🩹', '💊'].forEach((e, k) => { const q = wallPt(b.left, 0, (k + 0.5) / 4, h - 8); emoji(e, q.x, q.y, 8 * z); })); wallRect(b.left, 0, 0.35, 0.65, 34, 42, '#e5484d'); const q = wallPt(b.left, 0, 0.5, 38); emoji('➕', q.x, q.y + 3 * z, 7 * z); break; }
      case 'watercooler': { box(x + 0.1, y + 0.1, d.w - 0.2, d.d - 0.2, 20, '#e6e9ee', 0); const q = up(iso(x + d.w / 2, y + d.d / 2), 20 * z); ellipse(q.x, q.y - 7 * z, 6 * z, 9 * z, 'rgba(120,190,230,.75)'); break; }
      case 'bookwall': { const H = d.low ? 30 : 56, b = box(x, y, d.w, d.d, H, '#8a5a36', 0, { top: '#a46e40' }), cols = ['#e5484d', '#38a3e0', '#f2c230', '#34b27b', '#a46ef0', '#f59e0b', '#2f6fb2'], face = d.w > d.d ? b.left : b.right, len = Math.max(d.w, d.d);
        for (let s = 0; s < (d.low ? 2 : 4); s++) { const h0 = 3 + s * 13; wallRect(face, 0, 0.01, 0.99, h0 + 11, h0 + 12.4, '#6b4428'); for (let k = 0; k < len * 6; k++) { const u0 = k / (len * 6), u1 = (k + 0.8) / (len * 6); wallRect(face, 0, u0, u1, h0, h0 + 8 + hash(k, s) * 3, cols[(k * 3 + s) % cols.length]); } } break; }
      case 'bookstand': { box(x + 0.2, y + 0.2, d.w - 0.4, d.d - 0.4, 22, '#8a5a36', 0, { top: '#a46e40' }); const q = up(c, 30 * z); rrect(q.x - 12 * z, q.y - 9 * z, 24 * z, 16 * z, 2 * z, '#fffaf0', '#c9b98f', 1); line(q.x, q.y - 9 * z, q.x, q.y + 7 * z, '#c9b98f', 0.8 * z); emoji('⭐', q.x + 10 * z, q.y - 10 * z, 9 * z); break; }
      case 'longtable': { const R = d.readers || []; R.forEach(r => { const rx2 = r ? x + d.w + 0.45 : x - 0.45, id = castId('read' + r + ':' + y, true), q = iso(rx2, y + d.d / 2); drawPerson(q.x, q.y, z, { look: castLook(id, FOLK(r + 3)), face: r ? -1 : 1, back: !!r, energy: 'good', ts, seed: r + 4, pose: 'sit', seatH: 8, sit: r ? 'chin' : 'read' }); folkSeen(id, rx2, y + d.d / 2, q, z, ts); });
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
      case 'schooldesk': {   // v0.43: the kid faces the desk and the board (back to us)
        box(x, y, d.w, d.d, 14, '#c99a6b', 0, { top: '#e6c79a' }); box(x + d.w / 2 - 0.3, y + d.d + 0.05, 0.6, 0.5, 8, '#5aa2e0', 0, { top: '#7cb8ea' }); if (d.kid >= 0) { const q = iso(x + d.w / 2, y + d.d + 0.35); drawPerson(q.x, q.y, z, { look: FOLK(d.kid + 1), face: 1, back: true, energy: 'good', ts, seed: d.kid, pose: 'sit', seatH: 7 }); } const q = up(iso(x + 0.4, y + 0.4), 14 * z); emoji('📓', q.x, q.y, 8 * z); break; }
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
      default: if (!drawRoomThing(d, ts, i)) drawDecor(d, ts);   // v0.36
    }
  }
  // You inside: walking, or sitting / lying / working out at something (meS.use).
  function drawMeShop(z, ts) {
    const U = meS.use;
    const bar = (q, lift = 0) => { if (U.until) doBar(q.x, q.y - (60 + lift) * z, 1 - Math.max(0, U.until - performance.now()) / 1000 / (U.secs || 1), U.e || U.prop || U.food || '⏳', z); };
    if (U && U.ride && !meS.moving) { bar(iso(U.stand[0], U.stand[1]), 30); return; }   // v0.41: on a ride: the ride draws you
    if (U && !meS.moving) {
      if (S.me.look.mob === 'wheel' && ['sit', 'lie', 'bike', 'row'].includes(U.pose) && U.stand) {   // v0.43: a wheelchair stays on the floor, beside it
        const q = iso(U.stand[0], U.stand[1]); drawPerson(q.x, q.y, z, { look: S.me.look, face: U.face || 1, energy: energyLevel(), ts, seed: 3, pose: 'stand' });
        bar(q);
        return;
      }
      const p = iso(U.at[0], U.at[1]);
      drawPerson(p.x, p.y - (U.lift || 0) * z, z, { look: S.me.look, face: U.face || 1, view: U.view || null, turn: U.turn || [0, -1], energy: energyLevel(), ts, seed: 3, pose: U.pose, moving: !!U.moving, phase: ts / (U.pose === 'bike' ? 120 : 80), noBike: true, seatH: U.seatH, sit: U.sit, dir: U.dir, matCol: '#38a3e0' });
      if (U.mate && Math.floor(ts / 900) % 2 === 0) emoji('😄', p.x + 8 * z, p.y - 44 * z, 12 * z);
      if (U.food) { const q = up(iso(U.at[0] + 0.42, U.at[1]), 14 * z); emoji(U.food, q.x + 4 * z, q.y, 9 * z); }   // on the table in front of you
      if (U.prop) emoji(U.prop, p.x + 10 * z, p.y - (U.pose === 'lie' ? 14 : 20) * z - (U.lift || 0) * z, 10 * z);
      if (chatting() && CHAT.e) chatBubble(p.x - 12 * z, p.y - 56 * z, z, true, ts);
      bar(p, (U.lift || 0) + (U.pose === 'lie' ? -14 : 0));
      return;
    }
    const p2 = iso(meS.x, meS.y);
    drawPerson(p2.x, p2.y, z, { look: S.me.look, face: meS.face, back: meS.back && meS.moving, view: meS.view, turn: meS.turn, moving: meS.moving, phase: meS.phase, energy: energyLevel(), ts, seed: 3, pose: meS.moving ? 'walk' : 'stand', wave: chatting() && !!CHAT.e && !!CHAT.wave && !!FOLK_AT[CHAT.id] }); needBubble(p2, z, ts);
    carryBox(p2, z);
    if (chatting() && CHAT.e && FOLK_AT[CHAT.id]) chatBubble(p2.x - 12 * z, p2.y - 56 * z, z, true, ts);   // v0.34: talking with someone in here
  }
  // Sit at / work out on / lie on a thing for `secs` seconds (walking there first), then `done`.
  // v0.50: any store or building; a thing with no pose of its own (a shelf, a counter, an exhibit, 'till'): you stand at
  // it, facing it; no id: right where you are. `e` goes on the bar. Walk off before it's full and done() never comes.
  function venueUseNow(id, secs, done, mate, e, ex) {
    const P = shopPlan(owner), w = id && id !== 'till' ? P.wares.find(x => x.id === id || x.k === id) || P.wares.find(x => x.kind === id) : null;
    const stand = id === 'till' && P.till ? P.till : w ? (w.stand || [w.x + w.w / 2, w.y + w.d + 0.55]) : [meS.x, meS.y];
    const use = (w && w.use) || { pose: 'stand', view: 'back', turn: [0, -1] };
    const start = () => {
      const far = Math.hypot(meS.x - stand[0], meS.y - stand[1]) > 0.9, u = far ? { pose: 'stand', view: 'back', turn: [0, -1] } : use, here = [meS.x, meS.y];
      meS.use = { ...u, ...(ex || {}), at: far ? here : u.at || stand, k: w ? w.k : id, stand: far ? here : stand, secs, until: performance.now() + secs * 1000, done, e, mate: !far && u.mate ? mate || FOLK(3) : null };
    };
    if (!meS.moving && Math.hypot(meS.x - stand[0], meS.y - stand[1]) < 0.6) { meS.use = null; meS.eat = null; start(); }
    else if (!shopWalk(stand, start)) { const here = [meS.x, meS.y]; meS.use = { pose: 'stand', view: 'back', turn: [0, -1], ...(ex || {}), at: here, k: w ? w.k : id, stand: here, secs, until: performance.now() + secs * 1000, done, e }; }   // no way over: right here
  }
  // v0.50: sit down and eat (a table in the food court or the cafe; none: standing where you are), with the bar
  function shopEatNow(e, secs, done) {
    const P = shopPlan(owner), tw = P.wares.find(w => w.use && w.use.food && !w.use.mate);
    if (tw) return venueUseNow(tw.id, secs, done, null, e, { food: e });
    const tb = (P.decor || []).filter(d => d.kind === 'table' && d.i % 3 === 1)[0] || (P.decor || []).find(d => d.kind === 'table');
    if (!tb) return venueUseNow(null, secs, done, null, e, { prop: e });
    if (!shopWalk([tb.x + tb.w / 2 + 0.75, tb.y + tb.d / 2 + 0.05], () => { meS.sit = true; meS.face = -1; meS.eat = { e, secs, until: performance.now() + secs * 1000, done }; })) venueUseNow(null, secs, done, null, e, { prop: e });
  }
  function shopPlan(k) {
    if (MALL_FLOORS.includes(k)) return mallPlan(k);
    if (VENUE_LOOK[k]) return venuePlan(k);
    const FL = FURN_FLOORS.findIndex(F => F.key === k);   // v0.45: one floor of the furniture store
    const wares = FL >= 0 ? storeWares('furniture').filter(w => w.kind !== 'furn' || furnFloorOf(w.k) === FL) : storeWares(k);
    if (SHOPS[k] && SHOPS[k].n === wares.length) return SHOPS[k];
    const area = wares.reduce((t, w) => t + (w.w + 0.8) * (w.d + 1.5), 0), RW = clamp(Math.round(Math.sqrt(area) * 1.1) + 2, SHOP_W[k] || 13, 26), placed = [];   // v0.22: about square
    let x = 1, y = 1.3, rowD = 0;
    wares.forEach(w => {
      if (x + w.w > RW - 2.2) { x = 1; y += rowD + 1.5; rowD = 0; }   // v0.50: a walkway down the right (a full row was a wall)
      placed.push({ ...w, x, y });
      x += w.w + 0.8; rowD = Math.max(rowD, w.d);
    });
    let decor = [], extra = 0;
    if (k === 'market') {   // v0.37: a real supermarket below the seeds: fresh food (buy groceries), aisles, the dairy fridge, more tills, trolleys, shoppers
      const y0 = y + rowD + 1.6, dc = (kind, dx, dy, dw, dd, ex = {}) => decor.push({ kind, x: dx, y: dy, w: dw, d: dd, ...ex });
      placed.push({ id: 'spot:groceries', kind: 'spot', k: 'groceries', draw: 'produce', x: 1, y: y0, w: 3.2, d: 1.4, price: 0, stand: [2.6, y0 + 2.0] });
      // v0.50: gaps between them (they used to make a wall right across the store: you couldn't walk to the seeds)
      placed.push({ id: 'spot:local', kind: 'spot', k: 'local', draw: 'localstand', x: 14.2, y: y0, w: 3.0, d: 1.4, price: 0, stand: [15.7, y0 + 2.0] });   // v0.40: the county's specialties
      dc('grocery', 5.2, y0, 3.2, 0.8); dc('grocery', 5.2, y0 + 2.4, 3.2, 0.8); if (RW >= 15) { dc('grocery', 9.7, y0, 3.2, 0.8); dc('grocery', 9.7, y0 + 2.4, 3.2, 0.8); }
      dc('dairy', 0.3, y0 + 2.4, 0.7, 2.6);
      dc('person', 6.2, y0 + 1.5, 0.5, 0.5, { cast: true, view: 'back', turn: [0.2, -1] }); dc('cart', 6.7, y0 + 1.3, 0.6, 0.4);
      dc('person', 2.0, y0 + 2.3, 0.5, 0.5, { cast: true, face: -1, view: 'front', turn: [-0.3, 1] }); dc('cart', 2.4, y0 + 2.6, 0.6, 0.4);
      extra = 5.2;
    }
    if (FL >= 0) {   // v0.45: escalators up and down, in front of the shelves, on the right
      const y0 = y + rowD + 1.5, esc = (to, dir, ex) => placed.push({ id: 'esc:' + to, kind: 'escalator', k: to, dir, x: ex, y: y0, w: 1.6, d: 4.2, price: 0 });
      if (FL < FURN_FLOORS.length - 1) esc(FURN_FLOORS[FL + 1].key, 'up', RW - 2.6);
      if (FL > 0) esc(FURN_FLOORS[FL - 1].key, 'down', RW - 5.0);
      extra = 7;
    }
    const RD = Math.ceil(y + rowD + 4.6 + extra), counter = { x: RW - 4.4, y: RD - 2.9, w: 3.2, d: 0.9 };
    if (k === 'market') { decor.push({ kind: 'checkout', x: RW - 8.6, y: RD - 2.9, w: 2.4, d: 0.9 }, { kind: 'person', x: RW - 7.4, y: RD - 3.5, w: 0.5, d: 0.5, staff: true, face: -1, view: 'front', turn: [-0.2, 1], look: { shirt: '#3e7cc9', top: 'polo', hair: 'long', hairCol: '#6b4226', skin: '#d39a6c' } }, { kind: 'person', x: RW - 7.2, y: RD - 1.4, w: 0.5, d: 0.5, cast: true, view: 'back', turn: [0, -1] }, { kind: 'cart', x: RW - 6.6, y: RD - 1.5, w: 0.6, d: 0.4 }); }
    const plan = { k, n: wares.length, RW, RD, wares: placed, decor, counter, clerk: [counter.x + 1.6, counter.y - 0.6], till: [counter.x + 1.6, counter.y + 1.55], door: [3, RD - 0.7] };
    // where you can walk: half-tile cells, not on anything on show or the counter
    const GS = 0.5, gw = Math.ceil(RW / GS), gd = Math.ceil(RD / GS), g = new Uint8Array(gw * gd).fill(1);
    const block = (bx, by, bw, bd) => { for (let j = Math.floor((by - 0.2) / GS); j < (by + bd + 0.2) / GS; j++) for (let i = Math.floor((bx - 0.2) / GS); i < (bx + bw + 0.2) / GS; i++) if (i >= 0 && j >= 0 && i < gw && j < gd) g[j * gw + i] = 0; };
    placed.forEach(w => block(w.x, w.y, w.w, w.d));
    decor.filter(dd => dd.kind !== 'person' && dd.kind !== 'cart').forEach(dd => block(dd.x, dd.y, dd.w, dd.d));
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
  const FILM_SECS = 11.5;   // the cinema's short film
  const STALL_COL = { burger: '#e5484d', noodles: '#f59e0b', pizza: '#34b27b', sushi: '#38a3e0', boba: '#a46ef0', icecream: '#ec6aa8' };
  let FILM = null, FILM_CV = null, SHOP_FROM = null, CLAW_T = 0;
  function mallPlan(k) {
    const sig = k + ':' + EXCLUSIVES.filter(([kind, kk]) => exclOK(exclDef(kind, kk).excl)).length;
    if (SHOPS[k] && SHOPS[k].sig === sig) return SHOPS[k];
    const wares = [], decor = [], add = (kind, kk, x, y, w, d, ex = {}) => wares.push({ id: kind + ':' + kk, kind, k: kk, x, y, w, d, price: 0, ...ex }), dec = (kind, x, y, w, d, ex = {}) => decor.push({ kind, x, y, w, d, ...ex });
    let P;
    if (k === 'mall') {
      const RW = 18, RD = 16;
      Object.entries(CLOTHES).filter(([kk, c]) => c.price && kk !== 'nohat').forEach(([kk, c], i) => add('clothes', kk, 1.0 + (i % 5) * 1.1, 1.2 + Math.floor(i / 5) * 2.1, 0.8, 0.8, { act: 'buyClothes', arg: kk, price: c.price }));
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
    } else if (d.kind === 'table') {   // a round table with four stools; v0.34: people (real townsfolk) at some of them, each doing their own thing
      const rx = 0.55 * 45 * z, ry = rx / 2, tp = up(c, 14 * z), cx2 = x + d.w / 2, cy2 = y + d.d / 2, menu = d.menu || ['🍔', '🍜', '🍕', '🍣', '🧋', '🍦'];
      // the four seats: [dx, dy, which way they face, seen from behind]; the two at the back are drawn before the table top
      const SEATS = [[-0.75, 0, 1, false], [0, -0.75, -1, false], [0.75, 0, -1, true], [0, 0.75, 1, true]];
      const occ = d.seats || (d.mine || d.i % 3 === 1 ? [] : [[0], [0, 1], [0, 3], [1, 2], [0, 1, 2], [2], [1]][d.i % 7]);   // (the mall keeps a table free for you)
      const ACTS = ['eat', 'drink', 'phone', 'chat', 'chin', 'read', 'cross', 'drink', 'lean', 'chat'];
      const stool = s => { const q = iso(cx2 + SEATS[s][0], cy2 + SEATS[s][1]); line(q.x, q.y, q.x, q.y - 9 * z, '#4a4f57', 1.6 * z); ellipse(q.x, q.y - 9 * z, 7 * z, 3.5 * z, '#e5734f'); };
      const act = s => ACTS[(d.i * 3 + s * 7 + Math.floor(x)) % ACTS.length];
      const sitter = s => {
        const [dx, dy, face, back] = SEATS[s], sx = cx2 + dx, sy = cy2 + dy, q = iso(sx, sy), id = d.crew ? null : castId('tb' + d.i + ':' + s + ':' + Math.round(x * 10) + ':' + Math.round(y * 10), true);
        const L = d.crew ? { skin: '#f3c59f', hair: 'short', hairCol: '#2b1d14', mob: 'walk', body: 'regular', ...d.crew[s % d.crew.length] } : castLook(id, TABLE_LOOKS[(d.i + s) % TABLE_LOOKS.length]);
        drawPerson(q.x, q.y, z, { look: L, face, back, energy: 'good', ts, seed: d.i * 4 + s, pose: 'sit', seatH: 9, sit: d.crew ? ['chat', 'eat'][s % 2] : act(s) });
        folkSeen(id, sx, sy, q, z, ts);
      };
      [0, 1].forEach(s => { stool(s); if (occ.includes(s)) sitter(s); });
      line(c.x, c.y, tp.x, tp.y, '#4a4f57', 2.2 * z); ellipse(c.x, c.y, 10 * z, 5 * z, 'rgba(0,0,0,.12)');
      ellipse(tp.x, tp.y, rx, ry, '#f4f1ea', '#d6d0c4', 1);
      // on the table, in front of each of them: their food, or a cup (the ones drinking hold theirs)
      occ.forEach(s => { const a2 = act(s); if (a2 === 'drink' || a2 === 'read' || a2 === 'phone') return; const q = up(iso(cx2 + SEATS[s][0] * 0.42, cy2 + SEATS[s][1] * 0.42), 14 * z); emoji(a2 === 'eat' ? menu[(d.i + s) % menu.length] : menu[(d.i + s + 1) % menu.length], q.x, q.y + 1 * z, 9 * z); });
      [2, 3].forEach(s => { stool(s); if (occ.includes(s)) sitter(s); });
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
    if (meS.eat) { meS.eat = null; meS.sit = false; }   // v0.50: got up before you'd finished: not eaten
    const P = shopPlan(owner), { g, gw, gd, GS } = P.nav, cell = (x, y) => [clamp(Math.floor(x / GS), 0, gw - 1), clamp(Math.floor(y / GS), 0, gd - 1)];
    const free = (i, j) => i >= 0 && j >= 0 && i < gw && j < gd && g[j * gw + i];
    let [ti, tj] = cell(to[0], to[1]), dest = [to[0], to[1]];
    if (!free(ti, tj)) {   // the nearest free cell to where you tapped
      let best = null, bd = 1e9;
      for (let j = 0; j < gd; j++) for (let i = 0; i < gw; i++) if (free(i, j)) { const d = Math.hypot(i - ti, j - tj); if (d < bd) { bd = d; best = [i, j]; } }
      if (!best) return false; [ti, tj] = best; dest = [(ti + 0.5) * GS, (tj + 0.5) * GS];
    }
    let out = shopPath(P, [meS.x, meS.y], dest);   // v0.45: the shortest way, in straight lines
    if (!out) {   // v0.50: shut off (behind a counter, past a row of shelves): as close as you can get to it
      let [si, sj] = cell(meS.x, meS.y);
      if (!free(si, sj)) { let b0 = null, d0 = 1e9; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (free(si + di, sj + dj) && Math.hypot(di, dj) < d0) { d0 = Math.hypot(di, dj); b0 = [si + di, sj + dj]; } if (!b0) return false; [si, sj] = b0; }
      const seen = new Uint8Array(gw * gd), q = [sj * gw + si]; seen[q[0]] = 1;
      let best = -1, bd = 1e9;
      for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi], i = c % gw, j = (c - i) / gw, d = Math.hypot(i - ti, j - tj);
        if (d < bd) { bd = d; best = c; }
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([di, dj]) => { const ni = i + di, nj = j + dj; if (free(ni, nj) && !seen[nj * gw + ni]) { seen[nj * gw + ni] = 1; q.push(nj * gw + ni); } });
      }
      if (best >= 0) out = shopPath(P, [meS.x, meS.y], [(best % gw + 0.5) * GS, (Math.floor(best / gw) + 0.5) * GS]);
    }
    if (!out) return false;
    meS.path = out; meS.then = then || null; meS.moving = true;
    return true;
  }
  function stepShop(dt) {
    if (meS.use && meS.use.until && performance.now() > meS.use.until) { const f = meS.use.done; meS.use = null; if (f) setTimeout(f, 60); }   // v0.30
    if (meS.eat && meS.eat.secs && performance.now() > meS.eat.until) { const f = meS.eat.done; meS.eat = null; meS.sit = false; if (f) setTimeout(f, 60); }   // v0.50: eaten
    if (!meS.path.length) { if (meS.moving) { meS.moving = false; const f = meS.then; meS.then = null; if (f) setTimeout(f, 120); } return; }
    let go = 3.4 * dt * walkMult();   // v0.44
    while (go > 0 && meS.path.length) {
      const [tx, ty] = meS.path[0], dx = tx - meS.x, dy = ty - meS.y, d = Math.hypot(dx, dy);
      if (d > 0.01) faceTo(meS, dx, dy);
      if (d <= go) { meS.x = tx; meS.y = ty; meS.path.shift(); go -= d; } else { meS.x += dx / d * go; meS.y += dy / d * go; go = 0; }
    }
    meS.phase += dt * 11;
  }
  // v0.45: the shortest way across a room, from a to b (or null): A* over the half-tile cells in eight directions (no
  // cutting a corner past a shelf), then pulled straight wherever you can see from one point to a later one, so people
  // walk straight lines like real people do, not along a grid. side: a little to the left or right of the middle of the
  // aisle (each person their own), so two people going the same way don't walk in each other's footsteps.
  function shopPath(P, a, b, side = 0) {
    const { g, gw, gd, GS } = P.nav, cell = (x, y) => [clamp(Math.floor(x / GS), 0, gw - 1), clamp(Math.floor(y / GS), 0, gd - 1)], free = (i, j) => i >= 0 && j >= 0 && i < gw && j < gd && g[j * gw + i];
    let [si, sj] = cell(a[0], a[1]); const [ti, tj] = cell(b[0], b[1]);
    if (!free(ti, tj)) return null;
    if (!free(si, sj)) { let best = null, bd = 1e9; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (free(si + di, sj + dj) && Math.hypot(di, dj) < bd) { bd = Math.hypot(di, dj); best = [si + di, sj + dj]; } if (!best) return null; [si, sj] = best; }
    const N = gw * gd, cost = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N), open = [[0, sj * gw + si]];
    cost[sj * gw + si] = 0;
    const hEst = c => { const i = c % gw, j = (c - i) / gw, dx = Math.abs(i - ti), dy = Math.abs(j - tj); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
    const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, c] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (done[c]) continue; done[c] = 1;
      const i = c % gw, j = (c - i) / gw;
      if (i === ti && j === tj) break;
      for (const [di, dj, w] of STEPS) {
        const ni = i + di, nj = j + dj; if (!free(ni, nj) || (di && dj && (!free(i + di, j) || !free(i, j + dj)))) continue;
        const nc = nj * gw + ni, nv = cost[c] + w; if (nv < cost[nc]) { cost[nc] = nv; prev[nc] = c; open.push([nv + hEst(nc), nc]); }
      }
    }
    if (prev[tj * gw + ti] < 0 && !(si === ti && sj === tj)) return null;
    const pts = []; for (let c = tj * gw + ti; c >= 0 && c !== sj * gw + si; c = prev[c]) pts.unshift([(c % gw + 0.5) * GS, (Math.floor(c / gw) + 0.5) * GS]);
    const end = [b[0], b[1]]; if (pts.length) pts[pts.length - 1] = end; else pts.push(end);
    // pull it straight: from where you are, go to the furthest point you can see in a straight line
    const sees = (p0, p1) => { const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.ceil(d / (GS * 0.4)); for (let k = 1; k < n; k++) { const x = p0[0] + (p1[0] - p0[0]) * k / n, y = p0[1] + (p1[1] - p0[1]) * k / n; for (const [ox, oy] of [[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]]) { const [ci, cj] = cell(x + ox, y + oy); if (!free(ci, cj)) return false; } } return true; };
    const out = []; let cur = [a[0], a[1]], k = 0;
    while (k < pts.length) { let far = k; for (let m = pts.length - 1; m > k; m--) if (sees(cur, pts[m])) { far = m; break; } cur = pts[far]; out.push(cur); k = far + 1; }
    // your own side of the aisle: nudge the corners a little across the way you're going (only where it stays clear)
    if (side) for (let m = 0; m < out.length - 1; m++) { const q0 = m ? out[m - 1] : a, q1 = out[m], dx = q1[0] - q0[0], dy = q1[1] - q0[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * side, ny = dx / L * side, np = [q1[0] + nx, q1[1] + ny], [ci, cj] = cell(np[0], np[1]); if (free(ci, cj) && sees(q0, np) && sees(np, out[m + 1])) out[m] = np; }
    return out;
  }
  // other people shopping: they wander from one thing to another, stop and look, and wander on
  // (v0.45: each at their own pace, on their own side of the aisle; someone right ahead: they slow down)
  function shoppers(P, objs, dt, ts) {
    if (P.noClerk) return;   // v0.38: nobody wanders into your hotel room
    if (!P.npcs) {
      const ids = allLots().map(l => l.id).filter(id => id !== 'me' && homeOf(id)).slice(0, 12);
      P.npcs = [0, 1, 2].map(i => { const id = ids[(i * 5 + P.n) % Math.max(1, ids.length)], h = id && homeOf(id); return { look: h ? h.look : dressUp({ shirt: COLORS[i], skin: SKINS[i % SKINS.length], hair: HAIRS[i % HAIRS.length], hairCol: HAIR_COLORS[i], mob: 'walk' }, 'shop' + i), x: 2 + i * 3, y: P.RD - 2, path: [], wait: 1 + i * 2, face: 1, phase: 0 }; });
    }
    P.npcs.forEach((n, i) => {
      n.id = castId('shop' + i); n.look = castLook(n.id, n.look);   // v0.34: somebody from town
      if (FOLK_HOLD[n.id] > performance.now()) { n.path = []; n.wait = Math.max(n.wait, 0.5); n.moving = false; }   // you're coming over to talk: they wait
      else if (n.wait > 0) { n.wait -= dt; n.moving = false; if (n.wait <= 0 && P.wares.length) {
        const taken = P.npcs.filter(o => o !== n).map(o => o.look2), pool = P.wares.filter(x => !taken.includes(x)), w = (pool.length ? pool : P.wares)[Math.floor(Math.random() * (pool.length || P.wares.length))], mine = meS.use ? meS.use.at : !meS.moving ? [meS.x, meS.y] : null;
        // v0.30: in a building, stand a little to one side, and not where you are
        let to = [w.x + w.w / 2 + (Math.random() - 0.5) * Math.min(0.9, w.w * 0.6), w.y + w.d + 0.45 + Math.random() * 0.35];
        if (P.venue) to = [w.x + w.w / 2 + (Math.random() - 0.5) * 1.6, w.y + w.d + 0.8 + Math.random() * 0.8];
        if (mine && Math.hypot(to[0] - mine[0], to[1] - mine[1]) < 1.6) { n.wait = 1 + Math.random() * 2; }
        else { n.side = n.side || [0.18, -0.2, 0.1, -0.12][i % 4]; n.path = shopPath(P, [n.x, n.y], to, n.side) || []; n.look2 = w; } } }
      else if (n.path.length) { const ahead = P.npcs.some((o, k) => k !== i && Math.hypot(o.x - n.x, o.y - n.y) < 0.55 && (o.path.length ? 1 : 0) <= 1 && ((n.path[0][0] - n.x) * (o.x - n.x) + (n.path[0][1] - n.y) * (o.y - n.y)) > 0); let go = (ahead ? 0.2 : 1) * (1.9 + (i % 3) * 0.3) * dt; while (go > 0 && n.path.length) { const [tx, ty] = n.path[0], dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy); if (d > 0.01) faceTo(n, dx, dy); if (d <= go) { n.x = tx; n.y = ty; n.path.shift(); go -= d; } else { n.x += dx / d * go; n.y += dy / d * go; go = 0; } } n.phase += dt * 10; n.moving = true; if (!n.path.length) { n.wait = 3 + Math.random() * 5; n.view = 'back'; n.turn = [0, -1]; } }
      else n.wait = 1;
      const held = FOLK_HOLD[n.id] > performance.now();
      objs.push({ d: n.x + n.y + 0.3, f: () => { const p2 = iso(n.x, n.y); drawPerson(p2.x, p2.y, cam.z, { look: n.look, face: n.face, back: n.back && n.moving, view: n.moving ? n.view : held ? 'front' : 'back', turn: n.moving ? n.turn : held ? [0.3, 1] : [-0.3, -1], moving: n.moving, phase: n.phase, energy: 'good', ts, seed: i + 7, pose: n.moving ? 'walk' : 'stand', wave: chatWave(n.id) }); folkSeen(n.id, n.x, n.y, p2, cam.z, ts); } });
    });
  }
  // A picture (made by thumb) drawn on the canvas, once it has loaded.
  function pic(kind, k, o, w, h, sx, sy, sw, sh) {
    const url = thumb(kind, k, o, w, h), im = IMGS[url] || (IMGS[url] = Object.assign(new Image(), { src: url }));
    if (im.complete && im.naturalWidth) ctx.drawImage(im, sx, sy, sw, sh);
  }
  const MANNEQUIN = { shirt: '#5aa2e0', pants: '#4a5a78', skin: '#efe9e1', hair: 'short', hairCol: '#efe9e1', mob: 'walk', shoeCol: '#3b3028', hatCol: '#e5484d' };
  function drawWare(w, ts) {
    if (w.kind === 'escalator') return drawMallWare(w, ts);   // v0.45: the furniture store's floors too
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
    else if (w.kind === 'petfood' || w.kind === 'seed' || w.kind === 'feed') {
      const b = box(x + 0.1, y + 0.2, w.w - 0.2, w.d - 0.4, 20, '#c99a6b', 0, { top: '#e6c79a' });
      const e = w.kind === 'seed' ? CROPS[w.k].e : w.kind === 'feed' ? FEED.e : PET_FOOD[w.k].e;
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
    else if (w.kind === 'clothes') { ellipse(c.x, c.y, 14 * z, 6 * z, 'rgba(0,0,0,.08)'); drawClothDisplay(w.k, c.x, c.y, z); }   // v0.49: the thing itself on a rail / a stand (Mason #29: no mannequins)
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
    if (w.price && z > 0.5 && w.kind !== 'act') label(`🪙${fmtPrice(w.price)}`, f0.x, f0.y + 9 * z, 'rgba(255,253,248,.92)', '#6b4a1f', `800 ${Math.max(8, 9 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(13, 15 * z), 1);
    return { x0: iso(x, y + w.d).x - 4 * z, x1: iso(x + w.w, y).x + 4 * z, y0: c.y - 60 * z, y1: iso(x + w.w, y + w.d).y + 8 * z };
  }
  function renderShop(ts, dt) {
    const SK = String(owner).startsWith('furniture') ? 'furniture' : owner;   // v0.45: the furniture store's floors
    const VL = VENUE_LOOK[owner], P = shopPlan(owner), S2 = VL ? venueLook(owner) : STORES[SK] || STORES.mall, z = cam.z, WH = P.dark ? 92 : 80, { RW, RD } = P, fl = (VL && VL.floor) || SHOP_FLOOR[SK] || SHOP_FLOOR.market;
    stepShop(dt);
    FOLK_AT = {};   // v0.34: filled in as people are drawn
    if (P.floor) return renderMallFloor(P, S2, ts, dt, WH);
    // v0.22: outside the store: the pavement and car park in front, a road, grass and trees round it (no empty space)
    // v0.37: up a tower there's no street: the sky, and the town far below
    if (P.sky) skyOutside(RW, RD, ts);
    else {
    ctx.fillStyle = shade(PAL.town, -0.02); ctx.fillRect(0, 0, W, H);
    flatRect(-14, -14, RW + 28, RD + 30, shade(PAL.town, -0.02));
    flatRect(-2.5, -2.5, RW + 5, RD + 9, '#d9d4ca');                     // pavement all round
    flatRect(-2.5, RD + 0.6, RW + 5, 3.6, '#7d848c');                    // the car park in front
    for (let i = 0; i <= RW + 4; i += 1.7) { const a2 = iso(-2.3 + i, RD + 0.8), b2 = iso(-2.3 + i, RD + 3.1); line(a2.x, a2.y, b2.x, b2.y, 'rgba(255,255,255,.75)', 1.1 * z); }
    flatRect(-14, RD + 6.5, RW + 28, 3.4, '#8e959c');                    // the road
    for (let i = -13; i < RW + 13; i += 1.6) { const a2 = iso(i, RD + 8.2), b2 = iso(i + 0.8, RD + 8.2); line(a2.x, a2.y, b2.x, b2.y, 'rgba(255,255,255,.8)', 1.4 * z); }
    [[-4.5, -3], [-4, RD * 0.4], [-4.6, RD * 0.8], [RW * 0.3, -4.2], [RW * 0.7, -4.6], [RW + 4, -2], [RW + 4.4, RD * 0.5], [RW + 4, RD + 2]].forEach(([tx, ty], i) => drawWildTree(tx, ty, hash(i, 77), 0));
    }
    for (let j = 0; j < RD; j++) for (let i = 0; i < RW; i++) tile(i, j, (i + j) % 2 ? fl[0] : fl[1]);
    const A = iso(0, 0), B = iso(RW, 0), D = iso(0, RD), wall = S2.wall || '#f1f0ea', acc = S2.roof || '#c9893a';
    if (P.open) {   // v0.37: the roof: a glass railing all round instead of walls
      [[D, A], [A, B]].forEach(F => { poly([F[0], F[1], up(F[1], 16 * z), up(F[0], 16 * z)], 'rgba(200,230,250,.3)', 'rgba(255,255,255,.8)', 1); line(up(F[0], 16 * z).x, up(F[0], 16 * z).y, up(F[1], 16 * z).x, up(F[1], 16 * z).y, '#c9cfd6', 2 * z); });
    } else {
    poly([D, A, up(A, WH * z), up(D, WH * z)], shade(wall, -0.08)); poly([A, B, up(B, WH * z), up(A, WH * z)], wall);
    wallRect([D, A], 0, 0, 1, WH - 8, WH, acc); wallRect([A, B], 0, 0, 1, WH - 8, WH, shade(acc, 0.1));
    if (P.sky) [[D, A], [A, B]].forEach((F, fi) => { const sk = NIGHT > 0.3 ? '#2a3360' : '#bfe6f7'; for (let k = 0; k < 6; k++) wallRect(F, 0, k / 6 + 0.012, (k + 1) / 6 - 0.012, 6, WH - 12, sk, '#e8ecf0', 1.2); });   // v0.37: floor-to-ceiling windows
    else for (let k = 1; k <= 3; k++) wallRect([D, A], 0, k / 4 - 0.08, k / 4 + 0.08, 30, 62, '#bfe6f7', '#fffaf0', 1.4);   // windows
    }
    if (!P.open && !P.sky) { const F = [A, B], u0 = Math.max(0.2, 0.5 - 2.8 / RW), u1 = Math.min(0.8, 0.5 + 2.8 / RW);   // v0.21: a sign fixed to the back wall
      wallRect(F, 0, u0 - 0.006, u1 + 0.006, 39, 63, shade(acc, -0.25)); wallRect(F, 0, u0, u1, 40, 62, acc); wallRect(F, 0, u0 + 0.01, u1 - 0.01, 42, 60, shade(acc, 0.12));
      [u0 + 0.02, u1 - 0.02].forEach(u => { const q = wallPt(F, 0, u, 58); circle(q.x, q.y, 1.2 * z, '#e8e2d6'); });
      { const FI = FURN_FLOORS.findIndex(F2 => F2.key === owner); wallText(F, 0.5, 51, FI >= 0 ? `${S2.e} ${FI + 1}F · ${nm(FURN_FLOORS[FI])}` : `${S2.e} ${nm(S2)}`, Math.max(9, 15 * z), '#ffffff'); } }
    flatRect(P.door[0] - 1.2, RD - 0.9, 2.4, 0.9, shade(acc, 0.25));   // the door mat
    const objs = [];
    P.wares.forEach(w => { const q = iso(w.x + w.w / 2, w.y + w.d / 2); if (q.x < -120 || q.x > W + 120 || q.y < -60 || q.y > H + 200) return;   // v0.21: only what's on screen
      objs.push({ d: w.x + w.y + (w.w + w.d) / 2, f: () => { const r = drawWare(w, ts); if (r) hits.push({ kind: 'ware', id: w.id, wk: w.kind, k: w.k, ...r }); } }); });
    (P.decor || []).forEach((dd, i) => objs.push({ d: dd.flat ? -1e4 + i : dd.kind === 'person' ? dd.x + dd.y + 0.3 + (dd.dz || 0) : dd.x + dd.y + (dd.w + dd.d) / 2, f: () => drawVenueDecor(dd, ts, i) }));   // v0.30
    const C = P.counter;
    if (!P.noClerk) objs.push({ d: C.x + C.y - 0.6 + 1.2, f: () => { const p2 = iso(P.clerk[0], P.clerk[1]), ST = staffOf(VIEW_TOWN, String(owner).startsWith('furniture') ? 'furniture' : owner), me2 = { skin: ST.look.skin, hair: ST.look.hair, hairCol: ST.look.hairCol, body: ST.look.body || 'regular' };   // v0.40: somebody from town, with a name
      FOLK_AT[ST.id] = P.clerk;
      drawPerson(p2.x, p2.y, z, { look: VL ? { shirt: acc, mob: 'walk', top: 'polo', bottom: 'jeans', shoes: 'sneakers', hat: 'nohat', ...VL.clerk, ...me2 } : { shirt: acc, mob: 'walk', top: 'polo', ...me2 }, face: -1, view: Math.sin(ts / 2300) > 0.75 ? null : 'front', turn: [0.3, 1], energy: 'great', ts, seed: 5, pose: 'stand', wave: Math.sin(ts / 2300) > 0.75 });
      hits.push({ kind: 'clerk', x0: p2.x - 16 * z, x1: p2.x + 16 * z, y0: p2.y - 50 * z, y1: p2.y + 30 * z }); if (z > 0.45) label(`💬 ${nm(ST.name)} · ${VL ? t('vrole_' + owner) : t('shop_clerk')}`, p2.x, p2.y - 54 * z, '#fffdf8', '#3b3125', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z), 2); } });
    if (!P.noClerk) objs.push({ d: C.x + C.y + (C.w + C.d) / 2, f: () => { box(C.x, C.y, C.w, C.d, 16, '#c99a6b', 0, { top: '#e6c79a' }); const p2 = up(iso(C.x + 0.6, C.y + 0.45), 18 * z); emoji(VL ? VL.till : '💳', p2.x, p2.y, 9 * z); } });
    shoppers(P, objs, dt, ts);
    objs.push({ d: meS.use && !meS.moving ? meS.use.at[0] + meS.use.at[1] + 0.5 : meS.x + meS.y + 0.3, f: () => drawMeShop(z, ts) });
    if (meS.use && meS.use.mate && !meS.moving) { const U = meS.use, mx = U.at[0] + 1.5, my = U.at[1]; objs.push({ d: mx + my + 1.2, f: () => { const q = iso(mx, my); drawPerson(q.x, q.y, z, { look: U.mate, face: -1, back: true, energy: 'great', ts, seed: 9, pose: 'sit', seatH: 9, sit: 'chat' }); if (Math.floor(ts / 900) % 2) emoji('💬', q.x - 8 * z, q.y - 44 * z, 12 * z); } }); }   // v0.34: across the table from you
    { const dp = iso(P.door[0], RD - 0.45); hits.push({ kind: 'shopDoor', x0: dp.x - 30 * z, x1: dp.x + 30 * z, y0: dp.y - 14 * z, y1: dp.y + 14 * z }); }
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    { const S3 = S2, acc2 = S3.roof || '#c9893a', F1 = [iso(0, RD), iso(RW, RD)], F2 = [iso(RW, RD), iso(RW, 0)];
      [F1, F2].forEach((F, k) => { wallRect(F, 0, 0, 1, 0, 5, shade(acc2, k ? -0.08 : -0.18)); wallRect(F, 0, 0, 1, 5, 6.2, '#ffffff'); });
      const du0 = (P.door[0] - 1.2) / RW, du1 = (P.door[0] + 1.2) / RW; wallRect(F1, 0, du0, du1, 0, 6.2, '#cfc9bd'); }
    const dp = iso(P.door[0], RD - 0.2); label(`🚪 ${t(VL ? 'venue_leave' : 'store_leave')}`, dp.x, dp.y + 12 * z, 'rgba(255,253,248,.95)', '#3b3125', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z), 4);
  }
  // v0.37: what you see from high up a tower: the sky (day or night) and the town's roofs far below
  function skyOutside(RW, RD, ts) {
    const night = NIGHT > 0.3, g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, night ? '#141a3a' : '#9fd3f2'); g.addColorStop(0.6, night ? '#2a3360' : '#d6ecf8'); g.addColorStop(1, night ? '#3d3a5c' : '#eef6fa');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (night) for (let k = 0; k < 40; k++) circle((k * 97.3) % W, (k * 53.1) % (H * 0.5), 0.8 + (k % 3) * 0.4, `rgba(255,255,255,${0.4 + 0.4 * Math.sin(ts / 700 + k)})`);
    else for (let k = 0; k < 4; k++) { const cx = ((k * 211 + ts / 120) % (W + 200)) - 100, cy = 60 + k * 70; [0, 18, 34].forEach((o, j) => circle(cx + o, cy + (j % 2) * 4, 14 + j * 2, 'rgba(255,255,255,.75)')); }
    for (let k = 0; k < 14; k++) {   // the town below
      const bw = 30 + (k * 37) % 50, bh = 40 + (k * 53) % 120, bx = (k * 71) % (W + 60) - 30;
      ctx.fillStyle = night ? 'rgba(40,46,80,.9)' : 'rgba(150,170,190,.45)'; ctx.fillRect(bx, H - bh, bw, bh);
      if (night) for (let r = 0; r < bh / 12; r++) for (let c2 = 0; c2 < bw / 10; c2++) if (hash(k * 31 + r, c2) > 0.55) { ctx.fillStyle = 'rgba(255,220,140,.75)'; ctx.fillRect(bx + 3 + c2 * 10, H - bh + 4 + r * 12, 4, 5); }
    }
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
      objs.push({ d: C.x + C.y - 0.6 + 1.2, f: () => { const p2 = iso(P.clerk[0], P.clerk[1]), ST = staffOf(VIEW_TOWN, String(owner).startsWith('furniture') ? 'furniture' : owner); FOLK_AT[ST.id] = P.clerk; drawPerson(p2.x, p2.y, z, { look: { shirt: acc, mob: 'walk', top: 'polo', skin: ST.look.skin, hair: ST.look.hair, hairCol: ST.look.hairCol }, face: -1, view: 'front', turn: [0.3, 1], energy: 'great', ts, seed: 5, pose: 'stand', wave: Math.sin(ts / 2300) > 0.75 });
        hits.push({ kind: 'clerk', x0: p2.x - 16 * z, x1: p2.x + 16 * z, y0: p2.y - 50 * z, y1: p2.y + 30 * z }); if (z > 0.45) label(`💬 ${nm(ST.name)} · ${t('shop_clerk')}`, p2.x, p2.y - 54 * z, '#fffdf8', '#3b3125', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z), 2); } });
      objs.push({ d: C.x + C.y + (C.w + C.d) / 2, f: () => { box(C.x, C.y, C.w, C.d, 16, '#f4f1ea', 0, { top: '#c9a26b' }); const p2 = up(iso(C.x + 0.6, C.y + 0.45), 18 * z); emoji('💳', p2.x, p2.y, 9 * z); } });
    }
    if (!P.dark) shoppers(P, objs, dt, ts);
    if (meS.use && !meS.moving) objs.push({ d: meS.use.at[0] + meS.use.at[1] + 0.5, f: () => drawMeShop(z, ts) });   // v0.50
    else if (!(P.dark && meS.sit)) objs.push({ d: meS.x + meS.y + 0.3, f: () => { const p2 = iso(meS.x, meS.y); drawPerson(p2.x, p2.y, z, { look: S.me.look, face: meS.face, back: meS.sit || (meS.back && meS.moving), view: meS.sit ? null : meS.view, turn: meS.turn, moving: meS.moving, phase: meS.phase, energy: energyLevel(), ts, seed: 3, pose: meS.sit ? 'sit' : meS.moving ? 'walk' : 'stand', seatH: meS.sit ? 9 : undefined, sit: meS.sit ? 'eat' : undefined }); carryBox(p2, z);
      if (meS.eat && meS.eat.until > performance.now()) { const q = up(iso(meS.x - 0.35, meS.y - 0.05), 14 * z); emoji(meS.eat.e, q.x, q.y, 10 * z); doBar(p2.x, p2.y - 58 * z, 1 - (meS.eat.until - performance.now()) / 1000 / meS.eat.secs, meS.eat.e, z); }   // v0.34: on the stool, feet on the floor, your food on the table (v0.50: the bar)
      if (chatting() && CHAT.e && FOLK_AT[CHAT.id]) chatBubble(p2.x - 12 * z, p2.y - 56 * z, z, true, ts); } });
    objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
    if (!P.noDoor) {
      const F1 = [iso(0, RD), iso(RW, RD)], F2 = [iso(RW, RD), iso(RW, 0)];
      [F1, F2].forEach((F, k) => { poly([F[0], F[1], up(F[1], 30 * z), up(F[0], 30 * z)], 'rgba(200,230,250,.16)', 'rgba(255,255,255,.55)', 1); wallRect(F, 0, 0, 1, 0, 3, shade(acc, k ? -0.08 : -0.18)); });
      const dp = iso(P.door[0], RD - 0.45); hits.push({ kind: 'shopDoor', x0: dp.x - 30 * z, x1: dp.x + 30 * z, y0: dp.y - 14 * z, y1: dp.y + 14 * z });
      label(`🚪 ${t('store_leave')}`, dp.x, dp.y + 14 * z, 'rgba(255,253,248,.95)', '#3b3125', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z), 4);
    } else if (!P.dark) { const F1 = [iso(0, RD), iso(RW, RD)]; poly([F1[0], F1[1], up(F1[1], 16 * z), up(F1[0], 16 * z)], 'rgba(200,230,250,.22)', 'rgba(255,255,255,.8)', 1.2); line(up(F1[0], 16 * z).x, up(F1[0], 16 * z).y, up(F1[1], 16 * z).x, up(F1[1], 16 * z).y, '#c9c3b6', 2.4 * z); }   // a glass railing
    if (FILM && FILM.t0 && owner === 'cinema' && performance.now() - FILM.t0 > FILM_SECS * 1000 && !FILM.ended) { FILM.ended = true; onHit({ kind: 'filmEnd', k: FILM.k }); }
    if (FILM && FILM.t0 && owner === 'cinema' && !FILM.ended && meS.sit && P.seat) { const q = iso(P.seat[0], P.seat[1]); doBar(q.x, q.y - 66 * z, (performance.now() - FILM.t0) / 1000 / FILM_SECS, '🎬', z); }   // v0.50
  }
  function drawMallWare(w, ts) {
    const z = cam.z, { x, y } = w, c = iso(x + w.w / 2, y + w.d / 2), f0 = iso(x + w.w / 2, y + w.d);
    const tag = (txt) => { if (z > 0.5) label(txt, f0.x, f0.y + 9 * z, 'rgba(255,253,248,.92)', '#6b4a1f', `800 ${Math.max(8, 9 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(13, 15 * z), 1); };
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
      // v0.47→v0.49 (Mason #29: "no ceiling, it just stops in the air; up and down look the same"): the one going up
      // climbs into an opening in the floor above (a slab of it with a glass rail on top); the one going down sinks
      // into a hole in this floor (a dark well with glass all round it). The steps creep the way it runs.
      const up2 = w.dir ? w.dir === 'up' : w.k === 'mall2', n = 12, H2 = up2 ? 74 : -46;
      const stepAt = (u, sx) => up(iso(sx, y + w.d * (1 - u)), H2 * u * z);
      const steps = () => { for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n, mv = (((up2 ? 1 : -1) * ts / 900) % 1 + 1) % 1 / n;
        poly([stepAt(u0, x), stepAt(u0, x + w.w), stepAt(u1, x + w.w), stepAt(u1, x)], i % 2 ? '#9aa3ad' : '#b8c0c9');
        const um = u0 + mv, a2 = stepAt(um, x), b2 = stepAt(um, x + w.w); line(a2.x, a2.y, b2.x, b2.y, 'rgba(255,255,255,.5)', 0.8 * z);
      } };
      const rails = () => [x, x + w.w].forEach(sx => {   // the glass sides and the moving handrail
        const a2 = stepAt(0, sx), b2 = stepAt(1, sx); poly([a2, b2, up(b2, 12 * z), up(a2, 12 * z)], 'rgba(200,230,250,.3)', 'rgba(255,255,255,.6)', 1);
        line(up(a2, 12 * z).x, up(a2, 12 * z).y, up(b2, 12 * z).x, up(b2, 12 * z).y, '#2d2d2d', 2.2 * z);
        const n0 = up(iso(sx, y + w.d + 0.35), 12 * z); line(n0.x, n0.y, up(a2, 12 * z).x, up(a2, 12 * z).y, '#2d2d2d', 2.2 * z);   // the newel at the bottom
      });
      if (up2) {
        steps(); rails();
        // the floor above: a slab over the top of the run, its edge dark where the steps go into it, a glass rail on top
        const sb = box(x - 0.5, y - 0.3, w.w + 1, 1.6, 9, '#ece6dc', H2 - 1, { top: '#f4efe6', shadow: false });
        wallRect(sb.left, H2 - 1, 0.18, 0.82, 0, 9, '#4a4f57');
        [[x - 0.5, y + 1.3, x + w.w + 0.5, y + 1.3], [x + w.w + 0.5, y - 0.3, x + w.w + 0.5, y + 1.3]].forEach(([ax, ay, bx, by]) => { const p0 = up(iso(ax, ay), (H2 + 8) * z), p1 = up(iso(bx, by), (H2 + 8) * z); poly([p0, p1, up(p1, 11 * z), up(p0, 11 * z)], 'rgba(200,230,250,.3)', 'rgba(255,255,255,.7)', 1); line(up(p0, 11 * z).x, up(p0, 11 * z).y, up(p1, 11 * z).x, up(p1, 11 * z).y, '#c9ced4', 1.6 * z); });
      } else {
        // the well: dark sides going down (the far ones show), the steps inside it, glass round its edge
        const q = (px, py, hh = 0) => up(iso(px, py), hh * z), D2 = -H2;
        poly([q(x - 0.1, y - 0.1), q(x + w.w + 0.1, y - 0.1), q(x + w.w + 0.1, y + w.d), q(x - 0.1, y + w.d)], '#3a3f47');
        ctx.save(); ctx.beginPath(); [q(x - 0.1, y - 0.1), q(x + w.w + 0.1, y - 0.1), q(x + w.w + 0.1, y + w.d), q(x - 0.1, y + w.d)].forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y))); ctx.closePath(); ctx.clip();
        poly([q(x - 0.1, y - 0.1), q(x + w.w + 0.1, y - 0.1), q(x + w.w + 0.1, y - 0.1, -D2), q(x - 0.1, y - 0.1, -D2)], '#5b6470');   // its far wall
        poly([q(x - 0.1, y - 0.1), q(x - 0.1, y + w.d), q(x - 0.1, y + w.d, -D2), q(x - 0.1, y - 0.1, -D2)], '#4a525c');   // its left wall
        steps(); rails();
        ctx.restore();
        const g = (ax, ay, bx, by) => { const p0 = q(ax, ay), p1 = q(bx, by); poly([p0, p1, up(p1, 12 * z), up(p0, 12 * z)], 'rgba(200,230,250,.32)', 'rgba(255,255,255,.75)', 1); line(up(p0, 12 * z).x, up(p0, 12 * z).y, up(p1, 12 * z).x, up(p1, 12 * z).y, '#c9ced4', 1.6 * z); };
        g(x - 0.1, y - 0.1, x + w.w + 0.1, y - 0.1); g(x - 0.1, y - 0.1, x - 0.1, y + w.d * 0.75); g(x + w.w + 0.1, y - 0.1, x + w.w + 0.1, y + w.d * 0.75);
      }
      const sp = up(iso(x + w.w / 2, y + w.d + 0.2), 4 * z); label(w.dir ? `${up2 ? '⬆️' : '⬇️'} ${t('to_floor', { n: FURN_FLOORS.findIndex(F2 => F2.key === w.k) + 1 })}` : up2 ? `⬆️ ${t('mall_up')}` : `⬇️ ${t('mall_down')}`, sp.x, sp.y + 10 * z, '#2f80ed', '#ffffff', `800 ${Math.max(9, 11 * z)}px ${UI_FONT},${EMOJI_FONT}`, Math.max(15, 20 * z), 3);
      return { x0: iso(x, y + w.d).x - 6 * z, x1: iso(x + w.w, y).x + 6 * z, y0: up(iso(x, y), (Math.max(H2, 0) + 20) * z).y, y1: iso(x + w.w, y + w.d).y + 20 * z };
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
  let OUT_CHUNKS = null;   // (OUT, the country's bounds: see syncWorld)
  function outChunks() {
    if (OUT_CHUNKS && OUT_CHUNKS.id === TL.id) return OUT_CHUNKS;
    OUT_CHUNKS = []; OUT_CHUNKS.id = TL.id;
    for (let y = OUT.y0; y < OUT.y1; y += OUT.ch) for (let x = OUT.x0; x < OUT.x1; x += OUT.ch) {
      if (x + OUT.ch > WX0 - 2 && x < WX1 + 2 && y + OUT.ch > WY0 - 2 && y < WY1 + 2) continue;   // the town and its woods
      if (terrainNow().peak !== 'none' && ((y + OUT.ch > WY0 - 24 && y < WY0 && x < WX1 + 30) || (x + OUT.ch > WX0 - 24 && x < WX0 && y < WY1 + 30))) { OUT_CHUNKS.push({ x, y, k: 'forest' }); continue; }   // under the mountains
      const v = hash(x * 0.37 + 11, y * 0.61 + 7);
      OUT_CHUNKS.push({ x, y, k: v < 0.34 ? 'village' : v < 0.68 ? 'farm' : v < 0.92 ? 'forest' : 'lake', v });
    }
    // v0.40: the villages nearest town, one on each side, are the county's other towns (with their names)
    const near = countyOf(SCENE_TOWN).near || [], cx = (WX0 + WX1) / 2, cy = (WY0 + WY1) / 2, used = new Set();
    near.forEach((nmz, i) => {
      const ang = [Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.75, -Math.PI * 0.25][i % 4];
      const best = OUT_CHUNKS.filter(c => c.k === 'village' && !used.has(c)).map(c => { const dx = c.x + OUT.ch / 2 - cx, dy = c.y + OUT.ch / 2 - cy; return { c, s: Math.hypot(dx, dy) * (1.6 - Math.cos(Math.atan2(dy, dx) - ang)) }; }).sort((a, b) => a.s - b.s)[0];
      if (best) { best.c.name = nmz; used.add(best.c); }
    });
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
    if (z < 0.4) for (const c of outChunks()) {   // v0.40: the county's other towns
      if (!c.name || c.x > vr.x1 || c.x + S2 < vr.x0 || c.y > vr.y1 || c.y + S2 < vr.y0) continue;
      const p = iso(c.x + S2 / 2, c.y + S2 / 2);
      label(`🏘️ ${curLang() === 'zh' ? c.name[0] : c.name[1]}`, p.x, p.y - 60 * z, 'rgba(255,253,248,.92)', '#3b3125', `800 ${Math.max(10, 13 * Math.min(1, z * 3))}px ${CUTE_FONT},${EMOJI_FONT}`, Math.max(18, 22 * Math.min(1, z * 3)), 1);
    }
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
    // v0.49: the floor above over the top of the flight, so the stairs go up into it (they used to end in the air)
    const sb = box(s.x + s.w * 0.5, s.y - 0.05, s.w * 0.55, s.d + 0.15, 8, '#efe6d6', STAIR_H + 2, { top: '#f6efe3', shadow: false });
    wallRect(sb.left, STAIR_H + 2, 0.05, 0.95, 0, 8, '#5a4636'); wallRect(sb.right, STAIR_H + 2, 0, 1, 0, 8, '#d9cdb8');
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
    // v0.46: on a seat, a bike or a treadmill turned round (its front away from you) you're behind it: drawn first
    const r4 = useIt ? (useIt.rot || 0) & 3 : 0, onIt = useIt && ['sit', 'bike', 'run'].includes(useK) && !(trS && trS.pose === 'walk'), behindIt = onIt && r4 >= 2;
    const meD = clipR ? clipR.x + clipR.y + 1.4 : onFlight && upR ? upR.x + upR.y + 1.38 : bedD || (behindIt ? useIt.x + useIt.y + itemSize('room', useIt).reduce((a, b) => a + b) / 2 - 0.03 : meIn.x + meIn.y + (meIn.seat || useK === 'sit' ? 0.7 : 0));
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
      const tread = it && FURN[it.k].use === 'run' && pose === 'run' && r4 < 2;   // v0.43: on the treadmill you face its console, your back to us (turned round: you face us)
      const fromBehind = (onIt && (useK === 'sit' || useK === 'bike') && r4 >= 2) || (useIt && (useK === 'lift' || useK === 'box') && r4 === 1 && !meIn.moving);
      drawPerson(p.x, p.y - (yOff + lift) * z, z, { look: S.me.look, face: meIn.face, back: (meIn.back && meIn.moving) || fromBehind, view: tread ? 'back' : meIn.view, turn: tread ? (r4 ? [-1, 0.1] : [0.1, -1]) : meIn.turn, moving: meIn.moving, phase: meIn.phase, energy: energyLevel(), ts, seed: 3, pose, noBike: true, wave: meIn.wave > performance.now(), matCol: it && it.tint, seatH: sitH, dir: lieDir(useIt) }); needBubble({ x: p.x, y: p.y - (yOff + lift) * z }, z, ts);
      if (pose === 'lie' && useIt) drawBedQuilt(useIt);   // (v0.46: a bed turned round: your head stays in sight over its headboard)
      actBar(meIn, { x: p.x, y: p.y - (yOff + lift) * z }, z, ts);   // v0.50: cooking
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
  const EDIT_AREAS = h => [...movables(h).filter(k => k !== 'pasture' || h.pastureLv).filter(k => k !== 'orchard' || h.orchardLv).filter(k => k !== 'pond' || h.pondLv), 'drive', ...(h.plots || []).map((p, i) => 'plot:' + i)];   // v0.46: each plot on its own
  function areaFits(k, x, y) {
    const h = S.me, keep = h.areaAt ? JSON.parse(JSON.stringify(h.areaAt)) : null, keepP = h.plots ? h.plots.map(p => p.slice()) : null;
    const r = moveArea(k, x, y, h);
    if (keep) h.areaAt = keep; else delete h.areaAt;
    if (keepP) h.plots = keepP;
    YARD_SPOTS = {};
    return r === 'ok';
  }
  function holdOrigin(sx, sy) {
    const p = unIso(sx, sy), [ox, oy] = editOrigin(), it = edit.hold, def = itemDef(edit.scope, it.k);
    const [w, d] = it.rot & 1 ? [def.d, def.w] : [def.w, def.d];
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
  // v0.46: four ways round. Its front is ROT_DIR[rot]: you stand there facing it (weights, punch bag); you sit facing
  // out of it; on the treadmill you face the console, away from the front; in bed your head is at the other end.
  function useSpot(it) {
    const [w, d] = itemSize('room', it), use = FURN[it.k].use, r = (it.rot || 0) & 3, [dx, dy] = ROT_DIR[r];
    if (use === 'lift' || use === 'box') { const f = faceAlong(-dx, -dy); return r === 0 ? [it.x + w / 2 - 0.1, it.y + d + 0.35, 1] : [it.x + w / 2 + dx * (w / 2 + 0.35), it.y + d / 2 + dy * (d / 2 + 0.35), f.face, f.back]; }
    if (use === 'sleep') {   // head on the pillow (the body is drawn 0.27 tiles behind the head); a double bed: one side
      const hy = (LIE_HEAD[it.k] || 0.35) + 0.27, side = it.k === 'bed' ? 0.55 : null, far = r >= 2;
      return r & 1 ? [far ? it.x + w - hy : it.x + hy, it.y + (side || d / 2), 1] : [it.x + (side || w / 2), far ? it.y + d - hy : it.y + hy, 1];
    }
    if (use === 'sit' || use === 'bike' || use === 'run') { const f = use === 'run' ? faceAlong(-dx, -dy) : faceAlong(dx, dy); return [it.x + w / 2, it.y + d / 2, f.face, f.back]; }
    return [it.x + w / 2, it.y + d / 2, 1];
  }
  // Getting onto a seat or into bed, step by step: walk up to the edge, sit down (on a bed: sit on the edge first,
  // then lie back and slide under the quilt). `back` remembers the way out for getting up again.
  function seatSteps(a, it, sp, use) {
    const [w, d] = itemSize('room', it), m = 0.2;
    if (use === 'sleep') {
      // into bed: walk to the side of the bed by the pillow, sit on the edge facing out, then lie down under the quilt
      // (a quick fade, so the body never slides through the mattress). A double bed: the pillow on your side.
      const hy = (LIE_HEAD[it.k] || 0.35) + 0.27, along = it.rot & 1 ? 'x' : 'y', far = (it.rot & 3) >= 2, hs = far ? -1 : 1;   // v0.46: the head at the far end when turned round
      const near = along === 'y' ? (a.x < it.x + w / 2 ? -1 : 1) : (a.y < it.y + d / 2 ? -1 : 1);
      const H0 = along === 'y' ? (far ? it.y + d - hy : it.y + hy) : (far ? it.x + w - hy : it.x + hy);
      const L = along === 'y' ? [it.k === 'bed' ? (near < 0 ? it.x + 0.55 : it.x + w - 0.55) : it.x + w / 2, H0] : [H0, it.k === 'bed' ? (near < 0 ? it.y + 0.55 : it.y + d - 0.55) : it.y + d / 2];
      const E = along === 'y' ? [near < 0 ? it.x + 0.22 : it.x + w - 0.22, L[1] + 0.15 * hs] : [L[0] + 0.15 * hs, near < 0 ? it.y + 0.22 : it.y + d - 0.22];
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
  // v0.43: a label you can tap: the hit gets the label's box once the labels are laid out
  const hitLabel = (H, pri, ...a) => { hits.push(H); label(...a, pri, H); };
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
    TL = layoutOf(SCENE_TOWN); syncWorld();
    NIGHT = nightAmount(now(), SCENE_TOWN);
    GLOWS = [];
    ctx.clearRect(0, 0, W, H);
    hits = [];
    labelsBegin();   // v0.43: every label is drawn last, laid out so none overlap
    BARS = [];
    try {
      if (mode === 'interior') renderInterior(ts, dt);
      else if (mode === 'shop') renderShop(ts, dt);
      else renderWorld(ts, dt);
    } catch (e) { console.error(e); }
    try { labelsFlush(); } catch (e) { console.error(e); LABEL_Q = null; }
    try { BARS.forEach(f => f()); } catch (e) { console.error(e); }
    BARS = [];
    drawFloats(ts);
    drawPing(ts);
  }
  let PING = 0;
  // v0.50 (Mason #29): how far along what you're doing is: a white pill over your head, what it is, a green bar
  let BARS = [];
  function doBar(cx, cy, frac, e, z) {
    BARS.push(() => {
      const s2 = clamp(z, 0.7, 1.25), w = 50 * s2, h = 15 * s2, x0 = cx - w / 2, y0 = cy - h / 2, f = clamp(frac, 0, 1);
      rrect(x0 - 1, y0 + 1, w + 2, h + 1, h / 2 + 1, 'rgba(0,0,0,.18)');
      rrect(x0, y0, w, h, h / 2, '#fffdf8', 'rgba(59,49,37,.25)', 1);
      const bx = x0 + (e ? h + 1 * s2 : 4 * s2), bw = x0 + w - 4 * s2 - bx, bh = 5.5 * s2, by = cy - bh / 2;
      rrect(bx, by, bw, bh, bh / 2, '#e6dfd2');
      if (f > 0) rrect(bx, by, Math.max(bh, bw * f), bh, bh / 2, f >= 1 ? '#34b27b' : '#6cbf73');
      if (e) emoji(e, x0 + h / 2 + 1 * s2, cy + 5.5 * s2, 10.5 * s2);
    });
  }
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
    label(`📍 ${t('you_here')}`, p.x, py, '#ef7d3c', '#ffffff', `800 13px ${UI_FONT},${EMOJI_FONT}`, 26, 6);
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
    if (mode === 'shop') {   // v0.34: a tap opens what you tapped (a thing, a person, the counter) at once; you stay put until you do something with it
      const find = kd => [...hits].reverse().find(x => x.kind === kd && inside(x, sx, sy));
      const h = find('clerk') || find('person') || find('ware') || find('shopDoor');
      const P = shopPlan(owner);
      if (h && (h.kind === 'clerk' || h.kind === 'person')) return onHit(h);
      if (h && h.kind === 'shopDoor') return shopWalk(P.door, () => onHit(h));
      const w2 = h && P.wares.find(x => x.id === h.id), go = !!w2 && ['escalator', 'cinemaDoor', 'cinemaExit'].includes(w2.kind);   // these take you somewhere: off you go
      if (owner === 'cinema' && meS.sit && P.aisle && (go || !h)) { meS.sit = false; meS.path = [[P.aisle[0], meS.y]]; meS.moving = true; meS.then = () => { if (w2) shopWalk([w2.x + w2.w / 2, w2.y + w2.d + 0.55], () => onHit(h)); }; return; }   // v0.24: along the row to the aisle first
      if (go) { meS.sit = false; return shopWalk([w2.x + w2.w / 2, w2.y + w2.d + 0.55], () => onHit(h)); }
      if (h) return onHit(h);
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
    if (h.plots) {   // v0.46: single plots
      const tx = Math.floor(lx), ty = Math.floor(ly), i = h.plots.findIndex(p => p[0] === tx && p[1] === ty);
      if (i >= 0 && i < h.fields.length) return onHit({ kind: 'field', owner, i });
      const nx = owner === 'me' && nextPlotSpot(h);
      if (nx && nx[0] === tx && nx[1] === ty) return onHit({ kind: 'buyLand' });
    }
    const fx = Math.floor(lx) - areaOf(h, 'fields').x, fy = Math.floor(ly) - areaOf(h, 'fields').y;
    if (!h.plots && fx >= 0 && fx < 4 && fy >= 0 && fy < 4) {
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
      case 'trough': { const pr = pastureRect(h); return pr ? () => [pr.x + 1.5, pr.y + pr.d - 0.05, 1] : null; }   // v0.44
      case 'door': { const [, fy, , fd] = HOUSES[h.house].fp; return () => [DOOR_X, fy + fd + 0.35, 1]; }
      case 'gate': return () => [3.5, LOT_D + 0.7, 0];
      case 'yard': { const it = h.yard.find(x => x.id === tg.id); if (!it) return null; const [w, d] = itemSize('yard', it), [dx, dy] = needsFront('yard', it.k) ? ROT_DIR[(it.rot || 0) & 3] : [0, 1]; return () => [it.x + w / 2 + dx * (w / 2 + 0.15), it.y + d / 2 + dy * (d / 2 + 0.15), faceAlong(-dx, -dy).face]; }   // v0.46: to its front
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
      key, spot, pose: o.pose, dur: o.dur || 0, sneak: o.sneak, reach: o.reach || 2.2, valid: o.valid, e: o.e,
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
      const hy = (LIE_HEAD[it.k] || 0.35) + 0.42, along = it.rot & 1 ? 'x' : 'y', far = (it.rot & 3) >= 2;
      const H0 = along === 'y' ? (far ? it.y + d - hy : it.y + hy) : (far ? it.x + w - hy : it.x + hy);
      const side = n => (along === 'y' ? [n < 0 ? it.x - 0.45 : it.x + w + 0.45, H0] : [H0, n < 0 ? it.y - 0.45 : it.y + d + 0.45]);
      const nearFirst = (along === 'y' ? a.x < it.x + w / 2 : a.y < it.y + d / 2) ? [-1, 1] : [1, -1], [dx, dy] = ROT_DIR[(it.rot || 0) & 3];
      c = [...nearFirst.map(side), [it.x + w / 2 + dx * (w / 2 + 0.45), it.y + d / 2 + dy * (d / 2 + 0.45)]];   // beside the pillow, or at the foot
    } else {   // v0.46: in front first, then the sides, then behind
      const [dx, dy] = ROT_DIR[(it.rot || 0) & 3], pt = (ex, ey) => [it.x + w / 2 + ex * (w / 2 + 0.45), it.y + d / 2 + ey * (d / 2 + 0.45)];
      c = [pt(dx, dy), pt(dy, dx), pt(-dy, -dx), pt(-dx, -dy)];
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
    // v0.43: a shop or a building in town, for the top of its card (without its name sign)
    store(k, o, w, h) {
      const S2 = STORES[k]; if (!S2 || !S2.w) return;
      const wh = CIVIC_WH[k] || (k === 'mall' ? 52 : 34), sv = LABEL_Q;
      frameFoot(S2.w + 0.8, S2.d + 0.8, Math.min(wh, 110) + 24, w, h, 1.6);
      LABEL_Q = [];
      try { drawStore([k, 0.4, 0.4, S2.w, S2.d + STORE_FRONT, 'S'], o.ts || 0); } finally { LABEL_Q = sv; }
    },
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
        ['🪙', '💰', '🪙', '🌱'].forEach((e, i) => {
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
    // v0.49: coming out of a building: look at its door (Mason #29: it used to zoom out to the whole town)
    focusPlace(key) { if (mode !== 'town') return; TL = layoutOf(VIEW_TOWN); const p = placePt(key); if (p) flyTo(p[0], p[1], Math.max(0.85, cam.z), true); },
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
    // v0.32: do something in the park (watch a game, feed the ducks, sit on the bench…); how long is left
    parkUse(k, secs, done) { return parkUseNow(k, secs, done); },
    parkBusy() { return TOWN_USE ? Math.max(0, Math.ceil((TOWN_USE.until - performance.now()) / 1000)) : 0; },
    parkHas(k) { return mode === 'town' && !!TL.park && !!parkPlan().spots[k]; },
    // v0.33: the people playing on each court (to play with, and to watch you from the side)
    parkLooks(k) { return k === 'tennis' ? TENNIS_P : k === 'basketball' ? BALLERS : TEAMS; },
    courtLook(k) { return k === 'tennis' ? TENNIS_P[1] : k === 'basketball' ? BALLERS[0] : TEAMS[4]; },
    // v0.31: play a social moment with someone: your bubble (e), then theirs (react), for SOCIAL.sec seconds
    socialAnim(id, e, react, wave) { CHAT = { id, t0: performance.now(), until: performance.now() + SOCIAL.sec * 1000 + 600, e, react, wave }; },
    talk(id, lines, wave) { return makeTalk(id, lines, wave); },   // v0.51: lines back and forth over your heads; how long (s)
    // v0.30: inside a building: sit at / lie on / work out on something for a while, then done(); what you're doing now
    venueUse(id, secs, done, mate, e) { if (mode === 'shop') venueUseNow(id, secs, done, mate, e); else if (done) done(); },
    // v0.50 (Mason #29): go over to it (a ware's id or key, 'till', or null: here), then `secs` with a bar showing `e`, then done
    shopDo(id, secs, e, done) { if (mode === 'shop' && secs > 0) venueUseNow(id, secs, done, null, e); else if (mode === 'shop') this.shopGoTo(id, done); else if (done) done(); },
    // out in town, right where you are (the lake, the fields, a place's door)
    townDo(secs, e, done, pose, prop) { return townDoNow(secs, e, done, pose, prop); },
    // at home: to the kitchen (or the stove), cook for `ms`, then done
    cookAt(ms, done) {
      if (mode !== 'interior' || owner !== 'me') { if (done) done(); return false; }
      const it = viewRoom(homeOf('me')).items.find(x => x.k === 'kitchen' || x.k === 'stove');
      cancel(meIn);
      const sp = it ? useSpot(it) : [meIn.x, meIn.y, meIn.face || 1];
      meIn.jobs.push({ key: 'cook', spot: () => sp, pose: 'stand', dur: ms, reach: 1.3, e: '🍳', done, fail: done });
      return true;
    },
    venueBusy() { return mode === 'shop' && meS.use && meS.use.until ? Math.max(0, Math.ceil((meS.use.until - performance.now()) / 1000)) : 0; },
    // v0.29: on the way somewhere: the view goes with you again (after you dragged it away); stop where you are
    followTrip() { if (!trip || trip.arrived || mode !== 'town') return false; trip.camFree = false; return true; },
    stopTrip() { return stopTripHere(); },
    // v0.25: walk up to someone in town (a person out walking or someone in the park), then have a chat
    canWalkUp(id) { return mode === 'town' && VIEW_TOWN === myTown() && !S.work && !S.study && !jailed() && !!(parkList().find(p => p.id === id) || (WALK.town === VIEW_TOWN && WALK.list.find(w => w.id === id))); },
    walkUp(id, done) {
      const pp = parkList().find(p => p.id === id), w = !pp && WALK.town === VIEW_TOWN && WALK.list.find(x => x.id === id);
      if (mode !== 'town' || (!pp && !w)) { if (done) done(); return; }
      stopTripHere(); TOWN_USE = null;   // v0.29: from where you are now
      if (w) { w.path = []; w.stay = Math.max(w.stay || 0, 14); w.moving = false; }   // they stop for you
      const pt = pp ? [pp.x, pp.y] : [w.x, w.y], stand = [pt[0] + 0.15, pt[1] + 1.05], from = mePos();   // just in front of them
      const both = inParkPt(from) && inParkPt(stand), near = !both && Math.hypot(stand[0] - from[0], stand[1] - from[1]) < 2;
      const path = both ? parkRoute(from, stand) : near ? [stand] : [...route(from, stand), stand];   // v0.34: in the park, round things
      const place = pp ? 'park' : (S.out && S.out.place) || null;
      trip = { kind: 'chat', town: VIEW_TOWN, legs: [{ how: 'walk', from, path }], li: 0, how: 'walk', inCar: false, car: null, x: from[0], y: from[1], path: path.slice(), dest: null, place, face: 1, phase: 0, moving: true, dir: '+y', arrived: false, t: now(),
        done: () => { CHAT = { id, until: performance.now() + 4000 }; if (w) w.stay = Math.max(w.stay, 5); if (done) done(); } };
    },
    parkFolk() { return parkList().map(p => ({ id: p.id, work: !!p.work, boss: !!p.boss })); },
    stroll(done) {   // v0.25: a lap of the park's jogging path, then back where you started
      if (mode !== 'town' || !TL.parkLoop) { if (done) done(); return; }
      stopTripHere(); TOWN_USE = null;
      const loop = smoothPts(TL.parkLoop, 1.2).map(p => [p[0], p[1]]), from = mePos();
      let k0 = 0, bd = 1e9; loop.forEach((p, i) => { const d = Math.hypot(p[0] - from[0], p[1] - from[1]); if (d < bd) { bd = d; k0 = i; } });
      const lap = [...loop.slice(k0), ...loop.slice(0, k0), loop[k0], from];
      trip = { kind: 'stroll', town: VIEW_TOWN, legs: [{ how: 'walk', from, path: lap }], li: 0, how: 'walk', inCar: false, car: null, x: from[0], y: from[1], path: lap.slice(), done, dest: null, place: 'park', face: 1, phase: 0, moving: true, dir: '+y', arrived: false, t: now() };
    },
    // Public places (v0.12): where each one is (where you walk to), and whether you're there now.
    placePoint(key) { TL = layoutOf(VIEW_TOWN); return placePt(key); },
    here() { return S && S.work && VIEW_TOWN === myTown() ? S.work.place : S && jailed() && VIEW_TOWN === myTown() ? 'police' : trip && !trip.arrived ? (trip.place === 'park' && ['stroll', 'park', 'chat'].includes(trip.kind) && inParkPt(mePos()) ? 'park' : null) : outHere() ? S.out.place : null; },   // v0.34: on a lap of the park you're still in the park
    resting() { return mode === 'interior' && owner === 'me' && !!meIn.useId && !!(homeOf('me').room.items.concat(...(homeOf('me').ups || []).map(u => u.items)).find(i => i.id === meIn.useId && FURN[i.k].use === 'sleep')); },
    arriveAt(pt, place) { if (!S) return; S.out = { town: VIEW_TOWN, pt, place: place || null, id: null }; trip = null; if (mode === 'town') flyTo(pt[0], pt[1], Math.max(cam.z, 0.5)); },
    tripTime(to, how, dest, place, pick) { if (!S) return 0; TRIP_CAR = pick === undefined ? null : pick; try { return Math.max(1, Math.round(tripSecs(planTrip(to, how, dest, place)))); } finally { TRIP_CAR = null; } },
    liveAt() { TL = layoutOf(VIEW_TOWN); return liveSpotTown(); },
    lookAt(x, y) { if (mode === 'town') flyTo(x, y, Math.max(cam.z, 0.45)); },
    _fly(x, y, z) { flyTo(x, y, z, true); },   // (testing: jump the camera)
    // (testing, v0.47) walking to every door from a few far points: how many legs go through a building
    _walkCheck() { const doors = [...TL.shops.map(([k]) => placePt(k)), ...(TL.stores || []).map(st => storeGeo(st).door)].filter(Boolean), from = [[5, 5], [TL.world.x1 - 5, 5], [5, TL.world.y1 - 5], [TL.world.x1 - 5, TL.world.y1 - 5]], bad = [];
      doors.forEach(d => from.forEach(f => { const r = route(f, d); [f, ...r].forEach((q, i, all) => { if (i && throughBld(all[i - 1], q)) bad.push([d.map(Math.round), all[i - 1].map(v => +v.toFixed(1)), q.map(v => +v.toFixed(1))]); }); }));
      return { doors: doors.length, bad }; },
    _lots() { return lotSignals().list.map(L => [+L.x.toFixed(1), +L.y.toFixed(1), L.axis]); },
    _trip() { return trip && { x: trip.x, y: trip.y, ox: trip.ox, oy: trip.oy, ang: trip.ang, dir: trip.dir, inCar: trip.inCar, li: trip.li, path: trip.path.slice(0, 4), cam: { ...cam } }; },
    _plan(k) { const P = shopPlan(k || owner); return P && { RW: P.RW, RD: P.RD, esc: P.wares.filter(w => w.kind === 'escalator').map(w => [w.k, w.x, w.y]), n: P.wares.length }; },   // (testing, v0.43)
    _shoppers() { const P = shopPlan(owner); return (P.npcs || []).map(n => ({ x: +n.x.toFixed(2), y: +n.y.toFixed(2), path: (n.path || []).map(q => q.map(v => +v.toFixed(2))) })); },   // (testing, v0.45)
    _traffic() { const N = roadNet(); return { walk: WALK.list.map(w => [w.id, Math.round(w.x), Math.round(w.y)]), fw: FW, town: CARS_OUT, stops: stops().list.length, signs: roadSigns().list.length, signals: signals().list.length, juncs: junctions().list.map(J => [J.x, J.y, J.h.kind, J.v.kind, J.k, signals().at.has(J.key) ? 'L' : stops().at.has(J.key) ? 'S' : '-']) }; },   // (testing, v0.39)
    trainBoard: () => trainBoard(),   // v0.38: the station's departures
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
      if (m === 'shop') { const P = shopPlan(o), at = (P.from && P.from[SHOP_FROM]) || P.door; meS.x = at[0]; meS.y = at[1] + 0.3; meS.path = []; meS.then = null; meS.moving = false; meS.face = 1; meS.sit = false; meS.use = null; meS.eat = null; SHOP_FROM = o;
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
    // v0.50 (tests): which things in a store / building you can't walk up to from the door; its walkable cells
    _reach(k) { const P = shopPlan(k), from = [P.door[0], P.door[1] + 0.3], bad = []; P.wares.forEach(w => { const to = w.stand || [w.x + w.w / 2, w.y + w.d + 0.55]; const { g, gw, gd, GS } = P.nav; let [ti, tj] = [Math.floor(to[0] / GS), Math.floor(to[1] / GS)]; let dest = to; if (!(ti >= 0 && tj >= 0 && ti < gw && tj < gd && g[tj * gw + ti])) { let best = null, bd = 1e9; for (let j = 0; j < gd; j++) for (let i = 0; i < gw; i++) if (g[j * gw + i]) { const d = Math.hypot(i - ti, j - tj); if (d < bd) { bd = d; best = [i, j]; } } if (best) dest = [(best[0] + 0.5) * GS, (best[1] + 0.5) * GS]; } if (!shopPath(P, from, dest)) bad.push(w.id); }); return { n: P.wares.length, bad }; },
    _grid(k) { const P = shopPlan(k), { g, gw, gd } = P.nav, rows = []; for (let j = 0; j < gd; j++) { let r = ''; for (let i = 0; i < gw; i++) r += g[j * gw + i] ? '.' : '#'; rows.push(r); } P.wares.forEach(w => { const st = w.stand || [w.x + w.w / 2, w.y + w.d + 0.55], i = Math.floor(st[0] / 0.5), j = Math.floor(st[1] / 0.5); if (rows[j]) rows[j] = rows[j].slice(0, i) + 'S' + rows[j].slice(i + 1); }); const dr = [Math.floor(P.door[0] / 0.5), Math.floor((P.door[1] + 0.3) / 0.5)]; if (rows[dr[1]]) rows[dr[1]] = rows[dr[1]].slice(0, dr[0]) + 'D' + rows[dr[1]].slice(dr[0] + 1); return rows; },
    shopEat(e, secs, done) {   // sit down at a free table and eat (v0.50: with the bar; done once you've eaten)
      if (mode !== 'shop') { if (done) done(); return; }
      shopEatNow(e, secs || 8, done);
    },
    shopBusy() { return mode === 'shop' && ((meS.use && meS.use.until) || (meS.eat && meS.eat.secs)) ? Math.max(0, Math.ceil((((meS.use && meS.use.until) || meS.eat.until) - performance.now()) / 1000)) : 0; },
    shopWare: id => { const P = mode === 'shop' && shopPlan(owner); return P ? P.wares.find(w => w.id === id) : null; },
    shopGoWare(id, then) { if (mode !== 'shop') return; const P = shopPlan(owner), w = P.wares.find(x => x.id === id); if (w) shopWalk([w.x + w.w / 2, w.y + w.d + 0.55], then); },
    shopGoTill(then) { if (mode === 'shop') shopWalk(shopPlan(owner).till, then); },
    // v0.34: go over to something in a store or building (by id or key, or 'till') once you've decided to use it
    shopGoTo(k, then) {
      if (mode !== 'shop') { if (then) then(); return; }
      const P = shopPlan(owner); if (k === 'till') return P.till ? shopWalk(P.till, then) : then && then();
      const w = P.wares.find(x => x.id === k || x.k === k) || P.wares.find(x => x.kind === k);   // v0.50: or by its kind (the cinema's ticket booth)
      if (!w) { if (then) then(); return; }
      const to = w.stand || [w.x + w.w / 2, w.y + w.d + 0.55];
      if (!meS.moving && !meS.use && Math.hypot(meS.x - to[0], meS.y - to[1]) < 0.6) { if (then) then(); return; }
      if (!shopWalk(to, then) && then) then();   // v0.50: no way over: do it anyway
    },
    // v0.34: someone in this building or store: are they here, and walk up to them (they wait for you)
    folkHere(id) { return mode === 'shop' && !!FOLK_AT[id]; },
    // v0.34: are you standing right next to them (in a building, or out in town), not walking off somewhere
    near(id) {
      if (mode === 'shop') { const f = FOLK_AT[id]; return !!f && !meS.moving && Math.hypot(meS.x - f[0], meS.y - f[1]) < 2.3; }
      if (mode !== 'town' || VIEW_TOWN !== myTown() || (trip && !trip.arrived)) return false;
      const pp = parkList().find(p => p.id === id), w = !pp && WALK.town === VIEW_TOWN && WALK.list.find(x => x.id === id), at = pp ? [pp.x, pp.y] : w ? [w.x, w.y] : null;
      if (!at) return false; const m = mePos(); return Math.hypot(m[0] - at[0], m[1] - at[1]) < 2.3;
    },
    walkToFolk(id, done) {
      const f = mode === 'shop' && FOLK_AT[id];
      if (!f) { if (done) done(); return; }
      FOLK_HOLD[id] = performance.now() + 20000;
      shopWalk([f[0] + 0.55, f[1] + 0.75], () => { FOLK_HOLD[id] = performance.now() + 9000; if (done) done(); });
    },
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
    debug: () => ({ traffic: CARS_OUT.list.map(c => [Math.round(c.x), Math.round(c.y), c.path.length, c.police ? 'police' : '']), walkers: WALK.list.map(w => [Math.round(w.x), Math.round(w.y), w.bike ? 'bike' : 'walk', w.path.length]), meS: { x: meS.x, y: meS.y, path: meS.path.length }, cam: { ...cam }, W, H, mode, owner, edit, ents: ents.size, me: { x: me.x, y: me.y, lot: me.lot, jobs: me.jobs.length, cur: !!me.cur, act: me.act && me.act.pose, actIn: !!me.act, path: me.path.length, pose: mePose() }, meIn: { x: meIn.x, y: meIn.y, pose: meIn.act && meIn.act.pose }, trip: trip && { kind: trip.kind, x: trip.x, y: trip.y, path: trip.path.map(q => [+q[0].toFixed(2), +q[1].toFixed(2)]), arrived: trip.arrived }, folk: { ...FOLK_AT } }),
    _parkRoute: (a, b) => parkRoute(a, b), _parkPlan: () => parkPlan(),   // v0.34: for testing
    look(z, wx, wy) { useCam(); cam.z = z; centerOn(wx, wy); fly = null; follow = false; },
    bench(n = 20) { const t0 = performance.now(); for (let i = 0; i < n; i++) render(t0 + i * 16); return +((performance.now() - t0) / n).toFixed(2); },
  };
})();
