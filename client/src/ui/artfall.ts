// A painting with its fallbacks (shared/src/data/paintart.ts): the first of a list that the manifest has is shown, and
// if its file fails to load the next one takes its place — the old art stays behind every new painting. Nothing is
// fetched before it is shown: an <img> or a background asks for its file when it is put on the page.

import { assetUrl } from '../assets.ts';
import { DEAD_ART, esc } from './dom.ts';

/** The addresses of a list's paintings that exist, best first (each once). */
export function artUrls(ids: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const u = id ? assetUrl(id) : null;
    if (u && !out.includes(u) && !dead.has(u)) out.push(u);
  }
  return out;
}

/** Files that failed once this session: skipped from then on (dom.ts's listener adds an <img>'s). */
const dead = DEAD_ART;

/** An <img> of the first painting of the list, the rest behind it ('' when none exists). */
export function artImg(ids: readonly (string | null | undefined)[], cls: string, extra = ''): string {
  const urls = artUrls(ids);
  if (!urls.length) return '';
  return `<img class="${cls}" src="${esc(urls[0])}"${urls.length > 1 ? ` data-fb="${esc(urls.slice(1).join('|'))}"` : ''} alt="" draggable="false" decoding="async"${extra} />`;
}

/** A CSS custom property set to the first painting of the list (`url(...)`, or `none`); if its file fails, the next. */
export function artVar(el: HTMLElement, prop: string, ids: readonly (string | null | undefined)[]): void {
  const urls = artUrls(ids);
  const set = (k: number) => el.style.setProperty(prop, urls[k] ? `url('${urls[k]}')` : 'none');
  if (el.dataset.artFor === `${prop}:${urls.join('|')}`) return;
  el.dataset.artFor = `${prop}:${urls.join('|')}`;
  set(0);
  if (urls.length < 2 || typeof Image === 'undefined') return;
  // (the same address the background asks for: one fetch, the browser's cache answers both)
  const probe = (k: number) => {
    const im = new Image();
    im.onerror = () => {
      dead.add(urls[k]);
      if (k + 1 < urls.length) {
        set(k + 1);
        probe(k + 1);
      }
    };
    im.src = urls[k];
  };
  probe(0);
}

/** An inline style of a background painting with its fallbacks (for markup built as a string): the element carries
 *  `data-artbg`, and artBgWire() sets it once it is on the page. */
export function artBgAttr(ids: readonly (string | null | undefined)[]): string {
  const urls = artUrls(ids);
  if (!urls.length) return '';
  return ` style="background-image:url('${esc(urls[0])}')"${urls.length > 1 ? ` data-artbg="${esc(urls.join('|'))}"` : ''}`;
}

/** The backgrounds of artBgAttr under `root`: each probed, its next painting on an error. */
export function artBgWire(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-artbg]').forEach((el) => {
    const urls = el.dataset.artbg!.split('|');
    delete el.dataset.artbg;
    const probe = (k: number) => {
      const im = new Image();
      im.onerror = () => {
        dead.add(urls[k]);
        if (k + 1 < urls.length) {
          el.style.backgroundImage = `url('${urls[k + 1]}')`;
          probe(k + 1);
        }
      };
      im.src = urls[k];
    };
    probe(0);
  });
}
