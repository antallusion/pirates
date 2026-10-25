// «What stands before the match», checked in code instead of a regex lookbehind.
// Safari before 16.4 (every iPhone on iOS 15–16.3, macOS Safari 15–16.3) cannot even parse `(?<=…)` or `(?<!…)`: one
// such regex in any module the game loads fails the whole start (prod 2026-10-25: «Invalid regular expression: invalid
// group specifier name» from iOS 15.8 and Safari 16.3). tests/compat-scan.test.ts keeps them out of the client's code.

/** The character just before index `i` of `s` — a whole code point (a surrogate pair) when `unicode` — or '' at 0. */
export function charBefore(s: string, i: number, unicode = false): string {
  if (i <= 0) return '';
  const lo = s.charCodeAt(i - 1);
  if (unicode && i >= 2 && lo >= 0xdc00 && lo <= 0xdfff) {
    const hi = s.charCodeAt(i - 2);
    if (hi >= 0xd800 && hi <= 0xdbff) return s.slice(i - 2, i);
  }
  return s[i - 1];
}

/** The next match of the global `re` in `s` (from its lastIndex) whose start passes `ok(the character before it, the
 *  match)` — a lookbehind at the start of the match, done in code. A refused match is tried again one character on,
 *  as the engine does when a lookbehind fails; so `re` must be such that, where a match was refused, nothing else of it
 *  could have matched at that same place (the guarded alternatives start with characters no other one starts with). */
export function execAfter(re: RegExp, s: string, ok: (before: string, m: RegExpExecArray) => boolean): RegExpExecArray | null {
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (ok(charBefore(s, m.index, re.unicode), m)) return m;
    const cp = re.unicode ? s.codePointAt(m.index) ?? 0 : 0;
    re.lastIndex = m.index + (cp > 0xffff ? 2 : 1);
  }
  return null;
}

/** Every match of `re` in `s` that `ok` lets through (see execAfter); `re` itself is left untouched. */
export function matchAllAfter(re: RegExp, s: string, ok: (before: string, m: RegExpExecArray) => boolean): RegExpExecArray[] {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  const out: RegExpExecArray[] = [];
  for (let m = execAfter(r, s, ok); m; m = execAfter(r, s, ok)) {
    out.push(m);
    if (m[0] === '') r.lastIndex++;
  }
  return out;
}
