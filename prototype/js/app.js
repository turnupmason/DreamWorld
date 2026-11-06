'use strict';
// UI: HUD, tabs, bottom sheets, onboarding, prototype console.

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = { tab: 'town', sheet: null, welcome: false };
let OB = null; // onboarding draft
const ENERGY_EMOJI = { low: '😴', mid: '🙂', high: '🤩' };
const SRC_EMOJI = { steps: '🚶', focus: '📵', goal: '⭐', rest: '🌙' };

// ---------- formatting ----------
const fname = f => (f ? f.name[curLang()] || f.name.zh : '');
const fmtNum = n => n.toLocaleString(curLang() === 'en' ? 'en-US' : 'zh-CN');
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
function costText(c) {
  const a = [];
  if (c.coins) a.push(`🪙${c.coins}`);
  if (c.wood) a.push(`🪵${c.wood}`);
  return a.join('  ');
}
function rewardText(r) {
  const a = [];
  if (r.coins) a.push(`+🪙${r.coins}`);
  if (r.wood) a.push(`+🪵${r.wood}`);
  for (const k in r.seeds || {}) if (r.seeds[k]) a.push('+' + t('seed_x', { e: CROPS[k].emoji, n: r.seeds[k] }));
  return a.join('  ');
}
function giftText(g) {
  if (g.type === 'crop') return `${g.n} ${CROPS[g.crop].emoji}${t('crop_' + g.crop)}`;
  if (g.type === 'seed') return t('gift_seed', { n: g.n, e: CROPS[g.crop].emoji, name: t('crop_' + g.crop) });
  if (g.type === 'coins') return `🪙${g.n}`;
  return `🪵${g.n}`;
}
function feedText(it) {
  const name = esc(fname(friendById(it.from)));
  if (it.kind === 'gift') {
    const key = it.msgKey === 'welcome' ? 'feed_welcome' : it.msgKey === 'thanks' ? 'feed_thanks' : 'feed_gift';
    return t(key, { name, gift: giftText(it.gift) });
  }
  if (it.kind === 'like') return t('feed_like', { name });
  if (it.kind === 'goal') return t('feed_goal', { name });
  if (it.kind === 'msg') return t('feed_msg', { name, msg: t(it.msgKey) });
  if (it.kind === 'join') return t('feed_join', { name, gift: giftText(it.gift) });
  return '';
}
function pendingTitle(p) {
  if (p.src === 'steps') return t('p_steps', { n: fmtNum(p.info.steps) });
  if (p.src === 'focus') return t('p_focus', { d: fmtDur(p.info.min * MIN) });
  if (p.src === 'goal') return t('p_goal');
  return t('p_rest');
}
const avatarDot = (color, cls = '') => `<span class="avatar-dot ${cls}" style="background:${color}"></span>`;
const unreadCount = () => S.feed.filter(i => !i.read || (i.gift && !i.claimed)).length;

// ---------- feedback ----------
// Push-style banners are only for real social events (design principle 3).
function notify(item) {
  if (!item || !['gift', 'like', 'msg', 'join'].includes(item.kind)) return;
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
  snackTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

// ---------- render ----------
function renderHUD() {
  const e = energyLevel();
  $('#hud').innerHTML = `
    <div class="statusbar"><span id="clock">${fmtClock(now())}</span><span>▂▄▆ 🔋</span></div>
    <div class="row between">
      <div class="row me">${avatarDot(S.color)}<div><div class="me-name">${esc(S.name)}</div>
        <div class="energy">${ENERGY_EMOJI[e]} ${t('energy_short_' + e)}</div></div></div>
      <div class="cap ${actionsLeft() === 0 ? 'done' : ''}" title="${t('cap_title')}">🔨 ${S.today.actions}/${ACTION_CAP}</div>
    </div>
    <div class="res row">
      <span class="pill">🪙 ${fmtNum(S.coins)}</span><span class="pill">🪵 ${S.wood}</span><span class="pill">🌱 ${totalSeeds()}</span>
      ${S.pending.length ? `<button class="pill pending" data-act="collect">📦 ${t('to_collect')} ${S.pending.length}</button>` : ''}
    </div>`;
}

function renderTabbar() {
  const n = unreadCount();
  $('#tabbar').innerHTML = [['town', '🏡'], ['real', '🚶'], ['friends', '👥'], ['feed', '🔔']].map(([id, ic]) =>
    `<button class="tab ${UI.tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">
      <span class="ic">${ic}</span>${t('tab_' + id)}${id === 'feed' && n ? `<span class="badge">${n}</span>` : ''}</button>`).join('');
}

function renderPanel() {
  const el = $('#panel');
  el.hidden = UI.tab === 'town';
  $('#homeBtn').hidden = UI.tab !== 'town';
  $('#hint').hidden = UI.tab !== 'town' || S.seenHint;
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  if (UI.tab === 'real') el.innerHTML = panelReal();
  else if (UI.tab === 'friends') el.innerHTML = panelFriends();
  else if (UI.tab === 'feed') el.innerHTML = panelFeed();
}

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
    <div class="card">
      <h3>🚶 ${t('steps_today')}</h3>
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
        <input type="checkbox" class="switch" data-act="share" ${S.shareGoal ? 'checked' : ''}></label>
      <p class="muted">${t('privacy_note')}</p>
    </div>
    <div class="card">
      <h3>⚙️ ${t('settings')}</h3>
      <div class="row between"><span>${t('language')}</span><span>
        <button class="chip ${S.lang === 'zh' ? 'on' : ''}" data-act="lang" data-arg="zh">中文</button>
        <button class="chip ${S.lang === 'en' ? 'on' : ''}" data-act="lang" data-arg="en">English</button></span></div>
    </div>`;
}

function panelFriends() {
  const ids = friendIds();
  const empty = S.plots.filter(p => !p.owner).length;
  const rows = ids.map(id => {
    const f = friendById(id);
    const status = f.shareGoal ? (f.goalToday ? `<span class="tag ok">✅ ${t('f_goal_done')}</span>` : `<span class="tag">${t('f_goal_not_yet')}</span>`)
      : `<span class="tag">🔒 ${t('f_private')}</span>`;
    return `<div class="list-item">${avatarDot(f.color, 'lg')}<div class="grow"><b>${esc(fname(f))}</b>
      <div class="muted">${HOUSE_EMOJI[f.house]} ${t('house_' + f.house)} · ❤️ ${f.likes}</div>${status}</div>
      <button class="btn small" data-act="visit" data-arg="${f.id}">${t('visit')}</button></div>`;
  }).join('');
  return `
    <h1 class="panel-title">🌳 ${t('street_name')}</h1>
    <p class="muted note">${t('street_members', { n: ids.length + 1, max: S.plots.length })}</p>
    <div class="card">${rows}</div>
    ${empty ? `<button class="btn primary block" data-act="invite">✉️ ${t('invite_btn')}</button>
      <p class="muted center gap-top">${t('invite_reward_note')}</p>` : `<p class="muted center">${t('street_full')}</p>`}
    <div class="card soon gap-top"><h3>🏛️ ${t('coop_title')}</h3><p class="muted">${t('coop_soon')}</p></div>`;
}

function panelFeed() {
  if (!S.feed.length) return `<h1 class="panel-title">${t('tab_feed')}</h1><p class="muted center gap-top">${t('feed_empty')}</p>`;
  const items = [...S.feed].reverse().map(it => {
    const f = friendById(it.from);
    const btn = it.gift ? (it.claimed ? `<span class="muted">${t('claimed')}</span>`
      : `<button class="btn small primary" data-act="claim" data-arg="${it.id}">${t('claim')}</button>`) : '';
    return `<div class="list-item">${avatarDot(f ? f.color : '#ccc')}<div class="grow"><div>${feedText(it)}</div>
      <div class="muted">${ago(it.t)}</div></div>${btn}</div>`;
  }).join('');
  return `<h1 class="panel-title">${t('tab_feed')}</h1><p class="muted note">${t('feed_note')}</p><div class="card">${items}</div>`;
}

// ---------- sheets ----------
function openSheet(type, arg) {
  UI.sheet = { type, arg };
  renderSheet();
  $('#sheet').className = 'sheet' + (type === 'friend' ? ' compact' : '');
  $('#sheet').hidden = false;
  $('#backdrop').hidden = false;
  $('#backdrop').classList.toggle('light', type === 'friend');
}
function closeSheet() { UI.sheet = null; $('#sheet').hidden = true; $('#backdrop').hidden = true; UI.welcome = false; }
function renderSheet() {
  if (!UI.sheet) return;
  const { type, arg } = UI.sheet;
  const html = type === 'collect' ? sheetCollect() : type === 'house' ? sheetHouse() : type === 'garden' ? sheetGarden(arg)
    : type === 'friend' ? sheetFriend(arg) : type === 'invite' ? sheetInvite() : sheetCap();
  $('#sheet').innerHTML = `<div class="grab"></div>${html}`;
}

function sheetCollect() {
  const title = UI.welcome ? t('welcome_back') : t('collect_title');
  if (!S.pending.length) return `<h2>${title}</h2><p class="muted">${t('collect_empty')}</p>`;
  const rows = S.pending.map(p => `<div class="list-item"><span class="big-emoji">${SRC_EMOJI[p.src]}</span>
    <div class="grow"><b>${pendingTitle(p)}</b><div class="reward">${rewardText(p.reward)}</div></div></div>`).join('');
  return `<h2>${title}</h2><p class="muted">${t('collect_desc')}</p><div class="card">${rows}</div>
    <button class="btn primary block" data-act="collectAll">${t('collect_all')}</button>`;
}

function sheetHouse() {
  const lv = S.house, next = lv < MAX_HOUSE ? HOUSE_COST[lv + 1] : null;
  const left = actionsLeft();
  let h = `<h2>${HOUSE_EMOJI[lv]} ${t('my_home')} · Lv${lv} ${t('house_' + lv)}</h2>
    <p class="muted">${t('build_left', { n: left, cap: ACTION_CAP })}</p>`;
  h += `<div class="card"><h3>🔨 ${t('upgrade')}</h3>`;
  h += next ? `<div class="list-item"><span class="big-emoji">${HOUSE_EMOJI[lv + 1]}</span><div class="grow"><b>Lv${lv + 1} ${t('house_' + (lv + 1))}</b>
      <div class="cost">${costText(next)}</div></div>
      <button class="btn primary small" data-act="upgrade" ${canAfford(next) && left ? '' : 'disabled'}>${t('upgrade_btn')}</button></div>`
    : `<p class="muted">${t('house_max')}</p>`;
  h += `</div><div class="card"><h3>🌷 ${t('decor')}</h3>`;
  h += DECOS.map(d => {
    const own = S.decos.includes(d.id);
    return `<div class="list-item"><span class="big-emoji">${d.emoji}</span><div class="grow"><b>${t('deco_' + d.id)}</b>
      <div class="cost">${costText(d.cost)}</div></div>
      ${own ? `<span class="muted">${t('owned')}</span>` : `<button class="btn small" data-act="deco" data-arg="${d.id}" ${canAfford(d.cost) && left ? '' : 'disabled'}>${t('buy')}</button>`}</div>`;
  }).join('');
  h += `</div><div class="card"><h3>🌱 ${t('seed_shop')}</h3>`;
  h += Object.entries(CROPS).map(([k, c]) => `<div class="list-item"><span class="big-emoji">${c.emoji}</span>
      <div class="grow"><b>${t('crop_' + k)}</b> <span class="muted">×${S.seeds[k]}</span>
      <div class="cost">${t('grows_in', { d: fmtDur(c.grow) })}${c.rare ? ' · ' + t('rare_only') : ''}</div></div>
      ${c.rare ? '' : `<button class="btn small" data-act="buySeed" data-arg="${k}" ${S.coins >= c.price ? '' : 'disabled'}>🪙${c.price}</button>`}</div>`).join('');
  h += `<p class="muted">${t('shop_note')}</p></div>`;
  const barn = Object.entries(CROPS).filter(([k]) => S.crops[k] > 0);
  h += `<div class="card"><h3>🧺 ${t('barn')}</h3>`;
  h += barn.length ? barn.map(([k, c]) => `<div class="list-item"><span class="big-emoji">${c.emoji}</span>
      <div class="grow"><b>${t('crop_' + k)}</b> <span class="muted">×${S.crops[k]}</span></div>
      <button class="btn small" data-act="sell" data-arg="${k}">${t('sell')} +🪙${c.sell}</button></div>`).join('')
    : `<p class="muted">${t('barn_empty')}</p>`;
  return h + '</div>';
}

function sheetGarden(i) {
  const g = S.garden[i];
  if (g) {
    const c = CROPS[g.crop];
    const left = c.grow - (now() - g.at);
    return `<h2>${c.emoji} ${t('crop_' + g.crop)}</h2>
      <div class="card center"><div class="big-emoji xl">🌱</div>
      <p>${t('growing_left', { d: `<b id="growLeft">${fmtDur(left)}</b>` })}</p>
      <div class="bar"><i id="growBar" style="width:${cropProgress(g) * 100}%"></i></div>
      <p class="muted gap-top">${t('never_wilts')}</p></div>
      <button class="btn block" data-act="close">${t('ok')}</button>`;
  }
  const owned = Object.entries(CROPS).filter(([k]) => S.seeds[k] > 0);
  const left = actionsLeft();
  const list = owned.length ? owned.map(([k, c]) => `<div class="list-item"><span class="big-emoji">${c.emoji}</span>
      <div class="grow"><b>${t('crop_' + k)}</b> <span class="muted">×${S.seeds[k]}</span>
      <div class="cost">${t('grows_in', { d: fmtDur(c.grow) })} · ${t('sells_for', { n: c.sell })}</div></div>
      <button class="btn primary small" data-act="plant" data-arg="${k}" ${left ? '' : 'disabled'}>${t('plant')}</button></div>`).join('')
    : `<p class="muted">${t('no_seeds')}</p>`;
  return `<h2>🌱 ${t('plant_title')}</h2><p class="muted">${t('build_left', { n: left, cap: ACTION_CAP })}</p>
    <div class="card">${list}</div>`;
}

function sheetFriend(id) {
  const f = friendById(id);
  const liked = S.today.liked[id];
  const status = f.shareGoal ? (f.goalToday ? `✅ ${t('f_goal_done')}` : `⏳ ${t('f_goal_not_yet')}`) : `🔒 ${t('f_private')}`;
  const gifts = [];
  Object.entries(CROPS).forEach(([k, c]) => { if (S.crops[k] > 0) gifts.push([`${id}|crop|${k}`, `1 ${c.emoji}`]); });
  if (S.coins >= 10) gifts.push([`${id}|coins|`, '🪙10']);
  if (S.wood >= 2) gifts.push([`${id}|wood|`, '🪵2']);
  return `<div class="row">${avatarDot(f.color, 'xl')}<div><h2>${t('visiting', { name: esc(fname(f)) })}</h2>
      <div class="muted">${HOUSE_EMOJI[f.house]} Lv${f.house} ${t('house_' + f.house)} · ❤️ ${f.likes}</div></div></div>
    <div class="card gap-top"><div>${status}</div><p class="muted">${t('goal_privacy_hint')}</p></div>
    <div class="card"><div class="row between"><h3>❤️ ${t('like_home')}</h3>
      <button class="btn small ${liked ? '' : 'primary'}" data-act="like" data-arg="${id}" ${liked ? 'disabled' : ''}>${liked ? t('liked') : t('like')}</button></div></div>
    <div class="card"><h3>💬 ${t('leave_msg')}</h3>
      ${MSG_KEYS.map(k => `<button class="chip" data-act="msg" data-arg="${id}|${k}">${t(k)}</button>`).join('')}</div>
    <div class="card"><h3>🎁 ${t('send_gift')}</h3>
      ${gifts.length ? gifts.map(([a, l]) => `<button class="chip" data-act="gift" data-arg="${a}">${l}</button>`).join('') : `<p class="muted">${t('no_gifts')}</p>`}
      <p class="muted">${t('social_free')}</p></div>`;
}

function sheetInvite() {
  const code = S.created.toString(36).slice(-6);
  return `<h2>🪧 ${t('invite_title')}</h2><p class="muted">${t('invite_desc')}</p>
    <div class="invite-link">https://mirror.town/join/${code}</div>
    <button class="btn primary block" data-act="copyInvite">${t('copy_link')}</button>
    <p class="muted gap-top">${t('invite_note')}</p>`;
}

function sheetCap() {
  return `<div class="center"><div class="big-emoji xl">🌙</div><h2>${t('cap_heading')}</h2>
    <p class="cap-text">${t('cap_text')}</p>
    <button class="btn primary block gap-top" data-act="close">${t('cap_ok')}</button></div>`;
}

// ---------- console (prototype-only controls) ----------
function renderConsole() {
  const el = $('#console');
  if (!S) { el.innerHTML = `<div class="console-head"><b>🛠 ${t('console_title')}</b></div><p class="muted">${t('console_wait')}</p>`; return; }
  const b = (act, arg, label) => `<button class="btn small" data-act="${act}" data-arg="${arg}">${label}</button>`;
  el.innerHTML = `
    <div class="console-head"><b>🛠 ${t('console_title')}</b><button class="x" data-act="consoleClose">✕</button></div>
    <p class="muted">${t('console_desc')}</p>
    <div class="con-group"><h4>${t('con_health')}</h4>
      ${b('simSteps', 1000, '+1,000 ' + t('steps_unit'))}${b('simSteps', 3000, '+3,000 ' + t('steps_unit'))}</div>
    <div class="con-group"><h4>${t('con_screen')}</h4>
      ${b('simFocus', 30, t('offline_x', { d: fmtDur(30 * MIN) }))}${b('simFocus', 60, t('offline_x', { d: fmtDur(60 * MIN) }))}${b('simFocus', 120, t('offline_x', { d: fmtDur(120 * MIN) }))}
      ${b('simDistract', 20, t('distract_btn'))}</div>
    <div class="con-group"><h4>${t('con_time')}</h4>
      <div class="muted">${t('sim_time')}: <b id="conTime">${fmtDate(now())}</b></div>
      ${b('simHour', '', t('ff_hour'))}${b('simDay', '', t('next_day'))}</div>
    <div class="con-group"><h4>${t('con_friends')}</h4>
      ${b('simEvent', '', t('sim_friend_event'))}${b('simJoin', '', t('sim_join'))}</div>
    <div class="con-group"><h4>${t('con_widget')}</h4><div id="widget"></div></div>
    <div class="con-group"><button class="btn small danger" data-act="reset">${t('reset')}</button></div>`;
  renderWidget();
}
// Lock-screen widget mock: shows the latest social event, the main re-entry point.
function renderWidget() {
  const el = $('#widget');
  if (!el || !S) return;
  const last = [...S.feed].reverse().find(i => i.kind !== 'goal');
  const ripe = S.garden.filter(g => g && cropProgress(g) >= 1).length;
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
  if (checkDay()) {
    snack(t('snack_new_day'));
    for (let k = 0; k < events; k++) if (Math.random() < 0.7) notify(randomFriendEvent());
    if (S.pending.length) { UI.welcome = true; openSheet('collect'); }
  } else {
    snack(t('snack_ff'));
    if (Math.random() < 0.6) notify(randomFriendEvent());
  }
}

const ACT = {
  tab: a => setTab(a),
  collect: () => openSheet('collect'),
  collectAll() {
    if (!S.pending.length) return;
    const r = sumRewards(S.pending);
    addReward(r); S.pending = [];
    closeSheet();
    Town.floatAtPlot(plotIndexOf('me'), rewardText(r));
  },
  close: () => closeSheet(),
  home() { setTab('town'); Town.centerOnPlot(plotIndexOf('me')); },
  upgrade: () => result(upgradeHouse(), () => {
    snack(t('snack_upgraded', { name: t('house_' + S.house) }));
    Town.floatAtPlot(plotIndexOf('me'), `🎉 Lv${S.house}`);
  }),
  deco: id => result(buyDeco(id), () => snack(t('snack_deco', { e: DECOS.find(d => d.id === id).emoji }))),
  buySeed: c => result(buySeed(c), () => snack(t('snack_seed', { e: CROPS[c].emoji }))),
  sell: c => result(sellCrop(c), () => snack(`+🪙${CROPS[c].sell}`)),
  plant(c) {
    const i = UI.sheet.arg;
    result(plant(i, c), () => { if (UI.sheet && UI.sheet.type !== 'cap') closeSheet(); Town.floatAtGarden(i, '🌱'); });
  },
  visit(id) { setTab('town'); Town.centerOnPlot(plotIndexOf(id), true, 0.24); openSheet('friend', id); },
  like(id) { if (likeFriend(id)) { Town.floatAtPlot(plotIndexOf(id), '❤️'); snack(t('snack_liked')); } },
  msg(arg) {
    const [id] = arg.split('|');
    snack(t('snack_msg', { name: fname(friendById(id)) }));
    Town.floatAtPlot(plotIndexOf(id), '💬');
    maybeReply(id, 'msg');
  },
  gift(arg) {
    const [id, type, crop] = arg.split('|');
    if (!giveGift(id, type, crop)) return;
    Town.floatAtPlot(plotIndexOf(id), '🎁');
    snack(t('snack_gift', { name: fname(friendById(id)) }));
    maybeReply(id, 'gift');
  },
  invite: () => openSheet('invite'),
  copyInvite() {
    const link = $('.invite-link').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(
      () => snack(t('snack_copied')), () => snack(link));
  },
  claim(id) { const g = claimGift(id); if (g) snack(t('snack_claimed', { gift: giftText(g) })); },
  restDay() { if (setRestDay()) snack(t('snack_rest')); },
  share() { S.shareGoal = !S.shareGoal; },
  lang(l) { S.lang = l; document.documentElement.lang = l; },
  reset() { if (confirm(t('reset_confirm'))) { localStorage.removeItem(STORAGE_KEY); location.reload(); } },
  simSteps(n) { const r = recordSteps(+n); snack(r === 'goal' ? t('snack_goal') : t('snack_steps', { n: fmtNum(+n) })); },
  simFocus(n) { recordFocus(+n); snack(t('snack_focus', { d: fmtDur(n * MIN) })); },
  simDistract(n) { recordDistract(+n); snack(t('snack_distract')); },
  simHour() { S.timeOffset += HOUR; afterTimeJump(1); },
  simDay() { S.timeOffset += DAY; afterTimeJump(3); },
  simEvent() { notify(randomFriendEvent()); },
  simJoin() { const it = inviteJoin(); if (it) notify(it); else snack(t('snack_full')); },
  consoleToggle() { $('#console').classList.toggle('open'); },
  consoleClose() { $('#console').classList.remove('open'); },
  hintOk() { S.seenHint = true; },
};

function onTownHit(h) {
  if (h.kind === 'bubble') return openSheet('collect');
  if (h.kind === 'garden') {
    const g = S.garden[h.i];
    if (g && cropProgress(g) >= 1) {
      const c = harvest(h.i);
      Town.floatAtGarden(h.i, `+1 ${CROPS[c].emoji}`);
      snack(t('snack_harvest', { e: CROPS[c].emoji }));
      return refresh();
    }
    return openSheet('garden', h.i);
  }
  const p = S.plots[h.plot];
  if (p.owner === 'me') return openSheet('house');
  if (!p.owner) return openSheet('invite');
  Town.centerOnPlot(h.plot, true, 0.24);
  openSheet('friend', p.owner);
}

function setTab(tab) {
  UI.tab = tab;
  if (tab === 'feed') S.feed.forEach(i => { i.read = true; });
  Town.setVisible(tab === 'town');
}

function refresh() {
  if (!S) return;
  if (UI.tab === 'feed') S.feed.forEach(i => { i.read = true; });
  save();
  renderHUD(); renderTabbar(); renderPanel(); renderConsole(); renderSheet();
}

// ---------- onboarding ----------
function renderOnboarding() {
  const el = $('#onboard');
  const langs = `<div class="ob-lang"><button class="chip ${OB.lang === 'zh' ? 'on' : ''}" data-act="obLang" data-arg="zh">中文</button>
    <button class="chip ${OB.lang === 'en' ? 'on' : ''}" data-act="obLang" data-arg="en">English</button></div>`;
  const dots = `<div class="ob-dots">${[0, 1, 2].map(i => `<i class="${i === OB.step ? 'on' : ''}"></i>`).join('')}</div>`;
  if (OB.step === 0) {
    el.innerHTML = `${langs}<div class="ob-body"><div class="ob-hero">🏡</div><h1>${t('app_name')}</h1>
      <p class="ob-tag">${t('tagline')}</p>
      <ul class="ob-points"><li>🚶 ${t('ob_p1')}</li><li>📵 ${t('ob_p2')}</li><li>👥 ${t('ob_p3')}</li></ul></div>
      ${dots}<button class="btn primary block" data-act="obNext">${t('ob_start')}</button>`;
  } else if (OB.step === 1) {
    el.innerHTML = `<div class="ob-body"><h2>${t('ob_you')}</h2>
      <div class="ob-preview">${avatarDot(OB.color, 'xxl')}</div>
      <input id="obName" class="input" maxlength="12" placeholder="${t('ob_name_ph')}" value="${esc(OB.name)}">
      <div class="swatches">${COLORS.map(c => `<button class="swatch ${c === OB.color ? 'on' : ''}" style="background:${c}" data-act="obColor" data-arg="${c}"></button>`).join('')}</div>
      <p class="muted center">${t('ob_look_note')}</p></div>
      ${dots}<button class="btn primary block" data-act="obNext">${t('next')}</button>`;
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
  obColor(c) { OB.color = c; renderOnboarding(); },
  obApp(id) { OB.apps = OB.apps.includes(id) ? OB.apps.filter(x => x !== id) : [...OB.apps, id]; renderOnboarding(); },
  obLimit(m) { OB.limit = +m; renderOnboarding(); },
  obDone() {
    newGame({ lang: OB.lang, name: OB.name.trim() || t('default_name'), color: OB.color, apps: OB.apps, limitMin: OB.limit });
    OB = null;
    $('#onboard').hidden = true;
    start();
  },
});

// ---------- boot ----------
function start() {
  document.documentElement.lang = S.lang;
  checkDay();
  setTab('town');
  refresh();
  if (S.pending.length) { UI.welcome = true; openSheet('collect'); }
  if (!S.welcomed) {
    S.welcomed = true;
    setTimeout(() => {
      notify(addFeed({ kind: 'gift', from: 'wang', msgKey: 'welcome', gift: { type: 'seed', crop: 'tomato', n: 2 } }));
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

Town.init($('#town'), onTownHit);
setInterval(() => {
  if (!S) return;
  if (checkDay()) { snack(t('snack_new_day')); refresh(); }
  const clock = $('#clock'); if (clock) clock.textContent = fmtClock(now());
  const ct = $('#conTime'); if (ct) ct.textContent = fmtDate(now());
  renderWidget();
  if (UI.sheet && UI.sheet.type === 'garden') {
    const g = S.garden[UI.sheet.arg];
    if (!g || cropProgress(g) >= 1) renderSheet();
    else { $('#growLeft').textContent = fmtDur(CROPS[g.crop].grow - (now() - g.at)); $('#growBar').style.width = cropProgress(g) * 100 + '%'; }
  }
}, 1000);
// Friends stay active in the background, but rarely (no spam).
setInterval(() => {
  if (!S || document.hidden || Math.random() > 0.5) return;
  notify(randomFriendEvent()); refresh();
}, 45000);

if (load()) start();
else {
  OB = { step: 0, name: '', color: COLORS[4], apps: ['tiktok', 'instagram'], limit: 60,
         lang: (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en' };
  document.documentElement.lang = OB.lang;
  $('#onboard').hidden = false;
  renderOnboarding(); renderConsole();
}
