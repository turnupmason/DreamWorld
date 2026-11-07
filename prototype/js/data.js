'use strict';
// Catalogs and tuning: what you can grow, raise, buy and build, what it costs, and how real-life health pays out.
// Item names are bilingual; nm(item) picks the current language. Times are in minutes unless noted.

const VERSION = '0.5.0';
const TW = 64, TH = 32;                 // isometric tile size in px at zoom 1
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const ACTION_CAP = 24;                  // farm actions per day (planting, sneaking). Harvesting, selling and shopping are free.
const STEAL_CAP = 8;                    // sneaks per day
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

// ---------- town layout ----------
const SLOT_W = LOT_W + 1, SLOT_D = LOT_D + 2;
const SLOTS = [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]];
const PLAZA = [1, 1];
const TOWN_W = 3 * SLOT_W, TOWN_D = 3 * SLOT_D;
const TOWN_LEVELS = [0, 15000, 40000, 100000, 250000];

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
  sleepbag:  { zh: '睡袋',       en: 'Sleeping bag',     w: 1, d: 2, price: 20,  tint: true, use: 'sit' },
  bed:       { zh: '双人床',     en: 'Double bed',       w: 2, d: 2, price: 180, tint: true, use: 'sit' },
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
  singlebed: { zh: '单人床',     en: 'Single bed',       w: 1, d: 2, price: 120, tint: true, use: 'sit' },
  bunkbed:   { zh: '双层床',     en: 'Bunk bed',         w: 1, d: 2, price: 260, tint: true, use: 'sit' },
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
