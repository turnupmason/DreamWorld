'use strict';
// Living things: townies (with arms, legs, poses and moods), crops at every growth stage, animals from baby
// to adult, fruit trees and fish. Sprites draw in a local frame: feet/base at (0, 0), facing +x, 1 unit = 1 px at zoom 1.

// ---------- townies ----------
// A pose is a skeleton. Hips, torso, arms and head are in the body frame, which moves up and down by `lift`
// (crouching is a negative lift). Knees and feet are in the ground frame, so feet stay planted.
// `air` lifts the whole person (jumping). o: { look, face: 1|-1, back, moving, phase, pose, energy, ts, seed, wave }
// face: which way the townie looks on screen (1 = right). back: walking away from the camera, so we see the back of the head.
function skeleton(pose, o) {
  const ts = o.ts || 0, seed = o.seed || 0, ph = o.phase || 0;
  const tired = o.energy === 'tired' || o.energy === 'exhausted';
  const breathe = Math.sin(ts / 700 + seed) * 0.3;
  const k = {
    lift: 0, lean: 0, air: 0, top: -23.5, prop: null,
    legs: [{ h: [-1.6, -10], k: [-1.5, -5], f: [-1.6, 0] }, { h: [1.6, -10], k: [1.7, -5], f: [1.6, 0] }],
    arms: [{ s: [-0.6, -20.5], e: [-1.2, -16], h: [-1.4, -12] }, { s: [0.8, -20.5], e: [1.4, -16], h: [1.6, -12] }],
    head: [0.4, -30 + breathe + (o.energy === 'exhausted' ? 1.2 : 0)],
  };
  const sw = Math.sin(ph), cw = Math.cos(ph);
  switch (pose) {
    case 'walk': {
      const step = tired ? 3 : 4;
      k.lift = Math.abs(cw) * (o.energy === 'great' ? 1.8 : tired ? 0.6 : 1.1);
      k.legs[0].f = [-1.6 - sw * step, -Math.max(0, -sw) * 1.5]; k.legs[0].k = [-1.6 - sw * step / 2 + 0.8, -5.2];
      k.legs[1].f = [1.6 + sw * step, -Math.max(0, sw) * 1.5]; k.legs[1].k = [1.6 + sw * step / 2 + 0.8, -5.2];
      k.arms[0].h = [-1.4 + sw * 3.5, -12]; k.arms[0].e = [-1 + sw * 1.8, -16];
      k.arms[1].h = [1.6 - sw * 3.5, -12]; k.arms[1].e = [1.2 - sw * 1.8, -16];
      if (o.energy === 'exhausted') k.lean = 1;
      break;
    }
    case 'run': {
      k.lift = Math.abs(cw) * 2.2; k.lean = 1.6;
      k.legs[0].f = [-1.6 - sw * 6, -Math.max(0, -sw) * 3]; k.legs[0].k = [-1.6 - sw * 3 + 2, -6 - Math.max(0, -sw) * 1.5];
      k.legs[1].f = [1.6 + sw * 6, -Math.max(0, sw) * 3]; k.legs[1].k = [1.6 + sw * 3 + 2, -6 - Math.max(0, sw) * 1.5];
      k.arms[0].e = [-2.5 + sw * 2.5, -16.5]; k.arms[0].h = [sw * 4, -14 - Math.max(0, sw) * 2];
      k.arms[1].e = [2.5 - sw * 2.5, -16.5]; k.arms[1].h = [4 - sw * 4, -14 - Math.max(0, -sw) * 2];
      break;
    }
    case 'sneak': {
      k.lift = -2.5 + Math.abs(cw) * 0.4; k.lean = 2.2;
      k.legs.forEach((l, i) => { const s = i ? 1 : -1; l.f = [s * 1.6 + s * sw * 2.6, -Math.max(0, s * sw) * 1.2]; l.k = [l.f[0] + 2.4, -5]; });
      k.arms[0].e = [0.5, -15]; k.arms[0].h = [3.2, -17.5]; k.arms[1].e = [2.5, -15]; k.arms[1].h = [4.6, -18.5];
      break;
    }
    case 'crouch': case 'pick': {
      const dig = Math.sin(ts / 150) * 1.5;
      k.lift = -5.2; k.lean = 1.5;
      k.legs[0] = { h: [-1.6, -10], k: [6.4, -7.2], f: [1.6, 0] };
      k.legs[1] = { h: [1.6, -10], k: [8.2, -6.6], f: [4, 0] };
      k.legFront = true;
      k.arms[0] = { s: [-0.6, -20.5], e: [2.5, -15], h: [5.5, -11 + dig] };
      k.arms[1] = { s: [0.8, -20.5], e: [4, -15.5], h: [6.8, -10.5 - dig] };
      if (pose === 'pick') {   // reaching up into a tree or a hive
        const u = (ts / 520 + seed) % 1, r = Math.sin(u * Math.PI);
        k.lift = 0; k.lean = 0.5;
        k.legs[0] = { h: [-1.6, -10], k: [-1.5, -5], f: [-1.6, 0] }; k.legs[1] = { h: [1.6, -10], k: [1.7, -5], f: [1.6, 0] };
        k.arms[1] = { s: [0.8, -20.5], e: [3.5, -25 - r * 2], h: [6, -30 - r * 4] };
        k.arms[0] = { s: [-0.6, -20.5], e: [1.5, -16], h: [4, -15] };
        k.prop = 'basket';
      }
      break;
    }
    case 'sit': {
      const sh = o.seatH;   // seat height: hips on the seat, thighs level, feet down on the floor
      if (sh) {
        k.lift = sh + 1 - 10;
        k.legs[0] = { h: [-1.2, -10], k: [4.6, -(sh + 1)], f: [5.2, 0] };
        k.legs[1] = { h: [1.2, -10], k: [6, -(sh + 1)], f: [6.6, 0] };
      } else {
        k.lift = -2;
        k.legs[0] = { h: [-1.2, -10], k: [4.2, -8.3], f: [4.6, 0] };
        k.legs[1] = { h: [1.2, -10], k: [5.6, -8.3], f: [6, 0] };
      }
      k.arms[0].e = [1.2, -15]; k.arms[0].h = [3.6, -11.5]; k.arms[1].e = [2.6, -15]; k.arms[1].h = [5, -11.5];
      break;
    }
    case 'lift': {
      const u = (Math.sin(ts / 340) + 1) / 2;
      k.legs[0].f = [-3, 0]; k.legs[1].f = [3, 0];
      [0, 1].forEach(i => { const s = i ? 1 : -1; k.arms[i].e = [s * 2.6, -15.5]; k.arms[i].h = [s * 3 + 1.5, -12 - u * 8.5]; });
      k.prop = 'dumbbells';
      break;
    }
    case 'box': {
      const u = Math.max(0, Math.sin(ts / 140)), v = Math.max(0, Math.sin(ts / 140 + Math.PI));
      k.lean = 0.8; k.legs[0].f = [-3, 0]; k.legs[1].f = [3, 0];
      k.arms[0] = { s: [-0.6, -20.5], e: [1.5, -17.5], h: [3.5 + u * 5, -20] };
      k.arms[1] = { s: [0.8, -20.5], e: [3, -17.5], h: [4.5 + v * 5, -20.5] };
      k.prop = 'gloves';
      break;
    }
    case 'yoga': {
      const sway = Math.sin(ts / 900) * 0.4;
      k.legs[1] = { h: [1, -10], k: [0.9, -5], f: [0.8, 0] };
      k.legs[0] = { h: [-1, -10], k: [-5.5, -8.5], f: [0.2, -6.5] };
      k.arms[0] = { s: [-0.6, -20.5], e: [-2.4, -26.5], h: [0.2 + sway, -33] };
      k.arms[1] = { s: [0.8, -20.5], e: [2.6, -26.5], h: [0.6 + sway, -33] };
      k.prop = 'mat';
      break;
    }
    case 'jacks': {
      const u = (Math.sin(ts / 170) + 1) / 2;
      k.air = u * 3;
      k.legs[0].f = [-1.6 - u * 4, 0]; k.legs[0].k = [-1.6 - u * 2, -5];
      k.legs[1].f = [1.6 + u * 4, 0]; k.legs[1].k = [1.6 + u * 2, -5];
      [0, 1].forEach(i => { const s = i ? 1 : -1, a = 0.15 + u * 2.7; k.arms[i].e = [s * (0.8 + Math.sin(a) * 4), -20.5 + Math.cos(a) * 4]; k.arms[i].h = [s * (0.8 + Math.sin(a) * 8.5), -20.5 + Math.cos(a) * 8.5]; });
      break;
    }
    case 'dance': {
      const u = Math.sin(ts / 260), v = Math.sin(ts / 520);
      k.lean = u * 1.2; k.air = Math.abs(u) * 1.2;
      k.legs[0].f = [-2.5 + v * 1.5, 0]; k.legs[1].f = [2.5 + v * 1.5, -Math.max(0, u) * 2];
      k.arms[0].e = [-3, -23]; k.arms[0].h = [-2 + u * 2, -30 - Math.max(0, u) * 2];
      k.arms[1].e = [3.5, -17]; k.arms[1].h = [6, -14 - Math.max(0, -u) * 6];
      k.prop = 'notes';
      break;
    }
    case 'fish': {
      k.arms[1].e = [3, -17]; k.arms[1].h = [5.5, -17.5];
      k.arms[0].e = [1, -16]; k.arms[0].h = [4.5, -16];
      k.prop = 'rod';
      break;
    }
    case 'mail': {
      k.arms[1].e = [4, -19]; k.arms[1].h = [7.5, -19.5];
      k.prop = 'letter';
      break;
    }
  }
  if (o.wave || pose === 'wave') { k.arms[1].e = [5.5, -23.5]; k.arms[1].h = [8.5 + Math.sin(ts / 140) * 2, -31]; }
  return k;
}

function drawPerson(sx, sy, s, o) {
  const L = o.look, ts = o.ts || 0, seed = o.seed || 0, energy = o.energy || 'good';
  const pose = o.pose || (o.moving ? 'walk' : 'stand');
  if (pose === 'swim') return drawSwimmer(sx, sy, s, o);
  if (pose === 'lie') return drawLying(sx, sy, s, o);
  // walking straight towards the camera or away from it: a real front / back view, legs stepping in place
  if ((o.view === 'front' || o.view === 'back') && L.mob !== 'wheel' && ['walk', 'run', 'stand', 'sneak'].includes(pose)) return drawPersonFront(sx, sy, s, o, pose);
  if (L.mob === 'wheel') { ellipse(sx, sy, 9 * s, 3.6 * s, 'rgba(0,0,0,.18)'); return drawWheelPerson(sx, sy, s, o, pose); }
  if (pose === 'bike') { ellipse(sx, sy, 12 * s, 3.6 * s, 'rgba(0,0,0,.18)'); return drawRider(sx, sy, s, o); }
  const k = skeleton(pose, o);
  let air = k.air;
  if (pose === 'stand' && energy === 'great' && !o.wave) air += Math.max(0, Math.sin(ts / 240 + seed)) * 2.5;
  ellipse(sx, sy, (8 - air * 0.5) * s, (3.4 - air * 0.2) * s, 'rgba(0,0,0,.18)');
  const pants = L.pants || '#4a5a78', shirt = L.shirt, skin = L.skin, lean = k.lean, lift = k.lift;
  const B = p => [p[0] + lean, p[1] - lift];
  local(sx, sy, s, o.face || 1, () => {
    if (k.prop === 'mat') pg([[-9, 0.5], [9, 0.5], [7, 2.5], [-11, 2.5]], o.matCol || '#8b7fe0');
    ctx.translate(0, -air);
    limb2(B(k.arms[0].s), B(k.arms[0].e), B(k.arms[0].h), shade(shirt, -0.2), skin);
    leg2(k.legs[0], shade(pants, -0.18), lift, lean);
    if (!k.legFront) leg2(k.legs[1], pants, lift, lean);
    ctx.save(); ctx.translate(lean, -lift);
    const top = k.top;
    if (L.hair === 'long') rrect(-7.4, top - 13, 12, 17, 5, L.hairCol);
    ctx.beginPath(); ctx.moveTo(-5.2, -9); ctx.lineTo(-5.2, top + 4); ctx.quadraticCurveTo(-5.2, top, -1, top); ctx.lineTo(1, top); ctx.quadraticCurveTo(5.2, top, 5.2, top + 4); ctx.lineTo(5.2, -9); ctx.closePath();
    ctx.fillStyle = shirt; ctx.fill();
    rrect(-5.2, -11.5, 10.4, 2.6, 1, shade(pants, -0.05));
    if (o.back) line(-0.6, top + 2, -0.6, -10, shade(shirt, -0.12), 0.8);   // back seam instead of the collar
    else line(-2.2, top + 0.3, 2.6, top + 0.3, shade(shirt, 0.35), 1.1);
    ctx.restore();
    if (k.legFront) leg2(k.legs[1], pants, lift, lean);
    head(k.head[0] + lean, k.head[1] - lift, L, energy, ts, seed, o.back);
    limb2(B(k.arms[1].s), B(k.arms[1].e), B(k.arms[1].h), shirt, skin);
    drawProp(k, ts, B);
  });
  sleepyZ(sx, sy, s, energy, ts, seed, 40 + air);
}
function leg2(l, col, lift, lean) {
  const hx = l.h[0] + lean * 0.5, hy = l.h[1] - lift;
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(l.k[0], l.k[1]); ctx.lineTo(l.f[0], l.f[1] - 1.2);
  ctx.strokeStyle = col; ctx.lineWidth = 3.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  ellipse(l.f[0] + 1.1, l.f[1] - 0.9, 2.6, 1.5, '#3b3028');
}
function limb2(sh, el, ha, sleeve, skin) {
  line(sh[0], sh[1], el[0], el[1], sleeve, 3.3);
  line(el[0], el[1], ha[0], ha[1], skin, 2.6);
  circle(ha[0], ha[1], 1.7, skin);
}
function drawProp(k, ts, B) {
  const hand = i => B(k.arms[i].h);
  if (k.prop === 'dumbbells') [0, 1].forEach(i => { const [x, y] = hand(i); rrect(x - 2.4, y - 0.8, 4.8, 1.6, 0.6, '#555'); rrect(x - 3, y - 2, 1.4, 4, 0.5, '#333'); rrect(x + 1.6, y - 2, 1.4, 4, 0.5, '#333'); });
  if (k.prop === 'gloves') [0, 1].forEach(i => { const [x, y] = hand(i); circle(x + 0.5, y, 2.4, '#e5373b'); });
  if (k.prop === 'basket') { const [x, y] = hand(0); rrect(x - 2.5, y - 1, 6, 4, 1.5, '#c8954f', '#9a6a34', 0.5); }
  if (k.prop === 'rod') {
    const [x, y] = hand(1), tip = [x + 18, y - 16], bob = Math.sin(ts / 500) * 1.2;
    line(x, y, tip[0], tip[1], '#8a5a36', 1);
    line(tip[0], tip[1], tip[0] + 3, 6 + bob, 'rgba(255,255,255,.8)', 0.4);
    circle(tip[0] + 3, 6 + bob, 1.2, '#e5484d');
  }
  if (k.prop === 'letter') { const [x, y] = hand(1); rrect(x - 1, y - 3.5, 6, 4, 0.5, '#fffaf0', '#c9b98f', 0.5); }
  if (k.prop === 'notes') { const u = (ts / 900) % 1; ctx.save(); ctx.globalAlpha = 1 - u; ctx.font = '8px sans-serif'; ctx.fillStyle = '#6b5bd0'; ctx.fillText('♪', 6, -34 - u * 10); ctx.fillText('♫', -10, -30 - ((u + 0.5) % 1) * 10); ctx.restore(); }
}

// Front / back view (o.view): symmetric body; when walking, the legs step up and down and the arms swing,
// so the townie walks towards you (or away) instead of sliding sideways.
function drawPersonFront(sx, sy, s, o, pose) {
  const L = o.look, ts = o.ts || 0, seed = o.seed || 0, energy = o.energy || 'good', back = o.view === 'back';
  const moving = pose !== 'stand', run = pose === 'run', ph = o.phase || 0, sw = moving ? Math.sin(ph) : 0;
  const tired = energy === 'tired' || energy === 'exhausted';
  const bounce = moving ? Math.abs(Math.cos(ph)) * (run ? 2 : tired ? 0.6 : 1.1) : (energy === 'great' && !o.wave ? Math.max(0, Math.sin(ts / 240 + seed)) * 2.5 : 0);
  const pants = L.pants || '#4a5a78', shirt = L.shirt, skin = L.skin, step = run ? 3.2 : 2.2;
  ellipse(sx, sy, 8 * s, 3.4 * s, 'rgba(0,0,0,.18)');
  local(sx, sy, s, 1, () => {
    ctx.translate(0, -bounce);
    // legs: the lifted one bends its knee
    [[-1, -sw], [1, sw]].forEach(([side, u]) => {
      const lift = Math.max(0, u) * step, hip = [side * 2.1, -10], foot = [side * 2.3, -lift + bounce], knee = [side * 2.4, -5 - lift * 0.8 + bounce * 0.5];
      ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.lineTo(foot[0], foot[1] - 1);
      ctx.strokeStyle = u > 0 ? shade(pants, -0.12) : pants; ctx.lineWidth = 3.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      rrect(foot[0] - 1.9, foot[1] - 1.7, 3.8, 2.2, 1, '#3b3028');
    });
    // arms swing forward and back, opposite to the legs
    const arm = (side, u) => {
      const sh = [side * 5, -20.6], hand = [side * (5.8 + Math.abs(u) * 0.4), -12.2 + u * (run ? 2.6 : 1.6)], el = [side * 5.9, -16.3 + u * 0.8];
      line(sh[0], sh[1], el[0], el[1], shade(shirt, -0.08), 3.2);
      line(el[0], el[1], hand[0], hand[1], skin, 2.5); circle(hand[0], hand[1], 1.7, skin);
    };
    if (L.hair === 'long' && back) rrect(-5.6, -31, 11.2, 13, 4.5, L.hairCol);
    // torso
    ctx.beginPath(); ctx.moveTo(-5.4, -9.5); ctx.lineTo(-5.6, -20.5); ctx.quadraticCurveTo(-5.6, -23.6, -2, -23.6); ctx.lineTo(2, -23.6); ctx.quadraticCurveTo(5.6, -23.6, 5.6, -20.5); ctx.lineTo(5.4, -9.5); ctx.closePath();
    ctx.fillStyle = shirt; ctx.fill();
    rrect(-5.4, -11.6, 10.8, 2.6, 1, shade(pants, -0.05));
    if (back) line(0, -21.5, 0, -11.8, shade(shirt, -0.12), 0.8);
    else { ctx.beginPath(); ctx.moveTo(-2.4, -23.4); ctx.quadraticCurveTo(0, -21.2, 2.4, -23.4); ctx.strokeStyle = shade(shirt, 0.35); ctx.lineWidth = 1; ctx.stroke(); }
    arm(-1, sw); arm(1, -sw);
    if (o.wave) { const w = Math.sin(ts / 140) * 2; line(5, -20.6, 7.5, -25, shirt, 3.2); line(7.5, -25, 8.5 + w, -31, skin, 2.5); circle(8.5 + w, -31, 1.7, skin); }
    headFront(0, -30.2 + (energy === 'exhausted' ? 1.2 : 0), L, energy, ts, seed, back);
  });
  sleepyZ(sx, sy, s, energy, ts, seed, 40 + bounce);
}
function headFront(cx, cy, L, energy, ts, seed, back) {
  const r = 6.8, hc = L.hairCol, ink = '#2a2018';
  if (back) {
    circle(cx, cy, r, L.skin);
    ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, Math.PI * 0.86, Math.PI * 2.14); ctx.closePath(); ctx.fill();
    ellipse(cx, cy + 2.2, r * 0.86, r * 0.6, hc);
    ellipse(cx - r + 0.4, cy + 0.8, 1.2, 1.8, shade(L.skin, -0.06)); ellipse(cx + r - 0.4, cy + 0.8, 1.2, 1.8, shade(L.skin, -0.06));
    if (L.hair === 'bun') { circle(cx, cy - r - 2.2, 3.4, hc); circle(cx, cy - r - 2.2, 1.2, shade(hc, 0.15)); }
    if (L.hair === 'curly') for (let k = 0; k <= 9; k++) { const a = Math.PI * 0.85 + k / 9 * Math.PI * 1.3; circle(cx + Math.cos(a) * (r + 0.4), cy + Math.sin(a) * (r + 0.4), 2.5, hc); }
    return;
  }
  if (L.hair === 'long') rrect(cx - r - 0.8, cy - 2, 2 * r + 1.6, 11, 3, hc);
  circle(cx, cy, r, L.skin);
  ellipse(cx - r + 0.3, cy + 0.6, 1.2, 1.8, shade(L.skin, -0.06)); ellipse(cx + r - 0.3, cy + 0.6, 1.2, 1.8, shade(L.skin, -0.06));
  ctx.fillStyle = hc;
  ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
  if (L.hair === 'short') { ellipse(cx - 2.2, cy - 4.4, 3.6, 2.2, hc, null, 0, 0.25); ellipse(cx + 2.4, cy - 4.6, 3.4, 2, hc, null, 0, -0.25); }
  if (L.hair === 'long') { ellipse(cx, cy - 4.6, 5.8, 2.6, hc); rrect(cx - r - 0.6, cy - 3, 2.6, 9, 1.3, hc); rrect(cx + r - 2, cy - 3, 2.6, 9, 1.3, hc); }
  if (L.hair === 'bun') { circle(cx, cy - r - 2.4, 3.3, hc); ellipse(cx, cy - 4.6, 5.4, 2.2, hc); }
  if (L.hair === 'curly') for (let k = 0; k <= 7; k++) { const a = Math.PI + k / 7 * Math.PI; circle(cx + Math.cos(a) * (r + 0.4), cy + Math.sin(a) * (r + 0.4) - 0.4, 2.5, hc); }
  const blink = Math.sin(ts / 1700 + seed * 5) > 0.985, yawn = energy === 'tired' && Math.sin(ts / 2600 + seed) > 0.93;
  const eyes = [-2.4, 2.4];
  if (energy === 'exhausted') {
    eyes.forEach(x => ellipse(cx + x, cy + 1.8, 1.6, 0.8, 'rgba(110,80,140,.35)'));
    ctx.strokeStyle = ink; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    eyes.forEach(x => { ctx.beginPath(); ctx.arc(cx + x, cy - 0.2, 1.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); });
  } else if (energy === 'tired' || blink) {
    eyes.forEach(x => { ellipse(cx + x, cy + 0.6, 1.05, 0.6, ink); line(cx + x - 1.4, cy + 0.1, cx + x + 1.4, cy + 0.1, shade(L.skin, -0.25), 0.8); });
  } else {
    eyes.forEach(x => ellipse(cx + x, cy + 0.3, 0.95, 1.2, ink));
    if (energy === 'great') eyes.forEach(x => circle(cx + x + 0.3, cy - 0.1, 0.35, '#fff'));
  }
  if (energy === 'great' || energy === 'good') [-4.3, 4.3].forEach(x => ellipse(cx + x, cy + 2.8, 1.4, 0.85, 'rgba(240,120,120,.35)'));
  ctx.strokeStyle = '#8a4a3a'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  if (yawn) { ellipse(cx, cy + 3.6, 1.2, 1.5, '#7a3a2a'); return; }
  ctx.beginPath();
  if (energy === 'great') ctx.arc(cx, cy + 2.4, 2, 0.1 * Math.PI, 0.9 * Math.PI);
  else if (energy === 'good') ctx.arc(cx, cy + 2.8, 1.3, 0.2 * Math.PI, 0.8 * Math.PI);
  else if (energy === 'tired') { ctx.moveTo(cx - 0.9, cy + 4); ctx.lineTo(cx + 0.9, cy + 4); }
  else ctx.arc(cx, cy + 5.2, 1.3, 1.2 * Math.PI, 1.8 * Math.PI);
  ctx.stroke();
}
// Lying in bed (o.dir: which way the head points on screen, in radians). Eyes closed, a few z's.
function drawLying(sx, sy, s, o) {
  const L = o.look, ts = o.ts || 0;
  local(sx, sy, s, 1, () => {
    ctx.rotate(o.dir || 0);
    // the body lies along +x here, head at +x
    rrect(-9, -4.2, 13, 8.4, 4, L.shirt);
    line(-9, -1.8, -16, -1.8, L.pants || '#4a5a78', 3.4); line(-9, 1.8, -16, 1.8, shade(L.pants || '#4a5a78', -0.12), 3.4);
    circle(9.6, 0, 6.6, L.skin);
    ctx.fillStyle = L.hairCol; ctx.beginPath(); ctx.arc(9.6, 0, 7, -Math.PI * 0.5, Math.PI * 0.5); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    [-2.2, 2.2].forEach(y => { ctx.beginPath(); ctx.arc(8.2, y, 1.1, 0.6 * Math.PI, 1.4 * Math.PI); ctx.stroke(); });
  });
  const ph = (ts / 1500) % 1;
  ctx.save(); ctx.globalAlpha = 1 - ph; ctx.font = `bold ${(8 + ph * 5) * s}px sans-serif`; ctx.fillStyle = '#5b6b8c'; ctx.textAlign = 'center';
  ctx.fillText('z', sx + (8 + ph * 8) * s, sy - (14 + ph * 14) * s); ctx.restore();
}
// Mood shows on the face only: eyes, mouth, dark circles. Body shape never changes.
// back: seen from behind (walking away): hair, an ear and the nape, no face.
function backHead(cx, cy, L, r) {
  const hc = L.hairCol;
  circle(cx, cy, r, L.skin);
  ctx.fillStyle = hc;
  ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, Math.PI * 0.82, Math.PI * 2.18); ctx.closePath(); ctx.fill();
  ellipse(cx - 0.8, cy + 2.2, r * 0.82, r * 0.62, hc);
  ellipse(cx + r - 0.6, cy + 0.8, 1.3, 1.9, shade(L.skin, -0.06));            // ear
  if (L.hair === 'long') rrect(cx - 6.6, cy - 1, 12.2, 11, 4.5, hc);
  if (L.hair === 'bun') { circle(cx - 0.6, cy - r - 2, 3.4, hc); circle(cx - 0.6, cy - r - 2, 1.2, shade(hc, 0.15)); }
  if (L.hair === 'curly') for (let k = 0; k <= 8; k++) { const a = Math.PI * 0.85 + k / 8 * Math.PI * 1.3; circle(cx + Math.cos(a) * (r + 0.4), cy + Math.sin(a) * (r + 0.4), 2.5, hc); }
  if (L.hair === 'short') ellipse(cx - 1, cy - r + 1.4, 4.4, 1.6, shade(hc, 0.12), null, 0, -0.15);
}
function head(cx, cy, L, energy, ts, seed, back) {
  const r = 6.8, hc = L.hairCol;
  if (back) return backHead(cx, cy, L, r);
  circle(cx, cy, r, L.skin);
  ellipse(cx - 5.6, cy + 0.5, 1.4, 2, shade(L.skin, -0.08));
  ctx.fillStyle = hc;
  ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
  if (L.hair === 'short') ellipse(cx + 2.6, cy - 4.6, 4.2, 2.3, hc, null, 0, -0.2);
  if (L.hair === 'long') { ellipse(cx + 2.4, cy - 4.4, 4.6, 2.6, hc, null, 0, -0.25); rrect(cx - 7.3, cy - 3, 3.4, 9, 1.6, hc); }
  if (L.hair === 'bun') { circle(cx - 1.5, cy - r - 2.6, 3.3, hc); ellipse(cx + 2.2, cy - 4.6, 4.4, 2.2, hc, null, 0, -0.2); }
  if (L.hair === 'curly') for (let k = 0; k <= 6; k++) { const a = Math.PI + k / 6 * Math.PI; circle(cx + Math.cos(a) * (r + 0.4), cy + Math.sin(a) * (r + 0.4) - 0.4, 2.5, hc); }
  const ink = '#2a2018';
  const blink = Math.sin(ts / 1700 + seed * 5) > 0.985;
  const yawn = energy === 'tired' && Math.sin(ts / 2600 + seed) > 0.93;
  if (energy === 'exhausted') {
    ellipse(cx + 2.2, cy + 1.8, 1.6, 0.8, 'rgba(110,80,140,.35)'); ellipse(cx + 5.2, cy + 1.8, 1.6, 0.8, 'rgba(110,80,140,.35)');
    ctx.strokeStyle = ink; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    [2.2, 5.2].forEach(x => { ctx.beginPath(); ctx.arc(cx + x, cy - 0.2, 1.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); });
  } else if (energy === 'tired' || blink) {
    [2.2, 5.2].forEach(x => { ellipse(cx + x, cy + 0.6, 1.05, 0.6, ink); line(cx + x - 1.4, cy + 0.1, cx + x + 1.4, cy + 0.1, shade(L.skin, -0.25), 0.8); });
  } else {
    ellipse(cx + 2.2, cy + 0.3, 0.95, 1.2, ink); ellipse(cx + 5.2, cy + 0.3, 0.95, 1.2, ink);
    if (energy === 'great') { circle(cx + 2.5, cy - 0.1, 0.35, '#fff'); circle(cx + 5.5, cy - 0.1, 0.35, '#fff'); }
  }
  if (energy === 'great' || energy === 'good') ellipse(cx + 5.6, cy + 3, 1.5, 0.9, 'rgba(240,120,120,.35)');
  ctx.strokeStyle = '#8a4a3a'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
  if (yawn) { ellipse(cx + 3.8, cy + 3.6, 1.2, 1.5, '#7a3a2a'); return; }
  ctx.beginPath();
  if (energy === 'great') ctx.arc(cx + 3.8, cy + 2.4, 2, 0.1 * Math.PI, 0.9 * Math.PI);
  else if (energy === 'good') ctx.arc(cx + 3.8, cy + 2.8, 1.3, 0.2 * Math.PI, 0.8 * Math.PI);
  else if (energy === 'tired') { ctx.moveTo(cx + 2.9, cy + 4); ctx.lineTo(cx + 4.7, cy + 4); }
  else ctx.arc(cx + 3.8, cy + 5.2, 1.3, 1.2 * Math.PI, 1.8 * Math.PI);
  ctx.stroke();
}
function sleepyZ(sx, sy, s, energy, ts, seed, hgt) {
  if (energy === 'exhausted' || (energy === 'tired' && Math.sin(ts / 3000 + seed) > 0.6)) {
    const ph = (ts / 1400 + seed) % 1;
    ctx.save(); ctx.globalAlpha = 1 - ph;
    ctx.font = `bold ${(8 + ph * 5) * s}px sans-serif`; ctx.fillStyle = '#5b6b8c'; ctx.textAlign = 'center';
    ctx.fillText('z', sx + (7 + ph * 6) * s, sy - (hgt + ph * 12) * s);
    ctx.restore();
  } else if (energy === 'great' && Math.sin(ts / 300 + seed) > 0.7) emoji('✨', sx + 10 * s, sy - (hgt - 4) * s, 10 * s);
}
// Wheelchair users push their wheels instead of walking, and do seated versions of every workout.
function drawWheelPerson(sx, sy, s, o, pose) {
  const L = o.look, ts = o.ts || 0, seed = o.seed || 0, energy = o.energy || 'good';
  const moving = o.moving || pose === 'run' || pose === 'walk' || pose === 'bike';
  const roll = (o.phase || ts / 200) * (pose === 'run' ? 1.4 : 0.8);
  const reach = ['crouch', 'pick', 'fish', 'mail', 'sneak'].includes(pose);
  const active = ['lift', 'box', 'jacks', 'dance', 'yoga'].includes(pose);
  const bob = moving ? 0 : (Math.sin(ts / 700 + seed) + 1) * 0.25;
  local(sx, sy, s, o.face || 1, () => {
    line(-5, -11, -6.5, -24, '#5b6470', 1.8);
    rrect(-5, -12.5, 12, 2.6, 1, '#5b6470');
    circle(9, -1.8, 1.8, '#3b3f46');
    line(7, -11, 9, -3, '#5b6470', 1.2);
    ctx.save(); ctx.translate(reach ? 1.5 : 0, -bob);
    if (reach) ctx.rotate(0.18);
    rrect(-5, -26, 10, 15, 4.2, L.shirt);
    line(-1, -11.5, 6.5, -11.5, L.pants || '#4a5a78', 4);
    line(6.5, -11.5, 7.8, -3.5, L.pants || '#4a5a78', 3.4);
    ellipse(8.8, -2.6, 2.4, 1.4, '#3b3028');
    head(0.4, -32.5, L, energy, ts, seed, o.back);
    ctx.restore();
    circle(-0.5, -8, 8, null, '#3b3f46', 2);
    for (let k = 0; k < 4; k++) { const a = (moving ? roll : 0) + k * Math.PI / 4; line(-0.5 - Math.cos(a) * 7, -8 - Math.sin(a) * 7, -0.5 + Math.cos(a) * 7, -8 + Math.sin(a) * 7, '#8a919c', 0.6); }
    circle(-0.5, -8, 1.4, '#8a919c');
    if (active) {
      const u = (Math.sin(ts / 260) + 1) / 2;
      limb2([0.5, -23], [3, -26 - u * 3], [2 + u * 2, -29 - u * 7], L.shirt, L.skin);
      if (pose === 'lift') rrect(-0.4 + u * 2, -31 - u * 7, 4.8, 1.6, 0.6, '#555');
    } else if (reach) limb2([1.5, -23], [5, -16], [8.5, -9 + Math.sin(ts / 200) * 1.5], L.shirt, L.skin);
    else limb2([0.5, -23], [2.5, -16.5], [2 + (moving ? Math.sin(roll * 1.5) * 2.5 : 0), -11.5], L.shirt, L.skin);
  });
  sleepyZ(sx, sy, s, energy, ts, seed, 42);
}
// Riding a bike (the cycling workout). noBike: on the exercise bike indoors, only the rider shows.
function drawRider(sx, sy, s, o) {
  const L = o.look, ts = o.ts || 0, ph = o.phase || ts / 120, energy = o.energy || 'good';
  local(sx, sy, s, o.face || 1, () => {
    if (!o.noBike) {
      const wheel = (x) => { circle(x, -5, 5, null, '#2b2b2e', 1.4); for (let k = 0; k < 3; k++) { const a = ph + k * Math.PI / 3; line(x - Math.cos(a) * 4.5, -5 - Math.sin(a) * 4.5, x + Math.cos(a) * 4.5, -5 + Math.sin(a) * 4.5, '#999', 0.4); } };
      wheel(-8); wheel(9);
      const col = o.bikeCol || '#e5484d';
      [[-8, -5, 0, -5], [0, -5, -2, -13], [-2, -13, 7, -13], [7, -13, 9, -5], [0, -5, 7, -13], [7, -13, 7.5, -16]].forEach(([a, b, c, d]) => line(a, b, c, d, col, 1.2));
      rrect(-4, -14.5, 5, 1.6, 0.8, '#333');
    }
    const pedal = (a) => [Math.cos(a) * 2.6, -5 + Math.sin(a) * 2.6];
    [[ph + Math.PI, shade(L.pants || '#4a5a78', -0.18)], [ph, L.pants || '#4a5a78']].forEach(([a, c]) => {
      const f = pedal(a), hip = [-1.5, -15], knee = [(hip[0] + f[0]) / 2 + 2.5, (hip[1] + f[1]) / 2 - 2.5];
      ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.quadraticCurveTo(knee[0], knee[1], f[0], f[1]); ctx.strokeStyle = c; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.stroke();
      ellipse(f[0] + 0.8, f[1], 2.2, 1.3, '#3b3028');
    });
    ctx.save(); ctx.translate(-1, -14); ctx.rotate(0.25);
    rrect(-4.8, -13, 9.6, 13, 4, L.shirt);
    ctx.restore();
    head(1.8, -32, L, energy, ts, o.seed || 0);
    limb2([1.5, -25], [4.5, -20], [7.5, -16.5], L.shirt, L.skin);
  });
}
// Swimming in the pond or pool: just the head and the arms come out of the water.
function drawSwimmer(sx, sy, s, o) {
  const L = o.look, ts = o.ts || 0, f = o.face || 1;
  const r = (ts / 1200) % 1;
  ellipse(sx, sy, 14 * s * (0.6 + r), 5 * s * (0.6 + r), null, `rgba(255,255,255,${0.7 * (1 - r)})`, 1 * s);
  local(sx, sy, s, f, () => {
    ellipse(0, 0, 8, 3, 'rgba(255,255,255,.35)');
    const a = ts / 260;
    [[a, L.shirt], [a + Math.PI, shade(L.shirt, -0.2)]].forEach(([tt]) => {
      if (Math.sin(tt) > 0) { const hx = Math.cos(tt) * 8, hy = -Math.sin(tt) * 7; line(0, -1, hx, hy - 1, L.skin, 2.4); circle(hx, hy - 1, 1.6, L.skin); }
    });
    head(1, -5, L, o.energy || 'good', ts, o.seed || 0);
    ctx.fillStyle = '#e5484d'; ctx.beginPath(); ctx.arc(1, -5, 7.2, Math.PI, 0); ctx.fill();   // swim cap
  });
}

// ---------- crops ----------
// Each crop's colour when ripe, for drawing fields from far away.
const CROP_COL = {
  wheat: '#e9c46a', carrot: '#f08a3c', potato: '#c9a36a', onion: '#d9a37c', garlic: '#efe9dc', cabbage: '#a3d468', broccoli: '#4f9a3e',
  sweetpotato: '#b5543c', tomato: '#e5483b', cucumber: '#5aa04a', eggplant: '#7b4a9c', chili: '#d93a2b', corn: '#f2c94c', pepper: '#e8a33a',
  strawberry: '#e0344a', blueberry: '#4f63c9', watermelon: '#3f9a46', grape: '#7d4aa3', melon: '#c9d36a', tulip: '#ef6f8c', rose: '#d6334f',
  sunflower: '#f2c230', pumpkin: '#f08a24',
};
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
  if (st === 4) {
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
  } else (PLANTS[crop] || PLANTS.wheat)(st, sway, ts, seed);
  ctx.restore();
}
// Shared plant parts
function tubeLeaves(n, H, sw, col, flop) {
  for (let k = 0; k < n; k++) {
    const a = (k - (n - 1) / 2) * 0.35, h = H * (1 - Math.abs(a) * 0.4);
    const tx = Math.sin(a) * h * (flop ? 1.4 : 0.5) + sw * h;
    stem(k * 0.4 - n * 0.2, 0, tx, -h * (flop ? 0.7 : 1), col, 1.3, a * 4);
    circle(tx, -h * (flop ? 0.7 : 1), 0.65, col);
  }
}
// A rosette of wide leaves (cabbage, broccoli): back leaves first (darker), front leaves last, each with a midrib.
function broadLeaves(R, sw, col, n = 6, lift = 0.6) {
  const cy = -R * lift, order = Array.from({ length: n }, (_, k) => k / n * Math.PI * 2 + 0.4).sort((a, b) => Math.sin(a) - Math.sin(b));
  order.forEach((a, k) => {
    const ex = Math.cos(a) * R * 1.05, ey = Math.sin(a) * R * 0.48, front = Math.sin(a) > 0;
    vleaf(sw * 2, cy, Math.hypot(ex, ey) + R * 0.15, R * 0.42, Math.atan2(ey, ex) + sw * 0.2, front ? shade(col, 0.1) : shade(col, -0.12));
  });
}
function staked(H, sw, leafCol) {
  line(-3.6, 0.5, -3.6 + sw * 3, -H - 2, '#a77b4f', 1.1);
  const tip = sw * H;
  stem(0, 0, tip, -H, '#4f9a3a', 1.4, 2);
  for (let j = 0; j < 5; j++) { const u = 0.22 + j * 0.17; leaf(tip * u, -H * u, 6 - j * 0.6, 2.3, j % 2 ? -0.45 : -2.7, j % 2 ? leafCol : shade(leafCol, 0.1)); }
  return tip;
}
// A creeping vine (pumpkin, melons, sweet potato): a curly runner with big heart-shaped leaves and tendrils.
function vine(sw, L, col) {
  ctx.beginPath(); ctx.moveTo(-9, 1); ctx.bezierCurveTo(-4, -3, 2, 3, 9, -1);
  ctx.strokeStyle = '#4f8f35'; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.stroke();
  [[-6.5, -0.5], [7, -1.8]].forEach(([x, y], k) => {   // tendrils
    ctx.beginPath(); ctx.arc(x + sw * 2, y - 1.4, 1.2, k ? 0 : Math.PI, k ? Math.PI * 1.6 : Math.PI * 2.6); ctx.strokeStyle = '#6aa84a'; ctx.lineWidth = 0.5; ctx.stroke();
  });
  [[-7, -2.2, -0.4], [6.5, -3.2, 0.5], [-1.5, -5.6, 0.1], [2.5, 0.2, -0.2]].forEach(([x, y, a], k) => {
    x += sw * 3;
    stem(x * 0.6, y * 0.3, x, y, '#5f9a3f', 0.6);
    heartLeaf(x, y, L * 1.1, k % 2 ? col : shade(col, 0.12), a + sw * 0.3);
  });
}
// A leafy little bush (peppers, chillies, potatoes, roses, berries): a few stems with pointed leaves fanning out,
// darker leaves behind, lighter in front, a soft shadow at the foot.
function bush(R, sw, col) {
  ellipse(0, 0.4, R * 0.85, R * 0.3, 'rgba(60,40,20,.16)');
  const dark = shade(col, -0.2), light = shade(col, 0.14), cx = sw * R * 0.25, cy = -R * 0.55;
  [-0.6, 0, 0.6].forEach(a => stem(0, 0, cx + Math.sin(a) * R * 0.6, cy - R * 0.25 * Math.cos(a), shade(col, -0.35), 0.8, a * 2));
  for (let k = 0; k < 9; k++) { const a = -Math.PI + k / 8 * Math.PI; vleaf(cx + Math.cos(a) * R * 0.15, cy + Math.sin(a) * R * 0.12, R * 0.95, R * 0.34, a + sw * 0.25, k % 2 ? dark : shade(col, -0.08)); }
  for (let k = 0; k < 6; k++) { const a = -Math.PI * 0.9 + k / 5 * Math.PI * 0.8; vleaf(cx, cy + R * 0.1, R * 0.72, R * 0.3, a + sw * 0.3, k % 2 ? col : light); }
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
        ctx.restore();
      }
    }
  },
  carrot(st, sw) {
    const H = [7, 10, 12][st - 2];
    if (st >= 3) { ellipse(0, 0.3, st === 4 ? 3.8 : 2.6, st === 4 ? 2.1 : 1.4, '#f08a24'); ellipse(-0.9, -0.3, 1.3, 0.6, '#f7ad5c'); }
    for (let k = -2; k <= 2; k++) {
      const tx = k * 2.1 + sw * H, h = H - Math.abs(k) * 1.2, bx = k * 0.4;
      stem(bx, 0, tx, -h, '#3f9a35', 0.9, k * 0.3);
      for (let j = 1; j <= 3; j++) { const u = j / 3.3; circle(bx + (tx - bx) * u + (j % 2 ? 1.1 : -1.1), -h * u, 1.25, j === 3 ? '#62bf4a' : '#4fae3d'); }
    }
  },
  potato(st, sw) {
    if (st === 4) [[-3.5, 0.6], [2.8, 0.9], [0, 1.4]].forEach(([x, y]) => ellipse(x, y, 2.6, 1.6, '#c6955a', '#9c6e3c', 0.4));
    bush([5, 7, 8][st - 2], sw, '#5aa64a');
    if (st >= 3) [[-3, -11.5], [2.5, -12.5], [-0.5, -13.5]].forEach(([x, y]) => { for (let p = 0; p < 5; p++) { const an = p / 5 * Math.PI * 2; circle(x + sw * 3 + Math.cos(an) * 0.8, y + Math.sin(an) * 0.6, 0.6, '#ecdcf7'); } circle(x + sw * 3, y, 0.35, '#f3d36b'); });
  },
  onion(st, sw) {
    if (st >= 3) { ellipse(0, -1.6, st === 4 ? 4 : 2.8, st === 4 ? 3.4 : 2.4, st === 4 ? '#d9a35a' : '#e7d3a6'); line(0, -4.6, 0, -6, '#b8864a', 0.6); }
    tubeLeaves(5, [9, 13, 12][st - 2], sw, '#5fae55', st === 4);
  },
  garlic(st, sw) {
    if (st >= 3) { ellipse(0, -1.5, st === 4 ? 3.6 : 2.6, st === 4 ? 3.2 : 2.2, '#f4efe4'); if (st === 4) { line(-1.2, -3.8, -1.2, 0.5, '#c9a2c9', 0.5); line(1.2, -3.8, 1.2, 0.5, '#c9a2c9', 0.5); } }
    tubeLeaves(4, [8, 11, 11][st - 2], sw, '#7ab866', false);
  },
  cabbage(st, sw) {
    const R = [4.5, 6.5, 8][st - 2], inner = st === 4 ? '#d3efb6' : '#a9dc8a';
    broadLeaves(R, sw, '#5fae4f', 6, 0.35);
    if (st >= 3) {
      const r = st === 4 ? R * 0.66 : R * 0.42, cx = sw * 3, cy = -R * 0.6;
      circle(cx, cy, r, inner, '#8cc072', 0.6);
      stem(cx, cy + r * 0.7, cx - r * 0.4, cy - r * 0.6, '#b2d99a', 0.6, 1);
      stem(cx, cy + r * 0.7, cx + r * 0.5, cy - r * 0.5, '#b2d99a', 0.6, -1);
    }
  },
  broccoli(st, sw) {
    broadLeaves([5, 7, 8][st - 2], sw, '#4f8f6a', 6, 0.5);
    if (st >= 3) {
      const r = st === 4 ? 5 : 3, cx = sw * 3, cy = -7 - (st === 4 ? 2 : 0);
      line(cx, cy + r, cx, cy + r + 3, '#7aa86a', 2);
      for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; circle(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.4, r * 0.5, k % 2 ? '#3f7d4a' : '#4a8f55'); }
      circle(cx, cy - r * 0.2, r * 0.5, '#57a061');
    }
  },
  sweetpotato(st, sw) {
    if (st === 4) [[-3, 0.8, 0.4], [3, 1, -0.3]].forEach(([x, y, r]) => ellipse(x, y, 3.4, 1.6, '#b4475b', '#8a2f45', 0.4, r));
    vine(sw, [3, 4, 4.5][st - 2], '#5f9e3e');
    if (st >= 3) [[-6, -6], [5, -7]].forEach(([x, y]) => { circle(x, y, 1.4, '#e8b7e0'); circle(x, y, 0.5, '#a8558f'); });
  },
  tomato(st, sw) {
    const H = [12, 17, 20][st - 2], tip = staked(H, sw, '#3f8f34');
    [[-2.6, 0.38], [2.8, 0.55], [-1.6, 0.75], [3.2, 0.3]].forEach(([fx, u], k) => {
      const x = fx + tip * u, y = -H * u;
      if (st === 3) { if (k < 2) circle(x, y, 1.9, '#9ad15e'); else circle(x, y - 1, 1.2, '#f7d84b'); }
      if (st === 4) { circle(x, y, 2.8, '#e5483b'); circle(x - 0.9, y - 0.9, 0.8, 'rgba(255,255,255,.55)'); pg([[x - 1.3, y - 2.6], [x, y - 1.9], [x + 1.3, y - 2.6], [x, y - 3.4]], '#3f8f34'); }
    });
  },
  cucumber(st, sw) {
    // A-frame trellis
    line(-5, 0.5, 0 + sw * 2, -20, '#a77b4f', 1); line(5, 0.5, 0 + sw * 2, -20, '#a77b4f', 1);
    const H = [10, 15, 18][st - 2];
    for (let j = 0; j < 5; j++) { const u = j / 5, side = j % 2 ? 1 : -1; leaf(side * (4.5 - u * 4) + sw * H * u, -H * u - 2, 5, 3, side > 0 ? -0.3 : -2.8, j % 2 ? '#4f9a3a' : '#5fae47'); }
    if (st === 3) [[-3, -8], [3, -11]].forEach(([x, y]) => circle(x, y, 1.3, '#f7d84b'));
    if (st === 4) [[-3.5, -7, 0.25], [3.2, -11, -0.2], [-1, -14, 0.1]].forEach(([x, y, r]) => { ellipse(x, y, 1.3, 4, '#4f8f35', null, 0, r); for (let k = -1; k <= 1; k++) circle(x + 0.3, y + k * 2, 0.3, '#cde8a8'); });
  },
  eggplant(st, sw) {
    const H = [11, 15, 17][st - 2], tip = staked(H, sw, '#4a8a40');
    [[-2.8, 0.45], [2.8, 0.6], [0.5, 0.3]].forEach(([fx, u], k) => {
      const x = fx + tip * u, y = -H * u;
      if (st === 3) circle(x, y - 1, 1.4, '#a46ef0');
      if (st === 4 && k < 2) { ellipse(x, y + 2, 2, 3.6, '#5b2a6e', null, 0, fx * 0.05); ellipse(x - 0.6, y + 1, 0.6, 1.4, 'rgba(255,255,255,.3)'); pg([[x - 1.6, y - 1.2], [x + 1.6, y - 1.2], [x, y - 2.6]], '#3f8f34'); }
    });
  },
  chili(st, sw) {
    bush([5, 6.5, 7][st - 2], sw, '#4f9a40');
    if (st === 3) [[-3, -6], [2, -8], [4, -4]].forEach(([x, y]) => circle(x + sw * 3, y, 0.9, '#fff'));
    if (st === 4) for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2, x = Math.cos(a) * 4 + sw * 3, y = -5 + Math.sin(a) * 2.5, c = k % 3 ? '#e5373b' : '#f28c28', bend = k % 2 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(x - 0.7, y); ctx.quadraticCurveTo(x - 0.6, y + 3, x + bend * 1.2, y + 4.4); ctx.quadraticCurveTo(x + 0.9, y + 2.4, x + 0.7, y); ctx.closePath();
      ctx.fillStyle = c; ctx.fill(); ellipse(x - 0.2, y + 1.2, 0.25, 0.9, 'rgba(255,255,255,.5)');
      line(x, y, x, y - 1, '#3f8f34', 0.6);
    }
  },
  pepper(st, sw) {
    bush([5, 6.5, 7.5][st - 2], sw, '#4a8f3a');
    if (st >= 3) [[-3, -4], [3, -6], [0, -9]].forEach(([x, y], k) => {
      x += sw * 3;
      if (st === 3) { ellipse(x, y, 1.3, 1.6, '#7bbf5a'); return; }
      const c = ['#e5373b', '#f2c230', '#f28c28'][k];
      // a bell pepper: three rounded lobes, shine, green cap and stalk
      ctx.beginPath(); ctx.moveTo(x - 2.2, y - 1.2);
      ctx.bezierCurveTo(x - 2.8, y + 1.6, x - 1.6, y + 3.2, x - 0.7, y + 2.6); ctx.quadraticCurveTo(x, y + 3.4, x + 0.7, y + 2.6);
      ctx.bezierCurveTo(x + 1.6, y + 3.2, x + 2.8, y + 1.6, x + 2.2, y - 1.2); ctx.quadraticCurveTo(x, y - 2.4, x - 2.2, y - 1.2);
      ctx.fillStyle = c; ctx.fill();
      line(x, y - 1, x, y + 2.4, shade(c, -0.18), 0.5);
      ellipse(x - 1.1, y + 0.2, 0.45, 1.2, 'rgba(255,255,255,.55)');
      ellipse(x, y - 1.6, 1.4, 0.6, '#3f8f34'); line(x, y - 1.8, x + 0.3, y - 3, '#3f7f30', 0.7);
    });
  },
  corn(st, sw) {
    const H = [16, 24, 28][st - 2], tip = sw * H;
    stem(0, 0, tip, -H, '#6cae3e', 2.1, 1);
    for (let j = 0; j < 5; j++) { const u = 0.18 + j * 0.15; leaf(tip * u, -H * u, 9 - j, 1.8, j % 2 ? -0.35 + sw : -2.8 + sw, j % 2 ? '#5aa53a' : '#6dbb47'); }
    if (st >= 3) for (let k = -1; k <= 1; k++) line(tip, -H, tip + k * 2.2 + sw * 4, -H - 4.5, st === 4 ? '#e2b13c' : '#d8d07a', 0.8);
    (st === 4 ? [[1.8, 0.5], [-1.8, 0.36]] : st === 3 ? [[1.6, 0.5]] : []).forEach(([cx, u]) => {
      const x = cx + tip * u, y = -H * u;
      if (st === 3) ellipse(x, y, 1.6, 3.6, '#9ad16a', null, 0, cx * 0.15);
      else { ellipse(x, y, 2.2, 4.6, '#f4cf3f', '#d9a92a', 0.5, cx * 0.15); for (let j = -2; j <= 2; j++) circle(x + cx * 0.05 * j, y + j * 1.5, 0.45, '#e2a91f'); leaf(x, y + 4, 6, 1.5, -Math.PI / 2 - cx * 0.18, '#b5d36a'); }
    });
  },
  strawberry(st, sw) {
    const R = [4, 6, 7][st - 2];
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + 0.4, cx = Math.cos(a) * R * 0.6 + sw * 3, cy = Math.sin(a) * R * 0.3 - R * 0.55;
      stem(sw, -0.5, cx, cy, '#4f8f35', 0.5);
      [-0.9, 0, 0.9].forEach((b, j) => vleaf(cx, cy, 2.8, 1.25, -Math.PI / 2 + b + a * 0.15, j === 1 ? '#5bb954' : '#45a045'));
    }
    [[-R * 0.7, -0.6], [R * 0.75, -1.2], [-R * 0.2, 0.4], [R * 0.3, -R * 0.75]].forEach(([x, y], k) => {
      x += sw * 2;
      if (st === 3) { if (k < 2) { for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; circle(x + Math.cos(a) * 1.1, y - 2 + Math.sin(a) * 1.1, 0.9, '#fff'); } circle(x, y - 2, 0.6, '#f3d36b'); } else ellipse(x, y, 1.2, 1.5, '#a8d66e'); }
      if (st === 4) {
        ctx.beginPath(); ctx.moveTo(x - 2.2, y - 1.6); ctx.quadraticCurveTo(x, y - 3, x + 2.2, y - 1.6); ctx.quadraticCurveTo(x + 1.6, y + 1.6, x, y + 2.8); ctx.quadraticCurveTo(x - 1.6, y + 1.6, x - 2.2, y - 1.6);
        ctx.fillStyle = '#e43a4a'; ctx.fill();
        circle(x - 0.8, y - 0.4, 0.3, '#f6d36b'); circle(x + 0.7, y + 0.2, 0.3, '#f6d36b');
        pg([[x - 1.6, y - 2], [x, y - 1.2], [x + 1.6, y - 2], [x, y - 2.8]], '#3f8f34');
      }
    });
  },
  blueberry(st, sw) {
    const R = [6, 8, 9][st - 2];
    bush(R, sw, '#3f7d4f');
    if (st === 3) for (let k = 0; k < 5; k++) { const a = k * 1.3; ellipse(Math.cos(a) * R * 0.5 + sw * 2, -R * 0.8 + Math.sin(a) * R * 0.3, 0.8, 1.2, '#fff8f0'); }
    if (st === 4) for (let k = 0; k < 9; k++) { const a = k * 0.8, x = Math.cos(a) * R * 0.55 + sw * 2, y = -R * 0.75 + Math.sin(a) * R * 0.35; circle(x, y, 1.1, '#3b5bb5'); circle(x - 0.3, y - 0.3, 0.3, 'rgba(255,255,255,.5)'); }
  },
  watermelon(st, sw) {
    vine(sw, [3.5, 4.5, 5][st - 2], '#4f9e3e');
    if (st === 3) { pg([[3, -6], [5.8, -11.5], [7.6, -10], [4.4, -5.2]], '#f7c531'); ellipse(-2.5, -2.2, 3.5, 2.6, '#6fae4a'); }
    if (st === 4) {
      ellipse(0, -4.5, 9, 6, '#3f8f35');
      for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.ellipse(k * 1.5, -4.5, 1, 5.6, 0, 0, Math.PI * 2); ctx.fillStyle = '#2a6a2a'; ctx.fill(); }
      ellipse(-3, -7, 3, 1.6, 'rgba(255,255,255,.18)');
    }
  },
  melon(st, sw) {
    vine(sw, [3.5, 4.5, 5][st - 2], '#5aa64a');
    if (st === 3) ellipse(-2, -2.2, 3, 2.6, '#b8d68a');
    if (st === 4) {
      circle(0, -5.5, 6.5, '#e3d98a', '#b8a95a', 0.5);
      for (let k = 0; k < 4; k++) { line(-5 + k * 3, -10, -3 + k * 3, -1, 'rgba(160,140,70,.6)', 0.5); line(5 - k * 3, -10, 3 - k * 3, -1, 'rgba(160,140,70,.6)', 0.5); }
    }
  },
  grape(st, sw) {
    // trellis: two posts and a wire
    line(-7, 0.5, -7, -18, '#8a5a36', 1.4); line(7, 0.5, 7, -18, '#8a5a36', 1.4); line(-7, -16, 7, -16, '#8a5a36', 0.6);
    stem(0, 0, sw * 4, -16, '#6b4a2a', 1.4, 1);
    const n = [3, 5, 6][st - 2];
    for (let k = 0; k < n; k++) { const x = -6 + k * 12 / (n - 1 || 1) + sw * 3; leaf(x, -16, 4.5, 3, k % 2 ? -1 : -2.2, k % 2 ? '#4f9a3a' : '#5fae47'); }
    if (st >= 3) [-4, 0.5, 4.5].forEach((x, k) => {
      x += sw * 3;
      const col = st === 4 ? '#6b3a8a' : '#a8d06a';
      for (let r = 0; r < 4; r++) for (let c = 0; c <= 3 - r; c++) circle(x - (3 - r) * 0.9 + c * 1.8, -14 + r * 1.7, st === 4 ? 1.05 : 0.8, col);
    });
  },
  tulip(st, sw, ts, seed) {
    const H = [7, 11, 12][st - 2], col = ['#e5484d', '#f2c230', '#e88bb7', '#a46ef0'][Math.abs(Math.floor(seed * 7)) % 4], tip = sw * H;
    stem(0, 0, tip, -H, '#4f9a3a', 1.1);
    leaf(0, -1, 6, 1.8, -2.2, '#5fae47'); leaf(0, -1, 6, 1.8, -0.9, '#4f9a3a');
    if (st === 3) ellipse(tip, -H - 1.5, 1.6, 2.6, '#9ad16a');
    if (st === 4) { pg([[tip - 2.6, -H - 4], [tip - 1.2, -H - 1], [tip, -H - 3], [tip + 1.2, -H - 1], [tip + 2.6, -H - 4], [tip + 2.2, -H + 0.6], [tip - 2.2, -H + 0.6]], col); ellipse(tip, -H + 0.4, 2.2, 1, shade(col, -0.2)); }
  },
  rose(st, sw) {
    bush([5, 6.5, 7][st - 2], sw, '#3f7d3f');
    [[-3, -6], [3, -8], [0, -11]].forEach(([x, y]) => {
      x += sw * 3;
      if (st === 3) { ellipse(x, y, 1, 1.5, '#c8203a'); pg([[x - 1, y + 0.6], [x, y + 1.6], [x + 1, y + 0.6]], '#3f8f34'); }
      if (st === 4) {
        for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2 + 0.3; circle(x + Math.cos(a) * 1.3, y + Math.sin(a) * 1.05, 1.35, p % 2 ? '#c81d39' : '#de2d47'); }
        circle(x, y, 1.3, '#e8475e');
        ctx.beginPath(); ctx.arc(x, y, 0.8, 0.3, Math.PI * 1.7); ctx.strokeStyle = '#9b1730'; ctx.lineWidth = 0.45; ctx.stroke();
        ellipse(x - 0.6, y - 0.7, 0.5, 0.3, 'rgba(255,255,255,.45)');
      }
    });
  },
  sunflower(st, sw) {
    const H = [14, 24, 30][st - 2], tip = sw * H * 0.7;
    stem(0, 0, tip, -H, '#5d9e36', 1.8, 1);
    leaf(tip * 0.3, -H * 0.3, 7, 3, -2.7, '#5aa13a'); leaf(tip * 0.5, -H * 0.5, 7, 3, -0.45, '#4f9634');
    if (st === 2) leaf(tip, -H, 4, 2, -Math.PI / 2, '#78c04f');
    if (st === 3) { circle(tip, -H, 3.6, '#7dbb4a'); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; circle(tip + Math.cos(a) * 3.4, -H + Math.sin(a) * 3.4, 0.9, '#f7d14a'); } }
    if (st === 4) {
      ctx.save(); ctx.translate(tip, -H); ctx.rotate(sw * 0.8);
      for (let k = 0; k < 14; k++) { ctx.save(); ctx.rotate(k / 14 * Math.PI * 2); ellipse(5.4, 0, 3, 1.35, k % 2 ? '#f7c531' : '#f5b81f'); ctx.restore(); }
      circle(0, 0, 4.6, '#7a4a22');
      ctx.restore();
    }
  },
  pumpkin(st, sw) {
    vine(sw, [3.5, 4.5, 5][st - 2], '#4f9e3e');
    if (st === 3) { pg([[3, -6], [5.8, -11.5], [7.6, -10], [4.4, -5.2]], '#f7c531'); circle(-2.5, -2.2, 3.5, '#89c25a', '#6ea544', 0.5); }
    if (st === 4) {
      const cy = -5.2;
      ellipse(-5, cy, 4.6, 6, '#e27c1f'); ellipse(5, cy, 4.6, 6, '#e27c1f');
      ellipse(-2.5, cy, 4, 6.4, '#f28c28'); ellipse(2.5, cy, 4, 6.4, '#f28c28');
      ellipse(0, cy, 3.4, 6.6, '#f79a36');
      ellipse(-2.6, cy - 2.6, 1.5, 2.5, 'rgba(255,255,255,.22)');
      rrect(-0.9, cy - 9.2, 1.8, 3.4, 0.6, '#7a5a2a');
    }
  },
};

// ---------- fruit trees ----------
// Sapling → young tree → big tree that blossoms, sets small green fruit, then ripe fruit.
function drawFruitTree(t, sx, sy, z, ts, seed) {
  const d = TREES[t.k], st = treeStage(t), fp = fruitProg(t), sw = Math.sin(ts / 1300 + seed) * 1.2;
  const sc = [0.45, 0.75, 1][st] * z;
  ellipse(sx, sy, 16 * sc, 7 * sc, 'rgba(0,0,0,.15)');
  local(sx, sy, sc, 1, () => {
    line(0, 0, sw * 0.3, -18, '#8a5a36', 4);
    line(sw * 0.2, -12, -5 + sw * 0.5, -17, '#8a5a36', 2); line(sw * 0.2, -14, 5 + sw * 0.5, -19, '#8a5a36', 2);
    ellipse(sw, -28, 15, 13, '#4f9a4b');
    ellipse(-5 + sw * 1.2, -33, 10, 9, '#62b05a');
    ellipse(5 + sw * 1.2, -36, 8, 7, '#74c169');
    if (st < 2) return;
    const spots = [[-8, -26], [6, -30], [-1, -36], [9, -23], [-10, -33], [2, -24], [-4, -30], [10, -32]];
    if (fp < 0.45) spots.forEach(([x, y], k) => { circle(x + sw, y, 1.7, d.bloom); circle(x + sw, y, 0.6, '#f6d04d'); });
    else spots.forEach(([x, y]) => { const r = fp >= 1 ? 2.6 : 1.4 + fp; circle(x + sw, y, r, fp >= 1 ? d.col : '#9acb5a'); if (fp >= 1) circle(x + sw - 0.7, y - 0.7, 0.7, 'rgba(255,255,255,.5)'); });
  });
}

// ---------- pond ----------
function drawPond(x, y, w, d, fish, ts) {
  const z = cam.z;
  flatRect(x - 0.1, y - 0.1, w + 0.2, d + 0.2, '#c9b98f', null, 0.5);
  flatRect(x + 0.05, y + 0.05, w - 0.1, d - 0.1, '#4aa8d6', null, 0.3);
  flatRect(x + 0.2, y + 0.2, w - 0.4, d - 0.4, '#5dbbe6', null, 0.3);
  for (let i = 0; i < 3; i++) {
    const u = (ts / 4000 + i / 3) % 1, a = iso(x + 0.4, y + 0.3 + u * (d - 0.6)), b = iso(x + w - 0.4, y + 0.3 + u * (d - 0.6));
    line(a.x, a.y, (a.x * 2 + b.x) / 3, (a.y * 2 + b.y) / 3, 'rgba(255,255,255,.45)', 1 * z);
  }
  for (let k = 0; k < fish; k++) {
    const ph = ts / (2500 + k * 300) + k * 1.7;
    const fx = x + w / 2 + Math.cos(ph) * (w / 2 - 0.5) * 0.8, fy = y + d / 2 + Math.sin(ph * 1.3) * (d / 2 - 0.5) * 0.8;
    const p = iso(fx, fy), dir = -Math.sin(ph) > 0 ? 1 : -1;
    ellipse(p.x, p.y, 5 * z, 2 * z, k % 4 === 3 ? 'rgba(242,140,40,.75)' : 'rgba(40,70,90,.45)');
    pg([[p.x - dir * 4.5 * z, p.y], [p.x - dir * 7 * z, p.y - 2 * z], [p.x - dir * 7 * z, p.y + 2 * z]], k % 4 === 3 ? 'rgba(242,140,40,.75)' : 'rgba(40,70,90,.45)');
  }
  const jump = (ts / 3500) % 1;
  if (fish > 0 && jump < 0.25) { const p = iso(x + w * 0.35, y + d * 0.6), u = jump / 0.25; ellipse(p.x, p.y, 10 * z * u, 4 * z * u, null, `rgba(255,255,255,${1 - u})`, 1 * z); }
  // reeds and a lily pad
  [[x + 0.15, y + d - 0.3], [x + w - 0.2, y + 0.25]].forEach(([rx, ry], k) => {
    const p = iso(rx, ry);
    for (let j = -1; j <= 1; j++) line(p.x + j * 2 * z, p.y, p.x + j * 3 * z + Math.sin(ts / 900 + j + k) * z, p.y - (14 + j * 2) * z, '#5a8f3a', 1.2 * z);
    ellipse(p.x + 1 * z, p.y - 15 * z, 1.2 * z, 3 * z, '#7a4a22');
  });
  const lp = iso(x + w * 0.6, y + d * 0.35);
  ellipse(lp.x, lp.y, 7 * z, 3 * z, '#5fae47'); circle(lp.x + 2 * z, lp.y - 1 * z, 1.5 * z, '#f7a8c8');
}

// ---------- animals ----------
const ANIM_SHADOW = { chicken: 7, duck: 7, rabbit: 7, sheep: 11, goat: 11, pig: 11, cow: 15, alpaca: 11, dog: 9, cat: 7 };
// o: { face, moving, phase, ts, seed }
function drawAnimal(k, st, sx, sy, s, o) {
  const sz = [0.62, 0.82, 1][st];
  ellipse(sx, sy, ANIM_SHADOW[k] * sz * s, ANIM_SHADOW[k] * 0.4 * sz * s, 'rgba(0,0,0,.16)');
  local(sx, sy, s * sz, o.face || 1, () => ANIMAL_DRAW[k](st, o));
}
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
      circle(0, -6.5, 5.2, '#ffe066'); ellipse(-1.2, -6.2, 2.8, 2, '#f5cf3e');
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
  duck(st, o) {
    const sw = o.moving ? Math.sin(o.phase || 0) : 0;
    ctx.rotate(sw * 0.08);   // waddle
    if (st === 0) {
      line(-1, -3, -1 - sw, 0, '#f28c28', 1.2); line(1.6, -3, 1.6 + sw, 0, '#f28c28', 1.2);
      ellipse(0, -5.5, 5.4, 4.2, '#ffe57a'); circle(4, -10, 3.4, '#ffe57a');
      rrect(6.4, -10.2, 3.6, 1.6, 0.8, '#f28c28'); circle(5, -10.8, 0.7, '#2a2018');
      return;
    }
    const body = st === 2 ? '#fbfbf7' : '#f3ecd9';
    [[-2, sw], [2, -sw]].forEach(([x, s1]) => { line(x, -5, x + s1 * 1.5, -0.5, '#f28c28', 1.3); ellipse(x + s1 * 1.5 + 1, -0.3, 2, 0.8, '#f28c28'); });
    ellipse(0, -8.5, 9, 5.8, body, '#e3dfd3', 0.6);
    pg([[-8, -10], [-11, -14], [-7, -12]], body);
    ellipse(-1, -9, 5, 3, shade(body, -0.06));
    line(5, -11, 6.5, -16, body, 4.2);
    circle(7, -17.5, 3.8, st === 2 && (o.seed || 0) % 2 > 1 ? '#3f8f5a' : body);
    rrect(9.6, -17.8, 5, 2.2, 1, '#f28c28');
    circle(8.2, -18.5, 0.8, '#2a2018');
  },
  rabbit(st, o) {
    const hop = o.moving ? Math.abs(Math.sin(o.phase || 0)) * 4 : 0;
    const col = '#efe6da', dark = '#d8c9b6';
    ctx.translate(0, -hop);
    if (st === 0) {
      circle(0, -4.5, 4.6, col); circle(3.6, -7.6, 3.3, col);
      ellipse(2.6, -11.6, 0.9, 2.6, col, null, 0, -0.2); ellipse(4.4, -11.4, 0.9, 2.6, col, null, 0, 0.15);
      circle(-4.2, -5, 1.5, '#fff'); circle(4.8, -8.2, 0.65, '#2a2018'); circle(6.7, -7.4, 0.55, '#f2a0ad');
      return;
    }
    ellipse(-3, -1.6, 4, 1.8, dark); ellipse(0, -7, 7.5, 5.8, col); circle(-7.4, -8.4, 2.4, '#fff');
    ellipse(4.6, -1.2, 2, 1.2, dark); circle(6.6, -11, 4.3, col);
    const earW = Math.sin((o.ts || 0) / 800 + (o.seed || 0)) * 0.12;
    [[4.4, -14.2, -0.35], [6.6, -14.6, -0.05]].forEach(([x, y, a], k) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a + earW); ellipse(0, -4.6, 1.6, 5, k ? col : shade(col, -0.06)); ellipse(0, -4.6, 0.8, 3.7, '#f6b7c0'); ctx.restore(); });
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
    ellipse(10, -13, 3.4, 4.2, face); ellipse(8, -15.4, 2.2, 1, face, null, 0, -0.5); circle(9.2, -16.8, 2.2, wool); circle(11.2, -13.6, 0.7, '#fff');
  },
  goat(st, o) {
    const fur = st === 0 ? '#e9e1d4' : '#d7c3a5', dark = '#8a6a4a';
    legs4([-5, 5], -6, st === 0 ? 1.4 : 1.8, fur, o);
    ellipse(0, -10, 8.5, 5, fur);
    ellipse(-1, -12, 6, 2, 'rgba(255,255,255,.25)');
    pg([[-8, -12], [-10, -16], [-7, -13]], fur);   // little tail up
    line(6, -12, 8.5, -17, fur, 4);
    ellipse(10, -18, 3.2, 3.8, fur);
    ellipse(12.5, -16.5, 1.8, 1.4, shade(fur, -0.1));
    ellipse(8, -19, 2.4, 1, fur, null, 0, -0.4);
    circle(11, -19, 0.7, '#2a2018');
    if (st >= 1) pg([[11.5, -14.5], [12.5, -11], [10.5, -14]], shade(fur, -0.15));   // beard
    if (st === 2) { ctx.beginPath(); ctx.arc(8.5, -24, 3.5, 0.6, 2.2); ctx.strokeStyle = dark; ctx.lineWidth = 1.4; ctx.stroke(); ctx.beginPath(); ctx.arc(10, -24.2, 3.5, 0.6, 2.2); ctx.stroke(); }
  },
  pig(st, o) {
    const pink = '#f6b3b9', dark = '#e48b97';
    if (st === 0) {
      legs4([-3, 3], -3, 1.4, pink, o);
      ellipse(0, -5.5, 6, 4.4, pink); circle(5.6, -7, 3.6, pink); ellipse(8.6, -6.6, 1.5, 1.8, dark);
      pg([[4.6, -9.6], [5.8, -12.2], [7, -9.6]], dark); circle(6.4, -7.8, 0.6, '#2a2018');
      return;
    }
    legs4([-6, 6], -5, 2.6, pink, o);
    ellipse(0, -9, 11, 7.2, pink); ellipse(-2, -6, 7, 3, 'rgba(255,255,255,.18)');
    ctx.beginPath(); ctx.arc(-12, -11, 1.8, 0, Math.PI * 1.6); ctx.strokeStyle = dark; ctx.lineWidth = 1.1; ctx.stroke();
    circle(10, -11, 5.4, pink); pg([[8, -14.6], [10.6, -18.6], [12, -14]], dark);
    ellipse(14.6, -10.2, 2.2, 2.6, dark); circle(14.1, -10.8, 0.5, '#9a4a5a'); circle(15.1, -9.6, 0.5, '#9a4a5a');
    circle(11.4, -12.4, 0.75, '#2a2018');
  },
  cow(st, o) {
    const calf = st === 0, base = calf ? '#c98f5b' : '#fbfbf7', spot = calf ? '#fff3e2' : '#2e2a28';
    legs4([-8, 7], -9, calf ? 2.2 : 2.8, base, o);
    [-8, 7].forEach(x => line(x - 0.6, -0.3, x + 0.8, -0.3, '#4a3a30', 2));
    const tw = Math.sin((o.ts || 0) / 500 + (o.seed || 0)) * 2;
    line(-12, -19, -13.5 + tw, -9, shade(base, -0.2), 1); circle(-13.5 + tw, -8.5, 1.4, spot);
    ctx.save(); ctx.beginPath(); ctx.roundRect(-12.5, -22, 25, 13.5, 5); ctx.fillStyle = base; ctx.fill(); ctx.clip();
    ellipse(-6, -17, 4, 3, spot); ellipse(3, -12.6, 5, 3.4, spot); ellipse(9, -19.6, 3, 2.5, spot);
    ctx.restore();
    if (st === 2) ellipse(2, -8.4, 3, 2, '#f2a7b0');
    rrect(10, -27, 8, 9.5, 3, base); ellipse(14, -25, 2.5, 2, spot);
    rrect(13, -21, 6.4, 4.6, 2, '#f2b8b0'); circle(15, -19, 0.5, '#9a5a5a'); circle(17.4, -19, 0.5, '#9a5a5a');
    circle(14.6, -23.4, 0.85, '#2a2018'); ellipse(10.2, -25, 2.6, 1.2, shade(base, -0.1), null, 0, 0.3);
    if (st === 2) { line(11.6, -27, 10.6, -30.4, '#f1e3c2', 1.4); line(16, -27, 17, -30.4, '#f1e3c2', 1.4); circle(11, -16.4, 1.8, '#f2c230', '#c99a18', 0.5); }
  },
  alpaca(st, o) {
    const wool = st === 0 ? '#fbf3e4' : '#efe0c4';
    legs4([-4, 4], -7, 1.8, shade(wool, -0.1), o);
    [[-5, -11, 4.6], [0, -12.5, 5.2], [4, -11, 4.4], [-1, -8.5, 4.6]].forEach(([x, y, r]) => circle(x, y, r, wool, shade(wool, -0.08), 0.5));
    const neck = st === 0 ? 7 : 10;
    for (let j = 0; j < 4; j++) circle(5.5 + j * 0.4, -14 - j * neck / 4, 2.8, wool);
    ellipse(7.5, -15 - neck, 3, 3.4, wool);
    ellipse(10, -14.4 - neck, 1.8, 1.4, shade(wool, -0.15));
    pg([[6, -18 - neck], [6.5, -21 - neck], [7.5, -18 - neck]], shade(wool, -0.1)); pg([[8, -18 - neck], [8.8, -21 - neck], [9.4, -18 - neck]], shade(wool, -0.1));
    circle(8.6, -15.6 - neck, 0.7, '#2a2018');
  },
  // Dogs and cats come in breeds (PET_BREEDS) and show how they feel (o.mood: happy / ok / sad).
  dog(st, o) {
    const B = PET_BREEDS[o.breed] || PET_BREEDS.shiba, fur = B.col, belly = B.belly, ts = o.ts || 0, mood = o.mood || 'ok', sad = mood === 'sad';
    const pup = st === 0, hs = pup ? 1.3 : 1, legH = B.short ? 3.8 : pup ? 4.4 : B.big ? 7 : 6;
    const wag = sad ? 0 : Math.sin(ts / (o.moving ? 140 : mood === 'happy' ? 75 : 120)) * 0.45;
    const bw = B.big ? 9.2 : 8.4, bh = B.big ? 5.3 : 4.7, by = -legH - bh * 0.62, droop = sad ? 1.6 : 0;
    // tail: curled (shiba), stub (corgi), pom-pom (poodle) or a feathery plume
    ctx.save(); ctx.translate(-bw + 0.8, by - 1.2);
    if (B.tail === 'curl') { ctx.rotate(wag * 0.5); ctx.beginPath(); ctx.arc(0.6, -3, 2.5, Math.PI * 0.6, Math.PI * 2.25); ctx.strokeStyle = fur; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.stroke(); circle(2.9, -4.2, 1, belly); }
    else if (B.tail === 'stub') circle(0, 0.4, 1.7, fur);
    else if (B.tail === 'pom') { ctx.rotate(-0.7 + wag); line(0, 0, -1, -4, fur, 1.4); circle(-1.2, -4.9, 2.1, shade(fur, 0.08)); }
    else { ctx.rotate(-0.55 + wag + droop * 0.5); ellipse(-1.3, -3.4, 2.3, 4.6, fur); ellipse(-1.5, -5.4, 1.3, 2.2, belly); }
    ctx.restore();
    legs4([-bw * 0.58, bw * 0.55], -legH, B.big ? 2.5 : 2.2, fur, o);
    if (B.curly) for (let k = -2; k <= 2; k++) circle(k * bw * 0.32, by - (2 - Math.abs(k)) * 0.4, bh * 0.78, k % 2 ? fur : shade(fur, 0.07));
    else { ellipse(0, by, bw, bh, fur); ellipse(1.2, by + bh * 0.42, bw * 0.62, bh * 0.45, belly); ellipse(-2, by - bh * 0.45, bw * 0.5, bh * 0.25, shade(fur, 0.1)); }
    const hx = bw - 0.8, hy = by - bh - 1.6 * hs + droop;
    ellipse(hx - 1.4, hy + 3.4 * hs, 1.3, 2.6 * hs, '#e5484d', null, 0, 0.35);   // red collar
    circle(hx - 0.6, hy + 5 * hs, 0.9, '#f2c230');                                 // tag
    ctx.save(); ctx.translate(hx, hy); ctx.scale(hs, hs);
    const r = 4.8;
    if (B.ears === 'up' || B.ears === 'big') {
      const eh = B.ears === 'big' ? 5.8 : 4.4, tilt = sad ? 1.6 : 0;
      pg([[-3.2, -2.4], [-2.6 - tilt, -2.4 - eh + tilt], [0.4, -3.8]], fur); pg([[0.2, -4], [2 + tilt * 0.3, -4 - eh + tilt], [3.4, -2.5]], fur);
      pg([[-2.5, -2.9], [-2.3 - tilt, -2.4 - eh * 0.72 + tilt], [-0.5, -3.6]], '#f2b0a4');
    }
    circle(0, 0, r, fur);
    if (B.curly) for (let k = 0; k < 6; k++) { const a = -Math.PI * 0.95 + k * 0.38; circle(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92, 1.9, shade(fur, 0.05)); }
    if (B.mask) { ctx.beginPath(); ctx.moveTo(-1, -1.4); ctx.quadraticCurveTo(2, -2.6, 4.6, -0.6); ctx.lineTo(4.6, 4); ctx.quadraticCurveTo(0, 5.4, -2.6, 2.4); ctx.closePath(); ctx.fillStyle = belly; ctx.fill(); ellipse(0.2, -2.4, 1.2, 0.7, belly); }
    ellipse(4.1, 1.3, 2.9, 2.2, belly);
    circle(6.4, 0.5, 1.1, '#2a2018'); circle(6.1, 0.2, 0.35, 'rgba(255,255,255,.6)');
    ctx.beginPath(); ctx.moveTo(6.2, 1.5); ctx.quadraticCurveTo(5.4, 2.8, 4.2, 2.4); ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 0.5; ctx.stroke();
    if (mood === 'happy' && !o.moving) ellipse(4.8, 3.3, 0.95, 1.4, '#f07a8a');
    const blink = Math.sin(ts / 1900 + (o.seed || 0) * 5) > 0.97;
    if (sad || blink) { ctx.beginPath(); ctx.arc(1.9, -0.7, 0.9, 0.2, Math.PI - 0.2); ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.6; ctx.stroke(); }
    else { circle(1.9, -0.8, 1, B.eyes || '#2a2018'); if (B.eyes) circle(1.9, -0.8, 0.45, '#1a1410'); circle(2.2, -1.1, 0.35, '#fff'); }
    if (B.ears === 'flop') { ctx.save(); ctx.translate(-1.4, -2.8); ctx.rotate(0.3 + droop * 0.12); ellipse(0, 2.6, 2, 3.8, shade(fur, -0.12)); ctx.restore(); }
    ctx.restore();
  },
  cat(st, o) {
    const B = PET_BREEDS[o.breed] || PET_BREEDS.tabby, fur = B.col, ts = o.ts || 0, mood = o.mood || 'ok', sad = mood === 'sad';
    const hs = st === 0 ? 1.3 : 1, sway = Math.sin(ts / 600 + (o.seed || 0)) * (sad ? 0.1 : 0.4), pt = B.point || fur;
    // tail: a soft curve rising behind (it hangs low when sad)
    ctx.save(); ctx.translate(-6, -7.2);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-3.4 + sway * 3, -3.6 + (sad ? 4 : 0), -1 + sway * 4, sad ? -1 : -9);
    ctx.strokeStyle = B.point || fur; ctx.lineWidth = B.fluffy ? 3.4 : 2; ctx.lineCap = 'round'; ctx.stroke();
    if (B.stripe) circle(-1 + sway * 4, sad ? -1 : -9, 1.1, B.stripe);
    ctx.restore();
    legs4([-3.5, 3.5], -4.5, 1.6, fur, o);
    if (B.point) [-3.5, 3.5].forEach(x => ellipse(x + 0.5, -0.3, 1.2, 0.7, shade(pt, 0.2)));
    ellipse(0, -7.2, B.fluffy ? 7.2 : 6.5, B.fluffy ? 4.4 : 3.8, fur);
    ellipse(1.2, -5.6, 4.2, 1.8, B.belly);
    if (B.stripe) [-3.6, -1, 1.6].forEach(x => { ctx.beginPath(); ctx.moveTo(x, -10.6); ctx.quadraticCurveTo(x + 1.1, -8.6, x + 0.4, -6.9); ctx.strokeStyle = B.stripe; ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.stroke(); });
    if (B.spots) { ellipse(-3, -8.6, 2.7, 1.9, B.spots[0]); ellipse(2.2, -9.6, 2, 1.4, B.spots[1]); }
    ctx.save(); ctx.translate(6, -11 + (sad ? 1 : 0)); ctx.scale(hs, hs);
    const ear = B.point || (B.spots ? B.spots[0] : fur);
    pg([[-3.1, -1.4], [-2.6, -6.2 + (sad ? 1.5 : 0)], [-0.1, -3.2]], ear); pg([[0.5, -3.4], [3.3, -6 + (sad ? 1.5 : 0)], [3.5, -1.1]], ear);
    pg([[-2.4, -2.2], [-2.2, -4.9 + (sad ? 1.2 : 0)], [-0.9, -3.2]], '#f3b4a8'); pg([[1.3, -3.2], [2.8, -4.9 + (sad ? 1.2 : 0)], [2.8, -2.1]], '#f3b4a8');
    circle(0, 0, 3.9, fur);
    if (B.point) ellipse(1.7, 1, 2.5, 2.1, shade(B.point, 0.3));
    if (B.stripe) { line(-0.6, -3.6, -0.4, -2.2, B.stripe, 0.7); line(0.6, -3.8, 0.6, -2.4, B.stripe, 0.7); }
    if (B.spots) ellipse(-1.6, -1.7, 1.8, 1.6, B.spots[1]);
    const blink = Math.sin(ts / 2100 + (o.seed || 0) * 7) > 0.97;
    [[0.6, -0.5], [2.8, -0.2]].forEach(([ex, ey]) => {
      if (sad || blink) { ctx.beginPath(); ctx.arc(ex, ey - 0.3, 0.75, 0.25, Math.PI - 0.25); ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.55; ctx.stroke(); }
      else { ellipse(ex, ey, 0.85, 1, B.eyes || '#8bbf3a'); ellipse(ex, ey, 0.3, 0.85, '#1a1410'); circle(ex + 0.25, ey - 0.35, 0.22, '#fff'); }
    });
    pg([[3.3, 0.8], [4.3, 0.8], [3.8, 1.5]], '#f07a8a');
    ctx.beginPath(); ctx.moveTo(3.8, 1.5); ctx.quadraticCurveTo(3.4, 2.3, 2.8, 2); ctx.moveTo(3.8, 1.5); ctx.quadraticCurveTo(4.2, 2.3, 4.8, 2);
    ctx.strokeStyle = '#3a2a20'; ctx.lineWidth = 0.4; ctx.stroke();
    [[-0.3, 0.3], [0.1, 0.7]].forEach(([d, e]) => line(4.4, 1.2 + d, 7.2, 0.6 + e * 1.2, 'rgba(255,255,255,.85)', 0.25));
    ctx.restore();
  },
};
