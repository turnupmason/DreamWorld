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
  return `🪙${g.n * WOOD_USD}`;   // (v0.44: wood is now coins)
}
const goodE = k => (CROPS[k] || GOODS[k] || {}).e || '';
function fname(id) { const h = homeOf(id); return h ? homeName(h) : ''; }
// v0.43: each kind of news has its own badge and colour
const NOTE_KIND = { gift: { e: '🎁', c: '#ff9f0a' }, like: { e: '❤️', c: '#ff375f' }, msg: { e: '💬', c: '#30a2ff' }, join: { e: '👋', c: '#34c759' }, stole: { e: '🥷', c: '#8e8e93' },
  caught: { e: '🚓', c: '#5e5ce6' }, letter: { e: '💌', c: '#bf5af2' }, goal: { e: '🏆', c: '#e0a800' }, pet: { e: '🐾', c: '#ac8e68' } };
const noteKind = k => NOTE_KIND[k] || { e: '🔔', c: '#ef7d3c' };
function noteFace(it) { const f = homeOf(it.from), K = noteKind(it.kind); return `<div class="nt-ava">${f ? avatar(f.look) : '<span class="ava nt-app">🏡</span>'}<i style="background:${K.c}">${K.e}</i></div>`; }
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
    fields: h.fields.map((f, i) => (isRipe(f) || isRotten(f) ? i : -1)).filter(i => i >= 0),   // v0.44: rotten ones get cleared too
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
  el.className = 'toast note';   // v0.43: who it's from (their face, a coloured badge for what happened), then what
  el.style.setProperty('--nk', noteKind(item.kind).c);
  el.innerHTML = `${noteFace(item)}<div class="grow"><div class="nt-top"><b>${esc(fname(item.from)) || t('app_name')}</b><span>${t('now')}</span></div><div class="nt-text">${feedText(item)}</div></div>`;
  el.onclick = () => { if (item.kind === 'letter') openSheet('mail', 'box'); else setTab('feed'); refresh(); };
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
function tip(kind, k, name, sub, btn) {
  const el = $('#tip'), p = Scene.tapAt(), key = kind + ':' + k + ':' + Math.round(p.x / 30) + ':' + Math.round(p.y / 30);
  if (tipKey === key && (!el.hidden || Date.now() - tipHidAt < 500)) return hideTip();   // same thing again: close it
  tipKey = key;
  el.innerHTML = `${kind ? thumbImg(kind, k, {}, 52, 44, 'thumb') : ''}<div class="grow"><b>${esc(name)}</b>${sub ? `<span>${sub}</span>` : ''}</div>${btn ? `<button class="btn small primary" data-act="${btn.act}" data-arg="${btn.arg}">${btn.label}</button>` : ''}`;
  el.classList.toggle('has-btn', !!btn);
  el.hidden = false;
  // v0.13: a slim bar at the top of the scene (under the context bar), so it never covers what you tapped
  const cb = $('#ctxbar'), top = cb && !cb.hidden ? cb.offsetTop + cb.offsetHeight + 8 : 10;
  el.style.left = ''; el.style.top = top + 'px';
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, btn ? 6000 : 2600);
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

// v0.56: sounds. Which buildings have their own tune (the rest: the shop music); the sound when you finish
// something in a building; the volumes (0 … 1) from the settings
const SOUND_PLACE = { cafe: 1, bakery: 1, salon: 1, florist: 1, hotel: 1, tower: 1, rooftop: 1, suite: 1, library: 1, museum: 1, bookstore: 1, clinic: 1, hospital: 1, school: 1, apartments: 1, furniture: 1, gym: 1, bowling: 1, aquatic: 1, amuse: 1, zoo: 1, stadium: 1, station: 1, plaza: 1, market: 1, mall: 1, realty: 1, nursery: 1, ranch: 1, petshop: 1 };
const ACT_SOUND = { dinner: 'munch', hotdog: 'munch', candy: 'munch', drink: 'sip', tea: 'sip', book: 'paper', swim: 'splash', dive: 'splash', bath: 'splash', sauna: 'done', bed: 'yawn', match: 'cheer', trains: 'done', coaster: 'cheer', wheel: 'done', bumper: 'bounce', arcade: 'levelup', giraffefeed: 'nibble', petting: 'baa' };
const volOf = k => { const v = (S && S.vol || {})[k]; return v == null ? 0.8 : v; };
// ---------- view ----------
// The scene is on screen for Home, Town, and in World once you've picked a community (UI.wtown); World without
// one is the map (a panel). The Town tab is always your own community (friends and family); World is everyone.
const sceneTab = () => UI.tab === 'home' || UI.tab === 'town' || (UI.tab === 'world' && !!UI.wtown);
function syncView() {
  setViewTown(UI.tab === 'world' && UI.wtown ? UI.wtown : myTown());
  if (UI.tab === 'home') Scene.setView(UI.inside ? 'interior' : 'home', 'me');
  else if (sceneTab()) { if ((UI.tab === 'town' || (UI.tab === 'world' && UI.wtown)) && UI.inVenue) Scene.setView('shop', UI.inVenue); else if (UI.tab === 'town' && UI.inStore) Scene.setView('shop', UI.inStore === 'mall' ? UI.mallFloor || 'mall' : UI.inStore === 'furniture' ? UI.furnFloor || 'furniture' : UI.inStore); else Scene.setView(UI.visit ? (UI.visitInside ? 'interior' : 'home') : 'town', UI.visit || 'me'); }
  Scene.setVisible(sceneTab() && !Games.isOpen());   // v0.33: not under a ball game
  // each place has its own tune
  const inside = (UI.tab === 'home' && UI.inside) || (UI.visit && UI.visitInside);
  const pk = UI.tab === 'town' || UI.tab === 'world' ? UI.inVenue || UI.inStore || null : null;   // v0.56: each building has its own tune and sounds
  Sound.setScene(UI.tab === 'shop' || UI.inStore || UI.inVenue ? 'shop' : inside ? 'inside' : UI.tab === 'world' && !UI.wtown ? 'world' : (UI.tab === 'town' || UI.tab === 'world') ? (UI.visit ? 'home' : 'town') : 'home', pk && (SOUND_PLACE[pk] ? pk : VENUE_HOME[pk] || pk));
  try { const c = countyOf(VIEW_TOWN); Sound.setFolk(c && c.folk); } catch (e) { /* no county */ }
}
function setTab(tab) {
  if (Scene.getEdit()) Scene.stopEdit();
  UI.inVenue = null;   // v0.30: you walk out of the building
  if (UI.inStore) { UI.inStore = null; UI.basket = null; }   // v0.20: you walk out of the store (whatever's in the basket goes back on the shelf)
  if (tab !== UI.tab && (tab === 'town' || tab === 'world')) { UI.visit = null; UI.visitInside = false; setLevel(0); }   // a visit belongs to the tab it started in
  if (tab === 'world' && UI.tab === 'world') { UI.wtown = null; UI.visit = null; }   // tapping World again: back to the map
  UI.tab = tab;
  tutDone('tab:' + tab);
  if (tab === 'town') { syncView(); if (!Scene.showMe() && S.trav && COMMUNITIES[S.trav.town] && S.trav.town !== myTown()) snack(`📍 ${t('trav_tap_find', { c: nm(COMMUNITIES[S.trav.town]) })}`); }   // v0.64: the town tab: close up on you (or: you're away)
  if (tab === 'feed') S.feed.forEach(i => { i.read = true; });
  if (tab === 'real') postNative({ type: 'refresh' });
  syncView();
}

// ---------- HUD and tab bar ----------
function renderHUD() {
  const e = energyLevel(), mail = unreadMail();
  const live = S.live ? `<button class="pill live" data-act="liveInfo">${WORKOUTS[S.live.type].e} ${Math.floor(liveMin())}′${S.live.hr ? ` ❤️${S.live.hr}` : ''}</button>` : '';
  const perks = (S.swam === today() ? `<span class="pill perk">🏊 ${t('perk_swim', { n: Math.round(PERKS.swimWalk * 100) })}</span>` : '') + (S.rested === today() ? `<span class="pill perk">🛏️ ${t('perk_rest')}</span>` : '');   // v0.45
  $('#hud').innerHTML = `
    <div class="statusbar"><span id="clock">${fmtClock(now())}</span><span>▂▄▆ 🔋</span></div>
    <div class="row between">
      <button class="row me plain" data-act="energyInfo">${avatar(S.me.look, 'hud e-' + e, e)}<div><div class="me-name">${esc(S.me.name)}</div>
        <div class="energy">${ENERGY_EMOJI[e]} ${energyName(e)} · ${t('sleep_short', { n: S.sleep ? S.sleep.score : '–' })}</div></div></button>
      <div class="row tight"><button class="coin-chip" data-act="phone" data-arg="bank">🪙<b>${fmtPrice(S.me.coins)}</b></button><button class="pill phone-pill" data-act="phone" aria-label="${t('ph_name')}" title="${t('ph_name')}">📱${phoneBadge() ? `<i class="badge">${phoneBadge()}</i>` : ''}</button>${weatherPill()}</div>
    </div>
    ${needBars()}
    <div class="res row">${perks}${live}
      ${S.work ? `<button class="pill work" data-act="placeGo" data-arg="${S.work.place}">💼 ${fmtDur(Math.max(0, S.work.end - now()))}</button>` : commuteSoon() ? `<button class="pill work" data-act="commuteGo">💼 ${t('job_commute')}</button>` : ''}${S.sick ? `<button class="pill sick" data-act="placeGo" data-arg="clinic">🤒</button>` : ''}${S.study ? `<button class="pill work" data-act="placeGo" data-arg="school">📚 ${fmtDur(Math.max(0, S.study.end - now()))}</button>` : ''}${isFed() ? `<button class="pill fed" data-act="mallAct" data-arg="food">😋 ${fmtDur(S.fed.until - now())}</button>` : ''}${jailed() ? `<button class="pill jail" data-act="placeGo" data-arg="police">🚔 ${fmtDur(Math.max(0, S.jail.end - now()))}</button>` : ''}
      ${S.pending.length ? `<button class="pill pending" data-act="collect">📦 ${t('to_collect')} ${S.pending.length}</button>` : ''}
    </div>`;
}
function renderTabbar() {
  const n = unreadCount() + unreadMail();
  $('#tabbar').innerHTML = [['home', '🏡'], ['town', '🏘️'], ['world', '🌍'], ['shop', '🛒'], ['real', '❤️'], ['feed', '🔔']].map(([id, ic]) =>
    `<button class="tab ${UI.tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">
      <span class="ic">${ic}</span>${t('tab_' + id)}${id === 'feed' && n ? `<span class="badge">${n}</span>` : ''}</button>`).join('');
}
// v0.64 (Mason #32: "tap one and the bar jumps back to the first"): a sideways row of chips keeps where it was
// scrolled to when the page is drawn again, and the chip you picked stays in sight
function keepRows(el, draw) {
  const sel = '.chips-row, .shop-cats, .sub-chips', before = [...el.querySelectorAll(sel)].map(r => r.scrollLeft);
  draw();
  [...el.querySelectorAll(sel)].forEach((r, i) => { if (before[i] !== undefined) r.scrollLeft = before[i];
    const on = r.querySelector('.on'); if (!on || r.scrollWidth <= r.clientWidth) return; const x = on.getBoundingClientRect().left - r.getBoundingClientRect().left + r.scrollLeft;
    if (x < r.scrollLeft || x + on.offsetWidth > r.scrollLeft + r.clientWidth) r.scrollLeft = x - (r.clientWidth - on.offsetWidth) / 2; });
}
function renderPanel() {
  const el = $('#panel'), onScene = sceneTab();
  el.hidden = onScene;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  const top = el.scrollTop, ws = $('.wmap-scroll'), wx = ws ? ws.scrollLeft : null;
  keepRows(el, () => {
    if (UI.tab === 'shop') el.innerHTML = panelShop();
    else if (UI.tab === 'real') el.innerHTML = panelReal();
    else if (UI.tab === 'feed') el.innerHTML = panelFeed();
    else if (UI.tab === 'world') { el.innerHTML = panelWorld(); afterWorld(wx); }
  });
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
      f = b('goOut', '🌳', t('fab_exit')) + b('design', '✏️', t('fab_design')) + b('wardrobe', '👗', t('fab_wardrobe')) + b('barn', '🧺', t('fab_barn')) + petBtn();
    } else if (outInTown() && !S.live) {
      c = `<div class="ctx-main">📍 ${t('away_at', { place: esc(outName()) })}</div><button class="btn small primary" data-act="goHome">🏡 ${t('go_home')}</button>`;
      f = b('design', '✏️', t('fab_design')) + b('barn', '🧺', t('fab_barn')) + petBtn() + b('recenter', '🎯', t('fab_center'));
    } else {
      c = S.calm ? `<button class="ctx-main link" data-act="ranking">${t('ctx_town_calm', { street: t('street_name'), lv: townLevel() })}</button>`
        : `<button class="ctx-main link" data-act="ranking">🏆 ${t('ctx_rank', { n: rankOf('me'), v: fmtNum(assetValue(S.me)) })}</button>`;
      f = b('goIn', '🚪', t('fab_enter')) + b('design', '✏️', t('fab_design')) + b('barn', '🧺', t('fab_barn')) + petBtn() + b('recenter', '🎯', t('fab_center'));
    }
  } else if (UI.inVenue && UI.tab === 'town') {   // v0.30: inside a building
    const P = placeInfo(UI.inVenue), busy = Scene.shopBusy();   // v0.50: eating too
    c = `<div class="ctx-main">${P.e} ${t('venue_in', { name: nm(P) })}${busy ? ` · ⏳ ${t('venue_busy', { n: busy })}` : ''}</div><button class="btn small" data-act="leaveVenue">🚪 ${t('venue_leave')}</button>`;
  } else if (UI.inStore && UI.tab === 'town') {   // v0.20: in a store
    const B = UI.basket || { items: [] }, S2 = STORES[UI.inStore];
    const busy2 = Scene.shopBusy();   // v0.50
    c = `<div class="ctx-main">${S2.e} ${nm(S2)}${B.items.length ? ` · 🛒 ${B.items.length}` : ''}${busy2 ? ` · ⏳ ${t('venue_busy', { n: busy2 })}` : ''}</div>${B.items.length ? `<button class="btn small primary" data-act="goTill">💳 ${t('checkout_short')}</button>` : ''}<button class="btn small" data-act="leaveStore">🚪 ${t('store_leave')}</button>`;
  } else if (!UI.visit && Scene.tripNow()) {   // on the way somewhere (v0.12)
    const tr = Scene.tripNow();
    c = `<div class="ctx-main">${tr.kind === 'stroll' ? `🌳 ${t('go_strolling')}` : tr.kind === 'chat' ? `🚶 ${t('go_to_chat', { name: esc(UI.tripTo || '') })}` : tr.toCar ? `🚶 ${t('go_to_car')}` : `${{ walk: '🚶', bike: '🚲', car: '🚗' }[tr.how]} ${t('go_on_way', { to: esc(UI.tripTo || '') })}`}</div><button class="btn small" data-act="tripStop">✋ ${t('go_stop')}</button><button class="btn small" data-act="tripFast">⚡ ${t('go_now')}</button>`;
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
    c = `<button class="btn small" data-act="worldMap">← 🌍</button><div class="ctx-main">${cm.flag} ${nm(cm)} · ${nm(countyOf(VIEW_TOWN))} · ${isNightIn(VIEW_TOWN) ? '🌙' : '☀️'} ${localClock(VIEW_TOWN)} · <span class="online-dot"></span>${t('online_n', { n: fmtNum(onlineIn(VIEW_TOWN)) })}</div>${awayIn(VIEW_TOWN) ? `<button class="btn small primary" data-act="openSpecials">🧺</button>` : ''}`;
    f = b('worldMap', '🗺️', t('fab_map')) + b('goHome', '🏡', t('fab_home'));
  } else {
    c = `<button class="ctx-main link" data-act="ranking">🏛️ ${t('ctx_town', { street: t('street_name'), lv: townLevel(), v: fmtCompact(townTotal()), h: homesIn(myTown()) })}</button>`;
    f = (S.calm ? '' : b('ranking', '🏆', t('fab_rank'))) + b('goHome', '🏡', t('fab_home'));
  }
  if (!ed && UI.tab !== 'world') f = b('findMe', '📍', t('fab_findme')) + f;   // v0.22: where's my townie?
  ctxEl.innerHTML = c; ctxEl.hidden = !c;
  fab.innerHTML = f; fab.hidden = !f;
  tray.hidden = !ed;
  if (ed) tray.innerHTML = trayHTML(ed);
  const n = ripeCount(), busy = Scene.busy(), away = S.trav && COMMUNITIES[S.trav.town] && S.trav.town !== myTown() ? S.trav.town : null;
  if (UI.tab === 'home' && !UI.inside && !ed && away) {   // v0.68 (Mason #33): you're in another city: say so (no farm buttons: you aren't here)
    hv.hidden = false; hv.className = 'harvest-all away'; hv.innerHTML = `🧳 ${t('away_banner', { c: nm(COMMUNITIES[away]) })}`; hv.dataset.act = 'findMe';
  } else {
  const showHv = UI.tab === 'home' && !UI.inside && !ed && !S.live && (n > 0 || busy > 0);
  hv.hidden = !showHv;
  hv.className = 'harvest-all' + (busy > 0 ? ' busy' : '');
  hv.innerHTML = busy > 0 ? `✋ ${t('stop_jobs', { n: busy })}` : `🧺 ${t('harvest_all')} · ${n}`;
  hv.dataset.act = busy > 0 ? 'stopJobs' : 'harvestAll';
  }
  lb.hidden = !S.live || ed;
  if (S.live) {
    const w = WORKOUTS[S.live.type];
    const where = placeInfo(LIVE_PLACE[S.live.type] || 'park');
    lb.innerHTML = `<div><b>${w.e} ${t('live_now', { name: nm(w), n: Math.floor(liveMin()) })}</b>${S.live.hr ? ` · ❤️ ${S.live.hr}` : ''}</div><span>${t('live_at', { place: `${where.e} ${nm(where)}` })}</span>
      <button class="btn small" data-act="seeLive">👀 ${t('live_see')}</button>`;
  }
}
function overlaySig() {
  return [UI.tab, UI.inside, UI.visit, UI.wtown, VIEW_TOWN, S.trav ? S.trav.town : '', ripeCount(), Scene.busy(), S.live ? Math.floor(liveMin()) + ':' + S.live.hr : '', unreadMail(), S.pending.length, LEVEL, petAlertCount(), actionsLeft(), S.lang, phoneBadge(), ['hunger', 'social', 'fun'].map(k => Math.round(needs()[k] / 5)).join(','), JSON.stringify(Scene.tripNow()), S.out ? S.out.place || S.out.id || 1 : 0, UI.inStore, UI.mallFloor, UI.inVenue, Scene.venueBusy()].join('|');
}
// 1F 2F 3F … chips inside a house, plus ＋ to build another storey in your own.
function floorChips(h) {
  const n = floorsOf(h), mine = h === S.me, lv = Math.min(LEVEL, n - 1);
  if (n < 2 && !(mine && maxFloors(h) > 1)) return '';
  return `<div class="floors">${Array.from({ length: n }, (_, i) => `<button class="fl ${i === lv ? 'on' : ''}" data-act="floor" data-arg="${i}">${i + 1}F</button>`).join('')}
    ${mine && n < maxFloors(h) ? `<button class="fl add" data-act="buildFloor" title="${t('build_floor')}">＋</button>` : ''}</div>`;
}

function trayHTML(ed) {
  // v0.24: drag anything to move it; tap a thing, the house or an area to change it here
  const scope = ed.scope, h = S.me, sw = (list, cur, act, val = (c, i) => i) => list.map((c, i) => `<button class="swatch sm ${cur === val(c, i) ? 'on' : ''}" style="background:${c.c1 || c}" data-act="${act}" data-arg="${val(c, i)}"></button>`).join('');
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
      return `<div class="tray-row"><div class="grow"><b>${nm(d)}</b><div class="muted small">${t('tray_drag_it')}</div></div>
        <button class="btn small" data-act="trayRotate">↻ ${t('rotate')}</button>
        <button class="btn small" data-act="trayStore">📦 ${t('store')}</button></div>
        ${it.tint ? `<div class="color-row"><span>🎨</span>${sw(TINTS, it.tint, 'tintSel', c => c)}</div>` : ''}`;
    }
  }
  if (scope === 'yard' && UI.editSel === 'house') return `<div class="tray-row"><div class="grow"><b>🏠 ${nm(HOUSES[h.house])}</b></div><button class="btn small" data-act="editSel" data-arg="">✓ ${t('done')}</button></div>
      <div class="color-row"><span>${t('wall_color')}</span>${sw(WALL_COLORS, WALL_COLORS.indexOf(h.wall), 'setWall')}</div>
      <div class="color-row"><span>${t('roof_color')}</span>${sw(ROOF_COLORS, ROOF_COLORS.indexOf(h.roof), 'setRoof')}</div>`;
  if (scope === 'yard' && UI.editSel === 'drive') {
    const cur = driveOf(h).st;
    return `<div class="tray-row"><div class="grow"><b>🚗 ${t('area_drive')}</b><div class="muted small">${t('drive_note', { n: driveCap(h), g: garageCap(h) })}</div></div><button class="btn small" data-act="editSel" data-arg="">✓ ${t('done')}</button></div>
      <div class="tray-items">${Object.entries(DRIVES).map(([k, D]) => `<button class="tray-item ${k === cur ? 'on' : ''}" data-act="setDrive" data-arg="${k}"><span class="drive-pic">${drivePic(k)}</span><span>${nm(D)}</span><i>${k === cur ? '✓' : D.cost ? '🪙' + fmtNum(D.cost) : t('free')}</i></button>`).join('')}</div>`;
  }
  if (scope === 'yard' && UI.editSel === 'garage') return `<div class="tray-row"><div class="grow"><b>${t('area_garage')}</b><div class="muted small">${t('tray_drag_area')}</div></div><button class="btn small" data-act="garageRotate">↻ ${t('rotate')}</button><button class="btn small" data-act="editSel" data-arg="">✓ ${t('done')}</button></div>`;   // v0.46: the garage turns
  if (scope === 'yard' && UI.editSel) return `<div class="tray-row"><div class="grow"><b>${t('area_' + (String(UI.editSel).startsWith('plot:') ? 'plot' : UI.editSel))}</b><div class="muted small">${t('tray_drag_area')}</div></div><button class="btn small" data-act="editSel" data-arg="">✓ ${t('done')}</button></div>`;
  const colors = scope === 'room' ? `<div class="color-row"><span>${t('wallpaper')}</span>${sw(ROOM_WALLS, curRoom(h).wall, 'setRoomWall')}</div><div class="color-row"><span>${t('floor')}</span>${sw(FLOORS, curRoom(h).floor, 'setFloor')}</div>` : '';
  const hint = `<div class="tray-hint muted small">✋ ${t(scope === 'yard' ? 'tray_hint_yard' : 'tray_hint_room')}</div>`;
  const stored = Object.entries(h.store).filter(([key]) => key.startsWith(scope + ':'));
  if (!stored.length) return hint + `<div class="tray-empty"><span class="muted">${t('tray_empty')}</span>
    <button class="btn small" data-act="openShop" data-arg="${scope === 'room' ? 'furn' : 'yard'}">🛒 ${t('go_shop')}</button></div>` + colors;
  return hint + `<div class="tray-items">${stored.map(([key, n]) => {
    const k = key.split(':')[1], d = itemDef(scope, k);
    return `<button class="tray-item" data-act="holdNew" data-arg="${k}">${thumbImg(scope === 'room' ? 'furn' : 'yard', k, {}, 72, 58, 'thumb sm')}
      <span>${nm(d)}</span><i>×${n}</i></button>`;
  }).join('')}</div>` + colors;
}
// a tiny plan of a drive design
function drivePic(k) {
  const D = DRIVES[k], s2 = 6, w = D.w * s2, d = D.d * s2;
  const r = D.curve ? `<rect x="0" y="${2 * s2}" width="${2 * s2}" height="${d - 2 * s2}" rx="2"/><rect x="0" y="0" width="${w}" height="${2 * s2}" rx="2"/>` : `<rect x="0" y="0" width="${w}" height="${d}" rx="2"/>`;
  return `<svg width="${w + 2}" height="${d + 2}" viewBox="-1 -1 ${w + 2} ${d + 2}"><g fill="#cfc8bb" stroke="#9a9384" stroke-width="1">${r}</g></svg>`;
}

// ---------- shop ----------
const SHOP_CATS = [['seeds', '🌱'], ['trees', '🌳'], ['animals', '🐣'], ['pets', '🐾'], ['land', '🗺️'], ['furn', '🛋️'], ['yard', '⛲'], ['cars', '🚗'], ['houses', '🏠'], ['clothes', '👕'], ['excl', '🏆'], ['sell', '💰']];
function shopCard(img, name, sub, btns, extra = '') {
  return `<div class="item-card">${img}<div class="item-name">${name}</div><div class="item-sub">${sub}</div>${extra}<div class="item-btns">${btns}</div></div>`;
}
// v0.17: buying happens in the store that sells it; elsewhere the shop is a catalogue (buttons greyed out)
let SHOP_AWAY = false;
const buyBtn = (act, arg, label, ok, cls = 'primary') => `<button class="btn small ${cls}" data-act="${act}" data-arg="${arg}" ${ok && !(SHOP_AWAY && storeForAct(act, arg)) ? '' : 'disabled'}>${label}</button>`;
function storeForAct(act, arg = '') {
  const m = { buySeed: 'market', buyTree: 'nursery', buyAnimal: 'ranch', buyFeed: 'ranch', adopt: 'petshop', buyPetFood: 'petshop', buyCar: 'dealer', buyHouse: 'realty', buyLand: 'realty', buyExcl: 'mall', buyClothes: 'mall', watchMovie: 'mall', clawTry: 'mall', eatFood: 'mall', buyParcel: 'realty', moveHouse: 'realty', buyRun: 'realty', moveHere: 'realty' };
  if (act === 'buyItem') return String(arg).startsWith('room|') ? 'furniture' : 'nursery';
  return m[act] || null;
}
const atStore = k => !!k && VIEW_TOWN === myTown() && (Scene.here() === k || UI.inStore === k);
const RARE_KEY = { sleep: 'rare_sleep', rings: 'rare_rings', focus: 'rare_focus', steps: 'rare_steps' };
// v0.46: the next plot of farmland (one at a time)
function plotDeal() {
  const n = S.me.fields.length, next = n < PLOT.max ? { cost: { coins: plotCost(n) } } : null;
  return { next, cost: next && next.cost, sub: next ? t('land_plot_sub', { n, max: PLOT.max }) : t('land_plot_max', { n }) };
}
function landCard(kind, img, icon) {
  const h = S.me, table = { field: [FIELD_COST, 'fieldLv'], pasture: [PASTURE, 'pastureLv'], orchard: [ORCHARD, 'orchardLv'], pond: [POND, 'pondLv'] }[kind];
  if (kind === 'garage') {   // v0.19
    const lv = h.garageLv || 0, next = GARAGE[lv + 1];
    return shopCard(img, `${icon} ${lv ? nm(GARAGE[lv]) : t('land_garage')}${lv ? ` · ${t('garage_cars', { n: GARAGE[lv].cap })}` : ''}`, next ? `${nm(next)} · ${t(lv ? 'garage_up' : 'garage_new', { n: next.cap })}` : t('garage_max'),
      next ? buyBtn('buyLand', 'garage', costText(next.cost), canAfford(next.cost)) : `<span class="tag ok">${t('maxed')}</span>`);
  }
  if (kind === 'field' && h.plots) { const D = plotDeal(); return shopCard(img, `${icon} ${t('land_field')} · ${t('plot_count', { n: h.fields.length })}`, D.sub, D.next ? buyBtn('buyLand', kind, costText(D.cost), canAfford(D.cost)) : `<span class="tag ok">${t('maxed')}</span>`); }   // v0.46
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
  if (UI.inStore && !STORES[UI.inStore].cats.includes(UI.shop)) UI.shop = STORES[UI.inStore].cats[0];
  const h = S.me, cat = UI.shop, sub = curSub(cat), store = CAT_STORE[cat], inside = false;   // v0.20: you buy inside the store itself
  SHOP_AWAY = !!store && store !== 'market' ? !atStore(store) : store === 'market' && cat === 'seeds' && !atStore('market');
  const cats = inside ? SHOP_CATS.filter(([id]) => STORES[UI.inStore].cats.includes(id)) : SHOP_CATS;
  const mallActs = inside && UI.inStore === 'mall' ? `<div class="mall-acts">${[['cinema', '🎬'], ['claw', '🕹️'], ['food', '🍔']].map(([k, e]) => `<button class="mall-act" data-act="mallAct" data-arg="${k}"><span>${e}</span>${t('act_' + k)}</button>`).join('')}</div>` : '';
  const chips = cats.map(([id, ic]) => `<button class="cat ${cat === id ? 'on' : ''}" data-act="shopCat" data-arg="${id}"><span>${ic}</span>${t('cat_' + id)}</button>`).join('');
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
    const feedCard = keep('feed') ? shopCard(`<div class="emoji-thumb">${FEED.e}</div>`, nm(FEED), t('feed_sub', { n: FEED.n, b: h.feed || 0, t: h.trough || 0, c: FEED.trough }), buyBtn('buyFeed', 'feed', `🪙${FEED.price}`, h.coins >= FEED.price)) : '';   // v0.44
    body = feedCard + Object.entries(ANIMALS).filter(([k, a]) => keep(k) && !a.excl).map(([k, a]) => {
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
  } else if (cat === 'clothes') {
    // v0.18: clothes from the mall's clothing shop; wear them (in any colour) from the wardrobe
    const L = S.me.look, own = S.me.wardrobe || CLOTHES_FREE;
    note = `${t('clothes_note')} <button class="btn small" data-act="wardrobe">👗 ${t('wardrobe')}</button>`;
    body = Object.entries(CLOTHES).filter(([k, c]) => k !== 'nohat' && keep(k)).map(([k, c]) => {
      const on = wearing(L, c.slot) === k, mine = own.includes(k);
      const btn = on ? `<span class="tag ok">${t('wearing')}</span>` : mine ? `<button class="btn small" data-act="wear" data-arg="${k}">${t('wear')}</button>`
        : buyBtn('buyClothes', k, `🪙${fmtNum(c.price)}`, S.me.coins >= c.price);
      return shopCard(thumbImg('outfit', k, { look: { ...L, [c.slot]: k } }), `${c.e} ${nm(c)}`, t('slot_' + c.slot) + (mine && !on ? ` · ${t('owned')}` : ''), btn);
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
      + landCard('orchard', thumbImg('orchard', 'o'), '🌳') + landCard('pond', thumbImg('pond', 'p'), '🐟') + landCard('garage', thumbImg('garage', S.me.garageLv || 0, { n: Math.min(5, (S.me.garageLv || 0) + 1) }), '🚗');
    note = t('note_land');
  } else if (cat === 'furn' || cat === 'yard') {
    const scope = cat === 'furn' ? 'room' : 'yard', list = cat === 'furn' ? FURN : YARD;
    const owned = k => (scope === 'room' ? allRoomItems(h) : h.yard).filter(i => i.k === k).length + (h.store[scope + ':' + k] || 0);
    body = Object.entries(list).filter(([k, d]) => !d.souv && !d.excl && !d.award && !d.plush && !d.travel && keep(k)).map(([k, d]) => {
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
      if (!keep(H.id) || H.npc) return '';
      let btn;
      if (i === h.house) btn = `<span class="tag ok">${t('house_current')}</span>`;
      else if (h.houses.includes(i)) btn = buyBtn('moveHouse', i, t('house_move'), true, '');
      else if (lotW('me') / PARCEL < houseLot(i)) btn = `<span class="tag">🏗️ ${t('house_need_lot', { n: houseLot(i) })}</span>`;   // v0.52: not on this lot
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
  SHOP_AWAY = false;
  const SD = STORES[inside ? UI.inStore : store];
  const where = inside ? `<div class="store-in">${thumbImg('storein', UI.inStore, {}, 340, 150, 'store-pic')}<div class="row between"><b>${SD.e} ${t('store_inside', { name: nm(SD) })}</b><button class="btn small" data-act="leaveStore">🚪 ${t('store_leave')}</button></div></div>`
    : SD && cat !== 'sell' ? `<div class="store-banner"><span>${SD.e} ${t(atStore(store) ? 'store_here' : 'store_sells', { name: nm(SD) })}</span>${atStore(store) ? `<button class="btn small primary" data-act="enterStore" data-arg="${store}">🛍️ ${t('store_enter')}</button>` : `<button class="btn small primary" data-act="placeGo" data-arg="${store}">🚶 ${t('store_go')}</button>`}</div>` : '';
  return `<div class="shop-head"><h1 class="panel-title">${inside ? nm(SD) : t('shop_catalog')}</h1>
      <div class="row tight"><span class="pill">🪙 ${fmtNum(h.coins)}</span></div></div>
    ${where}${mallActs}
    ${inside ? '' : `<p class="muted note">${t('shop_money_note')}</p>`}
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
      <p class="muted">${t('steps_rule2', { n: fmtNum(stepBlock()), c: STEP_REWARD.coins, g: GOAL_REWARD.coins })} ${t('goal_auto')}</p>
      <div class="row between gap-top">${goalRow}</div>
      <p class="muted">${t('inclusive_note')}</p></div>
    <div class="card"><h3>💪 ${t('workouts_title')}</h3>${wks}<p class="muted">${t('workouts_rule', { c: WORKOUT_PAY })} ${t('wk_cap', { n: WORKOUT_PAY_MAX })}</p></div>
    <div class="card"><h3>🧘 ${t('mind_title')}</h3>
      <div class="vitals">
        <div><span>${t('mindful')}</span><b>${Math.round(d.mindful)} ${t('minutes')}</b></div>
        <div><span>${t('resp')}</span><b>${S.vitals.resp} ${t('per_min')}</b></div>
        <div><span>${t('rhr')}</span><b>${S.vitals.rhr} ${t('bpm')}</b></div>
        <div><span>HRV</span><b>${S.vitals.hrv} ms</b></div>
      </div><p class="muted">${t('mind_rule', { c: MINDFUL_REWARD })}</p></div>
    <div class="card"><h3>📵 ${t('focus_today')}</h3>
      <div class="big-num">${d.focusMin} <small>${t('minutes')}</small></div>
      <p class="muted">${t('focus_rule', { a: FOCUS_REWARD[30].coins, b: FOCUS_REWARD[60].coins, c: FOCUS_REWARD[120].coins })}</p>
      <div class="row between small-gap"><span class="muted">${t('distract_usage', { n: d.distractMin, limit: S.limitMin })}</span></div>
      <div class="bar warm"><i style="width:${disPct}%"></i></div>
      <div class="gap-top">${apps}</div>
      <p class="muted">${t('focus_note')}</p></div>
    <div class="card earn"><h3>💰 ${t('earned_today')}</h3>
      <div class="big-num">🪙${fmtNum(d.earned.coins)}</div>
      <p class="muted">${t('money_rule')}</p></div>
    ${trophyCard()}
    ${souvCard()}
    <div class="card"><h3>⌚ ${t('devices_title')}</h3><p class="muted">${t('devices_text')}</p></div>
    ${privacyCard()}
    <div class="card privacy-card"><h3>⚙️ ${t('settings')}</h3>
      <div class="row between"><span>${t('language')}</span><span>
        <button class="chip ${S.lang === 'zh' ? 'on' : ''}" data-act="lang" data-arg="zh">中文</button>
        <button class="chip ${S.lang === 'en' ? 'on' : ''}" data-act="lang" data-arg="en">English</button></span></div>
      ${[['music', '🎵', 'toggleMusic', S.music !== false], ['sfx', '🔊', 'toggleSfx', S.sfx !== false], ['amb', '🌧️', 'toggleAmb', S.amb !== false]].map(([k, e, act, on]) => `<div class="vol-row"><label class="row between toggle-row"><span>${e} ${t('set_' + k)}${k === 'amb' ? `<small>${t('set_amb_note')}</small>` : ''}</span><input type="checkbox" class="switch" data-act="${act}" ${on ? 'checked' : ''}></label>`
        + `<input type="range" class="vol-slider" id="vol_${k}" min="0" max="100" step="5" value="${Math.round(volOf(k) * 100)}" aria-label="${t('set_' + k)}"></div>`).join('')}
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
      <div class="row tight"><button class="btn small" data-act="mailOpen" data-arg="box">${n ? t('mail_unread', { n }) : t('mail_open')}</button>
      <button class="btn small primary" data-act="compose">✉️ ${t('write_letter')}</button></div></div></div>`;
  const feed = S.feed.filter(feedVisible);
  const calm = `<button class="chip ${S.calm ? 'on' : ''}" data-act="calm">😌 ${t('calm_title')}${S.calm ? ' ✓' : ''}</button>`;
  if (!feed.length) return `<h1 class="panel-title">${t('tab_feed')}</h1>${mail}<p class="muted center gap-top">${t('feed_empty')}</p>`;
  // v0.43: today's news and older news, each a little card: their face with a badge for what happened, what, when
  const day0 = new Date(now()); day0.setHours(0, 0, 0, 0);
  const row = it => {
    const btn = it.gift ? (it.claimed ? `<span class="nt-done">✓ ${t('claimed')}</span>` : `<button class="btn small primary" data-act="claim" data-arg="${it.id}">🎁 ${t('claim')}</button>`)
      : it.kind === 'stole' || it.kind === 'caught' ? `<button class="btn small" data-act="goTo" data-arg="${it.from}">${t('visit_back')}</button>`
      : it.kind === 'letter' ? `<button class="btn small" data-act="mailOpen" data-arg="box">💌 ${t('read')}</button>` : '';
    return `<div class="feed-item" style="--nk:${noteKind(it.kind).c}">${noteFace(it)}<div class="grow"><div class="nt-text">${feedText(it)}</div><div class="nt-time">${ago(it.t)}</div></div>${btn}</div>`;
  };
  // v0.64: FEED_PAGE.per a page, newest first
  const all = [...feed].reverse(), pages = Math.max(1, Math.ceil(all.length / FEED_PAGE.per)), pg = Math.min(pages - 1, Math.max(0, UI.feedPage || 0)), list = all.slice(pg * FEED_PAGE.per, (pg + 1) * FEED_PAGE.per);
  const fresh = list.filter(it => it.t >= day0.getTime()), old = list.filter(it => it.t < day0.getTime());
  const group = (title, L) => (L.length ? `<div class="feed-group">${title}</div>${L.map(row).join('')}` : '');
  const pager = pages > 1 ? `<div class="feed-pager"><button class="btn small" data-act="feedPage" data-arg="${pg - 1}" ${pg ? '' : 'disabled'}>‹ ${t('feed_prev')}</button><span class="muted">${t('feed_page', { n: pg + 1, m: pages })}</span><button class="btn small" data-act="feedPage" data-arg="${pg + 1}" ${pg < pages - 1 ? '' : 'disabled'}>${t('feed_next')} ›</button></div>` : '';
  return `<h1 class="panel-title">${t('tab_feed')}</h1>${mail}<div class="row between note"><p class="muted">${t('feed_note')} ${t('feed_keep', { n: FEED_PAGE.keepDays })}</p>${calm}</div><div class="feed-list">${group(t('feed_today'), fresh)}${group(t('feed_earlier'), old)}</div>${pager}`;
}

// v0.20: the next step of a farm area or the garage, for the estate agent's plans
function landDeal(kind) {
  const h = S.me;
  if (kind === 'garage') { const lv = h.garageLv || 0, next = GARAGE[lv + 1]; return { next, cost: next && next.cost, sub: next ? `${nm(next)} · ${t(lv ? 'garage_up' : 'garage_new', { n: next.cap })}` : t('garage_max') }; }
  if (kind === 'field' && h.plots) return plotDeal();   // v0.46
  const [levels, key] = { field: [FIELD_COST, 'fieldLv'], pasture: [PASTURE, 'pastureLv'], orchard: [ORCHARD, 'orchardLv'], pond: [POND, 'pondLv'] }[kind], lv = h[key], next = levels[lv + 1], cost = next && (next.cost || next);
  let sub;
  if (kind === 'field') sub = next ? t('land_field_sub', { a: FIELD_LEVELS[lv], b: FIELD_LEVELS[lv + 1] }) : t('land_field_max', { n: FIELD_LEVELS[lv] });
  else if (kind === 'pasture') sub = next ? t(lv ? 'land_pasture_sub' : 'land_pasture_new', { lv: lv + 1, cap: next.cap }) : t('land_pasture_max', { cap: PASTURE[lv].cap });
  else if (kind === 'orchard') sub = next ? t(lv ? 'land_orchard_sub' : 'land_orchard_new', { n: next.slots }) : t('land_orchard_max', { n: ORCHARD[lv].slots });
  else sub = next ? t(lv ? 'land_pond_sub' : 'land_pond_new', { n: next.cap, m: FISH_EVERY }) : t('land_pond_max', { n: POND[lv].cap });
  return { next, cost, sub };
}
// v0.20: names and pictures of things for sale in a store
function wareName(w) {
  if (w.kind === 'seed') return `${CROPS[w.k].e} ${nm(CROPS[w.k])}`;
  if (w.kind === 'tree') return `${TREES[w.k].e} ${nm(TREES[w.k])}`;
  if (w.kind === 'animal') return `${ANIMALS[w.k].e} ${nm(ANIMALS[w.k].baby)}`;
  if (w.kind === 'pet') return `${PET_BREEDS[w.k].kind === 'dog' ? '🐕' : '🐈'} ${nm(PET_BREEDS[w.k])}`;
  if (w.kind === 'petfood') return `${PET_FOOD[w.k].e} ${nm(PET_FOOD[w.k])}`;
  if (w.kind === 'feed') return `${FEED.e} ${nm(FEED)}`;   // v0.44
  if (w.kind === 'furn') return nm(FURN[w.k]);
  if (w.kind === 'yard') return nm(YARD[w.k]);
  if (w.kind === 'car') return nm(CARS[w.k]);
  if (w.kind === 'house') return nm(HOUSES[+w.k]);
  if (w.kind === 'land') return t('land_' + w.k);
  if (w.kind === 'clothes') return `${CLOTHES[w.k].e} ${nm(CLOTHES[w.k])}`;
  if (w.kind === 'excl') { const [kind, k] = w.arg.split('|'); return `🏆 ${nm(exclDef(kind, k))}`; }
  if (w.kind === 'act') return t('act_' + w.k);
  return w.k;
}
function warePic(w) {
  if (w.kind === 'seed') return thumbImg('crop', w.k);
  if (w.kind === 'tree') return thumbImg('tree', w.k, { fruit: true });
  if (w.kind === 'animal') return thumbImg('animal', w.k, { stage: 0 });
  if (w.kind === 'pet') return thumbImg('pet', w.k, {});
  if (w.kind === 'petfood') return `<div class="emoji-thumb">${PET_FOOD[w.k].e}</div>`;
  if (w.kind === 'feed') return `<div class="emoji-thumb">${FEED.e}</div>`;
  if (w.kind === 'furn' || w.kind === 'yard') return thumbImg(w.kind, w.k);
  if (w.kind === 'car') return thumbImg('car', w.k, { color: CARS[w.k].look || CAR_COLORS[0] });
  if (w.kind === 'house') return thumbImg('house', +w.k, { wall: S.me.wall, roof: S.me.roof });
  if (w.kind === 'land') return thumbImg(w.k === 'garage' ? 'garage' : w.k, w.k === 'garage' ? 'g' : 'p', { n: Math.min(5, (S.me.garageLv || 0) + 1) });
  if (w.kind === 'clothes') return thumbImg('outfit', w.k, { look: { ...S.me.look, [CLOTHES[w.k].slot]: w.k } });
  if (w.kind === 'excl') { const [kind, k] = w.arg.split('|'), d = exclDef(kind, k); return kind === 'yard' ? thumbImg('yard', k) : kind === 'car' ? thumbImg('car', k, { color: d.color }) : kind === 'pet' ? thumbImg('pet', k, {}) : thumbImg('animal', k, { stage: 2 }); }
  return '';
}
const wareKey = (act, arg) => {   // which thing on show a catalogue button means
  const [a, b] = String(arg).split('|');
  return { buySeed: 'seed:' + a, buyTree: 'tree:' + a, buyAnimal: 'animal:' + a, buyFeed: 'feed:feed', adopt: 'pet:' + a, buyPetFood: 'petfood:' + a, buyItem: (a === 'room' ? 'furn:' : 'yard:') + b,
    buyCar: 'car:' + a, buyHouse: 'house:' + a, moveHouse: 'house:' + a, buyLand: 'land:' + a, buyClothes: 'clothes:' + a, buyExcl: 'excl:' + arg }[act] || null;
};
// ---------- sheets ----------
function openSheet(type, arg) {
  if (type === 'souvenir') Sound.play('chime');
  if (type === 'trophyNew') { Sound.play('levelup'); setTimeout(() => Sound.play('coins'), 500); }
  UI.sheet = { type, arg };
  renderSheet();
  const compact = ['friend', 'host', 'go', 'field', 'animal', 'car', 'tree', 'ware', 'food', 'claw', 'cinema'].includes(type);
  $('#sheet').className = 'sheet' + (compact ? ' compact' : '') + (type === 'pets' || type === 'trophies' ? ' tall' : '') + (type === 'phone' ? ' phone-sheet' : '');
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
  phone(arg) { return phoneScreen(arg || 'home'); },   // v0.26
  loan(wid) {   // v0.26: the loan offer, before you sign
    const w = Scene.shopWare(wid); if (!w) return '';
    const kind = w.kind === 'house' ? 'house' : 'car', k = kind === 'house' ? +w.k : w.k, q = loanQuote(kind, k), chk = loanCheck(kind, k), name = nm(kind === 'house' ? HOUSES[k] : CARS[k]);
    const row = (a, b) => `<div class="row between"><span>${a}</span><b>${b}</b></div>`;
    return `<h2>🏦 ${t('loan_title', { name })}</h2><div class="card">${row(t('loan_price'), '🪙' + q.price.toLocaleString())}${row(t('loan_down'), '🪙' + q.down.toLocaleString() + (q.wood ? ` + 🪵${q.wood}` : ''))}
      ${row(t('loan_amount'), '🪙' + q.amount.toLocaleString())}${row(t('loan_daily'), t('loan_daily_v', { n: q.perDay.toLocaleString(), y: q.years }))}${row(t('loan_fee', { p: +(q.apr * 100).toFixed(1), y: q.years }), '🪙' + q.fee.toLocaleString())}
      ${row(t('loan_income'), t('loan_income_v', { n: fmtNum(avgIncome()), r: fmtNum(loanRoom()) }))}</div>
      <p class="muted small">${t('loan_rule')}</p>
      ${chk === 'ok' ? `<button class="btn primary block" data-act="loanSign" data-arg="${wid}">✍️ ${t('loan_sign')}</button>` : `<p class="host-say">${t('loan_no_' + chk, { n: fmtNum(q.perDay), r: fmtNum(loanRoom()) })}</p>`}`;
  },
  // v0.31: getting along with someone, like The Sims: how well you get on, their mood today, their traits and hobbies
  // (once you know them), and things to do together, in groups; some need you to be closer friends first.
  social(id) {
    const w = whoIs(id);
    if (!w) return '';
    const v = relOf(id), lv = relLevel(v), md = moodOf(id), T = traitsOf(id), K = knownOf(id), near = canReach(id) && UI.socWalk !== id;   // v0.34: you walk over when you pick one
    const cat = UI.socCat || 'friendly', busy = UI.socBusy && UI.socBusy > Date.now(), lo = REL_LEVELS[0].min, span = 100 - lo;
    const pct = (v - lo) / span * 100, zero = -lo / span * 100;
    const bar = `<div class="relbar"><i class="${v < 0 ? 'neg' : ''}" style="left:${Math.min(zero, pct)}%;width:${Math.abs(pct - zero)}%"></i><u style="left:${zero}%"></u></div>`;
    const traits = traitsKnown(id) ? T.map(k => `<span class="chip">${TRAITS[k].e} ${nm(TRAITS[k])}</span>`).join('') : `<span class="muted small">❔ ${t('soc_unknown')}</span>`;
    const ints = K.int.length ? K.int.map(k => `<span class="chip">${INTERESTS[k].e} ${nm(INTERESTS[k])}</span>`).join('') : `<span class="muted small">❔ ${t('soc_ask_hobby')}</span>`;
    const tabs = SOCIAL_CATS.map(([c, e]) => `<button class="chip ${c === cat ? 'on' : ''}" data-act="socCat" data-arg="${c}">${e} ${t('soc_cat_' + c)}</button>`).join('');
    let grid;
    if (cat === 'gift') {
      const items = Object.keys(S.me.barn).filter(k => !k.startsWith('baby_') && S.me.barn[k] > 0).slice(0, 9);
      grid = items.length ? items.map(k => { const b = barnInfo(k); return `<button class="act-tile" data-act="social" data-arg="${id}|gift|${k}" ${busy || !near ? 'disabled' : ''}><span>${b.e}</span><b>${b.name}</b><i>×${S.me.barn[k]}</i></button>`; }).join('') : `<p class="muted">${t('soc_gift_none')}</p>`;
    } else grid = Object.entries(SOCIALS).filter(([, A]) => A.cat === cat).flatMap(([k, A]) => k !== 'interest' ? [[k, A]] : [...new Set([...myInterests(), ...K.int])].map(tp => [k, A, tp])).map(([k, A, tp]) => { const lock = socialLocked(id, k);
      if (tp) return `<button class="act-tile" data-act="social" data-arg="${id}|interest|${tp}" ${busy || !near ? 'disabled' : ''}><span>${INTERESTS[tp].e}</span><b>${t('soc_talk_about', { topic: nm(INTERESTS[tp]) })}</b>${K.int.includes(tp) ? `<i>💛 ${t('soc_they_like_short')}</i>` : ''}</button>`;
      return `<button class="act-tile" data-act="social" data-arg="${id}|${k}" ${busy || lock || !near ? 'disabled' : ''}><span>${lock ? '🔒' : A.e}</span><b>${nm(A)}</b>${lock ? `<i>${t('soc_lock', { level: nm(relLevel(A.min)) })}</i>` : ''}</button>`; }).join('');
    // v0.51: what you just said to each other, then how it went
    const log = UI.socLast && UI.socLast.id === id && UI.socLast.lines ? `<div class="talk-log">${UI.socLast.lines.map(l => `<div class="tl ${l.me ? 'me' : 'them'}"><span>${esc(l.text)}</span></div>`).join('')}</div>` : '';
    const last = UI.socLast && UI.socLast.id === id ? `${log}<div class="soc-last ${UI.socLast.ok ? 'ok' : 'bad'}">${UI.socLast.html}</div>` : '';
    const hm = !w.wp && homeOf(id), canVisit = hm && townOf(id) === myTown() && !UI.visit;
    return `<div class="profile">${avatar(w.look, 'xl')}<div class="grow"><div class="profile-name">${esc(w.name)} <span>${MOOD_E[md]}</span></div>
        <div class="muted small">${roleOf(id)}</div>
        <div class="muted small">${lv.e} ${nm(lv)} · ${v} · ${t('smood_' + md)}</div>${bar}</div></div>
      <div class="soc-info"><div><span class="muted small">${t('soc_traits')}</span>${traits}</div><div><span class="muted small">${t('soc_likes')}</span>${ints}</div><div class="muted small">${t('soc_my_likes')} ${myInterests().map(k => INTERESTS[k].e).join(' ')}</div></div>
      ${last}${busy ? `<p class="muted center soc-wait">💬 …</p>` : ''}${UI.socWalk === id ? `<p class="muted center soc-wait">🚶 ${t('soc_walking', { name: esc(w.name) })}</p>` : ''}
      <div class="soc-cats">${tabs}</div>
      <div class="act-grid">${grid}</div>
      ${near || UI.socWalk === id ? '' : `<p class="muted small center gap-top">${t('soc_need_near', { name: esc(w.name) })}</p>`}
      ${canVisit ? `<button class="btn block gap-top" data-act="goTo" data-arg="${id}">🏡 ${t('visit')}</button>` : ''}`;
  },
  garage() {   // v0.24: which car is where (drive, garage, parked out) and which one you drive
    const h = S.me, sl = carSlots(h), where = i => (i === h.car && S.carAt ? `📍 ${S.carAt.place ? nm(placeInfo(S.carAt.place)) : t('away_street')}` : sl.garage.includes(i) ? `🅿️ ${t('in_garage')}` : `🚗 ${t('on_drive')}`);
    const rows = h.cars.map((c, i) => `<div class="list-item">${thumbImg('car', c.k, { color: c.color }, 84, 56, 'thumb sm')}<div class="grow"><b>${nm(CARS[c.k])}</b><div class="muted small">${where(i)}</div></div>${i === h.car ? `<span class="tag ok">${t('car_driving')}</span>` : `<button class="btn small" data-act="driveCar" data-arg="${i}">${t('car_drive')}</button>`}</div>`).join('');
    return `<h2>🅿️ ${h.garageLv ? nm(GARAGE[h.garageLv]) : t('land_garage')}</h2><p class="muted">${t('garage_spaces', { d: driveCap(h), g: garageCap(h), n: h.cars.length })}</p><div class="card">${rows || `<p class="muted">${t('no_cars')}</p>`}</div>
      <div class="card row"><div class="grow"><b>🪪 ${t('my_plate')}</b><div class="muted small">${t('my_plate_d', { state: nm(stateOf(myTown())) })}</div></div>${plateHtml(countyOf(myTown()).state, myPlate())}</div>`;   // v0.40
  },
  ware(id) {
    const w = Scene.shopWare(id);
    if (!w) return '';
    const B = UI.basket || { items: [] }, tot = B.items.reduce((t2, e) => t2 + e.price, 0);
    let info = '', btns = '';
    if (w.kind === 'seed') { const c = CROPS[w.k]; info = t('seed_sub', { d: fmtDur(c.grow * MIN), n: c.yield, p: c.sell }) + (S.me.seeds[w.k] ? ` · ${t('have_n', { n: S.me.seeds[w.k] })}` : '');
      btns = [1, 5, 10].map(n => `<button class="btn small ${n === 5 ? 'primary' : ''}" data-act="addWare" data-arg="${w.id}#${n}">🛒 ×${n} 🪙${c.seed * n}</button>`).join(''); }
    else if (w.kind === 'house') { const i = +w.k, H = HOUSES[i], own = S.me.houses.includes(i), need = houseLot(i), small = lotW('me') / PARCEL < need;
      info = `${t('house_room', { w: H.room[0], d: H.room[1] })} · ${t('house_floors', { n: H.floors[0], max: H.floors[1] })}${need > CORE_PARCELS ? ` · <b class="${small ? 'warn-text' : ''}">🏗️ ${t('house_need_lot', { n: need })}</b>` : ''}${small ? `<br><span class="muted small">${t('house_need_lot_note', { n: lotW('me') / PARCEL, max: zoneOf('me').max, zone: nm(zoneOf('me')) })}</span>` : ''}`;   // v0.52
      btns = i === S.me.house ? `<span class="tag ok">${t('house_current')}</span>` : `<button class="btn primary" data-act="wareDeal" data-arg="${w.id}" ${!small && (own || canAfford(H.cost)) ? '' : 'disabled'}>✍️ ${own ? t('house_move') : `${t('ware_sign')} ${costText(H.cost)}`}</button>${own ? '' : loanBtn('house', i, w.id)}`; }
    else if (w.kind === 'land') { const L = landDeal(w.k); info = L.sub; btns = L.next ? `<button class="btn primary" data-act="wareDeal" data-arg="${w.id}" ${canAfford(L.cost) ? '' : 'disabled'}>✍️ ${t('ware_sign')} ${costText(L.cost)}</button>` : `<span class="tag ok">${t('maxed')}</span>`; }
    else if (w.kind === 'car') { const own = S.me.cars.some(c => c.k === w.k); info = t('car_cargo', { n: CARS[w.k].cargo || WALK_CARRY }) + ' · ' + t('car_delivered', { h: DELIVERY.hour, n: deliveryFee([{ price: CARS[w.k].cost.coins || 0 }]) });
      btns = own ? `<span class="tag ok">${t('owned')}</span>` : `<button class="btn primary" data-act="wareDeal" data-arg="${w.id}" ${canAfford(CARS[w.k].cost) ? '' : 'disabled'}>✍️ ${t('ware_sign')} ${costText(CARS[w.k].cost)}</button>${loanBtn('car', w.k, w.id)}`; }
    else if (w.kind === 'act') { info = t('st_short_mall'); btns = `<button class="btn primary" data-act="mallAct" data-arg="${w.k}">${t('act_' + w.k)}</button>`; }
    else {
      const r = wareCheck(w, B.items), vol = wareVol({ ...w, n: 1 });
      if (w.kind === 'tree') { const d = TREES[w.k]; info = t('tree_sub', { d: fmtDur(d.grow * MIN), e: GOODS[d.fruit].e, n: d.n, every: fmtDur(d.every * MIN), p: GOODS[d.fruit].sell }); }
      else if (w.kind === 'animal') { const a = ANIMALS[w.k]; info = t('grows_up', { d: fmtDur(a.grow * MIN) }) + (a.prod ? ' · ' + t('animal_sub_prod', { d: fmtDur(a.every * MIN), e: GOODS[a.prod].e, n: a.n }) : ''); }
      else if (w.kind === 'pet') info = t('pet_sub_' + PET_BREEDS[w.k].kind);
      else if (w.kind === 'furn' || w.kind === 'yard') { const d = w.kind === 'furn' ? FURN[w.k] : YARD[w.k]; info = t('furn_sub', { w: d.w, d: d.d }) + (d.use ? ` · ${t('use_' + d.use)}` : ''); }
      else if (w.kind === 'clothes') info = t('slot_' + CLOTHES[w.k].slot);
      else if (w.kind === 'excl') { const [kind, k] = w.arg.split('|'); info = exclReqText(exclDef(kind, k).excl); }
      info += ` · ${vol > BIG_VOL ? `🚚 ${t('ware_big')}` : `🤲 ${t('ware_small')}`}`;
      btns = `<button class="btn primary" data-act="addWare" data-arg="${w.id}" ${r === 'ok' ? '' : 'disabled'}>🛒 ${t('basket_add')} 🪙${fmtNum(w.price)}</button>${r === 'ok' ? '' : `<p class="muted small">${t('ware_no_' + r, { n: PET_MAX })}</p>`}`;
    }
    const bag = B.items.length ? `<button class="btn block gap-top" data-act="goTill">💳 ${t('basket_pay', { n: B.items.length, v: fmtNum(tot) })}</button>` : '';
    return `<div class="row">${warePic(w).replace('class="thumb"', 'class="thumb ware-pic"')}<div class="grow"><h2>${wareName(w)}</h2><p class="muted small">${info}</p></div></div>
      <div class="ware-btns">${btns}</div>${bag}`;
  },
  specials(town) { return `<div class="place-head"><span class="big-emoji">🧺</span><div class="grow"><h2>${t('sp_market_local')} · ${nm(countyOf(town))}</h2><p class="muted">${t('sp_market_local_d')}</p></div></div>` + specialsBody(town); },
  checkout() {
    const B = UI.basket || { items: [], store: UI.inStore }, S2 = STORES[B.store || UI.inStore], tot = B.items.reduce((t2, e) => t2 + e.price, 0);
    const hello = `<div class="row"><span class="big-emoji">💁</span><p class="grow">${t(B.items.length ? 'clerk_pay' : 'clerk_hi', { name: nm(S2) })}</p></div>`;
    const sell = B.store === 'market' ? `<button class="btn block gap-top" data-act="placeGo" data-arg="market">💰 ${t('clerk_sell')}</button>` : '';
    if (!B.items.length) return `<h2>${S2.e} ${nm(S2)}</h2>${hello}${sell}${UI.inStore ? staffChat(UI.inStore) : ''}`;   // v0.40: the person at the till has a name
    const rows = B.items.map((e, i) => `<div class="list-item"><div class="grow">${wareName(e)}${e.n > 1 ? ` ×${e.n}` : ''} <span class="muted small">${e.vol > BIG_VOL ? '🚚' : '🤲'}</span></div><b>🪙${fmtNum(e.price)}</b><button class="btn small" data-act="dropWare" data-arg="${i}">✕</button></div>`).join('');
    const ways = takeHomeWays(B.items, B.store).map(x => {
      const label = x.how === 'hands' ? `🤲 ${t('take_hands')}` : x.how === 'trunk' ? `🚗 ${t('take_trunk')}` : `🚚 ${t('take_deliver', { n: x.fee, h: DELIVERY.hour })}`;
      const why = x.ok ? (x.how === 'trunk' ? t('take_trunk_ok', { v: x.vol, c: x.cap }) : x.how === 'hands' ? t('take_hands_ok') : t('take_deliver_ok')) : t('take_no_' + x.why);
      return `<button class="act-tile wide" data-act="payWith" data-arg="${x.how}" ${x.ok && S.me.coins >= tot + (x.fee && x.how === 'deliver' ? x.fee : 0) ? '' : 'disabled'}><span>${label.split(' ')[0]}</span><b>${label.slice(label.indexOf(' ') + 1)}</b><i>${why}</i></button>`;
    }).join('');
    return `<h2>💳 ${t('checkout_title')}</h2>${hello}<div class="card">${rows}<div class="row between gap-top"><b>${t('checkout_total')}</b><b>🪙${fmtNum(tot)}</b></div></div>
      <div class="sec-title">${t('take_how')}</div><div class="act-grid one">${ways}</div>${sell}`;
  },
  cinema() {
    const seen = S.mall.movies;
    return `<h2>🎬 ${t('act_cinema')}</h2><p class="muted">${t('cinema_note', { n: MALL.movie })} · ${t('seen_n', { n: seen.length, total: Object.keys(MALL.movies).length })}</p><p class="use-note">🎞️ ${t('cinema_use', { f: NEED_GAIN.movie, s: NEED_GAIN.movieSocial })}</p>
      <div class="wd-grid">${Object.entries(MALL.movies).map(([k, m]) => `<button class="wd-card ${seen.includes(k) ? 'on' : ''}" data-act="watchMovie" data-arg="${k}">
        <span class="big-emoji">${m.e}</span><span>${nm(m)}${seen.includes(k) ? ' ✓' : ''}</span><span class="muted small">🪙${MALL.movie}</span></button>`).join('')}</div>`;
  },
  movie(k) {
    const m = MALL.movies[k];
    return `<h2>${m.e} ${nm(m)}</h2><canvas id="movieCv" class="movie-cv"></canvas><button class="btn block gap-top" data-act="close">${t('movie_leave')}</button>`;
  },
  claw() {
    const got = S.mall.plush;
    return `<h2>🕹️ ${t('act_claw')}</h2><div class="jail-pic">${thumbImg('claw', 'm', {}, 300, 150, 'store-pic')}</div>
      <p class="muted">${t('claw_note2')}</p>
      ${gameBlock('claw')}
      <div class="plush-row">${Object.entries(MALL.plush).map(([k, e]) => `<span class="${got.includes(k) ? 'on' : ''}" title="${nm(FURN[k])}">${e}</span>`).join('')}</div>
      <p class="muted small">${t('claw_got', { n: got.length, total: Object.keys(MALL.plush).length })}</p>`;
  },
  food(only) {
    const tried = S.mall.foods;
    if (only && MALL.foods[only]) { const f = MALL.foods[only]; return `<div class="row"><span class="big-emoji xl">${f.e}</span><div class="grow"><h2>${nm(f)}</h2><p class="muted">🪙${f.price} · ${tried.includes(only) ? '✓ ' + t('food_had') : t('food_new')}</p></div></div><p class="use-note">😋 ${t('food_use', { h: MALL.fed.hours, p: Math.round(MALL.fed.pay * 100), w: Math.round(MALL.fed.walk * 100) })}</p><button class="btn primary block" data-act="eatFood" data-arg="${only}" ${S.me.coins >= f.price ? '' : 'disabled'}>😋 ${t('food_buy', { n: f.price })}</button>`; }
    return `<h2>🍔 ${t('act_food')}</h2><p class="muted">${t('food_note')} · ${t('tried_n', { n: tried.length, total: Object.keys(MALL.foods).length })}</p><p class="use-note">😋 ${t('food_use', { h: MALL.fed.hours, p: Math.round(MALL.fed.pay * 100), w: Math.round(MALL.fed.walk * 100) })}${isFed() ? ` · ${t('food_still', { m: fmtDur(S.fed.until - now()) })}` : ''}</p>
      <div class="wd-grid">${Object.entries(MALL.foods).map(([k, f]) => `<button class="wd-card ${tried.includes(k) ? 'on' : ''}" data-act="eatFood" data-arg="${k}">
        <span class="big-emoji">${f.e}</span><span>${nm(f)}</span><span class="muted small">🪙${f.price}</span></button>`).join('')}</div>`;
  },
  wardrobe() {
    const L = S.me.look, own = S.me.wardrobe || CLOTHES_FREE, tab = UI.wdTab || 'body';
    const sw = (list, cur, f) => list.map(c => `<button class="swatch sm ${c === cur ? 'on' : ''}" style="background:${c}" data-act="wdSet" data-arg="${f}|${c}"></button>`).join('');
    const tabs = [['body', '🧍'], ['top', '👕'], ['bottom', '👖'], ['shoes', '👟'], ['hat', '🧢']];
    const tabRow = `<div class="sub-cats wd-tabs">${tabs.map(([k, e]) => `<button class="sub ${tab === k ? 'on' : ''}" data-act="wdTab" data-arg="${k}">${e} ${t('wd_' + k)}</button>`).join('')}</div>`;
    let body;
    if (tab === 'body') {
      body = `<div class="wd-grid">${Object.entries(BODY_TYPES).map(([k, B]) => `<button class="wd-card ${(L.body || 'regular') === k ? 'on' : ''}" data-act="wdSet" data-arg="body|${k}">
          ${thumbImg('outfit', 'b_' + k, { look: { ...L, body: k } }, 84, 100, 'thumb xs')}<span>${nm(B)}</span></button>`).join('')}</div>
        <div class="look-row"><span>✋</span><div class="swatches left">${sw(SKINS, L.skin, 'skin')}</div></div>
        <div class="look-row"><span>💇</span><div>${HAIRS.map(hs => `<button class="chip ${L.hair === hs ? 'on' : ''}" data-act="wdSet" data-arg="hair|${hs}">${t('hair_' + hs)}</button>`).join('')}</div></div>
        <div class="look-row"><span>🎨</span><div class="swatches left">${sw(HAIR_COLORS, L.hairCol, 'hairCol')}</div></div>
        <p class="muted small">${t('wd_body_note')}</p>`;
    } else {
      const colF = { top: 'shirt', bottom: 'pants', shoes: 'shoeCol', hat: 'hatCol' }[tab];
      const curCol = L[colF] || { pants: '#4a5a78', shoeCol: '#3b3028', hatCol: '#e5484d' }[colF];
      const items = Object.entries(CLOTHES).filter(([k, c]) => c.slot === tab && own.includes(k));
      body = `<div class="wd-grid">${items.map(([k, c]) => `<button class="wd-card ${wearing(L, tab) === k ? 'on' : ''}" data-act="wear" data-arg="${k}">
          ${thumbImg('outfit', 'w_' + k, { look: { ...L, [tab]: k } }, 84, 100, 'thumb xs')}<span>${c.e} ${nm(c)}</span></button>`).join('')}</div>
        ${tab === 'hat' && wearing(L, 'hat') === 'nohat' ? '' : `<div class="look-row"><span>🎨</span><div class="swatches left">${sw(CLOTH_COLORS, curCol, colF)}</div></div>`}
        ${tab === 'bottom' && wearing(L, 'top') === 'dress' ? `<p class="muted small">${t('wd_dress_note')}</p>` : ''}
        <button class="btn block gap-top" data-act="openShop" data-arg="clothes">🛍️ ${t('wd_more')}</button>`;
    }
    return `<h2>👗 ${t('wardrobe')}</h2><div class="wd-preview">${thumbImg('outfit', 'me', { look: L }, 120, 140, 'thumb')}</div>${tabRow}${body}`;
  },
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
    const e = energyLevel(), s = S.sleep || {}, n = needs(), home = !(S.out && S.out.town === myTown()) && !S.work && !S.study;
    const row = (k, ic, v, tip2) => `<div class="mn-row"><span>${ic} ${t('need_' + k)}</span><div class="bar ${v < 30 ? 'low' : ''}"><i style="width:${Math.round(v)}%"></i></div><b>${Math.round(v)}</b><div class="muted small need-tip">${tip2}</div></div>`;
    const needsCard = `<div class="card gap-top"><b>${t('needs_title')}</b> <span class="muted small">${moodGood() ? '😊 ' + t('mood_good', { p: Math.round(NEEDS.moodPay * 100) }) : moodBad() ? '😞 ' + t('mood_bad', { p: Math.round(NEED_LOW.badPay * 100) }) : t('mood_note')}</span>
      <p class="muted small">${t('needs_rules', { n: NEED_LOW.low, b: NEED_LOW.badMood, p: Math.round(NEED_LOW.badPay * 100), g: NEEDS.goodMood, q: Math.round(NEEDS.moodPay * 100) })}</p>
      ${row('hunger', '🍔', n.hunger, t('need_hunger_tip'))}${row('social', '💬', n.social, t('need_social_tip'))}${row('fun', '🎉', n.fun, t('need_fun_tip'))}
      ${home ? `<button class="btn block gap-top" data-act="cook" ${canCook() ? '' : 'disabled'}>🍳 ${t(canCook() ? 'cook_btn' : 'cook_need_kitchen')}</button>` : ''}</div>`;
    return `<div class="center"><div class="big-emoji xl">${ENERGY_EMOJI[e]}</div><h2>${energyName(e)} · ${energyScore()}</h2></div>
      <p>${t('energy_desc_' + e)}</p>
      <div class="card gap-top"><div class="row between"><span>${t('sleep_title')}</span><b>${s.score || '–'}</b></div>
        <div class="row between"><span>${t('today_mult')}</span><b>${multText(energyMult())}</b></div>
        <p class="muted">${t('energy_note')}</p></div>
      ${needsCard}<button class="btn block gap-top" data-act="tab" data-arg="real">❤️ ${t('see_health')}</button>
      <button class="btn block gap-top" data-act="wardrobe">👗 ${t('wardrobe')}</button>`;
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
      return `<h2>🌱 ${t('plant_title')}</h2><p class="muted">${t('plant_walk')}</p><div class="card">${list}</div>`;
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
    const P = placeInfo(key), here = Scene.here() === key || Scene.here() === VENUE_HOME[key] || (UI.inVenue === key), mineTown = VIEW_TOWN === myTown() || !!(S.trav && S.trav.town === VIEW_TOWN);   // (v0.62: or the city you're in)
    const head = `<div class="place-head"><span class="big-emoji">${P.e}</span><div class="grow"><h2>${nm(P)}</h2><p class="muted">${t(STORES[key] && key !== 'market' ? 'st_short_' + key : 'pl_desc_' + (key === 'lake' && P === PLACE_INFO.beach ? 'beach' : key))}</p></div></div>` + placeCard(key);
    if (!mineTown) return head + `<p class="muted">${t('pl_other_town')}</p>`;
    if (!here && key === 'market') return head + marketBody(false) + `<div class="sec-title">${t('mk_go')}</div>${goTiles(goTarget({ place: key }))}<p class="muted small center">${t('mk_carry', { w: WALK_CARRY, c: carryCap('car') })}</p>`;
    if (!here && key !== 'plaza') return head + `<div class="sec-title">${t('pl_go_first')}</div>${goTiles(goTarget({ place: key }))}` + (S.job && S.job.place === key && (S.job.town || myTown()) === VIEW_TOWN ? jobSection(key) : '');   // v0.62: your job: how you commute
    const inside = UI.inVenue && (UI.inVenue === key || VENUE_HOME[UI.inVenue] === key);
    const inBtn = VENUE_PLACES.includes(key) && here && !inside ? `<button class="btn primary block" data-act="enterVenue" data-arg="${key}">🚪 ${t('venue_enter')}</button>` : '';   // v0.30
    return head + inBtn + (inside ? staffChat(UI.inVenue) : '') + wxGate(key, placeBody(key));   // v0.50: bad weather outdoors
  },
  // v0.30: something inside a building
  spot(arg) { const v0 = String(arg).split('|')[0]; if (arg === 'stadium|bets' || arg === 'stadium|board' || arg === 'stadium|hotdog' || UI.inVenue === 'arena') return SHEETS.spotIn(arg);   /* (v0.64: the hot dogs are under the stands; the arena is indoors) */ return wxGate(VENUE_HOME[v0] || v0, SHEETS.spotIn(arg)); },   // v0.50
  spotIn(arg) {
    const [v0, k] = arg.split('|'), v = v0 === 'arena' ? 'stadium' : v0, key = v + '|' + k, gymK = v === 'gym';   // v0.59: the arena's spots are the stadium's
    if (v === 'park') {   // v0.32: something in the park: you need to be in the park; watch, feed, sit, bounce, or an ice cream
      const kind = PARK_KIND[k], here = Scene.here() === 'park';
      const head2 = `<div class="place-head"><span class="big-emoji">${SPOT_E[key]}</span><div class="grow"><h2>${t('sp_park_' + k)}</h2><p class="muted">${t('sp_park_' + k + '_d')}</p></div></div>`;
      if (!here) return head2 + `<div class="sec-title">${t('pl_go_first')}</div>${goTiles(goTarget({ place: 'park' }))}`;
      if (k === 'cart') { const F = MALL.foods.icecream; return head2 + `<button class="btn primary block gap-top" data-act="parkDo" data-arg="cart" ${S.me.coins >= F.price ? '' : 'disabled'}>🍦 ${t('pk_cart_btn', { n: F.price, h: FOOD_FILL.icecream, f: NEED_GAIN.sweetFun })}</button>`; }
      const sport = !!BALL_GAMES[k];   // v0.33: on a court you can play, not just watch
      return head2 + (sport ? sportBlock(k) : '') + (parkLeft(k) > 0 ? `<button class="btn ${sport ? '' : 'primary'} block gap-top" data-act="parkDo" data-arg="${k}">${sport ? '📣' : SPOT_E[key]} ${t('pk_' + kind + '_btn', { n: PARK[kind].fun })}</button>` : `<p class="muted center gap-top">✅ ${t(sport ? 'pk_watched' : 'sp_done_today')}</p>`);
    }
    const head = `<div class="place-head"><span class="big-emoji">${SPOT_E[key] || placeInfo(v).e}</span><div class="grow"><h2>${t('sp_' + v + '_' + k)}</h2><p class="muted">${t(gymK ? 'sp_gym_d' : 'sp_' + v + '_' + k + '_d', { n: SNACK.price })}</p></div></div>`;
    const go = (act, label, on = true) => `<button class="btn ${on ? 'primary' : ''} block gap-top" data-act="venueDo" data-arg="${v}|${k}|${act}" ${on ? '' : 'disabled'}>${label}</button>`;
    const once = (vk, act, label) => venueLeft(vk) > 0 ? go(act, label) : `<p class="muted center gap-top">✅ ${t('sp_done_today')}</p>`;
    const res = UI.spotRes && UI.spotRes.key === key ? `<div class="card gap-top">${UI.spotRes.html}</div>` : '';
    let body = '';
    if (['bakery|case', 'gas|shelf', 'gas|fridge', 'cafe|menu'].includes(key)) body = snackBtn(v);
    else if (key === 'bakery|oven') body = `<p>${t('pl_bake_note', { n: BREAD.wheat, have: S.me.barn.wheat || 0, bread: S.me.barn.bread || 0 })}</p>` + go('bake', `🍞 ${t('pl_bake')}`, (S.me.barn.wheat || 0) >= BREAD.wheat);
    else if (key === 'bakery|table') body = go('eat', `🥐 ${t('sp_eat_btn', { n: SNACK.price, h: FOOD_FILL.snack })}`, S.me.coins >= SNACK.price);
    else if (key === 'cafe|table') body = once('cafeChat', 'chat', `💬 ${t('sp_chat_btn', { n: VENUE.cafeChat.social })}`);
    else if (key === 'cafe|sofa') body = once('cafeSofa', 'relax', `🎧 ${t('sp_relax_btn', { n: VENUE.cafeSofa.fun })}`);
    else if (key === 'clinic|bed') body = S.sick && !S.sick.med ? `<p>${t('sick_here', { why: t('sick_why_' + (S.sick.why || 'cold')) })}</p><button class="btn primary block" data-act="buyMed">💊 ${t('sick_buy', { n: SICK.medicine })}</button>` : go('rest', S.sick ? `🛏️ ${t('sp_rest_med', { n: SICK.restSec })}` : `🛏️ ${t('sp_rest_btn')}`);
    else if (key === 'clinic|scale') body = go('check', `🩺 ${t('sp_check_btn')}`) + res;
    else if (key === 'clinic|pharmacy') body = S.sick ? (S.sick.med ? `<p class="host-say yes">💊 ${t('sick_med_have', { n: SICK.restSec })}</p>` : `<button class="btn primary block" data-act="buyMed">💊 ${t('sick_buy', { n: SICK.medicine })}</button>`) : `<p>${t('sick_well')}</p>`;
    else if (key === 'library|featured') { const c = libCard(), P2 = placeDay(); body = `<div class="card lib-card"><p class="lib-text">${nm(c)}</p></div><button class="btn ${P2.lib ? '' : 'primary'} block" data-act="placeDo" data-arg="library|read|" ${P2.lib ? 'disabled' : ''}>${P2.lib ? `✅ ${t('pl_read')}` : `📖 ${t('pl_read_it')}`}</button>`; }
    else if (key === 'library|table') body = once('libRead', 'readbook', `📖 ${t('sp_read_btn', { n: VENUE.libRead.fun })}`);
    else if (gymK) body = venueLeft('gym') > 0 ? go('gym', `💪 ${t('sp_gym_btn', { n: VENUE.gym.fun })}`) + `<p class="muted small center">${t('sp_gym_left', { n: venueLeft('gym') })}</p>` : `<p class="muted center gap-top">✅ ${t('sp_done_today')}</p>`;
    else if (key === 'post|boxes') body = `<button class="btn primary block gap-top" data-act="mailOpen" data-arg="box">📬 ${t('sp_mail_btn')}</button>`;
    else if (key === 'post|cards') { const P2 = placeDay(), fr = S.friends.filter(f => lotOf(f.id)); body = `<div class="card">${fr.map(f => `<div class="list-item">${avatar(f.look)}<div class="grow"><b>${esc(homeName(f))}</b></div>${P2.cards[f.id] ? `<span class="tag ok">${t('pl_sent')}</span>` : `<button class="btn small primary" data-act="placeDo" data-arg="post|card|${f.id}">📮 ${t('pl_send')}</button>`}</div>`).join('') || `<p class="muted">${t('pl_no_friends')}</p>`}</div>`; }
    else if (key === 'school|desk' || key === 'police|board') body = placeBody(v);
    else if (key === 'plaza|board') body = `<button class="btn primary block gap-top" data-act="ranking">🏆 ${t('sp_rank_btn')}</button>`;
    else if (key === 'firestation|truck') body = once('truck', 'truck', `🚒 ${t('sp_truck_btn', { n: VENUE.truck.fun })}`) + `<div class="card gap-top"><b>🧯 ${t('sp_tip')}</b><p>${nm(fireTip())}</p></div>`;
    // v0.37: the new places
    else if (k === 'lift') { const home = VENUE_HOME[v] || v, fl = BUILDING_FLOORS[home] || [v]; body = `<div class="act-grid one">${fl.map((f, i) => `<button class="act-tile wide" data-act="venueFloor" data-arg="${f}" ${f === v || (f === 'suite' && !roomUntil()) ? 'disabled' : ''}><span>${PLACE_INFO[f].e}</span><b>${i ? t('lift_floor', { n: i === fl.length - 1 && home === 'tower' ? TOWER_STOREYS[home] : i === fl.length - 1 ? TOWER_STOREYS[home] : Math.round(TOWER_STOREYS[home] / 2) }) : t('lift_ground')} · ${nm(PLACE_INFO[f])}</b><i>${f === v ? t('lift_here') : f === 'suite' && !roomUntil() ? t('lift_need_room') : t('sp_' + f + '_floor')}</i></button>`).join('')}</div>`; }
    else if (key === 'bank|teller' || key === 'bank|atm' || key === 'bank|loans') body = `<button class="btn primary block gap-top" data-act="phone" data-arg="bank">🏦 ${t('sp_bank_btn')}</button>`;
    else if (key === 'office|coffee') body = snackBtn('cafe');
    else if (key === 'office|view') body = once('view', 'view', `🏙️ ${t('sp_view_btn', { n: VENUE.view.fun })}`);
    else if (key === 'restaurant|table') body = go('dinner', `🍝 ${t('sp_dinner_btn', { n: VENUE.dinner.price, h: VENUE.dinner.hunger, f: VENUE.dinner.fun })}`, S.me.coins >= VENUE.dinner.price);
    else if (key === 'restaurant|date') body = go('date', `🥂 ${t('sp_date_btn', { n: VENUE.date.price, s: VENUE.date.social, r: VENUE.date.rel })}`, S.me.coins >= VENUE.date.price);
    else if (key === 'restaurant|bar' || key === 'hotel|bar') body = go('drink', `🍹 ${t('sp_drink_btn', { n: VENUE.drink.price, f: VENUE.drink.fun, s: VENUE.drink.social })}`, S.me.coins >= VENUE.drink.price);
    else if (key === 'hotel|tea') body = go('tea', `🫖 ${t('sp_tea_btn', { n: VENUE.tea.price, h: VENUE.tea.hunger, f: VENUE.tea.fun })}`, S.me.coins >= VENUE.tea.price);
    else if (key === 'rooftop|pool') body = venueLeft('swim') > 0 ? go('swim', `🏊 ${t('sp_swim_btn', { n: VENUE.swim.fun })}`) + `<p class="muted small center">${t('sp_swim_left', { n: venueLeft('swim') })}</p>` : `<p class="muted center gap-top">✅ ${t('sp_done_today')}</p>`;
    else if (key === 'rooftop|lounger') body = once('sunbathe', 'sunbathe', `😎 ${t('sp_sunbathe_btn', { n: VENUE.sunbathe.fun })}`);
    else if (key === 'apartments|mail') body = `<button class="btn primary block gap-top" data-act="mailOpen" data-arg="box">📬 ${t('sp_mail_btn')}</button>`;
    else if (key === 'apartments|lounge') body = once('lounge', 'lounge', `💬 ${t('sp_lounge_btn', { n: VENUE.lounge.social })}`);
    else if (key === 'bookstore|table') body = go('book', `📖 ${t('sp_book_btn', { n: VENUE.book.price, f: VENUE.book.fun })}`, S.me.coins >= VENUE.book.price);
    else if (key === 'florist|buckets') body = `<p class="muted small">${t('sp_bouquet_note', { n: S.me.barn.bouquet || 0 })}</p><button class="btn primary block gap-top" data-act="bouquetBuy" ${S.me.coins >= VENUE.bouquet.price ? '' : 'disabled'}>💐 ${t('sp_bouquet_btn', { n: VENUE.bouquet.price })}</button>`;
    else if (key === 'market|local') body = specialsBody(VIEW_TOWN);   // v0.40
    else if (key === 'market|groceries') body = `<p class="muted small">${t('sp_groceries_note')}</p><button class="btn primary block gap-top" data-act="groceriesBuy" ${S.me.coins >= VENUE.groceries.price ? '' : 'disabled'}>🛒 ${t('sp_groceries_btn', { n: VENUE.groceries.price })}</button>`;
    // v0.38: the new district and the hotel room
    else if (key === 'hospital|visit') body = once('visit', 'visit', `🫶 ${t('sp_visit_btn', { n: VENUE.visit.social })}`);
    else if (key === 'hospital|babies') body = once('babies', 'babies', `👶 ${t('sp_babies_btn', { n: VENUE.babies.fun })}`);
    else if (key === 'hospital|donate') { const w = donateIn(); body = `<p class="muted small">${t('sp_donate_note', { n: S.donations || 0, p: (S.donations || 0) * 3, d: VENUE.donate.every })}</p>` + (w > 0 ? `<p class="muted center gap-top">⏳ ${t('sp_donate_wait', { n: w })}</p>` : go('donate', `🩸 ${t('sp_donate_btn', { f: VENUE.donate.fun, h: VENUE.donate.hunger })}`)); }
    else if (key === 'hospital|checkup') body = go('check7', `🩺 ${t('sp_check_btn')}`) + res;
    else if (key === 'hospital|pharmacy') body = (S.sick ? `<button class="btn primary block" data-act="erCure" ${S.me.coins >= PERKS.er ? '' : 'disabled'}>🚑 ${t('er_btn', { n: PERKS.er })}</button><p class="muted small center">${t('er_note')}</p>` : '') + (S.sick ? (S.sick.med ? `<p class="host-say yes">💊 ${t('sick_med_have', { n: SICK.restSec })}</p>` : `<button class="btn block" data-act="buyMed">💊 ${t('sick_buy', { n: SICK.medicine })}</button>`) : `<p>${t('sick_well')}</p>`);
    else if (key === 'bowling|lane') body = gameBlock('bowling');
    else if (key === 'bowling|claw') body = gameBlock('claw');   // v0.41
    else if (['amuse|wheel', 'amuse|coaster', 'amuse|carousel', 'amuse|bumper'].includes(key)) body = go(k, `${SPOT_E[key]} ${t('sp_ride_btn', { n: VENUE[k].price, f: VENUE[k].fun })}`, S.me.coins >= VENUE[k].price) + `<p class="muted small center">${t('sp_ride_note')}</p>`;
    else if (key === 'amuse|candy') body = go('candy', `🍭 ${t('sp_candy_btn', { n: VENUE.candy.price, h: VENUE.candy.hunger })}`, S.me.coins >= VENUE.candy.price);
    else if (key === 'amuse|golf') body = gameBlock('golf');
    else if (key === 'amuse|stage') body = gameBlock('karaoke');
    // v0.42: the zoo (each animal once a day, the giraffes, the petting farm, the shop, popcorn) and the stadium
    else if (v === 'zoo' && ZOO_ANIMALS[k]) body = `<div class="card lib-card"><p class="lib-text">${nm(zooFact(k))}</p></div>` + once('zv_' + k, 'zv_' + k, `👀 ${t('sp_zoo_look_btn', { n: VENUE['zv_' + k].fun })}`);
    else if (key === 'zoo|giraffefeed') body = go('giraffefeed', `🥬 ${t('sp_giraffefeed_btn', { n: VENUE.giraffefeed.price, f: VENUE.giraffefeed.fun })}`, S.me.coins >= VENUE.giraffefeed.price);
    else if (key === 'zoo|petting') body = once('petting', 'petting', `🐐 ${t('sp_petting_btn', { n: VENUE.petting.fun })}`);
    else if (key === 'zoo|shop') body = `<p class="muted small">${t('sp_zooplush_note')}</p><div class="act-grid">${ZOO_SHOP.map(pk => `<button class="act-tile" data-act="zooPlushBuy" data-arg="${pk}" ${S.me.coins >= VENUE.zooplush.price ? '' : 'disabled'}><span>${{ plushlion: '🦁', plushelephant: '🐘', plushgiraffe: '🦒', plushpenguin: '🐧' }[pk]}</span><b>${nm(FURN[pk])}</b><i>🪙${VENUE.zooplush.price}${S.me.store['room:' + pk] ? ' · ' + t('sp_zooplush_have', { n: S.me.store['room:' + pk] }) : ''}</i></button>`).join('')}</div>`;
    else if (key === 'zoo|kiosk') body = snackBtn('zoo');
    else if (key === 'stadium|seats') { const g = arenaNow(VIEW_TOWN); body = gameCard(VIEW_TOWN) + (!g.off && g.state === 'live' ? go('match', `🎟️ ${t('sp_match_btn', { n: VENUE.match.price, f: VENUE.match.fun })}`, S.me.coins >= VENUE.match.price) : once('tour', 'tour', `👀 ${t('sp_tour_btn', { n: VENUE.tour.fun })}`)); }
    else if (key === 'stadium|board') body = gameCard(VIEW_TOWN) + `<p class="muted small">${t('sp_board_games')}</p>`;
    else if (key === 'stadium|bets') body = betWindow();   // v0.57 (Mason #30): odds and bets only here
    else if (key === 'stadium|hotdog') body = go('hotdog', `🌭 ${t('sp_hotdog_btn', { n: VENUE.hotdog.price, h: VENUE.hotdog.hunger })}`, S.me.coins >= VENUE.hotdog.price);
    else if (key === 'stadium|cage') body = gameBlock('derby');
    else if (key === 'aquatic|race') body = gameBlock('race');
    else if (key === 'bowling|arcade') body = go('arcade', `🕹️ ${t('sp_arcade_btn', { n: VENUE.arcade.price, f: VENUE.arcade.fun })}`, S.me.coins >= VENUE.arcade.price);
    else if (key === 'bowling|snack' || key === 'station|kiosk') body = snackBtn(v);
    else if (key === 'aquatic|pool') body = venueLeft('swim') > 0 ? go('swim', `🏊 ${t('sp_swim_btn', { n: VENUE.swim.fun })}`) + `<p class="muted small center">${t('sp_swim_left', { n: venueLeft('swim') })}</p>` : `<p class="muted center gap-top">✅ ${t('sp_done_today')}</p>`;
    else if (key === 'aquatic|dive') body = once('dive', 'dive', `🤸 ${t('sp_dive_btn', { n: VENUE.dive.fun })}`);
    else if (key === 'aquatic|sauna') body = once('sauna', 'sauna', `🧖 ${t('sp_sauna_btn', { n: VENUE.sauna.fun })}`);
    else if ((VENUE_HOME[v] || v) === 'museum' && MUSEUM_FACTS[k]) body = `<div class="card lib-card"><p class="lib-text">${nm(museumFact(k))}</p></div>` + once('ex_' + k, 'ex_' + k, `👀 ${t('sp_exhibit_btn', { n: VENUE['ex_' + k].fun })}`);
    else if (key === 'museum|donate') { const T = museumTier(), nx = MUSEUM_GIFT.tiers.find(x2 => museumGiven() < x2.at);   // v0.45: give to the museum
      body = `<div class="card"><b>${T ? T.e + ' ' + nm(T) : t('md_none')}</b><p class="muted small">${t('md_given', { n: fmtNum(museumGiven()) })}${nx ? ' · ' + t('md_next', { n: fmtNum(nx.at - museumGiven()), e: nx.e, name: nm(nx) }) : ''}</p><p class="muted small">${t('md_note', { a: MUSEUM_GIFT.tiers[0].at, b: MUSEUM_GIFT.tiers[2].at })}</p></div>
        <div class="act-grid">${MUSEUM_GIFT.amounts.map(n => `<button class="act-tile" data-act="museumGive" data-arg="${n}" ${S.me.coins >= n ? '' : 'disabled'}><span>💝</span><b>🪙${fmtNum(n)}</b><i>${t('md_fun', { n: MUSEUM_GIFT.fun })}</i></button>`).join('')}</div>`; }
    else if (key === 'museum|mystatue') body = `<p>${museumTier() && museumTier().statue ? t('md_statue_yes', { name: esc(S.me.name || '') }) : t('md_statue_no', { n: fmtNum(MUSEUM_GIFT.tiers[2].at), left: fmtNum(Math.max(0, MUSEUM_GIFT.tiers[2].at - museumGiven())) })}</p>`;
    else if (key === 'museum|shop') body = `<p class="muted small">${t('sp_souvenir_note')}</p><button class="btn primary block gap-top" data-act="souvenirBuy" ${S.me.coins >= VENUE.souvenir.price ? '' : 'disabled'}>🦖 ${t('sp_souvenir_btn', { n: VENUE.souvenir.price })}</button>`;
    else if (key === 'station|ticket') { const from = whereNow(), dests = Object.keys(DREAM_AT).filter(id => id !== from && COMMUNITIES[id] && Drive.plan(from, id, 'train')).sort((a, b) => (b === myTown()) - (a === myTown()));   // (v0.68: home first)   // v0.61: real trains along the railway
      body = !dests.length ? `<p class="muted">${t('tr_no_here')}</p>` : `<p class="muted small">${t('tr_note')}</p><div class="card">${dests.map(id => { const P = Drive.plan(from, id, 'train');
        return `<div class="list-item ${id === myTown() ? 'home-row' : ''}"><span class="big-emoji">${id === myTown() ? '🏡' : COMMUNITIES[id].flag}</span><div class="grow"><b>${nm(COMMUNITIES[id])}</b> ${id === myTown() ? `<span class="tag ok">${t('ah_home_tag')}</span>` : isTeamCity(id) ? '🏟️' : ''}<div class="muted small">${P.km} km · ${t('tr_mins', { m: P.mins })} · ${isNightIn(id) ? '🌙' : '☀️'} ${localClock(id)}</div></div><button class="btn small primary" data-act="trainGo" data-arg="${id}" ${S.me.coins >= P.cost ? '' : 'disabled'}>🚆 🪙${P.cost}</button></div>`; }).join('')}</div>`; }
    else if (key === 'station|board') body = `<div class="card">${Scene.trainBoard().slice(1).map(r => `<div class="list-item"><b>🚆 ${esc(r)}</b></div>`).join('')}</div><p class="muted small">${t('sp_board_note')}</p>`;
    else if (key === 'station|watch') body = once('trains', 'trains', `🚆 ${t('sp_trains_btn', { n: VENUE.trains.fun })}`);
    else if (key === 'suite|bed') body = once('bed', 'bed', `😴 ${t('sp_bed_btn', { n: VENUE.bed.fun })}`);
    else if (key === 'suite|bath') body = once('bath', 'bath', `🛁 ${t('sp_bath_btn', { n: VENUE.bath.fun })}`);
    else if (key === 'suite|minibar') body = go('drink', `🍾 ${t('sp_drink_btn', { n: VENUE.drink.price, f: VENUE.drink.fun, s: VENUE.drink.social })}`, S.me.coins >= VENUE.drink.price);
    else if (key === 'suite|view') body = once('view', 'view', `🏙️ ${t('sp_view_btn', { n: VENUE.view.fun })}`);
    else if (key === 'salon|chair') {   // pick a style and a colour; you sit in the chair and get it done
      const L = S.me.look, sel = UI.cut || { hair: L.hair || 'short', col: L.hairCol || HAIR_COLORS[0] };
      body = `<div class="sec-title">${t('cut_style')}</div><div class="chips">${HAIRS.map(hs => `<button class="chip ${sel.hair === hs ? 'on' : ''}" data-act="cutPick" data-arg="hair|${hs}">${t('hair_' + hs)}</button>`).join('')}</div>
        <div class="sec-title">${t('cut_colour')}</div><div class="chips">${HAIR_COLORS.map(hc => `<button class="swatch ${sel.col === hc ? 'on' : ''}" style="background:${hc}" data-act="cutPick" data-arg="col|${hc}"></button>`).join('')}</div>
        <div class="row center gap-top">${avatar({ ...L, hair: sel.hair, hairCol: sel.col }, 'xl')}</div>
        <button class="btn primary block gap-top" data-act="haircut" data-arg="${sel.hair}|${sel.col}" ${S.me.coins >= VENUE.haircut.price ? '' : 'disabled'}>💇 ${t('sp_haircut_btn', { n: VENUE.haircut.price })}</button>`;
    }
    return head + body;
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
      ${on && !away ? `<button class="btn primary block gap-top" data-act="socialOpen" data-arg="${id}">💬 ${t('soc_talk', { name })}</button>` : ''}
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
    const Z = ZONES[st.zone] || ZONES.suburb;
    const shot = `<div class="land-pic"><span>🏷️</span><b>${other ? `${cm.flag} ${nm(cm)} · ` : ''}${nm(st)}</b><i>${Z.e} ${nm(Z)} · ${nm(nb)}</i></div>
      <p class="muted small">${t('zone_rule', { zone: nm(Z), a: Z.lot[0], b: Z.lot[1], max: Z.max })}</p>`;   // v0.52
    if (next && atZoneMax()) return `${shot}<h2>${t('zone_full_title')}</h2><div class="card"><p>${t('zone_full', { n: lotOf('me').n, max: zoneOf('me').max, zone: nm(zoneOf('me')) })}</p></div>`;
    if (next) {
      const c = parcelCost();
      return `${shot}<h2>${t('land_buy_title')}</h2><p class="muted">${t('land_buy_desc', { w: PARCEL, d: LOT_D, now: homeW(S.me) })}</p>
        <div class="card"><div class="asset-row"><span>${t('land_owned')}</span><b>${t('tiles_n', { w: homeW(S.me), d: LOT_D })}</b></div>
          <div class="asset-row"><span>${t('land_after')}</span><b>${t('tiles_n', { w: homeW(S.me) + PARCEL, d: LOT_D })}</b></div>
          <div class="asset-row"><span>${t('land_price')}</span><b>🪙${fmtNum(c.coins)}</b></div></div>
        <button class="btn primary block" data-act="buyParcel" ${canAfford(c) ? '' : 'disabled'}>${t('land_buy_btn')} · 🪙${fmtNum(c.coins)}</button>
        <p class="muted center gap-top">${t('land_grow_note')}</p>`;
    }
    const p0 = a.run != null ? a.run : a.p, fits = a.n >= CORE_PARCELS, nn = fits ? moveLotN(a.st, p0) : CORE_PARCELS, c = moveCost(a.st, VIEW_TOWN, nn), refund = Math.round((l.paid || 0) * LAND.refund);
    return `${shot}<h2>${t('land_move_title', { street: nm(st) })}</h2><p class="muted">${t('land_move_desc', { w: a.n * PARCEL, d: LOT_D, nb: nm(nb) })}</p>
      ${fits ? `<div class="card"><div class="asset-row"><span>${t('zone_you_get')}</span><b>${t('tiles_n', { w: nn * PARCEL, d: LOT_D })}</b></div><div class="asset-row"><span>${t('land_price')}</span><b>🪙${fmtNum(c.coins)}</b></div>
        ${refund ? `<div class="asset-row"><span>${t('land_refund')}</span><b>+🪙${fmtNum(refund)}</b></div>` : ''}
        <p class="muted">${t('land_move_note')}</p></div>
        <button class="btn primary block" data-act="moveHere" data-arg="${a.st}|${p0}" ${canAfford(c) ? '' : 'disabled'}>🚚 ${t('land_move_btn')} · 🪙${fmtNum(c.coins)}</button>
        ${other ? '' : `<button class="btn block gap-top" data-act="inviteHere" data-arg="${a.st}|${p0}|${a.n}">💌 ${t('invite_here')}</button><p class="muted small">${t('invite_note')}</p>`}`
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
  mail(arg) {
    if (arg === 'phone') UI.mailPhone = true; else if (arg === 'box') UI.mailPhone = false;   // v0.43: opened from the phone: a way back to it
    const inbox = S.mail.inbox;
    const rows = inbox.length ? inbox.map(l => { const f = homeOf(l.from), p = PAPERS.find(x => x.id === l.paper) || PAPERS[0];
      return `<button class="list-item letter-row ${l.read ? '' : 'unread'}" data-act="readLetter" data-arg="${l.id}">${f ? avatar(f.look) : ''}
        <div class="grow"><b>${esc(fname(l.from))}</b>${l.gift && !l.claimed ? ' 🎁' : ''}<div class="muted clip">${esc(l.text)}</div></div>
        <span class="stamp" style="background:${p.ac}">✉️</span></button>`; }).join('') : `<p class="muted">${t('mail_empty')}</p>`;
    const sent = S.mail.sent.length ? `<p class="muted gap-top">${t('mail_sent_n', { n: S.mail.sent.length })}</p>` : '';
    return `${UI.mailPhone ? `<button class="btn small back-phone" data-act="phone" data-arg="home">‹ 📱 ${t('back_phone')}</button>` : ''}<h2>📮 ${t('mailbox')}</h2><p class="muted">${t('mail_desc')}</p><div class="card">${rows}</div>${sent}
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
  keepRows($('#sheet'), () => { $('#sheet').innerHTML = `<div class="grab"></div>${SHEETS[UI.sheet.type](UI.sheet.arg)}`; });
  const th = $('#sheet .ph-thread'); if (th) th.scrollTop = th.scrollHeight;
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
    <div class="con-group"><h4>🌦️ ${t('con_weather')}</h4>${['auto', 'clear', 'clouds', 'rain', 'heavy', 'snow', 'fog', 'storm'].map(k => b('simWeather', k, k === 'auto' ? t('w_auto') : `${WEATHER_E[k === 'heavy' ? 'rain' : k]} ${t('w_' + k)}`, (S.weather && S.weather.forced ? (S.weather.heavy ? 'heavy' : S.weather.kind) : 'auto') === k ? 'on' : '')).join('')}</div>
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
  else if (code === 'noroom') snack(t('plot_noroom'));   // v0.46
  else if (code === 'own') snack(t('owned'));
  else if (code === 'max') snack(t('maxed'));
  else if (code === 'small') { Sound.play('oops'); snack(`🏗️ ${t('house_need_lot_snack')}`); }   // v0.52
  else if (code === 'space') snack(`🚗 ${t('garage_space')}`);
  else if (code === 'garage') snack(`🚗 ${t('garage_full')}`);
}
// v0.19: you're out in your own town (somewhere other than home)
const outInTown = () => !!(S.out && S.out.town === myTown());
function awayCheck() {
  if (!outInTown() || UI.visit || UI.tab !== 'home') return false;
  snack(`📍 ${t('away_snack', { place: outName() })}`); openSheet('go', { id: 'me' });
  return true;
}
const outName = () => (S.out.place ? nm(placeInfo(S.out.place)) : S.out.id ? t('home_of', { name: homeName(homeOf(S.out.id)) }) : t('away_street'));
function walkDo(tg, o) {
  if (S.live) { snack(t('snack_live_busy')); return false; }
  if (awayCheck()) return false;
  if (S.work) { snack(`💼 ${t('job_busy', { place: nm(placeInfo(S.work.place)) })}`); return false; }   // v0.14: at work
  if (S.study) { snack(`📚 ${t('school_busy', { m: fmtDur(S.study.end - now()) })}`); return false; }   // v0.24: in class
  if (jailed()) { jailSnack(); return false; }   // v0.18: held at the police station
  const ok = Scene.go(tg, { queue: true, fail: () => snack(t('snack_cant_reach')), ...o });
  if (!ok) snack(t('snack_cant_reach'));
  refreshSoon();
  return ok;
}
const after = fn => () => { fn(); refresh(); };
function harvestJob(i) {
  return { tg: { kind: 'field', i }, o: { pose: 'crouch', dur: DO_SECS.harvest * 1000, e: (CROPS[(S.me.fields[i] || {}).crop] || {}).e || '🧺', valid: () => isRipe(S.me.fields[i]) || isRotten(S.me.fields[i]), done: after(() => harvestField(i)) } };
}
function animalJob(id) {
  return { tg: { kind: 'animal', id }, o: { pose: 'crouch', dur: DO_SECS.animal * 1000, e: (() => { const a = S.me.animals.find(x => x.id === id), A = a && ANIMALS[a.k]; return (A && GOODS[A.prod] && GOODS[A.prod].e) || '🧺'; })(), valid: () => { const a = S.me.animals.find(x => x.id === id); return a && animalReady(a); }, done: after(() => collectFrom(id)) } };
}
function treeJob(i) {
  return { tg: { kind: 'tree', i }, o: { pose: 'pick', dur: DO_SECS.tree * 1000, e: (TREES[(S.me.trees[i] || {}).k] || {}).e || '🍎', valid: () => treeReady(S.me.trees[i]), done: after(() => pickTree(i)) } };
}
function hiveJob(id) {
  return { tg: { kind: 'yard', id }, o: { pose: 'pick', dur: DO_SECS.yard * 1000, e: '🍯', valid: () => { const it = S.me.yard.find(x => x.id === id); return it && yardReady(it); }, done: after(() => { const r = collectYard(id); if (r) { Scene.floatMe(`+${r.n} ${GOODS[r.k].e}`); snack(t('snack_prod', { n: r.n, e: GOODS[r.k].e })); } }) } };
}
function plantJob(i, crop) {
  return { tg: { kind: 'field', i }, o: { pose: 'crouch', dur: DO_SECS.plant * 1000, e: '🌱', valid: () => !S.me.fields[i] && S.me.seeds[crop] > 0,
    done: after(() => result(plant(i, crop), () => { Scene.floatField(i, '🌱'); Sound.play('sow'); })) } };
}
function harvestField(i) {
  const r = harvest(i);
  if (!r) return;
  if (r.rotten) { Sound.play('oops'); Scene.floatField(i, '🍂'); return snack(`🍂 ${t('crop_rotten', { e: CROPS[r.crop].e, h: FRESH.crop })}`); }   // v0.44
  tutDone('harvest');
  Sound.play('harvest');
  Scene.floatField(i, `+${r.n} ${CROPS[r.crop].e}`);
  snack(t('snack_harvest', { n: r.n, e: CROPS[r.crop].e }));
}
function collectFrom(id) {
  const an = (S.me.animals || []).find(x => x.id === id), r = collectAnimal(id);
  if (!r) return;
  Sound.play('collect'); if (an) setTimeout(() => Sound.animal(an.k), 250);   // v0.56: and the animal says something
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
  } else if (r.r === 'witness') {
    // v0.18: a neighbour saw you: pay the owner, like with a dog
    Scene.floatMe(`👀 -🪙${r.fine}`); snack(t('snack_witness_fine', { name: fname(fid), n: r.fine })); Sound.play('oops');
  } else if (r.r === 'police') {
    // v0.18: the police come: a bigger fine and a short stay in the holding cell
    Scene.floatMe(`🚔 -🪙${r.fine}`); Sound.play('oops');
    UI.visit = null; UI.visitInside = false; if (UI.tab !== 'town') UI.tab = 'town'; syncView();
    const p = Scene.placePoint('police'); if (p) { Scene.arriveAt(p, 'police'); Scene.lookAt(p[0], p[1]); }
    openSheet('place', 'police');
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
  // v0.26: the phone
  // v0.43: the mail app opens your mail right here, with a way back to the phone
  phone(arg) { if (arg === 'mail') return openSheet('mail', 'phone'); if (arg === 'map') { closeSheet(); return ACT.findMe(); } if (typeof arg === 'string' && arg.startsWith('texts|')) seeTexts(arg.split('|')[1]); openSheet('phone', arg || 'home'); },
  phoneCall(id) { const r = callPerson(id); if (r === 'ok') { Sound.play('chime'); save(); } openSheet('phone', 'call|' + id + '|' + r); },
  betPlace(arg) {   // v0.54
    const [sp, g, pick, stake] = arg.split('|'), r = placeBet(sp, +g, +pick, +stake);
    if (r !== 'ok') { Sound.play('oops'); return snack(t('lg_no_' + r, { n: BETS.dayMax })); }
    Sound.play('chip'); snack(`🎟️ ${t('lg_placed', { n: stake, name: teamName(sp, +pick) })}`); save(); syncSportReminders();
    UI.betPick = null; renderSheet(); refresh();
  },
  betPick(arg) { UI.betPick = arg ? (([sp, g, i]) => ({ sp, g: +g, i: +i }))(arg.split('|')) : null; Sound.play('tick'); renderSheet(); },   // v0.57: the stadium's betting window
  phoneText(a) { const [id, i] = a.split('|'); textPerson(id, +i); seeTexts(id); Sound.play('tick'); save(); renderSheet(); },
  // v0.51 (Mason #29): in your own words; they work out what you meant (talk.js) and answer a moment later
  phonePlay(arg) { UI.phPlay = arg ? String(arg).split('|')[0] : null; Sound.play('tick'); renderSheet(); },   // v0.57: which game to ask them to
  phoneSay(arg) {   // v0.57 (Mason #30): tap a line instead of typing
    const [id, k, game] = arg.split('|'), x = SAY.find(q => q.k === k), w = whoIs(id);
    if (!x || !w) return;
    UI.phPlay = null; Sound.play('send');
    const text = nm(x).replace('{game}', game ? nm(GAME_NAMES[game]) : '');
    S.texts = S.texts || {}; const th = S.texts[id] = S.texts[id] || [];
    const R2 = talkReply(id, text, { intent: k, game }), wait = (TALK.reply[0] + Math.random() * (TALK.reply[1] - TALK.reply[0])) * 1000;
    th.push({ me: 1, text, t: now() }, { text: R2.text, t: now() + wait });
    while (th.length > 40) th.shift();
    if (onceToday('text_' + id)) addNeed('social', NEED_GAIN.text);
    if (R2.intent === 'compliment' && onceToday('txtnice_' + id)) { S.rel = S.rel || {}; S.rel[id] = Math.min(100, relOf(id) + 1); }
    seeTexts(id); Sound.play('tick'); save(); renderSheet();
    setTimeout(() => {
      if (UI.sheet && UI.sheet.type === 'phone' && String(UI.sheet.arg) === 'texts|' + id) { seeTexts(id); renderSheet(); }
      Sound.play('pop');
      if (R2.meet) snack(`🌳 ${t('meet_ok', { name: w.name })}`);
      if (R2.play) snack(`🙌 ${t('inv_agreed', { name: w.name, game: nm(GAME_NAMES[R2.play]) })}`);
      save(); refresh();
    }, wait + 60);
  },
  // v0.51: ask a friend (a real player) to come and play; townsfolk just play
  gameInvite(arg) {
    const [k, id] = arg.split('|'), w = whoIs(id), key = k + '|' + id;
    if (!w) return;
    UI.invPending = UI.invPending || {};
    if (UI.invPending[key]) return;
    if (outdoorPaused(VENUE_GAMES[k] ? (VENUE_GAMES[k].place === 'lake' ? 'lake' : k) : 'park')) return wxSnack();
    const game = nm(GAME_NAMES[k] || { zh: k, en: k }), place = nm(placeInfo(PLAY_PLACE[k] || 'park') || PLACE_INFO.park);
    S.texts = S.texts || {}; const th = S.texts[id] = S.texts[id] || [];
    th.push({ me: 1, text: t('inv_text', { game, place }), t: now() });
    UI.invPending[key] = true; Sound.play('tick'); snack(`📨 ${t('inv_sent', { name: w.name })}`); save(); renderSheet();
    const on = isOnline(id), will = sportWillPlay(id), wait = (TALK.inviteReply[0] + Math.random() * (TALK.inviteReply[1] - TALK.inviteReply[0])) * 1000;
    setTimeout(() => {
      UI.invPending[key] = false;
      if (!on) { th.push({ text: t('inv_later'), t: now() + TALK.offlineReply * MIN }); snack(`💤 ${t('inv_offline', { name: w.name })}`); }
      else if (will !== 'ok') { th.push({ text: t('inv_no'), t: now() }); Sound.play('oops'); snack(`😕 ${t('inv_no_snack', { name: w.name })}`); }
      else { th.push({ text: t('inv_yes', { place }), t: now() }); S.invites = S.invites || {}; S.invites[id] = { k, until: now() + TALK.inviteKeep * HOUR }; Sound.play('chime'); snack(`🏃 ${t('inv_coming', { name: w.name, game })}`); }
      save(); if (UI.sheet && (UI.sheet.type === 'spot' || UI.sheet.type === 'place')) renderSheet(); refresh();
    }, wait);
  },
  invitePeople() { openSheet('invite'); },
  phoneMeet(id) { const r = meetInPark(id), who = whoIs(id); if (r === 'ok') { Sound.play('chime'); snack(`🌳 ${t('meet_ok', { name: who ? who.name : '' })}`); save(); } else snack(t('meet_done')); renderSheet(); },
  bankIn(v) { const r = deposit(v); if (r === 'ok') { Sound.play('coins'); save(); } else snack(t('snack_poor')); renderSheet(); },
  bankOut(v) { const r = withdraw(v); if (r === 'ok') { Sound.play('coins'); save(); } else snack(t('bank_empty')); renderSheet(); },
  loanRepay(id) { const r = repayLoan(id); if (r === 'ok') { Sound.play('levelup'); snack(`🏦 ${t('loan_paid_off')}`); save(); } else { Sound.play('oops'); snack(t('snack_poor')); } renderSheet(); },
  stockBuy(a) { const [co, v] = a.split('|'), r = buyStock(co, v); if (r === 'ok') { Sound.play('coins'); save(); } else { Sound.play('oops'); snack(t('snack_poor')); } renderSheet(); },
  stockSell(a) { const [co, v] = a.split('|'), r = sellStock(co, v); if (r === 'ok') { Sound.play('coins'); save(); } renderSheet(); },
  loanAsk(wid) { openSheet('loan', wid); },
  loanSign(wid) {
    const w = Scene.shopWare(wid); if (!w) return;
    const house = w.kind === 'house', k = house ? +w.k : w.k;
    const r = withLoan(house ? 'house' : 'car', k, () => house ? buyHouse(k) : orderCar(w));
    closeSheet();
    if (r !== 'ok') { Sound.play('oops'); return snack(r === 'poor' ? t('snack_poor') : r === 'own' ? t('owned') : r === 'garage' ? `🚗 ${t('garage_full')}` : t('loan_no_' + r, { n: '', r: fmtNum(loanRoom()) })); }
    Sound.play('coins'); save();
    snack(house ? `🏦 ${t('loan_house_ok', { name: nm(HOUSES[k]) })}` : `🏦 ${t('loan_car_ok', { name: nm(CARS[k]), h: DELIVERY.hour })}`);
  },
  chat(id) { ACT.socialOpen(id); },   // v0.34: the sheet first; you walk over once you pick something to do
  chatWork(id) { ACT.socialOpen(id); },
  useFurn(id) { hideTip(); Scene.go({ kind: 'furn', id }); },   // v0.34: sit / lie down / work out on it, now that you've said so
  // v0.31: the things you do with someone (like The Sims): your bubble, a moment, their reaction, then what came of it
  socialOpen(id) { UI.socLast = null; UI.socWalk = null; closeSheet(); openSheet('social', id); refresh(); },
  socCat(c) { UI.socCat = c; renderSheet(); },
  cutPick(arg) { const [w, v] = arg.split('|'), L = S.me.look; UI.cut = UI.cut || { hair: L.hair || 'short', col: L.hairCol || HAIR_COLORS[0] }; UI.cut[w === 'hair' ? 'hair' : 'col'] = v; renderSheet(); },   // v0.37
  social(arg) {
    const [id, act, g] = arg.split('|'), w = whoIs(id), A = SOCIALS[act];
    if (!w || !A || (UI.socBusy && UI.socBusy > Date.now()) || UI.socWalk) return;
    if (!canSocial(id)) {   // v0.34: not next to them yet: walk over (they wait for you), then do it
      if (!canReach(id)) return snack(t('soc_need_near', { name: w.name }));
      UI.socWalk = id; closeSheet();   // out of the way while you walk over; it comes back when you get there
      const go = () => { if (UI.socWalk !== id) return; UI.socWalk = null; if (!UI.sheet) openSheet('social', id); if (canSocial(id)) ACT.social(arg); else renderSheet(); refresh(); };
      if (Scene.folkHere(id)) Scene.walkToFolk(id, go); else { UI.tripTo = w.name; Scene.walkUp(id, go); }
      setTimeout(() => { if (UI.socWalk === id) { UI.socWalk = null; if (UI.sheet && UI.sheet.type === 'social') renderSheet(); } }, 20000);   // never stuck
      return refresh();
    }
    const first = !Object.keys(socialToday(id)).length;   // v0.51: the first time today you say hello first
    const r = doSocial(id, act, g);
    if (r.r === 'locked') return snack(`🔒 ${t('soc_lock', { level: nm(relLevel(A.min)) })}`);
    if (r.r === 'nogift') return snack(t('soc_gift_none'));
    if (r.r !== 'ok') return;
    const fun = ['joke', 'face', 'tickle', 'tease'].includes(act), warm = ['hug', 'deep', 'gift'].includes(act);
    const react = r.ok ? (r.liked || r.shared ? '🤩' : fun ? '😂' : warm ? '🥰' : '😄') : r.disliked ? '😣' : '😒';
    const say = act === 'interest' ? INTERESTS[r.topic].e : act === 'gift' ? barnInfo(g).e : A.e;
    // v0.51 (Mason #29): the two of you talk, line by line, over your heads (the sheet steps aside so you can see it)
    const lines = [...(first && act !== 'greet' ? talkGreet(id) : []), ...convoScript(id, act, g, r)], secs = Scene.talk(id, lines, !!A.wave);
    UI.socBusy = Date.now() + secs * 1000; Sound.play('pop'); save(); closeSheet(); refresh();
    setTimeout(() => {
      UI.socBusy = 0;
      const name = esc(w.name), d = r.d ? ` <b>${r.d > 0 ? '+' : ''}${r.d}</b>` : '';
      let msg;
      if (act === 'interest') msg = r.shared ? t(r.ok ? 'soc_share' : 'soc_bad', { name, topic: nm(INTERESTS[r.topic]) }) : t(r.ok ? 'soc_polite' : 'soc_noshare', { name, topic: nm(INTERESTS[r.topic]), their: nm(INTERESTS[r.tells]) });
      else if (act === 'gift') msg = t('soc_gift_ok', { name, item: barnInfo(g).name });
      else if (act === 'plans' && r.ok) msg = t('soc_plans_ok', { name });
      else msg = r.ok ? t(r.liked ? 'soc_love' : 'soc_ok', { name }) : t(r.bored ? 'soc_bored' : 'soc_bad', { name });
      UI.socLast = { id, ok: r.ok, html: `${react} ${msg}${d}`, lines };
      Sound.play(r.ok ? 'chime' : 'oops');
      if (r.up) setTimeout(() => { Sound.play('levelup'); snack(`🎉 ${t('soc_levelup', { name: w.name, level: nm(r.up) })}`); }, 300);
      if (!UI.sheet) openSheet('social', id); else if (UI.sheet.type === 'social') renderSheet();
      refresh();
    }, secs * 1000 + 200);
  },
  cook() {   // v0.50: walk to the kitchen and cook (the bar), then eat
    const c = cookCheck();
    if (c !== 'ok') { Sound.play('oops'); return snack(t(c === 'nokitchen' ? 'cook_need_kitchen' : 'cook_need_food')); }
    const fin = () => { const r = cookMeal(); if (r === 'ok') { Sound.play('collect'); snack(`🍳 ${t('cook_ok')}`); save(); } else snack(t(r === 'nokitchen' ? 'cook_need_kitchen' : 'cook_need_food')); refresh(); };
    closeSheet();
    if (UI.visit || S.live) return fin();
    if (UI.tab !== 'home') setTab('home');
    const cookNow = () => setTimeout(() => { if (!Scene.cookAt(DO_SECS.cook * 1000, fin)) fin(); else snack(`🍳 ${t('cook_doing')}`); refresh(); }, 300);
    if (UI.inside) return cookNow();
    snack(`🍳 ${t('cook_doing')}`);
    if (!Scene.go({ kind: 'door' }, { done: () => { goInside(); cookNow(); } })) { goInside(); cookNow(); }   // in through the front door first
  },
  snackBuy() {
    const fin = () => { const r = buySnack(); if (r === 'ok') { Sound.play('collect'); snack(`🥐 ${t('snack_ok')}`); save(); } else { Sound.play('oops'); snack(t('snack_poor')); } renderSheet(); refresh(); };
    if (Scene.view().mode === 'town' && S.out) {   // v0.50: at a place's counter in town: eat it there first
      if (S.me.coins < SNACK.price) { Sound.play('oops'); return snack(t('snack_poor')); }
      closeSheet(); return Scene.townDo(DO_SECS.order + DO_SECS.snack, '🥐', fin, 'stand', '🥐');
    }
    fin();
  },
  // v0.22: show me where my townie is (in a store, out in town, at work, at home)
  findMe() {
    closeSheet();
    if (UI.inStore || UI.inVenue) { Scene.pingMe(); return; }
    if (Scene.tripNow() && UI.tab === 'town' && !UI.visit && Scene.followTrip()) { Scene.pingMe(); return; }   // v0.29: on the way: the view follows you again
    if (S.out && S.out.place && STORES[S.out.place] && STORES[S.out.place].cats.length && S.out.town === myTown() && UI.lastStore === S.out.place) { ACT.enterStore(S.out.place); Scene.pingMe(); return; }
    const away = S.trav && COMMUNITIES[S.trav.town] && S.trav.town !== myTown() ? S.trav.town : null;   // v0.64 (Mason #32): you're in another city: show that city, close up on you
    if (UI.visit) { leaveHost(UI.visit); UI.visit = null; UI.visitInside = false; setLevel(0); }
    if (away) { UI.tab = 'world'; UI.wtown = away; syncView(); Scene.showMe(); Scene.pingMe(); refresh(); return; }
    const out = S.work || S.jail || (S.out && S.out.town === myTown());
    UI.wtown = null;
    if (out) { UI.tab = 'town'; syncView(); Scene.showMe(); }
    else { UI.tab = 'home'; UI.inside = false; syncView(); Scene.focusMe(1.2, 0.45); }
    Scene.pingMe(); refresh();
  },
  pickCar(i) { UI.tripCar = +i; renderSheet(); },
  takeClass() {
    const r = takeClass();
    if (r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    if (r === 'done') return snack(t('school_done'));
    if (r === 'max') return snack(t('school_max'));
    if (r === 'busy') return snack(t('school_busy', { m: fmtDur(S.study.end - now()) }));
    Sound.play('chime'); snack(`📚 ${t('school_started', { m: SCHOOL.minutes })}`);
    save(); closeSheet();
  },
  // v0.18: things to do at the mall
  mallAct: k => (k === 'trophies' ? openSheet('trophies', 'me') : openSheet(k)),
  watchMovie(k) {
    const r = watchMovie(k);
    if (r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    if (r !== 'ok' && r !== 'poster') return;
    Sound.play('chime'); save(); UI.posterNew = r === 'poster' ? k : null; UI.filmPaid = k;   // v0.50: its fun at the end
    Scene.setFilm(k); ACT.mallFloor('cinema'); snack(`🎟️ ${t('film_go', { name: nm(MALL.movies[k]) })}`);
  },
  clawTry() {
    if (UI.clawBusy) return;
    const r = clawTry();
    if (r.r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    UI.clawBusy = true; Sound.play('tick'); save(); Scene.clawGo();
    setTimeout(() => {
      UI.clawBusy = false;
      if (r.r === 'win') { Sound.play('levelup'); snack(`${MALL.plush[r.k]} ${t('claw_win', { name: nm(FURN[r.k]) })}`); if (r.big) setTimeout(() => { Sound.play('levelup'); snack(`🧸 ${t('claw_big')}`); }, 2600); }
      else { Sound.play('oops'); snack(t('claw_miss')); }
      if (UI.sheet && UI.sheet.type === 'claw') renderSheet();
      refresh();
    }, 1100);
  },
  eatFood(k) {   // v0.23: sit down at a table and eat (v0.50: you pay, fill up and feel full once you've eaten it)
    const F = MALL.foods[k]; if (!F) return;
    if (S.me.coins < F.price) { Sound.play('oops'); return snack(t('snack_poor')); }
    closeSheet();
    Scene.shopEat(F.e, DO_SECS.meal, () => {
      const r = eatFood(k);
      if (r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
      if (r !== 'ok') return;
      Sound.play('collect'); snack(`${F.e} ${t('food_ate', { name: nm(F) })} ${t('food_full', { h: MALL.fed.hours, p: Math.round(MALL.fed.pay * 100) })}`); save(); refresh();
    });
  },
  payBail() {
    const r = payBail();
    if (r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    if (r !== 'ok') return;
    Sound.play('coins'); snack(`🚔 ${t('jail_bailed')}`); save(); closeSheet(); outOfJail();
  },
  // v0.18: the wardrobe (body type, hair, skin, the clothes you own and their colours)
  wardrobe: () => openSheet('wardrobe'),
  buyClothes(k) {
    const r = buyClothes(k);
    if (r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    if (r !== 'ok') return;
    Sound.play('buy'); snack(t('clothes_bought', { name: nm(CLOTHES[k]) })); save();
  },
  wear(k) { if (wearClothes(k)) { Sound.play('pop'); save(); if (UI.sheet && UI.sheet.type === 'wardrobe') renderSheet(); } },
  wdSet(arg) {
    const [f, v] = arg.split('|'), L = S.me.look;
    if (['body', 'hair', 'skin', 'hairCol', 'shirt', 'pants', 'shoeCol', 'hatCol'].includes(f)) L[f] = v;
    save(); renderSheet();
  },
  wdTab(k) { UI.wdTab = k; renderSheet(); },
  liveInfo: () => setTab('real'),
  watchLive() { UI.inside = false; setTab('home'); Scene.recenter(); },
  // home & visiting
  goIn() {
    if (awayCheck()) return;
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
  goHome() {
    if (outInTown()) { closeSheet(); return openSheet('go', { id: 'me' }); }   // v0.19: you're out: go home the real way
    if (cargoUsed()) { unloadCargo(); snack(`📦 ${t('mk_unloaded')}`); } if (UI.visit) leaveHost(UI.visit); UI.visit = null; UI.visitInside = false; UI.wtown = null; setLevel(0); setTab('home');
  },
  backTown() { if (UI.visit) leaveHost(UI.visit); UI.visit = null; UI.visitInside = false; setLevel(0); syncView(); },
  // Going somewhere (v0.12). Homes in your own community: choose how to go. Elsewhere in the world: straight there.
  goTo(id) {
    if (id === 'me') return ACT.goHome();
    if (UI.visit === id) return;
    if (townOf(id) !== myTown() || UI.tab === 'world' && UI.wtown && UI.wtown !== myTown()) return ACT.visit(id);
    closeSheet(); openSheet('go', { id });
  },
  travel(how) {
    const arg = UI.sheet && UI.sheet.arg, a = typeof arg === 'string' ? { place: arg } : arg;
    if (!a) return;
    if (S.trav && VIEW_TOWN !== S.trav.town) { closeSheet(); return snack(t('dr_away', { c: nm(COMMUNITIES[S.trav.town]) })); }   // v0.60: you're in another city: drive back first
    if (!S.trav && VIEW_TOWN !== myTown() && !awayIn(VIEW_TOWN)) { closeSheet(); return snack(t('dr_drive_first')); }
    if (S.work) {   // v0.14: you're at work; leaving means leaving early
      if (!confirm(t('job_leave_q', { n: Math.round(hoursWorked(S.work) * S.work.wage) }))) return;
      const r = quitShift(); snack(`💼 ${t('job_quit_done', { n: r.pay })}`);
    }
    closeSheet();
    const T = goTarget(a), home = a.id === 'me';
    const arrive = () => {
      UI.tripTo = null;
      if (home) { if (cargoUsed()) { unloadCargo(); snack(`📦 ${t('mk_unloaded')}`); } UI.visit = null; UI.visitInside = false; setLevel(0); setTab('home'); }
      else if (a.id) ACT.visit(a.id);
      else if (a.place && VENUE_PLACES.includes(a.place)) { arrivedFx(a.place); ACT.enterVenue(a.place); }   // v0.30: straight in
      else if (a.place && STORES[a.place] && STORES[a.place].cats.length) { arrivedFx(a.place); ACT.enterStore(a.place); }   // v0.43: shops too: straight in
      else if (a.place) { openSheet('place', a.place); arrivedFx(a.place); }
      refresh();
    };
    if (UI.visit) { leaveHost(UI.visit); UI.visit = null; UI.visitInside = false; setLevel(0); }
    if (UI.tab !== 'town' && !(UI.tab === 'world' && UI.wtown && S.trav && S.trav.town === UI.wtown)) UI.tab = 'town';   // (v0.60: in the city you drove to, stay there)
    syncView();
    // v0.19: "straight there" goes the same way (by car if you have one), it just skips the time on the road
    const pick = UI.tripCar != null && !S.carAt && S.me.cars[UI.tripCar] ? UI.tripCar : null; UI.tripCar = null;
    const car = S.me.cars[pick ?? S.me.car], transit = how === 'bus' || how === 'metro', useCar = !transit && !!car && (how === 'car' || how === 'now') && !(S.trav && (!S.carAt || S.carAt.town !== VIEW_TOWN)), kind = transit ? how : !useCar ? 'walk' : CARS[car.k].kind === 'two' ? 'bike' : 'car';   // (v0.61: in a city you came to by train your car isn't there)
    if (transit) { if (S.me.coins < TRANSIT[how]) { Sound.play('oops'); return snack(t('snack_poor')); } S.me.coins -= TRANSIT[how]; snack(`${how === 'bus' ? '🚌' : '🚇'} ${t('go_fare', { n: TRANSIT[how] })}`); }   // v0.61: the fare
    UI.tripTo = T.short;
    if (a.place === 'market') { const n = loadCargo(useCar ? 'car' : 'walk'); if (how !== 'now') snack(n ? `📦 ${t('mk_loaded', { n, cap: carryCap(useCar ? 'car' : 'walk') })}` : `📦 ${t('mk_nothing')}`); }
    Scene.travel(T.pt, kind, useCar ? car : null, arrive, a.id || null, a.place || null, useCar && pick !== null ? pick : undefined);
    if (useCar && pick !== null) S.me.car = pick;   // the one you took is the one you drive now
    if (how === 'now') Scene.finishTrip();
    else if (kind !== 'walk') Sound.play('select');
  },
  tripFast() { Scene.finishTrip(); },
  tripStop() { if (Scene.stopTrip()) { UI.tripTo = null; snack(`✋ ${t('go_stopped')}`); save(); refresh(); } },   // v0.29: stop right where you are
  // v0.20: walk into the store (a real store: walk round, tap what you like, pay the shopkeeper)
  enterStore(k, wareId) {
    if (!STORES[k] || !STORES[k].cats.length) return;
    if (!atStore(k)) return ACT.placeGo(k);
    closeSheet(); UI.inStore = k; UI.lastStore = k; if (k === 'mall') UI.mallFloor = 'mall'; if (k === 'furniture') UI.furnFloor = wareId && String(wareId).startsWith('furn:') ? FURN_FLOORS[furnFloorOf(String(wareId).split(':')[1])].key : 'furniture'; UI.basket = UI.basket && UI.basket.store === k ? UI.basket : { store: k, items: [] };
    UI.visit = null; UI.tab = 'town'; syncView(); Sound.play('chime');
    if (wareId) setTimeout(() => Scene.shopGoWare(wareId, () => { openSheet('ware', wareId); refresh(); }), 250);
    else if (!S.shopTip) { S.shopTip = 1; setTimeout(() => snack(`🛒 ${t('shop_tip')}`), 400); }
  },
  // v0.33: play tennis / basketball / football with someone: walk over to the court, then the game starts
  sportGo(arg) {
    if (hungry()) { Sound.play('oops'); return snack(`🍔 ${t('too_hungry_play')}`); }   // v0.44: eat first
    const [k, id] = arg.split('|');
    if (!BALL_GAMES[k] || Scene.here() !== 'park' || !Scene.parkHas(k)) return;
    if (outdoorPaused('park')) return wxSnack();   // v0.50
    const w = id === 'court' ? { name: t('mg_court_' + k), look: Scene.courtLook(k) } : whoIs(id);
    if (!w) return;
    const ok = sportWillPlay(id);
    if (ok !== 'ok') { Sound.play('oops'); return snack(`${ok === 'grumpy' ? MOOD_E.grumpy : '😬'} ${t('mg_no_' + ok, { name: w.name })}`); }
    closeSheet();
    Scene.parkUse(k, 0.5, () => openSport(k, id, w));
    refresh();
  },
  // v0.32: do something in the park (walk over along the paths first)
  parkDo(k) {
    if (Scene.here() !== 'park' || !Scene.parkHas(k)) return;
    if (outdoorPaused('park')) return wxSnack();   // v0.50
    if (k === 'cart') {
      if (S.me.coins < MALL.foods.icecream.price) { Sound.play('oops'); return snack(t('snack_poor')); }
      closeSheet(); Scene.parkUse('cart', PARK.icecream.sec, () => { if (eatFood('icecream') !== 'ok') { Sound.play('oops'); return snack(t('snack_poor')); } Sound.play('chime'); snack(`🍦 ${t('pk_ate')}`); save(); refresh(); });   // v0.50: paid and eaten at the cart
      return refresh();
    }
    const kind = PARK_KIND[k];
    if (parkLeft(k) <= 0) return snack(t('sp_done_today'));
    closeSheet();
    Scene.parkUse(k, PARK[kind].sec, () => { if (parkUse(k, kind) === 'ok') { Sound.play('chime'); snack(`${SPOT_E['park|' + k]} ${t('pk_done_' + kind)}`); save(); } refresh(); });
    refresh();
  },
  // v0.30: walk into a building (you must be there), walk out again
  enterVenue(k) {
    if (!VENUE_PLACES.includes(k) || (VIEW_TOWN !== myTown() && !(S.trav && S.trav.town === VIEW_TOWN))) return;   // v0.60: or the city you drove to
    if (Scene.here() !== k && !(S.out && S.out.place === k && S.out.town === VIEW_TOWN && !S.trip)) return openSheet('place', k);   // (v0.64: you've just got there)
    closeSheet(); UI.inVenue = BUILDING_FLOORS[k] ? BUILDING_FLOORS[k][0] : k; UI.visit = null; UI.tab = S.trav && S.trav.town === VIEW_TOWN && VIEW_TOWN !== myTown() ? 'world' : 'town'; syncView(); Sound.play('doorbell');   // (v0.60: in another city you stay there)   // v0.37: a tower: its ground floor
    if (!S.venueTip) { S.venueTip = 1; setTimeout(() => snack(`👀 ${t('venue_tip')}`), 400); }
    if (k === 'school' && S.study) setTimeout(() => Scene.venueUse('desk', Math.max(5, Math.round((S.study.end - now()) / 1000)), null), 300);   // in class: at your desk
    refresh();
  },
  leaveVenue() { const v = UI.inVenue && (VENUE_HOME[UI.inVenue] || UI.inVenue); closeSheet(); UI.inVenue = null; UI.spotRes = null; UI.tab = 'town'; syncView(); if (v) Scene.focusPlace(v); refresh(); },   // v0.49: the camera on its door
  // v0.37: the lift in a tower: up or down to another floor
  venueFloor(k) {
    const home = VENUE_HOME[k] || k; if (!UI.inVenue || (VENUE_HOME[UI.inVenue] || UI.inVenue) !== home) return;
    if (k === 'suite' && !roomUntil()) { Sound.play('oops'); return snack(`🔑 ${t('lift_need_room')}`); }   // v0.38
    closeSheet(); Scene.shopGoTo('lift', () => { UI.inVenue = k; UI.spotRes = null; syncView(); Sound.play('lift'); snack(`🛗 ${nm(PLACE_INFO[k])}`); refresh(); });   // into the lift, and out on the other floor
  },
  haircut(arg) {
    const [hair, col] = arg.split('|');
    if (S.me.coins < VENUE.haircut.price) { Sound.play('oops'); return snack(t('snack_poor')); }
    closeSheet(); Scene.venueUse('chair', VENUE.haircut.sec, () => { if (haircut(hair, col) === 'ok') { Sound.play('levelup'); snack(`💇 ${t('sp_haircut_done')}`); save(); } refresh(); });
  },
  // v0.38
  erCure() { const r = erCure(); if (r === 'ok') { Sound.play('levelup'); snack(`🚑 ${t('er_done')}`); save(); } else if (r === 'poor') { Sound.play('oops'); snack(t('snack_poor')); } renderSheet(); refresh(); },   // v0.45
  museumGive(arg) {   // v0.45
    const r = donateMuseum(+arg);
    if (r.r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    if (r.r !== 'ok') return;
    Sound.play(r.up ? 'levelup' : 'chime'); snack(r.up ? `${r.up.e} ${t(r.up.statue ? 'md_up_statue' : 'md_up', { name: nm(r.up) })}` : `💝 ${t('md_thanks', { n: fmtNum(+arg) })}`); save(); renderSheet(); refresh();
  },
  zooPlushBuy(k) { const r = buyZooPlush(k); if (r === 'ok') { Sound.play('collect'); snack(`${{ plushlion: '🦁', plushelephant: '🐘', plushgiraffe: '🦒', plushpenguin: '🐧' }[k]} ${t('sp_zooplush_ok', { name: nm(FURN[k]) })}`); save(); } else { Sound.play('oops'); snack(t('snack_poor')); } renderSheet(); },   // v0.42
  souvenirBuy() { if (buySouvenir() === 'ok') { Sound.play('collect'); snack(`🦖 ${t('sp_souvenir_ok')}`); save(); } else { Sound.play('oops'); snack(t('snack_poor')); } renderSheet(); },
  roomBook() { const r = bookRoom(); if (r === 'ok') { Sound.play('coins'); snack(`🔑 ${t('room_booked', { h: VENUE.room.checkout })}`); save(); } else if (r === 'poor') { Sound.play('oops'); snack(t('snack_poor')); } renderSheet(); },
  trainGo(town) {   // v0.61: a ticket to another city: walk to the platform, ride the train (its own screen), get off there
    if (!COMMUNITIES[town] || UI.inVenue !== 'station') return;
    const from = whereNow(), P = Drive.plan(from, town, 'train');
    if (!P) return;
    if (S.me.coins < P.cost) { Sound.play('oops'); return snack(t('snack_poor')); }
    S.me.coins -= P.cost; if (onceToday('train')) addNeed('fun', VENUE.train.fun); closeSheet(); save(); Sound.play('chime');
    Scene.shopGoTo('ticket', () => { UI.inVenue = null; UI.spotRes = null; Drive.open({ from, to: town, mode: 'train' }, o => trainArrived(o)); });
  },
  commuteHow(k) { if (S.job) { S.job.how = k; save(); } Sound.play('tick'); if (UI.sheet) renderSheet(); },   // v0.62: how you go to work (kept)
  commuteGo() {   // v0.62: one tap to work, the way you chose
    if (!S.job) return;
    const key = S.job.place, jt = S.job.town || myTown(), here = whereNow(), ways = commuteWays(), how = ways.includes(S.job.how) ? S.job.how : ways[0];
    if (!how) return snack(t('job_no_way'));
    closeSheet();
    if (here === jt) { if (jt === myTown()) { UI.tab = 'town'; } else { UI.tab = 'world'; UI.wtown = jt; } syncView(); UI.sheet = { type: 'go', arg: { place: key } }; return ACT.travel(how); }
    if (how === 'train') { const P = Drive.plan(here, jt, 'train'); if (S.me.coins < P.cost) { Sound.play('oops'); return snack(t('snack_poor')); } S.me.coins -= P.cost; save(); return Drive.open({ from: here, to: jt, mode: 'train', place: key }, o => trainArrived(o)); }
    ACT.driveTo(`${jt}|${key}`);
  },
  commuteHome() {   // v0.62: after work, home the way you came (the car if it's here, else the train)
    closeSheet();
    const here = whereNow(), carTown = S.carAt && S.carAt.town ? S.carAt.town : myTown();
    if (S.me.cars.length && carTown === here) return ACT.driveTo(`${myTown()}|`);
    const P = Drive.plan(here, myTown(), 'train');
    if (!P) return snack(t('job_no_way'));
    if (S.me.coins < P.cost) { Sound.play('oops'); return snack(t('snack_poor')); }
    S.me.coins -= P.cost; save(); Drive.open({ from: here, to: myTown(), mode: 'train' }, o => trainArrived(o));
  },
  goHub(hub) { closeSheet(); const here = whereNow(); if (here !== myTown()) { UI.tab = 'world'; UI.wtown = here; } else UI.tab = 'town'; syncView(); openSheet('go', { place: hub }); },   // v0.67
  goStation() { closeSheet(); const here = whereNow(); if (here !== myTown()) { UI.tab = 'world'; UI.wtown = here; } else UI.tab = 'town'; syncView(); openSheet('go', { place: 'station' }); },   // v0.61
  gameGo(arg) {   // bowling or a race with someone: pay, walk over, play
    if (hungry()) { Sound.play('oops'); return snack(`🍔 ${t('too_hungry_play')}`); }   // v0.44: eat first
    const [k, id] = arg.split('|'), G = VENUE_GAMES[k];
    if (outdoorPaused(k)) return wxSnack();   // v0.50: the lake, mini golf, the stage, the batting cage
    if (!G || !(G.place === 'lake' ? Scene.here() === 'lake' : (G.places || [G.place]).some(pl => UI.inVenue === pl || UI.inStore === pl))) return;   // v0.41: the mall's claw machine, the lake too
    const w = id === 'court' ? venueMate(k) : whoIs(id); if (!w) return;
    const ok = sportWillPlay(id);
    if (ok !== 'ok') { Sound.play('oops'); return snack(`${ok === 'grumpy' ? MOOD_E.grumpy : '😬'} ${t('mg_no_' + ok, { name: w.name })}`); }
    if (S.me.coins < G.price) { Sound.play('oops'); return snack(t('snack_poor')); }
    S.me.coins -= G.price; save(); closeSheet();
    if (UI.inVenue && G.spot) Scene.venueUse(G.spot, 0.6, () => openSport(k, id, w)); else openSport(k, id, w);
    refresh();
  },
  bouquetBuy() { if (buyBouquet() === 'ok') { Sound.play('collect'); snack(`💐 ${t('sp_bouquet_ok')}`); save(); } else { Sound.play('oops'); snack(t('snack_poor')); } renderSheet(); },
  specialBuy(arg) {   // v0.40: a specialty of this county: eat it here, or take it with you
    const [k, how] = arg.split('|'), r = buySpecial(k, how === 'take'), F = SPECIALTIES[k];
    if (r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    if (r === 'far' || r === 'no') { Sound.play('oops'); return snack(t('special_far')); }
    Sound.play('collect'); save();
    snack(`${F.e} ${t(how === 'take' ? 'special_took' : 'special_ate', { name: nm(F) })}${r === 'first' ? ' · ' + t('special_new', { n: tastedCount(), m: Object.keys(SPECIALTIES).length }) : ''}`);
    renderSheet(); refresh();
  },
  openSpecials() { openSheet('specials', VIEW_TOWN); refresh(); },
  groceriesBuy() { if (buyGroceries() === 'ok') { Sound.play('collect'); snack(`🛒 ${t('sp_groceries_ok')}`); save(); } else { Sound.play('oops'); snack(t('snack_poor')); } renderSheet(); },
  venueDo(arg) {
    const [v, k, act] = arg.split('|'), fin = (e, msg) => { Sound.play(ACT_SOUND[act] || (act.startsWith('zv_') ? 'done' : 'done')); snack(`${e} ${msg}`); save(); refresh(); };
    // v0.50: walk over, then the bar (with what it is on it), then it's done
    const useK = (sec, cb, look, e) => Scene.venueUse(k, sec, cb, look, e || VDO_E[act] || (act.startsWith('zv_') ? (ZOO_ANIMALS[act.slice(3)] || {}).e : null) || SPOT_E[v + '|' + k] || '⏳');
    if (OUTDOOR.venues.includes(VENUE_HOME[v] || v) && outdoorPaused(VENUE_HOME[v] || v) && UI.inVenue !== 'arena' && act !== 'hotdog') return wxSnack();   // v0.50: the funfair, the zoo, the stadium, the roof (v0.64: not the indoor arena, not the hot dogs under the stands)
    if (act === 'bake') { ACT.placeDo('bakery|bake|'); return; }
    if (act === 'check') {   // the clinic's health check: your own numbers, only for you (v0.50: on the scale for a moment first)
      if (!UI.spotRes || UI.spotRes.key !== v + '|' + k) { const sh = UI.sheet; closeSheet(); return useK(DO_SECS.check, () => { UI.spotRes = { key: v + '|' + k, html: '' }; ACT.venueDo(arg); if (!UI.sheet && sh) openSheet(sh.type, sh.arg); refresh(); }, null, '🩺'); }
      UI.spotRes = { key: v + '|' + k, html: `<b>${t('sp_check_res', { s: S.sleep ? S.sleep.score : '–', k: fmtNum(S.today.steps || 0) })}</b><p class="muted small">${t('sp_check_note')}</p>` };
      Sound.play('select'); return renderSheet();
    }
    if (act === 'truck') { closeSheet(); return useK(DO_SECS.look, () => { if (venueUse('truck') === 'ok') fin('🚒', t('sp_truck_done')); }, null, '🚒'); }   // v0.50: a look round it first
    if (act === 'check7') {   // v0.38: the hospital's check-up: your own week, only for you
      if (!UI.spotRes || UI.spotRes.key !== v + '|' + k) { const sh = UI.sheet; closeSheet(); return useK(DO_SECS.check, () => { UI.spotRes = { key: v + '|' + k, html: '' }; ACT.venueDo(arg); if (!UI.sheet && sh) openSheet(sh.type, sh.arg); refresh(); }, null, '🩺'); }   // v0.50
      const H7 = (S.hist || []).slice(-7), avg = H7.length ? Math.round(H7.reduce((a, b) => a + b, 0) / H7.length) : 0;
      UI.spotRes = { key: v + '|' + k, html: `<b>${t('sp_check7_res', { a: fmtNum(avg), k: fmtNum(S.today.steps || 0), s: S.sleep ? S.sleep.score : '–', n: S.donations || 0 })}</b><p class="muted small">${t(avg >= (S.stepGoal || STEP_GOAL) ? 'sp_check7_good' : 'sp_check7_tip')}</p><p class="muted small">${t('sp_check_note')}</p>` };
      Sound.play('select'); return renderSheet();
    }
    closeSheet();
    if (act === 'eat') { if (S.me.coins < SNACK.price) { Sound.play('oops'); return snack(t('snack_poor')); } return useK(VENUE.eat.sec, () => { if (buySnack() !== 'ok') { Sound.play('oops'); return snack(t('snack_poor')); } fin('😋', t('sp_ate')); }); }   // v0.50: full once you've eaten it
    if (act === 'chat') {
      const ids = [...S.friends.map(f => f.id), ...allLots().map(l => l.id).filter(id => homeOf(id) && homeOf(id).fam)].filter(id => id !== 'me' && homeOf(id));
      const id = ids[Math.floor(Math.random() * ids.length)], h = id && homeOf(id);
      return useK(VENUE.cafeChat.sec, () => { if (venueUse('cafeChat') === 'ok') fin('💬', t('sp_chatted', { name: h ? homeName(h) : '' })); }, h ? h.look : null);
    }
    if (act === 'relax') return useK(VENUE.cafeSofa.sec, () => { if (venueUse('cafeSofa') === 'ok') fin('🎧', t('sp_relaxed')); });
    if (act === 'readbook') return useK(VENUE.libRead.sec, () => { if (venueUse('libRead') === 'ok') fin('📖', t('sp_read_done')); });
    if (act === 'gym') return useK(VENUE.gym.sec, () => { if (venueUse('gym') === 'ok') fin('💪', t('sp_worked_out')); });
    if (act === 'rest') return useK(S.sick && S.sick.med ? SICK.restSec : 6, () => { if (S.sick && S.sick.med && restInBed(SICK.restSec)) { Sound.play('levelup'); snack(`🎉 ${t('sp_cured')}`); save(); refresh(); } else fin('😌', t('sp_rested')); });
    // v0.37: the new places. Paid things: you pay, sit down, enjoy it. Free ones: once a day (the pool twice).
    const PAID = { dinner: '🍝', drink: '🍹', tea: '🫖', book: '📖', arcade: '🕹️', wheel: '🎡', coaster: '🎢', carousel: '🎠', bumper: '🚗', candy: '🍭', giraffefeed: '🦒', hotdog: '🌭', match: '🏟️' };   // v0.41: + the rides; v0.42: + the zoo, the stadium
    if (act === 'match' && arenaNow(VIEW_TOWN).state !== 'live') { Sound.play('oops'); return snack(t('sp_match_over')); }   // v0.42: it finished while you were deciding
    if (PAID[act]) { if (S.me.coins < VENUE[act].price) { Sound.play('oops'); return snack(t('snack_poor')); } return useK(VENUE[act].sec, () => { if (venueBuy(act) === 'ok') fin(PAID[act], t('sp_' + act + '_done')); }); }
    if (act === 'date' || act === 'lounge') {   // someone you know joins you
      if (act === 'date' && S.me.coins < VENUE.date.price) { Sound.play('oops'); return snack(t('snack_poor')); }
      const ids = [...S.friends.map(f => f.id), ...allLots().map(l => l.id).filter(id => homeOf(id) && homeOf(id).fam)].filter(id => id !== 'me' && homeOf(id));
      const id = ids[Math.floor(Math.random() * ids.length)], h = id && homeOf(id);
      return useK(VENUE[act].sec, () => {
        const r = act === 'date' ? venueBuy('date') : venueUse('lounge');
        if (r === 'ok') { if (act === 'date' && id) { S.rel = S.rel || {}; S.rel[id] = Math.min(100, relOf(id) + VENUE.date.rel); } fin(act === 'date' ? '🥂' : '💬', t('sp_' + act + '_done', { name: h ? homeName(h) : '' })); }
      }, h ? h.look : null);
    }
    const ONCE = { swim: '🏊', sunbathe: '😎', view: '🏙️', dive: '🤸', sauna: '🧖', visit: '🫶', babies: '👶', trains: '🚆', bed: '😴', bath: '🛁', ex_dino: '🦖', ex_space: '🚀', ex_art: '🖼️', ex_history: '🏺', petting: '🐐', tour: '🏟️' };   // v0.38: + the new ones (v0.42: + the zoo, the stadium)
    Object.keys(ZOO_ANIMALS).forEach(a => { ONCE['zv_' + a] = ZOO_ANIMALS[a].e; });
    if (ONCE[act]) return useK(VENUE[act].sec, () => { if (venueUse(act) === 'ok') fin(ONCE[act], t(act.startsWith('ex_') ? 'sp_exhibit_done' : act.startsWith('zv_') ? 'sp_zoo_look_done' : 'sp_' + act + '_done')); });
    if (act === 'donate') return useK(VENUE.donate.sec, () => { if (donateBlood() === 'ok') { fin('🩸', t('sp_donate_done')); } });
  },
  leaveStore() {
    if (UI.basket && UI.basket.items.length && !confirm(t('basket_leave_q', { n: UI.basket.items.length }))) return;
    const left2 = UI.inStore; closeSheet(); UI.inStore = null; UI.lastStore = null; UI.mallFloor = null; UI.furnFloor = null; UI.basket = null; Scene.setFilm(null); UI.tab = 'town'; syncView(); if (left2) Scene.focusPlace(left2);   // v0.49: the camera on its door
  },
  // v0.23: up and down the mall, into the cinema
  mallFloor(f) { closeSheet(); UI.mallFloor = f; syncView(); Sound.play('select'); },
  addWare(arg) {
    const [id, n0] = arg.split('#'), w = Scene.shopWare(id), n = +n0 || 1;
    if (!w || !UI.basket) return;
    const r = wareCheck(w, UI.basket.items, n);
    if (r !== 'ok') { Sound.play('oops'); return snack(t('ware_no_' + r, { n: PET_MAX })); }
    const e = { wid: w.id, kind: w.kind, k: w.k, act: w.act, arg: w.arg, price: w.price * (w.kind === 'seed' ? n : 1), n: w.kind === 'seed' ? n : 1 };
    e.vol = wareVol(e);
    UI.basket.items.push(e);
    Sound.play('pop'); closeSheet(); snack(`🛒 ${t('basket_added', { name: wareName(w), n: UI.basket.items.length })}`);
  },
  dropWare(i) { if (UI.basket) UI.basket.items.splice(+i, 1); renderSheet(); },
  goTill() { closeSheet(); Scene.shopGoTill(() => { openSheet('checkout'); refresh(); }); },
  payWith(how) {
    const B = UI.basket;
    if (!B || !B.items.length) return;
    const way = takeHomeWays(B.items, B.store).find(x => x.how === how);
    if (!way || !way.ok) return;
    if (checkout(B.items, how) !== 'ok') { Sound.play('oops'); return snack(t('snack_poor')); }
    const n = B.items.length; B.items = [];
    Sound.play('coins'); closeSheet(); save();
    snack(t('paid_' + how, { n, h: DELIVERY.hour }));
  },
  // things you deal for at the counter right away: a house, land, a garage, a car (the dealer brings it home)
  wareDeal(id) {
    const w = Scene.shopWare(id);
    if (!w) return;
    closeSheet();
    if (w.kind === 'house') {
      const i = +w.k;
      if (S.me.houses.includes(i)) { const r = moveHouse(i); if (r) snack(r > 1 ? t('snack_moved_stored', { name: nm(HOUSES[i]), n: r - 1 }) : t('snack_moved', { name: nm(HOUSES[i]) })); return save(); }
      return result(buyHouse(i), () => { Sound.play('coins'); snack(t('snack_house', { name: nm(HOUSES[i]) })); save(); });
    }
    if (w.kind === 'land') return result(buyLand(w.k), () => { Sound.play('coins'); snack(t('snack_land_' + w.k)); save(); });
    if (w.kind === 'car') {
      const r = orderCar(w);
      if (r === 'ok') { Sound.play('coins'); snack(`🚗 ${t('car_ordered', { name: nm(CARS[w.k]), h: DELIVERY.hour, n: deliveryFee([{ price: w.price }]) })}`); save(); }
      else { Sound.play('oops'); snack(r === 'own' ? t('owned') : r === 'garage' ? `🚗 ${t('garage_full')}` : t('snack_poor')); }
    }
  },
  // v0.16: watch mini-you work out in town
  seeLive() { if (UI.tab !== 'town') { UI.visit = null; UI.tab = 'town'; syncView(); } const p = Scene.liveAt(); if (p) Scene.lookAt(p[0], p[1]); },
  // jobs and the clinic (v0.14)
  jobApply(arg) {
    const [key, asked] = String(arg).split('|');   // v0.50: '|ok' when you said yes before walking over
    if (!asked && S.job && S.job.place !== key && !confirm(t('job_switch_q', { old: nm(JOBS[S.job.place]) }))) return;
    if (commuteKm(VIEW_TOWN) > COMMUTE.maxKm) return snack(t('job_too_far', { km: commuteKm(VIEW_TOWN), max: COMMUTE.maxKm }));   // v0.62
    if (takeJob(key, VIEW_TOWN) === 'ok') { Sound.play('chime'); snack(`🎉 ${t('job_hired', { job: nm(JOBS[key]) })}${VIEW_TOWN !== myTown() ? ' · ' + nm(COMMUNITIES[VIEW_TOWN]) : ''}`); }
    if (UI.sheet) renderSheet();
  },
  jobStart(key) {
    const r = startShift(key);
    if (r === 'ok') { Sound.play('select'); snack(`💼 ${t('job_started', { to: JOBS[key].to })}`); }
    else if (r === 'closed') snack(t('job_closed', { from: JOBS[key].from, to: JOBS[key].to }));
    else if (r === 'away') snack(t('job_be_there'));   // v0.62
    else if (r === 'hungry') { Sound.play('oops'); snack(`🍔 ${t('too_hungry_work')}`); }   // v0.44
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
  placeDo(arg, now2) {
    const [key, act, x] = arg.split('|');
    if (['walk', 'fish', 'help'].includes(act) && outdoorPaused(key === 'lake' ? 'lake' : key === 'park' ? 'park' : 'fields')) return wxSnack();   // v0.50
    const TK = { help: ['help', '🌾', 'crouch'], bake: ['bake', '🍞', 'stand'], fish: ['fish', '🎣', 'fish'], read: ['read', '📖', 'stand'], card: ['card', '📮', 'stand'] }[act];
    if (TK && !now2) {   // v0.50 (Mason #29): it's done once the bar's full, not when you tap
      if (act === 'fish' && weatherNow().kind === 'snow') return snack(`🧊 ${t('w_frozen')}`);
      if (act === 'bake' && (S.me.barn.wheat || 0) < BREAD.wheat) return snack(t('pl_need_wheat', { n: BREAD.wheat }));
      const sp = UI.sheet && UI.sheet.type === 'spot' ? String(UI.sheet.arg).split('|')[1] : key === 'bakery' ? 'oven' : null, back = UI.sheet && act === 'card' ? { ...UI.sheet } : null;
      closeSheet();
      const go = () => { if (back && !UI.sheet) openSheet(back.type, back.arg); ACT.placeDo(arg, true); refresh(); };
      if (Scene.view().mode === 'shop') Scene.shopDo(sp, DO_SECS[TK[0]], TK[1], go);
      else Scene.townDo(DO_SECS[TK[0]], TK[1], go, TK[2], act === 'fish' ? '🎣' : null);
      return refresh();
    }
    if (act === 'help') {
      const r = helpHarvest();
      if (r.r === 'nojobs') { closeSheet(); return openSheet('cap'); }
      if (r.r === 'ok') { Sound.play('harvest'); snack(`🌾 ${t('pl_helped', { n: HELP_HARVEST.wheat })}`); if (r.fest) setTimeout(() => { Sound.play('levelup'); snack(`🎉 ${t('pl_fest_now')}`); }, 900); }
    } else if (act === 'bake') { const r = bakeBread(); snack(r === 'ok' ? `🍞 ${t('pl_baked')}` : t('pl_need_wheat', { n: BREAD.wheat })); if (r === 'ok') Sound.play('collect'); }
    else if (act === 'fish') { const r = lakeFish(); if (r.r === 'frozen') return snack(`🧊 ${t('w_frozen')}`); if (r.r === 'nojobs') { closeSheet(); return openSheet('cap'); } if (r.r === 'ok') { Sound.play('collect'); snack(`${GOODS[r.k].e} ${t('pl_caught', { name: nm(GOODS[r.k]) })}`); } }
    else if (act === 'walk') { closeSheet(); Scene.stroll(() => { const n = parkWalk(); Sound.play(n ? 'woof' : 'select'); snack(n ? `🐕 ${t('pl_dog_walked', { n })}` : `🌳 ${t('pl_strolled')}`); refresh(); }); return refresh(); }   // v0.25: a real lap
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
  visit(id) { if (id !== 'me' && homeOf(id)) visitSocial(id); closeSheet(); setLevel(0); if (UI.visit && UI.visit !== id) leaveHost(UI.visit); UI.hostAns = null; if (id === 'me') { setTab('home'); return; } if (UI.tab !== 'world') UI.tab = 'town'; UI.visit = id; UI.visitInside = false; syncView(); },
  ranking: () => openSheet('ranking'),
  barn: () => openSheet('barn'),
  friendSheet: id => openSheet('friend', id),
  harvestAll() {
    if (awayCheck()) return;
    const r = readyLists();
    const jobs = [...r.fields.map(harvestJob), ...r.animals.map(animalJob), ...r.trees.map(treeJob), ...r.hives.map(hiveJob)];
    const n = Scene.goMany(jobs);
    if (n) snack(t('snack_going', { n }));
  },
  stopJobs() { Scene.cancel(); },
  // v0.44: walk to the trough and fill it with feed from the barn (none left: off to the farm supply store)
  fillTrough() {
    if (!(S.me.feed > 0) && (S.me.trough || 0) < FEED.trough) { Sound.play('oops'); snack(`${FEED.e} ${t('feed_none')}`); return ACT.openShop('animals'); }
    walkDo({ kind: 'trough' }, { pose: 'crouch', dur: DO_SECS.trough * 1000, e: FEED.e, done: after(() => { const r = fillTrough(); if (r.r === 'ok') { Sound.play('collect'); snack(`${FEED.e} ${t('feed_filled', { n: r.n, t: S.me.trough, c: FEED.trough, b: S.me.feed || 0 })}`); save(); refresh(); } else if (r.r === 'full') snack(`${FEED.e} ${t('feed_full', { c: FEED.trough })}`); }) });
  },
  buyFeed() { if (buyFeed() === 'ok') { Sound.play('buy'); snack(`${FEED.e} ${t('feed_bought', { n: FEED.n, b: S.me.feed })}`); save(); } else { Sound.play('oops'); snack(t('snack_poor')); } renderSheet && UI.sheet && renderSheet(); refresh(); },
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
  driveCar(i) { if (S.carAt) return snack(`🚗 ${t('car_out_first')}`); S.me.car = +i; snack(t('snack_drive', { name: nm(CARS[S.me.cars[+i].k]) })); },
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
  editDone() { Scene.stopEdit(); UI.editSel = null; Scene.editSel(null); },
  editSel(k) { UI.editSel = k || null; Scene.editSel(UI.editSel); },
  tintSel(c) { const ed = Scene.getEdit(); if (ed && ed.sel) setTint(ed.scope, ed.sel, c); },
  setDrive(st) { const r = setDrive(st); if (r === 'ok') { Sound.play('coins'); snack(`🚗 ${t('drive_built', { name: nm(DRIVES[st]) })}`); Scene.dropEnts(); } else if (r === 'poor') { Sound.play('oops'); snack(t('snack_poor')); } else if (r === 'space') snack(t('drive_no_room')); else if (r === 'cars') snack(t('drive_cars')); },
  trayTab(x) { UI.tray = x; },
  areaPick(k) { UI.moveArea = k; Scene.select(null); },
  areaCancel() { UI.moveArea = null; },
  holdNew(k) { const scope = edScope(); Scene.hold({ k, rot: 0, tint: itemDef(scope, k).tint ? rand(TINTS) : null }); },
  garageRotate() { if (rotateGarage()) { Sound.play('select'); Scene.dropEnts(); save(); } else snack(t('snack_norotate')); },   // v0.46
  trayRotate() {
    const ed = Scene.getEdit();
    if (ed.hold) ed.hold.rot = ((ed.hold.rot || 0) + 1) & 3;   // v0.46: four ways
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
    if (VIEW_TOWN !== myTown()) { Sound.play('oops'); return snack(t('land_own_town')); }   // v0.59: only in your own town
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
  toggleAmb() { S.amb = S.amb === false; Sound.setAmb(S.amb !== false); },   // v0.56: rain, birds, crowds…
  weatherReal() { S.weatherReal = !S.weatherReal; if (S.weatherReal) realWeather(true); else snack(t('w_sim_src')); },
  simWeather(k) { S.weather = k === 'auto' ? null : { kind: k === 'heavy' ? 'rain' : k, heavy: k === 'heavy', temp: simWeather().temp, forced: true };   // v0.50: + heavy rain
    snack(wxName()); },
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
    if (UI.tab === 'home' && !UI.inside && !S.live) walkDo({ kind: 'mailbox' }, { pose: 'mail', dur: 600, done: after(() => openSheet('mail', 'box')) });
    else openSheet('mail', 'box');
  },
  mailOpen: arg => openSheet('mail', arg),
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
  inviteHere(arg) { const [st, p, n] = arg.split('|'), it = inviteJoin({ st, p: +p, n: +n }); closeSheet(); if (it) { notify(it); Sound.play('levelup'); save(); } else snack(t('invite_none')); },   // v0.27
  simMoney() { S.me.coins += 10000; snack('+🪙10,000'); },
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
  if (k === 'trough' || (k === 'bubble' && h.what === 'trough')) return ACT.fillTrough();   // v0.44
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
    if (mine && (isRipe(f) || isRotten(f))) { const j = harvestJob(h.i); return walkDo(j.tg, j.o); }
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
  if (k === 'parkSpot') { openSheet('spot', 'park|' + h.k); return refresh(); }   // v0.32
  if (k === 'ware' && h.wk === 'spot') { UI.spotRes = null; openSheet('spot', (UI.inVenue || UI.inStore) + '|' + h.k); return refresh(); }   // v0.30: inside a building (v0.37: or the supermarket's fresh food)
  if (k === 'ware') {   // v0.20: in a store (v0.23: the mall's escalators, stalls, games and cinema)
    if (h.wk === 'escalator') { if (String(h.k).startsWith('furniture')) { closeSheet(); UI.furnFloor = h.k; syncView(); Sound.play('select'); } else ACT.mallFloor(h.k); return refresh(); }   // v0.45: the furniture store's floors
    if (h.wk === 'stall') { openSheet('food', h.k); return refresh(); }
    if (h.wk === 'claw') { openSheet('claw'); return refresh(); }
    if (h.wk === 'ticket') { openSheet('cinema'); return refresh(); }
    if (h.wk === 'cinemaDoor') { if (Scene.film()) ACT.mallFloor('cinema'); else openSheet('cinema'); return refresh(); }
    if (h.wk === 'cinemaExit') { Scene.setFilm(null); ACT.mallFloor('mall2'); return refresh(); }
    openSheet('ware', h.id); return refresh();
  }
  if (k === 'filmEnd') { const f = MALL.movies[h.k]; Sound.play('chime'); if (UI.filmPaid === h.k) { filmWatched(); UI.filmPaid = null; save(); } if (UI.posterNew === h.k) snack(`🎞️ ${t('movie_poster', { name: nm(f) })}`); else snack(`🎬 ${t('film_done', { name: nm(f) })}`); UI.posterNew = null; return refresh(); }
  if (k === 'clerk') { if (UI.inVenue) openSheet('place', UI.inVenue); else openSheet('checkout'); return refresh(); }
  if (k === 'shopDoor') { if (UI.inVenue) ACT.leaveVenue(); else ACT.leaveStore(); return refresh(); }
  if (k === 'worldMap') { ACT.world(); return refresh(); }
  if (k === 'shop') return openSheet('place', h.k);   // (clinic is a shop too since v0.14)
  if (k === 'place' && h.key) return openSheet('place', h.key);
  if (k === 'garage' && h.owner === 'me') return openSheet('garage');   // v0.24: which cars are where
  if (k === 'person') { UI.socLast = null; UI.socWalk = null; openSheet('social', h.id); return refresh(); }   // v0.34: anyone, anywhere: the sheet opens at once, you walk over when you pick something to do
  if (k === 'land') return openSheet('land', { st: h.st, p: h.p, n: h.n, run: h.run });
  if (k === 'buyParcel') return openSheet('land', { st: lotOf('me').st, p: lotOf('me').p + lotOf('me').n, n: 1, next: true });
  if (k === 'furn') {
    const it = shownRoom(homeOf(Scene.view().owner)).items.find(x => x.id === h.id), d = FURN[h.k];
    const sub = d.souv ? `✨ ${t('souv_title')}` : d.use ? t('use_' + d.use) : '';
    const vo = Scene.view().owner;
    if (it && d.use && canUseAt(vo)) return tip('furn', h.k, nm(d), sub, { act: 'useFurn', arg: it.id, label: t('fu_' + d.use) });   // v0.34: you go and use it only when you say so
    else if (it && d.use) { tip('furn', h.k, nm(d), `🙏 ${t('ask_first')}`); UI.hostWant = h.k; return openSheet('host', vo); }   // house rules: ask first
    return tip('furn', h.k, nm(d), sub);
  }
  if (k === 'lot') { ACT.goTo(h.owner); return refresh(); }
  if (k === 'spot') { if (VIEW_TOWN !== myTown()) return; closeSheet(); openSheet('go', { spot: [h.x, h.y] }); return refresh(); }   // v0.16: anywhere in town
  if (k === 'emptyLot') return openSheet('invite');
  if (k === 'plaza') return openSheet('place', 'plaza');
  const ed = Scene.getEdit();
  if (!ed) return;
  if (k === 'drop') {   // v0.24 (was 'place', which a public place also used, so nothing could be put down)
    const hd = ed.hold;
    if (!hd) return refresh();
    const ok = hd.id ? moveItem(ed.scope, hd.id, h.x, h.y, hd.rot) : placeFromStore(ed.scope, hd.k, h.x, h.y, hd.rot, hd.tint);
    if (ok) { Scene.hold(null); Sound.play('select'); if (hd.id) Scene.select(hd.id); else snack(t('snack_placed')); }
    else { snack(t(PLACE_WHY === 'block' ? 'snack_blocks_way' : PLACE_WHY === 'face' ? 'snack_face' : PLACE_WHY === 'garage' ? 'garage_door' : 'snack_noroom')); if (h.dragged) Scene.hold(null); }   // dragged somewhere it can't go: it stays where it was
  } else if (k === 'areaDrop') {
    const r = moveArea(h.k, h.x, h.y);
    if (r === 'ok') { Sound.play('select'); Scene.dropEnts(); } else snack(t(r === 'block' ? 'snack_blocks_way' : r === 'door' ? 'garage_door' : 'area_no_room'));
    UI.editSel = h.k; Scene.editSel(h.k);
  } else if (k === 'editArea' || k === 'editHouse') { Scene.select(null); UI.editSel = k === 'editHouse' ? 'house' : h.k; Scene.editSel(UI.editSel); }
  else if (k === 'item') { UI.editSel = null; Scene.editSel(null); Scene.select(h.id); }
  else if (k === 'deselect') {
    if (UI.moveArea && h.lx !== undefined) {   // v0.15: put the farm area here (its top-left corner)
      const r = moveArea(UI.moveArea, Math.floor(h.lx), Math.floor(h.ly));
      if (r === 'ok') { Sound.play('select'); snack(`✅ ${t('area_moved', { name: t('area_' + UI.moveArea) })}`); UI.moveArea = null; Scene.dropEnts(); }
      else snack(t(r === 'block' ? 'snack_blocks_way' : r === 'door' ? 'garage_door' : 'area_no_room'));
      return refresh();
    }
    Scene.select(null); UI.editSel = null; Scene.editSel(null);
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
  pruneFeed();   // v0.64
  setTab('home');
  // v0.63.1: you're away in another city (drove, took the train, flew or sailed there): open there, standing where you were
  // (after the whole script has loaded: the world view needs things defined further down)
  const away = S.trav && COMMUNITIES[S.trav.town] && S.trav.town !== myTown() ? S.trav.town : null;
  refresh();
  if (away) setTimeout(() => { if (UI.tab !== 'home' || tutStep()) return; UI.tab = 'world'; UI.wtown = away; syncView(); refresh();
    setTimeout(() => { if (S.out && S.out.town === away && UI.tab === 'world') Scene.arriveAt(S.out.pt, S.out.place); snack(`📍 ${t('trav_open_here', { c: nm(COMMUNITIES[away]) })}`); }, 300); }, 0);
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
// ================= v0.59 (Mason #30): DreamWorld =================
// One big map of our own instead of the real world: the land, the regions in each country's style, the interstates
// between every place (the sea bridges too), the railway between the team cities, airports and ports. DM_S: drawn at
// this scale (the map scrolls both ways).
const DM_S = 0.74;
const dmXY = id => DREAM_AT[id].map(v => v * DM_S);
// a road between two places: a curve bowed `bend` to its side; its points (for drawing, and for driving in v0.60)
function dreamRoadPts(a, b, bend, n = 24) {
  const [ax, ay] = DREAM_AT[a], [bx, by] = DREAM_AT[b], L = Math.hypot(bx - ax, by - ay) || 1, mx = (ax + bx) / 2 - (by - ay) / L * bend, my = (ay + by) / 2 + (bx - ax) / L * bend, out = [];
  for (let k = 0; k <= n; k++) { const u = k / n, v = 1 - u; out.push([v * v * ax + 2 * v * u * mx + u * u * bx, v * v * ay + 2 * v * u * my + u * u * by]); }
  return out;
}
function dmShape(path, pts) {   // a soft closed coastline through the points' midpoints
  const Q = pts.map(([x, y]) => [x * DM_S, y * DM_S]);
  Q.forEach((p, i) => { const q = Q[(i + 1) % Q.length], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; if (!i) path.moveTo(m[0], m[1]); else path.quadraticCurveTo(p[0], p[1], m[0], m[1]); });
  const p0 = Q[0], q0 = Q[1]; path.quadraticCurveTo(p0[0], p0[1], (p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2); path.closePath();
  return path;
}
function drawDreamMap(cv) {
  const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1)), g = cv.getContext('2d');
  cv.width = DREAM_MAP.w * DM_S * dpr; cv.height = DREAM_MAP.h * DM_S * dpr; g.scale(dpr, dpr);
  drawDreamMapTo(g);
}
// v0.63: the map into any context (already scaled / moved): the plane and the ship draw a close-up piece of it.
// bare: without the labels, the airports, ports and compass (they draw their own)
function drawDreamMapTo(g, bare, s = 1) {   // (v0.65: s: map px per screen px when zoomed, so lines and signs stay the same size on screen)
  const dark = document.body.classList.contains('dark'), W = DREAM_MAP.w * DM_S, H = DREAM_MAP.h * DM_S, S0 = DM_S;
  const sea = g.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, dark ? '#1e3a56' : '#b9e2f6'); sea.addColorStop(1, dark ? '#142a40' : '#8ccbea');
  g.fillStyle = sea; g.fillRect(0, 0, W, H);
  g.strokeStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.55)'; g.lineWidth = 1.2;
  for (let k = 0; k < 80; k++) { const x = hash(k, 3) * W, y = hash(k, 4) * H; g.beginPath(); g.arc(x, y, 4, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  const land = new Path2D(); DREAM_LAND.forEach(pts => dmShape(land, pts));
  g.strokeStyle = dark ? 'rgba(90,150,190,.25)' : 'rgba(255,255,255,.6)'; g.lineWidth = 14 * Math.max(0.35, s); g.lineJoin = 'round'; g.stroke(land);
  g.save(); g.translate(0, 5); g.fillStyle = dark ? 'rgba(0,0,0,.35)' : 'rgba(40,90,120,.2)'; g.fill(land); g.restore();
  g.fillStyle = dark ? '#3c5a3a' : '#b9dc8c'; g.fill(land);
  g.save(); g.clip(land);
  DREAM_REGIONS.forEach(Rg => {   // each region a soft tint of its colour
    const [x, y] = Rg.at.map(v => v * S0), rx = Rg.r[0] * S0, ry = Rg.r[1] * S0;
    g.save(); g.translate(x, y); g.scale(1, ry / rx); const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, Rg.c + (dark ? '40' : '38')); gr.addColorStop(1, Rg.c + '00'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
  });
  const peaks = DREAM_PEAKS, deserts = [[262, 440, 60, 28], [680, 560, 50, 40], [1030, 690, 60, 34]], woods = [[400, 260, 50, 30], [560, 240, 50, 30], [900, 300, 60, 40], [420, 620, 60, 40]];
  deserts.forEach(([x, y, rx, ry]) => { g.save(); g.translate(x * S0, y * S0); g.scale(1, ry / rx); const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx * S0); gr.addColorStop(0, dark ? 'rgba(170,140,80,.8)' : 'rgba(240,214,150,.95)'); gr.addColorStop(1, 'rgba(240,214,150,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx * S0, 0, Math.PI * 2); g.fill(); g.restore(); });
  woods.forEach(([x, y, rx, ry], fi) => { for (let k = 0; k < 26; k++) { const a = hash(k, fi * 5) * Math.PI * 2, r = Math.sqrt(hash(k, fi * 5 + 1)), tx = (x + Math.cos(a) * r * rx) * S0, ty = (y + Math.sin(a) * r * ry) * S0; g.fillStyle = k % 3 ? (dark ? '#2d5a33' : '#5fa356') : (dark ? '#25502b' : '#4f9448'); g.beginPath(); g.arc(tx, ty, 2.8, 0, Math.PI * 2); g.fill(); } });
  peaks.forEach(([x, y]) => { const px = x * S0, py = y * S0; g.fillStyle = dark ? '#6a6f68' : '#9a9f8e'; g.beginPath(); g.moveTo(px - 8, py + 4); g.lineTo(px, py - 9); g.lineTo(px + 8, py + 4); g.closePath(); g.fill(); g.fillStyle = '#f7fafb'; g.beginPath(); g.moveTo(px - 3, py - 4); g.lineTo(px, py - 9); g.lineTo(px + 3, py - 4); g.closePath(); g.fill(); });
  g.restore();
  g.strokeStyle = dark ? '#5d8455' : '#f7f1d8'; g.lineWidth = 2.2 * s; g.stroke(land);
  // the railway (under the roads): a dark line with ties
  DREAM_RAIL.forEach(([a, b, bend = 30]) => { const P = dreamRoadPts(a, b, bend).map(q => q.map(v => v * S0)); g.strokeStyle = dark ? '#a99a86' : '#6b5a48'; g.lineWidth = 1.6 * s; g.setLineDash([]); g.beginPath(); P.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke();
    g.lineWidth = 4 * s; g.setLineDash([1 * s, 5 * s]); g.stroke(); g.setLineDash([]); });
  // the interstates: a white casing, the yellow road; the sea bridges with piers; a shield with the number
  DREAM_ROADS.forEach(([a, b, no, bend, kind]) => {
    const P = dreamRoadPts(a, b, bend).map(q => q.map(v => v * S0)), path = () => { g.beginPath(); P.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); };
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (kind === 'bridge') { P.forEach((q, i) => { if (i % 2) { g.fillStyle = dark ? '#8a8f96' : '#a7adb5'; g.fillRect(q[0] - s, q[1], 2 * s, 5 * s); } }); }
    path(); g.strokeStyle = dark ? '#2b2b30' : '#ffffff'; g.lineWidth = 6 * s; g.stroke();
    path(); g.strokeStyle = kind === 'bridge' ? '#c9cfd6' : '#f2b33d'; g.lineWidth = 3.2 * s; g.stroke();
    const m = P[Math.floor(P.length / 2)]; g.fillStyle = '#2f5fa8'; g.strokeStyle = '#fff'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(m[0] - 7 * s, m[1] - 7 * s); g.lineTo(m[0] + 7 * s, m[1] - 7 * s); g.lineTo(m[0] + 7 * s, m[1] + s); g.quadraticCurveTo(m[0], m[1] + 8 * s, m[0] - 7 * s, m[1] + s); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = `900 ${7 * s}px ${UI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(no), m[0], m[1] - 2 * s);
  });
  if (bare) return;
  // airports and ports at their own spots (v0.63: where the planes take off and the ships sail from)
  g.font = `14px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  DREAM_AIR.forEach(id => { const [x, y] = DREAM_AIR_AT[id]; g.fillText('✈️', x * S0, y * S0); });
  DREAM_PORT.forEach(id => { const [x, y] = DREAM_PORT_AT[id]; g.fillText('⚓', x * S0, y * S0); });
  // the regions' names
  DREAM_REGIONS.forEach(Rg => { const x = Rg.at[0] * S0, y = (Rg.at[1] - Rg.r[1] * 0.7) * S0, txt = t('dmr_' + Rg.k);
    g.font = `800 12px ${UI_FONT}`; g.lineWidth = 3; g.strokeStyle = dark ? 'rgba(0,0,0,.45)' : 'rgba(255,255,255,.85)'; g.strokeText(txt, x, y); g.fillStyle = dark ? '#e3dccd' : '#5d5448'; g.fillText(txt, x, y); });
  g.font = `italic 700 13px ${UI_FONT}`; g.fillStyle = dark ? 'rgba(200,225,245,.45)' : 'rgba(40,110,160,.5)'; g.fillText(t('dm_sea'), W * 0.82, H * 0.08); g.fillText(t('dm_sea'), W * 0.1, H * 0.86);
  const cxp = W - 36, cyp = H - 36;   // compass
  g.fillStyle = dark ? 'rgba(38,34,30,.75)' : 'rgba(255,253,248,.85)'; g.beginPath(); g.arc(cxp, cyp, 22, 0, Math.PI * 2); g.fill();
  [[0, -1, '#e5484d'], [0, 1, '#8b8274'], [1, 0, '#8b8274'], [-1, 0, '#8b8274']].forEach(([dx, dy, col]) => { g.fillStyle = col; g.beginPath(); g.moveTo(cxp + dx * 17, cyp + dy * 17); g.lineTo(cxp - dy * 4, cyp + dx * 4); g.lineTo(cxp + dy * 4, cyp - dx * 4); g.closePath(); g.fill(); });
}
// ================= v0.65 (Mason #32): the world map =================
// On the World page: a small picture of the whole map (tap it). Full screen: drag to move, pinch / the mouse wheel /
// ± to zoom; the closer you look, the more you see: from WMAP_CFG.airAt the airports (a runway and a terminal) and the
// ports (a pier), from WMAP_CFG.plansAt every town's own streets, canals, buildings and homes (drawn once from its
// layout, then kept). Lines and signs keep their size on screen. Tap a place to pick it.
const BIGMAP = { el: null, cv: null, g: null, x: 0, y: 0, z: 1, W: 0, H: 0, ptrs: new Map(), tap: null, raf: 0, pinch: null };
const TOWN_PLANS = {};
const DMW = () => DREAM_MAP.w * DM_S, DMH = () => DREAM_MAP.h * DM_S;
const wmFit = () => Math.min(BIGMAP.W / DMW(), BIGMAP.H / DMH());
// a town's street plan, drawn once: its ground, homes, the square, canals, every road (curves too), the buildings
function townPlan(id) {
  const dark = document.body.classList.contains('dark'), key = id + (dark ? ':d' : '');
  if (TOWN_PLANS[key]) return TOWN_PLANS[key];
  const L = layoutOf(id), Wd = L.world, px = WMAP_CFG.planPx, w = Wd.x1 - Wd.x0, d = Wd.y1 - Wd.y0, cv = document.createElement('canvas');
  cv.width = Math.ceil(w * px); cv.height = Math.ceil(d * px);
  const q = cv.getContext('2d'); q.scale(px, px); q.translate(-Wd.x0, -Wd.y0);
  q.fillStyle = dark ? 'rgba(58,60,54,.94)' : 'rgba(238,233,218,.96)'; q.beginPath(); q.roundRect(Wd.x0, Wd.y0, w, d, 10); q.fill();
  (L.fields || []).forEach(F => { q.fillStyle = dark ? '#5a4a34' : '#d9c08a'; q.fillRect(F.x, F.y, F.w, F.d); q.strokeStyle = dark ? '#6d5a40' : '#b99b62'; q.lineWidth = 0.5; for (let x = F.x + 2; x < F.x + F.w; x += 3) { q.beginPath(); q.moveTo(x, F.y + 0.5); q.lineTo(x, F.y + F.d - 0.5); q.stroke(); } });   // the farm fields
  if (L.park) { const P = L.park; q.fillStyle = dark ? '#35603a' : '#9fd27f'; q.beginPath(); q.roundRect(P.x, P.y, P.w, P.d, 3); q.fill();
    if (L.parkLoop) { q.strokeStyle = dark ? '#8a8270' : '#e8dcc0'; q.lineWidth = 1.2; q.beginPath(); L.parkLoop.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.closePath(); q.stroke(); } }
  (L.pocket ? [].concat(L.pocket) : []).forEach(P => { if (P && P.w) { q.fillStyle = dark ? '#35603a' : '#a9d98a'; q.fillRect(P.x, P.y, P.w, P.d); } });
  if (L.lake) { const K = L.lake; q.fillStyle = dark ? '#2c5878' : '#8fcbe8'; q.beginPath(); q.ellipse(K.x, K.y, K.rx, K.ry, 0, 0, Math.PI * 2); q.fill(); q.strokeStyle = dark ? '#3f6f92' : '#d8eef8'; q.lineWidth = 0.8; q.stroke(); }
  allLots(id).forEach(l => { const [ox, oy] = lotOrigin(l.id), lw = lotW(l.id);
    q.fillStyle = dark ? '#3f5a3a' : '#bfdc9a'; q.fillRect(ox + 0.4, oy + 0.4, lw - 0.8, LOT_D - 0.8);
    q.fillStyle = dark ? '#8a7f70' : '#d9a37a'; q.fillRect(ox + lw / 2 - 3, oy + 2, 6, 6); });
  if (L.centre) { const C = L.centre; q.fillStyle = dark ? '#5a564e' : '#dccfb8'; q.fillRect(C.x, C.y, C.w, C.d); }
  (L.water || []).forEach(([x0, y0, x1, y1]) => { q.fillStyle = dark ? '#2c5878' : '#8fcbe8'; q.fillRect(x0, y0, x1 - x0, y1 - y0); });
  const ROADC = { street: '#9aa1a8', avenue: '#7d848b', avenue4: '#727981', boulevard: '#6c737b', lane: '#b0b5ba', dirt: '#c2a77c', frontage: '#9aa1a8' };
  (L.roads || []).forEach(([x0, y0, x1, y1, kind]) => { q.fillStyle = ROADC[kind] || '#9aa1a8'; q.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (['avenue', 'avenue4', 'boulevard'].includes(kind)) { const hz = x1 - x0 >= y1 - y0; q.strokeStyle = '#f2c230'; q.lineWidth = 0.35; q.beginPath(); if (hz) { q.moveTo(x0, (y0 + y1) / 2); q.lineTo(x1, (y0 + y1) / 2); } else { q.moveTo((x0 + x1) / 2, y0); q.lineTo((x0 + x1) / 2, y1); } q.stroke(); } });
  (L.bends || []).forEach(B => { q.strokeStyle = ROADC.avenue; q.lineWidth = 4; q.lineCap = 'round'; q.beginPath(); B.pts.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.stroke(); });
  if (L.highway && L.highway.pts) { q.strokeStyle = dark ? '#8a9097' : '#5f666e'; q.lineWidth = 5; q.lineCap = 'butt'; q.beginPath(); L.highway.pts.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y))); q.stroke(); }
  (L.stores || []).forEach(([k, x, y, sw = 6, sd = 5.5]) => { const big = ['stadium', 'arena', 'mall', 'hospital', 'station'].includes(k);
    q.fillStyle = big ? (dark ? '#7a6a64' : '#e6c9b8') : (dark ? '#6c6a64' : '#f4ead8'); q.strokeStyle = dark ? '#a39b8c' : '#9a8a72'; q.lineWidth = 0.3; q.fillRect(x, y, sw, sd); q.strokeRect(x, y, sw, sd);
    const e = (STORES[k] || {}).e; if (e) { q.font = `${Math.min(sw, sd) * 0.6}px ${EMOJI_FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillStyle = '#000'; q.fillText(e, x + sw / 2, y + sd / 2); } });
  (L.shops || []).forEach(([k, x, y, sw = 6, sd = 5.5]) => { q.fillStyle = dark ? '#6c6a64' : '#f4ead8'; q.strokeStyle = dark ? '#a39b8c' : '#9a8a72'; q.lineWidth = 0.3; q.fillRect(x, y, sw, sd); q.strokeRect(x, y, sw, sd);
    const e = ((STORES[k] || PLACE_INFO[k]) || {}).e; if (e) { q.font = `${Math.min(sw, sd) * 0.6}px ${EMOJI_FONT}`; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillStyle = '#000'; q.fillText(e, x + sw / 2, y + sd / 2); } });
  return (TOWN_PLANS[key] = { cv, Wd, w, d });
}
// every town's street plan in its place on the map (map px); seen(x, y, margin): only those on screen
function drawTownPlans(g, alpha = 1, seen = () => true) {
  Object.keys(DREAM_AT).filter(id => COMMUNITIES[id]).forEach(id => {
    const [cx, cy] = dmXY(id); if (!seen(cx, cy, 60)) return;
    const P = townPlan(id), k = WMAP_CFG.townTile * DM_S, w = P.w * k, d = P.d * k;
    g.save(); g.globalAlpha = alpha; g.drawImage(P.cv, cx - w / 2, cy - d / 2, w, d); g.restore();
  });
}
function worldMapBuild() {
  const el = document.createElement('div'); el.className = 'wm-full'; el.hidden = true;
  el.innerHTML = `<canvas class="wm-cv"></canvas><div class="wm-top"><b>🌍 ${t('dm_title')}</b><button class="wm-x" data-wm="close">✕</button></div>
    <div class="wm-zoom"><button data-wm="in">＋</button><button data-wm="out">－</button><button data-wm="me">📍</button></div><div class="wm-hint">${t('wm_hint')}</div>`;
  document.querySelector('.screen').appendChild(el);
  BIGMAP.el = el; BIGMAP.cv = el.querySelector('.wm-cv'); BIGMAP.g = BIGMAP.cv.getContext('2d');
  el.addEventListener('click', e => { const b = e.target.closest('[data-wm]'); if (!b) return; const a = b.dataset.wm; Sound.play('tick');
    if (a === 'close') worldMapClose(); else if (a === 'in' || a === 'out') wmZoomAt(BIGMAP.W / 2, BIGMAP.H / 2, a === 'in' ? 1.7 : 1 / 1.7); else if (a === 'me') { const [x, y] = dmXY(whereNow()); BIGMAP.x = x; BIGMAP.y = y; BIGMAP.z = Math.max(BIGMAP.z, WMAP_CFG.plansAt * 1.4); wmDraw(); } });
  const cv = BIGMAP.cv, pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); BIGMAP.ptrs.set(e.pointerId, pos(e)); BIGMAP.tap = BIGMAP.ptrs.size === 1 ? { at: pos(e), t: performance.now() } : null; BIGMAP.pinch = null; });
  cv.addEventListener('pointermove', e => {
    if (!BIGMAP.ptrs.has(e.pointerId)) return;
    const p = pos(e), old = BIGMAP.ptrs.get(e.pointerId); BIGMAP.ptrs.set(e.pointerId, p);
    if (BIGMAP.tap && Math.hypot(p[0] - BIGMAP.tap.at[0], p[1] - BIGMAP.tap.at[1]) > 8) BIGMAP.tap = null;
    if (BIGMAP.ptrs.size === 1) { BIGMAP.x -= (p[0] - old[0]) / BIGMAP.z; BIGMAP.y -= (p[1] - old[1]) / BIGMAP.z; wmClamp(); wmDraw(); }
    else if (BIGMAP.ptrs.size === 2) { const [a, b] = [...BIGMAP.ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (BIGMAP.pinch) { BIGMAP.x -= (m[0] - BIGMAP.pinch.m[0]) / BIGMAP.z; BIGMAP.y -= (m[1] - BIGMAP.pinch.m[1]) / BIGMAP.z; wmZoomAt(m[0], m[1], d / BIGMAP.pinch.d); }
      BIGMAP.pinch = { d, m }; }
  });
  const up = e => { const tp = BIGMAP.tap; BIGMAP.ptrs.delete(e.pointerId); if (BIGMAP.ptrs.size < 2) BIGMAP.pinch = null; if (tp && performance.now() - tp.t < 500) wmTap(tp.at); BIGMAP.tap = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { BIGMAP.ptrs.delete(e.pointerId); BIGMAP.tap = null; BIGMAP.pinch = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); wmZoomAt(p[0], p[1], Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  new ResizeObserver(() => { if (!el.hidden) wmResize(); }).observe(el);
}
function wmResize() { const r = BIGMAP.el.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); BIGMAP.W = r.width; BIGMAP.H = r.height; BIGMAP.cv.width = r.width * dpr; BIGMAP.cv.height = r.height * dpr; wmClamp(); wmDraw(); }
function wmClamp() {   // (the view stays on the map: centred when the map is smaller than the screen)
  BIGMAP.z = Math.max(wmFit(), Math.min(WMAP_CFG.zMax, BIGMAP.z));
  const hw = BIGMAP.W / 2 / BIGMAP.z, hh = BIGMAP.H / 2 / BIGMAP.z;
  BIGMAP.x = DMW() <= hw * 2 ? DMW() / 2 : Math.max(hw, Math.min(DMW() - hw, BIGMAP.x));
  BIGMAP.y = DMH() <= hh * 2 ? DMH() / 2 : Math.max(hh, Math.min(DMH() - hh, BIGMAP.y));
}
function wmZoomAt(sx, sy, k) {
  const wx = BIGMAP.x + (sx - BIGMAP.W / 2) / BIGMAP.z, wy = BIGMAP.y + (sy - BIGMAP.H / 2) / BIGMAP.z;
  BIGMAP.z *= k; wmClamp(); BIGMAP.x = wx - (sx - BIGMAP.W / 2) / BIGMAP.z; BIGMAP.y = wy - (sy - BIGMAP.H / 2) / BIGMAP.z; wmClamp(); wmDraw();
}
const wmScreen = (x, y) => [BIGMAP.W / 2 + (x - BIGMAP.x) * BIGMAP.z, BIGMAP.H / 2 + (y - BIGMAP.y) * BIGMAP.z];
function wmTap([sx, sy]) {
  let best = null, bd = WMAP_CFG.tap;
  Object.keys(DREAM_AT).filter(id => COMMUNITIES[id]).forEach(id => { const [x, y] = wmScreen(...dmXY(id)), dd = Math.hypot(x - sx, y - sy); if (dd < bd) { bd = dd; best = id; } });
  if (!best) return;
  Sound.play('select'); UI.wsel = best; worldMapClose();
  setTimeout(() => { const c = document.querySelector('.world-card'); if (c) c.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
}
function wmDraw() { if (BIGMAP.raf) return; BIGMAP.raf = requestAnimationFrame(() => { BIGMAP.raf = 0; wmPaint(); }); }
function wmPaint() {
  const g = BIGMAP.g, W = BIGMAP.W, H = BIGMAP.H, z = BIGMAP.z, dpr = BIGMAP.cv.width / Math.max(1, W), dark = document.body.classList.contains('dark'), S0 = DM_S, s = Math.min(1, 1 / z);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = dark ? '#1a3550' : '#a3d6ef'; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2 - BIGMAP.x * z, H / 2 - BIGMAP.y * z); g.scale(z, z);
  drawDreamMapTo(g, true, s);
  const x0 = BIGMAP.x - W / 2 / z, x1 = BIGMAP.x + W / 2 / z, y0 = BIGMAP.y - H / 2 / z, y1 = BIGMAP.y + H / 2 / z, seen = (x, y, m) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;
  // the towns' own streets
  const fade = Math.max(0, Math.min(1, (z - WMAP_CFG.plansAt) / 0.8));
  if (fade > 0) drawTownPlans(g, fade, seen);
  // airports: a runway and a terminal; ports: a pier
  const fa = Math.max(0, Math.min(1, (z - WMAP_CFG.airAt) / 0.6));
  if (fa > 0) {
    DREAM_AIR.forEach(id => { const [ax, ay] = DREAM_AIR_AT[id].map(v => v * S0), L = WMAP_CFG.runway * S0, w2 = WMAP_CFG.runwayW * S0; if (!seen(ax, ay, L)) return;
      g.save(); g.globalAlpha = fa; g.translate(ax, ay); g.rotate(-0.35);
      g.fillStyle = '#8f949a'; g.fillRect(-L / 2 - w2 * 0.4, -w2 * 0.9, L + w2 * 0.8, w2 * 1.8); g.fillStyle = '#4b4f55'; g.fillRect(-L / 2, -w2 / 2, L, w2);
      g.strokeStyle = '#fff'; g.lineWidth = w2 * 0.08; g.setLineDash([w2 * 0.6, w2 * 0.5]); g.beginPath(); g.moveTo(-L / 2 + w2, 0); g.lineTo(L / 2 - w2, 0); g.stroke(); g.setLineDash([]);
      g.fillStyle = dark ? '#7d848b' : '#d8dde3'; g.fillRect(-L * 0.22, w2 * 1.1, L * 0.44, w2 * 1.3); g.fillStyle = '#9fc6e0'; g.fillRect(-L * 0.2, w2 * 1.15, L * 0.4, w2 * 0.35);
      g.restore(); });
    DREAM_PORT.forEach(id => { const [px, py] = DREAM_PORT_AT[id].map(v => v * S0), [cx, cy] = dmXY(id), a = Math.atan2(cy - py, cx - px), u = 3 * S0; if (!seen(px, py, 30)) return;
      g.save(); g.globalAlpha = fa; g.translate(px, py); g.rotate(a); g.fillStyle = '#b08a5e'; g.fillRect(-u, -u * 0.5, u * 5, u); g.fillRect(-u * 0.6, -u * 2, u * 0.7, u * 4);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-u * 1.6, -u * 1.6, u * 0.55, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e5484d'; g.beginPath(); g.arc(-u * 1.6, -u * 1.6, u * 0.3, 0, Math.PI * 2); g.fill(); g.restore(); });
  }
  g.restore();
  // on screen: the places' names (a town's at its top edge once its streets show), the airports and ports, you
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const here = whereNow(), sel = UI.wsel, k2 = WMAP_CFG.townTile * S0 * z;
  const pill = (txt, x, y, bg, fg, sz) => { g.font = `800 ${sz}px ${UI_FONT},${EMOJI_FONT}`; const tw = g.measureText(txt).width + sz; g.fillStyle = bg; g.beginPath(); g.roundRect(x - tw / 2, y - sz * 0.9, tw, sz * 1.8, sz * 0.9); g.fill(); g.fillStyle = fg; g.fillText(txt, x, y + 0.5); };
  if (fa > 0) { g.globalAlpha = fa;
    DREAM_AIR.forEach(id => { const [x, y] = wmScreen(...DREAM_AIR_AT[id].map(v => v * S0)); if (x > -60 && x < W + 60 && y > -30 && y < H + 30) pill(`✈️ ${t('wm_airport', { c: nm(COMMUNITIES[id]) })}`, x, y + Math.max(16, WMAP_CFG.runwayW * S0 * z * 2.6), 'rgba(47,95,168,.9)', '#fff', 11); });
    DREAM_PORT.forEach(id => { const [x, y] = wmScreen(...DREAM_PORT_AT[id].map(v => v * S0)); if (x > -60 && x < W + 60 && y > -30 && y < H + 30) pill(`⚓ ${t('wm_port', { c: nm(COMMUNITIES[id]) })}`, x, y + 18, 'rgba(31,122,70,.9)', '#fff', 11); });
    g.globalAlpha = 1; }
  Object.keys(DREAM_AT).filter(id => COMMUNITIES[id]).forEach(id => {
    const c = COMMUNITIES[id], [x, y0] = wmScreen(...dmXY(id)), y = fade > 0.5 ? y0 - (layoutOf(id).world.y1 - layoutOf(id).world.y0) * k2 / 2 - 6 : y0;
    if (x < -80 || x > W + 80 || y < -30 || y > H + 30) return;
    if (fade < 0.5) { g.fillStyle = id === sel ? '#ef7d3c' : isTeamCity(id) ? '#2f5fa8' : '#5d5448'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y0, id === sel ? 7 : 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
    pill(`${id === myTown() ? '🏡' : isTeamCity(id) ? '🏟️' : c.flag} ${nm(c)}`, x, y - (fade < 0.5 ? 16 : 0), id === sel ? '#ef7d3c' : 'rgba(255,253,248,.95)', id === sel ? '#fff' : '#3b3125', isTeamCity(id) ? 13 : 12);
    if (id === here) pill(`📍 ${t('you_here')}`, x, y - (fade < 0.5 ? 40 : 24), '#e5484d', '#fff', 11);
  });
}
function worldMapOpen() {
  if (!BIGMAP.el) worldMapBuild();
  BIGMAP.el.hidden = false; Scene.setVisible(false);
  const [x, y] = dmXY(COMMUNITIES[UI.wsel] ? UI.wsel : whereNow());
  BIGMAP.x = x; BIGMAP.y = y; BIGMAP.ptrs.clear(); wmResize(); BIGMAP.z = wmFit() * 1.6; wmClamp(); wmDraw();
}
function worldMapClose() { if (BIGMAP.el) BIGMAP.el.hidden = true; syncView(); refresh(); }
// who lives in your town (they all have to say yes to a move): your friends whose homes are here
const townMembers = () => S.friends.filter(f => townOf(f.id) === myTown());
// this place's teams, today's home games and where (stadium / arena)
function cityTeamsHtml(id) {
  if (!isTeamCity(id)) return `<p class="muted small">🏘️ ${t('city_no_team')} · ${t('city_nearest', { c: nm(COMMUNITIES[homeCity(id)]) })}</p>`;
  const L = STADIUM_LOOK[id], games = SPORT_KEYS.flatMap(sp => todayGames(sp).filter(G => G.h === arTeamIn(sp, id)));
  return `<div class="city-stadium"><b>🏟️ ${nm(L)}</b> <span class="muted small">${nm(L.tag)}</span><br><b>🏒 ${t('arena_name', { c: nm(COMMUNITIES[id]) })}</b></div>
    <div class="city-teams">${SPORT_KEYS.map(sp => { const i = arTeamIn(sp, id); return i < 0 ? '' : `<span class="city-team">${teamLogo(sp, i)}<small>${LEAGUES[sp].e} ${esc(LEAGUES[sp].teams[i][curLang() === 'zh' ? 'zh' : 'en'])}</small></span>`; }).join('')}</div>
    <div class="muted small gap-top">${t('city_today')}</div>${games.length ? games.map(G => `<div class="small">${fmtHM(G.start)} ${LEAGUES[G.sp].e} ${esc(teamName(G.sp, G.a))} @ ${esc(teamName(G.sp, G.h))} · ${AR_INDOOR.includes(G.sp) ? '🏒 ' + t('venue_arena') : '🏟️ ' + t('venue_stadium')}${G.state === 'live' ? ' · 🔴' : G.state === 'done' ? ` · ${G.res.hs}–${G.res.as}` : ''}</div>`).join('') : `<div class="small muted">${t('city_no_games')}</div>`}`;
}
// the whole-town move: everyone's answer so far
function townMoveHtml() {
  const M = S.townMove;
  if (!M) return '';
  const row = id => { const v = M.votes[id], f = friendById(id); return `<div class="row small">${f ? avatar(f.look, 'sm') : ''}<span class="grow">${esc(f ? f.name : id)}</span><b>${!v || v.yes === undefined ? '⏳' : v.yes ? '✅' : '❌'}</b></div>`; };
  const head = M.done === 'no' ? `❌ ${t('tm_failed', { names: Object.keys(M.votes).filter(id => M.votes[id].yes === false).map(id => (friendById(id) || {}).name || id).join('、') })}` : `🗳️ ${t('tm_asking', { c: nm(COMMUNITIES[M.to]) })}`;
  return `<div class="card town-move"><b>${head}</b>${Object.keys(M.votes).map(row).join('')}${M.done ? `<button class="btn block gap-top" data-act="townMoveClear">${t('tm_ok')}</button>` : `<button class="btn ghost block gap-top" data-act="townMoveClear">${t('tm_cancel')}</button>`}</div>`;
}
function panelWorld() {
  const mine = myTown(), sel = COMMUNITIES[UI.wsel] ? UI.wsel : mine, cm = COMMUNITIES[sel], here = sel === mine;
  const pins = Object.keys(DREAM_AT).filter(id => COMMUNITIES[id]).map(id => {
    const [x, y] = dmXY(id), city = isTeamCity(id), c = COMMUNITIES[id];
    return `<button class="wpin ${id === sel ? 'on' : ''} ${id === mine ? 'home' : ''} ${city ? 'city' : 'town'}" style="left:${x}px;top:${y}px" data-act="worldPick" data-arg="${id}">
      <span class="wpin-dot"><i>${id === mine ? '🏡' : city ? '🏟️' : THEME_E[c.theme]}</i></span><span class="wpin-name">${nm(c)}</span></button>`;
  }).join('');
  const W = DREAM_MAP.w * DM_S, H = DREAM_MAP.h * DM_S, M = S.townMove;
  const card = `<div class="card world-card"><div class="row">${thumbImg('commune', sel, {}, 96, 84, 'thumb sm')}
      <div class="grow"><div class="world-name">${cm.flag} ${nm(cm)} ${here ? `<span class="tag ok">${t('world_here')}</span>` : ''} ${isTeamCity(sel) ? `<span class="tag">${t('dm_city')}</span>` : `<span class="tag">${t('dm_town')}</span>`}</div>
        <div class="muted">${t('dmr_' + cm.region)} · ${THEME_E[cm.theme]} ${t('theme_' + cm.theme)} · ${isNightIn(sel) ? '🌙' : '☀️'} ${t('local_time', { t: localClock(sel) })}</div>
        <div class="world-stats">${DREAM_AIR.includes(sel) ? `<span>✈️ ${t('dm_airport')}</span>` : ''}${DREAM_PORT.includes(sel) ? `<span>⚓ ${t('dm_port')}</span>` : ''}${DREAM_RAIL.some(r => r.includes(sel)) ? `<span>🚆 ${t('dm_rail')}</span>` : ''}<span>🛣️ ${DREAM_ROADS.filter(r => r[0] === sel || r[1] === sel).map(r => (r[4] === 'bridge' ? '🌉' : 'I-') + r[2]).join(' ')}</span></div></div></div>
    ${cityTeamsHtml(sel)}
    ${sel === whereNow() && FURN['tv_' + sel] ? (() => { const d = FURN['tv_' + sel], own = ownsFurn('tv_' + sel); return `<div class="row gap-top souv-here"><span class="big-emoji">${d.e}</span><span class="grow small"><b>${t('dm_souv')}</b> · ${nm(d)}<br><span class="muted">${t('dm_souv_note')}</span></span>${own ? '<span class="tag ok">✅</span>' : `<button class="btn small primary" data-act="buyTravelSouv" data-arg="${sel}" ${S.me.coins >= d.price ? '' : 'disabled'}>🪙${d.price}</button>`}</div>`; })() : ''}
    ${driveRow(sel)}
    <div class="row gap-top">${here ? `<button class="btn primary grow" data-act="worldVisit" data-arg="${sel}">🏘️ ${t('world_my_town')}</button>`
      : `<button class="btn grow" data-act="worldVisit" data-arg="${sel}">👀 ${t('world_visit')}</button><button class="btn primary grow" data-act="townMoveAsk" data-arg="${sel}" ${M && !M.done ? 'disabled' : ''}>🚚 ${t('tm_btn')}</button>`}</div>
    ${here ? '' : `<p class="muted small">${t('tm_note', { n: townMembers().length })}</p>`}</div>`;
  const list = (ids, title) => `<div class="card"><h3>${title}</h3>${ids.map(id => { const c = COMMUNITIES[id];
    return `<button class="list-item world-row ${id === sel ? 'on' : ''}" data-act="worldPick" data-arg="${id}"><span class="big-emoji">${c.flag}</span><div class="grow"><b>${nm(c)}</b> ${id === mine ? '🏡' : ''}<div class="muted">${t('dmr_' + c.region)} · ${isNightIn(id) ? '🌙' : '☀️'} ${localClock(id)}${isTeamCity(id) ? ' · ' + SPORT_KEYS.map(sp => LEAGUES[sp].teams[arTeamIn(sp, id)].e).join('') : ''}</div></div></button>`; }).join('')}</div>`;
  return `<div class="world-head"><h1 class="panel-title">🌍 ${t('dm_title')}</h1><button class="btn small" data-act="passport">📕 ${t('pass_btn', { n: stampCount(), total: Object.keys(COMMUNITIES).length })}</button></div>
    <p class="muted note">${t('dm_sub')}</p>
    <div class="dm-legend">🏟️ ${t('dm_city')} · 🏘️ ${t('dm_town')} · <i class="lg-road"></i> ${t('dm_road')} · <i class="lg-rail"></i> ${t('dm_rail')} · ✈️ ${t('dm_airport')} · ⚓ ${t('dm_port')}</div>
    <button class="wmap-thumb" data-act="worldMapOpen"><canvas id="worldCanvas"></canvas><span class="wm-open">🔍 ${t('wm_open')}</span></button>
    ${townMoveHtml()}${awayHomeCard()}${card}${countyCard(sel)}
    ${list(TEAM_CITIES.filter(id => COMMUNITIES[id]), '🏟️ ' + t('dm_cities'))}${list(Object.keys(COMMUNITIES).filter(id => !isTeamCity(id)), '🏘️ ' + t('dm_towns'))}
    <p class="muted center">${t('dm_note')}</p>`;
}
// v0.68 (Mason #33: "in another city I didn't know how to get back, couldn't find myself"): where you are, where
// home is, and every way back from here (drive if your car's here, the train, the plane, the ship), with a button each
function awayHomeCard() {
  const here = whereNow(), home = myTown();
  if (here === home) return '';
  const D = Drive.plan(here, home), T = Drive.plan(here, home, 'train'), A = Drive.plan(here, home, 'air'), Sh = Drive.plan(here, home, 'sea'), car = carWithYou() && D;
  const row = (e, txt, act, arg, label) => `<div class="row gap-top"><span class="grow small">${e} ${txt}</span><button class="btn small primary" data-act="${act}" data-arg="${arg}">${label}</button></div>`;
  return `<div class="card away-home"><b>🧳 ${t('ah_title', { c: nm(COMMUNITIES[here]), h: nm(COMMUNITIES[home]) })}</b>
    ${car ? row('🚗', t('dr_info_short', { km: D.km, n: D.cost }), 'driveTo', home + '|', t('dr_go_home')) : D ? `<p class="muted small">🚗 ${t('ah_no_car', { c: nm(COMMUNITIES[(S.carAt && S.carAt.town) || home]) })}</p>` : ''}
    ${T ? row('🚆', t('tr_info', { km: T.km, n: T.cost, m: T.mins }), 'goStation', '', t('tr_go_station')) : ''}
    ${A ? row('✈️', t('fl_info', { km: A.km, n: A.cost, m: A.mins }), 'goHub', 'airport', t('hub_go_air')) : ''}
    ${Sh ? row('⛴️', t('sh_info', { km: Sh.km, n: Sh.cost, m: Sh.mins }), 'goHub', 'port', t('hub_go_sea')) : ''}
    <button class="btn block gap-top" data-act="findMe">📍 ${t('ah_see_me')}</button></div>`;
}
// v0.60 (Mason #30): driving to another place: where you are now (another city, or home), the way there, gas and tolls
const whereNow = () => (S.trav && COMMUNITIES[S.trav.town] ? S.trav.town : myTown());
function driveRow(id) {
  const from = whereNow();
  if (id === from) return S.trav ? `<p class="muted small gap-top">📍 ${t('dr_you_here')}</p>` : '';
  const P = Drive.plan(from, id), car = S.me.cars[S.me.car], two = car && CARS[car.k].kind === 'two', carTown = S.carAt && S.carAt.town ? S.carAt.town : myTown();
  if (!P) return '';
  const can = car && !two && S.me.coins >= P.cost && carTown === from, why = !car ? t('dr_no_car') : two ? t('dr_two') : carTown !== from ? t('dr_car_in', { c: nm(COMMUNITIES[carTown]) }) : S.me.coins < P.cost ? t('snack_poor') : '';
  const TP = Drive.plan(from, id, 'train');   // v0.61: the train, from the station
  const train = TP ? `<div class="row gap-top"><span class="grow small">🚆 ${t('tr_info', { km: TP.km, n: TP.cost, m: TP.mins })}</span><button class="btn small" data-act="goStation">${t('tr_go_station')}</button></div>` : `<p class="muted small">🚆 ${t(Drive.onRail(from) ? 'tr_no_there' : 'tr_no_here')}</p>`;
  const btn = (place, label) => `<button class="btn ${place ? '' : 'primary'} grow" data-act="driveTo" data-arg="${id}|${place || ''}" ${can ? '' : 'disabled'}>${label}</button>`;
  const games = isTeamCity(id) && id !== myTown() ? SPORT_KEYS.flatMap(sp => todayGames(sp).filter(G => G.h === arTeamIn(sp, id) && G.state !== 'done')) : [];
  return `<div class="card drive-card"><b>🚗 ${id === myTown() ? t('dr_home_title') : t('dr_title', { c: nm(COMMUNITIES[id]) })}</b>
    <div class="muted small">${t('dr_info', { km: P.km, via: P.legs.map(L => (L.e[4] === 'bridge' ? '🌉' : 'I-') + L.e[2]).join(' → '), m: Math.ceil(P.len * DRIVE.tilesPerUnit / DRIVE.speed / 60), n: P.cost })}</div>
    <div class="row gap-top">${btn('', id === myTown() ? `🏡 ${t('dr_go_home')}` : `🚗 ${t('dr_go')}`)}${games.length ? btn(AR_INDOOR.includes(games[0].sp) ? 'arena' : 'stadium', `${LEAGUES[games[0].sp].e} ${t('dr_go_game', { h: fmtHM(games[0].start) })}`) : ''}</div>
    ${why ? `<p class="muted small">${why}</p>` : ''}${train}${flySailHtml(id)}</div>`;
}
// v0.63 (Mason #30): the plane and the ship from where you are to there; where the nearest airport / port is if
// there isn't one. A free ticket (🎟️, from real life) pays a whole fare.
const nearestOf = (list, id) => list.slice().sort((a, b) => Math.hypot(DREAM_AT[a][0] - DREAM_AT[id][0], DREAM_AT[a][1] - DREAM_AT[id][1]) - Math.hypot(DREAM_AT[b][0] - DREAM_AT[id][0], DREAM_AT[b][1] - DREAM_AT[id][1]))[0];
const carWithYou = () => S.me.cars.length > 0 && (S.carAt && S.carAt.town ? S.carAt.town : myTown()) === whereNow();
function flySailHtml(id) {
  const from = whereNow(), tix = ticketsLeft();
  const row = (mode, e) => {
    const air = mode === 'air', list = air ? DREAM_AIR : DREAM_PORT, act = air ? 'flyGo' : 'sailGo';
    if (!list.includes(id)) return `<p class="muted small">${e} ${t(air ? 'fl_no_there' : 'sh_no_there', { c: nm(COMMUNITIES[id]), a: nm(COMMUNITIES[nearestOf(list, id)]) })}</p>`;
    if (!list.includes(from)) return `<p class="muted small">${e} ${t(air ? 'fl_no_here' : 'sh_no_here', { c: nm(COMMUNITIES[nearestOf(list, from)]) })}</p>`;
    const P = Drive.plan(from, id, mode); if (!P) return '';
    const car = !air && carWithYou(), cost = P.cost + (car ? TRAVEL.shipCar : 0), hub = air ? 'airport' : 'port';
    const atHub = !hubIn(from, hub) || (Scene.here() === hub && VIEW_TOWN === from);   // v0.67: tickets are sold at the airport / the port
    return `<div class="row gap-top"><span class="grow small">${e} ${t(air ? 'fl_info' : 'sh_info', { km: P.km, n: cost, m: P.mins })}${car ? `<br><span class="muted">🚗 ${t('sh_car', { n: TRAVEL.shipCar })}</span>` : ''}</span>
      ${!atHub ? `<button class="btn small" data-act="goHub" data-arg="${hub}">${t(air ? 'hub_go_air' : 'hub_go_sea')}</button>`
        : `${tix ? `<button class="btn small" data-act="${act}" data-arg="${id}|tix">🎟️ ${t('tix_use')}</button>` : ''}<button class="btn small primary" data-act="${act}" data-arg="${id}|" ${S.me.coins >= cost ? '' : 'disabled'}>${e} 🪙${cost}</button>`}</div>`;
  };
  return row('air', '✈️') + row('sea', '⛴️');
}
// v0.67: does this town have the building (some have no room for one: then the city card sells the tickets)
const hubIn = (town, hub) => (layoutOf(town).stores || []).some(st => st[0] === hub);
// the departures board at the airport / the port: everywhere you can go from here
function hubBoard(hub) {
  const air = hub === 'airport', from = whereNow(), list = (air ? DREAM_AIR : DREAM_PORT).filter(id => id !== from && COMMUNITIES[id]).sort((a, b) => (b === myTown()) - (a === myTown())), tix = ticketsLeft(), e = air ? '✈️' : '⛴️', act = air ? 'flyGo' : 'sailGo';
  const car = !air && carWithYou();
  return `<p>${t(air ? 'hub_desc_air' : 'hub_desc_sea')}</p>${car ? `<p class="muted small">🚗 ${t('sh_car', { n: TRAVEL.shipCar })}</p>` : ''}<p class="muted small">🎟️ ${t('pass_tix', { n: tix })}</p>
    <div class="card">${list.map(id => { const P = Drive.plan(from, id, air ? 'air' : 'sea'); if (!P) return ''; const cost = P.cost + (car ? TRAVEL.shipCar : 0), c = COMMUNITIES[id];
      return `<div class="list-item ${id === myTown() ? 'home-row' : ''}"><span class="big-emoji">${id === myTown() ? '🏡' : c.flag}</span><div class="grow"><b>${nm(c)}</b> ${id === myTown() ? `<span class="tag ok">${t('ah_home_tag')}</span>` : isTeamCity(id) ? '🏟️' : ''}<div class="muted small">${P.km} km · ${t('tr_mins', { m: P.mins })} · ${isNightIn(id) ? '🌙' : '☀️'} ${localClock(id)}${(passport().st || {})[id] ? ' · 📕' : ''}</div></div>
        ${tix ? `<button class="btn small" data-act="${act}" data-arg="${id}|tix">🎟️</button>` : ''}<button class="btn small primary" data-act="${act}" data-arg="${id}|" ${S.me.coins >= cost ? '' : 'disabled'}>${e} 🪙${cost}</button></div>`; }).join('')}</div>`;
}
function travelGo(mode, arg) {
  const [id, how] = String(arg).split('|'), from = whereNow(), P = Drive.plan(from, id, mode);
  if (!P) return;
  if (S.work || jailed()) return snack(t('dr_busy'));
  const hub = mode === 'air' ? 'airport' : 'port';
  if (hubIn(from, hub) && !(Scene.here() === hub && VIEW_TOWN === from)) { Sound.play('oops'); return snack(t(mode === 'air' ? 'hub_first_air' : 'hub_first_sea')); }   // v0.67: from the airport / the port
  const car = mode === 'sea' && carWithYou(), cost = P.cost + (car ? TRAVEL.shipCar : 0), e = mode === 'air' ? '✈️' : '⛴️';
  if (how === 'tix') { if (ticketsLeft() < 1) return; passport().tix++; snack(`🎟️ ${t('tix_used')}`); }
  else { if (S.me.coins < cost) { Sound.play('oops'); return snack(t('snack_poor')); } S.me.coins -= cost; snack(`${e} ${t('go_fare', { n: cost })}`); }
  closeSheet(); save(); Sound.play('select');
  Drive.open({ from, to: id, mode, car }, o => travelArrived(o));
}
// off the plane / the ship: in that place's main square (the ship brought your car along if it was with you)
function travelArrived(o) {
  const to = o.to, L = layoutOf(to), hub = o.mode === 'air' ? 'airport' : 'port', st = (L.stores || []).find(x => x[0] === hub), pk = (L.parks || [])[0];
  const pt = st ? storeGeo(st).bay : pk ? [pk[1] + pk[3] / 2, pk[2] + pk[4] / 2] : L.places[0];   // v0.67: out of that town's airport / port
  if (o.car) S.carAt = { town: to, pt, dir: st ? storeGeo(st).dir : '+y', id: null, place: st ? hub : null };
  if (to === myTown()) { S.trav = null; S.away = null; UI.tab = 'town'; UI.wtown = null; }
  else { S.trav = { town: to, at: now(), by: o.mode }; S.away = { town: to, until: now() + SPECIAL.visitH * HOUR }; UI.tab = 'world'; UI.wtown = to; }
  UI.visit = null; UI.visitInside = false; setLevel(0); syncView();
  Scene.arriveAt(pt, st ? hub : null); Scene.showMe(); save(); refresh();
  stampNews(stampAt(to));
}
// a new stamp in the passport (and a keepsake at 4 / 8 / 12 / 16)
function stampNews(r) {
  if (!r) return;
  save();
  setTimeout(() => { Sound.play('fanfare'); snack(`📕 ${t('pass_new_stamp', { c: nm(COMMUNITIES[r.id]), n: r.n, total: Object.keys(COMMUNITIES).length })}`);
    if (r.award) setTimeout(() => snack(`🎁 ${t('pass_award', { n: r.n, name: nm(FURN[r.award]) })}`), 2800); }, 900);
}
// the passport: stamps, sea life, free tickets, each place's keepsake
function passportHtml() {
  const P = passport(), ids = Object.keys(COMMUNITIES), here = whereNow(), n = stampCount();
  const stamps = ids.map(id => { const c = COMMUNITIES[id], got = P.st[id];
    return `<div class="pstamp ${got ? 'got' : ''}" style="--c:${(DREAM_REGIONS.find(r => r.k === c.region) || {}).c || '#888'}"><span>${got ? c.flag : '❔'}</span><b>${nm(c)}</b><i>${got ? fmtDate(got) : ''}</i></div>`; }).join('');
  const sea = SEA_LIFE.map(L => `<div class="pstamp sea ${P.sea[L.k] ? 'got' : ''}"><span>${P.sea[L.k] ? L.e : '❔'}</span><b>${nm(L)}</b><i>${P.sea[L.k] ? '×' + P.sea[L.k] : ''}</i></div>`).join('');
  const souv = ids.map(id => { const k = 'tv_' + id, d = FURN[k], own = ownsFurn(k);
    return `<div class="list-item"><span class="big-emoji">${d.e}</span><div class="grow"><b>${nm(d)}</b><div class="muted small">${COMMUNITIES[id].flag} ${nm(COMMUNITIES[id])}</div></div>${own ? `<span class="tag ok">✅</span>` : here === id ? `<button class="btn small primary" data-act="buyTravelSouv" data-arg="${id}" ${S.me.coins >= d.price ? '' : 'disabled'}>🪙${d.price}</button>` : `<span class="muted small">${t('pass_buy_there')}</span>`}</div>`; }).join('');
  const aw = TRAVEL.awards.map(([k, key]) => `<span class="pass-aw ${n >= k ? 'got' : ''}">${FURN[key].e} ${k}</span>`).join('');
  return `<h2>📕 ${t('pass_title')}</h2><p class="muted small">${t('pass_how')}</p>
    <div class="card"><div class="row between"><b>🎟️ ${t('pass_tix', { n: ticketsLeft() })}</b></div><div class="muted small">${t('pass_tix_note', { n: TRAVEL.ticketEvery })}</div></div>
    <h3>${t('pass_stamps')} ${n}/${ids.length}</h3><div class="pass-aws">${aw}</div><div class="stamp-grid">${stamps}</div>
    <h3>${t('pass_sea')} ${SEA_LIFE.filter(L => P.sea[L.k]).length}/${SEA_LIFE.length}</h3><p class="muted small">${t('pass_sea_note')}</p><div class="stamp-grid">${sea}</div>
    <h3>${t('pass_souv')}</h3><p class="muted small">${t('pass_souv_note')}</p><div class="card">${souv}</div>
    <button class="btn block gap-top" data-act="close">${t('souv_ok')}</button>`;
}
SHEETS.passport = () => passportHtml();
// v0.62 (Mason #30): commuting. How far a place is by road from home; the ways you can get to your job from where
// you are (saved with the job: one tap every day); after work, the way home.
// the hour before your shift and during it, when you're not at work yet: a button to go (the daily commute)
function commuteSoon() { if (!S.job || S.work) return false; const jt = S.job.town || myTown(), h = localHour(jt), J = JOBS[S.job.place]; return h >= J.from - 1 && h < J.to - 1 && !(Scene.here() === S.job.place && whereNow() === jt); }
const commuteKm = t2 => (t2 === myTown() ? 0 : ((Drive.plan(myTown(), t2) || {}).km || 9999));
function commuteWays() {
  const jt = (S.job && S.job.town) || myTown(), here = whereNow(), carTown = S.carAt && S.carAt.town ? S.carAt.town : myTown(), out = [];
  if (here === jt) { const TR = Scene.transit(); out.push('walk'); if (TR.bus > 1) out.push('bus'); if (TR.metro > 1) out.push('metro'); if (S.me.cars.length && carTown === here) out.push('car'); }
  else { if (S.me.cars.length && carTown === here) out.push('car'); if (Drive.plan(here, jt, 'train')) out.push('train'); }
  return out;
}
const WAY_E = { walk: '🚶', bus: '🚌', metro: '🚇', car: '🚗', train: '🚆' };
function commuteHtml(key) {
  const jt = (S.job && S.job.town) || myTown(), ways = commuteWays(), how = ways.includes(S.job.how) ? S.job.how : ways[0], there = Scene.here() === key && whereNow() === jt;
  const home = whereNow() !== myTown() && whereNow() === jt;
  return `<div class="commute"><div class="muted small gap-top">${t('job_commute_how')}${jt !== myTown() ? ` · ${nm(COMMUNITIES[jt])} ${commuteKm(jt)} km` : ''}</div>
    <div class="chips-row">${ways.map(k => `<button class="chip ${k === how ? 'on' : ''}" data-act="commuteHow" data-arg="${k}">${WAY_E[k]} ${t('way_' + k)}</button>`).join('') || `<span class="muted small">${t('job_no_way')}</span>`}</div>
    ${!there && how ? `<button class="btn primary block gap-top" data-act="commuteGo">${WAY_E[how]} ${t('job_commute')}</button>` : ''}
    ${home && !S.work ? `<button class="btn block gap-top" data-act="commuteHome">🏡 ${t('job_go_home')}</button>` : ''}</div>`;
}
// v0.61: off the train: you're in that city's station (your car stays where you left it); a few hours to buy its
// specialties too (v0.40). Home: in your own station.
function trainArrived(o) {
  const to = o.to, L = layoutOf(to), st = (L.stores || []).find(x => x[0] === 'station'), pt = st ? storeGeo(st).bay : L.places[0];
  if (to === myTown()) { S.trav = null; S.away = null; UI.tab = 'town'; UI.wtown = null; }
  else { S.trav = { town: to, at: now(), by: 'train' }; S.away = { town: to, until: now() + SPECIAL.visitH * HOUR }; UI.tab = 'world'; UI.wtown = to; }
  UI.visit = null; UI.visitInside = false; setLevel(0); syncView();
  Scene.arriveAt(pt, o.place ? null : 'station'); save(); refresh();
  setTimeout(() => { if (o.place) openSheet('go', { place: o.place }); else ACT.enterVenue('station'); snack(`🚆 ${t('tr_arrived', { c: nm(COMMUNITIES[to]) })}`); refresh(); }, 300);   // (v0.62: going to work: on from the station)
  stampNews(stampAt(to));   // v0.63
}
// you've driven there: parked at the stadium / arena (or the main car park) and on foot; home: back in your own drive
function driveArrived(o) {
  const to = o.to;
  if (to === myTown()) { S.trav = null; S.carAt = null; S.out = null; UI.wtown = null; UI.visit = null; save(); setTab('home'); Scene.recenter(); return; }
  stampNews(stampAt(to));   // v0.63
  const L = layoutOf(to), st = o.place && (L.stores || []).find(x => x[0] === o.place), G = st ? storeGeo(st) : null;
  const pk = (L.parks || [])[0], bay = G ? G.bay : pk ? [pk[1] + pk[3] / 2, pk[2] + pk[4] / 2] : L.places[0];
  S.trav = { town: to, at: now() };
  S.carAt = { town: to, pt: bay, dir: G ? G.dir : '+y', id: null, place: o.place || null };
  UI.tab = 'world'; UI.wtown = to; UI.visit = null; UI.visitInside = false; setLevel(0); syncView();
  Scene.arriveAt(bay, o.place || null); save(); refresh();
  if (o.place) setTimeout(() => { if (VENUE_PLACES.includes(o.place) && (L.stores || []).some(x => x[0] === o.place)) ACT.enterVenue(o.place); else openSheet('place', o.place); refresh(); }, 300);   // (v0.62: or your job's place)
}
// v0.59: the whole town moves (you and every friend who lives here) once everyone has said yes
function townMoveTick() {
  const M = S.townMove;
  if (!M || M.done) return;
  let changed = false;
  Object.entries(M.votes).forEach(([id, v]) => { if (v.yes === undefined && now() >= v.at) { const rel = Math.max(0, Math.min(100, relOf(id))) / 100; v.yes = Math.random() < TOWN_MOVE.yes[0] + (TOWN_MOVE.yes[1] - TOWN_MOVE.yes[0]) * rel; changed = true; } });
  if (!changed) return;
  const vs = Object.values(M.votes);
  if (vs.some(v => v.yes === false)) { M.done = 'no'; Sound.play('aww'); snack(`❌ ${t('tm_failed_snack')}`); }
  else if (vs.every(v => v.yes)) { moveWholeTown(M.to); M.done = 'ok'; Sound.play('fanfare'); snack(`🚚 ${t('tm_moved', { c: nm(COMMUNITIES[M.to]) })}`); S.townMove = null; UI.visit = null; UI.wtown = null; Scene.moveHome(); syncView(); Scene.recenter(); }
  save(); if (UI.tab === 'world') refresh();
}
function moveWholeTown(to) {   // everyone side by side on one street if there's room, else as near together as fits
  const ids = ['me', ...townMembers().map(f => f.id)], lots = ids.map(id => lotOf(id)).filter(Boolean);
  lots.forEach(l => { l.was = { st: l.st, p: l.p, n: l.n, town: l.town }; l.town = '__moving'; });
  const want = l => Math.max(CORE_PARCELS, l.was.n), total = lots.reduce((n, l) => n + want(l), 0);
  const one = computeRuns(to).filter(r => r.n >= total).sort((a, b) => a.n - b.n)[0];
  let p = one ? one.p : 0;
  lots.forEach(l => {
    let r = one ? { st: one.st, p, n: want(l) } : null;
    if (r) p += want(l);
    else { const prev = lots.find(q => q !== l && q.town === to), runs = computeRuns(to).filter(q => q.n >= CORE_PARCELS); r = runs.sort((x, y) => (prev ? (y.st === prev.st) - (x.st === prev.st) : 0) || (y.n >= want(l)) - (x.n >= want(l)) || x.n - y.n)[0]; }
    if (!r) { Object.assign(l, l.was); if (!l.was.town) delete l.town; delete l.was; return; }
    Object.assign(l, { st: r.st, p: r.p, n: Math.min(r.n, want(l)) });
    if (l.id === 'me' && l.n < l.was.n) S.me.coins += round50(LAND.parcel * (l.was.n - l.n));   // land you couldn't take with you: paid back
    if (to === HOME_TOWN) delete l.town; else l.town = to;
    delete l.was;
  });
  ids.forEach(id => { const h = homeOf(id); if (h) fixLayout(h); });
  RUNS = {};
}
// Where a trip goes: a home's gate or a public place (its name for the card and the context bar).
function goTarget(a) {
  if (a.spot) return { e: '📍', name: t('go_here'), short: t('go_here_short'), pt: a.spot };
  if (a.place) { const P = placeInfo(a.place); return { e: P.e, name: nm(P), short: nm(P), pt: Scene.placePoint(a.place), place: a.place }; }
  if (a.id === 'me') return { e: '🏡', name: t('go_home'), short: t('go_home_short'), pt: Scene.gate('me'), dest: 'me' };
  const h = homeOf(a.id);
  return { e: '🏡', name: t('home_of', { name: homeName(h) }), short: t('home_of', { name: homeName(h) }), pt: Scene.gate(a.id), dest: a.id };
}
// Walk / drive (or ride) / straight there, with how long each takes.
function goTiles(T) {
  // v0.22: leaving home with more than one car: choose which one (you walk to it in the drive / the garage first)
  const home = !(S.out && S.out.town === myTown()) && !S.carAt && !S.work, pick = home && S.me.cars.length > 1 ? (UI.tripCar ?? S.me.car) : null;
  const car = S.me.cars[pick ?? S.me.car], two = car && CARS[car.k].kind === 'two';
  const chooser = pick !== null ? `<div class="sec-title">${t('go_which_car')}</div><div class="car-pick">${S.me.cars.map((c, i) => `<button class="car-chip ${i === pick ? 'on' : ''}" data-act="pickCar" data-arg="${i}">${thumbImg('car', c.k, { color: c.color }, 96, 64, 'thumb xs')}<span>${nm(CARS[c.k])}</span></button>`).join('')}</div>` : '';
  const tile = (how, ic, label, sub, on = true) => `<button class="act-tile" data-act="travel" data-arg="${how}" ${on ? '' : 'disabled'}><span>${ic}</span><b>${label}</b><i>${sub}</i></button>`;
  const secs = how => t('go_secs', { n: Scene.tripTime(T.pt, how, T.dest, T.place, pick ?? undefined) });
  const TR = Scene.transit(), rush = rushNow();   // v0.61: buses everywhere, the subway in the team cities
  return `${chooser}${rush ? `<p class="muted small">🚦 ${t('go_rush')}</p>` : ''}<div class="act-grid three">
    ${tile('walk', '🚶', t('go_walk'), secs('walk'))}
    ${TR.bus > 1 ? tile('bus', '🚌', t('go_bus', { n: TRANSIT.bus }), secs('bus'), S.me.coins >= TRANSIT.bus) : ''}
    ${TR.metro > 1 ? tile('metro', '🚇', t('go_metro', { n: TRANSIT.metro }), secs('metro'), S.me.coins >= TRANSIT.metro) : ''}
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
  const mine = S.job && S.job.place === key && (S.job.town || myTown()) === VIEW_TOWN, w = S.work && S.work.place === key && (S.work.town || myTown()) === VIEW_TOWN, rank = mine ? jobRank() : 0, R = JOB_RANKS[rank], next = JOB_RANKS[rank + 1];
  const head = `<div class="row between"><b>💼 ${nm(J)}${mine ? ` · ${nm(R)}` : ''}</b><span class="muted">🪙${jobWage(key)}/${t('job_hour')} · ${J.from}:00–${J.to}:00</span></div>${countyOf(myTown()).wage !== 1 ? `<p class="muted small">${t('wage_county', { county: nm(countyOf(myTown())), k: countyOf(myTown()).wage })}</p>` : ''}`;
  let body;
  if (w) {
    const pct = Math.round(Math.min(1, (now() - S.work.start) / (S.work.end - S.work.start)) * 100), sofar = Math.round(hoursWorked(S.work) * S.work.wage);
    body = `<p>${t('job_working', { m: fmtDur(S.work.end - now()), n: sofar, full: Math.round((S.work.end - S.work.start) / HOUR * S.work.wage) })}</p><div class="bar"><i style="width:${pct}%"></i></div>
      <button class="btn block gap-top" data-act="jobQuit">🚪 ${t('job_quit', { n: sofar })}</button>`;
  } else if (!mine && commuteKm(VIEW_TOWN) > COMMUTE.maxKm) body = `<p class="muted">🚗 ${t('job_too_far', { km: commuteKm(VIEW_TOWN), max: COMMUTE.maxKm })}</p>`;   // v0.62: nobody flies to work
  else if (!mine && VIEW_TOWN !== myTown() && !(S.trav && S.trav.town === VIEW_TOWN)) body = `<p class="muted">${t('job_go_there')}</p>`;
  else if (!mine) body = `<p class="muted">${t(S.job ? 'job_switch_note' : 'job_apply_note')}${VIEW_TOWN !== myTown() ? ' ' + t('job_commute_note', { km: commuteKm(VIEW_TOWN) }) : ''}</p><button class="btn primary block" data-act="jobApply" data-arg="${key}">✍️ ${t('job_apply')}</button>`;
  else if (inShift(key) && Scene.here() === key) body = `<button class="btn primary block" data-act="jobStart" data-arg="${key}">💼 ${t('job_start', { to: J.to, n: Math.round((shiftEnd(key) - now()) / HOUR * jobWage(key)) })}</button>`;
  else body = `<p class="muted">${t('job_closed', { from: J.from, to: J.to })}</p>`;
  const rel = mine ? `<div class="muted small">${t('job_rel', { n: S.job.rel })}${next ? ' · ' + t('job_next', { rank: nm(next), n: next.at }) : ''}</div><div class="bar warm"><i style="width:${S.job.rel}%"></i></div>` : '';
  const commute = mine && !w ? commuteHtml(key) : '';   // v0.62: how you get to work every day; home after work
  return `<div class="card job-card">${head}${rel}${body}${commute}${mine ? workmates(key) : ''}</div>`;
}
function placeBody(key) {
  if (key === 'school') {   // v0.22: evening classes
    const sc = S.school || { classes: 0, certs: 0 }, done = sc.day === today(), max = sc.certs >= SCHOOL.maxCerts;
    return `<p>${t('st_desc_school', { n: SCHOOL.fee, m: SCHOOL.perCert, p: Math.round(SCHOOL.certPay * 100), max: SCHOOL.maxCerts })}</p>
      <div class="card"><div class="row between"><span>🎓 ${t('school_certs')}</span><b>${sc.certs} / ${SCHOOL.maxCerts}</b></div><div class="row between"><span>📚 ${t('school_next')}</span><b>${sc.classes % SCHOOL.perCert} / ${SCHOOL.perCert}</b></div>
      <div class="muted small">${t('school_pay_now', { p: Math.round(sc.certs * SCHOOL.certPay * 100) })}</div></div>
      ${S.study ? `<p>📚 ${t('school_in_class', { m: fmtDur(S.study.end - now()) })}</p><div class="bar"><i style="width:${Math.round(Math.min(1, (now() - S.study.start) / (S.study.end - S.study.start)) * 100)}%"></i></div>`
        : `<button class="btn primary block" data-act="takeClass" ${done || max || S.me.coins < SCHOOL.fee ? 'disabled' : ''}>📚 ${max ? t('school_max') : done ? t('school_done') : t('school_take', { n: SCHOOL.fee, m: SCHOOL.minutes })}</button>`}`;
  }
  if (key === 'firestation' || key === 'gas') return `<p>${t('st_desc_' + key)}</p>`;
  if (key === 'office') return `<p>${t('pl_desc_office')}</p>` + jobSection('office');   // v0.37
  if (['hospital', 'bowling', 'aquatic', 'museum', 'station', 'amuse', 'zoo', 'stadium', 'arena'].includes(key)) return `<p>${t('st_desc_' + key)}</p>${key === 'stadium' || key === 'arena' ? venueLookCard(VIEW_TOWN, key) + gameCard(VIEW_TOWN, key) : ''}<p class="muted small">${t('pl_tap_inside')}</p>` + jobSection(key);   // v0.38 (v0.42: + the zoo, the stadium and today's game; v0.59: + the arena, each city's own stadium)
  if (key === 'airport' || key === 'port') return hubBoard(key);   // v0.67
  if (key === 'hotel') return hotelDesk() + `<p class="muted small">${t('pl_tap_inside')}</p>`;
  if (['tower', 'hotel', 'apartments', 'bookstore', 'salon', 'florist', 'bank', 'restaurant', 'rooftop', 'suite'].includes(key)) return `<p class="muted small">${t('pl_tap_inside')}</p>`;
  if (key === 'police') {   // v0.18: the holding cell (when you're held) or how the police work
    if (jailed()) {
      const J2 = S.jail, pct = Math.round(Math.min(1, (now() - J2.start) / (J2.end - J2.start)) * 100);
      return `<div class="jail-pic">${thumbImg('cell', 'me', { look: S.me.look }, 320, 170, 'store-pic')}</div>
        <p>${t('jail_in', { m: fmtDur(J2.end - now()), n: J2.fine, name: esc(fname(J2.fid) || '') })}</p><p class="muted small">${t('jail_why_' + J2.why)}</p>
        <div class="bar"><i style="width:${pct}%"></i></div><p class="muted small">${t('jail_note')}</p>
        <button class="btn primary block" data-act="payBail" ${S.me.coins >= POLICE.bail ? '' : 'disabled'}>💰 ${t('jail_bail', { n: POLICE.bail })}</button>`;
    }
    const n = strikes();
    return `<p>${t('st_desc_police', { s: POLICE.strikes, d: POLICE.strikeDays, m: POLICE.jailMin, b: POLICE.bail, lo: POLICE.fineMin, hi: POLICE.fineMax })}</p>
      <div class="card"><div class="row between"><span>${t('police_record', { d: POLICE.strikeDays })}</span><b>${n ? `${n} / ${POLICE.strikes}` : t('police_clean')}</b></div><p class="muted small">${t('police_private')}</p></div>`;
  }
  if (STORES[key] && key !== 'market') return `<p>${t('st_desc_' + key)}</p><button class="btn primary block" data-act="enterStore" data-arg="${key}">🛍️ ${t('store_enter')}</button>`;
  const P = placeDay(), btn = (act, label, on = true, x = '') => `<button class="btn ${on ? 'primary' : ''} block" data-act="placeDo" data-arg="${key}|${act}|${x}" ${on ? '' : 'disabled'}>${label}</button>`;
  if (key === 'fields') {
    const n = harvestCount(), pct = Math.round(n / HARVEST_GOAL * 100);
    return `<div class="card"><div class="row between"><b>🌾 ${t('pl_harvest_today')}</b><span>${n} / ${HARVEST_GOAL}</span></div><div class="bar"><i style="width:${pct}%"></i></div>
      <p class="muted">${n >= HARVEST_GOAL ? `🎉 ${t('pl_fest')}` : t('pl_harvest_note')}</p></div>
      ${btn('help', P.harvest ? `✅ ${t('pl_helped_today')}` : `🌾 ${t('pl_help', { n: HELP_HARVEST.wheat })}`, !P.harvest)}`;
  }
  if (key === 'park') {
    const dogs = myPets(S.me).filter(a => a.k === 'dog').length;
    const day = today(), who = Scene.parkFolk().map(p => {   // v0.25: the people in the park now; tap to walk over and chat
      const wp = p.work && S.job ? workPeople(S.job.place).find(x => x.id === p.id) : null, h = wp ? null : homeOf(p.id), done = (S.chatDay || {})[p.id + '@' + day];
      if (!wp && !h) return '';
      return `<div class="list-item">${avatar(wp ? wp.look : h.look)}<div class="grow"><b>${esc(wp ? nm(wp.name) : homeName(h))}</b> <span class="muted small">${wp ? '💼 ' + t(wp.boss ? 'boss' : 'coworker') : isFriend(p.id) ? '💛' : ''}</span></div>
        <button class="btn small" data-act="${wp ? 'chatWork' : 'chat'}" data-arg="${p.id}">💬 ${t('chat_btn')}</button></div>`; }).join('');
    return `<p>${t('pl_park_people', { n: Scene.parkFolk().length || Math.max(2, Math.round(onlineIn(VIEW_TOWN) * 0.04)) })}</p>${btn('walk', dogs ? `🐕 ${t('pl_walk_dog')}` : `🚶 ${t('pl_stroll_lap', { f: NEED_GAIN.stroll })}`, !(dogs && P.park))}
      ${who ? `<div class="muted small gap-top">${t('pl_park_here')}</div><div class="card">${who}</div>` : ''}<p class="muted small center gap-top">🎾 🏀 ⚽ 🦆 🪑 🍦 🛝 ${t('pk_hint')}</p>`;
  }
  if (key === 'lake') return btn('fish', P.fish ? `✅ ${t('pl_fished')}` : `🎣 ${t('pl_fish')}`, !P.fish) + `<p class="muted small">${t('pl_swim_note')}</p>` + gameBlock('fishing');   // v0.41: + a fishing contest
  if (key === 'bakery') return jobSection(key) + snackBtn(key) + `<p>${t('pl_bake_note', { n: BREAD.wheat, have: S.me.barn.wheat || 0, bread: S.me.barn.bread || 0 })}</p>${btn('bake', `🍞 ${t('pl_bake')}`, (S.me.barn.wheat || 0) >= BREAD.wheat)}`;
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
    return jobSection(key) + snackBtn(key) + `<p>${t('pl_cafe_note')}</p><div class="card">${ids.map(id => { const h = homeOf(id), at = visitingNow(id);
      return `<div class="list-item">${avatar(h.look)}<div class="grow"><b>${esc(homeName(h))}</b> ${isFriend(id) ? '💛' : ''}<div class="muted"><span class="online-dot"></span>${at ? t('host_away', { name: esc(homeName(homeOf(at))) }) : t('host_home')}</div></div>
        <button class="btn small" data-act="goTo" data-arg="${at || id}">${t('visit')}</button></div>`; }).join('') || `<p class="muted">${t('pl_nobody')}</p>`}</div>`;
  }
  if (key === 'market') return `<button class="btn primary block" data-act="enterStore" data-arg="market">🛍️ ${t('store_enter_market')}</button>` + marketBody(true) + jobSection(key);
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
// v0.27: towns are invite-only, so a few households each (about two people a home)
function onlineIn(id) {
  const hr = localHour(id), day = hr >= 7 && hr < 23.5 ? Math.sin((hr - 7) / 16.5 * Math.PI) : 0;
  return Math.max(1, Math.round(homesIn(id) * 2 * (0.15 + 0.55 * day)));
}
// After the world panel is drawn: paint the map and scroll to the community you picked (or keep where you were).
function afterWorld(wx) {
  const cv = $('#worldCanvas');
  if (!cv) return;
  drawDreamMap(cv);   // v0.59
  // v0.65: the small picture: home, the place picked and you on it
  const g = cv.getContext('2d'), mark = (id, col, r) => { const [x, y] = dmXY(id); g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); };
  Object.keys(DREAM_AT).filter(id => COMMUNITIES[id]).forEach(id => mark(id, isTeamCity(id) ? '#2f5fa8' : '#5d5448', 4));
  if (COMMUNITIES[UI.wsel]) mark(UI.wsel, '#ef7d3c', 8);
  mark(whereNow(), '#e5484d', 6);
}
Object.assign(ACT, {
  world() { closeSheet(); UI.wtown = null; UI.visit = null; UI.visitInside = false; UI.wsel = UI.wsel || myTown(); UI.wscroll = true; setTab('world'); },
  worldMap() { UI.wtown = null; UI.visit = null; UI.visitInside = false; setLevel(0); UI.wscroll = true; syncView(); },
  worldPick(id) { UI.wsel = id; UI.wscroll = true; },
  worldMapOpen() { worldMapOpen(); },   // v0.65
  worldRegion(r) { UI.wregion = UI.wregion === r ? null : r; const c = Object.keys(COMMUNITIES).find(id => COMMUNITIES[id].region === r); if (c && UI.wregion) UI.wsel = c; UI.wscroll = true; },
  // look around a community (your own one is the Town tab)
  worldVisit(id) {
    if (id === myTown()) return setTab('town');
    UI.tab = 'world'; UI.wtown = id; UI.visit = null; UI.visitInside = false; setLevel(0); syncView(); Scene.recenter();
  },
  // v0.59 (Mason #30): you only live (and buy land) in your own town; the whole town moves when everyone agrees
  townMoveAsk(id) {
    if (S.townMove && !S.townMove.done) return;
    const ms = townMembers(), votes = {};
    if (computeRuns(id).reduce((n, r) => n + Math.floor(r.n / CORE_PARCELS), 0) < ms.length + 1) { Sound.play('oops'); return snack(t('tm_no_room')); }   // room for every home
    ms.forEach(f => { votes[f.id] = { at: now() + (TOWN_MOVE.wait[0] + Math.random() * (TOWN_MOVE.wait[1] - TOWN_MOVE.wait[0])) * 1000 }; });
    S.townMove = { to: id, at: now(), votes };
    Sound.play('send'); snack(`🗳️ ${t('tm_sent', { n: ms.length })}`);
    if (!ms.length) townMoveTick2(); save();
  },
  townMoveClear() { S.townMove = null; save(); },
  feedPage(n) { UI.feedPage = Math.max(0, +n || 0); refresh(); const p = $('#panel'); if (p) p.scrollTop = 0; },   // v0.64
  flyGo(arg) { travelGo('air', arg); },   // v0.63
  sailGo(arg) { travelGo('sea', arg); },
  passport() { openSheet('passport'); },
  buyTravelSouv(id) {
    const r = buyTravelSouv(id);
    if (r === 'poor') { Sound.play('oops'); return snack(t('snack_poor')); }
    if (r !== 'ok') return snack(t('pass_buy_there'));
    Sound.play('coins'); snack(`🎁 ${t('tv_bought', { name: nm(FURN['tv_' + id]) })}`); save(); refresh();
  },
  driveTo(arg) {   // v0.60
    const [id, place] = arg.split('|'), P = Drive.plan(whereNow(), id), car = S.me.cars[S.me.car];
    if (!P || !car || CARS[car.k].kind === 'two') return;
    if (S.work || jailed()) return snack(t('dr_busy'));
    if (S.me.coins < P.cost) { Sound.play('oops'); return snack(t('snack_poor')); }
    S.me.coins -= P.cost; save();
    Sound.play('select'); snack(`⛽ ${t('dr_paid', { n: P.cost })}`);
    Drive.open({ from: whereNow(), to: id, place: place || null }, o => driveArrived(o));
  },
});
function townMoveTick2() { const M = S.townMove; if (M && !Object.keys(M.votes).length) { moveWholeTown(M.to); snack(`🚚 ${t('tm_moved', { c: nm(COMMUNITIES[M.to]) })}`); S.townMove = null; Scene.moveHome(); syncView(); Scene.recenter(); } }
Object.assign(ACT, {
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
// v0.54: tell the phone when today's and the next days' games are, and when the games you bet on finish
function syncSportReminders() {
  if (!S) return;
  const off = now() - Date.now(), items = [];
  if (S.sportRemind !== false) for (let d = 0; d < 3; d++) {   // v0.58: each league on its own calendar
    const day = lgDay0(now()) + d * DAY + 12 * HOUR, games = SPORT_KEYS.flatMap(k => { const si = seasonNow(day, k); return si.r === null ? [] : roundGames(k, si.r, si.s); });
    if (!games.length) continue;
    const mine = games.filter(G => [G.h, G.a].some(i => lgTeam(G.sp, i).t === homeCity(myTown()))).map(G => `${LEAGUES[G.sp].e} ${teamName(G.sp, G.h)} – ${teamName(G.sp, G.a)}`);
    items.push({ id: 'day-' + new Date(day).toDateString(), at: Math.round(lgDay0(day) + 10 * HOUR - off), title: `🏟️ ${t('lg_push_title')}`, body: mine.length ? mine.slice(0, 3).join(' · ') : t('lg_push_body', { n: games.length }) });
  }
  (S.bets || []).forEach(b => items.push({ id: 'bet-' + b.id, at: Math.round(gameEnd(b.sp, b.s, b.r) - off), title: `🎟️ ${t('lg_push_bet')}`, body: teamName(b.sp, b.pick) }));
  postNative({ type: 'sportReminders', items: items.filter(x => x.at > Date.now()) });
}
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
  const needStore = storeForAct(el.dataset.act, el.dataset.arg);
  if (needStore && S && !S.onboarding && !atStore(needStore)) { snack(`${STORES[needStore].e} ${t('store_buy_there', { name: nm(STORES[needStore]) })}`); ACT.placeGo(needStore); refresh(); return; }
  if (needStore && S && !S.onboarding && !(UI.inStore === needStore && el.closest('#sheet'))) { ACT.enterStore(needStore, wareKey(el.dataset.act, el.dataset.arg)); refresh(); return; }   // v0.20: pick it up in the store
  // every button makes a sound: picking things (shop categories, tabs, cards) a bubbly blip, everything else a soft tick
  Sound.play(CLICK_SOUND[el.dataset.act] || 'tick');
  if (S && el.closest('#sheet') && GO_ACTS.has(el.dataset.act) && Scene.view().mode === 'shop') {
    if (TIMED[el.dataset.act]) { doThere(el.dataset.act, el.dataset.arg); if (S && !S.onboarding) refresh(); return; }   // v0.50
    goToSheetThing();   // v0.34
  }
  const ta = $('#draftText');
  if (ta && UI.draft) UI.draft.text = ta.value;
  fn(el.dataset.arg);
  if (S && !S.onboarding && !el.dataset.act.startsWith('ob')) refresh();
});
const CLICK_SOUND = { shopCat: 'select', shopSub: 'select', tab: 'select', petPick: 'select', worldPick: 'select' };
// v0.50: what's on the bar while you do each thing in a building
const VDO_E = { eat: '🥐', chat: '💬', relax: '🎧', readbook: '📖', gym: '💪', rest: '😌', donate: '🩸', date: '🥂', lounge: '💬', dinner: '🍝', drink: '🍹', tea: '🫖', book: '📖', arcade: '🕹️', wheel: '🎡', coaster: '🎢', carousel: '🎠', bumper: '🚗', candy: '🍭', giraffefeed: '🦒', hotdog: '🌭', match: '🏟️',
  swim: '🏊', sunbathe: '😎', view: '🏙️', dive: '🤸', sauna: '🧖', visit: '🫶', babies: '👶', trains: '🚆', bed: '😴', bath: '🛁', ex_dino: '🦖', ex_space: '🚀', ex_art: '🖼️', ex_history: '🏺', petting: '🐐', tour: '🏟️' };
// v0.34: in a store or building a tap only opens things; these buttons are where you actually do something, so your
// townie walks over to it then (to the shelf, the counter, the table)
const GO_ACTS = new Set(['specialBuy', 'addWare', 'wareDeal', 'loanSign', 'payWith', 'snackBuy', 'buyMed', 'venueDo', 'placeDo', 'mailOpen', 'ranking', 'eatFood', 'clawTry', 'watchMovie', 'takeClass', 'payBail', 'jobApply', 'bouquetBuy', 'groceriesBuy', 'souvenirBuy', 'roomBook', 'zooPlushBuy']);
function goToSheetThing() { const k = sheetSpot(); if (k) Scene.shopGoTo(k); }
// where the open sheet's thing is in the store or building (a ware's id or key, or 'till')
function sheetSpot() {
  const sh = UI.sheet; if (!sh) return null;
  const arg = String(sh.arg == null ? '' : sh.arg);
  if (sh.type === 'spot') return arg.split('|')[1];
  if (sh.type === 'ware' || sh.type === 'loan' || sh.type === 'food') return arg;
  if (sh.type === 'claw') return 'claw';
  if (sh.type === 'cinema') return 'ticket';
  if (sh.type === 'checkout' || sh.type === 'place') return 'till';
  return null;
}
// v0.50 (Mason #29: "all of it only once you're there; a bar, longer or shorter for what it is; not done the moment you
// tap"): in a store or building these happen once you've walked over and the bar over your head is full. s: how long
// (DO_SECS), e: on the bar, price: checked before you go, eat: then sit down and eat it, back: the sheet again after.
const TIMED = {
  addWare: { s: 'pick', e: '🛒' },
  specialBuy: { s: a => (a.endsWith('|take') ? 'take' : 'order'), e: a => (SPECIALTIES[a.split('|')[0]] || {}).e, price: a => (SPECIALTIES[a.split('|')[0]] || {}).price, eat: a => (a.endsWith('|take') ? null : 'special'), back: true },
  loanSign: { s: 'sign', e: '✍️' },
  payWith: { s: 'pay', e: '💳' },
  snackBuy: { s: 'order', e: () => ({ cafe: '☕', station: '☕', bowling: '🌭', zoo: '🍿' }[UI.inVenue] || '🥐'), price: () => SNACK.price, eat: 'snack' },
  buyMed: { s: 'buy', e: '💊', price: () => SICK.medicine, back: true },
  erCure: { s: 'er', e: '🚑', price: () => PERKS.er },
  eatFood: { s: 'order', e: k => (MALL.foods[k] || {}).e, price: k => (MALL.foods[k] || {}).price },   // then ACT.eatFood sits you down to eat
  watchMovie: { s: 'ticket', e: '🎟️', price: () => MALL.movie },
  clawTry: { s: 0, price: () => MALL.claw },
  takeClass: { s: 'sign', e: '📝', price: () => SCHOOL.fee },
  payBail: { s: 'pay', e: '💵', price: () => POLICE.bail },
  jobApply: { s: 'sign', e: '📝', back: true, ask: k => !(S.job && S.job.place !== k) || confirm(t('job_switch_q', { old: nm(JOBS[S.job.place]) })) },
  bouquetBuy: { s: 'buy', e: '💐', price: () => VENUE.bouquet.price, back: true },
  groceriesBuy: { s: 'groceries', e: '🛒', price: () => VENUE.groceries.price, back: true },
  souvenirBuy: { s: 'buy', e: '🦖', price: () => VENUE.souvenir.price, back: true },
  roomBook: { s: 'buy', e: '🔑', price: () => VENUE.room.price, back: true },
  zooPlushBuy: { s: 'buy', e: '🧸', price: () => VENUE.zooplush.price, back: true },
};
function doThere(act, arg) {
  const T = TIMED[act], v = f => (typeof f === 'function' ? f(arg) : f), price = v(T.price) || 0;
  if (price && S.me.coins < price) { Sound.play('oops'); return snack(t('snack_poor')); }
  if (T.ask && !T.ask(arg)) return;
  const sh = UI.sheet ? { ...UI.sheet } : null, spot = sheetSpot(), e = v(T.e) || '⏳', eat = v(T.eat), secs = DO_SECS[v(T.s)] || 0;
  Sound.play('tick'); closeSheet();
  const run = () => {
    if (T.back && sh && !UI.sheet) openSheet(sh.type, sh.arg);
    ACT[act](T.ask ? arg + '|ok' : arg); refresh();
  };
  Scene.shopDo(spot, secs, e, eat ? () => Scene.shopEat(e, DO_SECS[eat], run) : run);
}
// v0.50: bad weather: what's outdoors waits (the button says why)
function wxName() { const w = weatherNow(); return `${WEATHER_E[w.kind]} ${t(w.kind === 'rain' && w.heavy ? 'w_heavy' : 'w_' + w.kind)}`; }
function wxSnack() { Sound.play('oops'); snack(t('wx_paused', { w: wxName() })); }
function wxGate(where, html) {
  if (!outdoorPaused(where)) return html;
  const ban = `<div class="card wx-paused"><b>${t('wx_paused', { w: wxName() })}</b><p class="muted small">${t('wx_paused_note')}</p></div>`;
  let done2 = false;
  html = html.replace(/<div class="place-head">[\s\S]*?<\/div><\/div>/, m0 => { done2 = true; return m0 + ban; });   // under the title
  return (done2 ? '' : ban) + html.replace(/<button([^>]*) data-act="(venueDo|parkDo|sportGo|gameGo)"/g, '<button disabled$1 data-act="$2"')
      .replace(/<button([^>]*) data-act="placeDo" data-arg="([^"]*\|(?:walk|fish|help)\|[^"]*)"/g, '<button disabled$1 data-act="placeDo" data-arg="$2"');
}
document.addEventListener('input', e => {
  if (e.target.id === 'obName') OB.name = e.target.value;
  if (e.target.id === 'loginEmail' && UI.login) UI.login.email = e.target.value;
  if (e.target.id === 'loginCode' && UI.login) UI.login.code = e.target.value.replace(/\D/g, '').slice(0, 6);
  if (e.target.id === 'petName' && UI.petEdit !== undefined) UI.petEdit = e.target.value;
  if (e.target.id === 'draftText' && UI.draft) UI.draft.text = e.target.value;
  if (e.target.id && e.target.id.startsWith('vol_')) { const k = e.target.id.slice(4); S.vol = { ...(S.vol || {}), [k]: +e.target.value / 100 }; Sound.setVol(k, S.vol[k]); if (k === 'sfx') Sound.play('tick'); save(); }   // v0.56
});

Scene.init($('#town'), onSceneHit);
if (S && !S.onboarding) try { Scene.resumeTrip(); } catch (e) { console.error(e); S.trip = null; }   // v0.19: a trip cut short by closing the app
Scene.onWorldOut(() => { if (UI.tab === 'town') { ACT.world(); refresh(); } });   // pinching out past your town opens the world map
// Sound can only start after the first touch (browser and iPhone rule).
document.addEventListener('pointerdown', () => {
  Sound.start();
  if (S) { Sound.setMusic(S.music !== false); Sound.setSfx(S.sfx !== false); Sound.setAmb(S.amb !== false); ['music', 'sfx', 'amb'].forEach(k => Sound.setVol(k, volOf(k))); }
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
  if (!Scene.tripNow()) { const u = unloadAtHome(); if (u) { Sound.play('collect'); snack(`📦 ${t('unloaded', { n: u.ok })}${u.back ? ' ' + t('unloaded_back', { n: u.back }) : ''}`); refresh(); } }   // v0.20
  { const d = dueDeliveries(); if (d) { Sound.play('chime'); snack(`🚚 ${t('delivered', { n: d.ok })}${d.back ? ' ' + t('unloaded_back', { n: d.back }) : ''}`); refresh(); } }
  { const c = classTick(); if (c) { Sound.play(c === 'cert' ? 'levelup' : 'chime'); snack(c === 'cert' ? `🎓 ${t('school_cert', { n: S.school.certs, p: Math.round(S.school.certs * SCHOOL.certPay * 100) })}` : `📚 ${t('school_class', { n: S.school.classes % SCHOOL.perCert, m: SCHOOL.perCert })}`); refresh(); } }   // v0.24
  if (jailTick()) { Sound.play('chime'); snack(`🚔 ${t('jail_out')}`); outOfJail(); refresh(); }
  { const L = loanTick(); if (L.done) { Sound.play('levelup'); snack(`🏦 ${t('loan_paid_off')}`); save(); } if (L.late) { snack(`🏦 ${t('loan_late_note')}`); save(); } }   // v0.26
  { const who = dailyText(); if (who) { const p = whoIs(who); if (p) { Sound.play('chime'); snack(`💬 ${t('text_new', { name: p.name })}`); } save(); } }
  if (UI.sheet && UI.sheet.type === 'phone') { const sig = stockT() + ':' + Object.values(S.texts || {}).map(th => th.filter(m => m.t <= now()).length).join(','); if (sig !== UI.phoneSig) { UI.phoneSig = sig; renderSheet(); } }
  if (S.work && now() >= S.work.end) { const r = finishShift(); if (r) { Sound.play('coins'); snack(`💼 ${t(r.promoted ? 'job_promoted' : 'job_done', { n: r.pay, rank: nm(JOB_RANKS[jobRank()]) })}`); refresh(); } }
  if (S.sick && Scene.resting() && restInBed(1)) { Sound.play('chime'); snack(`😊 ${t('sick_cured')}`); refresh(); }
  if (S.floodNews) { snack(`🌊 ${t('w_flooded', { n: S.floodNews })}`); S.floodNews = 0; }
  if (!S.onboarding && S.bets && S.bets.length) { const done = settleBets(); if (done.length) { const w = done.filter(x => x.won); Sound.play(w.length ? 'fanfare' : 'aww'); snack(w.length ? `🎉 ${t('lg_won_snack', { n: w.reduce((n, x) => n + x.pay, 0) })}` : `😕 ${t('lg_lost_snack', { n: done.length })}`); save(); refresh(); } }   // v0.54
  if (!S.onboarding && S.lgDay !== today() && new Date(now()).getHours() >= 9) { S.lgDay = today(); const nG = SPORT_KEYS.reduce((n, k) => n + todayGames(k).length, 0); if (nG) { const mine = SPORT_KEYS.filter(k => todayGames(k).some(G => [G.h, G.a].some(i => lgTeam(k, i).t === homeCity(myTown())))); snack(`🏟️ ${t('lg_today_snack', { n: nG, mine: mine.map(k => LEAGUES[k].e).join('') })}`); } save(); syncSportReminders(); }   // v0.54: today's games
  // trophies: celebrate each new one (once)
  if (!S.onboarding) {
    const tn = trophyNews();
    if (tn.length) { UI.trophyQ = [...(UI.trophyQ || []), ...tn]; if (!UI.sheet) openSheet('trophyNew', UI.trophyQ.shift()); save(); refresh(); }
  }
  if (!S.onboarding && farmTick(S.me)) { save(); refresh(); }   // v0.44: feed the animals, throw out what went off
  // pets: say once when one of them needs something; keep the phone reminders up to date
  if (!S.onboarding) {
    const news = petNews();
    news.forEach(n => { addFeed({ kind: 'pet', from: 'me', pet: n.a.id, need: n.need }); snack(petAskText(n.a.name, n.a.k, n.need)); });
    if (news.length) { save(); refresh(); }
    if (Date.now() - petSyncAt > 10 * MIN) { syncPetReminders(); syncSportReminders(); }
  }
  Sound.ambience(NIGHT > 0.5, weatherNow().kind, new Date(now()).getHours());
  if (S.townMove) townMoveTick();   // v0.59
  if (!S.onboarding) { Sound.setFarm([...new Set((S.me.animals || []).map(a => a.k))]); const un = unreadTexts() + unreadMail(); if (un > (UI.lastUnread || 0)) Sound.play('msg'); UI.lastUnread = un; }   // v0.56
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
// v0.44: coming back: what happened on the farm while you were away (crops that rotted, things that went off)
if (S && !S.onboarding) { const lost = farmTick(S.me), rot = (S.me.fields || []).filter(f => isRotten(f) && !f.told).length; (S.me.fields || []).forEach(f => { if (isRotten(f)) f.told = true; });
  const L = [rot && t('farm_away_rot', { n: rot }), lost && t('farm_away_prod', { n: lost })].filter(Boolean); if (L.length) setTimeout(() => snack(`🍂 ${t('farm_away', { list: L.join('，') })}`), 2600); }
if (S && S.woodSwap) { const n = S.woodSwap; delete S.woodSwap; save(); setTimeout(() => snack(`🪙 ${t('wood_swap', { n: fmtNum(n) })}`), 1500); }   // v0.44: your wood became coins

// ---------- v0.18: held at the police station ----------
// out of the police station: your townie stands at its door (trips start from there)
function outOfJail() { const p = Scene.placePoint('police'); if (p && UI.tab === 'town' && !UI.visit && VIEW_TOWN === myTown()) Scene.arriveAt(p, 'police'); }
function jailSnack() { Sound.play('oops'); snack(`🚔 ${t('jail_busy', { m: fmtDur(Math.max(0, S.jail.end - now())) })}`); }
['goTo', 'travel', 'tripFast', 'enterStore', 'jobApply', 'jobStart', 'placeDo', 'visit', 'askHost', 'harvestAll', 'plant', 'plantAll', 'collectAnimal',
  'sell', 'sellAll', 'worldVisit', 'townMoveAsk', 'moveHere', 'goOut', 'goIn'].forEach(k => {
  const f = ACT[k];
  if (f) ACT[k] = function (...a) { if (jailed()) return jailSnack(); return f.apply(this, a); };
});

// ---------- v0.18: the cinema plays a short film on a canvas while its sheet is open ----------
let movieAnim = null;
function playMovie() {
  cancelAnimationFrame(movieAnim);
  const loop = ts => {
    const cv = $('#movieCv');
    if (!UI.sheet || UI.sheet.type !== 'movie' || !cv) return;
    Scene.thumb('movie', UI.sheet.arg, { canvas: cv, live: true, ts, t0: UI.movieT0, look: S.me.look }, cv.clientWidth || 320, cv.clientHeight || 190);
    movieAnim = requestAnimationFrame(loop);
  };
  movieAnim = requestAnimationFrame(loop);
}

// ---------- v0.25: needs in the HUD; a bite to eat; the people you work with ----------
const PARK_KIND = { tennis: 'watch', basketball: 'watch', soccer: 'watch', pond: 'ducks', bench: 'bench', play: 'play', cart: 'icecream' };
const SPOT_E = { 'museum|donate': '💝', 'museum|mystatue': '🗿', 'museum2|space': '🚀', 'museum3|art': '🖼️', 'museum3|history': '🏺', 'museum2|lift': '🛗', 'museum3|lift': '🛗', 'museum|lift': '🛗', 'zoo|lion': '🦁', 'zoo|elephant': '🐘', 'zoo|giraffe': '🦒', 'zoo|penguin': '🐧', 'zoo|monkey': '🐒', 'zoo|panda': '🐼', 'zoo|giraffefeed': '🥬', 'zoo|petting': '🐐', 'zoo|shop': '🧸', 'zoo|kiosk': '🍿',
  'stadium|seats': '🏟️', 'stadium|board': '📺', 'stadium|bets': '🎟️', 'stadium|hotdog': '🌭', 'stadium|cage': '⚾', 'amuse|wheel': '🎡', 'amuse|coaster': '🎢', 'amuse|carousel': '🎠', 'amuse|bumper': '🚗', 'amuse|golf': '⛳', 'amuse|stage': '🎤', 'amuse|candy': '🍭', 'bowling|claw': '🧸', 'market|local': '🧺', 'park|tennis': '🎾', 'park|basketball': '🏀', 'park|soccer': '⚽', 'park|pond': '🦆', 'park|bench': '🪑', 'park|cart': '🍦', 'park|play': '🛝', 'bakery|case': '🥐', 'bakery|oven': '🔥', 'bakery|table': '🍽️', 'cafe|menu': '☕', 'cafe|table': '💬', 'cafe|sofa': '🛋️', 'clinic|bed': '🛏️', 'clinic|scale': '🩺', 'clinic|pharmacy': '💊',
  'library|featured': '⭐', 'library|table': '📖', 'gym|treadmill': '🏃', 'gym|spinbike': '🚴', 'gym|dumbbells': '🏋️', 'gym|boxing': '🥊', 'gym|yogamat': '🧘', 'gym|elliptical': '🏃', 'gym|rower': '🚣', 'gym|ropes': '💥', 'gym|squat': '🏋️',
  'bank|lift': '🛗', 'office|lift': '🛗', 'restaurant|lift': '🛗', 'hotel|lift': '🛗', 'rooftop|lift': '🛗', 'bank|teller': '🏦', 'bank|atm': '🏧', 'bank|loans': '📝', 'office|coffee': '☕', 'office|view': '🏙️',
  'restaurant|table': '🍝', 'restaurant|date': '🥂', 'restaurant|bar': '🍹', 'hotel|bar': '🍹', 'hotel|tea': '🫖', 'rooftop|pool': '🏊', 'rooftop|lounger': '😎', 'apartments|mail': '📬', 'apartments|lounge': '🛋️',
  'bookstore|table': '📖', 'salon|chair': '💇', 'florist|buckets': '💐', 'market|groceries': '🥬', 'post|boxes': '📬', 'post|cards': '💌',
  'school|desk': '✏️', 'plaza|board': '🏆', 'police|board': '📋', 'firestation|truck': '🚒', 'gas|shelf': '🍫', 'gas|fridge': '🥤',
  // v0.38
  'hospital|visit': '🫶', 'hospital|babies': '👶', 'hospital|donate': '🩸', 'hospital|checkup': '🩺', 'hospital|pharmacy': '💊', 'bowling|lane': '🎳', 'bowling|arcade': '🕹️', 'bowling|snack': '🌭',
  'aquatic|race': '🏁', 'aquatic|pool': '🏊', 'aquatic|dive': '🤸', 'aquatic|sauna': '🧖', 'museum|dino': '🦖', 'museum|space': '🚀', 'museum|art': '🖼️', 'museum|history': '🏺', 'museum|shop': '🛍️',
  'station|ticket': '🎫', 'station|board': '🕒', 'station|watch': '🚆', 'station|kiosk': '☕', 'suite|lift': '🛗', 'suite|bed': '🛏️', 'suite|bath': '🛁', 'suite|minibar': '🍾', 'suite|view': '🏙️' };
// v0.31: you can do things with someone when you've walked over to them, are round at their home, or work with them
// v0.33: a ball game on a park court: who you can play with (one of the people on the court, or anyone you know),
// how good they are, what the first game today gives; then the game itself, and what it gave at the end
// v0.51: the button for someone in a sport / game list: townsfolk and the court play now; a friend (a real player) gets
// an invite first (they answer; if they're online and up for it they come); one who's said yes can start
const invReady = (id, k) => { const I = (S.invites || {})[id]; return !!I && I.k === k && I.until > now(); };
function playBtn(k, id, act) {
  if (id === 'court' || !isFriend(id) || invReady(id, k)) return `${invReady(id, k) ? `<span class="tag ok">✅ ${t('inv_ready')}</span>` : ''}<button class="btn small primary" data-act="${act}" data-arg="${k}|${id}">${t('mg_play_btn')}</button>`;
  const wait = UI.invPending && UI.invPending[k + '|' + id];
  return `<button class="btn small" data-act="gameInvite" data-arg="${k}|${id}" ${wait ? 'disabled' : ''}>${wait ? '⏳ ' + t('inv_wait') : '📨 ' + t('inv_btn')}</button>`;
}
const inviteFoot = () => `<p class="muted small center">${t('inv_note')}</p><button class="btn small block" data-act="invitePeople">🔗 ${t('inv_new')}</button>`;
function sportBlock(k) {
  const first = sportFirstLeft(k), R = sportRec(k);
  const stars = id => { const s = sportSkill(id); return '⭐'.repeat(s < 0.45 ? 2 : s < 0.6 ? 3 : s < 0.75 ? 4 : 5); };
  const rows = [{ id: 'court', name: t('mg_court_' + k), look: Scene.courtLook(k), tag: t('mg_court_tag') }]
    .concat(contacts().map(c => { const w = whoIs(c.id); return w && { id: c.id, name: w.name, look: w.look, tag: relTag(c.id) }; }).filter(Boolean));
  return `<div class="sec-title">${BALL_GAMES[k].e} ${t('mg_play_' + k)}</div>
    <p class="muted small">${first ? t('mg_reward_first', { f: BALL.fun, s: BALL.social, r: BALL.rel }) : t('mg_reward_again', { f: BALL.againFun })}</p>
    <div class="card sport-list">${rows.map(r => `<div class="list-item">${avatar(r.look)}<div class="grow"><b>${esc(r.name)}</b><div class="muted small">${r.tag} · ${t('mg_skill')} <span class="stars">${stars(r.id)}</span></div></div>${playBtn(k, r.id, 'sportGo')}</div>`).join('')}</div>
    ${R.p ? `<p class="muted small center">${sportRecText(k)}</p>` : ''}${inviteFoot()}`;
}
function sportRecText(k) { const R = sportRec(k); return t('mg_rec', { p: R.p, w: R.w }) + (k === 'basketball' && R.best ? ' · ' + t('mg_rec_best', { b: R.best }) : k === 'bowling' && R.best ? ' · ' + t('mg_rec_bowl', { b: R.best }) : k === 'race' && R.best ? ' · ' + t('mg_rec_race', { b: R.best.toFixed(1) }) : R.best && ['golf', 'karaoke', 'fishing', 'claw'].includes(k) ? ' · ' + t('mg_rec_' + k, { b: k === 'fishing' ? R.best.toFixed(1) : R.best }) : k === 'derby' && R.best ? ' · ' + t('mg_rec_derby', { b: R.best, f: derbyDist(R.far || 0) }) : ''); }   // v0.41 (v0.42: + the derby)
// v0.38: bowling and the swimming race, in the new district: the same list of who to play with, a price for the lane
const venueMate = k => ({ name: t('mg_court_' + k), look: dressUp({ shirt: k === 'race' ? '#e5484d' : '#3e7cc9', skin: SKINS[2], hair: k === 'race' ? 'short' : 'curly', hairCol: HAIR_COLORS[1], mob: 'walk' }, 'vg_' + k) });
function gameBlock(k) {
  const G = VENUE_GAMES[k], first = sportFirstLeft(k), R = sportRec(k), m = venueMate(k), can = S.me.coins >= G.price;
  const stars = id => { const s = sportSkill(id); return '⭐'.repeat(s < 0.45 ? 2 : s < 0.6 ? 3 : s < 0.75 ? 4 : 5); };
  const rows = [{ id: 'court', name: m.name, look: m.look, tag: t('mg_here_tag') }]
    .concat(contacts().map(c => { const w = whoIs(c.id); return w && { id: c.id, name: w.name, look: w.look, tag: relTag(c.id) }; }).filter(Boolean));
  return `<div class="sec-title">${G.e} ${t('mg_play_' + k, { n: G.pitches || '' })}</div>
    <p class="muted small">${G.price ? t(STR.zh['mg_price_' + k] ? 'mg_price_' + k : 'mg_price', { n: G.price }) + ' · ' : ''}${first ? t('mg_reward_first', { f: BALL.fun, s: BALL.social, r: BALL.rel }) : t('mg_reward_again', { f: BALL.againFun })}</p>
    <div class="card sport-list">${rows.map(r => `<div class="list-item">${avatar(r.look)}<div class="grow"><b>${esc(r.name)}</b><div class="muted small">${r.tag} · ${t('mg_skill')} <span class="stars">${stars(r.id)}</span></div></div>${can ? playBtn(k, r.id, 'gameGo') : `<button class="btn small primary" disabled>${t('mg_play_btn')}</button>`}</div>`).join('')}</div>
    ${R.p ? `<p class="muted small center">${sportRecText(k)}</p>` : ''}${inviteFoot()}`;
}
function hotelDesk() {
  const u = roomUntil();
  return `<div class="card"><b>🛏️ ${t('room_title')}</b><p class="muted small">${t('room_note', { n: VENUE.room.price, h: VENUE.room.checkout })}</p>
    ${u ? `<p class="host-say yes">🔑 ${t('room_have', { t: fmtDate(u) })}</p>` : `<button class="btn primary block" data-act="roomBook" ${S.me.coins >= VENUE.room.price ? '' : 'disabled'}>🔑 ${t('room_book', { n: VENUE.room.price })}</button>`}</div>`;
}
const museumFact = k => { const L = MUSEUM_FACTS[k], d = new Date(now()); return L[(d.getDate() + d.getMonth() * 31) % L.length]; };
function openSport(k, id, w) {
  Games.open(k, { id, name: w.name, look: w.look, skill: sportSkill(id), back: VENUE_GAMES[k] ? t(k === 'fishing' ? 'mg_back_lake' : UI.inStore === 'mall' ? 'mg_back_mall' : 'mg_back_venue') : null }, res => {
    const got = sportDone(k, id, res); save();
    const extra = k === 'claw' && res.toys && res.toys.length ? `<p class="center">${t('mg_got_toys', { list: res.toys.map(x => MALL.plush[x]).join(' ') })}</p>` : k === 'fishing' && res.fish ? `<p class="center">${t('mg_got_fish', { n: res.fish })}</p>` : '';
    const chips = [got.fun && t('mg_got_fun', { n: got.fun }), got.social && t('mg_got_social', { n: got.social }), got.rel && t('mg_got_rel', { n: got.rel })].filter(Boolean);
    return `<div class="mg-got">${chips.map(c => `<span>${c}</span>`).join('')}</div>${extra}${got.up ? `<p class="center"><b>${got.up.e} ${t('mg_got_up', { lv: nm(got.up) })}</b></p>` : ''}<div class="mg-rec">${sportRecText(k)}</div>`;
  }, () => refresh());
}
function canSocial(id) { return UI.visit === id || (!!S.work && String(id).startsWith('work_')) || Scene.near(id); }   // v0.34: right next to them
const canReach = id => canSocial(id) || Scene.canWalkUp(id) || Scene.folkHere(id);   // v0.34: somewhere you can walk over to them
// v0.34: who someone is to you, in a few words
function roleOf(id) {
  const w = whoIs(id); if (!w) return '';
  if (w.tf) return w.tf.job ? `🛎️ ${t('tf_staff', { place: nm(placeInfo(w.tf.job) || STORES[w.tf.job] || placeInfo(VENUE_HOME[w.tf.job] || '') || null) || t('shop_clerk') })} · ${nm(COMMUNITIES[w.tf.town])}` : `🏘️ ${t('tf_resident', { town: nm(COMMUNITIES[w.tf.town]) })}`;   // v0.40
  const wp = w.wp, h = wp ? null : homeOf(id);
  return wp ? `💼 ${t(wp.boss ? 'boss' : 'coworker')} · ${nm(JOBS[S.job.place])}` : isFriend(id) ? `💛 ${t('friend')}` : h && h.fam ? `👪 ${t('family')}` : h && h.town && h.town !== myTown() ? `🏘️ ${t('from_town', { town: nm(COMMUNITIES[h.town]) })}` : `🏡 ${t('neighbour')}`;
}
function relTag(id) { const lv = relLevel(relOf(id)); return `${lv.e} ${nm(lv)}`; }
// v0.43: the top of a building's card: a picture of it, what you can do there (or what it sells), and who works there
const CAT_E = { seeds: '🌱', sell: '💰', trees: '🌳', animals: '🐄', land: '🏞️', furn: '🛋️', yard: '🪴', cars: '🚗', houses: '🏠', food: '🍱', clothes: '👕', pets: '🐶' };
function placeCard(key) {
  const S2 = STORES[key], pic = S2 && S2.w ? `<div class="place-pic">${thumbImg('store', key, {}, 330, 150, 'place-img')}</div>` : '';
  let chips = [];
  if (VENUE_PLACES.includes(key)) { const kk = key === 'arena' ? 'stadium' : key; chips = Object.keys(STR.zh).filter(k => k.startsWith('sp_' + kk + '_') && k.split('_').length === 3 && SPOT_E[kk + '|' + k.split('_')[2]] && !(key === 'arena' && k === 'sp_stadium_cage')).map(k => `${SPOT_E[kk + '|' + k.split('_')[2]]} ${t(k)}`); }
  else if (S2 && S2.cats) chips = S2.cats.map(c => `${CAT_E[c] || '•'} ${t('cat_' + c)}`);
  const staff = (VENUE_PLACES.includes(key) || (S2 && S2.w)) && VIEW_TOWN ? staffOf(VIEW_TOWN, key) : null;
  const gain = STR.zh['pg_' + key] ? `<div class="place-gain"><b>🎁 ${t('pg_title')}</b><p>${t('pg_' + key, { k: Math.round(PERKS.knowPay * 100), e: PERKS.knowEvery, m: Math.round(PERKS.knowMax * 100), w: Math.round(PERKS.swimWalk * 100), n: PERKS.er, know: S.know || 0, kp: Math.round(knowPay() * 100) })}</p></div>` : '';   // v0.45
  return pic + gain + (chips.length ? `<div class="place-chips">${chips.slice(0, 10).map(c => `<span>${c}</span>`).join('')}</div>` : '')
    + (staff ? `<div class="place-staff">${avatar(staff.look, 'sm')}<span>${t('pc_staff', { name: esc(nm(staff.name)) })}</span></div>` : '');
}
// v0.42: how far a hit went, in metres (Chinese) or feet (English)
const derbyDist = m => (curLang() === 'zh' ? Math.round(m) : Math.round(m * 3.281));
// v0.42: the game at the stadium (v0.55: the league game that's on here, with its score and clock; and today's games here)
// v0.57 (Mason #30): the betting window at the stadium: the only place with chances and odds. Today's games in all five
// leagues (before kick-off), tap a team, pick a stake. Below: your tickets and how they went.
function betWindow() {
  const left = BETS.dayMax - stakedToday(), P = UI.betPick;
  if (S.calm) return `<p class="muted">${t('lg_calm')}</p>`;
  if (allOff()) return `<p class="muted">${t('ar_off', { n: seasonNow().left })}</p>`;
  const G = P && todayGames(P.sp)[P.g];
  if (G && G.state === 'soon') {   // one side of one game: the chance, the odds, the stakes
    const p = P.i === G.h ? G.p : 1 - G.p, odds = betOdds(p), o = P.i === G.h ? G.a : G.h;
    return `<div class="card center bw-pick">${teamLogo(P.sp, P.i, true)}<b>${esc(teamName(P.sp, P.i))}</b><span class="muted small">${LEAGUES[P.sp].e} ${t('lg_vs', { name: esc(teamName(P.sp, o)) })} · ${fmtClock(G.start)}</span>
      <div class="row between gap-top"><span>${t('lg_chance')}</span><b>${pctTxt(p)}</b></div><div class="row between"><span>${t('lg_odds')}</span><b>×${odds.toFixed(2)}</b></div></div>
      <div class="muted small gap-top">${t('lg_stake')}</div><div class="bw-chips">${BETS.chips.map(n => `<button class="btn" data-act="betPlace" data-arg="${P.sp}|${P.g}|${P.i}|${n}" ${S.me.coins >= n && n <= left ? '' : 'disabled'}>🪙${n}<small>→ 🪙${Math.round(n * odds)}</small></button>`).join('')}</div>
      <button class="btn ghost block gap-top" data-act="betPick" data-arg="">‹ ${t('bw_back')}</button>`;
  }
  const games = SPORT_KEYS.flatMap(sp => todayGames(sp).filter(g => g.state === 'soon'));
  const row = G => { const mine = (S.bets || []).find(x => x.sp === G.sp && x.s === G.s && x.r === G.r && x.g === G.g);
    const side = (i, p) => `<button class="bw-side ${mine && mine.pick === i ? 'picked' : ''}" data-act="betPick" data-arg="${G.sp}|${G.g}|${i}" ${mine ? 'disabled' : ''}>${teamLogo(G.sp, i)}<span>${esc(teamName(G.sp, i))}</span><em>${pctTxt(p)}</em><b>×${betOdds(p).toFixed(2)}</b></button>`;
    return `<div class="bw-game"><div class="muted small">${LEAGUES[G.sp].e} ${fmtClock(G.start)}${mine ? ` · 🎟️ 🪙${mine.stake} → 🪙${Math.round(mine.stake * mine.odds)}` : ''}</div>${side(G.a, 1 - G.p)}${side(G.h, G.p)}</div>`; };
  const T2 = betTotals(), open = (S.bets || []).map(x => `<div class="row between small"><span>${LEAGUES[x.sp].e} ${esc(teamName(x.sp, x.pick))}</span><b>🪙${x.stake} → 🪙${Math.round(x.stake * x.odds)}</b></div>`).join('');
  const log = (S.betLog || []).slice(-6).reverse().map(x => `<div class="row between small"><span>${LEAGUES[x.sp].e} ${esc(teamName(x.sp, x.pick))} <span class="muted">${x.hs}–${x.as}</span></span><b class="${x.won ? 'win' : 'loss'}">${x.won ? '+🪙' + (x.pay - x.stake) : '−🪙' + x.stake}</b></div>`).join('');
  S.betSeen = now();
  return `<p class="muted small">${t('bw_intro')}</p>${games.length ? games.map(row).join('') : `<p class="muted">${t('bw_none')}</p>`}
    <div class="card gap-top"><b>🎟️ ${t('bw_mine')}</b>${open || `<p class="muted small">${t('lg_none')}</p>`}${log ? `<div class="muted small gap-top">${t('lg_settled')} · ${t('lg_bets_net')} ${T2.net >= 0 ? '+' : '−'}🪙${Math.abs(T2.net)}</div>${log}` : ''}</div>
    <p class="muted small">${t('lg_bet_note', { n: BETS.dayMax, left: Math.max(0, left), m: Math.round(BETS.margin * 100) })} ${t('lg_coins_only')}</p>`;
}
// v0.59: the venue's name and what makes it this city's own; whose home it is (or the nearest city's, in a town)
function venueLookCard(town, venue) {
  const L = STADIUM_LOOK[town], hc = homeCity(town), teams = SPORT_KEYS.filter(sp => (venue === 'arena') === AR_INDOOR.includes(sp)).map(sp => ({ sp, i: arTeamIn(sp, hc) })).filter(x => x.i >= 0);
  if (!isTeamCity(town)) return `<div class="card"><b>${t('city_no_team')}</b><p class="muted small">${t('city_nearest', { c: nm(COMMUNITIES[hc]) })}</p></div>`;
  return `<div class="card venue-look"><b>${venue === 'arena' ? `🏒 ${t('arena_name', { c: nm(COMMUNITIES[town]) })}` : `🏟️ ${nm(L)}`}</b>${venue === 'stadium' ? `<p class="muted small">${nm(L.tag)}</p>` : ''}</div>`;   // (v0.64: the teams are in each sport's own part of the game card)
}
// v0.64 (Mason #32: "why are the two schedules different? split them by sport"): one part for each sport played
// here: its home team and its games today (the score when it's on or over); no game today says so
function gameCard(town, venue) {
  venue = venue || curVenue();
  const A = arenaNow(town, now(), venue), ms = now();
  if (A.off && (A.noTeam || !A.none)) return `<div class="card"><b>🏟️ ${A.noTeam ? t('city_no_team') : t('ar_off', { n: A.si.left })}</b></div>`;   // a town with no pro teams / the break
  const secs = SPORT_KEYS.filter(sp => (venue === 'arena') === AR_INDOOR.includes(sp)).map(sp => {
    const L = LEAGUES[sp], home = arTeamIn(sp, town), games = (A.day || []).filter(G => G.sp === sp);
    if (home < 0 && !games.length) return '';
    const tm = i => `${teamLogo(sp, i)} <span>${esc(teamName(sp, i))}</span>`;
    const rows = games.map(G => { const st = ms >= G.end ? 'done' : ms >= G.start ? 'live' : 'soon', V = arenaState(G, ms, st);
      return `<div class="gm-one ${st}"><div class="muted small">${st === 'live' ? `🔴 ${V.clock}` : st === 'done' ? V.clock : t('ar_starts', { h: fmtHM(G.start) })} · ${t(G.kind === 'home' ? 'ar_home' : 'ar_guest')}</div>
        <div class="gm-row"><span class="lg-side">${tm(G.a)}</span><b>${st === 'soon' ? '' : V.score[1]}</b></div><div class="gm-row"><span class="lg-side">${tm(G.h)}</span><b>${st === 'soon' ? '' : V.score[0]}</b></div></div>`; }).join('');
    return `<div class="card game-card"><b>${L.e} ${nm(L)}</b>${home >= 0 ? `<div class="muted small">${t('venue_home_of')} ${teamLogo(sp, home)} ${esc(teamName(sp, home))}</div>` : ''}
      ${rows || `<div class="muted small gap-top">${t('ar_none_sp', { s: nm(L) })}</div>`}</div>`;
  }).join('');
  return secs || `<div class="card"><b>🏟️ ${t('ar_none')}</b></div>`;
}
function snackBtn(key) { return `<button class="btn block gap-top" data-act="snackBuy" ${S.me.coins >= SNACK.price ? '' : 'disabled'}>${{ cafe: '☕', station: '☕', bowling: '🌭', zoo: '🍿' }[key] || '🥐'} ${t('snack_buy', { n: SNACK.price, h: FOOD_FILL.snack })}</button>`; }
function workmates(key) {
  const at = S.work && S.work.place === key, day = today();
  return `<div class="muted small gap-top">${t('job_people')}</div>${workPeople(key).map(p => { const done = (S.chatDay || {})[p.id + '@' + day];
    return `<div class="list-item">${avatar(p.look)}<div class="grow"><b>${esc(nm(p.name))}</b> <span class="muted small">${t(p.boss ? 'boss' : 'coworker')} · ${relTag(p.id)}</span></div>
      ${at ? `<button class="btn small" data-act="socialOpen" data-arg="${p.id}">💬 ${t('chat_btn')}</button>` : ''}</div>`; }).join('')}${at ? '' : `<div class="muted small">${t('job_people_note')}</div>`}`;
}
// v0.44: the three needs, big: an icon, the name (or what's wrong: hungry, lonely, bored), a coloured bar; and your mood
function needBars() {
  const n = needs(), col = v => (v < NEED_LOW.low ? '#e5484d' : v < 60 ? '#f2b33d' : '#4caf6a');
  const mood = moodGood() ? '😊' : moodBad() ? '😞' : '🙂';
  return `<button class="hud-needs" data-act="energyInfo">${['hunger', 'social', 'fun'].map(k => { const v = Math.round(n[k]), low = v < NEED_LOW.low;
    return `<span class="hn ${low ? 'low' : ''}"><em>${NEEDS[k].e}</em><span class="hn-r"><b>${t(low ? 'need_low_' + k : 'need_' + k)}</b><i><s style="width:${v}%;background:${col(v)}"></s></i></span></span>`; }).join('')}<span class="hn-mood" title="${t('needs_title')}">${mood}</span></button>`;
}

// ---------- v0.26: the phone ----------
function phoneBadge() { try { return unreadTexts() + unreadMail() + (bank().loans.some(l => l.late) ? 1 : 0); } catch (e) { return 0; } }
// ---------- v0.54: the five leagues on your phone (league.js does the seasons) ----------
const betNews = () => (S.betLog || []).filter(b => b.at > (S.betSeen || 0)).length;   // bets settled since you last looked
const pctTxt = p => Math.round(p * 100) + '%';
function teamLogo(sp, i, big) { const T = lgTeam(sp, i); return `<span class="tlogo${big ? ' big' : ''}" style="background:${T.c[0]};border-color:${T.c[1]}">${T.e}</span>`; }
// a little jersey in the team's colours (v0.55 dresses the fans in them)
function jersey(sp, i, n = '', away = false) { const T = lgTeam(sp, i), body = away ? '#f4f6f8' : T.c[0], trim = away ? T.c[0] : T.c[1]; return `<svg class="jersey" viewBox="0 0 40 40"><path d="M13 4 L5 9 L2 18 L9 20 L10 37 L30 37 L31 20 L38 18 L35 9 L27 4 Q20 9 13 4 Z" fill="${body}" stroke="${trim}" stroke-width="2.4"/><path d="M13 4 Q20 9 27 4" fill="none" stroke="${trim}" stroke-width="3"/><text x="20" y="29" text-anchor="middle" font-size="11" font-weight="900" fill="${trim}">${n}</text></svg>`; }   // the home shirt; away: white with the team's colour
function sportsScreen(scr, a, b, arg) {
  const si = seasonNow(now(), LEAGUES[a] ? a : 'football'), head = (title, back = 'home') => `<div class="ph-head"><button class="ph-back" data-act="phone" data-arg="${back}">‹</button><b>${title}</b></div>`;
  if (scr === 'team') {   // one team: its logo, jersey, record and all its games
    const sp = a, i = +b, T = lgTeam(sp, i), L = league(sp), R2 = L.rec[i], rows = [];
    L.rounds.forEach((pr, r) => pr.forEach(([h, aw], g) => { if (h !== i && aw !== i) return; const res = L.res[r] && L.res[r][g], o = h === i ? aw : h, home = h === i;
      rows.push(`<div class="ph-row sm"><span class="muted">${r + 1}</span>${teamLogo(sp, o)}<div class="grow">${home ? '🏠 ' : '✈️ '}${esc(teamName(sp, o))}</div>${res ? `<b class="${(res.hw ? res.h : res.a) === i ? 'win' : 'loss'}">${home ? res.hs : res.as}–${home ? res.as : res.hs}</b>` : `<span class="ph-muted">${fmtDay(roundDay(si.s, r, sp))}</span>`}</div>`); }));
    return head(`${LEAGUES[sp].e} ${esc(teamName(sp, i))}`, `sports|${sp}|table`) + `<div class="ph-team">${teamLogo(sp, i, true)}${jersey(sp, i, 10)}${jersey(sp, i, 7, true)}</div>
      <div class="ph-card"><div class="row between"><span>${t('lg_record')}</span><b>${R2.w}–${R2.l}</b></div><div class="row between"><span>${t('lg_pts')}</span><b>${R2.pf} : ${R2.pa}</b></div><div class="row between"><span>${t('lg_rating')}</span><b>${Math.round(L.elo[i])}</b></div></div>
      <div class="ph-sub">${t('lg_season_games')}</div>${rows.join('')}`;
  }
  const sp = LEAGUES[a] ? a : 'football', tab = b || 'today', L = league(sp);
  const chips = SPORT_KEYS.map(k => `<button class="chip ${k === sp ? 'on' : ''}" data-act="phone" data-arg="sports|${k}|${tab}">${LEAGUES[k].e} ${nm(LEAGUES[k])}</button>`).join('');
  const tabs = ['today', 'table', 'sched'].map(k => `<button class="chip ${k === tab ? 'on' : ''}" data-act="phone" data-arg="sports|${sp}|${k}">${t('lg_tab_' + k)}</button>`).join('');   // v0.57: no odds or bets on the phone (only at the stadium)
  const season = si.off ? t('lg_off', { s: si.s + 1, n: si.left }) : t('lg_round', { s: si.s + 1, r: (si.r === null ? si.next : si.r) + 1, n: SEASON.days }) + (si.every > 1 ? ' · ' + t('lg_every', { n: si.every }) : '');
  let body = '';
  const game = G => {   // one game: both teams and the score (v0.57: no chances or odds here)
    const res = G.res, side = i => `<button class="lg-side ${res && (res.hw ? res.h : res.a) === i ? 'won' : ''}" data-act="phone" data-arg="team|${sp}|${i}">${teamLogo(sp, i)}<span>${esc(teamName(sp, i))}${i === G.h ? ' 🏠' : ''}</span><b>${res ? (i === G.h ? res.hs : res.as) : ''}</b></button>`;
    const st = res ? `${t('lg_final')}${res.note ? ' · ' + t('lg_' + res.note) : ''}` : G.state === 'live' ? `🔴 ${t('lg_live')}` : `🕐 ${fmtClock(G.start)}`;
    return `<div class="lg-game"><div class="lg-st">${st} · 🏟️ ${esc(nm(COMMUNITIES[lgTeam(sp, G.h).t]))}</div>${side(G.a)}${side(G.h)}</div>`;
  };
  if (tab === 'today') {
    const gs = todayGames(sp);
    body = gs.length ? `<div class="ph-sub">${t('lg_today', { h: LEAGUES[sp].hour })}</div>${gs.map(game).join('')}<p class="ph-muted small">${t('lg_how')}</p>`
      : si.off ? `<div class="ph-card">${t('lg_off_note', { n: si.left })}</div>` + standingsHtml(sp, true)
      : `<div class="ph-card">${t('lg_next_round', { r: si.next + 1, d: fmtDay(roundDay(si.s, si.next, sp)), h: LEAGUES[sp].hour })}</div>` + standingsHtml(sp, true);   // v0.58: a day between football rounds
  } else if (tab === 'table') body = standingsHtml(sp, false);
  else if (tab === 'sched') {
    const cur = si.r === null ? si.next : si.r, from = si.off ? 0 : cur, rs = [];
    if (!si.off && cur > 0) rs.push([cur - 1, roundGames(sp, cur - 1)]);
    for (let r = from + (si.off || si.r === null ? 0 : 1); r < Math.min(SEASON.days, from + (si.off ? 3 : 4)); r++) rs.push([r, roundGames(sp, r, si.off ? si.s + 1 : si.s)]);
    body = rs.map(([r, gs]) => `<div class="ph-sub">${t('lg_round_n', { r: r + 1 })} · ${fmtDay(gs[0] ? gs[0].start : roundDay(si.s, r, sp))} ${LEAGUES[sp].hour}:00</div>` + gs.map(G => `<div class="ph-row sm">${teamLogo(sp, G.h)}<span class="grow">${esc(teamName(sp, G.h))}</span><b>${G.res ? `${G.res.hs}–${G.res.as}` : 'vs'}</b><span class="grow right">${esc(teamName(sp, G.a))}</span>${teamLogo(sp, G.a)}</div>`).join('')).join('');
  }
  return head(`🏟️ ${t('ph_sports')}`) + `<div class="ph-muted center small">${season}</div><div class="chips-row lg-chips">${chips}</div><div class="chips-row lg-tabs">${tabs}</div>${body}`;
}
function standingsHtml(sp, short) {
  const rows = standings(sp), L = league(sp);
  return `<div class="ph-sub">${t('lg_table')}</div><div class="lg-table"><div class="lg-tr head"><span>#</span><span class="grow">${t('lg_team')}</span><span>${t('lg_wl')}</span><span>${t('lg_pct')}</span><span>${t('lg_form')}</span></div>`
    + rows.slice(0, short ? 5 : 10).map((x, k) => `<button class="lg-tr ${lgTeam(sp, x.i).t === homeCity(myTown()) ? 'mine' : ''}" data-act="phone" data-arg="team|${sp}|${x.i}"><span>${k + 1}</span><span class="grow">${teamLogo(sp, x.i)} ${esc(teamName(sp, x.i))}</span><span>${x.w}–${x.l}</span><span>${x.w + x.l ? (x.w / (x.w + x.l)).toFixed(3).replace(/^0/, '') : '.500'}</span><span>${x.streak || '–'}</span></button>`).join('') + `</div>`;
}
const fmtDay = ms => { const d = new Date(ms); return `${d.getMonth() + 1}/${d.getDate()}`; };   // v0.26: letters live in the phone too
function loanBtn(kind, k, wid) { const q = loanQuote(kind, k), ok = loanCheck(kind, k) === 'ok';
  return `<button class="btn block gap-top" data-act="loanAsk" data-arg="${wid}">🏦 ${t('loan_btn', { n: q.down.toLocaleString(), d: q.perDay.toLocaleString(), y: q.years })}</button>${ok ? '' : `<p class="muted small center">${t('loan_no_' + loanCheck(kind, k), { n: fmtNum(q.perDay), r: fmtNum(loanRoom()) })}</p>`}`; }   // v0.35: the offer opens even when the bank would say no, so you see why
// buy a car at the dealer: paid in full; the dealer brings it home the next morning (v0.34: for a delivery fee)
function orderCar(w) {
  const pend = allPending().filter(e => e.act === 'buyCar').length;
  if (S.me.cars.some(c => c.k === w.k) || allPending().some(e => e.act === 'buyCar' && e.k === w.k)) return 'own';
  if (S.me.cars.length + pend >= driveCap() + garageCap()) return 'garage';
  if (!canAfford(CARS[w.k].cost) || S.me.coins < (CARS[w.k].cost.coins || 0) + deliveryFee([{ price: w.price }])) return 'poor';
  pay(CARS[w.k].cost); S.me.coins += w.price;   // paid in full (wood too); the coin part rides with the delivery
  if (checkout([{ wid: w.id, kind: 'car', k: w.k, act: 'buyCar', arg: w.k, price: w.price, n: 1, vol: 0 }], 'deliver') !== 'ok') return 'poor';
  return 'ok';
}
function coin(n) { return '🪙' + Math.floor(n).toLocaleString(); }
function spark(s, w, h, col) { const lo = Math.min(...s), hi = Math.max(...s), d = hi - lo || 1;
  const pts = s.map((v, i) => `${(i / (s.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / d * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`; }
function pct(v) { return `<span class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v).toFixed(1)}%</span>`; }
// v0.51: what a message says (one you typed, a quick one, its answer, or one they sent you)
function textOf(m) { return m.text !== undefined ? m.text : m.me ? nm(TEXTS[m.i]) : m.inbox !== undefined ? nm((m.boss ? BOSS_INBOX : INBOX)[m.inbox]) : nm(TEXTS[m.i].re[m.r]); }
function phoneScreen(arg) {
  const [scr, a, b] = String(arg).split('|');
  const head = (title, back = 'home') => `<div class="ph-head"><button class="ph-back" data-act="phone" data-arg="${back}">‹</button><b>${title}</b></div>`;
  let body = '';
  if (scr === 'home') {
    const unread = unreadTexts(), late = bank().loans.some(l => l.late), d = new Date(now());
    const app = (k, e, bg, label, n) => `<button class="ph-app" data-act="phone" data-arg="${k}"><i style="background:${bg}">${e}</i>${label}${n ? `<em class="ph-badge">${n}</em>` : ''}</button>`;
    body = `<div class="ph-clock">${fmtClock(now())}</div><div class="ph-date">${d.getMonth() + 1}/${d.getDate()} · ${weatherPill().replace(/<[^>]+>/g, ' ').trim()}</div>
      <div class="ph-apps">${app('contacts', '📇', '#34c759', t('ph_contacts'))}${app('texts', '💬', '#30a2ff', t('ph_texts'), unread)}${app('bank', '🏦', '#ff9f0a', t('ph_bank'), late ? '!' : 0)}
      ${app('stocks', '📈', '#1c1c1e', t('ph_stocks'))}${app('mail', '✉️', '#5e5ce6', t('ph_mail'), unreadMail())}${app('map', '📍', '#ff375f', t('ph_map'))}${app('sports', '🏟️', '#2e9b5a', t('ph_sports'))}</div>`;
  } else if (scr === 'contacts') {
    const cs = contacts(), group = (kind, label) => { const g = cs.filter(c => c.kind === kind || (kind === 'work' && (c.kind === 'boss' || c.kind === 'mate'))); return g.length ? `<div class="ph-sub">${label}</div>` + g.map(c => { const w = whoIs(c.id); return w ? `<button class="ph-row" data-act="phone" data-arg="person|${c.id}">${avatar(w.look)}<div class="grow"><b>${esc(w.name)}</b><div class="ph-muted">${c.kind === 'boss' ? '💼 ' + t('boss') : c.kind === 'mate' ? '💼 ' + t('coworker') : t('rel_level', { n: (S.rel || {})[c.id] || 0 })}</div></div><span>›</span></button>` : ''; }).join('') : ''; };
    body = head(`📇 ${t('ph_contacts')}`) + (group('family', '👪 ' + t('family')) + group('friend', '💛 ' + t('ph_friends')) + group('work', '💼 ' + t('ph_work')) + group('neighbour', '🏡 ' + t('ph_people')) || `<p class="ph-muted">${t('ph_no_contacts')}</p>`);
  } else if (scr === 'person') {
    const w = whoIs(a); if (!w) return phoneScreen('contacts');
    const called = (S.chatDay || {})['call_' + a + '@' + today()], met = (S.chatDay || {})['meet_' + a + '@' + today()], here = VIEW_TOWN === myTown() && townOf(a.startsWith('work_') ? 'me' : a) === myTown();
    body = head(esc(w.name), 'contacts') + `<div class="ph-who">${avatar(w.look, 'xl')}<b>${esc(w.name)}</b><span class="ph-muted">${t('soc_rel')} ${relTag(a)}</span></div>
      <div class="ph-acts"><button class="ph-btn go" data-act="phoneCall" data-arg="${a}">📞 ${t(called ? 'ph_call_again' : 'ph_call')}</button><button class="ph-btn" data-act="phone" data-arg="texts|${a}">💬 ${t('ph_text')}</button>
      ${here ? `<button class="ph-btn" data-act="phoneMeet" data-arg="${a}" ${met ? 'disabled' : ''}>🌳 ${t(met ? 'meet_done' : 'ph_meet')}</button>` : ''}${!w.wp ? `<button class="ph-btn" data-act="goTo" data-arg="${a}">🏡 ${t('visit')}</button>` : ''}</div>
      <p class="ph-muted small">${t('ph_person_note', { c: NEED_GAIN.call, x: NEED_GAIN.text })}</p>`;
  } else if (scr === 'call') {
    const w = whoIs(a); if (!w) return phoneScreen('contacts');
    const line = CALL_LINES[(a.length + new Date(now()).getDate()) % CALL_LINES.length];
    body = `<div class="ph-call">${avatar(w.look, 'xl')}<b>${esc(w.name)}</b><span class="ph-muted">${t('ph_calling')}</span><div class="bubble them">${esc(nm(line))}</div>
      <p class="ph-muted small">${b === 'ok' ? t('ph_call_ok', { n: NEED_GAIN.call }) : t('ph_call_done')}</p><button class="ph-btn hang" data-act="phone" data-arg="person|${a}">📵 ${t('ph_hang')}</button></div>`;
  } else if (scr === 'texts' && a) {
    const w = whoIs(a); if (!w) return phoneScreen('texts');
    const th = ((S.texts || {})[a] || []).filter(m => m.t <= now()), typing = ((S.texts || {})[a] || []).some(m => m.t > now());
    const msg = textOf;
    // v0.43: what they said (white, with their face and name) and what you said (blue) up top; the replies you can pick
    // in their own box at the bottom, so it's clear which is which
    const them = txt => `<div class="msg them">${avatar(w.look, 'sm')}<div><small>${esc(w.name)}</small><div class="bubble them">${txt}</div></div></div>`;
    const kind = isFriend(a) ? `👤 ${t('ph_real')}` : `🤖 ${t('ph_bot')}`;   // v0.51: a player, or a townie who answers by itself
    body = head(esc(w.name), 'texts') + `<div class="ph-kind">${kind}</div><div class="ph-thread">${th.map(m => (m.me ? `<div class="msg me"><div class="bubble me">${esc(msg(m))}</div></div>` : them(esc(msg(m))))).join('') || `<p class="ph-muted center">${t('ph_say_hi')}</p>`}${typing ? them('<span class="typing">• • •</span>') : ''}</div>
      <div class="ph-reply"><div class="ph-reply-t">💬 ${t('ph_say')}</div>${UI.phPlay === a
        ? `<div class="ph-quick">${SAY_GAMES.map(g => `<button class="ph-btn" data-act="phoneSay" data-arg="${a}|play|${g}">${esc(nm(GAME_NAMES[g]))}</button>`).join('')}<button class="ph-btn ghost" data-act="phonePlay" data-arg="">‹</button></div>`
        : `<div class="ph-quick">${SAY.map(x => `<button class="ph-btn" data-act="${x.k === 'play' ? 'phonePlay' : 'phoneSay'}" data-arg="${a}|${x.k}">${x.e} ${esc(x.k === 'play' ? t('ph_play') : nm(x))}</button>`).join('')}</div>`}</div>`;   // v0.57: tap what to say (no typing)
  } else if (scr === 'texts') {
    const ids = Object.keys(S.texts || {}).filter(id => whoIs(id) && S.texts[id].length).sort((x, y) => S.texts[y][S.texts[y].length - 1].t - S.texts[x][S.texts[x].length - 1].t);
    body = head(`💬 ${t('ph_texts')}`) + (ids.map(id => { const w = whoIs(id), th = S.texts[id].filter(m => m.t <= now()), last = th[th.length - 1], n = th.filter(m => !m.me && m.t > ((S.textSeen || {})[id] || 0)).length;
      const txt = last ? textOf(last) : '…';
      return `<button class="ph-row" data-act="phone" data-arg="texts|${id}">${avatar(w.look)}<div class="grow"><b>${esc(w.name)}</b><div class="ph-muted">${esc(txt)}</div></div>${n ? `<em class="ph-badge">${n}</em>` : ''}</button>`; }).join('') || `<p class="ph-muted">${t('ph_no_texts')}</p>`)
      + `<button class="ph-btn block" data-act="phone" data-arg="contacts">✏️ ${t('ph_new_text')}</button>`;
  } else if (scr === 'sports' || scr === 'team') {   // v0.54: the leagues
    body = sportsScreen(scr, a, b, arg);
  } else if (scr === 'bank') {
    const B = bank(), st = stocksValue(), debt = debtLeft();
    body = head(`🏦 ${t('ph_bank')}`) + `<div class="ph-card big"><span class="ph-muted">${t('bank_net')}</span><b>${coin(assetValue(S.me))}</b>${debt ? `<span class="ph-muted small">${t('bank_debt', { n: Math.ceil(debt).toLocaleString() })}</span>` : ''}</div>
      <div class="ph-card"><div class="row between"><span>👛 ${t('bank_wallet')}</span><b>${coin(S.me.coins)}</b></div><div class="row between"><span>🐷 ${t('bank_save')}</span><b>${coin(B.save)}</b></div>
        <div class="ph-muted small">${t('bank_rate', { p: +(BANK.rate * 100).toFixed(1), n: fmtNum(B.save * BANK.rate / 365) })}</div>
        <div class="ph-acts">${['1000', '10000', 'all'].map(v => `<button class="ph-btn go" data-act="bankIn" data-arg="${v}">⬇ ${v === 'all' ? t('bank_all') : fmtNum(+v)}</button>`).join('')}</div>
        <div class="ph-acts">${['1000', '10000', 'all'].map(v => `<button class="ph-btn" data-act="bankOut" data-arg="${v}">⬆ ${v === 'all' ? t('bank_all') : fmtNum(+v)}</button>`).join('')}</div>
        <div class="ph-muted small">${t('bank_income', { n: fmtNum(avgIncome()), d: fmtNum(loansPerDay()) })}</div>
        <div class="ph-muted small">${t('bank_in_out')}</div></div>
      ${st ? `<button class="ph-card ph-row" data-act="phone" data-arg="stocks">📈 ${t('ph_stocks')}<b class="grow right">${coin(st)}</b></button>` : ''}
      <div class="ph-sub">🧾 ${t('loan_list')}</div>${B.loans.map(l => { const name = nm(l.kind === 'house' ? HOUSES[l.k] : CARS[l.k]), done = 1 - l.left / l.total;
        return `<div class="ph-card ${l.late ? 'late' : ''}"><div class="row between"><b>${l.kind === 'house' ? '🏠' : '🚗'} ${esc(name)}</b><span>${coin(l.left)}</span></div><div class="bar"><i style="width:${Math.round(done * 100)}%"></i></div>
          <div class="ph-muted small">${l.late ? '⚠️ ' + t('loan_late_row') : t('loan_next', { n: Math.min(l.perDay, l.left).toLocaleString(), m: fmtDur(Math.max(0, l.next - now())) })}</div>
          <button class="ph-btn" data-act="loanRepay" data-arg="${l.id}" ${S.me.coins + B.save >= l.left ? '' : 'disabled'}>✅ ${t('loan_repay', { n: Math.ceil(l.left).toLocaleString() })}</button></div>`; }).join('') || `<p class="ph-muted small">${t('loan_none')}</p>`}`;
  } else if (scr === 'stocks') {
    const st = stocksValue(), cost = STOCK_KEYS.reduce((t2, co) => t2 + holding(co).cost, 0);
    body = head(`📈 ${t('ph_stocks')}`) + `<div class="ph-card big"><span class="ph-muted">${t('stock_mine')}</span><b>${coin(st)}</b>${cost ? pct((st / cost - 1) * 100) : ''}</div>`
      + STOCK_KEYS.map(co => { const D = STOCKS[co], h = holding(co); return `<button class="ph-row" data-act="phone" data-arg="stock|${co}"><span class="ph-logo" style="background:${D.col}">${D.e}</span><div class="grow"><b>${nm(D)}</b><div class="ph-muted">${h.n ? t('stock_have', { n: h.n }) : ''}</div></div>${spark(stockSeries(co), 64, 26, stockChange(co) >= 0 ? '#4cd964' : '#ff6b6b')}<div class="right"><b>${stockPrice(co).toFixed(1)}</b><div>${pct(stockChange(co))}</div></div></button>`; }).join('')
      + `<p class="ph-muted small">${t('stock_note', { p: STOCK.fee * 100, m: STOCK.tickMin })}</p>`;
  } else if (scr === 'stock') {
    const D = STOCKS[a]; if (!D) return phoneScreen('stocks');
    const p = stockPrice(a), h = holding(a), ch = stockChange(a), up = ch >= 0, newsN = Math.floor(srand(STOCK_KEYS.indexOf(a) + 3, Math.floor(now() / DAY)) * 3) + 1;
    body = head(`${D.e} ${nm(D)}`, 'stocks') + `<div class="ph-card big"><b>🪙${p.toFixed(2)}</b>${pct(ch)} <span class="ph-muted small">${t('stock_24h')}</span>${spark(stockSeries(a), 270, 110, up ? '#4cd964' : '#ff6b6b')}</div>
      <div class="ph-card">📰 ${t('news_' + (up ? 'up' : 'down') + '_' + newsN, { name: nm(D) })}</div>
      <div class="ph-card"><div class="row between"><span>${t('stock_own')}</span><b>${h.n}</b></div>${h.n ? `<div class="row between"><span>${t('stock_value')}</span><b>${coin(h.n * p)} ${pct((h.n * p / h.cost - 1) * 100)}</b></div>` : ''}
        <div class="ph-acts">${['1', '10', 'max'].map(v => `<button class="ph-btn go" data-act="stockBuy" data-arg="${a}|${v}">${t('stock_buy')} ${v === 'max' ? t('stock_max') : '×' + v}</button>`).join('')}</div>
        ${h.n ? `<div class="ph-acts">${['1', '10', 'all'].map(v => `<button class="ph-btn warn" data-act="stockSell" data-arg="${a}|${v}">${t('stock_sell')} ${v === 'all' ? t('bank_all') : '×' + v}</button>`).join('')}</div>` : ''}
        <div class="ph-muted small">${t('stock_wallet', { n: Math.floor(S.me.coins).toLocaleString() })}</div></div>`;
  } else return phoneScreen('home');
  return `<div class="ph-device"><div class="ph-bar"><span>${fmtClock(now())}</span><span>▂▄▆ 🔋</span></div><div class="ph-screen">${body}</div><button class="ph-home" data-act="${scr === 'home' ? 'close' : 'phone'}" data-arg="home" aria-label="home"></button></div>`;
}

// ---------- v0.40: states and counties ----------
const awayIn = t2 => !!(S.away && S.away.town === t2 && S.away.until > now() && t2 !== myTown());
// The county's specialties, to eat here or take with you (in your own town's supermarket, or in a town you came to by
// train); your collection so far.
function specialsBody(town) {
  const C = countyOf(town), ok = town === myTown() || awayIn(town);
  const rows = C.specials.map(k => { const F = SPECIALTIES[k], had = !!(S.tasted || {})[k];
    return `<div class="list-item"><span class="big-emoji">${F.e}</span><div class="grow"><b>${nm(F)}</b> ${had ? '✅' : '🆕'}<div class="muted small">🍔 +${F.hunger} · 🎉 +${F.fun}</div></div>
      <div class="col-btns"><button class="btn small primary" data-act="specialBuy" data-arg="${k}|eat" ${ok && S.me.coins >= F.price ? '' : 'disabled'}>😋 🪙${F.price}</button><button class="btn small" data-act="specialBuy" data-arg="${k}|take" ${ok && S.me.coins >= F.price ? '' : 'disabled'}>🎁 ${t('special_take')}</button></div></div>`; }).join('');
  return `<div class="card">${rows}</div><p class="muted small">${t('special_note', { n: tastedCount(), m: Object.keys(SPECIALTIES).length })}</p>${ok ? '' : `<p class="muted small center">${t('special_far')}</p>`}`;
}
// a number plate the way it looks there
function plateHtml(st, text) {
  const P = STATES[st].plate;
  return `<span class="plate" style="background:${P.bg};color:${P.fg};${P.top ? `border-top:3px solid ${P.top};` : ''}">${P.band ? `<i style="background:${P.band}"></i>` : ''}<small>${esc(P.name)}</small><b>${esc(text)}</b>${P.end ? `<i class="end" style="background:${P.end}"></i>` : ''}</span>`;
}
function policeHtml(P) { return `<span class="police-chip" style="background:${P.body};color:${lumOf(P.body) > 0.55 ? '#1d1d1f' : '#ffffff'}"><i style="background:${P.a}"></i>🚓 ${esc(P.text)}<i style="background:${P.b || P.a}"></i></span>`; }
function countyCard(town) {
  const C = countyOf(town), ST = stateOf(town), T = TERRAINS[C.terrain], pct = k => (k >= 1 ? '+' : '−') + Math.round(Math.abs(k - 1) * 100) + '%';
  const sp = C.specials.map(k => `<span class="chip">${SPECIALTIES[k].e} ${nm(SPECIALTIES[k])}${(S.tasted || {})[k] ? ' ✅' : ''}</span>`).join('');
  return `<div class="county-card gap-top"><div class="county-head">🗺️ <b>${nm(ST)}</b> <span class="muted small">${t('st_kind_' + ST.kind)}</span> › <b>${nm(C)}</b></div>
    <div class="world-stats"><span>${T.e} ${nm(T)}</span><span>🛒 ${t('county_cost')} ${C.cost === 1 ? t('county_avg') : pct(C.cost)}</span><span>💼 ${t('county_wage')} ${C.wage === 1 ? t('county_avg') : pct(C.wage)}</span></div>
    <div class="muted small gap-top">🧺 ${t('county_specials')}</div><div class="chips-row">${sp}</div>
    <div class="muted small gap-top">🏘️ ${t('county_near')}：${C.near.map(n => (curLang() === 'zh' ? n[0] : n[1])).join(' · ')}</div>
    <div class="row gap-top county-cars">${policeHtml(C.police)}${plateHtml(C.state, plateText(C.state, town))}</div></div>`;
}
function staffChat(key) {   // the person at the counter has a name: say hello
  const ST = staffOf(VIEW_TOWN, key);
  return `<button class="btn small block gap-top" data-act="socialOpen" data-arg="${ST.id}">👋 ${t('chat_with', { name: esc(nm(ST.name)) })}</button>`;
}
