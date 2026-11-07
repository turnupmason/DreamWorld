'use strict';
// Music and sound effects, all made in code with the Web Audio API: no sound files to download or license.
// Music: a gentle generated tune (warm chords, soft bass, music-box melody) that is livelier by day and slower at night.
// Ambience: rain and thunder follow the weather, birds sing on clear days. Phones only allow sound after the first tap.

const Sound = (() => {
  let ac = null, master, music, sfx, verb, musicOn = true, sfxOn = true, running = false;
  let nextBeat = 0, beat = 0, night = false, weather = 'clear', rain = null, birdAt = 0, lastMotif = [], scene = 'home';
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  // Each place has its own tune: chords (MIDI notes), tempo, the instrument that plays the melody, how busy it is.
  const THEMES = {
    home:   { prog: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], bpm: 82, lead: 'bell', busy: 0.6, pad: 0.045 },                    // C Am F G, music box
    town:   { prog: [[53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64]], bpm: 96, lead: 'marimba', busy: 0.7, pad: 0.035, bass: 'walk' },    // F G Em Am, marimba
    inside: { prog: [[60, 64, 67, 71], [53, 57, 60, 64], [57, 60, 64, 67], [55, 59, 62, 65]], bpm: 70, lead: 'piano', busy: 0.45, pad: 0.04 }, // Cmaj7 Fmaj7 Am7 G7, soft piano
    shop:   { prog: [[60, 64, 67], [53, 57, 60], [55, 59, 62], [60, 64, 67]], bpm: 108, lead: 'pluck', busy: 0.75, pad: 0.03, bass: 'bounce' },  // C F G C, bouncy
    world:  { prog: [[50, 57, 62], [55, 59, 62], [52, 57, 60], [57, 61, 64]], bpm: 76, lead: 'bell', busy: 0.4, pad: 0.06 },                    // D G Am A, wide and calm
  };
  const NIGHT = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Am F C G: every place goes slow and soft at night
  const PENTA = [0, 2, 4, 7, 9];                                            // major pentatonic over C

  function init() {
    if (ac) return true;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return false;
    ac = new A();
    master = ac.createGain(); master.gain.value = 0.85; master.connect(ac.destination);
    verb = ac.createConvolver(); verb.buffer = impulse(2.6, 2.4);
    const wet = ac.createGain(); wet.gain.value = 0.32; verb.connect(wet); wet.connect(master);
    music = ac.createGain(); music.gain.value = musicOn ? 0.3 : 0; music.connect(master); music.connect(verb);
    sfx = ac.createGain(); sfx.gain.value = sfxOn ? 0.55 : 0; sfx.connect(master);
    const sv = ac.createGain(); sv.gain.value = 0.18; sfx.connect(sv); sv.connect(verb);
    return true;
  }
  function impulse(sec, decay) {
    const n = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) { const n = ac.sampleRate * 2; noiseBuf = ac.createBuffer(1, n, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  // One note: oscillator → envelope → bus.
  function tone(bus, f, t, dur, { type = 'sine', vol = 0.1, attack = 0.005, release = dur, glide = 0, filter = 0, detune = 0 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * glide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    let node = o;
    if (filter) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = filter; o.connect(lp); node = lp; }
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(t + attack + release + 0.05);
  }
  function burst(bus, t, dur, { vol = 0.2, type = 'lowpass', freq = 800, q = 0.7, sweep = 0 } = {}) {
    const s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // A music-box note: bright sine with a quieter octave, ringing out.
  function bell(f, t, vol = 0.08, len = 1.1) { tone(music, f, t, len, { vol, attack: 0.004 }); tone(music, f * 2, t, len * 0.6, { vol: vol * 0.28, attack: 0.004 }); }
  // Other melody voices: a woody marimba, a soft piano, a short pluck.
  function voice(kind, f, t, vol, len) {
    if (kind === 'bell') return bell(f, t, vol, len);
    if (kind === 'marimba') { tone(music, f, t, 0.35, { vol: vol * 1.1, attack: 0.003 }); tone(music, f * 4, t, 0.06, { vol: vol * 0.25, attack: 0.002 }); return; }
    if (kind === 'piano') { tone(music, f, t, len * 1.3, { type: 'triangle', vol: vol * 0.9, attack: 0.006, filter: 1800 }); tone(music, f * 2, t, len * 0.5, { vol: vol * 0.2, attack: 0.006 }); return; }
    tone(music, f, t, 0.22, { type: 'triangle', vol, attack: 0.002, filter: 2600 });   // pluck
  }

  // ---------- music ----------
  function scheduleBeat(t) {
    const th = THEMES[scene] || THEMES.home, prog = night ? NIGHT : th.prog, bar = Math.floor(beat / 4), b = beat % 4, chord = prog[bar % 4];
    const spb = 60 / (night ? Math.min(66, th.bpm * 0.75) : th.bpm), lead = night ? 'bell' : th.lead;
    if (b === 0) {
      chord.forEach((n, i) => tone(music, midi(n), t, spb * 3.6, { type: 'triangle', vol: night ? 0.035 : th.pad, attack: 0.8, release: spb * 3, filter: night ? 900 : 1400, detune: i * 3 - 3 }));
      tone(music, midi(chord[0] - 12), t, spb * 1.6, { vol: 0.11, attack: 0.02, filter: 500 });
      if (bar % 4 === 0) lastMotif = Array.from({ length: 8 }, () => Math.random() < (night ? 0.35 : th.busy));
    }
    if (b === 2) tone(music, midi(chord[2] - 12), t, spb * 1.4, { vol: 0.07, attack: 0.02, filter: 500 });
    if (!night && th.bass === 'walk' && (b === 1 || b === 3)) tone(music, midi(chord[1] - 12), t, spb * 0.8, { vol: 0.06, attack: 0.01, filter: 600 });
    if (!night && th.bass === 'bounce') tone(music, midi(chord[b % 2 ? 2 : 0] - 12), t + spb / 2, spb * 0.3, { vol: 0.05, attack: 0.005, filter: 700 });
    // melody on eighth notes, a rhythm that repeats each phrase so it sounds like a tune, notes from the chord / pentatonic
    for (let h = 0; h < 2; h++) {
      if (!lastMotif[(b * 2 + h) % 8]) continue;
      const pool = Math.random() < 0.6 ? chord.map(n => n + 12) : PENTA.map(p => 72 + p + (night ? -3 : 0));
      const n = pool[Math.floor(Math.random() * pool.length)];
      voice(lead, midi(n), t + h * spb / 2, night ? 0.05 : 0.07, night ? 1.6 : 1.1);
    }
    if (!night && b === 3 && Math.random() < 0.12) bell(midi(chord[1] + 24), t + spb / 2, 0.03, 1.8);
    return spb;
  }
  function tick() {
    if (!running) return;
    const now = ac.currentTime;
    if (musicOn) { if (nextBeat < now) nextBeat = now + 0.05; while (nextBeat < now + 0.6) { const spb = scheduleBeat(nextBeat); nextBeat += spb; beat++; } }
    // birds on clear days
    if (sfxOn && !night && (weather === 'clear' || weather === 'clouds') && now > birdAt) {
      birdAt = now + 5 + Math.random() * 10;
      const f = 2600 + Math.random() * 1200;
      for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) tone(sfx, f, now + k * 0.12, 0.08, { vol: 0.025, glide: 1.25 });
    }
  }
  function setRain(on, heavy) {
    if (!ac) return;
    if (on && !rain) {
      const s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.loop = true; f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 0.4;
      g.gain.value = 0; g.gain.setTargetAtTime(heavy ? 0.09 : 0.055, ac.currentTime, 1.5);
      s.connect(f); f.connect(g); g.connect(sfx); s.start();
      rain = { s, g };
    } else if (!on && rain) { rain.g.gain.setTargetAtTime(0, ac.currentTime, 1); const r = rain; setTimeout(() => r.s.stop(), 4000); rain = null; }
  }

  // ---------- sound effects ----------
  const FX = {
    tap: t => tone(sfx, 880, t, 0.05, { type: 'triangle', vol: 0.04 }),
    pop: t => { tone(sfx, 420, t, 0.12, { vol: 0.14, glide: 2.2 }); burst(sfx, t, 0.05, { vol: 0.05, type: 'highpass', freq: 3000 }); },
    coins: t => [1319, 1568, 2093].forEach((f, i) => { tone(sfx, f, t + i * 0.07, 0.35, { vol: 0.08 }); tone(sfx, f * 2.01, t + i * 0.07, 0.2, { vol: 0.02 }); }),
    buy: t => { [988, 1319].forEach((f, i) => tone(sfx, f, t + i * 0.09, 0.4, { vol: 0.09 })); burst(sfx, t, 0.06, { vol: 0.04, type: 'highpass', freq: 5000 }); },
    plant: t => { burst(sfx, t, 0.14, { vol: 0.12, freq: 400 }); tone(sfx, 160, t, 0.12, { vol: 0.08, glide: 0.6 }); },
    step: t => burst(sfx, t, 0.05, { vol: 0.07, freq: 700 }),
    door: t => { tone(sfx, 180, t, 0.12, { vol: 0.12, glide: 0.7, filter: 800 }); tone(sfx, 150, t + 0.1, 0.14, { vol: 0.1, glide: 0.7, filter: 800 }); burst(sfx, t, 0.3, { vol: 0.03, freq: 1200, sweep: 0.3 }); },
    bark: t => [0, 0.2].forEach(d => { tone(sfx, 420, t + d, 0.13, { type: 'sawtooth', vol: 0.09, glide: 0.55, filter: 1400 }); burst(sfx, t + d, 0.08, { vol: 0.06, type: 'bandpass', freq: 900, q: 2 }); }),
    sneak: t => { tone(sfx, 660, t, 0.08, { type: 'triangle', vol: 0.06 }); tone(sfx, 990, t + 0.08, 0.1, { type: 'triangle', vol: 0.05 }); },
    chime: t => [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(sfx, f, t + i * 0.08, 0.9, { vol: 0.06 })),
    build: t => [0, 0.16, 0.32].forEach(d => { burst(sfx, t + d, 0.06, { vol: 0.12, type: 'bandpass', freq: 1800, q: 3 }); tone(sfx, 300, t + d, 0.05, { vol: 0.06 }); }),
    paper: t => burst(sfx, t, 0.25, { vol: 0.05, type: 'highpass', freq: 2500, sweep: 1.6 }),
    splash: t => { burst(sfx, t, 0.35, { vol: 0.12, type: 'bandpass', freq: 1200, q: 0.8, sweep: 0.4 }); tone(sfx, 600, t, 0.15, { vol: 0.05, glide: 0.4 }); },
    thunder: t => { burst(sfx, t, 2.2, { vol: 0.35, freq: 300, sweep: 0.2 }); burst(sfx, t + 0.15, 1.6, { vol: 0.2, freq: 120 }); },
    oops: t => tone(sfx, 220, t, 0.18, { type: 'triangle', vol: 0.07, glide: 0.7 }),
    // harvesting a crop: a leafy rustle, then two bright plucks going up
    harvest: t => { burst(sfx, t, 0.16, { vol: 0.09, type: 'bandpass', freq: 2400, q: 0.9, sweep: 0.6 }); [784, 1175].forEach((f, i) => { tone(sfx, f, t + 0.06 + i * 0.08, 0.3, { type: 'triangle', vol: 0.08 }); tone(sfx, f * 2, t + 0.06 + i * 0.08, 0.12, { vol: 0.02 }); }); },
    // planting: digging the soil (two soft scrapes), then the seed dropping in
    sow: t => { burst(sfx, t, 0.09, { vol: 0.1, freq: 500, sweep: 0.5 }); burst(sfx, t + 0.11, 0.09, { vol: 0.08, freq: 420, sweep: 0.5 }); tone(sfx, 520, t + 0.24, 0.1, { vol: 0.06, glide: 1.6 }); },
    // eggs, milk, wool: a woody two-note marimba
    collect: t => [659, 988].forEach((f, i) => { tone(sfx, f, t + i * 0.09, 0.25, { vol: 0.09, attack: 0.003 }); tone(sfx, f * 4, t + i * 0.09, 0.05, { vol: 0.02, attack: 0.002 }); }),
    // fruit off a tree: a little "pok" and a sparkle
    fruit: t => { tone(sfx, 340, t, 0.08, { vol: 0.12, glide: 0.6 }); tone(sfx, 1568, t + 0.07, 0.4, { vol: 0.04 }); tone(sfx, 2093, t + 0.12, 0.35, { vol: 0.03 }); },
    // pressing any button: a very soft tick
    tick: t => tone(sfx, 1400, t, 0.03, { type: 'triangle', vol: 0.025, attack: 0.002 }),
    // picking something in the shop: a bubbly blip
    select: t => { tone(sfx, 660, t, 0.08, { vol: 0.07, glide: 1.5 }); tone(sfx, 990, t + 0.05, 0.1, { vol: 0.05, glide: 1.3 }); },
    // pets: a happy woof or meow, lapping water, crunching food, sweeping litter
    woof: t => [0, 0.16].forEach(d => tone(sfx, 360, t + d, 0.1, { type: 'sawtooth', vol: 0.06, glide: 0.7, filter: 1200 })),
    meow: t => { tone(sfx, 620, t, 0.32, { type: 'triangle', vol: 0.07, glide: 1.25, filter: 2200 }); tone(sfx, 760, t + 0.18, 0.25, { type: 'triangle', vol: 0.05, glide: 0.7, filter: 2200 }); },
    lap: t => [0, 0.1, 0.2].forEach(d => burst(sfx, t + d, 0.05, { vol: 0.06, type: 'bandpass', freq: 1800, q: 2 })),
    crunch: t => [0, 0.09, 0.18].forEach(d => burst(sfx, t + d, 0.05, { vol: 0.08, type: 'highpass', freq: 1500 })),
    sweep: t => burst(sfx, t, 0.4, { vol: 0.07, type: 'bandpass', freq: 3000, q: 0.6, sweep: 0.4 }),
    levelup: t => [523, 659, 784, 1047].forEach((f, i) => tone(sfx, f, t + i * 0.1, 0.5, { type: 'triangle', vol: 0.07 })),
  };

  return {
    // Phones only allow sound after the player touches the screen, so this runs on the first tap.
    start() {
      if (!init()) return;
      if (ac.state === 'suspended') ac.resume();
      if (!running) { running = true; nextBeat = 0; setInterval(tick, 120); }
    },
    state: () => (ac ? ac.state : 'off'),
    // Which tune plays: home, town, inside, shop or world.
    setScene(s) { if (THEMES[s] && s !== scene) { scene = s; lastMotif = []; } },
    play(name) { if (!ac || !sfxOn || !FX[name]) return; try { FX[name](ac.currentTime + 0.01); } catch (e) { /* audio is optional */ } },
    setMusic(on) { musicOn = on; if (music) music.gain.setTargetAtTime(on ? 0.3 : 0, ac.currentTime, 0.4); },
    setSfx(on) { sfxOn = on; if (sfx) sfx.gain.setTargetAtTime(on ? 0.55 : 0, ac.currentTime, 0.2); if (!on) setRain(false); },
    // Called every second with the time of day and the weather.
    ambience(isNight, w) {
      night = isNight; weather = w;
      if (!ac || !running) return;
      setRain(sfxOn && (w === 'rain' || w === 'storm'), w === 'storm');
    },
  };
})();
