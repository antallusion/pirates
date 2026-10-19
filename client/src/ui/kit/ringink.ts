// A round button's picture held to its ring's painted hole by its own ink (2026-10-19, tools/mobile/ux/align.mjs RING):
// for a picture that changes (her offer's: a doubloon, a crate, a creature's face) no one inset fits them all, so the
// picture's alpha-weighted middle is read once a picture (a same-origin asset, 48×48 samples) and the picture is moved
// by it — onto the button's middle, then up by the hole's own height over the ring art's middle (2.1 % of the button).

const HOLE_UP = 0.021;
const inks = new Map<string, Promise<{ x: number; y: number; w: number; h: number } | null>>();

function inkOf(src: string): Promise<{ x: number; y: number; w: number; h: number } | null> {
  let p = inks.get(src);
  if (!p) {
    p = new Promise((done) => {
      const im = new Image();
      im.onload = () => {
        try {
          const N = 48;
          const c = document.createElement('canvas');
          c.width = c.height = N;
          const g = c.getContext('2d', { willReadFrequently: true })!;
          // (laid as object-fit: contain lays it in a square)
          const k = Math.min(N / im.naturalWidth, N / im.naturalHeight);
          const w = im.naturalWidth * k, h = im.naturalHeight * k;
          g.drawImage(im, (N - w) / 2, (N - h) / 2, w, h);
          const d = g.getImageData(0, 0, N, N).data;
          let sw = 0, sx = 0, sy = 0;
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const a = d[(y * N + x) * 4 + 3] / 255;
            if (a > 0.1) { sw += a; sx += a * (x + 0.5); sy += a * (y + 0.5); }
          }
          done(sw ? { x: sx / sw / N, y: sy / sw / N, w: 1, h: 1 } : null);
        } catch {
          done(null);
        }
      };
      im.onerror = () => done(null);
      im.src = src;
    });
    inks.set(src, p);
  }
  return p;
}

/** Move the button's picture so its ink sits on the ring's hole (the button's middle, a little up): in shares of the
 *  picture's own box (a square 0.56 of the button, seahud.css .sea-round .k-btn-ico), so a resize keeps it. */
export function holdToHole(btn: HTMLElement): void {
  const img = btn.querySelector<HTMLImageElement>('img.k-btn-ico');
  if (!img) return;
  const src = img.getAttribute('src') ?? '';
  if (!src || img.dataset.inkFor === src) return;
  img.dataset.inkFor = src;
  void inkOf(src).then((ink) => {
    if (!ink || img.getAttribute('src') !== src) return;
    const dx = (0.5 - ink.x) * 100, dy = (0.5 - ink.y - HOLE_UP / ICON_SHARE) * 100;
    img.style.translate = `${dx.toFixed(2)}% ${dy.toFixed(2)}%`;
  });
}

/** The picture's share of its round button (seahud.css: inset 22 %). */
const ICON_SHARE = 0.56;
