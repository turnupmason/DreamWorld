'use strict';
// Music and sound effects, all made in code with the Web Audio API: no sound files to download or license.
// v0.56 (Mason #29: "音乐音效要好好弄，现在太单调"):
//  - Music: real little songs instead of random notes. Each place has two or three, each with a tune that comes back
//    (A A' B A' over 16 bars), chords, a bass line, drums and an accompaniment; they take turns. Towns sound like their
//    country (an accordion waltz in Provence, a koto in Kyoto / Hangzhou / Seoul, bossa nova in Rio and the Andes); the
//    cafe and the hotel are jazz, the gym and the bowling alley dance music, the funfair a waltz, the stadium an organ;
//    mornings are bright, nights are lullabies, rainy days are slow. A new place fades in at its own pace.
//  - Ambience (its own volume): rain and wind outdoors only; birds by day, crickets and an owl at night, a rooster in
//    the morning on the farm, your animals, cars going by in town; inside: the chatter of a cafe, cups, a clock in the
//    library, pins in the bowling alley, splashes at the pool, trains at the station, animals at the zoo, and the
//    stadium crowd, which gets louder when there's a chance and roars at a goal.
//  - Effects: many more (a message coming in, the door bell, the lift, eating, drinking, a whistle, a goal horn, the
//    crack of the bat, the farm animals...). Phones only allow sound after the first tap.

const Sound = (() => {
  let ac = null, master, musicOut, musicFade, sfx, amb, verb, running = false;
  let musicOn = true, sfxOn = true, ambOn = true, ducked = false;
  const VOL = { music: 0.8, sfx: 0.8, amb: 0.8 };
  let scene = 'home', place = null, folk = 'us', night = false, hour = 12, weather = 'clear', snow = false, farm = [];
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  const R = () => Math.random();
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function init() {
    if (ac) return true;
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return false;
    ac = new A();
    master = ac.createGain(); master.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; master.connect(comp); comp.connect(ac.destination);
    verb = ac.createConvolver(); verb.buffer = impulse(2.4, 2.6);
    const wet = ac.createGain(); wet.gain.value = 0.28; verb.connect(wet); wet.connect(master);
    musicFade = ac.createGain(); musicFade.gain.value = 1;
    musicOut = ac.createGain(); musicFade.connect(musicOut); musicOut.connect(master);
    const mv = ac.createGain(); mv.gain.value = 0.55; musicOut.connect(mv); mv.connect(verb);
    sfx = ac.createGain(); sfx.connect(master);
    const sv = ac.createGain(); sv.gain.value = 0.16; sfx.connect(sv); sv.connect(verb);
    amb = ac.createGain(); amb.connect(master);
    const av = ac.createGain(); av.gain.value = 0.25; amb.connect(av); av.connect(verb);
    levels(0);
    return true;
  }
  // the three volumes (0 … 1 each, from the settings) and the on / off switches
  function levels(tc = 0.3) {
    if (!ac) return;
    const t = ac.currentTime;
    musicOut.gain.setTargetAtTime(musicOn ? VOL.music * (ducked ? 0.25 : 1.35) : 0, t, tc || 0.01);
    sfx.gain.setTargetAtTime(sfxOn ? VOL.sfx * 1.2 : 0, t, tc || 0.01);
    amb.gain.setTargetAtTime(ambOn ? VOL.amb * 1.1 : 0, t, tc || 0.01);
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
  // One note: oscillator → (filter) → envelope → bus. vib: vibrato depth in cents; fenv: the filter opens from
  // `filter` to filter × fenv and back (brass)
  function tone(bus, f, t, dur, { type = 'sine', vol = 0.1, attack = 0.005, release = dur, glide = 0, filter = 0, detune = 0, vib = 0, vibRate = 5.5, fenv = 0, q = 0.7 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * glide), t + dur);
    if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = vibRate; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(vib, t + Math.min(0.3, dur * 0.5)); l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + attack + release + 0.1); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    let node = o;
    if (filter) {
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = q; lp.frequency.setValueAtTime(filter, t);
      if (fenv) { lp.frequency.exponentialRampToValueAtTime(filter * fenv, t + attack + 0.04); lp.frequency.exponentialRampToValueAtTime(filter, t + attack + release * 0.7); }
      o.connect(lp); node = lp;
    }
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(t + attack + release + 0.05);
  }
  function burst(bus, t, dur, { vol = 0.2, type = 'lowpass', freq = 800, q = 0.7, sweep = 0, attack = 0 } = {}) {
    const s = noise(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); } else g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random()); s.stop(t + attack + dur + 0.05);
  }

  // ---------- instruments (for the music) ----------
  const M = () => musicFade;
  const INST = {
    bell: (f, t, v, len) => { tone(M(), f, t, len, { vol: v, attack: 0.004 }); tone(M(), f * 2, t, len * 0.6, { vol: v * 0.28, attack: 0.004 }); },
    celesta: (f, t, v, len) => { tone(M(), f * 2, t, len * 0.8, { vol: v * 0.8, attack: 0.003 }); tone(M(), f * 4, t, len * 0.3, { vol: v * 0.18, attack: 0.003 }); },
    marimba: (f, t, v) => { tone(M(), f, t, 0.38, { vol: v * 1.1, attack: 0.003 }); tone(M(), f * 4, t, 0.06, { vol: v * 0.25, attack: 0.002 }); },
    piano: (f, t, v, len) => { tone(M(), f, t, len * 1.3, { type: 'triangle', vol: v * 0.9, attack: 0.006, filter: 2000 }); tone(M(), f * 2, t, len * 0.5, { vol: v * 0.22, attack: 0.006 }); },
    epiano: (f, t, v, len) => { tone(M(), f, t, len * 1.4, { vol: v, attack: 0.008, vib: 6, vibRate: 4 }); tone(M(), f * 2, t, len * 0.35, { vol: v * 0.3, attack: 0.004 }); tone(M(), f * 7, t, 0.04, { vol: v * 0.05, attack: 0.002 }); },
    pluck: (f, t, v) => tone(M(), f, t, 0.24, { type: 'triangle', vol: v, attack: 0.002, filter: 2800 }),
    guitar: (f, t, v, len) => { tone(M(), f, t, Math.min(1.4, len * 1.5), { type: 'triangle', vol: v, attack: 0.003, filter: 2400, fenv: 1.6 }); tone(M(), f * 2, t, 0.25, { vol: v * 0.25, attack: 0.003 }); },
    koto: (f, t, v, len) => { tone(M(), f * 1.015, t, Math.min(1.6, len * 1.6), { type: 'triangle', vol: v, attack: 0.002, glide: 0.985, filter: 3200 }); tone(M(), f * 3, t, 0.12, { vol: v * 0.12, attack: 0.002 }); },
    harp: (f, t, v, len) => { tone(M(), f, t, Math.min(2, len * 2), { type: 'triangle', vol: v * 0.9, attack: 0.003, filter: 3000 }); tone(M(), f * 2, t, 0.5, { vol: v * 0.15, attack: 0.003 }); },
    flute: (f, t, v, len) => { tone(M(), f, t, len, { vol: v, attack: 0.06, release: len, vib: 14, vibRate: 5 }); burst(M(), t, 0.08, { vol: v * 0.15, type: 'bandpass', freq: f * 2, q: 3 }); },
    whistle: (f, t, v, len) => tone(M(), f * 2, t, len, { vol: v * 0.7, attack: 0.03, release: len, vib: 18, vibRate: 6 }),
    clarinet: (f, t, v, len) => tone(M(), f, t, len, { type: 'square', vol: v * 0.45, attack: 0.03, release: len, filter: 1300, vib: 8 }),
    accordion: (f, t, v, len) => { tone(M(), f, t, len, { type: 'sawtooth', vol: v * 0.32, attack: 0.03, release: len, filter: 2200, detune: -9 }); tone(M(), f, t, len, { type: 'square', vol: v * 0.22, attack: 0.03, release: len, filter: 2200, detune: 9 }); },
    organ: (f, t, v, len) => [1, 2, 3, 4].forEach((h, i) => tone(M(), f * h, t, len, { vol: v * [0.55, 0.35, 0.2, 0.1][i], attack: 0.01, release: len * 0.9, vib: 7, vibRate: 6.5 })),
    calliope: (f, t, v, len) => { tone(M(), f, t, len, { vol: v * 0.8, attack: 0.02, release: len, vib: 25, vibRate: 7 }); tone(M(), f * 2, t, len, { type: 'square', vol: v * 0.08, attack: 0.02, release: len * 0.8, filter: 2500 }); },
    synth: (f, t, v, len) => { tone(M(), f, t, len, { type: 'square', vol: v * 0.32, attack: 0.005, release: len, filter: 1600, fenv: 2.2, detune: -6 }); tone(M(), f, t, len, { type: 'sawtooth', vol: v * 0.2, attack: 0.005, release: len, filter: 1600, fenv: 2.2, detune: 6 }); },
    brass: (f, t, v, len) => { tone(M(), f, t, len, { type: 'sawtooth', vol: v * 0.45, attack: 0.04, release: len, filter: 500, fenv: 4, q: 1.5 }); tone(M(), f * 1.002, t, len, { type: 'sawtooth', vol: v * 0.3, attack: 0.05, release: len, filter: 500, fenv: 3.5 }); },
    // sustained chords
    strings: (f, t, v, len) => [-7, 7].forEach(d => tone(M(), f, t, len, { type: 'sawtooth', vol: v * 0.35, attack: Math.min(0.5, len * 0.3), release: len, filter: 1300, detune: d })),
    pad: (f, t, v, len) => tone(M(), f, t, len, { type: 'triangle', vol: v, attack: Math.min(0.6, len * 0.3), release: len, filter: 1300 }),
  };
  // ---------- drums ----------
  const DR = {
    kick: (t, v) => { tone(M(), 140, t, 0.22, { vol: v, attack: 0.002, glide: 0.32 }); },
    snare: (t, v) => { burst(M(), t, 0.16, { vol: v * 0.7, type: 'bandpass', freq: 1900, q: 0.8 }); tone(M(), 190, t, 0.08, { type: 'triangle', vol: v * 0.4, glide: 0.8 }); },
    rim: (t, v) => burst(M(), t, 0.03, { vol: v, type: 'bandpass', freq: 2600, q: 6 }),
    hat: (t, v) => burst(M(), t, 0.03, { vol: v, type: 'highpass', freq: 7500 }),
    ohat: (t, v) => burst(M(), t, 0.18, { vol: v * 0.8, type: 'highpass', freq: 6500 }),
    shaker: (t, v) => burst(M(), t, 0.05, { vol: v * 0.8, type: 'bandpass', freq: 5200, q: 1.5, attack: 0.01 }),
    ride: (t, v) => { burst(M(), t, 0.3, { vol: v * 0.5, type: 'bandpass', freq: 6000, q: 2 }); tone(M(), 3100, t, 0.25, { vol: v * 0.08 }); },
    brush: (t, v) => burst(M(), t, 0.22, { vol: v * 0.6, type: 'bandpass', freq: 3200, q: 0.6, attack: 0.03, sweep: 0.6 }),
    clap: (t, v) => [0, 0.012, 0.025].forEach(d => burst(M(), t + d, 0.07, { vol: v * 0.6, type: 'bandpass', freq: 1500, q: 1.2 })),
    jingle: (t, v) => { for (let i = 0; i < 4; i++) { burst(M(), t + i * 0.012, 0.06, { vol: v * 0.5, type: 'highpass', freq: 7000 }); tone(M(), 2600 + R() * 1800, t + i * 0.012, 0.08, { vol: v * 0.05 }); } },
    tom: (t, v) => tone(M(), 120, t, 0.3, { vol: v * 0.8, glide: 0.6 }),
  };
  // per 8th-note slot (4/4: 8 slots a bar, 3/4: 6); [instrument, slots, volume]
  const BEATS = {
    none: [],
    soft: [['kick', [0], 0.16], ['rim', [4], 0.07], ['shaker', [0, 1, 2, 3, 4, 5, 6, 7], 0.035]],
    pop: [['kick', [0, 3, 4], 0.2], ['snare', [2, 6], 0.11], ['hat', [0, 1, 2, 3, 4, 5, 6, 7], 0.045]],
    swing: [['kick', [0, 4], 0.09], ['brush', [2, 6], 0.11], ['ride', [0, 2, 3, 4, 6, 7], 0.05]],
    bossa: [['kick', [0, 3, 4, 7], 0.13], ['rim', [0, 3, 6], 0.08], ['shaker', [0, 1, 2, 3, 4, 5, 6, 7], 0.04]],
    waltz: [['kick', [0], 0.15], ['hat', [2, 4], 0.06], ['shaker', [1, 3, 5], 0.025]],
    march: [['kick', [0, 2, 4, 6], 0.16], ['snare', [2, 6], 0.1], ['snare', [7], 0.05], ['hat', [1, 3, 5, 7], 0.04]],
    dance: [['kick', [0, 2, 4, 6], 0.2], ['clap', [2, 6], 0.12], ['ohat', [1, 3, 5, 7], 0.05], ['hat', [0, 2, 4, 6], 0.03]],
    gentle: [['kick', [0], 0.1], ['shaker', [2, 6], 0.03]],
  };

  // ---------- the songs ----------
  // key: the root (MIDI); sc: the scale; prog: 16 bars of chords (scale degrees, 7 for a seventh: 'I', 'vi7', ...);
  // lead / lead2 (a second voice that joins the second time round) / acc (the accompaniment: an instrument + a
  // pattern) / bass (a pattern) / beat; seed: the tune (each seed is a different tune)
  const P4 = 'I vi IV V | I vi ii V | IV V iii vi | ii V I I', P5 = 'I IV vi V | I IV V I | vi IV I V | vi IV V I', P6 = 'vi IV I V | vi IV I V | IV V I vi | IV V I I';
  const PJ = 'IV7 iii7 ii7 I7 | IV7 iii7 ii7 V7 | vi7 ii7 V7 I7 | IV7 iii7 ii7 I7', PW = 'I I V V | V V I I | IV IV I I | V V I I', PM = 'i iv VII III | VI iv V i | i iv VII III | VI iv V i';
  const SONGS = {
    home:     [{ key: 60, sc: 'maj', prog: P4, bpm: 88, lead: 'bell', lead2: 'flute', acc: ['guitar', 'broken'], bass: 'root', beat: 'soft', seed: 11 },
               { key: 65, sc: 'maj', prog: P5, bpm: 96, lead: 'whistle', lead2: 'marimba', acc: ['pluck', 'up'], bass: 'bounce', beat: 'soft', seed: 23 },
               { key: 62, sc: 'maj', prog: PW, bpm: 104, meter: 3, lead: 'marimba', lead2: 'flute', acc: ['guitar', 'waltz'], bass: 'oompah', beat: 'waltz', seed: 37 }],
    morning:  [{ key: 67, sc: 'maj', prog: P5, bpm: 100, lead: 'whistle', lead2: 'celesta', acc: ['guitar', 'broken'], bass: 'bounce', beat: 'soft', seed: 41 },
               { key: 62, sc: 'maj', prog: P4, bpm: 92, lead: 'flute', lead2: 'bell', acc: ['harp', 'up'], bass: 'root', beat: 'gentle', seed: 43 }],
    town:     [{ key: 65, sc: 'maj', prog: P4, bpm: 108, lead: 'marimba', lead2: 'whistle', acc: ['pluck', 'broken'], bass: 'walk', beat: 'pop', seed: 51 },
               { key: 60, sc: 'maj', prog: P6, bpm: 100, lead: 'clarinet', lead2: 'bell', acc: ['piano', 'alberti'], bass: 'bounce', beat: 'soft', seed: 53 },
               { key: 67, sc: 'maj', prog: P5, bpm: 116, lead: 'pluck', lead2: 'flute', acc: ['guitar', 'strum'], bass: 'root8', beat: 'pop', seed: 59 }],
    musette:  [{ key: 62, sc: 'min', prog: PM, bpm: 132, meter: 3, lead: 'accordion', lead2: 'clarinet', acc: ['guitar', 'waltz'], bass: 'oompah', beat: 'waltz', seed: 61 },
               { key: 65, sc: 'maj', prog: PW, bpm: 126, meter: 3, lead: 'accordion', lead2: 'flute', acc: ['guitar', 'waltz'], bass: 'oompah', beat: 'waltz', seed: 67 }],
    eastern:  [{ key: 62, sc: 'maj', mel: 'pent', prog: P5, bpm: 84, lead: 'koto', lead2: 'flute', acc: ['harp', 'up'], bass: 'pedal', beat: 'gentle', seed: 71 },
               { key: 64, sc: 'min', mel: 'mpent', prog: PM, bpm: 78, lead: 'flute', lead2: 'koto', acc: ['koto', 'broken'], bass: 'root', beat: 'none', seed: 73 }],
    bossa:    [{ key: 65, sc: 'maj', prog: PJ, bpm: 128, lead: 'flute', lead2: 'epiano', acc: ['guitar', 'bossa'], bass: 'bossa', beat: 'bossa', seed: 81 },
               { key: 62, sc: 'dor', prog: 'i7 IV7 i7 IV7 | i7 IV7 v7 i7 | VII7 III7 iv7 i7 | ii7 v7 i7 i7', bpm: 124, lead: 'whistle', lead2: 'marimba', acc: ['guitar', 'bossa'], bass: 'bossa', beat: 'bossa', seed: 83 }],
    night:    [{ key: 57, sc: 'min', prog: 'i VI III VII | i VI iv V | i VI III VII | iv V i i', bpm: 66, lead: 'bell', lead2: 'harp', acc: ['harp', 'up'], bass: 'pedal', beat: 'none', seed: 91 },
               { key: 60, sc: 'maj', prog: P4, bpm: 62, lead: 'celesta', lead2: 'strings', acc: ['harp', 'broken'], bass: 'pedal', beat: 'none', seed: 93 }],
    lullaby:  [{ key: 65, sc: 'maj', prog: PW, bpm: 72, meter: 3, lead: 'bell', lead2: 'celesta', acc: ['harp', 'waltz'], bass: 'pedal', beat: 'none', seed: 97 }],
    rainy:    [{ key: 57, sc: 'min', prog: 'i iv VII III | VI iv V i | i iv VII III | VI V i i', bpm: 72, lead: 'piano', lead2: 'strings', acc: ['epiano', 'broken'], bass: 'root', beat: 'gentle', seed: 101 },
               { key: 62, sc: 'dor', prog: 'i7 IV7 i7 IV7 | VII7 III7 iv7 v7 | i7 IV7 i7 IV7 | VII7 v7 i7 i7', bpm: 76, lead: 'epiano', lead2: 'flute', acc: ['piano', 'up'], bass: 'root', beat: 'soft', seed: 103 }],
    cozy:     [{ key: 60, sc: 'maj', prog: PJ, bpm: 74, lead: 'piano', lead2: 'strings', acc: ['epiano', 'broken'], bass: 'root', beat: 'none', seed: 111 },
               { key: 65, sc: 'maj', prog: P4, bpm: 80, lead: 'epiano', lead2: 'bell', acc: ['guitar', 'broken'], bass: 'root', beat: 'gentle', seed: 113 }],
    shop:     [{ key: 60, sc: 'maj', prog: P5, bpm: 112, lead: 'pluck', lead2: 'bell', acc: ['marimba', 'broken'], bass: 'bounce', beat: 'soft', seed: 121 },
               { key: 67, sc: 'maj', prog: P4, bpm: 118, lead: 'clarinet', lead2: 'whistle', acc: ['piano', 'stride'], bass: 'walk', beat: 'swing', swing: 0.3, seed: 123 },
               { key: 62, sc: 'maj', prog: P6, bpm: 106, lead: 'marimba', lead2: 'pluck', acc: ['guitar', 'strum'], bass: 'bounce', beat: 'pop', seed: 127 }],
    jazz:     [{ key: 65, sc: 'maj', prog: PJ, bpm: 112, lead: 'epiano', lead2: 'clarinet', acc: ['piano', 'stride'], bass: 'walk', beat: 'swing', swing: 0.33, seed: 131 },
               { key: 63, sc: 'maj', prog: 'ii7 V7 I7 IV7 | ii7 V7 I7 vi7 | ii7 V7 iii7 vi7 | ii7 V7 I7 I7', bpm: 96, lead: 'clarinet', lead2: 'epiano', acc: ['epiano', 'comp'], bass: 'walk', beat: 'swing', swing: 0.33, seed: 137 }],
    cafe:     [{ key: 62, sc: 'maj', prog: PJ, bpm: 120, lead: 'guitar', lead2: 'whistle', acc: ['guitar', 'bossa'], bass: 'bossa', beat: 'bossa', seed: 141 },
               { key: 67, sc: 'maj', prog: P4, bpm: 92, lead: 'epiano', lead2: 'flute', acc: ['piano', 'broken'], bass: 'root', beat: 'soft', seed: 143 }],
    calm:     [{ key: 62, sc: 'maj', prog: P6, bpm: 64, lead: 'harp', lead2: 'strings', acc: ['harp', 'up'], bass: 'pedal', beat: 'none', seed: 151 },
               { key: 60, sc: 'maj', prog: PJ, bpm: 60, lead: 'piano', lead2: 'flute', acc: ['strings', 'hold'], bass: 'pedal', beat: 'none', seed: 153 }],
    dance:    [{ key: 57, sc: 'min', prog: 'i VI III VII | i VI III VII | iv VI VII i | iv VI VII VII', bpm: 122, lead: 'synth', lead2: 'bell', acc: ['synth', 'up'], bass: 'octave', beat: 'dance', seed: 161 },
               { key: 62, sc: 'maj', prog: P6, bpm: 120, lead: 'synth', lead2: 'pluck', acc: ['epiano', 'offbeat'], bass: 'octave', beat: 'dance', seed: 163 }],
    fair:     [{ key: 65, sc: 'maj', prog: PW, bpm: 150, meter: 3, lead: 'calliope', lead2: 'celesta', acc: ['calliope', 'waltz'], bass: 'oompah', beat: 'waltz', seed: 171 },
               { key: 60, sc: 'maj', prog: P5, bpm: 132, lead: 'calliope', lead2: 'bell', acc: ['organ', 'offbeat'], bass: 'oompah', beat: 'march', seed: 173 }],
    stadium:  [{ key: 60, sc: 'maj', prog: P5, bpm: 120, lead: 'organ', lead2: 'brass', acc: ['organ', 'offbeat'], bass: 'root8', beat: 'march', seed: 181 },
               { key: 65, sc: 'maj', prog: PW, bpm: 132, meter: 3, lead: 'organ', lead2: 'organ', acc: ['organ', 'waltz'], bass: 'oompah', beat: 'waltz', seed: 183 }],
    nature:   [{ key: 67, sc: 'maj', prog: P5, bpm: 100, lead: 'flute', lead2: 'marimba', acc: ['marimba', 'broken'], bass: 'bounce', beat: 'soft', seed: 191 },
               { key: 62, sc: 'maj', mel: 'pent', prog: P4, bpm: 108, lead: 'marimba', lead2: 'whistle', acc: ['pluck', 'up'], bass: 'root', beat: 'bossa', seed: 193 }],
    beach:    [{ key: 64, sc: 'maj', prog: P5, bpm: 104, lead: 'whistle', lead2: 'marimba', acc: ['guitar', 'bossa'], bass: 'bossa', beat: 'bossa', seed: 201 }],
    travel:   [{ key: 60, sc: 'maj', prog: P4, bpm: 116, lead: 'clarinet', lead2: 'flute', acc: ['piano', 'alberti'], bass: 'walk', beat: 'soft', seed: 211 }],
    world:    [{ key: 62, sc: 'maj', prog: 'I V vi IV | I V IV IV | vi IV I V | vi IV V I', bpm: 76, lead: 'flute', lead2: 'strings', acc: ['harp', 'up'], bass: 'pedal', beat: 'gentle', seed: 221 },
               { key: 57, sc: 'min', prog: PM, bpm: 72, lead: 'strings', lead2: 'bell', acc: ['harp', 'broken'], bass: 'pedal', beat: 'none', seed: 223 }],
  };
  // which tune each place plays (anything not listed: the shop music)
  const PLACE_THEME = { cafe: 'cafe', bakery: 'cafe', salon: 'cafe', florist: 'nature', hotel: 'jazz', tower: 'jazz', rooftop: 'jazz', suite: 'jazz', restaurant: 'jazz', bar: 'jazz',
    library: 'calm', museum: 'calm', bookstore: 'calm', clinic: 'calm', hospital: 'calm', cinema: 'calm', school: 'cozy', apartments: 'cozy', furniture: 'cozy', realty: 'cozy',
    gym: 'dance', bowling: 'dance', arcade: 'dance', aquatic: 'beach', amuse: 'fair', zoo: 'nature', nursery: 'nature', ranch: 'nature', petshop: 'nature', stadium: 'stadium', station: 'travel', plaza: 'town' };
  const FOLK_TOWN = { fr: 'musette', cn: 'eastern', jp: 'eastern', kr: 'eastern', br: 'bossa', co: 'bossa' };
  const SCALES = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10], pent: [0, 2, 4, 7, 9], mpent: [0, 3, 5, 7, 10] };
  const ROMAN = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };
  const OUTDOOR_PLACES = ['zoo', 'amuse', 'stadium', 'rooftop', 'park', 'lake', 'fields'];
  function themeNow() {
    if (scene === 'world') return 'world';
    if (place && (scene === 'shop' || scene === 'inside')) return PLACE_THEME[place] || 'shop';
    if (scene === 'shop') return 'shop';
    if (scene === 'inside') return night ? 'lullaby' : 'cozy';
    if (night) return 'night';
    if (weather === 'rain' || weather === 'storm') return 'rainy';
    if (scene === 'town') return FOLK_TOWN[folk] || 'town';
    return hour >= 5 && hour < 10 ? 'morning' : 'home';
  }
  const outdoors = () => scene === 'town' || scene === 'home' || (place && OUTDOOR_PLACES.includes(place));

  // Turn a song's description into notes: chords for each bar and a tune with a shape that comes back.
  // The tune: rhythm cells per bar (A: cells a b a cadence; B: c d c cadence), the first note of a bar on a chord
  // note near the last one, the rest stepping along the scale in the motif's shape (strong beats snap to the chord).
  const CELLS4 = [[2, 2, 2, 2], [3, 1, 2, 2], [2, 1, 1, 2, 2], [1, 1, 2, 1, 1, 2], [2, 2, 4], [4, 2, 2], [1, 1, 1, 1, 2, 2], [3, 3, 2], [2, 1, 1, 4], [2, 2, 1, 1, 2]];
  const CAD4 = [[4, 4], [2, 6], [6, 2], [8]];
  const CELLS3 = [[2, 2, 2], [3, 1, 2], [4, 2], [2, 1, 1, 2], [1, 1, 2, 2]], CAD3 = [[6], [4, 2], [2, 4]];
  function rng(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function buildSong(spec, theme) {
    const r = rng(spec.seed), meter = spec.meter || 4, slots = meter * 2, sc = SCALES[spec.sc] || SCALES.maj, msc = SCALES[spec.mel || spec.sc] || sc;
    const bars = spec.prog.split('|').join(' ').split(/\s+/).filter(Boolean).map(sym => {
      const m = sym.match(/^(b?)([ivIV]+)(7?)$/), deg = ROMAN[m[2].toLowerCase()], seventh = !!m[3];
      const at = k => { const o = Math.floor((deg + k) / 7); return spec.key + sc[(deg + k) % 7] + 12 * o; };
      return { root: at(0), notes: [at(0), at(2), at(4), ...(seventh ? [at(6)] : [])] };
    });
    // melody pitch helpers (in steps of the melody's scale, from the key one octave up)
    const L = msc.length, base = spec.key + 12, P = i => base + msc[((i % L) + L) % L] + 12 * Math.floor(i / L);
    const nearestChord = (i, bar) => { let best = i, bd = 99; for (let d = -3; d <= 3; d++) { const p = P(i + d) % 12; if (bars[bar].notes.some(n => n % 12 === p) && Math.abs(d) < bd) { bd = Math.abs(d); best = i + d; } } return best; };
    const cells = meter === 3 ? CELLS3 : CELLS4, cads = meter === 3 ? CAD3 : CAD4;
    const shape = cell => cell.map(() => (r() < 0.5 ? -1 : 1) * (r() < 0.75 ? 1 : 2));
    const cellA = pick2(cells, r), cellB = pick2(cells, r), cellC = pick2(cells, r), cellD = pick2(cells, r), shA = shape(cellA), shB = shape(cellB), shC = shape(cellC), shD = shape(cellD), cad = pick2(cads, r), cad2 = pick2(cads, r);
    const plan = [[cellA, shA], [cellB, shB], [cellA, shA], [cad, null], [cellA, shA], [cellB, shB], [cellA, shA], [cad2, 'end'], [cellC, shC], [cellD, shD], [cellC, shC], [cad, null], [cellA, shA], [cellB, shB], [cellA, shA], [cad2, 'end']];
    const mel = []; let p = L + 2;
    plan.forEach(([cell, sh], b) => {
      const row = []; let pos = 0;
      cell.forEach((len, j) => {
        let i;
        if (j === 0) i = nearestChord(p + (Array.isArray(sh) ? sh[0] : 0), b);
        else if (sh === 'end' || sh === null) i = sh === 'end' ? nearestChord(Math.round(p / L) * L, b) : nearestChord(p - 1, b);
        else i = p + sh[j];
        if (pos % (meter === 3 ? 6 : 4) === 0 && j > 0) i = nearestChord(i, b);
        if (i > L * 2 + 3) i -= 2; if (i < L - 1) i += 2;
        p = i; row.push({ s: pos, n: P(i), len }); pos += len;
      });
      mel.push(row);
    });
    return { spec, theme, bars, mel, slots, meter, spb: 60 / spec.bpm, step: 60 / spec.bpm / 2 };
  }
  function pick2(a, r) { return a[Math.floor(r() * a.length)]; }

  // ---------- the sequencer ----------
  let song = null, curTheme = null, songNo = {}, step = 0, loops = 0, nextT = 0, switching = false;
  function startSong(theme) {
    const L = SONGS[theme] || SONGS.home, i = songNo[theme] = ((songNo[theme] == null ? Math.floor(Math.random() * L.length) - 1 : songNo[theme]) + 1) % L.length;
    song = buildSong(L[i], theme); step = 0; loops = 0;
  }
  function playStep(t) {
    const S2 = song, sp = S2.spec, bar = Math.floor(step / S2.slots) % 16, s = step % S2.slots, B = S2.bars[bar], soft = night ? 0.7 : 1;
    const tt = t + (s % 2 && sp.swing ? sp.swing * S2.step : 0), intro = loops === 0 && bar < 2;
    // the accompaniment
    const [ai, ap] = sp.acc || ['pad', 'hold'], A = INST[ai] || INST.pad, ch = B.notes, low = ch.map(n => n - 12), av = 0.045 * soft;
    const arp = { up: [0, 1, 2, 3, 0, 1, 2, 3], broken: [0, 2, 1, 2, 0, 2, 1, 2], alberti: [0, 2, 1, 2, 0, 2, 1, 2] }[ap];
    if (arp) { const k = arp[s % arp.length] % ch.length, n = (ap === 'up' && s % 8 >= 4 ? ch[k] : low[k]); A(midi(n), tt, av * (s % 2 ? 0.75 : 1), S2.step * 1.6); }
    else if (ap === 'hold' && s === 0) ch.forEach(n => A(midi(n - 12), tt, av * 0.8, S2.spb * S2.meter * 1.1));
    else if (ap === 'waltz' && s % 2 === 0 && s > 0) ch.forEach((n, j) => A(midi(n - 12), tt + j * 0.008, av * 0.6, S2.step * 1.4));
    else if (ap === 'strum' && (s === 0 || s === 3 || s === 4 || s === 6)) ch.forEach((n, j) => A(midi(n - 12), tt + j * 0.018, av * (s === 0 ? 0.8 : 0.55), S2.step * 2));
    else if (ap === 'bossa' && [0, 3, 6].includes(s)) ch.forEach((n, j) => A(midi(n - 12), tt + j * 0.01, av * 0.6, S2.step * 1.3));
    else if (ap === 'offbeat' && s % 2 === 1) ch.forEach(n => A(midi(n - 12), tt, av * 0.5, S2.step * 0.8));
    else if (ap === 'stride' && s % 2 === 0) { if (s % 4 === 0) A(midi(B.root - 24), tt, av * 0.9, S2.step * 1.5); else ch.forEach(n => A(midi(n - 12), tt, av * 0.5, S2.step * 1.2)); }
    else if (ap === 'comp' && (s === 1 || s === 5 || (s === 6 && bar % 2))) ch.forEach(n => A(midi(n - 12), tt, av * 0.55, S2.step * 1.3));
    // the bass
    const bv = 0.1 * soft, BS = (n, len, v = bv) => tone(M(), midi(n), tt, len, { vol: v, attack: 0.01, filter: 600 }), r0 = B.root - 24;
    switch (sp.bass) {
      case 'root': if (s === 0) BS(r0, S2.spb * 1.8); if (s === S2.slots / 2) BS(ch[2] - 24, S2.spb * 1.4, bv * 0.7); break;
      case 'root8': if (s % 2 === 0) BS(s === 4 ? ch[2] - 24 : r0, S2.step * 1.6, bv * (s ? 0.75 : 1)); break;
      case 'bounce': if (s === 0) BS(r0, S2.step * 1.5); if (s === 3) BS(r0 + 12, S2.step, bv * 0.6); if (s === 4) BS(ch[2] - 24, S2.step * 1.5, bv * 0.8); if (s === 7) BS(ch[1] - 24, S2.step, bv * 0.5); break;
      case 'walk': if (s % 2 === 0) { const nx = S2.bars[(bar + 1) % 16].root - 24, q = s / 2, w = [r0, ch[1] - 24, ch[2] - 24, nx + (nx > ch[2] - 24 ? -1 : 1)][q]; BS(w, S2.step * 1.8, bv * 0.9); } break;
      case 'bossa': if (s === 0) BS(r0, S2.step * 2.6); if (s === 3) BS(ch[2] - 24, S2.step * 1.2, bv * 0.8); if (s === 4) BS(ch[2] - 24, S2.step * 2.6, bv * 0.85); if (s === 7) BS(r0, S2.step, bv * 0.7); break;
      case 'oompah': if (s === 0) BS(bar % 2 ? ch[2] - 24 : r0, S2.step * 1.6); break;
      case 'octave': if (s % 2 === 1 || s === 0) BS(s % 4 === 1 ? r0 + 12 : r0, S2.step * 0.9, bv * 0.85); break;
      default: if (s === 0) BS(r0, S2.spb * S2.meter * 1.05, bv * 0.8);   // pedal
    }
    // the drums (not in the intro; snow adds sleigh bells)
    if (!intro) (BEATS[night ? 'none' : sp.beat] || []).forEach(([d, sl, v]) => { if (sl.includes(s)) DR[d](tt, v * (bar === 15 && s >= 4 ? 1.15 : 1)); });
    if (!intro && snow && outdoors() && s % 2 === 0) DR.jingle(tt, 0.05);
    if (!intro && !night && bar === 15 && s === S2.slots - 2 && sp.beat !== 'none') DR.tom(tt, 0.08);   // a little fill into the next round
    // the tune (the second time round an octave higher here and there, with the second voice)
    if (!intro || bar >= 1) {
      const lead = INST[sp.lead] || INST.bell, lv = 0.07 * soft;
      S2.mel[bar].forEach(nt => { if (nt.s === s) { const up = loops % 2 === 1 && bar >= 8 && bar < 12 ? 12 : 0; lead(midi(nt.n + up), tt, lv * (nt.s === 0 ? 1 : 0.85), nt.len * S2.step); } });
      if (loops % 2 === 1 && sp.lead2 && (s === 0 || s === S2.slots / 2)) { const l2 = INST[sp.lead2] || INST.bell, n = ch[(bar + (s ? 1 : 0)) % ch.length]; l2(midi(n), tt, 0.035 * soft, S2.spb * (S2.meter / 2) * 1.05); }
    }
  }
  function advance() {
    step++;
    if (step >= song.slots * 16) { step = 0; loops++; if (loops >= 2) startSong(song.theme); }
  }

  // ---------- ambience ----------
  // looping beds: rain, wind, the stadium crowd, people chatting, water
  const beds = {};
  function bed(name) {
    if (beds[name]) return beds[name];
    const s = noise(), g = ac.createGain(); s.loop = true; g.gain.value = 0;
    const out = { g, level: 0, f: [] };
    const filt = (type, f, q) => { const n = ac.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    if (name === 'rain') { const f = filt('bandpass', 1300, 0.4), f2 = filt('lowpass', 380, 0.5), g2 = ac.createGain(); g2.gain.value = 0.6; s.connect(f); f.connect(g); s.connect(f2); f2.connect(g2); g2.connect(g); }
    else if (name === 'wind') { const f = filt('lowpass', 480, 1.2); s.connect(f); f.connect(g); out.f.push(f); }
    else if (name === 'crowd') { const f = filt('bandpass', 950, 0.5), f2 = filt('bandpass', 2100, 0.9), g2 = ac.createGain(); g2.gain.value = 0.4; s.connect(f); f.connect(g); s.connect(f2); f2.connect(g2); g2.connect(g); out.f.push(f); }
    else if (name === 'chatter') { [420, 900, 1700].forEach((fr, i) => { const f = filt('bandpass', fr, 2.2), gg = ac.createGain(); gg.gain.value = 0.5; s.connect(f); f.connect(gg); gg.connect(g); out.f.push(gg); }); }
    else if (name === 'water') { const f = filt('lowpass', 650, 0.8); s.connect(f); f.connect(g); out.f.push(f); }
    else if (name === 'hum') { const f = filt('lowpass', 220, 0.7); s.connect(f); f.connect(g); }
    g.connect(amb); s.start();
    return (beds[name] = out);
  }
  function bedTo(name, level, tc = 1.2) {
    if (!ac) return;
    if (!level && !beds[name]) return;
    const b = bed(name); if (Math.abs(b.level - level) < 0.002) return;
    b.level = level; b.g.gain.setTargetAtTime(level, ac.currentTime, tc);
  }
  let crowd = { v: 0, at: 0 }, nextAmb = {}, roosterDay = '';
  const due = (k, now2, gap) => { if ((nextAmb[k] || 0) > now2) return false; nextAmb[k] = now2 + gap[0] + R() * (gap[1] - gap[0]); return true; };
  function ambienceTick(t) {
    if (!ambOn) { Object.keys(beds).forEach(k => bedTo(k, 0, 0.3)); return; }
    const out = outdoors(), wet = weather === 'rain' || weather === 'storm', P = place && (scene === 'shop' || scene === 'inside') ? place : null;
    bedTo('rain', out && wet ? (weather === 'storm' ? 0.11 : 0.065) : 0);   // (v0.49: under a roof you don't hear the rain)
    bedTo('wind', out && (snow || weather === 'storm' || weather === 'fog') ? (weather === 'storm' ? 0.06 : 0.035) : 0, 2);
    if (beds.wind && beds.wind.level) beds.wind.f[0].frequency.setTargetAtTime(380 + Math.sin(t * 0.4) * 160 + R() * 60, t, 0.8);
    bedTo('chatter', ['cafe', 'bakery', 'hotel', 'restaurant', 'bar', 'mall', 'market', 'station', 'school', 'salon', 'amuse', 'bowling', 'plaza'].includes(P) ? 0.03 : 0);
    if (beds.chatter && beds.chatter.level) beds.chatter.f.forEach(gg => gg.gain.setTargetAtTime(0.2 + R() * 0.8, t, 0.08));
    bedTo('water', P === 'aquatic' ? 0.05 : 0);
    if (beds.water && beds.water.level) beds.water.f[0].frequency.setTargetAtTime(500 + Math.sin(t * 0.7) * 200, t, 0.5);
    bedTo('hum', P && ['hospital', 'clinic', 'museum', 'library', 'gym'].includes(P) ? 0.025 : 0);
    // the stadium: louder with the game (Sound.crowd from the stadium)
    const cv = P === 'stadium' ? 0.025 + crowd.v * 0.1 : 0;
    bedTo('crowd', cv, 0.4);
    if (beds.crowd && beds.crowd.level) beds.crowd.f[0].frequency.setTargetAtTime(900 + crowd.v * 500 + Math.sin(t * 0.5) * 80, t, 0.3);
    // things that happen now and then
    const day = !night;
    if (out && day && !wet && !snow && due('bird', t, [3, 10])) birdSong(t);
    if (out && night && !snow && !wet && due('cricket', t, [0.5, 1.4])) [0, 0.05, 0.1].forEach(d => tone(amb, 4400 + R() * 300, t + d, 0.03, { vol: 0.02, attack: 0.004 }));
    if (out && night && !wet && due('owl', t, [40, 90])) [0, 0.45, 0.62].forEach((d, i) => tone(amb, i ? 330 : 360, t + d, i ? 0.22 : 0.35, { vol: 0.05, attack: 0.04, glide: 0.92, filter: 900 }));
    if (scene === 'home' && day && hour >= 5 && hour < 9 && roosterDay !== new Date().toDateString() && farm.includes('chicken')) { roosterDay = new Date().toDateString(); AMB_FX.rooster(t + 1); }
    if (scene === 'home' && farm.length && due('farm', t, [9, 22])) { const k = pick(farm), f = FX[ANIMAL_VOICE[k]]; if (f) f(t, amb); }
    if (scene === 'town' && day && due('car', t, [7, 18])) AMB_FX.car(t);
    if (scene === 'town' && due('dog', t, [45, 110])) FX.bark(t, amb, 0.4);
    if (scene === 'town' && day && due('bike', t, [60, 140])) [0, 0.12].forEach(d => tone(amb, 2500, t + d, 0.35, { vol: 0.025, attack: 0.002 }));
    if (!P) return;
    if ((P === 'cafe' || P === 'bakery' || P === 'hotel') && due('cup', t, [3, 8])) tone(amb, 2200 + R() * 900, t, 0.25, { vol: 0.025, attack: 0.002 });
    if (P === 'cafe' && due('steam', t, [20, 40])) burst(amb, t, 1.6, { vol: 0.03, type: 'highpass', freq: 3500, attack: 0.2 });
    if ((P === 'library' || P === 'museum') && due('clock', t, [1, 1])) burst(amb, t, 0.02, { vol: 0.03, type: 'bandpass', freq: 2800, q: 8 });
    if ((P === 'library' || P === 'bookstore') && due('page', t, [8, 18])) FX.paper(t, amb);
    if ((P === 'hospital' || P === 'clinic') && due('beep', t, [2, 2])) tone(amb, 1046, t, 0.12, { vol: 0.015 });
    if (P === 'gym' && due('clank', t, [3, 8])) { tone(amb, 820, t, 0.3, { type: 'triangle', vol: 0.03 }); tone(amb, 1730, t, 0.2, { vol: 0.012 }); }
    if (P === 'bowling' && due('lane', t, [8, 15])) { burst(amb, t, 1.6, { vol: 0.05, freq: 180, attack: 0.5 }); FX.pins(t + 2.1, amb, 0.5); }
    if (P === 'aquatic' && due('splash', t, [3, 8])) FX.splash(t, amb, 0.6);
    if (P === 'station' && due('train', t, [35, 60])) AMB_FX.train(t);
    if (P === 'zoo' && due('zoo', t, [6, 14])) pick([AMB_FX.elephant, AMB_FX.lion, AMB_FX.monkey, birdSong])(t);
    if (P === 'amuse' && due('ride', t, [10, 18])) { burst(amb, t, 2.5, { vol: 0.04, freq: 220, attack: 0.8 }); [0.4, 0.7].forEach(d => tone(amb, 1300 + R() * 300, t + 1.2 + d, 0.6, { type: 'triangle', vol: 0.012, glide: 0.75, vib: 40 })); }
    if ((P === 'market' || P === 'mall') && due('scan', t, [3, 7])) tone(amb, 2400, t, 0.08, { type: 'square', vol: 0.012, filter: 3000 });
    if (P === 'salon' && due('snip', t, [4, 9])) [0, 0.15, 0.3].forEach(d => burst(amb, t + d, 0.03, { vol: 0.04, type: 'highpass', freq: 4000 }));
    if (P === 'stadium' && due('vendor', t, [25, 50])) AMB_FX.organ(t);
  }
  function birdSong(t) {
    const k = Math.floor(R() * 3), f = 2400 + R() * 1400;
    if (k === 0) for (let i = 0; i < 3 + Math.floor(R() * 3); i++) tone(amb, f, t + i * 0.11, 0.08, { vol: 0.03, glide: 1.25 });
    else if (k === 1) { tone(amb, f * 1.2, t, 0.22, { vol: 0.03, attack: 0.02 }); tone(amb, f * 0.9, t + 0.26, 0.28, { vol: 0.03, attack: 0.02 }); }
    else for (let i = 0; i < 8; i++) tone(amb, f * (0.9 + R() * 0.3), t + i * 0.06, 0.05, { vol: 0.02 });
  }
  const AMB_FX = {
    rooster: t => [[520, 0.12, 1.1], [700, 0.2, 1.08], [760, 0.5, 0.75], [620, 0.3, 0.8]].reduce((d, [f, len, gl]) => { tone(amb, f, t + d, len, { type: 'sawtooth', vol: 0.05, attack: 0.02, glide: gl, filter: 1800, vib: 25 }); return d + len * 0.95; }, 0),
    car: t => { const d = 2.4; burst(amb, t, d, { vol: 0.05, freq: 320, attack: d * 0.5 }); tone(amb, 90, t, d, { type: 'sawtooth', vol: 0.02, attack: d * 0.5, glide: 0.8, filter: 300 }); },
    train: t => { burst(amb, t, 5, { vol: 0.06, freq: 150, attack: 1.5 }); tone(amb, 2900, t + 3.2, 1, { type: 'triangle', vol: 0.012, glide: 0.95 }); [659, 523, 784].forEach((f, i) => tone(amb, f, t + 5 + i * 0.35, 0.7, { vol: 0.03 })); },
    elephant: t => tone(amb, 520, t, 0.8, { type: 'sawtooth', vol: 0.04, attack: 0.05, glide: 1.4, filter: 1600, vib: 60, vibRate: 9 }),
    lion: t => burst(amb, t, 1.4, { vol: 0.07, type: 'bandpass', freq: 160, q: 2, attack: 0.25, sweep: 0.7 }),
    monkey: t => [0, 0.14, 0.28, 0.42].forEach((d, i) => tone(amb, 700 + i * 120, t + d, 0.12, { type: 'triangle', vol: 0.03, glide: 1.4 })),
    organ: t => [67, 72, 76, 79, 76, 79].forEach((n, i) => INST_SFX('organ', midi(n), t + [0, 0.16, 0.32, 0.48, 0.8, 0.96][i], 0.04, i === 5 ? 0.7 : 0.14, amb)),
  };
  // an instrument note on another bus (sound effects)
  function INST_SFX(name, f, t, v, len, bus = sfx) { const keep = musicFade; try { musicFade = bus; INST[name](f, t, v, len); } finally { musicFade = keep; } }

  // ---------- sound effects ----------
  // each: (t, bus = sfx, vol scale = 1)
  const ANIMAL_VOICE = { chicken: 'cluck', duck: 'quack', sheep: 'baa', goat: 'baa', pig: 'oink', cow: 'moo', alpaca: 'hum', dog: 'woof', cat: 'meow', rabbit: 'nibble' };
  const FX = {
    tap: (t, b = sfx) => tone(b, 880, t, 0.05, { type: 'triangle', vol: 0.04 }),
    // v0.49: a bowling pin knocked over (a hollow wooden clack), and a strike (the whole rack crashing down)
    pin: (t, b = sfx) => { burst(b, t, 0.07, { vol: 0.16, type: 'bandpass', freq: 2200 + R() * 900, q: 4 }); tone(b, 520 + R() * 160, t, 0.09, { type: 'triangle', vol: 0.08, glide: 0.6 }); },
    pins: (t, b = sfx, k = 1) => { for (let i = 0; i < 9; i++) { const d = i * 0.035 + R() * 0.03; burst(b, t + d, 0.08, { vol: 0.13 * k, type: 'bandpass', freq: 1600 + R() * 1600, q: 3.5 }); tone(b, 380 + R() * 300, t + d, 0.1, { type: 'triangle', vol: 0.05 * k, glide: 0.5 }); } burst(b, t, 0.45, { vol: 0.08 * k, freq: 260, sweep: 0.4 }); },
    pop: (t, b = sfx) => { tone(b, 420, t, 0.12, { vol: 0.14, glide: 2.2 }); burst(b, t, 0.05, { vol: 0.05, type: 'highpass', freq: 3000 }); },
    coins: (t, b = sfx) => [1319, 1568, 2093].forEach((f, i) => { tone(b, f, t + i * 0.07, 0.35, { vol: 0.08 }); tone(b, f * 2.01, t + i * 0.07, 0.2, { vol: 0.02 }); }),
    // paying: the till drawer and its bell
    buy: (t, b = sfx) => { burst(b, t, 0.08, { vol: 0.08, freq: 500 }); tone(b, 2093, t + 0.08, 0.6, { vol: 0.07 }); tone(b, 2637, t + 0.08, 0.5, { vol: 0.04 }); tone(b, 4186, t + 0.08, 0.3, { vol: 0.015 }); },
    plant: (t, b = sfx) => { burst(b, t, 0.14, { vol: 0.12, freq: 400 }); tone(b, 160, t, 0.12, { vol: 0.08, glide: 0.6 }); },
    step: (t, b = sfx) => burst(b, t, 0.05, { vol: 0.07, freq: 700 }),
    door: (t, b = sfx) => { tone(b, 180, t, 0.12, { vol: 0.12, glide: 0.7, filter: 800 }); tone(b, 150, t + 0.1, 0.14, { vol: 0.1, glide: 0.7, filter: 800 }); burst(b, t, 0.3, { vol: 0.03, freq: 1200, sweep: 0.3 }); },
    // a shop door's little bell
    doorbell: (t, b = sfx) => { [2637, 2349, 2637, 2093].forEach((f, i) => tone(b, f * (1 + (R() - 0.5) * 0.01), t + i * 0.07, 0.5, { vol: 0.035 })); FX.door(t, b); },
    // the lift arriving
    lift: (t, b = sfx) => { tone(b, 1568, t, 1.2, { vol: 0.07 }); tone(b, 1568 * 2.76, t, 0.4, { vol: 0.01 }); },
    bark: (t, b = sfx, k = 1) => [0, 0.2].forEach(d => { tone(b, 420, t + d, 0.13, { type: 'sawtooth', vol: 0.09 * k, glide: 0.55, filter: 1400 }); burst(b, t + d, 0.08, { vol: 0.06 * k, type: 'bandpass', freq: 900, q: 2 }); }),
    sneak: (t, b = sfx) => { tone(b, 660, t, 0.08, { type: 'triangle', vol: 0.06 }); tone(b, 990, t + 0.08, 0.1, { type: 'triangle', vol: 0.05 }); },
    chime: (t, b = sfx) => [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(b, f, t + i * 0.08, 0.9, { vol: 0.06 })),
    // something you did is done (the progress bar's full)
    done: (t, b = sfx) => { [1319, 1760, 2637].forEach((f, i) => tone(b, f, t + i * 0.06, 0.5, { vol: 0.05 })); burst(b, t, 0.2, { vol: 0.02, type: 'highpass', freq: 6000 }); },
    build: (t, b = sfx) => [0, 0.16, 0.32].forEach(d => { burst(b, t + d, 0.06, { vol: 0.12, type: 'bandpass', freq: 1800, q: 3 }); tone(b, 300, t + d, 0.05, { vol: 0.06 }); }),
    paper: (t, b = sfx) => burst(b, t, 0.25, { vol: 0.05, type: 'highpass', freq: 2500, sweep: 1.6 }),
    splash: (t, b = sfx, k = 1) => { burst(b, t, 0.35, { vol: 0.12 * k, type: 'bandpass', freq: 1200, q: 0.8, sweep: 0.4 }); tone(b, 600, t, 0.15, { vol: 0.05 * k, glide: 0.4 }); },
    thunder: (t, b = sfx) => { if (!outdoors()) return; burst(b, t, 2.2, { vol: 0.35, freq: 300, sweep: 0.2 }); burst(b, t + 0.15, 1.6, { vol: 0.2, freq: 120 }); },
    oops: (t, b = sfx) => tone(b, 220, t, 0.18, { type: 'triangle', vol: 0.07, glide: 0.7 }),
    aww: (t, b = sfx) => [523, 494, 466, 440].forEach((f, i) => tone(b, f, t + i * 0.16, i === 3 ? 0.6 : 0.16, { type: 'triangle', vol: 0.05, vib: i === 3 ? 30 : 0 })),
    // harvesting a crop: a leafy rustle, then two bright plucks going up
    harvest: (t, b = sfx) => { burst(b, t, 0.16, { vol: 0.09, type: 'bandpass', freq: 2400, q: 0.9, sweep: 0.6 }); [784, 1175].forEach((f, i) => { tone(b, f, t + 0.06 + i * 0.08, 0.3, { type: 'triangle', vol: 0.08 }); tone(b, f * 2, t + 0.06 + i * 0.08, 0.12, { vol: 0.02 }); }); },
    // planting: digging the soil (two soft scrapes), then the seed dropping in
    sow: (t, b = sfx) => { burst(b, t, 0.09, { vol: 0.1, freq: 500, sweep: 0.5 }); burst(b, t + 0.11, 0.09, { vol: 0.08, freq: 420, sweep: 0.5 }); tone(b, 520, t + 0.24, 0.1, { vol: 0.06, glide: 1.6 }); },
    collect: (t, b = sfx) => [659, 988].forEach((f, i) => { tone(b, f, t + i * 0.09, 0.25, { vol: 0.09, attack: 0.003 }); tone(b, f * 4, t + i * 0.09, 0.05, { vol: 0.02, attack: 0.002 }); }),
    fruit: (t, b = sfx) => { tone(b, 340, t, 0.08, { vol: 0.12, glide: 0.6 }); tone(b, 1568, t + 0.07, 0.4, { vol: 0.04 }); tone(b, 2093, t + 0.12, 0.35, { vol: 0.03 }); },
    tick: (t, b = sfx) => tone(b, 1400, t, 0.03, { type: 'triangle', vol: 0.025, attack: 0.002 }),
    select: (t, b = sfx) => { tone(b, 660, t, 0.08, { vol: 0.07, glide: 1.5 }); tone(b, 990, t + 0.05, 0.1, { vol: 0.05, glide: 1.3 }); },
    // eating and drinking
    munch: (t, b = sfx) => [0, 0.17, 0.33, 0.52].forEach(d => burst(b, t + d, 0.07, { vol: 0.07, type: 'bandpass', freq: 1500 + R() * 800, q: 1.5 })),
    sip: (t, b = sfx) => { burst(b, t, 0.5, { vol: 0.05, type: 'bandpass', freq: 900, q: 3, sweep: 2.2, attack: 0.05 }); tone(b, 300, t + 0.55, 0.12, { vol: 0.04, glide: 1.5 }); },
    sizzle: (t, b = sfx) => { burst(b, t, 1.4, { vol: 0.06, type: 'highpass', freq: 4500, attack: 0.05 }); for (let i = 0; i < 8; i++) burst(b, t + R() * 1.2, 0.02, { vol: 0.05, type: 'highpass', freq: 3000 }); },
    yawn: (t, b = sfx) => tone(b, 330, t, 0.9, { type: 'triangle', vol: 0.05, attack: 0.2, glide: 0.7, filter: 900 }),
    // the phone: a message coming in, sending one, a bet's chip
    msg: (t, b = sfx) => { tone(b, 1568, t, 0.22, { vol: 0.07 }); tone(b, 2093, t + 0.12, 0.35, { vol: 0.06 }); },
    send: (t, b = sfx) => burst(b, t, 0.3, { vol: 0.06, type: 'bandpass', freq: 900, q: 1.2, sweep: 4 }),
    chip: (t, b = sfx) => [0, 0.06].forEach(d => { tone(b, 2400, t + d, 0.06, { type: 'triangle', vol: 0.05 }); burst(b, t + d, 0.03, { vol: 0.05, type: 'bandpass', freq: 3500, q: 3 }); }),
    fanfare: (t, b = sfx) => [[60, 0, 0.14], [64, 0.14, 0.14], [67, 0.28, 0.14], [72, 0.42, 0.6]].forEach(([n, d, len]) => [0, 4, 7].forEach(o => INST_SFX('brass', midi(n + o - (o ? 12 : 0)), t + d, o ? 0.03 : 0.06, len, b))),
    levelup: (t, b = sfx) => [523, 659, 784, 1047].forEach((f, i) => tone(b, f, t + i * 0.1, 0.5, { type: 'triangle', vol: 0.07 })),
    // pets and farm animals
    woof: (t, b = sfx) => [0, 0.16].forEach(d => tone(b, 360, t + d, 0.1, { type: 'sawtooth', vol: 0.06, glide: 0.7, filter: 1200 })),
    meow: (t, b = sfx) => { tone(b, 620, t, 0.32, { type: 'triangle', vol: 0.07, glide: 1.25, filter: 2200 }); tone(b, 760, t + 0.18, 0.25, { type: 'triangle', vol: 0.05, glide: 0.7, filter: 2200 }); },
    lap: (t, b = sfx) => [0, 0.1, 0.2].forEach(d => burst(b, t + d, 0.05, { vol: 0.06, type: 'bandpass', freq: 1800, q: 2 })),
    crunch: (t, b = sfx) => [0, 0.09, 0.18].forEach(d => burst(b, t + d, 0.05, { vol: 0.08, type: 'highpass', freq: 1500 })),
    sweep: (t, b = sfx) => burst(b, t, 0.4, { vol: 0.07, type: 'bandpass', freq: 3000, q: 0.6, sweep: 0.4 }),
    moo: (t, b = sfx) => tone(b, 120, t, 1.1, { type: 'sawtooth', vol: 0.07, attack: 0.15, glide: 0.82, filter: 700, vib: 15 }),
    cluck: (t, b = sfx) => [0, 0.12, 0.22, 0.4].forEach((d, i) => tone(b, i === 3 ? 900 : 650, t + d, i === 3 ? 0.2 : 0.07, { type: 'triangle', vol: 0.05, glide: i === 3 ? 0.7 : 1.3, filter: 2500 })),
    quack: (t, b = sfx) => [0, 0.2].forEach(d => tone(b, 480, t + d, 0.15, { type: 'sawtooth', vol: 0.06, glide: 0.75, filter: 1100, q: 4 })),
    baa: (t, b = sfx) => tone(b, 330, t, 0.7, { type: 'sawtooth', vol: 0.06, attack: 0.05, glide: 0.9, filter: 1400, vib: 45, vibRate: 9 }),
    oink: (t, b = sfx) => [0, 0.18].forEach(d => tone(b, 210, t + d, 0.14, { type: 'square', vol: 0.05, glide: 0.8, filter: 700, q: 3 })),
    hum: (t, b = sfx) => tone(b, 420, t, 0.5, { vol: 0.05, attack: 0.08, glide: 1.15, vib: 20 }),
    nibble: (t, b = sfx) => [0, 0.08, 0.16].forEach(d => burst(b, t + d, 0.03, { vol: 0.05, type: 'highpass', freq: 3000 })),
    // v0.33 ball games: a racket hitting the ball, a bounce, a kick, the net swishing, the rim clanging, people cheering
    racket: (t, b = sfx) => { tone(b, 540, t, 0.06, { type: 'triangle', vol: 0.12, glide: 0.55 }); burst(b, t, 0.05, { vol: 0.08, type: 'bandpass', freq: 2400, q: 1.4 }); },
    bounce: (t, b = sfx, k = 1) => tone(b, 170, t, 0.09, { vol: 0.1 * k, glide: 0.5 }),
    kick: (t, b = sfx, k = 1) => { tone(b, 120, t, 0.14, { vol: 0.2 * k, glide: 0.4 }); burst(b, t, 0.06, { vol: 0.1 * k, type: 'lowpass', freq: 900 }); },
    swish: (t, b = sfx, k = 1) => burst(b, t, 0.35, { vol: 0.12 * k, type: 'highpass', freq: 3200, sweep: 0.5 }),
    clang: (t, b = sfx, k = 1) => { tone(b, 620, t, 0.45, { type: 'triangle', vol: 0.06 * k }); tone(b, 1475, t, 0.3, { vol: 0.035 * k }); },
    cheer: (t, b = sfx) => { burst(b, t, 1.0, { vol: 0.08, type: 'bandpass', freq: 1300, q: 0.5 }); [0.08, 0.2, 0.31, 0.45, 0.58, 0.7].forEach(d => burst(b, t + d, 0.04, { vol: 0.06, type: 'highpass', freq: 2200 })); tone(b, 784, t, 0.25, { type: 'triangle', vol: 0.05 }); tone(b, 1047, t + 0.12, 0.35, { type: 'triangle', vol: 0.05 }); },
    // v0.56 the stadium: the referee's whistle, the goal horn, the crack of the bat, the glove, a stick on the puck,
    // a whole stadium roaring, an "ooh"
    whistle: (t, b = sfx) => { tone(b, 2900, t, 0.5, { vol: 0.05, attack: 0.01, vib: 60, vibRate: 28 }); tone(b, 2900, t + 0.6, 0.25, { vol: 0.04, attack: 0.01, vib: 60, vibRate: 28 }); },
    horn: (t, b = sfx) => [110, 138.6, 165].forEach(f => tone(b, f, t, 1.6, { type: 'sawtooth', vol: 0.05, attack: 0.03, release: 1.6, filter: 900 })),
    batcrack: (t, b = sfx) => { burst(b, t, 0.05, { vol: 0.22, type: 'highpass', freq: 1800 }); tone(b, 900, t, 0.06, { type: 'triangle', vol: 0.12, glide: 0.5 }); },
    glove: (t, b = sfx, k = 1) => { burst(b, t, 0.05, { vol: 0.12 * k, freq: 600 }); tone(b, 160, t, 0.06, { vol: 0.1 * k, glide: 0.6 }); },
    puck: (t, b = sfx, k = 1) => { burst(b, t, 0.04, { vol: 0.14 * k, type: 'bandpass', freq: 2600, q: 2 }); tone(b, 700, t, 0.05, { type: 'triangle', vol: 0.06 * k, glide: 0.6 }); },
    squeak: (t, b = sfx) => tone(b, 2400 + R() * 600, t, 0.07, { type: 'sawtooth', vol: 0.012, glide: 1.2, filter: 4000, q: 6 }),
    roar: (t, b = sfx) => { burst(b, t, 3.2, { vol: 0.16, type: 'bandpass', freq: 1100, q: 0.5, attack: 0.35 }); burst(b, t, 2.8, { vol: 0.08, type: 'bandpass', freq: 2300, q: 0.8, attack: 0.3 }); for (let i = 0; i < 14; i++) burst(b, t + 0.3 + R() * 2, 0.03, { vol: 0.04, type: 'highpass', freq: 2500 }); },
    ooh: (t, b = sfx) => burst(b, t, 1.3, { vol: 0.09, type: 'bandpass', freq: 520, q: 3, attack: 0.25, sweep: 0.8 }),
    charge: (t, b = sfx) => [67, 72, 76, 79, 76, 79].forEach((n, i) => INST_SFX('organ', midi(n), t + [0, 0.16, 0.32, 0.48, 0.8, 0.96][i], 0.05, i === 5 ? 0.7 : 0.14, b)),
  };

  // ---------- the clock ----------
  function tick() {
    if (!running) return;
    const t = ac.currentTime;
    const want = themeNow();
    if (want !== curTheme && !switching) {
      if (!curTheme || !song) { curTheme = want; startSong(want); nextT = t + 0.1; }
      else { switching = true; musicFade.gain.setTargetAtTime(0, t, 0.3); setTimeout(() => { curTheme = want; startSong(want); nextT = ac.currentTime + 0.1; musicFade.gain.cancelScheduledValues(ac.currentTime); musicFade.gain.setTargetAtTime(1, ac.currentTime, 0.6); switching = false; }, 900); }
    }
    if (musicOn && song && !switching) { if (nextT < t) nextT = t + 0.05; while (nextT < t + 0.5) { playStep(nextT); nextT += song.step; advance(); } }
    try { ambienceTick(t); } catch (e) { /* audio is optional */ }
    if (crowd.v > 0 && performance.now() - crowd.at > 3000) crowd.v = 0;   // left the stadium
  }

  return {
    // Phones only allow sound after the player touches the screen, so this runs on the first tap.
    start() {
      if (!init()) return;
      if (ac.state === 'suspended') ac.resume();
      if (!running) { running = true; setInterval(tick, 100); }
    },
    state: () => (ac ? ac.state : 'off'),
    // Where you are: home, town, inside, shop or world; place: which building (its own tune and sounds)
    setScene(s, p = null) { scene = s; place = p; },
    // the town's country (its own town music)
    setFolk(f) { folk = f || 'us'; },
    // the animals on your farm (they make their noises now and then)
    setFarm(kinds) { farm = kinds || []; },
    play(name) { if (!ac || !sfxOn || !FX[name]) return; try { FX[name](ac.currentTime + 0.01); } catch (e) { /* audio is optional */ } },
    // a farm animal / pet's voice
    animal(k) { if (ANIMAL_VOICE[k]) this.play(ANIMAL_VOICE[k]); },
    // v0.41: one sung note (karaoke): a MIDI pitch, for dur seconds
    note(n, dur = 0.4, vol = 0.14) { if (!ac || !sfxOn) return; try { const t0 = ac.currentTime + 0.01; tone(sfx, midi(n), t0, dur, { type: 'triangle', vol, attack: 0.02, release: dur }); tone(sfx, midi(n + 12), t0, dur * 0.6, { type: 'sine', vol: vol * 0.3, attack: 0.02, release: dur * 0.6 }); } catch (e) { /* audio is optional */ } },
    // v0.41: the background music quietly under the karaoke
    duck(on) { ducked = !!on; levels(0.3); },
    setMusic(on) { musicOn = on; levels(0.4); },
    setSfx(on) { sfxOn = on; levels(0.2); },
    setAmb(on) { ambOn = on; levels(0.4); },
    // the volumes, 0 … 1
    setVol(kind, v) { if (VOL[kind] != null) { VOL[kind] = Math.max(0, Math.min(1, v)); levels(0.15); } },
    // v0.56: the stadium crowd: v 0 … 1 (how loud: 1 = a chance or a goal); called while you watch
    crowd(v) { crowd.v = crowd.v * 0.7 + v * 0.3; crowd.at = performance.now(); },
    // Called every second with the time of day and the weather.
    ambience(isNight, w, h) { night = isNight; weather = w === 'snow' ? 'snow' : w; snow = w === 'snow'; if (h != null) hour = h; },
    // for testing: how loud it is right now (rms and peak of the mix, 0 … 1)
    meter() { if (!ac) return null; if (!this._an) { this._an = ac.createAnalyser(); this._an.fftSize = 2048; master.connect(this._an); } const d = new Float32Array(2048); this._an.getFloatTimeDomainData(d); let s2 = 0, pk = 0; d.forEach(v => { s2 += v * v; pk = Math.max(pk, Math.abs(v)); }); return { rms: +Math.sqrt(s2 / d.length).toFixed(4), peak: +pk.toFixed(3) }; },
    // for testing: what's playing
    debug: () => ({ theme: curTheme, song: song && song.spec.seed, step, loops, scene, place, beds: Object.fromEntries(Object.entries(beds).map(([k, b]) => [k, +b.level.toFixed(3)])) }),
  };
})();
