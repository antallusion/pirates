// The quest journal (docs/11 P6): the day's orders and the common cause above, the quests under way in a list,
// and the chosen one in full — the giver's face and words, every step (done, now, ahead), the pay — with
// «Follow», «Share» (in a group) and «Set aside».

import type { DutchmanView } from '../../../shared/src/protocol.ts';
import { placeName } from './maps.ts';
import { OMENS } from '../../../shared/src/data/omens.ts';
import type { OmenId } from '../../../shared/src/data/omens.ts';
import { WONDER_KINDS } from '../../../shared/src/data/wonders.ts';
import type { WonderKind } from '../../../shared/src/data/wonders.ts';
import type { WondersView } from '../../../shared/src/protocol.ts';
import { nemesisLog } from './nemesis.ts';
import { BRETHREN_NAMES } from '../../../shared/src/data/raiding.ts';
import type { RaidView } from '../../../shared/src/protocol.ts';
import { namedPirates } from '../../../shared/src/data/pirates.ts';
import type { WantedView } from '../../../shared/src/protocol.ts';
import { REGIONS } from '../../../shared/src/world/regions.ts';
import type { RegionId } from '../../../shared/src/world/regions.ts';
import { BEASTS, BEAST_IDS } from '../../../shared/src/data/beasts.ts';
import type { BeastId } from '../../../shared/src/data/beasts.ts';
import { levelChip } from './levels.ts';
import type { ClientMsg, FishingView } from '../../../shared/src/protocol.ts';
import { assetUrl } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { SEA_LETTERS } from '../../../shared/src/data/encounters.ts';
import { FISH, FISH_IDS } from '../../../shared/src/data/fishing.ts';
import { serverText } from '../lang/server.ts';
import type { ClientState } from '../state.ts';
import { ask } from './confirm.ts';
import { commonLog, dailyLog } from './daily.ts';
import { esc, icon, money, xpBadge } from './dom.ts';
import { paidHtml } from './giver.ts';
import { tasksLog } from './worldmap.ts';
import { setTracked, trackedQuest } from './track.ts';
import { sagaButton } from './saga.ts';

const EN = {
  title: 'Quest journal',
  sub: 'Up to five quests at once. Take new ones on the notice boards in port and from the people on the islands.',
  none: 'No quests under way. The notice board in any tavern has work.',
  steps: 'The steps',
  letters: 'Letters of the sea ({n} of {max})',
  fishing: 'Fishing: craft {n} — {k} of {max} kinds taken',
  fishRow: '{fish}: {n} taken, heaviest {kg} kg',
  fishUnknown: 'not yet taken',
  beasts: 'The hunt: {n} beasts taken',
  guild: 'Hunters’ Guild: rank {rank} ({n} of {next} points)',
  brethren: 'The Brethren of the Coast: {rank} ({n} of {next} fame)',
  brethrenStats: 'Tributes taken: {t} · convoys broken: {c} · honour: {h}',
  brethrenPerks: 'Rank 1: the havens’ fences pay 66% · 2: a raid cheers the crew more · 3: the Code at any haven · 4: fences pay 75% · 5: the title',
  heat: 'Hot lanes: {list}',
  guildCaps: 'Named captains sunk: {n}',
  guildSea: '{sea}: {n} of 3 captains — {baron}',
  guildBaron: 'the baron hunts you',
  guildBaronNot: 'the baron keeps hidden',
  guildInformed: 'The informant’s word: {name} ({n} s)',
  guildPerks: 'Rank 3: the wanted on the chart within 5 km · 5: +15% bounty · 7: the pennant · 10: the title',
  beastRow: '{beast}: {n}',
  pay: 'Pay',
  follow: 'Follow',
  following: 'Followed',
  share: 'Share with the group',
  abandon: 'Set aside',
  confirmAbandon: 'Set this quest aside? Its progress is lost.',
  kind_path: 'Path',
  kind_legend: 'Legend',
  kind_story: 'Story',
  kind_job: 'Job',
  fast: 'A quarter more if done within {m} min',
  done: 'Quests done: {n}',
  lfg: 'Look for a group',
  lfgHint: 'Put this contract on the board of captains looking for a group',
  mates: 'In your group on it too',
  mateStep: '{name}, step {step}',
  tattoos: 'Tattoos',
  wonders: 'Atlas of Sea Wonders ({n} of {max})',
  wFirst: 'first found by {name}',
  wName: 'Name it',
  wNamePh: 'Your name for it',
  omen: 'The omen of the day',
  omenCoin: 'Nail a coin under the mast (50 silver)',
  dTitle: 'The Flying Dutchman: pages of his log ({n} of 5)',
  dSeen: 'Seen near {island}: a green lantern on the water.',
  dNext: 'The next page shows in {h} h.',
  dBattle: 'All five pages: he waits off {island}.',
  dWon: 'This week he went down to {name}.',
};
const RU: typeof EN = {
  title: 'Журнал заданий',
  sub: 'Не больше пяти заданий сразу. Новые — на досках объявлений в портах и у жителей островов.',
  none: 'Заданий нет. На доске объявлений в любой таверне есть работа.',
  steps: 'Шаги',
  letters: 'Письма моря ({n} из {max})',
  fishing: 'Промысел: навык {n} — поймано видов {k} из {max}',
  fishRow: '{fish}: поймано {n}, самая тяжёлая — {kg} кг',
  fishUnknown: 'ещё не поймана',
  beasts: 'Охота: добыто зверей — {n}',
  guild: 'Гильдия охотников: звание {rank} ({n} из {next} очков)',
  brethren: 'Береговое братство: {rank} ({n} из {next} славы)',
  brethrenStats: 'Взято даней: {t} · разбито конвоев: {c} · честь: {h}',
  brethrenPerks: 'Звание 1: скупщики гаваней платят 66% · 2: набег сильнее поднимает дух команды · 3: Кодекс в любой гавани · 4: скупщики платят 75% · 5: титул',
  heat: 'Жаркие трассы: {list}',
  guildCaps: 'Потоплено именных капитанов: {n}',
  guildSea: '{sea}: капитанов {n} из 3 — {baron}',
  guildBaron: 'барон охотится за вами',
  guildBaronNot: 'барон прячется',
  guildInformed: 'Слово осведомителя: {name} ({n} с)',
  guildPerks: 'Звание 3: разыскиваемые на карте в 5 км · 5: +15% к награде · 7: вымпел · 10: титул',
  beastRow: '{beast}: {n}',
  pay: 'Плата',
  follow: 'Следовать',
  following: 'Отслеживается',
  share: 'Поделиться с группой',
  abandon: 'Отложить',
  confirmAbandon: 'Отложить это задание? Сделанное по нему пропадёт.',
  kind_path: 'Путь',
  kind_legend: 'Легенда',
  kind_story: 'Сюжет',
  kind_job: 'Поручение',
  fast: 'На четверть больше, если управитесь за {m} мин',
  done: 'Выполнено заданий: {n}',
  lfg: 'Искать отряд',
  lfgHint: 'Написать этот контракт в поиске группы',
  mates: 'В отряде тоже взялись',
  mateStep: '{name}, шаг {step}',
  tattoos: 'Татуировки',
  wonders: 'Атлас чудес моря ({n} из {max})',
  wFirst: 'первым нашёл: {name}',
  wName: 'Назвать',
  wNamePh: 'Ваше имя для него',
  omen: 'Примета дня',
  omenCoin: 'Прибить монету под мачту (50 серебра)',
  dTitle: 'Летучий Голландец: страницы его журнала ({n} из 5)',
  dSeen: 'Видели у острова {island}: на воде зелёный фонарь.',
  dNext: 'Следующая страница появится через {h} ч.',
  dBattle: 'Все пять страниц: он ждёт у острова {island}.',
  dWon: 'На этой неделе его упокоил капитан {name}.',
};
const L = dict(EN, RU);

type Quest = NonNullable<ClientState['self']>['quests'][number];

export class Journal {
  private chosen: string | null = null;
  /** Opens the tattoos window (docs/12 P9). */
  openTattoos: (() => void) | null = null;
  /** Opens her saga (docs/12 P10 #20). */
  openSaga: (() => void) | null = null;
  private send: (m: ClientMsg) => void;
  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
  }

  render(root: HTMLElement, state: ClientState): void {
    const self = state.self;
    const quests = self?.quests ?? [];
    const tracked = trackedQuest(quests)?.id ?? null;
    if (!this.chosen || !quests.some((q) => q.id === this.chosen)) this.chosen = tracked ?? quests[0]?.id ?? null;
    const q = quests.find((x) => x.id === this.chosen) ?? null;
    const inGroup = (state.party?.members.length ?? 0) > 1;
    root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub'))}</div></div><div class="jr-head-btns"><button class="btn btn-small" data-saga>${esc(sagaButton())}${self?.saga?.length ? ` <span class="h-count">${self.saga.length}</span>` : ''}</button><button class="btn btn-small jr-tattoos" data-tattoos>${esc(L('tattoos'))}${state.tattoos?.pending.length ? ` <span class="h-count">${state.tattoos.pending.length}</span>` : ''}</button></div></div>
      <div class="modal-body journal">
        <div class="jr-side">
          <div class="jr-list">${quests.length ? quests.map((x) => this.row(x, x.id === this.chosen, x.id === tracked)).join('') : `<p class="muted">${esc(L('none'))}</p>`}</div>
          <div class="jr-day">${dailyLog(self?.daily)}${commonLog(self?.common)}${tasksLog(state, false)}${omenLog(state.omen)}${dutchmanLog(state.dutchman)}${wondersLog(state.wonders)}${nemesisLog(state.wanted?.nemeses, state.wanted?.heads ?? 0)}${hunterLog(state.wanted)}${brethrenLog(state.raid)}${fishingLog(self?.fishing)}${beastLog(self?.beasts)}${lettersLog(self?.seaLetters ?? [])}</div>
          ${self?.questsDone.length ? `<details class="jr-done"><summary>${esc(L('done', { n: self.questsDone.length }))}</summary><ol>${(self.questsRecent ?? []).map((n) => `<li>${esc(serverText(n))}</li>`).join('')}</ol></details>` : ''}
        </div>
        <div class="jr-detail">${q ? this.detail(q, q.id === tracked, inGroup) : ''}</div>
      </div>`;
    root.querySelectorAll<HTMLElement>('[data-jq]').forEach((b) => (b.onclick = () => {
      this.chosen = b.dataset.jq!;
      this.render(root, state);
      root.querySelector('.jr-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));
    root.querySelector<HTMLElement>('[data-tattoos]')?.addEventListener('click', () => this.openTattoos?.());
    root.querySelector<HTMLElement>('[data-saga]')?.addEventListener('click', () => this.openSaga?.());
    root.querySelectorAll<HTMLElement>('[data-wname]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.wname!;
      const name = root.querySelector<HTMLInputElement>(`input[data-wfor="${id}"]`)?.value ?? '';
      this.send({ t: 'wonder', id, name });
    }));
    root.querySelector<HTMLElement>('[data-follow]')?.addEventListener('click', () => {
      setTracked(this.chosen);
      this.render(root, state);
    });
    root.querySelector<HTMLElement>('[data-share]')?.addEventListener('click', () => this.chosen && this.send({ t: 'quest', action: 'share', id: this.chosen }));
    // A group contract: on the board of those looking for a group, by its name.
    root.querySelector<HTMLElement>('[data-lfg]')?.addEventListener('click', () => q && this.send({ t: 'group', action: 'lfg', note: serverText(q.name) }));
    root.querySelector<HTMLElement>('[data-abandon]')?.addEventListener('click', () => {
      const id = this.chosen;
      if (id) void ask(L('confirmAbandon')).then((ok) => ok && this.send({ t: 'quest', action: 'abandon', id }));
    });
  }

  private row(q: Quest, on: boolean, tracked: boolean): string {
    return `<button class="jr-row${on ? ' on' : ''}${tracked ? ' tracked' : ''}" data-jq="${esc(q.id)}">
      <b>${tracked ? icon('goal', '◆', 'ico-sm') : ''}${esc(serverText(q.name))}${q.ship ? ` ${levelChip(q.ship)}` : ''}</b>
      <span class="muted">${esc(L(`kind_${q.kind}` as 'kind_job'))} · ${q.step}/${q.steps}${q.mates?.length ? ` · ${icon('tab_group', '⚑', 'ico-sm')}${q.mates.length}` : ''}</span></button>`;
  }

  private detail(q: Quest, tracked: boolean, inGroup: boolean): string {
    const face = q.portrait ? assetUrl(`portrait.${q.portrait}`) : null;
    const texts = q.stepTexts ?? [q.text];
    const steps = texts.map((t, i) => {
      const n = i + 1;
      const state = n < q.step ? 'done' : n === q.step ? 'now' : 'ahead';
      const count = state === 'now' && q.need > 1 ? ` <span class="jr-count">${q.progress}/${q.need}</span>` : '';
      return `<li class="${state}">${state === 'done' ? '<span class="jr-mark">✓</span>' : state === 'now' ? '<span class="jr-mark now">◆</span>' : '<span class="jr-mark">·</span>'}<span>${esc(serverText(t))}${count}</span></li>`;
    }).join('');
    const canShare = inGroup && (q.kind === 'job' || q.kind === 'story');
    return `<div class="giver">
        ${face ? `<div class="giver-face" style="background-image:url('${face}')"></div>` : ''}
        <div class="giver-words">
          <h3 class="giver-name">${esc(serverText(q.name))}</h3>
          <div class="giver-who muted">${esc(serverText(q.mentor))}</div>
          ${q.summary ? `<p class="giver-say">«${esc(serverText(q.summary))}»</p>` : ''}
        </div></div>
      <div class="giver-steps"><div class="giver-h">${esc(L('steps'))}</div><ol class="jr-steps">${steps}</ol></div>
      ${q.mates?.length ? `<div class="jr-mates"><span class="giver-h">${esc(L('mates'))}</span>${q.mates.map((m) => `<span class="jr-mate">${esc(L('mateStep', { name: m.name, step: m.step }))}</span>`).join('')}</div>` : ''}
      ${q.silver !== undefined ? `<div class="giver-pay"><span class="giver-h">${esc(L('pay'))}</span>${paidHtml(q.silver, q.pay, q.paid)}${xpBadge(q.xp ?? 0)}${q.fastIn ? `<span class="jr-fast">${esc(L('fast', { m: Math.max(1, Math.ceil(q.fastIn / 60)) }))}</span>` : ''}</div>` : ''}
      <div class="jr-acts">
        <button class="btn btn-small${tracked ? ' on' : ''}" data-follow ${tracked ? 'disabled' : ''}>${esc(L(tracked ? 'following' : 'follow'))}</button>
        ${canShare ? `<button class="btn btn-small" data-share>${esc(L('share'))}</button>` : ''}
        ${q.category === 'elite' && !inGroup ? `<button class="btn btn-small" data-lfg title="${esc(L('lfgHint'))}">${esc(L('lfg'))}</button>` : ''}
        ${q.kind === 'job' || q.kind === 'story' ? `<button class="btn btn-small btn-danger" data-abandon>${esc(L('abandon'))}</button>` : ''}
      </div>`;
  }
}

/** The Flying Dutchman's week (docs/12 P10 #10): the pages taken, where the others were seen, his island. */
function dutchmanLog(v: DutchmanView | null): string {
  if (!v) return '';
  const taken = v.pages.filter((p) => p.taken).length;
  const lines = v.pages.map((p) => p.taken ? `<p class="jr-letter">${esc(serverText(p.text ?? ''))}</p>` : `<p class="jr-fish muted">${esc(L('dSeen', { island: placeName(p.island) }))}</p>`).join('');
  const next = v.nextIn !== null ? `<p class="jr-fish muted">${esc(L('dNext', { h: Math.max(1, Math.ceil(v.nextIn / 3600)) }))}</p>` : '';
  const battle = v.battle ? `<p class="jr-fish dutch-go">${esc(L('dBattle', { island: placeName(v.battle.island) }))}</p>` : '';
  const won = v.winner ? `<p class="jr-fish">${esc(L('dWon', { name: v.winner }))}</p>` : '';
  return `<div class="jr-fishing jr-dutchman"><div class="giver-h">${esc(L('dTitle', { n: taken }))}</div>${lines}${next}${battle}${won}</div>`;
}

/** The omen of the day (docs/12 P10 #9). */
export function omenLog(id: OmenId | null, coin = false): string {
  if (!id) return '';
  const ru = lang() === 'ru' ? 1 : 0;
  const o = OMENS[id];
  return `<div class="jr-fishing jr-omen"><div class="giver-h">${esc(L('omen'))}: ${esc(o.name[ru])}</div><p class="jr-fish">${esc(o.text[ru])}</p>${coin && o.keep === 'coin' ? `<button class="btn btn-small" data-act="omen_coin">${esc(L('omenCoin'))}</button>` : ''}</div>`;
}

/** The Atlas of Sea Wonders (docs/12 P10 #8): the wonders found, who found them first, and a name to give. */
function wondersLog(v: WondersView | null): string {
  if (!v || !v.found.length) return '';
  const ru = lang() === 'ru' ? 1 : 0;
  const rows = v.found.map((w) => `<div class="jr-wonder">${icon(WONDER_ICON[w.kind], '✦', 'ico-md')}<div class="nem-text"><b>${esc(serverText(w.name))}</b>
      <span class="muted">${esc(WONDER_KINDS[w.kind].text[ru])}</span><span class="muted">${esc(REGIONS[w.region].name)}${w.first ? ` · ${esc(L('wFirst', { name: w.first }))}` : ''}</span>
      ${w.canName ? `<span class="jr-wname"><input class="field" data-wfor="${esc(w.id)}" maxlength="24" placeholder="${esc(L('wNamePh'))}"><button class="btn btn-small" data-wname="${esc(w.id)}">${esc(L('wName'))}</button></span>` : ''}</div></div>`).join('');
  return `<div class="jr-fishing jr-wonders"><div class="giver-h">${esc(L('wonders', { n: v.found.length, max: v.total }))}</div>${rows}</div>`;
}
const WONDER_ICON: Record<WonderKind, string> = { lagoon: 'map_whirlpool', bones: 'good_leviathan_bone', arch: 'map_cove', cathedral: 'map_city', geyser: 'fire', ice: 'weather_storm', coral: 'good_pearls', singing: 'opt_sound' };

/** The letters of the sea found in bottles (docs/12 P2): a keepsake collection. */
function lettersLog(found: number[]): string {
  if (!found.length) return '';
  const ru = lang() === 'ru' ? 1 : 0;
  return `<div class="jr-letters"><div class="giver-h">${esc(L('letters', { n: found.length, max: SEA_LETTERS.length }))}</div>${found.map((i) => `<p class="jr-letter">${esc(SEA_LETTERS[i]?.[ru] ?? '')}</p>`).join('')}</div>`;
}

/** The fishing atlas (docs/12 P3): every kind of fish, taken or not, with the heaviest. */
function fishingLog(f: FishingView | undefined): string {
  if (!f || (!Object.keys(f.caught).length && !f.method)) return '';
  const ru = lang() === 'ru' ? 1 : 0;
  const kinds = FISH_IDS.filter((id) => id !== 'goldfish' || f.caught.goldfish);
  const rows = kinds.map((id) => {
    const c = f.caught[id];
    return `<p class="jr-fish${c ? '' : ' muted'}">${c ? esc(L('fishRow', { fish: FISH[id].name[ru], n: c.n, kg: c.best.toLocaleString(ru ? 'ru-RU' : 'en-GB') })) : `${esc(FISH[id].name[ru])} — ${esc(L('fishUnknown'))}`}</p>`;
  }).join('');
  return `<div class="jr-fishing"><div class="giver-h">${esc(L('fishing', { n: f.skill, k: Object.keys(f.caught).length, max: kinds.length }))}</div>${rows}</div>`;
}

/** The hunt's tally (docs/12 P4): the beasts taken, by kind. */
function beastLog(b: Partial<Record<BeastId, number>> | undefined): string {
  const kinds = BEAST_IDS.filter((id) => (b?.[id] ?? 0) > 0);
  if (!kinds.length) return '';
  const ru = lang() === 'ru' ? 1 : 0;
  const total = kinds.reduce((a, id) => a + (b![id] ?? 0), 0);
  return `<div class="jr-fishing"><div class="giver-h">${esc(L('beasts', { n: total }))}</div>${kinds.map((id) => `<p class="jr-fish">${esc(L('beastRow', { beast: BEASTS[id].name[ru], n: b![id] ?? 0 }))}</p>`).join('')}</div>`;
}

/** The Hunters' Guild (docs/12 P5): the rank, the heads, each sea's way to its baron, the informant's word. */
function hunterLog(w: WantedView | null): string {
  if (!w || (!w.points && !w.informed)) return '';
  const ru = lang() === 'ru' ? 1 : 0;
  const seas = (Object.entries(w.seas) as [RegionId, number][]).filter(([, n]) => n > 0).map(([sea, n]) => `<p class="jr-fish">${esc(L('guildSea', { sea: REGIONS[sea].name, n: Math.min(3, n), baron: L(n >= 3 ? 'guildBaron' : 'guildBaronNot') }))}</p>`).join('');
  const inf = w.informed ? namedPirates().find((p) => p.id === w.informed!.id) : undefined;
  return `<div class="jr-fishing"><div class="giver-h">${esc(L('guild', { rank: w.rank, n: w.points, next: w.next }))}</div>
    <p class="jr-fish">${esc(L('guildCaps', { n: w.captains }))}</p>${seas}
    ${inf ? `<p class="jr-fish">${esc(L('guildInformed', { name: inf.name[ru], n: w.informed!.sec }))}</p>` : ''}
    <p class="jr-fish muted">${esc(L('guildPerks'))}</p></div>`;
}

/** The Brethren of the Coast (docs/12 P6): the raider's rank and deeds, and the seas whose lanes run hot. */
function brethrenLog(r: RaidView | null): string {
  if (!r) return '';
  const ru = lang() === 'ru' ? 1 : 0;
  const hot = (Object.entries(r.heat) as [RegionId, number][]).filter(([, h]) => h >= 10).map(([sea, h]) => `${REGIONS[sea].name} ${h}%`).join(', ');
  if (!r.fame && !hot) return '';
  return `<div class="jr-fishing"><div class="giver-h">${esc(L('brethren', { rank: BRETHREN_NAMES[r.rank][ru], n: r.fame, next: r.next }))}</div>
    <p class="jr-fish">${esc(L('brethrenStats', { t: r.tributes, c: r.convoys, h: r.honour }))}</p>
    ${hot ? `<p class="jr-fish">${esc(L('heat', { list: hot }))}</p>` : ''}
    <p class="jr-fish muted">${esc(L('brethrenPerks'))}</p></div>`;
}
