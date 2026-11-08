'use strict';
// UI text in Chinese and English, plus number/time formatting. t('key', {var}) fills {var} placeholders.

const STR = {
  zh: {
    app_name: '镜像小镇', now: '现在', default_name: '镇民', free: '免费', next: '下一步', done: '完成', cancel: '取消',
    tagline: '现实里睡好、多动、少刷手机，小镇里那个迷你的你，你的家和整条街都会越来越好。',
    ob_p0: '昨晚睡得好，小人今天就精神，运动奖励也更多', ob_p1: '走路、三环、体能训练都会变成金币和木材', ob_p2: '少刷短视频，离线越久奖励越多',
    ob_p3: '种地养殖、盖房买车、布置家，和朋友住在同一条街上', ob_start: '开始', ob_you: '设计你的镇民', ob_name_ph: '你的名字',
    ob_shirt: '衣服', ob_skin: '肤色', ob_hair: '发型', ob_hair_col: '发色', ob_mob: '出行',
    hair_short: '短发', hair_long: '长发', hair_bun: '丸子头', hair_curly: '卷发', mob_walk: '步行', mob_wheel: '轮椅',
    ob_look_note: '外观完全由你决定，和健康数据无关。精力只会改变表情和动作。',
    ob_apps: '哪些 App 让你分心？', ob_apps_desc: '只计算你选的 App。正式版里这一步用的是 iPhone 系统自带的 App 选择器，我们看不到你具体选了什么。',
    ob_limit: '每天希望最多刷多久', ob_health: '正式版会请求读取 Apple 健康：步数、睡眠、活动圆环、体能训练、正念、心率。Oura、Whoop、Apple Watch 写进健康 App 的数据都能用。',
    ob_privacy: '这些数据只留在你的手机上，朋友看不到具体数字。', ob_move_in: '入住小镇',
    tab_home: '家', tab_town: '小镇', tab_shop: '商店', tab_real: '健康', tab_feed: '动态',
    energy_great: '活力满满', energy_good: '精神不错', energy_tired: '有点累', energy_exhausted: '很累',
    sleep_short: '睡眠 {n}', cap_title: '今日农活次数（种菜、偷东西）', to_collect: '待领取',
    hint_text: '点哪里小人就走到哪里。点熟了的菜、下了蛋的鸡、结果的树，小人会走过去蹲下收。点房子进屋，拖动看看周围，双指缩放。', hint_ok: '知道了',
    // scene
    expand_field: '扩建菜地', build_pasture: '建牧场', build_orchard: '建果园', build_pond: '挖鱼塘',
    home_of: '{name}的家', empty_lot: '空地 · 邀请朋友', street_name: '梧桐街',
    ctx_rank: '第 {n} 名 · 家产 🪙{v}', ctx_inside: '{house} · 室内', ctx_town: '{street} Lv{lv} · 🏡{h} 户 · 家产 🪙{v}',
    ctx_edit_room: '设计室内：按住拖动家具，点一下换颜色', ctx_edit_yard: '设计院子：按住拖动东西和地块，点房子、车道来换',
    fab_enter: '进屋', fab_exit: '出门', fab_design: '设计', fab_barn: '仓库', fab_center: '回中间', fab_rank: '排行',
    fab_peek: '进屋看看', fab_gift: '互动', fab_letter: '写信', fab_home: '回家',
    harvest_all: '一键收获', stop_jobs: '停下（还有 {n} 件）',
    live_now: '正在{name} · {n} 分钟', live_mini: '迷你的你也在小镇里陪你一起练',
    tray_items: '储物间', tray_colors: '颜色', tray_hint: '买来的东西会自动摆好，这里可以重新摆',
    tray_place: '点地面摆放「{name}」', rotate: '旋转', recolor: '换颜色', move: '移动', store: '收起',
    wallpaper: '墙纸', floor: '地板', wall_color: '外墙', roof_color: '屋顶',
    tray_empty: '储物间是空的。点已经摆好的东西可以移动、旋转或收起。', go_shop: '去商店',
    // shop
    shop_title: '商店', shop_money_note: '金币和木材只能从现实里赚：睡好、运动、少刷手机。农场卖的钱可以帮你更快攒够。',
    cat_seeds: '种子', cat_trees: '树苗', cat_animals: '牲畜', cat_land: '土地', cat_furn: '家具', cat_yard: '庭院', cat_cars: '载具', cat_houses: '房子', cat_sell: '行情',
    seed_sub: '{d}成熟 · 收 {n} 个 · 每个 🪙{p}', have_n: '已有 {n} 颗', buy_n: '买 {n}',
    rare_sleep: '睡眠分 80+ 获得', rare_rings: '三环全合获得', rare_focus: '离线 2 小时获得', rare_steps: '走满 6,000 步获得',
    note_seeds: '种子越贵，长得越久，卖得也越多。郁金香、玫瑰、向日葵、南瓜只能靠现实目标得到。',
    orchard_free: '果园空位 {n}/{cap}', no_orchard: '还没有果园。', go_land: '去买地', buy_sapling: '买树苗',
    tree_sub: '{d}长大 · 每 {every} 结 {e}×{n} · 每个 🪙{p}',
    pasture_cap: '牧场 {n}/{cap} 只', no_pasture: '还没有牧场。',
    grows_up: '{d}长大', animal_sub_prod: '每 {d} 产 {e}×{n}', animal_sub_baby: '每 {k} 次下一只崽', animal_sub_rabbit: '每 {d} 下一只崽',
    dog_sub: '看家：朋友来偷东西时有机会把人赶走', cat_sub: '宠物：在院子里溜达，陪你', buy_baby: '买幼崽', owned: '已拥有',
    land_field: '菜地', land_pasture: '牧场', land_orchard: '果园', land_pond: '鱼塘', maxed: '已满级',
    land_field_sub: '{a} 块扩到 {b} 块', land_field_max: '已经有 {n} 块地了',
    land_pasture_new: '建一个牧场，能养 {cap} 只', land_pasture_sub: '扩建到 Lv{lv}，能养 {cap} 只', land_pasture_max: '能养 {cap} 只，已满级',
    land_orchard_new: '建果园，能种 {n} 棵果树', land_orchard_sub: '扩建到能种 {n} 棵', land_orchard_max: '能种 {n} 棵，已满级',
    land_pond_new: '挖鱼塘，最多 {n} 条鱼，每 {m} 分钟来一条', land_pond_sub: '扩建到最多 {n} 条', land_pond_max: '最多 {n} 条，已满级',
    note_land: '地买了就一直是你的。菜地、牧场、果园、鱼塘越大，能种能养的越多。',
    furn_sub: '占 {w}×{d} 格', owned_n: '有 {n} 个', makes: '每 {d} 产 {e}',
    use_sit: '能坐', use_sleep: '能躺下睡觉', use_run: '能跑步', use_bike: '能骑', use_lift: '能举铁', use_box: '能打拳', use_yoga: '能练瑜伽',
    note_furn: '买了会自动摆进屋里。进屋点家具，小人会走过去坐下或运动；点「设计」可以重新摆、旋转、换颜色。',
    note_yard: '买了会自动摆在院子里，点「设计」可以挪位置。蜂箱会产蜂蜜。',
    car_sub: '停在你家车道上', car_sub_two: '两轮，停在车道上', car_driving: '正在用', car_drive: '换这辆', note_cars: '点车道上的车可以换颜色。',
    house_room: '室内 {w}×{d} 格', house_current: '正在住', house_move: '搬过去', note_houses: '买过的房子都是你的，可以随时搬回去。家具和院子会跟着你走。',
    sell_all: '全部卖出 +🪙{n}', sell_each: '每个 🪙{n}', sell_one: '卖 1 个', sell_n: '全卖 +🪙{n}', baby_release: '放进牧场',
    sell_empty: '仓库是空的。收菜、捡蛋、摘果子、钓鱼，都会放到这里。',
    // health page
    real_note: '正式版自动读取 Apple 健康和屏幕使用时间。现在的数据来源：', src_health: 'Apple 健康', src_sim: '原型控制台模拟',
    energy_title: '今天的精力', energy_score: '精力分 {n}', today_mult: '运动奖励', mult_bonus: '精神好加成', mult_tired: '有点累，打折',
    energy_desc_great: '昨晚睡得很好！小人蹦蹦跳跳的，今天运动的奖励 ×1.3。',
    energy_desc_good: '睡得不错，小人精神挺好，运动奖励照常。',
    energy_desc_tired: '昨晚没睡够，小人有点累、会打哈欠，运动奖励 ×0.75。今晚早点睡吧。',
    energy_desc_exhausted: '昨晚睡得很少，小人很累、有黑眼圈，运动奖励只有一半。休息日不打折。',
    energy_note: '精力 = 昨晚的睡眠分（有 Whoop 恢复分或 Oura 准备度时优先用），正念能再加一点。只改变表情和动作，不改变外观。',
    sleep_title: '昨晚睡眠分', sleep_line: '睡了 {d}', sleep_deep: '深睡', sleep_core: '核心', sleep_rem: '快速眼动', sleep_awake: '清醒',
    live_desc: '你在 Apple Watch 上开始了体能训练，迷你的你也在小镇里做同样的运动。', live_watch: '去看小人', bpm: '次/分',
    rings_title: '活动圆环', ring_move: '活动', ring_exercise: '锻炼', ring_stand: '站立', kcal: '千卡', minutes: '分钟', hours: '小时',
    rings_rule: '每合上一个环都有奖励，三环全合再送一颗玫瑰种子。',
    steps_today: '今天的步数', steps_rule: '每 1,000 步 = 🪙10 + 🪵1。走满 6,000 步再给 🪙20 + 🪵3 + 南瓜种子。精力会影响这些奖励。',
    goal_done: '今天的步数目标完成了', rest_on: '今天是休息日，好好休息', rest_btn: '今天是休息日',
    inclusive_note: '轮椅推动次数和步数一样算。生病或不舒服时选休息日，奖励照样有，也不打折。',
    workouts_title: '今天的体能训练', wk_line: '{n} 分钟 · {k} 千卡', wk_short: '不满 10 分钟', wk_none: '今天还没有体能训练。',
    workouts_rule: '每次 10 分钟以上：每分钟 🪙1.2，每 10 分钟 🪵1。',
    mind_title: '正念和身体指标', mindful: '正念', resp: '呼吸频率', per_min: '次/分', rhr: '静息心率',
    mind_rule: '正念每分钟 🪙5（每天最多 10 分钟），还能给精力加分。身体指标只给你自己看。',
    focus_today: '今天少刷了', focus_rule: '连续离线越久，奖励越多：30 分钟 🪙15、1 小时 🪙35、2 小时 🪙80 + 🌻 向日葵种子。',
    distract_usage: '分心 App 已用 {n} / {limit} 分钟', focus_note: '超过了也不会扣任何东西，下一段专注时间还在等你。', app_games: '游戏',
    earned_today: '今天从现实里赚到', money_rule: '小镇里所有的金币和木材，最初都来自这里。',
    devices_title: '支持的设备', devices_text: '正式版通过 Apple 健康读取：iPhone、Apple Watch，以及 Oura 戒指、Whoop 等把数据写进健康 App 的设备。原始健康数据只留在手机上。',
    privacy_title: '隐私', share_goal: '让朋友看到我「完成了目标」和正在运动',
    privacy_note: '默认关闭。打开后朋友只会看到「完成了目标」和运动类型，看不到步数、睡眠、心率等具体数字。',
    settings: '设置', language: '语言', see_health: '看健康详情',
    // feed & mail
    feed_empty: '还没有动态。', feed_note: '只有朋友的真实互动才会推送通知，不会催你收菜。',
    claim: '收下', claimed: '已收下', visit_back: '去看看', read: '读信',
    feed_gift: '{name} 送了你 {gift}', feed_welcome: '{name}：欢迎搬来梧桐街！送你 {gift}', feed_thanks: '{name} 回赠了你 {gift}',
    feed_like: '{name} 给你的家点了赞 ❤️', feed_goal: '{name} 今天完成了目标 🎉', feed_msg: '{name} 留言：「{msg}」',
    feed_join: '{name} 入住了梧桐街！邀请奖励 {gift}', feed_stole: '{name} 从你家顺走了 {n} 个{e} 😏',
    feed_caught: '{name} 想来偷{e}，被你家的狗赶跑了 🐕', feed_letter: '{name} 给你寄了一封信 ✉️',
    gift_seed: '{n} 颗{e}{name}种子', seed_x: '{e}种子×{n}',
    mailbox: '信箱', mail_unread: '{n} 封未读', mail_open: '打开信箱', write_letter: '写信', write: '写',
    mail_desc: '朋友寄来的信都在这里。信里可以夹一点小礼物。', mail_empty: '还没有信。给朋友写一封吧。', mail_sent_n: '你一共寄出了 {n} 封信。',
    dear: '亲爱的 {name}：', reply: '回信', to: '寄给', paper: '信纸', attach: '夹带', no_gift: '不夹东西',
    letter_ph: '想说点什么……', send: '寄出', letter_hint: '寄出后会出现在 TA 的信箱里，TA 家门口的邮箱会竖起小红旗。',
    letter_note: '原型里朋友是模拟的，过一会儿可能会回信。',
    // collect
    welcome_back: '欢迎回来 👋', collect_title: '待领取的奖励', collect_empty: '暂时没有新奖励。',
    collect_desc: '这些都来自你在现实里做到的事。精力好的时候运动奖励更多。', collect_all: '全部领取',
    p_steps: '走了 {n} 步', p_focus: '{d}没打开分心 App', p_goal: '走满了 {n} 步', p_ring_move: '合上了活动环', p_ring_exercise: '合上了锻炼环',
    p_ring_stand: '合上了站立环', p_rings: '三环全部合上！', p_workout: '{e} {name} {n} 分钟', p_mindful: '正念 {n} 分钟', p_sleep: '睡眠分 {n}，睡得真好', p_rest: '休息日奖励',
    // fields
    plant_title: '种点什么？', plant: '种下', plant_all: '全种上', build_left: '今天还能做 {n} 次农活（共 {cap} 次）', plant_walk: '小人会走过去一块块种',
    no_seeds: '没有种子了。', buy_seeds: '去买种子', empty_field: '空地', friend_empty_field: '{name}的这块地还空着。',
    yield_left: '还有 {n} 个', growing_left: '还要 {d} 成熟', ripe_now: '熟了，点一下小人就去收！', never_wilts: '不会枯萎，什么时候来收都可以。',
    stolen_by: '{names} 顺走了一点 😏 你也可以去他们家逛逛。', steal_done: '你已经顺过这里了，给主人留点吧。', steal_keep: '剩下的要留给主人。',
    // animals & trees
    stage_baby: '幼崽', stage_young: '半大', stage_adult: '成年', animal_gone: '它已经不在这里了。',
    grow_left: '还要 {d} 长大', a_baby: '一只{name}', prod_ready: '可以收了：{what}', prod_left: '{d}后：{what}',
    collect: '去收', sell_for: '卖掉 +🪙{n}', sell_confirm: '确定卖掉这只{name}吗？',
    tree_grow_left: '还要 {d} 长成大树', fruit_ready: '结满了 {e}×{n}，点一下小人去摘', tree_bloom: '正在开花，{d}后结果', tree_fruiting: '果子正在长，{d}后成熟',
    tree_note: '果树种一次，可以一直结果。',
    // barn & car
    barn_title: '仓库', barn_desc: '收获的菜、蛋奶、果子、鱼、多出来的幼崽都在这里，随时可以卖。',
    barn_goods: '农产品', barn_seeds: '种子', barn_store: '储物间', no_seeds_short: '没有种子。', store_empty: '没有收起来的家具。', barn_empty: '还是空的。',
    worth: '价值 🪙{v}', car_color: '车身颜色', car_switch: '换一辆', car_shop: '去车行',
    // friends
    f_goal_done: '今天完成了目标', f_goal_not_yet: '今天还在努力', f_private: '没有公开', f_live: '正在{name}',
    goal_privacy_hint: '你只能看到朋友愿意公开的结果，看不到具体数字。',
    like_home: '给 TA 的家点赞', like: '点赞', liked: '已点赞',
    leave_msg: '留言', msg_nice: '房子真好看！', msg_walk: '一起去散步吗？', msg_cheer: '今天也加油！', msg_veg: '下次给我留点菜 😤',
    send_gift: '送礼', no_gifts: '你现在没有可以送的东西，收获一点试试。', social_free: '拜访、点赞、留言、写信和送礼都不占用农活次数。', visit: '拜访',
    // ranking
    rank_title: '{street}家产排行', town_total: '全镇总家产', town_next: '再 🪙{n} 小镇升到 Lv{lv}', town_max: '小镇已经满级啦',
    town_note: '大家一起变富，镇中心的广场就会升级：喷泉、长椅、钟楼……这是全镇一起的目标。',
    my_assets: '我的家产', a_cash: '金币和木材', a_house: '房子', a_land: '土地和果树', a_items: '家具和装饰', a_cars: '载具', a_animals: '牲畜', a_goods: '仓库和种子', a_total: '合计',
    animals_n: '{n} 只动物', rank_privacy: '排行只比家产，不比步数和睡眠。你的健康和屏幕数据永远不会公开。',
    invite_btn: '邀请朋友入住', invite_reward_note: '朋友入住后，你们俩都会得到 🪵5。',
    invite_title: '邀请朋友入住', invite_desc: '把链接发给朋友，TA 就能直接搬到这块空地，和你做邻居。',
    copy_link: '复制邀请链接', invite_note: '原型不会真的发送任何东西。正式版通过链接和 iMessage 邀请。',
    cap_heading: '今天的活干完了', cap_text: '去过你的生活吧。明天小镇还在这里等你。', cap_ok: '好的，明天见',
    // console
    console_title: '原型控制台', console_wait: '入住小镇后可以用。', console_desc: '模拟正式版里从 Apple 健康和屏幕使用时间自动读到的数据。',
    con_sleep: '昨晚睡眠分', con_sleep_note: '换一个睡眠分，看小人的表情和动作、运动奖励倍率怎么变。',
    con_live: 'Apple Watch 体能训练（迷你的你）', con_live_note: '开始后小人会同步做这项运动，结束后这次训练会算进今天的奖励。', live_stop: '结束{name}',
    con_health: 'Apple 健康', steps_unit: '步', ex_min: '锻炼分钟', stand_h: '站立小时', add_workout: '+30 分钟训练',
    con_screen: '屏幕使用时间', offline_x: '离线 {d}', distract_btn: '刷了 20 分钟短视频',
    con_time: '时间', sim_time: '模拟时间', ff_x: '快进 {d}', next_day: '进入下一天',
    con_friends: '朋友', sim_friend_event: '朋友互动一次', sim_steal: '朋友来偷东西', sim_letter: '朋友寄来一封信', sim_friend_live: '朋友开始运动', sim_join: '朋友接受邀请',
    con_demo: '演示', demo_money: '+🪙1000 +🪵50', demo_note: '只给演示用，方便试商店。正式版没有这个按钮。',
    con_widget: '锁屏小组件预览', w_quiet: '小镇很安静。', w_ripe: '家里有 {n} 样可以收', w_growing: '菜和牲畜正在慢慢长',
    reset: '重置原型', reset_confirm: '确定清空所有进度，重新开始吗？',
    // snacks
    snack_poor: '钱还不够，去现实里走走吧', snack_full: '满了，先去「土地」扩建', snack_new_day: '新的一天开始了 ☀️', snack_ff: '时间快进了',
    snack_live_busy: '小人正在陪你运动，结束后再干活吧', snack_cant_reach: '走不过去', snack_going: '小人去收 {n} 样东西了',
    snack_going_plant: '小人去种 {n} 块{e}了', snack_harvest: '收获了 {n} 个{e}', snack_prod: '收获了 {n} 个{e}',
    snack_baby: '牧场里多了一只{name} 🍼', snack_baby_barn: '生了一只{name}，牧场满了，先放在仓库',
    snack_no_fish: '鱼塘里还没有鱼，过一会儿再来', snack_fish: '钓到了一条{name} {e}', snack_not_your_pond: '这是别人家的鱼塘',
    snack_sold: '卖了 🪙{n}', snack_seed: '买了 {n} 颗{e}种子', snack_tree: '{name}树苗种进果园了 🌱', snack_animal: '一只{name}住进来了',
    snack_land_field: '菜地扩建好了', snack_land_pasture: '牧场建好了', snack_land_orchard: '果园建好了，去「树苗」里挑果树吧', snack_land_pond: '鱼塘挖好了，鱼会慢慢游来',
    snack_furn: '{name}已经摆进屋里', snack_yard: '{name}已经摆在院子里', snack_stored: '没地方摆了，{name}先放进储物间',
    snack_car: '{name}停到你家车道上了', snack_drive: '换成了{name}', snack_house: '搬进了{name}！🎉', snack_moved: '搬回了{name}',
    snack_norotate: '转不过来，旁边有东西挡着', snack_to_store: '收进储物间了', snack_placed: '摆好了', snack_noroom: '这里放不下',
    snack_liked: '点赞成功', snack_msg: '留言已送到 {name} 家', snack_gift: '把 {gift} 送给了 {name}',
    snack_copied: '邀请链接已复制', snack_claimed: '收下了 {gift}', snack_rest: '好好休息，奖励照发',
    snack_letter_empty: '信还是空的', snack_letter_sent: '信寄给 {name} 了 📮',
    snack_sleep: '睡眠分 {n} → {e}', snack_steps: '+{n} 步，奖励在家门口等你', snack_workout: '完成了 30 分钟{e}{name}',
    snack_mindful: '正念 +{n} 分钟', snack_live: '开始{e}{name}，迷你的你也开始了', snack_workout_done: '训练结束：{e} {n} 分钟，奖励在家门口',
    snack_focus: '离线 {d}，奖励在家门口等你', snack_distract: '没关系，不扣任何东西。下一段专注时间还在等你。',
    snack_quiet: '朋友们现在都很安静', snack_nothing_ripe: '你家现在没有可偷的东西', snack_friend_live: '{name} 开始运动了 {e}',
    snack_street_full: '街上没有空地了', snack_stole: '顺走了 {n} 个{e} 🤫', snack_dog: '被{name}家的狗发现了，快跑！🐕',
    snack_steal_limit: '今天已经偷了 {n} 次，明天再来吧',
    ago_now: '刚刚', ago_m: '{n} 分钟前', ago_h: '{n} 小时前', ago_d: '{n} 天前',
    dur_m: '{m} 分钟', dur_h: '{h} 小时', dur_hm: '{h} 小时 {m} 分',
  },
  en: {
    app_name: 'Mirror Town', now: 'now', default_name: 'Townie', free: 'Free', next: 'Next', done: 'Done', cancel: 'Cancel',
    tagline: 'Sleep well, move more and scroll less in real life, and the mini you, your home and your whole street get better.',
    ob_p0: 'Sleep well and your townie has energy today, and workouts pay more', ob_p1: 'Steps, Activity rings and workouts turn into coins and wood',
    ob_p2: 'Skip short videos; the longer you stay away, the bigger the reward', ob_p3: 'Farm, raise animals, build a house, get a car, and live on one street with friends',
    ob_start: 'Get started', ob_you: 'Design your townie', ob_name_ph: 'Your name',
    ob_shirt: 'Shirt', ob_skin: 'Skin', ob_hair: 'Hair', ob_hair_col: 'Hair color', ob_mob: 'Getting around',
    hair_short: 'Short', hair_long: 'Long', hair_bun: 'Bun', hair_curly: 'Curly', mob_walk: 'Walking', mob_wheel: 'Wheelchair',
    ob_look_note: 'Your look is up to you and never depends on health data. Energy only changes faces and moves.',
    ob_apps: 'Which apps distract you?', ob_apps_desc: 'Only the apps you pick count. In the real app this uses the iPhone\'s built-in app picker, and we never see what you chose.',
    ob_limit: 'Daily limit you\'d like', ob_health: 'The real app asks to read Apple Health: steps, sleep, Activity rings, workouts, mindfulness, heart rate. Data that Oura, Whoop and Apple Watch write to Health works too.',
    ob_privacy: 'This data stays on your phone. Friends never see the numbers.', ob_move_in: 'Move in',
    tab_home: 'Home', tab_town: 'Town', tab_shop: 'Shop', tab_real: 'Health', tab_feed: 'Activity',
    energy_great: 'Full of energy', energy_good: 'Feeling good', energy_tired: 'A bit tired', energy_exhausted: 'Exhausted',
    sleep_short: 'sleep {n}', cap_title: 'Farm actions today (planting, sneaking)', to_collect: 'Collect',
    hint_text: 'Tap anywhere and your townie walks there. Tap ripe crops, hens with eggs or fruiting trees and it walks over to pick them. Tap the house to go in; drag to look around, pinch to zoom.', hint_ok: 'Got it',
    expand_field: 'Expand field', build_pasture: 'Build pasture', build_orchard: 'Plant orchard', build_pond: 'Dig a pond',
    home_of: '{name}\'s home', empty_lot: 'Empty lot · invite a friend', street_name: 'Maple Street',
    ctx_rank: 'No. {n} · worth 🪙{v}', ctx_inside: '{house} · inside', ctx_town: '{street} Lv{lv} · 🏡{h} homes · 🪙{v}',
    ctx_edit_room: 'Design inside: drag furniture, tap a piece to recolour', ctx_edit_yard: 'Design the yard: drag things and areas, tap the house or drive to change them',
    fab_enter: 'Go in', fab_exit: 'Go out', fab_design: 'Design', fab_barn: 'Barn', fab_center: 'Center', fab_rank: 'Ranks',
    fab_peek: 'Peek in', fab_gift: 'Say hi', fab_letter: 'Write', fab_home: 'Home',
    harvest_all: 'Harvest all', stop_jobs: 'Stop ({n} left)',
    live_now: '{name} · {n} min', live_mini: 'Mini you is working out with you in town',
    tray_items: 'Storage', tray_colors: 'Colors', tray_hint: 'New things place themselves; rearrange them here',
    tray_place: 'Tap the ground to place "{name}"', rotate: 'Rotate', recolor: 'Recolor', move: 'Move', store: 'Store',
    wallpaper: 'Walls', floor: 'Floor', wall_color: 'Walls', roof_color: 'Roof',
    tray_empty: 'Storage is empty. Tap something you placed to move, rotate or store it.', go_shop: 'Shop',
    shop_title: 'Shop', shop_money_note: 'Coins and wood only come from real life: sleep, movement and less scrolling. Farm sales help you save faster.',
    cat_seeds: 'Seeds', cat_trees: 'Trees', cat_animals: 'Animals', cat_land: 'Land', cat_furn: 'Furniture', cat_yard: 'Yard', cat_cars: 'Vehicles', cat_houses: 'Houses', cat_sell: 'Prices',
    seed_sub: 'Ripe in {d} · {n} each · 🪙{p} each', have_n: '{n} in stock', buy_n: 'Buy {n}',
    rare_sleep: 'Sleep score 80+', rare_rings: 'Close all rings', rare_focus: '2 hours offline', rare_steps: 'Walk 6,000 steps',
    note_seeds: 'Pricier seeds grow longer and sell for more. Tulips, roses, sunflowers and pumpkins only come from real-life goals.',
    orchard_free: 'Orchard spots {n}/{cap}', no_orchard: 'No orchard yet.', go_land: 'Buy land', buy_sapling: 'Sapling',
    tree_sub: 'Grows in {d} · {e}×{n} every {every} · 🪙{p} each',
    pasture_cap: 'Pasture {n}/{cap}', no_pasture: 'No pasture yet.',
    grows_up: 'Grows up in {d}', animal_sub_prod: '{e}×{n} every {d}', animal_sub_baby: 'a baby every {k} times', animal_sub_rabbit: 'a baby every {d}',
    dog_sub: 'Guards your home and may chase off sneaky friends', cat_sub: 'A pet that strolls around your yard', buy_baby: 'Buy baby', owned: 'Owned',
    land_field: 'Field', land_pasture: 'Pasture', land_orchard: 'Orchard', land_pond: 'Pond', maxed: 'Maxed',
    land_field_sub: '{a} plots → {b} plots', land_field_max: 'You have {n} plots',
    land_pasture_new: 'Build a pasture for {cap} animals', land_pasture_sub: 'Expand to Lv{lv}, {cap} animals', land_pasture_max: '{cap} animals, maxed',
    land_orchard_new: 'Plant an orchard for {n} trees', land_orchard_sub: 'Expand to {n} trees', land_orchard_max: '{n} trees, maxed',
    land_pond_new: 'Dig a pond: up to {n} fish, one every {m} min', land_pond_sub: 'Expand to {n} fish', land_pond_max: 'Up to {n} fish, maxed',
    note_land: 'Land is yours for good. Bigger fields, pastures, orchards and ponds hold more.',
    furn_sub: '{w}×{d} tiles', owned_n: '{n} owned', makes: '{e} every {d}',
    use_sit: 'sit', use_sleep: 'lie down and sleep', use_run: 'run on it', use_bike: 'ride it', use_lift: 'lift', use_box: 'box', use_yoga: 'yoga',
    note_furn: 'New furniture places itself. Inside, tap furniture and your townie walks over to sit or work out; "Design" lets you move, rotate and recolor.',
    note_yard: 'New decor places itself in the yard; "Design" lets you move it. Beehives make honey.',
    car_sub: 'Parks in your driveway', car_sub_two: 'Two wheels, parks in your driveway', car_driving: 'In use', car_drive: 'Use this', note_cars: 'Tap the vehicle in your driveway to repaint it.',
    house_room: 'Inside {w}×{d}', house_current: 'Living here', house_move: 'Move here', note_houses: 'Houses you buy stay yours; move back any time. Furniture and yard come with you.',
    sell_all: 'Sell all +🪙{n}', sell_each: '🪙{n} each', sell_one: 'Sell 1', sell_n: 'Sell all +🪙{n}', baby_release: 'To pasture',
    sell_empty: 'The barn is empty. Crops, eggs, fruit and fish end up here.',
    real_note: 'The real app reads Apple Health and Screen Time automatically. Data source now:', src_health: 'Apple Health', src_sim: 'prototype console',
    energy_title: 'Today\'s energy', energy_score: 'Energy {n}', today_mult: 'Workout rewards', mult_bonus: 'well-rested bonus', mult_tired: 'tired, discounted',
    energy_desc_great: 'You slept great! Your townie bounces around, and workouts pay ×1.3 today.',
    energy_desc_good: 'Good sleep. Your townie feels fine and rewards are normal.',
    energy_desc_tired: 'Not quite enough sleep. Your townie yawns a little and workouts pay ×0.75. Try an earlier night.',
    energy_desc_exhausted: 'Very little sleep. Your townie has dark circles and workouts pay half. Rest days are never discounted.',
    energy_note: 'Energy = last night\'s sleep score (Whoop recovery or Oura readiness first, when you have them), plus a little from mindfulness. It only changes faces and moves, never looks.',
    sleep_title: 'Last night\'s sleep', sleep_line: 'Slept {d}', sleep_deep: 'Deep', sleep_core: 'Core', sleep_rem: 'REM', sleep_awake: 'Awake',
    live_desc: 'You started a workout on Apple Watch, so the mini you is doing the same in town.', live_watch: 'Watch your townie', bpm: 'bpm',
    rings_title: 'Activity rings', ring_move: 'Move', ring_exercise: 'Exercise', ring_stand: 'Stand', kcal: 'kcal', minutes: 'min', hours: 'h',
    rings_rule: 'Every closed ring pays, and closing all three adds a rose seed.',
    steps_today: 'Steps today', steps_rule: 'Every 1,000 steps = 🪙10 + 🪵1. Reach 6,000 for 🪙20 + 🪵3 + a pumpkin seed. Energy scales these.',
    goal_done: 'Step goal done for today', rest_on: 'Rest day. Take it easy', rest_btn: 'Take a rest day',
    inclusive_note: 'Wheelchair pushes count like steps. On sick days pick a rest day: you still get the reward, never discounted.',
    workouts_title: 'Workouts today', wk_line: '{n} min · {k} kcal', wk_short: 'under 10 min', wk_none: 'No workouts yet today.',
    workouts_rule: 'Each workout of 10+ minutes: 🪙1.2 per minute and 🪵1 per 10 minutes.',
    mind_title: 'Mindfulness and vitals', mindful: 'Mindful', resp: 'Respiratory rate', per_min: '/min', rhr: 'Resting HR',
    mind_rule: 'Mindful minutes pay 🪙5 each (up to 10 a day) and add to energy. Vitals are only for you.',
    focus_today: 'Offline today', focus_rule: 'Longer offline stretches pay more: 30 min 🪙15, 1 h 🪙35, 2 h 🪙80 + 🌻 seed.',
    distract_usage: 'Distracting apps: {n} / {limit} min', focus_note: 'Going over never costs anything. Your next focus stretch is waiting.', app_games: 'Games',
    earned_today: 'Earned from real life today', money_rule: 'Every coin and plank in town starts here.',
    devices_title: 'Devices', devices_text: 'The real app reads Apple Health: iPhone, Apple Watch, and devices like Oura and Whoop that write to the Health app. Raw health data stays on your phone.',
    privacy_title: 'Privacy', share_goal: 'Let friends see "goal done" and when I work out',
    privacy_note: 'Off by default. Friends only see "goal done" and the workout type, never steps, sleep or heart rate.',
    settings: 'Settings', language: 'Language', see_health: 'Health details',
    feed_empty: 'Nothing yet.', feed_note: 'Only real interactions from friends send notifications. We never nag you to harvest.',
    claim: 'Accept', claimed: 'Accepted', visit_back: 'Visit', read: 'Read',
    feed_gift: '{name} sent you {gift}', feed_welcome: '{name}: Welcome to Maple Street! Here\'s {gift}', feed_thanks: '{name} sent back {gift}',
    feed_like: '{name} liked your home ❤️', feed_goal: '{name} hit their goal today 🎉', feed_msg: '{name}: "{msg}"',
    feed_join: '{name} moved onto Maple Street! Invite reward {gift}', feed_stole: '{name} sneaked {n} {e} from you 😏',
    feed_caught: '{name} tried to sneak {e}, but your dog chased them off 🐕', feed_letter: '{name} sent you a letter ✉️',
    gift_seed: '{n} {e} {name} seeds', seed_x: '{e} seed×{n}',
    mailbox: 'Mailbox', mail_unread: '{n} unread', mail_open: 'Open', write_letter: 'Write a letter', write: 'Write',
    mail_desc: 'Letters from friends land here. A letter can carry a small gift.', mail_empty: 'No letters yet. Write one to a friend.', mail_sent_n: 'You have sent {n} letters.',
    dear: 'Dear {name},', reply: 'Reply', to: 'To', paper: 'Paper', attach: 'Attach', no_gift: 'Nothing',
    letter_ph: 'Say something…', send: 'Send', letter_hint: 'It shows up in their mailbox, and the little flag on their mailbox goes up.',
    letter_note: 'Friends are simulated in the prototype and may write back.',
    welcome_back: 'Welcome back 👋', collect_title: 'Rewards to collect', collect_empty: 'No new rewards right now.',
    collect_desc: 'All of this comes from things you did in real life. Workouts pay more when you\'re rested.', collect_all: 'Collect all',
    p_steps: 'Walked {n} steps', p_focus: '{d} away from distracting apps', p_goal: 'Reached {n} steps', p_ring_move: 'Closed your Move ring', p_ring_exercise: 'Closed your Exercise ring',
    p_ring_stand: 'Closed your Stand ring', p_rings: 'All three rings closed!', p_workout: '{e} {name} {n} min', p_mindful: '{n} mindful minutes', p_sleep: 'Sleep score {n}, nice sleep', p_rest: 'Rest day reward',
    plant_title: 'Plant something', plant: 'Plant', plant_all: 'Plant all', build_left: '{n} of {cap} farm actions left today', plant_walk: 'your townie walks over to each plot',
    no_seeds: 'You\'re out of seeds.', buy_seeds: 'Buy seeds', empty_field: 'Empty plot', friend_empty_field: 'This plot of {name}\'s is empty.',
    yield_left: '{n} left', growing_left: 'Ripe in {d}', ripe_now: 'Ripe! Tap and your townie goes to pick it.', never_wilts: 'Nothing wilts. Harvest whenever you like.',
    stolen_by: '{names} sneaked a little 😏 Pay them a visit too.', steal_done: 'You already sneaked from here. Leave some for the owner.', steal_keep: 'The rest stays with the owner.',
    stage_baby: 'Baby', stage_young: 'Young', stage_adult: 'Adult', animal_gone: 'It\'s not here anymore.',
    grow_left: 'Grows up in {d}', a_baby: 'a {name}', prod_ready: 'Ready: {what}', prod_left: 'In {d}: {what}',
    collect: 'Collect', sell_for: 'Sell +🪙{n}', sell_confirm: 'Sell this {name}?',
    tree_grow_left: 'Full grown in {d}', fruit_ready: '{e}×{n} ready. Tap and your townie picks them', tree_bloom: 'Blossoming, fruit in {d}', tree_fruiting: 'Fruit ripe in {d}',
    tree_note: 'Plant a tree once and it keeps fruiting.',
    barn_title: 'Barn', barn_desc: 'Crops, eggs, milk, fruit, fish and extra babies live here. Sell any time.',
    barn_goods: 'Produce', barn_seeds: 'Seeds', barn_store: 'Storage', no_seeds_short: 'No seeds.', store_empty: 'Nothing stored.', barn_empty: 'Empty.',
    worth: 'Worth 🪙{v}', car_color: 'Color', car_switch: 'Switch', car_shop: 'Dealer',
    f_goal_done: 'Hit their goal today', f_goal_not_yet: 'Still working on it', f_private: 'Not shared', f_live: 'Working out: {name}',
    goal_privacy_hint: 'You only see what friends choose to share, never numbers.',
    like_home: 'Like their home', like: 'Like', liked: 'Liked',
    leave_msg: 'Message', msg_nice: 'Lovely home!', msg_walk: 'Walk together?', msg_cheer: 'You got this!', msg_veg: 'Save me some veggies 😤',
    send_gift: 'Gift', no_gifts: 'Nothing to give right now. Harvest something first.', social_free: 'Visiting, liking, messages, letters and gifts never use farm actions.', visit: 'Visit',
    rank_title: '{street} rankings', town_total: 'Town total', town_next: '🪙{n} more for town Lv{lv}', town_max: 'Town is maxed',
    town_note: 'As everyone gets richer, the plaza upgrades: fountain, benches, clock tower… a goal the whole town shares.',
    my_assets: 'My assets', a_cash: 'Coins & wood', a_house: 'Houses', a_land: 'Land & trees', a_items: 'Furniture & decor', a_cars: 'Vehicles', a_animals: 'Animals', a_goods: 'Barn & seeds', a_total: 'Total',
    animals_n: '{n} animals', rank_privacy: 'Ranks compare homes only, never steps or sleep. Your health and screen data are never shared.',
    invite_btn: 'Invite a friend', invite_reward_note: 'When they move in, you both get 🪵5.',
    invite_title: 'Invite a friend', invite_desc: 'Send the link and they move straight onto the empty lot next to you.',
    copy_link: 'Copy invite link', invite_note: 'The prototype doesn\'t send anything. The real app invites via link and iMessage.',
    cap_heading: 'Today\'s work is done', cap_text: 'Go live your life. The town will be here tomorrow.', cap_ok: 'OK, see you tomorrow',
    console_title: 'Prototype console', console_wait: 'Available after you move in.', console_desc: 'Simulates what the real app reads from Apple Health and Screen Time.',
    con_sleep: 'Last night\'s sleep score', con_sleep_note: 'Change it to see faces, moves and the workout multiplier change.',
    con_live: 'Apple Watch workout (mini you)', con_live_note: 'Your townie does the workout too. When it ends, it counts toward today\'s rewards.', live_stop: 'End {name}',
    con_health: 'Apple Health', steps_unit: 'steps', ex_min: 'exercise min', stand_h: 'stand hour', add_workout: '+30 min workout',
    con_screen: 'Screen Time', offline_x: 'Offline {d}', distract_btn: '20 min of short videos',
    con_time: 'Time', sim_time: 'Sim time', ff_x: '+{d}', next_day: 'Next day',
    con_friends: 'Friends', sim_friend_event: 'Friend does something', sim_steal: 'Friend sneaks', sim_letter: 'Friend sends a letter', sim_friend_live: 'Friend starts a workout', sim_join: 'Friend accepts invite',
    con_demo: 'Demo', demo_money: '+🪙1000 +🪵50', demo_note: 'Demo only, to try the shop. Not in the real app.',
    con_widget: 'Lock-screen widget', w_quiet: 'The town is quiet.', w_ripe: '{n} things ready at home', w_growing: 'Crops and animals are growing',
    reset: 'Reset prototype', reset_confirm: 'Erase all progress and start over?',
    snack_poor: 'Not enough yet. Go for a walk!', snack_full: 'Full. Expand it under Land first', snack_new_day: 'A new day ☀️', snack_ff: 'Time skipped ahead',
    snack_live_busy: 'Your townie is working out with you. Farm after.', snack_cant_reach: 'Can\'t get there', snack_going: 'Your townie is off to collect {n} things',
    snack_going_plant: 'Your townie is off to plant {n} {e}', snack_harvest: 'Harvested {n} {e}', snack_prod: 'Collected {n} {e}',
    snack_baby: 'A {name} joined the pasture 🍼', snack_baby_barn: 'A {name} was born. Pasture full, so it\'s in the barn',
    snack_no_fish: 'No fish yet. Come back later', snack_fish: 'Caught a {name} {e}', snack_not_your_pond: 'That\'s someone else\'s pond',
    snack_sold: 'Sold for 🪙{n}', snack_seed: 'Bought {n} {e} seeds', snack_tree: '{name} sapling planted 🌱', snack_animal: 'A {name} moved in',
    snack_land_field: 'Field expanded', snack_land_pasture: 'Pasture built', snack_land_orchard: 'Orchard ready. Pick trees under Trees', snack_land_pond: 'Pond dug. Fish will swim in',
    snack_furn: '{name} placed inside', snack_yard: '{name} placed in the yard', snack_stored: 'No room, so {name} went to storage',
    snack_car: '{name} is in your driveway', snack_drive: 'Switched to {name}', snack_house: 'Moved into the {name}! 🎉', snack_moved: 'Moved back to the {name}',
    snack_norotate: 'No room to turn it', snack_to_store: 'Stored', snack_placed: 'Placed', snack_noroom: 'Doesn\'t fit there',
    snack_liked: 'Liked', snack_msg: 'Message left at {name}\'s', snack_gift: 'Gave {gift} to {name}',
    snack_copied: 'Invite link copied', snack_claimed: 'Got {gift}', snack_rest: 'Rest well. Rewards still come',
    snack_letter_empty: 'The letter is empty', snack_letter_sent: 'Letter sent to {name} 📮',
    snack_sleep: 'Sleep {n} → {e}', snack_steps: '+{n} steps, reward waiting at home', snack_workout: 'Finished 30 min {e} {name}',
    snack_mindful: '+{n} mindful minutes', snack_live: 'Started {e} {name}. Mini you started too', snack_workout_done: 'Workout done: {e} {n} min, reward at home',
    snack_focus: 'Offline {d}, reward waiting at home', snack_distract: 'No problem, nothing is taken away. Your next focus stretch is waiting.',
    snack_quiet: 'Friends are quiet right now', snack_nothing_ripe: 'Nothing to sneak at your place right now', snack_friend_live: '{name} started a workout {e}',
    snack_street_full: 'No empty lots left', snack_stole: 'Sneaked {n} {e} 🤫', snack_dog: '{name}\'s dog spotted you. Run! 🐕',
    snack_steal_limit: 'You sneaked {n} times today. Come back tomorrow',
    ago_now: 'just now', ago_m: '{n} min ago', ago_h: '{n} h ago', ago_d: '{n} d ago',
    dur_m: '{m} min', dur_h: '{h} h', dur_hm: '{h} h {m} min',
  },
};

// ---------- v0.4: first screens, tutorial, storeys, privacy & calm mode, personal goal, souvenirs ----------
Object.assign(STR.zh, {
  ob_slogan: '现实里过得好，小镇里就过得好', ob_start_note: '一分钟就能住进来', ob_skip: '跳过',
  story0_t: '睡得好，小人就精神', story0_s: '昨晚的睡眠决定今天的表情和奖励',
  story1_t: '动一动，就有金币和木材', story1_s: '走路、运动、少刷短视频都算',
  story2_t: '种地盖房，和朋友做邻居', story2_s: '只比谁的家更好看，不比谁更能跑',
  ob_you2: '这是迷你的你', ob_look_short: '外观只由你决定，和健康数据无关。',
  ob_apps2: '哪些 App 最让你停不下来？', ob_apps_short: '只算你选的。正式版里我们看不到你选了什么。',
  ob_health_short: '读取 Apple 健康：睡眠、步数、运动', ob_privacy_short: '数据只留在你的手机上，朋友看不到数字',
  tut_walk: '点一下地面，小人就会走过去。', tut_harvest: '小麦熟了！点它，小人会走过去蹲下收。',
  tut_collect: '这是你在现实里赚到的，点这里领取。', tut_plant: '点一块空地，选种子种下。',
  tut_town: '朋友们就住在这条街上，去看看。', tut_real: '睡眠、步数、运动、少刷手机，都在这里变成金币。只有你自己看得到这一页。',
  tut_done: '就这些！每天的农活有上限，干完就去过你的生活吧 🌙', tut_skip: '跳过引导', tut_ok: '开始我的小镇生活',
  p_welcome: '入住礼包',
  build_floor: '加盖一层', build_floor_title: '加盖到 {n} 层', build_btn: '开工',
  build_floor_desc: '新的一层是一个空房间：墙纸、地板、家具都由你来布置。',
  house_floors: '{n}/{max} 层', floor_max: '{name}已经盖满 {n} 层了。', floor_none: '{name}只有一层。换更大的房子就能往上盖。',
  snack_floor: '{n} 楼盖好了！上楼看看吧', snack_moved_stored: '搬进了{name}，{n} 件放不下的家具收进了仓库',
  privacy_title: '隐私和心情', calm_title: '安静模式', calm_desc: '不看排行，不看朋友的运动和精力表情，只管自己的小家。',
  privacy_see: '朋友能看到我：', share_goal2: '完成了今天的目标', share_live: '正在运动（迷你的你会在街上跑）', share_mood: '精力表情（睡得好不好）',
  privacy_note2: '全部默认关闭。步数、睡眠分、心率这些数字永远不会给任何人看。',
  ctx_town_calm: '🏛️ {street} · 小镇 Lv{lv}', town_title: '{street}', rank_calm: '安静模式开着，这里不显示排行。', rank_show: '关掉安静模式',
  f_calm: '安静模式：不看朋友的运动', snack_calm_on: '安静模式已打开：不看排行和朋友的运动', snack_calm_off: '安静模式已关闭',
  real_private: '🔒 这一页只有你自己看得到。',
  my_goal: '你的目标', goal_auto: '目标跟着你最近 7 天自动调整，比平时多走一点就好。',
  steps_rule2: '每走 {n} 步 = 🪙10 + 🪵1，最多算到目标的 150%。走到目标再给 🪙20 + 🪵3 + 南瓜种子。',
  wk_cap: '每天最多算 {n} 分钟。',
  souv_title: '纪念品', souv_desc: '买不到，只能在现实里做到。你的家会慢慢变成你生活的日记。',
  souv_ok: '太好了', souv_new: '新纪念品！', souv_placed: '已经摆进你家一楼了。', souv_go: '进屋看看',
  souv_need_days: '来小镇 {n} 天（休息日也算）', souv_need_goalDays: '{n} 天走到自己的步数目标', souv_need_sleepStreak: '连续 {n} 晚睡眠 80 分以上',
  souv_need_ringsAll: '合上一次三个圆环', souv_need_focus120: '一次离开分心 App 2 小时', souv_need_mindful: '正念累计 {n} 分钟',
  souv_need_workouts: '{n} 次 10 分钟以上的运动',
});
Object.assign(STR.en, {
  ob_slogan: 'Live well. Your little town grows.', ob_start_note: 'Move in within a minute', ob_skip: 'Skip',
  story0_t: 'Sleep well, wake up bright', story0_s: 'Last night\'s sleep sets today\'s mood and rewards',
  story1_t: 'Move a little, earn coins and wood', story1_s: 'Walks, workouts and less scrolling all count',
  story2_t: 'Farm, build, and live next to friends', story2_s: 'Compare homes, never who runs more',
  ob_you2: 'This is mini you', ob_look_short: 'Your look is up to you and never depends on health data.',
  ob_apps2: 'Which apps are hardest to put down?', ob_apps_short: 'Only the ones you pick count. In the real app we never see your picks.',
  ob_health_short: 'Reads Apple Health: sleep, steps, workouts', ob_privacy_short: 'Data stays on your phone; friends never see numbers',
  tut_walk: 'Tap the ground and your townie walks there.', tut_harvest: 'The wheat is ripe! Tap it and your townie goes over to pick it.',
  tut_collect: 'This is what you earned in real life. Tap to collect.', tut_plant: 'Tap an empty plot and plant a seed.',
  tut_town: 'Your friends live on this street. Take a look.', tut_real: 'Sleep, steps, workouts and less scrolling turn into coins here. Only you can see this page.',
  tut_done: 'That\'s it! Farm work has a daily limit; when it\'s done, go live your life 🌙', tut_skip: 'Skip tutorial', tut_ok: 'Start my town life',
  p_welcome: 'Welcome gift',
  build_floor: 'Add a storey', build_floor_title: 'Build up to {n} storeys', build_btn: 'Build',
  build_floor_desc: 'The new storey is an empty room: wallpaper, floor and furniture are all yours to design.',
  house_floors: '{n}/{max} storeys', floor_max: 'Your {name} already has all {n} storeys.', floor_none: 'The {name} has one storey. Get a bigger house to build up.',
  snack_floor: 'Storey {n} is ready! Go upstairs', snack_moved_stored: 'Moved into the {name}; {n} things that didn\'t fit went to storage',
  privacy_title: 'Privacy & peace of mind', calm_title: 'Calm mode', calm_desc: 'No rankings, no friends\' workouts or energy faces. Just your own little home.',
  privacy_see: 'Friends can see:', share_goal2: 'That I reached today\'s goal', share_live: 'When I\'m working out (mini me jogs down the street)', share_mood: 'My energy face (how I slept)',
  privacy_note2: 'All off by default. Steps, sleep scores and heart rate are never shown to anyone.',
  ctx_town_calm: '🏛️ {street} · Town Lv{lv}', town_title: '{street}', rank_calm: 'Calm mode is on, so no rankings here.', rank_show: 'Turn off calm mode',
  f_calm: 'Calm mode: friends\' workouts hidden', snack_calm_on: 'Calm mode on: no rankings or friends\' workouts', snack_calm_off: 'Calm mode off',
  real_private: '🔒 Only you can see this page.',
  my_goal: 'your goal', goal_auto: 'Your goal follows your last 7 days: just a bit more than usual.',
  steps_rule2: 'Every {n} steps = 🪙10 + 🪵1, counted up to 150 % of your goal. Reach your goal for 🪙20 + 🪵3 + a pumpkin seed.',
  wk_cap: 'Up to {n} minutes a day count.',
  souv_title: 'Souvenirs', souv_desc: 'Can\'t be bought, only earned in real life. Your home slowly becomes a diary of your life.',
  souv_ok: 'Nice!', souv_new: 'New souvenir!', souv_placed: 'It\'s already in your ground floor.', souv_go: 'Go see it',
  souv_need_days: 'Visit the town on {n} days (rest days count)', souv_need_goalDays: 'Reach your own step goal on {n} days', souv_need_sleepStreak: 'Sleep 80+ for {n} nights in a row',
  souv_need_ringsAll: 'Close all three rings once', souv_need_focus120: 'Stay off distracting apps for 2 hours once', souv_need_mindful: '{n} mindful minutes in total',
  souv_need_workouts: '{n} workouts of 10+ minutes',
});

// Letters friends write (prototype only; real letters come from real friends).
// ---------- v0.5 ----------
Object.assign(STR.zh, {
  sub_all: '全部', rank_n: '第 {n} 名', letter_short: '寄到 TA 家的邮箱', peek_short: '看看屋里', visit_short: '去 TA 家看看', social_free_short: '送点小东西',
  snack_blocks_way: '这样放会挡住路，小人走不过去',
});
Object.assign(STR.en, {
  sub_all: 'All', rank_n: 'No. {n}', letter_short: 'Lands in their mailbox', peek_short: 'Look inside', visit_short: 'Go to their home', social_free_short: 'Send something small',
  snack_blocks_way: 'That would block the way; your townie could not get through',
});

// ---------- v0.6: the world, land, weather ----------
Object.assign(STR.zh, {
  for_sale: '出售', land_lot: '空地 {n} 格宽', buy_parcel: '买下旁边的地',
  area_maple: '🏡 梧桐街社区', area_center: '🏛️ 镇中心', area_lake: '⛵ 湖畔', area_park: '🌳 森林公园', area_farm: '🌾 田园', area_fields: '🌾 麦田', area_water: '💧 镜湖',
  stranger: '镇上的居民', shop_soon: '以后可以进去逛',
  land_buy_title: '买下旁边这块地', land_buy_desc: '在你家右边，{w} × {d} 格。买下后院子变大，可以摆更多东西；可以一直往右买，一块比一块贵。',
  land_owned: '现在', land_after: '买下后', land_price: '价格', tiles_n: '{w} × {d} 格',
  land_buy_btn: '买下', land_grow_note: '每多买一块，下一块贵 35%。湖畔的地更贵，田园的地便宜。',
  land_move_title: '搬到{street}', land_move_desc: '这里有一块 {w} × {d} 格的空地（{nb}）。搬过来后，房子、菜地、牲畜、院子都跟着你走。',
  land_refund: '退回你买的地（一半）', land_move_note: '你原来那块地会空出来。好友还是好友，随时可以串门。',
  land_move_btn: '搬过来', land_too_small: '这块地太小了，至少要 16 格宽才能安家。可以等它旁边的地也空出来。', land_taken: '这块地已经有人了',
  snack_parcel: '地买好了！你家现在 {w} 格宽', snack_moved_street: '搬到{street}了，欢迎新邻居！',
  w_clear: '晴天', w_clouds: '多云', w_rain: '下雨', w_snow: '下雪', w_fog: '有雾', w_storm: '雷雨', w_auto: '自动',
  w_real_src: '你所在地区现在的真实天气', w_sim_src: '小镇自己的天气（每 3 小时变一次）',
  w_effect_clear: '阳光正好，适合出门走走。', w_effect_clouds: '云在天上慢慢飘。', w_effect_rain: '🌧️ 下雨了：雨水会浇菜，菜长得快 25%。',
  w_effect_snow: '❄️ 下雪了：整个小镇白茫茫的。', w_effect_fog: '雾蒙蒙的，远处看不太清。', w_effect_storm: '⛈️ 雷雨天：菜长得快，但记得待在屋里。',
  w_real_toggle: '用我所在地区的真实天气', w_real_note: '只用大概位置（约 10 公里）查天气，位置不保存、不给别人。',
  w_fail: '暂时拿不到天气，先用小镇的天气', w_denied: '没有位置权限，先用小镇的天气', con_weather: '天气',
});
Object.assign(STR.en, {
  for_sale: 'For sale', land_lot: 'Land {n} tiles wide', buy_parcel: 'Buy the land next door',
  area_maple: '🏡 Maple', area_center: '🏛️ Town centre', area_lake: '⛵ Lakeside', area_park: '🌳 Woodland Park', area_farm: '🌾 Farmland', area_fields: '🌾 Wheat fields', area_water: '💧 Mirror Lake',
  stranger: 'lives in town', shop_soon: 'You’ll be able to go in later',
  land_buy_title: 'Buy the land next door', land_buy_desc: 'To the right of your home, {w} × {d} tiles. Your yard gets bigger for more things; keep buying to the right, each piece costs more.',
  land_owned: 'Now', land_after: 'After', land_price: 'Price', tiles_n: '{w} × {d} tiles',
  land_buy_btn: 'Buy', land_grow_note: 'Each piece costs 35% more than the last. Lakeside land is pricier, farmland cheaper.',
  land_move_title: 'Move to {street}', land_move_desc: 'There is {w} × {d} tiles of empty land here ({nb}). Your house, fields, animals and yard all move with you.',
  land_refund: 'Back for the land you bought (half)', land_move_note: 'Your old spot becomes empty. Friends stay friends and can visit any time.',
  land_move_btn: 'Move here', land_too_small: 'Too small: a home needs at least 16 tiles. Wait until the land next to it is free too.', land_taken: 'Somebody already lives here',
  snack_parcel: 'Land bought! Your home is now {w} tiles wide', snack_moved_street: 'Moved to {street}. Hello, new neighbours!',
  w_clear: 'Sunny', w_clouds: 'Cloudy', w_rain: 'Rain', w_snow: 'Snow', w_fog: 'Fog', w_storm: 'Thunderstorm', w_auto: 'Auto',
  w_real_src: 'Real weather where you are', w_sim_src: 'The town’s own weather (changes every 3 hours)',
  w_effect_clear: 'Lovely sunshine, a good day for a walk.', w_effect_clouds: 'Clouds drift slowly by.', w_effect_rain: '🌧️ Raining: the rain waters your crops, they grow 25% faster.',
  w_effect_snow: '❄️ Snowing: the whole town turns white.', w_effect_fog: 'Foggy, hard to see far.', w_effect_storm: '⛈️ Thunderstorm: crops grow faster, stay inside.',
  w_real_toggle: 'Use the real weather where I am', w_real_note: 'Only a rough location (about 10 km) is used to look up the weather. It is never saved or shared.',
  w_fail: 'No weather right now, using the town’s', w_denied: 'No location permission, using the town’s weather', con_weather: 'Weather',
});

// ---------- v0.7 ----------
Object.assign(STR.zh, {
  set_music: '背景音乐', set_sfx: '音效',
  snack_dog_fine: '被{name}家的狗抓到了！赔了 TA 🪙{n}，今天不能再去 TA 家偷了 🐕', snack_chased: '{name}家的狗今天记住你了，明天再来吧',
  feed_caught_fine: '{name} 想来偷{e}，被你家的狗抓到了，赔了你 🪙{n} 🐕',
});
Object.assign(STR.en, {
  set_music: 'Music', set_sfx: 'Sound effects',
  snack_dog_fine: 'Caught by {name}’s dog! You paid them 🪙{n} and can’t sneak in again today 🐕', snack_chased: '{name}’s dog remembers you today. Come back tomorrow',
  feed_caught_fine: '{name} tried to sneak {e}, got caught by your dog and paid you 🪙{n} 🐕',
});

// ---------- v0.8 ----------
Object.assign(STR.zh, {
  cat_pets: '宠物', fab_pets: '宠物', save: '好',
  cap_info: '今天还能做 {n} 件农活（种菜、偷菜，每天 {cap} 件）。收获、买卖、布置不限次数。',
  pets_title: '我的宠物', pets_empty: '还没有宠物。去商店领养一只狗狗或猫咪吧！', pets_adopt: '🐾 去领养', pets_more: '再领养',
  pets_note: '最多养 {max} 只，你现在有 {n} 只。领养送 {food} 顿饭和食盆，猫咪还送猫砂盆。宠物不会生病，也不会离开你。',
  pet_sub_dog: '每天要喂饭、换水、遛一遛', pet_sub_cat: '每天要喂饭、换水、铲猫砂', adopt: '领养',
  petfood_sub: '{n} 顿饭 · 现有 {have}', treat_sub: '{n} 块 · 心情 +{love} · 现有 {have}', petfood_bought: '买了{name} {e}（{n} 份）',
  need_food: '吃饭', need_water: '喝水', need_litter: '猫砂', need_walk: '散步', need_love: '心情',
  pet_feed: '喂饭', pet_water: '换水', pet_scoop: '铲猫砂', pet_walk: '遛狗', pet_pet: '摸摸', pet_play: '玩耍', pet_treat: '零食',
  pet_stage_0: '宝宝', pet_stage_1: '小家伙', pet_stage_2: '长大了',
  mood_happy: '很开心', mood_ok: '还不错', mood_sad: '想你了',
  pet_food_low: '{name}{e}快吃完了', pet_nofood: '没有{name}了，去商店买一点吧',
  pet_remind: '宠物提醒', pet_remind_note: '到时间提醒你喂饭、换水、铲猫砂或遛狗（手机通知，可以关掉）',
  pet_never: '宠物不会生病，也不会离开你。忘了照顾它，它只会想你。',
  pet_adopted: '{name} 来到你家啦！🎉', pet_full: '最多养 {n} 只宠物', pet_name_ph: '给它起个名字',
  pet_ask_food: '{name}饿了，记得喂饭 🍖', pet_ask_water: '{name}的水喝完了，换点新水吧 💧', pet_ask_clean_cat: '{name}的猫砂该铲了 🧹',
  pet_ask_clean_dog: '{name}想出去散步 🦮', pet_ask_love: '{name}想你了，摸摸它吧 ❤️',
  set_theme: '外观', theme_auto: '跟随系统', theme_light: '浅色', theme_dark: '深色',
  account: '账号', signed_in_with: '已用 {p} 登录', not_signed_in: '还没登录', sign_out: '退出登录', sign_in: '登录',
  p_apple: 'Apple', p_google: 'Google', p_email: '邮箱',
  login_title: '登录镜像小镇', login_sub: '登录后换手机也不会丢家，朋友也能找到你',
  login_apple: '通过 Apple 登录', login_google: '通过 Google 登录', login_email: '用邮箱登录',
  login_terms: '继续即表示你同意《用户协议》和《隐私政策》。健康数据只留在你的手机上。',
  login_email_title: '用邮箱登录', login_email_ph: '你的邮箱', login_send: '发送验证码', login_bad_email: '邮箱格式好像不对',
  login_code_title: '输入验证码', login_code_sub: '验证码已发到 {email}', login_code_ph: '6 位数字', login_verify: '登录', login_bad_code: '请输入 6 位数字',
  login_proto: '原型版不会真的发邮件，输入任意 6 位数字即可', login_back: '返回', login_busy: '正在登录…',
  login_native_fail: 'Apple 登录还没开通（需要开发者账号），先用模拟登录', login_ok: '登录成功 👋', login_sim: '原型模拟登录，还没有连服务器',
});
Object.assign(STR.en, {
  cat_pets: 'Pets', fab_pets: 'Pets', save: 'Save',
  cap_info: 'You can do {n} more farm jobs today (planting and sneaking, {cap} a day). Harvesting, buying, selling and decorating are unlimited.',
  pets_title: 'My pets', pets_empty: 'No pets yet. Adopt a dog or a cat in the shop!', pets_adopt: '🐾 Adopt one', pets_more: 'Adopt',
  pets_note: 'Up to {max} pets, you have {n}. A new pet comes with {food} meals and bowls; a cat also gets a litter box. Pets never get sick and never leave.',
  pet_sub_dog: 'Needs meals, water and a daily walk', pet_sub_cat: 'Needs meals, water and a clean litter box', adopt: 'Adopt',
  petfood_sub: '{n} meals · you have {have}', treat_sub: '{n} treats · love +{love} · you have {have}', petfood_bought: 'Bought {name} {e} ({n})',
  need_food: 'Food', need_water: 'Water', need_litter: 'Litter', need_walk: 'Walk', need_love: 'Love',
  pet_feed: 'Feed', pet_water: 'Water', pet_scoop: 'Scoop', pet_walk: 'Walk', pet_pet: 'Pet', pet_play: 'Play', pet_treat: 'Treat',
  pet_stage_0: 'Baby', pet_stage_1: 'Young', pet_stage_2: 'Grown up',
  mood_happy: 'Happy', mood_ok: 'Okay', mood_sad: 'Misses you',
  pet_food_low: 'Running low on {name} {e}', pet_nofood: 'Out of {name}, get some in the shop',
  pet_remind: 'Pet reminders', pet_remind_note: 'Reminds you to feed, refresh water, scoop or walk (phone notifications, can be turned off)',
  pet_never: 'Pets never get sick and never leave. If you forget them, they just miss you.',
  pet_adopted: '{name} has come home! 🎉', pet_full: 'You can have up to {n} pets', pet_name_ph: 'Name your pet',
  pet_ask_food: '{name} is hungry 🍖', pet_ask_water: '{name} needs fresh water 💧', pet_ask_clean_cat: '{name}’s litter box needs scooping 🧹',
  pet_ask_clean_dog: '{name} wants to go for a walk 🦮', pet_ask_love: '{name} misses you, give them a pat ❤️',
  set_theme: 'Appearance', theme_auto: 'Auto', theme_light: 'Light', theme_dark: 'Dark',
  account: 'Account', signed_in_with: 'Signed in with {p}', not_signed_in: 'Not signed in', sign_out: 'Sign out', sign_in: 'Sign in',
  p_apple: 'Apple', p_google: 'Google', p_email: 'email',
  login_title: 'Sign in to Mirror Town', login_sub: 'Keep your home when you change phones, and let friends find you',
  login_apple: 'Sign in with Apple', login_google: 'Sign in with Google', login_email: 'Sign in with email',
  login_terms: 'By continuing you agree to the Terms and the Privacy Policy. Health data stays on your phone.',
  login_email_title: 'Sign in with email', login_email_ph: 'Your email', login_send: 'Send code', login_bad_email: 'That email doesn’t look right',
  login_code_title: 'Enter the code', login_code_sub: 'We sent a code to {email}', login_code_ph: '6 digits', login_verify: 'Sign in', login_bad_code: 'Please enter the 6 digits',
  login_proto: 'The prototype sends no email: any 6 digits work', login_back: 'Back', login_busy: 'Signing in…',
  login_native_fail: 'Sign in with Apple isn’t set up yet (needs a developer account), using a test sign-in', login_ok: 'Signed in 👋', login_sim: 'Prototype sign-in, no server yet',
});

// ---------- v0.9 ----------
Object.assign(STR.zh, {
  fab_world: '世界', world_title: '世界', world_sub: '全世界的玩家住在不同的社区。去别的社区逛逛，喜欢的话可以把家搬过去。',
  world_here: '你住这里', world_visit: '去看看', world_move: '搬到这里', world_my_town: '回我的小镇', world_all: '所有社区',
  world_pop: '{n} 户人家（邀请制）', world_parcel: '一块地 🪙{n} 起', world_free: '{n} 块空地', world_friends: '{n} 个朋友住这里',
  world_pick_land: '点一块「出售」的空地，就能把整个家搬过来',
  world_note: '原型里别的社区的居民是模拟的；正式版里住的都是真实玩家（需要服务器）。',
  snack_moved_town: '搬到了{town}！🎉',
  theme_maple: '梧桐绿荫', theme_sakura: '樱花', theme_autumn: '红枫', theme_palm: '椰林海滩', theme_snow: '雪山', theme_desert: '沙漠',
  theme_lavender: '薰衣草', theme_tulip: '郁金香', theme_bamboo: '竹林', theme_fjord: '峡湾',
  out_east: '邻镇 · 东边', out_south: '邻镇 · 南边', out_west: '邻镇 · 西边', pinch_world: '🌍 继续缩小，看看世界',
  tab_world: '世界', fab_map: '地图', online_n: '{n} 人在线', online_world: '全世界 {n} 人在线',
  sea_pacific: '太平洋', sea_atlantic: '大西洋', sea_indian: '印度洋', sea_arctic: '北冰洋',
  reg_na: '北美洲', reg_sa: '南美洲', reg_eu: '欧洲', reg_af: '非洲', reg_asia: '亚洲', reg_oc: '大洋洲',
});
Object.assign(STR.en, {
  fab_world: 'World', world_title: 'World', world_sub: 'Players all over the world live in different communities. Look around, and move your home if you like one.',
  world_here: 'You live here', world_visit: 'Look around', world_move: 'Move here', world_my_town: 'My town', world_all: 'All communities',
  world_pop: '{n} homes (invite only)', world_parcel: 'Land from 🪙{n}', world_free: '{n} empty lots', world_friends: '{n} friends live here',
  world_pick_land: 'Tap an empty lot “for sale” to move your whole home here',
  world_note: 'In the prototype the other communities’ residents are made up; in the real game they are real players (needs the server).',
  snack_moved_town: 'Moved to {town}! 🎉',
  theme_maple: 'Green maples', theme_sakura: 'Cherry blossom', theme_autumn: 'Red maples', theme_palm: 'Palm beach', theme_snow: 'Snowy mountains', theme_desert: 'Desert',
  theme_lavender: 'Lavender', theme_tulip: 'Tulips', theme_bamboo: 'Bamboo', theme_fjord: 'Fjords',
  out_east: 'Next town · east', out_south: 'Next town · south', out_west: 'Next town · west', pinch_world: '🌍 Zoom out more to see the world',
  tab_world: 'World', fab_map: 'Map', online_n: '{n} online', online_world: '{n} online worldwide',
  sea_pacific: 'Pacific Ocean', sea_atlantic: 'Atlantic Ocean', sea_indian: 'Indian Ocean', sea_arctic: 'Arctic Ocean',
  reg_na: 'North America', reg_sa: 'South America', reg_eu: 'Europe', reg_af: 'Africa', reg_asia: 'Asia', reg_oc: 'Oceania',
});

// ---------- v0.10 ----------
Object.assign(STR.zh, {
  cat_excl: '专属', fab_trophies: '奖杯', tro_title: '我的奖杯', tro_all: '全部 {n}/{total}', tro_maxed: '已经拿到金奖杯 🎉',
  tro_streak_next: '现在连续 {cur} 天 · 下一个：{what}', tro_sport_hint: 'Apple Watch 里的 {n} 种运动，每种都有铜银金三个奖杯。去运动一次就有铜奖杯！',
  tro_best: '最长连续 {n} 天', tro_mine: '我的奖杯', tro_theirs: '{name}的奖杯', tro_summary: '{n} / {total} 个奖杯 · 解锁 {x} 件专属',
  tro_theirs_note: '奖杯只能在现实里赢得，买不到。', tro_sports: '{n} 种运动', tro_none: '还没有运动奖杯。',
  tro_rule: '一次 10 分钟以上的运动算一次：{a} 次铜、{b} 次银、{c} 次金。', tro_new: '新奖杯', tro_sport_what: '{name}累计 {n} 次',
  tro_unlock: '解锁专属', tro_unlock_note: '只有拿到这个奖杯的人才能买，别人来你家一看就知道。', tro_go_shop: '去看专属', tro_count: '累计 {n} 次',
  excl_note: '只有在现实里赢得奖杯的人才能买。买了可以放在家里、院子里或车道上，来你家的人都能看见。', excl_locked: '还没解锁',
  excl_locked_snack: '还没解锁，先去赢得对应的奖杯吧', excl_bought: '{name} 是你的了！🏆',
  excl_req_tier: '{e} {name} · {tier}（{what}）', excl_req_group: '{e} {group}里任意一项拿到金奖杯（{n} 次）',
  con_trophy: '奖杯', con_day10k: '万步 +1 天', con_day20k: '2 万步', con_rings: '三环', con_sport: '随机运动',
  con_trophy_note: '模拟连续天数和某种运动的次数，看奖杯和专属。',
});
Object.assign(STR.en, {
  cat_excl: 'Exclusive', fab_trophies: 'Trophies', tro_title: 'My trophies', tro_all: 'All {n}/{total}', tro_maxed: 'Gold trophy won 🎉',
  tro_streak_next: '{cur} days in a row now · next: {what}', tro_sport_hint: 'Every one of the {n} Apple Watch workout types has bronze, silver and gold. One workout gets you bronze!',
  tro_best: 'Best streak {n} days', tro_mine: 'My trophies', tro_theirs: '{name}’s trophies', tro_summary: '{n} / {total} trophies · {x} exclusives unlocked',
  tro_theirs_note: 'Trophies can only be won in real life, never bought.', tro_sports: '{n} sports', tro_none: 'No sport trophies yet.',
  tro_rule: 'A workout of 10 minutes or more counts once: {a} for bronze, {b} for silver, {c} for gold.', tro_new: 'New trophy', tro_sport_what: '{name} {n} times',
  tro_unlock: 'Exclusive unlocked', tro_unlock_note: 'Only people with this trophy can buy it, so everyone visiting knows.', tro_go_shop: 'See exclusives', tro_count: '{n} so far',
  excl_note: 'Only people who won the trophy in real life can buy these. Put them in your home, yard or driveway for every visitor to see.', excl_locked: 'Locked',
  excl_locked_snack: 'Locked: win the trophy first', excl_bought: '{name} is yours! 🏆',
  excl_req_tier: '{e} {name} · {tier} ({what})', excl_req_group: '{e} Gold in any {group} sport ({n} workouts)',
  con_trophy: 'Trophies', con_day10k: '10k day +1', con_day20k: '20k', con_rings: 'Rings', con_sport: 'Random sport',
  con_trophy_note: 'Pretend streak days and workouts of one sport to see trophies and exclusives.',
});

const LETTER_TPL = {
  zh: {
    friend: ['今天在湖边散步，看到一群小鸭子。你那边天气好吗？', '你家的菜长得真好，教教我怎么种！', '周末一起去湖边散步吗？', '我昨晚睡得特别好，今天精神满满！',
      '送你一点小礼物，别嫌弃～', '最近少刷了好多短视频，感觉一天变长了。', '我家母鸡今天下了好多蛋，分你一点。', '下次来我家坐坐，新买了沙发！'],
    reply: ['收到你的信好开心！', '谢谢你的信，下次来我家玩～', '我也在努力早睡，一起加油！', '你说得对，周末见！'],
    mine: ['谢谢你的礼物！', '一起加油！', '周末一起散步吗？', '你家真好看！', '今天睡得好吗？', '来我家喝茶～'],
    welcome: '欢迎搬来梧桐街！我是你的邻居。院子里种点菜，养几只鸡，日子会很舒服的。送你几个苹果～',
  },
  en: {
    friend: ['Walked by the lake today and saw a family of ducks. How is the weather your way?', 'Your veggies look amazing, teach me!', 'Walk by the lake this weekend?', 'Slept so well last night, full of energy today!',
      'A little gift for you~', 'I\'ve been scrolling way less lately. Days feel longer.', 'My hens laid lots of eggs today, sharing some.', 'Come over sometime, I got a new sofa!'],
    reply: ['So happy to get your letter!', 'Thanks for writing, come visit~', 'Trying to sleep earlier too. We got this!', 'You\'re right, see you this weekend!'],
    mine: ['Thanks for the gift!', 'We got this!', 'Walk this weekend?', 'Your home is lovely!', 'Did you sleep well?', 'Come over for tea~'],
    welcome: 'Welcome to Maple Street! I\'m your neighbor. Grow a few veggies, keep a few hens, and life gets cozy. Here are some apples~',
  },
};

function curLang() { return (typeof S !== 'undefined' && S && S.lang) || (typeof OB !== 'undefined' && OB && OB.lang) || 'zh'; }
function t(key, vars) {
  const s = STR[curLang()][key] ?? STR.zh[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : s;
}
// Catalog items carry their own { zh, en } names.
const nm = o => (o ? o[curLang()] || o.zh : '');

// ---------- formatting ----------
const fmtNum = n => Math.round(n).toLocaleString(curLang() === 'en' ? 'en-US' : 'zh-CN');
function fmtCompact(n) {
  if (curLang() === 'zh') return n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + '万' : fmtNum(n);
  return n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k' : fmtNum(n);
}
const fmtClock = ms => { const d = new Date(ms); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
function fmtDate(ms) {
  const d = new Date(ms);
  return curLang() === 'en'
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }) + ' ' + fmtClock(ms)
    : `${d.getMonth() + 1}月${d.getDate()}日 ${fmtClock(ms)}`;
}
function fmtDur(ms) {
  const m = Math.max(1, Math.ceil(ms / MIN));
  if (m < 60) return t('dur_m', { m });
  return m % 60 ? t('dur_hm', { h: Math.floor(m / 60), m: m % 60 }) : t('dur_h', { h: m / 60 });
}
function ago(ms) {
  const m = Math.floor((now() - ms) / MIN);
  if (m < 1) return t('ago_now');
  if (m < 60) return t('ago_m', { n: m });
  if (m < 1440) return t('ago_h', { n: Math.floor(m / 60) });
  return t('ago_d', { n: Math.floor(m / 1440) });
}

// ---------- v0.11 ----------
Object.assign(STR.zh, {
  farm_pill: '🌱 今日农活 {n}', more_here: '👥 还有 {n} 人在这里',
  ask_first: '这是别人家，要先问主人', host_home: '在线 · 在家', host_offline: '不在线', host_away: '在线 · 去{name}家串门了',
  house_rules_title: '做客的规矩', house_rules_desc: '在别人家可以随便看看。想坐下、躺下，要先问问主人；主人在线才能问，答应了这次做客就都可以。',
  host_ask: '问问能不能坐坐', host_ask_it: '问问能不能用{it}', host_thinking: '{name}正在回复…', host_yes: '{name}说：当然可以，随便坐！',
  host_no: '{name}说：现在不太方便，下次吧。', host_cant_off: '{name}现在不在线，上线了再问吧。', host_cant_away: '{name}去别人家串门了，回家了再问吧。',
  host_yes_snack: '{name}答应了，这次做客可以随便坐 😊', host_wave: '打招呼', host_waved: '{name}也朝你挥了挥手',
  st_home: '在家', st_out: '出门了', st_off: '不在线', local_time: '当地 {t}',
  go_sub: '从你现在的地方出发，沿着马路走；开车更快：先去取车，停进停车场再走过去。', go_walk: '走过去', go_drive: '开车去', go_ride: '骑车去', go_now: '直接到', go_now_sub: '一下就到', go_stop: '停下', soc_talk: '和{name}互动', soc_cat_friendly: '友好', soc_cat_funny: '好玩', soc_cat_deep: '深聊', soc_cat_gift: '送礼', soc_cat_mischief: '恶作剧', soc_traits: '性格', soc_likes: '喜欢', soc_my_likes: '你喜欢', soc_unknown: '再熟一点就知道了', soc_ask_hobby: '聊聊兴趣就知道了', smood_great: '今天心情很好', smood_good: '心情不错', smood_meh: '有点累', smood_grumpy: '今天有点烦', soc_lock: '{level}才能', soc_need_near: '要先走到{name}身边', soc_ok: '{name}很开心', soc_love: '{name}超喜欢！', soc_bad: '{name}不太领情', soc_bored: '{name}有点腻了，换点别的吧', soc_share: '你们都喜欢{topic}！聊得停不下来', soc_noshare: '{name}对{topic}没什么兴趣，说更喜欢{their}', soc_talk_about: '聊{topic}', soc_rel: '关系：', soc_polite: '{name}听得挺认真，还说自己喜欢{their}', soc_they_like_short: '对方喜欢', soc_gift_ok: '{name}收下了{item}', soc_gift_none: '仓库里没有能送的东西', soc_plans_ok: '约好了！{name}一小时内在公园等你', soc_levelup: '你和{name}成了{level}！', venue_enter: '进去', venue_leave: '出去', venue_in: '在{name}里', venue_tip: '点里面的人和东西，看看能做什么', venue_busy: '还要 {n} 秒', vrole_bakery: '面包师', vrole_cafe: '咖啡师', vrole_clinic: '护士', vrole_library: '图书管理员', vrole_gym: '教练', vrole_post: '邮局职员', vrole_school: '老师', vrole_plaza: '办事员', vrole_police: '警察', vrole_firestation: '消防员', vrole_gas: '店员', sp_bakery_case: '面包柜', sp_bakery_case_d: '刚出炉的牛角包、法棍、甜甜圈，买一个吃。', sp_bakery_oven: '烤炉', sp_bakery_oven_d: '用你自己种的小麦烤面包。', sp_bakery_table: '窗边的小桌', sp_bakery_table_d: '买个点心，坐下慢慢吃。', sp_cafe_menu: '饮品单', sp_cafe_menu_d: '咖啡、茶、果汁，都是 🪙{n}。', sp_cafe_table: '空着的桌子', sp_cafe_table_d: '坐下来，叫个认识的人过来聊聊天。', sp_cafe_sofa: '沙发', sp_cafe_sofa_d: '戴上耳机，听一会儿音乐。', sp_clinic_bed: '诊室的床', sp_clinic_bed_d: '吃了药，躺下休息一会儿就好了。', sp_clinic_scale: '健康检查', sp_clinic_scale_d: '看看昨晚睡得怎么样、今天走了多少步。只有你自己看得到。', sp_clinic_pharmacy: '药房', sp_clinic_pharmacy_d: '生病了在这里买药。', sp_library_featured: '今日推荐', sp_library_featured_d: '今天的知识卡片，半分钟就能读完。', sp_library_table: '阅览桌', sp_library_table_d: '找本书，坐下来看一会儿。', sp_gym_treadmill: '跑步机', sp_gym_spinbike: '动感单车', sp_gym_dumbbells: '哑铃', sp_gym_boxing: '沙袋', sp_gym_yogamat: '瑜伽垫', sp_gym_d: '练一会儿，心情会变好。真正的运动还是在现实里做哦。', sp_post_boxes: '信箱', sp_post_boxes_d: '看看有没有你的信。', sp_post_cards: '明信片架', sp_post_cards_d: '从这个小镇寄一张明信片给朋友。', sp_school_desk: '空座位', sp_school_desk_d: '上夜校：坐下来上一节课。', sp_plaza_board: '小镇榜', sp_plaza_board_d: '全镇的家产，和你排第几。', sp_police_board: '公告栏', sp_police_board_d: '你的记录，和警察局是怎么工作的。', sp_firestation_truck: '消防车', sp_firestation_truck_d: '爬上去看看，再学一条防火小知识。', sp_gas_shelf: '零食架', sp_gas_shelf_d: '饿了就买点吃的。', sp_gas_fridge: '饮料柜', sp_gas_fridge_d: '冰镇的饮料。', sp_eat_btn: '买一个坐下吃 🪙{n}（饱腹 +{h}）', sp_chat_btn: '坐下聊天（社交 +{n}）', sp_relax_btn: '坐下听音乐（娱乐 +{n}）', sp_read_btn: '坐下看书（娱乐 +{n}）', sp_gym_btn: '练一练（娱乐 +{n}）', sp_gym_left: '今天还能练 {n} 次', sp_done_today: '今天已经做过了，明天再来', sp_rest_btn: '躺下休息一会儿', sp_rest_med: '躺下休息（吃了药，{n} 秒就好）', sp_check_btn: '开始检查', sp_check_res: '昨晚睡眠 {s} 分 · 今天走了 {k} 步', sp_check_note: '这些数字只在你的手机上，别人看不到。', sp_truck_btn: '爬上去看看（娱乐 +{n}）', sp_tip: '今天的防火小知识', sp_mail_btn: '打开信箱', sp_rank_btn: '看小镇榜', sp_ate: '吃得真香', sp_chatted: '和{name}聊得很开心', sp_relaxed: '放松了一会儿', sp_read_done: '看完了一章书', sp_worked_out: '练完了，出了一身汗', sp_rested: '休息好了', sp_cured: '病好了！', sp_truck_done: '消防车真酷', go_stopped: '停在这里了，可以点别的地方再出发',
  go_secs: '约 {n} 秒', go_no_car: '还没有车', go_on_way: '在去{to}的路上…',
  area_canal: '运河', area_beach: '海滩', area_river: '河畔', area_fjord: '峡湾', area_harbour: '港口', area_terrace: '山坡梯田',
});
Object.assign(STR.en, {
  farm_pill: '🌱 Jobs {n}', more_here: '👥 {n} more here',
  ask_first: 'This is someone else’s home: ask first', host_home: 'Online · at home', host_offline: 'Offline', host_away: 'Online · visiting {name}',
  house_rules_title: 'House rules', house_rules_desc: 'You can look around someone’s home. To sit or lie down, ask the owner first; you can ask while they’re online, and a yes counts for this visit.',
  host_ask: 'Ask if you can sit down', host_ask_it: 'Ask to use the {it}', host_thinking: '{name} is answering…', host_yes: '{name}: Of course, make yourself at home!',
  host_no: '{name}: Not right now, maybe next time.', host_cant_off: '{name} is offline. Ask when they’re back online.', host_cant_away: '{name} is out visiting. Ask when they’re back home.',
  host_yes_snack: '{name} said yes: sit anywhere this visit 😊', host_wave: 'Wave', host_waved: '{name} waved back',
  st_home: 'at home', st_out: 'out', st_off: 'offline', local_time: 'local time {t}',
  go_sub: 'From where you are, along the roads. Driving is faster: fetch your car, park in the car park, walk in.', go_walk: 'Walk', go_drive: 'Drive', go_ride: 'Ride', go_now: 'Go now', go_now_sub: 'Right away', go_stop: 'Stop', soc_talk: 'Socialise with {name}', soc_cat_friendly: 'Friendly', soc_cat_funny: 'Funny', soc_cat_deep: 'Deep talk', soc_cat_gift: 'Gifts', soc_cat_mischief: 'Mischief', soc_traits: 'Traits', soc_likes: 'Likes', soc_my_likes: 'You like', soc_unknown: 'Get to know them first', soc_ask_hobby: 'Talk hobbies to find out', smood_great: 'In a great mood', smood_good: 'In a good mood', smood_meh: 'A bit tired', smood_grumpy: 'Grumpy today', soc_lock: 'At {level}', soc_need_near: 'Walk over to {name} first', soc_ok: '{name} liked that', soc_love: '{name} loved it!', soc_bad: '{name} didn’t like that', soc_bored: '{name} is getting bored of that. Try something else', soc_share: 'You both love {topic}! You can’t stop talking', soc_noshare: '{name} isn’t into {topic}, they’d rather talk about {their}', soc_talk_about: 'Talk about {topic}', soc_rel: 'Friendship:', soc_polite: '{name} listened politely and said they like {their}', soc_they_like_short: 'They like it', soc_gift_ok: '{name} took the {item}', soc_gift_none: 'Nothing in your barn to give', soc_plans_ok: 'It’s a plan! {name} waits in the park for an hour', soc_levelup: 'You and {name}: {level}!', venue_enter: 'Go in', venue_leave: 'Leave', venue_in: 'In the {name}', venue_tip: 'Tap the people and things inside to see what you can do', venue_busy: '{n} s to go', vrole_bakery: 'Baker', vrole_cafe: 'Barista', vrole_clinic: 'Nurse', vrole_library: 'Librarian', vrole_gym: 'Coach', vrole_post: 'Clerk', vrole_school: 'Teacher', vrole_plaza: 'Clerk', vrole_police: 'Officer', vrole_firestation: 'Firefighter', vrole_gas: 'Cashier', sp_bakery_case: 'Pastry case', sp_bakery_case_d: 'Fresh croissants, baguettes and doughnuts. Buy one to eat.', sp_bakery_oven: 'Oven', sp_bakery_oven_d: 'Bake bread from the wheat you grew.', sp_bakery_table: 'Window table', sp_bakery_table_d: 'Buy a pastry and sit down to enjoy it.', sp_cafe_menu: 'Drinks menu', sp_cafe_menu_d: 'Coffee, tea or juice: 🪙{n} each.', sp_cafe_table: 'A free table', sp_cafe_table_d: 'Sit down and someone you know comes over for a chat.', sp_cafe_sofa: 'Sofa', sp_cafe_sofa_d: 'Put your headphones on and listen to some music.', sp_clinic_bed: 'Exam bed', sp_clinic_bed_d: 'After your medicine, lie down for a bit and you’re well again.', sp_clinic_scale: 'Health check', sp_clinic_scale_d: 'See how you slept last night and how far you’ve walked today. Only you can see it.', sp_clinic_pharmacy: 'Pharmacy', sp_clinic_pharmacy_d: 'Buy medicine here when you’re ill.', sp_library_featured: 'Book of the day', sp_library_featured_d: 'Today’s card: half a minute of something good to know.', sp_library_table: 'Reading table', sp_library_table_d: 'Pick a book and sit down to read for a while.', sp_gym_treadmill: 'Treadmill', sp_gym_spinbike: 'Exercise bike', sp_gym_dumbbells: 'Dumbbells', sp_gym_boxing: 'Punch bag', sp_gym_yogamat: 'Yoga mat', sp_gym_d: 'A short workout puts you in a good mood. Real exercise still happens in real life!', sp_post_boxes: 'PO boxes', sp_post_boxes_d: 'See if there’s a letter for you.', sp_post_cards: 'Postcard rack', sp_post_cards_d: 'Send a friend a postcard from this town.', sp_school_desk: 'A free desk', sp_school_desk_d: 'Evening classes: sit down for a lesson.', sp_plaza_board: 'Town board', sp_plaza_board_d: 'The whole town’s wealth, and where you stand.', sp_police_board: 'Notice board', sp_police_board_d: 'Your record, and how the police work.', sp_firestation_truck: 'Fire engine', sp_firestation_truck_d: 'Climb up for a look and learn a fire-safety tip.', sp_gas_shelf: 'Snack shelf', sp_gas_shelf_d: 'Grab something to eat.', sp_gas_fridge: 'Drinks fridge', sp_gas_fridge_d: 'Cold drinks.', sp_eat_btn: 'Buy one and sit down 🪙{n} (food +{h})', sp_chat_btn: 'Sit down for a chat (social +{n})', sp_relax_btn: 'Sit and listen (fun +{n})', sp_read_btn: 'Sit down and read (fun +{n})', sp_gym_btn: 'Work out (fun +{n})', sp_gym_left: '{n} workouts left today', sp_done_today: 'Done for today. Come back tomorrow', sp_rest_btn: 'Lie down for a bit', sp_rest_med: 'Lie down (with your medicine, well in {n} s)', sp_check_btn: 'Start the check', sp_check_res: 'Last night’s sleep {s} · {k} steps today', sp_check_note: 'These numbers stay on your phone. Nobody else sees them.', sp_truck_btn: 'Climb up (fun +{n})', sp_tip: 'Today’s fire-safety tip', sp_mail_btn: 'Open your mailbox', sp_rank_btn: 'See the town board', sp_ate: 'Delicious', sp_chatted: 'A lovely chat with {name}', sp_relaxed: 'That was relaxing', sp_read_done: 'You read a chapter', sp_worked_out: 'Done! What a workout', sp_rested: 'Feeling rested', sp_cured: 'You’re well again!', sp_truck_done: 'What a cool fire engine', go_stopped: 'Stopped here. Tap anywhere to set off again',
  go_secs: 'about {n} s', go_no_car: 'No car yet', go_on_way: 'On the way to {to}…',
  area_canal: 'Canals', area_beach: 'Beach', area_river: 'Riverside', area_fjord: 'Fjord', area_harbour: 'Harbour', area_terrace: 'Hillside terraces',
});

// ---------- v0.12: public places ----------
Object.assign(STR.zh, {
  pl_go_first: '先过去，到了就能用：', pl_other_town: '这是别的社区的地方，搬过来就能用。',
  pl_desc_plaza: '小镇的中心：排行、小镇等级都在这里。', pl_desc_fields: '全镇一起种的麦田。每天来帮忙收一次，全镇凑满就开丰收节。',
  pl_desc_park: '散步、遛狗的好地方。狗狗在这里散一次步，今天的散步就够了。', pl_desc_lake: '每天可以钓一次鱼；游泳的时候迷你的你也会来这里游。',
  pl_desc_beach: '每天可以钓一次鱼；游泳的时候迷你的你也会来海里游。', pl_desc_bakery: '把自己种的小麦拿来，烤成香喷喷的面包，可以卖也可以送朋友。',
  pl_desc_cafe: '看看现在谁在线，去串个门。', pl_desc_market: '把仓库里的东西卖掉。', pl_desc_gym: '力量训练、拳击、高强度间歇的时候，迷你的你会来这里练。',
  pl_desc_library: '每天一张小知识卡，半分钟读完。', pl_desc_post: '给朋友寄一张小镇的明信片，朋友会收到。',
  pl_harvest_today: '今天全镇帮忙收麦子', pl_harvest_note: '大家一起帮忙，凑满就开丰收节，帮过忙的人都能拿到一个面包。', pl_fest: '丰收节！今天的麦子都收完了。',
  pl_help: '帮忙收麦子（用 1 件农活，得 {n} 束小麦）', pl_helped_today: '今天已经帮过忙了', pl_helped: '帮忙收了麦子，得到 {n} 束小麦', pl_fest_now: '丰收节！送你一个面包 🍞',
  pl_park_people: '公园里现在有 {n} 个人在散步。', pl_walk_dog: '遛狗', pl_stroll: '散散步', pl_dog_walked: '{n} 只狗狗散完步了，开心得直摇尾巴', pl_strolled: '在公园里散了散步',
  pl_fish: '钓鱼（每天一次，用 1 件农活）', pl_fished: '今天已经钓过了', pl_caught: '钓到了 {name}！', pl_swim_note: '用 Apple Watch 记录游泳时，迷你的你会来这里游。',
  pl_bake_note: '{n} 束小麦烤一个面包。仓库里有 {have} 束小麦、{bread} 个面包。', pl_bake: '烤面包', pl_baked: '面包烤好了，放进仓库', pl_need_wheat: '要 {n} 束小麦才能烤一个面包',
  pl_card_today: '今天的小知识', pl_read_it: '读完了', pl_read: '今天的已经读过了', pl_read_done: '读完了，明天还有新的', pl_read_n: '一共读过 {n} 张',
  pl_post_note: '寄一张{town}的明信片（每人每天一张）：', pl_send: '寄', pl_sent: '已寄出', pl_card_sent: '明信片寄给 {name} 了：来自{town}的问候', pl_no_friends: '还没有朋友，先去邀请一个吧。',
  pl_cafe_note: '这些人现在在线：', pl_nobody: '现在没人在线。', pl_market_note: '仓库里的鸡蛋、牛奶、菜、鱼、面包都可以在这里卖。', pl_sell: '去卖东西',
  pl_gym_note: '用 Apple Watch 记录力量训练、拳击、高强度间歇时，迷你的你会来这里练。', pl_gym_people: '现在有 {n} 个人在这里锻炼。',
  pl_plaza_note: '小镇现在 {lv} 级。大家的家越漂亮，小镇等级越高。', msg_postcard: '谢谢你的明信片！好喜欢 💌',
});
Object.assign(STR.en, {
  pl_go_first: 'Go there first; once you’re there you can use it:', pl_other_town: 'This place is in another community. Move here to use it.',
  pl_desc_plaza: 'The heart of town: the ranking and the town level.', pl_desc_fields: 'Wheat the whole town grows together. Help with the harvest once a day; when the town fills it, it’s harvest festival.',
  pl_desc_park: 'A place to stroll and walk the dog. One walk here and your dog’s walk is done for today.', pl_desc_lake: 'Fish here once a day. When you swim, mini-you swims here too.',
  pl_desc_beach: 'Fish here once a day. When you swim, mini-you swims in the sea.', pl_desc_bakery: 'Bring wheat you grew and bake bread to sell or give to friends.',
  pl_desc_cafe: 'See who’s online right now and drop by.', pl_desc_market: 'Sell what’s in your barn.', pl_desc_gym: 'During strength, boxing and HIIT workouts, mini-you trains here.',
  pl_desc_library: 'A card of something good to know every day; half a minute to read.', pl_desc_post: 'Send a friend a postcard from your town.',
  pl_harvest_today: 'Town harvest today', pl_harvest_note: 'Everyone helps; when it’s full it’s harvest festival and every helper gets a loaf of bread.', pl_fest: 'Harvest festival! Today’s wheat is all in.',
  pl_help: 'Help with the harvest (1 farm job, {n} wheat)', pl_helped_today: 'You helped today', pl_helped: 'You helped bring in the wheat: {n} wheat for you', pl_fest_now: 'Harvest festival! Here’s a loaf of bread 🍞',
  pl_park_people: '{n} people are out walking in the park.', pl_walk_dog: 'Walk the dog', pl_stroll: 'Take a stroll', pl_dog_walked: '{n} happy dog(s) walked, tails wagging', pl_strolled: 'A nice stroll in the park',
  pl_fish: 'Go fishing (once a day, 1 farm job)', pl_fished: 'You fished today', pl_caught: 'You caught a {name}!', pl_swim_note: 'When Apple Watch records a swim, mini-you swims here.',
  pl_bake_note: '{n} wheat make a loaf. Your barn has {have} wheat and {bread} bread.', pl_bake: 'Bake bread', pl_baked: 'Fresh bread, into the barn', pl_need_wheat: 'You need {n} wheat to bake a loaf',
  pl_card_today: 'Today’s card', pl_read_it: 'I read it', pl_read: 'You read today’s card', pl_read_done: 'Done, there’s a new one tomorrow', pl_read_n: '{n} read so far',
  pl_post_note: 'Send a postcard from {town} (one per friend a day):', pl_send: 'Send', pl_sent: 'Sent', pl_card_sent: 'Postcard sent to {name}: greetings from {town}', pl_no_friends: 'No friends yet. Invite one first.',
  pl_cafe_note: 'Online right now:', pl_nobody: 'Nobody is online right now.', pl_market_note: 'Eggs, milk, vegetables, fish and bread from your barn sell here.', pl_sell: 'Sell things',
  pl_gym_note: 'When Apple Watch records strength, boxing or HIIT, mini-you trains here.', pl_gym_people: '{n} people are working out here now.',
  pl_plaza_note: 'The town is level {lv}. The nicer everyone’s homes, the higher it goes.', msg_postcard: 'Thank you for the postcard! Love it 💌',
});

// ---------- v0.12: awards and statues ----------
Object.assign(STR.zh, {
  aw_title: 'Apple Watch 奖章 {n}/{total}', aw_new: '新奖章！', aw_hint: '像 Apple Watch 一样：活动目标翻倍、完美一周、步数新纪录、百万步……都会得到奖章。',
  excl_req_award: '{e} 拿到「{name}」奖章：{what}', excl_req_sport: '{e} {name}拿到金奖杯（{n} 次）',
  excl_sec_trophy: '奖杯专属', excl_sec_award: '奖章雕塑', excl_sec_statue: '运动金像（每种运动的金奖杯）', excl_all_statues: '看全部 {n} 座运动金像',
});
Object.assign(STR.en, {
  aw_title: 'Apple Watch awards {n}/{total}', aw_new: 'New award!', aw_hint: 'Like on Apple Watch: double your Move goal, a perfect week, a new step record, a million steps… each gives an award.',
  excl_req_award: '{e} Earn the “{name}” award: {what}', excl_req_sport: '{e} Gold trophy in {name} ({n} workouts)',
  excl_sec_trophy: 'Trophy exclusives', excl_sec_award: 'Award sculptures', excl_sec_statue: 'Golden sport statues (each sport’s gold)', excl_all_statues: 'See all {n} sport statues',
});

// ---------- v0.13 ----------
Object.assign(STR.zh, { car_cargo: '📦 一次能拉 {n} 件货去卖' });
Object.assign(STR.en, { car_cargo: '📦 Carries {n} goods to market' });

// ---------- v0.14: the market ----------
Object.assign(STR.zh, {
  mk_board: '今日收购价', mk_next: '{m} 后更新', mk_go: '去市场卖：', mk_carry: '走路一次带 {w} 件，开车带 {c} 件', mk_loaded: '装好了 {n} 件货（最多 {cap} 件）', mk_nothing: '仓库里没有能卖的东西',
  mk_unloaded: '没卖完的东西放回仓库了', mk_full: '装不下了，换辆大点的车或者先卖掉一些', mk_animal_on: '装上车了，带去市场卖吧', mk_take_animal: '带去市场卖（现价 🪙{n}）',
  mk_price_now: '市场现价 🪙{n}', mk_go_sell: '去市场卖', mk_shop_note: '东西要拉到市场去卖，价格每 4 小时变一次，有涨有跌。',
  mk_cargo: '带来的货 {n}/{cap}', mk_sell_all: '全部卖掉', mk_empty_load: '这次没带东西。回家装好再来（开车一次能拉更多）。',
});
Object.assign(STR.en, {
  mk_board: 'Prices right now', mk_next: 'next change in {m}', mk_go: 'Go and sell:', mk_carry: 'On foot you carry {w}; by car {c}', mk_loaded: 'Loaded {n} goods (room for {cap})', mk_nothing: 'Nothing in the barn to sell',
  mk_unloaded: 'What you didn’t sell went back into the barn', mk_full: 'No room left: take a bigger vehicle or sell some first', mk_animal_on: 'Loaded up: take it to the market to sell', mk_take_animal: 'Take to market (now 🪙{n})',
  mk_price_now: 'Market price 🪙{n}', mk_go_sell: 'Sell at the market', mk_shop_note: 'Goods are sold at the market in town. Prices change every 4 hours, up and down.',
  mk_cargo: 'Your load {n}/{cap}', mk_sell_all: 'Sell everything', mk_empty_load: 'You didn’t bring anything. Load up at home (a car carries more).',
});

// ---------- v0.14: weather on the farm ----------
Object.assign(STR.zh, {
  w_flooded: '大雨把 {n} 块地淹了：水退之前菜不长，成熟的菜会慢慢烂', w_frozen: '湖面结冰了，今天钓不了鱼', w_field_flooded: '这块地被水淹了，大约 {m} 后退水。水退之前菜不长，成熟的菜会慢慢烂掉一些。',
  w_farm_clear: '晴天：菜照常长。', w_farm_clouds: '多云：菜照常长。', w_farm_fog: '起雾：菜照常长。', w_farm_rain: '下雨：菜长得快 25%。',
  w_farm_heavy: '大雨：菜长得快，但地有可能被淹（淹了就不长，成熟的会烂）。', w_farm_storm: '暴风雨：地很可能被淹，成熟的菜最好早点收。', w_farm_snow: '下雪：菜长得慢一半，湖面结冰钓不了鱼。',
});
Object.assign(STR.en, {
  w_flooded: 'Heavy rain flooded {n} field(s): nothing grows until the water drains, and ripe crops start to spoil', w_frozen: 'The lake is frozen: no fishing today', w_field_flooded: 'This field is flooded; the water drains in about {m}. Nothing grows until then, and a ripe crop spoils a little.',
  w_farm_clear: 'Sunny: crops grow as usual.', w_farm_clouds: 'Cloudy: crops grow as usual.', w_farm_fog: 'Foggy: crops grow as usual.', w_farm_rain: 'Rain: crops grow 25% faster.',
  w_farm_heavy: 'Heavy rain: crops grow faster, but fields may flood (nothing grows, ripe crops spoil).', w_farm_storm: 'Storm: fields will likely flood; harvest ripe crops soon.', w_farm_snow: 'Snow: crops grow half as fast, and the lake freezes.',
});

// ---------- v0.14: jobs, illness, babies ----------
Object.assign(STR.zh, {
  pl_desc_clinic: '生病了来这里买药；也可以在这里上班。', job_hour: '小时', job_apply: '应聘这份工作', job_apply_note: '找份工作吧：按真实时间上班，下班拿工资。',
  job_switch_note: '你现在有别的工作，换工作的话和老板的关系从头开始。', job_switch_q: '要辞掉「{old}」换这份工作吗？和老板的关系会从头开始。', job_hired: '被录用了：{job}！到上班时间来这里点「开始上班」',
  job_start: '开始上班（到 {to}:00，能拿 🪙{n}）', job_started: '上班了，{to}:00 下班。上班的时候小人在这里，不能干别的', job_closed: '现在不是上班时间（{from}:00–{to}:00）',
  job_working: '上班中，还有 {m} 下班。已经挣了 🪙{n}（做满 🪙{full}）', job_quit: '提前下班（只拿 🪙{n}，老板会不太高兴）', job_leave_q: '你还在上班。现在走只能拿 🪙{n}，和老板的关系也会变差。要提前下班吗？',
  job_quit_done: '提前下班了：+🪙{n}，老板有点不高兴', job_done: '下班了！+🪙{n}，老板对你更满意了', job_promoted: '下班了！+🪙{n}，你升职了：{rank} 🎉',
  job_busy: '在{place}上班呢，下班再说', job_rel: '和老板的关系 {n}/100', job_next: '到 {n} 升职为「{rank}」',
  sick_well: '你身体很好，不用买药。', sick_here: '你生病了（{why}）：走路慢，现实里挣的金币也少一点。买药吃了，再回家在床上躺一会儿就好了。',
  sick_why_work: '连续上班太累了', sick_why_sleep: '最近没睡好', sick_why_cold: '着凉了', sick_buy: '买药（🪙{n}）', sick_med_have: '已经吃药了：回家在床上躺 {n} 秒就好了。',
  sick_med_bought: '吃药了：回家在床上躺 {n} 秒就好', sick_cured: '病好了！又精神了', snack_stole_baby: '偷偷抱走了一只 {e}，放进你的牧场', snack_baby_few: '他家这种小崽子只有一只，下不去手',
});
Object.assign(STR.en, {
  pl_desc_clinic: 'Buy medicine here when you’re ill; you can work here too.', job_hour: 'hr', job_apply: 'Apply for this job', job_apply_note: 'Get a job: work real-time shifts and get paid when they end.',
  job_switch_note: 'You have another job; switching starts the relationship with the boss from zero.', job_switch_q: 'Quit “{old}” for this job? The relationship with the boss starts over.', job_hired: 'Hired: {job}! Come here during the hours and tap “Start work”',
  job_start: 'Start work (until {to}:00, earns 🪙{n})', job_started: 'At work until {to}:00. While you work your townie stays here', job_closed: 'Not open for work now ({from}:00–{to}:00)',
  job_working: 'At work: {m} to go. Earned 🪙{n} so far (🪙{full} for the whole shift)', job_quit: 'Leave early (only 🪙{n}; the boss won’t like it)', job_leave_q: 'You’re still at work. Leaving now pays only 🪙{n} and the boss will like you less. Leave early?',
  job_quit_done: 'Left early: +🪙{n}, the boss isn’t happy', job_done: 'Shift done! +🪙{n}, the boss is pleased', job_promoted: 'Shift done! +🪙{n}, and you’re promoted: {rank} 🎉',
  job_busy: 'At work at the {place}; after work', job_rel: 'Boss relationship {n}/100', job_next: '{n} to be promoted to {rank}',
  sick_well: 'You’re well; no medicine needed.', sick_here: 'You’re ill ({why}): you walk slower and real-life rewards are a bit smaller. Take medicine, then lie in bed at home for a little while.',
  sick_why_work: 'too many work days in a row', sick_why_sleep: 'poor sleep lately', sick_why_cold: 'caught a cold', sick_buy: 'Buy medicine (🪙{n})', sick_med_have: 'Medicine taken: lie in bed at home for {n} seconds.',
  sick_med_bought: 'Medicine taken: lie in bed at home for {n} seconds', sick_cured: 'All better!', snack_stole_baby: 'You sneaked off with a {e} for your pasture', snack_baby_few: 'They only have one of these; you can’t do it',
});

// ---------- v0.15: moving farm areas ----------
Object.assign(STR.zh, {
  tray_areas: '地块', area_pasture: '牧场', area_fields: '菜地', area_orchard: '果园', area_pond: '池塘',
  area_note: '选一块地，再点院子里的新位置（它的左上角）。不能压住房子、车道、小路和别的东西，也不能挡路。',
  area_tap_new: '点院子里的新位置，把{name}搬过去', area_moved: '{name}搬好了', area_no_room: '这里放不下（压住了房子、小路或别的东西）',
});
Object.assign(STR.en, {
  tray_areas: 'Farm areas', area_pasture: 'Pasture', area_fields: 'Fields', area_orchard: 'Orchard', area_pond: 'Pond',
  area_note: 'Pick an area, then tap its new spot in the yard (its top-left corner). It can’t cover the house, drive, path or anything else, or block the way.',
  area_tap_new: 'Tap the new spot for the {name}', area_moved: '{name} moved', area_no_room: 'It doesn’t fit there (it would cover the house, the path or something else)',
});

// ---------- v0.16 ----------
Object.assign(STR.zh, { go_here: '去这里', go_here_short: '那里', live_at: '迷你的你正在{place}运动', live_see: '去看看' });
Object.assign(STR.en, { go_here: 'Go here', go_here_short: 'there', live_at: 'Mini-you is working out at the {place}', live_see: 'Watch' });

// ---------- v0.17: stores ----------
Object.assign(STR.zh, {
  shop_catalog: '商品目录', store_sells: '这些东西在{name}卖，要去店里才能买', store_here: '你就在{name}', store_go: '去店里', store_inside: '在{name}里', store_leave: '出店',
  store_enter: '进店看看', store_enter_market: '进店买种子', store_buy_there: '要去{name}才能买',
  st_short_nursery: '树苗、花草和院子里的东西。', st_short_ranch: '鸡鸭牛羊各种牲畜。', st_short_petshop: '小狗小猫、宠物粮和宠物用品。', st_short_furniture: '屋里用的家具。',
  st_short_realty: '买房子、买地、扩建农场。', st_short_dealer: '自行车、汽车、卡车。', st_short_mall: '衣服鞋帽、奖杯专属、电影院、游戏厅、美食广场。',
  st_desc_nursery: '这里卖果树、院子里的树、花、喷泉和各种装饰。进店就能买。', st_desc_ranch: '这里卖鸡、鸭、兔子、羊、猪、牛和羊驼的小崽子。进店就能买。',
  st_desc_petshop: '这里能领养小狗小猫，也卖宠物粮、零食和宠物用品。', st_desc_furniture: '沙发、床、桌椅、灯、装饰……家里用的都在这里。',
  st_desc_realty: '房产中介：买新房子、扩建菜地 / 牧场 / 果园 / 池塘、买旁边的地。', st_desc_dealer: '车行：自行车、摩托、轿车、SUV、跑车、卡车。车越大一次拉的货越多。',
  st_desc_mall: '购物中心：服装店（衣服、裤子、鞋、帽子）、奖杯专属店、电影院、游戏厅和美食广场。',
});
Object.assign(STR.en, {
  shop_catalog: 'Catalogue', store_sells: 'Sold at the {name}: go to the store to buy', store_here: 'You’re at the {name}', store_go: 'Go there', store_inside: 'In the {name}', store_leave: 'Leave',
  store_enter: 'Go inside', store_enter_market: 'Go in for seeds', store_buy_there: 'You can buy that at the {name}',
  st_short_nursery: 'Saplings, flowers and things for the yard.', st_short_ranch: 'Chickens, ducks, sheep, cows and more.', st_short_petshop: 'Puppies, kittens, pet food and supplies.', st_short_furniture: 'Furniture for your home.',
  st_short_realty: 'Houses, land and farm upgrades.', st_short_dealer: 'Bikes, cars and trucks.', st_short_mall: 'Clothes, trophy exclusives, a cinema, an arcade and a food court.',
  st_desc_nursery: 'Fruit trees, yard trees, flowers, fountains and all kinds of yard things. Go in to buy.', st_desc_ranch: 'Chicks, ducklings, bunnies, lambs, piglets, calves and crias. Go in to buy.',
  st_desc_petshop: 'Adopt a puppy or a kitten, and buy pet food, treats and supplies.', st_desc_furniture: 'Sofas, beds, tables, lamps, decorations: everything for inside your home.',
  st_desc_realty: 'Estate agent: new houses, bigger fields / pasture / orchard / pond, and the land next door.', st_desc_dealer: 'Car dealer: bikes, motorbikes, cars, SUVs, sports cars, trucks. Bigger vehicles carry more to the market.',
  st_desc_mall: 'Shopping mall: a clothing store (tops, bottoms, shoes, hats), the trophy exclusives, a cinema, an arcade and a food court.',
});

// ---------- v0.18: bodies and clothes ----------
Object.assign(STR.zh, {
  cat_clothes: '服装', wardrobe: '衣柜', fab_wardrobe: '衣柜', wearing: '穿着', wear: '穿上', clothes_bought: '买了{name}，已经穿上了',
  clothes_note: '在购物中心的服装店买，买了就是你的，颜色在衣柜里随便换。', slot_top: '上衣', slot_bottom: '下装', slot_shoes: '鞋', slot_hat: '帽子',
  wd_body: '身材', wd_top: '上衣', wd_bottom: '下装', wd_shoes: '鞋', wd_hat: '帽子', wd_more: '去购物中心买更多',
  wd_body_note: '身材是你自己选的，和健康数据无关，随时能换。', wd_dress_note: '穿着连衣裙时看不到下装。',
});
Object.assign(STR.en, {
  cat_clothes: 'Clothes', wardrobe: 'Wardrobe', fab_wardrobe: 'Wardrobe', wearing: 'Wearing', wear: 'Wear', clothes_bought: 'Bought the {name}, you’re wearing it',
  clothes_note: 'Sold at the mall’s clothing store. Once it’s yours, change its colour any time in the wardrobe.', slot_top: 'Top', slot_bottom: 'Bottoms', slot_shoes: 'Shoes', slot_hat: 'Hat',
  wd_body: 'Body', wd_top: 'Tops', wd_bottom: 'Bottoms', wd_shoes: 'Shoes', wd_hat: 'Hats', wd_more: 'Buy more at the mall',
  wd_body_note: 'Your build is your choice, not your health data. Change it any time.', wd_dress_note: 'A dress covers the bottoms.',
});

// ---------- v0.18: police ----------
Object.assign(STR.zh, {
  st_short_police: '偷东西被抓得太多，警察会来。',
  st_desc_police: '偷菜被狗或邻居看见：赔给主人东西价值的两倍。{d} 天内被抓 {s} 次，或者偷小动物被抓：警察会来，罚得更多（🪙{lo}–{hi}），还要在拘留室待 {m} 分钟（可以交 🪙{b} 保释提前出来）。',
  police_record: '最近 {d} 天被抓', police_clean: '没有记录 ✨', police_private: '只有你自己能看到。',
  snack_witness_fine: '被邻居看见了！赔给{name} 🪙{n}', jail_in: '你在拘留室里，还要 {m}。罚款 🪙{n} 已经赔给了{name}。',
  jail_why_baby: '偷小动物被抓到了。', jail_why_repeat: '这周被抓太多次了。', jail_note: '拘留时不能出门、干活、种地和偷菜。现实里的运动、睡眠照样算钱。',
  jail_bail: '交保释金 🪙{n}，现在出来', jail_bailed: '交了保释金，出来了。下次小心点！', jail_out: '时间到，从警察局出来了。',
  jail_busy: '你在警察局里，还要 {m} 才能出来',
});
Object.assign(STR.en, {
  st_short_police: 'Get caught stealing too often and the police come.',
  st_desc_police: 'Seen by a dog or a neighbour while stealing: pay the owner twice what you took. Caught {s} times in {d} days, or caught taking a baby animal: the police come, a bigger fine (🪙{lo}–{hi}) and {m} minutes in the holding cell (pay 🪙{b} bail to leave early).',
  police_record: 'Caught in the last {d} days', police_clean: 'Clean record ✨', police_private: 'Only you can see this.',
  snack_witness_fine: 'A neighbour saw you! You paid {name} 🪙{n}', jail_in: 'You’re in the holding cell for {m} more. Your 🪙{n} fine went to {name}.',
  jail_why_baby: 'Caught taking a baby animal.', jail_why_repeat: 'Caught too many times this week.', jail_note: 'While held you can’t go out, work, farm or steal. Real-life movement and sleep still earn coins.',
  jail_bail: 'Pay 🪙{n} bail and leave now', jail_bailed: 'Bail paid, you’re out. Be careful next time!', jail_out: 'Time’s up: you’re out of the police station.',
  jail_busy: 'You’re at the police station for {m} more',
});

// ---------- v0.18: the mall ----------
Object.assign(STR.zh, {
  act_cinema: '电影院', act_claw: '抓娃娃', act_food: '美食广场', cinema_note: '一场 🪙{n}', seen_n: '看过 {n}/{total}', movie_leave: '离开影厅',
  claw_note: '一次 🪙{n}，大约 {p}% 能抓到。抓到的玩偶放进仓库，进屋点「设计」就能摆出来。', claw_try: '抓一次 🪙{n}', claw_win: '抓到了{name}！已经放进仓库', claw_miss: '差一点点！再试试？',
  claw_got: '收集了 {n}/{total} 个玩偶', food_note: '点一份就开吃', tried_n: '尝过 {n}/{total}', food_ate: '{name}真好吃！😋',
});
Object.assign(STR.en, {
  act_cinema: 'Cinema', act_claw: 'Claw machine', act_food: 'Food court', cinema_note: '🪙{n} a ticket', seen_n: 'Seen {n}/{total}', movie_leave: 'Leave the cinema',
  claw_note: '🪙{n} a go, about a {p}% chance. Prizes go to storage: tap Design at home to place them.', claw_try: 'Try for 🪙{n}', claw_win: 'You won the {name}! It’s in storage', claw_miss: 'So close! Try again?',
  claw_got: '{n}/{total} plush toys collected', food_note: 'Tap a dish to eat', tried_n: 'Tried {n}/{total}', food_ate: 'The {name} was delicious! 😋',
});

// ---------- v0.19: going places for real ----------
Object.assign(STR.zh, {
  go_home: '回家', go_home_short: '家', go_to_car: '先去取车…', away_at: '你在{place}', away_street: '街上', away_snack: '你现在在{place}，要先回家',
  car_out_first: '你的车还停在外面，先把它开回家再换车',
});
Object.assign(STR.en, {
  go_home: 'Go home', go_home_short: 'home', go_to_car: 'Walking to your car…', away_at: 'You’re at the {place}', away_street: 'out in town', away_snack: 'You’re at the {place}: go home first',
  car_out_first: 'Your car is parked out in town: drive it home before you switch cars',
});
Object.assign(STR.zh, {
  land_garage: '车库', garage_cars: '{n} 个车位', garage_new: '在院子里盖，{n} 个车位', garage_up: '升级到 {n} 个车位，更气派', garage_max: '已经是最豪华的车库（5 个车位）',
  garage_space: '院子里放不下这么大的车库：先挪一挪地块，或者买旁边的地', garage_full: '车位满了：车道停一辆，车库每个车位停一辆。去房产中介盖 / 扩车库',
  snack_land_garage: '车库盖好了 🚗', area_garage: '车库',
});
Object.assign(STR.en, {
  land_garage: 'Garage', garage_cars: '{n} spaces', garage_new: 'Built in your yard, {n} space', garage_up: 'Upgrade to {n} spaces, and grander', garage_max: 'The grandest garage (5 spaces)',
  garage_space: 'A garage that big won’t fit in your yard: move things around or buy the land next door', garage_full: 'No space: one car in the drive, one per garage space. Build or extend a garage at the estate agent',
  snack_land_garage: 'Your garage is built 🚗', area_garage: 'Garage',
});

// ---------- v0.20: shopping in a real store ----------
Object.assign(STR.zh, {
  shop_clerk: '店员', shop_tip: '看中什么就点它，放进购物车，再去找店员结账', basket_leave_q: '购物车里还有 {n} 件东西，放回去出店吗？',
  basket_added: '{name} 放进购物车了（{n} 件）', basket_add: '放进购物车', basket_pay: '去结账 · {n} 件 · 🪙{v}', checkout_short: '结账', checkout_title: '结账', checkout_total: '一共',
  paid_hands: '付好了，{n} 件东西拿在手上，回到家就放好', paid_trunk: '付好了，{n} 件东西放进后备箱，车开回家就搬进去', paid_deliver: '付好了，{n} 件东西约 {m} 分钟后送到家',
  ware_no_poor: '钱不够', ware_no_noorchard: '还没有果园：先去房产中介建果园', ware_no_full: '家里放不下了（果园 / 牧场满了）', ware_no_nopasture: '还没有牧场：先去房产中介建牧场',
  ware_no_petfull: '最多养 {n} 只宠物', ware_no_own: '已经有了', ware_no_locked: '要先拿到对应的奖杯', ware_sign: '签合同', ware_big: '大件：开车运或送货', ware_small: '小件：可以拿在手上',
  car_delivered: '车行约 {m} 分钟后把车送到家', car_ordered: '{name} 买好了，约 {m} 分钟后送到你家车库',
  clerk_hi: '欢迎来到{name}！看中什么就点它，放进购物车，再来找我结账。', clerk_pay: '这些都要吗？选一下怎么带回家。', clerk_sell: '卖东西',
  take_how: '怎么带回家', take_hands: '拿在手上', take_trunk: '放进后备箱', take_deliver: '送货上门 🪙{n}（约 {m} 分钟）',
  take_hands_ok: '回到家就放好', take_trunk_ok: '后备箱 {v}/{c}，车开回家就搬进去', take_deliver_ok: '不用自己搬，到了会通知你',
  take_no_big: '有大件，拿不动', take_no_heavy: '太多了，拿不动', take_no_nocar: '你没开车来（车不在这家店的停车场）', take_no_carfull: '后备箱装不下',
  unloaded: '把 {n} 件东西搬回家了', unloaded_back: '（{n} 件放不下，钱退给你了）', delivered: '送货到了：{n} 件东西已经放到家里',
});
Object.assign(STR.en, {
  shop_clerk: 'Shopkeeper', shop_tip: 'Tap what you like to put it in your basket, then pay the shopkeeper', basket_leave_q: '{n} things are still in your basket. Put them back and leave?',
  basket_added: '{name} is in your basket ({n})', basket_add: 'Into the basket', basket_pay: 'Pay · {n} things · 🪙{v}', checkout_short: 'Pay', checkout_title: 'Checkout', checkout_total: 'Total',
  paid_hands: 'Paid: you’re carrying {n} things, they go in when you get home', paid_trunk: 'Paid: {n} things in the boot, unloaded when the car gets home', paid_deliver: 'Paid: {n} things arrive at your home in about {m} min',
  ware_no_poor: 'Not enough coins', ware_no_noorchard: 'No orchard yet: build one at the estate agent', ware_no_full: 'No room at home (orchard / pasture full)', ware_no_nopasture: 'No pasture yet: build one at the estate agent',
  ware_no_petfull: 'Up to {n} pets', ware_no_own: 'You have it already', ware_no_locked: 'Win its trophy first', ware_sign: 'Sign', ware_big: 'Big: by car or delivery', ware_small: 'Small: you can carry it',
  car_delivered: 'The dealer brings it home in about {m} min', car_ordered: 'Bought the {name}: it’s delivered to your garage in about {m} min',
  clerk_hi: 'Welcome to the {name}! Tap anything you like to put it in your basket, then come to me to pay.', clerk_pay: 'All of these? Choose how they get home.', clerk_sell: 'Sell things',
  take_how: 'How do they get home?', take_hands: 'Carry them', take_trunk: 'In the boot', take_deliver: 'Delivery 🪙{n} (about {m} min)',
  take_hands_ok: 'They go in when you get home', take_trunk_ok: 'Boot {v}/{c}: unloaded when the car gets home', take_deliver_ok: 'No carrying: you’ll be told when it arrives',
  take_no_big: 'Something is too big to carry', take_no_heavy: 'Too much to carry', take_no_nocar: 'You didn’t drive here (your car isn’t in this car park)', take_no_carfull: 'It won’t fit in the boot',
  unloaded: 'Brought {n} things home', unloaded_back: '({n} didn’t fit: refunded)', delivered: 'Delivery: {n} things are at your home',
});
Object.assign(STR.zh, { act_trophies: '奖杯专属' });
Object.assign(STR.en, { act_trophies: 'Trophy shop' });

// ---------- v0.20: what the mall's fun is for ----------
Object.assign(STR.zh, {
  movie_poster: '看完了！《{name}》的海报放进仓库了，可以摆在家里（家产会多一点）', cinema_use: '看电影：娱乐 +{f}、社交 +{s}（心情好打工多挣）。每看一部新电影，还得到它的海报，可以摆在家里，家产也会多一点。',
  claw_use: '每抓一次娱乐 +{c}。玩偶可以摆在家里，家产会多一点；6 个都抓到，再送你一只巨型泰迪熊。', claw_big: '6 个玩偶全收集齐了！送你一只巨型泰迪熊，在仓库里',
  food_use: '吃东西补饱腹。吃饱了 {h} 小时：打工工资多 {p}%，走路快 {w}%。', food_full: '吃饱了 {h} 小时：打工多赚 {p}%', food_still: '现在还饱着，还有 {m}',
});
Object.assign(STR.en, {
  movie_poster: 'That was fun! The {name} poster is in storage: put it up at home (it adds to your home’s worth)', cinema_use: 'A film: fun +{f}, social +{s} (a good mood means more pay). Every new film also gives you its poster for your home, which adds to its worth.',
  claw_use: 'Each go: fun +{c}. Plush toys decorate your home and add to its worth. Win all six and you get a giant teddy too.', claw_big: 'All six plush toys! Here’s a giant teddy, it’s in storage',
  food_use: 'Eating fills your hunger. Full for {h} hours: {p}% more pay at work, {w}% quicker on foot.', food_full: 'Full for {h} hours: {p}% more pay at work', food_still: 'Still full for {m}',
});

// ---------- v0.22 ----------
Object.assign(STR.zh, {
  fab_findme: '我在哪', you_here: '你在这里', go_which_car: '开哪辆车（先走到车道 / 车库去取）',
  st_short_school: '晚上可以来上课，拿证书，工资会涨。', st_short_firestation: '镇上的消防员和消防车。', st_short_gas: '加油、买点零食。',
  st_desc_school: '夜校：每天可以上一节课（🪙{n}）。每上 {m} 节课拿一张证书，每张证书让所有工作的工资多 {p}%（最多 {max} 张）。',
  st_desc_firestation: '消防站：消防员随时待命，门口停着消防车。', st_desc_gas: '加油站：车可以在这里加油（现在加油还不收钱）。',
  school_certs: '证书', school_next: '下一张证书', school_pay_now: '现在工资多 {p}%', school_take: '上一节课 🪙{n}', school_done: '今天的课上完了，明天再来',
  school_max: '证书都拿齐了', school_class: '上完一节课（{n}/{m}）', school_cert: '拿到第 {n} 张证书！工资一共多 {p}%',
});
Object.assign(STR.en, {
  fab_findme: 'Find me', you_here: 'You’re here', go_which_car: 'Which car? (you walk to the drive / garage for it)',
  st_short_school: 'Evening classes: earn certificates for better pay.', st_short_firestation: 'The town’s firefighters and their engine.', st_short_gas: 'Fuel and snacks.',
  st_desc_school: 'Evening school: one class a day (🪙{n}). Every {m} classes earn a certificate; each one raises the pay of every job by {p}% (up to {max}).',
  st_desc_firestation: 'Fire station: the firefighters are always ready, the engine parked out front.', st_desc_gas: 'Petrol station: fill up here (free for now).',
  school_certs: 'Certificates', school_next: 'Next certificate', school_pay_now: 'Pay is {p}% higher now', school_take: 'Take a class 🪙{n}', school_done: 'Today’s class is done: come back tomorrow',
  school_max: 'You have every certificate', school_class: 'Class done ({n}/{m})', school_cert: 'Certificate {n}! Pay is {p}% higher in all',
});

// ---------- v0.23: the mall's two floors and cinema ----------
Object.assign(STR.zh, {
  shop_clothes: '服装店', mall_1f: '购物中心 1F', mall_2f: '购物中心 2F', mall_up: '上二楼', mall_down: '下一楼', act_arcade: '游戏厅',
  cinema_tickets: '售票处', cinema_out: '出影厅', film_soon: '电影马上开始', film_none: '在二楼售票处买票', film_go: '买好《{name}》的票了，进影厅找座位', film_done: '《{name}》看完了',
  food_had: '吃过', food_new: '还没吃过', food_buy: '点一份 🪙{n}',
});
Object.assign(STR.en, {
  shop_clothes: 'Clothing store', mall_1f: 'Mall · Ground floor', mall_2f: 'Mall · First floor', mall_up: 'Upstairs', mall_down: 'Downstairs', act_arcade: 'Arcade',
  cinema_tickets: 'Tickets', cinema_out: 'Exit', film_soon: 'The film starts soon', film_none: 'Buy a ticket at the booth upstairs', film_go: 'Ticket for {name}: find your seat', film_done: 'You watched {name}',
  food_had: 'Had it', food_new: 'Not tried yet', food_buy: 'Order 🪙{n}',
});

// ---------- v0.24 ----------
Object.assign(STR.zh, {
  tray_hint_yard: '按住任何东西、地块、车道或车库拖到新地方就能挪；点一下房子换墙和屋顶的颜色，点车道换样式', tray_hint_room: '按住家具拖到新地方就能挪；点一下家具换颜色',
  tray_drag_it: '按住拖动就能挪', tray_drag_area: '按住拖动到新地方（放得下就放好了）', area_drive: '车道', free: '免费',
  drive_note: '车道停 {n} 辆 + 车库 {g} 辆', drive_built: '{name}修好了', drive_no_room: '院子里放不下这种车道：先挪一挪东西', drive_cars: '车太多了，这种车道停不下',
  in_garage: '在车库里', on_drive: '在车道上', garage_spaces: '车道 {d} 个车位 + 车库 {g} 个车位，你有 {n} 辆车', no_cars: '还没有车',
  school_take: '上一节课 🪙{n}（{m} 分钟）', school_started: '开始上课，{m} 分钟后下课', school_busy: '正在上课，还有 {m}', school_in_class: '正在上课，还有 {m}',
});
Object.assign(STR.en, {
  tray_hint_yard: 'Press and drag anything, a farm area, the drive or the garage to move it; tap the house to recolour it, the drive to change its design', tray_hint_room: 'Press and drag furniture to move it; tap a piece to recolour it',
  tray_drag_it: 'Press and drag to move it', tray_drag_area: 'Press and drag it somewhere new (it stays if it fits)', area_drive: 'Drive', free: 'Free',
  drive_note: '{n} on the drive + {g} in the garage', drive_built: 'Your {name} is built', drive_no_room: 'That drive won’t fit: move some things first', drive_cars: 'Too many cars for that drive',
  in_garage: 'In the garage', on_drive: 'On the drive', garage_spaces: '{d} drive spaces + {g} garage spaces; you have {n} cars', no_cars: 'No cars yet',
  school_take: 'Take a class 🪙{n} ({m} min)', school_started: 'Class has started: it ends in {m} min', school_busy: 'In class for {m} more', school_in_class: 'In class for {m} more',
});

// ---------- v0.25: needs and people ----------
Object.assign(STR.zh, {
  needs_title: '状态', need_hunger: '饱腹', need_social: '社交', need_fun: '娱乐', mood_good: '心情好：打工工资 +{p}%', mood_note: '三条平均 70 以上心情好，打工多挣一点',
  need_hunger_tip: '吃饭补：美食广场、咖啡馆、面包店，或在家用自己种的东西做饭', need_social_tip: '和人聊天、去朋友家、写信', need_fun_tip: '看电影、抓娃娃、在公园散步',
  cook_btn: '在家做饭（用仓库里 2 样东西）', cook_need_kitchen: '要有厨房或灶台才能做饭', cook_need_food: '仓库里至少要有 2 样能吃的东西', cook_ok: '做了一顿饭，吃饱了',
  snack_buy: '买点吃的 🪙{n}（饱腹 +{h}）', snack_ok: '吃了点东西',
  chat_walk_btn: '走过去聊聊天', go_strolling: '在公园里散步…', go_to_chat: '走过去找{name}聊天…', pl_stroll_lap: '绕公园走一圈（娱乐 +{f}）', pl_park_here: '公园里的人：点「聊聊天」走过去', boss: '老板', coworker: '同事', friend: '好朋友', neighbour: '邻居', rel_level: '熟悉度 {n}', chat_btn: '聊聊天', chat_done: '今天已经聊过了', chat_go_out: '出门在外的时候才能和人聊天',
  job_people: '一起工作的人', job_people_note: '上班时可以和他们聊天；下班在公园也可能碰到', chat_ok: '和{name}聊得很开心', chat_boss_ok: '和老板{name}聊了聊，老板对你印象更好了', chat_boss_note: '和老板聊天：工作关系 +3（升职更快）', chat_mate_note: '和同事聊天：工作关系 +1，社交也会补',
});
Object.assign(STR.en, {
  needs_title: 'How you are', need_hunger: 'Hunger', need_social: 'Social', need_fun: 'Fun', mood_good: 'Good mood: +{p}% pay at work', mood_note: 'All three at 70+ on average: a good mood, a bit more pay',
  need_hunger_tip: 'Eat: the food court, the café, the bakery, or cook at home with what you grow', need_social_tip: 'Talk to people, visit friends, write letters', need_fun_tip: 'Films, the claw machine, a stroll in the park',
  cook_btn: 'Cook at home (2 things from your barn)', cook_need_kitchen: 'You need a kitchen or a stove to cook', cook_need_food: 'You need at least 2 things to eat in your barn', cook_ok: 'You cooked a meal: full',
  snack_buy: 'Get a bite 🪙{n} (hunger +{h})', snack_ok: 'That hit the spot',
  chat_walk_btn: 'Walk over and chat', go_strolling: 'Strolling round the park…', go_to_chat: 'Walking over to chat with {name}…', pl_stroll_lap: 'A lap of the park (fun +{f})', pl_park_here: 'People in the park: tap Chat to walk over', boss: 'Boss', coworker: 'Coworker', friend: 'Friend', neighbour: 'Neighbour', rel_level: 'Know them {n}', chat_btn: 'Have a chat', chat_done: 'You’ve talked today', chat_go_out: 'You can talk to people when you’re out in town',
  job_people: 'People you work with', job_people_note: 'Talk to them at work, or bump into them in the park', chat_ok: 'A lovely chat with {name}', chat_boss_ok: 'A chat with your boss {name}: they think well of you', chat_boss_note: 'Talking to your boss: work +3 (faster promotion)', chat_mate_note: 'Talking to a coworker: work +1, and it helps your social need',
});

// ---------- v0.26: the phone ----------
Object.assign(STR.zh, {
  ph_name: '手机', ph_contacts: '通讯录', ph_texts: '消息', ph_bank: '银行', ph_stocks: '股票', ph_mail: '信件', ph_map: '我在哪', ph_friends: '好朋友', ph_work: '工作', ph_people: '镇上认识的人',
  ph_no_contacts: '还没有联系人。交朋友、去上班、在镇上和人聊天，他们就会出现在这里。', ph_call: '打电话', ph_call_again: '再打一次', ph_text: '发消息', ph_meet: '约到公园见',
  ph_person_note: '每天第一次打电话：社交 +{c}；第一次发消息：社交 +{x}。约到公园：对方会在公园等你一小时，走过去就能聊。',
  ph_calling: '通话中…', ph_call_ok: '聊得很开心：社交 +{n}，熟悉度 +3', ph_call_done: '今天已经打过电话了（只聊天，不再加社交）', ph_hang: '挂断',
  ph_say_hi: '打个招呼吧 👋', ph_no_texts: '还没有消息。', ph_new_text: '给谁发消息', meet_ok: '{name}说：好呀，我在公园等你！', meet_done: '今天已经约过了',
  text_new: '{name}给你发了消息', bank_net: '我的家产（房子、车、东西、钱包、存款、股票，减去贷款）', bank_debt: '其中还欠贷款 🪙{n}', bank_wallet: '钱包', bank_save: '存款', bank_all: '全部',
  bank_rate: '存款每天利息 {p}%（最多算 🪙{cap}），今天约 🪙{n}', bank_in_out: '⬇ 存进银行　⬆ 取出来', bank_empty: '存款不够',
  loan_list: '贷款', loan_none: '没有贷款。在房产中介或车行可以贷款买房买车。', loan_next: '下次还 🪙{n}，{m} 后自动扣（先扣钱包，不够扣存款）',
  loan_late_row: '钱不够，这期还没还上。存点钱就会自动补上；补上前不能再贷款。', loan_repay: '提前还清 🪙{n}', loan_paid_off: '贷款还清了！',
  loan_late_note: '钱不够还这期贷款，存点钱会自动补上', loan_btn: '贷款买：首付 🪙{n}，每天还 🪙{d}，{days} 天', loan_title: '贷款买 {name}',
  loan_price: '价格', loan_down: '首付（现在付）', loan_amount: '贷款', loan_fee: '手续费（{p}%）', loan_daily: '每天还', loan_daily_v: '🪙{n} × {d} 天',
  loan_rule: '每天自动从钱包扣（不够扣存款）。钱不够也不会收走东西，只是还上之前不能再贷款。随时可以提前还清。', loan_sign: '签贷款合同',
  loan_no_late: '你有一笔贷款还没还上，先还上才能再贷款。', loan_no_maxloans: '最多同时有 2 笔贷款。', loan_no_poor: '首付的钱不够。', loan_no_wood: '木材不够（木材要自己付）。',
  loan_house_ok: '贷款买下了{name}！每天会自动还款', loan_car_ok: '贷款买下了{name}，{m} 分钟后送到家！每天会自动还款',
  stock_mine: '我的股票', stock_have: '持有 {n} 股', stock_note: '价格每 {m} 分钟变一次，有涨有跌。买卖各收 {p}% 手续费。别把要用的钱都放进去。',
  stock_24h: '24 小时', stock_own: '我持有', stock_value: '现在值', stock_buy: '买', stock_sell: '卖', stock_max: '最多', stock_wallet: '钱包里有 🪙{n}',
  news_up_1: '{name}：新产品卖得很好', news_up_2: '{name}：这季度赚得比预期多', news_up_3: '{name}：在镇上开了新店', news_down_1: '{name}：原料涨价了', news_down_2: '{name}：来了新的竞争对手', news_down_3: '{name}：最近生意清淡',
});
Object.assign(STR.en, {
  ph_name: 'Phone', ph_contacts: 'Contacts', ph_texts: 'Messages', ph_bank: 'Bank', ph_stocks: 'Stocks', ph_mail: 'Letters', ph_map: 'Find me', ph_friends: 'Friends', ph_work: 'Work', ph_people: 'People in town',
  ph_no_contacts: 'No contacts yet. Make friends, get a job, talk to people in town, and they’ll show up here.', ph_call: 'Call', ph_call_again: 'Call again', ph_text: 'Message', ph_meet: 'Meet at the park',
  ph_person_note: 'First call of the day: social +{c}; first message: social +{x}. Meet at the park: they wait there for an hour; walk over to chat.',
  ph_calling: 'On a call…', ph_call_ok: 'A lovely chat: social +{n}, know them +3', ph_call_done: 'You’ve called today already (a nice chat, no more social)', ph_hang: 'Hang up',
  ph_say_hi: 'Say hi 👋', ph_no_texts: 'No messages yet.', ph_new_text: 'New message', meet_ok: '{name}: sure, see you at the park!', meet_done: 'Already arranged today',
  text_new: '{name} sent you a message', bank_net: 'Home worth (house, cars, things, wallet, savings, shares, minus loans)', bank_debt: 'Still owed on loans: 🪙{n}', bank_wallet: 'Wallet', bank_save: 'Savings', bank_all: 'All',
  bank_rate: 'Savings earn {p}% a day (on up to 🪙{cap}); about 🪙{n} today', bank_in_out: '⬇ pay in　⬆ take out', bank_empty: 'Not enough savings',
  loan_list: 'Loans', loan_none: 'No loans. Take one at the estate agent or the car dealer.', loan_next: 'Next payment 🪙{n} in {m} (from your wallet, then savings)',
  loan_late_row: 'Not enough money for this payment. Save some and it’s paid automatically; no new loans until then.', loan_repay: 'Pay it all off 🪙{n}', loan_paid_off: 'Loan paid off!',
  loan_late_note: 'Not enough money for a loan payment; it’ll go through once you have it', loan_btn: 'Loan: 🪙{n} down, 🪙{d} a day for {days} days', loan_title: 'Buy {name} with a loan',
  loan_price: 'Price', loan_down: 'Down payment (now)', loan_amount: 'Loan', loan_fee: 'Fee ({p}%)', loan_daily: 'Each day', loan_daily_v: '🪙{n} × {d} days',
  loan_rule: 'Paid automatically each day from your wallet (then savings). If you’re short nothing is taken away; you just can’t borrow again until you catch up. Pay it off any time.', loan_sign: 'Sign the loan',
  loan_no_late: 'You’re behind on a loan; catch up first.', loan_no_maxloans: 'Two loans at a time at most.', loan_no_poor: 'Not enough for the down payment.', loan_no_wood: 'Not enough wood (wood isn’t lent).',
  loan_house_ok: 'You bought {name} with a loan! Payments go out each day', loan_car_ok: 'You bought the {name} with a loan; it arrives in {m} min! Payments go out each day',
  stock_mine: 'My shares', stock_have: '{n} shares', stock_note: 'Prices change every {m} minutes, up and down. {p}% fee to buy or sell. Don’t put in money you need.',
  stock_24h: '24 h', stock_own: 'I own', stock_value: 'Worth now', stock_buy: 'Buy', stock_sell: 'Sell', stock_max: 'max', stock_wallet: 'Wallet: 🪙{n}',
  news_up_1: '{name}: the new product is selling well', news_up_2: '{name}: profits beat expectations', news_up_3: '{name}: opening a new branch in town', news_down_1: '{name}: costs are going up', news_down_2: '{name}: a new competitor', news_down_3: '{name}: business is slow',
});

// ---------- v0.27: an invite-only town ----------
Object.assign(STR.zh, {
  family: '家人', area_flyover: '高架桥', invite_here: '邀请亲友住这里', invite_none: '现在没有可以邀请的人了（原型里朋友是模拟的）',
  invite_note: '小镇是邀请制的：只有你邀请的好朋友和家人能住进来。原型里会模拟一位朋友接受邀请，住进这块地。',
});
Object.assign(STR.en, {
  family: 'Family', area_flyover: 'Flyover', invite_here: 'Invite someone to live here', invite_none: 'Nobody left to invite for now (friends are simulated in the prototype)',
  invite_note: 'Your town is invite-only: only the friends and family you invite can live here. In the prototype a friend accepts and moves onto this land.',
});
