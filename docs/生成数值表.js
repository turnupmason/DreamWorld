// Turns the game catalog (prototype/js/data.js) into markdown tables for docs/数值表.md
const fs = require('fs'), vm = require('vm');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'prototype', 'js', 'data.js'), 'utf8');
const D = vm.runInNewContext(src + `;({VERSION, CROPS, TREES, ANIMALS, GOODS, FIELD_LEVELS, FIELD_COST, PASTURE, ORCHARD, POND, FISH_KINDS, FISH_EVERY,
  HOUSES, FURN, YARD, CARS, FOCUS_REWARD, ENERGY_LEVELS, STEP_REWARD, GOAL_REWARD, RINGS, RING_REWARD, SLEEP_REWARD, MINDFUL_REWARD,
  WORKOUTS, ACTION_CAP, STEAL_CAP, STEP_GOAL, LOT_W, LOT_D, AREA, MAILBOX, TOWN_LEVELS, FLOOR_BUILD, FLOOR_H, SOUVENIRS,
  STEP_BLOCKS_MAX, STEP_GOAL_RANGE, WORKOUT_PAY_MAX, ROOM_WALLS, FLOORS, STREETS, NEIGHBORHOODS, LAND, PARCEL, NPC_LOTS, START_LOTS,
  PET_BREEDS, PET_MAX, PET_NEEDS, PET_REMIND, PET_LOVE, PET_FOOD, PET_START_FOOD})`);
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

P('## 庭院（' + Object.keys(D.YARD).length + ' 件）');
P('');
table(['装饰', '占地', '价格', '产出'], Object.values(D.YARD).map(y => [
  `${y.zh} (${y.en})`, `${y.w}×${y.d}`, `🪙${y.price}`, y.prod ? `${good(y.prod)} ×${y.n} / ${y.every} 分钟` : '']));

P('## 载具（' + Object.keys(D.CARS).length + ' 种）');
P('');
table(['载具', '价格', '类型'], Object.values(D.CARS).map(c => [`${c.zh} (${c.en})`, cost(c.cost), c.kind === 'two' ? '两轮' : '汽车 / 特种']));

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
  ['每次 10 分钟以上体能训练', `每分钟 🪙1.2，每 10 分钟 🪵1（每天最多算 ${D.WORKOUT_PAY_MAX} 分钟）`, '是'],
  ['正念 / 呼吸练习', `每分钟 🪙${D.MINDFUL_REWARD}（每天最多 10 分钟），精力 +1`, '否'],
  ['睡眠分 80+', cost(D.SLEEP_REWARD) + ' + 郁金香种子', '否'],
  ...Object.entries(D.FOCUS_REWARD).map(([m, r]) => [`离线 ${m} 分钟`, cost(r) + (r.seeds ? ' + 向日葵种子' : ''), '否']),
]);
P('### 运动类型（迷你的你会同步做的动作，模拟时每分钟消耗的千卡）');
P('');
table(['运动', '每分钟千卡'], Object.values(D.WORKOUTS).map(w => [`${w.e} ${w.zh} (${w.en})`, w.kcal]));
fs.writeFileSync(path.join(__dirname, '数值表.md'), out.join('\n') + '\n');
console.log('docs/数值表.md 已更新');
