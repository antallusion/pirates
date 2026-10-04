// The visit card of the adventure map (docs/17 H4): the thing within reach of the boats — its painted picture, how
// often it may be visited and when again, what it gives and the choice it asks (a chest's silver or experience) — or
// the guard in her way: HoMM3's word for their number, the faces of their stacks, her army against theirs, the
// offer when she is much the stronger (they flee, or some sign on), and "Board them". Compact, over the sea, like
// the terms of a struck ship; closed with ×, it comes back when there is something new to say.

import { GUARDS, OBJS, WELL_MORALE, WELL_SANITY, TOWER_R } from '../../../shared/src/data/advmap.ts';
import type { GuardKind } from '../../../shared/src/data/advmap.ts';
import { OFFICER_DEFS } from '../../../shared/src/data/crew.ts';
import { PRIM_NAMES } from '../../../shared/src/data/hero.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { AdvCardView, GuardCard, ObjCard } from '../../../shared/src/h4proto.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/h4.ts';
import { EN as LEN, RU as LRU } from '../lang/ui/lairs.ts';
import { LAIRS } from '../../../shared/src/data/lairs.ts';
import { LAND_RES_DEF } from '../../../shared/src/data/bestiary.ts';
import { beastFace } from '../render/beastface.ts';
import type { LandRes } from '../../../shared/src/data/bestiary.ts';
import { EN as VEN, RU as VRU } from '../lang/ui/heroes18v.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import type { LairCard } from '../../../shared/src/lairproto.ts';
import type { DriftCard } from '../../../shared/src/driftproto.ts';
import { DRIFTS, MINI_BAND, MINI_HIT, MINI_MISS, MINI_TAPS, needleAt } from '../../../shared/src/data/drifts.ts';
import { EN as DEN, RU as DRU } from '../lang/ui/drifts.ts';
import { personName } from '../lang/names.ts';
import { serverText } from '../lang/server.ts';
import { strengthWord, unitArt, unitIcon, unitName } from './army.ts';
import { esc, fmt, icon, money, portraitUrl, xpBadge } from './dom.ts';
import { placeName } from './maps.ts';

const L = dict(EN, RU);
const LL = dict(LEN, LRU);
const DL = dict(DEN, DRU);
const VL = dict(VEN, VRU);
const ru = () => (lang() === 'ru' ? 1 : 0);

/** A guard's painted picture: the hold-out's camp, the hulk, the wreck, the serpent of the pack. */
export const GUARD_ART: Record<GuardKind, string> = { holdout: 'prop.life_pirate_tent', hulk: 'monster.hulk', wreck: 'prop.shipwreck', beasts: 'monster.young_serpent' };

export function guardName(kind: GuardKind): string {
  return GUARDS[kind].name[ru()];
}

/** World seconds as the card writes them. */
export function timeWords(secs: number): string {
  const m = Math.max(1, Math.ceil(secs / 60));
  return m < 60 ? L('t.m', { m }) : L('t.hm', { h: Math.floor(m / 60), m: m % 60 });
}

function guardBlock(g: GuardCard, own: boolean): string {
  const w = strengthWord(g.men);
  const faces = g.units.slice(0, 7).map((u) => `<span class="army-mini" title="${esc(unitName(u))}">${unitIcon(u, 'army-face-xs')}</span>`).join('');
  const what = g.at === 'mine' ? L('guard.mine') : g.at ? L('guard.of', { what: OBJS[g.at].name[ru()].toLowerCase() }) : L('guard.strait');
  const offer = g.offer === 'join' ? (g.joinN > 0 ? L('guard.joinText', { n: g.joinN }) : L('guard.joinNoRoom')) : g.offer === 'flee' ? L('guard.fleeText') : '';
  const ratio = g.ratio >= 10 ? String(Math.round(g.ratio)) : g.ratio < 0.1 ? (lang() === 'ru' ? '<0,1' : '<0.1') : g.ratio.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 1 });
  return `<div class="ac-guard${own ? ' own' : ''}">
    <div class="ac-gw"><b class="ac-word">${esc(w.word)}</b> <span class="muted">${esc(w.range)}</span>${own ? ` · ${esc(guardName(g.kind))}` : ''}<span class="tg-army-faces">${faces}</span></div>
    <div class="muted ac-gl">${own ? '' : `${esc(what)} · `}${esc(L('guard.vs', { r: ratio }))}</div>
    <div class="muted ac-gl ac-pay">${esc(g.looted ? L('guard.looted') : L('guard.pay', { s: fmt(g.pay.silver), x: fmt(g.pay.xp) }))}</div>
    ${offer ? `<div class="ac-offer">${esc(offer)}</div>` : ''}
    ${!g.alongside ? `<div class="muted ac-gl ac-come">${esc(L('guard.come'))}</div>` : ''}
    <div class="ac-acts">
      <button class="btn btn-small${g.offer ? '' : ' btn-primary'}" data-ag="fight" data-id="${g.id}"${g.alongside ? '' : ' disabled'}>${icon('prof_marine', '', 'ico-sm')}${esc(L('guard.fight'))}</button>
      ${g.offer === 'join' && g.joinN > 0 ? `<button class="btn btn-small btn-primary" data-ag="join" data-id="${g.id}">${esc(L('guard.join', { n: g.joinN }))}</button>` : ''}
      ${g.offer ? `<button class="btn btn-small${g.offer === 'flee' || !g.joinN ? ' btn-primary' : ''}" data-ag="flee" data-id="${g.id}">${esc(L('guard.let'))}</button>` : ''}
    </div></div>`;
}

/** docs/18 #43: her creature dwelling settled (or what settling it asks). */
function settleBlock(id: string, d: NonNullable<LairCard['dwell']>): string {
  if ((d.lv ?? 1) >= 2) return `<span class="muted ac-settled">${esc(VL('dw.settled', { n: d.upkeep ?? 1 }))}</span>`;
  if (!d.up) return '';
  const land = (Object.entries(d.up.land) as [LandRes, number][]).map(([r, n]) => `<span class="bcost" title="${esc(LAND_RES_DEF[r].name[ru()])}">${icon(LAND_RES_DEF[r].icon, '', 'ico-sm')}${n}</span>`).join('');
  return `<div class="ac-settle"><span class="bcosts"><span class="bcost">${money(d.up.silver)}</span>${land}</span>
    <button class="btn btn-small" data-al="settle" data-id="${id}"${d.upWhy ? ' disabled' : ''} title="${esc(VL('dw.settleTip', { n: d.upkeep ?? 1 }))}">${esc(VL('dw.settle'))}</button>${d.upWhy ? `<span class="muted">${esc(serverText(d.upWhy))}</span>` : ''}</div>`;
}

/** docs/18 II: the lair's card — HoMM3's word for its creatures, their faces and numbers, her landing party against
 *  them, the spoils (or that she had them this week), the island's chain, the offer, "Land and fight", the dwelling. */
function lairBlock(c: LairCard, x: boolean): string {
  const def = LAIRS[c.kind];
  const main = def.mix[0][0];
  const w = strengthWord(c.men);
  const face = beastFace(main);
  const id = face.id;
  const art = id.startsWith('portrait.') ? portraitUrl(id.slice(9)) : assetUrl(id);
  const tint = face.tint;
  const faces = c.stacks.slice(0, 7).map((s) => `<span class="army-mini" title="${esc(unitName(s.u))}">${unitIcon(s.u, 'army-face-xs')}<i class="ac-n">${s.n}</i></span>`).join('');
  const ratio = c.ratio >= 10 ? String(Math.round(c.ratio)) : c.ratio < 0.1 ? (lang() === 'ru' ? '<0,1' : '<0.1') : c.ratio.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 1 });
  const offer = c.offer === 'join' ? (c.joinN > 0 ? LL('joinText', { n: c.joinN }) : LL('joinNoRoom')) : c.offer === 'flee' ? LL('fleeText') : '';
  const step = (k: number) => `<span class="ac-step${c.chain!.done[k] ? ' done' : ''}${k === c.chain!.step ? ' on' : ''}">${c.chain!.done[k] ? '✓ ' : ''}${esc(LL(`chain.${k}` as 'chain.0'))}</span>`;
  const chain = c.chain ? `<div class="ac-chain">${esc(LL('chain'))}: ${[0, 1, 2].map(step).join('<i>→</i>')}<i>→</i><span class="ac-step${c.chain.done.every(Boolean) ? ' done' : ''}">${esc(LL('chain.chest'))}</span></div>` : '';
  const up = c.down === undefined;
  const d = c.dwell;
  let dwell = '';
  if (d) {
    const body = d.own
      ? `<span>${unitIcon(d.u, 'army-face-xs')} ${esc(LL('dwell.own', { n: d.pool, g: ru() ? String(d.growth).replace('.', ',') : d.growth }))}</span><button class="btn btn-small btn-primary" data-ahire>${esc(LL('dwell.hire'))}</button>${settleBlock(c.id, d)}`
      : `${d.owner ? `<span class="muted">${esc(LL('dwell.other', { name: personName(d.owner) }))}</span>` : `<span class="muted">${esc(LL('dwell.can'))}</span>`}${d.can ? `<button class="btn btn-small" data-al="flag" data-id="${c.id}">${esc(LL('dwell.flag'))}</button>` : d.why ? `<span class="muted">${esc(serverText(d.why))}</span>` : ''}`;
    dwell = `<div class="ac-dwell">${body}</div>`;
  }
  const fight = up
    ? `<div class="ac-guard">
      <div class="ac-gw"><b class="ac-word">${esc(w.word)}</b> <span class="muted">${esc(w.range)}</span><span class="tg-army-faces">${faces}</span></div>
      <div class="muted ac-gl">${esc(LL('vs', { n: c.party, r: ratio }))}</div>
      <div class="muted ac-gl ac-pay">${esc(c.looted ? LL('looted') : LL('pay', { s: fmt(c.pay.silver), x: fmt(c.pay.xp) }))}</div>
      ${c.week ? `<div class="ac-gl ac-week good">${esc(VL('lair.week'))}</div>` : ''}
      ${offer ? `<div class="ac-offer">${esc(offer)}</div>` : ''}
      ${!c.reach ? `<div class="muted ac-gl ac-come">${esc(LL('come'))}</div>` : c.why ? `<div class="muted ac-gl ac-come">${esc(serverText(c.why))}</div>` : ''}
      <div class="ac-acts">
        <button class="btn btn-small${c.offer ? '' : ' btn-primary'}" data-al="fight" data-id="${c.id}"${c.reach && !c.why ? '' : ' disabled'}>${icon('prof_marine', '', 'ico-sm')}${esc(LL('fight'))}</button>
        ${c.offer === 'join' && c.joinN > 0 ? `<button class="btn btn-small btn-primary" data-al="join" data-id="${c.id}">${esc(LL('join', { n: c.joinN }))}</button>` : ''}
        ${c.offer ? `<button class="btn btn-small${c.offer === 'flee' || !c.joinN ? ' btn-primary' : ''}" data-al="flee" data-id="${c.id}">${esc(LL('let'))}</button>` : ''}
      </div></div>`
    : `<div class="ac-line muted">${esc(LL('down', { t: timeWords(c.down ?? 0) }))}</div>`;
  return `<div class="enc-card ac-card ac-gcard ac-lcard" data-lair="${c.kind}">
    <div class="ac-head">${art ? `<img class="ac-art${tint ? ' beast-tok' : ''}${face.fig ? ' fig' : ''}" src="${art}" alt="" draggable="false"${tint ? ` style="filter:${tint}"` : ''} />` : ''}<div class="ac-id"><div class="enc-h">${esc(w.word)} · ${esc(def.name[ru()])} <span class="ac-lvl">⚓${c.level}</span></div>
    <div class="ac-sub muted">${esc(LL(`role.${c.role}` as 'role.shore'))} · ${esc(placeName(c.island))}</div></div>${x ? `<button class="ac-x" data-ax title="${esc(L('close'))}">×</button>` : ''}</div>
    <p class="ac-text muted">${esc(def.text[ru()])}</p>
    ${chain}
    ${fight}
    ${dwell}
  </div>`;
}

/** docs/18 IV: a drift's card — the creatures and their number, its clock, the ways to save them without a fight
 *  (each with its chance and its cost), the mini-game once a way is chosen, what saving them gives, "Fight them". */
function driftBlock(c: DriftCard, x: boolean): string {
  const def = DRIFTS[c.kind];
  const face = beastFace(c.u);
  const id = face.id;
  const art = id.startsWith('portrait.') ? portraitUrl(id.slice(9)) : assetUrl(id);
  const tint = face.tint;
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  const giftText = DL('gift', { n: c.gift.n, good: GOODS[c.gift.good].name.toLowerCase(), s: fmt(c.gift.silver) });
  const out = !c.joins ? DL('joins.deep', { gift: giftText }) : c.room >= c.n ? DL('joins', { n: c.n }) : c.room > 0 && Math.min(c.pen, c.n - c.room) <= 0 ? DL('joins.part', { n: c.room }) : c.room + c.pen > 0 ? DL('joins.pen', { n: c.room, m: Math.min(c.pen, c.n - c.room) }) : DL('joins.none', { gift: giftText });
  let body = '';
  if (c.mini) {
    const m = c.mini;
    const hits = m.taps.filter(Boolean).length, misses = m.taps.length - hits;
    const now = Math.max(0.03, Math.min(0.97, m.chance + hits * MINI_HIT - misses * MINI_MISS));
    const taps = Array.from({ length: MINI_TAPS }, (_, i) => `<i class="dm-tap${i < m.taps.length ? (m.taps[i] ? ' hit' : ' miss') : ''}" title="${esc(i < m.taps.length ? DL(m.taps[i] ? 'mini.hit' : 'mini.miss') : '')}"></i>`).join('');
    body = `<div class="dm-mini" data-t0="${m.t0}" data-ph="${m.phase}">
      <div class="dm-h">${esc(DL(`way.${m.way}` as 'way.cut'))} · ${esc(DL('mini.title', { k: Math.min(MINI_TAPS, m.taps.length + 1), n: MINI_TAPS }))}</div>
      <div class="dm-bar"><span class="dm-band" style="left:${(50 - MINI_BAND * 50).toFixed(1)}%;width:${(MINI_BAND * 100).toFixed(1)}%"></span><span class="dm-needle"></span></div>
      <div class="dm-row"><span class="dm-taps">${taps}</span><span class="muted">${esc(DL('mini.chance', { p: Math.round(now * 100) }))}</span></div>
      <div class="ac-acts"><button class="btn btn-primary dm-go" data-dtap="${c.id}">${esc(DL('mini.tap'))}</button><button class="btn btn-small" data-droll="${c.id}">${esc(DL('mini.roll'))}</button></div></div>`;
  } else {
    const ways = c.ways.map((w) => {
      const cost = w.cost ? ` <span class="bcost">${icon(`good_${w.cost.good}`, '', 'ico-sm')}${w.cost.n}</span>` : '';
      const dis = !c.reach || !!c.why || !!w.why || w.chance <= 0;
      return `<button class="btn btn-small dw-way${dis ? '' : ' btn-primary'}" data-dway="${w.way}" data-id="${c.id}"${dis ? ' disabled' : ''} title="${esc(w.why ? serverText(w.why) : '')}"><b>${esc(DL(`way.${w.way}` as 'way.cut'))}</b> <span class="dw-p">${pct(w.chance)}</span>${cost}</button>`;
    }).join('');
    body = `<div class="ac-line muted">${esc(DL('ways'))}</div><div class="ac-acts dw-ways">${ways}</div>`;
  }
  const why = !c.reach ? DL('come') : c.why ? serverText(c.why) : '';
  return `<div class="enc-card ac-card ac-gcard ac-dcard${c.legend ? ' legend' : ''}" data-drift="${c.kind}">
    <div class="ac-head">${art ? `<img class="ac-art${tint ? ' beast-tok' : ''}${face.fig ? ' fig' : ''}" src="${art}" alt="" draggable="false"${tint ? ` style="filter:${tint}"` : ''} />` : ''}<div class="ac-id"><div class="enc-h">${esc(def.name[ru()])} <span class="ac-lvl">⚓${c.level}</span></div>
    <div class="ac-sub muted">${c.legend ? `<b class="dw-leg">${esc(DL('legend'))}</b> · ` : ''}<span class="army-mini">${unitIcon(c.u, 'army-face-xs')}<i class="ac-n">${c.n}</i></span> ${esc(unitName(c.u))} · ${esc(DL('left', { t: timeWords(c.left) }))}</div></div>${x ? `<button class="ac-x" data-ax title="${esc(L('close'))}">×</button>` : ''}</div>
    <p class="ac-text muted">${esc(def.text[ru()])}</p>
    ${why ? `<div class="muted ac-gl ac-come">${esc(why)}</div>` : ''}
    ${body}
    <div class="ac-line dw-out">${esc(out)}</div>
    ${c.mini ? '' : `<div class="ac-acts"><button class="btn btn-small" data-dfight="${c.id}"${c.fightWhy ? ' disabled' : ''}>${icon('prof_marine', '', 'ico-sm')}${esc(DL('fight'))}</button></div>`}
  </div>`;
}

function statusLine(o: ObjCard): string {
  const rule = L(`rule.${o.rule}` as 'rule.once');
  if (o.ready) return rule;
  const when = o.rule === 'once' ? L('never') : o.rule === 'season' ? L('nextSeason') : L('again', { t: timeWords(o.again) });
  return `${rule} · ${L('done')} · ${when}`;
}

function objBody(o: ObjCard): string {
  const ok = o.ready && !o.why;
  const btn = (label: string, choice = '', primary = true) => `<button class="btn btn-small${primary ? ' btn-primary' : ''}" data-av="${o.id}"${choice ? ` data-choice="${choice}"` : ''}${ok ? '' : ' disabled'}>${label}</button>`;
  switch (o.kind) {
    case 'chest': {
      const c = o.chest!;
      const extra = c.extra ? btn(esc(c.extra.label[ru()]), c.extra.id, false) : '';
      return `<div class="ac-line muted">${esc(L('chest.pick'))}</div><div class="ac-acts">${btn(`${esc(L('chest.silver'))} ${money(c.silver)}`, 'silver')}${btn(`${esc(L('chest.xp'))} ${xpBadge(c.xp)}`, 'xp', false)}${extra}</div>`;
    }
    case 'altar':
      return `<div class="ac-line">${icon('xp', '✦', 'ico-sm')}${esc(o.altar!.prim ? L('altar.prim', { p: PRIM_NAMES[o.altar!.prim][ru()] }) : o.altar!.point ? L('altar.point') : L('altar.xp', { n: fmt(o.altar!.xp) }))}</div><div class="ac-acts">${btn(esc(L('altar.btn')))}</div>`;
    case 'well':
      return `<div class="ac-line">${esc(L('well.text', { m: WELL_MORALE, s: WELL_SANITY }))}</div><div class="ac-acts">${btn(esc(L('well.btn')))}</div>`;
    case 'tower':
      return `<div class="ac-line">${esc(L('tower.text', { n: Math.round(TOWER_R / 1000) }))}</div><div class="ac-acts">${btn(esc(L('tower.btn')))}</div>`;
    case 'mill':
    case 'store': {
      const l = o.load!;
      return `<div class="ac-line">${icon(`good_${l.good}`, '', 'ico-sm')}${esc(L('load.text', { n: l.n, good: GOODS[l.good].name.toLowerCase() }))}</div><div class="ac-acts">${btn(esc(L('load.btn')))}</div>`;
    }
    case 'prison': {
      const p = o.prison!;
      return `<div class="ac-line">${p.role ? `${icon(`role_${p.role}`, '', 'ico-sm')}${esc(L('prison.who', { role: OFFICER_DEFS[p.role].name.toLowerCase(), n: p.level }))}` : esc(L('prison.gone'))}</div><div class="ac-acts">${btn(esc(L('prison.btn')))}</div>`;
    }
    case 'obelisk':
      return `<div class="ac-line">${icon('good_cursed_relics', '', 'ico-sm')}${esc(L('obelisk.pieces', { n: o.pieces!.n, of: o.pieces!.of }))}</div><div class="ac-acts">${btn(esc(L('obelisk.btn')))}<button class="btn btn-small" data-apz>${icon('map_treasure', '', 'ico-sm')}${esc(L('puzzle.btn'))}</button></div>`;
  }
}

export class AdvCard {
  private el: HTMLElement;
  /** On a wide screen the card stands in the left column, under the ship's panel however tall it has grown (the
   *  wounded, the nerve: docs/17 H5's QA), and no lower than the screen allows. */
  place(): void {
    // Where the card ends (a phone held sideways keeps its newest toast just under it: styles.css).
    this.baseTop = null;
    requestAnimationFrame(() => this.fit());
    if (innerWidth < 1100 || innerHeight <= 520) this.el.style.top = '';
    this.watch();
  }
  /** docs/18 #50: on a phone or a tablet the card never lies over what it is about (the lair's, the drift's, the
   *  thing's token on the sea): it ends above the token, or stands below it when the token is high on the screen. */
  /** The card's own top on a small screen (its stylesheet's), measured once a layout. */
  private baseTop: number | null = null;
  private baseLeft: number | null = null;
  private fit(): void {
    if (this.el.classList.contains('hidden')) return;
    const narrow = innerWidth < 1100 || innerHeight <= 520;
    if (narrow && this.baseTop === null) {
      this.el.style.top = '';
      this.el.style.left = '';
      this.el.style.transform = '';
      this.baseTop = this.el.getBoundingClientRect().top;
      this.baseLeft = this.el.getBoundingClientRect().left;
    }
    if (!narrow) {
      // Under the ship's panel however tall it is now (measured once as the card came, the panel was still short and
      // the card stood over it), and no lower than the screen allows.
      const ship = document.getElementById('hud-ship')?.getBoundingClientRect();
      const t = `${Math.max(120, Math.min(ship && ship.height > 0 ? Math.round(ship.bottom + 8) : 384, innerHeight - 260))}px`;
      if (this.el.style.top !== t) this.el.style.top = t;
      if (this.el.style.left || this.el.style.transform) this.el.style.left = this.el.style.transform = '';
    }
    const r = this.el.getBoundingClientRect();
    const base = narrow ? this.baseTop! : r.top;
    let top = base;
    // docs/18 IV: several cards at once (a lair's and a drift's) scroll within the screen rather than run off it.
    let max = Math.max(140, Math.round(innerHeight - top - 8));
    // A wide screen's left column: the card ends above the chat's button in the corner (it ran over it).
    const chat = document.getElementById('chat-toggle')?.getBoundingClientRect();
    if (!narrow && chat && chat.height && chat.left < r.right) max = Math.max(140, Math.round(chat.top - 8 - top));
    // …and within a twelfth of the screen, scrolling: with a boss's card and the toasts it stayed over the popup
    // budget's 15% (16.3% at 1280×720 — QA circle, 2026-10-05).
    if (!narrow && r.width > 0) max = Math.min(max, Math.max(140, Math.floor((innerWidth * innerHeight) / 12 / r.width)));
    // A phone held sideways: the card keeps to the top band (the popup budget, owner 2026-10-04) and scrolls.
    // (its centre begins at 30% of the height: the card ends a little above, leaving the toasts their share of the 15% —
    // QA circle, 2026-10-05)
    if (innerHeight <= 520) max = Math.max(60, Math.floor(innerHeight * 0.27 - top));
    else if (narrow) max = Math.max(84, Math.round(innerHeight * 0.32 - top)); // a tablet: the top third too
    let left = narrow ? this.baseLeft! : r.left;
    if (narrow && innerHeight <= 520) {
      // A phone held sideways: no room above or below — the card steps aside from the token instead; never left of
      // where its stylesheet puts it (the captain's plate is there), so with no room either side it stays over the
      // token it is about.
      const w = r.width, h = Math.min(this.el.scrollHeight, max), minLeft = Math.max(8, this.baseLeft!);
      for (const p of this.subjects()) {
        if (p.x < left - 24 || p.x > left + w + 24 || p.y < top - 24 || p.y > top + h + 24) continue;
        const right = Math.round(p.x + 40), leftOf = Math.round(p.x - 40 - w);
        const fitsRight = right + w <= innerWidth - 8, fitsLeft = leftOf >= minLeft;
        if (fitsRight && (p.x < left + w / 2 || !fitsLeft)) left = right;
        else if (fitsLeft) left = leftOf;
      }
    }
    if (narrow && innerHeight > 520) {
      const h = Math.min(this.el.scrollHeight, max);
      for (const p of this.subjects()) {
        if (p.x < r.left - 24 || p.x > r.right + 24 || p.y < top - 30 || p.y > top + h + 30) continue;
        if (p.y - top >= 170) max = Math.round(p.y - 40 - top);
        else {
          // The token high on the screen: the card goes under it.
          top = Math.round(p.y + 44);
          max = Math.max(140, Math.round(innerHeight - top - 8));
        }
      }
    }
    // Written only when they change (the card is looked at again every few tenths of a second).
    if (narrow) {
      const t = top !== base ? `${top}px` : '';
      if (this.el.style.top !== t) this.el.style.top = t;
      // (a step aside: from the left, the stylesheet's centring undone)
      const l = left !== this.baseLeft ? `${left}px` : '';
      if (this.el.style.left !== l) {
        this.el.style.left = l;
        this.el.style.transform = l ? 'none' : '';
      }
    }
    const m = `${max}px`;
    if (this.el.style.maxHeight !== m) this.el.style.maxHeight = m;
    const b = `${Math.round(Math.min(top + Math.min(this.el.scrollHeight, max), innerHeight))}px`;
    if (document.body.style.getPropertyValue('--ac-bottom') !== b) document.body.style.setProperty('--ac-bottom', b);
  }
  private fitTimer = 0;
  /** While the card shows, its place is looked at again as the sea moves under it (on a wide screen: as the ship's
   *  panel above it grows or shrinks). */
  private watch(): void {
    if (this.fitTimer) return;
    this.fitTimer = window.setInterval(() => {
      if (this.el.classList.contains('hidden')) {
        clearInterval(this.fitTimer);
        this.fitTimer = 0;
        return;
      }
      this.fit();
    }, 400);
  }
  /** The screen points of what the cards are about (set by main.ts from the renderer). */
  where: (ids: { obj?: string; guard?: string; lair?: string; drift?: number }) => { x: number; y: number }[] = () => [];
  private subjects(): { x: number; y: number }[] {
    return this.where({ obj: this.adv?.obj?.id, guard: this.adv?.guard?.id ?? this.adv?.obj?.guard?.id, lair: this.lc?.id, drift: this.dc?.id });
  }
  private key = '';
  private closed = '';
  /** The cards opened by a tap on a short screen. */
  private opened = new Set<string>();
  onPuzzle: () => void = () => {};
  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    let el = document.getElementById('advcard');
    if (!el) {
      el = document.createElement('div');
      el.id = 'advcard';
      el.className = 'hidden';
      document.body.appendChild(el);
    }
    this.el = el;
    addEventListener('resize', () => (this.baseTop = null));
  }

  private adv: AdvCardView | null = null;
  private lc: LairCard | null = null;
  private dc: DriftCard | null = null;
  private raf = 0;
  /** The server's world time as the client reckons it (the mini-game's needle). */
  now: () => number = () => 0;
  onHire: () => void = () => {};

  /** Draw the card for what the server says is within reach (null: nothing). */
  show(v: AdvCardView | null): void {
    this.adv = v;
    this.draw();
  }

  /** docs/18 II: the lair of the land's creatures within reach, on the same card (null: none). */
  lair(c: LairCard | null): void {
    this.lc = c;
    this.draw();
  }

  /** docs/18 IV: the drift within reach, on the same card (null: none). */
  drift(c: DriftCard | null): void {
    this.dc = c;
    this.draw();
  }

  private draw(): void {
    const v = this.adv, lc = this.lc, dc = this.dc;
    const key = v || lc || dc ? JSON.stringify([lang(), v, lc, dc ? { ...dc, left: Math.round(dc.left / 30) } : null]) : '';
    if (key === this.key) return;
    this.key = key;
    // Closed by hand: it stays closed until the thing or its state changes.
    const what = v || lc || dc ? JSON.stringify([v?.obj?.id, v?.obj?.ready, v?.obj?.why, v?.obj?.guard?.id, v?.guard?.id, v?.guard?.offer, v?.obj?.guard?.offer, lc?.id, lc?.offer, lc?.why, lc?.down !== undefined, lc?.dwell?.can, lc?.dwell?.own, lc?.dwell?.lv, dc?.id, dc?.reach, !!dc?.mini]) : '';
    if ((!v && !lc && !dc) || what === this.closed) {
      this.el.classList.add('hidden');
      this.el.innerHTML = '';
      if (!v && !lc && !dc) this.closed = '';
      cancelAnimationFrame(this.raf);
      return;
    }
    const o = v?.obj ?? null;
    let html = '';
    if (o) {
      const def = OBJS[o.kind];
      const art = assetUrl(def.art);
      html = `<div class="enc-card ac-card" data-kind="${o.kind}">
        <div class="ac-head">${art ? `<img class="ac-art${o.kind === 'obelisk' ? ' ac-obelisk' : ''}" src="${art}" alt="" draggable="false" />` : ''}<div class="ac-id"><div class="enc-h">${esc(def.name[ru()])} <span class="ac-lvl">⚓${o.level}</span></div>
        <div class="ac-sub muted">${esc(statusLine(o))} · ${esc(placeName(o.island))}</div></div><button class="ac-x" data-ax title="${esc(L('close'))}">×</button></div>
        <p class="ac-text muted">${esc(def.text[ru()])}</p>
        ${o.guard ? `<div class="ac-line ac-warn">${esc(L('guarded'))}</div>${guardBlock(o.guard, true)}` : objBody(o)}
        ${o.why && !o.guard && o.ready ? `<div class="ac-line muted ac-why">${esc(serverText(o.why))}</div>` : ''}
      </div>`;
    }
    const gg = v?.guard ?? null;
    if (gg) {
      const art = assetUrl(GUARD_ART[gg.kind]);
      const w = strengthWord(gg.men);
      html += `<div class="enc-card ac-card ac-gcard" data-guard="${gg.kind}">
        <div class="ac-head">${art ? `<img class="ac-art" src="${art}" alt="" draggable="false" />` : ''}<div class="ac-id"><div class="enc-h">${esc(w.word)} · ${esc(guardName(gg.kind))} <span class="ac-lvl">⚓${gg.level}</span></div>
        <div class="ac-sub muted">${esc(GUARDS[gg.kind].text[ru()])}</div></div>${o ? '' : `<button class="ac-x" data-ax title="${esc(L('close'))}">×</button>`}</div>
        ${guardBlock(gg, false)}
      </div>`;
    }
    if (lc) html += lairBlock(lc, !o && !gg);
    if (dc) html += driftBlock(dc, !o && !gg && !lc);
    this.el.innerHTML = html;
    this.el.classList.remove('hidden');
    // A short screen shows each card's head and its buttons; a tap on the head opens the rest (kept across redraws).
    this.el.querySelectorAll<HTMLElement>('.ac-card').forEach((c, i) => {
      const k = `${i}|${c.dataset.kind ?? c.dataset.guard ?? c.dataset.drift ?? c.className}`;
      c.classList.toggle('open', this.opened.has(k));
      c.querySelector<HTMLElement>('.ac-head')!.onclick = (e) => {
        if ((e.target as HTMLElement).closest('[data-ax]')) return;
        if (c.classList.toggle('open')) this.opened.add(k);
        else this.opened.delete(k);
        this.fit();
      };
    });
    this.place();
    this.el.querySelectorAll<HTMLButtonElement>('[data-av]').forEach((b) => (b.onclick = () => this.send({ t: 'h4', action: 'visit', id: b.dataset.av!, ...(b.dataset.choice ? { choice: b.dataset.choice } : {}) })));
    this.el.querySelectorAll<HTMLButtonElement>('[data-ag]').forEach((b) => (b.onclick = () => this.send({ t: 'h4', action: 'guard', id: b.dataset.id!, choice: b.dataset.ag as 'fight' })));
    this.el.querySelectorAll<HTMLButtonElement>('[data-apz]').forEach((b) => (b.onclick = () => this.onPuzzle()));
    this.el.querySelectorAll<HTMLButtonElement>('[data-al]').forEach((b) => (b.onclick = () => this.send({ t: 'lair', action: b.dataset.al as 'fight', id: b.dataset.id! })));
    this.el.querySelectorAll<HTMLButtonElement>('[data-ahire]').forEach((b) => (b.onclick = () => this.onHire()));
    // docs/18 IV: the drift's ways, the mini-game's taps, the fight.
    this.el.querySelectorAll<HTMLButtonElement>('[data-dway]').forEach((b) => (b.onclick = () => this.send({ t: 'drift', action: 'way', id: Number(b.dataset.id), way: b.dataset.dway as 'cut' })));
    this.el.querySelectorAll<HTMLButtonElement>('[data-dtap]').forEach((b) => (b.onclick = () => this.send({ t: 'drift', action: 'tap', id: Number(b.dataset.dtap), at: this.now() })));
    this.el.querySelectorAll<HTMLButtonElement>('[data-droll]').forEach((b) => (b.onclick = () => this.send({ t: 'drift', action: 'roll', id: Number(b.dataset.droll) })));
    this.el.querySelectorAll<HTMLButtonElement>('[data-dfight]').forEach((b) => (b.onclick = () => this.send({ t: 'drift', action: 'fight', id: Number(b.dataset.dfight) })));
    this.swing();
    this.el.querySelectorAll<HTMLButtonElement>('[data-ax]').forEach((b) => (b.onclick = () => {
      cancelAnimationFrame(this.raf);
      this.closed = what;
      this.el.classList.add('hidden');
    }));
  }

  /** docs/18's cards closed by hand while their things are still within reach: what each was about, for the action
   *  bar's «Look…» (owner, 2026-10-02: once closed nothing on screen brought a card back). */
  closedLooks(): { kind: 'obj' | 'guard' | 'lair' | 'drift'; name: string }[] {
    if (!this.closed || !this.el.classList.contains('hidden')) return [];
    const out: { kind: 'obj' | 'guard' | 'lair' | 'drift'; name: string }[] = [];
    const v = this.adv;
    if (v?.obj) out.push({ kind: 'obj', name: OBJS[v.obj.kind].name[ru()] });
    if (v?.guard) out.push({ kind: 'guard', name: guardName(v.guard.kind) });
    if (this.lc) out.push({ kind: 'lair', name: LAIRS[this.lc.kind].name[ru()] });
    if (this.dc) out.push({ kind: 'drift', name: DRIFTS[this.dc.kind].name[ru()] });
    return out;
  }

  /** The card shown again after a close by hand. */
  reopen(): void {
    this.closed = '';
    this.key = '';
    this.draw();
  }

  get isOpen(): boolean {
    return !this.el.classList.contains('hidden');
  }

  /** The mini-game's needle swinging across its bar (as the server reckons it, from its start and phase). */
  private swing(): void {
    cancelAnimationFrame(this.raf);
    const box = this.el.querySelector<HTMLElement>('.dm-mini');
    const needle = box?.querySelector<HTMLElement>('.dm-needle');
    if (!box || !needle) return;
    const t0 = Number(box.dataset.t0), ph = Number(box.dataset.ph);
    const tick = () => {
      if (!needle.isConnected) return;
      const t = this.now() - t0;
      const at = t < 0 ? 0 : needleAt(t, ph);
      needle.style.left = `${at * 100}%`;
      needle.classList.toggle('in', t >= 0 && Math.abs(at - 0.5) <= MINI_BAND / 2);
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }
}
