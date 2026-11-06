'use strict';
// Catalogs and tuning: what you can grow, raise, buy and build, and what it costs.
// Item names are bilingual; nm(item) picks the current language.

const VERSION = '0.2.2';               // keep in step with CHANGELOG.md and the git tag
const TW = 64, TH = 32;                 // isometric tile size in px at zoom 1
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const ACTION_CAP = 20;                  // farm actions per day (planting, stealing). Harvesting, selling and shopping are free.
const STEAL_CAP = 6;                    // steals per day
const STEP_GOAL = 6000;
const STORAGE_KEY = 'mirror-town-proto-v2';

// ---------- home lot layout (tiles) ----------
// x runs to the lower right, y to the lower left. The road is in front of y = LOT_D.
const LOT_W = 14, LOT_D = 12;
// Kept close to the screen's vertical centre line so a phone shows house, field and pasture at once.
const AREA = {
  house:   { x: 1, y: 1, w: 6, d: 4 },
  pasture: { x: 8, y: 1, w: 6, d: 6 },  // largest pasture; smaller levels use the back corner
  fields:  { x: 4, y: 7, w: 4, d: 4 },  // 4 plots per row, right beside the garden path
  drive:   { x: 0, y: 7, w: 2, d: 5 },
  path:    { x: 3, y: 5, w: 1, d: 7 },
};
const DOOR_X = 3.5;

// ---------- town layout ----------
// 3x3 grid of slots; the centre one is the plaza. Every lot faces a road on its y = LOT_D side.
const SLOT_W = LOT_W + 1, SLOT_D = LOT_D + 2;
const SLOTS = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
const PLAZA = [1, 1];
const TOWN_W = 3 * SLOT_W, TOWN_D = 3 * SLOT_D;
// Town level grows with everyone's combined assets: the cooperative goal.
const TOWN_LEVELS = [0, 15000, 40000, 100000, 250000];

// ---------- crops ----------
// grow: time to ripen. seed: seed price. yield: units per plot. sell: price per unit. n: plants drawn per plot.
const CROPS = {
  wheat:      { e: '🌾', zh: '小麦',   en: 'Wheat',      grow: 3 * MIN,  seed: 4,  yield: 5, sell: 3,  n: 4 },
  carrot:     { e: '🥕', zh: '胡萝卜', en: 'Carrot',     grow: 5 * MIN,  seed: 6,  yield: 4, sell: 4,  n: 4 },
  cabbage:    { e: '🥬', zh: '白菜',   en: 'Cabbage',    grow: 10 * MIN, seed: 10, yield: 3, sell: 8,  n: 4 },
  tomato:     { e: '🍅', zh: '番茄',   en: 'Tomato',     grow: 15 * MIN, seed: 14, yield: 5, sell: 6,  n: 2 },
  corn:       { e: '🌽', zh: '玉米',   en: 'Corn',       grow: 20 * MIN, seed: 18, yield: 4, sell: 10, n: 3 },
  strawberry: { e: '🍓', zh: '草莓',   en: 'Strawberry', grow: 30 * MIN, seed: 24, yield: 6, sell: 9,  n: 4 },
  sunflower:  { e: '🌻', zh: '向日葵', en: 'Sunflower',  grow: 45 * MIN, seed: 40, yield: 3, sell: 30, n: 2, rare: true },
  pumpkin:    { e: '🎃', zh: '南瓜',   en: 'Pumpkin',    grow: 60 * MIN, seed: 60, yield: 2, sell: 70, n: 1, rare: true },
};
const CROP_STAGES = [
  { zh: '刚种下', en: 'Just planted' }, { zh: '发芽了', en: 'Sprouting' }, { zh: '长叶子', en: 'Leafing out' },
  { zh: '开花结果', en: 'Flowering' }, { zh: '成熟了', en: 'Ripe' },
];

// ---------- animals ----------
// price: buying a baby. grow: baby to adult. Adults make `prod` every `every`;
// every babyEvery-th time they have a baby instead. sell: value as [baby, young, adult].
const ANIMALS = {
  chicken: { e: '🐔', zh: '鸡',   en: 'Chicken', baby: { zh: '小鸡', en: 'Chick' },  price: 30,  grow: 8 * MIN,  prod: 'egg',     n: 2, every: 5 * MIN,  babyEvery: 4, sell: [15, 28, 50] },
  rabbit:  { e: '🐰', zh: '兔子', en: 'Rabbit',  baby: { zh: '小兔', en: 'Bunny' },  price: 45,  grow: 12 * MIN, prod: null,      n: 0, every: 10 * MIN, babyEvery: 1, sell: [22, 40, 70] },
  sheep:   { e: '🐑', zh: '绵羊', en: 'Sheep',   baby: { zh: '小羊', en: 'Lamb' },   price: 90,  grow: 20 * MIN, prod: 'wool',    n: 2, every: 12 * MIN, babyEvery: 4, sell: [45, 85, 150] },
  pig:     { e: '🐷', zh: '猪',   en: 'Pig',     baby: { zh: '小猪', en: 'Piglet' }, price: 120, grow: 25 * MIN, prod: 'truffle', n: 1, every: 15 * MIN, babyEvery: 3, sell: [60, 120, 220] },
  cow:     { e: '🐮', zh: '奶牛', en: 'Cow',     baby: { zh: '小牛', en: 'Calf' },   price: 200, grow: 40 * MIN, prod: 'milk',    n: 3, every: 10 * MIN, babyEvery: 5, sell: [100, 200, 380] },
  dog:     { e: '🐕', zh: '看家狗', en: 'Guard dog', baby: { zh: '小狗', en: 'Puppy' }, price: 150, grow: 20 * MIN, prod: null, n: 0, every: 0, babyEvery: 0, sell: [60, 100, 150], pet: true },
};
const GOODS = {
  egg:     { e: '🥚', zh: '鸡蛋', en: 'Egg',     sell: 6 },
  wool:    { e: '🧶', zh: '羊毛', en: 'Wool',    sell: 22 },
  milk:    { e: '🥛', zh: '牛奶', en: 'Milk',    sell: 16 },
  truffle: { e: '🍄', zh: '松露', en: 'Truffle', sell: 45 },
};

// ---------- land ----------
const FIELD_LEVELS = [4, 8, 12, 16];
const FIELD_COST = [null, { coins: 120 }, { coins: 300, wood: 10 }, { coins: 600, wood: 20 }];
const PASTURE = [
  null,
  { w: 4, d: 4, cap: 3,  cost: { coins: 150, wood: 10 } },
  { w: 6, d: 4, cap: 6,  cost: { coins: 400, wood: 20 } },
  { w: 6, d: 6, cap: 10, cost: { coins: 900, wood: 40 } },
];

// ---------- houses ----------
// fp: footprint [x, y, w, d] inside the lot. room: interior floor size.
const HOUSES = [
  { id: 'tent',     zh: '帐篷',     en: 'Tent',            fp: [2, 2, 3, 3], room: [4, 4],  cost: {} },
  { id: 'cabin',    zh: '小木屋',   en: 'Log cabin',       fp: [2, 2, 4, 3], room: [5, 4],  cost: { coins: 300, wood: 15 } },
  { id: 'cottage',  zh: '小平房',   en: 'Cottage',         fp: [2, 1, 4, 4], room: [6, 5],  cost: { coins: 900, wood: 30 } },
  { id: 'twostory', zh: '两层小楼', en: 'Two-story house', fp: [1, 1, 5, 4], room: [7, 6],  cost: { coins: 2200, wood: 60 } },
  { id: 'villa',    zh: '别墅',     en: 'Villa',           fp: [1, 1, 6, 4], room: [8, 7],  cost: { coins: 5000, wood: 100 } },
  { id: 'mansion',  zh: '豪宅',     en: 'Mansion',         fp: [1, 1, 6, 4], room: [10, 8], cost: { coins: 12000, wood: 180 } },
];
const WALL_COLORS = ['#f4e7cc', '#fbe3c8', '#fff8ec', '#dfe9f3', '#e6efdc', '#f3d9d6', '#c99a6b', '#9aa3ad'];
const ROOF_COLORS = ['#d9534f', '#ef7d3c', '#e0aa2a', '#4f9a4b', '#3e7cc9', '#6b5bd0', '#8a5a36', '#5b6470'];
const ROOM_WALLS = ['#f3e6d3', '#dbe9f4', '#e3eed8', '#f6dede', '#ece0f4', '#fff3d1', '#d9d2c5', '#5e6b7d'];
const FLOORS = [
  { c1: '#c89466', c2: '#b9855a' }, { c1: '#ebe6dc', c2: '#dcd5c8' }, { c1: '#9fb4c8', c2: '#94a9bd' },
  { c1: '#7a5a44', c2: '#6d503c' }, { c1: '#d9c7a7', c2: '#cfbc9b' },
];
const TINTS = ['#e5675f', '#f2a33a', '#f3d36b', '#6cbf73', '#5aa2e0', '#8b7fe0', '#e88bb7', '#8d99a6'];

// ---------- furniture (inside) ----------
// w x d footprint; flat items (rugs, mats) can sit under other furniture. tint: fabric colour can be changed.
const FURN = {
  sleepbag:  { zh: '睡袋',     en: 'Sleeping bag',   w: 1, d: 2, price: 20,  tint: true },
  bed:       { zh: '双人床',   en: 'Double bed',     w: 2, d: 2, price: 180, tint: true },
  sofa:      { zh: '沙发',     en: 'Sofa',           w: 2, d: 1, price: 150, tint: true },
  armchair:  { zh: '扶手椅',   en: 'Armchair',       w: 1, d: 1, price: 70,  tint: true },
  table:     { zh: '餐桌',     en: 'Dining table',   w: 2, d: 1, price: 90 },
  chair:     { zh: '椅子',     en: 'Chair',          w: 1, d: 1, price: 30 },
  desk:      { zh: '书桌电脑', en: 'Desk & computer', w: 2, d: 1, price: 160 },
  lamp:      { zh: '落地灯',   en: 'Floor lamp',     w: 1, d: 1, price: 40 },
  tv:        { zh: '电视',     en: 'TV',             w: 2, d: 1, price: 220 },
  shelf:     { zh: '书架',     en: 'Bookshelf',      w: 1, d: 1, price: 80 },
  plant:     { zh: '盆栽',     en: 'Potted plant',   w: 1, d: 1, price: 25 },
  rug:       { zh: '地毯',     en: 'Rug',            w: 2, d: 2, price: 60,  tint: true, flat: true },
  fridge:    { zh: '冰箱',     en: 'Fridge',         w: 1, d: 1, price: 200 },
  stove:     { zh: '灶台',     en: 'Stove',          w: 1, d: 1, price: 150 },
  treadmill: { zh: '跑步机',   en: 'Treadmill',      w: 1, d: 2, price: 500 },
  yogamat:   { zh: '瑜伽垫',   en: 'Yoga mat',       w: 1, d: 2, price: 35,  tint: true, flat: true },
  aquarium:  { zh: '鱼缸',     en: 'Aquarium',       w: 2, d: 1, price: 400 },
  fireplace: { zh: '壁炉',     en: 'Fireplace',      w: 2, d: 1, price: 600 },
  piano:     { zh: '钢琴',     en: 'Piano',          w: 2, d: 1, price: 900 },
};

// ---------- yard (outside) ----------
const YARD = {
  flowers:  { zh: '花坛',       en: 'Flower bed',   w: 1, d: 1, price: 30 },
  hedge:    { zh: '灌木',       en: 'Hedge',        w: 1, d: 1, price: 20 },
  tree:     { zh: '苹果树',     en: 'Apple tree',   w: 1, d: 1, price: 50 },
  pine:     { zh: '松树',       en: 'Pine tree',    w: 1, d: 1, price: 40 },
  mailbox:  { zh: '邮箱',       en: 'Mailbox',      w: 1, d: 1, price: 25 },
  lamp:     { zh: '路灯',       en: 'Lamp post',    w: 1, d: 1, price: 60 },
  bench:    { zh: '长椅',       en: 'Bench',        w: 1, d: 1, price: 50 },
  gnome:    { zh: '花园小矮人', en: 'Garden gnome', w: 1, d: 1, price: 35 },
  bbq:      { zh: '烧烤架',     en: 'BBQ grill',    w: 1, d: 1, price: 120 },
  swing:    { zh: '秋千',       en: 'Swing',        w: 2, d: 1, price: 180 },
  fountain: { zh: '喷泉',       en: 'Fountain',     w: 2, d: 2, price: 600 },
  pool:     { zh: '泳池',       en: 'Pool',         w: 3, d: 2, price: 1500 },
};

// ---------- vehicles ----------
const CARS = {
  bike:    { zh: '自行车', en: 'Bicycle',      cost: { coins: 120 } },
  scooter: { zh: '电动车', en: 'E-scooter',    cost: { coins: 350 } },
  mini:    { zh: '小轿车', en: 'Compact car',  cost: { coins: 1200 } },
  pickup:  { zh: '皮卡',   en: 'Pickup truck', cost: { coins: 2500 } },
  suv:     { zh: 'SUV',    en: 'SUV',          cost: { coins: 4000 } },
  sports:  { zh: '跑车',   en: 'Sports car',   cost: { coins: 9000 } },
  camper:  { zh: '房车',   en: 'Camper van',   cost: { coins: 15000 } },
};
const CAR_COLORS = ['#e5484d', '#f59e0b', '#f2d24b', '#34b27b', '#2f80ed', '#a46ef0', '#f4f4f0', '#2d2d2d'];

// ---------- real life ----------
const APPS = [
  { id: 'tiktok', name: 'TikTok', emoji: '🎵' }, { id: 'instagram', name: 'Instagram', emoji: '📸' },
  { id: 'youtube', name: 'YouTube', emoji: '▶️' }, { id: 'x', name: 'X', emoji: '✖️' },
  { id: 'reddit', name: 'Reddit', emoji: '👽' }, { id: 'games', name: null, emoji: '🎮' },
];
// Longer offline stretches pay more than the sum of short ones.
const FOCUS_REWARD = {
  30: { coins: 15, wood: 2 },
  60: { coins: 35, wood: 5 },
  120: { coins: 80, wood: 12, seeds: { sunflower: 1 } },
};
const STEP_REWARD = { coins: 10, wood: 1 };   // per 1,000 steps
const GOAL_REWARD = { coins: 20, wood: 3, seeds: { pumpkin: 1 } };

// ---------- avatars ----------
const COLORS = ['#ef6f6c', '#f59e0b', '#e8c02e', '#34b27b', '#38a3e0', '#6366f1', '#a46ef0', '#ec6aa8'];
const SKINS = ['#ffe0c4', '#f3c59f', '#d39a6c', '#9a6440'];
const HAIRS = ['short', 'long', 'bun', 'curly'];
const HAIR_COLORS = ['#2b1d14', '#6b4226', '#c98a3c', '#e9cf7a', '#b5462e', '#8f8f99'];
const MSG_KEYS = ['msg_nice', 'msg_walk', 'msg_cheer', 'msg_veg'];

// ---------- simulated friends ----------
// Friends' homes use the same shape as yours so they draw, rank and can be visited the same way.
const FRIEND_PRESETS = [
  { id: 'li', name: { zh: '小李', en: 'Ava' }, slot: 5,
    look: { shirt: '#ec6aa8', skin: SKINS[0], hair: 'long', hairCol: '#2b1d14', mob: 'walk' },
    house: 3, wall: '#fbe3c8', roof: '#d9534f', floor: 0, roomWall: 3,
    fieldLv: 1, crops: ['strawberry', 'strawberry', 'tomato', 'tomato', 'corn', 'carrot', 'strawberry', 'wheat'], ripe: [0, 1, 4, 5],
    pastureLv: 2, animals: [['chicken', 2], ['chicken', 2], ['chicken', 0], ['sheep', 2], ['cow', 1], ['dog', 2]],
    cars: [['mini', '#e5484d']],
    furn: [['bed', '#e88bb7'], 'shelf', ['sofa', '#5aa2e0'], 'tv', ['rug', '#f3d36b'], 'plant', 'lamp', 'piano', 'fridge'],
    yard: ['flowers', 'flowers', 'tree', 'lamp', 'bench', 'mailbox'],
    coins: 2400, wood: 40, likes: 20, shareGoal: true, earn: 30 },
  { id: 'wang', name: { zh: '小王', en: 'Leo' }, slot: 7,
    look: { shirt: '#4f8ef7', skin: SKINS[2], hair: 'short', hairCol: '#1d1a17', mob: 'walk' },
    house: 2, wall: '#f4e7cc', roof: '#3e7cc9', floor: 1, roomWall: 1,
    fieldLv: 0, crops: ['corn', 'corn', 'wheat', 'cabbage'], ripe: [2],
    pastureLv: 1, animals: [['chicken', 2], ['pig', 2], ['pig', 0]],
    cars: [['bike', '#34b27b']],
    furn: [['bed', '#5aa2e0'], 'table', 'chair', 'chair', 'shelf', 'stove', 'treadmill'],
    yard: ['pine', 'mailbox', 'bbq'],
    coins: 900, wood: 20, likes: 12, shareGoal: true, earn: 22 },
  { id: 'mia', name: { zh: 'Mia', en: 'Mia' }, slot: 4,
    look: { shirt: '#f2a33a', skin: SKINS[1], hair: 'bun', hairCol: '#b5462e', mob: 'wheel' },
    house: 1, wall: '#c99a6b', roof: '#4f9a4b', floor: 4, roomWall: 2,
    fieldLv: 0, crops: ['carrot', 'carrot', null, 'strawberry'], ripe: [0],
    pastureLv: 0, animals: [], cars: [],
    furn: [['sleepbag', '#6cbf73'], 'plant', 'plant', ['yogamat', '#8b7fe0'], 'lamp'],
    yard: ['flowers', 'flowers', 'flowers', 'gnome', 'hedge', 'hedge'],
    coins: 380, wood: 12, likes: 5, shareGoal: false, earn: 18 },
];
const FRIEND_POOL = [
  { id: 'chen', name: { zh: '阿晨', en: 'Noah' }, look: { shirt: '#2fb67c', skin: SKINS[3], hair: 'curly', hairCol: '#1d1a17', mob: 'walk' },
    house: 0, wall: '#f4e7cc', roof: '#2fb67c', floor: 0, roomWall: 0, fieldLv: 0, crops: [], ripe: [], pastureLv: 0, animals: [], cars: [],
    furn: [['sleepbag', '#5aa2e0']], yard: [], coins: 120, wood: 5, likes: 0, shareGoal: true, earn: 20 },
  { id: 'yu', name: { zh: '小雨', en: 'Zoe' }, look: { shirt: '#8b6cf0', skin: SKINS[0], hair: 'long', hairCol: '#6b4226', mob: 'walk' },
    house: 0, wall: '#f4e7cc', roof: '#8b6cf0', floor: 0, roomWall: 0, fieldLv: 0, crops: [], ripe: [], pastureLv: 0, animals: [], cars: [],
    furn: [['sleepbag', '#e88bb7']], yard: [], coins: 120, wood: 5, likes: 0, shareGoal: false, earn: 20 },
  { id: 'kai', name: { zh: '阿凯', en: 'Kai' }, look: { shirt: '#e5484d', skin: SKINS[1], hair: 'short', hairCol: '#c98a3c', mob: 'walk' },
    house: 0, wall: '#f4e7cc', roof: '#e5484d', floor: 0, roomWall: 0, fieldLv: 0, crops: [], ripe: [], pastureLv: 0, animals: [], cars: [],
    furn: [['sleepbag', '#f2a33a']], yard: [], coins: 120, wood: 5, likes: 0, shareGoal: true, earn: 20 },
  { id: 'lin', name: { zh: '林林', en: 'Lily' }, look: { shirt: '#38a3e0', skin: SKINS[2], hair: 'bun', hairCol: '#2b1d14', mob: 'walk' },
    house: 0, wall: '#f4e7cc', roof: '#38a3e0', floor: 0, roomWall: 0, fieldLv: 0, crops: [], ripe: [], pastureLv: 0, animals: [], cars: [],
    furn: [['sleepbag', '#6cbf73']], yard: [], coins: 120, wood: 5, likes: 0, shareGoal: false, earn: 20 },
];
