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
  return { date: dayKey(now()), steps: 0, stepBlocks: 0, focusMin: 0, distractMin: 0, actions: 0, steals: 0,
           goalPaid: false, restDay: false, liked: {}, earned: { coins: 0, wood: 0 } };
}

function load() {
  try { S = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { S = null; }
  if (!S || S.v !== 2) S = null;
  if (S) [S.me, ...S.friends].forEach(fixLayout);
  return S;
}
// If the lot layout changed between versions, move yard items that now sit somewhere they can't.
function fixLayout(h) {
  h.yard.splice(0).forEach(it => {
    if (canPlace(h, 'yard', it.k, it.x, it.y, it.rot)) h.yard.push(it);
    else autoPlace(h, 'yard', it.k, it.tint);
  });
}
function save() { if (S) localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }

// ---------- homes ----------
function emptyHome(id) {
  return {
    id, name: '', look: null, coins: 0, wood: 0,
    house: 0, wall: WALL_COLORS[0], roof: ROOF_COLORS[0],
    room: { wall: 0, floor: 0, items: [] },
    yard: [], store: {},                       // store: bought but not placed, keyed "room:sofa" / "yard:bench"
    fieldLv: 0, fields: [null, null, null, null],
    pastureLv: 0, animals: [],
    cars: [], car: -1,
    seeds: {}, barn: {},
    likes: 0, shareGoal: false, goalToday: false,
  };
}

function homeFromPreset(p) {
  const h = emptyHome(p.id);
  Object.assign(h, {
    name: clone(p.name), look: clone(p.look), coins: p.coins, wood: p.wood, house: p.house, wall: p.wall, roof: p.roof,
    likes: p.likes, shareGoal: p.shareGoal, earn: p.earn, simAt: now(),
  });
  h.room.wall = p.roomWall; h.room.floor = p.floor;
  h.fieldLv = p.fieldLv;
  h.fields = Array(FIELD_LEVELS[p.fieldLv]).fill(null);
  p.crops.forEach((c, i) => {
    if (!c) return;
    const age = p.ripe.includes(i) ? 1.3 : 0.1 + Math.random() * 0.8;
    h.fields[i] = { crop: c, at: now() - CROPS[c].grow * age, left: CROPS[c].yield, thieves: [] };
  });
  h.pastureLv = p.pastureLv;
  p.animals.forEach(([k, st]) => h.animals.push(newAnimal(k, st)));
  p.cars.forEach(([k, color]) => h.cars.push({ k, color }));
  h.car = h.cars.length - 1;
  p.furn.forEach(f => { const [k, tint] = Array.isArray(f) ? f : [f]; autoPlace(h, 'room', k, tint); });
  p.yard.forEach(k => autoPlace(h, 'yard', k));
  return h;
}

function newGame(o) {
  S = {
    v: 2, lang: o.lang, apps: o.apps, limitMin: o.limitMin, timeOffset: 0,
    created: Date.now(), seenHint: false, welcomed: false, pending: [], feed: [],
  };
  const me = emptyHome('me');
  Object.assign(me, { name: o.name, look: o.look, coins: 300, wood: 20, roof: o.look.shirt });
  me.seeds = { wheat: 4, carrot: 3, cabbage: 1 };
  // A head start so the first minute already shows things growing.
  me.fields[0] = { crop: 'wheat', at: now() - CROPS.wheat.grow * 0.85, left: CROPS.wheat.yield, thieves: [] };
  me.fields[1] = { crop: 'carrot', at: now() - CROPS.carrot.grow * 0.3, left: CROPS.carrot.yield, thieves: [] };
  me.pastureLv = 1;
  me.animals = [newAnimal('chicken', 2), newAnimal('chicken', 0)];
  me.animals[0].last = now() - ANIMALS.chicken.every * 0.8;
  S.me = me;
  autoPlace(me, 'room', 'sleepbag', TINTS[4]);
  autoPlace(me, 'room', 'lamp');
  autoPlace(me, 'yard', 'mailbox');
  autoPlace(me, 'yard', 'flowers');
  S.friends = FRIEND_PRESETS.map(homeFromPreset);
  S.slots = SLOTS.map((p, i) => ({ c: p[0], r: p[1], owner: i === 6 ? 'me' : (FRIEND_PRESETS.find(f => f.slot === i) || {}).id || null }));
  S.today = freshDay();
  save();
}

// Returns true when the calendar day changed. Nothing is lost on a new day.
function checkDay() {
  const k = dayKey(now());
  if (S.today.date === k) return false;
  S.today = freshDay();
  S.friends.forEach(f => { f.goalToday = false; });
  return true;
}

const homeName = h => (h.id === 'me' ? S.me.name : nm(h.name));
function friendById(id) { return S.friends.find(f => f.id === id); }
function homeOf(id) { return id === 'me' ? S.me : friendById(id); }
function slotOf(id) { return S.slots.find(s => s.owner === id); }
function friendIds() { return S.slots.filter(s => s.owner && s.owner !== 'me').map(s => s.owner); }
function residents() { return S.slots.filter(s => s.owner).map(s => homeOf(s.owner)); }

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
function barnCount(h = S.me) { return Object.values(h.barn).reduce((a, b) => a + b, 0); }

// Energy shows mood only; it never changes how the avatar looks.
function energyLevel() {
  const s = S.today.steps;
  if (s >= STEP_GOAL) return 'high';
  if (S.today.restDay || s >= 2000) return 'mid';
  return 'low';
}
function friendEnergy(h) { return h.goalToday ? 'high' : 'mid'; }

// ---------- real-life inputs (simulated in the prototype) ----------
function addPending(src, reward, info) {
  if (src === 'steps') {
    const ex = S.pending.find(p => p.src === 'steps');
    if (ex) { ex.info.steps += info.steps; ex.reward.coins += reward.coins; ex.reward.wood += reward.wood; return; }
  }
  S.pending.push({ id: uid(), src, reward, info: info || {} });
}
function recordSteps(n) {
  S.today.steps += n;
  const blocks = Math.floor(S.today.steps / 1000) - S.today.stepBlocks;
  if (blocks > 0) {
    S.today.stepBlocks += blocks;
    addPending('steps', { coins: STEP_REWARD.coins * blocks, wood: STEP_REWARD.wood * blocks }, { steps: blocks * 1000 });
  }
  if (S.today.steps >= STEP_GOAL && !S.today.goalPaid) {
    S.today.goalPaid = true;
    addPending('goal', clone(GOAL_REWARD));
    return 'goal';
  }
  return 'ok';
}
function recordFocus(min) {
  S.today.focusMin += min;
  addPending('focus', clone(FOCUS_REWARD[min]), { min });
}
function recordDistract(min) { S.today.distractMin += min; } // no penalty, ever
function setRestDay() {
  if (S.today.goalPaid) return false;
  S.today.restDay = true; S.today.goalPaid = true;
  addPending('rest', clone(GOAL_REWARD));
  return true;
}

// ---------- crops ----------
function cropProg(f) { return f ? Math.min(1, (now() - f.at) / CROPS[f.crop].grow) : 0; }
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
// Plants every empty plot with one kind of seed. Returns how many were planted.
function plantAll(crop) {
  let n = 0;
  for (let i = 0; i < S.me.fields.length; i++) {
    if (S.me.fields[i] || !(S.me.seeds[crop] > 0)) continue;
    const r = plant(i, crop);
    if (r === 'cap') return { n, cap: true };
    if (r === 'ok') n++;
  }
  return { n, cap: false };
}
function harvest(i) {
  const f = S.me.fields[i];
  if (!isRipe(f)) return null;
  addBarn(S.me, f.crop, f.left);
  S.me.fields[i] = null;
  return { crop: f.crop, n: f.left, i };
}
function harvestAll() {
  const out = [];
  S.me.fields.forEach((f, i) => { const r = isRipe(f) && harvest(i); if (r) out.push(r); });
  return out;
}

// Stealing takes a small share and never more than half the plot, so the owner always keeps most of it.
const stealKeep = crop => Math.ceil(CROPS[crop].yield / 2);
const stealSize = crop => Math.max(1, Math.round(CROPS[crop].yield * 0.25));
function hasGuardDog(h) { return h.animals.some(a => a.k === 'dog' && animalStage(a) === 2); }
function stealable(h, i, who = 'me') {
  const f = h.fields[i];
  return isRipe(f) && !f.thieves.includes(who) && f.left > stealKeep(f.crop);
}
function steal(fid, i) {
  const h = friendById(fid), f = h.fields[i];
  if (!isRipe(f)) return { r: 'no' };
  if (f.thieves.includes('me')) return { r: 'done' };
  if (f.left <= stealKeep(f.crop)) return { r: 'empty' };
  if (S.today.steals >= STEAL_CAP) return { r: 'limit' };
  if (!useAction()) return { r: 'cap' };
  S.today.steals++;
  f.thieves.push('me');
  if (hasGuardDog(h) && Math.random() < 0.35) return { r: 'dog', crop: f.crop };
  const n = Math.min(f.left - stealKeep(f.crop), stealSize(f.crop));
  f.left -= n;
  addBarn(S.me, f.crop, n);
  return { r: 'ok', crop: f.crop, n };
}
function friendStealsFromMe(fid) {
  const idx = S.me.fields.map((f, i) => i).filter(i => stealable(S.me, i, fid));
  if (!idx.length) return null;
  const f = S.me.fields[rand(idx)];
  f.thieves.push(fid);
  if (hasGuardDog(S.me) && Math.random() < 0.5) return addFeed({ kind: 'caught', from: fid, crop: f.crop });
  const n = Math.min(f.left - stealKeep(f.crop), stealSize(f.crop));
  f.left -= n;
  return addFeed({ kind: 'stole', from: fid, crop: f.crop, n });
}

// ---------- animals ----------
function newAnimal(k, stage = 0) {
  const d = ANIMALS[k], t = now();
  return { id: uid(), k, born: t - d.grow * [0, 0.6, 1.2][stage], cycles: 0,
           last: stage === 2 && d.every ? t - d.every * Math.random() * 0.7 : null };
}
function animalProg(a) { return Math.min(1, (now() - a.born) / ANIMALS[a.k].grow); }
function animalStage(a) { const p = animalProg(a); return p >= 1 ? 2 : p >= 0.4 ? 1 : 0; }
function animalName(a) { const d = ANIMALS[a.k], s = animalStage(a); return s === 0 ? nm(d.baby) : nm(d); }
function prodProg(a) {
  const d = ANIMALS[a.k];
  if (!d.every || animalStage(a) < 2) return 0;
  return Math.min(1, (now() - (a.last || a.born + d.grow)) / d.every);
}
function animalReady(a) { return ANIMALS[a.k].every > 0 && animalStage(a) === 2 && prodProg(a) >= 1; }
function nextIsBaby(a) { const d = ANIMALS[a.k]; return d.babyEvery > 0 && (a.cycles + 1) % d.babyEvery === 0; }
function pastureCap(h = S.me) { return h.pastureLv ? PASTURE[h.pastureLv].cap : 0; }
function pastureCount(h = S.me) { return h.animals.filter(a => !ANIMALS[a.k].pet).length; }
function pastureRect(h) {
  const p = PASTURE[h.pastureLv];
  // smaller pastures sit in the front-left corner of the pasture area, closest to the middle of the screen
  return p ? { x: AREA.pasture.x, y: AREA.pasture.y + AREA.pasture.d - p.d, w: p.w, d: p.d } : null;
}

function collectAnimal(id, h = S.me) {
  const a = h.animals.find(x => x.id === id);
  if (!a || !animalReady(a)) return null;
  const d = ANIMALS[a.k];
  const baby = nextIsBaby(a);
  a.cycles++; a.last = now();
  if (baby) {
    if (pastureCount(h) < pastureCap(h)) { h.animals.push(newAnimal(a.k, 0)); return { type: 'baby', k: a.k, placed: true, id: a.id }; }
    addBarn(h, 'baby_' + a.k, 1);
    return { type: 'baby', k: a.k, placed: false, id: a.id };
  }
  addBarn(h, d.prod, d.n);
  return { type: 'prod', k: d.prod, n: d.n, id: a.id };
}
function collectAllAnimals() {
  return S.me.animals.filter(animalReady).map(a => collectAnimal(a.id)).filter(Boolean);
}
function sellAnimal(id) {
  const h = S.me, i = h.animals.findIndex(a => a.id === id);
  if (i < 0) return 0;
  const a = h.animals[i], v = ANIMALS[a.k].sell[animalStage(a)];
  h.animals.splice(i, 1);
  h.coins += v;
  return v;
}
// A baby waiting in the barn can move into the pasture once there's room.
function releaseBaby(k) {
  const h = S.me, key = 'baby_' + k;
  if (!h.barn[key] || pastureCount(h) >= pastureCap(h)) return false;
  h.barn[key]--; if (!h.barn[key]) delete h.barn[key];
  h.animals.push(newAnimal(k, 0));
  return true;
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

// ---------- placing furniture and yard items ----------
const itemDef = (scope, k) => (scope === 'room' ? FURN[k] : YARD[k]);
const scopeItems = (h, scope) => (scope === 'room' ? h.room.items : h.yard);
function itemSize(scope, it) { const d = itemDef(scope, it.k); return it.rot ? [d.d, d.w] : [d.w, d.d]; }
function roomSize(h) { return HOUSES[h.house].room; }
const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.d;
const PORCH = { x: AREA.house.x, y: AREA.house.y + AREA.house.d, w: AREA.house.w, d: 1 }; // keep the front of the house clear
function yardReserved(x, y) {
  if (x < 0 || y < 0 || x >= LOT_W || y >= LOT_D) return true;
  return ['house', 'pasture', 'fields', 'drive', 'path'].some(k => inRect(AREA[k], x, y)) || inRect(PORCH, x, y);
}
function canPlace(h, scope, k, x, y, rot, ignoreId) {
  const def = itemDef(scope, k);
  const [w, d] = rot ? [def.d, def.w] : [def.w, def.d];
  if (scope === 'room') {
    const [rw, rd] = roomSize(h);
    if (x < 0 || y < 0 || x + w > rw || y + d > rd) return false;
  } else {
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) if (yardReserved(x + i, y + j)) return false;
  }
  for (const it of scopeItems(h, scope)) {
    if (it.id === ignoreId) continue;
    if (scope === 'room' && !!itemDef(scope, it.k).flat !== !!def.flat) continue; // rugs can sit under furniture
    const [iw, id] = itemSize(scope, it);
    if (x < it.x + iw && x + w > it.x && y < it.y + id && y + d > it.y) return false;
  }
  return true;
}
// Preferred spots: inside, along the back walls first; outside, the front yard near the path first.
function roomSpots(h, flat) {
  const [rw, rd] = roomSize(h), out = [];
  for (let y = 0; y < rd; y++) for (let x = 0; x < rw; x++) out.push([x, y]);
  if (flat) return out.sort((a, b) => Math.hypot(a[0] - rw / 2 + 1, a[1] - rd / 2 + 1) - Math.hypot(b[0] - rw / 2 + 1, b[1] - rd / 2 + 1));
  return out.sort((a, b) => Math.min(a[0], a[1]) - Math.min(b[0], b[1]) || (a[0] + a[1]) - (b[0] + b[1]));
}
let YARD_SPOTS = null;
function yardSpots() {
  if (!YARD_SPOTS) {
    YARD_SPOTS = [];
    for (let y = 0; y < LOT_D; y++) for (let x = 0; x < LOT_W; x++) if (!yardReserved(x, y)) YARD_SPOTS.push([x, y]);
    YARD_SPOTS.sort((a, b) => Math.hypot(a[0] - 6, a[1] - 6) - Math.hypot(b[0] - 6, b[1] - 6));
  }
  return YARD_SPOTS;
}
function autoPlace(h, scope, k, tint) {
  const def = itemDef(scope, k);
  const spots = scope === 'room' ? roomSpots(h, def.flat) : yardSpots();
  // Against the left wall, turn things so their back touches the wall.
  for (const [x, y] of spots) for (const rot of (scope === 'room' && x === 0 && y > 0 ? [1, 0] : [0, 1])) {
    if (rot && def.w === def.d && !(scope === 'room' && x === 0 && y > 0)) continue;
    if (canPlace(h, scope, k, x, y, rot)) {
      const it = { id: uid(), k, x, y, rot, tint: def.tint ? (tint || rand(TINTS)) : null };
      scopeItems(h, scope).push(it);
      return it;
    }
  }
  const key = scope + ':' + k;
  h.store[key] = (h.store[key] || 0) + 1;
  return null;
}
function placeFromStore(scope, k, x, y, rot, tint) {
  const h = S.me, key = scope + ':' + k;
  if (!h.store[key] || !canPlace(h, scope, k, x, y, rot)) return null;
  h.store[key]--; if (!h.store[key]) delete h.store[key];
  const it = { id: uid(), k, x, y, rot, tint: itemDef(scope, k).tint ? (tint || rand(TINTS)) : null };
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
function rotateItem(scope, id) {
  const it = findItem(scope, id);
  if (!it) return false;
  return moveItem(scope, id, it.x, it.y, it.rot ? 0 : 1);
}
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
function buyFieldLv(h = S.me) {
  if (h.fieldLv >= FIELD_LEVELS.length - 1) return 'max';
  const c = FIELD_COST[h.fieldLv + 1];
  if (!canAfford(c, h)) return 'poor';
  pay(c, h);
  h.fieldLv++;
  while (h.fields.length < FIELD_LEVELS[h.fieldLv]) h.fields.push(null);
  return 'ok';
}
function buyPastureLv(h = S.me) {
  if (h.pastureLv >= PASTURE.length - 1) return 'max';
  const c = PASTURE[h.pastureLv + 1].cost;
  if (!canAfford(c, h)) return 'poor';
  pay(c, h);
  h.pastureLv++;
  return 'ok';
}
function buyItem(scope, k, h = S.me) {
  const d = itemDef(scope, k);
  if (h.coins < d.price) return { r: 'poor' };
  h.coins -= d.price;
  const it = autoPlace(h, scope, k);
  return { r: 'ok', item: it };
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
function buyHouse(i, h = S.me) {
  if (i <= h.house) return 'own';
  const c = HOUSES[i].cost;
  if (!canAfford(c, h)) return 'poor';
  pay(c, h);
  h.house = i;
  return 'ok';
}

// ---------- assets & ranking ----------
const costValue = c => (c.coins || 0) + (c.wood || 0) * 5; // wood only comes from real life, so it counts extra
function assetBreakdown(h) {
  const b = { cash: h.coins + h.wood * 5, house: costValue(HOUSES[h.house].cost), land: 0, items: 0, cars: 0, animals: 0, goods: 0 };
  for (let i = 1; i <= h.fieldLv; i++) b.land += costValue(FIELD_COST[i]);
  for (let i = 1; i <= h.pastureLv; i++) b.land += costValue(PASTURE[i].cost);
  h.room.items.forEach(it => { b.items += FURN[it.k].price; });
  h.yard.forEach(it => { b.items += YARD[it.k].price; });
  Object.entries(h.store).forEach(([key, n]) => { const [sc, k] = key.split(':'); b.items += itemDef(sc, k).price * n; });
  h.cars.forEach(c => { b.cars += costValue(CARS[c.k].cost); });
  h.animals.forEach(a => { b.animals += ANIMALS[a.k].sell[animalStage(a)]; });
  b.goods = barnValue(h) + Object.entries(h.seeds).reduce((s, [k, n]) => s + CROPS[k].seed * n, 0);
  b.total = b.cash + b.house + b.land + b.items + b.cars + b.animals + b.goods;
  return b;
}
const assetValue = h => assetBreakdown(h).total;
function ranking() {
  return residents().map(h => ({ h, v: assetValue(h) })).sort((a, b) => b.v - a.v);
}
function rankOf(id) { return ranking().findIndex(r => r.h.id === id) + 1; }
function townTotal() { return residents().reduce((s, h) => s + assetValue(h), 0); }
function townLevel(total = townTotal()) {
  let lv = 1;
  TOWN_LEVELS.forEach((v, i) => { if (total >= v) lv = i + 1; });
  return lv;
}

// ---------- friends live their lives too ----------
// Every 5 simulated minutes each friend earns a little (their own steps and focus time),
// tends their farm and now and then buys something, so the ranking keeps moving.
function simFriends() {
  const t = now(), STEP = 5 * MIN;
  S.friends.forEach(h => {
    if (!slotOf(h.id)) return;
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
  h.fields.forEach((f, i) => {
    if (!isRipe(f) || Math.random() > 0.2) return;
    h.coins += f.left * CROPS[f.crop].sell;
    const opts = Object.keys(CROPS).filter(c => !CROPS[c].rare);
    const c = rand(opts);
    h.fields[i] = { crop: c, at: now() - Math.random() * CROPS[c].grow * 0.3, left: CROPS[c].yield, thieves: [] };
  });
  h.animals.forEach(a => {
    if (!animalReady(a) || Math.random() > 0.3) return;
    const r = collectAnimal(a.id, h);
    if (r && r.type === 'prod') { h.coins += h.barn[r.k] * GOODS[r.k].sell; delete h.barn[r.k]; }
    if (r && r.type === 'baby' && !r.placed) { h.coins += ANIMALS[r.k].sell[0]; delete h.barn['baby_' + r.k]; }
  });
  if (Math.random() > 0.05) return;
  const nextHouse = HOUSES[h.house + 1];
  if (nextHouse && h.coins > costValue(nextHouse.cost) * 1.3 && h.wood >= (nextHouse.cost.wood || 0)) { buyHouse(h.house + 1, h); return; }
  if (h.fieldLv < 3 && h.coins > FIELD_COST[h.fieldLv + 1].coins * 2 && h.wood >= (FIELD_COST[h.fieldLv + 1].wood || 0)) { buyFieldLv(h); return; }
  if (!h.cars.length && h.coins > 1500) { buyCar(h.coins > 3000 ? 'pickup' : 'mini', h); return; }
  if (h.coins > 400) {
    if (Math.random() < 0.5) buyItem('room', rand(Object.keys(FURN)), h);
    else buyItem('yard', rand(['flowers', 'hedge', 'tree', 'pine', 'lamp', 'bench', 'gnome']), h);
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
    { type: 'barn', k: 'carrot', n: 3 }, { type: 'barn', k: 'egg', n: 4 }, { type: 'barn', k: 'milk', n: 2 },
    { type: 'seed', k: 'tomato', n: 2 }, { type: 'seed', k: 'strawberry', n: 2 }, { type: 'seed', k: 'corn', n: 2 },
    { type: 'coins', n: 30 }, { type: 'wood', n: 3 },
  ]));
}
function randomFriendEvent() {
  const ids = friendIds();
  if (!ids.length) return null;
  const f = friendById(rand(ids));
  const r = Math.random();
  if (r < 0.22) { const ev = friendStealsFromMe(f.id); if (ev) return ev; }
  if (r < 0.5) return addFeed({ kind: 'gift', from: f.id, gift: randomGift() });
  if (r < 0.68) { S.me.likes++; return addFeed({ kind: 'like', from: f.id }); }
  if (r < 0.84 && f.shareGoal && !f.goalToday) { f.goalToday = true; return addFeed({ kind: 'goal', from: f.id }); }
  return addFeed({ kind: 'msg', from: f.id, msgKey: rand(MSG_KEYS) });
}
// Invite reward goes to both sides.
function inviteJoin() {
  const slot = S.slots.find(s => !s.owner);
  const next = FRIEND_POOL.find(f => !S.friends.some(x => x.id === f.id));
  if (!slot || !next) return null;
  S.friends.push(homeFromPreset(next));
  slot.owner = next.id;
  return addFeed({ kind: 'join', from: next.id, gift: { type: 'wood', n: 5 } });
}
