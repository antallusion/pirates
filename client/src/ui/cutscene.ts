// The game's films (owner, 2026-10-03: cutscenes made with Kling, tools/art/videos.py): a short film over the whole
// screen at its moment — the first night ashore, the first boarding, the first win and the first loss, the first
// harbour, the first storm — once for each moment; any click, tap or key skips it. A film not made yet is simply not
// shown (assets/video/index.json lists those there are).

import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/film.ts';

const L = dict(EN, RU);
const SEEN = 'gravetide.filmsSeen';
let films: Set<string> | null = null;
let playing = false;
const waiting: { id: string; done?: () => void }[] = [];
/** Is the captain busy at a window or a form (main.ts sets it)? A film waits for her rather than open over it. */
let busy: () => boolean = () => false;
/** How long a film waits for a busy captain before it is let go (to play at the next such moment). */
export const FILM_WAIT_MS = 20_000;

/** The window gate: true while a window that is not the film's own moment or a text field holds the captain. */
export function setFilmGate(gate: () => boolean): void {
  busy = gate;
}

/** A text field she is typing into: a film never takes the keys from under her fingers. */
export function typing(): boolean {
  const a = document.activeElement as HTMLElement | null;
  if (!a || a === document.body) return false;
  if (a.isContentEditable) return true;
  if (a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement) return true;
  return a instanceof HTMLInputElement && !/^(button|submit|reset|checkbox|radio|range|color|file|image)$/.test(a.type);
}

/** Which films there are (once, at start). */
export async function loadFilms(): Promise<void> {
  try {
    const list = (await (await fetch('/assets/video/index.json', { cache: 'no-cache' })).json()) as string[];
    films = new Set(list);
  } catch {
    films = new Set();
  }
}

function seen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

/** Is this film made (in assets/video/index.json)? */
export function filmExists(id: string): boolean {
  return !!films?.has(id);
}

/** Has this film been shown already (or is there none to show)? */
export function filmDue(id: string): boolean {
  return !!films?.has(id) && !seen().has(id);
}

/** Show a film over the screen if it is due; `done` runs when it ends or is skipped (at once when there is none).
 *  Films wait their turn: two moments together play one after the other. */
export function playFilm(id: string, done?: () => void, opts: { always?: boolean; over?: boolean } = {}): boolean {
  if (!films?.has(id) || (!opts.always && seen().has(id)) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    done?.();
    return false;
  }
  const s = seen();
  s.add(id);
  localStorage.setItem(SEEN, JSON.stringify([...s]));
  if (playing) {
    waiting.push({ id, done });
    return true;
  }
  // A window or a form up (the guild's founding, a giver's offer, a typed name): the film waits its turn and is let go
  // if she stays at it (owner, 2026-10-05: a film over the guild form swallowed her typing). Her own moment's window
  // (the shipwreck's account) is no bar: `over`.
  if (!opts.over && (typing() || busy())) {
    playing = true;
    const t0 = performance.now();
    const wait = setInterval(() => {
      if (!typing() && !busy()) {
        clearInterval(wait);
        show(id, done);
      } else if (performance.now() - t0 > FILM_WAIT_MS) {
        clearInterval(wait);
        const left = seen();
        left.delete(id);
        localStorage.setItem(SEEN, JSON.stringify([...left]));
        playing = false;
        done?.();
        const next = waiting.shift();
        if (next) playFilm(next.id, next.done, { always: true });
      }
    }, 400);
    return true;
  }
  show(id, done);
  return true;
}

function show(id: string, done?: () => void): void {
  playing = true;
  const el = document.createElement('div');
  el.className = 'film';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', L('label'));
  el.tabIndex = -1;
  const v = document.createElement('video');
  v.src = `/assets/video/${id}.mp4`;
  v.playsInline = true;
  v.autoplay = true;
  v.preload = 'auto';
  v.volume = 0.8;
  el.appendChild(v);
  const skip = document.createElement('small');
  skip.className = 'film-skip';
  skip.textContent = L(matchMedia('(pointer: coarse)').matches ? 'skipTouch' : 'skip');
  el.appendChild(skip);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
  // The keys come to it, not to a button under it.
  (document.activeElement as HTMLElement | null)?.blur?.();
  el.focus({ preventScroll: true });
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    removeEventListener('keydown', key, true);
    el.classList.remove('on');
    v.pause();
    setTimeout(() => {
      el.remove();
      playing = false;
      done?.();
      const next = waiting.shift();
      if (next) show(next.id, next.done);
    }, 450);
  };
  // Any key (Esc, Space, Enter …) skips it and goes no further: not to the game, not to a window under it.
  const key = (e: KeyboardEvent) => {
    e.stopImmediatePropagation();
    e.preventDefault();
    end();
  };
  // A tap, a click (the mouse's, a script's, a screen reader's) or a press: whichever comes first ends it, once.
  const tap = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    end();
  };
  el.addEventListener('pointerup', tap);
  el.addEventListener('click', tap);
  el.addEventListener('touchend', tap, { passive: false });
  addEventListener('keydown', key, true);
  v.addEventListener('ended', end);
  v.addEventListener('error', end);
  // With its sound if the browser lets it, silent otherwise.
  void v.play().catch(() => {
    v.muted = true;
    void v.play().catch(end);
  });
  // A film that never starts does not hold the game.
  setTimeout(() => { if (!over && v.currentTime === 0) end(); }, 8000);
}
