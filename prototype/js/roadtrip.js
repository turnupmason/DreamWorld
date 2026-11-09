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
    if (mode === 'air') return planAir(from, to);   // v0.63
    if (mode === 'sea') return planSea(from, to);
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
    if (R.above) {   // v0.63: the plane and the ship
      const u = R.me.s / DRIVE.tilesPerUnit, alt = altAt(R.me.s), first = u < R.len / 2, p = at(R.me.s), left = Math.max(0, Math.round((R.tiles - R.me.s) / DRIVE.tilesPerUnit * DRIVE.km)), secs = Math.round((R.tiles - R.me.s) / Math.max(1, R.mode === 'air' ? TRAVEL.airSpeed : TRAVEL.shipSpeed) / mult);
      const st = R.mode === 'air' ? (alt <= 0 ? (first ? `🛫 ${t('fl_roll')}` : `🛬 ${t('fl_taxi')}`) : alt > 0.98 ? `☁️ ${t('fl_cruise', { h: fmtNum(TRAVEL.cruiseM) })}` : `${first ? '🛫' : '🛬'} ${t(first ? 'fl_climb' : 'fl_down')} ${fmtNum(Math.round(alt * TRAVEL.cruiseM / 100) * 100)} m`) : R.car ? `🚗 ${t('sh_car_on')}` : `🌊 ${t('sh_at_sea')}`;
      return `<div class="rt-row"><b>${R.mode === 'air' ? '✈️' : '⛴️'} ${nm(COMMUNITIES[R.p.from])} → ${nm(COMMUNITIES[R.p.to])}</b></div>
        <div class="rt-row small"><span>${t('dr_left', { n: left })}</span><span>⏱️ ${fmtSec(secs)}</span><span>${st}</span><span>${t('dmr_' + ((COMMUNITIES[nearest(p.x, p.y)] || {}).region || 'na'))}</span></div>`;
    }
    const leftKm = Math.max(0, Math.round((R.tiles - R.me.s) / DRIVE.tilesPerUnit * DRIVE.km)), secs = Math.round((R.tiles - R.me.s) / Math.max(1, R.train ? DRIVE.trainSpeed : DRIVE.speed) / mult), p = at(R.me.s);
    return `<div class="rt-row"><b>${R.train ? '🚆 ' : ''}${nm(COMMUNITIES[R.p.from])} → ${nm(COMMUNITIES[R.p.to])}</b>${R.train ? '' : `<span>🛣️ ${p.bridge ? '🌉' : 'I-'}${p.no}</span>`}</div>
      <div class="rt-row small"><span>${t('dr_left', { n: leftKm })}</span><span>⏱️ ${fmtSec(secs)}</span>${p.tunnel ? `<span>🚇 ${t('dr_tunnel')}</span>` : p.water ? `<span>🌊 ${t('dr_bridge')}</span>` : `<span>${t('dmr_' + ((COMMUNITIES[nearest(p.x, p.y)] || {}).region || 'na'))}</span>`}</div>`;
  }
  const fmtSec = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;


  // ================= v0.63: flying and sailing, seen from above =================
  // The plane flies straight from airport to airport: a roll down the runway, the climb (the map falls away and the
  // clouds come in), cruising, the descent, landing. The ship sails the shortest way by sea between two docks (a grid
  // of the water, the shortest path on it, pulled straight wherever the water allows, the corners rounded), and now
  // and then a sea creature swims up beside it: tap it to take its photo for the passport. Both show the DreamWorld
  // map itself from above, a close-up piece of it drawn as you go (mapTile).
  const ptsWithU = pts => { let u = 0; pts.forEach((p, i) => { if (i) u += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); p.u = u; p.water = false; p.tunnel = false; }); return u; };
  function planAir(from, to) {
    if (from === to || !DREAM_AIR.includes(from) || !DREAM_AIR.includes(to)) return null;
    const [ax, ay] = DREAM_AIR_AT[from], [bx, by] = DREAM_AIR_AT[to], L = Math.hypot(bx - ax, by - ay), hx = (bx - ax) / L, hy = (by - ay) / L, r = TRAVEL.runway / 2;
    const A = [ax - hx * r, ay - hy * r], B = [bx + hx * r, by + hy * r], pts = [];
    for (let k = 0; k <= 60; k++) { const u = k / 60; pts.push({ x: A[0] + (B[0] - A[0]) * u, y: A[1] + (B[1] - A[1]) * u }); }
    const len = ptsWithU(pts), km = Math.round(len * DRIVE.km), tiles = len * DRIVE.tilesPerUnit;
    return { from, to, legs: [], pts, via: [], len, tiles, ev: [], km, cost: TRAVEL.airBase + Math.round(km * TRAVEL.airFare), bridges: 0, seed: from.length * 7 + to.length * 13, mode: 'air', mins: Math.max(1, Math.ceil(tiles / TRAVEL.airSpeed / 60)), rw: [[ax, ay], [bx, by]], hd: Math.atan2(hy, hx) };
  }
  // the sea: a grid of cells far enough from every coast (the coast as it's drawn: the smooth shapes)
  let SG = null;
  function seaGrid() {
    if (SG) return SG;
    const pc = document.createElement('canvas').getContext('2d'), land = new Path2D(); DREAM_LAND.forEach(P => dmShape(land, P));
    const C = TRAVEL.seaCell, nx = Math.ceil(DREAM_MAP.w / C), ny = Math.ceil(DREAM_MAP.h / C), m = TRAVEL.seaMargin, wet = new Uint8Array(nx * ny);
    const dry = (x, y) => x < 2 || y < 2 || x > DREAM_MAP.w - 2 || y > DREAM_MAP.h - 2 || pc.isPointInPath(land, x * DM_S, y * DM_S);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = (i + 0.5) * C, y = (j + 0.5) * C; wet[j * nx + i] = [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]].some(([dx, dy]) => dry(x + dx, y + dy)) ? 0 : 1; }
    SG = { C, nx, ny, wet, dry, cell: (x, y) => { const i = Math.floor(x / C), j = Math.floor(y / C); return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : j * nx + i; } };
    return SG;
  }
  const isSea = (x, y) => { const G = seaGrid(), c = G.cell(x, y); return c >= 0 && G.wet[c] === 1; };
  function seaWay(a, b) {
    const G = seaGrid(), { nx, ny, C, wet } = G, N = nx * ny;
    const near = ([x, y]) => { let best = -1, bd = 1e9; const ci = Math.floor(x / C), cj = Math.floor(y / C); for (let j = cj - 12; j <= cj + 12; j++) for (let i = ci - 12; i <= ci + 12; i++) { if (i < 0 || j < 0 || i >= nx || j >= ny || !wet[j * nx + i]) continue; const d = Math.hypot((i + 0.5) * C - x, (j + 0.5) * C - y); if (d < bd) { bd = d; best = j * nx + i; } } return best; };
    const s = near(a), e = near(b);
    if (s < 0 || e < 0) return null;
    const gs = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), shut = new Uint8Array(N), heap = [];
    const ex = e % nx, ey = Math.floor(e / nx), h = c => Math.hypot(c % nx - ex, Math.floor(c / nx) - ey);
    const push = (f, c) => { heap.push([f, c]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top[1]; };
    gs[s] = 0; push(h(s), s);
    while (heap.length) {
      const c = pop(); if (c === e) break; if (shut[c]) continue; shut[c] = 1;
      const ci = c % nx, cj = Math.floor(c / nx);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const n = j * nx + i; if (!wet[n] || shut[n] || (di && dj && (!wet[cj * nx + i] || !wet[j * nx + ci]))) continue;
        const ng = gs[c] + (di && dj ? Math.SQRT2 : 1); if (ng < gs[n]) { gs[n] = ng; prev[n] = c; push(ng + h(n), n); }
      }
    }
    if (s !== e && prev[e] < 0) return null;
    const P = []; for (let c = e; ; c = prev[c]) { P.unshift([(c % nx + 0.5) * C, (Math.floor(c / nx) + 0.5) * C]); if (c === s) break; }
    // pull the string: from each corner, straight on to the farthest cell you can see over open water
    const clear = (p, q) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.ceil(L / 2); for (let k = 1; k < n; k++) { const u = k / n; if (!isSea(p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u)) return false; } return true; };
    let out = [P[0]]; for (let i = 0; i < P.length - 1;) { let j = i + 1; while (j + 1 < P.length && clear(P[i], P[j + 1])) j++; out.push(P[j]); i = j; }
    out = [a, ...out, b];
    for (let it = 0; it < 2; it++) { const o = [out[0]]; for (let i = 0; i < out.length - 1; i++) { const p = out[i], q = out[i + 1]; if (i) o.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25]); if (i < out.length - 2) o.push([p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]); } o.push(out[out.length - 1]); out = o; }   // round the corners
    return out;
  }
  const seaCache = {};
  function planSea(from, to) {
    if (from === to || !DREAM_PORT.includes(from) || !DREAM_PORT.includes(to)) return null;
    const key = from + '>' + to;
    if (!(key in seaCache)) seaCache[key] = seaWay(DREAM_PORT_AT[from], DREAM_PORT_AT[to]);
    const way = seaCache[key]; if (!way) return null;
    const pts = way.map(([x, y]) => ({ x, y })), len = ptsWithU(pts), km = Math.round(len * DRIVE.km), tiles = len * DRIVE.tilesPerUnit;
    pts.forEach(p => { p.water = true; });
    return { from, to, legs: [], pts, via: [], len, tiles, ev: [], km, cost: TRAVEL.shipBase + Math.round(km * TRAVEL.shipFare), bridges: 0, seed: from.length * 7 + to.length * 13, mode: 'sea', mins: Math.max(1, Math.ceil(tiles / TRAVEL.shipSpeed / 60)) };
  }
  // how high the plane is (0 on the ground … 1 cruising)
  const smooth = x => x * x * (3 - 2 * x);
  function altAt(s) { if (!R || R.mode !== 'air') return 0; const u = s / DRIVE.tilesPerUnit, up = (u - TRAVEL.runway * 0.8) / TRAVEL.climb, dn = (R.len - TRAVEL.runway * 0.65 - u) / TRAVEL.desc; return smooth(Math.max(0, Math.min(1, up, dn))); }
  // the sea creatures on this trip: where along the way, which kind (by the region there; whales far out)
  function planSights() {
    const n = Math.min(TRAVEL.sightMax, Math.floor(R.len / TRAVEL.sightEvery)), out = [];
    for (let k = 0; k < n; k++) {
      const s = R.tiles * (0.12 + 0.8 * (k + 0.2 + Math.random() * 0.6) / Math.max(1, n)), p = at(s), id = nearest(p.x, p.y), far = Math.hypot(DREAM_AT[id][0] - p.x, DREAM_AT[id][1] - p.y) > 95, reg = (COMMUNITIES[id] || {}).region;
      const ok = SEA_LIFE.filter(L => L.where === 'any' || (L.where === 'deep' ? far : L.where.includes(reg))), rare = ok.filter(L => L.where !== 'any'), pick = rare.length && Math.random() < 0.6 ? rare : ok;   // the local ones more often
      out.push({ s, k: pick[Math.floor(Math.random() * pick.length)].k });
    }
    return out;
  }
  function stepAbove(dt) {
    const me = R.me, u = me.s / DRIVE.tilesPerUnit, L = R.len, air = R.mode === 'air', cruise = air ? TRAVEL.airSpeed : TRAVEL.shipSpeed;
    let v = cruise;
    if (air) { const rw = TRAVEL.runway; if (u > L - rw * 0.65) v = cruise * Math.max(0.05, (L - u) / (rw * 0.65)) * 0.45; else if (altAt(me.s) <= 0) v = cruise * (0.12 + 0.55 * Math.min(1, u / rw)); }
    else { if (u < 12) v = cruise * (0.3 + 0.7 * u / 12); if (L - u < 15) v = cruise * Math.max(0.08, (L - u) / 15); }
    me.v += (v - me.v) * Math.min(1, dt * 1.5);
    me.s = Math.min(R.tiles, me.s + Math.max(0.8, me.v) * dt);
    if (!air) {
      const p = at(me.s), w = R.wake[R.wake.length - 1];
      if (!w || Math.hypot(w.x - p.x, w.y - p.y) > 1.2) { R.wake.push({ x: p.x, y: p.y }); if (R.wake.length > 46) R.wake.shift(); }
      const e = R.sights.find(x => !x.on && me.s >= x.s);
      if (e && !R.sight) { e.on = true; const q = at(Math.min(R.tiles, me.s + 4)), hx = q.x - p.x, hy = q.y - p.y, L = Math.hypot(hx, hy) || 1, off = 52 / TRAVEL.zSea / DM_S, wet = sd => isSea(p.x - hy / L * off * sd, p.y + hx / L * off * sd);
        R.sight = { k: e.k, age: 0, side: wet(1) ? (wet(-1) && Math.random() < 0.5 ? -1 : 1) : -1, shot: false }; }   // on the open water's side
    }
    if (me.s >= R.tiles - 0.01 && R.phase === 'go') arrive();
  }
  // a piece of the map round (cx, cy) (map drawn at DM_S) at this zoom, redrawn when you leave it or zoom a lot
  let tile = null;
  function mapTile(cx, cy, zoom) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), k = zoom * dpr, hw = W / zoom / 2, hh = H / zoom / 2, dark = document.body.classList.contains('dark');
    if (tile && tile.k / k > 0.75 && tile.k / k < 1.6 && cx - hw > tile.x0 && cx + hw < tile.x1 && cy - hh > tile.y0 && cy + hh < tile.y1 && tile.dark === dark) return tile;
    const mw = hw * 3, mh = hh * 2.6, x0 = cx - mw / 2, y0 = cy - mh / 2, cvT = (tile && tile.cv) || document.createElement('canvas');
    cvT.width = Math.ceil(mw * k); cvT.height = Math.ceil(mh * k);
    const tg = cvT.getContext('2d'); tg.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    const sea = tg.createLinearGradient(0, 0, 0, DREAM_MAP.h * DM_S); sea.addColorStop(0, dark ? '#1e3a56' : '#b9e2f6'); sea.addColorStop(1, dark ? '#142a40' : '#8ccbea');   // (the same sea past the map's edges)
    tg.fillStyle = sea; tg.fillRect(x0, y0, mw, mh);
    drawDreamMapTo(tg, true);
    drawTownPlans(tg, 1, (x, y, m) => x > x0 - m && x < x0 + mw + m && y > y0 - m && y < y0 + mh + m);   // v0.65: the towns' streets below you
    tile = { cv: cvT, x0, y0, x1: x0 + mw, y1: y0 + mh, k, dark };
    return tile;
  }
  const angTo = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  function drawAbove(ts) {
    const me = R.me, air = R.mode === 'air', p = at(me.s), q = at(Math.min(R.tiles, me.s + 6)), p0 = at(Math.max(0, me.s - 6));
    const hd = Math.atan2(q.y - p0.y, q.x - p0.x); R.hd = R.hd === undefined ? hd : R.hd + angTo(hd, R.hd) * 0.12;
    const alt = altAt(me.s), zoom = air ? TRAVEL.zLow + (TRAVEL.zHigh - TRAVEL.zLow) * alt : TRAVEL.zSea;
    const px = p.x * DM_S, py = p.y * DM_S, lead = Math.min(W, H) * (air ? 0.14 : 0.1) / zoom, cx = px + Math.cos(R.hd) * lead, cy = py + Math.sin(R.hd) * lead;
    const SX = x => W / 2 + (x - cx) * zoom, SY = y => H / 2 + (y - cy) * zoom, dark = document.body.classList.contains('dark');
    const T = mapTile(cx, cy, zoom);
    g.fillStyle = dark ? '#1a3550' : '#a3d6ef'; g.fillRect(0, 0, W, H);
    g.drawImage(T.cv, SX(T.x0), SY(T.y0), (T.x1 - T.x0) * zoom, (T.y1 - T.y0) * zoom);
    const sx = SX(px), sy = SY(py);
    if (air) {
      R.p.rw.forEach(([ax, ay]) => runway(SX(ax * DM_S), SY(ay * DM_S), R.p.hd, zoom));
      placeLabels(SX, SY, zoom, alt);
      clouds(cx, cy, zoom, alt, ts, 1.25, 0.5, true);   // their shadows on the ground
      clouds(cx, cy, zoom, alt, ts, 1.25, 0.5);
      const sh = 1 - alt * 0.3; plane(sx + alt * 34, sy + alt * 50, R.hd, 0.95 * sh, `rgba(20,30,40,${(0.3 - alt * 0.18).toFixed(3)})`);
      plane(sx, sy, R.hd, 1 + (1 - alt) * 0.08, null);
      clouds(cx, cy, zoom, alt, ts, 1.6, 0.35);   // a few higher up, over the plane
      const fog = Math.max(0, 1 - Math.abs(alt - 0.5) / 0.14); if (fog > 0) { g.fillStyle = `rgba(255,255,255,${(fog * 0.45).toFixed(3)})`; g.fillRect(0, 0, W, H); }   // through the clouds
    } else {
      waves(cx, cy, zoom, ts);
      DREAM_PORT.forEach(id => { const [x, y] = DREAM_PORT_AT[id]; harbour(SX(x * DM_S), SY(y * DM_S), id, zoom); });
      placeLabels(SX, SY, zoom, 0);
      R.wake.forEach((w, i) => { const a = i / R.wake.length, wx = SX(w.x * DM_S), wy = SY(w.y * DM_S); g.fillStyle = `rgba(255,255,255,${(a * 0.55).toFixed(3)})`; g.beginPath(); g.arc(wx, wy, (1 - a) * 9 + 3, 0, Math.PI * 2); g.fill(); });
      ship(sx, sy, R.hd + Math.sin(ts / 900) * 0.025, ts);
    }
    if (NIGHT > 0.05) {
      g.fillStyle = `rgba(16,22,60,${(NIGHT * 0.42).toFixed(3)})`; g.fillRect(0, 0, W, H);
      Object.keys(DREAM_AT).forEach(id => { const x = SX(DREAM_AT[id][0] * DM_S), y = SY(DREAM_AT[id][1] * DM_S); if (x < -60 || y < -60 || x > W + 60 || y > H + 60) return; const r = 26 * Math.max(0.6, zoom / 2), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,220,140,${(NIGHT * 0.7).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    }
    if (R.sight && !air) sightDraw(sx, sy, ts);   // (over the night: you can always see what to tap)
  }
  // the places' names on the ground (as you pass over them)
  function placeLabels(SX, SY, zoom, alt) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    Object.keys(DREAM_AT).forEach(id => { if (!COMMUNITIES[id]) return; const x = SX(DREAM_AT[id][0] * DM_S), y = SY(DREAM_AT[id][1] * DM_S); if (x < -80 || y < -40 || x > W + 80 || y > H + 40) return;
      const c = COMMUNITIES[id], txt = `${c.flag} ${nm(c)}`; g.font = `800 ${12 + Math.min(3, zoom)}px ${UI_FONT}`; const tw = g.measureText(txt).width + 14;
      g.fillStyle = `rgba(255,253,248,${(0.92 - alt * 0.25).toFixed(2)})`; g.beginPath(); g.roundRect(x - tw / 2, y - 11, tw, 22, 11); g.fill();
      g.fillStyle = '#3b3125'; g.fillText(txt, x, y + 0.5); });
  }
  function runway(x, y, hd, zoom) {
    const L = TRAVEL.runway * DM_S * zoom * 1.05, w = Math.max(10, 6 * zoom);
    g.save(); g.translate(x, y); g.rotate(hd);
    g.fillStyle = '#8f949a'; g.fillRect(-L / 2 - 6, -w / 2 - 6, L + 12, w + 12);
    g.fillStyle = '#4b4f55'; g.fillRect(-L / 2, -w / 2, L, w);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = Math.max(1.2, w * 0.06); g.setLineDash([w * 0.5, w * 0.4]); g.beginPath(); g.moveTo(-L / 2 + w, 0); g.lineTo(L / 2 - w, 0); g.stroke(); g.setLineDash([]);
    for (const e of [-1, 1]) for (let k = -2; k <= 2; k++) { g.fillStyle = '#fff'; g.fillRect(e * (L / 2 - w * 0.7) - w * 0.15, k * w * 0.16 - w * 0.05, w * 0.3, w * 0.1); }
    g.fillStyle = '#d8dde3'; g.fillRect(-L * 0.25, w * 1.1, L * 0.5, w * 0.9); g.fillStyle = '#9fc6e0'; g.fillRect(-L * 0.23, w * 1.15, L * 0.46, w * 0.25);   // the terminal
    g.restore();
  }
  // the plane from above, nose along hd (col: a shadow's colour, or null for the plane itself)
  function plane(x, y, hd, sc, col) {
    g.save(); g.translate(x, y); g.rotate(hd); g.scale(sc, sc);
    const P = (pts, f) => { g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); g.fillStyle = col || f; g.fill(); if (!col) { g.strokeStyle = '#9aa3ad'; g.lineWidth = 0.8; g.stroke(); } };
    [-1, 1].forEach(s => { P([[6, s * 3], [-6, s * 28], [-13, s * 28], [-7, s * 3]], '#e3e8ee'); P([[-21, s * 2], [-27, s * 11], [-31, s * 11], [-28, s * 2]], '#e3e8ee'); });
    if (!col) [-1, 1].forEach(s => { g.fillStyle = '#8e959c'; g.beginPath(); g.ellipse(-1, s * 12, 4.5, 2, 0, 0, Math.PI * 2); g.fill(); });
    g.beginPath(); g.ellipse(0, 0, 30, 4.6, 0, 0, Math.PI * 2); g.fillStyle = col || '#ffffff'; g.fill();
    if (!col) { g.strokeStyle = '#9aa3ad'; g.lineWidth = 0.8; g.stroke(); g.fillStyle = '#2f7cff'; g.fillRect(-31, -1, 9, 2); g.fillStyle = '#3d4a5c'; g.beginPath(); g.ellipse(24, 0, 3.2, 2.6, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  // v0.65 (Mason #32: "why are the clouds round? make real clouds"): cumulus seen from above, drawn once as pictures:
  // a long, uneven heap of puffs (big in the middle, small cauliflower bumps round the edge), soft edges, the
  // sunny side bright, the side away from the sun grey-blue; and each one's own dark shape for its shadow on the ground
  let CLOUD_PICS = null;
  // a soft blur that works everywhere: down to a third and back up (the puffs melt into one heap)
  function soften(c) { const s = document.createElement('canvas'); s.width = c.width / 3; s.height = c.height / 3; const sq = s.getContext('2d'); sq.imageSmoothingQuality = 'high'; sq.drawImage(c, 0, 0, s.width, s.height);
    const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const oq = o.getContext('2d'); oq.imageSmoothingQuality = 'high'; oq.globalAlpha = 0.55; oq.drawImage(c, 0, 0); oq.globalAlpha = 0.75; oq.drawImage(s, 0, 0, c.width, c.height); return o; }
  function cloudPics() {
    if (CLOUD_PICS) return CLOUD_PICS;
    CLOUD_PICS = [];
    for (let v = 0; v < 6; v++) {
      const w = 300, h = 200, puffs = [], n = 26 + v * 4, stretch = 0.75 + rnd(v, 1, 9) * 0.6;
      for (let k = 0; k < n; k++) {   // a heap: puffs scattered round a wobbly long shape, smaller towards the edge
        const a = rnd(v, k, 1) * Math.PI * 2, r = Math.pow(rnd(v, k, 2), 0.7), wob = 1 + 0.25 * Math.sin(a * 3 + v);
        puffs.push([w / 2 + Math.cos(a) * r * w * 0.3 * stretch * wob, h / 2 + Math.sin(a) * r * h * 0.24 * wob, (1 - r * 0.62) * (18 + rnd(v, k, 3) * 20)]);
      }
      const pic = (shade) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const q = c.getContext('2d');
        if (shade) { puffs.forEach(([x, y, r]) => { const gr = q.createRadialGradient(x, y, 0, x, y, r * 1.15); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.7, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = gr; q.beginPath(); q.arc(x, y, r * 1.15, 0, Math.PI * 2); q.fill(); }); return soften(c); }
        puffs.forEach(([x, y, r]) => { const gr = q.createRadialGradient(x + r * 0.2, y + r * 0.3, 0, x + r * 0.2, y + r * 0.3, r * 1.2); gr.addColorStop(0, 'rgba(158,175,200,.8)'); gr.addColorStop(0.75, 'rgba(172,188,210,.55)'); gr.addColorStop(1, 'rgba(165,182,206,0)'); q.fillStyle = gr; q.beginPath(); q.arc(x + r * 0.2, y + r * 0.3, r * 1.2, 0, Math.PI * 2); q.fill(); });   // the shaded side
        puffs.slice().sort((a, b) => a[1] - b[1]).forEach(([x, y, r]) => { const gr = q.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(250,252,255,.97)'); gr.addColorStop(0.85, 'rgba(232,238,247,.75)'); gr.addColorStop(1, 'rgba(232,238,247,0)'); q.fillStyle = gr; q.beginPath(); q.arc(x, y, r, 0, Math.PI * 2); q.fill(); });   // the sunny tops
        return soften(c); };
      CLOUD_PICS.push({ c: pic(false), sh: pic(true), w, h });
    }
    return CLOUD_PICS;
  }
  // clouds in their own layer (f: how much faster than the ground they slide past: nearer the camera); shadow: draw
  // their shadows on the ground instead
  function clouds(cx, cy, zoom, alt, ts, f, dens, shadow) {
    if (alt < 0.15) return;
    const P = cloudPics(), z = zoom * f, C = 90, x0 = cx * f - W / 2 / z, y0 = cy * f - H / 2 / z, a = Math.min(1, (alt - 0.15) / 0.5) * (shadow ? 0.16 : f > 1.4 ? 0.7 : 0.95);
    for (let j = Math.floor(y0 / C) - 2; j <= Math.ceil((y0 + H / z) / C) + 2; j++) for (let i = Math.floor(x0 / C) - 2; i <= Math.ceil((x0 + W / z) / C) + 2; i++) {
      if (rnd(i, j, f * 10) > dens * 0.55) continue;
      const pic = P[Math.floor(rnd(i, j, 6) * P.length)], sc = (0.35 + rnd(i, j, 4) * 0.45) * z, wx = (i + rnd(i, j, 2)) * C + ts / 900, wy = (j + rnd(i, j, 3)) * C;
      const X = W / 2 + (wx - cx * f) * z + (shadow ? 26 : 0), Y = H / 2 + (wy - cy * f) * z + (shadow ? 40 : 0), rot = (rnd(i, j, 5) - 0.5) * 1.2;
      g.save(); g.globalAlpha = a; g.translate(X, Y); g.rotate(rot); g.scale(sc, sc); g.drawImage(shadow ? pic.sh : pic.c, -pic.w / 2, -pic.h / 2); g.restore();
    }
  }
  // little white waves on the water (they bob)
  function waves(cx, cy, zoom, ts) {
    const C = 24, x0 = cx - W / 2 / zoom, y0 = cy - H / 2 / zoom;
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (let j = Math.floor(y0 / C); j <= Math.ceil((y0 + H / zoom) / C); j++) for (let i = Math.floor(x0 / C); i <= Math.ceil((x0 + W / zoom) / C); i++) {
      if (rnd(i, j, 7) > 0.45) continue;
      const wx = (i + rnd(i, j, 8)) * C, wy = (j + rnd(i, j, 9)) * C, mx = wx / DM_S, my = wy / DM_S; if (!isSea(mx, my) && mx > 0 && my > 0 && mx < DREAM_MAP.w && my < DREAM_MAP.h) continue;
      const X = W / 2 + (wx - cx) * zoom, Y = H / 2 + (wy - cy) * zoom + Math.sin(ts / 600 + i * 1.7 + j) * 2;
      g.beginPath(); g.arc(X, Y, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  }
  // a port: a pier out from the shore towards its place, a lighthouse
  function harbour(x, y, id, zoom) {
    if (x < -80 || y < -80 || x > W + 80 || y > H + 80) return;
    const [ax, ay] = DREAM_AT[id], [dx, dy] = DREAM_PORT_AT[id], a = Math.atan2(ay - dy, ax - dx);
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = '#b08a5e'; g.fillRect(-4 * zoom, -3 * zoom, 16 * zoom, 6 * zoom); g.strokeStyle = '#7a5a3a'; g.lineWidth = 1; g.strokeRect(-4 * zoom, -3 * zoom, 16 * zoom, 6 * zoom);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-7 * zoom, -7 * zoom, 3.2 * zoom, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e5484d'; g.beginPath(); g.arc(-7 * zoom, -7 * zoom, 1.8 * zoom, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // the ferry from above, bow along hd: white hull, blue band, the bridge and a red funnel; your car on deck
  function ship(x, y, hd, ts) {
    g.save(); g.translate(x, y); g.rotate(hd);
    const hull = [[32, 0], [21, -10], [-26, -10], [-31, -7], [-31, 7], [-26, 10], [21, 10]];
    g.beginPath(); hull.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); g.fillStyle = 'rgba(20,40,60,.25)'; g.save(); g.translate(2, 3); g.fill(); g.restore();
    g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#2f5fa8'; g.lineWidth = 2.2; g.stroke();
    g.fillStyle = '#d9cbb0'; g.beginPath(); g.moveTo(26, 0); g.lineTo(18, -7); g.lineTo(-4, -7); g.lineTo(-4, 7); g.lineTo(18, 7); g.closePath(); g.fill();   // the car deck
    if (R.car) { g.fillStyle = R.me.car.color || '#e5484d'; g.beginPath(); g.roundRect(2, -4, 13, 8, 2); g.fill(); g.fillStyle = 'rgba(40,60,80,.75)'; g.fillRect(10, -3, 2.5, 6); }
    g.fillStyle = '#f4f6f8'; g.beginPath(); g.roundRect(-25, -7, 19, 14, 3); g.fill(); g.strokeStyle = '#9aa3ad'; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = '#3d4a5c'; for (let k = 0; k < 4; k++) { g.fillRect(-23 + k * 4.3, -6, 2.4, 1.6); g.fillRect(-23 + k * 4.3, 4.4, 2.4, 1.6); }
    g.fillStyle = '#e5484d'; g.beginPath(); g.arc(-15, 0, 3.6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2b2b30'; g.beginPath(); g.arc(-15, 0, 1.8, 0, Math.PI * 2); g.fill();
    g.restore();
    const puff = (ts / 1400) % 1; g.fillStyle = `rgba(240,240,240,${(0.5 * (1 - puff)).toFixed(3)})`; g.beginPath(); g.arc(x - Math.cos(hd) * (15 + puff * 22), y - Math.sin(hd) * (15 + puff * 22) - puff * 6, 3 + puff * 6, 0, Math.PI * 2); g.fill();   // smoke
  }
  // a creature swimming along beside the ship: jumping ones leap, a whale blows; tap it for a photo
  function sightDraw(x, y, ts) {
    const S2 = R.sight, L = SEA_LIFE.find(l => l.k === S2.k), life = TRAVEL.sightLife, out = S2.shot ? Math.max(0, 1 - (S2.age - S2.shotAt) / 1.2) : Math.min(1, S2.age / 0.6, (life - S2.age) / 0.8);
    if (out <= 0) return;
    const hd = R.hd, fx = Math.cos(hd), fy = Math.sin(hd), ox = x + fx * 16 - fy * 52 * S2.side, oy = y + fy * 16 + fx * 52 * S2.side;
    const jump = L.jump ? Math.max(0, Math.sin(S2.age * 3.2)) : 0, bob = Math.sin(S2.age * 2) * 2;
    g.strokeStyle = `rgba(255,255,255,${(0.7 * out).toFixed(3)})`; g.lineWidth = 1.5; [0, 0.5].forEach(k => { const r = 8 + ((S2.age * 0.9 + k) % 1) * 20; g.beginPath(); g.ellipse(ox, oy + 6, r, r * 0.4, 0, 0, Math.PI * 2); g.stroke(); });   // ripples
    if (S2.k === 'whale') { for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.3, r = 10 + ((S2.age * 1.5) % 1) * 16; g.fillStyle = `rgba(255,255,255,${(0.8 * out).toFixed(3)})`; g.beginPath(); g.arc(ox + Math.cos(a) * r * 0.6, oy - 14 + Math.sin(a) * r, 2, 0, Math.PI * 2); g.fill(); } }
    g.save(); g.globalAlpha = out; g.fillStyle = '#000'; g.font = `${S2.k === 'whale' ? 40 : 30}px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L.e, ox, oy - jump * 22 + bob); g.restore();
    S2.sx = ox; S2.sy = oy - jump * 22;
    if (!S2.shot) { const txt = t('sh_tap'); g.font = `800 12px ${UI_FONT}`; const tw = g.measureText(txt).width + 14; g.globalAlpha = out; g.fillStyle = 'rgba(255,253,248,.95)'; g.beginPath(); g.roundRect(ox - tw / 2, oy - 52, tw, 22, 11); g.fill(); g.fillStyle = '#3b3125'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, ox, oy - 41); g.globalAlpha = 1; }
    else if (S2.age - S2.shotAt < 0.25) { g.fillStyle = `rgba(255,255,255,${(0.8 - (S2.age - S2.shotAt) * 3).toFixed(3)})`; g.fillRect(0, 0, W, H); }   // the camera's flash
  }
  // the photo: into the passport's sea life (a new kind gets a cheer)
  function shoot() {
    const S2 = R.sight; if (!S2 || S2.shot) return;
    S2.shot = true; S2.shotAt = S2.age;
    const P = passport(), first = !P.sea[S2.k], L = SEA_LIFE.find(l => l.k === S2.k);
    P.sea[S2.k] = (P.sea[S2.k] || 0) + 1; R.seen.push(S2.k); save();
    Sound.play(first ? 'levelup' : 'chime'); toast(`📸 ${t(first ? 'sea_new' : 'sea_again', { e: L.e, name: nm(L) })}`);
  }
  function toast(txt) { const el = root.querySelector('.rt-toast'); el.textContent = txt; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200); }

  // ---------- the screen ----------
  function build() {
    root = document.createElement('div'); root.className = 'rt';
    root.innerHTML = `<canvas class="rt-cv"></canvas><div class="rt-top"><div class="rt-hud"></div><canvas class="rt-mini" width="240" height="160"></canvas></div>
      <div class="rt-bar"><button class="rt-btn" data-rt="left">◀</button><div class="rt-speed">${DRIVE.fast.map(n => `<button class="rt-chip" data-rt="x${n}">×${n}</button>`).join('')}</div><button class="rt-btn" data-rt="right">▶</button></div>
      <div class="rt-toast" hidden></div><div class="rt-card" hidden></div>`;
    document.querySelector('.screen').appendChild(root);
    cv = root.querySelector('.rt-cv'); g = cv.getContext('2d'); hud = root.querySelector('.rt-hud'); mini = root.querySelector('.rt-mini'); card = root.querySelector('.rt-card');
    root.addEventListener('click', e => {
      if (R && R.sight && !R.sight.shot && e.target === cv) { const r = cv.getBoundingClientRect(); if (Math.hypot(e.clientX - r.left - R.sight.sx, e.clientY - r.top - R.sight.sy) < 56) shoot(); }   // v0.63: a photo
      const b = e.target.closest('[data-rt]'); if (!b || !R) return;
      const a = b.dataset.rt; Sound.play('tick');
      if (a === 'left' && R.me.ln > 0 && laneFree(R.me, R.me.ln - 1)) R.me.ln--;
      else if (a === 'right' && R.me.ln < 2 && laneFree(R.me, R.me.ln + 1)) R.me.ln++;
      else if (a[0] === 'x') { mult = +a.slice(1); chips(); }
      else if (a === 'in') finish();
    });
    new ResizeObserver(resize).observe(root);
  }
  const fastOf = () => (R && R.mode === 'air' ? TRAVEL.fastAir : R && R.mode === 'sea' ? TRAVEL.fastSea : DRIVE.fast);
  const chips = () => root.querySelectorAll('.rt-chip').forEach(b => b.classList.toggle('on', b.dataset.rt === 'x' + mult));
  function resize() { const r = root.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function loop(ts) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (ts - last) / 1000)); last = ts;
    if (!R) return;
    let left = dt * mult; while (left > 0 && R) { const d = Math.min(0.05, left); left -= d; if (R.phase === 'go') { if (R.above) stepAbove(d); else { if (R.train) stepTrains(d); else stepTraffic(d); stepMe(d); } } }
    if (!R) return;
    if (R.sight) { R.sight.age += dt; if (R.sight.age > TRAVEL.sightLife || (R.sight.shot && R.sight.age - R.sight.shotAt > 1.3)) R.sight = null; }   // (real seconds: you can take its photo at any speed)
    if (R.above) drawAbove(ts); else draw(ts);
    if (Math.floor(ts / 250) !== R.hudAt) { R.hudAt = Math.floor(ts / 250); hud.innerHTML = hudHtml(); drawMini(); }
  }
  function arrive() {
    R.phase = 'end'; Sound.play('chime');
    card.hidden = false;
    const seen = R.seen && R.seen.length ? `<p>${t('sh_seen', { list: R.seen.map(k => SEA_LIFE.find(l => l.k === k).e).join(' ') })}</p>` : '';
    card.innerHTML = `<div class="rt-card-in"><div class="big-emoji">${COMMUNITIES[R.p.to].flag}</div><h2>${R.mode === 'air' ? t('fl_landed', { c: nm(COMMUNITIES[R.p.to]) }) : R.mode === 'sea' ? t('sh_arrived', { c: nm(COMMUNITIES[R.p.to]) }) : t('dr_welcome', { c: nm(COMMUNITIES[R.p.to]) })}</h2><p class="muted">${R.mode === 'air' ? t('fl_done', { km: R.p.km }) : R.mode === 'sea' ? t(R.car ? 'sh_done_car' : 'sh_done', { km: R.p.km }) : t('dr_done', { km: R.p.km })}</p>${seen}
      <button class="btn primary block" data-rt="in">${R.mode === 'air' ? t('fl_off') : R.mode === 'sea' ? t('sh_off') : R.train ? t('tr_off') : R.opts.place ? t('dr_in_place', { p: t('venue_' + R.opts.place) }) : R.p.to === myTown() ? t('dr_in_home') : t('dr_in')}</button></div>`;
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
      const train = p.mode === 'train', above = p.mode === 'air' || p.mode === 'sea';
      R = { p, opts, done, train, above, mode: p.mode, car: !!opts.car, wake: [], sights: [], sight: null, seen: [], pts: p.pts, len: p.len, tiles: p.tiles, phase: 'go', cars: [], hudAt: -1, from: p.from, seed: p.seed, me: { dir: 1, s: 0, ln: 1, lx: train ? DRIVE.track : laneX(1), v: above ? 0 : (train ? DRIVE.trainSpeed : DRIVE.speed) * 0.3, car: car ? { ...car } : { k: 'sedan', color: '#e5484d' } } };
      if (p.mode === 'sea') R.sights = planSights();
      root.classList.toggle('train', train || above); root.classList.toggle('above', above);
      root.querySelector('.rt-speed').innerHTML = fastOf().map(n => `<button class="rt-chip" data-rt="x${n}">×${n}</button>`).join('');
      if (!train && !above) for (let s = 10; s < 110; s += 9) if (Math.random() < 0.6) { const c = spawn(Math.random() < 0.5 ? 1 : -1, s); if (!(c.dir === 1 && c.ln === 1 && s < 16)) R.cars.push(c); }
      mult = 1; root.hidden = false; card.hidden = true; chips(); Scene.setVisible(false); resize();
      last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      return true;
    },
    // (testing) run the drive n steps of dt seconds without the screen
    _step(n, dt = 0.05) { for (let i = 0; i < n && R && R.phase === 'go'; i++) { if (R.above) stepAbove(dt); else { stepTraffic(dt); stepMe(dt); } } return R && { s: R.me.s, tiles: R.tiles, cars: R.cars.length, phase: R.phase, alt: altAt(R.me.s) }; },
    _shoot: () => shoot(), isSea: (x, y) => isSea(x, y), seaGrid: () => seaGrid(),
    _draw() { if (R) { if (R.above) drawAbove(performance.now()); else draw(performance.now()); } },
    _state: () => R,
  };
})();
