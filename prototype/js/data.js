'use strict';
// Catalogs and tuning: what you can grow, raise, buy and build, what it costs, and how real-life health pays out.
// Item names are bilingual; nm(item) picks the current language. Times are in minutes unless noted.

const VERSION = '0.10.0';
const TW = 64, TH = 32;                 // isometric tile size in px at zoom 1
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const ACTION_CAP = 24;                  // farm actions per day (planting, sneaking). Harvesting, selling and shopping are free.
const STEAL_CAP = 8;                    // sneaks per day
const STEAL_FINE = [10, 60];            // caught by a guard dog: pay the owner twice the value, within this range
const STEP_GOAL = 6000;                  // starting step goal; it then follows your own last 7 days (see stepGoal())
const STORAGE_KEY = 'mirror-town-proto-v3';

// ---------- home lot layout (tiles) ----------
// x runs to the lower right, y to the lower left. The road is in front of y = LOT_D.
const LOT_W = 16, LOT_D = 14;
const AREA = {
  house:   { x: 1, y: 1, w: 6, d: 4 },
  pasture: { x: 9, y: 0, w: 6, d: 6 },  // smaller pastures use the front-left corner
  fields:  { x: 4, y: 7, w: 4, d: 4 },  // 4 plots per row, beside the garden path
  orchard: { x: 9, y: 7, w: 6, d: 3 },
  pond:    { x: 9, y: 11, w: 4, d: 3 },
  drive:   { x: 0, y: 7, w: 2, d: 7 },
  path:    { x: 3, y: 5, w: 1, d: 9 },
};
const DOOR_X = 3.5;
const MAILBOX = [4, 13];                 // every home has a mailbox by the gate

// ---------- the world ----------
// A real little town instead of a 3 × 3 grid: neighbourhoods with streets of different lengths, roads of different
// widths, a town centre, a park, a lake and farmland. Coordinates are world tiles (x to the lower right, y to the lower left).
// Every street is a row of land parcels (PARCEL tiles wide, LOT_D deep) with its road in front (+y).
// A home takes 4 parcels (the 16-tile core with house, farm and yard) plus any parcels bought next to it, to the right.
const PARCEL = 4, CORE_PARCELS = LOT_W / PARCEL;
const WORLD = { x0: -4, y0: -4, x1: 180, y1: 92 };            // the town; woods all around it
const TOWN_W = WORLD.x1, TOWN_D = WORLD.y1;
const TOWN_LEVELS = [0, 15000, 40000, 100000, 250000];
const NEIGHBORHOODS = {
  maple: { zh: '梧桐街社区', en: 'Maple', price: 1.0, grass: '#a6d47f' },
  farm:  { zh: '田园', en: 'Farmland', price: 0.6, grass: '#b3d77f' },
  lake:  { zh: '湖畔', en: 'Lakeside', price: 1.8, grass: '#9fd388' },
};
const STREETS = {
  maple:     { nb: 'maple', zh: '梧桐街', en: 'Maple Street', x: 0,   y: 0,  n: 16 },
  cherry:    { nb: 'maple', zh: '樱桃巷', en: 'Cherry Lane',  x: 0,   y: 16, n: 16 },
  wheat:     { nb: 'farm',  zh: '麦田路', en: 'Wheat Road',   x: 0,   y: 36, n: 16 },
  meadow:    { nb: 'farm',  zh: '草场路', en: 'Meadow Road',  x: 0,   y: 52, n: 16 },
  lakeview:  { nb: 'lake',  zh: '望湖路', en: 'Lakeview Road', x: 116, y: 0, n: 14 },
  shore:     { nb: 'lake',  zh: '湖滨大道', en: 'Shore Avenue', x: 116, y: 16, n: 14 },
};
// Roads: [x0, y0, x1, y1, kind]. street = 2 wide, avenue = 3 wide with a median line, dirt = country road.
const ROADS = [
  [-2, 14, 64, 16, 'street'], [115, 14, 172, 16, 'street'],
  [-18, 30, 196, 33, 'avenue'],
  [-2, 50, 64, 52, 'street'], [-18, 66, 112, 68, 'dirt'],
  [64, -2, 67, 70, 'avenue'], [112, -2, 115, 36, 'avenue'],
];
// Places that aren't homes. The town hall plaza is 16 × 14 like a lot.
const LANDMARKS = {
  plaza:  { x: 82, y: 4 },
  shops:  [['bakery', 69, 21], ['cafe', 76, 21], ['market', 99, 21], ['gym', 105, 21], ['library', 69, 4], ['post', 105, 4]],
  park:   { x: 68, y: 35, w: 44, d: 30 },
  lake:   { x: 146, y: 52, rx: 26, ry: 13 },
  fields: { x: -2, y: 70, w: 114, d: 18 },
};
// Other people living in town (not your friends). Their homes are generated from these.
const NPC_LOTS = [
  { id: 'n1', st: 'cherry', p: 4, n: 5, house: 4 }, { id: 'n2', st: 'wheat', p: 0, n: 6, house: 2 },
  { id: 'n3', st: 'wheat', p: 9, n: 5, house: 1 }, { id: 'n4', st: 'meadow', p: 0, n: 8, house: 5 },
  { id: 'n5', st: 'meadow', p: 12, n: 4, house: 3 }, { id: 'n6', st: 'lakeview', p: 0, n: 5, house: 7 },
  { id: 'n7', st: 'lakeview', p: 5, n: 5, house: 6 }, { id: 'n8', st: 'shore', p: 0, n: 6, house: 8 },
  { id: 'n9', st: 'shore', p: 8, n: 6, house: 4 },
];
const NPC_NAMES = [
  { zh: '老张', en: 'Sam' }, { zh: '王奶奶', en: 'Grandma Rose' }, { zh: '阿杰', en: 'Jake' }, { zh: '陈叔', en: 'Uncle Ben' },
  { zh: '小美', en: 'Emma' }, { zh: '李医生', en: 'Dr. Lee' }, { zh: '周老师', en: 'Ms. Chow' }, { zh: '大熊', en: 'Big Al' }, { zh: '安娜', en: 'Anna' },
];
// Where you and your friends start, and where friends who accept an invite move in.
const START_LOTS = { me: ['maple', 6], li: ['maple', 0, 5], wang: ['cherry', 0], mia: ['cherry', 11] };
// Buying land: each parcel next to your home costs more than the last. Moving to another street costs its land.
const LAND = { parcel: 600, grow: 1.35, move: 500, refund: 0.5 };

// ---------- crops ----------
// grow: minutes to ripen. seed: price. yield: units per plot. sell: per unit. n: plants per plot. rare: only from real-life goals.
const CROPS = {
  wheat:       { e: '🌾', zh: '小麦',   en: 'Wheat',        grow: 3,  seed: 4,  yield: 5, sell: 3,  n: 4 },
  carrot:      { e: '🥕', zh: '胡萝卜', en: 'Carrot',       grow: 5,  seed: 6,  yield: 4, sell: 4,  n: 4 },
  potato:      { e: '🥔', zh: '土豆',   en: 'Potato',       grow: 7,  seed: 8,  yield: 4, sell: 5,  n: 2 },
  onion:       { e: '🧅', zh: '洋葱',   en: 'Onion',        grow: 8,  seed: 9,  yield: 4, sell: 5,  n: 4 },
  garlic:      { e: '🧄', zh: '大蒜',   en: 'Garlic',       grow: 9,  seed: 10, yield: 5, sell: 4,  n: 4 },
  cabbage:     { e: '🥬', zh: '白菜',   en: 'Cabbage',      grow: 10, seed: 10, yield: 3, sell: 8,  n: 4 },
  broccoli:    { e: '🥦', zh: '西兰花', en: 'Broccoli',     grow: 12, seed: 12, yield: 3, sell: 9,  n: 3 },
  sweetpotato: { e: '🍠', zh: '红薯',   en: 'Sweet potato', grow: 14, seed: 14, yield: 4, sell: 8,  n: 2 },
  tomato:      { e: '🍅', zh: '番茄',   en: 'Tomato',       grow: 15, seed: 14, yield: 5, sell: 6,  n: 2 },
  cucumber:    { e: '🥒', zh: '黄瓜',   en: 'Cucumber',     grow: 16, seed: 15, yield: 5, sell: 7,  n: 2 },
  eggplant:    { e: '🍆', zh: '茄子',   en: 'Eggplant',     grow: 18, seed: 16, yield: 4, sell: 9,  n: 2 },
  chili:       { e: '🌶️', zh: '辣椒',   en: 'Chili',        grow: 20, seed: 18, yield: 8, sell: 5,  n: 2 },
  corn:        { e: '🌽', zh: '玉米',   en: 'Corn',         grow: 20, seed: 18, yield: 4, sell: 10, n: 3 },
  pepper:      { e: '🫑', zh: '彩椒',   en: 'Bell pepper',  grow: 22, seed: 18, yield: 4, sell: 11, n: 2 },
  strawberry:  { e: '🍓', zh: '草莓',   en: 'Strawberry',   grow: 30, seed: 24, yield: 6, sell: 9,  n: 4 },
  blueberry:   { e: '🫐', zh: '蓝莓',   en: 'Blueberry',    grow: 40, seed: 30, yield: 8, sell: 8,  n: 2 },
  watermelon:  { e: '🍉', zh: '西瓜',   en: 'Watermelon',   grow: 45, seed: 36, yield: 2, sell: 40, n: 1 },
  grape:       { e: '🍇', zh: '葡萄',   en: 'Grape',        grow: 50, seed: 40, yield: 5, sell: 16, n: 1 },
  melon:       { e: '🍈', zh: '哈密瓜', en: 'Melon',        grow: 50, seed: 42, yield: 2, sell: 46, n: 1 },
  tulip:       { e: '🌷', zh: '郁金香', en: 'Tulip',        grow: 25, seed: 30, yield: 4, sell: 18, n: 4, rare: 'sleep' },
  rose:        { e: '🌹', zh: '玫瑰',   en: 'Rose',         grow: 35, seed: 40, yield: 3, sell: 30, n: 2, rare: 'rings' },
  sunflower:   { e: '🌻', zh: '向日葵', en: 'Sunflower',    grow: 45, seed: 40, yield: 3, sell: 30, n: 2, rare: 'focus' },
  pumpkin:     { e: '🎃', zh: '南瓜',   en: 'Pumpkin',      grow: 60, seed: 60, yield: 2, sell: 70, n: 1, rare: 'steps' },
};
const CROP_STAGES = [
  { zh: '刚种下', en: 'Just planted' }, { zh: '发芽了', en: 'Sprouting' }, { zh: '长叶子', en: 'Leafing out' },
  { zh: '开花结果', en: 'Flowering' }, { zh: '成熟了', en: 'Ripe' },
];

// ---------- fruit trees (planted in the orchard) ----------
const TREES = {
  apple:  { e: '🍎', zh: '苹果树', en: 'Apple tree',  price: 60,  grow: 20, every: 12, n: 4, fruit: 'apple',  col: '#e5483b', bloom: '#ffd6dc' },
  pear:   { e: '🍐', zh: '梨树',   en: 'Pear tree',   price: 75,  grow: 25, every: 13, n: 4, fruit: 'pear',   col: '#c9d64a', bloom: '#ffffff' },
  orange: { e: '🍊', zh: '橙子树', en: 'Orange tree', price: 80,  grow: 25, every: 14, n: 4, fruit: 'orange', col: '#f59a23', bloom: '#ffffff' },
  lemon:  { e: '🍋', zh: '柠檬树', en: 'Lemon tree',  price: 70,  grow: 25, every: 12, n: 4, fruit: 'lemon',  col: '#f3d43b', bloom: '#fffbe0' },
  peach:  { e: '🍑', zh: '桃树',   en: 'Peach tree',  price: 90,  grow: 30, every: 15, n: 4, fruit: 'peach',  col: '#f7a37a', bloom: '#ffb7cf' },
  cherry: { e: '🍒', zh: '樱桃树', en: 'Cherry tree', price: 110, grow: 35, every: 16, n: 6, fruit: 'cherry', col: '#c8203a', bloom: '#ffc4d8' },
};
const TREE_STAGES = [{ zh: '树苗', en: 'Sapling' }, { zh: '小树', en: 'Young tree' }, { zh: '结果的大树', en: 'Fruiting tree' }];

// ---------- animals ----------
// price: a baby. grow: minutes to adult. Adults make `prod` every `every` minutes; every babyEvery-th time a baby instead.
// sell: [baby, young, adult]. pet: lives in the yard, not the pasture.
const ANIMALS = {
  chicken: { e: '🐔', zh: '鸡',     en: 'Chicken',   baby: { zh: '小鸡', en: 'Chick' },    price: 30,  grow: 8,  prod: 'egg',        n: 2, every: 5,  babyEvery: 4, sell: [15, 28, 50] },
  duck:    { e: '🦆', zh: '鸭子',   en: 'Duck',      baby: { zh: '小鸭', en: 'Duckling' }, price: 40,  grow: 10, prod: 'duckegg',    n: 2, every: 6,  babyEvery: 4, sell: [18, 32, 55] },
  rabbit:  { e: '🐰', zh: '兔子',   en: 'Rabbit',    baby: { zh: '小兔', en: 'Bunny' },    price: 45,  grow: 12, prod: null,         n: 0, every: 10, babyEvery: 1, sell: [22, 40, 70] },
  sheep:   { e: '🐑', zh: '绵羊',   en: 'Sheep',     baby: { zh: '小羊', en: 'Lamb' },     price: 90,  grow: 20, prod: 'wool',       n: 2, every: 12, babyEvery: 4, sell: [45, 85, 150] },
  goat:    { e: '🐐', zh: '山羊',   en: 'Goat',      baby: { zh: '小山羊', en: 'Kid' },    price: 110, grow: 22, prod: 'goatmilk',   n: 2, every: 10, babyEvery: 4, sell: [55, 100, 170] },
  pig:     { e: '🐷', zh: '猪',     en: 'Pig',       baby: { zh: '小猪', en: 'Piglet' },   price: 120, grow: 25, prod: 'truffle',    n: 1, every: 15, babyEvery: 3, sell: [60, 120, 220] },
  cow:     { e: '🐮', zh: '奶牛',   en: 'Cow',       baby: { zh: '小牛', en: 'Calf' },     price: 200, grow: 40, prod: 'milk',       n: 3, every: 10, babyEvery: 5, sell: [100, 200, 380] },
  alpaca:  { e: '🦙', zh: '羊驼',   en: 'Alpaca',    baby: { zh: '小羊驼', en: 'Cria' },   price: 260, grow: 45, prod: 'alpacawool', n: 2, every: 20, babyEvery: 5, sell: [130, 240, 420] },
  dog:     { e: '🐕', zh: '看家狗', en: 'Guard dog', baby: { zh: '小狗', en: 'Puppy' },    price: 150, grow: 20, prod: null,         n: 0, every: 0,  babyEvery: 0, sell: [60, 100, 150], pet: true, guard: true },
  cat:     { e: '🐈', zh: '猫',     en: 'Cat',       baby: { zh: '小猫', en: 'Kitten' },   price: 120, grow: 15, prod: null,         n: 0, every: 0,  babyEvery: 0, sell: [50, 80, 120], pet: true },
};
const GOODS = {
  egg:        { e: '🥚', zh: '鸡蛋',   en: 'Egg',          sell: 6 },
  duckegg:    { e: '🥚', zh: '鸭蛋',   en: 'Duck egg',     sell: 8 },
  wool:       { e: '🧶', zh: '羊毛',   en: 'Wool',         sell: 22 },
  goatmilk:   { e: '🥛', zh: '羊奶',   en: 'Goat milk',    sell: 18 },
  truffle:    { e: '🍄', zh: '松露',   en: 'Truffle',      sell: 45 },
  milk:       { e: '🥛', zh: '牛奶',   en: 'Milk',         sell: 16 },
  alpacawool: { e: '🧶', zh: '羊驼毛', en: 'Alpaca wool',  sell: 48 },
  honey:      { e: '🍯', zh: '蜂蜜',   en: 'Honey',        sell: 20 },
  fish:       { e: '🐟', zh: '鲫鱼',   en: 'Fish',         sell: 12 },
  shrimp:     { e: '🦐', zh: '河虾',   en: 'Shrimp',       sell: 18 },
  koi:        { e: '🐠', zh: '锦鲤',   en: 'Koi',          sell: 60 },
  apple:      { e: '🍎', zh: '苹果',   en: 'Apple',        sell: 6 },
  pear:       { e: '🍐', zh: '梨',     en: 'Pear',         sell: 7 },
  orange:     { e: '🍊', zh: '橙子',   en: 'Orange',       sell: 8 },
  lemon:      { e: '🍋', zh: '柠檬',   en: 'Lemon',        sell: 7 },
  peach:      { e: '🍑', zh: '桃子',   en: 'Peach',        sell: 9 },
  cherry:     { e: '🍒', zh: '樱桃',   en: 'Cherry',       sell: 6 },
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
const ORCHARD = [null, { slots: 2, cost: { coins: 200, wood: 10 } }, { slots: 4, cost: { coins: 450, wood: 20 } }, { slots: 6, cost: { coins: 800, wood: 35 } }];
const ORCHARD_SLOTS = [[9, 7], [11, 7], [13, 7], [9, 9], [11, 9], [13, 9]];
const POND = [null, { cap: 6, cost: { coins: 350, wood: 15 } }, { cap: 12, cost: { coins: 800, wood: 30 } }];
const FISH_EVERY = 6;   // minutes for a new fish to show up
const FISH_KINDS = [['fish', 0.7], ['shrimp', 0.2], ['koi', 0.1]];

// ---------- houses ----------
// fp: footprint [x, y, w, d] inside the lot. room: floor size of every storey inside.
// floors: [storeys that come with the house, most storeys you can build]. You can own several houses and pick which to live in.
const HOUSES = [
  { id: 'tent',     zh: '帐篷',     en: 'Tent',             fp: [2, 2, 3, 3], room: [4, 4],  floors: [1, 1], cost: {} },
  { id: 'cabin',    zh: '小木屋',   en: 'Log cabin',        fp: [2, 2, 4, 3], room: [5, 4],  floors: [1, 2], cost: { coins: 300, wood: 15 } },
  { id: 'cottage',  zh: '小平房',   en: 'Cottage',          fp: [2, 1, 4, 4], room: [6, 5],  floors: [1, 3], cost: { coins: 900, wood: 30 } },
  { id: 'twostory', zh: '两层小楼', en: 'Two-story house',  fp: [1, 1, 5, 4], room: [7, 6],  floors: [2, 4], cost: { coins: 2200, wood: 60 } },
  { id: 'modern',   zh: '现代别墅', en: 'Modern villa',     fp: [1, 1, 6, 4], room: [8, 6],  floors: [2, 5], cost: { coins: 3800, wood: 80 } },
  { id: 'villa',    zh: '花园别墅', en: 'Garden villa',     fp: [1, 1, 6, 4], room: [8, 7],  floors: [2, 4], cost: { coins: 5000, wood: 100 } },
  { id: 'chinese',  zh: '中式庭院', en: 'Courtyard house',  fp: [1, 1, 6, 4], room: [8, 7],  floors: [1, 3], cost: { coins: 7500, wood: 140 } },
  { id: 'mansion',  zh: '豪宅',     en: 'Mansion',          fp: [1, 1, 6, 4], room: [10, 8], floors: [2, 5], cost: { coins: 12000, wood: 180 } },
  { id: 'castle',   zh: '城堡',     en: 'Castle',           fp: [1, 1, 6, 4], room: [11, 9], floors: [2, 6], cost: { coins: 25000, wood: 300 } },
];
// Building another storey: price per floor tile of the room, growing ×1.5 with every storey. A late-game money sink.
const FLOOR_BUILD = { coinsPerTile: 40, woodPerTile: 0.8, grow: 1.5 };
const FLOOR_H = 28;                      // how much taller the house gets outside per storey you build (px)
const WALL_COLORS = ['#f4e7cc', '#fbe3c8', '#fff8ec', '#dfe9f3', '#e6efdc', '#f3d9d6', '#c99a6b', '#9aa3ad'];
const ROOF_COLORS = ['#d9534f', '#ef7d3c', '#e0aa2a', '#4f9a4b', '#3e7cc9', '#6b5bd0', '#8a5a36', '#5b6470'];
const ROOM_WALLS = ['#f3e6d3', '#dbe9f4', '#e3eed8', '#f6dede', '#ece0f4', '#fff3d1', '#d9d2c5', '#5e6b7d', '#cfe3e0', '#f2d7b6', '#3f4f46', '#ffffff'];
const FLOORS = [
  { c1: '#c89466', c2: '#b9855a' }, { c1: '#ebe6dc', c2: '#dcd5c8' }, { c1: '#9fb4c8', c2: '#94a9bd' },
  { c1: '#7a5a44', c2: '#6d503c' }, { c1: '#d9c7a7', c2: '#cfbc9b' }, { c1: '#f4f3ef', c2: '#d6d8dd' },
  { c1: '#b7d7c4', c2: '#b0d0bd' }, { c1: '#e8d9a8', c2: '#dccb97' },
];
const TINTS = ['#e5675f', '#f2a33a', '#f3d36b', '#6cbf73', '#5aa2e0', '#8b7fe0', '#e88bb7', '#8d99a6'];

// ---------- furniture (inside) ----------
// flat: rugs and mats can sit under other furniture. tint: fabric colour can be changed. use: what your townie does with it.
const FURN = {
  sleepbag:  { zh: '睡袋',       en: 'Sleeping bag',     w: 1, d: 2, price: 20,  tint: true, use: 'sleep' },
  bed:       { zh: '双人床',     en: 'Double bed',       w: 2, d: 2, price: 180, tint: true, use: 'sleep' },
  nightstand:{ zh: '床头柜',     en: 'Nightstand',       w: 1, d: 1, price: 45 },
  wardrobe:  { zh: '衣柜',       en: 'Wardrobe',         w: 2, d: 1, price: 160 },
  sofa:      { zh: '沙发',       en: 'Sofa',             w: 2, d: 1, price: 150, tint: true, use: 'sit' },
  armchair:  { zh: '扶手椅',     en: 'Armchair',         w: 1, d: 1, price: 70,  tint: true, use: 'sit' },
  beanbag:   { zh: '懒人沙发',   en: 'Bean bag',         w: 1, d: 1, price: 55,  tint: true, use: 'sit' },
  rocker:    { zh: '摇椅',       en: 'Rocking chair',    w: 1, d: 1, price: 90,  use: 'sit' },
  coffeetable:{ zh: '茶几',      en: 'Coffee table',     w: 2, d: 1, price: 70 },
  table:     { zh: '餐桌',       en: 'Dining table',     w: 2, d: 1, price: 90 },
  chair:     { zh: '椅子',       en: 'Chair',            w: 1, d: 1, price: 30,  use: 'sit' },
  desk:      { zh: '书桌电脑',   en: 'Desk & computer',  w: 2, d: 1, price: 160 },
  lamp:      { zh: '落地灯',     en: 'Floor lamp',       w: 1, d: 1, price: 40 },
  tv:        { zh: '电视',       en: 'TV',               w: 2, d: 1, price: 220 },
  shelf:     { zh: '书架',       en: 'Bookshelf',        w: 1, d: 1, price: 80 },
  plant:     { zh: '盆栽',       en: 'Potted plant',     w: 1, d: 1, price: 25 },
  monstera:  { zh: '龟背竹',     en: 'Monstera',         w: 1, d: 1, price: 65 },
  rug:       { zh: '地毯',       en: 'Rug',              w: 2, d: 2, price: 60,  tint: true, flat: true },
  fridge:    { zh: '冰箱',       en: 'Fridge',           w: 1, d: 1, price: 200 },
  stove:     { zh: '灶台',       en: 'Stove',            w: 1, d: 1, price: 150 },
  kitchen:   { zh: '橱柜水槽',   en: 'Kitchen counter',  w: 2, d: 1, price: 240 },
  washer:    { zh: '洗衣机',     en: 'Washing machine',  w: 1, d: 1, price: 180 },
  bathtub:   { zh: '浴缸',       en: 'Bathtub',          w: 2, d: 1, price: 320 },
  treadmill: { zh: '跑步机',     en: 'Treadmill',        w: 1, d: 2, price: 500, use: 'run' },
  spinbike:  { zh: '动感单车',   en: 'Exercise bike',    w: 1, d: 1, price: 380, use: 'bike' },
  dumbbells: { zh: '哑铃架',     en: 'Dumbbell rack',    w: 1, d: 1, price: 220, use: 'lift' },
  boxing:    { zh: '沙袋',       en: 'Punching bag',     w: 1, d: 1, price: 160, use: 'box' },
  yogamat:   { zh: '瑜伽垫',     en: 'Yoga mat',         w: 1, d: 2, price: 35,  tint: true, flat: true, use: 'yoga' },
  guitar:    { zh: '吉他',       en: 'Guitar',           w: 1, d: 1, price: 140 },
  drums:     { zh: '架子鼓',     en: 'Drum kit',         w: 1, d: 1, price: 420 },
  record:    { zh: '唱片机',     en: 'Record player',    w: 1, d: 1, price: 190 },
  easel:     { zh: '画架',       en: 'Easel',            w: 1, d: 1, price: 85 },
  cattree:   { zh: '猫爬架',     en: 'Cat tree',         w: 1, d: 1, price: 110 },
  grandclock:{ zh: '落地钟',     en: 'Grandfather clock', w: 1, d: 1, price: 260 },
  aquarium:  { zh: '鱼缸',       en: 'Aquarium',         w: 2, d: 1, price: 400 },
  fireplace: { zh: '壁炉',       en: 'Fireplace',        w: 2, d: 1, price: 600 },
  piano:     { zh: '钢琴',       en: 'Piano',            w: 2, d: 1, price: 900 },
  singlebed: { zh: '单人床',     en: 'Single bed',       w: 1, d: 2, price: 120, tint: true, use: 'sleep' },
  bunkbed:   { zh: '双层床',     en: 'Bunk bed',         w: 1, d: 2, price: 260, tint: true, use: 'sleep' },
  tablelamp: { zh: '台灯小几',   en: 'Table lamp',       w: 1, d: 1, price: 55 },
  arclamp:   { zh: '弧形落地灯', en: 'Arc floor lamp',   w: 1, d: 1, price: 110 },
  roundrug:  { zh: '圆地毯',     en: 'Round rug',        w: 2, d: 2, price: 75,  tint: true, flat: true },
  bigrug:    { zh: '大地毯',     en: 'Large rug',        w: 3, d: 2, price: 130, tint: true, flat: true },
  roundtable:{ zh: '圆桌',       en: 'Round table',      w: 1, d: 1, price: 85 },
  sidetable: { zh: '边几',       en: 'Side table',       w: 1, d: 1, price: 45 },
  // souvenirs: can't be bought, only earned in real life (see SOUVENIRS)
  shoerack:  { zh: '跑鞋架',     en: 'Sneaker rack',     w: 1, d: 1, price: 0, souv: true },
  moonlamp:  { zh: '月亮夜灯',   en: 'Moon lamp',        w: 1, d: 1, price: 0, souv: true },
  medal:     { zh: '三环奖牌',   en: 'Rings medal',      w: 1, d: 1, price: 0, souv: true },
  books:     { zh: '读书角',     en: 'Reading nook',     w: 1, d: 1, price: 0, souv: true },
  bonsai:    { zh: '小盆景',     en: 'Bonsai',           w: 1, d: 1, price: 0, souv: true },
  trophy:    { zh: '运动奖杯',   en: 'Trophy',           w: 1, d: 1, price: 0, souv: true },
  calendar:  { zh: '一周日历',   en: 'Week calendar',    w: 1, d: 1, price: 0, souv: true },
};
// Souvenirs: the only things money can't buy. Each comes once, from something you did in real life.
// need: which counter in S.stats, n: how much. Your home slowly becomes a diary of your real life.
const SOUVENIRS = [
  { k: 'calendar', need: 'days',        n: 7 },    // came back on 7 different days (rest days count)
  { k: 'shoerack', need: 'goalDays',    n: 3 },    // reached your own step goal on 3 days
  { k: 'moonlamp', need: 'sleepStreak', n: 3 },    // slept 80+ three nights in a row
  { k: 'medal',    need: 'ringsAll',    n: 1 },    // closed all three rings once
  { k: 'books',    need: 'focus120',    n: 1 },    // stayed off distracting apps for 2 hours once
  { k: 'bonsai',   need: 'mindful',     n: 30 },   // 30 mindful minutes in total
  { k: 'trophy',   need: 'workouts',    n: 10 },   // 10 workouts of 10+ minutes
];

// ---------- yard (outside) ----------
const YARD = {
  flowers:   { zh: '花坛',       en: 'Flower bed',     w: 1, d: 1, price: 30 },
  hedge:     { zh: '灌木',       en: 'Hedge',          w: 1, d: 1, price: 20 },
  tree:      { zh: '大树',       en: 'Shade tree',     w: 1, d: 1, price: 50 },
  pine:      { zh: '松树',       en: 'Pine tree',      w: 1, d: 1, price: 40 },
  lamp:      { zh: '路灯',       en: 'Lamp post',      w: 1, d: 1, price: 60 },
  bench:     { zh: '长椅',       en: 'Bench',          w: 1, d: 1, price: 50 },
  gnome:     { zh: '花园小矮人', en: 'Garden gnome',   w: 1, d: 1, price: 35 },
  birdbath:  { zh: '鸟浴盆',     en: 'Bird bath',      w: 1, d: 1, price: 70 },
  scarecrow: { zh: '稻草人',     en: 'Scarecrow',      w: 1, d: 1, price: 45 },
  beehive:   { zh: '蜂箱',       en: 'Beehive',        w: 1, d: 1, price: 160, prod: 'honey', n: 2, every: 20 },
  doghouse:  { zh: '狗屋',       en: 'Doghouse',       w: 1, d: 1, price: 90 },
  well:      { zh: '水井',       en: 'Well',           w: 1, d: 1, price: 140 },
  campfire:  { zh: '篝火',       en: 'Campfire',       w: 1, d: 1, price: 80 },
  bbq:       { zh: '烧烤架',     en: 'BBQ grill',      w: 1, d: 1, price: 120 },
  picnic:    { zh: '野餐桌',     en: 'Picnic table',   w: 2, d: 1, price: 130 },
  swing:     { zh: '秋千',       en: 'Swing',          w: 2, d: 1, price: 180 },
  hammock:   { zh: '吊床',       en: 'Hammock',        w: 2, d: 1, price: 150 },
  slide:     { zh: '滑梯',       en: 'Slide',          w: 1, d: 2, price: 220 },
  trampoline:{ zh: '蹦床',       en: 'Trampoline',     w: 2, d: 2, price: 260 },
  arch:      { zh: '玫瑰花拱门', en: 'Rose arch',      w: 1, d: 1, price: 150 },
  windmill:  { zh: '风车',       en: 'Windmill',       w: 1, d: 1, price: 320 },
  fountain:  { zh: '喷泉',       en: 'Fountain',       w: 2, d: 2, price: 600 },
  pool:      { zh: '泳池',       en: 'Pool',           w: 3, d: 2, price: 1500 },
};

// ---------- vehicles ----------
const CARS = {
  bike:        { zh: '自行车',     en: 'Bicycle',       cost: { coins: 120 },   kind: 'two' },
  scooter:     { zh: '电动车',     en: 'E-bike',        cost: { coins: 350 },   kind: 'two' },
  vespa:       { zh: '踏板摩托',   en: 'Vespa scooter', cost: { coins: 700 },   kind: 'two' },
  motorcycle:  { zh: '摩托车',     en: 'Motorcycle',    cost: { coins: 1100 },  kind: 'two' },
  sportbike:   { zh: '赛车摩托',   en: 'Sport bike',    cost: { coins: 2600 },  kind: 'two' },
  mini:        { zh: '小轿车',     en: 'Compact car',   cost: { coins: 1200 } },
  sedan:       { zh: '三厢轿车',   en: 'Sedan',         cost: { coins: 2000 } },
  convertible: { zh: '敞篷车',     en: 'Convertible',   cost: { coins: 4500 } },
  pickup:      { zh: '皮卡',       en: 'Pickup truck',  cost: { coins: 2500 } },
  suv:         { zh: 'SUV',        en: 'SUV',           cost: { coins: 4000 } },
  jeep:        { zh: '越野车',     en: 'Off-roader',    cost: { coins: 5200 } },
  sports:      { zh: '跑车',       en: 'Sports car',    cost: { coins: 9000 } },
  tractor:     { zh: '拖拉机',     en: 'Tractor',       cost: { coins: 3000 } },
  camper:      { zh: '房车',       en: 'Camper van',    cost: { coins: 15000 } },
  luxury:      { zh: '豪华轿车',   en: 'Luxury sedan',  cost: { coins: 7500 } },
  muscle:      { zh: '肌肉车',     en: 'Muscle car',    cost: { coins: 6500 } },
  supercar:    { zh: '超级跑车',   en: 'Supercar',      cost: { coins: 20000 } },
  minivan:     { zh: '面包车',     en: 'Minivan',       cost: { coins: 2800 } },
  boxtruck:    { zh: '厢式卡车',   en: 'Box truck',     cost: { coins: 6000 } },
};
const CAR_COLORS = ['#e5484d', '#f59e0b', '#f2d24b', '#34b27b', '#2f80ed', '#a46ef0', '#f4f4f0', '#2d2d2d'];

// ---------- shop: second-level categories ----------
// Every big category is split again so the list never gets too long. keys: what goes in it ('*' = everything left).
const SHOP_SUBS = {
  seeds: [
    { id: 'grain', e: '🌾', zh: '粮食', en: 'Grains', keys: ['wheat', 'corn', 'potato', 'sweetpotato'] },
    { id: 'veg', e: '🥕', zh: '蔬菜', en: 'Veggies', keys: ['carrot', 'onion', 'garlic', 'cabbage', 'broccoli', 'tomato', 'cucumber', 'eggplant', 'chili', 'pepper', 'pumpkin'] },
    { id: 'fruit', e: '🍓', zh: '水果', en: 'Fruit', keys: ['strawberry', 'blueberry', 'watermelon', 'grape', 'melon'] },
    { id: 'flower', e: '🌷', zh: '花', en: 'Flowers', keys: ['tulip', 'rose', 'sunflower'] },
  ],
  animals: [
    { id: 'poultry', e: '🐔', zh: '家禽', en: 'Poultry', keys: ['chicken', 'duck'] },
    { id: 'farm', e: '🐮', zh: '家畜', en: 'Livestock', keys: ['rabbit', 'sheep', 'goat', 'pig', 'cow', 'alpaca'] },
    { id: 'pets', e: '🐕', zh: '宠物', en: 'Pets', keys: ['dog', 'cat'] },
  ],
  furn: [
    { id: 'bed', e: '🛏️', zh: '床', en: 'Beds', keys: ['sleepbag', 'singlebed', 'bed', 'bunkbed', 'nightstand', 'wardrobe'] },
    { id: 'seat', e: '🛋️', zh: '沙发椅子', en: 'Seating', keys: ['sofa', 'armchair', 'beanbag', 'rocker', 'chair'] },
    { id: 'table', e: '🪑', zh: '桌子', en: 'Tables', keys: ['coffeetable', 'table', 'roundtable', 'sidetable', 'desk'] },
    { id: 'lamp', e: '💡', zh: '灯', en: 'Lamps', keys: ['lamp', 'arclamp', 'tablelamp'] },
    { id: 'rug', e: '🟫', zh: '地毯', en: 'Rugs', keys: ['rug', 'roundrug', 'bigrug'] },
    { id: 'kitchen', e: '🍳', zh: '厨房浴室', en: 'Kitchen & bath', keys: ['fridge', 'stove', 'kitchen', 'washer', 'bathtub'] },
    { id: 'fit', e: '🏋️', zh: '健身', en: 'Fitness', keys: ['treadmill', 'spinbike', 'dumbbells', 'boxing', 'yogamat'] },
    { id: 'fun', e: '🎸', zh: '娱乐爱好', en: 'Hobbies', keys: ['tv', 'guitar', 'drums', 'record', 'easel', 'piano', 'aquarium'] },
    { id: 'decor', e: '🪴', zh: '装饰', en: 'Decor', keys: ['plant', 'monstera', 'shelf', 'grandclock', 'fireplace', 'cattree'] },
    { id: 'souv', e: '✨', zh: '纪念品', en: 'Souvenirs', keys: [] },
  ],
  yard: [
    { id: 'plants', e: '🌳', zh: '花草树木', en: 'Plants', keys: ['flowers', 'hedge', 'tree', 'pine', 'arch'] },
    { id: 'leisure', e: '🪑', zh: '休闲', en: 'Leisure', keys: ['bench', 'swing', 'hammock', 'picnic', 'campfire', 'bbq'] },
    { id: 'kids', e: '🛝', zh: '儿童', en: 'Play', keys: ['slide', 'trampoline'] },
    { id: 'farmy', e: '🌾', zh: '农场', en: 'Farm', keys: ['scarecrow', 'beehive', 'well', 'windmill', 'doghouse'] },
    { id: 'water', e: '⛲', zh: '水景', en: 'Water', keys: ['birdbath', 'fountain', 'pool'] },
    { id: 'deco', e: '💡', zh: '灯和摆件', en: 'Lights & decor', keys: ['lamp', 'gnome'] },
  ],
  cars: [
    { id: 'two', e: '🚲', zh: '两轮', en: 'Two wheels', keys: ['bike', 'scooter', 'vespa', 'motorcycle', 'sportbike'] },
    { id: 'car', e: '🚗', zh: '轿车', en: 'Cars', keys: ['mini', 'sedan', 'luxury', 'convertible'] },
    { id: 'suv', e: '🚙', zh: 'SUV 越野', en: 'SUV', keys: ['suv', 'jeep'] },
    { id: 'sport', e: '🏎️', zh: '跑车', en: 'Sports', keys: ['sports', 'muscle', 'supercar'] },
    { id: 'truck', e: '🚚', zh: '卡车', en: 'Trucks', keys: ['pickup', 'boxtruck', 'tractor'] },
    { id: 'van', e: '🚐', zh: '面包车房车', en: 'Vans', keys: ['minivan', 'camper'] },
  ],
  houses: [
    { id: 'small', e: '⛺', zh: '小屋', en: 'Small', keys: ['tent', 'cabin', 'cottage'] },
    { id: 'family', e: '🏠', zh: '家庭', en: 'Family', keys: ['twostory', 'modern', 'villa'] },
    { id: 'grand', e: '🏰', zh: '豪华', en: 'Grand', keys: ['chinese', 'mansion', 'castle'] },
  ],
  sell: [
    { id: 'crops', e: '🥕', zh: '作物', en: 'Crops', keys: [] },
    { id: 'goods', e: '🥚', zh: '畜产品', en: 'Animal goods', keys: [] },
    { id: 'fruits', e: '🍎', zh: '水果', en: 'Fruit', keys: [] },
    { id: 'fish', e: '🐟', zh: '鱼虾', en: 'Fish', keys: [] },
    { id: 'babies', e: '🐣', zh: '幼崽', en: 'Babies', keys: [] },
  ],
};

// ---------- real life: screen time ----------
const APPS = [
  { id: 'tiktok', name: 'TikTok', emoji: '🎵' }, { id: 'instagram', name: 'Instagram', emoji: '📸' },
  { id: 'youtube', name: 'YouTube', emoji: '▶️' }, { id: 'x', name: 'X', emoji: '✖️' },
  { id: 'reddit', name: 'Reddit', emoji: '👽' }, { id: 'games', name: null, emoji: '🎮' },
];
// Longer offline stretches pay more than the sum of short ones. Not affected by energy.
const FOCUS_REWARD = {
  30: { coins: 15, wood: 2 },
  60: { coins: 35, wood: 5 },
  120: { coins: 80, wood: 12, seeds: { sunflower: 1 } },
};

// ---------- real life: Apple Health ----------
// Sleep score sets today's energy, and energy multiplies everything earned from exercise.
const ENERGY_LEVELS = [ // highest first
  { id: 'great',     min: 85, mult: 1.3 },
  { id: 'good',      min: 70, mult: 1.0 },
  { id: 'tired',     min: 50, mult: 0.75 },
  { id: 'exhausted', min: 0,  mult: 0.5 },
];
const STEP_REWARD = { coins: 10, wood: 1 };   // per sixth of YOUR step goal (1,000 steps at a 6,000 goal), wheelchair pushes count
const STEP_BLOCKS_MAX = 9;                     // paid up to 150 % of your goal, so a marathoner doesn't out-earn a beginner
const STEP_GOAL_RANGE = [3000, 12000];         // your goal = 110 % of your last 7 days' average, rounded to 500
const WORKOUT_PAY_MAX = 90;                    // workout minutes paid per day
const GOAL_REWARD = { coins: 20, wood: 3, seeds: { pumpkin: 1 } };
const RINGS = { move: 500, exercise: 30, stand: 12 };          // kcal, minutes, hours
const RING_REWARD = {
  move: { coins: 25, wood: 3 }, exercise: { coins: 25, wood: 3 }, stand: { coins: 15, wood: 2 },
  all: { coins: 40, wood: 5, seeds: { rose: 1 } },
};
const SLEEP_REWARD = { coins: 20, seeds: { tulip: 1 } };       // for a sleep score of 80+
const MINDFUL_REWARD = 5;                                       // coins per mindful minute, up to 10 a day
const WORKOUTS = {
  walk:     { e: '🚶', zh: '户外步行', en: 'Outdoor walk', kcal: 5 },
  run:      { e: '🏃', zh: '跑步',     en: 'Run',          kcal: 11 },
  cycle:    { e: '🚴', zh: '骑车',     en: 'Cycling',      kcal: 9 },
  swim:     { e: '🏊', zh: '游泳',     en: 'Swim',         kcal: 10 },
  strength: { e: '🏋️', zh: '力量训练', en: 'Strength',     kcal: 7 },
  yoga:     { e: '🧘', zh: '瑜伽',     en: 'Yoga',         kcal: 4 },
  hiit:     { e: '🔥', zh: '高强度间歇', en: 'HIIT',       kcal: 12 },
  dance:    { e: '💃', zh: '舞蹈',     en: 'Dance',        kcal: 8 },
  wheel:    { e: '🦽', zh: '轮椅运动', en: 'Wheelchair',   kcal: 6 },
};

// ---------- avatars ----------
const COLORS = ['#ef6f6c', '#f59e0b', '#e8c02e', '#34b27b', '#38a3e0', '#6366f1', '#a46ef0', '#ec6aa8'];
const SKINS = ['#ffe0c4', '#f3c59f', '#d39a6c', '#9a6440'];
const HAIRS = ['short', 'long', 'bun', 'curly'];
const HAIR_COLORS = ['#2b1d14', '#6b4226', '#c98a3c', '#e9cf7a', '#b5462e', '#8f8f99'];
const MSG_KEYS = ['msg_nice', 'msg_walk', 'msg_cheer', 'msg_veg'];
const PAPERS = [ // letter paper: background, accent
  { id: 'cream', bg: '#fff8e8', ac: '#d9a441' }, { id: 'sky', bg: '#eaf5ff', ac: '#4f8ef7' },
  { id: 'rose', bg: '#fff0f3', ac: '#e8708f' }, { id: 'leaf', bg: '#eef8ea', ac: '#4caf6a' },
];

// ---------- simulated friends ----------
// Friends' homes use the same shape as yours so they draw, rank and can be visited the same way.
const FRIEND_PRESETS = [
  { id: 'li', name: { zh: '小李', en: 'Ava' }, slot: 5,
    look: { shirt: '#ec6aa8', skin: SKINS[0], hair: 'long', hairCol: '#2b1d14', mob: 'walk' },
    house: 3, wall: '#fbe3c8', roof: '#d9534f', floor: 0, roomWall: 3,
    fieldLv: 1, crops: ['strawberry', 'strawberry', 'tomato', 'tomato', 'corn', 'carrot', 'eggplant', 'wheat'], ripe: [0, 1, 4, 5],
    pastureLv: 2, animals: [['chicken', 2], ['chicken', 2], ['duck', 2], ['sheep', 2], ['cow', 1], ['dog', 2]],
    orchardLv: 1, trees: [['apple', 2], ['cherry', 1]], pondLv: 1,
    cars: [['mini', '#e5484d']],
    furn: [['sofa', '#5aa2e0'], 'tv', ['rug', '#f3d36b'], 'monstera', 'lamp', 'piano', 'fridge', 'kitchen', 'table', 'chair'],
    furn2: [['bed', '#e88bb7'], 'nightstand', 'shelf', 'wardrobe', ['yogamat', '#e88bb7'], 'plant', 'moonlamp'], up2: [4, 1],
    yard: ['flowers', 'flowers', 'tree', 'lamp', 'bench', 'beehive'],
    coins: 2400, wood: 40, likes: 20, shareGoal: true, shareLive: true, shareMood: true, earn: 30 },
  { id: 'wang', name: { zh: '小王', en: 'Leo' }, slot: 7,
    look: { shirt: '#4f8ef7', skin: SKINS[2], hair: 'short', hairCol: '#1d1a17', mob: 'walk' },
    house: 2, wall: '#f4e7cc', roof: '#3e7cc9', floor: 1, roomWall: 1,
    fieldLv: 0, crops: ['corn', 'potato', 'wheat', 'cabbage'], ripe: [2],
    pastureLv: 1, animals: [['chicken', 2], ['pig', 2], ['goat', 0]],
    orchardLv: 0, trees: [], pondLv: 0,
    cars: [['motorcycle', '#2d2d2d']],
    furn: [['bed', '#5aa2e0'], 'table', 'chair', 'chair', 'shelf', 'stove', 'treadmill', 'dumbbells'],
    yard: ['pine', 'bbq', 'doghouse'],
    coins: 900, wood: 20, likes: 12, shareGoal: true, shareLive: true, shareMood: false, earn: 22 },
  { id: 'mia', name: { zh: 'Mia', en: 'Mia' }, slot: 4,
    look: { shirt: '#f2a33a', skin: SKINS[1], hair: 'bun', hairCol: '#b5462e', mob: 'wheel' },
    house: 1, wall: '#c99a6b', roof: '#4f9a4b', floor: 4, roomWall: 2,
    fieldLv: 0, crops: ['carrot', 'carrot', null, 'blueberry'], ripe: [0],
    pastureLv: 0, animals: [['cat', 2]], orchardLv: 0, trees: [], pondLv: 0, cars: [['scooter', '#34b27b']],
    furn: [['sleepbag', '#6cbf73'], 'plant', 'monstera', ['yogamat', '#8b7fe0'], 'lamp', 'easel', 'record'],
    yard: ['flowers', 'flowers', 'flowers', 'gnome', 'hedge', 'birdbath', 'arch'],
    coins: 380, wood: 12, likes: 5, shareGoal: false, shareLive: false, shareMood: false, earn: 18 },
];
const POOL_BASE = { house: 0, wall: '#f4e7cc', floor: 0, roomWall: 0, fieldLv: 0, crops: [], ripe: [], pastureLv: 0, animals: [],
  orchardLv: 0, trees: [], pondLv: 0, cars: [], yard: [], coins: 120, wood: 5, likes: 0, earn: 20 };
const FRIEND_POOL = [
  { ...POOL_BASE, id: 'chen', name: { zh: '阿晨', en: 'Noah' }, look: { shirt: '#2fb67c', skin: SKINS[3], hair: 'curly', hairCol: '#1d1a17', mob: 'walk' }, roof: '#2fb67c', furn: [['sleepbag', '#5aa2e0']], shareGoal: true, shareLive: true },
  { ...POOL_BASE, id: 'yu', name: { zh: '小雨', en: 'Zoe' }, look: { shirt: '#8b6cf0', skin: SKINS[0], hair: 'long', hairCol: '#6b4226', mob: 'walk' }, roof: '#8b6cf0', furn: [['sleepbag', '#e88bb7']], shareGoal: false },
  { ...POOL_BASE, id: 'kai', name: { zh: '阿凯', en: 'Kai' }, look: { shirt: '#e5484d', skin: SKINS[1], hair: 'short', hairCol: '#c98a3c', mob: 'walk' }, roof: '#e5484d', furn: [['sleepbag', '#f2a33a']], shareGoal: true, shareLive: true, shareMood: true },
  { ...POOL_BASE, id: 'lin', name: { zh: '林林', en: 'Lily' }, look: { shirt: '#38a3e0', skin: SKINS[2], hair: 'bun', hairCol: '#2b1d14', mob: 'walk' }, roof: '#38a3e0', furn: [['sleepbag', '#6cbf73']], shareGoal: false },
];

// What the townie does while the real you is working out ("mini me").
const WORKOUT_POSE = { walk: 'walk', run: 'run', cycle: 'bike', swim: 'swim', strength: 'lift', yoga: 'yoga', hiit: 'jacks', dance: 'dance', wheel: 'walk' };
// Fruit stages and the plaza use minutes too; the game converts with MIN where it needs milliseconds.

// ---------- pets (v0.8) ----------
// Dogs and cats live with you: pick a breed, give it a name, and look after it in its own pet page.
// They need meals, fresh water, a clean litter box (cats) or a walk (dogs), and love. They never get sick,
// run away or die: when you forget, they just look sad until you come back (reward, never punish).
const PET_BREEDS = {
  shiba:   { kind: 'dog', zh: '柴犬', en: 'Shiba Inu', price: 600, col: '#e0913f', belly: '#fff3e2', ears: 'up', tail: 'curl' },
  corgi:   { kind: 'dog', zh: '柯基', en: 'Corgi', price: 700, col: '#e8a24a', belly: '#fffaf2', ears: 'big', tail: 'stub', short: true },
  golden:  { kind: 'dog', zh: '金毛', en: 'Golden Retriever', price: 800, col: '#e7b75f', belly: '#f4d999', ears: 'flop', tail: 'plume', big: true },
  husky:   { kind: 'dog', zh: '哈士奇', en: 'Husky', price: 800, col: '#7b838d', belly: '#f6f6f3', ears: 'up', tail: 'plume', mask: true, eyes: '#5aa7e0', big: true },
  poodle:  { kind: 'dog', zh: '泰迪', en: 'Poodle', price: 700, col: '#a8714a', belly: '#b98560', ears: 'flop', tail: 'pom', curly: true },
  tabby:   { kind: 'cat', zh: '橘猫', en: 'Orange tabby', price: 400, col: '#f0a04b', belly: '#fff1dc', stripe: '#d17a2a', eyes: '#8bbf3a' },
  black:   { kind: 'cat', zh: '黑猫', en: 'Black cat', price: 400, col: '#34302e', belly: '#46403c', eyes: '#f2c230' },
  white:   { kind: 'cat', zh: '白猫', en: 'White cat', price: 500, col: '#f6f3ed', belly: '#ffffff', eyes: '#6fb6e8' },
  calico:  { kind: 'cat', zh: '三花', en: 'Calico', price: 500, col: '#f7f2ea', belly: '#ffffff', spots: ['#e0913f', '#3b3330'], eyes: '#c9a23a' },
  ragdoll: { kind: 'cat', zh: '布偶猫', en: 'Ragdoll', price: 900, col: '#f2e8da', belly: '#fffaf3', point: '#7d665a', eyes: '#5aa7e0', fluffy: true },
};
const PET_MAX = 4;                 // pets per home
// Each need runs from 100 down to 0 over this many hours; at PET_REMIND or below the pet asks for you.
const PET_NEEDS = {
  food:  { e: '🍖', hours: 8 },    // a meal three times a day
  water: { e: '💧', hours: 12 },   // fresh water twice a day
  clean: { e: '🧹', hours: 24 },   // cats: scoop the litter box once a day; dogs: a walk once a day
  love:  { e: '❤️', hours: 16 },   // petting and playing
};
const PET_REMIND = 30;
const PET_LOVE = { pet: 15, play: 30, treat: 40 };   // how much love petting, playing and a treat give
// Pet food is bought with coins and used up; one bag is several meals.
const PET_FOOD = {
  dogfood: { e: '🦴', zh: '狗粮', en: 'Dog food', kind: 'dog', n: 10, price: 40 },
  catfood: { e: '🐟', zh: '猫粮', en: 'Cat food', kind: 'cat', n: 10, price: 40 },
  treats:  { e: '🍪', zh: '零食', en: 'Treats', kind: 'any', n: 5, price: 30 },
};
const PET_START_FOOD = 6;          // a new pet comes with this many meals
const PET_NAMES = {
  dog: { zh: ['旺财', '豆豆', '可乐', '阿黄', '布丁', '小虎'], en: ['Buddy', 'Max', 'Bella', 'Daisy', 'Coco', 'Milo'] },
  cat: { zh: ['咪咪', '橘子', '团子', '奶茶', '芝麻', '小雪'], en: ['Luna', 'Mochi', 'Simba', 'Nala', 'Oreo', 'Kitty'] },
};
// Pet things for the house (also sold in the shop's pet section). A new pet gets a free bowl (and a litter box for a cat).
Object.assign(FURN, {
  petbowl:   { zh: '食盆水盆', en: 'Food & water bowls', w: 1, d: 1, price: 30, pet: true },
  litterbox: { zh: '猫砂盆',   en: 'Litter box',         w: 1, d: 1, price: 50, pet: true },
  petbed:    { zh: '宠物窝',   en: 'Pet bed',            w: 1, d: 1, price: 90, pet: true, tint: true },
});
SHOP_SUBS.animals = SHOP_SUBS.animals.filter(s => s.id !== 'pets');
SHOP_SUBS.pets = [
  { id: 'dogs', e: '🐕', zh: '狗狗', en: 'Dogs', keys: Object.keys(PET_BREEDS).filter(k => PET_BREEDS[k].kind === 'dog') },
  { id: 'cats', e: '🐈', zh: '猫咪', en: 'Cats', keys: Object.keys(PET_BREEDS).filter(k => PET_BREEDS[k].kind === 'cat') },
  { id: 'food', e: '🦴', zh: '粮食零食', en: 'Food', keys: Object.keys(PET_FOOD) },
  { id: 'gear', e: '🧺', zh: '用品', en: 'Supplies', keys: ['petbowl', 'litterbox', 'petbed', 'cattree'] },
];
SHOP_SUBS.furn.find(s => s.id === 'decor').keys = SHOP_SUBS.furn.find(s => s.id === 'decor').keys.filter(k => k !== 'cattree');

// ---------- the world (v0.9) ----------
// Mirror Town is one community of many. Every community is a town like ours (same streets), with its own look,
// its own residents, and its own land prices. You can look around any of them and move your whole home there.
// The prototype makes the residents up; the real game fills them with real players (needs the server).
const TOWN_THEMES = {
  maple:    { woods: '#8fc469', town: '#a6d47f', lawn: '#a3d47c', vacant: '#c4dea0', leaf: ['#3f8c45', '#5aa552', '#74c169'], tree: 'round' },
  sakura:   { woods: '#93c66f', town: '#acd585', lawn: '#a7d483', vacant: '#cfe2ab', leaf: ['#e58aae', '#f3aecb', '#fbd0e0'], tree: 'round', petals: true },
  autumn:   { woods: '#a9bf6a', town: '#b8cf80', lawn: '#b2cd7c', vacant: '#d6dfa6', leaf: ['#c9532a', '#e88a2e', '#f2b544'], tree: 'round' },
  palm:     { woods: '#9ccf6a', town: '#b6da88', lawn: '#addb82', vacant: '#e3e6b0', leaf: ['#3f9a4a', '#57b45a', '#7fcf6a'], tree: 'palm', sand: '#ecd9a6' },
  snow:     { woods: '#e8eff3', town: '#f1f5f8', lawn: '#eef4f7', vacant: '#e2ebf0', leaf: ['#2f6b4f', '#3f7d5f', '#f8fbfc'], tree: 'pine', snow: true },
  desert:   { woods: '#dfc28c', town: '#e8d3a6', lawn: '#e6d2a2', vacant: '#efe1bf', leaf: ['#5f9a4f', '#79b05e', '#93c46f'], tree: 'cactus' },
  lavender: { woods: '#93c26e', town: '#a9d281', lawn: '#a5d17e', vacant: '#cfe1ad', leaf: ['#4f8c45', '#68a552', '#83bd66'], tree: 'round', rows: ['#9b7fd0', '#b39ae0', '#8a6cc4'] },
  tulip:    { woods: '#90c46b', town: '#a8d480', lawn: '#a4d37d', vacant: '#cde2aa', leaf: ['#3f8c45', '#5aa552', '#74c169'], tree: 'round', rows: ['#e5484d', '#f2c230', '#ef7d9c', '#f28c28'] },
  bamboo:   { woods: '#86c065', town: '#a2d07f', lawn: '#9fcf7b', vacant: '#c8e0a6', leaf: ['#5f9e3f', '#86c05a', '#a8d67a'], tree: 'bamboo' },
  fjord:    { woods: '#7fb070', town: '#9cc985', lawn: '#98c781', vacant: '#c2dbaa', leaf: ['#2f5f43', '#3f7352', '#557f60'], tree: 'pine' },
};
const COMMUNITIES = {
  wutong:  { zh: '梧桐镇', en: 'Maple Town', place: { zh: '美国 · 加州', en: 'California, USA' }, flag: '🇺🇸', lon: -120, lat: 37, theme: 'maple', price: 1, pop: 1280, region: 'na' },
  palmbay: { zh: '椰林湾', en: 'Palm Bay', place: { zh: '美国 · 佛罗里达', en: 'Florida, USA' }, flag: '🇺🇸', lon: -81, lat: 26, theme: 'palm', price: 1.3, pop: 2140, region: 'na' },
  cactus:  { zh: '仙人掌镇', en: 'Cactus Flats', place: { zh: '美国 · 亚利桑那', en: 'Arizona, USA' }, flag: '🇺🇸', lon: -111, lat: 33, theme: 'desert', price: 0.7, pop: 640, region: 'na' },
  vermont: { zh: '红枫谷', en: 'Red Maple Vale', place: { zh: '美国 · 佛蒙特', en: 'Vermont, USA' }, flag: '🇺🇸', lon: -72.6, lat: 44, theme: 'autumn', price: 0.9, pop: 860, region: 'na' },
  banff:   { zh: '松雪村', en: 'Pine Hollow', place: { zh: '加拿大 · 班夫', en: 'Banff, Canada' }, flag: '🇨🇦', lon: -115.6, lat: 51, theme: 'snow', price: 0.8, pop: 520, region: 'na' },
  provence:{ zh: '薰衣草谷', en: 'Lavender Vale', place: { zh: '法国 · 普罗旺斯', en: 'Provence, France' }, flag: '🇫🇷', lon: 5.5, lat: 43.9, theme: 'lavender', price: 1.2, pop: 930, region: 'eu' },
  holland: { zh: '风车村', en: 'Tulip Mill', place: { zh: '荷兰', en: 'Netherlands' }, flag: '🇳🇱', lon: 4.9, lat: 52.4, theme: 'tulip', price: 1.1, pop: 1010, region: 'eu' },
  fjord:   { zh: '峡湾村', en: 'Fjord Haven', place: { zh: '挪威', en: 'Norway' }, flag: '🇳🇴', lon: 7, lat: 61, theme: 'fjord', price: 1, pop: 410, region: 'eu' },
  kyoto:   { zh: '樱花町', en: 'Sakura Hill', place: { zh: '日本 · 京都', en: 'Kyoto, Japan' }, flag: '🇯🇵', lon: 135.8, lat: 35, theme: 'sakura', price: 1.4, pop: 1760, region: 'asia' },
  hangzhou:{ zh: '竹林镇', en: 'Bamboo Grove', place: { zh: '中国 · 杭州', en: 'Hangzhou, China' }, flag: '🇨🇳', lon: 120.2, lat: 30.3, theme: 'bamboo', price: 1.1, pop: 2380, region: 'asia' },
  sydney:  { zh: '桉树湾', en: 'Gum Tree Cove', place: { zh: '澳大利亚 · 悉尼', en: 'Sydney, Australia' }, flag: '🇦🇺', lon: 151.2, lat: -33.9, theme: 'palm', price: 1.2, pop: 1320, region: 'oc' },
  andes:   { zh: '咖啡山', en: 'Coffee Hills', place: { zh: '哥伦比亚', en: 'Colombia' }, flag: '🇨🇴', lon: -75.6, lat: 5, theme: 'bamboo', price: 0.6, pop: 380, region: 'sa' },
};
Object.assign(COMMUNITIES, {
  london:  { zh: '玫瑰镇', en: 'Rose Green', place: { zh: '英国 · 伦敦郊外', en: 'Near London, UK' }, flag: '🇬🇧', lon: -0.5, lat: 51.4, theme: 'tulip', price: 1.5, pop: 1640, region: 'eu' },
  seoul:   { zh: '银杏村', en: 'Ginkgo Village', place: { zh: '韩国 · 首尔', en: 'Seoul, Korea' }, flag: '🇰🇷', lon: 127, lat: 37.5, theme: 'autumn', price: 1.3, pop: 1490, region: 'asia' },
  rio:     { zh: '海风湾', en: 'Sea Breeze Bay', place: { zh: '巴西 · 里约', en: 'Rio, Brazil' }, flag: '🇧🇷', lon: -43.2, lat: -22.9, theme: 'palm', price: 0.8, pop: 1120, region: 'sa' },
  capetown:{ zh: '好望角村', en: 'Cape Village', place: { zh: '南非 · 开普敦', en: 'Cape Town, South Africa' }, flag: '🇿🇦', lon: 18.4, lat: -33.9, theme: 'desert', price: 0.7, pop: 560, region: 'af' },
});
const REGIONS = {
  na: { e: '🗽', zh: '北美', en: 'North America' }, sa: { e: '🦜', zh: '南美', en: 'South America' }, eu: { e: '🏰', zh: '欧洲', en: 'Europe' },
  af: { e: '🦒', zh: '非洲', en: 'Africa' }, asia: { e: '🏯', zh: '亚洲', en: 'Asia' }, oc: { e: '🦘', zh: '大洋洲', en: 'Oceania' },
};
const HOME_TOWN = 'wutong';   // where everyone starts (and where your friends live in the prototype)

// ---------- trophies (v0.10) ----------
// Earned in real life only. Three tiers each. Streak trophies: days in a row; sport trophies: one for every
// Apple Watch workout type (a workout of 10 minutes or more counts). Each trophy tier can unlock the right to
// buy an exclusive thing (EXCLUSIVE below) that everyone visiting your home can see.
const TROPHY_TIERS = [
  { e: '🥉', zh: '铜', en: 'Bronze', col: '#c98a4a' },
  { e: '🥈', zh: '银', en: 'Silver', col: '#aab4bf' },
  { e: '🥇', zh: '金', en: 'Gold', col: '#f2c230' },
];
const STREAK_TROPHIES = {
  steps10k: { e: '👟', zh: '万步达人', en: '10k Walker', need: 10000, tiers: [7, 15, 30], excl: ['walkerstatue', 'goldginkgo', 'champcar'],
    desc: { zh: '连续 {n} 天，每天走 1 万步', en: '{n} days in a row with 10,000 steps' } },
  steps20k: { e: '⚡', zh: '两万步传奇', en: '20k Legend', need: 20000, tiers: [7, 15, 30], excl: ['collie', 'triumph', 'rainbowalpaca'],
    desc: { zh: '连续 {n} 天，每天走 2 万步', en: '{n} days in a row with 20,000 steps' } },
  rings: { e: '⭕', zh: '三环连胜', en: 'Ring Streak', tiers: [7, 30, 100], excl: ['ringfountain', 'ringgarden', 'ringtower'],
    desc: { zh: '连续 {n} 天合上三个圆环', en: 'Close all three rings {n} days in a row' } },
};
const SPORT_TIERS = [1, 10, 50];   // workouts of one kind for bronze / silver / gold
// Sport groups: a gold trophy in any sport of a group unlocks the group's exclusive.
const SPORT_GROUPS = {
  walk: { e: '🚶', zh: '走路', en: 'Walking' }, run: { e: '🏃', zh: '跑步', en: 'Running', excl: 'finisharch' },
  cycle: { e: '🚴', zh: '骑行', en: 'Cycling', excl: 'goldbike' }, swim: { e: '🏊', zh: '游泳和水上', en: 'Swimming & water', excl: 'dolphinfountain' },
  hike: { e: '🥾', zh: '登山攀岩', en: 'Hiking & climbing', excl: 'cabin' }, mind: { e: '🧘', zh: '瑜伽身心', en: 'Yoga & mind', excl: 'zengarden' },
  strength: { e: '🏋️', zh: '力量格斗', en: 'Strength & combat', excl: 'podium' }, cardio: { e: '🔥', zh: '有氧舞蹈', en: 'Cardio & dance', excl: 'stage' },
  team: { e: '🏀', zh: '球类', en: 'Ball sports', excl: 'court' }, snow: { e: '⛷️', zh: '冰雪', en: 'Snow & ice', excl: 'igloo' },
  outdoor: { e: '🏹', zh: '户外与其他', en: 'Outdoor & more', excl: 'flame' },
};
// Every Apple Watch workout type: [id, HealthKit raw value, emoji, 中文, English, group].
const SPORTS = [
  ['walking', 52, '🚶', '步行', 'Walking', 'walk'], ['wheelchairWalk', 70, '🦽', '轮椅步行速度', 'Wheelchair walk pace', 'walk'],
  ['running', 37, '🏃', '跑步', 'Running', 'run'], ['trackAndField', 49, '🏟️', '田径', 'Track & field', 'run'], ['wheelchairRun', 71, '🦽', '轮椅跑步速度', 'Wheelchair run pace', 'run'],
  ['cycling', 13, '🚴', '骑行', 'Cycling', 'cycle'], ['handCycling', 74, '🚲', '手摇车', 'Hand cycling', 'cycle'],
  ['swimming', 46, '🏊', '游泳', 'Swimming', 'swim'], ['waterFitness', 53, '💦', '水中健身', 'Water fitness', 'swim'], ['waterPolo', 54, '🤽', '水球', 'Water polo', 'swim'],
  ['paddleSports', 31, '🛶', '划桨', 'Paddle sports', 'swim'], ['sailing', 38, '⛵', '帆船', 'Sailing', 'swim'], ['surfingSports', 45, '🏄', '冲浪', 'Surfing', 'swim'],
  ['waterSports', 55, '🌊', '水上运动', 'Water sports', 'swim'], ['underwaterDiving', 84, '🤿', '潜水', 'Underwater diving', 'swim'], ['swimBikeRun', 82, '🏅', '铁人三项', 'Swim bike run', 'swim'],
  ['hiking', 24, '🥾', '徒步登山', 'Hiking', 'hike'], ['climbing', 9, '🧗', '攀岩', 'Climbing', 'hike'], ['stairClimbing', 44, '🪜', '爬楼梯', 'Stair climbing', 'hike'], ['stairs', 68, '🏢', '楼梯', 'Stairs', 'hike'],
  ['yoga', 57, '🧘', '瑜伽', 'Yoga', 'mind'], ['pilates', 66, '🤸', '普拉提', 'Pilates', 'mind'], ['taiChi', 72, '☯️', '太极', 'Tai chi', 'mind'], ['mindAndBody', 29, '🪷', '身心训练', 'Mind & body', 'mind'],
  ['flexibility', 62, '🙆', '柔韧训练', 'Flexibility', 'mind'], ['cooldown', 80, '🧊', '放松整理', 'Cooldown', 'mind'], ['preparationAndRecovery', 33, '🩹', '准备与恢复', 'Preparation & recovery', 'mind'], ['barre', 58, '🩰', '芭蕾杆', 'Barre', 'mind'],
  ['traditionalStrength', 50, '🏋️', '传统力量训练', 'Traditional strength', 'strength'], ['functionalStrength', 20, '💪', '功能性力量训练', 'Functional strength', 'strength'], ['coreTraining', 59, '🎯', '核心训练', 'Core training', 'strength'],
  ['boxing', 8, '🥊', '拳击', 'Boxing', 'strength'], ['kickboxing', 65, '🦵', '踢拳', 'Kickboxing', 'strength'], ['martialArts', 28, '🥋', '武术', 'Martial arts', 'strength'], ['wrestling', 56, '🤼', '摔跤', 'Wrestling', 'strength'], ['fencing', 18, '🤺', '击剑', 'Fencing', 'strength'],
  ['hiit', 63, '🔥', '高强度间歇', 'HIIT', 'cardio'], ['mixedCardio', 73, '❤️‍🔥', '混合有氧', 'Mixed cardio', 'cardio'], ['crossTraining', 11, '🔁', '交叉训练', 'Cross training', 'cardio'], ['elliptical', 16, '🌀', '椭圆机', 'Elliptical', 'cardio'],
  ['rowing', 35, '🚣', '划船机', 'Rowing', 'cardio'], ['stepTraining', 69, '🪜', '踏板操', 'Step training', 'cardio'], ['jumpRope', 64, '🪢', '跳绳', 'Jump rope', 'cardio'], ['fitnessGaming', 76, '🎮', '健身游戏', 'Fitness gaming', 'cardio'],
  ['cardioDance', 77, '💃', '有氧舞蹈', 'Cardio dance', 'cardio'], ['socialDance', 78, '🕺', '交际舞', 'Social dance', 'cardio'],
  ['basketball', 6, '🏀', '篮球', 'Basketball', 'team'], ['soccer', 41, '⚽', '足球', 'Soccer', 'team'], ['americanFootball', 1, '🏈', '美式橄榄球', 'American football', 'team'], ['australianFootball', 3, '🏉', '澳式足球', 'Australian football', 'team'],
  ['rugby', 36, '🏉', '英式橄榄球', 'Rugby', 'team'], ['baseball', 5, '⚾', '棒球', 'Baseball', 'team'], ['softball', 42, '🥎', '垒球', 'Softball', 'team'], ['volleyball', 51, '🏐', '排球', 'Volleyball', 'team'],
  ['handball', 23, '🤾', '手球', 'Handball', 'team'], ['hockey', 25, '🏑', '曲棍球', 'Hockey', 'team'], ['lacrosse', 27, '🥍', '长曲棍球', 'Lacrosse', 'team'], ['cricket', 10, '🏏', '板球', 'Cricket', 'team'],
  ['discSports', 75, '🥏', '飞盘', 'Disc sports', 'team'], ['tennis', 48, '🎾', '网球', 'Tennis', 'team'], ['badminton', 4, '🏸', '羽毛球', 'Badminton', 'team'], ['tableTennis', 47, '🏓', '乒乓球', 'Table tennis', 'team'],
  ['squash', 43, '🟢', '壁球', 'Squash', 'team'], ['racquetball', 34, '🔵', '短柄墙球', 'Racquetball', 'team'], ['pickleball', 79, '🟡', '匹克球', 'Pickleball', 'team'],
  ['downhillSkiing', 61, '⛷️', '高山滑雪', 'Downhill skiing', 'snow'], ['crossCountrySkiing', 60, '🎿', '越野滑雪', 'Cross-country skiing', 'snow'], ['snowboarding', 67, '🏂', '单板滑雪', 'Snowboarding', 'snow'],
  ['snowSports', 40, '❄️', '冰雪运动', 'Snow sports', 'snow'], ['skatingSports', 39, '⛸️', '滑冰', 'Skating', 'snow'], ['curling', 12, '🥌', '冰壶', 'Curling', 'snow'],
  ['golf', 21, '⛳', '高尔夫', 'Golf', 'outdoor'], ['archery', 2, '🏹', '射箭', 'Archery', 'outdoor'], ['bowling', 7, '🎳', '保龄球', 'Bowling', 'outdoor'], ['equestrianSports', 17, '🏇', '马术', 'Equestrian', 'outdoor'],
  ['fishing', 19, '🎣', '钓鱼', 'Fishing', 'outdoor'], ['hunting', 26, '🦌', '狩猎', 'Hunting', 'outdoor'], ['gymnastics', 22, '🤸', '体操', 'Gymnastics', 'outdoor'], ['play', 32, '🪁', '玩耍', 'Play', 'outdoor'],
  ['other', 3000, '✨', '其他运动', 'Other', 'outdoor'],
].map(([id, raw, e, zh, en, group]) => ({ id, raw, e, zh, en, group }));
const SPORT_BY_ID = Object.fromEntries(SPORTS.map(s => [s.id, s]));
const SPORT_BY_RAW = Object.fromEntries(SPORTS.map(s => [s.raw, s.id]));
// The game's 9 workout animations, when we don't know the exact Apple Watch type.
const SPORT_OF_TYPE = { walk: 'walking', run: 'running', cycle: 'cycling', swim: 'swimming', strength: 'traditionalStrength', yoga: 'yoga', hiit: 'hiit', dance: 'cardioDance', wheel: 'wheelchairWalk' };

// ---------- exclusives: things only trophy winners may buy (v0.10) ----------
// `excl` says what unlocks it: "trophyId:tier" (tier 0 bronze, 1 silver, 2 gold) or "g:group" (gold in any sport of the group).
Object.assign(YARD, {
  walkerstatue:    { zh: '金色步行者雕像', en: 'Golden walker statue', w: 1, d: 1, price: 400, excl: 'steps10k:0' },
  goldginkgo:      { zh: '金叶银杏',       en: 'Golden ginkgo',        w: 1, d: 1, price: 800, excl: 'steps10k:1' },
  triumph:         { zh: '凯旋门',         en: 'Triumph arch',         w: 2, d: 1, price: 2400, excl: 'steps20k:1' },
  ringfountain:    { zh: '三环喷泉',       en: 'Rings fountain',       w: 2, d: 2, price: 900, excl: 'rings:0' },
  ringgarden:      { zh: '三环花园',       en: 'Rings garden',         w: 2, d: 2, price: 1600, excl: 'rings:1' },
  ringtower:       { zh: '三环之塔',       en: 'Rings tower',          w: 1, d: 1, price: 4000, excl: 'rings:2' },
  finisharch:      { zh: '马拉松终点拱门', en: 'Marathon finish arch', w: 2, d: 1, price: 1200, excl: 'g:run' },
  dolphinfountain: { zh: '海豚喷泉',       en: 'Dolphin fountain',     w: 2, d: 2, price: 1500, excl: 'g:swim' },
  cabin:           { zh: '登山者小木屋',   en: 'Mountaineer cabin',    w: 2, d: 2, price: 1800, excl: 'g:hike' },
  zengarden:       { zh: '禅意石庭',       en: 'Zen garden',           w: 2, d: 2, price: 1300, excl: 'g:mind' },
  podium:          { zh: '冠军领奖台',     en: 'Champion podium',      w: 2, d: 1, price: 1200, excl: 'g:strength' },
  stage:           { zh: '小舞台',         en: 'Little stage',         w: 2, d: 2, price: 1400, excl: 'g:cardio' },
  court:           { zh: '篮球小球场',     en: 'Mini court',           w: 2, d: 2, price: 1500, excl: 'g:team' },
  igloo:           { zh: '冰雪小屋',       en: 'Igloo',                w: 2, d: 2, price: 1300, excl: 'g:snow' },
  flame:           { zh: '圣火台',         en: 'Champion flame',       w: 1, d: 1, price: 1100, excl: 'g:outdoor' },
});
Object.assign(CARS, {
  champcar: { zh: '冠军金色超跑', en: 'Champion gold supercar', cost: { coins: 5000 }, excl: 'steps10k:2', color: '#f2c230' },
  goldbike: { zh: '金色公路车',   en: 'Golden road bike',       cost: { coins: 1200 }, kind: 'two', excl: 'g:cycle', color: '#f2c230' },
});
PET_BREEDS.collie = { kind: 'dog', zh: '冠军边牧', en: 'Champion collie', price: 1500, col: '#2d2a28', belly: '#ffffff', ears: 'flop', tail: 'plume', mask: true, eyes: '#8a5a2a', excl: 'steps20k:0' };
ANIMALS.rainbowalpaca = { ...ANIMALS.alpaca, e: '🦄', zh: '彩虹羊驼', en: 'Rainbow alpaca', baby: { zh: '彩虹小羊驼', en: 'Rainbow cria' }, price: 2600, sell: [400, 700, 1200], excl: 'steps20k:2' };
// A trophy case appears in your home with your first trophy (not sold).
FURN.trophycase = { zh: '奖杯柜', en: 'Trophy case', w: 1, d: 1, price: 0, award: true };
const EXCLUSIVES = [
  ...Object.keys(YARD).filter(k => YARD[k].excl).map(k => ['yard', k]),
  ...Object.keys(CARS).filter(k => CARS[k].excl).map(k => ['car', k]),
  ['pet', 'collie'], ['animal', 'rainbowalpaca'],
];
