// The game's films (owner, 2026-10-03: cutscenes made with Kling, tools/art/videos.py): a short film over the whole
// screen at its moment — the first night ashore, the first boarding, the first win and the first loss, the first
// harbour, the first storm — once for each moment; any click, tap or key skips it. A film not made yet is simply not
// shown (assets/video/index.json lists those there are).

const SEEN = 'gravetide.filmsSeen';
let films: Set<string> | null = null;
let playing = false;
const waiting: { id: string; done?: () => void }[] = [];

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

/** Has this film been shown already (or is there none to show)? */
export function filmDue(id: string): boolean {
  return !!films?.has(id) && !seen().has(id);
}

/** Show a film over the screen if it is due; `done` runs when it ends or is skipped (at once when there is none).
 *  Films wait their turn: two moments together play one after the other. */
export function playFilm(id: string, done?: () => void, opts: { always?: boolean } = {}): boolean {
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
  show(id, done);
  return true;
}

function show(id: string, done?: () => void): void {
  playing = true;
  const el = document.createElement('div');
  el.className = 'film';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  const v = document.createElement('video');
  v.src = `/assets/video/${id}.mp4`;
  v.playsInline = true;
  v.autoplay = true;
  v.preload = 'auto';
  v.volume = 0.8;
  el.appendChild(v);
  const skip = document.createElement('small');
  skip.className = 'film-skip';
  skip.textContent = document.documentElement.lang === 'ru' ? 'Нажмите, чтобы пропустить' : 'Click to skip';
  el.appendChild(skip);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('on'));
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
  const key = (e: KeyboardEvent) => {
    e.stopPropagation();
    end();
  };
  el.addEventListener('pointerup', end);
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
