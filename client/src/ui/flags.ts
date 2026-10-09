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
import type { ClientMsg, ShipInfo } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/flags.ts';
import type { ClientState } from '../state.ts';
import { esc, icon } from './dom.ts';

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
  const label = kind === 'neutral' ? L('mark.neutral') : kind === 'pirate' ? L('mark.pirate') : pennant ? L('mark.pennant') : guild ? L('mark.guild', { tag: guild, city: cityName }) : city ? L('mark.city', { city: cityName }) : '';
  return { kind, city, guild, noBoard: (flags & SF.NO_BOARD) !== 0, pennant, label };
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
  return `<span class="fl-chip fl-chip--${c.kind}"><i class="fl-mark fl-${c.kind}" style="--fl-c:${cc};--fl-s:${ss}" aria-hidden="true"></i><span>${esc(c.label)}</span>${c.noBoard ? `<em class="fl-nb">${esc(L('mark.noBoard'))}</em>` : ''}</span>`;
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
    const no = !docked || (k === 'neutral' && !!v.noNeutral);
    const title = k === 'neutral' ? L('fl.neutral') : k === 'pirate' ? L('fl.pirate') : L('fl.faction');
    const sub = k === 'neutral' ? L('fl.neutralSub') : k === 'pirate' ? L('fl.pirateSub') : L('fl.factionSub');
    // The Green Pennant rides over a young captain's city flag (docs/24): said on that option, in a word.
    const whose = k === 'faction' ? (v.guild ? L('fl.guild', { tag: v.guild, city: FACTIONS[here].short }) : L('fl.city', { city: FACTIONS[here].short })) : '';
    const pen = k === 'faction' && v.pennant ? `<i class="fl-pen" title="${esc(L('mark.pennant'))}" aria-label="${esc(L('mark.pennant'))}"></i>` : '';
    const state_ = on ? `<em class="fl-on">${esc(L('fl.flying'))}</em>` : soon ? `<em class="fl-soon">${esc(L('fl.next', { n: mins }))}</em>` : '';
    return `<button type="button" class="fl-opt fl-opt--${k}${on ? ' on' : ''}${soon ? ' soon' : ''}" role="radio" aria-checked="${on}" data-colours="${k}"${no ? ' disabled' : ''}>
      ${flagMark(k, k === 'faction' ? here : null)}<span class="fl-t"><b>${esc(title)}</b>${whose ? `<span class="fl-whose">${esc(whose)}${pen}</span>` : ''}<small>${esc(sub)}</small>${state_}</span></button>`;
  };
  const line = !docked ? L('fl.atSea') : v.noNeutral && v.flag !== 'neutral' ? L('fl.noNeutral') : L('fl.rule');
  // (In the port the option says «зелёный вымпел» already; the ship window and «Флаг и закон» say what it is.)
  const pennant = v.pennant && opts.head !== false ? ` ${L('fl.pennant', { n: v.pennantHoursLeft })}` : '';
  // (The port's own place is named «Флаг» already: no heading over it there, the room is the boarding switch's.)
  const law = lawlessHere(state) ? `<p class="fl-law" role="note">${icon('danger', '', 'ico-sm')}<span>${esc(L('fl.lawCard'))}</span></p>` : '';
  return `<div class="card fl-card${law ? ' fl-card--lawless' : ''}">${opts.head === false ? '' : `<h4 class="card-h">${icon('tab_law', '', 'ico-md')}${esc(L('fl.title'))}</h4>`}${law}
    <div class="fl-opts" role="radiogroup" aria-label="${esc(L('fl.title'))}">${COLOURS.map(opt).join('')}</div>
    <p class="fl-line muted">${esc(line)}${pennant ? `<span class="good">${esc(pennant)}</span>` : ''}</p>
    <button type="button" class="fl-board${v.noBoard ? ' off' : ''}" role="switch" aria-checked="${!v.noBoard}" data-noboard="${v.noBoard ? '0' : '1'}"${docked ? '' : ' disabled'}>
      <i class="fl-nb-ico" aria-hidden="true"></i><span class="fl-t"><b>${esc(v.noBoard ? L('fl.boardOff') : L('fl.boardOn'))}</b><small>${esc(L('fl.boardSub'))}</small></span><i class="fl-sw" aria-hidden="true"></i></button></div>`;
}

/** The card's buttons: an order for colours, boarding on or off. */
export function bindColours(root: HTMLElement, send: (m: ClientMsg) => void): void {
  root.querySelectorAll<HTMLButtonElement>('[data-colours]').forEach((el) => (el.onclick = () => send({ t: 'pvp', action: 'colours', flag: el.dataset.colours as Colours })));
  root.querySelectorAll<HTMLButtonElement>('[data-noboard]').forEach((el) => (el.onclick = () => send({ t: 'pvp', action: 'no_board', on: el.dataset.noboard === '1' })));
}

export const FLAGS_TAB = { label: () => L('fl.tab'), hint: () => L('fl.tabHint') };
