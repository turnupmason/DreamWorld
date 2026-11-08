'use strict';
// v0.33: ball games you really play, on the park's courts, with a friend (or one of the people already playing there).
// Each game draws its own court in a 2.5D view from behind you, with the same cartoon townies, on a canvas over the
// town. One thumb is enough:
//   tennis      you run to the ball by yourself; when the ring round your feet closes, swipe up to hit it back
//               (left / right to aim, a longer swipe goes deeper). First to 5 points.
//   basketball  swipe up to shoot: straight to be on line, how far you swipe is how hard. Take turns from 5 places.
//   football    penalties: swipe at the goal to shoot (sideways for where, longer for higher); in goal, tap where to dive.
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
    const p = P(x, y, o.lift || 0), s = p.k * PS, wheel = L.mob === 'wheel';
    const opt = { look: L, energy: 'good', ts: T * 1000, seed: o.seed || 1, pose: o.pose || 'stand', view: o.view || 'front', turn: o.turn || 0, phase: o.phase || 0, hands: o.hands, air: o.air || 0, wave: o.wave, face: o.face || (o.view === 'back' ? 1 : -1), back: o.view === 'back' };
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
    if (kind2 === 'up') {
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

  const MAKE = { tennis: Tennis, basketball: Hoops, soccer: Penalty };

  // ---------- the screen: a canvas, the score at the top, cards for how to play and for the result ----------
  function build() {
    root = document.createElement('div'); root.className = 'mg';
    root.innerHTML = `<canvas class="mg-cv"></canvas><div class="mg-top"></div><div class="mg-card" hidden></div>`;
    document.querySelector('.screen').appendChild(root);
    cv = root.querySelector('.mg-cv'); g = cv.getContext('2d'); top = root.querySelector('.mg-top'); card = root.querySelector('.mg-card');
    cv.addEventListener('pointerdown', e => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } const r = cv.getBoundingClientRect(); ptr = { x0: e.clientX - r.left, y0: e.clientY - r.top, t0: performance.now(), T0: T }; });
    cv.addEventListener('pointerup', e => {
      if (!ptr) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, dx = x - ptr.x0, dy = y - ptr.y0, len = Math.hypot(dx, dy);
      const sw = { dx, dy, len, tap: len < 16, x: len < 16 ? ptr.x0 : x, y: len < 16 ? ptr.y0 : y, ms: performance.now() - ptr.t0, T0: ptr.T0 };   // T0: when the finger went down (that's when you swing)
      ptr = null;
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
    const k = { tennis: 't', basketball: 'b', soccer: 's' }[kind], e = BALL_GAMES[kind].e;
    const n = { tennis: BALL_GAMES.tennis.to, basketball: BALL_GAMES.basketball.spots, soccer: BALL_GAMES.soccer.kicks }[kind];
    card.innerHTML = `<div class="mg-box"><div class="mg-big">${e}</div><h2>${t('mg_' + k + '_title')}</h2><p class="muted">${t('mg_with', { name: esc(mate.name) })}</p>
      <div class="mg-how"><div><span class="mg-fing">${kind === 'soccer' ? '👆' : '👆'}</span>${t('mg_' + k + '_how1')}</div><div><span>🎯</span>${t('mg_' + k + '_how2')}</div><div><span>🏁</span>${t('mg_' + k + '_how3', { n, s: BALL_GAMES.basketball.shots })}</div></div>
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
      ${got}<div class="row gap-top"><button class="btn grow" data-mg="leave">🌳 ${t('mg_back')}</button><button class="btn primary grow" data-mg="again">🔁 ${t('mg_again')}</button></div></div>`;
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
    cancelAnimationFrame(raf); root.hidden = true; phase = 'off'; G = null;
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
    _go() { card.hidden = true; phase = 'play'; },
    _g: () => (G ? G.dbg() : null),
    _T: () => T,
    _hold(v) { held = v; },
    _phase: () => phase,
    _size: () => [W, H],
    _P: (x, y, z) => P(x, y, z),
  };
})();
