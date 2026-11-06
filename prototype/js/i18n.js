'use strict';
// UI text in Chinese and English, plus number/time formatting. t('key', {var}) fills {var} placeholders.

const STR = {
  zh: {
    app_name: '镜像小镇', now: '现在', default_name: '镇民', free: '免费',
    tagline: '现实里少刷手机、多运动，虚拟世界里的你、你的家和整条街都会越来越好。',
    ob_p1: '运动的每一步都会变成金币和木材', ob_p2: '少刷短视频，离线越久奖励越多', ob_p3: '买地种菜养牲畜、盖房买车，和朋友一起把小镇建起来',
    ob_start: '开始', next: '下一步', ob_you: '设计你的镇民', ob_name_ph: '你的名字',
    ob_shirt: '衣服', ob_skin: '肤色', ob_hair: '发型', ob_hair_col: '发色', ob_mob: '出行',
    hair_short: '短发', hair_long: '长发', hair_bun: '丸子头', hair_curly: '卷发', mob_walk: '步行', mob_wheel: '轮椅',
    ob_look_note: '外观完全由你决定，和运动数据无关。',
    ob_apps: '哪些 App 让你分心？', ob_apps_desc: '只计算你选的 App，工作需要的 App 不受影响。正式版里这一步用的是 iPhone 系统自带的 App 选择器，我们看不到你具体选了什么。',
    ob_limit: '每天希望最多刷多久', ob_privacy: '你的步数和屏幕时间默认只有你自己能看到。', ob_move_in: '入住小镇',
    tab_home: '家', tab_town: '小镇', tab_shop: '商店', tab_real: '现实', tab_feed: '动态',
    energy_short_low: '有点犯困', energy_short_mid: '精神不错', energy_short_high: '活力满满',
    cap_title: '今日农活次数（种菜、偷菜）', to_collect: '待领取',
    hint_text: '点成熟的菜直接收获，点空地种菜，点房子进屋。拖动看看你的家，双指或滚轮缩放。', hint_ok: '知道了',
    // scene
    expand_field: '扩建菜地', build_pasture: '建牧场', home_of: '{name}的家', empty_lot: '空地 · 邀请朋友', street_name: '梧桐街',
    ctx_rank: '第 {n} 名 · 家产 🪙{v}', ctx_inside: '{house} · 室内', ctx_town: '{street} Lv{lv} · 全镇家产 🪙{v}',
    ctx_edit_room: '设计室内：点家具挪动，点下面的物品摆放', ctx_edit_yard: '设计院子：点装饰挪动，点下面的物品摆放', done: '完成',
    fab_enter: '进屋', fab_exit: '出门', fab_design: '设计', fab_barn: '仓库', fab_center: '回中间', fab_rank: '排行',
    fab_peek: '进屋看看', fab_gift: '互动', harvest_all: '一键收获',
    tray_items: '储物间', tray_colors: '颜色', tray_hint: '买来的东西会自动摆好，这里可以重新摆',
    tray_place: '点地面摆放「{name}」', rotate: '旋转', cancel: '取消', recolor: '换颜色', move: '移动', store: '收起',
    wallpaper: '墙纸', floor: '地板', wall_color: '外墙', roof_color: '屋顶',
    tray_empty: '储物间是空的。点已经摆好的东西可以移动、旋转或收起。', go_shop: '去商店',
    // shop
    shop_title: '商店', shop_money_note: '金币和木材只能从现实里赚：运动和少刷手机。农场卖的钱可以帮你更快攒够。',
    cat_seeds: '种子', cat_animals: '牲畜', cat_land: '土地', cat_furn: '家具', cat_yard: '庭院', cat_cars: '车', cat_houses: '房子', cat_sell: '出售',
    seed_sub: '{d}成熟 · 收 {n} 个 · 每个 🪙{p}', have_n: '已有 {n} 颗', buy_n: '买 {n}', rare_only: '完成现实目标获得',
    note_seeds: '种子越贵，长得越久，卖得也越多。向日葵和南瓜只能靠现实目标得到。',
    pasture_cap: '牧场 {n}/{cap} 只', no_pasture: '还没有牧场。', go_land: '去买地',
    grows_up: '{d}长大', animal_sub_prod: '每 {d} 产 {e}×{n}', animal_sub_baby: '每 {k} 次下一只崽', animal_sub_rabbit: '每 {d} 下一只崽',
    dog_sub: '看家：朋友来偷菜时有机会把人赶走', buy_baby: '买幼崽', owned: '已拥有',
    land_field: '菜地', land_field_sub: '{a} 块扩到 {b} 块', land_field_max: '已经有 {n} 块地了', maxed: '已满级',
    land_pasture: '牧场', land_pasture_new: '建一个牧场，能养 {cap} 只', land_pasture_sub: '扩建到 Lv{lv}，能养 {cap} 只', land_pasture_max: '能养 {cap} 只，已满级',
    note_land: '地买了就一直是你的。菜地和牧场越大，能种能养的越多。',
    furn_sub: '占 {w}×{d} 格', owned_n: '有 {n} 个', note_furn: '买了会自动摆进屋里，进屋点「设计」可以重新摆、旋转、换颜色。',
    note_yard: '买了会自动摆在院子里，点「设计」可以挪位置。',
    car_sub: '停在你家车道上', car_driving: '正在开', car_drive: '开这辆', note_cars: '点车道上的车可以换颜色。',
    house_room: '室内 {w}×{d} 格', house_current: '正在住', house_past: '已住过', note_houses: '搬家后家具和院子都会跟过去，房子越大，屋里能摆的越多。',
    sell_all: '全部卖出 +🪙{n}', sell_each: '每个 🪙{n}', sell_one: '卖 1 个', sell_n: '全卖 +🪙{n}', baby_release: '放进牧场',
    sell_empty: '仓库是空的。收菜、捡鸡蛋、挤牛奶，都会放到这里。',
    // real life
    real_note: '正式版会自动读取 Apple 健康和屏幕使用时间。原型里用「原型控制台」模拟这些数据。',
    earned_today: '今天从现实里赚到', money_rule: '小镇里所有的金币和木材，最初都来自这里：运动，和少刷短视频。',
    steps_today: '今天的步数', steps_rule: '每走 1,000 步 = 🪙10 + 🪵1。走到 6,000 步额外 🪙20 + 🪵3 + 一颗稀有南瓜种子。',
    goal_done: '今日活动目标已完成', rest_on: '今天是休息日，好好休息', rest_btn: '今天是休息日',
    inclusive_note: '轮椅推动次数、冥想和拉伸都算活动。生病或不舒服时，可以选休息日，奖励照样有。',
    focus_today: '今天少刷了', minutes: '分钟',
    focus_rule: '连续离线越久，奖励越多：30 分钟 🪙15、1 小时 🪙35、2 小时 🪙80 + 🌻 稀有种子。',
    distract_usage: '分心 App 已用 {n} / {limit} 分钟',
    focus_note: '超过了也不会扣任何东西，下一段专注时间还在等你。',
    energy_title: '镇民活力',
    energy_low: '有点犯困，打着哈欠。出去走走就精神了。', energy_mid: '精神不错，干活很利索。', energy_high: '活力满满，蹦蹦跳跳的！',
    energy_note: '活力只影响镇民的精神状态，永远不会改变外观和体型。',
    privacy_title: '隐私', share_goal: '让朋友看到我「完成了目标」',
    privacy_note: '默认关闭。打开后朋友只会看到「完成了目标」，看不到具体步数和使用时长。',
    settings: '设置', language: '语言', app_games: '游戏',
    // feed
    feed_empty: '还没有动态。', feed_note: '只有朋友的真实互动才会推送通知，不会催你收菜。',
    claim: '收下', claimed: '已收下', visit_back: '去看看',
    feed_gift: '{name} 送了你 {gift}', feed_welcome: '{name}：欢迎搬来梧桐街！送你 {gift}',
    feed_thanks: '{name} 回赠了你 {gift}', feed_like: '{name} 给你的家点了赞 ❤️',
    feed_goal: '{name} 今天完成了目标 🎉', feed_msg: '{name} 留言：「{msg}」', feed_join: '{name} 入住了梧桐街！邀请奖励 {gift}',
    feed_stole: '{name} 从你的菜地顺走了 {n} 个{e} 😏', feed_caught: '{name} 想来偷{e}，被你家的狗赶跑了 🐕',
    gift_seed: '{n} 颗{e}{name}种子', seed_x: '{e}种子×{n}',
    ago_now: '刚刚', ago_m: '{n} 分钟前', ago_h: '{n} 小时前', ago_d: '{n} 天前',
    dur_m: '{m} 分钟', dur_h: '{h} 小时', dur_hm: '{h} 小时 {m} 分',
    // collect
    welcome_back: '欢迎回来 👋', collect_title: '待领取的奖励', collect_empty: '暂时没有新奖励。',
    collect_desc: '这些都来自你在现实里做到的事。', collect_all: '全部领取',
    p_steps: '走了 {n} 步', p_focus: '{d}没打开分心 App', p_goal: '完成了今天的活动目标', p_rest: '休息日奖励',
    // fields
    plant_title: '种点什么？', plant: '种下', plant_all: '全种上', build_left: '今天还能做 {n} 次农活（共 {cap} 次）',
    no_seeds: '没有种子了。', buy_seeds: '去买种子', empty_field: '空地', friend_empty_field: '{name}的这块地还空着。',
    yield_left: '还有 {n} 个', growing_left: '还要 {d} 成熟', ripe_now: '熟了，点一下就能收！', never_wilts: '不会枯萎，什么时候来收都可以。',
    stolen_by: '{names} 顺走了一点 😏 你也可以去他们家逛逛。', steal_done: '你已经顺过这块地了，给主人留点吧。', steal_keep: '剩下的要留给主人。',
    // animals
    stage_baby: '幼崽', stage_young: '半大', stage_adult: '成年', animal_gone: '它已经不在这里了。',
    grow_left: '还要 {d} 长大', a_baby: '一只{name}', prod_ready: '可以收了：{what}', prod_left: '{d}后：{what}',
    collect: '收取', sell_for: '卖掉 +🪙{n}', sell_confirm: '确定卖掉这只{name}吗？',
    // barn
    barn_title: '仓库', barn_desc: '收获的菜、鸡蛋牛奶、多出来的幼崽都在这里，随时可以卖。',
    barn_goods: '农产品', barn_seeds: '种子', barn_store: '储物间', no_seeds_short: '没有种子。', store_empty: '没有收起来的家具。',
    barn_empty: '还是空的。',
    // car
    worth: '价值 🪙{v}', car_color: '车身颜色', car_switch: '换一辆开', car_shop: '去车行',
    // friends
    f_goal_done: '今天完成了目标', f_goal_not_yet: '今天还在努力', f_private: '没有公开',
    goal_privacy_hint: '你只能看到朋友愿意公开的结果，看不到具体数字。',
    like_home: '给 TA 的家点赞', like: '点赞', liked: '已点赞',
    leave_msg: '留言', msg_nice: '房子真好看！', msg_walk: '一起去散步吗？', msg_cheer: '今天也加油！', msg_veg: '下次给我留点菜 😤',
    send_gift: '送礼', no_gifts: '你现在没有可以送的东西，收获一点试试。', social_free: '拜访、点赞、留言和送礼都不占用农活次数。',
    visit: '拜访',
    // ranking
    rank_title: '{street}家产排行', town_total: '全镇总家产', town_next: '再 🪙{n} 小镇升到 Lv{lv}', town_max: '小镇已经满级啦',
    town_note: '大家一起变富，镇中心的广场就会升级：喷泉、长椅、钟楼……这是全镇一起的目标。',
    my_assets: '我的家产', a_cash: '金币和木材', a_house: '房子', a_land: '土地', a_items: '家具和装饰', a_cars: '车', a_animals: '牲畜', a_goods: '仓库和种子', a_total: '合计',
    animals_n: '{n} 只牲畜', rank_privacy: '排行只比家产，不比步数。你的运动和屏幕数据永远不会公开。',
    invite_btn: '邀请朋友入住', invite_reward_note: '朋友入住后，你们俩都会得到 🪵5。',
    invite_title: '邀请朋友入住', invite_desc: '把链接发给朋友，TA 就能直接搬到这块空地，和你做邻居。',
    copy_link: '复制邀请链接', invite_note: '原型不会真的发送任何东西。正式版通过链接和 iMessage 邀请，不依赖其他社交平台。',
    cap_heading: '今天的活干完了', cap_text: '去过你的生活吧。明天小镇还在这里等你。', cap_ok: '好的，明天见',
    // console
    console_title: '原型控制台', console_wait: '入住小镇后可以用。',
    console_desc: '模拟正式版里自动读取的数据，方便演示和用户访谈。',
    con_health: 'Apple 健康', steps_unit: '步', con_screen: '屏幕使用时间', offline_x: '离线 {d}', distract_btn: '刷了 20 分钟短视频',
    con_time: '时间', sim_time: '模拟时间', ff_x: '快进 {d}', next_day: '进入下一天',
    con_friends: '朋友', sim_friend_event: '朋友互动一次', sim_steal: '朋友来偷菜', sim_join: '朋友接受邀请',
    con_demo: '演示', demo_money: '+🪙1000 +🪵50', demo_note: '只给演示用，方便试商店。正式版没有这个按钮。',
    con_widget: '锁屏小组件预览', w_quiet: '小镇很安静。', w_ripe: '家里有 {n} 样可以收', w_growing: '菜和牲畜正在慢慢长',
    reset: '重置原型', reset_confirm: '确定清空所有进度，重新开始吗？',
    // snacks
    snack_poor: '钱还不够，去现实里走走吧', snack_full_pasture: '牧场满了，先去「土地」扩建', snack_new_day: '新的一天开始了 ☀️', snack_ff: '时间快进了',
    snack_harvest: '收获了 {n} 个{e}', snack_harvest_all: '收了 {n} 样，都放进仓库了', snack_planted: '种下了 {n} 块{e}',
    snack_baby: '牧场里多了一只{name} 🍼', snack_baby_barn: '生了一只{name}，牧场满了，先放在仓库', snack_prod: '收获了 {n} 个{e}',
    snack_sold: '卖了 🪙{n}', snack_seed: '买了 {n} 颗{e}种子', snack_animal: '一只{name}住进了牧场',
    snack_field: '菜地扩到 {n} 块了', snack_pasture: '牧场建好了，能养 {cap} 只', snack_furn: '{name}已经摆进屋里', snack_yard: '{name}已经摆在院子里',
    snack_stored: '没地方摆了，{name}先放进储物间', snack_car: '{name}停到你家车道上了 🚗', snack_drive: '换成了{name}',
    snack_house: '搬进了{name}！🎉', snack_norotate: '转不过来，旁边有东西挡着', snack_to_store: '收进储物间了',
    snack_placed: '摆好了', snack_noroom: '这里放不下',
    snack_liked: '点赞成功', snack_msg: '留言已送到 {name} 家', snack_gift: '把 {gift} 送给了 {name}',
    snack_copied: '邀请链接已复制', snack_claimed: '收下了 {gift}', snack_rest: '好好休息，奖励照发',
    snack_goal: '完成今日活动目标！⭐', snack_steps: '+{n} 步，奖励在家门口等你', snack_focus: '离线 {d}，奖励在家门口等你',
    snack_distract: '没关系，不扣任何东西。下一段专注时间还在等你。', snack_full: '街上没有空地了',
    snack_nothing_ripe: '你家现在没有熟的菜可偷', snack_stole: '顺走了 {n} 个{e} 🤫', snack_dog: '被{name}家的狗发现了，溜了溜了 🐕',
    snack_steal_limit: '今天已经偷了 {n} 次，明天再来吧',
  },
  en: {
    app_name: 'Mirror Town', now: 'now', default_name: 'Townie', free: 'Free',
    tagline: 'Scroll less and move more in real life, and the virtual you, your home and your whole street get better.',
    ob_p1: 'Every step you take turns into coins and wood', ob_p2: 'Skip short videos; the longer you stay away, the bigger the reward', ob_p3: 'Buy land, farm, raise animals, build a house, get a car, and grow the town with friends',
    ob_start: 'Get started', next: 'Next', ob_you: 'Design your townie', ob_name_ph: 'Your name',
    ob_shirt: 'Shirt', ob_skin: 'Skin', ob_hair: 'Hair', ob_hair_col: 'Hair color', ob_mob: 'Getting around',
    hair_short: 'Short', hair_long: 'Long', hair_bun: 'Bun', hair_curly: 'Curly', mob_walk: 'Walking', mob_wheel: 'Wheelchair',
    ob_look_note: 'Your look is entirely up to you and never depends on activity data.',
    ob_apps: 'Which apps distract you?', ob_apps_desc: 'Only the apps you pick count, so apps you need for work are never affected. In the real app this step uses the iPhone\'s built-in app picker, and we never see what you chose.',
    ob_limit: 'Daily limit you\'d like', ob_privacy: 'Your steps and screen time are private by default.', ob_move_in: 'Move in',
    tab_home: 'Home', tab_town: 'Town', tab_shop: 'Shop', tab_real: 'Real life', tab_feed: 'Activity',
    energy_short_low: 'A bit sleepy', energy_short_mid: 'Feeling good', energy_short_high: 'Full of energy',
    cap_title: 'Farm actions today (planting, sneaking)', to_collect: 'Collect',
    hint_text: 'Tap ripe crops to harvest, empty plots to plant, and the house to go inside. Drag to look around; pinch or scroll to zoom.', hint_ok: 'Got it',
    expand_field: 'Expand field', build_pasture: 'Build pasture', home_of: '{name}\'s home', empty_lot: 'Empty lot · invite a friend', street_name: 'Maple Street',
    ctx_rank: 'No. {n} · worth 🪙{v}', ctx_inside: '{house} · inside', ctx_town: '{street} Lv{lv} · town worth 🪙{v}',
    ctx_edit_room: 'Design inside: tap furniture to move it, tap an item below to place it', ctx_edit_yard: 'Design the yard: tap decor to move it, tap an item below to place it', done: 'Done',
    fab_enter: 'Go in', fab_exit: 'Go out', fab_design: 'Design', fab_barn: 'Barn', fab_center: 'Center', fab_rank: 'Ranks',
    fab_peek: 'Peek in', fab_gift: 'Say hi', harvest_all: 'Harvest all',
    tray_items: 'Storage', tray_colors: 'Colors', tray_hint: 'New things place themselves; rearrange them here',
    tray_place: 'Tap the floor to place "{name}"', rotate: 'Rotate', cancel: 'Cancel', recolor: 'Color', move: 'Move', store: 'Store',
    wallpaper: 'Wallpaper', floor: 'Floor', wall_color: 'Walls', roof_color: 'Roof',
    tray_empty: 'Storage is empty. Tap anything already placed to move, rotate or store it.', go_shop: 'Shop',
    shop_title: 'Shop', shop_money_note: 'Coins and wood only come from real life: moving and scrolling less. Selling farm goods helps you save faster.',
    cat_seeds: 'Seeds', cat_animals: 'Animals', cat_land: 'Land', cat_furn: 'Furniture', cat_yard: 'Yard', cat_cars: 'Cars', cat_houses: 'Houses', cat_sell: 'Sell',
    seed_sub: 'ready in {d} · {n} per plot · 🪙{p} each', have_n: '{n} owned', buy_n: 'Buy {n}', rare_only: 'From real-life goals',
    note_seeds: 'Pricier seeds take longer and sell for more. Sunflowers and pumpkins only come from real-life goals.',
    pasture_cap: 'Pasture {n}/{cap}', no_pasture: 'No pasture yet.', go_land: 'Buy land',
    grows_up: 'grows up in {d}', animal_sub_prod: 'makes {e}×{n} every {d}', animal_sub_baby: 'a baby every {k} times', animal_sub_rabbit: 'a baby every {d}',
    dog_sub: 'Guards the farm: may chase off friends who sneak a veggie', buy_baby: 'Buy baby', owned: 'Owned',
    land_field: 'Field', land_field_sub: 'from {a} to {b} plots', land_field_max: 'You have {n} plots', maxed: 'Maxed',
    land_pasture: 'Pasture', land_pasture_new: 'Build a pasture for {cap} animals', land_pasture_sub: 'Expand to Lv{lv} for {cap} animals', land_pasture_max: 'Holds {cap}, maxed',
    note_land: 'Land is yours for good. Bigger fields and pastures mean more to grow and raise.',
    furn_sub: '{w}×{d} tiles', owned_n: '{n} owned', note_furn: 'New furniture places itself inside. Go in and tap Design to move, rotate or recolor it.',
    note_yard: 'New decor places itself in the yard. Tap Design to move it.',
    car_sub: 'Parks in your driveway', car_driving: 'Driving', car_drive: 'Drive this', note_cars: 'Tap the car in your driveway to change its color.',
    house_room: 'Inside {w}×{d}', house_current: 'Home', house_past: 'Outgrown', note_houses: 'Furniture and yard come with you. Bigger houses fit more inside.',
    sell_all: 'Sell all +🪙{n}', sell_each: '🪙{n} each', sell_one: 'Sell 1', sell_n: 'Sell all +🪙{n}', baby_release: 'To pasture',
    sell_empty: 'The barn is empty. Harvests, eggs and milk all land here.',
    real_note: 'The real app reads Apple Health and Screen Time automatically. In this prototype, use the Prototype Console to simulate them.',
    earned_today: 'Earned from real life today', money_rule: 'Every coin and plank in town starts here: moving, and scrolling less.',
    steps_today: 'Steps today', steps_rule: 'Every 1,000 steps = 🪙10 + 🪵1. Reach 6,000 for 🪙20 + 🪵3 + a rare pumpkin seed.',
    goal_done: 'Today\'s activity goal is done', rest_on: 'Rest day. Take it easy', rest_btn: 'Today is a rest day',
    inclusive_note: 'Wheelchair pushes, meditation and stretching all count. If you\'re sick or not up to it, pick a rest day and still get the reward.',
    focus_today: 'Time away from distractions', minutes: 'min',
    focus_rule: 'Longer stretches pay more: 30 min 🪙15, 1 h 🪙35, 2 h 🪙80 + 🌻 rare seed.',
    distract_usage: 'Distracting apps used: {n} / {limit} min',
    focus_note: 'Going over never costs you anything. Your next focus stretch is waiting.',
    energy_title: 'Townie energy',
    energy_low: 'Sleepy and yawning. A walk will perk them up.', energy_mid: 'In good spirits and working well.', energy_high: 'Bursting with energy and bouncing around!',
    energy_note: 'Energy only changes mood. It never changes how your townie looks or their body shape.',
    privacy_title: 'Privacy', share_goal: 'Let friends see when I hit my goal',
    privacy_note: 'Off by default. When on, friends only see "hit the goal", never your step counts or usage.',
    settings: 'Settings', language: 'Language', app_games: 'Games',
    feed_empty: 'Nothing here yet.', feed_note: 'Only real interactions from friends send notifications. We never nag you to harvest.',
    claim: 'Accept', claimed: 'Accepted', visit_back: 'Go see',
    feed_gift: '{name} sent you {gift}', feed_welcome: '{name}: Welcome to Maple Street! Here\'s {gift}',
    feed_thanks: '{name} sent {gift} back', feed_like: '{name} liked your home ❤️',
    feed_goal: '{name} hit their goal today 🎉', feed_msg: '{name} left a note: "{msg}"', feed_join: '{name} moved onto Maple Street! Invite reward {gift}',
    feed_stole: '{name} snuck {n} {e} from your field 😏', feed_caught: '{name} tried to sneak a {e} but your dog chased them off 🐕',
    gift_seed: '{n} {e} {name} seed(s)', seed_x: '{e} seed ×{n}',
    ago_now: 'just now', ago_m: '{n} min ago', ago_h: '{n} h ago', ago_d: '{n} d ago',
    dur_m: '{m} min', dur_h: '{h} h', dur_hm: '{h} h {m} min',
    welcome_back: 'Welcome back 👋', collect_title: 'Rewards to collect', collect_empty: 'No new rewards right now.',
    collect_desc: 'All of these come from things you did in real life.', collect_all: 'Collect all',
    p_steps: 'Walked {n} steps', p_focus: '{d} without distracting apps', p_goal: 'Hit today\'s activity goal', p_rest: 'Rest day reward',
    plant_title: 'What to plant?', plant: 'Plant', plant_all: 'Fill all', build_left: '{n} of {cap} farm actions left today',
    no_seeds: 'Out of seeds.', buy_seeds: 'Buy seeds', empty_field: 'Empty plot', friend_empty_field: 'This plot of {name}\'s is empty.',
    yield_left: '{n} left', growing_left: 'Ready in {d}', ripe_now: 'Ripe! Tap it to harvest.', never_wilts: 'It never wilts. Harvest whenever you like.',
    stolen_by: '{names} snuck a little 😏 Feel free to visit them back.', steal_done: 'You already took some here. Leave the rest for the owner.', steal_keep: 'The rest stays with the owner.',
    stage_baby: 'Baby', stage_young: 'Young', stage_adult: 'Adult', animal_gone: 'It isn\'t here anymore.',
    grow_left: 'Grows up in {d}', a_baby: 'a {name}', prod_ready: 'Ready: {what}', prod_left: 'In {d}: {what}',
    collect: 'Collect', sell_for: 'Sell +🪙{n}', sell_confirm: 'Sell this {name}?',
    barn_title: 'Barn', barn_desc: 'Harvests, eggs, milk and spare babies wait here. Sell any time.',
    barn_goods: 'Farm goods', barn_seeds: 'Seeds', barn_store: 'Storage', no_seeds_short: 'No seeds.', store_empty: 'Nothing in storage.',
    barn_empty: 'Empty for now.',
    worth: 'Worth 🪙{v}', car_color: 'Paint', car_switch: 'Drive another', car_shop: 'Car dealer',
    f_goal_done: 'Hit today\'s goal', f_goal_not_yet: 'Still working on it', f_private: 'Not shared',
    goal_privacy_hint: 'You only see what friends choose to share, never their numbers.',
    like_home: 'Like their home', like: 'Like', liked: 'Liked',
    leave_msg: 'Leave a note', msg_nice: 'Love your house!', msg_walk: 'Want to go for a walk?', msg_cheer: 'You\'ve got this today!', msg_veg: 'Leave me some veggies next time 😤',
    send_gift: 'Send a gift', no_gifts: 'Nothing to give yet. Try harvesting.', social_free: 'Visiting, likes, notes and gifts never use farm actions.',
    visit: 'Visit',
    rank_title: '{street} rich list', town_total: 'Whole town worth', town_next: '🪙{n} more for town Lv{lv}', town_max: 'The town is maxed out',
    town_note: 'As everyone grows, the town square upgrades: fountain, benches, a clock tower. That\'s a goal the whole street shares.',
    my_assets: 'My net worth', a_cash: 'Coins and wood', a_house: 'House', a_land: 'Land', a_items: 'Furniture and decor', a_cars: 'Cars', a_animals: 'Animals', a_goods: 'Barn and seeds', a_total: 'Total',
    animals_n: '{n} animals', rank_privacy: 'Ranks compare homes, never steps. Your activity and screen data are never shared.',
    invite_btn: 'Invite a friend', invite_reward_note: 'When they move in, you both get 🪵5.',
    invite_title: 'Invite a friend', invite_desc: 'Send the link and your friend can move straight into this lot as your neighbor.',
    copy_link: 'Copy invite link', invite_note: 'The prototype never sends anything. The real app invites by link and iMessage, without other social platforms.',
    cap_heading: 'That\'s all the work for today', cap_text: 'Go live your life. The town will be right here tomorrow.', cap_ok: 'See you tomorrow',
    console_title: 'Prototype Console', console_wait: 'Available after you move in.',
    console_desc: 'Simulates the data the real app reads automatically. Handy for demos and user interviews.',
    con_health: 'Apple Health', steps_unit: 'steps', con_screen: 'Screen Time', offline_x: 'Offline {d}', distract_btn: 'Watched short videos 20 min',
    con_time: 'Time', sim_time: 'Simulated time', ff_x: 'Skip {d}', next_day: 'Next day',
    con_friends: 'Friends', sim_friend_event: 'Friend interaction', sim_steal: 'Friend sneaks a veggie', sim_join: 'Friend accepts invite',
    con_demo: 'Demo', demo_money: '+🪙1000 +🪵50', demo_note: 'For demos only, to try the shop. The real app has no such button.',
    con_widget: 'Lock screen widget', w_quiet: 'The town is quiet.', w_ripe: '{n} things ready at home', w_growing: 'Crops and animals are growing',
    reset: 'Reset prototype', reset_confirm: 'Erase all progress and start over?',
    snack_poor: 'Not enough yet. Go for a walk!', snack_full_pasture: 'Pasture is full. Expand it under Land.', snack_new_day: 'A new day begins ☀️', snack_ff: 'Time skipped ahead',
    snack_harvest: 'Harvested {n} {e}', snack_harvest_all: 'Collected {n} things into the barn', snack_planted: 'Planted {n} plots of {e}',
    snack_baby: 'A {name} joined the pasture 🍼', snack_baby_barn: 'A {name} was born. The pasture is full, so it\'s waiting in the barn', snack_prod: 'Collected {n} {e}',
    snack_sold: 'Sold for 🪙{n}', snack_seed: 'Bought {n} {e} seed(s)', snack_animal: 'A {name} moved into the pasture',
    snack_field: 'Your field now has {n} plots', snack_pasture: 'Pasture ready for {cap} animals', snack_furn: '{name} is set up inside', snack_yard: '{name} is set up in the yard',
    snack_stored: 'No room, so {name} went to storage', snack_car: 'Your {name} is in the driveway 🚗', snack_drive: 'Now driving the {name}',
    snack_house: 'Moved into the {name}! 🎉', snack_norotate: 'Something is in the way', snack_to_store: 'Moved to storage',
    snack_placed: 'Placed', snack_noroom: 'It doesn\'t fit there',
    snack_liked: 'Liked', snack_msg: 'Note left at {name}\'s', snack_gift: 'Gave {gift} to {name}',
    snack_copied: 'Invite link copied', snack_claimed: 'Got {gift}', snack_rest: 'Rest well. Reward still counts',
    snack_goal: 'Activity goal done! ⭐', snack_steps: '+{n} steps. Reward waiting at your door', snack_focus: 'Offline {d}. Reward waiting at your door',
    snack_distract: 'That\'s okay, nothing is taken away. Your next focus stretch is waiting.', snack_full: 'No empty lots left',
    snack_nothing_ripe: 'Nothing ripe in your field to sneak', snack_stole: 'Snuck {n} {e} 🤫', snack_dog: '{name}\'s dog spotted you. Run! 🐕',
    snack_steal_limit: 'You\'ve snuck {n} times today. Come back tomorrow',
  },
};

function curLang() {
  if (typeof S !== 'undefined' && S && S.lang) return S.lang;
  if (typeof OB !== 'undefined' && OB && OB.lang) return OB.lang;
  return 'zh';
}
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
