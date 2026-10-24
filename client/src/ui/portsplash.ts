// The harbour seen on arrival (coordinator, 2026-10-25: on a phone the port window's band is too low to show the
// painted harbour the owner paid for): when she docks, the harbour's painting full-width for about a second and a half
// with the port's name, fading into the port window under it. A tap skips it. Once a port a session (her first visit is
// always a first in its session); never over a film (it waits for the film to end) and never if the picture is slow.

import { harbourArt } from '../../../shared/src/data/paintart.ts';
import type { PortPublic } from '../../../shared/src/protocol.ts';
import { artUrls } from './artfall.ts';
import { esc } from './dom.ts';

const seen = new Set<string>();
const HOLD = 1500;
const FADE_IN = 250;
const FADE_OUT = 450;

/** Arrived at a port: its splash, if not yet shown this session. `name` and `sub` are the reader's words. */
export function portSplash(port: PortPublic, name: string, sub: string): void {
  if (seen.has(port.id) || typeof document === 'undefined') return;
  seen.add(port.id);
  const urls = artUrls(harbourArt(port));
  if (!urls.length) return;
  const since = performance.now();
  // the picture first (a slow line: no splash at all rather than an empty one)
  const img = new Image();
  let ready = false;
  img.onload = () => (ready = true);
  img.onerror = () => {
    // its next painting, if the first fails
    if (urls.length > 1) {
      urls.shift();
      img.src = urls[0];
    }
  };
  img.src = urls[0];
  const t = setInterval(() => {
    const waited = performance.now() - since;
    if (document.querySelector('.film') && waited < 30_000) return; // a film of the arrival plays first
    if (!ready) {
      if (waited > 2500) clearInterval(t);
      return;
    }
    clearInterval(t);
    show(img.src, name, sub);
  }, 120);
}

/** The splash itself (QA: `hold` keeps it up that long). */
export function show(url: string, name: string, sub: string, hold = HOLD): void {
  document.getElementById('port-splash')?.remove();
  const el = document.createElement('div');
  el.id = 'port-splash';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', name);
  el.style.backgroundImage = `url('${url}')`;
  el.innerHTML = `<div class="ps-t"><b>${esc(name)}</b><span>${esc(sub)}</span></div>`;
  document.body.append(el);
  let gone = false;
  const close = (fast: boolean) => {
    if (gone) return;
    gone = true;
    el.classList.remove('on');
    setTimeout(() => el.remove(), fast ? 160 : FADE_OUT);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    close(true);
  });
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => close(false), FADE_IN + hold);
}

/** QA: the splash shown again for a port (forget it was seen). */
export function portSplashReset(id?: string): void {
  if (id) seen.delete(id);
  else seen.clear();
}
