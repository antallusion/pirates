// The loading screen (owner, 2026-10-15: «сделай прелоадер до загрузки островов, выхода в море и абордажа, чтобы этот
// прелоадер загружал все что нужно, прежде чем показывать игроку»). A scene asks for what it shows; the screen comes up
// only when that takes longer than a blink (LOADER_DELAY), shows the progress and a tip, and never holds forever: at
// its timeout the scene goes on with what is in.
//
//   const h = beginLoad('isle', 10000);
//   h.need(ids);            // asset ids (client/src/assets.ts), loaded and decoded first
//   h.imgs(root);           // the <img>s under an element, decoded
//   h.settle();             // and the pictures the renderers asked for while it was up (what is on screen)
//   await h.done();         // then the scene shows; h.close() drops it unfinished (the scene left)

import { assetStats, assetUrl, assetsBusy, ensureAssets, hushWarming } from '../assets.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/loader.ts';
import { settings } from '../settings.ts';

const L = dict(EN, RU);

export type LoadKind = 'start' | 'isle' | 'sea' | 'battle';

/** Shorter than this, the scene simply shows (no flash of a loading screen). */
export const LOADER_DELAY = 150;
const TIPS = 8;

let root: HTMLElement | null = null;
let barEl: HTMLElement | null = null;
let titleEl: HTMLElement | null = null;
let tipEl: HTMLElement | null = null;
let owner: Handle | null = null;
let tipN = Math.floor(Math.random() * TIPS);
/** QA: the screens shown and their times. */
export const loadLog: { kind: LoadKind; ms: number; shown: boolean; timedOut: boolean; total: number }[] = [];

function build(): void {
  if (root) return;
  root = document.createElement('div');
  root.id = 'gt-load';
  root.className = 'hidden';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = '<div class="gl-card"><i class="gl-helm" aria-hidden="true"></i><b class="gl-title"></b><span class="gl-bar"><i></i></span><p class="gl-tip"></p></div>';
  document.body.append(root);
  barEl = root.querySelector('.gl-bar i');
  titleEl = root.querySelector('.gl-title');
  tipEl = root.querySelector('.gl-tip');
}

export interface Handle {
  kind: LoadKind;
  /** These asset ids first (decoded). */
  need(ids: Iterable<string>): Handle;
  /** The pictures under this element, decoded. */
  imgs(el: Element | null): Handle;
  /** Also wait for the pictures the screen's renderer asked for (what it draws), until none is in flight. */
  settle(): Handle;
  /** All in, or the timeout. */
  done(): Promise<void>;
  /** Drop it (the scene left before it was in). */
  close(): void;
}

/** A scene's loading begins: the screen comes up after LOADER_DELAY if it is not all in by then. */
export function beginLoad(kind: LoadKind, timeout = 10000): Handle {
  const t0 = performance.now();
  // the background's fetching stands aside while the scene loads
  hushWarming(timeout);
  const parts: Promise<unknown>[] = [];
  let total = 0, got = 0;
  let shown = false, closed = false, finished = false, timedOut = false, settleOn = false;
  let finishP: Promise<void> | null = null;
  const prog = () => {
    if (owner === h && barEl) barEl.style.width = `${Math.round((total ? Math.min(1, got / total) : 0) * 100)}%`;
  };
  const show = () => {
    if (closed || finished || shown) return;
    shown = true;
    build();
    owner = h;
    titleEl!.textContent = L(kind);
    tipN = (tipN + 1) % TIPS;
    tipEl!.textContent = L(`tip${tipN}` as keyof typeof EN);
    const helm = assetUrl('ui.helm');
    root!.querySelector<HTMLElement>('.gl-helm')!.style.backgroundImage = helm ? `url("${helm}")` : '';
    root!.classList.toggle('still', settings().reduceMotion);
    root!.classList.remove('hidden', 'out');
    prog();
  };
  const timer = setTimeout(show, LOADER_DELAY);
  const hide = () => {
    clearTimeout(timer);
    if (owner !== h || !root) return;
    owner = null;
    if (settings().reduceMotion) root.classList.add('hidden');
    else {
      root.classList.add('out');
      const r = root;
      setTimeout(() => { if (!owner) r.classList.add('hidden'); }, 180);
    }
  };
  const h: Handle = {
    kind,
    need(ids) {
      const list = [...ids];
      total += list.length;
      prog();
      let mine = 0;
      parts.push(ensureAssets(list, {
        onProgress: (d) => {
          got += d - mine;
          mine = d;
          prog();
        },
      }));
      return h;
    },
    imgs(el) {
      if (!el) return h;
      const list = [...el.querySelectorAll('img')].filter((i) => i.getAttribute('src'));
      total += list.length;
      prog();
      parts.push(Promise.all(list.map((i) => (i.decode ? i.decode() : Promise.resolve()).catch(() => undefined).then(() => {
        got++;
        prog();
      }))));
      return h;
    },
    settle() {
      settleOn = true;
      return h;
    },
    done() {
      finishP ??= (async () => {
        const all = (async () => {
          // the renderers ask for what they draw on their next frames: a frame or two first
          if (settleOn) await frames(2);
          await Promise.all(parts);
          if (settleOn) {
            // until nothing the screens drew is in flight (two frames running, so a frame's new asks count)
            let quiet = 0;
            const base = got, l0 = assetStats().loaded;
            while (quiet < 2 && !closed && !finished) {
              const busy = assetsBusy();
              if (busy) {
                // the bar: what came since the settling began, of that and what is still asked for
                got = base + (assetStats().loaded - l0);
                total = Math.max(total, got + busy);
                prog();
                quiet = 0;
                await new Promise((r) => setTimeout(r, 60));
              } else quiet++;
              await frames(1);
            }
          }
        })();
        await Promise.race([all, new Promise<void>((r) => setTimeout(() => ((timedOut = true), r()), Math.max(0, timeout - (performance.now() - t0))))]);
        finished = true;
        if (owner === h || !owner) hushWarming(1500, true);
        got = total;
        prog();
        loadLog.push({ kind, ms: Math.round(performance.now() - t0), shown, timedOut, total });
        if (loadLog.length > 40) loadLog.shift();
        hide();
      })();
      return finishP;
    },
    close() {
      closed = true;
      finished = true;
      hide();
    },
  };
  return h;
}

/** Whether a loading screen is up now. */
export function loading(): boolean {
  return owner !== null;
}

function frames(n: number): Promise<void> {
  return new Promise((r) => {
    const step = () => (--n <= 0 ? r() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
}
