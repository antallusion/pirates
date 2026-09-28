// The quest journal (docs/11 P6): the day's orders and the common cause above, the quests under way in a list,
// and the chosen one in full — the giver's face and words, every step (done, now, ahead), the pay — with
// «Follow», «Share» (in a group) and «Set aside».

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
};
const L = dict(EN, RU);

type Quest = NonNullable<ClientState['self']>['quests'][number];

export class Journal {
  private chosen: string | null = null;
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
    root.innerHTML = `<div class="modal-head"><div><h2>${esc(L('title'))}</h2><div class="sub">${esc(L('sub'))}</div></div></div>
      <div class="modal-body journal">
        <div class="jr-side">
          <div class="jr-list">${quests.length ? quests.map((x) => this.row(x, x.id === this.chosen, x.id === tracked)).join('') : `<p class="muted">${esc(L('none'))}</p>`}</div>
          <div class="jr-day">${dailyLog(self?.daily)}${commonLog(self?.common)}${tasksLog(state, false)}${fishingLog(self?.fishing)}${beastLog(self?.beasts)}${lettersLog(self?.seaLetters ?? [])}</div>
          ${self?.questsDone.length ? `<details class="jr-done"><summary>${esc(L('done', { n: self.questsDone.length }))}</summary><ol>${(self.questsRecent ?? []).map((n) => `<li>${esc(serverText(n))}</li>`).join('')}</ol></details>` : ''}
        </div>
        <div class="jr-detail">${q ? this.detail(q, q.id === tracked, inGroup) : ''}</div>
      </div>`;
    root.querySelectorAll<HTMLElement>('[data-jq]').forEach((b) => (b.onclick = () => {
      this.chosen = b.dataset.jq!;
      this.render(root, state);
      root.querySelector('.jr-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
