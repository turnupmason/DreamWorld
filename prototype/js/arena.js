'use strict';
// v0.55 (Mason #29): the stadium plays the league games (league.js): each sport on its own field, the two teams in
// their kits moving with their whole bodies (the batter strides and turns into the swing, the pitcher kicks his leg
// up, players kick, shoot, skate, block and catch), and stands full of both teams' fans in their colours who jump
// up when their team scores. Nobody walks through anybody: the players are pushed apart every frame.

// ---------- which game is on at a town's stadium ----------
const AR_CACHE = {};
const arTeamIn = (sp, town) => LEAGUES[sp].teams.findIndex(T => T.t === town);
// a town's own team (for the batting cage and the like): its baseball team, or its first team in another league
function townTeam(town) {
  const tc = homeCity(town);   // v0.59: a town without teams cheers for its nearest city
  for (const sp of ['baseball', ...SPORT_KEYS]) { const i = arTeamIn(sp, tc); if (i >= 0) return { sp, i, T: lgTeam(sp, i) }; }
  return { sp: 'soccer', i: 0, T: lgTeam('soccer', 0) };
}
// v0.59 (Mason #30): a team city's home games, at its own venues: the stadium has the outdoor sports, the arena
// (hockey, basketball) the indoor ones; where a city has no arena yet, the stadium takes those too (only as many as
// fit one after another). A town without pro teams has none (it's no one's home).
const AR_INDOOR = ['hockey', 'basketball'];
const curVenue = () => (typeof UI !== 'undefined' && UI.inVenue === 'arena' ? 'arena' : 'stadium');
const townHasArena = town => (layoutOf(town).stores || []).some(st => st[0] === 'arena');
function arenaDay(town, venue = 'stadium') {
  if (allOff() || !isTeamCity(town)) return [];
  const indoorHere = venue === 'arena' || !townHasArena(town), all = [];
  SPORT_KEYS.forEach(sp => {
    if (AR_INDOOR.includes(sp) ? !indoorHere : venue === 'arena') return;
    const own = todayGames(sp).find(G => G.h === arTeamIn(sp, town));
    if (own) all.push({ ...own, kind: 'home', venue });
  });
  const keep = [];
  all.sort((a, b) => a.start - b.start).forEach(G => { if (!keep.some(K => G.start < K.end && K.start < G.end)) keep.push(G); });
  return keep;
}
// The game at the stadium now: the one that's on; or the one that just finished (for 45 minutes); or the next one.
function arenaNow(town, ms = now(), venue = curVenue()) {
  const sec = Math.floor(ms / 1000), ck = town + '|' + venue, c = AR_CACHE[ck];
  if (c && c.sec === sec) return c.v;
  const day = arenaDay(town, venue);
  let v;
  if (day.length) {
    const live = day.find(G => ms >= G.start && ms < G.end), done = day.filter(G => ms >= G.end).pop(), next = day.find(G => G.start > ms);
    v = live ? arenaState(live, ms, 'live') : done && (!next || ms - done.end < 0.75 * HOUR) ? arenaState(done, ms, 'done') : next ? arenaState(next, ms, 'soon') : arenaState(done, ms, 'done');
    v.day = day;
  } else v = { off: true, day: [], si: SPORT_KEYS.map(k => seasonNow(ms, k)).sort((a, b) => a.left - b.left)[0], none: !allOff(ms), noTeam: !isTeamCity(town) };   // v0.58: none = no game here today (it isn't the break); v0.59: noTeam = a town with no pro teams
  AR_CACHE[ck] = { sec, v };
  return v;
}
// how a game stands at a moment: the score so far, the last score (for 40 seconds: the fans of that team go wild),
// the quarter / period / inning / minute
function arenaState(G, ms, state) {
  const L = league(G.sp, G.s), R = gameResult(L, G.r, G.g), len = G.end - G.start, prog = clamp((ms - G.start) / len, 0, 1);
  const tl = arTimeline(G.sp, G.s, G.r, G.g, R), upto = state === 'live' ? prog : state === 'done' ? 1 : 0;
  let score = [0, 0], last = null;
  if (tl.cont) score = [0, 1].map(w => tl.at(w, upto));
  else tl.ev.forEach(e => { if (e.u <= upto) { score[e.side] += e.pts; last = e; } });
  const at = last ? G.start + last.u * len : 0;
  return { ...G, state, prog, score, last: last && state === 'live' && ms - at < 40e3 ? { ...last, at } : null, R: state === 'done' ? R : null, pens: tl.pens, note: state === 'done' ? R.note : '', clock: arClock(G.sp, state, prog, R, tl) };
}
// when each score comes: football in touchdowns (7), field goals (3) and the odd 6 or 2; baseball runs in their
// innings (the visitors bat first); goals spread over the game (a hockey overtime is one goal after the 60 minutes;
// a soccer game that ends level goes to penalties); basketball goes up a little at a time
function arTimeline(sp, s, r, g, R) {
  const q = n => lgRand(s * 31 + r * 7 + g + 1, n, 77), ev = [], sc = [R.hs, R.as], put = (side, pts, u0, u1, n) => ev.push({ side, pts, u: u0 + (u1 - u0) * q(n) });
  let pens = null;
  if (sp === 'basketball') {
    const cum = [0, 1].map(w => { const a = [0]; for (let i = 0; i < 48; i++) a.push(a[i] + 0.4 + q(w * 100 + i)); return a.map(v => v / a[48]); });
    return { cont: true, at: (w, u) => { if (u >= 1) return sc[w]; const x = u * 48, i = Math.floor(x); return Math.round(sc[w] * (cum[w][i] + (cum[w][i + 1] - cum[w][i]) * (x - i))); } };
  }
  if (sp === 'football') sc.forEach((p, side) => arFbPlays(p).forEach((pts, i) => put(side, pts, 0.02, 0.98, side * 50 + i)));
  else if (sp === 'baseball') sc.forEach((p, side) => { for (let i = 0; i < p; i++) { const inn = Math.min(8, Math.floor(q(side * 50 + i) * 9)); ev.push({ side, pts: 1, u: (inn * 2 + (side ? 0 : 1) + 0.15 + 0.7 * q(side * 50 + i + 25)) / 18 }); } });
  else {
    const ot = R.note === 'ot', reg = ot ? 0.9 : sp === 'soccer' && R.note === 'pen' ? 0.95 : 1;
    sc.forEach((p, side) => { const won = (side === 0) === R.hw; for (let i = 0; i < p; i++) { if (ot && won && i === p - 1) put(side, 1, 0.92, 0.99, side * 50 + i); else put(side, 1, 0.01, reg - 0.01, side * 50 + i); } });
    if (R.note === 'pen') { const pw = 3 + Math.floor(q(90) * 3), pl = Math.max(1, pw - 1 - Math.floor(q(91) * 2)); pens = R.hw ? [pw, pl] : [pl, pw]; }
  }
  ev.sort((a, b) => a.u - b.u);
  return { ev, pens };
}
function arFbPlays(p) {
  for (let td = Math.floor(p / 7); td >= 0; td--) {
    const r = p - td * 7, T = Array(td).fill(7);
    if (r % 3 === 0) return [...T, ...Array(r / 3).fill(3)];
    if (r >= 6 && (r - 6) % 3 === 0) return [...T, 6, ...Array((r - 6) / 3).fill(3)];
    if (r >= 2 && (r - 2) % 3 === 0) return [...T, 2, ...Array((r - 2) / 3).fill(3)];
  }
  return Array(p).fill(1);
}
const arOrd = n => (curLang() === 'zh' ? n : n + ((n % 100 > 10 && n % 100 < 14) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'));
function arClock(sp, state, prog, R, tl) {
  const zh = curLang() === 'zh';
  if (state === 'soon') return '';
  if (state === 'done') return t('gm_final') + (R.note === 'pen' ? ` (${t('lg_pen')} ${tl.pens[0]}–${tl.pens[1]})` : R.note === 'ot' ? ` (${t('lg_ot')})` : '');
  const mm = (min, f) => { const left = Math.max(0, min * (1 - f)), m = Math.floor(left), sx = Math.floor((left - m) * 60); return `${m}:${String(sx).padStart(2, '0')}`; };
  if (sp === 'football' || sp === 'basketball') { const q = Math.min(3, Math.floor(prog * 4)); return (zh ? `第 ${q + 1} 节 ` : `Q${q + 1} `) + mm(sp === 'football' ? 15 : 12, prog * 4 - q); }
  if (sp === 'hockey') { const per = R.note === 'ot' ? 0.3 : 1 / 3; if (prog >= per * 3) return zh ? '加时' : 'OT'; const p = Math.min(2, Math.floor(prog / per)); return (zh ? `第 ${p + 1} 节 ` : `P${p + 1} `) + mm(20, prog / per - p); }
  if (sp === 'soccer') { const reg = R.note === 'pen' ? 0.95 : 1; return prog >= reg ? (zh ? '点球大战' : 'Penalties') : t('gm_min', { n: Math.min(90, Math.floor(prog / reg * 90) + 1) }); }
  const h = Math.min(17, Math.floor(prog * 18)); return t(h % 2 ? 'gm_bot' : 'gm_top', { n: arOrd(Math.floor(h / 2) + 1) });
}
// baseball: are the visitors batting (the top of an inning)?
const arTop = A => Math.min(17, Math.floor(A.prog * 18)) % 2 === 0;
// short team names for the scoreboard
const arShort = (sp, i) => { const T = lgTeam(sp, i); return curLang() === 'zh' ? T.zh : T.en; };

// ---------- the kits ----------
const KIT_CACHE = {};
const arLum = c => { const n = parseInt(c.slice(1), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255; };
// [home, away] shirts: the home team in its colour, the visitors in white (in their colour if the home shirt is light)
function arKits(sp, h, a) {
  const H = lgTeam(sp, h).c, W = lgTeam(sp, a).c;
  let away = { shirt: '#f4f6f8', trim: W[0] };
  if (arLum(H[0]) > 0.75) away = arLum(W[0]) > 0.75 ? { shirt: W[1], trim: W[0] } : { shirt: W[0], trim: W[1] };
  return [{ shirt: H[0], trim: H[1] }, away];
}
function kitLook(sp, G, side, num, role = '') {
  const key = `${sp}|${G.h}|${G.a}|${side}|${num}|${role}`;
  if (KIT_CACHE[key]) return KIT_CACHE[key];
  const ti = side ? G.a : G.h, T = lgTeam(sp, ti), K = arKits(sp, G.h, G.a)[side], i = num * 7 + ti * 3 + side;
  let L = { shirt: K.shirt, trim: K.trim, num, top: 'tshirt', bottom: 'jeans', pants: '#2d2d34', skin: SKINS[i % 4], hair: ['short', 'buzz', 'curly', 'short', 'bun'][i % 5], hairCol: HAIR_COLORS[(i * 3) % 4], body: 'regular', mob: 'walk', shoes: 'sneakers', shoeCol: '#2d2d34', hat: 'nohat' };
  if (role === 'ref') L = { ...L, num: null, trim: null, ...({ soccer: { shirt: '#2d2d34', trim: '#f2c230', bottom: 'shorts', pants: '#2d2d34', socks: '#2d2d34' }, basketball: { shirt: '#9aa3ad', trim: '#2d2d34', pants: '#2d2d34' }, baseball: { shirt: '#2d2d34', pants: '#5b6470', hat: 'cap', hatCol: '#2d2d34' }, football: { shirt: '#f4f6f8', stripes: '#2d2d34', hat: 'cap', hatCol: '#f4f6f8', pants: '#f4f6f8' }, hockey: { shirt: '#f4f6f8', stripes: '#2d2d34', pants: '#2d2d34', hat: 'helmet', hatCol: '#2d2d34' } })[sp] };
  else if (sp === 'soccer') Object.assign(L, role === 'gk' ? { shirt: side ? '#7fd36a' : '#f2c230', trim: '#2d2d34', bottom: 'shorts', pants: '#2d2d34', socks: side ? '#7fd36a' : '#f2c230' } : { bottom: 'shorts', pants: side ? K.trim : '#f4f6f8', socks: side ? K.shirt : K.shirt });
  else if (sp === 'basketball') Object.assign(L, { bottom: 'shorts', pants: K.shirt, shoes: 'hightops', shoeCol: K.trim });
  else if (sp === 'football') Object.assign(L, { pants: side ? '#f4f6f8' : '#e6dcc0', hat: 'helmet', hatCol: T.c[0], hatTrim: T.c[1], mask: 'cage' });
  else if (sp === 'hockey') Object.assign(L, { pants: shade(T.c[0], -0.3), hat: 'helmet', hatCol: side ? '#f4f6f8' : T.c[0], hatTrim: K.trim, mask: role === 'gk' ? 'cage' : 'visor', shoeCol: '#1d1d22' });
  else if (sp === 'baseball') Object.assign(L, { pants: side ? '#c9cfd6' : '#f4f6f8', hat: role === 'bat' ? 'helmet' : role === 'c' ? 'helmet' : 'cap', hatCol: role === 'c' ? '#2d2d34' : T.c[0], hatTrim: T.c[1], mask: role === 'bat' ? 'flap' : role === 'c' ? 'cage' : null });
  if (L.hat === 'helmet') L.hair = i % 2 ? 'buzz' : 'short';   // nothing sticks out of a helmet
  return (KIT_CACHE[key] = L);
}

// ---------- the athletes' moves (poses for drawPerson; written for the older skeleton, facing +x) ----------
const arE = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
// keyframes: [[u, value], ...] → the value at u (eased between frames; numbers or [x, y])
function arKf(u, F) {
  if (u <= F[0][0]) return F[0][1];
  for (let i = 1; i < F.length; i++) if (u <= F[i][0]) {
    const [u0, a] = F[i - 1], [u1, b] = F[i], v = arE((u - u0) / (u1 - u0));
    return Array.isArray(a) ? a.map((x, j) => x + (b[j] - x) * v) : a + (b - a) * v;
  }
  return F[F.length - 1][1];
}
const arMid = (s, h, dx = 0, dy = 1.5) => [(s[0] + h[0]) / 2 + dx, (s[1] + h[1]) / 2 + dy];
function arRunLegs(k, ph, g = 1) {
  const sw = Math.sin(ph), cw = Math.cos(ph);
  k.lift = Math.abs(cw) * 2.2 * g; k.lean = 1.6 * g;
  k.legs[0].f = [-1.6 - sw * 6 * g, -Math.max(0, -sw) * 3 * g]; k.legs[0].k = [-1.6 - sw * 3 * g + 2, -6 - Math.max(0, -sw) * 1.5 * g];
  k.legs[1].f = [1.6 + sw * 6 * g, -Math.max(0, sw) * 3 * g]; k.legs[1].k = [1.6 + sw * 3 * g + 2, -6 - Math.max(0, sw) * 1.5 * g];
  k.arms[0].e = [-2.5 + sw * 2.5, -16.5]; k.arms[0].h = [sw * 4, -14 - Math.max(0, sw) * 2];
  k.arms[1].e = [2.5 - sw * 2.5, -16.5]; k.arms[1].h = [4 - sw * 4, -14 - Math.max(0, -sw) * 2];
  k.sway = -Math.sin(ph - 0.6) * 1.4;
}
const SPORT_POSES = {
  // the batter (o.u: through one pitch; o.swing): a waggle, the load (the front knee comes up), the stride, then the
  // hips and hands turn through the ball and the bat wraps round over the shoulder (the bat turns in 3D: towards us,
  // level at contact, then round behind the back)
  bat(k, o) {
    const u = o.u || 0, sw = o.swing, w = Math.sin((o.ts || 0) / 260) * 6;
    const TH = sw ? [[0, 200 + w], [0.22, 200], [0.27, 212], [0.31, 200], [0.322, 110], [0.335, 0], [0.36, -80], [0.45, -165], [0.62, -165], [0.78, -160]] : [[0, 200 + w], [0.22, 200], [0.27, 212], [0.31, 205], [0.45, 205], [0.78, 200]];
    const PH = sw ? [[0, 55], [0.22, 55], [0.27, 62], [0.31, 52], [0.322, 25], [0.335, 6], [0.36, 15], [0.45, -6], [0.62, -6], [0.78, 55]] : [[0, 55], [0.27, 62], [0.31, 56], [0.78, 55]];
    const HD = sw ? [[0, [-1.5, -21.5]], [0.22, [-1.5, -21.5]], [0.27, [-2.8, -21.6]], [0.31, [-2.2, -21]], [0.322, [1.4, -17.5]], [0.335, [4.6, -16]], [0.36, [3.6, -18.8]], [0.45, [1.6, -23.4]], [0.62, [1.6, -23.4]], [0.78, [-1.5, -21.5]]] : [[0, [-1.5, -21.5]], [0.27, [-2.8, -21.6]], [0.31, [-2.4, -21.2]], [0.78, [-1.5, -21.5]]];
    const th = arKf(u, TH) * Math.PI / 180, ph = arKf(u, PH) * Math.PI / 180, hd = arKf(u, HD);
    const piv = sw ? arKf(u, [[0.31, 0], [0.345, 1], [0.62, 1], [0.78, 0]]) : 0;
    k.legs[1] = { h: [1.6, -10], k: arKf(u, [[0, [3.8, -5.4]], [0.22, [3.8, -5.4]], [0.27, [3.4, -7.8]], [0.31, [5.2, -5.3]], [0.62, [5.4, -5.4]], [0.8, [3.8, -5.4]]]), f: arKf(u, [[0, [3.6, 0]], [0.22, [3.6, 0]], [0.27, [2.4, -2.6]], [0.31, [5.8, 0]], [0.62, [5.8, 0]], [0.8, [3.6, 0]]]) };
    k.legs[0] = { h: [-1.6, -10], k: [-3.2 + piv * 2.6, -5.2 + piv * 0.4], f: [-4.2 + piv * 0.6, -piv] };
    k.lift = -1.4 + piv * 0.4;
    k.lean = arKf(u, sw ? [[0, -0.4], [0.27, -1], [0.31, 0], [0.335, 1.3], [0.45, 0.8], [0.78, -0.4]] : [[0, -0.4], [0.27, -1], [0.31, -0.2], [0.78, -0.4]]);
    k.arms[1] = { s: k.arms[1].s, e: arMid(k.arms[1].s, hd, 0.6, 1.6), h: hd };
    k.arms[0] = { s: k.arms[0].s, e: arMid(k.arms[0].s, hd, -0.4, 2), h: [hd[0] - 0.6, hd[1] + 1.2] };
        k.bat = [Math.cos(th) * Math.cos(ph) * 15, -Math.sin(ph) * 15]; k.prop = o.drop ? null : 'bat'; k.propBack = !!sw && u > 0.345 && u < 0.72;   // round behind the back after the swing
  },
  // the pitcher (o.u: 0 set, 0.35 the leg kick, 0.62 the stride, 0.75 the ball goes, then the follow-through)
  pitch(k, o) {
    const u = o.u || 0;
    k.legs[1] = { h: [1.6, -10], k: arKf(u, [[0, [1.8, -5]], [0.12, [1.8, -5]], [0.35, [4.2, -12.5]], [0.62, [7.6, -5.6]], [1, [7.2, -5.4]]]), f: arKf(u, [[0, [1.6, 0]], [0.12, [1.6, 0]], [0.35, [1.6, -6.8]], [0.62, [8.4, 0]], [1, [8.4, 0]]]) };
    k.legs[0] = { h: [-1.6, -10], k: arKf(u, [[0, [-1.5, -5]], [0.62, [-2.4, -4.4]], [0.78, [-0.4, -5.6]], [1, [2.6, -7.4]]]), f: arKf(u, [[0, [-1.6, 0]], [0.62, [-3.6, 0]], [0.78, [-2.4, -1.4]], [1, [1.4, -4]]]) };
    k.lift = arKf(u, [[0, 0], [0.35, 0.4], [0.62, -2], [1, -1.6]]); k.lean = arKf(u, [[0, 0], [0.35, -0.9], [0.62, 0.2], [0.75, 2.2], [1, 2.8]]);
    const hn = arKf(u, [[0, [2.4, -17.5]], [0.12, [2.4, -17.5]], [0.35, [1.4, -20]], [0.5, [-4.5, -19]], [0.62, [-9.5, -25]], [0.75, [8.5, -31]], [1, [6.2, -11.5]]]);
    const en = arKf(u, [[0, [1.8, -16]], [0.35, [1.2, -16.5]], [0.5, [-2.4, -17]], [0.62, [-5, -21]], [0.75, [4.6, -27]], [1, [4, -15.5]]]);
    const hf = arKf(u, [[0, [3, -17.5]], [0.12, [3, -17.5]], [0.35, [2, -20]], [0.5, [5, -20]], [0.62, [6, -21]], [0.75, [2, -16.5]], [1, [-1.4, -13]]]);
    k.arms[1] = { s: k.arms[1].s, e: en, h: hn }; k.arms[0] = { s: k.arms[0].s, e: arMid(k.arms[0].s, hf), h: hf };
    k.prop = 'glove'; k.ball = u < 0.74 ? 1 : 0;
  },
  // knees bent, weight forward, hands out in front, a little bounce (a fielder waiting for the pitch, a umpire)
  ready(k, o) {
    const b = Math.sin((o.ts || 0) / 180 + (o.seed || 0)) * 0.35;
    k.lift = -3 + b; k.lean = 1.7;
    k.legs[0] = { h: [-1.6, -10], k: [-1.2, -5.6], f: [-3.6, 0] }; k.legs[1] = { h: [1.6, -10], k: [4.6, -5.6], f: [3.8, 0] };
    k.arms[0] = { s: k.arms[0].s, e: [2, -15.6], h: [5, -12.6] }; k.arms[1] = { s: k.arms[1].s, e: [3, -15.4], h: [5.6, -12.2] };
    if (o.gear) k.prop = o.gear;
  },
  // the catcher, down on his heels, the glove up as the pitch comes in (o.u)
  catcher(k, o) {
    const c = o.u || 0;
    k.lift = -6.6; k.lean = 1.1; k.legFront = true;
    k.legs[0] = { h: [-1.6, -10], k: [0.4, -6.6], f: [-3, 0] }; k.legs[1] = { h: [1.6, -10], k: [6, -7], f: [3.6, 0] };
    k.arms[0] = { s: k.arms[0].s, e: [3.6, -17 - c], h: [6.8, -18 - c * 2.4] }; k.arms[1] = { s: k.arms[1].s, e: [2, -14.5], h: [3.6, -12] };
    k.prop = 'glove'; k.ball = 0;
  },
  // an overhand throw (o.u: 0 wind back, 0.55 let go, 1 follow through); o.gear: 'glove' or 'football'
  throw(k, o) {
    const u = o.u || 0;
    k.arms[1] = { s: k.arms[1].s, e: arKf(u, [[0, [2, -16]], [0.4, [-3.2, -19.6]], [0.55, [2.2, -23.6]], [1, [3.8, -15.8]]]), h: arKf(u, [[0, [2.5, -16]], [0.4, [-6.4, -22]], [0.55, [4.6, -25.4]], [1, [5.4, -12]]]) };
    k.arms[0] = { s: k.arms[0].s, e: [2.4, -19], h: arKf(u, [[0, [3, -16]], [0.4, [5.6, -20.5]], [0.6, [1.6, -16]], [1, [-1.2, -13]]]) };
    k.legs[1] = { h: [1.6, -10], k: arKf(u, [[0, [1.7, -5]], [0.4, [4.6, -5.3]], [1, [4.8, -5.4]]]), f: arKf(u, [[0, [1.6, 0]], [0.4, [5, 0]], [1, [5, 0]]]) };
    k.legs[0] = { h: [-1.6, -10], k: arKf(u, [[0, [-1.5, -5]], [0.55, [-2, -4.8]], [1, [-0.2, -5.6]]]), f: arKf(u, [[0, [-1.6, 0]], [0.4, [-3.2, 0]], [0.6, [-3, -0.6]], [1, [-1.4, -1.8]]]) };
    k.lean = arKf(u, [[0, 0], [0.4, -0.8], [0.55, 1.4], [1, 2]]); k.lift = arKf(u, [[0, 0], [0.4, -1], [1, -1.2]]);
    k.prop = o.gear || null; k.ball = u < 0.55 ? 1 : 0;
  },
  // both hands up for a high ball (o.air: jumping for it; o.has: got it)
  catch(k, o) {
    const r = Math.sin((o.ts || 0) / 300) * 0.4;
    k.arms[0] = { s: k.arms[0].s, e: [5, -24], h: [9.4, -27.5 + r] }; k.arms[1] = { s: k.arms[1].s, e: [6, -23.5], h: [11, -27 - r] };
    k.legs[0].f = [-2.6, 0]; k.legs[1].f = [2.8, 0]; k.lean = -0.3; k.air = o.air || 0;
    k.prop = o.gear || null; k.ball = o.has ? 1 : 0; k.catchHi = true;
  },
  // a soccer kick (o.u: the leg swings back, 0.5 the strike, then through and up)
  kick(k, o) {
    const u = o.u || 0;
    k.legs[0] = { h: [-1.6, -10], k: [2, -5.2], f: [1, 0] };
    k.legs[1] = { h: [1.6, -10], k: arKf(u, [[0, [2, -5]], [0.38, [-1, -5.8]], [0.5, [3.4, -6]], [0.75, [5, -9]], [1, [2.6, -5]]]), f: arKf(u, [[0, [2.2, 0]], [0.38, [-5.4, -5]], [0.5, [5.4, -1.6]], [0.75, [7.6, -7]], [1, [2.4, 0]]]) };
    k.legFront = true; k.lift = -0.8;
    k.lean = arKf(u, [[0, 0.4], [0.38, -0.8], [0.5, 0.6], [0.75, -0.4], [1, 0.4]]);
    k.arms[0] = { s: k.arms[0].s, e: [-3.6, -18.5], h: [-6.2, -16.5] };
    k.arms[1] = { s: k.arms[1].s, e: arKf(u, [[0, [3, -18]], [0.5, [-1.5, -17]], [1, [3, -18]]]), h: arKf(u, [[0, [5.4, -17]], [0.5, [-3.5, -14]], [1, [5.4, -17]]]) };
  },
  // hockey: low and leaning, pushing off one skate then the other (o.g: how hard), the stick on the ice in front
  skate(k, o) {
    const g = o.g == null ? 1 : o.g, s1 = Math.sin((o.ph || 0) * 0.55), c1 = Math.cos((o.ph || 0) * 0.55);
    k.lift = -2.8 + Math.abs(c1) * 0.6 * g; k.lean = 2.6;
    k.legs[0] = { h: [-1.6, -10], k: [1.6 - Math.max(0, s1) * 2 * g, -6], f: [-0.6 - Math.max(0, s1) * 6 * g, -Math.max(0, -s1) * 1.2 * g] };
    k.legs[1] = { h: [1.6, -10], k: [3.2 - Math.max(0, -s1) * 2 * g, -6], f: [1.6 - Math.max(0, -s1) * 6 * g, -Math.max(0, s1) * 1.2 * g] };
    k.arms[0] = { s: k.arms[0].s, e: [1.6, -16.5], h: [3.6, -15.5] }; k.arms[1] = { s: k.arms[1].s, e: [4.4, -14.5], h: [7, -12] };
    k.blade = [12.5, 0]; k.prop = 'stick';
  },
  // a slap shot or a pass (o.u: the stick goes back and up, 0.5 it hits the puck, then follows through high)
  slap(k, o) {
    SPORT_POSES.skate(k, { ...o, g: 0.2 });
    const u = o.u || 0, hb = arKf(u, [[0, [7, -12]], [0.4, [-3, -20]], [0.5, [6, -12.5]], [0.75, [7.5, -21]], [1, [7, -12]]]), ht = arKf(u, [[0, [3.6, -15.5]], [0.4, [-1, -23]], [0.5, [3, -16]], [0.75, [5, -24]], [1, [3.6, -15.5]]]);
    k.arms[1] = { s: k.arms[1].s, e: arMid(k.arms[1].s, hb, 0.5), h: hb }; k.arms[0] = { s: k.arms[0].s, e: arMid(k.arms[0].s, ht), h: ht };
    k.blade = arKf(u, [[0, [12.5, 0]], [0.4, [-9, -15]], [0.5, [11, 0]], [0.75, [15, -16]], [1, [12.5, 0]]]);
  },
  // the hockey goalie: wide and low, the pads together on the ice to stop a shot (o.u)
  goalie(k, o) {
    const s1 = Math.sin((o.ts || 0) / 400 + (o.seed || 0)) * 0.3, d = o.u || 0;
    k.lift = -3.5 - d * 3; k.lean = 1.4;
    k.legs[0] = { h: [-1.6, -10], k: [-0.4 - d * 1.5, -5.6 + d * 3], f: [-4.2 - d * 2, 0] }; k.legs[1] = { h: [1.6, -10], k: [4 + d * 2, -5.6 + d * 3], f: [4.4 + d * 2, 0] };
    k.arms[0] = { s: k.arms[0].s, e: [-1.2, -17], h: [-3.2, -19.5 + s1 - d * 2] }; k.arms[1] = { s: k.arms[1].s, e: [4.2, -15.6], h: [6.6, -13] };
    k.blade = [10, 0]; k.prop = 'goalie';
  },
  // the soccer keeper: crouched, arms wide; o.u > 0: up for the ball
  keeper(k, o) {
    const d = o.u || 0, b = Math.sin((o.ts || 0) / 220 + (o.seed || 0)) * 0.3;
    k.prop = 'gkgloves';
    if (d > 0) { k.air = Math.sin(Math.min(1, d) * Math.PI) * 9; k.arms[0] = { s: k.arms[0].s, e: [5, -24], h: [9.6, -28] }; k.arms[1] = { s: k.arms[1].s, e: [6, -23.5], h: [11.2, -27.5] }; k.lean = 0.4; k.legs[0].f = [-2.4, -1]; k.legs[1].f = [2.6, -2]; return; }
    k.lift = -2.4 + b; k.lean = 1.2;
    k.legs[0] = { h: [-1.6, -10], k: [-1.6, -5.4], f: [-3.6, 0] }; k.legs[1] = { h: [1.6, -10], k: [4.2, -5.4], f: [3.6, 0] };
    k.arms[0] = { s: k.arms[0].s, e: [-3.6, -18], h: [-7, -16] }; k.arms[1] = { s: k.arms[1].s, e: [4.6, -18], h: [8, -16] };
  },
  // basketball: bouncing the ball beside you, running or standing
  dribble(k, o) {
    const b = Math.abs(Math.sin((o.ts || 0) / 170 + (o.seed || 0)));
    if (o.moving) arRunLegs(k, o.ph || 0, 0.75);
    else { k.lift = -2; k.lean = 1; k.legs[0] = { h: [-1.6, -10], k: [-0.6, -5.4], f: [-2.8, 0] }; k.legs[1] = { h: [1.6, -10], k: [3.8, -5.4], f: [3.2, 0] }; k.arms[0] = { s: k.arms[0].s, e: [0.4, -17], h: [3, -16] }; }
    k.arms[1] = { s: k.arms[1].s, e: [3.6, -15.5], h: [6, -11 + (1 - b) * 1.6] };
    k.ballAt = [7.2, -2.6 - b * 7.4]; k.ballGround = true; k.prop = 'bball';
  },
  // a jump shot (o.u: crouch, up, the ball goes at the top, land)
  jumpshot(k, o) {
    const u = o.u || 0, inAir = u > 0.22 && u < 0.78;
    k.air = inAir ? Math.sin((u - 0.22) / 0.56 * Math.PI) * 11 : 0; k.lift = u < 0.22 ? -arE(u / 0.22) * 3.5 : u > 0.78 ? -2 : 0;
    k.legs[0] = { h: [-1.6, -10], k: [0, -5.4], f: [-1.4, inAir ? -1.5 : 0] }; k.legs[1] = { h: [1.6, -10], k: [3, -5.4], f: [2, inAir ? -1.8 : 0] };
    const up = arKf(u, [[0, [5, -18]], [0.22, [5.5, -20]], [0.45, [8.5, -30]], [0.55, [11, -32]], [1, [9, -24]]]);
    k.arms[1] = { s: k.arms[1].s, e: [4.6, -24], h: up }; k.arms[0] = { s: k.arms[0].s, e: [3.6, -24], h: [up[0] - 1.8, up[1] + 1.4] };
    if (u < 0.5) { k.ballAt = [up[0] - 0.4, up[1] - 3.2]; k.prop = 'bball'; }
  },
  // basketball defence: low, wide, hands up
  defend(k, o) {
    const s1 = Math.sin((o.ts || 0) / 260 + (o.seed || 0));
    k.lift = -2.8; k.lean = 0.8;
    k.legs[0] = { h: [-1.6, -10], k: [-2.6, -5.4], f: [-4.4 + s1 * 0.8, 0] }; k.legs[1] = { h: [1.6, -10], k: [3.6, -5.4], f: [4.4 + s1 * 0.8, 0] };
    k.arms[0] = { s: k.arms[0].s, e: [-4.6, -22], h: [-9.4, -26 + s1] }; k.arms[1] = { s: k.arms[1].s, e: [5.4, -21], h: [10, -24 - s1] };
  },
  // football: the lineman's three-point stance before the snap
  stance3(k) {
    k.lift = -5.4; k.lean = 3.6;
    k.legs[0] = { h: [-1.6, -10], k: [1.6, -6.4], f: [-3.4, 0] }; k.legs[1] = { h: [1.6, -10], k: [4.8, -6], f: [1.6, 0] };
    k.arms[1] = { s: k.arms[1].s, e: [6, -9], h: [8.4, -5] }; k.arms[0] = { s: k.arms[0].s, e: [3.6, -12], h: [5.6, -10] };
  },
  // football: blocking, driving the legs, hands on the man in front
  block(k, o) {
    const s1 = Math.sin((o.ph || 0) * 0.7), p = Math.sin((o.ts || 0) / 150 + (o.seed || 0)) * 0.6;
    k.lift = -3; k.lean = 2.6 + p * 0.3;
    k.legs[0] = { h: [-1.6, -10], k: [0.4, -5.6], f: [-3.8 - s1 * 1.2, -Math.max(0, s1) * 1.4] }; k.legs[1] = { h: [1.6, -10], k: [4, -5.6], f: [2.4 + s1 * 1.2, -Math.max(0, -s1) * 1.4] };
    k.arms[0] = { s: k.arms[0].s, e: [3.6, -18.5], h: [7 + p, -19.5] }; k.arms[1] = { s: k.arms[1].s, e: [4.4, -18], h: [7.6 + p, -18.5] };
  },
  // football: running with the ball tucked under the arm
  carry(k, o) { arRunLegs(k, o.ph || 0, 1); k.arms[1] = { s: k.arms[1].s, e: [1.2, -15], h: [3.6, -17] }; k.ball = 1; k.prop = 'football'; },
  // arms up, jumping (a goal!)
  cheer(k, o) {
    const ts = o.ts || 0, w = Math.sin(ts / 150 + (o.seed || 0)) * 1.2;
    k.air = o.jump ? Math.abs(Math.sin(ts / 190 + (o.seed || 0))) * 5 : 0;
    k.arms[0] = { s: k.arms[0].s, e: [-5.4, -25], h: [-9.6 + w, -30.5] }; k.arms[1] = { s: k.arms[1].s, e: [6.4, -25], h: [11 - w, -31] };
    k.legs[0].f = [-2.2, 0]; k.legs[1].f = [2.2, 0];
  },
};
// what they hold (in drawPerson's frame: B() places a body point; the ground is y = 0)
function arBall(x, y, r) { circle(x, y, r, '#e8742c', INK_COL, 0.5); line(x - r, y, x + r, y, '#5a2a10', 0.35); line(x, y - r, x, y + r, '#5a2a10', 0.35); }
const SPORT_PROPS = {
  bat(k, ts, B) {
    if (!k.bat) return;
    const g = B(k.arms[1].h), v = k.bat, p = u => [g[0] + v[0] * u, g[1] + v[1] * u], a = p(-0.1), m = p(0.42), e = p(1);
    line(a[0], a[1], m[0], m[1], INK_COL, 2.1); line(m[0], m[1], e[0], e[1], INK_COL, 3.1);
    line(a[0], a[1], m[0], m[1], '#c9925a', 1.1); line(m[0], m[1], e[0], e[1], '#e3b878', 2.1); circle(a[0], a[1], 0.9, '#c9925a');
  },
  glove(k, ts, B) {
    const [x, y] = B(k.arms[0].h); ellipse(x + 0.6, y - 0.4, 2.6, 3, '#8a5a36', INK_COL, 0.5); ellipse(x + 1, y - 0.6, 1.3, 1.7, '#a8743f');
    if (k.ball) { const [bx, by] = B(k.arms[1].h); circle(bx + 0.4, by - 0.8, 1.2, '#ffffff', '#c9cfd6', 0.3); }
  },
  football(k, ts, B) { if (!k.ball) return; const [x, y] = B(k.arms[1].h); ellipse(x + 1, y - 1, 2.7, 1.7, '#8a4a26', INK_COL, 0.5, -0.5); line(x + 0.2, y - 1.4, x + 1.8, y - 2.1, '#ffffff', 0.5); },
  bball(k, ts, B) { if (!k.ballAt) return; const [x, y] = k.ballGround ? k.ballAt : B([k.ballAt[0], bodyY(k.ballAt[1])]); arBall(x, y, 2.6); },
  stick(k, ts, B) {
    const top = B(k.arms[0].h), bl = [k.blade[0], k.blade[1] * 0.86], dx = bl[0] - top[0], dy = bl[1] - top[1];
    line(top[0] - dx * 0.08, top[1] - dy * 0.08, bl[0], bl[1], '#2d2d34', 1.3); line(bl[0], bl[1], bl[0] + 3.8, bl[1] + 0.3, '#2d2d34', 1.9); line(bl[0] + 0.5, bl[1] + 0.1, bl[0] + 3.3, bl[1] + 0.3, '#f4f6f8', 0.7);
  },
  goalie(k, ts, B) {
    k.legs.forEach(l => { const x0 = Math.min(l.k[0], l.f[0]) - 2.4, x1 = Math.max(l.k[0], l.f[0]) + 2.4; rrect(x0, l.k[1] - 2, x1 - x0, -l.k[1] + 1.5, 1.4, '#f4f6f8', INK_COL, 0.5); line(x0 + 1, l.k[1] + 1, x1 - 1, l.k[1] + 1, '#c9cfd6', 0.6); });
    const [gx, gy] = B(k.arms[0].h); ellipse(gx, gy - 0.5, 3.2, 3.4, '#f4f6f8', INK_COL, 0.5);
    const [bx, by] = B(k.arms[1].h); rrect(bx - 1, by - 3, 3, 4.4, 0.6, '#f4f6f8', INK_COL, 0.5);
    line(bx + 1, by + 1, k.blade[0], 0, '#2d2d34', 1.3); line(k.blade[0], 0, k.blade[0] + 4.4, 0.3, '#2d2d34', 2.4);
  },
  gkgloves(k, ts, B) { [0, 1].forEach(i => { const [x, y] = B(k.arms[i].h); circle(x + 0.4, y, 1.7, '#f2c230', INK_COL, 0.4); }); },
};

// ---------- the fields ----------
const AR_SC = 0.62;                      // athletes in the stadium, against a townie
const AR_SHAPE = { football: 2.25, hockey: 2.35, basketball: 1.87, soccer: 1.55 };
// where a field point is in the world: football / soccer / hockey / basketball: a (−1 … 1, end to end) and c (−1 … 1,
// side to side), kept to the real shape of the field; baseball: in bases from home plate (1st base is a = 1,
// 3rd base c = 1), home plate in the right-hand corner so the pitcher and batter face each other across the screen
function fieldMap(sp, x, y, w, d) {
  if (sp === 'baseball') {
    const m = Math.min(w, d), s = m * 0.42, H = [x + w - m * 0.2, y + m * 0.2];
    return { sp, s, H, R: m * 0.77 / s, at: (a, c) => [H[0] - a * s, H[1] + c * s], ua: s, uc: s };
  }
  let W = w, D = d; const long = w >= d, Lw = Math.max(w, d), Ls = Math.min(w, d), r = AR_SHAPE[sp], mg = sp === 'hockey' ? 0.04 : 0.07;
  let fl = Lw * (1 - mg * 2), fs = Ls * (1 - mg * 2);
  if (fl / fs > r) fl = fs * r; else fs = fl / r;
  if (long) { W = fl; D = fs; } else { W = fs; D = fl; }
  const X0 = x + (w - W) / 2, Y0 = y + (d - D) / 2;
  return { sp, long, X0, Y0, W, D, ua: fl / 2, uc: fs / 2, at: (a, c) => (long ? [X0 + W * (a + 1) / 2, Y0 + D * (c + 1) / 2] : [X0 + W * (c + 1) / 2, Y0 + D * (a + 1) / 2]) };
}
const arP = (F, a, c) => { const w = F.at(a, c); return iso(w[0], w[1]); };
const arSeg = (F, a0, c0, a1, c1, col, lw) => { const p = arP(F, a0, c0), q = arP(F, a1, c1); line(p.x, p.y, q.x, q.y, col, lw); };
const arQuad = (F, a0, c0, a1, c1, col) => poly([arP(F, a0, c0), arP(F, a1, c0), arP(F, a1, c1), arP(F, a0, c1)], col);
// a circle (or an arc) on the ground, r in tiles round the field point (a, c)
function arRing(F, a, c, r, col, lw, fill, t0 = 0, t1 = Math.PI * 2) {
  const w = F.at(a, c), N = 28, pts = [];
  for (let i = 0; i <= N; i++) { const th = t0 + (t1 - t0) * i / N; pts.push(iso(w[0] + Math.cos(th) * r, w[1] + Math.sin(th) * r)); }
  if (fill) poly(pts, fill); else for (let i = 0; i < N; i++) line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, col, lw);
}
// draw in the ground's plane at a field point (1 unit = 1/20 tile): words and logos painted on the field
function arGround(F, a, c, fn) {
  const w = F.at(a, c), o = iso(w[0], w[1]), ex = iso(w[0] + 1, w[1]), ey = iso(w[0], w[1] + 1);
  ctx.save(); ctx.transform((ex.x - o.x) / 20, (ex.y - o.y) / 20, (ey.x - o.x) / 20, (ey.y - o.y) / 20, o.x, o.y);
  if (F.long === false) ctx.rotate(Math.PI / 2);
  fn(); ctx.restore();
}
function arText(s, size, col, alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.font = `900 ${size}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s, 0, 0); ctx.restore(); }
// the surface and the lines (flat things only; goals, hoops and fences go in with the players so they overlap right)
function arField(F, A, big, lit, z) {
  const sp = F.sp, lw = Math.max(0.7, (big ? 1.5 : 0.8) * z), wl = 'rgba(255,255,255,.92)', home = A && !A.off ? lgTeam(sp, A.h) : null, hc = home ? home.c[0] : '#2f5fa8';
  if (sp === 'soccer' || sp === 'football') {
    const g0 = lit ? '#5fbf52' : '#4fa748', g1 = lit ? '#6acb5c' : '#58b150';
    arQuad(F, -1.06, -1.06, 1.06, 1.06, g0);
    const n = sp === 'football' ? 12 : 10; for (let i = 0; i < n; i++) if (i % 2) arQuad(F, -1 + 2 * i / n, -1, -1 + 2 * (i + 1) / n, 1, g1);
  }
  if (sp === 'soccer') {
    [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1], [0, -1, 0, 1]].forEach(([a0, c0, a1, c1]) => arSeg(F, a0, c0, a1, c1, wl, lw));
    arRing(F, 0, 0, F.uc * 0.27, wl, lw); arRing(F, 0, 0, 0.08, null, 0, wl);
    [-1, 1].forEach(s => {
      const pa = s * 0.685, sa = s * 0.895;
      arSeg(F, s, -0.6, pa, -0.6, wl, lw); arSeg(F, pa, -0.6, pa, 0.6, wl, lw); arSeg(F, pa, 0.6, s, 0.6, wl, lw);
      arSeg(F, s, -0.27, sa, -0.27, wl, lw); arSeg(F, sa, -0.27, sa, 0.27, wl, lw); arSeg(F, sa, 0.27, s, 0.27, wl, lw);
      arRing(F, s * 0.78, 0, 0.07, null, 0, wl);
      const r = F.uc * 0.27, cx = s * 0.78, ang = Math.acos(Math.min(1, (0.105 * F.ua) / r));   // the D outside the box
      if (F.long) arRing(F, cx, 0, r, wl, lw, null, s > 0 ? Math.PI - ang : -ang, s > 0 ? Math.PI + ang : ang);
    });
    if (home && big) arGround(F, 0, 0, () => arText(home.e, 22, '#ffffff', 0.5));
  } else if (sp === 'football') {
    const yd = 0.83 / 50;   // a yard, end to end
    [-1, 1].forEach(s => arQuad(F, s * 0.83, -1, s, 1, s > 0 ? shade(hc, -0.05) : hc));
    for (let k = -10; k <= 10; k++) arSeg(F, k * 5 * yd, -1, k * 5 * yd, 1, k % 2 ? 'rgba(255,255,255,.55)' : wl, k % 2 ? lw * 0.6 : lw);
    if (z > 0.9) for (let k = -49; k <= 49; k++) if (k % 5) [-0.3, 0.3].forEach(c => arSeg(F, k * yd, c - 0.03, k * yd, c + 0.03, 'rgba(255,255,255,.6)', lw * 0.5));
    [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]].forEach(([a0, c0, a1, c1]) => arSeg(F, a0, c0, a1, c1, wl, lw * 1.4));
    if (big && z > 0.45) {
      [10, 20, 30, 40, 50, 40, 30, 20, 10].forEach((nm2, i) => [-0.72, 0.72].forEach(c => arGround(F, (i - 4) * 10 * yd, c, () => { ctx.rotate(c < 0 ? Math.PI / 2 : -Math.PI / 2); arText(String(nm2), 9, '#ffffff', 0.85); })));
      if (home) { arGround(F, 0, 0, () => arText(home.e, 26, '#ffffff', 0.55)); [-1, 1].forEach(s => arGround(F, s * 0.915, 0, () => { ctx.rotate(s * Math.PI / 2); arText(arShort(sp, A.h).toUpperCase(), 12, '#ffffff', 0.9); })); }
    }
  } else if (sp === 'hockey') {
    const ice = lit ? '#f2f8fc' : '#e6eef4', red = '#d9434b', blue = '#2f6fb2';
    arQuad(F, -1, -1, 1, 1, ice);
    arSeg(F, 0, -1, 0, 1, red, lw * 1.8);
    [-0.3, 0.3].forEach(a => arSeg(F, a, -1, a, 1, blue, lw * 1.8));
    [-0.88, 0.88].forEach(a => arSeg(F, a, -0.93, a, 0.93, red, lw * 0.7));
    arRing(F, 0, 0, F.uc * 0.18, blue, lw * 0.8); arRing(F, 0, 0, 0.06, null, 0, blue);
    [-0.65, 0.65].forEach(a => [-0.45, 0.45].forEach(c => { arRing(F, a, c, F.uc * 0.18, red, lw * 0.7); arRing(F, a, c, 0.06, null, 0, red); }));
    [-1, 1].forEach(s => arRing(F, s * 0.88, 0, F.uc * 0.1, null, 0, 'rgba(120,180,240,.45)', s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2));
    if (home && big) arGround(F, 0, 0, () => arText(home.e, 16, '#ffffff', 0.7));
  } else if (sp === 'basketball') {
    const wood = lit ? '#e2b57a' : '#d6a66a';
    arQuad(F, -1.04, -1.06, 1.04, 1.06, shade(hc, -0.2)); arQuad(F, -1, -1, 1, 1, wood);
    for (let i = -6; i <= 6; i++) arSeg(F, -1, i / 6.5, 1, i / 6.5, 'rgba(140,90,40,.18)', 0.5 * z);
    [-1, 1].forEach(s => {
      arQuad(F, s, -0.25, s * 0.62, 0.25, shade(hc, 0.1));
      arSeg(F, s, -0.25, s * 0.62, -0.25, wl, lw); arSeg(F, s * 0.62, -0.25, s * 0.62, 0.25, wl, lw); arSeg(F, s * 0.62, 0.25, s, 0.25, wl, lw);
      arRing(F, s * 0.62, 0, F.uc * 0.25, wl, lw, null, s > 0 ? Math.PI / 2 : -Math.PI / 2, s > 0 ? Math.PI * 1.5 : Math.PI / 2);
      const r3 = F.uc * 0.9; arRing(F, s * 0.885, 0, r3, wl, lw, null, s > 0 ? Math.PI / 2 + 0.2 : -Math.PI / 2 + 0.2, s > 0 ? Math.PI * 1.5 - 0.2 : Math.PI / 2 - 0.2);
    });
    [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1], [0, -1, 0, 1]].forEach(([a0, c0, a1, c1]) => arSeg(F, a0, c0, a1, c1, wl, lw));
    arRing(F, 0, 0, F.uc * 0.25, null, 0, shade(hc, 0.1)); arRing(F, 0, 0, F.uc * 0.25, wl, lw);
    if (home && big) arGround(F, 0, 0, () => arText(home.e, 14, '#ffffff', 0.9));
  } else {   // baseball: grass with mowing stripes, the infield dirt, the bases, the mound, the warning track
    const g0 = lit ? '#5fbf52' : '#4fa748', R = F.R, at = F.at, fan = (r, a0 = -0.06, a1 = Math.PI / 2 + 0.06) => { const P = []; for (let k = 0; k <= 24; k++) { const an = a0 + (a1 - a0) * k / 24; P.push(iso(...at(Math.cos(an) * r, Math.sin(an) * r))); } return P; };
    poly([iso(...at(-0.3, -0.3)), iso(...at(-0.3, R + 0.1)), ...fan(R + 0.1, Math.PI / 2, 0), iso(...at(R + 0.1, -0.3))], g0);
    for (let i = 0; i < 9; i++) if (i % 2) { const r0 = R * (0.35 + i * 0.07), r1 = R * (0.35 + (i + 1) * 0.07); poly([...fan(r0), ...fan(r1).reverse()], 'rgba(255,255,255,.07)'); }
    poly([...fan(R), ...fan(R - 0.16).reverse()], '#b8865a');
    poly([iso(...at(-0.12, -0.12)), iso(...at(-0.12, 1.42)), ...fan(1.42, Math.PI / 2, 0), iso(...at(1.42, -0.12))], '#c9925a');
    poly([iso(...at(0.12, 0.12)), iso(...at(0.88, 0.12)), iso(...at(0.88, 0.88)), iso(...at(0.12, 0.88))], g0);
    arRing(F, 0, 0, F.s * 0.16, null, 0, '#c9925a');
    arSeg(F, 0, 0, R, 0, wl, lw); arSeg(F, 0, 0, 0, R, wl, lw);
    [[0.02, -0.04, 0.02, -0.14], [-0.04, 0.02, -0.14, 0.02]].forEach(([a0, c0, a1, c1]) => arSeg(F, a0, c0, a1, c1, wl, lw * 0.6));
    [[1, 0], [1, 1], [0, 1]].forEach(([a, c]) => { const p = arP(F, a, c); poly([{ x: p.x, y: p.y - 2 * z }, { x: p.x + 3 * z, y: p.y }, { x: p.x, y: p.y + 2 * z }, { x: p.x - 3 * z, y: p.y }], '#ffffff'); });
    { const p = arP(F, 0, 0); poly([{ x: p.x - 2.6 * z, y: p.y - 1.3 * z }, { x: p.x + 1 * z, y: p.y - 2 * z }, { x: p.x + 2.6 * z, y: p.y + 0.6 * z }, { x: p.x - 1 * z, y: p.y + 1.6 * z }], '#ffffff'); }
    const mound = arP(F, 0.47, 0.47); ellipse(mound.x, mound.y, F.s * 5.5 * z, F.s * 2.75 * z, '#c08550'); rrect(mound.x - 2 * z, mound.y - 0.6 * z, 4 * z, 1.2 * z, 0.4 * z, '#ffffff');
    if (big) [0.05, 0.51].forEach(c => { arRing(F, 3.3, c, F.s * 0.13, null, 0, '#c08550'); arRing(F, 2.55, c, F.s * 0.07, null, 0, '#c9925a'); });   // the bullpen: a mound and a plate for each team
  }
}
// tall things on the field: goals, hoops, goalposts, the outfield fence, the dugouts. Each: { k: depth, draw() }
function arStructures(F, A, big, z, U) {
  const sp = F.sp, out = [], add = (a, c, draw) => { const w = F.at(a, c); out.push({ k: w[0] + w[1], draw }); };
  if (sp === 'soccer' || sp === 'hockey') [-1, 1].forEach(s => {
    const gl = sp === 'soccer' ? s * 1.0 : s * 0.88, wd = sp === 'soccer' ? 0.11 : 0.06, back = sp === 'soccer' ? s * 1.05 : s * 0.92, H2 = (sp === 'soccer' ? 30 : 16) * U, col = sp === 'soccer' ? '#ffffff' : '#d9434b';
    add(gl, 0, () => {
      const p0 = arP(F, gl, -wd), p1 = arP(F, gl, wd), b0 = arP(F, back, -wd), b1 = arP(F, back, wd), t0 = up(p0, H2), t1 = up(p1, H2), bt0 = up(b0, H2 * 0.7), bt1 = up(b1, H2 * 0.7);
      poly([t0, t1, bt1, bt0], 'rgba(255,255,255,.18)'); poly([b0, b1, bt1, bt0], 'rgba(255,255,255,.22)');
      for (let i = 1; i < 6; i++) { const u = i / 6, a = lerp(t0, t1, u), b = lerp(bt0, bt1, u), c = lerp(b0, b1, u); line(a.x, a.y, b.x, b.y, 'rgba(255,255,255,.5)', 0.4 * z); line(b.x, b.y, c.x, c.y, 'rgba(255,255,255,.5)', 0.4 * z); }
      [[p0, t0], [p1, t1]].forEach(([p, q]) => line(p.x, p.y, q.x, q.y, col, Math.max(1, 1.6 * z)));
      line(t0.x, t0.y, t1.x, t1.y, col, Math.max(1, 1.6 * z)); [[t0, bt0, b0], [t1, bt1, b1]].forEach(([q, bq, bb]) => { line(q.x, q.y, bq.x, bq.y, 'rgba(255,255,255,.7)', 0.6 * z); line(bq.x, bq.y, bb.x, bb.y, 'rgba(255,255,255,.7)', 0.6 * z); });
    });
  });
  if (sp === 'hockey') {   // the boards round the rink (white, a yellow kick plate along the bottom), glass behind the goals
    const N = 14, edge = (a0, c0, a1, c1, glass) => { for (let i = 0; i < N; i++) { const u0 = i / N, u1 = (i + 1) / N, A0 = [a0 + (a1 - a0) * u0, c0 + (c1 - c0) * u0], A1 = [a0 + (a1 - a0) * u1, c0 + (c1 - c0) * u1];
      add((A0[0] + A1[0]) / 2, (A0[1] + A1[1]) / 2, () => { const p = arP(F, ...A0), q = arP(F, ...A1), h = 8 * U; poly([p, q, up(q, h), up(p, h)], '#f4f6f8', '#c9cfd6', 0.5 * z); poly([p, q, up(q, 2 * U), up(p, 2 * U)], '#f2c230'); line(p.x, p.y - h, q.x, q.y - h, '#d9434b', 0.8 * z);
        if (glass) poly([up(p, h), up(q, h), up(q, h + 14 * U), up(p, h + 14 * U)], 'rgba(200,230,255,.22)', 'rgba(255,255,255,.5)', 0.4 * z); }); } };
    edge(-1.02, -1.04, 1.02, -1.04); edge(1.02, -1.04, 1.02, 1.04, true); edge(1.02, 1.04, -1.02, 1.04); edge(-1.02, 1.04, -1.02, -1.04, true);
  }
  if (sp === 'soccer' && big) [-1, 1].forEach(s => [-1, 1].forEach(c => add(s, c, () => { const p = arP(F, s, c), q = up(p, 14 * U); line(p.x, p.y, q.x, q.y, '#ffffff', 0.8 * z); pg([[q.x, q.y], [q.x + 5 * U, q.y + 2 * U], [q.x, q.y + 4 * U]], '#f2c230'); })));
  if (sp === 'football') [-1, 1].forEach(s => add(s * 1.02, 0, () => {
    const b = arP(F, s * 1.02, 0), cb = up(b, 22 * U), l = up(arP(F, s * 1.02, -0.1), 22 * U), r = up(arP(F, s * 1.02, 0.1), 22 * U), Y = '#f2c230', w2 = Math.max(1, 1.4 * z);
    line(b.x, b.y, cb.x, cb.y, Y, w2 * 1.3); line(l.x, l.y, r.x, r.y, Y, w2); line(l.x, l.y, l.x, l.y - 34 * U, Y, w2); line(r.x, r.y, r.x, r.y - 34 * U, Y, w2);
  }));
  if (sp === 'basketball') [-1, 1].forEach(s => add(s * 1.02, 0, () => {
    const base = arP(F, s * 1.04, 0), bb = up(arP(F, s * 0.93, 0), 62 * U), rim = up(arP(F, s * 0.885, 0), 58 * U), w2 = Math.max(1, 1.6 * z);
    rrect(base.x - 4 * U, base.y - 6 * U, 8 * U, 6 * U, 1 * U, '#2d2d34'); line(base.x, base.y - 4 * U, base.x, base.y - 70 * U, '#5b6470', w2 * 1.6);
    line(base.x, base.y - 70 * U, bb.x, bb.y - 6 * U, '#5b6470', w2 * 1.2);
    const p0 = up(arP(F, s * 0.93, -0.12), 62 * U), p1 = up(arP(F, s * 0.93, 0.12), 62 * U);
    poly([up(p0, 10 * U), up(p1, 10 * U), up(p1, -6 * U), up(p0, -6 * U)], 'rgba(255,255,255,.88)', '#5b6470', 0.6 * z);
    const q0 = up(arP(F, s * 0.93, -0.04), 62 * U), q1 = up(arP(F, s * 0.93, 0.04), 62 * U); poly([q0, q1, up(q1, 5 * U), up(q0, 5 * U)], null, '#e5484d', 0.7 * z);
    ellipse(rim.x, rim.y, 6 * U, 2.6 * U, null, '#e8742c', Math.max(1, 1.3 * z));
    for (let i = 0; i < 5; i++) { const x0 = rim.x - 5.5 * U + i * 2.75 * U; line(x0, rim.y + 1 * U, rim.x + (x0 - rim.x) * 0.55, rim.y + 9 * U, 'rgba(255,255,255,.85)', 0.5 * z); }
  }));
  if (sp === 'baseball') {
    const R = F.R, N = 18;
    for (let i = 0; i < N; i++) { const a0 = i / N * Math.PI / 2, a1 = (i + 1) / N * Math.PI / 2, m = (a0 + a1) / 2;
      add(Math.cos(m) * R, Math.sin(m) * R, () => { const p = arP(F, Math.cos(a0) * R, Math.sin(a0) * R), q = arP(F, Math.cos(a1) * R, Math.sin(a1) * R), h = 12 * U;
        poly([p, q, up(q, h), up(p, h)], '#2f5d3a'); line(p.x, p.y - h, q.x, q.y - h, '#f2c230', Math.max(0.8, 1.2 * z)); }); }
    [[R, 0], [0, R]].forEach(([a, c]) => add(a, c, () => { const p = arP(F, a, c); line(p.x, p.y, p.x, p.y - 40 * U, '#f2c230', Math.max(1, 1.4 * z)); }));
    if (big && A && !A.off) [[0, 0.62, -0.36], [1, -0.36, 0.62]].forEach(([side, a, c]) => add(a, c + (side ? 0 : 0), () => {   // the dugouts: a bench under a low roof, a few players sitting
      const along = side ? [0, 1] : [1, 0], p = (u, v) => arP(F, a + along[0] * u + (side ? -v : 0), c + along[1] * u + (side ? 0 : -v));
      const ln = 0.42, b0 = p(0, 0.14), b1 = p(ln, 0.14), m0 = p(0, 0.1), m1 = p(ln, 0.1), h = 22 * U, col = lgTeam(F.sp, side ? A.a : A.h).c[0];
      if (!side) { poly([b0, b1, up(b1, h), up(b0, h)], '#5b6470'); poly([up(m0, h), up(m1, h), up(b1, h), up(b0, h)], shade(col, -0.1)); line(m0.x, m0.y - h, m1.x, m1.y - h, '#ffffff', 0.8 * z); }   // the far one: a back wall and a short roof (the near one is open, so it hides nothing)
      poly([p(0, 0.13), p(ln, 0.13), up(p(ln, 0.13), 6 * U), up(p(0, 0.13), 6 * U)], '#8a6a4a');   // the bench
      for (let k = 0; k < 3; k++) { const q = p(0.07 + k * 0.14, 0.1); drawPerson(q.x, q.y, z * AR_SC, { look: kitLook(F.sp, A, side, 20 + k * 3), face: side ? -1 : 1, pose: 'sit', seatH: 6, sit: k === 1 ? 'chat' : 'lean', ts: performance.now(), seed: k + side * 5 }); }
    }));
  }
  return out;
}

// ---------- the plays ----------
// Everyone's place comes from the clock alone (the same picture for everyone), worked out on the field (a, c). After
// that the players are pushed apart, so nobody walks through anybody.
const arJit = (id, t) => [Math.sin(t * 0.7 + id * 1.3) * 0.018, Math.cos(t * 0.6 + id * 2.1) * 0.025];
const FLOW = {
  soccer: { n: 11, D: 1.7, B: 6, push: 0.35, goal: 1.0, form: [[-0.94, 0], [-0.62, -0.62], [-0.68, -0.22], [-0.68, 0.22], [-0.62, 0.62], [-0.25, -0.68], [-0.3, -0.22], [-0.3, 0.22], [-0.25, 0.68], [0.12, -0.28], [0.12, 0.28]] },
  hockey: { n: 6, D: 1.05, B: 5, push: 0.45, goal: 0.88, form: [[-0.86, 0], [-0.45, -0.35], [-0.45, 0.35], [-0.1, -0.5], [-0.02, 0], [-0.1, 0.5]] },
};
function arBlock(sp, b, seed) {   // one team's attack: which side, and how it ends (a shot, or the other team wins the ball)
  const h = m => lgRand(b, seed, m), side = (b + seed) & 1, dir = side ? -1 : 1, shot = h(1) < (sp === 'hockey' ? 0.6 : 0.5);
  return { side, dir, shot, wide: shot && h(5) < 0.35,
    end: shot ? { a: dir * FLOW[sp].goal * 0.97, c: (h(2) - 0.5) * (sp === 'hockey' ? 0.14 : 0.24) } : { a: clamp(dir * (0.05 + 0.5 * h(3)), -0.8, 0.8), c: (h(4) - 0.5) * 1.3 } };
}
function arTouch(sp, n, seed) {   // where the ball is at touch n, and whose it is
  const F = FLOW[sp], b = Math.floor(n / F.B), j = n - b * F.B, K = arBlock(sp, b, seed);
  if (j === F.B - 1) return { a: K.end.a, c: K.end.c, side: 1 - K.side, keeper: K.shot, shot: K.shot, wide: K.wide, att: K.side };
  const P = arBlock(sp, b - 1, seed), st = P.shot ? { a: -K.dir * F.goal * 0.93, c: 0, keeper: true } : { a: P.end.a, c: P.end.c };
  if (j === 0) return { ...st, side: K.side };
  const h = m => lgRand(b, seed + 3, m);
  return { a: clamp(st.a + (K.dir * 0.68 - st.a) * j / (F.B - 1) + (h(j) - 0.5) * 0.3, -0.85, 0.85), c: clamp((h(j + 10) - 0.5) * 1.5, -0.85, 0.85), side: K.side };
}
function arFlowBase(sp, side, i, ball) {
  const F = FLOW[sp], f = F.form[i], dir = side ? -1 : 1;
  if (i === 0) return { a: -dir * F.goal * 0.95, c: clamp(ball.c * 0.25, -0.12, 0.12) };
  return { a: clamp(dir * f[0] + F.push * ball.a, -0.92, 0.92), c: clamp(f[1] * 0.9 + ball.c * 0.18, -0.92, 0.92) };
}
function arToucher(sp, W) {   // who takes the ball at W: the same answer for the same point
  if (W.keeper) return W.side * 30;
  let best = 1, bd = 9;
  for (let i = 1; i < FLOW[sp].n; i++) { const b = arFlowBase(sp, W.side, i, W), dd = Math.hypot(b.a - W.a, (b.c - W.c) * 0.7); if (dd < bd) { bd = dd; best = i; } }
  return W.side * 30 + best;
}
function simFlow(sp, A, t, seed) {
  const F = FLOW[sp], n = Math.floor(t / F.D), f = t / F.D - n, hk = sp === 'hockey';
  const W0 = arTouch(sp, n, seed), W1 = arTouch(sp, n + 1, seed), W2 = arTouch(sp, n + 2, seed), p0 = arToucher(sp, W0), p1 = arToucher(sp, W1), p2 = arToucher(sp, W2);
  const fly = W1.shot ? 0.42 : hk ? 0.55 : 0.68, fb = Math.min(1, f / fly), end = W1.wide ? { a: W1.a * 1.04, c: W1.c + (W1.c >= 0 ? 0.17 : -0.17) } : W1;
  const ball = { a: W0.a + (end.a - W0.a) * fb, c: W0.c + (end.c - W0.c) * fb }, dist = Math.hypot((end.a - W0.a) * F.n, (end.c - W0.c) * 6);
  ball.h = p0 === p1 || hk ? 0 : !W1.shot && dist > 5 ? Math.sin(fb * Math.PI) * Math.min(40, dist * 3) : W1.shot ? Math.sin(fb * Math.PI) * 10 : 0;
  const out = [], kp = hk ? 'slap' : 'kick';
  for (let side = 0; side < 2; side++) for (let i = 0; i < F.n; i++) {
    const id = side * 30 + i, base = arFlowBase(sp, side, i, ball), jt = arJit(id, t);
    let pos = { a: base.a + jt[0], c: base.c + jt[1] }, pose = null, u = 0;
    if (id === p1) { const st = id === p0 ? W0 : pos, e = arE(fb); pos = { a: st.a + (W1.a - st.a) * e, c: st.c + (W1.c - st.c) * e }; if (f > 0.84 && p2 !== p1 && !W1.keeper) { pose = kp; u = (f - 0.84) / 0.16 * 0.5; } }
    else if (id === p0) { const e = arE(Math.min(1, f / 0.6)); pos = { a: W0.a + (pos.a - W0.a) * e, c: W0.c + (pos.c - W0.c) * e }; if (f < 0.2) { pose = kp; u = 0.5 + f / 0.2 * 0.5; } }
    if (i === 0 && !pose) { pose = hk ? 'goalie' : 'keeper'; u = W1.shot && id === p1 && f > 0.25 ? (hk ? Math.min(1, (f - 0.25) * 3) : Math.abs(W1.c) > 0.05 || W1.wide ? (f - 0.25) / 0.75 : 0) : 0; }
    const fd = id === p0 && pose ? Math.sign(W1.a - W0.a) : id === p1 && pose ? Math.sign(W2.a - W1.a) : i === 0 ? (side ? -1 : 1) : Math.sign(ball.a - pos.a);
    out.push({ id, side, i, a: pos.a, c: pos.c, pose, u, fdir: fd || (side ? -1 : 1), role: i === 0 ? 'gk' : '', num: i === 0 ? 1 : [0, 2, 4, 5, 3, 7, 6, 8, 11, 9, 10][i] || i + 1 });
  }
  // the nearest defender closes the ball down (a step off)
  const att = W1.side, dfn = out.filter(P => P.side !== att && P.i > 0).sort((P, Q) => Math.hypot(P.a - ball.a, P.c - ball.c) - Math.hypot(Q.a - ball.a, Q.c - ball.c))[0];
  if (dfn) { const ddir = dfn.side ? -1 : 1; dfn.a += (ball.a - ddir * 0.07 - dfn.a) * 0.6; dfn.c += (ball.c - dfn.c) * 0.6; }
  // a referee follows the play
  out.push({ id: 90, side: 2, i: 0, a: clamp(ball.a * 0.8 - 0.05, -0.8, 0.8), c: clamp(ball.c * 0.5 + 0.35, -0.9, 0.9), role: 'ref', num: null });
  if (hk) out.push({ id: 91, side: 2, i: 1, a: clamp(ball.a * 0.8 + 0.1, -0.8, 0.8), c: clamp(ball.c * 0.5 - 0.4, -0.9, 0.9), role: 'ref', num: null });
  const holder = p0 === p1 ? p1 : f >= fly ? p1 : null;
  return { players: out, ball: { ...ball, h: ball.h, holder }, hype: W1.shot && f < 0.6 ? { side: W1.att, v: f / 0.6 } : null, goalSide: null };
}
// a real goal: the scorers run to the corner and jump about, the others walk back; the ball's in the net
function arCelebrate(S2, A, sp) {
  if (!A.last) return S2;
  const ago = now() - A.last.at, e = Math.min(1, ago / 3000, (40e3 - ago) / 3000);
  if (e <= 0) return S2;
  const side = A.last.side, dir = side ? -1 : 1, corner = lgRand(A.last.u * 1000, 1, 1) < 0.5 ? -0.75 : 0.75, gl = sp === 'soccer' ? 1.02 : 0.9;
  S2.players.forEach((P, k) => {
    if (P.side > 1) return;
    let a, c, pose;
    if (P.side === side) { if (P.i === 0) { a = -dir * 0.9; c = 0; pose = 'cheer'; } else { const an = k * 2.4; a = dir * 0.78 + Math.cos(an) * 0.06; c = corner + Math.sin(an) * 0.1; pose = 'cheer'; P.jump = true; } }
    else { const f2 = (sp === 'soccer' ? FLOW.soccer : FLOW.hockey).form[P.i] || [0, 0]; a = -dir * Math.abs(f2[0]) * 0.8; c = f2[1]; pose = P.i === 0 ? null : 'stand'; }
    P.a += (a - P.a) * e; P.c += (c - P.c) * e; if (e > 0.6) { P.pose = pose; P.u = 0; }
  });
  S2.ball = { a: S2.ball.a + (dir * gl - S2.ball.a) * e, c: S2.ball.c * (1 - e), h: 4 * e, holder: null };
  S2.hype = { side, v: 1, goal: true };
  return S2;
}
// ---------- basketball: bring it up, pass it round, shoot ----------
const BK = { D: 1.5, B: 6, hoop: 0.86, spots: [[-0.44, 0], [-0.3, -0.55], [-0.3, 0.55], [-0.08, -0.82], [-0.12, 0.82]] };
function bkBlock(b, seed) {
  const h = m => lgRand(b, seed + 9, m), side = (b + seed) & 1, dir = side ? -1 : 1, who = [0, 0];
  let prev = 0; for (let j = 2; j < 5; j++) { let x = 1 + Math.floor(h(j) * 4); if (x === prev) x = (x % 4) + 1; who.push(x); prev = x; }
  return { side, dir, who, made: h(9) < 0.5, reb: (h(10) - 0.5) * 0.6 };
}
const bkSpot = (dir, i) => ({ a: dir * (BK.hoop + BK.spots[i][0]), c: BK.spots[i][1] });
function bkTouch(n, seed) {
  const b = Math.floor(n / BK.B), j = n - b * BK.B, K = bkBlock(b, seed);
  if (j === 5) return { a: K.dir * BK.hoop, c: 0, shot: true, made: K.made, reb: K.reb, side: K.side, who: -1, b, j };
  if (j === 0) return { a: -K.dir * 0.45, c: (lgRand(b, seed, 4) - 0.5) * 0.4, side: K.side, who: K.side * 30, b, j };
  const s = bkSpot(K.dir, K.who[j]); return { ...s, side: K.side, who: K.side * 30 + K.who[j], b, j };
}
function simBasket(A, t, seed) {
  const n = Math.floor(t / BK.D), f = t / BK.D - n, W0 = bkTouch(n, seed), W1 = bkTouch(n + 1, seed), K = bkBlock(W1.b, seed), dir = K.dir, j = W1.j;
  const hoop = { a: dir * BK.hoop, c: 0 }, out = [];
  // the attackers: on their spots; at the start of an attack they run up from the other end
  const prevK = bkBlock(W1.b - 1, seed), q = j === 0 ? f / 3 : j === 1 ? (1 + f) / 3 : j === 2 ? (2 + f) / 3 : 1;
  const attPos = i => { const s = bkSpot(dir, i), jt = arJit(K.side * 30 + i, t); if (q >= 1) return { a: s.a + jt[0], c: s.c + jt[1] }; const from = bkSpot(prevK.dir, i), d0 = { a: from.a + (prevK.dir * BK.hoop - from.a) * 0.3, c: from.c * 0.7 }; const e = arE(q); return { a: d0.a + (s.a - d0.a) * e, c: d0.c + (s.c - d0.c) * e }; };
  // a shot coming down at the end of the last attack: everyone's still at that end
  const A2 = [0, 1, 2, 3, 4].map(attPos);
  let ball, holder = null;
  const p0 = W0.who, p1 = W1.who;
  for (let side = 0; side < 2; side++) for (let i = 0; i < 5; i++) {
    const id = side * 30 + i, offense = side === K.side;
    let pos, pose = null, u = 0;
    if (offense) pos = A2[i];
    else { const at2 = A2[i]; pos = { a: at2.a + (hoop.a - at2.a) * 0.3, c: at2.c * 0.75 }; pose = 'defend'; }
    if (id === p1 && !W1.shot) { const st = id === p0 ? W0 : pos, e = arE(Math.min(1, f / 0.35)); if (id === p0) pos = { a: st.a + (W1.a - st.a) * arE(f), c: st.c + (W1.c - st.c) * arE(f) }; else pos = { a: pos.a + (W1.a - pos.a) * e, c: pos.c + (W1.c - pos.c) * e }; }
    out.push({ id, side, i, a: pos.a, c: pos.c, pose, u, fdir: offense ? dir : -dir, num: [3, 7, 11, 23, 33][i] + side });
  }
  const find = id => out.find(P => P.id === id);
  if (W1.shot) {   // the jump shot, the ball up to the rim; in, or off the rim to a defender
    const S0 = find(p0); if (S0) { S0.pose = 'jumpshot'; S0.u = f; }
    if (f < 0.45) { holder = p0; ball = { a: S0.a, c: S0.c, h: 0 }; }
    else { const v = Math.min(1, (f - 0.45) / 0.4); ball = { a: S0.a + (hoop.a - S0.a) * v, c: S0.c + (hoop.c - S0.c) * v, h: 34 + (58 - 34) * v + Math.sin(v * Math.PI) * 40 };
      if (f > 0.85) { const w = (f - 0.85) / 0.15; ball = W1.made ? { a: hoop.a, c: 0, h: 58 - w * 30 } : { a: hoop.a - dir * 0.18 * w, c: W1.reb * w, h: 58 - w * 40 + Math.sin(w * Math.PI) * 10 }; } }
  } else if (W0.shot) {   // after the shot: the ball comes out to the other team's guard
    const g = find(p1), v = Math.min(1, f / 0.45); ball = { a: W0.a + (g.a - W0.a) * v, c: W0.c + (g.c - W0.c) * v, h: 14 + Math.sin(v * Math.PI) * 12 }; if (v >= 1) holder = p1;
  } else if (p0 === p1) holder = p1;
  else { const P0 = find(p0) || { a: W0.a, c: W0.c }, P1 = find(p1), v = Math.min(1, f / 0.35); if (v < 1) ball = { a: P0.a + (P1.a - P0.a) * v, c: P0.c + (P1.c - P0.c) * v, h: 18 + Math.sin(v * Math.PI) * 6 }; else holder = p1; }
  if (holder != null) { const H = find(holder); if (H && H.pose !== 'jumpshot') H.pose = 'dribble'; ball = null; }
  out.push({ id: 90, side: 2, i: 0, a: clamp(hoop.a * 0.5, -0.8, 0.8), c: -1.08, role: 'ref', num: null }, { id: 91, side: 2, i: 1, a: clamp(-hoop.a * 0.2, -0.8, 0.8), c: 1.08, role: 'ref', num: null });
  return { players: out, ball, holder, hype: W1.shot ? { side: K.side, v: f, goal: W1.made && f > 0.85 } : null };
}
// ---------- football: a play every 12 seconds (huddle, line up, snap, a pass or a run, the tackle, back to the huddle) ----------
const FB_O = [[-0.02, 0], [-0.02, -0.11], [-0.02, 0.11], [-0.025, -0.22], [-0.025, 0.22], [-0.09, 0], [-0.19, 0.05], [-0.03, 0.33], [-0.03, -0.82], [-0.03, 0.82], [-0.06, -0.56]];
const FB_D = [[0.035, -0.06], [0.035, 0.06], [0.035, -0.26], [0.035, 0.26], [0.15, -0.3], [0.16, 0.02], [0.15, 0.32], [0.08, -0.82], [0.08, 0.82], [0.38, -0.32], [0.38, 0.32]];
function fbPlay(n, seed) {
  const h = k => lgRand(n, seed + 5, k), drive = Math.floor(n / 4), off = (drive + seed) & 1, dir = off ? -1 : 1, down = ((n % 4) + 4) % 4;
  return { off, dir, los: dir * (-0.55 + down * 0.17 + (h(1) - 0.5) * 0.06), pass: h(2) < 0.65, tgt: 8 + Math.floor(h(3) * 3), caught: h(4) < 0.7, cut: h(5) < 0.5 ? -1 : 1 };
}
function fbHuddle(P, side, i) { const offense = side === P.off, an = i / 11 * Math.PI * 2; return offense ? { a: P.los - P.dir * 0.2 + Math.cos(an) * 0.035, c: Math.sin(an) * 0.08 } : { a: P.los + P.dir * 0.2 + Math.cos(an) * 0.035, c: Math.sin(an) * 0.08 }; }
function fbLine(P, side, i) { const L = side === P.off ? FB_O[i] : FB_D[i]; return { a: P.los + P.dir * L[0], c: L[1] }; }
function simFootball(A, t, seed) {
  const Pd = 12, n = Math.floor(t / Pd), f = t - n * Pd, P = fbPlay(n, seed), Nx = fbPlay(n + 1, seed), dir = P.dir, out = [];
  const s = f - 3.6;   // seconds since the snap
  const qb = { a: P.los - dir * (P.pass ? 0.09 + 0.08 * arE(s / 1.2) : 0.09), c: 0 };
  const T0 = fbLine(P, P.off, P.tgt), route = s2 => { const dn = Math.min(1, s2 / 2.2), cut = clamp((s2 - 2.2) / 0.8, 0, 1); return { a: T0.a + dir * (0.36 * arE(dn) + 0.06 * cut), c: T0.c + P.cut * 0.22 * arE(cut) * (T0.c > 0 ? -1 : 1) }; };
  const catchPt = route(3.0), after = s2 => ({ a: catchPt.a + dir * 0.17 * arE((s2 - 3.1) / 1.3), c: catchPt.c * (1 - 0.3 * arE((s2 - 3.1) / 1.3)) });
  const rb0 = fbLine(P, P.off, 6), rbPath = s2 => { const v = clamp(s2 / 2.2, 0, 1); return { a: rb0.a + dir * 0.32 * arE(v), c: rb0.c + (P.cut * 0.13) * arE(Math.min(1, v * 1.6)) }; };
  const endT = P.pass ? (P.caught ? 4.4 : 3.4) : 2.4;
  let carrier = null, ball = null;
  for (let side = 0; side < 2; side++) for (let i = 0; i < 11; i++) {
    const id = side * 30 + i, offense = side === P.off, ln = fbLine(P, side, i), hd = fbHuddle(P, side, i);
    let pos, pose = null, u = 0;
    if (f < 2.6) { const e = arE(f / 2.6); pos = { a: hd.a + (ln.a - hd.a) * e, c: hd.c + (ln.c - hd.c) * e }; }
    else if (s < 0) { pos = { ...ln }; pose = i < 5 && offense || i < 4 && !offense ? 'stance3' : 'ready'; }
    else {
      const sp2 = Math.min(s, endT);
      pos = { ...ln };
      if (offense && i < 5) { pos.a = P.los - dir * 0.028; pose = s < endT + 0.3 ? 'block' : null; }
      else if (!offense && i < 4) { pos.a = P.los + dir * 0.028; pose = s < endT + 0.3 ? 'block' : null; }
      else if (offense && i === 5) { pos = { ...qb }; if (P.pass) { if (s > 1.4 && s < 2.6) { pose = 'throw'; u = (s - 1.4) / 1.2; } } }
      else if (offense && i === 6) { if (!P.pass) pos = rbPath(sp2); else pos = { a: qb.a + dir * 0.02, c: 0.12 }; }
      else if (offense && P.pass && i === P.tgt) { pos = sp2 < 3.1 ? route(sp2) : P.caught ? after(sp2) : route(3.1); if (s > 2.7 && s < 3.15) { pose = 'catch'; } }
      else if (offense && i >= 7) { const dn = Math.min(1, sp2 / 2.4); pos = { a: ln.a + dir * 0.3 * arE(dn), c: ln.c * (1 - 0.25 * arE(dn)) }; }
      else {   // the defence: the corners and safeties stay with the receivers, the linebackers go for the ball
        const tgtPos = P.pass ? (sp2 < 3.1 ? route(sp2) : P.caught ? after(sp2) : route(3.1)) : rbPath(sp2);
        if (i >= 7) { const mark = i === 7 ? 8 : i === 8 ? 9 : null, mp = mark != null && mark === P.tgt && P.pass ? tgtPos : mark != null ? (() => { const L2 = fbLine(P, P.off, mark), dn = Math.min(1, sp2 / 2.4); return { a: L2.a + dir * 0.3 * arE(dn), c: L2.c * (1 - 0.25 * arE(dn)) }; })() : tgtPos;
          const lag = mark === P.tgt ? Math.max(0.03, 0.08 - sp2 * 0.012) : 0.06; pos = { a: mp.a + dir * lag, c: mp.c + (i >= 9 ? (i === 9 ? -0.05 : 0.05) : 0) }; if (i >= 9) pos.a = Math.max(Math.min(pos.a, ln.a + 0.2), ln.a - 0.2) * 1; }
        else { const v = clamp(sp2 / (P.pass ? endT : 2.4), 0, 1); pos = { a: ln.a + (tgtPos.a + dir * 0.03 - ln.a) * arE(v), c: ln.c + (tgtPos.c - ln.c) * arE(v) }; }
      }
    }
    // after the play: stand a moment, then jog to the next huddle
    if (f >= 3.6 + endT + 1.2) { const nh = fbHuddle(Nx, side, i), v = arE((f - 3.6 - endT - 1.2) / (Pd - 3.6 - endT - 1.2)); pos = { a: pos.a + (nh.a - pos.a) * v, c: pos.c + (nh.c - pos.c) * v }; pose = null; }
    else if (s > endT + 0.3) pose = null;
    out.push({ id, side, i, a: pos.a, c: pos.c, pose, u, fdir: offense ? (pose === 'catch' ? -dir : dir) : -dir, num: offense ? [55, 66, 62, 71, 77, 12, 28, 88, 81, 13, 19][i] : [92, 95, 99, 91, 52, 54, 50, 24, 21, 31, 33][i] });
  }
  const find = id => out.find(Q => Q.id === id), O = P.off * 30;
  // the ball: on the ground at the line, snapped to the quarterback, thrown (a spiral, up and down), caught and carried
  if (s < 0.25) { const v = Math.max(0, s / 0.25); ball = { a: P.los + (qb.a - P.los) * v, c: 0, h: s < 0 ? 1 : 6 + v * 8 }; }
  else if (P.pass) {
    const rel = 2.06, arr = 3.0;
    if (s < rel) carrier = O + 5;
    else if (s < arr) { const v = (s - rel) / (arr - rel), Q = find(O + 5); ball = { a: Q.a + (catchPt.a - Q.a) * v, c: Q.c + (catchPt.c - Q.c) * v, h: 26 + Math.sin(v * Math.PI) * 46, spin: true }; }
    else if (P.caught) carrier = O + P.tgt;
    else { const v = Math.min(1, (s - arr) / 0.35), e2 = { a: catchPt.a + dir * 0.06, c: catchPt.c }; ball = { a: catchPt.a + (e2.a - catchPt.a) * v, c: catchPt.c, h: 22 * (1 - v) + 1 }; }
  } else carrier = s < 0.6 ? O + 5 : O + 6;
  if (s > endT + 1.2 && !ball) { carrier = null; const C2 = find(O + (P.pass ? (P.caught ? P.tgt : 5) : 6)); const v = arE((f - 3.6 - endT - 1.2) / 4); ball = { a: C2.a + (Nx.los - C2.a) * Math.min(1, v), c: C2.c * (1 - Math.min(1, v)), h: 1 }; }
  if (carrier != null) { const C = find(carrier); if (C && s >= 0 && s <= endT) { if (C.i === 5) { if (P.pass && s > 1.4) { C.pose = 'throw'; C.gear = 'football'; } else C.hold = true; } else if (C.pose !== 'catch') C.pose = 'carry'; else C.has = true; } else if (C) C.hold = true; }
  // the referees: one behind the play, one on the sideline
  out.push({ id: 90, side: 2, i: 0, a: P.los - dir * 0.32, c: 0.12, role: 'ref', num: null }, { id: 91, side: 2, i: 1, a: P.los + dir * 0.05, c: 1.08, role: 'ref', num: null });
  const hype = s > 1.8 && s < endT ? { side: P.off, v: P.pass ? clamp((s - 1.8) / 1.2, 0, 1) : 0.6 } : null;
  return { players: out, ball, carrier, hype };
}
function fbCelebrate(S2, A) {   // a real score: the scorers jump about in the end zone; the referee's arms go up
  if (!A.last) return S2;
  const ago = now() - A.last.at, e = Math.min(1, ago / 3000, (40e3 - ago) / 3000);
  if (e <= 0) return S2;
  const side = A.last.side, dir = side ? -1 : 1;
  S2.players.forEach((P, k) => {
    if (P.side === side) { const an = k * 2.1, a = dir * 0.9 + Math.cos(an) * 0.05, c = Math.sin(an) * 0.3; P.a += (a - P.a) * e; P.c += (c - P.c) * e; if (e > 0.6) { P.pose = 'cheer'; P.jump = true; } }
    else if (P.side < 2) { const a = dir * 0.55 + Math.cos(k) * 0.04, c = ((k % 11) / 10 - 0.5) * 1.2; P.a += (a - P.a) * e; P.c += (c - P.c) * e; if (e > 0.6) P.pose = null; }
    else if (P.i === 0) { P.a += (dir * 0.86 - P.a) * e; P.c += (0 - P.c) * e; if (e > 0.6 && A.last.pts >= 6) P.pose = 'cheer'; }
  });
  S2.ball = { a: dir * 0.92, c: 0, h: 1 }; S2.carrier = null; S2.hype = { side, v: 1, goal: true };
  return S2;
}
// ---------- baseball: a pitch every 6 seconds; sometimes a hit (the fielder runs it down and throws to first) ----------
const BB_POS = [[0.47, 0.47], [-0.15, -0.15], [1.04, 0.14], [1.24, 0.6], [0.6, 1.24], [0.14, 1.04], [0.72, 1.82], [1.42, 1.42], [1.82, 0.72]];   // P C 1B 2B SS 3B LF CF RF
function simBaseball(A, t, seed, F, big) {
  const C = 6, k = Math.floor(t / C), u = t / C - k, h = (kk, m) => lgRand(kk, seed + 11, m), top = arTop(A), fieldSide = top ? 0 : 1, batSide = 1 - fieldSide;
  const hit = h(k, 1) < 0.34, prevHit = h(k - 1, 1) < 0.34, swing = hit || h(k, 2) < 0.45, sR = Math.min(1, (F.R - 0.3) / 1.95);
  const ang = 0.12 + h(k, 3) * 1.33, dist = (0.9 + h(k, 4) * 1.15) * sR, fly = h(k, 5) < 0.6, LD = [Math.cos(ang) * dist, Math.sin(ang) * dist];
  const pos = BB_POS.map((p, i) => (i >= 6 ? [p[0] * sR, p[1] * sR] : p));
  let near = 3, nd = 9; pos.forEach((p, i) => { if (i < 3) return; const dd = Math.hypot(p[0] - LD[0], p[1] - LD[1]); if (dd < nd) { nd = dd; near = i; } });
  const out = [], put = (id, side, i, a, c, pose, o = {}) => out.push({ id, side, i, a, c, pose, face: o.face, u: o.u || 0, swing: o.swing, role: o.role || '', gear: o.gear, has: o.has, num: o.num != null ? o.num : [41, 8, 25, 4, 2, 10, 7, 17, 33][i] });
  // the fielders
  pos.forEach((p, i) => {
    const id = fieldSide * 30 + i;
    if (i === 0) return put(id, fieldSide, i, p[0], p[1], u < 0.36 ? 'pitch' : !hit && u > 0.58 && u < 0.66 ? 'catch' : 'ready', { face: 1, u: clamp(u / 0.34, 0, 1), gear: 'glove' });
    if (i === 1) { if (!hit && u > 0.42 && u < 0.6) return put(id, fieldSide, i, p[0], p[1], 'throw', { face: -1, u: (u - 0.42) / 0.18, gear: 'glove', role: 'c' }); return put(id, fieldSide, i, p[0], p[1], 'catcher', { face: -1, u: clamp((u - 0.27) / 0.06, 0, 1) * (u < 0.42 ? 1 : 0), role: 'c' }); }
    if (hit && i === near) {
      const v = clamp((u - 0.34) / 0.26, 0, 1), e = arE(v), q = [p[0] + (LD[0] - p[0]) * e, p[1] + (LD[1] - p[1]) * e];
      if (u > 0.6 && u < 0.66) return put(id, fieldSide, i, q[0], q[1], 'catch', { face: 1, gear: 'glove', has: u > 0.63 });
      if (u >= 0.66 && u < 0.76) return put(id, fieldSide, i, q[0], q[1], 'throw', { face: LD[0] + LD[1] > 1.1 ? 1 : -1, u: (u - 0.66) / 0.1, gear: 'glove' });
      if (u >= 0.76) { const b = arE((u - 0.76) / 0.24); return put(id, fieldSide, i, q[0] + (p[0] - q[0]) * b, q[1] + (p[1] - q[1]) * b, null, {}); }
      return put(id, fieldSide, i, q[0], q[1], v > 0 ? null : 'ready', { gear: 'glove' });
    }
    if (hit && i === 2 && u > 0.4) { const b = u < 0.9 ? arE((u - 0.4) / 0.15) : 1 - arE((u - 0.9) / 0.1), q = [p[0] + (1.0 - p[0]) * b, p[1] + (0.03 - p[1]) * b]; return put(id, fieldSide, i, q[0], q[1], u > 0.76 && u < 0.86 ? 'catch' : u < 0.55 ? null : 'ready', { face: 1, gear: 'glove', has: u > 0.8 }); }
    put(id, fieldSide, i, p[0], p[1], 'ready', { face: 1, gear: 'glove' });
  });
  // the batter: waits, swings; after a hit he drops the bat and runs to first
  const bNum = 1 + Math.floor(h(Math.floor(k / 3), 7) * 60), batId = batSide * 30 + 20;
  if (hit && u > 0.36) { const v = arE(clamp((u - 0.36) / 0.26, 0, 1)), a = -0.08 + 1.08 * v, c = 0.08 - 0.08 * v; put(batId, batSide, 20, a, c, null, { role: 'bat', num: bNum }); }
  else put(batId, batSide, 20, -0.07, 0.09, 'bat', { face: -1, u, swing, role: 'bat', num: bNum });
  // a runner on first (when the last pitch was a hit): leads off, then runs for second on a hit
  if (prevHit) { const v = hit ? arE(clamp((u - 0.36) / 0.3, 0, 1)) : 0, a = 1.06 + (0.98 - 1.06) * v, c = -0.06 + (1.0 + 0.06) * v; put(batSide * 30 + 21, batSide, 21, u < 0.3 && !hit ? 1.12 : a, u < 0.3 && !hit ? -0.04 : c, v > 0 && v < 1 ? null : 'ready', { face: -1, role: 'bat', num: 1 + Math.floor(h(Math.floor((k - 1) / 3), 7) * 60) }); }
  // the umpire behind the catcher
  put(90, 2, 0, -0.27, -0.27, 'ready', { face: -1, role: 'ref', num: null });
  // the bullpen behind the fence: a reliever for each team throwing to a catcher
  if (big) [0, 1].forEach(sd => { const c = 0.05 + sd * 0.46, uu = ((t + sd * 1.7) % 4) / 4; put(60 + sd, sd, 30, 3.3, c, 'pitch', { face: 1, u: clamp(uu / 0.6, 0, 1), gear: 'glove', num: 50 + sd * 7 }); put(62 + sd, sd, 31, 2.55, c, 'catcher', { face: -1, u: uu > 0.5 && uu < 0.7 ? 1 : 0, role: 'c', num: 9 }); });
  // the ball: pitched, then hit out (a fly ball up high, a grounder bouncing) and thrown to first; or back to the pitcher
  let ball = null;
  const P0 = pos[0], HP = [0, 0];
  if (u > 0.255 && u < 0.335) { const v = (u - 0.255) / 0.08; ball = { a: P0[0] * (1 - v), c: P0[1] * (1 - v), h: 26 - 12 * v }; }
  else if (hit && u >= 0.335 && u < 0.62) { const v = (u - 0.335) / 0.285; ball = { a: HP[0] + LD[0] * v, c: HP[1] + LD[1] * v, h: fly ? 14 + Math.sin(v * Math.PI) * (60 + dist * 40) : 3 + Math.abs(Math.sin(v * Math.PI * 3)) * 10 * (1 - v) }; }
  else if (hit && u >= 0.71 && u < 0.8) { const v = (u - 0.71) / 0.09; ball = { a: LD[0] + (1.0 - LD[0]) * v, c: LD[1] + (0.03 - LD[1]) * v, h: 20 + Math.sin(v * Math.PI) * 18 }; }
  else if (!hit && u >= 0.51 && u < 0.62) { const v = (u - 0.51) / 0.11; ball = { a: -0.15 + (P0[0] + 0.15) * v, c: -0.15 + (P0[1] + 0.15) * v, h: 18 + Math.sin(v * Math.PI) * 10 }; }
  if (big) { [0, 1].forEach(sd => { const uv = (((t + sd * 1.7) % 4) / 4 - 0.45) / 0.12; if (uv > 0 && uv < 1) out.push({ ball2: true, a: 3.3 - 0.75 * uv, c: 0.05 + sd * 0.46, h: 24 - 10 * uv }); }); }
  return { players: out, ball, hype: hit && u > 0.34 && u < 0.7 ? { side: batSide, v: fly ? 1 : 0.6 } : null };
}
// all of a game's play at time t (cached per frame); and where it's moving (for which way each player faces)
let AR_SIM = { key: '' };
function arSim(A, t, F, big) {
  const key = `${A.sp}|${A.s}|${A.r}|${A.g}|${t}|${big ? 1 : 0}`;
  if (AR_SIM.key === key) return AR_SIM.v;
  const seed = A.r * 7 + A.g + A.s * 3, run = tt => {
    if (A.sp === 'soccer' || A.sp === 'hockey') return arCelebrate(simFlow(A.sp, A, tt, seed), A, A.sp);
    if (A.sp === 'basketball') return simBasket(A, tt, seed);
    if (A.sp === 'football') return fbCelebrate(simFootball(A, tt, seed), A);
    return simBaseball(A, tt, seed, F, big);
  };
  const S2 = run(t), prev = run(t - 0.12), pm = {};
  prev.players.forEach(P => { pm[P.id] = P; });
  S2.players.forEach(P => {
    const Q = pm[P.id], w = F.at(P.a, P.c);
    P.w = w;
    if (Q) { const w0 = F.at(Q.a, Q.c); P.vx = (w[0] - w0[0]) / 0.12; P.vy = (w[1] - w0[1]) / 0.12; } else { P.vx = 0; P.vy = 0; }
  });
  // push apart anyone standing too close (two passes)
  const ps = S2.players.filter(P => !P.ball2), MIN2 = big ? 0.42 : 0.3;
  for (let it = 0; it < 2; it++) for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const P = ps[i], Q = ps[j], dx = Q.w[0] - P.w[0], dy = Q.w[1] - P.w[1], dd = Math.hypot(dx, dy);
    if (dd >= MIN2) continue;
    const nx = dd > 1e-4 ? dx / dd : 1, ny = dd > 1e-4 ? dy / dd : 0, push = (MIN2 - dd) / 2, hp = P.pose === 'bat' || P.pose === 'pitch' || P.pose === 'catcher' ? 0 : 1, hq = Q.pose === 'bat' || Q.pose === 'pitch' || Q.pose === 'catcher' ? 0 : 1, sum = hp + hq || 1;
    P.w = [P.w[0] - nx * push * 2 * hp / sum, P.w[1] - ny * push * 2 * hp / sum]; Q.w = [Q.w[0] + nx * push * 2 * hq / sum, Q.w[1] + ny * push * 2 * hq / sum];
  }
  AR_SIM = { key, v: S2 };
  return S2;
}

// ---------- drawing a game ----------
// The field (world tiles x, y, w, d) with today's game on it (A: arenaNow()). big: real people (inside the stadium);
// otherwise little figures (the stadium seen from the town).
function drawPitch(x, y, w, d, ts, A, big) {
  const z = cam.z, sp = A && !A.off ? A.sp : 'soccer', F = fieldMap(sp, x, y, w, d), live = A && !A.off && A.state === 'live', lit = NIGHT > 0.3 && live;
  const U = big ? AR_SC * z : 0.16 * z;
  arField(F, A, big, lit, z);
  const items = arStructures(F, A, big, z, U);
  if (big && typeof Sound !== 'undefined') Sound.crowd(live ? 0.25 : A && !A.off && A.state === 'soon' ? 0.1 : 0.04);
  if (live) {
    const S2 = arSim(A, ts / 1000, F, big), now2 = ts;
    if (big) arSounds(A, S2, ts / 1000);
    S2.players.forEach(P => {
      if (P.ball2) { const w2 = F.at(P.a, P.c); items.push({ k: w2[0] + w2[1], draw: () => { const p = iso(w2[0], w2[1]); ellipse(p.x, p.y, 1.2 * z, 0.5 * z, 'rgba(0,0,0,.25)'); circle(p.x, p.y - P.h * U, Math.max(0.8, 1.6 * U), '#ffffff'); } }); return; }
      items.push({ k: P.w[0] + P.w[1], draw: () => arDrawPlayer(P, A, F, z, U, now2, big) });
    });
    const B = S2.ball;
    if (B) { const w2 = F.at(B.a, B.c); items.push({ k: w2[0] + w2[1] + 0.01, draw: () => arDrawBall(sp, iso(w2[0], w2[1]), B.h || 0, U, z, B) }); }
  }
  items.sort((a, b) => a.k - b.k).forEach(it => it.draw());
}
// v0.56: the stadium's sounds while you watch: the crowd follows the game (louder at a chance, a roar at a score),
// and the game itself: the bat, the glove, a kick, the puck, the dribble, the net or the rim, the whistle, the horn
let AR_SND = { key: '' };
function arSounds(A, S2, t) {
  if (typeof Sound === 'undefined') return;
  Sound.crowd(Math.max(0.25, S2.hype ? S2.hype.v * 0.85 : 0, A.last ? 1 : 0));
  const key = `${A.sp}|${A.s}|${A.r}|${A.g}`, P = AR_SND;
  if (P.key !== key) { AR_SND = { key, t, last: A.last ? A.last.at : 0 }; return; }
  const t0 = P.t; P.t = t;
  if (t - t0 > 1 || t <= t0) return;   // (a jump in time: nothing)
  const cross = (period, at) => { const a = ((t0 % period) + period) % period, b = ((t % period) + period) % period; return b < a ? at > a || at <= b : at > a && at <= b; };
  const seed = A.r * 7 + A.g + A.s * 3, play = n => Sound.play(n);
  if (A.last && A.last.at !== P.last) { P.last = A.last.at; play('roar'); setTimeout(() => play({ hockey: 'horn', football: 'horn', baseball: 'charge', soccer: 'whistle', basketball: 'squeak' }[A.sp]), 300); }
  if (A.sp === 'baseball') {
    const k = Math.floor(t / 6), hit = lgRand(k, seed + 11, 1) < 0.34, swing = hit || lgRand(k, seed + 11, 2) < 0.45;
    if (cross(6, 0.335 * 6)) { if (hit) play('batcrack'); else { if (swing) play('swish'); play('glove'); } }
    if (!hit && cross(6, 0.62 * 6)) play('glove');
    if (hit && (cross(6, 0.6 * 6) || cross(6, 0.8 * 6))) play('glove');
  } else if (A.sp === 'soccer' || A.sp === 'hockey') {
    const D = FLOW[A.sp].D;
    if (cross(D, 0)) play(A.sp === 'hockey' ? 'puck' : 'kick');
    if (A.sp === 'hockey' && Math.random() < 0.01) play('squeak');
  } else if (A.sp === 'basketball') {
    const n = Math.floor(t / BK.D), W1 = bkTouch(n + 1, seed);
    if (S2.holder != null && cross(Math.PI * 0.17, 0)) play('bounce');
    if (W1.shot && cross(BK.D, 0.85 * BK.D)) play(W1.made ? 'swish' : 'clang');
    if (Math.random() < 0.012) play('squeak');
  } else if (A.sp === 'football') {
    const n = Math.floor(t / 12), FP = fbPlay(n, seed), endT = FP.pass ? (FP.caught ? 4.4 : 3.4) : 2.4;
    if (cross(12, 3.6)) play('glove');
    if (FP.pass && cross(12, 3.6 + 3.0)) play(FP.caught ? 'glove' : 'bounce');
    if (cross(12, 3.6 + endT + 0.3)) play('whistle');
  }
}
function arDrawBall(sp, p, h, U, z, B) {
  ellipse(p.x, p.y, Math.max(1, 2.6 * U), Math.max(0.5, 1.1 * U), 'rgba(0,0,0,.25)');
  const q = { x: p.x, y: p.y - h * U };
  if (sp === 'hockey') return ellipse(q.x, q.y - 0.6 * U, Math.max(1, 2.2 * U), Math.max(0.6, 1 * U), '#1d1d22');
  if (sp === 'basketball') return arBallScreen(q.x, q.y - 2.4 * U, Math.max(1.2, 2.8 * U));
  if (sp === 'football') { ctx.save(); ctx.translate(q.x, q.y - 1.5 * U); ctx.rotate(B.spin ? -0.5 + Math.sin(performance.now() / 60) * 0.1 : 0); ellipse(0, 0, Math.max(1.4, 3 * U), Math.max(0.9, 1.8 * U), '#8a4a26', INK_COL, 0.5 * U); line(-1.2 * U, -0.4 * U, 1.2 * U, -0.4 * U, '#ffffff', 0.5 * U); ctx.restore(); return; }
  circle(q.x, q.y - 2 * U, Math.max(1, (sp === 'baseball' ? 1.8 : 2.8) * U), '#ffffff', sp === 'soccer' ? '#2d2d34' : '#c9cfd6', 0.5 * U);
  if (sp === 'soccer' && U > 0.3) circle(q.x, q.y - 2 * U, 1 * U, '#2d2d34');
}
function arBallScreen(x, y, r) { circle(x, y, r, '#e8742c', '#5a2a10', Math.max(0.4, r * 0.15)); line(x - r, y, x + r, y, '#5a2a10', Math.max(0.3, r * 0.12)); line(x, y - r, x, y + r, '#5a2a10', Math.max(0.3, r * 0.12)); }
function arDrawPlayer(P, A, F, z, U, ts, big) {
  const sp = A.sp, p = iso(P.w[0], P.w[1]), look = P.role === 'ref' ? kitLook(sp, A, 0, 0, 'ref') : kitLook(sp, A, P.side, P.num, P.role);
  const sv = (P.vx || 0) - (P.vy || 0), speed = Math.hypot(P.vx || 0, P.vy || 0), flip = F.long === false ? -1 : 1, act = P.pose && P.pose !== 'carry' && P.pose !== 'dribble';
  let face = P.face || (act && P.fdir ? P.fdir * flip : 0) || (Math.abs(sv) > 0.25 ? Math.sign(sv) : 0) || (P.fdir ? P.fdir * flip : 0);
  if (!face) face = P.side > 1 ? (P.id % 2 ? 1 : -1) : (P.side ? -1 : 1) * flip;
  if (!big) {   // a little figure
    const col = look.shirt;
    ellipse(p.x, p.y, 2.2 * z, 1 * z, 'rgba(0,0,0,.2)'); line(p.x, p.y - 1 * z, p.x, p.y - 4.6 * z, col, 2.4 * z); circle(p.x, p.y - 6 * z, 1.4 * z, look.hat === 'helmet' ? look.hatCol : look.skin);
    return;
  }
  let pose = P.pose;
  if (!pose) pose = sp === 'hockey' && P.role !== 'ref' ? 'skate' : speed > 1.4 ? 'run' : speed > 0.3 ? 'walk' : 'stand';
  if (pose === 'dribble' && speed > 0.6) P.moving = true;
  if (P.hold && pose !== 'throw') { pose = speed > 1 ? 'carry' : pose; }
  drawPerson(p.x, p.y, z * AR_SC, { look, face, pose, u: P.u, swing: P.swing, ph: ts / 1000 * 12 + P.id, phase: ts / 1000 * (pose === 'walk' ? 7 : 12) + P.id, g: Math.min(1, speed / 2), moving: P.moving, jump: P.jump, gear: P.gear || (P.hold && sp === 'football' ? 'football' : null), has: P.has, drop: P.drop, ts, seed: P.id, energy: 'good' });
  if (P.hold && sp === 'football' && pose !== 'carry' && pose !== 'throw') { const q = up(p, 15 * U); ellipse(q.x + face * 4 * U, q.y, 2.7 * U, 1.7 * U, '#8a4a26', INK_COL, 0.4 * U); }
}

// ---------- the crowd ----------
// A stand of seats rising away from the field (back: along the far side; otherwise down the left side), full of fans
// in their team's shirts: the home end in the home colours, a block of away fans in theirs (half and half when the
// stadium's hosting other towns' teams). They clap, do the wave, stand up when there's a chance, and jump about
// waving flags and scarves when their team scores. meRow: where you're sitting (or -1).
function drawArenaStand(x, y, W, D, back, ts, A, meRow, meLook) {
  const z = cam.z, t = ts / 1000, rows = 6, on = A && !A.off && (A.state === 'live' || A.state === 'done' && now() - A.end < 0.5 * HOUR || A.state === 'soon' && A.start - now() < HOUR);
  const fill = !on ? 0.06 : A.state === 'live' ? 0.95 : A.state === 'soon' ? 0.3 + 0.6 * (1 - (A.start - now()) / HOUR) : 0.35;
  const sp = A && !A.off ? A.sp : null, H = sp ? lgTeam(sp, A.h) : null, Aw = sp ? lgTeam(sp, A.a) : null;
  const S2 = A && A.state === 'live' && AR_SIM.v && AR_SIM.key.startsWith(`${A.sp}|${A.s}|${A.r}|${A.g}|`) ? AR_SIM.v : null;
  const hype = S2 && S2.hype, cele = A && A.last ? { side: A.last.side, e: Math.min(1, (40e3 - (now() - A.last.at)) / 3000) } : null;
  const wv = ((t % 26) / 26) * 1.8 - 0.4;
  const sideOf = u => (!sp ? 0 : A.kind === 'home' ? (back && u > 0.72 ? 1 : 0) : back ? (u < 0.5 ? 0 : 1) : (u < 0.5 ? 1 : 0));
  for (let r = rows - 1; r >= 0; r--) {
    const h = 6 + r * 8, bx = back ? x : x + (rows - 1 - r) * W / rows, by = back ? y + (rows - 1 - r) * D / rows : y, bw = back ? W : W / rows, bd = back ? D / rows : D;
    box(bx, by, bw, bd, h, '#aab2bb', 0, { top: '#cdd3d9', shadow: false });
    const n = Math.round((back ? bw : bd) / 0.36);
    for (let k2 = 0; k2 < n; k2++) {
      const u = (k2 + 0.5) / n, sx = back ? bx + u * bw : bx + bw * 0.5, sy = back ? by + bd * 0.5 : by + u * bd, p = up(iso(sx, sy), h * z), side = sideOf(u), T = side ? Aw : H;
      rrect(p.x - 2.5 * z, p.y - 3.5 * z, 5 * z, 3.5 * z, 1 * z, T ? (Math.floor(u * 8) % 2 ? T.c[0] : shade(T.c[0], -0.2)) : (Math.floor(u * 6) % 2 ? '#2f5fa8' : '#8e99a6'));
      if (r === meRow && k2 === Math.floor(n * 0.62)) { drawPerson(p.x, p.y, z, { look: meLook, face: 1, view: 'front', energy: 'great', ts, seed: 3, pose: 'sit', seatH: 0, wave: !!(hype || cele) || Math.floor(t * 1.5) % 3 === 0 }); continue; }
      if (hash(k2 * 3 + (back ? 1 : 0), r + 7) > fill) continue;
      const i2 = k2 * 7 + r * 13 + (back ? 5 : 0), rnd = m => hash(i2, m);
      let lift = 0, armsUp = false, clap = false;
      const mine = cele && cele.side === side, theirs = cele && cele.side !== side;
      if (A && A.state === 'live') {
        if (mine) { lift = 3 + Math.abs(Math.sin(t * 6 + i2)) * 4 * cele.e; armsUp = true; }
        else if (hype && hype.side === side && hype.v > 0.35) { lift = 2.5 * hype.v; armsUp = hype.goal || rnd(3) < 0.5 * hype.v; }
        else if (!theirs) { lift = Math.exp(-Math.pow((u - wv) * 7, 2)) * 7; armsUp = lift > 3; clap = !armsUp && Math.sin(t * 9 + i2) > 0.2 && rnd(4) < 0.3; }
      }
      const kid = rnd(5) < 0.1, sc = kid ? 0.78 : 1, skin = SKINS[i2 % 4];
      const shirt = !T ? ['#e5484d', '#38a3e0', '#f2c230', '#7fd36a'][i2 % 4] : rnd(6) < 0.72 ? T.c[0] : rnd(6) < 0.86 ? T.c[1] : ['#ffffff', '#3d4a66', '#c9cfd6'][i2 % 3];
      const trim = T ? (shirt === T.c[0] ? T.c[1] : T.c[0]) : '#ffffff';
      const bodyTop = p.y - (9 + lift) * z * sc, hy = p.y - (11.6 + lift) * z * sc;
      if (armsUp) { const w = Math.sin(t * 8 + i2) * 0.8; line(p.x - 2.2 * z, bodyTop + 1.4 * z, p.x - (4.4 + w) * z, bodyTop - 5.5 * z, skin, 1.1 * z); line(p.x + 2.2 * z, bodyTop + 1.4 * z, p.x + (4.4 - w) * z, bodyTop - 5.5 * z, skin, 1.1 * z); }
      rrect(p.x - 2.6 * z * sc, bodyTop, 5.2 * z * sc, 6.5 * z * sc, 2 * z, shirt);
      line(p.x - 2.4 * z * sc, bodyTop + 2.4 * z * sc, p.x + 2.4 * z * sc, bodyTop + 2.4 * z * sc, trim, 0.8 * z);
      circle(p.x, hy, 2.4 * z * sc, skin);
      if (z > 0.6) { const ey = hy + 0.4 * z * sc, ec = '#2a1d18'; circle(p.x - 0.9 * z * sc, ey, 0.35 * z, ec); circle(p.x + 0.9 * z * sc, ey, 0.35 * z, ec); if (mine || hype && hype.side === side) ellipse(p.x, ey + 1.1 * z * sc, 0.7 * z, 0.5 * z, '#8a3a30'); }
      const hat = rnd(7);
      if (T && hat < 0.28) { ctx.beginPath(); ctx.arc(p.x, hy - 0.2 * z, 2.6 * z * sc, Math.PI, 0); ctx.fillStyle = T.c[0]; ctx.fill(); rrect(p.x - 0.5 * z, hy - 0.9 * z, 3.6 * z * sc, 0.9 * z, 0.4 * z, shade(T.c[0], -0.2)); }
      else { ctx.beginPath(); ctx.arc(p.x, hy - 0.5 * z, 2.5 * z * sc, Math.PI * 1.05, Math.PI * 1.95); ctx.fillStyle = HAIR_COLORS[i2 % 5]; ctx.fill(); }
      if (clap) { const c2 = Math.sin(t * 18 + i2) * 0.6; circle(p.x - (1 + c2) * z, bodyTop + 1.5 * z, 0.9 * z, skin); circle(p.x + (1 + c2) * z, bodyTop + 1.5 * z, 0.9 * z, skin); }
      if (!T || z < 0.35) continue;
      const it = rnd(8), wave = Math.sin(t * 7 + i2) * (armsUp ? 1.6 : 0.4);
      if (it < 0.07) { const hx = p.x + 4 * z, hy2 = bodyTop - (armsUp ? 5 : -1) * z; line(hx, hy2, hx, hy2 - 9 * z, '#8a6a4a', 0.6 * z); pg([[hx, hy2 - 9 * z], [hx + (6 + wave) * z, hy2 - 7.5 * z + wave * 0.5 * z], [hx, hy2 - 5.5 * z]], rnd(9) < 0.5 ? T.c[0] : T.c[1]); }
      else if (it < (sp === 'soccer' ? 0.22 : 0.1) && armsUp) { const y2 = bodyTop - 6 * z; for (let s2 = 0; s2 < 5; s2++) rrect(p.x - 5 * z + s2 * 2 * z, y2 + Math.sin(t * 6 + s2) * 0.4 * z, 2 * z, 1.8 * z, 0, s2 % 2 ? T.c[1] : T.c[0]); }
      else if (it < 0.25 && it > 0.22) { const fx = p.x + 3.6 * z, fy = bodyTop - (armsUp ? 7 : 1) * z; rrect(fx - 1.3 * z, fy - 4 * z, 2.6 * z, 5 * z, 1 * z, T.c[0]); rrect(fx - 0.5 * z, fy - 7 * z, 1.2 * z, 3.4 * z, 0.6 * z, T.c[0]); }
      else if (it > 0.97 && z > 0.5) { const sy2 = bodyTop - (armsUp ? 9 : 3) * z; rrect(p.x - 5 * z, sy2 - 4 * z, 10 * z, 6 * z, 0.8 * z, '#ffffff', T.c[0], 0.6 * z); emoji(T.e, p.x, sy2 - 1 * z, 4 * z); }
    }
  }
}
// the big screen: the sport, the clock, both teams with their logos and the score; a flash when someone scores
function drawArenaBoard(q, W2, H2, A) {
  const z = cam.z, zh = curLang() === 'zh';
  rrect(q.x - W2 / 2, q.y - H2, W2, H2, 3 * z, '#1d1d22', '#9aa3ad', 1.6 * z);
  if (z <= 0.3) return;
  const row = (s2, yy, col, size = 7, x = q.x, al = 'center') => { ctx.font = `800 ${Math.max(5, size * z)}px ${UI_FONT},${EMOJI_FONT}`; ctx.textAlign = al; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(s2, x, yy); };
  if (A && A.off && A.none) { row(zh ? '今天无赛' : 'NO GAME TODAY', q.y - H2 / 2, '#ffd36b', 7); return; }   // v0.58
  if (!A || A.off) { row(zh ? '休赛期' : 'OFF SEASON', q.y - H2 / 2 - 6 * z, '#ffd36b', 7); if (A && A.si) row(zh ? `${A.si.left} 天后开赛` : `Back in ${A.si.left} days`, q.y - H2 / 2 + 7 * z, '#ffffff', 6); return; }
  const L = LEAGUES[A.sp], flash = A.last && now() - A.last.at < 12e3 && Math.floor(now() / 400) % 2 === 0;
  if (flash) { const w = { soccer: zh ? '进球！' : 'GOAL!', hockey: zh ? '进球！' : 'GOAL!', football: A.last.pts >= 6 ? (zh ? '达阵！' : 'TOUCHDOWN!') : zh ? '射门得分！' : 'FIELD GOAL!', baseball: zh ? '得分！' : 'RUN SCORES!', basketball: '' }[A.sp]; rrect(q.x - W2 / 2 + 2 * z, q.y - H2 + 2 * z, W2 - 4 * z, H2 - 4 * z, 2 * z, lgTeam(A.sp, A.last.side ? A.a : A.h).c[0]); row(w, q.y - H2 / 2, '#ffffff', 10); return; }
  row(A.state === 'soon' ? `${L.e} ${fmtHM(A.start)}` : `${L.e} ${A.clock}`, q.y - H2 + 9 * z, '#ffd36b', 6.2);
  [[A.a, A.score[1], 22], [A.h, A.score[0], 36]].forEach(([ti, sc, dy]) => {
    const T = lgTeam(A.sp, ti); rrect(q.x - W2 / 2 + 4 * z, q.y - H2 + dy * z - 5.5 * z, 3 * z, 11 * z, 1 * z, T.c[0]);
    row(`${T.e} ${arShort(A.sp, ti)}`, q.y - H2 + dy * z, '#ffffff', 7, q.x - W2 / 2 + 9 * z, 'left');
    row(A.state === 'soon' ? '–' : String(sc), q.y - H2 + dy * z, '#ffffff', 9, q.x + W2 / 2 - 6 * z, 'right');
  });
}
const fmtHM = ms => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
