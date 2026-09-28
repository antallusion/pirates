// The bard's shanty (docs/08): last season's legends by name. Each line in both tongues; every combination of lines a
// pattern for the client's table (the names pass through as they are).

export type ShantyStat = 'sunk' | 'monsters' | 'trade' | 'abyss';
export const SHANTY_ORDER: ShantyStat[] = ['sunk', 'monsters', 'trade', 'abyss'];

export const SHANTY_LINES: Record<ShantyStat, [string, string]> = {
  sunk: ['Oh, {n} sent them down, a-hundred ships and more', 'Эх, {n} — сотня кораблей на дне'],
  monsters: ['and {n} took the beast that none had took before', 'и {n} — зверь, что не давался никому'],
  trade: ['while {n} bought the harbour and sold it back for gold', 'а {n} — гавань куплена и продана за золото'],
  abyss: ['and {n} sailed the Abyss where the stars are wrong and cold', 'и {n} — в Бездне, где звёзды чужие и холодные'],
};
export const SHANTY_REFRAIN: [string, string] = ['heave away, me lads, heave away!', 'навались, ребята, навались!'];

/** The shanty for the legends given (in the stats' order), in one tongue. */
export function shantyText(names: Partial<Record<ShantyStat, string>>, ru = 0): string | null {
  const lines = SHANTY_ORDER.filter((k) => names[k]).map((k) => SHANTY_LINES[k][ru].replace('{n}', names[k]!));
  if (!lines.length) return null;
  const body = lines.join(', ');
  return `♪ ${body[0].toUpperCase()}${body.slice(1)} — ${SHANTY_REFRAIN[ru]} ♪`;
}

/** Every combination of lines, English → Russian, the names as {0}, {1}… */
export function shantyPatterns(): [string, string][] {
  const out: [string, string][] = [];
  for (let mask = 1; mask < 16; mask++) {
    const ks = SHANTY_ORDER.filter((_, i) => mask & (1 << i));
    const names = Object.fromEntries(ks.map((k, i) => [k, `{${i}}`]));
    out.push([shantyText(names, 0)!, shantyText(names, 1)!]);
  }
  return out;
}
