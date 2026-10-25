// The browsers the game starts on: iOS 15 / Safari 15.0 and newer (prod 2026-10-25 — players from the ads on an iPhone
// with iOS 15.8 and on macOS Safari 16.3 could not start the game at all). The syntax is held to that floor by
// tests/compat-scan.test.ts (and the bundle is built for it: tools/build-client.ts); the few newer calls the game makes
// are put in here where the browser lacks them. Imported first by every entry (main.ts, forum/main.ts, ui/kit/demo.ts),
// so it runs before any other module of the game. Each one only fills a gap: a browser that has the call keeps its own.

/** The calls filled in here (tests/compat-scan.test.ts lets the game use these and refuses the other new ones). */
export const POLYFILLED = ['at', 'findLast', 'findLastIndex', 'hasOwn', 'structuredClone'] as const;

type Indexed = { readonly length: number; readonly [i: number]: unknown };

function fill(o: object, key: string, value: unknown): void {
  if (!(key in o)) Object.defineProperty(o, key, { value, writable: true, configurable: true, enumerable: false });
}

/** Array/String/typed array `.at(i)` (Safari 15.4): a negative index counts from the end. */
function at(this: Indexed, n: number): unknown {
  const len = this.length;
  let i = Math.trunc(n) || 0;
  if (i < 0) i += len;
  return i < 0 || i >= len ? undefined : this[i];
}

/** `.findLast` / `.findLastIndex` (Safari 15.4). */
function findLastIndex(this: Indexed, f: (v: unknown, i: number, o: Indexed) => unknown, self?: unknown): number {
  for (let i = this.length - 1; i >= 0; i--) if (f.call(self, this[i], i, this)) return i;
  return -1;
}
function findLast(this: Indexed, f: (v: unknown, i: number, o: Indexed) => unknown, self?: unknown): unknown {
  const i = findLastIndex.call(this, f, self);
  return i < 0 ? undefined : this[i];
}

/** structuredClone (Safari 15.4) for what the game clones: plain data — objects, arrays, Maps, Sets, Dates, typed arrays. */
export function cloneData<T>(v: T, seen = new Map<unknown, unknown>()): T {
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v) as T;
  if (v instanceof Date) return new Date(v.getTime()) as T;
  if (v instanceof RegExp) return new RegExp(v.source, v.flags) as T;
  if (ArrayBuffer.isView(v)) return (v as unknown as { slice(): unknown }).slice() as T;
  if (v instanceof ArrayBuffer) return v.slice(0) as T;
  if (v instanceof Map) {
    const m = new Map();
    seen.set(v, m);
    for (const [k, x] of v) m.set(cloneData(k, seen), cloneData(x, seen));
    return m as T;
  }
  if (v instanceof Set) {
    const s = new Set();
    seen.set(v, s);
    for (const x of v) s.add(cloneData(x, seen));
    return s as T;
  }
  const out: Record<string, unknown> = Array.isArray(v) ? (new Array(v.length) as unknown as Record<string, unknown>) : {};
  seen.set(v, out);
  for (const k of Object.keys(v)) out[k] = cloneData((v as Record<string, unknown>)[k], seen);
  return out as T;
}

const typed = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array];
for (const C of [Array, String, ...typed]) fill(C.prototype, 'at', at);
for (const C of [Array, ...typed]) {
  fill(C.prototype, 'findLast', findLast);
  fill(C.prototype, 'findLastIndex', findLastIndex);
}
fill(Object, 'hasOwn', (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k));
fill(globalThis, 'structuredClone', (v: unknown) => cloneData(v));
