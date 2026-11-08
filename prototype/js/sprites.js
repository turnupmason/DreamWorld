'use strict';
// Living things: townies (with arms, legs, poses and moods), crops at every growth stage, animals from baby
// to adult, fruit trees and fish. Sprites draw in a local frame: feet/base at (0, 0), facing +x, 1 unit = 1 px at zoom 1.

// ---------- townies (v0.28: redrawn) ----------
// Chibi proportions: a big round head on a short body, big shiny eyes, hair with real shapes (a fringe, side locks,
// a bun, curls) and a thin dark outline around each body part, so people read clearly on any ground.
// Feet at (0, 0), facing +x, about 38 units tall. Mood shows on the face only; the body never changes with data.

// A pose is a skeleton. Hips, torso, arms and head are in the body frame, which moves up and down by `lift`
// (crouching is a negative lift). Knees and feet are in the ground frame, so feet stay planted.
// `air` lifts the whole person (jumping). o: { look, face: 1|-1, back, moving, phase, pose, energy, ts, seed, wave }
// face: which way the townie looks on screen (1 = right). back: walking away from the camera, so we see the back of the head.
// The poses are written for the older, taller body; pFit() squeezes them into the chibi body.
function skeleton(pose, o) {
  const ts = o.ts || 0, seed = o.seed || 0, ph = o.phase || 0;
  const tired = o.energy === 'tired' || o.energy === 'exhausted';
  const breathe = Math.sin(ts / 700 + seed) * 0.3;
  const k = {
    lift: 0, lean: 0, air: 0, top: -23.5 + breathe * 0.35, prop: null, sway: 0,
    legs: [{ h: [-1.6, -10], k: [-1.5, -5], f: [-1.6, 0] }, { h: [1.6, -10], k: [1.7, -5], f: [1.6, 0] }],
    arms: [{ s: [-0.6, -20.5], e: [-1.2, -16], h: [-1.4, -12] }, { s: [0.8, -20.5], e: [1.4, -16], h: [1.6, -12] }],
    head: [0.4, -30 + breathe + (o.energy === 'exhausted' ? 1.2 : 0)],
  };
  const sw = Math.sin(ph), cw = Math.cos(ph);
  switch (pose) {
    case 'walk': {   // v0.20: softer: knees lift on the swing, elbows bend on the way forward, a little lean
      const step = tired ? 3 : 4.2, up0 = Math.max(0, -sw), up1 = Math.max(0, sw);
      k.lift = Math.abs(cw) * (o.energy === 'great' ? 1.8 : tired ? 0.6 : 1.1);
      k.lean = tired ? 0.9 : 0.45;
      k.legs[0].f = [-1.6 - sw * step, -up0 * 2.1]; k.legs[0].k = [-1.6 - sw * step / 2 + 0.8 + up0 * 1.1, -5.2 - up0 * 1.2];
      k.legs[1].f = [1.6 + sw * step, -up1 * 2.1]; k.legs[1].k = [1.6 + sw * step / 2 + 0.8 + up1 * 1.1, -5.2 - up1 * 1.2];
      k.arms[0].e = [-1 + sw * 1.7, -16.3]; k.arms[0].h = [-1.4 + sw * 3.8 + Math.max(0, sw) * 1.1, -12 - Math.max(0, sw) * 1.8];
      k.arms[1].e = [1.2 - sw * 1.7, -16.3]; k.arms[1].h = [1.6 - sw * 3.8 + Math.max(0, -sw) * 1.1, -12 - Math.max(0, -sw) * 1.8];
      k.head[1] += Math.abs(Math.sin(ph + 0.5)) * 0.35;   // the head settles a beat after each step
      k.sway = -Math.sin(ph - 0.6);                        // hair, skirts and hoods swing a little behind
      if (o.energy === 'exhausted') k.lean = 1.2;
      break;
    }
    case 'run': {
      k.lift = Math.abs(cw) * 2.2; k.lean = 1.6;
      k.legs[0].f = [-1.6 - sw * 6, -Math.max(0, -sw) * 3]; k.legs[0].k = [-1.6 - sw * 3 + 2, -6 - Math.max(0, -sw) * 1.5];
      k.legs[1].f = [1.6 + sw * 6, -Math.max(0, sw) * 3]; k.legs[1].k = [1.6 + sw * 3 + 2, -6 - Math.max(0, sw) * 1.5];
      k.arms[0].e = [-2.5 + sw * 2.5, -16.5]; k.arms[0].h = [sw * 4, -14 - Math.max(0, sw) * 2];
      k.arms[1].e = [2.5 - sw * 2.5, -16.5]; k.arms[1].h = [4 - sw * 4, -14 - Math.max(0, -sw) * 2];
      k.sway = -Math.sin(ph - 0.6) * 1.4;
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
        k.legFront = false;
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
      k.legs[1] = { h: [1, -10], k: [0.9, -5], f: [0.8, 0] };
      k.legs[0] = { h: [-1, -10], k: [-5.5, -8.5], f: [0.2, -6.5] };
      k.prop = 'mat';
      break;
    }
    case 'jacks': {
      const u = (Math.sin(ts / 170) + 1) / 2;
      k.air = u * 3;
      k.legs[0].f = [-1.6 - u * 4, 0]; k.legs[0].k = [-1.6 - u * 2, -5];
      k.legs[1].f = [1.6 + u * 4, 0]; k.legs[1].k = [1.6 + u * 2, -5];
      break;
    }
    case 'dance': {
      const u = Math.sin(ts / 260), v = Math.sin(ts / 520);
      k.lean = u * 1.2; k.air = Math.abs(u) * 1.2;
      k.legs[0].f = [-2.5 + v * 1.5, 0]; k.legs[1].f = [2.5 + v * 1.5, -Math.max(0, u) * 2];
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
const HEAD_R = 8.8;                                // head radius
const HIP_Y = -8.6;                                // hip height
const bodyY = y => HIP_Y + (y + 10) * 0.79;        // a height in the old skeleton's body frame → the shorter chibi torso
// The skeleton squeezed into the chibi body: legs and torso a bit shorter, the head lower and bigger.
// Arms that used to reach above the small head now go out to the side or in front, where the big head can't hide them.
function pFit(k, pose, o) {
  const sq = p => [p[0], p[1] * 0.86], by = p => [p[0], bodyY(p[1])];
  const out = { ...k, lift: k.lift * 0.86, legs: k.legs.map(l => ({ h: sq(l.h), k: sq(l.k), f: sq(l.f) })),
    arms: k.arms.map(a => ({ s: by(a.s), e: by(a.e), h: by(a.h) })), top: bodyY(k.top), head: [k.head[0], bodyY(k.head[1]) - 3.2] };
  if (pose === 'sit' && o.seatH) { out.lift = o.seatH + 1 + HIP_Y; out.legs.forEach(l => { l.k = [l.k[0], -(o.seatH + 1)]; }); }
  const ts = o.ts || 0, A = out.arms;
  if (o.wave || pose === 'wave') { A[1].e[0] += 1.6; A[1].h[0] += 3; }
  if (pose === 'pick') { A[1].e[0] += 2; A[1].h[0] += 4.2; }
  if (pose === 'yoga') { A[0] = { s: A[0].s, e: [2, -13.4], h: [4.3, -15.2] }; A[1] = { s: A[1].s, e: [3, -13.2], h: [4.7, -15] }; }   // hands together at the chest
  if (pose === 'jacks') {   // star jumps: arms swing out to the side and up
    const u = (Math.sin(ts / 170) + 1) / 2, a = 0.2 + u * 1.75;
    [0, 1].forEach(i => { const g = i ? 1 : -1, s0 = A[i].s; A[i] = { s: s0, e: [s0[0] + g * Math.sin(a) * 3.7, s0[1] + Math.cos(a) * 3.7], h: [s0[0] + g * Math.sin(a) * 7.4, s0[1] + Math.cos(a) * 7.4] }; });
  }
  if (pose === 'dance') { const u = Math.sin(ts / 260); A[0] = { s: A[0].s, e: [-4.4, -18.6], h: [-8.6 + u, -21.4 - Math.max(0, u) * 1.6] }; }
  return out;
}

// Outlines: each part is drawn twice, first as a slightly wider dark stroke (INK on), then filled on top, so a part
// gets an outline where it meets the ground or another part, but not inside itself.
let INK = false;
const INK_COL = '#45312a';
// The outline is every shape of the part grown a little, collected into one path and filled dark in one go (much
// cheaper than stroking each shape). All shapes go round clockwise, so where they overlap they add up, never cancel.
// Far away (small on screen) people skip the outline.
const INK_W = 0.65;
let INK_SKIP = false;
function pPart(fn) {
  if (!INK_SKIP) { INK = true; ctx.beginPath(); fn(); ctx.fillStyle = INK_COL; ctx.fill(); INK = false; }
  fn();
}
function pBegin() { if (!INK) ctx.beginPath(); }
// Fill the path that build() makes; in the outline pass, add the same path scaled up about its middle (cx, cy)
// so that a w × h shape grows by INK_W all round.
function pShape(col, cx, cy, w, h, build) {
  if (INK) { ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + 2 * INK_W / w, 1 + 2 * INK_W / h); ctx.translate(-cx, -cy); build(); ctx.restore(); }
  else { build(); ctx.fillStyle = col; ctx.fill(); }
}
function pEll(x, y, rx, ry, col, rot = 0) {
  const k = INK ? INK_W : 0, a = Math.max(0.01, rx + k), b = Math.max(0.01, ry + k);
  if (INK) ctx.moveTo(x + a * Math.cos(rot), y + a * Math.sin(rot)); else ctx.beginPath();
  ctx.ellipse(x, y, a, b, rot, 0, Math.PI * 2);
  if (!INK) { ctx.fillStyle = col; ctx.fill(); }
}
function pRect(x, y, w, h, r, col) {
  const k = INK ? INK_W : 0;
  if (!INK) ctx.beginPath();
  ctx.roundRect(x - k, y - k, w + 2 * k, h + 2 * k, r + k);
  if (!INK) { ctx.fillStyle = col; ctx.fill(); }
}

function drawPerson(sx, sy, s, o) {
  const L = o.look, ts = o.ts || 0, seed = o.seed || 0, energy = o.energy || 'good';
  INK_SKIP = s < 0.45;
  const pose = o.pose || (o.moving ? 'walk' : 'stand');
  if (pose === 'swim') return drawSwimmer(sx, sy, s, o);
  if (pose === 'lie') return drawLying(sx, sy, s, o);
  // walking straight towards the camera or away from it: a real front / back view, legs stepping in place
  if ((o.view === 'front' || o.view === 'back') && L.mob !== 'wheel' && ['walk', 'run', 'stand', 'sneak'].includes(pose)) return drawPersonFront(sx, sy, s, o, pose);
  if (L.mob === 'wheel') { ellipse(sx, sy, 9 * s, 3.6 * s, 'rgba(0,0,0,.18)'); return drawWheelPerson(sx, sy, s, o, pose); }
  if (pose === 'bike') { ellipse(sx, sy, 12 * s, 3.6 * s, 'rgba(0,0,0,.18)'); return drawRider(sx, sy, s, o); }
  const k = pFit(skeleton(pose, o), pose, o);
  let air = k.air;
  if (pose === 'stand' && energy === 'great' && !o.wave) air += Math.max(0, Math.sin(ts / 240 + seed)) * 2.5;
  ellipse(sx, sy, (8 - air * 0.5) * s, (3.4 - air * 0.2) * s, 'rgba(0,0,0,.18)');
  const C = outfitOf(L), lean = k.lean, lift = k.lift, BD = bodyOf(L);
  const B = p => [p[0] + lean, p[1] - lift];
  const hx = k.head[0] + lean, hy = k.head[1] - lift, T = o.back ? 0.5 : 0.62;   // seen from the side, the face is turned 3/4 towards us
  local(sx, sy, s, o.face || 1, () => {
    if (k.prop === 'mat') pg([[-9, 0.5], [9, 0.5], [7, 2.5], [-11, 2.5]], o.matCol || '#8b7fe0');
    ctx.translate(0, -air);
    ctx.scale(BD.w, BD.h);   // v0.18: the body's build
    pPart(() => pArm(B(k.arms[0].s), B(k.arms[0].e), B(k.arms[0].h), C, true));
    pPart(() => pLeg(k.legs[0], lift, lean, C, true));
    if (!k.legFront) pPart(() => pLeg(k.legs[1], lift, lean, C));
    if (!o.back) unscaled(hx, hy, BD, () => pPart(() => hairBack(hx, hy, L, T, false, k.sway)));   // long hair falls behind the shoulders
    ctx.save(); ctx.translate(lean, -lift);
    pPart(() => torsoSide(C, k.top, k.sway, o.back));
    ctx.restore();
    if (k.legFront) pPart(() => pLeg(k.legs[1], lift, lean, C));
    unscaled(hx, hy, BD, () => drawHead(hx, hy, L, energy, ts, seed, T, !!o.back, k.sway, !!o.back));
    pPart(() => pArm(B(k.arms[1].s), B(k.arms[1].e), B(k.arms[1].h), C));
    drawProp(k, ts, B);
  });
  sleepyZ(sx, sy, s, energy, ts, seed, 40 + air);
}
// ---------- bodies and clothes (v0.18) ----------
const bodyOf = L => BODY_TYPES[(L && L.body) || 'regular'] || BODY_TYPES.regular;
const wearing = (L, slot) => (L && L[slot]) || { top: 'tshirt', bottom: 'jeans', shoes: 'sneakers', hat: 'nohat' }[slot];
// The head keeps its size on a wider / taller body.
function unscaled(cx, cy, B, fn) { ctx.save(); ctx.translate(cx, cy); ctx.scale(1 / B.w, 1 / B.h); ctx.translate(-cx, -cy); fn(); ctx.restore(); }
// What someone is wearing, as colours for each body part.
function outfitOf(L) {
  const top = wearing(L, 'top'), bot = wearing(L, 'bottom'), dress = top === 'dress', skirt = !dress && bot === 'skirt';
  const pants = L.pants || '#4a5a78', skin = L.skin || '#f3c59f';
  return { top, bot, dress, skirt, shirt: L.shirt || '#5aa2e0', pants, skin, inner: L.inner || '#f4f4f0',
    thigh: dress || skirt ? skin : pants, calf: dress || skirt || bot === 'shorts' ? skin : pants, hem: !dress && bot === 'shorts' ? shade(pants, -0.15) : null,
    sleeve: { hoodie: 1, sweater: 1, jacket: 1, dress: 0.3 }[top] || 0.55, shoes: wearing(L, 'shoes'), shoeCol: L.shoeCol || '#3b3028' };
}
// A hat on a head at (cx, cy). T: which way the face turns (the cap's brim points that way).
function hat(cx, cy, L, T = 0.62, back = false) {
  const k = wearing(L, 'hat'), col = L.hatCol || '#e5484d', R = HEAD_R + 1, dk = shade(col, -0.15);
  if (k === 'nohat') return;
  const crown = (y0, rx, ry, c = col) => pShape(c, cx, y0 - ry / 2 + 0.6, 2 * rx, ry + 1.3, () => { pBegin(); ctx.moveTo(cx - rx, y0); ctx.ellipse(cx, y0, rx, ry, 0, Math.PI, Math.PI * 2); ctx.quadraticCurveTo(cx, y0 + 1.3, cx - rx, y0); ctx.closePath(); });
  if (k === 'cap') {
    const side = back || Math.abs(T) > 0.3;
    if (side && !back) pEll(cx + Math.sign(T) * (R - 1.2), cy - 2.3, 5, 1.6, dk);   // the brim sticks out the way we face
    crown(cy - 1.6, R, R - 0.6);
    if (!side) pEll(cx + T * 3.4, cy - 1.9, 7.8, 2.3, dk);                          // the brim, towards us
    if (!INK) { circle(cx + T * 0.8, cy - R + 1.2, 1, shade(col, 0.2)); line(cx + T * 3, cy - R + 1.6, cx + T * 4.6, cy - 2.2, shade(col, -0.1), 0.5); }
  } else if (k === 'beanie') {
    pEll(cx - (back ? -T : T) * 0.8, cy - R - 2.2, 2.6, 2.6, '#fffaf0');   // bobble
    crown(cy - 1.4, R + 0.3, R + 0.5);
    pRect(cx - R - 0.3, cy - 3.8, 2 * R + 0.6, 3.6, 1.7, dk);   // the folded cuff
    if (!INK) for (let i = -4; i <= 4; i++) line(cx + i * 2.1, cy - 3.4, cx + i * 2.1, cy - 0.7, shade(col, -0.3), 0.5);
  } else if (k === 'sunhat') {
    pEll(cx, cy - 3.6, R + 4.8, 3.4, shade(col, -0.05));   // the wide brim
    crown(cy - 4.2, 7.2, 6.6);
    if (!INK) rrect(cx - 7.1, cy - 6.4, 14.2, 2, 0.9, '#f2a33a');   // ribbon
  }
}
// The hair that hangs behind the head: long hair down to the shoulders, a bun, a cloud of curls.
function hairBack(cx, cy, L, T, back, sway = 0) {
  const hc = L.hairCol || '#2b1d14', st = L.hair || 'short', r = HEAD_R;
  if (st === 'long') {
    const tl = back ? 0 : Math.max(0, T), tr = back ? 0 : Math.max(0, -T), b = sway * 0.9;   // turned: the hair falls on the back side
    const xl = cx - r - 0.9 + tr * 8, xr = cx + r + 0.9 - tl * 8, yb = cy + (back ? 9.6 : 11), tp = back ? 1.8 : -0.3;   // from behind it tapers
    pShape(hc, (xl + xr) / 2, cy + 4.5, xr - xl, yb - cy + 4, () => {
      pBegin(); ctx.moveTo(xr, cy - 2); ctx.lineTo(xr + b - tp, yb - tl * 6);
      ctx.quadraticCurveTo((xl + xr) / 2 + b, yb + 1.8, xl + b + tp, yb - tr * 6);
      ctx.lineTo(xl, cy - 2); ctx.closePath();
    });
    if (!INK) { const m = (xl + xr) / 2; line(m - 2.6 + b * 0.5, cy + 6, m - 2.8 + b, yb - 0.5, shade(hc, -0.18), 0.6); line(m + 2.6 + b * 0.5, cy + 6, m + 2.8 + b, yb - 0.5, shade(hc, -0.18), 0.6); }
  }
  if (st === 'bun') { const x = cx - (back ? -T : T) * 3.4; pEll(x, cy - r + 0.2, 4, 3.7, hc); if (!INK) ellipse(x - 0.8, cy - r - 1.2, 1.6, 0.8, shade(hc, 0.2), null, 0, -0.4); }
  if (st === 'curly') {
    const end = 2.2 - (back ? 0 : Math.max(0, T)) * 0.25, beg = 0.8 + (back ? 0 : Math.max(0, -T)) * 0.25;
    for (let i = 0; i <= 10; i++) { const a = Math.PI * (beg + (end - beg) * i / 10); pEll(cx - T * 0.8 + Math.cos(a) * (r + 0.4), cy - 0.8 + Math.sin(a) * (r + 0.2), 3.3, 3.3, hc); }
  }
}
// The hair over the head: from behind it covers everything but the nape; from the front it stops at a fringe
// (spiky for short hair, swept for long, a neat hairline for a bun, a row of curls), with side locks for long hair.
function hairCap(cx, cy, L, T, back) {
  const hc = L.hairCol || '#2b1d14', st = L.hair || 'short', r = HEAD_R, R = r + 0.7, Ry = r * 0.95 + 0.7;
  const ang = d => Math.asin(clamp(d / Ry, -0.98, 0.98));
  if (INK && st === 'curly') return;   // the cloud of curls behind is the outline
  if (back) {
    const low = st === 'long' ? r * 0.9 : st === 'bun' ? 3.2 : 4.4, a = ang(low);
    pShape(hc, cx, cy, 2 * R, 2 * Ry, () => {
      pBegin(); ctx.moveTo(cx - R * Math.cos(a), cy + Ry * Math.sin(a)); ctx.ellipse(cx, cy, R, Ry, 0, Math.PI - a, Math.PI * 2 + a);
      ctx.quadraticCurveTo(cx - T * 2, cy + low + 3.4, cx - R * Math.cos(a), cy + low);   // the nape
      ctx.closePath();
    });
    if (!INK) ellipse(cx - 2.4 - T * 1.5, cy - 5.6, 3, 1, shade(hc, 0.2), null, 0, -0.35);
    return;
  }
  const aT = Math.abs(T), fx = cx + T * r * 0.42, fw = 5.4 * (1 - aT * 0.25), y0 = cy - 1.5, xL = fx - fw, xR = fx + fw;
  const side = st === 'long' ? 6.5 : st === 'curly' ? 3.4 : 2.4;   // how far down the hair comes at the edges of the face
  const dl = side + Math.max(0, T) * 4 - Math.max(0, -T) * 3, dr = side + Math.max(0, -T) * 4 - Math.max(0, T) * 3;
  const al = Math.PI - ang(dl), ar = ang(dr), n = 4, xi = i => xR - (xR - xL) * i / n;
  pShape(hc, cx, cy, 2 * R, 2 * Ry, () => {
    pBegin(); ctx.moveTo(cx + R * Math.cos(al), cy + Ry * Math.sin(al)); ctx.ellipse(cx, cy, R, Ry, 0, al, ar + Math.PI * 2);
    ctx.quadraticCurveTo(xR + 0.9, cy + dr * 0.5, xR, y0 + (st === 'long' ? 2.4 : 0.6));   // in along the right temple
    if (st === 'long') {   // swept to one side
      ctx.quadraticCurveTo(xR - 0.8, y0 - 1.8, fx + fw * 0.2, y0 - 2.3);
      ctx.quadraticCurveTo(xL + 2, y0 - 0.8, xL + 0.6, y0 + 2.2);
      ctx.lineTo(xL, y0 + 3.2);
    } else if (st === 'bun') {   // pulled back: a neat hairline
      ctx.quadraticCurveTo(xR - 0.5, y0 - 2.6, fx + 0.3, y0 - 2.7);
      ctx.quadraticCurveTo(xL + 0.5, y0 - 2.6, xL, y0 + 0.6);
    } else if (st === 'curly') {   // a row of curls
      for (let i = 1; i <= n; i++) ctx.quadraticCurveTo((xi(i - 1) + xi(i)) / 2, y0 + 2.4, xi(i), y0 - 0.1);
    } else {   // short: a spiky fringe
      for (let i = 1; i <= n; i++) ctx.quadraticCurveTo((xi(i - 1) + xi(i)) / 2, y0 - 2.2, xi(i), y0 + (i < n ? 1.3 : 0.6));
    }
    ctx.quadraticCurveTo(xL - 0.9, cy + dl * 0.5, cx + R * Math.cos(al), cy + Ry * Math.sin(al));   // out along the left temple
    ctx.closePath();
  });
  if (st === 'short') {   // a tuft sticking up on top
    const tx = cx + T * 2 - 0.8, ty = cy - Ry + 0.8;
    pShape(hc, tx + 0.3, ty - 1.3, 7, 4.6, () => {
      pBegin(); ctx.moveTo(tx - 3.2, ty + 0.8); ctx.quadraticCurveTo(tx - 1.8, ty - 3.2, tx + 0.4, ty - 3.6);
      ctx.quadraticCurveTo(tx - 0.5, ty - 1.6, tx + 0.4, ty - 0.7); ctx.quadraticCurveTo(tx + 1.9, ty - 3, tx + 3.8, ty - 2.5);
      ctx.quadraticCurveTo(tx + 2.8, ty - 0.4, tx + 3.6, ty + 1); ctx.closePath();
    });
  }
  if (!INK) ellipse(cx - 2.6 + T * 1.6, cy - 5.7, 2.9, 0.95, shade(hc, 0.22), null, 0, -0.35);   // shine
}
// A whole head: hair behind (withBack), ears, the face, the hair on top and a hat.
// T: which way the face turns (-1 left … 0 towards us … 1 right). back: seen from behind.
function drawHead(cx, cy, L, energy, ts, seed, T, back, sway = 0, withBack = false) {
  const skin = L.skin || '#f3c59f', r = HEAD_R, front = Math.abs(T) < 0.3, ears = (L.hair || 'short') !== 'long';
  const ear = x => { pEll(x, cy + 1.7, 1.55, 2.05, skin); if (!INK) ellipse(x, cy + 1.8, 0.7, 1.05, shade(skin, -0.12)); };
  pPart(() => {
    if (withBack) hairBack(cx, cy, L, T, back, sway);
    if (front && ears) { ear(cx - r - 0.2); ear(cx + r + 0.2); }
    pEll(cx, cy, r, r * 0.95, skin);
    hairCap(cx, cy, L, T, back);
  });
  if (!front && ears) pPart(() => ear(cx + (back ? 1 : -1) * Math.sign(T) * r * Math.cos(T * 1.05)));   // turned: one ear shows
  if (!back) pFace(cx, cy, L, energy, ts, seed, T);
  pPart(() => hat(cx, cy, L, T, back));
}
// The face: big eyes with a shine, rosy cheeks and a small mouth, turned with the head. Mood shows here only:
// sparkly and grinning (great), smiling (good), heavy lids (tired), shut eyes and dark circles (exhausted).
function pFace(cx, cy, L, energy, ts, seed, T) {
  const r = HEAD_R, aT = Math.abs(T), fx = cx + T * r * 0.42, e = 3.3, ink = '#2a1d18', skin = L.skin || '#f3c59f';
  const eyes = [[fx - e * (T < 0 ? 1 - 0.3 * aT : 1), T < 0 ? 1 - 0.4 * aT : 1], [fx + e * (T > 0 ? 1 - 0.3 * aT : 1), T > 0 ? 1 - 0.4 * aT : 1]];
  const ey = cy + 1.8, blink = Math.sin(ts / 1700 + seed * 5) > 0.985, yawn = energy === 'tired' && Math.sin(ts / 2600 + seed) > 0.93;
  const blush = energy === 'great' ? 0.55 : energy === 'good' ? 0.42 : 0.2;
  eyes.forEach(([x, w], i) => ellipse(x + (i ? 1.3 : -1.3) * w, cy + 4.3, 1.8 * w, 1.05, `rgba(255,110,110,${blush})`));
  if (energy === 'exhausted') {
    eyes.forEach(([x, w]) => { ellipse(x, ey + 1.9, 1.5 * w, 0.7, 'rgba(110,80,140,.3)'); line(x - 1.2 * w, ey + 0.1, x + 1.2 * w, ey + 0.5, ink, 0.9); });
  } else if (blink) {
    eyes.forEach(([x, w]) => line(x - 1.2 * w, ey + 0.3, x + 1.2 * w, ey + 0.3, ink, 0.9));
  } else {
    eyes.forEach(([x, w]) => {
      ellipse(x, ey, 1.25 * w, 1.75, ink);
      circle(x + 0.45 * w, ey - 0.65, 0.58, '#fff');
      if (energy === 'great') circle(x - 0.4 * w, ey + 0.75, 0.32, '#fff');
      if (energy === 'tired') {   // heavy lids
        ctx.save(); ctx.beginPath(); ctx.ellipse(x, ey, 1.5 * w, 2, 0, 0, Math.PI * 2); ctx.clip();
        rrect(x - 2, ey - 2.3, 4, 2.2, 0, skin); ctx.restore();
        line(x - 1.35 * w, ey - 0.15, x + 1.35 * w, ey - 0.05, ink, 0.75);
      }
    });
  }
  const mx = fx + T * 0.3, my = cy + 4.9;
  ctx.strokeStyle = '#7a3328'; ctx.lineWidth = 0.85; ctx.lineCap = 'round';
  if (yawn) { ellipse(mx, my + 0.3, 1.1, 1.4, '#7a3328'); return; }
  if (energy === 'great') {
    ctx.beginPath(); ctx.moveTo(mx - 1.9, my - 0.6); ctx.quadraticCurveTo(mx, my + 3, mx + 1.9, my - 0.6); ctx.closePath();
    ctx.fillStyle = '#8a3a30'; ctx.fill(); ellipse(mx, my + 0.9, 0.9, 0.45, '#f08a8a');
  } else if (energy === 'good') { ctx.beginPath(); ctx.arc(mx, my - 0.9, 1.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  else if (energy === 'tired') line(mx - 0.9, my + 0.2, mx + 0.9, my + 0.1, '#7a3328', 0.85);
  else { ctx.beginPath(); ctx.arc(mx, my + 1.1, 1.2, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke(); }
}
// The torso as a soft bean: rounded shoulders, a little wider at the hips. dx pushes the tummy forwards (side view).
function torsoPath(top, bot, wt, wb, dx = 0) {
  pBegin();
  ctx.moveTo(-wb + dx * 0.5, bot - 0.5);
  ctx.bezierCurveTo(-wb - 0.3, bot - 4, -wt - 0.4, top + 4.5, -wt, top + 2.8);
  ctx.quadraticCurveTo(-wt + 0.1, top, -wt + 2.9, top);
  ctx.lineTo(wt - 2.9, top);
  ctx.quadraticCurveTo(wt - 0.1, top, wt, top + 2.8);
  ctx.bezierCurveTo(wt + 0.4, top + 4.5, wb + 0.3 + dx, bot - 4, wb + dx, bot - 0.5);
  ctx.quadraticCurveTo(dx * 0.5, bot + 1.1, -wb + dx * 0.5, bot - 0.5);
  ctx.closePath();
}
// A skirt (or the skirt of a dress) over the hips, swinging a little.
function skirtShape(col, sw = 0) {
  const f = Math.abs(sw) * 0.5, b = sw * 1.1;
  pShape(col, b * 0.5, -7.4, 13 + 2 * f, 7.5, () => {
    pBegin(); ctx.moveTo(-4.3, -10.9); ctx.lineTo(4.3, -10.9); ctx.lineTo(6.5 + f + b, -4.4);
    ctx.quadraticCurveTo(b, -3.3, -6.5 - f + b, -4.4); ctx.closePath();
  });
  if (!INK) { line(-1.4, -10.2, -2.3 + b * 0.6, -4.4, shade(col, -0.14), 0.6); line(1.4, -10.2, 2.3 + b * 0.6, -4.4, shade(col, -0.14), 0.6); }
}
// Hips in the trousers, the skirt, then the top (side view, facing +x).
function torsoSide(C, top, sway, back) {
  const sh = C.shirt, bot = HIP_Y - 0.6;
  if (!C.dress) pRect(-4.1, -10.9, 8.6, 3.8, 1.7, C.pants);
  if (C.dress) skirtShape(sh, sway); else if (C.skirt) skirtShape(C.pants, sway);
  pShape(sh, 0.25, (top + bot) / 2, 8.8, bot - top + 1, () => torsoPath(top, bot, 3.9, 4.2, 0.5));
  if (INK) return;
  ctx.save(); torsoPath(top, bot, 3.9, 4.2, 0.5); ctx.clip();
  rrect(-6, top - 1, 3.2, 16, 1, shade(sh, -0.1));                    // the back is in shade
  if (!C.dress) rrect(-6, bot - 1.6, 12, 3, 0, shade(sh, -0.07));      // hem
  if (C.top === 'sweater') for (let i = -4; i <= 4.5; i += 1.1) line(i, bot - 1.5, i, bot + 0.6, shade(sh, -0.2), 0.45);
  ctx.restore();
  if (back) return;
  if (C.top === 'polo') { pg([[0.4, top + 0.3], [3.4, top + 0.5], [2, top + 2.6]], shade(sh, 0.25)); circle(2.6, top + 3.6, 0.42, '#fffaf0'); }
  if (C.top === 'hoodie') { line(2.4, top + 0.6, 2.8, top + 3.8, '#fffaf0', 0.55); rrect(0.6, -13.8, 4.1, 2.8, 1.2, shade(sh, -0.09)); }
  if (C.top === 'jacket') { rrect(2.4, top + 0.4, 2.4, bot - top - 1.2, 0.6, C.inner); line(2.4, top + 0.6, 2.4, bot - 0.8, shade(sh, -0.3), 0.55); }
  if (C.dress) rrect(-4, -11.9, 8.5, 1.3, 0.6, shade(sh, -0.12));     // sash
}
// The same, front-on (drawn inside the turned transform of the front view).
function torsoFront(C, sway, back, farSide, turned) {
  const sh = C.shirt, top = -19.3, bot = HIP_Y - 0.6;
  if (!C.dress) pRect(-4.5, -10.9, 9, 3.8, 1.7, C.pants);
  if (C.dress) skirtShape(sh, sway); else if (C.skirt) skirtShape(C.pants, sway);
  pShape(sh, 0, (top + bot) / 2, 9.4, bot - top + 1, () => torsoPath(top, bot, 4.3, 4.6));
  if (C.top === 'hoodie' && back) pEll(0, top + 2.4, 4.2, 2.8, shade(sh, -0.1));   // the hood on the back
  if (INK) return;
  ctx.save(); torsoPath(top, bot, 4.3, 4.6); ctx.clip();
  if (turned) rrect(farSide > 0 ? 2.4 : -6.8, top - 1, 4.4, 16, 1, shade(sh, -0.1));   // the side turned away is in shade
  if (!C.dress) rrect(-6, bot - 1.7, 12, 3, 0, shade(sh, -0.07));
  if (C.top === 'sweater') for (let i = -4.4; i <= 4.5; i += 1.1) line(i, bot - 1.6, i, bot + 0.6, shade(sh, -0.2), 0.45);
  ctx.restore();
  if (back) return;
  if (C.top === 'polo') { pg([[-3, top + 0.3], [-0.2, top + 0.6], [-1.4, top + 2.7]], shade(sh, 0.25)); pg([[3, top + 0.3], [0.2, top + 0.6], [1.4, top + 2.7]], shade(sh, 0.25)); circle(0, top + 3.5, 0.42, '#fffaf0'); circle(0, top + 5.1, 0.42, '#fffaf0'); }
  if (C.top === 'hoodie') { line(-1.3, top + 0.5, -1.6, top + 4.2, '#fffaf0', 0.55); line(1.3, top + 0.5, 1.6, top + 4.2, '#fffaf0', 0.55); rrect(-3.3, -14.2, 6.6, 3.2, 1.4, shade(sh, -0.09)); }
  if (C.top === 'jacket') { rrect(-1.4, top + 0.2, 2.8, bot - top - 1.2, 0.6, C.inner); line(-1.4, top + 0.4, -1.4, bot - 0.8, shade(sh, -0.3), 0.55); line(1.4, top + 0.4, 1.4, bot - 0.8, shade(sh, -0.3), 0.55); }
  if (C.dress) rrect(-4.4, -11.9, 8.8, 1.3, 0.6, shade(sh, -0.12));
}
// A limb segment: a capsule that is w0 wide at a and w1 wide at b (thigh, calf, upper arm, forearm).
function seg(a, b, w0, w1, col) {
  if (INK) { w0 += INK_W * 2; w1 += INK_W * 2; }
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 0.001, nx = -dy / L, ny = dx / L, th = Math.atan2(ny, nx);
  if (!INK) ctx.beginPath();
  ctx.moveTo(a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  ctx.lineTo(b[0] - nx * w1 / 2, b[1] - ny * w1 / 2);
  ctx.arc(b[0], b[1], w1 / 2, th + Math.PI, th, false);
  ctx.lineTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2);
  ctx.arc(a[0], a[1], w0 / 2, th, th + Math.PI, false);
  ctx.closePath();
  if (!INK) { ctx.fillStyle = col; ctx.fill(); }
}
const mixPt = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
// A shoe seen from the side, toe forward: a rounded upper and a white sole (boots and high-tops have a shaft,
// sandals show the foot and a strap).
function pShoe(x, y, C, far) {
  const k = C.shoes, col = far ? shade(C.shoeCol, -0.12) : C.shoeCol;
  if (k === 'sandals') { pEll(x + 1.1, y - 1, 2.9, 1.15, far ? shade(C.skin, -0.1) : C.skin); if (!INK) { rrect(x - 1.8, y - 0.5, 5.9, 0.9, 0.45, '#8a5a36'); line(x - 0.2, y - 1.8, x + 2.2, y - 0.7, '#8a5a36', 0.7); } return; }
  if (k === 'boots') pRect(x - 1.9, y - 5.2, 4.1, 4.8, 1.3, col);
  if (k === 'hightops') pRect(x - 1.9, y - 4.1, 3.8, 3.6, 1.2, col);
  pShape(col, x + 1.15, y - 1.55, 6.1, 3.1, () => {
    pBegin(); ctx.moveTo(x - 1.9, y - 0.3); ctx.quadraticCurveTo(x - 2.1, y - 3.1, x + 0.4, y - 3.1);
    ctx.quadraticCurveTo(x + 4, y - 2.8, x + 4.2, y - 0.6); ctx.lineTo(x + 4.2, y); ctx.lineTo(x - 1.9, y); ctx.closePath();
  });
  if (!INK) {
    rrect(x - 2, y - 1.1, 6.3, 1.15, 0.55, '#f4efe6');
    if (k === 'hightops') line(x - 1.7, y - 3.5, x + 1.6, y - 3.5, '#f4efe6', 0.6);
    else if (k !== 'boots') line(x + 0.5, y - 2.5, x + 1.8, y - 2.2, 'rgba(255,255,255,.7)', 0.5);
  }
}
// A shoe seen from the front, pointing the way you walk (F: forwards on screen).
function pShoeFront(foot, F, C, far) {
  const k = C.shoes, col = far ? shade(C.shoeCol, -0.12) : C.shoeCol, tx = F[0] * 2.1, ty = F[1] * 2.1;
  if (k === 'boots' || k === 'hightops') seg([foot[0], foot[1] - (k === 'boots' ? 5 : 3.7)], [foot[0], foot[1] - 1.3], 3.8, 3.6, col);
  const a = [foot[0] - tx * 0.55, foot[1] - 1.4 - ty * 0.55], b = [foot[0] + tx, foot[1] - 1.2 + ty];
  seg(a, b, 3.2, 3.4, k === 'sandals' ? (far ? shade(C.skin, -0.1) : C.skin) : col);
  if (!INK) line(a[0], a[1] + 1.1, b[0], b[1] + 1.1, k === 'sandals' ? '#8a5a36' : '#f4efe6', 1);
}
// A leg (side view): thigh and calf in the trousers (or bare below shorts and skirts), a darker hem, and a shoe.
function pLeg(l, lift, lean, C, far) {
  const hip = [l.h[0] + lean * 0.5, l.h[1] - lift], knee = l.k, ank = [l.f[0] + 0.2, l.f[1] - 1.6];
  const dk = c => far ? shade(c, -0.13) : c;
  seg(hip, knee, 4.1, 3.7, dk(C.thigh)); seg(knee, ank, 3.7, 3.2, dk(C.calf));
  if (!INK) { if (C.hem) seg(knee, mixPt(knee, ank, 0.15), 4, 3.9, dk(C.hem)); else if (C.calf === C.pants) seg(mixPt(knee, ank, 0.78), ank, 3.5, 3.3, shade(dk(C.pants), -0.16)); }
  pShoe(l.f[0], l.f[1], C, far);
}
// An arm: skin, a sleeve over the top (short, or down to the wrist for hoodies, sweaters and jackets), a round hand.
function pArm(sh, el, ha, C, far) {
  const sk = far ? shade(C.skin, -0.08) : C.skin, sl = far ? shade(C.shirt, -0.15) : C.shirt;
  seg(sh, el, 2.9, 2.7, sk); seg(el, ha, 2.7, 2.4, sk);
  if (C.sleeve >= 1) { seg(sh, el, 3.6, 3.3, sl); seg(el, mixPt(el, ha, 0.8), 3.3, 3.1, sl); if (!INK) { const c = mixPt(el, ha, 0.8); circle(c[0], c[1], 1.55, shade(sl, -0.12)); } }
  else seg(sh, mixPt(sh, el, C.sleeve * 1.6), 3.8, 3.5, sl);
  pEll(ha[0], ha[1], 1.8, 1.8, sk);
}
function drawProp(k, ts, B) {
  const hand = i => B(k.arms[i].h);
  if (k.prop === 'dumbbells') [0, 1].forEach(i => { const [x, y] = hand(i); rrect(x - 2.4, y - 0.8, 4.8, 1.6, 0.6, '#555'); rrect(x - 3, y - 2, 1.4, 4, 0.5, '#333'); rrect(x + 1.6, y - 2, 1.4, 4, 0.5, '#333'); });
  if (k.prop === 'gloves') [0, 1].forEach(i => { const [x, y] = hand(i); circle(x + 0.5, y, 2.4, '#e5373b', INK_COL, 0.6); });
  if (k.prop === 'basket') { const [x, y] = hand(0); rrect(x - 2.5, y - 1, 6, 4, 1.5, '#c8954f', '#9a6a34', 0.5); }
  if (k.prop === 'rod') {
    const [x, y] = hand(1), tip = [x + 18, y - 16], bob = Math.sin(ts / 500) * 1.2;
    line(x, y, tip[0], tip[1], '#8a5a36', 1);
    line(tip[0], tip[1], tip[0] + 3, 6 + bob, 'rgba(255,255,255,.8)', 0.4);
    circle(tip[0] + 3, 6 + bob, 1.2, '#e5484d');
  }
  if (k.prop === 'letter') { const [x, y] = hand(1); rrect(x - 1, y - 3.5, 6, 4, 0.5, '#fffaf0', '#c9b98f', 0.5); }
  if (k.prop === 'notes') { const u = (ts / 900) % 1; ctx.save(); ctx.globalAlpha = 1 - u; ctx.font = '8px sans-serif'; ctx.fillStyle = '#6b5bd0'; ctx.fillText('♪', 8, -36 - u * 10); ctx.fillText('♫', -12, -32 - ((u + 0.5) % 1) * 10); ctx.restore(); }
}

// Front / back view (o.view), turned the way you're walking (v0.13). o.turn is the walking direction on the
// ground [dx, dy] (or a number for an older -1..1 turn). Feet, hips and shoulders sit on the ground plane, seen
// from the camera: walking along a road the body is at 3/4, the shoulders slant, and the feet step along the road
// (not up and down while the body slides sideways).
function drawPersonFront(sx, sy, s, o, pose) {
  const L = o.look, ts = o.ts || 0, seed = o.seed || 0, energy = o.energy || 'good', back = o.view === 'back';
  // ground directions on screen: F = forwards, V = sideways (to the screen right), both for one step of ~1
  let F, V;
  if (Array.isArray(o.turn)) {
    const [dx, dy] = o.turn, n = Math.hypot(dx, dy) || 1, fx = dx / n, fy = dy / n;
    F = [(fx - fy) / Math.SQRT2, (fx + fy) / 2 / Math.SQRT2]; V = [(-fy - fx) / Math.SQRT2, (-fy + fx) / 2 / Math.SQRT2];
    if (V[0] < 0) V = [-V[0], -V[1]];
  } else { const T0 = clamp(o.turn || 0, -1, 1); F = [T0 * 0.7, back ? -0.5 : 0.5]; V = [1 - Math.abs(T0) * 0.3, back ? T0 * 0.35 : -T0 * 0.35]; }
  const T = clamp(F[0] / (Math.hypot(F[0], F[1] * 2) || 1) * 1.15, -1, 1);   // how far the face is turned (for the head)
  const moving = pose !== 'stand', run = pose === 'run', ph = o.phase || 0, sw = moving ? Math.sin(ph) : 0;
  const tired = energy === 'tired' || energy === 'exhausted';
  const bounce = moving ? Math.abs(Math.cos(ph)) * (run ? 2 : tired ? 0.6 : 1.1) : (energy === 'great' && !o.wave ? Math.max(0, Math.sin(ts / 240 + seed)) * 2.5 : 0);
  const C = outfitOf(L), stride = run ? 5.2 : 3.6, liftH = run ? 2.6 : 1.6;
  const G = (side, w, fwd) => [side * w * V[0] + fwd * F[0], side * w * V[1] + fwd * F[1]];   // a point on the ground
  ellipse(sx, sy, 8 * s, 3.4 * s, 'rgba(0,0,0,.18)');
  const BD = bodyOf(L);
  local(sx, sy, s, 1, () => {
    ctx.translate(0, -bounce);
    ctx.scale(BD.w, BD.h);   // v0.18: the body's build
    // which side is further from the camera (drawn first)
    const farSide = V[1] < 0 ? 1 : -1, sides = [farSide, -farSide];
    const hx = T * 0.9, hy = -27.6 + (energy === 'exhausted' ? 1.2 : 0);
    const leg = side => {
      const u = side > 0 ? sw : -sw, f = G(side, 2, u * stride), lift = Math.max(0, u) * liftH;
      const hip = [side * 2 * V[0], HIP_Y + side * 2 * V[1]], foot = [f[0], f[1] - lift + bounce], knee = mixPt(hip, foot, 0.5);
      knee[1] -= 0.5 + lift * 0.6; knee[0] += F[0];
      const far = side === farSide, dk = c => far ? shade(c, -0.12) : c, ank = [foot[0], foot[1] - 1.3];
      seg(hip, knee, 4.1, 3.7, dk(C.thigh)); seg(knee, ank, 3.7, 3.2, dk(C.calf));
      if (!INK) { if (C.hem) seg(knee, mixPt(knee, ank, 0.16), 4, 3.9, dk(C.hem)); else if (C.calf === C.pants) seg(mixPt(knee, ank, 0.75), ank, 3.5, 3.3, shade(dk(C.pants), -0.16)); }
      pShoeFront(foot, F, C, far);
    };
    // arms swing forwards and back, opposite to the legs; a waving arm goes up beside the head
    const shoulder = side => [side * 4.2 * V[0], -16.9 + side * 4.2 * V[1]];
    const arm = side => {
      const u = side > 0 ? -sw : sw, shp = shoulder(side), swing = u * (run ? 3.6 : 2.4);
      const hand = [shp[0] + side * 0.9 * V[0] + F[0] * swing, -10.3 + side * 0.9 * V[1] + F[1] * swing - Math.abs(u) * 0.5];
      const el = mixPt(shp, hand, 0.5); el[0] += side * 0.5 * V[0];
      pArm(shp, el, hand, C, side === farSide);
    };
    const waveArm = () => { const w = Math.sin(ts / 140) * 1.6, shp = shoulder(1); pArm(shp, [shp[0] + 3.4, shp[1] - 3.2], [shp[0] + 5.8 + w, shp[1] - 8.4], C, farSide > 0); };
    pPart(() => leg(sides[0])); pPart(() => leg(sides[1]));
    if (!back) unscaled(hx, hy, BD, () => pPart(() => hairBack(hx, hy, L, T, false, sw * 0.5)));
    if (!(o.wave && sides[0] > 0)) pPart(() => arm(sides[0]));
    // the body, turned: drawn front-on, then squeezed and slanted onto the ground directions
    ctx.save(); ctx.transform(V[0], V[1], 0, 1, 0, 0);
    pPart(() => torsoFront(C, sw * 0.7, back, farSide, V[0] < 0.95));
    ctx.restore();
    if (!(o.wave && sides[1] > 0)) pPart(() => arm(sides[1]));
    unscaled(hx, hy, BD, () => drawHead(hx, hy, L, energy, ts, seed, T, back, sw * 0.5, back));
    if (o.wave) pPart(waveArm);
  });
  sleepyZ(sx, sy, s, energy, ts, seed, 40 + bounce);
}
// Lying in bed (o.dir: which way the head points on screen, in radians). Eyes closed, a few z's.
function drawLying(sx, sy, s, o) {
  const L = o.look, ts = o.ts || 0, C = outfitOf(L);
  local(sx, sy, s, 1, () => {
    ctx.rotate(o.dir || 0);
    // the body lies along +x here, head at +x
    pPart(() => { seg([-8, 2], [-16, 2], 3.8, 3.3, shade(C.thigh, -0.1)); seg([-8, -2], [-16, -2], 3.8, 3.3, C.thigh); });
    pPart(() => pRect(-10, -4.8, 13.5, 9.6, 4.6, C.shirt));
    pPart(() => { pEll(10.5, 0, 8.4, 8.8, L.skin); pShape(L.hairCol, 10.5, 0, 18.2, 19, () => { pBegin(); ctx.moveTo(10.5, -9.5); ctx.ellipse(10.5, 0, 9.1, 9.5, 0, -Math.PI * 0.5, Math.PI * 0.5); ctx.closePath(); }); });
    ctx.strokeStyle = '#2a1d18'; ctx.lineWidth = 0.9; ctx.lineCap = 'round';
    [-3, 3].forEach(y => { ctx.beginPath(); ctx.arc(8.4, y, 1.3, 0.55 * Math.PI, 1.45 * Math.PI); ctx.stroke(); ellipse(6, y * 1.45, 1, 1.7, 'rgba(255,110,110,.35)'); });
  });
  const ph = (ts / 1500) % 1;
  ctx.save(); ctx.globalAlpha = 1 - ph; ctx.font = `bold ${(8 + ph * 5) * s}px sans-serif`; ctx.fillStyle = '#5b6b8c'; ctx.textAlign = 'center';
  ctx.fillText('z', sx + (8 + ph * 8) * s, sy - (14 + ph * 14) * s); ctx.restore();
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
  const L = o.look, ts = o.ts || 0, seed = o.seed || 0, energy = o.energy || 'good', C = outfitOf(L);
  const moving = o.moving || pose === 'run' || pose === 'walk' || pose === 'bike';
  const roll = (o.phase || ts / 200) * (pose === 'run' ? 1.4 : 0.8);
  const reach = ['crouch', 'pick', 'fish', 'mail', 'sneak'].includes(pose);
  const active = ['lift', 'box', 'jacks', 'dance', 'yoga'].includes(pose);
  const bob = moving ? 0 : (Math.sin(ts / 700 + seed) + 1) * 0.25, T = o.back ? 0.5 : 0.62;
  local(sx, sy, s, o.face || 1, () => {
    line(-5, -11, -6.5, -24, '#5b6470', 1.8);
    rrect(-5, -12.5, 12, 2.6, 1, '#5b6470');
    circle(9, -1.8, 1.8, '#3b3f46');
    line(7, -11, 9, -3, '#5b6470', 1.2);
    ctx.save(); ctx.translate(reach ? 1.5 : 0, -bob);
    if (reach) ctx.rotate(0.18);
    pPart(() => { seg([-1, -12.6], [6.2, -12.6], 4.2, 3.8, C.thigh); seg([6.2, -12.6], [7.2, -3.6], 3.7, 3.2, C.calf); pShoe(6.4, -1.3, C); });
    if (!o.back) pPart(() => hairBack(0.6, -31.2, L, T, false));
    ctx.save(); ctx.translate(0, -3.6); pPart(() => torsoSide(C, -19.3, 0, o.back)); ctx.restore();
    drawHead(0.6, -31.2, L, energy, ts, seed, T, !!o.back, 0, !!o.back);
    ctx.restore();
    circle(-0.5, -8, 8, null, '#3b3f46', 2);
    for (let k = 0; k < 4; k++) { const a = (moving ? roll : 0) + k * Math.PI / 4; line(-0.5 - Math.cos(a) * 7, -8 - Math.sin(a) * 7, -0.5 + Math.cos(a) * 7, -8 + Math.sin(a) * 7, '#8a919c', 0.6); }
    circle(-0.5, -8, 1.4, '#8a919c');
    if (active) {
      const u = (Math.sin(ts / 260) + 1) / 2;
      pPart(() => pArm([0.6, -20.3 - bob], [4.4, -21.4 - u * 2 - bob], [9 + u * 1.2, -21 - u * 4.5 - bob], C));
      if (pose === 'lift') rrect(6.8 + u * 1.2, -21.8 - u * 4.5 - bob, 4.8, 1.6, 0.6, '#555');
    } else if (reach) pPart(() => pArm([1.5, -20.3], [5, -15], [8.5, -9.6 + Math.sin(ts / 200) * 1.5], C));
    else pPart(() => pArm([0.6, -20.3 - bob], [2.6, -15.4], [2 + (moving ? Math.sin(roll * 1.5) * 2.5 : 0), -11.4], C));
  });
  sleepyZ(sx, sy, s, energy, ts, seed, 42);
}
// Riding a bike (the cycling workout). noBike: on the exercise bike indoors, only the rider shows.
function drawRider(sx, sy, s, o) {
  const L = o.look, ts = o.ts || 0, ph = o.phase || ts / 120, energy = o.energy || 'good', C = outfitOf(L);
  local(sx, sy, s, o.face || 1, () => {
    if (!o.noBike) {
      const wheel = (x) => { circle(x, -5, 5, null, '#2b2b2e', 1.4); for (let k = 0; k < 3; k++) { const a = ph + k * Math.PI / 3; line(x - Math.cos(a) * 4.5, -5 - Math.sin(a) * 4.5, x + Math.cos(a) * 4.5, -5 + Math.sin(a) * 4.5, '#999', 0.4); } };
      wheel(-8); wheel(9);
      const col = o.bikeCol || '#e5484d';
      [[-8, -5, 0, -5], [0, -5, -2, -13], [-2, -13, 7, -13], [7, -13, 9, -5], [0, -5, 7, -13], [7, -13, 7.5, -16]].forEach(([a, b, c, d]) => line(a, b, c, d, col, 1.2));
      rrect(-4, -14.5, 5, 1.6, 0.8, '#333');
    }
    const pedal = (a) => [Math.cos(a) * 2.6, -5 + Math.sin(a) * 2.6];
    [[ph + Math.PI, true], [ph, false]].forEach(([a, far]) => {
      const f = pedal(a), hip = [-1.8, -14.6], knee = [(hip[0] + f[0]) / 2 + 2.6, (hip[1] + f[1]) / 2 - 2.2], dk = c => far ? shade(c, -0.14) : c;
      pPart(() => { seg(hip, knee, 4, 3.6, dk(C.thigh)); seg(knee, [f[0], f[1] - 1], 3.6, 3.1, dk(C.calf)); pEll(f[0] + 0.9, f[1] - 0.2, 2.4, 1.4, dk(C.shoeCol)); });
    });
    pPart(() => hairBack(2.6, -30.6, L, 0.62, false));
    ctx.save(); ctx.translate(-1.4, -14.2); ctx.rotate(0.28);
    pPart(() => pShape(C.shirt, 0.2, -4.6, 8.4, 11, () => torsoPath(-9.6, 0.4, 3.8, 4.1, 0.4)));
    ctx.restore();
    drawHead(2.6, -30.6, L, energy, ts, o.seed || 0, 0.62, false);
    pPart(() => pArm([1.6, -21.6], [4.8, -18.6], [7.6, -16.3], C));
  });
}
// Swimming in the pond or pool: just the head and the arms come out of the water.
function drawSwimmer(sx, sy, s, o) {
  const L = o.look, ts = o.ts || 0, f = o.face || 1;
  const r = (ts / 1200) % 1;
  ellipse(sx, sy, 14 * s * (0.6 + r), 5 * s * (0.6 + r), null, `rgba(255,255,255,${0.7 * (1 - r)})`, 1 * s);
  local(sx, sy, s, f, () => {
    ellipse(0, 0, 9, 3.2, 'rgba(255,255,255,.35)');
    const a = ts / 260;
    [a, a + Math.PI].forEach(tt => {
      if (Math.sin(tt) > 0) { const hx = Math.cos(tt) * 9, hy = -Math.sin(tt) * 7.5; pPart(() => { seg([0, -1], [hx, hy - 1], 2.7, 2.4, L.skin); pEll(hx, hy - 1, 1.8, 1.8, L.skin); }); }
    });
    const hy = -7.6;
    drawHead(1, hy, { ...L, hat: 'nohat', hair: 'swimcap' }, o.energy || 'good', ts, o.seed || 0, 0.62, false);
    pPart(() => pShape('#e5484d', 1, hy - 4.5, 2 * HEAD_R + 1.6, 10, () => { pBegin(); ctx.moveTo(1 - HEAD_R - 0.8, hy); ctx.ellipse(1, hy, HEAD_R + 0.8, HEAD_R * 0.95 + 0.8, 0, Math.PI, Math.PI * 2); ctx.quadraticCurveTo(1, hy + 1.5, 1 - HEAD_R - 0.8, hy); ctx.closePath(); }));   // swim cap
    ellipse(1, 1.6, 10.5, 2.6, 'rgba(120,190,230,.6)');   // the water at the chin
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
const ANIM_SHADOW = { chicken: 7, duck: 7, rabbit: 7, sheep: 11, goat: 11, pig: 11, cow: 15, alpaca: 11, rainbowalpaca: 11, dog: 9, cat: 7 };
// o: { face, moving, phase, ts, seed }
function drawAnimal(k, st, sx, sy, s, o) {
  const sz = [0.62, 0.82, 1][st];
  ellipse(sx, sy, ANIM_SHADOW[k] * sz * s, ANIM_SHADOW[k] * 0.4 * sz * s, 'rgba(0,0,0,.16)');
  local(sx, sy, s * sz, o.face || 1, () => ANIMAL_DRAW[k](st, o));
}
// Four legs, the far pair darker, with little hooves / paws at the bottom.
function legs4(xs, top, w, col, o) {
  const sw = o.moving ? Math.sin(o.phase || 0) * 2.4 : 0, hoof = shade(col, -0.45);
  xs.forEach((x, i) => {
    const s1 = i ? sw : -sw;
    line(x + 1.4, top, x + 1.4 - s1, 0, shade(col, -0.28), w);
    ellipse(x + 1.4 - s1, -0.2, w * 0.55, w * 0.32, hoof);
    line(x, top, x + s1, 0, col, w);
    ellipse(x + s1, -0.2, w * 0.58, w * 0.34, hoof);
    line(x - w * 0.25, top + 1, x + s1 * 0.5 - w * 0.25, -top * -0.5, 'rgba(255,255,255,.18)', w * 0.25);
  });
}
// An eye with a little glint, so animals look alive.
function eyeDot(x, y, r) { circle(x, y, r, '#2a2018'); circle(x + r * 0.35, y - r * 0.35, r * 0.4, '#fff'); }
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
      eyeDot(hx + 1.4, hy - 0.8, 0.75);
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
    eyeDot(hx + 1.6, hy - 0.9, 0.8);
  },
  duck(st, o) {
    const sw = o.moving ? Math.sin(o.phase || 0) : 0;
    ctx.rotate(sw * 0.08);   // waddle
    if (st === 0) {
      line(-1, -3, -1 - sw, 0, '#f28c28', 1.2); line(1.6, -3, 1.6 + sw, 0, '#f28c28', 1.2);
      ellipse(0, -5.5, 5.4, 4.2, '#ffe57a'); circle(4, -10, 3.4, '#ffe57a');
      rrect(6.4, -10.2, 3.6, 1.6, 0.8, '#f28c28'); eyeDot(5, -10.8, 0.7);
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
    eyeDot(8.2, -18.5, 0.8);
  },
  rabbit(st, o) {
    const hop = o.moving ? Math.abs(Math.sin(o.phase || 0)) * 4 : 0;
    const col = '#efe6da', dark = '#d8c9b6';
    ctx.translate(0, -hop);
    if (st === 0) {
      circle(0, -4.5, 4.6, col); circle(3.6, -7.6, 3.3, col);
      ellipse(2.6, -11.6, 0.9, 2.6, col, null, 0, -0.2); ellipse(4.4, -11.4, 0.9, 2.6, col, null, 0, 0.15);
      circle(-4.2, -5, 1.5, '#fff'); eyeDot(4.8, -8.2, 0.65); circle(6.7, -7.4, 0.55, '#f2a0ad');
      return;
    }
    ellipse(-3, -1.6, 4, 1.8, dark); ellipse(0, -7, 7.5, 5.8, col); circle(-7.4, -8.4, 2.4, '#fff');
    ellipse(4.6, -1.2, 2, 1.2, dark); circle(6.6, -11, 4.3, col);
    const earW = Math.sin((o.ts || 0) / 800 + (o.seed || 0)) * 0.12;
    [[4.4, -14.2, -0.35], [6.6, -14.6, -0.05]].forEach(([x, y, a], k) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a + earW); ellipse(0, -4.6, 1.6, 5, k ? col : shade(col, -0.06)); ellipse(0, -4.6, 0.8, 3.7, '#f6b7c0'); ctx.restore(); });
    eyeDot(8.2, -11.8, 0.85); circle(10.6, -10.2, 0.75, '#f2a0ad');
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
    eyeDot(11, -19, 0.7);
    if (st >= 1) pg([[11.5, -14.5], [12.5, -11], [10.5, -14]], shade(fur, -0.15));   // beard
    if (st === 2) { ctx.beginPath(); ctx.arc(8.5, -24, 3.5, 0.6, 2.2); ctx.strokeStyle = dark; ctx.lineWidth = 1.4; ctx.stroke(); ctx.beginPath(); ctx.arc(10, -24.2, 3.5, 0.6, 2.2); ctx.stroke(); }
  },
  pig(st, o) {
    const pink = '#f6b3b9', dark = '#e48b97';
    if (st === 0) {
      legs4([-3, 3], -3, 1.4, pink, o);
      ellipse(0, -5.5, 6, 4.4, pink); circle(5.6, -7, 3.6, pink); ellipse(8.6, -6.6, 1.5, 1.8, dark);
      pg([[4.6, -9.6], [5.8, -12.2], [7, -9.6]], dark); eyeDot(6.4, -7.8, 0.6);
      return;
    }
    legs4([-6, 6], -5, 2.6, pink, o);
    ellipse(0, -9, 11, 7.2, pink); ellipse(-2, -6, 7, 3, 'rgba(255,255,255,.18)');
    ctx.beginPath(); ctx.arc(-12, -11, 1.8, 0, Math.PI * 1.6); ctx.strokeStyle = dark; ctx.lineWidth = 1.1; ctx.stroke();
    circle(10, -11, 5.4, pink); pg([[8, -14.6], [10.6, -18.6], [12, -14]], dark);
    ellipse(14.6, -10.2, 2.2, 2.6, dark); circle(14.1, -10.8, 0.5, '#9a4a5a'); circle(15.1, -9.6, 0.5, '#9a4a5a');
    eyeDot(11.4, -12.4, 0.75);
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
    eyeDot(14.6, -23.4, 0.85); ellipse(10.2, -25, 2.6, 1.2, shade(base, -0.1), null, 0, 0.3);
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
    eyeDot(8.6, -15.6 - neck, 0.7);
  },
  // The rainbow alpaca (an exclusive: 20,000 steps a day for 30 days): rainbow wool, a golden halter, sparkles.
  rainbowalpaca(st, o) {
    const RB = ['#ff8a8a', '#ffc46b', '#fff07a', '#9be58a', '#8ad3ff', '#b79cff'], ts = o.ts || 0;
    legs4([-4, 4], -7, 1.8, '#f3e9ff', o);
    [[-5, -11, 4.6], [0, -12.5, 5.2], [4, -11, 4.4], [-1, -8.5, 4.6], [-3, -14, 3.6], [2.5, -15, 3.4]].forEach(([x, y, r], i) => circle(x, y, r, RB[i % RB.length], 'rgba(255,255,255,.6)', 0.5));
    const neck = st === 0 ? 7 : 10;
    for (let j = 0; j < 4; j++) circle(5.5 + j * 0.4, -14 - j * neck / 4, 2.8, RB[(j + 2) % RB.length]);
    ellipse(7.5, -15 - neck, 3, 3.4, '#fff8ff');
    ellipse(10, -14.4 - neck, 1.8, 1.4, '#f0dff5');
    pg([[6, -18 - neck], [6.5, -21 - neck], [7.5, -18 - neck]], '#e9d8f2'); pg([[8, -18 - neck], [8.8, -21 - neck], [9.4, -18 - neck]], '#e9d8f2');
    line(6.2, -14 - neck, 10.4, -13.2 - neck, '#f2c230', 0.7);
    eyeDot(8.6, -15.6 - neck, 0.7); circle(8.8, -15.9 - neck, 0.25, '#fff');
    const ph = (ts / 900) % 1; if (Math.sin(ph * Math.PI) > 0.1) star(-6 + ph * 4, -20 - ph * 6, 1.6 * Math.sin(ph * Math.PI), '#fff8c8');
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
