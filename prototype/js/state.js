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
    focusMin: 0, distractMin: 0, actions: 0, steals: 0, restDay: false, liked: {}, chased: {},
    earned: { coins: 0, wood: 0 },
    paid: { stepBlocks: 0, goal: false, rings: {}, workouts: {}, mindful: 0, sleep: false },
  };
}

function load() {
  try { S = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { S = null; }
  if (!S || S.v !== 3) S = null;
  if (S) { migrate(); genNPCs(); [S.me, ...S.friends].forEach(h => { fixLayout(h); fitRooms(h); }); fixBlockedYards(); }
  return S;
}
// Saves from v0.3 get the v0.4 fields (floors, privacy, souvenirs, personal goal). Old players skip the tutorial.
function migrate() {
  if (S.tut === undefined) S.tut = -1;
  if (S.calm === undefined) S.calm = false;
  S.stats = Object.assign({ days: 1, goalDays: 0, sleepStreak: 0, ringsAll: 0, focus120: 0, mindful: 0, workouts: 0 }, S.stats || {});
  S.souv = S.souv || [];
  S.stepGoal = S.stepGoal || STEP_GOAL;
  S.me.wardrobe = S.me.wardrobe || [...CLOTHES_FREE];   // v0.18: clothes you own
  S.mall = Object.assign({ movies: [], foods: [], plush: [] }, S.mall || {});   // v0.18: films seen, food tried, plush won
  S.friends.forEach(h => {
    const pre = [...FRIEND_PRESETS, ...FRIEND_POOL].find(p => p.id === h.id);
    if (pre && pre.look.body && !h.look.body) Object.assign(h.look, clone(pre.look), { shirt: h.look.shirt, skin: h.look.skin, hair: h.look.hair, hairCol: h.look.hairCol, mob: h.look.mob });
    dressUp(h.look, h.id);
  });
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
  // v0.8: dogs and cats become pets with a breed, a name and needs; sign-in and light / dark look
  [S.me, ...S.friends].forEach(h => { h.animals.filter(isPet).forEach(a => setupPet(a, null, h)); h.petFood = h.petFood || {}; });
  if (S.theme === undefined) S.theme = 'auto';
  if (S.trophyV !== 1) { S.friends.forEach(showOffExclusives); S.trophySeen = S.trophySeen || {}; S.trophyV = 1; }   // v0.10
  if (S.petRemind === undefined) S.petRemind = true;
  // v0.12: every community has its own town plan. A home in another community whose street isn't in the new plan
  // (or doesn't fit any more) moves to the first free land there big enough for it.
  if (S.townPlanV !== 1) {
    S.lots.filter(l => townOfLot(l) !== HOME_TOWN).forEach(l => {
      const t = townOfLot(l), st = streetsOf(t)[l.st], clash = () => S.lots.some(o => o !== l && townOfLot(o) === t && o.st === l.st && o.p < l.p + l.n && l.p < o.p + o.n)
        || npcLots(t).some(o => o.st === l.st && o.p < l.p + l.n && l.p < o.p + o.n);
      if (st && l.p + l.n <= st.n && !clash()) return;
      l.st = '__moving'; RUNS.key = '';
      const run = computeRuns(t).filter(r => r.n >= Math.min(l.n, CORE_PARCELS)).sort((a, b) => b.n - a.n)[0];
      if (run) Object.assign(l, { st: run.st, p: run.p, n: Math.min(l.n, run.n) });
    });
    RUNS.key = ''; S.townPlanV = 1;
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
    seeds: {}, barn: {}, petFood: {},
    // what friends may see: goal done, working out right now, energy face. All off by default.
    likes: 0, shareGoal: false, shareLive: false, shareMood: false, goalToday: false, energy: 75, live: null,
  };
}

function homeFromPreset(p) {
  const h = emptyHome(p.id), t = now();
  Object.assign(h, {
    name: clone(p.name), look: dressUp(clone(p.look), p.id), coins: p.coins, wood: p.wood, house: p.house, houses: [p.house], wall: p.wall, roof: p.roof,
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
    onboarding: !!o.preview, tut: 0, calm: false, souv: [], stepGoal: STEP_GOAL, hist: [], layoutV: 2, theme: 'auto', petRemind: true, account: null,
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
  S.friends.forEach(h => h.animals.filter(isPet).forEach(a => setupPet(a, null, h)));
  S.friends.forEach(showOffExclusives); S.trophyV = 1; S.trophySeen = {};
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
  // trophy streaks: 10k / 20k steps and all three rings, day after day
  ['steps10k', 'steps20k'].forEach(id => { const ok = y.steps + y.pushes >= STREAK_TROPHIES[id].need; st['cur_' + id] = ok ? (st['cur_' + id] || 0) + 1 : 0; st['best_' + id] = Math.max(st['best_' + id] || 0, st['cur_' + id]); });
  st.cur_rings = y.paid.rings.all ? (st.cur_rings || 0) + 1 : 0; st.best_rings = Math.max(st.best_rings || 0, st.cur_rings);
  closeDayAwards(y);
  closeDayHealth(y);
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
// ---------- communities (v0.9) ----------
// Every community uses the same streets. A lot without .town is in HOME_TOWN (where you start and where your
// friends live). VIEW_TOWN is the community the town view is showing. Other communities' residents are made up
// (seeded, so they look the same every time) the first time you look at them; their ids are "town:n1".
let VIEW_TOWN = HOME_TOWN;
const townOfLot = l => (l && l.town) || HOME_TOWN;
const npcId = (t, id) => (t === HOME_TOWN ? id : t + ':' + id);
const NPC_LOTS_BY = {};
function npcLots(t) { return NPC_LOTS_BY[t] || (NPC_LOTS_BY[t] = layoutOf(t).npcLots.map(s => ({ ...s, id: npcId(t, s.id), town: t }))); }
// Each community has its own town plan (v0.12, `LAYOUTS` in data.js); built once, mirrored if the community says so.
const LAYOUT_BUILT = {};
function layoutOf(t = VIEW_TOWN) { const c = COMMUNITIES[t] || COMMUNITIES[HOME_TOWN], key = (c.layout || 'grid') + (c.flip ? '|f' : ''); return LAYOUT_BUILT[key] || (LAYOUT_BUILT[key] = buildLayout(c.layout || 'grid', !!c.flip)); }
const streetsOf = (t = VIEW_TOWN) => layoutOf(t).streets;
function myTown() { return townOfLot(S && S.lots.find(l => l.id === 'me')); }
function townOf(id) { const l = lotOf(id); return l ? townOfLot(l) : HOME_TOWN; }
function setViewTown(t) { VIEW_TOWN = COMMUNITIES[t] ? t : HOME_TOWN; ensureNPCs(VIEW_TOWN); }
function lotOf(id) {
  const l = (S && S.lots || []).find(x => x.id === id);
  if (l) return l;
  const i = id ? id.indexOf(':') : -1;
  return i < 0 ? npcLots(HOME_TOWN).find(x => x.id === id) : npcLots(id.slice(0, i)).find(x => x.id === id);
}
const slotOf = lotOf;
// Where a home's lot starts in the world (world tiles), and how wide it is (16 + bought parcels × 4).
function lotOrigin(id) { const l = lotOf(id); if (!l) return [0, 0]; const st = streetsOf(townOfLot(l))[l.st]; return st ? [st.x + l.p * PARCEL, st.y] : [0, 0]; }
function lotW(id) { const l = lotOf(id); return l ? l.n * PARCEL : LOT_W; }
const homeW = h => lotW(h.id);
function allLots(t = VIEW_TOWN) { return [...(S ? S.lots.filter(l => townOfLot(l) === t) : []), ...npcLots(t)]; }
function parcelOwner(st, p, t = VIEW_TOWN) { const l = allLots(t).find(x => x.st === st && p >= x.p && p < x.p + x.n); return l ? l.id : null; }
// Runs of empty parcels on every street of a community: [{ st, p, n }]. Cached until somebody's land changes.
let RUNS = { key: '', runs: [] };
function vacantRuns(t = VIEW_TOWN) {
  const key = t + '|' + S.lots.map(l => townOfLot(l) + l.st + l.p + ',' + l.n).join('|');
  if (RUNS.key !== key) RUNS = { key, runs: computeRuns(t) };
  return RUNS.runs;
}
function computeRuns(t) {
  const out = [];
  Object.entries(streetsOf(t)).forEach(([st, s]) => {
    let p = 0;
    while (p < s.n) {
      if (parcelOwner(st, p, t)) { p++; continue; }
      const p0 = p;
      while (p < s.n && !parcelOwner(st, p, t)) p++;
      out.push({ st, p: p0, n: p - p0 });
    }
  });
  return out;
}
// First empty spot big enough for a home, on your own street first.
// The land right next to your home stays free as long as possible, so you can keep buying it.
function freeRun() {
  const runs = vacantRuns(myTown()).filter(r => r.n >= CORE_PARCELS), mine = lotOf('me');
  const nextToMe = r => !!mine && r.st === mine.st && r.p === mine.p + mine.n;
  const SS = streetsOf(myTown()), dist = r => Math.abs(SS[r.st].y - (mine && SS[mine.st] ? SS[mine.st].y : 0));
  runs.sort((a, b) => nextToMe(a) - nextToMe(b) || (SS[a.st].nb !== 'maple') - (SS[b.st].nb !== 'maple') || dist(a) - dist(b));
  const r = runs[0];
  if (!r) return null;
  return nextToMe(r) ? { st: r.st, p: r.p + r.n - CORE_PARCELS, n: CORE_PARCELS } : r;
}
const nbOf = id => NEIGHBORHOODS[(streetsOf(townOf(id))[lotOf(id).st] || { nb: 'maple' }).nb];
const round50 = v => Math.round(v / 50) * 50;
// The next parcel to the right of your home: each one costs more than the last.
function canExpand(id = 'me') { const l = lotOf(id), p = l.p + l.n; return p < streetsOf(townOfLot(l))[l.st].n && !parcelOwner(l.st, p, townOfLot(l)); }
// Land costs more in some communities than others (COMMUNITIES[].price).
const townPrice = t => (COMMUNITIES[t] || COMMUNITIES[HOME_TOWN]).price;
function parcelCost(id = 'me') { const l = lotOf(id); return { coins: round50(LAND.parcel * Math.pow(LAND.grow, l.n - CORE_PARCELS) * nbOf(id).price * townPrice(townOfLot(l))) }; }
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
function moveCost(st, t = VIEW_TOWN) { return { coins: round50(LAND.move * CORE_PARCELS * NEIGHBORHOODS[streetsOf(t)[st].nb].price * townPrice(t)) }; }
// Moving your home to empty land, in this community or another one (t).
function relocate(st, p, t = VIEW_TOWN) {
  for (let k = 0; k < CORE_PARCELS; k++) if (p + k >= streetsOf(t)[st].n || parcelOwner(st, p + k, t)) return { r: 'taken' };
  const c = moveCost(st, t);
  if (!canAfford(c)) return { r: 'poor' };
  const l = lotOf('me'), refund = Math.round((l.paid || 0) * LAND.refund);
  pay(c);
  S.me.coins += refund;
  Object.assign(l, { st, p, n: CORE_PARCELS, paid: 0 });
  if (t === HOME_TOWN) delete l.town; else l.town = t;
  fixLayout(S.me);
  return { r: 'ok', refund };
}
// A tiny seeded random generator, so strangers' homes look the same every time.
function seeded(seed) { let s = seed % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function genNPCs() { NPCS = []; NPC_DONE = {}; ensureNPCs(HOME_TOWN); }
let NPC_DONE = {};
function ensureNPCs(t) {
  if (NPC_DONE[t]) return;
  NPC_DONE[t] = true;
  const ti = Object.keys(COMMUNITIES).indexOf(t), off = t === HOME_TOWN ? 0 : 104729 * (ti + 1);
  NPCS.push(...npcLots(t).map((spec, i) => {
    const r = seeded(9001 + i * 7919 + off), pick = a => a[Math.floor(r() * a.length)], farm = streetsOf(t)[spec.st].nb === 'farm';
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
    if (t !== HOME_TOWN) { p.house = Math.floor(r() * HOUSES.length); p.name = NPC_NAMES[(i + ti * 3) % NPC_NAMES.length]; }
    const h = homeFromPreset(p);
    h.npc = true; h.town = t;
    relayoutYard(h);
    // the extra land of a bigger lot: a garden with trees, a pool or a swing set
    for (let k = 0; k < (spec.n - CORE_PARCELS) * 3; k++) autoPlace(h, 'yard', pick(['tree', 'pine', 'flowers', 'hedge', 'fountain', 'pool', 'picnic', 'trampoline', 'windmill']));
    h.animals.filter(isPet).forEach(a => setupPet(a, null, h));
    showOffExclusives(h);
    return h;
  }));
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
  return (S.today.restDay ? Math.max(1, m) : m) * (S.sick ? SICK.earn : 1);   // real rest day: nothing discounted; ill in the game (v0.14): a bit less
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
    const sp = w.sport && SPORT_BY_ID[w.sport] ? w.sport : SPORT_OF_TYPE[w.type] || 'other';   // one more for this sport's trophy
    S.stats.sports = S.stats.sports || {}; S.stats.sports[sp] = (S.stats.sports[sp] || 0) + 1;
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
// sport: the exact Apple Watch workout type (SPORTS), when known.
function addWorkout(type, min, sport) {
  const kcal = Math.round(min * WORKOUTS[type].kcal);
  const w = { id: uid(), type, min, kcal, at: now(), sport };
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
    if (!t.workouts.some(x => x.id === w.id)) t.workouts.push({ id: w.id, type: WORKOUTS[w.type] ? w.type : 'walk', min: Math.round(w.min || 0), kcal: Math.round(w.kcal || 0), at: w.start || now(), sport: SPORT_BY_RAW[w.sport] });
  });
  if (d.sleep && (d.sleep.asleep > 0 || d.sleep.score != null)) setSleep(d.sleep);
  S.vitals = { resp: d.resp || S.vitals.resp, rhr: d.rhr || S.vitals.rhr, hrv: d.hrv || S.vitals.hrv };
  processHealth();
}

// ---------- crops ----------
function cropProg(f) { return f ? Math.min(1, (now() - f.at) / (CROPS[f.crop].grow * MIN)) : 0; }
function cropStage(f) { const p = cropProg(f); return p >= 1 ? 4 : p >= 0.65 ? 3 : p >= 0.35 ? 2 : p >= 0.1 ? 1 : 0; }
function isRipe(f) { return !!f && cropProg(f) >= 1; }
// Farm areas can be moved around the yard (v0.15): each home keeps where its pasture, fields, orchard and pond are
// (h.areaAt[key] = [x, y], the top-left tile); without that, the usual spot in AREA.
const MOVABLE = ['pasture', 'fields', 'orchard', 'pond'];
function areaOf(h, k) { const A = AREA[k], at = h && h.areaAt && h.areaAt[k]; return at ? { x: at[0], y: at[1], w: A.w, d: A.d } : A; }
function fieldPos(i, h = S.me) { const A = areaOf(h, 'fields'); return [A.x + i % 4, A.y + Math.floor(i / 4)]; }
function orchardSlot(h, i) { const A = areaOf(h, 'orchard'), o = AREA.orchard; return [ORCHARD_SLOTS[i][0] - o.x + A.x, ORCHARD_SLOTS[i][1] - o.y + A.y]; }

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
// Caught by a guard dog: you pay the owner a small fine (twice what you tried to take, 🪙10–60) and that dog
// won't let you in again today. It's a prank with a price, not a loss of anything you grew.
function dogFine(value) { return clamp(Math.round(value * 2), STEAL_FINE[0], STEAL_FINE[1]); }
// v0.18: a neighbour may see you too ('witness'); a baby animal, or the 3rd time in 7 days, brings the police.
function catchRoll(h, dogChance) { return hasGuardDog(h) && Math.random() < dogChance ? 'dog' : Math.random() < POLICE.witness ? 'witness' : null; }
function caught(fid, value, how = 'dog', baby = false) {
  const f = friendById(fid);
  S.record = (S.record || []).filter(r => now() - r.t < POLICE.strikeDays * DAY);
  S.record.push({ t: now(), fid, baby });
  const police = baby || S.record.length >= POLICE.strikes;
  const fine = Math.min(S.me.coins, police ? clamp(Math.round(value * POLICE.fineMult), POLICE.fineMin, POLICE.fineMax) : dogFine(value));
  S.me.coins -= fine; f.coins += fine;
  S.today.chased = S.today.chased || {};
  S.today.chased[fid] = true;
  if (police) {
    S.jail = { start: now(), end: now() + POLICE.jailMin * MIN, fid, fine, why: baby ? 'baby' : 'repeat' };
    S.stats.jailed = (S.stats.jailed || 0) + 1;
    S.record = [];   // a fresh start after the police
  }
  return { r: police ? 'police' : how, fine, by: how };
}
// In the holding cell right now (until the time is up or you pay bail).
const jailed = () => !!(S && S.jail && !S.jail.out && now() < S.jail.end);
function jailTick() { if (S.jail && !S.jail.out && now() >= S.jail.end) { S.jail.out = true; return true; } return false; }
function payBail() {
  if (!jailed()) return 'no';
  if (S.me.coins < POLICE.bail) return 'poor';
  S.me.coins -= POLICE.bail; S.jail.out = true; S.jail.bail = true;
  return 'ok';
}
const strikes = () => (S.record || []).filter(r => now() - r.t < POLICE.strikeDays * DAY).length;
// Shared checks for every kind of sneaking. Returns an error code or null.
function sneakCheck(fid) {
  if (fid && S.today.chased && S.today.chased[fid]) return 'chased';
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
  const err = sneakCheck(fid); if (err) return { r: err };
  f.thieves.push('me');
  { const c = catchRoll(h, 0.35); if (c) return caught(fid, stealSize(f.crop) * CROPS[f.crop].sell, c); }
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
  const err = sneakCheck(fid); if (err) return { r: err };
  a.thieves.push('me');
  { const c = catchRoll(h, 0.35); if (c) return caught(fid, GOODS[ANIMALS[a.k].prod].sell, c); }
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
  const err = sneakCheck(fid); if (err) return { r: err };
  t.thieves.push('me');
  { const c = catchRoll(h, 0.35); if (c) return caught(fid, GOODS[TREES[t.k].fruit].sell, c); }
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
    if (dog) { const n = dogFine(stealSize(f.crop) * CROPS[f.crop].sell); S.me.coins += n; return addFeed({ kind: 'caught', from: fid, k: f.crop, n }); }
    const n = Math.min(f.left - stealKeep(f.crop), stealSize(f.crop));
    f.left -= n;
    return addFeed({ kind: 'stole', from: fid, k: f.crop, n });
  }
  const a = rand(eggs);
  a.thieves = [...(a.thieves || []), fid];
  if (dog) { const n = dogFine(GOODS[ANIMALS[a.k].prod].sell); S.me.coins += n; return addFeed({ kind: 'caught', from: fid, k: ANIMALS[a.k].prod, n }); }
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
  const A = areaOf(h, 'pasture');
  return p ? { x: A.x, y: A.y + A.d - p.d, w: p.w, d: p.d } : null;
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
// Weather on the farm (v0.14), run every second: rain helps, heavy rain and storms can flood fields, snow slows growth.
const isFlooded = f => !!(f && f.flood && f.flood > now());
function weatherFarm(ms) {
  const w = weatherNow(), k = w.kind, heavy = k === 'storm' ? 'storm' : w.heavy ? 'heavy' : null, hrs = ms / HOUR;
  let flooded = 0;
  [S.me, ...S.friends].forEach(h => h.fields.forEach(f => {
    if (!f) return;
    if (isFlooded(f)) {   // under water: nothing grows, and a ripe crop spoils bit by bit
      f.at += ms;
      if (isRipe(f) && f.left > 1) { f.rot = (f.rot || 0) + hrs; if (f.rot >= WEATHER_FARM.rotHours) { f.left--; f.rot = 0; } }
      return;
    }
    if (heavy && Math.random() < WEATHER_FARM.flood[heavy] * hrs) { f.flood = now() + WEATHER_FARM.floodHours * HOUR; if (h === S.me) flooded++; return; }
    if (isRipe(f)) return;
    if (k === 'rain' || k === 'storm') f.at -= ms * WEATHER_FARM.rainGrow;
    else if (k === 'snow') f.at += ms * WEATHER_FARM.snowSlow;
  }));
  if (flooded) S.floodNews = (S.floodNews || 0) + flooded;
}
const rainGrow = weatherFarm;

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
  // the flight up runs along the back wall, rising to the right; you step onto it from the tile on its left
  if (lv < n - 1) out.push({ kind: 'up', x: rw - 2, y: 0, w: 2, d: 1, ax: rw - 3, ay: 0 });
  // the way down is the opening right in front of it; you step in from the tile in front of its right end
  if (lv > 0) out.push({ kind: 'down', x: rw - 2, y: 1, w: 2, d: 1, ax: rw - 1, ay: 2 });
  return out;
}
// Tiles the stairs need: the stairs themselves plus the free tile you step on from.
const stairsTiles = (h, lv) => stairsRects(h, lv).flatMap(r => [r, { x: r.ax, y: r.ay, w: 1, d: 1 }]);
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
  const down = st.find(r => r.kind === 'down'), entry = down ? [down.ax, down.ay] : [0, rd - 1];
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
    && st.every(r => ok(r.ax, r.ay));
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
function yardReserved(x, y, w = LOT_W, h = S.me) {
  if (x < 0 || y < 0 || x >= w || y >= LOT_D) return true;
  if (x === MAILBOX[0] && y === MAILBOX[1]) return true;
  return ['house', 'drive', 'path'].some(k => inRect(AREA[k], x, y)) || MOVABLE.some(k => inRect(areaOf(h, k), x, y)) || inRect(PORCH, x, y);
}
function canPlace(h, scope, k, x, y, rot, ignoreId, lv, list) {
  const def = itemDef(scope, k);
  const [w, d] = rot ? [def.d, def.w] : [def.w, def.d];
  PLACE_WHY = 'space';
  if (scope === 'room') {
    const [rw, rd] = roomSize(h);
    if (x < 0 || y < 0 || x + w > rw || y + d > rd) return false;
    if (stairsTiles(h, lv).some(r => overlaps(r, x, y, w, d))) return false;
  } else {
    const lw = homeW(h);
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (yardReserved(x + i, y + j, lw, h)) return false;
  }
  const others = (list || scopeItems(h, scope, lv)).filter(it => it.id !== ignoreId);
  for (const it of others) {
    if (scope === 'room' && !!itemDef(scope, it.k).flat !== !!def.flat) continue; // rugs can sit under furniture
    const [iw, id] = itemSize(scope, it);
    if (x < it.x + iw && x + w > it.x && y < it.y + id && y + d > it.y) return false;
  }
  if (scope === 'room' && !def.flat && !roomReachable(h, lvOf(h, lv), [...others, { k, x, y, rot }])) { PLACE_WHY = 'block'; return false; }
  if (scope === 'yard' && typeof yardKeepsWay === 'function' && !yardKeepsWay(h, [...others, { k, x, y, rot, id: '_new' }])) { PLACE_WHY = 'block'; return false; }   // v0.13
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
function yardSpots(w = LOT_W, h = S.me) {
  const key = w + '|' + JSON.stringify((h && h.areaAt) || {});
  if (!YARD_SPOTS[key]) {
    const out = [];
    for (let y = 0; y < LOT_D; y++) for (let x = 0; x < w; x++) if (!yardReserved(x, y, w, h)) out.push([x, y]);
    YARD_SPOTS[key] = out;
  }
  return YARD_SPOTS[key];
}

function autoPlace(h, scope, k, tint, lv) {
  const def = itemDef(scope, k);
  const spots = scope === 'room' ? roomSpots(h, def.flat) : yardSpots(homeW(h), h);
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
  if (d.pet) return 'pet';   // dogs and cats are adopted by breed (adoptPet)
  if (d.excl && !exclOK(d.excl, h)) return 'locked';
  if (!h.pastureLv) return 'nopasture';
  else if (pastureCount(h) >= pastureCap(h)) return 'full';
  if (h.coins < d.price) return 'poor';
  h.coins -= d.price;
  h.animals.push(newAnimal(k, 0));
  return 'ok';
}
// ---------- pets (v0.8) ----------
// Dogs and cats are animals with pet: true. Each gets a breed, a name and care needs (food, water, clean, love)
// that drop slowly in real hours. Nothing bad happens when they run low: the pet looks sad and asks for you.
const isPet = a => !!(ANIMALS[a.k] && ANIMALS[a.k].pet);
const myPets = (h = S.me) => h.animals.filter(isPet);
function hasFurn(h, k) {
  return [h.room, ...(h.ups || [])].some(r => r.items.some(i => i.k === k)) || (h.store && h.store['room:' + k] > 0);
}
function setupPet(a, breed, h) {
  if (!a.breed || !PET_BREEDS[a.breed]) {
    const list = Object.keys(PET_BREEDS).filter(b => PET_BREEDS[b].kind === a.k);
    a.breed = breed || (h && h.id !== 'me' ? list[Math.floor(hash(a.id.length + a.id.charCodeAt(0), 3) * list.length)] : list[0]);
  }
  if (!a.name) {
    const names = PET_NAMES[a.k][curLang()], taken = h ? myPets(h).map(p => p.name) : [];
    a.name = names.find(n => !taken.includes(n)) || names[0];
  }
  if (!a.care) a.care = { food: 90, water: 90, clean: 90, love: 75, at: now(), warned: {} };
  return a;
}
// The needs right now (they keep dropping between visits).
function petCare(a) {
  const c = a.care || { food: 100, water: 100, clean: 100, love: 100, at: now() }, hrs = Math.max(0, now() - c.at) / 3600000, v = {};
  for (const k in PET_NEEDS) v[k] = clamp(c[k] - hrs * 100 / PET_NEEDS[k].hours, 0, 100);
  return v;
}
function petMood(a) {
  if (!a.care) return 'happy';
  const v = petCare(a), m = Math.min(...Object.values(v));
  return m > 60 ? 'happy' : m > PET_REMIND ? 'ok' : 'sad';
}
const petAsks = a => (a.care ? Object.entries(petCare(a)).filter(([, n]) => n <= PET_REMIND).map(([k]) => k) : []);
function adoptPet(breed, h = S.me) {
  const B = PET_BREEDS[breed];
  if (!B) return { r: 'none' };
  if (B.excl && !exclOK(B.excl, h)) return { r: 'locked' };
  if (myPets(h).length >= PET_MAX) return { r: 'full' };
  if (h.coins < B.price) return { r: 'poor' };
  h.coins -= B.price;
  const a = setupPet(newAnimal(B.kind, 0), breed, h);
  a.care = { food: 100, water: 100, clean: 100, love: 80, at: now(), warned: {} };
  h.animals.push(a);
  h.petFood = h.petFood || {};
  h.petFood[B.kind + 'food'] = (h.petFood[B.kind + 'food'] || 0) + PET_START_FOOD;
  // the first dog or cat comes with its bowls (and a cat with a litter box)
  if (!hasFurn(h, 'petbowl')) autoPlace(h, 'room', 'petbowl', null, 0);
  if (B.kind === 'cat' && !hasFurn(h, 'litterbox')) autoPlace(h, 'room', 'litterbox', null, 0);
  return { r: 'ok', a };
}
function buyPetFood(k, h = S.me) {
  const f = PET_FOOD[k];
  if (!f) return 'none';
  if (h.coins < f.price) return 'poor';
  h.coins -= f.price;
  h.petFood = h.petFood || {};
  h.petFood[k] = (h.petFood[k] || 0) + f.n;
  return 'ok';
}
// Looking after a pet: food (uses a meal), water, clean (scoop the litter / a walk), pet, play, treat (uses a treat).
function careFor(id, act, h = S.me) {
  const a = h.animals.find(x => x.id === id && isPet(x));
  if (!a) return 'none';
  setupPet(a, null, h);
  const v = petCare(a), food = a.k + 'food';
  h.petFood = h.petFood || {};
  if (act === 'food') { if (!(h.petFood[food] > 0)) return 'nofood'; h.petFood[food]--; v.food = 100; v.love = Math.min(100, v.love + 5); }
  else if (act === 'water') v.water = 100;
  else if (act === 'clean') { v.clean = 100; if (a.k === 'dog') v.love = Math.min(100, v.love + 10); }
  else if (act === 'treat') { if (!(h.petFood.treats > 0)) return 'nofood'; h.petFood.treats--; v.love = Math.min(100, v.love + PET_LOVE.treat); v.food = Math.min(100, v.food + 10); }
  else if (PET_LOVE[act]) v.love = Math.min(100, v.love + PET_LOVE[act]);
  else return 'none';
  a.care = { ...v, at: now(), warned: Object.fromEntries(Object.entries(a.care.warned || {}).filter(([k]) => v[k] <= PET_REMIND)) };
  S.stats.petCare = (S.stats.petCare || 0) + 1;
  return 'ok';
}
// New things your pets are asking for (each need is told once until you look after it). Your friends' pets are always fine.
function petNews() {
  const out = [];
  myPets().forEach(a => {
    if (!a.care) return;
    a.care.warned = a.care.warned || {};
    petAsks(a).forEach(k => { if (!a.care.warned[k]) { a.care.warned[k] = true; out.push({ a, need: k }); } });
  });
  return out;
}
// When each pet will next need something, for phone reminders (game time, ms).
function petSchedule() {
  const out = [];
  myPets().forEach(a => {
    if (!a.care) return;
    const v = petCare(a);
    for (const k in PET_NEEDS) {
      const h = (v[k] - PET_REMIND) / (100 / PET_NEEDS[k].hours);
      if (h > 0) out.push({ id: a.id + '-' + k, pet: a.id, need: k, at: now() + h * 3600000 });
    }
  });
  return out;
}
// ---------- trophies (v0.10) ----------
// Streaks count today as soon as today's target is reached; finished days are in S.stats.cur_* / best_*.
// Friends and other players: made up from their id for now (the server will have their real ones).
const SIM_TROPHY = {};
function simTrophyStats(h) {
  if (SIM_TROPHY[h.id]) return SIM_TROPHY[h.id];
  const r = seeded(7 + [...h.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 99991, 0)), fit = (h.likes || 0) > 10 || r() < 0.45;
  const streak = { steps10k: Math.floor(r() * (fit ? 40 : 12)), steps20k: Math.floor(r() * (fit ? 18 : 4)), rings: Math.floor(r() * (fit ? 60 : 10)) };
  const sports = {};
  for (let k = 0; k < 3 + Math.floor(r() * 6); k++) { const s = SPORTS[Math.floor(r() * SPORTS.length)]; sports[s.id] = Math.floor(r() * (fit ? 70 : 15)); }
  const awards = Object.keys(AWARDS).filter(() => r() < (fit ? 0.45 : 0.12));
  return (SIM_TROPHY[h.id] = { streak, sports, awards });
}
function streakNow(id, h = S.me) {
  if (h !== S.me) return simTrophyStats(h).streak[id];
  const st = S.stats, d = S.today, met = id === 'rings' ? !!d.paid.rings.all : d.steps + d.pushes >= STREAK_TROPHIES[id].need;
  return (st['cur_' + id] || 0) + (met ? 1 : 0);
}
function streakBest(id, h = S.me) { return h !== S.me ? simTrophyStats(h).streak[id] : Math.max(S.stats['best_' + id] || 0, streakNow(id)); }
function sportCount(id, h = S.me) { return h === S.me ? (S.stats.sports || {})[id] || 0 : simTrophyStats(h).sports[id] || 0; }
// How many tiers of a trophy someone has (0–3) and what the next one needs.
function trophyLevel(id, h = S.me) {
  const T = STREAK_TROPHIES[id], v = T ? streakBest(id, h) : sportCount(id, h);
  return (T ? T.tiers : SPORT_TIERS).filter(n => v >= n).length;
}
const trophyValue = (id, h = S.me) => (STREAK_TROPHIES[id] ? streakBest(id, h) : sportCount(id, h));
const allTrophyIds = () => [...Object.keys(STREAK_TROPHIES), ...SPORTS.map(s => s.id)];
const trophyCount = (h = S.me) => allTrophyIds().reduce((a, id) => a + trophyLevel(id, h), 0);
// May this home buy the exclusive with this key ("trophy:tier" or "g:group")?
function exclOK(key, h = S.me) {
  if (!key) return true;
  const [a, b] = key.split(':');
  if (a === 'g') return SPORTS.some(s => s.group === b && trophyLevel(s.id, h) >= 3);
  if (a === 'aw') return awardsOf(h).includes(b);
  return trophyLevel(a, h) > +b;
}
const exclDef = (kind, k) => (kind === 'yard' ? YARD[k] : kind === 'car' ? CARS[k] : kind === 'pet' ? PET_BREEDS[k] : ANIMALS[k]);
// The trophy case shows one cup per trophy tier (up to 12).
function placeTrophyCase(h) {
  const n = trophyCount(h);
  if (!n) return;
  if (!hasFurn(h, 'trophycase')) autoPlace(h, 'room', 'trophycase', null, 0);
  [h.room, ...(h.ups || [])].forEach(r => r.items.forEach(it => { if (it.k === 'trophycase') it.cups = Math.min(12, n); }));
}
// Trophy tiers you've just earned (each is shown once).
function trophyNews() {
  S.trophySeen = S.trophySeen || {};
  const out = [];
  checkAwards().forEach(id => { if (!S.trophySeen['aw:' + id]) { S.trophySeen['aw:' + id] = 1; out.push({ award: id }); } });
  allTrophyIds().forEach(id => {
    const lv = trophyLevel(id), seen = S.trophySeen[id] || 0;
    for (let t = seen; t < lv; t++) out.push({ id, tier: t });
    if (lv > seen) S.trophySeen[id] = lv;
  });
  if (out.length) placeTrophyCase(S.me);
  return out;
}
// Friends and strangers show off too: a trophy case and an exclusive or two they've unlocked.
function showOffExclusives(h) {
  placeTrophyCase(h);
  EXCLUSIVES.filter(([kind, k]) => kind === 'yard' && exclOK(YARD[k].excl, h)).slice(-2).forEach(([, k]) => { if (!h.yard.some(i => i.k === k)) autoPlace(h, 'yard', k); });
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
  if (d.excl && !exclOK(d.excl, h)) return { r: 'locked' };
  if (h.coins < d.price) return { r: 'poor' };
  h.coins -= d.price;
  return { r: 'ok', item: autoPlace(h, scope, k) };
}
function buyCar(k, h = S.me) {
  if (h.cars.some(c => c.k === k)) return 'own';
  if (CARS[k].excl && !exclOK(CARS[k].excl, h)) return 'locked';
  const c = CARS[k].cost;
  if (!canAfford(c, h)) return 'poor';
  pay(c, h);
  h.cars.push({ k, color: CARS[k].color || (h === S.me ? CARS[k].look || CAR_COLORS[0] : rand(CAR_COLORS)) });
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
  S.lots.push({ id: next.id, st: run.st, p: run.p, n: CORE_PARCELS, paid: 0, ...(myTown() !== HOME_TOWN ? { town: myTown() } : {}) });   // friends move in next to you
  S.friends.push(homeFromPreset(next));
  return addFeed({ kind: 'join', from: next.id, gift: { type: 'wood', n: 5 } });
}

// ---------- local time, who's online, who's visiting (v0.11) ----------
// Every community has its own day and night. Your own community follows your phone's clock; the others follow
// their real time zone (with summer time): Kyoto is asleep while California has lunch.
let SCENE_TOWN = HOME_TOWN;   // the community on screen right now (the scene sets it every frame)
const TZ_FMT = {};
function localHM(t, ms = now()) {
  const c = COMMUNITIES[t];
  if (!c || !c.tz || (S && t === myTown())) { const d = new Date(ms); return [d.getHours(), d.getMinutes()]; }
  const m = Math.floor(ms / MIN), o = TZ_FMT[c.tz] || (TZ_FMT[c.tz] = { m: -1, v: [12, 0], f: null });
  if (o.m === m) return o.v;
  try {
    o.f = o.f || new Intl.DateTimeFormat('en-US', { timeZone: c.tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
    const p = o.f.formatToParts(new Date(ms)), g = k => +((p.find(x => x.type === k) || {}).value) || 0;
    o.v = [g('hour') % 24, g('minute')];
  } catch (e) { o.v = [(new Date(ms).getUTCHours() + Math.round(c.lon / 15) + 24) % 24, new Date(ms).getUTCMinutes()]; }
  o.m = m;
  return o.v;
}
const localHour = (t, ms) => { const [h, m] = localHM(t, ms); return h + m / 60; };
const localClock = (t, ms) => { const [h, m] = localHM(t, ms); return `${h}:${String(m).padStart(2, '0')}`; };
const isNightIn = t => { const h = localHour(t); return h < 6 || h >= 19.5; };
// A steady number for an id (for made-up but repeatable things).
function idNum(id) { let n = 7; for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 100003; return n; }
// Online right now? Made up until the server exists (it changes every 20 minutes): friends about half the
// time, other people a bit less, and hardly anyone in the middle of their night.
function isOnline(id) {
  if (id === 'me') return true;
  const k = hash(idNum(id) * 0.013, Math.floor(now() / (20 * MIN))), hr = localHour(townOf(id));
  if (hr < 6.5 || hr >= 23.5) return k < 0.05;
  return k < (isFriend(id) ? ONLINE_SHARE.friend : ONLINE_SHARE.other);
}
// Who is visiting whom in a community right now (every 15 minutes some online people go round to a neighbour;
// your friends like to come to you). { host: [visitor ids] } and the other way round.
let VISITS = { key: '', by: {}, at: {} };
function visitsIn(t) {
  const slot = Math.floor(now() / (15 * MIN)), key = t + '|' + slot + '|' + S.lots.length + '|' + S.friends.length;
  if (VISITS.key === key) return VISITS;
  const by = {}, at = {}, r = seeded(slot * 131 + idNum(t)), mine = t === myTown();
  const ids = allLots(t).map(l => l.id).filter(x => x !== 'me' && homeOf(x));
  ids.forEach(id => {
    const k = r(), k2 = r(), k3 = r();
    if (!isOnline(id) || k > VISIT_SHARE) return;
    const host = mine && isFriend(id) && k2 < 0.6 ? 'me' : ids[Math.floor(k3 * ids.length)];
    if (!host || host === id || at[host] || by[id]) return;   // someone who has a visitor stays home
    (by[host] = by[host] || []).push(id); at[id] = host;
  });
  VISITS = { key, by, at };
  return VISITS;
}
const visitorsAt = id => visitsIn(townOf(id)).by[id] || [];
const visitingNow = id => visitsIn(townOf(id)).at[id] || null;
// Popular homes out in the world get crowds (far more than we could draw): only for other communities.
function crowdAt(id) {
  const t = townOf(id), hr = localHour(t);
  if (id === 'me' || t === myTown() || hash(idNum(id) * 0.017, 5) < 0.75 || hr < 7 || hr >= 23.5) return 0;
  const day = Math.sin((hr - 7) / 16.5 * Math.PI);   // busiest in their afternoon and evening
  return Math.round((12 + hash(idNum(id) * 0.019, Math.floor(now() / (15 * MIN))) * 280) * day);
}
// House rules: in someone else's home you can't sit, lie down or eat unless they said yes (asked while they're
// online and at home). A yes lasts for this visit.
const HOST_OK = {};
const canUseAt = id => id === 'me' || (HOST_OK[id] || 0) > Date.now();
function askHost(id) {
  if (!isOnline(id) || visitingNow(id)) return 'away';
  const yes = hash(idNum(id) * 0.023, Math.floor(Date.now() / (10 * MIN))) < ASK_YES;
  if (yes) HOST_OK[id] = Date.now() + 40 * MIN;
  return yes ? 'yes' : 'no';
}
function leaveHost(id) { delete HOST_OK[id]; }
// A made-up visitor in a popular home's crowd (no home of their own to tap through to).
const CROWD = {};
function crowdPerson(host, k) {
  const key = host + ':' + k;
  if (CROWD[key]) return CROWD[key];
  const r = seeded(idNum(key) * 7 + 3), pick = a => a[Math.floor(r() * a.length)];
  return (CROWD[key] = { id: 'crowd', name: pick(NPC_NAMES), look: dressUp({ shirt: pick(COLORS), skin: pick(SKINS), hair: pick(HAIRS), hairCol: pick(HAIR_COLORS), mob: r() < 0.08 ? 'wheel' : 'walk' }, key) });
}

// ---------- public places (v0.12) ----------
function placeDay() { const d = S.today; d.place = d.place || { cards: {} }; return d.place; }
// The town fields: today's helps from everyone (made up for the neighbours, growing through the local day) + yours.
function harvestCount(t = myTown()) {
  const P = placeDay(), hr = localHour(t), k = hash(idNum(t) * 0.031, Math.floor(now() / DAY));
  const others = hr < 7 ? 0 : Math.floor(Math.min(1, (hr - 7) / 12) * HARVEST_GOAL * (0.55 + k * 0.4));
  return Math.min(HARVEST_GOAL, others + (P.harvest ? 1 : 0));
}
function helpHarvest() {
  const P = placeDay();
  if (P.harvest) return { r: 'done' };
  if (!useAction()) return { r: 'nojobs' };
  P.harvest = true;
  addBarn(S.me, 'wheat', HELP_HARVEST.wheat);
  const fest = harvestCount() >= HARVEST_GOAL && !P.fest;
  if (fest) { P.fest = true; addBarn(S.me, 'bread', 1); }
  return { r: 'ok', fest };
}
function bakeBread() {
  if ((S.me.barn.wheat || 0) < BREAD.wheat) return 'nowheat';
  S.me.barn.wheat -= BREAD.wheat;
  if (!S.me.barn.wheat) delete S.me.barn.wheat;
  addBarn(S.me, 'bread', 1);
  S.stats.baked = (S.stats.baked || 0) + 1;
  return 'ok';
}
function lakeFish() {
  const P = placeDay();
  if (P.fish) return { r: 'done' };
  if (weatherNow().kind === 'snow') return { r: 'frozen' };   // v0.14: the water is frozen
  if (!useAction()) return { r: 'nojobs' };
  P.fish = true;
  let r = Math.random(), k = FISH_KINDS[0][0];
  for (const [kind, p] of FISH_KINDS) { if (r < p) { k = kind; break; } r -= p; }
  addBarn(S.me, k, LAKE_FISH);
  return { r: 'ok', k };
}
// A walk in the park: every dog gets its daily walk and some play.
function parkWalk() {
  const dogs = myPets(S.me).filter(a => a.k === 'dog');
  dogs.forEach(a => { careFor(a.id, 'clean'); careFor(a.id, 'play'); });
  placeDay().park = true;
  return dogs.length;
}
function sendPostcard(id) {
  const P = placeDay();
  if (P.cards[id]) return 'done';
  P.cards[id] = true;
  S.stats.postcards = (S.stats.postcards || 0) + 1;
  return 'ok';
}
const libCard = () => LIB_CARDS[Math.floor(now() / DAY) % LIB_CARDS.length];
function readLib() {
  const P = placeDay();
  if (P.lib) return 'done';
  P.lib = true;
  S.stats.libRead = (S.stats.libRead || 0) + 1;
  return 'ok';
}

// ---------- awards (v0.12): Apple Watch-style medals for special days and milestones ----------
function awardsOf(h = S.me) { return h === S.me ? Object.keys(S.stats.awards || {}) : simTrophyStats(h).awards || []; }
// Some awards are decided when a day ends (the whole day counts): totals, the month, the weekend, a perfect week.
function closeDayAwards(y) {
  const st = S.stats, steps = y.steps + y.pushes, d = new Date(y.date.replace(/-/g, '/')), mk = d.getFullYear() + '-' + (d.getMonth() + 1), dow = d.getDay();
  st.totalSteps = (st.totalSteps || 0) + steps;
  st.bestSteps = Math.max(st.bestSteps || 0, steps);
  if (!st.month || st.month.key !== mk) st.month = { key: mk, days: 0 };
  if (steps >= AWARD_RULES.monthSteps) st.month.days++;
  const worked = (y.workouts || []).length > 0;
  if (dow === 6 && worked) st.satWorkout = y.date;
  st.awards = st.awards || {};
  if (dow === 0 && worked && st.satWorkout && dayKey(d.getTime() - DAY) === st.satWorkout) st.awards.weekend = st.awards.weekend || y.date;
  if (dow === 0 && st.cur_rings >= 7) st.awards.perfectweek = st.awards.perfectweek || y.date;
  if (st.month.days >= AWARD_RULES.monthDays) st.awards.monthly = st.awards.monthly || y.date;
}
// Awards you can earn during the day. Returns all you have.
function checkAwards() {
  const st = S.stats, d = S.today, A = (st.awards = st.awards || {}), steps = d.steps + d.pushes, k = d.date;
  Object.entries(AWARD_RULES.move).forEach(([id, x]) => { if (d.kcal >= RINGS.move * x) A[id] = A[id] || k; });
  if (steps >= AWARD_RULES.recordMin && steps > (st.bestSteps || 0) && (st.days || 0) > 1) A.newrecord = A.newrecord || k;
  if ((st.totalSteps || 0) + steps >= AWARD_RULES.steps) A.steps1m = A.steps1m || k;
  if ((st.workouts || 0) >= AWARD_RULES.workouts) A.workouts100 = A.workouts100 || k;
  const m = st.month && st.month.key === k.split('-').slice(0, 2).join('-') ? st.month.days : 0;
  if (m + (steps >= AWARD_RULES.monthSteps ? 1 : 0) >= AWARD_RULES.monthDays) A.monthly = A.monthly || k;
  return Object.keys(A);
}

// v0.13: yards whose things block the way get laid out again, once (needs the scene's yard map, so it runs after it).
function relayoutYard(h) {
  if (typeof yardKeepsWay !== 'function' || yardKeepsWay(h, h.yard)) return;
  const items = h.yard.slice().sort((a, b) => (YARD[b.k].w * YARD[b.k].d) - (YARD[a.k].w * YARD[a.k].d));
  h.yard = [];
  items.forEach(it => { const n = autoPlace(h, 'yard', it.k, it.tint); if (n) Object.assign(n, { id: it.id, placed: it.placed, last: it.last }); });
}
function fixBlockedYards() {
  if (!S || typeof yardKeepsWay !== 'function') return;
  NPCS.forEach(relayoutYard);   // made up every time, so always checked
  if (S.yardWayV === 1) return;
  [S.me, ...S.friends].forEach(relayoutYard);
  S.yardWayV = 1;
  save();
}

// ---------- the market (v0.14) ----------
const priceSlot = (ms = now()) => Math.floor(ms / (MARKET.slotHours * HOUR));
// How the price of one thing stands against its usual price in a community (same for everyone, changes every slot).
function priceFactor(k, t = myTown(), slot = priceSlot()) {
  const seed = idNum(k + '|' + t), big = Math.floor(slot / 6), u = (slot - big * 6) / 6, e = u * u * (3 - 2 * u);
  const v = n => hash(seed * 0.013 + n * 0.71, 3.3), smooth = v(big) + (v(big + 1) - v(big)) * e;
  const f = MARKET.min + (MARKET.max - MARKET.min) * (0.1 + 0.8 * smooth) + (hash(seed * 0.017, slot) - 0.5) * MARKET.jitter;
  return clamp(f, MARKET.min, MARKET.max);
}
// Usual price: barn goods (crops, goods, baby animals) or a live animal at its stage.
const usualPrice = k => (k.startsWith('animal_') ? ANIMALS[k.split('_')[1]].sell[+k.split('_')[2]] : barnInfo(k).sell);
const priceKey = k => (k.startsWith('animal_') ? 'animal_' + k.split('_')[1] : k);
function marketPrice(k, slot = priceSlot()) { return Math.max(1, Math.round(usualPrice(k) * priceFactor(priceKey(k), myTown(), slot))); }
function priceTrend(k) { const s = priceSlot(); return Array.from({ length: MARKET.history }, (_, i) => marketPrice(k, s - MARKET.history + 1 + i)); }
// What you carry: barn goods and live animals, up to the room you have (on foot or in your vehicle).
function cargo() { S.cargo = S.cargo || { items: {}, animals: [], cap: 0 }; return S.cargo; }
const cargoSlots = k => (k.startsWith('baby_') ? BABY_SIZE : 1);
function cargoUsed() { const c = cargo(); return Object.entries(c.items).reduce((s, [k, n]) => s + n * cargoSlots(k), 0) + c.animals.reduce((s, a) => s + (ANIMAL_SIZE[a.k] || 5), 0); }
const carryCap = how => (how === 'walk' ? WALK_CARRY : ((CARS[(S.me.cars[S.me.car] || {}).k] || {}).cargo || WALK_CARRY));
// Setting off for the market: fill up with what sells best right now.
function loadCargo(how) {
  const c = cargo(), cap = carryCap(how);
  c.cap = cap;
  let room = cap - cargoUsed(), n = 0;
  const keys = Object.keys(S.me.barn).sort((a, b) => marketPrice(b) / cargoSlots(b) - marketPrice(a) / cargoSlots(a));
  for (const k of keys) {
    while (room >= cargoSlots(k) && S.me.barn[k] > 0) { S.me.barn[k]--; c.items[k] = (c.items[k] || 0) + 1; room -= cargoSlots(k); n++; }
    if (!S.me.barn[k]) delete S.me.barn[k];
  }
  return n;
}
// Take a live animal along to sell it.
function cargoAnimal(id, how) {
  const h = S.me, i = h.animals.findIndex(a => a.id === id), c = cargo();
  if (i < 0) return 'none';
  const a = h.animals[i], cap = Math.max(c.cap || 0, carryCap(how || 'car'));
  if (cargoUsed() + (ANIMAL_SIZE[a.k] || 5) > cap) return 'full';
  c.cap = cap; h.animals.splice(i, 1); c.animals.push(a);
  return 'ok';
}
// Selling at the market (you must be there).
function sellCargo(k, n) {
  const c = cargo();
  if (k.startsWith('animal:')) {
    const i = c.animals.findIndex(a => a.id === k.slice(7));
    if (i < 0) return 0;
    const a = c.animals[i], v = marketPrice('animal_' + a.k + '_' + animalStage(a));
    c.animals.splice(i, 1); S.me.coins += v; S.stats.sold = (S.stats.sold || 0) + v;
    return v;
  }
  n = Math.min(n, c.items[k] || 0);
  if (!n) return 0;
  c.items[k] -= n; if (!c.items[k]) delete c.items[k];
  const v = n * marketPrice(k);
  S.me.coins += v; S.stats.sold = (S.stats.sold || 0) + v;
  return v;
}
function sellAllCargo() { const c = cargo(); return [...Object.keys(c.items).map(k => sellCargo(k, c.items[k])), ...c.animals.map(a => a.id).map(id => sellCargo('animal:' + id))].reduce((a, b) => a + b, 0); }
// Home again: what you didn't sell goes back to the barn (animals back to the pasture if there's room).
function unloadCargo() {
  const c = cargo();
  Object.entries(c.items).forEach(([k, n]) => addBarn(S.me, k, n));
  c.animals.forEach(a => { if (pastureCount() < pastureCap()) S.me.animals.push(a); else addBarn(S.me, 'baby_' + a.k, 1); });
  S.cargo = { items: {}, animals: [], cap: 0 };
}

// ---------- jobs (v0.14) ----------
const jobRank = (rel = (S.job || {}).rel || 0) => JOB_RANKS.filter(r => rel >= r.at).length - 1;
const jobWage = place => Math.round(JOBS[place].wage * JOB_RANKS[S.job && S.job.place === place ? jobRank() : 0].pay);
function shiftEnd(place, ms = now()) { const d = new Date(ms); d.setHours(JOBS[place].to, 0, 0, 0); return d.getTime(); }
function inShift(place, ms = now()) { const h = localHour(myTown(), ms); return h >= JOBS[place].from && h < JOBS[place].to; }
function takeJob(place) { if (S.work) return 'working'; S.job = { place, rel: S.job && S.job.place === place ? S.job.rel : 0, since: now() }; return 'ok'; }
function startShift(place) {
  if (!S.job || S.job.place !== place) return 'nojob';
  if (S.work) return 'working';
  if (!inShift(place)) return 'closed';
  S.work = { place, start: now(), end: shiftEnd(place), wage: jobWage(place) };
  return 'ok';
}
const hoursWorked = w => Math.max(0, (Math.min(now(), w.end) - w.start) / HOUR);
// The shift is over: full pay and a better relationship (and maybe a promotion).
function finishShift() {
  const w = S.work;
  if (!w || now() < w.end) return null;
  const pay = Math.round(hoursWorked(w) * w.wage), before = jobRank();
  S.me.coins += pay; S.work = null;
  S.job.rel = Math.min(JOB_REL.max, S.job.rel + JOB_REL.finish);
  S.today.worked = true; S.stats.workPay = (S.stats.workPay || 0) + pay;
  if ((S.stats.workStreak || 0) + 1 >= SICK.overworkDays && !S.sick && Math.random() < SICK.longShift) S.sick = { since: now(), med: false, why: 'work' };
  return { pay, promoted: jobRank() > before };
}
// Leaving early: only the hours worked, and the boss isn't happy.
function quitShift() {
  const w = S.work;
  if (!w) return null;
  const pay = Math.round(hoursWorked(w) * w.wage);
  S.me.coins += pay; S.work = null;
  S.job.rel = Math.max(0, S.job.rel + JOB_REL.quit);
  S.stats.workPay = (S.stats.workPay || 0) + pay;
  return { pay };
}
// ---------- getting sick (v0.14) ----------
function closeDayHealth(y) {
  const st = S.stats;
  st.workStreak = y.worked ? (st.workStreak || 0) + 1 : 0;
  if (S.sick) { if (now() - S.sick.since > SICK.days * DAY || (S.sick.med && S.sick.rested)) S.sick = null; return; }
  const sleep = (S.sleep && S.sleep.score) || 75;
  const p = SICK.base + (st.workStreak >= SICK.overworkDays ? SICK.overwork : 0) + (sleep < SICK.lowSleepScore ? SICK.lowSleep : 0);
  if (Math.random() < p) S.sick = { since: now(), med: false, why: st.workStreak >= SICK.overworkDays ? 'work' : sleep < SICK.lowSleepScore ? 'sleep' : 'cold' };
}
function buyMedicine() {
  if (!S.sick) return 'well';
  if (S.sick.med) return 'have';
  if (S.me.coins < SICK.medicine) return 'poor';
  S.me.coins -= SICK.medicine; S.sick.med = true;
  return 'ok';
}
// Lying in bed after taking the medicine: a short rest and you're well again.
function restInBed(sec) {
  if (!S.sick || !S.sick.med) return false;
  S.sick.rest = (S.sick.rest || 0) + sec;
  if (S.sick.rest >= SICK.restSec) { S.sick = null; return true; }
  return false;
}
// ---------- stealing a baby animal (v0.14) ----------
// A little prank: carry off one baby animal from a friend's pasture (they must have at least two of that kind;
// once a day per friend). A guard dog is more watchful here.
function stealBaby(fid, aid) {
  const h = friendById(fid), a = h && h.animals.find(x => x.id === aid);
  if (!a || ANIMALS[a.k].pet || animalStage(a) !== 0) return { r: 'no' };
  if (h.animals.filter(x => x.k === a.k).length < 2) return { r: 'few' };
  S.today.babies = S.today.babies || {};
  if (S.today.babies[fid]) return { r: 'done' };
  const err = sneakCheck(fid); if (err) return { r: err };
  S.today.babies[fid] = true;
  { const c = catchRoll(h, 0.45); if (c) return caught(fid, ANIMALS[a.k].sell[0], c, true); }
  h.animals.splice(h.animals.indexOf(a), 1);
  if (pastureCount() < pastureCap()) S.me.animals.push({ ...a, id: uid() }); else addBarn(S.me, 'baby_' + a.k, 1);
  S.stats.babies = (S.stats.babies || 0) + 1;
  return { r: 'ok', k: 'baby_' + a.k, n: 1 };
}
const babyStealable = (h, a) => isFriend(h.id) && !ANIMALS[a.k].pet && animalStage(a) === 0 && h.animals.filter(x => x.k === a.k).length >= 2 && !((S.today.babies || {})[h.id]);

// ---------- moving a farm area (v0.15) ----------
// It has to fit inside your yard, not cover the house, the drive, the path, another area or anything in the yard,
// and everything must still be reachable afterwards.
function moveArea(k, x, y, h = S.me) {
  if (!MOVABLE.includes(k)) return 'no';
  const A = AREA[k], LW = homeW(h);
  if (x < 0 || y < 0 || x + A.w > LW || y + A.d > LOT_D) return 'space';
  const r = { x, y, w: A.w, d: A.d }, over = q => x < q.x + q.w && q.x < x + A.w && y < q.y + q.d && q.y < y + A.d;
  const [fx, fy, fw, fd] = HOUSES[h.house].fp;
  if ([{ x: fx, y: fy, w: fw, d: fd }, AREA.drive, AREA.path, PORCH, { x: MAILBOX[0], y: MAILBOX[1], w: 1, d: 1 }].some(over)) return 'space';
  if (MOVABLE.filter(o => o !== k).some(o => over(areaOf(h, o)))) return 'space';
  if (h.yard.some(it => { const [w, d] = itemSize('yard', it); return over({ x: it.x, y: it.y, w, d }); })) return 'space';
  const old = h.areaAt ? { ...h.areaAt } : null;
  h.areaAt = { ...(h.areaAt || {}), [k]: [x, y] };
  if (typeof yardKeepsWay === 'function' && !yardKeepsWay(h, h.yard)) { h.areaAt = old || undefined; if (!old) delete h.areaAt; return 'block'; }
  YARD_SPOTS = {};
  return 'ok';
}

// ---------- clothes (v0.18) ----------
function buyClothes(k, h = S.me) {
  const c = CLOTHES[k];
  if (!c) return 'none';
  h.wardrobe = h.wardrobe || [...CLOTHES_FREE];
  if (h.wardrobe.includes(k)) return 'own';
  if (h.coins < c.price) return 'poor';
  h.coins -= c.price; h.wardrobe.push(k);
  wearClothes(k, h);
  return 'ok';
}
function wearClothes(k, h = S.me) {
  const c = CLOTHES[k];
  if (!c || !(h.wardrobe || CLOTHES_FREE).includes(k)) return false;
  h.look[c.slot] = k;
  if (k === 'dress' && h.look.bottom === 'skirt') h.look.bottom = 'jeans';
  return true;
}

// ---------- the mall (v0.18) ----------
function watchMovie(k) {
  if (!MALL.movies[k]) return 'no';
  if (S.me.coins < MALL.movie) return 'poor';
  S.me.coins -= MALL.movie;
  if (!S.mall.movies.includes(k)) S.mall.movies.push(k);
  return 'ok';
}
function clawTry() {
  if (S.me.coins < MALL.claw) return { r: 'poor' };
  S.me.coins -= MALL.claw;
  if (Math.random() >= MALL.clawWin) return { r: 'miss' };
  const all = Object.keys(MALL.plush), fresh = all.filter(k => !S.mall.plush.includes(k));
  const k = (fresh.length && Math.random() < 0.7 ? fresh : all)[Math.floor(Math.random() * (fresh.length && Math.random() < 0.7 ? fresh.length : all.length))] || all[0];
  const key = 'room:' + k; S.me.store[key] = (S.me.store[key] || 0) + 1;
  if (!S.mall.plush.includes(k)) S.mall.plush.push(k);
  return { r: 'win', k };
}
function eatFood(k) {
  const f = MALL.foods[k];
  if (!f) return 'no';
  if (S.me.coins < f.price) return 'poor';
  S.me.coins -= f.price;
  if (!S.mall.foods.includes(k)) S.mall.foods.push(k);
  return 'ok';
}
