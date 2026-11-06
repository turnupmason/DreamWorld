'use strict';
// UI: HUD, tabs, buttons over the scene, shop, sheets, design mode, onboarding, prototype console.

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = { tab: 'home', inside: false, visit: null, visitInside: false, sheet: null, welcome: false, shop: 'seeds', tray: 'items', harvestN: -1 };
let OB = null; // onboarding draft
const ENERGY_EMOJI = { low: '😴', mid: '🙂', high: '🤩' };
const SRC_EMOJI = { steps: '🚶', focus: '📵', goal: '⭐', rest: '🌙' };

// ---------- formatting ----------
function costText(c) {
  const a = [];
  if (c.coins) a.push(`🪙${fmtNum(c.coins)}`);
  if (c.wood) a.push(`🪵${c.wood}`);
  return a.join(' ') || t('free');
}
function rewardText(r) {
  const a = [];
  if (r.coins) a.push(`+🪙${r.coins}`);
  if (r.wood) a.push(`+🪵${r.wood}`);
  for (const k in r.seeds || {}) if (r.seeds[k]) a.push('+' + t('seed_x', { e: CROPS[k].e, n: r.seeds[k] }));
  return a.join('  ');
}
function giftText(g) {
  if (g.type === 'barn') { const b = barnInfo(g.k); return `${g.n} ${b.e}${b.name}`; }
  if (g.type === 'seed') return t('gift_seed', { n: g.n, e: CROPS[g.k].e, name: nm(CROPS[g.k]) });
  if (g.type === 'coins') return `🪙${g.n}`;
  return `🪵${g.n}`;
}
function fname(id) { const h = homeOf(id); return h ? homeName(h) : ''; }
function feedText(it) {
  const name = esc(fname(it.from));
  if (it.kind === 'gift') {
    const key = it.msgKey === 'welcome' ? 'feed_welcome' : it.msgKey === 'thanks' ? 'feed_thanks' : 'feed_gift';
    return t(key, { name, gift: giftText(it.gift) });
  }
  if (it.kind === 'like') return t('feed_like', { name });
  if (it.kind === 'goal') return t('feed_goal', { name });
  if (it.kind === 'msg') return t('feed_msg', { name, msg: t(it.msgKey) });
  if (it.kind === 'join') return t('feed_join', { name, gift: giftText(it.gift) });
  if (it.kind === 'stole') return t('feed_stole', { name, n: it.n, e: CROPS[it.crop].e });
  if (it.kind === 'caught') return t('feed_caught', { name, e: CROPS[it.crop].e });
  return '';
}
function pendingTitle(p) {
  if (p.src === 'steps') return t('p_steps', { n: fmtNum(p.info.steps) });
  if (p.src === 'focus') return t('p_focus', { d: fmtDur(p.info.min * MIN) });
  if (p.src === 'goal') return t('p_goal');
  return t('p_rest');
}
const thumbImg = (kind, k, o, w = 120, h = 96, cls = 'thumb') => `<img class="${cls}" alt="" src="${Scene.thumb(kind, k, o, w, h)}">`;
const avatar = (look, cls = '') => `<span class="ava ${cls}" style="background-image:url(${Scene.thumb('person', 'a', { look }, 90, 90)})"></span>`;
const unreadCount = () => S.feed.filter(i => !i.read || (i.gift && !i.claimed)).length;
const stageName = a => t(['stage_baby', 'stage_young', 'stage_adult'][animalStage(a)]);
function ripeCount() { return S.me.fields.filter(isRipe).length + S.me.animals.filter(animalReady).length; }

// ---------- feedback ----------
// Push-style banners are only for real social events.
function notify(item) {
  if (!item || !['gift', 'like', 'msg', 'join', 'stole', 'caught'].includes(item.kind)) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="app">🏡</div><div><b>${t('app_name')} · ${t('now')}</b>${feedText(item)}</div>`;
  el.onclick = () => { setTab('feed'); refresh(); };
  el.style.pointerEvents = 'auto';
  $('#toasts').prepend(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 4200);
}
let snackTimer = null;
function snack(text) {
  const el = $('#snack');
  el.textContent = text; el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

// ---------- view ----------
function syncView() {
  if (UI.tab === 'home') Scene.setView(UI.inside ? 'interior' : 'home', 'me');
  else if (UI.tab === 'town') Scene.setView(UI.visit ? (UI.visitInside ? 'interior' : 'home') : 'town', UI.visit || 'me');
  Scene.setVisible(UI.tab === 'home' || UI.tab === 'town');
}
function setTab(tab) {
  if (Scene.getEdit()) Scene.stopEdit();
  UI.tab = tab;
  if (tab === 'feed') S.feed.forEach(i => { i.read = true; });
  syncView();
}

// ---------- render ----------
function renderHUD() {
  const e = energyLevel();
  $('#hud').innerHTML = `
    <div class="statusbar"><span id="clock">${fmtClock(now())}</span><span>▂▄▆ 🔋</span></div>
    <div class="row between">
      <div class="row me">${avatar(S.me.look)}<div><div class="me-name">${esc(S.me.name)}</div>
        <div class="energy">${ENERGY_EMOJI[e]} ${t('energy_short_' + e)}</div></div></div>
      <div class="cap ${actionsLeft() === 0 ? 'done' : ''}" title="${t('cap_title')}">🔨 ${S.today.actions}/${ACTION_CAP}</div>
    </div>
    <div class="res row">
      <span class="pill">🪙 ${fmtNum(S.me.coins)}</span><span class="pill">🪵 ${S.me.wood}</span>
      ${S.pending.length ? `<button class="pill pending" data-act="collect">📦 ${t('to_collect')} ${S.pending.length}</button>` : ''}
    </div>`;
}

function renderTabbar() {
  const n = unreadCount();
  $('#tabbar').innerHTML = [['home', '🏡'], ['town', '🏘️'], ['shop', '🛒'], ['real', '🏃'], ['feed', '🔔']].map(([id, ic]) =>
    `<button class="tab ${UI.tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">
      <span class="ic">${ic}</span>${t('tab_' + id)}${id === 'feed' && n ? `<span class="badge">${n}</span>` : ''}</button>`).join('');
}

function renderPanel() {
  const el = $('#panel');
  const onScene = UI.tab === 'home' || UI.tab === 'town';
  el.hidden = onScene;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  $('#hint').hidden = !(UI.tab === 'home' && !UI.inside && !S.seenHint);
  if (UI.tab === 'shop') el.innerHTML = panelShop();
  else if (UI.tab === 'real') el.innerHTML = panelReal();
  else if (UI.tab === 'feed') el.innerHTML = panelFeed();
}

// Buttons and banners laid over the scene.
function renderOverlay() {
  const ctxEl = $('#ctxbar'), fab = $('#fab'), tray = $('#tray'), hv = $('#harvestAll');
  const onScene = UI.tab === 'home' || UI.tab === 'town';
  const ed = Scene.getEdit();
  if (!onScene) { ctxEl.hidden = fab.hidden = tray.hidden = hv.hidden = true; return; }
  const b = (act, ic, label, arg = '') => `<button class="fab-btn" data-act="${act}" data-arg="${arg}"><span>${ic}</span>${label}</button>`;
  let c = '', f = '';
  if (ed) {
    c = `<div class="ctx-main">✏️ ${t(ed.scope === 'room' ? 'ctx_edit_room' : 'ctx_edit_yard')}</div><button class="btn small primary" data-act="editDone">${t('done')}</button>`;
  } else if (UI.tab === 'home') {
    if (UI.inside) {
      c = `<div class="ctx-main">🛋️ ${t('ctx_inside', { house: nm(HOUSES[S.me.house]) })}</div>`;
      f = b('goOut', '🌳', t('fab_exit')) + b('design', '✏️', t('fab_design')) + b('barn', '🧺', t('fab_barn'));
    } else {
      c = `<button class="ctx-main link" data-act="ranking">🏆 ${t('ctx_rank', { n: rankOf('me'), v: fmtNum(assetValue(S.me)) })}</button>`;
      f = b('goIn', '🚪', t('fab_enter')) + b('design', '✏️', t('fab_design')) + b('barn', '🧺', t('fab_barn')) + b('recenter', '🎯', t('fab_center'));
    }
  } else if (UI.visit) {
    const h = friendById(UI.visit);
    c = `<button class="btn small" data-act="backTown">← ${t('tab_town')}</button><div class="ctx-main">${t('home_of', { name: esc(homeName(h)) })} · 🏆 ${rankOf(h.id)} · 🪙${fmtCompact(assetValue(h))}</div>`;
    f = UI.visitInside ? b('goOut', '🌳', t('fab_exit'))
      : b('goIn', '🚪', t('fab_peek')) + b('like', '❤️', t('like'), h.id) + b('friendSheet', '🎁', t('fab_gift'), h.id);
  } else {
    c = `<button class="ctx-main link" data-act="ranking">🏛️ ${t('ctx_town', { street: t('street_name'), lv: townLevel(), v: fmtCompact(townTotal()) })}</button>`;
    f = b('ranking', '🏆', t('fab_rank')) + b('recenter', '🎯', t('fab_center'));
  }
  ctxEl.innerHTML = c; ctxEl.hidden = !c;
  fab.innerHTML = f; fab.hidden = !f;
  // design tray
  tray.hidden = !ed;
  if (ed) tray.innerHTML = trayHTML(ed);
  // one-tap harvest
  const n = ripeCount();
  UI.harvestN = n;
  hv.hidden = !(UI.tab === 'home' && !UI.inside && !ed && n > 0);
  hv.innerHTML = `🧺 ${t('harvest_all')} · ${n}`;
}

function trayHTML(ed) {
  const scope = ed.scope;
  if (ed.hold) {
    const d = itemDef(scope, ed.hold.k);
    return `<div class="tray-row"><div class="grow"><b>${t('tray_place', { name: nm(d) })}</b></div>
      <button class="btn small" data-act="trayRotate">↻ ${t('rotate')}</button>
      <button class="btn small" data-act="trayCancel">✕ ${t('cancel')}</button></div>`;
  }
  if (ed.sel) {
    const it = findItem(scope, ed.sel);
    if (it) {
      const d = itemDef(scope, it.k);
      return `<div class="tray-row"><div class="grow"><b>${nm(d)}</b></div>
        <button class="btn small" data-act="trayRotate">↻ ${t('rotate')}</button>
        ${it.tint ? `<button class="btn small" data-act="trayTint">🎨 ${t('recolor')}</button>` : ''}
        <button class="btn small" data-act="trayMove">✋ ${t('move')}</button>
        <button class="btn small" data-act="trayStore">📦 ${t('store')}</button></div>`;
    }
  }
  const tabs = `<div class="tray-tabs"><button class="chip ${UI.tray === 'items' ? 'on' : ''}" data-act="trayTab" data-arg="items">${t('tray_items')}</button>
    <button class="chip ${UI.tray === 'colors' ? 'on' : ''}" data-act="trayTab" data-arg="colors">${t('tray_colors')}</button>
    <span class="muted">${t('tray_hint')}</span></div>`;
  if (UI.tray === 'colors') {
    const sw = (list, cur, act) => list.map((c, i) => `<button class="swatch sm ${cur === i ? 'on' : ''}" style="background:${c.c1 || c}" data-act="${act}" data-arg="${i}"></button>`).join('');
    if (scope === 'room') return tabs + `<div class="color-row"><span>${t('wallpaper')}</span>${sw(ROOM_WALLS, S.me.room.wall, 'setRoomWall')}</div>
      <div class="color-row"><span>${t('floor')}</span>${sw(FLOORS, S.me.room.floor, 'setFloor')}</div>`;
    return tabs + `<div class="color-row"><span>${t('wall_color')}</span>${sw(WALL_COLORS, WALL_COLORS.indexOf(S.me.wall), 'setWall')}</div>
      <div class="color-row"><span>${t('roof_color')}</span>${sw(ROOF_COLORS, ROOF_COLORS.indexOf(S.me.roof), 'setRoof')}</div>`;
  }
  const stored = Object.entries(S.me.store).filter(([key]) => key.startsWith(scope + ':'));
  if (!stored.length) return tabs + `<div class="tray-empty"><span class="muted">${t('tray_empty')}</span>
    <button class="btn small" data-act="openShop" data-arg="${scope === 'room' ? 'furn' : 'yard'}">🛒 ${t('go_shop')}</button></div>`;
  return tabs + `<div class="tray-items">${stored.map(([key, n]) => {
    const k = key.split(':')[1], d = itemDef(scope, k);
    return `<button class="tray-item" data-act="holdNew" data-arg="${k}">${thumbImg(scope === 'room' ? 'furn' : 'yard', k, {}, 72, 58, 'thumb sm')}
      <span>${nm(d)}</span><i>×${n}</i></button>`;
  }).join('')}</div>`;
}

// ---------- shop ----------
const SHOP_CATS = [['seeds', '🌱'], ['animals', '🐣'], ['land', '🗺️'], ['furn', '🛋️'], ['yard', '🌳'], ['cars', '🚗'], ['houses', '🏠'], ['sell', '💰']];
function shopCard(img, name, sub, btns, extra = '') {
  return `<div class="item-card">${img}<div class="item-name">${name}</div><div class="item-sub">${sub}</div>${extra}<div class="item-btns">${btns}</div></div>`;
}
const buyBtn = (act, arg, label, ok, cls = 'primary') => `<button class="btn small ${cls}" data-act="${act}" data-arg="${arg}" ${ok ? '' : 'disabled'}>${label}</button>`;
function panelShop() {
  const h = S.me, cat = UI.shop;
  const chips = SHOP_CATS.map(([id, ic]) => `<button class="chip ${cat === id ? 'on' : ''}" data-act="shopCat" data-arg="${id}">${ic} ${t('cat_' + id)}</button>`).join('');
  let body = '', note = '';
  if (cat === 'seeds') {
    body = Object.entries(CROPS).map(([k, c]) => shopCard(thumbImg('crop', k), `${c.e} ${nm(c)}`,
      t('seed_sub', { d: fmtDur(c.grow), n: c.yield, p: c.sell }) + (h.seeds[k] ? ` · ${t('have_n', { n: h.seeds[k] })}` : ''),
      c.rare ? `<span class="tag">${t('rare_only')}</span>`
        : buyBtn('buySeed', k + '|1', `${t('buy_n', { n: 1 })} 🪙${c.seed}`, h.coins >= c.seed) + buyBtn('buySeed', k + '|5', `×5 🪙${c.seed * 5}`, h.coins >= c.seed * 5, ''))).join('');
    note = t('note_seeds');
  } else if (cat === 'animals') {
    note = h.pastureLv ? t('pasture_cap', { n: pastureCount(), cap: pastureCap() }) : `${t('no_pasture')} <button class="btn small" data-act="shopCat" data-arg="land">${t('go_land')}</button>`;
    body = Object.entries(ANIMALS).map(([k, a]) => {
      let sub;
      if (a.pet) sub = t('dog_sub');
      else if (!a.prod) sub = t('animal_sub_rabbit', { d: fmtDur(a.every) });
      else sub = t('animal_sub_prod', { d: fmtDur(a.every), e: GOODS[a.prod].e, n: a.n }) + ' · ' + t('animal_sub_baby', { k: a.babyEvery });
      sub = t('grows_up', { d: fmtDur(a.grow) }) + ' · ' + sub;
      const own = a.pet && h.animals.some(x => x.k === k);
      const ok = h.coins >= a.price && (a.pet ? !own : h.pastureLv && pastureCount() < pastureCap());
      return shopCard(thumbImg('animal', k, { stage: 2 }), `${a.e} ${nm(a)}`, sub,
        own ? `<span class="tag ok">${t('owned')}</span>` : buyBtn('buyAnimal', k, `${t('buy_baby')} 🪙${a.price}`, ok),
        `<div class="baby-row">${thumbImg('animal', k, { stage: 0 }, 60, 48, 'thumb xs')}<span>→</span>${thumbImg('animal', k, { stage: 1 }, 60, 48, 'thumb xs')}<span>→</span>${thumbImg('animal', k, { stage: 2 }, 60, 48, 'thumb xs')}</div>`);
    }).join('');
  } else if (cat === 'land') {
    const fl = h.fieldLv, nf = FIELD_COST[fl + 1];
    body += shopCard(thumbImg('field', 'f'), `🟫 ${t('land_field')}`,
      nf ? t('land_field_sub', { a: FIELD_LEVELS[fl], b: FIELD_LEVELS[fl + 1] }) : t('land_field_max', { n: FIELD_LEVELS[fl] }),
      nf ? buyBtn('buyField', '', costText(nf), canAfford(nf)) : `<span class="tag ok">${t('maxed')}</span>`);
    const pl = h.pastureLv, np = PASTURE[pl + 1];
    body += shopCard(thumbImg('pasture', 'p'), `🐄 ${t('land_pasture')}`,
      np ? t(pl ? 'land_pasture_sub' : 'land_pasture_new', { lv: pl + 1, cap: np.cap }) : t('land_pasture_max', { cap: PASTURE[pl].cap }),
      np ? buyBtn('buyPasture', '', costText(np.cost), canAfford(np.cost)) : `<span class="tag ok">${t('maxed')}</span>`);
    note = t('note_land');
  } else if (cat === 'furn' || cat === 'yard') {
    const scope = cat === 'furn' ? 'room' : 'yard', list = cat === 'furn' ? FURN : YARD;
    body = Object.entries(list).map(([k, d]) => {
      const n = scopeItems(h, scope).filter(i => i.k === k).length + (h.store[scope + ':' + k] || 0);
      return shopCard(thumbImg(cat, k), nm(d), t('furn_sub', { w: d.w, d: d.d }) + (n ? ` · ${t('owned_n', { n })}` : ''),
        buyBtn('buyItem', scope + '|' + k, `🪙${fmtNum(d.price)}`, h.coins >= d.price));
    }).join('');
    note = t(cat === 'furn' ? 'note_furn' : 'note_yard');
  } else if (cat === 'cars') {
    body = Object.entries(CARS).map(([k, c]) => {
      const i = h.cars.findIndex(x => x.k === k);
      const color = i >= 0 ? h.cars[i].color : CAR_COLORS[0];
      let btn;
      if (i < 0) btn = buyBtn('buyCar', k, costText(c.cost), canAfford(c.cost));
      else if (i === h.car) btn = `<span class="tag ok">${t('car_driving')}</span>`;
      else btn = buyBtn('driveCar', i, t('car_drive'), true, '');
      return shopCard(thumbImg('car', k, { color }), nm(c), i >= 0 ? t('owned') : t('car_sub'), btn);
    }).join('');
    note = t('note_cars');
  } else if (cat === 'houses') {
    body = HOUSES.map((H, i) => {
      let btn;
      if (i === h.house) btn = `<span class="tag ok">${t('house_current')}</span>`;
      else if (i < h.house) btn = `<span class="tag">${t('house_past')}</span>`;
      else btn = buyBtn('buyHouse', i, costText(H.cost), canAfford(H.cost));
      return shopCard(thumbImg('house', i, { wall: h.wall, roof: h.roof }), nm(H), t('house_room', { w: H.room[0], d: H.room[1] }), btn);
    }).join('');
    note = t('note_houses');
  } else {
    const keys = Object.keys(h.barn);
    const total = barnValue();
    note = keys.length ? `<button class="btn small primary" data-act="sellAll">${t('sell_all', { n: fmtNum(total) })}</button>` : '';
    body = keys.length ? keys.map(k => {
      const b = barnInfo(k), n = h.barn[k];
      const img = CROPS[k] ? thumbImg('crop', k) : GOODS[k] ? thumbImg('good', k) : thumbImg('animal', b.baby, { stage: 0 });
      return shopCard(img, `${b.e} ${b.name} ×${n}`, t('sell_each', { n: b.sell }),
        buyBtn('sell', k + '|1', t('sell_one'), true, '') + buyBtn('sell', k + '|' + n, t('sell_n', { n: fmtNum(n * b.sell) }), true)
        + (b.baby && pastureCount() < pastureCap() ? buyBtn('release', b.baby, t('baby_release'), true, '') : ''));
    }).join('') : `<p class="muted center gap-top">${t('sell_empty')}</p>`;
  }
  return `<div class="shop-head"><h1 class="panel-title">${t('shop_title')}</h1>
      <div class="row"><span class="pill">🪙 ${fmtNum(h.coins)}</span><span class="pill">🪵 ${h.wood}</span></div></div>
    <p class="muted note">${t('shop_money_note')}</p>
    <div class="shop-cats">${chips}</div>
    ${note ? `<div class="shop-note">${note}</div>` : ''}
    <div class="item-grid">${body}</div>`;
}

// ---------- other panels ----------
function panelReal() {
  const d = S.today;
  const stepPct = Math.min(100, d.steps / STEP_GOAL * 100);
  const disPct = Math.min(100, d.distractMin / S.limitMin * 100);
  const e = energyLevel();
  const apps = S.apps.map(id => { const a = APPS.find(x => x.id === id); return `<span class="chip static">${a.emoji} ${a.name || t('app_games')}</span>`; }).join('');
  let goalRow;
  if (d.restDay) goalRow = `<div class="ok-line">🌙 ${t('rest_on')}</div>`;
  else if (d.goalPaid) goalRow = `<div class="ok-line">✅ ${t('goal_done')}</div>`;
  else goalRow = `<button class="btn small" data-act="restDay">🌙 ${t('rest_btn')}</button>`;
  return `
    <h1 class="panel-title">${t('tab_real')}</h1>
    <p class="muted note">${t('real_note')}</p>
    <div class="card earn"><h3>💰 ${t('earned_today')}</h3>
      <div class="big-num">🪙${fmtNum(d.earned.coins)} <small>🪵${d.earned.wood}</small></div>
      <p class="muted">${t('money_rule')}</p></div>
    <div class="card">
      <h3>🏃 ${t('steps_today')}</h3>
      <div class="big-num">${fmtNum(d.steps)} <small>/ ${fmtNum(STEP_GOAL)}</small></div>
      <div class="bar"><i style="width:${stepPct}%"></i></div>
      <p class="muted">${t('steps_rule')}</p>
      <div class="row between gap-top">${goalRow}</div>
      <p class="muted">${t('inclusive_note')}</p>
    </div>
    <div class="card">
      <h3>📵 ${t('focus_today')}</h3>
      <div class="big-num">${d.focusMin} <small>${t('minutes')}</small></div>
      <p class="muted">${t('focus_rule')}</p>
      <div class="row between small-gap"><span class="muted">${t('distract_usage', { n: d.distractMin, limit: S.limitMin })}</span></div>
      <div class="bar warm"><i style="width:${disPct}%"></i></div>
      <div class="gap-top">${apps}</div>
      <p class="muted">${t('focus_note')}</p>
    </div>
    <div class="card">
      <h3>${ENERGY_EMOJI[e]} ${t('energy_title')}</h3>
      <p>${t('energy_' + e)}</p>
      <p class="muted">${t('energy_note')}</p>
    </div>
    <div class="card">
      <h3>🔒 ${t('privacy_title')}</h3>
      <label class="row between toggle-row"><span>${t('share_goal')}</span>
        <input type="checkbox" class="switch" data-act="share" ${S.me.shareGoal ? 'checked' : ''}></label>
      <p class="muted">${t('privacy_note')}</p>
    </div>
    <div class="card">
      <h3>⚙️ ${t('settings')}</h3>
      <div class="row between"><span>${t('language')}</span><span>
        <button class="chip ${S.lang === 'zh' ? 'on' : ''}" data-act="lang" data-arg="zh">中文</button>
        <button class="chip ${S.lang === 'en' ? 'on' : ''}" data-act="lang" data-arg="en">English</button></span></div>
    </div>`;
}

function panelFeed() {
  if (!S.feed.length) return `<h1 class="panel-title">${t('tab_feed')}</h1><p class="muted center gap-top">${t('feed_empty')}</p>`;
  const items = [...S.feed].reverse().map(it => {
    const f = homeOf(it.from);
    const btn = it.gift ? (it.claimed ? `<span class="muted">${t('claimed')}</span>`
      : `<button class="btn small primary" data-act="claim" data-arg="${it.id}">${t('claim')}</button>`)
      : it.kind === 'stole' || it.kind === 'caught' ? `<button class="btn small" data-act="visit" data-arg="${it.from}">${t('visit_back')}</button>` : '';
    return `<div class="list-item">${f ? avatar(f.look) : ''}<div class="grow"><div>${feedText(it)}</div>
      <div class="muted">${ago(it.t)}</div></div>${btn}</div>`;
  }).join('');
  return `<h1 class="panel-title">${t('tab_feed')}</h1><p class="muted note">${t('feed_note')}</p><div class="card">${items}</div>`;
}

// ---------- sheets ----------
function openSheet(type, arg) {
  UI.sheet = { type, arg };
  renderSheet();
  const compact = ['friend', 'field', 'animal', 'car'].includes(type);
  $('#sheet').className = 'sheet' + (compact ? ' compact' : '');
  $('#sheet').hidden = false;
  $('#backdrop').hidden = false;
  $('#backdrop').classList.toggle('light', compact);
}
function closeSheet() { UI.sheet = null; $('#sheet').hidden = true; $('#backdrop').hidden = true; UI.welcome = false; }
const SHEETS = {
  collect() {
    const title = UI.welcome ? t('welcome_back') : t('collect_title');
    if (!S.pending.length) return `<h2>${title}</h2><p class="muted">${t('collect_empty')}</p>`;
    const rows = S.pending.map(p => `<div class="list-item"><span class="big-emoji">${SRC_EMOJI[p.src]}</span>
      <div class="grow"><b>${pendingTitle(p)}</b><div class="reward">${rewardText(p.reward)}</div></div></div>`).join('');
    return `<h2>${title}</h2><p class="muted">${t('collect_desc')}</p><div class="card">${rows}</div>
      <button class="btn primary block" data-act="collectAll">${t('collect_all')}</button>`;
  },
  field(arg) {
    const { owner, i } = arg, h = homeOf(owner), f = h.fields[i], mine = owner === 'me';
    if (!f) {
      if (!mine) return `<h2>🟫 ${t('empty_field')}</h2><p class="muted">${t('friend_empty_field', { name: esc(homeName(h)) })}</p>`;
      const owned = Object.entries(CROPS).filter(([k]) => h.seeds[k] > 0);
      const left = actionsLeft();
      const list = owned.length ? owned.map(([k, c]) => `<div class="list-item">${thumbImg('crop', k, {}, 64, 52, 'thumb sm')}
          <div class="grow"><b>${c.e} ${nm(c)}</b> <span class="muted">×${h.seeds[k]}</span>
          <div class="cost">${t('seed_sub', { d: fmtDur(c.grow), n: c.yield, p: c.sell })}</div></div>
          <div class="col-btns">${buyBtn('plant', k, t('plant'), left > 0)}${buyBtn('plantAll', k, t('plant_all'), left > 0, '')}</div></div>`).join('')
        : `<p class="muted">${t('no_seeds')}</p><button class="btn block gap-top" data-act="openShop" data-arg="seeds">🛒 ${t('buy_seeds')}</button>`;
      return `<h2>🌱 ${t('plant_title')}</h2><p class="muted">${t('build_left', { n: left, cap: ACTION_CAP })}</p><div class="card">${list}</div>`;
    }
    const c = CROPS[f.crop], st = cropStage(f), left = c.grow - (now() - f.at);
    const thieves = f.thieves.filter(x => x !== owner).map(fname).filter(Boolean);
    let extra = '';
    if (mine && thieves.length && f.left < c.yield) extra = `<p class="muted">${t('stolen_by', { names: esc(thieves.join('、')) })}</p>`;
    if (!mine && isRipe(f)) extra = `<p class="muted">${f.thieves.includes('me') ? t('steal_done') : t('steal_keep')}</p>`;
    return `<div class="row">${thumbImg('crop', f.crop, { stage: st }, 96, 80, 'thumb')}<div class="grow">
        <h2>${c.e} ${nm(c)}</h2><div class="muted">${nm(CROP_STAGES[st])} · ${t('yield_left', { n: f.left })}</div></div></div>
      <div class="card gap-top">${st < 4 ? `<p>${t('growing_left', { d: `<b id="growLeft">${fmtDur(left)}</b>` })}</p>
        <div class="bar"><i id="growBar" style="width:${cropProgress(f) * 100}%"></i></div>` : `<p>✅ ${t('ripe_now')}</p>`}
        <div class="stages">${[0, 1, 2, 3, 4].map(s => `<div class="${s === st ? 'on' : ''}">${thumbImg('crop', f.crop, { stage: s }, 72, 60, 'thumb xs')}<span>${nm(CROP_STAGES[s])}</span></div>`).join('')}</div>
        ${extra}<p class="muted">${t('never_wilts')}</p></div>`;
  },
  animal(arg) {
    const { owner, id } = arg, h = homeOf(owner), a = h.animals.find(x => x.id === id);
    if (!a) return `<p class="muted">${t('animal_gone')}</p>`;
    const d = ANIMALS[a.k], st = animalStage(a), mine = owner === 'me';
    let info;
    if (st < 2) info = `<p>${t('grow_left', { d: `<b id="growLeft">${fmtDur(d.grow - (now() - a.born))}</b>` })}</p><div class="bar"><i id="growBar" style="width:${animalProg(a) * 100}%"></i></div>`;
    else if (d.pet) info = `<p>🛡️ ${t('dog_sub')}</p>`;
    else {
      const what = nextIsBaby(a) ? `🍼 ${t('a_baby', { name: nm(d.baby) })}` : `${GOODS[d.prod].e}×${d.n}`;
      info = animalReady(a) ? `<p>✅ ${t('prod_ready', { what })}</p>`
        : `<p>${t('prod_left', { d: `<b id="growLeft">${fmtDur(d.every - (now() - (a.last || a.born + d.grow)))}</b>`, what })}</p><div class="bar warm"><i id="growBar" style="width:${prodProg(a) * 100}%"></i></div>`;
    }
    const btns = mine ? `<div class="row gap-top">${animalReady(a) ? buyBtn('collectAnimal', a.id, t('collect'), true) : ''}
        ${buyBtn('sellAnimal', a.id, t('sell_for', { n: d.sell[st] }), true, '')}</div>` : '';
    return `<div class="row">${thumbImg('animal', a.k, { stage: st }, 96, 80)}<div class="grow"><h2>${d.e} ${animalName(a)}</h2>
      <div class="muted">${stageName(a)}${mine ? '' : ' · ' + t('home_of', { name: esc(homeName(h)) })}</div></div></div>
      <div class="card gap-top">${info}
        <div class="stages">${[0, 1, 2].map(s => `<div class="${s === st ? 'on' : ''}">${thumbImg('animal', a.k, { stage: s }, 72, 60, 'thumb xs')}<span>${t(['stage_baby', 'stage_young', 'stage_adult'][s])}</span></div>`).join('')}</div>
      </div>${btns}`;
  },
  barn() {
    const h = S.me, keys = Object.keys(h.barn);
    const goods = keys.length ? keys.map(k => { const b = barnInfo(k); return `<div class="list-item"><span class="big-emoji">${b.e}</span>
      <div class="grow"><b>${b.name}</b> <span class="muted">×${h.barn[k]}</span><div class="cost">${t('sell_each', { n: b.sell })}</div></div>
      ${buyBtn('sell', k + '|' + h.barn[k], t('sell_n', { n: fmtNum(h.barn[k] * b.sell) }), true, '')}</div>`; }).join('')
      : `<p class="muted">${t('barn_empty')}</p>`;
    const seeds = Object.entries(h.seeds).filter(([, n]) => n > 0);
    const store = Object.entries(h.store);
    return `<h2>🧺 ${t('barn_title')}</h2><p class="muted">${t('barn_desc')}</p>
      <div class="card"><div class="row between"><h3>🌾 ${t('barn_goods')}</h3>${keys.length ? `<button class="btn small primary" data-act="sellAll">${t('sell_all', { n: fmtNum(barnValue()) })}</button>` : ''}</div>${goods}</div>
      <div class="card"><h3>🌱 ${t('barn_seeds')}</h3>${seeds.length ? seeds.map(([k, n]) => `<span class="chip static">${CROPS[k].e} ${nm(CROPS[k])} ×${n}</span>`).join('') : `<p class="muted">${t('no_seeds_short')}</p>`}</div>
      <div class="card"><h3>📦 ${t('barn_store')}</h3>${store.length ? store.map(([key, n]) => { const [sc, k] = key.split(':'); return `<span class="chip static">${nm(itemDef(sc, k))} ×${n}</span>`; }).join('') : `<p class="muted">${t('store_empty')}</p>`}</div>`;
  },
  car(owner) {
    const h = homeOf(owner), c = h.cars[h.car], mine = owner === 'me';
    if (!c) return '';
    const swatches = CAR_COLORS.map(col => `<button class="swatch ${col === c.color ? 'on' : ''}" style="background:${col}" data-act="carColor" data-arg="${col}"></button>`).join('');
    const others = h.cars.map((x, i) => i === h.car ? '' : `<button class="chip" data-act="driveCar" data-arg="${i}">${nm(CARS[x.k])}</button>`).join('');
    return `<div class="row">${thumbImg('car', c.k, { color: c.color }, 110, 90)}<div class="grow"><h2>${nm(CARS[c.k])}</h2>
      <div class="muted">${t('worth', { v: fmtNum(costValue(CARS[c.k].cost)) })}</div></div></div>
      ${mine ? `<div class="card gap-top"><h3>🎨 ${t('car_color')}</h3><div class="swatches left">${swatches}</div></div>
      ${others ? `<div class="card"><h3>🚗 ${t('car_switch')}</h3>${others}</div>` : ''}
      <button class="btn block" data-act="openShop" data-arg="cars">🛒 ${t('car_shop')}</button>` : ''}`;
  },
  friend(id) {
    const f = friendById(id), liked = S.today.liked[id];
    const status = f.shareGoal ? (f.goalToday ? `✅ ${t('f_goal_done')}` : `⏳ ${t('f_goal_not_yet')}`) : `🔒 ${t('f_private')}`;
    const gifts = giftOptions();
    return `<div class="row">${avatar(f.look, 'xl')}<div><h2>${t('home_of', { name: esc(homeName(f)) })}</h2>
        <div class="muted">${nm(HOUSES[f.house])} · ❤️ ${f.likes} · 🏆 ${rankOf(f.id)}</div></div></div>
      <div class="card gap-top"><div>${status}</div><p class="muted">${t('goal_privacy_hint')}</p></div>
      <div class="card"><div class="row between"><h3>❤️ ${t('like_home')}</h3>
        <button class="btn small ${liked ? '' : 'primary'}" data-act="like" data-arg="${id}" ${liked ? 'disabled' : ''}>${liked ? t('liked') : t('like')}</button></div></div>
      <div class="card"><h3>💬 ${t('leave_msg')}</h3>
        ${MSG_KEYS.map(k => `<button class="chip" data-act="msg" data-arg="${id}|${k}">${t(k)}</button>`).join('')}</div>
      <div class="card"><h3>🎁 ${t('send_gift')}</h3>
        ${gifts.length ? gifts.map((g, i) => `<button class="chip" data-act="gift" data-arg="${id}|${i}">${giftText(g)}</button>`).join('') : `<p class="muted">${t('no_gifts')}</p>`}
        <p class="muted">${t('social_free')}</p></div>`;
  },
  ranking() {
    const rk = ranking(), total = townTotal(), lv = townLevel(total), next = TOWN_LEVELS[lv];
    const pct = next ? Math.min(100, (total - TOWN_LEVELS[lv - 1]) / (next - TOWN_LEVELS[lv - 1]) * 100) : 100;
    const rows = rk.map((r, i) => {
      const me = r.h.id === 'me';
      return `<div class="list-item ${me ? 'me-row' : ''}"><span class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span>${avatar(r.h.look)}
        <div class="grow"><b>${esc(homeName(r.h))}</b><div class="muted">${nm(HOUSES[r.h.house])}${r.h.cars.length ? ' · ' + nm(CARS[r.h.cars[Math.max(0, r.h.car)].k]) : ''} · ${t('animals_n', { n: r.h.animals.length })}</div></div>
        <div class="right"><b>🪙${fmtNum(r.v)}</b>${me ? '' : `<button class="btn small" data-act="visit" data-arg="${r.h.id}">${t('visit')}</button>`}</div></div>`;
    }).join('');
    const b = assetBreakdown(S.me);
    const parts = ['cash', 'house', 'land', 'items', 'cars', 'animals', 'goods'].map(k => `<div class="asset-row"><span>${t('a_' + k)}</span><b>🪙${fmtNum(b[k])}</b></div>`).join('');
    const empty = S.slots.filter(s => !s.owner).length;
    return `<h2>🏆 ${t('rank_title', { street: t('street_name') })}</h2>
      <div class="card town-card"><div class="row between"><b>🏛️ ${t('town_total')}</b><b>🪙${fmtNum(total)}</b></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="muted">Lv${lv} · ${next ? t('town_next', { n: fmtNum(next - total), lv: lv + 1 }) : t('town_max')}</div>
        <p class="muted">${t('town_note')}</p></div>
      <div class="card">${rows}</div>
      <div class="card"><h3>📊 ${t('my_assets')}</h3>${parts}<div class="asset-row total"><span>${t('a_total')}</span><b>🪙${fmtNum(b.total)}</b></div></div>
      ${empty ? `<button class="btn primary block" data-act="invite">✉️ ${t('invite_btn')}</button><p class="muted center gap-top">${t('invite_reward_note')}</p>` : ''}
      <p class="muted center gap-top">${t('rank_privacy')}</p>`;
  },
  invite() {
    const code = S.created.toString(36).slice(-6);
    return `<h2>🪧 ${t('invite_title')}</h2><p class="muted">${t('invite_desc')}</p>
      <div class="invite-link">https://mirror.town/join/${code}</div>
      <button class="btn primary block" data-act="copyInvite">${t('copy_link')}</button>
      <p class="muted gap-top">${t('invite_note')}</p>`;
  },
  cap() {
    return `<div class="center"><div class="big-emoji xl">🌙</div><h2>${t('cap_heading')}</h2>
      <p class="cap-text">${t('cap_text')}</p>
      <button class="btn primary block gap-top" data-act="close">${t('cap_ok')}</button></div>`;
  },
};
function renderSheet() {
  if (!UI.sheet) return;
  const html = SHEETS[UI.sheet.type](UI.sheet.arg);
  $('#sheet').innerHTML = `<div class="grab"></div>${html}`;
}
const cropProgress = f => cropProg(f);

// ---------- console (prototype-only controls) ----------
function renderConsole() {
  const el = $('#console');
  if (!S) { el.innerHTML = `<div class="console-head"><b>🛠 ${t('console_title')}</b></div><p class="muted">${t('console_wait')}</p>`; return; }
  const b = (act, arg, label) => `<button class="btn small" data-act="${act}" data-arg="${arg}">${label}</button>`;
  el.innerHTML = `
    <div class="console-head"><b>🛠 ${t('console_title')} <span class="muted">v${VERSION}</span></b><button class="x" data-act="consoleClose">✕</button></div>
    <p class="muted">${t('console_desc')}</p>
    <div class="con-group"><h4>${t('con_health')}</h4>
      ${b('simSteps', 1000, '+1,000 ' + t('steps_unit'))}${b('simSteps', 3000, '+3,000 ' + t('steps_unit'))}</div>
    <div class="con-group"><h4>${t('con_screen')}</h4>
      ${b('simFocus', 30, t('offline_x', { d: fmtDur(30 * MIN) }))}${b('simFocus', 60, t('offline_x', { d: fmtDur(60 * MIN) }))}${b('simFocus', 120, t('offline_x', { d: fmtDur(120 * MIN) }))}
      ${b('simDistract', 20, t('distract_btn'))}</div>
    <div class="con-group"><h4>${t('con_time')}</h4>
      <div class="muted">${t('sim_time')}: <b id="conTime">${fmtDate(now())}</b></div>
      ${b('simTime', 10, t('ff_x', { d: fmtDur(10 * MIN) }))}${b('simTime', 60, t('ff_x', { d: fmtDur(HOUR) }))}${b('simTime', 360, t('ff_x', { d: fmtDur(6 * HOUR) }))}${b('simDay', '', t('next_day'))}</div>
    <div class="con-group"><h4>${t('con_friends')}</h4>
      ${b('simEvent', '', t('sim_friend_event'))}${b('simSteal', '', t('sim_steal'))}${b('simJoin', '', t('sim_join'))}</div>
    <div class="con-group"><h4>${t('con_demo')}</h4>${b('simMoney', '', t('demo_money'))}<p class="muted">${t('demo_note')}</p></div>
    <div class="con-group"><h4>${t('con_widget')}</h4><div id="widget"></div></div>
    <div class="con-group"><button class="btn small danger" data-act="reset">${t('reset')}</button></div>`;
  renderWidget();
}
// Lock-screen widget mock: shows the latest social event, the main re-entry point.
function renderWidget() {
  const el = $('#widget');
  if (!el || !S) return;
  const last = [...S.feed].reverse().find(i => i.kind !== 'goal');
  const ripe = ripeCount();
  el.innerHTML = `<div class="lock"><div class="lock-date">${fmtDate(now()).replace(/ \d+:\d+$/, '')}</div>
    <div class="lock-time">${fmtClock(now())}</div>
    <div class="widget"><div class="w-title">🏡 ${t('app_name')}</div>
      <div class="w-line">${last ? feedText(last) : t('w_quiet')}</div>
      <div class="w-sub">${ripe ? t('w_ripe', { n: ripe }) : t('w_growing')}</div></div></div>`;
}

// ---------- actions ----------
function result(code, onOk) {
  if (code === 'ok') {
    onOk();
    if (actionsLeft() === 0) setTimeout(() => openSheet('cap'), 700);
  } else if (code === 'cap') openSheet('cap');
  else if (code === 'poor') snack(t('snack_poor'));
  else if (code === 'nopasture') snack(t('no_pasture'));
  else if (code === 'full') snack(t('snack_full_pasture'));
  else if (code === 'own') snack(t('owned'));
}
function maybeReply(id, kind) {
  setTimeout(() => {
    if (!S || Math.random() > 0.75) return;
    const it = kind === 'msg' ? addFeed({ kind: 'msg', from: id, msgKey: rand(MSG_KEYS) })
      : addFeed({ kind: 'gift', from: id, msgKey: 'thanks', gift: randomGift() });
    notify(it); refresh();
  }, 4000 + Math.random() * 4000);
}
function afterTimeJump(events) {
  simFriends();
  if (checkDay()) {
    snack(t('snack_new_day'));
    for (let k = 0; k < events; k++) if (Math.random() < 0.7) notify(randomFriendEvent());
    if (S.pending.length) { UI.welcome = true; openSheet('collect'); }
  } else {
    snack(t('snack_ff'));
    if (Math.random() < 0.5) notify(randomFriendEvent());
  }
}
function harvestField(i) {
  const r = harvest(i);
  if (!r) return;
  Scene.floatField(i, `+${r.n} ${CROPS[r.crop].e}`);
  snack(t('snack_harvest', { n: r.n, e: CROPS[r.crop].e }));
}
function collectFrom(id) {
  const r = collectAnimal(id);
  if (!r) return;
  if (r.type === 'baby') {
    Scene.floatAnimal('me', id, '🍼');
    snack(t(r.placed ? 'snack_baby' : 'snack_baby_barn', { name: nm(ANIMALS[r.k].baby) }));
  } else {
    Scene.floatAnimal('me', id, `+${r.n} ${GOODS[r.k].e}`);
    snack(t('snack_prod', { n: r.n, e: GOODS[r.k].e }));
  }
}
function edScope() { const e = Scene.getEdit(); return e && e.scope; }

const ACT = {
  tab(a) {
    if (a === 'town' && UI.tab === 'town') { UI.visit = null; UI.visitInside = false; } // tapping 小镇 again goes back to the overview
    setTab(a);
  },
  collect: () => openSheet('collect'),
  collectAll() {
    if (!S.pending.length) return;
    const r = sumRewards(S.pending);
    addReward(r); S.pending = [];
    closeSheet();
    if (UI.tab === 'home' && !UI.inside) Scene.floatHouse(rewardText(r)); else snack(rewardText(r));
  },
  close: () => closeSheet(),
  // home & visiting
  goIn() { if (UI.tab === 'home') UI.inside = true; else UI.visitInside = true; syncView(); },
  goOut() { if (UI.tab === 'home') UI.inside = false; else UI.visitInside = false; syncView(); },
  recenter: () => Scene.recenter(),
  backTown() { UI.visit = null; UI.visitInside = false; syncView(); },
  visit(id) { closeSheet(); if (id === 'me') { setTab('home'); return; } UI.tab = 'town'; UI.visit = id; UI.visitInside = false; syncView(); },
  ranking: () => openSheet('ranking'),
  barn: () => openSheet('barn'),
  friendSheet: id => openSheet('friend', id),
  harvestAll() {
    const crops = harvestAll(), prods = collectAllAnimals();
    crops.forEach(r => Scene.floatField(r.i, `+${r.n} ${CROPS[r.crop].e}`));
    prods.forEach(r => Scene.floatAnimal('me', r.id, r.type === 'baby' ? '🍼' : `+${r.n} ${GOODS[r.k].e}`));
    snack(t('snack_harvest_all', { n: crops.length + prods.length }));
  },
  // farm
  plant(c) {
    const i = UI.sheet.arg.i;
    result(plant(i, c), () => { closeSheet(); Scene.floatField(i, '🌱'); });
  },
  plantAll(c) {
    const r = plantAll(c);
    if (r.n) { closeSheet(); S.me.fields.forEach((f, i) => { if (f && now() - f.at < 1000) Scene.floatField(i, '🌱'); }); snack(t('snack_planted', { n: r.n, e: CROPS[c].e })); }
    if (r.cap) openSheet('cap');
  },
  collectAnimal(id) { collectFrom(id); closeSheet(); },
  sellAnimal(id) {
    const a = S.me.animals.find(x => x.id === id);
    if (!a || !confirm(t('sell_confirm', { name: animalName(a) }))) return;
    const v = sellAnimal(id);
    closeSheet(); snack(t('snack_sold', { n: v }));
  },
  // shop
  openShop(cat) { closeSheet(); UI.shop = cat; setTab('shop'); },
  shopCat(c) { UI.shop = c; },
  buySeed(arg) { const [k, n] = arg.split('|'); result(buySeed(k, +n), () => snack(t('snack_seed', { e: CROPS[k].e, n }))); },
  buyAnimal(k) { result(buyAnimal(k), () => snack(t('snack_animal', { name: nm(ANIMALS[k].baby) }))); },
  buyField: () => result(buyFieldLv(), () => snack(t('snack_field', { n: S.me.fields.length }))),
  buyPasture: () => result(buyPastureLv(), () => snack(t('snack_pasture', { cap: pastureCap() }))),
  buyItem(arg) {
    const [scope, k] = arg.split('|'), r = buyItem(scope, k);
    if (r.r === 'poor') return snack(t('snack_poor'));
    snack(t(r.item ? (scope === 'room' ? 'snack_furn' : 'snack_yard') : 'snack_stored', { name: nm(itemDef(scope, k)) }));
  },
  buyCar(k) { result(buyCar(k), () => snack(t('snack_car', { name: nm(CARS[k]) }))); },
  driveCar(i) { S.me.car = +i; snack(t('snack_drive', { name: nm(CARS[S.me.cars[+i].k]) })); },
  carColor(c) { const car = S.me.cars[S.me.car]; if (car) car.color = c; },
  buyHouse(i) {
    result(buyHouse(+i), () => {
      snack(t('snack_house', { name: nm(HOUSES[+i]) }));
      UI.tab = 'home'; UI.inside = false; syncView();
      setTimeout(() => Scene.floatHouse('🎉'), 300);
    });
  },
  sell(arg) { const [k, n] = arg.split('|'), v = sellBarn(k, +n); if (v) snack(`+🪙${v}`); },
  sellAll() { const v = sellAllBarn(); if (v) snack(t('snack_sold', { n: v })); },
  release(k) { if (releaseBaby(k)) snack(t('snack_baby', { name: nm(ANIMALS[k].baby) })); },
  // design mode
  design() { Scene.startEdit(UI.tab === 'home' && UI.inside ? 'room' : 'yard'); UI.tray = 'items'; },
  editDone() { Scene.stopEdit(); },
  trayTab(x) { UI.tray = x; },
  holdNew(k) { const scope = edScope(); Scene.hold({ k, rot: 0, tint: itemDef(scope, k).tint ? rand(TINTS) : null }); },
  trayRotate() {
    const ed = Scene.getEdit();
    if (ed.hold) ed.hold.rot = ed.hold.rot ? 0 : 1;
    else if (ed.sel && !rotateItem(ed.scope, ed.sel)) snack(t('snack_norotate'));
  },
  trayTint() { const ed = Scene.getEdit(); tintItem(ed.scope, ed.sel); },
  trayMove() { const ed = Scene.getEdit(), it = findItem(ed.scope, ed.sel); if (it) Scene.hold({ k: it.k, rot: it.rot, tint: it.tint, id: it.id }); },
  trayStore() { const ed = Scene.getEdit(); storeItem(ed.scope, ed.sel); Scene.select(null); snack(t('snack_to_store')); },
  trayCancel() { Scene.hold(null); },
  setRoomWall(i) { S.me.room.wall = +i; },
  setFloor(i) { S.me.room.floor = +i; },
  setWall(i) { S.me.wall = WALL_COLORS[+i]; },
  setRoof(i) { S.me.roof = ROOF_COLORS[+i]; },
  // social
  like(id) { if (likeFriend(id)) { snack(t('snack_liked')); Scene.wave(id); } else snack(t('liked')); },
  msg(arg) {
    const [id, k] = arg.split('|');
    snack(t('snack_msg', { name: fname(id) }));
    Scene.wave('me');
    maybeReply(id, 'msg');
  },
  gift(arg) {
    const [id, i] = arg.split('|'), g = giftOptions()[+i];
    if (!g || !giveGift(id, g)) return;
    snack(t('snack_gift', { name: fname(id), gift: giftText(g) }));
    Scene.wave('me');
    maybeReply(id, 'gift');
  },
  invite: () => openSheet('invite'),
  copyInvite() {
    const link = $('.invite-link').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => snack(t('snack_copied')), () => snack(link));
  },
  claim(id) { const g = claimGift(id); if (g) snack(t('snack_claimed', { gift: giftText(g) })); },
  restDay() { if (setRestDay()) snack(t('snack_rest')); },
  share() { S.me.shareGoal = !S.me.shareGoal; },
  lang(l) { S.lang = l; document.documentElement.lang = l; },
  reset() { if (confirm(t('reset_confirm'))) { localStorage.removeItem(STORAGE_KEY); location.reload(); } },
  // console
  simSteps(n) { const r = recordSteps(+n); snack(r === 'goal' ? t('snack_goal') : t('snack_steps', { n: fmtNum(+n) })); },
  simFocus(n) { recordFocus(+n); snack(t('snack_focus', { d: fmtDur(n * MIN) })); },
  simDistract(n) { recordDistract(+n); snack(t('snack_distract')); },
  simTime(m) { S.timeOffset += m * MIN; afterTimeJump(m >= 60 ? 1 : 0); },
  simDay() { S.timeOffset += DAY; afterTimeJump(3); },
  simEvent() { notify(randomFriendEvent()); },
  simSteal() {
    const ids = friendIds();
    const ev = ids.length && friendStealsFromMe(rand(ids));
    if (ev) notify(ev); else snack(t('snack_nothing_ripe'));
  },
  simJoin() { const it = inviteJoin(); if (it) notify(it); else snack(t('snack_full')); },
  simMoney() { S.me.coins += 1000; S.me.wood += 50; snack('+🪙1000 +🪵50'); },
  consoleToggle() { $('#console').classList.toggle('open'); },
  consoleClose() { $('#console').classList.remove('open'); },
  hintOk() { S.seenHint = true; },
};

// Taps on the scene.
function onSceneHit(h) {
  const k = h.kind;
  if (k === 'pending') return openSheet('collect');
  if (k === 'collect') { collectFrom(h.id); return refresh(); }
  if (k === 'buyField') return ACT.openShop('land'), refresh();
  if (k === 'buyPasture') return ACT.openShop('land'), refresh();
  if (k === 'pasture') return ACT.openShop('animals'), refresh();
  if (k === 'field') {
    const hm = homeOf(h.owner), f = hm.fields[h.i];
    if (h.owner === 'me' && isRipe(f)) { harvestField(h.i); return refresh(); }
    if (h.owner !== 'me' && stealable(hm, h.i)) return doSteal(h.owner, h.i);
    return openSheet('field', { owner: h.owner, i: h.i });
  }
  if (k === 'steal') return doSteal(h.owner, h.i);
  if (k === 'animal') return openSheet('animal', { owner: h.owner, id: h.id });
  if (k === 'house') { if (UI.tab === 'home') UI.inside = true; else UI.visitInside = true; syncView(); return refresh(); }
  if (k === 'exit') { if (UI.tab === 'home') UI.inside = false; else UI.visitInside = false; syncView(); return refresh(); }
  if (k === 'car') return openSheet('car', h.owner);
  if (k === 'avatar') {
    Scene.wave(h.owner);
    if (h.owner === 'me') snack(`${ENERGY_EMOJI[energyLevel()]} ${t('energy_' + energyLevel())}`);
    else openSheet('friend', h.owner);
    return;
  }
  if (k === 'furn') return snack(nm(FURN[h.k]));
  if (k === 'lot') return ACT.visit(h.owner), refresh();
  if (k === 'emptyLot') return openSheet('invite');
  if (k === 'plaza') return openSheet('ranking');
  // design mode
  const ed = Scene.getEdit();
  if (!ed) return;
  if (k === 'place') {
    const hd = ed.hold;
    const ok = hd.id ? moveItem(ed.scope, hd.id, h.x, h.y, hd.rot) : placeFromStore(ed.scope, hd.k, h.x, h.y, hd.rot, hd.tint);
    if (ok) { Scene.hold(null); snack(t('snack_placed')); } else snack(t('snack_noroom'));
  } else if (k === 'item') Scene.select(h.id);
  else if (k === 'deselect') Scene.select(null);
  refresh();
}
function doSteal(fid, i) {
  const r = steal(fid, i);
  if (r.r === 'ok') { Scene.floatField(i, `+${r.n} ${CROPS[r.crop].e}`); snack(t('snack_stole', { n: r.n, e: CROPS[r.crop].e })); }
  else if (r.r === 'dog') { Scene.floatField(i, '🐕💢'); snack(t('snack_dog', { name: fname(fid) })); }
  else if (r.r === 'limit') snack(t('snack_steal_limit', { n: STEAL_CAP }));
  else if (r.r === 'cap') openSheet('cap');
  else if (r.r === 'empty') snack(t('steal_keep'));
  else if (r.r === 'done') snack(t('steal_done'));
  // sometimes the owner notices and leaves a note
  if (r.r === 'ok' && Math.random() < 0.3) setTimeout(() => { notify(addFeed({ kind: 'msg', from: fid, msgKey: 'msg_veg' })); refresh(); }, 3000 + Math.random() * 3000);
  refresh();
}

function refresh() {
  if (!S) return;
  if (UI.tab === 'feed') S.feed.forEach(i => { i.read = true; });
  save();
  renderHUD(); renderTabbar(); renderPanel(); renderOverlay(); renderConsole(); renderSheet();
}

// ---------- onboarding ----------
let obAnim = null;
function renderOnboarding() {
  const el = $('#onboard');
  cancelAnimationFrame(obAnim);
  const langs = `<div class="ob-lang"><button class="chip ${OB.lang === 'zh' ? 'on' : ''}" data-act="obLang" data-arg="zh">中文</button>
    <button class="chip ${OB.lang === 'en' ? 'on' : ''}" data-act="obLang" data-arg="en">English</button></div>`;
  const dots = `<div class="ob-dots">${[0, 1, 2].map(i => `<i class="${i === OB.step ? 'on' : ''}"></i>`).join('')}</div>`;
  if (OB.step === 0) {
    el.innerHTML = `${langs}<div class="ob-body"><div class="ob-hero">🏡</div><h1>${t('app_name')}</h1>
      <p class="ob-tag">${t('tagline')}</p>
      <ul class="ob-points"><li>🏃 ${t('ob_p1')}</li><li>📵 ${t('ob_p2')}</li><li>🏘️ ${t('ob_p3')}</li></ul></div>
      ${dots}<button class="btn primary block" data-act="obNext">${t('ob_start')}</button>`;
  } else if (OB.step === 1) {
    const L = OB.look;
    const sw = (list, cur, act) => list.map(c => `<button class="swatch sm ${c === cur ? 'on' : ''}" style="background:${c}" data-act="${act}" data-arg="${c}"></button>`).join('');
    el.innerHTML = `<div class="ob-body"><h2>${t('ob_you')}</h2>
      <canvas id="obCanvas" class="ob-canvas"></canvas>
      <input id="obName" class="input" maxlength="12" placeholder="${t('ob_name_ph')}" value="${esc(OB.name)}">
      <div class="look-row"><span>${t('ob_shirt')}</span><div class="swatches left">${sw(COLORS, L.shirt, 'obShirt')}</div></div>
      <div class="look-row"><span>${t('ob_skin')}</span><div class="swatches left">${sw(SKINS, L.skin, 'obSkin')}</div></div>
      <div class="look-row"><span>${t('ob_hair')}</span><div>${HAIRS.map(hs => `<button class="chip ${L.hair === hs ? 'on' : ''}" data-act="obHair" data-arg="${hs}">${t('hair_' + hs)}</button>`).join('')}</div></div>
      <div class="look-row"><span>${t('ob_hair_col')}</span><div class="swatches left">${sw(HAIR_COLORS, L.hairCol, 'obHairCol')}</div></div>
      <div class="look-row"><span>${t('ob_mob')}</span><div><button class="chip ${L.mob === 'walk' ? 'on' : ''}" data-act="obMob" data-arg="walk">🚶 ${t('mob_walk')}</button>
        <button class="chip ${L.mob === 'wheel' ? 'on' : ''}" data-act="obMob" data-arg="wheel">🦽 ${t('mob_wheel')}</button></div></div>
      <p class="muted center">${t('ob_look_note')}</p></div>
      ${dots}<button class="btn primary block" data-act="obNext">${t('next')}</button>`;
    const cvs = $('#obCanvas');
    const loop = ts => {
      Scene.thumb('person', 'ob', { look: OB.look, canvas: cvs, live: true, ts, moving: true, phase: ts / 100, energy: 'high' }, 140, 130);
      obAnim = requestAnimationFrame(loop);
    };
    obAnim = requestAnimationFrame(loop);
  } else {
    el.innerHTML = `<div class="ob-body"><h2>${t('ob_apps')}</h2><p class="muted">${t('ob_apps_desc')}</p>
      <div class="app-grid">${APPS.map(a => `<button class="app-pick ${OB.apps.includes(a.id) ? 'on' : ''}" data-act="obApp" data-arg="${a.id}">
        <span>${a.emoji}</span>${a.name || t('app_games')}</button>`).join('')}</div>
      <h3 class="gap-top">${t('ob_limit')}</h3>
      <div>${[30, 60, 90, 120].map(m => `<button class="chip ${OB.limit === m ? 'on' : ''}" data-act="obLimit" data-arg="${m}">${fmtDur(m * MIN)}</button>`).join('')}</div>
      <p class="muted gap-top">🔒 ${t('ob_privacy')}</p></div>
      ${dots}<button class="btn primary block" data-act="obDone" ${OB.apps.length ? '' : 'disabled'}>${t('ob_move_in')}</button>`;
  }
}
Object.assign(ACT, {
  obLang(l) { OB.lang = l; document.documentElement.lang = l; renderOnboarding(); renderConsole(); },
  obNext() { OB.step++; renderOnboarding(); },
  obShirt(c) { OB.look.shirt = c; renderOnboarding(); },
  obSkin(c) { OB.look.skin = c; renderOnboarding(); },
  obHair(h) { OB.look.hair = h; renderOnboarding(); },
  obHairCol(c) { OB.look.hairCol = c; renderOnboarding(); },
  obMob(m) { OB.look.mob = m; renderOnboarding(); },
  obApp(id) { OB.apps = OB.apps.includes(id) ? OB.apps.filter(x => x !== id) : [...OB.apps, id]; renderOnboarding(); },
  obLimit(m) { OB.limit = +m; renderOnboarding(); },
  obDone() {
    cancelAnimationFrame(obAnim);
    newGame({ lang: OB.lang, name: OB.name.trim() || t('default_name'), look: OB.look, apps: OB.apps, limitMin: OB.limit });
    OB = null;
    $('#onboard').hidden = true;
    start();
  },
});

// ---------- boot ----------
function start() {
  document.documentElement.lang = S.lang;
  checkDay();
  simFriends();
  setTab('home');
  refresh();
  if (S.pending.length) { UI.welcome = true; openSheet('collect'); }
  if (!S.welcomed) {
    S.welcomed = true;
    setTimeout(() => {
      notify(addFeed({ kind: 'gift', from: 'wang', msgKey: 'welcome', gift: { type: 'seed', k: 'tomato', n: 2 } }));
      refresh();
    }, 2500);
  }
}

document.addEventListener('click', e => {
  if (e.target.id === 'backdrop') return closeSheet();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  fn(el.dataset.arg);
  if (S && !el.dataset.act.startsWith('ob')) refresh();
});
document.addEventListener('input', e => { if (e.target.id === 'obName') OB.name = e.target.value; });

Scene.init($('#town'), onSceneHit);
setInterval(() => {
  if (!S) return;
  if (checkDay()) { snack(t('snack_new_day')); refresh(); }
  simFriends();
  const clock = $('#clock'); if (clock) clock.textContent = fmtClock(now());
  const ct = $('#conTime'); if (ct) ct.textContent = fmtDate(now());
  renderWidget();
  if (ripeCount() !== UI.harvestN) renderOverlay();
  // live countdowns in the crop and animal sheets (thumbnails are cached, so this is cheap)
  if (UI.sheet && (UI.sheet.type === 'field' || UI.sheet.type === 'animal')) renderSheet();
}, 1000);
// Friends stay active in the background, but rarely (no spam).
setInterval(() => {
  if (!S || document.hidden || Math.random() > 0.5) return;
  notify(randomFriendEvent()); refresh();
}, 45000);

if (load()) start();
else {
  OB = { step: 0, name: '', look: { shirt: COLORS[4], skin: SKINS[0], hair: 'short', hairCol: HAIR_COLORS[0], mob: 'walk' },
         apps: ['tiktok', 'instagram'], limit: 60, lang: (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en' };
  document.documentElement.lang = OB.lang;
  $('#onboard').hidden = false;
  renderOnboarding(); renderConsole();
}
