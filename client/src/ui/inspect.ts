// Inspecting a captain (docs/11 P6), as WoW's inspect: the face of their Path, their level, title and guild, the
// ship they sail, their deeds and the work they have done — and a whisper, a call aboard or a friend's name.

import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { InspectView } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import { assetUrl } from '../assets.ts';
import { dict } from '../i18n.ts';
import { serverText } from '../lang/server.ts';
import { askHtml } from './confirm.ts';
import { esc } from './dom.ts';
import { placeName } from './maps.ts';

const EN = {
  level: 'Level {n} · {path}',
  ship: 'Sails the {ship} ({cls})',
  waters: 'In {region}',
  deeds: 'Legend deeds',
  season: 'Season path',
  quests: 'Quests done',
  contracts: 'Group contracts',
  mentored: 'Captains guided',
  rating: 'Duel rating',
  wanted: 'Wanted',
  whisper: 'Whisper',
  close: 'Close',
  invite: 'Call aboard',
  befriend: 'Befriend',
};
const RU: typeof EN = {
  level: 'Уровень {n} · {path}',
  ship: 'Ходит на «{ship}» ({cls})',
  waters: 'Воды: {region}',
  deeds: 'Подвиги легенды',
  season: 'Путь сезона',
  quests: 'Выполнено заданий',
  contracts: 'Контракты на отряд',
  mentored: 'Проведено наставником',
  rating: 'Рейтинг дуэлей',
  wanted: 'Розыск',
  whisper: 'Шепнуть',
  close: 'Закрыть',
  invite: 'Позвать',
  befriend: 'В друзья',
};
const L = dict(EN, RU);

export interface InspectActs {
  whisper: (name: string) => void;
  invite: (name: string) => void;
  befriend: (name: string) => void;
}

/** The captain's card; "Whisper" opens the chat to them, the other two act at once. */
export function inspectDialog(v: InspectView, acts: InspectActs, opts: { friend: boolean; canInvite: boolean }): void {
  const cap = CAPTAINS[v.captain];
  const face = cap ? assetUrl(cap.portrait) : null;
  const stat = (k: keyof typeof EN, n: number | string) => `<div class="insp-stat"><span class="muted">${esc(L(k))}</span><b>${esc(String(n))}</b></div>`;
  const body = `<div class="giver insp">
      ${face ? `<div class="giver-face" style="background-image:url('${face}')"></div>` : ''}
      <div class="giver-words">
        <h3 id="confirm-text" class="giver-name">${esc(v.name)}</h3>
        ${v.title ? `<div class="giver-who muted">${esc(serverText(v.title))}</div>` : ''}
        ${v.guild ? `<div class="insp-guild">[${esc(v.guild.tag)}] ${esc(v.guild.name)}</div>` : ''}
        <p class="insp-line">${esc(L('level', { n: v.level, path: cap ? serverText(cap.archetype) : v.captain }))}</p>
        <p class="insp-line">${esc(L('ship', { ship: placeName(v.ship.name), cls: SHIP_CLASSES[v.ship.classId]?.name ?? v.ship.classId }))}</p>
        <p class="insp-line muted">${esc(L('waters', { region: placeName(REGIONS[v.region]?.name ?? v.region) }))}</p>
      </div></div>
    <div class="insp-stats">${stat('deeds', v.deeds)}${stat('season', v.seasonLevel)}${stat('quests', v.questsDone)}${stat('contracts', v.contracts)}${stat('mentored', v.mentored)}${stat('rating', v.rating)}${v.wanted ? stat('wanted', '☠'.repeat(v.wanted)) : ''}</div>
    <div class="insp-acts">${opts.canInvite ? `<button class="btn btn-small" data-insp-invite>${esc(L('invite'))}</button>` : ''}${opts.friend ? '' : `<button class="btn btn-small" data-insp-friend>${esc(L('befriend'))}</button>`}</div>`;
  void askHtml(body, L('whisper'), L('close'), 'giver-panel').then((ok) => ok && acts.whisper(v.name));
  const root = document.getElementById('confirm');
  root?.querySelector<HTMLElement>('[data-insp-invite]')?.addEventListener('click', (e) => {
    acts.invite(v.name);
    (e.currentTarget as HTMLElement).remove();
  });
  root?.querySelector<HTMLElement>('[data-insp-friend]')?.addEventListener('click', (e) => {
    acts.befriend(v.name);
    (e.currentTarget as HTMLElement).remove();
  });
}
