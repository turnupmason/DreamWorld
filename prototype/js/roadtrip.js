'use strict';
// v0.60 (Mason #30): driving to another place on the DreamWorld map, and seeing the whole way.
// Drive.open({ from, to, place }, onArrive) plans the shortest way along the interstates (DREAM_ROADS) and shows it
// in the town's own 2.5D look: your car on a six-lane highway (three lanes each way, a median), the other traffic
// (simulated on this phone only: D311), the land you pass through in each place's colours and trees, sea bridges over
// the water, tunnels through the mountains, the signs (leaving town, how far it is, the towns you pass, the exit,
// welcome), and a little map with you on it. Change lanes with the arrows; speed it up ×3 or ×8. At the end your car
// turns off into the city and onArrive() runs (the app puts you in the city).
const Drive = (() => {
  let root = null, cv = null, g = null, hud = null, mini = null, card = null, raf = 0, last = 0, W = 0, H = 0, R = null, mapCv = null, mult = 1;
  const half = DRIVE.median + DRIVE.laneW * 3 + 0.7;   // the carriageway's half width (tiles)
  const laneX = (ln, dir = 1) => dir * (DRIVE.median + DRIVE.laneW * (ln + 0.5));   // lane 0: next to the median (the fast lane)
  const rnd = (a, b, c) => { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- the way: Dijkstra over the interstates ----------
  const edgeLen = e => { const P = dreamRoadPts(e[0], e[1], e[3]); let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
  // v0.61: the rails too (DREAM_RAIL: [a, b, bend]); as [a, b, 'R', bend] so they work like the roads
  const railEdges = () => DREAM_RAIL.map(([a, b, bend = 30]) => [a, b, 'R', bend]);
  const onRail = id => DREAM_RAIL.some(r => r[0] === id || r[1] === id);
  function findWay(from, to, edges = DREAM_ROADS) {
    const ids = Object.keys(DREAM_AT), dist = {}, prev = {}, done = {};
    ids.forEach(id => { dist[id] = 1e9; }); dist[from] = 0;
    for (;;) {
      let u = null; ids.forEach(id => { if (!done[id] && dist[id] < 1e9 && (u === null || dist[id] < dist[u])) u = id; });
      if (u === null || u === to) break;
      done[u] = true;
      edges.forEach(e => { if (e[0] !== u && e[1] !== u) return; const v = e[0] === u ? e[1] : e[0], d = dist[u] + edgeLen(e); if (d < dist[v]) { dist[v] = d; prev[v] = { u, e }; } });
    }
    if (dist[to] >= 1e9) return null;
    const legs = []; for (let v = to; v !== from; v = prev[v].u) legs.unshift({ a: prev[v].u, b: v, e: prev[v].e });
    return legs;
  }
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const onLand = (x, y) => DREAM_LAND.some(P => inPoly(x, y, P));
  // the way as points on the map, how far along each is (map units), and what's there (water, a mountain)
  function plan(from, to, mode = 'car') {
    const train = mode === 'train';
    if (train && (!onRail(from) || !onRail(to))) return null;
    const legs = findWay(from, to, train ? railEdges() : DREAM_ROADS);
    if (!legs) return null;
    const pts = [], via = [];
    legs.forEach((L, k) => {
      let P = dreamRoadPts(L.e[0], L.e[1], L.e[3], 40); if (L.e[0] !== L.a) P = P.slice().reverse();
      P.forEach((p, i) => { if (k && !i) return; pts.push({ x: p[0], y: p[1], no: L.e[2], bridge: L.e[4] === 'bridge' }); });
      if (k < legs.length - 1) via.push(L.b);
    });
    let u = 0; pts.forEach((p, i) => { if (i) u += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); p.u = u; p.water = !onLand(p.x, p.y); p.tunnel = !p.water && DREAM_PEAKS.some(([x, y]) => Math.hypot(x - p.x, y - p.y) < DRIVE.tunnel); });
    const len = u, tiles = len * DRIVE.tilesPerUnit;
    // the signs along the way (s: tiles from the start)
    const ev = train ? [{ s: 4, kind: 'leave', id: from }, { s: tiles - 10, kind: 'welcome', id: to }] : [{ s: 6, kind: 'leave', id: from }, { s: tiles - 26, kind: 'exit', id: to }, { s: tiles - 8, kind: 'welcome', id: to }];
    for (let s = 60; s < tiles - 60; s += train ? 180 : 90) ev.push({ s, kind: 'dist' });
    via.forEach(id => { const p = pts.reduce((b, q) => (Math.hypot(q.x - DREAM_AT[id][0], q.y - DREAM_AT[id][1]) < Math.hypot(b.x - DREAM_AT[id][0], b.y - DREAM_AT[id][1]) ? q : b), pts[0]); ev.push({ s: p.u * DRIVE.tilesPerUnit, kind: 'via', id }); });
    const bridges = []; let open = null; pts.forEach(p => { if (p.water && !open) open = p.u; if (!p.water && open !== null) { bridges.push([open, p.u]); open = null; } });
    const km = Math.round(len * DRIVE.km), cost = train ? Math.max(DRIVE.trainMin, Math.round(km * DRIVE.trainFare)) : Math.round(km * DRIVE.gas) + bridges.length * DRIVE.toll;
    return { from, to, legs, pts, via, len, tiles, ev, km, cost, bridges: bridges.length, seed: from.length * 7 + to.length * 13, mode, mins: Math.ceil(tiles / (train ? DRIVE.trainSpeed : DRIVE.speed) / 60) };
  }
  // where on the map, and what's there, at s tiles from the start
  function at(s) {
    const u = Math.max(0, Math.min(R.len, s / DRIVE.tilesPerUnit)), P = R.pts;
    let i = 1; while (i < P.length - 1 && P[i].u < u) i++;
    const a = P[i - 1], b = P[i], k = b.u > a.u ? (u - a.u) / (b.u - a.u) : 0;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, water: k < 0.5 ? a.water : b.water, tunnel: k < 0.5 ? a.tunnel : b.tunnel, no: b.no, bridge: b.bridge };
  }
  // the land's look there: the nearest place's colours and trees
  const nearest = (x, y) => Object.keys(DREAM_AT).reduce((best, id) => (Math.hypot(DREAM_AT[id][0] - x, DREAM_AT[id][1] - y) < Math.hypot(DREAM_AT[best][0] - x, DREAM_AT[best][1] - y) ? id : best), R.from);
  const themeAt = s => { const p = at(s); return TOWN_THEMES[(COMMUNITIES[nearest(p.x, p.y)] || {}).theme] || TOWN_THEMES.maple; };
  // the road winds a little (tiles to the side at s)
  const xr = s => 5 * Math.sin(s / 70 + R.seed) + 2.2 * Math.sin(s / 29 + R.seed * 1.7);

  // ---------- traffic (D311: only on this phone) ----------
  const KINDS = ['sedan', 'suv', 'mini', 'pickup', 'minivan', 'boxtruck', 'luxury', 'sports', 'jeep', 'convertible'];
  function spawn(dir, s) {
    const k = KINDS[Math.floor(Math.random() * KINDS.length)], slow = CAR_PACE[k] < 0.95, ln = slow ? 2 : CAR_PACE[k] > 1.05 ? 0 : 1;
    return { dir, s, ln, lx: laneX(ln, dir), v: DRIVE.speed * (0.82 + CAR_PACE[k] * 0.2), car: { k, color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)] } };
  }
  function density(s) {
    const p = at(s), d = Math.min(...Object.values(DREAM_AT).map(([x, y]) => Math.hypot(x - p.x, y - p.y))), hr = new Date(now()).getHours() + new Date(now()).getMinutes() / 60;
    return DRIVE.traffic * (d < 40 ? DRIVE.city : 1) * (RUSH.hours.some(([a, b]) => hr >= a && hr < b) ? DRIVE.rush : 1);
  }
  function stepTraffic(dt) {
    const me = R.me;
    // keep cars in a window round you: new ones come in at the edges
    R.cars = R.cars.filter(c => c.s > me.s - 40 && c.s < me.s + 120);
    const add = c => { if (!R.cars.some(o => o.dir === c.dir && o.ln === c.ln && Math.abs(o.s - c.s) < 7)) R.cars.push(c); };   // never on top of another car
    if (Math.random() < density(me.s + 110) * dt * 30) add(spawn(1, me.s + 110));
    if (Math.random() < density(me.s - 35) * dt * 8) add(spawn(1, me.s - 35));
    if (Math.random() < density(me.s + 110) * dt * 55) add(spawn(-1, me.s + 115));
    R.cars.forEach(c => {
      if (c.dir > 0) {   // our way: follow, pass on the left, back to the right
        const ahead = R.cars.concat([me]).filter(o => o !== c && o.dir === 1 && o.ln === c.ln && o.s > c.s && o.s - c.s < 7).sort((a, b) => a.s - b.s)[0];
        let v = c.vmax || (c.vmax = c.v);
        if (ahead) { v = Math.min(v, ahead.v * 0.98, Math.max(0, (ahead.s - c.s - 2.8) * 2.5)); if (c.ln > 0 && laneFree(c, c.ln - 1)) c.ln--; }   // keep a car's length or so
        else if (c.ln < 2 && CAR_PACE[c.car.k] < 1.05 && laneFree(c, c.ln + 1) && Math.random() < dt * 0.3) c.ln++;
        c.v += (v - c.v) * Math.min(1, dt * 2);
        c.s += c.v * dt;
      } else c.s -= c.v * dt;
      c.lx += (laneX(c.ln, c.dir) - c.lx) * Math.min(1, dt * 3);
    });
  }
  // v0.61: on the railway: now and then a train the other way
  function stepTrains(dt) {
    const me = R.me;
    R.cars = R.cars.filter(c => c.s > me.s - 60 && c.s < me.s + 160);
    if (!R.cars.length && Math.random() < dt * 0.25) R.cars.push({ dir: -1, s: me.s + 150, ln: 0, lx: -DRIVE.track, v: DRIVE.trainSpeed * 0.9, train: true });
    R.cars.forEach(c => { c.s -= c.v * dt; });
  }
  const laneFree = (c, ln) => !R.cars.concat([R.me]).some(o => o !== c && o.dir === 1 && o.ln === ln && Math.abs(o.s - c.s) < 5);
  function stepMe(dt) {
    const me = R.me, ahead = R.train ? null : R.cars.filter(o => o.dir === 1 && o.ln === me.ln && o.s > me.s && o.s - me.s < 6).sort((a, b) => a.s - b.s)[0];
    let v = R.train ? DRIVE.trainSpeed : DRIVE.speed;
    if (ahead) v = Math.min(v, ahead.v * 0.98, (ahead.s - me.s - 2.6) * 3);
    if (me.s > R.tiles - 30) v = Math.min(v, Math.max(3, (R.tiles - me.s) * 0.6));   // slowing for the exit
    me.v += (Math.max(0, v) - me.v) * Math.min(1, dt * 2.5);
    me.s = Math.min(R.tiles, me.s + me.v * dt);
    if (!R.train) me.lx += (laneX(me.ln) - me.lx) * Math.min(1, dt * 3);
    if (me.s >= R.tiles - 0.01 && R.phase === 'go') arrive();
  }

  // ---------- drawing (the town's own iso look: the road runs away from you, up the screen) ----------
  const W2 = (s, off) => [xr(s) + off, -s];   // world tile at s along the road, off to the side
  function draw(ts) {
    const me = R.me, z = Math.max(0.6, Math.min(1.1, W / 420)) * 0.85, TH0 = themeAt(me.s);
    const saved = [ctx, cam, PAL, GLOWS];
    ctx = g; PAL = TH0; GLOWS = [];
    const [mx, my] = W2(me.s, me.lx);
    cam = { z, x: 0, y: 0 }; const p0 = iso(mx, my); cam.x = W * 0.3 - p0.x; cam.y = H * 0.8 - p0.y;
    try {
      const here = at(me.s), inTunnel = here.tunnel, sky = inTunnel ? '#3a3d44' : here.water ? '#8fcbe8' : TH0.woods;
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      const s0 = me.s - 30, s1 = me.s + 95, objs = [];
      // the ground beside the road: water under the bridges, the land's colour, a tunnel's walls
      for (let s = Math.floor(s0); s < s1; s += 1) {
        const A = at(s), th = themeAt(s), col = A.tunnel ? '#3a3d44' : A.water ? '#8fcbe8' : th.woods;
        if (col !== sky) poly([iso(...W2(s, -40)), iso(...W2(s + 1.05, -40)), iso(...W2(s + 1.05, 40)), iso(...W2(s, 40))], col);
        if (A.water && rnd(s, 1, R.seed) < 0.25) { const q = iso(...W2(s, (rnd(s, 2, 3) - 0.5) * 60)); line(q.x - 6, q.y, q.x + 6, q.y, 'rgba(255,255,255,.5)', 1.2); }
      }
      if (R.train) drawRails(s0, s1, z, objs, ts); else
      // the road: shoulders, the two carriageways, the median, the lines
      for (let s = Math.floor(s0); s < s1; s += 1) {
        const A = at(s), q = (off, ds = 0) => iso(...W2(s + ds, off));
        poly([q(-half - 0.4), q(-half - 0.4, 1.05), q(half + 0.4, 1.05), q(half + 0.4)], A.water ? '#b9bfc6' : '#c9c2b2');
        poly([q(-half), q(-half, 1.05), q(half, 1.05), q(half)], '#7d848b');
        poly([q(-DRIVE.median + 0.1), q(-DRIVE.median + 0.1, 1.05), q(DRIVE.median - 0.1, 1.05), q(DRIVE.median - 0.1)], A.tunnel || A.water ? '#b9bfc6' : '#7fae5a');
        if (z > 0.3) {
          [-1, 1].forEach(d => { [1, 2].forEach(k => { if (Math.floor(s) % 3 === 0) { const a = q(d * (DRIVE.median + DRIVE.laneW * k)), b = q(d * (DRIVE.median + DRIVE.laneW * k), 1.2); line(a.x, a.y, b.x, b.y, 'rgba(255,255,255,.85)', 1.3 * z); } });
            const a = q(d * (half - 0.25)), b = q(d * (half - 0.25), 1.05); line(a.x, a.y, b.x, b.y, 'rgba(255,255,255,.75)', 1.1 * z);
            const c2 = q(d * (DRIVE.median + 0.08)), e = q(d * (DRIVE.median + 0.08), 1.05); line(c2.x, c2.y, e.x, e.y, '#f2c230', 1.1 * z); });
        }
      }
      // things beside the road (one row a tile): trees in the land's own kind, bridge rails and piers, tunnel walls
      for (let s = Math.floor(s0); s < s1; s++) {
        const A = at(s);
        if (A.water) {   // the bridge: a railing each side, a pier now and then, a tall tower on a long one
          [-1, 1].forEach(d => { const [wx, wy] = W2(s, d * (half + 0.3)); objs.push({ d: wx + wy, f: () => { const a = iso(wx, wy), b = iso(...W2(s + 1, d * (half + 0.3))); line(a.x, a.y - 5 * z, b.x, b.y - 5 * z, '#e8ecf0', 1.6 * z); if (s % 4 === 0) line(a.x, a.y, a.x, a.y - 5 * z, '#c9cfd6', 1 * z); } }); });
          if (s % 40 === 0) [-1, 1].forEach(d => { const [wx, wy] = W2(s, d * (half + 0.9)); objs.push({ d: wx + wy + 0.5, f: () => { const a = iso(wx, wy), tp = { x: a.x, y: a.y - 90 * z }; rrect(a.x - 3 * z, tp.y, 6 * z, 90 * z, 2 * z, '#dfe4ea'); for (let k = 1; k < 5; k++) { const c1 = iso(...W2(s + k * 5, d * (half - 1))), c0 = iso(...W2(s - k * 5, d * (half - 1))); line(tp.x, tp.y + 6 * z, c1.x, c1.y - 5 * z, 'rgba(230,235,240,.8)', 0.7 * z); line(tp.x, tp.y + 6 * z, c0.x, c0.y - 5 * z, 'rgba(230,235,240,.8)', 0.7 * z); } } }); });
          continue;
        }
        if (A.tunnel) {   // inside the mountain: walls with lights
          [-1, 1].forEach(d => { const [wx, wy] = W2(s, d * (half + 0.6)); objs.push({ d: wx + wy, f: () => { const a = iso(wx, wy), b = iso(...W2(s + 1, d * (half + 0.6))); poly([a, b, { x: b.x, y: b.y - 34 * z }, { x: a.x, y: a.y - 34 * z }], d > 0 ? '#555a62' : '#4a4f57'); if (s % 3 === 0) circle(a.x, a.y - 26 * z, 2 * z, '#ffd36b'); } }); });
          const nxt = at(s + 1), prv = at(s - 1);
          if (!prv.tunnel || !nxt.tunnel) { const [wx, wy] = W2(s, 0); objs.push({ d: wx + wy + 3, f: () => { const L = iso(...W2(s, -half - 2)), Rr = iso(...W2(s, half + 2)); poly([L, Rr, { x: Rr.x, y: Rr.y - 60 * z }, { x: L.x, y: L.y - 60 * z }], '#8a8f86'); const l2 = iso(...W2(s, -half)), r2 = iso(...W2(s, half)); ctx.fillStyle = '#1e2026'; ctx.beginPath(); ctx.moveTo(l2.x, l2.y); ctx.lineTo(l2.x, l2.y - 26 * z); ctx.quadraticCurveTo((l2.x + r2.x) / 2, (l2.y + r2.y) / 2 - 52 * z, r2.x, r2.y - 26 * z); ctx.lineTo(r2.x, r2.y); ctx.closePath(); ctx.fill(); } }); }
          continue;
        }
        const th = themeAt(s);
        for (let k = 0; k < 3; k++) {
          const side = rnd(s, k, R.seed) < 0.5 ? -1 : 1, off = side * (half + 2 + rnd(s, k + 9, R.seed) * 26), v = rnd(s, k + 4, R.seed), [wx, wy] = W2(s + rnd(s, k + 2, 1), off);
          if (rnd(s, k + 7, R.seed) < 0.35) continue;
          objs.push({ d: wx + wy, f: () => { PAL = th; if (v < 0.12) drawRock(wx, wy, v * 5); else if (v < 0.25) drawBushWild(wx, wy, v); else drawWildTree(wx, wy, v, ts); } });
        }
        if (!R.train && s % 9 === 0) [-1, 1].forEach(d => { const [wx, wy] = W2(s, d * (half + 0.8)); objs.push({ d: wx + wy, f: () => { const a = iso(wx, wy); line(a.x, a.y, a.x, a.y - 30 * z, '#9aa3ad', 1.2 * z); line(a.x, a.y - 30 * z, a.x - d * 6 * z, a.y - 31 * z, '#9aa3ad', 1.2 * z); if (NIGHT > 0.3) glow(a.x - d * 6 * z, a.y - 31 * z, 30 * z, 0.6); } }); });   // street lights
      }
      // the towns you pass and the cities at both ends: a cluster of buildings beside the road
      const townAt = (s, id, side) => { for (let k = 0; k < 7; k++) {   // buildings with rows of windows (taller in a city)
        const off = side * (half + 4 + rnd(k, s, 3) * 10), ss = s + (k - 3) * 3.2, [wx, wy] = W2(ss, off), h = 22 + rnd(k, s, 5) * (isTeamCity(id) ? 60 : 24), col = ['#d8c8b0', '#c9d2dc', '#e8dcc4', '#b9c4d0', '#e2b9a4'][(k + Math.round(s)) % 5];
        objs.push({ d: wx + wy + 1, f: () => { const b = box(wx - 1.2, wy - 1.2, 2.4, 2.4, h, col, 0, { top: shade(col, -0.25) }); const lit = NIGHT > 0.3;
          for (let f = 8; f < h - 4; f += 7) [b.left, b.right].forEach(face => { for (let i = 0; i < 3; i++) wallRect(face, 0, 0.12 + i * 0.28, 0.3 + i * 0.28, f, f + 4, lit ? '#ffe39a' : '#9fc6e0'); }); } }); } };
      R.p.ev.forEach(E => { if (E.s < s0 - 10 || E.s > s1 + 10) return; if (E.kind === 'via') townAt(E.s, E.id, 1); });
      if (me.s < 50) townAt(14, R.p.from, -1);
      if (me.s > R.tiles - 90) { townAt(R.tiles - 6, R.p.to, 1); townAt(R.tiles + 6, R.p.to, -1); }
      // the signs
      R.p.ev.forEach(E => { if (E.s < s0 || E.s > s1) return; const [wx, wy] = W2(E.s, half + 1.4); objs.push({ d: wx + wy + 0.5, f: () => sign(E, wx, wy, z) }); });
      // the cars (yours too) — on the railway, the trains
      if (R.train) R.cars.concat([me]).forEach(c => trainObjs(c, s0, s1, z, objs));
      else R.cars.concat([me]).forEach(c => { if (c.s < s0 || c.s > s1) return; const [wx, wy] = W2(c.s, c.lx); objs.push({ d: wx + wy + 0.6, f: () => { drawCarAng(c.car, wx, wy, c.dir > 0 ? -Math.PI / 2 : Math.PI / 2, ts); if (c === me) { const p = iso(wx, wy); circle(p.x, p.y + 12 * z, 2.5 * z, '#ffd36b'); } } }); });
      objs.sort((a, b) => a.d - b.d).forEach(o => o.f());
      if (NIGHT > 0.05) { g.fillStyle = `rgba(16,22,60,${(NIGHT * 0.42).toFixed(3)})`; g.fillRect(0, 0, W, H); drawGlows(); }
    } finally { [ctx, cam, PAL, GLOWS] = saved; }
  }
  // v0.61: the railway: ballast, sleepers and two tracks, a pole with the overhead wire every few tiles; the
  // platforms of the stations you pass
  function drawRails(s0, s1, z, objs) {
    const T = DRIVE.track;
    for (let s = Math.floor(s0); s < s1; s += 1) {
      const A = at(s), q = (off, ds = 0) => iso(...W2(s + ds, off));
      poly([q(-T - 1.3), q(-T - 1.3, 1.05), q(T + 1.3, 1.05), q(T + 1.3)], A.water ? '#b9bfc6' : '#a89a86');
      if (z > 0.25) [-T, T].forEach(c => { for (let k = 0; k < 2; k++) { const a = q(c - 0.55, k * 0.5), b = q(c + 0.55, k * 0.5); line(a.x, a.y, b.x, b.y, '#6b5444', 2.2 * z); } });
      [-T, T].forEach(c => [-0.36, 0.36].forEach(o => { const a = q(c + o), b = q(c + o, 1.05); line(a.x, a.y, b.x, b.y, '#c9cfd6', 1.3 * z); }));
      if (s % 7 === 0 && !A.tunnel) { const [wx, wy] = W2(s, T + 1.6); objs.push({ d: wx + wy, f: () => { const a = iso(wx, wy), top = a.y - 38 * z, w2 = iso(...W2(s, -T)); line(a.x, a.y, a.x, top, '#8e959c', 1.6 * z); line(a.x, top + 3 * z, w2.x, w2.y - 33 * z, '#8e959c', 1 * z); } }); }
    }
    for (let s = Math.floor(s0); s < s1; s += 1) { const a = iso(...W2(s, T)), b = iso(...W2(s + 1, T)), c2 = iso(...W2(s, -T)), d2 = iso(...W2(s + 1, -T)); line(a.x, a.y - 33 * z, b.x, b.y - 33 * z, 'rgba(60,60,60,.55)', 0.7 * z); line(c2.x, c2.y - 33 * z, d2.x, d2.y - 33 * z, 'rgba(60,60,60,.55)', 0.7 * z); }
    R.p.ev.forEach(E => { if ((E.kind !== 'via' && E.kind !== 'leave' && E.kind !== 'welcome') || E.s < s0 - 12 || E.s > s1 + 12) return;   // a platform with a roof
      [-1, 1].forEach(d => { const [wx, wy] = W2(E.s - 6, d * (T + 2.2)); objs.push({ d: wx + wy + 6, f: () => { box(wx - 0.9, wy - 12, 1.8, 12, 4, '#d8d2c4', 0, { top: '#e8e2d4' }); } }); });
    });
  }
  // a train: four carriages one behind the other along its track (white with a coloured band, windows)
  function trainObjs(c, s0, s1, z, objs) {
    const n = 4, L = 3.2, col = c === R.me ? '#2f7cff' : '#e5484d', x = c.dir > 0 ? DRIVE.track : -DRIVE.track;
    for (let k = 0; k < n; k++) {
      const s = c.dir > 0 ? c.s - k * (L + 0.25) : c.s + k * (L + 0.25);
      if (s < s0 - 4 || s > s1 + 4) continue;
      const [wx, wy] = W2(s, x);
      objs.push({ d: wx + wy + 0.8, f: () => { const b = box(wx - 0.55, wy - L / 2, 1.1, L, 16, '#f4f6f8', 0, { top: '#e1e6ec' });
        [b.left, b.right].forEach(face => { wallRect(face, 0, 0.02, 0.98, 3, 5.5, col); for (let i = 0; i < 4; i++) wallRect(face, 0, 0.08 + i * 0.23, 0.24 + i * 0.23, 8, 13, NIGHT > 0.3 ? '#ffe39a' : '#3d4a5c'); }); } });
    }
  }
  // a green board on two posts: what it says depends on the kind
  function sign(E, wx, wy, z) {
    const a = iso(wx, wy), zh = curLang() === 'zh', nmOf = id => nm(COMMUNITIES[id]);
    const left = Math.max(0, Math.round((R.tiles - E.s) / DRIVE.tilesPerUnit * DRIVE.km));
    const txt = R.train && (E.kind === 'leave' || E.kind === 'welcome' || E.kind === 'via') ? t('tr_station', { c: nmOf(E.id) }) : E.kind === 'leave' ? t('dr_leave', { c: nmOf(E.id) }) : E.kind === 'welcome' ? t('dr_welcome', { c: nmOf(E.id) }) : E.kind === 'exit' ? t('dr_exit', { c: nmOf(E.id) })
      : E.kind === 'via' ? `${nmOf(E.id)} ↗` : `${nmOf(R.p.to)} ${left} km`;
    const blue = E.kind === 'leave' || E.kind === 'welcome';
    g.font = `900 ${Math.max(8, 10 * z)}px ${UI_FONT}`; const tw = g.measureText(txt).width + 12 * z, h = 18 * z, top = a.y - 46 * z;
    line(a.x - tw * 0.3, a.y, a.x - tw * 0.3, top + h, '#8e959c', 2 * z); line(a.x + tw * 0.3, a.y, a.x + tw * 0.3, top + h, '#8e959c', 2 * z);
    rrect(a.x - tw / 2, top, tw, h, 3 * z, blue ? '#2f5fa8' : '#1f7a46', '#ffffff', 1.2 * z);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, a.x, top + h / 2 + 0.5 * z);
  }
  // the little map: the whole DreamWorld map (drawn once), cut round where you are, your way in blue and you
  function drawMini() {
    if (!mini) return;
    const m = mini.getContext('2d'), w = mini.width, h = mini.height, dpr = mapCv.width / (DREAM_MAP.w * DM_S), p = at(R.me.s), sc = 0.9;
    m.clearRect(0, 0, w, h);
    const cx = p.x * DM_S * dpr, cy = p.y * DM_S * dpr;
    m.save(); m.beginPath(); m.roundRect(0, 0, w, h, 14); m.clip();
    m.drawImage(mapCv, cx - w / (2 * sc), cy - h / (2 * sc), w / sc, h / sc, 0, 0, w, h);
    const Q = ([x, y]) => [(x * DM_S * dpr - cx) * sc + w / 2, (y * DM_S * dpr - cy) * sc + h / 2];
    m.strokeStyle = '#2f7cff'; m.lineWidth = 4; m.lineCap = 'round'; m.beginPath(); R.pts.forEach((q, i) => { const [x, y] = Q([q.x, q.y]); i ? m.lineTo(x, y) : m.moveTo(x, y); }); m.stroke();
    m.fillStyle = '#ff4d4d'; m.strokeStyle = '#fff'; m.lineWidth = 2.5; m.beginPath(); m.arc(w / 2, h / 2, 7, 0, Math.PI * 2); m.fill(); m.stroke();
    m.restore();
  }
  function hudHtml() {
    const leftKm = Math.max(0, Math.round((R.tiles - R.me.s) / DRIVE.tilesPerUnit * DRIVE.km)), secs = Math.round((R.tiles - R.me.s) / Math.max(1, R.train ? DRIVE.trainSpeed : DRIVE.speed) / mult), p = at(R.me.s);
    return `<div class="rt-row"><b>${R.train ? '🚆 ' : ''}${nm(COMMUNITIES[R.p.from])} → ${nm(COMMUNITIES[R.p.to])}</b>${R.train ? '' : `<span>🛣️ ${p.bridge ? '🌉' : 'I-'}${p.no}</span>`}</div>
      <div class="rt-row small"><span>${t('dr_left', { n: leftKm })}</span><span>⏱️ ${fmtSec(secs)}</span>${p.tunnel ? `<span>🚇 ${t('dr_tunnel')}</span>` : p.water ? `<span>🌊 ${t('dr_bridge')}</span>` : `<span>${t('dmr_' + ((COMMUNITIES[nearest(p.x, p.y)] || {}).region || 'na'))}</span>`}</div>`;
  }
  const fmtSec = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

  // ---------- the screen ----------
  function build() {
    root = document.createElement('div'); root.className = 'rt';
    root.innerHTML = `<canvas class="rt-cv"></canvas><div class="rt-top"><div class="rt-hud"></div><canvas class="rt-mini" width="240" height="160"></canvas></div>
      <div class="rt-bar"><button class="rt-btn" data-rt="left">◀</button><div class="rt-speed">${DRIVE.fast.map(n => `<button class="rt-chip" data-rt="x${n}">×${n}</button>`).join('')}</div><button class="rt-btn" data-rt="right">▶</button></div>
      <div class="rt-card" hidden></div>`;
    document.querySelector('.screen').appendChild(root);
    cv = root.querySelector('.rt-cv'); g = cv.getContext('2d'); hud = root.querySelector('.rt-hud'); mini = root.querySelector('.rt-mini'); card = root.querySelector('.rt-card');
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-rt]'); if (!b || !R) return;
      const a = b.dataset.rt; Sound.play('tick');
      if (a === 'left' && R.me.ln > 0 && laneFree(R.me, R.me.ln - 1)) R.me.ln--;
      else if (a === 'right' && R.me.ln < 2 && laneFree(R.me, R.me.ln + 1)) R.me.ln++;
      else if (a[0] === 'x') { mult = +a.slice(1); chips(); }
      else if (a === 'in') finish();
    });
    new ResizeObserver(resize).observe(root);
  }
  const chips = () => root.querySelectorAll('.rt-chip').forEach(b => b.classList.toggle('on', b.dataset.rt === 'x' + mult));
  function resize() { const r = root.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts;
    if (!R) return;
    let left = dt * mult; while (left > 0) { const d = Math.min(0.05, left); left -= d; if (R.phase === 'go') { if (R.train) stepTrains(d); else stepTraffic(d); stepMe(d); } }
    draw(ts);
    if (Math.floor(ts / 250) !== R.hudAt) { R.hudAt = Math.floor(ts / 250); hud.innerHTML = hudHtml(); drawMini(); }
  }
  function arrive() {
    R.phase = 'end'; Sound.play('chime');
    card.hidden = false;
    card.innerHTML = `<div class="rt-card-in"><div class="big-emoji">${COMMUNITIES[R.p.to].flag}</div><h2>${t('dr_welcome', { c: nm(COMMUNITIES[R.p.to]) })}</h2><p class="muted">${t('dr_done', { km: R.p.km })}</p>
      <button class="btn primary block" data-rt="in">${R.train ? t('tr_off') : R.opts.place ? t('dr_in_place', { p: t('venue_' + R.opts.place) }) : R.p.to === myTown() ? t('dr_in_home') : t('dr_in')}</button></div>`;
  }
  function finish() {
    cancelAnimationFrame(raf); root.hidden = true; Scene.setVisible(true);
    const f = R.done, o = R.opts; R = null; if (f) f(o);
  }
  return {
    plan, onRail,
    // opts: { from, to, place } → false if there's no way
    open(opts, done) {
      const p = plan(opts.from, opts.to, opts.mode || 'car');
      if (!p) return false;
      if (!root) build();
      if (!mapCv) { mapCv = document.createElement('canvas'); drawDreamMap(mapCv); }
      const car = S.me.cars[S.me.car];
      const train = p.mode === 'train';
      R = { p, opts, done, train, pts: p.pts, len: p.len, tiles: p.tiles, phase: 'go', cars: [], hudAt: -1, from: p.from, seed: p.seed, me: { dir: 1, s: 0, ln: 1, lx: train ? DRIVE.track : laneX(1), v: (train ? DRIVE.trainSpeed : DRIVE.speed) * 0.3, car: car ? { ...car } : { k: 'sedan', color: '#e5484d' } } };
      root.classList.toggle('train', train);
      if (!train) for (let s = 10; s < 110; s += 9) if (Math.random() < 0.6) { const c = spawn(Math.random() < 0.5 ? 1 : -1, s); if (!(c.dir === 1 && c.ln === 1 && s < 16)) R.cars.push(c); }
      mult = 1; root.hidden = false; card.hidden = true; chips(); Scene.setVisible(false); resize();
      last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      return true;
    },
    // (testing) run the drive n steps of dt seconds without the screen
    _step(n, dt = 0.05) { for (let i = 0; i < n && R && R.phase === 'go'; i++) { stepTraffic(dt); stepMe(dt); } return R && { s: R.me.s, tiles: R.tiles, cars: R.cars.length, phase: R.phase }; },
    _draw() { if (R) draw(performance.now()); },
    _state: () => R,
  };
})();
