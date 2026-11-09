// v0.54 (Mason #29): five leagues (LEAGUES in data.js), ten teams each. A season: every team plays each of the
// others four times (36 games, one round a day at the sport's hour), then a few days off and a new season (all back
// to 0–0 and 50 / 50). Everything comes from the date, so it's the same for everyone and nothing has to be saved
// except your bets. Win chances: Elo from the games played (SEASON in data.js); the games themselves are decided by
// how good each team really is this season (hidden), so the chances shown get better as the season goes on.

const LG_CACHE = {};
const lgRand = (a, b, c = 0) => { const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return x - Math.floor(x); };
const lgDay0 = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const SPORT_KEYS = Object.keys(LEAGUES);
// v0.58: each league its own calendar: a round every `every` days (football every 4), so a season is days × every
// days long, then the break. seasonNow(t, sp): which season, which day of it, the round played today (r, or null on a
// day without games), the next round (next), whether it's the break (off) and how many days until the next season.
const lgEvery = sp => (SEASON.every || {})[sp] || 1;
const seasonLen = sp => SEASON.days * lgEvery(sp) + SEASON.rest;
function seasonNow(t = now(), sp = 'baseball') {
  const ev = lgEvery(sp), len = seasonLen(sp), d = Math.round((lgDay0(t) - SEASON.epoch) / DAY), s = Math.max(0, Math.floor(d / len)), day = d - s * len, off = day >= SEASON.days * ev;
  return { s, day, off, left: len - day, r: !off && day % ev === 0 ? day / ev : null, next: off ? 0 : Math.ceil(day / ev), every: ev };
}
const allOff = (t = now()) => SPORT_KEYS.every(k => seasonNow(t, k).off);
// local midnight of round r of season s; when its games start and end
function roundDay(s, r, sp = 'baseball') { const d = new Date(SEASON.epoch); d.setDate(d.getDate() + s * seasonLen(sp) + r * lgEvery(sp)); return d.getTime(); }
const gameStart = (sp, s, r) => roundDay(s, r, sp) + LEAGUES[sp].hour * HOUR;
const gameEnd = (sp, s, r) => gameStart(sp, s, r) + LEAGUES[sp].len * HOUR;
const homeP = p => Math.max(0.02, Math.min(0.98, p + SEASON.home));   // v0.58: the home side's chance, with its edge
// the 36 rounds: a round robin (everyone plays everyone once in 9 rounds) four times, home and away swapping;
// the teams are shuffled each season so the order isn't always the same. rounds[r] = [[home, away] × 5]
function lgRounds(sp, s) {
  const n = 10, base = [];
  let arr = [...Array(n).keys()];
  const homes = Array(n).fill(0), wasHome = Array(n).fill(false);
  for (let r = 0; r < n - 1; r++) {
    const pr = [];
    for (let i = 0; i < n / 2; i++) {   // at home: whoever has had fewer home games (then whoever was away last time), so home and away take turns
      let a = arr[i], b = arr[n - 1 - i];
      if (homes[b] < homes[a] || (homes[b] === homes[a] && wasHome[a] && !wasHome[b])) [a, b] = [b, a];
      homes[a]++; wasHome[a] = true; wasHome[b] = false; pr.push([a, b]);
    }
    base.push(pr); arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  const k = SPORT_KEYS.indexOf(sp), perm = [...Array(n).keys()].sort((x, y) => lgRand(s + 1, x, k + 1) - lgRand(s + 1, y, k + 1)), out = [];
  for (let c = 0; c < 4; c++) base.forEach(pr => out.push(pr.map(([a, b]) => (c % 2 ? [perm[b], perm[a]] : [perm[a], perm[b]]))));
  return out;
}
const eloP = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
// one sport's season, played up to now: results, each team's record, Elo ratings
function league(sp, s = seasonNow(now(), sp).s) {
  const key = sp + '|' + s, k = SPORT_KEYS.indexOf(sp);
  let L = LG_CACHE[key];
  if (!L) {
    L = LG_CACHE[key] = { sp, s, rounds: lgRounds(sp, s), elo: Array(10).fill(SEASON.start), res: [], done: 0,
      rec: Array.from({ length: 10 }, () => ({ w: 0, l: 0, pf: 0, pa: 0, last: [] })),
      strength: Array.from({ length: 10 }, (_, i) => SEASON.start + (lgRand(s, i, k + 7) + lgRand(s, i, k + 13) + lgRand(s, i, k + 19) - 1.5) * SEASON.spread * 2) };
  }
  const t = now();
  while (L.done < SEASON.days && gameEnd(sp, s, L.done) <= t) { playRound(L, L.done); L.done++; }
  return L;
}
// how a game ends: decided by how good the two teams really are (not by the chances shown), so it can be worked out
// before the game is over (the stadium uses it to show the score going up as the game goes on: v0.55)
function gameResult(L, r, g) {
  const k = SPORT_KEYS.indexOf(L.sp), [h, a] = L.rounds[r][g], pReal = homeP(eloP(L.strength[h], L.strength[a]));   // (v0.58: the home edge, +3 %)
  const hw = lgRand(L.s * 101 + r, g, k + 3) < pReal, sc = lgScore(L.sp, L.s, r, g), [hs, as] = hw ? sc : [sc[1], sc[0]];
  return { h, a, hs, as, hw, note: sc[2] || '' };
}
function playRound(L, r) {
  L.res[r] = L.rounds[r].map(([h, a], g) => {
    const pShown = homeP(eloP(L.elo[h], L.elo[a])), { hw, hs, as, note } = gameResult(L, r, g);
    const d = SEASON.k * ((hw ? 1 : 0) - pShown); L.elo[h] += d; L.elo[a] -= d;
    [[h, hw, hs, as], [a, !hw, as, hs]].forEach(([i, w, f, ag]) => { const R2 = L.rec[i]; if (w) R2.w++; else R2.l++; R2.pf += f; R2.pa += ag; R2.last.push(w ? 'W' : 'L'); });
    return { h, a, hs, as, hw, p: pShown, note };
  });
}
// a winning and a losing score that look like the sport [winner, loser, note]: soccer can go to penalties, hockey to overtime
function lgScore(sp, s, r, g) {
  const q = n => lgRand(s * 7 + r + 1, g + 1, n);
  if (sp === 'football') { const pts = [3, 6, 7, 10, 13, 14, 16, 17, 20, 21, 23, 24, 27, 28, 30, 31, 34, 35, 38, 42], w = pts[4 + Math.floor(q(1) * 16)], lo = pts.filter(x => x < w); return [w, lo[Math.floor(q(2) * lo.length)] || 0]; }
  if (sp === 'soccer') { if (q(3) < 0.18) { const e = Math.floor(q(2) * 3); return [e, e, 'pen']; } const w = 1 + Math.floor(q(1) * 3.2); return [w, Math.floor(q(2) * w)]; }
  if (sp === 'baseball') { const w = 2 + Math.floor(q(1) * 8); return [w, Math.floor(q(2) * w)]; }
  if (sp === 'hockey') { if (q(3) < 0.2) { const e = 1 + Math.floor(q(2) * 4); return [e + 1, e, 'ot']; } const w = 2 + Math.floor(q(1) * 4); return [w, Math.floor(q(2) * w)]; }
  const w = 92 + Math.floor(q(1) * 36); return [w, w - 1 - Math.floor(q(2) * 20)];
}
// the table: most wins first, then points for minus against
function standings(sp) {
  const L = league(sp);
  return L.rec.map((R2, i) => ({ i, ...R2, elo: L.elo[i], streak: streakOf(R2.last) })).sort((a, b) => b.w - a.w || a.l - b.l || (b.pf - b.pa) - (a.pf - a.pa) || b.elo - a.elo);
}
function streakOf(last) { if (!last.length) return ''; const c = last[last.length - 1]; let n = 0; for (let i = last.length - 1; i >= 0 && last[i] === c; i--) n++; return c + n; }
// a round's games with where they stand: 'soon' (you can bet), 'live', 'done' (with the score)
function roundGames(sp, r, s = seasonNow(now(), sp).s) {
  const L = league(sp, s), t = now(), st = gameStart(sp, s, r), en = gameEnd(sp, s, r);
  return (L.rounds[r] || []).map(([h, a], g) => {
    const res = L.res[r] && L.res[r][g], p = res ? res.p : homeP(eloP(L.elo[h], L.elo[a]));
    return { sp, s, r, g, h, a, p, start: st, end: en, state: res ? 'done' : t >= st ? 'live' : 'soon', res };
  });
}
const todayGames = sp => { const si = seasonNow(now(), sp); return si.r === null ? [] : roundGames(sp, si.r, si.s); };   // (v0.58: [] on a day between rounds)
// the price of a bet on one side of a game (decimal odds)
const betOdds = p => Math.max(BETS.minOdds, Math.round((1 - BETS.margin) / Math.max(0.02, p) * 100) / 100);
const lgTeam = (sp, i) => LEAGUES[sp].teams[i];
function teamName(sp, i) { const T = lgTeam(sp, i), town = nm(COMMUNITIES[T.t]); return curLang() === 'zh' ? `${town}${T.zh}${/联|竞技|人$/.test(T.zh) ? '' : '队'}` : `${town} ${T.en}`; }
// ---------- bets (only game coins) ----------
function stakedToday() { const d = lgDay0(now()); return [...(S.bets || []), ...(S.betLog || [])].filter(b => lgDay0(b.t) === d).reduce((n, b) => n + b.stake, 0); }
function placeBet(sp, g, pick, stake) {
  if (S.calm) return 'calm';
  const si = seasonNow(now(), sp); if (si.r === null) return 'off';
  const G = todayGames(sp)[g]; if (!G || G.state !== 'soon') return 'closed';
  if ((S.bets || []).some(b => b.sp === sp && b.s === si.s && b.r === si.r && b.g === g)) return 'already';
  if (!(stake > 0) || S.me.coins < stake) return 'poor';
  if (stakedToday() + stake > BETS.dayMax) return 'cap';
  const p = pick === G.h ? G.p : 1 - G.p, odds = betOdds(p);
  S.me.coins -= stake;
  (S.bets = S.bets || []).push({ id: uid(), sp, s: si.s, r: si.r, g, pick, stake, odds, t: now() });
  return 'ok';
}
// games that have finished: pay out the bets that won. Returns what was settled.
function settleBets() {
  const out = [];
  if (!S.lg58) { S.lg58 = 1; (S.bets || []).filter(b => b.sp === 'football').forEach(b => { S.me.coins += b.stake; }); S.bets = (S.bets || []).filter(b => b.sp !== 'football'); }   // v0.58: football's new calendar: open football bets are given back
  (S.bets || []).slice().forEach(b => {
    const L = league(b.sp, b.s);
    if (L.done <= b.r) return;
    const res = L.res[b.r][b.g], won = (res.hw ? res.h : res.a) === b.pick, pay = won ? Math.round(b.stake * b.odds) : 0;
    S.me.coins += pay;
    const done = { ...b, won, pay, hs: res.hs, as: res.as, h: res.h, a: res.a, at: now() };
    S.bets = S.bets.filter(x => x.id !== b.id);
    (S.betLog = S.betLog || []).push(done); while (S.betLog.length > BETS.keep) S.betLog.shift();
    out.push(done);
  });
  return out;
}
// how your bets have gone overall
function betTotals() { return (S.betLog || []).reduce((o, b) => ({ n: o.n + 1, won: o.won + (b.won ? 1 : 0), net: o.net + b.pay - b.stake }), { n: 0, won: 0, net: 0 }); }
