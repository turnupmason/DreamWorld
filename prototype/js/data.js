'use strict';
// Catalogs and tuning: what you can grow, raise, buy and build, what it costs, and how real-life health pays out.
// Item names are bilingual; nm(item) picks the current language. Times are in minutes unless noted.

const VERSION = '0.42.0';
const TW = 64, TH = 32;                 // isometric tile size in px at zoom 1
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const ACTION_CAP = 24;                  // farm actions per day (planting, sneaking). Harvesting, selling and shopping are free.
const STEAL_CAP = 8;                    // sneaks per day
const STEAL_FINE = [10, 60];            // caught by a guard dog: pay the owner twice the value, within this range
// v0.18: the police. No guard dog? A neighbour may still see you (a fine, like the dog's). Caught taking a baby
// animal, or caught 3 times in 7 days: the police come: a bigger fine and a short real-time stay in the holding cell
// (you can pay bail to leave early). Real-life movement and sleep still count while you're in there.
const STORE_FRONT = 3.2;
// v0.20: shopping in a real store. You pick things up (into the basket), pay the shopkeeper, then take them home:
// small things in your hands, bigger ones in your car if you drove here, or the store delivers (v0.34: always for a
// fee, and it comes the next morning, like a real delivery; the car dealer too).
// Sizes are in "boxes": a 1×1 piece of furniture is 10, a seed packet 1.
const HANDS_VOL = 12, BIG_VOL = 10;               // you can carry small things (10 or less each) up to 12 in all
const DELIVERY = { fee: 0.05, min: 30, max: 300, hour: 9 };   // delivery: 5% of the bill (🪙30–300), arrives tomorrow at 9:00
const SMALL_ANIMALS = ['chicken', 'duck', 'rabbit'];   // v0.19: every store has a car park this deep in front, between the building and the road
// v0.22: evening classes at the school: one a day; every few classes earn a certificate, and each certificate
// raises the pay for every job a little (a slow way up, paid for with your own coins).
// v0.25: needs. Energy is your real sleep (as before). Three more go down slowly over real hours and come back by
// living: eating (hunger), being with people (social) and having fun (fun). They never go to zero (they stop at 8)
// and low needs never take anything away: a good mood (all three high on average) just adds a little to your pay.
const NEEDS = { hunger: { e: '🍔', hours: 10 }, social: { e: '💬', hours: 16 }, fun: { e: '🎉', hours: 16 }, floor: 8, goodMood: 70, moodPay: 0.1 };
const FOOD_FILL = { burger: 55, noodles: 50, pizza: 60, sushi: 45, boba: 15, icecream: 15, snack: 30, cook: 45 };
const NEED_GAIN = { call: 10, text: 5, chat: 15, visit: 20, letter: 8, movie: 40, movieSocial: 6, claw: 8, stroll: 20, boss: 8, mate: 12, snackSocial: 4, cookFun: 5, sweetFun: 8 };
const SNACK = { price: 15 };
// the people at your work (not the same names as people in town)
const BOSS_NAMES = [{ zh: '赵经理', en: 'Ms. Zhao' }, { zh: '孙店长', en: 'Mr. Sun' }, { zh: '钱老板', en: 'Mrs. Chen' }, { zh: '吴主管', en: 'Mr. Wu' }, { zh: '郑经理', en: 'Ms. Zheng' }, { zh: '何老板', en: 'Mr. Ho' }];
// ---------- v0.26: the phone ----------
// Bank: savings earn a little every day (on up to interestCap). Loans for a car or a house: pay a fifth now, the rest
// (plus a flat fee) comes off in equal payments once a day; if you can't pay, nothing is taken away, you just can't
// borrow again until you catch up.
// v0.35: like a real bank. Savings earn 4% a year. A mortgage is 5% down, 30 years at 6.5% a year; a car loan 10% down,
// 5 years at 7%; paid a little every day. All your loans together may take at most 40% of what you earned a day on
// average over the last 7 days (dti). Short on a payment? Nothing is taken away; no new loans until you catch up.
const BANK = { rate: 0.04, interestCap: 1e12, down: { car: 0.1, house: 0.05 }, car: { years: 5, apr: 0.07 }, house: { years: 30, apr: 0.065 }, dti: 0.4, maxLoans: 2 };
// Stocks: six companies in town. Prices move every 15 minutes (the same for everyone, worked out from the time),
// swing around a slowly rising trend, and buying or selling costs 1%.
const STOCKS = {
  farm:   { zh: '镜像农业', en: 'Mirror Farms',      e: '🌾', base: 40,  vol: 1.0, col: '#7cc35a' },
  motors: { zh: '小镇汽车', en: 'Town Motors',       e: '🚗', base: 120, vol: 1.3, col: '#4c8fe8' },
  bakery: { zh: '甜甜烘焙', en: 'Sweet Bakes',       e: '🥐', base: 25,  vol: 0.8, col: '#e8a64c' },
  cinema: { zh: '星光影院', en: 'Starlight Cinemas', e: '🎬', base: 60,  vol: 1.2, col: '#b36be0' },
  fit:    { zh: '动起来科技', en: 'MoveTech',        e: '⌚', base: 200, vol: 1.6, col: '#e85c7a' },
  parcel: { zh: '飞快快递', en: 'Zip Parcel',        e: '📦', base: 80,  vol: 1.0, col: '#c08a5a' },
};
const STOCK = { tickMin: 15, phi: 0.99, sigma: 0.006, trend: 0.000005, fee: 0.01, window: 900, epoch: Date.UTC(2026, 0, 1) };
// Texts you can send, and what people say back
const TEXTS = [
  { zh: '最近怎么样？', en: 'How are you doing?', re: [{ zh: '挺好的！刚从公园回来 🌳', en: 'Pretty good! Just back from the park 🌳' }, { zh: '还不错，今天菜地收成很好 🥕', en: 'Not bad, a good harvest today 🥕' }, { zh: '有点累，不过很开心 😊', en: 'A bit tired, but happy 😊' }] },
  { zh: '你家院子好漂亮', en: 'Your yard looks lovely', re: [{ zh: '谢谢！我花了好多心思 🌷', en: 'Thanks! I put a lot into it 🌷' }, { zh: '哈哈，下次来我家玩 🏡', en: 'Ha, come over some time 🏡' }] },
  { zh: '谢谢你！', en: 'Thank you!', re: [{ zh: '不客气 😄', en: 'Any time 😄' }, { zh: '小事一桩～', en: 'No problem at all~' }] },
  { zh: '今天走了好多步 👟', en: 'I walked loads today 👟', re: [{ zh: '厉害！我也要去走走 💪', en: 'Nice! I should go for a walk too 💪' }, { zh: '我今天也去健身了 🏋️', en: 'I hit the gym today too 🏋️' }] },
];
// People text you now and then (one a day)
const INBOX = [
  { zh: '早上好！今天天气不错 ☀️', en: 'Morning! Lovely day ☀️' }, { zh: '我刚看了一部电影，超好看 🎬', en: 'Just saw a film, so good 🎬' },
  { zh: '你的菜长得怎么样了？🥕', en: 'How are your veggies doing? 🥕' }, { zh: '周末一起去公园吗？🌳', en: 'Park this weekend? 🌳' },
  { zh: '我新买了一辆车 🚗', en: 'I got a new car 🚗' }, { zh: '谢谢上次帮忙 🙏', en: 'Thanks for helping last time 🙏' },
];
const BOSS_INBOX = [{ zh: '这周干得不错 👍', en: 'Good work this week 👍' }, { zh: '明天记得准时来哦 💼', en: 'See you on time tomorrow 💼' }];
const CALL_LINES = [
  { zh: '喂？是你呀！最近好吗？', en: 'Hello? Oh, it’s you! How are things?' }, { zh: '哈哈，正想给你打电话呢！', en: 'Ha, I was just about to call you!' },
  { zh: '我在公园散步呢，空气很好。', en: 'I’m out for a walk in the park, lovely air.' }, { zh: '今天在店里忙了一天，听到你声音真好。', en: 'Busy day at the shop, nice to hear you.' },
];
const MATE_NAMES = [{ zh: '小林', en: 'Lin' }, { zh: '阿伟', en: 'Will' }, { zh: '小雨', en: 'Rain' }, { zh: '阿豪', en: 'Hal' }, { zh: '佳佳', en: 'Jojo' }, { zh: '小周', en: 'Joe' }, { zh: '文文', en: 'Wendy' }, { zh: '阿凯', en: 'Kai' }];   // a bite at the café or the bakery
const SCHOOL = { fee: 120, perCert: 3, certPay: 0.05, maxCerts: 4, minutes: 45 };   // v0.24: a class lasts 45 minutes
const POLICE = { witness: 0.08, strikes: 3, strikeDays: 7, fineMult: 5, fineMin: 80, fineMax: 400, jailMin: 30, bail: 150 };
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
// v0.19: a garage in the yard for 1–5 cars (built at the estate agent). Your own car parks in the drive; the others
// wait in the garage. You can own one car for the drive plus one for each garage space.
// v0.21: the dearer, the grander: a carport, a wooden garage, a brick garage, a modern garage, a glass showroom.
const GARAGE = [null,
  { cap: 1, style: 'carport', zh: '车棚', en: 'Carport', cost: { coins: 700, wood: 10 } },
  { cap: 2, style: 'wood', zh: '木车库', en: 'Wooden garage', cost: { coins: 2000, wood: 40 } },
  { cap: 3, style: 'brick', zh: '砖砌车库', en: 'Brick garage', cost: { coins: 4000, wood: 70 } },
  { cap: 4, style: 'modern', zh: '现代车库', en: 'Modern garage', cost: { coins: 7000, wood: 100 } },
  { cap: 5, style: 'showroom', zh: '豪华玻璃车库', en: 'Glass showroom garage', cost: { coins: 12000, wood: 150 } }];
const garageSize = lv => ({ w: Math.ceil(0.4 + 1.8 * GARAGE[lv].cap), d: 3 });
// v0.24: driveway designs. Every one reaches the road at the front of your lot; drag it along the front in design
// mode. How many cars you can keep = the spaces on your drive + the spaces in your garage.
const DRIVES = {
  single: { zh: '单车位车道', en: 'Single drive', w: 2, d: 4, cap: 1, cost: 0 },
  long:   { zh: '长车道（前后两辆）', en: 'Long drive (2 in a row)', w: 2, d: 7, cap: 2, cost: 600 },
  curve:  { zh: '弯车道', en: 'Curved drive', w: 4, d: 6, cap: 2, cost: 1600, curve: true },
  double: { zh: '双车位车道', en: 'Double drive', w: 4, d: 5, cap: 2, cost: 1800 },
  triple: { zh: '三车位车道', en: 'Triple drive', w: 6, d: 5, cap: 3, cost: 4000 },
};
const DOOR_X = 3.5;
const MAILBOX = [4, 13];                 // every home has a mailbox by the gate

// ---------- the world ----------
// A real little town instead of a 3 × 3 grid: neighbourhoods with streets of different lengths, roads of different
// widths, a town centre, a park, a lake and farmland. Coordinates are world tiles (x to the lower right, y to the lower left).
// Every street is a row of land parcels (PARCEL tiles wide, LOT_D deep) with its road in front (+y).
// A home takes 4 parcels (the 16-tile core with house, farm and yard) plus any parcels bought next to it, to the right.
const PARCEL = 4, CORE_PARCELS = LOT_W / PARCEL;
const WORLD = { x0: -4, y0: -4, x1: 180, y1: 92 };            // the town; woods all around it (v0.38: + its new district, each town's `world`)
const DISTRICT = 46;                                            // v0.38: how far the new district reaches past the old edge of town
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
  // v0.27: through the town centre: Main Street (joins the streets on both sides) and two one-way lanes
  // ([..., 'lane', 1] = one way towards +y, -1 = towards -y)
  [67, 14, 112, 16, 'street'], [82, 16, 84, 30, 'lane', 1], [96, 16, 98, 30, 'lane', -1],
];
// Places that aren't homes. The town hall plaza is 16 × 14 like a lot.
const LANDMARKS = {
  plaza:  { x: 82, y: -1 },   // v0.27: moved up for Main Street
  shops:  [['bakery', 69, 23.6], ['cafe', 75.3, 23.6], ['market', 98.6, 23.6], ['gym', 104.8, 23.6], ['library', 69, 8], ['post', 105, 8]],
  park:   { x: 68, y: 35, w: 44, d: 30 },
  lake:   { x: 146, y: 52, rx: 26, ry: 13 },
  fields: { x: -2, y: 70, w: 114, d: 18 },
};
// v0.27: the town is invite-only: only you, the friends you invite and your family live here. Your family's homes
// (generated from these; the friends are in S.friends). Fewer homes than before, and every one on a bigger lot.
const NPC_LOTS = [
  { id: 'n2', st: 'wheat', p: 0, n: 8, house: 2, fam: 'parents' }, { id: 'n3', st: 'wheat', p: 8, n: 8, house: 1, fam: 'sister' },
  { id: 'n4', st: 'meadow', p: 0, n: 8, house: 5, fam: 'grand' }, { id: 'n6', st: 'lakeview', p: 0, n: 7, house: 7, fam: 'uncle' },
  { id: 'n8', st: 'shore', p: 0, n: 7, house: 8, fam: 'cousin' },
];
const FAMILY = { parents: { zh: '爸妈', en: 'Mom & Dad' }, sister: { zh: '姐姐', en: 'Big Sis' }, grand: { zh: '爷爷奶奶', en: 'Grandma & Grandpa' }, uncle: { zh: '舅舅', en: 'Uncle Joe' }, cousin: { zh: '表哥', en: 'Cousin Jake' } };
const HOME_PARCELS = 6;   // v0.27: a home's lot is at least this many parcels wide where there's room (it was 4)
const NPC_NAMES = [
  { zh: '老张', en: 'Sam' }, { zh: '王奶奶', en: 'Grandma Rose' }, { zh: '阿杰', en: 'Jake' }, { zh: '陈叔', en: 'Uncle Ben' },
  { zh: '小美', en: 'Emma' }, { zh: '李医生', en: 'Dr. Lee' }, { zh: '周老师', en: 'Ms. Chow' }, { zh: '大熊', en: 'Big Al' }, { zh: '安娜', en: 'Anna' },
];
// Where you and your friends start, and where friends who accept an invite move in.
const START_LOTS = { me: ['maple', 6, 6], li: ['maple', 0, 6], wang: ['cherry', 0, 6], mia: ['cherry', 10, 6] };
// Buying land: each parcel next to your home costs more than the last. Moving to another street costs its land.
const LAND = { parcel: 600, grow: 1.35, move: 500, refund: 0.5 };
// Going somewhere in town (v0.12): tiles per second on foot, by bike, by car (sped up so trips take seconds).
// Cars and bikes on the expressway go `highway` times faster (v0.16); on foot you only use local streets.
const TRIP_SPEED = { walk: 3, bike: 6, car: 10, highway: 2.5 };
// v0.39: every kind of road. lanes: lanes each way (a one-way road has all of them going its way); mph / kmh: the speed
// limit on its signs (mph in English, km/h in Chinese); spd: how fast the town's cars go on it (1 = an avenue).
// street: two-way, two lanes (a dashed yellow line). avenue: two-way, two lanes, a double yellow line. boulevard: two
// lanes each way and a planted median. frontage: the road beside the freeway (two-way, or one-way with two lanes).
// lane: a little lane (some are one-way). dirt: a country road. freeway: the interstate (see FREEWAY).
const ROAD_KINDS = {
  dirt:      { e: '🌾', zh: '乡间土路',     en: 'Country road',  lanes: 1, mph: 15, kmh: 20,  spd: 0.6 },
  lane:      { e: '🏘️', zh: '小巷',         en: 'Lane',          lanes: 1, mph: 15, kmh: 20,  spd: 0.7 },
  street:    { e: '🛣️', zh: '双向两车道街道', en: 'Two-lane street', lanes: 1, mph: 25, kmh: 40,  spd: 0.85 },
  avenue:    { e: '🛣️', zh: '双向两车道大道', en: 'Avenue',        lanes: 1, mph: 35, kmh: 60,  spd: 1 },
  boulevard: { e: '🌳', zh: '双向四车道大马路', en: 'Four-lane boulevard', lanes: 2, mph: 45, kmh: 70, spd: 1.2 },
  frontage:  { e: '↔️', zh: '高速辅路',      en: 'Frontage road',  lanes: 2, mph: 45, kmh: 70,  spd: 1.1 },
  freeway:   { e: '🚀', zh: '双向六车道高速', en: 'Six-lane interstate', lanes: 3, mph: 65, kmh: 100, spd: 2.2 },
};
// v0.39: the interstate along the far edge of the new district (built in buildLayout). Sizes in tiles across it:
// w: the whole roadway; lane: one lane; gap: grass between it and the frontage roads; front: a frontage road's width.
// deck: how high the freeway's bridge over the cross road is (px at zoom 1); rise: how long its slopes are (tiles).
// ramp: where the slip ramps leave / join it, in tiles from the cross road (out, in). bridge: the sea bridge's height.
const FREEWAY = { w: 9, lane: 1.1, gap: 2.5, front: 3, deck: 40, rise: 14, ramp: [30, 14], bridge: 44, cars: [1.0, 1.6], exit: 0.18, leave: 0.16 };

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
  bouquet:    { e: '💐', zh: '花束', en: 'Bouquet', sell: 20 },   // v0.37: from the florist; a gift people love
  bread:      { e: '🍞', zh: '面包',   en: 'Bread',        sell: 10 },   // baked at the bakery from 3 wheat (v0.12)
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
  // v0.21: more kinds of home (drawn from a recipe: walls, roof, porch and trimmings; see drawSpecHouse)
  { id: 'bungalow',  zh: '平房小屋',   en: 'Bungalow',       fp: [2, 1, 4, 4], room: [6, 5],  floors: [1, 2], cost: { coins: 1300, wood: 40 },  spec: { mat: 'siding', roof: 'gableY', porch: 'small', chimney: true } },
  { id: 'aframe',    zh: 'A 字木屋',   en: 'A-frame cabin',  fp: [2, 1, 4, 4], room: [6, 5],  floors: [1, 2], cost: { coins: 1700, wood: 60 },  spec: { mat: 'wood', roof: 'aframe', wallCol: '#a8683a', deck: true } },
  { id: 'farmhouse', zh: '乡村农舍',   en: 'Farmhouse',      fp: [1, 1, 5, 4], room: [7, 6],  floors: [2, 3], cost: { coins: 2600, wood: 70 },  spec: { mat: 'siding', roof: 'gable', porch: 'wrap', chimney: true, wallCol: '#f4f1ea' } },
  { id: 'ranch',     zh: '牧场平房',   en: 'Ranch house',    fp: [1, 1, 6, 4], room: [8, 6],  floors: [1, 2], cost: { coins: 2900, wood: 70 },  spec: { mat: 'brick', roof: 'hip', low: true, wallCol: '#b5563c', windows: 'wide' } },
  { id: 'capecod',   zh: '科德角小屋', en: 'Cape Cod',       fp: [1, 1, 5, 4], room: [7, 6],  floors: [1, 3], cost: { coins: 3200, wood: 75 },  spec: { mat: 'shingle', roof: 'steep', dormers: 2, shutters: true, chimney: true, wallCol: '#c9c3b6' } },
  { id: 'colonial',  zh: '殖民地式',   en: 'Colonial',       fp: [1, 1, 6, 4], room: [8, 6],  floors: [2, 4], cost: { coins: 4200, wood: 90 },  spec: { mat: 'brick', roof: 'gable', porch: 'columns', shutters: true, chimney: true, wallCol: '#a94b37' } },
  { id: 'craftsman', zh: '工匠风住宅', en: 'Craftsman',      fp: [1, 1, 6, 4], room: [8, 6],  floors: [1, 3], cost: { coins: 4600, wood: 110 }, spec: { mat: 'siding', roof: 'gableY', base: 'stone', porch: 'columns' } },
  { id: 'spanish',   zh: '西班牙别墅', en: 'Spanish villa',  fp: [1, 1, 6, 4], room: [8, 7],  floors: [1, 3], cost: { coins: 5600, wood: 100 }, spec: { mat: 'stucco', roof: 'hip', roofCol: '#c8653c', arches: true, wallCol: '#f3e6cf' } },
  { id: 'tudor',     zh: '都铎风住宅', en: 'Tudor',          fp: [1, 1, 6, 4], room: [8, 7],  floors: [2, 3], cost: { coins: 6200, wood: 120 }, spec: { mat: 'half', roof: 'steep', base: 'stone', chimney: true, wallCol: '#f1eadb' } },
  { id: 'beach',     zh: '海滨别墅',   en: 'Beach house',    fp: [1, 1, 6, 4], room: [8, 7],  floors: [2, 3], cost: { coins: 6800, wood: 110 }, spec: { mat: 'siding', roof: 'hip', low: true, stilts: true, windows: 'wide' } },
  { id: 'brownstone', zh: '褐石联排',  en: 'Brownstone',     fp: [2, 1, 4, 4], room: [6, 6],  floors: [3, 5], cost: { coins: 8000, wood: 120 }, spec: { mat: 'brick', roof: 'flat', cornice: true, stoop: true, wallCol: '#7a4b36', windows: 'tall' } },
  { id: 'glass',     zh: '玻璃屋',     en: 'Glass house',    fp: [1, 1, 6, 4], room: [9, 7],  floors: [2, 4], cost: { coins: 9500, wood: 130 }, spec: { mat: 'glass', roof: 'flat', wallCol: '#eef1f4' } },
  { id: 'victorian', zh: '维多利亚式', en: 'Victorian',      fp: [1, 1, 6, 4], room: [9, 7],  floors: [2, 4], cost: { coins: 11000, wood: 160 }, spec: { mat: 'siding', roof: 'steep', turret: true, porch: 'wrap', shutters: true } },
  { id: 'lodge',     zh: '山间大木屋', en: 'Mountain lodge', fp: [1, 1, 6, 4], room: [10, 8], floors: [2, 4], cost: { coins: 14000, wood: 220 }, spec: { mat: 'wood', base: 'stone', roof: 'gableY', glassFront: true, chimney: true, wallCol: '#9a6236' } },
];
// How tall a recipe house is on the outside (px at zoom 1), for pictures and its name tag.
const specWallH = H => 4 + H.floors[0] * 28 + (H.spec.stilts ? 12 : 0) + (H.spec.stoop ? 8 : 0);
const SPEC_ROOF_H = { gable: 30, steep: 46, gableY: 32, hip: 26, flat: 8, aframe: 80 };
const specHouseH = H => (H.spec.roof === 'aframe' ? 86 : specWallH(H) + (H.spec.low ? 18 : SPEC_ROOF_H[H.spec.roof] || 30) + (H.spec.turret ? 30 : 0) + 8);
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
  // v0.18: plush toys from the mall's claw machine (not sold in the furniture store)
  plushbear: { zh: '小熊玩偶', en: 'Teddy bear', w: 1, d: 1, price: 0, plush: true, value: 40 }, plushbunny: { zh: '兔子玩偶', en: 'Bunny plush', w: 1, d: 1, price: 0, plush: true, value: 40 },
  plushcat: { zh: '小猫玩偶', en: 'Kitty plush', w: 1, d: 1, price: 0, plush: true, value: 40 }, plushdino: { zh: '恐龙玩偶', en: 'Dino plush', w: 1, d: 1, price: 0, plush: true, value: 40 },
  plushduck: { zh: '小鸭玩偶', en: 'Duckling plush', w: 1, d: 1, price: 0, plush: true, value: 40 }, plushpanda: { zh: '熊猫玩偶', en: 'Panda plush', w: 1, d: 1, price: 0, plush: true, value: 40 },
  bigteddy: { zh: '巨型泰迪熊', en: 'Giant teddy', w: 2, d: 2, price: 0, plush: true, value: 300 },
  // v0.42: from the zoo shop (not part of the claw machine's set)
  plushlion: { zh: '狮子玩偶', en: 'Lion plush', w: 1, d: 1, price: 0, plush: true, value: 40 }, plushelephant: { zh: '大象玩偶', en: 'Elephant plush', w: 1, d: 1, price: 0, plush: true, value: 40 },
  plushgiraffe: { zh: '长颈鹿玩偶', en: 'Giraffe plush', w: 1, d: 1, price: 0, plush: true, value: 40 }, plushpenguin: { zh: '企鹅玩偶', en: 'Penguin plush', w: 1, d: 1, price: 0, plush: true, value: 40 },
  // v0.20: film posters from the cinema (one per film you've seen), on a stand
  posterdino: { zh: '《恐龙乐园》海报', en: 'Dino Park poster', w: 1, d: 1, price: 0, poster: 'dino', value: 60 }, posterspace: { zh: '《星际旅行》海报', en: 'Space Trip poster', w: 1, d: 1, price: 0, poster: 'space', value: 60 },
  posterlove: { zh: '《怦然心动》海报', en: 'Heartbeat poster', w: 1, d: 1, price: 0, poster: 'love', value: 60 }, posterocean: { zh: '《深海奇遇》海报', en: 'Deep Blue poster', w: 1, d: 1, price: 0, poster: 'ocean', value: 60 },
  posterhero: { zh: '《超级英雄》海报', en: 'Super Hero poster', w: 1, d: 1, price: 0, poster: 'hero', value: 60 }, posterpets: { zh: '《汪汪队长》海报', en: 'Captain Woof poster', w: 1, d: 1, price: 0, poster: 'pets', value: 60 },
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
  bike:        { zh: '自行车',     en: 'Bicycle',       cost: { coins: 120 }, cargo: 10,   kind: 'two' },
  scooter:     { zh: '电动车',     en: 'E-bike',        cost: { coins: 350 }, cargo: 14,   kind: 'two' },
  vespa:       { zh: '踏板摩托',   en: 'Vespa scooter', cost: { coins: 700 }, cargo: 16,   kind: 'two' },
  motorcycle:  { zh: '摩托车',     en: 'Motorcycle',    cost: { coins: 1100 }, cargo: 12,  kind: 'two' },
  sportbike:   { zh: '赛车摩托',   en: 'Sport bike',    cost: { coins: 2600 }, cargo: 8,  kind: 'two' },
  mini:        { zh: '小轿车',     en: 'Compact car',   cost: { coins: 1200 }, cargo: 30, look: '#f2a33a' },
  sedan:       { zh: '三厢轿车',   en: 'Sedan',         cost: { coins: 2000 }, cargo: 40, look: '#2f80ed' },
  convertible: { zh: '敞篷车',     en: 'Convertible',   cost: { coins: 4500 }, cargo: 20, look: '#e5484d' },
  pickup:      { zh: '皮卡',       en: 'Pickup truck',  cost: { coins: 2500 }, cargo: 120, look: '#34b27b' },
  suv:         { zh: 'SUV',        en: 'SUV',           cost: { coins: 4000 }, cargo: 70, look: '#f4f4f0' },
  jeep:        { zh: '越野车',     en: 'Off-roader',    cost: { coins: 5200 }, cargo: 60, look: '#6b7f3a' },
  sports:      { zh: '跑车',       en: 'Sports car',    cost: { coins: 9000 }, cargo: 15, look: '#f2d24b' },
  tractor:     { zh: '拖拉机',     en: 'Tractor',       cost: { coins: 3000 }, cargo: 150, look: '#34b27b' },
  camper:      { zh: '房车',       en: 'Camper van',    cost: { coins: 15000 }, cargo: 80, look: '#f59e0b' },
  luxury:      { zh: '豪华轿车',   en: 'Luxury sedan',  cost: { coins: 7500 }, cargo: 45, look: '#2d2d2d' },
  muscle:      { zh: '肌肉车',     en: 'Muscle car',    cost: { coins: 6500 }, cargo: 20, look: '#e5484d' },
  supercar:    { zh: '超级跑车',   en: 'Supercar',      cost: { coins: 20000 }, cargo: 10, look: '#a46ef0' },
  minivan:     { zh: '面包车',     en: 'Minivan',       cost: { coins: 2800 }, cargo: 100, look: '#f4f4f0' },
  boxtruck:    { zh: '厢式卡车',   en: 'Box truck',     cost: { coins: 6000 }, cargo: 300, look: '#2f80ed' },
};
// On foot you can carry only a few things to the market at a time; vehicles carry `cargo` (v0.13).
const WALK_CARRY = 6;
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
    { id: 'small', e: '⛺', zh: '小屋', en: 'Small', keys: ['tent', 'cabin', 'cottage', 'bungalow', 'aframe'] },
    { id: 'family', e: '🏠', zh: '家庭', en: 'Family', keys: ['twostory', 'farmhouse', 'ranch', 'capecod', 'modern', 'colonial', 'craftsman', 'villa', 'beach', 'brownstone'] },
    { id: 'grand', e: '🏰', zh: '豪华', en: 'Grand', keys: ['spanish', 'tudor', 'chinese', 'glass', 'victorian', 'mansion', 'lodge', 'castle'] },
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
  30: { coins: 25, wood: 2 },
  60: { coins: 50, wood: 5 },
  120: { coins: 120, wood: 12, seeds: { sunflower: 1 } },
};

// ---------- real life: Apple Health ----------
// Sleep score sets today's energy, and energy multiplies everything earned from exercise.
const ENERGY_LEVELS = [ // highest first
  { id: 'great',     min: 85, mult: 1.3 },
  { id: 'good',      min: 70, mult: 1.0 },
  { id: 'tired',     min: 50, mult: 0.75 },
  { id: 'exhausted', min: 0,  mult: 0.5 },
];
const STEP_REWARD = { coins: 15, wood: 1 };   // per sixth of YOUR step goal (1,000 steps at a 6,000 goal), wheelchair pushes count
const STEP_BLOCKS_MAX = 9;                     // paid up to 150 % of your goal, so a marathoner doesn't out-earn a beginner
const STEP_GOAL_RANGE = [3000, 12000];         // your goal = 110 % of your last 7 days' average, rounded to 500
const WORKOUT_PAY_MAX = 90;                    // workout minutes paid per day
const WORKOUT_PAY = 1.8;                       // v0.35: $ per workout minute (energy multiplies it)
const GOAL_REWARD = { coins: 30, wood: 3, seeds: { pumpkin: 1 } };
const RINGS = { move: 500, exercise: 30, stand: 12 };          // kcal, minutes, hours
const RING_REWARD = {
  move: { coins: 40, wood: 3 }, exercise: { coins: 40, wood: 3 }, stand: { coins: 25, wood: 2 },
  all: { coins: 60, wood: 5, seeds: { rose: 1 } },
};
const SLEEP_REWARD = { coins: 30, seeds: { tulip: 1 } };       // for a sleep score of 80+
const MINDFUL_REWARD = 8;                                       // coins per mindful minute, up to 10 a day
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
    look: { shirt: '#ec6aa8', skin: SKINS[0], hair: 'long', hairCol: '#2b1d14', mob: 'walk', body: 'slim', top: 'dress', bottom: 'jeans', shoes: 'sandals', hat: 'sunhat', hatCol: '#f4f4f0' },
    house: 3, wall: '#fbe3c8', roof: '#d9534f', floor: 0, roomWall: 3,
    fieldLv: 1, crops: ['strawberry', 'strawberry', 'tomato', 'tomato', 'corn', 'carrot', 'eggplant', 'wheat'], ripe: [0, 1, 4, 5],
    pastureLv: 2, animals: [['chicken', 2], ['chicken', 2], ['duck', 2], ['sheep', 2], ['cow', 1], ['dog', 2]],
    orchardLv: 1, trees: [['apple', 2], ['cherry', 1]], pondLv: 1,
    cars: [['mini', '#e5484d']],
    furn: [['sofa', '#5aa2e0'], 'tv', ['rug', '#f3d36b'], 'monstera', 'lamp', 'piano', 'fridge', 'kitchen', 'table', 'chair'],
    furn2: [['bed', '#e88bb7'], 'nightstand', 'shelf', 'wardrobe', ['yogamat', '#e88bb7'], 'plant', 'moonlamp'], up2: [4, 1],
    yard: ['flowers', 'flowers', 'tree', 'lamp', 'bench', 'beehive'],
    coins: 24000, wood: 40, likes: 20, shareGoal: true, shareLive: true, shareMood: true, earn: 10 },
  { id: 'wang', name: { zh: '小王', en: 'Leo' }, slot: 7,
    look: { shirt: '#4f8ef7', skin: SKINS[2], hair: 'short', hairCol: '#1d1a17', mob: 'walk', body: 'broad', top: 'hoodie', bottom: 'jeans', shoes: 'hightops', shoeCol: '#e5484d', hat: 'cap', hatCol: '#2d2d2d' },
    house: 2, wall: '#f4e7cc', roof: '#3e7cc9', floor: 1, roomWall: 1,
    fieldLv: 0, crops: ['corn', 'potato', 'wheat', 'cabbage'], ripe: [2],
    pastureLv: 1, animals: [['chicken', 2], ['pig', 2], ['goat', 0]],
    orchardLv: 0, trees: [], pondLv: 0,
    cars: [['motorcycle', '#2d2d2d']],
    furn: [['bed', '#5aa2e0'], 'table', 'chair', 'chair', 'shelf', 'stove', 'treadmill', 'dumbbells'],
    yard: ['pine', 'bbq', 'doghouse'],
    coins: 9000, wood: 20, likes: 12, shareGoal: true, shareLive: true, shareMood: false, earn: 8 },
  { id: 'mia', name: { zh: 'Mia', en: 'Mia' }, slot: 4,
    look: { shirt: '#f2a33a', skin: SKINS[1], hair: 'bun', hairCol: '#b5462e', mob: 'wheel', body: 'round', top: 'sweater', bottom: 'jeans', shoes: 'sneakers', hat: 'beanie', hatCol: '#38a3e0' },
    house: 1, wall: '#c99a6b', roof: '#4f9a4b', floor: 4, roomWall: 2,
    fieldLv: 0, crops: ['carrot', 'carrot', null, 'blueberry'], ripe: [0],
    pastureLv: 0, animals: [['cat', 2]], orchardLv: 0, trees: [], pondLv: 0, cars: [['scooter', '#34b27b']],
    furn: [['sleepbag', '#6cbf73'], 'plant', 'monstera', ['yogamat', '#8b7fe0'], 'lamp', 'easel', 'record'],
    yard: ['flowers', 'flowers', 'flowers', 'gnome', 'hedge', 'birdbath', 'arch'],
    coins: 3800, wood: 12, likes: 5, shareGoal: false, shareLive: false, shareMood: false, earn: 6 },
];
const POOL_BASE = { house: 0, wall: '#f4e7cc', floor: 0, roomWall: 0, fieldLv: 0, crops: [], ripe: [], pastureLv: 0, animals: [],
  orchardLv: 0, trees: [], pondLv: 0, cars: [], yard: [], coins: 1500, wood: 5, likes: 0, earn: 7 };
const FRIEND_POOL = [
  { ...POOL_BASE, id: 'chen', name: { zh: '阿晨', en: 'Noah' }, look: { shirt: '#2fb67c', skin: SKINS[3], hair: 'curly', hairCol: '#1d1a17', mob: 'walk' }, roof: '#2fb67c', furn: [['sleepbag', '#5aa2e0']], shareGoal: true, shareLive: true },
  { ...POOL_BASE, id: 'yu', name: { zh: '小雨', en: 'Zoe' }, look: { shirt: '#8b6cf0', skin: SKINS[0], hair: 'long', hairCol: '#6b4226', mob: 'walk' }, roof: '#8b6cf0', furn: [['sleepbag', '#e88bb7']], shareGoal: false },
  { ...POOL_BASE, id: 'kai', name: { zh: '阿凯', en: 'Kai' }, look: { shirt: '#e5484d', skin: SKINS[1], hair: 'short', hairCol: '#c98a3c', mob: 'walk' }, roof: '#e5484d', furn: [['sleepbag', '#f2a33a']], shareGoal: true, shareLive: true, shareMood: true },
  { ...POOL_BASE, id: 'lin', name: { zh: '林林', en: 'Lily' }, look: { shirt: '#38a3e0', skin: SKINS[2], hair: 'bun', hairCol: '#2b1d14', mob: 'walk' }, roof: '#38a3e0', furn: [['sleepbag', '#6cbf73']], shareGoal: false },
];

// What the townie does while the real you is working out ("mini me").
const WORKOUT_POSE = { walk: 'walk', run: 'run', cycle: 'bike', swim: 'swim', strength: 'lift', yoga: 'yoga', hiit: 'jacks', dance: 'dance', wheel: 'walk' };
// Where mini-you goes in town while Apple Watch records a workout (v0.16): laps round the park, the lake (or the sea)
// for a swim, the gym for strength, HIIT and dance, the park lawn for yoga.
const LIVE_PLACE = { walk: 'park', run: 'park', wheel: 'park', cycle: 'park', swim: 'lake', strength: 'gym', hiit: 'gym', dance: 'gym', yoga: 'park' };
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
// ---------- v0.40: states and counties ----------
// Like the US: every town is in a county, and every county in a state (or that country's own kind of region: a
// province, a prefecture, a département; `kind` says which). Each county has its own land round the town (terrain:
// the mountains, hills or mesas you see past the woods), its own specialties (only its supermarket sells them), its
// own prices for food, drinks and fun (cost) and its own pay (wage), its own police cars, and its people's names
// (folk). Number plates go by state. Cars, furniture, houses and land keep one price everywhere (land already had
// its own, COMMUNITIES[].price).
const STATES = {
  ca: { zh: '加利福尼亚州', en: 'California', kind: 'state', abbr: 'CA', plate: { bg: '#f7f7f5', fg: '#1f3a7a', top: '#d6383e', name: 'California', fmt: '#@@@###' } },
  fl: { zh: '佛罗里达州', en: 'Florida', kind: 'state', abbr: 'FL', plate: { bg: '#f7f7f5', fg: '#1f6b45', top: '#f28c28', name: 'Florida', fmt: '@@@ @##' } },
  az: { zh: '亚利桑那州', en: 'Arizona', kind: 'state', abbr: 'AZ', plate: { bg: '#f4cf86', fg: '#7a2a2a', top: '#c05a3a', name: 'Arizona', fmt: '@@@####' } },
  vt: { zh: '佛蒙特州', en: 'Vermont', kind: 'state', abbr: 'VT', plate: { bg: '#1f6b45', fg: '#f7f7f5', top: '#f7f7f5', name: 'Vermont', fmt: '@@@ ###' } },
  ab: { zh: '艾伯塔省', en: 'Alberta', kind: 'province', abbr: 'AB', plate: { bg: '#f7f7f5', fg: '#d6383e', top: '#d6383e', name: 'Alberta', fmt: '@@@-####' } },
  paca: { zh: '普罗旺斯-阿尔卑斯-蓝色海岸大区', en: 'Provence-Alpes-Côte d’Azur', kind: 'region', abbr: 'PACA', plate: { bg: '#f7f7f5', fg: '#1d1d1f', band: '#1f3a7a', end: '#1f3a7a', name: 'F', fmt: '@@-###-@@' } },
  nh: { zh: '北荷兰省', en: 'North Holland', kind: 'province', abbr: 'NH', plate: { bg: '#f2c230', fg: '#1d1d1f', band: '#1f3a7a', name: 'NL', fmt: '##-@@@-#' } },
  vl: { zh: '韦斯特兰郡', en: 'Vestland', kind: 'fylke', abbr: 'VL', plate: { bg: '#f7f7f5', fg: '#1d1d1f', band: '#1f3a7a', name: 'N', fmt: '@@ #####' } },
  kyo: { zh: '京都府', en: 'Kyoto Prefecture', kind: 'prefecture', abbr: '京都', plate: { bg: '#f7f7f5', fg: '#1f6b45', name: '京都', fmt: '### さ ##-##' } },
  zj: { zh: '浙江省', en: 'Zhejiang', kind: 'province', abbr: '浙', plate: { bg: '#2f5fb8', fg: '#f7f7f5', name: '浙A', fmt: '浙A·#@###' } },
  nsw: { zh: '新南威尔士州', en: 'New South Wales', kind: 'state', abbr: 'NSW', plate: { bg: '#f2d24b', fg: '#1d1d1f', name: 'NSW', fmt: '@@-##-@@' } },
  qui: { zh: '金迪奥省', en: 'Quindío', kind: 'department', abbr: 'QUI', plate: { bg: '#f2c230', fg: '#1d1d1f', name: 'Salento', fmt: '@@@ ###' } },
  eng: { zh: '英格兰', en: 'England', kind: 'country', abbr: 'ENG', plate: { bg: '#f2c230', fg: '#1d1d1f', name: 'UK', fmt: '@@## @@@' } },
  gg: { zh: '京畿道', en: 'Gyeonggi', kind: 'province', abbr: '京畿', plate: { bg: '#f7f7f5', fg: '#1d1d1f', name: '경기', fmt: '##가 ####' } },
  rj: { zh: '里约热内卢州', en: 'Rio de Janeiro', kind: 'state', abbr: 'RJ', plate: { bg: '#f7f7f5', fg: '#1d1d1f', band: '#1f3a7a', top: '#1f3a7a', name: 'BRASIL', fmt: '@@@#@##' } },
  wc: { zh: '西开普省', en: 'Western Cape', kind: 'province', abbr: 'WC', plate: { bg: '#f7f7f5', fg: '#1d1d1f', top: '#2f5fb8', name: 'Western Cape', fmt: 'CA ###-###' } },
};
// (plate fmt: @ = a letter, # = a digit, anything else as it is)
// What the land round a town looks like. peak: how its mountains are drawn (peak: pointed, with snow if snow > 0;
// dome: rounded hills; mesa: red rock with a flat top; table: a flat-topped mountain; sugar: steep granite domes;
// none: flat country, no mountains); cols: their light and shady sides; tall: how high; hill: the colours of the
// hill the interstate tunnels through (dark to light).
const TERRAINS = {
  golden:    { e: '🌾', zh: '金色丘陵', en: 'Golden hills', peak: 'dome', cols: ['#d8b664', '#b9954a'], tall: 0.75, hill: ['#8c6d2f', '#e6c97c'] },
  wetland:   { e: '🐊', zh: '海边湿地', en: 'Coastal wetland', peak: 'none' },
  desert:    { e: '🏜️', zh: '沙漠台地', en: 'Desert mesas', peak: 'mesa', cols: ['#d98a52', '#b5643a'], tall: 1.0 },
  forest:    { e: '🌲', zh: '林木山地', en: 'Wooded mountains', peak: 'dome', cols: ['#4d8a4a', '#356b38'], tall: 1.0, hill: ['#2f5f33', '#6fae62'] },
  alpine:    { e: '🏔️', zh: '雪山', en: 'Snowy peaks', peak: 'peak', cols: ['#8e9c86', '#6d7a67'], snow: 0.35, tall: 1.2 },
  limestone: { e: '⛰️', zh: '石灰岩山', en: 'Limestone hills', peak: 'peak', cols: ['#b3ad95', '#938d78'], snow: 0.4, snowCol: '#efebe0', tall: 0.75, hill: ['#7f8f5f', '#c9c7a6'] },
  polder:    { e: '🌷', zh: '圩田平原', en: 'Polder flats', peak: 'none' },
  fjord:     { e: '🛶', zh: '峡湾高山', en: 'Fjord mountains', peak: 'peak', cols: ['#66746e', '#4a5752'], snow: 0.28, tall: 1.5, hill: ['#3a4a44', '#8fa49a'] },
  tea:       { e: '🍵', zh: '茶山', en: 'Tea hills', peak: 'dome', cols: ['#6fae5a', '#4f8d45'], tall: 0.75, terraces: true, hill: ['#3f7a3a', '#9cd07f'] },
  sandstone: { e: '🐨', zh: '砂岩丘陵', en: 'Sandstone hills', peak: 'dome', cols: ['#9cb38a', '#7a9468'], tall: 0.6, hill: ['#5f7a4f', '#c9b98a'] },
  andes:     { e: '🌴', zh: '安第斯山', en: 'The Andes', peak: 'peak', cols: ['#4f8a4a', '#3a6d38'], tall: 1.3, hill: ['#2f5f2f', '#79b96a'] },
  downs:     { e: '🐑', zh: '低缓丘陵', en: 'Rolling downs', peak: 'dome', cols: ['#8cc46b', '#6fa856'], tall: 0.42, hill: ['#4f8a45', '#a6d68a'] },
  rocky:     { e: '🪨', zh: '青山', en: 'Rocky green hills', peak: 'peak', cols: ['#6f9a5f', '#557d48'], tall: 0.85, hill: ['#3f6a3a', '#93bf7f'] },
  granite:   { e: '🗿', zh: '花岗岩峰', en: 'Granite domes', peak: 'sugar', cols: ['#8a948a', '#69736a'], tall: 1.5, hill: ['#4f5a50', '#a9b3a4'] },
  table:     { e: '🍷', zh: '桌山', en: 'Table mountains', peak: 'table', cols: ['#8a9480', '#68735f'], tall: 1.1, hill: ['#5a6a4f', '#b3b89a'] },
};
// police cars: pattern (doors: dark car, white doors; stripe: a band down the side; checks: blocks in two colours;
// twotone: dark below, white above), body / a / b colours, the word on the side, the lights on the roof
const COUNTIES = {
  monterey:  { zh: '蒙特雷县', en: 'Monterey County', state: 'ca', terrain: 'golden', cost: 1.15, wage: 1.2, folk: 'us', specials: ['avotoast', 'artichoke'],
    near: [['萨利纳斯', 'Salinas'], ['卡梅尔', 'Carmel'], ['蒙特雷', 'Monterey'], ['金城', 'King City']], police: { pat: 'doors', body: '#1d1d1f', a: '#f4f4f0', text: 'SHERIFF', lights: ['#ff4d4d', '#3b7bff'] } },
  collier:   { zh: '科利尔县', en: 'Collier County', state: 'fl', terrain: 'wetland', cost: 1.0, wage: 0.95, folk: 'us', specials: ['keylime', 'ojuice'],
    near: [['那不勒斯', 'Naples'], ['伊莫卡利', 'Immokalee'], ['马可岛', 'Marco Island'], ['埃弗格雷兹城', 'Everglades City']], police: { pat: 'stripe', body: '#f4f4f0', a: '#1f6b45', b: '#c9a24a', text: 'SHERIFF', lights: ['#ff4d4d', '#3b7bff'] } },
  pinal:     { zh: '皮纳尔县', en: 'Pinal County', state: 'az', terrain: 'desert', cost: 0.9, wage: 0.9, folk: 'us', specials: ['pricklypear', 'burrito'],
    near: [['卡萨格兰德', 'Casa Grande'], ['佛罗伦萨', 'Florence'], ['马里科帕', 'Maricopa'], ['埃洛伊', 'Eloy']], police: { pat: 'stripe', body: '#f4f4f0', a: '#8a5a36', b: '#d9b866', text: 'SHERIFF', lights: ['#ff4d4d', '#3b7bff'] } },
  lamoille:  { zh: '拉莫伊尔县', en: 'Lamoille County', state: 'vt', terrain: 'forest', cost: 1.0, wage: 0.95, folk: 'us', specials: ['maplesyrup', 'cheddar'],
    near: [['斯托', 'Stowe'], ['莫里斯维尔', 'Morrisville'], ['约翰逊', 'Johnson'], ['海德公园', 'Hyde Park']], police: { pat: 'stripe', body: '#1f4d32', a: '#f2c230', b: '#f2c230', text: 'STATE POLICE', lights: ['#3b7bff', '#ff4d4d'] } },
  bighorn:   { zh: '比格霍恩区', en: 'MD of Bighorn', state: 'ab', terrain: 'alpine', cost: 1.0, wage: 0.9, folk: 'ca', specials: ['poutine', 'beefjerky'],
    near: [['班夫', 'Banff'], ['坎莫尔', 'Canmore'], ['埃克肖', 'Exshaw'], ['路易斯湖', 'Lake Louise']], police: { pat: 'stripe', body: '#f4f4f0', a: '#2f5fb8', b: '#f2c230', text: 'RCMP · GRC', lights: ['#ff4d4d', '#3b7bff'] } },
  vaucluse:  { zh: '沃克吕兹省', en: 'Vaucluse', state: 'paca', terrain: 'limestone', cost: 1.05, wage: 0.95, folk: 'fr', specials: ['lavhoney', 'melon'],
    near: [['阿维尼翁', 'Avignon'], ['卡瓦永', 'Cavaillon'], ['戈尔德', 'Gordes'], ['奥朗日', 'Orange']], police: { pat: 'stripe', body: '#1f3a7a', a: '#f4f4f0', b: '#e5484d', text: 'GENDARMERIE', lights: ['#3b7bff', '#3b7bff'] } },
  zaanstad:  { zh: '赞斯塔德', en: 'Zaanstad', state: 'nh', terrain: 'polder', cost: 1.1, wage: 1.05, folk: 'nl', specials: ['gouda', 'stroopwafel'],
    near: [['赞丹', 'Zaandam'], ['克罗门尼', 'Krommenie'], ['沃默', 'Wormer'], ['阿姆斯特丹', 'Amsterdam']], police: { pat: 'checks', body: '#f4f4f0', a: '#2f5fb8', b: '#f28c28', text: 'POLITIE', lights: ['#3b7bff', '#3b7bff'] } },
  aurland:   { zh: '奥兰', en: 'Aurland', state: 'vl', terrain: 'fjord', cost: 1.3, wage: 1.25, folk: 'no', specials: ['salmon', 'brunost'],
    near: [['弗洛姆', 'Flåm'], ['居德旺恩', 'Gudvangen'], ['莱达尔', 'Lærdal'], ['沃斯', 'Voss']], police: { pat: 'checks', body: '#f4f4f0', a: '#1d1d1f', b: '#f2c230', text: 'POLITI', lights: ['#3b7bff', '#3b7bff'] } },
  uji:       { zh: '宇治市', en: 'Uji', state: 'kyo', terrain: 'tea', cost: 0.9, wage: 0.85, folk: 'jp', specials: ['matcha', 'dango'],
    near: [['伏见', 'Fushimi'], ['城阳', 'Joyo'], ['宇治田原', 'Ujitawara'], ['京田边', 'Kyotanabe']], police: { pat: 'twotone', body: '#1d1d1f', a: '#f4f4f0', text: '警察', lights: ['#ff4d4d', '#ff4d4d'] } },
  xihu:      { zh: '西湖区', en: 'Xihu District', state: 'zj', terrain: 'tea', cost: 0.7, wage: 0.65, folk: 'cn', specials: ['longjing', 'beggarchicken'],
    near: [['龙井村', 'Longjing'], ['梅家坞', 'Meijiawu'], ['灵隐', 'Lingyin'], ['转塘', 'Zhuantang']], police: { pat: 'stripe', body: '#f4f4f0', a: '#2f5fb8', b: '#2f5fb8', text: '公安', lights: ['#ff4d4d', '#3b7bff'] } },
  northbeach:{ zh: '北部海滩区', en: 'Northern Beaches', state: 'nsw', terrain: 'sandstone', cost: 1.15, wage: 1.1, folk: 'au', specials: ['meatpie', 'lamington'],
    near: [['曼利', 'Manly'], ['迪怀', 'Dee Why'], ['阿瓦隆', 'Avalon'], ['棕榈滩', 'Palm Beach']], police: { pat: 'checks', body: '#f4f4f0', a: '#1f3a7a', b: '#f4f4f0', text: 'POLICE', lights: ['#ff4d4d', '#3b7bff'] } },
  salento:   { zh: '萨伦托', en: 'Salento', state: 'qui', terrain: 'andes', cost: 0.6, wage: 0.55, folk: 'co', specials: ['coffee', 'arepa'],
    near: [['菲兰迪亚', 'Filandia'], ['亚美尼亚', 'Armenia'], ['奇纳奇奥塔', 'Circasia'], ['科科拉谷', 'Cocora']], police: { pat: 'stripe', body: '#f4f4f0', a: '#1f6b45', b: '#1f6b45', text: 'POLICÍA', lights: ['#ff4d4d', '#3b7bff'] } },
  surrey:    { zh: '萨里郡', en: 'Surrey', state: 'eng', terrain: 'downs', cost: 1.15, wage: 1.05, folk: 'uk', specials: ['creamtea', 'fishchips'],
    near: [['吉尔福德', 'Guildford'], ['沃金', 'Woking'], ['多金', 'Dorking'], ['法纳姆', 'Farnham']], police: { pat: 'checks', body: '#f4f4f0', a: '#f2d24b', b: '#2f5fb8', text: 'POLICE', lights: ['#3b7bff', '#3b7bff'] } },
  yangpyeong:{ zh: '杨平郡', en: 'Yangpyeong County', state: 'gg', terrain: 'rocky', cost: 0.9, wage: 0.85, folk: 'kr', specials: ['kimchi', 'tteokbokki'],
    near: [['两水里', 'Dumulmeori'], ['龙门', 'Yongmun'], ['加平', 'Gapyeong'], ['南杨州', 'Namyangju']], police: { pat: 'stripe', body: '#f4f4f0', a: '#1f3a7a', b: '#f2c230', text: 'POLICE', lights: ['#ff4d4d', '#3b7bff'] } },
  niteroi:   { zh: '尼泰罗伊', en: 'Niterói', state: 'rj', terrain: 'granite', cost: 0.7, wage: 0.6, folk: 'br', specials: ['acai', 'paodequeijo'],
    near: [['伊卡拉伊', 'Icaraí'], ['圣贡萨洛', 'São Gonçalo'], ['马里卡', 'Maricá'], ['里约热内卢', 'Rio de Janeiro']], police: { pat: 'stripe', body: '#f4f4f0', a: '#1f3a7a', b: '#e5484d', text: 'POLÍCIA', lights: ['#ff4d4d', '#ff4d4d'] } },
  stellenbosch: { zh: '斯泰伦博斯', en: 'Stellenbosch', state: 'wc', terrain: 'table', cost: 0.7, wage: 0.6, folk: 'za', specials: ['rooibos', 'biltong'],
    near: [['弗朗斯胡克', 'Franschhoek'], ['帕尔', 'Paarl'], ['萨默塞特西', 'Somerset West'], ['开普敦', 'Cape Town']], police: { pat: 'stripe', body: '#f4f4f0', a: '#2f5fb8', b: '#f2c230', text: 'POLICE', lights: ['#3b7bff', '#3b7bff'] } },
};
Object.entries({ wutong: 'monterey', palmbay: 'collier', cactus: 'pinal', vermont: 'lamoille', banff: 'bighorn', provence: 'vaucluse', holland: 'zaanstad', fjord: 'aurland',
  kyoto: 'uji', hangzhou: 'xihu', sydney: 'northbeach', andes: 'salento', london: 'surrey', seoul: 'yangpyeong', rio: 'niteroi', capetown: 'stellenbosch' }).forEach(([t, c]) => { COMMUNITIES[t].county = c; });
// The county's own food and drink, sold only in its supermarket (real local prices in dollars). Eat it there, or take
// it home to give someone. The first time you taste each one counts towards your collection (S.tasted).
const SPECIALTIES = {
  avotoast:     { e: '🥑', zh: '加州牛油果吐司', en: 'Avocado toast', price: 12, hunger: 30, fun: 6 },
  artichoke:    { e: '🌿', zh: '炸洋蓟', en: 'Fried artichokes', price: 10, hunger: 25, fun: 6 },
  keylime:      { e: '🥧', zh: '青柠派', en: 'Key lime pie', price: 7, hunger: 20, fun: 8 },
  ojuice:       { e: '🍊', zh: '鲜榨橙汁', en: 'Fresh orange juice', price: 5, hunger: 10, fun: 6 },
  pricklypear:  { e: '🌵', zh: '仙人掌果糖', en: 'Prickly pear candy', price: 6, hunger: 8, fun: 8 },
  burrito:      { e: '🌯', zh: '墨西哥卷饼', en: 'Burrito', price: 11, hunger: 40, fun: 5 },
  maplesyrup:   { e: '🍁', zh: '枫糖浆松饼', en: 'Pancakes & maple syrup', price: 13, hunger: 35, fun: 7 },
  cheddar:      { e: '🧀', zh: '佛蒙特切达奶酪', en: 'Vermont cheddar', price: 9, hunger: 15, fun: 6 },
  poutine:      { e: '🍟', zh: '肉汁奶酪薯条', en: 'Poutine', price: 11, hunger: 40, fun: 6 },
  beefjerky:    { e: '🥩', zh: '艾伯塔牛肉干', en: 'Alberta beef jerky', price: 10, hunger: 15, fun: 5 },
  lavhoney:     { e: '🍯', zh: '薰衣草蜂蜜', en: 'Lavender honey', price: 12, hunger: 8, fun: 8 },
  melon:        { e: '🍈', zh: '卡瓦永甜瓜', en: 'Cavaillon melon', price: 6, hunger: 15, fun: 6 },
  gouda:        { e: '🧀', zh: '豪达奶酪', en: 'Gouda cheese', price: 9, hunger: 15, fun: 6 },
  stroopwafel:  { e: '🧇', zh: '焦糖华夫饼', en: 'Stroopwafel', price: 4, hunger: 10, fun: 8 },
  salmon:       { e: '🐟', zh: '挪威三文鱼', en: 'Norwegian salmon', price: 18, hunger: 35, fun: 6 },
  brunost:      { e: '🧀', zh: '挪威棕奶酪', en: 'Brown cheese', price: 9, hunger: 12, fun: 7 },
  matcha:       { e: '🍵', zh: '宇治抹茶', en: 'Uji matcha', price: 6, hunger: 5, fun: 9 },
  dango:        { e: '🍡', zh: '抹茶团子', en: 'Matcha dango', price: 4, hunger: 12, fun: 8 },
  longjing:     { e: '🍵', zh: '西湖龙井', en: 'Longjing tea', price: 8, hunger: 5, fun: 9 },
  beggarchicken:{ e: '🍗', zh: '叫花鸡', en: 'Beggar’s chicken', price: 16, hunger: 45, fun: 7 },
  meatpie:      { e: '🥧', zh: '澳式肉派', en: 'Aussie meat pie', price: 7, hunger: 35, fun: 5 },
  lamington:    { e: '🍰', zh: '拉明顿蛋糕', en: 'Lamington', price: 5, hunger: 12, fun: 8 },
  coffee:       { e: '☕', zh: '哥伦比亚咖啡', en: 'Colombian coffee', price: 4, hunger: 5, fun: 9 },
  arepa:        { e: '🫓', zh: '玉米饼', en: 'Arepa', price: 5, hunger: 30, fun: 5 },
  creamtea:     { e: '🫖', zh: '司康下午茶', en: 'Cream tea', price: 12, hunger: 20, fun: 8 },
  fishchips:    { e: '🐟', zh: '炸鱼薯条', en: 'Fish and chips', price: 14, hunger: 45, fun: 5 },
  kimchi:       { e: '🥬', zh: '韩式泡菜', en: 'Kimchi', price: 7, hunger: 12, fun: 6 },
  tteokbokki:   { e: '🍢', zh: '炒年糕', en: 'Tteokbokki', price: 6, hunger: 30, fun: 7 },
  acai:         { e: '🍇', zh: '巴西莓碗', en: 'Açaí bowl', price: 8, hunger: 25, fun: 7 },
  paodequeijo:  { e: '🧀', zh: '巴西奶酪面包', en: 'Pão de queijo', price: 4, hunger: 15, fun: 6 },
  rooibos:      { e: '🫖', zh: '南非博士茶', en: 'Rooibos tea', price: 4, hunger: 5, fun: 8 },
  biltong:      { e: '🥩', zh: '南非风干肉', en: 'Biltong', price: 9, hunger: 15, fun: 6 },
};
Object.entries(COUNTIES).forEach(([c, C]) => C.specials.forEach(k => { SPECIALTIES[k].county = c; }));
// People's names in each part of the world (the people who live in a town and work in its shops: v0.40 townsfolk)
const FOLK_NAMES = {
  us: [['Emily', '艾米丽'], ['Jake', '杰克'], ['Olivia', '奥利维亚'], ['Ethan', '伊森'], ['Maria', '玛丽亚'], ['Carlos', '卡洛斯'], ['Darnell', '达内尔'], ['Mei', '小美'], ['Raj', '拉吉'], ['Grace', '格蕾丝'], ['Noah', '诺亚'], ['Ava', '艾娃'], ['Sofia', '索菲亚'], ['Tyrone', '泰隆']],
  ca: [['Chloé', '克洛伊'], ['Liam', '利亚姆'], ['Émile', '埃米尔'], ['Sophie', '索菲'], ['Owen', '欧文'], ['Maya', '玛雅'], ['Jasmine', '茉莉'], ['Logan', '洛根'], ['Amélie', '阿梅莉'], ['Ravi', '拉维'], ['Hannah', '汉娜'], ['Gabriel', '加布里埃尔']],
  fr: [['Camille', '卡米耶'], ['Louis', '路易'], ['Léa', '莉亚'], ['Hugo', '雨果'], ['Manon', '玛农'], ['Jules', '朱尔'], ['Inès', '伊内丝'], ['Arthur', '阿蒂尔'], ['Yasmine', '雅斯敏'], ['Théo', '泰奥'], ['Zoé', '佐伊'], ['Mathis', '马蒂斯']],
  nl: [['Lotte', '洛特'], ['Daan', '达安'], ['Femke', '芬可'], ['Bram', '布拉姆'], ['Anouk', '阿努克'], ['Thijs', '泰斯'], ['Sanne', '桑妮'], ['Joost', '约斯特'], ['Noor', '努尔'], ['Sem', '塞姆'], ['Lieke', '莉可'], ['Ruben', '鲁本']],
  no: [['Ingrid', '英格丽'], ['Lars', '拉尔斯'], ['Sigrid', '西格丽'], ['Magnus', '马格努斯'], ['Nora', '诺拉'], ['Erik', '埃里克'], ['Astrid', '阿斯特丽德'], ['Ole', '奥勒'], ['Maja', '玛雅'], ['Henrik', '亨里克'], ['Solveig', '索尔维格'], ['Jonas', '约纳斯']],
  jp: [['Yuki', '由纪'], ['Haruto', '阳翔'], ['Sakura', '小樱'], ['Ren', '莲'], ['Aoi', '葵'], ['Sota', '苍太'], ['Hina', '阳菜'], ['Kenji', '健二'], ['Mio', '美绪'], ['Daiki', '大辉'], ['Emi', '惠美'], ['Takumi', '拓海']],
  cn: [['Xiao Lin', '小林'], ['Wang Fang', '王芳'], ['Chen Jie', '陈杰'], ['Liu Yang', '刘洋'], ['Zhang Ting', '张婷'], ['Li Ming', '李明'], ['Zhou Yue', '周悦'], ['Zhao Lei', '赵磊'], ['Sun Li', '孙丽'], ['Hu Bo', '胡波'], ['Xu Qing', '许晴'], ['Ma Chao', '马超']],
  au: [['Charlotte', '夏洛特'], ['Jack', '杰克'], ['Isla', '艾拉'], ['Oliver', '奥利弗'], ['Ruby', '露比'], ['Cooper', '库珀'], ['Matilda', '玛蒂尔达'], ['Lachlan', '拉克伦'], ['Mia', '米娅'], ['Kai', '凯'], ['Zara', '扎拉'], ['Hamish', '哈米什']],
  co: [['Valentina', '瓦伦蒂娜'], ['Santiago', '圣地亚哥'], ['Camila', '卡米拉'], ['Mateo', '马特奥'], ['Isabella', '伊莎贝拉'], ['Juan', '胡安'], ['Luciana', '卢西亚娜'], ['Andrés', '安德烈斯'], ['Mariana', '玛丽安娜'], ['Felipe', '费利佩'], ['Daniela', '达妮埃拉'], ['Sebastián', '塞巴斯蒂安']],
  uk: [['Amelia', '阿米莉亚'], ['Harry', '哈利'], ['Poppy', '波比'], ['George', '乔治'], ['Freya', '弗蕾亚'], ['Alfie', '阿尔菲'], ['Priya', '普丽娅'], ['Arthur', '亚瑟'], ['Imogen', '伊莫金'], ['Kwame', '夸梅'], ['Elsie', '埃尔西'], ['Oscar', '奥斯卡']],
  kr: [['Ji-woo', '智宇'], ['Min-jun', '敏俊'], ['Seo-yeon', '书妍'], ['Do-yun', '道允'], ['Ha-eun', '夏恩'], ['Ji-ho', '智浩'], ['Su-a', '秀雅'], ['Joon', '俊'], ['Ye-jin', '艺珍'], ['Hyun', '贤'], ['Na-rae', '娜来'], ['Tae-min', '泰民']],
  br: [['Ana', '安娜'], ['Pedro', '佩德罗'], ['Beatriz', '贝亚特丽斯'], ['Gabriel', '加布里埃尔'], ['Larissa', '拉丽莎'], ['Thiago', '蒂亚戈'], ['Júlia', '朱莉娅'], ['Rafael', '拉斐尔'], ['Luana', '卢安娜'], ['Caio', '卡伊奥'], ['Fernanda', '费尔南达'], ['Lucas', '卢卡斯']],
  za: [['Thandi', '坦迪'], ['Sipho', '西波'], ['Lerato', '莱拉托'], ['Pieter', '彼得'], ['Naledi', '纳莱迪'], ['Johan', '约翰'], ['Zanele', '扎内莱'], ['Ruan', '鲁安'], ['Ayanda', '阿扬达'], ['Kagiso', '卡吉索'], ['Annelie', '安妮莉'], ['Musa', '穆萨']],
};
// v0.40: how many townsfolk live in each town (besides the ones who work in its shops)
const TOWNSFOLK = { residents: 10 };
// a specialty given as a gift: how much more it pleases them; sold back: this share of its price
const SPECIAL = { giftUp: 3, sellBack: 0.5, visitH: 3 };   // visitH: after the train ride, hours you can shop in that town
// Real time zones (v0.11): day and night in each community follow its own local time.
const COMMUNITY_TZ = { wutong: 'America/Los_Angeles', palmbay: 'America/New_York', cactus: 'America/Phoenix', vermont: 'America/New_York',
  banff: 'America/Edmonton', provence: 'Europe/Paris', holland: 'Europe/Amsterdam', fjord: 'Europe/Oslo', kyoto: 'Asia/Tokyo',
  hangzhou: 'Asia/Shanghai', sydney: 'Australia/Sydney', andes: 'America/Bogota', london: 'Europe/London', seoul: 'Asia/Seoul',
  rio: 'America/Sao_Paulo', capetown: 'Africa/Johannesburg' };
Object.entries(COMMUNITY_TZ).forEach(([k, tz]) => { COMMUNITIES[k].tz = tz; });
// ---------- bodies and clothes (v0.18) ----------
// Your townie's build is your choice (not your health data). Clothes are bought at the mall's clothing shop and
// worn from the wardrobe, each in any colour. A dress is a top that covers the bottoms too.
const BODY_TYPES = {
  regular: { zh: '标准', en: 'Regular', w: 1, h: 1 }, slim: { zh: '苗条', en: 'Slim', w: 0.86, h: 1.03 }, broad: { zh: '健壮', en: 'Broad', w: 1.16, h: 1.01 },
  round: { zh: '圆润', en: 'Round', w: 1.28, h: 0.97 }, tall: { zh: '高个', en: 'Tall', w: 0.96, h: 1.12 }, petite: { zh: '娇小', en: 'Petite', w: 0.98, h: 0.88 },
};
const CLOTHES = {
  tshirt:   { slot: 'top', e: '👕', zh: 'T 恤', en: 'T-shirt', price: 0 },
  polo:     { slot: 'top', e: '👔', zh: 'Polo 衫', en: 'Polo shirt', price: 60 },
  hoodie:   { slot: 'top', e: '🧥', zh: '连帽卫衣', en: 'Hoodie', price: 120 },
  sweater:  { slot: 'top', e: '🧶', zh: '毛衣', en: 'Sweater', price: 140 },
  jacket:   { slot: 'top', e: '🧥', zh: '夹克', en: 'Jacket', price: 220 },
  dress:    { slot: 'top', e: '👗', zh: '连衣裙', en: 'Dress', price: 200 },
  jeans:    { slot: 'bottom', e: '👖', zh: '长裤', en: 'Trousers', price: 0 },
  shorts:   { slot: 'bottom', e: '🩳', zh: '短裤', en: 'Shorts', price: 60 },
  skirt:    { slot: 'bottom', e: '👗', zh: '半身裙', en: 'Skirt', price: 90 },
  sneakers: { slot: 'shoes', e: '👟', zh: '运动鞋', en: 'Sneakers', price: 0 },
  hightops: { slot: 'shoes', e: '👟', zh: '高帮鞋', en: 'High-tops', price: 110 },
  boots:    { slot: 'shoes', e: '🥾', zh: '靴子', en: 'Boots', price: 150 },
  sandals:  { slot: 'shoes', e: '🩴', zh: '凉鞋', en: 'Sandals', price: 50 },
  nohat:    { slot: 'hat', e: '🙂', zh: '不戴帽子', en: 'No hat', price: 0 },
  cap:      { slot: 'hat', e: '🧢', zh: '棒球帽', en: 'Cap', price: 70 },
  beanie:   { slot: 'hat', e: '🧶', zh: '毛线帽', en: 'Beanie', price: 80 },
  sunhat:   { slot: 'hat', e: '👒', zh: '遮阳帽', en: 'Sun hat', price: 90 },
};
const CLOTHES_SLOTS = ['top', 'bottom', 'shoes', 'hat'];
SHOP_SUBS.clothes = CLOTHES_SLOTS.map(slot => ({ id: slot, e: { top: '👕', bottom: '👖', shoes: '👟', hat: '🧢' }[slot],
  zh: { top: '上衣', bottom: '下装', shoes: '鞋', hat: '帽子' }[slot], en: { top: 'Tops', bottom: 'Bottoms', shoes: 'Shoes', hat: 'Hats' }[slot],
  keys: Object.keys(CLOTHES).filter(k => CLOTHES[k].slot === slot && k !== 'nohat') }));
// Townies get a build and an outfit of their own (picked from their id, so it stays the same every visit).
function dressUp(look, id) {
  if (!look || look.body) return look;
  let n = 11; for (const ch of String(id)) n = (n * 131 + ch.charCodeAt(0)) % 999983;
  const r = () => { n = (n * 16807) % 2147483647; return (n % 10000) / 10000; }, pick = a => a[Math.floor(r() * a.length)];
  const of = slot => Object.keys(CLOTHES).filter(k => CLOTHES[k].slot === slot);
  look.body = pick(Object.keys(BODY_TYPES));
  // dresses and skirts are for anyone, a little more often with long hair or a bun
  const soft = look.hair === 'long' || look.hair === 'bun', tops = of('top').filter(k => k !== 'dress' || r() < (soft ? 0.9 : 0.15));
  look.top = pick(tops); look.bottom = look.top === 'dress' ? 'jeans' : r() < (soft ? 0.3 : 0.05) ? 'skirt' : pick(['jeans', 'jeans', 'shorts']);
  look.shoes = pick(of('shoes')); look.hat = r() < 0.55 ? 'nohat' : pick(of('hat').filter(k => k !== 'nohat'));
  look.pants = pick(['#4a5a78', '#2d2d2d', '#8a5a36', '#c9b98f', '#6366f1', '#9aa3ad', '#34b27b']);
  look.shoeCol = pick(['#3b3028', '#f4f4f0', '#2d2d2d', '#e5484d', '#38a3e0', '#8a5a36']);
  look.hatCol = pick(CLOTH_COLORS);
  return look;
}
const CLOTHES_FREE = ['tshirt', 'jeans', 'sneakers', 'nohat'];
const CLOTH_COLORS = ['#ef6f6c', '#f59e0b', '#e8c02e', '#34b27b', '#38a3e0', '#6366f1', '#a46ef0', '#ec6aa8', '#f4f4f0', '#2d2d2d', '#4a5a78', '#8a5a36', '#c9b98f', '#9aa3ad'];
// ---------- things to do at the mall (v0.18) ----------
// The cinema (a short film; collect them all), the claw machine (win plush toys for your home) and the food court.
const MALL = {
  movie: 20, claw: 10, clawWin: 0.35,
  movies: {
    dino:  { e: '🦖', zh: '恐龙乐园', en: 'Dino Park' },     space: { e: '🚀', zh: '星际旅行', en: 'Space Trip' },
    love:  { e: '💕', zh: '怦然心动', en: 'Heartbeat' },     ocean: { e: '🐳', zh: '深海奇遇', en: 'Deep Blue' },
    hero:  { e: '🦸', zh: '超级英雄', en: 'Super Hero' },    pets:  { e: '🐶', zh: '汪汪队长', en: 'Captain Woof' },
  },
  foods: {
    burger: { e: '🍔', zh: '汉堡套餐', en: 'Burger meal', price: 15 }, noodles: { e: '🍜', zh: '牛肉面', en: 'Beef noodles', price: 12 },
    pizza:  { e: '🍕', zh: '披萨', en: 'Pizza', price: 18 },          sushi:   { e: '🍣', zh: '寿司', en: 'Sushi', price: 22 },
    boba:   { e: '🧋', zh: '珍珠奶茶', en: 'Bubble tea', price: 8 },  icecream: { e: '🍦', zh: '冰淇淋', en: 'Ice cream', price: 6 },
  },
  plush: { plushbear: '🧸', plushbunny: '🐰', plushcat: '🐱', plushdino: '🦖', plushduck: '🦆', plushpanda: '🐼' },
  // v0.20: what they're for. A meal fills you up for a few hours: more pay at work and quicker on foot. Each film you
  // see gives you its poster for your home (posters and plush toys add to what your home is worth). Win all six plush
  // toys and the claw machine's giant teddy is yours too.
  fed: { hours: 3, pay: 0.2, walk: 0.2 },
};
// ---------- stores (v0.17) ----------
// Things are bought in the store that sells them (go there, go in, buy). The market sells seeds (and buys your
// goods); the others are their own buildings in every town, placed beside a road near the town centre.
const STORES = {
  market:    { e: '🛒', zh: '超市', en: 'Market', cats: ['seeds', 'sell'] },
  nursery:   { e: '🌳', zh: '花园苗圃', en: 'Garden centre', cats: ['trees', 'yard'], w: 9, d: 7, wall: '#eef6ea', roof: '#5aa552' },
  ranch:     { e: '🐮', zh: '牲畜店', en: 'Livestock store', cats: ['animals'], w: 9, d: 7, wall: '#c0453a', roof: '#7a3a30' },
  petshop:   { e: '🐾', zh: '宠物店', en: 'Pet shop', cats: ['pets'], w: 6, d: 5.5, wall: '#f9e7ef', roof: '#ec6aa8' },
  furniture: { e: '🛋️', zh: '家具店', en: 'Furniture store', cats: ['furn'], w: 7, d: 6, wall: '#efe6d6', roof: '#8a5a36' },
  realty:    { e: '🏠', zh: '房产中介', en: 'Real estate', cats: ['land', 'houses'], w: 6, d: 5.5, wall: '#eaf0f6', roof: '#2f6fb2' },
  dealer:    { e: '🚗', zh: '车行', en: 'Car dealer', cats: ['cars'], w: 10, d: 7, wall: '#e8edf2', roof: '#5b6470' },
  police:    { e: '🚓', zh: '警察局', en: 'Police station', cats: [], civic: true, w: 7, d: 6, wall: '#eef2f8', roof: '#2f5fb3' },
  school:    { e: '🏫', zh: '学校', en: 'School', cats: [], civic: true, w: 10, d: 7, wall: '#b5563c', roof: '#5b5f66' },
  firestation: { e: '🚒', zh: '消防站', en: 'Fire station', cats: [], civic: true, w: 7, d: 6, wall: '#c9433b', roof: '#8a2a24' },
  gas:       { e: '⛽', zh: '加油站', en: 'Petrol station', cats: [], civic: true, w: 5, d: 3, wall: '#f4f4f0', roof: '#e5484d' },
  mall:      { e: '🏬', zh: '购物中心', en: 'Shopping mall', cats: ['clothes', 'excl'], w: 12, d: 9, wall: '#f4efe6', roof: '#c9893a' },
  // v0.38: more of a real town. late: placed after all the others and their car parks, so nothing that was already in
  // a town moves
  hospital:  { e: '🚑', zh: '医院', en: 'Hospital', cats: [], civic: true, late: true, w: 10, d: 7, wall: '#f4f7f9', roof: '#e5484d' },
  bowling:   { e: '🎳', zh: '保龄球馆', en: 'Bowling alley', cats: [], civic: true, late: true, w: 10, d: 7, wall: '#33407a', roof: '#f2c230' },
  amuse:     { e: '🎡', zh: '游乐园', en: 'Amusement park', cats: [], civic: true, late: 2, w: 16, d: 11, wall: '#f4ead8', roof: '#e5484d' },   // v0.41: rides out in the open, after the interstate is built
  zoo:       { e: '🦁', zh: '动物园', en: 'Zoo', cats: [], civic: true, late: 2, w: 16, d: 12, wall: '#efe3c4', roof: '#3f8a4a' },   // v0.42: animals in the open, after the amusement park
  stadium:   { e: '🏟️', zh: '体育场', en: 'Stadium', cats: [], civic: true, late: 2, w: 16, d: 13, wall: '#d8dde3', roof: '#2f5fa8' },   // v0.42: an open bowl with floodlights
  aquatic:   { e: '🏊', zh: '游泳馆', en: 'Swimming centre', cats: [], civic: true, late: true, w: 10, d: 7, wall: '#e6f3fa', roof: '#38a3e0' },
  museum:    { e: '🦖', zh: '博物馆', en: 'Museum', cats: [], civic: true, late: true, w: 10, d: 7, wall: '#efe8da', roof: '#8a7a5a' },
  station:   { e: '🚉', zh: '火车站', en: 'Train station', cats: [], civic: true, late: true, w: 10, d: 6, wall: '#c98a5a', roof: '#3d4a66' },
};
// Which store sells each shop category.
const CAT_STORE = {};
Object.entries(STORES).forEach(([k, s]) => s.cats.forEach(c => { CAT_STORE[c] = k; }));
// ---------- town layouts (v0.12) ----------
// Every country's town has its own plan. A layout has: streets (rows of parcels; each street's road is right in
// front of it, at y + LOT_D), roads [x0, y0, x1, y1, kind], the town centre (paved; the town hall plaza is 16 × 14,
// shops are 6 × 5.5), a park (about 44 × 30), a lake (an ellipse; a huge one past the edge of town is the sea),
// farm fields, water (rivers and canals; roads over them are bridges), places people walk to, and area names.
// Each layout can also be used mirrored (left ↔ right), so 8 layouts give 16 different towns.
// Your first town (梧桐镇) keeps the original plan, `grid`.
const st_ = (nb, zh, en, x, y, n) => ({ nb, zh, en, x, y, n });
const LAYOUTS = {
  grid: {   // an American suburb: blocks of streets, the town centre between two avenues, a lake fed by a river
    streets: STREETS, roads: ROADS, npcLots: NPC_LOTS,
    plaza: LANDMARKS.plaza, shops: LANDMARKS.shops, park: LANDMARKS.park, lake: LANDMARKS.lake, fields: [LANDMARKS.fields],
    centre: { x: 66.5, y: -2, w: 46, d: 32 }, water: [[176, -18, 178.4, 52]],
    places: [[90, 15], [90, 31.5], [128, 31.5], [72, 15], [102, 15], [40, 31.5], [150, 31.5]], pocket: { x: 84.6, y: 16.6, w: 10.8, d: 7 },
    labels: [['area_maple', 30, 10], ['area_center', 89, 1], ['area_lake', 144, 9], ['area_park', 90, 44], ['area_farm', 30, 47], ['area_fields', 55, 79], ['area_water', 146, 50]],
  },
  canal: {   // a Dutch / English canal village: canals behind each row of houses, a windmill lake, tulip fields
    streets: {
      gracht: st_('maple', '运河街', 'Canal Street', 0, 0, 14), tulip: st_('maple', '郁金香巷', 'Tulip Lane', 0, 22, 14),
      mill: st_('farm', '风车路', 'Mill Road', 0, 44, 14), dyke: st_('farm', '堤岸路', 'Dyke Road', 0, 66, 12),
      harbour: st_('lake', '港湾街', 'Harbour Street', 124, 40, 13), quay: st_('lake', '码头路', 'Quay Road', 124, 62, 13),
    },
    roads: [[-2, 14, 57, 16, 'street'], [-2, 36, 57, 38, 'street'], [-2, 58, 57, 60, 'street'], [-2, 80, 57, 82, 'dirt'],
      [57, -2, 60, 84, 'avenue'], [60, 32, 182, 35, 'avenue'], [120, 35, 123, 80, 'avenue'], [123, 54, 180, 56, 'street'], [123, 76, 180, 78, 'street'], [60, 69, 120, 71, 'dirt']],
    npcLots: [['gracht', 0, 5], ['gracht', 9, 5], ['tulip', 0, 6], ['tulip', 10, 4], ['mill', 2, 6], ['dyke', 0, 5], ['harbour', 0, 5], ['harbour', 8, 5], ['quay', 4, 6]],
    centre: { x: 62, y: -2, w: 57, d: 34 }, plaza: { x: 82, y: 4 },
    shops: [['library', 64, 3], ['post', 111, 3], ['bakery', 64, 22], ['cafe', 71, 22], ['market', 104, 22], ['gym', 111, 22]],
    park: { x: 66, y: 38, w: 44, d: 30 }, lake: { x: 151, y: 14, rx: 22, ry: 11 },
    fields: [{ x: 62, y: 72, w: 58, d: 16 }, { x: 124, y: 80, w: 54, d: 10 }],
    water: [[-18, 16.4, 57, 21.6], [-18, 38.4, 57, 43.6], [-18, 60.4, 57, 65.6]],
    places: [[90, 33.5], [70, 33.5], [110, 33.5], [88, 70], [150, 33.5], [30, 37], [150, 55]],
    labels: [['area_maple', 28, 8], ['area_center', 90, 1], ['area_canal', 30, 41], ['area_park', 88, 50], ['area_lake', 151, 8], ['area_fields', 90, 80], ['area_harbour', 150, 60]],
  },
  coast: {   // a beach town: the sea along the bottom, a boulevard by the beach, palm streets behind it
    streets: {
      ocean: st_('lake', '海景路', 'Ocean Drive', 0, 57, 11), palm: st_('maple', '棕榈街', 'Palm Street', 0, 35, 11),
      sunset: st_('maple', '日落巷', 'Sunset Lane', 0, 13, 11), coral: st_('lake', '珊瑚路', 'Coral Road', 132, 57, 11),
      reef: st_('maple', '礁石街', 'Reef Street', 132, 35, 11), harbor: st_('farm', '渔港路', 'Harbor Road', 132, 13, 11),
    },
    roads: [[-18, 71, 196, 74, 'avenue'], [-2, 49, 47, 51, 'street'], [-2, 27, 47, 29, 'street'], [130, 49, 182, 51, 'street'], [130, 27, 182, 29, 'street'],
      [47, -2, 50, 74, 'avenue'], [127, -2, 130, 74, 'avenue'], [50, 28, 127, 31, 'avenue']],
    npcLots: [['ocean', 0, 5], ['ocean', 7, 4], ['palm', 0, 6], ['palm', 7, 4], ['sunset', 2, 5], ['coral', 0, 6], ['coral', 7, 4], ['reef', 3, 5], ['harbor', 0, 6]],
    centre: { x: 52, y: -2, w: 72, d: 30 }, plaza: { x: 80, y: 3 },
    shops: [['library', 54, 3], ['post', 116, 3], ['bakery', 54, 20], ['cafe', 61, 20], ['market', 109, 20], ['gym', 116, 20]],
    park: { x: 66, y: 35, w: 44, d: 30 }, lake: { x: 90, y: 250, rx: 400, ry: 170, sea: true },
    fields: [{ x: -2, y: -3, w: 48, d: 14 }, { x: 131, y: -3, w: 48, d: 14 }], water: [],
    places: [[88, 29.5], [60, 29.5], [116, 29.5], [88, 72.5], [30, 72.5], [150, 72.5], [88, 67]],
    labels: [['area_maple', 22, 30], ['area_center', 88, 1], ['area_beach', 88, 80], ['area_park', 88, 45], ['area_farm', 20, 4], ['area_fields', 154, 4], ['area_harbour', 154, 30]],
  },
  river: {   // a river town: a wide river through the middle with two bridges, temples up top, rice fields below
    streets: {
      sakura: st_('maple', '樱花通', 'Blossom Row', 0, 0, 14), temple: st_('maple', '寺前街', 'Temple Street', 0, 18, 14),
      willow: st_('lake', '柳岸路', 'Willow Bank', 0, 47, 14), paddy: st_('farm', '稻田路', 'Paddy Road', 0, 66, 12),
      pine: st_('maple', '松风街', 'Pine Wind Street', 123, 0, 13), tea: st_('farm', '茶园路', 'Tea Garden Road', 123, 18, 13),
    },
    roads: [[-2, 14, 57, 16, 'street'], [-2, 32, 57, 34, 'street'], [-2, 61, 57, 63, 'street'], [-2, 80, 57, 82, 'dirt'],
      [57, -2, 60, 84, 'avenue'], [118, -2, 121, 84, 'avenue'], [60, 31, 118, 34, 'avenue'], [121, 14, 180, 16, 'street'], [121, 32, 180, 34, 'street'], [60, 77, 118, 79, 'dirt']],
    npcLots: [['sakura', 0, 5], ['sakura', 9, 5], ['temple', 2, 6], ['willow', 0, 5], ['willow', 8, 6], ['paddy', 0, 6], ['pine', 0, 5], ['pine', 8, 5], ['tea', 3, 6]],
    centre: { x: 61, y: -2, w: 56, d: 33 }, plaza: { x: 81, y: 3 },
    shops: [['library', 63, 3], ['post', 110, 3], ['bakery', 63, 21], ['cafe', 70, 21], ['market', 104, 21], ['gym', 110, 21]],
    park: { x: 66, y: 46, w: 44, d: 30 }, lake: { x: 150, y: 62, rx: 22, ry: 12 },
    fields: [{ x: 61, y: 80, w: 56, d: 10 }, { x: 123, y: 78, w: 55, d: 12 }],
    water: [[-18, 36.6, 198, 43.4]],
    places: [[89, 32.5], [64, 32.5], [114, 32.5], [88, 78], [150, 33], [30, 33], [119.5, 60]],
    labels: [['area_maple', 28, 8], ['area_center', 89, 1], ['area_river', 30, 40], ['area_park', 88, 58], ['area_lake', 150, 50], ['area_fields', 90, 86], ['area_farm', 150, 24]],
  },
  valley: {   // a mountain valley: houses up the west side, a long fjord lake down the east side
    streets: {
      birch: st_('maple', '白桦街', 'Birch Street', 0, 0, 12), cedar: st_('maple', '雪松路', 'Cedar Road', 0, 20, 12),
      aspen: st_('lake', '白杨路', 'Aspen Road', 0, 40, 12), ridge: st_('farm', '山脊路', 'Ridge Road', 0, 60, 10),
      summit: st_('lake', '山顶路', 'Summit Road', 58, 66, 12),
    },
    roads: [[-2, 14, 49, 16, 'street'], [-2, 34, 49, 36, 'street'], [-2, 54, 49, 56, 'street'], [-2, 74, 49, 76, 'dirt'],
      [49, -2, 52, 84, 'avenue'], [108, -2, 111, 84, 'avenue'], [52, 28, 108, 31, 'avenue'], [52, 80, 108, 82, 'street'], [111, 40, 124, 42, 'dirt']],
    npcLots: [['birch', 0, 4], ['birch', 8, 4], ['cedar', 0, 6], ['cedar', 6, 6], ['aspen', 0, 5], ['aspen', 8, 4], ['ridge', 0, 6], ['summit', 0, 6], ['summit', 6, 6]],
    centre: { x: 53, y: -2, w: 55, d: 30 }, plaza: { x: 72, y: 3 },
    shops: [['library', 55, 3], ['post', 101, 3], ['bakery', 55, 20], ['cafe', 62, 20], ['market', 94, 20], ['gym', 101, 20]],
    park: { x: 58, y: 33, w: 44, d: 30 }, lake: { x: 150, y: 42, rx: 24, ry: 36 },
    fields: [{ x: -2, y: 79, w: 48, d: 11 }, { x: 113, y: 81, w: 65, d: 9 }], water: [[148.8, -18, 151.2, 7]],
    places: [[80, 29.5], [56, 29.5], [105, 29.5], [80, 64], [123, 41], [24, 35], [80, 81]],
    labels: [['area_maple', 24, 8], ['area_center', 80, 1], ['area_fjord', 150, 30], ['area_park', 80, 46], ['area_farm', 20, 64], ['area_fields', 140, 86]],
  },
  terrace: {   // a hillside town: streets step down the hill one after another, joined by short steep roads
    streets: {
      t1: st_('maple', '咖啡坡', 'Coffee Slope', 0, 0, 10), t2: st_('maple', '石阶街', 'Stone Steps', 16, 18, 10),
      t3: st_('maple', '观景台路', 'Lookout Road', 32, 36, 10), t4: st_('lake', '花园坡', 'Garden Slope', 48, 54, 7),
      t5: st_('farm', '梯田路', 'Terrace Road', 64, 72, 8), e1: st_('lake', '晨光街', 'Sunrise Street', 128, 34, 12), e2: st_('maple', '暮色街', 'Dusk Street', 128, 54, 12),
    },
    roads: [[-2, 14, 43, 16, 'street'], [11, 32, 60, 34, 'street'], [27, 50, 75, 52, 'street'], [43, 68, 79, 70, 'street'], [59, 86, 99, 88, 'dirt'],
      [11, 14, 14, 34, 'street'], [27, 32, 30, 52, 'street'], [43, 50, 46, 70, 'street'], [59, 68, 62, 88, 'street'],
      [57, 28, 182, 31, 'avenue'], [57, 28, 60, 34, 'street'], [122, -2, 125, 90, 'avenue'], [125, 48, 182, 50, 'street'], [125, 68, 182, 70, 'street']],
    npcLots: [['t1', 0, 4], ['t1', 6, 4], ['t2', 0, 5], ['t2', 6, 4], ['t3', 2, 5], ['t4', 0, 4], ['t5', 0, 4], ['e1', 0, 6], ['e2', 5, 6]],
    centre: { x: 70, y: -2, w: 50, d: 30 }, plaza: { x: 87, y: 3 },
    shops: [['library', 72, 3], ['post', 113, 3], ['bakery', 72, 20], ['cafe', 79, 20], ['market', 106, 20], ['gym', 113, 20]],
    park: { x: 78, y: 34, w: 42, d: 30 }, lake: { x: 150, y: 14, rx: 22, ry: 10 },
    fields: [{ x: 100, y: 72, w: 20, d: 16 }, { x: 125, y: 74, w: 53, d: 14 }], water: [],
    places: [[95, 29.5], [60, 29.5], [123.5, 40], [99, 67], [30, 33], [150, 29.5], [60, 69]],
    labels: [['area_maple', 20, 8], ['area_center', 95, 1], ['area_terrace', 45, 45], ['area_park', 99, 44], ['area_lake', 150, 4], ['area_fields', 150, 80], ['area_farm', 80, 76]],
  },
  square: {   // an old town: the town square in the middle, streets all round it, a pond up top, the park below
    streets: {
      rue1: st_('maple', '钟楼街', 'Clock Street', 0, 4, 15), rue2: st_('maple', '面包街', 'Baker Street', 121, 4, 14),
      rue3: st_('maple', '玫瑰街', 'Rose Street', 0, 23, 15), rue4: st_('lake', '喷泉街', 'Fountain Street', 0, 41, 15),
      rue5: st_('maple', '石桥街', 'Stone Bridge Street', 121, 23, 14), rue6: st_('lake', '橄榄街', 'Olive Street', 121, 41, 14),
      rue7: st_('farm', '葡萄园路', 'Vineyard Road', 0, 61, 14),
    },
    roads: [[-2, 18, 182, 21, 'avenue'], [-2, 55, 182, 58, 'avenue'], [60, -2, 63, 92, 'avenue'], [117, -2, 120, 92, 'avenue'],
      [-2, 37, 60, 39, 'street'], [120, 37, 182, 39, 'street'], [-2, 75, 60, 77, 'dirt']],
    npcLots: [['rue1', 0, 5], ['rue1', 10, 5], ['rue2', 0, 6], ['rue3', 3, 6], ['rue4', 0, 5], ['rue5', 0, 5], ['rue5', 9, 5], ['rue6', 4, 6], ['rue7', 0, 6]],
    centre: { x: 64, y: 22, w: 52, d: 32 }, plaza: { x: 82, y: 28 },
    shops: [['library', 66, 25], ['post', 108, 25], ['bakery', 66, 46], ['cafe', 73, 46], ['market', 101, 46], ['gym', 108, 46]],
    park: { x: 68, y: 60, w: 44, d: 30 }, lake: { x: 90, y: 6, rx: 20, ry: 8 },
    fields: [{ x: -2, y: 79, w: 62, d: 11 }, { x: 121, y: 76, w: 57, d: 12 }], water: [],   // v0.17: a shopping strip between the avenue and the fields
    places: [[90, 56.5], [61.5, 30], [118.5, 30], [90, 19.5], [30, 19.5], [150, 56.5], [90, 61]],
    labels: [['area_maple', 30, 8], ['area_center', 90, 24], ['area_lake', 90, 0], ['area_park', 90, 70], ['area_farm', 28, 64], ['area_fields', 150, 72]],
  },
  harbour: {   // a harbour town: the sea along the top behind the first streets, vineyards on the hills below
    streets: {
      cliff: st_('lake', '海崖路', 'Cliff Road', 0, 10, 13), wharf: st_('lake', '码头街', 'Wharf Street', 124, 10, 13),
      hill1: st_('maple', '山坡街', 'Hillside Street', 0, 30, 13), hill2: st_('maple', '灯塔路', 'Lighthouse Road', 0, 50, 13),
      vine: st_('farm', '葡萄藤路', 'Vine Road', 0, 70, 12), east2: st_('maple', '海风街', 'Sea Breeze Street', 124, 30, 13),
    },
    roads: [[-2, 24, 55, 26, 'street'], [-2, 44, 55, 46, 'street'], [-2, 64, 55, 66, 'street'], [-2, 84, 55, 86, 'dirt'],
      [55, 8, 58, 88, 'avenue'], [120, 8, 123, 88, 'avenue'], [55, 38, 123, 41, 'avenue'], [121, 24, 182, 26, 'street'], [121, 44, 182, 46, 'street'], [58, 75, 120, 77, 'dirt']],
    npcLots: [['cliff', 0, 5], ['cliff', 8, 5], ['wharf', 0, 6], ['wharf', 8, 5], ['hill1', 3, 6], ['hill2', 0, 5], ['hill2', 8, 5], ['vine', 0, 6], ['east2', 2, 6]],
    centre: { x: 59, y: 9, w: 60, d: 29 }, plaza: { x: 81, y: 13 },
    shops: [['library', 61, 12], ['post', 112, 12], ['bakery', 61, 30], ['cafe', 68, 30], ['market', 105, 30], ['gym', 112, 30]],
    park: { x: 66, y: 43, w: 44, d: 30 }, lake: { x: 90, y: -150, rx: 400, ry: 154, sea: true },
    fields: [{ x: 60, y: 79, w: 58, d: 11 }, { x: 124, y: 50, w: 54, d: 38 }], water: [],
    places: [[89, 39.5], [56.5, 30], [121.5, 30], [88, 76], [30, 25], [150, 25], [89, 10]],
    labels: [['area_beach', 90, 3], ['area_center', 89, 14], ['area_maple', 26, 40], ['area_park', 88, 56], ['area_farm', 26, 76], ['area_fields', 150, 70], ['area_harbour', 150, 18]],
  },
};
// Which plan each community uses (and mirrored or not): no two communities are the same.
const COMMUNITY_LAYOUT = { wutong: 'grid', vermont: 'grid|f', palmbay: 'coast', sydney: 'coast|f', holland: 'canal', london: 'canal|f',
  kyoto: 'river', hangzhou: 'river|f', fjord: 'valley', banff: 'valley|f', andes: 'terrace', cactus: 'terrace|f',
  provence: 'square', seoul: 'square|f', rio: 'harbour', capetown: 'harbour|f' };
Object.entries(COMMUNITY_LAYOUT).forEach(([k, v]) => { const [l, f] = v.split('|'); COMMUNITIES[k].layout = l; COMMUNITIES[k].flip = !!f; });
// A ready-to-use layout (mirrored if asked): every x becomes MX - x. NPC lots become { id, st, p, n, house }.
const MIRROR_X = WORLD.x0 + WORLD.x1;
function buildLayout(id, flip) {
  const B = LAYOUTS[id], fx = (x, w = 0) => (flip ? MIRROR_X - x - w : x);
  const streets = {};
  Object.entries(B.streets).forEach(([k, s]) => { streets[k] = { ...s, x: fx(s.x, s.n * PARCEL) }; });
  let npcLots = B.npcLots.map((s, i) => (Array.isArray(s) ? { id: 'n' + (i + 1), st: s[0], p: s[1], n: s[2], house: i % 9 } : { ...s }));
  if (B !== LAYOUTS.grid) {   // v0.27: every town is one circle of friends and family: half as many homes, wider lots
    const keep = npcLots.filter((s, i) => i % 2 === 0);
    npcLots = keep.map(o => { const nx = keep.filter(q => q.st === o.st && q.p > o.p).sort((a, b) => a.p - b.p)[0], lim = (nx ? nx.p : B.streets[o.st].n) - o.p; return { ...o, n: Math.max(o.n, Math.min(8, lim)) }; });
  }
  npcLots = npcLots.map(o => (flip ? { ...o, p: B.streets[o.st].n - o.p - o.n } : o));
  const rect = r => (flip ? [MIRROR_X - r[2], r[1], MIRROR_X - r[0], r[3], ...r.slice(4)] : r.slice());
  const box = (b, w = b.w || 0) => ({ ...b, x: fx(b.x, w) });
  const centre = box(B.centre), plaza = box(B.plaza, LOT_W), shops = B.shops.map(([k, x, y]) => [k, fx(x, 6), y]);
  const roads = B.roads.map(rect), lake = { ...B.lake, x: fx(B.lake.x) };
  // v0.38: every town is bigger: a new district past one edge (the south; the east, or west when mirrored, where the
  // sea is to the south). The avenues and streets that reached that edge carry on into it, and a four-lane boulevard
  // runs across it; the new buildings (STORES with `late`) stand along the boulevard, with room for many more.
  // world: this town's own bounds. A road that was made longer keeps its old ends in r.o, so the stores and car parks
  // that were already in a town are worked out exactly as before.
  const world = { ...WORLD }, water = B.water.map(rect), vert = r => r[2] - r[0] < r[3] - r[1];
  const district = lake.sea && lake.y > 0 ? (flip ? 'W' : 'E') : 'S';
  const roadsWas = roads.filter(r => r[4] !== 'dirt');
  if (district === 'S') {
    world.y1 = WORLD.y1 + DISTRICT;
    roads.forEach(r => { if (vert(r) && r[3] >= WORLD.y1 - 4 && r[4] !== 'dirt') { r.o = r.slice(); r[3] = world.y1; } });
    water.forEach(r => { if (r[3] >= WORLD.y1 - 2) r[3] = world.y1 + 16; });
    const H0 = roadsWas.filter(r => !vert(r)), by = WORLD.y1 + 20;
    roads.push([Math.min(...H0.map(r => r[0])), by, Math.max(...H0.map(r => r[2])), by + 5, 'boulevard']);
  } else {
    const E = district === 'E';
    if (E) world.x1 = WORLD.x1 + DISTRICT; else world.x0 = WORLD.x0 - DISTRICT;
    roads.forEach(r => { if (!vert(r) && r[4] !== 'dirt' && (E ? r[2] >= WORLD.x1 - 4 : r[0] <= WORLD.x0 + 4)) { r.o = r.slice(); if (E) r[2] = world.x1; else r[0] = world.x0; } });
    water.forEach(r => { if (E ? r[2] >= WORLD.x1 - 2 : r[0] <= WORLD.x0 + 2) { if (E) r[2] = world.x1 + 16; else r[0] = world.x0 - 16; } });
    const bx = E ? WORLD.x1 + 20 : WORLD.x0 - 25, xm = bx + 2.5, V0 = roadsWas.filter(vert);
    const yEnd = lake.sea ? lake.y - lake.ry * Math.sqrt(Math.max(0, 1 - ((xm - lake.x) / lake.rx) ** 2)) - 8 : WORLD.y1;
    roads.push([bx, Math.min(...V0.map(r => r[1])), bx + 5, Math.min(Math.max(...V0.map(r => r[3])), yEnd), 'boulevard']);
  }
  const blvd = roads[roads.length - 1], oldEnds = r => r.o || r;
  // v0.14: a clinic in the first free spot of the town centre (v0.27: off the roads through it)
  const busy = [[plaza.x, plaza.y, plaza.x + LOT_W, plaza.y + LOT_D], ...shops.map(([, x, y, w = 6, d = 5.5]) => [x, y, x + w, y + d]), ...roads.map(r => r.slice(0, 4))];
  fit: for (let yy = centre.y + 1; yy <= centre.y + centre.d - 6.5; yy += 0.5) for (let xx = centre.x + 1; xx <= centre.x + centre.w - 7; xx += 0.5) {
    if (busy.some(r => xx < r[2] + 1 && r[0] < xx + 7 && yy < r[3] + 1 && r[1] < yy + 6.5)) continue;
    shops.push(['clinic', xx, yy]); break fit;
  }
  // v0.37: the new buildings (CENTRE_NEW), each as near the town hall as there's room, facing +y like the shops
  { const pk = B.pocket ? box(B.pocket) : null, hx = plaza.x + LOT_W / 2, hy = plaza.y + LOT_D / 2;
    const taken = [[plaza.x - 0.5, plaza.y - 0.5, plaza.x + LOT_W + 0.5, plaza.y + LOT_D + 1.5], ...shops.map(([, x, y]) => [x - 0.5, y - 0.5, x + 6.5, y + 7]), ...roads.map(r => [r[0] - 0.4, r[1] - 0.4, r[2] + 0.4, r[3] + 0.4]), ...(pk ? [[pk.x - 0.5, pk.y - 0.5, pk.x + pk.w + 0.5, pk.y + pk.d + 0.5]] : [])];
    CENTRE_NEW.forEach(([k, w, d]) => {
      let best = null, bd = 1e9;
      for (let yy = centre.y + 0.5; yy + d + 1.2 <= centre.y + centre.d - 0.3; yy += 0.5) for (let xx = centre.x + 0.5; xx + w <= centre.x + centre.w - 0.5; xx += 0.5) {
        const r = [xx, yy, xx + w, yy + d + 1.2];
        if (taken.some(q => r[0] < q[2] && q[0] < r[2] && r[1] < q[3] && q[1] < r[3])) continue;
        const dd = Math.hypot(xx + w / 2 - hx, yy + d / 2 - hy); if (dd < bd) { bd = dd; best = r; }
      }
      if (best) { shops.push([k, best[0], best[1], w, d]); taken.push([best[0] - 0.5, best[1] - 0.5, best[2] + 0.5, best[3] + 0.3]); }
    }); }
  // v0.15: not only straight roads. An expressway on pillars runs past the edge of town (north, or south where the
  // sea is north) with ramps curving down to the avenue that reaches that edge (an interchange); country roads wind
  // out of town from the ends of the long roads; the park gets a winding jogging loop.
  const south = lake.sea && lake.y < 0, V = roads.filter(r => r[2] - r[0] < r[3] - r[1]);
  const av = south ? V.slice().sort((a, b) => b[3] - a[3])[0] : V.slice().sort((a, b) => a[1] - b[1])[0];
  const hy = south ? world.y1 + 9 : world.y0 - 9, ax = av ? (av[0] + av[2]) / 2 : (world.x0 + world.x1) / 2, ay = av ? (south ? av[3] : av[1]) : (south ? world.y1 : world.y0);
  const sg = south ? -1 : 1, HH = 38;
  const ramp = (rx, ry, dir, y0 = hy) => [[rx + dir * 22, y0, HH], [rx + dir * 13, y0 + sg * 0.6, HH * 0.78], [rx + dir * 6, y0 + sg * 2.6, HH * 0.45], [rx + dir * 2, y0 + sg * 5.6, HH * 0.18], [rx, ry - sg * 0.2, 0]];
  // v0.16: an interchange at every avenue that reaches this edge of town (so cars can take the expressway across town)
  const edgeAv = V.filter(r => r[4] !== 'boulevard' && (south ? r[3] >= world.y1 - 3 : r[1] <= world.y0 + 3));
  const ramps = (edgeAv.length ? edgeAv : av ? [av] : []).flatMap(r => { const rx = (r[0] + r[2]) / 2, ry = south ? r[3] : r[1]; return [ramp(rx, ry, -1), ramp(rx, ry, 1)]; });
  const highway = { pts: [[world.x0 - 60, hy, HH], [world.x1 + 60, hy, HH]], ramps, h: HH, y: hy };
  const H2 = roads.filter(r => r[2] - r[0] >= r[3] - r[1] && r[4] !== 'boulevard'), wEnd = H2.slice().sort((a, b) => a[0] - b[0])[0], eEnd = H2.slice().sort((a, b) => b[2] - a[2])[0];
  const wy = (wEnd[1] + wEnd[3]) / 2, ey = (eEnd[1] + eEnd[3]) / 2, wx = wEnd[0], ex = eEnd[2];
  const curves = [
    { w: 1.8, pts: [[wx + 0.5, wy], [wx - 8, wy + 1], [wx - 14, wy + 5], [wx - 22, wy + 3], [wx - 30, wy - 3], [wx - 42, wy - 2], [wx - 60, wy + 4]] },
    { w: 1.8, pts: [[ex - 0.5, ey], [ex + 7, ey - 1.5], [ex + 13, ey - 6], [ex + 21, ey - 5], [ex + 30, ey + 1], [ex + 44, ey + 2], [ex + 62, ey - 4]] },
  ];
  // v0.19: little lanes (cars can use them too) join every dead end to the next road along, like the cross streets of
  // an American neighbourhood, so the way next door is never a long loop round the block.
  const lotRects = Object.values(streets).map(s => [s.x, s.y, s.x + s.n * PARCEL, s.y + LOT_D]);
  const solid = [...lotRects, ...water, [centre.x, centre.y, centre.x + centre.w, centre.y + centre.d], [box(B.park).x, B.park.y, box(B.park).x + B.park.w, B.park.y + B.park.d],
    ...B.fields.map(f => { const q = box(f); return [q.x, q.y, q.x + q.w, q.y + q.d]; })];
  const hits = (q, list) => list.some(r => q[0] < r[2] - 0.05 && r[0] < q[2] - 0.05 && q[1] < r[3] - 0.05 && r[1] < q[3] - 0.05);
  const isH = r => r[2] - r[0] >= r[3] - r[1], lanes = [];
  const lakeIn = (x, y) => ((x - lake.x) / (lake.rx + 1)) ** 2 + ((y - lake.y) / (lake.ry + 1)) ** 2 < 1;
  const RL = roads.filter(r => r !== blvd).map(oldEnds);   // v0.38: little lanes as before the town grew
  RL.filter(r => r[4] !== 'dirt').forEach(r => {
    const h = isH(r);
    [h ? r[0] : r[1], h ? r[2] : r[3]].forEach((e, end) => {
      const joined = RL.some(q => q !== r && isH(q) !== h && (h ? q[0] <= e + 0.6 && q[2] >= e - 0.6 && q[1] <= r[3] + 0.6 && q[3] >= r[1] - 0.6
        : q[1] <= e + 0.6 && q[3] >= e - 0.6 && q[0] <= r[2] + 0.6 && q[2] >= r[0] - 0.6));
      if (joined) return;
      const a0 = end ? e - 2 : e, a1 = a0 + 2;   // the lane runs across the end of the road, 2 wide
      [-1, 1].forEach(dir => {
        let best = null;
        RL.forEach(q => {
          if (q === r || isH(q) !== h || q[4] === 'dirt' && false) return;
          if (h ? q[0] > a0 || q[2] < a1 : q[1] > a0 || q[3] < a1) return;
          const gap = h ? (dir < 0 ? r[1] - q[3] : q[1] - r[3]) : (dir < 0 ? r[0] - q[2] : q[0] - r[2]);
          if (gap > 0.5 && gap <= 40 && (!best || gap < best.gap)) best = { q, gap };
        });
        if (!best) return;
        const q = best.q, lane = h ? (dir < 0 ? [a0, q[3], a1, r[1]] : [a0, r[3], a1, q[1]]) : (dir < 0 ? [q[2], a0, r[0], a1] : [r[2], a0, q[0], a1]);
        const mid = [(lane[0] + lane[2]) / 2, (lane[1] + lane[3]) / 2];
        if (hits(lane, solid) || lakeIn(...mid) || lanes.some(l => hits(lane, [l]))) return;
        lanes.push([...lane, 'lane']);
      });
    });
  });
  roads.push(...lanes);
  // v0.17: the stores, each beside a road (facing it) as close to the town centre as there's room
  const lakeAt = (x, y) => ((x - lake.x) / (lake.rx + (lake.sea ? 6 : 2))) ** 2 + ((y - lake.y) / (lake.ry + (lake.sea ? 6 : 2))) ** 2 < 1;
  const busyRects = [...Object.values(streets).map(s => [s.x, s.y, s.x + s.n * PARCEL, s.y + LOT_D + 2]), ...roads.map(r => r.slice(0, 4)), ...water,
    [centre.x, centre.y, centre.x + centre.w, centre.y + centre.d], [box(B.park).x, B.park.y, box(B.park).x + B.park.w, B.park.y + B.park.d], ...B.fields.map(f => { const q = box(f); return [q.x, q.y, q.x + q.w, q.y + q.d]; }),
    ...ramps.map(R => [Math.min(...R.map(p => p[0])) - 1, Math.min(...R.map(p => p[1])) - 1, Math.max(...R.map(p => p[0])) + 1, Math.max(...R.map(p => p[1])) + 1])];
  const stores = [], cx0 = centre.x + centre.w / 2, cy0 = centre.y + centre.d / 2;
  busyRects.push([-200, hy - 4, 400, hy + 4]);   // the expressway
  // v0.38: where the expressway ran before the town grew (south of it): the stores that were already there keep
  // out of its way as before
  const oldOnly = [];
  if (south) { const hy0 = WORLD.y1 + 9; oldOnly.push([-200, hy0 - 4, 400, hy0 + 4]);
    const V0 = V.filter(r => r[4] !== 'boulevard').map(oldEnds), E0 = V0.filter(q => q[3] >= WORLD.y1 - 3);
    (E0.length ? E0 : V0.slice().sort((p, q) => q[3] - p[3]).slice(0, 1)).forEach(q => { const rx = (q[0] + q[2]) / 2; [-1, 1].forEach(dd => { const R = ramp(rx, q[3], dd, hy0); oldOnly.push([Math.min(...R.map(p => p[0])) - 1, Math.min(...R.map(p => p[1])) - 1, Math.max(...R.map(p => p[0])) + 1, Math.max(...R.map(p => p[1])) + 1]); }); }); }
  const free = (x, y, w, d, late) => { const Wb = late ? world : WORLD; return x >= Wb.x0 - 12 && y >= Wb.y0 - 8 && x + w <= Wb.x1 + 12 && y + d <= Wb.y1 + 8 && !busyRects.some(r => x < r[2] + 0.25 && r[0] < x + w + 0.25 && y < r[3] + 0.25 && r[1] < y + d + 0.25) && (late || !oldOnly.some(r => x < r[2] + 0.25 && r[0] < x + w + 0.25 && y < r[3] + 0.25 && r[1] < y + d + 0.25))
    && ![[x, y], [x + w, y], [x, y + d], [x + w, y + d], [x + w / 2, y + d / 2]].some(([px, py]) => lakeAt(px, py)); };
  const placeStore = ([k, s]) => {
    let best = null, bd = 1e9;
    const late = !!s.late, mx = (blvd[0] + blvd[2]) / 2, my = (blvd[1] + blvd[3]) / 2;   // v0.38: the new ones: along the boulevard, from its middle out
    // v0.19: always on the near side of a road (the door and the car park face it, so you walk straight in), with a
    // car park (STORE_FRONT deep) between the building and the road
    // front: S = the door and car park face +y (a road below it), N = -y, E = +x, W = -x. S and E show the door.
    const D2 = s.d + STORE_FRONT;
    const tryAt = (x, y, w, d, front, pen) => { if (!free(x, y, w, d, late)) return; const dd = (late ? Math.hypot(x + w / 2 - mx, y + d / 2 - my) : Math.hypot(x + w / 2 - cx0, y + d / 2 - cy0)) + pen; if (dd < bd) { bd = dd; best = [k, x, y, w, d, front]; } };
    roads.forEach(r0 => {
      if (late ? r0 !== blvd : r0 === blvd) return;
      const r = oldEnds(r0);
      if (r[2] - r[0] >= r[3] - r[1]) for (let x = r[0] + 0.5; x + s.w <= r[2] - 0.5; x += 1) { tryAt(x, r[1] - D2 - 0.3, s.w, D2, 'S', 0); tryAt(x, r[3] + 0.3, s.w, D2, 'N', late ? 0 : 8); }
      else for (let y = r[1] + 0.5; y + s.w <= r[3] - 0.5; y += 1) { tryAt(r[0] - D2 - 0.3, y, D2, s.w, 'E', late ? 0 : 2); tryAt(r[2] + 0.3, y, D2, s.w, 'W', late ? 0 : 8); }
    });
    if (best) { stores.push(best); busyRects.push([best[1], best[2], best[1] + best[3], best[2] + best[4]]); }
  };
  Object.entries(STORES).filter(([, s]) => s.w && !s.late).sort((a, b) => b[1].w * b[1].d - a[1].w * a[1].d).forEach(placeStore);
  // v0.19: a car park by every other place (the town centre's shops and hall, the park, the lake, the town fields)
  const PARK_W = 6.6, PARK_D = 3.6, parks = [];
  const nearLot = (key, px, py, inside) => {
    let best = null, bd = 1e9;
    const tryAt = (x, y, w, d, front) => { if (!free(x, y, w, d)) return; const dd = Math.hypot(x + w / 2 - px, y + d / 2 - py); if (dd < bd && dd < 30) { bd = dd; best = [key, x, y, w, d, front]; } };
    roads.forEach(r0 => {
      if (r0 === blvd) return;
      const r = oldEnds(r0);
      if (r[2] - r[0] >= r[3] - r[1]) for (let x = r[0] + 0.5; x + PARK_W <= r[2] - 0.5; x += 1) { tryAt(x, r[1] - PARK_D - 0.3, PARK_W, PARK_D, 'S'); tryAt(x, r[3] + 0.3, PARK_W, PARK_D, 'N'); }
      else for (let y = r[1] + 0.5; y + PARK_W <= r[3] - 0.5; y += 1) { tryAt(r[0] - PARK_D - 0.3, y, PARK_D, PARK_W, 'E'); tryAt(r[2] + 0.3, y, PARK_D, PARK_W, 'W'); }
    });
    if (!best && inside) {   // no room outside: a car park just inside its own edge, beside the road closest to it
      const [ix, iy, iw, id2] = inside, keep = inside[4] || [];
      for (let y = iy + 0.6; y + PARK_D <= iy + id2 - 0.6; y += 0.5) for (let x = ix + 0.6; x + PARK_W <= ix + iw - 0.6; x += 0.5) {
        if (keep.some(r => x < r[2] + 0.6 && r[0] < x + PARK_W + 0.6 && y < r[3] + 0.6 && r[1] < y + PARK_D + 0.6)) continue;
        const road = roads.filter(r => r !== blvd).map(oldEnds).map(r => Math.hypot(Math.max(r[0] - (x + PARK_W), 0, x - r[2]), Math.max(r[1] - (y + PARK_D), 0, y - r[3]))).reduce((m, v) => Math.min(m, v), 1e9);
        const dd = road * 3 + Math.hypot(x + PARK_W / 2 - px, y + PARK_D / 2 - py) * 0.2;
        if (dd < bd) { bd = dd; best = [key, x, y, PARK_W, PARK_D, 'S']; }
      }
    }
    if (best) { parks.push(best); busyRects.push([best[1], best[2], best[1] + best[3], best[2] + best[4]]); }
  };
  { const Pk = box(B.park), F0 = B.fields.length ? box(B.fields[0]) : null;
    nearLot('centre', centre.x + centre.w / 2, centre.y + centre.d, [centre.x, centre.y, centre.w, centre.d, [[plaza.x - 1, plaza.y - 1, plaza.x + LOT_W + 1, plaza.y + LOT_D + 2], ...shops.map(([, x, y, w = 6, d = 5.5]) => [x - 0.5, y - 0.5, x + w + 0.5, y + d + 2.5]), ...roads.map(r => [r[0] - 0.5, r[1] - 0.5, r[2] + 0.5, r[3] + 0.5]), ...(B.pocket ? [(q => [q.x - 0.5, q.y - 0.5, q.x + q.w + 0.5, q.y + q.d + 0.5])(box(B.pocket))] : [])]]);
    nearLot('park', Pk.x + Pk.w / 2, Pk.y + Pk.d / 2, [Pk.x, Pk.y, Pk.w, Pk.d, []]);
    if (F0) nearLot('fields', F0.x + Math.min(F0.w / 2, 10), F0.y, [F0.x, F0.y, F0.w, F0.d, []]);
    nearLot('lake', lake.x, lake.y - lake.ry); }
  // v0.38: the new district must join the town: where fewer than two roads run into the boulevard, new streets from the
  // nearest road (the shortest that crosses nothing), at least 24 apart, then the new buildings along the boulevard
  { const S0 = district === 'S', along = S0 ? [Math.max(blvd[0], WORLD.x0) + 3, Math.min(blvd[2], WORLD.x1) - 5] : [Math.max(blvd[1], WORLD.y0) + 3, Math.min(blvd[3], WORLD.y1) - 5];
    const crosses = r => r !== blvd && (S0 ? vert(r) && r[0] < blvd[2] && r[2] > blvd[0] && r[1] <= blvd[3] && r[3] >= blvd[1] : !vert(r) && r[1] < blvd[3] && r[3] > blvd[1] && r[0] <= blvd[2] && r[2] >= blvd[0]);
    const joins = roads.filter(crosses).map(r => (S0 ? (r[0] + r[2]) / 2 : (r[1] + r[3]) / 2)), opts = [];
    for (let u = along[0]; u <= along[1]; u += 1) {
      if (joins.some(j => Math.abs(j - u) < 24)) continue;
      let seg = null;
      roads.forEach(r => {   // the nearest road on the town side that this street could start from
        if (r === blvd || r[4] === 'dirt') return;
        if (S0 ? !vert(r) && r[0] <= u - 0.5 && r[2] >= u + 2.5 && r[3] <= blvd[1] : vert(r) && r[1] <= u - 0.5 && r[3] >= u + 2.5 && (district === 'E' ? r[2] <= blvd[0] : r[0] >= blvd[2])) {
          const q = S0 ? [u, r[3], u + 2, blvd[1]] : district === 'E' ? [r[2], u, blvd[0], u + 2] : [blvd[2], u, r[0], u + 2];
          if (!seg || (S0 ? q[3] - q[1] : q[2] - q[0]) < (S0 ? seg[3] - seg[1] : seg[2] - seg[0])) seg = q;
        }
      });
      if (!seg) continue;
      const len = S0 ? seg[3] - seg[1] : seg[2] - seg[0];
      if (len <= 0.5 || busyRects.some(r => seg[0] < r[2] + 0.4 && r[0] < seg[2] + 0.4 && seg[1] < r[3] - 0.01 && r[1] < seg[3] - 0.01 && !roads.some(q => q[0] === r[0] && q[1] === r[1] && q[2] === r[2] && q[3] === r[3]))) continue;
      { let wet = false; for (let k = 0; k <= 40 && !wet; k++) { const px = seg[0] + (seg[2] - seg[0]) * k / 40, py = seg[1] + (seg[3] - seg[1]) * k / 40; wet = lakeAt(px, py) || lakeAt(px + (S0 ? 2 : 0), py + (S0 ? 0 : 2)); } if (wet) continue; }
      opts.push({ u, seg, len });
    }
    // …or an avenue or street that stops short of the district carries straight on to the boulevard (better)
    roads.forEach(r => {
      if (r === blvd || r[4] === 'dirt' || r[4] === 'lane' || (S0 ? !vert(r) || r[3] >= blvd[1] || r[0] < blvd[0] || r[2] > blvd[2] : vert(r) || r[1] < blvd[1] || r[3] > blvd[3] || (district === 'E' ? r[2] >= blvd[0] : r[0] <= blvd[2]))) return;
      const seg = S0 ? [r[0], r[3], r[2], blvd[1]] : district === 'E' ? [r[2], r[1], blvd[0], r[3]] : [blvd[2], r[1], r[0], r[3]], u = S0 ? r[0] : r[1];
      if (joins.some(j => Math.abs(j - u) < 24) || busyRects.some(q => seg[0] < q[2] + 0.4 && q[0] < seg[2] + 0.4 && seg[1] < q[3] - 0.01 && q[1] < seg[3] - 0.01 && !roads.some(w => w[0] === q[0] && w[1] === q[1] && w[2] === q[2] && w[3] === q[3]))) return;
      let wet = false; for (let k = 0; k <= 40 && !wet; k++) wet = lakeAt(seg[0] + (seg[2] - seg[0]) * k / 40, seg[1] + (seg[3] - seg[1]) * k / 40);
      if (!wet) opts.push({ u, seg, len: (S0 ? seg[3] - seg[1] : seg[2] - seg[0]) - 12, road: r });
    });
    opts.sort((p, q) => p.len - q.len);
    for (const o of opts) {
      if (joins.length >= 2) break;
      if (joins.some(j => Math.abs(j - o.u) < 24)) continue;
      joins.push(o.u + 1); busyRects.push(o.seg.slice());
      if (o.road) { const r = o.road; r.o = r.o || r.slice(); if (S0) r[3] = blvd[1]; else if (district === 'E') r[2] = blvd[0]; else r[0] = blvd[2]; }
      else roads.push([...o.seg, 'street']);
    } }
  Object.entries(STORES).filter(([, s]) => s.w && s.late === true).forEach(placeStore);   // v0.38: the new ones in what's left (v0.41: late 2 = after the interstate)
  // v0.39: the interstate (FREEWAY), along the far edge of the new district: three lanes each way with a concrete
  // barrier between. On the town side a two-way frontage road (the avenues and streets that ran to the edge now end on
  // it); on the far side a short one-way frontage road. Slip ramps join both to the freeway, and an avenue from the
  // boulevard passes under it there (the freeway rises on a bridge over it). Both ends go into a tunnel through a
  // hill; by the sea (an E / W district) the south end runs out over a long bridge instead. Freeway coordinates: s
  // along it (x in an S district, y in E / W), t across it (t > 0 on the right of traffic going +s).
  const fwy = (() => {
    const F = FREEWAY, S0 = district === 'S', E = district === 'E', town = S0 || !E ? -1 : 1;   // the side the town is on
    const half = F.w / 2, tn = half + F.gap + F.front / 2, tOut = tn + F.front / 2;   // the frontage roads' middle / outer edge
    const edge = S0 ? world.y1 : E ? world.x1 : world.x0;
    const c = S0 ? Math.max(edge - 1, south ? hy + 2.5 : -1e9) + tOut : E ? edge - 1 + tOut : edge + 1 - tOut;
    const acr = t => (S0 ? c + t : c - t), at = (s, t) => (S0 ? [s, c + t] : [c - t, s]);
    const rectST = (s0, s1, t0, t1) => { const a = at(s0, t0), b = at(s1, t1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; };
    const sA = r => (S0 ? r[0] : r[1]), sB = r => (S0 ? r[2] : r[3]);
    // where it ends: a tunnel at each end, or (by the sea) the bridge out over the water
    let ends;
    if (S0) ends = [{ s: world.x0 - 7, k: 'tunnel', side: -1 }, { s: world.x1 + 7, k: 'tunnel', side: 1 }];
    else {
      let sea = null;
      if (lake.sea) for (let s = world.y0; s < world.y1 + 40 && sea === null; s += 0.5) if ([-half, 0, half].some(t => lakeAt(...at(s, t)))) sea = s;
      ends = [{ s: world.y0 - 16, k: 'tunnel', side: -1 }, sea !== null ? { s: sea - 1, k: 'bridge', side: 1, far: sea + 130 } : { s: world.y1 + 7, k: 'tunnel', side: 1 }];
    }
    const lo = ends[0].s + 3, hi = ends[1].s - 3, [rOut, rIn] = F.ramp;
    // the cross road: one of the roads that ran to the edge, or a new avenue from the boulevard (in line with a road
    // that meets the boulevard from the town side, if there's one), as close to the boulevard's middle as fits
    const reach = roads.filter(r => r !== blvd && r[4] !== 'dirt' && r[4] !== 'lane' && (S0 ? vert(r) && r[3] >= edge - 0.5 : !vert(r) && (E ? r[2] >= edge - 0.5 : r[0] <= edge + 0.5)));
    const mid = S0 ? (blvd[0] + blvd[2]) / 2 : (blvd[1] + blvd[3]) / 2, from = S0 ? blvd[3] : E ? blvd[2] : blvd[0], farIn = acr(-town * (tOut - F.front));
    const crossRect = (u0, w) => (S0 ? [u0, from, u0 + w, farIn] : E ? [from, u0, farIn, u0 + w] : [farIn, u0, from, u0 + w]);
    const others = busyRects.filter(q => !(q[0] === blvd[0] && q[1] === blvd[1] && q[2] === blvd[2] && q[3] === blvd[3]));
    const clear = q => !others.some(r => q[0] < r[2] + 0.3 && r[0] < q[2] + 0.3 && q[1] < r[3] + 0.3 && r[1] < q[3] + 0.3) && ![0.1, 0.3, 0.5, 0.7, 0.9].some(k => lakeAt(q[0] + (q[2] - q[0]) * k, q[1] + (q[3] - q[1]) * k));
    const fits = s => s - rOut - 2 >= lo && s + rOut + 2 <= hi;
    const opts = [];
    reach.forEach(r => { const s = (sA(r) + sB(r)) / 2; if (fits(s)) opts.push({ s, score: Math.abs(s - mid), r }); });
    roads.forEach(r => {   // a road meeting the boulevard from the town side: carry it on across
      if (r === blvd || r[4] === 'dirt' || (S0 ? !vert(r) || Math.abs(r[3] - blvd[1]) > 0.6 : vert(r) || (E ? Math.abs(r[2] - blvd[0]) > 0.6 : Math.abs(r[0] - blvd[2]) > 0.6))) return;
      const w = Math.max(3, sB(r) - sA(r)), s = (sA(r) + sB(r)) / 2, q = crossRect(s - w / 2, w);   // in line with it
      if (fits(s) && clear(q)) opts.push({ s, score: Math.abs(s - mid) + 4, q });
    });
    for (let u = Math.round(mid) - 70; u <= mid + 70; u += 1) { const q = crossRect(u - 1.5, 3); if (fits(u) && clear(q)) opts.push({ s: u, score: Math.abs(u - mid) + 14, q }); }
    const best = opts.sort((a, b) => a.score - b.score)[0];
    if (!best) return null;
    const sx = best.s;
    let cross;
    if (best.r) { cross = best.r; cross.o = cross.o || cross.slice(); if (S0) cross[3] = farIn; else if (E) cross[2] = farIn; else cross[0] = farIn; }
    else { cross = [...best.q, 'avenue']; roads.push(cross); }
    // the frontage roads: the near one from the first road that reaches it to the last, the far one round the ramps
    const sLo = Math.min(sx - 20, ...reach.filter(r => r !== cross).map(sA)), sHi = Math.max(sx + 20, ...reach.filter(r => r !== cross).map(sB));
    const nearIn = acr(town * (tOut - F.front)), nearOut = acr(town * tOut);
    reach.forEach(r => { if (r === cross) return; const e = S0 ? nearOut : nearOut; if (S0) r[3] = Math.min(nearOut, nearIn); else if (E) r[2] = Math.min(nearOut, nearIn); else r[0] = Math.max(nearOut, nearIn); });
    roads.push([...rectST(sLo, sHi, town * (tOut - F.front), town * tOut), 'frontage']);
    roads.push([...rectST(sx - 20, sx + 20, -town * (tOut - F.front), -town * tOut), 'frontage', -town]);
    // slip ramps (in s, t): off the freeway's right-hand lane before the cross road, on again after it
    const l2 = 0.2 + 0.3 + F.lane * 2.5, ramps = [];
    [1, -1].forEach(d => {
      ramps.push({ d, off: true, pts: [[sx - d * rOut, d * l2], [sx - d * (rOut - 5), d * (l2 + 0.65)], [sx - d * (rIn + 6), d * (tn - 2.3)], [sx - d * (rIn + 2), d * (tn - 0.4)], [sx - d * rIn, d * tn]] });
      ramps.push({ d, off: false, pts: [[sx + d * rIn, d * tn], [sx + d * (rIn + 2), d * (tn - 0.4)], [sx + d * (rIn + 6), d * (tn - 2.3)], [sx + d * (rOut - 5), d * (l2 + 0.65)], [sx + d * rOut, d * l2]] });
    });
    // the town reaches out to it
    if (S0) world.y1 = c + tOut + 3; else if (E) world.x1 = c + tOut + 3; else world.x0 = c - tOut - 3;
    const num = (id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) + (flip ? 3 : 0)) % 9;
    return { axis: S0 ? 'x' : 'y', c, town, half, tn, ends, over: { s: sx, half: (sB(cross) - sA(cross)) / 2 + 1.4, h: F.deck, rise: F.rise }, ramps,
      no: S0 ? [10, 20, 40, 64, 70, 76, 80, 90, 94][num] : [5, 15, 25, 35, 45, 55, 65, 75, 95][num], exit: 8 + (num * 7) % 40 };
  })();
  const P = box(B.park), loop = [];
  // v0.32: the loop keeps to the park's edge, and only moves in on the one side where a car park is inside the park
  const mg = { l: 1.5, r: 1.5, t: 1.5, b: 1.5 };
  parks.filter(([k, x, y, w, d]) => k === 'park' && x >= P.x - 0.01 && x + w <= P.x + P.w + 0.01 && y >= P.y - 0.01 && y + d <= P.y + P.d + 0.01).forEach(([, x, y, w, d]) => {
    const need = { t: y + d - P.y + 0.6, b: P.y + P.d - y + 0.6, l: x + w - P.x + 0.6, r: P.x + P.w - x + 0.6 }, side = Object.keys(need).sort((a, b) => need[a] - need[b])[0];
    mg[side] = Math.max(mg[side], need[side]);
  });
  for (let k = 0; k <= 48; k++) {   // a rounded loop inside the park's edge, gently wobbling
    const a = k / 48 * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a), e = 0.35;
    const rx = (P.w - mg.l - mg.r) / 2, ry = (P.d - mg.t - mg.b) / 2, px = Math.sign(c) * Math.pow(Math.abs(c), e) * rx, py = Math.sign(s2) * Math.pow(Math.abs(s2), e) * ry;
    loop.push([P.x + mg.l + rx + px + Math.sin(a * 5) * 0.25, P.y + mg.t + ry + py + Math.cos(a * 4) * 0.25]);
  }
  // v0.27 had a flyover along the main avenue. v0.34 took it out: there was no room for its ramps, which crossed the
  // avenue and lay over people's front gardens, so it looked like a broken road (D196). The expressway along the
  // edge of town (with its ramps through the woods) is still there. `flyovers` stays as an empty list.
  const flyovers = [], labels = B.labels.map(([k, x, y]) => [k, fx(x), y]);
  labels.push(['area_new', (blvd[0] + blvd[2]) / 2 + (vert(blvd) ? 0 : 0), vert(blvd) ? (blvd[1] + blvd[3]) / 2 : blvd[1] - 13]);   // v0.38
  // v0.41: the big places that came after the interstate (an amusement park…): along the boulevard in what's still free
  if (fwy) { roads.filter(r => r[4] === 'frontage' || r.o).forEach(r => busyRects.push(r.slice(0, 4))); busyRects.push(...roads.filter(r => !busyRects.some(q => q[0] === r[0] && q[1] === r[1] && q[2] === r[2] && q[3] === r[3])).map(r => r.slice(0, 4))); }
  Object.entries(STORES).filter(([, s]) => s.w && s.late === 2).forEach(placeStore);
  if (fwy) labels.push(['area_freeway', ...(fwy.axis === 'x' ? [fwy.over.s + 45, fwy.c - 3] : [fwy.c + 3, fwy.over.s + 45])]);   // v0.39
  return {
    id: id + (flip ? '|f' : ''), world, district, streets, npcLots, roads, water, highway, curves, parkLoop: loop, stores, parks, flyovers, fwy,
    centre, plaza, shops, pocket: B.pocket ? box(B.pocket) : null,
    park: box(B.park), lake, fields: B.fields.map(f => box(f)),
    places: [...B.places.map(([x, y]) => [fx(x), y]), vert(blvd) ? [(blvd[0] + blvd[2]) / 2, (blvd[1] + blvd[3]) / 2] : [(blvd[0] + blvd[2]) / 2, blvd[3] + 0.6]], labels,
  };
}
// ---------- public places in town (v0.12) ----------
// Tap one in town, go there (walk / drive / straight there), then use it. Nothing here makes coins from nothing:
// coins still only come from real life. Helping and fishing use one of the day's farm jobs.
const PLACE_INFO = {
  plaza:   { e: '🏛️', zh: '镇政府', en: 'Town hall' },
  fields:  { e: '🌾', zh: '公共麦田', en: 'Town fields' },
  park:    { e: '🌳', zh: '公园', en: 'Park' },
  lake:    { e: '🏞️', zh: '湖边', en: 'Lakeside' },
  beach:   { e: '🏖️', zh: '海滩', en: 'Beach' },
  bakery:  { e: '🥐', zh: '面包店', en: 'Bakery' },
  cafe:    { e: '☕', zh: '咖啡馆', en: 'Café' },
  market:  { e: '🛒', zh: '超市', en: 'Market' },
  gym:     { e: '🏋️', zh: '健身房', en: 'Gym' },
  library: { e: '📚', zh: '图书馆', en: 'Library' },
  post:    { e: '📮', zh: '邮局', en: 'Post office' },
  clinic:  { e: '🏥', zh: '诊所', en: 'Clinic' },
  // v0.37: new in the town centre: two towers (with a lift up to more floors), apartments and three little shops
  tower:      { e: '🏢', zh: '中心大厦', en: 'City Tower' },
  hotel:      { e: '🏨', zh: '酒店', en: 'Hotel' },
  apartments: { e: '🏙️', zh: '公寓楼', en: 'Apartments' },
  bookstore:  { e: '📖', zh: '书店', en: 'Bookshop' },
  salon:      { e: '💈', zh: '理发店', en: 'Hair salon' },
  florist:    { e: '💐', zh: '花店', en: 'Florist' },
  // the floors inside the towers
  bank:       { e: '🏦', zh: '银行', en: 'Bank' },
  office:     { e: '💼', zh: '写字楼', en: 'Offices' },
  restaurant: { e: '🍽️', zh: '空中餐厅', en: 'Sky restaurant' },
  rooftop:    { e: '🏊', zh: '屋顶泳池', en: 'Rooftop pool' },
  suite:      { e: '🛏️', zh: '酒店客房', en: 'Hotel room' },   // v0.38
};
// v0.37: the new buildings of the town centre, [key, width, depth], placed in this order as close to the town hall as
// there's room (every town has room for the first five; the apartments only where there's space left). A building
// can hold several floors (BUILDING_FLOORS: you come in on the first and take the lift); VENUE_HOME: which building a
// floor is in.
const CENTRE_NEW = [['tower', 6, 6], ['hotel', 6, 6], ['bookstore', 5.5, 5], ['salon', 5, 4.5], ['florist', 5, 4.5], ['apartments', 6, 6]];
const BUILDING_FLOORS = { tower: ['bank', 'office', 'restaurant'], hotel: ['hotel', 'suite', 'rooftop'] };   // v0.38: + a hotel room
const VENUE_HOME = { bank: 'tower', office: 'tower', restaurant: 'tower', rooftop: 'hotel', suite: 'hotel' };
const TOWER_STOREYS = { tower: 14, hotel: 10, apartments: 16 };   // how tall they look from outside
Object.entries(STORES).forEach(([k, s]) => { if (!PLACE_INFO[k]) PLACE_INFO[k] = { e: s.e, zh: s.zh, en: s.en }; });   // v0.17: stores are places too
const HARVEST_GOAL = 30;          // the town fields: helps from everyone in town today; full = harvest festival
const HELP_HARVEST = { wheat: 2 }; // helping once a day (uses 1 farm job) gives you this; the festival gives 1 bread
const BREAD = { wheat: 3 };        // the bakery bakes 1 bread from 3 of your wheat
const LAKE_FISH = 1;               // fishing at the lake / beach: once a day, uses 1 farm job
// The library's card of the day: half a minute of something good to know (from the product concept).
const LIB_CARDS = [
  { zh: '睡前一小时放下手机，更容易睡着。', en: 'Put your phone down an hour before bed and you fall asleep more easily.' },
  { zh: '每天走六七千步，对身体就已经很有帮助。', en: 'Six or seven thousand steps a day already does your body a lot of good.' },
  { zh: '坐了一个小时，就站起来走两分钟。', en: 'After an hour of sitting, get up and walk for two minutes.' },
  { zh: '早上晒十分钟太阳，晚上更容易困。', en: 'Ten minutes of morning sun helps you feel sleepy at night.' },
  { zh: '不用等口渴才喝水，桌上放一杯就好。', en: 'Don’t wait to be thirsty: keep a glass of water on your desk.' },
  { zh: '快走也算运动：每周加起来 150 分钟就很好。', en: 'Brisk walking counts: 150 minutes a week is a great goal.' },
  { zh: '每周两次力量训练，保护肌肉和骨头。', en: 'Strength training twice a week keeps muscles and bones strong.' },
  { zh: '周末也尽量在同一个时间起床。', en: 'Try to get up at the same time on weekends too.' },
  { zh: '吃慢一点：吃饱的感觉要二十分钟才到。', en: 'Eat slowly: feeling full takes about twenty minutes.' },
  { zh: '和朋友一起运动，更容易坚持下去。', en: 'Exercising with a friend makes it easier to keep going.' },
  { zh: '看屏幕二十分钟，就看远处二十秒。', en: 'Every twenty minutes on a screen, look far away for twenty seconds.' },
  { zh: '慢慢吸气四秒、呼气六秒，重复五次，心会静下来。', en: 'Breathe in for four seconds and out for six, five times, to calm down.' },
  { zh: '卧室凉一点、暗一点、安静一点，睡得更好。', en: 'A cool, dark, quiet bedroom helps you sleep better.' },
  { zh: '午睡别超过半小时，晚上才睡得着。', en: 'Keep naps under half an hour so you still sleep at night.' },
];
// ---------- the market (v0.14) ----------
// Goods and animals are sold only at the market in town, at the price on the board right now. Prices move every
// few hours, the same for everyone in a community: a smooth random drift between `min` and `max` times the usual
// price plus a little jitter, so you can sell high, or end up selling for less than you paid.
const MARKET = { slotHours: 4, min: 0.55, max: 1.6, jitter: 0.16, history: 8 };
const ANIMAL_SIZE = { chicken: 2, duck: 2, rabbit: 2, sheep: 5, goat: 5, pig: 6, cow: 10, alpaca: 8, rainbowalpaca: 8 };   // room a live animal takes
const BABY_SIZE = 3;   // a baby animal from the barn
// ---------- weather on the farm (v0.14) ----------
// The real local weather (or the simulated one) changes the farm. Rain waters the crops (they grow faster); heavy
// rain and storms can flood a planted field (chance per field per hour): under water nothing grows and a ripe crop
// loses a share every hour, until the water drains away. Snow slows growth and freezes the lake for fishing.
const WEATHER_FARM = { rainGrow: 0.25, flood: { heavy: 0.12, storm: 0.25 }, floodHours: 2, rotHours: 1, snowSlow: 0.5 };
// ---------- jobs (v0.14) ----------
// Work a real-time shift at a shop in town. Start during the shift hours, at the workplace; your townie stays at
// work until the shift ends. Leave early and you're paid only for the hours you worked, and the boss likes you a
// bit less; finish shifts and the boss likes you more; at 30 and 70 you're promoted (more pay per hour).
// (Since v0.14 coins also come from work and from selling at the market; wood still only from real life.)
const JOBS = {
  bakery:  { zh: '面包店店员', en: 'Bakery assistant', wage: 16, from: 7, to: 15 },   // v0.35: real US hourly pay
  cafe:    { zh: '咖啡师', en: 'Barista', wage: 17, from: 8, to: 16 },
  market:  { zh: '超市收银员', en: 'Cashier', wage: 16, from: 9, to: 18 },
  library: { zh: '图书管理员', en: 'Librarian', wage: 24, from: 9, to: 17 },
  post:    { zh: '邮递员', en: 'Postal worker', wage: 23, from: 8, to: 16 },
  gym:     { zh: '健身教练', en: 'Fitness coach', wage: 26, from: 10, to: 19 },
  clinic:  { zh: '诊所护士', en: 'Clinic nurse', wage: 40, from: 9, to: 18 },
  office:  { zh: '公司职员', en: 'Office worker', wage: 34, from: 9, to: 17 },   // v0.37: in the City Tower
  // v0.38: the new buildings
  hospital: { zh: '医院护工', en: 'Care assistant', wage: 19, from: 7, to: 15 },
  bowling:  { zh: '保龄球馆店员', en: 'Bowling alley crew', wage: 15, from: 14, to: 22 },
  amuse:    { zh: '游乐园操作员', en: 'Ride operator', wage: 16, from: 10, to: 18 },   // v0.41
  zoo:      { zh: '饲养员', en: 'Zookeeper', wage: 17, from: 8, to: 16 },   // v0.42
  stadium:  { zh: '体育场工作人员', en: 'Stadium crew', wage: 16, from: 14, to: 22 },   // v0.42
  aquatic:  { zh: '救生员', en: 'Lifeguard', wage: 18, from: 10, to: 18 },
  museum:   { zh: '博物馆讲解员', en: 'Museum guide', wage: 21, from: 9, to: 17 },
  station:  { zh: '列车员', en: 'Train conductor', wage: 30, from: 6, to: 14 },
};
const JOB_RANKS = [{ zh: '新人', en: 'Newcomer', at: 0, pay: 1 }, { zh: '熟手', en: 'Skilled', at: 30, pay: 1.2 }, { zh: '主管', en: 'Supervisor', at: 70, pay: 1.45 }];
const JOB_REL = { finish: 4, quit: -6, max: 100 };
// ---------- getting sick (v0.14) ----------
// Each new day there's a small chance your townie falls ill: more after many work days in a row or a poor night's
// sleep. Sick: walks slower and real-life rewards are a bit smaller. Medicine from the clinic plus a rest in bed
// cures it; otherwise it passes after a couple of days.
const SICK = { base: 0.03, overwork: 0.08, overworkDays: 5, lowSleep: 0.06, lowSleepScore: 60, longShift: 0.1, walk: 0.6, earn: 0.75, days: 2, medicine: 60, restSec: 20 };
// ---------- the park (v0.32) ----------
// Things to do in the park (each once a day; the ice-cream cart is the food court's ice cream): watch a game on a
// court or the pitch and cheer, feed the ducks, sit on a bench, bounce on the trampoline. sec: how long it takes.
const PARK = { watch: { fun: 6, sec: 8 }, ducks: { fun: 8, sec: 8 }, bench: { fun: 4, sec: 10 }, play: { fun: 6, sec: 8 }, icecream: { sec: 5 } };
// v0.33: ball games you really play on the park's courts, with a friend (or one of the people already playing there).
// Tennis: one game, scored 15 / 30 / 40: the first to `to` points wins (at 40–40 the next point wins). Basketball: `spots` places round the hoop, `shots` each from every place, two points a
// basket (three from the last place). Football: `kicks` penalties each; level after that is a draw (v0.34: no sudden death).
const BALL_GAMES = {
  tennis:     { e: '🎾', to: 4 },
  basketball: { e: '🏀', spots: 5, shots: 2 },
  soccer:     { e: '⚽', kicks: 5 },
};
// What a game gives, win or lose (it's about playing together): the first game of each sport each day gives fun, and
// with someone you know also social and friendship; after that each game still gives a little fun.
// skill (0–1): how good the other player is: a base, more if they're sporty or love sport; the people on the court are
// about average. Someone won't play if things are awkward between you, or if they're in a grumpy mood today.
const BALL = { fun: 20, social: 10, rel: 4, againFun: 4, skill: { base: 0.4, sporty: 0.25, sport: 0.15, court: 0.5 } };
// ---------- getting along with people, like The Sims (v0.31) ----------
// Friendship with each person runs from -30 to 100; where it starts depends on who they are. It never wears off
// by itself (no pressure), and a failed joke only costs a little.
const REL_LEVELS = [
  { min: -30, e: '😬', zh: '有点尴尬', en: 'Awkward' }, { min: 0, e: '🙂', zh: '陌生人', en: 'Stranger' }, { min: 10, e: '👋', zh: '认识', en: 'Acquaintance' },
  { min: 30, e: '😊', zh: '朋友', en: 'Friend' }, { min: 60, e: '💛', zh: '好朋友', en: 'Good friend' }, { min: 85, e: '💖', zh: '最好的朋友', en: 'Best friend' },
];
const REL_START = { friend: 40, family: 55, work: 10, other: 0 };
// Everyone has two traits: they decide which things go down well (likes) or badly (dislikes).
const TRAITS = {
  cheerful: { e: '😄', zh: '开朗', en: 'Cheerful', likes: ['greet', 'chat', 'highfive'], dislikes: [] },
  goofball: { e: '🤪', zh: '爱逗乐', en: 'Goofball', likes: ['joke', 'face', 'tickle', 'tease'], dislikes: ['deep'] },
  shy:      { e: '🙈', zh: '害羞', en: 'Shy', likes: ['ask', 'interest'], dislikes: ['hug', 'tickle', 'face'] },
  bookworm: { e: '📚', zh: '书呆子', en: 'Bookworm', likes: ['interest', 'deep'], dislikes: ['face', 'tease'] },
  sporty:   { e: '⚽', zh: '运动迷', en: 'Sporty', likes: ['highfive', 'plans'], dislikes: [] },
  foodie:   { e: '🍰', zh: '吃货', en: 'Foodie', likes: ['gift'], dislikes: [] },
  serious:  { e: '🧐', zh: '认真', en: 'Serious', likes: ['ask', 'interest', 'compliment'], dislikes: ['joke', 'face', 'tease'] },
  warm:     { e: '🤗', zh: '热心', en: 'Warm', likes: ['hug', 'compliment', 'deep'], dislikes: [] },
};
// What people like to talk about (two each; you have three).
const INTERESTS = {
  sport: { e: '⚽', zh: '运动', en: 'sport' }, music: { e: '🎵', zh: '音乐', en: 'music' }, food: { e: '🍕', zh: '美食', en: 'food' }, books: { e: '📚', zh: '看书', en: 'books' },
  games: { e: '🎮', zh: '游戏', en: 'games' }, pets: { e: '🐶', zh: '宠物', en: 'pets' }, garden: { e: '🌱', zh: '种花种菜', en: 'gardening' }, art: { e: '🎨', zh: '画画', en: 'art' },
  travel: { e: '✈️', zh: '旅行', en: 'travel' }, movies: { e: '🎬', zh: '电影', en: 'movies' },
};
// The things you can do with someone, in groups (like The Sims' menu). min: the friendship it needs; base: how likely
// it goes well; up / down: friendship if it goes well / badly; social / fun: your needs when it goes well.
const SOCIAL_CATS = [['friendly', '😊'], ['funny', '😂'], ['deep', '💭'], ['gift', '🎁'], ['mischief', '😜']];
const SOCIALS = {
  greet:      { cat: 'friendly', e: '👋', zh: '打招呼', en: 'Say hi', min: -30, base: 0.95, up: 2, down: 0, social: 3, wave: true },
  chat:       { cat: 'friendly', e: '💬', zh: '闲聊', en: 'Chat', min: -30, base: 0.85, up: 4, down: -1, social: 8 },
  ask:        { cat: 'friendly', e: '❓', zh: '问问近况', en: 'Ask how they are', min: 0, base: 0.85, up: 5, down: -1, social: 8 },
  compliment: { cat: 'friendly', e: '💐', zh: '夸一夸', en: 'Compliment', min: 10, base: 0.75, up: 7, down: -3, social: 8 },
  highfive:   { cat: 'friendly', e: '✋', zh: '击掌', en: 'High five', min: 10, base: 0.8, up: 5, down: -2, social: 6, wave: true },
  hug:        { cat: 'friendly', e: '🤗', zh: '拥抱', en: 'Hug', min: 30, base: 0.75, up: 9, down: -5, social: 12 },
  joke:       { cat: 'funny', e: '😂', zh: '讲笑话', en: 'Tell a joke', min: 0, base: 0.65, up: 7, down: -4, social: 8, fun: 6 },
  face:       { cat: 'funny', e: '🤪', zh: '做鬼脸', en: 'Pull a face', min: 10, base: 0.6, up: 6, down: -3, social: 6, fun: 8 },
  tickle:     { cat: 'funny', e: '🤭', zh: '挠痒痒', en: 'Tickle', min: 60, base: 0.7, up: 8, down: -5, social: 8, fun: 10 },
  interest:   { cat: 'deep', e: '🗨️', zh: '聊聊兴趣', en: 'Talk about a hobby', min: 0, base: 0.6, up: 6, down: -2, social: 10 },
  deep:       { cat: 'deep', e: '🤫', zh: '说说心里话', en: 'Share something personal', min: 60, base: 0.75, up: 10, down: -4, social: 14 },
  plans:      { cat: 'deep', e: '📅', zh: '约去公园', en: 'Meet up in the park', min: 30, base: 0.8, up: 6, down: -2, social: 6 },
  gift:       { cat: 'gift', e: '🎁', zh: '送礼物', en: 'Give a gift', min: -30, base: 1, up: 6, down: 0, social: 6 },
  tease:      { cat: 'mischief', e: '😜', zh: '开个玩笑', en: 'Playful tease', min: 30, base: 0.5, up: 5, down: -6, social: 4, fun: 6 },
};
// How likely it goes well: base + their mood today + friendship × relBy, a liked thing +likeBy, a disliked one
// dislikeBy, a hobby you share +shareBy (one they don't care about −noShare), the same thing again today −boredBy
// each time after `boring`. sec: how long the two of you take over it.
const SOCIAL = { moodBy: { great: 0.1, good: 0, meh: -0.1, grumpy: -0.25 }, relBy: 0.002, likeBy: 0.2, dislikeBy: -0.3, shareBy: 0.3, noShare: 0.15, boring: 2, boredBy: 0.15, likedUp: 3, foodieUp: 6, bouquetUp: 6, workRel: { boss: 2, mate: 1 }, sec: 3 };
// ---------- inside every building (v0.30) ----------
// Every building in town can be walked into, and what's inside does something. sec: how long your townie stays at it.
// The fun / social counts once a day each (the gym: up to `max` workouts a day, on any machine).
const VENUE = {
  gym: { fun: 8, max: 3, sec: 12 },     // a workout on a treadmill, a bike, the weights, the bag or a mat
  cafeChat: { social: 12, sec: 9 },     // sit down at a café table with someone you know
  cafeSofa: { fun: 6, sec: 9 },         // put your feet up on the café sofa
  libRead: { fun: 10, sec: 12 },        // sit down at the library table with a book
  eat: { sec: 8 },                      // eat a pastry at a bakery table (a snack's own fill)
  truck: { fun: 10, sec: 6 },           // a look round the fire engine (and a fire-safety tip)
  checkup: { sec: 5 },                  // the clinic's health check: last night's sleep and today's steps
  // v0.37 (paid ones can be done as often as you like; the others once a day, the pool twice)
  dinner: { price: 38, hunger: 55, fun: 8, sec: 10 },           // the sky restaurant: dinner at a window table
  date: { price: 76, hunger: 55, social: 18, fun: 8, rel: 3, sec: 12 },   // …or with someone you know (you pay for both)
  drink: { price: 12, fun: 6, social: 4, sec: 8 },              // a drink at the restaurant bar or the hotel bar
  tea: { price: 28, hunger: 30, fun: 6, sec: 10 },              // afternoon tea in the hotel lounge
  swim: { fun: 12, max: 2, sec: 15 },                           // the hotel's rooftop pool
  sunbathe: { fun: 6, sec: 10 },                                // a lounger by the pool
  book: { price: 18, fun: 14, sec: 12 },                        // buy a book and read it in the bookshop's armchair
  view: { fun: 6, sec: 8 },                                     // the view from the office windows
  lounge: { social: 10, sec: 9 },                               // a chat with a neighbour in the apartments' lounge
  haircut: { price: 45, sec: 10 },                              // a new hairstyle or colour
  bouquet: { price: 35 },                                       // a bouquet to give someone (a gift they love)
  groceries: { price: 40, items: { tomato: 2, potato: 2, egg: 2, milk: 1 } },   // a bag of groceries from the supermarket, to cook with
  // v0.38 (the games themselves are VENUE_GAMES)
  arcade: { price: 2, fun: 5, sec: 6 },                         // a go on an arcade machine at the bowling alley
  // v0.41: the amusement park's rides (pay each time; you ride along) and its cotton candy
  wheel: { price: 6, fun: 10, sec: 14 }, coaster: { price: 8, fun: 14, sec: 10 }, carousel: { price: 4, fun: 8, sec: 10 }, bumper: { price: 5, fun: 10, sec: 10 },
  candy: { price: 4, hunger: 10, fun: 4, sec: 3 },
  // v0.42: the zoo: each animal once a day (a look, and something you didn't know); feeding the giraffes (a lettuce leaf,
  // as often as you like); the petting farm (once a day); a plush animal from the zoo shop
  zv_lion: { fun: 5, sec: 8 }, zv_elephant: { fun: 5, sec: 8 }, zv_giraffe: { fun: 5, sec: 8 }, zv_penguin: { fun: 5, sec: 8 }, zv_monkey: { fun: 5, sec: 8 }, zv_panda: { fun: 5, sec: 8 },
  giraffefeed: { price: 3, fun: 8, sec: 8 }, petting: { fun: 8, sec: 10 }, zooplush: { price: 15 },
  // v0.42: the stadium: a ticket for the game that's on (sit in the stands and watch), a look round when there's no game
  // (once a day), a hot dog
  match: { price: 10, fun: 15, sec: 24 }, tour: { fun: 5, sec: 10 }, hotdog: { price: 5, hunger: 15, fun: 3, sec: 4 },
  dive: { fun: 8, sec: 6 },                                     // the diving board at the swimming centre
  sauna: { fun: 6, sec: 12 },                                   // a sit in the sauna
  visit: { social: 10, sec: 10 },                               // keep a patient in hospital company for a while
  babies: { fun: 6, sec: 8 },                                   // the newborns behind the hospital nursery window
  donate: { fun: 8, hunger: 10, sec: 12, every: 7 },            // give blood (once a week at most), then a biscuit and a juice
  ex_dino: { fun: 5, sec: 8 }, ex_space: { fun: 5, sec: 8 }, ex_art: { fun: 5, sec: 8 }, ex_history: { fun: 5, sec: 8 },   // each museum hall once a day
  souvenir: { price: 15 },                                      // a dinosaur plush from the museum shop (for your home)
  train: { price: 12, fun: 8 },                                 // a train ride to look round the next town (the fun once a day)
  trains: { fun: 6, sec: 10 },                                  // sit on the platform and watch the trains come and go
  room: { price: 159, checkout: 12 },                           // a night in the hotel: the room is yours until noon the next day
  bed: { fun: 12, sec: 12 },                                    // stretch out on the big hotel bed
  bath: { fun: 8, sec: 10 },                                    // a bubble bath in the hotel room
};
// v0.38: games you play indoors, with a friend or someone who's there (the rewards are the park's, BALL): bowling,
// `frames` frames each (a strike is all 10 pins with the first ball: +10; a spare, all 10 with two: +5); a swimming
// race, one length of `len` metres (tap left, right, left… to swim). price: what a game costs (the lane and the shoes).
const VENUE_GAMES = {
  bowling: { e: '🎳', frames: 5, strike: 10, spare: 5, price: 8, place: 'bowling', spot: 'lane' },
  // v0.41: mini golf (3 holes, fewest strokes, at most 6 a hole), karaoke (a song in two halves), the claw machine
  // (3 grabs each; the toys you win are yours: the bowling alley's and the mall's), a fishing contest (at the lake)
  golf: { e: '⛳', holes: 3, max: 6, price: 10, place: 'amuse', spot: 'golf' },
  karaoke: { e: '🎤', price: 0, place: 'amuse', spot: 'stage' },
  claw: { e: '🧸', grabs: 3, price: 5, place: 'bowling', places: ['bowling', 'mall'], spot: 'claw' },
  fishing: { e: '🎣', secs: 60, price: 0, place: 'lake' },
  // v0.42: a home run derby in the stadium's batting cage: `pitches` pitches each, most home runs wins (the longest one
  // if it's level); price: a bucket of balls
  derby: { e: '⚾', pitches: 8, price: 6, place: 'stadium', spot: 'cage' },
  race:    { e: '🏊', len: 25, price: 0, place: 'aquatic', spot: 'race' },
};
// v0.38: what's on the cards in the museum's four halls (one a day each)
const MUSEUM_FACTS = {
  dino: [
    { zh: '霸王龙生活在大约 6600 万年前，一颗牙齿就有一根香蕉那么长。', en: 'T. rex lived about 66 million years ago, and one tooth was as long as a banana.' },
    { zh: '鸟是恐龙的后代：院子里的鸡，就是恐龙的远房亲戚。', en: 'Birds come from dinosaurs: the hens in your yard are distant dinosaur cousins.' },
    { zh: '最长的恐龙有三十多米，比两辆公交车接起来还长。', en: 'The longest dinosaurs were over 30 metres long, longer than two buses end to end.' },
  ],
  space: [
    { zh: '太阳光照到地球，大约要走 8 分钟。', en: 'Sunlight takes about 8 minutes to reach the Earth.' },
    { zh: '空间站大约 90 分钟绕地球一圈，宇航员一天能看到 16 次日出。', en: 'The space station goes round the Earth every 90 minutes or so: 16 sunrises a day.' },
    { zh: '在月球上看地球，比我们看满月大将近四倍。', en: 'From the Moon, the Earth looks nearly four times as wide as the full Moon looks from here.' },
  ],
  art: [
    { zh: '退后几步看点彩画，一个个小色点会在眼睛里混成一片颜色。', en: 'Step back from a pointillist painting and the little dots of colour blend together in your eyes.' },
    { zh: '梵高一生画了大约 900 幅油画，活着的时候只卖出去很少几幅。', en: 'Van Gogh painted about 900 pictures in oils but sold very few in his lifetime.' },
    { zh: '很多大画家动笔之前，都会先画好多张小草稿。', en: 'Many great painters made lots of small sketches before starting the real thing.' },
  ],
  history: [
    { zh: '埃及最大的金字塔已经有四千五百多年了。', en: 'The Great Pyramid in Egypt is more than 4,500 years old.' },
    { zh: '人类做过的最早的陶罐，大约有两万年了。', en: 'The oldest pottery people have found is about 20,000 years old.' },
    { zh: '古罗马人就已经有地暖和公共浴场了。', en: 'The ancient Romans already had heated floors and public baths.' },
  ],
};
// v0.42: the zoo's animals (one enclosure each; the giraffes share theirs with zebras) and what's on the sign by each
// (one a day); what the zoo shop sells
const ZOO_ANIMALS = {
  lion: { e: '🦁', zh: '狮子', en: 'Lions' }, elephant: { e: '🐘', zh: '大象', en: 'Elephants' }, giraffe: { e: '🦒', zh: '长颈鹿和斑马', en: 'Giraffes and zebras' },
  penguin: { e: '🐧', zh: '企鹅', en: 'Penguins' }, monkey: { e: '🐒', zh: '猴子', en: 'Monkeys' }, panda: { e: '🐼', zh: '大熊猫', en: 'Giant pandas' },
};
const ZOO_FACTS = {
  lion: [
    { zh: '狮子是唯一成群生活的大猫，一群狮子叫「狮群」。', en: 'Lions are the only big cats that live in groups, called prides.' },
    { zh: '狮子的吼声在 8 公里外都能听到。', en: 'A lion’s roar can be heard up to 8 km (5 miles) away.' },
    { zh: '狮子一天要睡 16 到 20 个小时。', en: 'Lions sleep 16 to 20 hours a day.' },
  ],
  elephant: [
    { zh: '大象的鼻子里大约有 4 万块肌肉。', en: 'An elephant’s trunk has around 40,000 muscles.' },
    { zh: '大象扇动大耳朵，是在给自己扇风降温。', en: 'Elephants flap their big ears to cool down.' },
    { zh: '小象一出生就有 100 公斤左右重。', en: 'A baby elephant weighs about 100 kg (220 lb) when it’s born.' },
  ],
  giraffe: [
    { zh: '长颈鹿的脖子和我们一样，只有 7 块颈椎骨。', en: 'A giraffe’s neck has just seven bones, the same as ours.' },
    { zh: '长颈鹿的舌头大约有 50 厘米长，是深蓝紫色的。', en: 'A giraffe’s tongue is about 50 cm (20 in) long and dark blue-purple.' },
    { zh: '每匹斑马的条纹都不一样，就像人的指纹。', en: 'Every zebra’s stripes are different, like fingerprints.' },
  ],
  penguin: [
    { zh: '企鹅不会飞，但在水里游得飞快。', en: 'Penguins can’t fly, but they’re very fast swimmers.' },
    { zh: '帝企鹅爸爸会把蛋放在脚背上，一孵就是两个多月。', en: 'Emperor penguin dads keep the egg on their feet for over two months.' },
    { zh: '企鹅黑背白肚：从上面看像海水，从下面看像天空。', en: 'Black backs, white fronts: from above they look like the sea, from below like the sky.' },
  ],
  monkey: [
    { zh: '有些猴子的尾巴能像手一样抓住树枝。', en: 'Some monkeys can hold on to branches with their tails, like an extra hand.' },
    { zh: '猴子互相梳毛，是在交朋友。', en: 'Monkeys groom each other to make and keep friends.' },
    { zh: '吼猴的叫声在 5 公里外都能听到。', en: 'Howler monkeys can be heard about 5 km (3 miles) away.' },
  ],
  panda: [
    { zh: '大熊猫一天大约要花 12 个小时吃竹子。', en: 'Giant pandas spend about 12 hours a day eating bamboo.' },
    { zh: '熊猫宝宝刚出生时，差不多只有一根香蕉那么重。', en: 'A newborn panda weighs about as much as a banana.' },
    { zh: '大熊猫的前掌上有一根「假拇指」，专门用来抓竹子。', en: 'Pandas have a “false thumb” on each front paw for holding bamboo.' },
  ],
};
const ZOO_SHOP = ['plushlion', 'plushelephant', 'plushgiraffe', 'plushpenguin'];
// v0.42: the stadium: two games a day in town time (starting at `slots`, `len` hours each). The home team plays the
// town's own sport (baseball in the towns listed, soccer everywhere else) against a team from another town; the score
// is the same for everyone (from the town and the day). parts: innings, or 10-minute spells of a soccer game.
const STADIUM = {
  slots: [13, 19], len: 3,
  sports: { baseball: { e: '⚾', zh: '棒球', en: 'Baseball', parts: 9 }, soccer: { e: '⚽', zh: '足球', en: 'Soccer', parts: 9 } },
  baseball: ['wutong', 'palmbay', 'cactus', 'vermont', 'banff', 'kyoto', 'seoul'],
};
// every town's team: the town's name and one of these (in the order of COMMUNITIES)
const TEAM_MASCOTS = [
  { e: '🐯', zh: '老虎', en: 'Tigers', col: '#f28c28' }, { e: '🐬', zh: '海豚', en: 'Dolphins', col: '#38a3e0' }, { e: '🦂', zh: '蝎子', en: 'Scorpions', col: '#c9893a' },
  { e: '🦌', zh: '红鹿', en: 'Stags', col: '#b5302a' }, { e: '🐻', zh: '灰熊', en: 'Grizzlies', col: '#8a5a36' }, { e: '🐝', zh: '蜜蜂', en: 'Bees', col: '#f2c230' },
  { e: '🦁', zh: '狮子', en: 'Lions', col: '#e5484d' }, { e: '🐺', zh: '灰狼', en: 'Wolves', col: '#6b7280' }, { e: '🦊', zh: '狐狸', en: 'Foxes', col: '#e86a2a' },
  { e: '🐉', zh: '青龙', en: 'Dragons', col: '#34b27b' }, { e: '🦈', zh: '鲨鱼', en: 'Sharks', col: '#2f6fb2' }, { e: '🦅', zh: '雄鹰', en: 'Eagles', col: '#3d4a66' },
  { e: '🦉', zh: '猫头鹰', en: 'Owls', col: '#7a5a9a' }, { e: '🐯', zh: '猛虎', en: 'Tigers', col: '#f28c28' }, { e: '🐆', zh: '美洲豹', en: 'Jaguars', col: '#2f9a5a' },
  { e: '🦓', zh: '斑马', en: 'Zebras', col: '#2d2d34' },
];
const VENUE_PLACES = ['bakery', 'cafe', 'clinic', 'library', 'gym', 'post', 'school', 'plaza', 'police', 'firestation', 'gas', 'tower', 'hotel', 'apartments', 'bookstore', 'salon', 'florist',
  'hospital', 'bowling', 'aquatic', 'museum', 'station', 'amuse', 'zoo', 'stadium'];   // v0.37 / v0.38 / v0.41 / v0.42: + the new ones
// The fire station's tips, one a day.
const FIRE_TIPS = [
  { zh: '家里装一个烟雾报警器，每个月按一下试试。', en: 'Fit a smoke alarm at home and press its test button once a month.' },
  { zh: '出门、睡觉前，看一眼炉灶关了没有。', en: 'Check the stove is off before you go out or go to bed.' },
  { zh: '充电器和插线板别放在被子、沙发上。', en: 'Keep chargers and power strips off beds and sofas.' },
  { zh: '和家人约好着火时在门外哪里集合。', en: 'Agree with your family where to meet outside if there’s a fire.' },
  { zh: '衣服着火了：停下、趴下、打滚。', en: 'If your clothes catch fire: stop, drop and roll.' },
  { zh: '浓烟往上走：逃生时弯下腰，用湿毛巾捂住口鼻。', en: 'Smoke rises: stay low and cover your nose and mouth with a damp cloth.' },
];
// How many other people are drawn at once (v0.11). Thousands can be in a community and hundreds at a popular
// home; we draw only a few and say "+N more".
const SHOW_LIMITS = { town: 10, home: 4, room: 3 };
const ONLINE_SHARE = { friend: 0.55, other: 0.4 };   // made-up online share until the server exists
const VISIT_SHARE = 0.25;                             // of the people online, this many are round at a neighbour's
const ASK_YES = 0.8;                                  // asking to sit down at someone's home: they usually say yes
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
  champcar: { zh: '冠军金色超跑', en: 'Champion gold supercar', cost: { coins: 5000 }, cargo: 12, excl: 'steps10k:2', color: '#f2c230' },
  goldbike: { zh: '金色公路车',   en: 'Golden road bike',       cost: { coins: 1200 }, cargo: 10, kind: 'two', excl: 'g:cycle', color: '#f2c230' },
});
PET_BREEDS.collie = { kind: 'dog', zh: '冠军边牧', en: 'Champion collie', price: 1500, col: '#2d2a28', belly: '#ffffff', ears: 'flop', tail: 'plume', mask: true, eyes: '#8a5a2a', excl: 'steps20k:0' };
ANIMALS.rainbowalpaca = { ...ANIMALS.alpaca, e: '🦄', zh: '彩虹羊驼', en: 'Rainbow alpaca', baby: { zh: '彩虹小羊驼', en: 'Rainbow cria' }, price: 2600, sell: [400, 700, 1200], excl: 'steps20k:2' };
// A trophy case appears in your home with your first trophy (not sold).
FURN.trophycase = { zh: '奖杯柜', en: 'Trophy case', w: 1, d: 1, price: 0, award: true };
// ---------- more exclusives (v0.12) ----------
// Every sport's gold trophy unlocks that sport's own golden statue (one for each of the 80 Apple Watch sports).
SPORTS.forEach(s => { YARD['st_' + s.id] = { zh: s.zh + '金像', en: 'Golden ' + s.en + ' statue', w: 1, d: 1, price: 900, excl: s.id + ':2', sport: s.id }; });
// Apple Watch-style awards: one-time medals for special days and milestones (earned in real life only).
// Each unlocks its own big medal sculpture for the yard.
const AWARDS = {
  move200:     { e: '🔥', col: '#ef4f6b', zh: '活动目标翻倍', en: 'Double Move', desc: { zh: '一天的活动卡路里达到目标的 2 倍', en: 'Burn twice your Move goal in one day' } },
  move300:     { e: '🔥', col: '#f2683a', zh: '活动目标三倍', en: 'Triple Move', desc: { zh: '一天的活动卡路里达到目标的 3 倍', en: 'Burn three times your Move goal in one day' } },
  move400:     { e: '🌋', col: '#c0392b', zh: '活动目标四倍', en: 'Quadruple Move', desc: { zh: '一天的活动卡路里达到目标的 4 倍', en: 'Burn four times your Move goal in one day' } },
  perfectweek: { e: '📅', col: '#3dbb62', zh: '完美一周', en: 'Perfect Week', desc: { zh: '从周一到周日，每天都合上三个圆环', en: 'Close all three rings every day from Monday to Sunday' } },
  newrecord:   { e: '🏆', col: '#e0aa2a', zh: '步数新纪录', en: 'New Step Record', desc: { zh: '一天的步数打破自己的纪录（至少 1 万步）', en: 'Beat your best day of steps (10,000 or more)' } },
  steps1m:     { e: '👣', col: '#38a3e0', zh: '百万步', en: 'Million Steps', desc: { zh: '一共走满 100 万步', en: 'Walk 1,000,000 steps in total' } },
  workouts100: { e: '💯', col: '#a46ef0', zh: '百次锻炼', en: '100 Workouts', desc: { zh: '一共完成 100 次锻炼', en: 'Finish 100 workouts in total' } },
  monthly:     { e: '🗓️', col: '#ec6aa8', zh: '月度挑战', en: 'Monthly Challenge', desc: { zh: '一个月里有 20 天走满 1 万步', en: '20 days with 10,000 steps in one month' } },
  weekend:     { e: '🎉', col: '#f59e0b', zh: '周末战士', en: 'Weekend Warrior', desc: { zh: '同一个周末的周六和周日都锻炼', en: 'Work out on both Saturday and Sunday of one weekend' } },
};
const AWARD_RULES = { move: { move200: 2, move300: 3, move400: 4 }, recordMin: 10000, steps: 1000000, workouts: 100, monthDays: 20, monthSteps: 10000 };
Object.entries(AWARDS).forEach(([id, A]) => { YARD['aw_' + id] = { zh: A.zh + '奖章雕塑', en: A.en + ' medal sculpture', w: 1, d: 1, price: 1000, excl: 'aw:' + id, award: id }; });
const EXCLUSIVES = [
  ...Object.keys(YARD).filter(k => YARD[k].excl).map(k => ['yard', k]),
  ...Object.keys(CARS).filter(k => CARS[k].excl).map(k => ['car', k]),
  ['pet', 'collie'], ['animal', 'rainbowalpaca'],
];

// ---------- v0.35: prices in US dollars (Mason #26, D202; the sums are in docs/数值平衡.md) ----------
// One coin is one US dollar, and things cost what they cost in the north-east of the US (the suburbs of New York,
// New Jersey, Boston): a coffee about $6, a cinema ticket $15, a small car $23,000, a two-storey house $450,000.
// Jobs pay real hourly wages; real life (steps, rings, sleep, less phone, workouts) pays on top of that, so a regular
// player makes about $550 a day, some $17,000 a month: about three times the average US pay. Houses are bought with a
// mortgage (5% down, 30 years) and cars with a car loan (10% down, 5 years), like in real life (see BANK).
// The coin prices written in the tables above are the old (v0.22) ones; the real ones are set here. Wood (only from
// real life) keeps the v0.23 amounts.
const nicePrice = n => (!n ? n : n < 100 ? Math.max(5, Math.round(n / 5) * 5) : (() => { const q = Math.pow(10, Math.floor(Math.log10(n)) - 1); return Math.round(n / q) * q; })());
const USD = {
  // homes, in the order of HOUSES: tent, cabin, small bungalow, two-storey, modern villa, garden villa, Chinese
  // courtyard, mansion, castle, cottage, A-frame, farmhouse, ranch, Cape Cod, colonial, craftsman, Spanish villa,
  // Tudor, beach house, brownstone, glass house, Victorian, mountain lodge
  house: [0, 85000, 240000, 450000, 850000, 950000, 1800000, 5000000, 15000000, 280000, 320000, 520000, 480000, 500000, 650000, 700000, 1100000, 1200000, 1500000, 2500000, 2800000, 2200000, 3500000],
  car: { bike: 600, scooter: 1500, vespa: 5500, motorcycle: 9000, sportbike: 16000, mini: 23000, sedan: 29000, convertible: 48000, pickup: 45000, suv: 38000, jeep: 42000,
    sports: 95000, tractor: 35000, camper: 160000, luxury: 75000, muscle: 55000, supercar: 280000, minivan: 40000, boxtruck: 65000, champcar: 150000, goldbike: 3000 },
  garage: [0, 5000, 18000, 35000, 60000, 120000],
  drive: { long: 4000, curve: 9000, double: 7000, triple: 12000 },
  furn: { sleepbag: 60, bed: 900, nightstand: 150, wardrobe: 600, sofa: 1200, armchair: 450, beanbag: 150, rocker: 350, coffeetable: 250, table: 600, chair: 90,
    desk: 1500, lamp: 120, tv: 800, shelf: 200, plant: 40, monstera: 80, rug: 250, fridge: 1800, stove: 1200, kitchen: 3500, washer: 900, bathtub: 1500,
    treadmill: 1800, spinbike: 1400, dumbbells: 600, boxing: 250, yogamat: 40, guitar: 400, drums: 1000, record: 300, easel: 120, cattree: 150, grandclock: 1200,
    aquarium: 700, fireplace: 3000, piano: 6000, singlebed: 400, bunkbed: 600, tablelamp: 200, arclamp: 250, roundrug: 180, bigrug: 450, roundtable: 350,
    sidetable: 120, petbowl: 30, litterbox: 60, petbed: 80 },
  furnValue: { plush: 25, bigteddy: 150, poster: 20 },   // won or given, not sold: what they add to your home's worth
  yard: { flowers: 150, hedge: 60, tree: 400, pine: 300, lamp: 250, bench: 300, gnome: 40, birdbath: 120, scarecrow: 80, beehive: 500, doghouse: 350, well: 1500,
    campfire: 300, bbq: 600, picnic: 500, swing: 800, hammock: 300, slide: 700, trampoline: 500, arch: 250, windmill: 2000, fountain: 3000, pool: 50000,
    // trophy exclusives (you also need the trophy)
    walkerstatue: 5000, goldginkgo: 6000, triumph: 60000, ringfountain: 12000, ringgarden: 15000, ringtower: 40000, finisharch: 10000, dolphinfountain: 18000,
    cabin: 35000, zengarden: 12000, podium: 8000, stage: 15000, court: 30000, igloo: 10000, flame: 9000 },
  statue: 8000, medal: 6000,   // every sport's golden statue; every award's medal sculpture
  clothes: { polo: 35, hoodie: 55, sweater: 65, jacket: 120, dress: 80, shorts: 30, skirt: 45, hightops: 90, boots: 140, sandals: 35, cap: 25, beanie: 25, sunhat: 35 },
  pet: { shiba: 2500, corgi: 2000, golden: 2000, husky: 1200, poodle: 1800, tabby: 150, black: 150, white: 300, calico: 200, ragdoll: 1500, collie: 3000 },
  petfood: { dogfood: 45, catfood: 35, treats: 12 },
  // the farm: [seed packet, sell price of one unit (a bunch, a bag, a box, one melon…), units per plot]
  crop: { wheat: [3, 2, 6], carrot: [3, 3, 4], potato: [4, 5, 3], onion: [5, 4, 4], garlic: [5, 3, 6], cabbage: [6, 4, 5], broccoli: [5, 4, 5], sweetpotato: [6, 6, 4],
    tomato: [8, 4, 6], cucumber: [6, 2, 13], eggplant: [7, 3, 9], chili: [8, 3, 10], corn: [8, 5, 6], pepper: [10, 2, 18], strawberry: [15, 5, 9], blueberry: [14, 6, 8],
    watermelon: [20, 8, 8], grape: [20, 6, 10], melon: [22, 6, 12], tulip: [18, 12, 5], rose: [25, 25, 3], sunflower: [20, 10, 7], pumpkin: [36, 9, 12] },
  sapling: { apple: 50, pear: 60, orange: 70, lemon: 60, peach: 70, cherry: 90 },
  // animals: [a baby, sold as a baby / young / adult, a baby every n-th time]
  animal: { chicken: [25, [8, 15, 25], 4], duck: [30, [10, 18, 30], 4], rabbit: [40, [15, 25, 40], 1], sheep: [300, [80, 180, 300], 5], goat: [350, [90, 200, 350], 5],
    pig: [250, [70, 150, 250], 4], cow: [1500, [400, 900, 1500], 8], alpaca: [2000, [600, 1200, 2000], 8], dog: [800, [300, 500, 800], 0], cat: [150, [50, 100, 150], 0],
    rainbowalpaca: [20000, [5000, 10000, 20000], 8] },
  // one unit: a carton of eggs, a bag of wool, a churn of milk, a jar of honey, a bag of apples…
  goods: { egg: 5, duckegg: 7, wool: 25, goatmilk: 12, truffle: 60, milk: 20, alpacawool: 60, honey: 12, fish: 8, bread: 8, shrimp: 12, koi: 40,
    apple: 5, pear: 6, orange: 6, lemon: 5, peach: 7, cherry: 8 },
  field: [0, 800, 2000, 4000], pasture: [0, 2500, 6000, 12000], orchard: [0, 1500, 3500, 6000], pond: [0, 8000, 18000],
  // town and life
  floorTile: 3000, parcel: 40000, move: 3000,
  mall: { movie: 15, claw: 2, burger: 14, noodles: 15, pizza: 18, sushi: 22, boba: 7, icecream: 6 },
  snack: 6, medicine: 30, school: 120, fineMin: 250, fineMax: 1000, bail: 500, stealFine: [20, 150],
  townLevels: [0, 400000, 1000000, 3000000, 8000000],   // the whole street's worth (you and your friends)
};
(function usdPrices() {
  const X = USD, set = (c, v) => { if (c) c.coins = v; };
  HOUSES.forEach((H, i) => { set(H.cost, X.house[i]); if (H.cost && H.cost.wood) H.cost.wood = nicePrice(H.cost.wood * 2.5); });   // (wood ×2.5 since v0.23)
  Object.entries(CARS).forEach(([k, c]) => set(c.cost, X.car[k]));
  GARAGE.forEach((g, i) => { if (g) { set(g.cost, X.garage[i]); g.cost.wood = nicePrice(g.cost.wood * 1.5); } });
  Object.entries(X.drive).forEach(([k, v]) => { DRIVES[k].cost = v; });
  Object.entries(FURN).forEach(([k, d]) => { if (X.furn[k]) d.price = X.furn[k]; if (d.plush) d.value = k === 'bigteddy' ? X.furnValue.bigteddy : X.furnValue.plush; if (d.poster) d.value = X.furnValue.poster; });
  Object.entries(YARD).forEach(([k, d]) => { if (X.yard[k]) d.price = X.yard[k]; else if (k.startsWith('st_')) d.price = X.statue; else if (k.startsWith('aw_')) d.price = X.medal; });
  Object.entries(CLOTHES).forEach(([k, c]) => { if (X.clothes[k]) c.price = X.clothes[k]; });
  Object.entries(PET_BREEDS).forEach(([k, B]) => { if (X.pet[k]) B.price = X.pet[k]; });
  Object.entries(PET_FOOD).forEach(([k, f]) => { f.price = X.petfood[k]; });
  Object.entries(X.crop).forEach(([k, [seed, sell, y]]) => Object.assign(CROPS[k], { seed, sell, yield: y }));
  Object.entries(X.sapling).forEach(([k, v]) => { TREES[k].price = v; });
  Object.entries(X.animal).forEach(([k, [price, sell, be]]) => Object.assign(ANIMALS[k], { price, sell }, ANIMALS[k].babyEvery ? { babyEvery: be } : {}));
  Object.entries(X.goods).forEach(([k, v]) => { GOODS[k].sell = v; });
  const farm = (L, V) => L.forEach((l, i) => { if (!l || !i) return; const c = l.cost || l; c.coins = V[i]; if (c.wood) c.wood = nicePrice(c.wood * 1.5); });
  farm(FIELD_COST, X.field); farm(PASTURE, X.pasture); farm(ORCHARD, X.orchard); farm(POND, X.pond);
  FLOOR_BUILD.coinsPerTile = X.floorTile; FLOOR_BUILD.woodPerTile = 1.6;
  LAND.parcel = X.parcel; LAND.move = X.move;
  MALL.movie = X.mall.movie; MALL.claw = X.mall.claw; Object.keys(MALL.foods).forEach(k => { MALL.foods[k].price = X.mall[k]; });
  SNACK.price = X.snack; SICK.medicine = X.medicine; SCHOOL.fee = X.school;
  POLICE.fineMin = X.fineMin; POLICE.fineMax = X.fineMax; POLICE.bail = X.bail; STEAL_FINE[0] = X.stealFine[0]; STEAL_FINE[1] = X.stealFine[1];
  X.townLevels.forEach((v, i) => { TOWN_LEVELS[i] = v; });
})();

// v0.40: food, drinks and fun cost what they cost in the county you're in (COUNTIES[].cost): the cafés, restaurants,
// bars, the mall, the bowling alley… Each price keeps its East Coast base (base_price); reading .price gives it in the
// county of the town on screen (VIEW_TOWN, see state.js). Cars, furniture, houses and land cost the same everywhere.
const countyOf = t => COUNTIES[(COMMUNITIES[t] || {}).county] || COUNTIES.monterey;
const stateOf = t => STATES[countyOf(t).state];
function localCost() { try { return typeof VIEW_TOWN !== 'undefined' && COMMUNITIES[VIEW_TOWN] ? countyOf(VIEW_TOWN).cost : 1; } catch (e) { return 1; } }
(function localPrices() {
  const localize = (o, key = 'price') => {
    if (!o || typeof o[key] !== 'number') return;
    const base = o[key];
    Object.defineProperty(o, 'base_' + key, { value: base, enumerable: false });
    Object.defineProperty(o, key, { get: () => (base ? Math.max(1, Math.round(base * localCost())) : 0), enumerable: true, configurable: true });   // (free stays free)
  };
  Object.values(VENUE).forEach(v => localize(v)); localize(SNACK); localize(MALL, 'movie'); localize(MALL, 'claw');
  Object.values(MALL.foods).forEach(f => localize(f)); Object.values(VENUE_GAMES).forEach(g => localize(g)); Object.values(SPECIALTIES).forEach(f => localize(f));
})();

// v0.41: what bites in the fishing contest (how likely, how heavy in kg); an old boot now and then
const CONTEST_FISH = [
  { k: 'bass', e: '🐟', zh: '鲈鱼', en: 'Bass', p: 0.34, kg: [0.4, 2.4] }, { k: 'trout', e: '🐟', zh: '鳟鱼', en: 'Trout', p: 0.26, kg: [0.3, 2] },
  { k: 'carp', e: '🐠', zh: '鲤鱼', en: 'Carp', p: 0.18, kg: [1, 5.5] }, { k: 'catfish', e: '🐡', zh: '鲶鱼', en: 'Catfish', p: 0.12, kg: [1.5, 7] },
  { k: 'koi', e: '🎏', zh: '金色锦鲤', en: 'Golden koi', p: 0.04, kg: [0.8, 2] }, { k: 'boot', e: '🥾', zh: '一只旧靴子', en: 'An old boot', p: 0.06, kg: [0, 0] },
];
// v0.41: karaoke songs (old nursery songs, free for anyone to sing). Each line: who sings it (0 you, 1 them) and its
// notes: [MIDI pitch, beats, word in Chinese, word in English] (the two languages have the same number of syllables).
const SONGS = [
  { id: 'twinkle', e: '⭐', zh: '小星星', en: 'Twinkle, Twinkle, Little Star', bpm: 100, lines: [
    [0, [[60, 1, '一', 'Twin'], [60, 1, '闪', 'kle'], [67, 1, '一', 'twin'], [67, 1, '闪', 'kle'], [69, 1, '亮', 'lit'], [69, 1, '晶', 'tle'], [67, 2, '晶', 'star']]],
    [0, [[65, 1, '满', 'How'], [65, 1, '天', 'I'], [64, 1, '都', 'won'], [64, 1, '是', 'der'], [62, 1, '小', 'what'], [62, 1, '星', 'you'], [60, 2, '星', 'are']]],
    [1, [[67, 1, '挂', 'Up'], [67, 1, '在', 'a'], [65, 1, '天', 'bove'], [65, 1, '上', 'the'], [64, 1, '放', 'world'], [64, 1, '光', 'so'], [62, 2, '明', 'high']]],
    [1, [[67, 1, '好', 'Like'], [67, 1, '像', 'a'], [65, 1, '许', 'dia'], [65, 1, '多', 'mond'], [64, 1, '小', 'in'], [64, 1, '眼', 'the'], [62, 2, '睛', 'sky']]],
  ] },
  { id: 'jacques', e: '🔔', zh: '两只老虎', en: 'Frère Jacques', bpm: 112, lines: [
    [0, [[60, 1, '两', 'Are'], [62, 1, '只', 'you'], [64, 1, '老', 'sleep'], [60, 1, '虎', 'ing']]],
    [0, [[60, 1, '两', 'are'], [62, 1, '只', 'you'], [64, 1, '老', 'sleep'], [60, 1, '虎', 'ing']]],
    [0, [[64, 1, '跑', 'Bro'], [65, 1, '得', 'ther'], [67, 2, '快', 'John']]],
    [0, [[64, 1, '跑', 'Bro'], [65, 1, '得', 'ther'], [67, 2, '快', 'John']]],
    [1, [[67, 0.5, '一', 'Morn'], [69, 0.5, '只', 'ing'], [67, 0.5, '没', 'bells'], [65, 0.5, '有', 'are'], [64, 1, '耳', 'ring'], [60, 1, '朵', 'ing']]],
    [1, [[67, 0.5, '一', 'morn'], [69, 0.5, '只', 'ing'], [67, 0.5, '没', 'bells'], [65, 0.5, '有', 'are'], [64, 1, '尾', 'ring'], [60, 1, '巴', 'ing']]],
    [1, [[60, 1, '真', 'Ding'], [55, 1, '奇', 'dang'], [60, 2, '怪', 'dong']]],
    [1, [[60, 1, '真', 'ding'], [55, 1, '奇', 'dang'], [60, 2, '怪', 'dong']]],
  ] },
];
