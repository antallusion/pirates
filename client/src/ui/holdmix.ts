// What fills her hold (owner, 2026-10-19: «Щас я ваще просто не понимаю как я забиваю корабль и чем. Вроде ниче не
// покупал а корабль забит»): the goods aboard by the room each takes, the most first — the provisions the window before
// sailing bought (up to half the hold for a voyage's food), the planks and sailcloth, the catch of the nets, the loot of
// fights, the finds and wrecks, a quest's cargo — read on the ship's panel at sea and the harbour's hold figure.

import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { cargoVolume } from '../../../shared/src/sim/shipstats.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/hud.ts';
import { esc, icon } from './dom.ts';

const L = dict(EN, RU);

export interface HoldPart {
  good: GoodId;
  n: number;
  /** The room it takes (m³, as the server reckons it). */
  vol: number;
}

type Muls = { contrabandVolumeMul?: number; materialVolumeMul?: number; provisionVolumeMul?: number; cursedVolumeMul?: number } | null | undefined;

/** The goods aboard by the room each takes, the most first (none of nothing). */
export function holdMix(cargo: Partial<Record<GoodId, number>>, st: Muls): HoldPart[] {
  const out: HoldPart[] = [];
  for (const id in cargo) {
    const good = id as GoodId;
    const n = cargo[good] ?? 0;
    if (!(n > 0) || !GOODS[good]) continue;
    const vol = cargoVolume({ [good]: n }, st?.contrabandVolumeMul ?? 1, st?.materialVolumeMul ?? 1, st?.provisionVolumeMul ?? 1, st?.cursedVolumeMul ?? 1);
    out.push({ good, n, vol });
  }
  return out.sort((a, b) => b.vol - a.vol || a.good.localeCompare(b.good));
}

/** Its words, one line: «провизия 40 (60 м³) · рыба 12 (12 м³) · ещё 3: 5 м³» — the first `max`, the rest summed. */
export function holdMixText(parts: HoldPart[], max = 4): string {
  if (!parts.length) return L('holdEmpty');
  const head = parts.slice(0, max).map((p) => L('holdPart', { good: GOODS[p.good].name.toLowerCase(), n: Math.floor(p.n), v: Math.round(p.vol) }));
  const rest = parts.slice(max);
  if (rest.length) head.push(L('holdRest', { n: rest.length, v: Math.round(rest.reduce((a, p) => a + p.vol, 0)) }));
  return head.join(' · ');
}

/** The ship panel's row of it: a chip for each of the first `max` (its picture, how many, its room), the rest summed;
 *  the whole list on its title. */
export function holdMixHtml(parts: HoldPart[], used: number, max: number, shown = 4): string {
  if (!parts.length) return '';
  const all = holdMixText(parts, parts.length);
  const chip = (p: HoldPart) => {
    const share = Math.round((p.vol / Math.max(1, max)) * 100);
    return `<span class="hm-chip" title="${esc(L('holdPart', { good: GOODS[p.good].name, n: Math.floor(p.n), v: Math.round(p.vol) }))}">${icon(`good_${p.good}`, '', 'ico-xs')}<b>${Math.floor(p.n)}</b><i>${share}%</i></span>`;
  };
  const rest = parts.slice(shown);
  const restChip = rest.length ? `<span class="hm-chip hm-rest" title="${esc(holdMixText(rest, rest.length))}"><b>+${rest.length}</b><i>${Math.round((rest.reduce((a, p) => a + p.vol, 0) / Math.max(1, max)) * 100)}%</i></span>` : '';
  void used;
  return `<div class="hold-mix" title="${esc(all)}" aria-label="${esc(all)}">${parts.slice(0, shown).map(chip).join('')}${restChip}</div>`;
}
