// A captain's colours and «Абордаж: выкл» (docs/24 C1, D1–D3; owner, 2026-10-07): the port's choice (three big
// options, a line each, and the boarding switch), the same card in the ship window and «Флаг и закон», and how a ship's
// colours read on the target line and card. The flag over the ship itself is the renderer's (render/renderer.ts).
// Its looks are flags.css: a small cloth on a pole drawn with CSS (no art of its own), 44 px targets.

import { FACTIONS } from '../../../shared/src/data/factions.ts';
import type { FactionId } from '../../../shared/src/data/factions.ts';
import { COLOURS } from '../../../shared/src/data/colours.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { Colours } from '../../../shared/src/data/colours.ts';
import { SF } from '../../../shared/src/protocol.ts';
import type { ClientMsg, PatentOfferView, PatentView, ShipInfo } from '../../../shared/src/protocol.ts';
import { PATENT_CUT } from '../../../shared/src/data/patent.ts';
import { RANKS, SERVICES } from '../../../shared/src/data/marque.ts';
import { ask } from './confirm.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/flags.ts';
import type { ClientState } from '../state.ts';
import { esc, icon } from './dom.ts';
import { serverText as serverWords } from '../lang/server.ts';

const L = dict(EN, RU);

/** The stylesheet, put in once (index.html belongs to the sea HUD's layout). */
export function flagsCss(): void {
  if (typeof document === 'undefined' || document.getElementById('flags-css')) return;
  const l = document.createElement('link');
  l.id = 'flags-css';
  l.rel = 'stylesheet';
  l.href = '/src/ui/flags.css';
  document.head.append(l);
}

/** A flag's cloth and its stripe: neutral off-white, the pirate flag black with a red bar, a city's in its colours. */
export function flagCloth(kind: Colours, city?: FactionId | null): { c: string; s: string } {
  if (kind === 'neutral') return { c: '#e6e0d0', s: '#9d9684' };
  if (kind === 'pirate') return { c: '#121214', s: '#a3302a' };
  const f = FACTIONS[city ?? 'free'];
  return { c: f.flag, s: f.lantern };
}

/** A ship's colours as the world sees them: her snapshot's flags and her info. Null for the sea's own ships. */
export interface ShipColours {
  kind: Colours;
  city: FactionId | null;
  guild: string | null;
  noBoard: boolean;
  /** A young captain under the Green Pennant (docs/02 §10): neutral to captains in contested water. */
  pennant: boolean;
  /** A privateer under her city's colours (owner, 2026-11-02: «Каперский патент»). */
  privateer: boolean;
  /** «нейтральный флаг», «пиратский флаг», «флаг: Корона», «[ТЕГ] · Корона», «зелёный вымпел». */
  label: string;
}

export function shipColours(flags: number, info: Pick<ShipInfo, 'isPlayer' | 'city' | 'guild'> | undefined): ShipColours | null {
  if (!info?.isPlayer) return null;
  const kind: Colours = flags & SF.BLACK_FLAG ? 'pirate' : flags & SF.NEUTRAL ? 'neutral' : 'faction';
  const city = kind === 'faction' ? info.city ?? null : null;
  const guild = kind === 'faction' ? info.guild ?? null : null;
  const cityName = city ? FACTIONS[city].short : '';
  const pennant = kind === 'faction' && (flags & SF.GREEN_PENNANT) !== 0;
  const privateer = kind === 'faction' && (flags & SF.PRIVATEER) !== 0;
  const label = kind === 'neutral' ? L('mark.neutral') : kind === 'pirate' ? L('mark.pirate') : privateer ? L('mark.privateer', { city: cityName }) : pennant ? L('mark.pennant') : guild ? L('mark.guild', { tag: guild, city: cityName }) : city ? L('mark.city', { city: cityName }) : '';
  return { kind, city, guild, noBoard: (flags & SF.NO_BOARD) !== 0, pennant, privateer, label };
}

/** A ship's cloth: her colours', the Green Pennant's green over a young captain's city flag. */
export function shipCloth(c: ShipColours): { c: string; s: string } {
  return c.pennant ? { c: '#3f7d4a', s: '#c8d6b8' } : flagCloth(c.kind, c.city);
}

/** The little cloth on its pole (flags.css). */
export function flagMark(kind: Colours, city?: FactionId | null, cls = ''): string {
  const { c, s } = flagCloth(kind, city);
  return `<i class="fl-mark fl-${kind}${cls ? ` ${cls}` : ''}" style="--fl-c:${c};--fl-s:${s}" aria-hidden="true"></i>`;
}

/** Her colours on the target card: the cloth and the words, and «без абордажа». */
export function flagChip(c: ShipColours | null): string {
  if (!c || !c.label) return '';
  const { c: cc, s: ss } = shipCloth(c);
  return `<span class="fl-chip fl-chip--${c.kind}${c.privateer ? ' fl-chip--privateer' : ''}"><i class="fl-mark fl-${c.kind}" style="--fl-c:${cc};--fl-s:${ss}" aria-hidden="true"></i><span>${esc(c.label)}</span>${c.noBoard ? `<em class="fl-nb">${esc(L('mark.noBoard'))}</em>` : ''}</span>`;
}

/** Her colours for the kit's target line (a cloth, its words for the screen reader). */
export function flagLine(c: ShipColours | null): { kind: Colours; color: string; stripe: string; label: string; noBoard?: boolean } | undefined {
  if (!c) return undefined;
  const { c: color, s: stripe } = shipCloth(c);
  return { kind: c.kind, color, stripe, label: [c.label, c.noBoard ? L('mark.noBoard') : ''].filter(Boolean).join(' · '), ...(c.noBoard ? { noBoard: true } : {}) };
}

/** Lawless water about her (owner, 2026-10-09: there the colours shield nobody). */
export function lawlessHere(state: Pick<ClientState, 'region'>): boolean {
  return REGIONS[state.region]?.safety === 'lawless';
}

/** The lawless waters' notice: its heading and its line. */
export function lawlessWords(): { title: string; line: string } {
  return { title: L('fl.lawTitle'), line: L('fl.lawNote') };
}

/** The card: three big options (each with its line), what flies now and what is ordered, and the boarding switch.
 *  Live only in port; at sea it says where they are changed. In lawless water it says first that no flag shields
 *  anyone there (owner, 2026-10-09). */
export function coloursCard(state: ClientState, opts: { head?: boolean } = {}): string {
  const self = state.self;
  const v = self?.pvp;
  if (!self || !v) return '';
  const docked = self.dockedAt;
  const port = docked ? state.ports.find((p) => p.id === docked) : undefined;
  const here: FactionId = port?.faction ?? v.city;
  const mins = v.next ? Math.max(1, Math.ceil((v.nextAt - Date.now()) / 60_000)) : 0;
  const opt = (k: Colours): string => {
    // The city flag here is this port's city's (or the guild's over it): flying another city's, it is a change.
    const on = v.flag === k && (k !== 'faction' || !port || v.city === here);
    const soon = v.next === k;
    // (skulls lock the colours: only the pirate flag goes up over them — forum 34)
    const no = !docked || (k === 'neutral' && !!v.noNeutral) || (!!v.locked && k !== 'pirate' && !on);
    const title = k === 'neutral' ? L('fl.neutral') : k === 'pirate' ? L('fl.pirate') : L('fl.faction');
    const sub = k === 'neutral' ? L('fl.neutralSub') : k === 'pirate' ? L('fl.pirateSub') : L('fl.factionSub');
    // The Green Pennant rides over a young captain's city flag (docs/24): said on that option, in a word.
    const whose = k === 'faction' ? (v.guild ? L('fl.guild', { tag: v.guild, city: FACTIONS[here].short }) : L('fl.city', { city: FACTIONS[here].short })) : '';
    const pen = k === 'faction' && v.pennant ? `<i class="fl-pen" title="${esc(L('mark.pennant'))}" aria-label="${esc(L('mark.pennant'))}"></i>` : '';
    const state_ = on ? `<em class="fl-on">${esc(L('fl.flying'))}</em>` : soon ? `<em class="fl-soon">${esc(L('fl.next', { n: mins }))}</em>` : '';
    return `<button type="button" class="fl-opt fl-opt--${k}${on ? ' on' : ''}${soon ? ' soon' : ''}" role="radio" aria-checked="${on}" data-colours="${k}"${no ? ' disabled' : ''}>
      ${flagMark(k, k === 'faction' ? here : null)}<span class="fl-t"><b>${esc(title)}</b>${whose ? `<span class="fl-whose">${esc(whose)}${pen}</span>` : ''}<small>${sub.split('|').map((x) => `<span class="fl-ln">${esc(x)}</span>`).join('')}</small>${state_}</span></button>`;
  };
  // (with skulls their own note above says it all: no line under the options — the boarding switch stays on the screen)
  const line = v.skulls ? '' : !docked ? L('fl.atSea') : v.noNeutral && v.flag !== 'neutral' ? L('fl.noNeutral') : L('fl.rule');
  // (In the port the option says «зелёный вымпел» already; the ship window and «Флаг и закон» say what it is.)
  const pennant = v.pennant && opts.head !== false ? ` ${L('fl.pennant', { n: v.pennantHoursLeft })}` : '';
  // (The port's own place is named «Флаг» already: no heading over it there, the room is the boarding switch's.)
  // «Абордаж: выкл» holds against captains only under neutral colours (owner, 2026-10-29): on under another flag, it
  // stays on but says it does nothing now.
  const idle = v.noBoard && v.flag !== 'neutral';
  const law = lawlessHere(state) ? `<p class="fl-law" role="note">${icon('danger', '', 'ico-sm')}<span>${esc(L('fl.lawCard'))}</span></p>` : '';
  const skulls = skullsNote(state);
  return `<div class="card fl-card${law ? ' fl-card--lawless' : ''}">${opts.head === false ? '' : `<h4 class="card-h">${icon('tab_law', '', 'ico-md')}${esc(L('fl.title'))}</h4>`}${law}${skulls}
    <div class="fl-opts" role="radiogroup" aria-label="${esc(L('fl.title'))}">${COLOURS.map(opt).join('')}</div>${patentCard(state)}
    <p class="fl-line muted"${line || pennant ? '' : ' hidden'}>${esc(line)}${pennant ? `<span class="good">${esc(pennant)}</span>` : ''}</p>
    <button type="button" class="fl-board${v.noBoard ? ' off' : ''}${idle ? ' idle' : ''}" role="switch" aria-checked="${!v.noBoard}" data-noboard="${v.noBoard ? '0' : '1'}"${docked ? '' : ' disabled'}>
      <i class="fl-nb-ico" aria-hidden="true"></i><span class="fl-t"><b>${esc(v.noBoard ? L('fl.boardOff') : L('fl.boardOn'))}</b>${idle ? `<em class="fl-idle">${esc(L('fl.boardIdle'))}</em>` : ''}<small>${esc(L('fl.boardSub'))}</small></span><i class="fl-sw" aria-hidden="true"></i></button></div>`;
}

/** «Каперский патент» (owner, 2026-11-02): the fourth card under the three flags — whose, for how long, its prey, the
 *  rules in three lines, buy or renew (a lawful harbour's offer), or what runs now. Nothing at sea with none held. */
export function patentCard(state: ClientState): string {
  const v = state.self?.pvp;
  if (!v) return '';
  const held: PatentView | null = v.patent && v.patent.until > Date.now() ? v.patent : null;
  const offer: PatentOfferView | null = v.patentOffer ?? null;
  if (!held && !offer) return '';
  const by = (held ?? offer)!.by;
  const enemies = (held ?? offer)!.enemies, allies = (held ?? offer)!.allies;
  const names = (xs: FactionId[]) => (xs.length ? xs.map((f) => FACTIONS[f].short).join(', ') : L('pt.none'));
  const days = offer?.days ?? 7;
  const left = held ? patentLeft(held.until - Date.now()) : '';
  const state_ = held ? `<em class="fl-on">${esc(left)}</em>` : '';
  const lines = [L('pt.prey', { list: names(enemies) }), L('pt.l1'), L('pt.l2', { allies: names([by, ...allies]) }), L('pt.l3', { cut: Math.round(PATENT_CUT * 100) })];
  const cost = offer ? offer.price.toLocaleString('ru-RU') : '';
  const btn = offer && !offer.blocked
    ? `<button type="button" class="btn btn-small fl-pat-buy" data-patent="1"${serviceClashAsk(offer) ? ` data-ask="${esc(serviceClashAsk(offer))}"` : ''}${(state.self?.gold ?? 0) < offer.price ? ' disabled' : ''}>${esc(offer.renew ? L('pt.renew', { days, cost }) : L('pt.buy', { cost }))}</button>`
    : '';
  const why = offer?.blocked ? `<p class="fl-pat-why">${esc(serverWords(offer.blocked))}</p>` : !offer ? `<p class="fl-pat-why">${esc(L('pt.atSea'))}</p>` : '';
  const sv = patentServiceLine(offer);
  return `<div class="fl-opt fl-opt--patent fl-pat${held ? ' on' : ''}" role="group" aria-label="${esc(L('pt.title'))}">
    ${icon(`faction_${by}`, '⚓', 'fl-pat-ico')}<span class="fl-t"><b>${esc(L('pt.title'))}</b><span class="fl-whose">${esc(L('pt.whose', { city: FACTIONS[by].short, days }))}</span><small>${lines.map((x, i) => `<span class="fl-ln${i === 0 ? ' fl-prey' : ''}">${esc(x)}</span>`).join('')}</small>${state_}</span>${btn}</div>${sv}${why}`;
}

/** Her service beside the patent's offer (forum, Эдуард, post 70: «потерял все регалии и привилегии Короны, хотя Лига —
 *  союзник Короны»): kept — said in green, so nobody fears for it; lost (the issuer its enemy) — said in red, and asked
 *  again before the silver moves. */
function serviceWords(offer: PatentOfferView): { of: string; to: string; rank: string; by: string } | null {
  const v = offer.service;
  if (!v) return null;
  const ru = lang() === 'ru' ? 1 : 0;
  return { of: SERVICES[v.id].of[ru].replace(/^of /, ''), to: L(`sv.to.${v.id}`), rank: RANKS[v.rank]?.[ru] ?? '', by: FACTIONS[offer.by].short };
}
export function patentServiceLine(offer: PatentOfferView | null | undefined): string {
  const w = offer ? serviceWords(offer) : null;
  if (!offer?.service || !w) return '';
  if (!offer.service.keeps) return `<p class="fl-pat-sv fl-pat-sv--lose" role="alert">${icon('danger', '⚠', 'ico-sm')}<span>${esc(L('pt.svLose', w))}</span></p>`;
  return `<p class="fl-pat-sv fl-pat-sv--keep">${icon('ok', '✓', 'ico-sm')}<span>${esc(L(offer.service.id === offer.by ? 'pt.svOwn' : 'pt.svKeep', w))}</span></p>`;
}
/** The question before a patent of her service's enemy (the buy button carries it), or '' when the patent keeps it. */
export function serviceClashAsk(offer: PatentOfferView | null | undefined): string {
  const w = offer?.service && !offer.service.keeps ? serviceWords(offer) : null;
  return w ? L('pt.svAsk', w) : '';
}

/** «6 дн. 23 ч» / «5 ч 12 мин» left on a patent. */
export function patentLeft(ms: number): string {
  const h = Math.max(0, Math.floor(ms / 3_600_000));
  return h >= 24 ? L('pt.left', { d: Math.floor(h / 24), h: h % 24 }) : L('pt.leftH', { h, m: Math.max(0, Math.floor((ms % 3_600_000) / 60_000)) });
}

/** The question before an act of piracy (the ring's «Атаковать» on a peaceful ship neither enemy nor ally of her patent). */
export function piracyWords(name: string): { ask: string; go: string; no: string } {
  return { ask: L('pt.piracyAsk', { name }), go: L('pt.piracyGo'), no: L('pt.piracyNo') };
}

/** Her skulls on the card (forum 34): what they lock, how to wash them off — time out of fights, or a pardon bought in a
 *  pirate haven (its button there). Nothing when she is clean. */
export function skullsNote(state: ClientState): string {
  const v = state.self?.pvp;
  if (!v?.skulls) return '';
  const port = state.self?.dockedAt ? state.ports.find((p) => p.id === state.self!.dockedAt) : undefined;
  const haven = !!port && (port.faction === 'free' || port.faction === 'brokers' || port.faction === 'confederacy');
  const cost = v.pardon ?? 0;
  return `<div class="fl-skulls" role="note"><b class="fl-sk">${esc(L('fl.skulls', { s: '☠'.repeat(v.skulls) }))}</b>
    <span>${esc(L('fl.locked'))} ${esc(L('fl.wash', { n: v.washAllMin ?? 0, m: v.washMin ?? 0, cost: cost.toLocaleString('ru-RU') }))}</span>
    ${haven ? `<button type="button" class="btn btn-small fl-pardon" data-pardon="1"${(state.self?.gold ?? 0) < cost ? ' disabled' : ''}>${esc(L('fl.pardonBuy', { cost: cost.toLocaleString('ru-RU') }))}</button>` : ''}</div>`;
}

/** The refusal at a peaceful ship and its one-tap hint, in her language (main.ts shows it as a tap toast). */
export function peaceWords(): { line: string; hint: string } {
  return { line: L('fl.peace'), hint: L('fl.peaceHint') };
}
/** Her skulls in a line for the HUD's badge (forum 34): how many, what they lock, how to wash them. */
export function skullsTip(state: ClientState): string {
  const v = state.self?.pvp;
  if (!v?.skulls) return '';
  return `${L('fl.skulls', { s: '☠'.repeat(v.skulls) })}. ${L('fl.locked')} ${L('fl.wash', { n: v.washAllMin ?? 0, m: v.washMin ?? 0, cost: (v.pardon ?? 0).toLocaleString('ru-RU') })}`;
}
export function portHint(): string {
  return L('fl.portHint');
}

/** The card's buttons: an order for colours, boarding on or off. */
export function bindColours(root: HTMLElement, send: (m: ClientMsg) => void): void {
  root.querySelectorAll<HTMLButtonElement>('[data-pardon]').forEach((el) => (el.onclick = () => send({ t: 'pardon' })));
  root.querySelectorAll<HTMLButtonElement>('[data-patent]').forEach((el) => (el.onclick = () => {
    // (her service's enemy's patent: the warning first, the silver only on yes — forum post 70)
    if (el.dataset.ask) void ask(el.dataset.ask, L('pt.svGo'), L('pt.svNo')).then((ok) => ok && send({ t: 'pvp', action: 'patent', confirm: true }));
    else send({ t: 'pvp', action: 'patent' });
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-colours]').forEach((el) => (el.onclick = () => send({ t: 'pvp', action: 'colours', flag: el.dataset.colours as Colours })));
  root.querySelectorAll<HTMLButtonElement>('[data-noboard]').forEach((el) => (el.onclick = () => send({ t: 'pvp', action: 'no_board', on: el.dataset.noboard === '1' })));
}

export const FLAGS_TAB = { label: () => L('fl.tab'), hint: () => L('fl.tabHint') };
