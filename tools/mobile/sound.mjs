// docs/23 item 85: the guns and the hits, juicier but no louder. The game's own procedural sounds (client/src/audio.ts)
// rendered offline in the browser — one gun, a broadside of eight, a hit, a crushing hit — and measured: the peak, the
// loudest 100 ms (RMS), and how much of the sound a phone's small speaker can play at all (the share of its energy
// above 200 Hz: a phone does not sound the 30–70 Hz thump). The sea and the music buses are silent; the same random
// seed for both versions. Run against a server of the old code and of the new.
//   GPORT=58813 TAG=after node tools/mobile/sound.mjs
import * as L from './m0/lib.mjs';
import { writeFileSync } from 'node:fs';

const port = Number(process.env.GPORT ?? 58813), tag = process.env.TAG ?? 'now';
const OUT = process.env.OUT ?? 'assets/raw/audit/m78';
const b = await L.browser();
const p = await L.page(b, L.SIZES.desk, { lang: 'en', touch: false });
await p.goto(`http://localhost:${port}/?nologin`, { waitUntil: 'domcontentloaded' });
const res = await p.evaluate(async () => {
  const { AudioEngine } = await import('/src/audio.ts');
  const SR = 44100;
  // Math.random made the same for both versions (the guns' scatter of pitch and the noise buffers).
  const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  async function render(play, secs = 2.5) {
    const realRandom = Math.random; Math.random = seeded(12345);
    const RealCtx = globalThis.AudioContext;
    globalThis.AudioContext = class extends OfflineAudioContext { constructor() { super(2, Math.round(SR * secs), SR); } };
    try {
      const a = new AudioEngine();
      a.muted = false; a.volume = 1; a.levels = { sea: 0, combat: 1, ui: 1, music: 0 };
      a.unlock();
      a.listener = { x: 0, y: 0 };
      play(a);
      const buf = await a.ctx.startRendering();
      return buf;
    } finally { globalThis.AudioContext = RealCtx; Math.random = realRandom; }
  }
  const db = (x) => +(20 * Math.log10(Math.max(1e-9, x))).toFixed(1);
  function measure(buf) {
    const L0 = buf.getChannelData(0), R0 = buf.getChannelData(1), n = L0.length;
    const m = new Float32Array(n);
    for (let i = 0; i < n; i++) m[i] = (L0[i] + R0[i]) / 2;
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L0[i]), Math.abs(R0[i]));
    const w = Math.round(0.1 * SR); let best = 0, acc = 0;
    for (let i = 0; i < n; i++) { acc += m[i] * m[i]; if (i >= w) acc -= m[i - w] * m[i - w]; if (i >= w - 1) best = Math.max(best, acc / w); }
    // A phone's small speaker: next to nothing below 250 Hz (four one-pole high-passes in a row, −24 dB an octave); the
    // share of the energy it plays, and the loudest 100 ms of it.
    const a = Math.exp(-2 * Math.PI * 250 / SR);
    let hiS = m;
    for (let k = 0; k < 4; k++) { const o = new Float32Array(n); let lp = 0; for (let i = 0; i < n; i++) { lp = (1 - a) * hiS[i] + a * lp; o[i] = hiS[i] - lp; } hiS = o; }
    let eAll = 0, eHi = 0, accH = 0, bestH = 0;
    for (let i = 0; i < n; i++) { const hi = hiS[i]; eAll += m[i] * m[i]; eHi += hi * hi; accH += hi * hi; if (i >= w) accH -= hiS[i - w] * hiS[i - w]; if (i >= w - 1) bestH = Math.max(bestH, accH / w); }
    // how long it rings above −40 dB of its peak
    let last = 0; for (let i = 0; i < n; i++) if (Math.abs(m[i]) > peak * 0.01) last = i;
    return { peakDb: db(peak), rms100Db: db(Math.sqrt(best)), phoneDb: db(Math.sqrt(bestH)), phoneShare: +(100 * eHi / Math.max(1e-12, eAll)).toFixed(1), ringMs: Math.round(1000 * last / SR) };
  }
  const out = {};
  out.gun = measure(await render((a) => a.cannon(60, 0, 0, 0.8)));
  out.broadside = measure(await render((a) => { for (let i = 0; i < 8; i++) a.cannon(60, i * 4, i * 0.045, 0.8); }));
  out.hit = measure(await render((a) => a.hit(80, 0, false)));
  out.crit = measure(await render((a) => a.hit(80, 0, true)));
  out.volleyEvent = measure(await render((a) => a.onEvent({ k: 'volley', ship: 2, side: 'port', ammo: 'round', balls: Array.from({ length: 8 }, (_, i) => [60, i * 4, 0, 300, i * 45]) })));
  return out;
});
L.log(tag, JSON.stringify(res));
writeFileSync(`${OUT}/sound_${tag}.json`, JSON.stringify({ at: new Date().toISOString(), ...res }, null, 1));
await b.close();
