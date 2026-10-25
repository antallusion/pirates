// A lazy part of the game (the campaign's words, its chapters) asked for again when the connection drops on the way
// (prod 2026-10-25: phones on mobile data lost modules mid-load): three more tries, 1 s, 3 s and 7 s apart; the bundle's
// loader (client/index.html) has most likely put the file in the browser's cache already.

const WAIT = [1000, 3000, 7000];

export function importAgain<T>(load: () => Promise<T>, wait: readonly number[] = WAIT): Promise<T> {
  return load().catch((e: unknown) => {
    if (!wait.length) throw e;
    return new Promise<void>((r) => setTimeout(r, wait[0])).then(() => importAgain(load, wait.slice(1)));
  });
}
