// Progress and goals on the client (docs/16 #26–30): the careers and the titles for feats (a tab of the company
// window), the album of collections (another tab), the week's challenges (in the journal), and the window of what
// happened while she was away, with its gift.

import { BEASTS } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { FISH } from '../../../shared/src/data/fishing.ts';
import type { FishId } from '../../../shared/src/data/fishing.ts';
import { OMENS } from '../../../shared/src/data/omens.ts';
import type { OmenId } from '../../../shared/src/data/omens.ts';
import { CAREERS, CAREER_POINTS, FEATS, WEEKLY, WEEKLY_TITLE, careerRewards, setDefs } from '../../../shared/src/data/renown.ts';
import type { CareerReward, SetId } from '../../../shared/src/data/renown.ts';
import { WONDER_KINDS } from '../../../shared/src/data/wonders.ts';
import type { WonderKind } from '../../../shared/src/data/wonders.ts';
import type { AwayView, CareerView, ClientMsg, RenownView, SetView, WeeklyView } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { dict, lang } from '../i18n.ts';
import { NAME_RU } from '../lang/data.ts';
import { serverText } from '../lang/server.ts';
import { EN, RU } from '../lang/ui/renown.ts';
import type { ClientState } from '../state.ts';
import { esc, fishIcon, fmt, icon } from './dom.ts';
import { BEAST_RES, LAND_RES_DEF, isBeast } from '../../../shared/src/data/bestiary.ts';
import type { CreatureId, LandRes } from '../../../shared/src/data/bestiary.ts';
import { UNITS } from '../../../shared/src/data/army.ts';
import { LAIRS, LAIR_KINDS } from '../../../shared/src/data/lairs.ts';
import { DRIFTS, DRIFT_KINDS, PEOPLE_NAME, isFavourite, peopleOf } from '../../../shared/src/data/drifts.ts';
import { CAPTAINS, CAPTAIN_IDS } from '../../../shared/src/data/captains.ts';
import { ISLE_TYPE_DEFS } from '../../../shared/src/world/archipelago.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import { EN as V_EN, RU as V_RU } from '../lang/ui/heroes18v.ts';
import { specialName, specialNote, unitIcon, unitName } from './army.ts';

const L = dict(EN, RU);
const ru = () => (lang() === 'ru' ? 1 : 0);
/** A name or sentence the server built, in the player's language. */
const sv = (s: string) => (lang() === 'ru' ? (NAME_RU.get(s) ?? serverText(s)) : s);
const barHtml = (frac: number, cls = '') => `<div class="rn-bar${cls ? ` ${cls}` : ''}"><i style="width:${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%"></i></div>`;

export const renownTab = (t: 'career' | 'album'): string => L(t === 'career' ? 'tab_career' : 'tab_album');

// ------------------------------------------------------------------ 26. careers

function rewardText(r: CareerReward, rank: number): string {
  const disc = [0, 0, 3, 6, 8, 10][rank];
  return r === 'discount' ? L('r_discount', { n: disc }) : L(`r_${r}` as 'r_title');
}

function careerCard(c: CareerView): string {
  const def = CAREERS[c.id];
  const max = CAREER_POINTS.length;
  const title = c.rank ? def.ranks[c.rank - 1][ru()] : L('noRank');
  const pts = c.next ? L('points', { n: fmt(c.points), next: fmt(c.next.points) }) : L('pointsMax', { n: fmt(c.points) });
  const frac = c.next ? c.points / c.next.points : 1;
  const rep = c.next && c.rep < c.next.rep ? `<span class="bad">${esc(L('repNeed', { rep: c.rep, need: c.next.rep }))}</span>` : esc(L('repOk', { rep: c.rep }));
  const ladder = def.ranks.map((t, i) => {
    const k = i + 1;
    const on = c.rank >= k;
    return `<li class="${on ? 'on' : ''}${c.rank + 1 === k ? ' next' : ''}"><span class="rn-mark">${on ? '✓' : k}</span><b>${esc(t[ru()])}</b><span class="muted">${careerRewards(k).map((r) => esc(rewardText(r, k))).join(' · ')}</span></li>`;
  }).join('');
  const now = [c.discount > 0 ? L('r_discount', { n: Math.round(c.discount * 100) }) : '', c.yard ? L('r_yard') : ''].filter(Boolean);
  return `<div class="card rn-career rn-${c.id}"><h4 class="card-h">${icon(`service_${c.id}`, '', 'ico-md')}<span>${esc(def.name[ru()])} <span class="muted">${esc(c.rank ? L('rank', { n: c.rank, max }) : '')}</span></span></h4>
    <div class="rn-rank">${esc(title)}</div>
    <div class="rn-pts">${esc(pts)}</div>${barHtml(frac)}
    <div class="rn-rep muted">${rep} · ${esc(L('pointsFrom', { rep: fmt(Math.max(0, c.rep) * 10), deeds: fmt(c.deeds), merit: fmt(c.merit) }))}</div>
    <div class="rn-now"><span class="giver-h">${esc(L('now'))}</span> ${esc(now.length ? now.join(' · ') : L('nowNothing'))}</div>
    <ol class="rn-ladder">${ladder}</ol>
    <p class="muted rn-counts"><b>${esc(L('counts'))}:</b> ${esc(def.deeds[ru()])}</p></div>`;
}

function featsCard(v: RenownView): string {
  const rows = FEATS.map((f) => {
    const fv = v.feats.find((x) => x.id === f.id);
    const done = !!fv?.done;
    const value = fv?.value ?? 0;
    return `<div class="rn-feat${done ? ' done' : ''}">${icon(f.icon, '✦', 'ico-md')}<div class="rn-feat-text"><b>${esc(f.title[ru()])}</b><span class="muted">${esc(f.text[ru()])}</span>${done ? `<span class="good">✓ ${esc(L('won'))}</span>` : `${barHtml(value / f.need, 'thin')}<span class="muted rn-num">${fmt(value)} / ${fmt(f.need)}</span>`}</div></div>`;
  }).join('');
  const select = `<label class="rn-title-sel" title="${esc(L('titleTip'))}"><span class="giver-h">${esc(L('flying'))}</span><select data-rn-title><option value="">${esc(L('noTitle'))}</option>${v.titles.map((t) => `<option value="${esc(t)}" ${t === v.title ? 'selected' : ''}>${esc(sv(t))}</option>`).join('')}</select></label>`;
  return `<div class="card rn-feats"><h4 class="card-h">${icon('goal', '', 'ico-md')}${esc(L('feats'))}</h4><p class="muted">${esc(L('featsSub'))}</p>${select}<div class="rn-feat-list">${rows}</div></div>`;
}

export function renderCareer(body: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const v = state.renown;
  if (!v) {
    send({ t: 'renown' });
    body.innerHTML = `<p class="muted">…</p>`;
    return;
  }
  body.innerHTML = `<p class="muted rn-sub">${esc(L('careerSub'))}</p><div class="rn-careers">${v.careers.map(careerCard).join('')}</div>${featsCard(v)}`;
  body.querySelector<HTMLSelectElement>('[data-rn-title]')!.onchange = (e) => send({ t: 'season', action: 'title', value: (e.target as HTMLSelectElement).value });
}

// ------------------------------------------------------------------ 28. the album

const BEAST_ICON: Record<BeastId, string> = { orca: 'good_orca_tooth', white_orca: 'item_white_orca_tooth', humpback: 'good_baleen', sperm_whale: 'good_ambergris', narwhal: 'good_narwhal_tusk', shark: 'good_shark_skin', young_serpent: 'good_serpent_scale' };
const TROPHY_ICON: Record<string, string> = {
  'Leviathan Skull': 'deed_leviathan_slain', 'Kraken Eye': 'tattoo_kraken', 'Bell of the Whale': 'tattoo_bell', 'Lure of the Maw': 'boon_lantern', 'Serpent Fang': 'mod_serpent_scale',
  "Drey's Lantern": 'tattoo_lantern', 'Crown of Wrecks': 'map_wreck', 'Veil of the Widow': 'fh_weeping_widow', 'Skull of an Ancient': 'tattoo_skull', 'A Shard of the Eye': 'tattoo_eye',
};
const SET_ICON: Record<SetId, string> = { fish: 'fish_tuna', wonders: 'wonder_coral', omens: 'omen_albatross', trophies: 'map_monster', beasts: 'good_whalebone', letters: 'tattoo_bottle', bestiary: 'creature.crab' };
const V = dict(V_EN, V_RU);
/** The bestiary's page open in the album (docs/18 #46). */
let bestOpen: string | null = null;

/** docs/18 #46: a creature's page — its strength, its specials, what it leaves, where it lives, whose favourite. */
function bestiaryPage(u: CreatureId): string {
  const d = UNITS[u];
  const stats = V('bst.stats', { atk: d.atk, def: d.def, dmin: d.dmin, dmax: d.dmax, hp: d.hp, speed: d.speed, init: d.init }) + (d.shots ? ` · ${V('bst.shots', { n: d.shots })}` : '');
  const sp = d.specials.length ? d.specials.map((x) => `<li><b>${esc(specialName(x))}</b> — <span class="muted">${esc(specialNote(x))}</span></li>`).join('') : `<li class="muted">${esc(V('bst.none'))}</li>`;
  const res = isBeast(u) ? (Object.entries(BEAST_RES[u]) as [LandRes | 'pearls', number][]) : [];
  const drifts = DRIFT_KINDS.filter((k) => DRIFTS[k].u === u);
  const loot = res.length
    ? res.map(([r, n]) => `<span class="bcost" title="${esc(r === 'pearls' ? GOODS.pearls.name : LAND_RES_DEF[r].name[ru()])}">${icon(r === 'pearls' ? 'good_pearls' : LAND_RES_DEF[r].icon, '', 'ico-sm')}${esc(String(n).replace('.', ru() ? ',' : '.'))}</span>`).join('') + ` <span class="muted">${esc(V('bst.per'))}</span>`
    : drifts.length ? esc(V('bst.lootSea', { good: drifts.map((k) => GOODS[DRIFTS[k].gift.good].name).join(', ') })) : esc(V('bst.lootNone'));
  const where = [
    ...LAIR_KINDS.filter((k) => LAIRS[k].mix.some(([x]) => x === u)).map((k) => V('bst.lair', { lair: LAIRS[k].name[ru()], types: LAIRS[k].types.map((t) => ISLE_TYPE_DEFS[t].adj[ru()]).join(', '), a: LAIRS[k].lv[0], b: LAIRS[k].lv[1] })),
    ...drifts.map((k) => (DRIFTS[k].legend ? V('bst.legend', { a: DRIFTS[k].lv[0] }) : V('bst.drift', { drift: DRIFTS[k].name[ru()], a: DRIFTS[k].lv[0], b: DRIFTS[k].lv[1] }))),
  ];
  const favs = CAPTAIN_IDS.filter((c) => isFavourite(c, u)).map((c) => CAPTAINS[c].archetype);
  return `<div class="rn-page" data-bst-page="${u}"><div class="rn-page-h">${unitIcon(u, 'ico-lg')}<div><b>${esc(unitName(u))}</b><span class="muted">${esc(V('bst.tier', { n: d.tier }))} · ${esc(PEOPLE_NAME[peopleOf(u)][ru()])}</span></div><button class="btn btn-small btn-ghost" data-bst-close aria-label="${esc(V('bst.close'))}">×</button></div>
    <p class="rn-page-stats">${esc(stats)}</p>
    <div class="giver-h">${esc(V('bst.specials'))}</div><ul class="rn-page-list">${sp}</ul>
    <div class="giver-h">${esc(V('bst.loot'))}</div><p class="rn-page-loot">${loot}</p>
    <div class="giver-h">${esc(V('bst.where'))}</div><ul class="rn-page-list">${where.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
    ${favs.length ? `<p class="muted">${esc(V('bst.fav', { paths: favs.join(', ') }))}</p>` : ''}</div>`;
}

function piece(set: SetId, id: string): { ico: string; name: string } {
  switch (set) {
    case 'fish': return { ico: fishIcon(id, 'rn-ico'), name: FISH[id as FishId].name[ru()] };
    case 'wonders': return { ico: icon(`wonder_${id}`, '✦', 'rn-ico'), name: WONDER_KINDS[id as WonderKind].name[ru()] };
    case 'omens': return { ico: icon(`omen_${id}`, '✦', 'rn-ico'), name: OMENS[id as OmenId].name[ru()] };
    case 'trophies': return { ico: icon(TROPHY_ICON[id] ?? 'map_monster', '✦', 'rn-ico'), name: sv(id) };
    case 'beasts': return { ico: icon(BEAST_ICON[id as BeastId], '✦', 'rn-ico'), name: BEASTS[id as BeastId].name[ru()] };
    case 'letters': return { ico: `${icon('tattoo_bottle', '✉', 'rn-ico')}<b class="rn-n">${Number(id) + 1}</b>`, name: L('letter', { n: Number(id) + 1 }) };
    case 'bestiary': return { ico: unitIcon(id as CreatureId, 'rn-ico'), name: unitName(id as CreatureId) };
  }
}

function setCard(s: SetView): string {
  const def = setDefs(s.items.length)[s.id];
  const have = new Set(s.have);
  const book = s.id === 'bestiary';
  const grid = s.items.map((id) => {
    const p = piece(s.id, id);
    const got = have.has(id);
    // The bestiary's unknown pages show the bare art, untinted and dark (the tint would light it up).
    const ico = book && !got ? icon(UNITS[id as CreatureId]?.art ?? 'creature.crab', '', 'rn-ico') : p.ico;
    return `<span class="rn-piece${got ? ' got' : ''}${book && got ? ' rn-book' : ''}${book && got && bestOpen === id ? ' open' : ''}" title="${esc(got ? p.name : '?')}"${book && got ? ` data-bst="${id}" role="button" tabindex="0"` : ''}>${ico}${got ? `<i>${esc(p.name)}</i>` : '<i>?</i>'}</span>`;
  }).join('');
  const page = book && bestOpen && have.has(bestOpen) ? bestiaryPage(bestOpen as CreatureId) : '';
  return `<div class="card rn-set${s.done ? ' done' : ''}"><h4 class="card-h">${icon(SET_ICON[s.id], '', 'ico-md')}<span>${esc(def.name[ru()])} <span class="muted">${esc(L('setCount', { n: s.have.length, max: s.items.length }))}</span></span></h4>
    ${barHtml(s.have.length / Math.max(1, s.items.length))}<p class="muted">${esc(def.text[ru()])}</p>
    ${book ? `<p class="muted">${esc(V('bst.hint'))}</p>` : ''}<div class="rn-grid">${grid}</div>${page}
    <p class="rn-reward">${s.done ? `<span class="good">✓ ${esc(L('setDone'))}</span> · ` : ''}${esc(L('setReward', { silver: fmt(s.silver), title: def.title[ru()] }))}</p></div>`;
}

export function renderAlbum(body: HTMLElement, state: ClientState, send: (m: ClientMsg) => void): void {
  const v = state.renown;
  if (!v) {
    send({ t: 'renown' });
    body.innerHTML = `<p class="muted">…</p>`;
    return;
  }
  body.innerHTML = `<p class="muted rn-sub">${esc(L('albumSub'))}</p><div class="rn-sets">${v.sets.map(setCard).join('')}</div>`;
  // docs/18 #46: a bestiary page opens under its set's grid.
  body.querySelectorAll<HTMLElement>('[data-bst]').forEach((el) => {
    el.onclick = () => {
      bestOpen = bestOpen === el.dataset.bst ? null : el.dataset.bst!;
      renderAlbum(body, state, send);
      body.querySelector('.rn-page')?.scrollIntoView({ block: 'nearest' });
    };
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    };
  });
  body.querySelector<HTMLElement>('[data-bst-close]')?.addEventListener('click', () => {
    bestOpen = null;
    renderAlbum(body, state, send);
  });
}

// ------------------------------------------------------------------ 27. the week's challenges (the journal)

export function weeklyWhat(kind: keyof typeof WEEKLY, region: RegionId): string {
  return WEEKLY[kind].text[ru()].replace('{r}', REGIONS[region]?.name ?? region);
}

export function weeklyLog(w: WeeklyView | null | undefined): string {
  if (!w) return '';
  const d = Math.floor(w.endsIn / 86400), h = Math.floor((w.endsIn % 86400) / 3600);
  const left = d > 0 ? L('weeklyLeft', { d, h }) : L('weeklyLeftH', { h: Math.max(1, h) });
  const rows = w.challenges.map((c) => {
    const def = WEEKLY[c.kind];
    const top = c.top.length ? `<ol class="wk-top">${c.top.slice(0, 3).map((t) => `<li>${esc(t.name)} <span class="muted">${fmt(t.value)}</span></li>`).join('')}</ol>` : `<p class="jr-fish muted">${esc(L('weeklyNone'))}</p>`;
    return `<div class="wk-row">${icon(def.icon, '✦', 'ico-md')}<div class="wk-text"><b>${esc(weeklyWhat(c.kind, c.region))}</b>
      <span class="${c.place && c.place <= 3 ? 'gold' : 'muted'}">${esc(L('weeklyMine', { v: fmt(c.mine), unit: def.unit[ru()] }))}${c.place ? ` · ${esc(L('weeklyPlace', { n: c.place }))}` : ''}</span>${top}</div></div>`;
  }).join('');
  const last = w.last?.filter((c) => c.top.length).map((c) => `<p class="jr-fish muted">${esc(weeklyWhat(c.kind, c.region))}: <b>${esc(c.top[0].name)}</b></p>`).join('') ?? '';
  return `<div class="jr-fishing jr-weekly"><div class="giver-h with-ico">${icon('goal', '', 'ico-md')}${esc(L('weekly'))}</div><p class="jr-fish muted wk-left">${esc(left)}</p>${rows}
    <p class="jr-fish muted">${esc(L('weeklyPrizes', { a: fmt(w.prizes[0]), b: fmt(w.prizes[1]), c: fmt(w.prizes[2]), title: sv(WEEKLY_TITLE) }))}</p>
    ${last ? `<div class="giver-h">${esc(L('weeklyLast'))}</div>${last}` : ''}</div>`;
}

// ------------------------------------------------------------------ 30. the welcome back

export function renderAway(root: HTMLElement, v: AwayView, send: (m: ClientMsg) => void, close: () => void): void {
  const sect = (ico: string, h: string, body: string) => `<div class="card aw-card"><h4 class="card-h">${icon(ico, '', 'ico-md')}${esc(h)}</h4>${body}</div>`;
  const lines = (xs: string[]) => xs.map((x) => `<p class="aw-line">${esc(sv(x))}</p>`).join('');
  const parts: string[] = [];
  if (v.isle) {
    const goods = `${v.isle.goods >= 0 ? '+' : ''}${fmt(v.isle.goods)}`, tr = `${v.isle.treasury >= 0 ? '+' : ''}${fmt(v.isle.treasury)}`;
    parts.push(sect('tab_isles', L('awayIsle', { name: v.isle.name }), `<p class="aw-line">${esc(L('awayIsleGoods', { n: goods }))} · ${esc(L('awayIsleTreasury', { n: tr }))}</p>${lines(v.isle.raids)}`));
  }
  if (v.auction.length) parts.push(sect('tab_market', L('awayAuction'), lines(v.auction)));
  parts.push(sect('tab_letters', L('awayMail'), `<p class="aw-line">${esc(v.letters.n ? L('awayMailText', { n: v.letters.n, u: v.letters.unread, from: v.letters.from.map(sv).join(', ') }) : L('awayMailNone'))}</p>`));
  parts.push(sect('map_monster', L('awayWorld'), v.world.length ? lines(v.world) : `<p class="aw-line muted">${esc(L('awayWorldNone'))}</p>`));
  parts.push(sect('goal', L('awayWeekly'), v.weekly.map((w) => `<p class="aw-line">${esc(L('awayWeeklyRow', { what: weeklyWhat(w.kind, w.region), place: w.place ? `${L('weeklyPlace', { n: w.place })} (${fmt(w.value)})` : L('awayNoPlace'), leader: w.leader ?? L('awayNobody') }))}</p>`).join('')
    + (v.lastWeek.length ? `<div class="giver-h">${esc(L('awayLastWeek'))}</div>${v.lastWeek.map((w) => `<p class="aw-line">${esc(weeklyWhat(w.kind, w.region))}: <b>${esc(w.winner)}</b></p>`).join('')}` : '')));
  const gift = v.gift ? `<div class="card aw-gift"><h4 class="card-h">${icon('coin', '', 'ico-md')}${esc(L('awayGift'))}</h4><p class="aw-line">${esc(L('awayGiftText', { silver: fmt(v.gift.silver), prov: v.gift.provisions, speed: v.gift.speedups ? L('awayGiftSpeed') : '' }))}</p><button class="btn btn-primary" data-aw-take>${esc(L('awayTake'))}</button></div>` : '';
  root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('awayTitle'))}</h2><div class="sub">${esc(L('awaySub', { h: v.hours }))}</div></div></div>
    <div class="modal-body away">${gift}<div class="aw-cards">${parts.join('')}</div><div class="aw-acts"><button class="btn" data-aw-close>${esc(L('awayLater'))}</button></div></div>`;
  root.querySelector<HTMLElement>('[data-aw-take]')?.addEventListener('click', () => {
    send({ t: 'away', action: 'take' });
    v.gift = null;
    close();
  });
  root.querySelector<HTMLElement>('[data-aw-close]')?.addEventListener('click', close);
}
