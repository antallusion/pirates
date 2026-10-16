// The start that always goes on (owner, 2026-10-16: «при развороте телефона в горизонталку вначале игры ничего не
// происходит … нужно сделать чтобы запускалось всегда идеально»).
//  - bootMark(): the start's stages, kept on `__boot` (index.html's shell reads them; ?bootdebug shows them and sends
//    them to the server's log, as a stalled start does by itself).
//  - watchViewport(): a phone turned. iOS (Safari and Telegram's view) fires its `resize` while the page still has the
//    old size, or none at all after the turn: every `resize` listener (the renderer, the HUD, the fit) measured the
//    upright screen and kept it. The size is looked at again after a turn, a viewport change, a return to the page and
//    once a second; a change no `resize` told of is told with one.

type Boot = { t0: number; log: string[]; ready: boolean; debug: boolean };
type G = typeof globalThis & { __boot?: Boot; __bootMark?: (s: string) => void };
const g = globalThis as G;

/** A stage of the start (index.html's shell keeps the log; without it, the console under ?bootdebug). */
export function bootMark(stage: string): void {
  try {
    if (g.__bootMark) g.__bootMark(stage);
    else if (/[?&]bootdebug\b/.test(location.search)) console.info('[boot]', Math.round(performance.now()), stage);
  } catch {
    /* never in the start's way */
  }
}

let lastW = -1, lastH = -1;
let watching = false;

/** The size as the page has it now: a change no `resize` told of goes out as one. */
export function checkViewport(): boolean {
  const w = innerWidth, h = innerHeight;
  if (w === lastW && h === lastH) return false;
  // (the listener below takes the new size as told)
  dispatchEvent(new Event('resize'));
  return true;
}

const timers: number[] = [];
/** A turn or a viewport change: the size is looked at again over the next three seconds (iOS settles late). */
export function settleViewport(why: string): void {
  bootMark(`vp ${why} ${innerWidth}x${innerHeight}`);
  for (const t of timers.splice(0)) clearTimeout(t);
  for (const ms of [0, 60, 160, 350, 700, 1200, 2000, 3200]) timers.push(setTimeout(checkViewport, ms) as unknown as number);
}

export function watchViewport(): void {
  if (watching) return;
  watching = true;
  lastW = innerWidth;
  lastH = innerHeight;
  // first among the listeners: the size every `resize` (the browser's or ours) was told at
  addEventListener('resize', () => {
    if (innerWidth !== lastW || innerHeight !== lastH) {
      const turned = (innerWidth > innerHeight) !== (lastW > lastH);
      lastW = innerWidth;
      lastH = innerHeight;
      if (turned) document.documentElement.classList.toggle('vp-land', innerWidth > innerHeight);
      bootMark(`resize ${lastW}x${lastH}`);
    }
  }, true);
  document.documentElement.classList.toggle('vp-land', innerWidth > innerHeight);
  addEventListener('orientationchange', () => settleViewport('turn'));
  screen.orientation?.addEventListener?.('change', () => settleViewport('orientation'));
  matchMedia('(orientation: portrait)').addEventListener?.('change', () => settleViewport('media'));
  visualViewport?.addEventListener('resize', () => settleViewport('visual'));
  addEventListener('pageshow', () => settleViewport('pageshow'));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) settleViewport('visible');
  });
  addEventListener('fullscreenchange', () => settleViewport('fullscreen'), true);
  // and once a second, whatever told or did not
  setInterval(checkViewport, 1000);
}
