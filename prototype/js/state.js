'use strict';
// Game state and rules. No DOM code here.
// Every home (yours and your friends') has the same shape, so they draw, rank and get visited the same way.

let S = null; // the whole saved game

const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 9);
const rand = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The prototype can fast-forward time, so all game time goes through now().
function now() { return Date.now() + (S ? S.timeOffset : 0); }
function dayKey(ms) { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function freshDay() {
  return {
    date: dayKey(now()),
    // health for today (from Apple Health in the app; from the console in the prototype)
    steps: 0, pushes: 0, kcal: 0, exMin: 0, standH: 0, mindful: 0, workouts: [],
    focusMin: 0, distractMin: 0, actions: 0, steals: 0, restDay: false, liked: {},
    earned: { coins: 0, wood: 0 },
    paid: { stepBlocks: 0, goal: false, rings: {}, workouts: {}, mindful: 0, sleep: false },
  };
}

function load() {
  try { S = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { S = null; }
  if (!S || S.v !== 3) S = null;
  if (S) { migrate(); genNPCs(); [S.me, ...S.friends].forEach(h => { fixLayout(h); fitRooms(h); }); }
  return S;
}
// Saves from v0.3 get the v0.4 fields (floors, privacy, souvenirs, personal goal). Old players skip the tutorial.
function migrate() {
  if (S.tut === undefined) S.tut = -1;
  if (S.calm === undefined) S.calm = false;
  S.stats = Object.assign({ days: 1, goalDays: 0, sleepStreak: 0, ringsAll: 0, focus120: 0, mindful: 0, workouts: 0 }, S.stats || {});
  S.souv = S.souv || [];
  S.stepGoal = S.stepGoal || STEP_GOAL;
  S.hist = S.hist || [];
  [S.me, ...S.friends].forEach(h => {
    h.extra = h.extra || {}; h.ups = h.ups || [];
    if (h.shareLive === undefined) h.shareLive = !!h.shareGoal;
    if (h.shareMood === undefined) h.shareMood = h.id !== 'me' && !!h.shareGoal;
  });
  if (!S.lots) {   // v0.6: the 3 × 3 grid becomes streets of parcels; everyone keeps their home, on a street
    const ids = (S.slots || []).filter(s => s.owner).map(s => s.owner);
    S.lots = [];
    ids.forEach(id => {
      const st = START_LOTS[id];
      if (st) S.lots.push({ id, st: st[0], p: st[1], n: st[2] || CORE_PARCELS, paid: 0 });
    });
    ids.filter(id => !START_LOTS[id]).forEach(id => { const r = freeRun(); if (r) S.lots.push({ id, st: r.st, p: r.p, n: CORE_PARCELS, paid: 0 }); });
    delete S.slots;
  }
  if (S.layoutV !== 2) {   // v0.5: furniture must be reachable; re-arrange the simulated friends' rooms once
    S.friends.forEach(h => { for (let lv = 0; lv < floorsOf(h); lv++) relayoutRoom(h, lv); });
    S.layoutV = 2;
  }
}
function save() { if (S) localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }

// ---------- homes ----------
function emptyHome(id) {
  return {
    id, name: '', look: null, coins: 0, wood: 0,
    house: 0, houses: [0], wall: WALL_COLORS[0], roof: ROOF_COLORS[0],
    room: { wall: 0, floor: 0, items: [] },    // ground floor
    ups: [], extra: {},                        // upper floors; storeys built, per house index
    yard: [], store: {},                       // store: bought but not placed, keyed "room:sofa" / "yard:bench"
    fieldLv: 0, fields: [null, null, null, null],
    pastureLv: 0, animals: [],
    orchardLv: 0, trees: [null, null, null, null, null, null],
    pondLv: 0, pond: { fish: 0, at: 0 },
    cars: [], car: -1,
    seeds: {}, barn: {},
    // what friends may see: goal done, working out right now, energy face. All off by default.
    likes: 0, shareGoal: false, shareLive: false, shareMood: false, goalToday: false, energy: 75, live: null,
  };
}

function homeFromPreset(p) {
  const h = emptyHome(p.id), t = now();
  Object.assign(h, {
    name: clone(p.name), look: clone(p.look), coins: p.coins, wood: p.wood, house: p.house, houses: [p.house], wall: p.wall, roof: p.roof,
    likes: p.likes, shareGoal: p.shareGoal, shareLive: !!p.shareLive, shareMood: !!p.shareMood, earn: p.earn, simAt: t, energy: 60 + Math.round(Math.random() * 35),
  });
  h.room.wall = p.roomWall; h.room.floor = p.floor;
  h.fieldLv = p.fieldLv;
  h.fields = Array(FIELD_LEVELS[p.fieldLv]).fill(null);
  p.crops.forEach((c, i) => {
    if (!c) return;
    const age = p.ripe.includes(i) ? 1.3 : 0.1 + Math.random() * 0.8;
    h.fields[i] = { crop: c, at: t - CROPS[c].grow * MIN * age, left: CROPS[c].yield, thieves: [] };
  });
  h.pastureLv = p.pastureLv;
  p.animals.forEach(([k, st]) => h.animals.push(newAnimal(k, st)));
  h.orchardLv = p.orchardLv || 0;
  (p.trees || []).forEach(([k, st], i) => { h.trees[i] = newTree(k, st); });
  h.pondLv = p.pondLv || 0;
  h.pond = { fish: h.pondLv ? 3 : 0, at: t };
  p.cars.forEach(([k, color]) => h.cars.push({ k, color }));
  h.car = h.cars.length - 1;
  p.furn.forEach(f => { const [k, tint] = Array.isArray(f) ? f : [f]; autoPlace(h, 'room', k, tint, 0); });
  if (p.furn2 && floorsOf(h) > 1) {
    const up2 = roomAt(h, 1);
    if (p.up2) { up2.wall = p.up2[0]; up2.floor = p.up2[1]; }
    p.furn2.forEach(f => { const [k, tint] = Array.isArray(f) ? f : [f]; autoPlace(h, 'room', k, tint, 1); });
  }
  p.yard.forEach(k => autoPlace(h, 'yard', k));
  return h;
}

// The game is made before onboarding (o.preview) so the first screens can show the real town behind them.
function newGame(o) {
  S = {
    v: 3, lang: o.lang, apps: o.apps, limitMin: o.limitMin, timeOffset: 0,
    created: Date.now(), seenHint: false, welcomed: false, pending: [], feed: [],
    mail: { inbox: [], sent: [] }, sleep: null, vitals: { resp: 14.5, rhr: 61, hrv: 48 }, live: null, native: false,
    onboarding: !!o.preview, tut: 0, calm: false, souv: [], stepGoal: STEP_GOAL, hist: [], layoutV: 2,
    stats: { days: 1, goalDays: 0, sleepStreak: 0, ringsAll: 0, focus120: 0, mindful: 0, workouts: 0 },
  };
  S.today = freshDay();
  const me = emptyHome('me');
  Object.assign(me, { name: o.name, look: o.look, coins: 300, wood: 20, roof: o.look.shirt });
  me.seeds = { wheat: 4, carrot: 3, potato: 2 };
  // A head start: the wheat is ripe for the tutorial, the carrots are growing.
  me.fields[0] = { crop: 'wheat', at: now() - CROPS.wheat.grow * MIN * 1.05, left: CROPS.wheat.yield, thieves: [] };
  me.fields[1] = { crop: 'carrot', at: now() - CROPS.carrot.grow * MIN * 0.3, left: CROPS.carrot.yield, thieves: [] };
  me.pastureLv = 1;
  me.animals = [newAnimal('chicken', 2), newAnimal('chicken', 0)];
  me.animals[0].last = now() - ANIMALS.chicken.every * MIN * 0.8;
  S.me = me;
  autoPlace(me, 'room', 'sleepbag', TINTS[4]);
  autoPlace(me, 'room', 'lamp');
  autoPlace(me, 'yard', 'flowers');
  S.lots = Object.entries(START_LOTS).map(([id, [st, p, n]]) => ({ id, st, p, n: n || CORE_PARCELS, paid: 0 }));
  S.friends = FRIEND_PRESETS.map(homeFromPreset);
  genNPCs();
  simSleep(78);
  S.pending.push({ id: uid(), src: 'welcome', reward: { coins: 100, wood: 10, seeds: { tomato: 2 } }, info: {} });
  save();
}

// Returns true when the calendar day changed. Nothing is lost on a new day.
function checkDay() {
  const k = dayKey(now());
  if (S.today.date === k) return false;
  // remember yesterday: your step goal follows your own last 7 days (D28)
  const y = S.today, st = S.stats;
  S.hist = [...S.hist, y.steps + y.pushes].slice(-7);
  if (S.hist.length >= 3) {
    const avg = S.hist.reduce((a, b) => a + b, 0) / S.hist.length;
    S.stepGoal = clamp(Math.round(avg * 1.1 / 500) * 500, STEP_GOAL_RANGE[0], STEP_GOAL_RANGE[1]);
  }
  if (!y.paid.sleep) st.sleepStreak = 0;
  st.days++;
  S.today = freshDay();
  S.friends.forEach(f => { f.goalToday = false; f.energy = 55 + Math.round(Math.random() * 40); });
  if (!S.native) simSleep(rand([92, 84, 78, 70, 61]));   // the prototype invents last night's sleep
  return true;
}

const homeName = h => (h.id === 'me' ? S.me.name : nm(h.name));
function friendById(id) { return S.friends.find(f => f.id === id); }
function homeOf(id) { return id === 'me' ? S.me : friendById(id) || NPCS.find(n => n.id === id); }
const isFriend = id => !!friendById(id);
function friendIds() { return S.lots.filter(l => l.id !== 'me' && friendById(l.id)).map(l => l.id); }
// Your street community: you and your friends (ranking and the town level only count these, not strangers).
function residents() { return S.lots.map(l => homeOf(l.id)).filter(Boolean); }

// ---------- the world: streets of parcels ----------
let NPCS = [];   // other people living in town; generated on load, never saved
function lotOf(id) { return (S && S.lots || []).find(l => l.id === id) || NPC_LOTS.find(l => l.id === id); }
const slotOf = lotOf;
// Where a home's lot starts in the world (world tiles), and how wide it is (16 + bought parcels × 4).
function lotOrigin(id) { const l = lotOf(id); if (!l) return [0, 0]; const st = STREETS[l.st]; return [st.x + l.p * PARCEL, st.y]; }
function lotW(id) { const l = lotOf(id); return l ? l.n * PARCEL : LOT_W; }
const homeW = h => lotW(h.id);
function allLots() { return [...(S ? S.lots : []), ...NPC_LOTS]; }
function parcelOwner(st, p) { const l = allLots().find(x => x.st === st && p >= x.p && p < x.p + x.n); return l ? l.id : null; }
// Runs of empty parcels on every street: [{ st, p, n }]. Cached until somebody's land changes.
let RUNS = { key: '', runs: [] };
function vacantRuns() {
  const key = S.lots.map(l => l.st + l.p + ',' + l.n).join('|');
  if (RUNS.key !== key) RUNS = { key, runs: computeRuns() };
  return RUNS.runs;
}
function computeRuns() {
  const out = [];
  Object.entries(STREETS).forEach(([st, s]) => {
    let p = 0;
    while (p < s.n) {
      if (parcelOwner(st, p)) { p++; continue; }
      const p0 = p;
      while (p < s.n && !parcelOwner(st, p)) p++;
      out.push({ st, p: p0, n: p - p0 });
    }
  });
  return out;
}
// First empty spot big enough for a home, on your own street first.
// The land right next to your home stays free as long as possible, so you can keep buying it.
function freeRun() {
  const runs = vacantRuns().filter(r => r.n >= CORE_PARCELS), mine = lotOf('me');
  const nextToMe = r => !!mine && r.st === mine.st && r.p === mine.p + mine.n;
  const dist = r => Math.abs(STREETS[r.st].y - (mine ? STREETS[mine.st].y : 0));
  runs.sort((a, b) => nextToMe(a) - nextToMe(b) || (STREETS[a.st].nb !== 'maple') - (STREETS[b.st].nb !== 'maple') || dist(a) - dist(b));
  const r = runs[0];
  if (!r) return null;
  return nextToMe(r) ? { st: r.st, p: r.p + r.n - CORE_PARCELS, n: CORE_PARCELS } : r;
}
const nbOf = id => NEIGHBORHOODS[STREETS[lotOf(id).st].nb];
const round50 = v => Math.round(v / 50) * 50;
// The next parcel to the right of your home: each one costs more than the last.
function canExpand(id = 'me') { const l = lotOf(id), p = l.p + l.n; return p < STREETS[l.st].n && !parcelOwner(l.st, p); }
function parcelCost(id = 'me') { const l = lotOf(id); return { coins: round50(LAND.parcel * Math.pow(LAND.grow, l.n - CORE_PARCELS) * nbOf(id).price) }; }
function buyParcel() {
  if (!canExpand()) return 'max';
  const c = parcelCost();
  if (!canAfford(c)) return 'poor';
  pay(c);
  const l = lotOf('me');
  l.n++; l.paid = (l.paid || 0) + c.coins;
  YARD_SPOTS = {};
  return 'ok';
}
// Moving your whole home (house, farm, yard) to an empty spot on another street.
function moveCost(st) { return { coins: round50(LAND.move * CORE_PARCELS * NEIGHBORHOODS[STREETS[st].nb].price) }; }
function relocate(st, p) {
  for (let k = 0; k < CORE_PARCELS; k++) if (p + k >= STREETS[st].n || parcelOwner(st, p + k)) return { r: 'taken' };
  const c = moveCost(st);
  if (!canAfford(c)) return { r: 'poor' };
  const l = lotOf('me'), refund = Math.round((l.paid || 0) * LAND.refund);
  pay(c);
  S.me.coins += refund;
  Object.assign(l, { st, p, n: CORE_PARCELS, paid: 0 });
  fixLayout(S.me);
  return { r: 'ok', refund };
}
// A tiny seeded random generator, so strangers' homes look the same every time.
function seeded(seed) { let s = seed % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function genNPCs() {
  NPCS = NPC_LOTS.map((spec, i) => {
    const r = seeded(9001 + i * 7919), pick = a => a[Math.floor(r() * a.length)], farm = STREETS[spec.st].nb === 'farm';
    const crops = Object.keys(CROPS).filter(k => !CROPS[k].rare), fieldLv = farm ? 3 : Math.floor(r() * 3);
    const nf = FIELD_LEVELS[fieldLv], pl = farm ? 3 : r() < 0.6 ? 1 + Math.floor(r() * 2) : 0;
    const beasts = ['chicken', 'duck', 'sheep', 'goat', 'pig', 'cow', 'alpaca'];
    const p = {
      id: spec.id, name: NPC_NAMES[i % NPC_NAMES.length],
      look: { shirt: pick(COLORS), skin: pick(SKINS), hair: pick(HAIRS), hairCol: pick(HAIR_COLORS), mob: r() < 0.1 ? 'wheel' : 'walk' },
      house: spec.house, wall: pick(WALL_COLORS), roof: pick(ROOF_COLORS), floor: Math.floor(r() * FLOORS.length), roomWall: Math.floor(r() * ROOM_WALLS.length),
      fieldLv, crops: Array.from({ length: nf }, () => (r() < 0.85 ? pick(crops) : null)), ripe: Array.from({ length: nf }, (_, k) => k).filter(() => r() < 0.3),
      pastureLv: pl, animals: pl ? Array.from({ length: Math.min(PASTURE[pl].cap, 2 + Math.floor(r() * 5)) }, () => [pick(beasts), 2]) : [],
      orchardLv: r() < 0.5 || farm ? 1 + Math.floor(r() * 3) : 0, trees: [], pondLv: r() < 0.35 ? 1 : 0,
      cars: r() < 0.85 ? [[pick(Object.keys(CARS).filter(k => k !== 'tractor' || farm)), pick(CAR_COLORS)]] : [],
      furn: ['bed', 'sofa', 'table', 'chair', 'lamp', 'tv', 'fridge', 'plant'].filter(() => r() < 0.8),
      yard: ['flowers', 'tree', 'bench', 'lamp', 'hedge', 'birdbath', 'pine', 'swing'].filter(() => r() < 0.5),
      coins: 0, wood: 0, likes: Math.floor(r() * 30), shareGoal: false, earn: 0,
    };
    p.trees = Array.from({ length: p.orchardLv ? ORCHARD[p.orchardLv].slots : 0 }, () => [pick(Object.keys(TREES)), 2]);
    if (r() < 0.4) p.animals.push(['dog', 2]);
    const h = homeFromPreset(p);
    h.npc = true;
    // the extra land of a bigger lot: a garden with trees, a pool or a swing set
    for (let k = 0; k < (spec.n - CORE_PARCELS) * 3; k++) autoPlace(h, 'yard', pick(['tree', 'pine', 'flowers', 'hedge', 'fountain', 'pool', 'picnic', 'trampoline', 'windmill']));
    return h;
  });
}

// ---------- resources ----------
function canAfford(c, h = S.me) { return h.coins >= (c.coins || 0) && h.wood >= (c.wood || 0); }
function pay(c, h = S.me) { h.coins -= c.coins || 0; h.wood -= c.wood || 0; }
function addReward(r) {
  S.me.coins += r.coins || 0; S.me.wood += r.wood || 0;
  S.today.earned.coins += r.coins || 0; S.today.earned.wood += r.wood || 0;
  for (const k in r.seeds || {}) S.me.seeds[k] = (S.me.seeds[k] || 0) + r.seeds[k];
}
function sumRewards(list) {
  const out = { coins: 0, wood: 0, seeds: {} };
  list.forEach(p => {
    out.coins += p.reward.coins || 0; out.wood += p.reward.wood || 0;
    for (const k in p.reward.seeds || {}) out.seeds[k] = (out.seeds[k] || 0) + p.reward.seeds[k];
  });
  return out;
}
function useAction() { if (S.today.actions >= ACTION_CAP) return false; S.today.actions++; return true; }
function actionsLeft() { return ACTION_CAP - S.today.actions; }
function addBarn(h, k, n) { h.barn[k] = (h.barn[k] || 0) + n; }
function seedCount(h = S.me) { return Object.values(h.seeds).reduce((a, b) => a + b, 0); }

// ---------- energy: last night's sleep sets today's mood and the exercise multiplier ----------
// Our own sleep score, used when no device gives one: duration 50, deep + REM share 30, interruptions 20.
function sleepScore(s) {
  const asleep = s.asleep || (s.deep + s.rem + s.core);
  const dur = asleep > 540 ? Math.max(40, 50 - (asleep - 540) / 12) : Math.min(50, 50 * asleep / 420);
  const staged = (s.deep || 0) + (s.rem || 0);
  const q = staged > 0 ? Math.min(30, staged / Math.max(1, asleep) / 0.4 * 30) : 18;
  const intr = Math.max(0, 20 - (s.awake || 0) / 3);
  return clamp(Math.round(dur + q + intr), 0, 100);
}
function setSleep(raw) {
  const s = { asleep: raw.asleep || 0, deep: raw.deep || 0, rem: raw.rem || 0, core: raw.core || 0, awake: raw.awake || 0, source: raw.source || '' };
  if (!s.asleep) s.asleep = s.deep + s.rem + s.core;
  s.score = raw.score != null ? Math.round(raw.score) : sleepScore(s);
  S.sleep = s;
}
// Prototype only: a believable night for a given score.
function simSleep(score) {
  const t = { 92: [478, 98, 112, 268, 10], 84: [452, 82, 96, 274, 18], 78: [430, 70, 84, 276, 26], 70: [400, 58, 70, 272, 34], 61: [372, 44, 58, 270, 46], 44: [318, 28, 40, 250, 70] };
  const k = Object.keys(t).map(Number).reduce((a, b) => Math.abs(b - score) < Math.abs(a - score) ? b : a);
  const [asleep, deep, rem, core, awake] = t[k];
  setSleep({ asleep, deep, rem, core, awake, score, source: 'sim' });
  processHealth();
}
function energyScore() {
  const base = S.sleep ? S.sleep.score : 75;
  return clamp(Math.round(base + Math.min(5, S.today.mindful)), 0, 100);
}
function energyLevel(score = energyScore()) { return ENERGY_LEVELS.find(e => score >= e.min).id; }
function energyMult() {
  const m = ENERGY_LEVELS.find(e => e.id === energyLevel()).mult;
  return S.today.restDay ? Math.max(1, m) : m;   // on a rest / sick day nothing is discounted
}
// A friend's face only shows their energy if they chose to share it (and you're not in calm mode).
function friendEnergy(h) {
  if (!h.shareMood || S.calm) return 'good';
  return h.energy != null ? energyLevel(h.energy + (h.goalToday ? 8 : 0)) : 'good';
}
// What you see of friends' fitness: nothing in calm mode, otherwise only what they share.
const seesGoal = h => !S.calm && !!h.shareGoal;
const seesLive = h => !S.calm && !!h.shareLive && !!h.live;

// ---------- real-life inputs ----------
function addPending(src, reward, info) {
  if (src === 'steps') {
    const ex = S.pending.find(p => p.src === 'steps');
    if (ex) { ex.info.steps += info.steps; ex.reward.coins += reward.coins; ex.reward.wood += reward.wood; return; }
  }
  S.pending.push({ id: uid(), src, reward, info: info || {} });
}
// Turns any new progress today into rewards waiting to be collected. Safe to call any number of times.
function processHealth() {
  const d = S.today, p = d.paid, mult = energyMult();
  const scale = r => {
    const o = { coins: Math.round((r.coins || 0) * mult), wood: Math.round((r.wood || 0) * mult) };
    if (r.seeds) o.seeds = clone(r.seeds);
    return o;
  };
  // Steps pay per sixth of YOUR goal, up to 150 %: a beginner and a marathoner earn about the same for a good day.
  const steps = d.steps + d.pushes, goal = stepGoal(), blk = stepBlock();
  const blocks = Math.min(STEP_BLOCKS_MAX, Math.floor(steps / blk)) - p.stepBlocks;
  if (blocks > 0) { p.stepBlocks += blocks; addPending('steps', scale({ coins: STEP_REWARD.coins * blocks, wood: STEP_REWARD.wood * blocks }), { steps: blocks * blk, mult }); }
  if (steps >= goal && !p.goal) { p.goal = true; S.stats.goalDays++; addPending('goal', scale(GOAL_REWARD), { mult, goal }); }
  [['move', d.kcal, RINGS.move], ['exercise', d.exMin, RINGS.exercise], ['stand', d.standH, RINGS.stand]].forEach(([ring, val, goal]) => {
    if (val >= goal && !p.rings[ring]) { p.rings[ring] = true; addPending('ring', scale(RING_REWARD[ring]), { ring, mult }); }
  });
  if (p.rings.move && p.rings.exercise && p.rings.stand && !p.rings.all) { p.rings.all = true; S.stats.ringsAll++; addPending('rings', scale(RING_REWARD.all), { mult }); }
  d.workouts.forEach(w => {
    if (w.min < 10 || p.workouts[w.id] !== undefined) return;
    const paid = Object.values(p.workouts).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    const min = Math.max(0, Math.min(w.min, WORKOUT_PAY_MAX - paid));   // only the first 90 minutes a day pay
    p.workouts[w.id] = min; S.stats.workouts++;
    if (min > 0) addPending('workout', scale({ coins: Math.round(min * 1.2), wood: Math.floor(min / 10) }), { type: w.type, min: w.min, mult });
  });
  const mind = Math.min(10, Math.floor(d.mindful)) - p.mindful;
  if (mind > 0) { p.mindful += mind; S.stats.mindful += mind; addPending('mindful', { coins: mind * MINDFUL_REWARD }, { min: mind }); }
  if (S.sleep && S.sleep.score >= 80 && !p.sleep) { p.sleep = true; S.stats.sleepStreak++; addPending('sleep', clone(SLEEP_REWARD), { score: S.sleep.score }); }
}
// Your own step goal (follows your last 7 days) and how many steps one paid block is.
function stepGoal() { return (S && S.stepGoal) || STEP_GOAL; }
function stepBlock() { return Math.max(250, Math.round(stepGoal() / 6 / 50) * 50); }
function recordSteps(n) { S.today.steps += n; processHealth(); }
function recordFocus(min) {
  S.today.focusMin += min;
  if (min >= 120) S.stats.focus120++;
  addPending('focus', clone(FOCUS_REWARD[min]), { min });
}
function recordDistract(min) { S.today.distractMin += min; } // no penalty, ever
function setRestDay() {
  if (S.today.restDay) return false;
  S.today.restDay = true;
  if (!S.today.paid.goal) { S.today.paid.goal = true; addPending('rest', clone(GOAL_REWARD)); }
  return true;
}
function addWorkout(type, min) {
  const kcal = Math.round(min * WORKOUTS[type].kcal);
  const w = { id: uid(), type, min, kcal, at: now() };
  S.today.workouts.push(w);
  S.today.kcal += kcal; S.today.exMin += min;
  processHealth();
  return w;
}
// "Mini me": while the real you works out, your townie does the same thing.
function startLive(type, start, hr) { S.live = { type, start: start || now(), hr: hr || 0 }; }
function liveMin() { return S.live ? (now() - S.live.start) / MIN : 0; }
function stopLive() {
  if (!S.live) return null;
  const min = Math.max(1, Math.round(liveMin())), type = S.live.type;
  S.live = null;
  return S.native ? null : addWorkout(type, min);   // in the app the finished workout arrives from Apple Health
}
// Data from the iPhone app (Apple Health). Only ever raises today's numbers.
function applyNative(d) {
  if (!d || d.available === false) return;
  S.native = true;
  const t = S.today;
  ['steps', 'pushes', 'kcal', 'exMin', 'standH', 'mindful'].forEach(k => { if (typeof d[k] === 'number') t[k] = Math.max(t[k], Math.round(d[k] * 10) / 10); });
  (d.workouts || []).forEach(w => {
    if (!t.workouts.some(x => x.id === w.id)) t.workouts.push({ id: w.id, type: WORKOUTS[w.type] ? w.type : 'walk', min: Math.round(w.min || 0), kcal: Math.round(w.kcal || 0), at: w.start || now() });
  });
  if (d.sleep && (d.sleep.asleep > 0 || d.sleep.score != null)) setSleep(d.sleep);
  S.vitals = { resp: d.resp || S.vitals.resp, rhr: d.rhr || S.vitals.rhr, hrv: d.hrv || S.vitals.hrv };
  processHealth();
}

// ---------- crops ----------
function cropProg(f) { return f ? Math.min(1, (now() - f.at) / (CROPS[f.crop].grow * MIN)) : 0; }
function cropStage(f) { const p = cropProg(f); return p >= 1 ? 4 : p >= 0.65 ? 3 : p >= 0.35 ? 2 : p >= 0.1 ? 1 : 0; }
function isRipe(f) { return !!f && cropProg(f) >= 1; }
function fieldPos(i) { return [AREA.fields.x + i % 4, AREA.fields.y + Math.floor(i / 4)]; }

function plant(i, crop) {
  const h = S.me;
  if (i >= h.fields.length || h.fields[i] || !(h.seeds[crop] > 0)) return 'no';
  if (!useAction()) return 'cap';
  h.seeds[crop]--;
  if (!h.seeds[crop]) delete h.seeds[crop];
  h.fields[i] = { crop, at: now(), left: CROPS[crop].yield, thieves: [] };
  return 'ok';
}
function harvest(i) {
  const f = S.me.fields[i];
  if (!isRipe(f)) return null;
  addBarn(S.me, f.crop, f.left);
  S.me.fields[i] = null;
  return { crop: f.crop, n: f.left, i };
}

// Sneaking takes a small share and never more than half, so the owner always keeps most of it.
const stealKeep = crop => Math.ceil(CROPS[crop].yield / 2);
const stealSize = crop => Math.max(1, Math.round(CROPS[crop].yield * 0.25));
function hasGuardDog(h) { return h.animals.some(a => ANIMALS[a.k].guard && animalStage(a) === 2); }
function stealable(h, i, who = 'me') {
  const f = h.fields[i];
  return isRipe(f) && !f.thieves.includes(who) && f.left > stealKeep(f.crop);
}
// Shared checks for every kind of sneaking. Returns an error code or null.
function sneakCheck() {
  if (S.today.steals >= STEAL_CAP) return 'limit';
  if (!useAction()) return 'cap';
  S.today.steals++;
  return null;
}
function steal(fid, i) {
  const h = friendById(fid), f = h.fields[i];
  if (!isRipe(f)) return { r: 'no' };
  if (f.thieves.includes('me')) return { r: 'done' };
  if (f.left <= stealKeep(f.crop)) return { r: 'empty' };
  const err = sneakCheck(); if (err) return { r: err };
  f.thieves.push('me');
  if (hasGuardDog(h) && Math.random() < 0.35) return { r: 'dog' };
  const n = Math.min(f.left - stealKeep(f.crop), stealSize(f.crop));
  f.left -= n;
  addBarn(S.me, f.crop, n);
  return { r: 'ok', k: f.crop, n };
}
function stealProduct(fid, aid) {
  const h = friendById(fid), a = h.animals.find(x => x.id === aid);
  if (!a || !animalReady(a) || nextIsBaby(a) || !ANIMALS[a.k].prod) return { r: 'no' };
  a.thieves = a.thieves || [];
  if (a.thieves.includes('me')) return { r: 'done' };
  if ((a.stolen || 0) >= ANIMALS[a.k].n - 1) return { r: 'empty' };
  const err = sneakCheck(); if (err) return { r: err };
  a.thieves.push('me');
  if (hasGuardDog(h) && Math.random() < 0.35) return { r: 'dog' };
  a.stolen = (a.stolen || 0) + 1;
  addBarn(S.me, ANIMALS[a.k].prod, 1);
  return { r: 'ok', k: ANIMALS[a.k].prod, n: 1 };
}
function stealFruit(fid, i) {
  const h = friendById(fid), t = h.trees[i];
  if (!treeReady(t)) return { r: 'no' };
  t.thieves = t.thieves || [];
  if (t.thieves.includes('me')) return { r: 'done' };
  if ((t.stolen || 0) >= Math.floor(TREES[t.k].n / 2)) return { r: 'empty' };
  const err = sneakCheck(); if (err) return { r: err };
  t.thieves.push('me');
  if (hasGuardDog(h) && Math.random() < 0.35) return { r: 'dog' };
  t.stolen = (t.stolen || 0) + 1;
  addBarn(S.me, TREES[t.k].fruit, 1);
  return { r: 'ok', k: TREES[t.k].fruit, n: 1 };
}
function friendStealsFromMe(fid) {
  const crops = S.me.fields.map((f, i) => i).filter(i => stealable(S.me, i, fid));
  const eggs = S.me.animals.filter(a => animalReady(a) && !nextIsBaby(a) && ANIMALS[a.k].prod && !(a.thieves || []).includes(fid) && (a.stolen || 0) < ANIMALS[a.k].n - 1);
  if (!crops.length && !eggs.length) return null;
  const dog = hasGuardDog(S.me) && Math.random() < 0.5;
  if (crops.length && (!eggs.length || Math.random() < 0.6)) {
    const f = S.me.fields[rand(crops)];
    f.thieves.push(fid);
    if (dog) return addFeed({ kind: 'caught', from: fid, k: f.crop });
    const n = Math.min(f.left - stealKeep(f.crop), stealSize(f.crop));
    f.left -= n;
    return addFeed({ kind: 'stole', from: fid, k: f.crop, n });
  }
  const a = rand(eggs);
  a.thieves = [...(a.thieves || []), fid];
  if (dog) return addFeed({ kind: 'caught', from: fid, k: ANIMALS[a.k].prod });
  a.stolen = (a.stolen || 0) + 1;
  return addFeed({ kind: 'stole', from: fid, k: ANIMALS[a.k].prod, n: 1 });
}

// ---------- animals ----------
function newAnimal(k, stage = 0) {
  const d = ANIMALS[k], t = now();
  return { id: uid(), k, born: t - d.grow * MIN * [0, 0.6, 1.2][stage], cycles: 0,
           last: stage === 2 && d.every ? t - d.every * MIN * Math.random() * 0.7 : null };
}
function animalProg(a) { return Math.min(1, (now() - a.born) / (ANIMALS[a.k].grow * MIN)); }
function animalStage(a) { const p = animalProg(a); return p >= 1 ? 2 : p >= 0.4 ? 1 : 0; }
function animalName(a) { const d = ANIMALS[a.k]; return animalStage(a) === 0 ? nm(d.baby) : nm(d); }
function prodProg(a) {
  const d = ANIMALS[a.k];
  if (!d.every || animalStage(a) < 2) return 0;
  return Math.min(1, (now() - (a.last || a.born + d.grow * MIN)) / (d.every * MIN));
}
function animalReady(a) { return ANIMALS[a.k].every > 0 && animalStage(a) === 2 && prodProg(a) >= 1; }
function nextIsBaby(a) { const d = ANIMALS[a.k]; return d.babyEvery > 0 && (a.cycles + 1) % d.babyEvery === 0; }
function pastureCap(h = S.me) { return h.pastureLv ? PASTURE[h.pastureLv].cap : 0; }
function pastureCount(h = S.me) { return h.animals.filter(a => !ANIMALS[a.k].pet).length; }
// Smaller pastures sit in the front-left corner of the pasture area, closest to the middle of the screen.
function pastureRect(h) {
  const p = PASTURE[h.pastureLv];
  return p ? { x: AREA.pasture.x, y: AREA.pasture.y + AREA.pasture.d - p.d, w: p.w, d: p.d } : null;
}
function collectAnimal(id, h = S.me) {
  const a = h.animals.find(x => x.id === id);
  if (!a || !animalReady(a)) return null;
  const d = ANIMALS[a.k];
  const baby = nextIsBaby(a), stolen = a.stolen || 0;
  a.cycles++; a.last = now(); a.thieves = []; a.stolen = 0;
  if (baby) {
    if (pastureCount(h) < pastureCap(h)) { h.animals.push(newAnimal(a.k, 0)); return { type: 'baby', k: a.k, placed: true, id: a.id }; }
    addBarn(h, 'baby_' + a.k, 1);
    return { type: 'baby', k: a.k, placed: false, id: a.id };
  }
  const n = Math.max(1, d.n - stolen);
  addBarn(h, d.prod, n);
  return { type: 'prod', k: d.prod, n, id: a.id };
}
function sellAnimal(id) {
  const h = S.me, i = h.animals.findIndex(a => a.id === id);
  if (i < 0) return 0;
  const a = h.animals[i], v = ANIMALS[a.k].sell[animalStage(a)];
  h.animals.splice(i, 1);
  h.coins += v;
  return v;
}
function releaseBaby(k) {
  const h = S.me, key = 'baby_' + k;
  if (!h.barn[key] || pastureCount(h) >= pastureCap(h)) return false;
  h.barn[key]--; if (!h.barn[key]) delete h.barn[key];
  h.animals.push(newAnimal(k, 0));
  return true;
}

// ---------- orchard ----------
function newTree(k, stage = 0) {
  const d = TREES[k], t = now();
  return { k, planted: t - d.grow * MIN * [0, 0.6, 1.2][stage], last: stage === 2 ? t - d.every * MIN * Math.random() * 0.8 : null, thieves: [], stolen: 0 };
}
function orchardSlots(h = S.me) { return h.orchardLv ? ORCHARD[h.orchardLv].slots : 0; }
function treeProg(t) { return Math.min(1, (now() - t.planted) / (TREES[t.k].grow * MIN)); }
function treeStage(t) { const p = treeProg(t); return p >= 1 ? 2 : p >= 0.4 ? 1 : 0; }
function fruitProg(t) {
  if (!t || treeStage(t) < 2) return 0;
  const d = TREES[t.k];
  return Math.min(1, (now() - (t.last || t.planted + d.grow * MIN)) / (d.every * MIN));
}
function treeReady(t) { return !!t && treeStage(t) === 2 && fruitProg(t) >= 1; }
function buyTree(k) {
  const h = S.me, d = TREES[k];
  if (!h.orchardLv) return 'noorchard';
  const i = h.trees.findIndex((t, j) => j < orchardSlots(h) && !t);
  if (i < 0) return 'full';
  if (h.coins < d.price) return 'poor';
  h.coins -= d.price;
  h.trees[i] = newTree(k, 0);
  return 'ok';
}
function collectTree(i, h = S.me) {
  const t = h.trees[i];
  if (!treeReady(t)) return null;
  const d = TREES[t.k], n = Math.max(1, d.n - (t.stolen || 0));
  addBarn(h, d.fruit, n);
  t.last = now(); t.thieves = []; t.stolen = 0;
  return { k: d.fruit, n, i };
}

// ---------- pond ----------
function pondCap(h = S.me) { return h.pondLv ? POND[h.pondLv].cap : 0; }
function fishCount(h = S.me) {
  if (!h.pondLv) return 0;
  return Math.min(pondCap(h), h.pond.fish + Math.floor((now() - h.pond.at) / (FISH_EVERY * MIN)));
}
function catchFish(h = S.me) {
  const n = fishCount(h);
  if (n < 1) return null;
  h.pond = { fish: n - 1, at: now() };
  let r = Math.random(), k = FISH_KINDS[0][0];
  for (const [kind, p] of FISH_KINDS) { if (r < p) { k = kind; break; } r -= p; }
  addBarn(h, k, 1);
  return { k, n: 1 };
}

// ---------- yard things that make something (beehive) ----------
function yardReady(it) { const d = YARD[it.k]; return !!d.prod && now() - (it.last || it.placed || 0) >= d.every * MIN; }
function collectYard(id, h = S.me) {
  const it = h.yard.find(x => x.id === id);
  if (!it || !yardReady(it)) return null;
  const d = YARD[it.k];
  addBarn(h, d.prod, d.n);
  it.last = now();
  return { k: d.prod, n: d.n };
}

// ---------- barn ----------
function barnInfo(k) {
  if (CROPS[k]) return { e: CROPS[k].e, name: nm(CROPS[k]), sell: CROPS[k].sell };
  if (GOODS[k]) return { e: GOODS[k].e, name: nm(GOODS[k]), sell: GOODS[k].sell };
  const a = ANIMALS[k.slice(5)];
  return { e: a.e, name: nm(a.baby), sell: a.sell[0], baby: k.slice(5) };
}
function sellBarn(k, n) {
  const h = S.me, have = h.barn[k] || 0;
  n = Math.min(n, have);
  if (!n) return 0;
  h.barn[k] -= n;
  if (!h.barn[k]) delete h.barn[k];
  const v = n * barnInfo(k).sell;
  h.coins += v;
  return v;
}
function barnValue(h = S.me) { return Object.entries(h.barn).reduce((s, [k, n]) => s + n * barnInfo(k).sell, 0); }
function sellAllBarn() { return Object.keys(S.me.barn).reduce((s, k) => s + sellBarn(k, S.me.barn[k]), 0); }

// ---------- weather ----------
// Real local weather when the player turns it on (the app fetches it), otherwise the town's own weather,
// which changes every 3 hours. Snow only in the colder months.
const WEATHER_E = { clear: '☀️', clouds: '⛅', rain: '🌧️', snow: '❄️', fog: '🌫️', storm: '⛈️' };
function simWeather(t = now()) {
  const d = new Date(t), m = d.getMonth(), v = hash(d.getFullYear() * 400 + m * 32 + d.getDate(), Math.floor(d.getHours() / 3));
  const cold = m >= 10 || m <= 1;
  const kind = v < 0.48 ? 'clear' : v < 0.72 ? 'clouds' : v < 0.86 ? (cold && v > 0.8 ? 'snow' : 'rain') : v < 0.93 ? 'fog' : cold ? 'snow' : 'storm';
  const base = [3, 6, 11, 16, 21, 26, 29, 28, 23, 16, 9, 4][m];
  return { kind, temp: Math.round(base + (v - 0.5) * 6 - (kind === 'rain' || kind === 'snow' ? 3 : 0)), real: false };
}
function weatherNow() {
  const w = S && S.weather;
  if (w && w.forced) return w;
  if (w && w.real && S.weatherReal && now() - w.at < 3 * HOUR) return w;
  return simWeather();
}
// Open-Meteo weather codes → our kinds.
function codeKind(c) {
  if (c <= 1) return 'clear';
  if (c <= 3) return 'clouds';
  if (c === 45 || c === 48) return 'fog';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c >= 95) return 'storm';
  return 'rain';
}
// Rain waters the crops: while it rains, everything in the fields grows a quarter faster.
function rainGrow(ms) {
  const w = weatherNow().kind;
  if (w !== 'rain' && w !== 'storm') return;
  [S.me, ...S.friends].forEach(h => h.fields.forEach(f => { if (f && !isRipe(f)) f.at -= ms * 0.25; }));
}

// ---------- storeys ----------
// Every storey is its own room (wallpaper, floor, furniture). LEVEL is the storey you're looking at inside
// (0 = ground floor); outside it's always 0, so things you buy go downstairs.
let LEVEL = 0;
function setLevel(lv) { LEVEL = Math.max(0, lv | 0); }
function floorsOf(h) { const H = HOUSES[h.house]; return H.floors[0] + ((h.extra || {})[h.house] || 0); }
function maxFloors(h) { return HOUSES[h.house].floors[1]; }
function ensureUps(h) {
  h.ups = h.ups || [];
  while (h.ups.length < floorsOf(h) - 1) h.ups.push({ wall: h.room.wall, floor: h.room.floor, items: [] });
}
function roomAt(h, lv) { if (!lv) return h.room; ensureUps(h); return h.ups[lv - 1] || h.room; }
const lvOf = (h, lv) => Math.min(lv === undefined ? (h === S.me ? LEVEL : 0) : lv, floorsOf(h) - 1);
function curRoom(h, lv) { return roomAt(h, lvOf(h, lv)); }
// Stairs along the back wall, in the right corner: on a storey with one above, the flight going up ('up', rising
// towards the right wall); on a storey with one below, the opening where you go down ('down'), just left of it.
function stairsRects(h, lv) {
  const n = floorsOf(h);
  if (n < 2) return [];
  lv = Math.min(lv === undefined ? lvOf(h) : lv, n - 1);
  const [rw] = roomSize(h), out = [];
  if (lv < n - 1) out.push({ kind: 'up', x: rw - 2, y: 0, w: 2, d: 1 });
  if (lv > 0) out.push({ kind: 'down', x: rw - 4, y: 0, w: 2, d: 1 });
  return out;
}
const hasStairs = h => floorsOf(h) > 1;
const overlaps = (r, x, y, w, d) => x < r.x + r.w && x + w > r.x && y < r.y + r.d && y + d > r.y;
// Your townie must be able to reach everything: from the front door (ground floor) or the top of the stairs
// (upstairs), every piece of furniture needs a free tile next to it, and the stairs need a free tile in front.
function roomReachable(h, lv, items) {
  const [rw, rd] = roomSize(h), g = new Uint8Array(rw * rd).fill(1);
  const block = (x, y, w, d) => { for (let j = y; j < y + d; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < rw && j < rd) g[j * rw + i] = 0; };
  const solid = items.filter(it => !FURN[it.k].flat), st = stairsRects(h, lv);
  solid.forEach(it => { const [w, d] = itemSize('room', it); block(it.x, it.y, w, d); });
  st.forEach(r => block(r.x, r.y, r.w, r.d));
  const down = st.find(r => r.kind === 'down'), entry = down ? [down.x + 1, down.y + down.d] : [0, rd - 1];
  const seen = new Uint8Array(rw * rd), q = [];
  const push = (x, y) => { if (x >= 0 && y >= 0 && x < rw && y < rd && g[y * rw + x] && !seen[y * rw + x]) { seen[y * rw + x] = 1; q.push([x, y]); } };
  push(entry[0], entry[1]);
  if (!q.length) return false;
  for (let k = 0; k < q.length; k++) { const [x, y] = q[k]; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  const ok = (x, y) => x >= 0 && y >= 0 && x < rw && y < rd && seen[y * rw + x];
  const nextTo = (x, y, w, d) => {
    for (let i = x; i < x + w; i++) if (ok(i, y - 1) || ok(i, y + d)) return true;
    for (let j = y; j < y + d; j++) if (ok(x - 1, j) || ok(x + w, j)) return true;
    return false;
  };
  return solid.every(it => { const [w, d] = itemSize('room', it); return nextTo(it.x, it.y, w, d); })
    && st.every(r => ok(r.x, r.y + r.d) || ok(r.x + 1, r.y + r.d));
}
let PLACE_WHY = '';   // why the last canPlace said no: 'space' or 'block' (would block the way)
function floorCost(h, n = floorsOf(h) + 1) {
  const [rw, rd] = roomSize(h), H = HOUSES[h.house], k = Math.pow(FLOOR_BUILD.grow, n - H.floors[0] - 1);
  return { coins: Math.round(rw * rd * FLOOR_BUILD.coinsPerTile * k / 50) * 50, wood: Math.round(rw * rd * FLOOR_BUILD.woodPerTile * k) };
}
function buyFloor(h = S.me) {
  if (floorsOf(h) >= maxFloors(h)) return 'max';
  const c = floorCost(h);
  if (!canAfford(c, h)) return 'poor';
  pay(c, h);
  h.extra = h.extra || {};
  h.extra[h.house] = (h.extra[h.house] || 0) + 1;
  ensureUps(h);
  fitRooms(h);
  return 'ok';
}
// After moving house or building a storey: anything that no longer fits (smaller room, stairs, storeys you don't
// have in this house) goes to storage. Returns how many things moved.
function fitRooms(h) {
  ensureUps(h);
  let n = 0;
  [h.room, ...h.ups].forEach((r, lv) => {
    const keep = [];
    r.items.forEach(it => {
      const ok = lv < floorsOf(h) && canPlace(h, 'room', it.k, it.x, it.y, it.rot, it.id, lv, keep);
      if (ok) keep.push(it);
      else { const key = 'room:' + it.k; h.store[key] = (h.store[key] || 0) + 1; n++; }
    });
    r.items = keep;
  });
  return n;
}
function allRoomItems(h) { return [h.room, ...(h.ups || []).slice(0, floorsOf(h) - 1)].flatMap(r => r.items); }

// ---------- placing furniture and yard items ----------
// The yard covers the whole lot, including bought land to the right of the 16-tile core.
const itemDef = (scope, k) => (scope === 'room' ? FURN[k] : YARD[k]);
const scopeItems = (h, scope, lv) => (scope === 'room' ? curRoom(h, lv).items : h.yard);
function itemSize(scope, it) { const d = itemDef(scope, it.k); return it.rot ? [d.d, d.w] : [d.w, d.d]; }
function roomSize(h) { return HOUSES[h.house].room; }
const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d;
const PORCH = { x: AREA.house.x, y: AREA.house.y + AREA.house.d, w: AREA.house.w, d: 1 }; // keep the front of the house clear
function yardReserved(x, y, w = LOT_W) {
  if (x < 0 || y < 0 || x >= w || y >= LOT_D) return true;
  if (x === MAILBOX[0] && y === MAILBOX[1]) return true;
  return ['house', 'pasture', 'fields', 'orchard', 'pond', 'drive', 'path'].some(k => inRect(AREA[k], x, y)) || inRect(PORCH, x, y);
}
function canPlace(h, scope, k, x, y, rot, ignoreId, lv, list) {
  const def = itemDef(scope, k);
  const [w, d] = rot ? [def.d, def.w] : [def.w, def.d];
  PLACE_WHY = 'space';
  if (scope === 'room') {
    const [rw, rd] = roomSize(h);
    if (x < 0 || y < 0 || x + w > rw || y + d > rd) return false;
    if (stairsRects(h, lv).some(r => overlaps(r, x, y, w, d))) return false;
  } else {
    const lw = homeW(h);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (yardReserved(x + i, y + j, lw)) return false;
  }
  const others = (list || scopeItems(h, scope, lv)).filter(it => it.id !== ignoreId);
  for (const it of others) {
    if (scope === 'room' && !!itemDef(scope, it.k).flat !== !!def.flat) continue; // rugs can sit under furniture
    const [iw, id] = itemSize(scope, it);
    if (x < it.x + iw && x + w > it.x && y < it.y + id && y + d > it.y) return false;
  }
  if (scope === 'room' && !def.flat && !roomReachable(h, lvOf(h, lv), [...others, { k, x, y, rot }])) { PLACE_WHY = 'block'; return false; }
  return true;
}
// Lays a room out again from scratch (used for simulated friends whose old layouts blocked the way).
function relayoutRoom(h, lv) {
  const r = roomAt(h, lv), items = r.items.slice().sort((a, b) => (FURN[b.k].w * FURN[b.k].d) - (FURN[a.k].w * FURN[a.k].d));
  r.items = [];
  items.forEach(it => autoPlace(h, 'room', it.k, it.tint, lv));
}
// Preferred spots: inside, along the back walls first; outside, the front yard near the path first.
function roomSpots(h, flat) {
  const [rw, rd] = roomSize(h), out = [];
  for (let y = 0; y < rd; y++) for (let x = 0; x < rw; x++) out.push([x, y]);
  if (flat) return out.sort((a, b) => Math.hypot(a[0] - rw / 2 + 1, a[1] - rd / 2 + 1) - Math.hypot(b[0] - rw / 2 + 1, b[1] - rd / 2 + 1));
  // furniture goes along the walls first (all four sides), keeping the middle of the room free to walk
  const edge = ([x, y]) => Math.min(x, y, rw - 1 - x, rd - 1 - y);
  return out.sort((a, b) => edge(a) - edge(b) || (a[0] + a[1]) - (b[0] + b[1]));
}
let YARD_SPOTS = {};
function yardSpots(w = LOT_W) {
  if (!YARD_SPOTS[w]) {
    const out = [];
    for (let y = 0; y < LOT_D; y++) for (let x = 0; x < w; x++) if (!yardReserved(x, y, w)) out.push([x, y]);
    out.sort((a, b) => Math.hypot(a[0] - 6, a[1] - 6) - Math.hypot(b[0] - 6, b[1] - 6));
    YARD_SPOTS[w] = out;
  }
  return YARD_SPOTS[w];
}
function autoPlace(h, scope, k, tint, lv) {
  const def = itemDef(scope, k);
  const spots = scope === 'room' ? roomSpots(h, def.flat) : yardSpots(homeW(h));
  // Against the left wall, turn things so their back touches the wall.
  for (const [x, y] of spots) for (const rot of (scope === 'room' && x === 0 && y > 0 ? [1, 0] : [0, 1])) {
    if (rot && def.w === def.d && !(scope === 'room' && x === 0 && y > 0)) continue;
    if (canPlace(h, scope, k, x, y, rot, null, lv)) {
      const it = { id: uid(), k, x, y, rot, tint: def.tint ? (tint || rand(TINTS)) : null, placed: now() };
      scopeItems(h, scope, lv).push(it);
      return it;
    }
  }
  const key = scope + ':' + k;
  h.store[key] = (h.store[key] || 0) + 1;
  return null;
}
function fixLayout(h) {
  h.yard.splice(0).forEach(it => {
    if (canPlace(h, 'yard', it.k, it.x, it.y, it.rot)) h.yard.push(it);
    else autoPlace(h, 'yard', it.k, it.tint);
  });
}
function placeFromStore(scope, k, x, y, rot, tint) {
  const h = S.me, key = scope + ':' + k;
  if (!h.store[key] || !canPlace(h, scope, k, x, y, rot)) return null;
  h.store[key]--; if (!h.store[key]) delete h.store[key];
  const it = { id: uid(), k, x, y, rot, tint: itemDef(scope, k).tint ? (tint || rand(TINTS)) : null, placed: now() };
  scopeItems(h, scope).push(it);
  return it;
}
function findItem(scope, id) { return scopeItems(S.me, scope).find(i => i.id === id); }
function moveItem(scope, id, x, y, rot) {
  const it = findItem(scope, id);
  if (!it || !canPlace(S.me, scope, it.k, x, y, rot, id)) return false;
  Object.assign(it, { x, y, rot });
  return true;
}
function rotateItem(scope, id) { const it = findItem(scope, id); return !!it && moveItem(scope, id, it.x, it.y, it.rot ? 0 : 1); }
function tintItem(scope, id) {
  const it = findItem(scope, id);
  if (!it || !it.tint) return false;
  it.tint = TINTS[(TINTS.indexOf(it.tint) + 1) % TINTS.length];
  return true;
}
function storeItem(scope, id) {
  const list = scopeItems(S.me, scope), i = list.findIndex(x => x.id === id);
  if (i < 0) return false;
  const key = scope + ':' + list[i].k;
  S.me.store[key] = (S.me.store[key] || 0) + 1;
  list.splice(i, 1);
  return true;
}

// ---------- shop ----------
function buySeed(crop, n) {
  const c = CROPS[crop];
  if (c.rare) return 'no';
  if (S.me.coins < c.seed * n) return 'poor';
  S.me.coins -= c.seed * n;
  S.me.seeds[crop] = (S.me.seeds[crop] || 0) + n;
  return 'ok';
}
function buyAnimal(k) {
  const h = S.me, d = ANIMALS[k];
  if (d.pet) { if (h.animals.some(a => a.k === k)) return 'own'; }
  else if (!h.pastureLv) return 'nopasture';
  else if (pastureCount(h) >= pastureCap(h)) return 'full';
  if (h.coins < d.price) return 'poor';
  h.coins -= d.price;
  h.animals.push(newAnimal(k, 0));
  return 'ok';
}
function buyLand(kind, h = S.me) {
  const table = { field: [FIELD_COST, 'fieldLv'], pasture: [PASTURE, 'pastureLv'], orchard: [ORCHARD, 'orchardLv'], pond: [POND, 'pondLv'] }[kind];
  const [levels, key] = table;
  if (h[key] >= levels.length - 1) return 'max';
  const next = levels[h[key] + 1], cost = next.cost || next;
  if (!canAfford(cost, h)) return 'poor';
  pay(cost, h);
  h[key]++;
  if (kind === 'field') while (h.fields.length < FIELD_LEVELS[h.fieldLv]) h.fields.push(null);
  if (kind === 'pond') h.pond = { fish: 2, at: now() };
  return 'ok';
}
function buyItem(scope, k, h = S.me) {
  const d = itemDef(scope, k);
  if (h.coins < d.price) return { r: 'poor' };
  h.coins -= d.price;
  return { r: 'ok', item: autoPlace(h, scope, k) };
}
function buyCar(k, h = S.me) {
  if (h.cars.some(c => c.k === k)) return 'own';
  const c = CARS[k].cost;
  if (!canAfford(c, h)) return 'poor';
  pay(c, h);
  h.cars.push({ k, color: h === S.me ? CAR_COLORS[0] : rand(CAR_COLORS) });
  h.car = h.cars.length - 1;
  return 'ok';
}
// You can own several houses and pick which one to live in; furniture and yard come along.
function buyHouse(i, h = S.me) {
  if (h.houses.includes(i)) return 'own';
  const c = HOUSES[i].cost;
  if (!canAfford(c, h)) return 'poor';
  pay(c, h);
  h.houses.push(i);
  h.house = i;
  fitRooms(h);
  return 'ok';
}
function moveHouse(i, h = S.me) { if (!h.houses.includes(i)) return false; h.house = i; return fitRooms(h) + 1; }

// ---------- souvenirs: earned in real life, never sold ----------
function souvProgress(sv) { return Math.min(sv.n, S.stats[sv.need] || 0); }
// Gives any souvenir you just earned; it goes straight into your ground floor (or storage if there's no room).
function awardSouvenirs() {
  const got = [];
  SOUVENIRS.forEach(sv => {
    if (S.souv.includes(sv.k) || souvProgress(sv) < sv.n) return;
    S.souv.push(sv.k);
    autoPlace(S.me, 'room', sv.k, null, 0);
    got.push(sv.k);
  });
  return got;
}

// ---------- assets & ranking ----------
const costValue = c => (c.coins || 0) + (c.wood || 0) * 5; // wood only comes from real life, so it counts extra
function assetBreakdown(h) {
  const b = { cash: h.coins + h.wood * 5, house: 0, land: 0, items: 0, cars: 0, animals: 0, goods: 0 };
  h.houses.forEach(i => { b.house += costValue(HOUSES[i].cost); });
  for (let i = 1; i <= h.fieldLv; i++) b.land += costValue(FIELD_COST[i]);
  for (let i = 1; i <= h.pastureLv; i++) b.land += costValue(PASTURE[i].cost);
  for (let i = 1; i <= h.orchardLv; i++) b.land += costValue(ORCHARD[i].cost);
  for (let i = 1; i <= h.pondLv; i++) b.land += costValue(POND[i].cost);
  allRoomItems(h).forEach(it => { b.items += FURN[it.k].price; });
  Object.entries(h.extra || {}).forEach(([hi, n]) => {
    const hh = { house: +hi };
    for (let k = 1; k <= n; k++) b.house += costValue(floorCost(hh, HOUSES[+hi].floors[0] + k));
  });
  h.yard.forEach(it => { b.items += YARD[it.k].price; });
  Object.entries(h.store).forEach(([key, n]) => { const [sc, k] = key.split(':'); b.items += itemDef(sc, k).price * n; });
  h.cars.forEach(c => { b.cars += costValue(CARS[c.k].cost); });
  h.animals.forEach(a => { b.animals += ANIMALS[a.k].sell[animalStage(a)]; });
  h.trees.forEach(t => { if (t) b.land += TREES[t.k].price; });
  b.goods = barnValue(h) + Object.entries(h.seeds).reduce((s, [k, n]) => s + CROPS[k].seed * n, 0);
  b.total = b.cash + b.house + b.land + b.items + b.cars + b.animals + b.goods;
  return b;
}
const assetValue = h => assetBreakdown(h).total;
function ranking() { return residents().map(h => ({ h, v: assetValue(h) })).sort((a, b) => b.v - a.v); }
function rankOf(id) { return ranking().findIndex(r => r.h.id === id) + 1; }
function townTotal() { return residents().reduce((s, h) => s + assetValue(h), 0); }
function townLevel(total = townTotal()) {
  let lv = 1;
  TOWN_LEVELS.forEach((v, i) => { if (total >= v) lv = i + 1; });
  return lv;
}

// ---------- friends live their lives too ----------
// Every 5 simulated minutes each friend earns a little, tends their farm, now and then buys something,
// and sometimes goes for a workout (shown only if they share it).
function simFriends() {
  const t = now(), STEP = 5 * MIN;
  S.friends.forEach(h => {
    if (!lotOf(h.id)) return;
    if (!h.simAt) h.simAt = t;
    let n = Math.floor((t - h.simAt) / STEP);
    if (n <= 0) return;
    h.simAt += n * STEP;
    n = Math.min(n, 288);
    for (let k = 0; k < n; k++) simFriendStep(h);
  });
}
function simFriendStep(h) {
  h.coins += Math.round(Math.random() * h.earn);
  if (Math.random() < 0.15) h.wood += 1;
  if (h.live && now() - h.live.start > h.live.len) h.live = null;
  else if (!h.live && Math.random() < 0.03) h.live = { type: rand(['run', 'walk', 'cycle', 'yoga', 'strength', 'dance']), start: now(), len: (15 + Math.random() * 30) * MIN };
  h.fields.forEach((f, i) => {
    if (!isRipe(f) || Math.random() > 0.2) return;
    h.coins += f.left * CROPS[f.crop].sell;
    const c = rand(Object.keys(CROPS).filter(c => !CROPS[c].rare));
    h.fields[i] = { crop: c, at: now() - Math.random() * CROPS[c].grow * MIN * 0.3, left: CROPS[c].yield, thieves: [] };
  });
  h.animals.forEach(a => {
    if (!animalReady(a) || Math.random() > 0.3) return;
    const r = collectAnimal(a.id, h);
    if (r && r.type === 'prod') { h.coins += h.barn[r.k] * GOODS[r.k].sell; delete h.barn[r.k]; }
    if (r && r.type === 'baby' && !r.placed) { h.coins += ANIMALS[r.k].sell[0]; delete h.barn['baby_' + r.k]; }
  });
  h.trees.forEach((tr, i) => {
    if (!treeReady(tr) || Math.random() > 0.3) return;
    const r = collectTree(i, h);
    if (r) { h.coins += h.barn[r.k] * GOODS[r.k].sell; delete h.barn[r.k]; }
  });
  if (Math.random() > 0.05) return;
  const next = HOUSES.findIndex((H, i) => i > h.house && !h.houses.includes(i));
  if (next > 0 && h.coins > costValue(HOUSES[next].cost) * 1.3 && h.wood >= (HOUSES[next].cost.wood || 0)) { buyHouse(next, h); return; }
  if (h.fieldLv < 3 && h.coins > FIELD_COST[h.fieldLv + 1].coins * 2) { buyLand('field', h); return; }
  if (!h.cars.length && h.coins > 1500) { buyCar(h.coins > 3000 ? 'pickup' : 'mini', h); return; }
  if (h.coins > 400) {
    if (Math.random() < 0.5) buyItem('room', rand(Object.keys(FURN)), h);
    else buyItem('yard', rand(['flowers', 'hedge', 'tree', 'pine', 'lamp', 'bench', 'gnome', 'birdbath']), h);
  }
}

// ---------- social ----------
function addFeed(item) {
  Object.assign(item, { id: uid(), t: now(), claimed: false, read: false });
  S.feed.push(item);
  if (S.feed.length > 60) S.feed.shift();
  return item;
}
function likeFriend(id) {
  if (S.today.liked[id]) return false;
  S.today.liked[id] = true;
  friendById(id).likes++;
  return true;
}
function giftOptions() {
  const out = [];
  Object.keys(S.me.barn).forEach(k => { if (!k.startsWith('baby_')) out.push({ type: 'barn', k, n: 1 }); });
  if (S.me.coins >= 20) out.push({ type: 'coins', n: 20 });
  if (S.me.wood >= 2) out.push({ type: 'wood', n: 2 });
  return out;
}
function giveGift(id, g) {
  const h = S.me, f = friendById(id);
  if (g.type === 'barn') { if (!(h.barn[g.k] >= 1)) return false; h.barn[g.k]--; if (!h.barn[g.k]) delete h.barn[g.k]; addBarn(f, g.k, 1); }
  else if (g.type === 'coins') { if (h.coins < g.n) return false; h.coins -= g.n; f.coins += g.n; }
  else if (g.type === 'wood') { if (h.wood < g.n) return false; h.wood -= g.n; f.wood += g.n; }
  return true;
}
function applyGift(g) {
  if (g.type === 'barn') addBarn(S.me, g.k, g.n);
  else if (g.type === 'seed') S.me.seeds[g.k] = (S.me.seeds[g.k] || 0) + g.n;
  else if (g.type === 'coins') S.me.coins += g.n;
  else if (g.type === 'wood') S.me.wood += g.n;
}
function claimGift(feedId) {
  const it = S.feed.find(x => x.id === feedId);
  if (!it || it.claimed || !it.gift) return null;
  applyGift(it.gift); it.claimed = true;
  return it.gift;
}
function randomGift() {
  return clone(rand([
    { type: 'barn', k: 'carrot', n: 3 }, { type: 'barn', k: 'egg', n: 4 }, { type: 'barn', k: 'milk', n: 2 }, { type: 'barn', k: 'apple', n: 3 },
    { type: 'seed', k: 'tomato', n: 2 }, { type: 'seed', k: 'strawberry', n: 2 }, { type: 'seed', k: 'corn', n: 2 },
    { type: 'coins', n: 30 }, { type: 'wood', n: 3 },
  ]));
}

// ---------- letters ----------
function sendLetter(to, text, paper, gift) {
  if (gift && !giveGift(to, gift)) return null;
  const l = { id: uid(), to, text, paper, gift: gift || null, t: now() };
  S.mail.sent.unshift(l);
  if (S.mail.sent.length > 50) S.mail.sent.pop();
  return l;
}
function receiveLetter(from, text, paper, gift) {
  const l = { id: uid(), from, text, paper, gift: gift || null, t: now(), read: false, claimed: false };
  S.mail.inbox.unshift(l);
  if (S.mail.inbox.length > 50) S.mail.inbox.pop();
  return l;
}
const unreadMail = () => (S.mail ? S.mail.inbox.filter(l => !l.read).length : 0);
function claimLetterGift(id) {
  const l = S.mail.inbox.find(x => x.id === id);
  if (!l || !l.gift || l.claimed) return null;
  applyGift(l.gift); l.claimed = true;
  return l.gift;
}

function randomFriendEvent() {
  const ids = friendIds();
  if (!ids.length) return null;
  const f = friendById(rand(ids));
  const r = Math.random();
  if (r < 0.22) { const ev = friendStealsFromMe(f.id); if (ev) return ev; }
  if (r < 0.45) return addFeed({ kind: 'gift', from: f.id, gift: randomGift() });
  if (r < 0.6) { S.me.likes++; return addFeed({ kind: 'like', from: f.id }); }
  if (r < 0.72 && f.shareGoal && !f.goalToday) { f.goalToday = true; return addFeed({ kind: 'goal', from: f.id }); }
  if (r < 0.86) return { kind: 'letter', from: f.id };   // the UI writes the letter text
  return addFeed({ kind: 'msg', from: f.id, msgKey: rand(MSG_KEYS) });
}
// Invite reward goes to both sides.
function inviteJoin() {
  const run = freeRun();
  const next = FRIEND_POOL.find(f => !S.friends.some(x => x.id === f.id));
  if (!run || !next) return null;
  S.lots.push({ id: next.id, st: run.st, p: run.p, n: CORE_PARCELS, paid: 0 });
  S.friends.push(homeFromPreset(next));
  return addFeed({ kind: 'join', from: next.id, gift: { type: 'wood', n: 5 } });
}
