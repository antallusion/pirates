// The island's loot from the creatures of the islands (docs/29 §9): its drops as the battle's spoil chips, and the lair
// card's «Возможная добыча» with each chance. Existing icons only: the storm glass of the shop's speed-ups, the goods,
// the farm of the harvest, the carpenter of the brigades.

import type { IsleDrop, lootChances } from '../../../shared/src/data/isleloot.ts';
import { PROD_BOOST } from '../../../shared/src/data/shop.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/isleloot.ts';
import { esc, icon } from './dom.ts';

const L = dict(EN, RU);

export const ISLE_LOOT_ICON = { speed: 'item_storm_glass', prod: 'build_farm', builder: 'prof_carpenter' } as const;

const mins = (m: number) => (m >= 60 ? L('hour', { n: m / 60 }) : L('min', { n: m }));
const pct = (p: number) => {
  const v = Math.round(p * 1000) / 10;
  const s = v >= 10 ? String(Math.round(v)) : String(v);
  return `${lang() === 'ru' ? s.replace('.', ',') : s}%`;
};
const goodName = (g: string) => GOODS[g as keyof typeof GOODS]?.name ?? g;

/** One drop as a chip of the battle's spoils. */
export function isleDropChip(d: IsleDrop): string {
  switch (d.k) {
    case 'speed': return `<span class="tb-lc tb-isle" title="${esc(L('speedTip', { m: mins(d.min) }))}">${icon(ISLE_LOOT_ICON.speed, '', 'ico-sm')}${esc(mins(d.min))}</span>`;
    case 'res': return `<span class="tb-lc tb-isle" title="${esc(`${goodName(d.good)} · ${L('resTip')}`)}">${icon(`good_${d.good}`, '', 'ico-sm')}${d.n}</span>`;
    case 'prod': return `<span class="tb-lc tb-isle" title="${esc(L('prodTip', { p: Math.round(PROD_BOOST * 100), h: d.hours }))}">${icon(ISLE_LOOT_ICON.prod, '', 'ico-sm')}+${Math.round(PROD_BOOST * 100)}% ${esc(L('hour', { n: d.hours }))}</span>`;
    default: return `<span class="tb-lc tb-isle" title="${esc(L('builderTip', { h: d.hours }))}">${icon(ISLE_LOOT_ICON.builder, '', 'ico-sm')}${esc(L('builder', { h: d.hours }))}</span>`;
  }
}

/** The lair card's «Возможная добыча для острова»: each kind with its chance. */
export function isleChancesHtml(list: ReturnType<typeof lootChances> | undefined): string {
  if (!list?.length) return '';
  const rows = list.filter((x) => x.p > 0).map((x) => {
    switch (x.k) {
      case 'speed': return `<span class="ac-il" title="${esc(L('speedTip', { m: (x.min ?? []).map(mins).join(' / ') }))}">${icon(ISLE_LOOT_ICON.speed, '', 'ico-sm')}${esc(L('speedAny', { list: (x.min ?? []).map(mins).join('/') }))} <b>${pct(x.p)}</b></span>`;
      case 'res': return `<span class="ac-il" title="${esc(L('resTip'))}">${icon('good_timber', '', 'ico-sm')}${esc(L('resAny', { n: x.n ?? 0 }))} <b>${pct(x.p)}</b></span>`;
      case 'prod': return `<span class="ac-il" title="${esc(L('prodTip', { p: Math.round(PROD_BOOST * 100), h: x.hours ?? 0 }))}">${icon(ISLE_LOOT_ICON.prod, '', 'ico-sm')}${esc(L('prod', { p: Math.round(PROD_BOOST * 100), h: x.hours ?? 0 }))} <b>${pct(x.p)}</b></span>`;
      default: return `<span class="ac-il" title="${esc(L('builderTip', { h: x.hours ?? 0 }))}">${icon(ISLE_LOOT_ICON.builder, '', 'ico-sm')}${esc(L('builder', { h: x.hours ?? 0 }))} <b>${pct(x.p)}</b></span>`;
    }
  });
  return `<div class="ac-isle"><span class="muted ac-ilh">${esc(L('maybe'))}</span>${rows.join('')}</div>`;
}

/** The spoils line's head for the island's drops. */
export const isleHead = (): string => L('head');
