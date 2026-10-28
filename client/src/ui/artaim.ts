// Every banner painting framed on its subject, at whatever size its box has (owner, 2026-10-28: «большинство картинок в
// таких окошках отрезаны поверху, надо все выставить правильно и четко чтобы лица попадали в окошки и на мобиле и на
// десктопе и везде»; shared/src/data/artaim.ts). A banner's box gets `--art-pos` — its background or object position —
// when it is put on the page, when its picture changes (a fallback, a new beast) and when its size changes (a phone
// turned, a narrower window); the stylesheets read `var(--art-pos, center 25%)`. A picture with no measured focus keeps
// the fallback.

import { artAim } from '../../../shared/src/data/artaim.ts';

/** The banners: the island games' and the trek's, the encounters', the holidays', the legendary ships', the campaign's
 *  news and book, the zone boss's target strip, the sea beast's bar and the painted window headers. */
export const ART_BOXES = '.mg-art, .enc-art, .hol-art, .card-art, .cn-art, .cb-art, .tg-zb, #hud-boss, .art-head';

const URL_RE = /url\((['"]?)(.*?)\1\)/g;

/** The painting a box shows: an <img>'s address, or the first background picture with a measured focus. */
function pictureOf(el: HTMLElement): string | null {
  if (el instanceof HTMLImageElement) return el.currentSrc || el.getAttribute('src');
  const bg = `${el.style.backgroundImage} ${el.style.getPropertyValue('--card')} ${getComputedStyle(el).backgroundImage}`;
  for (const m of bg.matchAll(URL_RE)) if (m[2]) return m[2];
  return null;
}

let ro: ResizeObserver | null = null;
const watched = new WeakSet<Element>();

/** Frame one banner box now (and on its every resize from then on). */
export function aimArt(el: HTMLElement): void {
  if (!el.isConnected) return;
  const url = pictureOf(el);
  const pos = url ? artAim(url, el.clientWidth, el.clientHeight) : null;
  if (pos) el.style.setProperty('--art-pos', pos);
  else el.style.removeProperty('--art-pos');
  if (ro && !watched.has(el)) {
    watched.add(el);
    ro.observe(el);
  }
}

/** Frame every banner under `root` (and `root` itself). */
export function aimArtIn(root: ParentNode): void {
  if (root instanceof HTMLElement && root.matches(ART_BOXES)) aimArt(root);
  root.querySelectorAll<HTMLElement>(ART_BOXES).forEach(aimArt);
}

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (!el.isConnected) {
          ro!.unobserve(el);
          watched.delete(el);
        } else aimArt(el);
      }
    });
  }
  const start = () => {
    aimArtIn(document.body);
    new MutationObserver((list) => {
      for (const r of list) for (const n of r.addedNodes) if (n instanceof HTMLElement) aimArtIn(n);
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
  // an <img> banner's own picture (its fallback after an error, its natural size once loaded)
  document.addEventListener('load', (e) => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.matches(ART_BOXES)) aimArt(t);
  }, true);
}
