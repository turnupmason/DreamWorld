// Turns the game catalog (prototype/js/data.js) into markdown tables for docs/数值表.md
const fs = require('fs'), vm = require('vm');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'prototype', 'js', 'data.js'), 'utf8');
const D = vm.runInNewContext(src + `;({VERSION, CROPS, TREES, ANIMALS, GOODS, FIELD_LEVELS, FIELD_COST, PASTURE, ORCHARD, POND, FISH_KINDS, FISH_EVERY,
  HOUSES, FURN, YARD, CARS, FOCUS_REWARD, ENERGY_LEVELS, STEP_REWARD, GOAL_REWARD, RINGS, RING_REWARD, SLEEP_REWARD, MINDFUL_REWARD,
  WORKOUTS, ACTION_CAP, STEAL_CAP, STEP_GOAL, LOT_W, LOT_D, AREA, MAILBOX, TOWN_LEVELS, FLOOR_BUILD, FLOOR_H, SOUVENIRS,
  STEP_BLOCKS_MAX, STEP_GOAL_RANGE, WORKOUT_PAY_MAX, WORKOUT_PAY, CENTRE_NEW, TOWER_STOREYS, BUILDING_FLOORS, ROOM_WALLS, FLOORS, STREETS, NEIGHBORHOODS, LAND, PARCEL, NPC_LOTS, START_LOTS,
  STADIUM_LOOK, PET_BREEDS, PET_MAX, PET_NEEDS, PET_REMIND, PET_LOVE, PET_FOOD, PET_START_FOOD, TROPHY_TIERS, STREAK_TROPHIES, SPORT_TIERS, SPORT_GROUPS, SPORTS, EXCLUSIVES, COMMUNITIES, SHOW_LIMITS, ONLINE_SHARE, VISIT_SHARE, ASK_YES, LAYOUTS, COMMUNITY_LAYOUT, TRIP_SPEED, PLACE_INFO, HARVEST_GOAL, HELP_HARVEST, BREAD, LAKE_FISH, LIB_CARDS, AWARDS, AWARD_RULES, WALK_CARRY, MARKET, ANIMAL_SIZE, BABY_SIZE, WEATHER_FARM, JOBS, JOB_RANKS, JOB_REL, SICK, STORES, BODY_TYPES, CLOTHES, POLICE, MALL, GARAGE, HANDS_VOL, BIG_VOL, DELIVERY, SCHOOL, DRIVES, NEEDS, FOOD_FILL, NEED_GAIN, SNACK, BANK, STOCKS, STOCK, VENUE, VENUE_PLACES, REL_LEVELS, REL_START, TRAITS, INTERESTS, SOCIAL_CATS, SOCIALS, SOCIAL, PARK, BALL_GAMES, BALL, VENUE_GAMES, MUSEUM_FACTS, WORLD, DISTRICT, buildLayout, ROAD_KINDS, FREEWAY, STATES, COUNTIES, TERRAINS, SPECIALTIES, FOLK_NAMES, TOWNSFOLK, SPECIAL, CONTEST_FISH, SONGS, ZOO_ANIMALS, ZOO_SHOP, WOOD_USD, FRESH, FEED, NEED_LOW, NEEDS, PERKS, MUSEUM_GIFT, FURN_FLOORS, SHOP_SUBS, PLOT, plotCost, CAR_PACE, SIG, RUSH, TIDY, CARS, LOCAL_HOMES, DO_SECS, OUTDOOR, TALK, ZONES, HOUSE_LOT, LEAGUES, SEASON, BETS})`);
const out = [];
const P = s => out.push(s);
const cost = c => [c.coins ? `🪙${c.coins}` : '', c.wood ? `🪵${c.wood}` : ''].filter(Boolean).join(' ') || '免费';
const table = (head, rows) => { P('| ' + head.join(' | ') + ' |'); P('|' + head.map(() => ' --- ').join('|') + '|'); rows.forEach(r => P('| ' + r.join(' | ') + ' |')); P(''); };
const RARE = { sleep: '睡眠分 80+ 获得', rings: '三环全合获得', focus: '离线 2 小时获得', steps: '6,000 步获得' };
const good = k => `${D.GOODS[k].e} ${D.GOODS[k].zh}`;

P('# 数值表（v' + D.VERSION + '）');
P('');
P('游戏里的全部内容和数值，从 `prototype/js/data.js` 自动生成。时间单位是分钟（现在为了演示用得很短，正式上线前要按真实节奏放大）。玩法说明见 `游戏设计.md`。');
P('');
P('> 生成方式：数据在 `prototype/js/data.js`（游戏实际用的就是这份），运行 `node docs/生成数值表.js` 重新生成本文件。改数值只改 data.js。');
P('');
P('## 基础规则');
P('');
table(['项目', '数值'], [
  ['每天农活上限（种菜、偷菜）', D.ACTION_CAP], ['每天偷菜上限', D.STEAL_CAP],
  ['每日步数目标', `开始是 ${D.STEP_GOAL.toLocaleString()}；之后 = 最近 7 天平均 × 1.1，取整到 500，在 ${D.STEP_GOAL_RANGE.map(n => n.toLocaleString()).join('–')} 之间`],
  ['步数奖励', `每走到目标的 1/6 发一次，最多 ${D.STEP_BLOCKS_MAX} 次（目标的 150%）`],
  ['运动奖励', `每天最多算 ${D.WORKOUT_PAY_MAX} 分钟`],
  ['每块家园地大小', `${D.LOT_W} × ${D.LOT_D} 格，前面是马路`], ['小镇等级门槛（全镇总家产）', D.TOWN_LEVELS.map((v, i) => `Lv${i + 1} ${v.toLocaleString()}`).join('，')],
]);
P('家园地内区域（格子坐标，x 向右下，y 向左下）：');
P('');
table(['区域', '位置'], Object.entries(D.AREA).map(([k, a]) => [k, `x ${a.x}–${a.x + a.w}，y ${a.y}–${a.y + a.d}`]).concat([['mailbox（邮箱）', `x ${D.MAILBOX[0]}，y ${D.MAILBOX[1]}`]]));

P('## 小镇和土地');
P('');
P(`每条街分成 ${D.PARCEL} 格宽、${D.LOT_D} 格深的一块块地。一个家占 4 块（16 格宽的核心：房子、农场、院子），可以买下右边的空地扩建。`);
P('');
table(['街道', '社区', '位置（左上角）', '块数', '地价倍数'], Object.values(D.STREETS).map(st => [`${st.zh} (${st.en})`, D.NEIGHBORHOODS[st.nb].zh, `x ${st.x}，y ${st.y}`, st.n, `×${D.NEIGHBORHOODS[st.nb].price}`]));
const pc = (n, f) => Math.round(D.LAND.parcel * Math.pow(D.LAND.grow, n) * f / 50) * 50;
table(['买地', '价格（梧桐街；其他社区乘地价倍数）'], [
  ['第 1 块（20 格宽）', `🪙${pc(0, 1)}`], ['第 2 块（24 格宽）', `🪙${pc(1, 1)}`], ['第 3 块（28 格宽）', `🪙${pc(2, 1)}`], ['第 4 块（32 格宽）', `🪙${pc(3, 1)}`],
  ['每多一块', `×${D.LAND.grow}`], ['搬家（买下 16 格宽的新地）', `🪙${D.LAND.move * 4} × 地价倍数；之前买的地退 ${Math.round(D.LAND.refund * 100)}%`],
]);
P(`镇上另外住着 ${D.NPC_LOTS.length} 户居民，地从 ${Math.min(...D.NPC_LOTS.map(l => l.n)) * D.PARCEL} 到 ${Math.max(...D.NPC_LOTS.map(l => l.n)) * D.PARCEL} 格宽。`);
P('');

P('## 作物（' + Object.keys(D.CROPS).length + ' 种）');
P('');
table(['作物', '成熟', '种子', '每块收', '单价', '每块卖', '每格画几株'], Object.values(D.CROPS).map(c => [
  `${c.e} ${c.zh} (${c.en})`, `${c.grow} 分钟`, c.rare ? RARE[c.rare] : `🪙${c.seed}`, c.yield, `🪙${c.sell}`, `🪙${c.yield * c.sell}`, c.n]));
P('5 个生长阶段：刚种下（0–10%）、发芽（10–35%）、长叶（35–65%）、开花结果（65–100%）、成熟。');
P('');

P('## 果树（' + Object.keys(D.TREES).length + ' 种，种在果园）');
P('');
table(['果树', '树苗价', '长成', '结果间隔', '每次结', '果子单价'], Object.values(D.TREES).map(t => [
  `${t.e} ${t.zh}`, `🪙${t.price}`, `${t.grow} 分钟`, `${t.every} 分钟`, t.n, `🪙${D.GOODS[t.fruit].sell}`]));
P('3 个阶段：树苗（0–40%）、小树（40–100%）、结果的大树（先开花再结果）。');
P('');

P('## 牲畜（' + Object.keys(D.ANIMALS).length + ' 种）');
P('');
table(['动物', '幼崽', '幼崽价', '长大', '产出', '产出间隔', '下崽', '卖价（幼崽 / 半大 / 成年）'], Object.values(D.ANIMALS).map(a => [
  `${a.e} ${a.zh}`, a.baby.zh, `🪙${a.price}`, `${a.grow} 分钟`, a.prod ? `${good(a.prod)} ×${a.n}` : (a.pet ? (a.guard ? '看家' : '宠物') : '只下崽'),
  a.every ? `${a.every} 分钟` : '—', a.babyEvery ? (a.babyEvery === 1 ? '每次' : `每 ${a.babyEvery} 次`) : '—', a.sell.map(v => `🪙${v}`).join(' / ')]));
P('3 个阶段：幼崽（0–40%）、半大（40–100%）、成年。宠物住院子，不占牧场。');
P('');

P('## 农产品（仓库里卖）');
P('');
table(['产品', '单价'], Object.values(D.GOODS).map(g => [`${g.e} ${g.zh}`, `🪙${g.sell}`]));

P('## 土地');
P('');
table(['土地', '等级', '容量', '价格'], [
  ...D.FIELD_COST.map((c, i) => ['菜地', `Lv${i + 1}`, `${D.FIELD_LEVELS[i]} 块`, c ? cost(c) : '开局自带']),
  ...D.PASTURE.slice(1).map((p, i) => ['牧场', `Lv${i + 1}`, `${p.w}×${p.d}，${p.cap} 只`, cost(p.cost)]),
  ...D.ORCHARD.slice(1).map((o, i) => ['果园', `Lv${i + 1}`, `${o.slots} 棵`, cost(o.cost)]),
  ...D.POND.slice(1).map((o, i) => ['鱼塘', `Lv${i + 1}`, `${o.cap} 条`, cost(o.cost)]),
]);
P(`鱼塘每 ${D.FISH_EVERY} 分钟来一条鱼，钓到的概率：` + D.FISH_KINDS.map(([k, p]) => `${good(k)} ${Math.round(p * 100)}%`).join('，') + '。');
P('');

P('## 房子（' + D.HOUSES.length + ' 种）');
P('');
table(['房子', '占地', '每层室内', '自带层数', '最多层数', '价格'], D.HOUSES.map(h => [`${h.zh} (${h.en})`, `${h.fp[2]}×${h.fp[3]}`, `${h.room[0]}×${h.room[1]}`, h.floors[0], h.floors[1], cost(h.cost)]));
P(`### 加盖楼层`);
P('');
P(`每加盖一层：🪙 = 室内格数 × ${D.FLOOR_BUILD.coinsPerTile}（取整到 50）；每多一层再 ×${D.FLOOR_BUILD.grow}。外面看房子每层高 ${D.FLOOR_H} 像素（中式庭院加盖是楼阁的一层）。每层是独立房间：自己的墙纸、地板、家具。`);
P('');
const fc = (h, n) => { const k = Math.pow(D.FLOOR_BUILD.grow, n - h.floors[0] - 1), a = h.room[0] * h.room[1]; return cost({ coins: Math.round(a * D.FLOOR_BUILD.coinsPerTile * k / 50) * 50, wood: Math.round(a * D.FLOOR_BUILD.woodPerTile * k) }); };
table(['房子', '可以加盖', '每层价格'], D.HOUSES.filter(h => h.floors[1] > h.floors[0]).map(h => {
  const ns = []; for (let n = h.floors[0] + 1; n <= h.floors[1]; n++) ns.push(`${n} 层 ${fc(h, n)}`);
  return [h.zh, `${h.floors[0]} → ${h.floors[1]} 层`, ns.join('；')];
}));
P(`墙纸 ${D.ROOM_WALLS.length} 种，地板 ${D.FLOORS.length} 种。`);
P('');

const USE = { sit: '坐 / 躺', run: '跑步', bike: '骑车', lift: '举铁', box: '打沙袋', yoga: '瑜伽' };
P('## 家具（' + Object.keys(D.FURN).length + ' 件）');
P('');
table(['家具', '占地', '价格', '可换颜色', '能用来'], Object.values(D.FURN).filter(f => !f.souv).map(f => [
  `${f.zh} (${f.en})`, `${f.w}×${f.d}` + (f.flat ? '（铺地上）' : ''), `🪙${f.price}`, f.tint ? '✓' : '', f.use ? USE[f.use] : '']));

const NEED = { days: '来小镇 {n} 天（休息日也算）', goalDays: '{n} 天走到自己的步数目标', sleepStreak: '连续 {n} 晚睡眠 80 分以上',
  ringsAll: '合上一次三个圆环', focus120: '一次离开分心 App 2 小时', mindful: '正念累计 {n} 分钟', workouts: '{n} 次 10 分钟以上的运动' };
P('## 纪念品（' + D.SOUVENIRS.length + ' 件，买不到，只能在现实里做到）');
P('');
table(['纪念品', '怎么得到'], D.SOUVENIRS.map(s => [`${D.FURN[s.k].zh} (${D.FURN[s.k].en})`, NEED[s.need].replace('{n}', s.n)]));
P('得到后自动摆进一楼（放不下就进仓库），不计入家产。');
P('');

P('## 宠物（' + Object.keys(D.PET_BREEDS).length + ' 个品种，每家最多 ' + D.PET_MAX + ' 只）');
P('');
table(['品种', '种类', '领养价'], Object.values(D.PET_BREEDS).map(b => [`${b.zh} (${b.en})`, b.kind === 'dog' ? '狗' : '猫', `🪙${b.price}`]));
const NEED_ZH = { food: '吃饭', water: '喝水', clean: '猫砂（猫）/ 散步（狗）', love: '心情' };
table(['需要', '从 100 降到 0 要', '提醒'], Object.entries(D.PET_NEEDS).map(([k, n]) => [`${n.e} ${NEED_ZH[k]}`, `${n.hours} 小时`, `降到 ${D.PET_REMIND} 以下`]));
table(['宠物粮', '价格', '份数'], Object.values(D.PET_FOOD).map(f => [`${f.e} ${f.zh} (${f.en})`, `🪙${f.price}`, `${f.n}`]));
P(`领养送 ${D.PET_START_FOOD} 顿饭和食盆（猫还送猫砂盆）。摸摸心情 +${D.PET_LOVE.pet}，玩耍 +${D.PET_LOVE.play}，零食 +${D.PET_LOVE.treat}。宠物不会生病、不会离开，忘了照顾只会难过。`);
P('');

P('## 奖杯（v0.10，只能在现实里赢得）');
P('');
P('每个奖杯分铜、银、金三级。连续天数的奖杯从今天达标起算；运动奖杯：一次 10 分钟以上的运动算一次。');
P('');
const exName = k => { const d = D.YARD[k] || D.CARS[k] || D.PET_BREEDS[k] || D.ANIMALS[k]; return `${d.zh}`; };
table(['奖杯', '铜', '银', '金', '各级解锁的专属'], Object.values(D.STREAK_TROPHIES).map(T => [`${T.e} ${T.zh}（${T.desc.zh.replace('{n}', 'N')}）`, ...T.tiers.map(n => `${n} 天`), T.excl.map(exName).join(' / ')]));
table(['运动类别', '运动（Apple Watch 里的类型）', '金奖杯解锁'], Object.entries(D.SPORT_GROUPS).map(([g, G]) => [`${G.e} ${G.zh}`, D.SPORTS.filter(s => s.group === g).map(s => s.zh).join('、'), G.excl ? exName(G.excl) : '—']));
P(`运动奖杯：${D.SPORT_TIERS[0]} 次铜、${D.SPORT_TIERS[1]} 次银、${D.SPORT_TIERS[2]} 次金。共 ${D.SPORTS.length} 种运动。`);
P('');
P('## 专属（拿到奖杯才能买，' + D.EXCLUSIVES.length + ' 件）');
P('');
table(['专属', '类型', '价格'], D.EXCLUSIVES.map(([kind, k]) => { const d = kind === 'yard' ? D.YARD[k] : kind === 'car' ? D.CARS[k] : kind === 'pet' ? D.PET_BREEDS[k] : D.ANIMALS[k]; return [`${d.zh} (${d.en})`, { yard: '院子', car: '车', pet: '宠物', animal: '牲畜' }[kind], `🪙${kind === 'car' ? d.cost.coins : d.price}`]; }));

P('## 商店（v0.17）');
P('');
const CAT_ZH = { seeds: '种子', sell: '卖东西', trees: '树苗', yard: '庭院', animals: '牲畜', pets: '宠物', furn: '家具', land: '土地', houses: '房子', cars: '载具', excl: '专属', clothes: '衣服' };
table(['店', '卖什么'], Object.values(D.STORES).map(s => [`${s.e} ${s.zh} (${s.en})`, s.cats.map(c => CAT_ZH[c] || c).join('、')]));
P('## 身材和衣服（v0.18）');
P('');
table(['身材', '宽', '高'], Object.values(D.BODY_TYPES).map(b => [`${b.zh} (${b.en})`, b.w, b.h]));
const SLOT_ZH = { top: '上衣', bottom: '下装', shoes: '鞋', hat: '帽子' };
table(['衣服', '类', '价格'], Object.values(D.CLOTHES).map(c => [`${c.e} ${c.zh} (${c.en})`, SLOT_ZH[c.slot], c.price ? `🪙${c.price}` : '免费']));
P('## 买东西带回家（v0.20）');
P('');
table(['项目', '数值'], [['拿在手上', `每件 ≤ ${D.BIG_VOL}，一共 ≤ ${D.HANDS_VOL}（1×1 家具 = 10，种子 10 包 = 1）`], ['后备箱', '按车的载货量'], ['送货上门（v0.34 起车行也一样）', `账单 ${D.DELIVERY.fee * 100}%（🪙${D.DELIVERY.min}–${D.DELIVERY.max}），第二天上午 ${D.DELIVERY.hour} 点送到`],
  ['吃饱', `${D.MALL.fed.hours} 小时：打工 +${D.MALL.fed.pay * 100}%，走路快 ${D.MALL.fed.walk * 100}%`], ['电影海报 / 玩偶 / 巨型泰迪熊', '家产 +60 / +40 / +300']]);
P('## 公园（v0.32）');
P('');
table(['事情', '多久', '得到'], [['在网球场 / 篮球场 / 足球场边看比赛（每个场地每天一次）', `${D.PARK.watch.sec} 秒`, `娱乐 +${D.PARK.watch.fun}`], ['喂鸭子（每天一次）', `${D.PARK.ducks.sec} 秒`, `娱乐 +${D.PARK.ducks.fun}`],
  ['喷泉边的长椅坐一会儿（每天一次）', `${D.PARK.bench.sec} 秒`, `娱乐 +${D.PARK.bench.fun}`], ['游乐场蹦床（每天一次）', `${D.PARK.play.sec} 秒`, `娱乐 +${D.PARK.play.fun}`], ['冰淇淋车', `${D.PARK.icecream.sec} 秒`, `和美食广场的冰淇淋一样：🪙${D.MALL.foods.icecream.price}，饱腹 +${D.FOOD_FILL.icecream}，娱乐 +${D.NEED_GAIN.sweetFun}`]]);
P('## 公园球场上的小游戏（v0.33）');
P('');
table(['小游戏', '怎么玩', '规则'], [['🎾 网球', '自己会跑过去接球；脚下的圈缩小变绿时往上划回球，左右划定方向，划长打得深', `一局定输赢：15、30、40，先得 ${D.BALL_GAMES.tennis.to} 分赢，40 平时下一分决胜`],
  ['🏀 投篮比赛', '往上划投篮：划直才准，划多长就投多远', `${D.BALL_GAMES.basketball.spots} 个位置，每人每个位置投 ${D.BALL_GAMES.basketball.shots} 球；进一个 2 分，最后一个位置 3 分`],
  ['⚽ 点球大战', '踢：往球门划，左右定方向，越长越高；守门：点要扑的地方', `每人 ${D.BALL_GAMES.soccer.kicks} 个，进得多的赢；一样多就是平局`]]);
P('');
table(['什么时候', '得到'], [['每种球今天的第一局（输赢都一样）', `娱乐 +${D.BALL.fun}；和认识的人玩再加社交 +${D.BALL.social}、关系 +${D.BALL.rel}`], ['同一种球再玩', `娱乐 +${D.BALL.againFun}`]]);
P('');
P(`对手的球技（0–1）：基础 ${D.BALL.skill.base}，性格「运动迷」+${D.BALL.skill.sporty}，爱好有「运动」+${D.BALL.skill.sport}，最多 0.9；球场上本来在玩的人是 ${D.BALL.skill.court}。关系「有点尴尬」或者对方今天心情很差，会不想玩。不给金币。`);
P('');
P('## 和人相处（v0.31，像模拟人生）');
P('');
P(`关系值 ${D.REL_LEVELS[0].min} 到 100，不会自己掉。起点：朋友 ${D.REL_START.friend}、家人 ${D.REL_START.family}、同事老板 ${D.REL_START.work}、其他人 ${D.REL_START.other}。`);
P('');
table(['关系等级', '从多少起'], D.REL_LEVELS.map(l => [`${l.e} ${l.zh}`, l.min]));
const catZh = { friendly: '友好', funny: '好玩', deep: '深聊', gift: '送礼', mischief: '恶作剧' };
table(['互动', '分类', '要多少关系', '基础成功率', '成功关系', '失败关系', '社交', '娱乐'], Object.values(D.SOCIALS).map(a => [`${a.e} ${a.zh}`, catZh[a.cat], a.min, `${Math.round(a.base * 100)}%`, `+${a.up}`, a.down, `+${a.social}`, a.fun ? `+${a.fun}` : '']));
P(`成功率 = 基础 + 对方今天的心情（很好 +${D.SOCIAL.moodBy.great * 100}%、不错 0、有点累 ${D.SOCIAL.moodBy.meh * 100}%、烦 ${D.SOCIAL.moodBy.grumpy * 100}%）+ 关系 × ${D.SOCIAL.relBy * 100}% + 对方性格喜欢的 +${D.SOCIAL.likeBy * 100}%（成功时关系再 +${D.SOCIAL.likedUp}）/ 不喜欢的 ${D.SOCIAL.dislikeBy * 100}% + 聊到共同爱好 +${D.SOCIAL.shareBy * 100}%（对方不感兴趣 −${D.SOCIAL.noShare * 100}%）；同一件事一天做到第 ${D.SOCIAL.boring + 1} 次起每次 −${D.SOCIAL.boredBy * 100}%。送礼一定成功，吃货多 +${D.SOCIAL.foodieUp}。和老板 / 同事成功：工作关系 +${D.SOCIAL.workRel.boss} / +${D.SOCIAL.workRel.mate}。`);
P('');
table(['性格', '喜欢', '不喜欢'], Object.values(D.TRAITS).map(tr => [`${tr.e} ${tr.zh}`, tr.likes.map(k => D.SOCIALS[k].zh).join('、'), tr.dislikes.map(k => D.SOCIALS[k].zh).join('、')]));
P(`兴趣：${Object.values(D.INTERESTS).map(x => x.e + x.zh).join('、')}（每人两个，你有三个）。`);
P('');
P('## 楼里能做的事（v0.30）');
P('');
P(`能进去的地方：${D.VENUE_PLACES.map(k => D.PLACE_INFO[k] ? D.PLACE_INFO[k].zh : D.STORES[k].zh).join('、')}。下面这些每天各算一次（健身房每天最多 ${D.VENUE.gym.max} 次）。`);
P('');
table(['事情', '多久', '得到'], [['健身房任意器械', `${D.VENUE.gym.sec} 秒`, `娱乐 +${D.VENUE.gym.fun}`], ['咖啡馆坐下聊天', `${D.VENUE.cafeChat.sec} 秒`, `社交 +${D.VENUE.cafeChat.social}`], ['咖啡馆沙发听音乐', `${D.VENUE.cafeSofa.sec} 秒`, `娱乐 +${D.VENUE.cafeSofa.fun}`],
  ['图书馆坐下看书', `${D.VENUE.libRead.sec} 秒`, `娱乐 +${D.VENUE.libRead.fun}`], ['面包店坐下吃点心', `${D.VENUE.eat.sec} 秒`, `就是买点心的饱腹`], ['消防站看消防车', `${D.VENUE.truck.sec} 秒`, `娱乐 +${D.VENUE.truck.fun}，一条防火小知识`], ['诊所健康检查', '马上', '昨晚睡眠分和今天步数（只有自己看得到）']]);
// v0.37: the new places in the town centre
P('### v0.37 新地方（镇中心）');
P('');
P(`新楼按顺序摆在离镇政府最近的空地：${D.CENTRE_NEW.map(([k, w, d]) => `${D.PLACE_INFO[k].zh}（${w}×${d}）`).join('、')}（家乡镇放不下公寓楼）。高楼：${Object.entries(D.TOWER_STOREYS).map(([k, n]) => `${D.PLACE_INFO[k].zh} ${n} 层`).join('、')}。坐电梯能去的楼层：${Object.entries(D.BUILDING_FLOORS).map(([k, f]) => `${D.PLACE_INFO[k].zh}（${f.map(x => D.PLACE_INFO[x].zh).join(' → ')}）`).join('，')}。`);
P('');
const V2 = D.VENUE, gain = v => [v.hunger && `饱腹 +${v.hunger}`, v.fun && `娱乐 +${v.fun}`, v.social && `社交 +${v.social}`, v.rel && `关系 +${v.rel}`].filter(Boolean).join('，');
table(['事情', '花多少', '多久', '得到'], [
  ['空中餐厅：靠窗吃晚餐', `🪙${V2.dinner.price}`, `${V2.dinner.sec} 秒`, gain(V2.dinner)], ['空中餐厅：约朋友 / 家人吃饭（你请客）', `🪙${V2.date.price}`, `${V2.date.sec} 秒`, gain(V2.date)],
  ['餐厅吧台 / 酒店大堂酒吧喝一杯', `🪙${V2.drink.price}`, `${V2.drink.sec} 秒`, gain(V2.drink)], ['酒店下午茶', `🪙${V2.tea.price}`, `${V2.tea.sec} 秒`, gain(V2.tea)],
  ['屋顶泳池游泳（每天 ' + V2.swim.max + ' 次）', '免费', `${V2.swim.sec} 秒`, gain(V2.swim)], ['躺椅晒太阳（每天一次）', '免费', `${V2.sunbathe.sec} 秒`, gain(V2.sunbathe)],
  ['写字楼看风景（每天一次）', '免费', `${V2.view.sec} 秒`, gain(V2.view)], ['公寓楼大堂和邻居聊天（每天一次）', '免费', `${V2.lounge.sec} 秒`, gain(V2.lounge)],
  ['书店买一本坐下读', `🪙${V2.book.price}`, `${V2.book.sec} 秒`, gain(V2.book)], ['理发店剪头发（换发型、发色）', `🪙${V2.haircut.price}`, `${V2.haircut.sec} 秒`, '新发型'],
  ['花店买一束花（放进仓库，送人关系多 +' + D.SOCIAL.bouquetUp + '）', `🪙${V2.bouquet.price}`, '马上', '一束花'], ['超市生鲜区买一袋菜（回家做饭）', `🪙${V2.groceries.price}`, '马上', Object.entries(V2.groceries.items).map(([k, n]) => `${D.CROPS[k] ? D.CROPS[k].zh : D.GOODS[k].zh} ×${n}`).join('、')],
  ['银行柜台 / 取款机 / 贷款桌', '免费', '马上', '打开手机银行']]);
// v0.38: a bigger town and the new district
P('### v0.38 新区（每个镇都变大了）');
P('');
{ const L = D.buildLayout('grid', false), late = Object.entries(D.STORES).filter(([, s]) => s.late);
  P(`每个镇往一边多出一片 ${D.DISTRICT} 格深的新区（大多在南边；南边是海的镇在东边，镜像的镇在西边）：原来通到镇边的大路接着往新区修，新区中间一条四车道大马路（中间有绿化隔离带）；没有大路通过来的地方，从最近的路修一条街连上。原来的店、停车场、小路位置都不变。梧桐镇从 ${D.WORLD.x1 - D.WORLD.x0}×${D.WORLD.y1 - D.WORLD.y0} 变成 ${L.world.x1 - L.world.x0}×${L.world.y1 - L.world.y0}。`);
  P('');
  P(`新区的楼（沿大马路，从中间往两边排）：${late.map(([k, s]) => `${s.e} ${s.zh}（${s.w}×${s.d}）`).join('、')}。`);
  P(''); }
table(['事情', '花多少', '多久', '得到'], [
  ['医院：探望病人（每天一次）', '免费', `${V2.visit.sec} 秒`, gain(V2.visit)], ['医院：看新生儿（每天一次）', '免费', `${V2.babies.sec} 秒`, gain(V2.babies)],
  [`医院：献血（每 ${V2.donate.every} 天最多一次）`, '免费', `${V2.donate.sec} 秒`, gain(V2.donate)], ['医院：全面体检', '免费', '马上', '这周平均步数、今天步数、昨晚睡眠（只有自己看得到）'],
  [`保龄球（和朋友或隔壁球道的人，每人 ${D.VENUE_GAMES.bowling.frames} 轮，全中 +${D.VENUE_GAMES.bowling.strike}、补中 +${D.VENUE_GAMES.bowling.spare}）`, `🪙${D.VENUE_GAMES.bowling.price}`, '一局', `今天第一局：娱乐 +${D.BALL.fun}，社交 +${D.BALL.social}，关系 +${D.BALL.rel}；再玩：娱乐 +${D.BALL.againFun}`],
  ['保龄球馆：街机', `🪙${V2.arcade.price}`, `${V2.arcade.sec} 秒`, gain(V2.arcade)],
  [`游泳比赛（${D.VENUE_GAMES.race.len} 米，轮流点左右）`, '免费', '一局', `同保龄球`], ['游泳馆：自由泳（和屋顶泳池合计每天 ' + V2.swim.max + ' 次）', '免费', `${V2.swim.sec} 秒`, gain(V2.swim)],
  ['游泳馆：跳水（每天一次）', '免费', `${V2.dive.sec} 秒`, gain(V2.dive)], ['游泳馆：桑拿（每天一次）', '免费', `${V2.sauna.sec} 秒`, gain(V2.sauna)],
  ['博物馆：恐龙 / 太空 / 画廊 / 历史四个厅（每个厅每天一次，配一张知识卡）', '免费', `${V2.ex_dino.sec} 秒`, gain(V2.ex_dino) + '（每个厅）'], ['博物馆纪念品店：恐龙玩偶（放进仓库）', `🪙${V2.souvenir.price}`, '马上', '恐龙玩偶'],
  ['火车站：坐火车去附近的镇（每天第一次坐有娱乐）', `🪙${V2.train.price}`, '马上', gain(V2.train)], ['火车站：坐在站台看火车（每天一次）', '免费', `${V2.trains.sec} 秒`, gain(V2.trains)],
  [`酒店：订一晚客房（住到第二天 ${V2.room.checkout}:00）`, `🪙${V2.room.price}`, '马上', '电梯能上客房'], ['客房：躺大床（每天一次）', '免费', `${V2.bed.sec} 秒`, gain(V2.bed)], ['客房：泡澡（每天一次）', '免费', `${V2.bath.sec} 秒`, gain(V2.bath)]]);
P('');
P(`博物馆知识卡：${Object.entries(D.MUSEUM_FACTS).map(([k, L]) => L.length + ' 张').join(' + ')}，每个厅每天换一张。`);
P('');
// v0.39: every kind of road
P('### v0.39 道路种类');
P('');
table(['路', '每个方向几条车道', '限速牌（英文 / 中文）', '镇上的车开多快（大道 = 1）'], Object.values(D.ROAD_KINDS).map(r => [`${r.e} ${r.zh} (${r.en})`, r === D.ROAD_KINDS.frontage ? '双向时 1，单行时 2' : r.lanes, `${r.mph} mph / ${r.kmh} 公里`, `×${r.spd}`]));
P('');
{ const L = D.buildLayout('grid', false), F = L.fwy, FW = D.FREEWAY;
  P(`州际高速（每个镇都有，在新区最外边）：路面 ${FW.w} 格宽，每个方向 ${FW.lane} 格宽的车道 3 条，中间水泥隔离墩；镇这边一条双向辅路（原来通到镇边的大道都接上它），对面一条单行双车道辅路；离立交 ${FW.ramp[0]} 格的地方下高速、${FW.ramp[1]} 格的地方接上辅路（上高速反过来）。立交那里高速架在桥上（${FW.deck} 像素高，两头各 ${FW.rise} 格的坡），一条大道从桥下穿过去通到大马路。两头钻进山里的隧道；海边的镇（南边是海）南头是 ${FW.bridge} 像素高的斜拉跨海大桥。`);
  P('');
  P(`高速上的车：每个方向每 0.7–2 秒从隧道（或大桥那头）开出来一辆，大约 ${Math.round(FW.exit * 100)}% 会在出口下高速开进镇里；镇上新出发的车大约 ${Math.round(FW.leave * 100)}% 会开上匝道离开。车靠右行驶，前面慢就从左边超车；大约一半的车超完会回右边。梧桐镇是 I-${F.no}，出口 ${F.exit}。`);
  P(''); }
P('路口：两条大道（或大道和大马路）相交、或者街道整个穿过大道的地方有红绿灯（12 秒一轮）；其余路口小路那边有停车让行牌（车停 0.8 秒再走），两条小路相交就四个方向都停。乡间土路没有牌子。');

// v0.40: states and counties
P('### v0.40 州和县');
P('');
P(`每个镇都在一个县里，每个县在一个州（或者那个国家自己的一级行政区：省、府、大区……）。县决定：周围的地形、只有本县超市卖的特产、吃喝玩的物价（cost）、工资（wage）、警车；车牌按州。车、家具、房子、地的价钱全国一样（地价本来就按镇不同）。镇上除了你、朋友和家人，还有 ${D.TOWNSFOLK.residents} 个有名字的镇民，每栋楼柜台后面也是一个有名字的店员（名字按当地习惯取）。`);
P('');
table(['镇', '州 / 省', '县', '地形', '物价', '工资', '特产（美元，未乘物价）', '警车'], Object.entries(D.COUNTIES).map(([k, C]) => { const town = Object.entries(D.COMMUNITIES).find(([, c]) => c.county === k); const ST = D.STATES[C.state];
  return [town ? town[1].zh : '', `${ST.zh} (${ST.en})`, `${C.zh} (${C.en})`, `${D.TERRAINS[C.terrain].e} ${D.TERRAINS[C.terrain].zh}`, `×${C.cost}`, `×${C.wage}`, C.specials.map(f => `${D.SPECIALTIES[f].e} ${D.SPECIALTIES[f].zh} 🪙${D.SPECIALTIES[f].base_price || D.SPECIALTIES[f].price}`).join('、'), C.police.text]; }));
P('');
P(`特产：在本县的超市（或者坐火车来的 ${D.SPECIAL.visitH} 小时里）买；当场吃加饱腹和娱乐，带走的可以送人（关系额外 +${D.SPECIAL.giftUp}）或者按 ${D.SPECIAL.sellBack * 100}% 卖掉。一共 ${Object.keys(D.SPECIALTIES).length} 种，买过的记进收集。吃喝玩的价钱（店里、餐厅、酒吧、商场、保龄球……）= 美东基础价 × 所在县的物价；打工时薪 = 基础时薪 × 你住的县的工资。`);
P('');

// v0.41: the amusement park and four more minigames
P('### v0.41 游乐园和四个小游戏');
P('');
{ const V3 = D.VENUE, VG = D.VENUE_GAMES;
  table(['事情', '花多少（美东价，按县物价乘）', '多久', '得到'], [
    ['游乐园：摩天轮（你坐在车厢里转一圈）', `🪙${V3.wheel.base_price || V3.wheel.price}`, `${V3.wheel.sec} 秒`, `娱乐 +${V3.wheel.fun}`],
    ['游乐园：过山车', `🪙${V3.coaster.base_price || V3.coaster.price}`, `${V3.coaster.sec} 秒`, `娱乐 +${V3.coaster.fun}`],
    ['游乐园：旋转木马', `🪙${V3.carousel.base_price || V3.carousel.price}`, `${V3.carousel.sec} 秒`, `娱乐 +${V3.carousel.fun}`],
    ['游乐园：碰碰车', `🪙${V3.bumper.base_price || V3.bumper.price}`, `${V3.bumper.sec} 秒`, `娱乐 +${V3.bumper.fun}`],
    ['游乐园：棉花糖', `🪙${V3.candy.base_price || V3.candy.price}`, '马上', `饱腹 +${V3.candy.hunger}，娱乐 +${V3.candy.fun}`],
    [`迷你高尔夫（游乐园，${VG.golf.holes} 个洞，每洞最多 ${VG.golf.max} 杆，总杆数少的赢）`, `🪙${VG.golf.base_price || VG.golf.price} 一场`, '一局', '和公园球赛一样（今天第一局娱乐 +20、社交 +10、关系 +4）'],
    ['卡拉OK（游乐园的小舞台，你唱前半首、对方唱后半首，点得准的赢）', '免费', '一首', '同上'],
    [`抓娃娃（保龄球馆和商场，每人 ${VG.claw.grabs} 次，抓得多的赢；抓到的娃娃归你）`, `🪙${VG.claw.base_price || VG.claw.price} 一局`, '一局', '同上，加上抓到的娃娃（集齐 6 个送超大泰迪熊）'],
    [`钓鱼比赛（湖边，${VG.fishing.secs} 秒，钓上来的鱼总重最多的赢）`, '免费', `${VG.fishing.secs} 秒`, '同上，加上钓到的鱼（每条一份「鱼」进仓库）'],
  ]);
  P('');
  table(['钓鱼比赛里会上钩的', '几率', '重量'], D.CONTEST_FISH.map(F => [`${F.e} ${F.zh} (${F.en})`, Math.round(F.p * 100) + '%', F.kg[1] ? `${F.kg[0]}–${F.kg[1]} kg（甩得越远越大）` : '0']));
  P('');
  P(`卡拉OK的歌（古老的儿歌，谁都可以唱）：${D.SONGS.map(g => `${g.e} ${g.zh} (${g.en})`).join('、')}。`);
  P(''); }

// v0.48: homes abroad in their local style
P('### v0.54 体育联赛和竞猜');
P('');
P(`每季 ${D.SEASON.days} 天（一天一轮）+ 休 ${D.SEASON.rest} 天；Elo 起点 ${D.SEASON.start}，K = ${D.SEASON.k}；真实实力约在起点 ± ${D.SEASON.spread * 3} 之间。竞猜：押 ${D.BETS.chips.join(' / ')}，每天最多 ${D.BETS.dayMax}，赔率 = (1 − ${D.BETS.margin}) ÷ 胜率（最低 ${D.BETS.minOdds}）。`);
P('');
table(['运动', '开赛', '时长（小时）', '球队'], Object.values(D.LEAGUES).map(L => [`${L.e} ${L.zh}`, `${L.hour}:00`, L.len, L.teams.map(T => `${T.e}${T.zh}`).join('、')]));
P('');
P('### v0.52 社区分区');
P('');
P('每条街一个分区。地块数是每块 4 × 14 格；「最多」是你的家在这条街上最多能扩到几块；地价倍数乘在买地和搬家的价钱上。');
P('');
table(['分区', '人家的地', '最多', '地价', '住的房子'], Object.values(D.ZONES).map(Z => [`${Z.e} ${Z.zh}`, `${Z.lot[0]}–${Z.lot[1]} 块`, `${Z.max} 块`, `×${Z.price}`, [...new Set(Z.houses)].map(id => (D.HOUSES.find(H => H.id === id) || { zh: id }).zh).join('、')]));
P('');
table(['房子', '要几块地'], Object.entries(D.HOUSE_LOT).map(([id, n]) => [(D.HOUSES.find(H => H.id === id) || { zh: id }).zh, n]));
P('');
P('### v0.51 对话的时间');
P('');
P(`头上的对话每句停留 ${D.TALK.base} 秒 + 字数 × ${D.TALK.perChar.zh} 秒（英文 ${D.TALK.perChar.en}），在 ${D.TALK.min}–${D.TALK.max} 秒之间，句与句之间停 ${D.TALK.gap} 秒。手机里打字后对方 ${D.TALK.reply[0]}–${D.TALK.reply[1]} 秒回复；邀请好友玩小游戏 ${D.TALK.inviteReply[0]}–${D.TALK.inviteReply[1]} 秒回复，答应后 ${D.TALK.inviteKeep} 小时内有效；不在线的 ${D.TALK.offlineReply} 分钟后回复。`);
P('');
P('### v0.50 做事要花的时间');
P('');
P('走过去以后，头顶一个进度条走满才算做完（吃完、看完、买好）；中途走开就不算，也不扣钱。有自己时长的（健身、游乐设施、展品、公园）还按原来的 `sec`。');
P('');
{ const ZH = { pick: '从货架拿进购物篮', buy: '在柜台买东西（花、纪念品、药、玩偶、酒店房间）', groceries: '装一袋生鲜', pay: '收银台付钱（保释金也是）', sign: '签贷款 / 工作 / 报课', ticket: '买电影票', order: '在柜台或小吃摊点餐（然后坐下吃）', meal: '吃一顿饭（美食广场）', snack: '吃小吃（面包、咖啡、热狗）', special: '当场吃本地特产', take: '特产打包带走', er: '急诊', bake: '烤面包', help: '帮忙收麦子', fish: '在码头钓鱼', read: '在图书馆读今天的书', card: '写明信片寄出', check: '体检', look: '参观（消防车）', cook: '在家做饭', harvest: '收菜', plant: '种菜', animal: '收动物产品', tree: '摘果子', yard: '收院子里的东西', trough: '加饲料' };
  table(['事情', '秒'], Object.entries(D.DO_SECS).map(([k, v]) => [ZH[k] || k, v])); }
P('');
P(`坏天气（大雨、暴风雨、下雪）时暂停的室外活动：地点 ${D.OUTDOOR.places.join('、')}；设施 ${D.OUTDOOR.venues.join('、')}；小游戏 ${D.OUTDOOR.games.join('、')}。室内照常；自己的农场不停（不然菜会坏）。`);
P('');
P('### v0.48 各国的房子');
P('');
P('别人的家在美国以外的镇上，按当地的样式画（大小和层数不变；你自己的家不变；帐篷还是帐篷）。');
P('');
{ const FOLK = { kr: '韩国', jp: '日本', cn: '中国', nl: '荷兰', no: '挪威', fr: '法国', uk: '英国', za: '南非', au: '澳大利亚', co: '哥伦比亚', br: '巴西', ca: '加拿大' };
  table(['国家', '样式'], Object.entries(D.LOCAL_HOMES).map(([k, L]) => [FOLK[k] || k, L.map(h => `${h.zh} (${h.en})`).join('、')])); }
P('');
// v0.47: traffic
P('### v0.47 交通：车速、红绿灯、高峰、断头路');
P('');
table(['车', '速度（和同一条路上的车流比）'], Object.entries(D.CAR_PACE).map(([k, v]) => [D.CARS[k] ? `${D.CARS[k].zh} (${D.CARS[k].en})` : k, '×' + v]));
P('你自己的车也一样：开跑车比开普通轿车早到。');
P('');
{ const S = D.SIG, half = S.go + S.amber + S.arrow + S.arrowAmber;
  table(['红绿灯', '秒'], [
    ['一条路直行和右转绿灯', `${S.go}（右转晚 ${S.rightWait} 秒起步，先让直行）`], ['黄灯', S.amber], ['左转绿箭头', `${S.arrow}（掉头再晚 ${S.uWait} 秒）`], ['左转黄箭头', S.arrowAmber],
    ['一条路一轮', half], ['两条路一整轮', half * 2],
    ['停车场出口：路上的车走', S.lotRoad], ['停车场出口：黄灯', S.lotAmber], ['停车场出口：车出来', S.lotOut]]); }
table(['高峰', '数值'], [['时间（镇上的钟）', D.RUSH.hours.map(([a, b]) => `${Math.floor(a)}:${String(Math.round(a % 1 * 60)).padStart(2, '0')}–${Math.floor(b)}:${String(Math.round(b % 1 * 60)).padStart(2, '0')}`).join('、')], ['镇上最多几辆车', `高峰 ${D.RUSH.cars}，平时 ${D.RUSH.calm}`]]);
table(['断头路整理', '数值'], [['多伸出去的一小截（剪掉）', `≤ ${D.TIDY.stub} 格`], ['差一点没接上（接上）', `≤ ${D.TIDY.gap} 格`], ['一直往前接到别的路或镇外', `≤ ${D.TIDY.straight} 格，路上没有东西`], ['拐一个弯接上的小路（单行）', `往前 ≤ ${D.TIDY.turnMax} 格再拐，小路 ≤ ${D.TIDY.laneMax} 格，宽 ${D.TIDY.lane} 格`], ['都不行', '路尽头修成回车场（能掉头的圆形）']]);
P('');
// v0.46: farmland one plot at a time
P('### v0.46 菜地一块一块买');
P('');
P(`开局 ${D.FIELD_LEVELS[0]} 块，之后一块一块买，每块比上一块贵 ${Math.round((D.PLOT.grow - 1) * 100)}%，最多 ${D.PLOT.max} 块。买的地自动放在菜地旁边（一排一排从左到右），在「设计」里每块都能单独拖到院子里别的空地。朋友家还是原来 4×4 的菜地。`);
P('');
{ const rows = []; let sum = 0; for (let n = D.FIELD_LEVELS[0]; n < D.PLOT.max; n++) { sum += D.plotCost(n); rows.push([`第 ${n + 1} 块`, '🪙' + D.plotCost(n), '🪙' + sum]); }
  table(['买第几块', '这块的价钱', '从开局算一共'], rows); }
P('');
// v0.45: shops and places: what each place gives you, giving to the museum, the furniture store's floors
P('### v0.45 每个设施能得到什么、博物馆捐款、家具店三层');
P('');
table(['地方', '得到什么'], [
  ['🏨 酒店', `订一晚（🪙${D.VENUE.room.price}），上楼在大床上躺一下：饱腹、社交、娱乐一下全满，今天一整天心情好（打工 +${Math.round(D.NEEDS.moodPay * 100)}%、走路 ×${D.NEED_LOW.fastWalk}）`],
  ['🏊 游泳馆 / 酒店屋顶泳池', `游一次泳或比一场游泳：今天走路再快 ${Math.round(D.PERKS.swimWalk * 100)}%（和心情好的加成相乘）`],
  ['🏛️ 博物馆', `每个展厅每天看一次长 1 点知识（四个展厅：恐龙、太空、艺术、历史）；每 ${D.PERKS.knowEvery} 点知识打工工资 +${Math.round(D.PERKS.knowPay * 100)}%，最多 +${Math.round(D.PERKS.knowMax * 100)}%`],
  ['🏥 医院急诊', `生病了 🪙${D.PERKS.er} 马上治好（诊所的药 🪙${D.SICK.medicine}，吃了还要躺下休息）`],
]);
table(['博物馆捐款', '数值'], [
  ['每次能捐', D.MUSEUM_GIFT.amounts.map(n => '🪙' + n).join(' / ') + `，每次娱乐 +${D.MUSEUM_GIFT.fun}`],
  ...D.MUSEUM_GIFT.tiers.map(T => [`${T.e} ${T.zh}`, `累计捐满 🪙${T.at}` + (T.statue ? '，一楼立起你的雕像（金色，按你的长相）' : '，名字上捐赠墙')]),
]);
table(['家具店', '卖什么'], D.FURN_FLOORS.map((F, i) => [`${i + 1}F ${F.zh}`, F.subs.map(id => { const g = (D.SHOP_SUBS.furn || []).find(x => x.id === id); return g ? `${g.e} ${g.zh}` : id; }).join('、')]));
P('');
// v0.44: money only, the farm keeps, feed, the needs
P('### v0.44 只用钱、会坏的农场、饲料、需求的后果');
P('');
table(['规则', '数值'], [
  ['木头', `不用了：以前要木头的东西每块木头折 🪙${D.WOOD_USD}（房子只贵一点点），现实奖励不再给木头；旧存档的木头按 🪙${D.WOOD_USD} 一块换成钱`],
  ['每天农活次数', '不限（偷菜还是每天最多 8 次）'],
  ['熟了的菜', `放 ${D.FRESH.crop} 小时不收就烂在地里，收不到东西，要清理`],
  ['蛋、奶、毛、水果、蜂蜜', `好了 ${D.FRESH.prod} 小时不收就坏掉没了，从头等下一次（小宝宝不会坏）`],
  ['快坏提醒', `最后 ${Math.round(D.FRESH.warn * 100)}% 的时间头上出现 ⏰`],
  ['饲料', `牲畜用品店一袋 🪙${D.FEED.price}，${D.FEED.n} 份；每只牲畜每产一次吃 1 份；食槽最多 ${D.FEED.trough} 份，点食槽放进去；食槽空了就不产；新的和旧的农场都先送 ${D.FEED.start} 份`],
  ['饿了', `饱腹低于 ${D.NEED_LOW.low}：走路 ×${D.NEED_LOW.slowWalk}，不能上班、不能玩比赛和小游戏`],
  ['心情差', `三项平均低于 ${D.NEED_LOW.badMood}：打工工资 −${Math.round(D.NEED_LOW.badPay * 100)}%`],
  ['心情好', `三项平均 ${D.NEEDS.goodMood} 以上：打工工资 +${Math.round(D.NEEDS.moodPay * 100)}%，走路 ×${D.NEED_LOW.fastWalk}`],
]);
P('');
// v0.42: the zoo, the stadium, a home run derby
P('### v0.42 动物园、体育场、本垒打大赛');
P('');
{ const V3 = D.VENUE, VG = D.VENUE_GAMES, pr = k => V3[k].base_price || V3[k].price;
  table(['事情', '花多少（美东价，按县物价乘）', '多久', '得到'], [
    [`动物园：看每种动物（${Object.values(D.ZOO_ANIMALS).map(a => a.e + a.zh).join('、')}），每种一天一次，牌子上一天一个冷知识`, '免费', `${V3.zv_lion.sec} 秒`, `娱乐 +${V3.zv_lion.fun}`],
    ['动物园：喂长颈鹿（站上高台递生菜）', `🪙${pr('giraffefeed')}`, `${V3.giraffefeed.sec} 秒`, `娱乐 +${V3.giraffefeed.fun}`],
    ['动物园：小动物农场（一天一次）', '免费', `${V3.petting.sec} 秒`, `娱乐 +${V3.petting.fun}`],
    [`动物园纪念品店：动物玩偶（${D.ZOO_SHOP.map(k => D.FURN[k].zh).join('、')}）`, `🪙${pr('zooplush')} 一个`, '马上', '放进仓库，能摆在家里'],
    ['体育场：买票看比赛（坐在看台上）', `🪙${pr('match')}`, `${V3.match.sec} 秒`, `娱乐 +${V3.match.fun}`],
    ['体育场：没比赛时在空球场转一圈（一天一次）', '免费', `${V3.tour.sec} 秒`, `娱乐 +${V3.tour.fun}`],
    ['体育场：热狗', `🪙${pr('hotdog')}`, '马上', `饱腹 +${V3.hotdog.hunger}，娱乐 +${V3.hotdog.fun}`],
    [`本垒打大赛（体育场击球笼，每人 ${VG.derby.pitches} 球，本垒打多的赢，一样多比最远的一球）`, `🪙${VG.derby.base_price || VG.derby.price} 一桶球`, '约 70 秒', '和公园球赛一样（今天第一局娱乐 +20、社交 +10、关系 +4）'],
  ]);
  P('');
  P('比赛（v0.59 起）：10 个球队城市每城 5 支队，只打本城的主场比赛：体育场打橄榄球、足球、棒球，室内体育馆打冰球、篮球；小镇没有职业队。每个城市的体育场：' + Object.keys(D.STADIUM_LOOK).map(k => `${D.COMMUNITIES[k].zh}「${D.STADIUM_LOOK[k].zh}」（${D.STADIUM_LOOK[k].tag.zh}）`).join('、') + '。每个镇的球队：');
  P('');
  table(['镇', '球队'], Object.keys(D.COMMUNITIES).map(id => { const c = D.COMMUNITIES[id], ts = Object.keys(D.LEAGUES).map(sp => { const T = D.LEAGUES[sp].teams.find(x => x.t === id); return T ? `${D.LEAGUES[sp].e} ${T.e} ${c.zh}${T.zh}` : null; }).filter(Boolean); return [c.zh, ts.join('，') || '—']; }));
  P(''); }
P('');
P('## 手机：银行、贷款、股票（v0.26，v0.35 改成真实的银行）');
P('');
table(['项目', '数值'], [['存款利息', `年利率 ${+(D.BANK.rate * 100).toFixed(2)}%`],
  ['车贷', `首付 ${D.BANK.down.car * 100}%，${D.BANK.car.years} 年，年利率 ${+(D.BANK.car.apr * 100).toFixed(2)}%，每天等额还款`], ['房贷', `首付 ${D.BANK.down.house * 100}%，${D.BANK.house.years} 年，年利率 ${+(D.BANK.house.apr * 100).toFixed(2)}%，每天等额还款`],
  ['审批', `所有贷款每天还的钱 ≤ 最近 7 天平均每天收入的 ${D.BANK.dti * 100}%`], ['同时最多', `${D.BANK.maxLoans} 笔`],
  ['股价', `每 ${D.STOCK.tickMin} 分钟一跳，买卖各收 ${D.STOCK.fee * 100}% 手续费`]]);
table(['公司', '起始价'], Object.values(D.STOCKS).map(c => [`${c.e} ${c.zh} (${c.en})`, `🪙${c.base}`]));
P('## 状态：饱腹、社交、娱乐（v0.25）');
P('');
P(`精力还是来自现实睡眠。另外三条随真实时间慢慢下降，最低停在 ${D.NEEDS.floor}，不会扣任何东西；三条平均 ${D.NEEDS.goodMood} 以上「心情好」，打工工资 +${D.NEEDS.moodPay * 100}%。`);
P('');
table(['状态', '从 100 降到 0 大约', '怎么补'], [['🍔 饱腹', `${D.NEEDS.hunger.hours} 小时`, `美食广场 +${D.FOOD_FILL.boba}～+${D.FOOD_FILL.pizza}，咖啡馆 / 面包店买吃的 🪙${D.SNACK.price} +${D.FOOD_FILL.snack}，在家做饭（灶台或厨房 + 仓库 2 样东西）+${D.FOOD_FILL.cook}`],
  ['💬 社交', `${D.NEEDS.social.hours} 小时`, `聊天 +${D.NEED_GAIN.chat}（每人每天一次），和老板 +${D.NEED_GAIN.boss}、同事 +${D.NEED_GAIN.mate}，去朋友家 +${D.NEED_GAIN.visit}，写信 / 明信片 +${D.NEED_GAIN.letter}，看电影 +${D.NEED_GAIN.movieSocial}`],
  ['🎉 娱乐', `${D.NEEDS.fun.hours} 小时`, `看电影 +${D.NEED_GAIN.movie}，绕公园走一圈 +${D.NEED_GAIN.stroll}，抓娃娃 +${D.NEED_GAIN.claw}，奶茶 / 冰淇淋 +${D.NEED_GAIN.sweetFun}，做饭 +${D.NEED_GAIN.cookFun}`]]);
table(['聊天对象', '工作关系'], [['老板', '+3（升职更快）'], ['同事', '+1'], ['邻居 / 朋友', '熟悉度 +5']]);
P('## 车道（v0.24）');
P('');
table(['车道', '大小', '停几辆', '价格'], Object.values(D.DRIVES).map(d => [d.zh, `${d.w} × ${d.d}`, d.cap, d.cost ? `🪙${d.cost}` : '免费']));
P('## 夜校（v0.22）');
P('');
table(['项目', '数值'], [['一节课', `🪙${D.SCHOOL.fee}，每天一节`], ['证书', `每 ${D.SCHOOL.perCert} 节一张，最多 ${D.SCHOOL.maxCerts} 张`], ['每张证书', `所有工作工资 +${D.SCHOOL.certPay * 100}%`]]);
P('## 车库（v0.19）');
P('');
table(['车库', '样子', '车位', '价格'], D.GARAGE.slice(1).map((g, i) => [`Lv${i + 1}`, g.zh, g.cap, `🪙${g.cost.coins}`]));
P('## 警察（v0.18）');
P('');
table(['项目', '数值'], [['没有狗时被邻居看见的概率', `${D.POLICE.witness * 100}%`], ['几天内被抓几次警察会来', `${D.POLICE.strikeDays} 天 ${D.POLICE.strikes} 次（偷小动物被抓直接来）`],
  ['警察罚款', `东西价值 ×${D.POLICE.fineMult}，🪙${D.POLICE.fineMin}–${D.POLICE.fineMax}`], ['拘留', `${D.POLICE.jailMin} 分钟`], ['保释金', `🪙${D.POLICE.bail}`]]);
P('## 购物中心（v0.18）');
P('');
table(['项目', '价格'], [['🎬 电影（' + Object.values(D.MALL.movies).map(m => m.zh).join('、') + '）', `🪙${D.MALL.movie}`], ['🕹️ 抓娃娃（约 ' + Math.round(D.MALL.clawWin * 100) + '% 抓到）', `🪙${D.MALL.claw}`],
  ...Object.values(D.MALL.foods).map(f => [`${f.e} ${f.zh}`, `🪙${f.price}`])]);
P('## 市场、天气、打工、生病（v0.14）');
P('');
table(['项目', '数值'], [
  ['收购价', `每 ${D.MARKET.slotHours} 小时变一次，平时价的 ${D.MARKET.min}–${D.MARKET.max} 倍，抖动 ±${D.MARKET.jitter / 2}`],
  ['占地方', `货 1 格，小崽子 ${D.BABY_SIZE} 格，活牲畜：${Object.entries(D.ANIMAL_SIZE).map(([k, n]) => (D.ANIMALS[k] || {}).zh + ' ' + n).join('、')}`],
  ['下雨', `菜长得快 ${D.WEATHER_FARM.rainGrow * 100}%`], ['大雨 / 暴风雨', `每块地每小时 ${D.WEATHER_FARM.flood.heavy * 100}% / ${D.WEATHER_FARM.flood.storm * 100}% 被淹，淹 ${D.WEATHER_FARM.floodHours} 小时，成熟的每 ${D.WEATHER_FARM.rotHours} 小时烂一份`],
  ['下雪', `长得慢 ${D.WEATHER_FARM.snowSlow * 100}%，湖面结冰`],
  ['老板关系', `做满一班 +${D.JOB_REL.finish}，提前下班 ${D.JOB_REL.quit}，最高 ${D.JOB_REL.max}`],
  ['生病', `每天 ${D.SICK.base * 100}%（连续上班 ${D.SICK.overworkDays} 天 +${D.SICK.overwork * 100}%，睡眠 < ${D.SICK.lowSleepScore} +${D.SICK.lowSleep * 100}%）；走路 ×${D.SICK.walk}，现实奖励 ×${D.SICK.earn}；药 🪙${D.SICK.medicine}，吃药后躺 ${D.SICK.restSec} 秒；不吃药 ${D.SICK.days} 天好`],
]);
table(['工作', '时薪', '时间'], Object.values(D.JOBS).map(j => [j.zh, `🪙${j.wage}`, `${j.from}:00–${j.to}:00`]));
table(['职位', '关系', '工资倍数'], D.JOB_RANKS.map(r => [r.zh, r.at, `×${r.pay}`]));

P('## 小镇格局（v0.12）');
P('');
const LAYOUT_ZH = { grid: '美式街区', canal: '运河村', coast: '海边小镇', river: '河畔小镇', valley: '山谷峡湾', terrace: '山坡梯田', square: '老城广场', harbour: '海港' };
table(['格局', '街道', '用这个格局的社区'], Object.entries(D.LAYOUTS).map(([id, L]) => [LAYOUT_ZH[id] + ' (' + id + ')', Object.values(L.streets).map(s => s.zh).join('、'),
  Object.entries(D.COMMUNITY_LAYOUT).filter(([, v]) => v.split('|')[0] === id).map(([k, v]) => D.COMMUNITIES[k].zh + (v.endsWith('|f') ? '（镜像）' : '')).join('、')]));
P('## 出门和公共设施（v0.12）');
P('');
table(['项目', '数值'], [
  ['走路 / 自行车 / 开车', `每秒 ${D.TRIP_SPEED.walk} / ${D.TRIP_SPEED.bike} / ${D.TRIP_SPEED.car} 格（演示加速）`],
  ['公共麦田', `每天帮忙一次，用 1 件农活，得 ${D.HELP_HARVEST.wheat} 束小麦；全镇凑满 ${D.HARVEST_GOAL} 次开丰收节，帮过忙的人得 1 个面包`],
  ['面包店', `${D.BREAD.wheat} 束小麦烤 1 个面包`], ['湖边 / 海滩钓鱼', `每天一次，用 1 件农活，钓到 ${D.LAKE_FISH} 条`],
  ['图书馆', `每天一张小知识卡，共 ${D.LIB_CARDS.length} 张轮流`], ['邮局', '每天给每个朋友寄一张明信片'],
]);
table(['地方', '英文'], Object.values(D.PLACE_INFO).map(p => [`${p.e} ${p.zh}`, p.en]));
P('## Apple Watch 式奖章（v0.12，' + Object.keys(D.AWARDS).length + ' 个，每个解锁一座奖章雕塑）');
P('');
table(['奖章', '怎么得到'], Object.values(D.AWARDS).map(A => [`${A.e} ${A.zh}`, A.desc.zh]));
P(`另外每种运动拿到金奖杯（${D.SPORTS.length} 种），解锁这项运动的金像。`);
P('');
P('## 在线、做客、显示上限（v0.11）');
P('');
table(['项目', '数值'], [
  ['小镇里同时出门走路的人', `最多 ${D.SHOW_LIMITS.town} 个`], ['一个家的院子里画出的客人', `最多 ${D.SHOW_LIMITS.home} 个`], ['屋里画出的客人', `最多 ${D.SHOW_LIMITS.room} 个`],
  ['在线（模拟）', `朋友 ${Math.round(D.ONLINE_SHARE.friend * 100)}%、其他人 ${Math.round(D.ONLINE_SHARE.other * 100)}% 的时间；当地 23:30–6:30 几乎不在线`],
  ['在线的人去邻居家串门', `${Math.round(D.VISIT_SHARE * 100)}%（每 15 分钟换一次）`], ['问主人能不能坐（模拟）', `${Math.round(D.ASK_YES * 100)}% 答应，这次做客都有效`],
]);
table(['社区', '地方', '时区'], Object.values(D.COMMUNITIES).map(c => [`${c.zh} (${c.en})`, c.place.zh, c.tz || '—']));

P('## 庭院（' + Object.keys(D.YARD).length + ' 件）');
P('');
table(['装饰', '占地', '价格', '产出'], Object.values(D.YARD).map(y => [
  `${y.zh} (${y.en})`, `${y.w}×${y.d}`, `🪙${y.price}`, y.prod ? `${good(y.prod)} ×${y.n} / ${y.every} 分钟` : '']));

P('## 载具（' + Object.keys(D.CARS).length + ' 种）');
P('');
table(['载具', '价格', '类型', '一次拉货'], Object.values(D.CARS).map(c => [`${c.zh} (${c.en})`, cost(c.cost), c.kind === 'two' ? '两轮' : '汽车 / 特种', (c.cargo || '—') + ' 件']));
P(`走路一次只能拿 ${D.WALK_CARRY} 件。`);
P('');

P('## 现实奖励');
P('');
P('### 精力和倍率');
P('');
const EN = { great: '满格', good: '不错', tired: '有点累', exhausted: '很累' };
table(['精力', '最低分', '运动奖励倍率'], D.ENERGY_LEVELS.map(e => [EN[e.id], e.min, `×${e.mult}`]));
P('### 奖励（倍率 ×1.0 时）');
P('');
table(['现实里做到', '奖励', '受精力倍率影响'], [
  [`每走到自己目标的 1/6（目标 ${D.STEP_GOAL.toLocaleString()} 时 = 1,000 步；轮椅推动也算），最多 ${D.STEP_BLOCKS_MAX} 次`, cost(D.STEP_REWARD), '是'],
  ['走到自己的步数目标', cost(D.GOAL_REWARD) + ' + 南瓜种子', '是'],
  [`合上活动环（${D.RINGS.move} 千卡）`, cost(D.RING_REWARD.move), '是'],
  [`合上锻炼环（${D.RINGS.exercise} 分钟）`, cost(D.RING_REWARD.exercise), '是'],
  [`合上站立环（${D.RINGS.stand} 小时）`, cost(D.RING_REWARD.stand), '是'],
  ['三环全合上（额外）', cost(D.RING_REWARD.all) + ' + 玫瑰种子', '是'],
  ['每次 10 分钟以上体能训练', `每分钟 🪙${D.WORKOUT_PAY}（每天最多算 ${D.WORKOUT_PAY_MAX} 分钟）`, '是'],
  ['正念 / 呼吸练习', `每分钟 🪙${D.MINDFUL_REWARD}（每天最多 10 分钟），精力 +1`, '否'],
  ['睡眠分 80+', cost(D.SLEEP_REWARD) + ' + 郁金香种子', '否'],
  ...Object.entries(D.FOCUS_REWARD).map(([m, r]) => [`离线 ${m} 分钟`, cost(r) + (r.seeds ? ' + 向日葵种子' : ''), '否']),
]);
P('### 运动类型（迷你的你会同步做的动作，模拟时每分钟消耗的千卡）');
P('');
table(['运动', '每分钟千卡'], Object.values(D.WORKOUTS).map(w => [`${w.e} ${w.zh} (${w.en})`, w.kcal]));
// v0.35: dollar amounts with thousands separators (🪙450000 → 🪙450,000)
fs.writeFileSync(path.join(__dirname, '数值表.md'), out.join('\n').replace(/🪙(\d{4,})/g, (m, d) => '🪙' + Number(d).toLocaleString('en-US')) + '\n');
console.log('docs/数值表.md 已更新');
