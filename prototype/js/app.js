'use strict';
// UI: HUD, tabs, buttons over the scene, shop, real-life page, mailbox, sheets, design mode, onboarding,
// the prototype console, and the bridge to the iPhone app (Apple Health).

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = { tab: 'home', inside: false, visit: null, visitInside: false, sheet: null, welcome: false, shop: 'seeds', tray: 'items', sig: '' };
let OB = null; // onboarding draft
const ENERGY_EMOJI = { great: '🤩', good: '🙂', tired: '🥱', exhausted: '😴' };
const SRC_EMOJI = { steps: '🚶', focus: '📵', goal: '⭐', rest: '🌙', ring: '⭕', rings: '🏅', workout: '💪', mindful: '🧘', sleep: '😴', welcome: '🎁' };
const RING_COL = { move: '#fa114f', exercise: '#92e82a', stand: '#1eeaef' };

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
  if (!g) return '';
  if (g.type === 'barn') { const b = barnInfo(g.k); return `${g.n} ${b.e}${b.name}`; }
  if (g.type === 'seed') return t('gift_seed', { n: g.n, e: CROPS[g.k].e, name: nm(CROPS[g.k]) });
  if (g.type === 'coins') return `🪙${g.n}`;
  return `🪵${g.n}`;
}
const goodE = k => (CROPS[k] || GOODS[k] || {}).e || '';
function fname(id) { const h = homeOf(id); return h ? homeName(h) : ''; }
function feedText(it) {
  const name = esc(fname(it.from));
  if (it.kind === 'gift') return t(it.msgKey === 'welcome' ? 'feed_welcome' : it.msgKey === 'thanks' ? 'feed_thanks' : 'feed_gift', { name, gift: giftText(it.gift) });
  if (it.kind === 'like') return t('feed_like', { name });
  if (it.kind === 'goal') return t('feed_goal', { name });
  if (it.kind === 'msg') return t('feed_msg', { name, msg: t(it.msgKey) });
  if (it.kind === 'join') return t('feed_join', { name, gift: giftText(it.gift) });
  if (it.kind === 'stole') return t('feed_stole', { name, n: it.n, e: goodE(it.k) });
  if (it.kind === 'caught') return t('feed_caught', { name, e: goodE(it.k) });
  if (it.kind === 'letter') return t('feed_letter', { name });
  return '';
}
function pendingTitle(p) {
  const i = p.info || {};
  if (p.src === 'steps') return t('p_steps', { n: fmtNum(i.steps) });
  if (p.src === 'focus') return t('p_focus', { d: fmtDur(i.min * MIN) });
  if (p.src === 'goal') return t('p_goal', { n: fmtNum(i.goal || stepGoal()) });
  if (p.src === 'welcome') return t('p_welcome');
  if (p.src === 'ring') return t('p_ring_' + i.ring);
  if (p.src === 'rings') return t('p_rings');
  if (p.src === 'workout') return t('p_workout', { e: WORKOUTS[i.type].e, name: nm(WORKOUTS[i.type]), n: i.min });
  if (p.src === 'mindful') return t('p_mindful', { n: i.min });
  if (p.src === 'sleep') return t('p_sleep', { n: i.score });
  return t('p_rest');
}
const thumbImg = (kind, k, o, w = 120, h = 96, cls = 'thumb') => `<img class="${cls}" alt="" src="${Scene.thumb(kind, k, o, w, h)}">`;
// Round head-and-shoulders portrait, drawn at the screen's pixel density so it stays sharp.
const avatar = (look, cls = '', energy = 'good') => `<span class="ava ${cls}" style="background-image:url(${Scene.thumb('face', 'a', { look, energy }, 96, 96)})"></span>`;
// In calm mode friends' fitness posts are hidden everywhere (feed, badges, counts).
const feedVisible = it => !(S.calm && it.kind === 'goal');
const unreadCount = () => S.feed.filter(i => feedVisible(i) && (!i.read || (i.gift && !i.claimed))).length;
const shownRoom = h => roomAt(h, Math.min(LEVEL, floorsOf(h) - 1));
const stageName = a => t(['stage_baby', 'stage_young', 'stage_adult'][animalStage(a)]);
const energyName = (e = energyLevel()) => t('energy_' + e);
const multText = m => (m > 1 ? `×${m} ${t('mult_bonus')}` : m < 1 ? `×${m} ${t('mult_tired')}` : '×1');
function readyLists() {
  const h = S.me;
  return {
    fields: h.fields.map((f, i) => (isRipe(f) ? i : -1)).filter(i => i >= 0),
    animals: h.animals.filter(animalReady).map(a => a.id),
    trees: h.trees.map((tr, i) => (i < orchardSlots(h) && treeReady(tr) ? i : -1)).filter(i => i >= 0),
    hives: h.yard.filter(it => YARD[it.k].prod && yardReady(it)).map(it => it.id),
  };
}
function ripeCount() { const r = readyLists(); return r.fields.length + r.animals.length + r.trees.length + r.hives.length; }

// ---------- feedback ----------
// Push-style banners are only for real social events, never for "your crops are ready".
function notify(item) {
  if (!item || !['gift', 'like', 'msg', 'join', 'stole', 'caught', 'letter'].includes(item.kind)) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="app">🏡</div><div><b>${t('app_name')} · ${t('now')}</b>${feedText(item)}</div>`;
  el.onclick = () => { if (item.kind === 'letter') openSheet('mail'); else setTab('feed'); refresh(); };
  el.style.pointerEvents = 'auto';
  $('#toasts').prepend(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 4200);
}
// ---------- weather ----------
function weatherPill() { const w = weatherNow(); return `<button class="pill weather" data-act="weatherInfo">${WEATHER_E[w.kind]} ${w.temp != null ? w.temp + '°' : ''}</button>`; }
// Real weather where the player is: rough location (about 10 km) from the phone, weather from Open-Meteo (free, no account).
// Only the weather result is kept; the location itself is never saved or sent anywhere else.
let weatherBusy = false, weatherTried = 0;
function realWeather(loud) {
  if (!S.weatherReal || weatherBusy || !navigator.geolocation) { if (loud && !navigator.geolocation) snack(t('w_fail')); return; }
  weatherBusy = true; weatherTried = Date.now();
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude.toFixed(1), lon = pos.coords.longitude.toFixed(1);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`)
      .then(r => r.json()).then(j => {
        S.weather = { kind: codeKind(j.current.weather_code), temp: Math.round(j.current.temperature_2m), real: true, at: now() };
        if (loud) snack(`${WEATHER_E[S.weather.kind]} ${t('w_' + S.weather.kind)} · ${S.weather.temp}°C`);
        refresh();
      }).catch(() => { if (loud) snack(t('w_fail')); }).finally(() => { weatherBusy = false; });
  }, () => { weatherBusy = false; S.weatherReal = false; if (loud) snack(t('w_denied')); refresh(); }, { maximumAge: 3 * HOUR, timeout: 15000 });
}
// A little label above the thing you tapped: picture, name and what it does.
let tipTimer = null;
function tip(kind, k, name, sub) {
  const el = $('#tip'), p = Scene.tapAt();
  el.innerHTML = `${kind ? thumbImg(kind, k, {}, 52, 44, 'thumb') : ''}<div><b>${esc(name)}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
  el.hidden = false;
  const w = el.offsetWidth, vw = el.parentElement.clientWidth;
  el.style.left = clamp(p.x - w / 2, 8, vw - w - 8) + 'px';
  el.style.top = Math.max(8, p.y - el.offsetHeight - 26) + 'px';
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => { el.hidden = true; }, 2200);
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
  tutDone('tab:' + tab);
  if (tab === 'feed') S.feed.forEach(i => { i.read = true; });
  if (tab === 'real') postNative({ type: 'refresh' });
  syncView();
}

// ---------- HUD and tab bar ----------
function renderHUD() {
  const e = energyLevel(), mail = unreadMail();
  const live = S.live ? `<button class="pill live" data-act="liveInfo">${WORKOUTS[S.live.type].e} ${Math.floor(liveMin())}′${S.live.hr ? ` ❤️${S.live.hr}` : ''}</button>` : '';
  $('#hud').innerHTML = `
    <div class="statusbar"><span id="clock">${fmtClock(now())}</span><span>▂▄▆ 🔋</span></div>
    <div class="row between">
      <button class="row me plain" data-act="energyInfo">${avatar(S.me.look, 'hud e-' + e, e)}<div><div class="me-name">${esc(S.me.name)}</div>
        <div class="energy">${ENERGY_EMOJI[e]} ${energyName(e)} · ${t('sleep_short', { n: S.sleep ? S.sleep.score : '–' })}</div></div></button>
      <div class="row tight">${mail ? `<button class="pill mail" data-act="mailGo">✉️ ${mail}</button>` : ''}
        <div class="cap ${actionsLeft() === 0 ? 'done' : ''}" title="${t('cap_title')}">🔨 ${S.today.actions}/${ACTION_CAP}</div></div>
    </div>
    <div class="res row">
      <span class="pill">🪙 ${fmtNum(S.me.coins)}</span><span class="pill">🪵 ${S.me.wood}</span>${live}${weatherPill()}
      ${S.pending.length ? `<button class="pill pending" data-act="collect">📦 ${t('to_collect')} ${S.pending.length}</button>` : ''}
    </div>`;
}
function renderTabbar() {
  const n = unreadCount() + unreadMail();
  $('#tabbar').innerHTML = [['home', '🏡'], ['town', '🏘️'], ['shop', '🛒'], ['real', '❤️'], ['feed', '🔔']].map(([id, ic]) =>
    `<button class="tab ${UI.tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">
      <span class="ic">${ic}</span>${t('tab_' + id)}${id === 'feed' && n ? `<span class="badge">${n}</span>` : ''}</button>`).join('');
}
function renderPanel() {
  const el = $('#panel'), onScene = UI.tab === 'home' || UI.tab === 'town';
  el.hidden = onScene;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  const top = el.scrollTop;
  if (UI.tab === 'shop') el.innerHTML = panelShop();
  else if (UI.tab === 'real') el.innerHTML = panelReal();
  else if (UI.tab === 'feed') el.innerHTML = panelFeed();
  el.scrollTop = top;
}

// Buttons and banners laid over the scene.
function renderOverlay() {
  const ctxEl = $('#ctxbar'), fab = $('#fab'), tray = $('#tray'), hv = $('#harvestAll'), lb = $('#liveBanner');
  const onScene = UI.tab === 'home' || UI.tab === 'town', ed = Scene.getEdit();
  if (!onScene) { ctxEl.hidden = fab.hidden = tray.hidden = hv.hidden = lb.hidden = true; return; }
  const b = (act, ic, label, arg = '') => `<button class="fab-btn" data-act="${act}" data-arg="${arg}"><span>${ic}</span>${label}</button>`;
  let c = '', f = '';
  if (ed) {
    c = `<div class="ctx-main">✏️ ${t(ed.scope === 'room' ? 'ctx_edit_room' : 'ctx_edit_yard')}</div><button class="btn small primary" data-act="editDone">${t('done')}</button>`;
  } else if (UI.tab === 'home') {
    if (UI.inside) {
      c = `<div class="ctx-main">🛋️ ${nm(HOUSES[S.me.house])}</div>${floorChips(S.me)}`;
      f = b('goOut', '🌳', t('fab_exit')) + b('design', '✏️', t('fab_design')) + b('barn', '🧺', t('fab_barn'));
    } else {
      c = S.calm ? `<button class="ctx-main link" data-act="ranking">${t('ctx_town_calm', { street: t('street_name'), lv: townLevel() })}</button>`
        : `<button class="ctx-main link" data-act="ranking">🏆 ${t('ctx_rank', { n: rankOf('me'), v: fmtNum(assetValue(S.me)) })}</button>`;
      f = b('goIn', '🚪', t('fab_enter')) + b('design', '✏️', t('fab_design')) + b('barn', '🧺', t('fab_barn')) + b('recenter', '🎯', t('fab_center'));
    }
  } else if (UI.visit) {
    const h = homeOf(UI.visit), fr = isFriend(h.id), street = STREETS[lotOf(h.id).st];
    const sub = fr ? (S.calm ? '' : ` · 🏆 ${rankOf(h.id)} · 🪙${fmtCompact(assetValue(h))}`) : ` · ${nm(street)}`;
    c = `<button class="btn small" data-act="backTown">← ${t('tab_town')}</button><div class="ctx-main">${t('home_of', { name: esc(homeName(h)) })}${sub}</div>${UI.visitInside ? floorChips(h) : ''}`;
    f = UI.visitInside ? b('goOut', '🌳', t('fab_exit'))
      : fr ? b('goIn', '🚪', t('fab_peek')) + b('like', '❤️', t('like'), h.id) + b('friendSheet', '🎁', t('fab_gift'), h.id) + b('compose', '✉️', t('fab_letter'), h.id) + b('goHome', '🏡', t('fab_home'))
        : b('goIn', '🚪', t('fab_peek')) + b('goHome', '🏡', t('fab_home'));
  } else {
    c = `<button class="ctx-main link" data-act="ranking">🏛️ ${t('ctx_town', { street: t('street_name'), lv: townLevel(), v: fmtCompact(townTotal()) })}</button>`;
    f = (S.calm ? '' : b('ranking', '🏆', t('fab_rank'))) + b('goHome', '🏡', t('fab_home'));
  }
  ctxEl.innerHTML = c; ctxEl.hidden = !c;
  fab.innerHTML = f; fab.hidden = !f;
  tray.hidden = !ed;
  if (ed) tray.innerHTML = trayHTML(ed);
  const n = ripeCount(), busy = Scene.busy();
  const showHv = UI.tab === 'home' && !UI.inside && !ed && !S.live && (n > 0 || busy > 0);
  hv.hidden = !showHv;
  hv.className = 'harvest-all' + (busy > 0 ? ' busy' : '');
  hv.innerHTML = busy > 0 ? `✋ ${t('stop_jobs', { n: busy })}` : `🧺 ${t('harvest_all')} · ${n}`;
  hv.dataset.act = busy > 0 ? 'stopJobs' : 'harvestAll';
  lb.hidden = !S.live || ed;
  if (S.live) {
    const w = WORKOUTS[S.live.type];
    lb.innerHTML = `<div><b>${w.e} ${t('live_now', { name: nm(w), n: Math.floor(liveMin()) })}</b>${S.live.hr ? ` · ❤️ ${S.live.hr}` : ''}</div><span>${t('live_mini')}</span>`;
  }
}
function overlaySig() {
  return [UI.tab, UI.inside, UI.visit, ripeCount(), Scene.busy(), S.live ? Math.floor(liveMin()) + ':' + S.live.hr : '', unreadMail(), S.pending.length, LEVEL].join('|');
}
// 1F 2F 3F … chips inside a house, plus ＋ to build another storey in your own.
function floorChips(h) {
  const n = floorsOf(h), mine = h === S.me, lv = Math.min(LEVEL, n - 1);
  if (n < 2 && !(mine && maxFloors(h) > 1)) return '';
  return `<div class="floors">${Array.from({ length: n }, (_, i) => `<button class="fl ${i === lv ? 'on' : ''}" data-act="floor" data-arg="${i}">${i + 1}F</button>`).join('')}
    ${mine && n < maxFloors(h) ? `<button class="fl add" data-act="buildFloor" title="${t('build_floor')}">＋</button>` : ''}</div>`;
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
    if (scope === 'room') return tabs + `<div class="color-row"><span>${t('wallpaper')}</span>${sw(ROOM_WALLS, curRoom(S.me).wall, 'setRoomWall')}</div>
      <div class="color-row"><span>${t('floor')}</span>${sw(FLOORS, curRoom(S.me).floor, 'setFloor')}</div>`;
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
const SHOP_CATS = [['seeds', '🌱'], ['trees', '🌳'], ['animals', '🐣'], ['land', '🗺️'], ['furn', '🛋️'], ['yard', '⛲'], ['cars', '🚗'], ['houses', '🏠'], ['sell', '💰']];
function shopCard(img, name, sub, btns, extra = '') {
  return `<div class="item-card">${img}<div class="item-name">${name}</div><div class="item-sub">${sub}</div>${extra}<div class="item-btns">${btns}</div></div>`;
}
const buyBtn = (act, arg, label, ok, cls = 'primary') => `<button class="btn small ${cls}" data-act="${act}" data-arg="${arg}" ${ok ? '' : 'disabled'}>${label}</button>`;
const RARE_KEY = { sleep: 'rare_sleep', rings: 'rare_rings', focus: 'rare_focus', steps: 'rare_steps' };
function landCard(kind, img, icon) {
  const h = S.me, table = { field: [FIELD_COST, 'fieldLv'], pasture: [PASTURE, 'pastureLv'], orchard: [ORCHARD, 'orchardLv'], pond: [POND, 'pondLv'] }[kind];
  const [levels, key] = table, lv = h[key], next = levels[lv + 1], cost = next && (next.cost || next);
  let sub;
  if (kind === 'field') sub = next ? t('land_field_sub', { a: FIELD_LEVELS[lv], b: FIELD_LEVELS[lv + 1] }) : t('land_field_max', { n: FIELD_LEVELS[lv] });
  else if (kind === 'pasture') sub = next ? t(lv ? 'land_pasture_sub' : 'land_pasture_new', { lv: lv + 1, cap: next.cap }) : t('land_pasture_max', { cap: PASTURE[lv].cap });
  else if (kind === 'orchard') sub = next ? t(lv ? 'land_orchard_sub' : 'land_orchard_new', { n: next.slots }) : t('land_orchard_max', { n: ORCHARD[lv].slots });
  else sub = next ? t(lv ? 'land_pond_sub' : 'land_pond_new', { n: next.cap, m: FISH_EVERY }) : t('land_pond_max', { n: POND[lv].cap });
  return shopCard(img, `${icon} ${t('land_' + kind)}${lv ? ` Lv${lv}` : ''}`, sub,
    next ? buyBtn('buyLand', kind, costText(cost), canAfford(cost)) : `<span class="tag ok">${t('maxed')}</span>`);
}
// Second-level categories: the chosen one (default: the first; selling defaults to everything).
const FISHES = ['fish', 'shrimp', 'koi'];
function sellKind(k) {
  if (k.startsWith('baby_')) return 'babies';
  if (CROPS[k]) return 'crops';
  if (FISHES.includes(k)) return 'fish';
  return Object.values(TREES).some(tr => tr.fruit === k) ? 'fruits' : 'goods';
}
function curSub(cat) {
  const subs = SHOP_SUBS[cat];
  if (!subs) return null;
  UI.sub = UI.sub || {};
  const id = UI.sub[cat] || (cat === 'sell' ? 'all' : subs[0].id);
  return id === 'all' ? null : subs.find(s => s.id === id) || null;
}
function subChips(cat, count) {
  const subs = SHOP_SUBS[cat];
  if (!subs) return '';
  const cur = curSub(cat), n = s => count(s);
  return `<div class="sub-cats"><button class="sub ${cur ? '' : 'on'}" data-act="shopSub" data-arg="all">${t('sub_all')}</button>${subs.map(s => {
    const c = n(s);
    return `<button class="sub ${cur && cur.id === s.id ? 'on' : ''}" data-act="shopSub" data-arg="${s.id}">${s.e} ${nm(s)}${c != null ? `<i>${c}</i>` : ''}</button>`;
  }).join('')}</div>`;
}
function panelShop() {
  const h = S.me, cat = UI.shop, sub = curSub(cat);
  const chips = SHOP_CATS.map(([id, ic]) => `<button class="cat ${cat === id ? 'on' : ''}" data-act="shopCat" data-arg="${id}"><span>${ic}</span>${t('cat_' + id)}</button>`).join('');
  const keep = k => !sub || sub.keys.includes(k);
  let body = '', note = '', subs = subChips(cat, s => s.keys.length || null);
  if (cat === 'seeds') {
    body = Object.entries(CROPS).filter(([k]) => keep(k)).map(([k, c]) => shopCard(thumbImg('crop', k), `${c.e} ${nm(c)}`,
      t('seed_sub', { d: fmtDur(c.grow * MIN), n: c.yield, p: c.sell }) + (h.seeds[k] ? ` · ${t('have_n', { n: h.seeds[k] })}` : ''),
      c.rare ? `<span class="tag">${t(RARE_KEY[c.rare])}</span>`
        : buyBtn('buySeed', k + '|1', `${t('buy_n', { n: 1 })} 🪙${c.seed}`, h.coins >= c.seed) + buyBtn('buySeed', k + '|5', `×5 🪙${c.seed * 5}`, h.coins >= c.seed * 5, ''))).join('');
    note = t('note_seeds');
  } else if (cat === 'trees') {
    const free = h.orchardLv ? h.trees.filter((tr, i) => i < orchardSlots(h) && !tr).length : 0;
    note = h.orchardLv ? t('orchard_free', { n: free, cap: orchardSlots(h) }) : `${t('no_orchard')} <button class="btn small" data-act="shopCat" data-arg="land">${t('go_land')}</button>`;
    body = Object.entries(TREES).map(([k, d]) => shopCard(thumbImg('tree', k, { fruit: true }), `${d.e} ${nm(d)}`,
      t('tree_sub', { d: fmtDur(d.grow * MIN), e: GOODS[d.fruit].e, n: d.n, every: fmtDur(d.every * MIN), p: GOODS[d.fruit].sell }),
      buyBtn('buyTree', k, `${t('buy_sapling')} 🪙${d.price}`, h.coins >= d.price && free > 0))).join('');
  } else if (cat === 'animals') {
    note = h.pastureLv ? t('pasture_cap', { n: pastureCount(), cap: pastureCap() }) : `${t('no_pasture')} <button class="btn small" data-act="shopCat" data-arg="land">${t('go_land')}</button>`;
    body = Object.entries(ANIMALS).filter(([k]) => keep(k)).map(([k, a]) => {
      let sub;
      if (a.pet) sub = t(a.guard ? 'dog_sub' : 'cat_sub');
      else if (!a.prod) sub = t('animal_sub_rabbit', { d: fmtDur(a.every * MIN) });
      else sub = t('animal_sub_prod', { d: fmtDur(a.every * MIN), e: GOODS[a.prod].e, n: a.n }) + ' · ' + t('animal_sub_baby', { k: a.babyEvery });
      sub = t('grows_up', { d: fmtDur(a.grow * MIN) }) + ' · ' + sub;
      const own = a.pet && h.animals.some(x => x.k === k);
      const ok = h.coins >= a.price && (a.pet ? !own : h.pastureLv && pastureCount() < pastureCap());
      return shopCard(thumbImg('animal', k, { stage: 2 }), `${a.e} ${nm(a)}`, sub,
        own ? `<span class="tag ok">${t('owned')}</span>` : buyBtn('buyAnimal', k, `${t('buy_baby')} 🪙${a.price}`, ok),
        `<div class="baby-row">${[0, 1, 2].map(s => thumbImg('animal', k, { stage: s }, 60, 48, 'thumb xs')).join('<span>→</span>')}</div>`);
    }).join('');
  } else if (cat === 'land') {
    body = landCard('field', thumbImg('field', 'f'), '🟫') + landCard('pasture', thumbImg('pasture', 'p'), '🐄')
      + landCard('orchard', thumbImg('orchard', 'o'), '🌳') + landCard('pond', thumbImg('pond', 'p'), '🐟');
    note = t('note_land');
  } else if (cat === 'furn' || cat === 'yard') {
    const scope = cat === 'furn' ? 'room' : 'yard', list = cat === 'furn' ? FURN : YARD;
    const owned = k => (scope === 'room' ? allRoomItems(h) : h.yard).filter(i => i.k === k).length + (h.store[scope + ':' + k] || 0);
    body = Object.entries(list).filter(([k, d]) => !d.souv && keep(k)).map(([k, d]) => {
      const n = owned(k);
      const use = d.use ? ` · ${t('use_' + d.use)}` : d.prod ? ` · ${t('makes', { e: GOODS[d.prod].e, d: fmtDur(d.every * MIN) })}` : '';
      return shopCard(thumbImg(cat, k), nm(d), t('furn_sub', { w: d.w, d: d.d }) + use + (n ? ` · ${t('owned_n', { n })}` : ''),
        buyBtn('buyItem', scope + '|' + k, `🪙${fmtNum(d.price)}`, h.coins >= d.price));
    }).join('');
    note = t(cat === 'furn' ? 'note_furn' : 'note_yard');
    if (cat === 'furn') subs = subChips('furn', s => (s.id === 'souv' ? `${S.souv.length}/${SOUVENIRS.length}` : s.keys.length));
    if (sub && sub.id === 'souv') { note = ''; body = ''; subs += souvCard(); }
  } else if (cat === 'cars') {
    body = Object.entries(CARS).filter(([k]) => keep(k)).map(([k, c]) => {
      const i = h.cars.findIndex(x => x.k === k), color = i >= 0 ? h.cars[i].color : CAR_COLORS[0];
      let btn;
      if (i < 0) btn = buyBtn('buyCar', k, costText(c.cost), canAfford(c.cost));
      else if (i === h.car) btn = `<span class="tag ok">${t('car_driving')}</span>`;
      else btn = buyBtn('driveCar', i, t('car_drive'), true, '');
      return shopCard(thumbImg('car', k, { color }), nm(c), i >= 0 ? t('owned') : t(c.kind === 'two' ? 'car_sub_two' : 'car_sub'), btn);
    }).join('');
    note = t('note_cars');
  } else if (cat === 'houses') {
    body = HOUSES.map((H, i) => {
      if (!keep(H.id)) return '';
      let btn;
      if (i === h.house) btn = `<span class="tag ok">${t('house_current')}</span>`;
      else if (h.houses.includes(i)) btn = buyBtn('moveHouse', i, t('house_move'), true, '');
      else btn = buyBtn('buyHouse', i, costText(H.cost), canAfford(H.cost));
      const ex = (h.extra || {})[i] || 0;
      return shopCard(thumbImg('house', i, { wall: h.wall, roof: h.roof, extra: ex }), nm(H),
        `${t('house_room', { w: H.room[0], d: H.room[1] })} · ${t('house_floors', { n: H.floors[0] + ex, max: H.floors[1] })}`, btn);
    }).join('');
    note = floorCard() + t('note_houses');
  } else {
    const all = Object.keys(h.barn), keys = all.filter(k => !sub || sellKind(k) === sub.id);
    subs = subChips('sell', s => all.filter(k => sellKind(k) === s.id).length || null);
    note = all.length ? `<button class="btn small primary" data-act="sellAll">${t('sell_all', { n: fmtNum(barnValue()) })}</button>` : '';
    body = keys.length ? keys.map(k => {
      const b = barnInfo(k), n = h.barn[k];
      const img = CROPS[k] ? thumbImg('crop', k) : GOODS[k] ? thumbImg('good', k) : thumbImg('animal', b.baby, { stage: 0 });
      return shopCard(img, `${b.e} ${b.name} ×${n}`, t('sell_each', { n: b.sell }),
        buyBtn('sell', k + '|1', t('sell_one'), true, '') + buyBtn('sell', k + '|' + n, t('sell_n', { n: fmtNum(n * b.sell) }), true)
        + (b.baby && pastureCount() < pastureCap() ? buyBtn('release', b.baby, t('baby_release'), true, '') : ''));
    }).join('') : `<p class="muted center gap-top">${t('sell_empty')}</p>`;
  }
  return `<div class="shop-head"><h1 class="panel-title">${t('shop_title')}</h1>
      <div class="row tight"><span class="pill">🪙 ${fmtNum(h.coins)}</span><span class="pill">🪵 ${h.wood}</span></div></div>
    <p class="muted note">${t('shop_money_note')}</p>
    <div class="shop-cats">${chips}</div>
    ${subs}
    ${note ? `<div class="shop-note">${note}</div>` : ''}
    ${body ? `<div class="item-grid">${body}</div>` : ''}`;
}

// Build another storey on the house you live in.
function floorCard() {
  const h = S.me, n = floorsOf(h), mx = maxFloors(h), H = HOUSES[h.house];
  if (mx < 2) return `<div class="floor-card muted">🏗️ ${t('floor_none', { name: nm(H) })}</div>`;
  if (n >= mx) return `<div class="floor-card">🏗️ ${t('floor_max', { name: nm(H), n: mx })}</div>`;
  const c = floorCost(h);
  return `<div class="floor-card row">${thumbImg('house', h.house, { wall: h.wall, roof: h.roof, extra: n - H.floors[0] + 1 }, 84, 84, 'thumb sm')}
    <div class="grow"><b>🏗️ ${t('build_floor_title', { n: n + 1 })}</b><div class="muted">${t('build_floor_desc')}</div></div>
    ${buyBtn('buildFloorNow', '', costText(c), canAfford(c))}</div>`;
}
// Souvenirs: earned in real life, never sold.
function souvCard() {
  return `<div class="souv-card"><b>✨ ${t('souv_title')}</b><div class="muted">${t('souv_desc')}</div><div class="souv-grid">${SOUVENIRS.map(sv => {
    const got = S.souv.includes(sv.k);
    return `<div class="souv ${got ? 'got' : ''}">${thumbImg('furn', sv.k, {}, 64, 56, 'thumb xs')}<b>${nm(FURN[sv.k])}</b>
      <span>${got ? '✅' : `${souvProgress(sv)}/${sv.n}`}</span><i>${t('souv_need_' + sv.need, { n: sv.n })}</i></div>`;
  }).join('')}</div></div>`;
}

// ---------- real life (Apple Health and screen time) ----------
function ringsSVG(vals) {
  const R = [44, 33, 22], cols = ['move', 'exercise', 'stand'];
  return `<svg class="rings" viewBox="0 0 110 110">${cols.map((k, i) => {
    const r = R[i], c = 2 * Math.PI * r, p = Math.min(1, vals[i]);
    return `<circle cx="55" cy="55" r="${r}" fill="none" stroke="${RING_COL[k]}" stroke-opacity=".22" stroke-width="9"/>
      <circle cx="55" cy="55" r="${r}" fill="none" stroke="${RING_COL[k]}" stroke-width="9" stroke-linecap="round"
        stroke-dasharray="${c * p} ${c}" transform="rotate(-90 55 55)"/>`;
  }).join('')}</svg>`;
}
function sleepBar(s) {
  const tot = Math.max(1, s.deep + s.rem + s.core + s.awake);
  if (!s.deep && !s.rem && !s.core) return '';
  return `<div class="sleep-bar">${[['awake', '#f2a33a'], ['rem', '#5ac8fa'], ['core', '#4f8ef7'], ['deep', '#3b3fb6']].map(([k, col]) =>
    `<i style="width:${s[k] / tot * 100}%;background:${col}"></i>`).join('')}</div>
    <div class="sleep-legend">${[['deep', '#3b3fb6'], ['core', '#4f8ef7'], ['rem', '#5ac8fa'], ['awake', '#f2a33a']].map(([k, col]) =>
    `<span><i style="background:${col}"></i>${t('sleep_' + k)} ${fmtDur(s[k] * MIN)}</span>`).join('')}</div>`;
}
function panelReal() {
  const d = S.today, e = energyLevel(), score = energyScore(), m = energyMult(), s = S.sleep || { score: 0, asleep: 0, deep: 0, rem: 0, core: 0, awake: 0 };
  const goal = stepGoal(), steps = d.steps + d.pushes, stepPct = Math.min(100, steps / goal * 100), disPct = Math.min(100, d.distractMin / S.limitMin * 100);
  const apps = S.apps.map(id => { const a = APPS.find(x => x.id === id); return `<span class="chip static">${a.emoji} ${a.name || t('app_games')}</span>`; }).join('');
  const src = S.native ? t('src_health') : t('src_sim');
  let goalRow;
  if (d.restDay) goalRow = `<div class="ok-line">🌙 ${t('rest_on')}</div>`;
  else if (d.paid.goal) goalRow = `<div class="ok-line">✅ ${t('goal_done')}</div>`;
  else goalRow = `<button class="btn small" data-act="restDay">🌙 ${t('rest_btn')}</button>`;
  const live = S.live ? `<div class="card live-card"><h3>${WORKOUTS[S.live.type].e} ${t('live_now', { name: nm(WORKOUTS[S.live.type]), n: Math.floor(liveMin()) })}</h3>
      ${S.live.hr ? `<div class="big-num">❤️ ${S.live.hr} <small>${t('bpm')}</small></div>` : ''}<p class="muted">${t('live_desc')}</p>
      <button class="btn small" data-act="watchLive">👀 ${t('live_watch')}</button></div>` : '';
  const wks = d.workouts.length ? d.workouts.map(w => `<div class="list-item"><span class="big-emoji">${WORKOUTS[w.type].e}</span>
      <div class="grow"><b>${nm(WORKOUTS[w.type])}</b><div class="cost">${t('wk_line', { n: w.min, k: w.kcal })}</div></div>
      <span class="muted">${w.min >= 10 ? '✅' : t('wk_short')}</span></div>`).join('') : `<p class="muted">${t('wk_none')}</p>`;
  return `
    <h1 class="panel-title">${t('tab_real')}</h1>
    <p class="muted note">${t('real_private')} ${t('real_note')} <b>${src}</b></p>
    <div class="card energy-card e-${e}">
      <div class="row"><div class="face">${ENERGY_EMOJI[e]}</div><div class="grow"><h3>${t('energy_title')} · ${energyName(e)}</h3>
        <div class="muted">${t('energy_score', { n: score })} · ${t('today_mult')} <b>${multText(m)}</b></div></div></div>
      <p>${t('energy_desc_' + e)}</p>
      <div class="sleep-head"><b>😴 ${t('sleep_title')}</b><span><b class="big">${s.score || '–'}</b> / 100</span></div>
      <div class="muted">${t('sleep_line', { d: fmtDur(s.asleep * MIN) })}${s.source && s.source !== 'sim' ? ` · ${esc(s.source)}` : ''}</div>
      ${sleepBar(s)}
      <p class="muted">${t('energy_note')}</p>
    </div>
    ${live}
    <div class="card"><h3>⭕ ${t('rings_title')}</h3>
      <div class="row">${ringsSVG([d.kcal / RINGS.move, d.exMin / RINGS.exercise, d.standH / RINGS.stand])}
        <div class="grow ring-nums">
          <div><i style="background:${RING_COL.move}"></i>${t('ring_move')} <b>${fmtNum(d.kcal)}</b>/${RINGS.move} ${t('kcal')}</div>
          <div><i style="background:${RING_COL.exercise}"></i>${t('ring_exercise')} <b>${Math.round(d.exMin)}</b>/${RINGS.exercise} ${t('minutes')}</div>
          <div><i style="background:${RING_COL.stand}"></i>${t('ring_stand')} <b>${Math.round(d.standH)}</b>/${RINGS.stand} ${t('hours')}</div>
        </div></div>
      <p class="muted">${t('rings_rule')}</p></div>
    <div class="card"><h3>🚶 ${t('steps_today')}</h3>
      <div class="big-num">${fmtNum(steps)} <small>/ ${fmtNum(goal)} · ${t('my_goal')}</small></div>
      <div class="bar"><i style="width:${stepPct}%"></i></div>
      <p class="muted">${t('steps_rule2', { n: fmtNum(stepBlock()) })} ${t('goal_auto')}</p>
      <div class="row between gap-top">${goalRow}</div>
      <p class="muted">${t('inclusive_note')}</p></div>
    <div class="card"><h3>💪 ${t('workouts_title')}</h3>${wks}<p class="muted">${t('workouts_rule')} ${t('wk_cap', { n: WORKOUT_PAY_MAX })}</p></div>
    <div class="card"><h3>🧘 ${t('mind_title')}</h3>
      <div class="vitals">
        <div><span>${t('mindful')}</span><b>${Math.round(d.mindful)} ${t('minutes')}</b></div>
        <div><span>${t('resp')}</span><b>${S.vitals.resp} ${t('per_min')}</b></div>
        <div><span>${t('rhr')}</span><b>${S.vitals.rhr} ${t('bpm')}</b></div>
        <div><span>HRV</span><b>${S.vitals.hrv} ms</b></div>
      </div><p class="muted">${t('mind_rule')}</p></div>
    <div class="card"><h3>📵 ${t('focus_today')}</h3>
      <div class="big-num">${d.focusMin} <small>${t('minutes')}</small></div>
      <p class="muted">${t('focus_rule')}</p>
      <div class="row between small-gap"><span class="muted">${t('distract_usage', { n: d.distractMin, limit: S.limitMin })}</span></div>
      <div class="bar warm"><i style="width:${disPct}%"></i></div>
      <div class="gap-top">${apps}</div>
      <p class="muted">${t('focus_note')}</p></div>
    <div class="card earn"><h3>💰 ${t('earned_today')}</h3>
      <div class="big-num">🪙${fmtNum(d.earned.coins)} <small>🪵${d.earned.wood}</small></div>
      <p class="muted">${t('money_rule')}</p></div>
    ${souvCard()}
    <div class="card"><h3>⌚ ${t('devices_title')}</h3><p class="muted">${t('devices_text')}</p></div>
    ${privacyCard()}
    <div class="card"><h3>⚙️ ${t('settings')}</h3>
      <div class="row between"><span>${t('language')}</span><span>
        <button class="chip ${S.lang === 'zh' ? 'on' : ''}" data-act="lang" data-arg="zh">中文</button>
        <button class="chip ${S.lang === 'en' ? 'on' : ''}" data-act="lang" data-arg="en">English</button></span></div></div>`;
}

// Privacy and pressure: what friends can see of you, and calm mode (no ranking, no friends' fitness).
function privacyCard() {
  const sw = (act, arg, on, label, sub = '') => `<label class="row between toggle-row"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>
    <input type="checkbox" class="switch" data-act="${act}" data-arg="${arg}" ${on ? 'checked' : ''}></label>`;
  return `<div class="card privacy-card"><h3>🔒 ${t('privacy_title')}</h3>
    ${sw('calm', '', S.calm, `😌 ${t('calm_title')}`, t('calm_desc'))}
    <div class="sub-title">${t('privacy_see')}</div>
    ${sw('priv', 'shareGoal', S.me.shareGoal, t('share_goal2'))}
    ${sw('priv', 'shareLive', S.me.shareLive, t('share_live'))}
    ${sw('priv', 'shareMood', S.me.shareMood, t('share_mood'))}
    <p class="muted">${t('privacy_note2')}</p></div>`;
}
function panelFeed() {
  const n = unreadMail();
  const mail = `<div class="card mail-card"><div class="row between"><h3>📮 ${t('mailbox')}</h3>
      <div class="row tight"><button class="btn small" data-act="mailOpen">${n ? t('mail_unread', { n }) : t('mail_open')}</button>
      <button class="btn small primary" data-act="compose">✉️ ${t('write_letter')}</button></div></div></div>`;
  const feed = S.feed.filter(feedVisible);
  const calm = `<button class="chip ${S.calm ? 'on' : ''}" data-act="calm">😌 ${t('calm_title')}${S.calm ? ' ✓' : ''}</button>`;
  if (!feed.length) return `<h1 class="panel-title">${t('tab_feed')}</h1>${mail}<p class="muted center gap-top">${t('feed_empty')}</p>`;
  const items = [...feed].reverse().map(it => {
    const f = homeOf(it.from);
    const btn = it.gift ? (it.claimed ? `<span class="muted">${t('claimed')}</span>` : `<button class="btn small primary" data-act="claim" data-arg="${it.id}">${t('claim')}</button>`)
      : it.kind === 'stole' || it.kind === 'caught' ? `<button class="btn small" data-act="visit" data-arg="${it.from}">${t('visit_back')}</button>`
      : it.kind === 'letter' ? `<button class="btn small" data-act="mailOpen">${t('read')}</button>` : '';
    return `<div class="list-item">${f ? avatar(f.look, '', f.id === 'me' ? energyLevel() : friendEnergy(f)) : ''}<div class="grow"><div>${feedText(it)}</div><div class="muted">${ago(it.t)}</div></div>${btn}</div>`;
  }).join('');
  return `<h1 class="panel-title">${t('tab_feed')}</h1>${mail}<div class="row between note"><p class="muted">${t('feed_note')}</p>${calm}</div><div class="card">${items}</div>`;
}

// ---------- sheets ----------
function openSheet(type, arg) {
  UI.sheet = { type, arg };
  renderSheet();
  const compact = ['friend', 'field', 'animal', 'car', 'tree'].includes(type);
  $('#sheet').className = 'sheet' + (compact ? ' compact' : '');
  $('#sheet').hidden = false;
  $('#backdrop').hidden = false;
  $('#backdrop').classList.toggle('light', compact);
}
function closeSheet() {
  UI.sheet = null; $('#sheet').hidden = true; $('#backdrop').hidden = true; UI.welcome = false;
  if (UI.souvQ && UI.souvQ.length) setTimeout(() => { if (!UI.sheet && UI.souvQ.length) { openSheet('souvenir', UI.souvQ.shift()); refresh(); } }, 350);
}
function stagesRow(kind, k, n, cur, names, w = 72) {
  return `<div class="stages">${names.map((nmS, s) => `<div class="${s === cur ? 'on' : ''}">${thumbImg(kind, k, { stage: s }, w, 60, 'thumb xs')}<span>${nmS}</span></div>`).join('')}</div>`;
}
const SHEETS = {
  collect() {
    const title = UI.welcome ? t('welcome_back') : t('collect_title');
    if (!S.pending.length) return `<h2>${title}</h2><p class="muted">${t('collect_empty')}</p>`;
    const rows = S.pending.map(p => `<div class="list-item"><span class="big-emoji">${SRC_EMOJI[p.src] || '🎁'}</span>
      <div class="grow"><b>${pendingTitle(p)}</b><div class="reward">${rewardText(p.reward)}</div>
      ${p.info && p.info.mult && p.info.mult !== 1 ? `<div class="mult ${p.info.mult > 1 ? 'up' : 'down'}">${multText(p.info.mult)}</div>` : ''}</div></div>`).join('');
    return `<h2>${title}</h2><p class="muted">${t('collect_desc')}</p><div class="card">${rows}</div>
      <button class="btn primary block" data-act="collectAll">${t('collect_all')}</button>`;
  },
  energy() {
    const e = energyLevel(), s = S.sleep || {};
    return `<div class="center"><div class="big-emoji xl">${ENERGY_EMOJI[e]}</div><h2>${energyName(e)} · ${energyScore()}</h2></div>
      <p>${t('energy_desc_' + e)}</p>
      <div class="card gap-top"><div class="row between"><span>${t('sleep_title')}</span><b>${s.score || '–'}</b></div>
        <div class="row between"><span>${t('today_mult')}</span><b>${multText(energyMult())}</b></div>
        <p class="muted">${t('energy_note')}</p></div>
      <button class="btn block" data-act="tab" data-arg="real">❤️ ${t('see_health')}</button>`;
  },
  field(arg) {
    const { owner, i } = arg, h = homeOf(owner), f = h.fields[i], mine = owner === 'me';
    if (!f) {
      if (!mine) return `<h2>🟫 ${t('empty_field')}</h2><p class="muted">${t('friend_empty_field', { name: esc(homeName(h)) })}</p>`;
      const owned = Object.entries(CROPS).filter(([k]) => h.seeds[k] > 0), left = actionsLeft();
      const list = owned.length ? owned.map(([k, c]) => `<div class="list-item">${thumbImg('crop', k, {}, 64, 52, 'thumb sm')}
          <div class="grow"><b>${c.e} ${nm(c)}</b> <span class="muted">×${h.seeds[k]}</span>
          <div class="cost">${t('seed_sub', { d: fmtDur(c.grow * MIN), n: c.yield, p: c.sell })}</div></div>
          <div class="col-btns">${buyBtn('plant', k, t('plant'), left > 0)}${buyBtn('plantAll', k, t('plant_all'), left > 0, '')}</div></div>`).join('')
        : `<p class="muted">${t('no_seeds')}</p><button class="btn block gap-top" data-act="openShop" data-arg="seeds">🛒 ${t('buy_seeds')}</button>`;
      return `<h2>🌱 ${t('plant_title')}</h2><p class="muted">${t('build_left', { n: left, cap: ACTION_CAP })} · ${t('plant_walk')}</p><div class="card">${list}</div>`;
    }
    const c = CROPS[f.crop], st = cropStage(f), left = c.grow * MIN - (now() - f.at);
    const thieves = f.thieves.filter(x => x !== owner).map(fname).filter(Boolean);
    let extra = '';
    if (mine && thieves.length && f.left < c.yield) extra = `<p class="muted">${t('stolen_by', { names: esc(thieves.join('、')) })}</p>`;
    if (!mine && isRipe(f)) extra = `<p class="muted">${f.thieves.includes('me') ? t('steal_done') : t('steal_keep')}</p>`;
    return `<div class="row">${thumbImg('crop', f.crop, { stage: st }, 96, 80, 'thumb')}<div class="grow">
        <h2>${c.e} ${nm(c)}</h2><div class="muted">${nm(CROP_STAGES[st])} · ${t('yield_left', { n: f.left })}</div></div></div>
      <div class="card gap-top">${st < 4 ? `<p>${t('growing_left', { d: `<b>${fmtDur(left)}</b>` })}</p>
        <div class="bar"><i style="width:${cropProg(f) * 100}%"></i></div>` : `<p>✅ ${t('ripe_now')}</p>`}
        ${stagesRow('crop', f.crop, 5, st, CROP_STAGES.map(nm))}
        ${extra}<p class="muted">${t('never_wilts')}</p></div>`;
  },
  animal(arg) {
    const { owner, id } = arg, h = homeOf(owner), a = h.animals.find(x => x.id === id);
    if (!a) return `<p class="muted">${t('animal_gone')}</p>`;
    const d = ANIMALS[a.k], st = animalStage(a), mine = owner === 'me';
    let info;
    if (st < 2) info = `<p>${t('grow_left', { d: `<b>${fmtDur(d.grow * MIN - (now() - a.born))}</b>` })}</p><div class="bar"><i style="width:${animalProg(a) * 100}%"></i></div>`;
    else if (d.pet) info = `<p>${d.guard ? '🛡️ ' + t('dog_sub') : '🐾 ' + t('cat_sub')}</p>`;
    else {
      const what = nextIsBaby(a) ? `🍼 ${t('a_baby', { name: nm(d.baby) })}` : `${GOODS[d.prod].e}×${d.n}`;
      info = animalReady(a) ? `<p>✅ ${t('prod_ready', { what })}</p>`
        : `<p>${t('prod_left', { d: `<b>${fmtDur(d.every * MIN - (now() - (a.last || a.born + d.grow * MIN)))}</b>`, what })}</p><div class="bar warm"><i style="width:${prodProg(a) * 100}%"></i></div>`;
    }
    const btns = mine ? `<div class="row gap-top">${animalReady(a) ? buyBtn('collectAnimal', a.id, t('collect'), true) : ''}
        ${buyBtn('sellAnimal', a.id, t('sell_for', { n: d.sell[st] }), true, '')}</div>` : '';
    return `<div class="row">${thumbImg('animal', a.k, { stage: st }, 96, 80)}<div class="grow"><h2>${d.e} ${animalName(a)}</h2>
      <div class="muted">${stageName(a)}${mine ? '' : ' · ' + t('home_of', { name: esc(homeName(h)) })}</div></div></div>
      <div class="card gap-top">${info}${stagesRow('animal', a.k, 3, st, ['stage_baby', 'stage_young', 'stage_adult'].map(k => t(k)))}</div>${btns}`;
  },
  tree(arg) {
    const { owner, i } = arg, h = homeOf(owner), tr = h.trees[i];
    if (!tr) return '';
    const d = TREES[tr.k], st = treeStage(tr), fp = fruitProg(tr);
    let info;
    if (st < 2) info = `<p>${t('tree_grow_left', { d: `<b>${fmtDur(d.grow * MIN - (now() - tr.planted))}</b>` })}</p><div class="bar"><i style="width:${treeProg(tr) * 100}%"></i></div>`;
    else if (fp >= 1) info = `<p>✅ ${t('fruit_ready', { e: GOODS[d.fruit].e, n: d.n - (tr.stolen || 0) })}</p>`;
    else info = `<p>${t(fp < 0.45 ? 'tree_bloom' : 'tree_fruiting', { d: `<b>${fmtDur(d.every * MIN * (1 - fp))}</b>` })}</p><div class="bar warm"><i style="width:${fp * 100}%"></i></div>`;
    return `<div class="row">${thumbImg('tree', tr.k, { stage: st, fruit: fp >= 1 }, 96, 80)}<div class="grow"><h2>${d.e} ${nm(d)}</h2>
      <div class="muted">${nm(TREE_STAGES[st])}</div></div></div><div class="card gap-top">${info}
      ${stagesRow('tree', tr.k, 3, st, TREE_STAGES.map(nm))}<p class="muted">${t('tree_note')}</p></div>`;
  },
  barn() {
    const h = S.me, keys = Object.keys(h.barn);
    const goods = keys.length ? keys.map(k => { const b = barnInfo(k); return `<div class="list-item"><span class="big-emoji">${b.e}</span>
      <div class="grow"><b>${b.name}</b> <span class="muted">×${h.barn[k]}</span><div class="cost">${t('sell_each', { n: b.sell })}</div></div>
      ${buyBtn('sell', k + '|' + h.barn[k], t('sell_n', { n: fmtNum(h.barn[k] * b.sell) }), true, '')}</div>`; }).join('')
      : `<p class="muted">${t('barn_empty')}</p>`;
    const seeds = Object.entries(h.seeds).filter(([, n]) => n > 0), store = Object.entries(h.store);
    return `<h2>🧺 ${t('barn_title')}</h2><p class="muted">${t('barn_desc')}</p>
      <div class="card"><div class="row between"><h3>🌾 ${t('barn_goods')}</h3>${keys.length ? `<button class="btn small primary" data-act="sellAll">${t('sell_all', { n: fmtNum(barnValue()) })}</button>` : ''}</div>${goods}</div>
      <div class="card"><h3>🌱 ${t('barn_seeds')}</h3>${seeds.length ? seeds.map(([k, n]) => `<span class="chip static">${CROPS[k].e} ${nm(CROPS[k])} ×${n}</span>`).join('') : `<p class="muted">${t('no_seeds_short')}</p>`}</div>
      <div class="card"><h3>📦 ${t('barn_store')}</h3>${store.length ? store.map(([key, n]) => { const [sc, k] = key.split(':'); return `<span class="chip static">${nm(itemDef(sc, k))} ×${n}</span>`; }).join('') : `<p class="muted">${t('store_empty')}</p>`}</div>`;
  },
  car(owner) {
    const h = homeOf(owner), c = h.cars[h.car], mine = owner === 'me';
    if (!c) return '';
    const swatches = CAR_COLORS.map(col => `<button class="swatch ${col === c.color ? 'on' : ''}" style="background:${col}" data-act="carColor" data-arg="${col}"></button>`).join('');
    const others = h.cars.map((x, i) => (i === h.car ? '' : `<button class="chip" data-act="driveCar" data-arg="${i}">${nm(CARS[x.k])}</button>`)).join('');
    return `<div class="row">${thumbImg('car', c.k, { color: c.color }, 110, 90)}<div class="grow"><h2>${nm(CARS[c.k])}</h2>
      <div class="muted">${t('worth', { v: fmtNum(costValue(CARS[c.k].cost)) })}</div></div></div>
      ${mine ? `<div class="card gap-top"><h3>🎨 ${t('car_color')}</h3><div class="swatches left">${swatches}</div></div>
      ${others ? `<div class="card"><h3>🚗 ${t('car_switch')}</h3>${others}</div>` : ''}
      <button class="btn block" data-act="openShop" data-arg="cars">🛒 ${t('car_shop')}</button>` : ''}`;
  },
  friend(id) {
    const f = friendById(id), liked = S.today.liked[id];
    const status = S.calm ? `😌 ${t('f_calm')}` : seesGoal(f) ? (f.goalToday ? `✅ ${t('f_goal_done')}` : `⏳ ${t('f_goal_not_yet')}`) : `🔒 ${t('f_private')}`;
    const live = seesLive(f) ? `<p>${WORKOUTS[f.live.type].e} ${t('f_live', { name: nm(WORKOUTS[f.live.type]) })}</p>` : '';
    const gifts = giftOptions(), here = UI.visit === id;
    const tags = [`🏠 ${nm(HOUSES[f.house])}`, `❤️ ${f.likes}`, ...(S.calm ? [] : [`🏆 ${t('rank_n', { n: rankOf(f.id) })}`])];
    const act = (a, arg, ic, label, sub, on = true) => `<button class="act-tile" data-act="${a}" data-arg="${arg}" ${on ? '' : 'disabled'}><span>${ic}</span><b>${label}</b>${sub ? `<i>${sub}</i>` : ''}</button>`;
    return `<div class="profile">${avatar(f.look, 'xxl', friendEnergy(f))}<div class="grow">
        <div class="profile-name">${esc(homeName(f))}</div>
        <div class="profile-tags">${tags.map(x => `<span>${x}</span>`).join('')}</div></div></div>
      <div class="status-line"><div>${status}</div>${live}</div>
      <div class="act-grid">
        ${act('like', id, '❤️', liked ? t('liked') : t('like'), t('like_home'), !liked)}
        ${act('compose', id, '✉️', t('write_letter'), t('letter_short'))}
        ${here ? act('goIn', '', '🚪', t('fab_peek'), t('peek_short')) : act('visit', id, '🏡', t('visit'), t('visit_short'))}
        ${act('giftScroll', '', '🎁', t('send_gift'), t('social_free_short'))}
      </div>
      <div class="sheet-sec"><div class="sec-title">💬 ${t('leave_msg')}</div>${MSG_KEYS.map(k => `<button class="chip" data-act="msg" data-arg="${id}|${k}">${t(k)}</button>`).join('')}</div>
      <div class="sheet-sec" id="giftSec"><div class="sec-title">🎁 ${t('send_gift')}</div>
        ${gifts.length ? gifts.map((g, i) => `<button class="chip" data-act="gift" data-arg="${id}|${i}">${giftText(g)}</button>`).join('') : `<p class="muted">${t('no_gifts')}</p>`}</div>
      <p class="muted center small">🔒 ${t('goal_privacy_hint')}</p>`;
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
    const b = assetBreakdown(S.me), empty = !!freeRun() && FRIEND_POOL.some(f => !S.friends.some(x => x.id === f.id));
    const parts = ['cash', 'house', 'land', 'items', 'cars', 'animals', 'goods'].map(k => `<div class="asset-row"><span>${t('a_' + k)}</span><b>🪙${fmtNum(b[k])}</b></div>`).join('');
    const list = S.calm ? `<div class="card"><p>😌 ${t('rank_calm')}</p><button class="btn small" data-act="calm">${t('rank_show')}</button></div>` : `<div class="card">${rows}</div>`;
    return `<h2>${S.calm ? '🏛️' : '🏆'} ${t(S.calm ? 'town_title' : 'rank_title', { street: t('street_name') })}</h2>
      <div class="card town-card"><div class="row between"><b>🏛️ ${t('town_total')}</b><b>🪙${fmtNum(total)}</b></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="muted">Lv${lv} · ${next ? t('town_next', { n: fmtNum(next - total), lv: lv + 1 }) : t('town_max')}</div>
        <p class="muted">${t('town_note')}</p></div>
      ${list}
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
  souvenir(k) {
    const sv = SOUVENIRS.find(x => x.k === k);
    return `<div class="center souv-sheet"><div class="souv-new">✨ ${t('souv_new')}</div>${thumbImg('furn', k, {}, 150, 130, 'thumb')}
      <h2>${nm(FURN[k])}</h2><p class="muted">${t('souv_need_' + sv.need, { n: sv.n })}</p><p>${t('souv_placed')}</p>
      <div class="row gap-top"><button class="btn grow" data-act="close">${t('souv_ok')}</button><button class="btn primary grow" data-act="souvGo">🛋️ ${t('souv_go')}</button></div></div>`;
  },
  floor() {
    const h = S.me, n = floorsOf(h), H = HOUSES[h.house];
    if (n >= maxFloors(h)) return `<h2>🏗️ ${t('build_floor')}</h2><p>${t('floor_max', { name: nm(H), n })}</p>`;
    const c = floorCost(h);
    return `<div class="center">${thumbImg('house', h.house, { wall: h.wall, roof: h.roof, extra: n - H.floors[0] + 1 }, 170, 150, 'thumb')}
      <h2>🏗️ ${t('build_floor_title', { n: n + 1 })}</h2><p class="muted">${t('build_floor_desc')}</p>
      <p class="muted">${t('house_floors', { n, max: maxFloors(h) })}</p></div>
      <button class="btn primary block gap-top" data-act="buildFloorNow" ${canAfford(c) ? '' : 'disabled'}>${t('build_btn')} · ${costText(c)}</button>
      ${canAfford(c) ? '' : `<p class="muted center gap-top">${t('snack_poor')}</p>`}`;
  },
  // Empty land: next to your home → buy one more parcel; elsewhere → move your home there.
  land(a) {
    const st = STREETS[a.st], nb = NEIGHBORHOODS[st.nb], l = lotOf('me');
    const next = l.st === a.st && a.p === l.p + l.n;
    const shot = `<div class="land-pic"><span>🏷️</span><b>${nm(st)}</b><i>${nm(nb)}</i></div>`;
    if (next) {
      const c = parcelCost();
      return `${shot}<h2>${t('land_buy_title')}</h2><p class="muted">${t('land_buy_desc', { w: PARCEL, d: LOT_D, now: homeW(S.me) })}</p>
        <div class="card"><div class="asset-row"><span>${t('land_owned')}</span><b>${t('tiles_n', { w: homeW(S.me), d: LOT_D })}</b></div>
          <div class="asset-row"><span>${t('land_after')}</span><b>${t('tiles_n', { w: homeW(S.me) + PARCEL, d: LOT_D })}</b></div>
          <div class="asset-row"><span>${t('land_price')}</span><b>🪙${fmtNum(c.coins)}</b></div></div>
        <button class="btn primary block" data-act="buyParcel" ${canAfford(c) ? '' : 'disabled'}>${t('land_buy_btn')} · 🪙${fmtNum(c.coins)}</button>
        <p class="muted center gap-top">${t('land_grow_note')}</p>`;
    }
    const p0 = a.run != null ? a.run : a.p, fits = a.n >= CORE_PARCELS, c = moveCost(a.st), refund = Math.round((l.paid || 0) * LAND.refund);
    return `${shot}<h2>${t('land_move_title', { street: nm(st) })}</h2><p class="muted">${t('land_move_desc', { w: a.n * PARCEL, d: LOT_D, nb: nm(nb) })}</p>
      ${fits ? `<div class="card"><div class="asset-row"><span>${t('land_price')}</span><b>🪙${fmtNum(c.coins)}</b></div>
        ${refund ? `<div class="asset-row"><span>${t('land_refund')}</span><b>+🪙${fmtNum(refund)}</b></div>` : ''}
        <p class="muted">${t('land_move_note')}</p></div>
        <button class="btn primary block" data-act="moveHere" data-arg="${a.st}|${p0}" ${canAfford(c) ? '' : 'disabled'}>🚚 ${t('land_move_btn')} · 🪙${fmtNum(c.coins)}</button>`
        : `<div class="card"><p>${t('land_too_small')}</p></div>`}`;
  },
  weather() {
    const w = weatherNow();
    return `<div class="center"><div class="big-emoji xl">${WEATHER_E[w.kind]}</div><h2>${t('w_' + w.kind)}${w.temp != null ? ` · ${w.temp}°C` : ''}</h2>
      <p class="muted">${w.real ? t('w_real_src') : t('w_sim_src')}</p></div>
      <div class="card gap-top"><p>${t('w_effect_' + w.kind)}</p></div>
      <div class="card privacy-card"><label class="row between toggle-row"><span>📍 ${t('w_real_toggle')}<small>${t('w_real_note')}</small></span>
        <input type="checkbox" class="switch" data-act="weatherReal" ${S.weatherReal ? 'checked' : ''}></label></div>`;
  },
  cap() {
    return `<div class="center"><div class="big-emoji xl">🌙</div><h2>${t('cap_heading')}</h2>
      <p class="cap-text">${t('cap_text')}</p>
      <button class="btn primary block gap-top" data-act="close">${t('cap_ok')}</button></div>`;
  },
  // mailbox: letters in, a letter open, writing one
  mail() {
    const inbox = S.mail.inbox;
    const rows = inbox.length ? inbox.map(l => { const f = homeOf(l.from), p = PAPERS.find(x => x.id === l.paper) || PAPERS[0];
      return `<button class="list-item letter-row ${l.read ? '' : 'unread'}" data-act="readLetter" data-arg="${l.id}">${f ? avatar(f.look) : ''}
        <div class="grow"><b>${esc(fname(l.from))}</b>${l.gift && !l.claimed ? ' 🎁' : ''}<div class="muted clip">${esc(l.text)}</div></div>
        <span class="stamp" style="background:${p.ac}">✉️</span></button>`; }).join('') : `<p class="muted">${t('mail_empty')}</p>`;
    const sent = S.mail.sent.length ? `<p class="muted gap-top">${t('mail_sent_n', { n: S.mail.sent.length })}</p>` : '';
    return `<h2>📮 ${t('mailbox')}</h2><p class="muted">${t('mail_desc')}</p><div class="card">${rows}</div>${sent}
      <button class="btn primary block" data-act="compose">✉️ ${t('write_letter')}</button>`;
  },
  letter(id) {
    const l = S.mail.inbox.find(x => x.id === id);
    if (!l) return '';
    const p = PAPERS.find(x => x.id === l.paper) || PAPERS[0];
    return `<div class="paper" style="background:${p.bg};border-color:${p.ac}">
        <div class="paper-to">${t('dear', { name: esc(S.me.name) })}</div>
        <div class="paper-text">${esc(l.text)}</div>
        <div class="paper-from">— ${esc(fname(l.from))} · ${ago(l.t)}</div></div>
      ${l.gift ? `<div class="card gap-top row between"><span>🎁 ${giftText(l.gift)}</span>${l.claimed ? `<span class="muted">${t('claimed')}</span>` : `<button class="btn small primary" data-act="claimLetter" data-arg="${l.id}">${t('claim')}</button>`}</div>` : ''}
      <div class="row gap-top"><button class="btn" data-act="mailOpen">← ${t('mailbox')}</button><button class="btn primary grow" data-act="compose" data-arg="${l.from}">↩️ ${t('reply')}</button></div>`;
  },
  compose(arg) {
    const d = UI.draft, ids = friendIds();
    const p = PAPERS.find(x => x.id === d.paper) || PAPERS[0];
    const tpl = LETTER_TPL[curLang()].mine.map((s, i) => `<button class="chip" data-act="tpl" data-arg="${i}">${esc(s)}</button>`).join('');
    const gifts = giftOptions();
    return `<h2>✉️ ${t('write_letter')}</h2>
      <div class="look-row"><span>${t('to')}</span><div>${ids.map(id => `<button class="chip ${d.to === id ? 'on' : ''}" data-act="draftTo" data-arg="${id}">${esc(fname(id))}</button>`).join('')}</div></div>
      <div class="look-row"><span>${t('paper')}</span><div class="swatches left">${PAPERS.map(x => `<button class="swatch sm ${x.id === d.paper ? 'on' : ''}" style="background:${x.bg};box-shadow:0 0 0 2px ${x.ac} inset" data-act="draftPaper" data-arg="${x.id}"></button>`).join('')}</div></div>
      <div class="paper" style="background:${p.bg};border-color:${p.ac}"><div class="paper-to">${t('dear', { name: esc(fname(d.to) || '…') })}</div>
        <textarea id="draftText" class="paper-input" maxlength="140" placeholder="${t('letter_ph')}">${esc(d.text)}</textarea>
        <div class="paper-from">— ${esc(S.me.name)}</div></div>
      <div class="gap-top">${tpl}</div>
      <div class="look-row"><span>${t('attach')}</span><div><button class="chip ${d.gift < 0 ? 'on' : ''}" data-act="draftGift" data-arg="-1">${t('no_gift')}</button>
        ${gifts.map((g, i) => `<button class="chip ${d.gift === i ? 'on' : ''}" data-act="draftGift" data-arg="${i}">${giftText(g)}</button>`).join('')}</div></div>
      <button class="btn primary block gap-top" data-act="sendLetter" ${d.to ? '' : 'disabled'}>📮 ${t('send')}</button>
      <p class="muted center gap-top">${t('letter_note')}</p>`;
  },
};
function renderSheet() {
  if (!UI.sheet) return;
  const ta = $('#draftText'), focused = ta && document.activeElement === ta;
  if (focused) return;   // don't wipe what you're typing
  $('#sheet').innerHTML = `<div class="grab"></div>${SHEETS[UI.sheet.type](UI.sheet.arg)}`;
}

// ---------- console (prototype-only controls) ----------
function renderConsole() {
  const el = $('#console');
  if (!S) { el.innerHTML = `<div class="console-head"><b>🛠 ${t('console_title')}</b></div><p class="muted">${t('console_wait')}</p>`; return; }
  const b = (act, arg, label, cls = '') => `<button class="btn small ${cls}" data-act="${act}" data-arg="${arg}">${label}</button>`;
  const liveBtns = S.live ? b('liveStop', '', `⏹ ${t('live_stop', { name: nm(WORKOUTS[S.live.type]) })}`, 'primary')
    : Object.entries(WORKOUTS).map(([k, w]) => b('liveStart', k, `${w.e} ${nm(w)}`)).join('');
  el.innerHTML = `
    <div class="console-head"><b>🛠 ${t('console_title')} <span class="muted">v${VERSION}</span></b><button class="x" data-act="consoleClose">✕</button></div>
    <p class="muted">${t('console_desc')}</p>
    <div class="con-group"><h4>😴 ${t('con_sleep')}</h4>${[92, 84, 78, 70, 61, 44].map(n => b('simSleep', n, `${n}`, S.sleep && S.sleep.score === n ? 'on' : '')).join('')}
      <p class="muted">${t('con_sleep_note')}</p></div>
    <div class="con-group"><h4>⌚ ${t('con_live')}</h4>${liveBtns}<p class="muted">${t('con_live_note')}</p></div>
    <div class="con-group"><h4>❤️ ${t('con_health')}</h4>
      ${b('simSteps', 1000, '+1,000 ' + t('steps_unit'))}${b('simSteps', 3000, '+3,000 ' + t('steps_unit'))}
      ${b('simKcal', 100, '+100 ' + t('kcal'))}${b('simExMin', 10, '+10 ' + t('ex_min'))}${b('simStand', 1, '+1 ' + t('stand_h'))}
      ${b('simWorkout', 'run', t('add_workout'))}${b('simMindful', 5, '🧘 +5 ' + t('minutes'))}</div>
    <div class="con-group"><h4>📵 ${t('con_screen')}</h4>
      ${b('simFocus', 30, t('offline_x', { d: fmtDur(30 * MIN) }))}${b('simFocus', 60, t('offline_x', { d: fmtDur(60 * MIN) }))}${b('simFocus', 120, t('offline_x', { d: fmtDur(120 * MIN) }))}
      ${b('simDistract', 20, t('distract_btn'))}</div>
    <div class="con-group"><h4>🕒 ${t('con_time')}</h4>
      <div class="muted">${t('sim_time')}: <b id="conTime">${fmtDate(now())}</b></div>
      ${b('simTime', 10, t('ff_x', { d: fmtDur(10 * MIN) }))}${b('simTime', 60, t('ff_x', { d: fmtDur(HOUR) }))}${b('simTime', 360, t('ff_x', { d: fmtDur(6 * HOUR) }))}${b('simDay', '', t('next_day'))}</div>
    <div class="con-group"><h4>🌦️ ${t('con_weather')}</h4>${['auto', 'clear', 'clouds', 'rain', 'snow', 'fog', 'storm'].map(k => b('simWeather', k, k === 'auto' ? t('w_auto') : `${WEATHER_E[k]} ${t('w_' + k)}`, (S.weather && S.weather.forced ? S.weather.kind : 'auto') === k ? 'on' : '')).join('')}</div>
    <div class="con-group"><h4>👥 ${t('con_friends')}</h4>
      ${b('simEvent', '', t('sim_friend_event'))}${b('simSteal', '', t('sim_steal'))}${b('simLetter', '', t('sim_letter'))}${b('simFriendLive', '', t('sim_friend_live'))}${b('simJoin', '', t('sim_join'))}</div>
    <div class="con-group"><h4>${t('con_demo')}</h4>${b('simMoney', '', t('demo_money'))}<p class="muted">${t('demo_note')}</p></div>
    <div class="con-group"><h4>${t('con_widget')}</h4><div id="widget"></div></div>
    <div class="con-group"><button class="btn small danger" data-act="reset">${t('reset')}</button></div>`;
  renderWidget();
}
// Lock-screen widget mock: shows the latest social event, the main way back into the app.
function renderWidget() {
  const el = $('#widget');
  if (!el || !S) return;
  const last = [...S.feed].reverse().find(i => i.kind !== 'goal'), ripe = ripeCount();
  el.innerHTML = `<div class="lock"><div class="lock-date">${fmtDate(now()).replace(/ \d+:\d+$/, '')}</div>
    <div class="lock-time">${fmtClock(now())}</div>
    <div class="widget"><div class="w-title">🏡 ${t('app_name')}</div>
      <div class="w-line">${last ? feedText(last) : t('w_quiet')}</div>
      <div class="w-sub">${ENERGY_EMOJI[energyLevel()]} ${energyName()} · ${ripe ? t('w_ripe', { n: ripe }) : t('w_growing')}</div></div></div>`;
}

// ---------- doing things in the world (your townie walks over first) ----------
function result(code, onOk) {
  if (code === 'ok') { onOk(); if (actionsLeft() === 0) setTimeout(() => openSheet('cap'), 700); }
  else if (code === 'cap') openSheet('cap');
  else if (code === 'poor') snack(t('snack_poor'));
  else if (code === 'nopasture') snack(t('no_pasture'));
  else if (code === 'noorchard') snack(t('no_orchard'));
  else if (code === 'full') snack(t('snack_full'));
  else if (code === 'own') snack(t('owned'));
  else if (code === 'max') snack(t('maxed'));
}
function walkDo(tg, o) {
  if (S.live) { snack(t('snack_live_busy')); return false; }
  const ok = Scene.go(tg, { queue: true, fail: () => snack(t('snack_cant_reach')), ...o });
  if (!ok) snack(t('snack_cant_reach'));
  refreshSoon();
  return ok;
}
const after = fn => () => { fn(); refresh(); };
function harvestJob(i) {
  return { tg: { kind: 'field', i }, o: { pose: 'crouch', dur: 650, valid: () => isRipe(S.me.fields[i]), done: after(() => harvestField(i)) } };
}
function animalJob(id) {
  return { tg: { kind: 'animal', id }, o: { pose: 'crouch', dur: 700, valid: () => { const a = S.me.animals.find(x => x.id === id); return a && animalReady(a); }, done: after(() => collectFrom(id)) } };
}
function treeJob(i) {
  return { tg: { kind: 'tree', i }, o: { pose: 'pick', dur: 900, valid: () => treeReady(S.me.trees[i]), done: after(() => pickTree(i)) } };
}
function hiveJob(id) {
  return { tg: { kind: 'yard', id }, o: { pose: 'pick', dur: 900, valid: () => { const it = S.me.yard.find(x => x.id === id); return it && yardReady(it); }, done: after(() => { const r = collectYard(id); if (r) { Scene.floatMe(`+${r.n} ${GOODS[r.k].e}`); snack(t('snack_prod', { n: r.n, e: GOODS[r.k].e })); } }) } };
}
function plantJob(i, crop) {
  return { tg: { kind: 'field', i }, o: { pose: 'crouch', dur: 700, valid: () => !S.me.fields[i] && S.me.seeds[crop] > 0,
    done: after(() => result(plant(i, crop), () => Scene.floatField(i, '🌱'))) } };
}
function harvestField(i) {
  const r = harvest(i);
  if (!r) return;
  tutDone('harvest');
  Scene.floatField(i, `+${r.n} ${CROPS[r.crop].e}`);
  snack(t('snack_harvest', { n: r.n, e: CROPS[r.crop].e }));
}
function collectFrom(id) {
  const r = collectAnimal(id);
  if (!r) return;
  if (r.type === 'baby') { Scene.floatAnimal('me', id, '🍼'); snack(t(r.placed ? 'snack_baby' : 'snack_baby_barn', { name: nm(ANIMALS[r.k].baby) })); }
  else { Scene.floatAnimal('me', id, `+${r.n} ${GOODS[r.k].e}`); snack(t('snack_prod', { n: r.n, e: GOODS[r.k].e })); }
}
function pickTree(i) {
  const r = collectTree(i);
  if (!r) return;
  Scene.floatMe(`+${r.n} ${GOODS[r.k].e}`);
  snack(t('snack_prod', { n: r.n, e: GOODS[r.k].e }));
}
function goFish() {
  if (fishCount() < 1) return snack(t('snack_no_fish'));
  walkDo({ kind: 'pond' }, { pose: 'fish', dur: 2600, done: after(() => {
    const r = catchFish();
    if (r) { Scene.floatMe(`+1 ${GOODS[r.k].e}`); snack(t('snack_fish', { e: GOODS[r.k].e, name: nm(GOODS[r.k]) })); }
  }) });
}
// Sneaking at a friend's: walk over crouched, then try.
function sneakDo(tg, fn, pose = 'crouch') {
  if (S.today.steals >= STEAL_CAP) return snack(t('snack_steal_limit', { n: STEAL_CAP }));
  if (actionsLeft() <= 0) return openSheet('cap');
  walkDo(tg, { sneak: true, pose, dur: 900, done: after(fn) });
}
function stealResult(fid, r) {
  if (r.r === 'ok') { Scene.floatMe(`+${r.n} ${goodE(r.k)}`); snack(t('snack_stole', { n: r.n, e: goodE(r.k) })); }
  else if (r.r === 'dog') {
    Scene.floatMe('🐕💢'); snack(t('snack_dog', { name: fname(fid) }));
    const dog = friendById(fid).animals.find(a => ANIMALS[a.k].guard);
    Scene.flee(dog && dog.id);
  } else if (r.r === 'limit') snack(t('snack_steal_limit', { n: STEAL_CAP }));
  else if (r.r === 'cap') openSheet('cap');
  else if (r.r === 'empty') snack(t('steal_keep'));
  else if (r.r === 'done') snack(t('steal_done'));
  if (r.r === 'ok' && Math.random() < 0.3) setTimeout(() => { notify(addFeed({ kind: 'msg', from: fid, msgKey: 'msg_veg' })); refresh(); }, 3000 + Math.random() * 3000);
}
function edScope() { const e = Scene.getEdit(); return e && e.scope; }
function maybeReply(id, kind) {
  setTimeout(() => {
    if (!S || Math.random() > 0.8) return;
    let it;
    if (kind === 'letter') { receiveLetter(id, rand(LETTER_TPL[curLang()].reply), rand(PAPERS).id, Math.random() < 0.5 ? randomGift() : null); it = addFeed({ kind: 'letter', from: id }); }
    else if (kind === 'msg') it = addFeed({ kind: 'msg', from: id, msgKey: rand(MSG_KEYS) });
    else it = addFeed({ kind: 'gift', from: id, msgKey: 'thanks', gift: randomGift() });
    notify(it); refresh();
  }, 5000 + Math.random() * 4000);
}
// A friend event from state.js; letters get their text here.
function friendEvent() {
  const ev = randomFriendEvent();
  if (ev && ev.kind === 'letter') {
    receiveLetter(ev.from, rand(LETTER_TPL[curLang()].friend), rand(PAPERS).id, Math.random() < 0.4 ? randomGift() : null);
    return addFeed({ kind: 'letter', from: ev.from });
  }
  return ev;
}
function afterTimeJump(events) {
  simFriends();
  if (checkDay()) {
    snack(t('snack_new_day'));
    for (let k = 0; k < events; k++) if (Math.random() < 0.7) notify(friendEvent());
    if (S.pending.length) { UI.welcome = true; openSheet('collect'); }
  } else {
    snack(t('snack_ff'));
    if (Math.random() < 0.5) notify(friendEvent());
  }
}
function goInside() { setLevel(0); if (UI.tab === 'home') UI.inside = true; else UI.visitInside = true; syncView(); refresh(); }
function goOutside() { setLevel(0); if (UI.tab === 'home') UI.inside = false; else UI.visitInside = false; syncView(); refresh(); }
function switchFloor(lv) { setLevel(lv); Scene.levelChanged(); refresh(); }
function newDraft(to) { UI.draft = { to: to || (UI.visit || friendIds()[0] || null), paper: PAPERS[0].id, text: '', gift: -1 }; }

const ACT = {
  tab(a) {
    if (a === 'town' && UI.tab === 'town') { UI.visit = null; UI.visitInside = false; }
    closeSheet(); setTab(a);
  },
  collect: () => openSheet('collect'),
  collectAll() {
    if (!S.pending.length) return;
    const r = sumRewards(S.pending);
    addReward(r); S.pending = [];
    closeSheet();
    tutDone('collect');
    if (UI.tab === 'home' && !UI.inside) Scene.floatHouse(rewardText(r)); else snack(rewardText(r));
  },
  close: () => closeSheet(),
  energyInfo: () => openSheet('energy'),
  liveInfo: () => setTab('real'),
  watchLive() { UI.inside = false; setTab('home'); Scene.recenter(); },
  // home & visiting
  goIn() {
    if (S.live || !Scene.go({ kind: 'door' }, { done: goInside })) goInside();
  },
  goOut() {
    if (LEVEL > 0 || !Scene.go({ kind: 'exit' }, { done: goOutside })) goOutside();
  },
  // Storeys: your townie walks to the stairs first (in your own home), then you're on the other floor.
  // Changing storeys: your townie walks to the stairs and climbs (or goes down) one storey at a time.
  floor(i) {
    i = +i;
    const hm = homeOf(Scene.view().owner), lv = Math.min(LEVEL, floorsOf(hm) - 1);
    if (i === lv || Scene.onStairs()) return;
    if (S.live) return switchFloor(i);
    const dir = i > lv ? 1 : -1;
    const ok = Scene.takeStairs(dir, () => { setLevel(lv + dir); refresh(); }, () => { if (LEVEL !== i) ACT.floor(i); });
    if (!ok) switchFloor(i);
  },
  buildFloor() { openSheet('floor'); },
  buildFloorNow() {
    result(buyFloor(), () => {
      const n = floorsOf(S.me);
      closeSheet();
      snack(t('snack_floor', { n }));
      if (UI.tab === 'home' && UI.inside) switchFloor(n - 1);
      else { UI.tab = 'home'; UI.inside = false; syncView(); setTimeout(() => Scene.floatHouse('🏗️🎉'), 300); }
    });
  },
  souvGo() { closeSheet(); UI.tab = 'home'; setLevel(0); UI.inside = true; syncView(); },
  recenter: () => Scene.recenter(),
  goHome() { UI.visit = null; UI.visitInside = false; setLevel(0); setTab('home'); },
  backTown() { UI.visit = null; UI.visitInside = false; setLevel(0); syncView(); },
  visit(id) { closeSheet(); setLevel(0); if (id === 'me') { setTab('home'); return; } UI.tab = 'town'; UI.visit = id; UI.visitInside = false; syncView(); },
  ranking: () => openSheet('ranking'),
  barn: () => openSheet('barn'),
  friendSheet: id => openSheet('friend', id),
  harvestAll() {
    const r = readyLists();
    const jobs = [...r.fields.map(harvestJob), ...r.animals.map(animalJob), ...r.trees.map(treeJob), ...r.hives.map(hiveJob)];
    const n = Scene.goMany(jobs);
    if (n) snack(t('snack_going', { n }));
  },
  stopJobs() { Scene.cancel(); },
  // farm
  plant(c) {
    const i = UI.sheet.arg.i;
    closeSheet();
    tutDone('plant');
    const j = plantJob(i, c);
    walkDo(j.tg, j.o);
  },
  plantAll(c) {
    closeSheet();
    tutDone('plant');
    const empty = S.me.fields.map((f, i) => (f ? -1 : i)).filter(i => i >= 0).slice(0, Math.min(S.me.seeds[c] || 0, actionsLeft()));
    const n = Scene.goMany(empty.map(i => plantJob(i, c)));
    if (n) snack(t('snack_going_plant', { n, e: CROPS[c].e }));
  },
  collectAnimal(id) { closeSheet(); const j = animalJob(id); walkDo(j.tg, j.o); },
  sellAnimal(id) {
    const a = S.me.animals.find(x => x.id === id);
    if (!a || !confirm(t('sell_confirm', { name: animalName(a) }))) return;
    const v = sellAnimal(id);
    closeSheet(); snack(t('snack_sold', { n: v }));
  },
  // shop
  openShop(cat) { closeSheet(); UI.shop = cat; setTab('shop'); },
  shopCat(c) { UI.shop = c; $('#panel').scrollTop = 0; },
  shopSub(s) { UI.sub = UI.sub || {}; UI.sub[UI.shop] = s; },
  buySeed(arg) { const [k, n] = arg.split('|'); result(buySeed(k, +n), () => snack(t('snack_seed', { e: CROPS[k].e, n }))); },
  buyTree(k) { result(buyTree(k), () => snack(t('snack_tree', { name: nm(TREES[k]) }))); },
  buyAnimal(k) { result(buyAnimal(k), () => snack(t('snack_animal', { name: nm(ANIMALS[k].baby) }))); },
  buyLand(kind) { result(buyLand(kind), () => snack(t('snack_land_' + kind))); },
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
  moveHouse(i) {
    const r = moveHouse(+i);
    if (!r) return;
    snack(r > 1 ? t('snack_moved_stored', { name: nm(HOUSES[+i]), n: r - 1 }) : t('snack_moved', { name: nm(HOUSES[+i]) }));
    setLevel(0); UI.tab = 'home'; UI.inside = false; syncView();
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
  setRoomWall(i) { curRoom(S.me).wall = +i; },
  setFloor(i) { curRoom(S.me).floor = +i; },
  setWall(i) { S.me.wall = WALL_COLORS[+i]; },
  setRoof(i) { S.me.roof = ROOF_COLORS[+i]; },
  // social
  like(id) { if (likeFriend(id)) { snack(t('snack_liked')); Scene.wave(id); Scene.wave('me'); } else snack(t('liked')); },
  msg(arg) { const [id] = arg.split('|'); snack(t('snack_msg', { name: fname(id) })); Scene.wave('me'); maybeReply(id, 'msg'); },
  gift(arg) {
    const [id, i] = arg.split('|'), g = giftOptions()[+i];
    if (!g || !giveGift(id, g)) return;
    snack(t('snack_gift', { name: fname(id), gift: giftText(g) }));
    Scene.wave('me');
    maybeReply(id, 'gift');
  },
  invite: () => openSheet('invite'),
  buyParcel() {
    result(buyParcel(), () => { closeSheet(); snack(t('snack_parcel', { w: homeW(S.me) })); UI.tab = 'home'; UI.inside = false; syncView(); Scene.recenter(); });
  },
  moveHere(arg) {
    const [st, p] = arg.split('|'), r = relocate(st, +p);
    if (r.r === 'poor') return snack(t('snack_poor'));
    if (r.r !== 'ok') return snack(t('land_taken'));
    closeSheet();
    snack(t('snack_moved_street', { street: nm(STREETS[st]) }) + (r.refund ? ` +🪙${fmtNum(r.refund)}` : ''));
    setLevel(0); UI.visit = null; UI.tab = 'home'; UI.inside = false; Scene.moveHome(); syncView(); Scene.recenter();
  },
  weatherInfo: () => openSheet('weather'),
  weatherReal() { S.weatherReal = !S.weatherReal; if (S.weatherReal) realWeather(true); else snack(t('w_sim_src')); },
  simWeather(k) { S.weather = k === 'auto' ? null : { kind: k, temp: simWeather().temp, forced: true }; snack(`${WEATHER_E[weatherNow().kind]} ${t('w_' + weatherNow().kind)}`); },
  giftScroll() { const el = $('#giftSec'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  copyInvite() {
    const link = $('.invite-link').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => snack(t('snack_copied')), () => snack(link));
  },
  claim(id) { const g = claimGift(id); if (g) snack(t('snack_claimed', { gift: giftText(g) })); },
  restDay() { if (setRestDay()) snack(t('snack_rest')); },
  priv(k) { if (['shareGoal', 'shareLive', 'shareMood'].includes(k)) S.me[k] = !S.me[k]; },
  calm() { S.calm = !S.calm; snack(t(S.calm ? 'snack_calm_on' : 'snack_calm_off')); if (UI.sheet && UI.sheet.type === 'ranking') renderSheet(); },
  lang(l) { S.lang = l; document.documentElement.lang = l; },
  reset() { if (confirm(t('reset_confirm'))) { localStorage.removeItem(STORAGE_KEY); location.reload(); } },
  // mail
  mailGo() {
    if (UI.tab === 'home' && !UI.inside && !S.live) walkDo({ kind: 'mailbox' }, { pose: 'mail', dur: 600, done: after(() => openSheet('mail')) });
    else openSheet('mail');
  },
  mailOpen: () => openSheet('mail'),
  readLetter(id) { const l = S.mail.inbox.find(x => x.id === id); if (l) l.read = true; openSheet('letter', id); },
  claimLetter(id) { const g = claimLetterGift(id); if (g) snack(t('snack_claimed', { gift: giftText(g) })); },
  compose(to) { newDraft(to); openSheet('compose'); },
  draftTo(id) { UI.draft.to = id; },
  draftPaper(p) { UI.draft.paper = p; },
  draftGift(i) { UI.draft.gift = +i; },
  tpl(i) { UI.draft.text = (UI.draft.text ? UI.draft.text + ' ' : '') + LETTER_TPL[curLang()].mine[+i]; },
  sendLetter() {
    const d = UI.draft, ta = $('#draftText');
    if (ta) d.text = ta.value.trim();
    if (!d.to) return;
    if (!d.text) return snack(t('snack_letter_empty'));
    const g = d.gift >= 0 ? giftOptions()[d.gift] : null;
    const l = sendLetter(d.to, d.text, d.paper, g);
    if (!l) return snack(t('snack_poor'));
    closeSheet();
    snack(t('snack_letter_sent', { name: fname(d.to) }));
    Scene.wave('me');
    maybeReply(d.to, 'letter');
  },
  // console
  simSleep(n) { simSleep(+n); snack(t('snack_sleep', { n, e: energyName() })); },
  simSteps(n) { recordSteps(+n); snack(t('snack_steps', { n: fmtNum(+n) })); },
  simKcal(n) { S.today.kcal += +n; processHealth(); snack(`+${n} ${t('kcal')}`); },
  simExMin(n) { S.today.exMin += +n; processHealth(); snack(`+${n} ${t('ex_min')}`); },
  simStand(n) { S.today.standH += +n; processHealth(); snack(`+${n} ${t('stand_h')}`); },
  simWorkout() { const type = rand(Object.keys(WORKOUTS)); addWorkout(type, 30); snack(t('snack_workout', { e: WORKOUTS[type].e, name: nm(WORKOUTS[type]) })); },
  simMindful(n) { S.today.mindful += +n; processHealth(); snack(t('snack_mindful', { n })); },
  liveStart(k) {
    startLive(k, now(), 110 + Math.round(Math.random() * 40));
    UI.inside = UI.inside && UI.tab === 'home'; setTab(UI.tab === 'home' || UI.tab === 'town' ? UI.tab : 'home');
    snack(t('snack_live', { e: WORKOUTS[k].e, name: nm(WORKOUTS[k]) }));
  },
  liveStop() { const w = stopLive(); if (w) snack(t('snack_workout_done', { n: w.min, e: WORKOUTS[w.type].e })); },
  simFocus(n) { recordFocus(+n); snack(t('snack_focus', { d: fmtDur(n * MIN) })); },
  simDistract(n) { recordDistract(+n); snack(t('snack_distract')); },
  simTime(m) { S.timeOffset += m * MIN; afterTimeJump(m >= 60 ? 1 : 0); },
  simDay() { S.timeOffset += DAY; afterTimeJump(3); },
  simEvent() { const ev = friendEvent(); if (ev) notify(ev); else snack(t('snack_quiet')); },
  simSteal() { const ids = friendIds(), ev = ids.length && friendStealsFromMe(rand(ids)); if (ev) notify(ev); else snack(t('snack_nothing_ripe')); },
  simLetter() {
    const id = rand(friendIds());
    if (!id) return;
    receiveLetter(id, rand(LETTER_TPL[curLang()].friend), rand(PAPERS).id, Math.random() < 0.5 ? randomGift() : null);
    notify(addFeed({ kind: 'letter', from: id }));
  },
  simFriendLive() {
    const f = friendById(rand(friendIds()));
    if (!f) return;
    f.live = { type: rand(['run', 'walk', 'cycle', 'yoga', 'strength', 'dance']), start: now(), len: 20 * MIN };
    f.shareGoal = true;
    snack(t('snack_friend_live', { name: homeName(f), e: WORKOUTS[f.live.type].e }));
  },
  simJoin() { const it = inviteJoin(); if (it) notify(it); else snack(t('snack_street_full')); },
  simMoney() { S.me.coins += 1000; S.me.wood += 50; snack('+🪙1000 +🪵50'); },
  consoleToggle() { $('#console').classList.toggle('open'); },
  consoleClose() { $('#console').classList.remove('open'); },
  tutSkip() { endTutorial(); },
  tutEnd() { endTutorial(); setTab('home'); },
};

// Taps on the scene.
function onSceneHit(h) {
  const k = h.kind, mine = h.owner === 'me';
  if (k === 'pending') return openSheet('collect');
  if (k === 'buyLand') { ACT.openShop('land'); return refresh(); }
  if (k === 'ground') { if (S.live) return snack(t('snack_live_busy')); Scene.go({ kind: 'ground', x: h.x, y: h.y }); tutDone('walk'); return refreshSoon(); }
  if (k === 'stairs') {
    const hm = homeOf(Scene.view().owner), top = floorsOf(hm) - 1, lv = Math.min(LEVEL, top);
    ACT.floor(clamp(lv + (h.dir || 1), 0, top));
    return refresh();
  }
  if (k === 'floor') { Scene.go({ kind: 'floor', x: h.x, y: h.y }); return; }
  if (k === 'bubble') {
    if (h.what === 'field') return sneakDo({ kind: 'field', i: h.i }, () => stealResult(h.owner, steal(h.owner, h.i)));
    if (h.what === 'animal') {
      if (mine) { const j = animalJob(h.id); return walkDo(j.tg, j.o); }
      return sneakDo({ kind: 'animal', id: h.id }, () => stealResult(h.owner, stealProduct(h.owner, h.id)));
    }
    if (h.what === 'tree') {
      if (mine) { const j = treeJob(h.i); return walkDo(j.tg, j.o); }
      return sneakDo({ kind: 'tree', i: h.i }, () => stealResult(h.owner, stealFruit(h.owner, h.i)), 'pick');
    }
    if (h.what === 'yard') { const j = hiveJob(h.id); return walkDo(j.tg, j.o); }
    if (h.what === 'pond') return goFish();
  }
  if (k === 'field') {
    const hm = homeOf(h.owner), f = hm.fields[h.i];
    if (mine && isRipe(f)) { const j = harvestJob(h.i); return walkDo(j.tg, j.o); }
    if (!mine && isFriend(h.owner) && stealable(hm, h.i)) return sneakDo({ kind: 'field', i: h.i }, () => stealResult(h.owner, steal(h.owner, h.i)));
    return openSheet('field', { owner: h.owner, i: h.i });
  }
  if (k === 'animal') {
    const a = homeOf(h.owner).animals.find(x => x.id === h.id);
    if (mine && a && animalReady(a)) { const j = animalJob(h.id); return walkDo(j.tg, j.o); }
    return openSheet('animal', { owner: h.owner, id: h.id });
  }
  if (k === 'tree') {
    const tr = homeOf(h.owner).trees[h.i];
    if (mine && treeReady(tr)) { const j = treeJob(h.i); return walkDo(j.tg, j.o); }
    return openSheet('tree', { owner: h.owner, i: h.i });
  }
  if (k === 'yard') {
    const it = homeOf(h.owner).yard.find(x => x.id === h.id);
    if (mine && it && yardReady(it)) { const j = hiveJob(h.id); return walkDo(j.tg, j.o); }
    return it ? tip('yard', it.k, nm(YARD[it.k]), t('makes', { e: GOODS[YARD[it.k].prod].e, d: fmtDur(YARD[it.k].every * MIN) })) : null;
  }
  if (k === 'pond') return mine ? goFish() : snack(t('snack_not_your_pond'));
  if (k === 'mailbox') {
    if (mine) return ACT.mailGo();
    return walkDo({ kind: 'mailbox' }, { pose: 'mail', dur: 500, done: after(() => ACT.compose(h.owner)) });
  }
  if (k === 'house') return ACT.goIn();
  if (k === 'exit') return ACT.goOut();
  if (k === 'car') return openSheet('car', h.owner);
  if (k === 'avatar') {
    Scene.wave(h.owner);
    if (h.owner === 'me') snack(`${ENERGY_EMOJI[energyLevel()]} ${t('energy_desc_' + energyLevel())}`);
    else if (isFriend(h.owner)) openSheet('friend', h.owner);
    else snack(`👋 ${homeName(homeOf(h.owner))} · ${t('stranger')}`);
    return;
  }
  if (k === 'shop') { const L = SHOP_LOOK[h.k]; return tip(null, null, `${L.e} ${nm(L)}`, t('shop_soon')); }
  if (k === 'land') return openSheet('land', { st: h.st, p: h.p, n: h.n, run: h.run });
  if (k === 'buyParcel') return openSheet('land', { st: lotOf('me').st, p: lotOf('me').p + lotOf('me').n, n: 1, next: true });
  if (k === 'furn') {
    const it = shownRoom(homeOf(Scene.view().owner)).items.find(x => x.id === h.id), d = FURN[h.k];
    const sub = d.souv ? `✨ ${t('souv_title')}` : d.use ? t('use_' + d.use) : '';
    if (it && d.use && Scene.view().owner === 'me') Scene.go({ kind: 'furn', id: it.id });
    return tip('furn', h.k, nm(d), sub);
  }
  if (k === 'lot') { ACT.visit(h.owner); return refresh(); }
  if (k === 'emptyLot') return openSheet('invite');
  if (k === 'plaza') return openSheet('ranking');
  const ed = Scene.getEdit();
  if (!ed) return;
  if (k === 'place') {
    const hd = ed.hold;
    const ok = hd.id ? moveItem(ed.scope, hd.id, h.x, h.y, hd.rot) : placeFromStore(ed.scope, hd.k, h.x, h.y, hd.rot, hd.tint);
    if (ok) { Scene.hold(null); snack(t('snack_placed')); } else snack(t(PLACE_WHY === 'block' ? 'snack_blocks_way' : 'snack_noroom'));
  } else if (k === 'item') Scene.select(h.id);
  else if (k === 'deselect') Scene.select(null);
  refresh();
}

let refreshTimer = null;
function refreshSoon() { clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 60); }
function refresh() {
  if (!S) return;
  if (UI.tab === 'feed') S.feed.forEach(i => { i.read = true; });
  if (!S.onboarding) {
    const got = awardSouvenirs();
    if (got.length) { UI.souvQ = [...(UI.souvQ || []), ...got]; if (!UI.sheet) setTimeout(() => { if (!UI.sheet && UI.souvQ.length) { openSheet('souvenir', UI.souvQ.shift()); refresh(); } }, 500); }
  }
  save();
  renderHUD(); renderTabbar(); renderPanel(); renderOverlay(); renderConsole(); renderSheet();
  UI.sig = overlaySig();
}

// ---------- the iPhone app (Swift shell) talks to the game here ----------
function postNative(msg) { try { window.webkit.messageHandlers.mirror.postMessage(msg); } catch (e) { /* plain browser */ } }
window.onNativeHealth = d => {
  if (!S) return;
  try { applyNative(typeof d === 'string' ? JSON.parse(d) : d); } catch (e) { console.error(e); }
  refresh();
};
window.onNativeWorkout = d => {
  if (!S) return;
  d = typeof d === 'string' ? JSON.parse(d) : d;
  if (d && d.active) {
    const type = WORKOUTS[d.type] ? d.type : 'walk';
    if (S.live && S.live.type === type) S.live.hr = d.hr || S.live.hr;
    else startLive(type, d.start || now(), d.hr);
  } else if (S.live) stopLive();
  refresh();
};

// ---------- onboarding: few words, big pictures, and the real town already alive behind it ----------
// The game is created first (newGame preview), so these screens float over your actual street.
let obAnim = null;
function obLook() { S.me.look = { ...OB.look }; S.me.roof = OB.look.shirt; }
function renderOnboarding() {
  const el = $('#onboard'), st = OB.step;
  cancelAnimationFrame(obAnim);
  document.body.classList.add('ob-mode');
  el.className = 'onboard ob-s' + st;
  const dots = `<div class="ob-dots">${[1, 2, 3, 4, 5].map(i => `<i class="${i === st ? 'on' : ''}"></i>`).join('')}</div>`;
  const langs = `<div class="ob-lang"><button class="chip ${OB.lang === 'zh' ? 'on' : ''}" data-act="obLang" data-arg="zh">中文</button>
    <button class="chip ${OB.lang === 'en' ? 'on' : ''}" data-act="obLang" data-arg="en">English</button></div>`;
  if (st <= 3) { Scene.setView('town', 'me'); Scene.attract(0.42); }
  if (st === 0) {
    el.innerHTML = `<div class="ob-top">${langs}</div>
      <div class="ob-logo"><div class="ob-icon">🏡</div><h1>${t('app_name')}</h1><p>${t('ob_slogan')}</p></div>
      <div class="ob-card ob-start"><button class="btn primary big block" data-act="obNext">${t('ob_start')}</button>
        <p class="muted center">${t('ob_start_note')}</p></div>`;
  } else if (st <= 3) {
    const k = st - 1;
    el.innerHTML = `<div class="ob-top"><button class="ob-skip" data-act="obGo" data-arg="4">${t('ob_skip')}</button></div>
      <div class="ob-card"><canvas id="obCanvas" class="ob-story"></canvas>
        <h2>${t('story' + k + '_t')}</h2><p class="ob-sub">${t('story' + k + '_s')}</p>${dots}
        <button class="btn primary big block" data-act="obNext">${t('next')}</button></div>`;
    const cvs = $('#obCanvas');
    const loop = ts => {
      Scene.thumb('story', k, { canvas: cvs, live: true, ts, look: OB.look }, cvs.clientWidth || 320, cvs.clientHeight || 170);
      obAnim = requestAnimationFrame(loop);
    };
    obAnim = requestAnimationFrame(loop);
  } else if (st === 4) {
    Scene.attract(false); Scene.setView('home', 'me'); Scene.focusMe(2.3, 0.3);
    const L = OB.look;
    const sw = (list, cur, act) => list.map(c => `<button class="swatch sm ${c === cur ? 'on' : ''}" style="background:${c}" data-act="${act}" data-arg="${c}"></button>`).join('');
    el.innerHTML = `<div class="ob-top"></div><div class="ob-card ob-look"><h2>${t('ob_you2')}</h2>
      <input id="obName" class="input" maxlength="12" placeholder="${t('ob_name_ph')}" value="${esc(OB.name)}">
      <div class="look-row"><span>👕</span><div class="swatches left">${sw(COLORS, L.shirt, 'obShirt')}</div></div>
      <div class="look-row"><span>✋</span><div class="swatches left">${sw(SKINS, L.skin, 'obSkin')}</div></div>
      <div class="look-row"><span>💇</span><div>${HAIRS.map(hs => `<button class="chip ${L.hair === hs ? 'on' : ''}" data-act="obHair" data-arg="${hs}">${t('hair_' + hs)}</button>`).join('')}</div></div>
      <div class="look-row"><span>🎨</span><div class="swatches left">${sw(HAIR_COLORS, L.hairCol, 'obHairCol')}</div></div>
      <div class="look-row"><span>🚶</span><div><button class="chip ${L.mob === 'walk' ? 'on' : ''}" data-act="obMob" data-arg="walk">${t('mob_walk')}</button>
        <button class="chip ${L.mob === 'wheel' ? 'on' : ''}" data-act="obMob" data-arg="wheel">🦽 ${t('mob_wheel')}</button></div></div>
      <p class="muted center small">${t('ob_look_short')}</p>${dots}
      <button class="btn primary big block" data-act="obNext">${t('next')}</button></div>`;
  } else {
    Scene.attract(false); Scene.setView('home', 'me'); Scene.focusMe(1.15, 0.24);
    el.innerHTML = `<div class="ob-top"></div><div class="ob-card ob-apps"><h2>${t('ob_apps2')}</h2><p class="ob-sub">${t('ob_apps_short')}</p>
      <div class="app-grid">${APPS.map(a => `<button class="app-pick ${OB.apps.includes(a.id) ? 'on' : ''}" data-act="obApp" data-arg="${a.id}">
        <span>${a.emoji}</span>${a.name || t('app_games')}</button>`).join('')}</div>
      <div class="ob-limit"><span>⏱️ ${t('ob_limit')}</span><div>${[30, 60, 90, 120].map(m => `<button class="chip ${OB.limit === m ? 'on' : ''}" data-act="obLimit" data-arg="${m}">${fmtDur(m * MIN)}</button>`).join('')}</div></div>
      <div class="ob-promise"><div>❤️ ${t('ob_health_short')}</div><div>🔒 ${t('ob_privacy_short')}</div></div>${dots}
      <button class="btn primary big block" data-act="obDone" ${OB.apps.length ? '' : 'disabled'}>🏡 ${t('ob_move_in')}</button></div>`;
  }
}
Object.assign(ACT, {
  obLang(l) { OB.lang = l; S.lang = l; document.documentElement.lang = l; renderOnboarding(); renderConsole(); },
  obNext() { OB.step = Math.min(5, OB.step + 1); renderOnboarding(); },
  obGo(n) { OB.step = +n; renderOnboarding(); },
  obShirt(c) { OB.look.shirt = c; obLook(); renderOnboarding(); },
  obSkin(c) { OB.look.skin = c; obLook(); renderOnboarding(); },
  obHair(h) { OB.look.hair = h; obLook(); renderOnboarding(); },
  obHairCol(c) { OB.look.hairCol = c; obLook(); renderOnboarding(); },
  obMob(m) { OB.look.mob = m; obLook(); renderOnboarding(); },
  obApp(id) { OB.apps = OB.apps.includes(id) ? OB.apps.filter(x => x !== id) : [...OB.apps, id]; renderOnboarding(); },
  obLimit(m) { OB.limit = +m; renderOnboarding(); },
  obDone() {
    cancelAnimationFrame(obAnim);
    Object.assign(S, { lang: OB.lang, apps: OB.apps, limitMin: OB.limit, onboarding: false, tut: 0 });
    S.me.name = OB.name.trim() || t('default_name');
    obLook();
    OB = null;
    $('#onboard').hidden = true;
    document.body.classList.remove('ob-mode');
    Scene.attract(false);
    start();
    Scene.recenter();
    setTimeout(() => Scene.floatHouse('🎉'), 500);
  },
});

// ---------- first-minute tutorial: a pointer and one short line at a time ----------
// Each step ends when you actually do the thing (tutDone is called from the action), or is skipped if it can't apply.
const TUT = [
  { id: 'walk', at: () => sceneAt('ground', [7.2, 9.6]) },
  { id: 'harvest', at: () => sceneAt('field', S.me.fields.findIndex(isRipe)), skip: () => !S.me.fields.some(isRipe) },
  { id: 'collect', at: () => domAt('#hud .pill.pending'), skip: () => !S.pending.length },
  { id: 'plant', at: () => sceneAt('field', S.me.fields.findIndex(f => !f)), skip: () => !S.me.fields.some(f => !f) || !seedCount() },
  { id: 'tab:town', at: () => domAt('.tab[data-arg="town"]') },
  { id: 'tab:real', at: () => domAt('.tab[data-arg="real"]') },
  { id: 'done' },
];
let coachRAF = 0;
function tutStep() { return S && !S.onboarding && S.tut >= 0 && S.tut < TUT.length ? TUT[S.tut] : null; }
function tutDone(id) {
  const st = tutStep();
  if (!st || st.id !== id) return;
  S.tut++; save(); runCoach();
}
function endTutorial() {
  if (!S || S.tut === -1) return;
  S.tut = -1; save();
  $('#coach').hidden = true;
  welcomeGifts();
}
// Two friends say hello once you've settled in: a gift and a letter.
function welcomeGifts() {
  if (S.welcomed) return;
  S.welcomed = true;
  setTimeout(() => {
    notify(addFeed({ kind: 'gift', from: 'wang', msgKey: 'welcome', gift: { type: 'seed', k: 'tomato', n: 2 } }));
    receiveLetter('li', LETTER_TPL[curLang()].welcome, 'rose', { type: 'barn', k: 'apple', n: 3 });
    refresh();
  }, 2500);
}
function screenRect() { return $('.screen').getBoundingClientRect(); }
function domAt(sel) {
  const el = $(sel);
  if (!el || !el.offsetParent) return null;
  const r = el.getBoundingClientRect(), s = screenRect();
  return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top, r: Math.max(r.width, r.height) / 2 + 6 };
}
function sceneAt(kind, arg) {
  if (UI.tab !== 'home' || UI.inside || arg === -1) return null;
  const p = Scene.where(kind, arg);
  if (!p) return null;
  const c = $('#town').getBoundingClientRect(), s = screenRect();
  return { x: p.x + c.left - s.left, y: p.y + c.top - s.top, r: p.r };
}
function runCoach() { if (!coachRAF) coachRAF = requestAnimationFrame(coachLoop); }
function coachLoop() {
  coachRAF = 0;
  const el = $('#coach'), st = tutStep();
  if (!st) { el.hidden = true; return; }
  coachRAF = requestAnimationFrame(coachLoop);
  if (st.skip && st.skip()) { S.tut++; save(); return; }
  if (UI.sheet || Scene.getEdit()) { el.hidden = true; return; }
  el.hidden = false;
  const done = st.id === 'done', bub = el.querySelector('.coach-bubble');
  if (el.dataset.step !== st.id + curLang()) {
    el.dataset.step = st.id + curLang();
    bub.innerHTML = `${avatar(S.me.look)}<div><p>${t('tut_' + st.id.replace('tab:', ''))}</p>
      ${done ? `<button class="btn primary small" data-act="tutEnd">${t('tut_ok')}</button>` : `<button class="link" data-act="tutSkip">${t('tut_skip')}</button>`}</div>`;
  }
  const pos = st.at ? st.at() : null, ring = el.querySelector('.coach-ring'), hand = el.querySelector('.coach-hand'), H = el.clientHeight;
  ring.hidden = hand.hidden = !pos;
  el.classList.toggle('dim', done);
  if (pos) {
    Object.assign(ring.style, { left: pos.x - pos.r + 'px', top: pos.y - pos.r + 'px', width: pos.r * 2 + 'px', height: pos.r * 2 + 'px' });
    Object.assign(hand.style, { left: pos.x - 6 + 'px', top: pos.y + pos.r * 0.35 + 'px' });
    const below = pos.y < H * 0.5;
    bub.style.top = below ? pos.y + pos.r + 44 + 'px' : '';
    bub.style.bottom = below ? '' : H - pos.y + pos.r + 14 + 'px';
  } else { bub.style.top = done ? '36%' : '128px'; bub.style.bottom = ''; }
}

// ---------- boot ----------
function start() {
  document.documentElement.lang = S.lang;
  checkDay();
  simFriends();
  setTab('home');
  refresh();
  postNative({ type: 'ready' });
  if (tutStep()) runCoach();
  else {
    if (S.pending.length) { UI.welcome = true; openSheet('collect'); }
    welcomeGifts();
  }
}

document.addEventListener('click', e => {
  if (e.target.id === 'backdrop') return closeSheet();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  const ta = $('#draftText');
  if (ta && UI.draft) UI.draft.text = ta.value;
  fn(el.dataset.arg);
  if (S && !S.onboarding && !el.dataset.act.startsWith('ob')) refresh();
});
document.addEventListener('input', e => {
  if (e.target.id === 'obName') OB.name = e.target.value;
  if (e.target.id === 'draftText' && UI.draft) UI.draft.text = e.target.value;
});

Scene.init($('#town'), onSceneHit);
setInterval(() => {
  if (!S) return;
  if (checkDay() && !S.onboarding) { snack(t('snack_new_day')); refresh(); }
  simFriends();
  const clock = $('#clock'); if (clock) clock.textContent = fmtClock(now());
  const ct = $('#conTime'); if (ct) ct.textContent = fmtDate(now());
  renderWidget();
  if (S.onboarding) return;
  if (overlaySig() !== UI.sig) { renderHUD(); renderOverlay(); renderTabbar(); UI.sig = overlaySig(); }
  if (UI.sheet && ['field', 'animal', 'tree'].includes(UI.sheet.type)) renderSheet();
  if (UI.tab === 'real' && S.live) renderPanel();
  rainGrow(1000);
  if (S.weatherReal && (!S.weather || !S.weather.real || now() - S.weather.at > 30 * MIN) && Date.now() - weatherTried > 5 * MIN) realWeather(false);
}, 1000);
// Friends stay active in the background, but rarely (no spam).
setInterval(() => {
  if (!S || S.onboarding || document.hidden || Math.random() > 0.5) return;
  notify(friendEvent()); refresh();
}, 45000);

if (load() && !S.onboarding) start();
else {
  if (!S) {
    const lang = (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
    newGame({ preview: true, lang, name: '', apps: ['tiktok', 'instagram'], limitMin: 60,
      look: { shirt: COLORS[4], skin: SKINS[0], hair: 'short', hairCol: HAIR_COLORS[0], mob: 'walk' } });
  }
  OB = { step: 0, name: S.me.name || '', look: { ...S.me.look }, apps: [...S.apps], limit: S.limitMin, lang: S.lang };
  document.documentElement.lang = OB.lang;
  $('#onboard').hidden = false;
  renderOnboarding(); renderConsole();
}
