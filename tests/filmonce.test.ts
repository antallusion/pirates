// One film for one moment (owner, 2026-10-23: «всякие смотровые, когда я делаю квест или подплываю — запускается два
// разных видоса зачем-то и не сразу показаны квесты»): a second moment's film right after the first is let go and stays
// unseen; a seen film never plays by itself again but is offered («Посмотреть ролик снова»); a film that does not start
// at once is let go; a lookout's landing and the same island's next landing share one film.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** A page just big enough for the film's frame (no DOM in the tests). */
function fakePage(): { body: unknown[]; store: Map<string, string> } {
  const body: unknown[] = [];
  const store = new Map<string, string>();
  const el = (tag: string): Record<string, unknown> => {
    const e: Record<string, unknown> = {
      tag, id: '', style: {}, textContent: '', currentTime: 0, children: [] as unknown[],
      classList: { add() {}, remove() {}, contains: () => false },
      setAttribute() {}, addEventListener() {}, focus() {}, pause() {},
      appendChild(c: unknown) { (e.children as unknown[]).push(c); },
      remove() { const i = body.indexOf(e); if (i >= 0) body.splice(i, 1); },
      play: () => Promise.resolve(),
    };
    return e;
  };
  const g = globalThis as unknown as Record<string, unknown>;
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  g.matchMedia = () => ({ matches: false });
  g.requestAnimationFrame = (f: () => void) => setTimeout(f, 0);
  g.addEventListener = () => {};
  g.removeEventListener = () => {};
  g.document = {
    createElement: el, activeElement: null,
    body: { appendChild: (c: unknown) => void body.push(c) },
    getElementById: (id: string) => body.find((x) => (x as { id: string }).id === id) ?? null,
  };
  g.fetch = async () => ({ json: async () => ['cut_lighthouse', 'cut_landing', 'cut_port'] });
  return { body, store };
}

test('a lookout’s landing and the next: one film; a seen one is offered again, never played by itself', async () => {
  const page = fakePage();
  const { loadFilms, playFilm, FILM_GAP_MS, FILM_START_MS, FILM_WAIT_MS } = await import('../client/src/ui/cutscene.ts');
  await loadFilms();
  assert.equal(playFilm('cut_lighthouse'), true, 'the lookout’s landing: its film');
  assert.equal(playFilm('cut_landing'), false, 'the same visit’s next landing: none');
  const seen = () => JSON.parse(page.store.get('gravetide.filmsSeen') ?? '[]') as string[];
  assert.deepEqual(seen(), ['cut_lighthouse'], 'the one let go is still unseen: it plays at a later moment');
  assert.ok(FILM_GAP_MS >= 60_000, 'a minute and more between two films');
  assert.ok(FILM_START_MS <= 4000, 'a film that does not start soon is let go');
  assert.ok(FILM_WAIT_MS <= 6000, 'nor does one wait long behind a window: it would come after the quest was read');
  // the film never started (no frame in this page): let go at once, unseen again
  await new Promise((r) => setTimeout(r, FILM_START_MS + 600));
  assert.deepEqual(seen(), [], 'a film that never started is not counted as seen');
  // seen, then its moment again: the small «Посмотреть ролик снова», not the film
  page.store.set('gravetide.filmsSeen', JSON.stringify(['cut_port']));
  assert.equal(playFilm('cut_port'), false);
  const pill = page.body.find((x) => (x as { id: string }).id === 'film-replay') as { textContent: string } | undefined;
  assert.ok(pill, 'the replay offered');
  assert.match(pill!.textContent, /▶/);
});

test('one island, one landing film, in main.ts; the campaign’s words named up front by the page', () => {
  const main = readFileSync(new URL('../client/src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /if \(at === null \|\| !filmIsles\.has\(at\)\) \{/);
  const st = readFileSync(new URL('../server/src/net/static.ts', import.meta.url), 'utf8');
  assert.match(st, /await walk\('\/shared\/src\/data\/campaign\/patterns\.ts'\);/);
});
