// Turns the game catalog (prototype/js/data.js) into markdown tables for docs/数值表.md
const fs = require('fs'), vm = require('vm');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'prototype', 'js', 'data.js'), 'utf8');
const D = vm.runInNewContext(src + `;({VERSION, CROPS, TREES, ANIMALS, GOODS, FIELD_LEVELS, FIELD_COST, PASTURE, ORCHARD, POND, FISH_KINDS, FISH_EVERY,
  HOUSES, FURN, YARD, CARS, FOCUS_REWARD, ENERGY_LEVELS, STEP_REWARD, GOAL_REWARD, RINGS, RING_REWARD, SLEEP_REWARD, MINDFUL_REWARD,
  WORKOUTS, ACTION_CAP, STEAL_CAP, STEP_GOAL, LOT_W, LOT_D, AREA, MAILBOX, TOWN_LEVELS, FLOOR_BUILD, FLOOR_H, SOUVENIRS,
  STEP_BLOCKS_MAX, STEP_GOAL_RANGE, WORKOUT_PAY_MAX, WORKOUT_PAY, ROOM_WALLS, FLOORS, STREETS, NEIGHBORHOODS, LAND, PARCEL, NPC_LOTS, START_LOTS,
  PET_BREEDS, PET_MAX, PET_NEEDS, PET_REMIND, PET_LOVE, PET_FOOD, PET_START_FOOD, TROPHY_TIERS, STREAK_TROPHIES, SPORT_TIERS, SPORT_GROUPS, SPORTS, EXCLUSIVES, COMMUNITIES, SHOW_LIMITS, ONLINE_SHARE, VISIT_SHARE, ASK_YES, LAYOUTS, COMMUNITY_LAYOUT, TRIP_SPEED, PLACE_INFO, HARVEST_GOAL, HELP_HARVEST, BREAD, LAKE_FISH, LIB_CARDS, AWARDS, AWARD_RULES, WALK_CARRY, MARKET, ANIMAL_SIZE, BABY_SIZE, WEATHER_FARM, JOBS, JOB_RANKS, JOB_REL, SICK, STORES, BODY_TYPES, CLOTHES, POLICE, MALL, GARAGE, HANDS_VOL, BIG_VOL, DELIVERY, SCHOOL, DRIVES, NEEDS, FOOD_FILL, NEED_GAIN, SNACK, BANK, STOCKS, STOCK, VENUE, VENUE_PLACES, REL_LEVELS, REL_START, TRAITS, INTERESTS, SOCIAL_CATS, SOCIALS, SOCIAL, PARK, BALL_GAMES, BALL})`);
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
P(`每加盖一层：🪙 = 室内格数 × ${D.FLOOR_BUILD.coinsPerTile}（取整到 50），🪵 = 室内格数 × ${D.FLOOR_BUILD.woodPerTile}；每多一层再 ×${D.FLOOR_BUILD.grow}。外面看房子每层高 ${D.FLOOR_H} 像素（中式庭院加盖是楼阁的一层）。每层是独立房间：自己的墙纸、地板、家具。`);
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
table(['车库', '样子', '车位', '价格'], D.GARAGE.slice(1).map((g, i) => [`Lv${i + 1}`, g.zh, g.cap, `🪙${g.cost.coins} + 🪵${g.cost.wood}`]));
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
  ['每次 10 分钟以上体能训练', `每分钟 🪙${D.WORKOUT_PAY}，每 10 分钟 🪵1（每天最多算 ${D.WORKOUT_PAY_MAX} 分钟）`, '是'],
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
