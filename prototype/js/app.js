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
  if (it.kind === 'pet') { const a = myPets().find(x => x.id === it.pet); return petAskText(a ? a.name : '', a ? a.k : 'dog', it.need); }
  const name = esc(fname(it.from));
  if (it.kind === 'gift') return t(it.msgKey === 'welcome' ? 'feed_welcome' : it.msgKey === 'thanks' ? 'feed_thanks' : 'feed_gift', { name, gift: giftText(it.gift) });
  if (it.kind === 'like') return t('feed_like', { name });
  if (it.kind === 'goal') return t('feed_goal', { name });
  if (it.kind === 'msg') return t('feed_msg', { name, msg: t(it.msgKey) });
  if (it.kind === 'join') return t('feed_join', { name, gift: giftText(it.gift) });
  if (it.kind === 'stole') return t('feed_stole', { name, n: it.n, e: goodE(it.k) });
  if (it.kind === 'caught') return it.n ? t('feed_caught_fine', { name, e: goodE(it.k), n: it.n }) : t('feed_caught', { name, e: goodE(it.k) });
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
        const code = j.current.weather_code;
        S.weather = { kind: codeKind(code), temp: Math.round(j.current.temperature_2m), real: true, at: now(), heavy: [63, 65, 66, 67, 81, 82].includes(code) };
        if (loud) snack(`${WEATHER_E[S.weather.kind]} ${t('w_' + S.weather.kind)} · ${S.weather.temp}°C`);
        refresh();
      }).catch(() => { if (loud) snack(t('w_fail')); }).finally(() => { weatherBusy = false; });
  }, () => { weatherBusy = false; S.weatherReal = false; if (loud) snack(t('w_denied')); refresh(); }, { maximumAge: 3 * HOUR, timeout: 15000 });
}
// A little label above the thing you tapped: picture, name and what it does.
let tipTimer = null;
// A little label about the thing you tapped (a bar at the top). It goes away by itself, when you tap anywhere else,
// or when you tap the same thing again.
let tipKey = null, tipHidAt = 0;
function hideTip() { const el = $('#tip'); if (el) el.hidden = true; tipKey = null; }
function tip(kind, k, name, sub) {
  const el = $('#tip'), p = Scene.tapAt(), key = kind + ':' + k + ':' + Math.round(p.x / 30) + ':' + Math.round(p.y / 30);
  if (tipKey === key && (!el.hidden || Date.now() - tipHidAt < 500)) return hideTip();   // same thing again: close it
  tipKey = key;
  el.innerHTML = `${kind ? thumbImg(kind, k, {}, 52, 44, 'thumb') : ''}<div><b>${esc(name)}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
  el.hidden = false;
  // v0.13: a slim bar at the top of the scene (under the context bar), so it never covers what you tapped
  const cb = $('#ctxbar'), top = cb && !cb.hidden ? cb.offsetTop + cb.offsetHeight + 8 : 10;
  el.style.left = ''; el.style.top = top + 'px';
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, 2600);
}
// any touch hides the label (a tap on a thing shows its own label again right after)
document.addEventListener('pointerdown', e => { const el = $('#tip'); if (el && !el.hidden && !e.target.closest('#tip')) { el.hidden = true; tipHidAt = Date.now(); } }, { passive: true, capture: true });
let snackTimer = null;
function snack(text) {
  const el = $('#snack');
  el.textContent = text; el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

// ---------- view ----------
// The scene is on screen for Home, Town, and in World once you've picked a community (UI.wtown); World without
// one is the map (a panel). The Town tab is always your own community (friends and family); World is everyone.
const sceneTab = () => UI.tab === 'home' || UI.tab === 'town' || (UI.tab === 'world' && !!UI.wtown);
function syncView() {
  setViewTown(UI.tab === 'world' && UI.wtown ? UI.wtown : myTown());
  if (UI.tab === 'home') Scene.setView(UI.inside ? 'interior' : 'home', 'me');
  else if (sceneTab()) Scene.setView(UI.visit ? (UI.visitInside ? 'interior' : 'home') : 'town', UI.visit || 'me');
  Scene.setVisible(sceneTab());
  // each place has its own tune
  const inside = (UI.tab === 'home' && UI.inside) || (UI.visit && UI.visitInside);
  Sound.setScene(UI.tab === 'shop' ? 'shop' : inside ? 'inside' : UI.tab === 'world' && !UI.wtown ? 'world' : (UI.tab === 'town' || UI.tab === 'world') ? (UI.visit ? 'home' : 'town') : 'home');
}
function setTab(tab) {
  if (Scene.getEdit()) Scene.stopEdit();
  if (tab !== UI.tab && (tab === 'town' || tab === 'world')) { UI.visit = null; UI.visitInside = false; setLevel(0); }   // a visit belongs to the tab it started in
  if (tab === 'world' && UI.tab === 'world') { UI.wtown = null; UI.visit = null; }   // tapping World again: back to the map
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
      <div class="row tight">${mail ? `<button class="pill mail" data-act="mailGo">✉️ ${mail}</button>` : ''}${weatherPill()}</div>
    </div>
    <div class="res row">
      <span class="pill">🪙 ${fmtNum(S.me.coins)}</span><span class="pill">🪵 ${S.me.wood}</span>
      <button class="pill farm ${actionsLeft() === 0 ? 'done' : ''}" data-act="capInfo" style="--p:${Math.round(actionsLeft() / ACTION_CAP * 100)}"><i class="ring"></i>${t('farm_pill', { n: actionsLeft() })}</button>${live}
      ${S.work ? `<button class="pill work" data-act="placeGo" data-arg="${S.work.place}">💼 ${fmtDur(Math.max(0, S.work.end - now()))}</button>` : ''}${S.sick ? `<button class="pill sick" data-act="placeGo" data-arg="clinic">🤒</button>` : ''}
      ${S.pending.length ? `<button class="pill pending" data-act="collect">📦 ${t('to_collect')} ${S.pending.length}</button>` : ''}
    </div>`;
}
function renderTabbar() {
  const n = unreadCount() + unreadMail();
  $('#tabbar').innerHTML = [['home', '🏡'], ['town', '🏘️'], ['world', '🌍'], ['shop', '🛒'], ['real', '❤️'], ['feed', '🔔']].map(([id, ic]) =>
    `<button class="tab ${UI.tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">
      <span class="ic">${ic}</span>${t('tab_' + id)}${id === 'feed' && n ? `<span class="badge">${n}</span>` : ''}</button>`).join('');
}
function renderPanel() {
  const el = $('#panel'), onScene = sceneTab();
  el.hidden = onScene;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  const top = el.scrollTop, ws = $('.wmap-scroll'), wx = ws ? ws.scrollLeft : null;
  if (UI.tab === 'shop') el.innerHTML = panelShop();
  else if (UI.tab === 'real') el.innerHTML = panelReal();
  else if (UI.tab === 'feed') el.innerHTML = panelFeed();
  else if (UI.tab === 'world') { el.innerHTML = panelWorld(); afterWorld(wx); }
  el.scrollTop = top;
}

// Buttons and banners laid over the scene.
function renderOverlay() {
  const ctxEl = $('#ctxbar'), fab = $('#fab'), tray = $('#tray'), hv = $('#harvestAll'), lb = $('#liveBanner');
  const onScene = sceneTab(), ed = Scene.getEdit();
  if (!onScene) { ctxEl.hidden = fab.hidden = tray.hidden = hv.hidden = lb.hidden = true; return; }
  const b = (act, ic, label, arg = '', badge = 0) => `<button class="fab-btn" data-act="${act}" data-arg="${arg}"><span>${ic}</span>${label}${badge ? `<i class="fab-badge">${badge}</i>` : ''}</button>`;
  const petBtn = () => b('pets', '🐾', t('fab_pets'), '', petAlertCount());
  let c = '', f = '';
  if (ed) {
    c = `<div class="ctx-main">✏️ ${t(ed.scope === 'room' ? 'ctx_edit_room' : 'ctx_edit_yard')}</div><button class="btn small primary" data-act="editDone">${t('done')}</button>`;
  } else if (UI.tab === 'home') {
    if (UI.inside) {
      c = `<div class="ctx-main">🛋️ ${nm(HOUSES[S.me.house])}</div>${floorChips(S.me)}`;
      f = b('goOut', '🌳', t('fab_exit')) + b('design', '✏️', t('fab_design')) + b('barn', '🧺', t('fab_barn')) + petBtn();
    } else {
      c = S.calm ? `<button class="ctx-main link" data-act="ranking">${t('ctx_town_calm', { street: t('street_name'), lv: townLevel() })}</button>`
        : `<button class="ctx-main link" data-act="ranking">🏆 ${t('ctx_rank', { n: rankOf('me'), v: fmtNum(assetValue(S.me)) })}</button>`;
      f = b('goIn', '🚪', t('fab_enter')) + b('design', '✏️', t('fab_design')) + b('barn', '🧺', t('fab_barn')) + petBtn() + b('recenter', '🎯', t('fab_center'));
    }
  } else if (!UI.visit && Scene.tripNow()) {   // on the way somewhere (v0.12)
    const tr = Scene.tripNow();
    c = `<div class="ctx-main">${{ walk: '🚶', bike: '🚲', car: '🚗' }[tr.how]} ${t('go_on_way', { to: esc(UI.tripTo || '') })}</div><button class="btn small" data-act="tripFast">⚡ ${t('go_now')}</button>`;
  } else if (UI.visit) {
    const h = homeOf(UI.visit), fr = isFriend(h.id), street = streetsOf(townOf(h.id))[lotOf(h.id).st];
    const tw = townOf(h.id), away = visitingNow(h.id), on = isOnline(h.id) && !away;
    const sub = (fr ? (S.calm ? '' : ` · 🏆 ${rankOf(h.id)} · 🪙${fmtCompact(assetValue(h))}`) : ` · ${nm(street)}`)
      + ` · <span class="${on ? 'online-dot' : 'off-dot'}"></span>${t(on ? 'st_home' : away ? 'st_out' : 'st_off')}` + (tw !== myTown() ? ` · ${isNightIn(tw) ? '🌙' : '☀️'} ${localClock(tw)}` : '');
    c = `<button class="btn small" data-act="backTown">← ${UI.tab === 'world' ? nm(COMMUNITIES[VIEW_TOWN]) : t('tab_town')}</button><div class="ctx-main">${t('home_of', { name: esc(homeName(h)) })}${sub}</div>${UI.visitInside ? floorChips(h) : ''}`;
    f = UI.visitInside ? b('goOut', '🌳', t('fab_exit'))
      : fr ? b('goIn', '🚪', t('fab_peek')) + b('trophies', '🏆', t('fab_trophies'), h.id) + b('like', '❤️', t('like'), h.id) + b('friendSheet', '🎁', t('fab_gift'), h.id) + b('compose', '✉️', t('fab_letter'), h.id) + b('goHome', '🏡', t('fab_home'))
        : b('goIn', '🚪', t('fab_peek')) + b('trophies', '🏆', t('fab_trophies'), h.id) + b('goHome', '🏡', t('fab_home'));
  } else if (UI.tab === 'world') {   // looking around a community somewhere in the world
    const cm = COMMUNITIES[VIEW_TOWN];
    c = `<button class="btn small" data-act="worldMap">← 🌍</button><div class="ctx-main">${cm.flag} ${nm(cm)} · ${isNightIn(VIEW_TOWN) ? '🌙' : '☀️'} ${localClock(VIEW_TOWN)} · <span class="online-dot"></span>${t('online_n', { n: fmtNum(onlineIn(VIEW_TOWN)) })}</div>`;
    f = b('worldMap', '🗺️', t('fab_map')) + b('goHome', '🏡', t('fab_home'));
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
    const where = placeInfo(LIVE_PLACE[S.live.type] || 'park');
    lb.innerHTML = `<div><b>${w.e} ${t('live_now', { name: nm(w), n: Math.floor(liveMin()) })}</b>${S.live.hr ? ` · ❤️ ${S.live.hr}` : ''}</div><span>${t('live_at', { place: `${where.e} ${nm(where)}` })}</span>
      <button class="btn small" data-act="seeLive">👀 ${t('live_see')}</button>`;
  }
}
function overlaySig() {
  return [UI.tab, UI.inside, UI.visit, UI.wtown, VIEW_TOWN, ripeCount(), Scene.busy(), S.live ? Math.floor(liveMin()) + ':' + S.live.hr : '', unreadMail(), S.pending.length, LEVEL, petAlertCount(), actionsLeft(), S.lang].join('|');
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
  if (scope === 'yard' && UI.moveArea) return `<div class="tray-row"><div class="grow"><b>${t('area_tap_new', { name: t('area_' + UI.moveArea) })}</b></div>
      <button class="btn small" data-act="areaCancel">✕ ${t('cancel')}</button></div>`;
  const tabs = `<div class="tray-tabs"><button class="chip ${UI.tray === 'items' ? 'on' : ''}" data-act="trayTab" data-arg="items">${t('tray_items')}</button>
    <button class="chip ${UI.tray === 'colors' ? 'on' : ''}" data-act="trayTab" data-arg="colors">${t('tray_colors')}</button>
    ${scope === 'yard' ? `<button class="chip ${UI.tray === 'areas' ? 'on' : ''}" data-act="trayTab" data-arg="areas">${t('tray_areas')}</button>` : ''}
    <span class="muted">${t('tray_hint')}</span></div>`;
  if (UI.tray === 'areas' && scope === 'yard') {   // v0.15: move the pasture, fields, orchard or pond
    const E = { pasture: '🐄', fields: '🌱', orchard: '🌳', pond: '🐟' };
    return tabs + `<div class="tray-areas">${MOVABLE.map(k => `<button class="btn small" data-act="areaPick" data-arg="${k}">${E[k]} ${t('area_' + k)}</button>`).join('')}</div><p class="muted small">${t('area_note')}</p>`;
  }
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
const SHOP_CATS = [['seeds', '🌱'], ['trees', '🌳'], ['animals', '🐣'], ['pets', '🐾'], ['land', '🗺️'], ['furn', '🛋️'], ['yard', '⛲'], ['cars', '🚗'], ['houses', '🏠'], ['excl', '🏆'], ['sell', '💰']];
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
    body = Object.entries(ANIMALS).filter(([k, a]) => keep(k) && !a.excl).map(([k, a]) => {
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
  } else if (cat === 'excl') {
    // things only trophy winners may buy: locked until you've earned the trophy in real life
    note = t('excl_note');
    const isSt = k => k.startsWith('st_'), isAw = k => k.startsWith('aw_');
    const statues = EXCLUSIVES.filter(([, k]) => isSt(k)).sort((a, b) => exclOK(YARD[b[1]].excl) - exclOK(YARD[a[1]].excl));
    const shown = UI.exclAll ? statues : statues.filter(([, k], i) => exclOK(YARD[k].excl) || i < 6);
    const head = (txt, n) => `<div class="grid-head">${txt}${n ? ` <span class="muted">${n}</span>` : ''}</div>`;
    const cards = list => list.map(([kind, k]) => {
      const d = exclDef(kind, k), ok = exclOK(d.excl), price = kind === 'car' ? d.cost.coins : d.price;
      const img = kind === 'yard' ? thumbImg('yard', k) : kind === 'car' ? thumbImg('car', k, { color: d.color }) : kind === 'pet' ? thumbImg('pet', k, {}) : thumbImg('animal', k, { stage: 2 });
      const owned = kind === 'car' ? h.cars.some(c => c.k === k) : kind === 'pet' ? myPets(h).some(a => a.breed === k) : false;
      const btn = !ok ? `<span class="tag lock">🔒 ${t('excl_locked')}</span>` : owned ? `<span class="tag ok">${t('owned')}</span>` : buyBtn('buyExcl', kind + '|' + k, `🪙${fmtNum(price)}`, h.coins >= price);
      return `<div class="item-card excl ${ok ? 'open' : 'shut'}">${img}<div class="item-name">${ok ? '🏆' : '🔒'} ${nm(d)}</div><div class="item-sub">${exclReqText(d.excl)}</div><div class="item-btns">${btn}</div></div>`;
    }).join('');
    body = head(`🏆 ${t('excl_sec_trophy')}`) + cards(EXCLUSIVES.filter(([, k]) => !isSt(k) && !isAw(k)))
      + head(`🏅 ${t('excl_sec_award')}`) + cards(EXCLUSIVES.filter(([, k]) => isAw(k)))
      + head(`🗿 ${t('excl_sec_statue')}`, `${statues.filter(([, k]) => exclOK(YARD[k].excl)).length}/${statues.length}`) + cards(shown)
      + (UI.exclAll ? '' : `<button class="btn block grid-head" data-act="exclAll">${t('excl_all_statues', { n: statues.length })}</button>`);
  } else if (cat === 'pets') {
    // adopt a dog or a cat by breed; food and treats; bowls, litter box, beds
    const n = myPets(h).length, pf = h.petFood || {};
    note = t('pets_note', { n, max: PET_MAX, food: PET_START_FOOD });
    body = Object.entries(PET_BREEDS).filter(([k, B]) => keep(k) && !B.excl).map(([k, B]) => shopCard(thumbImg('pet', k, {}), `${B.kind === 'dog' ? '🐕' : '🐈'} ${nm(B)}`,
      t('pet_sub_' + B.kind), buyBtn('adopt', k, `${t('adopt')} 🪙${B.price}`, h.coins >= B.price && n < PET_MAX))).join('')
      + Object.entries(PET_FOOD).filter(([k]) => keep(k)).map(([k, f]) => shopCard(`<div class="emoji-thumb">${f.e}</div>`, nm(f),
        t(k === 'treats' ? 'treat_sub' : 'petfood_sub', { n: f.n, have: pf[k] || 0, love: PET_LOVE.treat }), buyBtn('buyPetFood', k, `🪙${f.price}`, h.coins >= f.price))).join('')
      + ['petbowl', 'litterbox', 'petbed', 'cattree'].filter(k => keep(k)).map(k => { const d = FURN[k];
        return shopCard(thumbImg('furn', k), nm(d), t('furn_sub', { w: d.w, d: d.d }), buyBtn('buyItem', 'room|' + k, `🪙${fmtNum(d.price)}`, h.coins >= d.price)); }).join('');
  } else if (cat === 'land') {
    body = landCard('field', thumbImg('field', 'f'), '🟫') + landCard('pasture', thumbImg('pasture', 'p'), '🐄')
      + landCard('orchard', thumbImg('orchard', 'o'), '🌳') + landCard('pond', thumbImg('pond', 'p'), '🐟');
    note = t('note_land');
  } else if (cat === 'furn' || cat === 'yard') {
    const scope = cat === 'furn' ? 'room' : 'yard', list = cat === 'furn' ? FURN : YARD;
    const owned = k => (scope === 'room' ? allRoomItems(h) : h.yard).filter(i => i.k === k).length + (h.store[scope + ':' + k] || 0);
    body = Object.entries(list).filter(([k, d]) => !d.souv && !d.excl && !d.award && keep(k)).map(([k, d]) => {
      const n = owned(k);
      const use = d.use ? ` · ${t('use_' + d.use)}` : d.prod ? ` · ${t('makes', { e: GOODS[d.prod].e, d: fmtDur(d.every * MIN) })}` : '';
      return shopCard(thumbImg(cat, k), nm(d), t('furn_sub', { w: d.w, d: d.d }) + use + (n ? ` · ${t('owned_n', { n })}` : ''),
        buyBtn('buyItem', scope + '|' + k, `🪙${fmtNum(d.price)}`, h.coins >= d.price));
    }).join('');
    note = t(cat === 'furn' ? 'note_furn' : 'note_yard');
    if (cat === 'furn') subs = subChips('furn', s => (s.id === 'souv' ? `${S.souv.length}/${SOUVENIRS.length}` : s.keys.length));
    if (sub && sub.id === 'souv') { note = ''; body = ''; subs += souvCard(); }
  } else if (cat === 'cars') {
    body = Object.entries(CARS).filter(([k, c]) => keep(k) && !c.excl).map(([k, c]) => {
      const i = h.cars.findIndex(x => x.k === k), color = i >= 0 ? h.cars[i].color : c.look || CAR_COLORS[0];
      let btn;
      if (i < 0) btn = buyBtn('buyCar', k, costText(c.cost), canAfford(c.cost));
      else if (i === h.car) btn = `<span class="tag ok">${t('car_driving')}</span>`;
      else btn = buyBtn('driveCar', i, t('car_drive'), true, '');
      return shopCard(thumbImg('car', k, { color }), nm(c), (i >= 0 ? t('owned') + ' · ' : '') + t('car_cargo', { n: c.cargo || WALK_CARRY }), btn);
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
    note = `${t('mk_shop_note')} <button class="btn small primary" data-act="placeGo" data-arg="market">🛒 ${t('mk_go_sell')}</button>`;
    body = keys.length ? keys.map(k => {
      const b = barnInfo(k), n = h.barn[k];
      const img = CROPS[k] ? thumbImg('crop', k) : GOODS[k] ? thumbImg('good', k) : thumbImg('animal', b.baby, { stage: 0 });
      return shopCard(img, `${b.e} ${b.name} ×${n}`, `${t('mk_price_now', { n: marketPrice(k) })} ${trendArrow(k)}`,
        b.baby && pastureCount() < pastureCap() ? buyBtn('release', b.baby, t('baby_release'), true, '') : '');
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
    ${trophyCard()}
    ${souvCard()}
    <div class="card"><h3>⌚ ${t('devices_title')}</h3><p class="muted">${t('devices_text')}</p></div>
    ${privacyCard()}
    <div class="card privacy-card"><h3>⚙️ ${t('settings')}</h3>
      <div class="row between"><span>${t('language')}</span><span>
        <button class="chip ${S.lang === 'zh' ? 'on' : ''}" data-act="lang" data-arg="zh">中文</button>
        <button class="chip ${S.lang === 'en' ? 'on' : ''}" data-act="lang" data-arg="en">English</button></span></div>
      <label class="row between toggle-row"><span>🎵 ${t('set_music')}</span><input type="checkbox" class="switch" data-act="toggleMusic" ${S.music !== false ? 'checked' : ''}></label>
      <label class="row between toggle-row"><span>🔊 ${t('set_sfx')}</span><input type="checkbox" class="switch" data-act="toggleSfx" ${S.sfx !== false ? 'checked' : ''}></label>
      <div class="row between"><span>🌗 ${t('set_theme')}</span><span>${['auto', 'light', 'dark'].map(m => `<button class="chip ${S.theme === m ? 'on' : ''}" data-act="setTheme" data-arg="${m}">${t('theme_' + m)}</button>`).join('')}</span></div>
      <label class="row between toggle-row"><span>🐾 ${t('pet_remind')}<small>${t('pet_remind_note')}</small></span><input type="checkbox" class="switch" data-act="togglePetRemind" ${S.petRemind !== false ? 'checked' : ''}></label></div>
    <div class="card privacy-card"><h3>👤 ${t('account')}</h3>
      <div class="row between"><span>${S.account ? t('signed_in_with', { p: t('p_' + S.account.provider) }) + (S.account.email ? `<small>${esc(S.account.email)}</small>` : '') + (S.account.sim ? `<small>${t('login_sim')}</small>` : '') : t('not_signed_in')}</span>
        ${S.account ? `<button class="btn small" data-act="signOut">${t('sign_out')}</button>` : `<button class="btn small primary" data-act="showLogin">${t('sign_in')}</button>`}</div></div>`;
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
      : it.kind === 'stole' || it.kind === 'caught' ? `<button class="btn small" data-act="goTo" data-arg="${it.from}">${t('visit_back')}</button>`
      : it.kind === 'letter' ? `<button class="btn small" data-act="mailOpen">${t('read')}</button>` : '';
    return `<div class="list-item">${f ? avatar(f.look, '', f.id === 'me' ? energyLevel() : friendEnergy(f)) : ''}<div class="grow"><div>${feedText(it)}</div><div class="muted">${ago(it.t)}</div></div>${btn}</div>`;
  }).join('');
  return `<h1 class="panel-title">${t('tab_feed')}</h1>${mail}<div class="row between note"><p class="muted">${t('feed_note')}</p>${calm}</div><div class="card">${items}</div>`;
}

// ---------- sheets ----------
function openSheet(type, arg) {
  if (type === 'souvenir') Sound.play('chime');
  if (type === 'trophyNew') { Sound.play('levelup'); setTimeout(() => Sound.play('coins'), 500); }
  UI.sheet = { type, arg };
  renderSheet();
  const compact = ['friend', 'host', 'go', 'field', 'animal', 'car', 'tree'].includes(type);
  $('#sheet').className = 'sheet' + (compact ? ' compact' : '') + (type === 'pets' || type === 'trophies' ? ' tall' : '');
  $('#sheet').hidden = false;
  $('#backdrop').hidden = false;
  $('#backdrop').classList.toggle('light', compact);
}
function closeSheet() {
  UI.sheet = null; $('#sheet').hidden = true; $('#backdrop').hidden = true; UI.welcome = false;
  if (UI.souvQ && UI.souvQ.length) setTimeout(() => { if (!UI.sheet && UI.souvQ.length) { openSheet('souvenir', UI.souvQ.shift()); refresh(); } }, 350);
  else if (UI.trophyQ && UI.trophyQ.length) setTimeout(() => { if (!UI.sheet && UI.trophyQ.length) { openSheet('trophyNew', UI.trophyQ.shift()); refresh(); } }, 350);
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
    let extra = isFlooded(f) ? `<p class="flood-note">🌊 ${t('w_field_flooded', { m: fmtDur(f.flood - now()) })}</p>` : '';
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
        ${d.pet ? '' : buyBtn('carryAnimal', a.id, t('mk_take_animal', { n: marketPrice('animal_' + a.k + '_' + st) }), true, '')}</div>` : '';
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
      <div class="grow"><b>${b.name}</b> <span class="muted">×${h.barn[k]}</span><div class="cost">${t('mk_price_now', { n: marketPrice(k) })} ${trendArrow(k)}</div></div></div>`; }).join('')
      : `<p class="muted">${t('barn_empty')}</p>`;
    const seeds = Object.entries(h.seeds).filter(([, n]) => n > 0), store = Object.entries(h.store);
    return `<h2>🧺 ${t('barn_title')}</h2><p class="muted">${t('barn_desc')}</p>
      <div class="card"><div class="row between"><h3>🌾 ${t('barn_goods')}</h3>${keys.length ? `<button class="btn small primary" data-act="placeGo" data-arg="market">🛒 ${t('mk_go_sell')}</button>` : ''}</div>${goods}</div>
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
  // Going to someone's home or a place in town (v0.12): on foot, by car (or bike) along the roads, or straight there.
  go(a) {
    const T = goTarget(a);
    return `<h2>${T.e} ${esc(T.name)}</h2><p class="muted">${t('go_sub')}</p>${goTiles(T)}`;
  },
  // A public place in town (v0.12): what it's for; go there first, then use it.
  place(key) {
    const P = placeInfo(key), here = Scene.here() === key, mineTown = VIEW_TOWN === myTown();
    const head = `<div class="place-head"><span class="big-emoji">${P.e}</span><div class="grow"><h2>${nm(P)}</h2><p class="muted">${t('pl_desc_' + (key === 'lake' && P === PLACE_INFO.beach ? 'beach' : key))}</p></div></div>`;
    if (!mineTown) return head + `<p class="muted">${t('pl_other_town')}</p>`;
    if (!here && key === 'market') return head + marketBody(false) + `<div class="sec-title">${t('mk_go')}</div>${goTiles(goTarget({ place: key }))}<p class="muted small center">${t('mk_carry', { w: WALK_CARRY, c: carryCap('car') })}</p>`;
    if (!here && key !== 'plaza') return head + `<div class="sec-title">${t('pl_go_first')}</div>${goTiles(goTarget({ place: key }))}`;
    return head + placeBody(key);
  },
  // The owner of the home you're visiting: are they online, and may you sit down / lie down here?
  host(id) {
    const h = homeOf(id), on = isOnline(id), away = visitingNow(id), ok = canUseAt(id), fr = isFriend(id), name = esc(homeName(h));
    const ans = UI.hostAns && UI.hostAns.id === id ? UI.hostAns.a : null, want = UI.hostWant && FURN[UI.hostWant];
    const st = !on ? `<i class="off-dot"></i>${t('host_offline')}` : away ? `<i class="online-dot"></i>${t('host_away', { name: esc(homeName(homeOf(away))) })}`
      : `<i class="online-dot"></i>${t('host_home')}`;
    const tm = townOf(id) !== myTown() ? `<span>${isNightIn(townOf(id)) ? '🌙' : '☀️'} ${localClock(townOf(id))}</span>` : '';
    let body;
    if (ok) body = `<p class="host-say yes">😊 ${t('host_yes', { name })}</p>`;
    else if (ans === 'wait') body = `<p class="host-say">💭 ${t('host_thinking', { name })}</p>`;
    else if (ans === 'no') body = `<p class="host-say">🙏 ${t('host_no', { name })}</p>`;
    else if (on && !away) body = `<button class="btn primary block" data-act="askHost" data-arg="${id}">🙏 ${want ? t('host_ask_it', { it: nm(want) }) : t('host_ask')}</button>`;
    else body = `<p class="muted">${t(on ? 'host_cant_away' : 'host_cant_off', { name })}</p>`;
    return `<div class="profile">${avatar(h.look, 'xxl', friendEnergy(h))}<div class="grow">
        <div class="profile-name">${name}</div><div class="profile-tags"><span>${st}</span>${tm}</div></div></div>
      <div class="card"><b>🏠 ${t('house_rules_title')}</b><p class="muted">${t('house_rules_desc')}</p></div>
      ${body}
      <div class="row gap-top">
        <button class="btn grow" data-act="waveHost" data-arg="${id}">👋 ${t('host_wave')}</button>
        ${fr ? `<button class="btn grow" data-act="compose" data-arg="${id}">✉️ ${t('write_letter')}</button><button class="btn grow" data-act="friendSheet" data-arg="${id}">⋯</button>` : ''}
      </div>`;
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
        ${here ? act('goIn', '', '🚪', t('fab_peek'), t('peek_short')) : act('goTo', id, '🏡', t('visit'), t('visit_short'))}
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
        <div class="right"><b>🪙${fmtNum(r.v)}</b>${me ? '' : `<button class="btn small" data-act="goTo" data-arg="${r.h.id}">${t('visit')}</button>`}</div></div>`;
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
    const st = streetsOf(VIEW_TOWN)[a.st], nb = NEIGHBORHOODS[st.nb], l = lotOf('me'), other = VIEW_TOWN !== myTown(), cm = COMMUNITIES[VIEW_TOWN];
    const next = !other && l.st === a.st && a.p === l.p + l.n;
    const shot = `<div class="land-pic"><span>🏷️</span><b>${other ? `${cm.flag} ${nm(cm)} · ` : ''}${nm(st)}</b><i>${nm(nb)}</i></div>`;
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
      <div class="card gap-top"><p>${t('w_effect_' + w.kind)}</p><p class="muted">🌾 ${t(w.heavy && w.kind === 'rain' ? 'w_farm_heavy' : 'w_farm_' + w.kind)}</p></div>
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
    <div class="con-group"><h4>🏆 ${t('con_trophy')}</h4>
      ${b('simStreak', 'steps10k|1', '👟 ' + t('con_day10k'))}${b('simStreak', 'steps10k|7', '👟 ×7')}${b('simStreak', 'steps20k|7', '⚡ ' + t('con_day20k') + ' ×7')}${b('simStreak', 'rings|7', '⭕ ' + t('con_rings') + ' ×7')}
      ${b('simSport', 1, '🏅 ' + t('con_sport'))}${b('simSport', 10, '🏅 ' + t('con_sport') + ' ×10')}${b('simSport', 50, '🏅 ' + t('con_sport') + ' ×50')}
      <p class="muted">${t('con_trophy_note')}</p></div>
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
  else if (code === 'poor') { snack(t('snack_poor')); Sound.play('oops'); }
  else if (code === 'nopasture') snack(t('no_pasture'));
  else if (code === 'noorchard') snack(t('no_orchard'));
  else if (code === 'full') snack(t('snack_full'));
  else if (code === 'own') snack(t('owned'));
  else if (code === 'max') snack(t('maxed'));
}
function walkDo(tg, o) {
  if (S.live) { snack(t('snack_live_busy')); return false; }
  if (S.work) { snack(`💼 ${t('job_busy', { place: nm(placeInfo(S.work.place)) })}`); return false; }   // v0.14: at work
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
    done: after(() => result(plant(i, crop), () => { Scene.floatField(i, '🌱'); Sound.play('sow'); })) } };
}
function harvestField(i) {
  const r = harvest(i);
  if (!r) return;
  tutDone('harvest');
  Sound.play('harvest');
  Scene.floatField(i, `+${r.n} ${CROPS[r.crop].e}`);
  snack(t('snack_harvest', { n: r.n, e: CROPS[r.crop].e }));
}
function collectFrom(id) {
  const r = collectAnimal(id);
  if (!r) return;
  Sound.play('collect');
  if (r.type === 'baby') { Scene.floatAnimal('me', id, '🍼'); snack(t(r.placed ? 'snack_baby' : 'snack_baby_barn', { name: nm(ANIMALS[r.k].baby) })); }
  else { Scene.floatAnimal('me', id, `+${r.n} ${GOODS[r.k].e}`); snack(t('snack_prod', { n: r.n, e: GOODS[r.k].e })); }
}
function pickTree(i) {
  const r = collectTree(i);
  if (!r) return;
  Sound.play('fruit');
  Scene.floatMe(`+${r.n} ${GOODS[r.k].e}`);
  snack(t('snack_prod', { n: r.n, e: GOODS[r.k].e }));
}
function goFish() {
  if (fishCount() < 1) return snack(t('snack_no_fish'));
  walkDo({ kind: 'pond' }, { pose: 'fish', dur: 2600, done: after(() => {
    const r = catchFish();
    Sound.play('splash');
    if (r) { Scene.floatMe(`+1 ${GOODS[r.k].e}`); snack(t('snack_fish', { e: GOODS[r.k].e, name: nm(GOODS[r.k]) })); }
  }) });
}
// Sneaking at a friend's: walk over crouched, then try.
function sneakDo(tg, fn, pose = 'crouch') {
  const fid = Scene.view().owner;
  if (S.today.chased && S.today.chased[fid]) { Sound.play('oops'); return snack(t('snack_chased', { name: fname(fid) })); }
  if (S.today.steals >= STEAL_CAP) return snack(t('snack_steal_limit', { n: STEAL_CAP }));
  if (actionsLeft() <= 0) return openSheet('cap');
  walkDo(tg, { sneak: true, pose, dur: 900, done: after(fn) });
}
function stealResult(fid, r) {
  if (r.r === 'ok') { const e = r.k.startsWith('baby_') ? ANIMALS[r.k.slice(5)].e : goodE(r.k); Scene.floatMe(`+${r.n} ${e}`); snack(t(r.k.startsWith('baby_') ? 'snack_stole_baby' : 'snack_stole', { n: r.n, e })); Sound.play('sneak'); }
  else if (r.r === 'few') snack(t('snack_baby_few'));
  else if (r.r === 'dog') {
    // caught: the dog barks and chases you out, you pay the owner, and you can't come back today
    Scene.floatMe(`🐕💢 -🪙${r.fine}`); snack(t('snack_dog_fine', { name: fname(fid), n: r.fine }));
    Sound.play('bark'); setTimeout(() => Sound.play('bark'), 700);
    const dog = friendById(fid).animals.find(a => ANIMALS[a.k].guard);
    Scene.flee(dog && dog.id);
  } else if (r.r === 'chased') snack(t('snack_chased', { name: fname(fid) }));
  else if (r.r === 'limit') snack(t('snack_steal_limit', { n: STEAL_CAP }));
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
function goInside() { Sound.play('door'); setLevel(0); if (UI.tab === 'home') UI.inside = true; else UI.visitInside = true; syncView(); refresh(); }
function goOutside() { Sound.play('door'); setLevel(0); if (UI.tab === 'home') UI.inside = false; else UI.visitInside = false; syncView(); refresh(); }
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
    Sound.play('coins');
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
    Sound.play('build');
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
  goHome() { if (cargoUsed()) { unloadCargo(); snack(`📦 ${t('mk_unloaded')}`); } if (UI.visit) leaveHost(UI.visit); UI.visit = null; UI.visitInside = false; UI.wtown = null; setLevel(0); setTab('home'); },
  backTown() { if (UI.visit) leaveHost(UI.visit); UI.visit = null; UI.visitInside = false; setLevel(0); syncView(); },
  // Going somewhere (v0.12). Homes in your own community: choose how to go. Elsewhere in the world: straight there.
  goTo(id) {
    if (id === 'me') return ACT.goHome();
    if (townOf(id) !== myTown() || UI.tab === 'world' && UI.wtown && UI.wtown !== myTown()) return ACT.visit(id);
    closeSheet(); openSheet('go', { id });
  },
  travel(how) {
    const arg = UI.sheet && UI.sheet.arg, a = typeof arg === 'string' ? { place: arg } : arg;
    if (!a) return;
    if (S.work) {   // v0.14: you're at work; leaving means leaving early
      if (!confirm(t('job_leave_q', { n: Math.round(hoursWorked(S.work) * S.work.wage) }))) return;
      const r = quitShift(); snack(`💼 ${t('job_quit_done', { n: r.pay })}`);
    }
    closeSheet();
    const T = goTarget(a), arrive = () => { UI.tripTo = null; if (a.id) ACT.visit(a.id); else if (a.place) { openSheet('place', a.place); arrivedFx(a.place); } refresh(); };
    if (how === 'now' && a.place === 'market') loadCargo(S.me.cars[S.me.car] ? 'car' : 'walk');
    if (how === 'now' && (a.place || a.spot)) {   // straight there: you're standing at the place in town
      if (UI.visit) { leaveHost(UI.visit); UI.visit = null; UI.visitInside = false; setLevel(0); }
      if (UI.tab !== 'town') UI.tab = 'town';
      syncView(); Scene.arriveAt(T.pt, a.place || null);
      return arrive();
    }
    if (how === 'now') return arrive();
    if (UI.visit) { leaveHost(UI.visit); UI.visit = null; UI.visitInside = false; setLevel(0); }
    if (UI.tab !== 'town') UI.tab = 'town';
    syncView();
    const car = how === 'walk' ? null : S.me.cars[S.me.car], kind = !car ? 'walk' : CARS[car.k].kind === 'two' ? 'bike' : 'car';
    UI.tripTo = T.short;
    if (a.place === 'market') { const n = loadCargo(car ? 'car' : 'walk'); snack(n ? `📦 ${t('mk_loaded', { n, cap: carryCap(car ? 'car' : 'walk') })}` : `📦 ${t('mk_nothing')}`); }
    Scene.travel(T.pt, kind, car, arrive, a.id || null, a.place || null);
    if (kind !== 'walk') Sound.play('select');
  },
  tripFast() { Scene.finishTrip(); },
  // v0.16: watch mini-you work out in town
  seeLive() { if (UI.tab !== 'town') { UI.visit = null; UI.tab = 'town'; syncView(); } const p = Scene.liveAt(); if (p) Scene.lookAt(p[0], p[1]); },
  // jobs and the clinic (v0.14)
  jobApply(key) {
    if (S.job && S.job.place !== key && !confirm(t('job_switch_q', { old: nm(JOBS[S.job.place]) }))) return;
    if (takeJob(key) === 'ok') { Sound.play('chime'); snack(`🎉 ${t('job_hired', { job: nm(JOBS[key]) })}`); }
    if (UI.sheet) renderSheet();
  },
  jobStart(key) {
    const r = startShift(key);
    if (r === 'ok') { Sound.play('select'); snack(`💼 ${t('job_started', { to: JOBS[key].to })}`); }
    else if (r === 'closed') snack(t('job_closed', { from: JOBS[key].from, to: JOBS[key].to }));
    if (UI.sheet) renderSheet();
  },
  jobQuit() {
    if (!S.work || !confirm(t('job_leave_q', { n: Math.round(hoursWorked(S.work) * S.work.wage) }))) return;
    const r = quitShift(); snack(`💼 ${t('job_quit_done', { n: r.pay })}`);
    if (UI.sheet) renderSheet();
  },
  buyMed() {
    const r = buyMedicine();
    if (r === 'poor') return snack(t('snack_poor'));
    if (r === 'ok') { Sound.play('collect'); snack(`💊 ${t('sick_med_bought', { n: SICK.restSec })}`); }
    if (UI.sheet) renderSheet();
  },
  placeGo: key => openSheet('place', key),
  // Using a place (you're there)
  placeDo(arg) {
    const [key, act, x] = arg.split('|');
    if (act === 'help') {
      const r = helpHarvest();
      if (r.r === 'nojobs') { closeSheet(); return openSheet('cap'); }
      if (r.r === 'ok') { Sound.play('harvest'); snack(`🌾 ${t('pl_helped', { n: HELP_HARVEST.wheat })}`); if (r.fest) setTimeout(() => { Sound.play('levelup'); snack(`🎉 ${t('pl_fest_now')}`); }, 900); }
    } else if (act === 'bake') { const r = bakeBread(); snack(r === 'ok' ? `🍞 ${t('pl_baked')}` : t('pl_need_wheat', { n: BREAD.wheat })); if (r === 'ok') Sound.play('collect'); }
    else if (act === 'fish') { const r = lakeFish(); if (r.r === 'frozen') return snack(`🧊 ${t('w_frozen')}`); if (r.r === 'nojobs') { closeSheet(); return openSheet('cap'); } if (r.r === 'ok') { Sound.play('collect'); snack(`${GOODS[r.k].e} ${t('pl_caught', { name: nm(GOODS[r.k]) })}`); } }
    else if (act === 'walk') { const n = parkWalk(); Sound.play(n ? 'woof' : 'select'); snack(n ? `🐕 ${t('pl_dog_walked', { n })}` : `🌳 ${t('pl_strolled')}`); }
    else if (act === 'read') { if (readLib() === 'ok') { Sound.play('chime'); snack(`📚 ${t('pl_read_done')}`); } }
    else if (act === 'card') { if (sendPostcard(x) === 'ok') { Sound.play('chime'); snack(`📮 ${t('pl_card_sent', { name: homeName(homeOf(x)), town: nm(COMMUNITIES[myTown()]) })}`); setTimeout(() => { addFeed({ kind: 'msg', from: x, msgKey: 'msg_postcard' }); refresh(); }, 6000); } }
    else if (act === 'sell') { closeSheet(); return openSheet('barn'); }
    else if (act === 'rank') { closeSheet(); return openSheet('ranking'); }
    if (UI.sheet && UI.sheet.type === 'place') renderSheet();
  },
  // House rules (v0.11): ask the owner; they think for a moment and (usually) say yes.
  askHost(id) {
    UI.hostAns = { id, a: 'wait' }; renderSheet();
    setTimeout(() => {
      const a = askHost(id);
      UI.hostAns = { id, a };
      if (a === 'yes') { Sound.play('chime'); Scene.wave(id); snack(`😊 ${t('host_yes_snack', { name: homeName(homeOf(id)) })}`); }
      if (UI.sheet && UI.sheet.type === 'host') renderSheet();
    }, 1100);
  },
  waveHost(id) {
    Scene.wave(id);
    const on = isOnline(id) && !visitingNow(id);
    snack(on ? `👋 ${t('host_waved', { name: homeName(homeOf(id)) })}` : `💤 ${t('host_cant_off', { name: homeName(homeOf(id)) })}`);
  },
  visit(id) { closeSheet(); setLevel(0); if (UI.visit && UI.visit !== id) leaveHost(UI.visit); UI.hostAns = null; if (id === 'me') { setTab('home'); return; } if (UI.tab !== 'world') UI.tab = 'town'; UI.visit = id; UI.visitInside = false; syncView(); },
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
  buySeed(arg) { const [k, n] = arg.split('|'); result(buySeed(k, +n), () => { snack(t('snack_seed', { e: CROPS[k].e, n })); Sound.play('buy'); }); },
  buyTree(k) { result(buyTree(k), () => snack(t('snack_tree', { name: nm(TREES[k]) }))); },
  buyAnimal(k) { result(buyAnimal(k), () => snack(t('snack_animal', { name: nm(ANIMALS[k].baby) }))); },
  buyLand(kind) { result(buyLand(kind), () => snack(t('snack_land_' + kind))); },
  buyItem(arg) {
    const [scope, k] = arg.split('|'), r = buyItem(scope, k);
    if (r.r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    Sound.play('buy');
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
  // Selling happens at the market only (v0.14): what you brought, at the price on the board.
  sell(arg) { if (Scene.here() !== 'market') return ACT.placeGo('market'); const [k, n] = arg.split('|'), v = sellCargo(k, +n); if (v) { Sound.play('coins'); snack(`+🪙${v}`); } },
  sellAll() { if (Scene.here() !== 'market') return ACT.placeGo('market'); const v = sellAllCargo(); if (v) { Sound.play('coins'); snack(t('snack_sold', { n: v })); } },
  carryAnimal(id) {
    const r = cargoAnimal(id);
    if (r === 'full') return snack(`🚗 ${t('mk_full')}`);
    if (r === 'ok') { closeSheet(); snack(`🚚 ${t('mk_animal_on')}`); ACT.placeGo('market'); }
  },
  release(k) { if (releaseBaby(k)) snack(t('snack_baby', { name: nm(ANIMALS[k].baby) })); },
  // design mode
  design() { Scene.startEdit(UI.tab === 'home' && UI.inside ? 'room' : 'yard'); UI.tray = 'items'; },
  editDone() { Scene.stopEdit(); },
  trayTab(x) { UI.tray = x; },
  areaPick(k) { UI.moveArea = k; Scene.select(null); },
  areaCancel() { UI.moveArea = null; },
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
    const [st, p] = arg.split('|'), was = myTown(), r = relocate(st, +p);
    if (r.r === 'poor') return snack(t('snack_poor'));
    if (r.r !== 'ok') return snack(t('land_taken'));
    closeSheet();
    snack((myTown() !== was ? t('snack_moved_town', { town: nm(COMMUNITIES[myTown()]) }) : t('snack_moved_street', { street: nm(streetsOf(myTown())[st]) })) + (r.refund ? ` +🪙${fmtNum(r.refund)}` : ''));
    if (myTown() !== was) Sound.play('chime');
    setLevel(0); UI.visit = null; UI.tab = 'home'; UI.inside = false; Scene.moveHome(); syncView(); Scene.recenter();
  },
  weatherInfo: () => openSheet('weather'),
  toggleMusic() { S.music = S.music === false; Sound.setMusic(S.music !== false); },
  toggleSfx() { S.sfx = S.sfx === false; Sound.setSfx(S.sfx !== false); },
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
    Sound.play('paper');
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
      const a0 = homeOf(h.owner).animals.find(x => x.id === h.id);
      if (a0 && babyStealable(homeOf(h.owner), a0)) return sneakDo({ kind: 'animal', id: h.id }, () => stealResult(h.owner, stealBaby(h.owner, h.id)));   // v0.14: a baby
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
  if (k === 'pet' || (k === 'animal' && mine && isPet(homeOf('me').animals.find(x => x.id === h.id) || { k: '' }))) { UI.pet = h.id; return ACT.pets(); }
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
    else if (h.owner === Scene.view().owner && Scene.view().mode !== 'town') openSheet('host', h.owner);   // the owner, at home
    else if (isFriend(h.owner)) openSheet('friend', h.owner);
    else snack(`👋 ${homeName(homeOf(h.owner))} · ${t('stranger')}`);
    return;
  }
  if (k === 'worldMap') { ACT.world(); return refresh(); }
  if (k === 'shop') return openSheet('place', h.k);   // (clinic is a shop too since v0.14)
  if (k === 'place') return openSheet('place', h.key);
  if (k === 'land') return openSheet('land', { st: h.st, p: h.p, n: h.n, run: h.run });
  if (k === 'buyParcel') return openSheet('land', { st: lotOf('me').st, p: lotOf('me').p + lotOf('me').n, n: 1, next: true });
  if (k === 'furn') {
    const it = shownRoom(homeOf(Scene.view().owner)).items.find(x => x.id === h.id), d = FURN[h.k];
    const sub = d.souv ? `✨ ${t('souv_title')}` : d.use ? t('use_' + d.use) : '';
    const vo = Scene.view().owner;
    if (it && d.use && canUseAt(vo)) Scene.go({ kind: 'furn', id: it.id });
    else if (it && d.use) { tip('furn', h.k, nm(d), `🙏 ${t('ask_first')}`); UI.hostWant = h.k; return openSheet('host', vo); }   // house rules: ask first
    return tip('furn', h.k, nm(d), sub);
  }
  if (k === 'lot') { ACT.goTo(h.owner); return refresh(); }
  if (k === 'spot') { if (VIEW_TOWN !== myTown()) return; closeSheet(); openSheet('go', { spot: [h.x, h.y] }); return refresh(); }   // v0.16: anywhere in town
  if (k === 'emptyLot') return openSheet('invite');
  if (k === 'plaza') return openSheet('place', 'plaza');
  const ed = Scene.getEdit();
  if (!ed) return;
  if (k === 'place') {
    const hd = ed.hold;
    const ok = hd.id ? moveItem(ed.scope, hd.id, h.x, h.y, hd.rot) : placeFromStore(ed.scope, hd.k, h.x, h.y, hd.rot, hd.tint);
    if (ok) { Scene.hold(null); snack(t('snack_placed')); } else snack(t(PLACE_WHY === 'block' ? 'snack_blocks_way' : 'snack_noroom'));
  } else if (k === 'item') Scene.select(h.id);
  else if (k === 'deselect') {
    if (UI.moveArea && h.lx !== undefined) {   // v0.15: put the farm area here (its top-left corner)
      const r = moveArea(UI.moveArea, Math.floor(h.lx), Math.floor(h.ly));
      if (r === 'ok') { Sound.play('select'); snack(`✅ ${t('area_moved', { name: t('area_' + UI.moveArea) })}`); UI.moveArea = null; Scene.dropEnts(); }
      else snack(t(r === 'block' ? 'snack_blocks_way' : 'area_no_room'));
      return refresh();
    }
    Scene.select(null);
  }
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
  obNext() {
    if (OB.step === 0 && !S.account) { UI.login = { step: 'pick' }; return renderLoginInto($('#onboard')); }   // sign in first
    OB.step = Math.min(5, OB.step + 1); renderOnboarding();
  },
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
  applyTheme();
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
  if (!S.account) showLogin();   // players from before v0.8 sign in once
  syncPetReminders();
}

// ================= v0.10: trophies and exclusives =================
const medalsHTML = lv => `<span class="medals">${[0, 1, 2].map(i => `<i style="background:${i < lv ? TROPHY_TIERS[i].col : 'rgba(120,100,70,.18)'}"></i>`).join('')}</span>`;
const sportName = id => nm(SPORT_BY_ID[id]);
// What unlocks an exclusive, in words.
function exclReqText(key) {
  const [a, b] = key.split(':');
  if (a === 'g') { const G = SPORT_GROUPS[b]; return t('excl_req_group', { e: G.e, group: nm(G), n: SPORT_TIERS[2] }); }
  if (a === 'aw') { const A = AWARDS[b]; return t('excl_req_award', { e: A.e, name: nm(A), what: nm(A.desc) }); }
  if (SPORT_BY_ID[a]) { const s = SPORT_BY_ID[a]; return t('excl_req_sport', { e: s.e, name: nm(s), n: SPORT_TIERS[2] }); }
  const T = STREAK_TROPHIES[a];
  return t('excl_req_tier', { e: T.e, name: nm(T), tier: nm(TROPHY_TIERS[+b]), what: nm(T.desc).replace('{n}', T.tiers[+b]) });
}
// The exclusive a trophy tier unlocks (if any).
function exclFor(id, tier) {
  if (STREAK_TROPHIES[id]) return STREAK_TROPHIES[id].excl[tier];
  return tier === 2 ? 'st_' + id : null;   // a sport's gold: its golden statue (and the group's exclusive)
}
const exclKind = k => (YARD[k] ? 'yard' : CARS[k] ? 'car' : PET_BREEDS[k] ? 'pet' : 'animal');
function exclThumb(k, w = 96, h = 80) { const kind = exclKind(k), d = exclDef(kind, k); return kind === 'yard' ? thumbImg('yard', k, {}, w, h, 'thumb sm') : kind === 'car' ? thumbImg('car', k, { color: d.color }, w, h, 'thumb sm') : kind === 'pet' ? thumbImg('pet', k, {}, w, h, 'thumb sm') : thumbImg('animal', k, { stage: 2 }, w, h, 'thumb sm'); }
// Health page: your streaks and the sports you've got trophies in.
function trophyCard() {
  const n = trophyCount(), total = allTrophyIds().length * 3;
  const rows = Object.entries(STREAK_TROPHIES).map(([id, T]) => {
    const lv = trophyLevel(id), cur = streakNow(id), nxt = T.tiers[lv];
    return `<div class="tro-row"><span class="tro-ic">${T.e}</span><div class="grow"><div class="row between"><b>${nm(T)}</b>${medalsHTML(lv)}</div>
      <div class="muted">${nxt ? t('tro_streak_next', { cur, n: nxt, what: nm(T.desc).replace('{n}', nxt) }) : t('tro_maxed')}</div>
      <div class="bar"><i style="width:${nxt ? Math.min(100, cur / nxt * 100) : 100}%"></i></div></div></div>`;
  }).join('');
  const got = SPORTS.filter(s => trophyLevel(s.id) > 0);
  const chips = got.map(s => `<span class="tro-chip" style="--c:${TROPHY_TIERS[trophyLevel(s.id) - 1].col}">${s.e} ${nm(s)}</span>`).join('');
  const aw = awardsOf(), awChips = aw.map(id => `<span class="tro-chip" style="--c:${AWARDS[id].col}">${AWARDS[id].e} ${nm(AWARDS[id])}</span>`).join('');
  return `<div class="card trophy-card"><div class="row between"><h3>🏆 ${t('tro_title')}</h3><button class="btn small" data-act="trophies" data-arg="me">${t('tro_all', { n, total })}</button></div>
    ${rows}<div class="tro-sports">${chips || `<span class="muted">${t('tro_sport_hint', { n: SPORTS.length })}</span>`}</div>
    <div class="sec-title gap-top">🏅 ${t('aw_title', { n: aw.length, total: Object.keys(AWARDS).length })}</div><div class="tro-sports">${awChips || `<span class="muted">${t('aw_hint')}</span>`}</div></div>`;
}
Object.assign(SHEETS, {
  // Anyone's trophies: yours, a friend's, or someone you're visiting anywhere in the world.
  trophies(id) {
    const h = homeOf(id || 'me') || S.me, mine = h === S.me, n = trophyCount(h);
    const exclN = EXCLUSIVES.filter(([kind, k]) => exclOK(exclDef(kind, k).excl, h)).length;
    const streaks = Object.entries(STREAK_TROPHIES).map(([sid, T]) => {
      const lv = trophyLevel(sid, h), v = streakBest(sid, h);
      return `<div class="tro-row"><span class="tro-ic">${T.e}</span><div class="grow"><div class="row between"><b>${nm(T)}</b>${medalsHTML(lv)}</div>
        <div class="muted">${t('tro_best', { n: v })} · ${T.tiers.map((d, i) => `${TROPHY_TIERS[i].e}${d}`).join(' ')}</div>
        ${mine ? `<div class="muted">${T.excl.map((k, i) => `${i < lv ? '🏆' : '🔒'} ${nm(exclDef(exclKind(k), k))}`).join(' · ')}</div>` : ''}</div></div>`;
    }).join('');
    const groups = Object.entries(SPORT_GROUPS).map(([g, G]) => {
      const list = SPORTS.filter(s => s.group === g && (mine || trophyLevel(s.id, h) > 0));
      if (!list.length) return '';
      const tiles = list.map(s => { const lv = trophyLevel(s.id, h), c = sportCount(s.id, h);
        return `<div class="tro-tile ${lv ? 'got' : ''}" style="--c:${lv ? TROPHY_TIERS[lv - 1].col : 'transparent'}"><span>${s.e}</span><b>${nm(s)}</b><i>${lv === 3 ? '🥇' : `${c}/${SPORT_TIERS[lv]}`}</i></div>`; }).join('');
      const unlock = G.excl ? `<span class="muted">${SPORTS.some(s => s.group === g && trophyLevel(s.id, h) >= 3) ? '🏆' : '🔒'} ${nm(YARD[G.excl] || CARS[G.excl])}</span>` : '';
      return `<div class="tro-group"><div class="row between"><b>${G.e} ${nm(G)}</b>${unlock}</div><div class="tro-grid">${tiles}</div></div>`;
    }).join('');
    return `<div class="tro-head">${avatar(h.look, 'xl')}<div class="grow"><h2>${t(mine ? 'tro_mine' : 'tro_theirs', { name: esc(homeName(h)) })}</h2>
        <div class="muted">${t('tro_summary', { n, total: allTrophyIds().length * 3, x: exclN })}</div></div></div>
      ${mine ? '' : `<p class="muted">${t('tro_theirs_note')}</p>`}
      <div class="card">${streaks}</div>
      <div class="sec-title">🏅 ${t('aw_title', { n: awardsOf(h).length, total: Object.keys(AWARDS).length })}</div>
      <div class="tro-grid aw-grid">${Object.entries(AWARDS).filter(([id]) => mine || awardsOf(h).includes(id)).map(([id, A]) => { const got = awardsOf(h).includes(id);
        return `<div class="tro-tile ${got ? 'got' : ''}" style="--c:${got ? A.col : 'transparent'}"><span>${A.e}</span><b>${nm(A)}</b><i>${got ? '✓' : '🔒'}</i></div>`; }).join('') || `<p class="muted">${t('tro_none')}</p>`}</div>
      <div class="sec-title">🏅 ${t('tro_sports', { n: SPORTS.length })}</div>${groups || `<p class="muted">${t('tro_none')}</p>`}
      ${mine ? `<p class="muted center">${t('tro_rule', { a: SPORT_TIERS[0], b: SPORT_TIERS[1], c: SPORT_TIERS[2] })}</p>` : ''}`;
  },
  // A new trophy: a big medal, and what it lets you buy.
  trophyNew(a) {
    if (a.award) {
      const A = AWARDS[a.award], ex = 'aw_' + a.award;
      return `<div class="center tro-new"><div class="tro-medal" style="--c:${A.col}"><span>${A.e}</span></div>
        <div class="souv-new">🏅 ${t('aw_new')}</div><h2>${nm(A)}</h2><p class="muted">${nm(A.desc)}</p>
        <div class="card gap-top tro-unlock">${exclThumb(ex)}<div class="grow"><b>🔓 ${t('tro_unlock')}</b><div>${nm(YARD[ex])}</div><div class="muted">${t('tro_unlock_note')}</div></div></div>
        <button class="btn primary block gap-top" data-act="openShop" data-arg="excl">🏆 ${t('tro_go_shop')}</button>
        <button class="btn block gap-top" data-act="close">${t('souv_ok')}</button></div>`;
    }
    const T = STREAK_TROPHIES[a.id], S2 = SPORT_BY_ID[a.id], tier = TROPHY_TIERS[a.tier], ex = exclFor(a.id, a.tier);
    const name = T ? nm(T) : nm(S2), what = T ? nm(T.desc).replace('{n}', T.tiers[a.tier]) : t('tro_sport_what', { n: SPORT_TIERS[a.tier], name: nm(S2) });
    return `<div class="center tro-new"><div class="tro-medal" style="--c:${tier.col}"><span>${T ? T.e : S2.e}</span></div>
      <div class="souv-new">🏆 ${t('tro_new')}</div><h2>${name} · ${nm(tier)}</h2><p class="muted">${what}</p>
      ${ex ? `<div class="card gap-top tro-unlock">${exclThumb(ex)}<div class="grow"><b>🔓 ${t('tro_unlock')}</b><div>${nm(exclDef(exclKind(ex), ex))}</div><div class="muted">${t('tro_unlock_note')}</div></div></div>
        <button class="btn primary block gap-top" data-act="openShop" data-arg="excl">🏆 ${t('tro_go_shop')}</button>` : ''}
      <button class="btn block gap-top" data-act="close">${t('souv_ok')}</button></div>`;
  },
});
const GROUP_TYPE = { walk: 'walk', run: 'run', cycle: 'cycle', swim: 'swim', hike: 'walk', mind: 'yoga', strength: 'strength', cardio: 'hiit', team: 'hiit', snow: 'hiit', outdoor: 'walk' };
Object.assign(ACT, {
  trophies(id) { openSheet('trophies', id || 'me'); },
  exclAll() { UI.exclAll = true; },
  buyExcl(arg) {
    const [kind, k] = arg.split('|'), d = exclDef(kind, k);
    const r = kind === 'yard' ? buyItem('yard', k).r : kind === 'car' ? buyCar(k) : kind === 'pet' ? adoptPet(k).r : buyAnimal(k);
    if (r === 'locked') return snack(t('excl_locked_snack'));
    if (r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    if (r === 'nopasture' || r === 'full') return snack(t(r === 'full' ? 'pet_full' : 'no_pasture', { n: PET_MAX }));
    if (r !== 'ok') return;
    Sound.play('buy'); setTimeout(() => Sound.play('chime'), 300);
    snack(t('excl_bought', { name: nm(d) }));
    if (kind === 'pet') { const a = myPets().find(x => x.breed === k); if (a) { UI.pet = a.id; ACT.pets(); } }
    save();
  },
  // prototype console: pretend streak days and workouts, to see trophies and exclusives
  simStreak(arg) {
    const [id, n] = arg.split('|'), st = S.stats;
    st['cur_' + id] = (st['cur_' + id] || 0) + +n; st['best_' + id] = Math.max(st['best_' + id] || 0, st['cur_' + id]);
    snack(`${STREAK_TROPHIES[id].e} ${nm(STREAK_TROPHIES[id])} · ${t('tro_best', { n: st['best_' + id] })}`);
  },
  simSport(n) {
    UI.simSport = UI.simSport && Math.random() < 0.5 ? UI.simSport : rand(SPORTS).id;
    const s = SPORT_BY_ID[UI.simSport];
    for (let i = 0; i < +n; i++) addWorkout(GROUP_TYPE[s.group], 20, s.id);
    snack(`${s.e} ${nm(s)} ×${n} · ${t('tro_count', { n: sportCount(s.id) })}`);
  },
});

// ================= v0.9: the world =================
// Every community on a map you can scroll; tap one to see it, look around it, or move your home there.
const WMAP = { w: 1080, h: 384, lat0: 78, lat1: -50 };
const wmapXY = (lon, lat) => [(lon + 180) / 360 * WMAP.w, (WMAP.lat0 - lat) / (WMAP.lat0 - WMAP.lat1) * WMAP.h];
const THEME_E = { maple: '🌳', sakura: '🌸', autumn: '🍁', palm: '🌴', snow: '❄️', desert: '🌵', lavender: '💜', tulip: '🌷', bamboo: '🎋', fjord: '⛰️' };
// Continents, roughly (lon, lat), drawn soft and round like a picture-book map.
const LANDS = [
  [[-168, 66], [-150, 71], [-120, 72], [-95, 70], [-80, 64], [-62, 58], [-55, 50], [-66, 44], [-75, 35], [-81, 25], [-90, 29], [-97, 26], [-105, 20], [-95, 16], [-85, 10], [-79, 8], [-90, 15], [-105, 22], [-112, 30], [-118, 34], [-124, 40], [-125, 48], [-135, 57], [-150, 60], [-160, 58]],
  [[-50, 60], [-42, 60], [-20, 70], [-22, 78], [-45, 78], [-60, 76], [-55, 70]],
  [[-80, 8], [-72, 12], [-60, 8], [-50, 0], [-35, -6], [-38, -15], [-48, -25], [-58, -35], [-65, -42], [-70, -50], [-74, -48], [-72, -40], [-71, -25], [-75, -15], [-80, -5]],
  [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [0, 50], [5, 53], [8, 57], [5, 62], [12, 66], [20, 70], [30, 70], [40, 66], [30, 60], [28, 55], [30, 46], [40, 45], [28, 41], [24, 38], [20, 40], [15, 40], [12, 44], [8, 44], [3, 43], [-5, 36]],
  [[-5, 50], [1, 51], [2, 53], [-2, 57], [-5, 58], [-6, 55], [-3, 54]],
  [[-17, 15], [-17, 21], [-12, 28], [-6, 35], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [44, 0], [40, -15], [35, -25], [20, -35], [17, -29], [12, -17], [13, -6], [9, 4], [0, 5], [-8, 4], [-14, 10]],
  [[30, 70], [60, 72], [90, 76], [120, 73], [140, 72], [160, 70], [178, 66], [170, 60], [160, 55], [142, 46], [135, 35], [128, 38], [122, 30], [120, 22], [108, 20], [105, 10], [100, 13], [98, 8], [100, 2], [104, 1], [98, 16], [93, 22], [88, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 25], [50, 30], [48, 30], [55, 24], [58, 20], [52, 16], [44, 12], [40, 20], [35, 30], [30, 36], [28, 41], [40, 45], [30, 46], [28, 55], [30, 60], [40, 66]],
  [[130, 31], [132, 34], [136, 35], [140, 36], [141, 41], [142, 45], [140, 43], [138, 38], [135, 34]],
  [[113, -22], [115, -34], [124, -34], [132, -31], [138, -35], [146, -39], [150, -37], [153, -28], [146, -19], [142, -11], [136, -12], [130, -12], [125, -15], [120, -19]],
  [[95, 5], [105, -6], [115, -8], [120, -5], [110, 0], [100, 4]], [[140, -3], [150, -6], [145, -9], [138, -7]], [[166, -46], [174, -41], [178, -38], [172, -35], [168, -44]],
];
// Picture-book details on the map: [lon, lat, rx, ry] areas and [lon, lat] spots.
const MAP_DESERTS = [[10, 23, 22, 7], [47, 22, 7, 5], [105, 42, 11, 3.5], [130, -25, 12, 6], [-112, 33, 6, 3], [-70, -24, 2, 7], [22, -23, 6, 4], [72, 27, 4, 3], [60, 40, 7, 3]];
const MAP_FORESTS = [[-62, -5, 13, 8], [22, 0, 8, 5], [100, 60, 38, 6], [-100, 56, 26, 6], [20, 54, 12, 4], [104, 14, 6, 8], [-82, 38, 7, 5], [-123, 47, 3, 6], [145, -32, 4, 5], [138, 37, 2, 4]];
const MAP_PEAKS = [[-120, 52], [-114, 45], [-108, 39], [-117, 58], [-140, 61], [-106, 33], [-70, -12], [-69, -22], [-70, -33], [-72, -42], [-76, 2], [7, 46], [11, 46.5], [14, 47], [43, 42], [80, 31], [86, 28], [91, 29], [96, 30], [74, 36], [70, 38], [102, 34], [138, 36], [37, -3], [30, -28], [146, -36], [60, 60], [100, 52], [-150, 64]];
const MAP_RIVERS = [[[-95, 47], [-91, 40], [-90, 33], [-90, 29]], [[-73, -4], [-62, -3], [-55, -2], [-50, -1]], [[31, 3], [32, 15], [31, 25], [31, 30]], [[95, 33], [105, 30], [112, 30], [121, 31]], [[10, 48], [18, 47], [24, 44], [29, 45]], [[80, 31], [85, 26], [90, 24]], [[100, 50], [104, 58], [105, 66]]];
const MAP_LAKES = [[-84, 45, 5, 2.2], [33, -1, 2.2, 2], [51, 41, 3.5, 4], [-96, 52, 2, 3], [107, 53, 1.2, 3]];
const MAP_SEAS = [[-150, 15, 'sea_pacific'], [170, 10, 'sea_pacific'], [-38, 28, 'sea_atlantic'], [-25, -25, 'sea_atlantic'], [78, -20, 'sea_indian'], [0, 74, 'sea_arctic']];
const MAP_LANDS_LABEL = [[-102, 50, 'reg_na'], [-58, -14, 'reg_sa'], [16, 57, 'reg_eu'], [20, 8, 'reg_af'], [92, 50, 'reg_asia'], [134, -24, 'reg_oc']];
// A smooth closed curve through the midpoints of the points (picture-book coastlines).
function mapShape(path, pts) {
  const Q = pts.map(([lo, la]) => wmapXY(lo, la));
  Q.forEach((p, i) => { const q = Q[(i + 1) % Q.length], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (!i) path.moveTo(m[0], m[1]); else path.quadraticCurveTo(p[0], p[1], m[0], m[1]); });
  const p0 = Q[0], q0 = Q[1 % Q.length];
  path.quadraticCurveTo(p0[0], p0[1], (p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2);
  path.closePath();
  return path;
}
function drawWorldMap(cv) {
  const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1)), g = cv.getContext('2d'), dark = document.body.classList.contains('dark');
  cv.width = WMAP.w * dpr; cv.height = WMAP.h * dpr; g.scale(dpr, dpr);
  const P = (lo, la) => wmapXY(lo, la), kx = WMAP.w / 360, ky = WMAP.h / (WMAP.lat0 - WMAP.lat1);
  // the sea: a grid of latitude and longitude, the equator, little waves
  const sea = g.createLinearGradient(0, 0, 0, WMAP.h);
  sea.addColorStop(0, dark ? '#1e3a56' : '#b9e2f6'); sea.addColorStop(0.5, dark ? '#183049' : '#9fd4ef'); sea.addColorStop(1, dark ? '#142a40' : '#8ccbea');
  g.fillStyle = sea; g.fillRect(0, 0, WMAP.w, WMAP.h);
  g.strokeStyle = dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.3)'; g.lineWidth = 1;
  for (let lon = -150; lon <= 180; lon += 30) { const [x] = P(lon, 0); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, WMAP.h); g.stroke(); }
  for (let lat = 60; lat >= -40; lat -= 20) { const [, y] = P(0, lat); g.beginPath(); g.moveTo(0, y); g.lineTo(WMAP.w, y); g.stroke(); }
  g.setLineDash([6, 6]); g.strokeStyle = dark ? 'rgba(255,220,150,.12)' : 'rgba(255,255,255,.7)';
  const eq = P(0, 0)[1]; g.beginPath(); g.moveTo(0, eq); g.lineTo(WMAP.w, eq); g.stroke(); g.setLineDash([]);
  g.strokeStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.55)'; g.lineWidth = 1.2;
  for (let k = 0; k < 90; k++) { const x = hash(k, 1) * WMAP.w, y = hash(k, 2) * WMAP.h; g.beginPath(); g.arc(x, y, 4, Math.PI * 1.15, Math.PI * 1.85); g.moveTo(x + 7 + 4 * Math.cos(Math.PI * 1.15), y + 4 * Math.sin(Math.PI * 1.15)); g.arc(x + 7, y, 4, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  const lands = new Path2D();
  LANDS.forEach(pts => mapShape(lands, pts));
  // shallow water along the coasts, a shadow under the land, then the land itself
  g.strokeStyle = dark ? 'rgba(90,150,190,.25)' : 'rgba(255,255,255,.55)'; g.lineWidth = 14; g.lineJoin = 'round'; g.stroke(lands);
  g.save(); g.translate(0, 5); g.fillStyle = dark ? 'rgba(0,0,0,.35)' : 'rgba(40,90,120,.2)'; g.fill(lands); g.restore();
  const land = g.createLinearGradient(0, 0, 0, WMAP.h);
  land.addColorStop(0, dark ? '#4a6248' : '#d4e6ad'); land.addColorStop(0.45, dark ? '#3c5a3a' : '#b4da86'); land.addColorStop(1, dark ? '#3a5638' : '#a9d47e');
  g.fillStyle = land; g.fill(lands);
  // everything below stays on the land
  g.save(); g.clip(lands);
  const icy = P(0, 57)[1], ice = g.createLinearGradient(0, 0, 0, icy);
  ice.addColorStop(0, dark ? 'rgba(220,230,240,.5)' : 'rgba(255,255,255,.95)'); ice.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = ice; g.fillRect(0, 0, WMAP.w, icy);
  MAP_DESERTS.forEach(([lo, la, rx, ry]) => {   // sand with little dunes
    const [x, y] = P(lo, la), R = rx * kx;
    g.save(); g.translate(x, y); g.scale(1, ry * ky / R);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, dark ? 'rgba(170,140,80,.9)' : 'rgba(240,214,150,.95)'); gr.addColorStop(1, 'rgba(240,214,150,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill(); g.restore();
    g.strokeStyle = 'rgba(190,150,80,.5)'; g.lineWidth = 1;
    for (let k = 0; k < rx; k++) { const dx = (hash(k, lo) - 0.5) * R * 1.2, dy = (hash(k, la) - 0.5) * ry * ky * 1.2; g.beginPath(); g.arc(x + dx, y + dy + 3, 4, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  });
  MAP_FORESTS.forEach(([lo, la, rx, ry], fi) => {   // lots of little round trees
    const [x, y] = P(lo, la), n = Math.round(rx * ry * 1.6);
    for (let k = 0; k < n; k++) {
      const a = hash(k, fi * 7) * Math.PI * 2, r = Math.sqrt(hash(k, fi * 7 + 1)), tx = x + Math.cos(a) * r * rx * kx, ty = y + Math.sin(a) * r * ry * ky;
      g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(tx + 1, ty + 3, 3, 1.4, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = k % 3 ? (dark ? '#2d5a33' : '#5fa356') : (dark ? '#25502b' : '#4f9448'); g.beginPath(); g.arc(tx, ty, 3.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(tx - 1, ty - 1, 1.2, 0, Math.PI * 2); g.fill();
    }
  });
  g.strokeStyle = dark ? '#3f6f95' : '#7cc3ea'; g.lineWidth = 2; g.lineCap = 'round';   // rivers and lakes
  MAP_RIVERS.forEach(r => {
    const Q = r.map(([lo, la]) => P(lo, la));
    g.beginPath(); g.moveTo(Q[0][0], Q[0][1]);
    for (let i = 1; i < Q.length; i++) { const m = [(Q[i - 1][0] + Q[i][0]) / 2, (Q[i - 1][1] + Q[i][1]) / 2]; g.quadraticCurveTo(Q[i - 1][0], Q[i - 1][1], m[0], m[1]); }
    g.lineTo(Q[Q.length - 1][0], Q[Q.length - 1][1]); g.stroke();
  });
  g.fillStyle = dark ? '#3f6f95' : '#8fd0f0';
  MAP_LAKES.forEach(([lo, la, rx, ry]) => { const [x, y] = P(lo, la); g.beginPath(); g.ellipse(x, y, rx * kx, ry * ky, 0, 0, Math.PI * 2); g.fill(); });
  MAP_PEAKS.forEach(([lo, la]) => {   // rocky peaks with snowy tops, three together
    const [x, y] = P(lo, la);
    [[-6, 2, 0.8], [0, 0, 1], [6, 3, 0.75]].forEach(([dx, dy, k]) => {
      const px = x + dx, py = y + dy, hh = 13 * k, ww = 9 * k;
      g.fillStyle = dark ? '#6a6f68' : '#9a9f8e'; g.beginPath(); g.moveTo(px - ww, py + 4); g.lineTo(px, py + 4 - hh); g.lineTo(px + ww, py + 4); g.closePath(); g.fill();
      g.fillStyle = dark ? '#565b55' : '#80866f'; g.beginPath(); g.moveTo(px, py + 4 - hh); g.lineTo(px + ww, py + 4); g.lineTo(px + ww * 0.15, py + 4); g.closePath(); g.fill();
      g.fillStyle = '#f7fafb'; g.beginPath(); g.moveTo(px - ww * 0.36, py + 4 - hh * 0.62); g.lineTo(px, py + 4 - hh); g.lineTo(px + ww * 0.36, py + 4 - hh * 0.62); g.lineTo(px + ww * 0.1, py + 4 - hh * 0.55); g.closePath(); g.fill();
    });
  });
  g.restore();
  g.strokeStyle = dark ? '#5d8455' : '#f7f1d8'; g.lineWidth = 2.2; g.stroke(lands);   // coastline
  g.textAlign = 'center'; g.textBaseline = 'middle';   // names of the oceans and the continents
  MAP_SEAS.forEach(([lo, la, key]) => { const [x, y] = P(lo, la); g.font = `italic 700 13px ${UI_FONT}`; g.fillStyle = dark ? 'rgba(200,225,245,.45)' : 'rgba(40,110,160,.5)'; g.fillText(t(key), x, y); });
  MAP_LANDS_LABEL.forEach(([lo, la, key]) => {
    const [x, y] = P(lo, la);
    g.font = `800 12px ${UI_FONT}`; g.lineWidth = 3; g.strokeStyle = dark ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.85)'; g.strokeText(t(key), x, y);
    g.fillStyle = dark ? '#e3dccd' : '#5d5448'; g.fillText(t(key), x, y);
  });
  [[-40, 40], [-140, -10], [70, -5], [160, 25], [-20, -40]].forEach(([lo, la], i) => {   // little ships with wakes
    const [x, y] = P(lo, la);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 6, y + 3); g.lineTo(x - 18, y + 1); g.moveTo(x - 6, y + 5); g.lineTo(x - 16, y + 7); g.stroke();
    g.fillStyle = '#6b4a2e'; g.beginPath(); g.moveTo(x - 7, y + 2); g.lineTo(x + 7, y + 2); g.lineTo(x + 4, y + 6); g.lineTo(x - 5, y + 6); g.closePath(); g.fill();
    g.fillStyle = '#fffaf0'; g.beginPath(); g.moveTo(x - 1, y + 1); g.lineTo(x - 1, y - 9); g.lineTo(x + 5, y + 1); g.closePath(); g.fill();
    g.fillStyle = i % 2 ? '#e5484d' : '#3f6fb5'; g.fillRect(x - 1, y - 11, 4, 2);
  });
  // night where the sun is down right now (soft at the edge), and a little sun where it's noon
  const nowD = new Date(), y0 = Date.UTC(nowD.getUTCFullYear(), 0, 0), doy = (nowD.getTime() - y0) / DAY, utcH = nowD.getUTCHours() + nowD.getUTCMinutes() / 60;
  const dec = -23.44 * Math.cos(2 * Math.PI / 365 * (doy + 10)) * Math.PI / 180, subLon = (12 - utcH) * 15, rad = Math.PI / 180, cell = 6;
  for (let x = 0; x < WMAP.w; x += cell) for (let y = 0; y < WMAP.h; y += cell) {
    const lon = (x + cell / 2) / WMAP.w * 360 - 180, lat = WMAP.lat0 - (y + cell / 2) / WMAP.h * (WMAP.lat0 - WMAP.lat1);
    const s = Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos((lon - subLon) * rad);
    const a = Math.max(0, Math.min(1, (0.08 - s) / 0.16));
    if (a > 0) { g.fillStyle = `rgba(12,20,60,${(a * (dark ? 0.3 : 0.26)).toFixed(3)})`; g.fillRect(x, y, cell, cell); }
  }
  { const sx = ((subLon + 540) % 360) / 360 * WMAP.w, [, sy] = P(0, dec / rad); g.font = `22px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☀️', sx, sy); }
  const cxp = 44, cyp = WMAP.h - 44;   // compass rose
  g.fillStyle = dark ? 'rgba(38,34,30,.75)' : 'rgba(255,253,248,.85)'; g.beginPath(); g.arc(cxp, cyp, 26, 0, Math.PI * 2); g.fill();
  [[0, -1, '#e5484d'], [0, 1, '#8b8274'], [1, 0, '#8b8274'], [-1, 0, '#8b8274']].forEach(([dx, dy, col]) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(cxp + dx * 20, cyp + dy * 20); g.lineTo(cxp - dy * 5, cyp + dx * 5); g.lineTo(cxp + dy * 5, cyp - dx * 5); g.closePath(); g.fill();
  });
  g.fillStyle = dark ? '#f2ece3' : '#3b3125'; g.font = `800 10px ${UI_FONT}`; g.fillText('N', cxp, cyp - 26 + 5);
}
function panelWorld() {
  const mine = myTown(), sel = COMMUNITIES[UI.wsel] ? UI.wsel : mine, cm = COMMUNITIES[sel], here = sel === mine;
  const friendsIn = id => S.friends.filter(f => townOf(f.id) === id).length;
  const reg = UI.wregion, inReg = id => !reg || COMMUNITIES[id].region === reg;
  const chips = `<div class="sub-cats one-row">${Object.entries(REGIONS).map(([r, R]) => `<button class="sub ${reg === r ? 'on' : ''}" data-act="worldRegion" data-arg="${r}">${R.e} ${nm(R)}</button>`).join('')}</div>`;
  const pins = Object.entries(COMMUNITIES).map(([id, c]) => {
    const [x, y] = wmapXY(c.lon, c.lat);
    return `<button class="wpin ${id === sel ? 'on' : ''} ${id === mine ? 'home' : ''}" style="left:${x}px;top:${y}px" data-act="worldPick" data-arg="${id}">
      <span class="wpin-dot"><i>${id === mine ? '🏡' : THEME_E[c.theme]}</i></span>${id === sel || id === mine ? `<span class="wpin-name">${nm(c)}</span>` : ''}</button>`;
  }).join('');
  const free = id => vacantRuns(id).filter(r => r.n >= CORE_PARCELS).length;
  const nf = friendsIn(sel), parcel = round50(LAND.parcel * NEIGHBORHOODS.maple.price * cm.price);
  const card = `<div class="card world-card"><div class="row">${thumbImg('commune', sel, {}, 96, 84, 'thumb sm')}
      <div class="grow"><div class="world-name">${cm.flag} ${nm(cm)} ${here ? `<span class="tag ok">${t('world_here')}</span>` : ''}</div>
        <div class="muted">${nm(cm.place)} · ${THEME_E[cm.theme]} ${t('theme_' + cm.theme)} · ${isNightIn(sel) ? '🌙' : '☀️'} ${t('local_time', { t: localClock(sel) })}</div>
        <div class="world-stats"><span>👥 ${t('world_pop', { n: fmtNum(cm.pop + (here ? 1 : 0)) })}</span><span>🏷️ ${t('world_parcel', { n: fmtNum(parcel) })}</span><span>🌱 ${t('world_free', { n: free(sel) })}</span>${nf ? `<span>💛 ${t('world_friends', { n: nf })}</span>` : ''}</div></div></div>
    <div class="row gap-top">${here ? `<button class="btn primary grow" data-act="worldVisit" data-arg="${sel}">🏘️ ${t('world_my_town')}</button>`
      : `<button class="btn grow" data-act="worldVisit" data-arg="${sel}">👀 ${t('world_visit')}</button><button class="btn primary grow" data-act="worldMove" data-arg="${sel}">🚚 ${t('world_move')}</button>`}</div></div>`;
  const list = Object.entries(COMMUNITIES).filter(([id]) => inReg(id)).sort((a, b) => (b[0] === mine) - (a[0] === mine) || b[1].pop - a[1].pop).map(([id, c]) =>
    `<button class="list-item world-row ${id === sel ? 'on' : ''}" data-act="worldPick" data-arg="${id}"><span class="big-emoji">${c.flag}</span>
      <div class="grow"><b>${nm(c)}</b> ${id === mine ? '🏡' : ''}<div class="muted">${nm(c.place)} · ${isNightIn(id) ? '🌙' : '☀️'} ${localClock(id)} · 👥 ${fmtNum(c.pop)} · <span class="online-dot"></span>${onlineIn(id)}</div></div><span class="muted">×${c.price}</span></button>`).join('');
  return `<div class="world-head"><h1 class="panel-title">🌍 ${t('world_title')}</h1><span class="muted"><span class="online-dot"></span>${t('online_world', { n: fmtNum(Object.keys(COMMUNITIES).reduce((a, id) => a + onlineIn(id), 0)) })}</span></div>
    <p class="muted note">${t('world_sub')}</p>${chips}
    <div class="wmap-scroll"><div class="wmap" style="width:${WMAP.w}px;height:${WMAP.h}px"><canvas id="worldCanvas" style="width:${WMAP.w}px;height:${WMAP.h}px"></canvas>${pins}</div></div>
    ${card}
    <div class="card"><h3>🗺️ ${t('world_all')}</h3>${list}</div>
    <p class="muted center">${t('world_note')}</p>`;
}
// Where a trip goes: a home's gate or a public place (its name for the card and the context bar).
function goTarget(a) {
  if (a.spot) return { e: '📍', name: t('go_here'), short: t('go_here_short'), pt: a.spot };
  if (a.place) { const P = placeInfo(a.place); return { e: P.e, name: nm(P), short: nm(P), pt: Scene.placePoint(a.place) }; }
  const h = homeOf(a.id);
  return { e: '🏡', name: t('home_of', { name: homeName(h) }), short: t('home_of', { name: homeName(h) }), pt: Scene.gate(a.id) };
}
// Walk / drive (or ride) / straight there, with how long each takes.
function goTiles(T) {
  const car = S.me.cars[S.me.car], two = car && CARS[car.k].kind === 'two';
  const tile = (how, ic, label, sub, on = true) => `<button class="act-tile" data-act="travel" data-arg="${how}" ${on ? '' : 'disabled'}><span>${ic}</span><b>${label}</b><i>${sub}</i></button>`;
  const secs = how => t('go_secs', { n: Scene.tripTime(T.pt, how) });
  return `<div class="act-grid three">
    ${tile('walk', '🚶', t('go_walk'), secs('walk'))}
    ${car ? tile('car', two ? '🚲' : '🚗', t(two ? 'go_ride' : 'go_drive'), secs(two ? 'bike' : 'car')) : tile('car', '🚗', t('go_drive'), t('go_no_car'), false)}
    ${tile('now', '⚡', t('go_now'), t('go_now_sub'))}
  </div>`;
}
// The market's board (v0.14): every price right now, how it moved, and (when you're there) what you brought to sell.
function trendArrow(k) {
  const tr = priceTrend(k), a = tr[tr.length - 2], b = tr[tr.length - 1], pct = a ? Math.round((b - a) / a * 100) : 0;
  return pct > 0 ? `<span class="up">▲${pct}%</span>` : pct < 0 ? `<span class="down">▼${-pct}%</span>` : `<span class="muted">—</span>`;
}
function sparkline(k) {
  const tr = priceTrend(k), lo = Math.min(...tr), hi = Math.max(...tr), w = 56, h = 18;
  const pts = tr.map((v, i) => `${(i / (tr.length - 1) * w).toFixed(1)},${(h - 2 - (hi > lo ? (v - lo) / (hi - lo) : 0.5) * (h - 4)).toFixed(1)}`).join(' ');
  const up = tr[tr.length - 1] >= tr[tr.length - 2];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${up ? '#3dbb62' : '#e5484d'}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
function marketBody(here) {
  const c = cargo(), all = [...Object.keys(CROPS).filter(k => !CROPS[k].rare), ...Object.keys(GOODS)];
  const mine = new Set([...Object.keys(S.me.barn), ...Object.keys(c.items)]);
  const rows = all.filter(k => mine.has(k)).concat(all.filter(k => !mine.has(k)).slice(0, mine.size ? 6 : 12)).map(k => {
    const b = barnInfo(k);
    return `<div class="board-row"><span class="be">${b.e}</span><b class="grow">${b.name}</b>${sparkline(k)}<span class="bp">🪙${marketPrice(k)}</span>${trendArrow(k)}</div>`;
  }).join('');
  const next = Math.max(1, Math.round(((priceSlot() + 1) * MARKET.slotHours * HOUR - now()) / MIN));
  const board = `<div class="card board"><div class="row between"><b>📋 ${t('mk_board')}</b><span class="muted small">${t('mk_next', { m: fmtDur(next * MIN) })}</span></div>${rows}</div>`;
  if (!here) return board;
  const lines = Object.entries(c.items).map(([k, n]) => { const b = barnInfo(k), p = marketPrice(k);
    return `<div class="list-item"><span class="big-emoji">${b.e}</span><div class="grow"><b>${b.name}</b> <span class="muted">×${n}</span><div class="cost">🪙${p} ${trendArrow(k)}</div></div>
      ${buyBtn('sell', k + '|1', t('sell_one'), true, '')}${buyBtn('sell', k + '|' + n, `🪙${fmtNum(p * n)}`, true)}</div>`; })
    .concat(c.animals.map(a => { const p = marketPrice('animal_' + a.k + '_' + animalStage(a));
      return `<div class="list-item"><span class="big-emoji">${ANIMALS[a.k].e}</span><div class="grow"><b>${animalName(a)}</b><div class="cost">🪙${p}</div></div>${buyBtn('sell', 'animal:' + a.id + '|1', `🪙${fmtNum(p)}`, true)}</div>`; })).join('');
  return `<div class="card"><div class="row between"><b>📦 ${t('mk_cargo', { n: cargoUsed(), cap: c.cap || WALK_CARRY })}</b>${lines ? `<button class="btn small primary" data-act="sellAll">${t('mk_sell_all')}</button>` : ''}</div>
    ${lines || `<p class="muted">${t('mk_empty_load')}</p>`}</div>${board}`;
}
// The lake is a beach in towns by the sea.
const placeInfo = key => (key === 'lake' && layoutOf(VIEW_TOWN).lake.sea ? PLACE_INFO.beach : PLACE_INFO[key]);
// A little sound when you get there.
function arrivedFx(key) { Sound.play(key === 'park' ? 'woof' : key === 'lake' ? 'tick' : 'select'); }
// What you can do at a place (you're there).
// A job at this place (v0.14): apply, start a shift during the hours, or see how your shift is going.
function jobSection(key) {
  const J = JOBS[key];
  if (!J) return '';
  const mine = S.job && S.job.place === key, w = S.work && S.work.place === key, rank = mine ? jobRank() : 0, R = JOB_RANKS[rank], next = JOB_RANKS[rank + 1];
  const head = `<div class="row between"><b>💼 ${nm(J)}${mine ? ` · ${nm(R)}` : ''}</b><span class="muted">🪙${jobWage(key)}/${t('job_hour')} · ${J.from}:00–${J.to}:00</span></div>`;
  let body;
  if (w) {
    const pct = Math.round(Math.min(1, (now() - S.work.start) / (S.work.end - S.work.start)) * 100), sofar = Math.round(hoursWorked(S.work) * S.work.wage);
    body = `<p>${t('job_working', { m: fmtDur(S.work.end - now()), n: sofar, full: Math.round((S.work.end - S.work.start) / HOUR * S.work.wage) })}</p><div class="bar"><i style="width:${pct}%"></i></div>
      <button class="btn block gap-top" data-act="jobQuit">🚪 ${t('job_quit', { n: sofar })}</button>`;
  } else if (!mine) body = `<p class="muted">${t(S.job ? 'job_switch_note' : 'job_apply_note')}</p><button class="btn primary block" data-act="jobApply" data-arg="${key}">✍️ ${t('job_apply')}</button>`;
  else if (inShift(key)) body = `<button class="btn primary block" data-act="jobStart" data-arg="${key}">💼 ${t('job_start', { to: J.to, n: Math.round((shiftEnd(key) - now()) / HOUR * jobWage(key)) })}</button>`;
  else body = `<p class="muted">${t('job_closed', { from: J.from, to: J.to })}</p>`;
  const rel = mine ? `<div class="muted small">${t('job_rel', { n: S.job.rel })}${next ? ' · ' + t('job_next', { rank: nm(next), n: next.at }) : ''}</div><div class="bar warm"><i style="width:${S.job.rel}%"></i></div>` : '';
  return `<div class="card job-card">${head}${rel}${body}</div>`;
}
function placeBody(key) {
  const P = placeDay(), btn = (act, label, on = true, x = '') => `<button class="btn ${on ? 'primary' : ''} block" data-act="placeDo" data-arg="${key}|${act}|${x}" ${on ? '' : 'disabled'}>${label}</button>`;
  if (key === 'fields') {
    const n = harvestCount(), pct = Math.round(n / HARVEST_GOAL * 100);
    return `<div class="card"><div class="row between"><b>🌾 ${t('pl_harvest_today')}</b><span>${n} / ${HARVEST_GOAL}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
      <p class="muted">${n >= HARVEST_GOAL ? `🎉 ${t('pl_fest')}` : t('pl_harvest_note')}</p></div>
      ${btn('help', P.harvest ? `✅ ${t('pl_helped_today')}` : `🌾 ${t('pl_help', { n: HELP_HARVEST.wheat })}`, !P.harvest)}`;
  }
  if (key === 'park') {
    const dogs = myPets(S.me).filter(a => a.k === 'dog').length;
    return `<p>${t('pl_park_people', { n: Math.max(2, Math.round(onlineIn(VIEW_TOWN) * 0.04)) })}</p>${btn('walk', dogs ? `🐕 ${t('pl_walk_dog')}` : `🚶 ${t('pl_stroll')}`, !(dogs && P.park))}`;
  }
  if (key === 'lake') return btn('fish', P.fish ? `✅ ${t('pl_fished')}` : `🎣 ${t('pl_fish')}`, !P.fish) + `<p class="muted small">${t('pl_swim_note')}</p>`;
  if (key === 'bakery') return jobSection(key) + `<p>${t('pl_bake_note', { n: BREAD.wheat, have: S.me.barn.wheat || 0, bread: S.me.barn.bread || 0 })}</p>${btn('bake', `🍞 ${t('pl_bake')}`, (S.me.barn.wheat || 0) >= BREAD.wheat)}`;
  if (key === 'library') {
    const c = libCard();
    return jobSection(key) + `<div class="card lib-card"><div class="sec-title">📖 ${t('pl_card_today')}</div><p class="lib-text">${nm(c)}</p></div>
      ${btn('read', P.lib ? `✅ ${t('pl_read')}` : `📖 ${t('pl_read_it')}`, !P.lib)}<p class="muted small center">${t('pl_read_n', { n: S.stats.libRead || 0 })}</p>`;
  }
  if (key === 'post') {
    const fr = S.friends.filter(f => lotOf(f.id));
    return jobSection(key) + `<p>${t('pl_post_note', { town: nm(COMMUNITIES[myTown()]) })}</p><div class="card">${fr.map(f => `<div class="list-item">${avatar(f.look)}<div class="grow"><b>${esc(homeName(f))}</b></div>
      ${P.cards[f.id] ? `<span class="tag ok">${t('pl_sent')}</span>` : `<button class="btn small primary" data-act="placeDo" data-arg="post|card|${f.id}">📮 ${t('pl_send')}</button>`}</div>`).join('') || `<p class="muted">${t('pl_no_friends')}</p>`}</div>`;
  }
  if (key === 'cafe') {
    const ids = allLots(VIEW_TOWN).map(l => l.id).filter(id => id !== 'me' && homeOf(id) && isOnline(id)).sort((a, b) => isFriend(b) - isFriend(a)).slice(0, 8);
    return jobSection(key) + `<p>${t('pl_cafe_note')}</p><div class="card">${ids.map(id => { const h = homeOf(id), at = visitingNow(id);
      return `<div class="list-item">${avatar(h.look)}<div class="grow"><b>${esc(homeName(h))}</b> ${isFriend(id) ? '💛' : ''}<div class="muted"><span class="online-dot"></span>${at ? t('host_away', { name: esc(homeName(homeOf(at))) }) : t('host_home')}</div></div>
        <button class="btn small" data-act="goTo" data-arg="${at || id}">${t('visit')}</button></div>`; }).join('') || `<p class="muted">${t('pl_nobody')}</p>`}</div>`;
  }
  if (key === 'market') return marketBody(true) + jobSection(key);
  if (key === 'clinic') {
    const s = S.sick, med = s && s.med;
    return `<p>${s ? t('sick_here', { why: t('sick_why_' + (s.why || 'cold')) }) : t('sick_well')}</p>
      ${s ? (med ? `<p class="host-say yes">💊 ${t('sick_med_have', { n: SICK.restSec })}</p>` : `<button class="btn primary block" data-act="buyMed">💊 ${t('sick_buy', { n: SICK.medicine })}</button>`) : ''}${jobSection(key)}`;
  }
  if (key === 'gym') return `<p>${t('pl_gym_note')}</p><p class="muted">${t('pl_gym_people', { n: Math.max(1, Math.round(onlineIn(VIEW_TOWN) * 0.02)) })}</p>` + jobSection(key);
  if (key === 'plaza') return `<p>${t('pl_plaza_note', { lv: townLevel() })}</p>${btn('rank', `🏆 ${t('fab_rank')}`)}`;
  return '';
}
// How many people are online in a community right now (made up for the prototype; slowly changes through the day).
// Most people are online in their evening and hardly anyone in the middle of their night (local time).
function onlineIn(id) {
  const c = COMMUNITIES[id], hr = localHour(id), day = hr >= 7 && hr < 23.5 ? Math.sin((hr - 7) / 16.5 * Math.PI) : 0;
  return Math.max(3, Math.round(c.pop * (0.012 + 0.07 * day * (0.6 + 0.4 * Math.min(1, (hr - 7) / 12)))));
}
// After the world panel is drawn: paint the map and scroll to the community you picked (or keep where you were).
function afterWorld(wx) {
  const cv = $('#worldCanvas');
  if (!cv) return;
  drawWorldMap(cv);
  const sc = $('.wmap-scroll'), c = COMMUNITIES[UI.wsel] || COMMUNITIES[myTown()];
  if (UI.wscroll) { const [x] = wmapXY(c.lon, c.lat); sc.scrollLeft = x - sc.clientWidth / 2; UI.wscroll = false; }
  else if (wx != null) sc.scrollLeft = wx;
}
Object.assign(ACT, {
  world() { closeSheet(); UI.wtown = null; UI.visit = null; UI.visitInside = false; UI.wsel = UI.wsel || myTown(); UI.wscroll = true; setTab('world'); },
  worldMap() { UI.wtown = null; UI.visit = null; UI.visitInside = false; setLevel(0); UI.wscroll = true; syncView(); },
  worldPick(id) { UI.wsel = id; UI.wscroll = true; },
  worldRegion(r) { UI.wregion = UI.wregion === r ? null : r; const c = Object.keys(COMMUNITIES).find(id => COMMUNITIES[id].region === r); if (c && UI.wregion) UI.wsel = c; UI.wscroll = true; },
  // look around a community (your own one is the Town tab)
  worldVisit(id) {
    if (id === myTown()) return setTab('town');
    UI.tab = 'world'; UI.wtown = id; UI.visit = null; UI.visitInside = false; setLevel(0); syncView(); Scene.recenter();
  },
  worldMove(id) { ACT.worldVisit(id); setTimeout(() => snack(t('world_pick_land')), 400); },
});

// ================= v0.8 =================
// ---------- light / dark ----------
const darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function applyTheme() {
  const dark = !!S && (S.theme === 'dark' || (S.theme !== 'light' && !!darkMQ && darkMQ.matches));
  document.body.classList.toggle('dark', dark);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = dark ? '#1c1916' : '#f6f1e7';
}
if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener('change', applyTheme);

// ---------- signing in: Apple, Google or email ----------
// In the iPhone app, Apple sign-in goes through the Swift shell (window.onNativeSignIn). Google and email need our
// server (not built yet), so the prototype signs you in with a stand-in account and says so in Settings.
const GOOGLE_G = '<svg class="glyph" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const APPLE_LOGO = '<svg class="glyph" viewBox="0 0 24 24"><path fill="currentColor" d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 6.9 1.2 9.2.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.2-2.6 0 0-2.4-.9-2.4-3.8zM14.1 5.9c.6-.8 1.1-1.8.9-2.9-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.8 1.1.1 2.1-.5 2.8-1.3z"/></svg>';
function loginHTML() {
  const L = UI.login || { step: 'pick' }, err = L.err ? `<p class="login-err">${t(L.err)}</p>` : '';
  if (L.busy) return `<div class="ob-card login-card center"><div class="login-hero spin">🏡</div><h2>${t('login_busy')}</h2></div>`;
  if (L.step === 'email') return `<div class="ob-card login-card"><h2>✉️ ${t('login_email_title')}</h2>
    <input id="loginEmail" class="input" type="email" inputmode="email" autocomplete="email" placeholder="${t('login_email_ph')}" value="${esc(L.email || '')}">${err}
    <button class="btn primary big block" data-act="loginSend">${t('login_send')}</button>
    <button class="btn block" data-act="loginBack">${t('login_back')}</button></div>`;
  if (L.step === 'code') return `<div class="ob-card login-card"><h2>🔢 ${t('login_code_title')}</h2><p class="ob-sub">${t('login_code_sub', { email: esc(L.email) })}</p>
    <input id="loginCode" class="input code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="${t('login_code_ph')}" value="${esc(L.code || '')}">${err}
    <p class="login-note">${t('login_proto')}</p>
    <button class="btn primary big block" data-act="loginVerify">${t('login_verify')}</button>
    <button class="btn block" data-act="loginBack">${t('login_back')}</button></div>`;
  return `<div class="ob-card login-card"><div class="login-hero">🏡</div><h2>${t('login_title')}</h2><p class="ob-sub">${t('login_sub')}</p>
    <button class="btn login apple" data-act="signIn" data-arg="apple">${APPLE_LOGO}${t('login_apple')}</button>
    <button class="btn login google" data-act="signIn" data-arg="google">${GOOGLE_G}${t('login_google')}</button>
    <button class="btn login email" data-act="loginEmail"><span class="glyph">✉️</span>${t('login_email')}</button>
    <p class="login-note">${t('login_terms')}</p></div>`;
}
function renderLoginInto(el) {
  el.hidden = false;
  el.className = 'onboard ob-login';
  const langs = OB ? `<div class="ob-lang"><button class="chip ${OB.lang === 'zh' ? 'on' : ''}" data-act="obLang" data-arg="zh">中文</button>
    <button class="chip ${OB.lang === 'en' ? 'on' : ''}" data-act="obLang" data-arg="en">English</button></div>` : '';
  el.innerHTML = `<div class="ob-top">${langs}</div>${loginHTML()}`;
  const inp = $('#loginEmail') || $('#loginCode');
  if (inp) setTimeout(() => inp.focus(), 50);
}
function showLogin() {
  UI.login = { step: 'pick' };
  document.body.classList.add('ob-mode');
  Scene.setView('town', 'me'); Scene.attract(0.42);
  renderLoginInto($('#onboard'));
}
function finishLogin(acc) {
  clearTimeout(UI.loginWait);
  if (!S || !UI.login) return;
  S.account = { ...acc, at: Date.now() };
  UI.login = null;
  save();
  Sound.play('chime');
  if (OB) { if (acc.name && !OB.name) OB.name = acc.name; OB.step = 1; renderOnboarding(); return; }   // carry on with the intro
  const el = $('#onboard');
  el.hidden = true; el.innerHTML = '';
  document.body.classList.remove('ob-mode');
  Scene.attract(false);
  syncView(); refresh();
  snack(t('login_ok'));
}
window.onNativeSignIn = d => {
  d = typeof d === 'string' ? JSON.parse(d) : d || {};
  if (d.ok) return finishLogin({ provider: 'apple', id: d.id, email: d.email || '', name: d.name || '' });
  snack(t('login_native_fail'));
  finishLogin({ provider: 'apple', id: 'sim-' + uid(), email: '', sim: true });
};
const reLogin = () => renderLoginInto($('#onboard'));

// ---------- pets ----------
const petAlertCount = () => (S ? myPets().filter(a => petAsks(a).length).length : 0);
const petAskText = (name, kind, need) => t(need === 'clean' ? 'pet_ask_clean_' + kind : 'pet_ask_' + need, { name: esc(name) });
let petSyncAt = 0, petAnim = null;
// Tell the iPhone app when each pet will next need something, so it can remind you even when the game is closed.
function syncPetReminders() {
  petSyncAt = Date.now();
  if (!S) return;
  const off = now() - Date.now();
  const items = S.petRemind === false ? [] : petSchedule().map(x => {
    const a = myPets().find(p => p.id === x.pet);
    return { id: x.id, at: Math.round(x.at - off), title: t('app_name'), body: petAskText(a.name, a.k, x.need) };
  });
  postNative({ type: 'petReminders', items });
}
// The pet page: your pet alive and big, how it's doing, and what you can do for it.
function petLoop(ts) {
  const cvs = $('#petCanvas');
  if (!cvs || !UI.sheet || UI.sheet.type !== 'pets') { petAnim = null; return; }
  const a = myPets().find(x => x.id === UI.pet);
  if (a) {
    const w = cvs.clientWidth || 340, h = cvs.clientHeight || 190, fx = UI.petFx && ts - UI.petFx.t < 1600 ? UI.petFx : null;
    const dark = document.body.classList.contains('dark');
    Scene.thumb('pet', a.breed, { canvas: cvs, live: true, ts, big: true, stage: animalStage(a), mood: fx ? 'happy' : petMood(a), moving: !!(fx && fx.play), phase: ts / 55,
      face: fx && fx.play ? (Math.floor(ts / 700) % 2 ? -1 : 1) : 1, bg: dark ? ['#2f2924', '#241f1b'] : ['#fff6e8', '#ffe4c6'] }, w, h);
    const g = cvs.getContext('2d'), dpr = cvs.width / w;
    g.save(); g.scale(dpr, dpr); g.textAlign = 'center';
    if (fx) { const k = (ts - fx.t) / 1600; g.globalAlpha = 1 - k; g.font = `30px ${EMOJI_FONT}`; g.fillText(fx.e, w / 2 + 36, 64 - k * 44); }
    else { const ask = petAsks(a); if (ask.length) { g.font = `24px ${EMOJI_FONT}`; g.fillText(PET_NEEDS[ask[Math.floor(ts / 1500) % ask.length]].e, w / 2 + 40, 52 + Math.sin(ts / 300) * 3); } }
    g.restore();
  }
  petAnim = requestAnimationFrame(petLoop);
}
const PET_MOOD_E = { happy: '😊', ok: '🙂', sad: '🥺' };
Object.assign(SHEETS, {
  pets() {
    const pets = myPets();
    if (!pets.length) return `<div class="center"><div class="big-emoji xl">🐾</div><h2>${t('pets_title')}</h2><p class="muted">${t('pets_empty')}</p>
      <button class="btn primary block gap-top" data-act="openShop" data-arg="pets">${t('pets_adopt')}</button></div>`;
    const cur = pets.find(a => a.id === UI.pet) || pets[0];
    UI.pet = cur.id;
    const B = PET_BREEDS[cur.breed], v = petCare(cur), mood = petMood(cur), pf = S.me.petFood || {}, fk = cur.k + 'food';
    const tabs = `<div class="pet-tabs">${pets.map(a => `<button class="pet-tab ${a.id === cur.id ? 'on' : ''}" data-act="petPick" data-arg="${a.id}">
        ${thumbImg('pet', a.breed, { stage: animalStage(a) }, 48, 40, 'thumb xs')}<span>${esc(a.name)}</span>${petAsks(a).length ? '<i class="dot"></i>' : ''}</button>`).join('')}
      ${pets.length < PET_MAX ? `<button class="pet-tab add" data-act="openShop" data-arg="pets"><span class="plus">＋</span><span>${t('pets_more')}</span></button>` : ''}</div>`;
    const bar = k => {
      const n = Math.round(v[k]), label = k === 'clean' ? t(cur.k === 'cat' ? 'need_litter' : 'need_walk') : t('need_' + k);
      return `<div class="need ${n <= PET_REMIND ? 'low' : ''}"><span>${k === 'clean' && cur.k === 'dog' ? '🦮' : PET_NEEDS[k].e} ${label}</span><div class="bar"><i style="width:${n}%"></i></div><b>${n}</b></div>`;
    };
    const act = (a, e, label, n) => `<button class="pet-act" data-act="petCare" data-arg="${a}" ${n === 0 ? 'disabled' : ''}><span>${e}</span>${label}${n !== undefined ? `<small>${n}</small>` : ''}</button>`;
    const name = UI.petEdit !== undefined
      ? `<div class="name-edit"><input id="petName" class="input" maxlength="10" placeholder="${t('pet_name_ph')}" value="${esc(UI.petEdit)}"><button class="btn small primary" data-act="petNameSave">${t('save')}</button></div>`
      : `<h2>${esc(cur.name)} <button class="link-btn" data-act="petRename">✏️</button></h2>`;
    return `<div class="pet-page">${tabs}
      <canvas id="petCanvas" class="pet-stage"></canvas>
      <div class="pet-head"><div class="grow">${name}<div class="muted">${nm(B)} · ${t('pet_stage_' + animalStage(cur))} · ${t('mood_' + mood)}</div></div><div class="pet-mood">${PET_MOOD_E[mood]}</div></div>
      <div class="card needs">${['food', 'water', 'clean', 'love'].map(bar).join('')}</div>
      <div class="pet-acts">
        ${act('food', '🍖', t('pet_feed'), pf[fk] || 0)}${act('water', '💧', t('pet_water'))}${act('clean', cur.k === 'cat' ? '🧹' : '🦮', t(cur.k === 'cat' ? 'pet_scoop' : 'pet_walk'))}
        ${act('pet', '🤚', t('pet_pet'))}${act('play', cur.k === 'cat' ? '🧶' : '🎾', t('pet_play'))}${act('treat', '🍪', t('pet_treat'), pf.treats || 0)}</div>
      ${(pf[fk] || 0) < 3 ? `<div class="shop-note">${t('pet_food_low', { e: PET_FOOD[fk].e, name: nm(PET_FOOD[fk]) })} <button class="btn small" data-act="openShop" data-arg="pets">${t('go_shop')}</button></div>` : ''}
      <div class="card privacy-card"><label class="row between toggle-row"><span>🔔 ${t('pet_remind')}<small>${t('pet_remind_note')}</small></span>
        <input type="checkbox" class="switch" data-act="togglePetRemind" ${S.petRemind !== false ? 'checked' : ''}></label></div>
      <p class="muted center">${t('pet_never')}</p></div>`;
  },
});
const PET_FX = { food: '😋', water: '💦', treat: '🍪', pet: '💕' };
Object.assign(ACT, {
  capInfo() { snack(t('cap_info', { n: actionsLeft(), cap: ACTION_CAP })); },
  pets() { UI.petEdit = undefined; openSheet('pets'); if (!petAnim) petAnim = requestAnimationFrame(petLoop); },
  petPick(id) { UI.pet = id; UI.petEdit = undefined; renderSheet(); },
  petCare(what) {
    const a = myPets().find(x => x.id === UI.pet);
    if (!a) return;
    const r = careFor(a.id, what);
    if (r === 'nofood') { Sound.play('oops'); return snack(t('pet_nofood', { name: nm(PET_FOOD[what === 'treat' ? 'treats' : a.k + 'food']) })); }
    if (r !== 'ok') return;
    const voice = a.k === 'dog' ? 'woof' : 'meow';
    UI.petFx = { e: PET_FX[what] || (what === 'clean' ? (a.k === 'cat' ? '✨' : '🦮') : a.k === 'cat' ? '🧶' : '🎾'), t: performance.now(), play: what === 'play' || (what === 'clean' && a.k === 'dog') };
    Sound.play({ food: 'crunch', water: 'lap', treat: 'crunch', clean: a.k === 'cat' ? 'sweep' : voice }[what] || voice);
    if (what !== 'clean') setTimeout(() => Sound.play(voice), 450);
    save(); renderSheet(); syncPetReminders();
  },
  petRename() { const a = myPets().find(x => x.id === UI.pet); UI.petEdit = a ? a.name : ''; renderSheet(); const i = $('#petName'); if (i) i.focus(); },
  petNameSave() {
    const a = myPets().find(x => x.id === UI.pet), n = (UI.petEdit || '').trim().slice(0, 10);
    if (a && n) a.name = n;
    UI.petEdit = undefined; save(); renderSheet();
  },
  adopt(breed) {
    const r = adoptPet(breed);
    if (r.r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    if (r.r === 'full') return snack(t('pet_full', { n: PET_MAX }));
    if (r.r !== 'ok') return;
    Sound.play('buy'); setTimeout(() => Sound.play(r.a.k === 'dog' ? 'woof' : 'meow'), 400);
    UI.pet = r.a.id; save();
    snack(t('pet_adopted', { name: r.a.name }));
    ACT.pets();
  },
  buyPetFood(k) {
    const r = buyPetFood(k);
    if (r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    if (r === 'ok') { Sound.play('buy'); snack(t('petfood_bought', { e: PET_FOOD[k].e, name: nm(PET_FOOD[k]), n: PET_FOOD[k].n })); save(); }
  },
  togglePetRemind() { S.petRemind = S.petRemind === false; save(); syncPetReminders(); },
  setTheme(m) { S.theme = m; save(); applyTheme(); },
  showLogin() { showLogin(); },
  signOut() { S.account = null; save(); showLogin(); },
  signIn(p) {
    UI.login = { step: 'pick', busy: true }; reLogin();
    const native = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.mirror;
    if (p === 'apple' && native) {
      postNative({ type: 'signIn', provider: 'apple' });
      UI.loginWait = setTimeout(() => window.onNativeSignIn({ ok: false }), 30000);   // an older app without the bridge never answers
    } else setTimeout(() => finishLogin({ provider: p, id: 'sim-' + uid(), email: '', sim: true }), 700);
  },
  loginEmail() { UI.login = { step: 'email', email: '' }; reLogin(); },
  loginSend() {
    const e = (UI.login.email || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { UI.login.err = 'login_bad_email'; return reLogin(); }
    UI.login = { step: 'code', email: e, code: '' }; reLogin();
  },
  loginVerify() {
    if (!/^\d{6}$/.test(UI.login.code || '')) { UI.login.err = 'login_bad_code'; return reLogin(); }
    finishLogin({ provider: 'email', id: 'email:' + UI.login.email, email: UI.login.email, sim: true });
  },
  loginBack() { UI.login = { step: 'pick' }; reLogin(); },
});

document.addEventListener('click', e => {
  if (e.target.id === 'backdrop') return closeSheet();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) { if (e.target.closest('.item-card')) Sound.play('select'); return; }
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  // every button makes a sound: picking things (shop categories, tabs, cards) a bubbly blip, everything else a soft tick
  Sound.play(CLICK_SOUND[el.dataset.act] || 'tick');
  const ta = $('#draftText');
  if (ta && UI.draft) UI.draft.text = ta.value;
  fn(el.dataset.arg);
  if (S && !S.onboarding && !el.dataset.act.startsWith('ob')) refresh();
});
const CLICK_SOUND = { shopCat: 'select', shopSub: 'select', tab: 'select', petPick: 'select', worldPick: 'select' };
document.addEventListener('input', e => {
  if (e.target.id === 'obName') OB.name = e.target.value;
  if (e.target.id === 'loginEmail' && UI.login) UI.login.email = e.target.value;
  if (e.target.id === 'loginCode' && UI.login) UI.login.code = e.target.value.replace(/\D/g, '').slice(0, 6);
  if (e.target.id === 'petName' && UI.petEdit !== undefined) UI.petEdit = e.target.value;
  if (e.target.id === 'draftText' && UI.draft) UI.draft.text = e.target.value;
});

Scene.init($('#town'), onSceneHit);
Scene.onWorldOut(() => { if (UI.tab === 'town') { ACT.world(); refresh(); } });   // pinching out past your town opens the world map
// Sound can only start after the first touch (browser and iPhone rule).
document.addEventListener('pointerdown', () => {
  Sound.start();
  if (S) { Sound.setMusic(S.music !== false); Sound.setSfx(S.sfx !== false); }
}, { once: false, passive: true });
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
  weatherFarm(1000);
  if (S.work && now() >= S.work.end) { const r = finishShift(); if (r) { Sound.play('coins'); snack(`💼 ${t(r.promoted ? 'job_promoted' : 'job_done', { n: r.pay, rank: nm(JOB_RANKS[jobRank()]) })}`); refresh(); } }
  if (S.sick && Scene.resting() && restInBed(1)) { Sound.play('chime'); snack(`😊 ${t('sick_cured')}`); refresh(); }
  if (S.floodNews) { snack(`🌊 ${t('w_flooded', { n: S.floodNews })}`); S.floodNews = 0; }
  // trophies: celebrate each new one (once)
  if (!S.onboarding) {
    const tn = trophyNews();
    if (tn.length) { UI.trophyQ = [...(UI.trophyQ || []), ...tn]; if (!UI.sheet) openSheet('trophyNew', UI.trophyQ.shift()); save(); refresh(); }
  }
  // pets: say once when one of them needs something; keep the phone reminders up to date
  if (!S.onboarding) {
    const news = petNews();
    news.forEach(n => { addFeed({ kind: 'pet', from: 'me', pet: n.a.id, need: n.need }); snack(petAskText(n.a.name, n.a.k, n.need)); });
    if (news.length) { save(); refresh(); }
    if (Date.now() - petSyncAt > 10 * MIN) syncPetReminders();
  }
  Sound.ambience(NIGHT > 0.5, weatherNow().kind);
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
