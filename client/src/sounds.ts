// The sample bank (owner 2026-11-01: «саунддизайн крутой» — real recordings in place of the synthesized sound): the
// files of assets/audio (tools/audio/build.ts → index.json), fetched and decoded into AudioBuffers on demand. The core
// set (index `preload`, ≤ 1.5 MB) on the first gesture, the other effects a few seconds later in the background, the
// ambience beds when a scene first asks for them; the music is not here — it streams (music.ts).
// Opus in Ogg where the browser plays it, AAC (.m4a) elsewhere (Safari and iOS before Opus): one failed decode of an
// Ogg switches the whole bank to AAC. Until a sound is decoded the engine plays its procedural recipe (audio.ts).

export type SoundKind = 'sfx' | 'amb' | 'music';

export interface SoundEntry {
  kind: SoundKind;
  bus: 'sea' | 'combat' | 'ui' | 'music';
  files: string[];
  dur: number[];
  bytes: [number, number][];
  loop?: boolean;
  preload?: boolean;
}

export interface SoundIndex {
  v: string;
  sounds: Record<string, SoundEntry>;
}

/** Ogg Opus where the browser says it plays it, else AAC. Pure on its probe (tested). */
export function pickFormat(canPlay: (mime: string) => string): 'ogg' | 'm4a' {
  return canPlay('audio/ogg; codecs="opus"') ? 'ogg' : 'm4a';
}

/** A variant other than the last one played (two or more), at random: pure on its `rnd`. */
export function pickVariant(n: number, last: number, rnd: number): number {
  if (n <= 1) return 0;
  const i = Math.floor(rnd * (n - 1));
  return last >= 0 && i >= last ? i + 1 : i;
}

/** The bytes the preload fetches (the core) and the rest, by format. */
export function preloadBytes(index: SoundIndex, fmt: 'ogg' | 'm4a'): { core: number; lazySfx: number; amb: number; music: number } {
  const j = fmt === 'ogg' ? 0 : 1;
  const out = { core: 0, lazySfx: 0, amb: 0, music: 0 };
  for (const e of Object.values(index.sounds)) {
    const b = e.bytes.reduce((s, x) => s + x[j], 0);
    if (e.kind === 'music') out.music += b;
    else if (e.kind === 'amb') out.amb += b;
    else if (e.preload) out.core += b;
    else out.lazySfx += b;
  }
  return out;
}

export const AUDIO_BASE = '/assets/audio/';

export class SampleBank {
  index: SoundIndex | null = null;
  fmt: 'ogg' | 'm4a' = 'ogg';
  private buffers = new Map<string, AudioBuffer[]>();
  private loading = new Map<string, Promise<boolean>>();
  private last = new Map<string, number>();
  private failed = new Set<string>();
  private indexP: Promise<SoundIndex | null> | null = null;
  /** Decode errors (QA reads them: tools and the audio test page). */
  readonly errors: string[] = [];

  private ctx: BaseAudioContext;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    try {
      this.fmt = pickFormat((m) => (typeof Audio === 'function' ? new Audio().canPlayType(m) : ''));
    } catch {
      this.fmt = 'm4a';
    }
  }

  /** index.json, once. */
  loadIndex(): Promise<SoundIndex | null> {
    this.indexP ??= fetch(`${AUDIO_BASE}index.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<SoundIndex>) : null))
      .then((j) => (this.index = j))
      .catch(() => null);
    return this.indexP;
  }

  /** A file's address in the bank's format, versioned by the index (kept by the browser for good). */
  url(file: string, fmt = this.fmt): string {
    return `${AUDIO_BASE}${file}.${fmt}?v=${this.index?.v ?? '0'}`;
  }

  entry(key: string): SoundEntry | undefined {
    return this.index?.sounds[key];
  }

  /** Decoded and ready. */
  has(key: string): boolean {
    return (this.buffers.get(key)?.length ?? 0) > 0;
  }

  /** Every variant of a sound fetched and decoded (once; a failure is remembered and not asked again). */
  ensure(key: string): Promise<boolean> {
    if (this.has(key)) return Promise.resolve(true);
    if (this.failed.has(key)) return Promise.resolve(false);
    let p = this.loading.get(key);
    if (p) return p;
    p = (async () => {
      const idx = await this.loadIndex();
      const e = idx?.sounds[key];
      if (!e || (e.kind === 'music' && e.loop)) return false; // (a looped score streams: music.ts)
      const out = await Promise.all(e.files.map((f) => this.decodeFile(f)));
      const ok = out.filter((b): b is AudioBuffer => !!b);
      if (ok.length) this.buffers.set(key, ok);
      else this.failed.add(key);
      return ok.length > 0;
    })();
    this.loading.set(key, p);
    void p.finally(() => this.loading.delete(key));
    return p;
  }

  private async decodeFile(file: string): Promise<AudioBuffer | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const fmt = this.fmt;
      try {
        const r = await fetch(this.url(file, fmt));
        if (!r.ok) throw new Error(`${r.status}`);
        const data = await r.arrayBuffer();
        return await new Promise<AudioBuffer>((ok, no) => {
          // (the callback form: Safari 14 has no promise from decodeAudioData)
          const p = this.ctx.decodeAudioData(data, ok, no) as Promise<AudioBuffer> | undefined;
          p?.catch?.(no);
        });
      } catch (e) {
        this.errors.push(`${file}.${fmt}: ${String((e as Error)?.message ?? e)}`);
        // An Ogg this browser will not decode after all: AAC for the whole bank from now on, and this one again.
        if (fmt === 'ogg') {
          this.fmt = 'm4a';
          continue;
        }
        return null;
      }
    }
    return null;
  }

  /** A variant (not the last one played when there are more). */
  pick(key: string): AudioBuffer | null {
    const list = this.buffers.get(key);
    if (!list?.length) return null;
    const i = pickVariant(list.length, this.last.get(key) ?? -1, Math.random());
    this.last.set(key, i);
    return list[i];
  }

  /** The core set first, then (after `restDelayMs`) every other effect, one at a time so the game's own loads go first. */
  async preload(restDelayMs = 4000): Promise<void> {
    const idx = await this.loadIndex();
    if (!idx) return;
    const all = Object.entries(idx.sounds);
    await Promise.all(all.filter(([, e]) => e.preload).map(([k]) => this.ensure(k)));
    await new Promise((ok) => setTimeout(ok, restDelayMs));
    for (const [k, e] of all) if (e.kind === 'sfx' && !e.preload) await this.ensure(k);
  }
}
