'use strict';
// v0.33: ball games you really play, on the park's courts, with a friend (or one of the people already playing there).
// Each game draws its own court in a 2.5D view from behind you, with the same cartoon townies, on a canvas over the
// town. One thumb is enough:
//   tennis      you run to the ball by yourself; when the ring round your feet closes, swipe up to hit it back
//               (left / right to aim, a longer swipe goes deeper). First to 5 points.
//   basketball  swipe up to shoot: straight to be on line, how far you swipe is how hard. Take turns from 5 places.
//   football    penalties: swipe at the goal to shoot (sideways for where, longer for higher); in goal, tap where to dive.
//   bowling     (v0.38, the bowling alley) swipe up the lane: where you start is where the ball leaves your hand, a
//               slanted swipe sends it slanting, a longer one is faster. Frames of two balls; strikes and spares score extra.
//   race        (v0.38, the swimming centre) tap left, right, left… to swim a length; dive in on the whistle.
//   derby       (v0.42, the stadium) tap to swing as the pitch reaches the ring over home plate; most home runs wins.
// Games.open(kind, partner, onEnd, onClose): partner = { id, name, look, skill }. onEnd(result) runs when a game is
// over and returns the html for what it gave; onClose() when you go back to the park.
const Games = (() => {
  const SC = 1.25;                  // townies are a bit bigger than life (cartoon), so you can see who's who
  const PS = 1.6 / 38 * SC;         // metres per sprite unit (a townie is about 38 units tall)
  const rnd = (a, b) => a + Math.random() * (b - a);
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  let root = null, cv = null, g = null, top = null, card = null, W = 0, H = 0, raf = 0, lastTs = 0, T = 0;
  let G = null, kind = '', mate = null, onEnd = null, onClose = null, phase = 'off', ptr = null, banner = null, pops = [], ro = null, hudKey = '', held = false;

  // ---------- the camera: a simple perspective view, looking along +y (away from you), x to the right, z up ----------
  const V = { F: 500, D: 10, h: 10, hor: 0, cx: 0 };
  const NEAR = 0.6;
  function P(x, y, z = 0) { const k = V.F / Math.max(NEAR, y + V.D); return { x: V.cx + x * k, y: V.hor + (V.h - z) * k, k }; }
  // fit: depth y0 shows at row r0 (fraction of the height) and is hw metres either side of the middle; depth y1 at row r1
  function fit(y0, r0, hw, y1, r1, D) {
    V.D = D; V.cx = W / 2;
    const k0 = (W / 2) / hw; V.F = k0 * (y0 + D);
    const k1 = V.F / (y1 + D);
    V.h = (r0 - r1) * H / (k0 - k1); V.hor = r0 * H - V.h * k0;
  }
  // back from the screen to the ground (or to an upright plane at depth y)
  function onPlane(sx, sy, y) { const k = V.F / Math.max(NEAR, y + V.D); return { x: (sx - V.cx) / k, z: V.h - (sy - V.hor) / k }; }

  // ground shapes, cut where they come too close to the camera
  function clipNear(pts) {
    const lim = -V.D + NEAR + 0.05, out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ina = a[1] >= lim, inb = b[1] >= lim;
      if (ina) out.push(a);
      if (ina !== inb) { const u = (lim - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * u, lim, (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * u]); }
    }
    return out;
  }
  function gpoly(pts, fill, stroke, lw) { const q = clipNear(pts); if (q.length > 2) poly(q.map(p => P(p[0], p[1], p[2] || 0)), fill, stroke, lw); }
  const grect = (x0, y0, x1, y1, fill) => gpoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], fill);
  function gline(a, b, w, col) {
    const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy) || 1, ox = -dy / n * w / 2, oy = dx / n * w / 2;
    gpoly([[a[0] + ox, a[1] + oy], [b[0] + ox, b[1] + oy], [b[0] - ox, b[1] - oy], [a[0] - ox, a[1] - oy]], col);
  }
  function garc(cx, cy, r, a0, a1, w, col, n = 28) {
    const o = [], i = [];
    for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n, c = Math.cos(a), s = Math.sin(a); o.push([cx + c * (r + w / 2), cy + s * (r + w / 2)]); i.push([cx + c * (r - w / 2), cy + s * (r - w / 2)]); }
    gpoly([...o, ...i.reverse()], col);
  }
  // an upright line (a post, a pole) from (x, y, z0) to z1, w metres thick
  function post(x, y, z0, z1, w, col) { const a = P(x, y, z0), b = P(x, y, z1); line(a.x, a.y, b.x, b.y, col, Math.max(1, w * a.k)); }
  function seg3(a, b, w, col) { const p = P(...a), q = P(...b); line(p.x, p.y, q.x, q.y, col, Math.max(1, w * (p.k + q.k) / 2)); }
  function shadow(x, y, r, a = 0.22) { const p = P(x, y, 0); ellipse(p.x, p.y, r * p.k, r * p.k * 0.42, `rgba(0,0,0,${a})`); }
  function sky(toY, top2 = '#a9dcf5', bot = '#e3f4fb') { const gr = ctx.createLinearGradient(0, 0, 0, Math.max(1, toY)); gr.addColorStop(0, top2); gr.addColorStop(1, bot); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, Math.max(0, toY)); }
  // a row of round trees along depth y (seeded, so they don't move)
  function treeLine(y, x0, x1, step, hgt = 4.5) {
    for (let x = x0, i = 0; x <= x1; x += step, i++) {
      const h = hgt * (0.8 + hash(i, y) * 0.45), r = 1.5 + hash(y, i) * 0.9, xx = x + (hash(i * 3, y) - 0.5) * step * 0.6;
      post(xx, y, 0, h * 0.5, 0.35, '#8a6a4a');
      const c = P(xx, y, h * 0.62);
      circle(c.x, c.y, r * c.k, shade('#4f9a4a', (hash(i, 7) - 0.5) * 0.2));
      circle(c.x - r * c.k * 0.35, c.y - r * c.k * 0.3, r * c.k * 0.55, 'rgba(255,255,255,.12)');
    }
  }
  function txt(s, x, y, size, col = '#fff', align = 'center', weight = 900) {
    ctx.font = `${weight} ${size}px ${UI_FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = 'rgba(40,30,20,.55)'; ctx.strokeText(s, x, y);
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }

  // A townie standing (or running) at (x, y) on the ground. o: pose, view ('back' = facing away), turn, phase, hands,
  // air (units), after (draws what they hold), rot (radians: diving), lift (metres off the ground).
  function townie(L, x, y, o = {}) {
    const p = P(x, y, o.lift || 0), s = p.k * PS * (o.scale || 1), wheel = L.mob === 'wheel';   // (v0.49: scale)
    const opt = { look: L, energy: 'good', ts: o.ts !== undefined ? o.ts : T * 1000, seed: o.seed || 1, pose: o.pose || 'stand', view: o.view || 'front', turn: o.turn || 0, phase: o.phase || 0, hands: o.hands, air: o.air || 0, wave: o.wave, face: o.face || (o.view === 'back' ? 1 : -1), back: o.view === 'back' };
    if (!wheel) opt.after = o.after;
    if (o.rot) { ctx.save(); ctx.translate(p.x, p.y - (o.rotAt || 12) * s); ctx.rotate(o.rot); ctx.translate(-p.x, -(p.y - (o.rotAt || 12) * s)); }
    if (o.lift) { const q = P(x, y, 0); ellipse(q.x, q.y, 8 * q.k * PS, 3.4 * q.k * PS, 'rgba(0,0,0,.14)'); }
    drawPerson(p.x, p.y, s, opt);
    if (wheel && o.after) local(p.x, p.y - (o.air || 0) * s, s, 1, o.after);
    if (o.rot) ctx.restore();
    return { p, s };
  }
  // what they hold, drawn in the townie's own frame (units)
  function racket(h, ang, col = '#e5484d') {
    const c = Math.cos(ang), s = Math.sin(ang);
    line(h[0], h[1], h[0] + c * 5, h[1] + s * 5, '#3b3028', 1.7);
    ctx.save(); ctx.translate(h[0] + c * 9.2, h[1] + s * 9.2); ctx.rotate(ang + Math.PI / 2);
    ellipse(0, 0, 3.5, 4.6, 'rgba(255,255,255,.4)', col, 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.35; ctx.beginPath();
    for (let i = -2; i <= 2; i++) { ctx.moveTo(i * 1.2, -4); ctx.lineTo(i * 1.2, 4); ctx.moveTo(-3, i * 1.5); ctx.lineTo(3, i * 1.5); }
    ctx.stroke(); ctx.restore();
  }
  function bball(x, y, r, rot = 0) {
    circle(x, y, r, '#f07b2c', '#5a2a10', Math.max(0.6, r * 0.12));
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.strokeStyle = '#5a2a10'; ctx.lineWidth = Math.max(0.5, r * 0.1);
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 1.25, 0, r * 0.95, -0.75, 0.75); ctx.stroke(); ctx.beginPath(); ctx.arc(r * 1.25, 0, r * 0.95, Math.PI - 0.75, Math.PI + 0.75); ctx.stroke();
    ctx.restore(); circle(x - r * 0.35, y - r * 0.4, r * 0.28, 'rgba(255,255,255,.3)');
  }
  function football(x, y, r, rot = 0) {
    circle(x, y, r, '#fbfbf7', '#3a3a3a', Math.max(0.6, r * 0.1));
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const pent = (cx, cy, rr) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = '#2d2d2d'; ctx.fill(); };
    pent(0, 0, r * 0.36); [0, 1, 2, 3, 4].forEach(i => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; pent(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, r * 0.22); });
    ctx.restore(); circle(x - r * 0.35, y - r * 0.4, r * 0.25, 'rgba(255,255,255,.5)');
  }

  // ---------- messages on the court ----------
  function say(text, sub, col = '#fff', secs = 1.4) { banner = { text, sub, col, t0: T, secs }; }
  function pop(text, x, y, col = '#fff') { if (text) pops.push({ text, x, y, col, t0: T }); }
  function drawMessages() {
    pops = pops.filter(p => T - p.t0 < 1.1);
    pops.forEach(p => { const u = (T - p.t0) / 1.1; ctx.save(); ctx.globalAlpha = 1 - u * u; txt(p.text, p.x, p.y - u * 34, 17, p.col); ctx.restore(); });
    if (banner && T - banner.t0 < banner.secs) {
      const u = (T - banner.t0) / banner.secs, sc = Math.min(1, (T - banner.t0) * 7) * (u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1), y = H * 0.4;
      ctx.save(); ctx.globalAlpha = Math.max(0, sc); ctx.translate(W / 2, y); ctx.scale(0.6 + 0.4 * sc, 0.6 + 0.4 * sc);
      txt(banner.text, 0, 0, 30, banner.col);
      if (banner.sub) txt(banner.sub, 0, 30, 16, '#fff6d8');
      ctx.restore();
    }
  }
  // a finger showing what to do: 'up' (swipe up from x, y) or 'tap'
  function finger(kind2, x, y, label2) {
    const u = (T * 0.9) % 1;
    ctx.save();
    if (kind2 === 'down') {   // v0.41: pull back
      ctx.globalAlpha = 0.35 * (1 - u); line(x, y, x, y + 90 * u, '#fff', 6);
      ctx.globalAlpha = u < 0.85 ? 1 : (1 - u) / 0.15; emoji('👆', x + 8, y + 26 + 90 * u, 34);
    } else if (kind2 === 'up') {
      ctx.globalAlpha = 0.35 * (1 - u); line(x, y, x, y - 90 * u, '#fff', 6);
      ctx.globalAlpha = u < 0.85 ? 1 : (1 - u) / 0.15; emoji('👆', x + 8, y + 26 - 90 * u, 34);
    } else { const sc = 1 - Math.abs(Math.sin(u * Math.PI)) * 0.15; ctx.globalAlpha = 0.9; circle(x, y, 18 * (1 + u), null, `rgba(255,255,255,${1 - u})`, 3); emoji('👆', x + 8, y + 30 * sc, 34); }
    ctx.restore();
    if (label2) txt(label2, x, y + 52, 15, '#fff');
  }

  // =========================================================================== tennis
  function Tennis() {
    const C = { hw: 4.6, len: 22, net: 11, netH: 0.95, g: 7.2, meY: -0.6, themY: 22.6, win: 0.25, great: 0.08, to: BALL_GAMES.tennis.to };
    const sk = mate.skill;
    const me = { x: 0, y: C.meY, gx: 0, gy: C.meY, ph: 0, swing: -9, mv: 0, dir: 0 }, th = { x: 0, y: C.themY, gx: 0, gy: C.themY, ph: 0, swing: -9, mv: 0, dir: 0, wait: 0 };
    let ball = null, score = [0, 0], server = 0, st = 'serve', wait = 0, hit = null, trail = [], mark = null, cheer = -9, rally = 0, swipes = 0, over = false, why = '', stats = {};
    function cam() { fit(0, 0.79, 5.5, 22, 0.27, 13.5); }
    const inSide = (x, y, side) => Math.abs(x) <= C.hw + 0.06 && (side === 0 ? y >= -0.06 && y <= C.net : y >= C.net && y <= C.len + 0.06);
    // hit the ball from (x, y, z) to land at (tx, ty) after Tf seconds (a higher arc if it would hit the net)
    function launch(x, y, z, tx, ty, Tf, by, netOk) {
      let vx, vy, vz;
      for (let i = 0; i < 14; i++) {
        vx = (tx - x) / Tf; vy = (ty - y) / Tf; vz = (-z + 0.5 * C.g * Tf * Tf) / Tf;
        const tn = (C.net - y) / vy, zn = z + vz * tn - 0.5 * C.g * tn * tn;
        if (netOk || !(tn > 0 && tn < Tf) || zn > C.netH + 0.3) break;
        Tf += 0.08;
      }
      ball = { x, y, z, vx, vy, vz, by, n: 0, crossed: false };
      trail = []; rally++;
      // where the other player can hit it: after the bounce, as it reaches their baseline (or at the top of the
      // bounce, if it would bounce twice first)
      const rv = 1 - by, vzl = vz - C.g * Tf, vx2 = vx * 0.9, vy2 = vy * 0.9, vz2 = -vzl * 0.7, ry = rv ? C.themY : C.meY, t2 = 2 * vz2 / C.g;
      let tc = (ry - ty) / vy2;
      if (tc > t2 * 0.8) tc = t2 * 0.5;   // it would bounce twice first: run in and take it at the top of the bounce
      tc = Math.max(0.18, tc);            // it lands at their feet: take it just after the bounce
      hit = { who: rv, t: T + Tf + tc, x: tx + vx2 * tc, y: ty + vy2 * tc, z: vz2 * tc - 0.5 * C.g * tc * tc };
      const pl = rv ? th : me, side = rv ? 1 : -1;
      hit.run = Math.hypot(pl.x - (hit.x + side * 0.75), pl.y - hit.y);   // how far they have to run for it
      pl.gx = cl(hit.x + side * 0.75, -6.6, 6.6); pl.gy = rv ? cl(hit.y, C.net + 3, C.themY + 3) : cl(hit.y, C.meY - 3, C.net - 3);
      if (rv) th.wait = 0.3 - sk * 0.16;   // they see it coming a moment later
      const hp = by ? th : me; hp.gx = 0; hp.gy = by ? C.themY : C.meY;   // the hitter goes back to the middle
    }
    function aim(sw) {   // a swipe → where it lands, how long the swipe was (1 = a good deep shot)
      if (sw.tap || sw.dy > -14) return { tx: rnd(-0.8, 0.8), ty: 18.5, lf: 0.6 };
      const a = Math.atan2(sw.dx, -sw.dy), lf = cl(sw.len / (H * 0.3), 0.15, 1.8);
      return { tx: a / 0.6 * 4.2, ty: 12.6 + lf * 9.2, lf };   // a swipe 34° to the side lands on the line
    }
    function serve() {
      const x = (score[0] + score[1]) % 2 ? -1.3 : 1.3;
      me.x = me.gx = server ? -x : x; me.y = me.gy = C.meY; th.x = th.gx = server ? x : -x; th.y = th.gy = C.themY;
      ball = null; hit = null; st = 'serve'; wait = server ? 1.3 : 0; trail = []; mark = null; rally = 0;
      if (!server) say(t('mg_t_serve'), '', '#fff', 1.2);
    }
    function point(w, reason) {
      if (st !== 'rally') return;
      st = 'point'; hit = null; score[w]++; cheer = T; why = reason; const sk2 = (w ? 'th_' : 'me_') + reason + (reason === 'won' ? rally : ''); stats[sk2] = (stats[sk2] || 0) + 1;
      const sub = reason === 'net' ? t('mg_t_net') : reason === 'out' ? t('mg_t_out') : w === 0 ? t('mg_t_nice') : t('mg_t_miss');
      say(w === 0 ? t('mg_pt_me') : t('mg_pt_them', { name: mate.name }), `${sub}  ${score[0] >= C.to || score[1] >= C.to ? '' : score[0] === C.to - 1 && score[1] === C.to - 1 ? t('mg_t_decider') : call(score[0]) + ' : ' + call(score[1])}`, w === 0 ? '#ffe066' : '#fff');
      Sound.play(w === 0 ? 'cheer' : 'pop');
      over = score[w] >= C.to; wait = over ? 2.0 : 1.7;
    }
    function step(dt) {
      for (const [pl, spd] of [[me, 7.2], [th, 2.9 + sk * 2.4]]) {
        if (pl.wait > 0) { pl.wait -= dt; continue; }
        const dx = pl.gx - pl.x, dy = pl.gy - pl.y, d = Math.hypot(dx, dy), m = Math.min(d, spd * dt);
        if (d > 0.03) { pl.x += dx / d * m; pl.y += dy / d * m; pl.ph += m * 3.4; pl.mv = Math.min(1, d * 2.5); pl.dir = dx / d; } else pl.mv = Math.max(0, pl.mv - dt * 6);
      }
      if (st === 'serve') {
        if (server && (wait -= dt) <= 0) {   // they serve
          th.swing = T; Sound.play('racket'); st = 'rally';
          launch(th.x - 0.4, th.y, 2.3, rnd(-3.4, 3.4), rnd(2.2, 7.5), 1.75 - sk * 0.2, 1);
        }
        return;
      }
      if (ball) fly(dt, st === 'rally');
      if (st === 'rally') {
        if (hit && hit.who === 1 && T >= hit.t) theyHit();
        if (hit && hit.who === 0 && T > hit.t + C.win + 0.45) hit = null;   // no swing: it's gone past
      } else if (st === 'point' && (wait -= dt) <= 0) {
        if (over) return finish({ won: score[0] > score[1], me: score[0], them: score[1] });
        server = 1 - server; serve();
      }
    }
    function fly(dt, rules) {
      const b = ball, n = 4, h = dt / n;
      for (let i = 0; i < n; i++) {
        const py = b.y;
        b.x += b.vx * h; b.y += b.vy * h; b.vz -= C.g * h; b.z += b.vz * h;
        if (rules && !b.crossed && (py - C.net) * (b.y - C.net) <= 0) {
          b.crossed = true;
          if (b.z < C.netH && Math.abs(b.x) < C.hw + 0.6) { b.y = C.net - Math.sign(b.vy) * 0.1; b.vy *= -0.12; b.vx *= 0.3; b.vz = Math.min(0, b.vz); Sound.play('bounce'); return point(1 - b.by, 'net'); }
        }
        if (b.z <= 0 && b.vz < 0) {
          b.z = 0; b.vz = -b.vz * 0.7; b.vx *= 0.9; b.vy *= 0.9; b.n++;
          if (b.vz > 0.8) Sound.play('bounce');
          if (!rules) continue;
          if (b.n === 1) { mark = { x: b.x, y: b.y, t: T }; if (!inSide(b.x, b.y, 1 - b.by)) return point(1 - b.by, 'out'); }
          if (b.n === 2) return point(b.by, 'won');
        }
      }
      if (rules && (b.y < C.meY - 4 || b.y > C.themY + 4)) point(b.by, 'won');
      if (T % 0.04 < dt) { trail.push([b.x, b.y, b.z]); if (trail.length > 7) trail.shift(); }
    }
    function theyHit() {
      const h0 = hit; hit = null;
      if (Math.hypot(th.x - (h0.x + 0.75), th.y - h0.y) > 0.8) return;   // couldn't get there
      th.swing = T; Sound.play('racket');
      const spd = Math.hypot(ball.vx, ball.vy), from = [ball.x, ball.y, Math.max(0.45, ball.z)];
      const p = cl(0.78 + sk * 0.17 - Math.max(0, spd - 13) * 0.05 - Math.max(0, h0.run - 2.5) * 0.04 - (rally > 10 ? 0.05 : 0), 0.3, 0.97);
      if (Math.random() > p) {   // a mistake: into the net, or out
        if (Math.random() < 0.5) return launch(...from, rnd(-3, 3), C.net - 0.05, 0.8, 1, true);
        return launch(...from, Math.random() < 0.5 ? rnd(4.9, 6) * (Math.random() < 0.5 ? -1 : 1) : rnd(-3, 3), Math.random() < 0.5 ? rnd(-1.8, -0.4) : rnd(2, 8), 1.7, 1, false);
      }
      const away = Math.random() < 0.2 + sk * 0.5, side = me.x > 0.4 ? -1 : me.x < -0.4 ? 1 : (Math.random() < 0.5 ? -1 : 1);
      launch(...from, away ? side * rnd(2.0, 4.1) : rnd(-3.6, 3.6), rnd(1.2, 7.8 - sk * 3), rnd(1.6, 1.8) - sk * 0.25, 1);
    }
    function input(sw) {
      swipes++;
      if (st === 'serve' && !server) {   // your serve
        const A = aim(sw); me.swing = T; Sound.play('racket'); st = 'rally';
        launch(me.x + 0.4, me.y, 2.3, cl(A.tx + rnd(-0.3, 0.3), -5.5, 5.5), cl(A.ty, 13, 24) + rnd(-0.3, 0.3), 1.6, 0);
        return;
      }
      if (st !== 'rally') return;
      me.swing = T;
      if (!hit || hit.who !== 0) return;
      const dt = (sw.T0 ?? T) - hit.t, p = P(me.x, me.y, 2.4);   // timed from when your finger touched
      if (dt < -C.win) return pop(t('mg_t_early'), p.x, p.y, '#ffd6a0');
      if (dt > C.win) { hit = null; return pop(t('mg_t_late'), p.x, p.y, '#ffd6a0'); }
      const q = 1 - Math.abs(dt) / C.win, A = aim(sw), sc = (1 - q) * 1.5, great = Math.abs(dt) < C.great;
      hit = null; Sound.play('racket');
      pop(great ? t('mg_t_great') : q < 0.4 ? (dt < 0 ? t('mg_t_early') : t('mg_t_late')) : '', p.x, p.y, great ? '#ffe066' : '#ffd6a0');
      launch(ball.x, ball.y, Math.max(0.45, ball.z), A.tx + rnd(-1, 1) * sc, A.ty + rnd(-1, 1) * sc * 0.8, 1.72 - q * 0.3 - (A.lf > 1 ? 0.12 : 0), 0);
    }
    function player(pl, L, view, side) {   // side: which side of the screen the racket is on
      const su = (T - pl.swing) / 0.3, swinging = su >= 0 && su < 1, serving = st === 'serve' && ((server === 0) === (pl === me));
      let hp, ang;
      if (serving) { hp = [side * 2.5, -28 - Math.sin(T * 3) * 0.6]; ang = -Math.PI / 2 + side * 0.25; }
      else if (swinging) { const e = Math.sin(su * Math.PI / 2); hp = [side * (7.5 - e * 12), -14 - Math.sin(su * Math.PI) * 4]; ang = side > 0 ? -0.35 - e * 2.5 : -Math.PI + 0.35 + e * 2.5; }
      else { hp = [side * 6.8, -12.5]; ang = side > 0 ? -1.0 : -Math.PI + 1.0; }
      const hands = side > 0 ? [null, hp] : [hp, null];
      const tossed = serving ? 0.5 + Math.abs(Math.sin(T * 2.2)) * 0.5 : 0;
      townie(L, pl.x, pl.y, { pose: pl.mv > 0.15 ? 'run' : 'stand', view, turn: cl(pl.dir * pl.mv * 0.6, -0.6, 0.6), phase: pl.ph, hands, seed: view === 'back' ? 3 : 5,
        after: () => { racket(hp, ang); if (serving) { const by = -34 - tossed * 10; ellipse(-side * 3, by, 2.2, 2.2, '#d8f25a', '#7a8a20', 0.4); } } });
    }
    function draw() {
      cam();
      const far = P(0, 27, 0);
      ctx.fillStyle = '#7dbb62'; ctx.fillRect(0, 0, W, H);
      sky(far.y - 30, '#9fd6f2', '#d9f0f8');
      treeLine(29.5, -16, 16, 2.6, 5.2);
      grect(-7.2, -4, 7.2, 26.2, '#4f8f5a');
      grect(-C.hw, 0, C.hw, C.len, '#3e7cc7');
      const Lw = 0.09, wcol = '#f4f6f8';
      [[-C.hw, 0, -C.hw, C.len], [C.hw, 0, C.hw, C.len], [-C.hw, 0, C.hw, 0], [-C.hw, C.len, C.hw, C.len], [-C.hw + 1.2, 0, -C.hw + 1.2, C.len], [C.hw - 1.2, 0, C.hw - 1.2, C.len],
        [-C.hw + 1.2, C.net - 5.5, C.hw - 1.2, C.net - 5.5], [-C.hw + 1.2, C.net + 5.5, C.hw - 1.2, C.net + 5.5], [0, C.net - 5.5, 0, C.net + 5.5], [0, 0, 0, 0.35], [0, C.len, 0, C.len - 0.35]]
        .forEach(([a, b, c2, d]) => gline([a, b], [c2, d], Lw, wcol));
      if (mark && T - mark.t < 1.4) { const p = P(mark.x, mark.y); ellipse(p.x, p.y, 0.32 * p.k, 0.13 * p.k, `rgba(255,255,255,${0.5 * (1 - (T - mark.t) / 1.4)})`); }
      // the ring: where you'll hit it. It closes as the ball comes; green = now
      if (hit && hit.who === 0 && st === 'rally') {
        const left = hit.t - T, now = Math.abs(left) <= C.win, p = P(hit.x, hit.y), r = (0.35 + Math.max(0, left) * 1.25) * p.k;
        ellipse(p.x, p.y, r, r * 0.42, now ? 'rgba(120,255,150,.25)' : null, now ? '#7dff9a' : 'rgba(255,255,255,.85)', now ? 3.5 : 2.5);
        ellipse(p.x, p.y, 0.35 * p.k, 0.15 * p.k, null, 'rgba(255,255,255,.6)', 1.5);
      }
      if (ball) shadow(ball.x, ball.y, 0.16, 0.25);
      const objs = [];
      objs.push({ y: 26.2, f: () => {   // the fence at the far end
        const a = P(-7.2, 26.2, 0), b = P(7.2, 26.2, 0), a2 = P(-7.2, 26.2, 3.2), b2 = P(7.2, 26.2, 3.2);
        poly([a, b, b2, a2], 'rgba(40,80,55,.35)');
        ctx.strokeStyle = 'rgba(30,60,40,.45)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = -7.2; x <= 7.2; x += 0.6) { const p1 = P(x, 26.2, 0), p2 = P(x + 1.6, 26.2, 3.2); ctx.moveTo(p1.x, p1.y); ctx.lineTo(Math.min(p2.x, b2.x), p2.y); const p3 = P(x + 1.6, 26.2, 0), p4 = P(x, 26.2, 3.2); ctx.moveTo(Math.min(p3.x, b.x), p3.y); ctx.lineTo(p4.x, p4.y); }
        ctx.stroke();
        for (let x = -7.2; x <= 7.21; x += 2.4) post(x, 26.2, 0, 3.3, 0.1, '#2f4a3a');
        seg3([-7.2, 26.2, 3.25], [7.2, 26.2, 3.25], 0.08, '#2f4a3a');
      } });
      objs.push({ y: th.y, f: () => player(th, mate.look, 'front', -1) });
      // two people from the court watching from the side
      const fans = Scene.parkLooks('tennis');
      [[-7.8, 9.2, 0], [7.9, 13.6, 1]].forEach(([x, y, i]) => objs.push({ y, f: () => townie(fans[i], x, y, { view: 'front', turn: x < 0 ? 0.4 : -0.4, wave: T - cheer < 1.3 && (i === 0 ? Math.sin(T * 9) > 0 : Math.sin(T * 9 + 1) > 0), seed: 7 + i }) }));
      objs.push({ y: C.net, f: () => {   // the net
        const a = P(-C.hw - 0.5, C.net, 0), b = P(C.hw + 0.5, C.net, 0), a2 = P(-C.hw - 0.5, C.net, C.netH + 0.08), b2 = P(C.hw + 0.5, C.net, C.netH + 0.08);
        poly([a, b, b2, a2], 'rgba(20,30,40,.38)');
        ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 0.8; ctx.beginPath();
        for (let x = -C.hw - 0.5; x < C.hw + 0.5; x += 0.25) { const p1 = P(x, C.net, 0), p2 = P(x, C.net, C.netH); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); }
        for (let z = 0.15; z < C.netH; z += 0.2) { const p1 = P(-C.hw - 0.5, C.net, z), p2 = P(C.hw + 0.5, C.net, z); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); }
        ctx.stroke();
        seg3([-C.hw - 0.5, C.net, C.netH + 0.04], [C.hw + 0.5, C.net, C.netH + 0.04], 0.08, '#f4f6f8');
        post(-C.hw - 0.55, C.net, 0, C.netH + 0.1, 0.1, '#3a4652'); post(C.hw + 0.55, C.net, 0, C.netH + 0.1, 0.1, '#3a4652');
      } });
      if (ball) objs.push({ y: ball.y, f: () => {
        trail.forEach((q, i) => { const p = P(...q); circle(p.x, p.y, Math.max(1.5, 0.08 * p.k), `rgba(216,242,90,${0.08 + i * 0.05})`); });
        const p = P(ball.x, ball.y, ball.z + 0.1), r = Math.max(3.2, 0.13 * p.k);
        circle(p.x, p.y, r, '#d8f25a', '#6b7a1a', 1); circle(p.x - r * 0.3, p.y - r * 0.35, r * 0.3, 'rgba(255,255,255,.55)');
      } });
      objs.push({ y: me.y - 0.01, f: () => player(me, S.me.look, 'back', 1) });
      objs.sort((a, b) => b.y - a.y).forEach(o => o.f());
    }
    function hint() {
      if (phase !== 'play' || swipes > 2) return null;
      if (st === 'serve' && !server) return ['up', W * 0.3, H * 0.68, t('mg_t_serve')];
      if (st === 'rally' && hit && hit.who === 0 && Math.abs(hit.t - T) < 0.6) { const p = P(hit.x, hit.y); return ['up', p.x, p.y - 20, t('mg_t_now')]; }
      return null;
    }
    const call = n => (n >= C.to ? '🏆' : ['0', '15', '30', '40'][n]);
    function hud() { return { me: call(score[0]), them: call(score[1]), mid: score[0] === C.to - 1 && score[1] === C.to - 1 ? `🎾 ${t('mg_t_decider')}` : `🎾 ${t('mg_t_goal', { n: C.to })}` }; }
    serve();
    return { step, draw, input, hint, hud, dbg: () => ({ st, score, hit, ball, me, th, server, stats }) };
  }

  // =========================================================================== basketball
  function Hoops() {
    const SP = [{ d: 3.3, a: 0.55 }, { d: 4.6, a: 0 }, { d: 5.2, a: -0.75 }, { d: 5.7, a: 0.85 }, { d: 6.9, a: 0, three: true }];
    const C = { g: 9.8, rimZ: 3.05, rimR: 0.34, br: 0.17, boardV: -0.46, boardW: 1.05, bz0: 2.8, bz1: 4.0, aim: 0.2, shots: BALL_GAMES.basketball.shots };   // a cartoon hoop, a bit bigger than life
    const sk = mate.skill;
    let si = 0, shooter = 0, shot = 0, score = [0, 0], st = 'aim', wait = 0, ball = null, jumpT = -9, netT = -9, cheer = -9, swipes = 0, guide = true, last = null;
    function cam() { V.D = 10; V.cx = W / 2; const k0 = (W / 2) / 3.3; V.F = k0 * V.D; V.hor = 0.3 * H; V.h = (0.88 - 0.3) * H / k0; }   // you at the bottom, the hoop in the middle, sky at the top
    // the court's own frame (u along the baseline, v out from under the hoop) → our view (x across, y away from you)
    function W2(u, v) { const s = SP[si], c = Math.cos(Math.PI + s.a), n = Math.sin(Math.PI + s.a); return [u * c - v * n, s.d + u * n + v * c]; }
    const boardN = () => { const s = SP[si]; return [Math.sin(s.a), -Math.cos(s.a)]; };   // the way the board faces (towards the court)
    function turn(first) {
      ball = null; st = 'aim'; wait = shooter ? 1.2 : 0;
      if (first) say(si === SP.length - 1 ? t('mg_b_three') : t('mg_b_spot', { i: si + 1 }), shooter ? t('mg_b_turn_them', { name: mate.name }) : t('mg_b_turn_me'), '#fff', 1.5);
      else if (shot === 0) say(shooter ? t('mg_b_turn_them', { name: mate.name }) : t('mg_b_turn_me'), '', '#fff', 1.1);
    }
    // e = how far off the shot is ([across, depth], 1 ≈ a ball's width at the rim)
    function shoot(e) {
      const s = SP[si], Tf = 1.0 + s.d * 0.08, P0 = [0.12, 0.35, 2.45];   // a nice high arc
      const tx = e[0] * C.aim, ty = s.d + e[1] * C.aim, tz = C.rimZ + 0.02;
      ball = { x: P0[0], y: P0[1], z: P0[2], vx: (tx - P0[0]) / Tf, vy: (ty - P0[1]) / Tf, vz: (tz - P0[2] + 0.5 * C.g * Tf * Tf) / Tf, t0: T, in: false, rim: 0, rimT: -9, floor: 0, rot: 0 };
      st = 'flight'; jumpT = T; last = e;
    }
    function step(dt) {
      if (st === 'aim' && shooter && (wait -= dt) <= 0) {
        const s = SP[si], sd = 1.0 - sk * 0.55 + s.d * 0.03;
        shoot([gauss() * sd, gauss() * sd]);
      }
      if (st === 'flight') {
        fly(dt);
        if (T - ball.t0 > 2.6 || (ball.floor >= 3 && T - ball.t0 > 1.4)) result();
      } else if (st === 'after' && (wait -= dt) <= 0) next();
    }
    function fly(dt) {
      const b = ball, s = SP[si], n = 6, h = dt / n, bn = boardN(), bt = [-bn[1], bn[0]], B0 = W2(0, C.boardV);
      for (let i = 0; i < n; i++) {
        const pz = b.z;
        b.vz -= C.g * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h; b.rot += h * 6;
        const hx = b.x, hy = b.y - s.d, hr = Math.hypot(hx, hy);
        if (!b.in && pz >= C.rimZ && b.z < C.rimZ && hr < C.rimR - C.br * 0.45) {   // through the hoop
          b.in = true; netT = T; b.vx *= 0.35; b.vy *= 0.35; b.vz *= 0.6;
          if (!b.rim) Sound.play('swish');
        }
        if (Math.abs(b.z - C.rimZ) < C.br + 0.05 && hr > 0.001) {   // the rim: bounce off the nearest point of the ring
          const qx = hx / hr * C.rimR, qy = hy / hr * C.rimR, dx = hx - qx, dy = hy - qy, dz = b.z - C.rimZ, dd = Math.hypot(dx, dy, dz);
          if (dd < C.br && dd > 1e-4) {
            const nx = dx / dd, ny = dy / dd, nz = dz / dd, vn = b.vx * nx + b.vy * ny + b.vz * nz;
            if (vn < 0) { const k = 1.55 * vn; b.vx = (b.vx - k * nx) * 0.92; b.vy = (b.vy - k * ny) * 0.92; b.vz -= k * nz; if (T - b.rimT > 0.12) Sound.play('clang'); b.rimT = T; b.rim++; }
            b.x = qx + nx * C.br; b.y = s.d + qy + ny * C.br; b.z = C.rimZ + nz * C.br;
          }
        }
        const rx = b.x - B0[0], ry = b.y - B0[1], sd = rx * bn[0] + ry * bn[1], along = rx * bt[0] + ry * bt[1];
        if (sd < C.br && sd > -0.3 && Math.abs(along) < C.boardW && b.z > C.bz0 && b.z < C.bz1) {   // the backboard
          const vn = b.vx * bn[0] + b.vy * bn[1];
          if (vn < 0) { b.vx -= 1.6 * vn * bn[0]; b.vy -= 1.6 * vn * bn[1]; Sound.play('bounce'); }
          b.x += (C.br - sd) * bn[0]; b.y += (C.br - sd) * bn[1];
        }
        if (b.z < C.br && b.vz < 0) { b.z = C.br; b.vz = -b.vz * 0.62; b.vx *= 0.8; b.vy *= 0.8; b.floor++; if (b.vz > 0.8) Sound.play('bounce'); }
      }
    }
    function result() {
      const b = ball, s = SP[si], pts = s.three ? 3 : 2, p = P(0, s.d, C.rimZ + 0.8);
      st = 'after'; wait = 1.0;
      if (b.in) {
        score[shooter] += pts; cheer = T; Sound.play(shooter ? 'pop' : 'cheer');
        pop(`${b.rim ? t('mg_b_in') : t('mg_b_swish')} +${pts}`, p.x, p.y, shooter ? '#fff' : '#ffe066');
      } else {
        let tip = '';
        if (!shooter && last) tip = Math.abs(last[0]) > Math.abs(last[1]) ? (last[0] > 0 ? t('mg_b_right') : t('mg_b_left')) : (last[1] > 0 ? t('mg_b_long') : t('mg_b_short'));
        pop(t('mg_b_miss') + (tip ? ' · ' + tip : ''), p.x, p.y, '#ffd6a0');
      }
    }
    function next() {
      if (++shot >= C.shots) {
        shot = 0;
        if (!shooter) shooter = 1;
        else { shooter = 0; if (si + 1 >= SP.length) return finish({ won: score[0] > score[1] ? true : score[0] < score[1] ? false : null, me: score[0], them: score[1] }); si++; guide = false; return turn(true); }
        return turn(true);
      }
      turn(false);
    }
    function input(sw) {
      swipes++;
      if (st !== 'aim' || shooter) return;
      if (sw.tap || sw.dy > -20) return pop(t('mg_b_how1'), W / 2, H * 0.62, '#fff');
      const a = Math.atan2(sw.dx, -sw.dy), lf = sw.len / (H * 0.3);
      shoot([a / 0.105, (lf - 1) / 0.15]);
    }
    // the hoop: the pole, the board, the back of the ring and the net; the front of the ring goes over the ball
    function rimPts(z = C.rimZ, r = C.rimR, sway = 0) { const s = SP[si], o = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; o.push([Math.cos(a) * r + sway, s.d + Math.sin(a) * r, z]); } return o; }
    function drawHoopBack() {
      const s = SP[si], A = W2(0, -1.5), Bm = W2(0, C.boardV - 0.05);
      post(A[0], A[1], 0, 3.55, 0.16, '#5b6470');
      seg3([A[0], A[1], 3.5], [Bm[0], Bm[1], 3.4], 0.12, '#5b6470');
      const c = [W2(-0.9, C.boardV), W2(0.9, C.boardV)];
      gpoly([[...c[0], C.bz0], [...c[1], C.bz0], [...c[1], C.bz1], [...c[0], C.bz1]], 'rgba(250,252,255,.88)', '#4a5560', 2);
      const i2 = [W2(-0.36, C.boardV + 0.01), W2(0.36, C.boardV + 0.01)];
      gpoly([[...i2[0], 3.12], [...i2[1], 3.12], [...i2[1], 3.62], [...i2[0], 3.62]], null, '#e5484d', 2.5);
      seg3([...W2(0, C.boardV), C.rimZ], [0, s.d - C.rimR * 0.2, C.rimZ], 0.06, '#e5484d');
      const R = rimPts(), sway = T - netT < 0.8 ? Math.sin((T - netT) * 18) * 0.04 * (1 - (T - netT) / 0.8) : 0, N = rimPts(C.rimZ - 0.48, 0.17, sway);
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let k = 0; k < 24; k += 2) { const p = P(...R[k]), q = P(...N[(k + 2) % 24]), q2 = P(...N[(k + 22) % 24]); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.moveTo(p.x, p.y); ctx.lineTo(q2.x, q2.y); }
      ctx.stroke();
      ctx.beginPath(); R.slice(0, 13).forEach((q, k) => { const p = P(...q); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.strokeStyle = '#d8402a'; ctx.lineWidth = Math.max(2, 0.05 * P(0, s.d).k); ctx.stroke();
    }
    function drawRimFront() {
      const s = SP[si], R = rimPts();
      ctx.beginPath(); R.slice(12).forEach((q, k) => { const p = P(...q); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.strokeStyle = '#ee5a3a'; ctx.lineWidth = Math.max(2.4, 0.06 * P(0, s.d).k); ctx.stroke();
    }
    function shooterPose(L, view, isMe) {
      const ju = (T - jumpT) / 0.7, jumping = (st === 'flight' || st === 'after') && ju >= 0 && ju < 1, air = jumping ? Math.sin(ju * Math.PI) * 7 : 0;
      const holding = st === 'aim', up = jumping && ju < 0.5;
      const hands = holding ? [[-3.4, -17], [3.4, -17]] : up ? [[-2.2, -33], [2.2, -34]] : jumping ? [[-3.5, -30], [3.5, -30]] : null;
      townie(L, 0, 0, { view, hands, air, seed: isMe ? 3 : 5, after: holding ? () => bball(0, -18.5, C.br / PS) : null });
    }
    function draw() {
      cam();
      const s = SP[si];
      sky(V.hor + 4);
      ctx.fillStyle = '#86c06c'; ctx.fillRect(0, V.hor, W, H - V.hor);
      treeLine(s.d + 16, -22, 22, 3, 6);
      // the fence behind the hoop
      { const a = P(-14, s.d + 8), b = P(14, s.d + 8), a2 = P(-14, s.d + 8, 2.6), b2 = P(14, s.d + 8, 2.6); poly([a, b, b2, a2], 'rgba(60,80,70,.28)'); seg3([-14, s.d + 8, 2.6], [14, s.d + 8, 2.6], 0.07, '#4a5a52'); for (let x = -14; x <= 14; x += 3.5) post(x, s.d + 8, 0, 2.7, 0.08, '#4a5a52'); }
      // the court, turned to where you're standing
      const Cq = (u0, v0, u1, v1) => [W2(u0, v0), W2(u1, v0), W2(u1, v1), W2(u0, v1)];
      gpoly(Cq(-8.5, -2.6, 8.5, 13.5), '#7d848c');
      gpoly(Cq(-7.5, -1.6, 7.5, 12.4), '#d8823f');
      gpoly(Cq(-2.45, -1.6, 2.45, 4.2), '#c46a30');
      const Lw = 0.07, wc = 'rgba(255,255,255,.92)', L2 = (u0, v0, u1, v1) => gline(W2(u0, v0), W2(u1, v1), Lw, wc);
      L2(-7.5, -1.6, 7.5, -1.6); L2(-7.5, -1.6, -7.5, 12.4); L2(7.5, -1.6, 7.5, 12.4); L2(-2.45, -1.6, -2.45, 4.2); L2(2.45, -1.6, 2.45, 4.2); L2(-2.45, 4.2, 2.45, 4.2);
      L2(-6.6, -1.6, -6.6, 1.3); L2(6.6, -1.6, 6.6, 1.3);
      const arc = (r, a0, a1, cv0) => { const o = [], i = []; for (let k = 0; k <= 30; k++) { const a = a0 + (a1 - a0) * k / 30, u = Math.cos(a) * r, v = Math.sin(a) * r + cv0; o.push(W2(u * (r + Lw / 2) / r, (v - cv0) * (r + Lw / 2) / r + cv0)); i.push(W2(u * (r - Lw / 2) / r, (v - cv0) * (r - Lw / 2) / r + cv0)); } gpoly([...o, ...i.reverse()], wc); };
      arc(6.75, 0.2, Math.PI - 0.2, 0); arc(1.8, 0, Math.PI, 4.2);
      // you shoot from here: a little mark
      { const p = P(0, 0); ellipse(p.x, p.y, 0.5 * p.k, 0.2 * p.k, 'rgba(255,255,255,.18)'); }
      if (ball) shadow(ball.x, ball.y, 0.2, 0.25);
      drawHoopBack();
      const watcher = shooter ? S.me.look : mate.look, shooterL = shooter ? mate.look : S.me.look;
      townie(watcher, -2.5, 2.4, { view: 'front', turn: 0.5, wave: T - cheer < 1.3 && Math.sin(T * 9) > 0, seed: shooter ? 3 : 5 });
      const ballFront = ball && !(ball.y > s.d - C.rimR - C.br && ball.z < C.rimZ + 0.35);
      const drawBall = () => { if (!ball) return; const p = P(ball.x, ball.y, ball.z); bball(p.x, p.y, Math.max(3, C.br * p.k), ball.rot); };
      if (!ballFront) { drawBall(); drawRimFront(); } else drawRimFront();
      shooterPose(shooterL, 'back', !shooter);
      if (ballFront) drawBall();
      // how far to swipe (only at the first place)
      if (guide && st === 'aim' && !shooter) {
        const p0 = P(0, 0), by = p0.y - 18.5 * p0.k * PS, gy = by - H * 0.3, gx = W / 2;   // from the ball, as far up as a good swipe
        ctx.save(); ctx.setLineDash([6, 6]); line(gx, by - 14, gx, gy, 'rgba(255,255,255,.6)', 2.5); ctx.restore();
        circle(gx, gy, 16, 'rgba(255,255,255,.18)', 'rgba(255,255,255,.85)', 2.5);
        txt(t('mg_b_guide'), gx + 22, gy, 14, '#fff', 'left');
      }
    }
    function hint() {
      if (phase !== 'play' || swipes > 1 || st !== 'aim' || shooter) return null;
      return ['up', W / 2 + 54, H * 0.78, t('mg_b_how1')];
    }
    function hud() {
      const left = C.shots - shot;
      return { me: score[0], them: score[1], mid: `🏀 ${si + 1}/${SP.length}${SP[si].three ? ' · 3' : ''}<br><small>${shooter ? esc(mate.name) : t('mg_you')} ${t('mg_b_shots', { n: st === 'aim' ? left : Math.max(0, left - 1) })}</small>` };
    }
    turn(true);
    return { step, draw, input, hint, hud, dbg: () => ({ st, si, shooter, shot, score, ball, last }) };
  }

  // =========================================================================== football: penalties
  function Penalty() {
    const C = { gw: 3.66, gh: 2.44, line: 11, g: 9.8, br: 0.13, kicks: BALL_GAMES.soccer.kicks, Lr: 1.75, body: 0.42 };
    const sk = mate.skill;
    let kicker = 0, st = 'ready', wait = 0, ball = null, kp = null, res = [[], []], runT = -9, cheer = -9, swipes = 0, taps = 0, tapAt = null, netHit = null, outcome = '', over = false;
    // the goal wide across the screen, the ball low down, you (or them) beside it
    function cam() { V.D = 15.5; V.cx = W / 2; const k11 = W * 0.84 / (2 * C.gw), k0 = k11 * (C.line + V.D) / V.D; V.F = k11 * (C.line + V.D); V.h = (0.8 - 0.45) * H / (k0 - k11); V.hor = 0.8 * H - V.h * k0; }
    const goals = i => res[i].filter(Boolean).length;
    function setUp() {
      ball = { x: 0, y: 0, z: C.br, vx: 0, vy: 0, vz: 0, rot: 0, live: false, done: false };
      kp = { tx: 0, tz: 1.3, t0: -9, dive: false, plan: null };
      st = 'ready'; runT = -9; tapAt = null; netHit = null; outcome = '';
      wait = kicker ? 1.4 : 0;
      say(kicker ? t('mg_s_you_keep') : t('mg_s_you_kick'), res[kicker].length === C.kicks - 1 ? t('mg_s_last') : '', '#fff', 1.2);
    }
    // the keeper: where the hands are now (diving towards (tx, tz) over 0.4 s), the feet, and the angle of the body
    function keeper() {
      const u = kp.dive ? cl((T - kp.t0) / 0.4, 0, 1) : 0, e = 1 - (1 - u) * (1 - u);
      const fx = kp.tx * 0.45 * e, fz = (Math.max(0, Math.min(0.9, kp.tz - 1.5)) + (Math.abs(kp.tx) > 1.5 ? 0.3 : 0)) * Math.sin(e * Math.PI / 2);
      const ang = kp.dive ? Math.atan2(kp.tx - fx, Math.max(0.2, kp.tz - fz)) * e : 0;
      const sway = kp.dive ? 0 : Math.sin(T * 3.2) * 0.25;
      const hx = fx + sway + Math.sin(ang) * C.Lr, hz = fz + Math.cos(ang) * C.Lr * (kp.dive ? 1 : 0.8);
      return { fx: fx + sway, fz, ang, hx, hz, u };
    }
    function dive(tx, tz) { if (kp.dive) return; kp.dive = true; kp.t0 = T; kp.tx = cl(tx, -3.4, 3.4); kp.tz = cl(tz, 0.15, 2.35); }
    function kick(tx, tz, Tf) {
      ball.live = true; ball.vx = tx / Tf; ball.vy = C.line / Tf; ball.vz = (tz - C.br + 0.5 * C.g * Tf * Tf) / Tf;
      st = 'flight'; Sound.play('kick');
      if (kicker === 0) {   // they're in goal: they guess, or read where it's going
        const read = Math.random() < 0.14 + sk * 0.3, Z = [[-2.7, 0.5], [2.7, 0.5], [-2.4, 1.9], [2.4, 1.9], [0, 1.2]];
        const pick = read ? [tx + gauss() * 0.6, tz + gauss() * 0.35] : Z[Math.floor(Math.random() * Z.length)];
        kp.plan = { at: T + rnd(0.08, 0.26) - sk * 0.05, tx: pick[0], tz: pick[1] };
      }
    }
    function step(dt) {
      if (kp.plan && T >= kp.plan.at) { dive(kp.plan.tx, kp.plan.tz); kp.plan = null; }
      if (st === 'ready' && kicker && (wait -= dt) <= 0) { st = 'run'; runT = T; }
      if (st === 'run' && T - runT >= (kicker ? 0.8 : 0.45)) {
        if (kicker) {   // they shoot
          const miss = Math.random() < 0.16 - sk * 0.1, side = Math.random() < 0.5 ? -1 : 1;
          const tx = miss ? side * rnd(3.95, 4.8) : Math.random() < 0.1 ? rnd(-0.4, 0.4) : side * rnd(0.8, 3.3), tz = miss && Math.random() < 0.5 ? rnd(2.7, 3.3) : rnd(0.15, 2.1);
          kick(tx, tz, 0.95 - sk * 0.1);
        } else kick(ball.aim[0], ball.aim[1], ball.aim[2]);
      }
      if (ball && ball.live) fly(dt);
      if (st === 'after' && (wait -= dt) <= 0) next();
    }
    function fly(dt) {
      const b = ball, n = 4, h = dt / n;
      for (let i = 0; i < n; i++) {
        const py = b.y;
        b.vz -= C.g * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h; b.rot += h * 12;
        if (st === 'flight' && py < C.line - 0.4 && b.y >= C.line - 0.4) {   // reaching the keeper
          const K = keeper(), bx = K.fx + Math.sin(K.ang) * 0.35, bz = K.fz + Math.cos(K.ang) * 0.35, hx2 = K.hx + Math.sin(K.ang) * 0.15, hz2 = K.hz + Math.cos(K.ang) * 0.15;
          const sx = hx2 - bx, sz = hz2 - bz, l2 = sx * sx + sz * sz, u = cl(((b.x - bx) * sx + (b.z - bz) * sz) / (l2 || 1), 0, 1);
          const d = Math.hypot(b.x - (bx + sx * u), b.z - (bz + sz * u));
          if (d < C.body + C.br && Math.abs(b.x) < C.gw + 0.3 && b.z < C.gh + 0.3) { b.vy = -Math.abs(b.vy) * 0.3; b.vz = 2.6; b.vx = (b.x - bx) * 2 + rnd(-2, 2); Sound.play('kick'); return decide('saved'); }
        }
        if (st === 'flight' && py < C.line && b.y >= C.line) {   // the goal line: post, bar, in, or not
          const ax = Math.abs(b.x);
          if ((Math.abs(ax - C.gw) < C.br + 0.06 && b.z < C.gh + 0.06) || (Math.abs(b.z - C.gh) < C.br + 0.06 && ax < C.gw + 0.06)) { b.vy = -Math.abs(b.vy) * 0.45; b.vx *= 0.6; Sound.play('clang'); return decide('post'); }
          if (ax < C.gw && b.z < C.gh) { netHit = null; decide('goal'); continue; }
          return decide(b.z >= C.gh ? 'over' : 'wide');
        }
        if (outcome === 'goal' && b.y > C.line + 1.9) { b.y = C.line + 1.9; b.vy = -0.4; b.vx *= 0.3; b.vz *= 0.3; netHit = { x: b.x, z: b.z, t: T }; }
        if (b.z < C.br && b.vz < 0) { b.z = C.br; b.vz = -b.vz * 0.5; b.vx *= 0.8; b.vy *= 0.8; }
      }
    }
    function decide(o) {
      outcome = o; st = 'after'; wait = 2.0;
      const scored = o === 'goal'; res[kicker].push(scored);
      const good = kicker === 0 ? scored : !scored;   // good for you
      cheer = good ? T : -9;
      const txt2 = kicker === 0 ? { goal: t('mg_s_goal'), saved: t('mg_s_saved'), post: t('mg_s_post'), over: t('mg_s_over'), wide: t('mg_s_wide') }[o] : scored ? t('mg_s_conceded') : o === 'saved' ? t('mg_s_isave') : { post: t('mg_s_post'), over: t('mg_s_over'), wide: t('mg_s_wide') }[o];
      say(txt2, '', good ? '#ffe066' : '#fff', 1.5);
      Sound.play(good ? 'cheer' : 'pop');
      // is it over? (one side can't catch up any more, or everyone has kicked: level is a draw, v0.34)
      const g0 = goals(0), g1 = goals(1), n0 = res[0].length, n1 = res[1].length;
      if (g0 + (C.kicks - n0) < g1 || g1 + (C.kicks - n1) < g0) over = true;
      if (n0 >= C.kicks && n1 >= C.kicks) over = true;
    }
    function next() {
      if (over) return finish({ won: goals(0) > goals(1) ? true : goals(0) < goals(1) ? false : null, me: goals(0), them: goals(1) });
      kicker = 1 - kicker; setUp();
    }
    function input(sw) {
      if (kicker === 0) {
        swipes++;
        if (st !== 'ready') return;
        let tx, tz, Tf;
        if (sw.tap || sw.dy > -14) { tx = rnd(-0.5, 0.5); tz = 0.4; Tf = 1.15; }
        else { const a = Math.atan2(sw.dx, -sw.dy), lf = sw.len / (H * 0.3); tx = a / 0.32 * C.gw + rnd(-0.15, 0.15); tz = cl((lf - 0.3) * 2.4, 0.12, 4.2) + rnd(-0.1, 0.1); Tf = 0.8; }
        ball.aim = [tx, tz, Tf]; st = 'run'; runT = T;
        return;
      }
      // in goal: dive to where you tap
      taps++;
      if (kp.dive || st === 'after') return;
      const q = onPlane(sw.x, sw.y, C.line - 0.4); tapAt = { x: q.x, z: q.z, t: T };
      dive(q.x, q.z);
    }
    function drawGoal(front) {
      const L = C.line, gw = C.gw, gh = C.gh, back = L + 2, bt = 1.9, wcol = '#fbfbf7';
      if (!front) {
        const ny = netHit && T - netHit.t < 0.6 ? (1 - (T - netHit.t) / 0.6) * 0.5 : 0;
        gpoly([[-gw, back, 0], [gw, back, 0], [gw, back, bt], [-gw, back, bt]], 'rgba(255,255,255,.12)');
        ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = -gw; x <= gw + 0.01; x += 0.3) { const bu = netHit ? Math.exp(-Math.pow(x - netHit.x, 2)) * ny : 0, p1 = P(x, back + bu, 0), p2 = P(x, back + bu, bt), p3 = P(x, L, gh); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); }
        for (let z = 0.3; z < bt; z += 0.3) { const p1 = P(-gw, back, z), p2 = P(gw, back, z); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); }
        for (let y = L + 0.3; y < back; y += 0.3) { const zt = gh + (bt - gh) * (y - L) / (back - L), p1 = P(-gw, y, zt), p2 = P(gw, y, zt); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); [-gw, gw].forEach(x => { const q1 = P(x, y, 0), q2 = P(x, y, zt); ctx.moveTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); }); }
        ctx.stroke();
        return;
      }
      post(-gw, L, 0, gh, 0.12, wcol); post(gw, L, 0, gh, 0.12, wcol); seg3([-gw, L, gh], [gw, L, gh], 0.12, wcol);
      seg3([-gw, L, gh], [-gw, back, bt], 0.04, '#cfd4d8'); seg3([gw, L, gh], [gw, back, bt], 0.04, '#cfd4d8');
    }
    function draw() {
      cam();
      ctx.fillStyle = '#6fb44e'; ctx.fillRect(0, 0, W, H);
      sky(P(0, 32).y);
      for (let y = -9, i = 0; y < 26; y += 2.2, i++) if (i % 2) grect(-40, y, 40, Math.min(26, y + 2.2), '#66aa47');
      treeLine(32, -34, 34, 3.2, 6.5);
      // boards behind the goal
      for (let x = -14, i = 0; x < 14; x += 3.5, i++) gpoly([[x, 16, 0], [x + 3.4, 16, 0], [x + 3.4, 16, 0.9], [x, 16, 0.9]], ['#e5484d', '#38a3e0', '#f2c230', '#34b27b'][i % 4]);
      const Lw = 0.1, wc = 'rgba(255,255,255,.9)';
      gline([-24, C.line], [24, C.line], Lw, wc);
      [[-9.16, 5.5, 9.16, 5.5], [-9.16, 5.5, -9.16, C.line], [9.16, 5.5, 9.16, C.line], [-20.16, -5.5, 20.16, -5.5], [-20.16, -5.5, -20.16, C.line], [20.16, -5.5, 20.16, C.line]].forEach(([a, b, c2, d]) => gline([a, b], [c2, d], Lw, wc));
      garc(0, 0, 0.14, 0, Math.PI * 2, 0.22, wc, 12);
      drawGoal(false);
      if (ball && ball.y > C.line) { shadow(ball.x, ball.y, 0.18); const p = P(ball.x, ball.y, ball.z); football(p.x, p.y, Math.max(3, C.br * p.k), ball.rot); }
      // the keeper
      const K = keeper(), kL = kicker ? S.me.look : mate.look;
      const handsUp = kp.dive ? [[-3, -33], [3, -33]] : [[-7.5, -19 - Math.sin(T * 3.2) * 1], [7.5, -19 + Math.sin(T * 3.2) * 1]];
      townie(kL, K.fx, C.line - 0.4, { view: 'front', hands: handsUp, rot: K.ang, rotAt: 0, lift: K.fz, seed: kicker ? 3 : 5, wave: !kp.dive && T - cheer < 1.4 && kicker === 1 && Math.sin(T * 9) > 0 });
      drawGoal(true);
      if (tapAt && T - tapAt.t < 0.8) { const p = P(tapAt.x, C.line - 0.4, tapAt.z); circle(p.x, p.y, 14 * (1 + (T - tapAt.t)), null, `rgba(255,255,255,${1 - (T - tapAt.t) / 0.8})`, 3); }
      // the kicker: runs up and kicks
      const kL2 = kicker ? mate.look : S.me.look, ru = st === 'run' ? cl((T - runT) / (kicker ? 0.8 : 0.45), 0, 1) : st === 'ready' ? 0 : 1;
      const kx = -1.25 + ru * 0.75, ky = -1.5 + ru * 1.05;
      if (ball && ball.y <= C.line) shadow(ball.x, ball.y, 0.18);
      const ballP = ball && ball.y <= C.line ? P(ball.x, ball.y, ball.z) : null;
      const drawB = () => { if (ballP) football(ballP.x, ballP.y, Math.max(3, C.br * ballP.k), ball.rot); };
      drawB();   // the ball is always further away than the kicker
      townie(kL2, kx, ky, { view: 'back', pose: st === 'run' ? 'run' : 'stand', turn: 0.35, phase: (T - runT) * 16, seed: kicker ? 5 : 3, wave: kicker === 0 && st === 'after' && T - cheer < 1.4 && Math.sin(T * 9) > 0 });
    }
    function hint() {
      if (phase !== 'play') return null;
      if (kicker === 0 && st === 'ready' && swipes < 2) return ['up', W / 2 + 40, H * 0.8, t('mg_s_kick')];
      if (kicker === 1 && !kp.dive && taps < 2 && st !== 'after') { const p = P(-2.2, C.line, 1.2); return ['tap', p.x, p.y, t('mg_s_keep')]; }
      return null;
    }
    function hud() {
      const dots = i => { const r = res[i], n = C.kicks; let s2 = ''; for (let k = 0; k < n; k++) s2 += k < r.length ? (r[k] ? '🟢' : '❌') : '⚪'; return `<small class="mg-dots">${s2}</small>`; };
      return { me: goals(0), them: goals(1), meSub: dots(0), themSub: dots(1), mid: `⚽ ${t('mg_s_title')}` };
    }
    setUp();
    return { step, draw, input, hint, hud, dbg: () => ({ st, kicker, res, ball, kp, outcome }) };
  }

  // =========================================================================== bowling (v0.38)
  function Bowling() {
    const C = { lw: 1.05, gut: 0.24, len: 18.29, br: 0.109, pr: 0.06, ph: 0.38, deck: 19.3, frames: VENUE_GAMES.bowling.frames, strike: VENUE_GAMES.bowling.strike, spare: VENUE_GAMES.bowling.spare };
    const sk = mate.skill, SP = 0.3048, RW2 = 0.264;
    const SPOTS = [[0, 0], [-SP / 2, RW2], [SP / 2, RW2], [-SP, 2 * RW2], [0, 2 * RW2], [SP, 2 * RW2], [-SP * 1.5, 3 * RW2], [-SP / 2, 3 * RW2], [SP / 2, 3 * RW2], [SP * 1.5, 3 * RW2]];
    let who = 0, frame = 0, ball2 = 0, st = 'ready', wait = 0, pins = [], ball = null, camY = 0, runT = -9, aim = null, settleT = 0, sayT = -9, lastBall = 0, rolls = 0;
    const card = [[], []];   // each frame: [first, second] pins down
    const fresh = () => SPOTS.map(([x, dy], i) => ({ i, x, y: C.len + dy, vx: 0, vy: 0, down: false, fall: 0, fa: 0, gone: false, up: true }));
    function setUp(newFrame) {
      if (newFrame) pins = fresh(); else pins = pins.filter(p => !p.down && !p.gone).map(p => ({ ...p, vx: 0, vy: 0 }));
      ball = null; camY = 0; st = 'ready'; runT = -9; aim = null; wait = who ? 1.1 : 0;
      say(who ? t('mg_b_turn_them', { name: mate.name }) : t('mg_b_turn_me'), t('mg_w_frame', { i: frame + 1, n: C.frames }) + (ball2 ? ' · ' + t('mg_w_ball2') : ''), '#fff', 1.1);
    }
    function score(i) {
      let s = 0; card[i].forEach(f => { const a = f[0] || 0, b = f[1] || 0; s += a + b; if (a === 10) s += C.strike; else if (a + b === 10 && f.length > 1) s += C.spare; });
      return s;
    }
    function release(x, slope, v) {
      ball = { x: cl(x, -C.lw / 2 + 0.05, C.lw / 2 - 0.05), y: 0.2, vx: slope * v, vy: v, gut: 0, rot: 0 };
      st = 'roll'; Sound.play('bounce'); rolls++;
    }
    function aiRoll() {
      const left = pins.filter(p => !p.down);
      let tx = 0.07;   // the pocket, just right of the head pin
      if (ball2 && left.length) tx = left.reduce((a, p) => a + p.x, 0) / left.length;
      const err = 0.04 + (1 - sk) * 0.16, x0 = cl(tx * 0.3 + gauss() * err * 0.6, -0.45, 0.45), aimX = tx + gauss() * err;
      const v = 7.2 + gauss() * 0.5;
      release(x0, (aimX - x0) / C.len, v);
    }
    function step(dt) {
      if (st === 'ready' && who && (wait -= dt) <= 0) { st = 'run'; runT = T; }
      if (st === 'run' && T - runT >= 0.55) { if (who) aiRoll(); else release(aim[0], aim[1], aim[2]); }
      if (ball) roll(dt);
      if (st === 'roll' || st === 'settle') movePins(dt);
      if (st === 'roll' && ball && ball.y > C.deck + 0.5) { st = 'settle'; settleT = T; }
      if (st === 'settle' && (T - settleT > 2.6 || (T - settleT > 0.9 && pins.every(p => Math.hypot(p.vx, p.vy) < 0.05)))) count();
      if (st === 'after' && (wait -= dt) <= 0) next();
      const goal = ball && st !== 'after' ? cl(ball.y - 2, 0, C.len - 2.6) : st === 'after' || st === 'settle' ? C.len - 2.6 : 0;
      camY += (goal - camY) * Math.min(1, dt * (st === 'ready' ? 6 : 2.2));
    }
    function roll(dt) {
      const b = ball, n = 4, h = dt / n;
      for (let k = 0; k < n; k++) {
        b.x += b.vx * h; b.y += b.vy * h; b.rot += b.vy * h / C.br;
        if (!b.gut && Math.abs(b.x) > C.lw / 2 + 0.03 && b.y < C.deck) { b.gut = Math.sign(b.x); b.vx = 0; Sound.play('pop'); if (!sayT || T - sayT > 1) { say(t('mg_w_gutter'), '', '#fff', 1.2); sayT = T; } }
        if (b.gut) { b.x += (b.gut * (C.lw / 2 + C.gut / 2) - b.x) * Math.min(1, h * 12); continue; }
        pins.forEach(p => {
          if (p.gone) return;
          const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy), m = C.br + C.pr;
          if (d >= m || d < 1e-6) return;
          const nx = dx / d, ny = dy / d, rel = (b.vx - p.vx) * nx + (b.vy - p.vy) * ny;
          if (rel <= 0) return;
          p.vx += nx * rel * 0.75 + (Math.random() - 0.5) * 0.3; p.vy += ny * rel * 0.75; b.vx -= nx * rel * 0.32; b.vy -= ny * rel * 0.22;
          p.x = b.x + nx * m; p.y = b.y + ny * m; hit(p);
          Sound.play('crunch');
        });
      }
    }
    function hit(p) { if (!p.down) { p.down = true; p.fa = Math.atan2(p.vx, p.vy); if (T - (hit.t || -9) > 0.05) { hit.t = T; Sound.play('pin'); } } }   // v0.49: each pin clatters as it goes down
    function movePins(dt) {
      const n = 3, h = dt / n;
      for (let k = 0; k < n; k++) {
        pins.forEach(p => {
          if (p.gone) return;
          p.x += p.vx * h; p.y += p.vy * h;
          const sp = Math.hypot(p.vx, p.vy); if (sp > 0) { const f = Math.max(0, sp - (p.down ? 5.5 : 3) * h) / sp; p.vx *= f; p.vy *= f; }
          if (Math.abs(p.x) > C.lw / 2 + C.gut + 0.35) { p.x = Math.sign(p.x) * (C.lw / 2 + C.gut + 0.35); p.vx *= -0.3; p.vy *= 0.6; }   // the side boards
          if (p.y > C.deck + 0.2 || Math.abs(p.x) > C.lw / 2 + 0.08 && p.down && sp < 0.3) { p.gone = true; p.down = true; }   // into the pit or the gutter
          if (p.down) p.fall = Math.min(1, p.fall + h * 4.5);
        });
        for (let i = 0; i < pins.length; i++) for (let j = i + 1; j < pins.length; j++) {
          const a = pins[i], b = pins[j]; if (a.gone || b.gone) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = C.pr * 2 + (a.down || b.down ? 0.05 : 0);
          if (d >= m || d < 1e-6) continue;
          const nx = dx / d, ny = dy / d, rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (rel <= 0) continue;
          const imp = rel * 0.85; a.vx -= nx * imp; a.vy -= ny * imp; b.vx += nx * imp; b.vy += ny * imp;
          if (imp > 1.1) { hit(a); hit(b); } else if (imp > 0.55) { if (Math.random() < 0.6) hit(b); }
        }
      }
    }
    function count() {
      const before = ball2 ? 10 - (card[who][frame][0] || 0) : 10, standing = pins.filter(p => !p.down && !p.gone).length, got = before - standing;
      const f = card[who][frame] = card[who][frame] || []; f.push(got);
      const mine = who === 0, strike = !ball2 && got === 10, spare = ball2 && standing === 0;
      say(strike ? t('mg_w_strike') : spare ? t('mg_w_spare') : got ? t('mg_w_pins', { n: got }) : t('mg_w_none'), strike ? `+${C.strike}` : spare ? `+${C.spare}` : '', strike || spare ? '#ffe066' : '#fff', 1.5);
      if (strike || spare) { Sound.play('pins'); Sound.play(mine ? 'cheer' : 'pop'); }   // v0.49: the crash of a strike
      lastBall = { strike, spare, done: strike || ball2 === 1 };
      st = 'after'; wait = strike || spare ? 1.9 : 1.4;
    }
    function next() {
      if (!lastBall.done) { ball2 = 1; return setUp(false); }
      ball2 = 0;
      if (who === 1) { frame++; if (frame >= C.frames) return finish({ won: score(0) > score(1) ? true : score(0) < score(1) ? false : null, me: score(0), them: score(1) }); }
      who = 1 - who; setUp(true);
    }
    function input(sw) {
      if (who !== 0 || st !== 'ready') return;
      if (sw.tap || sw.dy > -20) return;
      const sx = sw.x - sw.dx, x0 = cl((sx - W / 2) / (W * 0.5) * 0.5, -0.45, 0.45);   // the whole width of the screen is the width of the lane
      const slope = cl(Math.atan2(sw.dx, -sw.dy) * 0.075, -0.05, 0.05) + rnd(-0.003, 0.003), v = cl(5.4 + sw.len / (H * 0.4) * 3.2, 5.4, 9.5);
      aim = [x0, slope, v]; st = 'run'; runT = T;
    }
    function cam() { V.cx = W / 2; V.F = Math.min(W * 1.9, H * 0.95) * (1 + camY * 0.045); V.D = 9 - camY; V.h = 3.2 - camY * 0.1; V.hor = H * 0.33; }
    function drawPin(p) {
      const q = P(p.x, p.y, 0), k = q.k, hp = C.ph * k, s = Math.max(0.6, k * 0.012);
      if (p.y > C.deck + 0.4) return;
      ctx.save(); ctx.translate(q.x, q.y);
      if (p.down) { const a = p.fall * Math.PI / 2 * (Math.sin(p.fa) >= 0 ? 1 : -1); ctx.rotate(a * (0.7 + 0.3 * Math.abs(Math.sin(p.fa)))); }
      ellipse(0, 0, 0.07 * k, 0.03 * k, 'rgba(0,0,0,.18)');
      ellipse(0, -hp * 0.3, 0.06 * k, hp * 0.3, '#fbfbf7', 'rgba(0,0,0,.15)', s);
      rrect(-0.026 * k, -hp * 0.78, 0.052 * k, hp * 0.3, 0.02 * k, '#fbfbf7');
      circle(0, -hp * 0.86, 0.034 * k, '#fbfbf7', 'rgba(0,0,0,.12)', s);
      rrect(-0.028 * k, -hp * 0.66, 0.056 * k, hp * 0.035, 0.005 * k, '#c9433b'); rrect(-0.028 * k, -hp * 0.6, 0.056 * k, hp * 0.035, 0.005 * k, '#c9433b');
      circle(-0.012 * k, -hp * 0.9, 0.01 * k, 'rgba(255,255,255,.9)');
      ctx.restore();
    }
    function drawBall() {
      if (!ball || ball.y > C.deck + 1.2) return;
      const q = P(ball.x, ball.y, C.br), r = Math.max(2, C.br * q.k), col = who ? '#c9433b' : '#3a4cc0';
      const g0 = P(ball.x, ball.y, 0); ellipse(g0.x, g0.y, r * 0.9, r * 0.32, 'rgba(0,0,0,.22)');
      circle(q.x, q.y, r, col, 'rgba(0,0,0,.3)', 1);
      const a = ball.rot; [[0, -0.45], [0.3, -0.25], [-0.3, -0.25]].forEach(([dx, dy]) => { const yy = dy * Math.cos(a) * r; if (Math.cos(a) > -0.2) circle(q.x + dx * r, q.y + yy, r * 0.12, '#141a3a'); });
      circle(q.x - r * 0.35, q.y - r * 0.4, r * 0.28, 'rgba(255,255,255,.3)');
    }
    function lane(cx, tone) {   // a lane: maple boards, the arrows, gutters, the deck and the pit
      const L = C.lw / 2;
      grect(cx - L - C.gut - 0.12, -6, cx + L + C.gut + 0.12, C.deck + 1.6, '#2a2f45');
      grect(cx - L - C.gut, -0.3, cx - L, C.deck, '#6b7280'); grect(cx + L, -0.3, cx + L + C.gut, C.deck, '#6b7280');
      grect(cx - L, -6, cx + L, C.deck, tone);
      grect(cx - L, -6, cx + L, -0.02, shade(tone, 0.06));
      for (let b = 1; b < 8; b++) { const xx = cx - L + b * C.lw / 8; gline([xx, -6], [xx, C.deck], 0.008, 'rgba(150,100,55,.35)'); }
      gline([cx - L, 0], [cx + L, 0], 0.03, '#c9433b');
      [-2, -1, 0, 1, 2].forEach(a => { const ax = cx + a * 0.15, ay = 4.6 + (2 - Math.abs(a)) * 0.25; gpoly([[ax, ay + 0.18], [ax - 0.04, ay], [ax + 0.04, ay]], '#6b4428'); });
      [-0.3, -0.15, 0, 0.15, 0.3].forEach(a => { const q = P(cx + a, 2.1, 0); circle(q.x, q.y, Math.max(1, 0.015 * q.k), '#6b4428'); });
      grect(cx - L - C.gut, C.deck, cx + L + C.gut, C.deck + 1.6, '#141826');
    }
    function draw() {
      cam();
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#141a3a'); g.addColorStop(1, '#2a2f55'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // the wall over the pins: dark blue with stars and the alley's name
      const wTop = P(0, C.deck + 1.6, 2.4), wBot = P(0, C.deck + 1.6, 0.55), half = 6 * wTop.k;
      ctx.fillStyle = '#1d2547'; ctx.fillRect(0, wTop.y, W, wBot.y - wTop.y);
      for (let s = 0; s < 26; s++) { const xx = (s * 97.3 + 13) % W, yy = wTop.y + ((s * 41.7) % Math.max(1, wBot.y - wTop.y)); circle(xx, yy, 1 + (s % 3) * 0.4, `rgba(255,230,140,${0.4 + 0.4 * Math.sin(T * 2 + s)})`); }
      txt('MIRROR BOWL', W / 2, wTop.y + (wBot.y - wTop.y) * 0.35, Math.max(10, half * 0.12), '#ff7ac4');
      lane(-1.75, '#d9a868'); lane(1.75, '#d9a868'); lane(0, '#e3b77c');
      // the pins on the lanes either side (just standing), then yours from the back to the front, the ball among them
      [-1.75, 1.75].forEach(cx => SPOTS.slice().reverse().forEach(([x, dy]) => drawPin({ x: cx + x, y: C.len + dy, down: false })));
      const things = pins.filter(p => !p.gone).map(p => ({ y: p.y, f: () => drawPin(p) }));
      if (ball) things.push({ y: ball.y, f: drawBall });
      things.sort((a, b) => b.y - a.y).forEach(o => o.f());
      // the bowler on the approach
      const L = who ? mate.look : S.me.look, ru = st === 'run' ? cl((T - runT) / 0.55, 0, 1) : st === 'ready' ? 0 : 1;
      const bx = (aim && !who ? aim[0] : 0) - 0.42, by = -1.6 + ru * 1.1;
      if (by + V.D > 2) townie(L, bx, by, { scale: 0.62, view: 'back', pose: st === 'run' ? 'run' : 'stand', phase: (T - runT) * 14, seed: who ? 5 : 3, wave: st === 'after' && lastBall && (lastBall.strike || lastBall.spare) && Math.sin(T * 9) > 0 });
      if ((st === 'ready' || st === 'run') && by + V.D > 2) { const q = P(bx + 0.42, by + 0.15, 0.25); circle(q.x, q.y, Math.max(3, C.br * q.k), who ? '#c9433b' : '#3a4cc0', 'rgba(0,0,0,.3)', 1); }
    }
    function hint() {
      if (phase !== 'play' || who !== 0 || st !== 'ready' || rolls > 2) return null;
      return ['up', W / 2, H * 0.84, t('mg_w_roll')];
    }
    function hud() {
      const line2 = i => `<small class="mg-dots">${card[i].map(f => (f[0] === 10 ? 'X' : (f[0] || '-') + (f.length > 1 ? (f[0] + f[1] === 10 ? '/' : (f[1] || '-')) : ''))).join(' ')}</small>`;
      return { me: score(0), them: score(1), meSub: line2(0), themSub: line2(1), mid: `🎳 ${t('mg_w_frame', { i: Math.min(frame + 1, C.frames), n: C.frames })}` };
    }
    setUp(true);
    return { step, draw, input, hint, hud, dbg: () => ({ st, who, frame, ball2, card, pins: pins.map(p => ({ x: p.x, y: p.y, down: p.down })), ball, camY }) };
  }

  // =========================================================================== a swimming race (v0.38)
  function Race() {
    const LEN = VENUE_GAMES.race.len, LANE = 2.5, sk = mate.skill;
    const sw = [   // lane x, who, the target pace for the others
      { x: -LANE * 1.5, look: FOLK_RACE[0], v0: rnd(1.45, 1.95) }, { x: -LANE * 0.5, me: true }, { x: LANE * 0.5, mate: true, v0: 1.5 + sk * 0.62 + gauss() * 0.06 }, { x: LANE * 1.5, look: FOLK_RACE[1], v0: rnd(1.45, 1.95) },
    ].map(s => ({ ...s, y: -0.6, v: 0, t: 0, done: 0, stroke: 0, in: false }));
    const me = sw[1], them = sw[2];
    let st = 'set', goAt = 1.6 + rnd(0.4, 1.3), side = 0, taps = 0, early = 0, pen = 0, camY = 0;
    say(t('mg_r_set'), '', '#fff', 1.4);
    function swimOn(s, dt) {
      if (!s.in) return;
      if (s.me) { s.v -= s.v * 0.85 * dt; s.v = Math.max(s.v, 0.25); }
      else { const target = s.v0 * (s.y < 3 ? 1.25 : 1) * (1 + Math.sin(T * 1.3 + s.x) * 0.04); s.v += (target - s.v) * Math.min(1, dt * 1.5); }
      s.y += s.v * dt; s.stroke += s.v * dt * 1.8;
      if (s.y >= LEN && !s.done) { s.y = LEN; s.done = T - goAt; s.v = 0; if (s === me || s === them) Sound.play(s === me ? 'clang' : 'pop'); }
    }
    function step(dt) {
      if (st === 'set' && T >= goAt) { st = 'go'; say(t('mg_r_go'), '', '#ffe066', 0.9); Sound.play('tap'); sw.forEach(s => { if (!s.me) { s.in = true; s.v = 2.2; s.y = 0.5; } }); }
      if (st === 'go') sw.forEach(s => { if (s.in && !s.done) swimOn(s, dt); });
      if (st === 'go' && me.in && them.done && me.done) { st = 'end'; setTimeout(() => finish({ won: me.done < them.done, me: me.done.toFixed(1) + '″', them: them.done.toFixed(1) + '″', time: me.done }), 900); }
      if (st === 'go' && !me.in && T - goAt > 6) { me.in = true; me.v = 1.2; me.y = 0.3; }   // (in you go)
      camY += (cl(me.y - 3, 0, LEN - 9) - camY) * Math.min(1, dt * 2.5);
    }
    function input(s2) {
      if (st === 'set') { if (!early) { early = 1; say(t('mg_r_early'), t('mg_r_early2'), '#fff', 1.2); Sound.play('oops'); pen = 0.6; } return; }
      if (st !== 'go' || me.done) return;
      if (!me.in) { if (T - goAt < pen) return; const quick = T - goAt < 0.35 + pen; me.in = true; me.v = quick ? 2.6 : 2.1; me.y = 0.6; Sound.play('splash'); if (quick) say(t('mg_r_great'), '', '#ffe066', 0.8); return; }
      const sd = s2.x < W / 2 ? 1 : 2; taps++;
      if (sd === side) { me.v *= 0.72; pop(t('mg_r_same'), s2.x, s2.y - 30, '#fff'); }
      else { me.v = Math.min(2.55, me.v + 0.5); if (taps % 4 === 0) Sound.play('splash'); }
      side = sd;
    }
    function cam() { V.cx = W / 2; V.F = Math.min(W * 1.15, H * 0.62); V.D = 4 - camY; V.h = 4.2; V.hor = H * 0.3; }
    function draw() {
      cam();
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#dfeef6'); g.addColorStop(1, '#bcdcec'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const half = LANE * 2;
      // the far wall: the clock and the flags
      const fw = P(0, LEN + 1.2, 3.2), fb = P(0, LEN + 1.2, 0); ctx.fillStyle = '#f4f7f9'; ctx.fillRect(0, fw.y, W, fb.y - fw.y);
      rrect(W / 2 - 40, fw.y + 6, 80, 22, 4, '#141a3a'); txt(st === 'set' ? '0.0' : ((me.done || T - goAt) > 0 ? (me.done || T - goAt).toFixed(1) : '0.0'), W / 2, fw.y + 17, 15, '#ffd36b');
      grect(-half - 2, -3, half + 2, LEN + 1.2, '#e8f1f5');
      grect(-half, 0, half, LEN, '#2fa6d6');
      for (let k = 0; k < 4; k++) { const cx = -half + (k + 0.5) * LANE; grect(cx - 0.1, 1.5, cx + 0.1, LEN - 1.5, 'rgba(20,60,110,.4)'); grect(cx - 0.5, LEN - 1.5, cx + 0.5, LEN - 1.3, 'rgba(20,60,110,.4)'); }
      for (let k = 0; k < 26; k++) { const u = (k * 0.37 + T * 0.05) % 1, v = (k * 0.61) % 1, q = P(-half + u * half * 2, v * LEN, 0); ellipse(q.x, q.y, 0.4 * q.k, 0.08 * q.k, 'rgba(255,255,255,.3)'); }
      for (let k = 1; k < 4; k++) { const xx = -half + k * LANE; for (let y = 0.3; y < LEN; y += 0.45) { const q = P(xx, y, 0.03); circle(q.x, q.y, Math.max(1, 0.06 * q.k), y < 5 || y > LEN - 5 ? '#e5484d' : Math.round(y / 0.45) % 2 ? '#ffffff' : '#2f6fb2'); } }
      [5, LEN - 5].forEach(fy => { seg3([-half - 1, fy, 1.8], [half + 1, fy, 1.8], 0.02, '#9aa3ad'); for (let x = -half; x < half; x += 0.5) { const a = P(x, fy, 1.8), b = P(x + 0.25, fy, 1.5), c = P(x + 0.5, fy, 1.8); pg([[a.x, a.y], [b.x, b.y], [c.x, c.y]], Math.round(x * 2) % 2 ? '#e5484d' : '#2f6fb2'); } });
      // the swimmers, the far ones first
      sw.slice().sort((a, b) => b.y - a.y).forEach(s => {
        const L = s.me ? S.me.look : s.mate ? mate.look : s.look;
        if (!s.in) { townie(L, s.x, -0.6, { view: 'back', lift: 0.45, seed: s.me ? 3 : 5 }); return; }
        if (s.v > 0.2 && !s.done) { const q = P(s.x, s.y - 0.5, 0); for (let k = 0; k < 3; k++) circle(q.x + (k - 1) * 0.18 * q.k, q.y + Math.sin(T * 20 + k) * 0.04 * q.k, Math.max(1, 0.08 * q.k), 'rgba(255,255,255,.8)'); }
        townie(L, s.x, s.y, { pose: 'swim', view: 'back', ts: s.stroke * 520, seed: s.me ? 3 : 5 });
        if (s.done && (s.me || s.mate)) { const q = P(s.x, s.y, 1.2); txt(s.done.toFixed(1) + '″', q.x, q.y, 13, s.me ? '#ffe066' : '#fff'); }
      });
      // the starting blocks
      sw.forEach((s, i) => { gpoly([[s.x - 0.3, -0.9, 0.45], [s.x + 0.3, -0.9, 0.45], [s.x + 0.3, -0.3, 0.45], [s.x - 0.3, -0.3, 0.45]], '#f4f4f0'); const q = P(s.x, -0.3, 0.3); txt(String(i + 1), q.x, q.y, 11, '#2d2d2d'); });
    }
    function hint() {
      if (phase !== 'play') return null;
      if (st === 'set') return null;
      if (!me.in) return ['tap', W / 2, H * 0.7, t('mg_r_dive')];
      if (taps < 8 && !me.done) return ['tap', side === 1 ? W * 0.75 : W * 0.25, H * 0.8, t(side === 1 ? 'mg_r_right' : 'mg_r_left')];
      return null;
    }
    function hud() {
      const m = s => (s.done ? s.done.toFixed(1) + '″' : `${Math.max(0, Math.floor(s.y))}m`);
      return { me: m(me), them: m(them), mid: `🏊 ${LEN}m` };
    }
    return { step, draw, input, hint, hud, dbg: () => ({ st, me: { ...me }, them: { ...them }, goAt }) };
  }
  const FOLK_RACE = [{ skin: '#d39a6c', hair: 'short', hairCol: '#2b1d14', mob: 'walk', body: 'regular', shirt: '#34b27b' }, { skin: '#ffe0c4', hair: 'long', hairCol: '#e9cf7a', mob: 'walk', body: 'regular', shirt: '#a46ef0' }];

  // =========================================================================== mini golf (v0.41, the amusement park)
  // Three holes: a straight one with two posts, a corner to bank off, one with a windmill whose sails close the gap.
  // Pull back from anywhere and let go (further back = harder); the ball rolls, bounces off the edges and drops in if
  // it isn't going too fast. You play a hole, then they do; fewest strokes wins (at most 6 a hole).
  function Golf() {
    const GG = VENUE_GAMES.golf, sk = mate.skill, R = 0.075, CUP = 0.13, FR = 1.35;
    const HOLES = [
      { pts: [[-1.6, 0], [1.6, 0], [1.6, 9], [-1.6, 9]], tee: [0, 0.8], cup: [0, 8.1], posts: [[-0.6, 4.2], [0.65, 5.7]] },
      { pts: [[-1.6, 0], [1.6, 0], [1.6, 5.4], [5.8, 5.4], [5.8, 8.4], [-1.6, 8.4]], tee: [0, 0.8], cup: [4.7, 6.9], posts: [], via: [0, 6.9] },
      { pts: [[-1.6, 0], [1.6, 0], [1.6, 10], [-1.6, 10]], tee: [0, 0.8], cup: [0, 9.1], posts: [], mill: 6 },
    ];
    let hi = 0, who = 0, st = 'aim', ball = null, wait = 0, aim = null, trail = [], aiAt = 0, shots = 0;
    const strokes = [[0, 0, 0], [0, 0, 0]], hole = () => HOLES[hi];
    const total = w => strokes[w].reduce((a, b) => a + b, 0);
    function walls() { const H2 = hole(), out = H2.pts.map((p, i) => [p, H2.pts[(i + 1) % H2.pts.length]]); if (H2.mill) out.push([[-1.6, H2.mill], [-0.42, H2.mill]], [[0.42, H2.mill], [1.6, H2.mill]]); return out; }
    const sail = () => T * 1.1, millShut = () => { const psi = ((sail() + Math.PI / 2) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2); return psi < 0.36 || psi > Math.PI / 2 - 0.36; };
    function reset() { const H2 = hole(); ball = { x: H2.tee[0], y: H2.tee[1], vx: 0, vy: 0, in: false }; st = who === 0 ? 'aim' : 'ai'; aiAt = T + 1.1; trail = []; }
    reset(); say(t('mg_g_hole', { i: 1 }), '', '#fff', 1.2);
    function shoot(dx, dy, sp) { const n = Math.hypot(dx, dy) || 1; ball.vx = dx / n * sp; ball.vy = dy / n * sp; strokes[who][hi]++; st = 'roll'; Sound.play('tap'); if (!who) shots++; }
    function bounce(nx, ny, px, py, rr) { const vn = ball.vx * nx + ball.vy * ny; if (vn < 0) { ball.vx -= 1.75 * vn * nx; ball.vy -= 1.75 * vn * ny; if (-vn > 0.7) Sound.play('pop'); } ball.x = px + nx * rr; ball.y = py + ny * rr; }
    function physics(dt) {
      const v = Math.hypot(ball.vx, ball.vy);
      if (v > 0) { const nv = Math.max(0, v - FR * dt); ball.vx *= nv / v; ball.vy *= nv / v; }
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      for (const [a, b] of walls()) {
        const ex = b[0] - a[0], ey = b[1] - a[1], u = cl(((ball.x - a[0]) * ex + (ball.y - a[1]) * ey) / (ex * ex + ey * ey), 0, 1), qx = a[0] + ex * u, qy = a[1] + ey * u, d = Math.hypot(ball.x - qx, ball.y - qy);
        if (d < R && d > 1e-6) bounce((ball.x - qx) / d, (ball.y - qy) / d, qx, qy, R);
      }
      for (const [px, py] of hole().posts) { const d = Math.hypot(ball.x - px, ball.y - py), rr = R + 0.17; if (d < rr) bounce((ball.x - px) / d, (ball.y - py) / d, px, py, rr); }
      const H2 = hole();
      if (H2.mill && Math.abs(ball.y - H2.mill) < R * 1.5 && Math.abs(ball.x) < 0.42 && millShut() && ball.vy > 0) { ball.vy = -ball.vy * 0.55; ball.y = H2.mill - R * 1.5; Sound.play('pop'); }
      const dc = Math.hypot(ball.x - H2.cup[0], ball.y - H2.cup[1]), sp = Math.hypot(ball.vx, ball.vy);
      if (dc < CUP && sp < 2.6) { ball.in = true; ball.x = H2.cup[0]; ball.y = H2.cup[1]; ball.vx = ball.vy = 0; }
      else if (dc < CUP * 0.7) { ball.vx += (ball.x - H2.cup[0]) * 3; ball.vy += (ball.y - H2.cup[1]) * 3; }   // too fast: it hops over the lip
    }
    function step(dt) {
      if (st === 'roll') {
        for (let k = 0; k < 4; k++) physics(dt / 4);
        trail.push([ball.x, ball.y]); if (trail.length > 24) trail.shift();
        if (ball.in) { st = 'holed'; wait = T + 1.4; const n = strokes[who][hi]; say(n === 1 ? t('mg_g_ace') : t('mg_g_in', { n }), who ? esc(mate.name) : '', who ? '#fff' : '#ffe066', 1.3); Sound.play(n <= 2 ? 'cheer' : 'clang'); }
        else if (Math.hypot(ball.vx, ball.vy) < 0.04) {
          ball.vx = ball.vy = 0; trail = [];
          if (strokes[who][hi] >= GG.max) { strokes[who][hi] = GG.max + 1; st = 'holed'; wait = T + 1.2; say(t('mg_g_pick'), '', '#fff', 1.1); }
          else { st = who ? 'ai' : 'aim'; aiAt = T + 0.9; }
        }
      } else if (st === 'ai' && T > aiAt) {
        const H2 = hole(), tgt = H2.via && ball.y < 5.3 ? H2.via : H2.cup;
        const dx = tgt[0] - ball.x, dy = tgt[1] - ball.y, d = Math.hypot(dx, dy), ang = Math.atan2(dx, dy) + (1 - sk) * 0.13 * gauss();
        const need = Math.sqrt(2 * FR * d) * (tgt === H2.cup ? 1.07 : 1.3) * (1 + (1 - sk) * 0.2 * gauss());
        if (H2.mill && ball.y < H2.mill) {   // they time it so the gap is open when the ball gets there
          const dm = H2.mill - ball.y, tt = (need - Math.sqrt(Math.max(0, need * need - 2 * FR * dm))) / FR;
          const shutAt = x => { const psi = (((T + x) * 1.1 + Math.PI / 2) % (Math.PI / 2) + Math.PI / 2) % (Math.PI / 2); return psi < 0.45 || psi > Math.PI / 2 - 0.45; };
          if (shutAt(tt) || (Math.random() < sk && (shutAt(tt - 0.15) || shutAt(tt + 0.15)))) return;
        }
        shoot(Math.sin(ang), Math.cos(ang), cl(need, 0.8, 7));
      } else if (st === 'holed' && T > wait) {
        if (who === 0) { who = 1; reset(); say(t('mg_g_their', { name: mate.name }), '', '#fff', 1.0); }
        else if (hi < HOLES.length - 1) { hi++; who = 0; reset(); say(t('mg_g_hole', { i: hi + 1 }), '', '#fff', 1.2); }
        else { st = 'end'; const a = total(0), b = total(1); setTimeout(() => finish({ won: a < b ? true : a > b ? false : null, me: a, them: b, strokes: a }), 700); }
      }
    }
    // from the screen back to the green
    function ground(sx, sy) { const k = (sy - V.hor) / V.h; return k > 0 ? { x: (sx - V.cx) / k, y: V.F / k - V.D } : null; }
    function aimVec() {
      if (!aim) return null;
      const g0 = ground(aim.x0, aim.y0), g1 = ground(aim.x, aim.y), len = Math.hypot(aim.x - aim.x0, aim.y - aim.y0);
      return g0 && g1 && len > 12 ? { dx: g0.x - g1.x, dy: g0.y - g1.y, p: cl(len / (H * 0.32), 0.05, 1) } : null;
    }
    function ptr(type, x, y) {
      if (st !== 'aim') { aim = null; return; }
      if (type === 'down') aim = { x0: x, y0: y, x, y };
      else if (type === 'move' && aim) { aim.x = x; aim.y = y; }
      else if (type === 'up' && aim) { aim.x = x; aim.y = y; const a = aimVec(); aim = null; if (a) shoot(a.dx, a.dy, a.p * 7); }
    }
    function input() { /* (ptr does it) */ }
    function cam() {
      const H2 = hole(), xs = H2.pts.map(p => p[0]), ys = H2.pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), len = Math.max(...ys);
      fit(-0.7, 0.88, Math.max(2.1, (x1 - x0) / 2 + 0.5), len + 0.4, 0.22, 11);
      V.cx = W / 2 - (x0 + x1) / 2 * (V.F / (len * 0.45 + V.D));
    }
    function draw() {
      cam();
      sky(V.hor + 6, '#bfe6f7', '#eaf7fb');
      { const q = P(-9, 40, 0), r = 5 * q.k; circle(q.x, q.y - r - 4, r, null, 'rgba(240,236,228,.75)', 2); for (let i = 0; i < 8; i++) { const a = T / 9 + i / 8 * Math.PI * 2; circle(q.x + Math.cos(a) * r, q.y - r - 4 + Math.sin(a) * r, 2.5, RIDE_COLS[i]); } }   // the park's wheel, far away
      grect(-40, -4, 40, 60, '#8cc46b');
      treeLine(16, -16, 16, 2.4, 4.2);
      const H2 = hole();
      walls().forEach(([a, b]) => gpoly([[a[0], a[1], 0], [b[0], b[1], 0], [b[0], b[1], 0.16], [a[0], a[1], 0.16]], '#8a5a36'));
      gpoly(H2.pts, '#3fa55a');
      H2.pts.length === 4 && [1.5, 4.5, 7.5].forEach(y => { if (y < H2.pts[2][1] - 0.5) grect(-1.6, y, 1.6, y + 1.2, '#46ad61'); });
      walls().forEach(([a, b]) => seg3([a[0], a[1], 0.16], [b[0], b[1], 0.16], 0.07, '#f4ead8'));
      H2.posts.forEach(([px, py]) => { post(px, py, 0, 0.35, 0.34, '#e5484d'); const q = P(px, py, 0.35); ellipse(q.x, q.y, 0.17 * q.k, 0.07 * q.k, '#f28c8c'); });
      const cp = P(H2.cup[0], H2.cup[1], 0); ellipse(cp.x, cp.y, CUP * cp.k, CUP * 0.42 * cp.k, '#16301d');
      if (!(ball && ball.in)) { post(H2.cup[0], H2.cup[1], 0, 1.1, 0.03, '#f4f4f0'); const f0 = P(H2.cup[0], H2.cup[1], 1.1), f1 = P(H2.cup[0] + 0.35, H2.cup[1], 1.0), f2 = P(H2.cup[0], H2.cup[1], 0.9); pg([[f0.x, f0.y], [f1.x + Math.sin(T * 5) * 1.5, f1.y], [f2.x, f2.y]], '#e5484d'); }
      if (H2.mill) {   // the windmill: a little house over the gap, its sails turning in front
        const m = H2.mill + 0.15;
        gpoly([[-0.8, m, 0], [0.8, m, 0], [0.8, m, 1.0], [-0.8, m, 1.0]], '#f4ead8'); gpoly([[-0.9, m, 1.0], [0.9, m, 1.0], [0, m, 1.6]], '#e5484d');
        gpoly([[-0.42, m - 0.01, 0], [0.42, m - 0.01, 0], [0.42, m - 0.01, 0.4], [-0.42, m - 0.01, 0.4]], '#3b2f28');
        for (let k = 0; k < 4; k++) { const a = sail() + k * Math.PI / 2, hub = [0, m - 0.05, 1.05], tip = [Math.cos(a) * 1.0, m - 0.05, 1.05 + Math.sin(a) * 1.0], sd = [Math.cos(a + 0.25) * 0.9, m - 0.05, 1.05 + Math.sin(a + 0.25) * 0.9];
          const A = P(...hub), B = P(...tip), C = P(...sd); pg([[A.x, A.y], [B.x, B.y], [C.x, C.y]], '#ffffff'); line(A.x, A.y, B.x, B.y, '#8a6a4a', 1.5); }
        const hb = P(0, m - 0.06, 1.05); circle(hb.x, hb.y, 0.08 * hb.k, '#8a6a4a');
      }
      trail.forEach((p, i) => { const q = P(p[0], p[1], 0.02); circle(q.x, q.y, Math.max(1, 0.03 * q.k), `rgba(255,255,255,${i / trail.length * 0.5})`); });
      const L = who ? mate.look : S.me.look;
      if (ball && !ball.in) {
        if (st !== 'roll') { townie(L, ball.x - 0.85, ball.y - 0.1, { view: 'back', turn: [0.6, -1], seed: who ? 5 : 3 }); seg3([ball.x - 0.08, ball.y - 0.02, 0.03], [ball.x - 0.62, ball.y - 0.08, 0.8], 0.03, '#4a4f57'); }
        shadow(ball.x, ball.y, R * 1.2, 0.25); const q = P(ball.x, ball.y, R); circle(q.x, q.y, Math.max(2.5, R * q.k), '#ffffff', '#c9cfd6', 1);
      }
      const a = aimVec();
      if (a) { const n = Math.hypot(a.dx, a.dy) || 1; for (let k = 1; k <= 8; k++) { const u = k / 8 * (0.6 + a.p * 3.4), q = P(ball.x + a.dx / n * u, ball.y + a.dy / n * u, 0.02); circle(q.x, q.y, Math.max(2, 0.05 * q.k), a.p > 0.8 ? '#ff6b6b' : a.p > 0.45 ? '#ffd36b' : '#ffffff'); } }
    }
    function hint() { if (phase !== 'play' || st !== 'aim' || shots > 1 || aim) return null; const q = P(ball.x, ball.y, 0); return ['down', q.x, q.y - 20, t('mg_g_pull')]; }
    function hud() { const row = w => `<small>${strokes[w].map((n, i) => (i <= hi ? n || '·' : '·')).join(' ')}</small>`; return { me: total(0), them: total(1), meSub: row(0), themSub: row(1), mid: `⛳ ${t('mg_g_holeN', { i: hi + 1, n: HOLES.length })}` }; }
    return { step, draw, input, ptr, hint, hud, dbg: () => ({ st, hi, who, ball: { ...ball }, strokes, shut: millShut() }) };
  }

  // =========================================================================== claw machine (v0.41)
  // Seen from the front. Drag left and right to move the claw over a toy, let go to drop it. It closes on whatever is
  // under it: the nearer the middle, the better it holds, and it can still slip on the way up. You and them take turns;
  // most toys wins. The toys you win are yours.
  function Claw() {
    const CG = VENUE_GAMES.claw, sk = mate.skill, keys = Object.keys(MALL.plush), TOY = { plushbear: '#a0703f', plushbunny: '#f4f0ea', plushcat: '#f2a65a', plushdino: '#6fbf73', plushduck: '#f2d24b', plushpanda: '#f4f4f0' };
    let toys = [], claw = { u: 0.55, tu: 0.55, v: 0.06, open: 1, hold: null, slip: false }, who = 0, left = [CG.grabs, CG.grabs], won = [[], []], st = 'aim', wait = 0, falling = [], dragging = false;
    const BX = () => ({ l: W * 0.1, r: W * 0.9, t: H * 0.2, b: H * 0.82 }), X = u => { const B = BX(); return B.l + u * (B.r - B.l); }, Y = v => { const B = BX(); return B.t + v * (B.b - B.t); };
    const RU = 0.085;   // a toy's size (box widths)
    const rV = () => { const B = BX(); return RU * (B.r - B.l) * 0.62 / (B.b - B.t); };   // its radius, in box heights
    function fill() {
      let i = 0; const rv = rV();
      for (let row = 0; row < 3 && toys.length < 13; row++) for (let u = 0.3 + row * 0.04; u < 0.95 && toys.length < 13; u += RU * 1.45) { const v = 0.96 - rv - row * rv * 1.55; if (toys.some(q => Math.abs(q.u - u) < RU * 0.8 && Math.abs(q.v - v) < rv)) continue; toys.push({ k: keys[(i++ * 5 + row) % keys.length], u: u + (hash(u * 9, row) - 0.5) * 0.02, v, rot: (hash(u, row) - 0.5) * 0.7 }); }
    }
    fill();
    const surface = u => { let top = 0.97; const rv = rV(); toys.forEach(tq => { if (Math.abs(tq.u - u) < RU) top = Math.min(top, tq.v - rv); }); return top; };
    function step(dt) {
      falling = falling.filter(f => { f.v += f.sp * dt; f.sp += 2.5 * dt; if (f.v >= f.to) { if (f.into) won[f.who].push(f.k); else toys.push({ k: f.k, u: f.u, v: f.to, rot: f.rot }); return false; } return true; });
      if (st === 'aim' || st === 'ai') { claw.u += (claw.tu - claw.u) * Math.min(1, dt * 6); if (st === 'ai' && T > wait && Math.abs(claw.u - claw.tu) < 0.01) st = 'drop'; return; }
      if (st === 'drop') { claw.v += 0.6 * dt; if (claw.v >= surface(claw.u) - 0.02) { st = 'close'; wait = T + 0.45; Sound.play('tick'); } return; }
      if (st === 'close') {
        claw.open = Math.max(0, (wait - T) / 0.45);
        if (T >= wait) {
          let best = null, bd = 1e9; toys.forEach(tq => { const d = Math.abs(tq.u - claw.u) + Math.max(0, claw.v - tq.v) * 0.2; if (d < bd) { bd = d; best = tq; } });
          const dx = best ? Math.abs(best.u - claw.u) : 1, p = 0.82 - dx / (RU * 1.15) * 0.9 - (who ? (1 - sk) * 0.15 : 0);   // (a real claw machine isn't easy)
          if (best && dx < RU * 1.15 && Math.random() < p) { claw.hold = best; toys = toys.filter(q => q !== best); claw.slip = Math.random() < 0.27; }
          st = 'up';
        }
        return;
      }
      if (st === 'up') {
        claw.v -= 0.5 * dt;
        if (claw.hold && claw.slip && claw.v < 0.45) { falling.push({ k: claw.hold.k, u: claw.u, v: claw.v + 0.08, sp: 0.2, to: surface(claw.u) + 0.02, rot: claw.hold.rot }); claw.hold = null; claw.slip = false; say(t('mg_c_slip'), '', '#fff', 0.9); Sound.play('oops'); }
        if (claw.v <= 0.06) { claw.v = 0.06; st = 'carry'; }
        return;
      }
      if (st === 'carry') { claw.u += (0.09 - claw.u) * Math.min(1, dt * 3); if (Math.abs(claw.u - 0.09) < 0.01) { st = 'drop2'; wait = T + 0.4; claw.open = 1; if (claw.hold) { falling.push({ k: claw.hold.k, u: 0.09, v: 0.12, sp: 0.4, to: 0.92, into: true, who, rot: 0 }); say(who ? t('mg_c_their', { name: mate.name }) : t('mg_c_got'), '', who ? '#fff' : '#ffe066', 1.1); Sound.play(who ? 'pop' : 'cheer'); } else Sound.play('chime'); claw.hold = null; } return; }
      if (st === 'drop2' && T >= wait && !falling.length) {
        left[who]--;
        if (toys.length < 6) fill();
        if (!left[0] && !left[1]) { st = 'end'; const a = won[0].length, b = won[1].length; setTimeout(() => finish({ won: a > b ? true : a < b ? false : null, me: a, them: b, toys: won[0].slice() }), 600); return; }
        who = left[1 - who] ? 1 - who : who; claw.tu = 0.55;
        if (who) { const pick = toys.slice().sort((p, q) => p.v - q.v)[Math.floor(Math.random() * Math.min(4, toys.length))]; claw.tu = cl(pick.u + gauss() * (1 - sk) * 0.05, 0.25, 0.95); st = 'ai'; wait = T + 0.8; }
        else st = 'aim';
      }
    }
    function ptr(type, x) {
      if (st !== 'aim') return;
      const B = BX(), u = cl((x - B.l) / (B.r - B.l), 0.22, 0.96);
      if (type === 'down') { dragging = true; claw.tu = u; }
      else if (type === 'move' && dragging) claw.tu = u;
      else if (type === 'up' && dragging) { dragging = false; claw.tu = u; st = 'drop'; claw.u = u; Sound.play('tap'); }
    }
    function input() { /* (ptr does it) */ }
    function toyAt(k, x, y, s, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
      circle(0, 0, s, TOY[k], shade(TOY[k], -0.35), 1.2); circle(-s * 0.6, -s * 0.75, s * 0.32, TOY[k], shade(TOY[k], -0.35), 1); circle(s * 0.6, -s * 0.75, s * 0.32, TOY[k], shade(TOY[k], -0.35), 1);
      ctx.restore(); emoji(MALL.plush[k], x, y + s * 0.15, s * 1.25);
    }
    function draw() {
      const B = BX(), w = B.r - B.l, s = RU * w * 0.62;
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a1d3f'); bg.addColorStop(1, '#4a2f5f'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 18; i++) circle((i * 97) % W, (i * 53) % (H * 0.15) + 6, 2, i % 2 ? '#ffd36b' : '#ec6aa8');
      rrect(B.l - 16, B.t - 56, w + 32, B.b - B.t + 96, 22, '#ec6aa8', '#b0407a', 3);
      rrect(B.l, B.t - 42, w, 34, 10, '#ffd36b'); txt(`🧸 ${t('mg_c_title')}`, W / 2, B.t - 25, 17, '#7a2a52');
      const gl = ctx.createLinearGradient(0, B.t, 0, B.b); gl.addColorStop(0, '#3a2c55'); gl.addColorStop(1, '#5a4a7a'); ctx.fillStyle = gl; ctx.fillRect(B.l, B.t, w, B.b - B.t);
      ctx.fillStyle = '#6b5a8a'; ctx.fillRect(B.l, Y(0.97), w, B.b - Y(0.97));
      ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(B.l, Y(0.66), X(0.18) - B.l, B.b - Y(0.66)); line(X(0.18), Y(0.66), X(0.18), B.b, '#ffd36b', 3); txt(`⬇ ${t('mg_c_out')}`, X(0.09), Y(0.72), 12, '#ffd36b');
      toys.slice().sort((p, q) => p.v - q.v).forEach(tq => toyAt(tq.k, X(tq.u), Y(tq.v), s, tq.rot));
      falling.forEach(f => toyAt(f.k, X(f.u), Y(f.v), s, f.rot));
      // the rail, the cable and the claw
      line(B.l + 4, Y(0.03), B.r - 4, Y(0.03), '#c9cfd6', 4);
      const cx = X(claw.u), cy = Y(claw.v); rrect(cx - 14, Y(0.03) - 7, 28, 14, 4, '#9aa3ad'); line(cx, Y(0.03), cx, cy - 10, '#2d2d2d', 2);
      if (claw.hold) toyAt(claw.hold.k, cx, cy + s * 0.9, s, claw.hold.rot);
      circle(cx, cy - 8, 10, '#d6d0c4', '#8a9099', 1.5);
      const op = 0.25 + claw.open * 0.65;
      [-1, 1].forEach(k => { ctx.beginPath(); ctx.moveTo(cx + k * 6, cy - 4); ctx.quadraticCurveTo(cx + k * (8 + op * 16), cy + 10, cx + k * (4 + op * 8), cy + 26); ctx.strokeStyle = '#8a9099'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke(); });
      line(cx, cy, cx, cy + 22 - op * 4, '#8a9099', 3);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(B.l + w * 0.55, B.t); ctx.lineTo(B.l + w * 0.75, B.t); ctx.lineTo(B.l + w * 0.4, B.b); ctx.lineTo(B.l + w * 0.2, B.b); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 14; i++) { const on = (Math.floor(T * 4) + i) % 2; circle(B.l - 8 + (w + 16) * i / 13, B.b + 30, 3.5, on ? '#ffd36b' : '#7a2a52'); }
      txt(who ? t('mg_c_turn_them', { name: mate.name }) : t('mg_c_turn_me'), W / 2, B.b + 14, 13, '#fff6d8');
    }
    function hint() { return phase === 'play' && st === 'aim' && left[0] === CG.grabs && !dragging ? ['tap', X(claw.u), Y(0.5), t('mg_c_drag')] : null; }
    function hud() { return { me: `🧸${won[0].length}`, them: `🧸${won[1].length}`, meSub: `<small>${t('mg_c_left', { n: left[0] })}</small>`, themSub: `<small>${t('mg_c_left', { n: left[1] })}</small>`, mid: `🕹️ ${t('mg_c_title')}` }; }
    return { step, draw, input, ptr, hint, hud, dbg: () => ({ st, who, left, won, claw: { ...claw }, toys: toys.length }) };
  }

  // =========================================================================== karaoke (v0.41, the amusement park's stage)
  // A song in two halves: you sing the first, they sing the second. Each note slides in from the right with its word;
  // tap as it reaches the ring (right on it: perfect). The one who hits more of their notes wins.
  function Karaoke() {
    const song = SONGS[Math.floor(Math.random() * SONGS.length)], spb = 60 / song.bpm, LEAD = 2.2, zh = curLang() === 'zh', sk = mate.skill;
    const notes = [], lines = [];
    let tb = 3.2;
    song.lines.forEach(([w, line2]) => { const ln = { w, notes: [] }; line2.forEach(([m, beats, wz, we]) => { const n = { t: tb, m, w, word: zh ? wz : we, beats, judge: null, line: lines.length }; notes.push(n); ln.notes.push(n); tb += beats * spb; }); lines.push(ln); tb += spb; });
    const endT = tb + 1.0, pts = [0, 0], max = [0, 0];
    notes.forEach(n => { max[n.w] += 100; });
    let st = 'sing', flash = [], told = false;
    Sound.duck(true);
    say(`${song.e} ${zh ? song.zh : song.en}`, t('mg_k_you_first'), '#ffe066', 1.8);
    const judge = (n, j) => { n.judge = j; pts[n.w] += j === 'perfect' ? 100 : j === 'good' ? 60 : 0; if (j !== 'miss') Sound.note(n.m, n.beats * spb * 0.9, n.w ? 0.08 : 0.16); flash.push({ n, j, t0: T }); };
    function step() {
      notes.forEach(n => {
        if (n.judge) return;
        if (n.w === 1 && T >= n.t) { const r = Math.random(); judge(n, r < 0.42 + sk * 0.4 ? 'perfect' : r < 0.86 + sk * 0.1 ? 'good' : 'miss'); }
        else if (n.w === 0 && T > n.t + 0.24) judge(n, 'miss');
      });
      if (st === 'sing' && T > endT) { st = 'end'; Sound.duck(false); const a = Math.round(pts[0] / max[0] * 100), b = Math.round(pts[1] / max[1] * 100); finish({ won: a > b ? true : a < b ? false : null, me: a + '%', them: b + '%', pct: a }); }
      const half = notes.find(n => n.w === 1); if (half && !told && T > half.t - 1.6) { told = true; say(t('mg_k_their', { name: mate.name }), '', '#fff', 1.2); }
    }
    function tap() {
      let best = null, bd = 0.24;
      notes.forEach(n => { if (n.w === 0 && !n.judge && Math.abs(T - n.t) < bd) { bd = Math.abs(T - n.t); best = n; } });
      if (!best) return;
      judge(best, bd < 0.09 ? 'perfect' : 'good');
      pop(t(bd < 0.09 ? 'mg_k_perfect' : 'mg_k_good'), W * 0.2, H * 0.62, bd < 0.09 ? '#ffe066' : '#fff');
    }
    function ptr(type) { if (type === 'down' && st === 'sing') tap(); }
    function input() { /* (ptr does it) */ }
    function draw() {
      const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1d1430'); bg.addColorStop(1, '#3a2152'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 3; k++) { const a = Math.sin(T * 0.8 + k * 2) * 0.5, sx = W * (0.2 + k * 0.3); ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = ['#ffd36b', '#ec6aa8', '#7ab0ff'][k]; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + Math.sin(a) * H * 0.6 - 60, H * 0.62); ctx.lineTo(sx + Math.sin(a) * H * 0.6 + 60, H * 0.62); ctx.closePath(); ctx.fill(); ctx.restore(); }
      [0, 1].forEach(side => { ctx.fillStyle = '#8a1f2f'; ctx.beginPath(); const x0 = side ? W : 0, dir = side ? -1 : 1; ctx.moveTo(x0, 0); ctx.quadraticCurveTo(x0 + dir * W * 0.16, H * 0.3, x0 + dir * W * 0.05, H * 0.6); ctx.lineTo(x0, H * 0.6); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = '#5a4030'; ctx.fillRect(0, H * 0.56, W, H * 0.06);
      // the singers on the stage: whoever's singing has the microphone
      const now = notes.find(n => !n.judge && n.t > T - 0.3) || notes[notes.length - 1], singing = now ? now.w : 0;
      [[S.me.look, W * 0.32, 0], [mate.look, W * 0.68, 1]].forEach(([L, x, w]) => {
        const sc = Math.min(W, H) / 150, bobY = w === singing ? Math.abs(Math.sin(T * 6)) * 3 : 0;
        drawPerson(x, H * 0.565 - bobY, sc, { look: L, face: w ? -1 : 1, view: 'front', energy: 'great', ts: T * 1000, seed: w ? 5 : 3, pose: 'stand', wave: w === singing && Math.floor(T * 2) % 2 === 0 });
        if (w === singing) emoji('🎤', x + (w ? -14 : 14) * sc, H * 0.565 - 30 * sc - bobY, 16 * sc);
      });
      // the words on the screen up top: the line being sung, lit up as it goes
      const ln = lines[now ? now.line : 0], sy = H * 0.13;
      rrect(W * 0.06, sy - 26, W * 0.88, 52, 10, 'rgba(10,8,20,.75)', '#ffd36b', 1.5);
      if (ln) { const words = ln.notes, gap = zh ? 0 : 4; ctx.font = `900 ${zh ? 22 : 17}px ${UI_FONT}`; const widths = words.map(n => ctx.measureText(n.word).width + gap), tw = widths.reduce((a, b) => a + b, 0); let xx = W / 2 - tw / 2;
        words.forEach((n, i) => { const done = n.judge || T >= n.t; txt(n.word, xx + widths[i] / 2, sy, zh ? 22 : 17, done ? (n.w ? '#7ab0ff' : '#ffe066') : '#ffffff'); xx += widths[i]; }); }
      // the notes sliding in: tap as they reach the ring
      const ly = H * 0.75, rx = W * 0.2, pps = (W * 0.85) / LEAD;
      rrect(0, ly - 54, W, 108, 0, 'rgba(0,0,0,.25)');
      circle(rx, ly, 26, 'rgba(255,255,255,.08)', '#ffffff', 3);
      notes.forEach(n => {
        const x = rx + (n.t - T) * pps, y = ly - (n.m - 64) * 3.2;
        if (x < -30 || x > W + 30) return;
        if (n.judge && n.judge !== 'miss') return;
        const col = n.w ? '#5b8de0' : '#ec6aa8';
        circle(x, y, 20, n.judge === 'miss' ? '#6b6478' : col, '#ffffff', 2);
        txt(n.word, x, y, zh ? 15 : 11, '#ffffff');
      });
      flash = flash.filter(f => T - f.t0 < 0.5);
      flash.forEach(f => { if (f.j === 'miss') return; const u = (T - f.t0) / 0.5; ctx.save(); ctx.globalAlpha = 1 - u; circle(rx, ly - (f.n.m - 64) * 3.2, 20 + u * 26, null, f.n.w ? '#7ab0ff' : '#ffe066', 4); ctx.restore(); });
    }
    function hint() { const n = notes.find(x => x.w === 0 && !x.judge); return phase === 'play' && n && n === notes[0] && T > n.t - 1.0 ? ['tap', W * 0.2, H * 0.75, t('mg_k_tap')] : null; }
    function hud() { const pc = w => Math.round(pts[w] / max[w] * 100) + '%'; return { me: pc(0), them: pc(1), mid: `${song.e} ${zh ? song.zh : song.en}` }; }
    return { step, draw, input, ptr, hint, hud, end: () => Sound.duck(false), dbg: () => ({ st, pts, notes: notes.map(n => [n.t.toFixed(2), n.w, n.judge]) }) };
  }

  // =========================================================================== fishing contest (v0.41, at the lake)
  // A minute on the jetty with them and two others. Swipe up to cast (a longer swipe goes further: bigger fish, but
  // they take longer to bite); when the float bobs, tap to strike; then hold to reel in and let go when the line gets
  // too tight (red: it snaps). Most kilos wins.
  function Fishing() {
    const FG = VENUE_GAMES.fishing, sk = mate.skill, LEN = FG.secs;
    const ang = [{ x: -3.3, look: FOLK_RACE[0], ai: 0.45 }, { x: -1.0, me: true }, { x: 1.2, mate: true, ai: 0.3 + sk * 0.55 }, { x: 3.4, look: FOLK_RACE[1], ai: 0.5 }]
      .map((a, i) => ({ ...a, kg: 0, n: 0, next: rnd(7, 14) * (1.2 - (a.ai || 0.5) * 0.5), flash: -9, last: null, bx: a.x * 1.3 + (i - 1.5) * 0.4, by: 7 + i * 1.3 }));
    const me = ang[1], them = ang[2];
    let st = 'idle', bob = null, fish = null, tension = 0, reel = false, biteAt = 0, biteEnd = 0, show = null, casts = 0, lf = 0;
    function pickFish() { let r = Math.random(); for (const F of CONTEST_FISH) { if (r < F.p) return F; r -= F.p; } return CONTEST_FISH[0]; }
    const kgOf = (F, far) => +(F.kg[0] + Math.random() * (F.kg[1] - F.kg[0]) * (0.7 + far * 0.5)).toFixed(1);
    function step(dt) {
      if (T >= LEN && st !== 'end') { st = 'end'; setTimeout(() => finish({ won: me.kg > them.kg ? true : me.kg < them.kg ? false : null, me: me.kg.toFixed(1) + 'kg', them: them.kg.toFixed(1) + 'kg', kg: +me.kg.toFixed(1), fish: me.n }), 500); return; }
      if (st === 'end') return;
      ang.forEach(a => { if (a.me || T < a.next) return; const F = pickFish(), kg = kgOf(F, 0.5); a.kg += kg; if (kg) a.n++; a.flash = T; a.last = F; a.lastKg = kg; a.next = T + rnd(9, 16) * (1.3 - a.ai * 0.6); if (a === them) Sound.play('pop'); });
      if (st === 'cast') { bob.fly = Math.min(1, bob.fly + dt * 1.6); if (bob.fly >= 1) { st = 'wait'; biteAt = T + rnd(1.2, 3.4) + lf * 1.6; Sound.play('splash'); } }
      else if (st === 'wait' && T >= biteAt) { st = 'bite'; biteEnd = T + 0.95; Sound.play('tick'); }
      else if (st === 'bite' && T > biteEnd) { st = 'wait'; biteAt = T + rnd(1.5, 3.5); say(t('mg_f_away'), '', '#fff', 0.9); }
      else if (st === 'reel') {
        if (reel) { tension += (0.26 + fish.fight * 0.2) * dt; fish.dist -= (tension < 0.92 ? 4.2 : 1.0) * dt; }
        else { tension -= 0.75 * dt; fish.dist += fish.fight * 0.45 * dt; }
        if (Math.random() < dt * 0.9) tension += 0.1 * fish.fight;
        tension = Math.max(0, tension);
        bob.y = fish.dist; bob.x += Math.sin(T * 7) * 0.02;
        if (tension >= 1) { st = 'idle'; fish = null; bob = null; reel = false; say(t('mg_f_snap'), '', '#fff', 1.1); Sound.play('oops'); }
        else if (fish.dist <= 0.6) { me.kg += fish.kg; if (fish.kg) me.n++; show = { F: fish.F, kg: fish.kg, t0: T }; st = 'idle'; bob = null; fish = null; reel = false; Sound.play(show.kg ? 'cheer' : 'pop'); }
      }
    }
    function ptr(type) {
      if (type === 'down') { if (st === 'bite') { const F = pickFish(), kg = kgOf(F, lf); fish = { F, kg, dist: bob.y, fight: 0.5 + kg * 0.13 }; tension = 0.25; st = 'reel'; reel = true; Sound.play('tap'); return; } if (st === 'reel') reel = true; }
      if (type === 'up') reel = false;
    }
    function input(sw) {
      if (st !== 'idle' || T >= LEN) return;
      if (sw.tap || sw.dy > -24) return;
      lf = cl(sw.len / (H * 0.42), 0.15, 1); casts++;
      bob = { x: cl(me.x + sw.dx / W * 5, -4, 4), y: 2.5 + lf * 13, fly: 0 }; st = 'cast'; Sound.play('tap');
    }
    function cam() { fit(-0.5, 0.86, 5.2, 24, 0.36, 5); }
    function draw() {
      cam();
      sky(V.hor + 4, '#a9d8f2', '#e6f5fb');
      grect(-60, 26, 60, 60, '#7fb36a'); treeLine(27.5, -30, 30, 2.3, 5.5);
      gpoly([[-60, -1], [60, -1], [60, 26], [-60, 26]], '#4f9fd0');
      for (let k = 0; k < 30; k++) { const u = (k * 0.37 + T * 0.02) % 1, v = (k * 0.61) % 1, q = P(-14 + u * 28, 1 + v * 24, 0); ellipse(q.x, q.y, 0.5 * q.k, 0.06 * q.k, 'rgba(255,255,255,.28)'); }
      grect(-5.2, -2.6, 5.2, -0.1, '#a8835a'); for (let x = -5; x <= 5; x += 0.7) seg3([x, -2.6, 0], [x, -0.1, 0], 0.02, 'rgba(90,60,30,.35)');
      [-5, -1.7, 1.7, 5].forEach(x => post(x, -0.1, -0.6, 0.35, 0.18, '#7a5a3a'));
      ang.forEach(a => {   // the floats
        const mine = a.me, bx = mine ? (bob ? bob.x : null) : a.bx, by = mine ? (bob ? bob.y : null) : a.by;
        const tip = [a.x + 0.7, 0.8, 2.3];
        if (bx !== null) {
          let z = 0; if (mine && st === 'cast') z = Math.sin(bob.fly * Math.PI) * 2.5;
          const fy = mine && st === 'cast' ? -0.2 + (by + 0.2) * bob.fly : by, fx = mine && st === 'cast' ? a.x + 0.7 + (bx - a.x - 0.7) * bob.fly : bx;
          const dip = mine && st === 'bite' ? Math.abs(Math.sin(T * 14)) * 0.12 : !mine && T - a.flash < 0.5 ? 0.15 : Math.sin(T * 2 + a.x) * 0.02;
          seg3(tip, [fx, fy, z + 0.05 - dip], 0.01, 'rgba(255,255,255,.7)');
          const q = P(fx, fy, z + 0.05 - dip); circle(q.x, q.y, Math.max(3, 0.1 * q.k), '#e5484d', '#ffffff', 1.4);
          if (mine && st === 'bite') txt('❗', q.x, q.y - 24, 20, '#ffe066');
          if (!mine && T - a.flash < 1.2 && a.last) { const u = (T - a.flash) / 1.2; ctx.save(); ctx.globalAlpha = 1 - u; txt(`${a.last.e} +${(a.lastKg || 0).toFixed(1)}kg`, q.x, q.y - 20 - u * 30, 13, '#fff'); ctx.restore(); }
        }
      });
      ang.forEach(a => {   // the anglers on the jetty, seen from behind, rods out
        const L = a.me ? S.me.look : a.mate ? mate.look : a.look;
        townie(L, a.x, -0.9, { view: 'back', seed: a.me ? 3 : a.mate ? 5 : 7 });
        seg3([a.x + 0.25, -0.75, 1.0], [a.x + 0.7, 0.8, 2.3], 0.03, '#5a3e28');
      });
      if (st === 'reel') {   // how tight the line is
        const bx = W - 34, by = H * 0.3, bh = H * 0.36;
        rrect(bx - 10, by, 20, bh, 8, 'rgba(0,0,0,.35)', '#ffffff', 1.5);
        const f = Math.min(1, tension), col = f > 0.85 ? '#ff4d4d' : f > 0.6 ? '#ffd36b' : '#5ad17a';
        rrect(bx - 7, by + bh * (1 - f) + 3, 14, bh * f - 6 > 0 ? bh * f - 6 : 0, 5, col);
        txt('🎣', bx, by - 14, 16);
        txt(reel ? t('mg_f_reeling') : t('mg_f_hold'), W / 2, H * 0.62, 15, reel ? '#ffe066' : '#fff');
      }
      if (show && T - show.t0 < 1.8) { const u = Math.min(1, (T - show.t0) * 4); ctx.save(); ctx.translate(W / 2, H * 0.42); ctx.scale(u, u); rrect(-110, -50, 220, 100, 18, 'rgba(255,253,248,.95)', '#ffd36b', 3); emoji(show.F.e, -60, 0, 44); txt(nm(show.F), 30, -14, 17, '#3b3125', 'center', 800); txt(show.kg ? `${show.kg.toFixed(1)} kg` : '😅', 30, 16, 20, '#e5484d'); ctx.restore(); }
    }
    function hint() {
      if (phase !== 'play') return null;
      if (st === 'idle' && casts < 2) return ['up', W / 2, H * 0.82, t('mg_f_cast')];
      if (st === 'bite') return ['tap', W / 2, H * 0.7, t('mg_f_strike')];
      return null;
    }
    function hud() { return { me: me.kg.toFixed(1) + 'kg', them: them.kg.toFixed(1) + 'kg', meSub: `<small>🐟×${me.n}</small>`, themSub: `<small>🐟×${them.n}</small>`, mid: `🎣 ${Math.max(0, Math.ceil(LEN - T))}″` }; }
    return { step, draw, input, ptr, hint, hud, dbg: () => ({ st, me: me.kg, them: them.kg, tension, fish, bob }) };
  }

  // =========================================================================== home run derby (v0.42, the stadium)
  // From behind home plate: the pitch comes in; tap to swing as it reaches the ring. On time goes furthest; early pulls it
  // left, late pushes it right; too early or late misses. You and them take turns, `pitches` each; most home runs wins
  // (if it's level, the longest one). Metres throughout; the fence is 95 m down the lines and 115 m to centre.
  function Derby() {
    const DG = VENUE_GAMES.derby, sk = mate.skill, N = DG.pitches, g = 9.8, DRAG = 0.0045, WIN = [0.045, 0.09, 0.15];
    const fence = a => 95 + 20 * Math.cos(2 * a);   // a: radians from straight out to centre field
    const team = teamOf(myTown()), PITCH = { shirt: team.col, top: 'tshirt', skin: SKINS[2], hair: 'short', hairCol: HAIR_COLORS[0], mob: 'walk', hat: 'cap', hatCol: team.col };
    const FIELD = [[-24, 78], [0, 92], [24, 78], [-14, 34], [14, 34], [18, 20], [-18, 20]].map((p, i) => ({ x: p[0], y: p[1], hx: p[0], hy: p[1], i }));
    const res = [[], []], best = [0, 0];
    let bat = 0, st = 'ready', pitch = null, ball = null, swingAt = -9, plan = null, outcome = '', wait = 0, taps = 0, over = false, flash = null, readyLeft = 0, trail = [];
    const homers = w => res[w].filter(r => r.hr).length;
    function setUp() {
      st = 'ready'; readyLeft = 0.85; ball = null; trail = []; swingAt = -9; outcome = ''; flash = null; FIELD.forEach(f => { f.x = f.hx; f.y = f.hy; });
      const Tp = [0.62, 0.7, 0.82][Math.floor(Math.random() * 3)];
      pitch = { Tp, x1: rnd(-0.15, 0.15), z1: rnd(0.65, 0.95), start: null };   // thrown when the wind-up's done (only while you're playing)
      plan = bat ? { off: gauss() * (0.085 - sk * 0.045), miss: Math.random() < 0.08 } : null;
      if (res[bat].length === 0 || bat) say(bat ? t('mg_d_their', { name: mate.name }) : t('mg_d_tap'), t('mg_d_left', { n: N - res[bat].length }), '#fff', 0.9);
    }
    // where the pitch is at time tt (null before it's thrown)
    function pitchAt(tt) {
      if (pitch.start === null) return null; const u = (tt - pitch.start) / pitch.Tp; if (u < 0) return null;
      return { x: 0.25 + (pitch.x1 - 0.25) * u, y: 17.6 * (1 - u), z: 1.9 + (pitch.z1 - 1.9) * u + 0.35 * Math.sin(Math.min(1, u) * Math.PI) * (pitch.Tp - 0.55), u };
    }
    // the swing: how far off the timing was decides it
    function swing(at) {
      if (st !== 'pitch' || swingAt > 0) return;
      swingAt = at; const dt = at - (pitch.start + pitch.Tp);
      if (Math.abs(dt) > WIN[2] || (bat && plan.miss)) { Sound.play('swish'); return; }   // missed: the ball goes on into the catcher's mitt
      const q = 1 - Math.abs(dt) / WIN[2], a = dt / WIN[2] * 0.95 + rnd(-0.06, 0.06);
      const v = 28 + 24 * q + gauss() * 1.4, th = (18 + 14 * q + gauss() * 4) * Math.PI / 180;
      ball = { x: pitch.x1, y: 0, z: pitch.z1, vx: v * Math.cos(th) * Math.sin(a), vy: v * Math.cos(th) * Math.cos(a), vz: v * Math.sin(th), a, q, live: true };
      // where it comes down (on a flat field), so we know straight away what it is
      const s2 = { ...ball }; let L = 0; for (let i = 0; i < 2000 && s2.z > 0; i++) { const sp = Math.hypot(s2.vx, s2.vy, s2.vz), h = 0.01; s2.vx -= DRAG * sp * s2.vx * h; s2.vy -= DRAG * sp * s2.vy * h; s2.vz -= (g + DRAG * sp * s2.vz) * h; s2.x += s2.vx * h; s2.y += s2.vy * h; s2.z += s2.vz * h; }
      L = Math.hypot(s2.x, s2.y); ball.land = [s2.x, s2.y]; ball.dist = Math.round(L);
      outcome = Math.abs(a) > Math.PI / 4 ? 'foul' : L > fence(a) + 1.5 ? 'hr' : 'out';
      Sound.play('racket'); st = 'hit';
      if (q > 0.7 && !bat) pop(q > 0.85 ? t('mg_k_perfect') : t('mg_k_good'), W / 2, H * 0.62, '#ffe066');
      if (outcome === 'out') { const f = FIELD.reduce((b2, f2) => (Math.hypot(f2.x - s2.x, f2.y - s2.y) < Math.hypot(b2.x - s2.x, b2.y - s2.y) ? f2 : b2), FIELD[0]); ball.catcher = f; }
    }
    function decide(o, dist) {
      res[bat].push({ hr: o === 'hr', dist }); if (o === 'hr') best[bat] = Math.max(best[bat], dist);
      const good = bat === 0 ? o === 'hr' : false;
      say(o === 'hr' ? t('mg_d_hr') : o === 'foul' ? t('mg_d_foul') : o === 'out' ? t('mg_d_out') : t('mg_d_miss'), o === 'hr' || o === 'out' ? t('mg_d_dist', { n: derbyDist(dist) }) : '', o === 'hr' ? '#ffe066' : '#fff', o === 'hr' ? 1.6 : 1.1);
      Sound.play(o === 'hr' ? 'cheer' : o === 'miss' ? 'pop' : 'pop');
      if (good) flash = T;
      st = 'after'; wait = o === 'hr' ? 1.3 : 0.9;
      if (res[0].length >= N && res[1].length >= N) over = true;
    }
    function step(dt) {
      if (st === 'ready' && (readyLeft -= dt) <= 0) { st = 'pitch'; pitch.start = T; if (plan) plan.at = T + pitch.Tp + plan.off; }
      if (st === 'pitch') {
        if (bat && T >= plan.at) swing(plan.at);
        if (st === 'pitch' && T > pitch.start + pitch.Tp + 0.28) { Sound.play('clang'); decide('miss', 0); }
      }
      if (st === 'hit' && ball) {
        const n = 6, h = dt * 2.2 / n;   // faster than life, so a derby doesn't take all day
        for (let i = 0; i < n; i++) { const sp = Math.hypot(ball.vx, ball.vy, ball.vz); ball.vx -= DRAG * sp * ball.vx * h; ball.vy -= DRAG * sp * ball.vy * h; ball.vz -= (g + DRAG * sp * ball.vz) * h; ball.x += ball.vx * h; ball.y += ball.vy * h; ball.z += ball.vz * h; }
        trail.push([ball.x, ball.y, ball.z]); if (trail.length > 16) trail.shift();
        const d = Math.hypot(ball.x, ball.y), f = ball.catcher;
        if (f) { const k = Math.min(1, dt * 7 / Math.max(1, Math.hypot(ball.land[0] - f.x, ball.land[1] - f.y))); f.x += (ball.land[0] - f.x) * k * 1.5; f.y += (ball.land[1] - f.y) * k * 1.5; }
        if (outcome === 'hr' && d > fence(ball.a) + 6 && ball.z < 6 + (d - fence(ball.a)) * 0.5) decide('hr', ball.dist);
        else if (ball.z <= 0 || (f && ball.z < 2.2 && Math.hypot(ball.x - f.x, ball.y - f.y) < 2)) { if (ball.z < 0) ball.z = 0; decide(outcome, ball.dist); }
      }
      if (st === 'after' && (wait -= dt) <= 0) {
        if (over) return finish({ won: homers(0) > homers(1) || (homers(0) === homers(1) && best[0] > best[1]) ? true : homers(0) < homers(1) || best[0] < best[1] ? false : null, me: homers(0), them: homers(1), far: best[0] });
        if (res[1 - bat].length < N) bat = 1 - bat; setUp();
      }
    }
    function ptr(type) { if (type === 'down' && bat === 0) { taps++; swing(T); } }
    function input() { }
    function cam() { fit(0, 0.86, 3.6, 110, 0.36, 4); }
    function draw() {
      cam();
      const zh = curLang() === 'zh', lit = NIGHT > 0.3;
      sky(P(0, 400, 0).y, lit ? '#1d2a4a' : '#8fcdf0', lit ? '#3a4a7a' : '#d8f0fb');
      ctx.fillStyle = '#4f9a45'; ctx.fillRect(0, P(0, 160, 0).y, W, H);
      // the stands behind the fence: rows of seats full of people, rising
      const arc = (r, z, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = -Math.PI / 4 - 0.25 + (Math.PI / 2 + 0.5) * i / n; return [Math.sin(a) * r(a), Math.cos(a) * r(a), z]; });
      for (let k = 7; k >= 0; k--) { const r0 = a => fence(a) + 4 + k * 4, A = arc(r0, 3 + k * 2.6), B = arc(a => r0(a) + 4, 3 + (k + 1) * 2.6);
        gpoly([...A, ...B.reverse()], k % 2 ? shade(team.col, -0.1) : '#8e99a6');
        A.forEach(([x, y, z], i) => { if (i % 2) return; const q = P(x, y, z + 0.6); circle(q.x, q.y, Math.max(1, 0.45 * q.k), SKINS[(i + k) % 4]); }); }
      { const q = P(0, 150, 26); rrect(q.x - 46, q.y - 30, 92, 34, 4, '#1d1d22', '#9aa3ad', 1.5); txt(`${homers(0)} : ${homers(1)}`, q.x, q.y - 13, 14, '#ffd36b'); }
      [-1, 1].forEach(sd => { const b = P(sd * 95, 120, 0), t2 = P(sd * 95, 120, 40); line(b.x, b.y, t2.x, t2.y, '#9aa3ad', 2); rrect(t2.x - 12, t2.y - 8, 24, 9, 2, '#5b6470'); if (lit) glow(t2.x, t2.y, 60, 0.9); });
      // the field: grass stripes, the infield dirt, the base paths, the fence
      for (let k = 0; k < 12; k++) if (k % 2) gpoly([[-120, k * 10], [120, k * 10], [120, k * 10 + 10], [-120, k * 10 + 10]], 'rgba(255,255,255,.05)');
      { const fan = [], ring = []; for (let i = 0; i <= 24; i++) { const a = -Math.PI / 4 + i / 24 * Math.PI / 2; fan.push([Math.sin(a) * 29, Math.cos(a) * 29, 0]); }
        for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; ring.push([Math.sin(a) * 4, Math.cos(a) * 4, 0]); }
        gpoly([[0, 0, 0], ...fan], '#c9925a'); gpoly(ring, '#c9925a'); }
      gpoly([[0, 1.2], [18, 19.4], [0, 37.6], [-18, 19.4]], '#5aa84f');
      const fz = arc(fence, 0), ft = arc(fence, 3);
      gpoly([...fz, ...ft.slice().reverse()], '#2f6f3a'); for (let i = 0; i < fz.length - 1; i += 2) seg3(ft[i], ft[i + 1], 0.25, '#f2c230');
      seg3([0, 0, 0], [fence(Math.PI / 4) * Math.SQRT1_2, fence(Math.PI / 4) * Math.SQRT1_2, 0], 0.12, '#ffffff'); seg3([0, 0, 0], [-fence(Math.PI / 4) * Math.SQRT1_2, fence(Math.PI / 4) * Math.SQRT1_2, 0], 0.12, '#ffffff');
      [[19.4, 19.4], [0, 38.8], [-19.4, 19.4]].forEach(([x, y]) => gpoly([[x - 0.4, y], [x, y - 0.4], [x + 0.4, y], [x, y + 0.4]], '#ffffff'));
      { const m = P(0, 18.4, 0); ellipse(m.x, m.y, 2.6 * m.k, 1.2 * m.k * 0.4, '#c08550'); }
      // the fielders (one runs to catch a fly ball)
      FIELD.slice().sort((a, b) => b.y - a.y).forEach(f => townie(PITCH, f.x, f.y, { view: 'front', seed: 20 + f.i, pose: ball && ball.catcher === f && st === 'hit' ? 'run' : 'stand', phase: T * 12, hands: ball && ball.catcher === f && ball.z < 6 ? [[-3, -32], [3, -32]] : undefined }));
      // the ball out in the field
      if (ball && (st === 'hit' || st === 'after') && ball.y > 19) { shadow(ball.x, ball.y, 0.5, 0.18); trail.forEach((p, i) => { const q = P(...p); circle(q.x, q.y, Math.max(1, 2.6 * i / trail.length), `rgba(255,255,255,${0.5 * i / trail.length})`); }); const q = P(ball.x, ball.y, ball.z); circle(q.x, q.y, Math.max(3.5, 0.2 * q.k), '#ffffff', '#c9cfd6', 1); }
      // the pitcher: winds up and throws
      const ps = pitch.start !== null ? pitch.start : T + readyLeft, wu = Math.max(0, Math.min(1, (T - (ps - 0.6)) / 0.6)), thrown = T >= ps;
      townie(PITCH, 0, 18.4, { view: 'front', seed: 7, hands: thrown && T - ps < 0.4 ? [[-6, -20], [9, -10]] : wu > 0 ? [[-2, -36 * wu - 16 * (1 - wu)], [3, -36 * wu - 16 * (1 - wu)]] : [[-4, -18], [4, -18]] });
      // the pitch on its way in, the ring to hit it in
      const ring = P(0.05, 0, 0.85), pa = st === 'pitch' || (st === 'after' && outcome === '') ? pitchAt(T) : null, inRing = pa && Math.abs(T - (ps + pitch.Tp)) < WIN[1];
      if (st === 'pitch' || st === 'ready') { ellipse(ring.x, ring.y, 0.42 * ring.k, 0.42 * ring.k, inRing ? 'rgba(90,209,122,.25)' : 'rgba(255,255,255,.08)', inRing ? '#5ad17a' : 'rgba(255,255,255,.7)', 2.5); }
      if (pa && pa.u <= 1.12) { const q = P(pa.x, Math.max(-0.4, pa.y), pa.z), sh = P(pa.x, Math.max(-0.4, pa.y), 0); ellipse(sh.x, sh.y, 0.1 * sh.k, 0.04 * sh.k, 'rgba(0,0,0,.25)'); circle(q.x, q.y, Math.max(2.5, 0.075 * q.k), '#ffffff', '#c9cfd6', 1); if (q.k > 20) { ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.x - 0.06 * q.k, q.y, 0.05 * q.k, -0.9, 0.9); ctx.stroke(); } }
      // home plate, the batter's boxes, the batter with the bat
      gpoly([[-0.22, 0.22], [0.22, 0.22], [0.22, 0], [0, -0.22], [-0.22, 0]], '#ffffff');
      [[-1.25, -0.45], [0.45, 1.25]].forEach(([a, b]) => { seg3([a, -0.9, 0], [b, -0.9, 0], 0.04, 'rgba(255,255,255,.7)'); seg3([a, 0.9, 0], [b, 0.9, 0], 0.04, 'rgba(255,255,255,.7)'); seg3([a, -0.9, 0], [a, 0.9, 0], 0.04, 'rgba(255,255,255,.7)'); seg3([b, -0.9, 0], [b, 0.9, 0], 0.04, 'rgba(255,255,255,.7)'); });
      const sw = swingAt > 0 ? Math.min(1, (T - swingAt) / 0.22) : 0, ba = -2.3 - sw * 4.7;   // round and through, up over the other shoulder
      const L = bat ? mate.look : S.me.look;
      townie(L, -0.85, -0.15, { face: 1, view: 'front', turn: 0.45, seed: bat ? 5 : 3, hands: [[5, -20], [6, -19]], wave: !bat && flash && T - flash < 1.4 && Math.sin(T * 9) > 0, after: () => { line(5.5, -19.5, 5.5 + Math.cos(ba) * 16, -19.5 + Math.sin(ba) * 16, '#c99a5a', 2.2); circle(5.5 + Math.cos(ba) * 16, -19.5 + Math.sin(ba) * 16, 1.3, '#b8874a'); } });
      if (ball && st === 'hit' && ball.y <= 19) { const q = P(ball.x, ball.y, ball.z); circle(q.x, q.y, Math.max(2, 0.075 * q.k), '#ffffff', '#c9cfd6', 1); }
    }
    function hint() {
      if (phase !== 'play' || bat || taps >= 2 || st !== 'pitch') return null;
      const ring = P(0.05, 0, 0.85); return ['tap', ring.x + 30, ring.y + 40, t('mg_d_tap')];
    }
    function hud() { const row = w => `<small>${res[w].map(r => (r.hr ? '⚾' : '·')).join('')}${'○'.repeat(Math.max(0, N - res[w].length))}</small>`; return { me: homers(0), them: homers(1), meSub: row(0), themSub: row(1), mid: `⚾ ${t('mg_d_title')}` }; }
    setUp();
    return { step, draw, input, ptr, hint, hud, dbg: () => ({ st, bat, res, best, outcome, ball, pitch }) };
  }

  const MAKE = { tennis: Tennis, basketball: Hoops, soccer: Penalty, bowling: Bowling, race: Race, golf: Golf, claw: Claw, karaoke: Karaoke, fishing: Fishing, derby: Derby };

  // ---------- the screen: a canvas, the score at the top, cards for how to play and for the result ----------
  function build() {
    root = document.createElement('div'); root.className = 'mg';
    root.innerHTML = `<canvas class="mg-cv"></canvas><div class="mg-top"></div><div class="mg-card" hidden></div>`;
    document.querySelector('.screen').appendChild(root);
    cv = root.querySelector('.mg-cv'); g = cv.getContext('2d'); top = root.querySelector('.mg-top'); card = root.querySelector('.mg-card');
    cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } const r = cv.getBoundingClientRect(); ptr = { x0: e.clientX - r.left, y0: e.clientY - r.top, t0: performance.now(), T0: T }; if (phase === 'play' && G && G.ptr) G.ptr('down', ptr.x0, ptr.y0); });
    cv.addEventListener('pointermove', e => { if (!ptr || phase !== 'play' || !G || !G.ptr) return; const r = cv.getBoundingClientRect(); G.ptr('move', e.clientX - r.left, e.clientY - r.top); });   // v0.41: dragging, holding
    cv.addEventListener('pointerup', e => {
      if (!ptr) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, dx = x - ptr.x0, dy = y - ptr.y0, len = Math.hypot(dx, dy);
      const sw = { dx, dy, len, tap: len < 16, x: len < 16 ? ptr.x0 : x, y: len < 16 ? ptr.y0 : y, ms: performance.now() - ptr.t0, T0: ptr.T0 };   // T0: when the finger went down (that's when you swing)
      ptr = null;
      if (phase === 'play' && G && G.ptr) G.ptr('up', x, y);
      if (phase === 'play' && G) G.input(sw);
    });
    cv.addEventListener('pointercancel', () => { ptr = null; });
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-mg]'); if (!b) return;
      Sound.play('tap');
      const a = b.dataset.mg;
      if (a === 'start') { card.hidden = true; phase = 'play'; }
      else if (a === 'again') start(true);
      else if (a === 'leave') close();
    });
    ro = new ResizeObserver(resize); ro.observe(root);
  }
  function resize() {
    const r = root.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (!r.width) return;
    W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawHud() {
    const h = G.hud(), key = JSON.stringify(h);
    if (key === hudKey) return;
    hudKey = key;
    top.innerHTML = `<button class="mg-x" data-mg="leave">✕ ${t('mg_leave')}</button>
      <div class="mg-score"><div class="mg-p">${avatar(S.me.look)}<div><b>${t('mg_you')}</b><span class="mg-n">${h.me}</span>${h.meSub || ''}</div></div>
      <div class="mg-mid">${h.mid}</div>
      <div class="mg-p r"><div><b>${esc(mate.name)}</b><span class="mg-n">${h.them}</span>${h.themSub || ''}</div>${avatar(mate.look)}</div></div>`;
  }
  function howTo() {
    const k = { tennis: 't', basketball: 'b', soccer: 's', bowling: 'w', race: 'r', golf: 'g', claw: 'c', karaoke: 'k', fishing: 'f', derby: 'd' }[kind], e = (BALL_GAMES[kind] || VENUE_GAMES[kind]).e;
    const n = { tennis: BALL_GAMES.tennis.to, basketball: BALL_GAMES.basketball.spots, soccer: BALL_GAMES.soccer.kicks, bowling: VENUE_GAMES.bowling.frames, race: VENUE_GAMES.race.len, golf: VENUE_GAMES.golf.holes, claw: VENUE_GAMES.claw.grabs, karaoke: 2, fishing: VENUE_GAMES.fishing.secs, derby: VENUE_GAMES.derby.pitches }[kind];
    card.innerHTML = `<div class="mg-box"><div class="mg-big">${e}</div><h2>${t('mg_' + k + '_title')}</h2><p class="muted">${t('mg_with', { name: esc(mate.name) })}</p>
      <div class="mg-how"><div><span class="mg-fing">${kind === 'soccer' ? '👆' : '👆'}</span>${t('mg_' + k + '_how1')}</div><div><span>🎯</span>${t('mg_' + k + '_how2')}</div><div><span>🏁</span>${t('mg_' + k + '_how3', { n, s: BALL_GAMES.basketball.shots, x: VENUE_GAMES.bowling.strike, p: VENUE_GAMES.bowling.spare, m: VENUE_GAMES.golf.max })}</div></div>
      <button class="btn primary block" data-mg="start">${t('mg_start')}</button></div>`;
    card.hidden = false;
  }
  function start(again) {
    G = MAKE[kind](); T = 0; banner = null; pops = []; hudKey = '';
    if (again) { card.hidden = true; phase = 'play'; } else { phase = 'intro'; howTo(); }
  }
  function finish(res) {
    if (phase === 'end') return;
    phase = 'end';
    const got = onEnd ? onEnd(res) : '';
    const head = res.won === true ? `🏆 ${t('mg_win')}` : res.won === false ? `👏 ${t('mg_lose', { name: esc(mate.name) })}` : `🤝 ${t('mg_draw')}`;
    const lines = t(res.won === true ? 'mg_say_lost' : res.won === false ? 'mg_say_won' : 'mg_say_draw').split('|');
    Sound.play(res.won === false ? 'chime' : 'levelup');
    card.innerHTML = `<div class="mg-box"><h2>${head}</h2><div class="mg-final">${res.me} : ${res.them}</div>
      <div class="mg-say">${avatar(mate.look)}<div class="bubble">${esc(lines[Math.floor(Math.random() * lines.length)])}</div></div>
      ${got}<div class="row gap-top"><button class="btn grow" data-mg="leave">${mate.back ? '🚪 ' + esc(mate.back) : '🌳 ' + t('mg_back')}</button><button class="btn primary grow" data-mg="again">🔁 ${t('mg_again')}</button></div></div>`;
    card.hidden = false;
  }
  function tick(dt, noDraw) {
    if (held && !noDraw) dt = 0;   // (testing: frozen)
    T += dt;
    if (!G) return;
    if (phase === 'play' && dt) { try { G.step(dt); } catch (e) { console.error(e); } }
    if (noDraw) return;
    const old = ctx; ctx = g;
    try {
      g.clearRect(0, 0, W, H);
      G.draw();
      if (phase === 'play') { const h = G.hint(); if (h) finger(...h); }
      drawMessages();
    } catch (e) { console.error(e); }
    ctx = old;
    drawHud();
  }
  function frame(ts) {
    if (!root || root.hidden) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000)); lastTs = ts;
    tick(dt);
  }
  function close() {
    if (!root) return;
    cancelAnimationFrame(raf); root.hidden = true; phase = 'off'; if (G && G.end) G.end(); G = null;
    Scene.setVisible(true);
    const f = onClose; onClose = null; if (f) f();
  }

  return {
    open(k, partner, end, closeFn) {
      if (!MAKE[k]) return;
      if (!root) build();
      kind = k; mate = partner; onEnd = end; onClose = closeFn;
      root.hidden = false; resize();
      Scene.setVisible(false);
      start();
      lastTs = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    },
    close,
    isOpen: () => !!root && !root.hidden,
    // for testing: run frames now (a background tab doesn't animate), swipe or tap, look inside
    _tick(n = 1, dt = 1 / 60, noDraw = false) { for (let i = 0; i < n; i++) tick(dt, noDraw); if (noDraw && G) drawHud(); },
    _input(sw) { if (G) G.input({ dx: 0, dy: 0, len: 0, tap: false, x: W / 2, y: H / 2, ...sw }); },
    _ptr(type, x, y) { if (G && G.ptr) G.ptr(type, x, y); },   // (testing, v0.41)
    _go() { card.hidden = true; phase = 'play'; },
    _g: () => (G ? G.dbg() : null),
    _T: () => T,
    _hold(v) { held = v; },
    _phase: () => phase,
    _size: () => [W, H],
    _P: (x, y, z) => P(x, y, z),
  };
})();
