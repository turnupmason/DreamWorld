'use strict';
// Game data and rules. No DOM code here.

const TW = 64, TH = 32; // isometric tile size
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const ACTION_CAP = 10;   // build actions per day (design principle 4)
const STEP_GOAL = 6000;
const STORAGE_KEY = 'mirror-town-proto-v1';

const CROPS = {
  carrot:    { emoji: '🥕', grow: 5 * MIN,  sell: 8,  price: 5 },
  tomato:    { emoji: '🍅', grow: 15 * MIN, sell: 20, price: 12 },
  sunflower: { emoji: '🌻', grow: 30 * MIN, sell: 35, rare: true },
  pumpkin:   { emoji: '🎃', grow: 60 * MIN, sell: 70, rare: true },
};
const HOUSE_EMOJI = ['', '⛺', '🛖', '🏠', '🏡', '🏯'];
const HOUSE_COST = [null, null,
  { coins: 50, wood: 10 }, { coins: 120, wood: 25 }, { coins: 250, wood: 50 }, { coins: 500, wood: 90 }];
const MAX_HOUSE = 5;
// `at` = tile inside the 5x5 plot
const DECOS = [
  { id: 'flowers', emoji: '🌷', cost: { coins: 30 },          at: [2, 0] },
  { id: 'mailbox', emoji: '📮', cost: { coins: 20, wood: 2 }, at: [4, 0] },
  { id: 'lamp',    emoji: '🏮', cost: { coins: 50, wood: 8 }, at: [2, 2] },
  { id: 'bench',   emoji: '🪑', cost: { coins: 40, wood: 6 }, at: [4, 2] },
  { id: 'tree',    emoji: '🌳', cost: { coins: 25 },          at: [4, 4] },
];
const APPS = [
  { id: 'tiktok', name: 'TikTok', emoji: '🎵' },
  { id: 'instagram', name: 'Instagram', emoji: '📸' },
  { id: 'youtube', name: 'YouTube', emoji: '▶️' },
  { id: 'x', name: 'X', emoji: '✖️' },
  { id: 'reddit', name: 'Reddit', emoji: '👽' },
  { id: 'games', name: null, emoji: '🎮' },
];
// Longer offline stretches pay more than the sum of short ones.
const FOCUS_REWARD = {
  30: { coins: 15, wood: 2 },
  60: { coins: 35, wood: 5 },
  120: { coins: 80, wood: 12, seeds: { sunflower: 1 } },
};
const GOAL_REWARD = { coins: 20, seeds: { pumpkin: 1 } };
const COLORS = ['#ef6f6c', '#f59e0b', '#e8c02e', '#34b27b', '#38a3e0', '#6366f1', '#a46ef0', '#ec6aa8'];
const MSG_KEYS = ['msg_nice', 'msg_walk', 'msg_cheer'];
const PLOT_POS = [[0, 6], [0, 0], [7, 6], [7, 12], [7, 0], [0, 12]];

const STARTING_FRIENDS = [
  { id: 'wang', name: { zh: '小王', en: 'Leo' }, color: '#4f8ef7', house: 3, shareGoal: true, goalToday: true, likes: 12,
    decos: ['mailbox', 'tree'], garden: ['tomato', 'tomato', 'carrot', null, 'carrot', 'sunflower'] },
  { id: 'li', name: { zh: '小李', en: 'Ava' }, color: '#ec6aa8', house: 4, shareGoal: true, goalToday: false, likes: 20,
    decos: ['flowers', 'bench', 'lamp'], garden: ['carrot', 'carrot', 'carrot', 'pumpkin', null, null] },
  { id: 'mia', name: { zh: 'Mia', en: 'Mia' }, color: '#f2a33a', house: 2, shareGoal: false, goalToday: false, likes: 5,
    decos: ['flowers'], garden: [null, 'tomato', null, null, null, 'carrot'] },
];
const FRIEND_POOL = [
  { id: 'chen', name: { zh: '阿晨', en: 'Noah' }, color: '#2fb67c', house: 1, shareGoal: true, goalToday: false, likes: 0,
    decos: [], garden: [null, null, null, null, null, null] },
  { id: 'yu', name: { zh: '小雨', en: 'Zoe' }, color: '#8b6cf0', house: 1, shareGoal: false, goalToday: false, likes: 0,
    decos: [], garden: [null, null, null, null, null, null] },
];

let S = null; // the whole saved game

const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 9);
const rand = a => a[Math.floor(Math.random() * a.length)];

// The prototype can fast-forward time, so all game time goes through now().
function now() { return Date.now() + (S ? S.timeOffset : 0); }
function dayKey(ms) { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function freshDay() {
  return { date: dayKey(now()), steps: 0, stepBlocks: 0, focusMin: 0, distractMin: 0,
           actions: 0, goalPaid: false, restDay: false, liked: {} };
}

function load() {
  try { S = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { S = null; }
  if (!S || S.v !== 1) S = null;
  return S;
}
function save() { if (S) localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); }

function newGame(o) {
  S = {
    v: 1, lang: o.lang, name: o.name, color: o.color, apps: o.apps, limitMin: o.limitMin,
    coins: 50, wood: 10,
    seeds: { carrot: 3, tomato: 1, sunflower: 0, pumpkin: 0 },
    crops: { carrot: 0, tomato: 0, sunflower: 0, pumpkin: 0 },
    house: 1, decos: [], garden: [null, null, null, null, null, null],
    pending: [], feed: [], shareGoal: false, likes: 0, timeOffset: 0,
    friends: clone(STARTING_FRIENDS),
    plots: PLOT_POS.map((p, i) => ({ ox: p[0], oy: p[1], owner: ['me', 'li', 'wang', 'mia', null, null][i] })),
    created: Date.now(), seenHint: false, welcomed: false,
  };
  S.today = freshDay();
  save();
}

// Returns true when the calendar day changed. Nothing is lost on a new day (principle 1).
function checkDay() {
  const k = dayKey(now());
  if (S.today.date === k) return false;
  S.today = freshDay();
  S.friends.forEach(f => { f.goalToday = false; });
  return true;
}

// ---------- resources ----------
function canAfford(c) { return S.coins >= (c.coins || 0) && S.wood >= (c.wood || 0); }
function pay(c) { S.coins -= c.coins || 0; S.wood -= c.wood || 0; }
function addReward(r) {
  S.coins += r.coins || 0; S.wood += r.wood || 0;
  for (const k in r.seeds || {}) S.seeds[k] += r.seeds[k];
}
function sumRewards(list) {
  const out = { coins: 0, wood: 0, seeds: {} };
  list.forEach(p => {
    out.coins += p.reward.coins || 0; out.wood += p.reward.wood || 0;
    for (const k in p.reward.seeds || {}) out.seeds[k] = (out.seeds[k] || 0) + p.reward.seeds[k];
  });
  return out;
}
function totalSeeds() { return Object.values(S.seeds).reduce((a, b) => a + b, 0); }
function useAction() { if (S.today.actions >= ACTION_CAP) return false; S.today.actions++; return true; }
function actionsLeft() { return ACTION_CAP - S.today.actions; }

// Energy shows mood only; it never changes how the avatar looks (principle 2).
function energyLevel() {
  const s = S.today.steps;
  if (s >= STEP_GOAL) return 'high';
  if (S.today.restDay || s >= 2000) return 'mid';
  return 'low';
}

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
    addPending('steps', { coins: 10 * blocks, wood: blocks }, { steps: blocks * 1000 });
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

// ---------- building ----------
function cropProgress(g) { return Math.min(1, (now() - g.at) / CROPS[g.crop].grow); }
function plant(i, crop) {
  if (S.garden[i] || S.seeds[crop] < 1) return 'no';
  if (!useAction()) return 'cap';
  S.seeds[crop]--;
  S.garden[i] = { crop, at: now() };
  return 'ok';
}
function harvest(i) {
  const g = S.garden[i];
  if (!g || cropProgress(g) < 1) return null;
  S.crops[g.crop]++;
  S.garden[i] = null;
  return g.crop;
}
function upgradeHouse() {
  if (S.house >= MAX_HOUSE) return 'max';
  const c = HOUSE_COST[S.house + 1];
  if (!canAfford(c)) return 'poor';
  if (!useAction()) return 'cap';
  pay(c); S.house++;
  return 'ok';
}
function buyDeco(id) {
  const d = DECOS.find(x => x.id === id);
  if (S.decos.includes(id)) return 'own';
  if (!canAfford(d.cost)) return 'poor';
  if (!useAction()) return 'cap';
  pay(d.cost); S.decos.push(id);
  return 'ok';
}
function buySeed(crop) {
  const p = CROPS[crop].price;
  if (S.coins < p) return 'poor';
  S.coins -= p; S.seeds[crop]++;
  return 'ok';
}
function sellCrop(crop) {
  if (S.crops[crop] < 1) return 'no';
  S.crops[crop]--; S.coins += CROPS[crop].sell;
  return 'ok';
}

// ---------- friends ----------
function friendById(id) { return S.friends.find(f => f.id === id); }
function friendIds() { return S.plots.filter(p => p.owner && p.owner !== 'me').map(p => p.owner); }
function plotIndexOf(owner) { return S.plots.findIndex(p => p.owner === owner); }
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
function giveGift(id, type, crop) {
  if (type === 'crop') { if (S.crops[crop] < 1) return false; S.crops[crop]--; }
  else if (type === 'coins') { if (S.coins < 10) return false; S.coins -= 10; }
  else if (type === 'wood') { if (S.wood < 2) return false; S.wood -= 2; }
  return true;
}
function applyGift(g) {
  if (g.type === 'crop') S.crops[g.crop] += g.n;
  else if (g.type === 'seed') S.seeds[g.crop] += g.n;
  else if (g.type === 'coins') S.coins += g.n;
  else if (g.type === 'wood') S.wood += g.n;
}
function claimGift(feedId) {
  const it = S.feed.find(x => x.id === feedId);
  if (!it || it.claimed || !it.gift) return null;
  applyGift(it.gift); it.claimed = true;
  return it.gift;
}
function randomGift() {
  return clone(rand([
    { type: 'crop', crop: 'carrot', n: 2 }, { type: 'crop', crop: 'tomato', n: 1 },
    { type: 'seed', crop: 'tomato', n: 2 }, { type: 'seed', crop: 'sunflower', n: 1 },
    { type: 'coins', n: 15 }, { type: 'wood', n: 3 },
  ]));
}
function randomFriendEvent() {
  const ids = friendIds();
  if (!ids.length) return null;
  const f = friendById(rand(ids));
  const r = Math.random();
  if (r < 0.45) return addFeed({ kind: 'gift', from: f.id, gift: randomGift() });
  if (r < 0.7) { S.likes++; return addFeed({ kind: 'like', from: f.id }); }
  if (r < 0.88 && f.shareGoal && !f.goalToday) { f.goalToday = true; return addFeed({ kind: 'goal', from: f.id }); }
  return addFeed({ kind: 'msg', from: f.id, msgKey: rand(MSG_KEYS) });
}
// Invite reward goes to both sides.
function inviteJoin() {
  const p = S.plots.find(x => !x.owner);
  const next = FRIEND_POOL.find(f => !S.friends.some(x => x.id === f.id));
  if (!p || !next) return null;
  S.friends.push(clone(next));
  p.owner = next.id;
  return addFeed({ kind: 'join', from: next.id, gift: { type: 'wood', n: 5 } });
}
