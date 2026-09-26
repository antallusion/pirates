// Procedural sound (WebAudio): no files to download, every sound reacts to the scene.
// Layers: ocean bed (wind-driven brown noise), rain, thunder, cannon fire, hull hits, splashes,
// harbour bells, coins. Positional: gain and stereo pan from the listener (own ship).

import type { GameEvent, WeatherKind } from '../../shared/src/protocol.ts';

const HEARING = 1600; // meters beyond which a cannon is not heard

/** Distance attenuation and stereo pan for a world-space source. Pure, unit-tested. */
export function spatial(lx: number, ly: number, sx: number, sy: number, range = HEARING): { gain: number; pan: number } {
  const dx = sx - lx, dy = sy - ly;
  const d = Math.hypot(dx, dy);
  if (d >= range) return { gain: 0, pan: 0 };
  const gain = Math.pow(1 - d / range, 1.6);
  const pan = Math.max(-1, Math.min(1, dx / 400));
  return { gain, pan };
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private brown: AudioBuffer | null = null;
  private sea: GainNode | null = null;
  private seaFilter: BiquadFilterNode | null = null;
  private rain: GainNode | null = null;
  muted = localStorage.getItem('gravetide.muted') === '1';
  volume = Number(localStorage.getItem('gravetide.volume') ?? 0.7);
  listener = { x: 0, y: 0 };
  private lastThunder = 0;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = (globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(ctx.destination);
    this.noise = this.makeNoise(2, false);
    this.brown = this.makeNoise(4, true);
    // Ocean bed.
    const sea = ctx.createBufferSource();
    sea.buffer = this.brown;
    sea.loop = true;
    this.seaFilter = ctx.createBiquadFilter();
    this.seaFilter.type = 'lowpass';
    this.seaFilter.frequency.value = 500;
    this.sea = ctx.createGain();
    this.sea.gain.value = 0.25;
    sea.connect(this.seaFilter).connect(this.sea).connect(this.master);
    sea.start();
    // Rain.
    const rain = ctx.createBufferSource();
    rain.buffer = this.noise;
    rain.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    this.rain = ctx.createGain();
    this.rain.gain.value = 0;
    rain.connect(hp).connect(this.rain).connect(this.master);
    rain.start();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('gravetide.muted', this.muted ? '1' : '0');
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  private makeNoise(seconds: number, brown: boolean): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      } else data[i] = w;
    }
    return buf;
  }

  /** Per-frame ambience: sea follows the wind, rain follows the weather. */
  ambience(wind: number, weather: WeatherKind, dt: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sea || !this.seaFilter || !this.rain) return;
    const t = ctx.currentTime;
    const surge = 0.5 + 0.5 * Math.sin(t * 0.35) * Math.sin(t * 0.13 + 1);
    this.sea.gain.setTargetAtTime(0.12 + wind * 0.22 + surge * 0.06, t, 0.5);
    this.seaFilter.frequency.setTargetAtTime(250 + wind * 700 + surge * 150, t, 0.5);
    const rain = weather === 'rain' ? 0.05 : weather === 'storm' || weather === 'black_storm' ? 0.1 : 0;
    this.rain.gain.setTargetAtTime(rain, t, 1.5);
    void dt;
  }

  private voice(gain: number, pan: number, delay = 0): { out: GainNode; at: number } | null {
    const ctx = this.ctx;
    if (!ctx || !this.master || gain <= 0.001) return null;
    const out = ctx.createGain();
    out.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    out.connect(p).connect(this.master);
    return { out, at: ctx.currentTime + delay };
  }

  private noiseBurst(dest: AudioNode, at: number, dur: number, type: BiquadFilterType, freq: number, q = 1, peak = 1): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(f).connect(env).connect(dest);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.05);
  }

  private tone(dest: AudioNode, at: number, freq: number, dur: number, peak: number, type: OscillatorType = 'sine', slideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(env).connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  cannon(x: number, y: number, delay: number, weight = 1): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y);
    const v = this.voice(gain * 0.55 * weight, pan, delay);
    if (!v) return;
    this.tone(v.out, v.at, 70, 0.6, 1, 'sine', 32);
    this.noiseBurst(v.out, v.at, 0.9, 'lowpass', 900 - gain * 300, 0.7, 0.9);
    this.noiseBurst(v.out, v.at, 0.12, 'bandpass', 2400, 0.8, 0.4);
  }

  hit(x: number, y: number, crit: boolean): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y);
    const v = this.voice(gain * 0.5, pan);
    if (!v) return;
    this.noiseBurst(v.out, v.at, 0.25, 'bandpass', 1400, 2.5, 1);
    this.tone(v.out, v.at, 180, 0.18, 0.4, 'triangle', 90);
    if (crit) this.noiseBurst(v.out, v.at + 0.05, 0.5, 'bandpass', 700, 1.5, 0.6);
  }

  splash(x: number, y: number, big: boolean): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y, big ? 2200 : 900);
    const v = this.voice(gain * (big ? 0.5 : 0.18), pan);
    if (!v) return;
    this.noiseBurst(v.out, v.at, big ? 1.4 : 0.45, 'highpass', 900, 0.5, 1);
  }

  explosion(x: number, y: number): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y, 3000);
    const v = this.voice(gain * 0.9, pan);
    if (!v) return;
    this.tone(v.out, v.at, 55, 1.6, 1, 'sine', 25);
    this.noiseBurst(v.out, v.at, 2.2, 'lowpass', 600, 0.5, 1);
  }

  thunder(): void {
    const now = performance.now();
    if (now - this.lastThunder < 3000) return;
    this.lastThunder = now;
    const v = this.voice(0.5, (Math.random() - 0.5) * 0.8, 0.4 + Math.random() * 1.2);
    if (!v) return;
    this.noiseBurst(v.out, v.at, 3.5, 'lowpass', 180, 0.4, 1);
    this.noiseBurst(v.out, v.at + 0.1, 0.6, 'lowpass', 900, 0.4, 0.5);
  }

  /** Harbour bell: inharmonic partials of a cast bronze bell. */
  bell(): void {
    const v = this.voice(0.25, 0);
    if (!v) return;
    for (const [ratio, amp] of [[1, 1], [2.0, 0.5], [2.4, 0.4], [3.0, 0.25], [4.2, 0.15]] as const) this.tone(v.out, v.at, 220 * ratio, 3.5 / ratio + 0.8, amp * 0.4);
  }

  coins(): void {
    const v = this.voice(0.2, 0);
    if (!v) return;
    for (let i = 0; i < 4; i++) this.tone(v.out, v.at + i * 0.045, 2600 + Math.random() * 900, 0.12, 0.3, 'triangle');
  }

  eerie(x: number, y: number): void {
    const { gain, pan } = spatial(this.listener.x, this.listener.y, x, y, 2500);
    const v = this.voice(gain * 0.4, pan);
    if (!v) return;
    this.tone(v.out, v.at, 92, 3, 0.6, 'sine', 61);
    this.tone(v.out, v.at + 0.2, 138.6, 2.5, 0.3, 'sine', 90);
  }

  onEvent(e: GameEvent): void {
    if (!this.ctx) return;
    switch (e.k) {
      case 'volley':
        for (const [x, y, , , delay] of e.balls.slice(0, 8)) this.cannon(x, y, delay / 1000, 0.8);
        break;
      case 'hit':
        if (e.dmg <= 0) this.splash(e.x, e.y, false);
        else this.hit(e.x, e.y, !!e.crit);
        break;
      case 'sunk':
        this.splash(e.x, e.y, true);
        break;
      case 'lance':
        this.eerie(e.x2, e.y2);
        break;
      case 'fx':
        if (e.fx === 'explosion') this.explosion(e.x, e.y);
        else if (e.fx === 'deep_call' || e.fx === 'maw') this.eerie(e.x, e.y);
        else if (e.fx === 'barrage') for (let i = 0; i < 6; i++) this.cannon(e.x, e.y, i * 0.1, 0.6);
        else if (e.fx === 'ram') this.hit(e.x, e.y, true);
        else if (e.fx === 'mortar_launch') this.cannon(e.x, e.y, 0, 1.4);
        else if (e.fx === 'mortar') this.explosion(e.x, e.y);
        else if (e.fx === 'harpoon_miss') this.splash(e.x, e.y, false);
        break;
    }
  }
}
